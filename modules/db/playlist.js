/**
 * Playlist Management Module - Phase 4: Database Layer
 *
 * Handles MediaMonkey 5 playlist operations using only documented API methods:
 * - Properties: childrenCount, id, isAutoPlaylist, name, parent, parentID
 * - Methods: addTracksAsync, clearTracksAsync, commitAsync, deleteAsync, 
 *            getChildren, getTracklist, newPlaylist
 * 
 * @module modules/db/playlist
 */

'use strict';

/**
 * Find a playlist by name anywhere in the playlist tree.
 * Searches recursively through all playlists.
 *
 * @param {string} playlistName - Name of playlist to find (case-insensitive)
 * @returns {object|null} Playlist object if found, null otherwise
 */
function findPlaylist(playlistName) {
	if (!playlistName || String(playlistName).trim().length === 0) {
		return null;
	}

	if (typeof app === 'undefined' || !app.playlists?.root) {
		console.warn('findPlaylist: app.playlists.root not available');
		return null;
	}

	const targetName = String(playlistName).trim().toLowerCase();

	function searchNode(node) {
		if (!node) return null;

		// Check this node's name
		const nodeName = node.name || '';
		if (nodeName.toLowerCase() === targetName) {
			return node;
		}

		// Search children using getChildren() - the documented MM5 method
		const children = node.getChildren?.() || [];
		for (const child of children) {
			const found = searchNode(child);
			if (found) return found;
		}

		return null;
	}

	const result = searchNode(app.playlists.root);
	console.log(`findPlaylist: "${playlistName}" ${result ? 'found' : 'not found'}`);
	return result;
}

/**
 * Find a playlist by name that is a direct child of a parent playlist.
 * Only searches immediate children, not recursively.
 *
 * @param {string} playlistName - Name of playlist to find (case-insensitive)
 * @param {object} parentPlaylist - Parent playlist node to search under
 * @returns {object|null} Playlist object if found, null otherwise
 */
function findPlaylistUnderParent(playlistName, parentPlaylist) {
	if (!playlistName || !parentPlaylist) {
		return null;
	}

	const targetName = String(playlistName).trim().toLowerCase();
	const children = parentPlaylist.getChildren?.() || [];

	for (const child of children) {
		const childName = child.name || '';
		if (childName.toLowerCase() === targetName) {
			console.log(`findPlaylistUnderParent: Found "${playlistName}" under parent`);
			return child;
		}
	}

	console.log(`findPlaylistUnderParent: "${playlistName}" not found under parent`);
	return null;
}

/**
 * Create a new playlist under a specified parent (or root if null).
 * Uses MM5's newPlaylist() and commitAsync() methods.
 *
 * @async
 * @param {string} playlistName - Name for the new playlist
 * @param {object|null} parentPlaylist - Parent playlist node, or null for root
 * @returns {Promise<object|null>} Created playlist object or null on failure
 */
async function createPlaylist(playlistName, parentPlaylist = null) {
	if (!playlistName || String(playlistName).trim().length === 0) {
		console.error('createPlaylist: Invalid playlist name');
		return null;
	}

	if (typeof app === 'undefined' || !app.playlists?.root) {
		console.error('createPlaylist: app.playlists.root not available');
		return null;
	}

	const name = String(playlistName).trim();
	const targetNode = parentPlaylist || app.playlists.root;

	try {
		// Create new playlist using MM5's newPlaylist() method
		const playlist = targetNode.newPlaylist();
		if (!playlist) {
			console.error('createPlaylist: newPlaylist() returned null');
			return null;
		}

		// Set the name
		playlist.name = name;

		// Commit to database using commitAsync()
		await playlist.commitAsync();

		console.log(`createPlaylist: Created "${name}"${parentPlaylist ? ' under parent' : ' at root'}`);
		return playlist;

	} catch (e) {
		console.error('createPlaylist error:', e);
		return null;
	}
}

/**
 * Clear all tracks from a playlist using clearTracksAsync().
 *
 * @async
 * @param {object} playlist - Playlist object to clear
 * @returns {Promise<boolean>} True if cleared successfully
 */
async function clearPlaylistTracks(playlist) {
	if (!playlist) {
		return false;
	}

	try {
		// Use MM5's clearTracksAsync method
		await playlist.clearTracksAsync();
		console.log(`clearPlaylistTracks: Cleared "${playlist.name}"`);
		return true;
	} catch (e) {
		console.error('clearPlaylistTracks error:', e);
		return false;
	}
}

/**
 * Add tracks to a playlist using addTracksAsync().
 *
 * @async
 * @param {object} playlist - Playlist object
 * @param {object[]} tracks - Array of track objects to add
 * @returns {Promise<number>} Number of tracks added
 */
