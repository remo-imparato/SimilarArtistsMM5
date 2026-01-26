registerFileImport('controls/multiview');

'use strict';

import { ViewHandler } from '../viewHandlers';
import Control from './control';


/**
@module UI snippets
*/


/**
Multiview - control for displaying selected view.

@class Multiview
@constructor
@extends Control
*/

export default class Multiview extends Control {
    lastFocusedControl: HTMLElement;
    private _wasVisible: boolean;
    mainControl: HTMLElement;
    _activeView: ViewData;
    private _toolbar: any;
    viewPanel: any;
    usedControls: any[];
    private _lastUsedControls: any[];
    toolBtnParams: AnyDict;
    controlCache: any;
    private _subViewToShow: any;
    private _subViewToHide: any;
    private _toolbarActionsShown: boolean;
    private _customViewProcessing: any;
    customPresetName: boolean;
    private _nodeHandlerState: any;
    _customViewReload: any;
    lastView: any;
    private _viewHandlerState: any;
    private _customViewLoading: boolean;
    _customViewLoadingID: boolean;
    private _lastMiddlePanel: any;
    private _lastScroller: any;
    customPresetTitle: any;
    isEmbedded: any;

    initialize(rootelem, params) {
        super.initialize(rootelem, params);

        this._wasVisible = false;
        this.controlCache = new ControlCache(this.container);

        this.localListen(app, 'close', function (token) {
            if (this.viewPanel)
                this.storePersistentStates();
        }.bind(this));

        this.toolBtnParams = {};
        let _this = this;
        Object.defineProperty(this.toolBtnParams,
            'parent', {
                get: function () {
                    return _this.lastFocusedControl;
                },
            });

        this.localListen(document.body, 'maintabchange', function (e) {
            if (isChildOf(e.detail.oldTabPanel, this.container)) {
                this._hideContextActions(this.activeView);
                let pnl = e.detail.oldTabPanel.controlClass;
                if(pnl && pnl._saveOrderButton) {
                    setVisibilityFast(pnl._saveOrderButton, false, {
                        animate: false
                    });
                }
            }
            else 
            if (isChildOf(e.detail.newTabPanel, this.container)) {
                this._showContextActions(this.activeView);
                let pnl = e.detail.newTabPanel.controlClass;
                if(pnl && pnl._saveOrderButton) {
                    setVisibilityFast(pnl._saveOrderButton, true, {
                        animate: false
                    });
                }                
            }

            //this.refreshToolbar();
        }.bind(this));

        this.localListen(this.container, 'focusedcontrol', function (evt) {
            // update context actions
            if (this.lastFocusedControl && this.lastFocusedControl.controlClass) {
                let cc = this.lastFocusedControl.controlClass;
                if (cc.toolbarActions && this.toolbar) {
                    let cAct = resolveToValue(cc.toolbarActions, [], this.activeView);
                    this.toolbar.hideActions(cAct, this.toolBtnParams);
                }
            }
            if (evt.detail.control) {
                this.lastFocusedControl = evt.detail.control.container;
                this.updateFocusedLVActions();
            } else
                this.lastFocusedControl = undefined;
        }.bind(this));

        this.localListen(this.container, 'selectionChanged', function (evt) {
            if (evt.detail.control && isVisible(evt.detail.control.container, false))
                this.lastFocusedControl = evt.detail.control.container;

            this.requestFrame(() => {
                // update context actions
                this.updateFocusedLVActions();
            }, 'updateFocusedLVActions');
        }.bind(this));
    }

    updateFocusedLVActions() {
        if (!this.toolbar)
            return;
        let lvActions = this._getFocusedLVActions();
        let hideAct = [];
        let showAct = [];
        forEach(lvActions, function (act) {
            let isvisible = resolveToValue(act.visible, true, this.toolBtnParams);
            if (isPromise(isvisible)) {
                isvisible = true; // TODO: implement correct functionality for Promises, if needed
            }
            if (isvisible) {
                showAct.push(act);
            } else {
                hideAct.push(act);
            }
        }.bind(this));
        if (hideAct.length > 0)
            this.toolbar.hideActions(hideAct, this.toolBtnParams);
        if (showAct.length > 0)
            this.toolbar.showActions(showAct, this.toolBtnParams);
    }

    _getFocusedLVActions(assignSelf?:boolean) {
        let lvActions = [];
        if (this.lastFocusedControl && this.lastFocusedControl.controlClass) {
            let cc = this.lastFocusedControl.controlClass; // @ts-ignore
            if (cc.toolbarActions) { // @ts-ignore
                resolveToValue(cc.toolbarActions, [], this.activeView).forEach(function (actn) {
                    let act = eval(actn);
                    if (assignSelf)
                        act.multiviewControl = this;
                    lvActions.push(act);
                }.bind(this));
            }
        }
        return lvActions;
    }

    _cleanUpCustomView() {
        if (this.customPresetName && !this._customViewProcessing) {
            this.customPresetName = undefined;
        }
    }

    _prepareCustomView(data) {
        if (data) {
            this.customPresetName = data.id;
            this.customPresetTitle = data.title;
        } else {
            this.customPresetName = undefined;
            this.customPresetTitle = undefined;
        }
    }

    _storeLastCustomView() {
        if (this.customPresetName && this.activeView && !this._customViewProcessing && !this._customViewReload) { // store old settings
            let oldPreset = window.views.getCompatibleView(this.activeView, this.customPresetName);
            let data = window.views.createNewFromCurrent(this, this.customPresetTitle, this.customPresetName);
            if (oldPreset) {
                //data.subViews = oldPreset.subViews;
                data.usedInNodes = oldPreset.usedInNodes;
                data.storeSubViewsStates(this);
            }
            window.views.setView(this.activeView, data);

            /*var state = nodeUtils.getNodeHandlerState(this.activeView);
            state.viewAsId = this.customPresetName;
            nodeUtils.setNodeHandlerState(this.activeView, state);*/
            return true;
        }
        return false;
    }

