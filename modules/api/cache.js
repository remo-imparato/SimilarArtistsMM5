/**
 * Last.fm API Response Caching
 * 
 * Per-run caches for Last.fm queries (cleared on each runSimilarArtists invocation).
 * Reduces redundant API calls within a single operation.
 */

'use strict';

/**
 * Per-run cache structure containing:
 * - similarArtists: Map<string, object[]>
 * - topTracks: Map<string, (string|object)[]>
 */
let lastfmRunCache = null;

/**
 * Initialize the Last.fm per-run cache.
 * Call at the start of each runSimilarArtists operation.
 */
function initLastfmRunCache() {
	lastfmRunCache = {
		similarArtists: new Map(), // key: normalized artist name -> artists[]
		topTracks: new Map(), // key: normalized artist name + '|' + limit -> titles[]
	};
}

/**
 * Clear the Last.fm per-run cache.
 * Call at the end of runSimilarArtists operation.
 */
function clearLastfmRunCache() {
	lastfmRunCache = null;
}

/**
 * Get a cached similar artists list, or null if not cached.
 * @param {string} artistName Artist name.
 * @returns {object[]|null} Cached artists array, or null if not cached.
 */
function getCachedSimilarArtists(artistName) {
	const cacheKey = window.cacheKeyArtist(artistName);
	if (lastfmRunCache?.similarArtists?.has(cacheKey)) {
		return lastfmRunCache.similarArtists.get(cacheKey) || [];
	}
	return null;
}

/**
 * Cache a similar artists response.
 * @param {string} artistName Artist name.
 * @param {object[]} artists Array of similar artist objects.
 */
function cacheSimilarArtists(artistName, artists) {
	const cacheKey = window.cacheKeyArtist(artistName);
	if (lastfmRunCache?.similarArtists) {
		lastfmRunCache.similarArtists.set(cacheKey, artists || []);
	}
}

/**
 * Get a cached top tracks list, or null if not cached.
 * @param {string} artistName Artist name.
 * @param {number} limit Track limit.
 * @param {boolean} withPlaycount Whether playcount is included.
 * @returns {(string|object)[]|null} Cached tracks array, or null if not cached.
 */
function getCachedTopTracks(artistName, limit, withPlaycount = false) {
	const cacheKey = window.cacheKeyTopTracks(artistName, limit, withPlaycount);
	if (lastfmRunCache?.topTracks?.has(cacheKey)) {
		return lastfmRunCache.topTracks.get(cacheKey) || [];
	}
	return null;
}

/**
 * Cache a top tracks response.
 * @param {string} artistName Artist name.
 * @param {number} limit Track limit.
 * @param {boolean} withPlaycount Whether playcount is included.
 * @param {(string|object)[]} tracks Array of track titles or objects.
 */
function cacheTopTracks(artistName, limit, withPlaycount, tracks) {
	const cacheKey = window.cacheKeyTopTracks(artistName, limit, withPlaycount);
	if (lastfmRunCache?.topTracks) {
		lastfmRunCache.topTracks.set(cacheKey, tracks || []);
	}
}

/**
 * Check if caching is currently active.
 * @returns {boolean} True if Last.fm run cache is initialized.
 */
function isCacheActive() {
	return lastfmRunCache !== null;
}

// Export to window namespace for MM5
window.lastfmCache = {
	init: initLastfmRunCache,
	clear: clearLastfmRunCache,
	getCachedSimilarArtists: getCachedSimilarArtists,
	cacheSimilarArtists: cacheSimilarArtists,
	getCachedTopTracks: getCachedTopTracks,
	cacheTopTracks: cacheTopTracks,
	isActive: isCacheActive
};
