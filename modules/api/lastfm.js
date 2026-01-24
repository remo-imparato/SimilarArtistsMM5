/**
 * Last.fm API Query Functions
 * 
 * Fetches similar artists and top tracks from Last.fm API.
 * Works with per-run cache to avoid redundant API calls within a single operation.
 * 
 * MediaMonkey 5 API Only
 */

'use strict';

// Last.fm API base endpoint
const API_BASE = 'https://ws.audioscrobbler.com/2.0/';

/**
 * Fetch similar artists from Last.fm API.
 * Results are cached within the current run to avoid redundant API calls.
 * 
 * @param {string} artistName Main artist name to find similar artists for.
 * @param {number} limit Maximum number of similar artists to return (optional).
 * @returns {Promise<object[]>} Array of similar artist objects from Last.fm.
 *                              Returns empty array on error.
 */
async function fetchSimilarArtists(artistName, limit) {
	try {
		if (!artistName) return [];

		// Get dependencies
		const cache = window.lastfmCache;
		const getApiKey = window.matchMonkeyLastfm?.getApiKey;
		const updateProgress = window.matchMonkeyNotifications?.updateProgress || (() => {});

		// Check cache first
		if (cache?.getCachedSimilarArtists) {
			const cached = cache.getCachedSimilarArtists(artistName);
			if (cached !== null) {
				console.log(`fetchSimilarArtists: Using cached results for "${artistName}"`);
				return cached;
			}
		}

		// Build API request
		const apiKey = getApiKey ? getApiKey() : '7fd988db0c4e9d8b12aed27d0a91a932';
		const lim = Number(limit) || undefined;
		const params = new URLSearchParams({
			method: 'artist.getSimilar',
			api_key: apiKey,
			format: 'json',
			artist: artistName,
			autocorrect: '1'
		});
		if (lim) params.set('limit', String(lim));

		const url = API_BASE + '?' + params.toString();
		updateProgress(`Querying Last.fm API: getSimilar for "${artistName}"...`);
		console.log('fetchSimilarArtists: querying ' + url);

		// Make HTTP request using native fetch (MM5)
		const res = await fetch(url);

		if (!res || !res.ok) {
			console.log(`fetchSimilarArtists: HTTP ${res?.status} ${res?.statusText} for ${artistName}`);
			updateProgress(`Failed to fetch similar artists for "${artistName}" (HTTP ${res?.status})`);
			cache?.cacheSimilarArtists?.(artistName, []);
			return [];
		}

		// Parse JSON response
		let data;
		try {
			data = await res.json();
		} catch (e) {
			console.warn('fetchSimilarArtists: invalid JSON response: ' + e.toString());
			updateProgress(`Error parsing Last.fm response for "${artistName}"`);
			cache?.cacheSimilarArtists?.(artistName, []);
			return [];
		}

		// Check for API errors
		if (data?.error) {
			console.warn('fetchSimilarArtists: API error: ' + (data.message || data.error));
			updateProgress(`Last.fm API error for "${artistName}": ${data.message || data.error}`);
			cache?.cacheSimilarArtists?.(artistName, []);
			return [];
		}

		// Extract and normalize results
		const artists = data?.similarartists?.artist || [];
		let asArr = Array.isArray(artists) ? artists : (artists ? [artists] : []);
		
		console.log(`fetchSimilarArtists: Retrieved ${asArr.length} similar artists for "${artistName}"`);
		
		// Cache results for subsequent calls in this run
		cache?.cacheSimilarArtists?.(artistName, asArr);
		
		return asArr;

	} catch (e) {
		console.error('fetchSimilarArtists error: ' + e.toString());
		window.matchMonkeyNotifications?.updateProgress?.(`Error fetching similar artists: ${e.toString()}`);
		window.lastfmCache?.cacheSimilarArtists?.(artistName, []);
		return [];
	}
}

/**
 * Fetch top tracks for an artist from Last.fm API.
 * Results are cached within the current run to avoid redundant API calls.
 * 
 * @param {string} artistName Artist name to fetch top tracks for.
 * @param {number} limit Maximum number of tracks to return (optional).
 * @param {boolean} includePlaycount Whether to include playcount data (default: false).
 * @returns {Promise<(string|object)[]>} Array of track titles or track objects with playcount.
 */
