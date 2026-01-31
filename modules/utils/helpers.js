/**
 * General Helper Utilities
 * 
 * Common utilities for error formatting, shuffling, parsing, and other helper functions.

 */

'use strict';

/** Clean album name by removing edition markers and suffixes.
 * @param {string} name - Original album name
 * @returns {string} Cleaned album name
 */
//
// FULL CANONICAL CLEANER
// Track, Album, Artist normalization for deterministic matching
//

function canonicalizeString(str) {
	if (!str) return "";

	let s = str;

	// Normalize Unicode (remove accents, weird spacing)
	s = s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");

	// Remove zero-width, non-breaking, control chars
	s = s.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, "");

	// Normalize punctuation to ASCII
	s = s
		.replace(/[–—]/g, "-")
		.replace(/[’‘]/g, "'")
		.replace(/[“”]/g, '"')
		.replace(/\u2026/g, "...");

	// Remove emojis and decorative symbols
	s = s.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "");

	// Collapse multiple spaces
	s = s.replace(/\s{2,}/g, " ");

	return s.trim();
}

//
// ARTIST CLEANER
//
function cleanArtistName(name) {
	if (!name) return "";

	let s = canonicalizeString(name);

	// Normalize "Beatles, The" → "The Beatles"
	const m = s.match(/(.+),\s*The$/i);
	if (m) {
		s = `The ${m[1]}`;
	}

	// Normalize "and" vs "&"
	s = s.replace(/\band\b/gi, "&");

	// Remove trailing punctuation
	s = s.replace(/[-:,;]+$/g, "");

	return s.trim();
}

//
// TRACK CLEANER
//
function cleanTrackName(name) {
	if (!name) return "";

	let s = canonicalizeString(name);

	// Remove leading track numbers: "01 - ", "1.", "01 "
	s = s.replace(/^\s*\d+\s*[-.]\s*/g, "");
	s = s.replace(/^\s*\d+\s+/g, "");

	// Remove feature tags
	s = s.replace(/\((feat\.?|featuring|ft\.?|with)\s+[^)]+\)/gi, "");
	s = s.replace(/[-–—]\s*(feat\.?|featuring|ft\.?|with)\s+.+$/gi, "");
	s = s.replace(/\s+(feat\.?|featuring|ft\.?|with)\s+.+$/gi, "");

	// Normalize Part/Pt/Pts
	s = s.replace(/\b(Pts?|Parts?)\.?\b/gi, "Part");

	// Normalize Roman numerals (I–X) → Arabic
	const romanMap = {
		I: 1, II: 2, III: 3, IV: 4, V: 5,
		VI: 6, VII: 7, VIII: 8, IX: 9, X: 10
	};
	s = s.replace(/\b(I|II|III|IV|V|VI|VII|VIII|IX|X)\b/g, m => romanMap[m]);

	// Remove edition/version/remaster tags
	s = s.replace(/\(([^)]*(remaster|deluxe|edition|version|mix|edit|live|acoustic|demo|instrumental)[^)]*)\)/gi, "");
	s = s.replace(/\[([^]]*(remaster|deluxe|edition|version|mix|edit|live|acoustic|demo|instrumental)[^]]*)\]/gi, "");

	// Remove "Live at...", "Live from..."
	s = s.replace(/\bLive\s+(at|from)\b.+$/gi, "");

	// Remove trailing punctuation
	s = s.replace(/[-:,;]+$/g, "");

	// Collapse spaces
	s = s.replace(/\s{2,}/g, " ");

	return s.trim();
}

//
// ALBUM CLEANER
//
function cleanAlbumName(name) {
	if (!name) return "";

	let s = canonicalizeString(name);

	// Remove edition/version/remaster tags
	s = s.replace(/\(([^)]*(deluxe|edition|remaster|expanded|anniversary|bonus|special)[^)]*)\)/gi, "");
	s = s.replace(/\[([^]]*(deluxe|edition|remaster|expanded|anniversary|bonus|special)[^]]*)\]/gi, "");

	// Remove disc/volume indicators
	s = s.replace(/\b(Disc|CD|Vol\.?|Volume)\s*\d+\b/gi, "");

	// Remove catalog numbers
	s = s.replace(/\[[A-Za-z0-9\-]+\]/g, "");
	s = s.replace(/\([A-Za-z0-9\-]+\)/g, "");

	// Normalize punctuation
	s = s.replace(/[-:,;]+$/g, "");

	// Collapse spaces
	s = s.replace(/\s{2,}/g, " ");

	return s.trim();
}

//
// FULL PIPELINE
//
function cleanMetadata({ track, album, artist }) {
	return {
		track: cleanTrackName(track),
		album: cleanAlbumName(album),
		artist: cleanArtistName(artist)
	};
}

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
 * In-place Fisher-Yates shuffle for random reordering.
 * @param {any[]} arr Array to shuffle.
 */
function shuffle(arr) {
	if (!arr || arr.length <= 1)
		return arr;
	for (let i = arr.length - 1; i > 0; --i) {
		const j = Math.floor(Math.random() * (i + 1));
		const temp = arr[i];
		arr[i] = arr[j];
		arr[j] = temp;
	}
	return arr;
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
		} catch (_) { /* ignore */ }

		return [];
	} catch (e) {
		console.error('Match Monkey: parseListSetting error: ' + e.toString());
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
	return String(str ?? '').replace(/'/g, "''");
}

/**
 * Debounce a function call.
 * @param {Function} fn Function to debounce.
 * @param {number} delay Delay in milliseconds.
 * @returns {Function} Debounced function.
 */
function debounce(fn, delay) {
	let timer = null;
	return function (...args) {
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => {
			fn.apply(this, args);
			timer = null;
		}, delay);
	};
}

// Export to window namespace for MM5
window.matchMonkeyHelpers = {
	cleanAlbumName,
	cleanArtistName,
	cleanTrackName,
	formatError,
	shuffle,
	parseListSetting,
	sleep,
	escapeSql,
	debounce,
};
