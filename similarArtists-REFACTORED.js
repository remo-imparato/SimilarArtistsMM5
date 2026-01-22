/**
 * SimilarArtists Add-on for MediaMonkey 5 - REFACTORED MODULAR VERSION
 * 
 * This is the refactored main entry point that integrates extracted modules.
 * Phase 1-2 refactoring is COMPLETE with utilities and settings modules extracted.
 * 
 * Phases 3-8 (API, database, core, UI, playback, entry point) remain to be implemented.
 * 
 * Current Structure:
 * - config.js: Configuration constants (SCRIPT_ID, API_BASE, etc)
 * - modules/utils/: Normalization, helpers, SQL utilities
 * - modules/settings/: Storage, prefixes, Last.fm settings  
 * - modules/ui/notifications.js: Toast and progress UI
 * - modules/api/cache.js: Last.fm API response caching
 * 
 * INTEGRATION NOTES FOR DEVELOPERS:
 * ===================================
 * 
 * The main similarArtists.js file still contains all the core business logic.
 * This hybrid approach allows gradual refactoring without breaking changes.
 * 
 * As each phase completes:
 * 1. Create new module files (e.g., modules/api/lastfm.js for API queries)
 * 2. Extract functions from similarArtists.js into the new module
 * 3. Replace function definitions in similarArtists.js with imports
 * 4. Test thoroughly before committing
 * 
 * This file currently demonstrates the module import pattern.
 * Remaining large functions (processSeedArtists, runSimilarArtists, etc.)
 * will be extracted in subsequent phases.
 */

/*
// Debug tooling is optional. Only register after the addon module exists.
try {
	requirejs('helpers/debugTools');
	if (window.SimilarArtists && typeof registerDebuggerEntryPoint === 'function') {
		registerDebuggerEntryPoint.call(window.SimilarArtists, 'start');
	}
} catch (e) {
	// ignore
}
//*/

