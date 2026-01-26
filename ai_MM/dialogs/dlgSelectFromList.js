/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

requirejs("controls/gridview");
requirejs("controls/trackListView");

let allowEmpty = true;
let recentlyUsedColumns = [];
let MAX_MRU_COLUMNS = 8;

let addColumnToMRU = function (columnType) {
    if (columnType) {
        let idx = recentlyUsedColumns.indexOf(columnType);
        if (idx >= 0) {
            recentlyUsedColumns.splice(idx, 1);
        }
        recentlyUsedColumns.unshift(columnType);
        if (recentlyUsedColumns.length > MAX_MRU_COLUMNS)
            recentlyUsedColumns.pop();
    }
};

let findItem = function (dataSource, findType) {
    let ret = -1;
    dataSource.locked(function () {
        let itm;
        for (let i = 0; i < dataSource.count; i++) {
            itm = dataSource.getFastObject(i, itm);
            let col = JSON.parse(itm);
            if (col.columnType == findType) {
                ret = i;
                break;
            }
        }
    });
    return ret;
}

// ColumnGridView --------------------------------------------
class ColumnGridView extends GridView {

    initialize(rootelem, params) {
        super.initialize(rootelem, params);
        this.showHeader = false;
        this.checkUnique = false;
        this.enableDragNDrop();
        this.defaultColumns = new Array();
        let i = 1;
        if (params && params.showOrder) {
            this.defaultColumns.push({
                order: i,
                bindData: function (div, item, index) {
                    div.innerText = (index + 1) + '.';
                }
            });
            i++;
        };
        if (params && params.checkUnique) {
            this.checkUnique = true;
        }

        this.defaultColumns.push({
            order: i,
            bindData: function (div, item, index) {
                if (div.parentListView && div.parentListView.dataSource) {
                    let it = div.parentListView.dataSource.getValue(index);
                    let obj = JSON.parse(it);
                    div.innerText = obj.title;
                    if (this.checkUnique)
                        if (obj.locked)
                            div.classList.add('itemInaccessible');
                        else
                            div.classList.remove('itemInaccessible');
                }
            }
        });
        this.setColumns(this.defaultColumns);
    }

    _prepareSortColumns(sortStr) {}

    getDropMode(e) {
        return 'move';
    }

    canDrop(e) {
        if (!this.dndEventsRegistered)
            return false;
        let dtype = dnd.getDropDataType(e);
        if (dtype !== 'string')
            return false;
        let sameListView = dnd.isSameControl(e);
        if (sameListView && this.disableReorder)
            return false;
        let data = dnd.getDragObject(e, 'string');
        if (data && data.count) {
            let itm;
            data.locked(() => {
                itm = data.getValue(0);
            });
            if (itm) {
                let obj = JSON.parse(itm);
                if (obj && obj.locked)
                    return false;
            }
        }
        let allowed = true;
        let srcCtrl = e.dataTransfer.getSourceControl();
        if (this.checkUnique) {
            let didx = this.getDropIndex(e);
            if ((didx >= 0) && (didx < this.dataSource.count)) {
                this.dataSource.locked(() => {
                    let item = this.dataSource.getValue(didx);
                    if (item) {
                        let col = JSON.parse(item);
                        if (col.locked)
                            allowed = false;
                    }
                });
            }
        }

        return (srcCtrl && srcCtrl.controlClass && (srcCtrl.controlClass.constructor.name === this.constructor.name)) && allowed;
    }

