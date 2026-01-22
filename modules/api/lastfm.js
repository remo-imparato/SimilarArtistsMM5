/**
 * Last.fm API Query Functions
 * 
 * Fetches similar artists and top tracks from Last.fm API.
 * Works with per-run cache to avoid redundant API calls within a single operation.
 */

'use strict';

const { getApiKey } = require('../settings/lastfm');
const { updateProgress } = require('../ui/notifications');
const cache = require('./cache');
const { cacheKeyArtist, cacheKeyTopTracks } = require('../utils/normalization');

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
 * 
 * @example
 * const similar = await fetchSimilarArtists('Pink Floyd', 10);
 * // Returns: [{ name: 'David Gilmour', url: '...', image: [...] }, ...]
 */
async function fetchSimilarArtists(artistName, limit) {
	try {
		if (!artistName)
			return [];

		// Check cache first
		const cacheKey = cacheKeyArtist(artistName);
		const cached = cache.getCachedSimilarArtists(artistName);
		if (cached !== null) {
			console.log(`Similar Artists: fetchSimilarArtists: Using cached results for "${artistName}"`);
			return cached;
		}

		// Build API request
		const apiKey = getApiKey();
		const lim = Number(limit) || undefined;
		const params = new URLSearchParams({
			method: 'artist.getSimilar',
			api_key: apiKey,
			format: 'json',
			artist: artistName,
			autocorrect: '1'
		});
		if (lim)
			params.set('limit', String(lim));

		const url = API_BASE + '?' + params.toString();
		updateProgress(`Querying Last.fm API: getSimilar for "${artistName}"...`);
		console.log('Similar Artists: fetchSimilarArtists: querying ' + url);

		// Make HTTP request
		const res = await fetch(url);

		if (!res || !res.ok) {
			console.log(`fetchSimilarArtists: HTTP ${res?.status} ${res?.statusText} for ${artistName}`);
			updateProgress(`Failed to fetch similar artists for "${artistName}" (HTTP ${res?.status})`);
			cache.cacheSimilarArtists(artistName, []);
			return [];
		}

		// Parse JSON response
		let data;
		try {
			data = await res.json();
		} catch (e) {
			console.warn('Similar Artists: fetchSimilarArtists: invalid JSON response: ' + e.toString());
			updateProgress(`Error parsing Last.fm response for "${artistName}"`);
			cache.cacheSimilarArtists(artistName, []);
			return [];
		}

		// Check for API errors
		if (data?.error) {
			console.warn('Similar Artists: fetchSimilarArtists: API error: ' + (data.message || data.error));
			updateProgress(`Last.fm API error for "${artistName}": ${data.message || data.error}`);
			cache.cacheSimilarArtists(artistName, []);
			return [];
		}

		// Extract and normalize results
		const artists = data?.similarartists?.artist || [];
		let asArr = artists;
		if (!Array.isArray(asArr) && asArr) asArr = [asArr];
		
		console.log(`fetchSimilarArtists: Retrieved ${asArr.length} similar artists for "${artistName}"`);
		
		// Cache results for subsequent calls in this run
		cache.cacheSimilarArtists(artistName, asArr);
		
		return asArr;

	} catch (e) {
		console.error('Similar Artists: fetchSimilarArtists error: ' + e.toString());
		updateProgress(`Error fetching similar artists: ${e.toString()}`);
		try {
			cache.cacheSimilarArtists(artistName, []);
		} catch (_) {
			// ignore
		}
		return [];
	}
}

/**
 * Fetch top tracks for an artist from Last.fm API.
 * Results are cached within the current run to avoid redundant API calls.
 * 
 * Used for both collection mode (get top tracks for playlist) and
 * ranking mode (get many tracks for scoring).
 * 
 * @param {string} artistName Artist name to fetch top tracks for.
 * @param {number} limit Maximum number of tracks to return (optional).
 * @param {boolean} includePlaycount Whether to include playcount data (default: false).
 *                                     If true, returns array of {title, playcount} objects.
 *                                     If false, returns array of title strings.
 * @returns {Promise<(string|object)[]>} Array of track titles or track objects with playcount.
 *                                         Returns empty array on error.
 * 
 * @example
 * // For collection mode (just titles)
 * const topTracks = await fetchTopTracks('Pink Floyd', 10);
 * // Returns: ['Time', 'Money', 'Us and Them', ...]
 * 
 * // For ranking mode (with metadata)
 * const tracksWithMeta = await fetchTopTracks('Pink Floyd', 100, true);
 * // Returns: [{title: 'Time', playcount: 5000}, {title: 'Money', playcount: 4800}, ...]
 */
