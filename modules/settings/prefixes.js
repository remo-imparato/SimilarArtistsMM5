/**
 * Artist Name Prefix Management
 * 
 * Handles MediaMonkey's "Ignore THE" feature to normalize artist names
 * for Last.fm API queries and comparisons.
 * 

 */

'use strict';

/**
 * Get the list of prefix strings to ignore (e.g., "The", "A").
 * Reads from MediaMonkey's Options settings.
 * @returns {string[]} Array of prefixes.
 */
function getIgnorePrefixes() {
	try {
		// Method 1: window.settings.get (MM5 preferred)
		if (window?.settings && typeof window.settings.get === 'function') {
			const opts = window.settings.get('Options') || {};
			const cfg = opts.Options || opts;
			if (cfg?.IgnoreTHEs) {
				const list = cfg.IgnoreTHEStrings || 'The';
				return String(list).split(',').map(s => s.trim()).filter(s => s.length > 0);
			}
		}

		// Method 2: app.settings.getValue (MM5 fallback)
		if (typeof app !== 'undefined' && app?.settings?.getValue) {
			const enabled = app.settings.getValue('IgnoreTHEs', false);
			if (enabled) {
				const list = app.settings.getValue('IgnoreTHEStrings', 'The');
				return String(list || 'The').split(',').map(s => s.trim()).filter(s => s.length > 0);
			}
		}

		// Method 3: app.getValue (MM5 another possible location)
		if (typeof app !== 'undefined' && app?.getValue) {
			const opts = app.getValue('Options', {}) || {};
			const cfg = opts.Options || opts;
			if (cfg?.IgnoreTHEs) {
				const list = cfg.IgnoreTHEStrings || 'The';
				return String(list).split(',').map(s => s.trim()).filter(s => s.length > 0);
			}
		}
	} catch (e) {
		console.error('Match Monkey: getIgnorePrefixes error: ' + e.toString());
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
	
	let result = String(name).trim();
	const prefixes = getIgnorePrefixes();

	for (const prefix of prefixes) {
		const p = String(prefix).trim();
		if (!p) continue;
		
		// Check for "Artist, The" format
		const suffixComma = `, ${p}`;
		if (result.toLowerCase().endsWith(suffixComma.toLowerCase())) {
			result = `${p} ${result.slice(0, -suffixComma.length)}`;
			break;
		}
		
		// Check for "Artist (The)" format
		const suffixParen = ` (${p})`;
		if (result.toLowerCase().endsWith(suffixParen.toLowerCase())) {
			result = `${p} ${result.slice(0, -suffixParen.length)}`;
			break;
		}
	}
	
	return result;
}

// Export to window namespace for MM5
window.matchMonkeyPrefixes = {
	getIgnorePrefixes,
	fixPrefixes,
};

// Also export fixPrefixes globally for backward compatibility
window.fixPrefixes = fixPrefixes;
window.getIgnorePrefixes = getIgnorePrefixes;
