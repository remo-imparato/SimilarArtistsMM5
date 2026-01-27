/**
 * Discovery Strategies Module
 * 
 * Implements different discovery algorithms for finding similar music:
 * - Artist-based: Use Last.fm artist.getSimilar API
 * - Track-based: Use Last.fm track.getSimilar API  
 * - Genre-based: Use Last.fm tag.getTopArtists API
 * - Mood/Activity: Use ReccoBeats AI + Last.fm hybrid
 * 
 * Each strategy returns a list of artist/track candidates to search in the local library.
 * All strategies respect user-configured limits and preferences.
 * 
 * MediaMonkey 5 API Only
 * 
 * @author Remo Imparato
 * @license MIT
 */

'use strict';

/**
 * Discovery mode constants
 */
const DISCOVERY_MODES = {
	ARTIST: 'artist',
	TRACK: 'track',
	GENRE: 'genre',
	MOOD: 'mood',
	ACTIVITY: 'activity'
};

// ============================================================================
// ARTIST-BASED DISCOVERY
// ============================================================================

/**
 * Artist-based discovery strategy.
 * 
 * Uses Last.fm artist.getSimilar to find similar artists, then gets their top tracks.
 * For tracks with multiple artists (separated by ';'), makes separate API calls for each.
 * This is the original/classic approach - best for discovering new artists in same genre.
 * 
 * @param {object} modules - Module dependencies
 * @param {Array} seeds - Seed objects [{artist, title, genre}, ...]
 * @param {object} config - Configuration settings from user preferences
 * @returns {Promise<Array>} Array of {artist, tracks[]} candidates
 */
async function discoverByArtist(modules, seeds, config) {
	const { api: { lastfmApi }, settings: { prefixes }, ui: { notifications } } = modules;
	const { fetchSimilarArtists, fetchTopTracks } = lastfmApi;
	const { fixPrefixes } = prefixes;
	const { updateProgress } = notifications;

	const candidates = [];
	const seenArtists = new Set();
	const blacklist = buildBlacklist(modules);

	// Extract unique artists from seeds (respecting seedLimit)
	const uniqueArtists = extractSeedArtists(seeds, config.seedLimit || 20);
	const artistCount = uniqueArtists.length;

	console.log(`discoverByArtist: Processing ${artistCount} seed artist(s), max ${config.similarLimit} similar each`);

	for (let i = 0; i < artistCount; i++) {
		const artistName = uniqueArtists[i];
		const progress = 0.1 + ((i + 1) / artistCount) * 0.3;
		updateProgress(`Finding artists similar to "${artistName}" (${i + 1}/${artistCount})...`, progress);

		try {
			const fixedName = fixPrefixes(artistName);
			const similar = await fetchSimilarArtists(fixedName, config.similarLimit || 20);

			if (!similar || similar.length === 0) {
				console.log(`discoverByArtist: No similar artists for "${artistName}"`);
				continue;
			}

			// Include seed artist if configured
			if (config.includeSeedArtist) {
				addArtistCandidate(artistName, seenArtists, blacklist, candidates);
			}

			// Add similar artists
			for (const artist of similar.slice(0, config.similarLimit || 20)) {
				if (artist?.name) {
					addArtistCandidate(artist.name, seenArtists, blacklist, candidates);
				}
			}

		} catch (e) {
			console.error(`discoverByArtist: Error for "${artistName}": ${e.message}`);
		}
	}

	console.log(`discoverByArtist: Found ${candidates.length} candidate artists`);

	// Fetch top tracks for all candidates
	if (candidates.length > 0) {
		updateProgress(`Fetching top tracks for ${candidates.length} artists...`, 0.4);
		await fetchTracksForCandidates(modules, candidates, config);
	}

	return candidates;
}

// ============================================================================
// TRACK-BASED DISCOVERY
// ============================================================================

/**
 * Track-based discovery strategy.
 * 
 * Uses Last.fm track.getSimilar to find musically similar tracks across different artists.
 * This can discover music from artists you might not have found via artist.getSimilar.
 * Best for finding different versions, covers, and musically similar tracks.
 * 
 * @param {object} modules - Module dependencies
 * @param {Array} seeds - Seed objects [{artist, title, genre}, ...]
 * @param {object} config - Configuration settings
 * @returns {Promise<Array>} Array of {artist, tracks[]} candidates
 */
