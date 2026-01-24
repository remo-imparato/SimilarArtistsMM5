/**
 * Discovery Strategies Module
 * 
 * Implements different discovery algorithms for finding similar music:
 * - Artist-based: Use Last.fm artist.getSimilar API
 * - Track-based: Use Last.fm track.getSimilar API  
 * - Genre-based: Use Last.fm tag.getTopArtists API
 * 
 * Each strategy returns a list of artist/track candidates to search in the local library.
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
	GENRE: 'genre'
};

/**
 * Helper to get track title from MM5 track object.
 * MM5 uses SongTitle, but we also check title for compatibility.
 */
function getTrackTitle(track) {
	if (!track) return '';
	return track.SongTitle || track.songTitle || track.title || track.Title || '';
}

/**
 * Helper to get artist name from MM5 track object.
 * MM5 uses Artist property.
 */
function getTrackArtist(track) {
	if (!track) return '';
	return track.Artist || track.artist || '';
}

/**
 * Artist-based discovery strategy.
 * 
 * Uses Last.fm artist.getSimilar to find similar artists, then gets their top tracks.
 * This is the original/classic approach.
 * 
 * @param {object} modules - Module dependencies
 * @param {Array} seeds - Seed artist objects [{name, track}, ...]
 * @param {object} config - Configuration settings
 * @returns {Promise<Array>} Array of {artist, tracks[]} candidates
 */
async function discoverByArtist(modules, seeds, config) {
	const { api: { lastfmApi }, settings: { prefixes }, ui: { notifications } } = modules;
	const { fetchSimilarArtists, fetchTopTracks } = lastfmApi;
	const { fixPrefixes } = prefixes;
	const { updateProgress } = notifications;

	const candidates = [];
	const seenArtists = new Set();

	// Build blacklist
	const blacklist = buildBlacklist(modules);

	const seedLimit = Math.min(seeds.length, config.seedLimit || 10);

	for (let i = 0; i < seedLimit; i++) {
		const seed = seeds[i];
		const progress = (i + 1) / seedLimit;
		updateProgress(`Finding similar artists to "${seed.name}"...`, progress * 0.3);

		try {
			// Fetch similar artists from Last.fm
			const fixedName = fixPrefixes(seed.name);
			const similar = await fetchSimilarArtists(fixedName, config.similarLimit || 30);

			if (!similar || similar.length === 0) {
				console.log(`discoverByArtist: No similar artists found for "${seed.name}"`);
				continue;
			}

			// Optionally include seed artist
			if (config.includeSeedArtist) {
				addArtistCandidate(seed.name, seenArtists, blacklist, candidates);
			}

			// Add similar artists
			for (const artist of similar) {
				if (artist?.name) {
					addArtistCandidate(artist.name, seenArtists, blacklist, candidates);
				}
			}

		} catch (e) {
			console.error(`discoverByArtist: Error processing seed "${seed.name}": ${e.toString()}`);
		}
	}

	console.log(`discoverByArtist: Found ${candidates.length} candidate artists`);

	// Fetch top tracks for each candidate artist
	if (candidates.length > 0) {
		updateProgress('Fetching top tracks for similar artists...', 0.4);
		await fetchTracksForCandidates(modules, candidates, config);
	}

	return candidates;
}

