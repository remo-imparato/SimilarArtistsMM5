'use strict';

import ObservableObject from '../helpers/observableObject';
import Control, { ControlState } from './control';
import NavigationHistory from './history';
import Multiview from './multiview';

registerFileImport('controls/mainTabContent');

/**
@module UI snippets
*/

requirejs('helpers/observableObject');
requirejs('helpers/docking');

/**
Content of the selected main window tab 

@class MainTabContent
@constructor
@extends Control
*/

export default class MainTabContent extends Control {
    includeSubfoldersInLocations: boolean;
    multiviewControl: Multiview;
    splitter: any;
    mediatree: any;
    plstEditSpot: any;
    plstEditSpotSplitter: any;
    private _wasVisible: boolean;
    contentStatus: any;
    history: NavigationHistory;
    docks: any;
    panels: any;
    private _tree: any;
    loadingPromise: any;
    queryData: any;
    _saveOrderButton: ElementWith<Control>;
    loadAsync: () => any;

    initialize(rootelem, params) {
        super.initialize(rootelem, params);
        this._wasVisible = false;
        this.container.innerHTML = loadFile('file:///controls/mainTabContent.html');
        initializeControls(this.container);

        this.splitter = qe(this.container, '[data-control-class=Splitter]');
        this.mediatree = qe(this.container, '[data-control-class=MediaTree]');
        this.plstEditSpot = qe(this.container, '[data-control-class=PlaylistEditorsContainer]');
        this.plstEditSpotSplitter = qe(this.container, '[data-id=plstEditSpotSplitter]');
        assert(this.mediatree);

        this.multiviewControl = this.qChild('multiview').controlClass;

        this.contentStatus = qe(this.container, '[data-id=contentStatus]');

        this.history = new NavigationHistory();
        this.history.mainTabContent = this;

        app.listen(this.mediatree, 'focuschange', function () { // cleaned with mediatree
            let node = this.mediatree.controlClass.dataSource.focusedNode;
            if (!node || (this.multiviewControl.activeView && this.multiviewControl.activeView.viewNode.nodePath == node.nodePath))
                return; // to prevent from view re-loading when the currently focused node is clicked in media tree

            if (!this.multiviewControl.activeView && app.hotkeys.isKeyPressed('Ctrl'))
                return; // to fix #14813 - item 2

            let isMouseInteraction = false;
            if (window._lastLVMouseDownTm && (Date.now() - window._lastLVMouseDownTm < 300))
                isMouseInteraction = true;

            if (node) {
                this.showView({
                    node: node,
                    noAnimations: true /*don't animate view transition when navigating via media tree*/ ,
                    newTab: isMouseInteraction && app.hotkeys.isKeyPressed('Ctrl')
                });
            }
        }.bind(this));

        let _this = this;
        let withoutRestore = false;
        if (params && params.withoutRestore)
            withoutRestore = params.withoutRestore; // ignore first restore when tab is set

        this.localListen(app.downloader.itemList, 'change', function () {
            _this.history.refresh(); // to refresh text on navbar
        });

        this.loadAsync = function () {
            _this.loadingPromise = new Promise<void>(function (resolve, reject) {
                whenReady(function () { // we can set default view when all classes are initialized
                    if (_this._cleanUpCalled) {
                        reject();
                        return;
                    }

                    if (!_this.history.restored) // LS: to restore navigation history from previous layout (#13229),
                        _this._restoreSharedHistory(); // when a new layout is accesed for the first time then restoreState() is not called and thus navigation history wouldn't be restored
                    if (_this.history.restored) {
                        if (!withoutRestore)
                            _this.history.initAfterRestore();
                    } else {
                        // persistent.json is missing -- i.e. first time run
                        _this.history.home();
                        _this.history.restored = true; // so that home() is not called again on the second visit of this tab (when first time run)
                        _this.defaultState();
                    }
                    withoutRestore = false;
                    resolve();
                });
            });
            return _this.loadingPromise;
        };

        whenReady(function () { // @ts-ignore
            _this.multiviewControl.toolbar = window.viewtoolbar;
        });
        
        setVisibility(this.plstEditSpot, false, {
            animate: false
        });

        docking.markAllTabDockablePanels(this.container);
    }

