/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

let UI = null;
let list = null;
let organizer = null;

optionPanels.pnl_Library.subPanels.pnl_AutoOrganize.load = function (sett) {

    let pnlRoot = qid('pnlAutoOrganizeRoot');
    UI = getAllUIElements(pnlRoot);

    let chbText = _('Automatically organize files (during scans or edits)');
    if (!app.utils.isRegistered()) {
        chbText += ' <b>(Gold)</b>';
        window.uitools.handleGoldCheckbox(UI.chbAutoOrganizeEnableOrganize, _('For auto-organize functionality, please upgrade to MediaMonkey Gold!'));
    }
    UI.chbAutoOrganizeEnableOrganize.controlClass.text = chbText;

    organizer = app.trackOperation.autoOrganizer();
    list = organizer.rules;
    UI.editButtons.controlClass.dataSource = list;

    let LV = UI.lvAutoOrganizeRulesList;
    LV.controlClass.showHeader = true;
    LV.controlClass.isSortable = false;
    LV.controlClass.multiselect = false;
    LV.controlClass.enableDragNDrop();

    let columns = new Array();
    columns.push({
        order: 0,
        width: 80,
        title: _('Criteria'),
        bindData: function (div, item, index) {
            div.innerText = item.ruleText;
        }
    });
    columns.push({
        order: 1,
        width: 150,
        title: _('Directory'),
        bindData: function (div, item, index) {
            div.innerText = item.path;
        }
    });
    columns.push({
        order: 2,
        width: 300,
        title: _('File Format'),
        bindData: function (div, item, index) {
            div.innerText = item.mask;
        }
    });
    LV.controlClass.setColumns(columns);

    LV.controlClass.dataSource = list;
    LV.controlClass.setFocusedAndSelectedIndex(0);

    UI.edtAutoOrganizeExludedFolders.controlClass.value = sett['Auto-organize'].ExcludeFolders;
    UI.chbAutoOrganizeEnableOrganize.controlClass.checked = app.utils.isRegistered() && sett['Auto-organize'].DoInBackground;
    UI.chbAutoOrganizeDeleteEmptiedFolders.controlClass.checked = sett['Auto-organize'].DeleteEmptiedFolders;
    bindDisabled2Checkbox(UI.chbAutoOrganizeDeleteEmptiedFolders, UI.chbAutoOrganizeEnableOrganize);

    let buttons = UI.editButtons.controlClass.buttons;
    UI.editButtons.controlClass.localListen(buttons.new, 'click', function () {
        let newItem = organizer.getNewRule();
        let dlg = uitools.openDialog('dlgAutoOrganizeRule', {
            item: newItem,
            modal: true,
        });
        dlg.closed = function () {
            if (dlg.modalResult == 1) {
                list.add(newItem);
                UI.editButtons.controlClass.updateDisabledState();
            }
        };
        app.listen(dlg, 'closed', dlg.closed);
    });

    let _editRule = function (item) {
        let dlg = uitools.openDialog('dlgAutoOrganizeRule', {
            item: item,
            modal: true,
        });
        dlg.closed = function () {
            if (dlg.modalResult == 1) {
                LV.controlClass.invalidateAll();
            }
        };
        app.listen(dlg, 'closed', dlg.closed);
    }


    UI.editButtons.controlClass.localListen(buttons.edit, 'click', function () {

        list.locked(function () {
            let item = list.getValue(list.focusedIndex);
            _editRule(item);
        });
    });

    LV.controlClass.localListen(LV, 'itemdblclick', (e) => {
        _editRule(e.detail.item);
    });

}

optionPanels.pnl_Library.subPanels.pnl_AutoOrganize.save = function (sett) {
    let deleted = UI.editButtons.controlClass.deletedItems;
    for (let i = 0; i < deleted.length; i++) {
        deleted[i].deleteRule();
    }
    deleted.length = 0;

    sett['Auto-organize'].ExcludeFolders = UI.edtAutoOrganizeExludedFolders.controlClass.value;
    sett['Auto-organize'].DoInBackground = UI.chbAutoOrganizeEnableOrganize.controlClass.checked;
    sett['Auto-organize'].DeleteEmptiedFolders = UI.chbAutoOrganizeDeleteEmptiedFolders.controlClass.checked;

    organizer.excludedDirs = UI.edtAutoOrganizeExludedFolders.controlClass.value;
    organizer.commitAsync();
}

optionPanels.pnl_Library.subPanels.pnl_AutoOrganize.beforeWindowCleanup = function () {
    UI = null;
    list = null;
    organizer = null;    
}