    _getViewActions(viewData: ViewData, assignSelf: boolean, onlyViewSelection?:boolean) {

        let _this = this;
        let vActions;
        if (!onlyViewSelection)
            vActions = this._getFocusedLVActions(assignSelf);
        else
            vActions = [];

        if (!viewData)
            return vActions;

        let _addForHandler = function (handler) {
            if (handler.toolbarActions) {
                resolveToValue(handler.toolbarActions, [], viewData).forEach(function (actn) {
                    let act = eval(actn);
                    if (assignSelf)
                        act.multiviewControl = _this;
                    vActions.push(act);
                });
            }
        };
        
        let viewHandler = getViewHandler(viewData.currentViewId);
        if (!onlyViewSelection)
            _addForHandler(viewHandler);

        let nHandler = nodeHandlers[viewData.viewNode.handlerID];
        assert(nHandler, 'Node handler for ' + viewData.viewNode.handlerID + ' does not exist!');
        if (!onlyViewSelection)
            _addForHandler(nHandler);

        if (viewData.availableViews) {
            let AV = viewData.availableViews();
            for (let i = 0; i < AV.length; i++) {
                let viewId : string = AV[i];
                let vHandler = getViewHandler(viewId);
                if ((AV.length > 1 /* issue #15537 */ ) || (viewHandler.subViews || viewHandler.imageSizeMenu || viewHandler.sortByNames /* issue #15515 */ )) {
                    let act = {
                        viewId: viewId,
                        grouptitle: (i === 0) ? _('Views') : undefined,
                        title: resolveToValue(vHandler.isHome) ? _('Home') : (vHandler.title !== undefined) ? vHandler.title : 'viewHandler[' + viewId + '].title is undefined!',
                        icon: vHandler.icon ? vHandler.icon : '',
                        execute: function () {
                            _this.viewAs(this.viewId);
                            let LVControl = _this.getDefaultFocusControl();
                            if (LVControl)
                                LVControl.focus(); // #18235#c64849
                        },
                        checked: function () {
                            let res = false;
                            if (_this.customPresetName) return res;
                            if (_this.activeView && (_this.activeView.currentViewId == this.viewId))
                                res = true;
                            return res;
                        },
                        grouporder: (this.isEmbedded) ? 20 : 10, // embedded multi-view (e.g. in case of collection "Tabbed" view)
                        order: i,
                        actionGroup: 'view',
                        actionStack: 'viewSelection',
                        identifier: viewId,
                        iconPriority: i
                    };
                    vActions.push(act);
                }
            }

            vActions = vActions.concat(window.views.getViewsMenu(viewData, _this, false, assignSelf));

            if ((nodeUtils.getNodeCollection(viewData.viewNode) && !viewHandler.isCollectionBrowser) /*|| (viewData.viewNode.handlerID == 'search') -- disabled per #16067 item 4 */ ) {
                let nh = getNodeHandler(viewData);
                if (nh && nh.filterSupport != false)
                    vActions.push(actions.viewFilter);
            }
        }

        if (onlyViewSelection)
            return vActions;

        if (viewHandler.sortByNames) {
            viewHandler.sortByNames.forEach(function (sort, idx) {
                vActions.push({
                    grouptitle: (idx === 0) ? _('Sort by') : undefined,
                    title: sort,
                    execute: function () {
                        let LVControl = _this.getDefaultFocusControl();
                        if (LVControl && LVControl.controlClass) { // @ts-ignore
                            LVControl.controlClass.autoSortString = viewHandler.sortBy[idx];
                            LVControl.focus(); // #18235#c64849
                        }
                    },
                    checkable: true,
                    checked: function () {
                        let res = false;
                        let LVControl = _this.getDefaultFocusControl();
                        if (LVControl && LVControl.controlClass) {
                            res = (LVControl.controlClass.dataSource && LVControl.controlClass.dataSource.autoSortString === viewHandler.sortBy[idx]);
                        }
                        return res;
                    },
                    grouporder: 30,
                    actionGroup: 'view',
                    actionStack: 'viewSelection',
                    noStackLead: true,
                    identifier: 'sort_' + idx,
                });
            });
        }
              
        if (viewHandler.subViews) {
            let SV = viewHandler.subViews;
            for (let i = 0; i < SV.length; i++) {
                let viewId : string = SV[i];
                let vHandler = getViewHandler(viewId);
                if (vHandler.permanent) // permanent (always enabled) sub-view
                    continue;
                let _act = {
                    viewId: viewId,
                    grouptitle: (i === 0) ? _('View elements') : undefined,
                    title: (vHandler.title !== undefined) ? vHandler.title : 'viewHandler[' + viewId + '].title is undefined!',
                    icon: vHandler.icon ? vHandler.icon : '',
                    mutualExclusiveWith: vHandler.mutualExclusiveWith,
                    execute: function () {
                        if (this.mutualExclusiveWith && _this._viewHandlerState.hiddenSubViews[this.viewId]) {
                            forEach(this.mutualExclusiveWith, (subViewId) => {
                                if (!_this._viewHandlerState.hiddenSubViews[subViewId])
                                    _this._executeSubView(subViewId); // to hide mutual exclusive sub-view before showing our sub-view
                            });
                        }
                        _this._executeSubView(this.viewId, undefined, _this.customPresetName);
                    },
                    checkable: true,
                    checked: function () {
                        return !_this._viewHandlerState.hiddenSubViews[this.viewId];
                    },
                    grouporder: 40,
                    actionGroup: 'view',
                    actionStack: 'viewSelection',
                    noStackLead: true,
                    identifier: viewId,
                    iconPriority: i
                };
                vActions.push(_act);                
            }
        }

        if (viewHandler.imageSizeMenu) {
            vActions.push({
                viewId: '',
                grouptitle: _('Customize'),
                title: _('Image size') + '...',
                icon: 'resize',
                execute: function () {
                    let dlg = uitools.openDialog('dlgImageSize', {
                        modal: true
                    });
                },
                grouporder: 999,
                actionGroup: 'viewManage',
                actionStack: 'viewSelection',
                noStackLead: true,
                identifier: 'image_size',
                iconPriority: 99999
            });
        }

        vActions = vActions.concat(window.views.getViewsMenu(viewData, _this, true, assignSelf));

        return vActions;
    }

