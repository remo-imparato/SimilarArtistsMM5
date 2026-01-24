/**
 * MatchMonkey Add-on Initialization
 * 
 * This script runs on every MediaMonkey startup.
 * It loads all modules and ensures configuration exists with proper defaults.
 * 
 * MediaMonkey 5 API Only
 * 
 * @author Remo Imparato
 * @version 2.1.0
 * @license MIT
 */

'use strict';

// ============================================================================
// MODULE LOADING
// ============================================================================

// Load the MM5-integrated entry point which includes all phases
localRequirejs('matchMonkey');  // -> window.matchMonkey

// Load all module files in correct dependency order

// Configuration first
localRequirejs('modules/config');
	
// Utilities (no dependencies)
localRequirejs('modules/utils/normalization');
localRequirejs('modules/utils/helpers');
localRequirejs('modules/utils/sql');
	
// Settings (depend on utils)
localRequirejs('modules/settings/storage');
localRequirejs('modules/settings/prefixes');
localRequirejs('modules/settings/lastfm');
	
// UI (no dependencies)
localRequirejs('modules/ui/notifications');
	
// API (depend on utils and settings)
localRequirejs('modules/api/cache');
localRequirejs('modules/api/lastfm');
	
// Database individual modules FIRST
localRequirejs('modules/db/library');
localRequirejs('modules/db/playlist');
localRequirejs('modules/db/queue');
// THEN load the index which depends on them
localRequirejs('modules/db/index');
	
// Core orchestration and integration (depend on everything)
localRequirejs('modules/core/discoveryStrategies'); // NEW: Discovery strategies
localRequirejs('modules/core/orchestration');
localRequirejs('modules/core/autoMode');
localRequirejs('modules/core/mm5Integration');

// ============================================================================
// INITIALIZATION
// ============================================================================

(function() {
	'use strict';

	// Script namespace
	const SCRIPT_ID = 'MatchMonkey';

	// Default configuration values
	const DEFAULTS = {
		// Playlist naming
		Name: '- Similar to %',

		// Core settings
		SeedLimit: 20,         // Number of seed artists to use
		SimilarLimit: 30,      // Number of similar artists per seed
		TPA: 30,               // Tracks Per Artist to fetch
		TPL: 1000,             // Total tracks Per pLaylist limit

		// Behavior flags
		Seed: false,           // Include seed artist checkbox
		Rank: true,            // Enable ranking by play count/rating
		Best: true,            // Only include highly-rated tracks
		Random: true,          // Randomize results
		Confirm: false,        // Show confirmation checkbox
		Enqueue: false,        // Add to Now Playing instead of creating playlist
		AutoMode: 'Track',     // Auto-mode type dropdown

		// Auto-mode settings
		OnPlay: false,         // Auto-mode checkbox
		Ignore: false,         // Skip recent checkbox
		ClearNP: false,        // Clear checkbox

		// Advanced filters
		Black: '',             // Blacklist of artists (comma-separated)
		Exclude: '',           // Exclude titles
		Genre: '',             // Genre filter
		Overwrite: 'Create new playlist', // Playlist creation mode dropdown

		// Rating filter
		Rating: 0,             // Minimum rating (0-100)
		Unknown: true,         // Include unknown rating

		// Playlist parent
		Parent: '',

		// Navigation
		Navigate: 'Navigate to new playlist',

		// API
		ApiKey: '7fd988db0c4e9d8b12aed27d0a91a932', // Last.fm API key (default fallback)
	};

	/**
	 * Check and initialize configuration with defaults.
	 * Merges any missing default keys for upgrades.
	 */
	function checkConfig() {
		try {
			console.log('Match Monkey: Checking configuration...');

			// Check for existing configuration
			const existingConfig = app.getValue(SCRIPT_ID, {});

			// Determine if we need to initialize or upgrade
			const needsInit = !existingConfig ||
				existingConfig === null ||
				(typeof existingConfig === 'object' && Object.keys(existingConfig).length === 0);

			if (needsInit) {
				// FIRST TIME: Create fresh configuration with defaults
				console.log('Match Monkey: No configuration found - creating defaults...');
				app.setValue(SCRIPT_ID, Object.assign({}, DEFAULTS));
				console.log('Match Monkey: Default configuration created');
			} else {
				// EXISTING CONFIG: Merge any missing defaults (for upgrades)
				let updatedConfig = Object.assign({}, existingConfig);
				let addedKeys = [];

				// Add any missing default keys
				for (const key in DEFAULTS) {
					if (!(key in existingConfig)) {
						updatedConfig[key] = DEFAULTS[key];
						addedKeys.push(key);
					}
				}

				if (addedKeys.length > 0) {
					app.setValue(SCRIPT_ID, updatedConfig);
					console.log(`Match Monkey: Added ${addedKeys.length} new setting(s):`, addedKeys.join(', '));
				} else {
					console.log('Match Monkey: Configuration up to date');
				}
			}

			// Verify configuration is accessible
			const finalConfig = app.getValue(SCRIPT_ID, {});
			if (finalConfig && Object.keys(finalConfig).length > 0) {
				console.log(`Match Monkey: Configuration verified (${Object.keys(finalConfig).length} settings)`);
			} else {
				console.error('Match Monkey: Configuration verification failed!');
			}

		} catch (e) {
			console.error('Match Monkey: Config error:', e.toString());
		}
	}

	/**
	 * Wait for modules to load and start the add-on.
	 */
	function initializeAddon() {
		try {
			console.log('Match Monkey: MediaMonkey ready, waiting for modules...');
			
			let checkCount = 0;
			const maxChecks = 50; // 5 seconds max wait
			
			const waitForModules = setInterval(() => {
				checkCount++;
				
				// Check if modules are loaded
				if (window.matchMonkey && window.matchMonkey._modulesLoaded) {
					clearInterval(waitForModules);
					
					// Validate start function
					if (typeof window.matchMonkey.start !== 'function') {
						console.error('Match Monkey: start() function not available');
						return;
					}
					
					// Initialize configuration
					checkConfig();
					
					// Start the add-on
					console.log('Match Monkey: Starting add-on...');
					window.matchMonkey.start();
					console.log('Match Monkey: Add-on ready');
					
				} else if (checkCount >= maxChecks) {
					clearInterval(waitForModules);
					console.error('Match Monkey: Timeout waiting for modules');
				}
			}, 100);

		} catch (e) {
			console.error('Match Monkey: Initialization failed:', e.toString());
		}
	}

	// Initialize when MediaMonkey 5 is ready
	if (typeof window.whenReady === 'function') {
		window.whenReady(initializeAddon);
	} else {
		// Fallback for older MM5 builds
		setTimeout(initializeAddon, 500);
	}

})();

