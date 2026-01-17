registerFileImport('viewHandlers');

'use strict';

import { MenuItem } from './actions';
import Control, { inherit } from './controls/control';
import Rating from './controls/rating';
import AlbumDataSource from './helpers/albumDataSource';
import ArtistDataSource from './helpers/artistDataSource';
import SeriesDataSource from './helpers/seriesDataSource';

/********************************************************************************************************************************************************

This unit consists of three main objects defining the tree structure of whole app, behaviour of the views and navigation:

1) viewHandlers - defines views (i.e. the view shown in the middle of main window, e.g. tracklist, albumlist, etc.)

2) nodeHandlers - defines nodes and node structure of media tree (and other UI trees as well)

3) navigationHandlers - defines navigation rules, e.g. Find More From Same -> Album uses navigationHandlers to navigate the album in question


All the 3 structures are described in a greater detail below in this unit

*********************************************************************************************************************************************************/



window.viewHandlersClasses = {};
window.viewHandlersClasses.Base = function () { };
window.viewHandlersClasses.Base.prototype = {
    statusbar: false, // deprecated, was replaced by 'statusBar' sub-view
    defaultFocusControl: function (control) {
        return control;
    },
    setFocus: function (control) {
        let ctrl = control;
        if (ctrl) {
            if (ctrl.controlClass && ctrl.controlClass.setFocus) {
                ctrl.controlClass.setFocus(true /* only LV */);
            } else {
                if (ctrl.tabIndex == -1)
                    ctrl.tabIndex = -1; // this is needed to get the control focusable, in 5.1 it is already handled in Control.initialize
                ctrl.focus();
            }
        }
    },
    copySelection: function (fromList, toList) {
        return new Promise<void>(function (resolve) {
            if (fromList && toList) {
                fromList.whenLoaded().then(function () {
                    toList.whenLoaded().then(function () {
                        fromList.getSelectedList().whenLoaded().then(function (sellist) {
                            toList.setSelectionFromListAsync(sellist).then(function () {
                                resolve();
                            });
                        });
                    });
                });
            } else
                resolve();
        });
    },

    getLastDataSource: function (view, previous) {

        let useList = function (primary, secondary?) {
            if ((primary && primary.itemsSelected) ||
                (secondary && !secondary.itemsSelected) ||
                (!secondary)) {
                return primary;
            }
            return secondary;
        };

        let viewProperty = 'currentView';
        if (previous)
            viewProperty = 'lastView';

        let selectionSource = null;
        if (view.dataSourceCache[viewProperty] === 'personGrid') {
            selectionSource = useList(view.dataSourceCache['personlistPopup'], view.dataSourceCache['personlist']);
        } else if (view.dataSourceCache[viewProperty] === 'albumlist') {
            selectionSource = useList(view.dataSourceCache['albumlistPopup'], view.dataSourceCache['albumlist']);
        } else if (view.dataSourceCache[viewProperty] === 'tracklistBase') {
            selectionSource = useList(view.dataSourceCache['tracklistSelection']);
            if (selectionSource) {
                selectionSource.whenLoaded().then(function () {
                    selectionSource.selectRange(0, selectionSource.count - 1, true);
                });
            }
        }

        return selectionSource;
    },

    updateSelection: function (selectionSource, tracklist) {
        if (selectionSource) {
            return this.copySelection(selectionSource, tracklist);
        }
        return new Promise<void>(function (resolve) {
            resolve();
        });
    },

};

export interface ViewHandler {
    enableStickySubviews: boolean;
    disableLastControlEnlarge: boolean;
    title: Resolvable<string>;
    icon: Resolvable<string>;
    controlClass: string; // e.g. controlClass: 'ColumnTrackList' means that 'ColumnTrackList' control will be used as UI element (defined in /controls/columntracklist.js)
    controlClass_initParams?: AnyDict;
    placement?: AnyDict;
    onShow: (control, view) => void; // code to perform when the view is shown 
    onHide: (control, view) => void; // code to perform when the view is hidden
    toolbarActions: Resolvable<import('./actions').Action[]>;
    onBeforeCreate: (view) => void;
    registerActions: (control, view) => void;
    columnsSupport?: boolean;
    storeStateKey?: string, // to share sub-view visibility with List (#15926)
    baseViewType?: string,
    hiddenSubViews?: string[], // sub-views hidden by default
    subViews?: string[],
    viewId?: string, // viewHandler's key/id (assigned automatically in getViewHandler)
    permanent?: boolean; // permanent (always enabled) sub-view
    mutualExclusiveWith?: string[];
    sortBy?: any;
    isCollectionBrowser?: boolean;
    isHome?: Resolvable<boolean>;
    sortByNames?: any[];
    imageSizeMenu?: boolean;
    noAnimation?: Resolvable<boolean>; // to supress zoom in/out animations
    statusbar?: Resolvable<boolean>; // whenther to show status bar, is LEGACY, was replaced by statusbar sub-view (viewHandlers.statusbar)
    searchNotSupported?: boolean;
    setFocus(control: HTMLElement);
    defaultFocusControl(mainControl: HTMLElement): HTMLElement;    
}

export interface NodeHandler {       
    title: Resolvable<string>; // node title (string or funct. returning string)
    setTitle?: (node: SharedNode, title: string) => void; // when renamed using F2 key or in-place edit
    icon: OptionalResolvable<string>; // node icon (string or funct. returning string)
    helpContext?: Resolvable<string>;
    hasChildren?: (node: SharedNode) => boolean; // whether there are some children nodes (boolean, default false)
    hasTreeChildren?: (node : SharedNode) => boolean; // optional - for some nodes we want to limit the hierarchy in TreeView (while keep it in NavigationBar or NodeListView)
    getChildren?: (node: SharedNode) => Promise<void>, // child nodes to be added
    onExpanded?: (node: SharedNode) => void; //  code to perform on node expand
    onCollapsed?: (node: SharedNode) => void; // code to perform on node collapse
    canBeCollapsed?: Resolvable<boolean>;
    getViewDataSource?: (view: ViewData, dataSourceType) => any;
    getDataSource?: () => any;
    organizedPathColumnSupported?: boolean;
    orderColumnSupport?: boolean;
    defaultColumnSort?: string;
    getDefaultColumns?: (col: Collection) => string[];
    viewAs: Resolvable<string[]>;  // e.g. viewAs: ['tracklist'] says that viewHandlers.tracklist defines the view    
    menu?: Resolvable<MenuItem[]>;  // custom popup-menu
    menuAddons?: MenuItem[];
    hideDefaultMenu?: Resolvable<boolean>; // don't append the default popup-menu
    hideTracklistMenu?: boolean;
    filterSupport?: boolean; // whether funnel filtering is supported (default = true)
    toolbarActions?: Resolvable<string[]>; // custom actions to add on toolbar, actions have to contain identifier property with action id        
    canReorderNodes?: Resolvable<boolean>; // whether nodes can be reordered by drag & drop (boolean, default false)
    canReorderItemsInView?: Resolvable<boolean>; // whether items in main view can be reordered
    itemsInViewReordered?: (dataSource, e) => void; // code to perform when items in main view are re-ordered
    reorderOnly?: Resolvable<boolean>;    
    canDelete?: Resolvable<boolean>;  // whether the node can be deleted (boolean, default false)  
    deleteText?: (node) => string; // to override delete text
    deleteItems?: (nodes, permanent?: boolean) => void; // delete behaviour 
    canDrop?: (dataSource, e, callerControl?: Control) => boolean;  // whether can drop/paste on this node (boolean, default false)
    drop?: (dataSource, e, index?) => void; // drop behaviour
    getDropMode?: (dataSource, e) => DropMode; // drop mode (e.g. based on shift key) 
    highlightSupported?: boolean;
    includeSubfoldersSupport?: boolean;
    collapseSupport?: boolean;
    canSaveNewOrder?: boolean;
    hidePropertiesMenu?: boolean;
    readOnlyContent?: boolean;
    forbiddenAutoSearch?: boolean;
    virtualChildrenSupport?: Resolvable<boolean>;
    isFolderType?: boolean;
    isPlaylistType?: boolean;
    isNavbarExpandable?: boolean;
    hideCheckbox?: Resolvable<boolean>;
    preferGlobalSearch?: boolean;
    multiselect: Resolvable<boolean>; // multi-select support
    tooltip?: Resolvable<string>; // help baloon tooltip
    storeColumnsSupported?: Resolvable<boolean>;
    storeStateKey?: string;
    getStateRootKey?: (coll?: Collection) => string; // where to store persistent state of this handler
    defaultPosition?: number; // default order/position of the node
    hiddenSubViews?: string[], // sub-views hidden by default
    formatStatus?: (data) => string;
    checkboxRule?: () => string; // e.g. 'parent_independent'
    sortNodesAndVisibility?: (node: SharedNode) => void; // this method is called when all nodes are added to the list (even from scripts) just to sort nodes
}

declare global {
    function getNodeHandler(view) : NodeHandler;
    function getViewHandler(viewID: string) : ViewHandler;
    var viewHandlersClasses: any;
    var viewHandlers: Dictionary<ViewHandler>;
    var navUtils: NavUtils;
    var nodeUtils: NodeUtils;
    var nodeHandlersClasses: AnyDict;
    var nodeHandlers: Dictionary<NodeHandler>;
    var navigationHandlers: any;
}

function inheritHandler(className, parentClass, methods, properties?): ViewHandler {
    window.viewHandlersClasses[className] = inherit(className, viewHandlersClasses[parentClass], methods, properties);
    return new window.viewHandlersClasses[className]() as ViewHandler;
}

function getNodeHandler(view): NodeHandler {
    return nodeHandlers[view.viewNode.handlerID];
}
window.getNodeHandler = getNodeHandler;

function getViewHandler(viewId): ViewHandler {
    let h = viewHandlers[viewId];
    assert(h, 'View handler for ' + viewId + ' does not exist!');
    h.viewId = viewId;
    return h;
}
window.getViewHandler = getViewHandler;

/**
viewHandlers defines views (i.e. the view shown in the middle of main window, e.g. tracklist, albumlist, etc.)
Particular view handler for a node is defined by nodeHandler, e.g. `nodeHandlers.genre.viewAs: ['genreView', 'albumlist', 'tracklist']` means that we can swith between `'genreView'`, `'albumlist'` and `'tracklist'` to view the genre content

Example (see `/sampleScripts/customNodes/viewHandlers_add.js` for more examples, or the individual handlers below): 

    viewHandlers.tracklist = inheritHandler('Tracklist', 'Base', \{
        controlClass: 'ColumnTrackList', // means that 'ColumnTrackList' control will be used as UI element (defined in /controls/columntracklist.js)
        // the following are optional:
        
        title: 'Show Trackgrid', // title to show on view type switch toolbar
        icon: 'listview',  // icon to show on view type switch toolbar
        toolbarActions: [actions.includeSubfolders], // custom actions to add on toolbar, actions have to contain identifier property with action id        
        onShow: function (control, view) \{\}, // code to perform when the view is shown    
        onHide: function (control, view) \{\}, // code to perform when the view is hidden    
        defaultFocusControl: function (control) \{ return control;\} // optional, used e.g. when Ctrl+A is pressed or 'Scroll to matches' performed
    \});

`'tracklist'` is defined by `viewHandlers.tracklist` below (aka `viewHandlers['tracklist']` ):

***/
export const viewHandlers: Dictionary<ViewHandler> = {

    baseList: inheritHandler('BaseList', 'Base', {
        onShow: function (control, view) {
            this.registerActions(control, view);
        },
        _getInputAction: function (actionID, view) {
            // has to be overriden by descendants
        },
        registerActions: function (control, view) {
            view.listen(control, 'itemdblclick', this._getInputAction('open', view));
            view.listen(control, 'itementer', this._getInputAction('open', view));
            view.listen(control, 'itemclick', this._getInputAction('open', view, true /* check popup support*/));
            view.listen(control, 'itemtap', this._getInputAction('open', view));
            view.listen(control, 'itemview', this._getInputAction('open', view));
        },
    }),

    tracklistBase: inheritHandler('TracklistBase', 'Base', {
        columnsSupport: true,
        toolbarActions: function (view) {
            let res = [];
            if (view.nodehandler.includeSubfoldersSupport)
                res.push(actions.includeSubfolders);
            return res;
        },
        onShow: function (control, view) {
            let handler = getNodeHandler(view);
            let _thisHandler = this;

            control.controlClass.highlightSupported = resolveToValue(handler.highlightSupported, false);
            control.controlClass.organizedPathColumnSupported = resolveToValue(handler.organizedPathColumnSupported, false);

            let lastDS = _thisHandler.getLastDataSource(view);

            let __refreshTracklist = function (eventType, subType?) {
                if (eventType == 'tracklist') {
                    let list;
                    if (handler.getViewDataSource) {
                        list = handler.getViewDataSource(view, 'tracklist');
                    } else
                    if (_thisHandler.getDataSource) {
                        list = _thisHandler.getDataSource(view);
                    } else
                    if (view.viewNode.dataSource) {
                        if (view.viewNode.dataSource.objectType === 'track') {
                            list = app.utils.createTracklist(false);
                            app.getObject('track', {
                                id: view.viewNode.dataSource.id
                            }).then(function (track) {
                                list.add(track);
                                list.notifyLoaded();
                            });
                        } else {
                            list = view.viewNode.dataSource.getTracklist();
                        }
                    }

                    if (list) {

                        let _assign = function () {
                            if (lastDS) {
                                _thisHandler.updateSelection(lastDS, list);
                            }
                            if (control.controlClass.setDataSourceSameView) {
                                control.controlClass.setDataSourceSameView(list);
                            } else {
                                control.controlClass.dataSource = list;
                            }
                        };

                        if (control.controlClass.dataSource && isPromiseCanceled(control.controlClass.dataSource.whenLoaded())) {
                            view._cancelDelayedAssign();
                            _assign();
                        } else {
                            view.delayedAssign(list, _assign);
                        }

                        // view.promise (to be canceled when switching view)
                        let pr_id = 'refresh_tracklist_promise';
                        view.cancelPromise(pr_id);
                        view.promise(list.whenLoaded(), pr_id).then(() => {
                            view.dataSourceCache['tracklist_unfiltered'] = list.getCopy(); // to use it as the original unfiltered instance in case contextual search is performed before ColumnBrowser showing (#15734)
                        });
                        view.dataSourceCache['tracklist'] = list; // needs to be cached here on showing so that sub-views like ColumnBrowser can use it                                                              
                        view.dataSourceCache['tracklist_origAutoUpdateDisabled'] = list.autoUpdateDisabled;
                        if (subType != 'reorder') //  to prevent from losing selection when user is just re-ordering
                            view.dataSourceCacheObserver.notifyChange('tracklist'); // is listened by ColumnBrowser sub-view
                        view.loadProgress('tracklist', _('Reading files...'));
                    }
                }
            };
            if (view.dataSourceCache['tracklist']) {
                control.controlClass.dataSource = view.dataSourceCache['tracklist'];
                if (lastDS) {
                    this.updateSelection(lastDS, control.controlClass.dataSource);
                }
            } else {
                __refreshTracklist('tracklist');
            }

            view.dataSourceCache.lastView = view.dataSourceCache.currentView;
            view.dataSourceCache.currentView = 'tracklistBase';

            if (view.viewNode.dataSource && view.viewNode.dataSource.isObservable)
                view.listen(view.viewNode.dataSource, 'change', (eventType, subType) => {
                    view.reloading = true; // to take any effect in view.delayedAssing
                    __refreshTracklist(eventType, subType);
                    view.reloading = undefined;
                });

            if (handler && handler.reorderOnly)
                control.controlClass.reorderOnly = resolveToValue(handler.reorderOnly, true);
            view.listen(control, 'touchstart', (e) => {
                if (e.touches.length) {
                    this.touchPos = {
                        left: e.touches[0].screenX,
                        top: e.touches[0].screenY
                    };
                    this.touchStartTime = Date.now();
                } else
                    this.touchPos = undefined;

            });
            view.listen(control, 'touchend', (e) => {
                if (this.touchPos) {
                    let touch = undefined;
                    if (e.touches.length)
                        touch = e.touches[0];
                    else if (e.changedTouches.length)
                        touch = e.changedTouches[0];

                    if (touch && ((Math.abs(this.touchPos.left - touch.clientX) < 5) && (Math.abs(this.touchPos.top) - touch.clientY) < 5)) {
                        if (Date.now() - this.touchStartTime > 250) // use default action when touch is longer than 250ms
                            uitools.touchDefaultItemAction();
                    }
                }
            });
            view.listen(control, 'itemdblclick', uitools.defaultItemAction);
            view.listen(control, 'itementer', uitools.defaultItemAction);
        },
        onHide: function (control, view) {
            let ds = control.controlClass.dataSource;
            if (ds && (!ds.isLoaded || isPromiseCanceled(ds.whenLoaded())))
                view.dataSourceCache['tracklist'] = null; // cache only the fully loaded source for later usage (e.g. when returning back to this view in a second)

            // in tracklist based views we store selection as 'tracklist' is shared among them
            if ((!view.dataSourceCache['tracklistSelection']) || // check selection isn't filling somewhere else (like column browser)
                (view.dataSourceCache['tracklistSelection'] && view.dataSourceCache['tracklistSelection'].isLoaded)) {
                view.dataSourceCache['tracklistSelection'] = null;
                if (view.dataSourceCache['tracklist'])
                    view.dataSourceCache['tracklistSelection'] = view.dataSourceCache['tracklist'].getSelectedList();
            }
            if (!view.reloading)
                control.controlClass.dataSource = null; // cancel/free/unregister the dataSource
        },
        subViews: ['columnBrowser', 'statusBar'],
        hiddenSubViews: ['columnBrowser'], // sub-views hidden by default
        baseViewType: 'list'
    }),

    tracklist: inheritHandler('Tracklist', 'TracklistBase', {
        controlClass: 'ColumnTrackList',
        title: function () {
            return _('List');
        },
        icon: 'listview',
        onShow: function (control, view) {


            if (this.controlClass_initParams && this.controlClass_initParams.showHeader == false)
                control.controlClass.showHeader = false;
            else
                control.controlClass.showHeader = true;

            let sortString = window.uitools.getDefaultColumnSort(view);
            if (sortString) {
                if (sortString == 'none')
                    sortString = '';
                control.controlClass.getDefaultSortString = function () {
                    return sortString;
                };
                control.controlClass.setSortColumns(sortString);
            }

            viewHandlersClasses['Tracklist'].$super.onShow.apply(this, arguments);
        },
        onHide: function (control, view) {
            viewHandlersClasses['Tracklist'].$super.onHide.apply(this, arguments);
            let handler = getNodeHandler(view);
            if (resolveToValue(handler.canReorderItemsInView, false) && resolveToValue(handler.canSaveNewOrder, true, view.viewNode)) {
                uitools.cleanUpSaveButton();
            }
        }
    }),

    groupedTracklist: inheritHandler('GroupedTracklist', 'Tracklist', {
        groupsSupport: true,
        controlClass: 'GroupedTrackList',
        title: function () {
            return _('List (by Album)');
        },
        toolbarActions: function (view) {
            let res = [];
            let handler = getNodeHandler(view);
            if (resolveToValue(handler.collapseSupport, true)) {
                res.push(actions.limitAlbumTrackRows);
            }
            if (handler.includeSubfoldersSupport)
                res.push(actions.includeSubfolders);
            return res;
        },
        icon: 'columnlist',
        storeStateKey: 'tracklist', // to share sub-view visibility (#17141)
        onShow: function (control, view) {
            let handler = getNodeHandler(view);
            let collapseSupport = resolveToValue(handler.collapseSupport, true);
            control.controlClass.collapseSupport = collapseSupport;

            viewHandlersClasses['GroupedTracklist'].$super.onShow.apply(this, arguments);
        },
        onHide: function (control, view) {
            viewHandlersClasses['GroupedTracklist'].$super.onHide.apply(this, arguments);
        },
        defaultSummaryColumns: ['album', 'albumArtist', 'date', 'rating']
    }),

    seriesGroupedTracklist: inheritHandler('SeriesGroupedTracklist', 'GroupedTracklist', {
        title: function () {
            return _('List (by Series)');
        },
    }),

    contentGroupedTracklist: inheritHandler('ContentGroupedTracklist', 'GroupedTracklist', {
        controlClass_initParams: {
            groupBy: 'content',
            sortStoringDisabled: true, // to be always pre-sorted by content (grouped by signature/fingerprint) // #20580
        },
        title: function () {
            return _('List (by Content)');
        },
        onShow: function (control, view) { // @ts-ignore
            if (!window.qUnit && !app.db.isDuplicateAnalyzeRunning() && !viewHandlers.contentGroupedTracklist._alreadyAskedRedundancy) {
                app.db.getQueryResultAsync('SELECT Count(*) FROM Songs WHERE SignType = 0').then((qry) => {
                    let cnt = parseInt(qry.fields.getValue(0));
                    if (cnt > 0) {
                        let sett = settings.get('Options');
                        if (sett && sett.Options.AskAnalyzeRedundancy) { // @ts-ignore
                            viewHandlers.contentGroupedTracklist._alreadyAskedRedundancy = true; // #18256
                            messageDlg(sprintf(_('%d tracks in your library have not been analyzed for redundancy. Would you like to analyze them now (this takes a fair amount of time)?'), cnt), 'Confirmation', ['btnYes', 'btnNo'], {
                                defaultButton: 'btnYes',
                                chbCaption: _('Don\'t show this again'),
                                title: _('Duplicate Content')
                            }, function (result) {
                                if (result.checked) {
                                    sett.Options.AskAnalyzeRedundancy = false;
                                    settings.set(sett, 'Options');
                                }
                                if (result.btnID === 'btnYes') {
                                    app.db.runDuplicateAnalyze();
                                }
                            });
                        } else {
                            app.db.runDuplicateAnalyze();
                        }
                    }
                });
            }

            viewHandlersClasses['ContentGroupedTracklist'].$super.onShow.apply(this, arguments);
        },
    }),

    ungroupedAlbumsGroupedTracklist: inheritHandler('UngroupedAlbumsGroupedTracklist', 'GroupedTracklist', {
        controlClass_initParams: {
            groupBy: 'albumYear',
        },
    }),

    simpleTracklist: inheritHandler('SimpleTracklist', 'Tracklist', {
        columnsSupport: false,
        controlClass: 'SimpleTracklist',
        title: function () {
            return _('Simplified list');
        },
        icon: 'listview',
        // onShow: inherited from Tracklist
        // onHide: inherited from Tracklist    
    }),

    albumTracklist: inheritHandler('AlbumTracklist', 'Tracklist', {
        controlClass: 'AlbumTracklist',
        title: function () {
            return _('Browser');
        },
        icon: 'browser',
        // onShow: inherited from Tracklist
        // onHide: inherited from Tracklist
    }),

    videoGrid: inheritHandler('VideoGrid', 'TracklistBase', {
        columnsSupport: false,
        controlClass_initParams: {
            showHeader: true,
        },
        controlClass: 'VideoGrid',
        title: function () {
            return _('Grid (videos)');
        },
        icon: 'gridview',
        imageSizeMenu: true
        // onShow: inherited from TracklistBase
        // onHide: inherited from TracklistBase
    }),

    trackGrid: inheritHandler('TrackGrid', 'TracklistBase', {
        columnsSupport: false,
        controlClass: 'VideoGrid',
        controlClass_initParams: {
            useTemplate: 'trackGrid'
        },
        title: function () {
            return _('Grid');
        },
        icon: 'gridview',
        imageSizeMenu: true
        // onShow: inherited from TracklistBase
        // onHide: inherited from TracklistBase
    }),

    playlist_header: inheritHandler('Playlist_header', 'Base', {
        controlClass: 'PlaylistHeader',
        title: _('Info panel'),
        icon: 'browser',
        placement: {
            position: 'top',
            inScroller: true
        },
        onShow: function (control, view) {
            control.controlClass.dataSource = view.viewNode.dataSource; // playlist        
            control.controlClass.tracklist = view.dataSourceCache['tracklist'];
            view.listen(view.dataSourceCacheObserver, 'change', function (eventType) {
                if ((eventType == 'tracklist') && (control.controlClass)) {
                    control.controlClass.tracklist = view.dataSourceCache['tracklist']; // new tracklist
                }
            }, 'playlist_header_datasourceobservable_listen');
        },
        onHide: function (control, view) {
            control.controlClass.dataSource = undefined;
        }
    }),

    baseVirtualSubView: inheritHandler('BaseVirtualSubView', 'Base', {
        isVirtual: true,
        setBit: function (view, control, UIName, show) {
            let div = qeid(control, UIName);
            if (div) {
                setVisibility(div, show);
            }
        },
        onShow: function (control, view) {
            this.setBit(view, control, this.UIName, true);
        },

        onHide: function (control, view) {
            this.setBit(view, control, this.UIName, false);
        }
    }),

    home_NodeList: inheritHandler('Home_NodeList', 'BaseVirtualSubView', {
        title: _('Media Nodes'),
        UIName: 'nodesGridView',
    }),

    suggestedArtists: inheritHandler('SuggestedArtists', 'BaseVirtualSubView', {
        title: _('Suggested Artists'),
        UIName: 'artists',
    }),

    suggestedAlbums: inheritHandler('SuggestedAlbums', 'BaseVirtualSubView', {
        title: _('Suggested Albums'),
        UIName: 'albums',
    }),

    pinnedList: inheritHandler('PinnedList', 'BaseVirtualSubView', {
        title: _('Pinned list'),
        UIName: 'pinnedList',
    }),

    inProgress: inheritHandler('InProgress', 'BaseVirtualSubView', {
        title: _('In progress'),
        UIName: 'inProgress',
    }),

    watched: inheritHandler('Watched', 'BaseVirtualSubView', {
        title: _('Recently watched'),
        UIName: 'watched',
    }),

    added: inheritHandler('Added', 'BaseVirtualSubView', {
        title: _('Recently added'),
        UIName: 'added',
    }),

    columnBrowser: inheritHandler('ColumnBrowser', 'Base', {
        title: _('Column filter'),
        placement: {
            position: 'top',
            //inScroller: true,
            hasSplitter: true,
        },
        controlClass: 'TracklistFilter',
        controlClass_initParams: {
            minHeight: function () { // use function, so it is computed later, when document.body always exists
                return 3 * fontLineSizePx() + 'px';
            },
            height: function () {
                return 14 * fontLineSizePx() + 'px';
            },
        },
        onShow: function (control, view, mainViewControl) {
            notifySplitterChange(); // Showing/hiding the column browser is a major change for the splitter state
            let _this = this;
            control.classList.add('sidePanel');

            let lastDS = _this.getLastDataSource(view, true /* use previous DS as view's onShow is called before this */);

            let _changeList = function (list, assignAsOrig, restoreSelection?: boolean) {
                let pr_id = 'column_browser_tracklist_promise';
                view.cancelPromise(pr_id);
                let state;
                if (restoreSelection)
                    state = control.controlClass.storeState();
                control.controlClass.dataSource = null;
                let listen_id = 'column_browser_tracklist_listen';
                view.unlisten(listen_id);
                if (!list)
                    return;
                view.promise(list.whenLoaded(), pr_id).then(function () {
                    if (!control.controlClass) // control was already cleared, stop processing
                        return;
                    if (restoreSelection)
                        control.controlClass.restoreState(state);
                    control.controlClass.dataSource = list.getCopy();
                    control.controlClass.dataSource.globalModifyWatch = true; // #16628

                    view.listen(control, 'dataresult', function (e) {
                        let promises = [];
                        if (assignAsOrig && lastDS) {
                            promises.push(_this.updateSelection(lastDS, list));
                        }

                        if (!list.hasSameItems(e.detail.tracks)) { // LS: In order to not lost focused index whenever the filtered list has still the same content
                            if (assignAsOrig && lastDS) {
                                promises.push(_this.updateSelection(lastDS, e.detail.tracks));
                            }

                            whenAll(promises).then(function () {
                                list.useList(e.detail.tracks);
                                e.detail.tracks.autoSortString = list.autoSortString; // LS: small hack to resolve #20179 (to keep current sort order)
                                list.autoUpdateDisabled = true; // don't perform auto-update on filtered list, it would cause the whole list to re-appear                            
                                if (e.detail.dblClicked) {
                                    window.uitools.defaultItemAction(list);
                                }
                            });
                        } else if (assignAsOrig) {
                            whenAll(promises).then(function () {
                                list.notifyChanged('newcontent');
                                if (e.detail.dblClicked) {
                                    window.uitools.defaultItemAction(list);
                                }
                            });
                        } else {
                            if (e.detail.dblClicked) {
                                whenAll(promises).then(function () {
                                    window.uitools.defaultItemAction(list);
                                });
                            }
                        }
                        assignAsOrig = false;
                    }, listen_id);
                });
            };

            _changeList(view.dataSourceCache['tracklist'], true); // to init the list for filtering

            view.listen(view.dataSourceCacheObserver, 'change', function (eventType) {
                if (eventType == 'tracklist') {
                    _changeList(view.dataSourceCache['tracklist'], true); // new tracklist (e.g. adding or deleting a track from/to a playlist)
                }
            }, 'column_browser_datasourceobservable_listen');

            view.listen(mainViewControl, 'datasourcefiltered', function (e) {
                let list = e.detail.filtered;
                if (list.objectType == 'tracklist') {
                    // this is when mainViewControl is TracklistView (or descendant)
                    if (e.detail.phrase == '') {
                        // search was canceled, return the original unfiltered list from cache:
                        if (view.dataSourceCache['tracklist_unfiltered'])
                            list.useList(view.dataSourceCache['tracklist_unfiltered']); // useList() -- so that 'newcontent' is called on the original list (in the _changeList above)               
                        view.dataSourceCache['tracklist_unfiltered'] = null;
                    } else {
                        // we need to store to the cache rather the list unfiltered by Column Browser (#16457)
                        if (!view.dataSourceCache['tracklist_unfiltered'])
                            view.dataSourceCache['tracklist_unfiltered'] = control.controlClass.dataSource /* #16457 */ || e.detail.original /* #17104 */;
                    }
                    _changeList(list, false); // to use filtered list (when typing something to search bar to filter the orig. list -- i.e. performing local search)                            
                } else
                if (e.detail.original_tracklist) {
                    // this is when mainViewControl is AlbumListView (or descendant)
                    let orig_list = e.detail.original_tracklist;
                    if (!view.dataSourceCache['tracklist_unfiltered'])
                        view.dataSourceCache['tracklist_unfiltered'] = control.controlClass.dataSource /* #16457 */ || orig_list.getCopy() /* #17104 */;

                    if (e.detail.phrase == '') {
                        orig_list.useList(view.dataSourceCache['tracklist_unfiltered']); // useList() -- so that 'newcontent' is called on the original list (in the _changeList above)                        
                        _changeList(orig_list, false);
                        view.dataSourceCache['tracklist_unfiltered'] = null;
                    } else {
                        list = orig_list.filterBySearchPhrase(e.detail.phrase);
                        let pr_id= 'column_browser_albumlist_tracklist_promise';
                        view.cancelPromise(pr_id);
                        view.promise(list.whenLoaded(), pr_id).then(() => {
                            orig_list.useList(list); // so that 'newcontent' is called on the original list (in the _changeList above)                        
                            _changeList(orig_list, false);
                        });
                    }
                }
            }, 'column_browser_datasourcefiltered_listen');

            if (isFunction(mainViewControl.controlClass.forceReRender))
                mainViewControl.controlClass.forceReRender(); // #17873: When column filter is shown, tracklist links do not appear despite focused item persisting
        },
        onHide: function (control, view, mainViewControl) {
            // to keep unfiltered instance in cache:
            let unfilteredCopy = control.controlClass.dataSource;
            if (view.dataSourceCache['tracklist_unfiltered']) {
                unfilteredCopy = view.dataSourceCache['tracklist_unfiltered'];
                view.dataSourceCache['tracklist_unfiltered'] = null;
            }
            if (unfilteredCopy && unfilteredCopy.objectType == 'tracklist' && view.dataSourceCache['tracklist']) {
                // !! we need to keep still the same instance so that 'autoupdate' works (fillingMethod of the SharedList)            
                let sel = view.dataSourceCache['tracklist'].getSelectedList();
                view.dataSourceCache['tracklist'].useList(unfilteredCopy); // LS: needs to be set immediatelly, not after sel.whenLoaded() - otherwise #15114 and #14969 appears!
                sel.whenLoaded().then(function () {
                    if (control.controlClass && view.dataSourceCache['tracklist']) {
                        view.dataSourceCache['tracklistSelection'] = sel;
                        view.dataSourceCache['tracklist'].autoUpdateDisabled = view.dataSourceCache['tracklist_origAutoUpdateDisabled'];
                        // apply selection to unfiltered list so selection persist
                        sel.selectRange(0, sel.count - 1, true);
                        this.updateSelection(sel, view.dataSourceCache['tracklist']);
                    }
                }.bind(this));
            }
            control.controlClass.dataSource = null;
            view.unlisten('column_browser_datasourcefiltered_listen'); // for the cases when only ColumnBrowser sub-view is hidden and shown again (not the whole view)
            view.unlisten('column_browser_datasourceobservable_listen'); // for the cases when only ColumnBrowser sub-view is hidden (not the whole view)
        }
    }),

    playlist_tracklist: inheritHandler('Playlist_tracklist', 'Tracklist', {
        title: () => {
            return _('List');
        },
        statusbar: false, // status bar is in subViews below
        onBeforeCreate: function (view) {
            let pl = view.viewNode.dataSource;
            if (pl && pl.isAutoPlaylist && (pl.inEdit || pl.isNew)) {
                // LS: when auto-playlist is newly created (or edited)
                //     we need to ensure that the 'Info panel' is shown to show the auto-playlist criteria editor (#15522 / #16928)            
                view.forceShowSubViewIDs = view.forceShowSubViewIDs || [];
                view.forceShowSubViewIDs.push('playlist_header');
            }
        },
        onHide: function (control, view) {
            viewHandlersClasses['Playlist_tracklist'].$super.onHide.apply(this, arguments);
            view.forceShowSubViewIDs = [];
        },
        storeStateKey: 'playlistsList', // to share sub-view visibility with List (Albums) (#15926)
        baseViewType: 'list',
        hiddenSubViews: ['columnBrowser', 'playlist_NodeList'],
        subViews: ['columnBrowser', 'playlist_header', 'playlist_Tree', 'playlist_RowNodeList', 'playlist_NodeList', 'statusBar']
    }),

    playlist_browser: inheritHandler('Playlist_browser', 'Playlist_tracklist', {
        title: () => {
            return _('Browser');
        },
        columnsSupport: false,
        icon: 'browser',
        storeStateKey: 'playlistsBrowser', // to not share sub-view visibility with 'List' and 'List (Albums)' (#15926)
        baseViewType: 'list',
        hiddenSubViews: ['columnBrowser', 'playlist_RowNodeList'],
        subViews: ['columnBrowser', 'playlist_header', 'playlist_Tree', 'playlist_RowNodeList', 'playlist_NodeList', 'statusBar']
    }),

    playlist_groupedTracklist: inheritHandler('Playlist_groupedTracklist', 'GroupedTracklist', {
        controlClass_initParams: {
            groupBy: 'album',
            useDefaultSort: 'playOrder ASC',
        },
        onBeforeCreate: function (view) {
            viewHandlers.playlist_tracklist.onBeforeCreate.apply(this, arguments); // due to #15522
        },
        onHide: function (control, view) {
            viewHandlersClasses['Playlist_groupedTracklist'].$super.onHide.apply(this, arguments);
            if (view.__deactivateHeaderOnHide) {
                let state = nodeUtils.getViewHandlerState(view);
                state.hiddenSubViews['playlist_header'] = true;
                nodeUtils.setViewHandlerState(view, state);
                view.__deactivateHeaderOnHide = null;
            }
        },
        statusbar: false, // status bar is in subViews below
        storeStateKey: 'playlistsList', // to share sub-view visibility with List (#15926)
        baseViewType: 'listByAlbum',
        hiddenSubViews: ['columnBrowser', 'playlist_NodeList'],
        subViews: ['columnBrowser', 'playlist_header', 'playlist_Tree', 'playlist_RowNodeList', 'playlist_NodeList', 'statusBar']
    }),

    playlist_trackgrid: inheritHandler('Playlist_trackgrid', 'TrackGrid', {
        title: () => {
            return _('Grid') + ' (' + _('Tracks') + ')';
        },
        statusbar: false, // status bar is in subViews below
        onBeforeCreate: function (view) {
            viewHandlers.playlist_tracklist.onBeforeCreate.apply(this, arguments); // due to #15522
        },
        onHide: function (control, view) {
            viewHandlersClasses['Playlist_trackgrid'].$super.onHide.apply(this, arguments);
            if (view.__deactivateHeaderOnHide) {
                let state = nodeUtils.getViewHandlerState(view);
                state.hiddenSubViews['playlist_header'] = true;
                nodeUtils.setViewHandlerState(view, state);
                view.__deactivateHeaderOnHide = null;
            }
        },
        storeStateKey: 'playlistsGrid', // to not share sub-view visibility with List and List (Albums) (#15926)
        baseViewType: 'grid',
        hiddenSubViews: ['columnBrowser', 'playlist_RowNodeList'],
        subViews: ['columnBrowser', 'playlist_header', 'playlist_Tree', 'playlist_RowNodeList', 'playlist_NodeList', 'statusBar']
    }),

    downloader: inheritHandler('Downloader', 'Base', {
        controlClass: 'DownloadView'
    }),

    nodeList: inheritHandler('NodeList', 'BaseList', {
        title: function () {
            return _('Grid');
        },
        baseViewType: 'grid',
        icon: 'gridview',
        controlClass: 'NodeListView',
        controlClass_initParams: {
            standardItemSize: true
        },
        onShow: function (control, view) {
            control.controlClass.prepareDatasource(view.viewNode);
            this.registerActions(control, view);
        },
        onHide: function (control, view) {
            control.controlClass.prepareDatasource(null);
        },
        _getInputAction: function (actionID, view, checkPopupSupport) {
            if (actionID == 'open') {
                let _this = this;
                return function (e) {
                    let node = e.detail.item;
                    if (node) {
                        if (checkPopupSupport && node.dataSource && templates.popupRenderers[node.dataSource.objectType])
                            return;
                        if (view) {
                            let clickedRect = getAbsPosRect(e.detail.div);
                            if (resolveToValue(_this.noAnimations, false, view))
                                clickedRect = undefined;
                            view.mainTabContent.showView({
                                node: node,
                                clickedRect: clickedRect,
                                setFocus: true,
                                newTab: !!e.detail.newTab
                            });
                        }
                    }
                };
            }
        },
        imageSizeMenu: false
    }),

    rowNodeList: inheritHandler('RowNodeList', 'NodeList', {
        title: _('List'),
        icon: 'listview',
        controlClass_initParams: {
            rowItems: true
        },
        noAnimations: true,
        baseViewType: 'list'
    }),

    playlist_NodeList: inheritHandler('Playlist_NodeList', 'NodeList', {
        title: _('Grid') + ' (' + _('Playlists') + ')',
        placement: {
            position: 'top',
            inScroller: true,
        },
        controlClass_initParams: {
            imageTemplate: 'playlistNode',
            horizontalSeparator: true
        },
        noAnimations: (view) => {
            if (view) {
                let state = nodeUtils.getViewHandlerState(view);
                if (!state.hiddenSubViews['playlist_Tree'])
                    return true; // with the playlist tree enabled we cannot use animations as the second instance of the tree would be created (and thus old selection not preserved)
            }
        },
        mutualExclusiveWith: ['playlist_RowNodeList']
    }),

    playlist_RowNodeList: inheritHandler('Playlist_RowNodeList', 'NodeList', {
        title: _('List') + ' (' + _('Playlists') + ')',
        placement: {
            position: 'top',
            inScroller: true,
        },
        controlClass_initParams: {
            imageTemplate: 'playlistNode',
            rowItems: true,
            horizontalSeparator: true
        },
        noAnimations: true,
        baseViewType: 'list',
        mutualExclusiveWith: ['playlist_NodeList']
    }),

    playlist_Tree: inheritHandler('Playlist_Tree', 'Base', {
        title: _('Tree') + ' (' + _('Playlists') + ')',
        placement: {
            position: 'left',
            hasSplitter: true,
        },
        controlClass: 'TreeView',
        controlClass_initParams: {
            minWidth: function () { // use function, so it is computed later, when document.body always exists
                return 3 * fontLineSizePx() + 'px';
            },
            width: function () {
                return 14 * fontLineSizePx() + 'px';
            },
            rootNode: 'playlists',
            keepChildrenWhenCollapsed: true,
            enableDragDrop: true,
            expandRoot: true,
            dontResetState: true // #15738: item 3
        },
        onShow: function (control, view) {

            let n = view.viewNode;
            let persistentID = n.persistentID;
            let folderRoot = n;
            while (n) {
                let nh = nodeHandlers[n.handlerID];
                if (nh.isFolderType || nh.isPlaylistType)
                    folderRoot = n;
                n = n.parent;
            }

            let tree = control.controlClass;
            let _checkFocused = () => {
                if (!tree.focusedNode || persistentID != tree.focusedNode.persistentID) {
                    let idx = view.viewNode.nodePath.indexOf(tree.root.nodePath);
                    if (idx) {
                        let usePath = view.viewNode.nodePath.substr(idx);
                        tree.nodePath = usePath;
                    }
                }
            };

            if (!tree.root.nodePath || (folderRoot.nodePath.indexOf(tree.root.nodePath) < 0)) { // #16516          
                tree.root.handlerID = folderRoot.handlerID;
                tree.root.dataSource = folderRoot.dataSource;
                tree._parentRootNode = folderRoot;
                tree.expandNode(tree.root).then(_checkFocused);
            } else {
                _checkFocused();
            }

            view.listen(control, 'focuschange', function (e) {
                let node = control.controlClass.focusedNode;

                let cls = control.controlClass;
                cls.requestFrame(function () {
                    cls.setStatus(undefined);
                    cls.contextMenu = nodeUtils.createContextMenu(function () {
                        let retList = app.utils.createSharedList();
                        if (cls.dataSource.focusedNode)
                            retList.add(cls.dataSource.focusedNode);
                        return retList;
                    });
                }, 'nodeContextMenu');
            });

            // LS: moved to 'mouseup' due to #18097
            view.listen(control, 'mouseup', function (e) {
                let node = control.controlClass.focusedNode;
                if (node && !control.controlClass.settingNodePath) {
                    control.controlClass.suppliedStoreStateNode = control.controlClass.previousFocusedNode;

                    let nodePath = [];
                    while (node) {
                        nodePath.splice(0, 0, nodeUtils.storeNode(node));
                        node = node.parent;
                    }

                    if (control.controlClass._parentRootNode) {
                        // LS: to construct parent path when folder is sub to Pinned node (#18985) or a Location folder sub to collection (#16881)
                        node = control.controlClass._parentRootNode.parent;
                        while (node) {
                            nodePath.splice(0, 0, nodeUtils.storeNode(node));
                            node = node.parent;
                        }
                    } else {
                        nodePath.splice(0, 0, navUtils.createNodeState('root'));
                    }

                    navUtils.navigateNodePath(nodePath);
                }
            });
        }
    }),

    folder_Tree: inheritHandler('Folder_Tree', 'Playlist_Tree', {
        title: _('Tree') + ' (' + _('Folders') + ')',
        controlClass_initParams: {
            minWidth: function () { // use function, so it is computed later, when document.body always exists
                return 3 * fontLineSizePx() + 'px';
            },
            width: function () {
                return 14 * fontLineSizePx() + 'px';
            },
            keepChildrenWhenCollapsed: true,
            enableDragDrop: true,
            dontResetState: true // #15738: item 3
        }
    }),

    statusBar: inheritHandler('StatusBar', 'Base', {
        title: _('Status bar'),
        placement: {
            position: 'bottom',
            inScroller: false,
        },
        controlClass: 'Statusbar',
        controlClass_initParams: {
            listener: 'contentContainer',
            alwaysVisible: true,
        },
        onShow: function (control, view, mainViewControl, onlyDataInit, singleViewChange) {
            if (singleViewChange) {
                uitools.refreshView(10); // reload view, so status is correctly created from all subviews
            }
        }
    }),

    folder_NodeList: inheritHandler('Folder_NodeList', 'NodeList', {
        title: _('Grid') + ' (' + _('Folders') + ')',
        placement: {
            position: 'top',
            inScroller: true,
        },
        controlClass_initParams: {
            horizontalSeparator: true,
            standardItemSize: true
        },
        noAnimations: (view) => {
            if (view) {
                let state = nodeUtils.getViewHandlerState(view);
                if (!state.hiddenSubViews['folder_Tree'])
                    return true; // with the folder tree enabled we cannot use animations as the second instance of the tree would be created (and thus old selection not preserved)
            }
        },
        mutualExclusiveWith: ['folder_RowNodeList']
    }),

    folder_RowNodeList: inheritHandler('Folder_RowNodeList', 'NodeList', {
        title: _('List') + ' (' + _('Folders') + ')',
        icon: 'listview',
        placement: {
            position: 'top',
            inScroller: true,
        },
        controlClass_initParams: {
            rowItems: true,
            horizontalSeparator: true,
            standardItemSize: true
        },
        noAnimations: true,
        baseViewType: 'list',
        mutualExclusiveWith: ['folder_NodeList']
    }),

    collection_NodeList: inheritHandler('Collection_NodeList', 'NodeList', {
        title: _('Collection browser'),
        placement: {
            position: 'top',
            inScroller: true,
        },
        controlClass_initParams: {
            isHorizontal: false,
            smallItemSize: true,
        },
        onControlCreated: function (control) {
            control.classList.add('padding');
        }
    }),

    genreCategories_nodeList: inheritHandler('GenreCategories_NodeList', 'NodeList', {
        title: _('Grid') + ' (' + _('Categories') + ')'
    }),

    pinnedListView: inheritHandler('PinnedListView', 'NodeList', {
        controlClass: 'PinnedListView',
    }),

    playlistsListView: inheritHandler('PlaylistsListView', 'NodeList', {
        title: function () {
            return _('List');
        },
        controlClass: 'NodeListView',
        icon: 'listview',
        controlClass_initParams: {
            imageTemplate: 'playlistNode',
            rowItems: true
        },
        noAnimations: true,
        baseViewType: 'list',
        storeStateKey: 'playlistsSharedBase', // to share sub-view visibility with the root playlists node (#15926 - S4)    
        subViews: ['playlist_Tree', 'statusBar']
    }),

    playlistsGridView: inheritHandler('PlaylistsGridView', 'NodeList', {
        controlClass: 'NodeListView',
        controlClass_initParams: {
            imageTemplate: 'playlistNode',
            standardItemSize: true
        },
        storeStateKey: 'playlistsSharedBase', // to share sub-view visibility with the root playlists node (#15926 - S4)
        baseViewType: 'grid',
        subViews: ['playlist_Tree', 'statusBar']
    }),

    collectionTabbedView: inheritHandler('CollectionTabbedView', 'Base', {
        title: function () {
            return _('Tabbed view');
        },
        icon: 'tabbed',
        controlClass: 'CollectionView',
        onShow: function (control, view) {
            control.controlClass.dataSource = view;
        },
        onHide: function (control, view) {
            control.controlClass.dataSource = undefined;
        },
        defaultFocusControl: function (control) {
            return control.controlClass.multiView;
        }
    }),

    baseCollectionView: inheritHandler('BaseCollectionView', 'Base', {
        title: function () {
            return _('Browser');
        },
        icon: 'browser',
        onShow: function (control, view) {
            control.controlClass.dataSource = view;
            actions.viewFilter.hide(); // #18286
            actions.viewFilter.discard();
        },
        onHide: function (control, view) {
            control.controlClass.dataSource = undefined;
        },
        subViews: ['collection_NodeList', 'pinnedList'],
        imageSizeMenu: true,
        isCollectionBrowser: true,
        disableLastControlEnlarge: true
    }),

    musicCollectionView: inheritHandler('MusicCollectionView', 'BaseCollectionView', {
        controlClass: 'MusicCollectionView',
        subViews: ['collection_NodeList', 'suggestedArtists', 'suggestedAlbums', 'pinnedList'],
        disableLastControlEnlarge: true
    }),

    audiobookCollectionView: inheritHandler('AudiobookCollectionView', 'BaseCollectionView', {
        controlClass: 'AudiobookCollectionView',
        subViews: ['collection_NodeList', 'suggestedAlbums', 'inProgress', 'pinnedList'],
    }),

    videoCollectionView: inheritHandler('VideoCollectionView', 'BaseCollectionView', {
        controlClass: 'VideoCollectionView',
        subViews: ['collection_NodeList', 'watched', 'added', 'pinnedList'],
    }),

    tvCollectionView: inheritHandler('tvCollectionView', 'BaseCollectionView', {
        controlClass: 'TVCollectionView',
        subViews: ['collection_NodeList', 'watched', 'added', 'pinnedList'],
    }),

    homeView: inheritHandler('HomeView', 'Base', {
        title: function () {
            return ''; //_('Home');
        },
        icon: 'home',
        isHome: true,
        controlClass: 'HomeView',
        onShow: function (control, view) {
            control.controlClass.dataSource = view;
        },
        onHide: function (control, view) {
            control.controlClass.dataSource = null;
        },
        imageSizeMenu: true,
        subViews: ['home_NodeList', 'suggestedArtists', 'suggestedAlbums', 'pinnedList'],
    }),

    imageGrid: inheritHandler('ImageGrid', 'BaseList', {
        title: function () {
            return _('Grid');
        },
        icon: 'gridview',
        controlClass: 'ImageGrid',
        //notifyTotalCountChange: true, //LS: replaced by statusBar sub-view
        onShow: function (control, view) {
            let handler = getNodeHandler(view);
            if (!this.dataSourceType)
                alert('dataSourceType not defined in viewHandlers.' + this.constructor.name + ' (descendant of ImageGrid)');
            if (view.dataSourceCache[this.dataSourceType])
                control.controlClass.dataSource = view.dataSourceCache[this.dataSourceType];
            else
            if (handler.getViewDataSource) {
                let ds = handler.getViewDataSource(view, this.dataSourceType);
                view.dataSourceCache[this.dataSourceType] = ds;
                view.delayedAssign(ds, function () {
                    control.controlClass.dataSource = ds;
                });
            }
            view.loadProgress(this.dataSourceType);
            if (handler.icon)
                control.controlClass.noThumbIcon = handler.icon;
            this.registerActions(control, view);
        },
        onHide: function (control, view) {
            let ds = control.controlClass.dataSource;
            if (!ds.isLoaded || isPromiseCanceled(ds.whenLoaded()))
                view.dataSourceCache[this.dataSourceType] = null; // cache only the fully loaded source
            if (!view.reloading)
                control.controlClass.dataSource = null; // cancel/free/unregister the dataSource
        },

        _getInputAction: function (actionID, view, checkPopupSupport) {
            if (actionID == 'open') {
                let personID = resolveToValue(this._getPersonID, undefined); // issue #18275
                return function (e) {
                    let item = e.detail.item;
                    if (checkPopupSupport && templates.popupRenderers[item.objectType])
                        return;
                    if (!item.isOnline)
                        uitools.globalSettings.showingOnline = false; // opens My Library mode, if item is not for online content
                    let handlerID = item.objectType;
                    if (personID && nodeHandlers[personID])
                        handlerID = personID;
                    view.openSubNode({
                        dataSource: item,
                        handlerID: handlerID,
                        clickedArea: e.detail.div,
                        newTab: !!e.detail.newTab
                    });
                };
            }
        },

        imageSizeMenu: true
    }),

    personGrid: inheritHandler('PersonGrid', 'ImageGrid', {
        title: function () {
            return _('Grid');
        },
        controlClass: 'ArtistGrid',
        icon: 'gridview',
        //notifyTotalCountChange: true, //LS: replaced by statusBar sub-view
        onShow: function (control, view, mainViewControl, onlyDataInit) {
            let personID = resolveToValue(this._getPersonID, 'artist');

            view.dataSourceCache.lastView = view.dataSourceCache.currentView;
            view.dataSourceCache.currentView = 'personGrid';


            let state = nodeUtils.getViewHandlerState(view);
            let withColumnBrowser = !state.hiddenSubViews['columnBrowser'];

            let personList;
            if (view.dataSourceCache['tracklist'] || (view.dataSourceCache['personlist'] && !withColumnBrowser)) {
                if (view.dataSourceCache['tracklist']) {
                    personList = control.controlClass.prepareDataSource(view.dataSourceCache['tracklist'], personID, view.dataSourceCache['personlist']);
                } else {
                    personList = view.dataSourceCache['personlist'];
                    control.controlClass.personID = personID;
                }
                control.controlClass.dataSource = personList;
                this.copySelection(this.getLastDataSource(view, true), personList);
            } else {
                if (withColumnBrowser) {
                    // we need to get the person list from tracks when 'Column Browser' is enabled
                    let tracks = view.viewNode.dataSource.getTracklist();
                    view.promise(tracks.whenLoaded()); // to cancel when switching view
                    view.dataSourceCache['tracklist'] = tracks;
                    personList = control.controlClass.prepareDataSource(tracks, personID);
                } else {
                    control.controlClass.personID = personID;
                    personList = view.viewNode.dataSource.getPersonList(personID);
                }
                view.delayedAssign(personList, function () {
                    control.controlClass.dataSource = personList;
                });
            }
            if (!onlyDataInit)
                this.registerActions(control, view);
        },
        onHide: function (control, view) {
            view.dataSourceCache['personlistPopup'] = control.controlClass.popupDataSource();
            let personList = control.controlClass.dataSource;
            if (personList && personList.isLoaded && !isPromiseCanceled(personList.whenLoaded())) // cache only the fully loaded source
                view.dataSourceCache['personlist'] = personList;
            else
                view.dataSourceCache['tracklist'] = null;
            control.controlClass.prepareDataSource(); // release event handler
            if (!view.reloading)
                control.controlClass.dataSource = null; // cancel/free/unregister the dataSource        
            requirejs('helpers/searchTools');
            searchTools.clearArtistSearchQueue();
        },
        registerActions: function (control, view) {
            view.listen(control, 'itemdblclick', this._getInputAction('open', view));
            view.listen(control, 'itementer', this._getInputAction('open', view));
            view.listen(control, 'itemview', this._getInputAction('open', view));
        },
        subViews: ['columnBrowser', 'statusBar'],
        hiddenSubViews: ['columnBrowser'] // sub-views hidden by default
    }),

    artistGrid: inheritHandler('ArtistGrid', 'PersonGrid', {
        _getPersonID: 'artist'
    }),

    albumArtistGrid: inheritHandler('AlbumArtistGrid', 'PersonGrid', {
        _getPersonID: 'albumartist'
    }),

    artistOnlyGrid: inheritHandler('ArtistOnlyGrid', 'PersonGrid', {
        _getPersonID: 'artistonly'
    }),

    composerGrid: inheritHandler('ComposerGrid', 'PersonGrid', {
        _getPersonID: 'composer'
    }),

    producerGrid: inheritHandler('ProducerGrid', 'PersonGrid', {
        _getPersonID: 'producer'
    }),

    conductorGrid: inheritHandler('ConductorGrid', 'PersonGrid', {
        _getPersonID: 'conductor'
    }),

    actorGrid: inheritHandler('ActorGrid', 'PersonGrid', {
        _getPersonID: 'actor'
    }),

    publisherGrid: inheritHandler('PublisherGrid', 'PersonGrid', {
        _getPersonID: 'publisher'
    }),

    directorGrid: inheritHandler('DirectorGrid', 'PersonGrid', {
        _getPersonID: 'director'
    }),

    genreGrid: inheritHandler('GenreGrid', 'ImageGrid', {
        title: _('Grid') + ' (' + _('Genres') + ')',
        controlClass: 'GenreGrid',
        icon: 'gridview',
        //notifyTotalCountChange: true, //LS: replaced by statusBar sub-view
        dataSourceType: 'genrelist',
        registerActions: function (control, view) {
            view.listen(control, 'itemdblclick', this._getInputAction('open', view));
            view.listen(control, 'itementer', this._getInputAction('open', view));
            view.listen(control, 'itemview', this._getInputAction('open', view));
        },
        subViews: ['statusBar']
    }),

    yearview_base: inheritHandler('Yearview_base', 'Base', {
        onShow: function (control, view) {
            let cachedDS = view.dataSourceCache['yearView'];
            if (!cachedDS) {
                cachedDS = {
                    year: view.viewNode.dataSource,
                    dataObject: view.viewNode.dataSource,
                    cache: {}
                };
                view.dataSourceCache['yearView'] = cachedDS;
            }
            control.controlClass.dataSource = cachedDS;
        },
        onHide: function (control, view) {
            control.controlClass.dataSource = undefined;
        }
    }),

    yearview_header: inheritHandler('Yearview_header', 'Yearview_base', {
        controlClass: 'YearViewHeader',
        title: _('Info panel'),
        icon: 'browser',
        placement: {
            position: 'top',
            inScroller: true,
        },
        defaultFocusControl: function () {
            return undefined; // to search the default focus control within other subViews
        }
    }),

    yearview_albums: inheritHandler('Yearview_albums', 'Yearview_base', {
        controlClass: 'YearAlbums',
        title: function () {
            return _('Albums');
        },
        icon: 'album',
        placement: {
            position: 'bottom',
            inScroller: true,
        }
    }),

    yearview_tracks: inheritHandler('Yearview_tracks', 'Yearview_base', {
        controlClass: 'YearTracks',
        title: function () {
            return _('Tracks');
        },
        icon: 'song',
        placement: {
            position: 'bottom',
            inScroller: true,
        }
    }),

    yearview_artists: inheritHandler('Yearview_artists', 'Yearview_base', {
        controlClass: 'YearArtists',
        title: function () {
            return _('Artists');
        },
        icon: 'artist',
        placement: {
            position: 'bottom',
            inScroller: true,
        }
    }),

    yearView: inheritHandler('YearView', 'Yearview_base', {
        controlClass: 'Control',
        title: function () {
            return _('Browser');
        },
        icon: 'browser',
        baseViewType: 'browser',
        defaultFocusControl: function () {
            return undefined; // to search the default focus control within other subViews
        },
        subViews: ['yearview_header', 'yearview_albums', 'yearview_tracks', 'yearview_artists', 'statusBar'],
        hiddenSubViews: ['folder_NodeList', 'statusBar'],
        imageSizeMenu: true,
        disableLastControlEnlarge: true,
        enableStickySubviews: true // horizontal scroll only for tracklist
    }),

    decadeView: inheritHandler('DecadeView', 'YearView', {
        subViews: ['folder_NodeList', 'yearview_header', 'yearview_albums', 'yearview_tracks', 'yearview_artists', 'statusBar']
    }),

    artistview_header: inheritHandler('Artistview_header', 'Base', {
        controlClass: 'ArtistViewHeader',
        title: _('Info panel'),
        icon: 'browser',
        placement: {
            position: 'top',
            inScroller: true,
        },
        defaultFocusControl: function () {
            return undefined; // to search the default focus control within other subViews
        },
        onShow: function (control, view) {
            let cachedDS = view.dataSourceCache['artistView'];
            if (!cachedDS) {
                cachedDS = new ArtistDataSource(view.viewNode.dataSource);
                view.dataSourceCache['artistView'] = cachedDS;
            }
            cachedDS.addRef();
            control.controlClass.dataSource = view.dataSourceCache['artistView'];
            control.controlClass.registerEventHandler('layoutchange');
            if (app.getValue('InfoPanelAutoLookup', true))
                cachedDS.fetchMBData();
        },
        onHide: function (control, view) {
            control.controlClass.unregisterEventHandler('layoutchange');
            if (control.controlClass.dataSource) {
                control.controlClass.dataSource.release();
                control.controlClass.dataSource = undefined;
            }
        }
    }),

    artistview_albums: inheritHandler('Artistview_albums', 'Base', {
        controlClass: 'ArtistAlbums',
        title: _('Albums'),
        icon: 'album',
        placement: {
            position: 'top',
            inScroller: true,
        },
        onShow: function (control, view) {
            let cachedDS = view.dataSourceCache['artistView'];
            if (!cachedDS) {
                cachedDS = new ArtistDataSource(view.viewNode.dataSource);
                view.dataSourceCache['artistView'] = cachedDS;
            }
            cachedDS.addRef();
            control.controlClass.dataSource = view.dataSourceCache['artistView'];
        },
        onHide: function (control, view) {
            if (control.controlClass.dataSource) {
                control.controlClass.dataSource.release();
                control.controlClass.dataSource = undefined;
            }
        }
    }),

    artistview_relatedArtists: inheritHandler('Artistview_relatedArtists', 'Base', {
        controlClass: 'RelatedArtists',
        title: _('Related Artists'),
        icon: 'person',
        placement: {
            position: 'bottom',
            inScroller: true,
        },
        onShow: function (control, view) {
            let cachedDS = view.dataSourceCache['artistView'];
            if (!cachedDS) {
                cachedDS = new ArtistDataSource(view.viewNode.dataSource);
                view.dataSourceCache['artistView'] = cachedDS;
            }
            cachedDS.addRef();
            control.controlClass.dataSource = view.dataSourceCache['artistView'];
            if (app.getValue('InfoPanelAutoLookup', true))
                cachedDS.fetchMBData(); // relations are always taken from online data
        },
        onHide: function (control, view) {
            if (control.controlClass.dataSource) {
                control.controlClass.dataSource.release();
                control.controlClass.dataSource = undefined;
            }
        }
    }),

    artistview_tracks: inheritHandler('Artistview_tracks', 'Base', {
        controlClass: 'ArtistTracks',
        title: function () {
            return _('Tracks');
        },
        icon: 'song',
        placement: {
            position: 'bottom',
            inScroller: true,
        },
        onShow: function (control, view) {
            let cachedDS = view.dataSourceCache['artistView'];
            if (!cachedDS) {
                cachedDS = new ArtistDataSource(view.viewNode.dataSource);
                view.dataSourceCache['artistView'] = cachedDS;
            }
            cachedDS.addRef();
            control.controlClass.dataSource = view.dataSourceCache['artistView'];
        },
        onHide: function (control, view) {
            if (control.controlClass.dataSource) {
                control.controlClass.dataSource.release();
                control.controlClass.dataSource = undefined;
            }
        }
    }),

    artistview_groupedtracklist: inheritHandler('Artistview_groupedtracklist', 'GroupedTracklist', {
        onShow: function (control, view) {
            let cachedDS = view.dataSourceCache['artistView'];
            if (!cachedDS) {
                cachedDS = new ArtistDataSource(view.viewNode.dataSource);
                view.dataSourceCache['artistView'] = cachedDS;
            }
            cachedDS.addRef();
            let lastShowingOnline = uitools.globalSettings.showingOnline;
            let handler = getNodeHandler(view);
            view.listen(cachedDS, 'change', function (params) {
                if (params) {
                    let pr_id = 'artist_groupedtracklist';
                    if (((params.eventType === 'settings') && (uitools.globalSettings.showingOnline !== lastShowingOnline)) ||
                        (!params.eventType && lastShowingOnline)) {
                        lastShowingOnline = uitools.globalSettings.showingOnline;
                        view.dataSourceCache['tracklist'].clear();
                        let list = handler.getViewDataSource(view, 'tracklist');
                        let so = lastShowingOnline;
                        view.cancelPromise(pr_id);
                        view.promise(list.whenLoaded(), pr_id).then(function () {
                            if (so === lastShowingOnline) {
                                view.dataSourceCache['tracklist'].clear();
                                view.dataSourceCache['tracklist'].addList(list);
                                view.dataSourceCacheObserver.notifyChange('tracklist'); // is listened e.g. by columnBrowser
                                cachedDS.currentTracklist = view.dataSourceCache['tracklist'];
                            }
                            list.globalModifyWatch = false; // not used list, no events needed already
                            list = undefined;
                        });
                    } else if (params.eventType === 'clear') {
                        view.cancelPromise(pr_id);
                        view.dataSourceCache['onlineTracklist'] = undefined;

                        if ((params.onlyOnline && lastShowingOnline) || !params.onlyOnline) {
                            view.dataSourceCache['tracklist'].clear();
                            view.dataSourceCacheObserver.notifyChange('tracklist'); // is listened e.g. by columnBrowser
                        }
                    }
                }
            }.bind(this));
            viewHandlersClasses['Artistview_groupedtracklist'].$super.onShow.apply(this, arguments);
            cachedDS.currentTracklist = view.dataSourceCache['tracklist'];
        },

        onHide: function (control, view) {
            if (view.dataSourceCache['artistView']) {
                view.dataSourceCache['artistView'].release();
            }
            viewHandlersClasses['Artistview_tracklist'].$super.onHide.apply(this, arguments);
        },
        subViews: ['columnBrowser', 'artistview_header', 'statusBar']
    }),

    artistview_tracklist: inheritHandler('Artistview_tracklist', 'Tracklist', {
        title: function () {
            return _('List');
        },
        onShow: function (control, view) {
            let cachedDS = view.dataSourceCache['artistView'];
            if (!cachedDS) {
                cachedDS = new ArtistDataSource(view.viewNode.dataSource);
                view.dataSourceCache['artistView'] = cachedDS;
            }
            cachedDS.addRef();
            let lastShowingOnline = uitools.globalSettings.showingOnline;
            let handler = getNodeHandler(view);
            view.listen(cachedDS, 'change', function (params) {
                if (params) {
                    let pr_id = 'artist_tracklist';
                    if (((params.eventType === 'settings') && (uitools.globalSettings.showingOnline !== lastShowingOnline)) ||
                        (!params.eventType && lastShowingOnline)) {
                        lastShowingOnline = uitools.globalSettings.showingOnline;
                        view.dataSourceCache['tracklist'].clear();
                        let list = handler.getViewDataSource(view, 'tracklist');
                        let so = lastShowingOnline;
                        view.cancelPromise(pr_id);
                        view.promise(list.whenLoaded(), pr_id).then(function () {
                            if (so === lastShowingOnline) {
                                view.dataSourceCache['tracklist'].clear();
                                view.dataSourceCache['tracklist'].addList(list);
                                view.dataSourceCacheObserver.notifyChange('tracklist'); // is listened e.g. by columnBrowser
                                cachedDS.currentTracklist = view.dataSourceCache['tracklist'];
                            }
                            list.globalModifyWatch = false; // not used list, no events needed already
                            list = undefined;
                        });
                    } else if (params.eventType === 'clear') {
                        view.cancelPromise(pr_id);
                        view.dataSourceCache['onlineTracklist'] = undefined;

                        if ((params.onlyOnline && lastShowingOnline) || !params.onlyOnline) {
                            view.dataSourceCache['tracklist'].clear();
                            view.dataSourceCacheObserver.notifyChange('tracklist'); // is listened e.g. by columnBrowser
                        }
                    }
                }
            }.bind(this));
            viewHandlersClasses['Artistview_tracklist'].$super.onShow.apply(this, arguments);
            cachedDS.currentTracklist = view.dataSourceCache['tracklist'];
        },

        onHide: function (control, view) {
            if (view.dataSourceCache['artistView']) {
                view.dataSourceCache['artistView'].release();
            }
            viewHandlersClasses['Artistview_tracklist'].$super.onHide.apply(this, arguments);
        },
        subViews: ['columnBrowser', 'artistview_header', 'statusBar']
    }),

    artistView: inheritHandler('ArtistView', 'Base', {
        title: function () {
            return _('Browser');
        },
        defaultFocusControl: function () {
            return undefined; // so that the default focus control is searched within subViews below
        },
        icon: 'browser',
        controlClass: 'Control',
        baseViewType: 'browser',
        subViews: ['artistview_header', 'artistview_albums', 'artistview_tracks', 'artistview_relatedArtists', 'statusBar'],
        hiddenSubViews: ['statusBar'], // sub-views hidden by default
        imageSizeMenu: true,
        disableLastControlEnlarge: true,
        enableStickySubviews: true // horizontal scroll only for tracklist
    }),

    albumlist: inheritHandler('AlbumList', 'ImageGrid', {
        title: function () {
            return _('Grid (by Album)');
        },
        icon: 'gridview',
        //notifyTotalCountChange: true, //LS: replaced by statusBar sub-view
        controlClass: 'AlbumListView',
        controlClass_initParams: {
            autoSortString: 'title;artist', // default sort string, #16467
            showHeader: true
        },

        onShow: function (control, view, mainViewControl, onlyDataInit) {
            view.dataSourceCache.lastView = view.dataSourceCache.currentView;
            view.dataSourceCache.currentView = 'albumlist';

            let nHandler = getNodeHandler(view);
            let state = nodeUtils.getViewHandlerState(view);
            let withColumnBrowser = !state.hiddenSubViews['columnBrowser'];

            let _refreshSource = () => {
                let albumList;
                let tracks = undefined;
                if (!withColumnBrowser && (nHandler.getViewDataSource || (view.viewNode.dataSource && view.viewNode.dataSource.getAlbumList))) {
                    // "Column Filter" is disabled, let's try to get album list directly (for better performance)
                    if (nHandler.getViewDataSource) {
                        albumList = nHandler.getViewDataSource(view, 'albumlist');
                        if (albumList && albumList.objectType != 'albumlist') {
                            if (albumList.objectType === 'tracklist')
                                tracks = albumList;
                            albumList = undefined;
                        }
                    } else {
                        albumList = view.viewNode.dataSource.getAlbumList();
                    }
                }

                if (!albumList) {
                    // we need to create album list from trackslist (e.g. when "Column Browser" is enabled)                
                    if (!tracks) {
                        if (nHandler.getViewDataSource)
                            tracks = nHandler.getViewDataSource(view, 'tracklist');
                        else
                        if (view.viewNode.dataSource && view.viewNode.dataSource.getTracklist)
                            tracks = view.viewNode.dataSource.getTracklist();
                    }
                    if (tracks) {
                        if (tracks.objectType != 'tracklist')
                            alert('Unexpected object type: expected was tracklist but got ' + tracks.objectType + ', node handler: ' + view.viewNode.handlerID);
                        albumList = control.controlClass.prepareDatasource(tracks);
                    }
                }
                if (!albumList)
                    alert('Failed to get albumlist dataSource in viewHandlers.' + this.constructor.name + '.onShow, nodeHandler: ' + nHandler.constructor.name);

                view.delayedAssign(albumList, function () {
                    control.controlClass.dataSource = albumList;
                });
                view.dataSourceCache['tracklist'] = tracks;
            };

            if (view.dataSourceCache['tracklist'] || (view.dataSourceCache['albumlist'] && !withColumnBrowser)) {
                let albumList = control.controlClass.prepareDatasource(view.dataSourceCache['tracklist'], view.dataSourceCache['albumlist']);
                control.controlClass.dataSource = albumList;
                this.copySelection(this.getLastDataSource(view, true), albumList);
            } else {
                _refreshSource();
            }

            if (!onlyDataInit) {
                if (view.viewNode.dataSource && view.viewNode.dataSource.isObservable) {
                    view.listen(view.viewNode.dataSource, 'change', (eventType) => {
                        if (eventType == 'tracklist' || eventType == 'albumlist')
                            _refreshSource();
                    });
                }
                this.registerActions(control, view);
            }
        },
        registerActions: function (control, view) {
            view.listen(control, 'itemdblclick', this._getInputAction('open', view));
            view.listen(control, 'itementer', this._getInputAction('open', view));
            view.listen(control, 'itemview', this._getInputAction('open', view));
        },
        onHide: function (control, view) {
            view.dataSourceCache['albumlistPopup'] = control.controlClass.popupDataSource();
            let albumList = control.controlClass.dataSource;
            if (albumList && albumList.isLoaded && !isPromiseCanceled(albumList.whenLoaded())) // cache only the fully loaded source for later usage (e.g. when returning back to this view in a second)
                view.dataSourceCache['albumlist'] = albumList;
            else
                view.dataSourceCache['tracklist'] = null;
            control.controlClass.prepareDatasource(); // release event handler
            if (!view.reloading)
                control.controlClass.dataSource = null; // cancel/free/unregister the dataSource
        },
        subViews: ['columnBrowser', 'statusBar'],
        hiddenSubViews: ['columnBrowser'], // sub-views hidden by default,
        baseViewType: 'grid'
    }),

    serieslist: inheritHandler('SeriesList', 'AlbumList', {
        title: function () {
            return _('Grid (by Series)');
        },
        controlClass_initParams: {
            hasVideoContent: true,
            autoSortString: 'title',
            showHeader: true
        },
        _getInputAction: function (actionID, view, checkPopupSupport) {
            if (actionID == 'open') {
                return function (e) {
                    let item = e.detail.item;
                    if (checkPopupSupport && templates.popupRenderers[item.objectType])
                        return;
                    if (!item.isOnline)
                        uitools.globalSettings.showingOnline = false; // opens My Library mode, if item is not for online content
                    view.openSubNode({
                        dataSource: item,
                        handlerID: 'series',
                        clickedArea: e.detail.div,
                        newTab: !!e.detail.newTab
                    });
                };
            }
        }
    }),

    playlist_albumlist: inheritHandler('Playlist_AlbumList', 'AlbumList', {
        onHide: function (control, view) {
            viewHandlersClasses['Playlist_AlbumList'].$super.onHide.apply(this, arguments);
            if (view.__deactivateHeaderOnHide) {
                let state = nodeUtils.getViewHandlerState(view);
                state.hiddenSubViews['playlist_header'] = true;
                nodeUtils.setViewHandlerState(view, state);
                view.__deactivateHeaderOnHide = null;
            }
        },
        storeStateKey: 'playlistsAlbumList', // to _not_ share sub-view visibility with List (#15926)    
        hiddenSubViews: ['columnBrowser', 'playlist_RowNodeList'],
        subViews: ['columnBrowser', 'playlist_header', 'playlist_Tree', 'playlist_RowNodeList', 'playlist_NodeList', 'statusBar']
    }),

    folder_listView: inheritHandler('Folder_listView', 'Tracklist', {
        title: () => {
            return _('List');
        },
        subViews: ['columnBrowser', 'folder_Tree', 'folder_RowNodeList', 'folder_NodeList', 'statusBar'],
        hiddenSubViews: ['columnBrowser', 'folder_Tree', 'folder_NodeList'],
        onShow: function (control, view) {
            viewHandlersClasses['Folder_listView'].$super.onShow.apply(this, arguments);
            view.viewNode.dataSource.monitorChanges = true;
        },
        onHide: function (control, view) {
            view.viewNode.dataSource.monitorChanges = false;
            viewHandlersClasses['Folder_listView'].$super.onHide.apply(this, arguments);
        },
        storeStateKey: 'foldersList', // to share sub-view visibility with List (by Album) (#15926)
        baseViewType: 'list'
    }),

    folder_browser: inheritHandler('Folder_browser', 'Folder_listView', {
        columnsSupport: false,
        title: () => {
            return _('Browser');
        },
        icon: 'browser',
        storeStateKey: 'folderBrowser',
        hiddenSubViews: ['columnBrowser', 'folder_Tree', 'folder_RowNodeList']
    }),

    folder_groupedListView: inheritHandler('Folder_groupedListView', 'GroupedTracklist', {
        subViews: ['columnBrowser', 'folder_Tree', 'folder_RowNodeList', 'folder_NodeList', 'statusBar'],
        hiddenSubViews: ['columnBrowser', 'folder_Tree', 'folder_NodeList'],
        onShow: function (control, view) {
            viewHandlersClasses['Folder_groupedListView'].$super.onShow.apply(this, arguments);
            view.viewNode.dataSource.monitorChanges = true;
        },
        onHide: function (control, view) {
            view.viewNode.dataSource.monitorChanges = false;
            viewHandlersClasses['Folder_groupedListView'].$super.onHide.apply(this, arguments);
        },
        storeStateKey: 'foldersList', // to share sub-view visibility with List (#15926)
        baseViewType: 'listByAlbum'
    }),

    folder_GridView: inheritHandler('Folder_GridView', 'AlbumList', {
        subViews: ['columnBrowser', 'folder_Tree', 'folder_RowNodeList', 'folder_NodeList', 'statusBar'],
        hiddenSubViews: ['columnBrowser', 'folder_Tree', 'folder_RowNodeList'],
        toolbarActions: function (view) {
            let res = [];
            let handler = getNodeHandler(view);
            if (handler.includeSubfoldersSupport)
                res.push(actions.includeSubfolders);
            return res;
        },
        onShow: function (control, view) {
            viewHandlersClasses['Folder_GridView'].$super.onShow.apply(this, arguments);
            view.viewNode.dataSource.monitorChanges = true;
        },
        onHide: function (control, view) {
            view.viewNode.dataSource.monitorChanges = false;
            viewHandlersClasses['Folder_GridView'].$super.onHide.apply(this, arguments);
        },
        storeStateKey: 'folderGrid'
    }),

    folder_FilesGridView: inheritHandler('Folder_FilesGridView', 'TrackGrid', {
        /*title: function () {
            return _('Grid') + ' (' + _('files') + ')';
        },*/
        subViews: ['columnBrowser', 'folder_Tree', 'folder_RowNodeList', 'folder_NodeList', 'statusBar'],
        hiddenSubViews: ['columnBrowser', 'folder_Tree', 'folder_RowNodeList'],
        toolbarActions: function (view) {
            let res = [];
            let handler = getNodeHandler(view);
            if (handler.includeSubfoldersSupport)
                res.push(actions.includeSubfolders);
            return res;
        },
        onShow: function (control, view) {
            viewHandlersClasses['Folder_FilesGridView'].$super.onShow.apply(this, arguments);
            view.viewNode.dataSource.monitorChanges = true;
        },
        onHide: function (control, view) {
            view.viewNode.dataSource.monitorChanges = false;
            viewHandlersClasses['Folder_FilesGridView'].$super.onHide.apply(this, arguments);
        },
        storeStateKey: 'folderFilesGrid'
    }),

    subscriptionList: inheritHandler('SubscriptionList', 'NodeList', {
        controlClass: 'NodeListView',
        controlClass_initParams: {
            imageTemplate: 'podcastNode'
        },
    }),

    feedlist: inheritHandler('FeedList', 'Base', {
        title: () => {
            return _('Feeds');
        },
        icon: 'rss',
        controlClass: 'FeedListView',
        subViews: ['folder_NodeList', 'statusBar'],
        onShow: function (control, view) {
            let cc = control.controlClass;
            if (view.dataSourceCache['feedList'])
                cc.dataSource = view.dataSourceCache['feedList'];
            else
                cc.dataSource = view.viewNode.dataSource.getFeedList();
        },
        onHide: function (control, view) {
            let cc = control.controlClass;
            if (cc.dataSource.isLoaded)
                view.dataSourceCache['feedList'] = cc.dataSource;
        },
    }),

    podcastSubscribeTutorial: inheritHandler('PodcastSubscribeTutorial', 'Base', {
        controlClass: 'PodcastSubscribeTutorial'
    }),

    serverList: inheritHandler('ServerList', 'ImageGrid', {
        title: function () {
            return _('Grid');
        },
        icon: 'server',
        controlClass: 'ServerListView',
        dataSourceType: 'serverlist',
        onShow: function (control, view) {
            if (view.dataSourceCache[this.dataSourceType])
                control.controlClass.dataSource = view.dataSourceCache[this.dataSourceType];
            else {
                control.controlClass.dataSource = app.sharing.getRemoteServers();
                view.dataSourceCache[this.dataSourceType] = control.controlClass.dataSource;
            }
            view.loadProgress(this.dataSourceType);
            this.registerActions(control, view);
        },
        // onHide: inherited from ImageGrid
        _getInputAction: function (actionID, view) {
            if (actionID == 'open') {
                return function (e) {
                    view.openSubNode({
                        dataSource: e.detail.item,
                        handlerID: 'mediaServer',
                        clickedArea: e.detail.div,
                        newTab: !!e.detail.newTab
                    });
                };
            }
        },
        registerActions: function (control, view) {
            view.listen(control, 'itemdblclick', this._getInputAction('open', view));
            view.listen(control, 'itementer', this._getInputAction('open', view));
            view.listen(control, 'itemclick', this._getInputAction('open', view));
        },
        toolbarActions: function (view) {
            return [actions.addMediaServer];
        }
    }),

    deviceList: inheritHandler('DeviceList', 'Base', {
        title: function () {
            return _('List');
        },
        icon: 'listview',
        controlClass: 'DevicesView',
        disableLastControlEnlarge: true
    }),

    episodes: inheritHandler('Episodes', 'TracklistBase', {
        columnsSupport: false,
        sortingSupport: false,
        title: function () {
            return _('Browser');
        },
        icon: 'browser',
        controlClass: 'EpisodeListView',
        subViews: ['podcastHeader', 'statusBar']
    }),

    podcast_tracklist: inheritHandler('Podcast_tracklist', 'Tracklist', {
        subViews: ['columnBrowser', 'podcastHeader', 'statusBar']
    }),

    newEpisodes: inheritHandler('NewEpisodes', 'ImageGrid', {
        controlClass: 'NewEpisodesView',
        registerActions: function (control, view) {
            view.listen(control, 'itemview', this._getInputAction('open', view));
        },
        onShow: function (control, view) {
            control.controlClass.dataSource = app.podcasts.getPodcastListBySQL(
                'SELECT Podcasts.* FROM Podcasts WHERE ID IN (SELECT IDPodcast FROM PodcastEpisodes WHERE Downloaded = 1) ' +
                'ORDER BY (SELECT PubDate FROM PodcastEpisodes WHERE IDPodcast = Podcasts.ID) DESC');
            this.registerActions(control, view);
        },
        onHide: function (control, view) {
            control.controlClass.dataSource = null; // cancel/free/unregister the dataSource
        }
    }),

    podcastHeader: inheritHandler('PodcastHeader', 'Base', {
        title: function () {
            return _('Info panel');
        },
        placement: {
            position: 'top',
            inScroller: true
        },
        icon: 'browser',
        controlClass: 'PodcastHeader',
        onShow: function (control, view) {
            control.controlClass.registerEventHandler('layoutchange');
            control.controlClass.dataSource = view.viewNode.dataSource;
        },
        onHide: function (control, view) {
            control.controlClass.dataSource = undefined;
            control.controlClass.unregisterEventHandler('layoutchange');
        }
    }),

    searchView_Header: inheritHandler('SearchView_Header', 'Base', {
        title: function () {
            return _('Info panel');
        },
        placement: {
            position: 'top',
            inScroller: true
        },
        permanent: true, // permanent (always enabled) sub-view
        icon: 'browser',
        controlClass: 'SearchView',
        onShow: function (control, view) {
            control.controlClass.showAsHeader = true;
            control.controlClass._resetResultsShowing();

            let useResults = (results) => {
                view.dataSourceCache['search_results'] = results;
                let prid = 'searchChangeHandler';
                view.cancelPromise(prid);
                if (results && results.tracks) {
                    view.promise(results.tracks.whenLoaded(), prid).then(() => {
                        view.viewNode.dataSource.notifyChanged('tracklist'); // is listened e.g. by tracklistBase, columnBrowser
                    });
                } else
                    view.viewNode.dataSource.notifyChanged('tracklist');
            };

            view.listen(control, 'search_results', function (e) {
                control.scrollIntoView(); // #21828
                useResults(e.detail.results);
            });

            if (control.controlClass.lastResults && !view.reloading) // to fix #15548 - item 2, i.e. when results are prepared earlier than this view is actually shown
                useResults(control.controlClass.lastResults);

            view.listen(control, 'search_mode_change', function (e) {
                if (!e.detail.isOnline && view.dataSourceCache['search_results']) {
                    useResults(null);
                }
            });
        },
        onHide: (control, view) => {
            let QDS = navUtils.getActiveTabQueryData();
            if (QDS.advancedSearch && !view.reloading)
                QDS.searchPhrase = ''; // #21215
        },
    }),

    searchView_Browser: inheritHandler('SearchView_Browser', 'SearchView_Header', {
        onShow: function (control, view) {
            viewHandlersClasses['SearchView_Browser'].$super.onShow.apply(this, arguments);
            control.controlClass.showAsHeader = false;
        },
    }),

    searchView_Tracklist: inheritHandler('SearchView_Tracklist', 'Tracklist', {
        title: function () {
            return _('List');
        },
        controlClass_initParams: {
            forceRestoreFocus: false // #15911
        },
        subViews: ['searchView_Header', 'columnBrowser', 'statusBar'],
    }),

    searchView: inheritHandler('SearchView', 'SearchView_Tracklist', {
        columnsSupport: false,
        title: function () {
            return _('Browser');
        },
        icon: 'browser',
        subViews: ['searchView_Browser', 'statusBar'],
    }),

    searchView_GroupedTracklist: inheritHandler('SearchView_GroupedTracklist', 'GroupedTracklist', {
        subViews: ['searchView_Header', 'columnBrowser', 'statusBar'],
    }),

    searchView_AlbumList: inheritHandler('SearchView_AlbumList', 'AlbumList', {
        subViews: ['searchView_Header', 'columnBrowser', 'statusBar'],
    }),

    webBrowser: inheritHandler('WebBrowser', 'Base', {
        controlClass: 'EmbeddedWindow',
        searchNotSupported: true, // contextual search isn't supported in embedded windows
        onShow: function (control, view) {
            let url = 'mediamonkey.com';
            if (view.viewNode.dataSource) {
                if (view.viewNode.dataSource.detail && (view.viewNode.dataSource.detail !== '')) {
                    url = view.viewNode.dataSource.detail;
                } else
                if (view.viewNode.dataSource.title) {
                    url = view.viewNode.dataSource.title;
                }
            }
            control.controlClass.url = url;
        },
        onHide: function (control, view) {
            control.controlClass.hideWindow();
        }
    }),

    device: inheritHandler('DeviceConfig', 'Base', {
        title: _('Configure'),
        icon: 'browser',
        controlClass: 'DeviceConfig',
        onShow: function (control, view) {
            control.controlClass.viewData = view; // for the content browser on the 'Summary' page
            control.controlClass.dataSource = view.viewNode.dataSource;
        },
        onHide: function (control, view) {
            let cls = control.controlClass;
            if (cls.dataSource && cls.unsavedChanges) {
                cls.keepInCache = true; // so that the control is not used for another dataSource meanwhile (or destroyed)           
                cls.showChangesConfirm(() => {
                    cls.keepInCache = false;
                });
            } else
                control.controlClass.dataSource = undefined;
        }
    }),

    genreview_base: inheritHandler('Genreview_base', 'Base', {
        onShow: function (control, view) {
            let cachedDS = view.dataSourceCache['genreView'];
            if (!cachedDS) { // @ts-ignore
                cachedDS = new GenreDataSource(view.viewNode.dataSource);
                view.dataSourceCache['genreView'] = cachedDS;
            }
            cachedDS.addRef();
            control.controlClass.dataSource = view.dataSourceCache['genreView'];
        },
        onHide: function (control, view) {
            if (control.controlClass.dataSource) {
                control.controlClass.dataSource.release();
                control.controlClass.dataSource = undefined;
            }
        }
    }),

    genreview_header: inheritHandler('Genreview_header', 'Genreview_base', {
        controlClass: 'GenreViewHeader',
        defaultFocusControl: function () {
            return undefined; // to search the default focus control within other subViews (otherwise just genre name text would be selected upon Ctrl+A press -- instead of LV)
        },
        title: _('Info panel'),
        icon: 'browser',
        placement: {
            position: 'top',
            inScroller: true,
        },
        onShow: function (control, view) {
            viewHandlersClasses['Genreview_header'].$super.onShow.apply(this, arguments);
            control.controlClass.registerEventHandler('layoutchange');
        },
        onHide: function (control, view) {
            control.controlClass.unregisterEventHandler('layoutchange');
            viewHandlersClasses['Genreview_header'].$super.onHide.apply(this, arguments);
        }
    }),

    genreview_relatedGenres: inheritHandler('Genreview_relatedGenres', 'Genreview_base', {
        controlClass: 'RelatedGenres',
        title: _('Related Genres'),
        icon: 'genre',
        placement: {
            position: 'bottom',
            inScroller: true,
        }
    }),

    genreview_tracks: inheritHandler('Genreview_tracks', 'Genreview_base', {
        controlClass: 'GenreTracks',
        title: function () {
            return _('Tracks');
        },
        icon: 'song',
        placement: {
            position: 'bottom',
            inScroller: true,
        }
    }),

    genreview_artists: inheritHandler('Genreview_artists', 'Genreview_base', {
        controlClass: 'GenreArtists',
        title: function () {
            return _('Artists');
        },
        icon: 'artist',
        placement: {
            position: 'bottom',
            inScroller: true,
        }
    }),

    genreview_albums: inheritHandler('Genreview_albums', 'Genreview_base', {
        controlClass: 'GenreAlbums',
        title: function () {
            return _('Albums');
        },
        icon: 'album',
        placement: {
            position: 'bottom',
            inScroller: true,
        }
    }),

    genreView: inheritHandler('GenreView', 'Base', {
        title: function () {
            return _('Browser');
        },
        defaultFocusControl: function () {
            return undefined; // so that the default focus control is searched within subViews below
        },
        icon: 'browser',
        controlClass: 'Control',
        baseViewType: 'browser',
        subViews: ['genreview_header', 'genreview_artists', 'genreview_albums', 'genreview_tracks', 'genreview_relatedGenres', 'statusBar'],
        hiddenSubViews: ['statusBar'], // sub-views hidden by default
        imageSizeMenu: true,
        disableLastControlEnlarge: true,
        enableStickySubviews: true // horizontal scroll only for tracklist
    }),

    albumview_header: inheritHandler('Albumview_header', 'Base', {
        controlClass: 'AlbumViewHeader',
        title: _('Info panel'),
        icon: 'browser',
        placement: {
            position: 'top',
            inScroller: true,
        },
        defaultFocusControl: function () {
            return undefined; // to search the default focus control within other subViews
        },
        onShow: function (control, view, mainViewControl) {
            let cachedDS = view.dataSourceCache['albumView'];
            if (!cachedDS) {
                cachedDS = new AlbumDataSource(view.viewNode.dataSource);
                view.dataSourceCache['albumView'] = cachedDS;
            }
            cachedDS.addRef();
            cachedDS.registerChangeHandler();
            control.controlClass.dataSource = cachedDS;
            control.controlClass.registerEventHandler('layoutchange');
            let tl = view.dataSourceCache['tracklist'];
            control.controlClass.requestFrame(function () { // moved to RAF as this can take more than 16 ms 
                let si = tl.statusInfo;
                if (si) {
                    si.then(function (data) {
                        if (data && control.controlClass)
                            control.controlClass.setStatus(data);
                    });
                }
            }, 'statusInfo');
            view.listen(mainViewControl, 'statusinfochange', function (e) {
                if (control.controlClass)
                    control.controlClass.setStatus(e.detail.data);
            });
            let lastShowingOnline = uitools.globalSettings.showingOnline;
            view.listen(cachedDS, 'change', function (params) {
                if (params) {
                    if (((params.eventType === 'settings') && (uitools.globalSettings.showingOnline !== lastShowingOnline))) {
                        lastShowingOnline = uitools.globalSettings.showingOnline;
                        if (control.controlClass)
                            control.controlClass.updateValues();
                    }
                }
            }.bind(this));

            if (app.getValue('InfoPanelAutoLookup', true))
                cachedDS.fetchMBData();
        },
        onHide: function (control, view) {
            control.controlClass.unregisterEventHandler('layoutchange');
            if (control.controlClass.dataSource) {
                control.controlClass.dataSource.unregisterChangeHandler();
                control.controlClass.dataSource.release();
                control.controlClass.dataSource = undefined;
            }
        }
    }),

    albumview_tracklist: inheritHandler('Albumview_tracklist', 'Tracklist', {
        controlClass_initParams: {
            showHeader: true
        },
        title: function () {
            return _('List');
        },
        onShow: function (control, view) {
            let cachedDS = view.dataSourceCache['albumView'];
            if (!cachedDS) {
                cachedDS = new AlbumDataSource(view.viewNode.dataSource);
                view.dataSourceCache['albumView'] = cachedDS;
            }
            cachedDS.addRef();
            let lastShowingOnline = uitools.globalSettings.showingOnline;
            let handler = getNodeHandler(view);
            let lastCount;
            let setTracklistChangehandler = function () {
                if (lastShowingOnline || !cachedDS.currentTracklist)
                    return;
                let prid = 'tracklistChangeHandler';
                view.cancelPromise(prid);
                view.promise(cachedDS.currentTracklist.whenLoaded(), prid).then(function () {
                    if (!lastShowingOnline && !view.tracklistChangeHandler && (cachedDS.currentTracklist.count > 0)) {
                        cachedDS.currentTracklist.locked(function () {
                            view.firstTrack = cachedDS.currentTracklist.getValue(0);
                            view.lastAlbumTitle = view.firstTrack.album;
                            view.lastAlbumArtist = view.firstTrack.albumArtist;
                            lastCount = cachedDS.currentTracklist.count;
                        });
                        view.tracklistChangeHandler = view.listen(cachedDS.currentTracklist, 'change', function (eventType) {
                            if (!lastShowingOnline) {
                                if (cachedDS.currentTracklist.count > 0) {
                                    if (!view.firstTrack || (cachedDS.currentTracklist.count !== lastCount)) {
                                        lastCount = cachedDS.currentTracklist.count;
                                        cachedDS.currentTracklist.locked(function () {
                                            view.firstTrack = cachedDS.currentTracklist.getValue(0);
                                            view.lastAlbumTitle = view.firstTrack.album;
                                            view.lastAlbumArtist = view.firstTrack.albumArtist;
                                        });
                                    }
                                }
                                else {
                                    lastCount = 0;
                                    if (view.firstTrack && (view.firstTrack.idalbum > 0) && ((view.lastAlbumTitle !== view.firstTrack.album) || (view.lastAlbumArtist !== view.firstTrack.albumArtist))) { // #15447
                                        navigationHandlers.album.navigate(view.firstTrack);
                                        view.firstTrack = undefined;
                                    }
                                }
                            }
                        }, 'tracklistChangeHandler');
                    }
                });
            };
            view.listen(cachedDS, 'change', function (params) {
                if (params) {
                    let pr_id = 'album_tracklist';
                    if (((params.eventType === 'settings') && (uitools.globalSettings.showingOnline !== lastShowingOnline)) || (uitools.globalSettings.showingOnline && !view.dataSourceCache['onlineTracklist'])) {
                        lastShowingOnline = uitools.globalSettings.showingOnline;
                        if (lastShowingOnline) {
                            view.unlisten('tracklistChangeHandler');
                            view.tracklistChangeHandler = undefined;
                        }
                        view.dataSourceCache['tracklist'].clear();
                        let list = handler.getViewDataSource(view, 'tracklist');
                        let so = lastShowingOnline;
                        view.cancelPromise(pr_id);
                        view.promise(list.whenLoaded(), pr_id).then(function () {
                            if (so === lastShowingOnline) {
                                view.dataSourceCache['tracklist'].clear();
                                view.dataSourceCache['tracklist'].addList(list);
                                view.viewNode.dataSource.notifyChanged('tracklist'); // is listened e.g. by tracklistBase, columnBrowser
                                cachedDS.currentTracklist = view.dataSourceCache['tracklist'];
                                setTracklistChangehandler();
                            }
                            list.globalModifyWatch = false; // not used list, no events needed already
                            list = undefined;
                        });
                    } else if (params.eventType === 'clear') {
                        view.cancelPromise(pr_id);
                        view.dataSourceCache['onlineTracklist'] = undefined;
                        if ((params.onlyOnline && lastShowingOnline) || !params.onlyOnline) {
                            view.dataSourceCache['tracklist'].clear();
                            view.dataSourceCacheObserver.notifyChange('tracklist'); // is listened e.g. by columnBrowser
                        }
                    }
                }
            }.bind(this));
            viewHandlersClasses['Albumview_tracklist'].$super.onShow.apply(this, arguments);
            cachedDS.currentTracklist = view.dataSourceCache['tracklist'];
            setTracklistChangehandler();
        },
        onHide: function (control, view) {
            if (view.dataSourceCache['albumView'])
                view.dataSourceCache['albumView'].release();
            viewHandlersClasses['Albumview_tracklist'].$super.onHide.apply(this, arguments);
            view.tracklistChangeHandler = undefined;
            view.firstTrack = undefined;
        },
        subViews: ['columnBrowser', 'albumview_header', 'statusBar'],
        hiddenSubViews: ['columnBrowser'] // sub-views hidden by default
    }),

    albumview_albumtracklist: inheritHandler('Albumview_albumtracklist', 'Albumview_tracklist', {
        columnsSupport: false,
        controlClass: 'AlbumTracklist',
        controlClass_initParams: {
            showHeader: false,
            hideArtists: true,
            showInline: true,
            checkGroups: true,
            disableStatusbar: true,
            //disableStateStoring: true, // store state so focused node is restored
        },
        title: function () {
            return _('Browser');
        },
        icon: 'browser',
        subViews: ['albumview_header', 'statusBar']
    }),

    seriesview_header: inheritHandler('Seriesview_header', 'Base', {
        controlClass: 'SeriesViewHeader',
        title: _('Info panel'),
        icon: 'browser',
        placement: {
            position: 'top',
            inScroller: true,
        },
        defaultFocusControl: function () {
            return undefined; // to search the default focus control within other subViews
        },
        onShow: function (control, view, mainViewControl) {
            let cachedDS = view.dataSourceCache['seriesView'];
            if (!cachedDS) {
                cachedDS = new SeriesDataSource(view.viewNode.dataSource);
                view.dataSourceCache['seriesView'] = cachedDS;
            }
            cachedDS.addRef();
            control.controlClass.dataSource = cachedDS;
            cachedDS.registerChangeHandler();
            control.controlClass.registerEventHandler('layoutchange');
            let tl = view.dataSourceCache['tracklist'];
            control.controlClass.requestFrame(function () { // moved to RAF as this can take more than 16 ms 
                let si = tl.statusInfo;
                if (si) {
                    si.then(function (data) {
                        if (data && control.controlClass)
                            control.controlClass.setStatus(data);
                    });
                }
            }, 'statusInfo');
            view.listen(mainViewControl, 'statusinfochange', function (e) {
                if (control.controlClass)
                    control.controlClass.setStatus(e.detail.data);
            });
        },
        onHide: function (control, view) {
            control.controlClass.unregisterEventHandler('layoutchange');
            if (control.controlClass.dataSource) {
                control.controlClass.dataSource.unregisterChangeHandler();
                control.controlClass.dataSource.release();
                control.controlClass.dataSource = undefined;
            }
        }
    }),

    seriesview_tracklist: inheritHandler('Seriesview_tracklist', 'Tracklist', {
        controlClass_initParams: {
            showHeader: true
        },
        title: function () {
            return _('List');
        },
        onShow: function (control, view) {
            let cachedDS = view.dataSourceCache['seriesView'];
            if (!cachedDS) {
                cachedDS = new SeriesDataSource(view.viewNode.dataSource);
                view.dataSourceCache['seriesView'] = cachedDS;
            }
            cachedDS.addRef();
            let lastShowingOnline = uitools.globalSettings.showingOnline;
            let handler = getNodeHandler(view);
            view.listen(cachedDS, 'change', function (params) {
                if (params) {
                    let pr_id = 'series_tracklist';
                    if (((params.eventType === 'settings') && (uitools.globalSettings.showingOnline !== lastShowingOnline)) || (uitools.globalSettings.showingOnline && !view.dataSourceCache['onlineTracklist'])) {
                        lastShowingOnline = uitools.globalSettings.showingOnline;
                        view.dataSourceCache['tracklist'].clear();
                        let list = handler.getViewDataSource(view, 'tracklist');
                        let so = lastShowingOnline;
                        view.cancelPromise(pr_id);
                        view.promise(list.whenLoaded(), pr_id).then(function () {
                            if (so === lastShowingOnline) {
                                view.dataSourceCache['tracklist'].clear();
                                view.dataSourceCache['tracklist'].addList(list);
                                view.viewNode.dataSource.notifyChanged('tracklist'); // is listened e.g. by tracklistBase, columnBrowser
                                cachedDS.currentTracklist = view.dataSourceCache['tracklist'];
                            }
                            list.globalModifyWatch = false; // not used list, no events needed already
                            list = undefined;
                        });
                    } else if (params.eventType === 'clear') {
                        view.cancelPromise(pr_id);
                        view.dataSourceCache['onlineTracklist'] = undefined;
                        if ((params.onlyOnline && lastShowingOnline) || !params.onlyOnline) {
                            view.dataSourceCache['tracklist'].clear();
                            view.dataSourceCacheObserver.notifyChange('tracklist'); // is listened e.g. by columnBrowser
                        }
                    }
                }
            }.bind(this));
            viewHandlersClasses['Seriesview_tracklist'].$super.onShow.apply(this, arguments);
            cachedDS.currentTracklist = view.dataSourceCache['tracklist'];
        },
        onHide: function (control, view) {
            if (view.dataSourceCache['seriesView']) {
                view.dataSourceCache['seriesView'].release();
            }
            viewHandlersClasses['Seriesview_tracklist'].$super.onHide.apply(this, arguments);
        },
        subViews: ['columnBrowser', 'seriesview_header', 'statusBar'],
        hiddenSubViews: ['columnBrowser'] // sub-views hidden by default
    }),

    seriesview_seriestracklist: inheritHandler('Seriesview_seriestracklist', 'Seriesview_tracklist', {
        columnsSupport: false,
        controlClass: 'AlbumTracklist',
        controlClass_initParams: {
            showHeader: false,
            hideArtists: true,
            showInline: true,
            checkGroups: true,
            disableStatusbar: true,
            //disableStateStoring: true, // store state so focused node is restored
            hasVideoContent: true
        },
        title: function () {
            return _('Simplified list');
        },
        subViews: ['seriesview_header', 'statusBar']
    }),

};
window.viewHandlers = viewHandlers;

// -----------------------------------------------------------------------------------------------------------------------------------------------------
/**
 * Instance variable: {@link nodeUtils}
 */
export interface NodeUtils {    
    getNodeTitle: (node: SharedNode, incChildCount?: boolean, acceptPromises?: boolean, forEditing?: boolean) => Promise<string> | string;
    setNodeTitle: (node: SharedNode, title: string) => void;
    canEditNodeTitle: (node: SharedNode) => boolean;
    getNodeTooltip: (node: SharedNode) => string;
    getNodeHelpContext: (node: SharedNode) => string;
    getMultiselectSupport: (node: SharedNode) => any;
    getHasVirtualChildrenSupport: (node: SharedNode) => any;
    getHasChildren: (node: SharedNode) => boolean;
    getHasTreeChildren: (node: SharedNode) => boolean;
    loadChildren: (node: SharedNode) => Promise<unknown>;
    initLoadProgress: (node: SharedNode) => void;
    closeLoadProgress: (node: SharedNode) => void; 
    refreshNodeChildren: (node: SharedNode, withoutProgress?: boolean) => Promise<unknown>; 
    DEFAULT_REFRESH_TIMEOUT: integer;
    deferredRefresh: (node: SharedNode, useTimeout?: number) => void; 
    deferredRefreshCancel: (node: SharedNode) => void; 
    onExpanded: (node: SharedNode) => void; 
    onCollapsed: (node: SharedNode) => void; 
    fillFromList: (node: SharedNode, list: SharedUIList<SharedObservable>, handlerID: string) => Promise<void>; 
    cancelNode: (node: SharedNode) => void; storeDataSource: (dataSource: any) => any; 
    restoreDataSource: (dataSource: any) => Promise<SharedObject>;
    storeNode: (node: SharedNode) => { handlerID: string; persistentID: string; dataSource: any; }; 
    restoreNode: (parentNode: any, state: any, addToTree: any) => Promise<unknown>; 
    getNodeByPath: (rootNode: SharedNode, pathNodeStates: any) => Promise<unknown>; 
    getNodeIcon: (node: SharedNode) => string; 
    getHideCheckbox: (node: SharedNode) => boolean; 
    getFirstNode: (nodes: SharedList<SharedNode>) => any; 
    getNodeCollection: (node: SharedNode) => Collection; 
    getParentAtLevel: (node: SharedNode, level: number) => SharedNode; 
    getNodeStateRootKey: (node: SharedNode, coll: Collection) => string; 
    getNodeDevice: (node: SharedNode) => any; 
    getCollectionStateRootKey: (coll: Collection) => string; 
    getCanBeCollapsed: (node: SharedNode) => any; 
    _collapseNode: (node: SharedNode, forced?: boolean) => void; 
    collapseNode: (rootNode: SharedNode, forced?: boolean) => void; 
    collapseNodeList: (list: SharedList<SharedNode>, forced?: boolean) => void; 
    _getNodeHandlersStoreKey: (node: SharedNode) => string; 
    setNodeHandlerState: (viewData: ViewData, state: AnyDict) => void; 
    getNodeHandlerState: (viewData: ViewData) => any; 
    _getViewHandlersStoreKey: (node: SharedNode) => string; 
    setViewHandlerState: (viewData: ViewData, state: AnyDict) => void; 
    getViewHandlerState: (viewData: ViewData) => any; 
    isDeleteDisabled: (node: SharedNode) => boolean; 
    getDeleteText: (node: SharedNode) => any; 
    deleteItems: (nodes: SharedList<SharedNode>, permanent?: boolean) => void; 
    _addDefaultMenu: (node: SharedNode) => boolean;    
    _getNodeMenu: (node: SharedNode) => Array<MenuItem>;
    copyNodeItem: (node: SharedNode, cut?: boolean) => void; 
    getBrowserTracksSortString: () => string; 
    getNodesTracklist: (nodes: SharedList<SharedNode>) => any; 
    createContextMenu: (getNodes: any) => any; 
    getDevicesBy: (node: SharedNode, params: AnyDict, handler: string) => Promise<void>; 
    canUseAutoSearch: () => boolean;
    progress?: BackgroundTask;
    _anyNodeInRefresh?: boolean;
}

/**
 * nodeUtils are used with conjunction of {@link nodeHandlers}.
 */
export const nodeUtils: NodeUtils = {    

    getNodeTitle: function (node: SharedNode, incChildCount?: boolean, acceptPromises?: boolean, forEditing?: boolean) {
        let handler = nodeHandlers[node.handlerID];
        if (!handler)
            return '';

        let tit;
        if (typeof handler.title === 'function')
            tit = handler.title(node, incChildCount, forEditing);
        else
            tit = handler.title;

        if (isPromise(tit)) {
            if (acceptPromises)
                return tit;
            else
                tit = '';
        }
        node.title = tit; // cache it for internal search purposes
        return tit;
    },

    setNodeTitle: function (node: SharedNode, title: string) {
        let handler = nodeHandlers[node.handlerID];
        if (handler && isFunction(handler.setTitle))
            handler.setTitle(node, title);
    },

    canEditNodeTitle: function (node: SharedNode) {
        if (!window.uitools.getCanEdit())
            return false;

        let handler = nodeHandlers[node.handlerID];
        if (handler && isFunction(handler.setTitle))
            return true;
        else
            return false;
    },

    getNodeTooltip: function (node: SharedNode) : string {
        let handler = nodeHandlers[node.handlerID];
        if (!handler || !handler.tooltip)
            return '';

        let ttip;
        if (typeof handler.tooltip === 'function')
            ttip = handler.tooltip(node);
        else
            ttip = handler.tooltip;
        return ttip;
    },

    getNodeHelpContext: function (node: SharedNode) : string {
        let handler = nodeHandlers[node.handlerID];
        if (!handler || !handler.helpContext)
            return '';

        let hc;
        if (typeof handler.helpContext === 'function')
            hc = handler.helpContext(node);
        else
            hc = handler.helpContext;
        return hc;
    },

    getMultiselectSupport: function (node: SharedNode) {
        let handler = nodeHandlers[node.handlerID];
        if (!handler)
            return false;

        return resolveToValue(handler.multiselect, false);
    },

    getHasVirtualChildrenSupport: function (node: SharedNode) {
        let handler = nodeHandlers[node.handlerID];
        if (!handler)
            return false;

        return resolveToValue(handler.virtualChildrenSupport, false);
    },

    getHasChildren: function (node: SharedNode) : boolean {
        let handler = nodeHandlers[node.handlerID];
        if (!handler)
            return false;

        if (isFunction(handler.hasChildren))
            return handler.hasChildren(node);
        else
            return handler.hasChildren as unknown as boolean;
    },

    getHasTreeChildren: function (node: SharedNode) : boolean {
        let handler = nodeHandlers[node.handlerID];
        if (!handler)
            return false;

        if (handler.hasTreeChildren != undefined) {
            if (isFunction(handler.hasTreeChildren))
                return handler.hasTreeChildren(node);
            else            
                return handler.hasTreeChildren as unknown as boolean;
        } else {
            return nodeUtils.getHasChildren(node);
        }
    },

    loadChildren: function (node: SharedNode) {
        // for non-expanded node loads the children, return promise
        if (!node.expanded && !node.expanding) {
            return nodeUtils.refreshNodeChildren(node);
        } else {
            if (node.children.isLoaded)
                return new Promise<void>(function (resolve, reject) {
                    resolve();
                });
            else
                return node.children.whenLoaded();
        }
    },

    initLoadProgress: function (node: SharedNode) {
        node.tag = node.tag || {}; // node.tag used by several nodeHandlers to attach temporary JS objects or listener func.
        nodeUtils.closeLoadProgress(node); // hide old progress and start new (otherwise old status stay always visible)
        requestTimeout(() => {
            if (node.expanding && node.children.count == 0) {
                // show 'Loading...' 500 ms later (when still nothing loaded) - issue #12262        
                node.addChild(null, 'loading');
                node.checkUpdate(0 /*0 ms to force update now*/);
            }
            if (node.expanding && window.isMainWindow) {
                // show also the wheel progress on the toolbar                
                nodeUtils.closeLoadProgress(node); // hide old progress and start new (otherwise old status stay always visible)
                nodeUtils.progress = app.backgroundTasks.createNew();
                nodeUtils.progress.text = _('Loading') + '...';
            }
        }, 500);
    },

    closeLoadProgress: function (node: SharedNode) {
        if (nodeUtils.progress) {
            nodeUtils.progress.terminate();
            nodeUtils.progress = null;
        }
    },

    refreshNodeChildren: function (node: SharedNode, withoutProgress?: boolean) {
        let handler = nodeHandlers[node.handlerID];
        if (!handler.getChildren) {
            ODS('WARNING: getChildren not defined for nodeHandlers[' + node.handlerID + '], callstack: ' + app.utils.logStackTrace());
            return dummyPromise();
        }
        nodeUtils._anyNodeInRefresh = true;
        node.tag = node.tag || {}; // node.tag used by several nodeHandlers to attach temporary JS objects or listener func.
        node.expanding = true;
        if (!withoutProgress)
            nodeUtils.initLoadProgress(node);
        node.beginUpdate(); // starts update and marks children for possible deletion                        
        handler.getChildren(node).finally(() => {
            node.expanding = false;
            let deleted = node.endUpdateAndGetDeleted(); // deletes children that no longer exist and resolves whenLoaded() promise on children                   
            nodeUtils.collapseNodeList(deleted, true);
            nodeUtils.closeLoadProgress(node);
            nodeUtils._anyNodeInRefresh = false;
        });
        return node.children.whenLoaded();
    },

    DEFAULT_REFRESH_TIMEOUT: 500, 

    deferredRefresh: function (node: SharedNode, useTimeout?: number) {
        node.tag = node.tag || {};
        let _tm = useTimeout || nodeUtils.DEFAULT_REFRESH_TIMEOUT;
        if (Date.now() - node.tag.__lastRefreshHitTm < 2000) // to update at least each two seconds during scans or edits
            clearTimeout(node.tag.__refreshTimeout);
        node.tag.__refreshTimeout = requestTimeout(() => {
            if ((Date.now() - node.tag.__lastRefreshHitTm < _tm) || nodeUtils._anyNodeInRefresh) {
                nodeUtils.deferredRefresh(node, _tm);
            } else {
                node.tag.__lastRefreshHitTm = Date.now();
                nodeUtils.refreshNodeChildren(node, true /* #17108 */).finally(function () {
                    node.notifyChanged();
                });
            }
        }, _tm);
    },

    deferredRefreshCancel: function (node: SharedNode) {
        clearTimeout(node.tag.__refreshTimeout);
    },

    onExpanded: function (node: SharedNode) {
        node.tag = node.tag || {};
        //LS: expand_lock is needed here because the node can be shared by more components (TreeView, NodeListView)
        node.tag.expand_lock = node.tag.expand_lock || 0;
        let handler = nodeHandlers[node.handlerID];
        if (handler.onExpanded && (node.tag.expand_lock == 0))
            handler.onExpanded(node);
        node.tag.expand_lock++;
    },

    onCollapsed: function (node: SharedNode) {
        node.tag.expand_lock--;
        let handler = nodeHandlers[node.handlerID];
        if (handler.onCollapsed && (node.tag.expand_lock == 0))
            handler.onCollapsed(node);
    },

    fillFromList: function (node: SharedNode, list: SharedList<SharedObservable>, handlerID: string) {
        return new Promise<void>(function (resolve, reject) {
            if (list.isLoaded) {
                node.addChildren(list, handlerID);
                resolve();
            } else {
                node.loadPromise = list.whenLoaded();
                let _updateStepFunc = () => { // to load it gradually   
                    node.loadUpdateTm = requestTimeout(() => {
                        if (node.expanding && list.count > 0) {
                            node.addChildren(list, handlerID);
                            node.checkUpdate(0 /*0 ms to force update now*/);
                        }
                        clearTimeout(node.loadUpdateTm);
                        if (!list.isLoaded)
                            _updateStepFunc();
                    }, 2000);
                };
                _updateStepFunc();
                node.loadPromise.then(function () {
                    clearTimeout(node.loadUpdateTm);
                    node.addChildren(list, handlerID);
                    resolve();
                }, function (e) {
                    if (isAbortError(e)) { // promise canceled
                        resolve();
                    } else
                        reject(e);
                });
            }
        });
    },

    cancelNode: function (node: SharedNode) {
        if (node) {
            node.canceled = true;
            cancelPromise(node.loadPromise);
            node.loadPromise = undefined;
            clearTimeout(node.loadUpdateTm);
            node.loadUpdateTm = undefined;
        }
    },

    storeDataSource: function (dataSource: any) {
        if (!dataSource)
            return null;
        if (dataSource.objectType && dataSource.getPersistentJSON) {
            // is delphi object
            let persistentInfo = JSON.parse(dataSource.getPersistentJSON());
            return {
                objectType: dataSource.objectType,
                persistentInfo: persistentInfo
            };
        } else {
            // is JS object, assign as is
            if (dataSource.persistentInfo)
                return dataSource.persistentInfo;
            else
                return dataSource;
        }
    },

    restoreDataSource: function (dataSource: any) {
        return new Promise(function (resolve, reject) {
            if (dataSource) {
                if (dataSource.objectType) {
                    if (dataSource.objectType == 'QueryData')
                        resolve(navUtils.getActiveTabQueryData());
                    else {
                        // is delphi object to be mined:
                        if (dataSource.persistentInfo) {
                            app.getObject(dataSource.objectType, dataSource.persistentInfo).then(
                                function (DS) {
                                    resolve(DS);
                                },
                                function (err) {
                                    reject('app.getObject() error:' + err);
                                });
                        } else {
                            reject('dataSource.persistentInfo is missing');
                        }
                    }
                } else {
                    // is JS object
                    resolve(dataSource);
                }
            } else {
                resolve(null);
            }
        });
    },

    storeNode: function (node: SharedNode) {
        return {
            handlerID: node.handlerID,
            persistentID: node.persistentID,
            dataSource: this.storeDataSource(node.dataSource)
        };
    },

    restoreNode: function (parentNode, state, addToTree) {
        let _this = this;
        return new Promise(function (resolve, reject) {
            _this.restoreDataSource(state.dataSource).then(
                function _res(dataSource) {
                    if (!nodeHandlers[state.handlerID]) {
                        let err = 'restoreNode: node handler for"' + state.handlerID + '" does not exist';
                        ODS(err);
                        reject(err);
                    } else {
                        if (inArray(state.handlerID, ['collection']) && !dataSource) {
                            let err = 'restoreNode: dataSource for handler "' + state.handlerID + '" is missing';
                            ODS(err);
                            reject(err);
                        } else {
                            let newNode = parentNode.addChild(dataSource, state.handlerID, !addToTree);
                            resolve(newNode);
                        }
                    }
                },
                function _rej(err) {
                    reject(err);
                });
        });
    },

    getNodeByPath: function (rootNode: SharedNode, pathNodeStates) {
        // finds node according to the given path
        return new Promise(function (resolve, reject) {

            ODS('nodeUtils.getNodeByPath: pathNodeStates.length = ' + pathNodeStates.length);

            let processNode = function (node, idx) {
                assert(idx < pathNodeStates.length, 'idx = ' + idx + ' while pathNodeStates.length = ' + pathNodeStates.length);
                let child = node.findChild(pathNodeStates[idx].persistentID);
                if (child) {
                    if (idx == pathNodeStates.length - 1) {
                        // this is the last path part, we are done
                        ODS('nodeUtils.getNodeByPath: Found fully by children');
                        resolve(child);
                    } else {
                        let loadChildren = nodeUtils.getHasChildren(child);
                        if (pathNodeStates && nodeUtils.getHasVirtualChildrenSupport(child))
                            loadChildren = false; // we can create virtual child, this is faster than loading all children and seeking our child
                        if (loadChildren) {
                            // we need to expand this node and continue
                            nodeUtils.loadChildren(child).then(function () {
                                processNode(child, idx + 1);
                            });
                        } else {
                            // this node does not have further children
                            if (pathNodeStates) {
                                // we can continue restoring "virtual" nodes from dataSources
                                processNode(child, idx + 1);
                            } else {
                                ODS('nodeUtils.getNodeByPath: Found partially');
                                reject(child); // reject with the last found parent
                            }
                        }
                    }
                } else {
                    // the searched node does not exist as a child, restore from node state/dataSource:                    
                    nodeUtils.restoreNode(node, pathNodeStates[idx], false).then(function (restoredNode) {
                        if (idx == pathNodeStates.length - 1) {
                            // this is the last path part, we are done
                            ODS('nodeUtils.getNodeByPath: Restored fully by dataSource');
                            resolve(restoredNode);
                        } else
                            processNode(restoredNode, idx + 1);
                    }, function () {
                        ODS('nodeUtils.getNodeByPath: restoredNode failure');
                        reject(node); // reject with the last found parent
                    });
                }
            };

            if (pathNodeStates.length <= 1) {
                ODS('nodeUtils.getNodeByPath: Found root');
                resolve(rootNode);
            } else {
                nodeUtils.loadChildren(rootNode).then(function () {
                    processNode(rootNode, 1);
                });
            }
        });
    },

    getNodeIcon: function (node: SharedNode) {
        let handler = nodeHandlers[node.handlerID];
        if (!handler)
            return '';

        if (typeof handler.icon === 'function')
            return handler.icon(node);
        else
            return handler.icon;
    },

    getHideCheckbox: function (node: SharedNode) {
        let handler = nodeHandlers[node.handlerID];
        if (!handler)
            return true;

        if (typeof handler.hideCheckbox === 'function')
            return handler.hideCheckbox(node.dataSource);
        else
            return handler.hideCheckbox;
    },

    getFirstNode: function (nodes: SharedList<SharedNode>) {
        if (nodes.count > 0) {
            let node;
            nodes.locked(function () {
                node = nodes.getValue(0);
            });
            return node;
        }
    },

    getNodeCollection: function (node: SharedNode): Collection {
        if (node.collection)
            return node.collection as Collection; // does the same as the commented code below, but is faster
        let n = node;
        let idColl = 0;
        let idCollEntireLib = -1;
        while (n && n.level >= 0) {
            let ds = n.dataSource;
            if (ds && ds.objectType == 'collection')
                return ds;
            if (ds && (ds.idColl > 0 || ds.idColl == idCollEntireLib))
                idColl = ds.idColl;
            n = n.parent;
        }
        if (idColl > 0 || idColl == idCollEntireLib)
            return app.collections.getCollection(idColl); // #19116
        else
            return null;
    },

    getParentAtLevel: function (node: SharedNode, level: number) {
        let n = node;
        while (n && n.level >= 0) {
            if (n.level == level)
                return n;
            n = n.parent;
        }
        return null;
    },

    getNodeStateRootKey: function (node: SharedNode, coll: Collection) {
        let n = node;
        while (n && n.level >= 0) {
            let nodeHandler = nodeHandlers[n.handlerID];
            if (nodeHandler.getStateRootKey)
                return nodeHandler.getStateRootKey(coll);
            n = n.parent;
        }
        return null;
    },

    getNodeDevice: function (node: SharedNode) {
        let n = node;
        while (n) {
            let ds = n.dataSource;
            if (ds && ds.objectType == 'device')
                return ds;
            n = n.parent;
        }
        return null;
    },

    getCollectionStateRootKey: function (coll: Collection) {
        return 'CONTROLS_STATE_COLLECTION_' + coll.id;
    },

    getCanBeCollapsed: function (node: SharedNode) {
        let handler = nodeHandlers[node.handlerID];
        if (!handler)
            return false;
        return resolveToValue(handler.canBeCollapsed, true);
    },

    _collapseNode: function (node: SharedNode, forced?: boolean) {
        let _this = this;
        if (node.expanded && (forced || nodeUtils.getCanBeCollapsed(node))) {
            nodeUtils.cancelNode(node); // cancels the node.loadPromise (used for filling nodes from lists)
            cancelPromise(node.children.whenLoaded()); // needs to be also canceled, as the whenLoaded() might be acquired in treeView.expandNode() before actual adding of a child from a list
            node.collapse();
            node.expanded = false;
            if (!node.expanding) // LS: when node is still expanding then onExpanded() was not called either yet, it will be later in treeView.expandNode()
                nodeUtils.onCollapsed(node);
        }
    },

    collapseNode: function (rootNode: SharedNode, forced?: boolean) {
        let _this = this;

        function processNode(node) {
            let subNodes = node.getExpandedChildren(); // get only the expanded children (to not freeze on 12K+ subnodes - issue #15546)
            subNodes.locked(function () {
                let _node;
                for (let i = 0; i < subNodes.count; i++) {
                    _node = subNodes.getFastObject(i, _node);
                    processNode(_node);
                }
            });
            nodeUtils._collapseNode(node, forced);
        }
        processNode(rootNode);
    },

    collapseNodeList: function (list: SharedList<SharedNode>, forced?: boolean) {
        let _this = this;
        list.locked(function () {
            let _node;
            for (let i = 0; i < list.count; i++) {
                _node = list.getFastObject(i, _node);
                _this.collapseNode(_node, forced);
            }
        });
    },

    _getNodeHandlersStoreKey: function (node: SharedNode) {
        let res = 'NODE_HANDLERS_STATE';
        if (window.isTouchMode)
            res = res + '_TOUCH';
        let coll = this.getNodeCollection(node);
        if (coll)
            res = res + '_COLLECTION_' + coll.id;
        return res;
    },

    setNodeHandlerState: function (viewData: ViewData, state: AnyDict) {
        let node = viewData.viewNode;
        let key = this._getNodeHandlersStoreKey(node);
        let states = app.getValue(key, {});

        let nHandlerKey = node.handlerID;
        let nHandler = nodeHandlers[nHandlerKey];
        if (nHandler.storeStateKey)
            nHandlerKey = nHandler.storeStateKey; // this way various node handlers can share the same state (e.g. 'playlists' and 'playlist')

        let vHandler = viewHandlers[state.viewAsId];
        if (vHandler && vHandler.baseViewType)
            state.baseViewType = vHandler.baseViewType; // this way the same active view type (List vs Grid) can be shared between various node handlers (#15926 - S4)

        states[nHandlerKey] = state;
        app.setValue(key, states);
    },

    getNodeHandlerState: function (viewData: ViewData) {
        let node = viewData.viewNode;
        let key = this._getNodeHandlersStoreKey(node);
        let res = undefined;
        let states = app.getValue(key, {});

        let nHandlerKey = node.handlerID;
        let nHandler = nodeHandlers[nHandlerKey];
        if (nHandler.storeStateKey)
            nHandlerKey = nHandler.storeStateKey;
        let handlerState = states[nHandlerKey];
        if (!handlerState) {
            handlerState = {};
            //if (nHandler.defaultViewType) // LS: seems deprecated/legacy
            //    handlerState.baseViewType = resolveToValue(nHandler.defaultViewType);
        }
        handlerState.hiddenSubViews = undefined; // was moved to view handler state (#15584)            

        ODS('getNodeHandlerState(' + key + '|' + nHandlerKey + '): ' + JSON.stringify(handlerState));
        let _viewAs = resolveToValue(nHandler.viewAs, [], node);
        if (!inArray(handlerState.viewAsId, _viewAs) && handlerState.baseViewType) {
            // first check viewAsId is not custom view
            if (!window.views.getCompatibleView(viewData, handlerState.viewAsId)) {
                // this view handler is not defined for this node handler
                // lookup the corresponding handler based on view type (List vs Grid) that can be shared between various node handlers (#15926 - S4)
                let _viewAsArr = resolveToValue(_viewAs, []);
                forEach(_viewAsArr, (key) => {
                    if (!viewHandlers[key])
                        alert('View handler "' + key + '" does not exist!' + ' View as array: ' + _viewAsArr);
                    else
                    if (viewHandlers[key].baseViewType && (viewHandlers[key].baseViewType == handlerState.baseViewType))
                        handlerState.viewAsId = key;
                });
            }
        }
        return handlerState;
    },

    _getViewHandlersStoreKey: function (node: SharedNode) {
        let res = 'VIEW_HANDLERS_STATE';
        let coll = this.getNodeCollection(node);
        if (coll)
            res = res + '_COLLECTION_' + coll.id;
        // save it per collection+node, see #16391 note ~57235
        res = res + '_NODE_' + node.handlerID.toUpperCase();
        return res;
    },

    setViewHandlerState: function (viewData: ViewData, state: AnyDict) {
        let node = viewData.viewNode;
        let key = this._getViewHandlersStoreKey(node);
        let states = app.getValue(key, {});
        assert(viewData.currentViewId);

        let vHandlerKey = viewData.currentViewId;
        let vHandler = viewHandlers[viewData.currentViewId];
        if (vHandler.storeStateKey)
            vHandlerKey = vHandler.storeStateKey;

        states[vHandlerKey] = state;
        app.setValue(key, states);
    },

    getViewHandlerState: function (viewData: ViewData) {
        let node = viewData.viewNode;
        let key = this._getViewHandlersStoreKey(node);
        let res = undefined;
        let states = app.getValue(key, {});
        assert(viewData.currentViewId);

        let vHandlerKey = viewData.currentViewId;
        let vHandler = viewHandlers[viewData.currentViewId];
        if (vHandler.storeStateKey)
            vHandlerKey = vHandler.storeStateKey;

        let handlerState = states[vHandlerKey];
        if (!handlerState)
            handlerState = {};

        if (viewData._state && viewData._state.hiddenSubViews) {
            handlerState.hiddenSubViews = viewData._state.hiddenSubViews;
        } else {
            if (!handlerState.hiddenSubViews) {
                handlerState.hiddenSubViews = {};
                if (vHandler && vHandler.hiddenSubViews) {
                    // default visibility defined by viewHandler:
                    for (let i = 0; i < vHandler.hiddenSubViews.length; i++)
                        handlerState.hiddenSubViews[vHandler.hiddenSubViews[i]] = true;
                }
                let nHandler = nodeHandlers[node.handlerID];
                if (nHandler.hiddenSubViews) {
                    // default visibility defined by nodeHandler:
                    for (let i = 0; i < nHandler.hiddenSubViews.length; i++)
                        handlerState.hiddenSubViews[nHandler.hiddenSubViews[i]] = true;
                }
            }
        }
        return handlerState;
    },

    isDeleteDisabled: function (node: SharedNode) {
        if (!window.uitools.getCanDelete() || !node)
            return true;
        let handler = nodeHandlers[node.handlerID];
        if (!handler)
            return true;

        if (typeof handler.canDelete === 'function')
            return !handler.canDelete(node);
        else
            return !handler.canDelete;
        return true;
    },


    getDeleteText: function (node: SharedNode) {
        let text = _('&Remove');
        if (!node)
            return text;

        let handler = nodeHandlers[node.handlerID];
        if (!handler)
            return text;

        if (isFunction(handler.deleteText))
            return handler.deleteText(node);
        else
            return text;
    },

    deleteItems: function (nodes: SharedList<SharedNode>, permanent?: boolean) {
        if (!window.uitools.getCanDelete() || !nodes)
            return;

        let handler = undefined;
        if (nodes.count) {
            nodes.locked(function () {
                handler = nodeHandlers[nodes.getValue(0).handlerID];
            });
        }
        if (!handler)
            return;
        if (handler.deleteItems)
            handler.deleteItems(nodes, permanent);
    },

    _addDefaultMenu: function (node: SharedNode) {
        if (!node)
            return false;

        let handler = nodeHandlers[node.handlerID];
        if (!handler)
            return false;

        if (typeof handler.hideDefaultMenu === 'function')
            return !handler.hideDefaultMenu(node);
        else
            return !handler.hideDefaultMenu;
    },

    /**
     * Gets the menu for a node (in the Media Tree).
     * @method _getNodeMenu
     * @param {LibraryNode} node Library node
     * @returns {Array<MenuItem>} Array of Menu items
     */
    _getNodeMenu: function (node: SharedNode) : Array<MenuItem> {
        if (!node)
            return [];

        let handler = nodeHandlers[node.handlerID];
        if (!handler)
            return [];

        let ar;
        if (typeof handler.menu === 'function')
            ar = handler.menu(node);
        else
            ar = handler.menu;

        ar = ar || [];

        let cpy = ar.slice(0); // LS: use copy (so that the original array in the handler is preserved)        

        // If the appropriate nodeHandler has an array "menuAddons", add that to the list
        if (handler.menuAddons) {
            forEach(handler.menuAddons, function (itm) {
                let aM: MenuItem;
                if (isFunction(itm))
                    aM = itm(node);
                else
                    aM = itm;
                if (isArray(aM)) {
                    cpy = cpy.concat(aM);
                } else {
                    cpy.push(aM);
                }
            });
        }

        /*
        #16317: Tree: Open in new tab - reverted because of #15664
        cpy.push({
            action: {
                title: _('Open in new tab'),
                icon: 'add',
                shortcut: 'Ctrl' + '+' + _('click'),
                execute: () => {
                    var mainTabContent = window.currentTabControl;
                    if (mainTabContent) {
                        mainTabContent.showView({
                            node: node,
                            noAnimations: true,
                            newTab: true
                        });
                    }
                }
            },
            order: 1,
            grouporder: 10
        });
        */
        if (node.parent && node.parent.handlerID == 'root') {
            // sub-root (first level) nodes can be configured, add the item (#15766)
            cpy.push({
                action: actions.configureCollections,
                order: 1,
                grouporder: 10
            });
        }
        return cpy;
    },

    copyNodeItem: function (node: SharedNode, cut?: boolean) {
        if (node.dataSource) {
            window.clipboard = {
                data: node.dataSource, // e.g. playlist
                cut: !!cut,
                dataType: node.dataSource.objectType,
                srcNode: node
            };
            let srcObject = nodeUtils.storeDataSource(node.dataSource);
            dnd.getTracklistAsync(node.dataSource.getTracklist()).then(function (list) {
            // file list
                app.utils.copyToClipboard(list, {
                    cut: !!cut,
                    srcObject: srcObject
                });
            });
        } else {
            ODS('Error: Copying nodes without dataSource not supported'); // #20831
        }
    },
    getBrowserTracksSortString: function (): string {
        let h = navUtils.getActiveViewHandler();
        let viewPanel = navUtils.getActiveViewPanel();
        let sortString = '';

        if (h && viewPanel) {
            let tEls = qeclass(viewPanel, 'browserTracks');
            if (tEls && (tEls.length > 0)) {
                for (let i = 0; i < tEls.length; i++) {
                    let eEl = tEls[i];
                    if (eEl && eEl.controlClass && isFunction(eEl.controlClass.getCurrenSortString) && isVisible(eEl)) {
                        sortString = eEl.controlClass.getCurrenSortString();
                        break;
                    }
                }
            }
        }
        return sortString;
    },
    getNodesTracklist: function (nodes: SharedList<SharedNode>) {
        let list = app.utils.createTracklist();
        let sortString = '';
        if (nodes.count == 1) {
            let n = getValueAtIndex(nodes, 0);
            let an = navUtils.getActiveNode();
            if (n && an && n.nodePath == an.nodePath) {
                // the node's content is shown in the view, search the tracklist within the view (to resolve #16472)
                let h = navUtils.getActiveViewHandler();
                let viewPanel = navUtils.getActiveViewPanel();
                if (viewPanel && h) {
                    if ((h.baseViewType == 'list') || (h.baseViewType == 'listByAlbum')) {
                        let viewTracklist;
                        let searchControl = (ctrl) => {
                            let cls = ctrl.controlClass;
                            if (cls && cls.dataSource && cls.dataSource.objectType == 'tracklist' && isVisible(ctrl))
                                viewTracklist = cls.dataSource;
                        };
                        searchControl(viewPanel);
                        forEach(viewPanel.querySelectorAll('div'), searchControl);
                        if (viewTracklist)
                            return viewTracklist; // #16472
                    } else if (h.baseViewType == 'browser') { // try to find tracklist subcontrol and its sorting
                        let tEls = qeclass(viewPanel, 'browserTracks');
                        if (tEls && (tEls.length > 0)) {
                            for (let i = 0; i < tEls.length; i++) {
                                let eEl = tEls[i];
                                if (eEl && eEl.controlClass && isFunction(eEl.controlClass.getCurrenSortString) && isVisible(eEl)) {
                                    sortString = eEl.controlClass.getCurrenSortString();
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }

        listAsyncForEach(nodes, (node, next) => {
            if (node.dataSource && node.dataSource.getTracklist) {
                let _list;
                if (nodeHandlers[node.handlerID].includeSubfoldersSupport)
                    _list = node.dataSource.getTracklist(true /* incl. subfolders*/);
                else {
                    if (sortString) {
                        let pars: AnyDict = {};
                        if (sortString === 'playOrder ASC') {
                            pars.topTracksSort = true;
                        } else {
                            pars.sortString = sortString;
                        }
                        _list = node.dataSource.getTracklist(pars);
                    } else
                        _list = node.dataSource.getTracklist();
                }

                if (_list) {
                    _list.whenLoaded().then(() => {
                        list.addList(_list);
                        next();
                    });
                } else
                    next();

            } else {
                next();
            }
        }, () => {
            list.notifyLoaded();
        });
        return list;
    },

    createContextMenu: function (getNodes) {

        let nodes = getNodes();
        let node = undefined;
        nodes.locked(function () {
            if (nodes.count)
                node = nodes.getValue(0);
        });

        function isTracklistNode() {
            if (node && node.dataSource && node.dataSource.getTracklist) {
                let handler = nodeHandlers[node.handlerID];
                if (!handler.hideTracklistMenu)
                    return true;
            } else
                return false;
        }

        function getNodeTitle() {
            if (nodes.count == 1) {
                let n = getValueAtIndex(nodes, 0);
                return n.title || '';
            }
            return '';
        }

        function getNodeTracklist() {
            return nodeUtils.getNodesTracklist(nodes);
        }

        function createNodePlayAction(action) {
            return {
                title: action.title,
                icon: action.icon,
                actionType: action.actionType,
                visible: () => {
                    return isTracklistNode() && (window.settings.UI.canReorder != false);
                },
                execute: action.execute,
                getTracklist: getNodeTracklist,
                onlySelected: true,
                shortcut: action.shortcut
            };
        }

        function createTracklistEditAction(action, allowReadOnly?: boolean) {
            return {
                title: action.title,
                icon: action.icon,
                visible: function () {
                    if (!window.uitools.getCanEdit() || !isTracklistNode())
                        return false;
                    else
                    if (!allowReadOnly && node && node.handlerID) {
                        let h = nodeHandlers[node.handlerID];
                        if (h && h.readOnlyContent)
                            return false;
                    }
                    return true;
                },
                execute: action.execute,
                submenu: action.submenu,
                getTracklist: getNodeTracklist,
                shortcut: action.shortcut,
                getNodeTitle: getNodeTitle
            };
        }

        let result = this._getNodeMenu(node);
        let bindFn = () => {
            if (node)
                return node.dataSource;
            return undefined;
        };

        if (this._addDefaultMenu(node)) {
            let _this = this; // nodeUtils
            let sendToAction = actions.sendTo;
            let shuffle = app.player.shufflePlaylist;
            if(shuffle) {
                result.push({
                    action: createNodePlayAction(concatObjects(copyObject(actions.playNowShuffled), {
                        title: function () {
                            return _('Play now') + ' (' + _('shuffled') + ')';
                        },
                    })),
                    order: 10,
                    grouporder: 20
                });
                result.push({
                    action: createNodePlayAction(concatObjects(copyObject(actions.playNextShuffled), {
                        title: function () {
                            return _('Queue next') + ' (' + _('shuffled') + ')';
                        }
                    })),
                    order: 20,
                    grouporder: 20
                });
                result.push({
                    action: createNodePlayAction(concatObjects(copyObject(actions.playMixedShuffled), {
                        title: function () {
                            return _('Queue mixed') + ' (' + _('shuffled') + ')';
                        },
                    })),
                    order: 30,
                    grouporder: 20
                });                
                result.push({
                    action: createNodePlayAction(concatObjects(copyObject(actions.playLastShuffled), {
                        title: function () {
                            return _('Queue last') + ' (' + _('shuffled') + ')';
                        },
                    })),
                    order: 40,
                    grouporder: 20
                });
            } else {
                result.push({
                    action: createNodePlayAction(actions.playNow),
                    order: 10,
                    grouporder: 20
                });
                result.push({
                    action: createNodePlayAction(actions.playNext),
                    order: 20,
                    grouporder: 20
                });
                result.push({
                    action: createNodePlayAction(actions.playLast),
                    order: 30,
                    grouporder: 20
                });

                result.push({
                    action: {
                        title: function () {
                            return _('Play shuffled');
                        },
                        icon: 'shuffle',
                        visible: () => {
                            return isTracklistNode() && (window.settings.UI.canReorder != false);
                        },
                        submenu: [{
                            action: createNodePlayAction(actions.playNowShuffled),
                            order: 10,
                            grouporder: 10
                        },
                        {
                            action: createNodePlayAction(actions.playNextShuffled),
                            order: 20,
                            grouporder: 10
                        },
                        {
                            action: createNodePlayAction(actions.playMixedShuffled),
                            order: 30,
                            grouporder: 10
                        },
                        {
                            action: createNodePlayAction(actions.playLastShuffled),
                            order: 40,
                            grouporder: 10
                        }]
                    },
                    order: 40,
                    grouporder: 20
                });
            }
            result.push({
                action: {
                    title: function () {
                        return _('Play shuffled (by Album)');
                    },
                    icon: 'shuffleByAlbum',
                    visible: () => {
                        return isTracklistNode() && (window.settings.UI.canReorder != false);
                    },
                    submenu: [{
                        action: createNodePlayAction(actions.playNowShuffledByAlbum),
                        order: 10,
                        grouporder: 10
                    },
                    {
                        action: createNodePlayAction(actions.playNextShuffledByAlbum),
                        order: 20,
                        grouporder: 10
                    },
                    {
                        action: createNodePlayAction(actions.playLastShuffledByAlbum),
                        order: 40,
                        grouporder: 10
                    }]
                },
                order: 50,
                grouporder: 20
            });
            if(shuffle) {
                result.push({
                    action: {
                        title: function () {
                            return _('Play normally');
                        },
                        visible: () => {
                            return isTracklistNode() && (window.settings.UI.canReorder != false);
                        },
                        submenu: [{
                            action: createNodePlayAction(actions.playNow),
                            order: 10,
                            grouporder: 10
                        },
                        {
                            action: createNodePlayAction(actions.playNext),
                            order: 20,
                            grouporder: 10
                        },
                        {
                            action: createNodePlayAction(actions.playLast),
                            order: 30,
                            grouporder: 10
                        }]
                    },
                    order: 60,
                    grouporder: 20
                });
            }
            result.push({
                action: bindAction(createTracklistEditAction(sendToAction), bindFn),
                order: 10,
                grouporder: 30
            });
            result.push({ // Cut
                action: {
                    title: actions.cut.title,
                    icon: actions.cut.icon,
                    execute: function () {
                        nodeUtils.copyNodeItem(node, true /*cut*/);
                    },
                    visible: window.settings.UI.canDragDrop && isTracklistNode,
                    shortcut: actions.cut.shortcut
                },
                order: 30,
                grouporder: 40
            });
            result.push({ // Copy
                action: {
                    title: actions.copy.title,
                    icon: actions.copy.icon,
                    execute: function () {
                        nodeUtils.copyNodeItem(node);
                    },
                    visible: window.settings.UI.canDragDrop && isTracklistNode,
                    shortcut: actions.copy.shortcut
                },
                order: 40,
                grouporder: 40
            });
            result.push({ // Paste
                action: {
                    title: actions.paste.title,
                    icon: actions.paste.icon,
                    execute: function () {
                        let handler = nodeHandlers[node.handlerID];
                        window.uitools.pasteClipboard(
                            function _canPaste(cdata) {
                                return handler.canDrop && handler.canDrop(node.dataSource, cdata);
                            },
                            function _paste(cdata) {
                                if (!cdata._dropNode)
                                    cdata._dropNode = node;
                                handler.drop(node.dataSource, cdata);
                            });
                    },
                    visible: function () {
                        let handler = nodeHandlers[node.handlerID];
                        return window.settings.UI.canDragDrop && handler.canDrop;
                    },
                    disabled: function () {
                        let ret = !window.settings.UI.canDragDrop;
                        if (!ret) {
                            ret = !window.uitools.canPasteClipboard(function _canPaste(cdata) {
                                let handler = nodeHandlers[node.handlerID];
                                return handler.canDrop && handler.canDrop(node.dataSource, cdata);
                            });
                        }
                        dnd.finishedDragNDrop();
                        return ret;
                    },
                    shortcut: actions.paste.shortcut
                },
                order: 50,
                grouporder: 40
            });
            result.push({
                action: {
                    title: function () {
                        return _this.getDeleteText(node);
                    },
                    icon: 'delete',
                    visible: function () {
                        return !_this.isDeleteDisabled(node);
                    },
                    execute: function () {
                        _this.deleteItems(nodes);
                    },
                    shortcut: actions.remove.shortcut
                },
                order: 60,
                grouporder: 40
            });
            result.push({
                action: {
                    title: function () {
                        return _('Rename');
                    },
                    icon: 'edit',
                    visible: function () {
                        return _this.canEditNodeTitle(node);
                    },
                    execute: function () {
                        let LV = window.lastFocusedControl;
                        LV.controlClass.editStart();
                    },
                    shortcut: 'F2'
                },
                order: 70,
                grouporder: 40
            });
            result.push({
                action: createTracklistEditAction(actions.autoTag, true /* #16065 - item 7 */),
                order: 10,
                grouporder: 60
            });
            result.push({
                action: createTracklistEditAction(actions.autoTagFromFilename),
                order: 20,
                grouporder: 60
            });
            result.push({
                action: createTracklistEditAction(actions.autoOrganize),
                order: 30,
                grouporder: 60
            });
            if (!nodeHandlers[node.handlerID].hidePropertiesMenu)
                result.push({
                    action: createTracklistEditAction(actions.trackProperties, true),
                    order: 40,
                    grouporder: 60
                });
            result.push({
                action: createTracklistEditAction(actions.convertFiles),
                order: 10,
                grouporder: 70
            });
            result.push({
                action: createTracklistEditAction(actions.analyzeVolume),
                order: 20,
                grouporder: 70
            });
            /* removed per #19180
            result.push({
                action: createTracklistEditAction(actions.levelTrackVolume),
                order: 30,
                grouporder: 70
            });
            */
            /*  Pin was moved to 'Send to' menu (per #16446)
            result.push({
                action: bindAction(window.actions.pin, () => {
                    return node.dataSource;
                }),
                order: 10,
                grouporder: 80
            });*/
            result.push({
                action: bindAction(window.actions.unpin, () => {
                    return node.dataSource;
                }),
                order: 20,
                grouporder: 1 // Unpin should be the very first (per #16446)
            });
        }

        return new Menu(result);
    },

    getDevicesBy: function (node: SharedNode, params: AnyDict, handler: string) {
        return new Promise<void>(function (resolve, reject) {
            requirejs('helpers/mediaSync');
            mediaSyncDevices.getBy(params).then(function (list) {
                node.addChildren(list, handler);
                resolve();
            });
        });
    },

    canUseAutoSearch: function (): boolean {
        let node = navUtils.getActiveNode();
        if (node && nodeHandlers[node.handlerID].forbiddenAutoSearch)
            return false;
        else
            return true;
    },

    _anyNodeInRefresh: false,
};
window.nodeUtils = nodeUtils;

window.nodeHandlersClasses = {};
window.nodeHandlersClasses.Base = function () { };
window.nodeHandlersClasses.Base.prototype = {
    hasChildren: function () {
        if (isFunction(this.getChildren))
            return true;
        else
            return false;
    },
    helpContext: 'Library',
    filterSupport: true
};

function inheritNodeHandler(className: string, parentClass: string, methods, properties?) {
    nodeHandlersClasses[className] = inherit(className, nodeHandlersClasses[parentClass], methods, properties);
    return new nodeHandlersClasses[className]() as NodeHandler;
}
// @ts-ignore
window.inheritNodeHandler = inheritNodeHandler;

/* does not seem to be used anywhere currently
inheritNodeHandler('OrderableBase', 'Base', {

    isOrderable: true,

    getDropMode: function (dataSource, e) {
        return 'move';
    },
    canDrop: function (dataSource, e) {
        var datatype = dnd.getDropDataType(e);
        var dragObject = dnd.getDragObject(e, datatype);
        return dnd.isSameControl(e) && dragObject && resolveToValue(dragObject.isOrderable, false) && (dragObject.level === 1);
    },  
    drop: function (dataSource, e, index) {
        var ctrl = e.dataTransfer.getSourceControl();
        if (ctrl && ctrl.controlClass) {

            var datatype = dnd.getDropDataType(e);
            var dragObject = dnd.getDragObject(e, datatype);

            if (dragObject && dragObject.dataSource) {
                var state = app.getValue('mediaTreeItems', {
                    treeNodes: []
                });

                if (state.treeNodes && state.treeNodes.length) {
                    for (var i = 0; i < state.treeNodes.length; i++) {
                        if ((state.treeNodes[i].itemType === datatype) &&
                            (state.treeNodes[i].id === dragObject.dataSource.id)) {
                            // move item to new position

                            state.treeNodes.move(i, index);

                            for (var i = 0; i < state.treeNodes.length; i++) {
                                state.treeNodes[i].pos = i;
                            }
                            break;
                        }
                    }

                    app.setValue('mediaTreeItems', {
                        treeNodes: state.treeNodes
                    });
                }
            }
            ctrl.controlClass.drop(e);
        }
    }
});
*/

inheritNodeHandler('Observable', 'Base', {
    // onExpanded/onCollapsed is used in TreeView and descendants
    onExpanded: function (node) {        
        node.tag.refreshChildren = () => {
            if (this.immediateRefresh)
                nodeUtils.refreshNodeChildren(node, true);
            else
                nodeUtils.deferredRefresh(node); // to eliminate cases when 'change' on dataSource list is called too often            
        };
        app.listen(node.dataSource, 'change', node.tag.refreshChildren);
    },
    onCollapsed: function (node) {
        nodeUtils.deferredRefreshCancel(node);
        app.unlisten(node.dataSource, 'change', node.tag.refreshChildren);
        node.tag.refreshChildren = undefined;
    }
});

/**
Defines nodes and node structure of media tree (and other trees as well)

e.g. nodeHandlers.playlist defined how a playlist node will behave and which view will be shown

Example (see `/sampleScripts/customNodes/viewHandlers_add.js` for further examples, and/or the individual node handlers below):
    
    nodeHandlers.myNewHandler = inheritNodeHandler('MyNewHandlerClass', 'Base', \{
        title: // node title (string or funct. returning string)
        // the following are optional:
        setTitle: // when renamed using F2 key or in-place edit
        icon: // node icon (string or funct. returning string)
        onExpanded: //  code to perform on node expand
        onCollapsed: // code to perform on node collapse         
        hasChildren: // whether there are some children nodes (boolean, default false)
        hasTreeChildren: // optional - for some nodes we want to limit the hierarchy in TreeView (while keep it in NavigationBar or NodeListView)
        getChildren: function (node) \{  // child nodes to be added 
            return new Promise(function (resolve, reject) \{
                app.getObject('genre', \{name: 'rock'\}).then(function (object) \{
                    node.addChild(object, 'genre'); // this adds new child where object will become dataSource of the new child node and 'genre' says that nodeHandlers.genre will be used as handler for the new node
                \});
            \});
        \},    
        viewAs: ['tracklist'] // says that viewHandlers.tracklist defines the view    
        canDelete: // whether the node can be deleted (boolean, default false)
        deleteItems: // delete behaviour   
        canReorderNodes: // whether nodes can be reordered (boolean, default false) 
        canDrop: // whether can drop/paste on this node (boolean, default false)
        getDropMode: // drop mode (e.g. based on shift key)    
        drop: // drop behaviour
        formatStatus: // to define custom format status (i.e. the text shown on the status bar)
        toolbarActions: [], // custom actions to add on toolbar, actions have to contain identifier property with action id
        menu: [], // custom popup-menu
        hideDefaultMenu: true, // don't append the default popup-menu
    \});

*/

export const nodeHandlers: Dictionary<NodeHandler> = {};
window.nodeHandlers = nodeHandlers;

// inheritance, this way we creates 'PlaylistBase' node handler class, 'Playlist' and 'Playlists' inherits from it when creating nodeHandlers.playlist(s) instances below
inheritNodeHandler('PlaylistBase', 'Observable', {
    immediateRefresh: true,
    toolbarActions: [actions.newPlaylist, actions.newAutoPlaylist],
    getChildren: function (node) {
        return nodeUtils.fillFromList(node, node.dataSource.getChildren(), 'playlist');
    },
    formatStatus: function (data) {
        return statusbarFormatters.formatDefaultSimpleStatus(data, function (cnt) {
            return _('playlist', 'playlists', cnt);
        });
    },
    helpContext: 'Playlists',
    orderColumnSupport: true,
    defaultColumnSort: 'playOrder ASC',
    requiredColumns: 'playOrder',
    isPlaylistType: true,
    getStateRootKey: function () {
        return 'CONTROLS_STATE_PLAYLIST';
    },
    menu: function (node) {
        let menuItems = [];
        menuItems.push({
            action: actions.saveNewOrder,
            order: 5,
            grouporder: 10
        });
        menuItems.push({ // moved at top in #16542
            action: {
                title: function () {
                    return _('Edit');
                },
                icon: 'edit',
                visible: function () {
                    if (!window.uitools.getCanEdit())
                        return false;
                    else
                        return (node.dataSource.parent != undefined); // to exclude root playlists node
                },
                execute: function () {
                    let pl = node.dataSource;
                    if (pl.isAutoPlaylist) {
                        pl.inEdit = true;
                        navigationHandlers['playlist'].navigate(pl);
                    } else {
                        uitools.showPlaylistEditor(pl, false, 'editMenu');
                    }
                }
            },
            order: 10,
            grouporder: 10,
        });
        menuItems.push({
            action: actions.newPlaylist,
            order: 20,
            grouporder: 10
        });
        menuItems.push({
            action: actions.newAutoPlaylist,
            order: 30,
            grouporder: 10
        });
        menuItems.push({
            action: bindAction(window.actions.playlistRemoveDuplicates, () => {
                return node.dataSource;
            }),
            order: 40,
            grouporder: 10,
        });
        menuItems.push({ // added back (#16065 - item 11)
            action: {
                title: actions.coverLookup.title,
                icon: actions.coverLookup.icon,
                visible: function () {
                    if (!window.uitools.getCanEdit())
                        return false;
                    if (node.dataSource.parent != undefined) { // to exclude root playlists node                                                
                        let LV = window.lastFocusedControl;
                        return LV && (LV.controlClass.constructor.name == 'NodeListView'); // to exclude from media tree menu                        
                    }
                },
                execute: function () {
                    requirejs('helpers/searchTools');
                    searchTools.searchPlaylistImageDlg(node.dataSource, function () {
                        if (node.dataSource.notifyChanged)
                            node.dataSource.notifyChanged('artwork');
                        actions.view.refresh.execute();
                    });
                }
            },
            order: 10,
            grouporder: 60,
        });
        return menuItems;
    },
    hiddenSubViews: ['columnBrowser', 'playlist_Tree'], // sub-views hidden by default   
    /*
    defaultViewType: () => {
        // per #15926 - S4
        if (window.isTouchMode)
            return 'grid';
        else
            return 'list';
    },
    */
});
nodeHandlers.playlist = inheritNodeHandler('Playlist', 'PlaylistBase', {
    title: function (node, incChildCount) {
        let res = node.dataSource.name;
        if (incChildCount && node.dataSource.childrenCount > 0)
            res = res + ' (' + node.dataSource.childrenCount + ' ' + _('playlists') + ')';
        return res;
    },
    setTitle: function (node, newTitle) {
        node.dataSource.name = newTitle;
        node.dataSource.commitAsync();
    },
    hasChildren: function (node) {
        return (node.dataSource.childrenCount > 0);
    },
    icon: function (node) {
        if (node.dataSource.isAutoPlaylist)
            return 'autoplaylist';
        else
            return 'playlist';
    },
    helpContext: function (node) {
        if (node.dataSource.isAutoPlaylist)
            return 'Using_AutoPlaylists';
        else
            return 'Using_Playlists';
    },
    viewAs: ['playlist_browser', 'playlist_tracklist', 'playlist_groupedTracklist', 'playlist_albumlist' /*, 'playlist_trackgrid'*/], // #15926
    multiselect: true,
    storeColumnsSupported: false,
    filterSupport: false,
    canDelete: function canDelete(node) {
        if (node && node.parent && node.parent.handlerID == 'pinned')            
            return false;        
        else
            return true;
    },
    deleteItems: function (nodes) {
        let playlist;
        let count = nodes.count;
        if (count == 1) {
            nodes.locked(function () {
                playlist = nodes.getValue(0).dataSource;
            });
        }

        let message;
        if (count == 1) {
            message = sprintf(_('Are you sure you want to remove playlist "%s" ?'), escapeXml(playlist.name));
            if (playlist.childrenCount > 0)
                message = message + '\n\n' + _('This playlist is a parent of other playlists. Deleting it will also remove its children. Are you sure you want to delete it?');
        } else {
            message = sprintf(_('Are you sure you want to remove %d selected playlists ?'), count);
        }

        messageDlg(message, 'Confirmation', ['btnYes', 'btnNo'], {
            defaultButton: 'btnYes'
        }, function (result) {
            if (result.btnID === 'btnYes') {
                let del = function (node) {
                    let playlist = node.dataSource;
                    if (uitools.globalSettings.sendToMRUList) {
                        let idx = uitools.globalSettings.sendToMRUList.findIndex((o) => (o.playlistID === playlist.id));
                        if (idx >= 0)
                            uitools.globalSettings.sendToMRUList.splice(idx, 1);
                    }
                    playlist.deleteAsync();
                };
                nodes.forEach(function (node) {
                    del(node);
                });
            }
        });
    },
    reorderOnly: false, // user can drop to itself    
    canSaveNewOrder: function (node) {
        return !node.dataSource.isAutoPlaylist;
    },
    getDropMode: function (dataSource, e) {
        let datatype = dnd.getDropDataType(e);
        let isPlaylistObject = (datatype == 'playlist');
        if (isPlaylistObject) {
            // playlist
            return e.ctrlKey ? 'copy' : 'move';
        } else {
            // tracklist   
            if (dnd.isSameControl(e)) {
                return 'move';
            }
            return e.shiftKey ? 'move' : 'copy';
        }
    },
    canDrop: function (dataSource, e, callerControl) {

        if (!dataSource)
            return false;

        let datatype = dnd.getDropDataType(e);
        let isPlaylistObject = (datatype == 'playlist');
        if (isPlaylistObject) { // e.g. D&D of playlist on mediatree (or Copy/Pase of playlists between the tree and view) -- #16486
            if (dataSource.objectType != 'playlist')
                return false;
            else {
                let dragObject = dnd.getDragObject(e);
                if (!dragObject)
                    return false;
                if (!dragObject.count && dragObject.id) { // not a list 
                    let parent = dataSource.parent;
                    while (parent) {
                        if (parent.id == dragObject.id)
                            return false; // #16931
                        parent = parent.parent;
                    }
                }
                return true;
            }
        }

        if (dnd.isSameControl(e)) {
            let res = false;
            // check whether re-order of tracks in playlist is possible
            if (datatype == 'track' && !dataSource.isAutoPlaylist) {
                if (callerControl && callerControl.dataSource) {
                    // #16323: Drag&Drop should not be possible when playlist is dis-ordered to prevent from original order loss
                    res = (callerControl.dataSource.autoSortString == this.defaultColumnSort || !callerControl.dataSource.autoSortString /* #16412 */);
                }
            }
            return res;
        } else {
            // D&D of tracks into a playlist
            return !dataSource.isAutoPlaylist && dnd.isAllowedType(e, 'media');
        }
    },
    canReorderItemsInView: true,
    itemsInViewReordered: function (dataSource, e) {
        let ctrl = e.dataTransfer.getSourceControl();
        if (ctrl && ctrl.controlClass) {
            ctrl.controlClass.autoSortString = '';
            dataSource.reorderAsync(ctrl.controlClass.dataSource);
            uitools.cleanUpSaveButton(null);
        }
        if (!resolveToValue(this.canSaveNewOrder, true, {
            dataSource: dataSource
        })) { // auto-playlist sorted ... disable auto refresh of this list so current sort persist
            dataSource.autoUpdateDisabled = true;
        }
    },
    drop: function (dataSource, e, index) {
        let srcObject = dnd.getDragObject(e);
        let datatype = dnd.getDropDataType(e);
        let isCopy = dnd.getDropMode(e) == 'copy';
        if (srcObject && (datatype == 'playlist')) {
            let _dropPlaylist = (playlist) => {
                return new Promise<void>(function (resolve, reject) {
                    if ((playlist.id != dataSource.id) || isCopy /* #17863 */) { // we cannot drop to itself                
                        let _movePlaylist = (playlist) => {
                            uitools.cleanUpSaveButton(null);
                            playlist.parent = dataSource;
                            playlist.commitAsync().then(resolve);
                        };
                        if (isCopy) {
                            playlist.createCopyAsync().then(function (dataCopy) {
                                _movePlaylist(dataCopy);
                            });
                        } else {
                            _movePlaylist(playlist);
                        }
                    } else {
                        resolve();
                    }
                });
            };
            if (srcObject.whenLoaded) {
                srcObject.whenLoaded().then(() => {
                    dataSource.beginUpdate();
                    listAsyncForEach(srcObject, (item, next) => {
                        _dropPlaylist(item).finally(() => {
                            dataSource.checkUpdate(1000 /* ms */);
                            next();
                        });
                    }, () => {
                        dataSource.endUpdate();
                    });
                });
            } else {
                _dropPlaylist(srcObject);
            }
        } else {
            let list = srcObject;
            let srcControl;
            if (e && e.dataTransfer)
                srcControl = e.dataTransfer.getSourceControl(e);
            dnd.getTracklistAsync(list).then(function (l) {

                let process = () => {
                    if (index !== undefined) {
                        if (dataSource && isFunction(dataSource.insertTracksAsync))
                            dataSource.insertTracksAsync(index, l);
                    } else {
                        if (dataSource && isFunction(dataSource.addTracksAsync))
                            dataSource.addTracksAsync(l);
                    }
                    uitools.cleanUpSaveButton(null);
                };

                if (!isCopy && srcControl) { // we need to handle move before we actually process drop because of IdPlaylistSong change
                    dnd.handleMoveToPlaylist(srcControl, l).then(() => {
                        process();
                    });
                } else
                    process();

            });
        }
    },
    checkboxRule: function () {
        return 'parent_independent';
    }
});
nodeHandlers.playlists = inheritNodeHandler('Playlists', 'PlaylistBase', {
    title: function (node) {
        return _('Playlists');
    },
    hasChildren: true,
    icon: 'playlist',
    viewAs: ['playlistsGridView', 'playlistsListView'],
    multiselect: true,
    getDataSource: function () {
        return app.playlists.root;
    },
    canDrop: function (dataSource, e) {
        let srcObject = dnd.getDragObject(e);
        let datatype = dnd.getDropDataType(e);
        return srcObject && ((datatype == 'playlist'));
    },
    drop: function (dataSource, e, index) {
        let srcObject = dnd.getDragObject(e);
        let datatype = dnd.getDropDataType(e);
        let isCopy = dnd.getDropMode(e) == 'copy';
        let _rootPlaylist = app.playlists.root;
        if (srcObject && (datatype == 'playlist')) {

            let _dropPlaylist = (playlist) => {
                return new Promise(function (resolve, reject) {
                    let _movePlaylist = (pl) => {
                        pl.parent = _rootPlaylist;
                        pl.commitAsync().then(resolve);
                    };

                    if (isCopy) {
                        playlist.createCopyAsync().then(function (dataCopy) {
                            _movePlaylist(dataCopy);
                        });
                    } else {
                        _movePlaylist(playlist);
                    }
                });
            };

            if (srcObject.count) {
                srcObject.whenLoaded().then(() => {
                    _rootPlaylist.beginUpdate();
                    listAsyncForEach(srcObject, (item, next) => {
                        _dropPlaylist(item).then(() => {
                            _rootPlaylist.checkUpdate(1000 /* ms */);
                            next();
                        });
                    }, () => {
                        _rootPlaylist.endUpdate();
                    });
                });
            } else {
                _dropPlaylist(srcObject);
            }
        }
    },
    hideTracklistMenu: true
});

nodeHandlers.autoUpdateParent = inheritNodeHandler('AutoUpdateParent', 'Base', {

    onExpanded: function (node) {        
        if (!node.tag.refreshChildren && !node.canceled) {
            node.tag.refreshChildren = function () {
                nodeUtils.deferredRefresh(node, // deferred - to eliminate cases when 'change' is called too often
                    1500); // 1500 ms (as 'commonChange' is called every 1000 ms during scan/edits)
            };
            if (node.tag._childrenList)
                app.listen(node.tag._childrenList, 'change', node.tag.refreshChildren);
            else
                app.listen(app, 'commonChange', node.tag.refreshChildren); // #19770/1
        }
    },

    onCollapsed: function (node) {
        if (node.tag.refreshChildren) {
            nodeUtils.deferredRefreshCancel(node);
            if (node.tag._childrenList)
                app.unlisten(node.tag._childrenList, 'change', node.tag.refreshChildren);
            else
                app.unlisten(app, 'commonChange', node.tag.refreshChildren);
            node.tag.refreshChildren = undefined;
        }
        node.tag._childrenList = undefined;
    },

});

nodeHandlers.baseLocation = inheritNodeHandler('BaseLocation', 'Base', {
    /*
    defaultViewType: () => {
        // per #15926 - S4
        if (window.isTouchMode)
            return 'grid';
        else
            return 'list';
    },
    */
    hidePropertiesMenu: true, // #16202
    isFolderType: true,
    helpContext: 'Library#Location',
    checkboxRule: function () {
        return 'folder';
    }
});

nodeHandlers.baseFolder = inheritNodeHandler('BaseFolder', 'BaseLocation', {
    viewAs: ['folder_browser', 'folder_listView', 'folder_groupedListView', 'folder_FilesGridView', 'folder_GridView'],
    storeStateKey: 'general_folder', // #15926 - S4    
});

nodeHandlers.folderDropTarget = inheritNodeHandler('FolderDropTarget', 'BaseFolder', {
    getDropMode: function (dataSource, e) {
        return e.ctrlKey ? 'copy' : 'move';
    },
    canDrop: function (dataSource, e) {
        let datatype = dnd.getDropDataType(e);
        let isTracklist = false;
        let srcObject = dnd.getDragObject(e);
        if (srcObject && srcObject.objectType == 'tracklist')
            isTracklist = true; 
        return dnd.isAllowedType(e, datatype) && (!dnd.isSameControl(e) /* #21028 */ || !isTracklist /* #21434 */);
    },
    drop: function (dataSource, e, index) {
        let isCopy = dnd.getDropMode(e) == 'copy';
        let _dropNode = e._dropNode;

        let srcObject = dnd.getDragObject(e);
        let datatype = dnd.getDropDataType(e);
        let dropToDBFolder = !!this.dbContent;

        let doOperation = function (sl, dest, folder) {
            if (dest != '') {

                let taskProgress = app.backgroundTasks.createNew();
                if (isCopy)
                    taskProgress.leadingText = sprintf(_('Copying to %s:'), dest);
                else
                    taskProgress.leadingText = sprintf(_('Moving to %s:'), dest);
                let _onComplete = function () {
                    taskProgress.terminate();
                    actions.view.refresh.execute(); // #15884 / item 2
                };

                if (folder.isPlaylist) {
                    // this is moving a file(s) onto a playlist node under Folders (see issue #17069)
                    let useSL = folder.getTracklist();
                    useSL.whenLoaded().then(() => {
                        useSL.addList(sl);
                        let plFile = useSL.toPlaylist(false, true /* save to file */);
                        app.filesystem.renameFileAsync(plFile, dest, false /* no overwrite prompt */).then(_onComplete);
                    });
                } else {
                    let cloudTracks = false;
                    fastForEach(sl, function (track) {
                        if (track.cacheStatus == cloudTools.CACHE_STREAMED)
                            cloudTracks = true;
                    });
                    if (cloudTracks) {
                        cloudTools.getStreamUrls(sl).then(function () {
                            sl.locked(function () {
                                for (let i = 0; i < sl.count; i++) {
                                    let track = sl.getValue(i);
                                    if (track.cacheStatus == cloudTools.CACHE_STREAMED) {
                                        let remote_path = cloudTools.getRemotePath(track, true);
                                        let mask = dest;
                                        if (remote_path != track.path) // remote path exists -- is different from the stream url
                                            mask = mask + cloudTools.getLastPathPart(remote_path);
                                        else
                                            mask = mask + track.title;
                                        app.trackOperation.downloadFile(track, mask); // inits download of this track (adds to download queue)        
                                    }
                                }
                                _onComplete();
                            });
                        });
                    } else {
                        if (isCopy)
                            app.filesystem.copyFilesAsync(sl, dest, dropToDBFolder).then(_onComplete);
                        else
                            app.filesystem.renameFilesAsync(sl, dest).then(_onComplete);
                    }
                }
            }
        };

        let doFolderOperation = function (srcPath, dstPath, isDBFolder) {

            if (srcPath == dstPath) // #17301
                return;

            let _refresh = () => {
                if (_dropNode) {
                    nodeUtils.refreshNodeChildren(_dropNode);
                    if (_dropNode.parent)
                        nodeUtils.refreshNodeChildren(_dropNode.parent);
                }
                if (window.clipboard && window.clipboard.srcNode)
                    nodeUtils.refreshNodeChildren(window.clipboard.srcNode.parent);

                if (!isCopy)
                    uitools.refreshView(1000); // to refresh also the drag from area (if not refreshed automatically)
            };

            if (isDBFolder) {

                let heading = sprintf(_('Do you really want to move \'%s\'?'), [srcPath]);
                if (isCopy)
                    heading = sprintf(_('Do you really want to copy \'%s\'?'), [srcPath]);

                let checkboxes = undefined;
                if (isDBFolder) {
                    if (isCopy) {
                        checkboxes = {
                            1: {
                                text: _('Copy Library content only'),
                                retvals: ['library']
                            },
                            2: {
                                text: _('Copy all content'),
                                retvals: ['library', 'computer']
                            }
                        };
                    } else {
                        checkboxes = {
                            1: {
                                text: _('Move Library content only'),
                                retvals: ['library']
                            },
                            2: {
                                text: _('Move all content'),
                                retvals: ['library', 'computer']
                            }
                        };
                    }
                }

                uitools.showDeleteDlg({
                    confType: 'folder',
                    heading: heading,
                    checkboxes: checkboxes
                }).then(function (retvals) {
                    if (retvals) {
                        app.filesystem.copyFolderAsync(srcPath, dstPath, {
                            move: !isCopy,
                            db: isDBFolder,
                            all: inArray('computer', retvals)
                        }).then1(function () {
                            _refresh();
                        });
                    }
                });
            } else {
                app.filesystem.copyFolderAsync(srcPath, dstPath, {
                    move: !isCopy,
                    db: isDBFolder
                }).then1(function () {
                    _refresh();
                });
            }

        };

        let process = function (sl) {
            if (dataSource.getPathAsync) {
                dataSource.getPathAsync().then(function (path) {
                    doOperation(sl, path, dataSource);
                });
            } else {
                doOperation(sl, dataSource.path, dataSource);
            }
        };

        let processFolder = function (srcObject, dataSource) {

            let isDBFolder = srcObject.objectType === 'dbfolder';
            let srcPath = '';
            let dstPath = '';
            let ar = [];

            if (srcObject.getPathAsync) {
                ar.push(srcObject.getPathAsync().then(function (path) {
                    srcPath = path;
                }));
            } else {
                srcPath = srcObject.path;
            }

            if (dataSource.getPathAsync) {
                ar.push(dataSource.getPathAsync().then(function (path) {
                    dstPath = path;
                }));
            } else {
                dstPath = dataSource.path;
            }

            whenAll(ar).then(function () {
                doFolderOperation(srcPath, dstPath, isDBFolder);
            });
        };

        if (srcObject && dnd.isAllowedType(e, datatype)) {

            let _process = () => {

                let firstItem = srcObject;
                if (srcObject.count)
                    firstItem = getValueAtIndex(srcObject, 0);

                if (firstItem.objectType === 'folder' || firstItem.objectType === 'dbfolder') {
                    if (srcObject.count) {
                        listForEach(srcObject, (item) => {
                            processFolder(item, dataSource);
                        });
                    } else {
                        processFolder(srcObject, dataSource);
                    }
                } else {
                    if (srcObject.getTracklist) {
                        srcObject.getTracklist().whenLoaded().then(function (list) {
                            process(list);
                        });
                    } else if (srcObject.whenLoaded) { // it's list
                        dnd.getTracklistAsync(srcObject).then(function (sl) {
                            process(sl);
                        });
                    } else {
                        process(srcObject);
                    }
                }
            };

            if (srcObject.whenLoaded) {
                srcObject.whenLoaded().then(() => {
                    _process();
                });
            } else {
                _process();
            }
        }
    },
});

nodeHandlers.podcast = inheritNodeHandler('Podcast', 'Base', {
    title: function (node) {
        return node.dataSource.title;
    },
    icon: 'podcast',
    helpContext: 'Podcasts',
    viewAs: ['episodes', 'podcast_tracklist'],
    canDelete: true,
    deleteText: function (node) {
        return _('&Unsubscribe');
    },
    deleteItems: function (nodes) {
        nodes.forEach(function (node) {
            uitools.unsubscribePodcast(node.dataSource);
        });
    },
    menu: function (node) {
        let podcast = node.dataSource;
        let res = [];
        res.push({
            action: bindAction(window.actions.updatePodcast, podcast),
            order: 10,
            grouporder: 10
        });
        res.push({
            action: {
                title: function () {
                    if (podcast.podcastURL)
                        return _('Unsubscribe');
                    else
                        return _('Remove');
                },
                icon: 'delete',
                execute: function () {
                    uitools.unsubscribePodcast(podcast);
                }
            },
            order: 20,
            grouporder: 10
        });
        res.push({
            action: {
                title: function () {
                    return _('Edit');
                },
                icon: 'edit',
                execute: function () {
                    uitools.editPodcast(podcast);
                }
            },
            order: 30,
            grouporder: 10
        });
        res.push({
            action: bindAction(window.actions.updatePodcastImage, podcast),
            order: 40,
            grouporder: 10
        });
        res.push({
            action: bindAction(window.actions.pin, podcast),
            order: 50,
            grouporder: 10,
        });
        res.push({
            action: bindAction(window.actions.unpin, podcast),
            order: 60,
            grouporder: 10
        });
        res.push({
            action: actions.updatePodcasts,
            order: 10,
            grouporder: 20
        });
        res.push({
            action: actions.subscribePodcast,
            order: 20,
            grouporder: 20
        });
        return res;
    },
    hideDefaultMenu: true
});
nodeHandlers.subscriptions = inheritNodeHandler('Subscriptions', 'Observable', {
    title: function (node) {
        return _('Subscriptions');
    },
    helpContext: 'Podcasts',
    hasChildren: function (node) {
        return app.podcasts.isAnyPodcastSubscribed();
    },
    getChildren: function (node) {
        let list = app.podcasts.getPodcastListBySQL('SELECT Podcasts.* FROM Podcasts WHERE PodcastURL <> \'\' ORDER BY PodcastName');
        return nodeUtils.fillFromList(node, list as unknown as SharedUIList<SharedObservable>, 'podcast');
    },
    onExpanded: function (node) {
        node.tag.onPodcastAdded = function (oper) {
            if (oper == 'insert' || oper == 'delete')
                nodeUtils.deferredRefresh(node);
        };
        app.listen(app.podcasts, 'change', node.tag.onPodcastAdded);
    },
    onCollapsed: function (node) {
        nodeUtils.deferredRefreshCancel(node);
        app.unlisten(app.podcasts, 'change', node.tag.onPodcastAdded);
    },
    icon: 'podcast',
    getViewDataSource: function (view: ViewData, dataSourceType: string) {
        if (dataSourceType == 'tracklist') {
            let coll = nodeUtils.getNodeCollection(view.viewNode);
            if (coll)
                return coll.getTracklist();
        }
    },
    viewAs: ['subscriptionList', 'tracklist', 'groupedTracklist'],
    menu: [{
        action: actions.subscribePodcast,
        order: 10,
        grouporder: 10
    }, {
        action: actions.updatePodcasts,
        order: 20,
        grouporder: 10
    }],
    toolbarActions: [actions.subscribePodcast, actions.updatePodcasts],
});
nodeHandlers.subscriptionTutorial = inheritNodeHandler('SubscriptionTutorial', 'Subscriptions', {
    viewAs: ['podcastSubscribeTutorial']
});
nodeHandlers.unsubscribed = inheritNodeHandler('Unsubscribed', 'Observable', {
    title: function (node) {
        return _('Unsubscribed');
    },
    helpContext: 'Podcasts',
    hasChildren: function (node) {
        return app.podcasts.isAnyPodcastUnsubscribed();
    },
    getChildren: function (node) {
        let list = app.podcasts.getPodcastListBySQL('SELECT Podcasts.* FROM Podcasts WHERE PodcastURL = \'\' ORDER BY PodcastName');
        return nodeUtils.fillFromList(node, list as unknown as SharedUIList<SharedObservable>, 'podcast');
    },
    onExpanded: function (node) {
        node.tag.onPodcastAdded = function (oper) {
            if (oper == 'insert' || oper == 'delete')
                nodeUtils.deferredRefresh(node);
        };
        app.listen(app.podcasts, 'change', node.tag.onPodcastAdded);
    },
    onCollapsed: function (node) {
        nodeUtils.deferredRefreshCancel(node);
        app.unlisten(app.podcasts, 'change', node.tag.onPodcastAdded);
    },
    icon: 'delete',
    viewAs: ['subscriptionList'],
    menu: [{
        action: actions.subscribePodcast,
        order: 10,
        grouporder: 10
    }],
    toolbarActions: [actions.subscribePodcast],
});
nodeHandlers.podcastDirectory = inheritNodeHandler('PodcastDirectory', 'Base', {
    helpContext: 'Podcasts',
    title: function (node) {
        return node.dataSource.title;
    },
    setTitle: function (node, newTitle) {
        node.dataSource.title = newTitle;
        node.dataSource.commitAsync();
    },
    icon: 'rss',
    hasChildren: function (node) {
        return node.dataSource.hasChildren;
    },
    getChildren: function (node) {
        return nodeUtils.fillFromList(node, node.dataSource.getChildren(), 'podcastDirectory');
    },
    viewAs: ['feedlist'],
    menu: [actions.subscribePodcast, actions.updatePodcasts],
    canDelete: true,
    deleteItems: function (nodes) {
        nodes.forEach(function (node) {
            let message = sprintf(_('Are you sure you want to remove "%s" ?'), escapeXml(node.dataSource.title));
            messageDlg(message, 'Confirmation', ['btnYes', 'btnNo'], {
                defaultButton: 'btnYes'
            }, function (result) {
                if (result.btnID === 'btnYes')
                    node.dataSource.removeAsync();
            });
        });
    },
    formatStatus: function (data) {
        return statusbarFormatters.formatDefaultSimpleStatus(data, function (cnt) {
            return _('folder', 'folders', cnt);
        });
    }
});
nodeHandlers.podcastDirectories = inheritNodeHandler('PodcastDirectories', 'Observable', {
    helpContext: 'Podcasts',
    title: function (node) {
        return _('Podcast Directories');
    },
    hasChildren: true,
    getChildren: function (node) {
        return nodeUtils.fillFromList(node, node.dataSource.getPodcastDirectories(), 'podcastDirectory');
    },
    icon: 'rss',
    viewAs: ['nodeList'],
    toolbarActions: [actions.subscribePodcast, actions.updatePodcasts, actions.addPodcastDir],
    menu: [actions.addPodcastDir, actions.subscribePodcast, actions.updatePodcasts],
    hideDefaultMenu: true
});
nodeHandlers.newEpisodes = inheritNodeHandler('NewEpisodes', 'Base', {
    helpContext: 'Podcasts',
    title: function (node) {
        return _('Unplayed');
    },
    icon: 'listview',
    viewAs: ['newEpisodes'],
    toolbarActions: [actions.subscribePodcast, actions.updatePodcasts],
});
nodeHandlers.loading = inheritNodeHandler('Loading', 'Base', {
    title: function (node) {
        return _('Loading') + '...';
    },
    defaultPosition: 0,
    icon: 'progress'
});
nodeHandlers.folder = inheritNodeHandler('Folder', 'FolderDropTarget', {
    title: function (node) {
        return node.dataSource.title;
    },
    setTitle: function (node, value) {
        node.dataSource.title = value;
    },
    helpContext: 'My Computer',
    icon: function (node) {
        if (node.dataSource.getIcon)
            return node.dataSource.getIcon();
        else
            return 'folder';
    },
    hasChildren: function (node) {
        return (node.dataSource.hasSubfolders);
    },
    getChildren: function (node) {
        return nodeUtils.fillFromList(node, node.dataSource.getFolderList(), 'folder');
    },
    onExpanded: function (node) {
        if (!node.tag.refreshChildren && !node.canceled) {
            node.tag.refreshChildren = function (e) {
                // e.g. when a track.path changed (or all tracks were deleted from the folder)
                let n = node;
                while (n) {
                    nodeUtils.deferredRefresh(n, // deferred - to eliminate cases when 'change' is called too often
                        1500); // 1500 ms (as 'commonChange' is called every 1000 ms during scan/edits)
                    n = n.parent;
                }
            };
            app.listen(app, 'commonChange', node.tag.refreshChildren);
        }
    },
    onCollapsed: function (node) {
        if (node.tag.refreshChildren) {
            nodeUtils.deferredRefreshCancel(node);
            app.unlisten(app, 'commonChange', node.tag.refreshChildren);
            node.tag.refreshChildren = undefined;
        }
    },
    getViewDataSource: function (view: ViewData) {
        let folder = view.viewNode.dataSource;
        /* removed per last suggestions in #16483
        if (!uitools.globalSettings.hideCompFoldersToast && view.viewNode.parent) { // to exclude pinned folders
            var parent = view.viewNode.parent;
            parent.tag = parent.tag || {};
            if ((parent.handlerID != 'folder') && !parent.tag._compFoldersToastShown) {
                parent.tag._compFoldersToastShown = true;
                if (!window.qUnit) {
                    var link = '<a data-id="link" class="hotlink clickable inline" data-control-class="Control">' + _('library Location node') + '</a>';
                    var msg = sprintf(_('The Folders node only displays/edits metadata in file tags. To view/edit metadata that is in the database, use the %s'), link);
                    uitools.toastMessage.show(msg, {
                        onLinkClick: () => {
                            folder.getPathAsync().then((path) => {
                                var track = app.utils.createEmptyTrack();
                                track.path = path;
                                navigationHandlers['dbFolder'].navigate(track);
                            });
                        },
                        onCloseClick: () => {
                            uitools.globalSettings.hideCompFoldersToast = true;
                        },
                        delay: 10000
                    });
                }
            }
        }
        */
        return folder.getTracklist(window.includeSubfoldersInLocations || false);
    },
    multiselect: true,
    canDelete: true,
    forbiddenAutoSearch: true, // do not use automatic search  here, #16044
    deleteItems: function (nodes, permanent) {
        let nodeTitle = '';
        let count = nodes.count;
        if (count == 1) {
            nodes.locked(function () {
                nodeTitle = nodes.getValue(0).dataSource.title;
            });
        }

        let device = nodeUtils.getNodeDevice(getValueAtIndex(nodes, 0));
        if (device)
            permanent = true;

        let message;
        if (permanent) {
            message = _('Are you sure you want to permanently delete ');
            if (count > 1)
                message = message + ' ' + _('selected folders');
            else
                message = message + ' ' + nodeTitle;
            message = message + '?';
        } else {
            if (count > 1)
                message = _('Are you sure you want to move the selected folders to the recycle bin?');
            else
                message = sprintf(_('Are you sure you want to move the folder "%s" to the recycle bin?'), escapeXml(nodeTitle));
        }

        messageDlg(message, 'Confirmation', ['btnYes', 'btnNo'], {
            defaultButton: 'btnYes'
        }, function (result) {
            if (result.btnID === 'btnYes') {
                let promises = [];
                let sl = newStringList();
                nodes.forEach(function (node) {
                    if (node.dataSource.path) // e.g. "My computer" folders
                        sl.add(node.dataSource.path);
                    else
                    if (node.dataSource.getPathAsync) { // e.g. db folders
                        promises.push(node.dataSource.getPathAsync().then(function (path) {
                            sl.add(path);
                        }));
                    }
                });
                let toRecycleBin = true;
                if (permanent)
                    toRecycleBin = false;
                whenAll(promises).then(function () {

                    let pr;
                    if (device)
                        pr = device.deleteFoldersAsync(sl);
                    else
                        pr = app.filesystem.deleteFolderAsync(sl, toRecycleBin);

                    pr.then(function (deleted) {
                        if (deleted) {
                            nodes.forEach(function (node) {
                                node.dataSource.deleted = true;
                            });
                        }
                    });
                });
            }
        });
    },
    formatStatus: function (data) {
        return statusbarFormatters.formatDefaultSimpleStatus(data, function (cnt) {
            return _('folder', 'folders', cnt);
        });
    },
    includeSubfoldersSupport: true,
    filterSupport: false,
    //orderColumnSupport: true,
    //requiredColumns: 'playOrder',
    storeColumnsSupported: (node) => {
        if (node.dataSource.isPlaylist)
            return false;
        else
            return true;
    },
    defaultColumnSort: (node) => {
        if (node.dataSource.isPlaylist)
            return 'playOrder ASC';
        else
            return '';
    },
    menu: function (node) {
        return [{
            action: actions.scan,
            order: 10,
            grouporder: 10
        }, {
            action: actions.openExplorer,
            order: 20,
            grouporder: 10
        }, {
            action: bindAction(window.actions.newFolderNode, node),
            order: 30,
            grouporder: 10
        }];
    }
});
nodeHandlers.drive = inheritNodeHandler('Drive', 'FolderDropTarget', {
    title: function (node) {
        return node.dataSource.title;
    },
    helpContext: 'My Computer',
    hasChildren: true,
    getChildren: function (node) {
        return nodeUtils.fillFromList(node, node.dataSource.getFolderList(), 'folder');
    },
    icon: 'drive',
    formatStatus: function (data) {
        return statusbarFormatters.formatDefaultSimpleStatus(data, function (cnt) {
            return _('folder', 'folders', cnt);
        });
    },
    menu: function (node) {
        return [{
            action: actions.scan,
            order: 10,
            grouporder: 10
        }, {
            action: actions.openExplorer,
            order: 20,
            grouporder: 10
        }, {
            action: bindAction(window.actions.newFolderNode, node),
            order: 30,
            grouporder: 10
        }];
    }
});
nodeHandlers.optical_drive = inheritNodeHandler('OpticalDrive', 'Drive', {
    title: function (node) {
        return node.dataSource.title || _('Audio CD');
    },
    helpContext: 'Ripping_Tracks_from_CDs',
    hasChildren: function (node) {
        return (node.dataSource.hasSubfolders);
    },
    icon: 'cd',
    viewAs: ['folder_browser', 'folder_listView', 'folder_groupedListView'],
    defaultColumnSort: 'order ASC', // #16533
    getDefaultColumns: function () {
        return ['order', 'title', 'artist', 'album', 'genre', 'length', 'path']; // #16533
    },
    getStateRootKey: function () {
        return 'CONTROLS_STATE_CD';
    },
    menu: function (node) {
        let aRip = copyObject(actions.ripCD);
        aRip.driveLetter = node.dataSource.driveLetter;
        let aCDDB = copyObject(actions.getCDInfo);
        aCDDB.driveLetter = node.dataSource.driveLetter;
        let aEject = copyObject(actions.ejectDrive);
        aEject.driveLetter = node.dataSource.driveLetter;
        return [{
            action: aRip,
            order: 10,
            grouporder: 10
        }, {
            action: aCDDB,
            order: 20,
            grouporder: 10
        }, {
            action: aEject,
            order: 30,
            grouporder: 10
        }];
    },
    readOnlyContent: true,
    temporal: true
});
nodeHandlers.localComputer = inheritNodeHandler('LocalComputer', 'BaseLocation', {
    title: function (node) {
        return _('Folders');
    },
    helpContext: 'My Computer',
    hasChildren: true,
    _addUserFolder: function (node) {
        let userFolderPath = app.filesystem.getUserFolder();
        let userFolder = app.filesystem.getFolderFromString(userFolderPath);
        if (userFolder) {
            userFolder.hasSubfolders = true;
            node.addChild(userFolder, 'folder');
        }
    },
    getChildren: function (node) {
        return new Promise(function (resolve, reject) {
            node.loadPromise = app.filesystem.getDriveList().whenLoaded();
            node.loadPromise.then(function (list) {

                // LS: add user folder at first (per #17557 spec)
                this._addUserFolder(node);

                list.forEach(function (drive) {
                    if (!node.canceled) {
                        if (drive.driveType == 'optical_drive')
                            node.addChild(drive, 'optical_drive');
                        else
                            node.addChild(drive, 'drive');
                    }
                });
                if (!node.canceled && this._addNetwork)
                    this._addNetwork(node);
                if (!node.canceled && this._addDevices)
                    this._addDevices(node).then(() => {
                        if (!node.canceled && this._addMediaServers)
                            this._addMediaServers(node).then(resolve);
                        else
                            resolve();
                    });
                else
                    resolve();
            }.bind(this), resolve);
        }.bind(this));
    },
    icon: 'computer',
    viewAs: ['nodeList', 'rowNodeList'],
    onExpanded: function (node) {
        node.tag.onDevicesChange = function () {
            nodeUtils.deferredRefresh(node); // deffered - when there is many devices/servers added just during startup in one second -- to reduce unnecessary refreshNodeChildren() calling     
        };
        if (this._addDevices)
            app.listen(app.devices.getAll(), 'change', node.tag.onDevicesChange); // to refresh once a device or a cloud storage is added/removed
        if (this._addMediaServers)
            app.listen(app.sharing.getRemoteServers(), 'change', node.tag.onDevicesChange); // to refresh once a server is connected/disconnected
        app.listen(app.filesystem.getDriveList(), 'change', node.tag.onDevicesChange); // to refresh when e.g. Audio CD is inserted
    },
    onCollapsed: function (node) {
        nodeUtils.deferredRefreshCancel(node);
        if (this._addDevices)
            app.unlisten(app.devices.getAll(), 'change', node.tag.onDevicesChange);
        if (this._addMediaServers)
            app.unlisten(app.sharing.getRemoteServers(), 'change', node.tag.onDevicesChange);
        app.unlisten(app.filesystem.getDriveList(), 'change', node.tag.onDevicesChange);
        node.tag.onDevicesChange = undefined;
    },
    menu: [],
});
nodeHandlers.localComputerWithNetwork = inheritNodeHandler('LocalComputerWithNetwork', 'LocalComputer', {
    _addNetwork: function (node) {
        node.addChild(null, 'network');
    },
});
nodeHandlers.computer = inheritNodeHandler('Computer', 'LocalComputerWithNetwork', {
    _addDevices: function (node) {
        return nodeUtils.getDevicesBy(node, {
            handler: 'cloud',
            onlyFolderBased: true,
            /*
            onlySyncable: true,
            exceptHandler: 'server' // LS: to not show syncable servers, they are added in _addMediaServers below
            */
        }, 'deviceAsFolders');
    },
    _addMediaServers: function (node) {
        // media servers added per suggestions in #13971 - item 2)
        return new Promise<void>(function (resolve, reject) {
            let list = app.sharing.getRemoteServers();
            node.loadPromise = list.whenLoaded();
            list.whenLoaded().then(function () {
                node.addChildren(list, 'mediaServer');
                resolve();
            }, resolve);
        });
    },
    menu: [{
        action: actions.addLocation,
        order: 10,
        grouporder: 10
    }],
    /* // LS: removed per last suggestions in #16483
    tooltip: () => {
        return sprintf(_('The Folders node only displays/edits metadata in file tags. To view/edit metadata that is in the database, use the %s'), _('library Location node'));
    },
    */
    toolbarActions: [actions.addLocation],
});
nodeHandlers.network = inheritNodeHandler('Network', 'Base', {
    title: function (node) {
        return _('Network');
    },
    hasChildren: true,
    hideCheckbox: true,
    getChildren: function (node) {
        return new Promise<void>(function (resolve, reject) {
            let list = app.filesystem.getNetworkResourceList();
            node.loadPromise = list.whenLoaded();
            node.loadPromise.then(function () {
                list.forEach(function (res) {
                    if (res.getType() == 'networkResource')
                        node.addChild(res, 'networkResource');
                    else
                        node.addChild(res, 'folder');
                });
                resolve();
            }, resolve);
        });
    },
    icon: 'network',
    viewAs: ['nodeList'],
    menu: [{
        action: actions.addNetworkLocation,
        order: 10,
        grouporder: 10
    }],
    toolbarActions: [actions.addNetworkLocation],
});
nodeHandlers.networkResource = inheritNodeHandler('NetworkResource', 'Base', {
    title: function (node) {
        return node.dataSource.title;
    },
    hasChildren: true,
    hideCheckbox: true,
    getChildren: function (node) {
        return new Promise<void>(function (resolve, reject) {
            let list = node.dataSource.getChildren();
            node.loadPromise = list.whenLoaded();
            node.loadPromise.then(function () {
                list.forEach(function (res) {
                    if (res.getType() == 'networkResource')
                        node.addChild(res, 'networkResource');
                    else
                        node.addChild(res, 'folder');
                });
                resolve();
            }, resolve);
        });
    },
    icon: 'network',
    viewAs: ['nodeList'],
    canDelete: true,
    deleteItems: function (nodes) {
        let resourceName = '';
        let count = nodes.count;
        if (count == 1) {
            nodes.locked(function () {
                resourceName = nodes.getValue(0).dataSource.title;
            });
        }

        let message;
        if (count == 1) {
            message = sprintf(_('Are you sure you want to remove "%s"?'), escapeXml(resourceName));
        } else {
            message = sprintf(_('Are you sure you want to remove %d selected items?'), count);
        }

        messageDlg(message, 'Confirmation', ['btnYes', 'btnNo'], {
            defaultButton: 'btnYes'
        }, function (result) {
            if (result.btnID === 'btnYes') {
                let del = function (node) {
                    app.filesystem.deleteNetworkResourceAsync(node.dataSource);
                };
                nodes.forEach(function (node) {
                    del(node);
                });
            }
        });
    },
});
nodeHandlers.track = inheritNodeHandler('Track', 'Base', {
    title: function (node) {
        if (node.dataSource) {
            let id = node.dataSource.trackTypeStringId;
            if (id === 'radio') return node.dataSource.album || node.dataSource.title;
        }
        return node.dataSource.title;
    },
    icon: function (node) {
        if (node.dataSource) {
            let id = node.dataSource.trackTypeStringId;
            if (id === 'radio') return 'radio';
        }
        return 'song';
    },
    filterSupport: false,
    viewAs: ['tracklist']
});
nodeHandlers.tracks = inheritNodeHandler('Tracks', 'Base', {
    title: function (node) {
        return _('All files');
    },
    icon: 'song',
    viewAs: ['tracklist', 'groupedTracklist', 'albumlist']
});
nodeHandlers.videos = inheritNodeHandler('Videos', 'Base', {
    title: function (node) {
        return _('All videos');
    },
    icon: 'video',
    viewAs: ['videoGrid', 'tracklist', 'seriesGroupedTracklist'],
    formatStatus: function (data) {
        return statusbarFormatters.formatDefaultSimpleStatus(data, function (cnt) {
            return _('video', 'videos', cnt);
        });
    },
    getDefaultColumns: function () {
        return ['title', 'director', 'length', 'series', 'path'];
    }
});
nodeHandlers.downloads = inheritNodeHandler('Downloads', 'Base', {
    title: function (node) {
        let res =  _('Downloads');
        let count = app.downloader.getDownloadsCount();
        if (count > 0)         
            res = res + ' (' + count + ')';
        return res;
    },
    icon: () => {
        if (app.downloader.anyDownloadInProgress())
            return 'progress';
        else
            return 'download';
    },
    viewAs: ['downloader'],
    defaultPosition: 5,
    menu: [{
        action: actions.pauseAllDownloads,
        order: 10,
        grouporder: 5
    }, {
        action: actions.resumeAllDownloads,
        order: 20,
        grouporder: 5
    }, {
        action: actions.cancelAllDownloads,
        order: 30,
        grouporder: 5
    }],
    temporal: true
});
nodeHandlers.serverContainer = inheritNodeHandler('ServerContainer', 'BaseFolder', {
    title: function (node) {
        return node.dataSource.name;
    },
    icon: function (node) {
        let res = 'folder';
        let cls = node.dataSource.upnpclass;
        if (cls.indexOf('object.container.playlistContainer') == 0)
            res = 'playlist';
        if ((cls.indexOf('object.container.person') == 0) || (cls.indexOf('object.container.artist') == 0))
            res = 'artist';
        if (cls.indexOf('object.container.album') == 0)
            res = 'album';
        if (cls.indexOf('object.container.genre') == 0)
            res = 'genre';
        return res;
    },
    hasChildren: true,
    canDelete: function (node) {
        if (node && (node.dataSource.upnpclass.indexOf('object.container.playlistContainer') == 0) && nodeUtils.getNodeDevice(node))
            return true;
    },
    deleteItems: function (nodes) {

        let node = nodeUtils.getFirstNode(nodes);
        if (!node)
            return;

        let device = nodeUtils.getNodeDevice(node);
        if (!device)
            return;

        let handler = mediaSyncHandlers[device.handler_id];
        let syncHandler = mediaSyncHandlers[device.handlerID];
        if (syncHandler && syncHandler.deletePlaylist) {

            let container = node.dataSource;
            let message;
            if (nodes.count == 1) {
                message = sprintf(_('Are you sure you want to remove playlist "%s" from %s?'), escapeXml(container.name), escapeXml(device.name));
            } else {
                message = sprintf(_('Are you sure you want to remove %d selected playlists from %s?'), nodes.count, escapeXml(device.name));
            }

            messageDlg(message, 'Confirmation', ['btnYes', 'btnNo'], {
                defaultButton: 'btnYes'
            }, function (result) {
                if (result.btnID === 'btnYes') {
                    let promises = [];
                    let parent;
                    let del = function (node) {
                        promises.push(syncHandler.deletePlaylist(device, {
                            path: container.fullName,
                            uuid: container.uuid
                        }));
                        parent = node.parent;
                    };
                    nodes.forEach(function (node) {
                        del(node);
                    });
                    whenAll(promises).then(function () {
                        nodeUtils.refreshNodeChildren(parent);
                    });
                }
            });
        }
    },
    getChildren: function (node) {
        nodeUtils.cancelNode(node.parent); // LS: it is better to cancel loading of parent children (otherwise it would block further reading unnecessarily)        
        return nodeUtils.fillFromList(node, node.dataSource.getContainers(), 'serverContainer');
    },
    defaultColumnSort: 'none', // to respect order served (#13941)
    storeColumnsSupported: false,
    formatStatus: function (data) {
        return statusbarFormatters.formatDefaultSimpleStatus(data, function (cnt) {
            return _('folder', 'folders', cnt);
        });
    },
});
nodeHandlers.mediaServer = inheritNodeHandler('MediaServer', 'ServerContainer', {
    title: function (node) {
        return node.dataSource.name;
    },
    icon: 'server',
    helpContext: 'Exporting Tracks',
    hideDefaultMenu: true,
    hasChildren: function (node) {
        // to not show children for syncable servers in Add/Resacn dialog
        requirejs('helpers/mediaSync');
        return !mediaSyncHandlers['server']._isSyncableServer(node.dataSource);
    },
    menu: function (node) {
        let _getBound = () => {
            return node.dataSource;
        };
        return [{
            action: bindAction(window.actions.configureRemoteAccess, _getBound),
            order: 10,
            grouporder: 10
        }, {
            action: bindAction(window.actions.removeServer, _getBound),
            order: 20,
            grouporder: 10
        }, {
            action: bindAction(window.actions.serverInfo, _getBound),
            order: 30,
            grouporder: 10
        }];
    }
});
nodeHandlers.servers = inheritNodeHandler('Servers', 'Base', {
    title: function (node) {
        return _('Media Servers');
    },
    helpContext: 'Setting UPnP DLNA Media Servers',
    hasChildren: true,
    getChildren: function (node) {
        return new Promise<void>(function (resolve, reject) {
            let list = app.sharing.getRemoteServers();
            node.loadPromise = list.whenLoaded();
            list.whenLoaded().then(function () {
                if (list.count > 0)
                    node.addChildren(list, 'mediaServer');
                else
                    node.addChild(node.dataSource, 'noServerFound');
                resolve();
            }, resolve);
        });
    },
    icon: 'server',
    viewAs: ['serverList', 'nodeList'],
    menu: [{
        action: actions.addMediaServer,
        order: 10,
        grouporder: 10
    }, {
        action: actions.shareMedia,
        order: 20,
        grouporder: 10
    }]
});
nodeHandlers.noServerFound = inheritNodeHandler('NoServerFound', 'Base', {
    title: function (node) {
        return _('No server available, try later');
    },
    icon: 'none'
});
nodeHandlers.cloudFolder = inheritNodeHandler('CloudFolder', 'BaseFolder', {
    title: function (node) {
        return node.dataSource.title;
    },
    icon: 'folder',
    hasChildren: function (node) {
        let service = node.dataSource.service || mediaSyncHandlers.cloud.getService(node.dataSource);
        if (service)
            return service.isAuthorized();
        else
            return false;
    },
    getChildren: function (node) {
        return new Promise<void>(function (resolve, reject) {
            let service;
            let device_id;
            if (node.dataSource.objectType == 'device') {
                service = mediaSyncHandlers.cloud.getService(node.dataSource);
                device_id = node.dataSource.id;
            } else {
                service = node.dataSource.service;
                device_id = node.dataSource.device_id;
            }
            if (!service)
                resolve();
            else
                service.listContent(node.dataSource.path).then(
                    function (content) {
                        for (let i = 0; i < content.folders.count; i++) {
                            let folder = content.folders.getValue(i);
                            let dataSource = {
                                service: service,
                                title: folder.title,
                                path: folder.path,
                                id: folder.title,
                                device_id: device_id,
                                persistentInfo: { // to be stored in navigation history
                                    path: folder.path
                                }
                            };
                            node.addChild(dataSource, 'cloudFolder');
                        }
                        resolve();
                    },
                    function (err) {
                        ODS(service.title + ': ' + err);
                        reject();
                    }
                );
        });
    },
    getViewDataSource: function (view: ViewData) {
        let dataSource = view.viewNode.dataSource;
        let list = app.utils.createTracklist();
        let service = dataSource.service || mediaSyncHandlers.cloud.getService(dataSource);
        if (service && service.isAuthorized()) {
            service.listContent(dataSource.path, list).then(
                function (content) {
                    if (list.count == 0)
                        list.addList(content.files);
                    list.globalModifyWatch = true; // to update highlighting of playing track etc.

                    let device = mediaSyncDevices.getById(dataSource.device_id);
                    if (device)
                        mediaSyncHandlers.cloud._assignTracksMetadata(device, list);
                    else
                        list.notifyLoaded();
                },
                function () {
                    list.notifyLoaded();
                }
            );
        } else
            list.notifyLoaded();
        return list;
    },
});
nodeHandlers.cloudFolders = inheritNodeHandler('CloudFolders', 'CloudFolder', {
    title: function (node) {
        return _('Folders');
    }
});
nodeHandlers.cloudPlaylistBase = inheritNodeHandler('CloudPlaylistBase', 'Base', {
    icon: 'playlist',
    orderColumnSupport: true,
    defaultColumnSort: 'playOrder ASC',
    getChildren: function (node) {
        return new Promise<void>(function (resolve, reject) {
            let device = nodeUtils.getNodeDevice(node);
            let parent_playlist;
            if (node.dataSource.objectType != 'device')
                parent_playlist = node.dataSource;
            mediaSyncHandlers[device.handlerID].listPlaylists(device, parent_playlist, {
                purpose: 'list',
                device: device
            }).then(
                function (playlists) {
                    for (let i = 0; i < playlists.count; i++) {
                        let playlist = playlists.getValue(i);
                        node.addChild(playlist, 'cloudPlaylist');
                    }
                    resolve();
                },
                reject);
        });
    }
});
nodeHandlers.cloudPlaylist = inheritNodeHandler('CloudPlaylist', 'CloudPlaylistBase', {
    title: function (node) {
        return node.dataSource.name;
    },
    hasChildren: function (node) {
        return node.dataSource.hasChildren;
    },
    getViewDataSource: function (view: ViewData) {
        let playlist = view.viewNode.dataSource;
        let device = nodeUtils.getNodeDevice(view.viewNode);
        return mediaSyncHandlers[device.handlerID].listPlaylistContent(device, playlist);
    },
    canDelete: true,
    deleteItems: function (nodes) {
        let count = nodes.count;
        if (count <= 0)
            return;

        let device;
        let firstPL;
        nodes.locked(function () {
            let node = nodes.getValue(0);
            device = nodeUtils.getNodeDevice(node);
            firstPL = node.dataSource;
        });
        let service = firstPL.service;
        if (!service)
            return;

        let deleteFunct;
        let flushFunct;
        if (service.deletePlaylist)
            deleteFunct = service.deletePlaylist.bind(service);
        else {
            let ms = mediaSyncDevices.getMetadataStorage(device);
            if (!ms.bypass) {
                deleteFunct = ms.deletePlaylist.bind(ms);
                flushFunct = ms.flush.bind(ms);
            }
        }

        if (!deleteFunct)
            return;

        let message;
        if (count == 1) {
            message = sprintf(_('Are you sure you want to remove playlist "%s" from %s?'), escapeXml(firstPL.name), escapeXml(service.title));
        } else {
            message = sprintf(_('Are you sure you want to remove %d selected playlists from %s?'), count, escapeXml(service.title));
        }

        messageDlg(message, 'Confirmation', ['btnYes', 'btnNo'], {
            defaultButton: 'btnYes'
        }, function (result) {
            if (result.btnID === 'btnYes') {
                let promises = [];
                let parent;
                let del = function (node) {
                    promises.push(deleteFunct(node.dataSource));
                    parent = node.parent;
                };
                nodes.forEach(function (node) {
                    del(node);
                });
                whenAll(promises).then(function () {
                    nodeUtils.refreshNodeChildren(parent);
                    if (flushFunct)
                        flushFunct();
                });
            }
        });
    },
    viewAs: ['folder_listView', 'folder_groupedListView', 'folder_GridView'],
});
nodeHandlers.cloudPlaylists = inheritNodeHandler('CloudPlaylists', 'CloudPlaylistBase', {
    title: function (node) {
        return _('Playlists');
    },
    viewAs: ['nodeList', 'rowNodeList']
});
nodeHandlers.search = inheritNodeHandler('Search', 'Base', {
    title: function (node) {
        let txt = '';
        if (node.dataSource && (node.parent.handlerID != 'collection' /* #15549, #12371 - item 6 */)) {
            if (!node.dataSource.advancedSearch)
                txt = node.dataSource.toString(); // search phrase text        
            else
                return app.db.getQueryDataSync('filter').getTextAsync();
        }
        return txt;
    },
    icon: 'search',
    getViewDataSource: function (view: ViewData, dataSourceType: string) {
        if (dataSourceType == 'tracklist') {
            let list;
            if (view.dataSourceCache['search_results'])
                list = view.dataSourceCache['search_results'].tracks;
            else
                list = view.viewNode.dataSource.getTracklist(); // to get fresh tracklist on F5 (view.refresh)
            list.autoUpdateDisabled = true;
            return list;
        }
    },
    viewAs: ['searchView', 'searchView_Tracklist', 'searchView_GroupedTracklist', 'searchView_AlbumList']
});
nodeHandlers.deviceContentInLibrary = inheritNodeHandler('DeviceContentInLibrary', 'Base', {
    title: function (node) {
        return resolveToValue(nodeHandlers.device.title, '', node);
    },
    icon: function (node) {
        return resolveToValue(nodeHandlers.device.icon, '', node);
    },
    getViewDataSource: function (view: ViewData) {
        let coll = nodeUtils.getNodeCollection(view.viewNode);
        let coll_id = -1;
        if (coll)
            coll_id = coll.id;
        return view.viewNode.dataSource.getTracklist('all', 'library', coll_id);
    },
    viewAs: ['tracklist', 'groupedTracklist']
});
nodeHandlers.cloudTracks = inheritNodeHandler('CloudTracks', 'Base', {
    title: function (node) {
        return _('All files');
    },
    icon: 'listview',
    getViewDataSource: function (view: ViewData) {
        let device = view.viewNode.dataSource;
        let sett = mediaSyncDevices.getCustomSettings(device);

        // get the real device/cloud content into tracklist
        let tracklist = app.utils.createTracklist();
        let pr_tracklist = view.promise(tracklist.whenLoaded());
        mediaSyncHandlers[device.handlerID].scanContent(device, tracklist);
        tracklist.globalModifyWatch = true; // due to highlighting of playing track

        // and get the list of tracks already scanned into library (to merge) -- to be able to indicate which tracks are already in the library
        let libTracks = device.getTracklist('has_sync_id', 'library');
        view.promise(libTracks.whenLoaded()).then(() => {
            pr_tracklist.then(() => {
                view.promise(device.mergeTracklists(tracklist, libTracks, 'sync_id'));
            });
        });

        return tracklist;
    },
    viewAs: ['tracklist', 'groupedTracklist']
});
nodeHandlers.deviceMusic = inheritNodeHandler('DeviceMusic', 'Base', {
    title: function (node) {
        return _('Music');
    },
    getViewDataSource: function (view: ViewData) {
        return view.viewNode.dataSource.getTracklist('music');
    },
    icon: 'song',
    viewAs: ['tracklist', 'groupedTracklist']
});
nodeHandlers.deviceVideos = inheritNodeHandler('DeviceVideos', 'Base', {
    title: function (node) {
        return _('Videos');
    },
    getViewDataSource: function (view: ViewData) {
        return view.viewNode.dataSource.getTracklist('video');
    },
    icon: 'video',
    viewAs: ['videoGrid', 'tracklist', 'seriesGroupedTracklist']
});
nodeHandlers.deviceAudiobooks = inheritNodeHandler('DeviceAudiobooks', 'Base', {
    title: function (node) {
        return _('Audiobooks');
    },
    getViewDataSource: function (view: ViewData) {
        return view.viewNode.dataSource.getTracklist('audiobook');
    },
    icon: 'audiobook',
    viewAs: ['tracklist', 'groupedTracklist']
});
nodeHandlers.devicePodcasts = inheritNodeHandler('DevicePodcasts', 'Base', {
    title: function (node) {
        return _('Podcasts');
    },
    getViewDataSource: function (view: ViewData) {
        return view.viewNode.dataSource.getTracklist('podcast');
    },
    icon: 'podcast',
    viewAs: ['tracklist', 'groupedTracklist']
});
nodeHandlers.devicePlaylist = inheritNodeHandler('DevicePlaylist', 'Playlist', {
    getChildren: function (node: SharedNode) {
        return nodeUtils.fillFromList(node, node.dataSource.getChildren(), 'devicePlaylist');
    },
    viewAs: ['folder_listView', 'folder_groupedListView'],
});
nodeHandlers.devicePlaylists = inheritNodeHandler('DevicePlaylists', 'Playlists', {
    getChildren: function (node) {
        return nodeUtils.fillFromList(node, node.dataSource.getPlaylists(), 'devicePlaylist');
    },
    viewAs: ['nodeList']
});
nodeHandlers.deviceFolders = inheritNodeHandler('DeviceFolders', 'Base', {
    title: _('Folders'),
    icon: 'folder',
    getChildren: function (node: SharedNode) {
        return nodeUtils.fillFromList(node, node.dataSource.getFolderList('content'), 'folder');
    },
    viewAs: ['nodeList']
});
nodeHandlers.device = inheritNodeHandler('Device', 'Base', {
    title: function (node) {
        if (!node.dataSource)
            return '';
        return node.dataSource.name;
    },
    setTitle: function (node, newTitle) {
        node.dataSource.name = newTitle;
        node.dataSource.updateDriveLabelAsync(); // #18158
        node.dataSource.commitAsync();
    },
    hasChildren: function (node) {
        requirejs('helpers/mediaSync');
        let handler = mediaSyncHandlers[node.dataSource.handlerID];
        if (isFunction(handler.showContent))
            return handler.showContent(node.dataSource);
        else
            return handler.showContent;
    },
    getChildren: function (node) {
        return new Promise<void>(function (resolve, reject) {
            let handler = mediaSyncHandlers[node.dataSource.handlerID];
            if (handler.addCustomNodes)
                handler.addCustomNodes(node);
            resolve();
        });
    },
    icon: function (node) {
        let device = node.dataSource;
        return mediaSyncDevices.getIcon(device);
    },
    helpContext: function (node) {
        let handler = mediaSyncHandlers[node.dataSource.handlerID];
        if (handler.helpContext)
            return handler.helpContext(node.dataSource);
        else
            return 'Exporting_Tracks';
    },
    hideDefaultMenu: true,
    filterSupport: false,
    menu: function (node) {
        return [{
            action: {
                title: _('Configure') + '...',
                icon: 'options',
                visible: function () {
                    let LV = window.lastFocusedControl;
                    return LV && (LV.controlClass.constructor.name == 'DeviceListView');
                },
                execute: function () {
                    let LV = window.lastFocusedControl;
                    LV.controlClass.openView(node.dataSource, node.handlerID || 'device', LV);
                }
            },
            order: 5,
            grouporder: 10
        }, {
            action: {
                title: _('Delete'),
                icon: 'delete',
                visible: function () {
                    let dev = node.dataSource;
                    return !dev.connected;
                },
                execute: function () {
                    let message = sprintf(_('Are you sure you want to remove profile "%s" ?'), escapeXml(node.dataSource.name));
                    messageDlg(message, 'Confirmation', ['btnYes', 'btnNo'], {
                        defaultButton: 'btnYes'
                    }, function (result) {
                        if (result.btnID === 'btnYes') {
                            let device = node.dataSource;
                            device.removeTracksFromLibrary(false /* no confirmation */).then(() => {
                                let syncHandler = mediaSyncHandlers[device.handlerID];
                                if (syncHandler.removeDevice)
                                    syncHandler.removeDevice(device);
                                else
                                    device.removeAsync(); // removes the device profile from database
                            });
                        }
                    });
                }
            },
            order: 10,
            grouporder: 10
        }, {
            action: {
                title: function () {
                    return _('Rename');
                },
                icon: 'edit',
                visible: function () {
                    return nodeUtils.canEditNodeTitle(node);
                },
                execute: function () {
                    let LV = window.lastFocusedControl;
                    LV.controlClass.editStart();
                },
                shortcut: 'F2'
            },
            order: 15,
            grouporder: 10
        }, {
            action: {
                title: function () {
                    if (node.dataSource.enabled)
                        return _('Disable');
                    else
                        return _('Enable');
                },
                icon: function () {
                    if (node.dataSource.enabled)
                        return 'remove';
                    else
                        return 'add';
                },
                execute: function () {
                    // toggle
                    if (node.dataSource.enabled)
                        node.dataSource.enabled = false;
                    else
                        node.dataSource.enabled = true;
                }
            },
            order: 20,
            grouporder: 10
        }, {
            action: {
                title: _('Sync'),
                icon: 'synchronize',
                disabled: function () {
                    return !mediaSyncDevices.isSyncable(node.dataSource);
                },
                execute: function () {
                    window.uitools.syncDevice(node.dataSource);
                }
            },
            order: 30,
            grouporder: 10
        }, {
            action: {
                title: _('Safely &remove device').replace('&', ''),
                icon: 'eject',
                visible: function () {
                    let dev = node.dataSource;
                    return dev.connected && dev.canEject();
                },
                execute: function () {
                    let dev = node.dataSource;
                    dev.ejectAsync();
                }
            },
            order: 40,
            grouporder: 10
        }, {
            action: { // #17086
                title: actions.paste.title,
                icon: actions.paste.icon,
                visible: (pars) => {
                    return !resolveToValue(actions.paste.disabled, false);
                },
                execute: actions.paste.execute,
            },
            order: 10,
            grouporder: 20
        }];
    },
    canDrop: function (dataSource, e) {
        return dnd.isAllowedType(e, 'media') && mediaSyncDevices.isSyncable(dataSource);
    },
    drop: function (dataSource, e /*, index*/) {

        let _addItem = (obj) => {
            let playlist;
            if (obj.objectType == 'playlist')
                playlist = obj;

            dnd.getTracklistAsync(obj).then(function (l) {
                uitools.sendToDevice(dataSource, l, playlist);
            });
        };

        let obj = dnd.getDragObject(e);
        if (obj.whenLoaded) { // list
            obj.whenLoaded().then(() => {
                if (obj.count) {
                    let firstItem = getValueAtIndex(obj, 0);
                    if (firstItem.objectType == 'playlist') {
                        // this is playlist list, add playlists one by one:
                        listForEach(obj, (playlist) => {
                            _addItem(playlist);
                        });
                    } else {
                        // e.g. tracklist or albumlist, add its tracks at once:
                        _addItem(obj);
                    }

                } else
                    _addItem(obj);
            });
        } else {
            _addItem(obj);
        }

    },
    viewAs: ['device' /*, 'nodeList'*/]
});
nodeHandlers.deviceAsFolders = inheritNodeHandler('DeviceAsFolders', 'Device', {
    viewAs: ['nodeList', 'device']
});
nodeHandlers.devicesList = inheritNodeHandler('DevicesList', 'Base', {
    title: _('Devices & Services'),
    icon: 'device',
    helpContext: 'My Computer',
    getChildren: function (node) {
        node.loadPromise = new Promise<void>((resolve) => {            
            nodeUtils.getDevicesBy(node, {
                visibleInTree: true
            }, 'device').then(() => {      
                // and add also media servers per #15330
                let list = app.sharing.getRemoteServers();                
                list.whenLoaded().then(function () {
                    let filteredList = app.utils.createSharedList();
                    listForEach(list, (server, idx) => {
                        if (!mediaSyncHandlers['server']._isSyncableServer(server)) // syncable servers already appear in the 'Storage & Services' as device profiles
                            filteredList.add(server);
                    });
                    node.addChildren(filteredList, 'mediaServer');
                    resolve();
                });
            });                        
        });        
        return node.loadPromise;
    },
    onExpanded: function (node) {
        node.tag.onDevicesChange = function () {
            nodeUtils.deferredRefresh(node); // timeout to accomodate when there is many devices added just during startup in one second -- to reduce unnecessary refreshNodeChildren() calling
        };
        app.listen(app.devices.getAll(), 'change', node.tag.onDevicesChange);
    },
    onCollapsed: function (node) {
        nodeUtils.deferredRefreshCancel(node);
        app.unlisten(app.devices.getAll(), 'change', node.tag.onDevicesChange);
        node.tag.onDevicesChange = undefined;
    },
    viewAs: ['deviceList']
});
nodeHandlers.years = inheritNodeHandler('Years', 'AutoUpdateParent', {
    title: function (node) {
        return _('Years');
    },
    icon: 'year',
    hasChildren: true,
    //hasTreeChildren: false, // enabled in the tree so that individual years are accessible under decades (#15056)
    getChildren: function (node) {
        return new Promise<void>(function (resolve, reject) {
            let collection = nodeUtils.getNodeCollection(node);
            collection.getDecades().whenLoaded().then(function (list) {
                node.addChildren(list, 'decade');
                resolve();
            });
        });
    },
    viewAs: ['nodeList', 'tracklist', 'groupedTracklist', 'albumlist']
});

nodeHandlers.yearsOrig = inheritNodeHandler('YearsOrig', 'AutoUpdateParent', {
    title: function (node) {
        return _('Years (orig.)');
    },
    icon: 'year',
    hasChildren: true,
    //hasTreeChildren: false, // enabled in the tree so that individual years are accessible under decades (#15056)
    getChildren: function (node) {
        return new Promise<void>(function (resolve, reject) {
            let collection = nodeUtils.getNodeCollection(node);
            collection.getDecades(true /* useOrigYear */).whenLoaded().then(function (list) {
                node.addChildren(list, 'decade');
                resolve();
            });
        });
    },
    viewAs: ['nodeList', 'tracklist', 'groupedTracklist', 'albumlist']
});

nodeHandlers.decade = inheritNodeHandler('Decade', 'Base', {
    title: function (node) {
        if (!node.dataSource)
            return '';
        return node.dataSource.title;
    },
    icon: 'year',
    hasChildren: function (node) {
        return node.dataSource.value != -1;
    },
    getChildren: function (node) {
        return new Promise<void>(function (resolve, reject) {
            node.dataSource.getYears().whenLoaded().then(function (list) {
                node.addChildren(list, 'year');
                resolve();
            });
        });
    },
    viewAs: ['decadeView', 'tracklist', 'groupedTracklist', 'nodeList', 'albumlist']
});

nodeHandlers.year = inheritNodeHandler('Year', 'Base', {
    title: function (node) {
        if (!node.dataSource)
            return '';
        return node.dataSource.title;
    },
    icon: 'year',
    canDrop: function (dataSource, e, callerControl) {
        if (dnd.isAllowedType(e, 'media'))
            return true;  // track D&D / year assignment      
    },    
    drop: function (dataSource, e, index) {                
        let srcObject = dnd.getDragObject(e);
                
        // year assignment to tracklist
        let append = dnd.getDropMode(e) == 'copy';
        dnd.getTracklistAsync(srcObject).then(function (tracklist) {
            dataSource.assignTracks(tracklist, append);
        });        
    },
    viewAs: ['yearView', 'tracklist', 'groupedTracklist', 'albumlist']
});

nodeHandlers.albums = inheritNodeHandler('Albums', 'AutoUpdateParent', {
    title: function (node) {
        return _('Albums');
    },
    icon: 'album',
    viewAs: ['albumlist', 'tracklist', 'groupedTracklist'],
    // isNavbarExpandable: false, // #20803
    hasTreeChildren: () => {
        return window.settings.UI.mediaTree.showAllNodes;
    },
    virtualChildrenSupport: true, // for performance optimizations when jumping to nodes
    _getChildrenList: function (node) {
        if (!node.tag._childrenList) {
            let coll = nodeUtils.getNodeCollection(node);
            node.tag._childrenList = coll.getAlbumList('known only', 'no filter');
        }
        return node.tag._childrenList;
    },
    getChildren: function (node) {
        return nodeUtils.fillFromList(node, this._getChildrenList(node), 'album');
    }
});
nodeHandlers.allseries = inheritNodeHandler('AllSeries', 'Albums', {
    title: function (node) {
        return _('Series');
    },
    icon: 'series',
    viewAs: ['serieslist', 'tracklist', 'seriesGroupedTracklist'],
    getChildren: function (node) {
        return nodeUtils.fillFromList(node, this._getChildrenList(node), 'series');
    }
});

nodeHandlers.tracksRemoveable = inheritNodeHandler('TracksRemoveable', 'Base', {
    canDelete: true,
    deleteItems: function (nodes, permanent) {       
        if (nodes.count) {
            let tracks = app.utils.createTracklist();
            let promises = [];
            nodes.forEach(function (node) {
                promises.push(node.dataSource.getTracklist().whenLoaded().then(function (list) {
                    tracks.addList(list);
                }));
            });
            whenAll(promises).then(function () {
                tracks.notifyLoaded();
                if (tracks.count) {
                    uitools.deleteTracklist(tracks).then(function (removed) {
                        if (removed) {
                            if ((removed.length == 1) && (removed[0] == ''))
                                return;
                            nodes.forEach(function (node) {
                                node.dataSource.deleted = true;
                            });
                        }
                    });
                }
            });
        }
    }    
});

nodeHandlers.album = inheritNodeHandler('Album', 'TracksRemoveable', {
    title: function (node, incChildCount, forEditing) {
        if (!node.dataSource)
            return '';
        if (node.dataSource.title == '') {
            if (!forEditing)
                return _('Unknown Album');
            else
                return '';
        } else {
            if (node.dataSource.albumArtist && node.parent && node.parent.handlerID == 'albums' && !forEditing) // #15744
                return node.dataSource.title + ' (' + node.dataSource.albumArtist + ')';
            else
                return node.dataSource.title;
        }
    },
    setTitle: function (node, title) {
        if (resolveToValue(node.dataSource.title, '') !== title) {
            node.dataSource.title = title;
            node.dataSource.commitAsync();
        }
    },
    icon: 'album',
    viewAs: function () {
        return ['albumview_albumtracklist', 'albumview_tracklist'];
    },
    canDrop: function (dataSource, e) {
        return dnd.isAllowedType(e, 'media');
    },
    drop: function (dataSource, e /*, index*/) {
        let list = dnd.getDragObject(e);
        dnd.getTracklistAsync(list).then(function (l) {
            dataSource.addTracksAsync(l);
        });
    },
    getViewDataSource: function (view: ViewData) {
        let list = app.utils.createTracklist(); // have to use copy, to avoid wrong udpates of list, if switched to online and reuse this list
        if (uitools.globalSettings.showingOnline) {
            let cachedDS = view.dataSourceCache['albumView'];
            if (!cachedDS) {
                cachedDS = new AlbumDataSource(view.viewNode.dataSource);
                view.dataSourceCache['albumView'] = cachedDS;
            }

            if (view.dataSourceCache['onlineTracklist']) {
                let tl: Tracklist = view.dataSourceCache['onlineTracklist'];
                view.promise(tl.whenLoaded()).then(function () {
                    list.addList(tl);
                    list.notifyLoaded();
                    list.globalModifyWatch = true;
                });
            } else {
                let tl: Tracklist = app.utils.createTracklist();
                view.dataSourceCache['onlineTracklist'] = tl;
                cachedDS.addRef();
                view.promise(cachedDS.readAllOnlineTracks()).then(function (tlist) {
                    if (tlist) {
                        list.addList(tlist);
                        list.notifyLoaded();
                        list.globalModifyWatch = true;
                        tl.addList(tlist); // have to return copy, to differentiate online tracklist and local tracklist
                        tl.notifyLoaded();
                        tl.globalModifyWatch = true;
                    }
                    cachedDS.release();
                }, function () {
                    cachedDS.release();
                });
            }
        } else {
            let tl: Tracklist = view.viewNode.dataSource.getTracklist();
            view.promise(tl.whenLoaded()).then(function () {
                list.addList(tl);
                list.notifyLoaded();
                list.globalModifyWatch = true;
                tl.globalModifyWatch = false; // not used list, no events needed already
                tl = undefined;
            });
        }
        return list;
    },
});
nodeHandlers.series = inheritNodeHandler('Series', 'TracksRemoveable', {
    title: function (node) {
        if (!node.dataSource)
            return '';
        if (node.dataSource.title == '')
            return _('Unknown Series');
        else
            return node.dataSource.title;
    },
    icon: 'series',
    viewAs: function () {
        return ['seriesview_seriestracklist', 'seriesview_tracklist'];
    },
    canDrop: function (dataSource, e) {
        return dnd.isAllowedType(e, 'media');
    },
    drop: function (dataSource, e /*, index*/) {
        let list = dnd.getDragObject(e);
        dnd.getTracklistAsync(list).then(function (l) {
            dataSource.addTracksAsync(l);
        });
    },
    getViewDataSource: function (view: ViewData) {
        let list = app.utils.createTracklist(); // have to use copy, to avoid wrong udpates of list, if switched to online and reuse this list
        if (uitools.globalSettings.showingOnline) {
            let cachedDS = view.dataSourceCache['seriesView'];
            if (!cachedDS) {
                cachedDS = new SeriesDataSource(view.viewNode.dataSource);
                view.dataSourceCache['seriesView'] = cachedDS;
            }
            if (view.dataSourceCache['onlineTracklist']) {
                let tl: Tracklist = view.dataSourceCache['onlineTracklist'];
                view.promise(tl.whenLoaded()).then(function () {
                    list.addList(tl);
                    list.notifyLoaded();
                    list.globalModifyWatch = true;
                });
            } else {
                let tl: Tracklist = app.utils.createTracklist();
                view.dataSourceCache['onlineTracklist'] = tl;
                cachedDS.addRef();
                view.promise(cachedDS.fetchSeriesEpisodes()).then(function (tlist) {
                    if (tlist) {
                        list.addList(tlist);
                        list.notifyLoaded();
                        list.globalModifyWatch = true;
                        tl.addList(tlist); // have to return copy, to differentiate online tracklist and local tracklist
                        tl.notifyLoaded();
                        tl.globalModifyWatch = true;

                    }
                    cachedDS.release();
                }, function () {
                    cachedDS.release();
                });
            }
        } else {
            let tl: Tracklist = view.viewNode.dataSource.getTracklist();
            view.promise(tl.whenLoaded()).then(function () {
                list.addList(tl);
                list.notifyLoaded();
                list.globalModifyWatch = true;
                tl.globalModifyWatch = false; // not used list, no events needed already
                tl = undefined;
            });
        }
        return list;
    },
});
nodeHandlers.dropTarget = inheritNodeHandler('DropTarget', 'Base', {
    canDrop: function (dataSource, e) {
        if (dnd.droppingFileNames(e)) // D&D from explorer to collection should scan folder into MM
            return true;
        let _this = this;
        let ret = false;
        let datatype = dnd.getDropDataType(e);
        if (dnd.isAllowedType(e, datatype)) {
            let qd = dataSource.queryData;
            if (qd) {
                let conds = qd.conditions;
                if (conds.count == 1) {
                    conds.locked(function () {
                        let cond = conds.getValue(0);
                        if ((cond.fieldName == 'Type') && (cond.operatorName == 'equals')) {
                            let val = cond.valueText;
                            if (val.indexOf(';')) {
                                let arr = val.split(';');
                                if (arr.length)
                                    val = arr[0];
                            }
                            _this._collectionType = app.utils.text2TrackType(val);
                            ret = _this._collectionType >= 0;
                        }
                    });
                }
            }
        }
        return ret;
    },
    drop: function (dataSource, e, index) {
        let isCopy = dnd.getDropMode(e) == 'copy';
        let _this = this;

        if (dnd.droppingFileNames(e)) { // scan folders
            if (app.utils.droppingFolder()) {
                app.utils.resolveDropFolders().then(function (list) {
                    uitools.scanForMedia(list);
                });
            } else {
                app.utils.resolveDropFiles().then(function (sl) {
                    sl.commitAsync(true /*forceSaveToDB*/, true /*callUpdate*/, false /*tagModified*/);
                });
            }
        } else {

            let process = function (sl) {
                sl.modifyAsync(function () {
                    for (let i = 0; i < sl.count; i++) {
                        let s = sl.getValue(i);
                        s.trackType = _this._collectionType;
                    }
                    sl.commitAsync();
                });
            };

            let srcObject = dnd.getDragObject(e);
            let datatype = dnd.getDropDataType(e);
            if (srcObject && dnd.isAllowedType(e, datatype)) {
                if (srcObject.getTracklist) {
                    srcObject.getTracklist().whenLoaded().then(function (list) {
                        process(list);
                    });
                } else if (srcObject.whenLoaded) { // it's list
                    dnd.getTracklistAsync(srcObject).then(function (sl) {
                        process(sl);
                    });
                } else {
                    process(srcObject);
                }
            }
        }
    },
});
nodeHandlers.collection = inheritNodeHandler('Collection', 'DropTarget', {
    title: function (node) {
        return node.dataSource.name;
    },
    helpContext: function (node) {
        let collection = node.dataSource;
        let coltype = collection.getType();
        if (inArray(coltype, ['podcast', 'videopodcast']))
            return 'Podcasts';
        else
            return 'Library';
    },
    onExpanded: function (node) {
        node.tag.onPodcastAdded = function (oper) {
            if (oper == 'insert' || oper == 'delete')
                nodeUtils.deferredRefresh(node); // to refresh expand indicator of 'Subscriptions' node and visibility of 'Unsubscribed' node
        };
        node.tag.onCollectionUpdate = function () {
            nodeUtils.deferredRefresh(node);
        };
        app.listen(app.podcasts, 'change', node.tag.onPodcastAdded);
        app.listen(node.dataSource, 'change', node.tag.onCollectionUpdate);
    },
    onCollapsed: function (node) {
        nodeUtils.deferredRefreshCancel(node);
        app.unlisten(app.podcasts, 'change', node.tag.onPodcastAdded);
        node.tag.onPodcastAdded = undefined;
        app.unlisten(node.dataSource, 'change', node.tag.onCollectionUpdate);
        node.tag.onCollectionUpdate = undefined;
    },
    hasChildren: function (node) {
        return true; //TODO
    },
    _getSubnodesList: function (collection) {
        let coltype = collection.getType();
        let list = [{
            id: 'tracks',
            visible: inArray(coltype, ['mixed', 'music', 'classicalmusic', 'musicvideo', 'audiobook']),
            pos: 0,
        }, {
            id: 'title',
            visible: false,
            pos: 1,
        }, {
            id: 'albums',
            visible: inArray(coltype, ['mixed', 'music', 'classicalmusic', 'musicvideo', 'audiobook']),
            pos: 1,
        }, {
            id: 'videos',
            visible: inArray(coltype, ['video', 'tv']),
            pos: 0,
        }, {
            id: 'allseries',
            visible: inArray(coltype, ['video', 'tv']),
            pos: 1,
        }, {
            id: 'genres',
            visible: inArray(coltype, ['mixed', 'music', 'classicalmusic', 'musicvideo', 'podcast', 'videopodcast', 'audiobook', 'video', 'tv']),
            pos: 2,
        }, {
            id: 'artists',
            visible: inArray(coltype, ['mixed', 'music', 'classicalmusic', 'musicvideo', 'audiobook']),
            pos: 3,
        }, {
            id: 'directors',
            visible: inArray(coltype, ['video', 'tv']),
            pos: 3,
        }, {
            id: 'producers',
            visible: inArray(coltype, ['video', 'tv']),
            pos: 4,
        }, {
            id: 'albumartists',
            visible: false,
            pos: 4,
        }, {
            id: 'artistsOnly', // #18545
            visible: false,
            pos: 4,
        }, {
            id: 'composers',
            visible: inArray(coltype, ['mixed', 'music', 'classicalmusic', 'musicvideo']),
            pos: 4,
        }, {
            id: 'years',
            visible: inArray(coltype, ['mixed', 'music', 'classicalmusic', 'musicvideo', 'audiobook', 'video', 'tv']),
            pos: 5,
        }, {
            id: 'yearsOrig',
            visible: false,
            pos: 6,
        }, {
            id: 'conductors',
            visible: inArray(coltype, ['classicalmusic']),
            pos: 7,
        }, {
            id: 'publishers',
            visible: inArray(coltype, ['mixed', 'music', 'classicalmusic', 'musicvideo']),
            pos: 7,
        }, {
            id: 'actors',
            visible: inArray(coltype, ['video', 'tv']),
            pos: 7,
        }, {
            id: 'ratings',
            visible: inArray(coltype, ['mixed', 'music', 'classicalmusic', 'musicvideo', 'audiobook', 'video', 'tv']),
            pos: 8,
        }, {
            id: 'classification',
            visible: inArray(coltype, ['mixed', 'music', 'classicalmusic', 'musicvideo', 'audiobook']),
            pos: 9,
        }, {
            id: 'location',
            visible: true,
            pos: 10,
        }];
        if (window.uitools.getCanEdit()) {
            list.push({
                id: 'filestoedit',
                visible: true,
                pos: 10,
            });
        }
        if (coltype == 'podcast' || coltype == 'videopodcast') {
            list.push({ // @ts-ignore
                id: function () {
                    if (app.podcasts.isAnyPodcastSubscribed())
                        return 'subscriptions';
                    else
                        return 'subscriptionTutorial';
                },
                dataSource: app.podcasts,
                pos: 0,
                visible: true,
            });
            list.push({
                id: 'newEpisodes',
                pos: 1,
                visible: true,
            });
            list.push({
                id: 'podcastDirectories', // @ts-ignore
                dataSource: app.podcasts,
                pos: 2,
                visible: true,
            });
            if (app.podcasts.isAnyPodcastUnsubscribed())
                list.push({
                    id: 'unsubscribed',
                    pos: 3,
                    visible: true,
                });
        }
        return list;
    },
    getConfiguredNodes: function (collection) {
        let list = this._getSubnodesList(collection);

        let key = nodeUtils.getCollectionStateRootKey(collection);
        let state: AnyDict = {};
        app.getValue(key, state);
        if (state.treeNodes) {
            // restore visible/invisible node states (set in Options -> Media Tree)
            for (let i = 0; i < list.length; i++) {
                for (let j = 0; j < state.treeNodes.length; j++) {
                    let nodeState = state.treeNodes[j];
                    if (nodeState.id == list[i].id) {
                        list[i].visible = nodeState.visible;
                        list[i].pos = nodeState.pos;
                    }
                }
            }
        }
        // sort nodes
        list.sort(function (item1, item2) {
            return (item1.pos - item2.pos);
        });
        return list;
    },
    setConfiguredNodes: function (collection, list) {
        let key = nodeUtils.getCollectionStateRootKey(collection);
        let state: AnyDict = {};
        app.getValue(key, state);
        state.treeNodes = list;
        app.setValue(key, state);
    },
    _addChildren: function (list, node, dataSource) {
        for (let i = 0; i < list.length; i++) {
            if (!node.canceled) {
                let item = list[i];
                if (resolveToValue(item.visible, true)) {
                    let handlerID = resolveToValue(item.id, '');
                    if (item.dataSource)
                        node.addChild(item.dataSource, handlerID);
                    else
                        node.addChild(dataSource /*collection*/, handlerID);
                }
            }
        }
    },
    getChildren: function (node) {
        let _this = this;
        return new Promise<void>(function (resolve, reject) {
            let collection = node.dataSource;
            let list = _this.getConfiguredNodes(collection);
            _this._addChildren(list, node, collection);
            resolve();
        });
    },
    viewAs: function (node) {
        let collection = node.dataSource;
        let coltype = collection.getType();
        // LS: Tabbed view was deprecated in course of #13521
        if (inArray(coltype, ['music', 'classicalmusic']))
            return ['musicCollectionView' /*, 'collectionTabbedView'*/, 'albumlist', 'tracklist', 'groupedTracklist'];
        else
        if (inArray(coltype, ['musicvideo']))
            return ['musicCollectionView' /*, 'collectionTabbedView'*/, 'videoGrid', 'tracklist', 'groupedTracklist'];
        else
        if (inArray(coltype, ['video']))
            return ['videoCollectionView' /*, 'collectionTabbedView'*/, 'videoGrid', 'tracklist', 'seriesGroupedTracklist'];
        else
        if (inArray(coltype, ['tv']))
            return ['tvCollectionView' /*, 'collectionTabbedView'*/, 'videoGrid', 'tracklist', 'seriesGroupedTracklist'];
        else
        if (inArray(coltype, ['audiobook']))
            return ['audiobookCollectionView' /*, 'collectionTabbedView'*/, 'albumlist', 'tracklist', 'groupedTracklist'];
        else
        if (inArray(coltype, ['podcast', 'videopodcast']))
            return ['collectionTabbedView', 'tracklist', 'groupedTracklist'];
        else
        if ((coltype === 'mixed') && (collection.id === -1))
            return ['musicCollectionView', 'albumlist', 'tracklist', 'groupedTracklist']; // e.g. 'Entire Library'
        else
            return ['nodeList', 'tracklist', 'groupedTracklist'];
    },
    icon: function (node) {
        return node.dataSource.icon;
    },
    hideDefaultMenu: true,
    menu: function (node) {
        let collection = node.dataSource;
        let m = [{
            action: bindAction(window.actions.editCollection, collection),
            order: 20,
            grouporder: 10
        }, {
            action: bindAction(window.actions.unpin, collection),
            order: 10,
            grouporder: 10
        }];
        let coltype = node.dataSource.getType();
        if (inArray(coltype, ['podcast', 'videopodcast']))
            m = m.concat(resolveToValue(nodeHandlers.subscriptions.menu, [], node));
        return m;
    },
    toolbarActions: function (view) {
        let m = [];
        let coltype = view.viewNode.dataSource.getType();
        if (inArray(coltype, ['podcast', 'videopodcast']))
            m = m.concat(resolveToValue(nodeHandlers.subscriptions.toolbarActions, [], view));
        return m;
    }
});

nodeHandlers.title = inheritNodeHandler('Title', 'Base', {
    title: function (node) {
        return _('Title');
    },
    icon: 'listview',
    hasChildren: true,
    getChildren: function (node) {
        return new Promise<void>(function (resolve, reject) {
            let coll = nodeUtils.getNodeCollection(node);
            coll.getCollectionQueryAsync().then((query) => {
                app.db.getQueryResultAsync('SELECT DISTINCT substr( songtitle, 1, 1) AS letter FROM songs WHERE ' + query + ' ORDER BY letter COLLATE USERLOCALE').then((res) => {
                    while (!res.eof) {
                        let letter = res.fields.getValue(0).toUpperCase();
                        let dataSource = {
                            id: letter,
                            letter: letter
                        };
                        node.addChild(dataSource, 'letter');
                        res.next();
                    }
                    resolve();
                });
            });
        });
    },
    viewAs: ['nodeList']
});
nodeHandlers.letter = inheritNodeHandler('Letter', 'Base', {
    title: function (node) {
        if (node.dataSource.letter == '')
            return _('Unknown');
        else
            return node.dataSource.letter;
    },
    icon: 'listview',
    hasChildren: false,
    viewAs: ['tracklist'],
    getViewDataSource: function (view: ViewData) {
        let node = view.viewNode;
        let coll = nodeUtils.getNodeCollection(node);
        let letter = node.dataSource.letter;
        if (letter == '\'')
            letter = '\'\'';
        return app.db.getTracklist('SELECT * FROM Songs WHERE stricompw(substr(songs.songtitle,1,1),\'' + letter + '\')=0', coll.id);
    }
});
nodeHandlers.persons = inheritNodeHandler('Persons', 'AutoUpdateParent', {
    hasTreeChildren: () => {
        return window.settings.UI.mediaTree.showAllNodes;
    },
    virtualChildrenSupport: true,
    _getChildrenList: function (node) {
        if (!node.tag._childrenList) {
            let PT = this.personType;
            let coll = nodeUtils.getNodeCollection(node);
            node.tag._childrenList = coll.getPersonList(PT, false, 'no filter');
        }
        return node.tag._childrenList;
    },
    getChildren: function (node) {
        return nodeUtils.fillFromList(node, this._getChildrenList(node), this.personType);
    },
    //isNavbarExpandable: false // #20803
});
nodeHandlers.artists = inheritNodeHandler('Artists', 'Persons', {
    title: function () {
        return _('Artists');
    },
    tooltip: function () {
        return _('Artists') + ' & ' + _('Album Artists');
    },
    icon: 'artist',
    viewAs: ['artistGrid', 'tracklist', 'groupedTracklist'],
    formatStatus: function (data) {
        return statusbarFormatters.formatDefaultSimpleStatus(data, function (cnt) {
            return _('artist', 'artists', cnt);
        });
    },
    personType: 'artist'
});
nodeHandlers.albumartists = inheritNodeHandler('AlbumArtists', 'Persons', {
    title: function () {
        return _('Album Artists');
    },
    icon: 'artist',
    viewAs: ['albumArtistGrid', 'tracklist', 'groupedTracklist'],
    formatStatus: function (data) {
        return statusbarFormatters.formatDefaultSimpleStatus(data, function (cnt) {
            return _('artist', 'artists', cnt);
        });
    },
    _getChildrenList: function (node) {
        if (!node.tag._childrenList) {
            let coll = nodeUtils.getNodeCollection(node);
            node.tag._childrenList = coll.getAlbumArtistList();
        }
        return node.tag._childrenList;
    },
    personType: 'albumartist'
});
nodeHandlers.artistsOnly = inheritNodeHandler('ArtistsOnly', 'Persons', {
    title: function () {
        return _('Contributing artists');
    },
    tooltip: function () {
        return _('Artists only');
    },
    icon: 'artist',
    viewAs: ['artistOnlyGrid', 'tracklist', 'groupedTracklist'],
    formatStatus: function (data) {
        return statusbarFormatters.formatDefaultSimpleStatus(data, function (cnt) {
            return _('artist', 'artists', cnt);
        });
    },
    _getChildrenList: function (node) {
        if (!node.tag._childrenList) {
            let coll = nodeUtils.getNodeCollection(node);
            node.tag._childrenList = coll.getArtistOnlyList();
        }
        return node.tag._childrenList;
    },
    personType: 'albumartist'
});
nodeHandlers.directors = inheritNodeHandler('Directors', 'Persons', {
    title: function (node) {
        return _('Directors');
    },
    icon: 'director',
    viewAs: ['directorGrid', 'tracklist', 'seriesGroupedTracklist'],
    formatStatus: function (data) {
        return statusbarFormatters.formatDefaultSimpleStatus(data, function (cnt) {
            return _('director', 'directors', cnt);
        });
    },
    personType: 'director'
});
nodeHandlers.composers = inheritNodeHandler('Composers', 'Persons', {
    title: function (node) {
        return _('Composers');
    },
    icon: 'composer',
    viewAs: ['composerGrid', 'tracklist', 'groupedTracklist'],
    formatStatus: function (data) {
        return statusbarFormatters.formatDefaultSimpleStatus(data, function (cnt) {
            return _('composer', 'composers', cnt);
        });
    },
    personType: 'composer'
});
nodeHandlers.conductors = inheritNodeHandler('Conductors', 'Persons', {
    title: function (node) {
        return _('Conductors');
    },
    icon: 'conductor',
    viewAs: ['conductorGrid', 'tracklist', 'groupedTracklist'],
    formatStatus: function (data) {
        return statusbarFormatters.formatDefaultSimpleStatus(data, function (cnt) {
            return _('conductor', 'conductors', cnt);
        });
    },
    personType: 'conductor'
});
nodeHandlers.producers = inheritNodeHandler('Producers', 'Persons', {
    title: function (node) {
        return _('Producers');
    },
    icon: 'producer',
    viewAs: ['producerGrid', 'tracklist', 'groupedTracklist'],
    formatStatus: function (data) {
        return statusbarFormatters.formatDefaultSimpleStatus(data, function (cnt) {
            return _('producer', 'producers', cnt);
        });
    },
    personType: 'producer'
});
nodeHandlers.actors = inheritNodeHandler('Actors', 'Persons', {
    title: function (node) {
        return _('Actors');
    },
    icon: 'actor',
    viewAs: ['actorGrid', 'tracklist', 'seriesGroupedTracklist'],
    formatStatus: function (data) {
        return statusbarFormatters.formatDefaultSimpleStatus(data, function (cnt) {
            return _('actor', 'actors', cnt);
        });
    },
    personType: 'actor'
});
nodeHandlers.publishers = inheritNodeHandler('Publishers', 'Persons', {
    title: function (node) {
        return _('Publishers');
    },
    icon: 'publisher',
    viewAs: ['publisherGrid', 'tracklist', 'groupedTracklist'],
    formatStatus: function (data) {
        return statusbarFormatters.formatDefaultSimpleStatus(data, function (cnt) {
            return _('publisher', 'publishers', cnt);
        });
    },
    personType: 'publisher'
});
nodeHandlers.person = inheritNodeHandler('Person', 'TracksRemoveable', {
    title: function (node) {
        if (!node.dataSource)
            return '';
        if (node.dataSource.name == '')
            return _('Unknown');
        else
            return node.dataSource.name;
    },
    setTitle: function (node, title) {
        if (resolveToValue(node.dataSource.name, '') !== title) {
            node.dataSource.name = title;
            node.dataSource.commitAsync();
        }
    },
    viewAs: ['tracklist', 'groupedTracklist', 'albumlist'],
    getDropMode: function (dataSource, e) {
        if (e.ctrlKey)
            return 'copy';
        else
            return 'move';
    },
    canDrop: function (dataSource, e) {
        return dnd.isAllowedType(e, 'media');
    },
    drop: function (dataSource, e) {
        let personType = dataSource.objectType;
        let name = dataSource.name;
        dnd.getTracklistAsync(dnd.getDragObject(e)).then(function (tracklist) {
            fastForEach(tracklist, function (track) {
                assert(track.hasOwnProperty(personType), 'Property ' + personType + ' doesn not exists in track');
                if ((e.dataTransfer && e.dataTransfer.dropEffect === 'copy') || e.ctrlKey) {
                    let append = '';
                    if (track[personType]) {
                        let sett = window.settings.get('Appearance');
                        append = sett.Appearance.MultiStringSeparator;
                    }
                    append += name;
                    track[personType] = app.utils.visualString2MultiString(track[personType] + append);
                } else
                    track[personType] = name;
            });
            tracklist.commitAsync();
        });
    },
});
nodeHandlers.artist = inheritNodeHandler('Artist', 'Person', {
    icon: 'artist',
    hasChildren: function (node) {
        return true; /* #16996 */ // (node.dataSource.albumCount > 0);
    },
    getChildren: function (node) {
        return nodeUtils.fillFromList(node, node.dataSource.getAlbumList(), 'album');
    },
    viewAs: function () {
        return ['artistView', 'artistview_tracklist', 'artistview_groupedtracklist'];
    },
    getViewDataSource: function (view: ViewData) {
        let list = app.utils.createTracklist();
        if (uitools.globalSettings.showingOnline) {
            let cachedDS = view.dataSourceCache['artistView'];
            if (!cachedDS) {
                cachedDS = new ArtistDataSource(view.viewNode.dataSource);
                view.dataSourceCache['artistView'] = cachedDS;
            }
            if (view.dataSourceCache['onlineTracklist']) {
                let tl: Tracklist = view.dataSourceCache['onlineTracklist'];
                cachedDS.addRef();
                view.promise(tl.whenLoaded()).then(function () {
                    list.addList(tl);
                    list.notifyLoaded();
                    list.globalModifyWatch = true;
                    cachedDS.release();
                }, function () {
                    cachedDS.release();
                });
            } else {
                cachedDS.addRef();
                let tl: Tracklist = app.utils.createTracklist();
                view.dataSourceCache['onlineTracklist'] = tl;
                view.promise(cachedDS.readAllOnlineTracks()).then(function (tlist) {
                    if (tlist) {
                        list.addList(tlist);
                        list.notifyLoaded();
                        list.globalModifyWatch = true;
                        tl.addList(tlist); // have to return copy, to differentiate online tracklist and local tracklist
                        tl.notifyLoaded();
                        tl.globalModifyWatch = true;
                    } else
                        list.notifyLoaded(); // loading ended, must be called, some promises could wait for it
                    cachedDS.release();
                }, function () {
                    list.notifyLoaded(); // loading ended, must be called, some promises could wait for it
                    cachedDS.release();
                });
            }
        } else {
            let tl: Tracklist = view.viewNode.dataSource.getTracklist();
            view.promise(tl.whenLoaded()).then(function () {
                list.addList(tl);
                list.notifyLoaded();
                list.globalModifyWatch = true;
                tl.globalModifyWatch = false;
                tl = undefined;
            }, function () {
                list.notifyLoaded(); // loading ended, must be called, some promises could wait for it
            });
        }
        return list;
    },
    formatStatus: function (data) {
        return '';
    }
});
nodeHandlers.albumartist = inheritNodeHandler('AlbumArtist', 'Artist', {});
nodeHandlers.publisher = inheritNodeHandler('Publisher', 'Person', {
    icon: 'publisher',
});
nodeHandlers.composer = inheritNodeHandler('Composer', 'Artist', {
    icon: 'composer',
});
nodeHandlers.conductor = inheritNodeHandler('Conductor', 'Person', {
    icon: 'conductor',
});
nodeHandlers.lyricist = inheritNodeHandler('Lyricist', 'Person', {
    icon: 'lyricist',
});
nodeHandlers.producer = inheritNodeHandler('Producer', 'Person', {
    icon: 'producer',
    viewAs: ['videoGrid', 'tracklist', 'seriesGroupedTracklist'],
});
nodeHandlers.actor = inheritNodeHandler('Actor', 'Person', {
    icon: 'actor',
    viewAs: ['videoGrid', 'tracklist', 'seriesGroupedTracklist'],
});
nodeHandlers.director = inheritNodeHandler('Director', 'Person', {
    icon: 'director',
    viewAs: ['videoGrid', 'tracklist', 'seriesGroupedTracklist'],
});

nodeHandlers.genre = inheritNodeHandler('Genre', 'TracksRemoveable', {
    title: function (node) {
        if (!node.dataSource)
            return '';
        if (node.dataSource.name == '')
            return _('Unknown');
        else
            return node.dataSource.name;
    },
    setTitle: function (node, title) {
        if (resolveToValue(node.dataSource.name, '') !== title) {
            node.dataSource.name = title;
            node.dataSource.commitAsync();
        }
    },
    icon: 'genre',
    viewAs: function (node) {
        let col = nodeUtils.getNodeCollection(node);
        let ctype = undefined;
        if (col)
            ctype = col.getType();
        if (col && inArray(ctype, ['video', 'tv']))
            return ['genreView', 'serieslist', 'videoGrid', 'tracklist', 'seriesGroupedTracklist'];
        else if (col && inArray(ctype, ['musicvideo', 'videopodcast']))
            return ['genreView', 'albumlist', 'videoGrid', 'tracklist', 'groupedTracklist'];
        else
            return ['genreView', 'albumlist', 'tracklist', 'groupedTracklist'];
    },
    getDropMode: function (dataSource, e) {
        if (e.ctrlKey)
            return 'copy';
        else
            return 'move';
    },
    canDrop: function (dataSource, e) {
        return dnd.isAllowedType(e, 'media');
    },
    drop: function (dataSource, e) {
        let name = dataSource.name;
        dnd.getTracklistAsync(dnd.getDragObject(e)).then(function (tracklist) {
            fastForEach(tracklist, function (track) {
                if ((e.dataTransfer && e.dataTransfer.dropEffect === 'copy') || e.ctrlKey) {
                    let append = '';
                    if (track.genre) {
                        let sett = window.settings.get('Appearance');
                        append = sett.Appearance.MultiStringSeparator;
                    }
                    append += name;
                    track.genre = app.utils.visualString2MultiString(track.genre + append);
                } else
                    track.genre = name;
            });
            tracklist.commitAsync();
        });
    },
    getChildren: function (node) {
        return new Promise<void>(function (resolve, reject) {
            let coll = nodeUtils.getNodeCollection(node);
            let collQry = '';
            let _perform = () => {
                let sql = 'SELECT DISTINCT artists.* FROM artists, genressongs, songs, artistssongs ' +
                ' WHERE genressongs.IDGenre = ' + node.dataSource.id + ' AND genressongs.IDSong = songs.ID AND ' +
                ' artistssongs.IDSong = songs.ID AND artistssongs.PersonType = 1 AND artists.ID = artistssongs.IDArtist ' +
                collQry + 
                ' ORDER BY artists.artist';
                nodeUtils.fillFromList(node, node.dataSource.getArtistList(sql), 'artist').then(resolve);
            };
            if (coll) {
                coll.getCollectionQueryAsync().then((q) => { 
                    collQry = 'AND ' + q;
                    _perform();
                });
            } else {
                _perform();
            }
        });        
    },
    hasTreeChildren: () => {
        return window.settings.UI.mediaTree.showAllNodes;
    },
});

nodeHandlers.genreCategory = inheritNodeHandler('GenreCategory', 'AutoUpdateParent', {
    title: function (node) {
        if (!node.dataSource)
            return '';
        return node.dataSource.name;
    },
    getViewDataSource: function (view: ViewData, dataSourceType: string) {
        if (dataSourceType == 'tracklist')
            return view.viewNode.dataSource.getTracklist();
        else
        if (dataSourceType == 'genrelist')
            return view.viewNode.dataSource.getGenreList();
        else
        if (dataSourceType == 'albumlist')
            return view.viewNode.dataSource.getAlbumList();
        else
            alert('Unknown/unsupported dataSourceType: ' + dataSourceType);
    },
    icon: 'genre',
    viewAs: function (node) {
        let col = nodeUtils.getNodeCollection(node);
        let ctype = undefined;
        if (col)
            ctype = col.getType();
        if (col && inArray(ctype, ['video', 'tv']))
            return ['genreGrid', 'serieslist'];
        else
            return ['genreGrid', 'albumlist'];
    },
    formatStatus: function (data) {
        return statusbarFormatters.formatDefaultSimpleStatus(data, function (cnt) {
            return _('genre', 'genres', cnt);
        });
    },
});

window.uitools.predefinedGenreCategories = [
    {
        cat: _('Pop'), // category name
        inc: ['Pop', 'Britpop', 'Worldbeat', 'New Romanticism', 'Chanson', 'Indie'] // defines word prefixes to be included within the particular genre(s)
    },
    {
        cat: _('Rock'),
        inc: ['Rock', 'Metal', 'Grunge', 'Punk', 'Indie', 'Hardcore']
    },
    {
        cat: _('R&B and soul'),
        inc: ['R&B', 'Soul', 'Funk']
    },
    {
        cat: _('Dance'),
        inc: ['Dance', 'Disco', 'House', 'Eurodance', 'Techno', 'Trance', 'Dubstep', 'Hardcore']
    },
    {
        cat: _('Blues'),
        inc: ['Blues']
    },
    {
        cat: _('Jazz'),
        inc: ['Jazz', 'Swing', 'Boogie-woogie']
    },
    {
        cat: _('Latin & Caribbean'),
        inc: ['Latin', 'Caribbean', 'Reggae', 'Rumba', 'Salsa', 'Mambo', 'Ska', 'Tango', 'Flamenco', 'Mariachi', 'Bossa Nova',
            'Bolero', 'Soca', 'Songo', 'Timba', 'Punta', 'Rocksteady', 'Compas', 'Calypso', 'Mozambique']
    },
    {
        cat: _('Electronic'),
        inc: ['Electro', 'Techno', 'Industrial', 'Acid', 'House', 'Trance', 'Ambient', 'Hip-Hop', 'Trip-Hop', 'Dub', 'Big Beat', 'Disco', 'Dance',
            'Jungle', 'Drum & Bass', 'D&B', 'DnB', 'Eurodance', 'Disco', 'Chill-out', 'Downtempo', 'Breakbeat', '2-Step', '8bit']
    },
    {
        cat: _('Country'),
        inc: ['Country', 'Bluegrass', 'Americana', 'Western swing', 'Western swing', 'Honky Tonk', 'Cajun', 'Rockabilly', 'Zydeco', 'Hokum']
    },
    {
        cat: _('Folk'),
        inc: ['Folk', 'Celtic', 'Protest song', 'Chalga', 'Skiffle',]
    },
    {
        cat: _('Easy listening'),
        inc: ['Background' /*music*/, 'Beautiful' /*music*/, 'Elevator' /*music*/, 'Lounge', 'New Age']
    },
    {
        cat: _('Comedy'),
        inc: ['Comedy', 'Parody', 'Novelty' /*music*/]
    },
    {
        cat: _('Classical'),
        inc: ['Classical', 'Avant-Garde', 'Baroque', 'Chamber' /*music*/, 'Chant', 'Choral', 'Early Music', 'Impressionist', 'Medieval',
            'Minimalism', 'Modern Composition', 'Opera', 'Orchestral', 'Renaissance', 'Romantic', 'Wedding' /*music*/]
    },
    {
        cat: _('World'),
        inc: ['World' /*beat*/, 'Ethno', 'Africa', 'Indian', 'Afro-beat', 'Afro-Pop', 'Asia', 'Australia', 'Cajun', 'Calypso', 'Caribbean', 'Carnatic',
            'Celtic', 'Congo', 'Dangdut', 'Europe', 'France', 'Hawaii', 'Hindustani', 'Japan', 'Ode', 'Polka', 'Zydeco']
    }
];

window.uitools.getGenreCategories = function () {
    let ar = window.uitools.predefinedGenreCategories;
    let sl = newStringList();
    forEach(ar, function (itm) {
        sl.add(JSON.stringify(itm));
    });
    return sl;
};

nodeHandlers.genres = inheritNodeHandler('Genres', 'AutoUpdateParent', {
    title: function (node) {
        return _('Genres');
    },
    getViewDataSource: function (view: ViewData, dataSourceType: string) {
        if (dataSourceType == 'tracklist')
            return view.viewNode.dataSource.getTracklist();
        else
        if (dataSourceType == 'genrelist')
            return view.viewNode.dataSource.getGenreList();
        else
            _alert('Unknown/unsupported dataSourceType: ' + dataSourceType);
    },
    hasTreeChildren: () => {
        return window.settings.UI.mediaTree.showAllNodes;
    },
    virtualChildrenSupport: true,
    getChildren: function (node) {
        let viewData = navUtils.getActiveView();
        if (viewData && viewData.currentViewId == 'genreCategories_nodeList') {
            return new Promise(function (resolve, reject) {
                let catList = window.uitools.getGenreCategories();
                let list = node.dataSource.getGenreCategories(catList);
                list.whenLoaded().then(function () {
                    node.addChildren(list, 'genreCategory');
                    resolve();
                });
            }.bind(this));
        } else {
            return nodeUtils.fillFromList(node, node.dataSource.getGenreList(), 'genre');
        }
    },
    icon: 'genre',
    viewAs: () => {
        return ['genreGrid', 'genreCategories_nodeList', 'tracklist', 'groupedTracklist'];
    }
});

nodeHandlers.allGenres = inheritNodeHandler('AllGenres', 'Genres', {
    hasTreeChildren: true,
    getChildren: function (node) {
        return new Promise<void>(function (resolve, reject) {
            let coll = app.collections.getEntireLibrary();
            let list = coll.getGenreList();
            list.whenLoaded().then(function () {
                node.addChildren(list, 'genre');
                resolve();
            });
        });
    },
});
nodeHandlers.rating = inheritNodeHandler('Rating', 'Base', {
    title: function (node) {
        if (node.dataSource.rating < 0)
            return node.dataSource.title;
        else
            return Rating.getHTML({
                starWidth: '1.2em',
                readOnlyPadding: 'none',
                readOnly: true,
                paddingLeft: 0,
                paddingRight: 0,
                value: node.dataSource.rating
            });
    },
    viewAs: function (node) {
        let col = nodeUtils.getNodeCollection(node);
        let ctype = undefined;
        if (col)
            ctype = col.getType();
        if (col && inArray(ctype, ['video', 'tv']))
            return ['videoGrid', 'tracklist', 'seriesGroupedTracklist'];
        else if (col && inArray(ctype, ['musicvideo', 'videopodcast']))
            return ['videoGrid', 'tracklist', 'groupedTracklist'];
        else
            return ['tracklist', 'groupedTracklist'];
    },
    getDropMode: function (dataSource, e) {
        return 'move';
    },
    canDrop: function (dataSource, e) {
        return dnd.isAllowedType(e, 'media');
    },
    drop: function (dataSource, e) {
        dnd.getTracklistAsync(dnd.getDragObject(e)).then(function (tracklist) {
            dataSource.assignTracks(tracklist);
        });
    }    
});
nodeHandlers.ratings = inheritNodeHandler('Ratings', 'Base', {
    title: _('Rating'),
    icon: 'star',
    hasChildren: true,
    hasTreeChildren: true,
    filterSupport: false,
    getChildren: function (node) {
        return new Promise<void>(function (resolve, reject) {
            let collection = nodeUtils.getNodeCollection(node);
            for (let i = 100; i >= 0; i -= 10) {
                if (!node.canceled)
                    node.addChild(collection.getRating(i), 'rating');
            }
            if (!node.canceled)
                node.addChild(collection.getRating(-1), 'rating');
            resolve();
        });
    },
    viewAs: function (node) {
        let col = nodeUtils.getNodeCollection(node);
        let ctype = undefined;
        if (col)
            ctype = col.getType();
        if (col && inArray(ctype, ['video', 'tv']))
            return ['nodeList', 'tracklist', 'seriesGroupedTracklist'];
        else
            return ['nodeList', 'tracklist', 'groupedTracklist'];
    },
});
nodeHandlers.classificationnode = inheritNodeHandler('ClassificationNode', 'Base', {
    title: function (node) {
        return node.dataSource.title;
    },
    setTitle: function (node, value) {
        node.dataSource.title = value;
        if (!value)
            nodeUtils.refreshNodeChildren(node.parent);
    },
    icon: function (node) {
        return node.dataSource.objectType;
    },
    viewAs: function (node) {
        let col = nodeUtils.getNodeCollection(node);
        let ctype = undefined;
        if (col)
            ctype = col.getType();
        if (col && inArray(ctype, ['video', 'tv']))
            return ['tracklist', 'seriesGroupedTracklist'];
        else
            return ['tracklist', 'groupedTracklist'];
    },
    getDropMode: function (dataSource, e) {
        if (dnd.isAllowedType(e, 'media')) // track D&D
            return e.ctrlKey ? 'copy' : 'move';
        else
            return 'move'; // reordering
    },  
    canDrop: function (dataSource, e, callerControl) {
        if (dnd.isAllowedType(e, 'media'))
            return true;  // track D&D / assignment

        let srcObject = dnd.getDragObject(e);
        if (srcObject && dataSource && (dataSource.objectType == srcObject.objectType)) 
            return true; // reordering
    },
    canReorderNodes: true,
    drop: function (dataSource, e, index) {                
        let srcObject = dnd.getDragObject(e);
        let datatype = dnd.getDropDataType(e);     
        if (dnd.isSameControl(e) && srcObject) {
            // reordering                        
            let node = e._dropNode;
            app.db.reorderListItemAsync( srcObject, index).then(() => {
                nodeUtils.refreshNodeChildren(node.parent);
            });
        } else {
            // assignment to tracklist
            let append = dnd.getDropMode(e) == 'copy';
            dnd.getTracklistAsync(srcObject).then(function (tracklist) {
                dataSource.assignTracks(tracklist, append);
            });
        }
    },
    canDelete: true,
    deleteItems: function (nodes) {
        if (nodes.count) {
            nodes.forEach(function (node) {
                let message = sprintf(_('Are you sure you want to remove "%s" ?'), escapeXml(node.dataSource.title));
                messageDlg(message, 'Confirmation', ['btnYes', 'btnNo'], {
                    defaultButton: 'btnYes'
                }, function (result) {
                    if (result.btnID === 'btnYes') {
                        node.dataSource.title = '';
                        nodeUtils.refreshNodeChildren(node.parent);
                    }
                });
            });
        }
    },
});
nodeHandlers.classificationParent = inheritNodeHandler('ClassificationParent', 'Base', {

    onExpanded: function (node) {        
        if (!node.tag.refreshChildren && !node.canceled) {
            node.tag.refreshChildren = function (_tm) {
                // 1500 ms (as 'commonChange' is called every 1000 ms during scan/edits)
                nodeUtils.deferredRefresh(node, 1500 /* deferred - to eliminate cases when 'change' is called too often */);
            };           
            app.listen(app, 'commonChange', node.tag.refreshChildren);
        }
    },

    onCollapsed: function (node) {
        if (node.tag.refreshChildren) {
            nodeUtils.deferredRefreshCancel(node);            
            app.unlisten(app, 'commonChange', node.tag.refreshChildren);
            node.tag.refreshChildren = undefined;
        }        
    },

});
nodeHandlers.tempo = inheritNodeHandler('Tempo', 'ClassificationParent', {
    title: _('Tempo'),
    icon: 'tempo',
    hasChildren: true,
    getChildren: function (node) {
        let col = nodeUtils.getNodeCollection(node);
        return nodeUtils.fillFromList(node, app.db.getTempoList(col.id) as unknown as SharedUIList<SharedObservable>, 'classificationnode');
    },
    viewAs: function (node) {
        let col = nodeUtils.getNodeCollection(node);
        let ctype = undefined;
        if (col)
            ctype = col.getType();
        if (col && inArray(ctype, ['video', 'tv']))
            return ['nodeList', 'tracklist', 'seriesGroupedTracklist'];
        else
            return ['nodeList', 'tracklist', 'groupedTracklist'];
    },   
});
nodeHandlers.mood = inheritNodeHandler('Mood', 'ClassificationParent', {
    title: _('Mood'),
    icon: 'mood',
    hasChildren: true,
    getChildren: function (node) {
        let col = nodeUtils.getNodeCollection(node);
        return nodeUtils.fillFromList(node, app.db.getMoodList(col.id) as unknown as SharedUIList<SharedObservable>, 'classificationnode');
    },
    viewAs: function (node) {
        let col = nodeUtils.getNodeCollection(node);
        let ctype = undefined;
        if (col)
            ctype = col.getType();
        if (col && inArray(ctype, ['video', 'tv']))
            return ['nodeList', 'tracklist', 'seriesGroupedTracklist'];
        else
            return ['nodeList', 'tracklist', 'groupedTracklist'];
    },
});
nodeHandlers.occasion = inheritNodeHandler('Occasion', 'ClassificationParent', {
    title: _('Occasion'),
    icon: 'occasion',
    hasChildren: true,
    getChildren: function (node) {
        let col = nodeUtils.getNodeCollection(node);
        return nodeUtils.fillFromList(node, app.db.getOccasionList(col.id) as unknown as SharedUIList<SharedObservable>, 'classificationnode');
    },
    viewAs: function (node) {
        let col = nodeUtils.getNodeCollection(node);
        let ctype = undefined;
        if (col)
            ctype = col.getType();
        if (col && inArray(ctype, ['video', 'tv']))
            return ['nodeList', 'tracklist', 'seriesGroupedTracklist'];
        else
            return ['nodeList', 'tracklist', 'groupedTracklist'];
    },
});
nodeHandlers.quality = inheritNodeHandler('Quality', 'ClassificationParent', {
    title: _('Quality'),
    icon: 'quality',
    hasChildren: true,
    getChildren: function (node) {
        let col = nodeUtils.getNodeCollection(node);
        return nodeUtils.fillFromList(node, app.db.getQualityList(col.id) as unknown as SharedUIList<SharedObservable>, 'classificationnode');
    },
    viewAs: function (node) {
        let col = nodeUtils.getNodeCollection(node);
        let ctype = undefined;
        if (col)
            ctype = col.getType();
        if (col && inArray(ctype, ['video', 'tv']))
            return ['nodeList', 'tracklist', 'seriesGroupedTracklist'];
        else
            return ['nodeList', 'tracklist', 'groupedTracklist'];
    },
});
nodeHandlers.classification = inheritNodeHandler('Classification', 'Base', {
    title: _('Classification'),
    icon: 'organize',
    hasChildren: true,
    hasTreeChildren: true,
    filterSupport: false,
    getChildren: function (node) {
        return new Promise<void>(function (resolve, reject) {
            let collection = nodeUtils.getNodeCollection(node);
            node.addChild(collection, 'tempo');
            node.addChild(collection, 'mood');
            node.addChild(collection, 'occasion');
            node.addChild(collection, 'quality');
            resolve();
        });
    },
    viewAs: function (node) {
        let col = nodeUtils.getNodeCollection(node);
        let ctype = undefined;
        if (col)
            ctype = col.getType();
        if (col && inArray(ctype, ['video', 'tv']))
            return ['nodeList', 'tracklist', 'seriesGroupedTracklist'];
        else
            return ['nodeList', 'tracklist', 'groupedTracklist'];
    },
});
nodeHandlers.unclassified_files = inheritNodeHandler('UnclassifiedFiles', 'Base', {
    title: function (node) {
        return node.dataSource.title;
    },
    icon: function (node) {
        return node.dataSource.icon;
    },
    viewAs: function (node) {
        let col = nodeUtils.getNodeCollection(node);
        let ctype = undefined;
        if (col)
            ctype = col.getType();
        if (col && inArray(ctype, ['video', 'tv']))
            return ['nodeList', 'tracklist', 'seriesGroupedTracklist'];
        else
            return ['nodeList', 'tracklist', 'groupedTracklist'];
    },
    hasChildren: true,
    getChildren: function (node) {
        return new Promise<void>(function (resolve, reject) {
            let collection = nodeUtils.getNodeCollection(node);
            node.addChild(app.db.getFilesToEditNode(node.dataSource.id, 'unclassified_tempo', ''), 'files_to_edit_default');
            node.addChild(app.db.getFilesToEditNode(node.dataSource.id, 'unclassified_mood', ''), 'files_to_edit_default');
            node.addChild(app.db.getFilesToEditNode(node.dataSource.id, 'unclassified_occasion', ''), 'files_to_edit_default');
            node.addChild(app.db.getFilesToEditNode(node.dataSource.id, 'unclassified_quality', ''), 'files_to_edit_default');
            resolve();
        });
    },
});
nodeHandlers.disconnected_files = inheritNodeHandler('DisconnectedFiles', 'Base', {
    title: function (node) {
        return node.dataSource.title;
    },
    icon: function (node) {
        return node.dataSource.icon;
    },
    viewAs: function (node) {
        let col = nodeUtils.getNodeCollection(node);
        let ctype = undefined;
        if (col)
            ctype = col.getType();
        if (col && inArray(ctype, ['video', 'tv']))
            return ['nodeList', 'tracklist', 'seriesGroupedTracklist'];
        else
            return ['nodeList', 'tracklist', 'groupedTracklist'];
    },
    getChildren: function (node) {
        return new Promise<void>(function (resolve, reject) {
            node.loadPromise = app.filesystem.getDBFolderListAsync(0, node.dataSource.id).whenLoaded();
            node.loadPromise.then(function (list) {
                listAsyncForEach(list, function (item, next) {
                    app.utils.isAccessibleMediaAsync(item.idMedia).then((accessible) => {
                        if (!accessible && !inArray(item.icon, ['youtube', 'internet']))
                            node.addChild(item, 'dbfolder');
                        next();
                    });
                });
                if (!node.canceled)
                    list.updateHasSubfoldersAsync();
                resolve();
            }, resolve);
        });
    }
});
nodeHandlers.multiple_artist_albums = inheritNodeHandler('MultArtistAlbums', 'Base', {
    title: function (node) {
        return node.dataSource.title;
    },
    icon: function (node) {
        return node.dataSource.icon;
    },
    viewAs: ['nodeList', 'ungroupedAlbumsGroupedTracklist'],
    hasChildren: true,
    getChildren: function (node) {
        return new Promise<void>(function (resolve, reject) {
            node.loadPromise = node.dataSource.getAlbumList().whenLoaded();
            node.loadPromise.then(function (list) {
                fastForEach(list, function (album) {
                    if (!node.canceled)
                        node.addChild(app.db.getFilesToEditNode(node.dataSource.id, 'multiple_artist_album', album.title), 'files_to_edit_default');
                });
                //node.addChildren(list, 'files_to_edit_default');
                resolve();
            }, resolve);
        });
    }
});

nodeHandlers.ungrouped_multiple_artist_albums = inheritNodeHandler('UngroupedMultArtistAlbums', 'Base', {
    title: function (node) {
        return node.dataSource.title;
    },
    tooltip: function (node) {
        return _('Album Artist is not the same across tracks on an album.');
    },
    icon: function (node) {
        return node.dataSource.icon;
    },
    getStateRootKey: function (coll) {
        return 'UNGROUPED_ALBUMS_NODE' + (coll ? '_' + coll.id : '');
    },
    viewAs: ['nodeList', 'ungroupedAlbumsGroupedTracklist'],
    hasChildren: true,
    getChildren: function (node) {
        return new Promise<void>(function (resolve, reject) {
            node.loadPromise = node.dataSource.getAlbumList().whenLoaded();
            node.loadPromise.then(function (list) {
                fastForEach(list, function (album) {
                    if (!node.canceled)
                        node.addChild(app.db.getFilesToEditNode(node.dataSource.id, 'ungrouped_multiple_artist_album', album.description, album.title), 'files_to_edit_default');
                });
                //node.addChildren(list, 'files_to_edit_default');
                resolve();
            }, resolve);
        });
    },
    getDefaultColumns: function (col) {
        if (col) {
            let coltype = col.getType();
            if (coltype == 'music')
                return ['title', 'artist', 'album', 'albumArtist', 'date', 'genre', 'rating', 'length', 'source', 'path', 'filename'];
            else
            if (coltype == 'classicalmusic')
                return ['title', 'artist', 'composer', 'album', 'albumArtist', 'date', 'genre', 'rating', 'length', 'source', 'path', 'filename'];
            else
            if (coltype == 'audiobook')
                return ['title', 'artist', 'album', 'albumArtist', 'order', 'date', 'genre', 'rating', 'length', 'playCounter'];
            else
            if (coltype == 'musicvideo')
                return ['title', 'artist', 'album', 'albumArtist', 'date', 'genre', 'rating', 'length', 'source', 'path', 'filename'];
        }
        return ['title', 'artist', 'album', 'albumArtist', 'date', 'genre', 'rating', 'length', 'source', 'path', 'filename'];
    }
});

nodeHandlers.files_to_edit_default = inheritNodeHandler('FilesToEditDefault', 'Base', {
    title: function (node) {
        return node.dataSource.title;
    },
    icon: function (node) {
        return node.dataSource.icon;
    },
    viewAs: ['tracklist', 'groupedTracklist']
});
nodeHandlers.files_to_edit_with_hightlight = inheritNodeHandler('FilesToEditWithHighlight', 'FilesToEditDefault', {
    getDefaultColumns: function () {
        return ['title', 'artist', 'album', 'albumArtist', 'date', 'genre', 'rating', 'bpm', 'origDate', 'trackNumber', 'discNumber', 'author', 'producer', 'lyricist', 'conductor', 'grouping', 'involvedPeople', 'parentalRating', 'origArtist', 'origAlbumTitle',
            'normalize', 'normalizeAlbum', 'comment', 'lyrics', 'extendedTags']; // #19480
    },
    tooltip: _('This finds all tracks with tags that don\'t match the database, highlighting the mismatched values. If tracks don\'t show highlighted fields, try enabling additional columns.'),
    highlightSupported: true,
});
nodeHandlers.files_to_edit_unorganized = inheritNodeHandler('FilesToEditUnorganized', 'FilesToEditDefault', {
    organizedPathColumnSupported: true
});
nodeHandlers.files_to_edit_duplicate_content = inheritNodeHandler('FilesToEditDuplicateContent', 'FilesToEditDefault', {
    tooltip: _('This node finds all content for which tracks have duplicate hashes or fingerprints.'),
    customizable: false,
    collapseSupport: false,
    viewAs: ['contentGroupedTracklist'],
    defaultColumnSort: 'none', // to respect order served by content
});

nodeHandlers.inconsistent_artwork = inheritNodeHandler('FilesToEditInconsistentArtwork', 'FilesToEditDefault', {
    tooltip: _('Artwork is not the same across tracks on an album.')
});

nodeHandlers.dead_links = inheritNodeHandler('FilesToEditDeadLinks', 'FilesToEditDefault', {
    tooltip: _('Files have been deleted or moved.')
});

nodeHandlers.filestoedit = inheritNodeHandler('FilesToEdit', 'Base', {
    title: _('Files to Edit'),
    icon: 'edit',
    hasChildren: true,
    hasTreeChildren: true,
    filterSupport: false,
    getFilesToEditSubNodes: function (coltype) {
        let fe_nodes;

        switch (coltype) {
        case 'music':
            return ['unknown_title', 'unknown_artist', 'unknown_composer', 'unknown_conductor', 'unknown_album', 'unknown_genre', 'unknown_year', 'unknown_rating',
                'unclassified_files', 'unknown_artwork', 'inconsistent_artwork', 'multiple_artist_albums', 'ungrouped_multiple_artist_albums', 'dead_links', 'disconnected_links', 'unanalyzed_volume', 'unorganized_files', 'unsynchronized_tags', 'duplicate_artist_titles', 'duplicate_titles', 'duplicate_content'];
        case 'musicvideo':
            return ['unknown_title', 'unknown_artist', 'unknown_composer', 'unknown_conductor', 'unknown_album', 'unknown_genre', 'unknown_year', 'unknown_rating',
                'unclassified_files', 'unknown_artwork', 'inconsistent_artwork', 'multiple_artist_albums', 'ungrouped_multiple_artist_albums', 'dead_links', 'disconnected_links', 'unorganized_files', 'unsynchronized_tags', 'duplicate_artist_titles', 'duplicate_titles', 'duplicate_content'];
        case 'video':
        case 'tv':
            return ['unknown_title', 'unknown_director', 'unknown_producer', 'unknown_actors', 'unknown_series', 'unknown_genre', 'unknown_year', 'unknown_rating',
                'unknown_artwork', 'inconsistent_artwork', 'dead_links', 'disconnected_links', 'unorganized_files', 'unsynchronized_tags', 'duplicate_artist_titles', 'duplicate_artist_titles', 'duplicate_titles', 'duplicate_content'];
        case 'audiobook':
            return ['unknown_title', 'unknown_artist', 'unknown_album', 'unknown_genre', 'unknown_year', 'unknown_rating',
                'unclassified_files', 'unknown_artwork', 'inconsistent_artwork', 'multiple_artist_albums', 'ungrouped_multiple_artist_albums', 'dead_links', 'disconnected_links', 'unanalyzed_volume', 'unorganized_files', 'unsynchronized_tags', 'duplicate_artist_titles', 'duplicate_titles', 'duplicate_content'];
        case 'podcast':
            return ['unknown_title', 'unknown_artist', 'unknown_podcast', 'unknown_genre', 'unknown_year', 'unknown_rating',
                'unclassified_files', 'unknown_artwork', 'inconsistent_artwork', 'dead_links', 'disconnected_links', 'unanalyzed_volume', 'unorganized_files', 'unsynchronized_tags', 'duplicate_artist_titles', 'duplicate_titles', 'duplicate_content'];
        case 'videopodcast':
            return ['unknown_title', 'unknown_artist', 'unknown_podcast', 'unknown_genre', 'unknown_year', 'unknown_rating',
                'unclassified_files', 'unknown_artwork', 'inconsistent_artwork', 'dead_links', 'disconnected_links', 'unorganized_files', 'unsynchronized_tags', 'duplicate_artist_titles', 'duplicate_titles', 'duplicate_content'];
        default:
            return ['unknown_title', 'unknown_artist', 'unknown_producer', 'unknown_actors', 'unknown_composer', 'unknown_conductor', 'unknown_album', 'unknown_genre', 'unknown_year', 'unknown_rating',
                'unclassified_files', 'unknown_artwork', 'inconsistent_artwork', 'multiple_artist_albums', 'ungrouped_multiple_artist_albums', 'dead_links', 'disconnected_links', 'unanalyzed_volume', 'unorganized_files', 'unsynchronized_tags', 'duplicate_artist_titles', 'duplicate_titles', 'duplicate_content'];
        }
    },
    getFilesToEditSubNodeHandlerID: function (nodeType) {
        switch (nodeType) {
        case 'unclassified_files':
        case 'multiple_artist_albums':
        case 'ungrouped_multiple_artist_albums':
        case 'inconsistent_artwork':
        case 'dead_links':
            return nodeType;
        case 'disconnected_links':
            return 'disconnected_files';
        case 'unorganized_files':
            return 'files_to_edit_unorganized';
        case 'unsynchronized_tags':
            return 'files_to_edit_with_hightlight';
        case 'duplicate_content':
            return 'files_to_edit_duplicate_content';
        default:
            return 'files_to_edit_default';
        }
    },
    getChildren: function (node) {
        return new Promise(function (resolve, reject) {
            let collection = nodeUtils.getNodeCollection(node);
            let collID = collection.id;
            let fe_nodes = this.getFilesToEditSubNodes(collection.getType());

            forEach(fe_nodes, function (nodeType) {
                node.addChild(app.db.getFilesToEditNode(collID, nodeType, ''), this.getFilesToEditSubNodeHandlerID(nodeType));
            }.bind(this));
            resolve();
        }.bind(this));
    },
    viewAs: ['nodeList']
});

nodeHandlers.dbfolder = inheritNodeHandler('DBFolder', 'FolderDropTarget', {
    dbContent: true,
    helpContext: 'Library#Location',
    title: function (node) {
        return node.dataSource.title;
    },
    setTitle: function (node, value) {
        node.dataSource.title = value;
    },
    icon: function (node) {
        return node.dataSource.icon;
    },
    hasChildren: function (node) {
        return node.dataSource.hasSubfolders;
    },
    onExpanded: function (node) {
        if (!node.tag.refreshChildren && !node.canceled) {
            node.tag.refreshChildren = function (e) {
                // e.g. when a track.path changed (or all tracks were deleted from the folder)
                let n = node;
                while (n) {
                    nodeUtils.deferredRefresh(n, // deferred - to eliminate cases when 'change' is called too often
                        1500); // 1500 ms (as 'commonChange' is called every 1000 ms during scan/edits)
                    n = n.parent;
                }
            };
            app.listen(app, 'commonChange', node.tag.refreshChildren);
        }
    },
    onCollapsed: function (node) {
        if (node.tag.refreshChildren) {
            nodeUtils.deferredRefreshCancel(node);
            app.unlisten(app, 'commonChange', node.tag.refreshChildren);
            node.tag.refreshChildren = undefined;
        }
    },
    getChildren: function (node) {
        return new Promise<void>(function (resolve, reject) {
            let list = node.dataSource.getChildren();
            node.loadPromise = list.whenLoaded();
            list.whenLoaded().then(function () {
                node.addChildren(list, 'dbfolder');
                if (!node.canceled) {
                    list.updateHasSubfoldersAsync().then(function () {
                        resolve();
                    });
                } else
                    resolve();
            }, resolve);
        });
    },
    getViewDataSource: function (view: ViewData) {
        return view.viewNode.dataSource.getTracklist(window.includeSubfoldersInLocations || false);
    },
    multiselect: true,
    canDelete: true,
    deleteItems: function (nodes, permanent) {
        if (permanent)
            nodeHandlers.folder.deleteItems(nodes, permanent);
        else
        if (nodes.count) {
            let tracks = app.utils.createTracklist();
            let promises = [];
            nodes.forEach(function (node) {
                promises.push(node.dataSource.getTracklist(true /* include all subfolders when deleting folder from DB */).whenLoaded().then(function (list) {
                    tracks.addList(list);
                }));
            });
            whenAll(promises).then(function () {
                tracks.notifyLoaded();
                if (tracks.count) {
                    uitools.deleteTracklist(tracks).then(function (removed) {
                        if (removed) {
                            if ((removed.length == 1) && (removed[0] == ''))
                                return;
                            nodes.forEach(function (node) {
                                node.dataSource.deleted = true; // to remove the folder (dataSource) and thus this node also
                            });
                        }
                    });
                } else {
                    // LS: following is here to resolve #20230
                    nodes.forEach(function (node) {
                        node.dataSource.deleted = true; // to remove the folder (dataSource) and thus this node also
                    });
                }
            });
        }
    },
    formatStatus: function (data) {
        return statusbarFormatters.formatDefaultSimpleStatus(data, function (cnt) {
            return _('folder', 'folders', cnt);
        });
    },
    includeSubfoldersSupport: true,
    menu: function (node) {
        let menuItems = [];
        menuItems.push({
            action: actions.scan,
            order: 10,
            grouporder: 10
        });
        menuItems.push({
            action: actions.openExplorer,
            order: 20,
            grouporder: 10
        });
        if ((resolveToValue(node.dataSource.parentID, -1) == 0) ||
            (node.parent && node.parent.dataSource && (node.parent.dataSource.title.substring(0, 1) === '\\' /* network */))) {
            menuItems.push({
                action: {
                    title: _('Media Properties'),
                    icon: 'options',
                    execute: function () {
                        uitools.openMediaProperties(node.dataSource).then(function () {
                            nodeUtils.refreshNodeChildren(node.parent);
                        });
                    }
                },
                order: 20,
                grouporder: 10,
            });
        }
        return menuItems;
    }
});
nodeHandlers.location = inheritNodeHandler('Location', 'BaseLocation', {
    title: function (node) {
        return _('Location');
    },
    icon: 'folder',
    hasChildren: function (node) {
        return true; // TODO
    },
    _addDevices: function (node) {
        return nodeUtils.getDevicesBy(node, {
            hasTracksInLib: true
        }, 'deviceContentInLibrary');
    },

    onExpanded: function (node) {
        if (!node.tag.refreshChildren && !node.canceled) {
            node.tag.refreshChildren = function (e) {
                // e.g. when a track.path changed or all tracks were deleted from the media                
                nodeUtils.deferredRefresh(node);
            };
            app.listen(app, 'commonChange', node.tag.refreshChildren);
        }
    },

    onCollapsed: function (node) {
        if (node.tag.refreshChildren) {
            nodeUtils.deferredRefreshCancel(node);
            app.unlisten(app, 'commonChange', node.tag.refreshChildren);
            node.tag.refreshChildren = undefined;
        }
    },

    getChildren: function (node) {
        let _this = this;
        return new Promise<void>(function (resolve, reject) {
            node.loadPromise = app.filesystem.getDBFolderListAsync(0, node. /*parent.*/ dataSource.id).whenLoaded();
            node.loadPromise.then(function (list) {
                node.addChildren(list, 'dbfolder');
                if (!node.canceled)
                    list.updateHasSubfoldersAsync();

                if (!node.canceled)
                    _this._addDevices(node).then(resolve);
                else
                    resolve();
            }, resolve);
        });
    },
    viewAs: ['nodeList', 'rowNodeList'],
});
nodeHandlers.filetypesroot = inheritNodeHandler('FileTypesRoot', 'Base', {
    getChildren: function (node) {
        return new Promise<void>(function (resolve, reject) {
            node.addChild(null, 'audioFileExts');
            node.addChild(null, 'videoFileExts');
            node.addChild(null, 'playlistFileExts');
            resolve();
        });
    },
});
nodeHandlers.audioFileExts = inheritNodeHandler('AudioFileExts', 'Base', {
    title: function (node) {
        return _('Audio');
    },
    hasChildren: function (node) {
        return true;
    },
    getChildren: function (node) {
        return new Promise<void>(function (resolve, reject) {
            app.filesystem.getAudioExtensionsAsync().whenLoaded().then(function (l) {
                node.addChildren(l, 'fileext');
                resolve();
            });
        });
    },
    canBeCollapsed: false
});
nodeHandlers.videoFileExts = inheritNodeHandler('VideoFileExts', 'Base', {
    title: function (node) {
        return _('Video');
    },
    hasChildren: function (node) {
        return true;
    },
    getChildren: function (node) {
        return new Promise<void>(function (resolve, reject) {
            app.filesystem.getVideoExtensionsAsync().whenLoaded().then(function (l) {
                node.addChildren(l, 'fileext');
                resolve();
            });
        });
    },
    canBeCollapsed: false
});
nodeHandlers.playlistFileExts = inheritNodeHandler('PlaylistFileExts', 'Base', {
    title: function (node) {
        return _('Playlists');
    },
    hasChildren: function (node) {
        return true;
    },
    getChildren: function (node) {
        return new Promise<void>(function (resolve, reject) {
            app.filesystem.getPlaylistExtensionsAsync().whenLoaded().then(function (l) {
                node.addChildren(l, 'fileext');
                resolve();
            });
        });
    },
    canBeCollapsed: false
});
nodeHandlers.fileext = inheritNodeHandler('FileExt', 'Base', {
    title: function (node) {
        return node.dataSource.title;
    },
    hasChildren: function (node) {
        return false;
    },
});
nodeHandlers.web = inheritNodeHandler('Web', 'Base', {
    title: function (node) {
        if (!node.dataSource)
            return _('Web');
        else
            return resolveToValue(node.dataSource.title, _('Web'));
    },
    icon: 'internet',
    onExpanded: function (node) {
        if (!this._list) {
            this._list = app.getWebPages();
        }
        node.tag.onWebsChanged = function () {
            nodeUtils.deferredRefresh(node);
        };
        app.listen(this._list as WebNodesList, 'change', node.tag.onWebsChanged);
    },
    onCollapsed: function (node) {
        nodeUtils.deferredRefreshCancel(node);
        if (this._list) {
            app.unlisten(this._list, 'change', node.tag.onWebsChanged);
            this._list = undefined;
        }
    },
    hasChildren: function (node) {
        return !node.dataSource;
    },
    getChildren: function (node) {
        let _this = this;
        return new Promise<void>(function (resolve, reject) {
            if (!_this._list) {
                _this._list = app.getWebPages();
            }
            _this._list.whenLoaded().then(function (list) {
                node.addChildren(list, 'web');

                node.addChild(null, 'radio');
                resolve();
            });
        });
    },
    hideDefaultMenu: true,
    menu: function (node) {
        return [{
            action: actions.addWeb,
            order: 10,
            grouporder: 5
        }, {
            action: {
                title: function () {
                    return _('Edit bookmark');
                },
                execute: function () {
                    uitools.addLink.call(this, 'addWebPage', node.dataSource);
                },
                visible: function () {
                    return node.dataSource && (node.dataSource.id !== -1);
                },
            },
            order: 20,
            grouporder: 5
        }, {
            action: {
                title: function () {
                    return _('Remove bookmark');
                },
                execute: function () {
                    app.deleteWebPage(node.dataSource.id);
                },
                visible: function () {
                    return node.dataSource && (node.dataSource.id !== -1);
                },
            },
            order: 30,
            grouporder: 5
        }];
    },
    viewAs: function (node) {
        if ((!node.dataSource) && (node.level > 1))
            return ['nodeList'];
        else
            return ['webBrowser'];
    }
});
nodeHandlers.webPage = inheritNodeHandler('WebPage', 'Base', {
    title: function (node) {
        if (!node.dataSource)
            return _('Web');
        else
            return resolveToValue(node.dataSource.title, _('Web'));
    },
    icon: 'internet',
    viewAs: function (node) {
        return ['webBrowser'];
    }
});
nodeHandlers.findTitle = inheritNodeHandler('FindTitle', 'Base', {
    title: function (node) { 
        return node.dataSource.title;
    },
    icon: 'search',
    hasChildren: false,
    viewAs: ['tracklist'],
    getStateRootKey: function () {
        return 'CONTROLS_STATE_FIND_TITLE';
    },
    getViewDataSource: function (view) {
        let title = '';
        if (view.viewNode.dataSource)
            title = view.viewNode.dataSource.title.replace(/'/g, '\'\'');
        return app.db.getTracklist('SELECT * FROM Songs WHERE (Songs.SongTitle=\''+ title +'\')', -1);
    }
});
nodeHandlers.radio = inheritNodeHandler('radio', 'Observable', {
    title: function (node) {
        if (!node.dataSource)
            return _('Radio');
        else
            return resolveToValue(node.dataSource.title, _('Radio'));
    },
    icon: 'radio',
    onExpanded: function (node) {
        if (!this._list) {
            this._list = app.getRadioPages();
        }
        node.tag.onRadioChanged = function () {
            nodeUtils.deferredRefresh(node);
        };
        app.listen(this._list as WebNodesList, 'change', node.tag.onRadioChanged);
    },
    onCollapsed: function (node) {
        nodeUtils.deferredRefreshCancel(node);
        if (this._list) {
            app.unlisten(this._list, 'change', node.tag.onRadioChanged);
            this._list = undefined;
        }
    },
    hasChildren: function (node) {
        return !node.dataSource; // TODO: add links to stations
    },
    getChildren: function (node) {
        let _this = this;
        return new Promise<void>(function (resolve, reject) {
            if (!_this._list) {
                _this._list = app.getRadioPages();
            }
            _this._list.whenLoaded().then(function (list) {
                node.addChildren(list, 'radio');
                resolve();
            });
        });
    },
    hideDefaultMenu: true,
    menu: function (node) {
        return [{
            action: actions.addRadio,
            order: 10,
            grouporder: 5
        }, {
            action: {
                title: function () {
                    return _('Edit bookmark');
                },
                execute: function () {
                    uitools.addLink.call(this, 'addRadioPage', node.dataSource);
                },
                visible: function () {
                    return node.dataSource && (node.dataSource.id !== -1);
                },
            },
            order: 20,
            grouporder: 5
        }, {
            action: {
                title: function () {
                    return _('Remove bookmark');
                },
                execute: function () {
                    app.deleteRadioPage(node.dataSource.id);
                },
                visible: function () {
                    return node.dataSource && (node.dataSource.id !== -1);
                },
            },
            order: 30,
            grouporder: 5
        }];
    },
    viewAs: function (node) {
        if (!node.dataSource)
            return ['nodeList'];
        else
            return ['webBrowser'];
    }
});
nodeHandlers.pinned = inheritNodeHandler('pinned', 'Observable', {
    title: function (node) {
        return _('Pinned');
    },
    icon: 'pin',
    helpContext: 'My Computer#Pinned',
    getDropMode: function (dataSource, e) {
        return 'copy';
    },
    canDrop: function (dataSource, e) {
        let dragObject = dnd.getDragObject(e);
        if (dragObject) {
            if (dragObject.count) // it is a list
                dragObject = getValueAtIndex(dragObject, 0);
            if (dragObject.setPinned /* pineable object */ && dragObject.supportPin)
                return true;
        }
    },
    drop: function (dataSource, e) {
        let dragObject = dnd.getDragObject(e);
        if (dragObject.count) { // it is a list
            listForEach(dragObject, (item) => {
                let act = bindAction(actions.pin, item);
                act.execute();
            });
            dragObject = dragObject.focusedItem;
        } else {
            let act = bindAction(actions.pin, dragObject);
            act.execute();
        }
    },
    hasChildren: function (node) {
        return true;
    },
    getChildren: function (node) {
        return new Promise<void>(function (resolve, reject) {
            node.dataSource.whenLoaded().then(function (list) {
                let tmpList = [];
                let promises = [];
                list.forEach(function (item) {
                    let tmpItem: AnyDict = {
                        item: item
                    };
                    if (item.objectType !== 'album') {
                        tmpItem.type = item.objectType;
                    } else {
                        promises.push(item.getTrackTypeAsync().then(function (tt) {
                            if ((tt === 'tv') || (tt === 'video'))
                                tmpItem.type = 'series';
                            else
                                tmpItem.type = 'album';
                        }));
                    }
                    tmpList.push(tmpItem);
                });
                whenAll(promises).then(function () {
                    tmpList.forEach(function (tmpItem) {
                        node.addChild(tmpItem.item, tmpItem.type);
                    });
                    resolve();
                });
            });
        });
    },
    viewAs: ['pinnedListView']
});

requirejs('controls/nowplayingview');
let np_viewAsArray = [];
nowPlayingLayouts.sort((a, b) => {
    return a.priority - b.priority;
});
for (let i = 0; i < nowPlayingLayouts.length; i++) {
    let layout = nowPlayingLayouts[i];
    let viewHandler_id = layout.classname;
    assert(!viewHandlers[viewHandler_id], viewHandler_id + ' is already used in viewhandlers!');
    viewHandlers[viewHandler_id] = inheritHandler(viewHandler_id, 'Base', {
        title: layout.title,
        icon: layout.icon,
        controlClass: 'NowPlayingView',
        controlClass_initParams: {
            layout: layout,
        },
        onShow: function (control, view) {
            if (control.controlClass.onShow)
                control.controlClass.onShow();
        },
        onHide: function (control, view) {
            if (control.controlClass.onHide)
                control.controlClass.onHide();
        },
        toolbarActions: layout.toolbarActions,
        subViews: layout.subViews,
        disableLastControlEnlarge: true
    });
    np_viewAsArray.push(viewHandler_id);
}

nodeHandlers.npview = inheritNodeHandler('npview', 'Base', {
    title: _('Playing'),
    icon: 'song',
    helpContext: 'Now Playing',
    customizable: false,
    orderColumnSupport: true,
    getDefaultColumns: function () {
        return ['playOrder', 'title', 'artist', 'album', 'date', 'genre', 'rating', 'length', 'source', 'path', 'filename'];
    },
    viewAs: function () {
        return np_viewAsArray;
    },
    canDrop: function (dataSource, e) {
        if (dnd.isSameControl(e)) {
            if (!dataSource)
                return false;
            let datatype = dnd.getDropDataType(e);
            let wasPlaylistObject = datatype == 'playlist';
            if (wasPlaylistObject) { // D&D on mediatree
                return (dataSource.objectType == 'playlist');
            } else { // reorder tracks
                return !dataSource.isAutoPlaylist && (datatype == 'track');
            }
        } else
            return dnd.isAllowedType(e, 'media');
    },
    drop: function (dataSource, e, index) {
        let list = dnd.getDragObject(e);
        if (list) {
            dnd.getTracklistAsync(list).then(function (l) {
                app.player.addTracksAsync(l, {
                    position: -1,
                });
            });
        }
    },
    canSaveNewOrder: function (node) {
        return true;
    },
    canReorderItemsInView: true,
    itemsInViewReordered: function (dataSource, e) {
        let ctrl = e.dataTransfer.getSourceControl();
        if (ctrl && ctrl.controlClass) {
            ctrl.controlClass.autoSortString = '';
            dataSource.reorderAsync(ctrl.controlClass.dataSource);
            uitools.cleanUpSaveButton(null);
        }
    },
    defaultColumnSort: 'playOrder ASC',
    menu: function (node) {
        let menuItems = [];
        menuItems.push({
            action: actions.nowplaying.undo,
            order: 10,
            grouporder: 90
        });
        menuItems.push({
            action: actions.nowplaying.redo,
            order: 20,
            grouporder: 90
        });
        menuItems.push({
            action: actions.nowplaying.cleanInaccessible,
            order: 30,
            grouporder: 90
        });
        menuItems.push({
            action: actions.nowplaying.clear,
            order: 40,
            grouporder: 90,
        });
        menuItems.push({
            action: actions.nowplaying.removeDuplicates,
            order: 50,
            grouporder: 90
        });
        menuItems.push({
            action: actions.nowplaying.reverseList,
            order: 70,
            grouporder: 90
        });
        menuItems.push({
            action: actions.savePlaylistFromNowPlaying,
            order: 80,
            grouporder: 90
        });
        menuItems.push({
            action: actions.autoDJ,
            order: 90,
            grouporder: 90
        });
        return menuItems;
    }
});

nodeHandlers.root = inheritNodeHandler('Root', 'Base', {
    title: function (node) {
        return ' '; //_('Go home');
    },
    icon: 'home',
    hasChildren: true,
    canBeCollapsed: false,

    onExpanded: function (node) {
        let _this = this;
        node.tag.refreshChildren = function () {
            nodeUtils.deferredRefresh(node);
        };
        node.tag.refreshDownloads = function () {
            let vis = (app.downloader.getDownloadsCount() > 0);
            if (node.tag._downloadsVisibility != vis)
                nodeUtils.refreshNodeChildren(node);
            if (node.tag._downloadsNode)
                node.tag._downloadsNode.notifyChanged(); // to force repaint of downloads count
            node.tag._downloadsVisibility = vis;
        };
        app.listen(app.downloader.itemList, 'change', node.tag.refreshDownloads);
        app.listen(app.filesystem.getInsertedMediaList(), 'change', node.tag.refreshChildren);
        app.listen(app.collections, 'change', node.tag.refreshChildren);
    },

    onCollapsed: function (node) {
        nodeUtils.deferredRefreshCancel(node);
        app.unlisten(app.downloader.itemList, 'change', node.tag.refreshDownloads);
        app.unlisten(app.collections, 'change', node.tag.refreshChildren);
        app.unlisten(app.filesystem.getInsertedMediaList(), 'change', node.tag.refreshChildren);
        node.tag.refreshChildren = undefined;
    },

    getNodeVisibility: function (node, dataSource, handlerID, order) {
        let _this = this;
        let state = this._mediaTreeItems;

        let canAdd = true;
        let id = 0;
        let visible = 1;
        if (handlerID == 'collection') {
            id = dataSource.id;
            visible = dataSource.visibleInMainTree;
        }

        let found = false;
        for (let j = 0; j < state.treeNodes.length; j++) {
            let nodeState = state.treeNodes[j];
            if (((handlerID == 'collection') && ((nodeState.itemType == 'collection') && (nodeState.id == id))) ||
                ((handlerID != 'collection') && (nodeState.itemType == handlerID))) {

                visible = nodeState.visible;
                found = true;
                break;
            }
        }
        if (!found && (handlerID !== 'loading')) {

            let position = order || state.treeNodes.length;
            let handler = nodeHandlers[handlerID];
            if (handler && handler.defaultPosition !== undefined)
                position = handler.defaultPosition;

            state.treeNodes.push({
                itemType: handlerID,
                id: id,
                pos: position,
                visible: visible
            });
            app.setValue('mediaTreeItems', state);
        }
        let hasData = true;
        if (handlerID == 'collection')
            hasData = !dataSource.getCachedIsEmpty();

        if ((visible == 0) || (visible == 2 && !hasData)) {
            canAdd = false;
        }

        return canAdd;
    },

    registerNodeVisibility: function (node) {
        this.getNodeVisibility(node, node.dataSource, node.handlerID);
    },

    // this finish method is called when all nodes are added to the list (even from scripts) just to sort nodes
    sortNodesAndVisibility: function (node) {
        let _this = this;
        let state = this._mediaTreeItems;

        // sort items
        let list = node.children;
        if (list) {
            list.locked(function () {
                for (let i = 0; i < list.count; i++) {
                    let listItem = list.getValue(i);
                    let id = listItem.id;
                    if (listItem.collection)
                        id = listItem.collection.id;
                    let objectType = resolveToValue(listItem.handlerID, '');

                    let handler = nodeHandlers[listItem.handlerID];
                    if (handler && handler.defaultPosition !== undefined)
                        listItem.pos = handler.defaultPosition;
                    else
                        listItem.pos = i;

                    let found = false;
                    for (let j = 0; j < state.treeNodes.length; j++) {
                        let nodeState = state.treeNodes[j];
                        if (((objectType == 'collection') && ((nodeState.itemType == 'collection') && (nodeState.id == id))) ||
                            ((objectType != 'collection') && (nodeState.itemType == objectType))) {

                            //ODS('sortNodesAndVisibility: ' + objectType + '|' + nodeState.id + ' [' + listItem.pos + ' -> ' + nodeState.pos + ']')
                            listItem.pos = nodeState.pos;
                            found = true;
                            break;
                        }
                    }
                    if (!found) {
                        if (listItem.collection) {
                            //ODS('sortNodesAndVisibility: not found ' + objectType + '|' + id + ' [' + listItem.pos + ' -> ' + listItem.collection.pos + ']')
                            listItem.pos = listItem.collection.pos;

                        } else {
                            ODS('Node with objectType ' + objectType + ' and id ' + id + ' not found!!');
                        }
                    }
                }

                let dups = {};
                listForEach(list, (itm) => {
                    // at first multiply the position by 10 to get "holes" where the duplicated positions can be spread
                    if (itm.pos)
                        itm.pos = (itm.pos * 10);
                });
                listForEach(list, (itm) => {
                    // two nodes could get same pos above, adjust it (e.g. [1, 2, 3, 3, 4] -> [1, 2, 3, 4, 5])
                    // this could happen with temporal nodes like CD node (optical_drive) or downloads                
                    while (dups[itm.pos] == true)
                        itm.pos = itm.pos + 1;
                    dups[itm.pos] = true;
                });
            });

            // LS: The following isn't needed, the list is auto-sorted later in node.endUpdateAndGetDeleted()
            /*
            list.customSort(function (item1, item2) {
                return (item1.pos - item2.pos);
            });            
            list.locked(function () {
                for (var i = 0; i < list.count; i++) {
                    var itm = list.getValue(i);
                    ODS('sortNodesAndVisibility: [' + itm.pos + '] ' + itm.title);
                }
            });                      
            list.notifyChanged();
            */
        }
    },

    getChildren: function (node) {  
         
        return new Promise<void>((resolve, reject) => {

            this._mediaTreeItems = app.getValue('mediaTreeItems', {
                treeNodes: []
            });

            this._itemOrder = 1;

            if (node._origAdd == undefined) {
                // it's faster and smoother to check node visibility before adding to node
                node._origAdd = node.addChild;
                node._origAddList = node.addChildren;

                node.addChild = (dataSource, handler, virtual) => {
                    if (this.getNodeVisibility(node, dataSource, handler, this._itemOrder++)) {
                        return node._origAdd(dataSource, handler, virtual);
                    }
                };

                node.addChildren = (list, handler) => {
                    let newList = list.getEmptyList();
                    list.locked(() => {
                        for (let i = 0; i < list.count; i++) {
                            let dataSource = list.getValue(i);
                            if (this.getNodeVisibility(node, dataSource, handler, this._itemOrder++)) {
                                newList.add(dataSource);
                            }
                        }
                    });
                    node._origAddList(newList, handler);
                };
            }

            node.addChild(app.collections.getEntireLibrary(), 'home'); // @ts-ignore
            nodeHandlers.home.nowPlayingNode = node.addChild(null, 'npview');
            app.collections.getCollectionListAsync({
                cacheVisibility: true,
                cacheIsEmpty: true,
                includeEntireLibrary: true
            }).then((list) => {
                if (!node.canceled) {
                    node.addChildren(list, 'collection');
                    node.addChild(app.playlists.root, 'playlists');
                    if (!webApp) {
                        //node.addChild(null, 'servers'); // was moved to devicesList below (per #13697)
                        node.addChild(null, 'devicesList');
                        let mediaList = app.filesystem.getInsertedMediaList();
                        let optical_drive_exists = false;
                        listForEach(mediaList, function (drive) {
                            if (drive.driveType == 'optical_drive') {
                                node.addChild(drive, 'optical_drive'); // special node for inserted CD (#13635 - item 1)
                                optical_drive_exists = true;
                            }
                        });
                        if (!optical_drive_exists)
                            this.getNodeVisibility(node, undefined, 'optical_drive', this._itemOrder++); // to create configurable node entry in Options
                    }
                    node.addChild(null, 'computer');
                    //node.addChild(null, 'search'); // hidden - suggested in #12521 / ~44700
                    if (app.downloader.getDownloadsCount() > 0)
                        node.tag._downloadsNode = node.addChild(null, 'downloads');
                    else
                        this.getNodeVisibility(node, undefined, 'downloads', this._itemOrder++); // to create configurable node entry in Options

                    if (!webApp)
                        node.addChild(null, 'web');

                    node.addChild(app.db.getPinnedObjects(), 'pinned');

                    this.sortNodesAndVisibility(node);
                }

                resolve();
            });
        });
    },
    viewAs: ['homeView'] // needed e.g. because of #13492
});


nodeHandlers.home = inheritNodeHandler('Home', 'DropTarget', {
    title: function (node) {
        return _('Home');
    },
    icon: 'home',
    customizable: false,
    hasChildren: false,
    preferGlobalSearch: true, // LS: for the Home node the filtering doesn't make sense, launch entire library search instead 
    viewAs: ['homeView'],
    hideDefaultMenu: true
});

nodeHandlers.collection_childless = inheritNodeHandler('Collection_childless', 'Collection', {
    hasChildren: function (node) {
        return false;
    },
});
nodeHandlers.collections = inheritNodeHandler('Collections', 'Base', {
    title: function (node) {
        return _('Collections');
    },
    icon: 'collection',
    helpContext: 'Library',
    getChildren: function (node) {
        return new Promise<void>(function (resolve, reject) {
            node.loadPromise = app.collections.getCollectionListAsync({
                cacheVisibility: true,
                includeEntireLibrary: false
            });
            node.loadPromise.then(function (list) {
                list.forEach(function (collection) {
                    if (collection.getCachedIsVisible() && !node.canceled)
                        node.addChild(collection, 'collection_childless');
                });
                resolve();
            }, resolve);
        });
    }
});
nodeHandlers.collections_include_hidden = inheritNodeHandler('Collections', 'Base', {
    title: function (node) {
        return _('Collections');
    },
    icon: 'collection',
    helpContext: 'Library',
    getChildren: function (node) {
        return new Promise<void>(function (resolve, reject) {
            node.loadPromise = app.collections.getCollectionListAsync({
                cacheVisibility: false,
                includeEntireLibrary: false
            });
            node.loadPromise.then(function (list) {
                list.forEach(function (collection) {
                    if (!node.canceled)
                        node.addChild(collection, 'collection_childless');
                });
                resolve();
            }, resolve);
        });
    }
});
nodeHandlers.folder_dlna = inheritNodeHandler('Folder_dlna', 'BaseFolder', {
    title: function (node) {
        return node.dataSource.title;
    },
    icon: 'folder'
});
nodeHandlers.collection_dlna = inheritNodeHandler('Collection_dlna', 'Collection', {
    getChildren: function (node) {
        return new Promise<void>(function (resolve, reject) {
            let list = app.sharing.getCollectionSubnodes(node.dataSource.id);
            node.addChildren(list, 'folder_dlna');
            resolve();
        });
    }
});
nodeHandlers.sharedcontenttreeroot = inheritNodeHandler('SharedContentTreeRoot', 'Base', {
    getChildren: function (node) {
        return new Promise<void>(function (resolve, reject) {
            node.loadPromise = app.collections.getCollectionListAsync({
                cacheVisibility: true,
                includeEntireLibrary: false
            });
            node.loadPromise.then(function (list) {
                list.forEach(function (collection) {
                    if (!node.canceled)
                        node.addChild(collection, 'collection_dlna');
                });
                if (!node.canceled)
                    node.addChild(app.playlists.root, 'playlists');
                resolve();
            }, resolve);
        });
    }
});
nodeHandlers.autoOrganizeTreeRoot = inheritNodeHandler('AutoOrganizeTreeRoot', 'Base', {
    getChildren: function (node) {
        return new Promise<void>(function (resolve, reject) {
            node.addChild(null, 'collections_include_hidden');
            node.addChild(null, 'allGenres');
            node.addChild(app.playlists.root, 'playlists');
            resolve();
        });
    }
});

nodeHandlers.all = inheritNodeHandler('All', 'Base', {
    title: function (node) {
        return _('All');
    },
});

// ----------------------------------------------------------------------------------------------------------------------------------------

/**
 * Contains utilities for navigation in the main window. It also exists in dialogs and other sub-windows,
 * but in dialogs and sub-windows, it is just a reference to the navUtils instance in the main window.
 * Instance variable: {@link navUtils}
 */
export interface NavUtils {
    createNodeState: (handlerID: string, dataSource?: any) => any;
    navigateNodePath: (nodePathSources: any[], resolveWhenFinished?: boolean) => Promise<void>;
    navigateObject: (params: AnyDict) => any;
    getTrackCollectionAsync: (track: Track) => Promise<Collection>;
    getActiveView: () => ViewData;
    getActiveViewPanel: () => any;
    getActiveViewHandler: () => ViewHandler;
    getActiveNode: () => SharedNode;
    getActiveTabQueryData: () => QueryData;
    getOutOfActiveView: (nav2Node?: SharedNode) => void;
    getFocusedNode: () => SharedNode;
    getActiveCollection: () => Collection;
    isCollectionRootNodeActive: () => boolean;
    getNodeFolder: (node: SharedNode) => Promise<string>;
    getFocusedFolder: () => Promise<string>;
    filePath2nodePath: (filePath: string) => any[];
}

/**
 * The exported instance of {@link NavUtils}.
 */
export let navUtils: NavUtils;

// navUtils are used with conjunction of navigationHandlers below
if (!window.isMainWindow) { // #19269
    let mainWnd = app.dialogs.getMainWindow();
    navUtils = mainWnd.getValue('navUtils');
} else {
    navUtils = {
        createNodeState: function (handlerID: string, dataSource?: any) {
            let tempTree = app.createTree();
            let tempNode = tempTree.root.addChild(dataSource, handlerID);
            return nodeUtils.storeNode(tempNode);
        },
        navigateNodePath: function (nodePathSources: any[], resolveWhenFinished?: boolean /* set true, if you want to be notified about when view switch finished */) {
            return new Promise<void>(function (resolve, reject) {
                let lastClickedRect = null;
                if (window._lastHoveredListViewDiv)
                    lastClickedRect = getAbsPosRect(window._lastHoveredListViewDiv);
                else
                    lastClickedRect = {
                        top: window.mouseY, // to zoom from correct position (e.g. when artist name is clicked in album view LV popup etc.)
                        left: window.mouseX,
                        width: 0,
                        height: 0
                    };
                let mainTabContent = window.currentTabControl;
                nodeUtils.getNodeByPath(mainTabContent.rootNode, nodePathSources).then(
                    function (newNode) {
                        mainTabContent.showView({
                            node: newNode,
                            clickedRect: lastClickedRect,
                            noAnimations: true,
                            onFinished: function () {
                                if (resolveWhenFinished)
                                    resolve();
                            }
                        });

                        if (!resolveWhenFinished)
                            resolve();
                    },
                    reject
                );
            });
        },
        navigateObject: function (params: AnyDict) {
            // the rationale for this path was discussed/suggested in #12521 / ~44700
            let nodes = [];
            nodes.push(navUtils.createNodeState('root'));
            let coll = params.collection;
            if (!coll)
                coll = navUtils.getActiveCollection(); // #12521 / ~45219
            if (coll) {
                nodes.push(navUtils.createNodeState('collection', coll));
                if (params.parentNodeHandlerID && nodeHandlers[params.parentNodeHandlerID]) // 'genres', 'artists', etc.
                    nodes.push(navUtils.createNodeState(params.parentNodeHandlerID, coll));
                params.object.idColl = coll.id;
            }
            nodes.push(navUtils.createNodeState(params.nodeHandlerID, params.object));
            return navUtils.navigateNodePath(nodes, true);
        },
        getTrackCollectionAsync: function (track: Track): Promise<Collection> {
            return app.collections.getCollectionForObjectAsync(track);
        },
        getActiveView: function (): ViewData {
            if (window.currentTabControl && window.currentTabControl.multiviewControl)
                return window.currentTabControl.multiviewControl.activeView;
        },
        getActiveViewPanel: function () {
            if (window.currentTabControl && window.currentTabControl.multiviewControl)
                return window.currentTabControl.multiviewControl.viewPanel;
        },
        getActiveViewHandler: function () {
            let viewData = navUtils.getActiveView();
            if (viewData)
                return viewHandlers[viewData.currentViewId];
        },
        getActiveNode: function (): SharedNode {
            let viewData = navUtils.getActiveView();
            if (viewData)
                return viewData.viewNode;
        },
        getActiveTabQueryData: function () {
            if (window.currentTabControl) {
                if (!window.currentTabControl.queryData)
                    window.currentTabControl.queryData = app.db.getQueryDataSync('');
                return window.currentTabControl.queryData;
            } else {
                return app.db.getQueryDataSync('');
            }
        },
        getOutOfActiveView: function (nav2Node?: SharedNode) {
            // called e.g. when a view is self-deleted (e.g. playlist via its 'Info Panel' sub-view)
            let viewData = navUtils.getActiveView();
            let newNode = nav2Node;
            if (newNode) {
                ODS('nodeUtils.getOutOfActiveView: new node: ' + newNode.nodePath);
                viewData.mainTabContent.showView({
                    node: newNode
                });
            } else {
                ODS('nodeUtils.getOutOfActiveView: Go backward');
                actions.history.backward.execute();
                window.uitools.refreshView(500);
            }
        },
        getFocusedNode: function (): SharedNode {
            if (lastFocusedControl && lastFocusedControl.controlClass) {
                if (lastFocusedControl.controlClass.constructor.name == 'NodeListView') { // @ts-ignore
                    return lastFocusedControl.controlClass.focusedItem;
                } else
                if (lastFocusedControl.controlClass.constructor.name == 'MediaTree') {
                    return lastFocusedControl.controlClass.dataSource.focusedNode;
                }
            }
        },
        getActiveCollection: function (): Collection {
            let viewData = navUtils.getActiveView();
            if (viewData)
                return nodeUtils.getNodeCollection(viewData.viewNode);
        },
        isCollectionRootNodeActive: function () {
            let viewData = navUtils.getActiveView();
            if (viewData && viewData.viewNode.handlerID == 'collection')
                return true;
        },
        getNodeFolder: function (node: SharedNode): Promise<string> {
            let handlerID = node.handlerID;
            if (node.dataSource) {
                if (node.dataSource.getPathAsync && (node.dataSource.fullPathLoaded == false))
                    return node.dataSource.getPathAsync();
                else
                    return new Promise<string>(function (resolve) {
                        resolve(node.dataSource.path);
                    });
            } else
                return new Promise<string>(function (resolve) {
                    resolve('');
                });
        },
        getFocusedFolder: function (): Promise<string> {
            return new Promise(function (resolve, reject) {
                let node = navUtils.getFocusedNode();
                if (node)
                    navUtils.getNodeFolder(node).then(resolve, reject);
                else {
                    if (window.currentTabControl && window.currentTabControl.multiviewControl && window.currentTabControl.multiviewControl.parentView) {
                        navUtils.getNodeFolder(window.currentTabControl.multiviewControl.parentView.viewNode).then(function (initPath) {
                            resolve(initPath);
                        }, reject);
                    } else
                        resolve('');
                }
            });
        },
        filePath2nodePath: function (filePath: string) {
            let res = [];
            let pathDelim = app.filesystem.getPathSeparator();
            filePath = replaceAll('\\', pathDelim, filePath);
            filePath = replaceAll('/', pathDelim, filePath);
            let pathParts = filePath.split(pathDelim);
            let isNetworkPath = false;
            if (pathParts.length > 2 && pathParts[0] == '' && pathParts[1] == '') { // is network path like \\PC-NAME\...
                isNetworkPath = true;
                pathParts.splice(0, 1);
            }
            for (let i = 0; i < pathParts.length - 1; i++) {
                let handlerID = 'folder';
                let persistentId = pathParts.slice(0, i + 1).join(pathDelim) + pathDelim;
                if (isNetworkPath)
                    persistentId = pathDelim + persistentId;
                if (i == 0) {
                    if (isNetworkPath) {
                        handlerID = 'network';
                        res.push(navUtils.createNodeState(handlerID));
                        continue;
                    } else {
                        handlerID = 'drive';
                        persistentId = pathParts[i];
                    }
                }
                if (i == 1 && isNetworkPath)
                    handlerID = 'networkResource';

                res.push(navUtils.createNodeState(handlerID, {
                    objectType: 'folder', // in order to not be considered as JS dataSource in nodeUtils.restoreDataSource
                    id: persistentId
                }));
            }
            return res;
        }
    };    
}
window.navUtils = navUtils;


/****** navigationHandlers **************************************************************************************************************************

Defines navigation rules, e.g. Find More From Same -> Album uses navigationHandlers['album'].navigate to navigate the album in question


Example (see actions.findMore in action.js for further examples):

navigationHandlers['album'].navigate(track); // navigates the track's album
navigationHandlers['album'].navigate(album); // navigates to the album

****/


window.navigationHandlers = {
    album: {
        navigate: function (object, collection, mbrggid, artistName) {
            return new Promise(function (resolve, reject) {

                let _navAlbum = function (album, coll, trackType?) {
                    if (!trackType) {
                        album.getTrackTypeAsync().then(function (tt) {
                            if (tt)
                                _navAlbum(album, coll, tt);
                            else
                                reject();
                        });
                        return;
                    }

                    if (!coll)
                        coll = navUtils.getActiveCollection();
                    if (!coll)
                        coll = app.collections.getEntireLibrary();   

                    let hasVideoContent = (trackType === 'video') || (trackType === 'tv');

                    if ((album.id < 0) && (!album.mbrggid) && !hasVideoContent) {
                        // not found in library, try to find it online
                        let _progress = new DelayedProgress(250);
                        let taskid = _progress.beginTask(_('Searching') + ' (' + _('Album') + ')');
                        musicBrainz.findReleaseGroup('viewHandler', album).then(function (relArray) {
                            _progress.endTask(taskid);
                            if (relArray && (relArray.length > 0)) {
                                album.mbrggid = relArray[0].id;
                                uitools.globalSettings.showingOnline = true; // opens in Online mode, no local data found
                                navUtils.navigateObject({
                                    nodeHandlerID: 'album',
                                    parentNodeHandlerID: 'albums',
                                    object: album,
                                    collection: coll
                                }).then(resolve, reject);
                            }
                        }, function () {
                            _progress.endTask(taskid);
                            reject();
                        });
                    } else {
                        navUtils.navigateObject({
                            nodeHandlerID: (hasVideoContent ? 'series' : 'album'),
                            parentNodeHandlerID: (hasVideoContent ? 'allseries' : 'albums'),
                            object: album,
                            collection: coll
                        }).then(resolve, reject);
                    }
                };

                if (object.objectType == 'track') {
                    let track = object;
                    let _navTrack = function (collection) {
                        app.getObject('album', {
                            id: track.idalbum,
                            name: track.album,
                            artist: track.albumArtist || track.artist,
                            canCreateNew: true
                        }).then(function (album) {
                            track.getTrackTypeAsync('stringId').then(function (tt) { // use async, to be sure, we have correct track type
                                _navAlbum(album, collection, tt);
                            });
                        });
                    };
                    if (collection)
                        _navTrack(collection);
                    else
                        navUtils.getTrackCollectionAsync(track).then(function (coll) {
                            _navTrack(coll);
                        });
                } else
                if (object.objectType == 'album') {
                    // test, if this is really Delphi class or just helper JS class
                    if (object.jsclass) {
                        // JS class, we cannot use album object as it is
                        return navigationHandlers.album.navigate(object.title, collection, object.mbrggid, object.albumArtist);
                    }
                    let album = object;
                    _navAlbum(album, collection);
                } else if (isString(object)) {
                    app.getObject('album', {
                        name: object,
                        artist: artistName,
                        mbrggid: mbrggid,
                        canCreateNew: true
                    }).then(function (album) {
                        if (album) {
                            _navAlbum(album, collection);
                        }
                    });
                }
            });
        }
    },
    albums: {
        navigate: function (collection) {
            return navUtils.navigateNodePath([navUtils.createNodeState('root'),
                navUtils.createNodeState('collection', collection),
                navUtils.createNodeState('albums', collection)], true);
        }
    },
    series: {
        navigate: function (collection) {
            return navUtils.navigateNodePath([navUtils.createNodeState('root'),
                navUtils.createNodeState('collection', collection),
                navUtils.createNodeState('allseries', collection)], true);
        }
    },    
    artist: {
        navigate: function (object, collection, mbgid, personID) {
            return new Promise(function (resolve, reject) {

                personID = personID || 'artist';
                let _navArtist = function (artist, collection) {
                    if ((artist.id < 0) && (!artist.mbgid)) {
                        // not found in library, try to find it online
                        let _progress = new DelayedProgress(250);
                        let taskid = _progress.beginTask(_('Searching') + ' (' + _('Artist') + ')');
                        musicBrainz.findArtist('viewHandler', artist).then(function (artists) {
                            _progress.endTask(taskid);
                            if (artists && (artists.length > 0)) {
                                artist.mbgid = artists[0].id;
                                uitools.globalSettings.showingOnline = true; // opens in Online mode, no local data found
                                navUtils.navigateObject({
                                    nodeHandlerID: personID,
                                    parentNodeHandlerID: personID + 's',
                                    object: artist,
                                    collection: collection
                                }).then(resolve, reject);
                            }
                        }, function () {
                            _progress.endTask(taskid);
                        });
                    } else {
                        if (!collection)
                            collection = navUtils.getActiveCollection();
                        if (!collection)
                            collection = app.collections.getEntireLibrary();                        
                        if (personID == 'albumartist')
                            artist.asAlbumArtist = true;
                        navUtils.navigateObject({
                            nodeHandlerID: personID,
                            parentNodeHandlerID: personID + 's',
                            object: artist,
                            collection: collection
                        }).then(resolve, reject);
                    }
                };

                if (object.objectType == 'track') {
                    let track = object;
                    let _navTrack = function (collection) {
                        let propertyName;
                        if (personID === 'albumartist')
                            propertyName = 'albumArtist';
                        else
                            propertyName = personID;

                        let personName = track[propertyName];
                        if (personName.includes(';'))
                            personName = personName.substr(0, personName.indexOf(';'));

                        app.getObject(personID, {
                            name: personName,
                            mbgid: mbgid,
                            canCreateNew: true
                        }).then(function (artist) {
                            if (artist)
                                _navArtist(artist, collection);
                            else
                                reject();
                        });
                    };
                    if (collection)
                        _navTrack(collection);
                    else
                        navUtils.getTrackCollectionAsync(track).then(function (coll) {
                            _navTrack(coll);
                        });
                } else
                if ((object.objectType === personID) || ((personID === 'albumartist') && (object.objectType === 'artist'))) {
                    // test, if this is really Delphi class or just helper JS class
                    if (object.jsclass) {
                        // JS class, we cannot use artist object as it is
                        return navigationHandlers[personID].navigate(object.name, collection, object.mbgid);
                    }
                    let artist = object;
                    _navArtist(artist, collection);
                } else
                if ((object.objectType == 'album') && ((personID == 'artist') || (personID == 'albumartist'))) {
                    return navigationHandlers.albumartist.navigate(object.albumArtist, collection);
                } else if (isString(object)) {                    
                    app.getObject(personID, {
                        name: object,
                        mbgid: mbgid,
                        canCreateNew: true
                    }).then(function (artist) {
                        if (artist)
                            _navArtist(artist, collection);
                        else
                            reject();
                    });
                }
            });
        }
    },
    albumartist: {
        navigate: function (object, collection, mbgid) {            
            return navigationHandlers.artist.navigate(object, collection, mbgid, 'albumartist');
        }
    },
    producer: {
        navigate: function (object, collection, mbgid) {
            return navigationHandlers.artist.navigate(object, collection, mbgid, 'producer');
        }
    },
    conductor: {
        navigate: function (object, collection, mbgid) {
            return navigationHandlers.artist.navigate(object, collection, mbgid, 'conductor');
        }
    },
    composer: {
        navigate: function (object, collection, mbgid) {
            return navigationHandlers.artist.navigate(object, collection, mbgid, 'composer');
        }
    },
    actor: {
        navigate: function (object, collection, mbgid) {
            return navigationHandlers.artist.navigate(object, collection, mbgid, 'actor');
        }
    },
    publisher: {
        navigate: function (object, collection, mbgid) {
            return navigationHandlers.artist.navigate(object, collection, mbgid, 'publisher');
        }
    },
    director: {
        navigate: function (object, collection, mbgid) {
            return navigationHandlers.artist.navigate(object, collection, mbgid, 'director');
        }
    },

    person: {
        navigate: function (object) {
            return new Promise(function (resolve, reject) {
                app.collections.getCollectionForObjectAsync(object).then(function (collection) {
                    navUtils.navigateObject({
                        nodeHandlerID: object.objectType,
                        parentNodeHandlerID: object.objectType + 's', // e.g. 'artists', 'conductors', 'composers', 'lyricists', ...
                        object: object,
                        collection: collection
                    }).then(resolve, reject);
                });
            });
        }
    },
    artists: {
        navigate: function (collection) {
            return navUtils.navigateNodePath([navUtils.createNodeState('root'),
                navUtils.createNodeState('collection', collection),
                navUtils.createNodeState('artists', collection)], true);
        }
    },
    genre: {
        navigate: function (object, collection) {
            return new Promise(function (resolve, reject) {

                let _navGenre = function (genre, collection) {
                    navUtils.navigateObject({
                        nodeHandlerID: 'genre',
                        parentNodeHandlerID: 'genres',
                        object: genre,
                        collection: collection
                    }).then(resolve, reject);
                };

                if (object.objectType == 'genre') {
                    let genre = object;
                    _navGenre(genre, collection);
                } else if (isString(object)) {
                    app.getObject('genre', {
                        name: object,
                        canCreateNew: true
                    }).then(function (genre) {
                        if (genre)
                            _navGenre(genre, collection);
                        else
                            reject();
                    });
                } else if (object.objectType == 'track') {
                    let track = object;
                    let _navTrack = function (collection) {
                        app.getObject('genre', {
                            name: track.genre
                        }).then(function (genre) {
                            if (genre)
                                _navGenre(genre, collection);
                            else
                                reject();
                        });
                    };
                    if (collection)
                        _navTrack(collection);
                    else
                        navUtils.getTrackCollectionAsync(track).then(function (coll) {
                            _navTrack(coll);
                        });
                }
            });
        }
    },
    year: {
        navigate: function (object, collection) {
            return new Promise(function (resolve, reject) {

                let _navYear = function (year, collection) {
                    app.getObject('decade', { id: year }).then((decade) => {
                        let _ar = [navUtils.createNodeState('root'),
                            navUtils.createNodeState('collection', collection),
                            navUtils.createNodeState('years', collection),
                            navUtils.createNodeState('decade', decade)
                        ];
                        if (year > 0)
                            _ar.push(navUtils.createNodeState('year', collection.getYear(year)));
                        navUtils.navigateNodePath(_ar, true).then(resolve, reject);
                    });
                };

                let year;
                if (!collection)
                    collection = navUtils.getActiveCollection();

                if (object.objectType == 'track') {
                    year = object.year;
                    if (!collection) {
                        navUtils.getTrackCollectionAsync(object).then(function (coll) {
                            _navYear(year, coll);
                        });
                        return;
                    }
                } else if (object.objectType == 'album') {
                    year = object.year;
                } else if (isString(object)) {
                    year = object;
                }

                if (collection)
                    _navYear(year, collection);
                else
                    reject();
            });
        }
    },
    dbFolder: {
        navigate: function (track, collection) {
            return new Promise(function (resolve, reject) {

                let _navTrack = function (coll) {
                    let nodePath = [];
                    nodePath.push(navUtils.createNodeState('root'));
                    nodePath.push(navUtils.createNodeState('collection', coll));
                    nodePath.push(navUtils.createNodeState('location', coll));
                    let collectionID = coll.id;
                    let pathDelim = app.filesystem.getPathSeparator();
                    let pathParts = track.path.split(pathDelim);
                    let path = '';
                    if (pathParts.length > 2 && pathParts[0] == '' && pathParts[1] == '') { // is network path like \\PC-NAME\...                    
                        pathParts.splice(0, 1);
                        pathParts[0] = pathDelim;
                    }
                    let processPathPart = function (index) {
                        path = path + pathParts[index] + pathDelim;
                        app.filesystem.getFolderOfPathAsync(path).then(function (folder) {
                            folder.idColl = collectionID;
                            nodePath.push(navUtils.createNodeState('dbfolder', folder));
                            if (index < pathParts.length - 2)
                                processPathPart(index + 1);
                            else {
                                navUtils.navigateNodePath(nodePath, true).then(resolve, reject);
                            }
                        }, reject);
                    };
                    processPathPart(0);
                };

                if (collection)
                    _navTrack(collection);
                else
                    navUtils.getTrackCollectionAsync(track).then(function (coll) {
                        _navTrack(coll);
                    });
            });
        }
    },
    compFolder: {
        navigate: function (track) {
            let nodePath = [];
            nodePath.push(navUtils.createNodeState('root'));
            nodePath.push(navUtils.createNodeState('computer'));
            nodePath.push(...navUtils.filePath2nodePath(track.path));
            if (track.cuePath != '') {
                // track is inside a cue sheet, add cue sheet node
                nodePath.push(navUtils.createNodeState('folder', {
                    objectType: 'folder',
                    id: app.utils.removeFilenameExtension(track.cuePath) + '.cue'
                }));               
            }
            return navUtils.navigateNodePath(nodePath, true);
        }
    },
    explorerFolder: {
        navigate: function (track) {
            return new Promise<void>(function (resolve, reject) {
                app.utils.openExplorerFolder(track.path).then(function () {
                    resolve();
                }, function (error) {
                    uitools.toastMessage.show(error, {
                        delay: 5000,
                        disableClose: true,
                    });
                    reject(error);
                });
            });
        }
    },
    playlist: {
        navigate: function (playlist) {
            // navigates to Home > Playlists > ... > playlist 
            let nodePath = [];
            let parent = playlist;
            while (parent) {
                let handlerID = 'playlist';
                if (parent.id == app.playlists.root.id)
                    handlerID = 'playlists';
                nodePath.splice(0, 0, navUtils.createNodeState(handlerID, parent));
                parent = parent.parent;
            }
            nodePath.splice(0, 0, navUtils.createNodeState('root'));
            return navUtils.navigateNodePath(nodePath, true);
        }
    },
    playlists: {
        navigate: function () {
            return navUtils.navigateNodePath([navUtils.createNodeState('root'),
                navUtils.createNodeState('playlists', app.playlists.root)], true);
        }
    },
    playlist_search: {
        // navigates to Home > Search > playlist
        navigate: function (object) {
            if (object.objectType == 'playlist') {
                return navUtils.navigateNodePath([navUtils.createNodeState('root'),
                    navUtils.createNodeState('search', navUtils.getActiveTabQueryData()),
                    navUtils.createNodeState('playlist', object)], true);
            }
        }
    },
    podcast_search: {
        // navigates to Home > Search > podcast
        navigate: function (object) {
            return navUtils.navigateNodePath([navUtils.createNodeState('root'),
                navUtils.createNodeState('search', navUtils.getActiveTabQueryData()),
                navUtils.createNodeState('podcast', object)], true);
        }
    },
    search: {
        navigate: function (params) {
            let nodePath = [];
            nodePath.push(navUtils.createNodeState('root'));
            if (params && params.collection)
                nodePath.push(navUtils.createNodeState('collection', params.collection));
            nodePath.push(navUtils.createNodeState('search', navUtils.getActiveTabQueryData()));
            return navUtils.navigateNodePath(nodePath, true);
        }
    },
    pinned: {
        navigate: function () {
            return navUtils.navigateNodePath([navUtils.createNodeState('root'),
                navUtils.createNodeState('pinned', app.db.getPinnedObjects())], true);
        }
    },
    nowPlaying: {
        navigate: function () {
            return navUtils.navigateNodePath([navUtils.createNodeState('root'),
                navUtils.createNodeState('npview')], true /* resolve when finished */);
        }
    },
    welcomePage: {
        navigate: function (params) {
            let nodePath = [];
            nodePath.push(navUtils.createNodeState('root'));
            nodePath.push(navUtils.createNodeState('webPage', {
                title: '', // 'Welcome'
                detail: 'https://www.mediamonkey.com/welcome6.htm?l=' + app.utils.getUsedLanguage()
            }));
            return navUtils.navigateNodePath(nodePath, true);
        }
    },
    subscriptions: {
        navigate: function () {
            return navUtils.navigateNodePath([navUtils.createNodeState('root'),
                navUtils.createNodeState('subscriptions')], true);
        }
    },
    title: {
        navigate: function (track) {
            let nodePath = [];
            nodePath.push(navUtils.createNodeState('root'));
            //nodePath.push(navUtils.createNodeState('search', navUtils.getActiveTabQueryData()));
            nodePath.push(navUtils.createNodeState('findTitle', {
                title: track.title                
            }));
            return navUtils.navigateNodePath(nodePath, true);            
        }
    }
};