    _executeSubView(viewId, show?, presetName?) {
        let state = nodeUtils.getViewHandlerState(this.activeView);

        // #16379: hiddenSubViews must not be an array ... otherwise stringify doesn't work well and properties are not converted
        // hiddenSubViews can be incorrectly created as array because of bug in views management so i've added this check
        if (state && isArray(state.hiddenSubViews))
            state.hiddenSubViews = {};

        if (presetName) {
            let view = window.views.getCompatibleView(this.activeView, presetName);
            if (!view)
                return;
            if (show === undefined)
                show = !(view.subViews.indexOf(viewId) >= 0);

            if (show) {
                if (view.subViews.indexOf(viewId) < 0)
                    view.subViews.push(viewId);
                this._subViewToShow = getViewHandler(viewId);
            } else {
                let idx = view.subViews.indexOf(viewId);
                if (idx >= 0)
                    view.subViews.splice(idx, 1);
                this._subViewToHide = getViewHandler(viewId);
            }
            state.hiddenSubViews[viewId] = !show;

            window.views.setView(this.activeView, view);
        } else {
            if (show !== undefined) {
                state.hiddenSubViews[viewId] = !show;
            } else {
                state.hiddenSubViews[viewId] = !state.hiddenSubViews[viewId]; // toggle
            }
            if (state.hiddenSubViews[viewId])
                this._subViewToHide = getViewHandler(viewId);
            else
                this._subViewToShow = getViewHandler(viewId);
            nodeUtils.setViewHandlerState(this.activeView, state);
        }
        this.viewAs(this.activeView.currentViewId, true /* just changing subView */ , undefined, {
            setFocus: true
        }); // to force re-load
        this._subViewToShow = undefined;
        this._subViewToHide = undefined;
    }

    _hideContextActions(viewData: ViewData) {
        if (this.toolbar && this._toolbarActionsShown) { // LS: could be already hidden by tab change and another hide after tab close (via cleanUp) is undesired (details in #14541)
            let vActions = this._getViewActions(viewData, false);
            this.toolbar.hideActions(vActions, this.toolBtnParams);
            this._toolbarActionsShown = false;
        }
    }

    _showContextActions(viewData: ViewData) {
        if (this.toolbar) {
            let vActions = this._getViewActions(viewData, true);
            if (vActions.length > 0) {
                this.requestTimeout(function () {
                    // call it a little bit later so that the same toolbar actions are not subsequently hidden by another tab (on tab switch, tab close or multiView switch)
                    this.toolbar.showActions(vActions, this.toolBtnParams);
                    this._toolbarActionsShown = true;
                }.bind(this), 1);
            }
        }
    }

    getDefaultFocusControl(params?:AnyDict) {
        if (this.activeView && this.activeView.viewHandler && this.mainControl) {
            let control = this.activeView.viewHandler.defaultFocusControl(this.mainControl);
            if (control) {
                // main view control can be focused
                if (params && params.setFocus)
                    this.activeView.viewHandler.setFocus(control);
                return control;
            } else {
                // some view handlers (e.g. viewHandlers.genreView) has no main control to focus
                // search vithin its subViews to focus a focusable control
                for (let item of this.usedControls) {
                    if (!item.isMain) {
                        control = item.viewHandler.defaultFocusControl(item.control);
                        if (control) {
                            if (params && params.setFocus) {
                                item.viewHandler.setFocus(control);
                            }
                            return control;
                        }
                    }
                }
            }
        }
    }

    /*
    refreshToolbar() {
        if (this.toolbar) {
            var vis = this.visible;
            if (this._wasVisible !== vis) {
                if (!vis)
                    this._hideContextActions(this.activeView);
                else
                    this._showContextActions(this.activeView);
                this._wasVisible = vis;
            }
        }
    }
    */

    cleanUp() {
        this._storeLastCustomView();
        this._hideCurrentView({ // call to store persistent states and call view.onHide (to unlisten events and cancel view promises)
            useAnimation: false,
            useZoom: false
        });
        this.controlCache.cleanUp();
        super.cleanUp();
    }

    /*
    _isParentView (viewData) {
        if (!this.activeView) {
            return false;
        } else {
            return viewData.viewNode.containsChild(this.activeView.viewNode);
        }
    }

    _isChildView (viewData) {
        if (!this.activeView) {
            return false;
        } else {
            return this.activeView.viewNode.containsChild(viewData.viewNode);
        }
    }
    */

    viewAs(viewAsId: string, subViewChange?:boolean, viewData?: ViewData, params?: AnyDict) {
        this._customViewProcessing = !!subViewChange && this.customPresetName /* #16335 */ ;
        if (!subViewChange) {
            if (this.activeView && this.mainControl) { // #14132 item 7
                let LVControl = this.getDefaultFocusControl();
            }
        }
        if (viewData || this.activeView) {
            this._showView(viewData || this.activeView, viewAsId, params);
            if (!this.customPresetName) {
                let state = this._nodeHandlerState;
                state.viewAsId = viewAsId;
                nodeUtils.setNodeHandlerState(this.activeView, state);
            }
        }
        if (!subViewChange) {
            this.customPresetName = undefined;
        }
        this._customViewProcessing = undefined;
    }

