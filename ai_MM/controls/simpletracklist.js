/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

registerFileImport('controls/simpleTracklist');
'use strict';
/**
@module UI
*/
import Control from './control';
import TrackListView from './trackListView';
/**
Simple columnless tracklist UI element

@class SimpleTracklist
@constructor
@extends TrackListView
*/
class SimpleTracklist extends TrackListView {
    initialize(rootelem, params) {
        this._columnsMethod = window.templates.simpleTracklistSortMethods;
        let handler = undefined;
        if (params) {
            handler = params.view;
            this.hideArtists = params.hideArtists; // have to be set before header creation
            if (params.columnsMethod) {
                this._columnsMethod = params.columnsMethod;
                delete params.columnsMethod; // to avoid reinitializing in parents' initialize functions
            }
        }
        this._sortMethods = this._columnsMethod(handler, this.hideArtists).oneRow.rows[0];
        for (let i = 0; i < this._sortMethods.length; i++) {
            if (this._sortMethods[i].sortString !== undefined) {
                this.sortString = this._sortMethods[i].sortString;
                break;
            }
        }
        this._displayMode = 'oneRow';
        super.initialize(rootelem, params);
        this.statusParams = {};
        this.canScrollHoriz = false; // Horizontal scrollbar is disabled here.        
        this.enableDragNDrop();
        this.showHeader = true;
        this.lassoSelectionEnabled = true;
        this.isSearchable = true;
        this.editSupported = false;
        this.disabledSelectionIconsPositionHandling = true; // no need, selection icons are simply aligned to the right
        this.container.style.minHeight = '3.5em';
        this.updateListClasses();
        this.setUpHeader(this.headerItems);
        this.helpContext = 'Filelisting';
        this.registerEventHandler('datasourcechanged');
        if (params && (params.autoSortString !== undefined)) { // needed resort, columns were not prepared during assigning autoSortString
            this.setSortColumns(params.autoSortString);
        }
        this.container.classList.add('simpletracklist');
    }
    cleanUp() {
        super.cleanUp();
        uitools.cleanUpSaveButton(this.dataSource);
        this.unregisterEventHandler('datasourcechanged');
        this.headerDivs = undefined;
    }
    handle_datasourcechanged(e) {
        if (e.detail.newDataSource) {
            this.sortString = e.detail.newDataSource.autoSortString;
        }
        else {
            uitools.cleanUpSaveButton();
        }
        this.setUpHeader(this.headerItems);
        this._refreshSortIndicators();
    }
    setUpDiv(div) {
        window.templates.simpleTracklistItem(div, this.hideArtists);
    }
    bindData(div, index, item) {
        if (this.bindFn)
            this.bindFn(div, item);
    }
    updateListClasses() {
        this.container.classList.toggle('multirow', (this._displayMode === 'multiRow'));
        this.container.classList.toggle('onerow', (this._displayMode !== 'multiRow'));
        this.container.classList.toggle('fixedcols', (this._displayMode === 'fixedWidthRow'));
    }
    resizeDivs(w, h) {
        let ret = super.resizeDivs(w, h);
        // Find the first div and update based on its content
        for (let i = 0; i < this.divs.length; i++) {
            let div = this.divs[i];
            if (div) {
                if (div.classList.contains('rowHeight2line')) {
                    if (this._displayMode !== 'multiRow') {
                        // was changed to multi-line
                        this._displayMode = 'multiRow';
                        this.updateListClasses();
                        this.setUpHeader(this.headerItems);
                    }
                }
                else {
                    if (div.classList.contains('fixedWidthColumns')) {
                        if (this._displayMode !== 'fixedWidthRow') {
                            // was changed to single-line with fixed columns
                            this._displayMode = 'fixedWidthRow';
                            this.updateListClasses();
                            this.setUpHeader(this.headerItems);
                        }
                    }
                    else {
                        if (this._displayMode !== 'oneRow') {
                            // was changed to single-line without fixed columns
                            this._displayMode = 'oneRow';
                            this.updateListClasses();
                            this.setUpHeader(this.headerItems);
                        }
                    }
                }
                break;
            }
        }
        return ret;
    }
    requiredWidth() {
        return undefined;
    }
    setUpHeader(header) {
        //let view = this.parentView;
        let canSort = this.isSortable;
        let addFillDiv = function () {
            // This additional element is here only to fill the rest of header in case it's narrower than the whole listview.
            let div = document.createElement('div');
            div.style.order = '9999999';
            div.style.minWidth = getScrollbarWidth() + 'px'; // So that this div can be drawn above a scrollbar
            div.style.alignItems = 'flex-start';
            div.className = 'lvHeaderFillRest fill flex column';
            header.appendChild(div);
            this._headerFillPaddingSet = false;
            this.headerFill = div;
        }.bind(this);
        /*if (this.headerSet)
            return;*/
        let headerInfo = null;
        headerInfo = this._columnsMethod(this.parentView, this.hideArtists)[this._displayMode];
        if (headerInfo.style)
            header.style.cssText = headerInfo.style;
        this.headerSet = true;
        header.classList.add('flex');
        header.classList.add('row');
        header.classList.add('lvSimpleHeader');
        cleanElement(header, true);
        header.controlClass = header.controlClass || new Control(header);
        let _this = this;
        /*if (!header.controlClass._addedMenu) {
            header.controlClass._addedMenu = true;
            header.controlClass.addToContextMenu([{
                action: {
                    title: _('Reset Sorting'),
                    execute: function () {
                        _this.autoSortString = _this.getDefaultSortString();
                    }
                },
                order: 30,
                grouporder: 10
            }]);
        };*/
        addFillDiv();
        this.headerDivs = [];
        let fillHeader = function (_sortMethods) {
            let headerRow = document.createElement('div');
            headerRow.className = 'fill flex row';
            headerRow.style.width = '100%';
            this.headerFill.appendChild(headerRow);
            let leftDiv = document.createElement('div');
            leftDiv.className = 'lvHeaderItem lvSimpleHeader flex row';
            headerRow.appendChild(leftDiv);
            let rightDiv = document.createElement('div');
            rightDiv.className = 'lvHeaderItem lvSimpleHeader lvSimpleHeaderRightAligned flex row fill';
            rightDiv.style.order = '999'; // to be the last item
            leftDiv.appendChild(rightDiv);
            _sortMethods.forEach(function (sortMethod) {
                let div = document.createElement('div');
                if (sortMethod.style)
                    div.style.cssText = sortMethod.style;
                if (sortMethod.class)
                    div.classList.add(sortMethod.class); //@ts-ignore
                div.sortMethod = sortMethod;
                this.headerDivs.push(div);
                let contentDiv = document.createElement('div');
                contentDiv.innerHTML = sortMethod.title;
                div.appendChild(contentDiv);
                let sortdiv = undefined;
                if (sortMethod.columnType !== undefined && canSort) {
                    sortdiv = document.createElement('div');
                    sortdiv.className = 'lvHeaderSort';
                    loadIcon('downArrow', function (iconData) {
                        sortdiv.innerHTML = iconData;
                    }.bind(this));
                    div.classList.add('flex');
                    div.classList.add('row');
                    div.classList.add('clickable');
                    //@ts-ignore
                    div.sortdiv = sortdiv;
                    div.appendChild(sortdiv);
                    let sortdivNumber = document.createElement('label');
                    sortdivNumber.className = 'lvHeaderSortLabel';
                    sortdivNumber.style.order = '3'; //@ts-ignore
                    div.sortdivNumber = sortdivNumber;
                    div.appendChild(sortdivNumber);
                    if ((this.autoSortString === sortMethod.sortString) ||
                        (this.autoSortString === sortMethod.sortStringDesc)) {
                        this._lastSortDiv = div;
                    }
                    this.localListen(div, 'click', function (e) {
                        let addSort = e.ctrlKey;
                        let sortIdx = undefined;
                        if (this.sortColumns) {
                            for (let i = 0; i < this.sortColumns.length; i++) {
                                if (this.sortColumns[i].sortMethod == sortMethod) {
                                    if (this.sortColumns[i].direction === 'ASC') {
                                        this.sortColumns[i].direction = 'DESC';
                                    }
                                    else {
                                        this.sortColumns[i].direction = 'ASC';
                                    }
                                    sortIdx = i;
                                    break;
                                }
                            }
                        }
                        if (sortIdx === undefined) {
                            let sortobj = {
                                sortMethod: sortMethod,
                                columnType: resolveToValue(sortMethod.columnType, ''),
                                title: resolveToValue(sortMethod.title, ''),
                                direction: resolveToValue(sortMethod.direction, 'ASC')
                            };
                            if (addSort)
                                this.sortColumns.push(sortobj);
                            else
                                this.sortColumns = [sortobj];
                        }
                        else {
                            if (!addSort) {
                                let sortobj = this.sortColumns[sortIdx];
                                this.sortColumns = [sortobj];
                            }
                        }
                        // show/hide save button (if required)
                        if ( /*!window.currentTabControl._saveOrderButton &&*/!this.showSaveCalled && uitools.saveButtonSupported(this.parentView)) {
                            let handler = getNodeHandler(this.parentView);
                            let newSortString = this.getUpdatedSortString();
                            let defSortStr = '';
                            if (handler && handler.defaultColumnSort)
                                defSortStr = handler.defaultColumnSort;
                            if ((newSortString !== defSortStr + ' ASC') && (newSortString !== defSortStr)) { // TODO: support more complex sort string
                                // new sortstring is different than default sortstring - show save button
                                this.showSaveCalled = true;
                                uitools.showSaveButtonAsync(this.parentView, this.dataSource).then(function (btn) {
                                    if (window.currentTabControl && window.currentTabControl._saveOrderButton) {
                                        this.localListen(window.currentTabControl._saveOrderButton, 'click', function () {
                                            window.currentTabControl._saveOrderButton = undefined;
                                        }.bind(this));
                                    }
                                    this.showSaveCalled = undefined;
                                }.bind(this));
                            }
                            else {
                                uitools.cleanUpSaveButton(null);
                            }
                        }
                        this._refreshSortIndicators();
                        this.reSort();
                        //this.sortString = newSortString;
                        this._lastSortDiv = div;
                    }.bind(this));
                }
                if (sortMethod.position === 'right') {
                    rightDiv.appendChild(div);
                    /*if(sortdiv)
                        rightDiv.appendChild(sortdiv);*/
                }
                else {
                    leftDiv.appendChild(div);
                    /*if(sortdiv)
                        leftDiv.appendChild(sortdiv);*/
                }
            }.bind(this));
        }.bind(this);
        headerInfo.rows.forEach(function (row) {
            fillHeader(row);
        });
        this._refreshSortIndicators();
    }
    getUpdatedSortString() {
        if (!this.sortColumns || !this.dataSource || !this.sortColumns.length)
            return '';
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
    reSort() {
        let sorttxt = this.getUpdatedSortString();
        if (sorttxt) {
            if (this.autoSortSupported && this.dataSource.setAutoSortAsync) {
                this.autoSortString = sorttxt;
                let view = this.parentView;
                if (view) {
                    if (!resolveToValue(view.nodehandler.canSaveNewOrder, true, view.viewNode)) { // auto-playlist sorted ... disable auto refresh of this list so current sort persist
                        this.dataSource.autoUpdateDisabled = true;
                    }
                }
            }
        }
    }
    _prepareSortColumns(sortStr) {
        let getMethod = function (columnType) {
            for (let i = 0; i < this.headerDivs.length; i++) {
                let div = this.headerDivs[i];
                if (div.sortMethod.columnType == columnType) {
                    return div.sortMethod;
                }
            }
            return null;
        }.bind(this);
        this.sortColumns = [];
        let list = sortStr.split(';');
        list.forEach(function (item) {
            let columnName = '';
            let columnDirection = 'ASC';
            let columnInfo = item.split(' ');
            if (columnInfo.length > 1)
                columnDirection = columnInfo[1];
            columnName = columnInfo[0];
            let sortMethod = getMethod(columnName);
            if (sortMethod) {
                let sortobj = {
                    sortMethod: sortMethod,
                    columnType: resolveToValue(sortMethod.columnType, ''),
                    title: resolveToValue(sortMethod.title, ''),
                    direction: resolveToValue(columnDirection, 'ASC')
                };
                this.sortColumns.push(sortobj);
            }
            else {
                // probably hidden column
                let sortobj = {
                    sortMethod: {
                        columnType: columnName,
                        title: ''
                    },
                    columnType: columnName,
                    title: '',
                    direction: resolveToValue(columnDirection, 'ASC')
                };
                this.sortColumns.push(sortobj);
            }
        }.bind(this));
    }
    _refreshSortIndicators() {
        if (!this.headerDivs || !this.sortColumns)
            return;
        let getSortColumn = function (columnType) {
            for (let i = 0; i < this.sortColumns.length; i++) {
                let sortobj = this.sortColumns[i];
                if (sortobj.columnType === columnType) {
                    sortobj.order = i;
                    return sortobj;
                }
            }
            return undefined;
        }.bind(this);
        for (let i = 0; i < this.headerDivs.length; i++) {
            let coldiv = this.headerDivs[i];
            let sortobj = getSortColumn(coldiv.sortMethod.columnType);
            if (sortobj) {
                if (sortobj.direction === 'ASC') {
                    coldiv.sortdiv.removeAttribute('data-sortDesc');
                    coldiv.sortdiv.setAttribute('data-sortAsc', 1);
                }
                else {
                    coldiv.sortdiv.removeAttribute('data-sortAsc');
                    coldiv.sortdiv.setAttribute('data-sortDesc', 1);
                }
                if (this.sortColumns.length > 1) {
                    coldiv.setAttribute('data-sort-label', '1');
                    coldiv.sortdivNumber.innerText = sortobj.order + 1;
                }
                else {
                    coldiv.removeAttribute('data-sort-label');
                    coldiv.sortdivNumber.innerText = '';
                }
            }
            else {
                if (coldiv.sortdiv) {
                    coldiv.sortdiv.removeAttribute('data-sortAsc');
                    coldiv.sortdiv.removeAttribute('data-sortDesc');
                }
                coldiv.removeAttribute('data-sort-label');
                if (coldiv.sortdivNumber)
                    coldiv.sortdivNumber.innerText = '';
            }
        }
    }
    forceAutoSort() {
        // added because of correct sort indicators update
        this._refreshSortIndicators();
        return super.forceAutoSort();
    }
    storeState() {
        let state = {};
        if (uitools.storeColumnsSupported(this.parentView))
            state.sortString = this.sortString;
        return state;
    }
    restoreState(state) {
        if (uitools.storeColumnsSupported(this.parentView))
            if (state.sortString) {
                this.setSortColumns(state.sortString);
                this._refreshSortIndicators();
            }
    }
    storePersistentState() {
        return this.storeState();
    }
    restorePersistentState(state) {
        this.restoreState(state);
    }
    markFocused(div, focused) {
        if (div.hasAttribute('data-focused') !== focused)
            div.forceRebind = true;
        if (focused) {
            div.setAttribute('data-focused', '1');
            if (this.focusVisible)
                div.setAttribute('data-keyfocused', '1');
        }
        else {
            div.removeAttribute('data-focused');
            div.removeAttribute('data-keyfocused');
        }
    }
    get columnsMethod() {
        return this._columnsMethod;
    }
    set columnsMethod(value) {
        this._columnsMethod = value;
        this.invalidateAll();
        this.setUpHeader(this.headerItems);
    }
}
registerClass(SimpleTracklist);
