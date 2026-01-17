/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

var optionPanels = {
    pnl_General: {
        name: _('General'),
        subPanels: {
            pnl_Hotkeys: {
                name: _('Hotkeys'),
                order: 20
            },
            pnl_Confirmations: {
                name: _('Confirmations'),
                order: 30
            },
            pnl_PartyMode: {
                name: _('Party Mode'),
                order: 40
            },
            /*
            pnl_Network: {
                name: _('Network'),
                order: 50
            },*/
            pnl_Performance: {
                name: _('Performance'),
                order: 60
            }
        },
        order: 10
    },
    pnl_Player: {
        name: _('Player'),
        subPanels: {
            pnl_Streaming: {
                name: _('Streaming'),
                order: 10
            },
            pnl_AutoDJ: {
                name: _('Auto-DJ') + ' / ' + _('\'Playing\' list'),
                order: 20
            },
            pnl_VolumeLeveling: {
                name: _('Volume leveling'),
                order: 30
            },
            pnl_PlaybackRules: {
                name: _('Playback rules'),
                order: 40
            },
            pnl_InputPlugins: {
                name: _('Codecs') + ' / ' + _('Input') + ' (' + _('plug-ins') + ')',
                order: 50
            },
            pnl_OutputPlugins: {
                name: _('Audio Output') + ' (' + _('plug-ins') + ')',
                order: 60
            },
            /*pnl_DSPModules: { // #18088: item 1
                name: _('Audio DSP') + ' (' + _('plug-ins') + ')',
                order: 70
            }*/
        },
        order: 20
    },
    pnl_Layouts: {
        name: _('Layout'),
        order: 30,
        subPanels: {
            pnl_LayoutPlayer: {
                name: _('Player'),
                order: 10
            },
            pnl_LayoutPreview: {
                name: _('Preview') +' & ' + _('Lyrics'),
                order: 20
            },
            pnl_LayoutPlaying: {
                name: _('\'Playing\' list'),
                order: 30
            },
            pnl_LayoutSkin: {
                name: _('Skin'),
                order: 40
            },
            pnl_LayoutToolbar: {
                name: _('Toolbar'),
                order: 50
            },
        }
    },
    pnl_Library: {
        name: _('Library'),
        subPanels: {
            pnl_MediaTree: {
                name: _('Collections & Views'),
                order: 10
            },
            pnl_Appearance: {
                name: _('Fields') + ' / ' + _('Columns'),
                order: 20
            },
            pnl_TagsAndPlaylists: {
                name: _('Tags & playlists'),
                order: 30
            },
            pnl_MetadataLookup: {
                name: _('Metadata lookup'),
                order: 40
            },
            pnl_AutoOrganize: {
                name: _('Auto-organize'),
                order: 50
            },
            pnl_Search: {
                name: _('Search'),
                order: 60
            },
            pnl_Download: {
                name: _('Downloads') + '/' + _('Podcasts'),
                order: 80
            },
        },
        order: 40
    },
    /* removed per #17283
    pnl_Addons: {
        name: _('Addons'),
        subPanels: {},
        order: 999
    }
    */
};

if (app.utils.system() !== 'macos') 
    optionPanels.pnl_Library.subPanels.pnl_MediaServers = {
        name: _('Media Sharing'),
        order: 70
    };

if (!app.utils.getPortableMode())
    optionPanels.pnl_General.subPanels.pnl_OSIntegration = {
        name: _('OS integration'),
        order: 10
    };


