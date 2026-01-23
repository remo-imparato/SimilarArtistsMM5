/**
 * SimilarArtists Add-on Initialization
 * 
 * This script runs on every MediaMonkey startup.
 * It ensures configuration exists with proper defaults.
 * 
 * @author Remo Imparato
 * @version 1.0.0
 * @license MIT
 */


'use strict';

// Load the MM5-integrated entry point which includes all phases
// This is the refactored modular version with complete architecture
localRequirejs('similarArtists');  // -> window.SimilarArtists

// ============================================================================
// DEBUG TOOLS (OPTIONAL)
// ============================================================================

// Uncomment to enable debugging:
/*
try {
	requirejs('helpers/debugTools');
	if (window.SimilarArtists && typeof registerDebuggerEntryPoint === 'function') {
		registerDebuggerEntryPoint.call(window.SimilarArtists, 'start');
		console.log('SimilarArtists: Debug tools registered');
	}
} catch (e) {
	// Ignore if debug tools not available
}
*/

// ============================================================================
// INITIALIZATION
// ============================================================================

(function() {
	'use strict';

	// Initialize when MediaMonkey 5 is ready
	window.whenReady(() => {
		try {
			// Validate that entry point loaded
			if (!window.SimilarArtists) {
				console.error('SimilarArtists: Entry point not loaded');
				return;
			}

			// Validate that start function exists
			if (typeof window.SimilarArtists.start !== 'function') {
				console.error('SimilarArtists: start() function not available');
				return;
			}
			checkConfig();
			// Initialize the add-on
			window.SimilarArtists.start();

			// Log successful initialization
			console.log('SimilarArtists: Initialization complete - add-on ready');

		} catch (e) {
			// Log initialization error but don't crash MM5
			console.error(`SimilarArtists: Initialization failed - ${e.toString()}`);
		}
	});

})();


function checkConfig() {
	'use strict';

	try {
		console.log('SimilarArtists: Initializing...');

		const SCRIPT_ID = 'SimilarArtists';

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
			Rank: true,           // Enable ranking by play count/rating
			Best: true,           // Only include highly-rated tracks
			Random: true,          // Randomize results
			Confirm: false,        // Show confirmation checkbox
			Enqueue: false,        // Add to Now Playing instead of creating playlist

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
			Navigate: 'Navigate to new playlist',      // Where to navigate after completion

			// API
			ApiKey: '7fd988db0c4e9d8b12aed27d0a91a932', // Last.fm API key (default fallback)
		};

		// Try to get API key if available
		try {
			if (app && app.utils && app.utils.web && typeof app.utils.web.getAPIKey === 'function') {
				const apiKey = app.utils.web.getAPIKey('lastfmApiKey');
				if (apiKey) {
					DEFAULTS.ApiKey = apiKey;
				}
			}
		} catch (e) {
			console.log('SimilarArtists: Could not get API key from app.utils.web, using default');
		}

		// Check for existing configuration
		const existingConfig = app.getValue(SCRIPT_ID, {});

		// Determine if we need to initialize or upgrade
		const needsInit = !existingConfig ||
			existingConfig === null ||
			existingConfig === undefined ||
			(typeof existingConfig === 'object' && Object.keys(existingConfig).length === 0);

		if (needsInit) {
			// FIRST TIME: Create fresh configuration with defaults
			console.log('SimilarArtists: No configuration found - creating defaults...');

			app.setValue(SCRIPT_ID, Object.assign({}, DEFAULTS));

			console.log('SimilarArtists: Default configuration created with', Object.keys(DEFAULTS).length, 'settings');
			console.log('SimilarArtists: Initialization complete');

		} else {
			// EXISTING CONFIG: Merge any missing defaults (for upgrades)
			console.log('SimilarArtists: Existing configuration found with', Object.keys(existingConfig).length, 'settings');

			let updatedConfig = Object.assign({}, existingConfig);
			let addedKeys = [];

			// Add any missing default keys (new settings added in this version)
			for (const key in DEFAULTS) {
				if (!(key in existingConfig)) {
					updatedConfig[key] = DEFAULTS[key];
					addedKeys.push(key);
				}
			}

			if (addedKeys.length > 0) {
				// Save updated configuration
				app.setValue(SCRIPT_ID, updatedConfig);

				console.log('SimilarArtists: Added', addedKeys.length, 'new default setting(s):', addedKeys);
			} else {
				console.log('SimilarArtists: All settings up to date');
			}
		}

		// Verify configuration is accessible
		const finalConfig = app.getValue(SCRIPT_ID, {});
		if (finalConfig && Object.keys(finalConfig).length > 0) {
			console.log('SimilarArtists: ✓ Configuration verified -', Object.keys(finalConfig).length, 'settings available');
		} else {
			console.error('SimilarArtists: ✗ Configuration verification failed!');
		}

	} catch (e) {
		console.error('SimilarArtists: Error during initialization:', e.toString());
		console.error('SimilarArtists: Stack trace:', e.stack);
	}

};

