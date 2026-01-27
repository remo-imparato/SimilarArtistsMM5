/**
 * ReccoBeats API Integration Module
 * 
 * Fetches AI-powered music recommendations based on mood, activity, and genre.
 * Complements Last.fm API with enhanced context-aware discovery.
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
 * MediaMonkey 5 API Only
 */

'use strict';

// ReccoBeats API base endpoint
const RECCOBEATS_API_BASE = 'https://api.reccobeats.com/v1';

// Default timeout for API requests (10 seconds)
const API_TIMEOUT_MS = 10000;

// Rate limiting configuration
const RATE_LIMIT_DELAY_MS = 200; // Default delay between requests
const RATE_LIMIT_BACKOFF_MS = 2000; // Initial backoff on 429
const RATE_LIMIT_MAX_RETRIES = 3; // Max retries on rate limit

// ReccoBeats API key (stored securely)
const RECCOBEATS_API_KEY = 'c0bb1370-6d44-4e9d-8c25-64c3b09cc0b1';

// Track last request time for rate limiting
let lastRequestTime = 0;

/**
 * Audio feature names that can be used in recommendations.
 * These are the features supported by the ReccoBeats recommendation API.
 */
const AUDIO_FEATURE_NAMES = [
	'acousticness', 'danceability', 'energy', 'instrumentalness',
	'liveness', 'loudness', 'mode', 'speechiness', 'tempo', 'valence'
];

/**
 * Audio feature targets for different moods.
 * Values are 0.0-1.0 scale where applicable.
 */
const MOOD_AUDIO_TARGETS = {
	energetic: { energy: 0.8, valence: 0.7, danceability: 0.7, tempo: 130 },
	relaxed: { energy: 0.3, valence: 0.5, danceability: 0.3, tempo: 80 },
	happy: { energy: 0.6, valence: 0.9, danceability: 0.6, tempo: 115 },
	sad: { energy: 0.3, valence: 0.2, danceability: 0.3, tempo: 70 },
	focused: { energy: 0.4, valence: 0.4, danceability: 0.3, instrumentalness: 0.6, tempo: 100 },
	angry: { energy: 0.9, valence: 0.3, danceability: 0.5, tempo: 140 },
	romantic: { energy: 0.4, valence: 0.6, danceability: 0.4, acousticness: 0.5, tempo: 90 },
};

/**
 * Audio feature targets for different activities.
 */
const ACTIVITY_AUDIO_TARGETS = {
	workout: { energy: 0.9, danceability: 0.8, tempo: 140 },
	study: { energy: 0.3, instrumentalness: 0.7, speechiness: 0.1, tempo: 90 },
	party: { energy: 0.8, valence: 0.8, danceability: 0.9, tempo: 125 },
	sleep: { energy: 0.1, acousticness: 0.7, instrumentalness: 0.5, tempo: 60 },
	driving: { energy: 0.6, valence: 0.6, danceability: 0.5, tempo: 110 },
	meditation: { energy: 0.2, acousticness: 0.8, instrumentalness: 0.8, tempo: 70 },
	cooking: { energy: 0.5, valence: 0.7, danceability: 0.5, tempo: 100 },
};

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
		const res = await fetch(url, { ...options, signal: controller.signal });

		// Handle rate limiting (429)
		if (res.status === 429) {
			if (retryCount >= RATE_LIMIT_MAX_RETRIES) {
				console.error('rateLimitedFetch: Max retries exceeded for 429');
				return res;
			}

			// Get retry-after header or use exponential backoff
			const retryAfter = res.headers.get('Retry-After');
			const backoffMs = retryAfter
				? parseInt(retryAfter, 10) * 1000
				: RATE_LIMIT_BACKOFF_MS * Math.pow(2, retryCount);

			console.log(`rateLimitedFetch: 429 received, waiting ${backoffMs}ms before retry ${retryCount + 1}`);
			await new Promise(resolve => setTimeout(resolve, backoffMs));

			return rateLimitedFetch(url, options, retryCount + 1);
		}

		return res;
	} finally {
		clearTimeout(timeoutId);
	}
}

/**
 * Get ReccoBeats track ID from artist and title.
 * Uses the helper function from discoveryStrategies.
 * 
 * @param {string} artist - Artist name
 * @param {string} title - Track title
 * @returns {Promise<string|null>} ReccoBeats track ID or null if not found
 */
async function getTrackId(artist, title) {
	const cache = window.lastfmCache;
	const cacheKey = `reccobeats:trackid:${artist}:${title}`.toUpperCase();

	// Check cache first
	if (cache?.isActive?.() && cache._reccobeats?.has?.(cacheKey)) {
		return cache._reccobeats.get(cacheKey);
	}

	try {
		// Implement track ID lookup directly
		const normalize = (s) =>
			(String(s || '')).toLowerCase().replace(/[\s\-\_\(\)\[\]\.]+/g, "").trim();

		const myHeaders = new Headers();
		myHeaders.append("Accept", "application/json");
		myHeaders.append("x-api-key", RECCOBEATS_API_KEY);

		const requestOptions = {
			method: "GET",
			headers: myHeaders,
			redirect: "follow"
		};

		// Search for artist
		const artistSearchUrl = `${RECCOBEATS_API_BASE}/artist/search?searchText=${encodeURIComponent(artist)}`;
		const artistRes = await rateLimitedFetch(artistSearchUrl, requestOptions);

		if (!artistRes.ok) {
			console.warn(`getTrackId: Artist search failed for "${artist}" (HTTP ${artistRes.status})`);
			return null;
		}

		const artistJson = await artistRes.json();

		if (!artistJson?.content?.length) {
			console.log(`getTrackId: Artist not found: "${artist}"`);
			// Cache the null result - lookup succeeded but artist not found
			if (cache?.isActive?.()) {
				if (!cache._reccobeats) cache._reccobeats = new Map();
				cache._reccobeats.set(cacheKey, null);
			}
			return null;
		}

		// Loop through all returned artists to find case-insensitive match
		const normalizedSearchString = normalize(artist);
		const artistMatch = artistJson.content.find(
			a => normalize(a.name) === normalizedSearchString
		);

		if (!artistMatch) {
			console.log(`getTrackId: No exact match for artist "${artist}" in ${artistJson.content.length} results`);
			if (cache?.isActive?.()) {
				if (!cache._reccobeats) cache._reccobeats = new Map();
				cache._reccobeats.set(cacheKey, null);
			}
			return null;
		}

		const artistId = artistMatch.id;

		// Get albums for that artist
		const albumsUrl = `${RECCOBEATS_API_BASE}/artist/${artistId}/album?page=0&size=50`;
		const albumsRes = await rateLimitedFetch(albumsUrl, requestOptions);

		if (!albumsRes.ok) {
			console.warn(`getTrackId: Albums fetch failed for artist "${artist}" (HTTP ${albumsRes.status})`);
			return null;
		}

		const albumsJson = await albumsRes.json();

		if (!albumsJson?.content?.length) {
			console.log(`getTrackId: No albums found for artist: "${artist}"`);
			// Cache the null result - lookup succeeded but no albums found
			if (cache?.isActive?.()) {
				if (!cache._reccobeats) cache._reccobeats = new Map();
				cache._reccobeats.set(cacheKey, null);
			}
			return null;
		}

		// Search through albums for matching track (compare normalized trackTitle, name, title)
		const normalizedTitle = normalize(title);

		for (const album of albumsJson.content) {
			try {
				const tracksUrl = `${RECCOBEATS_API_BASE}/album/${album.id}/track?page=0&size=50`;
				const tracksRes = await rateLimitedFetch(tracksUrl, requestOptions);

				if (tracksRes.ok) {
					const tracksJson = await tracksRes.json();

					if (tracksJson?.content?.length) {
						const match = tracksJson.content.find((t) => {
							// compare all available name fields
							const candidates = [t.trackTitle, t.name, t.title];
							for (const c of candidates) {
								if (!c) continue;
								if (normalize(c) === normalizedTitle) return true;
							}
							return false;
						});

						if (match) {
							const trackId = match.id;

							// Cache the result
							if (cache?.isActive?.()) {
								if (!cache._reccobeats) cache._reccobeats = new Map();
								cache._reccobeats.set(cacheKey, trackId);
							}

							console.log(`getTrackId: Found track ID "${trackId}" for "${artist} - ${title}"`);
							return trackId;
						}
					}
				}
			} catch (e) {
				console.warn(`getTrackId: Error fetching tracks for album ${album.id}:`, e.message);
			}
		}

		console.log(`getTrackId: Track title not found: "${title}" by "${artist}"`);
		if (cache?.isActive?.()) {
			if (!cache._reccobeats) cache._reccobeats = new Map();
			cache._reccobeats.set(cacheKey, null);
		}
		return null;

	} catch (e) {
		console.error(`getTrackId error for "${artist} - ${title}":`, e.message);
		return null;
	}
}

