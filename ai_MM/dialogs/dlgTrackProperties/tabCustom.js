/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

requirejs('helpers/arrayDataSource');
requirejs('utils');

propertiesTabs.tabCustom.load = function (track, dialog) {

    let mainElement = qid('tabCustomContent');

    let sett = window.settings.get('CustomFields');
    for (let i = 1; i <= 10; i++) {
        qeid(mainElement, 'lbl_custom' + i).innerText = sett.CustomFields['Fld' + i + 'Name'] + ':';
        qeid(mainElement, 'custom' + i).controlClass.value = track['custom' + i];
    }
    let LV = qeid(mainElement, 'lvExtendedTags');
    LV.controlClass.showHeader = true;
    LV.controlClass.isSortable = false;
    LV.controlClass.multiselect = false;
    //LV.controlClass.enableDragNDrop();

    let lvExtendedTags = qeid(mainElement, 'lvExtendedTags');
    let editButtons = qeid(mainElement, 'editButtons');

    let columns = new Array();
    let firstIdx;
    if (dialog.isGroup) {
        columns.push({
            order: 1,
            title: '',
            isSortable: false,
            headerRenderer: GridView.prototype.headerRenderers.renderCheck,
            setupCell: GridView.prototype.cellSetups.setupCheckbox,
            bindData: GridView.prototype.defaultBinds.bindCheckboxCell,
            width: 25,
            minWidth: '2em',
            adaptableSize: false // this column will not be resized when 'Automatic column widths' is checked
        });
        firstIdx = 2;
        editButtons.controlClass.renamedItems = [];
    } else
        firstIdx = 1;

    columns.push({
        order: firstIdx,
        title: _('Tag name'),
        width: 150,
        bindData: function (div, item, index) {
            let o = JSON.parse(item.toString());
            div.innerText = o.title;
        },
        getValue: function (item) {
            let o = JSON.parse(item.toString());
            return o.title;
        },
        setValue: function (item, newValue, raw, idx) {
            let o = JSON.parse(item.toString());
            if (o.title !== newValue) {
                let oldValue = o.title;
                o.title = newValue;
                let newJSON = JSON.stringify(o);
                let ds = LV.controlClass.dataSource;
                ds.modifyAsync(function () {
                    if (!window._cleanUpCalled) {
                        ds.setValue(idx, newJSON);
                        if (dialog.isGroup) {
                            ds.setChecked(idx, true);
                            editButtons.controlClass.renamedItems.push({
                                title: oldValue,
                                value: ''
                            });
                        };
                    }
                });

                window.modified = true;
                window.tagModified = true;
                return false;
            }
            return true; // do not save
        },
        editor: (window.isReadOnly ? undefined : editors.gridViewEditors.multiValueEdit),
        editorParams: '{dbFunc:"getStringList", dbFuncParams: {category: "extendedTags"}}',
        adaptableSize: false // this column will not be resized when 'Automatic column widths' is checked
    });
    columns.push({
        order: firstIdx + 1,
        title: _('Tag value'),
        width: 290,
        bindData: function (div, item, index) {
            let o = JSON.parse(item.toString());
            div.innerText = o.value;
        },
        getValue: function (item) {
            let o = JSON.parse(item.toString());
            return o.value;
        },
        setValue: function (item, newValue, raw, idx) {
            let o = JSON.parse(item.toString());
            if (o.value !== newValue) {
                o.value = newValue;
                let newJSON = JSON.stringify(o);
                let ds = LV.controlClass.dataSource;
                ds.modifyAsync(function () {
                    if (!window._cleanUpCalled) {
                        ds.setValue(idx, newJSON);
                        if (dialog.isGroup) {
                            ds.setChecked(idx, true);
                        };
                    };
                });

                window.modified = true;
                window.tagModified = true;
                return false;
            }
            return true; // do not save
        },
        editor: (window.isReadOnly ? undefined : editors.gridViewEditors.multiLineEdit)
    });
    LV.controlClass.setColumns(columns);
    let buttons = editButtons.controlClass.buttons;
    setVisibility(buttons.up, false);
    setVisibility(buttons.down, false);
    setVisibility(editButtons, false);

    dialog.localPromise(track.getExtendedTagsAsync()).then(function (txt) {
        let extendedTagsList;
        if (txt) {
            if (dialog.isGroup && (txt === '-')) {
                // were different values, temporary special handling, #16924
                extendedTagsList = [];
                lvExtendedTags.controlClass.disabled = true;
                editButtons.controlClass.disabled = true;
            } else
                extendedTagsList = getExtendedTagsList(txt);
        } else
            extendedTagsList = [];

        let ds = newStringList(true);
        ds.autoSort = false;
        extendedTagsList.forEach(function (it, idx) {
            it.value = it.value || ''; // to avoid "undefined" for empty and not saved strings
            ds.add(JSON.stringify(it));
        });
        LV.controlClass.dataSource = ds;
        editButtons.controlClass.dataSource = LV.controlClass.dataSource;
        setVisibility(editButtons, !window.isReadOnly);
    });

    let actionFunc = function (event) {
        LV.controlClass.editStart();
    };

    if (!window.isReadOnly) {
        dialog.trackLocalListen(LV, 'itemdblclick', actionFunc);
        dialog.trackLocalListen(LV, 'itementer', actionFunc);
        dialog.trackLocalListen(buttons.edit, 'click', actionFunc);
        dialog.trackLocalListen(buttons.new, 'click', function () {
            let newObj = {
                title: '<' + _('New value') + '>',
                value: '',
            };
            let ds = LV.controlClass.dataSource;
            ds.add(JSON.stringify(newObj));
            LV.controlClass.requestTimeout(() => {
                ds.focusedIndex = ds.count - 1;
                if (dialog.isGroup)
                    LV.controlClass.focusedColumnIndex = 1;
                else
                    LV.controlClass.focusedColumnIndex = 0;
                LV.controlClass.editStart();
            }, 200); // wait a little bit, so LV is prepared, columns widths set, toherwise it would cancel edit mode immediatelly
            window.modified = true;
            window.tagModified = true;
        });
        dialog.trackLocalListen(buttons.delete, 'click', function (evt) {
            window.modified = true;
            window.tagModified = true;
            window.extendedTagsDeleted = true;
        }, true);
    };
}

