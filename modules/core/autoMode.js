/**
 * MatchMonkey Auto-Mode Implementation
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

 */

'use strict';

// Export to window namespace for MM5
window.matchMonkeyAutoMode = {
	/**
	 * Auto-mode state container
	 * Tracks listener subscriptions and prevents concurrent runs
	 */
	createAutoModeState: function () {
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
	attachAutoModeListener: function (state, handleAutoTrigger, logger = console.log) {
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
				//logger(`Auto-Mode: Playback state changed to '${newState}'`);

				// Only respond to track changes
				if (newState === 'trackChanged') {
					// Check cooldown
					const now = Date.now();
					const timeSinceLastTrigger = now - state.lastTriggerTime;
					if (timeSinceLastTrigger < state.triggerCooldown) {
						logger(`Auto-Mode: Cooldown active (${state.triggerCooldown - timeSinceLastTrigger}ms remaining), skipping trigger check`);
						return;
					}

					logger('Auto-Mode: Track changed event - checking if should trigger...');

					//// Log current playlist state for debugging
					//try {
					//	const remaining = window.matchMonkeyAutoMode.getPlaylistRemaining(player, logger);
					//	logger(`Auto-Mode: Current remaining tracks: ${remaining}`);
					//} catch (e) {
					//	logger(`Auto-Mode: Could not check remaining: ${e.toString()}`);
					//}

					// Call handler
					Promise.resolve(handleAutoTrigger(state, logger)).catch((e) => {
						logger(`Auto-Mode: Trigger handler error: ${e?.stack || e?.message || e}`);
					});
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
	detachAutoModeListener: function (state, logger = console.log) {
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
	getPlaylistRemaining: function (player, logger = console.log) {
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
				// Remaining = total - played (this includes the currently playing track)
				remaining = total - played;
				//logger(`Auto-Mode: Method 1 (entriesCount): total=${total}, played=${played}, remaining=${remaining}`);
				if (remaining >= 0) return remaining;
			}
		} catch (e) {
			logger(`Auto-Mode: Method 1 failed: ${e.toString()}`);
		}

		// Method 2: Fallback to playlist cursor (older MM5 versions)
		try {
			if (player.playlist && typeof player.playlist.getCursor === 'function' && typeof player.playlist.count === 'function') {
				const cursor = player.playlist.getCursor();
				const count = player.playlist.count();
				// Cursor is 0-indexed position of currently playing track
				// Remaining = total count - (current position + 1)
				// This gives tracks that haven't played yet (not including current)
				remaining = count - (cursor + 1);
				logger(`Auto-Mode: Method 2 (playlist): cursor=${cursor}, count=${count}, remaining=${remaining} (after current)`);
				if (remaining >= 0) return remaining;
			}
		} catch (e) {
			logger(`Auto-Mode: Method 2 failed: ${e.toString()}`);
		}

		// Method 3: Try getSongList with position tracking
		try {
			const songList = player.getSongList?.();
			if (songList) {
				const tracklist = songList.getTracklist?.();
				if (tracklist && typeof tracklist.count === 'number') {
					const total = tracklist.count;
					// Try to get current position
					const currentTrack = player.getCurrentTrack?.();
					if (currentTrack && typeof tracklist.indexOf === 'function') {
						const currentIndex = tracklist.indexOf(currentTrack);
						if (currentIndex >= 0) {
							remaining = total - (currentIndex + 1);
							logger(`Auto-Mode: Method 3 (songList with indexOf): total=${total}, currentIndex=${currentIndex}, remaining=${remaining}`);
							if (remaining >= 0) return remaining;
						}
					}
					// Fallback: just use total as rough estimate
					remaining = total;
					logger(`Auto-Mode: Method 3 fallback (total only): tracklist.count=${remaining}`);
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
	 * Supports both old and new property names.
	 * 
	 * @param {Function} getSetting - Settings getter function
	 * @param {string} [settingKey='AutoModeEnabled'] - Settings key for auto-mode
	 * @returns {boolean} True if auto-mode is enabled
	 */
	isAutoModeEnabled: function (getSetting, settingKey = 'AutoModeEnabled') {
		try {
			// Try new property name first, fall back to old
			let enabled = getSetting(settingKey, undefined);
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
	 * 4. Tries multiple discovery strategies if needed
	 * 5. Invocation of orchestration (Phase 5)
	 * 
	 * @param {object} config - Configuration object
	 * @param {Function} config.getSetting - Settings getter
	 * @param {Function} config.generateSimilarPlaylist - Phase 5 orchestration function
	 * @param {Function} config.showToast - UI notification function
	 * @param {Function} config.isAutoModeEnabled - Settings check function
	 * @param {Function} [config.getModeName] - Optional function to get current mode name
	 * @param {number} [config.threshold=2] - Remaining entries threshold
	 * @param {Function} [config.logger=console.log] - Logging function
	 * @returns {Function} Handler function for playback events
	 */
	createAutoTriggerHandler: function (config) {
		const {
			getSetting,
			generateSimilarPlaylist,
			showToast,
			isAutoModeEnabled,
			getModeName,
			threshold = 3,
			logger = console.log,
		} = config;

		const autoMode = this;

		return async function handleAutoTrigger(state, loggerFunc) {
			try {
				const log = loggerFunc || logger;

				// Get mode name for messages (try new property name, fall back to old)
				let configuredMode = getDiscoveryModeKey(getSetting('AutoModeDiscovery', undefined));
				const modeName = typeof getModeName === 'function' ? getModeName() : 'Similar Tracks';

				// Support both styles:
				// - isAutoModeEnabled(getSetting)
				// - isAutoModeEnabled()
				let enabled = false;
				try {
					enabled = isAutoModeEnabled.length >= 1 ? !!isAutoModeEnabled(getSetting) : !!isAutoModeEnabled();
				} catch (_) {
					enabled = !!isAutoModeEnabled(getSetting);
				}

				if (!enabled) {
					log(`Auto-Mode [${modeName}]: Auto-mode disabled, skipping trigger`);
					return;
				}

				// Check if already running (rate limiting)
				if (state.autoRunning) {
					log(`Auto-Mode [${modeName}]: Already running, skipping concurrent trigger`);
					return;
				}

				// Get player and check remaining entries
				const player = app.player;
				if (!player) {
					log(`Auto-Mode [${modeName}]: Player not available`);
					return;
				}

				// Use captured autoMode reference instead of 'this'
				const remaining = autoMode.getPlaylistRemaining(player, log);
				log(`Auto-Mode [${modeName}]: Remaining entries: ${remaining} (threshold: ${threshold})`);

				// Trigger when remaining entries <= threshold AND > 0
				// remaining = 0 means on last track
				// remaining = 1 means 1 track left after current (on second-to-last)
				// remaining = 2 means 2 tracks left after current (on third-to-last)
				// Default threshold = 3, so trigger when on second-to-last or third-to-last
				if (remaining > threshold) {
					log(`Auto-Mode [${modeName}]: Not near end yet (remaining=${remaining}, threshold=${threshold}), skipping`);
					return;
				}

				if (remaining < 0) {
					log(`Auto-Mode [${modeName}]: Invalid remaining count (${remaining}), skipping`);
					return;
				}

				// Note: We trigger even when remaining=0 (on last track) to give one last chance
				log(`Auto-Mode [${modeName}]: Near end of playlist detected (remaining=${remaining}), will trigger`);

				// Check cooldown (prevent rapid re-triggers)
				const now = Date.now();
				const timeSinceLastTrigger = now - state.lastTriggerTime;
				if (timeSinceLastTrigger < state.triggerCooldown) {
					log(`Auto-Mode [${modeName}]: Cooldown active (${state.triggerCooldown - timeSinceLastTrigger}ms remaining)`);
					return;
				}

				// Mark that we're running and update last trigger time
				state.autoRunning = true;
				state.lastTriggerTime = now;

				try {
					log(`Auto-Mode: User configured mode: ${getDiscoveryModeDisplayName(configuredMode)}`);

					// Define all discovery modes to try in order
					const allModes = ['track', 'acoustics', 'artist', 'genre'];

					// Start with user's preferred mode, then try others
					const modesToTry = [configuredMode];
					for (const mode of allModes) {
						if (mode !== configuredMode.toLowerCase()) {
							modesToTry.push(mode);
						}
					}

					let totalTracksAdded = 0;
					let successfulMode = null;

					// Try each mode until we add at least 1 track
					for (let i = 0; i < modesToTry.length; i++) {
						const attemptMode = modesToTry[i];
						const isRetry = i > 0;
						const attemptModeName = getDiscoveryModeDisplayName(attemptMode);

						if (isRetry) {
							log(`Auto-Mode: Retry attempt ${i + 1}/${modesToTry.length} with ${attemptModeName}`);
							showToast(`Retrying with ${attemptModeName.toLowerCase()}...`, 'info');
						} else {
							log(`Auto-Mode [${attemptModeName}]: Triggering auto-queue (remaining=${remaining})`);
							showToast(`Queuing ${attemptModeName.toLowerCase()}...`, 'info');
						}

						try {
							// Call Phase 5 orchestration with autoMode=true, discovery mode, and threshold
							const result = await generateSimilarPlaylist(true, attemptMode, threshold);

							if (result && result.success && result.tracksAdded > 0) {
								totalTracksAdded = result.tracksAdded;
								successfulMode = attemptModeName;
								log(`Auto-Mode [${attemptModeName}]: Successfully added ${result.tracksAdded} tracks`);
								showToast(`Added ${result.tracksAdded} tracks (${attemptModeName})`, 'success');
								break; // Success - stop trying
							} else {
								log(`Auto-Mode [${attemptModeName}]: No tracks added (${result?.error || 'no matches'})`);

								// If this was the last attempt, show error
								if (i === modesToTry.length - 1) {
									log(`Auto-Mode: All discovery modes exhausted, no tracks added`);
									showToast(`Auto-queue failed: No matching tracks found`, 'warning');
								}
							}

						} catch (attemptError) {
							log(`Auto-Mode [${attemptModeName}]: Attempt failed with error: ${attemptError.toString()}`);

							// If this was the last attempt, show error
							if (i === modesToTry.length - 1) {
								showToast(`Auto-queue error: ${attemptError.message}`, 'error');
							}
						}
					}

					// Log final result
					if (totalTracksAdded > 0) {
						log(`Auto-Mode: Completed successfully - ${totalTracksAdded} tracks added via ${successfulMode}`);
					} else {
						log(`Auto-Mode: All attempts failed - no tracks were added`);
					}

				} finally {
					// Always clear the running flag
					state.autoRunning = false;
					log(`Auto-Mode [${modeName}]: Trigger handler completed`);
				}

			} catch (e) {
				log(`Auto-Mode: Error in trigger handler: ${e.toString()}`);
				state.autoRunning = false;
				showToast(`Auto-queue error: ${e.message}`, 'error');
			}
		};

		/**
		 * Helper to get display name for discovery mode
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
				default:
					return 'Similar Artists';
			}
		}

		/**
		 * Helper to get discovery mode key from display name
		 * */
		function getDiscoveryModeKey(displayName) {
			const normalized = String(displayName || '').toLowerCase();
			switch (normalized) {
				case 'similar artists':
					return 'artist';
				case 'similar tracks':
					return 'track';
				case 'similar genre':
					return 'genre';
				case 'similar acoustics':
					return 'acoustics';
				default:
					return 'artist';
			}
		}
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
	syncAutoModeListener: function (state, getSetting, handleAutoTrigger, logger = console.log) {
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
	toggleAutoMode: function (state, getSetting, setSetting, handleAutoTrigger, onStateChange = null, logger = console.log) {
		try {
			const currentState = this.isAutoModeEnabled(getSetting);
			const newState = !currentState;

			// Update setting (use new property name)
			setSetting('AutoModeEnabled', newState);
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
	initializeAutoMode: function (getSetting, handleAutoTrigger, logger = console.log) {
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
	shutdownAutoMode: function (state, logger = console.log) {
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
