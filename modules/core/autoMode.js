/**
 * SimilarArtists Auto-Mode Implementation
 * 
 * Handles automatic queuing of similar artist tracks when the Now Playing
 * playlist is approaching its end.
 * 
 * Key Features:
 * - Playback event listener attachment/detachment
 * - Remaining entries detection (multiple fallback methods)
 * - Threshold-based auto-triggering (2 or fewer entries remaining)
 * - Rate limiting (prevent multiple simultaneous runs)
 * - Error recovery and logging
 * 
 * @author Remo Imparato
 * @license MIT
 */

'use strict';

// Export to window namespace for MM5
window.similarArtistsAutoMode = {
	/**
	 * Auto-mode state container
	 * Tracks listener subscriptions and prevents concurrent runs
	 */
	createAutoModeState: function() {
		return {
			// Listener subscription handle for detachment
			autoListen: null,
			// Prevents concurrent auto-run invocations
			autoRunning: false,
			// Tracks last trigger time for rate limiting
			lastTriggerTime: 0,
			// Minimum time between auto-triggers (milliseconds)
			triggerCooldown: 5000,
		};
	},

	/**
	 * Attach auto-mode playback listener.
	 * 
	 * Subscribes to playback state changes and triggers auto-queue
	 * when the playlist is approaching its end.
	 * 
	 * @param {object} state - Auto-mode state object (from createAutoModeState)
	 * @param {Function} handleAutoTrigger - Callback for auto-queue trigger
	 * @param {Function} logger - Optional logging function
	 * @returns {boolean} True if successfully attached, false otherwise
	 */
	attachAutoModeListener: function(state, handleAutoTrigger, logger = console.log) {
		try {
			// Validate environment
			if (typeof app === 'undefined' || !app.player) {
				logger('Auto-Mode: Cannot attach - app or player not available');
				return false;
			}

			if (!app.listen || typeof app.listen !== 'function') {
				logger('Auto-Mode: Cannot attach - app.listen not available');
				return false;
			}

			if (!state) {
				logger('Auto-Mode: Cannot attach - state object not provided');
				return false;
			}

			// Detach existing listener if present
			if (state.autoListen) {
				logger('Auto-Mode: Detaching existing listener before re-attaching');
				this.detachAutoModeListener(state, logger);
			}

			// Subscribe to playback state changes
			// MM5 fires 'playbackState' event with values like 'trackChanged', 'playing', 'stopped', etc.
			const player = app.player;
			state.autoListen = app.listen(player, 'playbackState', (newState) => {
				logger(`Auto-Mode: Playback state changed to '${newState}'`);
				
				// Only trigger on track change events (playback advancing to next track)
				if (newState === 'trackChanged') {
					// Rate limiting: prevent triggers too close together
					const now = Date.now();
					const timeSinceLastTrigger = now - state.lastTriggerTime;
					
					if (timeSinceLastTrigger < state.triggerCooldown) {
						logger(`Auto-Mode: Cooldown active (${state.triggerCooldown - timeSinceLastTrigger}ms remaining), skipping trigger`);
						return;
					}

					logger('Auto-Mode: Track changed event - calling trigger handler');
					handleAutoTrigger(state, logger);
				}
			});

			logger('Auto-Mode: Listener successfully attached');
			return true;

		} catch (e) {
			logger(`Auto-Mode: Error attaching listener: ${e.toString()}`);
			state.autoListen = null;
			return false;
		}
	},

	/**
	 * Detach auto-mode playback listener.
	 * 
	 * Unsubscribes from playback events and cleans up state.
	 * Safe to call if listener is not attached.
	 * 
	 * @param {object} state - Auto-mode state object
	 * @param {Function} logger - Optional logging function
	 * @returns {boolean} True if detached successfully, false if no listener was attached
	 */
	detachAutoModeListener: function(state, logger = console.log) {
		try {
			if (!state || !state.autoListen) {
				logger('Auto-Mode: No listener to detach');
				return false;
			}

			if (!app.unlisten || typeof app.unlisten !== 'function') {
				logger('Auto-Mode: app.unlisten not available, cannot detach listener');
				state.autoListen = null;
				return false;
			}

			// Unsubscribe from playback events
			app.unlisten(state.autoListen);
			state.autoListen = null;

			logger('Auto-Mode: Listener successfully detached');
			return true;

		} catch (e) {
			logger(`Auto-Mode: Error detaching listener: ${e.toString()}`);
			state.autoListen = null;
			return false;
		}
	},

	/**
	 * Check remaining entries in Now Playing playlist.
	 * 
	 * Uses multiple fallback methods to determine how many tracks remain:
	 * 1. MM5 entriesCount / getCountOfPlayedEntries (preferred)
	 * 2. Fallback: player.playlist.getCursor() / count()
	 * 3. Fallback: songList.getTracklist().count
	 * 
	 * @param {object} player - MM5 player object
	 * @param {Function} logger - Optional logging function
	 * @returns {number} Remaining entries (0 if cannot be determined)
	 */
	getPlaylistRemaining: function(player, logger = console.log) {
		if (!player) {
			logger('Auto-Mode: Player not available');
			return 0;
		}

		let remaining = 0;

		// Method 1: MM5 entriesCount API (preferred)
		try {
			const total = typeof player.entriesCount === 'number' ? player.entriesCount : 0;
			if (total > 0 && typeof player.getCountOfPlayedEntries === 'function') {
				const played = player.getCountOfPlayedEntries();
				remaining = total - played;
				logger(`Auto-Mode: Method 1 (entriesCount): total=${total}, played=${played}, remaining=${remaining}`);
				if (remaining > 0) return remaining;
			}
		} catch (e) {
			logger(`Auto-Mode: Method 1 failed: ${e.toString()}`);
		}

		// Method 2: Fallback to playlist cursor (older MM5 versions)
		try {
			if (player.playlist && typeof player.playlist.getCursor === 'function' && typeof player.playlist.count === 'function') {
				const cursor = player.playlist.getCursor();
				const count = player.playlist.count();
				remaining = count - cursor;
				logger(`Auto-Mode: Method 2 (playlist): cursor=${cursor}, count=${count}, remaining=${remaining}`);
				if (remaining > 0) return remaining;
			}
		} catch (e) {
			logger(`Auto-Mode: Method 2 failed: ${e.toString()}`);
		}

		// Method 3: Fallback to songList tracklist count
		try {
			const songList = player.getSongList?.();
			if (songList) {
				const tracklist = songList.getTracklist?.();
				if (tracklist && typeof tracklist.count === 'number') {
					// This gives us total count, not current position
					// We'll use this as a fallback estimate only
					remaining = tracklist.count;
					logger(`Auto-Mode: Method 3 (songList): tracklist.count=${remaining}`);
					if (remaining > 0) return remaining;
				}
			}
		} catch (e) {
			logger(`Auto-Mode: Method 3 failed: ${e.toString()}`);
		}

		logger('Auto-Mode: Could not determine remaining entries');
		return 0;
	},

	/**
	 * Check if auto-mode is enabled via settings.
	 * 
	 * @param {Function} getSetting - Settings getter function
	 * @param {string} [settingKey='OnPlay'] - Settings key for auto-mode
	 * @returns {boolean} True if auto-mode is enabled
	 */
	isAutoModeEnabled: function(getSetting, settingKey = 'OnPlay') {
		try {
			const enabled = getSetting(settingKey, false);
			return Boolean(enabled);
		} catch (e) {
			console.error(`Auto-Mode: Error checking enabled status: ${e.toString()}`);
			return false;
		}
	},

	/**
	 * Create the auto-trigger handler function.
	 * 
	 * This is the callback invoked when playback reaches the end of the playlist.
	 * It orchestrates:
	 * 1. Remaining entries check
	 * 2. Threshold comparison (2 or fewer remaining)
	 * 3. Rate limiting check
	 * 4. Invocation of orchestration (Phase 5)
	 * 
	 * @param {object} config - Configuration object
	 * @param {Function} config.getSetting - Settings getter
	 * @param {Function} config.generateSimilarPlaylist - Phase 5 orchestration function
	 * @param {Function} config.showToast - UI notification function
	 * @param {Function} config.isAutoModeEnabled - Settings check function
	 * @param {number} [config.threshold=2] - Remaining entries threshold
	 * @param {Function} [config.logger=console.log] - Logging function
	 * @returns {Function} Handler function for playback events
	 */
	createAutoTriggerHandler: function(config) {
		const {
			getSetting,
			generateSimilarPlaylist,
			showToast,
			isAutoModeEnabled,
			threshold = 2,
			logger = console.log,
		} = config;

		// Capture reference to autoMode module for use inside handler
		const autoMode = this;

		return async function handleAutoTrigger(state, loggerFunc) {
			try {
				const log = loggerFunc || logger;

				// Double-check auto-mode is enabled
				if (!isAutoModeEnabled(getSetting)) {
					log('Auto-Mode: Auto-mode disabled, skipping trigger');
					return;
				}

				// Check if already running (rate limiting)
				if (state.autoRunning) {
					log('Auto-Mode: Already running, skipping concurrent trigger');
					return;
				}

				// Get player and check remaining entries
				const player = app.player;
				if (!player) {
					log('Auto-Mode: Player not available');
					return;
				}

				// Use captured autoMode reference instead of 'this'
				const remaining = autoMode.getPlaylistRemaining(player, log);
				log(`Auto-Mode: Remaining entries: ${remaining}`);

				// Check if we should trigger (remaining <= threshold)
				if (remaining > threshold) {
					log(`Auto-Mode: Not near end yet (remaining=${remaining}, threshold=${threshold}), skipping`);
					return;
				}
				
				if (remaining <= 0) {
					log(`Auto-Mode: Playlist already ended (remaining=${remaining}), too late to trigger`);
					return;
				}

				// Check cooldown (prevent rapid re-triggers)
				const now = Date.now();
				const timeSinceLastTrigger = now - state.lastTriggerTime;
				if (timeSinceLastTrigger < state.triggerCooldown) {
					log(`Auto-Mode: Cooldown active (${state.triggerCooldown - timeSinceLastTrigger}ms remaining)`);
					return;
				}

				// Mark that we're running and update last trigger time
				state.autoRunning = true;
				state.lastTriggerTime = now;

				try {
					log(`Auto-Mode: Triggering auto-queue (remaining=${remaining})`);
					showToast('Queuing similar artists...', 'info');

					// Call Phase 5 orchestration with autoMode=true
					// This applies conservative limits and forces enqueue behavior
					const result = await generateSimilarPlaylist(true);

					if (result && result.success) {
						log(`Auto-Mode: Successfully added ${result.tracksAdded} tracks`);
						showToast(`Added ${result.tracksAdded} similar artist tracks`, 'success');
					} else {
						log('Auto-Mode: Orchestration failed');
						if (result?.error) {
							showToast(`Auto-queue failed: ${result.error}`, 'error');
						}
					}

				} finally {
					// Always clear the running flag
					state.autoRunning = false;
					log('Auto-Mode: Trigger handler completed');
				}

			} catch (e) {
				log(`Auto-Mode: Error in trigger handler: ${e.toString()}`);
				state.autoRunning = false;
				showToast(`Auto-queue error: ${e.message}`, 'error');
			}
		};
	},

	/**
	 * Sync auto-mode listener attachment with stored settings.
	 * 
	 * Ensures the listener is attached if enabled, and detached if disabled.
	 * Called during add-on initialization and when settings change.
	 * 
	 * @param {object} state - Auto-mode state
	 * @param {Function} getSetting - Settings getter
	 * @param {Function} handleAutoTrigger - Trigger callback
	 * @param {Function} logger - Logging function
	 * @returns {boolean} True if listener is now attached
	 */
	syncAutoModeListener: function(state, getSetting, handleAutoTrigger, logger = console.log) {
		try {
			const enabled = this.isAutoModeEnabled(getSetting);

			if (enabled && !state.autoListen) {
				// Should be enabled but isn't - attach it
				logger('Auto-Mode: Settings say enabled, attaching listener');
				return this.attachAutoModeListener(state, handleAutoTrigger, logger);
			} else if (!enabled && state.autoListen) {
				// Should be disabled but is - detach it
				logger('Auto-Mode: Settings say disabled, detaching listener');
				return this.detachAutoModeListener(state, logger);
			} else if (enabled && state.autoListen) {
				logger('Auto-Mode: Already attached (enabled)');
				return true;
			} else {
				logger('Auto-Mode: Already detached (disabled)');
				return false;
			}

		} catch (e) {
			logger(`Auto-Mode: Error syncing listener: ${e.toString()}`);
			return false;
		}
	},

	/**
	 * Toggle auto-mode on/off.
	 * 
	 * Flips the stored setting and syncs listener state accordingly.
	 * 
	 * @param {object} state - Auto-mode state
	 * @param {Function} getSetting - Settings getter
	 * @param {Function} setSetting - Settings setter
	 * @param {Function} handleAutoTrigger - Trigger callback
	 * @param {Function} onStateChange - Optional callback when state changes
	 * @param {Function} logger - Logging function
	 * @returns {boolean} New enabled state
	 */
	toggleAutoMode: function(state, getSetting, setSetting, handleAutoTrigger, onStateChange = null, logger = console.log) {
		try {
			const currentState = this.isAutoModeEnabled(getSetting);
			const newState = !currentState;

			// Update setting
			setSetting('OnPlay', newState);
			logger(`Auto-Mode: Toggled to ${newState ? 'enabled' : 'disabled'}`);

			// Sync listener with new state
			this.syncAutoModeListener(state, getSetting, handleAutoTrigger, logger);

			// Fire callback if provided
			if (onStateChange && typeof onStateChange === 'function') {
				try {
					onStateChange(newState);
				} catch (e) {
					logger(`Auto-Mode: Error in state change callback: ${e.toString()}`);
				}
			}

			return newState;

		} catch (e) {
			logger(`Auto-Mode: Error toggling auto-mode: ${e.toString()}`);
			return this.isAutoModeEnabled(getSetting);
		}
	},

	/**
	 * Initialize auto-mode during add-on startup.
	 * 
	 * Creates state object and syncs listener with settings.
	 * Called once during add-on initialization.
	 * 
	 * @param {Function} getSetting - Settings getter
	 * @param {Function} handleAutoTrigger - Trigger callback
	 * @param {Function} logger - Logging function
	 * @returns {object} Initialized state object
	 */
	initializeAutoMode: function(getSetting, handleAutoTrigger, logger = console.log) {
		try {
			logger('Auto-Mode: Initializing...');

			// Create state object
			const state = this.createAutoModeState();

			// Sync with settings
			const attached = this.syncAutoModeListener(state, getSetting, handleAutoTrigger, logger);
			logger(`Auto-Mode: Initialization complete (listener attached: ${attached})`);

			return state;

		} catch (e) {
			logger(`Auto-Mode: Error during initialization: ${e.toString()}`);
			return this.createAutoModeState();
		}
	},

	/**
	 * Cleanup auto-mode during add-on shutdown.
	 * 
	 * Detaches listener and clears state.
	 * 
	 * @param {object} state - Auto-mode state
	 * @param {Function} logger - Logging function
	 */
	shutdownAutoMode: function(state, logger = console.log) {
		try {
			logger('Auto-Mode: Shutting down...');
			this.detachAutoModeListener(state, logger);
			state.autoRunning = false;
			logger('Auto-Mode: Shutdown complete');
		} catch (e) {
			logger(`Auto-Mode: Error during shutdown: ${e.toString()}`);
		}
	},
};