propertiesTabs.tabCustom.saveAsync = function (track, dialog) {
    let mainElement = qid('tabCustomContent');
    let extendedTags = [];
    let retPromise = undefined;
    let LV = qeid(mainElement, 'lvExtendedTags');
    let existingExTags = {};
    let existingExTagPairs = {}; // used for removing duplicates
    if (LV && LV.controlClass.dataSource) {
        let ds = LV.controlClass.dataSource;
        ds.locked(() => {
            ds.forEach(function (it, idx) {
                if (!existingExTagPairs[it]) { // do not store duplicates
                    existingExTagPairs[it] = true;
                    let o = JSON.parse(it);
                    if (dialog.isGroup) {
                        existingExTags[o.title] = 1;
                        if (ds.isChecked(idx)) {
                            extendedTags.push(o);
                        }
                    } else {
                        extendedTags.push(o);
                    }
                }
            });
        });
    };
    let extendedTagsStr = '';
    if (!dialog.isGroup) {
        for (let i = 1; i <= 10; i++) {
            track['custom' + i] = qeid(mainElement, 'custom' + i).controlClass.value;
        };
        if (extendedTags.length > 0)
            extendedTagsStr = JSON.stringify(extendedTags);
        retPromise = track.setExtendedTagsAsync(extendedTagsStr);
    } else {
        // multiple tracks modification
        let id;
        let editButtons = qeid(mainElement, 'editButtons');
        let deletedItems = editButtons.controlClass.deletedItems;

        deletedItems.forEach((it) => {
            let o = JSON.parse(it);
            if (!existingExTags[o.title]) { // not inserted again and not added yet -> add as item to delete
                o.deleted = true;
                existingExTags[o.title] = 1; // to not insert duplicates
                extendedTags.push(o);
            }
        });
        editButtons.controlClass.renamedItems.forEach((o) => {
            if (!existingExTags[o.title]) {
                o.deleted = true;
                existingExTags[o.title] = 1; // to not insert duplicates
                extendedTags.push(o);
            }
        });

        if (extendedTags.length > 0)
            extendedTagsStr = JSON.stringify(extendedTags);

        for (let i = 1; i <= 10; i++) {
            id = 'custom' + i;
            let chb = qeid(mainElement, 'chb_' + id);
            if (chb && chb.controlClass.checked)
                track[id] = qeid(mainElement, id).controlClass.value;
        };
        retPromise = track.setExtendedTagsAsync(extendedTagsStr);
    }
    return retPromise;
}