async function fetchTopTracks(artistName, limit, includePlaycount = false) {
	try {
		if (!artistName) return [];

		// Get dependencies
		const cache = window.lastfmCache;
		const getApiKey = window.matchMonkeyLastfm?.getApiKey;
		const updateProgress = window.matchMonkeyNotifications?.updateProgress || (() => {});

		// Check cache first
		if (cache?.getCachedTopTracks) {
			const cached = cache.getCachedTopTracks(artistName, limit, includePlaycount);
			if (cached !== null) {
				console.log(`fetchTopTracks: Using cached results for "${artistName}" (limit: ${limit})`);
				return cached;
			}
		}

		// Build API request
		const apiKey = getApiKey ? getApiKey() : '7fd988db0c4e9d8b12aed27d0a91a932';
		const lim = Number(limit) || undefined;
		const params = new URLSearchParams({
			method: 'artist.getTopTracks',
			api_key: apiKey,
			format: 'json',
			artist: artistName,
			autocorrect: '1'
		});
		if (lim) params.set('limit', String(lim));

		const url = API_BASE + '?' + params.toString();
		const purpose = (lim >= 100) ? 'for ranking' : 'for collection';
		updateProgress(`Querying Last.fm: getTopTracks ${purpose} for "${artistName}" (limit: ${lim || 'default'})...`);
		console.log(`fetchTopTracks: querying ${url} (${purpose})`);

		// Make HTTP request using native fetch (MM5)
		const res = await fetch(url);
		if (!res || !res.ok) {
			console.log(`fetchTopTracks: HTTP ${res?.status} ${res?.statusText} for ${artistName}`);
			updateProgress(`Failed to fetch top tracks for "${artistName}" (HTTP ${res?.status})`);
			cache?.cacheTopTracks?.(artistName, limit, includePlaycount, []);
			return [];
		}

		// Parse JSON response
		let data;
		try {
			data = await res.json();
		} catch (e) {
			console.warn('fetchTopTracks: invalid JSON response: ' + e.toString());
			updateProgress(`Error parsing Last.fm response for "${artistName}"`);
			cache?.cacheTopTracks?.(artistName, limit, includePlaycount, []);
			return [];
		}

		// Check for API errors
		if (data?.error) {
			console.warn('fetchTopTracks: API error: ' + (data.message || data.error));
			updateProgress(`Last.fm API error for "${artistName}": ${data.message || data.error}`);
			cache?.cacheTopTracks?.(artistName, limit, includePlaycount, []);
			return [];
		}

		// Extract and normalize results
		let tracks = data?.toptracks?.track || [];
		if (tracks && !Array.isArray(tracks)) tracks = [tracks];
		
		const rows = [];
		for (const t of tracks) {
			if (!t) continue;
			const title = t.name || t.title;
			if (!title) continue;
			
			if (includePlaycount) {
				const pc = Number(t.playcount) || 0;
				const rank = Number(t['@attr']?.rank) || 0;
				rows.push({ title, playcount: pc, rank });
			} else {
				rows.push(title);
			}
		}

		console.log(`fetchTopTracks: Retrieved ${rows.length} top tracks for "${artistName}" (${purpose})`);
		
		// Slice to requested limit and cache
		const out = typeof lim === 'number' ? rows.slice(0, lim) : rows;
		cache?.cacheTopTracks?.(artistName, limit, includePlaycount, out);
		
		return out;

	} catch (e) {
		console.error('fetchTopTracks error: ' + e.toString());
		window.matchMonkeyNotifications?.updateProgress?.(`Error fetching top tracks: ${e.toString()}`);
		window.lastfmCache?.cacheTopTracks?.(artistName, limit, includePlaycount, []);
		return [];
	}
}

/**
 * Fetch similar tracks from Last.fm API using track.getSimilar.
 * This finds tracks that are musically similar to a given track,
 * which can discover tracks across different artists.
 * 
 * @param {string} artistName Artist name of the seed track.
 * @param {string} trackName Track title of the seed track.
 * @param {number} [limit=30] Maximum number of similar tracks to return.
 * @returns {Promise<object[]>} Array of similar track objects with artist and title.
 */
async function fetchSimilarTracks(artistName, trackName, limit = 30) {
	try {
		if (!artistName || !trackName) return [];

		// Get dependencies
		const cache = window.lastfmCache;
		const getApiKey = window.matchMonkeyLastfm?.getApiKey;
		const updateProgress = window.matchMonkeyNotifications?.updateProgress || (() => {});

		// Build cache key
		const cacheKey = `track:${artistName}|${trackName}|${limit}`.toUpperCase();

		// Check cache first
		if (cache?.isActive?.() && cache._similarTracks?.has?.(cacheKey)) {
			console.log(`fetchSimilarTracks: Using cached results for "${artistName} - ${trackName}"`);
			return cache._similarTracks.get(cacheKey) || [];
		}

		// Build API request
		const apiKey = getApiKey ? getApiKey() : '7fd988db0c4e9d8b12aed27d0a91a932';
		const params = new URLSearchParams({
			method: 'track.getSimilar',
			api_key: apiKey,
			format: 'json',
			artist: artistName,
			track: trackName,
			autocorrect: '1',
			limit: String(limit)
		});

		const url = API_BASE + '?' + params.toString();
		updateProgress(`Finding similar tracks to "${trackName}"...`);
		console.log(`fetchSimilarTracks: querying ${url}`);

		// Make HTTP request
		const res = await fetch(url);
		if (!res || !res.ok) {
			console.log(`fetchSimilarTracks: HTTP ${res?.status} for "${artistName} - ${trackName}"`);
			return [];
		}

		// Parse JSON response
		let data;
		try {
			data = await res.json();
		} catch (e) {
			console.warn('fetchSimilarTracks: invalid JSON: ' + e.toString());
			return [];
		}

		// Check for API errors
		if (data?.error) {
			console.warn('fetchSimilarTracks: API error: ' + (data.message || data.error));
			return [];
		}

		// Extract results
		let tracks = data?.similartracks?.track || [];
		if (tracks && !Array.isArray(tracks)) tracks = [tracks];

		const results = [];
		for (const t of tracks) {
			if (!t) continue;
			const title = t.name || t.title;
			const artist = t.artist?.name || t.artist;
			if (!title || !artist) continue;

			results.push({
				title,
				artist,
				match: Number(t.match) || 0, // Similarity score 0-1
				playcount: Number(t.playcount) || 0,
				url: t.url || ''
			});
		}

		console.log(`fetchSimilarTracks: Found ${results.length} similar tracks for "${artistName} - ${trackName}"`);

		// Cache results
		if (cache?.isActive?.()) {
			if (!cache._similarTracks) cache._similarTracks = new Map();
			cache._similarTracks.set(cacheKey, results);
		}

		return results;

	} catch (e) {
		console.error('fetchSimilarTracks error: ' + e.toString());
		return [];
	}
}

