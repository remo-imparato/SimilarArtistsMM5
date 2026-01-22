/**
 * SQL Query Building Utilities
 * 
 * Helpers for constructing safe SQL queries with proper escaping and filtering.
 */

'use strict';

const { escapeSql } = require('./helpers');

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

module.exports = {
	quoteSqlString,
	getTrackKey,
	escapeSql,
};
