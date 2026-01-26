/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

import '../commonControls';
import {everywhereID, playingID, playlistsID} from '../helpers/views';

let UI = null;
let viewData = null;
let viewPreset = null;
let handlers = [];
let viewIDs = [];
let subViews = [];
let inEditSortRow;
let inEditSummaryRow;
let sorts = [];
let summaryRows = [];
let fieldDefs, summaryFieldDefs;
let fieldIDs = [];
let LV;
let columnsEditorInitialized;

let groupingNames = [_('Album')];
let groupings = ['album;albumArtist'];

let _cleanSortRow = function (row, justUnlisten) {
    app.unlisten(row.cbSortField);
    app.unlisten(row.aSortField);
    app.unlisten(row.aDirection);
    app.unlisten(row.btnDelete);
    if (!justUnlisten)
        cleanElement(row);
    row._cleanUpCalled = true;
};

let _cleanSortRows = function () {
    let VT = UI.vtSortRules;
    for (let i = VT.childNodes.length - 1; i >= 0; i--) {
        let row = VT.childNodes[i];
        _cleanSortRow(row);
        VT.removeChild(row);
    }
}.bind(this);

let _cleanSummaryRow = function (row, justUnlisten) {
    app.unlisten(row.cbSummaryField);
    app.unlisten(row.aSummaryField);
    app.unlisten(row.btnDelete);
    if (!justUnlisten)
        cleanElement(row);
    row._cleanUpCalled = true;
};

let _cleanSummaryRows = function () {
    let VT = UI.vtSummaryColumns;
    for (let i = VT.childNodes.length - 1; i >= 0; i--) {
        let row = VT.childNodes[i];
        _cleanSummaryRow(row);
        VT.removeChild(row);
    }
}.bind(this);

