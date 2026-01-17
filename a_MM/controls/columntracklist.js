/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

registerFileImport('controls/columntracklist');
'use strict';
/**
@module UI
*/
import TrackListView from './trackListView';
import './statusbar';
requirejs('controls/editors');
import '../actions';
let MAX_MRU_COLUMNS = 8;
let listDiv = null;
window.menus.chooseColumns = function (lv) {
    lv = lv || listDiv;
    if (!lv)
        return;
    let sortStr = undefined;
    if (lv.controlClass.getSortingStr)
        sortStr = lv.controlClass.getSortingStr();
    else if (lv.controlClass.autoSortSupported && !lv.controlClass.forceDisableCustomSort)
        sortStr = lv.controlClass.autoSortString;
    uitools.openDialog('dlgEditView', {
        modal: true,
        notShared: true,
        LV: lv,
        allColumns: lv.controlClass.columns,
        summaryColumns: lv.controlClass.summaryColumns,
        sorting: sortStr,
        title: resolveToValue(lv.controlClass.customChooseColumnsTitle, undefined),
        listLabel: resolveToValue(lv.controlClass.customChooseColumnsLabel, undefined),
        listLabelAll: resolveToValue(lv.controlClass.customChooseColumnsLabelAll, undefined),
        allowEmpty: false,
        collection: navUtils.getActiveCollection(),
        node: navUtils.getActiveNode(),
    }, function (dlg) {
        if (dlg.modalResult == 1) {
            let newList = dlg.getValue('getColumnList')();
            if (lv && lv.controlClass) {
                if (lv.controlClass.setColumns) {
                    let oldColumns = lv.controlClass.columns;
                    let obj = JSON.parse(newList);
                    let newCols = [];
                    obj.forEach(function (item) {
                        let it = lv.controlClass.fieldDefs[item.columnType];
                        if (it) {
                            it.visible = item.visible;
                            if (oldColumns) {
                                for (let i = 0; i < oldColumns.length; i++) {
                                    if (oldColumns[i].columnType === item.columnType) {
                                        it.width = resolveToValue(oldColumns[i].width, it.width);
                                        break;
                                    }
                                }
                            }
                            newCols.push(it);
                        }
                    });
                    let lvc = lv.controlClass;
                    lvc.setColumns(newCols);
                    if (lvc.addColumnToMRU) {
                        let mruList = dlg.getValue('getMRUList')();
                        if (mruList)
                            mruList.forEach((colT) => {
                                lvc.addColumnToMRU(colT);
                            });
                    }
                    if (lvc.autoSortSupported || lvc.canSaveNewOrder) {
                        lvc.autoSortString = dlg.getValue('getSorting')();
                        if (window.currentTabControl && !window.currentTabControl._saveOrderButton && uitools.saveButtonSupported(lvc.parentView)) {
                            lvc.showSaveCalled = true;
                            lvc.saveButtonHandle(lvc.autoSortString); // #19085
                        }
                    }
                }
                if (lv.controlClass.summaryColumns) {
                    lv.controlClass.summaryColumns = dlg.getValue('getSummaryColumns')();
                }
            }
        }
    });
};
let clickColumn = function () {
    if (!this.checked) {
        // column is visible ... hide if this is not last visible
        if (listDiv.controlClass.visibleColumns.length > 1)
            listDiv.controlClass.hideColumn(this.vIndex);
        else
            this.checked = true;
    }
    else {
        let idx = listDiv.controlClass.showColumn(this.index);
        if ((idx !== this.vIndex) && (!this.isGroupHeader)) {
            let minIdx = 0;
            for (let i = 0; i < listDiv.controlClass.visibleColumns.length; i++) {
                if (listDiv.controlClass.visibleColumns[i].isGroupHeader) {
                    minIdx = i + 1;
                }
                else
                    break; // we have group columns only at the beginning
            }
            if (idx < this.vIndex)
                listDiv.controlClass.moveColumn(idx, Math.max(this.vIndex + 1, minIdx));
            else
                listDiv.controlClass.moveColumn(idx, Math.max(this.vIndex, minIdx));
        }
    }
    // save as recently used
    if (this.columnType && listDiv.controlClass.addColumnToMRU) {
        listDiv.controlClass.addColumnToMRU(this.columnType);
    }
};
let presetColumn = function (c, idx, vIdx, isInRoot) {
    let colAction = {
        title: c.title,
        disabled: c.visible && (listDiv.controlClass.visibleColumns.length <= 1),
        index: idx,
        visible: function () {
            return !c.fixed && !resolveToValue(c.disabled, false, listDiv);
        },
        vIndex: vIdx,
        columnType: c.columnType,
        isInRoot: isInRoot,
        checked: false,
        checkable: false,
        isGroupHeader: c.isGroupHeader,
        execute: () => { },
        submenu: undefined,
    };
    if (c.visible) {
        colAction.checked = true;
        colAction.checkable = true;
    }
    else {
        colAction.checked = false;
        colAction.checkable = false;
    }
    colAction.execute = clickColumn.bind(colAction);
    return colAction;
};
let findListDiv = function (contextDiv) {
    // get parent listview
    let el2 = contextDiv;
    while (el2 && !listDiv) {
        if (el2.controlClass && el2.controlClass.dataSource)
            listDiv = el2;
        else
            el2 = el2.parentNode;
    }
};
/**
Creates Menu object for tracklist column selection.

@method createTracklistColumnsMenu
@for Menus
@param {Object} contextDiv Parent element for the menu.
@return {Menu} Created Menu object.
*/
window.menus.createTracklistColumnsMenu = window.menus.createTracklistColumnsMenu || function (contextDiv, evt) {
    listDiv = null;
    findListDiv(contextDiv);
    if (!listDiv)
        return;
    let col = undefined;
    let colTitle = '';
    let colFixed = false;
    let colType = undefined;
    if (evt && evt.srcElement) {
        let el = evt.srcElement;
        let t = '';
        while (el && (el != contextDiv)) {
            if (el.column !== undefined) {
                if ((el.column >= 0) && (el.column < listDiv.controlClass.visibleColumns.length)) {
                    col = el.column;
                    let colObj = listDiv.controlClass.visibleColumns[col];
                    colFixed = !!colObj.fixed;
                    if (el.contdiv)
                        t = el.contdiv.textContent.trim();
                    else
                        t = el.textContent.trim();
                    colTitle = ' "' + t + '"';
                    colType = colObj.columnType;
                }
                break;
            }
            el = el.parentNode;
        }
    }
    let presetColumns = [{
            action: {
                title: function () {
                    if (listDiv && listDiv.controlClass && resolveToValue(listDiv.controlClass.customChooseColumnsTitle, ''))
                        return resolveToValue(listDiv.controlClass.customChooseColumnsTitle, '');
                    return _('Column settings');
                },
                icon: 'options',
                disabled: false,
                checked: false,
                submenu: undefined,
                execute: window.menus.chooseColumns
            },
            order: 10,
            grouporder: 10
        }, {
            action: {
                title: _('Automatic column widths'),
                checked: function () {
                    return listDiv.controlClass.adaptColumnsWidth;
                },
                checkable: true,
                visible: !listDiv.controlClass.hideAdaptColumnsWidth,
                execute: function () {
                    listDiv.controlClass.adaptColumnsWidth = !listDiv.controlClass.adaptColumnsWidth;
                }
            },
            order: 20,
            grouporder: 10
        },
        /*{
               action: {
                   title: _('Reset Sorting'),
                   execute: function () {
                       listDiv.controlClass.autoSortString = listDiv.controlClass.getDefaultSortString();
                   }
               },
               order: 30,
               grouporder: 10
           },*/
        {
            action: {
                title: _('Hide column') + colTitle,
                disabled: ((col === undefined) || (listDiv.controlClass.visibleColumns.length <= 1)),
                checked: false,
                submenu: undefined,
                execute: function () {
                    listDiv.controlClass.hideColumn(col);
                    // save as recently used
                    if (colType && listDiv.controlClass.addColumnToMRU) {
                        listDiv.controlClass.addColumnToMRU(colType);
                    }
                },
                visible: !colFixed
            },
            order: 10,
            grouporder: 20
        }];
    // prepare sorting indexes for easier filling of "order" numbers
    let colSort = [];
    let tempCols = [];
    forEach(listDiv.controlClass.columns, function (col, idx) {
        tempCols.push(col);
        colSort.push({
            title: resolveToValue(col.title),
            index: idx
        });
    });
    // sort so e.g. "Custom 2" is before "Custom 10"
    let numberRegExp = /\d+(?:\.\d+)?/g;
    colSort.sort(function (i1, i2) {
        let s1 = i1.title.replace(numberRegExp, '');
        let s2 = i2.title.replace(numberRegExp, '');
        if (s1.localeCompare(s2) === 0) { // strings without numbers are the same
            let n1 = i1.title.match(numberRegExp);
            if (n1 && (n1.length === 1)) {
                let n2 = i2.title.match(numberRegExp);
                if (n2 && (n2.length === 1)) {
                    return Number(n1[0]) - Number(n2[0]);
                }
            }
        }
        return i1.title.localeCompare(i2.title);
    });
    forEach(colSort, function (cols, idx) {
        cols.order = idx;
    });
    colSort.sort(function (i1, i2) {
        return i1.index - i2.index;
    });
    // prepare helper object for faster access to column info and saving "used" flag
    let getVisibleIndex = function (columnType) {
        for (let i = 0; i < listDiv.controlClass.visibleColumns.length; i++) {
            if (listDiv.controlClass.visibleColumns[i].columnType == columnType) {
                return i;
            }
        }
        return listDiv.controlClass.visibleColumns.length;
    };
    let tmpColumns = {};
    forEach(tempCols, function (colO, idx) {
        tmpColumns[colO.columnType] = {
            col: colO,
            idx: idx,
            vIdx: colO.visible ? getVisibleIndex(colO.columnType) : col
        };
    });
    // prepare menu structure from fieldGroups    
    let ru = listDiv.controlClass.recentlyUsedColumns || [];
    let ruorder;
    let ruUsed = {};
    let getSubmenuItems = function (fields, isRoot) {
        let retval = isRoot ? presetColumns : []; // root items insert directly to presetColumns, so we will not need to move them here later
        let so = 1;
        let recentlyTitle = _('Recently used');
        let allFieldsTitle = _('All fields');
        forEach(fields, function (itm) {
            if (isString(itm)) {
                let colInfo = tmpColumns[itm];
                if (colInfo) {
                    retval.push({
                        action: presetColumn(colInfo.col, colInfo.idx, colInfo.vIdx, isRoot),
                        grouporder: isRoot ? 40 : 10,
                        grouptitle: isRoot ? allFieldsTitle : undefined,
                        order: colSort[colInfo.idx].order
                    });
                    colInfo.used = true;
                    ruorder = ru.indexOf(itm) + 1;
                    if ((ruorder > 0) && (!ruUsed[itm])) {
                        ruUsed[itm] = true;
                        presetColumns.push({
                            action: presetColumn(colInfo.col, colInfo.idx, colInfo.vIdx, false),
                            grouporder: 30,
                            grouptitle: recentlyTitle,
                            order: 10 * ruorder
                        });
                    }
                }
            }
            else if (isObjectLiteral(itm)) {
                // prepare possible submenu
                let submenu = getSubmenuItems(itm.fields);
                if (submenu.length > 0) {
                    retval.push({
                        action: {
                            title: itm.group,
                            submenu: submenu
                        },
                        order: colSort.length + 10 * so++,
                        grouporder: isRoot ? 40 : 20,
                        grouptitle: isRoot ? allFieldsTitle : undefined,
                    });
                }
            }
        });
        if (isRoot) {
            // add fields from Columns not mentioned in fieldGroups to Other
            let notUsedSubmenu = [];
            for (let colType in tmpColumns) {
                let colInfo = tmpColumns[colType];
                let c = colInfo.col;
                if (!colInfo.used && !c.fixed && !resolveToValue(c.disabled, false, listDiv)) { // not used and will be visible
                    notUsedSubmenu.push({
                        action: presetColumn(colInfo.col, colInfo.idx, colInfo.vIdx, false),
                        grouporder: 10,
                        order: colSort[colInfo.idx].order
                    });
                }
            }
            if (notUsedSubmenu.length > 0) {
                retval.push({
                    action: {
                        title: _('Other'),
                        submenu: notUsedSubmenu
                    },
                    order: colSort.length + 10 * so++,
                    grouporder: 40,
                    grouptitle: allFieldsTitle,
                });
            }
        }
        return retval;
    };
    getSubmenuItems(listDiv.controlClass.fieldGroups, true /* root */);
    return new Menu(presetColumns, {
        parent: contextDiv
    });
};
/**
UI Tracklist element - specialized control for showing a list of tracks with columns

@class ColumnTrackList
@constructor
@extends TrackListView
*/
export default class ColumnTrackList extends TrackListView {
    initialize(rootelem, params) {
        super.initialize(rootelem, params);
        let _this = this;
        this.statusParams = {};
        this.helpContext = 'Filelisting';
        this.isSortable = true;
        this.recentlyUsedColumns = [];
        this.defaultColumns = [];
        this.lassoSelectionEnabled = true;
        this.addArtworkRules = {
            showApply2Album: true
        };
        let useHeaderMenu = true;
        if (params) {
            useHeaderMenu = resolveToValue(params.useHeaderMenu, true);
        }
        if (useHeaderMenu) {
            this.header.controlClass.contextMenu = function (evt) {
                return menus.createTracklistColumnsMenu(this.headerItems, evt);
            }.bind(this);
        }
        this.localListen(this.container, 'contextmenu', (e) => {
            this.addArtworkRules.track = null;
            this.addArtworkRules.firstTrack = null;
            this.addArtworkRules.album = null;
            let group = null;
            let elem = e.target;
            while (elem) {
                if (elem._groupID !== undefined && this.dataSource) {
                    group = this.dataSource.getGroupByID(elem._groupID);
                    break;
                }
                elem = elem.parentElement;
            }
            if (group) {
                this.addArtworkRules.album = group.link.get();
            }
        }, true);
    }
    addColumnToMRU(columnType) {
        if (columnType && (this.recentlyUsedColumns !== undefined)) {
            let ru = this.recentlyUsedColumns;
            let idx = ru.indexOf(columnType);
            if (idx >= 0) {
                ru.splice(idx, 1);
            }
            ru.unshift(columnType);
            if (ru.length > MAX_MRU_COLUMNS)
                ru.pop();
        }
    }
    _userInteractionDone() {
        if (this._updatesSuspended) {
            if (this._interactionTimeout)
                clearTimeout(this._interactionTimeout);
            this._interactionTimeout = null;
            this.dataSource.resumeAutoUpdates();
            this._updatesSuspended = false;
        }
    }
    afterUserInteraction() {
        if (this.dataSource && this.dataSource.suspendAutoUpdates &&
            this._userInteractivePriority && !this.dataSource.autoUpdateDisabled) {
            if (!this._updatesSuspended) { // not suspended
                this.dataSource.suspendAutoUpdates();
                this._updatesSuspended = true;
            }
            if (this._interactionTimeout)
                clearTimeout(this._interactionTimeout);
            this._interactionTimeout = this.requestTimeout(function () {
                this._interactionTimeout = null;
                this._userInteractionDone();
            }.bind(this), 5000, '_interactionTimeout');
        }
    }
    cleanUp() {
        super.cleanUp();
        this._userInteractionDone();
        if (this._eventsRegistered) {
            this._eventsRegistered = undefined;
            if (this._collection) {
                app.unlisten(this._collection, 'change');
            }
        }
    }
    storePersistentState(state) {
        if (!this.disableStateStoring) {
            state.allColumns = this.storeColumns();
            if (this.autoSortSupported && !this.sortStoringDisabled && uitools.storeColumnsSupported(this.parentView))
                state.sortString = this.sortString;
            state.recentlyUsedColumns = this.recentlyUsedColumns;
            state.adaptColumnsWidth = this.adaptColumnsWidth;
        }
        return state;
    }
    restorePersistentState(state) {
        if (this.disableStateStoring)
            state = {};
        this.adaptColumnsWidth = !!state.adaptColumnsWidth;
        if (state.recentlyUsedColumns)
            this.recentlyUsedColumns = state.recentlyUsedColumns;
        if (!state.allColumns || (state.allColumns.length === 0)) {
            let defState = this.getDefaultPersistentState();
            state.allColumns = defState.allColumns;
        }
        else {
            let playOrderPresent = false;
            forEach(state.allColumns, (col, idx) => {
                // listOrder/playOrder unified in  #19569
                if (col.columnType == 'playOrder') {
                    if (playOrderPresent)
                        state.allColumns.splice(idx, 1);
                    else
                        playOrderPresent = true;
                }
                if (col.columnType == 'listOrder') {
                    if (!playOrderPresent) {
                        col.columnType = 'playOrder';
                        playOrderPresent = true;
                    }
                    else
                        state.allColumns.splice(idx, 1);
                }
            });
        }
        if (state.allColumns && (state.allColumns.length > 0))
            this.restoreColumns(state.allColumns);
        if (this.autoSortSupported && !this.sortStoringDisabled) {
            if (uitools.storeColumnsSupported(this.parentView)) {
                if (state.sortString)
                    this.setSortColumns(state.sortString);
            }
            else {
                // following is here to resolve #17102
                let sortString = window.uitools.getDefaultColumnSort(this.parentView);
                if (sortString) {
                    this.getDefaultSortString = function () {
                        return sortString;
                    };
                    this.setSortColumns(sortString);
                }
            }
        }
        this.setViewportSize(this.getViewportSize(), 0); // LS: to reset the vertical scroll (when this control was in controlCache and used for new dataSource)
    }
    presetColumns(columns) {
        this.getDefaultColumns = function () {
            return columns;
        };
        this.restorePersistentState({});
    }
    getCollectionColumns(col) {
        if (col) {
            let coltype = col.getType();
            if (coltype == 'music')
                return ['title', 'artist', 'albumArtist', 'album', 'date', 'genre', 'rating', 'length', 'source', 'path', 'filename'];
            else if (coltype == 'classicalmusic')
                return ['title', 'artist', 'composer', 'album', 'date', 'genre', 'rating', 'length', 'source', 'path', 'filename'];
            else if (coltype == 'podcast' || coltype == 'videopodcast')
                return ['title', 'podcast', 'artist', 'date', 'genre', 'rating', 'length', 'source', 'path', 'filename', 'playCounter'];
            else if (coltype == 'audiobook')
                return ['title', 'artist', 'album', 'order', 'date', 'genre', 'rating', 'length', 'playCounter'];
            else if (coltype == 'musicvideo')
                return ['title', 'artist', 'albumArtist', 'album', 'date', 'genre', 'rating', 'length', 'source', 'path', 'filename'];
            else if (coltype == 'video')
                return ['title', 'director', 'series', 'date', 'genre', 'rating', 'length', 'source', 'path', 'filename', 'playCounter'];
            else if (coltype == 'tv')
                return ['title', 'series', 'season', 'episode', 'date', 'genre', 'rating', 'length', 'source', 'path', 'filename', 'playCounter'];
        }
        return null;
    }
    getDefaultColumns() {
        // following default columns are per proposal in the spreadheet document linked in Mantis #14935 / note 51197
        let defCols = ['title', 'artist', 'album', 'date', 'genre', 'rating', 'length', 'source', 'path', 'filename'];
        if (this.parentView) {
            let col = nodeUtils.getNodeCollection(this.parentView.viewNode);
            let handler = getNodeHandler(this.parentView);
            if (handler.getDefaultColumns) {
                defCols = handler.getDefaultColumns(col);
            }
            if (handler.orderColumnSupport && !defCols.includes('playOrder'))
                defCols.splice(0, 0, 'playOrder');
            if (!handler.getDefaultColumns) { // we have default columns from node handler, do not overwrite them by collection columns
                let ret = this.getCollectionColumns(col);
                if (ret)
                    defCols = ret;
            }
        }
        else if (this._collection) {
            let ret = this.getCollectionColumns(this._collection);
            if (ret)
                defCols = ret;
        }
        if (this.orderColumnSupport && !defCols.includes('playOrder'))
            defCols.splice(0, 0, 'playOrder');
        return defCols;
    }
    getDefaultPersistentState() {
        let defColumns = [];
        let defCols = this.getDefaultColumns();
        let _addCol = (col, visible) => {
            defColumns.push({
                visible: visible,
                title: col.title,
                width: col.width,
                minWidth: col.minWidth,
                align: col.align,
                bindData: col.bindData,
                getValue: col.getValue,
                setValue: col.setValue,
                sortFunc: col.sortFunc,
                editor: col.editor,
                editorParams: col.editorParams,
                columnType: col.columnType,
                shortcutFunc: col.shortcutFunc,
                direction: col.direction || 'ASC',
                adaptableSize: resolveToValue(col.adaptableSize, true),
            });
        };
        // add the default columns in correct order at first
        for (let columnType of defCols) {
            let col = this.fieldDefs[columnType];
            if (col)
                _addCol(col, true);
        }
        // add all remaining columns as invisible then:
        for (let columnType in this.fieldDefs) {
            let col = this.fieldDefs[columnType];
            if (defCols.indexOf(col.columnType) < 0)
                _addCol(col, !!col.isGroupHeader);
        }
        return {
            allColumns: this.storeColumns(defColumns)
        };
    }
}
registerClass(ColumnTrackList);
