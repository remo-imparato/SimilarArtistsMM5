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
 * Uses forEach pattern to avoid "Read lock not acquired" errors.
 * @param {object} node Playlist node to process
 * @param {string[]} results Array to collect playlist names
 * @param {number} depth Current recursion depth (to prevent infinite loops)
 */
function collectManualPlaylists(node, results, depth = 0) {
    if (!node || depth > 10) return; // Prevent infinite recursion

    try {
        // Get child playlists using MM5 childPlaylists property
        const children = node.childPlaylists;
        
        if (!children) {
            return;
        }

        // Get the count - must be done carefully
        const count = typeof children.count === 'function' ? children.count() : (children.count || 0);
        
        if (!count || count <= 0) return;

        log(`collectManualPlaylists: Found ${count} children at depth ${depth}`);

        // Use forEach which is safe and doesn't require locks
        if (typeof children.forEach === 'function') {
            children.forEach((child) => {
                if (!child) return;

                const name = child.title || child.name;
                if (!name) return;

                // Check if this is a manual playlist (not auto-playlist)
                const isAuto = child.isAutoPlaylist === true;

                if (!isAuto) {
                    results.push(name);
                    log(`Found manual playlist: "${name}"`);
                }

                // Recurse into child playlists
                collectManualPlaylists(child, results, depth + 1);
            });
        } else {
            // Fallback: use getValue which is safer than getFastObject
            for (let i = 0; i < count; i++) {
                try {
                    const child = children.getValue(i);
                    
                    if (!child) continue;

                    const name = child.title || child.name;
                    if (!name) continue;

                    const isAuto = child.isAutoPlaylist === true;

                    if (!isAuto) {
                        results.push(name);
                        log(`Found manual playlist: "${name}"`);
                    }

                    // Recurse into child playlists
                    collectManualPlaylists(child, results, depth + 1);

                } catch (itemErr) {
                    log(`Error processing item ${i}: ${itemErr.toString()}`);
                }
            }
        }

    } catch (e) {
        log('Error collecting playlists: ' + e.toString());
    }
}

/**
 * Get manual playlists list via database query.
 * Fallback when playlist tree traversal isn't available (e.g., node.childPlaylists undefined).
 * @returns {Promise<string[]>}
 */
async function getManualPlaylistsViaDb() {
    try {
        if (!app?.db?.getTracklist) {
            log('getManualPlaylistsViaDb: app.db.getTracklist not available');
            return [];
        }

        // Try common MM schema: Playlists table containing Title/PlaylistName and flags for auto-playlists.
        // We keep it defensive because schema can vary across builds.
        const candidates = [
            { sql: "SELECT PlaylistName AS name FROM Playlists WHERE (IsAutoPlaylist = 0 OR IsAutoPlaylist IS NULL)", col: 'name' },
            { sql: "SELECT Name AS name FROM Playlists WHERE (IsAutoPlaylist = 0 OR IsAutoPlaylist IS NULL)", col: 'name' },
            { sql: "SELECT Title AS name FROM Playlists WHERE (IsAutoPlaylist = 0 OR IsAutoPlaylist IS NULL)", col: 'name' },
            { sql: "SELECT PlaylistName AS name FROM Playlists", col: 'name' },
            { sql: "SELECT Name AS name FROM Playlists", col: 'name' },
            { sql: "SELECT Title AS name FROM Playlists", col: 'name' }
        ];

        for (const c of candidates) {
            try {
                const tl = app.db.getTracklist(c.sql, -1);
                if (!tl) continue;

                tl.autoUpdateDisabled = true;
                tl.dontNotify = true;

                await tl?.whenLoaded?.();

                const names = [];
                if (typeof tl.forEach === 'function') {
                    tl.forEach((row) => {
                        try {
                            // Tracklist rows can be “row objects” or plain objects depending on query.
                            const v = row?.getValue ? row.getValue(c.col) : row?.[c.col];
                            const s = v != null ? String(v).trim() : '';
                            if (s) names.push(s);
                        } catch (e) {
                            // ignore row
                        }
                    });
                }

                // restore flags
                tl.autoUpdateDisabled = false;
                tl.dontNotify = false;

                if (names.length) {
                    log(`getManualPlaylistsViaDb: loaded ${names.length} playlists using query: ${c.sql}`);
                    return names;
                }
            } catch (e) {
                // try next candidate
            }
        }

        log('getManualPlaylistsViaDb: no results from any candidate query');
        return [];

    } catch (e) {
        log('getManualPlaylistsViaDb error: ' + e.toString());
        return [];
    }
}