function prepareSortingControls(sorting, sortingColumns, summaryColumns) {
    summaryFieldDefs = {};
    sorts = [];
    if (sortingColumns) {
        fieldDefs = {};
        forEach(sortingColumns, (col) => {
            fieldDefs[col.columnType] = col;
        })
    } else if (LV) {
        fieldDefs = {};
        let defs = copyObject(window.uitools.tracklistFieldDefs);
        for (let col in defs)
            if (defs[col].title !== undefined)
                if (!resolveToValue(defs[col].disabled, true, LV))
                    fieldDefs[col] = defs[col];
    } else
        fieldDefs = copyObject(window.uitools.tracklistFieldDefs);

    let f, col;
    for (col in fieldDefs) {
        f = fieldDefs[col];
        f.columnType = col;
        fieldIDs[resolveToValue(f.title, '')] = col;
        if (!f.notForAlbum) {
            summaryFieldDefs[col] = f;
        }
    }

    if (!sortingColumns && summaryColumns && LV && LV.controlClass && LV.controlClass.groupHeaderDef) {
        for (let i = 0; i < LV.controlClass.groupHeaderDef.length; i++) {
            f = LV.controlClass.groupHeaderDef[i];
            col = f.columnType;
            fieldIDs[resolveToValue(f.title, '')] = col;
            if (f.isSortable) {
                fieldDefs[col] = f;
            }
        }
    };

    let _loadValues = function () {

        _cleanSortRows();
        _cleanSummaryRows();

        for (let i = 0; i < sorts.length; i++) {
            _addSort2UI(sorts[i].name, sorts[i].ascending);
        }
        for (let i = 0; i < summaryRows.length; i++) {
            _addSummary2UI(summaryRows[i]);
        }
    }.bind(this);


    let _onSwitchDirection = function () {
        // switch state:
        if (this.row.ascending)
            this.row.ascending = false;
        else
            this.row.ascending = true;
        // show direction:
        this.innerText = _getDirectionText(this.row.ascending);
        _setSortOrders();
    };

    let _onEditSort = function () {
        if (inEditSortRow)
            _onSortEdited(inEditSortRow);

        if (this == this.row.aSortField) {
            setVisibility(this.row.cbSortField, true);
            setVisibility(this.row.aSortField, false);
            this.row.cbSortField.controlClass.calcAutoWidth(); // full row is visible now, re-calc correct width (#13854)
            this.row.cbSortField.controlClass.value = this.row.aSortField.innerText;
            this.row.cbSortField.controlClass.focus();
        } else {
            setVisibility(this.row.cbSortField, false);
        }
        inEditSortRow = this.row;
    };

    let _onRemoveSort = function () {
        if (this.row == inEditSortRow)
            _onSortEdited(inEditSortRow);
        _cleanSortRow(this.row, true);
        animTools.animateRemoveRow(this.row, _setSortOrders);
    };

    let _getDirectionText = function (ascending) {
        if (ascending)
            return _('A..Z')
        else
            return _('Z..A');
    };

    let _setSortOrders = function () {
        let VTSortRules = UI.vtSortRules;
        let sortOrders = new Array();
        for (let i = 0; i < VTSortRules.childNodes.length; i++) {
            let row = VTSortRules.childNodes[i];
            sortOrders.push({
                name: fieldIDs[row.aSortField.innerText],
                ascending: row.ascending
            });
        }
        sorts = sortOrders;
    }.bind(this);

    let _setSortDirectionVis = function (row, value) {
        setVisibility(row.aDirection, value != _('Random') && value != _('Random Album')); // #14561, orig. #14202 - item 7
    }.bind(this);

    let _onSortEdited = function (row) {
        inEditSortRow = null;
        if (row.cbSortField && row.cbSortField.controlClass) {
            let text = row.cbSortField.controlClass.value;
            row.aSortField.innerText = text;
            setVisibility(row.cbSortField, false);
            setVisibility(row.aSortField, true);
            _setSortDirectionVis(row, text)
            _setSortOrders();
        }
    }.bind(this);

    let _addSort2UI = function (sortname, ascending) {
        if (fieldDefs[sortname]) {
            let VTSortRules = UI.vtSortRules;
            let row = document.createElement('div');
            let sortname_visual = resolveToValue(fieldDefs[sortname].title, '');
            row.className = 'flex fill uiRowCenter';
            row.ascending = ascending;
            row.innerHTML =
                '<div data-id="aSortField" class="fieldControl clickableLabel textEllipsis">' + sortname_visual + '</div>' +
                '<div data-id="cbSortField" class="fieldEditControl" data-control-class="Dropdown" data-init-params="{readOnly: true}"></div>' +
                '<div data-id="aDirection" class="clickableLabel textEllipsis">' + _getDirectionText(row.ascending) + '</div>' +
                '<div class="toolButton" data-id="btnDelete" data-icon="remove"></div>';
            VTSortRules.appendChild(row);
            initializeControls(row); // To load icon, cbSortField.controlClass  
            row.cbSortField = qe(row, '[data-id=cbSortField]');
            let ds = newStringList();
            for (let col in fieldDefs) {
                ds.add(resolveToValue(fieldDefs[col].title, ''));
            }
            ds.sort();

            row.cbSortField.controlClass.dataSource = ds;
            row.cbSortField.controlClass.value = sortname_visual; // needs to be assigned due to proper vertical align        
            app.listen(row.cbSortField, 'change', function () {
                _setSortDirectionVis(this, this.cbSortField.controlClass.value);
                this.cbSortField.controlClass.closeDropdown(true);
                _onSortEdited(this);
            }.bind(row));
            setVisibility(row.cbSortField, false);
            row.aSortField = qe(row, '[data-id=aSortField]');
            app.listen(row.aSortField, 'click', _onEditSort);
            addEnterAsClick(undefined, row.aSortField);
            row.aSortField.row = row;
            row.aDirection = qe(row, '[data-id=aDirection]');
            app.listen(row.aDirection, 'click', _onSwitchDirection);
            addEnterAsClick(undefined, row.aDirection);
            row.aDirection.row = row;
            row.btnDelete = qe(row, '[data-id=btnDelete]');
            app.listen(row.btnDelete, 'click', _onRemoveSort);
            addEnterAsClick(undefined, row.btnDelete);
            row.btnDelete.row = row;
            _setSortDirectionVis(row, sortname);

            return row;
        };
        return undefined;
    }.bind(this);

    let _onAddSort = function () {
        let row = _addSort2UI('title', true /* ascending */ );
        if (row) {
            animTools.animateAddRow(row, function () {
                _setSortOrders.call(this);
                _onEditSort.call(row.aSortField); // to start edit manually added field
            }.bind(this));
        }
    }.bind(this);

    window.localListen(UI.aAddSortRule, 'click', _onAddSort);

    // --- summary columns functionality
    let _setSummaryOrders = function () {
        let VTSummaryColumns = UI.vtSummaryColumns;
        let summaryOrders = new Array();
        for (let i = 0; i < VTSummaryColumns.childNodes.length; i++) {
            let row = VTSummaryColumns.childNodes[i];
            summaryOrders.push(fieldIDs[row.aSummaryField.innerText]);
        }
        summaryRows = summaryOrders;
    }.bind(this);

    let _onRemoveSummary = function () {
        if (this.row == inEditSummaryRow)
            _onSummaryEdited(inEditSummaryRow);
        _cleanSummaryRow(this.row, true);
        animTools.animateRemoveRow(this.row, _setSummaryOrders);
    };

    let _addSummary2UI = function (sortname) {
        if (summaryFieldDefs[sortname]) {
            let VTSummaryColumns = UI.vtSummaryColumns;
            let row = document.createElement('tr');
            let summaryname_visual = resolveToValue(summaryFieldDefs[sortname].title, '');
            row.className = 'flex fill uiRowCenter';
            row.innerHTML =
                '<div data-id="aSummaryField" class="fieldControl clickableLabel textEllipsis">' + summaryname_visual + '</div>' +
                '<div data-id="cbSummaryField" class="fieldEditControl" data-control-class="Dropdown" data-init-params="{readOnly: true}"></div>' +
                '<div class="toolButton" data-id="btnDelete" data-icon="remove"></div>';
            VTSummaryColumns.appendChild(row);
            initializeControls(row); // To load icon, cbSummaryField.controlClass  
            row.cbSummaryField = qe(row, '[data-id=cbSummaryField]');
            let ds = newStringList();
            for (let col in summaryFieldDefs) {
                ds.add(resolveToValue(summaryFieldDefs[col].title, ''));
            }
            ds.sort();

            row.cbSummaryField.controlClass.dataSource = ds;
            row.cbSummaryField.controlClass.value = summaryname_visual; // needs to be assigned due to proper vertical align        
            app.listen(row.cbSummaryField, 'change', function () {
                this.cbSummaryField.controlClass.closeDropdown(true);
                _onSummaryEdited(this);
            }.bind(row));
            setVisibility(row.cbSummaryField, false);
            row.aSummaryField = qe(row, '[data-id=aSummaryField]');
            app.listen(row.aSummaryField, 'click', _onEditSummary);
            row.aSummaryField.row = row;
            row.btnDelete = qe(row, '[data-id=btnDelete]');
            app.listen(row.btnDelete, 'click', _onRemoveSummary);
            row.btnDelete.row = row;
            return row;
        }
        return undefined;
    }.bind(this);

    let _onSummaryEdited = function (row) {
        inEditSummaryRow = null;
        if (row.cbSummaryField && row.cbSummaryField.controlClass) {
            let text = row.cbSummaryField.controlClass.value;
            row.aSummaryField.innerText = text;
            setVisibility(row.cbSummaryField, false);
            setVisibility(row.aSummaryField, true);
            _setSummaryOrders();
        }
    }.bind(this);

    let _onEditSummary = function () {
        if (inEditSummaryRow)
            _onSummaryEdited(inEditSummaryRow);

        if (this == this.row.aSummaryField) {
            setVisibility(this.row.cbSummaryField, true);
            setVisibility(this.row.aSummaryField, false);
            this.row.cbSummaryField.controlClass.calcAutoWidth(); // full row is visible now, re-calc correct width (#13854)
            this.row.cbSummaryField.controlClass.value = this.row.aSummaryField.innerText;
            this.row.cbSummaryField.controlClass.focus();
        } else {
            setVisibility(this.row.cbSummaryField, false);
        }
        inEditSummaryRow = this.row;
    };

    let _onAddSummary = function () {
        let row = _addSummary2UI('album');
        if (row) {
            animTools.animateAddRow(row, function () {
                _setSummaryOrders.call(this);
                _onEditSummary.call(row.aSummaryField); // to start edit manually added field
            }.bind(this));
        }
    }.bind(this);

    window.localListen(UI.aAddSummaryColumn, 'click', _onAddSummary);
    
    if (sorting) {
        let ar = sorting.split(';');
        ar.forEach(function (item) {
            let name = item.replace(' desc', '').replace(' DESC', '').replace(' ASC', '').replace(' asc', '');
            let ascending = !item.toUpperCase().includes(' DESC');
            if (name && fieldDefs[name]) {
                sorts.push({
                    name: name,
                    ascending: ascending
                });
            }
        });
    };
    if (summaryColumns) {
        summaryRows = summaryColumns.slice();
    };
    _loadValues();
}