/**
 * Track-based discovery strategy.
 * 
 * Uses Last.fm track.getSimilar to find musically similar tracks across different artists.
 * This can discover music from artists you might not have found via artist.getSimilar.
 * 
 * @param {object} modules - Module dependencies
 * @param {Array} seeds - Seed track objects [{name, track}, ...]
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

	// Build blacklist
	const blacklist = buildBlacklist(modules);

	// Limit seeds for track-based discovery (more API-intensive)
	const seedLimit = Math.min(seeds.length, config.seedLimit || 5);

	for (let i = 0; i < seedLimit; i++) {
		const seed = seeds[i];
		const track = seed.track;

		// Get track title using helper (handles MM5 property names)
		const trackTitle = getTrackTitle(track);
		if (!trackTitle) {
			console.log(`discoverByTrack: Seed ${i} has no track title, skipping`);
			continue;
		}

		const artistName = fixPrefixes(seed.name);
		const progress = (i + 1) / seedLimit;
		updateProgress(`Finding tracks similar to "${trackTitle}"...`, progress * 0.5);

		try {
			// Fetch similar tracks from Last.fm
			const similarTracks = await fetchSimilarTracks(
				artistName,
				trackTitle,
				config.similarLimit || 50
			);

			if (!similarTracks || similarTracks.length === 0) {
				console.log(`discoverByTrack: No similar tracks found for "${artistName} - ${trackTitle}"`);
				continue;
			}

			console.log(`discoverByTrack: Found ${similarTracks.length} similar tracks for "${trackTitle}"`);

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
				
				// Check if we already have this track
				const trackKey = simTrack.title.toUpperCase();
				const exists = entry.tracks.some(t => t.title.toUpperCase() === trackKey);
				if (!exists) {
					entry.tracks.push({
						title: simTrack.title,
						match: simTrack.match || 0,
						playcount: simTrack.playcount || 0
					});
				}
			}

		} catch (e) {
			console.error(`discoverByTrack: Error processing seed track "${trackTitle}": ${e.toString()}`);
		}
	}

	// Convert to candidate format
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

/**
 * Genre-based discovery strategy.
 * 
 * Uses Last.fm artist.getInfo to get genres/tags, then tag.getTopArtists to find
 * popular artists in those genres.
 * 
 * @param {object} modules - Module dependencies
 * @param {Array} seeds - Seed artist objects [{name, track}, ...]
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

	// Build blacklist
	const blacklist = buildBlacklist(modules);

	// Step 1: Collect genres/tags from seed artists
	updateProgress('Analyzing seed artist genres...', 0.1);

	const seedLimit = Math.min(seeds.length, config.seedLimit || 5);

	for (let i = 0; i < seedLimit; i++) {
		const seed = seeds[i];
		const fixedName = fixPrefixes(seed.name);

		try {
			const artistInfo = await fetchArtistInfo(fixedName);

			if (artistInfo?.tags && artistInfo.tags.length > 0) {
				console.log(`discoverByGenre: "${seed.name}" has tags: ${artistInfo.tags.slice(0, 5).join(', ')}`);

				// Count tag occurrences across seeds
				for (const tag of artistInfo.tags.slice(0, 5)) { // Top 5 tags per artist
					const tagKey = tag.toLowerCase();
					collectedTags.set(tagKey, (collectedTags.get(tagKey) || 0) + 1);
				}
			}

		} catch (e) {
			console.error(`discoverByGenre: Error getting info for "${seed.name}": ${e.toString()}`);
		}
	}

	if (collectedTags.size === 0) {
		console.log('discoverByGenre: No tags found for seed artists');
		return candidates;
	}

	// Sort tags by frequency (most common first)
	const sortedTags = Array.from(collectedTags.entries())
		.sort((a, b) => b[1] - a[1])
		.map(([tag]) => tag);

	console.log(`discoverByGenre: Using tags: ${sortedTags.slice(0, 5).join(', ')}`);

	// Step 2: Get top artists for each tag
	updateProgress('Finding artists in similar genres...', 0.3);

	const numTags = Math.min(sortedTags.length, 3);
	const artistsPerTag = Math.ceil((config.similarLimit || 30) / numTags);

	for (let i = 0; i < numTags; i++) {
		const tag = sortedTags[i];
		const progress = 0.3 + ((i + 1) / numTags) * 0.3;
		updateProgress(`Searching "${tag}" genre...`, progress);

		try {
			const tagArtists = await fetchArtistsByTag(tag, artistsPerTag);

			if (!tagArtists || tagArtists.length === 0) {
				console.log(`discoverByGenre: No artists found for tag "${tag}"`);
				continue;
			}

			console.log(`discoverByGenre: Found ${tagArtists.length} artists for tag "${tag}"`);

			for (const artist of tagArtists) {
				if (artist?.name) {
					addArtistCandidate(artist.name, seenArtists, blacklist, candidates);
				}
			}

		} catch (e) {
			console.error(`discoverByGenre: Error fetching artists for tag "${tag}": ${e.toString()}`);
		}
	}

	console.log(`discoverByGenre: Found ${candidates.length} candidate artists from genre search`);

	// Step 3: Fetch top tracks for candidates
	if (candidates.length > 0) {
		updateProgress('Fetching top tracks from genre artists...', 0.7);
		await fetchTracksForCandidates(modules, candidates, config);
	}

	return candidates;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Build blacklist set from settings.
 */
