/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

import '../commonControls';

window.registration = false;
window.requestedFeature = undefined;

window.optionPanels = {
    pnlScan: {
        name: _('Welcome to MediaMonkey'),
        order: 10,
        params: {
            topTitle: _("To get started, add your media files to the library")
        },
        firstPanel: true,
    },
    pnlShare: {
        name: _('Share media'),
        order: 20
    },
    pnlRegistration: {
        name: _('Registration'),
        order: 30,
        lastPanel: true,
    },
};


window.init = function (params) {
    let wnd = this;
    wnd.title = _('Setup Wizard');
    wnd.resizeable = true;

    if (params && params.title) {
        wnd.title = resolveToValue(params.title);
    }

    hideAllPanels();

    let panelList = newStringList();
    let lvPanelList = qid('lvPanelList');
    lvPanelList.controlClass.dataSource = panelList;
    let panels = getSortedAsArray(window.optionPanels);

    if (params && params.register) {
        window.registration = true;
        setVisibility(qid('left-box'), false);
        for (let iPnl in panels) {
            let panel = panels[iPnl];
            if (panel.key === 'pnlRegistration') {
                AddPanel(panel);
                break;
            }
        }
    } else {
        for (let iPnl in panels) {
            let panel = panels[iPnl];
            AddPanel(panel);
            if (panel.subPanels) {
                let subPanels = getSortedAsArray(panel.subPanels);
                for (let iSubPnl in subPanels) {
                    let subPanel = subPanels[iSubPnl];
                    subPanel.parent = panel.key;
                    AddPanel(subPanel);
                }
            }
        }
        if (!app.db.isNewDB()) {
            uitools.toastMessage.show(_('Opening database') + '<br><i>' +  app.db.getPath() + '</i>', {
                disableUndo: true,
                delay: 7000,
            });
        }
    }

    window.localListen(lvPanelList, 'focuschange', panelChanged);
    lvPanelList.focus();

    window.localListen(qid('btnDone'), 'click', btnOkClick);
    window.localListen(qid('btnNext'), 'click', btnNextClick);
    window.localListen(qid('btnPrev'), 'click', btnPrevClick);
    window.localListen(qid('btnCancelWizard'), 'click', function () {
        closeWindow();
    });

    window.localListen(qid('btnCustomOptions'), 'click', function () {
        uitools.openDialog('dlgOptions', {
            modal: true,
            defaultPanel: 'pnl_Library',
        });
    });

    this.state = {
        selectedPanel: 'pnlScan'
    }
    let defaultPanel = this.state.selectedPanel;
    if (params && params.defaultPanel)
        defaultPanel = params.defaultPanel;

    if (params && params.feature)
        window.requestedFeature = params.feature;

    selectPanel(defaultPanel);
    lvPanelList.controlClass.disabledClearingSelection = true;
}

function AddPanel(panel) {
    qid('lvPanelList').controlClass.dataSource.add(JSON.stringify(panel));
}

function getPanelByKey(panelID) {
    let panels = getSortedAsArray(window.optionPanels);
    for (let iPnl in panels) {
        let panel = panels[iPnl];
        if (panel.key == panelID)
            return panel;
        if (panel.subPanels) {
            for (let iSubPnl in panel.subPanels) {
                let subPanel = panel.subPanels[iSubPnl];
                if (subPanel.key == panelID)
                    return subPanel;
            }
        }
    }
}

function selectPanel(panelID) {
    let lvPanelList = qid('lvPanelList');
    let DS = lvPanelList.controlClass.dataSource;
    DS.modifyAsync(function () {
        if (window._cleanUpCalled)
            return;
        for (let i = 0; i < DS.count; i++) {
            let Value = DS.getValue(i);
            let panel = JSON.parse(Value.toString());
            if (panel.key == panelID) {
                lvPanelList.controlClass.focusedIndex = i;
                lvPanelList.controlClass.setSelectedIndex(i);
            }
        }
    });
    loadPanel(panelID);
};

let loadedPanels = [];

function isPanelLoaded(panelID) {
    if (loadedPanels.indexOf(panelID) >= 0)
        return true;
    else
        return false;
}

function loadPanel(panelID) {
    if (isPanelLoaded(window.state.selectedPanel)) {
        setVisibility(qid(window.state.selectedPanel), false);
    }

    if (!isPanelLoaded(panelID)) {
        let sheetsPath = 'file:///dialogs/dlgWizard/';
        requirejs(sheetsPath + panelID + '.js');
        let tempDiv = document.createElement('div');
        tempDiv.innerHTML = window.loadFile(sheetsPath + panelID + '.html');
        let pnl = tempDiv.firstElementChild;
        pnl.setAttribute('data-id', panelID);
        qid('right-box').appendChild(pnl);
        initializeControls(pnl);

        //let sett = window.settings.get('');
        let panelByKey = getPanelByKey(panelID);
        pnl._data = panelByKey;
        panelByKey.load(panelByKey['params'] || {});

        loadedPanels.push(panelID);
    } else {
        setVisibility(qid(panelID), true);
    }
    let p = qid(panelID);

    let isLast = resolveToValue(p._data.lastPanel, false);
    let isFirst = resolveToValue(p._data.firstPanel, false);

    setVisibility(qid('btnDone'), isLast);
    setVisibility(qid('btnNext'), !isLast && !window.registration);
    setVisibility(qid('btnPrev'), !isFirst && !window.registration);
    setVisibility(qid('btnCancelWizard'), isFirst || window.registration);

    window.state.selectedPanel = panelID;
}