    _getViewAsId(viewData: ViewData, params?:AnyDict) {
        let viewAsId = nodeUtils.getNodeHandlerState(viewData).viewAsId;
        let exists = false;
        let AV = viewData.availableViews();
        assert(AV && AV.length > 0, 'nodeHanlder.viewAs is undefined for nodeHandlers.' + viewData.viewNode.handlerID);
        if (viewAsId != undefined) {
            for (let i = 0; i < AV.length; i++) {
                if (AV[i] == viewAsId) {
                    exists = true;
                    break;
                }
            }
        }
        if (!exists) {
            let customViews = views.getCompatibleViews(viewData);
            for (let i = 0; i < customViews.length; i++) {
                if (customViews[i].id === viewAsId) {
                    // hide commands from last view
                    if (this.activeView)
                        this._hideContextActions(this.activeView);

                    viewData.currentViewId = customViews[i].viewMode;
                    viewData.viewHandler = getViewHandler(customViews[i].viewMode);
                    //this.parentView = viewData; // set current view to this multiview so controls can get current view in initialize
                    //this.activeView = viewData;

                    customViews[i].applyView(viewData, this, params);
                    return null;
                }
            }

            if (!exists)
                viewAsId = AV[0];
        }
        return viewAsId;
    }

    showView(viewData: ViewData, params?:AnyDict) {
        assert(viewData, 'ViewData is undefined!');
        let viewAsId = this._getViewAsId(viewData, params);
        if (viewAsId !== null) {
            this._showView(viewData, viewAsId, params);
        }
    }

    _isCustomView() {
        return !(!this._customViewProcessing && !this.customPresetName && !this._customViewReload);
    }

    _showView(viewData: ViewData, viewAsId: string, params?:AnyDict) {

        enterLayoutLock(this.container);

        let wasFocused = isChildOf(this.container, document.activeElement);
        let lastActiveElement = document.activeElement;

        // reset lastFocusedControl when it was any control in outgoing view (it can cause error when trying to get focusedItem from lastFocusedControl because it has no dataSource anymore)
        if (window.lastFocusedControl && isChildOf(this.container, window.lastFocusedControl)) {
            window.lastFocusedControl = null;
            wasFocused = true;
        }

        let isJustViewModeChange = (this.activeView == viewData);

        let viewHandler = getViewHandler(viewAsId);

        let animationDeniedByView = (this.activeView && this.activeView.viewHandler && resolveToValue(this.activeView.viewHandler.noAnimation, false, this.activeView)) ||
            (viewHandler && resolveToValue(viewHandler.noAnimation, false));

        let useAnimation = false;
        if (((viewData.clickedRect) || (this.activeView && this.activeView.clickedRect)) && (!params || !params.noAnimations))
            useAnimation = true;
        if (isJustViewModeChange || animationDeniedByView) // LS: in case of view mode change we can't use animations, viewData is still the same and viewData.viewHandler.onHide()
            useAnimation = false; //     needs to be called immediatelly -- before subsequent onShow of the newly assigned viewHandler

        let oldPos = -1;
        if (this.activeView)
            oldPos = this.activeView.getHistoryPos();
        let newPos = viewData.getHistoryPos();
        if (newPos == -1 /*new item*/ )
            newPos = oldPos + 1;
        let useZoomIn = (newPos > oldPos); // LS: this._isChildView(viewData) was here previously, but zooming based on history position seems better
        let useZoomOut = (oldPos > newPos); // LS: this._isParentView(viewData) was here previously

        if (!params || !params.dontStoreCustomView)
            this._storeLastCustomView();

        this._hideCurrentView({
            useAnimation: useAnimation,
            useZoom: useZoomOut
        });

        this._cleanUpCustomView();

        this.parentView = viewData; // set current view to this multiview so controls can get current view in initialize

        viewData.currentViewId = viewAsId;
        viewData.viewHandler = viewHandler;
        this.activeView = viewData;

        if (viewHandler.onBeforeCreate)
            viewHandler.onBeforeCreate(viewData);
        this._createViewControls(viewHandler);
        this.mainControl.controlClass.parentView = viewData;

        // Initialize the view ... need to be after parentView assignment above
        this._handler_call_onShow(this.usedControls, viewData);

        // Initialize dependencies/listeners between sub-views (sub-controls):
        this._initDependencies(this.usedControls, viewData);

        if ((params && params.setFocus) || (wasFocused)) {
            // initially set focus to the mainControl of the new control
            this.lastFocusedControl = this.getDefaultFocusControl();
            // @ts-ignore
            if (this.lastFocusedControl && !this.lastFocusedControl._isTreeView)
                window._lastFocusedLVControl = this.lastFocusedControl;

            if (this.lastFocusedControl && this.lastFocusedControl.controlClass && (this.lastFocusedControl.controlClass as unknown as Multiview).lastFocusedControl) // control (probably multiview) tracks own last focused, use it
                this.lastFocusedControl = (this.lastFocusedControl.controlClass as unknown as Multiview).lastFocusedControl;
        }

        let handleFocus = function () {
            if (!this._isSingleSubViewChange() || ((params && params.setFocus))) {
                if (isChildOf(this.container, lastActiveElement) && (!useAnimation && isVisible(lastActiveElement as HTMLElement))) {
                    (lastActiveElement as HTMLElement).focus(); // LS: e.g. to not "steal" focus when using arrows in the "Playlist tree" sub-view
                } else {
                    if ((params && params.setFocus) || (wasFocused)) {
                        this.getDefaultFocusControl({
                            setFocus: true
                        });
                    }
                }
            }
            if (params && params.onFinished) {
                params.onFinished();
            }
        }.bind(this);

        if (useAnimation) {
            animTools.animateViewComeIn({
                panel: this.viewPanel,
                useZoom: useZoomIn,
                clickedRect: viewData.clickedRect,
                onComplete: function () {
                    handleFocus();
                }
            });
        } else {
            handleFocus();
        }


        if (!this._isSingleSubViewChange()) {
            this._showContextActions(viewData);

            if (!this._isCustomView()) {
                this.restorePersistentStates();
                let oldState = viewData.controlsState['viewPanel'] || viewData.controlsState[viewAsId]; // state based on viewAsId deprecated because of #15119
                if (oldState)
                    this.viewPanel.controlClass.restoreState(oldState, isJustViewModeChange); // restores state of the last view
            } else {
                // restore states for subviews
                this.usedControls.forEach(function (ctrl) {
                    if (!ctrl.isMain && ctrl.control && ctrl.control.controlClass) {
                        ctrl.control.controlClass.restorePersistentStates();
                    }
                });
            }

            this._callViewChange(this.lastView, useAnimation);
        } else
        if (!this._isCustomView())
            this.restorePersistentStates(); // #15086

        // #15538: we should store settings to the disc for case system will restart/shutdown as it's problem for us to catch this situation
        this.requestTimeout(() => {
            if (!this.customPresetName) {
                uitools.storeUIState();
                app.flushState();
            }
        }, 5000, 'saveViewTimeout');

        leaveLayoutLock(this.container);
    }