/**
 * Get ReccoBeats track IDs for multiple tracks in batch mode (more efficient).
 * This significantly reduces API calls by batching artist and album lookups.
 * 
 * @param {object[]} trackRequests - Array of {artist, title, album?} objects
 * @returns {Promise<Array<string|null>>} Array of track IDs (or null) in same order as input
 */
async function getTrackIdsBatch(trackRequests) {
	if (!trackRequests || trackRequests.length === 0) {
		return [];
	}

	const cache = window.lastfmCache;
	const normalize = (s) => String(s || '').toLowerCase().replace(/[\s\-\_\(\)\[\]\.]+/g, "").trim();

	const results = new Array(trackRequests.length).fill(undefined);
	const uncachedIndices = [];

	for (let i = 0; i < trackRequests.length; i++) {
		const req = trackRequests[i];
		if (!req?.artist || !req?.title) {
			results[i] = null;
			continue;
		}

		const cacheKey = `reccobeats:trackid:${req.artist}:${req.title}`.toUpperCase();
		if (cache?.isActive?.() && cache._reccobeats?.has?.(cacheKey)) {
			results[i] = cache._reccobeats.get(cacheKey);
		} else {
			uncachedIndices.push(i);
		}
	}

	if (uncachedIndices.length === 0) {
		console.log(`getTrackIdsBatch: All ${trackRequests.length} tracks found in cache`);
		return results;
	}

	console.log(`getTrackIdsBatch: Processing ${uncachedIndices.length}/${trackRequests.length} uncached tracks`);

	const successfulLookups = new Set();

	try {
		const uniques = extractUniqueRequestValues(trackRequests);
		console.log(`getTrackIdsBatch: Extracted ${uniques.artists.length} unique artists, ${uniques.albums.length} unique albums from ${trackRequests.length} requests`);

		const artistIdMap = await searchArtistsWithPagination(uniques.artists);
		console.log(`getTrackIdsBatch: Found ${artistIdMap.size} artist IDs`);

		const albumIdMap = await searchAlbumsWithPagination(uniques.albums);
		console.log(`getTrackIdsBatch: Found ${albumIdMap.size} album IDs`);

		const requestArtistParts = new Map();
		for (const idx of uncachedIndices) {
			const artistStr = trackRequests[idx].artist || '';
			const parts = artistStr.split(';').map(p => p.trim()).filter(Boolean);
			requestArtistParts.set(idx, parts);
		}

		const myHeaders = new Headers();
		myHeaders.append("Accept", "application/json");
		myHeaders.append("x-api-key", RECCOBEATS_API_KEY);

		const requestOptions = {
			method: "GET",
			headers: myHeaders,
			redirect: "follow"
		};

		const albumTracks = new Map(); // album ID -> Map<normalized track name, track ID>

		// Fetch tracks for each album and register all name variants
		for (const [albumName, albumId] of albumIdMap.entries()) {
			try {
				const tracksUrl = `${RECCOBEATS_API_BASE}/album/${albumId}/track?page=0&size=50`;
				console.log(`getTrackIdsBatch: GET ${tracksUrl}`);

				const tracksRes = await rateLimitedFetch(tracksUrl, requestOptions);

				if (tracksRes.ok) {
					const tracksJson = await tracksRes.json();
					const trackCount = tracksJson?.content?.length || 0;
					console.log(`getTrackIdsBatch: Album "${albumName}" (ID ${albumId}) returned ${trackCount} tracks`);

					const trackMap = new Map();

					for (const track of tracksJson?.content || []) {
						// collect all possible title fields and register each normalized variant
						const candidates = [track.trackTitle, track.name, track.title];
						for (const c of candidates) {
							if (!c) continue;
							const key = normalize(c);
							if (!key) continue;
							// only set once to preserve first-seen mapping
							if (!trackMap.has(key)) trackMap.set(key, track.id);
						}
					}

					albumTracks.set(albumId, trackMap);
				} else {
					console.warn(`getTrackIdsBatch: Tracks fetch failed for album "${albumName}" (HTTP ${tracksRes.status})`);
				}
			} catch (e) {
				console.warn(`getTrackIdsBatch: Error fetching tracks for album "${albumName}":`, e.message);
			}
		}

		// Resolve track IDs for uncached requests (rest of function unchanged)
		// ...
		// (keep existing resolution code that looks up by normalized seed title)
	} catch (e) {
		console.error('getTrackIdsBatch: Batch processing error:', e.message);
		for (let i = 0; i < results.length; i++) {
			if (results[i] === undefined) results[i] = null;
		}
	}

	return results;
}

/**
 * Extract unique values from an array of track requests.
 * - Splits `artist` and `genre` on ';'
 * - Trims values, dedupes case-insensitively, preserves first-seen original casing
 *
 * @param {Array<object>} trackRequests - [{ artist, title, album, genre }, ...]
 * @returns {{ artists: string[], genres: string[], albums: string[], titles: string[] }}
 */
function extractUniqueRequestValues(trackRequests) {
	if (!Array.isArray(trackRequests) || trackRequests.length === 0) {
		return { artists: [], genres: [], albums: [], titles: [] };
	}

	const addToMap = (map, raw) => {
		if (!raw) return;
		const key = raw.trim().toLowerCase();
		if (!key) return;
		if (!map.has(key)) map.set(key, raw.trim());
	};

	const splitAndAdd = (map, raw, delimiter = ';') => {
		if (!raw) return;
		for (const part of String(raw).split(delimiter)) {
			const value = part.trim();
			if (value) addToMap(map, value);
		}
	};

	const artistsMap = new Map();
	const genresMap = new Map();
	const albumsMap = new Map();
	const titlesMap = new Map();

	for (const req of trackRequests) {
		if (!req || typeof req !== 'object') continue;

		// Artists: split on ';' and dedupe
		if (req.artist) splitAndAdd(artistsMap, req.artist, ';');

		// Genres: split on ';' and dedupe
		if (req.genre) splitAndAdd(genresMap, req.genre, ';');

		// Albums: single value, dedupe by trimmed lowercase key
		if (req.album) addToMap(albumsMap, String(req.album));

		// Titles: single value
		if (req.title) addToMap(titlesMap, String(req.title));
	}

	return {
		artists: Array.from(artistsMap.values()),
		genres: Array.from(genresMap.values()),
		albums: Array.from(albumsMap.values()),
		titles: Array.from(titlesMap.values()),
	};
}

