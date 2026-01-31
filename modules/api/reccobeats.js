/**
 * ReccoBeats API Integration Module
 * 
 * Fetches music recommendations using the ReccoBeats API.
 * 
 * Two main workflows:
 * 1. Seed-based (Similar Recco): Select tracks → Find on ReccoBeats → Get audio features → Get recommendations
 * 2. Mood/Activity-based: Use predefined audio targets → Get recommendations
 * 
 * API Workflow:
 * - Album Search: /v1/album/search → Find albums by name
 * - Track Lookup: /v1/album/:id/track → Get tracks from album  
 * - Audio Features: /v1/track/:id/audio-features → Get audio characteristics
 * - Recommendations: /v1/track/recommendation → Get similar tracks
 * 
 * Caching Strategy:
 * - Per-session cache stored in lastfmCache._reccobeats Map
 * - Cache keys include all query parameters to avoid stale results
 * - Cache is cleared when lastfmCache.clear() is called at end of each run
 * 
 * Rate Limiting:
 * - Respects 429 Too Many Requests responses with exponential backoff
 * - Default delay between requests to avoid hitting rate limits
 * 
 * 
 * 
 * @author Remo Imparato
 * 
 */

'use strict';

// =============================================================================
// CONFIGURATION
// =============================================================================

/** ReccoBeats API base endpoint */
const RECCOBEATS_API_BASE = 'https://api.reccobeats.com/v1';

/** Default timeout for API requests (milliseconds) */
const API_TIMEOUT_MS = 30000;

/** Default delay between requests (ms) */
const RATE_LIMIT_DELAY_MS = 200;

/** Initial backoff on 429 (ms) */
const RATE_LIMIT_BACKOFF_MS = 2000;

/** Max retries on rate limit */
const RATE_LIMIT_MAX_RETRIES = 3;

/** ReccoBeats API key */
const RECCOBEATS_API_KEY = 'c0bb1370-6d44-4e9d-8c25-64c3b09cc0b1';

/** Track last request time for rate limiting */
let lastRequestTime = 0;

// =============================================================================
// AUDIO FEATURE DEFINITIONS
// =============================================================================

/**
 * Audio feature names supported by ReccoBeats recommendation API.
 * Values are typically 0.0-1.0 scale (except tempo which is BPM).
 */
const AUDIO_FEATURE_NAMES = [
	'acousticness', 'danceability', 'energy', 'instrumentalness',
	'liveness', 'loudness', 'mode', 'speechiness', 'tempo', 'valence'
];

/**
 * Audio feature targets for different moods.
 * Used when generating mood-based playlists without seed tracks.
 */
const MOOD_AUDIO_TARGETS = {
	// High-energy pop, EDM, pop-rock, upbeat indie.
	energetic: {
		energy: 0.8,
		valence: 0.7,
		danceability: 0.7,
		speechiness: 0.10,
		loudness: -6,
		liveness: 0.1,
		tempo: 130
	},

	// Chill indie, soft pop, acoustic, mellow electronic.
	relaxed: {
		energy: 0.3,
		valence: 0.5,
		danceability: 0.3,
		acousticness: 0.5,
		instrumentalness: 0.2,
		speechiness: 0.05,
		liveness: 0.1,
		tempo: 80
	},

	// Feel-good pop, upbeat indie, dance-pop.
	happy: {
		energy: 0.6,
		valence: 0.9,
		danceability: 0.6,
		acousticness: 0.2,
		speechiness: 0.10,
		loudness: -5,
		tempo: 115
	},

	// Emotional ballads, soft acoustic, mellow indie.
	sad: {
		energy: 0.3,
		valence: 0.2,
		danceability: 0.3,
		acousticness: 0.6,
		instrumentalness: 0.15,
		speechiness: 0.05,
		loudness: -10,
		tempo: 70
	},

	// Ambient electronic, downtempo, lo-fi beats.
	focused: {
		energy: 0.4,
		valence: 0.4,
		danceability: 0.3,
		instrumentalness: 0.6,
		acousticness: 0.4,
		speechiness: 0.05,
		loudness: -10,
		tempo: 95
	},

	// Hard rock, metalcore, punk, aggressive alt-rock, rap, EDM.
	angry: {
		energy: 0.9,
		valence: 0.2,
		danceability: 0.5,
		speechiness: 0.15,
		acousticness: 0.05,
		loudness: -7,
		tempo: 120
	},

	// Soft pop, R&B, acoustic love songs.
	romantic: {
		energy: 0.4,
		valence: 0.6,
		danceability: 0.4,
		acousticness: 0.5,
		speechiness: 0.05,
		loudness: -8,
		tempo: 90
	},

	// Uplifting pop, indie-pop, cinematic pop, inspirational EDM.
	uplifting: {
		energy: 0.7,
		valence: 0.8,
		danceability: 0.5,
		acousticness: 0.3,
		speechiness: 0.05,
		loudness: -6,
		tempo: 120
	},

	// Dark pop, alt-electronic, moody indie.
	dark: {
		energy: 0.5,
		valence: 0.2,
		danceability: 0.4,
		acousticness: 0.4,
		instrumentalness: 0.3,
		speechiness: 0.05,
		loudness: -8,
		tempo: 100
	}
};

/**
 * Audio feature targets for different activities.
 * Used when generating activity-based playlists without seed tracks.
 */
