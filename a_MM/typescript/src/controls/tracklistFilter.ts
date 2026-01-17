'use strict';

registerFileImport('controls/tracklistFilter');

import { MenuItem } from '../actions';
import { DRAG_HEADERITEM } from '../consts';
import Control, { ControlState } from './control';
import ListView from './listview';
import { Fields } from './trackListView';

/**
@module UI Snippets
*/

/**
Tracklist filter.

@class TracklistFilter
@constructor
@extends Control
*/

const MAX_MRU_COLUMNS = 8;


class TracklistFilter extends Control {
    maxColumns: number;
    minColumns: number;
    _dynamicSize: boolean;
    defaultNewColumns: string[];
    recentlyUsedColumns: any[];
    promisesFilters: any[];
    promisesTracks: any[];
    unlistenDS: any[];
    filters: string[];
    private _lastPrepareFilterTime: number;
    doLoadSelection: boolean;
    filterLV: CustomElementWith<ListView>[];
    taskNumbers: number[];
    alltracks: Tracklist;
    _changeHandlerSet: boolean;
    mainDiv: HTMLElement;
    sett: ControlState;
    initFilterSizes: boolean;
    loadingSelection: boolean;
    getSelectedPromise: Promise<StringList>;
    tracks: Tracklist;
    filteredTracks: Tracklist;
    used: boolean[];
    cancelLoadingSelection: procedure;
    _dblClicked: boolean;
    splitters: any;
    _draggedLV: number;
    ds: StringList;
    _lvPositions: number[];
    private _lastOverLV: CustomElementWith<ListView>;
    private _lastOverLV2: CustomElementWith<ListView>;
    level: number;

    initialize(rootelem, params) {
        super.initialize(rootelem, params);

        this.maxColumns = 8;
        this.minColumns = 2;
        this._dynamicSize = (params && params.dynamicSize);
        this.defaultNewColumns = ['G', 'A', 'L', 'ZR', 'ZP', 'ZZB', 'ZL', 'ZT']; // GENRE, ARTIST, ALBUM, RATING, DATE, ACTORS, QUALITY, DATEADDED        
        this.recentlyUsedColumns = [];
        this.helpContext = 'Filelisting';

        this.promisesFilters = [];
        this.promisesTracks = [];
        this.unlistenDS = [];
        this.filters = ['G', 'A', 'L']; // default Genre, Artist, Album
        this._lastPrepareFilterTime = 0;
        this._refreshUI();
    }

    stopCalc() {
        // Terminate all running tasks
        for (let level = 0; level < this.filters.length; level++) {
            this.taskNumbers[level]++;
            cancelPromise(this.promisesFilters[level]);
            cancelPromise(this.promisesTracks[level]);
        }
        if (this.getSelectedPromise) {
            cancelPromise(this.getSelectedPromise);
            this.getSelectedPromise = undefined;
        }
    }

    recalcAll() {
        this.stopCalc();
        this.prepareFilter(0, this.alltracks);
    }

    deferredRecalc() {
        let tm = Math.max(1000, this._lastPrepareFilterTime);
        this.requestTimeout(() => {
            this.recalcAll();
        }, tm, '_deferredRecalcAllTm');
    }

    addColumnToMRU(maskID) {
        if (maskID && (this.recentlyUsedColumns !== undefined)) {
            let ru = this.recentlyUsedColumns;
            let idx = ru.indexOf(maskID);
            if (idx >= 0) {
                ru.splice(idx, 1);
            }
            ru.unshift(maskID);
            if (ru.length > MAX_MRU_COLUMNS)
                ru.pop();
        }
    }

    cancelAll() {
        if (this.filters) {
            for (let level = 0; level < this.filters.length; level++) {
                cancelPromise(this.promisesFilters[level]);
                cancelPromise(this.promisesTracks[level]);
            }
        }
        this.promisesFilters = [];
        this.promisesTracks = [];
        this._dblClicked = false;
    }

    resetScrollbars() {
        let i = 0;
        while (this.filterLV[i]) {
            this.filterLV[i].controlClass.resetScrollbars();
            i++;
        }
    }

