/**
 * SimilarArtists Options Panel for MediaMonkey 5
 * 
 * @author Remo Imparato
 * @description Configuration panel for SimilarArtists add-on in MM5 Tools > Options
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
 * Populate parent playlist dropdown with available playlists
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

        // Get all playlists and sort by name
        const allPlaylists = [];
        try {
            if (app.playlists?.getAll && typeof app.playlists.getAll === 'function') {
                const pls = app.playlists.getAll();
                if (Array.isArray(pls)) {
                    pls.forEach(p => { 
                        if (p && (p.title || p.name)) {
                            allPlaylists.push(p.title || p.name);
                        }
                    });
                    log(`Retrieved ${allPlaylists.length} playlists via getAll()`);
                }
            } else if (app.playlists?.root?.playlists) {
                // Fallback to root playlists
                const rootPls = app.playlists.root.playlists;
                if (Array.isArray(rootPls)) {
                    rootPls.forEach(p => {
                        if (p && (p.title || p.name)) {
                            allPlaylists.push(p.title || p.name);
                        }
                    });
                    log(`Retrieved ${allPlaylists.length} playlists via root.playlists`);
                }
            }
        } catch (e) {
            log('Error getting playlists: ' + e.toString());
        }

        allPlaylists.sort((a, b) => a.localeCompare(b));

        // Build items array: [None] + playlists
        const items = ['[None]'].concat(allPlaylists);

        // Create a StringList dataSource (MM5 pattern) - use app.utils.newStringList()
        try {
            // MM5 uses app.utils.newStringList() for dropdowns
            const stringListFactory = app.utils?.newStringList || window.newStringList;
            if (typeof stringListFactory === 'function') {
                const stringList = stringListFactory();
                items.forEach(item => stringList.add(item));
                
                // Set dataSource on dropdown control (MM5 standard pattern)
                parentCtrl.dataSource = stringList;
                log('Set dataSource with ' + items.length + ' items');

                // Set selected value to stored parent or default
                const defaultParent = storedParent || 'Similar Artists Playlists';
                let selectedIndex = 0;

                // Try to find the default parent in the list
                const foundIndex = items.indexOf(defaultParent);
                if (foundIndex >= 0) {
                    selectedIndex = foundIndex;
                }

                // Set focused index (MM5 pattern for dropdowns)
                parentCtrl.focusedIndex = selectedIndex;
                log(`Set focusedIndex to ${selectedIndex} (${items[selectedIndex]})`);
            } else {
                log('newStringList() not available (checked app.utils.newStringList and window.newStringList)');
            }
        } catch (e) {
            log('Error setting dataSource: ' + e.toString());
        }

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

		// Populate parent playlist dropdown with available playlists
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