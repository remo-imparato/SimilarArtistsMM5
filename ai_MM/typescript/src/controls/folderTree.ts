'use strict';

registerFileImport('controls/folderTree');

/**
@module UI snippets
*/

import TreeView from './treeview';

/**
UI folder tree element for selection of folders.

@class FolderTree
@constructor
@extends TreeView
*/

export default class FolderTree extends TreeView {
    onFocusChange: () => void;

    initialize(rootelem, params) {
        super.initialize(rootelem, params);

        if (params && params.checkboxes == false)
            this.checkboxes = false;
        else
            this.checkboxes = true;

        app.listen(this, 'expandfinish', this._onExpanded.bind(this));

        this.dataSource.keepChildrenWhenCollapsed = true;

        params = params || {};

        if (params.rootNode)
            this.useRootNode(params.rootNode);

        this.onFocusChange = () => {
            this.contextMenuPromise = new Promise<void>((resolve) => {
                this.requestFrame(() => {
                    this.setStatus(undefined);
                    this.contextMenu = new Menu([
                        {
                            action: bindAction(window.actions.newFolderNode, this.dataSource.focusedNode),
                            order: 10,
                            grouporder: 10
                        }, {
                            action: {
                                title: _('Remove'),
                                icon: 'delete',
                                visible: () => {
                                    let n = this.dataSource.focusedNode;
                                    return n && n.dataSource && !n.dataSource.isPlaylist;
                                },
                                execute: () => {
                                    let nodes = app.utils.createSharedList();
                                    nodes.add(this.dataSource.focusedNode);
                                    nodeHandlers.folder.deleteItems(nodes, false /* to recycle bin*/);
                                }
                            },
                            order: 20,
                            grouporder: 10
                        }, {
                            action: {
                                title: function () {
                                    return _('Rename');
                                },
                                icon: 'edit',
                                visible: () => {
                                    return nodeUtils.canEditNodeTitle(this.dataSource.focusedNode);
                                },
                                execute: function () {
                                    let LV = window.lastFocusedControl;
                                    LV.controlClass.editStart();
                                },
                                shortcut: 'F2'
                            },
                            order: 30,
                            grouporder: 10
                        }
                    ]);
                    resolve();
                    this.contextMenuPromise = undefined;
                }, 'nodeContextMenu');
            });
        };
        this.localListen(this.dataSource, 'focuschange', this.onFocusChange);
    }

    useRootNode(handlerID) {
        this.root.handlerID = handlerID;
        this.expandNode(this.root);
    }

    reinitNodes() {
        // useful when this component is used for another dataSource
        let handlerID = this.root.handlerID;
        let keepChildrenWhenCollapsed = this.dataSource.keepChildrenWhenCollapsed;
        this.dataSource = app.createTree();
        this.dataSource.keepChildrenWhenCollapsed = keepChildrenWhenCollapsed;
        this.root.handlerID = handlerID;
    }

    cleanUp() {
        app.unlisten(this, 'expandfinish');
        super.cleanUp();
    }

    expandMarked(maxLevel) {
        let _this = this;
        return new Promise<void>(function (resolve, reject) {
            let currentIndex = 0;

            let handleNextNode = function () {
                if (_this.dataSource.count > currentIndex) {
                    let node = _this.dataSource.getNodeByIndex(currentIndex++);
                    if (node && node.dataSource.autoExpand) { // this folder is marked to expand
                        _this.expandNode(node).then(handleNextNode);
                    } else {
                        handleNextNode();
                    }
                } else {
                    resolve();
                }
            };

            if (!_this.root.expanded) {
                _this.expandNode(_this.root).then(handleNextNode);
            } else
                handleNextNode();
        });
    }

    /**
    Return checked folders as string list 

    @method getCheckedFolders
    @param {boolean} parent_independent if true then also subfolders of checked parent are returned
    @return {StringList}
    */
    getCheckedFolders(parent_independent) {
        let folderList = newStringList();

        let processNode = function (node, list) {
            let children = node.children;
            children.forEach(function (child) {
                if (child.checked) {
                    if (child.dataSource)
                        list.add(child.dataSource.path);
                    if (parent_independent)
                        processNode(child, list);
                } else
                    processNode(child, list);
            });
        };
        processNode(this.root, folderList);

        return folderList;
    }

    setFolderPath(folder, noAutoExpand, noFocusEvent) {
        return new Promise((resolve, reject) => {
            let nodePath = [];
            nodePath.push(navUtils.createNodeState(this.root.handlerID));
            nodePath.push(...navUtils.filePath2nodePath(folder));
            this.localPromise(nodeUtils.getNodeByPath(this.root, nodePath)).then(
                (node) => {
                    this.setNodePath(node.nodePath, noAutoExpand, noFocusEvent).then(resolve, reject);
                }, reject);
        });
    }

    _onExpanded(e) {
        let node = e.detail.currentNode;
        if (this.checkboxes && node.checked) {
            // check all subfolders after expanding a checked folder            
            node.children.setAllChecked(true);
        }
    }

    canProcessPath(pathParts) {
        return pathParts.length > 0;
    }

}
registerClass(FolderTree);