function btnNextClick() {
    let lvPanelList = qid('lvPanelList');
    lvPanelList.controlClass.setfocusedIndexAndDeselectOld(lvPanelList.controlClass.focusedIndex + 1);
}

function btnPrevClick() {
    let lvPanelList = qid('lvPanelList');
    lvPanelList.controlClass.setfocusedIndexAndDeselectOld(lvPanelList.controlClass.focusedIndex - 1);
}


function btnOkClick() {

    let closeWizard = function () {
        let sett = window.settings.get('');
        let rightBox = qid('right-box');
        if (rightBox) {
            for (let i = 0; i < rightBox.children.length; i++) {
                let pnl = rightBox.children[i];
                let panelID = pnl.getAttribute('data-id');
                if (isPanelLoaded(panelID)) {
                    let panelByKey = getPanelByKey(panelID);
                    let data = getPanelByKey(panelID).save(sett);
                    panelByKey['resultData'] = data;
                }
            }
            window.settings.set(sett, '');
            app.flushState();
        }

        modalResult = 1;
    };

    let ChbUsername = qid('ChbUsername');
    let ChbLicenseKey = qid('ChbLicenseKey');

    if (ChbUsername && ChbLicenseKey) {
        let username = ChbUsername.value;
        let key = ChbLicenseKey.value;

        if (username && key) {
            window.localPromise(app.utils.registerApp(username, key)).then(function (status) {
                // messaging is part of app.utils.registerApp() atm
                closeWizard(); // just close wizard
            });
        } else
            closeWizard();
    } else
        closeWizard();
}

function hideAllPanels() {
    let rightBox = qid('right-box');
    for (let i = 0; i < rightBox.children.length; i++) {
        let pnl = rightBox.children[i];
        setVisibility(pnl, false);
    }
}

function panelChanged(newIndex) {

    hideAllPanels();

    let newValue = qid('lvPanelList').controlClass.focusedItem;
    if (newValue) {
        let panel = JSON.parse(newValue.toString());
        loadPanel(panel.key);
    }
}

window.getPaths = function() {
    return window.optionPanels.pnlScan['resultData'].paths;
}

window.getImporters = function() {
    return window.optionPanels.pnlScan['resultData'].importers;
}

window.getServerContainers = function() {
    return window.optionPanels.pnlScan['resultData'].serverContainers;
}

window.getMediaShareEnabled = function() {
    if (window.optionPanels.pnlShare['resultData']) {
        return window.optionPanels.pnlShare['resultData'].shareEnabled;
    } else { // MediaShare panel was skipped
        return true;
    }
}

window.getAddFirewallException = function() {
    if (window.optionPanels.pnlShare['resultData']) {
        return window.optionPanels.pnlShare['resultData'].addFirewallException;
    } else { // MediaShare panel was skipped        
        return !app.utils.getPortableMode();
    }
}

// WizardPanelListView --------------------------------------------
class WizardPanelListView extends ListView {

    initialize(element, params) {
        params = params || {};
        params.multiselect = false;
        super.initialize(element, params);
    }

    setUpDiv(div) {
        if (!div.cloned)
            div.innerHTML = '<div><label data-id="lbl"></label></div>';
        div.label = qe(div, '[data-id=lbl]');
    }

    bindData(div, index) {
        if (this.dataSource && div) {

            let value = this.dataSource.getValue(index);
            if (value) {
                let panel = JSON.parse(value.toString());
                div.label.innerText = panel.name;
                if (panel.parent)
                    div.label.classList.add('left-indent');
            }
        }
    }
}
registerClass(WizardPanelListView);

//requirejs('helpers/debugTools');
//registerDebuggerEntryPoint.call(this /* method class */ , 'init' /* method name to inject */ );

window.beforeWindowCleanup = function () {
    let rightBox = qid('right-box');
    if (rightBox) {
        for (let i = 0; i < rightBox.children.length; i++) {
            let pnl = rightBox.children[i];
            let panelID = pnl.getAttribute('data-id');
            if (isPanelLoaded(panelID)) {
                let panelByKey = getPanelByKey(panelID);
                if(isFunction(panelByKey.beforeWindowCleanup)) {
                    panelByKey.beforeWindowCleanup();
                }
            }
        }
    }
}
