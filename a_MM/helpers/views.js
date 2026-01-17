/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

registerFileImport('helpers/views');

/**
@module Views
*/

export const everywhereID = 'everywhere';
export const playingID = 'playing';
export const playlistsID = 'playlists';

(function () {

    var views_version = 1;
    var lastAddedActions = undefined;
    var _multiView = null;
    var handlers = ['tracks'];

    function _getEditCaption(multiView) {

        var ret = '';

        if (multiView) {
            var current = multiView.activeView;
            if (current && current.viewNode) {
                var node = current.viewNode;
                var lastNode = node;
                var lastViewAs = undefined;
                while (node && node.level > 0) {
                    var viewAs = resolveToValue(nodeHandlers[node.handlerID].viewAs, undefined, node);
                    if (viewAs) {
                        if (lastViewAs) {
                            var doBreak = false;
                            if (lastViewAs.length === viewAs.length) {
                                // check we have same handlers
                                var sameIDCnt = 0;
                                for (var i = 0; i < lastViewAs.length; i++) {
                                    for (var j = 0; j < viewAs.length; j++) {
                                        if (lastViewAs[i] === viewAs[j]) {
                                            sameIDCnt++;
                                            break;
                                        }
                                    }
                                }
                                if (sameIDCnt === viewAs.length) {
                                    // nothing to do
                                } else
                                    doBreak = true;
                            } else
                                doBreak = true;

                            if (doBreak) {
                                if (nodeUtils.getHasChildren(lastNode)) {
                                    node = lastNode;
                                }
                                break;
                            }

                        } else
                            lastViewAs = viewAs;
                        lastNode = node;
                    }
                    node = node.parent;
                }
                if (node && lastNode && node.level <= 0) {
                    if ((node.level === 0) && (nodeUtils.getHasChildren(lastNode) || (handlers.indexOf(lastNode.handlerID) >= 0)))
                        node = lastNode;
                }

                while (node && node.level >= 0) {
                    if (node.level <= 1) { // use just 2 top levels
                        if (ret)
                            ret = ' > ' + ret;
                        ret = nodeUtils.getNodeTitle(node) + ret;
                    }
                    node = node.parent;
                }
            }
        }
        return ret;
    };

    function _generateID() {
        var d = new Date().getTime();
        if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
            d += performance.now(); //use high-precision timer if available
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = (d + Math.random() * 16) % 16 | 0;
            d = Math.floor(d / 16);
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
    };

    function _getViewModeRoot(_viewId) {
        return _viewId;
    };

    function _isCompatibleView(viewData, view) {
        if (viewData.availableViews) {
            var viewMode = _getViewModeRoot(view.viewMode);
            var AV = viewData.availableViews();
            return AV.some(function (item) {
                var itm = _getViewModeRoot(item);
                return itm == viewMode;
            });
        }
        return false;
    };

    function applyMethods(data) {
        data.getCopy = function () {
            var useData = applyMethods(copyObject(data));
            useData.subViews = data.subViews;
            useData.usedInNodes = data.usedInNodes;
            useData.cols = data.cols;
            return useData;
        };

        data.isCompatible = function (viewData) {
            var ret = _isCompatibleView(viewData, this);
            data.editable = ret;
            return ret;
        };

        data.storeSubViewsStates = function (multiView) {
            data.subViewsStates = data.subViewsStates || {};
            var viewHandler = getViewHandler(data.viewMode);
            if (viewHandler && viewHandler.subViews) {
                var SV = viewHandler.subViews;
                for (var i = 0; i < SV.length; i++) {
                    var handler = getViewHandler(SV[i]);
                    if (handler && handler.controlClass) {
                        var elem = qes(multiView.container, '[data-control-class=' + handler.controlClass + ']')
                        if (elem && elem.length) {
                            for (var j = 0; j < elem.length; j++) {
                                if (elem[j].controlClass && elem[j].controlClass.storePersistentState) {
                                    var state = elem[j].controlClass.storePersistentState({});
                                    data.subViewsStates[SV[i]] = state;
                                }
                            }
                        }
                    }
                }
            }
        };

        data.applyView = function (viewData, multiView, params) {

            if (!data.deletable) {
                // it's built-in view ... refresh the view
                multiView.viewAs(data.viewMode, false, null, params);

                var LVControl = multiView.getDefaultFocusControl();
                if (LVControl && LVControl.controlClass) {
                    if (data.sorting)
                        LVControl.controlClass.autoSortString = data.sorting;
                    if (data.summaryColumns)
                        LVControl.controlClass.summaryColumns = data.summaryColumns;
                }

                multiView._hideContextActions(multiView.activeView);
                multiView._showContextActions(multiView.activeView);
            } else {

                // get copy of the object and find available view with same root type
                var useData = data.getCopy();

                multiView._customViewReload = multiView.customPresetName === useData.id;
                multiView._customViewLoading = true;
                multiView._customViewLoadingID = useData.id;

                // we need to set _state property because of correct settings loading
                viewData._state = {
                    hiddenSubViews: {}
                };

                var viewHandler = getViewHandler(useData.viewMode);
                if (viewHandler && viewHandler.subViews) {
                    var SV = viewHandler.subViews;
                    for (var i = 0; i < SV.length; i++) {
                        viewData._state.hiddenSubViews[SV[i]] = !useData.subViews.includes(SV[i]);
                    }
                }

                multiView._storeLastCustomView(); // #21492
                params = params || {};
                params.dontStoreCustomView = true;
                multiView._viewHandlerState = viewData._state;
                multiView.viewAs(useData.viewMode, false, viewData, params);

                viewData._state = undefined;

                var LVControl = multiView.getDefaultFocusControl();

                multiView._prepareCustomView(useData);


                if (LVControl && LVControl.controlClass) {
                    if (LVControl.controlClass.restorePersistentState) {
                        var state = {
                            allColumns: useData.cols,
                            sortString: useData.sorting,
                            sorting: useData.sorting,
                            summaryColumns: useData.summaryColumns,
                            adaptColumnsWidth: useData.adaptWidths
                        };
                        LVControl.controlClass.restorePersistentState(state);
                    } else {
                        if (useData.sorting !== '') {
                            LVControl.controlClass.autoSortString = useData.sorting;
                        }
                        if (useData.summaryColumns)
                            LVControl.controlClass.summaryColumns = useData.summaryColumns;
                    }
                }

                // restore subViews state
                if (viewHandler && viewHandler.subViews) {
                    var SV = viewHandler.subViews;
                    for (var i = 0; i < SV.length; i++) {
                        if (useData.subViewsStates && useData.subViewsStates[SV[i]]) {
                            var storedObj = useData.subViewsStates[SV[i]];
                            var handler = getViewHandler(SV[i]);
                            if (handler && handler.controlClass) {
                                var elem = qes(multiView.container, '[data-control-class=' + handler.controlClass + ']')
                                if (elem && elem.length) {
                                    for (var i = 0; i < elem.length; i++) {
                                        if (elem[i].controlClass) {
                                            elem[i].controlClass.restorePersistentState(storedObj);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // store node settings
                var state = nodeUtils.getNodeHandlerState(multiView.activeView);
                state.viewAsId = multiView.customPresetName;
                nodeUtils.setNodeHandlerState(multiView.activeView, state);

                multiView._customViewLoadingID = undefined;
                multiView._customViewLoading = undefined;
                multiView._customViewReload = undefined;
            }
        };
        data.editable = true;
        data.deletable = true;
        data.edited = false;

        return data;
    };

    function applyMethodsToArray(ar) {
        if (isFunction(ar.forEach)) {
            ar.forEach(function (item) {
                applyMethods(item);
            });
        }
        return ar;
    };

    /**
    Views manager and helper.

    @class window.views
    */

    if (!isMainWindow) { // we need to always use views class from main window
        window.views = app.dialogs.getMainWindow().getValue('views');
    } else {
        window.views = {
            getViewsMenu: function (viewData, multiView, addManageViews, addingActions) {

                var retArray = [];

                if (!addManageViews) {

                    if (!addingActions && lastAddedActions) {
                        // old toolbar actions are removed and new added ... so in case user will delete any old custom view it will not be removed
                        // from toolbar at all ... for this reason we have backup of the last actions so deleted views can be removed correctly.
                        retArray = lastAddedActions.slice();
                        lastAddedActions = undefined;
                        return retArray;
                    }

                    // put stored views (for current viewID)
                    var views = this.getCompatibleViews(viewData);
                    views.forEach(function (view, idx) {

                        var canShow = true;
                        /*if (view.usedInNodes) {
                            var canShow = view.usedInNodes.indexOf(everywhereID) >= 0;
                            if (!canShow) {
                                var coll = nodeUtils.getNodeCollection(viewData.viewNode);
                                if (coll) {
                                    canShow = view.usedInNodes.indexOf(coll.persistentID) >= 0;
                                } else {
                                    if (viewData.viewNode.handlerID === 'playlist')
                                        canShow = view.usedInNodes.indexOf(playlistsID) >= 0;
                                    else if (viewData.viewNode.handlerID === 'npview')
                                        canShow = view.usedInNodes.indexOf(playingID) >= 0;
                                }
                            }
                        }*/

                        if (canShow) {
                            var vHandler = getViewHandler(view.viewMode);
                            var icon = '';
                            if (vHandler)
                                icon = vHandler.icon ? vHandler.icon : '';

                            retArray.push({
                                viewId: view.viewMode,
                                id: view.id,
                                title: view.title,
                                icon: icon,
                                checked: function () {
                                    return (multiView.customPresetName && multiView.customPresetName === this.id);
                                },
                                execute: function () {
                                    var view = window.views.getCompatibleView(viewData, this.id);
                                    view.applyView(viewData, multiView);
                                },
                                grouporder: (multiView.isEmbedded) ? 20 : 10,
                                order: idx + 500,
                                actionGroup: 'view',
                                actionStack: 'viewSelection',
                                identifier: 'view_' + view.id,
                                iconPriority: retArray.length,
                            });
                        }
                    });

                    lastAddedActions = retArray.slice();

                } else {
                    // add manage views entry
                    retArray.push({
                        viewId: '',
                        grouptitle: _('Customize'),
                        title: _('Manage views') + '...',
                        icon: 'options',
                        visible: function () {
                            var currentViewId = '';

                            if (multiView.activeView) {
                                currentViewId = multiView.activeView.currentViewId;
                                return resolveToValue(multiView.activeView.nodehandler.customizable, true);
                            }
                            return true;
                        },
                        disabled: function () {
                            return false;
                        },
                        execute: function () {
                            var state = null;
                            var currentViewId = '';
                            var caption = '';

                            if (multiView.activeView) {
                                if (!!multiView.customPresetName)
                                    multiView._storeLastCustomView();
                                else
                                    multiView.storePersistentStates();
                                state = nodeUtils.getNodeHandlerState(multiView.activeView);
                                currentViewId = multiView.activeView.currentViewId;
                                caption = _getEditCaption(multiView);
                            }

                            var LVControl = multiView.getDefaultFocusControl();

                            var dlg = uitools.openDialog('dlgManageViews', {
                                modal: true,
                                viewData: viewData,
                                caption: caption,
                                state: state,
                                currentViewId: currentViewId,
                                multiView: multiView,
                                LV: LVControl,
                                activePresetName: multiView.customPresetName,
                                apply: function (view) {
                                    multiView._hideContextActions(multiView.activeView);
                                    multiView._showContextActions(multiView.activeView);

                                    if (view && _isCompatibleView(multiView.activeView, view)) {
                                        view.applyView(viewData, multiView);
                                    }
                                }
                            });
                            dlg.whenClosed = function () {
                                if (dlg.modalResult === 1) {

                                    multiView._hideContextActions(multiView.activeView);
                                    multiView._showContextActions(multiView.activeView);
                                    //multiView.restorePersistentStates();
                                }
                            };
                            app.listen(dlg, 'closed', dlg.whenClosed);
                        },
                        grouporder: 999,
                        actionGroup: 'viewManage',
                        actionStack: 'viewSelection',
                        identifier: 'manage_views',
                        iconPriority: 99999
                    });
                }

                return retArray;
            },

            saveCurrentView: function () {
                if (window.currentTabControl) {
                    if (window.currentTabControl.multiviewControl) {
                        if (window.currentTabControl.multiviewControl._isCustomView())
                            window.currentTabControl.multiviewControl._storeLastCustomView();
                        else
                            window.currentTabControl.multiviewControl.storePersistentStates();
                    }
                }
            },

            canBeConfigured: function (viewData) {
                if (viewData && viewData.availableViews) {
                    var AV = resolveToValue(viewData.availableViews(), []);
                    return (AV.length > 1) || (AV.indexOf('nodeList') < 0);
                }
                return false;
            },

            getEditCaption: function (multiView) {
                return _getEditCaption(multiView);
            },

            createNewFromCurrent: function (multiView, title, id) {
                var data = window.views.createNew(multiView.activeView.currentViewId);
                if (title)
                    data.title = title;
                if (id)
                    data.id = id;

                // read current LV state
                var state = {};

                var LVControl = multiView.getDefaultFocusControl();

                var vHandler = getViewHandler(multiView.activeView.currentViewId);
                var listViewBased = (vHandler.baseViewType === 'list') || (vHandler.baseViewType === 'listByAlbum');

                if (listViewBased && multiView.activeView.nodehandler && (multiView.activeView.nodehandler.defaultColumnSort !== undefined))
                    data.sorting = window.uitools.getDefaultColumnSort(multiView.activeView);

                if (isArray(vHandler.defaultSummaryColumns)) {
                    data.summaryColumns = vHandler.defaultSummaryColumns;
                }

                if (LVControl && LVControl.controlClass && LVControl.controlClass.storePersistentState)
                    state = LVControl.controlClass.storePersistentState(state) || {};

                if (state) {
                    if (state.allColumns !== undefined)
                        data.cols = state.allColumns;
                    if (state.sortString !== undefined)
                        data.sorting = state.sortString;
                    if (state.sorting !== undefined)
                        data.sorting = state.sorting;
                    else
                    if (LVControl && LVControl.controlClass && LVControl.controlClass.autoSortSupported)
                        data.sorting = LVControl.controlClass.autoSortString;
                    if (state.adaptColumnsWidth !== undefined)
                        data.adaptWidths = state.adaptColumnsWidth;
                    if (state.summaryColumns !== undefined)
                        data.summaryColumns = state.summaryColumns;
                }

                if (data.cols && data.cols.length && listViewBased && multiView.activeView.nodehandler && (multiView.activeView.nodehandler.requiredColumns !== undefined)) {
                    // there are some automatically added columns in this views
                    var colsToAdd = resolveToValue(multiView.activeView.nodehandler.requiredColumns, '');
                    var colsAr = colsToAdd.split(',');
                    for (var j = 0; j < data.cols.length; j++) {
                        if (colsAr.includes(data.cols[j].columnType)) {
                            data.cols[j].visible = true;
                            data.cols[j].fixed = true;
                        }
                    }
                }

                // sub views
                var viewHandler = getViewHandler(data.viewMode);
                if (viewHandler.subViews) {
                    var SV = viewHandler.subViews;
                    for (var i = 0; i < SV.length; i++) {
                        if (!multiView._viewHandlerState.hiddenSubViews[SV[i]])
                            data.subViews.push(SV[i]);
                    }
                }

                return data;
            },

            createNew: function (currentViewId) {
                var data = {
                    id: _generateID(),
                    title: '',
                    viewMode: currentViewId || '',
                    subViews: [],
                    grouping: '',
                    cols: [],
                    sorting: '',
                    adaptWidths: false,
                };

                data = applyMethods(data);
                return data;
            },

            getViewDataSupportedViews: function (viewData, multiView) {
                var ret = [];
                _multiView = multiView;

                if (!window.views.canBeConfigured(viewData))
                    return [];

                if (viewData.availableViews) {
                    var AV = resolveToValue(viewData.availableViews(), []);
                    var persistent = app.getValue(multiView.getPersistentStateRootKey(), {});
                    var viewpersistent = app.getValue(nodeUtils._getViewHandlersStoreKey(viewData.viewNode), {});
                    for (var i = 0; i < AV.length; i++) {
                        var viewId = AV[i];
                        var vHandler = getViewHandler(viewId);

                        var act = undefined;

                        // current view create from current
                        if (multiView && multiView.activeView)
                            if ((viewId === multiView.activeView.currentViewId) && (!multiView.customPresetName)) {
                                act = this.createNewFromCurrent(multiView);
                            }

                        if (!act) {
                            act = this.createNew(viewId);

                            var listViewBased = (vHandler.baseViewType === 'list') || (vHandler.baseViewType === 'listByAlbum');

                            if (listViewBased && viewData.nodehandler && (viewData.nodehandler.defaultColumnSort !== undefined))
                                act.sorting = window.uitools.getDefaultColumnSort(viewData);

                            if (isArray(vHandler.defaultSummaryColumns)) {
                                act.summaryColumns = vHandler.defaultSummaryColumns;
                            }

                            if (persistent && persistent[vHandler.controlClass]) {
                                if (persistent[vHandler.controlClass].allColumns !== undefined)
                                    act.cols = persistent[vHandler.controlClass].allColumns;
                                if (persistent[vHandler.controlClass].sortString !== undefined)
                                    act.sorting = persistent[vHandler.controlClass].sortString;
                                if (persistent[vHandler.controlClass].adaptColumnsWidth !== undefined)
                                    act.adaptWidths = persistent[vHandler.controlClass].adaptColumnsWidth;
                                if (persistent[vHandler.controlClass].summaryColumns !== undefined)
                                    act.summaryColumns = persistent[vHandler.controlClass].summaryColumns;
                            }

                            if (act.cols && act.cols.length && listViewBased && viewData.nodehandler && (viewData.nodehandler.requiredColumns !== undefined)) {
                                // there are some automatically added columns in this views
                                var colsToAdd = resolveToValue(viewData.nodehandler.requiredColumns, '');
                                var colsAr = colsToAdd.split(',');
                                for (var j = 0; j < act.cols.length; j++) {
                                    if (colsAr.includes(act.cols[j].columnType)) {
                                        act.cols[j].visible = true;
                                        act.cols[j].fixed = true;
                                    }
                                }
                            }

                            var subViewsSet = false;
                            if (viewpersistent && viewpersistent[vHandler.viewId]) {
                                var setup = viewpersistent[vHandler.viewId];
                                if (setup.hiddenSubViews !== undefined) {
                                    vHandler.subViews.forEach((sub) => {
                                        var subView = setup.hiddenSubViews[sub];
                                        if (subView !== undefined && subView !== true) {
                                            act.subViews.push(sub);
                                        }
                                    });
                                    subViewsSet = true;
                                }
                            }
                            if (!subViewsSet && vHandler.subViews) {
                                vHandler.subViews.forEach((sub) => {
                                    if (vHandler.hiddenSubViews) {
                                        if (vHandler.hiddenSubViews.indexOf(sub) < 0)
                                            act.subViews.push(sub);
                                    } else
                                        act.subViews.push(sub);
                                });
                            }
                        }

                        act.title = resolveToValue(vHandler.title, 'viewHandler[' + viewId + '].title is undefined!');
                        act.editable = true;
                        act.deletable = false;

                        ret.push(act);
                    }
                }

                return ret;
            },

            getCompatibleViews: function (viewData, getAll) {
                var retArray = [];
                var dups = [];
                var data = app.getValue('custom_views', {
                    presets: []
                });
                if (data.presets.length) {
                    for (var j = 0; j < data.presets[0].views.length; j++) {
                        if (_isCompatibleView(viewData, data.presets[0].views[j]) || getAll) {
                            if (!dups[data.presets[0].views[j].id]) {
                                dups[data.presets[0].views[j].id] = true;
                                retArray.push(applyMethods(data.presets[0].views[j]));
                            }
                        }
                    }
                }
                return retArray;
            },

            getViews: function () {
                var retArray = [];

                var data = app.getValue('custom_views', {
                    presets: []
                });
                if (data.presets.length)
                    retArray = applyMethodsToArray(data.presets[0].views);

                return retArray;
            },

            setCompatibleViews: function (viewData, viewID, views, allViews) {

                if (!allViews) { // in views we have just supported views
                    // add all non-compatible views
                    var used = [];

                    for (var i = views.length - 1; i >= 0; i--) {
                        if (views[i].id)
                            used[views[i].id] = true;
                    }
                    var data = app.getValue('custom_views', {
                        presets: []
                    });
                    if (data.presets.length) {
                        for (var j = 0; j < data.presets[0].views.length; j++) {
                            var preset = data.presets[0].views[j];
                            if (!_isCompatibleView(viewData, preset) && !used[preset.id]) {
                                used[preset.id] = true;
                                views.push(applyMethods(preset));
                            }
                        }
                    }
                }

                // save them
                this.setViews(viewID, views);
            },

            setViews: function (viewID, views) {
                if (!this._saveInProgress) {
                    this._saveInProgress = true;

                    var data = app.getValue('custom_views', {
                        presets: []
                    });
                    // remove non-editable views
                    var persistent = null;
                    var viewpersistent = null;
                    var changed = false;
                    var current;
                    if (_multiView && _multiView.activeView) {
                        persistent = app.getValue(_multiView.getPersistentStateRootKey(), {});
                        viewpersistent = app.getValue(nodeUtils._getViewHandlersStoreKey(_multiView.activeView.viewNode), {});
                    }
                    for (var i = views.length - 1; i >= 0; i--) {
                        if (!views[i].id)
                            views[i].id = _generateID();

                        if (!views[i].isNew && views[i].edited) {

                            if (!views[i].deletable) {
                                // built-in view was edited ... save new settings to persistent
                                if (persistent) {
                                    if (views[i].viewMode) {
                                        var vHandler = getViewHandler(views[i].viewMode);
                                        if (vHandler && persistent[vHandler.controlClass]) {
                                            var oldCols = persistent[vHandler.controlClass].allColumns;
                                            persistent[vHandler.controlClass].allColumns = views[i].cols;
                                            persistent[vHandler.controlClass].sortString = views[i].sorting;
                                            persistent[vHandler.controlClass].sorting = views[i].sorting;
                                            persistent[vHandler.controlClass].adaptColumnsWidth = views[i].adaptWidths;

                                            if (oldCols && oldCols.length) {
                                                persistent[vHandler.controlClass].allColumns.forEach((col) => {
                                                    for (var c = 0; c < oldCols.length; c++) {
                                                        if (col.columnType === oldCols[c].columnType) {
                                                            col.width = oldCols[c].width;
                                                            break;
                                                        }
                                                    }
                                                });
                                            }

                                            changed = true;
                                        }
                                    }
                                }
                                if (viewpersistent) {
                                    if (views[i].viewMode) {
                                        var vHandler = getViewHandler(views[i].viewMode);
                                        if (vHandler && viewpersistent[vHandler.viewId]) {
                                            viewpersistent[vHandler.viewId].hiddenSubViews = {};
                                            for (var s = 0; s < vHandler.subViews.length; s++) {
                                                var sub = vHandler.subViews[s];
                                                viewpersistent[vHandler.viewId].hiddenSubViews[sub] = views[i].subViews.indexOf(sub) < 0;
                                            }
                                            changed = true;
                                        }
                                    }
                                }
                            } else {
                                if (data && data.presets && data.presets.length) {
                                    for (var j = 0; j < data.presets[0].views.length; j++) {
                                        if (data.presets[0].views[j].id === views[i].id) {
                                            var presetCols = data.presets[0].views[j].cols;

                                            if (presetCols && presetCols.length) {
                                                views[i].cols.forEach((col) => {
                                                    for (var c = 0; c < presetCols.length; c++) {
                                                        if (col.columnType === presetCols[c].columnType) {
                                                            col.width = presetCols[c].width;
                                                            break;
                                                        }
                                                    }
                                                });
                                            }
                                            break;
                                        }
                                    }
                                }
                            }
                        }

                        // update view if current was edited
                        if (views[i].edited) {
                            if (_multiView && _multiView.activeView) {
                                if ((_multiView.activeView.currentViewId === views[i].viewMode) &&
                                    ((_multiView.customPresetName === views[i].id) || (!_multiView.customPresetName && !views[i].deletable))) {
                                    current = views[i];
                                }
                            }
                        }

                        if (!views[i].deletable) {
                            views.splice(i, 1);
                        }
                    }
                    if (changed) {
                        app.setValue(_multiView.getPersistentStateRootKey(), persistent);
                        app.setValue(nodeUtils._getViewHandlersStoreKey(_multiView.activeView.viewNode), viewpersistent);
                    }

                    if (data.presets.length) {
                        data.presets[0].views = views;
                    } else {
                        data.presets.push({
                            viewID: viewID,
                            views: views
                        });
                    }
                    app.setValue('custom_views', data);

                    if (current && _multiView && _multiView.activeView) {
                        // current view was edited so we need to refresh it otherwise opening to new view will save old settings to persistent
                        _multiView.restorePersistentStates();
                        current.applyView(_multiView.activeView, _multiView);
                    }


                    this._saveInProgress = undefined;
                }
            },

            getCompatibleView: function (viewData, id) {
                var allViews = window.views.getCompatibleViews(viewData);
                for (var i = 0; i < allViews.length; i++) {
                    if (allViews[i].id === id) {
                        return allViews[i];
                    }
                }
                return null;
            },

            setView: function (viewData, data) {
                var allViews = window.views.getViews();
                for (var i = 0; i < allViews.length; i++) {
                    if (allViews[i].id === data.id) {
                        allViews[i] = data;
                        window.views.setViews(viewData.currentViewId, allViews);
                        break;
                    }
                }
            },

            toggleSubView: function (viewId, show) {
                _multiView._executeSubView(viewId, show, _multiView.customPresetName);
            },

            getViewModeRoot: function (_viewId) {
                return _getViewModeRoot(_viewId);
            },

        };
    }

    if (!webApp) {
        whenReady(() => {
            var ver = app.getValue('custom_views_version', 0);
            if (ver < views_version) {

                if (ver === 0) {
                    var data = app.getValue('custom_views', {
                        presets: []
                    });

                    for (var i = 0; i < data.presets.length; i++) {
                        for (var j = 0; j < data.presets[i].views.length; j++) {
                            data.presets[i].views[j].id = _generateID();
                        }
                    }
                    app.setValue('custom_views', data);
                }


                app.setValue('custom_views_version', views_version);
            }
        });
    }

})();