const ACTIVITY_AUDIO_TARGETS = {
	// High-energy EDM, hip-hop, pop, rock.
	workout: {
		energy: 0.9,
		danceability: 0.8,
		loudness: -5,
		speechiness: 0.10,
		tempo: 140
	},

	// Lo-fi beats, ambient, soft electronic.
	study: {
		energy: 0.3,
		instrumentalness: 0.7,
		acousticness: 0.6,
		speechiness: 0.05,
		liveness: 0.1,
		tempo: 85
	},

	// Dance-pop, EDM, club tracks.
	party: {
		energy: 0.8,
		valence: 0.8,
		danceability: 0.9,
		loudness: -4,
		speechiness: 0.10,
		tempo: 125
	},

	// Ambient, soft acoustic, sleep playlists.
	sleep: {
		energy: 0.1,
		acousticness: 0.75,
		instrumentalness: 0.6,
		speechiness: 0.0,
		liveness: 0.05,
		tempo: 60
	},

	// Driving pop, alt-rock, synth-pop.
	driving: {
		energy: 0.6,
		valence: 0.6,
		danceability: 0.5,
		loudness: -6,
		speechiness: 0.10,
		tempo: 110
	},

	// Meditation/ambient soundscapes.
	meditation: {
		energy: 0.2,
		acousticness: 0.85,
		instrumentalness: 0.85,
		speechiness: 0.0,
		liveness: 0.05,
		tempo: 60
	},

	// Chill pop, upbeat indie, soft electronic.
	cooking: {
		energy: 0.5,
		valence: 0.7,
		danceability: 0.5,
		acousticness: 0.35,
		speechiness: 0.10,
		tempo: 100
	},

	// Upbeat pop, dance-pop, rhythmic indie.
	cleaning: {
		energy: 0.75,
		valence: 0.7,
		danceability: 0.7,
		loudness: -5,
		speechiness: 0.10,
		tempo: 125
	},

	// Indie-pop, soft electronic, light rock.
	walking: {
		energy: 0.55,
		valence: 0.6,
		danceability: 0.6,
		acousticness: 0.3,
		speechiness: 0.05,
		tempo: 115
	},

	// Minimal electronic, downtempo, ambient techno.
	coding: {
		energy: 0.35,
		valence: 0.35,
		danceability: 0.3,
		instrumentalness: 0.7,
		acousticness: 0.3,
		speechiness: 0.05,
		tempo: 90
	}
};

// =============================================================================
// HELPER FUNCTIONS - Rate Limiting & HTTP
// =============================================================================

/**
 * Normalize a string for comparison (lowercase, remove special chars).
 * @param {string} s - String to normalize
 * @returns {string} Normalized string
 */
