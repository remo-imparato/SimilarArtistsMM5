/**
 * General Helper Utilities
 * 
 * Common utilities for error formatting, shuffling, parsing, and other helper functions.
 */

'use strict';

/**
 * Normalize errors for logging.
 * Extracts stack trace, message, or stringifies error object.
 * @param {*} err Error object or value.
 * @returns {string} Formatted error string.
 */
function formatError(err) {
	try {
		if (!err) return 'Unknown error';
		if (err.stack) return String(err.stack);
		if (err.message) return `${err.name ? err.name + ': ' : ''}${err.message}`;
		if (typeof err === 'object') return JSON.stringify(err);
		return String(err);
	} catch (_) {
		return String(err);
	}
}

/**
 * In-place Fisher–Yates shuffle for random reordering.
 * @param {any[]} arr Array to shuffle.
 */
function shuffle(arr) {
	if (!arr || arr.length <= 1) return;
	for (let i = arr.length - 1; i > 0; --i) {
		const j = Math.floor(Math.random() * (i + 1));
		const temp = arr[i];
		arr[i] = arr[j];
		arr[j] = temp;
	}
}

/**
 * Parse a comma-separated string setting into an array.
 * Accepts either a string (CSV) or an array stored in settings.
 * @param {*} raw Raw setting value (string, array, number, etc).
 * @returns {string[]} Array of trimmed, non-empty strings.
 */
function parseListSetting(raw) {
	try {
		if (!raw && raw !== 0) return [];
		
		// If already an array, normalize elements to trimmed strings
		if (Array.isArray(raw)) {
			return raw.map(s => String(s || '').trim()).filter(s => s.length > 0);
		}
		
		// If it's a string, split on commas
		if (typeof raw === 'string') {
			return raw.split(',').map(s => s.trim()).filter(s => s.length > 0);
		}
		
		// If it's a number or other primitive, convert to string
		if (typeof raw === 'number' || typeof raw === 'boolean') {
			return [String(raw)];
		}
		
		// If it's an object with a toString producing CSV, try that
		try {
			const s = String(raw);
			if (s.indexOf(',') >= 0) return s.split(',').map(x => x.trim()).filter(x => x.length > 0);
			if (s.length) return [s.trim()];
		} catch (e) { }
		
		return [];
	} catch (e) {
		console.error('Similar Artists: parseListSetting error: ' + e.toString());
		return [];
	}
}

/**
 * Sleep for a specified duration (async utility).
 * @param {number} ms Milliseconds to sleep.
 * @returns {Promise<void>}
 */
function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Escape single quotes for SQL queries.
 * @param {string} str String to escape.
 * @returns {string} Escaped string (single quotes doubled).
 */
function escapeSql(str) {
	return (str || '').replace(/'/g, "''");
}

module.exports = {
	formatError,
	shuffle,
	parseListSetting,
	sleep,
	escapeSql,
};
