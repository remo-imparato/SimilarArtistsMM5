/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

'use strict';
registerFileImport('controls/mediaTree');
/**
@module UI snippets
*/
import TreeView from './treeview';
import '../viewHandlers';
/**
UI media tree element.

@class MediaTree
@constructor
@extends TreeView
*/
export default class MediaTree extends TreeView {
    initialize(rootelem, params) {
        super.initialize(rootelem, params);
        this.enableDragNDrop();
        this.dataSource = app.createTree(true);
        this.root.handlerID = 'root';
        this.expandNode(this.root);
        this.showHeader = false;
        this.multiselect = false;
        let _this = this;
        this.onFocusedNodeDeletion = function () {
            let node = _this.dataSource.focusedNode;
            if (node && node.deleted) {
                _this.editCancel();
                let viewNode = navUtils.getActiveNode();
                if (viewNode && (viewNode.persistentID != node.persistentID))
                    return; // #19920
                while (node) {
                    if (node.deleted) {
                        // focused node (or its parent -- e.g. when disconnecting device) 
                        // has been deleted, switch to its previous sibling (or parent)
                        let sibling = _this.dataSource.getNodeByIndex(node.globalIndex - 1);
                        if (sibling)
                            _this.dataSource.focusedNode = sibling;
                        else
                            _this.dataSource.focusedNode = node.parent;
                    }
                    node = node.parent;
                }
            }
        };
        this.localListen(this.dataSource, 'change', this.onFocusedNodeDeletion);
        this.onFocusChange = () => {
            this.contextMenuPromise = new Promise((resolve) => {
                this.requestFrame(() => {
                    this.setStatus(undefined);
                    this.contextMenu = () => {
                        return nodeUtils.createContextMenu(() => {
                            let retList = app.utils.createSharedList();
                            if (this.dataSource.focusedNode && this.lastHoveredDiv)
                                retList.add(this.dataSource.focusedNode);
                            return retList;
                        });
                    };
                    resolve();
                    this.contextMenuPromise = undefined;
                }, 'nodeContextMenu');
            });
        };
        this.localListen(this.dataSource, 'focuschange', this.onFocusChange);
        this.localListen(this.container, 'keydown', this._keyhandle.bind(this));
        this.localListen(this.container, 'keyup', this._keyhandle.bind(this));
        this._addMenuButton();
    }
    contextMenuHandler(e) {
        e.stopPropagation();
        e.preventDefault();
        let _superContextMenuHandler = super.contextMenuHandler.bind(this);
        this.requestFrame(() => {
            _superContextMenuHandler(e);
        }, 'contextMenuFrame');
    }
    getFocusedNodeHandler() {
        let node = this.dataSource.focusedNode;
        if (node) {
            return nodeHandlers[node.handlerID];
        }
        return null;
    }
    markFocused(div, focused) {
        if (document.activeElement && (document.activeElement.getAttribute('data-control-class') == 'MenuButton')) {
            // do not redraw focus if focused is menu button
            return;
        }
        super.markFocused(div, focused);
    }
    canDeleteSelected() {
        let node = this.dataSource.focusedNode;
        if (!nodeUtils.isDeleteDisabled(node))
            return true;
    }
    deleteSelected(permanent) {
        let node = this.dataSource.focusedNode;
        if (!nodeUtils.isDeleteDisabled(node)) {
            let selList = app.utils.createSharedList();
            selList.add(node);
            nodeUtils.deleteItems(selList, permanent);
        }
    }
    expandNode(node) {
        let _super_expandNode = super.expandNode.bind(this);
        return new Promise((resolve) => {
            _super_expandNode(node).then1(() => {
                if (!this._cleanUpCalled) {
                    if (node.handlerID == this.root.handlerID) {
                        let handler = nodeHandlers[node.handlerID];
                        handler.sortNodesAndVisibility(node);
                    }
                }
                resolve();
            });
        });
    }
    storeExpandedNodes() {
        let state = [];
        if (this.root.expanded) {
            // LS: for now store expand states just for direct children of root (#13471 - items 3,7)
            let children = this.root.children;
            children.locked(function () {
                let child;
                for (let i = 0; i < children.count; i++) {
                    child = children.getFastObject(i, child);
                    if (child.expanded)
                        state.push(child.persistentID);
                }
            });
        }
        return state;
    }
    restoreExpandedNodes(state) {
        let _this = this;
        // eslint-disable-next-line no-async-promise-executor
        return new Promise(async function (resolve, reject) {
            let currentIndex = 0;
            if (_this.root.expanding) {
                await _this.root.children.whenLoaded();
            }
            else if (!_this.root.expanded) {
                await _this.expandNode(_this.root);
            }
            while ((currentIndex < _this.dataSource.count) && (!_this._cleanUpCalled)) {
                let node = _this.dataSource.getNodeByIndex(currentIndex++);
                if (node && inArray(node.persistentID, state)) {
                    await _this.expandNode(node);
                }
            }
            resolve();
        });
    }
    storeState() {
        // to override TreeView.storeState 
        // tree path is restored in mainTabContent.restoreViewData (from the viewData navigation history object)
        return {};
    }
    restoreState(fromObject) {
        // This empty restoreState method is here to prevent call TreeView.restoreState 
        // as state of MediaTree is restored in mainTabContent.restoreViewData (from the viewData navigation history object)
        return dummyPromise();
    }
    _itemHover(setAttr) {
        if (this._lastHoverDiv) {
            if (setAttr) {
                this._lastHoverDiv.setAttribute('data-openInNewTab', '1');
            }
            else {
                this._lastHoverDiv.removeAttribute('data-openInNewTab');
            }
        }
    }
    _keyhandle(e) {
        this._itemHover(e.ctrlKey);
    }
    handleItemMouseOver(div, e) {
        super.handleItemMouseOver(div, e);
        this._lastHoverDiv = div;
        this._itemHover(e.ctrlKey);
    }
    // #16960: On middle click, open a new tab with the node instead of opening the node on the current tab
    handleItemMiddleClick(div, e) {
        this.requestFrame(() => {
            if (window.mainTabs) {
                window.mainTabs.addNewTab(true)
                    .then(() => {
                    let tab = mainTabs.items[mainTabs.selectedIndex];
                    let newDiv = qid(tab.getAttribute('tabname'));
                    let newMediaTree = qeid(newDiv, 'mediaTree').controlClass;
                    let node = this.dataSource.getNodeByIndex(div.itemIndex);
                    // Set the node path for the new tab with the contents of the item that was clicked
                    newMediaTree.setNodePath(node.nodePath);
                });
            }
        });
    }
    _addMenuButton() {
        let _this = this;
        let div = document.createElement('div');
        div.className = 'alignRight inFront lvItem treeRow noPadding';
        div.setAttribute('data-control-class', 'MenuButton');
        div.setAttribute('data-hideInFullWindowMode', '');
        div.setAttribute('data-icon', 'menu');
        this.viewport.appendChild(div);
        initializeControl(div);
        let items = [];
        items.push(actions.configureCollections);
        items.push({
            title: _('Show all subnodes'),
            checkable: true,
            checked: window.settings.UI.mediaTree.showAllNodes,
            execute: function () {
                // toggle:
                window.settings.UI.mediaTree.showAllNodes = !window.settings.UI.mediaTree.showAllNodes;
                if (!window.settings.UI.mediaTree.showAllNodes)
                    _this.collapseAll(); // to collapse the sub-nodes that should be no longer shown
                else
                    _this.invalidateAll(); // to hide the expand marks for corresponding nodes                
            }
        });
        items.push({
            title: _('Scroll to match when typing in tree'),
            checkable: true,
            checked: window.settings.UI.mediaTree.enableSearch,
            execute: function () {
                // toggle:
                window.settings.UI.mediaTree.enableSearch = !window.settings.UI.mediaTree.enableSearch;
            }
        });
        items.push({
            title: _('Focus tree nodes when browsing content'),
            checkable: true,
            checked: window.settings.UI.mediaTree.autoExpand,
            execute: function () {
                window.settings.UI.mediaTree.autoExpand = !window.settings.UI.mediaTree.autoExpand;
            }
        });
        items.push({
            title: _('Collapse the tree'),
            icon: 'collapse',
            execute: function () {
                _this.collapseAll();
            }
        });
        div.controlClass.menuArray = items;
    }
    getDropIndex(e) {
        let index = super.getDropIndex(e);
        let dataType = dnd.getDropDataType(e);
        if (dataType == 'track' || dataType == 'playlistentry')
            index = -1; // so that track is inserted on the last position when inserting to playlist (see nodeHandlers.playlist.drop) -- #20173
        return index;
    }
    get enableIncrementalSearch() {
        // see rationale for this in Mantis issue #17810            
        if (window.settings.UI.mediaTree.enableSearch)
            return true;
        else
            return false; // this.focusVisible;
    }
    set enableIncrementalSearch(value) {
    }
}
registerClass(MediaTree);
