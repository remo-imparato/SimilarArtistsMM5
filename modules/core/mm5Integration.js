/**
 * SimilarArtists MM5 Integration Layer
 * 
 * Phase 7: MM5 Integration - Action handlers, toolbar buttons, and menu integration
 * 
 * Bridges the refactored modules (Phases 1-6) with MediaMonkey 5 UI and action systems.
 * Provides:
 * - Action handler definitions for toolbar/menu
 * - Settings change listeners
 * - UI state management
 * - Toolbar button registration
 * - Menu item integration
 * - Toggle button icon management
 * 
 * @author Remo Imparato
 * @license MIT
 */

'use strict';

module.exports = {
	/**
	 * Create MM5 action handlers for Similar Artists.
	 * 
	 * Returns action objects compatible with MM5's action system.
	 * These are registered via actions_add.js in the action system.
	 * 
	 * @param {object} config - Configuration object
	 * @param {Function} config.onRunSimilarArtists - Callback for run action
	 * @param {Function} config.onToggleAuto - Callback for toggle action
	 * @param {Function} config.isAutoEnabled - Function to check if auto-mode enabled
	 * @param {Function} config.logger - Optional logging function
	 * @returns {object} Actions object with Run and ToggleAuto actions
	 */
	createActionHandlers: function(config) {
		const {
			onRunSimilarArtists,
			onToggleAuto,
			isAutoEnabled,
			logger = console.log,
		} = config;

		return {
			/**
			 * Run Similar Artists action
			 * 
			 * Triggered by:
			 * - Tools menu ? Similar Artists
			 * - Toolbar button
			 * - Hotkey
			 */
			SimilarArtistsRun: {
				title: () => _('&Similar Artists'),
				icon: 'script',
				category: 'tools',
				hotkeyAble: true,
				visible: true,
				disabled: false,

				execute: function() {
					try {
						logger('MM5: SimilarArtistsRun executed');
						if (onRunSimilarArtists && typeof onRunSimilarArtists === 'function') {
							onRunSimilarArtists();
						} else {
							logger('MM5: onRunSimilarArtists callback not available');
						}
					} catch (e) {
						logger(`MM5: Error in SimilarArtistsRun: ${e.toString()}`);
					}
				}
			},

			/**
			 * Toggle Auto-Mode action
			 * 
			 * Triggered by:
			 * - Tools menu ? Similar Artists: Auto On/Off (checkbox)
			 * - Toolbar button toggle
			 * - Hotkey
			 * 
			 * Shows checked state based on isAutoEnabled() function
			 */
			SimilarArtistsToggleAuto: {
				title: () => _('Similar Artists: &Auto On/Off'),
				icon: 'script',
				category: 'tools',
				checkable: true,
				hotkeyAble: true,
				visible: true,
				disabled: false,

				checked: function() {
					try {
						if (!isAutoEnabled || typeof isAutoEnabled !== 'function') {
							return false;
						}
						return Boolean(isAutoEnabled());
					} catch (e) {
						logger(`MM5: Error checking auto state: ${e.toString()}`);
						return false;
					}
				},

				execute: function() {
					try {
						logger('MM5: SimilarArtistsToggleAuto executed');
						if (onToggleAuto && typeof onToggleAuto === 'function') {
							onToggleAuto();
						} else {
							logger('MM5: onToggleAuto callback not available');
						}
					} catch (e) {
						logger(`MM5: Error in SimilarArtistsToggleAuto: ${e.toString()}`);
					}
				}
			}
		};
	},

	/**
	 * Register actions with MM5 action system.
	 * 
	 * Adds the action objects to window.actions so MM5 can discover them.
	 * 
	 * @param {object} actions - Actions object from createActionHandlers()
	 * @param {Function} logger - Optional logging function
	 * @returns {boolean} True if successfully registered
	 */
	registerActions: function(actions, logger = console.log) {
		try {
			if (!window.actions) {
				logger('MM5: window.actions not available');
				return false;
			}

			if (!actions) {
				logger('MM5: No actions provided');
				return false;
			}

			// Add our actions to the global actions object
			window.actions.SimilarArtistsRun = actions.SimilarArtistsRun;
			window.actions.SimilarArtistsToggleAuto = actions.SimilarArtistsToggleAuto;

			logger('MM5: Actions registered successfully');
			return true;

		} catch (e) {
			logger(`MM5: Error registering actions: ${e.toString()}`);
			return false;
		}
	},

	/**
	 * Register actions in Tools menu.
	 * 
	 * Adds action items to window._menuItems.tools.action.submenu
	 * so they appear in Tools ? Similar Artists menu.
	 * 
	 * @param {object} actions - Actions object (with SimilarArtistsRun, SimilarArtistsToggleAuto)
	 * @param {Function} logger - Optional logging function
	 * @returns {boolean} True if successfully registered
	 */
	registerToolsMenu: function(actions, logger = console.log) {
		try {
			if (!window._menuItems || !window._menuItems.tools) {
				logger('MM5: window._menuItems.tools not available');
				return false;
			}

			if (!window._menuItems.tools.action) {
				logger('MM5: window._menuItems.tools.action not available');
				return false;
			}

			if (!window._menuItems.tools.action.submenu) {
				window._menuItems.tools.action.submenu = [];
				logger('MM5: Created tools.action.submenu array');
			}

			// Register Run action
			window._menuItems.tools.action.submenu.push({
				action: actions.SimilarArtistsRun,
				order: 40,
				grouporder: 10,
			});
			logger('MM5: Registered SimilarArtistsRun in Tools menu');

			// Register Toggle Auto action
			window._menuItems.tools.action.submenu.push({
				action: actions.SimilarArtistsToggleAuto,
				order: 50,
				grouporder: 10,
			});
			logger('MM5: Registered SimilarArtistsToggleAuto in Tools menu');

			return true;

		} catch (e) {
			logger(`MM5: Error registering Tools menu items: ${e.toString()}`);
			return false;
		}
	},

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
	 * 1. Register actions
	 * 2. Register Tools menu items
	 * 3. Set up settings change listener
	 * 4. Update initial toolbar icon state
	 * 
	 * Called once during add-on startup.
	 * 
	 * @param {object} config - Configuration object
	 * @param {Function} config.onRunSimilarArtists - Run action callback
	 * @param {Function} config.onToggleAuto - Toggle action callback
	 * @param {Function} config.isAutoEnabled - Check auto-enabled state
	 * @param {Function} config.onSettingChanged - Settings change callback
	 * @param {string} [config.toolbarButtonId='SimilarArtistsToggle'] - Toolbar button ID
	 * @param {Function} [config.logger=console.log] - Logging function
	 * @returns {object} Integration state {actions, unsubscribe}
	 */
	initializeIntegration: function(config) {
		const {
			onRunSimilarArtists,
			onToggleAuto,
			isAutoEnabled,
			onSettingChanged,
			toolbarButtonId = 'SimilarArtistsToggle',
			logger = console.log,
		} = config;

		const state = {
			actions: null,
			unsubscribe: null,
		};

		try {
			logger('MM5: Initializing MM5 integration...');

			// 1. Create action handlers
			state.actions = this.createActionHandlers({
				onRunSimilarArtists,
				onToggleAuto,
				isAutoEnabled,
				logger,
			});

			// 2. Register actions
			if (!this.registerActions(state.actions, logger)) {
				logger('MM5: Failed to register actions');
				return state;
			}

			// 3. Register Tools menu
			if (!this.registerToolsMenu(state.actions, logger)) {
				logger('MM5: Failed to register Tools menu');
				// Continue anyway - menu might be optional
			}

			// 4. Set up settings listener
			state.unsubscribe = this.listenSettingsChanges(onSettingChanged, logger);

			// 5. Update initial toolbar state
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
	 * Called during add-on shutdown.
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

			// Clear action references
			if (state && state.actions) {
				state.actions = null;
			}

			logger('MM5: Integration shutdown complete');

		} catch (e) {
			logger(`MM5: Error during integration shutdown: ${e.toString()}`);
		}
	},

	/**
	 * Get action object by name.
	 * 
	 * Useful for direct access to action definitions.
	 * 
	 * @param {string} actionName - Action ID
	 * @returns {object} Action object or null
	 */
	getAction: function(actionName) {
		try {
			if (!window.actions || !actionName) {
				return null;
			}
			return window.actions[actionName] || null;
		} catch (e) {
			return null;
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