    drop(e) {
        this.cancelDrop();
        let dropMode = dnd.getDropMode(e);
        if (dropMode == 'move') {
            let srcCtrl = e.dataTransfer.getSourceControl();
            if (srcCtrl && srcCtrl.controlClass) {
                let didx = this.getDropIndex(e);
                if (dnd.isSameControl(e))
                    this.dropToPosition(didx);
                else {
                    if (this._dataSource) {
                        let data = dnd.getDragObject(e, 'string');
                        // we need to wait for list to be loaded (because getSelectedList is asynchronous)
                        data.whenLoaded().then(() => {
                            data.forEach((itm) => {
                                let col = JSON.parse(itm);
                                if (this.checkUnique && (col.uniqueWith !== undefined)) { // this column is unique with any other column
                                    // check item is already in the list ... if so, add this one and remove old
                                    let idx = findItem(this._dataSource, col.uniqueWith);
                                    if (idx >= 0) {
                                        this._dataSource.locked(function () {
                                            srcCtrl.controlClass.dataSource.add(this._dataSource.getValue(idx));
                                        }.bind(this));
                                        this._dataSource.delete(idx);
                                    }
                                }
                                addColumnToMRU(col.columnType);
                            });
                            if (this._dataSource.autoSort)
                                this._dataSource.addList(data);
                            else
                                this._dataSource.insertList(didx, data);

                            srcCtrl.controlClass.dataSource.deleteSelected();
                            srcCtrl.controlClass.focusedIndex = -1; // need to be updated so focusedIndex is in range
                        });
                    }
                }
            }
        }
    }

    updateDropEffect(itemIndex) {
        if (this._dataSource && this._dataSource.autoSort)
            return; // no drop effect, as we insert only in sort order
        else
            super.updateDropEffect(itemIndex);
    }
}
registerClass(ColumnGridView);

function init(params) {
    initEditor(params);
}