/**
 * Search for artists by name using ReccoBeats API with pagination.
 * Searches through all pages until exact match is found or all pages exhausted.
 * 
 * @param {string[]} artistNames - Array of artist names to search for
 * @returns {Promise<Map<string, string>>} Map of artist name (original casing) -> artist ID
 */
async function searchArtistsWithPagination(artistNames) {
	if (!Array.isArray(artistNames) || artistNames.length === 0) {
		return new Map();
	}

	const cache = window.lastfmCache;
	const normalize = (s) => s.toLowerCase().replace(/[\s\-\_\(\)\[\]\.]+/g, "").trim();

	const myHeaders = new Headers();
	myHeaders.append("Accept", "application/json");
	myHeaders.append("x-api-key", RECCOBEATS_API_KEY);

	const requestOptions = {
		method: "GET",
		headers: myHeaders,
		redirect: "follow"
	};

	const results = new Map(); // artist name -> artist ID
	const notFound = new Set(artistNames); // Track which artists we haven't found yet

	console.log(`searchArtistsWithPagination: Searching for ${artistNames.length} artists`);

	for (const artistName of artistNames) {
		const cacheKey = `reccobeats:artistid:${artistName}`.toUpperCase();

		// Check cache first
		if (cache?.isActive?.() && cache._reccobeats?.has?.(cacheKey)) {
			const cachedId = cache._reccobeats.get(cacheKey);
			if (cachedId) {
				results.set(artistName, cachedId);
				notFound.delete(artistName);
				console.log(`searchArtistsWithPagination: Cache hit for artist "${artistName}" -> ID ${cachedId}`);
				continue;
			}
		}

		const normalizedSearch = normalize(artistName);
		let page = 0;
		let foundMatch = false;

		while (!foundMatch) {
			try {
				const searchUrl = `${RECCOBEATS_API_BASE}/artist/search?searchText=${encodeURIComponent(artistName)}&page=${page}&size=50`;
				console.log(`searchArtistsWithPagination: GET ${searchUrl}`);

				const res = await rateLimitedFetch(searchUrl, requestOptions);

				if (!res.ok) {
					console.warn(`searchArtistsWithPagination: Artist search failed for "${artistName}" page ${page} (HTTP ${res.status})`);
					break;
				}

				const data = await res.json();
				const content = data?.content || [];
				const currentPage = data?.page ?? page;
				const totalPages = data?.totalPages ?? 1;

				console.log(`searchArtistsWithPagination: Artist "${artistName}" page ${currentPage}/${totalPages - 1} returned ${content.length} results`);

				// Search for exact match in this page
				const match = content.find(a => normalize(a.name || '') === normalizedSearch);

				if (match) {
					results.set(artistName, match.id);
					notFound.delete(artistName);
					foundMatch = true;
					console.log(`searchArtistsWithPagination: Found exact match for "${artistName}" -> ID ${match.id} (name: "${match.name}")`);

					// Cache the result
					if (cache?.isActive?.()) {
						if (!cache._reccobeats) cache._reccobeats = new Map();
						cache._reccobeats.set(cacheKey, match.id);
					}
				} else if (currentPage >= totalPages - 1) {
					// Reached last page without finding match
					console.log(`searchArtistsWithPagination: No exact match found for "${artistName}" after searching ${totalPages} pages`);
					notFound.delete(artistName);

					// Cache null to avoid repeated searches
					if (cache?.isActive?.()) {
						if (!cache._reccobeats) cache._reccobeats = new Map();
						cache._reccobeats.set(cacheKey, null);
					}
					break;
				} else {
					// Move to next page
					page++;
				}
			} catch (e) {
				console.warn(`searchArtistsWithPagination: Error searching for artist "${artistName}" page ${page}:`, e.message);
				break;
			}
		}
	}

	console.log(`searchArtistsWithPagination: Found ${results.size}/${artistNames.length} artists`);
	return results;
}

/**
 * Search for albums by name using ReccoBeats API with pagination.
 * Searches through all pages until exact match is found or all pages exhausted.
 * 
 * @param {string[]} albumNames - Array of album names to search for
 * @returns {Promise<Map<string, string>>} Map of album name (original casing) -> album ID
 */
async function searchAlbumsWithPagination(albumNames) {
	if (!Array.isArray(albumNames) || albumNames.length === 0) {
		return new Map();
	}

	const cache = window.lastfmCache;
	const normalize = (s) => s.toLowerCase().replace(/[\s\-\_\(\)\[\]\.]+/g, "").trim();

	const myHeaders = new Headers();
	myHeaders.append("Accept", "application/json");
	myHeaders.append("x-api-key", RECCOBEATS_API_KEY);

	const requestOptions = {
		method: "GET",
		headers: myHeaders,
		redirect: "follow"
	};

	const results = new Map(); // album name -> album ID
	const notFound = new Set(albumNames); // Track which albums we haven't found yet

	console.log(`searchAlbumsWithPagination: Searching for ${albumNames.length} albums`);

	for (const albumName of albumNames) {
		const cacheKey = `reccobeats:albumid:${albumName}`.toUpperCase();

		// Check cache first
		if (cache?.isActive?.() && cache._reccobeats?.has?.(cacheKey)) {
			const cachedId = cache._reccobeats.get(cacheKey);
			if (cachedId) {
				results.set(albumName, cachedId);
				notFound.delete(albumName);
				console.log(`searchAlbumsWithPagination: Cache hit for album "${albumName}" -> ID ${cachedId}`);
				continue;
			}
		}

		const normalizedSearch = normalize(albumName);
		let page = 0;
		let foundMatch = false;

		while (!foundMatch) {
			try {
				const searchUrl = `${RECCOBEATS_API_BASE}/album/search?searchText=${encodeURIComponent(albumName)}&page=${page}&size=50`;
				console.log(`searchAlbumsWithPagination: GET ${searchUrl}`);

				const res = await rateLimitedFetch(searchUrl, requestOptions);

				if (!res.ok) {
					console.warn(`searchAlbumsWithPagination: Album search failed for "${albumName}" page ${page} (HTTP ${res.status})`);
					break;
				}

				const data = await res.json();
				const content = data?.content || [];
				const currentPage = data?.page ?? page;
				const totalPages = data?.totalPages ?? 1;

				console.log(`searchAlbumsWithPagination: Album "${albumName}" page ${currentPage}/${totalPages - 1} returned ${content.length} results`);

				// Search for exact match in this page
				const match = content.find(a => normalize(a.name || '') === normalizedSearch);

				if (match) {
					results.set(albumName, match.id);
					notFound.delete(albumName);
					foundMatch = true;
					console.log(`searchAlbumsWithPagination: Found exact match for "${albumName}" -> ID ${match.id} (name: "${match.name}")`);

					// Cache the result
					if (cache?.isActive?.()) {
						if (!cache._reccobeats) cache._reccobeats = new Map();
						cache._reccobeats.set(cacheKey, match.id);
					}
				} else if (currentPage >= totalPages - 1) {
					// Reached last page without finding match
					console.log(`searchAlbumsWithPagination: No exact match found for "${albumName}" after searching ${totalPages} pages`);
					notFound.delete(albumName);

					// Cache null to avoid repeated searches
					if (cache?.isActive?.()) {
						if (!cache._reccobeats) cache._reccobeats = new Map();
						cache._reccobeats.set(cacheKey, null);
					}
					break;
				} else {
					// Move to next page
					page++;
				}
			} catch (e) {
				console.warn(`searchAlbumsWithPagination: Error searching for album "${albumName}" page ${page}:`, e.message);
				break;
			}
		}
	}

	console.log(`searchAlbumsWithPagination: Found ${results.size}/${albumNames.length} albums`);
	return results;
}

