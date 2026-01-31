/**
 * MatchMonkey Add-on Initialization
 * 
 * This script runs on every MediaMonkey startup.
 * It loads all modules and ensures configuration exists with proper defaults.
 * 

 * 
 * @author Remo Imparato
 * @version 2.2.0

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
localRequirejs('modules/api/reccobeats');  // NEW: ReccoBeats API integration
	
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

/*
//Debuging tools (depend on utils)
requirejs('helpers/debugTools');
registerDebuggerEntryPoint.call(this, 'start');

//*/

// ============================================================================
// INITIALIZATION
// ============================================================================

//NOTE: use a named function so we can register it for debugging
function start() {
	'use strict';

	// Script namespace
	const SCRIPT_ID = 'MatchMonkey';

	/**
	 * Default configuration values with cleaner property names.
	 * 
	 * Property naming convention:
	 * - CamelCase for all properties
	 * - Descriptive names that explain what they do
	 * - Grouped logically (Playlist, Discovery, Rating, AutoMode, Queue, Filters)
	 * 
	 * Note: API key is hardcoded in modules/api/lastfm.js - not user configurable.
	 * Each application should have its own Last.fm API key per their terms of service.
	 */
	const DEFAULTS = {
		// === Playlist Creation ===
		PlaylistName: '- Similar to %', // Template (% = artist name)
		ParentPlaylist: '',             // Parent playlist to organize results under (blank = root level)
		PlaylistMode: 'Create new playlist', // Create new / Overwrite / Do not create
		ShowConfirmDialog: false,       // Show playlist selection dialog
		ShuffleResults: true,           // Randomize final results
		IncludeSeedArtist: true,        // Include seed artist tracks

		// === Discovery Limits (Manual Mode) ===
		SimilarArtistsLimit: 20,        // Max similar artists per seed from Last.fm
		TrackSimilarLimit: 100,         // Max similar tracks per seed from Last.fm (track-based discovery)
		TracksPerArtist: 30,            // Max tracks per artist from library
		MaxPlaylistTracks: 0,           // Final limit (0 = unlimited, add all found)

		// === Track Selection ===
		UseLastfmRanking: true,         // Sort by Last.fm popularity
		PreferHighQuality: true,        // Prefer higher bitrate/rating versions

		// === Rating Filter ===
		MinRating: 0,                   // Minimum rating (0-100)
		IncludeUnrated: true,           // Include tracks without ratings

		// === Auto-Mode Settings ===
		AutoModeEnabled: false,         // Enable auto-queue on playlist end
		AutoModeDiscovery: 'Similar Tracks',     // Discovery type: artist/track/genre/acoustics
		AutoModeSeedLimit: 2,           // Seeds to process in auto-mode
		AutoModeSimilarLimit: 10,       // Similar artists per seed in auto-mode
		AutoModeTracksPerArtist: 5,     // Tracks per artist in auto-mode
		AutoModeMaxTracks: 10,          // Max tracks per auto-queue trigger

		// === Queue Behavior ===
		EnqueueMode: false,             // Add to Now Playing instead of playlist
		ClearQueueFirst: false,         // Clear queue before adding
		SkipDuplicates: true,           // Skip tracks already in queue
		NavigateAfter: 'Navigate to new playlist', // Navigation after completion

		// === Mood/Activity Discovery (ReccoBeats) ===
		DefaultMood: '',                // Default mood: energetic, relaxed, happy, sad, focused
		DefaultActivity: '',            // Default activity: workout, study, party, sleep, driving
		MoodActivityBlendRatio: 0.5,    // Blend ratio: 0.5 = 50% seeds + 50% mood (0=all mood, 1=all seeds)
		HybridMode: true,               // Combine ReccoBeats + Last.fm

		// === Filters ===
		ArtistBlacklist: '',            // Comma-separated blacklisted artists
		GenreBlacklist: '',             // Comma-separated blacklisted genres
		TitleExclusions: '',            // Comma-separated title words to exclude
	};

	/**
	 * Migration map: old property names -> new property names
	 * Used to preserve user settings when upgrading from older versions.
	 */
	const MIGRATION_MAP = {
		// Old name -> New name
		'Name': 'PlaylistName',
		'Parent': 'ParentPlaylist',
		'Overwrite': 'PlaylistMode',
		'Confirm': 'ShowConfirmDialog',
		'Random': 'ShuffleResults',
		'Seed': 'IncludeSeedArtist',
		'SeedLimit': 'SimilarArtistsLimit',
		'SimilarLimit': 'SimilarArtistsLimit',
		'similarLimit': 'SimilarArtistsLimit',
		'TPA': 'TracksPerArtist',
		'TPL': 'MaxPlaylistTracks',
		'Rank': 'UseLastfmRanking',
		'Best': 'PreferHighQuality',
		'Rating': 'MinRating',
		'Unknown': 'IncludeUnrated',
		'OnPlay': 'AutoModeEnabled',
		'AutoMode': 'AutoModeDiscovery',
		'Enqueue': 'EnqueueMode',
		'ClearNP': 'ClearQueueFirst',
		'Ignore': 'SkipDuplicates',
		'Navigate': 'NavigateAfter',
		'Black': 'ArtistBlacklist',
		'Genre': 'GenreBlacklist',
		'Exclude': 'TitleExclusions',
	};

	/**
	 * Check and initialize configuration with defaults.
	 * Migrates old property names and merges any missing default keys.
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
				
				const initialConfig = Object.assign({}, DEFAULTS);
				app.setValue(SCRIPT_ID, initialConfig);
				console.log('Match Monkey: Default configuration created');
			} else {
				// EXISTING CONFIG: Migrate old names and merge missing defaults
				let updatedConfig = Object.assign({}, existingConfig);
				let migratedKeys = [];
				let addedKeys = [];
				let removedKeys = [];

				// Step 1: Migrate old property names to new names
				for (const [oldKey, newKey] of Object.entries(MIGRATION_MAP)) {
					if (oldKey in existingConfig && !(newKey in existingConfig)) {
						updatedConfig[newKey] = existingConfig[oldKey];
						migratedKeys.push(`${oldKey} -> ${newKey}`);
					}
				}

				// Step 2: Add any missing default keys
				for (const key in DEFAULTS) {
					if (!(key in updatedConfig)) {
						updatedConfig[key] = DEFAULTS[key];
						addedKeys.push(key);
					}
				}

				// Step 3: Remove deprecated keys (ApiKey is now hardcoded)
				if ('ApiKey' in updatedConfig) {
					delete updatedConfig.ApiKey;
					removedKeys.push('ApiKey');
				}

				// Save if changes were made
				if (migratedKeys.length > 0 || addedKeys.length > 0 || removedKeys.length > 0) {
					app.setValue(SCRIPT_ID, updatedConfig);
					if (migratedKeys.length > 0) {
						console.log(`Match Monkey: Migrated ${migratedKeys.length} setting(s):`, migratedKeys.join(', '));
					}
					if (addedKeys.length > 0) {
						console.log(`Match Monkey: Added ${addedKeys.length} new setting(s):`, addedKeys.join(', '));
					}
					if (removedKeys.length > 0) {
						console.log(`Match Monkey: Removed ${removedKeys.length} deprecated setting(s):`, removedKeys.join(', '));
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

}

//-- make it named function so we can register it for debugging
start();