async function discoverByTrack(modules, seeds, config) {
	const { api: { lastfmApi }, settings: { prefixes }, ui: { notifications } } = modules;
	const { fetchSimilarTracks } = lastfmApi;
	const { fixPrefixes } = prefixes;
	const { updateProgress } = notifications;

	const candidates = [];
	const seenArtists = new Set();
	const tracksByArtist = new Map(); // artist -> {artistName, tracks[]}
	const blacklist = buildBlacklist(modules);

	// Limit seeds for track-based discovery (more API-intensive)
	const seedLimit = Math.min(seeds.length, config.seedLimit || 5);
	const trackSimilarLimit = config.trackSimilarLimit || 100;

	// If includeSeedArtist is enabled, add seed tracks first
	if (config.includeSeedArtist) {
		addSeedTracksToResults(seeds, seedLimit, blacklist, seenArtists, tracksByArtist);
	}

	console.log(`discoverByTrack: Processing ${seedLimit} seed tracks, max ${trackSimilarLimit} similar each`);

	for (let i = 0; i < seedLimit; i++) {
		const seed = seeds[i];
		if (!seed?.artist || !seed?.title) continue;

		const progress = 0.1 + ((i + 1) / seedLimit) * 0.4;
		updateProgress(`Finding tracks similar to "${seed.title}" (${i + 1}/${seedLimit})...`, progress);

		// Split artists by ';' and query each separately
		const artists = seed.artist.split(';').map(a => a.trim()).filter(Boolean);

		for (const artistName of artists) {
			const fixedArtistName = fixPrefixes(artistName);

			try {
				const similarTracks = await fetchSimilarTracks(fixedArtistName, seed.title, trackSimilarLimit);

				if (!similarTracks || similarTracks.length === 0) {
					console.log(`discoverByTrack: No similar tracks for "${fixedArtistName} - ${seed.title}"`);
					continue;
				}

				console.log(`discoverByTrack: Found ${similarTracks.length} similar to "${fixedArtistName} - ${seed.title}"`);

				// Group by artist
				for (const simTrack of similarTracks) {
					if (!simTrack?.artist || !simTrack?.title) continue;

					const artKey = simTrack.artist.toUpperCase();
					if (blacklist.has(artKey)) continue;

					if (!tracksByArtist.has(artKey)) {
						tracksByArtist.set(artKey, {
							artistName: simTrack.artist,
							tracks: []
						});
					}

					const entry = tracksByArtist.get(artKey);
					const trackKey = simTrack.title.toUpperCase();
					
					// Avoid duplicate tracks
					if (!entry.tracks.some(t => t.title.toUpperCase() === trackKey)) {
						entry.tracks.push({
							title: simTrack.title,
							match: simTrack.match || 0,
							playcount: simTrack.playcount || 0
						});
					}
				}

			} catch (e) {
				console.error(`discoverByTrack: Error for "${fixedArtistName} - ${seed.title}": ${e.message}`);
			}
		}
	}

	// Convert to candidate format, sorted by match score
	for (const [artKey, data] of tracksByArtist) {
		if (seenArtists.has(artKey)) continue;
		seenArtists.add(artKey);

		// Sort tracks by match score (highest first)
		data.tracks.sort((a, b) => (b.match || 0) - (a.match || 0));

		candidates.push({
			artist: data.artistName,
			tracks: data.tracks.slice(0, config.tracksPerArtist || 10)
		});
	}

	console.log(`discoverByTrack: Found ${candidates.length} candidate artists from track similarity`);

	return candidates;
}

// ============================================================================
// GENRE-BASED DISCOVERY
// ============================================================================

/**
 * Genre-based discovery strategy.
 * 
 * Uses Last.fm artist.getInfo to get genres/tags, then tag.getTopArtists to find
 * popular artists in those genres. Best for exploring a genre more broadly.
 * 
 * @param {object} modules - Module dependencies
 * @param {Array} seeds - Seed objects [{artist, title, genre}, ...]
 * @param {object} config - Configuration settings
 * @returns {Promise<Array>} Array of {artist, tracks[]} candidates
 */