/**
 * Fetch artist info including tags/genres from Last.fm.
 * Useful for genre-based discovery.
 * 
 * @param {string} artistName Artist name to get info for.
 * @returns {Promise<object|null>} Artist info object with tags, or null on error.
 */
async function fetchArtistInfo(artistName) {
	try {
		if (!artistName) return null;

		const cache = window.lastfmCache;
		const getApiKey = window.matchMonkeyLastfm?.getApiKey;

		// Build cache key
		const cacheKey = `artistinfo:${artistName}`.toUpperCase();

		// Check cache
		if (cache?.isActive?.() && cache._artistInfo?.has?.(cacheKey)) {
			return cache._artistInfo.get(cacheKey);
		}

		// Build API request
		const apiKey = getApiKey ? getApiKey() : '7fd988db0c4e9d8b12aed27d0a91a932';
		const params = new URLSearchParams({
			method: 'artist.getInfo',
			api_key: apiKey,
			format: 'json',
			artist: artistName,
			autocorrect: '1'
		});

		const url = API_BASE + '?' + params.toString();
		console.log(`fetchArtistInfo: querying ${url}`);

		const res = await fetch(url);
		if (!res || !res.ok) return null;

		let data;
		try {
			data = await res.json();
		} catch (e) {
			return null;
		}

		if (data?.error) return null;

		const artist = data?.artist;
		if (!artist) return null;

		// Extract tags (genres)
		const tags = artist.tags?.tag || [];
		const tagList = Array.isArray(tags) ? tags : (tags ? [tags] : []);

		const result = {
			name: artist.name || artistName,
			tags: tagList.map(t => t.name || t).filter(Boolean),
			listeners: Number(artist.stats?.listeners) || 0,
			playcount: Number(artist.stats?.playcount) || 0,
			similar: (artist.similar?.artist || []).map(a => a.name || a).filter(Boolean),
			bio: artist.bio?.summary || ''
		};

		// Cache result
		if (cache?.isActive?.()) {
			if (!cache._artistInfo) cache._artistInfo = new Map();
			cache._artistInfo.set(cacheKey, result);
		}

		return result;

	} catch (e) {
		console.error('fetchArtistInfo error: ' + e.toString());
		return null;
	}
}

/**
 * Search for artists by tag/genre from Last.fm.
 * 
 * @param {string} tag Genre/tag to search for.
 * @param {number} [limit=30] Maximum artists to return.
 * @returns {Promise<object[]>} Array of artist objects.
 */
async function fetchArtistsByTag(tag, limit = 30) {
	try {
		if (!tag) return [];

		const getApiKey = window.matchMonkeyLastfm?.getApiKey;
		const apiKey = getApiKey ? getApiKey() : '7fd988db0c4e9d8b12aed27d0a91a932';

		const params = new URLSearchParams({
			method: 'tag.getTopArtists',
			api_key: apiKey,
			format: 'json',
			tag: tag,
			limit: String(limit)
		});

		const url = API_BASE + '?' + params.toString();
		console.log(`fetchArtistsByTag: querying ${url}`);

		const res = await fetch(url);
		if (!res || !res.ok) return [];

		let data;
		try {
			data = await res.json();
		} catch (e) {
			return [];
		}

		if (data?.error) return [];

		let artists = data?.topartists?.artist || [];
		if (!Array.isArray(artists)) artists = artists ? [artists] : [];

		return artists.map(a => ({
			name: a.name,
			url: a.url || '',
			listeners: Number(a.listeners) || 0
		})).filter(a => a.name);

	} catch (e) {
		console.error('fetchArtistsByTag error: ' + e.toString());
		return [];
	}
}

// Export to window namespace for MM5
window.matchMonkeyLastfmAPI = {
	fetchSimilarArtists,
	fetchTopTracks,
	fetchSimilarTracks,
	fetchArtistInfo,
	fetchArtistsByTag,
	API_BASE,
};