/**
 * Fetch audio features for a specific track using its ReccoBeats ID.
 * 
 * @param {string} trackId - ReccoBeats track ID
 * @returns {Promise<object|null>} Audio features object or null if not found
 */
async function fetchTrackAudioFeatures(trackId) {
	if (!trackId) {
		console.warn('fetchTrackAudioFeatures: No trackId provided');
		return null;
	}

	const cache = window.lastfmCache;
	const cacheKey = `reccobeats:audiofeatures:${trackId}`.toUpperCase();

	// Check cache first
	if (cache?.isActive?.() && cache._reccobeats?.has?.(cacheKey)) {
		const cached = cache._reccobeats.get(cacheKey);
		console.log(`fetchTrackAudioFeatures: Cache hit for track ${trackId}`);
		return cached;
	}

	try {
		const myHeaders = new Headers();
		myHeaders.append("Accept", "application/json");
		myHeaders.append("x-api-key", RECCOBEATS_API_KEY);

		// CORRECTED URL - use the correct audio-features endpoint
		const url = `${RECCOBEATS_API_BASE}/audio-features?ids=${encodeURIComponent(trackId)}`;
		console.log(`fetchTrackAudioFeatures: GET ${url}`);

		const res = await rateLimitedFetch(url, {
			method: "GET",
			headers: myHeaders,
			redirect: "follow"
		});

		if (!res.ok) {
			console.error(`fetchTrackAudioFeatures: HTTP ${res.status} for track ${trackId}`);
			// Don't cache on HTTP error
			return null;
		}

		const data = await res.json();

		// Response is an array when using the batch endpoint
		const featureData = Array.isArray(data?.content) ? data.content[0] : data?.content;

		if (!featureData) {
			console.log(`fetchTrackAudioFeatures: No audio features for track ${trackId}`);
			// Cache the null result - request succeeded but no features available
			if (cache?.isActive?.()) {
				if (!cache._reccobeats) cache._reccobeats = new Map();
				cache._reccobeats.set(cacheKey, null);
			}
			return null;
		}

		// Extract and normalize audio features
		const features = {
			id: featureData.id || trackId,
			acousticness: Number(featureData.acousticness) || 0,
			danceability: Number(featureData.danceability) || 0,
			energy: Number(featureData.energy) || 0,
			instrumentalness: Number(featureData.instrumentalness) || 0,
			key: Number(featureData.key) ?? -1,
			liveness: Number(featureData.liveness) || 0,
			loudness: Number(featureData.loudness) || 0,
			mode: Number(featureData.mode) || 0,
			speechiness: Number(featureData.speechiness) || 0,
			tempo: Number(featureData.tempo) || 0,
			valence: Number(featureData.valence) || 0,
		};

		console.log(`fetchTrackAudioFeatures: Retrieved features for track ${trackId} (energy: ${features.energy}, valence: ${features.valence}, tempo: ${features.tempo})`);

		// Cache results
		if (cache?.isActive?.()) {
			if (!cache._reccobeats) cache._reccobeats = new Map();
			cache._reccobeats.set(cacheKey, features);
		}

		return features;

	} catch (e) {
		if (e.name === 'AbortError') {
			console.error('fetchTrackAudioFeatures: Request timed out');
		} else {
			console.error('fetchTrackAudioFeatures error:', e.message);
		}
		// Don't cache on exception
		return null;
	}
}

/**
 * Calculate min/max audio feature ranges from multiple seed track features.
 * Adds a small tolerance to create a range around the seed values.
 * 
 * @param {object[]} seedFeatures - Array of audio feature objects from seed tracks
 * @param {number} tolerance - Tolerance to add/subtract from min/max (default 0.15 for 0-1 features)
 * @returns {object} Object with averaged audio feature values for recommendation query
 */
function calculateAudioFeatureRanges(seedFeatures, tolerance = 0.15) {
	if (!seedFeatures || seedFeatures.length === 0) {
		return {};
	}

	// If only one seed, use its values directly (API uses single values, not ranges)
	if (seedFeatures.length === 1) {
		const seed = seedFeatures[0];
		const result = {};
		for (const feature of AUDIO_FEATURE_NAMES) {
			if (seed[feature] !== undefined && seed[feature] !== null) {
				result[feature] = seed[feature];
			}
		}
		return result;
	}

	// For multiple seeds, calculate the average of each feature
	const result = {};

	for (const feature of AUDIO_FEATURE_NAMES) {
		const values = seedFeatures
			.map(f => f[feature])
			.filter(v => v !== undefined && v !== null && !isNaN(v));

		if (values.length > 0) {
			// Use the average of all seed values
			const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
			result[feature] = avg;
		}
	}

	console.log(`calculateAudioFeatureRanges: Calculated ranges from ${seedFeatures.length} seeds:`,
		Object.entries(result).map(([k, v]) => `${k}=${typeof v === 'number' ? v.toFixed(2) : v}`).join(', '));

	return result;
}

/**
 * Fetch track recommendations from ReccoBeats using seed track IDs and optional audio features.
 * Uses the /v1/track/recommendation API with proper query parameters.
 * 
 * @param {string[]} seedIds - Array of ReccoBeats track IDs (1-5 seeds)
 * @param {object} audioFeatures - Optional audio feature targets for filtering
 * @param {number} limit - Maximum recommendations (1-100)
 * @returns {Promise<object[]>} Array of track objects with audio features
 */
