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

// Defaults matching similarArtists.js / config.js
const defaults = {
    Toolbar: 1,
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
    Overwrite: 0,
    Enqueue: false,
    Navigate: 0,
    OnPlay: false,
    ClearNP: false,
    Ignore: false,
    Parent: '',
    Black: '',
    Exclude: '',
    Genre: '',
};

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

function log(txt) {
    try { console.log('SimilarArtists: ' + txt); } catch (e) {}
}

optionPanels.pnl_Library.subPanels.pnl_SimilarArtists.load = function (sett) {
    try {
        const ui = app.ui;

        // Toolbar dropdown
        ui.addLabel(panel, { left: 5, top: 10, width: 80, caption: 'Toolbar buttons:' });
        ui.addDropdown(panel, {
            id: 'SAToolbar',
            left: 90, top: 7, width: 100,
            items: ['None', 'Run script', 'Auto on/off', 'Both'],
            selectedIndex: intSetting('Toolbar'),
        });

        // --- Last.fm API key ---
        ui.addLabel(panel, {
            left: 5, top: 10 + 430, width: 120,
            caption: 'Last.fm API key:'
        });

        ui.addEdit(panel, {
            id: 'SAApiKey',
            left: 130, top: 7 + 430, width: 260,
            text: app.settings?.getValue?.('SimilarArtists.ApiKey', '') || '',
            hint: 'Enter your Last.fm API key',
        });

        // Confirm checkbox
        ui.addCheckbox(panel, {
            id: 'SAConfirm',
            left: 5, top: 35, width: 200,
            caption: 'Show confirmation prompt?',
            checked: boolSetting('Confirm'),
        });

        // Sort checkbox
        ui.addCheckbox(panel, {
            id: 'SASort',
            left: 5, top: 60, width: 200,
            caption: 'Sort artists before processing?',
            checked: boolSetting('Sort'),
        });

        // Random checkbox
        ui.addCheckbox(panel, {
            id: 'SARandom',
            left: 225, top: 10, width: 200,
            caption: 'Randomise playlists?',
            checked: boolSetting('Random'),
        });

        // Seed artist checkbox
        ui.addCheckbox(panel, {
            id: 'SASeed',
            left: 225, top: 35, width: 200,
            caption: 'Include seed artist?',
            checked: boolSetting('Seed'),
        });

        // Seed track checkbox
        ui.addCheckbox(panel, {
            id: 'SASeed2',
            left: 225, top: 60, width: 200,
            caption: 'Include seed track (if only one)?',
            checked: boolSetting('Seed2'),
        });

        // Overwrite dropdown
        ui.addLabel(panel, { left: 5, top: 85, width: 80, caption: 'Playlist creation:' });
        ui.addDropdown(panel, {
            id: 'SAOverwrite',
            left: 90, top: 82, width: 300,
            items: ['Create new playlist', 'Overwrite existing playlist', 'Do not create playlist'],
            selectedIndex: intSetting('Overwrite'),
        });

        // Playlist name
        ui.addLabel(panel, { left: 5, top: 110, width: 80, caption: 'Playlist name:' });
        ui.addEdit(panel, {
            id: 'SAName',
            left: 90, top: 107, width: 300,
            text: stringSetting('Name'),
            hint: 'Use % to represent the artist name',
        });

        // Artist limit
        ui.addLabel(panel, { left: 5, top: 135, width: 80, caption: 'Artist limit:' });
        ui.addSpinEdit(panel, {
            id: 'SALimit',
            left: 90, top: 132, width: 50,
            minValue: 0, maxValue: 9999,
            value: intSetting('Limit'),
        });

        // Tracks per artist
        ui.addLabel(panel, { left: 5, top: 160, width: 80, caption: 'Tracks/artist:' });
        ui.addSpinEdit(panel, {
            id: 'SATPA',
            left: 90, top: 157, width: 50,
            minValue: 0, maxValue: 9999,
            value: intSetting('TPA'),
            hint: 'Maximum number of tracks from a single artist in a playlist',
        });

        // Best checkbox
        ui.addCheckbox(panel, {
            id: 'SABest',
            left: 225, top: 135, width: 200,
            caption: 'Select highest rated in library?',
            checked: boolSetting('Best'),
        });

        // Rank checkbox
        ui.addCheckbox(panel, {
            id: 'SARank',
            left: 225, top: 160, width: 200,
            caption: 'Select highest ranked by Last.Fm?',
            checked: boolSetting('Rank'),
        });

        // Tracks per playlist
        ui.addLabel(panel, { left: 5, top: 186, width: 80, caption: 'Tracks/playlist:' });
        ui.addSpinEdit(panel, {
            id: 'SATPL',
            left: 90, top: 182, width: 50,
            minValue: 0, maxValue: 9999,
            value: intSetting('TPL'),
            hint: 'Maximum number of tracks in total in a playlist',
        });

        // Parent playlist
        ui.addLabel(panel, { left: 5, top: 210, width: 80, caption: 'Parent playlist:' });
        const parentItems = ['[Playlists]'].concat(getPlaylistNames());
        const parentIndex = Math.max(0, parentItems.indexOf(stringSetting('Parent')));
        ui.addDropdown(panel, {
            id: 'SAParent',
            left: 90, top: 207, width: 300,
            items: parentItems,
            selectedIndex: parentIndex,
            hint: 'Please select a playlist',
        });

        // Exclude artists (blacklist)
        ui.addLabel(panel, { left: 5, top: 235, width: 80, caption: 'Exclude artists:' });
        ui.addEdit(panel, {
            id: 'SABlack',
            left: 90, top: 232, width: 300,
            text: stringSetting('Black'),
            hint: 'Comma separated list of artists names',
        });

        // Exclude genres
        ui.addLabel(panel, { left: 5, top: 260, width: 80, caption: 'Exclude genres:' });
        ui.addEdit(panel, {
            id: 'SAGenre',
            left: 90, top: 257, width: 300,
            text: stringSetting('Genre'),
            hint: 'Comma separated list of genres',
        });

        // Exclude titles
        ui.addLabel(panel, { left: 5, top: 285, width: 80, caption: 'Exclude titles:' });
        ui.addEdit(panel, {
            id: 'SAExclude',
            left: 90, top: 282, width: 300,
            text: stringSetting('Exclude'),
            hint: 'Comma separated list of words in titles',
        });

        // Minimum rating
        ui.addLabel(panel, { left: 5, top: 310, width: 80, caption: 'Minimum rating:' });
        ui.addDropdown(panel, {
            id: 'SARating',
            left: 90, top: 307, width: 100,
            items: ['0 stars', '0.5 stars', '1 star', '1.5 stars', '2 stars', '2.5 stars', '3 stars', '3.5 stars', '4 stars', '4.5 stars', '5 stars'],
            selectedIndex: Math.floor(intSetting('Rating') / 10),
            hint: 'Select minimum rating stars',
        });

        // Unknown rating checkbox
        ui.addCheckbox(panel, {
            id: 'SAUnknown',
            left: 225, top: 310, width: 200,
            caption: 'Include unknown rating?',
            checked: boolSetting('Unknown'),
        });

        // Navigation
        ui.addLabel(panel, { left: 5, top: 335, width: 80, caption: 'Navigation:' });
        ui.addDropdown(panel, {
            id: 'SANavigate',
            left: 90, top: 332, width: 300,
            items: ['None', 'Navigate to new playlist', 'Navigate to now playing'],
            selectedIndex: intSetting('Navigate'),
        });

        // OnPlay checkbox
        ui.addCheckbox(panel, {
            id: 'SAOnPlay',
            left: 5, top: 360, width: 400,
            caption: 'Automatically run the script when playing the last track?',
            checked: boolSetting('OnPlay'),
        });

        // Enqueue checkbox
        ui.addCheckbox(panel, {
            id: 'SAEnqueue',
            left: 5, top: 385, width: 400,
            caption: 'Automatically enqueue tracks?',
            checked: boolSetting('Enqueue'),
        });

        // ClearNP checkbox
        ui.addCheckbox(panel, {
            id: 'SAClearNP',
            left: 5, top: 410, width: 400,
            caption: 'Clear list before enqueuing tracks?',
            checked: boolSetting('ClearNP'),
        });

        // Ignore checkbox
        ui.addCheckbox(panel, {
            id: 'SAIgnore',
            left: 5, top: 435, width: 400,
            caption: 'Ignore recently played tracks when enqueuing?',
            checked: boolSetting('Ignore'),
        });
    } catch (e) {
        log('initSettingsPanel error: ' + e.toString());
    }

}