function init(params) {
    let wnd = this;
    wnd.title = _('Options');
    wnd.resizeable = true;
    window.settings.clearCache(); // #17191

    let lvPanelList = qid('lvPanelList');
    lvPanelList.controlClass.setContentBox(qid('right-box'));

    let addPanels = function (panelArray, parentKey, level) {
        level = level || 0;
        let panels = getSortedAsArray(panelArray);
        for (let iPnl = 0; iPnl < panels.length; iPnl++) {
            let panel = panels[iPnl];
            if (parentKey)
                panel.parent = parentKey;
            panel.level = level;
            lvPanelList.controlClass.addPanel(panel);
            if (panel.subPanels) {
                addPanels(panel.subPanels, panel.key, level + 1);
            }
        }
    }

    lvPanelList.controlClass.dataSource.beginUpdate();
    addPanels(optionPanels);
    lvPanelList.controlClass.dataSource.endUpdate();

    window.localListen(lvPanelList, 'loadpanel', function (e) {
        loadPanel(e.detail.panelID);
    });
    lvPanelList.focus();

    window.localListen(qid('btnOK'), 'click', btnOkClick);

    this.state = {
        selectedPanel: getFirstPanelKey()
    }
    app.getValue('dlg_options', this.state);
    let defaultPanel = this.state.selectedPanel;
    if (params && params.defaultPanel)
        defaultPanel = params.defaultPanel;

    selectPanel(defaultPanel, params); // #18483 JL: Giving panels access to dialog params
}

function getFirstPanelKey() {
    for (let iPnl in optionPanels) {
        let panel = optionPanels[iPnl];
        return panel.key;
    }
}

function getPanelByKey(panelID, panelArray) {
    panelArray = panelArray || optionPanels;
    for (let iPnl in panelArray) {
        let panel = panelArray[iPnl];
        if (panel.key == panelID)
            return panel;
        if (panel.subPanels) {
            let retval = getPanelByKey(panelID, panel.subPanels);
            if (retval)
                return retval;
        }
    }
}

function selectPanel(panelID, wndParams) {

    qid('lvPanelList').controlClass.selectPanel(panelID, wndParams);

    if (getPanelByKey(panelID))
        loadPanel(panelID, wndParams);
    else {
        ODS(panelID + ' no longer exists!');
        loadPanel(getFirstPanelKey(), wndParams);
    }
};

function loadPanel(panelID, wndParams) {
    let panelsLV = qid('lvPanelList').controlClass;
    let pnl;
    if (!panelsLV.isPanelLoaded(panelID)) {
        let sheetsPath = 'file:///dialogs/dlgOptions/';
        requirejs(sheetsPath + panelID + '.js');
        let tempDiv = document.createElement('div');
        tempDiv.innerHTML = window.loadFile(sheetsPath + panelID + '.html', undefined, {
            required: false
        });
        pnl = tempDiv.firstElementChild;
        if (pnl && (pnl.tagName === 'SCRIPT')) {
            pnl = pnl.nextElementSibling;
        };
        if (!pnl)
            pnl = tempDiv;
        pnl.setAttribute('data-id', panelID);
        qid('right-box').appendChild(pnl);
        initializeControls(pnl);

        let sett = window.settings.get();
        getPanelByKey(panelID).load(sett, pnl, wndParams);
        panelsLV.loadedPanels.push(panelID);
    } else {
        pnl = qid(panelID);
        setVisibility(pnl, true);
        if (getPanelByKey(panelID).onactivate)
            getPanelByKey(panelID).onactivate();
    }
    window.document.body.setAttribute('data-help', uitools.getHelpContext(pnl)); // set context help from panel
    window.state.selectedPanel = panelID;
    app.setValue('dlg_options', window.state);
}

function btnOkClick() {
    let sett = window.settings.get();
    qid('lvPanelList').controlClass.forAllLoadedPanels(function (key) {
        getPanelByKey(key).save(sett);
    });

    window.settings.set(sett);
    app.flushState();

    if (window.newLanguage)
        modalResult = 3;
    else
    if (window.reloadNeeded)
        modalResult = 2;
    else
        modalResult = 1;
}

window.beforeWindowCleanup = function () {
    if (modalResult === 0) { // call cancel functions
        let sett = window.settings.get();
        qid('lvPanelList').controlClass.forAllLoadedPanels(function (key) {
            if (getPanelByKey(key).cancel) {
                getPanelByKey(key).cancel(sett);
            }
        });
    }
    // cleanup variables with DOM elements - has to be done here, document is already cleaned in windowCleanup function, we would not have access to lvPanelList there already
    qid('lvPanelList').controlClass.forAllLoadedPanels(function (key) {
        if (isFunction(getPanelByKey(key).beforeWindowCleanup)) {
            getPanelByKey(key).beforeWindowCleanup();
        }
    });
}