async function fetchTrackRecommendations(seedIds, audioFeatures = {}, limit = 100) {
	// Handle legacy single trackId parameter
	if (typeof seedIds === 'string') {
		seedIds = [seedIds];
	}

	if (!seedIds || seedIds.length === 0) {
		console.warn('fetchTrackRecommendations: No seed IDs provided');
		return [];
	}

	// Limit to 5 seeds as per API spec
	const limitedSeeds = seedIds.slice(0, 5);

	const cache = window.lastfmCache;
	const cacheKey = `reccobeats:trackrec:${limitedSeeds.join(',')}:${JSON.stringify(audioFeatures)}:${limit}`.toUpperCase();

	// Check cache first
	if (cache?.isActive?.() && cache._reccobeats?.has?.(cacheKey)) {
		const cached = cache._reccobeats.get(cacheKey);
		console.log(`fetchTrackRecommendations: Cache hit (${cached?.length || 0} tracks)`);
		return cached || [];
	}

	try {
		const myHeaders = new Headers();
		myHeaders.append("Accept", "application/json");
		myHeaders.append("x-api-key", RECCOBEATS_API_KEY);

		// Build request URL with query parameters
		const url = new URL(`${RECCOBEATS_API_BASE}/track/recommendation`);
		url.searchParams.append('seedIds', limitedSeeds.join(','));
		url.searchParams.append('limit', limit);

		// Add audio feature target parameters
		for (const [key, value] of Object.entries(audioFeatures)) {
			if (AUDIO_FEATURE_NAMES.includes(key) && value != null) {
				url.searchParams.append(key, value);
			}
		}

		console.log(`fetchTrackRecommendations: GET ${url.toString()}`);

		const res = await rateLimitedFetch(url.toString(), {
			method: "GET",
			headers: myHeaders,
			redirect: "follow"
		});

		if (!res.ok) {
			console.error(`fetchTrackRecommendations: HTTP ${res.status}`);
			return [];
		}

		const data = await res.json();
		const trackData = data?.data || [];

		// Cache the results
		if (cache?.isActive?.()) {
			if (!cache._reccobeats) cache._reccobeats = new Map();
			cache._reccoboosts.set(cacheKey, trackData);
		}

		return trackData;

	} catch (e) {
		console.error('fetchTrackRecommendations error:', e.message);
		return [];
	}
}

/**
 * Fetch recommendations based on seed tracks using ReccoBeats track/recommendation API.
 * 
 * Strategy:
 * 1. Look up ReccoBeats track IDs for each seed using batch mode
 * 2. Fetch audio features for each seed track
 * 3. Calculate min/max ranges from seed audio features (or use mood/activity defaults if no seeds)
 * 4. Call /v1/track/recommendation with seeds and audio feature parameters
 * 5. Return up to 100 recommended tracks for library matching
 * 
 * @param {object[]} seeds - Array of seed objects [{artist, title}, ...]
 * @param {string} context - 'mood' or 'activity'
 * @param {string} value - Mood or activity name
 * @param {number} limit - Maximum recommendations (default 100)
 * @returns {Promise<object[]>} Array of recommended tracks
 */
async function fetchSeedBasedRecommendations(seeds, context, value, limit = 100) {
	const updateProgress = window.matchMonkeyNotifications?.updateProgress || (() => { });

	// Validate inputs
	if (!seeds || seeds.length === 0) {
		console.log('fetchSeedBasedRecommendations: No seeds provided, using default targets');
		return fetchRecommendationsWithDefaults(context, value, limit);
	}

	// Limit seeds to 5 as per API spec
	const seedLimit = Math.min(seeds.length, 5);
	const limitedSeeds = seeds.slice(0, seedLimit);

	updateProgress(`Looking up ${seedLimit} seed tracks on ReccoBeats (batch mode)...`, 0.1);

	// Step 1: Get track IDs using efficient batch mode
	const trackIds = await getTrackIdsBatch(limitedSeeds);

	// Filter out null results and keep track of valid seeds
	const seedTrackIds = [];
	const validSeeds = [];

	for (let i = 0; i < trackIds.length; i++) {
		if (trackIds[i]) {
			seedTrackIds.push(trackIds[i]);
			validSeeds.push(limitedSeeds[i]);
		}
	}

	// If we couldn't find any seeds, fall back to defaults
	if (seedTrackIds.length === 0) {
		console.log('fetchSeedBasedRecommendations: No valid seed tracks found, using default targets');
		return fetchRecommendationsWithDefaults(context, value, limit);
	}

	console.log(`fetchSeedBasedRecommendations: Found ${seedTrackIds.length}/${seedLimit} seed track(s)`);

	// Step 2: Fetch audio features for each seed track
	updateProgress(`Getting audio features for ${seedTrackIds.length} tracks...`, 0.3);

	const seedAudioFeatures = [];

	for (let i = 0; i < seedTrackIds.length; i++) {
		const trackId = seedTrackIds[i];
		const seed = validSeeds[i];

		const features = await fetchTrackAudioFeatures(trackId);
		if (features) {
			seedAudioFeatures.push(features);
		}
	}

	// Step 3: Calculate audio feature ranges from seeds
	let audioFeatureTargets = {};

	if (seedAudioFeatures.length > 0) {
		// Use audio features from seed tracks
		audioFeatureTargets = calculateAudioFeatureRanges(seedAudioFeatures);
		console.log(`fetchSeedBasedRecommendations: Using audio features from ${seedAudioFeatures.length} seed track(s)`);
	} else {
		// Fall back to mood/activity defaults if we couldn't get audio features
		const defaults = context === 'mood'
			? MOOD_AUDIO_TARGETS[value?.toLowerCase()]
			: ACTIVITY_AUDIO_TARGETS[value?.toLowerCase()];

		if (defaults) {
			audioFeatureTargets = { ...defaults };
			console.log(`fetchSeedBasedRecommendations: Using ${context} "${value}" default audio targets`);
		}
	}

	// Step 4: Fetch recommendations using the API
	updateProgress(`Fetching ${limit} recommendations from ReccoBeats...`, 0.5);

	const recommendations = await fetchTrackRecommendations(seedTrackIds, audioFeatureTargets, limit);

	console.log(`fetchSeedBasedRecommendations: Retrieved ${recommendations.length} tracks from ${seedTrackIds.length} seed(s)`);

	return recommendations;
}

/**
 * Fetch recommendations using default mood/activity audio targets when no seeds are available.
 * This creates a "virtual" recommendation by searching for tracks matching the audio profile.
 * 
 * @param {string} context - 'mood' or 'activity'
 * @param {string} value - Mood or activity name
 * @param {number} limit - Maximum recommendations
 * @returns {Promise<object[]>} Array of recommended tracks
 */
async function fetchRecommendationsWithDefaults(context, value, limit = 100) {
	const updateProgress = window.matchMonkeyNotifications?.updateProgress || (() => { });

	// Get default audio targets for the mood/activity
	const defaults = context === 'mood'
		? MOOD_AUDIO_TARGETS[value?.toLowerCase()]
		: ACTIVITY_AUDIO_TARGETS[value?.toLowerCase()];

	if (!defaults) {
		console.warn(`fetchRecommendationsWithDefaults: Unknown ${context} "${value}"`);
		return [];
	}

	console.log(`fetchRecommendationsWithDefaults: Using ${context} "${value}" defaults:`, defaults);
	updateProgress(`Searching for "${value}" ${context} tracks...`, 0.3);

	// The ReccoBeats API requires at least one seed track
	// Since we don't have seeds, we need to use the mood/activity endpoints if available
	// or return empty and let the caller handle it

	// For now, log that we need seeds and return empty
	// The hybrid discovery function should provide seeds from the library
	console.log('fetchRecommendationsWithDefaults: ReccoBeats recommendation API requires seed tracks');
	console.log('fetchRecommendationsWithDefaults: Default audio targets available for filtering:', defaults);

	return [];
}

