/**
 * SimilarArtists Action Handlers for MediaMonkey 5
 * 
 * Phase 7: MM5 Action Integration
 * 
 * Registers toolbar buttons, menu items, and hotkey handlers.
 * Works with similarArtists-MM5Integration.js and mm5Integration module.
 * 
 * Actions are automatically discovered by MM5 and appear in:
 * - Tools menu
 * - Toolbar (if added to toolbar config)
 * - Hotkey configuration
 * - Context menus
 */

// Put actions under the 'addons' category so they show up consistently
if (!window.actionCategories) {
	window.actionCategories = {};
}
if (!window.actionCategories.hasOwnProperty('addons')) {
	window.actionCategories.addons = () => _('Addons');
}

// Ensure window.actions exists
if (!window.actions) {
	window.actions = {};
}

/**
 * Similar Artists: Run
 * 
 * Main action for running the similar artists workflow.
 * Generates or queues tracks from similar artists based on selection.
 * 
 * Triggered by:
 * - Tools ? Similar Artists
 * - Toolbar button
 * - Hotkey
 */
window.actions.SimilarArtistsRun = {
	// User-facing title
	title: () => _('&Similar Artists'),

	// Icon ID (script icon)
	icon: 'script',

	// Category for organization
	category: 'addons',

	// Support hotkey binding
	hotkeyAble: true,

	// Always visible
	visible: true,

	// Not disabled by default
	disabled: false,

	// Execute the action
	execute: function() {
		try {
			// Call the exported function from similarArtists-MM5Integration.js
			if (window.SimilarArtists && typeof window.SimilarArtists.runSimilarArtists === 'function') {
				// Pass false for autoMode (user-initiated run)
				window.SimilarArtists.runSimilarArtists(false);
			} else {
				console.error('SimilarArtists: runSimilarArtists not available');
			}
		} catch (e) {
			console.error(`SimilarArtists: Error in SimilarArtistsRun: ${e.toString()}`);
		}
	}
};

/**
 * Similar Artists: Toggle Auto-Mode
 * 
 * Action to toggle automatic similar artist queuing.
 * When enabled, automatically queues similar tracks when playlist nears end.
 * 
 * Shows checked state based on current OnPlay setting.
 * 
 * Triggered by:
 * - Tools ? Similar Artists: Auto On/Off (checkbox)
 * - Toolbar button toggle
 * - Hotkey
 */
window.actions.SimilarArtistsToggleAuto = {
	// User-facing title
	title: () => _('Similar Artists: &Auto On/Off'),

	// Icon ID (script icon)
	icon: 'script',

	// Category for organization
	category: 'addons',

	// Checkable action (shows checkbox in menu)
	checkable: true,

	// Support hotkey binding
	hotkeyAble: true,

	// Always visible
	visible: true,

	// Not disabled by default
	disabled: false,

	// Determine checked state
	checked: function() {
		try {
			// Get current auto-mode state from SimilarArtists.isAutoEnabled()
			if (window.SimilarArtists && typeof window.SimilarArtists.isAutoEnabled === 'function') {
				return Boolean(window.SimilarArtists.isAutoEnabled());
			}
			return false;
		} catch (e) {
			console.error(`SimilarArtists: Error checking auto state: ${e.toString()}`);
			return false;
		}
	},

	// Execute the toggle
	execute: function() {
		try {
			// Call the exported function from similarArtists-MM5Integration.js
			if (window.SimilarArtists && typeof window.SimilarArtists.toggleAuto === 'function') {
				window.SimilarArtists.toggleAuto();
			} else {
				console.error('SimilarArtists: toggleAuto not available');
			}
		} catch (e) {
			console.error(`SimilarArtists: Error in SimilarArtistsToggleAuto: ${e.toString()}`);
		}
	}
};

/**
 * Register actions in Tools menu.
 * 
 * Adds our actions to the Tools ? Similar Artists submenu.
 */
if (window._menuItems && window._menuItems.tools) {
	// Initialize submenu if needed
	if (!window._menuItems.tools.action) {
		window._menuItems.tools.action = {
			submenu: []
		};
	}

	if (!window._menuItems.tools.action.submenu) {
		window._menuItems.tools.action.submenu = [];
	}

	// Add "Similar Artists" action
	window._menuItems.tools.action.submenu.push({
		action: window.actions.SimilarArtistsRun,
		order: 40,
		grouporder: 10,
	});

	// Add "Similar Artists: Auto On/Off" action
	window._menuItems.tools.action.submenu.push({
		action: window.actions.SimilarArtistsToggleAuto,
		order: 50,
		grouporder: 10,
	});
}

// Log that actions are registered
console.log('SimilarArtists: Actions registered');