    showView(params) {
        if (params.node.handlerID == 'loading') // this is just dummy 'loading...' progress node, skip it (#14764)
            return;

        if (!this._cleanUpCalled) {
            if (params.newTab && window.mainTabs) { // LS: window.mainTabs is undefined when this control is tested separately in listeners tests (and somebody pressed CTRL on the testing machine during test)
                window.mainTabs.addNewTab(true).then(function () {
                    params.newTab = undefined;
                    params.expandTree = true;
                    window.currentTabControl.showView(params);
                }.bind(this));
            } else
                this.showViewData(this.createViewData(params), params);
        }
    }

    showViewData(viewData: ViewData, params) {
        if (!viewData.inHistory()) // this item has not been added to history yet, add it                        
            this.history.add(viewData);

        this.requestTimeout(() => {
            this._showViewData(viewData, params);
        }, 50, 'showViewData'); // LS: increased to 50ms to be fluent when node in media tree is focused and user holds down/up arrow for fast moving over nodes
    }

    _showViewData(viewData: ViewData, params) {

        this.multiviewControl.showView(viewData, params);

        if (this.contentStatus) {
            this.contentStatus.controlClass.statusEnabled = resolveToValue(viewHandlers[viewData.currentViewId].statusbar, true);
            this.contentStatus.controlClass.statusMessage = '';
        }

        let expandTree = false; /*do not auto expand by default*/
        if (params && resolveToValue(params.expandTree, false))
            expandTree = true;
        if (!expandTree && window.settings.UI.mediaTree.autoExpand)
            expandTree = true;
        if (!isVisible(this.mediatree))
            expandTree = false;

        this.mediatree.controlClass.setNodePath(viewData.viewNode.nodePath, !expandTree, true /* no focus event */ ).then(() => {
            let focusedNode = this.mediatree.controlClass.dataSource.focusedNode;
            if (focusedNode) // there isn't any media tree node focused e.g. in case of virtual 'search' nodes (#17277)
                viewData.treePath = focusedNode.nodePath;
        });
    }