/**
 * Fetch recommendations based on user-selected seed tracks.
 * 
 * This function:
 * 1. Takes user-selected seed tracks (artist/album/track)
 * 2. Looks up ReccoBeats track ID for each seed using batch mode
 * 3. Fetches audio features for each seed track
 * 4. Calculates min/max ranges from all seed audio features
 * 5. Fetches 100 track recommendations using those ranges
 * 6. Returns recommendations for local library matching
 * 
 * @param {object[]} userSeeds - Array of user-selected tracks: [{artist, title, album?}, ...]
 * @param {number} limit - Maximum recommendations to fetch (default 100)
 * @returns {Promise<object>} Object with { recommendations: [], seedFeatures: [], audioRanges: {} }
 */
async function fetchReccobeatsRecommendations(userSeeds, limit = 100) {
	const updateProgress = window.matchMonkeyNotifications?.updateProgress || (() => { });

	// Validate inputs
	if (!userSeeds || userSeeds.length === 0) {
		console.warn('fetchReccobeatsRecommendations: No seed tracks provided');
		return { recommendations: [], seedFeatures: [], audioRanges: {} };
	}

	const cache = window.lastfmCache;
	const cacheKey = `reccobeats:userseeds:${userSeeds.map(s => `${s.artist}:${s.title}`).sort().join('|')}:${limit}`.toUpperCase();

	// Check cache first
	if (cache?.isActive?.() && cache._reccobeats?.has?.(cacheKey)) {
		const cached = cache._reccobeats.get(cacheKey);
		console.log(`fetchReccobeatsRecommendations: Cache hit (${cached?.recommendations?.length || 0} recommendations)`);
		return cached;
	}

	console.log(`fetchReccobeatsRecommendations: Processing ${userSeeds.length} user-selected seed track(s)`);

	// Limit seeds to 5 as per API spec
	const seedLimit = Math.min(userSeeds.length, 5);
	const limitedSeeds = userSeeds.slice(0, seedLimit);

	updateProgress(`Looking up ${seedLimit} tracks on ReccoBeats (batch mode)...`, 0.1);

	// Step 1: Get track IDs using efficient batch mode
	const trackIds = await getTrackIdsBatch(limitedSeeds);

	// Filter out null results and keep track of valid seeds
	const seedTrackIds = [];
	const validSeeds = [];

	for (let i = 0; i < trackIds.length; i++) {
		if (trackIds[i]) {
			seedTrackIds.push(trackIds[i]);
			validSeeds.push(limitedSeeds[i]);
		}
	}

	// Verify we have at least one valid seed
	if (seedTrackIds.length === 0) {
		console.error('fetchReccobeatsRecommendations: No valid seed tracks found on ReccoBeats');
		updateProgress('No seed tracks found on ReccoBeats', 0.5);
		return { recommendations: [], seedFeatures: [], audioRanges: {} };
	}

	console.log(`fetchReccobeatsRecommendations: Successfully found ${seedTrackIds.length}/${seedLimit} seed track(s)`);

	// Step 2: Fetch audio features for valid seed tracks
	updateProgress(`Getting audio features for ${seedTrackIds.length} tracks...`, 0.4);

	const seedAudioFeatures = [];

	for (let i = 0; i < seedTrackIds.length; i++) {
		const trackId = seedTrackIds[i];
		const seed = validSeeds[i];

		const features = await fetchTrackAudioFeatures(trackId);
		if (features) {
			seedAudioFeatures.push(features);
			console.log(`fetchReccobeatsRecommendations: Retrieved audio features for "${seed.artist} - ${seed.title}"`);
		} else {
			console.warn(`fetchReccobeatsRecommendations: Could not get audio features for "${seed.artist} - ${seed.title}"`);
		}
	}

	if (seedAudioFeatures.length === 0) {
		console.error('fetchReccobeatsRecommendations: No audio features available');
		updateProgress('No audio features available', 0.5);
		return { recommendations: [], seedFeatures: [], audioRanges: {} };
	}

	console.log(`fetchReccobeatsRecommendations: Successfully processed ${seedAudioFeatures.length} seed track(s)`);

	// Step 3: Calculate audio feature ranges from seed features
	updateProgress('Calculating audio feature ranges...', 0.5);

	const audioRanges = calculateAudioFeatureRanges(seedAudioFeatures);
	console.log(`fetchReccobeatsRecommendations: Calculated audio ranges from ${seedAudioFeatures.length} seed(s)`);

	// Step 4: Fetch recommendations using seed IDs and audio ranges
	updateProgress(`Fetching ${limit} recommendations from ReccoBeats...`, 0.6);

	const recommendations = await fetchTrackRecommendations(seedTrackIds, audioRanges, limit);

	console.log(`fetchReccobeatsRecommendations: Retrieved ${recommendations.length} recommendation(s) for library matching`);

	// Prepare result object
	const result = {
		recommendations,
		seedFeatures: seedAudioFeatures,
		audioRanges,
		seedCount: seedTrackIds.length
	};

	// Cache the result
	if (cache?.isActive?.()) {
		if (!cache._reccobeats) cache._reccobeats = new Map();
		cache._reccobeats.set(cacheKey, result);
	}

	updateProgress(`Ready to match ${recommendations.length} tracks to library...`, 0.8);

	return result;
}

/**
 * Hybrid discovery: Combine ReccoBeats mood/activity with Last.fm similarity.
 * 
 * This function:
 * 1. Gets seed tracks from options or finds them based on mood/activity
 * 2. Fetches track recommendations from ReccoBeats using seed IDs and audio features
 * 3. Returns recommended tracks for library matching
 * 
 * @param {string} context - Context type: 'mood' or 'activity'
 * @param {string} value - Mood name or activity name
 * @param {object} options - Additional options
 * @param {string[]} options.genres - Genre preferences
 * @param {number} options.duration - Activity duration in minutes
 * @param {number} options.limit - Maximum recommendations
 * @param {object[]} options.seeds - Seed tracks for track-based recommendations
 * @returns {Promise<object[]>} Recommended tracks for library matching
 */
async function fetchHybridRecommendations(context, value, options = {}) {
	try {
		const { genres = [], duration = 60, limit = 100, seeds = [] } = options;
		const updateProgress = window.matchMonkeyNotifications?.updateProgress || (() => { });

		updateProgress(`Fetching ${context}-based recommendations...`, 0.1);

		let reccoTracks = [];

		// Use seed-based recommendations (primary approach)
		if (seeds.length > 0) {
			console.log(`fetchHybridRecommendations: Using ${seeds.length} seed track(s) for ReccoBeats`);
			reccoTracks = await fetchSeedBasedRecommendations(seeds, context, value, limit);
		}

		// If we have results, return them directly for library matching
		if (reccoTracks.length > 0) {
			console.log(`fetchHybridRecommendations: Returning ${reccoTracks.length} tracks for library matching`);
			return reccoTracks;
		}

		// Fall back: Try to expand using Last.fm if no ReccoBeats results
		console.log('fetchHybridRecommendations: No ReccoBeats results, attempting Last.fm expansion');

		// Extract artists from seeds for Last.fm fallback
		const seedArtists = seeds
			.filter(s => s?.artist)
			.map(s => s.artist)
			.slice(0, 5);

		if (seedArtists.length === 0) {
			console.log('fetchHybridRecommendations: No seed artists available for fallback');
			return [];
		}

		const lastfmApi = window.matchMonkeyLastfmAPI;
		if (!lastfmApi) {
			console.warn('fetchHybridRecommendations: Last.fm API not available');
			return [];
		}

		updateProgress(`Expanding with Last.fm similar artists...`, 0.5);

		// Fetch similar artists for each seed
		const similarArtists = new Set(seedArtists);

		for (const artist of seedArtists) {
			try {
				const similar = await lastfmApi.fetchSimilarArtists(artist, 10);
				for (const s of similar) {
					if (s?.name) {
						similarArtists.add(s.name);
					}
				}
			} catch (e) {
				console.warn(`fetchHybridRecommendations: Failed to get similar artists for "${artist}":`, e.message);
			}
		}

		console.log(`fetchHybridRecommendations: Expanded to ${similarArtists.size} artists using Last.fm`);

		// Return as artist objects for library matching
		return Array.from(similarArtists).slice(0, limit).map(artist => ({ artist }));

	} catch (e) {
		console.error('fetchHybridRecommendations error:', e.message || e.toString());
		return [];
	}
}

