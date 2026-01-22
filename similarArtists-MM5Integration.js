/**
 * SimilarArtists Add-on for MediaMonkey 5
 * 
 * Complete refactored implementation using modular architecture.
 * All phases (0-7) integrated into single entry point.
 * 
 * @author Remo Imparato
 * @version 2.0.0
 * @description Generates playlists or queues tracks from similar artists using Last.fm API.
 *              Supports automatic mode to queue similar tracks when approaching end of playlist.
 * 
 * @repository https://github.com/remo-imparato/SimilarArtistsMM5
 * @license MIT
 */

(function(globalArg) {
	'use strict';

	// ============================================================================
	// INITIALIZATION
	// ============================================================================

	// Import all modules
	const modules = require('./modules');
	const {
		config,
		settings: { storage },
		core: { orchestration, autoMode, mm5Integration },
	} = modules;

	// Create runtime state
	const appState = {
		mm5Integration: null,
		autoModeState: null,
		settingsUnsubscribe: null,
		started: false,
	};

	// ============================================================================
	// MAIN ENTRY POINTS (exported to global)
	// ============================================================================

	/**
	 * Run similar artists workflow.
	 * 
	 * Main entry point for the action handler.
	 * Calls Phase 5 orchestration directly.
	 * 
	 * @param {boolean} [autoModeFlag=false] - Whether running in auto-mode
	 * @returns {Promise<object>} Result from orchestration
	 */
	async function runSimilarArtists(autoModeFlag = false) {
		try {
			console.log(`SimilarArtists: Running (autoMode=${autoModeFlag})`);
			
			const result = await orchestration.generateSimilarPlaylist(modules, autoModeFlag);
			
			if (result.success) {
				console.log(`SimilarArtists: Success - added ${result.tracksAdded} tracks`);
			} else {
				console.error(`SimilarArtists: Failed - ${result.error}`);
			}
			
			return result;

		} catch (e) {
			console.error(`SimilarArtists: Error in runSimilarArtists: ${e.toString()}`);
			throw e;
		}
	}

	/**
	 * Toggle auto-mode on/off.
	 * 
	 * Called by toggle action handler.
	 * Updates settings and syncs listener.
	 */
	function toggleAuto() {
		try {
			console.log('SimilarArtists: Toggling auto-mode');

			if (!appState.autoModeState) {
				console.log('SimilarArtists: Auto-mode state not initialized');
				return;
			}

			// Get handlers
			const { getSetting, setSetting } = storage;
			const handler = createAutoTriggerHandler();

			// Toggle
			const newState = autoMode.toggleAutoMode(
				appState.autoModeState,
				getSetting,
				setSetting,
				handler,
				(enabled) => {
					console.log(`SimilarArtists: Auto-mode toggled to ${enabled ? 'enabled' : 'disabled'}`);
					// Update UI
					updateAutoModeUI(enabled);
				}
			);

			console.log(`SimilarArtists: Auto-mode is now ${newState ? 'enabled' : 'disabled'}`);

		} catch (e) {
			console.error(`SimilarArtists: Error in toggleAuto: ${e.toString()}`);
		}
	}

	/**
	 * Check if auto-mode is enabled.
	 * 
	 * @returns {boolean} True if auto-mode enabled
	 */
	function isAutoEnabled() {
		try {
			const { getSetting } = storage;
			return autoMode.isAutoModeEnabled(getSetting);
		} catch (e) {
			console.error(`SimilarArtists: Error checking auto-enabled: ${e.toString()}`);
			return false;
		}
	}

	// ============================================================================
	// AUTO-MODE SETUP
	// ============================================================================

	/**
	 * Create auto-trigger handler.
	 * 
	 * This is the callback invoked when playback near end.
	 * 
	 * @returns {Function} Handler function
	 */
	function createAutoTriggerHandler() {
		const { getSetting } = storage;
		const { showToast } = modules.ui.notifications;

		return autoMode.createAutoTriggerHandler({
			getSetting,
			generateSimilarPlaylist: (autoModeFlag) => orchestration.generateSimilarPlaylist(modules, autoModeFlag),
			showToast,
			isAutoModeEnabled: (s) => autoMode.isAutoModeEnabled(getSetting),
			threshold: 2,
			logger: console.log,
		});
	}

	/**
	 * Initialize auto-mode listener.
	 * 
	 * Sets up playback event listener if enabled.
	 */
	function initializeAutoMode() {
		try {
			console.log('SimilarArtists: Initializing auto-mode');

			const { getSetting } = storage;
			const handler = createAutoTriggerHandler();

			appState.autoModeState = autoMode.initializeAutoMode(
				getSetting,
				handler,
				console.log
			);

			console.log('SimilarArtists: Auto-mode initialized');

		} catch (e) {
			console.error(`SimilarArtists: Error initializing auto-mode: ${e.toString()}`);
		}
	}

	/**
	 * Shutdown auto-mode listener.
	 * 
	 * Detaches playback event listener.
	 */
	function shutdownAutoMode() {
		try {
			console.log('SimilarArtists: Shutting down auto-mode');

			if (appState.autoModeState) {
				autoMode.shutdownAutoMode(appState.autoModeState, console.log);
				appState.autoModeState = null;
			}

			console.log('SimilarArtists: Auto-mode shutdown complete');

		} catch (e) {
			console.error(`SimilarArtists: Error shutting down auto-mode: ${e.toString()}`);
		}
	}

	// ============================================================================
	// MM5 UI INTEGRATION
	// ============================================================================

	/**
	 * Update auto-mode UI (toolbar icon, menu state, etc).
	 * 
	 * Called when auto-mode state changes.
	 * 
	 * @param {boolean} enabled - New auto-mode state
	 */
	function updateAutoModeUI(enabled) {
		try {
			const { mm5Integration: integration } = appState;
			if (!integration) return;

			// Update toolbar icon
			const toolbarId = config.TOOLBAR_AUTO_ID || 'SimilarArtistsToggle';
			mm5Integration.updateToolbarIcon(toolbarId, enabled, console.log);

			// Update action state
			mm5Integration.updateActionState('SimilarArtistsToggleAuto', console.log);

		} catch (e) {
			console.error(`SimilarArtists: Error updating UI: ${e.toString()}`);
		}
	}

	/**
	 * Handle settings change event.
	 * 
	 * Called when user changes settings.
	 * Syncs auto-mode listener if needed.
	 */
	function onSettingsChanged() {
		try {
			console.log('SimilarArtists: Settings changed, syncing auto-mode');

			const { getSetting } = storage;
			const handler = createAutoTriggerHandler();

			autoMode.syncAutoModeListener(
				appState.autoModeState,
				getSetting,
				handler,
				console.log
			);

			// Update UI
			const enabled = isAutoEnabled();
			updateAutoModeUI(enabled);

		} catch (e) {
			console.error(`SimilarArtists: Error in onSettingsChanged: ${e.toString()}`);
		}
	}

	// ============================================================================
	// ADD-ON LIFECYCLE
	// ============================================================================

	/**
	 * Initialize add-on.
	 * 
	 * Called once on application startup.
	 * Sets up all modules and listeners.
	 */
	function start() {
		if (appState.started) {
			console.log('SimilarArtists: Already started');
			return;
		}

		appState.started = true;

		try {
			console.log('SimilarArtists: Starting add-on...');

			// Validate MM5 environment
			const mmStatus = mm5Integration.checkMM5Availability();
			if (!mmStatus.available) {
				console.error(`SimilarArtists: MM5 API not available. Missing: ${mmStatus.missing.join(', ')}`);
				return;
			}

			// Initialize MM5 integration
			appState.mm5Integration = mm5Integration.initializeIntegration({
				onRunSimilarArtists: () => runSimilarArtists(false),
				onToggleAuto: toggleAuto,
				isAutoEnabled: isAutoEnabled,
				onSettingChanged: onSettingsChanged,
				toolbarButtonId: config.TOOLBAR_AUTO_ID || 'SimilarArtistsToggle',
				logger: console.log,
			});

			// Initialize auto-mode
			initializeAutoMode();

			console.log('SimilarArtists: Add-on started successfully');

		} catch (e) {
			console.error(`SimilarArtists: Error during startup: ${e.toString()}`);
			appState.started = false;
		}
	}

	/**
	 * Shutdown add-on.
	 * 
	 * Called on application shutdown.
	 * Cleans up all listeners and state.
	 */
	function shutdown() {
		try {
			console.log('SimilarArtists: Shutting down...');

			// Shutdown MM5 integration
			if (appState.mm5Integration) {
				mm5Integration.shutdownIntegration(appState.mm5Integration, console.log);
				appState.mm5Integration = null;
			}

			// Shutdown auto-mode
			shutdownAutoMode();

			// Unsubscribe from settings
			if (appState.settingsUnsubscribe && typeof appState.settingsUnsubscribe === 'function') {
				appState.settingsUnsubscribe();
				appState.settingsUnsubscribe = null;
			}

			appState.started = false;
			console.log('SimilarArtists: Shutdown complete');

		} catch (e) {
			console.error(`SimilarArtists: Error during shutdown: ${e.toString()}`);
		}
	}

	// ============================================================================
	// EXPORT TO GLOBAL
	// ============================================================================

	/**
	 * Main SimilarArtists global object.
	 * 
	 * Exported to window for access by MM5 and action handlers.
	 */
	globalArg.SimilarArtists = {
		// Core entry points
		start,
		shutdown,
		runSimilarArtists,
		toggleAuto,
		isAutoEnabled,

		// Lifecycle
		isStarted: () => appState.started,

		// Status and info
		getState: () => ({
			started: appState.started,
			autoModeEnabled: isAutoEnabled(),
		}),

		// Module access (for advanced usage)
		modules,
		config,
	};

	console.log('SimilarArtists: Module loaded, call start() to initialize');

})(typeof window !== 'undefined' ? window : global);
