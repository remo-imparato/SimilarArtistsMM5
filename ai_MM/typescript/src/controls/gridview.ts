'use strict';

/**
@module UI
*/
registerFileImport('controls/gridview');

import ListView from './listview';
import Checkbox from './checkbox';
import Rating from './rating';
import './editors';
import '../templates';
import { getPixelSize } from './control';
import { DRAG_HEADERITEM } from '../consts';


// function that adds specialized CSS rules for grid selection icons positioning
let setGridViewSelectionRules = function (uid, rightPx) {
    if (rightPx === undefined)
        rightPx = 0;
    let styleTag = document.getElementById('gridStyle');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'gridStyle';
        let head = document.getElementsByTagName('head')[0];
        head.appendChild(styleTag);
    }
    let uidFilter = '.listview[data-uniqueid="' + uid + '"]';
    let cssRules = styleTag.sheet.cssRules;
    if (cssRules.length > 0) {
        for (let i = cssRules.length - 1; i >= 0; i--) {
            if (cssRules[i].selectorText.indexOf(uidFilter) >= 0) {
                styleTag.sheet.deleteRule(i);
            }
        }
    }

    let rules: string[] = [];
    rules.push(uidFilter + ' .selectButtonBg  { right: ' + rightPx + 'px; }');

    for (let i = 0; i < rules.length; i++) {
        styleTag.sheet.insertRule(rules[i], styleTag.sheet.cssRules.length);
    }
};

let updateFirstColFlag = function (div, vis) {
    if (vis) {
        div.setAttribute('data-first-col', '1');
    } else {
        div.removeAttribute('data-first-col');
    }
};

declare global {
    interface HTMLElement {
        /** @event */
        event_checkedchanged: (e: CustomEvent<{ div: HTMLElement, checked: boolean }|null>) => void;
    }
}

/**
UI GridView element

@class GridView
@constructor
@extends ListView
*/

export default class GridView extends ListView {
    columns: any[];
    visibleColumns: any[];
    isSortable: boolean;
    isColMovable: boolean;
    isColResizable: boolean;
    singleClickEdit: boolean;
    showEllipsisTooltip: boolean;
    columnMinWidth: any;
    private _focusedColumnIndex: number;
    visColIndexFirst: number;
    itemCloningAllowed: boolean;
    highlightSupported: boolean;
    organizedPathColumnSupported: boolean;
    isCheckboxInHeader: boolean;
    private _rightAlignMargin: undefined;
    alwaysShowTooltips: boolean;
    headerCheckTipChecked: string;
    headerCheckTipUnchanged: string;
    headerCheckTipIndeterminate: string;
    listCheckTipChecked: string;
    listCheckTipUnchanged: string;
    listCheckTipIndeterminate: string;
    editSupported: boolean;
    private _lastShortcutDivs: any[];
    visColIndexLast: number;
    topCheckboxPromise: any;
    hideOdd: any;
    updateTopCheckbox: () => void;
    focusChanged: (newIdx: any, oldIdx: any) => void;
    loadShortcutIcon: (colDiv: any) => void;
    private _focusChangedEvt: (...params: any[]) => void;
    private _layoutChanged: undefined;
    private _requiredWidth: undefined;
    private _showShortcuts: any;
    private _ratioSet: boolean;
    sortColumns: any[];
    private _tmStartEdit: number;
    lastMouseDiv: any;
    _fieldDefs: any;
    private _lastSelIconRightPos: number;
    disabledSelectionIconsPositionHandling: boolean;
    lastCheckedScrollLeft: number;
    private _adaptColumnsWidth: boolean;
    private _autoUpdateWasDisabled: boolean;
    private _movingEditorToColumn: boolean;
    showSaveCalled: boolean;
    private _resizingColumn: CustomElement;
    private _layoutChangeLock: any;
    cellSetups: any;
    private _currentView: any;
    private _currentHandler: any;
    private _canDrop: any;
    headerRenderers: { renderDefault: (div: any, column: any) => void; renderCheck: (div: any, column: any) => void; };
    defaultBinds: { bindCheckboxCell: (div: any, item: any, index: any) => void; bindCheckboxCell_HideOdd: (div: any, item: any, index: any) => void; };
    sortStoringDisabled: boolean;
    minimalDefaultHeaderWidth: number;

    initialize(rootelem: HTMLDivElement, params: AnyDict) {
        this.columns = [];
        this.visibleColumns = [];
        this.isSortable = false;
        this.isColMovable = true;
        this.isColResizable = true;
        this.singleClickEdit = false;
        this.showEllipsisTooltip = true; // by default show tooltips for not fitting columns
        if (params) {
            if (params.columnMinWidth)
                this.columnMinWidth = params.columnMinWidth; // prepare in advance, so it is already used during preparing header
        }
        super.initialize(rootelem, params);
        this._focusedColumnIndex = -1;
        this.visColIndexFirst = -1;
        this.visColIndexLast = -1;
        this.itemCloningAllowed = false; // not supported yet
        this.highlightSupported = false;
        this.organizedPathColumnSupported = false;

        this.isCheckboxInHeader = false;
        this._rightAlignMargin = undefined;
        if (this.adaptColumnsWidth === undefined) // not assigned by parameter in HTML yet
            this.adaptColumnsWidth = true;
        this.alwaysShowTooltips = false;

        this.headerCheckTipChecked = '';
        this.headerCheckTipUnchanged = '';
        this.headerCheckTipIndeterminate = '';

        this.listCheckTipChecked = '';
        this.listCheckTipUnchanged = '';
        this.listCheckTipIndeterminate = '';
        this.editSupported = true;

        this.minimalDefaultHeaderWidth = 16;

        this.updateTopCheckbox = () => {
            // update checked/unchecked/mixed state of column's checkbox
            if (this.isCheckboxInHeader) {
                let chb = qe(this.headerItems, '[data-id=selectAll]');
                if (chb && chb.controlClass) {
                    if (this.dataSource) {
                        if (this.topCheckboxPromise) {
                            cancelPromise(this.topCheckboxPromise);
                        }
                        let param: string | undefined = undefined;
                        if (this.hideOdd)
                            param = 'hideOdd';
                        this.topCheckboxPromise = this.dataSource.isMixedStateAsync(param).then((info) => {
                            if (chb && chb.controlClass) {
                                // update top checkbox
                                chb.controlClass.checked = info.frstState || info.isMixed;
                                chb.controlClass.indeterminate = info.isMixed;
                                chb.setAttribute('data-tip', info.isMixed ? this.headerCheckTipIndeterminate : info.frstState ? this.headerCheckTipChecked : this.headerCheckTipUnchanged);
                            }
                            this.topCheckboxPromise = undefined;
                        });
                        this.localPromise(this.topCheckboxPromise);
                    }
                }
            }
        };

        this._lastShortcutDivs = [];
        let _this = this;

        let cleanUpOldShortcuts = () => {
            this._lastShortcutDivs.forEach(function (div) {
                if (div.shortcut && div.shortcut.parentElement) {
                    setVisibility(div.shortcut, false);
                    div.content.classList.remove('vSeparator');
                }
            });
            this._lastShortcutDivs = [];
        };

        this.setShortcutsOnItemIndex = (newIdx) => {
            cleanUpOldShortcuts();
            if (this._showShortcuts) {
                let div = this.getDiv(newIdx);
                if (div) {
                    let allDivs = this.getAllColumnDivs(div);
                    if (allDivs) {
                        for (let index = 0; index < allDivs.length; index++) {
                            let colDiv = allDivs[index] as CustomElement;
                            if (colDiv.column && colDiv.column.shortcutFunc && colDiv.shortcut && colDiv.shortcut.parentElement) {
                                if (colDiv.shortcut && !colDiv.shortcut.prepared) {
                                    this.loadShortcutIcon(colDiv);
                                }
                                _this._lastShortcutDivs.push(colDiv);
                                setVisibility(colDiv.shortcut, true);
                                colDiv.content.classList.add('vSeparator');
                            }
                        }
                    }
                }
            }
        };

        this.loadShortcutIcon = function (colDiv) {
            colDiv.shortcut.prepared = true;
            loadIconFast('link', function (icon) {
                setIconFast(colDiv.shortcut, icon);
            });
            _this.localListen(colDiv.shortcut, 'click', function () { });
        };

        this.focusChanged = (newIdx, oldIdx) => {
            this.setShortcutsOnItemIndex(newIdx);
        };

        app.listen(rootelem, 'datasourcechanged', (e) => {
            if (e.detail.oldDataSource) {
                if (this._focusChangedEvt)
                    app.unlisten(e.detail.oldDataSource, 'focuschange', this._focusChangedEvt);
                cleanUpOldShortcuts();
            }
            if (!e.detail.newDataSource) {
                uitools.cleanUpSaveButton();
            } else {
                this._focusChangedEvt = app.listen(e.detail.newDataSource, 'focuschange', this.focusChanged);
                this.forceReRender(); // #17873: When data source is changed, tracklist links are not visible until focus changes
            }

            if (this.isCheckboxInHeader) {
                this.updateTopCheckbox();
            }
            this._refreshSortIndicators();
        });
        app.listen(rootelem, 'checkedchanged', () => {
            if (this.isCheckboxInHeader) {
                this.requestFrame(this.updateTopCheckbox, 'updateTopCheckbox');
            }
        });

        if (this.fieldDefs)
            this._prepareSortColumns(this.getDefaultSortString());

        let findColDiv = function (cdiv, offsetX): HTMLElement {
            if (cdiv.nodeName === 'INPUT') return; // user clicked on checkbox ... do NOT start editing
            if (cdiv.classList.contains('lvItem')) {
                // clicked outside column div in padding, #15720
                // find coldiv based on offsetX
                if (!cdiv.children)
                    return;
                let child;
                let retdiv = undefined;
                for (let i = 0; i < cdiv.children.length; i++) {
                    child = cdiv.children[i];
                    if (child.column && (offsetX >= child.offsetLeft) && (offsetX <= (child.offsetLeft + child.offsetWidth))) {
                        retdiv = child;
                        break;
                    }
                }
                cdiv = retdiv;
            } else {
                while (cdiv && !cdiv.column) {
                    cdiv = cdiv.parentElement;
                }
            }
            return cdiv;
        };

        this.localListen(this.viewport, 'mousedown', (e) => {
            if (e.button == 3 || e.button == 4)
                return; // let the back/forward buttons bubble (#16406)

            let coldiv = findColDiv(e.target, e.offsetX); // @ts-ignore
            if (coldiv && ([0 /* left */, 2 /* right */].includes(e.button)) && !e.ctrlKey && !e.shiftKey) { // left or right button #17690
                if (this.focusedColumn != coldiv.column) {
                    this.editSave(false, false);
                    this.focusedColumn = coldiv.column;
                }
            }
        }, true);

        this.localListen(this.viewport, 'mouseup', (e) => {
            if (e.button == 3 || e.button == 4)
                return; // let the back/forward buttons bubble (#16406)

            let coldiv = findColDiv(e.target, e.offsetX);
            if (coldiv && (e.button == 0) && !e.ctrlKey && !e.shiftKey && !this.inEdit) { // left button
                let tm = Date.now() - coldiv.lastMouseUp;
                clearTimeout(this._tmStartEdit);
                if (this.singleClickEdit || ((this.focusedColumn === coldiv.column) && (this.lastMouseDiv === coldiv) &&
                    (coldiv.lastMouseUp &&
                        ((tm > 500) && (tm < 3000))))) { // second mouse click after more than 0.5sec, but less than 3 seconds start editing
                    this._tmStartEdit = this.requestTimeout(() => {
                        // use little timeout as we need to change focusedIndex before editStart when singleClickEdit 
                        // also the timeout is needed to be sure that there isn't third click coming (which would mean double-click) -- see #15656 
                        if (this.focusedColumn == coldiv.column && (this.lastMouseDiv === coldiv)) { // nothing's changed ... start editing
                            if (this.singleClickEdit && this.focusedIndex < 0) // #16039
                                this.setfocusedIndexAndDeselectOld(coldiv.parentElement.itemIndex);

                            if (window.uitools.getCanEdit())
                                this.editStart(true);
                        }
                    }, 500, 'tmStartEdit');
                }
                coldiv.lastMouseUp = Date.now();
                this.lastMouseDiv = coldiv;
            }
        });

    }
    setShortcutsOnItemIndex(newIdx: any) {
        throw new Error('Method not implemented.');
    }