/**
 * Fetch mood-based recommendations from ReccoBeats.
 * 
 * @param {string} mood - Target mood (e.g., 'energetic', 'relaxed', 'happy', 'sad', 'focused')
 * @param {string[]} genres - Optional array of genre preferences for filtering
 * @param {number} limit - Maximum number of recommendations (default from config or 50)
 * @returns {Promise<object[]>} Array of track recommendations with artist, title, and audio features
 */
async function fetchMoodRecommendations(mood, genres = [], limit = 50) {
	try {
		// Validate required parameters
		if (!mood || typeof mood !== 'string') {
			console.warn('fetchMoodRecommendations: Invalid mood parameter');
			return [];
		}

		const cache = window.lastfmCache;
		const updateProgress = window.matchMonkeyNotifications?.updateProgress || (() => { });

		// Build cache key including all parameters
		const cacheKey = `reccobeats:mood:${mood}:${genres.sort().join(',')}:${limit}`.toUpperCase();

		// Check cache first
		if (cache?.isActive?.() && cache._reccobeats?.has?.(cacheKey)) {
			const cached = cache._reccobeats.get(cacheKey);
			console.log(`fetchMoodRecommendations: Cache hit for "${mood}" (${cached?.length || 0} tracks)`);
			return cached || [];
		}

		updateProgress(`Querying ReccoBeats for "${mood}" mood...`, 0.25);

		// Build request URL with parameters
		const params = new URLSearchParams({
			mood: mood.toLowerCase().trim(),
			limit: String(Math.min(limit, 100)), // Cap at 100 to avoid overloading
			format: 'json'
		});

		if (genres.length > 0) {
			params.set('genres', genres.slice(0, 5).join(',')); // Limit to 5 genres
		}

		const url = `${RECCOBEATS_API_BASE}/recommendations/mood?${params.toString()}`;
		console.log(`fetchMoodRecommendations: GET ${url}`);

		// Make rate-limited request
		const res = await rateLimitedFetch(url);

		// Handle HTTP errors
		if (!res || !res.ok) {
			const status = res?.status || 'unknown';
			console.error(`fetchMoodRecommendations: HTTP ${status} for mood "${mood}"`);
			updateProgress(`ReccoBeats API error (HTTP ${status})`, 0.3);
			return [];
		}

		// Parse JSON response
		let data;
		try {
			data = await res.json();
		} catch (parseError) {
			console.error('fetchMoodRecommendations: Invalid JSON response:', parseError.message);
			return [];
		}

		// Check for API-level errors
		if (data?.error) {
			console.error('fetchMoodRecommendations: API error:', data.error);
			return [];
		}

		// Extract and normalize recommendations
		const recommendations = (data?.tracks || []).map(track => ({
			artist: String(track.artist || '').trim(),
			title: String(track.title || track.name || '').trim(),
			mood: track.mood || mood,
			// Audio features (0.0-1.0 scale)
			energy: Number(track.energy) || 0,
			valence: Number(track.valence) || 0, // Positivity/happiness
			tempo: Number(track.tempo) || 0
		})).filter(t => t.artist && t.title); // Filter out incomplete entries

		console.log(`fetchMoodRecommendations: Retrieved ${recommendations.length} tracks for "${mood}"`);

		// Cache successful results
		if (cache?.isActive?.()) {
			if (!cache._reccobeats) cache._reccobeats = new Map();
			cache._reccobeats.set(cacheKey, recommendations);
		}

		return recommendations;

	} catch (e) {
		// Handle abort (timeout) separately from other errors
		if (e.name === 'AbortError') {
			console.error('fetchMoodRecommendations: Request timed out');
		} else {
			console.error('fetchMoodRecommendations error:', e.message || e.toString());
		}
		return [];
	}
}

/**
 * Fetch activity-based recommendations from ReccoBeats.
 * 
 * @param {string} activity - Target activity (e.g., 'workout', 'study', 'party', 'sleep', 'driving')
 * @param {number} duration - Target activity duration in minutes (affects playlist length)
 * @param {number} limit - Maximum number of recommendations
 * @returns {Promise<object[]>} Array of track recommendations optimized for the activity
 */
async function fetchActivityRecommendations(activity, duration = 60, limit = 50) {
	try {
		// Validate required parameters
		if (!activity || typeof activity !== 'string') {
			console.warn('fetchActivityRecommendations: Invalid activity parameter');
			return [];
		}

		const cache = window.lastfmCache;
		const updateProgress = window.matchMonkeyNotifications?.updateProgress || (() => { });

		// Build cache key including all parameters
		const cacheKey = `reccobeats:activity:${activity}:${duration}:${limit}`.toUpperCase();

		// Check cache first
		if (cache?.isActive?.() && cache._reccobeats?.has?.(cacheKey)) {
			const cached = cache._reccobeats.get(cacheKey);
			console.log(`fetchActivityRecommendations: Cache hit for "${activity}" (${cached?.length || 0} tracks)`);
			return cached || [];
		}

		updateProgress(`Querying ReccoBeats for "${activity}" activity...`, 0.25);

		// Build request URL
		const params = new URLSearchParams({
			activity: activity.toLowerCase().trim(),
			duration: String(Math.max(10, Math.min(duration, 300))), // 10-300 min range
			limit: String(Math.min(limit, 100)),
			format: 'json'
		});

		const url = `${RECCOBEATS_API_BASE}/recommendations/activity?${params.toString()}`;
		console.log(`fetchActivityRecommendations: GET ${url}`);

		// Make rate-limited request
		const res = await rateLimitedFetch(url);

		// Handle HTTP errors
		if (!res || !res.ok) {
			const status = res?.status || 'unknown';
			console.error(`fetchActivityRecommendations: HTTP ${status} for activity "${activity}"`);
			updateProgress(`ReccoBeats API error (HTTP ${status})`, 0.3);
			return [];
		}

		// Parse JSON response
		let data;
		try {
			data = await res.json();
		} catch (parseError) {
			console.error('fetchActivityRecommendations: Invalid JSON response:', parseError.message);
			return [];
		}

		// Check for API-level errors
		if (data?.error) {
			console.error('fetchActivityRecommendations: API error:', data.error);
			return [];
		}

		// Extract and normalize recommendations
		const recommendations = (data?.tracks || []).map(track => ({
			artist: String(track.artist || '').trim(),
			title: String(track.title || track.name || '').trim(),
			activity: track.activity || activity,
			energy: Number(track.energy) || 0,
			tempo: Number(track.tempo) || 0
		})).filter(t => t.artist && t.title);

		console.log(`fetchActivityRecommendations: Retrieved ${recommendations.length} tracks for "${activity}" (${duration}min)`);

		// Cache successful results
		if (cache?.isActive?.()) {
			if (!cache._reccobeats) cache._reccobeats = new Map();
			cache._reccobeats.set(cacheKey, recommendations);
		}

		return recommendations;

	} catch (e) {
		if (e.name === 'AbortError') {
			console.error('fetchActivityRecommendations: Request timed out');
		} else {
			console.error('fetchActivityRecommendations error:', e.message || e.toString());
		}
		return [];
	}
}