    createViewData(params): ViewData {
        let _this = this;
        let node = params.node;
        let nHandler = nodeHandlers[node.handlerID];
        assert(nHandler, 'Node handler for "' + node.handlerID + '" does not exist!');
        return {
            timeStamp: 0, // to be set once view will be added to history   
            inHistory: function () {
                return _this.history.isInHistory(this);
            },
            mainTabContent: this,
            viewNode: node,
            nodePath: node.nodePath,
            clickedRect: params.clickedRect, // rectangle from which this view was expanded (e.g. clicked album rect. in albums view - because of animations)            
            dataSourceCache: {},
            dataSourceCacheObserver: new ObservableObject(),
            controlsState: {},
            tag: {}, // custom data can be stored here by scripts
            nodehandler: nHandler,
            availableViews: function () {
                // keep this as function so that viewAs is actual (e.g. nodeHandlers.album has "dynamic" viewAs array)
                return resolveToValue(nHandler.viewAs, [], this.viewNode);
            },
            title: function () {
                return nodeUtils.getNodeTitle(node) as string;
            },
            hasChildren: function () {
                return nodeUtils.getHasChildren(node);
            },
            icon: function () {
                return nodeUtils.getNodeIcon(node);
            },
            openSubNode: function (params) {
                if (params.newTab) {
                    params.newTab = undefined;
                    window.mainTabs.addNewTab(true).then(function () {
                        params.useNewTab = true;
                        this.openSubNode(params);
                    }.bind(this));
                } else {
                    let node = this.viewNode.addChild(params.dataSource, params.handlerID);
                    let tabCtrl;
                    if (params.useNewTab)
                        tabCtrl = window.currentTabControl;
                    else
                        tabCtrl = _this;
                    tabCtrl.showView({
                        node: node,
                        clickedRect: getAbsPosRect(params.clickedArea),
                        setFocus: true
                    });
                }
            },
            createViewData: function (params) {
                return _this.createViewData(params);
            },
            getHistoryPos: function () {
                return _this.history.getPosition(this);
            },
            promise: function (pr, promise_id? /*optional*/ ) {
                // will be automatically canceled when view is hidden (onHide)
                // or can be canceled via cancelPromise below with supplied promise_id
                this._promises = this._promises || [];
                let promise_info = {
                    promise: pr,
                    id: promise_id
                };
                this._promises.push(promise_info);
                pr.then1((e) => {
                    promise_info.promise = null; // to not leak the promise (and possible whole lists) until view is changed (#21234)
                    return e;
                });
                return pr;
            },
            cancelPromise: function (promise_id) {
                if (this._promises) {
                    forEach(this._promises, (info, idx) => {
                        if (info.id == promise_id) {
                            cancelPromise(info.promise);
                            this._promises.splice(idx, 1);
                        }
                    });
                }
            },
            listen: function (obj, event, func, id /*optional*/ ) {
                // will be automatically unlistened when view is hidden (onHide)
                // or can be unlistened via unlisten below with supplied id
                let listenFunc = app.listen(obj, event, func);
                this._unlisteners = this._unlisteners || [];
                this._unlisteners.push({
                    id: id,
                    func: function () {
                        app.unlisten(obj, event, listenFunc);
                    }
                });
                return listenFunc;
            },
            unlisten: function (id) {
                if (this._unlisteners) {
                    let _this = this;
                    forEach(this._unlisteners, function (unlisten, idx) {
                        if (unlisten.id == id) {
                            unlisten.func();
                            _this._unlisteners.splice(idx, 1);
                        }
                    });
                }
            },
            loadProgress: function (sourceType, progressText) {
                let _this = this;
                cancelPromise(this._loadingPromise); // LS: cancel the last promise everytime (list could be just refreshed without calling this.onHide() to cancel the promises -- #14560)
                if (this._loadingTm)
                    clearTimeout(this._loadingTm);
                let list = this.dataSourceCache[sourceType];
                if (list) {
                    this._loadingPromise = this.promise(list.whenLoaded());
                    this._loadingTm = setTimeout(() => {
                        if (!list.isLoaded && (list === _this.dataSourceCache[sourceType]) && !isPromiseCanceled(this._loadingPromise)) {
                            // show progress 500 ms later (when loading still not finished) -- issue #13898
                            let progress = app.backgroundTasks.createNew();
                            list.assignProgress(progress);
                            if (!progressText)
                                progressText = _('Loading') + '...';
                            progress.text = progressText;
                            this._loadingPromise.then1(function () {
                                progress.terminate();
                            });
                        }
                    }, 500);
                }
            },
            _cancelDelayedAssign: function () {
                if (this._delayedAssignTm) {
                    clearTimeout(this._delayedAssignTm);
                    this._delayedAssignTm = null;
                }
            },
            delayedAssign: function (ds, callback) {
                if (!this.reloading || !ds.whenLoaded) {
                    callback();
                } else {
                    // we are just re-loading the results, e.g. when F5 to refresh is pressed or when view filter is changed (#14293 - item 6)
                    // the results should be showing later or once fully loaded, but not earlier (to prevent from too much blinking and scrollbar repositioning when results are similar or same)                    
                    this._cancelDelayedAssign();
                    this._delayedAssignTm = setTimeout(() => {
                        callback();
                        this._delayedAssignTm = null;
                    }, 5000); // 5s to have chance to copy also the selection (e.g. for CD node - #19185), was too low also because #14293 - item 6
                    ds.whenLoaded().then(() => {
                        if (this._delayedAssignTm) {
                            // delayedAssign hasn't been performed yet (or canceled elsewhere)
                            this._cancelDelayedAssign();
                            callback();
                        }
                    }, () => {
                        // when loading was canceled meanwhile
                        // e.g. switch to another view (call of cancelPromise(whenLoaded()) in ListView.dataSource setter -- called from viewHanlder.onHide() by dataSource = null assignment)
                        this._cancelDelayedAssign();
                    });
                }
            },
            onHide: function () {
                if (this._promises) {
                    forEach(this._promises, function (info) {
                        cancelPromise(info.promise);
                    });
                    this._promises = [];
                }
                if (this._unlisteners) {
                    forEach(this._unlisteners, function (unlisten) {
                        unlisten.func();
                    });
                    this._unlisteners = [];
                }
                this._cancelDelayedAssign();

                this._loadingPromise = undefined; // LS: was already canceled (as was part of this._promises array above), but needs to be set to undefined -- otherwise when it is list.whenLoaded() promise then the whole list is referenced and leaks memory (#17772)
                if (this._loadingTm) {
                    clearTimeout(this._loadingTm);
                    this._loadingTm = undefined;
                }
            }
        };
    }

