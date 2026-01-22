/**
 * Artist Name Prefix Management
 * 
 * Handles MediaMonkey's "Ignore THE" feature to normalize artist names
 * for Last.fm API queries and comparisons.
 */

'use strict';

const { listSetting } = require('./storage');

/**
 * Get the list of prefix strings to ignore (e.g., "The", "A")
 * Reads from MediaMonkey's Options settings.
 * @returns {string[]} Array of prefixes.
 */
function getIgnorePrefixes() {
	try {
		// 1) Preferred source used by core UI panels
		if (window?.settings && typeof window.settings.get === 'function') {
			const opts = window.settings.get('Options') || {};
			// Some callers store under an Options wrapper, others directly on the object.
			const cfg = opts.Options || opts;
			const enabled = cfg?.IgnoreTHEs;
			const list = cfg?.IgnoreTHEStrings;
			if (enabled) {
				return String(list || 'The').split(',').map((s) => s.trim()).filter((s) => s.length > 0);
			}
		}

		// 2) MM app.settings API (fallback)
		if (app?.settings && typeof app.settings.getValue === 'function') {
			const enabled = app.settings.getValue('IgnoreTHEs', false);
			if (enabled) {
				const list = app.settings.getValue('IgnoreTHEStrings', 'The');
				return String(list || 'The').split(',').map((s) => s.trim()).filter((s) => s.length > 0);
			}
		}

		// 3) Generic app.getValue (another possible storage location)
		if (app?.getValue && typeof app.getValue === 'function') {
			const opts = app.getValue('Options', {}) || {};
			const cfg = opts.Options || opts;
			const enabled = cfg?.IgnoreTHEs;
			const list = cfg?.IgnoreTHEStrings;
			if (enabled) {
				return String(list || 'The').split(',').map((s) => s.trim()).filter((s) => s.length > 0);
			}
		}
	} catch (e) {
		console.error('Similar Artists: getIgnorePrefixes error: ' + e.toString());
	}
	// Default: no prefixes ignored
	return [];
}

/**
 * Fix artist name prefixes for Last.fm API queries.
 * Converts "Beatles, The" or "Beatles (The)" back to "The Beatles"
 * based on MediaMonkey's ignore prefixes setting.
 * @param {string} name Artist name to fix.
 * @returns {string} Fixed artist name suitable for Last.fm API.
 */
function fixPrefixes(name) {
	if (!name) return name;
	let result = name;
	const prefixes = getIgnorePrefixes();

	for (const prefix of prefixes) {
		// Check for "Artist, The" format
		const suffixComma = `, ${prefix}`;
		if (result.toUpperCase().endsWith(suffixComma.toUpperCase())) {
			result = `${prefix} ${result.slice(0, -suffixComma.length)}`;
			break;
		}
		// Check for "Artist (The)" format
		const suffixParen = ` (${prefix})`;
		if (result.toUpperCase().endsWith(suffixParen.toUpperCase())) {
			result = `${prefix} ${result.slice(0, -suffixParen.length)}`;
			break;
		}
	}
	return result;
}

module.exports = {
	getIgnorePrefixes,
	fixPrefixes,
};