    canUseLasso(e: NotifyEvent) {
        if (e.target.classList.contains('lvColumnItem')) {
            // lasso is enabled only in 'non-content' part of the list (out of text)
            let content = e.target.innerText;
            if (content) {
                let w = getTextWidth(content, e.target);
                return e.offsetX > w;
            }
            return true;
        }
        return true;
    }

    saveButtonHandle(newSortString: string) {
        if (!this.showSaveCalled || ((newSortString !== 'playOrder ASC') && (newSortString !== 'playOrder') && newSortString !=='')) {
            this.showSaveCalled = true;
            uitools.showSaveButtonAsync(this.parentView, this.dataSource).then(function (btn) {
                /*                if (window.currentTabControl._saveOrderButton) {
                    this.localListen(window.currentTabControl._saveOrderButton, 'click', function () {
                        window.currentTabControl._saveOrderButton = undefined;
                    }.bind(this));
                }*/
                this.showSaveCalled = undefined;
            }.bind(this), function () {
                this.showSaveCalled = undefined;
            }.bind(this));
        } else {
            uitools.cleanUpSaveButton(null);
        }
    }

    clearDivs() {
        this._lastShortcutDivs = [];
        this._ratioSet = false;
        super.clearDivs();
    }

    _prepareSortColumns(sortStr: string) {
        assert(!!this.fieldDefs, 'GridView fieldDefs must be specified to enable sorting!');
        this.sortColumns = [];
        let list = sortStr.split(';');
        list.forEach(function (item) {
            let columnName = '';
            let columnDirection = 'ASC';
            let columnInfo = item.split(' ');
            if (columnInfo.length > 1)
                columnDirection = columnInfo[1];
            columnName = columnInfo[0];
            let column = this.fieldDefs[columnName];
            if (column) {
                let sortobj = {
                    columnType: column.columnType,
                    title: resolveToValue(column.title, ''),
                    direction: columnDirection
                };
                this.sortColumns.push(sortobj);
            }
        }.bind(this));
    }

    setSortColumns(sortString: string) {
        this._prepareSortColumns(sortString);
        this.reSort();
        this._refreshSortIndicators();
    }

    _refreshSortIndicators() {

        let isSame = function (col, columnType) {
            let ret = col.columnType === columnType;
            if (!ret && col.alias && isArray(col.alias)) {
                for (let i = 0; i < col.alias.length; i++) {
                    if (col.alias[i] === columnType) {
                        return true;
                    }
                }
            }
            return ret;
        };
    
        let sortobj, obj;
        if (!this.sortColumns)
            return;
        for (let i = 0; i < this.visibleColumns.length; i++) {
            obj = this.visibleColumns[i];
            if (!obj.headerDiv)
                return;
            sortobj = undefined;

            obj.headerDiv.removeAttribute('data-sortAsc');
            obj.headerDiv.removeAttribute('data-sortDesc');
            obj.headerDiv.removeAttribute('data-sort-label');
            obj.headerDiv.removeAttribute('data-tip');
            obj.headerDiv.sortdivNumber.innerText = '';

            let tip = this.createSortingTip();

            for (let j = 0; j < this.sortColumns.length; j++) {
                sortobj = this.sortColumns[j];
                if (sortobj && isSame(obj, this.sortColumns[j].columnType)) {
                    if (sortobj.direction === 'ASC') {
                        obj.headerDiv.removeAttribute('data-sortDesc');
                        obj.headerDiv.setAttribute('data-sortAsc', '1');
                    } else {
                        obj.headerDiv.removeAttribute('data-sortAsc');
                        obj.headerDiv.setAttribute('data-sortDesc', '1');
                    }
                    if (this.sortColumns.length > 1 && j) {
                        obj.headerDiv.setAttribute('data-sort-label', '1');
                        obj.headerDiv.sortdivNumber.innerText = j + 1;
                    } else {
                        obj.headerDiv.removeAttribute('data-sort-label');
                        obj.headerDiv.sortdivNumber.innerText = '';
                    }
                }
            }
            obj.headerDiv.setAttribute('data-tip', tip);
        }
    }

    notifyColumnsChange(columnClass?, visible?) {
        this.raiseEvent('columnschange', {
            columnClass: columnClass,
            visible: visible
        }, true, false);
    }

    /**
    Set new list of columns to be shown

    @method setColums
    @param {Array} Columns A list of columns
    */
    setColumns(newColumns) {
        this.columns = newColumns;
        this.visibleColumns = [];
        for (let i = 0; i < newColumns.length; i++) {
            if (newColumns[i].visible === undefined)
                newColumns[i].visible = true;
            if (newColumns[i].visible) {    
                let col = new Column(this, newColumns[i]);
                col.index = i;
                if (newColumns[i].isGroupHeader)
                    this.visibleColumns.splice(this.normalizeColumnOrder(i), 0, col);
                else
                    this.visibleColumns.push(col);
            }
        }
        if (this.visibleColumns.length === 0) {
            // empty grid, force visibility of the first column to avoid problems with empty grid
            // creating grids without columns fixed as #16897 and should not occur in the future
            if (newColumns.length > 0) {
                newColumns[0].visible = true;   
                let col = new Column(this, newColumns[0]);
                col.index = 0;
                this.visibleColumns.push(col);
            }
        }

        if (this.headerItems) {
            this.setUpHeader(this.headerItems);
            this._refreshSortIndicators();
        }

        this.clearDivs();
        this.visColumnsUpdate(true);
        this.notifyColumnsChange();

        this.updateRequiredWidth();
        this.invalidateAll();
    }

    /**
    Gets list of columns as are actualy shown (configured by user)

    @method storeColumns
    @param {Array} [defColumns] List of columns to store. Default is this.columns array
    @return {Array} Columns List of columns
    */
    storeColumns(defColumns?) {
        let res = [];
        defColumns = defColumns || this.columns;
        for (let i = 0; i < defColumns.length; i++) {
            let col = defColumns[i];
            let storedCol: AnyDict = {};
            storedCol.width = pxToEm(col.width);
            storedCol.visible = col.visible;
            storedCol.columnType = col.columnType;
            if (resolveToValue(col.disabled, false, this.container)) {
                storedCol.visible = !!col.wasVisible;
            }
            res.push(storedCol);
        }
        return res;
    }

    get fieldDefs() {
        return this._fieldDefs; // overriden in descendants like trackListView
    }
    set fieldDefs(value) {
        this._fieldDefs = value; // overriden in descendants like trackListView
    }

    /**
    Sets list of columns as were shown (configured by user)

    @method restoreColumns
    @param {Array} Columns List of columns to restore
    @param {Boolean} ignoreNewColumns Ignore new columns and add just these defined in columns variable
    */
    restoreColumns(columns, ignoreNewColumns?: boolean) {
        let myColumns = [];
        let usedColumnTypes = {};

        let handleDisabledColumn = (defCol, newCol) => {
            if (resolveToValue(defCol.disabled, false, this.container)) {
                newCol.wasVisible = newCol.visible; // store last visibility state so we can set it correctly in storeColumns
                newCol.visible = false; // this column is disabled in current view ... make it hidden
            }
            return newCol;
        };

        let copyDefToColumn = function (newCol, defCol) {
            for (let key in defCol)
                if (key != 'width' && key != 'adaptableSize' && key != 'visible')
                    newCol[key] = defCol[key];

            if (!newCol.width || (newCol.width > 4000 /* LS: this was case in the ticket #3139 for some reason, probably a survival from already fixed bug? */))
                newCol.width = defCol.width;
            else
                newCol.width = emToPx(newCol.width);

            newCol.adaptableSize = resolveToValue(defCol.adaptableSize, true);
            newCol.visible = (newCol.visible !== undefined) ? newCol.visible : false;
        };

        for (let i = 0; i < columns.length; i++) {
            let newCol = copyObject(columns[i]); // LS: need to use copyObject otherwise it would overwrite width in the stored state (see emToPx below)
            let defCol = this.fieldDefs[newCol.columnType];
            if (defCol) {
                usedColumnTypes[newCol.columnType] = true;
                copyDefToColumn(newCol, defCol);
                myColumns.push(handleDisabledColumn(defCol, newCol));
            }
        }
        if (!ignoreNewColumns) {
            // add columns not saved to persistent (e.g. newly defined, #14298)
            for (let colType in this.fieldDefs) {
                if (!usedColumnTypes[colType]) {
                    let defCol = this.fieldDefs[colType];
                    let newCol: any = {
                        columnType: colType
                    };
                    copyDefToColumn(newCol, defCol);
                    myColumns.push(handleDisabledColumn(defCol, newCol));
                }
            }
        }
        this.setColumns(myColumns);
    }

    normalizeColumnOrder(columnIdx) {
        let idx = 0;
        let col = this.columns[columnIdx];
        if (col.isGroupHeader) {
            // place groupe header at correct place at the beginning
            if (col.groupIndex > 0) {
                for (let j = 0; j < this.columns.length; j++) {
                    if (j != columnIdx) {
                        if (this.columns[j].isGroupHeader && (this.columns[j].groupIndex < col.groupIndex) && this.columns[j].visible) {
                            idx++;
                        }
                    }
                }
            }
        } else
            while ((idx < this.visibleColumns.length) && ((this.visibleColumns[idx].index < columnIdx) || (this.visibleColumns[idx].isGroupHeader)))
                idx++;
        return idx;
    }

    /**
    Make column visible

    @method showColumn
    @param {Object} columnIdx A column index to be visible
    @return {integer} Index of newly added column in visibleColumns array    
    */
    showColumn(columnIdx) {
        let newColumn = this.columns[columnIdx];
        if (!newColumn || newColumn.visible)
            return;
        newColumn.visible = true; 
        let col = new Column(this, newColumn);
        col.index = columnIdx;

        // find the right place, where to insert visible column
        let idx = this.normalizeColumnOrder(columnIdx);
        this.visibleColumns.splice(idx, 0, col);
        this.clearDivs();
        this.visColumnsUpdate(true);
        if (this.headerItems) {
            this.setUpHeader(this.headerItems);
            this._refreshSortIndicators();
        }
        this.notifyColumnsChange(col, true);
        this.updateRequiredWidth();

        // workaround for probably Chromium bug, without this, items are wrongly rendered (content is not scrolled to the left)
        this.forceReRender();
        return idx;
    }

