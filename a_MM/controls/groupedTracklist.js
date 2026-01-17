/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

registerFileImport('controls/groupedTracklist');
'use strict';
import ColumnTrackList from './columntracklist';
requirejs('helpers/searchTools');
/**
@module UI
*/
/**
Tracklist grouped by albums

@class GroupedTrackList
@constructor
@extends GridView
*/
export default class GroupedTrackList extends ColumnTrackList {
    initialize(rootelem, params) {
        this.groupHeaderDef = templates.groupedTracklistByAlbumHeaders;
        this.groupTemplate = templates.groupedTracklistByAlbum;
        /* Artwork column leaved here for now, uncomment, if we decide to remove it from tracklist
        if (this.fieldDefs.albumArt)
            delete this.fieldDefs.albumArt; // albumArt column not needed in grouped view, artwork is displayed always for whole album
        */
        this._groupBy = 'album';
        this.isGroupedView = true;
        super.initialize(rootelem, params);
        let _this = this;
        this.showHeader = true;
        this.isGrouped = true;
        this.checkGroups = true;
        this.moveFirstGroupHeader = true;
        this.groupSpacing = 15;
        this.groupSeparators = false;
        this._disableAlbumTracksLimit = false;
        this._completeRestore = true;
        this._colWidths = [];
        this.lassoSelectionEnabled = true;
        this.ignoreMouseOnGroup = true;
        this.movingOnGroups = false;
        this.localListen(this.container, 'datasourcechanged', function (e) {
            if (e.detail.newDataSource) {
                _this.prepareDataSource(e.detail.newDataSource);
                _this.groupsRecompute(true);
            }
            if (e.detail.oldDataSource) {
                e.detail.oldDataSource.clearGroupsAsync();
            }
        });
        this.localListen(this.container, 'columnschange', function (e) {
            let groupCols = [];
            _this._groupHeaderDef.forEach(function (col) {
                groupCols[col.columnType] = false;
                if (col._visible === undefined)
                    col._visible = resolveToValue(col.visible, true);
            });
            // check our group columns are visible
            for (let i = 0; i < _this.visibleColumns.length; i++) {
                if (_this.visibleColumns[i].isGroupHeader && _this._groupFieldDefs[_this.visibleColumns[i].columnType]) {
                    groupCols[_this.visibleColumns[i].columnType] = true;
                }
            }
            _this._groupHeaderDef.forEach(function (col) {
                if (col._visible !== groupCols[col.columnType]) {
                    col._visible = groupCols[col.columnType];
                    if (col.visibleChange !== undefined) {
                        col.visibleChange.call(_this, col._visible);
                    }
                }
            });
        });
        this.localListen(this.viewport, 'mouseup', (e) => {
            if (this.lastHoveredDiv) {
                this.movingOnGroups = false;
            }
        });
        this.groupFn = {};
        this._initialized = true;
    }
    handleSortChanged(_itemObjectToShow) {
        this.itemHeightReset = true;
        this._refreshItemBoxProperties = true;
        this._adjustSizeNeeded = true;
        this._groupsRefresh = true;
        this._reComputeViewport = true;
        this.invalidateAll();
        super.handleSortChanged(_itemObjectToShow);
    }
    handle_keydown(e) {
        if (!this.movingOnGroups) {
            return super.handle_keydown(e);
        }
        else {
            let ds = this._dataSource;
            if (!ds)
                return;
            let group = null;
            if (this._currentGroupIDFocused) {
                group = ds.getGroupByID(this._currentGroupIDFocused);
                let newGroup = null;
                switch (friendlyKeyName(e)) {
                    case 'Enter':
                        break;
                    case 'Esc':
                        break;
                    case 'Down':
                        {
                            let idx = ds.getGroupIdx(this._currentGroupIDFocused);
                            if (idx < ds.getGroupsCount()) {
                                newGroup = ds.getItemGroup(++idx, true);
                            }
                        }
                        break;
                    case 'Right':
                        break;
                    case 'Left':
                        break;
                    case 'Up':
                        {
                            let idx = ds.getGroupIdx(this._currentGroupIDFocused);
                            if (idx > 0) {
                                newGroup = ds.getItemGroup(--idx, true);
                            }
                        }
                        break;
                    case 'Home':
                        newGroup = ds.getItemGroup(0, true);
                        break;
                    case 'End':
                        newGroup = ds.getItemGroup(ds.getGroupsCount() - 1, true);
                        break;
                    case 'PageDown':
                        break;
                    case 'PageUp':
                        break;
                }
                if (newGroup) {
                    this.handleGroupSelection(newGroup.id, e);
                    this.setItemFullyVisible(newGroup.index + Math.min(newGroup.itemCount, 5), true);
                }
            }
        }
    }
    _currentGroupIDFocused(_currentGroupIDFocused) {
        throw new Error('Method not implemented.');
    }
    canUseLasso(e) {
        // ignore group columns
        let lvpos = getAbsPosRect(this.viewport);
        let isGroupColumn = false;
        for (let i = 0; i < this.visibleColumns.length; i++) {
            if (this.visibleColumns[i].isGroupHeader) {
                let div = this.visibleColumns[i].headerDiv;
                if (div) {
                    if (lvpos.left + div.offsetLeft + div.offsetWidth > e.clientX) {
                        isGroupColumn = true;
                        break;
                    }
                }
            }
        }
        if (!isGroupColumn) {
            if (e.target.classList.contains('lvColumnItem')) {
                // lasso is enabled only in 'non-content' part of the list (out of text)
                let content = e.target.innerText;
                if (content) {
                    let w = getTextWidth(content, e.target);
                    return e.offsetX > w;
                }
            }
            return true;
        }
        else
            return false;
    }
    updateLassoInfo(currentMouseInfo) {
        if (!this.isGrid && this.isGrouped && (this._lassoSelectionStart.startingItemIndex === -1) /* we've started at empty space */) {
            let moveUp = this._lassoSelectionStart.y > currentMouseInfo.y;
            let indexChanged = ((this._lassoSelectionStart.itemIndex === -1) && (currentMouseInfo.itemIndex !== -1));
            if (((moveUp && (this._lassoSelectionStart.direction !== -1)) ||
                (!moveUp && (this._lassoSelectionStart.direction !== 1))) ||
                indexChanged) {
                this._lassoSelectionStart.direction = moveUp ? -1 : 1;
                this._lassoSelectionStart.itemIndex = currentMouseInfo.itemIndex;
                currentMouseInfo.itemIndex = this._lassoSelectionStart.itemIndex;
            }
        }
    }
    handleLassoMove(div, e) {
        if ((!this.selectionMode) && (this._lassoSelectionStart) && (!div)) {
            let moveDown = (e.pageY - this._lassoSelectionStart.lvpos.top - this._lassoSelectionStart.headerHeight > this._lassoSelectionStart.y);
            if (!div && (((this._lassoRangeStart >= 0) && (!moveDown)) ||
                ((this._lassoRangeEnd >= 0) && (moveDown)))) {
                if (moveDown)
                    div = this.getDiv(this._lassoRangeEnd);
                else
                    div = this.getDiv(this._lassoRangeStart);
            }
        }
        return super.handleLassoMove(div, e);
    }
    groupColumnVisible(columnType) {
        return this._groupFieldDefs[columnType]._visible;
    }
    getDropIndex(e) {
        if (dnd.isDragEvent(e)) {
            let totalPos = this.canvas.getBoundingClientRect();
            let offsetX = e.clientX - totalPos.left;
            let offsetY = e.clientY - totalPos.top;
            let pos = this.getItemFromRelativePosition(offsetX, offsetY);
            if (pos === undefined) {
                let group = this.getOffsetGroup(offsetY);
                if (group) {
                    pos = group.index + group.visibleTracks;
                }
                else
                    pos = this.itemCount;
            }
            else {
                if (offsetY + this.getSmoothScrollOffset() - this.getItemTopOffset(pos) > this.itemHeight / 2)
                    pos++; // Drop item _behind_ the currently hovered items, in case we are in the lower half of the item.
            }
            return pos;
        }
        else {
            return super.getDropIndex(e);
        }
    }
    getNextItemIndex(item) {
        if (this.collapseSupport && this.isGrouped && this.dataSource && this.dataSource.getItemGroup) {
            let group;
            if (this._lastGroup && ((this._lastGroup.index >= item) && (this._lastGroup.index + this._lastGroup.itemCount < item))) {
                group = this._lastGroup;
            }
            else {
                group = this.dataSource.getItemGroup(item, false);
            }
            if (group) {
                if (group.collapsed && (group.visibleTracks !== group.itemCount)) {
                    if ((group.index + group.visibleTracks) - 1 < item + 1)
                        return group.index + group.itemCount;
                }
            }
            this._lastGroup = group;
        }
        return super.getNextItemIndex(item);
    }
    renderCollapseMark(div, group) {
        if (this.collapseSupport)
            return super.renderCollapseMark(div, group);
        else
            div.innerText = '';
    }
    prepareDataSource(ds) {
        let _ds = ds || this.dataSource;
        if (_ds) {
            _ds.clearGroupsAsync().then(() => {
                _ds.disableAlbumTracksLimit = this._disableAlbumTracksLimit;
                _ds.groupName = this._groupBy;
                if (this.autoSortString === '') {
                    if (this.useDefaultSort)
                        this.autoSortString = this.useDefaultSort;
                    else
                        this.autoSortString = _ds.getGroupSort();
                }
            });
        }
    }
    _prepareSortColumns(sortStr) {
        if (this.dataSource && this.summaryColumns) {
            this.dataSource.setSummaryColumns(this.summaryColumns.join());
        }
        super._prepareSortColumns(sortStr);
    }
    // @ts-ignore
    getDefaultSortString() {
        if (this.dataSource)
            return this.dataSource.getGroupSort();
        else // @ts-ignore
            return super.getDefaultSortString();
    }
    setColumns(columns) {
        let cols = columns || this.columns;
        // remove old group columns
        let oldSizes = [];
        for (let i = cols.length - 1; i >= 0; i--) {
            if (cols[i].isGroupHeader && cols[i].width) {
                oldSizes[cols[i].columnType] = cols[i].width;
            }
            else if (!this._completeRestore) {
                let widthInfo = this._colWidths['_' + cols[i].columnType];
                if (widthInfo && widthInfo.width)
                    cols[i].width = widthInfo.width;
            }
        }
        // add new group headers at the beginning
        for (let i = this.groupHeaderDef.length - 1; i >= 0; i--) {
            let col = this.groupHeaderDef[i];
            let used = false;
            for (let j = 0; j < cols.length; j++) {
                if (cols[j].columnType === col.columnType) {
                    used = true;
                    cols[j].isGroupHeader = true;
                    col.visible = cols[j].visible;
                    break;
                }
            }
            if (!used) {
                if (oldSizes[col.columnType])
                    col.width = oldSizes[col.columnType];
                col.width = Math.max(col.width, 30);
                col.visible = col.visible !== undefined ? resolveToValue(col.visible, true) : this._groupFieldDefs[col.columnType]._visible;
                cols.unshift(col);
            }
        }
        this.itemHeightReset = true; // to force recomputing of group width, #18161
        super.setColumns(cols);
        for (let i = 0; i < this.groupHeaderDef.length; i++) {
            this.afterColumnResize(this.visibleColumns[i].headerDiv); // call resize to update group heights
        }
    }
    setUpGroupHeader(div) {
        this._groupTemplate(div);
        precompileBinding(div, this.groupFn);
        super.setUpGroupHeader(div);
    }
    renderGroupHeaderPartial(div, group, offset) {
        let rest = (group.totalHeight - parseInt(div.details.style.height));
        let diff = rest - offset;
        div.details.style.top = (diff < 0) ? diff : 0;
    }
    renderGroupHeader(div, group, forceRebind) {
        div._groupID = group.id;
        div._group = group;
        let groupObj;
        let setGroupSize = (gr) => {
            if (div.details && (this.groupHeaderDef.length > 1)) {
                let sz = Math.min(this.groupHeaderDef[1].enumHeightSize(div), gr.totalHeight) + 'px';
                if (gr.collapsed)
                    sz = '';
                if (div.details.style.height !== sz) {
                    div.details.style.height = sz;
                }
            }
        };
        if (forceRebind && this.groupFn.bindFn) {
            if (group.link)
                groupObj = group.link.get(); // because of hotlinks fast access cannot be used
            else
                groupObj = this.dataSource.getValue(group.index);
            let id = group.id;
            let itemIndex = div.itemIndex;
            if (groupObj && groupObj.firstTrackLink) {
                this.groupFn.bindFn(div, groupObj, {
                    track: groupObj.firstTrackLink.get()
                });
                setGroupSize(div._group);
            }
            else {
                this.groupFn.bindFn(div, groupObj);
                setGroupSize(group);
            }
        }
        else {
            setGroupSize(group);
        }
    }
    getDefaultSummaryColumns() {
        return ['album', 'albumArtist', 'date', 'rating'];
    }
    storePersistentState(state) {
        if (!this.disableStateStoring) {
            state = super.storePersistentState(state);
            state.summaryColumns = this.summaryColumns;
        }
        return state;
    }
    restorePersistentState(state) {
        if (state.allColumns && state.allColumns.forEach) {
            state.allColumns.forEach(function (col) {
                let columnType = col.columnType;
                if (columnType) {
                    if (typeof this._groupFieldDefs[columnType] === 'object') {
                        this._groupFieldDefs[columnType].width = emToPx(col.width);
                        this._groupFieldDefs[columnType]._visible = resolveToValue(col.visible, true);
                    }
                    if (!this._completeRestore) {
                        this._colWidths['_' + columnType] = {
                            width: emToPx(col.width)
                        };
                    }
                }
            }.bind(this));
        }
        if (isArray(state.summaryColumns)) {
            this.summaryColumns = state.summaryColumns;
        }
        else {
            this.summaryColumns = this.getDefaultSummaryColumns();
        }
        if (this._completeRestore)
            super.restorePersistentState(state);
        else
            this.adaptColumnsWidth = !!state.adaptColumnsWidth;
    }
    handleGroupSelection(groupID, e) {
        let ds = this._dataSource;
        if (!ds)
            return;
        this.editCancel(); // #21151
        this._currentGroupIDFocused = groupID;
        let group = ds.getGroupByID(groupID);
        if (group) {
            if (e.shiftKey && this.multiselect) {
                this.ignoreShiftFocusChange = true;
                this.focusedIndex = group.index;
                let si = this.getShiftFocusedIndex();
                let fi;
                if (this._shiftFocusedItem < this.focusedIndex) {
                    fi = this.focusedIndex + group.itemCount - 1; // to select the group up to the last item
                }
                else
                    fi = this.focusedIndex;
                this.contextMenuPromise = ds.selectRangeAsync(fi, si, !e.ctrlKey || this.isShiftSelect(), !e.ctrlKey);
            }
            else {
                this.focusedIndex = group.index;
                this._groupShiftFocusedID = groupID;
                if ((e.ctrlKey && this.multiselect) || (this.multiselect && usingTouch && this.selectionMode)) {
                    let isSelected;
                    ds.locked(() => {
                        isSelected = ds.isSelected(group.index);
                    });
                    if (isSelected) {
                        ds.modifyAsync(() => {
                            for (let i = group.index; i < group.index + group.itemCount; i++)
                                ds.setSelected(i, false);
                            this.raiseItemSelectChange(this.focusedIndex);
                        });
                        return;
                    }
                    else
                        this.contextMenuPromise = ds.selectRangeAsync(group.index, group.index + group.itemCount - 1);
                }
                else {
                    this.contextMenuPromise = ds.selectRangeAsync(group.index, group.index + group.itemCount - 1, true, true /* clear selection */);
                }
            }
            this.raiseItemSelectChange(this.focusedIndex);
            this.movingOnGroups = true;
            if (this.contextMenuPromise) { // this undefining of this.contextMenuPromise should be probably in controls to clean up it automatically
                this.disabledClearingSelection = true;
                this.contextMenuPromise.then(() => {
                    this.contextMenuPromise = undefined;
                    this.disabledClearingSelection = false;
                });
            }
        }
    }
    get groupTemplate() {
        return this._groupTemplate;
    }
    set groupTemplate(value) {
        this._groupTemplate = value;
        if (this._initialized) {
            this.groupFn = {};
            this.rebind();
        }
    }
    get groupHeaderDef() {
        return this._groupHeaderDef;
    }
    set groupHeaderDef(value) {
        this._groupHeaderDef = [];
        this._groupFieldDefs = [];
        value.forEach(function (item) {
            let newItem = Object.assign({}, item);
            this._groupHeaderDef.push(newItem);
            this._groupFieldDefs[newItem.columnType] = newItem;
            this._groupFieldDefs[newItem.columnType]._visible = resolveToValue(newItem.visible, true);
            this.fieldDefs[newItem.columnType] = newItem;
        }.bind(this));
        if (this._initialized)
            this.setColumns();
    }
    get groupBy() {
        return this._groupBy;
    }
    set groupBy(value) {
        if (this._groupBy !== value) {
            this._groupBy = value;
            this.prepareDataSource();
        }
    }
    get disableAlbumTracksLimit() {
        return this._disableAlbumTracksLimit;
    }
    set disableAlbumTracksLimit(value) {
        this._disableAlbumTracksLimit = value;
        this._collapseSupport = !value;
        if (this.dataSource) {
            this.prepareDataSource(this.dataSource);
        }
    }
    get summaryColumns() {
        return this._summaryColumns;
    }
    set summaryColumns(value) {
        this._summaryColumns = value;
        if (this._initialized) {
            this.clearDivs();
            this.groupFn = {};
            this.rebind();
        }
    }
}
registerClass(GroupedTrackList);
