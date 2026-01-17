/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

requirejs('controls/simpletracklist');
requirejs('controls/checkbox');
requirejs('helpers/arrayDataSource');
requirejs('viewHandlers.js');

let UI = null;
let collectionList = null;
let treeItemsList = null;
let collections = null;

optionPanels.pnl_Library.subPanels.pnl_MediaTree.load = function (sett) {

    UI = getAllUIElements(qid('pnlCollectionsRoot'));

    let LV = UI.lvMediaTreeList;
    LV.controlClass.listCheckTipChecked = _('Visible always');
    LV.controlClass.listCheckTipUnchanged = _('Disabled');
    LV.controlClass.listCheckTipIndeterminate = _('Visible if content exists');
    LV.controlClass.showHeader = true;
    LV.controlClass.isSortable = false;
    LV.controlClass.multiselect = false;
    LV.controlClass.showEllipsisTooltip = false;
    LV.controlClass.enableDragNDrop();
    LV.controlClass.isAllowedDropIndex = function (targetItemIndex) {
        if (targetItemIndex < LV.controlClass.dataSource.count) {
            return true; // #17294
        }
    }

    function getMediaTreeItemTitle(item) {
        let text = '-';
        if (item.itemType == 'collection') {
            if (item.id == -2 || item.new || item.collection) {
                if (item.collection)
                    text = item.collection.name;
                else
                    text = item.name;
            } else {                
                collectionList.locked(function () {
                    let col = collectionList.getCollection(item.id);
                    if (col) {
                        text = col.name;
                    }
                });
            }
        } else {
            let dummyNode = {
                handlerID: item.itemType,
                dataSource: {}
            }
            let _text = nodeUtils.getNodeTitle(dummyNode);
            if (_text) // can be undefined for the temporal Audio CD node (nodeHandlers.optical_drive)
                text = _text;
        }
        return text;
    }

    let columns = new Array();
    columns.push({
        order: 1,
        title: _('Visible'),
        width: getTextWidth(_('Visible'), LV),
        setupCell: function (div, column) {
            GridView.prototype.cellSetups.setupDefault(div, column);

            let list = div.parentListView;

            let checkClick = function (e) {
                let chkb = e.target;
                if (chkb.itemIndex !== undefined) {
                    treeItemsList.locked(function () {
                        let item = treeItemsList.getValue(chkb.itemIndex);
                        if (!item.temporal) {
                            if (item.itemType == 'collection') {
                                if (item.visible == 2)
                                    item.visible = 0;
                                else
                                if (item.visible == 1)
                                    item.visible = 2;
                                else
                                    item.visible = 1;
                            } else {
                                if (item.visible == 1)
                                    item.visible = 0;
                                else
                                    item.visible = 1;
                            }
                            LV.controlClass.invalidateAll();
                            div.check.setAttribute('data-tip', div.check.controlClass.indeterminate ? list.listCheckTipIndeterminate : chkb.checked ? list.listCheckTipChecked : list.listCheckTipUnchanged);
                        }
                    });
                }
            }

            div.style.alignItems = 'center';
            div.classList.add('flex');
            div.check = document.createElement('div');
            div.check.controlClass = new Checkbox(div.check, {
                type: 'checkbox',
                triState: true,
                baseline: true,
                focusable:false
            });
            div.appendChild(div.check);
            div.check.controlClass.localListen(div.check, 'click', checkClick);
        },
        bindData: function (div, item, index) {
            let cb = div.check.controlClass;
            if (item.visible == 1) {
                cb.checked = true;
                cb.indeterminate = false;
            } else
            if (item.visible == 2) {
                cb.checked = false;
                cb.indeterminate = true;
            } else {
                cb.checked = false;
                cb.indeterminate = false;
            };
            cb.itemIndex = index;
            cb.disabled = item.temporal;

            setVisibility(div.check, true);
            let LV = div.parentListView;
            div.setAttribute('data-tip', cb.indeterminate ? LV.listCheckTipIndeterminate : cb.checked ? LV.listCheckTipChecked : LV.listCheckTipUnchanged);
        }
    });
    columns.push({
        order: 2,
        title: _('Content to display'),
        width: 400,
        bindData: function (div, item, index) {
            div.innerText = getMediaTreeItemTitle(item);
            let LV = div.parentListView;
            div.setAttribute('data-tip', (item.visible == 2) ? LV.listCheckTipIndeterminate : (item.visible == 1) ? LV.listCheckTipChecked : LV.listCheckTipUnchanged);
        }
    });
    LV.controlClass.setColumns(columns);

    collections = app.getCollections().getCopy();
    let listView = UI.lvMediaTreeList;
    collections.getCollectionListAsync({
        cacheVisibility: false,
        includeEntireLibrary: true
    }).then(function (l) {
        collectionList = l;
        let state = app.getValue('mediaTreeItems', {
            treeNodes: []
        });
        treeItemsList = new ArrayDataSource(state.treeNodes);

        for (let i = treeItemsList.count - 1; i >= 0; i--) {
            let item = treeItemsList.getValue(i);
            if ((getMediaTreeItemTitle(item) == '-') || // item no longer exists
                (item.new && (item.itemType == 'collection')) ||
                (item.itemType == 'loading')) 
            {
                treeItemsList.delete(i);
            } else {
                let nh = nodeHandlers[item.itemType];
                item.temporal = false;
                if (nh && nh.temporal) {
                    item.visible = 2; 
                    item.temporal = true;
                }
            }            
        }

        treeItemsList.customSort(function (item1, item2) {
            return (item1.pos - item2.pos);
        });

        listView.controlClass.dataSource = treeItemsList;
        UI.editButtons.controlClass.dataSource = treeItemsList;
        UI.editButtons.controlClass.listView = listView;
        //UI.editButtons.controlClass.lastItemEditable = false;
        UI.editButtons.controlClass.firstItemDeletable = false; // Entire collection is not deletable
        UI.editButtons.controlClass.itemEditableCallback = function (item) {
            return (item && (resolveToValue(item.itemType, '') == 'collection')) ? true : false;
        };
        UI.editButtons.controlClass.itemDeletableCallback = function (item) {
            if (item && (resolveToValue(item.itemType, '') == 'collection'))
                return (item.id != -1) || item.new;
            else
                return false;
        };
        listView.controlClass.setFocusedAndSelectedIndex(0);
    });    

    let actionFunc = function (event) {   
        UI.editButtons.controlClass.buttons.edit.click(); 
    };

    listView.controlClass.localListen(listView, 'itemdblclick', actionFunc);
    listView.controlClass.localListen(listView, 'itementer', actionFunc);

    UI.editButtons.controlClass.beforeDeleteMethod = () => {
        return new Promise(function (resolve, reject) {
            treeItemsList.locked(function () {
                collectionList.locked(function () {
                    let item = treeItemsList.getValue(treeItemsList.focusedIndex).collection;
                    if (!item)
                        item = collectionList.getCollection( treeItemsList.getValue( treeItemsList.focusedIndex).id);
                    messageDlg(sprintf(_('This will delete the "%s" Collection.'), escapeXml(item.name)) + ' <br>' + _('Do you want to proceed?'), 'Confirmation', ['btnYes', 'btnNo'], {
                        defaultButton: 'btnNo',
                        title: _('Delete Collection')
                    }, function (result) {
                        if (result.btnID === 'btnYes') {
                            resolve();
                        } else {
                            reject();
                        }
                    });

                });
            });
        });
    };

    let buttons = UI.editButtons.controlClass.buttons;
    UI.editButtons.controlClass.localListen(buttons.edit, 'click', function () {
        if (!app.utils.isRegistered()) {
            window.uitools.showGoldMessage(_('Please upgrade to MediaMonkey Gold for this feature!'));
            return;
        }

        if (treeItemsList.focusedIndex >= 0 && treeItemsList.count) {
            let item = null;
            treeItemsList.locked(function () {
                collectionList.locked(function () {
                    let treeItem = treeItemsList.getValue(treeItemsList.focusedIndex);
                    item = treeItem.collection;
                    if (!item)
                        item = collectionList.getCollection(treeItem.id);
                });
            });
            if (item) {
                let dlg = uitools.openDialog('dlgCollectionOptions', {
                    item: item,
                    modal: true,
                    fromOptions: true,
                });
                dlg.whenClosed = function () {
                    listView.controlClass.rebind();
                };
                app.listen(dlg, 'closed', dlg.whenClosed);
            }
        }
    });
    UI.editButtons.controlClass.localListen(buttons.new, 'click', newCollection);
}

