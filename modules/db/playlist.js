/**
 * Playlist Management Module - Phase 4: Database Layer
 *
 * Handles MediaMonkey playlist operations including creation, retrieval,
 * and population with tracks from the library.
 *
 * @module modules/db/playlist
 * @requires ../ui/notifications - Progress and toast notifications
 */

'use strict';

/**
 * Create a new playlist in MediaMonkey.
 *
 * Creates a new user playlist with the specified name. The playlist
 * will be added to the user's playlist collection and made available
 * for track operations.
 *
 * @async
 * @function createPlaylist
 * @param {string} playlistName - Name for the new playlist
 * @param {boolean} [autoOverwrite=false] - If true, overwrites existing playlist with same name
 * @returns {Promise<object|null>} Playlist object with methods:
 *   - add(track) - Add a track to the playlist
 *   - addTracklist(tracklist) - Add multiple tracks
 *   - commitAsync() - Save changes to database
 *   Or null if creation failed
 *
 * @example
 * // Create a new playlist
 * const playlist = await createPlaylist('Similar Artists - Pink Floyd');
 * if (playlist) {
 *   // Add tracks to the playlist
 *   playlist.add(trackObject);
 *   await playlist.commitAsync();
 * }
 *
 * @example
 * // Create or overwrite existing playlist
 * const playlist = await createPlaylist('My Favorites', true);
 */
async function createPlaylist(playlistName, autoOverwrite = false) {
	try {
		if (!playlistName || String(playlistName).trim().length === 0) {
			console.error('createPlaylist: Invalid playlist name');
			return null;
		}

		const name = String(playlistName).trim();

		// Get root playlists collection
		if (typeof app === 'undefined' || !app.playlists) {
			console.error('createPlaylist: app.playlists not available');
			return null;
		}

		// Check for existing playlist with the same name
		if (autoOverwrite) {
			const existing = findPlaylist(name);
			if (existing) {
				console.log(`createPlaylist: Removing existing playlist "${name}"`);
				try {
					await existing.removeAsync?.();
				} catch (e) {
					console.warn(`createPlaylist: Could not remove existing playlist: ${e.toString()}`);
				}
			}
		}

		// Create new playlist under root
		const newPlaylist = app.playlists.root.newPlaylist();
		if (!newPlaylist) {
			console.error('createPlaylist: Failed to create new playlist object');
			return null;
		}

		newPlaylist.title = name;

		// Commit changes to database
		await newPlaylist.commitAsync();

		console.log(`createPlaylist: Created playlist "${name}"`);
		window.updateProgress(`Created playlist "${name}"`);

		return newPlaylist;
	} catch (e) {
		console.error('createPlaylist error: ' + e.toString());
		return null;
	}
}

/**
 * Find an existing playlist by name in MediaMonkey.
 *
 * Searches the user's playlist collection for a playlist matching
 * the specified name (case-sensitive).
 *
 * @function findPlaylist
 * @param {string} playlistName - Name of playlist to find
 * @returns {object|null} Playlist object if found, null otherwise
 *
 * @example
 * // Find existing playlist
 * const playlist = findPlaylist('My Favorites');
 * if (playlist) {
 *   console.log('Found playlist:', playlist.title);
 * }
 */
function findPlaylist(playlistName) {
	try {
		if (!playlistName || String(playlistName).trim().length === 0) {
			return null;
		}

		if (typeof app === 'undefined' || !app.playlists) {
			console.warn('findPlaylist: app.playlists not available');
			return null;
		}

		const targetName = String(playlistName).trim();

		// Recursive search through playlist hierarchy
		function searchNode(node) {
			if (!node) return null;

			// Check if this node is the target playlist
			if (node.title === targetName) {
				return node;
			}

			// Search in child playlists if available
			if (node.childNodes && Array.isArray(node.childNodes)) {
				for (const child of node.childNodes) {
					const found = searchNode(child);
					if (found) return found;
				}
			}

			return null;
		}

		// Start search from root
		const result = searchNode(app.playlists.root);
		if (result) {
			console.log(`findPlaylist: Found playlist "${targetName}"`);
			return result;
		}

		console.log(`findPlaylist: Playlist "${targetName}" not found`);
		return null;
	} catch (e) {
		console.error('findPlaylist error: ' + e.toString());
		return null;
	}
}

/**
 * Get or create a playlist, preferring to find existing if available.
 *
 * Attempts to find an existing playlist by name. If not found, creates
 * a new one. Useful for operations that want to reuse existing playlists
 * when possible.
 *
 * @async
 * @function getOrCreatePlaylist
 * @param {string} playlistName - Name of the playlist
 * @returns {Promise<object|null>} Playlist object or null on failure
 *
 * @example
 * // Get or create "My Artists" playlist
 * const playlist = await getOrCreatePlaylist('My Artists');
 */
async function getOrCreatePlaylist(playlistName) {
	try {
		// First try to find existing
		const existing = findPlaylist(playlistName);
		if (existing) {
			console.log(`getOrCreatePlaylist: Using existing playlist "${playlistName}"`);
			return existing;
		}

		// If not found, create new
		console.log(`getOrCreatePlaylist: Creating new playlist "${playlistName}"`);
		return await createPlaylist(playlistName);
	} catch (e) {
		console.error('getOrCreatePlaylist error: ' + e.toString());
		return null;
	}
}

// Export to window namespace for MM5
window.dbPlaylist = {
	createPlaylist,
	findPlaylist,
	getOrCreatePlaylist,
};
