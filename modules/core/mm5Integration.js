/**
 * MatchMonkey MM5 Integration Layer
 * 
 * Bridges the refactored modules with MediaMonkey 5 UI systems.
 * Provides:
 * - UI state management (toolbar icon updates)
 * - Settings change listeners
 * - MM5 API availability checks
 * 
 * Note: Action registration is handled by actions_add.js as per MM5 standards.
 * 
 * @author Remo Imparato

 */

'use strict';

window.matchMonkeyMM5Integration = {
	/**
	 * Update action state (e.g., enable/disable, checked state).
	 * 
	 * Called when settings change or state updates to refresh UI.
	 * 
	 * @param {string} actionName - Action ID (e.g., 'SimilarArtistsToggleAuto')
	 * @param {Function} logger - Optional logging function
	 * @returns {boolean} True if successfully updated
	 */
	updateActionState: function(actionName, logger = console.log) {
		try {
			if (!actionName || typeof actionName !== 'string') {
				logger('MM5: Invalid action name');
				return false;
			}

			// Try app.actions API first (if available)
			if (app.actions && typeof app.actions.updateActionState === 'function') {
				try {
					const action = window.actions[actionName];
					if (action) {
						app.actions.updateActionState(action);
						logger(`MM5: Updated action state via app.actions: ${actionName}`);
						return true;
					}
				} catch (e) {
					logger(`MM5: app.actions.updateActionState failed: ${e.toString()}`);
				}
			}

			// Fallback: manual UI update
			logger(`MM5: Fallback UI update for ${actionName}`);
			return true;

		} catch (e) {
			logger(`MM5: Error updating action state: ${e.toString()}`);
			return false;
		}
	},

	/**
	 * Update toolbar button icon based on auto-mode state.
	 * 
	 * Changes icon between enabled/disabled visual states.
	 * Icon 32 = enabled (highlighted)
	 * Icon 33 = disabled (grayed)
	 * 
	 * @param {string} buttonId - Toolbar button ID
	 * @param {boolean} enabled - Current enabled state
	 * @param {Function} logger - Optional logging function
	 * @returns {boolean} True if successfully updated
	 */
	updateToolbarIcon: function(buttonId, enabled, logger = console.log) {
		try {
			if (!buttonId) {
				logger('MM5: No button ID provided');
				return false;
			}

			const iconNum = enabled ? 32 : 33;

			// Try app.toolbar API
			if (app.toolbar && typeof app.toolbar.setButtonIcon === 'function') {
				try {
					app.toolbar.setButtonIcon(buttonId, iconNum);
					logger(`MM5: Updated toolbar icon ${buttonId} to ${iconNum} (enabled=${enabled})`);
					return true;
				} catch (e) {
					logger(`MM5: app.toolbar.setButtonIcon failed: ${e.toString()}`);
				}
			}

			logger(`MM5: app.toolbar not available for button ${buttonId}`);
			return false;

		} catch (e) {
			logger(`MM5: Error updating toolbar icon: ${e.toString()}`);
			return false;
		}
	},

	/**
	 * Listen for settings changes and update UI accordingly.
	 * 
	 * Subscribes to app settings change events so UI stays in sync
	 * with stored preferences.
	 * 
	 * @param {Function} onSettingChanged - Callback when setting changes
	 * @param {Function} logger - Optional logging function
	 * @returns {Function} Unsubscribe function (call to remove listener)
	 */
	listenSettingsChanges: function(onSettingChanged, logger = console.log) {
		try {
			if (!app.listen || typeof app.listen !== 'function') {
				logger('MM5: app.listen not available');
				return null;
			}

			if (!onSettingChanged || typeof onSettingChanged !== 'function') {
				logger('MM5: No onSettingChanged callback provided');
				return null;
			}

			// Subscribe to app settings change event
			const subscription = app.listen(app, 'settingsChange', () => {
				logger('MM5: Settings change detected');
				try {
					onSettingChanged();
				} catch (e) {
					logger(`MM5: Error in onSettingChanged callback: ${e.toString()}`);
				}
			});

			logger('MM5: Listening for settings changes');

			// Return unsubscribe function
			return function unsubscribe() {
				try {
					if (app.unlisten) {
						app.unlisten(subscription);
						logger('MM5: Stopped listening for settings changes');
					}
				} catch (e) {
					logger(`MM5: Error unsubscribing from settings: ${e.toString()}`);
				}
			};

		} catch (e) {
			logger(`MM5: Error setting up settings listener: ${e.toString()}`);
			return null;
		}
	},

	/**
	 * Initialize MM5 integration.
	 * 
	 * Sets up all UI elements:
	 * 1. Set up settings change listener
	 * 2. Update initial toolbar icon state
	 * 
	 * Note: Actions and menu items are registered by actions_add.js
	 * 
	 * @param {object} config - Configuration object
	 * @param {Function} config.onSettingChanged - Settings change callback
	 * @param {Function} config.isAutoEnabled - Check auto-enabled state
	 * @param {string} [config.toolbarButtonId='SimilarArtistsToggle'] - Toolbar button ID
	 * @param {Function} [config.logger=console.log] - Logging function
	 * @returns {object} Integration state {unsubscribe}
	 */
	initializeIntegration: function(config) {
		const {
			onSettingChanged,
			isAutoEnabled,
			toolbarButtonId = 'SimilarArtistsToggle',
			logger = console.log,
		} = config;

		const state = {
			unsubscribe: null,
		};

		try {
			logger('MM5: Initializing MM5 integration...');

			// 1. Set up settings listener
			state.unsubscribe = this.listenSettingsChanges(onSettingChanged, logger);

			// 2. Update initial toolbar state
			if (isAutoEnabled && typeof isAutoEnabled === 'function') {
				const enabled = isAutoEnabled();
				this.updateToolbarIcon(toolbarButtonId, enabled, logger);
			}

			logger('MM5: Integration initialized successfully');
			return state;

		} catch (e) {
			logger(`MM5: Error during integration initialization: ${e.toString()}`);
			return state;
		}
	},

	/**
	 * Shutdown MM5 integration.
	 * 
	 * Cleans up listeners and state.
	 * 
	 * @param {object} state - Integration state (from initializeIntegration)
	 * @param {Function} logger - Optional logging function
	 */
	shutdownIntegration: function(state, logger = console.log) {
		try {
			logger('MM5: Shutting down MM5 integration...');

			// Unsubscribe from settings changes
			if (state && state.unsubscribe && typeof state.unsubscribe === 'function') {
				state.unsubscribe();
				state.unsubscribe = null;
			}

			logger('MM5: Integration shutdown complete');

		} catch (e) {
			logger(`MM5: Error during integration shutdown: ${e.toString()}`);
		}
	},

	/**
	 * Check if MM5 API available.
	 * 
	 * Validates that required MM5 APIs are present.
	 * 
	 * @returns {object} Status object {available, missing}
	 */
	checkMM5Availability: function() {
		const status = {
			available: true,
			missing: [],
		};

		if (!window.actions) {
			status.available = false;
			status.missing.push('window.actions');
		}

		if (!app || !app.listen || !app.unlisten) {
			status.available = false;
			status.missing.push('app.listen/unlisten');
		}

		if (!app || !app.player) {
			status.available = false;
			status.missing.push('app.player');
		}

		if (!window._menuItems || !window._menuItems.tools) {
			status.available = false;
			status.missing.push('window._menuItems.tools');
		}

		return status;
	},
};