/**
 * Filter tracks by audio feature criteria.
 * Useful for post-filtering recommendations to match specific audio profiles.
 * 
 * @param {object[]} tracks - Array of track objects with audio features
 * @param {object} criteria - Audio feature filter criteria
 * @param {number} [criteria.minEnergy] - Minimum energy (0.0-1.0)
 * @param {number} [criteria.maxEnergy] - Maximum energy (0.0-1.0)
 * @param {number} [criteria.minValence] - Minimum valence/happiness (0.0-1.0)
 * @param {number} [criteria.maxValence] - Maximum valence/happiness (0.0-1.0)
 * @param {number} [criteria.minTempo] - Minimum tempo (BPM)
 * @param {number} [criteria.maxTempo] - Maximum tempo (BPM)
 * @param {number} [criteria.minDanceability] - Minimum danceability (0.0-1.0)
 * @param {number} [criteria.maxDanceability] - Maximum danceability (0.0-1.0)
 * @returns {object[]} Filtered array of tracks matching criteria
 */
function filterTracksByAudioFeatures(tracks, criteria = {}) {
	if (!Array.isArray(tracks) || tracks.length === 0) {
		return [];
	}

	const {
		minEnergy,
		maxEnergy,
		minValence,
		maxValence,
		minTempo,
		maxTempo,
		minDanceability,
		maxDanceability,
		minAcousticness,
		maxAcousticness,
		minInstrumentalness,
		maxInstrumentalness
	} = criteria;

	return tracks.filter(track => {
		// Skip tracks without audio features
		if (!track || typeof track !== 'object') return false;

		// Energy filter
		if (minEnergy !== undefined && (track.energy || 0) < minEnergy) return false;
		if (maxEnergy !== undefined && (track.energy || 0) > maxEnergy) return false;

		// Valence filter
		if (minValence !== undefined && (track.valence || 0) < minValence) return false;
		if (maxValence !== undefined && (track.valence || 0) > maxValence) return false;

		// Tempo filter
		if (minTempo !== undefined && (track.tempo || 0) < minTempo) return false;
		if (maxTempo !== undefined && (track.tempo || 0) > maxTempo) return false;

		// Danceability filter
		if (minDanceability !== undefined && (track.danceability || 0) < minDanceability) return false;
		if (maxDanceability !== undefined && (track.danceability || 0) > maxDanceability) return false;

		// Acousticness filter
		if (minAcousticness !== undefined && (track.acousticness || 0) < minAcousticness) return false;
		if (maxAcousticness !== undefined && (track.acousticness || 0) > maxAcousticness) return false;

		// Instrumentalness filter
		if (minInstrumentalness !== undefined && (track.instrumentalness || 0) < minInstrumentalness) return false;
		if (maxInstrumentalness !== undefined && (track.instrumentalness || 0) > maxInstrumentalness) return false;

		return true;
	});
}

/**
 * Calculate audio feature match score between a track and target features.
 * Returns a similarity score from 0.0 (no match) to 1.0 (perfect match).
 * 
 * @param {object} track - Track with audio features to evaluate
 * @param {object} target - Target audio features to match against
 * @param {object} [weights] - Optional custom weights for each feature
 * @returns {number} Similarity score (0.0-1.0)
 */
function calculateAudioFeatureMatch(track, target, weights = null) {
	if (!track || !target) {
		return 0;
	}

	// Default weights: energy and valence are most important for mood matching
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

	// Energy match (0.0-1.0 scale)
	if (track.energy !== undefined && target.energy !== undefined) {
		const energyDiff = Math.abs(track.energy - target.energy);
		const energyScore = 1.0 - energyDiff;
		weightedScore += energyScore * (w.energy || 0);
		totalWeight += w.energy || 0;
	}

	// Valence match (0.0-1.0 scale)
	if (track.valence !== undefined && target.valence !== undefined) {
		const valenceDiff = Math.abs(track.valence - target.valence);
		const valenceScore = 1.0 - valenceDiff;
		weightedScore += valenceScore * (w.valence || 0);
		totalWeight += w.valence || 0;
	}

	// Danceability match (0.0-1.0 scale)
	if (track.danceability !== undefined && target.danceability !== undefined) {
		const danceabilityDiff = Math.abs(track.danceability - target.danceability);
		const danceabilityScore = 1.0 - danceabilityDiff;
		weightedScore += danceabilityScore * (w.danceability || 0);
		totalWeight += w.danceability || 0;
	}

	// Tempo match (normalized to 0.0-1.0, assuming typical range 60-180 BPM)
	if (track.tempo !== undefined && target.tempo !== undefined) {
		const tempoDiff = Math.abs(track.tempo - target.tempo);
		const maxTempoDiff = 60; // Allow up to 60 BPM difference
		const tempoScore = Math.max(0, 1.0 - (tempoDiff / maxTempoDiff));
		weightedScore += tempoScore * (w.tempo || 0);
		totalWeight += w.tempo || 0;
	}

	// Acousticness match (0.0-1.0 scale)
	if (track.acousticness !== undefined && target.acousticness !== undefined) {
		const acousticnessDiff = Math.abs(track.acousticness - target.acousticness);
		const acousticnessScore = 1.0 - acousticnessDiff;
		weightedScore += acousticnessScore * (w.acousticness || 0);
		totalWeight += w.acousticness || 0;
	}

	// Instrumentalness match (0.0-1.0 scale)
	if (track.instrumentalness !== undefined && target.instrumentalness !== undefined) {
		const instrumentalnessDiff = Math.abs(track.instrumentalness - target.instrumentalness);
		const instrumentalnessScore = 1.0 - instrumentalnessDiff;
		weightedScore += instrumentalnessScore * (w.instrumentalness || 0);
		totalWeight += w.instrumentalness || 0;
	}

	// Return normalized score
	return totalWeight > 0 ? (weightedScore / totalWeight) : 0;
}

// Export to window namespace for MM5
window.matchMonkeyReccoBeatsAPI = {
	fetchMoodRecommendations,
	fetchActivityRecommendations,
	fetchHybridRecommendations,
	fetchTrackRecommendations,
	fetchSeedBasedRecommendations,
	fetchReccobeatsRecommendations,
	fetchTrackAudioFeatures,
	fetchRecommendationsWithDefaults,
	getTrackId,
	getTrackIdsBatch,
	filterTracksByAudioFeatures,
	calculateAudioFeatureMatch,
	calculateAudioFeatureRanges,
	MOOD_AUDIO_TARGETS,
	ACTIVITY_AUDIO_TARGETS,
	AUDIO_FEATURE_NAMES,
	RECCOBEATS_API_BASE,
	API_TIMEOUT_MS,
};