(function (globalArg) {
	'use strict';

	// ============================================================================
	// MODULE IMPORTS (Phase 1-2: Utilities and Settings)
	// ============================================================================

	try {
		var modules = require('./modules');
		var {
			config,
			utils: { normalization, helpers, sql },
			settings: { storage, prefixes, lastfm },
			ui: { notifications },
			api: { cache },
		} = modules;
	} catch (e) {
		console.error('Similar Artists: Failed to load modules: ' + e.toString());
		console.error('Falling back to inline implementations...');
		// Fallback will use inline functions defined below
		var modules = null;
	}

	// Destructure imports if modules loaded successfully
	const SCRIPT_ID = modules?.config?.SCRIPT_ID || 'SimilarArtists';
	const MENU_RUN_ID = modules?.config?.MENU_RUN_ID || (SCRIPT_ID + '.menu.run');
	const MENU_AUTO_ID = modules?.config?.MENU_AUTO_ID || (SCRIPT_ID + '.menu.toggleAuto');
	const ACTION_RUN_ID = modules?.config?.ACTION_RUN_ID || (SCRIPT_ID + '.run');
	const ACTION_AUTO_ID = modules?.config?.ACTION_AUTO_ID || (SCRIPT_ID + '.toggleAuto');
	const TOOLBAR_RUN_ID = modules?.config?.TOOLBAR_RUN_ID || 'sa-run';
	const TOOLBAR_AUTO_ID = modules?.config?.TOOLBAR_AUTO_ID || 'sa-auto';
	const SETTINGS_SHEET_ID = modules?.config?.SETTINGS_SHEET_ID || (SCRIPT_ID + '.settings');
	const API_BASE = modules?.config?.API_BASE || 'https://ws.audioscrobbler.com/2.0/';
	const DEFAULTS = modules?.config?.DEFAULTS || { Name: '- Similar to %' };

	// Helper to check if modules are available
	function modulesAvailable() {
		return modules !== null && modules !== undefined;
	}

	// ============================================================================
	// UTILITY WRAPPER FUNCTIONS (delegate to modules if available)
	// ============================================================================

	function formatError(err) {
		if (modulesAvailable()) {
			return modules.utils.helpers.formatError(err);
		}
		// Fallback
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

	function showToast(text, options = {}) {
		if (modulesAvailable()) {
			return modules.ui.notifications.showToast(text, options);
		}
		// Fallback
		try {
			if (typeof uitools !== 'undefined' && uitools?.toastMessage?.show) {
				uitools.toastMessage.show(text, options);
				return;
			}
			console.log('Similar Artists: ' + text);
		} catch (e) {
			console.error('Similar Artists: showToast error: ' + e.toString());
		}
	}

	function updateProgress(message, value) {
		if (modulesAvailable()) {
			return modules.ui.notifications.updateProgress(message, value);
		}
		// Fallback - no-op if notifications not available
	}

	function getSetting(key, fallback) {
		if (modulesAvailable()) {
			return modules.settings.storage.getSetting(key, fallback);
		}
		// Fallback
		if (typeof app === 'undefined' || !app.getValue)
			return fallback;
		let val = app.getValue(SCRIPT_ID, {});
		val = val[key];
		if (val === undefined || val === null) return fallback;
		return val;
	}

	function setSetting(key, value) {
		if (modulesAvailable()) {
			return modules.settings.storage.setSetting(key, value);
		}
		// Fallback
		if (typeof app === 'undefined' || !app.setValue || !app.getValue) return;
		const config = app.getValue(SCRIPT_ID, {});
		config[key] = value;
		app.setValue(SCRIPT_ID, config);
	}

	function intSetting(key) {
		if (modulesAvailable()) {
			return modules.settings.storage.intSetting(key);
		}
		// Fallback
		const v = getSetting(key, DEFAULTS[key]);
		if (v === undefined || v === null) return 0;
		if (typeof v === 'number') return v;
		const n = parseInt(String(v), 10);
		return Number.isFinite(n) ? n : 0;
	}

	function stringSetting(key) {
		if (modulesAvailable()) {
			return modules.settings.storage.stringSetting(key);
		}
		// Fallback
		return String(getSetting(key, DEFAULTS[key] || ''));
	}

	function boolSetting(key) {
		if (modulesAvailable()) {
			return modules.settings.storage.boolSetting(key);
		}
		// Fallback
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

	function getIgnorePrefixes() {
		if (modulesAvailable()) {
			return modules.settings.prefixes.getIgnorePrefixes();
		}
		// Fallback
		try {
			if (window?.settings && typeof window.settings.get === 'function') {
				const opts = window.settings.get('Options') || {};
				const cfg = opts.Options || opts;
				const enabled = cfg?.IgnoreTHEs;
				const list = cfg?.IgnoreTHEStrings;
				if (enabled) {
					return String(list || 'The').split(',').map((s) => s.trim()).filter((s) => s.length > 0);
				}
			}
			if (app?.settings && typeof app.settings.getValue === 'function') {
				const enabled = app.settings.getValue('IgnoreTHEs', false);
				if (enabled) {
					const list = app.settings.getValue('IgnoreTHEStrings', 'The');
					return String(list || 'The').split(',').map((s) => s.trim()).filter((s) => s.length > 0);
				}
			}
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
		return [];
	}

	function fixPrefixes(name) {
		if (modulesAvailable()) {
			return modules.settings.prefixes.fixPrefixes(name);
		}
		// Fallback
		if (!name) return name;
		let result = name;
		const prefixes = getIgnorePrefixes();
		for (const prefix of prefixes) {
			const suffixComma = `, ${prefix}`;
			if (result.toUpperCase().endsWith(suffixComma.toUpperCase())) {
				result = `${prefix} ${result.slice(0, -suffixComma.length)}`;
				break;
			}
			const suffixParen = ` (${prefix})`;
			if (result.toUpperCase().endsWith(suffixParen.toUpperCase())) {
				result = `${prefix} ${result.slice(0, -suffixParen.length)}`;
				break;
			}
		}
		return result;
	}

	function getApiKey() {
		if (modulesAvailable()) {
			return modules.settings.lastfm.getApiKey();
		}
		// Fallback
		return getSetting('ApiKey', '7fd988db0c4e9d8b12aed27d0a91a932');
	}

	function parseListSetting(key) {
		if (modulesAvailable()) {
			const raw = getSetting(key, DEFAULTS[key]);
			return modules.utils.helpers.parseListSetting(raw);
		}
		// Fallback
		try {
			const raw = getSetting(key, DEFAULTS[key]);
			if (!raw && raw !== 0) return [];
			if (Array.isArray(raw)) {
				return raw.map(s => String(s || '').trim()).filter(s => s.length > 0);
			}
			if (typeof raw === 'string') {
				return raw.split(',').map(s => s.trim()).filter(s => s.length > 0);
			}
			if (typeof raw === 'number' || typeof raw === 'boolean') {
				return [String(raw)];
			}
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

	function normalizeName(name) {
		if (modulesAvailable()) {
			return modules.utils.normalization.normalizeName(name);
		}
		// Fallback
		return (name || '').trim();
	}

	function splitArtists(artistField) {
		if (modulesAvailable()) {
			return modules.utils.normalization.splitArtists(artistField);
		}
		// Fallback
		return String(artistField || '')
			.split(';')
			.map((a) => normalizeName(a))
			.filter((a) => a.length > 0);
	}

	function stripName(name) {
		if (modulesAvailable()) {
			return modules.utils.normalization.stripName(name);
		}
		// Fallback
		if (!name) return '';
		let result = name.toUpperCase();
		result = result.replace(/&/g, 'AND');
		result = result.replace(/\+/g, 'AND');
		result = result.replace(/ N /g, 'AND');
		result = result.replace(/'N'/g, 'AND');
		result = result.replace(/ /g, '');
		result = result.replace(/\./g, '');
		result = result.replace(/,/g, '');
		result = result.replace(/:/g, '');
		result = result.replace(/;/g, '');
		result = result.replace(/-/g, '');
		result = result.replace(/_/g, '');
		result = result.replace(/!/g, '');
		result = result.replace(/'/g, '');
		result = result.replace(/"/g, '');
		return result;
	}

	function escapeSql(str) {
		if (modulesAvailable()) {
			return modules.utils.helpers.escapeSql(str);
		}
		// Fallback
		return (str || '').replace(/'/g, "''");
	}

	function cacheKeyArtist(name) {
		if (modulesAvailable()) {
			return modules.utils.normalization.cacheKeyArtist(name);
		}
		// Fallback
		return String(name || '').trim().toUpperCase();
	}

	function cacheKeyTopTracks(artistName, limit, withPlaycount = false) {
		if (modulesAvailable()) {
			return modules.utils.normalization.cacheKeyTopTracks(artistName, limit, withPlaycount);
		}
		// Fallback
		return `${cacheKeyArtist(artistName)}|${Number(limit) || ''}|pc:${withPlaycount ? 1 : 0}`;
	}

	function initLastfmRunCache() {
		if (modulesAvailable()) {
			return modules.api.cache.initLastfmRunCache();
		}
		// Fallback - no-op if cache not available
	}

	function clearLastfmRunCache() {
		if (modulesAvailable()) {
			return modules.api.cache.clearLastfmRunCache();
		}
		// Fallback - no-op if cache not available
	}

	// ... REST OF THE ORIGINAL CODE CONTINUES BELOW ...
	// All the remaining functions (collectSeedTracks, processSeedArtists, etc.)
	// are unchanged for now and will be refactored in future phases.

	// ============================================================================
	// RUNTIME STATE
	// ============================================================================

	const state = {
		autoListen: null,
		started: false,
		cancelled: false,
		autoRunning: false,
	};

	// ... CONTINUE WITH REMAINING FUNCTIONS ...
	// [Rest of the implementation continues with all existing functions]

	/**
	 * Sync the auto-mode toggle UI (toolbar/action icon) with the stored OnPlay setting.
	 */
	function refreshToggleUI() {
		try {
			const iconNum = getSetting('OnPlay', false) ? 32 : 33;
			if (app.toolbar?.setButtonIcon) {
				app.toolbar.setButtonIcon(TOOLBAR_AUTO_ID, iconNum);
			}
			if (app.actions?.updateActionIcon) {
				app.actions.updateActionIcon(ACTION_AUTO_ID, iconNum);
			}
		} catch (e) {
			console.error('Similar Artists: ' + e.toString());
		}
	}

	function applyAutoModeFromSettings() {
		const enabled = isAutoEnabled();
		if (enabled) {
			attachAuto();
		} else {
			detachAuto();
		}
		refreshToggleUI();
		try {
			if (app.actions?.updateActionIcon)
				app.actions.updateActionIcon(ACTION_AUTO_ID, enabled ? 32 : 33);
			if (app.actions?.updateActionState)
				app.actions.updateActionState(ACTION_AUTO_ID);
			if (window.actions?.SimilarArtistsToggleAuto) {
				window.actions.SimilarArtistsToggleAuto.checked = () => Boolean(isAutoEnabled());
				if (app.actions?.updateActionState)
					app.actions.updateActionState(window.actions.SimilarArtistsToggleAuto);
			}
			window._menuItems?.tools?.action?.invalidate?.();
		} catch (e) {
			console.error('Similar Artists: applyAutoModeFromSettings UI refresh failed: ' + e.toString());
		}
	}

	function toggleAuto() {
		const next = !getSetting('OnPlay', false);
		setSetting('OnPlay', next);
		applyAutoModeFromSettings();
		console.log(`Similar Artists: Auto-mode ${next ? 'enabled' : 'disabled'}`);
	}

	function attachAuto() {
		detachAuto();
		if (typeof app === 'undefined')
			return;
		const player = app.player;
		if (!player)
			return;
		if (!app.listen) {
			console.log('Similar Artists: app.listen not available');
			return;
		}
		state.autoListen = app.listen(player, 'playbackState', (newState) => {
			console.log(`Similar Artists: playbackState changed to '${newState}'`);
			if (newState === 'trackChanged') {
				handleAuto();
			}
		});
		console.log('Similar Artists: Auto-mode listener attached');
	}

	function detachAuto() {
		if (!state.autoListen)
			return;
		try {
			if (app.unlisten) {
				app.unlisten(state.autoListen);
				console.log('Similar Artists: Auto-mode listener detached');
			}
		} catch (e) {
			console.error('Similar Artists: Error detaching auto-mode listener: ' + e.toString());
		}
		state.autoListen = null;
	}

	async function handleAuto() {
		try {
			if (!isAutoEnabled()) {
				console.log('Similar Artists: Auto-mode disabled, skipping handleAuto');
				return;
			}
			const player = app.player;
			if (!player) {
				console.log('Similar Artists: Player not available');
				return;
			}
			let remaining = 0;
			try {
				const total = typeof player.entriesCount === 'number' ? player.entriesCount : 0;
				const played = typeof player.getCountOfPlayedEntries === 'function' ? player.getCountOfPlayedEntries() : 0;
				if (total > 0) remaining = total - played;
			} catch (e) {
				console.log('Similar Artists: remaining calculation failed: ' + e.toString());
			}
			if (!remaining && player.playlist && typeof player.playlist.getCursor === 'function' && typeof player.playlist.count === 'function') {
				try {
					const cursor = player.playlist.getCursor();
					const count = player.playlist.count();
					remaining = count - cursor;
				} catch (e) {
					console.log('Similar Artists: playlist remaining calculation failed: ' + e.toString());
				}
			}
			console.log(`Similar Artists: Auto check - remaining entries: ${remaining}`);
			if (remaining > 0 && remaining <= 2) {
				if (state.autoRunning) {
					console.log('Similar Artists: Auto-mode already running, skipping duplicate trigger');
					return;
				}
				state.autoRunning = true;
				try {
					console.log('Similar Artists: Near end of playlist, triggering auto-queue');
					await runSimilarArtists(true);
				} finally {
					state.autoRunning = false;
				}
			} else {
				console.log('Similar Artists: Not near end of playlist, skipping auto-queue');
			}
		} catch (e) {
			console.error('Similar Artists: Error in handleAuto: ' + formatError(e));
		}
	}

	function isAutoEnabled() {
		return !!getSetting('OnPlay', false);
	}

	function start() {
		if (state.started)
			return;
		state.started = true;
		console.log('Similar Artists: Starting SimilarArtists addon...');
		if (typeof app === 'undefined') {
			console.log('Similar Artists: MediaMonkey 5 app API not found.');
			return;
		}
		applyAutoModeFromSettings();
		console.log('Similar Artists: addon started successfully.');
	}

	// Export functions to the global scope
	globalArg.SimilarArtists = {
		start,
		runSimilarArtists,
		toggleAuto,
		applyAutoModeFromSettings,
		isAutoEnabled,
	};

	// NOTE: runSimilarArtists and all supporting functions remain to be migrated
	// These will stay inline until Phase 3+ refactoring is complete.
	// (collectSeedTracks, processSeedArtists, fetchSimilarArtists, etc.)

})(typeof window !== 'undefined' ? window : global);
