/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

requirejs("controls/maskedit");

function init(params) {

    let convertSettings = params.item;

    title = _('Compatible media formats');
    resizeable = true;

    let UI = getAllUIElements();

    let LV = UI.lvFormatList;
    LV.controlClass.showHeader = true;
    LV.controlClass.isSortable = false;
    LV.controlClass.multiselect = false;
    LV.controlClass.enableDragNDrop();
    let columns = new Array();
    columns.push({
        order: 1,
        width: 200,
        title: _('Content'),
        bindData: function (div, item, index) {
            div.innerText = item.content;
        }
    });
    columns.push({
        order: 2,
        width: 400,
        title: _('Format'),
        bindData: function (div, item, index) {
            div.innerText = item.formatText;
        }
    });
    LV.controlClass.setColumns(columns);

    let suppFormatList = convertSettings.getSupportedFormatsList();
    LV.controlClass.dataSource = suppFormatList;
    UI.editButtons.controlClass.dataSource = suppFormatList;

    let buttons = UI.editButtons.controlClass.buttons;
    window.localListen(buttons.new, 'click', function () {
        let newItem = convertSettings.getNewSupportedFormat();
        let dlg = uitools.openDialog('dlgSupportedFormat', {
            item: newItem,
            modal: true,
        });
        dlg.closed = function () {
            if (dlg.modalResult == 1) {
                suppFormatList.add(newItem);
            }
        };
        window.localListen(dlg, 'closed', dlg.closed);
    });

    window.localListen(buttons.edit, 'click', function () {
        let item = suppFormatList.focusedItem;
        let _copy = item.getCopy();
        let dlg = uitools.openDialog('dlgSupportedFormat', {
            item: item,
            modal: true,
        });
        dlg.closed = function () {
            if (dlg.modalResult == 1)
                LV.controlClass.invalidateAll();
            else
                item.loadFrom(_copy);
        };
        window.localListen(dlg, 'closed', dlg.closed);
    });
    window.localListen(LV, 'itemdblclick', function () {
        buttons.edit.click();
    });
    window.localListen(LV, 'itementer', function () {
        buttons.edit.click();
    });
    window.localListen(UI.btnOK, 'click', function () {
        convertSettings.setSupportedFormatsList(suppFormatList);
        modalResult = 1;
    });
}