    /**
    Hides column

    @method hideColumn
    @param {integer} columnVIdx A column index to be removed. Order in visibleColumns array.
    */
    hideColumn(columnVIdx) {
        let obj = this.visibleColumns[columnVIdx];
        if (!obj) {
            ODS('hideColumn: visible column ' + columnVIdx + ' does not exist');
            return;
        }
        this.columns[obj.index].visible = false;
        if (this.headerItems) {
            if (obj.headerDiv)
                removeElement(obj.headerDiv);
        }

        this.visibleColumns.splice(columnVIdx, 1);
        this.clearDivs();
        this.visColumnsUpdate(true);
        this.notifyColumnsChange(obj, false);
        this.updateRequiredWidth();

        // workaround for probably Chromium bug, without this, items are wrongly rendered (content is not scrolled to the left)    
        this.forceReRender();
    }

    /**
    Shows/Hides column based on type

    @method setColumnVisibility
    @param {string} columnType A column type to be shown/hidden.
    @param {boolean} value show/hide.
    */
    setColumnVisibility(columnType: string, value: boolean) {
        for (let i = 0; i < this.columns.length; i++) {
            if (this.columns[i].columnType == columnType) {
                if (value && !this.columns[i].visible)
                    this.showColumn(i);
                else if (!value && this.columns[i].visible) {
                    // locate column in visibleColumns array
                    for (let j = 0; j < this.visibleColumns.length; j++) {
                        if (this.visibleColumns[j].index == i) {
                            this.hideColumn(j);
                            break;
                        }
                    }
                }
                break;
            }
        }
    }

    /**
    Change order of the column. Indexes are order in visibleColumns array.

    @method moveColumn
    @param {Object} oldVIdx Original index of the column to be moved
    @param {integer} newVIdx New index of the column
    */
    moveColumn(oldVIdx, newVIdx) {
        if (oldVIdx === newVIdx)
            return;

        // first move column to the new place in both arrays
        let toLast = false;
        if (newVIdx >= this.visibleColumns.length) {
            newVIdx = this.visibleColumns.length - 1;
            toLast = true;
        }

        if (!this.visibleColumns[oldVIdx] || !this.visibleColumns[newVIdx]) 
            return;
        
        let oldIdx = this.visibleColumns[oldVIdx].index;
        let newIdx = this.visibleColumns[newVIdx].index;
        if (toLast)
            newIdx++;
        let movedCol = this.columns[oldIdx];
        this.columns.splice(oldIdx, 1);
        if (newVIdx > oldVIdx) { // moving right, we deleted old item in the left, so decrease indexes
            if (!toLast) // moving last, we already decreased sooner
                newVIdx--;
            newIdx--;
        }
        this.columns.splice(newIdx, 0, movedCol);
        movedCol = this.visibleColumns[oldVIdx];
        this.visibleColumns.splice(oldVIdx, 1);
        this.visibleColumns.splice(newVIdx, 0, movedCol);

        // now we have right order in arrays, but wrong index values and header order, fix
        let vIdx = 0;
        let firstSet = false;
        for (let i = 0; i < this.columns.length; i++) {
            if ((this.columns[i].visible) && (!resolveToValue(this.columns[i].disabled, false, this.container))) {
                this.visibleColumns[vIdx].index = i;
                if (this.visibleColumns[vIdx].headerDiv) {
                    this.visibleColumns[vIdx].headerDiv.style.order = vIdx;
                    updateFirstColFlag(this.visibleColumns[vIdx].headerDiv, !firstSet);
                    firstSet = true;
                }
                vIdx++;
            }
        }
        this.clearDivs();
        this.visColumnsUpdate(true);
        this.notifyColumnsChange();

        // workaround for probably Chromium bug, without this, items are wrongly rendered (content is not scrolled to the left)    
        this.forceReRender();
    }

    updateRequiredWidthAsync() {
        if (this._resizingColumn) {
            this.updateRequiredWidth(); // have to be sync during column resizing
        } else {
            this.requestTimeout(function () {
                this.updateRequiredWidth();
            }.bind(this), 250, 'updateRequiredWidth');
        }
    }

    updateRequiredWidth() {
        if (this.headerFill) {
            this._requiredWidth = undefined; // To be calculated later
            this.updateSelectionIconsPosition();
        }
        if (this._layoutChanged && this.groupDivs && this.groupDivs.length) // layout was changed .. we need to recompute groups heights
            this.itemHeightReset = true;
        this._layoutChanged = undefined;
        this.adjustSize(false);
        this.visColumnsUpdate(false);
    }

    requiredWidth(visibleWidth?: number) {
        if (this._requiredWidth === undefined)
            this._requiredWidth = this.headerFill.offsetLeft;
        let retval = this._requiredWidth || 0;
        // expand width of the row if needed, so the row is not ended before visible rectangle end
        if (visibleWidth && (visibleWidth > retval))
            retval = visibleWidth;
        return retval;
    }

    adjustSize(adjustItems: boolean) {
        super.adjustSize(adjustItems);
        if (this._adaptColumnsWidth)
            this._updateColumnsWidth();
    }

    handle_layoutchange(e: NotifyEvent) {
        if (!this._adaptColumnsWidth) {
            this.updateRequiredWidthAsync();
        }
        super.handle_layoutchange(e);
    }

    _updateSelectionIconsPosition() {
        let r = Math.max(this.requiredWidth() - this.canvasWidth - this.canvasScrollLeft, 0);
        if (this._lastSelIconRightPos !== r) {
            this._lastSelIconRightPos = r;
            setGridViewSelectionRules(this.uniqueID, r);
        }
    }

    updateSelectionIconsPosition() {
        if (this.disabledSelectionIconsPositionHandling || !this.multiselect || this.isGrid)
            return;
        if (this.selectionMode) {
            this.requestIdle(() => {
                this._updateSelectionIconsPosition();
            });
        } else {
            // icons are not displayed, update after 250ms should be enough
            this.requestTimeout(() => {
                this._updateSelectionIconsPosition();
            }, 250, 'updateSelectionIconsPosition');
        }
    }

    parentScrollFrame(deferDraw) {
        this.editCancel();
        super.parentScrollFrame(deferDraw);
    }

    handleCanvasScroll(e) {
        if (this.canvas.scrollLeft !== this.lastCheckedScrollLeft) {
            this.lastCheckedScrollLeft = this.canvas.scrollLeft;
            this.canvasScrollLeft = this.lastCheckedScrollLeft; // update immediatelly, so updateSelectionIconsPosition has right value
            this.visColumnsUpdate();
            this.updateSelectionIconsPosition();
        }
        this.editCancel();
        super.handleCanvasScroll(e);
    }

    cleanUpHeader() {
        this._ratioSet = false;
        if (this.headerItems) {
            let divs = qeclass(this.headerItems, 'lvHeaderItem');
            if (divs) {
                let div;
                for (let i = 0; i < divs.length; i++) {
                    div = divs[i];
                    if (div.contdiv) {
                        div.contdiv.parentListView = undefined;
                    }
                    app.unlisten(div);
                }
            }
            divs = qeclass(this.headerItems, 'lvHeaderItemResize');
            if (divs) {
                for (let i = 0; i < divs.length; i++) {
                    app.unlisten(divs[i]);
                }
            }
        }
    }

    cleanUp() {
        this.cleanUpHeader();
        uitools.cleanUpSaveButton(this.dataSource);
        super.cleanUp();
    }

    getSortingStr() {
        let sortobj;
        let sorttxt = '';
        for (let i = 0; i < this.sortColumns.length; i++) {
            sortobj = this.sortColumns[i];
            if (sorttxt)
                sorttxt += ';';
            sorttxt += sortobj.columnType + ' ' + sortobj.direction;
        }
        return sorttxt;
    }

    reSort(doForce?: boolean) {
        if (!this.sortColumns || !this.dataSource || !this.sortColumns.length)
            return;
        let sorttxt = this.getSortingStr();
        if (sorttxt) {
            if (this.dataSource.setAutoSortAsync) {
                if (this.autoSortSupported)
                    this.autoSortString = sorttxt;
                else
                if (doForce)
                    this.dataSource.setAutoSortAsync(sorttxt);
            }
        }
    }

