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

const library = require('./library');
const playlist = require('./playlist');
const queue = require('./queue');

module.exports = {
	// Library search operations
	findLibraryTracks: library.findLibraryTracks,
	findLibraryTracksBatch: library.findLibraryTracksBatch,

	// Playlist management operations
	createPlaylist: playlist.createPlaylist,
	findPlaylist: playlist.findPlaylist,
	getOrCreatePlaylist: playlist.getOrCreatePlaylist,

	// Queue/enqueue operations
	queueTrack: queue.queueTrack,
	queueTracks: queue.queueTracks,
	addTracksToPlaylist: queue.addTracksToPlaylist,
};
