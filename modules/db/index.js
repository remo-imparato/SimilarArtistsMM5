/**
 * Database Layer Module - Phase 4
 *
 * Unified interface for all database operations:
 * - Library track searching (single and batch)
 * - Playlist creation and management
 * - Track queue operations (Now Playing and custom playlists)
 *
 * All functions use the MediaMonkey API (`app.db`, `app.player`) and provide
 * error handling with graceful degradation.
 *
 * @module modules/db
 * @exports {object} Database operations grouped by category
 */

'use strict';

// Export unified interface to window namespace for MM5
window.similarArtistsDB = {
	// Library search operations (from window.dbLibrary)
	findLibraryTracks: window.dbLibrary.findLibraryTracks,
	findLibraryTracksBatch: window.dbLibrary.findLibraryTracksBatch,

	// Playlist management operations (from window.dbPlaylist)
	createPlaylist: window.dbPlaylist.createPlaylist,
	findPlaylist: window.dbPlaylist.findPlaylist,
	getOrCreatePlaylist: window.dbPlaylist.getOrCreatePlaylist,

	// Queue/enqueue operations (from window.dbQueue)
	queueTrack: window.dbQueue.queueTrack,
	queueTracks: window.dbQueue.queueTracks,
	addTracksToPlaylist: window.dbQueue.addTracksToPlaylist,
};
