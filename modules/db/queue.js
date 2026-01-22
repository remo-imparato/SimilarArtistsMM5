/**
 * Track Queue Module - Phase 4: Database Layer
 *
 * Handles adding tracks to playback queues, either to "Now Playing"
 * (the current playback queue) or to custom playlists.
 *
 * Supports both single track and batch operations with progress feedback.
 *
 * @module modules/db/queue
 * @requires ../ui/notifications - Progress and toast notifications
 */

const { updateProgress, showToast } = require('../ui/notifications');

/**
 * Add a single track to the Now Playing queue.
 *
 * Appends a track to the end of the current playback queue.
 * The track must be a valid MediaMonkey track object.
 *
 * @async
 * @function queueTrack
 * @param {object} track - Track object to queue
 * @param {boolean} [playNow=false] - If true, start playing immediately
 * @returns {Promise<boolean>} True if successfully queued, false otherwise
 *
 * @example
 * // Add a track to Now Playing
 * const success = await queueTrack(trackObject);
 *
 * @example
 * // Queue and start playing
 * const success = await queueTrack(trackObject, true);
 */
async function queueTrack(track, playNow = false) {
	try {
		if (!track || typeof track !== 'object') {
			console.error('queueTrack: Invalid track object');
			return false;
		}

		if (typeof app === 'undefined' || !app.player) {
			console.error('queueTrack: app.player not available');
			return false;
		}

		const player = app.player;
		const nowPlayingQueue = player.playlist;

		if (!nowPlayingQueue) {
			console.error('queueTrack: Now Playing queue not available');
			return false;
		}

		// Add track to queue
		if (typeof nowPlayingQueue.add === 'function') {
			nowPlayingQueue.add(track);
		} else if (typeof nowPlayingQueue.addTrack === 'function') {
			nowPlayingQueue.addTrack(track);
		} else {
			console.error('queueTrack: No add method available on playlist');
			return false;
		}

		// Optionally start playback
		if (playNow && typeof player.play === 'function') {
			player.play();
		}

		console.log(`queueTrack: Queued track "${track.title}"`);
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
 * Supports showing progress feedback during the operation.
 *
 * @async
 * @function queueTracks
 * @param {object[]} tracks - Array of track objects to queue
 * @param {boolean} [playNow=false] - If true, start playing immediately
 * @param {boolean} [showProgress=false] - If true, update progress bar
 * @returns {Promise<number>} Number of tracks successfully queued
 *
 * @example
 * // Queue multiple tracks
 * const count = await queueTracks(trackArray);
 * console.log(`Queued ${count} tracks`);
 *
 * @example
 * // Queue with progress feedback
 * const count = await queueTracks(trackArray, false, true);
 */
async function queueTracks(tracks, playNow = false, showProgress = false) {
	try {
		if (!Array.isArray(tracks)) {
			console.error('queueTracks: tracks must be an array');
			return 0;
		}

		if (tracks.length === 0) {
			return 0;
		}

		if (typeof app === 'undefined' || !app.player) {
			console.error('queueTracks: app.player not available');
			return 0;
		}

		const player = app.player;
		const nowPlayingQueue = player.playlist;

		if (!nowPlayingQueue) {
			console.error('queueTracks: Now Playing queue not available');
			return 0;
		}

		let queuedCount = 0;

		for (let i = 0; i < tracks.length; i++) {
			const track = tracks[i];

			if (!track || typeof track !== 'object') {
				console.warn(`queueTracks: Skipping invalid track at index ${i}`);
				continue;
			}

			try {
				if (typeof nowPlayingQueue.add === 'function') {
					nowPlayingQueue.add(track);
				} else if (typeof nowPlayingQueue.addTrack === 'function') {
					nowPlayingQueue.addTrack(track);
				} else {
					continue;
				}

				queuedCount++;

				// Show progress if requested
				if (showProgress && queuedCount % 10 === 0) {
					const progress = i / tracks.length;
					updateProgress(`Queued ${queuedCount}/${tracks.length} tracks...`, progress);
				}
			} catch (e) {
				console.warn(`queueTracks: Error queuing track ${i}: ${e.toString()}`);
				continue;
			}
		}

		// Start playback if requested
		if (playNow && queuedCount > 0 && typeof player.play === 'function') {
			player.play();
		}

		console.log(`queueTracks: Queued ${queuedCount}/${tracks.length} tracks`);
		return queuedCount;
	} catch (e) {
		console.error('queueTracks error: ' + e.toString());
		return 0;
	}
}

/**
 * Add tracks to a specific playlist.
 *
 * Appends multiple tracks to the end of a specified playlist.
 * The playlist must be a valid MediaMonkey playlist object.
 *
 * @async
 * @function addTracksToPlaylist
 * @param {object} playlist - Playlist object (from createPlaylist or findPlaylist)
 * @param {object[]} tracks - Array of track objects to add
 * @param {boolean} [showProgress=false] - If true, update progress bar
 * @returns {Promise<number>} Number of tracks successfully added
 *
 * @example
 * // Add tracks to a playlist
 * const playlist = await createPlaylist('My Collection');
 * const count = await addTracksToPlaylist(playlist, trackArray);
 * console.log(`Added ${count} tracks to playlist`);
 *
 * @example
 * // Add tracks with progress feedback
 * const count = await addTracksToPlaylist(playlist, trackArray, true);
 * await playlist.commitAsync(); // Save changes
 */
async function addTracksToPlaylist(playlist, tracks, showProgress = false) {
	try {
		if (!playlist || typeof playlist !== 'object') {
			console.error('addTracksToPlaylist: Invalid playlist object');
			return 0;
		}

		if (!Array.isArray(tracks)) {
			console.error('addTracksToPlaylist: tracks must be an array');
			return 0;
		}

		if (tracks.length === 0) {
			return 0;
		}

		let addedCount = 0;

		for (let i = 0; i < tracks.length; i++) {
			const track = tracks[i];

			if (!track || typeof track !== 'object') {
				console.warn(`addTracksToPlaylist: Skipping invalid track at index ${i}`);
				continue;
			}

			try {
				// Use add() method if available
				if (typeof playlist.add === 'function') {
					playlist.add(track);
					addedCount++;
				} else if (typeof playlist.addTrack === 'function') {
					playlist.addTrack(track);
					addedCount++;
				} else {
					console.warn(`addTracksToPlaylist: Playlist has no add method`);
					continue;
				}

				// Show progress if requested
				if (showProgress && addedCount % 10 === 0) {
					const progress = i / tracks.length;
					updateProgress(`Added ${addedCount}/${tracks.length} tracks to playlist...`, progress);
				}
			} catch (e) {
				console.warn(`addTracksToPlaylist: Error adding track ${i}: ${e.toString()}`);
				continue;
			}
		}

		// Commit changes to database
		if (typeof playlist.commitAsync === 'function') {
			await playlist.commitAsync();
		}

		console.log(`addTracksToPlaylist: Added ${addedCount}/${tracks.length} tracks to playlist`);
		return addedCount;
	} catch (e) {
		console.error('addTracksToPlaylist error: ' + e.toString());
		return 0;
	}
}

module.exports = {
	queueTrack,
	queueTracks,
	addTracksToPlaylist,
};
