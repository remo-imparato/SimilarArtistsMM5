/**
 * SimilarArtists Options Panel for MediaMonkey 5
 * 
 * @author Remo Imparato
 * @version 2.0.0
 * @description Configuration panel for SimilarArtists add-on in MM5 Tools > Options.
 *              Provides UI for configuring Last.fm API settings, playlist creation options,
 *              filters, and automatic behavior.
 * 
 * @repository https://github.com/remo-imparato/SimilarArtistsMM5
 * @license MIT
 * 
 * Features:
 * - Last.fm API key configuration
 * - Playlist naming and creation modes
 * - Artist/track limits and filtering options
 * - Rating-based filtering
 * - Parent playlist selection
 * - Auto-enqueue and navigation settings
 * 
 * Requirements:
 * - MediaMonkey 5.0+
 * - SimilarArtists add-on installed
 */

// Helper get/set that use the SimilarArtists namespace
function setSetting(key, value) {
    try {
        app.setValue?.('SimilarArtists', key, value);
    } catch (e) {
        // fallback
        try { app.setValue && app.setValue(key, value); } catch (e) {}
    }
}

function getSetting(key, defaultValue) {
    try {
        const v = app.getValue?.('SimilarArtists', key);
        return (v === undefined || v === null) ? defaultValue : v;
    } catch (e) {
        try { return app.getValue ? app.getValue(key, defaultValue) : defaultValue; } catch (e) { return defaultValue; }
    }
}

function intSetting(key) {
    const v = getSetting(key, defaults[key]);
    return parseInt(v, 10) || 0;
}

function boolSetting(key) {
    const v = getSetting(key, defaults[key]);
    return Boolean(v);
}

function stringSetting(key) {
    const v = getSetting(key, defaults[key]);
    return v == null ? '' : String(v);
}

// Defaults matching similarArtists.js
const defaults = {
	ApiKey: app?.utils?.web?.getAPIKey('lastfmApiKey') || '7fd988db0c4e9d8b12aed27d0a91a932',
	Confirm: true,
	Sort: false,
	Limit: 5,
	Name: 'Artists similar to %',
	TPA: 9999,
	TPL: 9999,
	Random: false,
	Seed: false,
	Seed2: false,
	Best: false,
	Rank: false,
	Rating: 0,
	Unknown: true,
	Overwrite: 'Create new playlist',
	Enqueue: false,
	Navigate: 'None',
	OnPlay: false,
	ClearNP: false,
	Ignore: false,
	Parent: 'Similar Artists Playlists',
	Black: '',
	Exclude: '',
	Genre: '',
};

function log(txt) {
    try { console.log('SimilarArtists Options: ' + txt); } catch (e) {}
}

/**
 * Recursively collect all manual (non-auto) playlists from the playlist tree.
 * @param {object} node Playlist node to process
 * @param {string[]} results Array to collect playlist names
 * @param {string} prefix Path prefix for nested playlists (optional)
 * @param {number} depth Current recursion depth (to prevent infinite loops)
 */
function collectManualPlaylists(node, results, prefix = '', depth = 0) {
    if (!node || depth > 10) return; // Prevent infinite recursion

    try {
        // Get child playlists using MM5 childPlaylists property
        const children = node.childPlaylists;
        
        if (!children) {
            log(`collectManualPlaylists: No childPlaylists at depth ${depth}`);
            return;
        }

        // Get count - it's a property in MM5, not a function
        const count = typeof children.count === 'function' ? children.count() : children.count;
        log(`collectManualPlaylists: Found ${count} children at depth ${depth}, prefix="${prefix}"`);

        if (!count || count <= 0) return;

        // Iterate using locked() pattern for thread safety (MM5 standard)
        if (typeof children.locked === 'function') {
            children.locked(() => {
                let child;
                for (let i = 0; i < count; i++) {
                    child = children.getFastObject ? children.getFastObject(i, child) : children.getValue(i);
                    if (child) {
                        processPlaylistNode(child, results, prefix, depth);
                    }
                }
            });
        } else if (typeof children.forEach === 'function') {
            // Fallback to forEach if available
            children.forEach((child) => {
                if (child) {
                    processPlaylistNode(child, results, prefix, depth);
                }
            });
        } else {
            // Manual iteration fallback
            for (let i = 0; i < count; i++) {
                const child = children.getValue ? children.getValue(i) : children[i];
                if (child) {
                    processPlaylistNode(child, results, prefix, depth);
                }
            }
        }
    } catch (e) {
        log('Error collecting playlists: ' + e.toString());
    }
}