let prepareColumns = function (cols, LV) {
    cols.forEach((col) => {   
        if ((col.isGroupHeader) && (!resolveToValue(col.disabled, false, LV))) {
            col.visible = true;
            col.locked = true;
        }
    });
    cols.sort(function (item1, item2) {
        let item1First = ((item1.columnType == 'playOrder') || item1.isGroupHeader);
        let item2First = ((item2.columnType == 'playOrder') || item2.isGroupHeader);
        if (item1First || item2First) {
            if (!item1First)
                return 1;
            if (!item2First)
                return -1;
            return item1.groupIndex - item2.groupIndex;
        }
        return 0;
    });
}

let presetColumns = function (LV) {
    let cols = UI.lvColumns.controlClass.columns;
    prepareColumns(cols, LV);
    let columnParams = {
        title: title,
        allColumns: cols,
        allowEmpty: false,
        LV: LV,
        listLabelAll: _('Available'),
        listLabel: _('Displayed')
    };
    if (columnsEditorInitialized) {
        initEditor(columnParams);
    }
}

let init = function(params) {
    columnsEditorInitialized = false;

    UI = getAllUIElements();

    title = _('Configure View');
    //resizeable = false;
    if (params.caption) {
        title += ': ' + params.caption;
    }

    viewData = params.viewData;
    viewPreset = params.data;
    LV = params.LV;
    let columnParams = params;

    let _updateColumnsSettingsLeadText = function () {
        let colSett = app.getValue('sharedColumns_Settings', {mode: 'perNode'});  
        if (colSett.mode == 'perNode' && params.collection)
            UI.lblChooseColumns.innerHTML = _('Choose Columns') + ' / ' + _('Sort') + ' (' + (params.collection ? params.collection.name : '') + ' > ' + nodeUtils.getNodeTitle( params.node) + ')';
        else
        if (colSett.mode == 'perCollection' && params.collection)
            UI.lblChooseColumns.innerHTML = _('Choose Columns') + ' / ' + _('Sort') + ' (' + (params.collection ? params.collection.name : '') + ')';
        else        
        if (colSett.mode == 'perCollections')
            UI.lblChooseColumns.innerHTML = _('Choose Columns') + ' / ' + _('Sort') + ' (' + _('Entire Library')+ ')';
    }

    if (viewPreset) {
        let isNew = params.isNew;
        let viewIdIndex = params.isNew ? 0 : -1;
        let readOnly = viewPreset.deletable === false;
        let multiView = params.multiView;
        let isCurrent = params.isCurrent;

        let avList = newStringList();
        if (viewData.availableViews) {

            let addType = function (viewId, i) {
                let ret = false;
                let vHandler = getViewHandler(viewId);
                viewIDs[i] = viewId;
                handlers[i] = vHandler;
                avList.add(resolveToValue(vHandler.title, ''));
                if (viewPreset.viewMode && viewPreset.viewMode === viewId) {
                    ret = true;
                }
                return ret;
            }

            let AV = viewData.availableViews();
            for (let i = 0; i < AV.length; i++) {
                let viewId = AV[i];
                if (addType(viewId, i))
                    viewIdIndex = i;
            }

            if (viewIdIndex < 0) { // probably editing custom view for different node ... add viewMode from preset
                let idx = avList.count;
                addType(viewPreset.viewMode, idx);
                viewIdIndex = idx;
            }
        }
        UI.cbTypes.controlClass.dataSource = avList;

        let addSubViews = function () {
            subViews = new ArrayDataSource([]);
            if (UI.cbTypes.controlClass.dataSource.focusedIndex >= 0) {
                let viewHandler = handlers[UI.cbTypes.controlClass.dataSource.focusedIndex];
                if (viewHandler.subViews) {
                    let SV = viewHandler.subViews;
                    for (let i = 0; i < SV.length; i++) {
                        let viewId = SV[i];
                        let vHandler = getViewHandler(viewId);
                        if (vHandler.permanent) // permanent (always enabled) sub-view
                            continue;

                        subViews.add({
                            title: resolveToValue(vHandler.title, viewId),
                            viewId: viewId
                        });

                        let checked = (viewPreset.subViews.indexOf(viewId) >= 0);

                        if (readOnly && multiView && isCurrent) { // it's built-in view
                            checked = !multiView._viewHandlerState.hiddenSubViews[viewId];
                        }

                        subViews.setChecked(subViews.count - 1, checked);
                    }
                }
            }
            UI.lvSubViews.controlClass.dataSource = subViews;
        };

        let addSorting = function () {
            let usedSorting = viewPreset.sorting;
            if (multiView) {
                let LVControl = multiView.getDefaultFocusControl();
                if (!usedSorting && LVControl && LVControl.controlClass) {
                    if (LVControl.controlClass.dataSource)
                        usedSorting = LVControl.controlClass.dataSource.autoSortString;
                }
            }

            let list = newStringList();
            let index = 0;
            let viewHandler = handlers[UI.cbTypes.controlClass.dataSource.focusedIndex];
            if (viewHandler.sortByNames && viewHandler.sortBy && (viewHandler.sortByNames.length === viewHandler.sortBy.length)) {
                viewHandler.sortByNames.forEach(function (sort, idx) {
                    list.add(sort);
                    if (usedSorting === viewHandler.sortBy[idx])
                        index = idx;
                });
            }
            UI.cbSorting.controlClass.dataSource = list;
            UI.cbSorting.controlClass.focusedIndex = index;
        };

        let changeType = function () {
            let columns = false;
            let grouping = false;
            let subviews = false;
            let sorting = false;
            if (UI.cbTypes.controlClass.dataSource.focusedIndex >= 0) {
                columns = resolveToValue(handlers[UI.cbTypes.controlClass.dataSource.focusedIndex].columnsSupport, false);
                grouping = resolveToValue(handlers[UI.cbTypes.controlClass.dataSource.focusedIndex].groupsSupport, false);
                //if (!readOnly) {
                addSubViews();
                subviews = UI.lvSubViews.controlClass.dataSource.count > 0;
                //}
                addSorting();
                sorting = UI.cbSorting.controlClass.dataSource.count > 0;
            }
            let listview = handlers[UI.cbTypes.controlClass.dataSource.focusedIndex] instanceof window.viewHandlersClasses['TracklistBase'];

            if (handlers[UI.cbTypes.controlClass.dataSource.focusedIndex].sortingSupport !== undefined) {
                // sorting support is defined by handler
                sorting = resolveToValue(handlers[UI.cbTypes.controlClass.dataSource.focusedIndex].sortingSupport, false);
                listview = sorting;
            }

            setVisibility(UI.bColumnsBlock, columns);
            setVisibility(UI.bSubViewsBlock, subviews);
            setVisibility(UI.cbSorting, sorting);
            setVisibility(UI.boxSortOrders, !sorting && listview);
            setVisibility(UI.bSortBlock, sorting || (!sorting && listview));
            setVisibility(UI.btnImageSize, !columns);
            setVisibility(UI.btnReset, false);

            UI.btnOK.disabled = UI.cbTypes.controlClass.dataSource.focusedIndex < 0;

            if (columns) {
                if (grouping)
                    presetColumns(UI.lvColumns);
                else
                    presetColumns(params.LV);
            }
        };

        window.localListen(UI.cbTypes, 'change', function () {
            changeType();
        });

        if (params.LV && params.LV.controlClass) {
            UI.lvColumns.controlClass._parentView = params.LV.controlClass.parentView;
        }
        UI.lvColumns.controlClass.dataSource = app.utils.createTracklist(true); //app.getTestingTracksList(1);
        UI.lvColumns.controlClass.restorePersistentState(UI.lvColumns.controlClass.getDefaultPersistentState());
        if (viewPreset.cols && viewPreset.cols.length) {
            let state = {
                allColumns: viewPreset.cols,
                sortString: viewPreset.sorting,
                adaptColumnsWidth: viewPreset.adaptWidths,
                summaryColumns: viewPreset.summaryColumns
            };
            UI.lvColumns.controlClass.restorePersistentState(state);
        }


        initSubViewsLV();

        prepareSortingControls(viewPreset.sorting, undefined, viewPreset.summaryColumns);

        let checkUse = function (id, defaultVal) {
            let checked = defaultVal;
            if (viewPreset.usedInNodes) {
                checked = viewPreset.usedInNodes.some(function (item) {
                    return item === id;
                });
            }
            return checked;
        };

        // fill Use In
        app.collections.getCollectionListAsync({
            includeEntireLibrary: true
        }).then(function (list) {
            if (window._cleanUpCalled)
                return;

            let ar = [{
                title: _('Everywhere'),
                id: everywhereID,
                toString: function () {
                    return this.title;
                },
                checked: checkUse(everywhereID, true),
        }];
            list.locked(function () {
                let item;
                for (let i = 0; i < list.count; i++) {
                    item = list.getFastObject(i, item);

                    ar.push({
                        item: item,
                        title: item.name,
                        id: item.persistentID,
                        toString: function () {
                            return this.title;
                        },
                        checked: checkUse(item.persistentID, false),
                    });
                }
            });

            ar.push({
                title: _('Playing'),
                id: playingID,
                toString: function () {
                    return this.title;
                },
                checked: checkUse(playingID, false),
            });

            ar.push({
                title: _('Playlists'),
                id: playlistsID,
                toString: function () {
                    return this.title;
                },
                checked: checkUse(playlistsID, false),
            });

            let ds = new ArrayDataSource(ar);
            UI.cbUseIn.controlClass.dataSource = ds;
            UI.cbUseIn.controlClass.value = ds.toString();
        });

        // restore settings from preset
        UI.eName.controlClass.value = resolveToValue(viewPreset.title, '');
        UI.cbTypes.controlClass.focusedIndex = viewIdIndex;

        UI.eName.controlClass.focus();

        UI.eName.controlClass.disabled = readOnly;
        UI.cbTypes.controlClass.disabled = readOnly;
        setVisibility(UI.bUseIn, false /*!readOnly*/ );
        setVisibility(UI.bSummaryColumnsBlock, viewPreset.summaryColumns !== undefined);

        if (isCurrent) {
            window.localListen(UI.lvSubViews, 'checkedchanged', function (e) {
                if (e.detail) {
                    let idx = e.detail.div.itemIndex;
                    if (idx >= 0) {
                        let viewId = '';
                        UI.lvSubViews.controlClass.dataSource.locked(function () {
                            viewId = UI.lvSubViews.controlClass.dataSource.getValue(idx).viewId;
                        });

                        if (viewId) {
                            window.views.toggleSubView(viewId, e.detail.checked);
                        }
                    }
                }
            });
        }

        setVisibility(UI.lblChooseColumns, false);

    } else {
        if ((params.sorting !== undefined) || (params.summaryColumns !== undefined)) {
            prepareSortingControls(params.sorting, params.sortingColumns, params.summaryColumns);
        }

        setVisibility(UI.bName, false);
        setVisibility(UI.bType, false);
        setVisibility(UI.bUseIn, false);
        setVisibility(UI.bSortBlock, (params.sorting !== undefined) && (!LV || !LV.controlClass || LV.controlClass.isSortable));
        setVisibility(UI.cbSorting, false);
        setVisibility(UI.bSubViewsBlock, false);
        setVisibility(UI.btnImageSize, false);
        setVisibility(UI.bColumnsBlock, true);
        setVisibility(UI.lblColumns, false);
        setVisibility(UI.bSummaryColumnsBlock, params.summaryColumns !== undefined);
        setVisibility(UI.btnReset, true);
        prepareColumns(columnParams.allColumns, LV);

        setVisibility(UI.lblChooseColumns, true);

        _updateColumnsSettingsLeadText();        
    }

    let colsEditor = loadFile('file:///dialogs/dlgSelectFromList.html');
    let div = document.createElement('div');
    div.innerHTML = colsEditor;
    // get just editor from the dlgSelectFromList dialog
    let editor = qeid(div, 'editorContent').outerHTML;
    UI.columnsEditorSpot.innerHTML = editor;
    requirejs('dialogs/dlgSelectFromList.js'); // need to be before initialiseControls
    initializeControls(UI.columnsEditorSpot);
    UI = getAllUIElements();
    UI['editor_all_header'].classList.remove('padding');
    UI['editor_used_header'].classList.remove('padding');

    // hide editor buttons
    setVisibility(UI.editorButtons, false);
    // initialize 
    columnsEditorInitialized = true;

    if (viewPreset) {
        whenReady(() => {
            presetColumns(params.LV);
        });

    } else {
        columnParams.collection = params.collection;
        initEditor(columnParams);
    }

    window.localListen(UI.btnOK, 'click', function () {

        if (viewPreset) {

            if (UI.eName.controlClass.value === '') {
                UI.eName.controlClass.focus();
                uitools.toastMessage.show(_('Please enter name'), {
                    disableClose: true,
                    delay: 2000,
                    top: 50                              
                });
                return;
            }

            if (UI.cbTypes.controlClass.dataSource.focusedIndex >= 0) {
                let viewId = viewIDs[UI.cbTypes.controlClass.dataSource.focusedIndex];
                let handler = handlers[UI.cbTypes.controlClass.dataSource.focusedIndex];
                let checkedSubViews = [];
                if (UI.lvSubViews.controlClass.dataSource) {
                    let _checkedSubViews = UI.lvSubViews.controlClass.dataSource.getCheckedList();
                    _checkedSubViews.locked(function () {
                        for (let i = 0; i < _checkedSubViews.count; i++)
                            checkedSubViews.push(_checkedSubViews.getValue(i).viewId);
                    });
                }

                viewPreset.title = UI.eName.controlClass.value;
                viewPreset.viewMode = viewId;
                viewPreset.subViews = checkedSubViews;
                viewPreset.grouping = groupings[0];

                let newList = getColumnList();
                if (UI.lvColumns && UI.lvColumns.controlClass && UI.lvColumns.controlClass.setColumns) {
                    let obj = JSON.parse(newList);
                    let newCols = new Array();
                    obj.forEach(function (item) {
                        let it = UI.lvColumns.controlClass.fieldDefs[item.columnType];
                        if (it) {
                            it.visible = item.visible;
                            newCols.push(it);
                        }
                    });
                    UI.lvColumns.controlClass.setColumns(newCols);
                }

                viewPreset.cols = UI.lvColumns.controlClass.storeColumns();
                viewPreset.adaptWidths = UI.lvColumns.controlClass.adaptColumnsWidth;
                viewPreset.sorting = getSorting();
                viewPreset.summaryColumns = getSummaryColumns();

                // use in
                viewPreset.usedInNodes = [];
                let ds = UI.cbUseIn.controlClass.dataSource;
                if (ds) {
                    ds.locked(function () {
                        for (let i = 0; i < ds.count; i++)
                            if (ds.isChecked(i))
                                viewPreset.usedInNodes.push(ds.getValue(i).id);
                    });
                    if ((viewPreset.usedInNodes.length > 1) && (viewPreset.usedInNodes[0] === everywhereID)) {
                        viewPreset.usedInNodes.shift();
                    }
                }

                viewPreset.edited = true;

                modalResult = 1;
            }
        } else {
            modalResult = 1;
        }
    });

    window.localListen(UI.btnImageSize, 'click', () => {
        let dlg = uitools.openDialog('dlgImageSize', {
            modal: true
        });
    });

    window.localListen(UI.btnSettings, 'click', function () {
        uitools.openDialog('dlgOptions', {
            modal: true,
            defaultPanel: 'pnl_Appearance',
        }, (dlg) => {
            if (dlg.modalResult === 1)
                _updateColumnsSettingsLeadText();
        });
    });

    window.localListen(UI.btnReset, 'click', () => {
        if(!LV || !LV.controlClass || viewPreset)
            return;
        let dSorting = undefined;
        let dSummaryColumns = undefined;
        let dAllColumns = undefined;
        if(LV.controlClass.getDefaultColumns) {
            let newVisList = LV.controlClass.getDefaultColumns();
            if(newVisList)
                window.updateColumnList(newVisList);
        }
        if(LV.controlClass.isSortable && LV.controlClass.getDefaultSortString) {
            dSorting = LV.controlClass.getDefaultSortString();
        }
        if((params.summaryColumns !== undefined) && LV.controlClass.getDefaultSummaryColumns) {
            dSummaryColumns = LV.controlClass.getDefaultSummaryColumns();
        }
        prepareSortingControls(dSorting, params.sortingColumns, dSummaryColumns);
    });
}
window.init = init;