function newCollection() {
    if (!app.utils.isRegistered()) {
        window.uitools.showGoldMessage(_('Please upgrade to MediaMonkey Gold for this feature!'));
        return;
    }

    let newItem = collections.getNewCollection();
    let dlg = uitools.openDialog('dlgCollectionOptions', {
        item: newItem,
        isNew: true,
        modal: true,
        fromOptions: true,
    });
    dlg.closed = function () {
        if (dlg.modalResult == 1) {
            let newPos = treeItemsList.focusedIndex + 1;
            let newTreeItem = {
                new: true,
                itemType: 'collection',
                id: newItem.id,
                name: newItem.name,
                visible: newItem.visibleInMainTree,
                pos: newPos,
                collection: newItem
            };            
            newItem.pos = newPos;
            treeItemsList.insert( newPos, newTreeItem);
            UI.lvMediaTreeList.controlClass.setFocusedAndSelectedIndex( newPos).then(() => {
                UI.lvMediaTreeList.controlClass.setFocusedFullyVisible();
            });
        }
    };
    app.listen(dlg, 'closed', dlg.closed);
}

optionPanels.pnl_Library.subPanels.pnl_MediaTree.save = function (sett) {

    let deleted = UI.editButtons.controlClass.deletedItems;
    collectionList.locked(function () {
        deleted.forEach(function (col) {
            let collection = collectionList.getCollection(col.id);
            if (collection) {
                collection.setDeleteFlag()
                collection.commitAsync();
            }
        });
    });

    // add new collections:
    treeItemsList.forEach(function (item) {
        if (item.new && item.collection)
            collectionList.add(item.collection);
    });

    let _collectionList = collectionList;
    let _treeItemsList = treeItemsList;  
    collections.saveAllCollectionsAsync(_collectionList).then(function () {

        // update positions & save
        _collectionList.locked(function () {
            _treeItemsList.forEach(function (item, idx) {
                item.pos = idx;

                if (item.collection) {
                    item.collection.pos = item.pos;
                    if (item.id != item.collection.id) { // LS: the new collection got new db ID (in saveAllCollectionsAsync)
                        // assign the nodes configured for new collection (#18106)
                        let copy = item.collection.getCopy();
                        copy.id = item.id; // old id
                        let list = nodeHandlers.collection.getConfiguredNodes(copy);
                        nodeHandlers.collection.setConfiguredNodes(item.collection, list); // stores nodes under the new id
                        // assign the new id
                        item.id = item.collection.id;
                    }

                    item.collection.visibleInMainTree = item.visible;
                    item.collection = null; // so that it is not stored (as garbage) in the persistent.JSON (mediaTreeItems array)
                    item.new = false; // to not be subsequently deleted on next opening
                }

                //ODS('Save tree item: ' + JSON.stringify(item));
                let col = _collectionList.getCollection(item.id);
                if (col) {
                    col.pos = item.pos;
                    if (col.visibleInMainTree != item.visible) {
                        col.visibleInMainTree = item.visible;
                        col.commitAsync();
                    }
                }
            });
        });

        app.setValue('mediaTreeItems', {
            treeNodes: _treeItemsList.array
        });    

        app.collections.notifyChange();        
    });
}

optionPanels.pnl_Library.subPanels.pnl_MediaTree.beforeWindowCleanup = function () {
    UI = null;
    collectionList = null;
    treeItemsList = null;
    collections = null;    
}