    storeViewData(viewData: ViewData) {
        let state : AnyDict = {};
        state.title = resolveToValue(viewData.title); // LS: title and icon are needed in the menu of all history items (even if they haven't been restored yet)
        state.icon = resolveToValue(viewData.icon);
        state.timeStamp = viewData.timeStamp;
        state.tag = viewData.tag;
        if (viewData.clickedRect)
            state.clickedRect = {
                top: viewData.clickedRect.top,
                left: viewData.clickedRect.left,
                height: viewData.clickedRect.height,
                width: viewData.clickedRect.width,
            };
        state.nodePath = viewData.nodePath;
        state.nodePathSources = [];
        let node = viewData.viewNode;
        while (node) {
            state.nodePathSources.splice(0, 0, nodeUtils.storeNode(node));
            node = node.parent;
        }
        state.treePath = viewData.treePath;
        let multiView = this.multiviewControl;
        if (multiView.activeView == viewData)
            viewData.controlsState['viewPanel'] = multiView.viewPanel.controlClass.storeState(); // is currently shown view, state hasn't been stored yet        
        state.controlsState = viewData.controlsState;
        return state;
    }

    restoreViewData(viewData: ViewData) {
        return new Promise(function (resolve, reject) {
            let _restoreFromNode = function (node) {
                if (!this._cleanUpCalled) {
                    viewData.stored = false;
                    let restoredViewData = this.createViewData({
                        node: node,
                        clickedRect: viewData.clickedRect
                    });
                    restoredViewData.timeStamp = viewData.timeStamp;
                    restoredViewData.tag = viewData.tag || {};
                    restoredViewData.controlsState = viewData.controlsState || {};
                    concatObjects(viewData, restoredViewData);

                    resolve(viewData);
                }
            }.bind(this);

            let tree = this.mediatree.controlClass;
            tree.setNodePath(viewData.treePath, null, true /* no focus event */ ).then(
                function () {
                    if (!this._cleanUpCalled) {

                        // tree path is set, now navigate the full "virtual" nodePath (reconstruct full node structure):
                        ODS('restoreViewData: path: ' + viewData.nodePath);
                        nodeUtils.getNodeByPath(this.rootNode, viewData.nodePathSources).then(
                            function (foundNode) {
                                _restoreFromNode(foundNode);
                            },
                            function (foundParent) {
                                reject();
                            });
                    } else {
                        reject();
                    }
                }.bind(this),
                reject
            );
        }.bind(this));
    }

    _storeSharedHistory() {
        // navigation history is shared between layouts/skins (#13229)
        app.setValue('current_tab_history', this.history.storeState());
    }

    _restoreSharedHistory() {
        this.history.restoreState(app.getValue('current_tab_history', {}));
    }

    defaultState() {
        // define the default state here (persistent.json is missing -- i.e. first time run)
        // 'Pinned' is pre-expanded per #13471 - item 3)
        // 'Devices & Services' used to be expanded (per #13767 - item f), but subsequently collapsed because of #19519 ~70084 item 2)
        this.mediatree.controlClass.restoreExpandedNodes(['pinned:SharedList'/*, 'devicesList'*/]);
        this.includeSubfoldersInLocations = false;
    }
    
    storeSizeState() {
        let state : ControlState = {};
        let sidebar = this.qChild('sidebar');
        if (sidebar) {
            let splitters = qeclass(sidebar, 'splitter');
            let n;
            forEach(splitters, (s) => {
                if(s.controlClass) {
                    n = s.getAttribute('data-id');
                    if(n) {
                        state[n] = s.controlClass.storeState();
                    }
                }
            });
        }
        return state;
    }

