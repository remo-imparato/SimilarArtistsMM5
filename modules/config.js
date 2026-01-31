/**
 * MatchMonkey Add-on Configuration
 * 
 * Centralized configuration constants and script identifiers.
 * 

 * 
 * NOTE: Default configuration values are defined in init.js
 *       and initialized when the addon is first loaded.
 */

'use strict';

// Script namespace used for settings, menu/action ids, and logging.
const SCRIPT_ID = 'MatchMonkey';

// Menu/action identifiers (used by MediaMonkey add-on framework when wiring UI actions).
const MENU_RUN_ID = `${SCRIPT_ID}.menu.run`;
const MENU_AUTO_ID = `${SCRIPT_ID}.menu.toggleAuto`;
const ACTION_RUN_ID = `${SCRIPT_ID}.run`;
const ACTION_AUTO_ID = `${SCRIPT_ID}.toggleAuto`;

// Toolbar button identifiers.
const TOOLBAR_RUN_ID = 'sa-run';
const TOOLBAR_AUTO_ID = 'sa-auto';

// Settings sheet identifier (Options page integration).
const SETTINGS_SHEET_ID = `${SCRIPT_ID}.settings`;

// Last.fm API base endpoint.
const API_BASE = 'https://ws.audioscrobbler.com/2.0/';

// Export to window namespace for MM5
window.matchMonkeyConfig = {
	SCRIPT_ID,
	MENU_RUN_ID,
	MENU_AUTO_ID,
	ACTION_RUN_ID,
	ACTION_AUTO_ID,
	TOOLBAR_RUN_ID,
	TOOLBAR_AUTO_ID,
	SETTINGS_SHEET_ID,
	API_BASE,
};