function initEditor(params) {
    title = params.title || _('Column settings');

    let UI = getAllUIElements();
    if (params.allowEmpty !== undefined)
        allowEmpty = params.allowEmpty;
    if (params.listLabel !== undefined) {
        UI.listLabel.textContent = params.listLabel;
    }
    if (params.listLabelAll !== undefined) {
        UI.listLabelAll.textContent = params.listLabelAll;
    }
    let ds = newStringList(true);
    let dsAll = newStringList(true);
    let fixedCols = [];
    let lockedCols = [];
    let denied = [];
    if (params.allColumns) {
        for (let i = 0; i < params.allColumns.length; i++) {
            let col = params.allColumns[i];
            if (!resolveToValue(col.disabled, false, params.LV)) {
                if ((col.uniqueWith == undefined) || (denied.indexOf(col.uniqueWith) < 0)) { // uniqueWith field means only one of these columns can be enabled
                    if (col.uniqueWith !== undefined)
                        denied.push(col.uniqueWith);

                    let obj = {
                        title: resolveToValue(col.title, ''), // title has to be first, so sorting will work ok even with JSONs
                        columnType: col.columnType,
                        origIndex: i,
                        uniqueWith: col.uniqueWith
                    };
                    if (col.locked) {
                        obj.locked = true;
                        lockedCols.push(obj);
                        col.fixed = true;
                    }
                    if (col.fixed) {
                        fixedCols.push(obj);
                        if (resolveToValue(col.title, '') !== '') {
                            ds.add(JSON.stringify(obj));
                        }
                    } else {
                        if (col.visible)
                            ds.add(JSON.stringify(obj));
                        else
                            dsAll.add(JSON.stringify(obj));
                    }
                }
            }
        }
        dsAll.autoSort = true;
    }
    ds.autoUpdateDisabled = true;
    dsAll.autoUpdateDisabled = true;
    UI.gvColumnsList.controlClass.dataSource = ds;
    UI.gvAllColumnsList.controlClass.dataSource = dsAll;
    UI.editButtons.controlClass.dataSource = ds;
    UI.editButtons.controlClass.listView = UI.gvColumnsList;
    UI.editButtons.controlClass.itemMovableableCallback = function (itm, idx, isUp, list) {
        if (itm) {
            let obj = JSON.parse(itm);
            if (!obj || (obj && obj.locked))
                return false;
            let checkItm;
            let checkIdx;
            if(isUp) {
                // previous has to be movable
                checkIdx = idx - 1;
                if(checkIdx<0)
                    return false;
            } else {
                // next has to be movable
                checkIdx = idx + 1;
                if(checkIdx >= list.count)
                    return false;
            }
            list.locked(function () {
                checkItm = list.getValue(checkIdx);
            });
            obj = JSON.parse(checkItm);
            return obj && !obj.locked;
        } else
            return false;
    };

    let checkOK = function () {
        if (UI.btnEditorOK.controlClass)
            UI.btnEditorOK.controlClass.disabled = (ds.count === 0);
        if (UI.btnOK && UI.btnOK.controlClass) // used in dlgEditView
            UI.btnOK.controlClass.disabled = (ds.count === 0);
    }

    let checkRemoveBtn = function () {
        let ds = UI.gvColumnsList.controlClass.dataSource;
        let focused = ds.focusedItem;
        if (focused) {
            let obj = JSON.parse(focused);
            UI.btnItemRemove.controlClass.disabled = obj.locked;
        } else if (ds.itemsSelected) {
            let selItems = ds.getSelectedList();
            window.localPromise(selItems.whenLoaded()).then(function () {
                let anyLocked = false;
                selItems.locked(function () {
                    for (let i = 0; i < selItems.count; i++) {
                        let item = selItems.getValue(i);
                        let obj = JSON.parse(item);
                        if (obj.locked) {
                            anyLocked = true;
                            break;
                        }
                    }
                });
                UI.btnItemRemove.controlClass.disabled = anyLocked;
            });
        } else
            UI.btnItemRemove.controlClass.disabled = false;
    }

    let checkAddBtn = function () {
        let dsAll = UI.gvAllColumnsList.controlClass.dataSource;
        let focused = dsAll.focusedItem;
        if (focused) {
            let obj = JSON.parse(focused);
            UI.btnItemAdd.controlClass.disabled = obj.locked;
        } else if (dsAll.itemsSelected) {
            let selItems = dsAll.getSelectedList();
            window.localPromise(selItems.whenLoaded()).then(function () {
                let anyLocked = false;
                selItems.locked(function () {
                    for (let i = 0; i < selItems.count; i++) {
                        let item = selItems.getValue(i);
                        let obj = JSON.parse(item);
                        if (obj.locked) {
                            anyLocked = true;
                            break;
                        }
                    }
                });
                UI.btnItemAdd.controlClass.disabled = anyLocked;
            });
        } else
            UI.btnItemAdd.controlClass.disabled = false;
    }

    if (!allowEmpty) {
        window.localListen(ds, 'change', function () {
            checkOK();
        });
    }

    if (lockedCols.length) {
        window.localListen(ds, 'focuschange', function () {
            checkRemoveBtn();
        });
        window.localListen(ds, 'change', function () {
            checkRemoveBtn();
        });
        window.localListen(dsAll, 'focuschange', function () {
            checkAddBtn();
        });
        window.localListen(dsAll, 'change', function () {
            checkAddBtn();
        });
    }
    
    window.localListen(UI.gvAllColumnsList, 'itemdblclick', function () {
        if(!UI.btnItemAdd.controlClass.disabled)
            UI.btnItemAdd.click();
    });
    window.localListen(UI.gvColumnsList, 'itemdblclick', function () {
        if(!UI.btnItemRemove.controlClass.disabled)
            UI.btnItemRemove.click();
    });

    window.localListen(UI.btnItemAdd, 'click', function () {
        if (UI.btnItemAdd.controlClass.disabled)
            return;
        UI.btnItemAdd.controlClass.disabled = true;
        let checkUnique = UI.gvColumnsList.controlClass.checkUnique;
        let ds = UI.gvColumnsList.controlClass.dataSource;
        let dsAll = UI.gvAllColumnsList.controlClass.dataSource;
        let selItems = dsAll.getSelectedList();
        window.localPromise(selItems.whenLoaded()).then(function () {
            if (!selItems || (selItems.count === 0)) {
                if ((selItems.count === 0) && (dsAll.focusedIndex >= 0)) {
                    selItems.add(dsAll.focusedItem);
                    dsAll.setSelected(dsAll.focusedIndex, true);
                } else
                    return;
            }
            selItems.forEach((itm) => {
                let col = JSON.parse(itm);
                if (checkUnique && (col.uniqueWith !== undefined)) { // this column is unique with any other column
                    // check item is already in the list ... if so, add this one and remove old
                    let idx = findItem(ds, col.uniqueWith);
                    if (idx >= 0) {
                        ds.locked(function () {
                            dsAll.add(ds.getValue(idx));
                        });
                        ds.delete(idx);
                    }
                }
                addColumnToMRU(col.columnType);
            });
            let targetIdx = ds.focusedIndex;
            if (targetIdx >= 0) {
                ds.locked(() => {
                    let item;
                    for (let i = targetIdx; i < ds.count; i++) {
                        item = ds.getFastObject(i, item);
                        let col = JSON.parse(item);
                        if (!col.locked) {
                            targetIdx = i;
                            break;
                        }
                    }
                });
            }

            if (targetIdx >= 0)
                ds.insertList(targetIdx, selItems);
            else
                ds.addList(selItems);

            dsAll.deleteSelected();
            checkAddBtn();
            checkRemoveBtn();
        });
    });

    window.localListen(UI.btnItemRemove, 'click', function () {
        if (UI.btnItemRemove.controlClass.disabled)
            return;
        UI.btnItemRemove.controlClass.disabled = true;
        let ds = UI.gvColumnsList.controlClass.dataSource;
        let dsAll = UI.gvAllColumnsList.controlClass.dataSource;
        let selItems = ds.getSelectedList();
        window.localPromise(selItems.whenLoaded()).then(function () {
            if (!selItems || (selItems.count === 0)) {
                if ((selItems.count === 0) && (ds.focusedIndex >= 0)) {
                    selItems.add(ds.focusedItem);
                    ds.setSelected(ds.focusedIndex, true);
                } else
                    return;
            }
            dsAll.beginUpdate();
            dsAll.addList(selItems);
            dsAll.endUpdate();
            selItems.forEach((itm) => {
                let col = JSON.parse(itm);
                addColumnToMRU(col.columnType);
            });
            ds.deleteSelected();
            checkAddBtn();
            checkRemoveBtn();
        });
    });

    window.localListen(UI.btnEditorOK, 'click', function () {
        if (ds.count > 0)
            modalResult = 1;
    });

    window.getColumnList = function () {
        let res = new Array();
        let hash = [];
        ds.locked(function () {
            forEach(fixedCols, function (col) {
                col.visible = true;
                hash.push(col.columnType);
                res.push(col);
            })
            for (let i = 0; i < ds.count; i++) {
                let value = ds.getValue(i);
                let col = JSON.parse(value);
                if (!hash.includes(col.columnType)) {
                    hash.push(col.columnType);
                    col.visible = true;
                    res.push(col);
                }
            }
        });
        dsAll.locked(function () {
            for (let i = 0; i < dsAll.count; i++) {
                let value = dsAll.getValue(i);
                let col = JSON.parse(value);
                if (!hash.includes(col.columnType)) {
                    hash.push(col.columnType);
                    col.visible = false;
                    res.push(col);
                }
            }
        });
        return JSON.stringify(res);
    };

    window.getMRUList = function () {
        return recentlyUsedColumns;
    };

    window.updateColumnList = function (newVisibleLst) {
        dsAll.beginUpdate();
        ds.beginUpdate();
        dsAll.addList(ds);
        ds.clear();
        let idx;
        forEach(fixedCols, function (col) {
            if (resolveToValue(col.title, '') !== '') {
                ds.add(JSON.stringify(col));
            }
        })
        newVisibleLst.forEach((columnType) => {
            idx = findItem(dsAll, columnType);
            if (idx >= 0) {
                dsAll.locked(function () {
                    ds.add(dsAll.getValue(idx));
                }.bind(this));
                dsAll.delete(idx);
            }
        });
        ds.endUpdate();
        dsAll.endUpdate();
    };
       
}