    setUpHeader(header) {
        this.cleanUpHeader();
        cleanElement(header);
        header.classList.add('flex');
        header.classList.add('row');
        if (this.isColResizable)
            header.classList.add('resizeable');

        let clearDropAttributes = function (param) {
            if (this[param]) {
                this[param].removeAttribute('data-dropbefore');
                this[param].removeAttribute('data-dropafter');
                this[param] = undefined;
            }
        }.bind(this);

        let headerDragoverHandler = function (e) {
            if (this._draggedColumn === undefined) return;
            e.dataTransfer.dropEffect = 'move';
            e.preventDefault();
            let idx = header._itemsPositions.length - 1;
            for (let i = 1; i < header._itemsPositions.length; i++) {
                if (e.clientX < header._itemsPositions[i]) {
                    idx = i - 1;
                    break;
                }
            }
            let div1 = this.visibleColumns[idx].headerDiv;
            let div2 = undefined;
            let div2idx = idx;
            let halfX = header._itemsPositions[idx] + div1.offsetWidth / 2;
            let newOverDiv2 = undefined;
            if (e.clientX <= halfX) {
                div2 = div1;
                if (idx > 0)
                    div1 = this.visibleColumns[idx - 1].headerDiv;
                else
                    div1 = undefined;
                newOverDiv2 = div1;
            } else {
                div2idx = idx + 1;
                if (idx < header._itemsPositions.length - 1)
                    div2 = this.visibleColumns[idx + 1].headerDiv;
                newOverDiv2 = div2;
            }
            if (div2) { // avoid 'track' header into grouped header
                if (this.visibleColumns[div2idx].isGroupHeader) {
                    e.dataTransfer.dropEffect = 'none';
                    return;
                }
            }
            if (div1) {
                div1.removeAttribute('data-dropbefore');
                div1.setAttribute('data-dropafter', '1');
            }
            if (div2) {
                div2.removeAttribute('data-dropafter');
                if (div2.draggable) // do not allow to drop before not movable fixed columns
                    div2.setAttribute('data-dropbefore', '1');
            }
            if (this._lastOverDiv && (this._lastOverDiv != div1) && (this._lastOverDiv != div2)) {
                clearDropAttributes('_lastOverDiv');
            }
            if (this._lastOverDiv2 && (this._lastOverDiv2 != div1) && (this._lastOverDiv2 != div2)) {
                clearDropAttributes('_lastOverDiv2');
            }
            this._lastOverDiv2 = newOverDiv2;
            this._lastOverDiv = this.visibleColumns[idx].headerDiv;

            let totalPos = this.viewport.getBoundingClientRect();
            let offsetX = e.clientX - totalPos.left;

            let doUpdate = false;
            let scrollingParent = this.dynamicSize ? this.scrollingParent : this.canvas;

            if (offsetX < 50 && scrollingParent.scrollLeft > 0) {
                scrollingParent.scrollLeft -= 50 - offsetX;
            } else
            if (offsetX > totalPos.width - 50) {
                scrollingParent.scrollLeft += 50 - (totalPos.width - offsetX);
            }
            if (this.canvasScrollLeft !== scrollingParent.scrollLeft) {
                this.canvasScrollLeft = scrollingParent.scrollLeft;
                doUpdate = true;
            }

            if (doUpdate) {
                this.requestTimeout(() => {
                    header._itemsPositions = [];
                    for (let i = 0; i < this.visibleColumns.length; i++) {
                        header._itemsPositions[i] = this.visibleColumns[i].headerDiv.getBoundingClientRect().left;
                    }
                }, 10);
            }

        }.bind(this);

        let headerLeaveHandler = function (e) {
            if (this._draggedColumn === undefined) return;
            if (!isInElement(e.clientX, e.clientY, header)) {
                clearDropAttributes('_lastOverDiv');
                clearDropAttributes('_lastOverDiv2');
            }
        }.bind(this);

        let createResizable = function (div) {
            let resizediv = document.createElement('div');
            resizediv.className = 'lvHeaderItemResize';
            let maxResizeSize = 0;

            let mouseMoveHandler = function (e) {
                e.stopPropagation();
                e.preventDefault();
                let diff = e.clientX + this.canvasScrollLeft - this._resizeStartX;
                if (!this._resizingColumn)
                    return;
                let idx = Number(this._resizingColumn.column);
                let newWidth = this._originalColWidth + diff;
                let minwidth = this._getColumnMinWidth(this._resizingColumn);

                if (newWidth < minwidth)
                    newWidth = minwidth;

                if (maxResizeSize != 0) {
                    newWidth = Math.min(newWidth, maxResizeSize);
                }

                if (newWidth === this.visibleColumns[idx].width)
                    return;

                this.columns[this.visibleColumns[idx].index].width = newWidth;
                this.visibleColumns[idx].width = newWidth;
                this._resizingColumn.style.flexBasis = newWidth + 'px';

                if (this._adaptColumnsWidth) {
                    this._updateColumnsWidth();
                } else {
                    if (this._resizingColItems) {
                        if (resolveToValue(this.columns[this.visibleColumns[idx].index].align, '') == 'right') {
                            newWidth -= this._rightAlignMargin;
                        }
                        this._resizingColItems.forEach(function (datadiv) {
                            datadiv.style.flexBasis = newWidth + 'px';
                        }.bind(this));
                    }

                    if (this.visibleColumns[idx].isGroupHeader) {
                        let elementName = this.visibleColumns[idx].element;
                        this.groupDivs.forEach(function (groupDiv) {
                            let d = groupDiv[elementName];
                            if (d) {
                                d.style.width = Math.floor(newWidth);
                            }
                        });
                    }

                    this.updateRequiredWidthAsync();
                }

                this.afterColumnResize(div);

            }.bind(this);

            let mouseUpHandler = function (e) {
                e.stopPropagation();
                e.preventDefault();
                app.unlisten(window, 'mouseup', mouseUpHandler, true);
                app.unlisten(window, 'mousemove', mouseMoveHandler, true);
                this._lockColumns(this._resizingColumn, false);
                this._resizingColumn = undefined;
                document.body.classList.remove('globalResizeHorizontal');
                this._resizingColumn = undefined;
                this._resizingColItems = undefined;
                this.resizeFinished(div);
            }.bind(this);

            app.listen(resizediv, 'mousedown', function (e) {
                e.stopPropagation();
                e.preventDefault();
                document.body.classList.add('globalResizeHorizontal');
                this._resizeStartX = e.clientX + this.canvasScrollLeft;
                app.listen(window, 'mouseup', mouseUpHandler, true);
                app.listen(window, 'mousemove', mouseMoveHandler, true);
                this._resizingColumn = getParent(resizediv);
                if (this._resizingColumn) {
                    maxResizeSize = 0;
                    // when resizing columns, get it's maximal width so columns will not overlow
                    if (this._adaptColumnsWidth && (this._resizingColumn !== this.headerFill.previousElementSibling)) {
                        let minwidth = parseFloat(this._resizingColumn.nextElementSibling.style.minWidth) || this.minimalDefaultHeaderWidth;
                        if (this.columnMinWidth && (minwidth < this.columnMinWidth))
                            minwidth = this.columnMinWidth;

                        let fw = getFullWidth(this._resizingColumn);
                        let colPadding = fw - parseFloat(this._resizingColumn.style.flexBasis);
                        maxResizeSize = ((fw - colPadding) + (getFullWidth(this._resizingColumn.nextElementSibling) - colPadding) - minwidth) - 1;
                    }

                    this._lockColumns(this._resizingColumn, true);
                    this._originalColWidth = parseInt(this._resizingColumn.style.flexBasis);
                    // remember all related data divs
                    let coldivs = qeclass(this.container, 'lvColumnItem');
                    this._resizingColItems = [];
                    if (coldivs) {
                        for (let i = 0; i < coldivs.length; i++) {
                            if (coldivs[i].style.order === this._resizingColumn.style.order)
                                this._resizingColItems.push(coldivs[i]);
                        }
                    }
                }
            }.bind(this));

            div.appendChild(resizediv);
        }.bind(this);

        let createColumn = function (column, i) {
            if (column.isSortable === undefined)
                column.isSortable = this.isSortable;
            let contdiv = document.createElement('div');
            let sortdiv = document.createElement('div');
            let div = document.createElement('div');
            sortdiv.className = 'lvHeaderSort';
            sortdiv.style.order = '2';
            loadIconFast('downArrow', function (icon) {
                sortdiv.appendChild(icon);
            });
            let sortdivNumber = document.createElement('label');
            sortdivNumber.className = 'lvHeaderSortLabel';
            sortdivNumber.style.order = '3';

            contdiv.className = column.align == 'right' ? 'lvHeaderItemContentRight' : 'lvHeaderItemContent';
            sortdiv.style.order = '1';
            contdiv.parentListView = this;
            if (column.headerRenderer)
                column.headerRenderer(contdiv, column);
            else
                this.headerRenderers.renderDefault(contdiv, column);
            div.column = i;
            div.style.order = i;
            updateFirstColFlag(div, (i === 0));

            if (column.isGroupHeader) {
                let sz = this.getGroupDivSize(column);
                if (sz) {
                    column.width = sz;
                }
                column._initializeRequired = !sz;
            }
            div.style.flexBasis = column.width + 'px';
            let minW = this.minimalDefaultHeaderWidth;
            if (column.minWidth) {
                minW = getPixelSize(column.minWidth, 'minWidth', header);
                if (this.columnMinWidth && (minW < this.columnMinWidth))
                    minW = this.columnMinWidth;
            }
            div.style.minWidth = minW + 'px';
            div.className = 'lvHeaderItem flex row';
            div.draggable = this.isColMovable && !column.fixed;
            column.headerDiv = div;
            if (this.isSortable && column.isSortable) {
                div.classList.add('clickable');
                app.listen(div, 'mouseup', function (e) {
                    if ((e.button !== 0) || (Date.now() - this._lastLassoUsageTm < 10)) // #19352
                        return;

                    if (column.onClick) {
                        column.onClick.call(this, div);
                        return;
                    }

                    let addSort = e.ctrlKey;
                    let sortIdx = undefined;
                    if (!addSort) {
                        forEach(header.children, function (coldiv) {
                            if (coldiv !== div) {
                                coldiv.removeAttribute('data-sortAsc');
                                coldiv.removeAttribute('data-sortDesc');
                                coldiv.removeAttribute('data-sort-label');
                                if (coldiv.sortdivNumber)
                                    coldiv.sortdivNumber.innerText = '';
                            }
                        });
                    }
                    if (this.sortColumns) {
                        for (let i = 0; i < this.sortColumns.length; i++) {
                            if (this.sortColumns[i].columnType == column.columnType) {
                                if ((this.sortColumns.length > 1) && !addSort) {
                                    // reset column to default sorting, #18890
                                    let direction = column.direction || 'ASC';
                                    if (direction === 'ASC') {
                                        div.removeAttribute('data-sortDesc');
                                        div.setAttribute('data-sortAsc', '1');
                                        this.sortColumns[i].direction = 'ASC';
                                    } else {
                                        div.removeAttribute('data-sortAsc');
                                        div.setAttribute('data-sortDesc', '1');
                                        this.sortColumns[i].direction = 'DESC';
                                    }
                                } else
                                if (this.sortColumns[i].direction === 'ASC') {
                                    div.removeAttribute('data-sortAsc');
                                    this.sortColumns[i].direction = 'DESC';
                                    div.setAttribute('data-sortDesc', '1');
                                } else {
                                    div.removeAttribute('data-sortDesc');
                                    this.sortColumns[i].direction = 'ASC';
                                    div.setAttribute('data-sortAsc', '1');
                                }
                                sortIdx = i;
                                break;
                            }
                        }
                    }

                    if (sortIdx === undefined) {
                        let sortobj = {
                            columnType: column.columnType,
                            title: resolveToValue(column.title, ''),
                            direction: resolveToValue(column.direction, 'ASC')
                        };
                        if (addSort)
                            this.sortColumns.push(sortobj);
                        else
                            this.sortColumns = [sortobj];
                        if (sortobj.direction === 'ASC')
                            div.setAttribute('data-sortAsc', '1');
                        else
                            div.setAttribute('data-sortDesc', '1');
                    } else {
                        if (!addSort) { // @ts-ignore
                            let sortobj = this.sortColumns[sortIdx];
                            this.sortColumns = [sortobj];
                        }
                    }
                    if (this.sortColumns.length > 1) {
                        div.setAttribute('data-sort-label', '1');
                        div.sortdivNumber.innerText = this.sortColumns.length;
                    } else {
                        div.removeAttribute('data-sort-label');
                        div.sortdivNumber.innerText = '';
                    }
                    div.setAttribute('data-tip', this.createSortingTip());
                    /*            var sortMethod = function (item1, item2) {
                        if (col.sortFunc) {
                            return col.sortFunc(item1, item2);
                        } else {
                            return 0;
                        }
                    };
                    this.dataSource.customSort(sortMethod);*/

                    if (window.currentTabControl && !window.currentTabControl._saveOrderButton && !this.showSaveCalled && uitools.saveButtonSupported(this.parentView, this.dataSource)) {
                        let newSortString = this.autoSortString;
                        this.saveButtonHandle(newSortString);
                    }

                    if (this._dataSource)
                        this._dataSource.restoreFocusedItem(this._dataSource.focusedItem); // needed because of #17299

                    this.reSort(true);
                }.bind(this));
            }
            if (this.isColMovable && !column.isGroupHeader) {
                app.listen(div, 'dragstart', function (e) {
                    dnd.initializeDragEvent(e);
                    app.listen(header, 'dragover', headerDragoverHandler);
                    app.listen(header, 'dragleave', headerLeaveHandler);
                    div.dragging = true;
                    div.setAttribute('data-dragging', '1');
                    header._itemsPositions = [];
                    for (let i = 0; i < this.visibleColumns.length; i++) {
                        header._itemsPositions[i] = this.visibleColumns[i].headerDiv.getBoundingClientRect().left;
                    }
                    this._draggedColumn = div.style.order;
                    e.dataTransfer.setUserData(DRAG_HEADERITEM, 'headeritem');
                }.bind(this), false);

                app.listen(div, 'dragend', function (e) {
                    div.dragging = false;
                    div.removeAttribute('data-dragging');
                    if (this._lastOverDiv) {
                        if (this._lastOverDiv.hasAttribute('data-dropbefore')) {
                            this.moveColumn(this._draggedColumn, Number(this._lastOverDiv.style.order));
                        } else {
                            this.moveColumn(this._draggedColumn, Number(this._lastOverDiv.style.order) + 1);
                        }
                    }
                    clearDropAttributes('_lastOverDiv');
                    clearDropAttributes('_lastOverDiv2');
                    this._draggedColumn = undefined;
                    app.unlisten(header, 'dragover');
                    app.unlisten(header, 'dragleave');
                    dnd.finishedDragNDrop();
                    dnd.notifyDragFinished();
                }.bind(this), false);
            }
            div.appendChild(contdiv);
            div.appendChild(sortdiv);
            div.appendChild(sortdivNumber); // @ts-ignore
            div.contdiv = contdiv; // @ts-ignore
            div.sortdiv = sortdiv; // @ts-ignore
            div.sortdivNumber = sortdivNumber;
            let isLastColumn = (i == this.visibleColumns.length - 1);
            if (this.isColResizable && !isLastColumn) {
                createResizable(div);
            }
            header.appendChild(div);
            this.updateTopCheckbox();

            if (!column.width) {
                // LS: width is not defined, calc it (this is used e.g. for the first checkbox column in the header) 
                let cs = getComputedStyle(div);
                let calc_width = Math.round(getPixelSize(cs.width, 'width', div));
                if (calc_width)
                    column.width = calc_width;
            }

            return div;
        }.bind(this);

        this.visibleColumns.forEach(function (column, i) {
            createColumn(column, i);
        }.bind(this));

        // This additional element is here only to fill the rest of header in case it's narrower than the whole listview.
        let div = document.createElement('div');
        div.style.order = '9999999';
        div.style.minWidth = getScrollbarWidth() + 'px'; // So that this div can be drawn above a scrollbar
        div.className = 'lvHeaderFillRest fill';
        header.appendChild(div);
        this._headerFillPaddingSet = false;
        this.headerFill = div;
    }

