/**
 * MatchMonkey Add-on for MediaMonkey 5
 * 
 * Complete refactored implementation using modular architecture.
 * Supports multiple discovery modes:
 * - Artist-based: Find similar artists (Last.fm artist.getSimilar API)
 * - Track-based: Find similar tracks (Last.fm track.getSimilar API)
 * - Genre-based: Find artists in same genre (Last.fm tag.getTopArtists API)
 * - Recco-based: Find similar tracks using ReccoBeats (requires seed tracks)
 * - Mood-based: Find tracks matching mood profiles
 * - Activity-based: Find tracks matching activity profiles
 * 
 * @author Remo Imparato
 * @version 2.2.0
 * @description Generates playlists or queues tracks from similar artists/tracks/genres using Last.fm API
 *              and ReccoBeats. Supports automatic mode to queue similar tracks when approaching
 *              end of playlist.
 * 
 * @repository https://github.com/remo-imparato/SimilarArtistsMM5

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
		 * Discovery mode types:
		 * - 'artist': Use Last.fm artist.getSimilar to find similar artists
		 * - 'track': Use Last.fm track.getSimilar to find musically similar tracks
		 * - 'genre': Use Last.fm tag.getTopArtists to find artists in same genre
		 * - 'acoustics': Use ReccoBeats to find recommendations based on seed tracks
		 * - 'mood': Use predefined mood audio profiles
		 * - 'activity': Use predefined activity audio profiles
		 */
		const DISCOVERY_MODES = {
			ARTIST: 'artist',
			TRACK: 'track',
			GENRE: 'genre',
			ACOUSTICS: 'acoustics',
			MOOD: 'mood',
			ACTIVITY: 'activity'
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
		 * @param {string} [discoveryMode='artist'] - Discovery mode constant
		 * @param {object} [options={}] - Additional options
		 * @param {string} [options.moodActivityValue] - Specific mood or activity value to use
		 * @returns {Promise<object>} Result from orchestration
		 */
		async function runMatchMonkey(autoModeFlag = false, discoveryMode = DISCOVERY_MODES.ARTIST, options = {}) {
			try {
				// Validate discovery mode
				const validModes = Object.values(DISCOVERY_MODES);
				if (!validModes.includes(discoveryMode)) {
					console.warn(`Match Monkey: Invalid discovery mode "${discoveryMode}", defaulting to "artist"`);
					discoveryMode = DISCOVERY_MODES.ARTIST;
				}
				
				console.log(`Match Monkey: Running (autoMode=${autoModeFlag}, discoveryMode=${discoveryMode}, options=${JSON.stringify(options)})`);
				
				// Build enriched modules with mood/activity context if specified
				let enrichedModules = modules;
				
				// Handle mood/activity modes with optional value override
				if (discoveryMode === DISCOVERY_MODES.MOOD || discoveryMode === DISCOVERY_MODES.ACTIVITY) {
					const { getSetting } = storage;
					const context = discoveryMode === DISCOVERY_MODES.MOOD ? 'mood' : 'activity';
					
					// Use provided value or fall back to settings default
					let value = options.moodActivityValue;
					if (!value) {
						value = context === 'mood' 
							? getSetting('DefaultMood', 'energetic')
							: getSetting('DefaultActivity', 'workout');
					}
					
					enrichedModules = {
						...modules,
						_moodActivityContext: {
							context,
							value
						}
					};
					
					console.log(`Match Monkey: Using ${context} "${value}"`);
				}
				
				const result = await orchestration.generateSimilarPlaylist(enrichedModules, autoModeFlag, discoveryMode);
				
				if (result.success) {
					console.log(`Match Monkey: Success - added ${result.tracksAdded} tracks`);
				} else {
					console.log(`Match Monkey: Completed with message - ${result.error}`);
				}
				
				return result;

			} catch (e) {
				console.error(`Match Monkey: Error in runMatchMonkey: ${e.toString()}`);
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
				
				setSetting('AutoModeEnabled', newState);
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

		/**
		 * Run mood/activity-based playlist generation (convenience function).
		 * 
		 * @param {string} [mood] - Target mood (e.g., 'energetic', 'relaxed')
		 * @param {string} [activity] - Target activity (e.g., 'workout', 'study')
		 * @returns {Promise<object>} Result from orchestration
		 */
		async function runMoodActivityPlaylist(mood, activity) {
			try {
				const { getSetting } = storage;
				
				// Determine context and value
				let discoveryMode, value;
				
				if (mood) {
					discoveryMode = DISCOVERY_MODES.MOOD;
					value = mood;
				} else if (activity) {
					discoveryMode = DISCOVERY_MODES.ACTIVITY;
					value = activity;
				} else {
					// Use defaults from settings
					discoveryMode = DISCOVERY_MODES.MOOD;
					value = getSetting('DefaultMood', 'energetic');
				}
				
				console.log(`Match Monkey: Running ${discoveryMode} playlist (${value})`);
				
				return await runMatchMonkey(false, discoveryMode, { moodActivityValue: value });
				
			} catch (e) {
				console.error(`Match Monkey: Error in runMoodActivityPlaylist: ${e.toString()}`);
				return {
					success: false,
					error: e.message || String(e),
					tracksAdded: 0,
				};
			}
		}

		// ============================================================================
		// AUTO-MODE SETUP
		// ============================================================================

		let cachedAutoTriggerHandler = null;

		/**
		 * Clear the cached auto trigger handler so it gets recreated with new settings.
		 */
		function clearAutoTriggerHandlerCache() {
			cachedAutoTriggerHandler = null;
			console.log('Match Monkey: Auto trigger handler cache cleared');
		}

		function createAutoTriggerHandler() {
			if (cachedAutoTriggerHandler) return cachedAutoTriggerHandler;

			const { getSetting, intSetting } = storage;
			const { showToast } = modules.ui.notifications;

			// Read threshold from settings
			const threshold = intSetting('AutoModeSeedLimit', 2);

			cachedAutoTriggerHandler = autoMode.createAutoTriggerHandler({
				getSetting,
				generateSimilarPlaylist: (autoModeFlag, discoveryMode, thresholdParam) => {
					// Use provided threshold or fall back to settings
					const actualThreshold = typeof thresholdParam === 'number' ? thresholdParam : threshold;
					
					// If discoveryMode is explicitly provided (e.g., from retry logic), use it
					if (discoveryMode) {
						console.log(`Match Monkey Auto-Mode: Using explicit discovery mode: ${discoveryMode}`);
						return orchestration.generateSimilarPlaylist(modules, autoModeFlag, discoveryMode, actualThreshold);
					}

					// Otherwise, read from settings and normalize to lowercase
					const autoModeSetting = getSetting('AutoModeDiscovery', 'track');
					const mode = autoModeSetting.toLowerCase(); // ✅ Normalize to lowercase

					console.log(`Match Monkey Auto-Mode: Using ${mode} discovery from settings`);
					return orchestration.generateSimilarPlaylist(modules, autoModeFlag, mode, actualThreshold);
				},
				showToast,
				isAutoModeEnabled: () => autoMode.isAutoModeEnabled(getSetting),
				threshold,
				logger: console.log,
				getModeName: () => {
					// Use centralized display name function
					const autoModeSetting = getSetting('AutoModeDiscovery', 'track');
					return getDiscoveryModeDisplayName(autoModeSetting.toLowerCase());
				},
			});

			return cachedAutoTriggerHandler;
		}

		/**
		 * Get human-readable display name for discovery mode.
		 * Centralized function to ensure consistency.
		 * 
		 * @param {string} mode - Discovery mode (lowercase)
		 * @returns {string} Display name
		 */
		function getDiscoveryModeDisplayName(mode) {
			const normalized = String(mode || '').toLowerCase();
			switch (normalized) {
				case 'artist':
					return 'Similar Artists';
				case 'track':
					return 'Similar Tracks';
				case 'genre':
					return 'Similar Genre';
				case 'acoustics':
					return 'Similar Acoustics';
				case 'mood':
					return 'Mood';
				case 'activity':
					return 'Activity';
				default:
					return 'Similar';
			}
		}

		function initializeAutoMode() {
			try {
				const { getSetting } = storage;
				const autoModeSetting = getSetting('AutoModeDiscovery', 'Track');
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
			runMoodActivityPlaylist,
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