    _initDependencies(usedControls, viewData: ViewData) {
        let items = usedControls;
        for (let item of items) {
            if (item.control.controlClass && item.control.controlClass.dataSource) {
                let ds = item.control.controlClass.dataSource;
                if ((typeof ds === 'object') && (ds.getClassName === undefined /* not delphi object */ ) &&
                    (ds.addEventListener === undefined) /* JS object does not support events (like dataSource in yearArtist view) */ ) {
                    ds = undefined;
                }
                if (ds) {
                    viewData.listen(ds, 'statuschange', function (data) {
                        // LS: this resolves #12451 items H/J, i.e. cancel selection of folders/playlists whenever a track is selected and vice-versa
                        if (data.selectedCount > 0) {
                            for (let item2 of items) {
                                if (item2.control !== this.control && item2.control.controlClass && item2.control.controlClass.cancelSelection) {
                                    item2.control.controlClass.cancelSelection();
                                }
                            }
                        }
                    }.bind(item));
                }
            }
        }
    }

    _isSingleSubViewChange() {
        return (this._subViewToShow || this._subViewToHide);
    }

    _getFromLastControls(viewHandler) {
        if (!this._isSingleSubViewChange()) {
            return undefined;
        } else {
            // just hiding/showing one sub-view that user manually disabled/enabled right now
            // so use the same controls as we have now
            let items = this._lastUsedControls;
            for (let i = 0; i < items.length; i++) {
                let item = items[i];
                if (viewHandler == item.viewHandler) {
                    return item.control;
                    break;
                }
            }
        }
    }

    _addControl(parent, viewHandler, isMain, inScroller) {
        let initParams = {
            dynamicSize: undefined
        };
        if (viewHandler.controlClass_initParams)
            initParams = viewHandler.controlClass_initParams;
        if (inScroller && initParams.dynamicSize == undefined)
            initParams.dynamicSize = true;

        let control = this._getFromLastControls(viewHandler);
        if (control) {
            parent.appendChild(control); // use the same control when showing/hiding just single sub-view, use appendChild to keep the correct order
        } else {
            control = this.controlCache.get(viewHandler.constructor.name);
            if (control) {
                // no need to create the control, was in cache
                parent.appendChild(control);
            } else {
                control = parent.controlClass.addControl(viewHandler.controlClass, initParams);
                if (viewHandler.onControlCreated)
                    viewHandler.onControlCreated(control);
                control.classList.add('viewControl');
                control.setAttribute('data-id', 'viewControl_' + viewHandler.viewId); // id for state (re)storing
            }
            if (this._subViewToShow == viewHandler) {
                // sub-view just manually enabled by user, show it animated:
                control.classList.toggle('animate', true);
                setVisibilityFast(control, false, {
                    animate: false
                });
                setVisibility(control, true);
            } else {
                control.classList.toggle('animate', false);
                setVisibility(control, true);
            }

        }
        let item = {
            control: control,
            viewHandler: viewHandler,
            isMain: isMain,
            splitter: undefined // is added later in _createSubControls
        };
        this.usedControls.push(item);
        return control;
    }

    _forEachSubView(viewHandler, callback, includeInvisible?:boolean) {
        let subViews = resolveToValue(viewHandler.subViews);
        if (subViews) {
            for (let i = 0; i < subViews.length; i++) {
                let viewID = subViews[i];
                let subView = getViewHandler(viewID);
                if (!this._viewHandlerState.hiddenSubViews[viewID] || includeInvisible || subView.permanent) {
                    let placement = subView.placement || {};
                    if (!placement.position)
                        placement.position = 'top'; // place controls with undefined position to top
                    callback(subView, placement, (includeInvisible || subView.permanent) ? this._viewHandlerState.hiddenSubViews[viewID] : undefined);
                }
            }
        }
    }

    _anySubViewInScroller(viewHandler: ViewHandler) {
        let result = false;
        this._forEachSubView(viewHandler, function (subView, placement) {
            if (placement.inScroller)
                result = true;
        }.bind(this), true /* include invisible*/ );
        return result;
    }

