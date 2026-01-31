/**
 * Discovery Strategies Module
 * 
 * Implements different discovery algorithms for finding similar music:
 * - Artist-based: Use Last.fm artist.getSimilar API
 * - Track-based: Use Last.fm track.getSimilar API  
 * - Genre-based: Use Last.fm tag.getTopArtists API
 * - Recco-based: Use ReccoBeats recommendations from seed tracks
 * - Mood-based: Use predefined mood audio profiles
 * - Activity-based: Use predefined activity audio profiles
 * 
 * Each strategy returns a list of artist/track candidates to search in the local library.
 * All strategies respect user-configured limits and preferences.
 * 

 * 
 * @author Remo Imparato

 */

'use strict';

/**
 * Discovery mode constants
 */
const DISCOVERY_MODES = {
	ARTIST: 'artist',
	TRACK: 'track',
	GENRE: 'genre',
	ACOUSTICS: 'acoustics',    // ReccoBeats with seed tracks
	MOOD: 'mood',      // Mood preset
	ACTIVITY: 'activity' // Activity preset
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

	console.log(`Discovery [Artist]: Processing ${artistCount} seed artist(s), max ${config.similarLimit} similar per artist`);
	updateProgress(`Querying Last.fm for ${artistCount} seed artist(s)...`, 0.2);

	let totalSimilarFound = 0;

	for (let i = 0; i < artistCount; i++) {
		const artistName = uniqueArtists[i];
		const progress = 0.2 + ((i + 1) / artistCount) * 0.25;
		updateProgress(`Last.fm: Finding artists similar to "${artistName}" (${i + 1}/${artistCount})...`, progress);

		try {
			const fixedName = fixPrefixes(artistName);
			const similar = await fetchSimilarArtists(fixedName, config.similarLimit || 20);

			if (!similar || similar.length === 0) {
				console.log(`Discovery [Artist]: No similar artists found for "${artistName}"`);
				updateProgress(`Last.fm: No similar artists for "${artistName}"`, progress);
				continue;
			}

			totalSimilarFound += similar.length;
			console.log(`Discovery [Artist]: Found ${similar.length} similar artists for "${artistName}"`);
			updateProgress(`Last.fm: Found ${similar.length} similar to "${artistName}"`, progress);

			// Include seed artist in the search if configured
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
			console.error(`Discovery [Artist]: Error for "${artistName}":`, e.message);
		}
	}

	console.log(`Discovery [Artist]: Found ${candidates.length} candidate artists total (${totalSimilarFound} from Last.fm)`);
	updateProgress(`Last.fm returned ${totalSimilarFound} similar artists → ${candidates.length} unique candidates`, 0.45);

	// Fetch top tracks for all candidates
	if (candidates.length > 0) {
		updateProgress(`Fetching top tracks for ${candidates.length} artists from Last.fm...`, 0.5);
		console.log(`Discovery [Artist]: Fetching top tracks for ${candidates.length} artists (${config.tracksPerArtist} per artist)`);
		await fetchTracksForCandidates(modules, candidates, config);

		const totalTracks = candidates.reduce((sum, c) => sum + (c.tracks?.length || 0), 0);
		updateProgress(`Last.fm: Retrieved ${totalTracks} tracks from ${candidates.length} artists`, 0.6);
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
	const tracksByArtist = new Map();
	const blacklist = buildBlacklist(modules);

	// Limit seeds for track-based discovery (more API-intensive)
	const seedLimit = Math.min(seeds.length, config.seedLimit || 5);
	const trackSimilarLimit = config.trackSimilarLimit || 100;

	console.log(`Discovery [Track]: Processing ${seedLimit} seed tracks, max ${trackSimilarLimit} similar per track`);
	updateProgress(`Querying Last.fm for ${seedLimit} seed track(s)...`, 0.2);

	// Include seed artist in the search if configured
	if (config.includeSeedArtist) {
		addSeedTracksToResults(seeds, seedLimit, blacklist, seenArtists, tracksByArtist);
	}

	let totalSimilarTracks = 0;

	for (let i = 0; i < seedLimit; i++) {
		const seed = seeds[i];
		if (!seed?.artist || !seed?.title) continue;

		const progress = 0.2 + ((i + 1) / seedLimit) * 0.3;
		updateProgress(`Last.fm: Finding tracks similar to "${seed.title}" (${i + 1}/${seedLimit})...`, progress);

		// Split artists by ';' and query each separately
		const artists = seed.artist.split(';').map(a => a.trim()).filter(Boolean);

		for (const artistName of artists) {
			const fixedArtistName = fixPrefixes(artistName);

			try {
				const similarTracks = await fetchSimilarTracks(fixedArtistName, seed.title, trackSimilarLimit);

				if (!similarTracks || similarTracks.length === 0) {
					console.log(`Discovery [Track]: No similar tracks for "${fixedArtistName} - ${seed.title}"`);
					continue;
				}

				totalSimilarTracks += similarTracks.length;
				console.log(`Discovery [Track]: Found ${similarTracks.length} similar to "${fixedArtistName} - ${seed.title}"`);
				updateProgress(`Last.fm: Found ${similarTracks.length} tracks similar to "${seed.title}"`, progress);

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
				console.error(`Discovery [Track]: Error for "${fixedArtistName} - ${seed.title}":`, e.message);
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

	console.log(`Discovery [Track]: Found ${candidates.length} candidate artists from track similarity`);
	updateProgress(`Last.fm returned ${totalSimilarTracks} similar tracks → ${candidates.length} artists`, 0.5);

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
	updateProgress('Analyzing seed genres from tracks...', 0.1);

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
				updateProgress(`Last.fm: Getting genre tags for "${artistName}"...`, 0.15);
				const artistInfo = await fetchArtistInfo(fixPrefixes(artistName));

				if (artistInfo?.tags && artistInfo.tags.length > 0) {
					updateProgress(`Last.fm: Found ${artistInfo.tags.length} tags for "${artistName}"`, 0.18);
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
		updateProgress('No genre tags found from seeds', 0.2);
		return candidates;
	}

	// Sort tags by frequency
	const sortedTags = Array.from(collectedTags.entries())
		.sort((a, b) => b[1] - a[1])
		.map(([tag]) => tag);

	console.log(`discoverByGenre: Top tags: ${sortedTags.slice(0, maxTagsToSearch).join(', ')}`);
	updateProgress(`Found ${sortedTags.length} genre tags: ${sortedTags.slice(0, 3).join(', ')}...`, 0.25);

	// Step 2: Get top artists for each tag
	const numTags = Math.min(sortedTags.length, maxTagsToSearch);
	let totalArtistsFromTags = 0;

	for (let i = 0; i < numTags; i++) {
		if (candidates.length >= maxCandidates) {
			console.log(`discoverByGenre: Reached limit of ${maxCandidates} candidates`);
			break;
		}

		const tag = sortedTags[i];
		const progress = 0.3 + ((i + 1) / numTags) * 0.3;
		updateProgress(`Last.fm: Searching "${tag}" genre (${i + 1}/${numTags})...`, progress);

		try {
			const remainingNeeded = maxCandidates - candidates.length;
			const fetchLimit = Math.min(artistsPerTag, remainingNeeded);

			const tagArtists = await fetchArtistsByTag(tag, fetchLimit);

			if (tagArtists && tagArtists.length > 0) {
				totalArtistsFromTags += tagArtists.length;
				updateProgress(`Last.fm: Found ${tagArtists.length} artists in "${tag}" genre`, progress);

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
	updateProgress(`Last.fm returned ${totalArtistsFromTags} genre artists → ${candidates.length} candidates`, 0.6);

	// Step 3: Fetch top tracks
	if (candidates.length > 0) {
		updateProgress(`Fetching top tracks for ${candidates.length} genre artists...`, 0.7);
		await fetchTracksForCandidates(modules, candidates, config);

		const totalTracks = candidates.reduce((sum, c) => sum + (c.tracks?.length || 0), 0);
		updateProgress(`Last.fm: Retrieved ${totalTracks} tracks from ${candidates.length} artists`, 0.8);
	}

	return candidates;
}

// ============================================================================
// RECCOBEATS-BASED DISCOVERY (Seed-based acoustic recommendations)
// ============================================================================

function buildReccoCandidates(result, blacklist, seenArtists) {
	if (!result || !Array.isArray(result.recommendations)) {
		return [];
	}

	const candidates = [];

	for (const rec of result.recommendations) {
		const trackTitle = rec.trackTitle;

		// Ensure artists array exists
		if (!rec.artists || !Array.isArray(rec.artists)) continue;

		for (const artist of rec.artists) {
			const artistName = artist?.name;
			if (!artistName) continue;

			const artKey = artistName.toUpperCase();

			// Skip blacklisted artists
			if (blacklist.has(artKey)) continue;

			// First time seeing this artist
			if (!seenArtists.has(artKey)) {
				seenArtists.add(artKey);

				candidates.push({
					artist: artistName,
					tracks: trackTitle
						? [{ title: trackTitle, match: 1.0 }]
						: []
				});
			}
			// Artist already exists → add track if unique
			else if (trackTitle) {
				const existing = candidates.find(
					c => c.artist.toUpperCase() === artKey
				);

				if (
					existing &&
					!existing.tracks.some(
						t => t.title.toUpperCase() === trackTitle.toUpperCase()
					)
				) {
					existing.tracks.push({ title: trackTitle, match: 1.0 });
				}
			}
		}
	}

	return candidates;
}

/**
 * ReccoBeats-based discovery strategy.
 * 
 * Uses ReccoBeats API to find acousticly similar recommendations based on seed tracks.
 * Workflow: Album Search → Find Tracks → Get Audio Features → Get Recommendations
 * 
 * This mode requires seed tracks with album information for best results.
 * 
 * @param {object} modules - Module dependencies
 * @param {Array} seeds - Seed objects [{artist, title, album, genre}, ...]
 * @param {object} config - Configuration settings
 * @returns {Promise<Array>} Array of {artist, tracks[]} candidates
 */
async function discoverByRecco(modules, seeds, config) {
	const { ui: { notifications } } = modules;
	const { updateProgress } = notifications;
	const reccobeatsApi = window.matchMonkeyReccoBeatsAPI;

	if (!reccobeatsApi) {
		console.error('Discovery [ReccoBeats]: API module not loaded');
		return [];
	}

	let candidates = [];
	const seenArtists = new Set();
	const blacklist = buildBlacklist(modules);

	console.log(`Discovery [ReccoBeats]: Processing ${seeds.length} seed track(s)`);
	updateProgress(`ReccoBeats: Analyzing ${seeds.length} seed track(s)...`, 0.2);

	// Step 1: Get ReccoBeats recommendations based on seed tracks
	updateProgress('ReccoBeats: Requesting acoustic recommendations...', 0.25);
	console.log(`Discovery [ReccoBeats]: Requesting acoustic recommendations (limit: ${config.similarLimit || 100})`);

	const result = await reccobeatsApi.getReccoRecommendations(
		seeds.slice(0, 5),
		config.similarLimit || 100
	);

	if (!result.recommendations || result.recommendations.length === 0) {
		console.log('Discovery [ReccoBeats]: No recommendations received');
		updateProgress('ReccoBeats: No recommendations found', 0.4);
		return candidates;
	}

	console.log(`Discovery [ReccoBeats]: Received ${result.recommendations.length} recommendations from ${result.foundCount} seed(s)`);
	updateProgress(`ReccoBeats: Found ${result.recommendations.length} acoustic recommendations from ${result.foundCount} seed(s)`, 0.4);

	// Step 2: Extract artists from recommendations
	updateProgress(`Processing ${result.recommendations.length} ReccoBeats recommendations...`, 0.5);

	candidates = buildReccoCandidates(result, blacklist, seenArtists);

	const totalTracks = candidates.reduce((sum, c) => sum + (c.tracks?.length || 0), 0);
	console.log(`Discovery [ReccoBeats]: Built ${candidates.length} candidate artists from acoustic recommendations`);
	updateProgress(`ReccoBeats: ${candidates.length} artists with ${totalTracks} tracks from acoustic`, 0.6);

	return candidates;
}

// ============================================================================
// MOOD-BASED DISCOVERY
// ============================================================================

/**
 * Mood-based discovery strategy.
 * 
 * Uses predefined audio feature profiles for different moods.
 * Does NOT require seed tracks - just searches library for tracks matching the mood profile.
 * 
 * Available moods: energetic, relaxed, happy, sad, focused, angry, romantic
 * 
 * @param {object} modules - Module dependencies
 * @param {Array} seeds - Seed objects (not used for mood discovery)
 * @param {object} config - Configuration with moodActivityValue
 * @returns {Promise<Array>} Array of {artist, tracks[], audioTargets} candidates
 */
async function discoverByMood(modules, seeds, config) {
	const { ui: { notifications } } = modules;
	const { updateProgress } = notifications;
	const reccobeatsApi = window.matchMonkeyReccoBeatsAPI;

	if (!seeds || seeds.length === 0) {
		console.warn('Discovery [Mood]: No seed tracks provided');
		return { recommendations: [], seedCount: 0, foundCount: 0 };
	}

	const mood = config.moodActivityValue || 'energetic';
	console.log(`Discovery [Mood]: Processing "${mood}" mood with ${seeds.length} seed track(s)`);
	updateProgress(`Mood "${mood}": Preparing ${seeds.length} seed track(s)...`, 0.15);

	// Expand seeds by splitting artists
	seeds = expandSeedsByArtist(seeds);
	//seeds = matchMonkeyHelpers.shuffle(seeds);

	console.log(`discoverByMood: Processing up to 5 of ${seeds.length} seed track(s)`);

	const limitedSeeds = seeds.slice(0, 5);

	// Step 1: Find track IDs
	updateProgress(`ReccoBeats: Looking up ${limitedSeeds.length} tracks...`, 0.2);
	console.log(`Discovery [Mood]: Looking up track IDs for ${limitedSeeds.length} seeds`);

	const trackResults = await reccobeatsApi.findTrackIdsBatch(limitedSeeds);

	// Filter to found tracks
	const foundTracks = trackResults.filter(r => r.trackId);
	if (foundTracks.length === 0) {
		console.log('Discovery [Mood]: No tracks found on ReccoBeats');
		updateProgress('ReccoBeats: No matching tracks found in database', 0.3);
	} else {
		updateProgress(`ReccoBeats: Found ${foundTracks.length}/${limitedSeeds.length} tracks in database`, 0.25);
	}

	console.log(`Discovery [Mood]: Found ${foundTracks.length}/${limitedSeeds.length} tracks on ReccoBeats`);

	let moodPreset = reccobeatsApi?.MOOD_AUDIO_TARGETS?.[mood.toLowerCase()];
	let audioTargets = null;

	if (!moodPreset) {
		console.error(`Discovery [Mood]: Unknown mood "${mood}"`);
		return [];
	}

	console.log(`Discovery [Mood]: Using "${mood}" preset with blend ratio ${config.moodSeedBlend}`);
	updateProgress(`Mood "${mood}": Analyzing audio features...`, 0.3);

	const audioFeatures = await reccobeatsApi.getAudioFeatures(foundTracks);

	if (!audioFeatures || audioFeatures.length === 0) {
		//console.warn("Discovery [Mood]: No audio features found, using pure mood preset");
		//updateProgress(`Mood "${mood}": Using pure mood preset (no seed features)`, 0.35);
		//audioTargets = moodPreset;
		return [];
	} else {
		updateProgress(`ReccoBeats: Blending ${audioFeatures.length} seed features with "${mood}" preset...`, 0.35);
		console.log(`Discovery [Mood]: Blending ${audioFeatures.length} seed features with mood preset`);

		const avgSeedsFeature = reccobeatsApi.calculateAverageFeatures(audioFeatures);

		const BLEND_RATIO = config.moodSeedBlend;
		const ratio = Math.min(1, Math.max(0, BLEND_RATIO));

		audioTargets = reccobeatsApi.blendFeatures(
			avgSeedsFeature,
			moodPreset,
			ratio
		);

		// Log all requested audio target properties
		logAudioTargets('Mood', mood, audioTargets, updateProgress);
	}

	updateProgress(`ReccoBeats: Finding "${mood}" tracks...`, 0.4);
	console.log(`Discovery [Mood]: Requesting recommendations with mood profile`);

	const seedIds = foundTracks.map(r => r.trackId);
	const recommendations = await reccobeatsApi.fetchRecommendations(seedIds, audioTargets, 100);

	console.log(`Discovery [Mood]: Received ${recommendations.length} "${mood}" recommendations`);
	updateProgress(`ReccoBeats: Found ${recommendations.length} "${mood}" recommendations`, 0.5);

	let candidates = [];
	const seenArtists = new Set();
	const blacklist = buildBlacklist(modules);

	const seedIdRecs = { "recommendations": recommendations }
	candidates = buildReccoCandidates(seedIdRecs, blacklist, seenArtists);

	const totalTracks = candidates.reduce((sum, c) => sum + (c.tracks?.length || 0), 0);
	console.log(`Discovery [Mood]: Built ${candidates.length} candidate artists for "${mood}" mood`);
	updateProgress(`Mood "${mood}": ${candidates.length} artists with ${totalTracks} tracks`, 0.6);

	return candidates;
}

/**
 * Activity-based discovery strategy.
 * 
 * Uses predefined audio feature profiles for different activities.
 * Does NOT require seed tracks - just searches library for tracks matching the activity profile.
 * 
 * Available activities: workout, study, party, sleep, driving, meditation, cooking
 * 
 * @param {object} modules - Module dependencies
 * @param {Array} seeds - Seed objects (not used for activity discovery)
 * @param {object} config - Configuration with moodActivityValue
 * @returns {Promise<Array>} Array of {artist, tracks[], audioTargets} candidates
 */
async function discoverByActivity(modules, seeds, config) {
	const { ui: { notifications } } = modules;
	const { updateProgress } = notifications;
	const reccobeatsApi = window.matchMonkeyReccoBeatsAPI;

	if (!seeds || seeds.length === 0) {
		console.warn('Discovery [Activity]: No seed tracks provided');
		return { recommendations: [], seedCount: 0, foundCount: 0 };
	}

	const activity = config.moodActivityValue || 'workout';
	console.log(`Discovery [Activity]: Processing "${activity}" activity with ${seeds.length} seed track(s)`);
	updateProgress(`Activity "${activity}": Preparing ${seeds.length} seed track(s)...`, 0.15);

	// Expand seeds by splitting artists
	seeds = expandSeedsByArtist(seeds);
	//seeds = matchMonkeyHelpers.shuffle(seeds);

	console.log(`discoverByActivity: Processing up to 5 of ${seeds.length} seed track(s)`);

	const limitedSeeds = seeds.slice(0, 5);

	// Step 1: Find track IDs
	updateProgress(`ReccoBeats: Looking up ${limitedSeeds.length} tracks...`, 0.2);
	console.log(`Discovery [Activity]: Looking up track IDs for ${limitedSeeds.length} seeds`);

	const trackResults = await reccobeatsApi.findTrackIdsBatch(limitedSeeds);

	// Filter to found tracks
	const foundTracks = trackResults.filter(r => r.trackId);
	if (foundTracks.length === 0) {
		console.log('Discovery [Activity]: No tracks found on ReccoBeats');
		updateProgress('ReccoBeats: No matching tracks found in database', 0.3);
		return { recommendations: [], seedCount: limitedSeeds.length, foundCount: 0 };
	}

	console.log(`Discovery [Activity]: Found ${foundTracks.length}/${limitedSeeds.length} tracks on ReccoBeats`);
	updateProgress(`ReccoBeats: Found ${foundTracks.length}/${limitedSeeds.length} tracks in database`, 0.25);

	const activityPreset = reccobeatsApi?.ACTIVITY_AUDIO_TARGETS?.[activity.toLowerCase()];
	let audioTargets = null;

	if (!activityPreset) {
		console.error(`Discovery [Activity]: Unknown activity "${activity}"`);
		return [];
	}

	console.log(`Discovery [Activity]: Using "${activity}" preset with blend ratio ${config.moodSeedBlend}`);
	updateProgress(`Activity "${activity}": Analyzing audio features...`, 0.3);

	const audioFeatures = await reccobeatsApi.getAudioFeatures(foundTracks);

	if (!audioFeatures || audioFeatures.length === 0) {
		//	console.warn("Discovery [Activity]: No audio features found, using pure activity preset");
		//	updateProgress(`Activity "${activity}": Using pure activity preset (no seed features)`, 0.35);
		//	audioTargets = activityPreset;
		return [];

	} else {
		updateProgress(`ReccoBeats: Blending ${audioFeatures.length} seed features with "${activity}" preset...`, 0.35);
		console.log(`Discovery [Activity]: Blending ${audioFeatures.length} seed features with activity preset`);

		const avgSeedsFeature = reccobeatsApi.calculateAverageFeatures(audioFeatures);

		const BLEND_RATIO = config.moodSeedBlend;
		const ratio = Math.min(1, Math.max(0, BLEND_RATIO));

		audioTargets = reccobeatsApi.blendFeatures(
			avgSeedsFeature,
			activityPreset,
			ratio
		);

		// Log all requested audio target properties
		logAudioTargets('Activity', activity, audioTargets, updateProgress);
	}

	updateProgress(`ReccoBeats: Finding "${activity}" tracks...`, 0.4);
	console.log(`Discovery [Activity]: Requesting recommendations with activity profile`);

	const seedIds = foundTracks.map(r => r.trackId);
	const recommendations = await reccobeatsApi.fetchRecommendations(seedIds, audioTargets, 100);

	console.log(`Discovery [Activity]: Received ${recommendations.length} "${activity}" recommendations`);
	updateProgress(`ReccoBeats: Found ${recommendations.length} "${activity}" recommendations`, 0.5);

	let candidates = [];
	const seenArtists = new Set();
	const blacklist = buildBlacklist(modules);

	const seedIdRecs = { "recommendations": recommendations }
	candidates = buildReccoCandidates(seedIdRecs, blacklist, seenArtists);

	const totalTracks = candidates.reduce((sum, c) => sum + (c.tracks?.length || 0), 0);
	console.log(`Discovery [Activity]: Built ${candidates.length} candidate artists for "${activity}" activity`);
	updateProgress(`Activity "${activity}": ${candidates.length} artists with ${totalTracks} tracks`, 0.6);

	return candidates;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Build blacklist set from user settings.
 * 
 * @param {object} modules - Module dependencies
 * @returns {Set<string>} Set of blacklisted artist names (uppercase)
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

function expandSeedsByArtist(seeds) {
	const expanded = [];

	for (const seed of seeds) {
		if (!seed || !seed.artist) continue;

		const artists = seed.artist
			.split(';')
			.map(a => a.trim())
			.filter(Boolean);

		for (const artist of artists) {
			expanded.push({
				album: seed.album,
				artist: artist,
				title: seed.title,
				genre: seed.genre,
			});
		}
	}

	return expanded;
}

/**
 * Extract unique artists from seeds, splitting by ';'.
 * 
 * @param {Array} seeds - Seed objects
 * @param {number} limit - Maximum artists to return
 * @returns {string[]} Array of unique artist names
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
 * 
 * @param {Array} seeds - Seed objects
 * @returns {string[]} Array of unique genres
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
 * 
 * @param {Array} seeds - Seed objects
 * @param {number} seedLimit - Maximum seeds to process
 * @param {Set} blacklist - Blacklisted artists
 * @param {Set} seenArtists - Already seen artists
 * @param {Map} tracksByArtist - Map of artist -> {artistName, tracks[]}
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
 * 
 * @param {string} artistName - Artist name to add
 * @param {Set} seenArtists - Set of already seen artists
 * @param {Set} blacklist - Set of blacklisted artists
 * @param {Array} candidates - Array to add candidate to
 */
function addArtistCandidate(artistName, seenArtists, blacklist, candidates) {
	if (!artistName) return;

	const key = String(artistName).trim().toUpperCase();
	if (!key || seenArtists.has(key) || blacklist.has(key)) return;

	seenArtists.add(key);
	candidates.push({ artist: artistName, tracks: [] });
}

/**
 * Fetch top tracks for candidate artists using Last.fm.
 * 
 * @param {object} modules - Module dependencies
 * @param {Array} candidates - Array of candidates to enrich
 * @param {object} config - Configuration settings
 */
async function fetchTracksForCandidates(modules, candidates, config) {
	const { api: { lastfmApi }, settings: { prefixes }, ui: { notifications } } = modules;
	const { fetchTopTracks } = lastfmApi;
	const { fixPrefixes } = prefixes;
	const { updateProgress } = notifications;

	const tracksPerArtist = config.tracksPerArtist || 10;
	const totalCandidates = candidates.length;

	console.log(`fetchTracksForCandidates: Fetching up to ${tracksPerArtist} tracks for ${totalCandidates} artists`);

	let artistsWithTracks = 0;
	let totalTracksFound = 0;

	for (let i = 0; i < totalCandidates; i++) {
		const candidate = candidates[i];

		// Skip special filter candidates
		if (candidate.artist.startsWith('__')) continue;

		// Skip if already has tracks (e.g., from track-based discovery)
		if (candidate.tracks && candidate.tracks.length > 0) continue;

		// Update progress every 5 artists
		if (i % 5 === 0) {
			const progress = 0.5 + ((i + 1) / totalCandidates) * 0.3;
			updateProgress(`Last.fm: Getting tracks for "${candidate.artist}" (${i + 1}/${totalCandidates})...`, progress);
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

				artistsWithTracks++;
				totalTracksFound += candidate.tracks.length;
			}
		} catch (e) {
			console.warn(`fetchTracksForCandidates: Error for "${candidate.artist}": ${e.message}`);
		}
	}

	console.log(`fetchTracksForCandidates: Retrieved ${totalTracksFound} tracks from ${artistsWithTracks} artists`);
}

/**
 * Get the appropriate discovery function for a mode.
 * 
 * @param {string} mode - Discovery mode constant
 * @returns {Function} Discovery function
 */
function getDiscoveryStrategy(mode) {
	switch (mode) {
		case DISCOVERY_MODES.TRACK:
			return discoverByTrack;
		case DISCOVERY_MODES.GENRE:
			return discoverByGenre;
		case DISCOVERY_MODES.ACOUSTICS:
			return discoverByRecco;
		case DISCOVERY_MODES.MOOD:
			return discoverByMood;
		case DISCOVERY_MODES.ACTIVITY:
			return discoverByActivity;
		case DISCOVERY_MODES.ARTIST:
		default:
			return discoverByArtist;
	}
}

/**
 * Get human-readable name for discovery mode.
 * 
 * @param {string} mode - Discovery mode constant
 * @returns {string} Human-readable name
 */
function getDiscoveryModeName(mode) {
	switch (mode) {
		case DISCOVERY_MODES.TRACK:
			return 'Similar Tracks';
		case DISCOVERY_MODES.ARTIST:
			return 'Similar Artist';
		case DISCOVERY_MODES.GENRE:
			return 'Similar Genre';
		case DISCOVERY_MODES.ACOUSTICS:
			return 'Similar Acoustics';
		case DISCOVERY_MODES.MOOD:
			return 'Mood';
		case DISCOVERY_MODES.ACTIVITY:
			return 'Activity';
		default: return 'Similar';
	}
}

/**
 * Helper to format numeric audio target values safely.
 */
function _formatVal(v) {
	if (v === null || v === undefined) return 'N/A';
	if (typeof v === 'number') return Number.isFinite(v) ? v.toFixed(2) : String(v);
	return String(v);
}

/**
 * Log and push progress messages for audio target properties.
 * Logs: energy, valence, danceability, tempo, loudness
 * 
 * @param {string} type - 'Mood' or 'Activity' (used in log)
 * @param {string} name - mood/activity name
 * @param {object} audioTargets - object containing audio target properties
 * @param {function} updateProgress - function to update UI progress (optional)
 */
function logAudioTargets(type, name, audioTargets, updateProgress) {
	try {
		if (!audioTargets || typeof audioTargets !== 'object') {
			console.log(`Discovery [${type}]: No audio targets available for "${name}"`);
			if (typeof updateProgress === 'function') updateProgress(`${type} "${name}": No audio targets`, 0.38);
			return;
		}

		const energy = _formatVal(audioTargets.energy);
		const valence = _formatVal(audioTargets.valence);
		const danceability = _formatVal(audioTargets.danceability);
		const tempo = _formatVal(audioTargets.tempo);
		const loudness = _formatVal(audioTargets.loudness);

		const msg = `Blended targets - energy: ${energy}, valence: ${valence}, danceability: ${danceability}, tempo: ${tempo}, loudness: ${loudness}`;

		console.log(`Discovery [${type}]: ${msg}`);
		if (typeof updateProgress === 'function') {
			updateProgress(`${type} "${name}": ${msg}`, 0.38);
		}
	} catch (e) {
		console.warn(`logAudioTargets error: ${e.message}`);
	}
}

// Export to window namespace for MM5
window.matchMonkeyDiscoveryStrategies = {
	DISCOVERY_MODES,
	discoverByArtist,
	discoverByTrack,
	discoverByGenre,
	discoverByRecco,
	discoverByMood,
	discoverByActivity,
	getDiscoveryStrategy,
	getDiscoveryModeName,
	buildBlacklist,
	extractSeedArtists,
	extractGenresFromSeeds,
};