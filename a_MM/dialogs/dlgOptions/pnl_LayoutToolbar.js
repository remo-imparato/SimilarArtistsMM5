/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";
requirejs('helpers/arrayDataSource');
requirejs('actions');

function _getActionsLists() {

    let items = [];

    let getLevel = function (rootKey, level, category) {
        let keys = Object.keys(level);
        for (let i = 0; i < keys.length; i++) {
            let key = keys[i];
            let act = level[key];
            if (act && act.hotkeyAble) {
                if (rootKey != '')
                    key = rootKey + '.' + keys[i]; // e.g. view.mediaTree
                if (act.category && !act.execute && !act.submenu) {
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
                        key: key,
                        icon: resolveToValue(act.icon),
                        category: cat
                    });
                }
            }
        }
    }
    getLevel('', window.actions);

    items.sort(function (a, b) {
        // place actions without icons at the end:
        if (a.icon && !b.icon)
            return -1;
        else
        if (!a.icon && b.icon)
            return 1;
        else {
            let A = a.title.toUpperCase();
            let B = b.title.toUpperCase();
            if (A < B)
                return -1;
            else
            if (A > B)
                return 1;
            else
                return 0;
        }
    });

    items.insert(0, { key: 'separator', title: '<- ' + _('Separator') + ' ->' });

    return items;
}

function _presetActionsLV(LV, allowDrop) {

    LV.controlClass.showHeader = false;
    LV.controlClass.isSortable = false;
    LV.controlClass.multiselect = false;
    LV.controlClass.enableDragNDrop();

    let defaultColumns = [];

    defaultColumns.push({
        visible: true,
        title: _('Icon'),
//        width: 24, // defined by icon style, this would soemtimes cause #20508
        order: 1,
        setupCell: function (div, column) {
            GridView.prototype.cellSetups.setupBase(div, column);
            div.style.alignSelf = 'center';
        },
        bindData: function (div, item, index) {            
            let act; 
            let icon = '';
            if (item.key != 'separator') {
                act = window.hotkeys.getAction(item.key);
                icon = window.hotkeys.getActionIcon(act);
            }
            templates.itemDoubleIconFunc(div, item, icon);
        }
    });
    defaultColumns.push({
        visible: true,
        title: _('Title'),
        width: 480,
        order: 2,
        setupCell: function (div, column) {
            div.classList.add('flex');
            div.classList.add('fill');
            div.classList.add('row');

            div.content = document.createElement('div');
            div.content.classList.add('textEllipsis');
            div.content.parentListView = div.parentListView;
            div.content.style.padding = 'inherit';
            div.appendChild(div.content);

        },
        bindData: function (div, item, index) {
            div.innerText = item.title;
        }
    });

    LV.controlClass.setColumns(defaultColumns);

    if (allowDrop) {
        LV.controlClass.getDropMode = function (e) {
            let srcCtrl = e.dataTransfer.getSourceControl();
            if (srcCtrl && srcCtrl._isAllActionsListView)
                return 'copy';
            else
                return 'move';
        };
        LV.controlClass.canDrop = function (e) {
            return true;
        };
        LV.controlClass.drop = function (e) {
            this.cancelDrop();
            let dropMode = dnd.getDropMode(e);
            if (dropMode == 'move') {
                // D&D inside the left list:
                this.dropToPosition(this.getDropIndex(e));
            } else {
                // D&D from the right to the left list:
                let srcCtrl = e.dataTransfer.getSourceControl();
                if (srcCtrl && srcCtrl.controlClass) {
                    let data = dnd.getDragObject(e);
                    if (data.count) {
                        data.locked(() => {
                            srcCtrl.controlClass.dataSource.locked(() => {
                                this.dataSource.locked(() => {
                                    let item = data.getValue(0);
                                    let dropidx = this.getDropIndex(e);
                                    this.dataSource.clearSelection();
                                    this.dataSource.insert(dropidx, item);
                                });
                            });
                        });
                    }
                }
            }
        };
    }
}

optionPanels.pnl_Layouts.subPanels.pnl_LayoutToolbar.load = function (sett) {

    // Selected actions:
    let lvToolbarActionList = qid('lvToolbarActionList');
    _presetActionsLV(lvToolbarActionList, true);

    let actionsList = _getActionsLists();

    let selActions = [];
    app.getValue('toolbarItems', []).forEach((itm) => {
        forEach(actionsList, (act) => {
            if (itm == act.key)
                selActions.push(copyObject(act));
        });
    });

    lvToolbarActionList.controlClass.dataSource = new ArrayDataSource(selActions, {
        isLoaded: true
    });

    let editButtons = qid('editButtons');
    editButtons.controlClass.dataSource = lvToolbarActionList.controlClass.dataSource;
    editButtons.controlClass.listView = lvToolbarActionList;

    // All availbale actions:
    let lvActionList = qid('lvActionList');
    _presetActionsLV(lvActionList);
    lvActionList._isAllActionsListView = true;

    lvActionList.controlClass.dataSource = new ArrayDataSource(actionsList, {
        isLoaded: true
    });
}

optionPanels.pnl_Layouts.subPanels.pnl_LayoutToolbar.save = function (sett) {
    let lvToolbarActionList = qid('lvToolbarActionList');
    let ar = [];
    let list = lvToolbarActionList.controlClass.dataSource;
    listForEach(list, (item) => {
        ar.push(item.key);
    });

    let wasEmpty = (app.getValue('toolbarItems', []).length == 0);
    app.setValue('toolbarItems', ar);
    if (wasEmpty && ar.length > 0) 
        app.setValue('toolbarVisible', true /* #19549 */);
}