    _anySubViewNotInScroller(viewHandler: ViewHandler) {
        let result = false;
        this._forEachSubView(viewHandler, function (subView, placement) {
            if (!placement.inScroller)
                result = true;
        }.bind(this), true /* include invisible*/ );
        return result;
    }

    _anySubViewHasSplitter(viewHandler: ViewHandler) {
        let result = false;
        this._forEachSubView(viewHandler, function (subView, placement) {
            if (placement.hasSplitter)
                result = true;
        }.bind(this), true /* include invisible*/ );
        return result;
    }

    _anySubViewInSideBar(viewHandler: ViewHandler) {
        let result = false;
        this._forEachSubView(viewHandler, function (subView, placement) {
            if (placement.position == 'left' || placement.position == 'right')
                result = true;
        }.bind(this), true /* include invisible*/ );
        return result;
    }

    _addSplitter(parent, subView) {
        let data_id = 'viewSplitter_' + subView.viewId;
        if (!this._isSingleSubViewChange() || (subView == this._subViewToShow)) {
            let splitter = parent.controlClass.addControl('Splitter');
            splitter.setAttribute('data-id', data_id);
            return splitter;
        } else {
            let splitter = parent.controlClass.qChild(data_id);
            if(splitter)
                parent.appendChild(splitter); // to keep correct control order
            return splitter;
        }
    }

    _createSubControls(parent, position, inScroller, viewHandler: ViewHandler) {
        this._forEachSubView(viewHandler, function (subView, placement) {
            if ((placement.position == position) && (!!placement.inScroller == inScroller) && subView.controlClass) {
                let splitter;
                if (placement.hasSplitter && (position == 'bottom' || position == 'right'))
                    splitter = this._addSplitter(parent, subView);
                this._addControl(parent, subView, false, inScroller); // sub-view's control
                if (placement.hasSplitter && (position == 'top' || position == 'left'))
                    splitter = this._addSplitter(parent, subView);
                if (splitter)
                    this.usedControls[this.usedControls.length - 1].splitter = splitter;
            }
        }.bind(this));
    }

    _processVirtualSubControls(parent, viewHandler: ViewHandler) {
        this._forEachSubView(viewHandler, function (subView, placement, hidden) {
            if (!subView.controlClass && resolveToValue(subView.isVirtual)) {

                let browse = function (ctrl) {
                    if (ctrl && ctrl.controlClass && isFunction(ctrl.controlClass.haveVirtualSubView))
                        if (ctrl.controlClass.haveVirtualSubView(subView)) {
                            if (hidden && isFunction(subView.onHide))
                                subView.onHide(ctrl, null, null);
                            else if (!hidden && isFunction(subView.onShow))
                                subView.onShow(ctrl, null, null);
                        }
                };

                forEach(qes(parent, '[data-control-class]'), browse);
            }
        }.bind(this), true);
    }

    _createViewControls(viewHandler: ViewHandler) {

        this._nodeHandlerState = nodeUtils.getNodeHandlerState(this.activeView);
        this._viewHandlerState = nodeUtils.getViewHandlerState(this.activeView);
        this._viewHandlerState.hiddenSubViews = this._viewHandlerState.hiddenSubViews || {};

        if (!!this.customPresetName || this._customViewLoading) {
            let view = window.views.getCompatibleView(this.activeView, this._customViewLoadingID || this.customPresetName);
            if (view) {
                let subViews = resolveToValue(viewHandler.subViews);
                if (subViews) {
                    for (let i = 0; i < subViews.length; i++) {
                        let viewId = subViews[i];
                        this._viewHandlerState.hiddenSubViews[viewId] = view.subViews.indexOf(viewId) < 0;
                    }
                }
            }
        }

        if (this.activeView.forceShowSubViewIDs) {
            forEach(this.activeView.forceShowSubViewIDs, (viewId) => {
                this._viewHandlerState.hiddenSubViews[viewId] = null;
            });
        }

        if (this._subViewToHide)
            return; // we are just hiding a sub-view disabled by user, don't perform the code below in order to not break position of the sub-view being hidden (breaks animation)

        // LS: rather always use scroller for consistency
        let useScroller = true; // this._anySubViewInScroller(viewHandler);

        let sideBarNeed = this._anySubViewInSideBar(viewHandler);
        let panel;

        if (this._isSingleSubViewChange()) {
            panel = this.viewPanel;
            this.container.appendChild(panel); // just to keep the correct order
        } else {
            // we need to place the new control inside the additional panel so that we are sure that it is not transparent (e.g. for zoom in/out animations)
            // and also sub-views resides on this panel                          
            panel = this.container.controlClass.addControl('Control');
            panel.classList.add('fill');
            panel.classList.add('layer');

            if (this._anySubViewHasSplitter(viewHandler)) {
                panel.classList.add('flex');
                if (sideBarNeed)
                    panel.classList.add('row');
                else
                    panel.classList.add('column');
            }
            this.viewPanel = panel;
        }

        this._lastUsedControls = this.usedControls;
        this.usedControls = [];

        let middlePanel = panel;
        if (sideBarNeed || this._anySubViewNotInScroller(viewHandler)) {
            // we need to add the middle panel whenever there are some sub-views out of the scroller
            this._createSubControls(this.viewPanel, 'left', false, viewHandler); // sub-views on the left
            if (this._isSingleSubViewChange()) {
                middlePanel = this._lastMiddlePanel;
                this.viewPanel.appendChild(middlePanel); // just to keep the correct order
            } else {
                middlePanel = this.viewPanel.controlClass.addControl('Control');
                middlePanel.setAttribute('data-id', 'viewControl_MiddlePanel'); // to state (re)storing to work
                middlePanel.className = 'fill flex column';
                this._lastMiddlePanel = middlePanel;
            }
        }

        this._createSubControls(middlePanel, 'top', false, viewHandler); // sub-views above scroller
        if (useScroller) {
            let scroller;
            if (this._isSingleSubViewChange()) {
                scroller = this._lastScroller;
                middlePanel.appendChild(scroller); // just to keep the correct order
            } else {
                scroller = middlePanel.controlClass.addControl('Scroller');
                scroller.setAttribute('data-id', 'viewControl_Scroller'); // to state (re)storing to work
                scroller.classList.add('fill', 'viewScroller');
                this._lastScroller = scroller;
            }
            scroller.classList.toggle('stickySubviews', !!viewHandler.enableStickySubviews);
            scroller.controlClass.disableLastControlEnlarge = !!viewHandler.disableLastControlEnlarge;
            this._createSubControls(scroller, 'top', true, viewHandler); // sub-views at the top of scroller
            this.mainControl = this._addControl(scroller, viewHandler, true, true); // this is the main 'view' control (in Scroller with sub-views)
            this._createSubControls(scroller, 'bottom', true, viewHandler); // sub-views at the bottom of scroller
        } else {
            this.mainControl = this._addControl(middlePanel, viewHandler, true, false); // this is the main 'view' control
            this.mainControl.classList.add('fill');
        }
        this._createSubControls(middlePanel, 'bottom', false, viewHandler); // sub-views below scroller

        if (sideBarNeed) {
            this._createSubControls(this.viewPanel, 'right', false, viewHandler); // sub-views on the right            
        }

        // show/hide virtual controls
        this._processVirtualSubControls(this.viewPanel, viewHandler);

        this._lastUsedControls = undefined;
    }

