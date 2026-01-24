/**
 * Playlist Management Module - Phase 4: Database Layer
 *
 * Handles MediaMonkey playlist operations including creation, retrieval,
 * and population with tracks from the library.
 * 
 * MediaMonkey 5 API Only
 *
 * @module modules/db/playlist
 */

'use strict';

/**
 * Create a new playlist in MediaMonkey.
 *
 * Creates a new user playlist with the specified name. The playlist
 * will be added to the user's playlist collection.
 *
 * @async
 * @function createPlaylist
 * @param {string} playlistName - Name for the new playlist
 * @param {boolean} [autoOverwrite=false] - If true, removes existing playlist with same name first
 * @returns {Promise<object|null>} Playlist object or null if creation failed
 */
async function createPlaylist(playlistName, autoOverwrite = false) {
	try {
		if (!playlistName || String(playlistName).trim().length === 0) {
			console.error('createPlaylist: Invalid playlist name');
			return null;
		}

		const name = String(playlistName).trim();

		// Validate MM5 environment
		if (typeof app === 'undefined' || !app.playlists) {
			console.error('createPlaylist: MM5 app.playlists not available');
			return null;
		}

		// Remove existing playlist if overwrite requested
		if (autoOverwrite) {
			const existing = findPlaylist(name);
			if (existing) {
				console.log(`createPlaylist: Removing existing playlist "${name}"`);
				try {
					if (typeof existing.removeAsync === 'function') {
						await existing.removeAsync();
					} else if (typeof existing.remove === 'function') {
						existing.remove();
					}
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
 * the specified name (case-insensitive).
 *
 * @function findPlaylist
 * @param {string} playlistName - Name of playlist to find
 * @returns {object|null} Playlist object if found, null otherwise
 */
function findPlaylist(playlistName) {
	try {
		if (!playlistName || String(playlistName).trim().length === 0) {
			return null;
		}

		if (typeof app === 'undefined' || !app.playlists) {
			console.warn('findPlaylist: MM5 app.playlists not available');
			return null;
		}

		const targetName = String(playlistName).trim().toLowerCase();

		// Recursive search through playlist hierarchy
		function searchNode(node) {
			if (!node) return null;

			// Check if this node is the target playlist (case-insensitive)
			if (node.title && node.title.toLowerCase() === targetName) {
				return node;
			}

			// Search in child playlists if available
			if (node.childNodes) {
				// childNodes may be array or list-like
				const children = Array.isArray(node.childNodes) 
					? node.childNodes 
					: (node.childNodes.length ? Array.from(node.childNodes) : []);
				
				for (const child of children) {
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
 * a new one.
 *
 * @async
 * @function getOrCreatePlaylist
 * @param {string} playlistName - Name of the playlist
 * @returns {Promise<object|null>} Playlist object or null on failure
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