async function discoverByGenre(modules, seeds, config) {
	const { api: { lastfmApi }, settings: { prefixes }, ui: { notifications } } = modules;
	const { fetchArtistInfo, fetchArtistsByTag } = lastfmApi;
	const { fixPrefixes } = prefixes;
	const { updateProgress } = notifications;

	const candidates = [];
	const seenArtists = new Set();
	const collectedTags = new Map(); // tag -> count (to prioritize common tags)
	const blacklist = buildBlacklist(modules);

	// Apply limits
	const maxCandidates = config.similarLimit || 20;
	const maxTagsToSearch = Math.min(5, Math.ceil(maxCandidates / 5));
	const artistsPerTag = Math.ceil(maxCandidates / maxTagsToSearch);

	console.log(`discoverByGenre: Target ${maxCandidates} candidates from up to ${maxTagsToSearch} tags`);

	// Step 1: Collect genres from seed tracks
	updateProgress('Analyzing seed genres...', 0.1);

	const seedLimit = Math.min(seeds.length, config.seedLimit || 5);

	// Include seed artists if configured
	if (config.includeSeedArtist) {
		const seedArtists = extractSeedArtists(seeds, seedLimit);
		for (const artistName of seedArtists) {
			addArtistCandidate(artistName, seenArtists, blacklist, candidates);
		}
	}

	// First, collect genres directly from seed tracks (highest priority)
	for (let i = 0; i < seedLimit; i++) {
		const seed = seeds[i];
		if (seed.genre) {
			const genres = seed.genre.split(';').map(g => g.trim()).filter(Boolean);
			for (const genre of genres) {
				const tagKey = genre.toLowerCase();
				collectedTags.set(tagKey, (collectedTags.get(tagKey) || 0) + 3); // Weight seed genres highest
			}
		}
	}

	// Fetch additional tags from artists via Last.fm if needed
	if (collectedTags.size < maxTagsToSearch) {
		const uniqueArtists = extractSeedArtists(seeds, 3); // Only query first 3
		
		for (const artistName of uniqueArtists) {
			try {
				updateProgress(`Getting genre tags for "${artistName}"...`, 0.15);
				const artistInfo = await fetchArtistInfo(fixPrefixes(artistName));

				if (artistInfo?.tags && artistInfo.tags.length > 0) {
					for (const tag of artistInfo.tags.slice(0, 3)) {
						const tagKey = tag.toLowerCase();
						collectedTags.set(tagKey, (collectedTags.get(tagKey) || 0) + 1);
					}
				}
			} catch (e) {
				console.warn(`discoverByGenre: Error getting tags for "${artistName}": ${e.message}`);
			}
		}
	}

	if (collectedTags.size === 0) {
		console.log('discoverByGenre: No tags found');
		return candidates;
	}

	// Sort tags by frequency
	const sortedTags = Array.from(collectedTags.entries())
		.sort((a, b) => b[1] - a[1])
		.map(([tag]) => tag);

	console.log(`discoverByGenre: Top tags: ${sortedTags.slice(0, maxTagsToSearch).join(', ')}`);

	// Step 2: Get top artists for each tag
	const numTags = Math.min(sortedTags.length, maxTagsToSearch);

	for (let i = 0; i < numTags; i++) {
		if (candidates.length >= maxCandidates) {
			console.log(`discoverByGenre: Reached limit of ${maxCandidates} candidates`);
			break;
		}

		const tag = sortedTags[i];
		const progress = 0.3 + ((i + 1) / numTags) * 0.3;
		updateProgress(`Searching "${tag}" genre (${i + 1}/${numTags})...`, progress);

		try {
			const remainingNeeded = maxCandidates - candidates.length;
			const fetchLimit = Math.min(artistsPerTag, remainingNeeded);

			const tagArtists = await fetchArtistsByTag(tag, fetchLimit);

			if (tagArtists && tagArtists.length > 0) {
				for (const artist of tagArtists) {
					if (candidates.length >= maxCandidates) break;
					if (artist?.name) {
						addArtistCandidate(artist.name, seenArtists, blacklist, candidates);
					}
				}
			}
		} catch (e) {
			console.warn(`discoverByGenre: Error for tag "${tag}": ${e.message}`);
		}
	}

	console.log(`discoverByGenre: Found ${candidates.length} candidate artists`);

	// Step 3: Fetch top tracks
	if (candidates.length > 0) {
		updateProgress('Fetching top tracks from genre artists...', 0.7);
		await fetchTracksForCandidates(modules, candidates, config);
	}

	return candidates;
}

// ============================================================================
// MOOD/ACTIVITY-BASED DISCOVERY (ReccoBeats + Last.fm Hybrid)
// ============================================================================

/**
 * Mood/Activity-based discovery strategy (ReccoBeats + Last.fm hybrid).
 * 
 * Uses ReccoBeats API to get mood/activity-appropriate tracks, then
 * combines with Last.fm similar artists for better library matching.
 * 
 * The blendRatio controls the mix:
 * - 0.0 = 100% mood-based (pure discovery)
 * - 0.5 = 50% seed artists + 50% mood artists (balanced, default)
 * - 1.0 = 100% seed-based with mood filtering
 * 
 * @param {object} modules - Module dependencies
 * @param {Array} seeds - Seed objects [{artist, title, genre}, ...]
 * @param {object} config - Configuration settings with mood/activity context
 * @returns {Promise<Array>} Array of {artist, tracks[]} candidates
 */
