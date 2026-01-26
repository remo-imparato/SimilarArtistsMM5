'use strict';

registerFileImport('controls/nodeListView');

/**
@module UI
*/

import ListView from './listview';

/**
UI element to represent nodes as list view

@class NodeListView
@constructor
@extends ListView
*/

export default class NodeListView extends ListView {
    smallItemSize: boolean;
    standardItemSize: boolean;
    private _dropNode: any;
    private _lastDropNodeResult: any;
    private _titlesAssigned: boolean;
    lastNode: any;
    private _lastExpandedNode: any;
    rowItems: boolean;
    imageTemplate: any;

    initialize(rootelem, params) {
        super.initialize(rootelem, params);
        this.enableDragNDrop();
        this.itemCloningAllowed = false; // we could have differet types of nodes
        if (params && params.rowItems)
            this.isGrid = false;
        else
            this.isGrid = true;
        this.isSearchable = true;
        this.container.classList.add('nodelist');
        if (this.smallItemSize) {
            this.container.classList.add('smallitems');
        }
        this.focusChangeHandle();
    }

    prepareContextMenu() {
        this._contextMenuPromises.push(
            new Promise<void>((resolve, reject) => {
                let selectedNodes = this.dataSource.getSelectedList();
                this.localPromise(selectedNodes.whenLoaded()).then1(() => {
                    this.contextMenu = nodeUtils.createContextMenu(function () {
                        return selectedNodes;
                    });
                    resolve();
                });
            })
        );
    }

    focusChangeHandle() {
        this.localListen(this.container, 'focuschange', (e) => {
            this.prepareContextMenu();
        });
    }

    cleanUp() {
        this.prepareDatasource(null, null); // in order to unlisten events via nodeHandler.OnCollapsed()
        nodeUtils.cancelNode(this.lastNode);
        super.cleanUp();
    }

    setUpDiv(div) {
        if (this.rowItems) {
            templates.rowNodeItem(div);
        } else {
            if (this.smallItemSize)
                div.classList.add('smallItem');
            if (this.standardItemSize)
                div.classList.add('standardItem');

            if (this.imageTemplate)
                templates.imageItem(div, templates.imageItemsParams[this.imageTemplate]);
            else
                templates.imageItem(div, templates.imageItemsParams['imageNode']);
        }

        let _this = this;
        div.tooltipValueCallback = function (tipdiv, vis) {
            if (vis && _this.dataSource) {
                let node = getValueAtIndex(_this.dataSource, div.itemIndex);
                if (node)
                    tipdiv.innerHTML = nodeUtils.getNodeTooltip(node) || nodeUtils.getNodeTitle(node);
            }
        }.bind(div);
    }

    _updateFocusableState() {
        if(!this.container)
            return;
        // to resolve #15686
        if (!this.dataSource || !this.dataSource.count) {
            if (this.container.tabIndex != -1) {
                this._tabIndex = this.container.tabIndex;
                this.container.tabIndex = -1;
            }
        } else {
            if (this.container.tabIndex == -1) {
                this.container.tabIndex = this._tabIndex;
            }
        }
    }

    prepareDatasource(node, dataSource) {

        let viewReloading = window.currentTabControl && window.currentTabControl.multiviewControl._customViewReload;

        if (!(this.lastNode && node && this.lastNode.persistentID == node.persistentID) && // don't cancel when it is the same node (fix of #13530 item 4)
            (!viewReloading /* #16379 - view is reloading so do not cancel node, otherwise subview will hide unexpectedly */ ))
            nodeUtils.cancelNode(this.lastNode);

        if (this._lastExpandedNode)
            nodeUtils.onCollapsed(this._lastExpandedNode);

        this.lastNode = null;
        this._lastExpandedNode = null;

        this._titlesAssigned = false;
        if (node) {
            this.multiselect = nodeUtils.getMultiselectSupport(node);
            if (dataSource) {
                this.dataSource = dataSource;
            } else {
                let ds = node.children; // #18352
                this.dataSource = ds;
                ds.beginUpdate();
                // if (nodeUtils.getHasChildren(node)) { // LS: disabled due to #16232: Refresh option in folders not working when there are no other sub-folders already
                this.localPromise(nodeUtils.loadChildren(node)).then1(() => {
                    ds.endUpdate(); // this.dataSource can be nil here
                    this._updateFocusableState();
                });
                nodeUtils.onExpanded(node);
                this._lastExpandedNode = node;
                //}
            }
            this._updateFocusableState();
            this.lastNode = node;
        } else {
            this.dataSource = null;
        }
    }

