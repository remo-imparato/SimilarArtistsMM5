/**
 * MatchMonkey Modules Index
 * 
 * Exports the consolidated module namespace for organized access.
 * All modules are loaded by init.js using localRequirejs().
 * 

 */

'use strict';

// Build and export the modules namespace
// This is called after all individual modules have been loaded
window.matchMonkeyModules = {
	// Configuration
	config: window.matchMonkeyConfig,
	
	// Utility modules
	utils: {
		normalization: window.matchMonkeyNormalization || {
			normalizeName: window.normalizeName,
			splitArtists: window.splitArtists,
			stripName: window.stripName,
			cacheKeyArtist: window.cacheKeyArtist,
			cacheKeyTopTracks: window.cacheKeyTopTracks,
		},
		helpers: window.matchMonkeyHelpers,
		sql: window.matchMonkeySQL,
	},
	
	// Settings modules
	settings: {
		storage: window.matchMonkeyStorage,
		prefixes: window.matchMonkeyPrefixes,
		lastfm: window.matchMonkeyLastfm,
	},
	
	// UI modules
	ui: {
		notifications: window.matchMonkeyNotifications,
	},
	
	// API modules
	api: {
		cache: window.lastfmCache,
		lastfmApi: window.matchMonkeyLastfmAPI,
		reccobeatsApi: window.matchMonkeyReccoBeatsAPI,
	},
	
	// Database modules
	db: window.matchMonkeyDB,
	
	// Core modules
	core: {
		discoveryStrategies: window.matchMonkeyDiscoveryStrategies,
		orchestration: window.matchMonkeyOrchestration,
		autoMode: window.matchMonkeyAutoMode,
		mm5Integration: window.matchMonkeyMM5Integration,
	},
};