    _cacheControls(items) {
        for (let i = 0; i < items.length; i++) {
            let item = items[i];
            let id = item.viewHandler.constructor.name;
            this.controlCache.add(id, item.control, item.viewHandler.controlClass_initParams);
        }
    }

    _unregisterStatusBar(items) {
        for (let i = 0; i < items.length; i++) {
            let item = items[i];
            let cls = item.control.controlClass;
            if (cls && cls.reportStatus && cls.unregisterStatusBarSource && cls.dataSource)
                cls.unregisterStatusBarSource(cls.dataSource);
        }
    }

    _removeControls(items, viewPanel) {
        if (!this._isSingleSubViewChange()) {
            removeElement(viewPanel); // remove the view panel created in _createViewControls with all the sub-controls that hasn't been moved to cache
        } else {
            if (this._subViewToShow)
                return; // we are just showing one sub-view manually enabled by user

            // hide just the sub-view that user manually disabled right now:
            for (let i = 0; i < items.length; i++) {
                let item = items[i];
                if (this._subViewToHide == item.viewHandler) {
                    item.control.classList.toggle('animate', true); // enables animating
                    setVisibility(item.control, false, {
                        onComplete: function () {
                            removeElement(item.control);
                            if (item.splitter)
                                removeElement(item.splitter);
                        }
                    });
                    items.splice(i, 1);
                    break;
                }
            }
        }
    }

    _hideCurrentView(params) {
        if (this.activeView && this.usedControls) {
            let lastView = this.activeView;
            this.lastView = lastView;
            let lastUsedControls = this.usedControls;
            let viewPanel = this.viewPanel;
            if (!this._isSingleSubViewChange()) {
                if (!this._isCustomView()) { // it's not custom view
                    // states needs to be stored before we hide the control (otherwise it could be restored as invisible + dataSource could be already destroyed via viewHandler.onHide)
                    let state = viewPanel.controlClass.storeState();
                    lastView.controlsState['viewPanel'] = state;
                    this._hideContextActions(lastView); // clear old context actions            
                    this.storePersistentStates();
                } else {
                    this._hideContextActions(lastView); // clear old context actions  
                    // subviews in custom views are stored right after change so no need to do anything here
                }
            } else
            if (!this._isCustomView())
                this.storePersistentStates(); // #15086

            let _this = this;
            let _hide = function () {
                if (_this._cleanUpCalled)
                    return;
                if (!_this._isSingleSubViewChange())
                    _this._callViewHide(lastView, viewPanel, params.useAnimation);
                _this._handler_call_onHide(lastUsedControls, lastView);
                if (!_this._isSingleSubViewChange())
                    _this._cacheControls(lastUsedControls); // add to controlCache (if not already there)
                _this._removeControls(lastUsedControls, viewPanel);
            };
            if (params.useAnimation) {
                _this._unregisterStatusBar(lastUsedControls); // unregister status bar before the animation (#16360) 
                animTools.animateViewComeOut({
                    panel: viewPanel,
                    useZoom: params.useZoom,
                    clickedRect: lastView.clickedRect,
                    onComplete: _hide
                });
            } else {
                _hide();
            }
        }
        if (!this._subViewToHide) {
            this.mainControl = undefined;
            this.activeView = undefined;
        }
    }

    _callViewChange(lastView, animations?:boolean) {

        let lastViewID;
        if (lastView)
            lastViewID = lastView.currentViewId;

        let info = {
            income: {
                view: this.activeView,
                panel: this.viewPanel, // view panel with all sub-controls
                usedControls: this.usedControls, // list of sub-view controls used
                viewID: this.activeView.currentViewId // id of new viewHandler to be used
            },
            outcome: {
                view: lastView,
                viewID: lastViewID
            },
            animations: animations // transition animations are used (zoom in/out)
        };

        let event = createNewCustomEvent('viewchange', {
            detail: info,
            bubbles: true,
            cancelable: true
        });
        document.body.dispatchEvent(event);
    }

    _callViewHide(lastView, lastViewPanel, animations) {
        let event = createNewCustomEvent('viewhide', {
            detail: {
                view: lastView,
                panel: lastViewPanel,
                viewID: lastView.currentViewId,
                animations: animations // transition animations are used (zoom in/out)
            },
            bubbles: true,
            cancelable: true
        });
        this.container.dispatchEvent(event);
        document.body.dispatchEvent(event);
    }