    _assignTitles(DS) {
        if (!DS)
            DS = this.dataSource;
        assert(DS.objectType == 'sharednodelist', 'NodeListView.filterSource supported only for node lists!');
        if (!this._titlesAssigned) {
            /* LS: following was slow for many nodes -- so it was replaced by caching the title directly in nodeUtils.getNodeTitle + getting the title internally from node.dataSource.title
            DS.locked(function () {
                var _child;
                for (var i = 0; i < DS.count; i++) {
                    _child = DS.getFastObject(i, _child);
                    _child.title = nodeUtils.getNodeTitle(_child);
                }
            });
            */
        }
        this._titlesAssigned = true;
    }

    filterSource(phrase) {
        let args = arguments;
        let _this = this;
        let _superFilterSource = super.filterSource.bind(this);
        let DS = this.dataSource;
        if (DS) {
            let _proceed = function () {
                _this._assignTitles(DS);
                _superFilterSource(phrase);
            };
            if (DS.isLoaded)
                _proceed();
            else
                DS.whenLoaded().then(_proceed);
        }
    }

    // overriden
    incrementalSearch(searchPhrase, reverseOrder, nextOccurence) {
        let args = arguments;
        let DS = this.dataSource;
        if (DS) {
            this._assignTitles(DS);
            if (!DS.isLoaded)
                this._titlesAssigned = false;
            return super.incrementalSearch(searchPhrase, reverseOrder, nextOccurence);
        }
    }

    canDeleteSelected() {
        let node = this.focusedItem;
        if (!nodeUtils.isDeleteDisabled(node))
            return true;
    }

    deleteSelected(permanent) {
        let node = this.focusedItem;
        if (!nodeUtils.isDeleteDisabled(node)) {
            let selList = this.dataSource.getSelectedList();
            selList.whenLoaded().then(function () {
                nodeUtils.deleteItems(selList, permanent);
            });
        }
    }

    editStart() {
        let node = this.focusedItem;
        if (node && nodeUtils.canEditNodeTitle(node)) {

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
                cellDiv: cellDiv,
                node: node,
                getValue: function (node) {
                    return nodeUtils.getNodeTitle(node);
                },
                setValue: function (node, value) {
                    nodeUtils.setNodeTitle(node, value);
                },
            };
            this.inEdit.editor('edit', this.inEdit.cellDiv, this.inEdit.node);
        }
    }

    editSave() {
        if (this.inEdit) {
            this.inEdit.editor('save', this.inEdit.cellDiv, this.inEdit.node);
            this.inEdit.div.itemIndex = undefined; // force rebind 
            this.draw();
            this.inEdit = undefined;
        }
    }

    editCancel() {
        if (this.inEdit) {
            this.inEdit.editor('cancel', this.inEdit.cellDiv, this.inEdit.node);
            this.inEdit = undefined;
        }
    }

    formatStatus(data) {
        let view = this.parentView;
        if (view) {
            let handler = getNodeHandler(view);
            if (handler.formatStatus)
                return handler.formatStatus(data);
        }
    }

    dragOver(e: NotifyEvent) { // disable reorder from ListView .. we want to drop to the selected item
    }

    getDraggedObject(e: NotifyEvent) {

        let result = app.utils.createSharedList();
        new Promise((resolve, reject) => {
            let nodes;
            if (this.dataSource) {
                this.dataSource.locked(function () {
                    nodes = this.dataSource.getSelectedList();
                }.bind(this));
            }
            if (nodes) {
                nodes.whenLoaded().then1(() => {
                    listForEach(nodes, (node) => {
                        result.add(node.dataSource);
                    });
                    result.notifyLoaded();
                });
            } else {
                result.notifyLoaded();
            }
        });
        return result;
    }

    runFuncOnHittest(e: NotifyEvent) {
        return window.dnd.getFocusedItemHandler.call(this, e);
    }

    canDrop(e: NotifyEvent) {
        return this.runFuncOnHittest(e);
    }

    drop(e: NotifyEvent) {
        if (this._lastDropNodeResult /* this property is from window.dnd.getFocusedItemHandler */ ) {
            let handler = nodeHandlers[this._dropNode.handlerID];
            if (handler && handler.drop) {
                e._dropNode = this._dropNode;
                handler.drop(this._dropNode.dataSource, e);
            }
        }
        this.cancelDrop();
    }


}
registerClass(NodeListView);