function buildBlacklist(modules) {
	const { settings: { storage }, utils: { helpers } } = modules;
	const { getSetting } = storage;
	const { parseListSetting } = helpers;

	const blacklist = new Set();
	
	try {
		const blacklistRaw = getSetting('Black', '');
		const items = parseListSetting(blacklistRaw);

		for (const item of items) {
			if (item) {
				blacklist.add(String(item).trim().toUpperCase());
			}
		}
	} catch (e) {
		console.error('buildBlacklist error: ' + e.toString());
	}

	return blacklist;
}

/**
 * Add artist to candidates if not already seen and not blacklisted.
 */
function addArtistCandidate(artistName, seenArtists, blacklist, candidates) {
	if (!artistName) return;

	const key = String(artistName).trim().toUpperCase();
	if (!key || seenArtists.has(key) || blacklist.has(key)) return;

	seenArtists.add(key);
	candidates.push({
		artist: artistName,
		tracks: [] // Will be filled later
	});
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

	for (let i = 0; i < totalCandidates; i++) {
		const candidate = candidates[i];

		// Skip if already has tracks (e.g., from track-based discovery)
		if (candidate.tracks && candidate.tracks.length > 0) continue;

		const progress = 0.5 + ((i + 1) / totalCandidates) * 0.3;
		updateProgress(`Fetching tracks for "${candidate.artist}"...`, progress);

		try {
			const fixedName = fixPrefixes(candidate.artist);
			const topTracks = await fetchTopTracks(fixedName, tracksPerArtist, true);

			if (topTracks && topTracks.length > 0) {
				candidate.tracks = topTracks.map(t => ({
					title: typeof t === 'string' ? t : (t.title || ''),
					playcount: typeof t === 'object' ? (t.playcount || 0) : 0,
					rank: typeof t === 'object' ? (t.rank || 0) : 0
				})).filter(t => t.title); // Filter out empty titles
			}

		} catch (e) {
			console.error(`fetchTracksForCandidates: Error for "${candidate.artist}": ${e.toString()}`);
		}
	}
}

/**
 * Get the appropriate discovery function for a mode.
 * 
 * @param {string} mode - Discovery mode ('artist', 'track', 'genre')
 * @returns {Function} Discovery function
 */
function getDiscoveryStrategy(mode) {
	switch (mode) {
		case DISCOVERY_MODES.TRACK:
			return discoverByTrack;
		case DISCOVERY_MODES.GENRE:
			return discoverByGenre;
		case DISCOVERY_MODES.ARTIST:
		default:
			return discoverByArtist;
	}
}

/**
 * Get human-readable name for discovery mode (for playlist naming).
 * 
 * @param {string} mode - Discovery mode
 * @returns {string} Human-readable mode name
 */
function getDiscoveryModeName(mode) {
	switch (mode) {
		case DISCOVERY_MODES.TRACK:
			return 'Similar Tracks';
		case DISCOVERY_MODES.GENRE:
			return 'Similar Genre';
		case DISCOVERY_MODES.ARTIST:
		default:
			return 'Similar Artists';
	}
}

// Export to window namespace for MM5
window.matchMonkeyDiscoveryStrategies = {
	DISCOVERY_MODES,
	discoverByArtist,
	discoverByTrack,
	discoverByGenre,
	getDiscoveryStrategy,
	getDiscoveryModeName,
	buildBlacklist,
	getTrackTitle,
	getTrackArtist,
};
