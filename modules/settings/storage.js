/**
 * Settings Storage Management
 * 
 * Get/set application settings persisted under the script namespace.
 * Handles type coercion and defaults for settings retrieval.
 */

'use strict';

const { SCRIPT_ID, DEFAULTS } = require('../config');
const { parseListSetting } = require('../utils/helpers');

/**
 * Read a setting stored under this script's namespace.
 * @param {string} key Setting name.
 * @param {*} fallback Value returned when setting is missing.
 * @returns {*} Stored value or fallback.
 */
function getSetting(key, fallback) {
	if (typeof app === 'undefined' || !app.getValue)
		return fallback;

	let val = app.getValue(SCRIPT_ID, {});
	val = val[key];
	switch (val) {
		case undefined:
		case null:
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
 * @returns {number} Integer value.
 */
function intSetting(key) {
	const v = getSetting(key, DEFAULTS[key]);
	// Rating and other numeric settings can come in as strings or as objects; be defensive
	if (v === undefined || v === null) return 0;
	if (typeof v === 'number') return v;
	const n = parseInt(String(v), 10);
	return Number.isFinite(n) ? n : 0;
}

/**
 * Get a setting coerced to string.
 * @param {string} key Setting key.
 * @returns {string} String value.
 */
function stringSetting(key) {
	return String(getSetting(key, DEFAULTS[key] || ''));
}

/**
 * Get a setting coerced to boolean.
 * @param {string} key Setting key.
 * @returns {boolean} Boolean value.
 */
function boolSetting(key) {
	const val = getSetting(key, DEFAULTS[key]);
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
 * @returns {string[]} Array of values.
 */
function listSetting(key) {
	const raw = getSetting(key, DEFAULTS[key]);
	return parseListSetting(raw);
}

module.exports = {
	getSetting,
	setSetting,
	intSetting,
	stringSetting,
	boolSetting,
	listSetting,
};
