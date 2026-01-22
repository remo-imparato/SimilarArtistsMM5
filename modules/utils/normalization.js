/**
 * String Normalization Utilities
 * 
 * Functions for normalizing and comparing artist names and track titles.
 * Handles prefix variations (e.g., "The Beatles" vs "Beatles, The")
 * and fuzzy title matching with punctuation/whitespace normalization.
 */

'use strict';

/**
 * Normalize an artist name by trimming whitespace.
 * @param {string} name Artist name.
 * @returns {string}
 */
function normalizeName(name) {
	return (name || '').trim();
}

/**
 * Split a semicolon-delimited artist field into individual artist names.
 * @param {string} artistField Artist field from track (semicolon-separated).
 * @returns {string[]} Array of normalized artist names.
 */
function splitArtists(artistField) {
	return String(artistField || '')
		.split(';')
		.map((a) => normalizeName(a))
		.filter((a) => a.length > 0);
}

/**
 * Normalize a string for fuzzy title comparison in SQL.
 * Removes punctuation, whitespace, and converts special characters.
 * @param {string} name Title or name to normalize.
 * @returns {string} Uppercased string with punctuation/whitespace removed.
 */
function stripName(name) {
	if (!name) return '';
	let result = name.toUpperCase();
	result = result.replace(/&/g, 'AND');
	result = result.replace(/\+/g, 'AND');
	result = result.replace(/ N /g, 'AND');
	result = result.replace(/'N'/g, 'AND');
	result = result.replace(/ /g, '');
	result = result.replace(/\./g, '');
	result = result.replace(/,/g, '');
	result = result.replace(/:/g, '');
	result = result.replace(/;/g, '');
	result = result.replace(/-/g, '');
	result = result.replace(/_/g, '');
	result = result.replace(/!/g, '');
	result = result.replace(/'/g, '');
	result = result.replace(/"/g, '');
	return result;
}

/**
 * Get the cache key for an artist name (uppercased and trimmed).
 * @param {string} name Artist name.
 * @returns {string} Cache key.
 */
function cacheKeyArtist(name) {
	return String(name || '').trim().toUpperCase();
}

/**
 * Get the cache key for top tracks (includes artist, limit, and playcount flag).
 * @param {string} artistName Artist name.
 * @param {number} limit Track limit.
 * @param {boolean} withPlaycount Whether playcount is included.
 * @returns {string} Cache key.
 */
function cacheKeyTopTracks(artistName, limit, withPlaycount = false) {
	return `${cacheKeyArtist(artistName)}|${Number(limit) || ''}|pc:${withPlaycount ? 1 : 0}`;
}

module.exports = {
	normalizeName,
	splitArtists,
	stripName,
	cacheKeyArtist,
	cacheKeyTopTracks,
};