function getSorting() {
    if (isVisible(UI.cbSorting)) {
        if (UI.cbSorting.controlClass.dataSource.focusedItem) {

            let viewHandler = handlers[UI.cbTypes.controlClass.dataSource.focusedIndex];
            return viewHandler.sortBy[UI.cbSorting.controlClass.dataSource.focusedIndex];
        }
    } else {
        let sortStr = '';
        for (let i = 0; i < sorts.length; i++) {
            if (sortStr)
                sortStr += ';';
            sortStr += sorts[i].name;
            if (!sorts[i].ascending)
                sortStr += ' DESC';
        }
        return sortStr;
    }

    return '';
}
window.getSorting = getSorting;

window.getSummaryColumns = function () {
    if (summaryRows)
        return summaryRows.slice();
    else
        return undefined;
}

function initSubViewsLV() {

    let columns = [];
    columns.push({
        visible: true,
        title: '',
        width: 30,
        order: 0,
        isSortable: false,
        headerRenderer: ColumnTrackList.prototype.headerRenderers.renderCheck,
        setupCell: function (div, column) {
            ColumnTrackList.prototype.cellSetups.setupCheckbox(div, column);
        },
        bindData: function (div, item, index) {
            ColumnTrackList.prototype.defaultBinds.bindCheckboxCell(div, item, index);
        }
    });

    columns.push({
        visible: true,
        title: '',
        order: 0,
        isSortable: false,
        bindData: function (div, item, index) {
            div.innerText = item.title;
        }
    });
    UI.lvSubViews.controlClass.defaultColumns = columns;
    UI.lvSubViews.controlClass.setColumns(columns);


}

window.beforeWindowCleanup = function () {
    _cleanSortRows();
    _cleanSummaryRows();
}

window.windowCleanup = function () {
    UI = undefined;
    viewData = undefined;
    viewPreset = undefined;
    handlers = undefined;
    viewIDs = undefined;
    subViews = undefined;
    inEditSortRow = undefined;
    inEditSummaryRow = undefined;
    sorts = undefined;
    summaryRows = undefined;
    fieldDefs  = undefined; 
    summaryFieldDefs = undefined;
    fieldIDs = undefined;
    LV = undefined;
}

//requirejs('helpers/debugTools');
//registerDebuggerEntryPoint.call(this /* method class */, 'init' /* method name to inject */);