    createSortingTip() {
        let ret = '';

        let getVisibleAlias = function (columnType) {
            for (let i = 0; i < this.visibleColumns.length; i++) {
                let col = this.visibleColumns[i];
                let ret = col.columnType === columnType;
                if (!ret && col.alias && isArray(col.alias)) {
                    for (let j = 0; j < col.alias.length; j++) {
                        if (col.alias[j] === columnType) {
                            return col;
                        }
                    }
                }
            }
            return null;
        }.bind(this);


        if (this.sortColumns) {
            ret = _('Sort order') + ':<br>';

            let createRow = function (col, direction, idx) {
                let ret = (idx + 1).toString() + '. ';
                ret += resolveToValue(col.title, col.columnType) + ' ';
                ret += (direction === 'ASC') ? _('ascending') : _('descending');
                ret += '<br>';
                return ret;
            };

            for (let i = 0; i < this.sortColumns.length; i++) {
                let col = getVisibleAlias(this.sortColumns[i].columnType);
                if (col) {
                    ret += createRow(col, this.sortColumns[i].direction, i);
                } else {
                    for (let j = 0; j < this.columns.length; j++) {
                        if (this.sortColumns[i].columnType === this.columns[j].columnType) {
                            ret += createRow(this.columns[j], this.sortColumns[i].direction, i);
                        }
                    }
                }
            }
        }
        return ret;
    }

    afterColumnResize(div) {
        if (this.visibleColumns[div.column] && this.visibleColumns[div.column].onColumnResize) {
            this.visibleColumns[div.column].onColumnResize.apply(this, arguments);
        }
    }

    resizeFinished(div) {
        if (this.visibleColumns[div.column] && this.visibleColumns[div.column].onResizeFinished) {
            this.visibleColumns[div.column].onResizeFinished.apply(this, arguments);
        }
    }

    getGroupDivSize(column) {
        let sz = 0;
        if (resolveToValue(column.visible, true)) {
            sz = resolveToValue(column.width, 0);
            if (!sz) {
                if (this.groupDivs && this.groupDivs.length) {
                    let par = this.groupDivs[0];
                    if (isVisible(par[column.element])) {
                        sz = par[column.element].clientWidth;
                        if (!sz) {
                            sz = getFullWidth(par[column.element]);
                        }
                        if (sz) {
                            column.width = sz;
                        }
                    }
                }
            }
        }
        return sz;
    }

    setUpGroupHeader(div: HTMLDivElement) {
        super.setUpGroupHeader(div);

        if (this.visibleColumns) {
            this.visibleColumns.forEach(function (column) {
                if (column.isGroupHeader && resolveToValue(column.visible, true)) {
                    let w = this.getGroupDivSize(column);
                    if (w) {
                        let d = div[column.element];
                        if (d)
                            d.style.width = w;
                    }
                    if (column.onGroupDivInit)
                        column.onGroupDivInit.call(this, div, column);
                }
            }.bind(this));
        }
    }

    afterDraw() {
        super.afterDraw();
        if (this.groupDivs.length && this.columns) {
            this.columns.forEach(function (column) {
                if (column.isGroupHeader && column._initializeRequired) {
                    let sz = this.getGroupDivSize(column);
                    if (sz) {
                        column.headerDiv.style.flexBasis = sz + 'px';
                        this.afterColumnResize(column.headerDiv);
                        column._initializeRequired = undefined;
                    }
                }
            }.bind(this));
        }
    }

    onTooltip(div, tip) {
        return tip;
    }

    // Set up one of row of the grid, i.e. all the columns are added as individual divs
    setUpDiv(div: HTMLDivElement) {
        div.classList.add('flex');
        div.classList.add('row');
        div.classList.add('gridrow');
        div.initRequired = true;

        let _this = this;
        let isPartOutOfListview = function (coldiv) {
            let totalPos = this.container.getBoundingClientRect();
            let divPos = coldiv.getBoundingClientRect();
            let isOut = ((divPos.left < totalPos.left) || (divPos.right > totalPos.right));
            if(isOut)
                return isOut;
            let p = getParent(this.container);
            while (!isOut && p) {
                totalPos = p.getBoundingClientRect();
                isOut = ((divPos.left < totalPos.left) || (divPos.right > totalPos.right));
                if(!isOut)
                    p = getParent(p);
            }
            return isOut;        
        }.bind(this);

        this.visibleColumns.forEach(function (column, i) {
            if (column.isGroupHeader)
                return;

            let coldiv = document.createElement('div');
            coldiv.parentListView = this;
            coldiv.className = 'lvColumnItem';
            coldiv.column = column;
            coldiv.style.order = i;
            coldiv.setAttribute('role', 'cell'); // Screen reader support
            div.appendChild(coldiv);

            if (column.setupCell === undefined)
                this.cellSetups.setupDefault(coldiv, column);
            else
                column.setupCell(coldiv, column);

            let totalSize = column.width;

            if (resolveToValue(column.align, '') == 'right') {
                if (this._rightAlignMargin === undefined) {
                    let style = getComputedStyle(coldiv, null);
                    let w = Math.round(parseInt(style.getPropertyValue('margin-right')) || 5);
                    this._rightAlignMargin = w;
                }
                totalSize -= this._rightAlignMargin;
            }

            coldiv.style.flexBasis = totalSize + 'px';

            if (column.checkClick !== undefined && coldiv.check) // @ts-ignore
                coldiv.check.controlClass.listen('click', column.checkClick);
            if (_this.showEllipsisTooltip) {
                let listenDiv = coldiv;
                if (coldiv.content !== undefined)
                    listenDiv = coldiv.content;

                listenDiv.tooltipValueCallback = function (tipdiv, vis, displayParams) {
                    if (!vis || _this._cleanUpCalled) {
                        return;
                    }
                    if ((this.clientWidth < this.scrollWidth) || (isPartOutOfListview(this)) || _this.alwaysShowTooltips) {
                        tipdiv.innerHTML = _this.onTooltip(this, this.innerHTML);
                        // LS: following is here because of #19291:
                        let rect = this.getBoundingClientRect();
                        displayParams.posX = rect.left + window.scrollX;
                        displayParams.posY = rect.top + window.scrollY;
                        //displayParams.height = rect.bottom - rect.top;
                    } else {
                        if (tipdiv.hasAttribute('data-tip')) 
                            tipdiv.innerText = tipdiv.getAttribute('data-tip');
                        else
                            tipdiv.innerText = '';
                    }
                }.bind(listenDiv);
            }
        }.bind(this));

        // This additional element is here only to fill the rest of row in case it's narrower than the whole listview.
        let filldiv = document.createElement('div');
        filldiv.style.order = '9999999';
        filldiv.className = 'lvColumnItem fill';
        filldiv.isFiller = true;
        div.appendChild(filldiv);
        if (this.multiselect) // @ts-ignore
            templates.addImageGridSelectButton(div, true /* only for touch */);
    }

    cleanUpDiv(div: HTMLDivElement) {
        let coldivs = qeclass(div, 'lvColumnItem');
        if (coldivs) {
            let coldiv;
            for (let i = 0; i < coldivs.length; i++) {
                coldiv = coldivs[i];
                if (coldiv.loadingPromise) {
                    cancelPromise(coldiv.loadingPromise);
                }
                coldiv.parentListView = undefined;
                if (coldiv.check)
                    app.unlisten(coldiv.check);
                app.unlisten(coldiv);
            }
        }
        div.initRequired = true;

        let divs = qeclass(div, 'lvHeaderItemContent');
        if (divs) {
            let divL;
            for (let i = 0; i < divs.length; i++) {
                divL = divs[i];
                divL.parentListView = undefined;
            }
        }

        let divsR = qeclass(div, 'lvHeaderItemContentRight');
        if (divsR) {
            let divR;
            for (let i = 0; i < divsR.length; i++) {
                divR = divsR[i];
                divR.parentListView = undefined;
            }
        }
        super.cleanUpDiv(div);
    }

    cancelItemLoadingPromises() {
        this.divs.forEach(function (div) {
            this.cancelItemLoadingPromise(div);
            forEach(div.children, function (coldiv, idx) {
                this.cancelItemLoadingPromise(coldiv);
            }.bind(this));
        }.bind(this));
    }

    visColumnsUpdate(forceRefresh?: boolean, initialCall?: boolean) {
        let prevColFirst = this.visColIndexFirst;
        let prevColLast = this.visColIndexLast;
        this.visColIndexFirst = -1;
        this.visColIndexLast = -1;
        if (!this.divs)
            return;
        let div = this.divs[0];
        let i = 1;
        while ((!div || !div.isVis) && (i < this.divs.length)) {
            div = this.divs[i];
            i++;
        }

        if (div) {
            if (div.initRequired) {
                this.visColIndexFirst = 0;
                this.visColIndexLast = this.visibleColumns.length - 1;
                div.initRequired = undefined;
            } else {
                let scrollLeft = this.canvasScrollLeft;
                let scrollRight = scrollLeft + this.canvasWidth;
                let groupWidth = 0;
                if (this.isGrouped) {
                    groupWidth = this.colGroupDimension;
                }
                forEach(div.children, function (coldiv, idx) {
                    if (coldiv.isFiller || (coldiv === div.selectButton))
                        return;
                    let ol = coldiv.offsetLeft + groupWidth;
                    if ((ol < scrollRight) && ((ol + coldiv.offsetWidth) > scrollLeft)) {
                        if ((idx < this.visColIndexFirst) || this.visColIndexFirst < 0)
                            this.visColIndexFirst = idx;
                        if ((idx > this.visColIndexLast))
                            this.visColIndexLast = idx;
                    }
                }.bind(this));
            }
        }
        this.visibleColumns.forEach(function (column, i) {
            if (column.headerDiv) {
                column.headerDiv.column = i;
                column.headerDiv.style.order = i;
                updateFirstColFlag(column.headerDiv, (i === 0));
            }
        });
        if (!initialCall && (forceRefresh || (prevColFirst !== this.visColIndexFirst) || (prevColLast !== this.visColIndexLast)))
            this.invalidateAll(); // for initial call from bindData do not invalidate, not needed
    }

