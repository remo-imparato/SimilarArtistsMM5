/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

requirejs('actions');

let guideText = _('Type a keyboard shortcut');
let selectActionText = _('Select an Action');
let newHotkeyText = _('<New Hotkey...>');

function onHotkeyChanged() {
    let lvHotkeysList = qid('lvHotkeysList');
    let focusedHotkey = lvHotkeysList.controlClass.getItem(lvHotkeysList.controlClass.focusedIndex);

    if (focusedHotkey) {
        let cbAction = qid('cbAction');

        let idx = actionList.indexOf(focusedHotkey.action);
        if (idx > 0)
            cbAction.controlClass.focusedIndex = idx;
        else
            cbAction.controlClass.focusedIndex = 0;

        if (focusedHotkey.hotkey == '')
            qid('edtHotkey').controlClass.value = guideText;
        else
            qid('edtHotkey').controlClass.value = focusedHotkey.hotkey;
        app.hotkeys.setEditMode(false);
        qid('chbGlobal').controlClass.checked = focusedHotkey.global;
        qid('btnApplyHotkey').controlClass.disabled = true;
    }

    if (lvHotkeysList.controlClass.focusedIndex == 0)
        qid('btnDeleteHotkey').controlClass.disabled = true;
    else
        qid('btnDeleteHotkey').controlClass.disabled = false;
}

function setBtnApplyDisabledState() {
    if ((qid('edtHotkey').controlClass.value == '') || qid('edtHotkey').controlClass.value == guideText || (qid('cbAction').controlClass.focusedIndex == 0))
        qid('btnApplyHotkey').controlClass.disabled = true;
    else
        qid('btnApplyHotkey').controlClass.disabled = false;
}

localListen(app, 'hotkey', function (h) {
    if((app.hotkeys.getEditMode() == true) && (h.hotkey !== 'TAB') && (h.hotkey !== 'Shift+TAB')) { // (Shift+)TAB cannot be hotkey, it is used to move focus
        requestTimeout(function () {
            qid('edtHotkey').controlClass.value = h.hotkey;
            setBtnApplyDisabledState();
        }, 1); // so that text is assigned after 'own' input acceptation, e.g. 'Space' would become 'Space ' etc.
    }
});

function getActionText(action) {
    let res = '';
    window.actionNamesList.locked(function () {
        let idx = window.actionList.indexOf(action);
        assert(idx >= 0, 'Action ' + action + ' does not exist!');
        res = window.actionNamesList.getValue(idx);
    });
    return res;
}

