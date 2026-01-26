'use strict';


/**
@module UI
*/

import ImageGrid from './imageGrid';
import { Column } from './gridview';
import { DRAG_HEADERITEM } from '../consts';

let updateFirstColFlag = function (div, vis) {
    if (vis) {
        div.setAttribute('data-first-col', '1');
    } else {
        div.removeAttribute('data-first-col');
    }
};

/**
UI VideoGrid element

@class VideoGrid
@constructor
@extends ImageGrid
*/

export default class VideoGrid extends ImageGrid {
    columns: Column[];
    visibleColumns: Column[];
    isColMovable: boolean;
    hideAdaptColumnsWidth: boolean;
    sortColumns: SortColumn[];
    useTemplate: string;
    _fieldDefs: AnyDict;
    _fieldGroups: AnyDict;
    headerRenderers: AnyDict;
    recentlyUsedColumns: any;
    sortString: string;

    initialize(rootelem, params) {
        this.columns = [];
        this.visibleColumns = [];
        super.initialize(rootelem, params);
        this.isHorizontal = false;
        this.isSortable = true;
        this.isColMovable = true;
        this.hideAdaptColumnsWidth = true;

        let useHeaderMenu = this.showHeader;
        if (params) {
            useHeaderMenu = resolveToValue(params.useHeaderMenu, true);
        }
        if (useHeaderMenu) {
            this.header.controlClass.contextMenu = function (evt) {
                return menus.createTracklistColumnsMenu(this.headerItems, evt);
            }.bind(this);
        }

        this.contextMenu = menus.createTracklistMenu(this.container);
        this.localListen(this, 'touchend', uitools.touchDefaultItemAction);
        this.localListen(this, 'itemdblclick', uitools.defaultItemAction);
        this.localListen(this, 'itementer', uitools.defaultItemAction);

        this.localListen(this.container, 'focuschange', function () {
            this.raiseItemFocusChange(); // needed for correct art window updating in "selected" mode
        }.bind(this));

        if (this.fieldDefs)
            this._prepareSortColumns(this.getDefaultSortString());
    }

    cleanUpHeader() {
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
        }
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