async function discoverByMoodActivity(modules, seeds, config) {
	const { api: { lastfmApi }, settings: { prefixes }, ui: { notifications } } = modules;
	const { fetchSimilarArtists } = lastfmApi;
	const { fixPrefixes } = prefixes;
	const { updateProgress } = notifications;
	const reccobeatsApi = window.matchMonkeyReccoBeatsAPI;
	
	if (!reccobeatsApi) {
		console.error('discoverByMoodActivity: ReccoBeats API not loaded');
		return [];
	}
	
	const candidates = [];
	const seenArtists = new Set();
	const blacklist = buildBlacklist(modules);
	
	// Extract context from config
	const context = config.moodActivityContext || 'mood';
	const value = config.moodActivityValue || 'energetic';
	const blendRatio = config.moodActivityBlendRatio;
	const targetLimit = config.similarLimit || 20;
	
	console.log(`discoverByMoodActivity: ${context}="${value}", blend=${Math.round(blendRatio * 100)}% seeds`);
	
	// Calculate how many artists to get from each source
	const seedCount = Math.ceil(targetLimit * blendRatio);
	const moodCount = targetLimit - seedCount;
	
	updateProgress(`Analyzing ${context}: ${value}...`, 0.1);

	// -------------------------------------------------------------------------
	// STEP 1: Get seed-based similar artists (from Last.fm)
	// -------------------------------------------------------------------------
	const seedSimilarArtists = [];
	
	if (blendRatio > 0 && seeds.length > 0) {
		const seedArtists = extractSeedArtists(seeds, config.seedLimit || 5);
		
		// Include original seed artists if configured
		if (config.includeSeedArtist) {
			seedSimilarArtists.push(...seedArtists);
		}
		
		// Expand with Last.fm similar artists
		for (let i = 0; i < seedArtists.length; i++) {
			const artistName = seedArtists[i];
			const progress = 0.1 + ((i + 1) / seedArtists.length) * 0.15;
			updateProgress(`Finding artists similar to "${artistName}"...`, progress);
			
			try {
				const fixedName = fixPrefixes(artistName);
				const similar = await fetchSimilarArtists(fixedName, 10);
				
				for (const s of similar) {
					if (s?.name) seedSimilarArtists.push(s.name);
				}
			} catch (e) {
				console.warn(`discoverByMoodActivity: Error for seed "${artistName}": ${e.message}`);
			}
		}
		
		console.log(`discoverByMoodActivity: ${seedSimilarArtists.length} artists from seeds`);
	}

	// -------------------------------------------------------------------------
	// STEP 2: Get mood/activity-based artists (from ReccoBeats)
	// -------------------------------------------------------------------------
	const moodArtists = [];
	
	if (blendRatio < 1) {
		updateProgress(`Fetching ${context} recommendations from ReccoBeats...`, 0.3);
		
		// Pass seeds to fetchHybridRecommendations for track-based recommendations
		const hybridResults = await reccobeatsApi.fetchHybridRecommendations(
			context,
			value,
			{
				genres: extractGenresFromSeeds(seeds),
				duration: config.playlistDuration || 60,
				limit: Math.max(moodCount * 2, 20), // Request extra for filtering
				seeds: seeds.slice(0, 5), // Pass seed tracks for ReccoBeats track/recommendation API
			}
		);
		
		for (const result of hybridResults) {
			if (result.artist) moodArtists.push(result.artist);
		}
		
		console.log(`discoverByMoodActivity: ${moodArtists.length} artists from ReccoBeats`);
	}
	
	// -------------------------------------------------------------------------
	// STEP 3: Blend both sources based on ratio
	// -------------------------------------------------------------------------
	updateProgress(`Blending results (${Math.round(blendRatio * 100)}% seeds)...`, 0.5);
	
	// Deduplicate each list
	const uniqueSeedArtists = [...new Set(seedSimilarArtists)];
	const uniqueMoodArtists = [...new Set(moodArtists)];
	
	// Take proportional amounts
	const selectedSeedArtists = uniqueSeedArtists.slice(0, seedCount);
	const selectedMoodArtists = uniqueMoodArtists.slice(0, moodCount);
	
	// Interleave for better variety
	const blendedArtists = [];
	const maxLength = Math.max(selectedSeedArtists.length, selectedMoodArtists.length);
	
	for (let i = 0; i < maxLength; i++) {
		if (i < selectedSeedArtists.length) blendedArtists.push(selectedSeedArtists[i]);
		if (i < selectedMoodArtists.length) blendedArtists.push(selectedMoodArtists[i]);
	}
	
	console.log(`discoverByMoodActivity: Blended ${blendedArtists.length} artists (${selectedSeedArtists.length} seed + ${selectedMoodArtists.length} ${context})`);
	
	// -------------------------------------------------------------------------
	// STEP 4: Build candidates and fetch tracks
	// -------------------------------------------------------------------------
	updateProgress(`Building candidate list...`, 0.6);
	
	for (const artist of blendedArtists) {
		if (artist) addArtistCandidate(artist, seenArtists, blacklist, candidates);
	}
	
	console.log(`discoverByMoodActivity: ${candidates.length} candidates after blacklist filtering`);
	
	if (candidates.length > 0) {
		updateProgress(`Fetching tracks for ${candidates.length} artists...`, 0.65);
		await fetchTracksForCandidates(modules, candidates, config);
	}
	
	return candidates;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get trackid from roccobeats
 */
async function getReccoTrackId(artist, title, apiKey) {
	// Normalize helper
	const normalize = (s) =>
		s.toLowerCase().replace(/[\s\-\_\(\)\[\]\.]+/g, "").trim();

	// Shared headers
	const myHeaders = new Headers();
	myHeaders.append("Accept", "application/json");
	myHeaders.append("x-api-key", apiKey);

	const requestOptions = {
		method: "GET",
		headers: myHeaders,
		redirect: "follow"
	};

	// 1?? Search for artist
	const artistSearchUrl =
		"https://api.reccobeats.com/v1/search/artist?q=" +
		encodeURIComponent(artist);

	const artistRes = await fetch(artistSearchUrl, requestOptions);
	const artistJson = await artistRes.json();

	if (!artistJson?.data?.length) {
		console.error("Artist not found:", artist);
		return null;
	}

	const artistId = artistJson.data[0].id;

	// 2?? Get tracks for that artist
	const tracksUrl =
		`https://api.reccobeats.com/v1/artist/${artistId}/tracks`;

	const tracksRes = await fetch(tracksUrl, requestOptions);
	const tracksJson = await tracksRes.json();

	if (!tracksJson?.data?.length) {
		console.error("No tracks found for artist:", artist);
		return null;
	}

	// 3?? Match title
	const normalizedTitle = normalize(title);

	const match = tracksJson.data.find(
		(t) => normalize(t.trackTitle) === normalizedTitle
	);

	if (!match) {
		console.error("Track title not found:", title);
		return null;
	}

	return match.id; // This is the trackId
}

/**
 * Build blacklist set from user settings.
 */
function buildBlacklist(modules) {
	const { settings: { storage }, utils: { helpers } } = modules;
	const { getSetting } = storage;
	const { parseListSetting } = helpers;

	const blacklist = new Set();

	try {
		const blacklistRaw = getSetting('ArtistBlacklist', '');
		const items = parseListSetting(blacklistRaw);

		for (const item of items) {
			if (item) blacklist.add(String(item).trim().toUpperCase());
		}
	} catch (e) {
		console.error('buildBlacklist error:', e.message);
	}

	return blacklist;
}

/**
 * Extract unique artists from seeds, splitting by ';'.
 */
function extractSeedArtists(seeds, limit) {
	const uniqueArtists = new Set();
	
	for (const seed of seeds) {
		if (seed.artist) {
			const artists = seed.artist.split(';').map(a => a.trim()).filter(Boolean);
			for (const artist of artists) {
				uniqueArtists.add(artist);
			}
		}
	}
	
	return Array.from(uniqueArtists).slice(0, limit);
}

/**
 * Extract genres from seed tracks.
 */
function extractGenresFromSeeds(seeds) {
	const genres = new Set();
	for (const seed of seeds) {
		if (seed.genre) {
			const genreList = seed.genre.split(';').map(g => g.trim()).filter(Boolean);
			for (const g of genreList) genres.add(g);
		}
	}
	return Array.from(genres).slice(0, 5);
}

/**
 * Add seed tracks to results for track-based discovery.
 */
function addSeedTracksToResults(seeds, seedLimit, blacklist, seenArtists, tracksByArtist) {
	for (let i = 0; i < seedLimit; i++) {
		const seed = seeds[i];
		if (!seed?.artist || !seed?.title) continue;

		const artists = seed.artist.split(';').map(a => a.trim()).filter(Boolean);

		for (const artistName of artists) {
			const artKey = artistName.toUpperCase();
			if (blacklist.has(artKey)) continue;
			if (seenArtists.has(artKey)) continue;

			seenArtists.add(artKey);

			if (!tracksByArtist.has(artKey)) {
				tracksByArtist.set(artKey, { artistName, tracks: [] });
			}

			const entry = tracksByArtist.get(artKey);
			const trackKey = seed.title.toUpperCase();
			
			if (!entry.tracks.some(t => t.title.toUpperCase() === trackKey)) {
				entry.tracks.push({ title: seed.title, match: 1.0, playcount: 0 });
			}
		}
	}
	console.log(`addSeedTracksToResults: Added ${seenArtists.size} seed artists`);
}

/**
 * Add artist to candidates if not already seen and not blacklisted.
 */
function addArtistCandidate(artistName, seenArtists, blacklist, candidates) {
	if (!artistName) return;

	const key = String(artistName).trim().toUpperCase();
	if (!key || seenArtists.has(key) || blacklist.has(key)) return;

	seenArtists.add(key);
	candidates.push({ artist: artistName, tracks: [] });
}

/**
 * Fetch top tracks for candidate artists.
 */
async function fetchTracksForCandidates(modules, candidates, config) {
	const { api: { lastfmApi }, settings: { prefixes }, ui: { notifications } } = modules;
	const { fetchTopTracks } = lastfmApi;
	const { fixPrefixes } = prefixes;
	const { updateProgress } = notifications;

	const tracksPerArtist = config.tracksPerArtist || 10;
	const totalCandidates = candidates.length;

	console.log(`fetchTracksForCandidates: Fetching up to ${tracksPerArtist} tracks for ${totalCandidates} artists`);

	for (let i = 0; i < totalCandidates; i++) {
		const candidate = candidates[i];

		// Skip if already has tracks (e.g., from track-based discovery)
		if (candidate.tracks && candidate.tracks.length > 0) continue;

		// Update progress every 5 artists
		if (i % 5 === 0) {
			const progress = 0.5 + ((i + 1) / totalCandidates) * 0.3;
			updateProgress(`Getting tracks for "${candidate.artist}" (${i + 1}/${totalCandidates})...`, progress);
		}

		try {
			const fixedName = fixPrefixes(candidate.artist);
			const topTracks = await fetchTopTracks(fixedName, tracksPerArtist, true);

			if (topTracks && topTracks.length > 0) {
				candidate.tracks = topTracks.map(t => ({
					title: typeof t === 'string' ? t : (t.title || ''),
					playcount: typeof t === 'object' ? (t.playcount || 0) : 0,
					rank: typeof t === 'object' ? (t.rank || 0) : 0
				})).filter(t => t.title);
			}
		} catch (e) {
			console.warn(`fetchTracksForCandidates: Error for "${candidate.artist}": ${e.message}`);
		}
	}
}

/**
 * Get the appropriate discovery function for a mode.
 */
function getDiscoveryStrategy(mode) {
	switch (mode) {
		case DISCOVERY_MODES.TRACK:
			return discoverByTrack;
		case DISCOVERY_MODES.GENRE:
			return discoverByGenre;
		case DISCOVERY_MODES.MOOD:
		case DISCOVERY_MODES.ACTIVITY:
			return discoverByMoodActivity;
		case DISCOVERY_MODES.ARTIST:
		default:
			return discoverByArtist;
	}
}

/**
 * Get human-readable name for discovery mode.
 */
function getDiscoveryModeName(mode) {
	switch (mode) {
		case DISCOVERY_MODES.TRACK: return 'Similar Tracks';
		case DISCOVERY_MODES.GENRE: return 'Similar Genre';
		case DISCOVERY_MODES.MOOD: return 'Mood';
		case DISCOVERY_MODES.ACTIVITY: return 'Activity';
		case DISCOVERY_MODES.ARTIST:
		default: return 'Similar Artists';
	}
}

// Export to window namespace for MM5
window.matchMonkeyDiscoveryStrategies = {
	DISCOVERY_MODES,
	discoverByArtist,
	discoverByTrack,
	discoverByGenre,
	discoverByMoodActivity,
	getDiscoveryStrategy,
	getDiscoveryModeName,
	buildBlacklist,
};