async function addTracksToPlaylist(playlist, tracks) {
	if (!playlist || !Array.isArray(tracks) || tracks.length === 0) {
		return 0;
	}

	try {
		// Create a tracklist with all tracks
		const tracklist = app.utils.createTracklist(true);
		let validCount = 0;

		for (const track of tracks) {
			if (track && typeof track === 'object') {
				tracklist.add(track);
				validCount++;
			}
		}

		if (validCount === 0) {
			return 0;
		}

		await tracklist.whenLoaded();

		// Use MM5's addTracksAsync method
		await playlist.addTracksAsync(tracklist);

		console.log(`addTracksToPlaylist: Added ${validCount} tracks to "${playlist.name}"`);
		return validCount;

	} catch (e) {
		console.error('addTracksToPlaylist error:', e);
		return 0;
	}
}

/**
 * Delete a playlist using deleteAsync().
 *
 * @async
 * @param {object} playlist - Playlist object to delete
 * @returns {Promise<boolean>} True if deleted successfully
 */
async function deletePlaylist(playlist) {
	if (!playlist) {
		return false;
	}

	try {
		await playlist.deleteAsync();
		console.log(`deletePlaylist: Deleted "${playlist.name}"`);
		return true;
	} catch (e) {
		console.error('deletePlaylist error:', e);
		return false;
	}
}

/**
 * Resolve the target playlist based on settings and mode.
 * 
 * Handles:
 * - Parent playlist: finds or creates if specified
 * - Playlist mode: Create new (with unique naming) or Overwrite existing
 * - Returns the playlist and whether it should be cleared
 *
 * @async
 * @param {string} playlistName - Desired playlist name
 * @param {string} parentName - Name of parent playlist (empty for root)
 * @param {string} playlistMode - 'Create new playlist' or 'Overwrite existing playlist'
 * @param {object|null} userSelectedPlaylist - User-selected playlist from dialog (overrides auto-creation)
 * @returns {Promise<{playlist: object|null, shouldClear: boolean}>}
 */
async function resolveTargetPlaylist(playlistName, parentName, playlistMode, userSelectedPlaylist = null) {
	// If user selected a playlist via dialog, use that
	if (userSelectedPlaylist && !userSelectedPlaylist.autoCreate) {
		console.log(`resolveTargetPlaylist: Using user-selected playlist`);
		return {
			playlist: userSelectedPlaylist,
			shouldClear: playlistMode.toLowerCase().includes('overwrite'),
		};
	}

	// Determine the parent node
	let parentPlaylist = null;
	if (parentName && parentName.trim()) {
		parentPlaylist = findPlaylist(parentName.trim());
		if (!parentPlaylist) {
			// Create the parent playlist at root
			console.log(`resolveTargetPlaylist: Creating parent playlist "${parentName}"`);
			parentPlaylist = await createPlaylist(parentName.trim(), null);
		}
	}

	const isOverwriteMode = playlistMode.toLowerCase().includes('overwrite');

	if (isOverwriteMode) {
		// Look for existing playlist to overwrite
		const existing = parentPlaylist
			? findPlaylistUnderParent(playlistName, parentPlaylist)
			: findPlaylist(playlistName);

		if (existing) {
			console.log(`resolveTargetPlaylist: Found existing playlist to overwrite`);
			return { playlist: existing, shouldClear: true };
		}
	}

	// Create new playlist mode - need unique name if playlist exists
	let finalName = playlistName;
	if (!isOverwriteMode) {
		let counter = 1;
		let testName = playlistName;
		
		// Check for existing playlist with same name
		const checkExists = parentPlaylist
			? (name) => findPlaylistUnderParent(name, parentPlaylist)
			: (name) => findPlaylist(name);

		while (checkExists(testName)) {
			counter++;
			testName = `${playlistName}_${counter}`;
			if (counter > 100) break; // Safety limit
		}
		finalName = testName;
	}

	// Create the new playlist
	const newPlaylist = await createPlaylist(finalName, parentPlaylist);
	return { playlist: newPlaylist, shouldClear: false };
}

/**
 * Get or create a playlist by name at root level.
 *
 * @async
 * @param {string} playlistName - Name of the playlist
 * @returns {Promise<object|null>} Playlist object or null on failure
 */
async function getOrCreatePlaylist(playlistName) {
	const existing = findPlaylist(playlistName);
	if (existing) {
		console.log(`getOrCreatePlaylist: Using existing "${playlistName}"`);
		return existing;
	}

	console.log(`getOrCreatePlaylist: Creating new "${playlistName}"`);
	return await createPlaylist(playlistName, null);
}

// Export to window namespace for MM5
window.dbPlaylist = {
	findPlaylist,
	findPlaylistUnderParent,
	createPlaylist,
	clearPlaylistTracks,
	addTracksToPlaylist,
	deletePlaylist,
	resolveTargetPlaylist,
	getOrCreatePlaylist,
};