/**
 * Process a single playlist node - add if manual, recurse for children
 * @param {object} playlist Playlist object
 * @param {string[]} results Array to collect playlist names
 * @param {string} prefix Path prefix for nested playlists
 * @param {number} depth Current recursion depth
 */
function processPlaylistNode(playlist, results, prefix, depth) {
    if (!playlist) return;

    try {
        const name = playlist.title || playlist.name;
        if (!name) return;

        // Check if this is a manual playlist (not auto-playlist)
        // In MM5, auto playlists have isAutoPlaylist property
        const isAuto = playlist.isAutoPlaylist === true;

        if (!isAuto) {
            // This is a manual playlist - add it with just the name (not nested path for simplicity)
            results.push(name);
            log(`Found manual playlist: "${name}" (isAuto=${isAuto})`);
        } else {
            log(`Skipping auto playlist: "${name}"`);
        }

        // Recurse into child playlists
        collectManualPlaylists(playlist, results, name, depth + 1);

    } catch (e) {
        log('Error processing playlist node: ' + e.toString());
    }
}

/**
 * Populate parent playlist dropdown with available manual playlists
 * @param {HTMLElement} pnl - The panel element
 * @param {string} storedParent - The currently stored parent playlist name
 */
function populateParentPlaylist(pnl, storedParent) {
    try {
        const parentCtrl = getAllUIElements(pnl)?.SAParent?.controlClass;
        if (!parentCtrl) {
            log('populateParentPlaylist: SAParent control not found');
            return;
        }

        // Collect all manual playlists
        const allPlaylists = [];
        
        log('Starting playlist enumeration...');

        if (app.playlists?.root) {
            collectManualPlaylists(app.playlists.root, allPlaylists, '', 0);
        }

        log(`Found ${allPlaylists.length} manual playlist(s)`);

        // Remove duplicates and sort
        const uniquePlaylists = [...new Set(allPlaylists)];
        uniquePlaylists.sort((a, b) => a.localeCompare(b));
        const items = ['[None]'].concat(uniquePlaylists);

        log('Populating dropdown with ' + items.length + ' items');

        // Create StringList dataSource (MM5 standard pattern)
        const stringListFactory = app.utils?.newStringList || window.newStringList;
        if (typeof stringListFactory !== 'function') {
            log('newStringList() not available');
            return;
        }

        const stringList = stringListFactory();
        items.forEach(item => stringList.add(item));
        
        // Set dataSource
        parentCtrl.dataSource = stringList;

        // Set focused index to match stored parent
        const defaultParent = storedParent || 'Similar Artists Playlists';
        const foundIndex = items.indexOf(defaultParent);
        parentCtrl.focusedIndex = foundIndex >= 0 ? foundIndex : 0;

        log(`Set focusedIndex to ${parentCtrl.focusedIndex} (${items[parentCtrl.focusedIndex]})`);

    } catch (e) {
        log('populateParentPlaylist error: ' + e.toString());
    }
}