    cleanUp() {
        this.stopCalc();
        this.dataSource = null;
        this.filteredTracks = undefined;
        let lv;
        for (let level = 0; level < this.filterLV.length; level++) {
            lv = this.filterLV[level];
            lv.controlClass.cleanUp();
        }

        for (let level = 0; level < this.unlistenDS.length; level++) {
            if (this.unlistenDS[level])
                this.unlistenDS[level]();
        }
        this.unlistenDS = [];
        this.filterLV = undefined;
        this.splitters = undefined;
        super.cleanUp();
    }

    /**
    Notifies that there's a new filtered dataset ready.

    @event dataresult
    @param {MediaList} dataResult Filtered list.
    */
    notifyNewResult(filtered) {
        this.filteredTracks = filtered;
        this.raiseEvent('dataresult', {
            tracks: filtered,
            dblClicked: this._dblClicked
        });
        this._dblClicked = false;
    }

    setColumnWidths() {
        if (this.initFilterSizes && this.filterLV && this.filterLV.length) {
            for (let i = 0; i < this.filterLV.length; i++) {
                if (this.initFilterSizes[i]) {
                    this.filterLV[i].style.flexGrow = this.initFilterSizes[i];
                } else {
                    this.filterLV[i].style.flexGrow = this.initFilterSizes[0];
                }
            }
        }
        this.initFilterSizes = undefined; // initial set completed
    }

