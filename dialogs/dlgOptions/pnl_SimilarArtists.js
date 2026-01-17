/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

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

function getPlaylistNames() {
    const names = [];
    try {
        if (app.playlists?.getAll) {
            const pls = app.playlists.getAll();
            if (Array.isArray(pls)) {
                pls.forEach(p => { if (p && p.title) names.push(p.title); });
            }
        }
    } catch (e) {}
    names.sort((a, b) => a.localeCompare(b));
    return names;
}


// Defaults matching similarArtists.js / config.js
const defaults = {
	////Toolbar: 1,
	//ApiKey: app?.utils?.web?.getAPIKey('lastfmApiKey') || '6cfe51c9bf7e77d6449e63ac0db2ac24',
	//Confirm: true,
	//Sort: false,
	//Limit: 5,
	//Name: 'Artists similar to %',
	//TPA: 9999,
	//TPL: 9999,
	//Random: false,
	//Seed: false,
	//Seed2: false,
	//Best: false,
	//Rank: false,
	//Rating: 0,
	//Unknown: true,
	//Overwrite: 'Create new playlist',
	//Enqueue: false,
	//Navigate: 0,
	//OnPlay: false,
	//ClearNP: false,
	//Ignore: false,
	//Parent: 'Similar Artists Playlists',
	//Black: '',
	//Exclude: '',
	//Genre: '',
};

function log(txt) {
    try { console.log('SimilarArtists: ' + txt); } catch (e) {}
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
            if (app.playlists?.getAll) {
                const pls = app.playlists.getAll();
                if (Array.isArray(pls)) {
                    pls.forEach(p => { 
                        if (p && p.title) {
                            allPlaylists.push(p.title);
                        }
                    });
                }
            }
        } catch (e) {
            log('populateParentPlaylist: Error getting playlists: ' + e.toString());
        }

        allPlaylists.sort((a, b) => a.localeCompare(b));

        // Build items array: [None] + playlists
        const items = ['[None]'].concat(allPlaylists);

        // Set items on control if it supports setItems
        if (typeof parentCtrl.setItems === 'function') {
            parentCtrl.setItems(items);
            log('populateParentPlaylist: Set items on SAParent control');
        } else if (parentCtrl.items && Array.isArray(parentCtrl.items)) {
            // Some dropdown controls expose items array directly
            parentCtrl.items = items;
            log('populateParentPlaylist: Set items array on SAParent control');
        }

        // Set selected value to stored parent or default
        const defaultParent = storedParent || 'Similar Artists Playlists';
        let selectedIndex = 0;

        // Try to find the default parent in the list
        if (items.indexOf(defaultParent) >= 0) {
            selectedIndex = items.indexOf(defaultParent);
        } else {
            // If default doesn't exist, keep [None] selected
            selectedIndex = 0;
        }

        if (typeof parentCtrl.selectedIndex !== 'undefined') {
            parentCtrl.selectedIndex = selectedIndex;
            log(`populateParentPlaylist: Selected index ${selectedIndex} (${items[selectedIndex]})`);
        }

    } catch (e) {
        log('populateParentPlaylist error: ' + e.toString());
    }
}

optionPanels.pnl_Library.subPanels.pnl_SimilarArtists.load = function (sett, pnl, wndParams) {
    try {
		this.config = app.getValue('SimilarArtists', defaults);

		var UI = getAllUIElements(pnl);
		//UI.SAToolbar.controlClass.value = this.config.Toolbar;
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
        log('initSettingsPanel error: ' + e.toString());
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

		// Get selected parent playlist
		const parentCtrl = UI.SAParent?.controlClass;
		if (parentCtrl && parentCtrl.items && typeof parentCtrl.selectedIndex !== 'undefined') {
			const selectedItem = parentCtrl.items[parentCtrl.selectedIndex];
			// Store empty string if [None] is selected, otherwise store the playlist name
			this.config.Parent = (selectedItem === '[None]') ? '' : (selectedItem || '');
		} else {
			// Fallback if control doesn't expose items/selectedIndex
			this.config.Parent = UI.SAParent?.controlClass?.value || '';
		}

		app.setValue('SimilarArtists', this.config);

        //// Notify the addon's runtime to re-apply settings (attach auto, refresh toolbar, etc.)
        //try {
        //    if (window.SimilarArtists) {
        //        try { window.SimilarArtists.ensureDefaults?.(); } catch (e) {}
        //        try { if (typeof window.SimilarArtists.start === 'function') window.SimilarArtists.start(); } catch (e) {}
        //    }
        //} catch (e) {}

    } catch (e) {
        log('saveSettingsPanel error: ' + e.toString());
    }
}


optionPanels.pnl_Library.subPanels.pnl_SimilarArtists.beforeWindowCleanup = function () {

}