    _get_main_view_control(items) {
        for (let i = 0; i < items.length; i++) {
            let item = items[i];
            if (item.isMain)
                return item.control;
        }
    }

    _handler_call_onShow(items, viewData: ViewData) {

        if (this._subViewToHide)
            return;

        let mainViewControl = this._get_main_view_control(items);
        let _this = this;

        function _process(onlyMain:boolean, onlyDataInit?:boolean) {
            let singleViewChange = _this._isSingleSubViewChange();
            for (let i = 0; i < items.length; i++) {
                let item = items[i];
                let canProcess = ((onlyMain && item.isMain) || (!onlyMain && !item.isMain));
                if (!onlyMain && _this._subViewToShow) {
                    canProcess = (!onlyMain && _this._subViewToShow == item.viewHandler);

                    // handle showing of virtual subview
                    if (!canProcess && !onlyMain && resolveToValue(_this._subViewToShow.isVirtual))
                        if (item.control && item.control.controlClass && isFunction(item.control.controlClass.haveVirtualSubView))
                            if (item.control.controlClass.haveVirtualSubView(_this._subViewToShow))
                                if (isFunction(_this._subViewToShow.onShow))
                                    _this._subViewToShow.onShow(item.control, viewData, mainViewControl);

                }
                if (canProcess && isFunction(item.viewHandler.onShow)) {
                    item.viewHandler.onShow(item.control, viewData, mainViewControl, onlyDataInit, singleViewChange);
                }
            }
        }
        // at first call onShow only for the main view control to prepare data sources for the sub-views (in view.dataSourceChache[])
        if (!this._isSingleSubViewChange())
            _process(true);
        else {
            // call also when columnBrowser enabled and data are not prepared yet, #17905
            // send flag, that this is calling onShow only for data initialize, so e.g. listeners pairing is not affected
            if (this._subViewToShow && this._subViewToShow.viewId === 'columnBrowser' && (!this._parentView.dataSourceCache || !this._parentView.dataSourceCache['tracklist']))
                _process(true, true);
        }
        // process all sub-view controls to get the corresponding data sources
        _process(false);
    }

    _handler_call_onHide(items, viewData: ViewData) {

        if (this._subViewToShow)
            return;

        let mainViewControl = this._get_main_view_control(items);
        let _this = this;

        function _process(onlyMain) {
            for (let i = 0; i < items.length; i++) {
                let item = items[i];
                let canProcess = ((onlyMain && item.isMain) || (!onlyMain && !item.isMain));
                if (_this._subViewToHide) {
                    canProcess = (!onlyMain && _this._subViewToHide == item.viewHandler);

                    // handle hiding of virtual subview
                    if (!canProcess && !onlyMain && resolveToValue(_this._subViewToHide.isVirtual))
                        if (item.control && item.control.controlClass && isFunction(item.control.controlClass.haveVirtualSubView))
                            if (item.control.controlClass.haveVirtualSubView(_this._subViewToHide))
                                if (isFunction(_this._subViewToHide.onHide))
                                    _this._subViewToHide.onHide(item.control, viewData, mainViewControl);

                }
                if (canProcess && isFunction(item.viewHandler.onHide)) {
                    item.viewHandler.onHide(item.control, viewData, mainViewControl);
                }
            }
        }
        // at first call onHide fo all sub-view controls to set everything to the state expected in onHide of the main view control 
        _process(false);
        // and then call onHide of the main view control:
        if (!this._isSingleSubViewChange()) {
            _process(true);
            viewData.onHide(); // lastly to cancel view.promise() and view.listen() used by handlers
        }
    }

    reload() {
        let view = this.activeView;
        view.reloading = true;

        this._storeLastCustomView();

        this._handler_call_onHide(this.usedControls, view);
        this.activeView.dataSourceCache = {}; // clear dataSource cache to reload the sources
        this._handler_call_onShow(this.usedControls, view);

        this._callViewChange(view); // e.g. search bar listens to 'viewchange' event to restore last search phrase (#14965)
        view.reloading = undefined;

    }

    refresh() {
        if (!this.mainControl)
            return; // someone can call actions.view.refresh on app start (while there isn't any view initialized yet)

        this.usedControls.forEach(function (ctrl) {
            if (!ctrl.isMain && ctrl.control && ctrl.control.controlClass && ctrl.control.controlClass.doRefresh) {
                ctrl.control.controlClass.doRefresh();
            }
        });

        // @ts-ignore
        if (this.mainControl.controlClass.doRefresh) {
            // custom refresh - refresh toolbar actions: 
            this._hideContextActions(this.activeView);
            this._showContextActions(this.activeView);
            // call custom refresh method:
            // @ts-ignore
            this.mainControl.controlClass.doRefresh();
        } else {
            this.reload(); // #13943
        }
    }

    getPersistentStateRootControl() {
        // LS: overriden so that we are sure that only the active view state will be saved 
        // otherwise another control cached in history could override its persistent between various collections
        return this.viewPanel;
    }

    get helpContext() {
        let view = this.activeView;
        if (!view)
            return '';
        return nodeUtils.getNodeHelpContext(view.viewNode);
    }
    
    get activeView() : ViewData {
        return this._activeView;
    }
    set activeView (viewData: ViewData) {
        if (this._activeView)
            this._activeView.isActive = false;
        this._activeView = viewData;
        if (this._activeView)
            this._activeView.isActive = true;
    }

    get toolbar () {
        return this._toolbar;
    }
    set toolbar (toolbar) {
        this._toolbar = toolbar;
    }
    
}
registerClass(Multiview);