function normalize(s) {
	return String(s || '').toLowerCase().replace(/[\s\-\_\(\)\[\]\.\'\"]+/g, '').trim();
}

/**
 * Enforce rate limiting delay between requests.
 */
async function enforceRateLimit() {
	const now = Date.now();
	const timeSinceLastRequest = now - lastRequestTime;

	if (timeSinceLastRequest < RATE_LIMIT_DELAY_MS) {
		const delay = RATE_LIMIT_DELAY_MS - timeSinceLastRequest;
		await new Promise(resolve => setTimeout(resolve, delay));
	}

	lastRequestTime = Date.now();
}

/**
 * Create standard headers for ReccoBeats API requests.
 * @returns {Headers} Configured headers object
 */
function createHeaders() {
	const headers = new Headers();
	headers.append('Accept', 'application/json');
	headers.append('x-api-key', RECCOBEATS_API_KEY);
	return headers;
}

/**
 * Make a rate-limited request with 429 retry handling.
 * 
 * @param {string} url - Request URL
 * @param {object} options - Fetch options
 * @param {number} retryCount - Current retry attempt
 * @returns {Promise<Response>} Fetch response
 */
async function rateLimitedFetch(url, options = {}, retryCount = 0) {
	await enforceRateLimit();

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

	try {
		console.log(`ReccoBeats API: ${options.method || 'GET'} ${url}`);
		const res = await fetch(url, { ...options, signal: controller.signal });

		// Handle rate limiting (429)
		if (res.status === 429) {
			if (retryCount >= RATE_LIMIT_MAX_RETRIES) {
				console.error(`ReccoBeats API: Rate limit exceeded after ${RATE_LIMIT_MAX_RETRIES} retries`);
				return res;
			}

			const retryAfter = res.headers.get('Retry-After');
			const backoffMs = retryAfter
				? parseInt(retryAfter, 10) * 1000
				: RATE_LIMIT_BACKOFF_MS * Math.pow(2, retryCount);

			console.log(`ReccoBeats API: Rate limited (429), waiting ${backoffMs}ms before retry ${retryCount + 1}/${RATE_LIMIT_MAX_RETRIES}`);
			
			// Update progress to inform user
			const updateProgress = getUpdateProgress();
			updateProgress(`Rate limited, waiting ${Math.ceil(backoffMs / 1000)}s...`, undefined);
			
			await new Promise(resolve => setTimeout(resolve, backoffMs));

			return rateLimitedFetch(url, options, retryCount + 1);
		}

		if (!res.ok) {
			console.warn(`ReccoBeats API: HTTP ${res.status} ${res.statusText} for ${url}`);
		}

		return res;
	} finally {
		clearTimeout(timeoutId);
	}
}

/**
 * Get the per-session cache Map.
 * @returns {Map|null} Cache map or null if not active
 */
function getCache() {
	const cache = window.lastfmCache;
	if (!cache?.isActive?.()) return null;
	if (!cache._reccobeats) cache._reccobeats = new Map();
	return cache._reccobeats;
}

/**
 * Get progress update function.
 * @returns {Function} Update progress function
 */
function getUpdateProgress() {
	return window.matchMonkeyNotifications?.updateProgress || (() => { });
}

// =============================================================================
// ARTIST SEARCH API
// =============================================================================

/**
 * Search for an artist by name using ReccoBeats API.
 * Searches through paginated results to find exact match.
 * 
 * @param {string} artistName - Artist name to search for
 * @returns {Promise<object|null>} Artist object with id, name or null if not found
 */
async function searchArtist(artistName) {
	if (!artistName) {
		console.warn('searchArtist: No artist name provided');
		return null;
	}

	const cache = getCache();
	const cacheKey = `artist:${artistName}`.toUpperCase();

	// Check cache
	if (cache?.has(cacheKey)) {
		const cached = cache.get(cacheKey);
		console.log(`searchArtist: Cache hit for "${artistName}"`);
		return cached;
	}

	console.log(`searchArtist: Searching for "${artistName}"`);
	const normalizedSearch = normalize(artistName);
	const headers = createHeaders();
	let page = 0;
	let maxPages = 1; // Will be updated from API response
	const maxPagesLimit = 50; // Safety limit to prevent infinite loops

	while (page < maxPages && page < maxPagesLimit) {
		try {
			const url = `${RECCOBEATS_API_BASE}/artist/search?searchText=${encodeURIComponent(artistName)}&page=${page}&size=50`;
			//console.log(`searchArtist: GET ${url}`);

			const res = await rateLimitedFetch(url, { method: 'GET', headers });

			if (!res.ok) {
				console.warn(`searchArtist: HTTP ${res.status} for "${artistName}"`);
				break;
			}

			const data = await res.json();
			const content = data?.content || [];
			const totalPages = data?.totalPages ?? 1;
			
			// Update maxPages from API response
			if (totalPages > maxPages) {
				maxPages = totalPages;
			}

			console.log(`searchArtist: Page ${page + 1}/${totalPages}, ${content.length} results`);

			const match = content.find(a => normalize(a.name || '') === normalizedSearch);

			if (match) {
				const result = { id: match.id, name: match.name };
				cache?.set(cacheKey, result);
				console.log(`searchArtist: Found "${match.name}" (ID: ${match.id})`);
				return result;
			}

			// Move to next page
			page++;
		} catch (e) {
			console.error(`searchArtist: Error for "${artistName}":`, e.message);
			break;
		}
	}

	console.log(`searchArtist: No match found for "${artistName}" after ${page} pages`);
	cache?.set(cacheKey, null);
	return null;
}

// =============================================================================
// ALBUM SEARCH API
// =============================================================================

/**
 * Search for albums by name using ReccoBeats album search API.
 * Searches through paginated results to find exact match.
 * 
 * @param {string} albumName - Album name to search for
 * @returns {Promise<object|null>} Album object with id, name, artistName or null if not found
 */
async function searchAlbum(albumName) {
	if (!albumName) {
		console.warn('searchAlbum: No album name provided');
		return null;
	}

	const cache = getCache();
	const cacheKey = `album:${albumName}`.toUpperCase();

	// Check cache
	if (cache?.has(cacheKey)) {
		const cached = cache.get(cacheKey);
		console.log(`searchAlbum: Cache hit for "${albumName}"`);
		return cached;
	}

	console.log(`searchAlbum: Searching for "${albumName}"`);
	const normalizedSearch = normalize(albumName);
	const headers = createHeaders();
	let page = 0;
	let maxPages = 1; // Will be updated from API response
	const maxPagesLimit = 50; // Safety limit to prevent infinite loops

	while (page < maxPages && page < maxPagesLimit) {
		try {
			const url = `${RECCOBEATS_API_BASE}/album/search?searchText=${encodeURIComponent(albumName)}&page=${page}&size=50`;
			//console.log(`searchAlbum: GET ${url}`);

			const res = await rateLimitedFetch(url, { method: 'GET', headers });

			if (!res.ok) {
				console.warn(`searchAlbum: HTTP ${res.status} for "${albumName}"`);
				break;
			}

			const data = await res.json();
			const content = data?.content || [];
			const totalPages = data?.totalPages ?? 1;
			if (totalPages > maxPages)
				maxPages = totalPages;

			console.log(`searchAlbum: Page ${page + 1}/${totalPages}, ${content.length} results`);

			// Find exact match (case-insensitive, normalized)
			const match = content.find(a => normalize(a.name || '') === normalizedSearch);

			if (match) {
				const result = {
					id: match.id,
					name: match.name,
					artistName: match.artistName || match.artist?.name || ''
				};

				// Cache result
				cache?.set(cacheKey, result);
				console.log(`searchAlbum: Found "${match.name}" by ${result.artistName} (ID: ${match.id})`);
				return result;
			}

			// Check if we've exhausted all pages
			if (page >= totalPages - 1) {
				console.log(`searchAlbum: No exact match for "${albumName}" after ${totalPages} pages`);
				break;
			}

			page++;
		} catch (e) {
			console.error(`searchAlbum: Error searching for "${albumName}":`, e.message);
			break;
		}
	}

	// Cache null result to avoid repeated lookups
	cache?.set(cacheKey, null);
	return null;
}

// =============================================================================
// ALBUM LOOKUP API
// =============================================================================

/**
 * Find a specific album in an artist by title.
 * 
 * @param {string} artistId - ReccoBeats artist ID
 * @param {string} albumName - Album title to find (optional - if not provided, returns all albums)
 * @returns {Promise<object|object[]|null>} Album object if searching, array if listing all, null if not found
 */
async function findAlbumInArtist(artistId, albumName) {
	if (!artistId) {
		console.warn('findAlbumInArtist: No artist ID provided');
		return albumName ? null : [];
	}

	const cache = getCache();
	const cacheKey = `artistalbums:${artistId}`.toUpperCase();

	// If no albumName is provided, we can return cached full list
	if (!albumName && cache?.has(cacheKey)) {
		console.log(`findAlbumInArtist: Cache hit for artist ID ${artistId}`);
		return cache.get(cacheKey) || [];
	}

	const headers = createHeaders();
	let page = 0;
	let maxPages = 1; // Will be updated from API response
	const maxPagesLimit = 50; // Safety limit to prevent infinite loops
	const size = 50;

	const normalizedSearch = albumName ? normalize(albumName) : null;
	let allAlbums = [];

	while (page < maxPages && page < maxPagesLimit) {
		try {
			const url = `${RECCOBEATS_API_BASE}/artist/${artistId}/album?page=${page}&size=${size}`;
			//console.log(`findAlbumInArtist: GET ${url}`);

			const res = await rateLimitedFetch(url, { method: 'GET', headers });

			if (!res.ok) {
				console.warn(`findAlbumInArtist: HTTP ${res.status} for artist ${artistId}`);
				break;
			}

			const data = await res.json();
			const content = data?.content || [];
			const totalPages = data?.totalPages ?? 1;

			// Update maxPages from API response
			if (totalPages > maxPages) {
				maxPages = totalPages;
			}

			console.log(`findAlbumInArtist: Page ${page + 1}/${totalPages} returned ${content.length} albums`);

			// Accumulate all albums (for caching)
			allAlbums = allAlbums.concat(content);

			// If searching for a specific album, try to match
			if (normalizedSearch) {
				const match = content.find(a => matchMonkeyHelpers.cleanAlbumName(normalize(a.name || '')) === normalizedSearch);

				if (match) {
					const result = { id: match.id, name: match.name };
					// Don't cache partial results when searching - only cache full album list
					console.log(`findAlbumInArtist: Found album "${match.name}" (ID: ${match.id})`);
					return result;
				}
			}

			// Move to next page
			page++;
		} catch (e) {
			console.error(`findAlbumInArtist: Error fetching albums for artist ${artistId}:`, e.message);
			break;
		}
	}

	// Cache full album list when we've retrieved everything
	cache?.set(cacheKey, allAlbums);

	if (normalizedSearch) {
		console.log(`findAlbumInArtist: No match for "${albumName}" after ${page} pages`);
		return null;
	}

	console.log(`findAlbumInArtist: Found total ${allAlbums.length} albums for artist ${artistId}`);
	return allAlbums;
}

/**
 * Find an album on ReccoBeats by searching for its artist first.
 * Workflow: Artist Search → Get Artist Albums → Match Album Title
 * 
 * @param {string} artist - Artist name
 * @param {string} album - Album title
 * @returns {Promise<string|null>} Album ID or null if not found
 */
async function findAlbumId(artist, album) {
	if (!artist || !album) {
		console.log(`findAlbumId: Missing artist or album for "${artist} - ${album}"`);
		return null;
	}

	const cache = getCache();
	const cacheKey = `albumid:${artist}:${album}`.toUpperCase();

	// Check cache
	if (cache?.has(cacheKey)) {
		const cached = cache.get(cacheKey);
		if (cached !== undefined) {
			console.log(`findAlbumId: Cache hit for "${artist} - ${album}" -> ${cached || 'null'}`);
			return cached;
		}
	}

	console.log(`findAlbumId: Looking up album "${album}" for artist "${artist}"`);

	// Step 1: Search for the artist
	const artistInfo = await searchArtist(artist);
	if (!artistInfo) {
		console.log(`findAlbumId: Artist "${artist}" not found`);
		cache?.set(cacheKey, null);
		return null;
	}

	// Step 2: Find the album in the artist
	const albumInfo = await findAlbumInArtist(artistInfo.id, album);
	if (!albumInfo) {
		console.log(`findAlbumId: Album "${album}" not found`);
		cache?.set(cacheKey, null);
		return null;
	}

	const albumId = albumInfo.id;
	cache?.set(cacheKey, albumId);
	console.log(`findAlbumId: Found album ID ${albumId} for "${artist} - ${album}"`);

	return albumId;
}

// =============================================================================
// TRACK LOOKUP API
// =============================================================================

/**
 * Get all tracks from an album by album ID.
 * 
 * @param {string} albumId - ReccoBeats album ID
 * @returns {Promise<object[]>} Array of track objects with id, trackTitle, etc.
 */
async function getAlbumTracks(albumId) {
	if (!albumId) {
		console.warn('getAlbumTracks: No album ID provided');
		return [];
	}

	const cache = getCache();
	const cacheKey = `albumtracks:${albumId}`.toUpperCase();

	// Check cache
	if (cache?.has(cacheKey)) {
		console.log(`getAlbumTracks: Cache hit for album ID ${albumId}`);
		return cache.get(cacheKey) || [];
	}

	const headers = createHeaders();

	try {
		const url = `${RECCOBEATS_API_BASE}/album/${albumId}/track`;
		//console.log(`getAlbumTracks: GET ${url}`);

		const res = await rateLimitedFetch(url, { method: 'GET', headers });

		if (!res.ok) {
			console.warn(`getAlbumTracks: HTTP ${res.status} for album ${albumId}`);
			return [];
		}

		const data = await res.json();
		const tracks = data?.content || [];

		console.log(`getAlbumTracks: Found ${tracks.length} tracks in album ${albumId}`);

		// Cache result
		cache?.set(cacheKey, tracks);
		return tracks;
	} catch (e) {
		console.error(`getAlbumTracks: Error fetching tracks for album ${albumId}:`, e.message);
		return [];
	}
}


/**
 * Find a specific track in an album by title.
 * 
 * @param {string} albumId - ReccoBeats album ID
 * @param {string} trackTitle - Track title to find
 * @returns {Promise<object|null>} Track object or null if not found
 */
async function findTrackInAlbum(albumId, trackTitle) {
	const tracks = await getAlbumTracks(albumId);
	if (!tracks.length) return null;

	const normalizedTitle = normalize(trackTitle);

	// Try to match by trackTitle, name, or title fields
	const match = tracks.find(t => t && normalize(matchMonkeyHelpers.cleanTrackName(t.trackTitle)) === normalizedTitle);

	if (match) {
		console.log(`findTrackInAlbum: Found track "${trackTitle}" (ID: ${match.id})`);
	}

	return match || null;
}

/**
 * Find a track on ReccoBeats by searching for its album first.
 * This is the main entry point for finding a track ID.
 * 
 * Workflow: Album Search → Get Album Tracks → Match Track Title
 * 
 * @param {string} artist - Artist name
 * @param {string} title - Track title
 * @param {string} album - Album name
 * @returns {Promise<string|null>} Track ID or null if not found
 */
async function findTrackId(artist, title, album) {
	if (!album || !title) {
		console.log(`findTrackId: Missing album or title for "${artist} - ${title}"`);
		return null;
	}

	const cache = getCache();
	const cacheKey = `trackid:${artist}:${title}:${album}`.toUpperCase();

	// Check cache
	if (cache?.has(cacheKey)) {
		const cached = cache.get(cacheKey);
		if (cached !== undefined) {
			console.log(`findTrackId: Cache hit for "${artist} - ${title}" -> ${cached || 'null'}`);
			return cached;
		}
	}

	console.log(`findTrackId: Looking up "${artist} - ${title}" from album "${album}"`);

	// Step 1: Search for the artist
	const artistInfo = await searchArtist(artist);
	if (!artistInfo) {
		console.log(`findTrackId: Artist "${artist}" not found`);
		cache?.set(cacheKey, null);
		return null;
	}

	// Step 2: Search for the album
	let albumInfo = await findAlbumInArtist(artistInfo.id, album);
	if (!albumInfo) {
		console.log(`findTrackId: Album "${album}" not found, try searching for it`);
	// Step 3: Search for the album
		albumInfo = await searchAlbum(album);
	}

	if (!albumInfo) {
		console.log(`findTrackId: Album "${album}" not found`);
		cache?.set(cacheKey, null);
		return null;
	}

	// Step 4: Find the track in the album
	const track = await findTrackInAlbum(albumInfo.id, title);
	if (!track) {
		console.log(`findTrackId: Track "${title}" not found in album "${album}"`);
		cache?.set(cacheKey, null);
		return null;
	}

	const trackId = track.id;
	cache?.set(cacheKey, trackId);
	console.log(`findTrackId: Found track ID ${trackId} for "${artist} - ${title}"`);
	return trackId;
}

/**
 * Find track IDs for multiple seed tracks (batch mode).
 * 
 * @param {object[]} seeds - Array of {artist, title, album} objects
 * @returns {Promise<Array<{seed: object, trackId: string|null}>>} Array with seed and trackId pairs
 */
async function findTrackIdsBatch(seeds) {
	if (!seeds || seeds.length === 0) return [];

	const updateProgress = getUpdateProgress();
	const results = [];
	const totalSeeds = seeds.length;

	console.log(`findTrackIdsBatch: Processing ${totalSeeds} seed track(s)`);

	for (let i = 0; i < totalSeeds; i++) {
		const seed = seeds[i];

		// Update progress
		const progress = 0.1 + ((i + 1) / totalSeeds) * 0.2;
		updateProgress(`Looking up track ${i + 1}/${totalSeeds}: "${seed.title}"...`, progress);

		const trackId = await findTrackId(seed.artist, seed.title, seed.album);
		results.push({ seed, trackId });
	}

	const foundCount = results.filter(r => r.trackId).length;
	console.log(`findTrackIdsBatch: Found ${foundCount}/${totalSeeds} track IDs`);

	return results;
}

// =============================================================================
// AUDIO FEATURES API
// =============================================================================

/**
 * Fetch audio features for a track by ID.
 * 
 * @param {string} trackId - ReccoBeats track ID
 * @returns {Promise<object|null>} Audio features object or null
 */
async function fetchTrackAudioFeatures(trackId) {
	if (!trackId) {
		console.warn('fetchTrackAudioFeatures: No track ID provided');
		return null;
	}

	const cache = getCache();
	const cacheKey = `audiofeatures:${trackId}`.toUpperCase();

	// Check cache
	if (cache?.has(cacheKey)) {
		const cached = cache.get(cacheKey);
		console.log(`fetchTrackAudioFeatures: Cache hit for track ${trackId}`);
		return cached;
	}

	const headers = createHeaders();

	try {
		// Use the single track audio-features endpoint
		const url = `${RECCOBEATS_API_BASE}/track/${trackId}/audio-features`;
		//console.log(`fetchTrackAudioFeatures: GET ${url}`);

		const res = await rateLimitedFetch(url, { method: 'GET', headers });

		if (!res.ok) {
			console.warn(`fetchTrackAudioFeatures: HTTP ${res.status} for track ${trackId}`);
			cache?.set(cacheKey, null);
			return null;
		}

		const data = await res.json();

		if (!data || typeof data !== 'object') {
			console.log(`fetchTrackAudioFeatures: No audio features for track ${trackId}`);
			cache?.set(cacheKey, null);
			return null;
		}

		// Normalize features object
		const features = {
			id: data.id || trackId,
			acousticness: Number(data.acousticness) || 0,
			danceability: Number(data.danceability) || 0,
			energy: Number(data.energy) || 0,
			instrumentalness: Number(data.instrumentalness) || 0,
			key: Number(data.key) ?? -1,
			liveness: Number(data.liveness) || 0,
			loudness: Number(data.loudness) || 0,
			mode: Number(data.mode) || 0,
			speechiness: Number(data.speechiness) || 0,
			tempo: Number(data.tempo) || 0,
			valence: Number(data.valence) || 0,
		};

		console.log(`fetchTrackAudioFeatures: Got features for ${trackId} (energy: ${features.energy.toFixed(2)}, valence: ${features.valence.toFixed(2)}, tempo: ${features.tempo})`);

		cache?.set(cacheKey, features);
		return features;
	} catch (e) {
		console.error(`fetchTrackAudioFeatures: Error for track ${trackId}:`, e.message);
		return null;
	}
}

async function getAudioFeatures(foundTracks) {
	const audioFeatures = [];

	for (const { seed, trackId } of foundTracks) {
		const features = await fetchTrackAudioFeatures(trackId);
		if (features) {
			audioFeatures.push(features);
		}
	}

	if (audioFeatures.length === 0) {
		console.log('getAudioFeatures: No audio features available');
	}

	return audioFeatures;
}


/**
 * Conditionally blends seed features with mood features.
 *
 * @param {Object} seedAvg     - Averaged audio features from seed tracks
 * @param {Object} moodPreset  - Audio feature targets for the selected mood/activity
 * @param {number} blendRatio  - 0 = all seed, 1 = all mood, 0.5 = equal blend
 *
 * @returns {Object} blended feature object
 */
function blendFeatures(seedAvg, moodPreset, blendRatio) {
	const result = {};
	const templateKeys = Object.keys(moodPreset);

	// Debug collector
	const debug = {
		seedAvg,
		moodPreset,
		blendRatio,
		keys: {},
		final: null
	};

	for (const key of templateKeys) {
		const seedHas = key in seedAvg;
		const moodHas = key in moodPreset;

		if (seedHas && moodHas) {
			const blended =
				seedAvg[key] * (1 - blendRatio) +
				moodPreset[key] * blendRatio;

			result[key] = blended;

			debug.keys[key] = {
				type: "blended",
				seedValue: seedAvg[key],
				moodValue: moodPreset[key],
				blendRatio,
				finalValue: blended
			};
		}

		else if (moodHas) {
			result[key] = moodPreset[key];

			debug.keys[key] = {
				type: "template-only",
				moodValue: moodPreset[key],
				finalValue: moodPreset[key]
			};
		}
	}

	debug.final = result;
	console.info("blendFeatures DEBUG:", debug);

	return result;
}

/**
 * Calculate average audio features from multiple tracks.
 * 
 * @param {object[]} features - Array of audio feature objects
 * @returns {object} Averaged audio features
 */
function calculateAverageFeatures(features) {
	if (!features || features.length === 0) {
		console.warn("calculateAverageFeatures: No features provided.");
		return {};
	}

	const CORE_FEATURES = [
		'energy',
		'valence',
		'danceability',
		'tempo',
		'loudness'
	];

	const CONDITIONAL_FEATURES = [
		'acousticness',
		'instrumentalness',
		'speechiness',
		'mode'
	];

	const result = {};

	const debug = {
		inputCount: features.length,
		core: {},
		conditional: {},
		final: null
	};

	const avg = (name) => {
		const vals = features
			.map(f => f[name])
			.filter(v => v !== undefined && v !== null && !isNaN(v));

		if (vals.length === 0) return undefined;
		return vals.reduce((a, b) => a + b, 0) / vals.length;
	};

	// Core features
	for (const name of CORE_FEATURES) {
		const value = avg(name);

		if (value !== undefined) {
			const finalValue = name === 'tempo'
				? Math.round(value / 5) * 5
				: value;

			result[name] = finalValue;

			debug.core[name] = {
				used: true,
				rawAverage: value,
				finalValue
			};
		} else {
			debug.core[name] = {
				used: false,
				reason: "No valid values found"
			};
		}
	}

	// Conditional features
	for (const name of CONDITIONAL_FEATURES) {
		const vals = features
			.map(f => f[name])
			.filter(v => v !== undefined && v !== null && !isNaN(v));

		if (vals.length === 0) {
			debug.conditional[name] = {
				included: false,
				reason: "No valid values found"
			};
			continue;
		}

		const min = Math.min(...vals);
		const max = Math.max(...vals);
		const variance = max - min;

		if (variance < 0.15) {
			const value = avg(name);
			result[name] = value;

			debug.conditional[name] = {
				included: true,
				values: vals,
				variance,
				threshold: 0.15,
				finalValue: value
			};
		} else {
			debug.conditional[name] = {
				included: false,
				values: vals,
				variance,
				threshold: 0.15,
				reason: "Variance too high"
			};
		}
	}

	debug.final = result;
	console.info("calculateAverageFeatures DEBUG:", debug);

	return result;
}

function getLogAudioFeatures(audioFeatures) {
	const fmt = (v, digits = 2) => {
		if (v === undefined || v === null || Number.isNaN(Number(v))) return 'n/a';
		// For integer-like features (tempo, mode) prefer no decimals when values look integral
		if (Number.isInteger(v)) return String(v);
		return Number(v).toFixed(digits);
	};

	const parts = [
		`energy: ${fmt(audioFeatures.energy)}`,
		`valence: ${fmt(audioFeatures.valence)}`,
		`danceability: ${fmt(audioFeatures.danceability)}`,
		`acousticness: ${fmt(audioFeatures.acousticness)}`,
		`instrumentalness: ${fmt(audioFeatures.instrumentalness)}`,
		`speechiness: ${fmt(audioFeatures.speechiness)}`,
		`liveness: ${fmt(audioFeatures.liveness)}`,
		`loudness: ${audioFeatures.loudness !== undefined && audioFeatures.loudness !== null && !Number.isNaN(Number(audioFeatures.loudness)) ? Number(audioFeatures.loudness).toFixed(1) : 'n/a'}`,
		`mode: ${audioFeatures.mode !== undefined && audioFeatures.mode !== null && !Number.isNaN(Number(audioFeatures.mode)) ? String(audioFeatures.mode) : 'n/a'}`,
		`tempo: ${audioFeatures.tempo !== undefined && audioFeatures.tempo !== null && !Number.isNaN(Number(audioFeatures.tempo)) ? String(audioFeatures.tempo) : 'n/a'}`
	];

	return parts;

}


// =============================================================================
// RECOMMENDATION API
// =============================================================================

/**
 * Fetch track recommendations from ReccoBeats.
 * 
 * @param {string[]} seedIds - Array of seed track IDs (1-5)
 * @param {object} audioTargets - Audio feature targets for filtering
 * @param {number} limit - Maximum recommendations (1-100)
 * @returns {Promise<object[]>} Array of recommended track objects
 */
async function fetchRecommendations(seedIds, audioTargets = {}, limit = 100) {
	// Normalize seedIds into an array if provided
	let seeds = null;

	if (typeof seedIds === 'string') {
		seeds = [seedIds];
	} else if (Array.isArray(seedIds) && seedIds.length > 0) {
		seeds = seedIds.slice(0, 5); // API max 5 seeds
	}

	// Build cache key (seeds optional)
	const cache = getCache();
	const seedKey = seeds ? seeds.join(',') : 'NO_SEEDS';
	const cacheKey = `recommendations:${seedKey}:${JSON.stringify(audioTargets)}:${limit}`.toUpperCase();

	// Cache hit?
	if (cache?.has(cacheKey)) {
		const cached = cache.get(cacheKey);
		console.log(`fetchRecommendations: Cache hit (${cached?.length || 0} tracks)`);
		return cached || [];
	}

	const headers = createHeaders();

	try {
		// Build URL
		const url = new URL(`${RECCOBEATS_API_BASE}/track/recommendation`);
		url.searchParams.append('size', String(limit));

		// Only add seeds if provided
		if (seeds) {
			url.searchParams.append('seeds', seeds.join(','));
		}

		// Add audio feature targets
		for (const [key, value] of Object.entries(audioTargets)) {
			if (AUDIO_FEATURE_NAMES.includes(key) && value != null) {
				url.searchParams.append(key, String(value));
			}
		}

		console.log(`fetchRecommendations: GET ${url.toString()}`);

		const res = await rateLimitedFetch(url.toString(), { method: 'GET', headers });

		if (!res.ok) {
			console.error(`fetchRecommendations: HTTP ${res.status}`);
			return [];
		}

		const data = await res.json();
		const tracks = data?.content || [];

		console.log(`fetchRecommendations: Retrieved ${tracks.length} recommendations`);

		// Cache result
		cache?.set(cacheKey, tracks);
		return tracks;

	} catch (e) {
		console.error('fetchRecommendations: Error:', e.message);
		return [];
	}
}

// =============================================================================
// HIGH-LEVEL DISCOVERY FUNCTIONS
// =============================================================================

/**
 * Get ReccoBeats recommendations based on seed tracks.
 * 
 * This is the main entry point for "Similar Recco" discovery mode.
 * 
 * Workflow:
 * 1. Find track IDs for each seed (via album search)
 * 2. Fetch audio features for found tracks
 * 3. Calculate average audio features
 * 4. Get recommendations using seed IDs and audio features
 * 5. Return recommendations for library matching
 * 
 * @param {object[]} seeds - Seed tracks [{artist, title, album}, ...]
 * @param {number} limit - Maximum recommendations (default 100)
 * @returns {Promise<object>} Result with recommendations array and metadata
 */
async function getReccoRecommendations(seeds, limit = 100) {
	const updateProgress = getUpdateProgress();

	if (!seeds || seeds.length === 0) {
		console.warn('getReccoRecommendations: No seed tracks provided');
		return { recommendations: [], seedCount: 0, foundCount: 0 };
	}

	console.log(`getReccoRecommendations: Processing ${seeds.length} seed track(s)`);

	// Limit to 5 seeds per API spec
	const limitedSeeds = seeds.slice(0, 5);

	// Step 1: Find track IDs
	updateProgress(`Looking up ${limitedSeeds.length} tracks on ReccoBeats...`, 0.1);
	console.log(`getReccoRecommendations: Step 1 - Looking up track IDs`);
	
	const trackResults = await findTrackIdsBatch(limitedSeeds);

	// Filter to found tracks
	const foundTracks = trackResults.filter(r => r.trackId);
	if (foundTracks.length === 0) {
		console.log('getReccoRecommendations: No tracks found on ReccoBeats');
		updateProgress('No tracks found on ReccoBeats', 0.5);
		return { recommendations: [], seedCount: limitedSeeds.length, foundCount: 0 };
	}

	console.log(`getReccoRecommendations: Found ${foundTracks.length}/${limitedSeeds.length} tracks on ReccoBeats`);

	// Step 2: Fetch audio features
	updateProgress(`Analyzing audio features of ${foundTracks.length} tracks...`, 0.35);

	console.log(`getReccoRecommendations: Step 2 - Fetching audio features`);
	
	const audioFeatures = await getAudioFeatures(foundTracks);

	if (audioFeatures.length === 0) {
		console.log('getReccoRecommendations: No audio features available');
		updateProgress('No audio features available', 0.5);
		return { recommendations: [], seedCount: limitedSeeds.length, foundCount: foundTracks.length };
	}

	console.log(`getReccoRecommendations: Retrieved audio features for ${audioFeatures.length} track(s)`);

	// Step 3: Calculate average audio targets
	updateProgress('Computing audio profile...', 0.5);
	console.log(`getReccoRecommendations: Step 3 - Calculating average audio features`);
	
	const audioTargets = calculateAverageFeatures(audioFeatures);
	
	console.log(`getReccoRecommendations: Audio targets - energy: ${audioTargets.energy?.toFixed(2)}, valence: ${audioTargets.valence?.toFixed(2)}, tempo: ${audioTargets.tempo}`);

	// Step 4: Get recommendations
	updateProgress(`Requesting ${limit} acoustic recommendations...`, 0.6);
	console.log(`getReccoRecommendations: Step 4 - Requesting recommendations (limit: ${limit})`);
	
	const seedIds = foundTracks.map(r => r.trackId);

	const recommendations = await fetchRecommendations(seedIds, audioTargets, limit);

	console.log(`getReccoRecommendations: Received ${recommendations.length} recommendations from ReccoBeats`);

	updateProgress(`Received ${recommendations.length} recommendations`, 0.8);

	return {
		recommendations,
		seedCount: limitedSeeds.length,
		foundCount: foundTracks.length,
		audioTargets, audioFeatures
	};
}

/**
 * Get recommendations for a specific mood using predefined audio targets.
 * No seed tracks needed - uses MOOD_AUDIO_TARGETS.
 * 
 * Note: ReccoBeats recommendation API requires seed track IDs, so we cannot
 * directly query by audio features alone. This function is a placeholder
 * that returns the audio targets for local library filtering.
 * 
 * @param {string} mood - Mood name (e.g., 'energetic', 'relaxed')
 * @param {number} limit - Maximum tracks
 * @returns {Promise<object>} Result with audio targets for filtering
 */
async function getMoodRecommendations(mood, limit = 100) {
	const moodLower = (mood || '').toLowerCase();
	const targets = MOOD_AUDIO_TARGETS[moodLower];

	if (!targets) {
		console.warn(`getMoodRecommendations: Unknown mood "${mood}"`);
		return { audioTargets: {}, recommendations: [] };
	}

	console.log(`getMoodRecommendations: Using "${mood}" audio targets:`, targets);

	// Note: Without seed tracks, we can only provide audio targets for filtering
	// The discovery strategy should handle finding tracks in the library
	return {
		audioTargets: { ...targets },
		recommendations: [],
		mood
	};
}

/**
 * Get recommendations for a specific activity using predefined audio targets.
 * No seed tracks needed - uses ACTIVITY_AUDIO_TARGETS.
 * 
 * @param {string} activity - Activity name (e.g., 'workout', 'study')
 * @param {number} limit - Maximum tracks
 * @returns {Promise<object>} Result with audio targets for filtering
 */
async function getActivityRecommendations(activity, limit = 100) {
	const activityLower = (activity || '').toLowerCase();
	const targets = ACTIVITY_AUDIO_TARGETS[activityLower];

	if (!targets) {
		console.warn(`getActivityRecommendations: Unknown activity "${activity}"`);
		return { audioTargets: {}, recommendations: [] };
	}

	console.log(`getActivityRecommendations: Using "${activity}" audio targets:`, targets);

	return {
		audioTargets: { ...targets },
		recommendations: [],
		activity
	};
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Filter tracks by audio feature criteria.
 * 
 * @param {object[]} tracks - Array of track objects with audio features
 * @param {object} criteria - Filter criteria with min/max for each feature
 * @returns {object[]} Filtered tracks
 */
function filterTracksByAudioFeatures(tracks, criteria = {}) {
	if (!Array.isArray(tracks) || tracks.length === 0) return [];

	const {
		minEnergy, maxEnergy,
		minValence, maxValence,
		minTempo, maxTempo,
		minDanceability, maxDanceability,
		minAcousticness, maxAcousticness,
		minInstrumentalness, maxInstrumentalness
	} = criteria;

	return tracks.filter(track => {
		if (!track || typeof track !== 'object') return false;

		if (minEnergy !== undefined && (track.energy || 0) < minEnergy) return false;
		if (maxEnergy !== undefined && (track.energy || 0) > maxEnergy) return false;

		if (minValence !== undefined && (track.valence || 0) < minValence) return false;
		if (maxValence !== undefined && (track.valence || 0) > maxValence) return false;

		if (minTempo !== undefined && (track.tempo || 0) < minTempo) return false;
		if (maxTempo !== undefined && (track.tempo || 0) > maxTempo) return false;

		if (minDanceability !== undefined && (track.danceability || 0) < minDanceability) return false;
		if (maxDanceability !== undefined && (track.danceability || 0) > maxDanceability) return false;

		if (minAcousticness !== undefined && (track.acousticness || 0) < minAcousticness) return false;
		if (maxAcousticness !== undefined && (track.acousticness || 0) > maxAcousticness) return false;

		if (minInstrumentalness !== undefined && (track.instrumentalness || 0) < minInstrumentalness) return false;
		if (maxInstrumentalness !== undefined && (track.instrumentalness || 0) > maxInstrumentalness) return false;

		return true;
	});
}

/**
 * Calculate match score between a track and target audio features.
 * 
 * @param {object} track - Track with audio features
 * @param {object} target - Target audio features
 * @param {object} weights - Optional custom weights
 * @returns {number} Match score 0.0-1.0
 */
function calculateAudioFeatureMatch(track, target, weights = null) {
	if (!track || !target) return 0;

	const defaultWeights = {
		energy: 0.25,
		valence: 0.25,
		danceability: 0.15,
		tempo: 0.15,
		acousticness: 0.1,
		instrumentalness: 0.1
	};

	const w = weights || defaultWeights;
	let totalWeight = 0;
	let weightedScore = 0;

	// Energy match
	if (track.energy !== undefined && target.energy !== undefined) {
		const diff = Math.abs(track.energy - target.energy);
		weightedScore += (1.0 - diff) * (w.energy || 0);
		totalWeight += w.energy || 0;
	}

	// Valence match
	if (track.valence !== undefined && target.valence !== undefined) {
		const diff = Math.abs(track.valence - target.valence);
		weightedScore += (1.0 - diff) * (w.valence || 0);
		totalWeight += w.valence || 0;
}

	// Danceability match
	if (track.danceability !== undefined && target.danceability !== undefined) {
		const diff = Math.abs(track.danceability - target.danceability);
		weightedScore += (1.0 - diff) * (w.danceability || 0);
		totalWeight += w.danceability || 0;
	}

	// Tempo match (normalized, assuming 60-180 BPM range)
	if (track.tempo !== undefined && target.tempo !== undefined) {
		const diff = Math.abs(track.tempo - target.tempo);
		const score = Math.max(0, 1.0 - (diff / 60));
		weightedScore += score * (w.tempo || 0);
		totalWeight += w.tempo || 0;
	}

	// Acousticness match
	if (track.acousticness !== undefined && target.acousticness !== undefined) {
		const diff = Math.abs(track.acousticness - target.acousticness);
		weightedScore += (1.0 - diff) * (w.acousticness || 0);
		totalWeight += w.acousticness || 0;
	}

	// Instrumentalness match
	if (track.instrumentalness !== undefined && target.instrumentalness !== undefined) {
		const diff = Math.abs(track.instrumentalness - target.instrumentalness);
		weightedScore += (1.0 - diff) * (w.instrumentalness || 0);
		totalWeight += w.instrumentalness || 0;
	}

	// Return normalized score
	return totalWeight > 0 ? (weightedScore / totalWeight) : 0;
}

// =============================================================================
// MODULE EXPORTS
// =============================================================================

// Export to window namespace for MM5
window.matchMonkeyReccoBeatsAPI = {
	// Main discovery functions
	getReccoRecommendations,
	getMoodRecommendations,
	getActivityRecommendations,

	// Low-level API functions
	searchAlbum,
	getAlbumTracks,
	getAudioFeatures,
	findTrackInAlbum,
	findTrackId,
	findTrackIdsBatch,
	fetchTrackAudioFeatures,
	fetchRecommendations,

	// Artist search (for future use)
	searchArtist,

	// Utility functions
	filterTracksByAudioFeatures,
	calculateAudioFeatureMatch,
	calculateAverageFeatures,
	blendFeatures,

	// Audio target presets
	MOOD_AUDIO_TARGETS,
	ACTIVITY_AUDIO_TARGETS,
	AUDIO_FEATURE_NAMES,

	// Constants
	RECCOBEATS_API_BASE,
	API_TIMEOUT_MS,
};