    // Bind one row of a div, i.e. all the columns
    bindData(div: HTMLDivElement, index: number, item) {
        if ((this.visColIndexFirst < 0) || (this.visColIndexLast < 0)) {
            this.visColumnsUpdate(false, true);
        }

        if ((this.visColIndexFirst >= 0) && (this.visColIndexLast >= this.visColIndexFirst)) {
            this.dataSource.locked(function () {
                let rowFocused = this.dataSource.focusedIndex == index;
                let coldiv, column;
                if (this.preBindData)
                    this.preBindData(div, index, item); //for additional processing of descendants, used e.g. in trackListView
                for (let i = this.visColIndexFirst; i <= this.visColIndexLast; i++) {
                    coldiv = div.children[i];
                    if (coldiv && coldiv.column) {
                        column = coldiv.column;
                        if (this.highlightSupported) {
                            let highlight = item.isHighlighted(column.columnType);
                            if (coldiv.hasAttribute('highlighted') && !highlight)
                                coldiv.removeAttribute('highlighted');
                            else if (highlight)
                                coldiv.setAttribute('highlighted', 1);
                        }                        

                        coldiv.organizedPathColumnSupported = this.organizedPathColumnSupported;

                        if (coldiv.shortcut) {
                            setVisibility(coldiv.shortcut, rowFocused && this._showShortcuts);
                        }
                        if (coldiv.content) {
                            coldiv.content.itemIndex = coldiv.itemIndex;
                            coldiv.content.check = coldiv.check;
                            coldiv = coldiv.content;
                        }
                        if (column.bindData) {
                            coldiv.itemIndex = index;
                            column.bindData(coldiv, item, index);
                        } else
                        if (column.getValue) {
                            coldiv.textContent = column.getValue(item);
                        }
                    }
                }
            }.bind(this));
        }
    }

    getIndexOfColumn(fcol) {
        let findex = this.visibleColumns.indexOf(fcol);
        if (findex >= 0) { // handle group columns
            for (let i = findex; i >= 0; i--) {
                if (this.visibleColumns[i].isGroupHeader)
                    findex--;
            }
        }
        return findex;
    }

    getFocusedColumnDiv(div: HTMLDivElement) : HTMLDivElement {
        let fcol = this.focusedColumn;
        if (fcol) {
            let findex = this.getIndexOfColumn(fcol);
            if (findex >= 0)
                return div.children[findex] as HTMLDivElement;
            else
                return undefined;
        } else
            return undefined;
    }

    // internal
    getAllColumnDivs(div: HTMLDivElement) {
        return div.children;
    }

    // internal
    markFocused(div: HTMLDivElement, focused: boolean) {
        if (div.hasAttribute('data-focused') !== focused)
            div.forceRebind = true;
        // Clean focused state in all columns first
        forEach(this.getAllColumnDivs(div), function (coldiv) {
            coldiv.removeAttribute('data-keyfocused');
            clearAriaID(coldiv);
        });

        if (focused && this.focusVisible) {
            // Set the focused state for the correct column then
            let coldiv = this.getFocusedColumnDiv(div);
            if (coldiv) {
                coldiv.setAttribute('data-keyfocused', '1');
                setAriaActiveDescendant(coldiv, this.container); // Screen reader support (Set active descendant to the column div)
            }
        }

        if (focused) {
            div.setAttribute('data-focused', '1');
        } else {
            div.removeAttribute('data-focused');
        }
    }

    // Override markSelected to not give container aria-activedescendant attribute
    markSelected(div: HTMLDivElement, selected: boolean) {

        if (selected && !this.noItemOverstrike)
            div.setAttribute('data-selected', '1');
        else
            div.removeAttribute('data-selected');

    }

    // internal
    _getNextElementSibling(div: CustomElement) {
        if (div) {
            if (div._groupHeader) {
                return div.nextElementSibling;
            }
            if (div.column !== undefined) {
                let col = this.getNextVisibleColumn(this.visibleColumns[div.column]);
                if (col)
                    return col.headerDiv;
                return this.headerFill;
            }
        }
        return null;
    }

    _getPreviousElementSibling(div: CustomElement) {
        if (div) {
            if (div._groupHeader) {
                return div.previousElementSibling;
            }
            let col = this.getPrevVisibleColumn(this.visibleColumns[div.column]);
            if (col)
                return col.headerDiv;
        }
        return null;
    }

    _lockColumns(resizedCol, doLock) {
        let div;
        div = this._getPreviousElementSibling(resizedCol);
        while (div) {
            div._adjustLocked = doLock ? true : undefined;
            div = this._getPreviousElementSibling(div);
        }

        div = this._getNextElementSibling(resizedCol);
        while (this._getNextElementSibling(div)) {
            div = this._getNextElementSibling(div);
            div._adjustLocked = doLock ? true : undefined;
        }
    }

    _isAdaptable(div: CustomElement) {
        let column = this.visibleColumns[div.column];
        if (column) {
            let adaptable = resolveToValue(column.adaptableSize, true);
            if (!adaptable && this._resizingColumn)
                adaptable = (div === this._resizingColumn) || (div === this._getNextElementSibling(this._resizingColumn));
            return adaptable;
        }
        return false;
    }

    _getColumnsForAutoSize(adaptableArray, nonAdaptableArray, total) {
        adaptableArray = adaptableArray || [];
        nonAdaptableArray = nonAdaptableArray || [];
        let origTotal = total;

        for (let i = 0; i < this.headerItems.children.length - 1 /* ignore last fill column */; i++) {
            let div = this.headerItems.children[i] as HTMLDivElement;
            let adaptable = this._isAdaptable(div); // @ts-ignore
            if (!adaptable || div._adjustLocked) {
                nonAdaptableArray.push(div);
                total -= getFullWidth(div);
            } else {
                adaptableArray.push(div);
            }
        }

        return total;
    }

    _computeAdaptSizes() {
        if (!this._adaptColumnsWidth)
            return;

        let total = this.headerFill.offsetLeft;
        let adaptableArray = [];
        let nonAdaptableArray = [];
        total = this._getColumnsForAutoSize(adaptableArray, nonAdaptableArray, total);

        if (this._resizingColumn || !this._ratioSet) {
            for (let i = 0; i < adaptableArray.length; i++) {
                let div = adaptableArray[i];
                div._adaptRatio = total / getFullWidth(div);
            }
            this._ratioSet = this._resizingColumn === undefined;
        }
    }

    _getColumnMinWidth(div) {
        let minwidth = parseFloat(div.style.minWidth) || this.minimalDefaultHeaderWidth; // we have always in pixels                    
        if (this.columnMinWidth && (minwidth < this.columnMinWidth))
            minwidth = this.columnMinWidth;
        return minwidth;
    }

    _updateColumnsWidth() {
        if (!this._layoutChangeLock && !minimized) {
            this._layoutChangeLock = true;

            this._computeAdaptSizes();

            lockedLayout(this.container, function () {
                let totalLVSize = Math.min(this.container.offsetWidth, this.viewport.offsetWidth); // used viewport because is't without scrollbars
                //ODS('--- container.offsetWidth='+this.container.offsetWidth+', viewport.offsetWidth='+this.viewport.offsetWidth);
                if (totalLVSize <= 0) {
                    this._ratioSet = false;
                    return;
                }
                let adaptableArray = [];
                let nonAdaptableArray = [];
                totalLVSize = this._getColumnsForAutoSize(adaptableArray, nonAdaptableArray, totalLVSize);

                let paddingSize = -1;
                let computeDivSize = function (div) {
                    let size = totalLVSize / div._adaptRatio;

                    if (paddingSize === -1) {
                        let cs = getComputedStyle(div, null);
                        paddingSize = getOuterWidth(div, cs);
                        if (isNaN(paddingSize)) paddingSize = 0;
                    }
                    size -= paddingSize;
                    let minwidth = this._getColumnMinWidth(div);

                    if (size < minwidth)
                        size = minwidth;
                    return Math.floor(size);
                }.bind(this);

                if (adaptableArray.length) {
                    for (let i = 0; i < adaptableArray.length; i++) {
                        let div = adaptableArray[i];
                        let column = this.visibleColumns[div.column];

                        let size = computeDivSize(div);

                        this.columns[column.index].width = size;
                        column.width = size;
                    }
                }

                let anythingChanged = 0;
                let coldivs = qeclass(this.container, 'lvColumnItem');
                if (coldivs) {
                    for (let i = 0; i < this.headerItems.children.length - 1 /* ignore last fill column */; i++) {
                        let div = this.headerItems.children[i];
                        let column = this.visibleColumns[div.column];
                        let size = column.width;
                        let sizeInt = Math.floor(size);
                        let resized = false;
                        if ((parseInt(div.style.flexBasis) !== sizeInt) || (this._resizingColumn == div)) {
                            anythingChanged++;
                            resized = true;
                            div.style.flexBasis = sizeInt + 'px';
                        }

                        if (resized) {
                            if (column.isGroupHeader) {
                                this.groupDivs.forEach(function (groupDiv) {
                                    let d = groupDiv[column.element];
                                    if (d) {
                                        d.style.width = sizeInt;
                                    }
                                });
                                this.afterColumnResize(div);
                            } else {
                                if (resolveToValue(this.columns[column.index].align, '') == 'right')
                                    sizeInt -= this._rightAlignMargin;
                                sizeInt = Math.floor(sizeInt);
                                for (let j = 0; j < coldivs.length; j++)
                                    if (coldivs[j].style.order === div.style.order)
                                        coldivs[j].style.flexBasis = sizeInt + 'px';
                            }
                        }
                    }
                }

                if (anythingChanged || this._layoutChanged /* #17438 */) {
                    this.updateRequiredWidthAsync();
                }
            }.bind(this));

            this._layoutChangeLock = undefined;
        }
    }

    /**
    Returns a visible column that's 'offset' columns to the right (if offset is positive).

    @method getVisibleColumnOffset
    @param {Column} column Starting column
    @param {integer} offset Distance of the column
    @param {bool} editable Must be editable
    @return {Column} The resulting column or undefined if none.
    */
    getVisibleColumnOffset(column, offset, editable) {
        if (!this.visibleColumns)
            return undefined;
        if (!offset)
            return column;

        let index = this.visibleColumns.indexOf(column);
        if (index < 0) {
            if (offset > 0)
                index = -1;
            else
                index = this.visibleColumns.length;
        }

        while (offset) {
            if (offset > 0) {
                index++;
                if (index >= this.visibleColumns.length)
                    return undefined;
                column = this.visibleColumns[index];
                if (!column || column.focusable === undefined || column.focusable)
                    if (!editable || (editable && column.editor))
                        offset--;
            } else {
                index--;
                if (index < 0)
                    return undefined;
                column = this.visibleColumns[index];
                if (!column || column.focusable === undefined || column.focusable)
                    if (!editable || (editable && column.editor))
                        offset++;
            }
        }

        if (index >= 0 && index < this.visibleColumns.length)
            return this.visibleColumns[index];
        else
            return undefined;
    }

    /**
    Returns the next visible column (to the right), or undefined if there isn't any.

    @method getNextVisibleColumn
    @param {Column} column Starting column
    @param {bool} editable Must be editable
    @return {Column} The resulting column or undefined if none.
    */
    getNextVisibleColumn(column, editable?: boolean) {
        return this.getVisibleColumnOffset(column, +1, editable);
    }