    storeState(manual?, isCurrentTab?) {
        let state : ControlState = {};
        if (!this.container.hasAttribute('data-is-tab-panel') || manual) { // is part of a tab, it will be stored in mainTabs.storeState(), otherwise it would be stored twice (as part of innerBody too)
            let sidebar = this.qChild('sidebar');
            if (sidebar)
                state.sidebar = sidebar.controlClass.storeState();

            let filter = this.qChild('viewFilterEditor');
            if (filter && filter.controlClass)
                state.filter = filter.controlClass.storeState();

            state.splitter = this.splitter.controlClass.storeState();
            if (isCurrentTab)
                this._storeSharedHistory();
            state.history = this.history.storeState();
            state.plstEditSpot = this.plstEditSpot.controlClass.storeState();
            state.plstEditSpotSplitter = this.plstEditSpotSplitter.controlClass.storeState();
            state.includeSubfoldersInLocations = this.includeSubfoldersInLocations; // #18909
            state.expandedNodes = this.mediatree.controlClass.storeExpandedNodes();
            if (isCurrentTab)
                this.storeDocksVisibility();
            this.storeDocks(state, isCurrentTab);
        }
        return state;
    }

    restoreSizeState(state) {
        if(!state)
            return;
        let sidebar = this.qChild('sidebar');
        if (sidebar) {
            let splitters = qeclass(sidebar, 'splitter');
            let n;
            forEach(splitters, (s) => {
                if(s.controlClass) {
                    n = s.getAttribute('data-id');
                    if(n && state[n]) {
                        s.controlClass.restoreState(state[n]);
                    }
                }
            });
        }
    }

    restoreState(state, isCurrentTab) {
        let sidebar = this.qChild('sidebar');
        if (sidebar)
            sidebar.controlClass.restoreState(state.sidebar);

        let filter = this.qChild('viewFilterEditor');
        if (filter && filter.controlClass)
            filter.controlClass.restoreState(state.filter, isCurrentTab);

        this.splitter.controlClass.restoreState(state.splitter);
        this.plstEditSpotSplitter.controlClass.restoreState(state.plstEditSpotSplitter);
        this.plstEditSpot.controlClass.restoreState(state.plstEditSpot);

        this.includeSubfoldersInLocations = state.includeSubfoldersInLocations;  // #18909 

        // restore the history and the last focused node (and view) at first
        if (isCurrentTab)
            this._restoreSharedHistory();
        else
            this.history.restoreState(state.history);

        if (state.expandedNodes)
            // expand the other nodes (that were expanded last time)
            this.requestTimeout(() => {
                // LS: it seems better to wait a little with expanding the other nodes
                //     1) it speeds up app starting
                //     2) expanding forces tree.beginUpdate / tree.endUpdate which postponed focusedNode setting (in history.restoreState above) and could result in #15135
                this.mediatree.controlClass.restoreExpandedNodes(state.expandedNodes);
            }, 2000);
        this.restoreDocks(state, isCurrentTab);
    }

    storeDocks(state, isCurrentTab) {
        state.docksState = this.docks || [];
        state.panelsState = this.panels || [];
    }

    restoreDocks(state, isCurrentTab) {
        this.docks = state.docksState || [];
        this.panels = state.panelsState || [];
        if (isCurrentTab) {
            this.restoreDocksVisibility();
        }
    }

    storeDocksVisibility() {
        docking.storeDocksState(this);
    }

    restoreDocksVisibility() {
        docking.restoreDocksState(this);
    }

    cleanUp() {
        this.history.cleanUp();
        if(this._saveOrderButton) {
            this._saveOrderButton.remove();
            this._saveOrderButton = undefined;
        }                
        super.cleanUp();
    }

    get rootNode () {
        if (this.mediatree) {
            return this.mediatree.controlClass.dataSource.root;
        } else {
            if (!this._tree) {
                this._tree = app.createTree();
                this._tree.root.handlerID = 'root';
            }
            return this._tree.root;
        }
    }

}
registerClass(MainTabContent);
