/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

requirejs("controls/addonlistview");

window.callReload = false; // other windows are fetching these values when closing this dialog (see e.g. uitools.showExtensions)
window.callRestart = false;

function init(params) {

    title = _('Addons');
    resizeable = true;

    let btnMoreAddons = qid('btnMoreAddons');
    window.localListen(btnMoreAddons, 'click', function () {
        window.uitools.openWeb('https://www.mediamonkey.com/re/addons-mm5');
    });

    let cbSearchAddon = qid('cbSearchAddon');
    window.localListen(cbSearchAddon, 'input', function () {
        let phrase = cbSearchAddon.controlClass.value;
        lvAddonList.controlClass.filterSource(phrase);
    });

    let lvAddonList = qid('lvAddonList');
    let cbAddonType = qid('cbAddonType');
    let icnProgress = qid('icnProgress');
    setVisibility(icnProgress, false);
    
    let updateAddonList = function () {
        if (cbSearchAddon.controlClass.value != '')
            cbSearchAddon.controlClass.value = '';
        let archiveType = cbAddonType.controlClass.value;
        let dataSource;
        if (params && params.filterByID) {
            dataSource = app.getAddonList(archiveType, params.filterByID);
        } else
            dataSource = app.getAddonList(archiveType);
        lvAddonList.controlClass.dataSource = dataSource;
        
        setVisibility(icnProgress, true);
        window.localPromise(dataSource.whenLoaded()).then(() => {
            setVisibility(icnProgress, false);
        });
    }
    window.localListen(cbAddonType, 'change', updateAddonList);
    if (params && params.filter == 'configurable')
        cbAddonType.controlClass.value = _('Configurable');
    else
        cbAddonType.controlClass.value = _('All');

    window.localListen(qid('btnAdd'), 'click', function () {
        let promise = app.utils.dialogOpenFile('SampleScripts', 'mmip', _('MediaMonkey installation files (*.mmip)|*.*ip'), _('Select installation package'));
        promise.then(function (filename) {
            if (filename != '') {
                window.localPromise(app.installAddonAsync(filename)).then(function (addon) {
                    if (addon) {
                        updateAddonList();
                        if (addon.reloadRequiredInstall) // e.g. skins and layouts don't need reload (they are loaded when switching to them)
                            window.callReload = true;
                        if (addon.showRestartPrompt)
                            window.callRestart = true;
                    }
                });
            }
        });
    });

    let btnFindUpdates = qid('btnFindUpdates');

    let doSearchUpdates = function () {
        btnFindUpdates.controlClass.disabled = true;
        setVisibility(icnProgress, true);
        window.localPromise(app.findUpdatesAsync(lvAddonList.controlClass.dataSource)).then((anyUpdateExists) => {
            btnFindUpdates.controlClass.disabled = false;
            setVisibility(icnProgress, false);
            let ds = cbAddonType.controlClass.dataSource;
            if(ds) {
                ds.modifyAsync(() => {
                    let updAvail = _('Update available');
                    if (ds.getValue(0) != updAvail)
                        ds.insert(0, updAvail);
                    if (anyUpdateExists)
                        cbAddonType.controlClass.value = updAvail;
                });
            }
        });
    };

    window.localListen(btnFindUpdates, 'click', function () {
        doSearchUpdates();
    });

    requestTimeout(() => {
        // LS: this is workaround for #16614 / item b)
        // where icons sometimes fails to show initially
        // probably because the dialog size is restored after the init()
        // TODO for Petr: call init() once the dialog size is already restored ?
        lvAddonList.controlClass.lessChanged();
        if (params && params.searchUpdates) {
            if (lvAddonList.controlClass.dataSource) {
                lvAddonList.controlClass.dataSource.whenLoaded().then(() => {
                    doSearchUpdates();
                });
            }
        }
    }, 500);
};