    // internal
    initializeUI() {
        if (this.mainDiv) {
            cleanElement(this.mainDiv);
        } else {
            this.mainDiv = document.createElement('div');
            this.mainDiv.className = 'flex row';
            if (!this._dynamicSize)
                this.mainDiv.classList.add('fill');
        }

        this.filterLV = [];
        this.splitters = [];
        this.sett = {};
        let _this = this;

        let _handleAddColumn = function () {
            if (_this.filters.length >= _this.maxColumns)
                return;
            _this.cancelAll();
            let idx = 0;
            let id;
            while (idx < _this.defaultNewColumns.length) {
                id = _this.defaultNewColumns[idx];
                if (!_this.used[id]) {
                    _this.used[id] = true;
                    _this.filters.push(id);
                    let initFlexgrow = '10';
                    if (_this.filterLV && _this.filterLV.length)
                        initFlexgrow = _this.filterLV[_this.filterLV.length - 1].style.flexGrow; // initial width take from the last column
                    _createNewColumn(_this.filters.length - 1, initFlexgrow);
                    initializeControls(_this.mainDiv); // initialize splitter
                    if (_this.sett.selNodes)
                        _this.sett.selNodes[_this.filters.length - 1] = [];
                    _this.recalcAll();
                    break;
                }
                idx++;
            }
        }.bind(this);

        let _handleRemoveColumn = function (action) {
            if (_this.filters.length <= _this.minColumns)
                return;
            _this.cancelAll();
            let i = action.lvIndex;
            _this.used[_this.filters[i]] = false;
            if (_this.sett.selNodes)
                _this.sett.selNodes[i] = [];

            cleanElement(_this.filterLV[i]);
            _this.mainDiv.removeChild(_this.filterLV[i]);
            let sIdx = Math.max(i, 1);
            cleanElement(_this.splitters[sIdx]);
            _this.mainDiv.removeChild(_this.splitters[sIdx]);
            _this.splitters.splice(sIdx, 1);
            for (let idx = i; idx < _this.filters.length - 1; idx++) {
                _this.filterLV[idx] = _this.filterLV[idx + 1];
                _this.filterLV[idx].filterIdx = idx;
                _this.filters[idx] = _this.filters[idx + 1];
            }
            _this.filters.pop();
            _this.filterLV.pop();
            notifyLayoutChangeDown(_this.mainDiv);
            _this.recalcAll();
        }.bind(this);

        let clearDropAttributes = function (param) {
            if (_this[param]) {
                _this[param].removeAttribute('data-dropbefore');
                _this[param].removeAttribute('data-dropafter');
                _this[param] = undefined;
            }
        };

        let lvDragoverHandler = function (e) {
            if (_this._draggedLV === undefined) return;
            e.dataTransfer.dropEffect = 'move';
            e.preventDefault();
            let idx = _this._lvPositions.length - 1;
            for (let i = 1; i < _this._lvPositions.length; i++) {
                if (e.clientX < _this._lvPositions[i]) {
                    idx = i - 1;
                    break;
                }
            }
            let div1 = _this.filterLV[idx];
            let div2 = undefined;
            let div2idx = idx;
            let halfX = _this._lvPositions[idx] + div1.offsetWidth / 2;
            let newOverDiv2 = undefined;
            if (e.clientX <= halfX) {
                div2 = div1;
                if (idx > 0)
                    div1 = _this.filterLV[idx - 1];
                else
                    div1 = undefined;
                newOverDiv2 = div1;
            } else {
                div2idx = idx + 1;
                if (idx < _this._lvPositions.length - 1)
                    div2 = _this.filterLV[idx + 1];
                newOverDiv2 = div2;
            }
            if (div1) {
                div1.removeAttribute('data-dropbefore');
                div1.setAttribute('data-dropafter', '1');
            }
            if (div2) {
                div2.removeAttribute('data-dropafter');
                div2.setAttribute('data-dropbefore', '1');
            }
            if (_this._lastOverLV && (_this._lastOverLV != div1) && (_this._lastOverLV != div2)) {
                clearDropAttributes('_lastOverLV');
            }
            if (_this._lastOverLV2 && (_this._lastOverLV2 != div1) && (_this._lastOverLV2 != div2)) {
                clearDropAttributes('_lastOverLV2');
            }
            _this._lastOverLV2 = newOverDiv2;
            _this._lastOverLV = _this.filterLV[idx];
        };

        let lvLeaveHandler = function (e) {
            if (_this._draggedLV === undefined) return;
            if (!isInElement(e.clientX, e.clientY, _this.container)) {
                clearDropAttributes('_lastOverLV');
                clearDropAttributes('_lastOverLV2');
            }
        };

        function arrayMove(arr, fromIndex, toIndex) {
            arr.splice(toIndex, 0, arr.splice(fromIndex, 1)[0]);
        }

        let moveLV = function (oldLVIdx, newLVIdx) {
            if (oldLVIdx === newLVIdx)
                return;
            _this.cancelAll();

            arrayMove(_this.filters, oldLVIdx, newLVIdx);
            arrayMove(_this.filterLV, oldLVIdx, newLVIdx);
            forEach(_this.filterLV, function (lv, idx) {
                lv.filterIdx = idx;
                lv.style.order = String((idx * 2) + 1);
            });
            notifyLayoutChangeDown(_this.mainDiv);
            _this.recalcAll();
        };

        let _createNewColumn = function (i: number, initialFlexGrow: string) {
            initialFlexGrow = initialFlexGrow || '10';

            // first prepare div for splitter
            if (i > 0) {
                let splitter = document.createElement('div');
                splitter.setAttribute('data-control-class', 'Splitter');
                splitter.setAttribute('data-init-params', '{sortSiblingsByOrder: true}'); // needed to correctly split after changing order
                splitter.style.order = (i * 2).toString();
                _this.mainDiv.appendChild(splitter);
                _this.splitters[i] = splitter;
            }

            let lv = document.createElement('div') as CustomElementWith<ListView>;
            lv.className = 'fill';
            if (this.filters[i] === 'ZR')
                lv.setAttribute('data-control-class', 'RatingListView');
            else if (this.filters[i] === 'ZZI')
                lv.setAttribute('data-control-class', 'SourceIconListView');
            else
                lv.setAttribute('data-control-class', 'StringListView');
            lv.setAttribute('data-id', 'filter_' + this.filters[i]);
            lv.style.minWidth = '3em';
            lv.style.flexGrow = initialFlexGrow;
            _this.filterLV[i] = lv;
            _this.mainDiv.appendChild(lv);
            initializeControl(lv);
            lv.controlClass.showHeader = true;
            lv.controlClass.reportStatus = false;
            lv.controlClass.dynamicSize = _this._dynamicSize;
            lv.controlClass.hasMediaContent = true;
            lv.controlClass.enableIncrementalSearch = true;
            lv.controlClass.excludeFromGlobalContextualSearch = true;
            lv.controlClass.headerTitle = app.masks.getVisName('%' + this.filters[i]);
            lv.filterIdx = i;
            lv.style.order = ((i * 2) + 1).toString();
            lv.draggable = true;
            lv.controlClass.contextMenu = menus.createTracklistMenu(lv);
            // @ts-ignore
            lv.controlClass.getTracklist = function () {
                return _this.filteredTracks;
            };

            lv.controlClass.localListen(lv, 'dragstart', function (e) {
                dnd.initializeDragEvent(e);
                app.listen(_this.container, 'dragover', lvDragoverHandler);
                app.listen(_this.container, 'dragleave', lvLeaveHandler);
                lv.dragging = true;
                lv.setAttribute('data-dragging', '1');
                _this._lvPositions = [];
                for (let i = 0; i < _this.filterLV.length; i++) {
                    _this._lvPositions[i] = _this.filterLV[i].getBoundingClientRect().left;
                }         
                _this._draggedLV = lv.filterIdx;
                e.dataTransfer.setUserData(DRAG_HEADERITEM, 'listview');
            }, false);

            lv.controlClass.localListen(lv, 'dragend', function (e) {
                lv.dragging = false;
                lv.removeAttribute('data-dragging');

                if (_this._lastOverLV) {
                    if (_this._lastOverLV.hasAttribute('data-dropbefore') || (_this._lastOverLV.filterIdx >= _this._draggedLV)) {
                        moveLV(_this._draggedLV, Number(_this._lastOverLV.filterIdx));
                    } else {
                        moveLV(_this._draggedLV, Number(_this._lastOverLV.filterIdx) + 1);
                    }
                }
                clearDropAttributes('_lastOverLV');
                clearDropAttributes('_lastOverLV2');

                _this._draggedLV = undefined;
                app.unlisten(_this.container, 'dragover');
                app.unlisten(_this.container, 'dragleave');
                dnd.finishedDragNDrop();
                dnd.notifyDragFinished();
            }.bind(this), false);

            lv.controlClass.localListen(lv, 'itemdblclick', function (e) {
                _this._dblClicked = true; // processed after loading tracklist
            });

            let _handleChooseColumn = function () {
                let action = this;
                let lastColID = _this.filters[action.lvIndex];
                if (action.colID === lastColID)
                    return; // no change
                let lv = _this.filterLV[action.lvIndex];
                if ((action.colID === 'ZR') || (lastColID === 'ZR') || (action.colID === 'ZZI') || (lastColID === 'ZZI')) {
                    cleanElement(lv);
                    if (action.colID === 'ZR')
                        lv.setAttribute('data-control-class', 'RatingListView');
                    else if (action.colID === 'ZZI')
                        lv.setAttribute('data-control-class', 'SourceIconListView');
                    else
                        lv.setAttribute('data-control-class', 'StringListView');
                    initializeControl(lv);
                    lv.controlClass.showHeader = true;
                    lv.controlClass.headerContextMenu = new Menu(_generateLVMenu);
                }
                _this.used[lastColID] = false;
                _this.used[action.colID] = true;
                if (_this.sett.selNodes)
                    _this.sett.selNodes[action.lvIndex] = [];

                _this.filters[action.lvIndex] = action.colID;
                lv.controlClass.headerTitle = resolveToValue(action.title, '');

                // save as recently used
                if (action.colID) {
                    _this.addColumnToMRU(action.colID);
                }

                _this.recalcAll();
            };

            let _generateLVMenu = function () {
                let presetColumns : MenuItem[] = [{
                    action: {
                        title: _('Set same widths'),
                        execute: function () {
                            forEach(_this.filterLV, function (lv) {
                                if (lv)
                                    lv.style.flexGrow = '10';
                            });
                            notifyLayoutChangeDown(_this.mainDiv);
                        },
                        visible: (_this.filters.length > 1)
                    },
                    grouporder: 80
                },
                {
                    action: {
                        title: _('Add Column'),
                        execute: _handleAddColumn,
                        disabled: (_this.filters.length >= _this.maxColumns),
                        lvIndex: this.filterIdx
                    },
                    grouporder: 10
                },
                {
                    action: {
                        title: _('Remove Column'),
                        execute: function () {
                            _handleRemoveColumn(this);
                        },
                        disabled: (_this.filters.length <= _this.minColumns),
                        lvIndex: this.filterIdx
                    },
                    grouporder: 10
                }];

                // prepare helper object for columns with defined mask and saving "used" flag
                let tmpColumns = {};
                let colSort = [];
                for (let columnType in uitools.tracklistFieldDefs) {
                    let col = uitools.tracklistFieldDefs[columnType];
                    if (col.mask && (!_this.used[col.mask]) || (col.mask === _this.filters[this.filterIdx])) {
                        tmpColumns[columnType] = {
                            col: col,
                            title: resolveToValue(col.title, '')
                        };
                        colSort.push(tmpColumns[columnType]);
                    }
                }

                // prepare sorting indexes for easier filling of "order" numbers
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

                let ru = _this.recentlyUsedColumns || [];
                let ruorder;
                let ruUsed = {};

                let getSubmenuItems = function (fields: Fields, isRoot?: boolean) {
                    let retval : MenuItem[] = isRoot ? presetColumns : []; // root items insert directly to presetColumns, so we will not need to move them here later
                    let so = 1;
                    let recentlyTitle = _('Recently used');
                    let allFieldsTitle = _('All fields');

                    forEach(fields, (itm) => {
                        if (isString(itm)) {
                            let colInfo = tmpColumns[itm];
                            if (colInfo) {
                                let c = colInfo.col;
                                retval.push({
                                    action: {
                                        title: c.title,
                                        execute: _handleChooseColumn,
                                        lvIndex: this.filterIdx,
                                        checked: (c.mask === _this.filters[this.filterIdx]),
                                        checkable: (c.mask === _this.filters[this.filterIdx]),
                                        colID: c.mask
                                    },
                                    order: colInfo.order,
                                    grouporder: isRoot ? 40 : 10,
                                    grouptitle: isRoot ? allFieldsTitle : undefined,
                                });
                                colInfo.used = true;
                                ruorder = ru.indexOf(c.mask) + 1;
                                if ((ruorder > 0) && (!ruUsed[c.mask])) {
                                    ruUsed[c.mask] = true;
                                    presetColumns.push({
                                        action: {
                                            title: c.title,
                                            execute: _handleChooseColumn,
                                            lvIndex: this.filterIdx,
                                            checked: (c.mask === _this.filters[this.filterIdx]),
                                            checkable: (c.mask === _this.filters[this.filterIdx]),
                                            colID: c.mask
                                        },
                                        grouporder: 30,
                                        grouptitle: recentlyTitle,
                                        order: 10 * ruorder
                                    });
                                }
                            }
                        } else if (isObjectLiteral(itm)) {
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
                        // add fields from fieldDefs not mentioned in fieldGroups to Other
                        let notUsedSubmenu = [];
                        for (let colType in tmpColumns) {
                            let colInfo = tmpColumns[colType];
                            let c = colInfo.col;
                            if (!colInfo.used && !c.fixed && !resolveToValue(c.disabled, false)) { // not used and will be visible
                                notUsedSubmenu.push({
                                    action: {
                                        title: c.title,
                                        execute: _handleChooseColumn,
                                        lvIndex: this.filterIdx,
                                        checked: (c.mask === _this.filters[this.filterIdx]),
                                        checkable: (c.mask === _this.filters[this.filterIdx]),
                                        colID: c.mask
                                    },
                                    order: colInfo.order,
                                    grouporder: 10
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
                }.bind(this);
                getSubmenuItems(uitools.tracklistFieldGroups, true /* root */ );
                return presetColumns;
            }.bind(lv);
            lv.controlClass.headerContextMenu = new Menu(_generateLVMenu);
        }.bind(this);

        _this.container.appendChild(_this.mainDiv);
        for (let i = 0; i < this.filters.length; i++) {
            _createNewColumn(i);
        }
        _this.setColumnWidths();
        initializeControls(_this.mainDiv);
        if (this.loadingSelection || this.doLoadSelection) {
            this.cancelLoadingSelection = function () {
                this.loadingSelection = false;
                this.doLoadSelection = false;
                let i = 0;
                while (this.filterLV[i]) {
                    app.unlisten(this.filterLV[i], 'mousedown', this.cancelLoadingSelection);
                    app.unlisten(this.filterLV[i], 'keydown', this.cancelLoadingSelection);
                    i++;
                }
                this.cancelLoadingSelection = undefined;
            }.bind(this);
            let i = 0;
            while (this.filterLV[i]) {
                app.listen(this.filterLV[i], 'mousedown', this.cancelLoadingSelection);
                app.listen(this.filterLV[i], 'keydown', this.cancelLoadingSelection);
                i++;
            }
        }
    }

    _refreshUI() {
        this.cancelAll();
        this.filterLV = [];
        this.taskNumbers = new Array(this.maxColumns);
        for (let i = 0; i < this.taskNumbers.length; i++)
            this.taskNumbers[i] = 0;
        this.used = [];
        for (let key in this.filters) {
            this.used[this.filters[key]] = true;
        }
        this.initializeUI();
        if (this.alltracks) // reset dataSource to load correctly filters
            this.dataSource = this.alltracks;
    }

    // internal: Handles any change in selection of a filter
    filterChange(ds: StringList, level: number, tracks: Tracklist) {
        let setTracks = function (trcks) {

            if (level + 1 == this.filters.length) {
                this.notifyNewResult(trcks);
                if (this.loadingSelection) {
                    if (this.cancelLoadingSelection)
                        this.cancelLoadingSelection();
                    else
                        this.loadingSelection = false;
                }
            } else {
                this.prepareFilter(level + 1, trcks);
            }

        }.bind(this);

        // Cancel any previously running task
        cancelPromise(this.getSelectedPromise);

        // Is the first 'All' item selected?
        this.getSelectedPromise = ds.getSelectedList().whenLoaded();
        this.getSelectedPromise.then(function (selList) {
            this.getSelectedPromise = undefined;
            let all = false;
            ds.locked(function () {
                if (ds.isSelected(0) || selList.count == 0) {
                    all = true;
                }
            }.bind(this));

            // Cancel any previously running task
            cancelPromise(this.promisesTracks[level]);

            if (all) {
                ds.focusedIndex = 0;
                if (selList.count == 0) {
                    ds.modifyAsync(function () {
                        ds.setSelected(0, true);
                    });
                    this.filterLV[level].controlClass.setItemFullyVisible(0, true);
                }
                if (level === 0) {
                    // make copy of the list, we need to separate visible list and given invisible (due to possible collision in change events)
                    this.promisesTracks[level] = new Promise(function (resolve, reject) {
                        let alltracks = app.utils.createTracklist(true /* mark as loaded */ );
                        alltracks.addList(tracks);
                        resolve(alltracks);
                    });
                    this.promisesTracks[level].then(function (alltracks) {
                        this.promisesTracks[level] = undefined;
                        setTracks(alltracks);
                    }.bind(this));
                } else
                    setTracks(tracks); // Use all tracks (unfiltered).
            } else {
                this.promisesTracks[level] = tracks.getFilteredTracks(this.filters[level], ds);
                this.promisesTracks[level].then(function (filtered) {
                    this.promisesTracks[level] = undefined;
                    setTracks(filtered);
                }.bind(this));
            }
        }.bind(this));
    }

    // internal
    _filterChange() {
        // @ts-ignore
        this.that.filterChange(this.ds, this.level, this.tracks);
    }

    // internal: Prepares one filter window content (e.g. gets all filtered Artists)
    prepareFilter(level, tracks) {
        let currentTask = ++this.taskNumbers[level];

        // Create a promise that delivers data for one filter
        cancelPromise(this.promisesFilters[level]);
        if (!tracks || !this.dataSource)
            return;
        let getValPromise = undefined;

        let startTm = Date.now();

        this.promisesFilters[level] = new Promise(function (resolve, reject) {
            let setDSPromise = undefined;
            getValPromise = tracks.getFilterValues(this.filters[level]);
            getValPromise.then(function (ds) {
                if (this.unlistenDS[level]) {
                    this.unlistenDS[level]();
                    this.unlistenDS[level] = undefined;
                }

                if (currentTask < this.taskNumbers[level]) {
                    resolve();
                    return; // This task is old, don't do anything
                }
                this.promisesFilters[level] = undefined;

                // The first line will show 'All' items
                ds.insert(0, _('All') + ' (' + ds.count + ' ' + app.masks.getVisName('%' + this.filters[level], ds.count) + ')');
                setDSPromise = this.filterLV[level].controlClass.setDataSourceSameView(ds, false); // set new DataSource with preserved selection, but do not force setting focusedIndex, it would lead to bug #15265
                setDSPromise.then(function (firstSelectedIdx) {
                    setDSPromise = undefined;
                    if (firstSelectedIdx === undefined)
                        firstSelectedIdx = -1;
                    let boundEvent = this._filterChange.bind({
                        ds: ds,
                        level: level,
                        tracks: tracks,
                        that: this
                    });
                    app.listen(ds, 'change', boundEvent);
                    this.unlistenDS[level] = function () {
                        app.unlisten(ds, 'change', boundEvent);
                    };

                    let calledCh = false;
                    if (this.loadingSelection) {
                        if (this.sett.LV && this.sett.LV[level]) {
                            this.filterLV[level].controlClass.restoreState(this.sett.LV[level]);
                        }
                        if (this.sett.selNodes && this.sett.selNodes[level]) {
                            calledCh = true;
                            ds.modifyAsync(function () {
                                if (!this.sett.selNodes || !this.sett.selNodes[level])
                                    return;

                                ds.beginUpdate();
                                for (let i = 0; i < this.sett.selNodes[level].length; i++) {
                                    if ((this.sett.selNodes[level][i] !== undefined) && (this.sett.selNodes[level][i] < ds.count)) {
                                        ds.setSelected(this.sett.selNodes[level][i], true);
                                        if (firstSelectedIdx < 0)
                                            firstSelectedIdx = this.sett.selNodes[level][i];
                                    }
                                }
                                ds.endUpdate();
                            }.bind(this));
                        }
                    }
                    if (!calledCh)
                        boundEvent();
                    if (firstSelectedIdx > -1) {
                        this.filterLV[level].controlClass.setItemFullyVisible(firstSelectedIdx, true);
                    }

                    if (level == 0)
                        this._lastPrepareFilterTime = Date.now() - startTm;
                    resolve();
                }.bind(this));
            }.bind(this), function () {
                // clean up on error(cancel)
                if (setDSPromise) {
                    cancelPromise(setDSPromise);
                    setDSPromise = undefined;
                }

                if (this.unlistenDS[level]) {
                    this.unlistenDS[level]();
                    this.unlistenDS[level] = undefined;
                }
                if(reject)
                    reject();
            }.bind(this));
        }.bind(this));
        this.promisesFilters[level].onCanceled = function () {
            if (getValPromise) {
                cancelPromise(getValPromise);
                getValPromise = undefined;
            }
        };
    }

    storePersistentState() {
        let state : ControlState = {};
        state.filters = this.filters;
        state.recentlyUsedColumns = this.recentlyUsedColumns;
        if (this.filterLV) {
            state.filterSizes = [];
            for (let level = 0; level < this.filterLV.length; level++) {
                state.filterSizes[level] = this.filterLV[level].style.flexGrow;
            }
        }
        return state;
    }

    restorePersistentState(state) {
        //ODS('--- calling restorePersistenState: ' + JSON.stringify(state));
        if (state.recentlyUsedColumns)
            this.recentlyUsedColumns = state.recentlyUsedColumns;
        this.initFilterSizes = state.filterSizes;
        if (state.filters) {
            if (state.filters.toString() != this.filters.toString()) {
                this.filters = state.filters;
                this._refreshUI();
            } else {
                // same filters, restore sizes
                this.setColumnWidths();
            }
        }
    }

    storeState() {
        let retval : ControlState = {
            settings: {}
        };

        if (this.filterLV) {
            retval.settings.selNodes = [];
            retval.settings.LV = [];
            for (let level = 0; level < this.filterLV.length; level++) {
                let ds = this.filterLV[level].controlClass.dataSource;
                if (!ds)
                    continue;
                retval.settings.LV[level] = this.filterLV[level].controlClass.storeState();
                retval.settings.selNodes[level] = [];
                fastForEach(ds.getSelectedIndexes(), function (i) {
                    retval.settings.selNodes[level].push(Number(i));
                });
            }
        }
        return retval;
    }

    resetState() {
        this.resetFilters();
    }

    restoreState(restoreFrom) {

        this.sett = {};
        if (restoreFrom.settings) {
            if (restoreFrom.settings.selNodes)
                this.sett.selNodes = restoreFrom.settings.selNodes.slice();
            else
                this.sett.selNodes = [];
            if (restoreFrom.settings.LV)
                this.sett.LV = restoreFrom.settings.LV.slice();
            else
                this.sett.LV = [];
        }
        this.loadingSelection = false;
        this.doLoadSelection = false;
        if (this.sett.selNodes) {
            for (let i = 0; i < this.sett.selNodes.length; i++) {
                if (this.sett.selNodes[i] && (this.sett.selNodes[i][0] !== undefined) && (this.sett.selNodes[i][0] > 0)) {
                    this.doLoadSelection = true; // we will be loading previous state
                }
            }
        }
    }

    resetFilters() {
        let i = 0;
        while (this.filterLV[i]) {
            if (this.filterLV[i].controlClass.dataSource)
                this.filterLV[i].controlClass.dataSource.clearSelection();
            i++;
        }
    }

    /**
    Gets/sets the datasource which is/will be filtered

    @property dataSource
    @type MediaList
    */    
    get dataSource () {
        return this.alltracks;
    }
    set dataSource (ds) {
        if (this.alltracks == ds)
            return;
        if (this.alltracks) {
            if (this._changeHandlerSet) {
                this.dataSourceUnlistenFuncts();
                this._changeHandlerSet = false;
            }
            // clear previous filters to avoid unwanted data selection merging
            let i = 0;
            while (this.filterLV[i]) {
                if (this.filterLV[i].controlClass.dataSource)
                    this.filterLV[i].controlClass.dataSource = null;
                i++;
            }
        }

        this.alltracks = ds;
        let dsAsSet = ds;
        if (ds) {
            assert(ds.objectType == 'tracklist', 'Unexpected objectType in TracklistFilter.dataSource setter: ' + ds.objectType); // added assert because of #15106 - item 8
            let registerDS = function () {
                if (this.alltracks && this.alltracks == dsAsSet && !this._cleanUpCalled) {
                    this.recalcAll();
                    this.dataSourceListen(this.alltracks, 'change', (par) => {
                        // ODS('Column Filter: list CHANGE ' + this.alltracks.count + 'param: ' + par);
                        this.deferredRecalc();
                    });
                    /* LS: why the following 'sorted' listener was here? Is there a need to recal when just the list sort changed?
                    this.dataSourceListen(this.alltracks, 'sorted', () => {
                        //ODS('Column Filter: list SORTED');
                        this.deferredRecalc();
                    });
                    */
                    this.dataSourceListen(app, 'commonchange', (obj, type /*, track*/ ) => {
                        if (obj == 'track') {
                            this.deferredRecalc();
                        }
                    });
                    this._changeHandlerSet = true;
                }
            }.bind(this);

            if (this.doLoadSelection) {
                ds.whenLoaded().then(function () {
                    if (this.doLoadSelection) {
                        this.loadingSelection = true;
                        this.doLoadSelection = false;
                    }
                    registerDS();
                }.bind(this));
            } else {
                registerDS();
            }
        }
    }
    
}
registerClass(TracklistFilter);