    /**
    Returns the previous visible column (to the left), or undefined if there isn't any.

    @method getPrevVisibleColumn
    @param {Column} column Starting column
    @param {bool} editable Must be editable
    @return {Column} The resulting column or undefined if none.
    */
    getPrevVisibleColumn(column, editable?: boolean) {
        return this.getVisibleColumnOffset(column, -1, editable);
    }

    /**
    Moves focus one column to the right.

    @method moveFocusRight
    @param {bool} editable Must be editable
    */
    moveFocusRight(editable?: boolean) {
        let newCol = this.getNextVisibleColumn(this.focusedColumn, editable);
        if (newCol) {
            this.focusedColumn = newCol;
            return true;
        } else
            this.redrawFocusedItem(true); // to be sure, focus rectangle is drawn on the current boundary item
        return false;
    }

    /**
    Moves focus one column to the left.

    @method moveFocusLeft
    @param {bool} editable Must be editable
    */
    moveFocusLeft(editable?: boolean) {
        let newCol = this.getPrevVisibleColumn(this.focusedColumn, editable);
        if (newCol) {
            this.focusedColumn = newCol;
            return true;
        } else
            this.redrawFocusedItem(true); // to be sure, focus rectangle is drawn on the current boundary item
        return false;
    }

    getGroupHeaderSize() {
        let res = 0;
        for (let i = 0; i < this.visibleColumns.length; i++) {
            let column = this.visibleColumns[i];
            if (column.isGroupHeader)
                res = res + column.width;
        }
        return res;
    }

    makeColumnFullyVisible(coldiv?: HTMLDivElement) {
        if (coldiv === undefined) {
            let div = this.getDiv(this.focusedIndex); // TODO: scroll invisible focused item into the visible area
            if (div)
                coldiv = this.getFocusedColumnDiv(div);
        }
        if (coldiv) {
            let visible = this.getVisibleRect();

            let _canvas = this.canvas;
            if (this.dynamicSize && this.scrollingParent)
                _canvas = this.scrollingParent; // #15382

            let scroll = _canvas.scrollLeft;
            let divLeft = coldiv.offsetLeft + this.getGroupHeaderSize();
            let divRight = divLeft + coldiv.offsetWidth + 20 /* looks better to have a small reserve */;
            if (scroll >= divLeft) {
                _canvas.scrollLeft = divLeft;
            } else
            if (scroll + visible.width < divRight) {
                _canvas.scrollLeft = divRight - visible.width;
            }
        }
    }

    // overriden
    setScrollOffset(newValue) {
        if (newValue !== this.getScrollOffset()) {
            super.setScrollOffset(newValue);
            this.editCancel();
        }
    }

    editStart( byMouseDblClick?: boolean) {
        if (window.isTouchMode) return;
        let lastFocusedIndex = this.focusedIndex;
        let lastScrollOffset = this.getScrollOffset();
        let div = this.getDiv(lastFocusedIndex); // TODO: scroll invisible focused item into the visible area
        let coldiv;
        if (div)
            coldiv = this.getFocusedColumnDiv(div);
        let col = this.focusedColumn;

        if (div && coldiv && col) {
            this._movingEditorToColumn = true;
            this.makeColumnFullyVisible(coldiv);
            if (col.editor) {

                let runEdit = function (item) {
                    this._movingEditorToColumn = undefined;
                    if ((lastFocusedIndex === this.focusedIndex) &&
                        (lastScrollOffset === this.getScrollOffset()) && isVisible(coldiv) &&  // @ts-ignore
                        (!window.getCurrentEditor())) {
                        this.savedScrollOffset = null;
                        if (this.dataSource.suspendAutoUpdates)
                            this.dataSource.suspendAutoUpdates();
                        if (col.editor('edit', coldiv, item, byMouseDblClick)) {
                            if (this.inEdit && !this.inEdit.saveCalled && !this.inEdit.cancelCalled)
                                this.editCancel();
                            this.inEdit = {
                                column: col,
                                celldiv: coldiv,
                                div: div,
                                item: item
                            };
                        }
                    }
                }.bind(this);

                let delayEdit = function (time) {
                    this.requestTimeout(function () { // we need to wait till scroll animation finished
                        let item = this.getItemForEdit(lastFocusedIndex);
                        if (item) {
                            this._delayEditTryout = undefined;
                            if (resolveToValue(col.editable, true, item))
                                runEdit(item);
                        } else {
                            if (this._delayEditTryout === undefined)
                                this._delayEditTryout = 4;
                            if (--this._delayEditTryout > 0) {
                                delayEdit(50);
                            } else {
                                this._delayEditTryout = undefined;
                            }
                        }
                    }.bind(this), time, 'delayEdit');
                }.bind(this);

                delayEdit(100);
            }
        }
    }

    afterEdit() {
        if (this._userInteractionDone)
            this._userInteractionDone();
        if (this.dataSource.resumeAutoUpdates)
            this.dataSource.resumeAutoUpdates();
        if (this.singleClickEdit) {
            // when single click edit is enabled we need to prevent start editing when mouseup event fired
            this.requestTimeout(() => {
                if (this.inEdit && !this.inEdit.saveCalled && !this.inEdit.cancelCalled)
                    this.editCancel();
                this.inEdit = undefined;
            }, 100, 'timerAfterEdit');
        } else
            this.inEdit = undefined;
    }

    disableAutoSort() {
        if ((this._autoUpdateWasDisabled === undefined) && (this.autoSortSupported) && (this.dataSource) && this.dataSource.suspendAutoUpdates) {
            this._autoUpdateWasDisabled = true;
            this.dataSource.suspendAutoUpdates();
        }
    }

    restoreAutoSort() {
        if ((this._autoUpdateWasDisabled !== undefined) && (this.autoSortSupported) && (this.dataSource) && (!this._movingEditorToColumn) && this.dataSource.resumeAutoUpdates) {
            this._autoUpdateWasDisabled = undefined;
            this.dataSource.resumeAutoUpdates();
        }
    }

    // overriden
    editSave(continueEdit /* this value will be true when saved valued using tab or keydown */, newItemSelected /* new item was selected by mouse */) {
        if (this.inEdit) {

            if (continueEdit) {
                this.disableAutoSort();
            } else {
                this.restoreAutoSort();
            }            
            this.inEdit.column.editor('save', this.inEdit.celldiv, this.inEdit.item);
            this.inEdit.saveCalled = true;
            if (!continueEdit && !newItemSelected && this.autoSortString && this.dataSource && this.autoSortSupported && this._dataSource.setAutoSortAsync) {
                this._dataSource.restoreFocusedItem(null);
            }            
            this.inEdit.div.itemIndex = undefined; // force rebind
            this.afterEdit();
            this.draw(); // force redraw
        }
    }

    // overriden
    editCancel() {
        this.restoreAutoSort();
        if (this.inEdit) {
            this.inEdit.column.editor('cancel', this.inEdit.celldiv, this.inEdit.item);
            this.inEdit.cancelCalled = true;
            this.afterEdit();
        }
    }

    disableColumnsEdit() {
        this.visibleColumns.forEach((column) => {
            column.editable = false;
        });
        this.header.controlClass.contextMenu = () => {
            return [];
        };
        this.disableStateStoring = true;
    }

    // overriden
    handle_keydown(e) {
        let handled = true;
        switch (friendlyKeyName(e)) {
        case 'Right':
            this.moveFocusRight();
            this.makeColumnFullyVisible();
            break;
        case 'Left':
            this.moveFocusLeft();
            this.makeColumnFullyVisible();
            break;
        case 'Space':
        {
            handled = false;
            if(this.focusedIndex>=0) {
                let div = this.getDiv(this.focusedIndex);
                if (div) {
                    let coldiv = this.getFocusedColumnDiv(div);
                    if(coldiv) {
                        if(coldiv.check && coldiv.check.controlClass) {
                            (coldiv.check.controlClass as Checkbox).checked = !(coldiv.check.controlClass as Checkbox).checked;
                            handled = true;
                        }
                    }
                }
                e.preventDefault(); // this will prevent unwanted autoscroll
            }
            break;
        }
        default:
            handled = false;
        }

        if (!handled)
            return super.handle_keydown(e);
    }

    dragFinished(e) {
        this._currentView = null;
        this._currentHandler = null;
        this._canDrop = undefined;

        super.dragFinished(e);
    }

    getDropMode(e): DropMode {
        let view = this._currentView;
        if (!view)
            view = this.parentView;
        if (view) {
            this._currentView = view;
            let handler = this._currentHandler;
            if (!handler)
                handler = getNodeHandler(view);
            this._currentHandler = handler;
            return handler.getDropMode && handler.getDropMode(view.viewNode.dataSource, e);
        }
        return super.getDropMode(e);
    }

    canDrop(e) {
        if (dnd.headerMoving(e))
            return true;
        if (this._canDrop !== undefined)
            return this._canDrop;
        let view = this.parentView;
        if (view) {
            let handler = getNodeHandler(view);
            this._currentHandler = handler;
            this._canDrop = handler.canDrop && handler.canDrop(view.viewNode.dataSource, e, this /* callerControl */);
            return this._canDrop;
        }
        this._canDrop = super.canDrop(e);
        return this._canDrop;
    }

    drop(e, isSameControl: boolean) {
        if (dnd.headerMoving(e))
            super.drop(e);
        else {
            let view = this._currentView;
            if (!view)
                view = this.parentView;
            if (view) {
                this._currentView = view;
                let handler = this._currentHandler;
                if (!handler)
                    handler = getNodeHandler(view);
                this._currentHandler = handler;
                let isSame = dnd.isSameControl(e) || isSameControl;
                if (isSame && resolveToValue(handler.canReorderItemsInView, false) && dnd.isDropMode(e, ['move', 'none'])) {
                    dnd.listview_handleReordering(e);
                    if (handler.itemsInViewReordered)
                        handler.itemsInViewReordered(view.viewNode.dataSource, e, this.getDropIndex(e));
                } else
                if (handler.drop)
                    handler.drop(view.viewNode.dataSource, e, this.getDropIndex(e));
            } else
                super.drop(e);
        }
        this.cancelDrop();
    }

    forceReRender() {
        // workaround for Chromium bug, after changes in columns content is not scrolled to the left sometimes
        this.requestTimeout(function () {
            if (this.canvas) {
                this.canvas.dispatchEvent(createNewEvent('scroll'));
            }

            if (this.dataSource && this.dataSource.focusedIndex >= 0)
                this.setShortcutsOnItemIndex(this.dataSource.focusedIndex);
        }.bind(this), 10);
    }

    storeState() {
        let state = super.storeState();
        if (this.dataSource && this.autoSortSupported && !this.sortStoringDisabled && this.dataSource.setAutoSortAsync) {
            if (uitools.storeColumnsSupported(this.parentView))
                state.sortString = this.dataSource.autoSortString;
        }
        return state;
    }

    restoreState(state) {
        super.restoreState(state);
        let str = state.sortString;
        if (str && this.autoSortSupported && !this.sortStoringDisabled) {
            this.setSortColumns(str);
            this.saveButtonHandle(str);
        }
    }

    focusRefresh(newFocusState) {
        if (isUsingKeyboard() && newFocusState && (this.focusedColumnIndex < 0) && (this._dataSource && this._dataSource.count)) {
            if (this.visibleColumns && (this.visibleColumns.length > 0))
                this.moveFocusRight(); // selects first column by default
        }
        super.focusRefresh(newFocusState);
    }