async function fetchTopTracks(artistName, limit, includePlaycount = false) {
	try {
		if (!artistName)
			return [];

		// Check cache first
		const cacheKey = cacheKeyTopTracks(artistName, limit, includePlaycount);
		const cached = cache.getCachedTopTracks(artistName, limit, includePlaycount);
		if (cached !== null) {
			console.log(`Similar Artists: fetchTopTracks: Using cached results for "${artistName}" (limit: ${limit})`);
			return cached;
		}

		// Build API request
		const apiKey = getApiKey();
		const lim = Number(limit) || undefined;
		const params = new URLSearchParams({
			method: 'artist.getTopTracks',
			api_key: apiKey,
			format: 'json',
			artist: artistName,
			autocorrect: '1'
		});
		if (lim)
			params.set('limit', String(lim));

		const url = API_BASE + '?' + params.toString();
		const purpose = (lim >= 100) ? 'for ranking' : 'for collection';
		updateProgress(`Querying Last.fm: getTopTracks ${purpose} for "${artistName}" (limit: ${lim || 'default'})...`);
		console.log(`Similar Artists: fetchTopTracks: querying ${url} (${purpose})`);

		// Make HTTP request
		const res = await fetch(url);
		if (!res || !res.ok) {
			console.log(`fetchTopTracks: HTTP ${res?.status} ${res?.statusText} for ${artistName}`);
			updateProgress(`Failed to fetch top tracks for "${artistName}" (HTTP ${res?.status})`);
			cache.cacheTopTracks(artistName, limit, includePlaycount, []);
			return [];
		}

		// Parse JSON response
		let data;
		try {
			data = await res.json();
		} catch (e) {
			console.warn('Similar Artists: fetchTopTracks: invalid JSON response: ' + e.toString());
			updateProgress(`Error parsing Last.fm response for "${artistName}"`);
			cache.cacheTopTracks(artistName, limit, includePlaycount, []);
			return [];
		}

		// Check for API errors
		if (data?.error) {
			console.warn('Similar Artists: fetchTopTracks: API error: ' + (data.message || data.error));
			updateProgress(`Last.fm API error for "${artistName}": ${data.message || data.error}`);
			cache.cacheTopTracks(artistName, limit, includePlaycount, []);
			return [];
		}

		// Extract and normalize results
		let tracks = data?.toptracks?.track || [];
		if (tracks && !Array.isArray(tracks)) tracks = [tracks];
		
		const rows = [];
		tracks.forEach((t) => {
			if (!t) return;
			const title = t.name || t.title;
			if (!title) return;
			
			if (includePlaycount) {
				const pc = Number(t.playcount) || 0;
				const rank = Number(t['@attr']?.rank) || 0;
				rows.push({ title, playcount: pc, rank });
			} else {
				rows.push(title);
			}
		});

		console.log(`fetchTopTracks: Retrieved ${rows.length} top tracks for "${artistName}" (${purpose})`);
		
		// Slice to requested limit and cache
		const out = typeof lim === 'number' ? rows.slice(0, lim) : rows;
		cache.cacheTopTracks(artistName, limit, includePlaycount, out);
		
		return out;

	} catch (e) {
		console.error('Similar Artists: fetchTopTracks error: ' + e.toString());
		updateProgress(`Error fetching top tracks: ${e.toString()}`);
		try {
			cache.cacheTopTracks(artistName, limit, includePlaycount, []);
		} catch (_) {
			// ignore
		}
		return [];
	}
}

module.exports = {
	fetchSimilarArtists,
	fetchTopTracks,
	API_BASE,
};