optionPanels.pnl_General.subPanels.pnl_Hotkeys.load = function (sett) {
    let LV = qid('lvHotkeysList');
    LV.controlClass.showHeader = true;
    LV.controlClass.isSortable = true;
    LV.controlClass.multiselect = true;

    let columns = new Array();
    columns.push({
        order: 0,
        width: 300,
        title: _('Action'),
        columnType: 'action',
        bindData: function (div, item, index) {
            if (item.action != newHotkeyText)
                div.innerText = getActionText(item.action);
            else
                div.innerText = newHotkeyText;
        }
    });
    columns.push({
        order: 1,
        width: 200,
        title: _('Hotkey'),
        columnType: 'hotkey',
        bindData: function (div, item, index) {
            div.innerText = item.hotkey;
        }
    });
    columns.push({
        order: 2,
        width: 50,
        title: _('Global'),
        columnType: 'global',
        setupCell: GridView.prototype.cellSetups.setupCheckbox,
        bindData: function (div, item, index) {
            div.check.controlClass.checked = item.global;
            div.check.controlClass.itemIndex = index;
        }
    });
    LV.controlClass.setColumns(columns);

    window.actionList = [];
    let getActionNamesList = function () {

        let items = [];

        let getLevel = function (rootKey, level, category) {
            let keys = Object.keys(level);
            for (let i = 0; i < keys.length; i++) {
                let key = keys[i];
                let act = level[key];
                if (act && act.hotkeyAble) {
                    if (rootKey != '')
                        key = rootKey + '.' + keys[i]; // e.g. view.mediaTree
                    if (act.category && !act.execute) {
                        // this is action container, there are some sub-actions, traverse it:
                        getLevel(key, act, act.category);
                    } else
                    if (act.title) {
                        let tit = act.hotkeyTitle ? uitools.getPureTitle(resolveToValue(act.hotkeyTitle)) : uitools.getPureTitle(resolveToValue(act.title));
                        let cat = category || act.category || actionCategories.general;
                        if (cat)
                            tit = uitools.getPureTitle(resolveToValue(cat)) + ': ' + tit;
                        items.push({
                            title: tit,
                            key: key
                        });
                    }
                }
            }
        }
        getLevel('', window.actions);

        items.sort(function (a, b) {
            let A = a.title.toUpperCase();
            let B = b.title.toUpperCase();
            if (A < B)
                return -1;
            else
            if (A > B)
                return 1;
            else
                return 0;
        });

        let list = newStringList();
        actionList.push(''); // dummy, for the first row
        list.add(selectActionText);
        for (let i = 0; i < items.length; i++) {
            let item = items[i];
            list.add(item.title);
            actionList.push(item.key);
        }
        return list;
    }
    window.actionNamesList = getActionNamesList();

    let getHotkeysList = function (hotkeyList) {
        let list = app.hotkeys.newHotkeyList();
        let HD = app.hotkeys.newHotkeyData();
        HD.action = newHotkeyText;
        list.add(HD);        
        hotkeyList.locked(function () {
            actionNamesList.locked(function () {
                for (let i = 0; i < hotkeyList.count; i++) {
                    let H = hotkeyList.getValue(i);
                    let HD = app.hotkeys.newHotkeyData();
                    HD.hotkey = H.hotkey;
                    HD.action = H.action;
                    HD.global = H.global;
                    let idx = actionList.indexOf(HD.action);
                    if (idx >= 0) { // LS: to filter no longer existing actions (#14646)
                        HD.actionText = window.actionNamesList.getValue(idx);
                        list.add(HD);
                    }
                }
            });
        });
        list.autoSortDisabled = true;
        return list;
    }
    LV.controlClass.dataSource = getHotkeysList(app.hotkeys.getHotkeyList());
    LV.controlClass.setFocusedAndSelectedIndex(0);
    LV.controlClass.localListen(LV, 'focuschange', onHotkeyChanged);
    let cbAction = qid('cbAction');
    cbAction.controlClass.dataSource = actionNamesList;
    cbAction.controlClass.focusedIndex = 0;
    let edtHotkey = qid('edtHotkey');
    edtHotkey.controlClass.localListen(edtHotkey, 'focus', function () {
        app.hotkeys.setEditMode(true);
    });
    edtHotkey.controlClass.localListen(edtHotkey, 'blur', function () {
        app.hotkeys.setEditMode(false);
    });
    edtHotkey.controlClass.localListen(edtHotkey, 'keydown', function (e) {
        if((friendlyKeyName(e) !== 'Tab') || (e.ctrlKey || e.altKey)) {
            e.stopImmediatePropagation();
            e.preventDefault();
        }
    });
    edtHotkey.controlClass.localListen(edtHotkey, 'keyup', function (e) {
        if((friendlyKeyName(e) !== 'Tab') || (e.ctrlKey || e.altKey)) {
            e.stopImmediatePropagation();
            e.preventDefault(); // why this not prevent Alt+6 from entering the special char ?  
            // workarounded by following lines (issue #20690)
            let value = edtHotkey.controlClass.value;            
            requestTimeout(() => {
                edtHotkey.controlClass.value = value;  
            }, 1);
        }
    });
    edtHotkey.controlClass.localListen(edtHotkey, 'input', function (e) {
        e.stopImmediatePropagation();
        e.preventDefault();        
    });
    localListen(qid('cbAction'), 'change', setBtnApplyDisabledState);
    localListen(qid('chbGlobal'), 'click', function () {
        qid('btnApplyHotkey').controlClass.disabled = false;
    });
    localListen(qid('btnApplyHotkey'), 'click', function () {

        let LVc = LV.controlClass;
        let hotkey = qid('edtHotkey').controlClass.value;
        let exists = false;
        listForEach(LVc.dataSource, (item) => {
            if (item.hotkey.toUpperCase() == hotkey.toUpperCase()) {
                let msg = sprintf(_('This hotkey %s is already assigned to action %s! Choose a different hotkey.'), hotkey, '"' + getActionText(item.action) + '"');
                messageDlg(msg, 'Information', ['btnOK'], undefined, undefined);
                exists = true;
            }
        });
        if (!exists) {
            let idx = LVc.focusedIndex;
            let HD = LVc.getItem(idx);
            let addNew = (idx == 0);
            if (addNew) {
                HD = app.hotkeys.newHotkeyData();
                LVc.dataSource.insert(1, HD);
            }
            HD.action = actionList[qid('cbAction').controlClass.focusedIndex];
            HD.hotkey = hotkey;
            HD.global = qid('chbGlobal').controlClass.checked;
            if (addNew)
                LVc.setFocusedAndSelectedIndex(1);
            LVc.invalidateAll();
            qid('btnApplyHotkey').controlClass.disabled = true;
        }
    });

    let deleteHotkeys = () => {
        let list = LV.controlClass.dataSource.getSelectedList();
        list.whenLoaded().then(() => {
            if (list.count > 1) {
                messageDlg(_('Delete selected hotkeys?'), 'Confirmation', ['btnOK', 'btnCancel'], {
                    defaultButton: 'btnOK'
                }, function (result) {
                    if (result.btnID == 'btnOK') {
                        LV.controlClass.dataSource.deleteSelected();
                        // to refresh the values, add <New Hotkey...>, filter no longer accessible actions:
                        LV.controlClass.dataSource = getHotkeysList( LV.controlClass.dataSource);
                        LV.controlClass.setFocusedAndSelectedIndex(0);
                    }
                });
            } else 
            if (LV.controlClass.focusedIndex > 0)
            {
                let h = LV.controlClass.getItem(LV.controlClass.focusedIndex);
                messageDlg(_('Delete selected hotkey ?') + '<br>' + getActionText(h.action) + ' (' + h.hotkey + ')', 'Confirmation', ['btnOK', 'btnCancel'], {
                    defaultButton: 'btnOK'
                }, function (result) {
                    if (result.btnID == 'btnOK') {
                        LV.controlClass.dataSource.remove(h);
                        LV.controlClass.setFocusedAndSelectedIndex(0);
                    }
                });
            }
        });
    }

    localListen(qid('btnDeleteHotkey'), 'click', deleteHotkeys);
    LV.controlClass.localListen(LV, 'keydown', (e) => {
        if (friendlyKeyName(e) == 'Delete')
            deleteHotkeys();
    });

    LV.controlClass.localListen(LV, 'checkedchanged', function (e) {
        if (e.detail) {
            let idx = e.detail.div.itemIndex;
            if (idx >= 0) {
                let LVc = LV.controlClass;
                let HD = LVc.getItem(idx);
                if (HD) {
                    HD.global = e.detail.checked;
                    onHotkeyChanged();
                }
            }
        }
    });

    localListen(qid('btnImportHotkeys'), 'click', () => { 
        let promise = app.utils.dialogOpenFile('', 'json', '*.json|*.json', _('Open file'));
        promise.then(function (filename) {
            if (filename != '') {
                LV.controlClass.dataSource.loadFromFileAsync(filename).then(() => {
                    // to refresh the values, add <New Hotkey...>, filter no longer accessible actions:
                    LV.controlClass.dataSource = getHotkeysList( LV.controlClass.dataSource);
                });
            }
        });        
    });
    localListen(qid('btnExportHotkeys'), 'click', () => { 
        let promise = app.utils.dialogSaveFile('', 'json', '*.json|*.json', _('Save as'));
        promise.then(function (filename) {
            if (filename != '') {
                LV.controlClass.dataSource.saveToFileAsync(filename);
            }
        });
    });

    onHotkeyChanged(); // to init disabled states of buttons etc.
}

optionPanels.pnl_General.subPanels.pnl_Hotkeys.save = function (sett) {
    let DS = qid('lvHotkeysList').controlClass.dataSource;
    DS.locked(function () {
        let hotkeyList = window.hotkeys.hotkeyList;

        let oldDeletedHotkeys = hotkeyList.deletedHotkeys.getCopy();
        hotkeyList.deletedHotkeys.clear();
        hotkeyList.locked(() => {
            for (let i = 0; i < hotkeyList.count; i++) {
                let HD = hotkeyList.getValue(i);
                if (!DS.hotkeyExists(HD.hotkey, HD.action, HD.global))
                    hotkeyList.deletedHotkeys.add(HD);
            }
        });

        hotkeyList.clear();
        for (let i = 1; i < DS.count; i++) {
            let HD = DS.getValue(i);
            hotkeyList.add(HD);
        }

        oldDeletedHotkeys.locked(() => {
            for (let i = 0; i < oldDeletedHotkeys.count; i++) {
                let HD = oldDeletedHotkeys.getValue(i);
                if (!hotkeyList.hotkeyExists(HD.hotkey, HD.action, HD.global))
                    hotkeyList.deletedHotkeys.add(HD);
            }
        });

        hotkeyList.modified = true;
    });

}
