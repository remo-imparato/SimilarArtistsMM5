'use strict';

registerFileImport('controls/albumListView');

import ListView from './listview';

/**
 * UI Albumlist element
 */
export default class AlbumListView extends ListView {    
    hideAdaptColumnsWidth: boolean;
    player: Player;
    hasVideoContent: boolean;
    sortColumns: SortColumn[];
    disableStatusbar: boolean;
    private _tracks: any;
    private _change: (...params: any[]) => void;
    private _visibleColumns: any[];
    private _fieldDefs: AnyDict;
    
    initialize(rootelem, params) {
        this.isSortable = true;
        if (params)
            this.hasVideoContent = !!params.hasVideoContent;
        super.initialize(rootelem, params);
        this.isGrid = true;
        this.editSupported = true;
        this.popupSupport = true;
        this.isSearchable = true;
        this.hideAdaptColumnsWidth = true;

        this.player = app.player;
        this.itemCloningAllowed = false;
        this.contextMenu = menus.createTracklistMenu(this.container);
        this.helpContext = 'Filelisting';
        this.hasMediaContent = true;
        this._ignoreDefaultLookup = true;
        uitools.enableTitleChangeNotification(this);

        let loadSettings = function () {
            let sett = settings.get('Options');
            this.autoDownloadImage = sett.Options.SearchMissingArtwork;
            this.autoSaveImage = sett.Options.SaveMissingArtwork;
        }.bind(this);

        loadSettings();

        this.localListen(settings.observer, 'change', function () {
            let oldAutoDownload = this.autoDownloadImage;
            let oldAutoSaveImage = this.autoSaveImage;
            loadSettings();
            if (this.autoDownloadImage && (this.autoDownloadImage !== oldAutoDownload) || (oldAutoSaveImage !== this.autoSaveImage)) {
                this.rebind();
            }
        }.bind(this));

        this.localListen(this.container, 'focuschange', function () {
            this.raiseItemFocusChange(); // LS: to update A&D window
        }.bind(this));

        let _this = this;
        let item;
        if (window.uitools.getCanEdit()) {
            this.addToContextMenu([
                {
                    action: {
                        title: actions.coverLookup.title,
                        icon: actions.coverLookup.icon,

                        visible: function () {
                            let origIndex = _this.focusedIndex;
                            if ((origIndex < 0) || !_this.dataSource)
                                return false;
                            _this.dataSource.locked(function () {
                                item = _this.dataSource.getFastObject(origIndex, item);
                            });
                            return (item && (item.id > 0) && window.uitools.getCanEdit());
                        },

                        execute: function () {
                            let origIndex = _this.focusedIndex;
                            if (origIndex < 0)
                                return;
                            let origItem = undefined;
                            _this.dataSource.locked(function () {
                                origItem = _this.dataSource.getValue(origIndex);
                            });
                            if (!origItem)
                                return;
                            requirejs('helpers/searchTools');
                            searchTools.searchAAImageDlg(origItem, function () {
                                _this.rebind();
                            }.bind(_this), {
                                noDefaultIcon: (origItem.itemImageType !== 'notsavedimage') && (origItem.itemImageType !== 'icon')
                            });
                        }
                    },
                    order: 100, // as last in group
                    grouporder: 50, // shoudl be same as auto-tag
                }]);
            this.enableDragNDrop(); // to allow pasting artwork
        }
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

    get headerRenderers() {
        return {
            renderDefault: function (div, column) {
                div.innerText = resolveToValue(column.title, '', column.listview, column);
                if (column.align === 'right')
                    div.style.textAlign = 'right';
            },
        };
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
                ret += resolveToValue(col.title, col.columnType, undefined, col) + ' ';
                ret += (direction === 'ASC') ? _('ascending') : _('descending');
                ret += '<br>';
                return ret;
            };

            for (let i = 0; i < this.sortColumns.length; i++) {
                let col = getVisibleAlias(this.sortColumns[i].columnType);
                if (col) {
                    ret += createRow(col, this.sortColumns[i].direction, i);
                } else {
                    for (let j = 0; j < this.visibleColumns.length; j++) {
                        if (this.sortColumns[i].columnType === this.visibleColumns[j].columnType) {
                            ret += createRow(this.visibleColumns[j], this.sortColumns[i].direction, i);
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

        let asc;
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
                    title: resolveToValue(column.title, '', undefined, column),
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

    setUpHeader(header) {
        this.cleanUpHeader();
        cleanElement(header);
        header.classList.add('flex');
        header.classList.add('row');

        let createColumn = function (column, i) {
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
            div.style.flexBasis = 'auto';
            div.className = 'lvHeaderItem flex row paddingSides';
            column.headerDiv = div;
            if (this.isSortable) {
                div.classList.add('clickable');
                app.listen(div, 'mouseup', function (e) {
                    if ((e.button !== 0))
                        return;

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
                        let sortobj : SortColumn  = {
                            columnType: column.columnType,
                            title: resolveToValue(column.title, '', undefined, column),
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
                            let sortobj : SortColumn = this.sortColumns[sortIdx];
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
            } else
                div.classList.add('notSortable');
            div.appendChild(contdiv);
            div.appendChild(sortdiv);
            div.appendChild(sortdivNumber); // @ts-ignore
            div.contdiv = contdiv; // @ts-ignore
            div.sortdiv = sortdiv; // @ts-ignore
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

    setUpDiv(div) {
        templates.imageItem(div, templates.imageItemsParams.albumListView.call(this));
    }

    canDeleteSelected() {
        return true;
    }

    deleteSelected() {
        let itemlist = this.dataSource.getSelectedList();
        let tracklist = this.dataSource.getSelectedTracklist();
        let _this = this;
        this.localPromise(whenAll([itemlist.whenLoaded(), tracklist.whenLoaded()])).then(function () {
            _this.localPromise(window.uitools.deleteTracklist(tracklist)).then(function (removed) {
                if (removed)
                    itemlist.locked(function () {
                        let itm;
                        for (let i = 0; i < itemlist.count; i++) {
                            itm = itemlist.getFastObject(i, itm);
                            itm.deleted = true;
                            _this.dataSource.remove(itm);
                        }
                    });
            });
        });
    }

    formatStatus(data) {
        if (this.disableStatusbar || !data)
            return '';

        return statusbarFormatters.formatAlbumListStatus(data, 'albums');
    }

    renderPopup(div, item, scrollToView) {
        let LV = div.parentListView;
        return templates.popupRenderers.album(LV, div, item, scrollToView);
    }

    canDrop(e) {
        return dnd.isAllowedType(e, 'cover');
    }

    drop(e) {
        // detect hovered item
        let lvPos = findScreenPos(this.container);
        let itemIndex;
        if ((e.screenX !== undefined) && (e.screenY !== undefined)) {
            lvPos.left = e.screenX - lvPos.left;
            lvPos.top = e.screenY - lvPos.top;
            itemIndex = this.getItemFromRelativePosition(lvPos.left, lvPos.top);
        } else {
            itemIndex = this.focusedIndex;
        }
        let _this = this;

        if (itemIndex >= 0 && this.dataSource) {
            let item;
            this.dataSource.locked(function () {
                item = this.dataSource.getValue(itemIndex);
            }.bind(this));
            if (item) {
                dnd.handleDroppedCover(e, function (picturePath, mydiv) {
                    if (picturePath && !_this._cleanUpCalled) {
                        uitools.addNewArtwork(picturePath, {
                            album: item,
                            showReplace: true
                        }).then(function (res) {
                            if (!_this._cleanUpCalled && res && res.done) {
                                _this.rebind();
                            }
                        });
                    }
                });
            }
        }
    }

    storePersistentState() {
        let state : AnyDict = {};
        state.sorting = this.autoSortString;
        return state;
    }

    restorePersistentState(state) {
        if (state.sorting) {
            this.autoSortString = state.sorting;
        }
    }

    _notifyFiltered(orig, filtered, phrase) {
        let event = createNewCustomEvent('datasourcefiltered', {
            detail: {
                original: orig,
                filtered: filtered,
                phrase: phrase,
                original_tracklist: this._tracks
            },
            bubbles: true,
            cancelable: true
        });
        this.container.dispatchEvent(event);
    }

    prepareDatasource(tracks, cachedDS) {
        if (this._tracks) {
            if (this._change) {
                app.unlisten(this._tracks, 'change', this._change);
                this._change = undefined;
            }
        }
        this._tracks = tracks;
        if (this._tracks) {
            if (this._tracks.getAlbumList) {
                this._change = app.listen(this._tracks, 'change', (e) => {
                    if (e === 'newcontent') {
                        let ds_orig = this._dataSourceOrig;
                        this.dataSource = this._tracks.getAlbumList(this.autoSortString);
                        this._dataSourceOrig = ds_orig;
                    }
                });
                if (cachedDS) {
                    return cachedDS;
                } else {
                    return this._tracks.getAlbumList(this.autoSortString);
                }
            } else {
                return this._tracks;
            }
        } else
        if (cachedDS)
            return cachedDS;
        return undefined;
    }

    editStart() {
        let item = this.focusedItem;
        if (item) {
            requirejs('controls/editors');
            let div = this.getDiv(this.focusedIndex);
            if (!div)
                return;
            let cellDiv = div;
            let textPart = qe(div, '[data-id=firstLine]');
            if (!textPart)
                textPart = qe(div, '[data-id=firstLineText]');
            if (textPart)
                cellDiv = textPart;

            this.inEdit = {
                listview: this,
                editor: editors.gridViewEditors.textEdit,
                div: div,
                item: item,
                cellDiv: cellDiv,
                getValue: function (item) {
                    return resolveToValue(item.name);
                },
                setValue: function (item, value) {
                    item.title = value;
                    item.commitAsync();
                    return true; // to not save (already saved by calling commitAsync above)
                },
            };
            this.inEdit.editor('edit', this.inEdit.cellDiv, this.inEdit.item);
        }
    }

    editSave() {
        if (this.inEdit) {
            this.inEdit.editor('save', this.inEdit.cellDiv, this.inEdit.item);
            this.inEdit.div.itemIndex = undefined; // force rebind 
            this.draw();
            this.inEdit = undefined;
        }
    }

    editCancel() {
        if (this.inEdit) {
            this.inEdit.editor('cancel', this.inEdit.cellDiv, this.inEdit.item);
            this.inEdit = undefined;
        }
    }

    cleanUp() {
        if (this._change) {
            app.unlisten(this._tracks, 'change', this._change);
            this._change = undefined;
        }
        this.cleanUpHeader();
        super.cleanUp();
    }
    
    get visibleColumns() {
        if (this._visibleColumns === undefined) {
            this._visibleColumns = [];
            for (let f in this.fieldDefs) {
                let col = copyObject(this.fieldDefs[f]);
                this._visibleColumns.push(col);
            }
        }
        return this._visibleColumns;
    }
    set visibleColumns(value) {
        this._visibleColumns = value;
    }
    
    
    get fieldDefs () {
        if (this._fieldDefs === undefined) {
            this._fieldDefs = {};
            for (let f in uitools.albumlistFieldDefs) {
                if (this.hasVideoContent && uitools.albumlistFieldDefs[f].hideInSeries)
                    continue;
                this.fieldDefs[f] = copyObject(uitools.albumlistFieldDefs[f]);
                this.fieldDefs[f].columnType = f;
                this.fieldDefs[f].hasVideoContent = this.hasVideoContent;
            }
        }
        return this._fieldDefs;
    }
    set fieldDefs (value) {
        this._fieldDefs = value;
    }
    
}
registerClass(AlbumListView);

window.uitools.albumlistFieldDefs = {
    title: {
        title: function () {
            if (this.hasVideoContent)
                return _('Series');
            else
                return _('Album');
        }
    },
    year: {
        title: _('Date'),
    },
    artist: {
        title: _('Album Artist'),
        hideInSeries: true
    },
    rating: {
        title: _('Rating'),
    }
    //length
};