/**
 * Database Layer Module - Phase 4
 *
 * Unified interface for all database operations:
 * - Library track searching (single and batch)
 * - Playlist creation and management
 * - Track queue operations (Now Playing and custom playlists)
 *
 * All functions use the MediaMonkey 5 API (`app.db`, `app.player`) and provide
 * error handling with graceful degradation.
 *
 * MediaMonkey 5 API Only
 *
 * @module modules/db
 * @exports {object} Database operations grouped by category
 */

'use strict';

// Defer building the export object until modules are loaded
// This handles potential load order issues
function buildDbInterface() {
	const dbInterface = {
		// Library search operations (from window.dbLibrary)
		findLibraryTracks: window.dbLibrary?.findLibraryTracks || function() {
			console.error('Match Monkey: dbLibrary.findLibraryTracks not loaded');
			return Promise.resolve([]);
		},
		findLibraryTracksBatch: window.dbLibrary?.findLibraryTracksBatch || function() {
			console.error('Match Monkey: dbLibrary.findLibraryTracksBatch not loaded');
			return Promise.resolve(new Map());
		},

		// Playlist management operations (from window.dbPlaylist)
		createPlaylist: window.dbPlaylist?.createPlaylist || function() {
			console.error('Match Monkey: dbPlaylist.createPlaylist not loaded');
			return Promise.resolve(null);
		},
		findPlaylist: window.dbPlaylist?.findPlaylist || function() {
			console.error('Match Monkey: dbPlaylist.findPlaylist not loaded');
			return null;
		},
		getOrCreatePlaylist: window.dbPlaylist?.getOrCreatePlaylist || function() {
			console.error('Match Monkey: dbPlaylist.getOrCreatePlaylist not loaded');
			return Promise.resolve(null);
		},

		// Queue/enqueue operations (from window.dbQueue)
		queueTrack: window.dbQueue?.queueTrack || function() {
			console.error('Match Monkey: dbQueue.queueTrack not loaded');
			return Promise.resolve(false);
		},
		queueTracks: window.dbQueue?.queueTracks || function() {
			console.error('Match Monkey: dbQueue.queueTracks not loaded');
			return Promise.resolve(0);
		},
		addTracksToPlaylist: window.dbQueue?.addTracksToPlaylist || function() {
			console.error('Match Monkey: dbQueue.addTracksToPlaylist not loaded');
			return Promise.resolve(0);
		},
	};
	
	return dbInterface;
}

// Create a proxy that lazily builds the interface on first access
// This ensures all sub-modules are loaded before we try to use them
window.matchMonkeyDB = new Proxy({}, {
	get: function(target, prop) {
		// Rebuild interface on each access to pick up late-loaded modules
		const db = buildDbInterface();
		return db[prop];
	}
});