optionPanels.pnl_Library.subPanels.pnl_SimilarArtists.load = function (sett, pnl, wndParams) {
    try {
		this.config = app.getValue('SimilarArtists', defaults);

		var UI = getAllUIElements(pnl);
		UI.SAApiKey.controlClass.value = this.config.ApiKey;
		UI.SAConfirm.controlClass.checked = this.config.Confirm;
		UI.SASort.controlClass.checked = this.config.Sort;
		UI.SALimit.controlClass.value = this.config.Limit;
		UI.SAName.controlClass.value = this.config.Name;
		UI.SATPA.controlClass.value = this.config.TPA;
		UI.SATPL.controlClass.value = this.config.TPL;
		UI.SARandom.controlClass.checked = this.config.Random;
		UI.SASeed.controlClass.checked = this.config.Seed;
		UI.SASeed2.controlClass.checked = this.config.Seed2;
		UI.SABest.controlClass.checked = this.config.Best;
		UI.SARank.controlClass.checked = this.config.Rank;
		UI.SARating.controlClass.value = this.config.Rating;
		UI.SAUnknown.controlClass.checked = this.config.Unknown;
		UI.SAOverwrite.controlClass.value = this.config.Overwrite;
		UI.SAEnqueue.controlClass.checked = this.config.Enqueue;
		UI.SANavigate.controlClass.value = this.config.Navigate;
		UI.SAOnPlay.controlClass.checked = this.config.OnPlay;
		UI.SAClearNP.controlClass.checked = this.config.ClearNP;
		UI.SAIgnore.controlClass.checked = this.config.Ignore;
		UI.SABlack.controlClass.value = this.config.Black;
		UI.SAExclude.controlClass.value = this.config.Exclude;
		UI.SAGenre.controlClass.value = this.config.Genre;

		// Populate parent playlist dropdown with available manual playlists
		// Default to 'Similar Artists Playlists' if not yet set
		populateParentPlaylist(pnl, this.config.Parent || 'Similar Artists Playlists');

    } catch (e) {
        log('load error: ' + e.toString());
    }
}

optionPanels.pnl_Library.subPanels.pnl_SimilarArtists.save = function (sett) {
    try {
		var UI = getAllUIElements();

		this.config.ApiKey = UI.SAApiKey.controlClass.value;
		this.config.Confirm = UI.SAConfirm.controlClass.checked;
		this.config.Sort = UI.SASort.controlClass.checked;
		this.config.Limit = UI.SALimit.controlClass.value;
		this.config.Name = UI.SAName.controlClass.value;
		this.config.TPA = UI.SATPA.controlClass.value;
		this.config.TPL = UI.SATPL.controlClass.value;
		this.config.Random = UI.SARandom.controlClass.checked;
		this.config.Seed = UI.SASeed.controlClass.checked;
		this.config.Seed2 = UI.SASeed2.controlClass.checked;
		this.config.Best = UI.SABest.controlClass.checked;
		this.config.Rank = UI.SARank.controlClass.checked;
		this.config.Rating = UI.SARating.controlClass.value;
		this.config.Unknown = UI.SAUnknown.controlClass.checked;
		this.config.Overwrite = UI.SAOverwrite.controlClass.value;
		this.config.Enqueue = UI.SAEnqueue.controlClass.checked;
		this.config.Navigate = UI.SANavigate.controlClass.value;
		this.config.OnPlay = UI.SAOnPlay.controlClass.checked;
		this.config.ClearNP = UI.SAClearNP.controlClass.checked;
		this.config.Ignore = UI.SAIgnore.controlClass.checked;
		this.config.Black = UI.SABlack.controlClass.value;
		this.config.Exclude = UI.SAExclude.controlClass.value;
		this.config.Genre = UI.SAGenre.controlClass.value;

		// Get selected parent playlist using MM5 pattern (focusedIndex + dataSource)
		try {
			const parentCtrl = UI.SAParent?.controlClass;
			if (parentCtrl && parentCtrl.dataSource && typeof parentCtrl.focusedIndex !== 'undefined') {
				const ds = parentCtrl.dataSource;
				const idx = parentCtrl.focusedIndex;
				
				// Get the selected item from dataSource
				if (idx >= 0 && idx < ds.count) {
					const selectedItem = ds.getValue(idx);
					const selectedValue = selectedItem ? selectedItem.toString() : '';
					
					// Store empty string if [None] is selected, otherwise store the playlist name
					this.config.Parent = (selectedValue === '[None]') ? '' : selectedValue;
					log(`save: Parent playlist = "${this.config.Parent}" (index ${idx})`);
				} else {
					this.config.Parent = '';
					log('save: No valid selection, Parent = ""');
				}
			} else {
				// Fallback if dataSource not available
				this.config.Parent = '';
				log('save: dataSource not available, Parent = ""');
			}
		} catch (e) {
			log('save: Error reading Parent playlist: ' + e.toString());
			this.config.Parent = '';
		}

		app.setValue('SimilarArtists', this.config);

    } catch (e) {
        log('save error: ' + e.toString());
    }
}

optionPanels.pnl_Library.subPanels.pnl_SimilarArtists.beforeWindowCleanup = function () {
	// Cleanup if needed
}