/**
 * SimilarArtists Modules Index
 * 
 * NOTE: This file is no longer the primary loader.
 * All modules are now loaded directly in similarArtists.js
 * 
 * This file is kept for backward compatibility and exports the module namespace.
 */

'use strict';

// All modules are loaded by similarArtists.js using requirejs()
// This file just exports the namespace for convenience

// Export to window namespace (modules should already be loaded)
window.similarArtistsModules = {
	config: window.similarArtistsConfig,
	utils: {
		normalization: {
			normalizeName: window.normalizeName,
			splitArtists: window.splitArtists,
			stripName: window.stripName,
			cacheKeyArtist: window.cacheKeyArtist,
			cacheKeyTopTracks: window.cacheKeyTopTracks,
		},
		helpers: window.similarArtistsHelpers,
		sql: window.similarArtistsSQL,
	},
	settings: {
		storage: window.similarArtistsStorage,
		prefixes: window.similarArtistsPrefixes,
		lastfm: window.similarArtistsLastfm,
	},
	ui: {
		notifications: window.similarArtistsNotifications,
	},
	api: {
		cache: window.lastfmCache,
		lastfmApi: window.similarArtistsLastfmAPI,
	},
	db: window.similarArtistsDB,
	core: {
		orchestration: window.similarArtistsOrchestration,
		autoMode: window.similarArtistsAutoMode,
		mm5Integration: window.similarArtistsMM5Integration,
	},
};