optionPanels.pnl_Library.subPanels.pnl_SimilarArtists.save = function (sett) {
    try {
        const getControl = (id) => panel.getChildControl?.(id) || panel[id];

        const apiKeyCtrl = getControl('SAApiKey');
        if (apiKeyCtrl) {
            try { app.settings.setValue('SimilarArtists.ApiKey', apiKeyCtrl.text || ''); } catch (e) {}
        }

        setSetting('Name', getControl('SAName')?.text || defaults.Name);
        setSetting('Limit', getControl('SALimit')?.value ?? defaults.Limit);
        setSetting('TPA', getControl('SATPA')?.value ?? defaults.TPA);
        setSetting('TPL', getControl('SATPL')?.value ?? defaults.TPL);
        setSetting('Confirm', getControl('SAConfirm')?.checked ?? defaults.Confirm);
        setSetting('Toolbar', getControl('SAToolbar')?.selectedIndex ?? defaults.Toolbar);
        setSetting('Sort', getControl('SASort')?.checked ?? defaults.Sort);

        const parentCtrl = getControl('SAParent');
        const parentText = parentCtrl?.text || parentCtrl?.items?.[parentCtrl?.selectedIndex] || '';
        setSetting('Parent', parentText === '[Playlists]' ? '' : parentText);

        setSetting('Black', getControl('SABlack')?.text || '');
        setSetting('Random', getControl('SARandom')?.checked ?? defaults.Random);
        setSetting('Seed', getControl('SASeed')?.checked ?? defaults.Seed);
        setSetting('Seed2', getControl('SASeed2')?.checked ?? defaults.Seed2);
        setSetting('Best', getControl('SABest')?.checked ?? defaults.Best);
        setSetting('Rank', getControl('SARank')?.checked ?? defaults.Rank);
        setSetting('Rating', (getControl('SARating')?.selectedIndex ?? 0) * 10);
        setSetting('Unknown', getControl('SAUnknown')?.checked ?? defaults.Unknown);
        setSetting('Genre', getControl('SAGenre')?.text || '');
        setSetting('Overwrite', getControl('SAOverwrite')?.selectedIndex ?? defaults.Overwrite);
        setSetting('Enqueue', getControl('SAEnqueue')?.checked ?? defaults.Enqueue);
        setSetting('Navigate', getControl('SANavigate')?.selectedIndex ?? defaults.Navigate);
        setSetting('OnPlay', getControl('SAOnPlay')?.checked ?? defaults.OnPlay);
        setSetting('ClearNP', getControl('SAClearNP')?.checked ?? defaults.ClearNP);
        setSetting('Exclude', getControl('SAExclude')?.text || '');
        setSetting('Ignore', getControl('SAIgnore')?.checked ?? defaults.Ignore);

        // Update auto mode based on OnPlay setting
        if (getSetting('OnPlay', false)) {
            try { window.SimilarArtists?.attachAuto?.(); } catch (e) {}
        } else {
            try { window.SimilarArtists?.detachAuto?.(); } catch (e) {}
        }

        // Update toolbar visibility
        try { window.SimilarArtists?.refreshToolbarVisibility?.(); } catch (e) {}

        // After saving try to notify the addon's runtime if available
        try {
            if (window.SimilarArtists && typeof window.SimilarArtists.ensureDefaults === 'function') {
                window.SimilarArtists.ensureDefaults();
            }
        } catch (e) {}

    } catch (e) {
        log('saveSettingsPanel error: ' + e.toString());
    }
}


optionPanels.pnl_Library.subPanels.pnl_SimilarArtists.beforeWindowCleanup = function () {

}