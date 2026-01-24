/**
 * Track Queue Module - Phase 4: Database Layer
 *
 * Handles adding tracks to playback queues, either to "Now Playing"
 * (the current playback queue) or to custom playlists.
 *
 * Supports both single track and batch operations with progress feedback.
 * 
 * MediaMonkey 5 API Only
 *
 * @module modules/db/queue
 */

'use strict';

/**
 * Add a single track to the Now Playing queue.
 *
 * Appends a track to the end of the current playback queue.
 *
 * @async
 * @function queueTrack
 * @param {object} track - Track object to queue
 * @param {boolean} [playNow=false] - If true, start playing immediately
 * @returns {Promise<boolean>} True if successfully queued, false otherwise
 */
async function queueTrack(track, playNow = false) {
	try {
		if (!track || typeof track !== 'object') {
			console.error('queueTrack: Invalid track object');
			return false;
		}

		if (typeof app === 'undefined' || !app.player) {
			console.error('queueTrack: MM5 app.player not available');
			return false;
		}

		// Create a tracklist with single track and use MM5's addTracksAsync
		const list = app.utils.createTracklist(true);
		list.add(track);
		await list.whenLoaded();

		await app.player.addTracksAsync(list, {
			withClear: false,
			saveHistory: true,
			startPlayback: playNow,
		});

		console.log(`queueTrack: Queued track "${track.title || track.SongTitle}"`);
		return true;
	} catch (e) {
		console.error('queueTrack error: ' + e.toString());
		return false;
	}
}

/**
 * Add multiple tracks to the Now Playing queue in batch.
 *
 * More efficient than calling queueTrack multiple times.
 *
 * @async
 * @function queueTracks
 * @param {object[]} tracks - Array of track objects to queue
 * @param {boolean} [playNow=false] - If true, start playing immediately
 * @param {boolean} [clearFirst=false] - If true, clear queue before adding
 * @returns {Promise<number>} Number of tracks successfully queued
 */
async function queueTracks(tracks, playNow = false, clearFirst = false) {
	try {
		if (!Array.isArray(tracks) || tracks.length === 0) {
			return 0;
		}

		if (typeof app === 'undefined' || !app.player) {
			console.error('queueTracks: MM5 app.player not available');
			return 0;
		}

		// Create tracklist with all valid tracks
		const list = app.utils.createTracklist(true);
		let validCount = 0;
		
		for (const track of tracks) {
			if (track && typeof track === 'object') {
				list.add(track);
				validCount++;
			}
		}

		if (validCount === 0) {
			return 0;
		}

		await list.whenLoaded();

		// Use MM5's addTracksAsync with batch options
		await app.player.addTracksAsync(list, {
			withClear: clearFirst,
			saveHistory: true,
			startPlayback: playNow,
		});

		console.log(`queueTracks: Queued ${validCount} tracks`);
		return validCount;
	} catch (e) {
		console.error('queueTracks error: ' + e.toString());
		return 0;
	}
}

/**
 * Add tracks to a specific playlist.
 *
 * Appends multiple tracks to the end of a specified playlist.
 *
 * @async
 * @function addTracksToPlaylist
 * @param {object} playlist - Playlist object (from createPlaylist or findPlaylist)
 * @param {object[]} tracks - Array of track objects to add
 * @param {boolean} [clearFirst=false] - If true, clear playlist before adding
 * @returns {Promise<number>} Number of tracks successfully added
 */
async function addTracksToPlaylist(playlist, tracks, clearFirst = false) {
	try {
		if (!playlist || typeof playlist !== 'object') {
			console.error('addTracksToPlaylist: Invalid playlist object');
			return 0;
		}

		if (!Array.isArray(tracks) || tracks.length === 0) {
			return 0;
		}

		// Clear playlist if requested
		if (clearFirst) {
			try {
				if (typeof playlist.clear === 'function') {
					playlist.clear();
				} else if (typeof playlist.removeAllTracks === 'function') {
					playlist.removeAllTracks();
				}
			} catch (e) {
				console.warn(`addTracksToPlaylist: Error clearing playlist: ${e.toString()}`);
			}
		}

		let addedCount = 0;

		for (const track of tracks) {
			if (!track || typeof track !== 'object') {
				continue;
			}

			try {
				// Use add() method (MM5 standard)
				if (typeof playlist.add === 'function') {
					playlist.add(track);
					addedCount++;
				} else if (typeof playlist.addTrack === 'function') {
					playlist.addTrack(track);
					addedCount++;
				}
			} catch (e) {
				console.warn(`addTracksToPlaylist: Error adding track: ${e.toString()}`);
			}
		}

		// Commit changes to database
		if (addedCount > 0 && typeof playlist.commitAsync === 'function') {
			await playlist.commitAsync();
		}

		console.log(`addTracksToPlaylist: Added ${addedCount} tracks to playlist`);
		return addedCount;
	} catch (e) {
		console.error('addTracksToPlaylist error: ' + e.toString());
		return 0;
	}
}

// Export to window namespace for MM5
window.dbQueue = {
	queueTrack,
	queueTracks,
	addTracksToPlaylist,
};