    reSort(doForce?:boolean) {
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
        }
        else
            while ((idx < this.visibleColumns.length) && ((this.visibleColumns[idx].index < columnIdx) || (this.visibleColumns[idx].isGroupHeader)))
                idx++;
        return idx;
    }

    showColumn(columnIdx: number) {
        let newColumn = this.columns[columnIdx];
        if (!newColumn || newColumn.visible)
            return;
        newColumn.visible = true;
        let col = new Column(this, newColumn);
        col.index = columnIdx;

        // find the right place, where to insert visible column
        this.visibleColumns.splice(columnIdx, 0, col);
        if (this.headerItems) {
            this.setUpHeader(this.headerItems);
            this._refreshSortIndicators();
        }
    }

    hideColumn(columnVIdx: number) {
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
    }

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
    }

    storeColumns(defColumns?) {
        let res = [];
        defColumns = defColumns || this.columns;
        for (let i = 0; i < defColumns.length; i++) {
            let col = defColumns[i];
            let storedCol = {} as SortColumn;
            storedCol.visible = col.visible;
            storedCol.columnType = col.columnType;
            if (resolveToValue(col.disabled, false, this.container)) {
                storedCol.visible = !!col.wasVisible;
            }
            res.push(storedCol);
        }
        return res;
    }

    /**
    Sets list of columns as were shown (configured by user)

    @method restoreColumns
    @param {Array} Columns List of columns to restore
    @param {Boolean} ignoreNewColumns Ignore new columns and add just these defined in columns variable
    */
    restoreColumns(columns, ignoreNewColumns?:boolean) {
        let myColumns = [];
        let usedColumnTypes = {};

        let handleDisabledColumn = function (defCol, newCol) {
            if (resolveToValue(defCol.disabled, false, this.container)) {
                newCol.wasVisible = newCol.visible; // store last visibility state so we can set it correctly in storeColumns
                newCol.visible = false; // this column is disabled in current view ... make it hidden
            }
            return newCol;
        }.bind(this);

        let copyDefToColumn = function (newCol, defCol) {
            for (let key in defCol)
                if (key != 'adaptableSize' && key != 'visible')
                    newCol[key] = defCol[key];

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
                    let newCol = {
                        columnType: colType
                    };
                    copyDefToColumn(newCol, defCol);
                    myColumns.push(handleDisabledColumn(defCol, newCol));
                }
            }
        }
        this.setColumns(myColumns);
    }

    setUpDiv(div) {
        if (!this.useTemplate)
            this.useTemplate = 'videoGrid';
        templates.imageItem(div, templates.imageItemsParams[this.useTemplate].call(this));
    }

    setUpHeader(header) {
        this.cleanUpHeader();
        cleanElement(header);
        header.classList.add('flex');
        header.classList.add('row');

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

        let createColumn = function (column, i) {
            if (column.isSortable === undefined)
                column.isSortable = this.isSortable;
            let contdiv = document.createElement('div');
            let sortdiv = document.createElement('div');
            let div = document.createElement('div') as CustomElement;
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

            div.style.flexBasis = 'auto';
            div.className = 'lvHeaderItem flex row paddingSides';
            div.draggable = this.isColMovable && !column.fixed;
            column.headerDiv = div;
            if (this.isSortable && column.isSortable) {
                div.classList.add('clickable');
                app.listen(div, 'mouseup', function (e) {
                    if ((e.button !== 0))
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
                                    coldiv.sortdivNumber.innerText = ' ';
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
                        if (!addSort) {
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

                    if (this._dataSource)
                        this._dataSource.restoreFocusedItem(this._dataSource.focusedItem); // needed because of #17299

                    this.reSort(true);
                }.bind(this));
            }
            if (this.isColMovable) {
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

                app.listen(div, 'dragend', function (/*e*/) {
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
            div.appendChild(sortdivNumber);
            div.contdiv = contdiv;
            div.sortdiv = sortdiv;
            div.sortdivNumber = sortdivNumber;
            header.appendChild(div);
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

    _prepareSortColumns(sortStr) {
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

    setSortColumns(sortString) {
        this._prepareSortColumns(sortString);
        this.reSort();
        this._refreshSortIndicators();
    }

    moveColumn(oldVIdx, newVIdx) {
        if (oldVIdx === newVIdx)
            return;

        // first move column to the new place in both arrays
        let toLast = false;
        if (newVIdx >= this.visibleColumns.length) {
            newVIdx = this.visibleColumns.length - 1;
            toLast = true;
        }
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
            if (this.columns[i].visible) {
                this.visibleColumns[vIdx].index = i;
                if (this.visibleColumns[vIdx].headerDiv) {
                    this.visibleColumns[vIdx].headerDiv.style.order = vIdx.toString();
                    updateFirstColFlag(this.visibleColumns[vIdx].headerDiv, !firstSet);
                    firstSet = true;
                }
                vIdx++;
            }
        }
    }

    formatStatus(data) {
        return statusbarFormatters.formatTracklistStatus(data);
    }

    getDefaultColumns() {
        let col = nodeUtils.getNodeCollection(this.parentView.viewNode);
        let defCols = undefined;
        if (col) {
            let coltype = col.getType();
            if (coltype == 'videopodcast')
                defCols = ['title', 'podcast', 'artist', 'date', 'genre', 'rating', 'length', 'path', 'filename'];
            else
            if (coltype == 'musicvideo')
                defCols = ['title', 'artist', 'album', 'date', 'genre', 'rating', 'length', 'path', 'filename'];
            else
            if (coltype == 'video')
                defCols = ['title', 'director', 'series', 'date', 'genre', 'rating', 'length', 'path', 'filename'];
            else
            if (coltype == 'tv')
                defCols = ['title', 'series', 'season', 'episode', 'date', 'genre', 'rating', 'length', 'path', 'filename'];
        }
        if (!defCols)
            defCols = ['title', 'director', 'series', 'date', 'genre', 'rating', 'length', 'path', 'filename'];

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

    storeState() {
        let state = super.storeState();
        if (this.dataSource && this.autoSortSupported && this.dataSource.setAutoSortAsync) {
            if (uitools.storeColumnsSupported(this.parentView))
                state.sortString = this.dataSource.autoSortString;
        }
        return state;
    }

    restoreState(state) {
        super.restoreState(state);
        let str = state.sortString;
        if (str && this.autoSortSupported) {
            this.setSortColumns(str);
        }
    }

    storePersistentState(state) {
        if (!this.disableStateStoring) {
            state.allColumns = this.storeColumns();
            if (this.autoSortSupported && uitools.storeColumnsSupported(this.parentView))
                state.sortString = this.sortString;
            state.recentlyUsedColumns = this.recentlyUsedColumns;
        }
        return state;
    }

    restorePersistentState(state) {
        if (this.disableStateStoring)
            state = {};

        if (state.recentlyUsedColumns)
            this.recentlyUsedColumns = state.recentlyUsedColumns;
        if (!state.allColumns || (state.allColumns.length === 0)) {
            let defState = this.getDefaultPersistentState();
            state.allColumns = defState.allColumns;
        }
        if (state.allColumns && (state.allColumns.length > 0))
            this.restoreColumns(state.allColumns);
        if (this.autoSortSupported) {
            if (uitools.storeColumnsSupported(this.parentView)) {
                if (state.sortString)
                    this.setSortColumns(state.sortString);
            } else {
                let sortString = window.uitools.getDefaultColumnSort(this.parentView);
                if (sortString) {
                    this.getDefaultSortString = function () {
                        return sortString;
                    };
                    this.setSortColumns(sortString);
                }
            }
        }
        this.setViewportSize(this.getViewportSize(), 0); // to reset the vertical scroll (when this control was in controlCache and used for new dataSource)
    }

    cleanUp() {
        this.cleanUpHeader();
        super.cleanUp();
    }

    
    get fieldGroups () {
        if (this._fieldGroups === undefined)
            this._fieldGroups = uitools.tracklistFieldGroups;
        return this._fieldGroups;
    }

    get fieldDefs () {
        if (this._fieldDefs === undefined) {
            this._fieldDefs = {};
            for (let f in uitools.tracklistFieldDefs) {
                this.fieldDefs[f] = copyObject(uitools.tracklistFieldDefs[f]);
                this.fieldDefs[f].columnType = f;
            }
        }
        return this._fieldDefs;
    }
    set fieldDefs (value) {
        this._fieldDefs = value;
    }
    
}
registerClass(VideoGrid);

VideoGrid.prototype.headerRenderers = {
    renderDefault: function (div, column) {
        div.innerText = resolveToValue(column.title, '', column.listview);
        if (column.align === 'right')
            div.style.textAlign = 'right';
    }
};
