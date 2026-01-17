/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

const SCHEDULE = [_('Daily'), _('Weekly'), _('Monthly')];

window.init = function(params) {
    resizeable = false;
    let checkedItemIDs = [];
    title = _('Manage database');
    let maintainLibraryActions = params.actionItems;

    let UI = getAllUIElements();

    let sett = app.getValue('maintainDB', {});
    let allItems = [];
    for (let key in maintainLibraryActions) {
        maintainLibraryActions[key].id = key;
        if (sett[key])
            maintainLibraryActions[key].checked = !!sett[key].checked;
        else if (maintainLibraryActions[key].checked === undefined)
            maintainLibraryActions[key].checked = false;
        allItems.push(maintainLibraryActions[key]);
    };
    // sort by order
    allItems.sort(function (i1, i2) {
        return (i1.order - i2.order);
    });

    forEach(allItems, function (item, idx) {
        let row = document.createElement('div');
        let el = document.createElement('div');
        el.setAttribute('data-tip', resolveToValue(item.hint, ''));
        el.className = 'textWrap';
        el.innerText = resolveToValue(item.title, '');
        row.appendChild(el);
        UI.selectionDiv.appendChild(row);
        el.controlClass = new Checkbox(el, {
            textWrap: true,
            checked: item.checked,
            itemIndex: idx
        });
        item.div = el;
    });

    let saveBackupSettings = function () {
        let sett = window.settings.get('System');
        sett.System.BackupScheduleEnabled = UI.chbSchedule.controlClass.checked;
        sett.System.BackupScheduleType = UI.cbScheduleInterval.controlClass.focusedIndex;
        sett.System.BackupLocation = UI.edtBackupLocation.controlClass.value;
        sett.System.RetainBackups = UI.cbRetainBackups.controlClass.value;
        sett.System.BackupDatabase = true; // #21456
        sett.System.BackupSettings = UI.chbBackupSettings.controlClass.checked;
        sett.System.BackupAddons = UI.chbBackupAddons.controlClass.checked;
        window.settings.set(sett, 'System');
    };
    
    let saveAllSettings = function () {
        forEach(allItems, function (item, idx) {
            if (!item.div) // this happened in elp C491352C -- was [OK] button clicked twice somehow?
                return;

            sett[item.id] = sett[item.id] || {};
            item.checked = item.div.controlClass.checked;
            item.div = undefined;
            sett[item.id].checked = item.checked;
            if (item.checked)
                checkedItemIDs.push(item.id);
        });
        app.setValue('maintainDB', sett);

        saveBackupSettings();
    };
    
    window.localListen(window, 'dockableDialog', (e) => {
        if (UI && UI.dlgButtons && UI.dlgButtons.controlClass) {
            UI.dlgButtons.controlClass.disabled = e.detail.showing && e.detail.modal && e.detail.disabled;
        }
    });

    window.localListen(UI.btnCancel, 'click', function () {
        modalResult = 0;
    });

    window.localListen(UI.btnOK, 'click', function () {
        saveAllSettings();
        modalResult = 1;
    });

    window.localListen(UI.btnSave, 'click', function () {
        saveAllSettings();
        modalResult = 2;
    });
    
    window.getCheckedItemIDs = function () {
        return JSON.stringify(checkedItemIDs);
    };
    
    let setDBLocation = function(path) {
        UI.edtBackupLocation.controlClass.value = path;
        UI.edtBackupLocation.setAttribute('data-tip', path);
    }

    sett = window.settings.get('System');
    let idx = sett.System.BackupScheduleType;
    let list = newStringList();
    for (let i = 0; i < SCHEDULE.length; i++)
        list.add(SCHEDULE[i]);
    UI.cbScheduleInterval.controlClass.dataSource = list;
    UI.chbSchedule.controlClass.checked = sett.System.BackupScheduleEnabled;
    UI.cbScheduleInterval.controlClass.focusedIndex = idx;
    setDBLocation(sett.System.BackupLocation);
    UI.cbRetainBackups.controlClass.value = sett.System.RetainBackups;

    UI.lblBackup.innerText = resolveToValue(actions.backupDatabase.title, '');    
    UI.chbBackupSettings.controlClass.checked = sett.System.BackupSettings;
    UI.chbBackupAddons.controlClass.checked = sett.System.BackupAddons;

    UI.lblRestore.innerText = resolveToValue(actions.restoreDatabase.title, '');
    UI.lblClear.innerText = resolveToValue(actions.clearDatabase.title, '');

    window.localListen(UI.lblBackup, 'click', function () {
        saveBackupSettings();
        actions.backupDatabase.execute();
    });
    window.localListen(UI.lblRestore, 'click', function () {
        saveBackupSettings();
        actions.restoreDatabase.execute();
    });
    window.localListen(UI.lblClear, 'click', function () {
        actions.clearDatabase.execute();
    });
    window.localListen(UI.lblResetSettings, 'click', function () {        
        app.settings.reset();
    });    

    window.localListen(UI.btnSelectBackupFolder, 'click', function () {
        window.uitools.showSelectFolderDlg(UI.edtBackupLocation.controlClass.value, {}).then(function(path) {
            if (path)
                setDBLocation(path);
        });
    });
    
};