    /**
    Gets/sets index of the focused column, based on all columns array

    @property focusedColumnIndex
    @type integer
    */
    get focusedColumnIndex() {
        return this._focusedColumnIndex;
    }
    set focusedColumnIndex(value) {
        if (value >= 0 && value < this.columns.length) {
            this._focusedColumnIndex = value;
            this.redrawFocusedItem(true);
        }
    }

    /**
    Gets/sets of the focused Column object.

    @property focusedColumn
    @type Column
    */
    get focusedColumn() {
        if (this._focusedColumnIndex >= 0 && this._focusedColumnIndex < this.columns.length) {
            let col = this.columns[this._focusedColumnIndex];
            // find the corresponding item in visibleColumns
            let idx = 0;
            let visIdx = -1;
            let retval = undefined;
            while (!retval && (idx < this.visibleColumns.length)) {
                if (this.visibleColumns[idx].index === this._focusedColumnIndex) {
                    retval = this.visibleColumns[idx];
                }
                idx++;
            }
            return retval;
        } else
            return undefined;
    }
    set focusedColumn(value) {
        if (value)
            this.focusedColumnIndex = value.index;
        else
            this.focusedColumnIndex = -1;
    }

    get sortString() {
        return this.autoSortString;
    }
    set sortString(value) {
        this.autoSortString = value;
    }

    get adaptColumnsWidth() {
        return this._adaptColumnsWidth;
    }
    set adaptColumnsWidth(value) {
        if (this._adaptColumnsWidth !== value) {
            this._adaptColumnsWidth = value;
            this.canScrollHoriz = !value;
            if (value) {
                this._updateColumnsWidth();
            }
        }
    }

}
registerClass(GridView);


/**
A set of procedures for rendering listview headers. Currently available are renderDefault, renderCheck.

@property headerRenderers
@type Object
*/
GridView.prototype.headerRenderers = {

    renderDefault: function (div, column) {
        div.innerText = resolveToValue(column.title, '', column.listview);
        if (column.align === 'right')
            div.style.textAlign = 'right';
    },

    renderCheck: function (div, column) {
        GridView.prototype.headerRenderers.renderDefault(div, column);
        if (!div.check) {
            column.isSortable = false;
            div.check = document.createElement('div');
            div.check.setAttribute('data-id', 'selectAll');
            div.check.controlClass = new Checkbox(div.check, {
                type: 'checkbox',
                focusable: true,
                _checkParentFocus: false
            });

            div.insertBefore(div.check, div.firstChild);
            app.listen(div.check, 'click', function (e) {
                let chb = div.check.controlClass;
                let ds = div.parentListView.dataSource;
                if (ds) {
                    ds.beginUpdate();
                    ds.modifyAsync(function () {
                        for (let a = 0; a < ds.count; a++) {
                            ds.setChecked(a, chb.checked);
                        }
                    }).then(function () {
                        ds.endUpdate();
                        if (div.parentListView) {
                            div.parentListView.invalidateAll();
                            let event = createNewCustomEvent('checkedchanged', {
                                detail: null,
                                bubbles: true,
                                cancelable: true
                            });
                            div.parentListView.container.dispatchEvent(event);
                        }
                    });
                }
            });
            div.parentListView.isCheckboxInHeader = true;
            div.parentListView._checkParentFocus = false;
            div.parentListView.updateTopCheckbox();
        }
    }
};

/**
A set of functions for preparing of individual listview cells. Currently available are setupDefault and setupCheckbox

@property cellSetups
@type Object
*/
GridView.prototype.cellSetups = {

    setupDefault: function (div, column) {
        if (column.shortcutFunc !== undefined) {
            div.content = document.createElement('div');
            div.content.classList.add('fill');
            div.content.classList.add('textEllipsis');
            div.content.parentListView = div.parentListView;
            div.content.style = 'padding: inherit; White-space : pre;';            
            div.appendChild(div.content);

            div.shortcut = document.createElement('div');
            div.shortcut.classList.add('icon');
            div.shortcut.classList.add('alignright');
            div.shortcut.classList.add('clickable');
            div.shortcut.classList.add('lvInlineIcon'); // #17190
            div.shortcut.setAttribute('data-control-class', 'Control');
            div.appendChild(div.shortcut);
            initializeControls(div);

            app.listen(div.shortcut, 'click', function (e) {
                div.lastMouseUp = undefined;
                if (column.shortcutFunc && (div.parentElement.itemIndex >= 0)) {
                    let LV = div.parentElement.parentListView;
                    let item = undefined;
                    LV.dataSource.locked(function () {
                        item = LV.dataSource.getValue(div.parentElement.itemIndex);
                    });
                    column.shortcutFunc(item, LV._activeShortcut);
                }
                e.stopPropagation();
            }.bind(this));
            app.listen(div.shortcut, 'mouseup', function (e) {
                div.lastMouseUp = undefined;
                e.stopPropagation(); //#17871
            });

            div.shortcut.controlClass.contextMenu = (evt) => {
                let LV = div.parentElement.parentListView;
                return LV.getShortcutContextMenu(div, column);
            };
            GridView.prototype.cellSetups.setupBase(div.content, column);
        } else {
            div.style.whiteSpace = 'pre'; // #20244 
            GridView.prototype.cellSetups.setupBase(div, column);
        }
    },

    setupCheckboxTriState: function (div, column) {
        GridView.prototype.cellSetups.setupCheckbox(div, column, true);
    },

    setupCheckbox: function (div, column, triState) {
        GridView.prototype.cellSetups.setupDefault(div, column);

        let list = div.parentListView;

        let checkClick = function (e) {
            let chkb = e.currentTarget;
            if (!chkb || !chkb.controlClass)
                return;
            chkb = chkb.controlClass;
            if (chkb.itemIndex !== undefined) {
                e.stopPropagation();
                e.preventDefault();

                let ds = list.dataSource;
                if (ds) {
                    let checked;
                    ds.locked(function () {
                        checked = !ds.isChecked(chkb.itemIndex);
                    });
                    ds.modifyAsync(() => {
                        ds.setChecked(chkb.itemIndex, checked);
                    }).then(() => {
                        chkb.checked = checked;
                        let event = createNewCustomEvent('checkedchanged', {
                            detail: {
                                div: div,
                                checked: chkb.checked
                            },
                            bubbles: true,
                            cancelable: true
                        });
                        list.container.dispatchEvent(event);
                        chkb.container.parentElement.setAttribute('data-tip', chkb.checked ? list.listCheckTipChecked : list.listCheckTipUnchanged);
                    });
                }
            }
        };

        div.style.alignItems = 'center';
        div.classList.add('flex');
        div.check = document.createElement('div');
        div.check.controlClass = new Checkbox(div.check, {
            type: 'checkbox',
            triState: triState,
            baseline: true,
            focusable: false
        });
        div.appendChild(div.check);
        app.listen(div.check, 'change', checkClick);
    },

    setupRadio: function (div, column) {
        GridView.prototype.cellSetups.setupDefault(div, column);

        let list = div.parentListView;

        let checkClick = function (e) {
            e.stopPropagation();
            let chkb = e.currentTarget;
            if (!chkb || !chkb.controlClass)
                return;
            chkb = chkb.controlClass;
            let ds = list.dataSource;
            if (ds) {
                ds.modifyAsync(function () {
                    ds.beginUpdate();
                    for (let i = 0; i < ds.count; i++) {
                        ds.setChecked(i, false);
                    }
                    if (chkb.itemIndex !== undefined) {
                        ds.setChecked(chkb.itemIndex, chkb.checked);
                        let event = createNewCustomEvent('checkedchanged', {
                            detail: null,
                            bubbles: true,
                            cancelable: true
                        });
                        list.container.dispatchEvent(event);
                    }
                    ds.endUpdate();
                });
            }
        };

        div.classList.add('flex');
        div.style.alignItems = 'center';
        div.check = document.createElement('div');
        div.check.controlClass = new Checkbox(div.check, {
            type: 'radio',
            name: div.parentListView.uniqueID,
            baseline: true
        });
        div.appendChild(div.check);
        app.listen(div.check, 'change', checkClick);
    },

    setupBase: function (div, column) {
        if (column.align === 'right') {
            div.style.textAlign = 'right';
            div.setAttribute('data-right-aligned', '1');
        }
    },

    setupRating: function (div, column) {
        GridView.prototype.cellSetups.setupBase(div, column);
        // @ts-ignore
        div.controlClass = new Rating(div, {
            useUnknown: true,
            readOnly: true,
            position: 'left',
            starWidth: '1.2em',
            readOnlyPadding: 'none'
        });
    },

    setupProgress: function (div, column) {
        GridView.prototype.cellSetups.setupBase(div, column);
        // @ts-ignore
        div.controlClass = new ProgressBar(div, {
            transition: false // to prevent from animation on rows re-ordering
        });
    },

    setupIcon: function (div, column) {
        GridView.prototype.cellSetups.setupBase(div, column);
        div.style.alignItems = 'center';
        div.icon = document.createElement('div');
        div.icon.className = 'iconHoverable';
        div.icon.setAttribute('data-icon', 'close'); // this can be changed in bindData, see episodelist.js for example        
        div.appendChild(div.icon);
        initializeControls(div);
    },

    setupArtwork: function (div, column) {
        GridView.prototype.cellSetups.setupBase(div, column);
        div.setAttribute('artworkHolder', '1');
    },
};

GridView.prototype.defaultBinds = {
    bindCheckboxCell: function (div, item, index) {
        if (index >= 0) {
            let LV = div.parentListView;
            let ds = LV.dataSource;
            let cb = div.check.controlClass;
            cb.checked = ds.isChecked(index);
            cb.itemIndex = index;
            let tip = cb.indeterminate ? LV.listCheckTipIndeterminate : cb.checked ? LV.listCheckTipChecked : LV.listCheckTipUnchanged;
            if (tip)
                div.check.setAttribute('data-tip', tip);
            else
                div.check.removeAttribute('data-tip');
        }
    },

    bindCheckboxCell_HideOdd: function (div, item, index) {
        if (index >= 0) {
            if (index % 2 == 1) {
                setVisibility(div.check, true);
                let LV = div.parentListView;
                let ds = LV.dataSource;
                let cb = div.check.controlClass;
                cb.checked = ds.isChecked(index);
                cb.itemIndex = index;
                let tip = cb.indeterminate ? LV.listCheckTipIndeterminate : cb.checked ? LV.listCheckTipChecked : LV.listCheckTipUnchanged;
                if (tip)
                    div.check.setAttribute('data-tip', tip);
                else
                    div.check.removeAttribute('data-tip');
            } else {
                setVisibility(div.check, false); // hide checkboxes for odd lines (useful for Auto-tag dialogs)
            }
        }
    }
};



/**
A column definition for GridView

@class Column
*/
export class Column {
    listview: ListView;
    index?:number;
    columnType: string;
    title: string;
    direction: string;
    visible?: boolean;    
    headerDiv?: HTMLElement;        
    isGroupHeader: boolean;
    groupIndex: number;
    
    constructor(listview: ListView, initdata: AnyDict) {
        this.listview = listview;
        assignProperties(this, initdata);
    }
    
}
registerClass(Column);

/**
Title shown in the column header

@property title
@type String
*/

/**
Column alignment. Is 'left' by default, but can be set to 'right'.

@property align
@type String
@default left
@optional
*/

/**
Whether this column can receive focus.

@property focusable
@type Boolean
@default true
@optional
*/
