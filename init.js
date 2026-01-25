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
		Overwrite: 'Create new playlist', // Playlist creation mode dropdown
		SeedLimit: 20,         // Number of seed artists to use
		SimilarLimit: 30,      // Number of similar artists per seed
		TPA: 50,               // Tracks Per Artist to fetch
		TPL: 1000,             // Total tracks Per pLaylist limit

		// Behavior flags
		Seed: true,           // Include seed artist checkbox
		Rank: true,            // Enable ranking by play count/rating
		Best: true,            // Only include highly-rated tracks
		Random: true,          // Randomize results
		Confirm: false,        // Show confirmation checkbox
		AutoMode: 'Track',     // Auto-mode type dropdown

		// Auto-mode settings
		OnPlay: false,         // Auto-mode checkbox
		Ignore: false,         // Skip recent checkbox

		// Playlist parent
		Parent: '',

		// Advanced filters
		Black: '',             // Blacklist of artists (comma-separated)
		Exclude: '',           // Exclude titles
		Genre: '',             // Genre filter

		// Rating filter
		Rating: 0,             // Minimum rating (0-100)
		Unknown: true,         // Include unknown rating

		// Navigation
		Navigate: 'Navigate to new playlist',
		Enqueue: false,        // Add to Now Playing instead of creating playlist
		ClearNP: false,        // Clear checkbox

		// API - Initialize with MediaMonkey's registered Last.fm key if available, otherwise blank
		ApiKey: '', // Will be populated in checkConfig() if MM has a registered key
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
				
				// Try to get MediaMonkey's registered Last.fm API key
				let mmApiKey = '';
				try {
					if (app?.utils?.web?.getAPIKey) {
						mmApiKey = app.utils.web.getAPIKey('lastfmApiKey') || '';
					}
				} catch (e) {
					console.log('Match Monkey: Could not retrieve MM Last.fm key:', e);
				}
				
				// Create config with MM's key if available, otherwise blank
				const initialConfig = Object.assign({}, DEFAULTS);
				initialConfig.ApiKey = mmApiKey;
				
				app.setValue(SCRIPT_ID, initialConfig);
				console.log('Match Monkey: Default configuration created' + (mmApiKey ? ' (using MediaMonkey Last.fm key)' : ' (no API key set)'));
			} else {
				// EXISTING CONFIG: Merge any missing defaults (for upgrades)
				let updatedConfig = Object.assign({}, existingConfig);
				let addedKeys = [];
				let needsUpdate = false;

				// Clean up: If ApiKey is set to the old default, clear it
				const OLD_DEFAULT_KEY = '7fd988db0c4e9d8b12aed27d0a91a932';
				if (updatedConfig.ApiKey === OLD_DEFAULT_KEY) {
					console.log('Match Monkey: Clearing old default API key');
					updatedConfig.ApiKey = '';
					needsUpdate = true;
				}

				// Add any missing default keys (but don't overwrite ApiKey if it exists)
				for (const key in DEFAULTS) {
					if (!(key in existingConfig)) {
						// Special handling for ApiKey: only set if not present
						if (key === 'ApiKey') {
							updatedConfig.ApiKey = '';
							addedKeys.push(key);
						} else {
							updatedConfig[key] = DEFAULTS[key];
							addedKeys.push(key);
						}
					}
				}

				if (addedKeys.length > 0 || needsUpdate) {
					app.setValue(SCRIPT_ID, updatedConfig);
					if (addedKeys.length > 0) {
						console.log(`Match Monkey: Added ${addedKeys.length} new setting(s):`, addedKeys.join(', '));
					}
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

