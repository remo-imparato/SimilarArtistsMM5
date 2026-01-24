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

	// Preserve any early queued start calls from a previously-created placeholder
	// (e.g. init.js calling start() before modules finish loading)
	const __queuedStarts = globalArg.SimilarArtists?._startQueue;

	// ============================================================================
	// EARLY EXPORT - Set window.SimilarArtists immediately to prevent race conditions
	// ============================================================================
	
	// Create placeholder object immediately so init.js can detect it loaded
	globalArg.SimilarArtists = {
		_loading: true,
		start: function() {
			console.warn('SimilarArtists: start() called before modules loaded, queuing...');
			// Queue the start call for when modules are ready
			if (!globalArg.SimilarArtists._startQueue) {
				globalArg.SimilarArtists._startQueue = [];
			}
			globalArg.SimilarArtists._startQueue.push(arguments);
		},
	};

	// Re-attach any previous queue we captured before overwriting the placeholder
	if (__queuedStarts && __queuedStarts.length) {
		globalArg.SimilarArtists._startQueue = (__queuedStarts || []).slice();
	}
	
	// ============================================================================
	// MODULE LOADING - Load all modules directly using requirejs
	// ============================================================================
	
	// Load all module files in correct dependency order
	// Configuration first
	requirejs('modules/config');
	
	// Utilities (no dependencies)
	requirejs('modules/utils/normalization');
	requirejs('modules/utils/helpers');
	requirejs('modules/utils/sql');
	
	// Settings (depend on utils)
	requirejs('modules/settings/storage');
	requirejs('modules/settings/prefixes');
	requirejs('modules/settings/lastfm');
	
	// UI (no dependencies)
	requirejs('modules/ui/notifications');
	
	// API (depend on utils and settings)
	requirejs('modules/api/cache');
	requirejs('modules/api/lastfm');
	
	// Database individual modules FIRST (they export to window.dbLibrary, window.dbPlaylist, window.dbQueue)
	requirejs('modules/db/library');
	requirejs('modules/db/playlist');
	requirejs('modules/db/queue');
	// THEN load the index which depends on them
	requirejs('modules/db/index');
	
	// Core orchestration and integration (depend on everything)
	requirejs('modules/core/orchestration');
	requirejs('modules/core/autoMode');
	requirejs('modules/core/mm5Integration');
	
	// Wait for all modules to load, then initialize
	// Using requestAnimationFrame for better timing than setTimeout
	// This ensures all requirejs calls have completed
	requestAnimationFrame(function() {
		// Double-wrap to ensure all modules are fully loaded
		requestAnimationFrame(function() {
			// Get modules from window namespace (exported by individual module files)
			const modules = {
				config: globalArg.similarArtistsConfig,
				utils: {
					normalization: {
						normalizeName: globalArg.normalizeName,
						splitArtists: globalArg.splitArtists,
						stripName: globalArg.stripName,
						cacheKeyArtist: globalArg.cacheKeyArtist,
						cacheKeyTopTracks: globalArg.cacheKeyTopTracks,
					},
					helpers: globalArg.similarArtistsHelpers,
					sql: globalArg.similarArtistsSQL,
				},
				settings: {
					storage: globalArg.similarArtistsStorage,
					prefixes: globalArg.similarArtistsPrefixes,
					lastfm: globalArg.similarArtistsLastfm,
				},
				ui: {
					notifications: globalArg.similarArtistsNotifications,
				},
				api: {
					cache: globalArg.lastfmCache,
					lastfmApi: globalArg.similarArtistsLastfmAPI,
				},
				db: globalArg.similarArtistsDB,
				core: {
					orchestration: globalArg.similarArtistsOrchestration,
					autoMode: globalArg.similarArtistsAutoMode,
					mm5Integration: globalArg.similarArtistsMM5Integration,
				},
			};
			
			if (!modules.config) {
				console.error('SimilarArtists: Failed to load modules - config not found');
				return;
			}
			
			if (!modules.db || !modules.db.findLibraryTracksBatch) {
				console.error('SimilarArtists: Failed to load modules - db.findLibraryTracksBatch not found');
				console.error('SimilarArtists: db object:', modules.db);
				return;
			}
			
			console.log('SimilarArtists: Modules loaded successfully');
			initializeSimilarArtists(modules);
		});
	});
	
	function initializeSimilarArtists(modules) {
		const { config, settings: { storage }, core: { orchestration, autoMode, mm5Integration } } = modules;

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
		 * Calls orchestration directly.
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

				// Get handlers
				const { getSetting, setSetting } = storage;
				
				// Read current state from settings (not from autoModeState)
				const currentState = autoMode.isAutoModeEnabled(getSetting);
				const newState = !currentState;
				
				// Write new state to settings
				setSetting('OnPlay', newState);
				console.log(`SimilarArtists: Auto-mode setting changed from ${currentState} to ${newState}`);
				
				// Initialize autoModeState if needed
				if (!appState.autoModeState) {
					console.log('SimilarArtists: Auto-mode state not initialized, initializing now');
					initializeAutoMode();
				}
				
				// Sync listener with new setting
				if (appState.autoModeState) {
					const handler = createAutoTriggerHandler();
					autoMode.syncAutoModeListener(
						appState.autoModeState,
						getSetting,
						handler,
						console.log
					);
				}
				
				// Update UI
				updateAutoModeUI(newState);
				
				// Notify action state changed to update checkmark
				if (typeof window.updateActionState === 'function') {
					window.updateActionState('SimilarArtistsToggleAuto');
				}
				
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

		// Cache a single trigger handler for the lifetime of the add-on instance.
		let cachedAutoTriggerHandler = null;

		/**
		 * Create auto-trigger handler.
		 * 
		 * This is the callback invoked when playback near end.
		 * 
		 * @returns {Function} Handler function
		 */
		function createAutoTriggerHandler() {
			if (cachedAutoTriggerHandler) return cachedAutoTriggerHandler;

			const { getSetting } = storage;
			const { showToast } = modules.ui.notifications;

			cachedAutoTriggerHandler = autoMode.createAutoTriggerHandler({
				getSetting,
				generateSimilarPlaylist: (autoModeFlag) => orchestration.generateSimilarPlaylist(modules, autoModeFlag),
				showToast,
				// Handler itself can re-check current setting at trigger-time
				isAutoModeEnabled: () => autoMode.isAutoModeEnabled(getSetting),
				threshold: 5,
				logger: console.log,
			});

			return cachedAutoTriggerHandler;
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
				
				// Fire a global event so other UI components (like settings dialog) can update
				try {
					const event = new CustomEvent('similarartists:automodechanged', {
						detail: { enabled: enabled }
					});
					window.dispatchEvent(event);
				} catch (e) {
					console.error('Failed to dispatch automode changed event:', e);
				}

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

				// Ensure auto-mode state exists before attempting to sync.
				if (!appState.autoModeState) {
					initializeAutoMode();
				}

				if (appState.autoModeState) {
					const handler = createAutoTriggerHandler();
					autoMode.syncAutoModeListener(
						appState.autoModeState,
						getSetting,
						handler,
						console.log
					);
				}

				// Update UI
				const enabled = isAutoEnabled();
				updateAutoModeUI(enabled);
				
				// Notify action state to update menu checkmark
				if (typeof window.updateActionState === 'function') {
					window.updateActionState('SimilarArtistsToggleAuto');
				}

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

				// NOTE: Configuration initialization is now handled by install.js
				// which runs on first install and upgrades. No need to initialize here.

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
		
		// Process any queued start calls (from the early placeholder object)
		const queuedStarts = globalArg.SimilarArtists?._startQueue;
		if (queuedStarts && queuedStarts.length > 0) {
			console.log(`SimilarArtists: Processing ${queuedStarts.length} queued start call(s)`);
			// Call start once; multiple queued calls are equivalent.
			try {
				start();
			} catch (e) {
				console.error('SimilarArtists: Error processing queued start:', e);
			}
			// Clear queue to avoid re-running on hot reloads
			try {
				delete globalArg.SimilarArtists._startQueue;
			} catch (_) {
				// ignore
			}
		}
	}

})(typeof window !== 'undefined' ? window : global);
