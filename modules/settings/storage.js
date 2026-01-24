/**
 * Settings Storage Management
 * 
 * Get/set application settings persisted under the script namespace.
 * Handles type coercion for settings retrieval.
 * 
 * MediaMonkey 5 API Only
 * 
 * NOTE: Default values are set by init.js during addon initialization.
 *       This module only provides get/set helpers and type conversion.
 */

'use strict';

// Script namespace
const SCRIPT_ID = 'MatchMonkey';

/**
 * Read a setting stored under this script's namespace.
 * @param {string} key Setting name.
 * @param {*} fallback Value returned when setting is missing.
 * @returns {*} Stored value or fallback.
 */
function getSetting(key, fallback) {
	if (typeof app === 'undefined' || !app.getValue) {
		return fallback;
	}

	const allSettings = app.getValue(SCRIPT_ID, {});
	const val = allSettings[key];
	
	if (val === undefined || val === null) {
		return fallback;
	}

	return val;
}

/**
 * Persist a setting under this script's namespace.
 * Note: MM5's app.setValue stores the entire config object, not individual keys.
 * @param {string} key Setting name.
 * @param {*} value Setting value.
 */
function setSetting(key, value) {
	if (typeof app === 'undefined' || !app.setValue || !app.getValue) return;

	// MM5 stores settings as complete objects, so we need to:
	// 1. Get the current config object
	// 2. Update the specific key
	// 3. Save the entire object back
	const config = app.getValue(SCRIPT_ID, {});
	config[key] = value;
	app.setValue(SCRIPT_ID, config);
}

/**
 * Get a setting coerced to integer.
 * @param {string} key Setting key.
 * @param {number} [defaultValue=0] Default value if setting not found.
 * @returns {number} Integer value.
 */
function intSetting(key, defaultValue = 0) {
	const v = getSetting(key, undefined);
	
	// If setting doesn't exist, return default
	if (v === undefined || v === null) return defaultValue;
	
	// Handle number types directly
	if (typeof v === 'number') return v;
	
	// Convert strings to numbers
	const n = parseInt(String(v), 10);
	return Number.isFinite(n) ? n : defaultValue;
}

/**
 * Get a setting coerced to string.
 * @param {string} key Setting key.
 * @param {string} [defaultValue=''] Default value if setting not found.
 * @returns {string} String value.
 */
function stringSetting(key, defaultValue = '') {
	const v = getSetting(key, defaultValue);
	return v === null || v === undefined ? defaultValue : String(v);
}

/**
 * Get a setting coerced to boolean.
 * @param {string} key Setting key.
 * @param {boolean} [defaultValue=false] Default value if setting not found.
 * @returns {boolean} Boolean value.
 */
function boolSetting(key, defaultValue = false) {
	const val = getSetting(key, defaultValue);
	
	if (val === true || val === false) return val;
	
	if (typeof val === 'string') {
		const v = val.trim().toLowerCase();
		if (['true', '1', 'yes', 'on'].includes(v)) return true;
		if (['false', '0', 'no', 'off', ''].includes(v)) return false;
	}
	
	if (typeof val === 'number') return val !== 0;
	
	return Boolean(val);
}

/**
 * Get a setting as a list (CSV or array).
 * @param {string} key Setting key.
 * @returns {string[]} Array of values, or empty array if not found.
 */
function listSetting(key) {
	const raw = getSetting(key, '');
	// Use parseListSetting from helpers if available, otherwise inline
	if (window.matchMonkeyHelpers?.parseListSetting) {
		return window.matchMonkeyHelpers.parseListSetting(raw);
	}
	// Fallback inline implementation
	if (!raw) return [];
	if (Array.isArray(raw)) {
		return raw.map(s => String(s || '').trim()).filter(s => s.length > 0);
	}
	if (typeof raw === 'string') {
		return raw.split(',').map(s => s.trim()).filter(s => s.length > 0);
	}
	return [];
}

// Export to window namespace for MM5
window.matchMonkeyStorage = {
	getSetting,
	setSetting,
	intSetting,
	stringSetting,
	boolSetting,
	listSetting,
};
