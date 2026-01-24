/**
 * Last.fm API Response Caching
 * 
 * Per-run caches for Last.fm queries (cleared on each runMatchMonkey invocation).
 * Reduces redundant API calls within a single operation.
 * 
 * MediaMonkey 5 API Only
 */

'use strict';

/**
 * Per-run cache structure containing:
 * - similarArtists: Map<string, object[]>
 * - topTracks: Map<string, (string|object)[]>
 */
let lastfmRunCache = null;

/**
 * Get a normalized cache key for artist names.
 * @param {string} name Artist name.
 * @returns {string} Normalized cache key (uppercase, trimmed).
 */
function cacheKeyArtist(name) {
	return String(name || '').trim().toUpperCase();
}

/**
 * Get a cache key for top tracks (includes artist, limit, and playcount flag).
 * @param {string} artistName Artist name.
 * @param {number} limit Track limit.
 * @param {boolean} withPlaycount Whether playcount is included.
 * @returns {string} Cache key.
 */
function cacheKeyTopTracks(artistName, limit, withPlaycount = false) {
	return `${cacheKeyArtist(artistName)}|${Number(limit) || ''}|pc:${withPlaycount ? 1 : 0}`;
}

/**
 * Initialize the Last.fm per-run cache.
 * Call at the start of each runMatchMonkey operation.
 */
function initLastfmRunCache() {
	lastfmRunCache = {
		similarArtists: new Map(),
		topTracks: new Map(),
	};
}

/**
 * Clear the Last.fm per-run cache.
 * Call at the end of runMatchMonkey operation.
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
	if (!lastfmRunCache?.matchMonkey) return null;
	const key = cacheKeyArtist(artistName);
	return lastfmRunCache.matchMonkey.has(key) 
		? lastfmRunCache.matchMonkey.get(key) 
		: null;
}

/**
 * Cache a similar artists response.
 * @param {string} artistName Artist name.
 * @param {object[]} artists Array of similar artist objects.
 */
function cacheSimilarArtists(artistName, artists) {
	if (!lastfmRunCache?.matchMonkey) return;
	const key = cacheKeyArtist(artistName);
	lastfmRunCache.matchMonkey.set(key, artists || []);
}

/**
 * Get a cached top tracks list, or null if not cached.
 * @param {string} artistName Artist name.
 * @param {number} limit Track limit.
 * @param {boolean} withPlaycount Whether playcount is included.
 * @returns {(string|object)[]|null} Cached tracks array, or null if not cached.
 */
function getCachedTopTracks(artistName, limit, withPlaycount = false) {
	if (!lastfmRunCache?.topTracks) return null;
	const key = cacheKeyTopTracks(artistName, limit, withPlaycount);
	return lastfmRunCache.topTracks.has(key) 
		? lastfmRunCache.topTracks.get(key) 
		: null;
}

/**
 * Cache a top tracks response.
 * @param {string} artistName Artist name.
 * @param {number} limit Track limit.
 * @param {boolean} withPlaycount Whether playcount is included.
 * @param {(string|object)[]} tracks Array of track titles or objects.
 */
function cacheTopTracks(artistName, limit, withPlaycount, tracks) {
	if (!lastfmRunCache?.topTracks) return;
	const key = cacheKeyTopTracks(artistName, limit, withPlaycount);
	lastfmRunCache.topTracks.set(key, tracks || []);
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
	getCachedSimilarArtists,
	cacheSimilarArtists,
	getCachedTopTracks,
	cacheTopTracks,
	isActive: isCacheActive,
};

// Also export cache key functions globally for other modules
window.cacheKeyArtist = cacheKeyArtist;
window.cacheKeyTopTracks = cacheKeyTopTracks;
