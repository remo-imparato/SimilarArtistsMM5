/**
 * Database Layer Module - Phase 4
 *
 * Unified interface for all database operations:
 * - Library track searching (single and batch)
 * - Playlist creation and management
 * - Track queue operations (Now Playing)
 *
 * All functions use the MediaMonkey 5 API (`app.db`, `app.player`) and provide
 * error handling with graceful degradation.
 *

 *
 * @module modules/db
 */

'use strict';

// Defer building the export object until modules are loaded
function buildDbInterface() {
	return {
		// Library search operations (from window.dbLibrary)
		findLibraryTracks: window.dbLibrary?.findLibraryTracks || (() => Promise.resolve([])),
		findLibraryTracksBatch: window.dbLibrary?.findLibraryTracksBatch || (() => Promise.resolve(new Map())),

		// Playlist operations (from window.dbPlaylist)
		findPlaylist: window.dbPlaylist?.findPlaylist || (() => null),
		findPlaylistUnderParent: window.dbPlaylist?.findPlaylistUnderParent || (() => null),
		createPlaylist: window.dbPlaylist?.createPlaylist || (() => Promise.resolve(null)),
		clearPlaylistTracks: window.dbPlaylist?.clearPlaylistTracks || (() => Promise.resolve(false)),
		addTracksToPlaylist: window.dbPlaylist?.addTracksToPlaylist || (() => Promise.resolve(0)),
		deletePlaylist: window.dbPlaylist?.deletePlaylist || (() => Promise.resolve(false)),
		resolveTargetPlaylist: window.dbPlaylist?.resolveTargetPlaylist || (() => Promise.resolve({ playlist: null, shouldClear: false })),
		getOrCreatePlaylist: window.dbPlaylist?.getOrCreatePlaylist || (() => Promise.resolve(null)),

		// Queue operations (from window.dbQueue)
		queueTrack: window.dbQueue?.queueTrack || (() => Promise.resolve(false)),
		queueTracks: window.dbQueue?.queueTracks || (() => Promise.resolve(0)),
	};
}

// Create a proxy that lazily builds the interface on first access
window.matchMonkeyDB = new Proxy({}, {
	get: function(target, prop) {
		const db = buildDbInterface();
		return db[prop];
	}
});
