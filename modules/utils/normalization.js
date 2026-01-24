/**
 * String Normalization Utilities
 * 
 * Functions for normalizing and comparing artist names and track titles.
 * Handles prefix variations (e.g., "The Beatles" vs "Beatles, The")
 * and fuzzy title matching with punctuation/whitespace normalization.
 * 
 * MediaMonkey 5 API Only
 */

'use strict';

/**
 * Normalize an artist name by trimming whitespace.
 * @param {string} name Artist name.
 * @returns {string} Trimmed name.
 */
function normalizeName(name) {
	return String(name || '').trim();
}

/**
 * Split a semicolon-delimited artist field into individual artist names.
 * MM5 stores multiple artists separated by semicolons.
 * @param {string} artistField Artist field from track (semicolon-separated).
 * @returns {string[]} Array of normalized artist names.
 */
function splitArtists(artistField) {
	return String(artistField || '')
		.split(';')
		.map(a => normalizeName(a))
		.filter(a => a.length > 0);
}

/**
 * Normalize a string for fuzzy title comparison in SQL.
 * Removes punctuation, whitespace, and converts special characters.
 * @param {string} name Title or name to normalize.
 * @returns {string} Uppercased string with punctuation/whitespace removed.
 */
function stripName(name) {
	if (!name) return '';
	let result = String(name).toUpperCase();
	
	// Replace common variations
	result = result.replace(/&/g, 'AND');
	result = result.replace(/\+/g, 'AND');
	result = result.replace(/ N /g, 'AND');
	result = result.replace(/'N'/gi, 'AND');
	
	// Remove punctuation and whitespace
	result = result.replace(/[\s.,;:\-_!'"`()[\]{}]/g, '');
	
	return result;
}

/**
 * Get a normalized cache key for artist names (uppercased and trimmed).
 * @param {string} name Artist name.
 * @returns {string} Cache key.
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

// Export individual functions to window namespace for MM5
// These are used directly by other modules
window.normalizeName = normalizeName;
window.splitArtists = splitArtists;
window.stripName = stripName;
window.cacheKeyArtist = cacheKeyArtist;
window.cacheKeyTopTracks = cacheKeyTopTracks;

// Also export as a namespace object for organized access
window.matchMonkeyNormalization = {
	normalizeName,
	splitArtists,
	stripName,
	cacheKeyArtist,
	cacheKeyTopTracks,
};