/**
 * Populate parent playlist dropdown with available manual playlists
 * @param {HTMLElement} pnl - The panel element
 * @param {string} storedParent - The currently stored parent playlist name
 */
async function populateParentPlaylist(pnl, storedParent) {
    try {
        const parentCtrl = getAllUIElements(pnl)?.SAParent?.controlClass;
        if (!parentCtrl) {
            log('populateParentPlaylist: SAParent control not found');
            return;
        }

        // Collect all manual playlists
        let allPlaylists = [];

        log('Starting playlist enumeration...');

        // First try: playlist tree traversal (if available)
        if (app.playlists?.root) {
            try {
                collectManualPlaylists(app.playlists.root, allPlaylists, 0);
            } catch (e) {
                log('populateParentPlaylist: tree traversal failed: ' + e.toString());
            }
        }

        // Fallback: DB query if tree traversal yields nothing (or childPlaylists undefined)
        if (!allPlaylists.length) {
            log('populateParentPlaylist: no playlists via tree traversal, trying DB fallback...');
            allPlaylists = await getManualPlaylistsViaDb();
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

        // Rating control uses 'value' property (-1..100). Enable unknown rating support.
        const ratingValue = (this.config.Rating === undefined || this.config.Rating === null)
            ? 0
            : parseInt(this.config.Rating, 10);
        if (UI.SARating?.controlClass) {
            UI.SARating.controlClass.useUnknown = true;
            UI.SARating.controlClass.value = Number.isFinite(ratingValue) ? ratingValue : 0;
        }
        log(`load: Rating set to ${Number.isFinite(ratingValue) ? ratingValue : 0}`);

        UI.SAUnknown.controlClass.checked = this.config.Unknown;
        UI.SAOverwrite.controlClass.value = this.config.Overwrite;
        UI.SAEnqueue.controlClass.checked = this.config.Enqueue;
        UI.SANavigate.controlClass.value = this.config.Navigate;

        // Options panel can be loaded in a different window context than the main UI,
        // so window.SimilarArtists may not be present. Try to load it; otherwise fallback to stored setting.
        const setOnPlayCheckbox = () => {
            try {
                if (window.SimilarArtists?.isAutoEnabled) {
                    UI.SAOnPlay.controlClass.checked = Boolean(window.SimilarArtists.isAutoEnabled());
                } else {
                    UI.SAOnPlay.controlClass.checked = this.config.OnPlay;
                }
            } catch (e) {
                UI.SAOnPlay.controlClass.checked = this.config.OnPlay;
            }
        };

        try {
            if (!window.SimilarArtists && typeof window.localRequirejs === 'function') {
                window.localRequirejs('similarArtists');
            }
        } catch (e) {
            // ignore, handled by fallback
        }

        setTimeout(setOnPlayCheckbox, 0);
        setTimeout(setOnPlayCheckbox, 300);

        UI.SAClearNP.controlClass.checked = this.config.ClearNP;
        UI.SAIgnore.controlClass.checked = this.config.Ignore;
        UI.SABlack.controlClass.value = this.config.Black;
        UI.SAExclude.controlClass.value = this.config.Exclude;
        UI.SAGenre.controlClass.value = this.config.Genre;

        // Populate parent playlist dropdown with available manual playlists
        // playlists may not be fully loaded when options panel is created
        populateParentPlaylist(pnl, this.config.Parent || 'Similar Artists Playlists');
        setTimeout(() => populateParentPlaylist(pnl, this.config.Parent || 'Similar Artists Playlists'), 1000);

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

        // Rating control uses 'value' property (-1..100). -1 is "unknown" when useUnknown=true.
        const ratingValue = UI.SARating?.controlClass?.value;
        if (ratingValue === -1 || ratingValue === undefined || ratingValue === null || !Number.isFinite(Number(ratingValue))) {
            this.config.Rating = 0;
        } else {
            this.config.Rating = Number(ratingValue);
        }
        log(`save: Rating = ${this.config.Rating}`);
		
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
				const count = typeof ds.count === 'function' ? ds.count() : ds.count;
				
				// Get the selected item from dataSource using forEach (safer)
				if (idx >= 0 && idx < count) {
					let selectedValue = '';
					let currentIdx = 0;
					
					if (typeof ds.forEach === 'function') {
						ds.forEach((item) => {
							if (currentIdx === idx) {
								selectedValue = item ? item.toString() : '';
							}
							currentIdx++;
						});
					} else if (typeof ds.getValue === 'function') {
						const item = ds.getValue(idx);
						selectedValue = item ? item.toString() : '';
					}
					
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