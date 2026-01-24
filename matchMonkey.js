/**
 * MatchMonkey Add-on for MediaMonkey 5
 * 
 * Complete refactored implementation using modular architecture.
 * Supports three discovery modes:
 * - Artist-based: Find similar artists (artist.getSimilar API)
 * - Track-based: Find similar tracks (track.getSimilar API)
 * - Genre-based: Find artists in same genre (tag.getTopArtists API)
 * 
 * @author Remo Imparato
 * @version 2.1.0
 * @description Generates playlists or queues tracks from similar artists/tracks/genres using Last.fm API.
 *              Supports automatic mode to queue similar tracks when approaching end of playlist.
 * 
 * @repository https://github.com/remo-imparato/SimilarArtistsMM5
 * @license MIT
 */

(function(globalArg) {
	'use strict';	
	
	// Wait for all modules to load, then initialize
	requestAnimationFrame(function() {
		requestAnimationFrame(function() {
			// Get modules from window namespace
			const modules = {
				config: globalArg.matchMonkeyConfig,
				utils: {
					normalization: {
						normalizeName: globalArg.normalizeName,
						splitArtists: globalArg.splitArtists,
						stripName: globalArg.stripName,
						cacheKeyArtist: globalArg.cacheKeyArtist,
						cacheKeyTopTracks: globalArg.cacheKeyTopTracks,
					},
					helpers: globalArg.matchMonkeyHelpers,
					sql: globalArg.matchMonkeySQL,
				},
				settings: {
					storage: globalArg.matchMonkeyStorage,
					prefixes: globalArg.matchMonkeyPrefixes,
					lastfm: globalArg.matchMonkeyLastfm,
				},
				ui: {
					notifications: globalArg.matchMonkeyNotifications,
				},
				api: {
					cache: globalArg.lastfmCache,
					lastfmApi: globalArg.matchMonkeyLastfmAPI,
				},
				db: globalArg.matchMonkeyDB,
				core: {
					orchestration: globalArg.matchMonkeyOrchestration,
					autoMode: globalArg.matchMonkeyAutoMode,
					mm5Integration: globalArg.matchMonkeyMM5Integration,
				},
			};
			
			if (!modules.config) {
				console.error('Match Monkey: Failed to load modules - config not found');
				return;
			}
			
			if (!modules.db || !modules.db.findLibraryTracksBatch) {
				console.error('Match Monkey: Failed to load modules - db.findLibraryTracksBatch not found');
				return;
			}
			
			console.log('Match Monkey: Modules loaded successfully');
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
		// DISCOVERY MODES
		// ============================================================================
		
		/**
		 * Discovery mode types
		 * - 'artist': Use artist.getSimilar to find similar artists
		 * - 'track': Use track.getSimilar to find musically similar tracks
		 * - 'genre': Use tag.getTopArtists to find artists in same genre
		 */
		const DISCOVERY_MODES = {
			ARTIST: 'artist',
			TRACK: 'track',
			GENRE: 'genre'
		};

		// ============================================================================
		// MAIN ENTRY POINTS
		// ============================================================================

		/**
		 * Run similar discovery workflow.
		 * 
		 * Main entry point for all action handlers.
		 * 
		 * @param {boolean} [autoModeFlag=false] - Whether running in auto-mode
		 * @param {string} [discoveryMode='artist'] - Discovery mode: 'artist', 'track', or 'genre'
		 * @returns {Promise<object>} Result from orchestration
		 */
		async function runMatchMonkey(autoModeFlag = false, discoveryMode = DISCOVERY_MODES.ARTIST) {
			try {
				// Validate discovery mode
				const validModes = Object.values(DISCOVERY_MODES);
				if (!validModes.includes(discoveryMode)) {
					console.warn(`Match Monkey: Invalid discovery mode "${discoveryMode}", defaulting to "artist"`);
					discoveryMode = DISCOVERY_MODES.ARTIST;
				}
				
				console.log(`Match Monkey: Running (autoMode=${autoModeFlag}, discoveryMode=${discoveryMode})`);
				
				const result = await orchestration.generateSimilarPlaylist(modules, autoModeFlag, discoveryMode);
				
				if (result.success) {
					console.log(`Match Monkey: Success - added ${result.tracksAdded} tracks`);
				} else {
					console.log(`Match Monkey: Completed with message - ${result.error}`);
				}
				
				return result;

			} catch (e) {
				console.error(`Match Monkey: Error in runMatchMonkey: ${e.toString()}`);
				// Don't throw - return error result instead
				return {
					success: false,
					error: e.message || String(e),
					tracksAdded: 0,
				};
			}
		}

		/**
		 * Toggle auto-mode on/off.
		 */
		function toggleAuto() {
			try {
				console.log('Match Monkey: Toggling auto-mode');

				const { getSetting, setSetting } = storage;
				
				const currentState = autoMode.isAutoModeEnabled(getSetting);
				const newState = !currentState;
				
				setSetting('OnPlay', newState);
				console.log(`Match Monkey: Auto-mode setting changed from ${currentState} to ${newState}`);
				
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
				
				updateAutoModeUI(newState);
				
				if (typeof window.updateActionState === 'function') {
					window.updateActionState('SimilarArtistsToggleAuto');
				}
				
				console.log(`Match Monkey: Auto-mode is now ${newState ? 'enabled' : 'disabled'}`);

			} catch (e) {
				console.error(`Match Monkey: Error in toggleAuto: ${e.toString()}`);
			}
		}

		/**
		 * Check if auto-mode is enabled.
		 */
		function isAutoEnabled() {
			try {
				const { getSetting } = storage;
				return autoMode.isAutoModeEnabled(getSetting);
			} catch (e) {
				return false;
			}
		}

		// ============================================================================
		// AUTO-MODE SETUP
		// ============================================================================

		let cachedAutoTriggerHandler = null;

		/**
		 * Clear the cached auto trigger handler so it gets recreated with new settings.
		 * Called when settings change to pick up new AutoMode value.
		 */
		function clearAutoTriggerHandlerCache() {
			cachedAutoTriggerHandler = null;
			console.log('Match Monkey: Auto trigger handler cache cleared');
		}

		function createAutoTriggerHandler() {
			if (cachedAutoTriggerHandler) return cachedAutoTriggerHandler;

			const { getSetting } = storage;
			const { showToast } = modules.ui.notifications;

			cachedAutoTriggerHandler = autoMode.createAutoTriggerHandler({
				getSetting,
				// Auto-mode uses the discovery mode configured in settings (AutoMode)
				// Options: 'Artist', 'Track', or 'Genre'
				generateSimilarPlaylist: (autoModeFlag) => {
					// Read the AutoMode setting to determine discovery type
					const autoModeSetting = getSetting('AutoMode', 'Track');
					let discoveryMode = DISCOVERY_MODES.TRACK; // Default to track-based
					
					// Map setting value to discovery mode constant
					if (autoModeSetting === 'Artist') {
						discoveryMode = DISCOVERY_MODES.ARTIST;
					} else if (autoModeSetting === 'Genre') {
						discoveryMode = DISCOVERY_MODES.GENRE;
					} else {
						discoveryMode = DISCOVERY_MODES.TRACK;
					}
					
					console.log(`Match Monkey Auto-Mode: Using ${autoModeSetting} discovery (mode=${discoveryMode})`);
					return orchestration.generateSimilarPlaylist(modules, autoModeFlag, discoveryMode);
				},
				showToast,
				isAutoModeEnabled: () => autoMode.isAutoModeEnabled(getSetting),
				threshold: 2,
				logger: console.log,
				// Pass the mode name getter for toast messages
				getModeName: () => {
					const autoModeSetting = getSetting('AutoMode', 'Track');
					if (autoModeSetting === 'Artist') return 'Similar Artists';
					if (autoModeSetting === 'Genre') return 'Similar Genre';
					return 'Similar Tracks';
				},
			});

			return cachedAutoTriggerHandler;
		}

		function initializeAutoMode() {
			try {
				const { getSetting } = storage;
				const autoModeSetting = getSetting('AutoMode', 'Track');
				console.log(`Match Monkey: Initializing auto-mode (configured for ${autoModeSetting} discovery)`);

				const handler = createAutoTriggerHandler();

				appState.autoModeState = autoMode.initializeAutoMode(
					getSetting,
					handler,
					console.log
				);

				console.log('Match Monkey: Auto-mode initialized');

			} catch (e) {
				console.error(`Match Monkey: Error initializing auto-mode: ${e.toString()}`);
			}
		}

		function shutdownAutoMode() {
			try {
				if (appState.autoModeState) {
					autoMode.shutdownAutoMode(appState.autoModeState, console.log);
					appState.autoModeState = null;
				}
				// Clear the cached handler on shutdown
				clearAutoTriggerHandlerCache();
			} catch (e) {
				console.error(`Match Monkey: Error shutting down auto-mode: ${e.toString()}`);
			}
		}

		// ============================================================================
		// MM5 UI INTEGRATION
		// ============================================================================

		function updateAutoModeUI(enabled) {
			try {
				const { mm5Integration: integration } = appState;
				if (!integration) return;

				const toolbarId = config.TOOLBAR_AUTO_ID || 'SimilarArtistsToggle';
				mm5Integration.updateToolbarIcon(toolbarId, enabled, console.log);
				mm5Integration.updateActionState('SimilarArtistsToggleAuto', console.log);
				
				try {
					const event = new CustomEvent('similarartists:automodechanged', {
						detail: { enabled: enabled }
					});
					window.dispatchEvent(event);
				} catch (e) { /* ignore */ }

			} catch (e) {
				console.error(`Match Monkey: Error updating UI: ${e.toString()}`);
			}
		}

		function onSettingsChanged() {
			try {
				const { getSetting } = storage;

				// Clear cached handler so it picks up new AutoMode setting
				clearAutoTriggerHandlerCache();

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

				const enabled = isAutoEnabled();
				updateAutoModeUI(enabled);
				
				if (typeof window.updateActionState === 'function') {
					window.updateActionState('SimilarArtistsToggleAuto');
				}

			} catch (e) {
				console.error(`Match Monkey: Error in onSettingsChanged: ${e.toString()}`);
			}
		}

		// ============================================================================
		// ADD-ON LIFECYCLE
		// ============================================================================

		function start() {
			if (appState.started) {
				console.log('Match Monkey: Already started');
				return;
			}

			appState.started = true;

			try {
				console.log('Match Monkey: Starting add-on...');

				const mmStatus = mm5Integration.checkMM5Availability();
				if (!mmStatus.available) {
					console.error(`Match Monkey: MM5 API not available. Missing: ${mmStatus.missing.join(', ')}`);
					return;
				}

				appState.mm5Integration = mm5Integration.initializeIntegration({
					onSettingChanged: onSettingsChanged,
					isAutoEnabled: isAutoEnabled,
					toolbarButtonId: config.TOOLBAR_AUTO_ID || 'SimilarArtistsToggle',
					logger: console.log,
				});

				initializeAutoMode();

				console.log('Match Monkey: Add-on started successfully');

			} catch (e) {
				console.error(`Match Monkey: Error during startup: ${e.toString()}`);
				appState.started = false;
			}
		}

		function shutdown() {
			try {
				console.log('Match Monkey: Shutting down...');

				if (appState.mm5Integration) {
					mm5Integration.shutdownIntegration(appState.mm5Integration, console.log);
					appState.mm5Integration = null;
				}

				shutdownAutoMode();

				if (appState.settingsUnsubscribe) {
					appState.settingsUnsubscribe();
					appState.settingsUnsubscribe = null;
				}

				appState.started = false;
				console.log('Match Monkey: Shutdown complete');

			} catch (e) {
				console.error(`Match Monkey: Error during shutdown: ${e.toString()}`);
			}
		}

		// ============================================================================
		// EXPORT TO GLOBAL
		// ============================================================================

		globalArg.matchMonkey = {
			// Core entry points
			start,
			shutdown,
			runMatchMonkey,
			toggleAuto,
			isAutoEnabled,

			// Discovery modes (for external use)
			DISCOVERY_MODES,

			// Lifecycle
			isStarted: () => appState.started,

			// Status and info
			getState: () => ({
				started: appState.started,
				autoModeEnabled: isAutoEnabled(),
			}),

			// Module access
			modules,
			config,
			
			// Flag to indicate modules are loaded
			_modulesLoaded: true,
		};

		console.log('Match Monkey: Modules loaded and ready');
	}

})(typeof window !== 'undefined' ? window : global);
