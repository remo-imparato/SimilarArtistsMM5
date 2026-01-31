/**
 * SQL Query Building Utilities
 * 
 * Helpers for constructing safe SQL queries with proper escaping and filtering.

 */

'use strict';

/**
 * Escape single quotes for SQL queries.
 * @param {string} str String to escape.
 * @returns {string} Escaped string (single quotes doubled).
 */
function escapeSql(str) {
	return String(str ?? '').replace(/'/g, "''");
}

/**
 * Quote a string literal for SQL safely.
 * @param {*} s Value to quote.
 * @returns {string} SQL string literal.
 */
function quoteSqlString(s) {
	if (s === undefined || s === null) return "''";
	// Remove control chars that may break SQL/logging
	const cleaned = String(s).replace(/[\u0000-\u001F]/g, '');
	return `'${escapeSql(cleaned)}'`;
}

/**
 * Build a track key for deduplication.
 * Uses ID if available, falls back to path, then meta-combination.
 * @param {object} track Track object.
 * @returns {string} Unique track key.
 */
function getTrackKey(track) {
	if (!track) return '';
	const id = track.id || track.ID;
	if (id !== undefined && id !== null && String(id) !== '0') return String(id);
	if (track.path) return `path:${String(track.path)}`;
	// Fallback: combine title/album/artist
	return `meta:${String(track.title || track.SongTitle || '')}:${String(track.album || '')}:${String(track.artist || '')}`;
}

// Export to window namespace for MM5
window.matchMonkeySQL = {
	quoteSqlString,
	getTrackKey,
	escapeSql,
};

// Also export escapeSql and quoteSqlString globally for backward compatibility
window.escapeSql = escapeSql;
window.quoteSqlString = quoteSqlString;
