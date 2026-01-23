/**
 * Settings Storage Management
 * 
 * Get/set application settings persisted under the script namespace.
 * Handles type coercion for settings retrieval.
 * 
 * NOTE: Default values are set by install.js during addon installation.
 *       This module only provides get/set helpers and type conversion.
 */

'use strict';

// Load dependencies from window namespace
const SCRIPT_ID = () => window.similarArtistsConfig.SCRIPT_ID;
const parseListSetting = () => window.similarArtistsHelpers.parseListSetting;

/**
 * Read a setting stored under this script's namespace.
 * @param {string} key Setting name.
 * @param {*} fallback Value returned when setting is missing.
 * @returns {*} Stored value or fallback.
 */
function getSetting(key, fallback) {
	if (typeof app === 'undefined' || !app.getValue)
		return fallback;

	const allSettings = app.getValue(SCRIPT_ID(), {});
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
	const config = app.getValue(SCRIPT_ID(), {});
	config[key] = value;
	app.setValue(SCRIPT_ID(), config);
}

/**
 * Get a setting coerced to integer.
 * @param {string} key Setting key.
 * @returns {number} Integer value, or 0 if not found.
 */
function intSetting(key) {
	const v = getSetting(key, undefined);
	
	// If setting doesn't exist, return 0
	if (v === undefined || v === null) return 0;
	
	// Handle number types directly
	if (typeof v === 'number') return v;
	
	// Convert strings to numbers
	const n = parseInt(String(v), 10);
	return Number.isFinite(n) ? n : 0;
}

/**
 * Get a setting coerced to string.
 * @param {string} key Setting key.
 * @returns {string} String value, or empty string if not found.
 */
function stringSetting(key) {
	const v = getSetting(key, '');
	return v === null || v === undefined ? '' : String(v);
}

/**
 * Get a setting coerced to boolean.
 * @param {string} key Setting key.
 * @returns {boolean} Boolean value, or false if not found.
 */
function boolSetting(key) {
	const val = getSetting(key, false);
	
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
	return parseListSetting()(raw);
}

// Export to window namespace for MM5
window.similarArtistsStorage = {
	getSetting,
	setSetting,
	intSetting,
	stringSetting,
	boolSetting,
	listSetting,
};
