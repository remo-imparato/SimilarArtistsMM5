/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

'use strict';
registerFileImport('controls/treeview');
/**
@module UI
*/
import ListView from './listview';
import Checkbox from './checkbox';
import { DRAG_DATATYPE } from '../consts';
/**
UI TreeView element.

@class TreeView
@constructor
@extends ListView
*/
export default class TreeView extends ListView {
    initialize(rootelem, params) {
        super.initialize(rootelem, params);
        this.levelIndent = this.getLevelIndentSizePx();
        this.checkboxes = false;
        this.multiselect = false;
        this.editSupport = true;
        this.itemCloningAllowed = false;
        this._isTreeView = true;
        this.enableIncrementalSearch = true; // by default true (because of #15331) - filtering isn't supported on trees anyway
        this.localListen(this.canvas, 'scroll', function () {
            this.editCancel();
        }.bind(this));
        this.dataSource = app.createTree();
        if (params && params.enableDragDrop)
            this.enableDragNDrop();
        if (params && params.keepChildrenWhenCollapsed)
            this.dataSource.keepChildrenWhenCollapsed = true;
        if (params && params.rootNode) {
            let h_id = params.rootNode;
            this.root.handlerID = h_id;
            if (nodeHandlers[h_id].getDataSource)
                this.root.dataSource = nodeHandlers[h_id].getDataSource();
        }
        if (params && params.expandRoot)
            this.expandNode(this.root);
    }
    getLevelIndentSizePx() {
        if ((window._treeLevelIndent === undefined) && document.body) {
            let div = document.createElement('div');
            div.className = 'treeLevelIndent';
            div.style.position = 'absolute';
            div.style.left = '0px';
            div.style.top = '0px';
            div.style.display = 'none';
            document.body.appendChild(div);
            window._treeLevelIndent = parseFloat(getComputedStyle(div).width);
            document.body.removeChild(div);
        }
        return window._treeLevelIndent;
    }
    cleanUp() {
        if (this.dataSource)
            this.collapseAll(true); // to unregister all listeners registered in nodeHandler.onExpanded
        this.cleanUpAutoExpand();
        super.cleanUp();
    }
    // overriden
    setUpDiv(div) {
        div.classList.add('treeRow');
        // indent part
        div.indent = document.createElement('div');
        div.indent.style.display = 'inline-block';
        div.appendChild(div.indent); // TODO: use absolute positioning of content in order to be faster (indent of the icon part)?
        // expand/collapse icons:
        div.icons = document.createElement('div');
        div.icons.className = 'icnExpand';
        div.icons.style.display = 'inline-block';
        div.icnExpanded = document.createElement('div');
        div.icnExpanded.style.position = 'absolute';
        div.icnExpanded.className = 'icon icnExpandExpanded';
        loadIcon('treeExpanded', function (iconData) {
            div.icnExpanded.innerHTML = iconData;
            setIconAriaLabel(div.icnExpanded, _('Collapse'));
        });
        div.icons.appendChild(div.icnExpanded);
        div.icnCollapsed = document.createElement('div');
        div.icnCollapsed.style.position = 'absolute';
        div.icnCollapsed.className = 'icon icnExpandCollapsed';
        loadIcon('treeCollapsed', function (iconData) {
            div.icnCollapsed.innerHTML = iconData;
            setIconAriaLabel(div.icnCollapsed, _('Show all')); // #17949: Change to "Expand" in the future when it's translated
        });
        div.icons.appendChild(div.icnCollapsed);
        div.appendChild(div.icons);
        let resetEdit = function () {
            div.lastMouseUp = undefined;
        };
        let _this = this;
        if (this.checkboxes) {
            div.check = document.createElement('div');
            div.check.style.display = 'inline-block';
            div.check.controlClass = new Checkbox(div.check, {
                type: 'checkbox',
                baseline: true,
                readOnly: this.readOnly,
                focusable: false
            });
            div.appendChild(div.check);
            app.listen(div.check, 'click', function (e) {
                e.stopPropagation();
                if (_this.readOnly) {
                    e.preventDefault();
                    return;
                }
                resetEdit();
                if (_this.disabled)
                    return;
                let lv = e.currentTarget.parentNode.parentListView;
                let node = lv.dataSource.getNodeByIndex(e.currentTarget.parentNode.itemIndex);
                if (node)
                    _this.handleNodeCheck(node);
            });
        }
        // node icon:
        div.icon = document.createElement('div');
        div.icon.classList.add('icon');
        div.icon.classList.add('inline');
        div.icon.classList.add('paddingColumnSmall');
        div.appendChild(div.icon);
        // user data content
        div.content = document.createElement('div');
        div.content.classList.add('inline');
        div.appendChild(div.content);
        this._changeExpand = function (node) {
            resetEdit();
            if (nodeUtils.getHasChildren(node) && !this.disabled) {
                if (!node.expanded)
                    this.expandNode(node);
                else
                    this.collapseNode(node);
            }
        }.bind(this);
        app.listen(div, 'dblclick', function (e) {
            let node = this.dataSource.getNodeByIndex(e.currentTarget.itemIndex);
            if (node && nodeUtils.getHasTreeChildren(node))
                this._changeExpand(node);
        }.bind(this));
        app.listen(div.content, 'mouseup', function (e) {
            if ((e.button == 0) && !e.ctrlKey && !e.shiftKey) { // left button
                if ((this.lastMouseDiv === div) && (div.lastMouseUp)) {
                    let td = Date.now() - div.lastMouseUp;
                    if (td > 500 && td < 3000) { // #13692
                        // second mouse click after more than 0.5sec start editing
                        this.requestFrame(function () {
                            if (this.lastMouseDiv === div) { // nothing's changed ... start editing
                                this.editStart();
                            }
                        }.bind(this), 'editStart');
                    }
                }
                div.lastMouseUp = Date.now();
                this.lastMouseDiv = div;
            }
        }.bind(this));
        // handle clicks on the expand/collapse icons:
        app.listen(div.icons, 'click', function (e) {
            e.stopPropagation();
            let node = this.dataSource.getNodeByIndex(e.currentTarget.parentNode.itemIndex);
            if (node && nodeUtils.getHasTreeChildren(node))
                this._changeExpand(node);
        }.bind(this));
        app.listen(div.icons, 'mouseup', function (e) {
            e.stopPropagation(); // so that node is not selected on expand
        });
        app.listen(div.icons, 'mousedown', function (e) {
            e.stopPropagation(); // so that node is not selected on expand
        });
        app.listen(div.icons, 'dblclick', function (e) {
            e.stopPropagation(); // so that it's only treated as two single clicks (collapse and re-expand)
        });
        if (this.showDeleteButton) {
            let btn = document.createElement('div');
            div.appendChild(btn);
            div.toolButton = btn;
            btn.setAttribute('data-icon', 'delete');
            btn.classList.add('lvInlineIcon');
            btn.classList.add('visibleOnHover');
            btn.classList.add('alignRight');
            initializeControls(div);
            app.listen(btn, 'mouseup', function (e) {
                if (this.dataSource) {
                    let node = this.dataSource.getNodeByIndex(div.itemIndex);
                    this.raiseEvent('itemdelete', {
                        item: node
                    }, true, true);
                }
                e.stopPropagation();
            }.bind(this), true);
            app.listen(btn, 'click', function (e) {
                e.stopPropagation();
            });
        }
        let isPartOutOfListview = function (d) {
            let totalPos = this.container.getBoundingClientRect();
            let divPos = d.getBoundingClientRect();
            let isOut = ((divPos.left < totalPos.left) || (divPos.right > totalPos.right));
            if (isOut)
                return isOut;
            let p = getParent(d);
            while (!isOut && p) {
                totalPos = p.getBoundingClientRect();
                isOut = ((divPos.left < totalPos.left) || (divPos.right > totalPos.right));
                if (!isOut)
                    p = getParent(p);
            }
            return isOut;
        }.bind(this);
        div.tooltipValueCallback = function (tipdiv, vis, displayParams) {
            if (vis && _this.dataSource && !_this._cleanUpCalled) {
                let node = _this.dataSource.getNodeByIndex(div.itemIndex);
                if (node) {
                    if (_this.onNodeTooltip) {
                        _this.onNodeTooltip(tipdiv, node, div);
                    }
                    else {
                        let tit = nodeUtils.getNodeTitle(node);
                        let tip = nodeUtils.getNodeTooltip(node);
                        if (tip && (tip !== tit)) {
                            tipdiv.innerHTML = tip;
                        }
                        else if (tit && !isPromise(tit) && this.content) {
                            // display only if not visible    
                            if ((this.content.clientWidth < this.content.scrollWidth) || (isPartOutOfListview(this.content))) {
                                let rect = this.content.getBoundingClientRect();
                                displayParams.posX = rect.left + window.scrollX;
                                displayParams.posY = rect.top + window.scrollY;
                                let sval = isOurHTML(String(tit));
                                if (sval)
                                    tipdiv.innerHTML = sval;
                                else
                                    tipdiv.innerText = tit;
                            }
                            else
                                tipdiv.innerHTML = '';
                        }
                        else
                            tipdiv.innerHTML = '';
                    }
                }
            }
        }.bind(div);
    }
    suspendDiv(div) {
        super.suspendDiv(div);
        div.icon.innerHTML = ''; // animated SVG eats CPU even when are hidden (clean it when the div is suspended in LV divs cache - issue #12637)
        div._iconName = '';
        return true;
    }
    cleanUpDiv(div) {
        app.unlisten(div);
        app.unlisten(div.icons);
        app.unlisten(div.content);
        if (div.toolButton)
            app.unlisten(div.toolButton);
        div._iconName = '';
        super.cleanUpDiv(div);
    }
    // overriden
    bindData(div, index) {
        let node = this.dataSource.getNodeByIndex(index);
        if (!node)
            return;
        div.indent.style.width = (this.levelIndent) * (node.level) + 'px';
        if (nodeUtils.getHasTreeChildren(node)) {
            if (node.expanded) {
                div.icnCollapsed.style.visibility = 'hidden';
                div.icnExpanded.style.visibility = '';
            }
            else {
                div.icnCollapsed.style.visibility = '';
                div.icnExpanded.style.visibility = 'hidden';
            }
        }
        else {
            div.icnCollapsed.style.visibility = 'hidden';
            div.icnExpanded.style.visibility = 'hidden';
        }
        let iconName = nodeUtils.getNodeIcon(node);
        if (div._iconName != iconName) {
            div._iconName = iconName;
            if (iconName != '') {
                div.icon.innerHTML = ''; // The following is async, so that we don't show something incorrect until it's loaded
                loadIconFast(iconName, function (iconData) {
                    if (div._iconName == iconName) {
                        if (div.itemIndex == index)
                            setIconFast(div.icon, iconData);
                    }
                });
            }
            else {
                div.icon.innerHTML = '';
            }
        }
        if (div.check) {
            if (!div.check.origDisplayProp)
                div.check.origDisplayProp = div.check.style.display;
            if (nodeUtils.getHideCheckbox(node))
                div.check.style.display = 'none'; // set display = 'none' so that the checkbox does not take any space
            else
                div.check.style.display = div.check.origDisplayProp; // put back the original display prop.
            div.check.controlClass.indeterminate = node.partlyChecked;
            div.check.controlClass.checked = node.checked;
        }
        let val = nodeUtils.getNodeTitle(node);
        if (val && !isPromise(val)) {
            let sval = isOurHTML(String(val));
            if (sval)
                div.content.innerHTML = sval;
            else
                div.content.innerText = val;
        }
        else
            div.content.innerText = '';
    }
    get helpContext() {
        let node = this.focusedNode;
        if (!node)
            return '';
        return nodeUtils.getNodeHelpContext(node);
    }
    expandFocused() {
        let retval = false;
        let node = this.focusedNode;
        if (node && !node.expanded && nodeUtils.getHasChildren(node) && nodeUtils.getHasTreeChildren(node)) {
            this.expandNode(node);
            retval = true;
        }
        return retval;
    }
    collapseFocused() {
        let retval = false;
        let node = this.focusedNode;
        if (node) {
            if (node.expanded) {
                this.collapseNode(node);
                retval = true;
            }
            else {
                let parent = node.parent;
                if (parent && parent.parent /*not root*/) {
                    this.focusedNode = parent;
                    retval = true;
                }
            }
        }
        return retval;
    }
    handleNodeCheck(node) {
        node.checked = !node.checked;
        node.children.setAllChecked(node.checked);
        node.children.setAllModified(true);
        node.modified = true;
        this.raiseEvent('checkchange', {
            node: node
        }, true);
    }
    checkFocused() {
        let node = this.focusedNode;
        if (node) {
            this.handleNodeCheck(node);
            return true;
        }
        else
            return false;
    }
    ignoreHotkey(hotkey) {
        let res = super.ignoreHotkey(hotkey);
        if (!res && this.checkboxes && (hotkey.toLowerCase() == 'delete'))
            return true;
        else
            return res;
    }
    // overriden
    handle_keydown(e) {
        let handled = true;
        let anyModifier = e.altKey || e.ctrlKey || e.shiftKey;
        let changedExpand = false;
        switch (friendlyKeyName(e)) {
            case 'Right':
                if (!anyModifier) {
                    changedExpand = !!this.expandFocused();
                }
                break;
            case 'Left':
                if (!anyModifier) {
                    changedExpand = !!this.collapseFocused();
                }
                break;
            case 'Space':
                handled = false;
                if (!anyModifier && this.checkboxes) {
                    if (this.readOnly)
                        handled = true;
                    else if (this.checkFocused())
                        handled = true;
                }
                break;
            case 'Delete':
                handled = false;
                if (!anyModifier && this.checkboxes) {
                    if (this.readOnly)
                        handled = true;
                    else if (this.focusedNode && this.focusedNode.checked) {
                        this.checkFocused();
                        handled = true;
                    }
                }
                break;
            default:
                handled = false;
        }
        if (!handled) {
            return super.handle_keydown(e);
        }
        else {
            window.lastKeyDown = e;
            e.stopPropagation();
            if (changedExpand)
                e.stopImmediatePropagation(); // has to stop immediatelly if we changed expand state, to allow correct focusing on left/right key
        }
    }
    _assignTitles() {
        let ds = this.dataSource;
        if (!this._titlesAssigned) {
            /* LS: following was slow for many nodes so it was replaced by caching the title directly in nodeUtils.getNodeTitle + getting the title internally from node.dataSource.title
            ds.locked(function () {
                var _child;
                for (var i = 0; i < ds.count; i++) {
                    _child = ds.getFastObject(i, _child);
                    _child.title = nodeUtils.getNodeTitle(_child);
                }
            });
            */
        }
        this._titlesAssigned = true;
    }
    // overriden
    incrementalSearch(searchPhrase, reverseOrder, nextOccurence) {
        let args = arguments;
        let ds = this.dataSource;
        if (ds) {
            this._assignTitles();
            return super.incrementalSearch(searchPhrase, reverseOrder, nextOccurence);
        }
    }
    expandNode(node) {
        let _this = this;
        if (!node.expanding) {
            node.expanding = true;
            if (!node.expanded && !this.dataSource.keepChildrenWhenCollapsed)
                node.clear(); // clear children only when !expanded, only the _old_ nodes will be deleted and new will be added
            node.expanded = true;
            let handler = nodeHandlers[node.handlerID];
            nodeUtils.initLoadProgress(node);
            node.beginUpdate(); // starts update and marks children for possible deletion 
            handler.getChildren(node).then1(function () {
                node.expanding = false;
                let deleted = node.endUpdateAndGetDeleted(); // deletes children that no longer exist, and resolves whenLoaded() promise on children
                nodeUtils.collapseNodeList(deleted, true);
                nodeUtils.closeLoadProgress(node);
                if (!_this._cleanUpCalled) {
                    nodeUtils.onExpanded(node);
                    if (node.canceled) {
                        // node was canceled/collapsed meanwhile, so call onCollapsed (to be immediatelly after onExpanded above)
                        nodeUtils.onCollapsed(node);
                    }
                    else {
                        _this._titlesAssigned = false;
                        // send done notification
                        _this.raiseEvent('expandfinish', {
                            currentNode: node
                        }, true);
                    }
                }
            });
        }
        return this.localPromise(node.children.whenLoaded());
    }
    expandAll(maxLevel) {
        let _this = this;
        // eslint-disable-next-line no-async-promise-executor
        return new Promise(async function (resolve, reject) {
            let currentIndex = 0;
            if (!_this.root.expanded)
                await _this.expandNode(_this.root);
            while ((currentIndex < _this.dataSource.count) && (!_this._cleanUpCalled)) {
                let node = _this.dataSource.getNodeByIndex(currentIndex++);
                if (node && nodeUtils.getHasChildren(node) && (maxLevel == undefined || (node.level + 1) <= maxLevel)) {
                    await _this.expandNode(node);
                }
            }
            resolve();
        });
    }
    collapseNode(node, forced) {
        nodeUtils.collapseNode(node, forced);
    }
    collapseAll(forced) {
        this.dataSource.beginUpdate();
        this.collapseNode(this.root, forced);
        this.dataSource.endUpdate();
    }
    updateNode(node) {
        if (node.expanded)
            nodeUtils.refreshNodeChildren(node);
    }
    focusNode(node, noFocusEvent) {
        this.dontEmitFocusChange = noFocusEvent;
        let oldFocused = this.focusedNode;
        this.focusedNode = node;
        if (!oldFocused || (oldFocused.persistentID != node.persistentID)) {
            this.onFocusChanged(); // to call 'focuschange' event  
            this.setFocusedFullyVisible(); // #17045
        }
        this.dontEmitFocusChange = undefined;
    }
    storeState() {
        let path;
        if (this.suppliedStoreStateNode) {
            path = this._getNodePath(this.suppliedStoreStateNode);
            this.suppliedStoreStateNode = null;
        }
        else
            path = this._getNodePath(this.focusedNode);
        return {
            nodePath: path
        };
    }
    restoreState(fromObject) {
        return new Promise(function (resolve, reject) {
            this.setNodePath(fromObject.nodePath).then1(function () {
                resolve();
            });
        }.bind(this));
    }
    canDeleteSelected() {
        let node = this.focusedNode;
        if (!nodeUtils.isDeleteDisabled(node))
            return true;
    }
    deleteSelected(permanent) {
        let node = this.focusedNode;
        if (!nodeUtils.isDeleteDisabled(node)) {
            let list = this.dataSource.getEmptyList();
            list.add(this.focusedNode);
            nodeUtils.deleteItems(list, permanent);
        }
    }
    getPathPartNodeChild(node, pathPart) {
        return node.findChild(pathPart);
    }
    setNodesChecked(nodeCallback) {
        if (nodeCallback && this.checkboxes) {
            let ds = this.dataSource;
            ds.locked(function () {
                for (let i = 0; i < ds.count; i++) {
                    let node = ds.getNodeByIndex(i);
                    node.checked = nodeCallback(node);
                }
            });
            this.invalidateAll();
        }
    }
    getCheckedNodes() {
        return this.dataSource.getCheckedNodes();
    }
    hideUnselectedAsync(value) {
        return this.dataSource.hideUnselectedAsync(value);
    }
    editStart() {
        if (this.focusedNode && this.editSupport && nodeUtils.canEditNodeTitle(this.focusedNode)) {
            let fDiv = this.getDiv(this.focusedIndex);
            if (fDiv) {
                this.inEdit = {
                    listview: this,
                    editor: editors.gridViewEditors.textEdit,
                    div: fDiv.content,
                    fullSize: false,
                    node: this.focusedNode,
                    getValue: function (node) {
                        return nodeUtils.getNodeTitle(node, false, false, true /* #20711 */);
                    },
                    setValue: function (node, value) {
                        if (nodeUtils.getNodeTitle(node, false, false, true /* #20711 */) != value)
                            nodeUtils.setNodeTitle(node, value);
                    },
                };
                this.inEdit.editor('edit', this.inEdit.div, this.inEdit.node);
            }
        }
    }
    editSave() {
        if (this.inEdit) {
            this.inEdit.editor('save', this.inEdit.div, this.inEdit.node);
            this.inEdit = undefined;
        }
    }
    editCancel() {
        if (this.inEdit) {
            this.inEdit.editor('cancel', this.inEdit.div, this.inEdit.node);
            this.inEdit = undefined;
        }
    }
    runFuncOnHittest(e) {
        return window.dnd.getFocusedItemHandler.call(this, e);
    }
    cleanUpAutoExpand() {
        if (this._autoExpandTimer) {
            clearTimeout(this._autoExpandTimer);
            this._autoExpandTimer = null;
        }
    }
    handleAutoExpand(e) {
        window.dnd.getFocusedItemHandler.call(this, e);
        let node = undefined;
        // in case node cannot be used as a drop target, node is false, but this._lastDropNodeIndex contain current node index
        if (!node && (this._lastDropNodeIndex >= 0)) {
            this.dataSource.locked(() => {
                node = this.dataSource.getValue(this._lastDropNodeIndex);
            });
        }
        if (!!node && !node.expanded && nodeUtils.getHasTreeChildren(node) && !node.expanding) {
            if (!this._autoExpandingNode || (this._autoExpandingNode.persistentID != node.persistentID)) {
                this._autoExpandingPos = {
                    X: window.mouseScreenX,
                    Y: window.mouseScreenY
                };
                this._autoExpandingNode = node;
                // requestTimeout needs to be called outside of the event, otherwise his callback is called AFTER mouse button release
                requestFrame(() => {
                    this.cleanUpAutoExpand();
                    this._autoExpandTimer = requestTimeout(() => {
                        this._autoExpandTimer = null;
                        // check mouse is still over the node
                        if (this._autoExpandingNode && this._autoExpandingPos)
                            if ((this._autoExpandingPos.X === window.mouseScreenX) && (this._autoExpandingPos.Y === window.mouseScreenY)) {
                                this.expandNode(this._autoExpandingNode);
                            }
                        this._autoExpandingNode = null;
                    }, 1500);
                });
            }
        }
    }
    _getDropNodeHandler() {
        if (this._lastDropNodeResult /* this property is from window.dnd.getFocusedItemHandler */)
            return nodeHandlers[this._dropNode.handlerID];
    }
    getDropMode(e) {
        let handler = this._getDropNodeHandler();
        if (handler && handler.getDropMode) {
            return handler.getDropMode(this._dropNode.dataSource, e);
        }
        return e.shiftKey ? 'copy' : 'move';
    }
    canDrop(e) {
        this.handleAutoExpand(e);
        return this.runFuncOnHittest(e);
    }
    dragOver(e) {
        let handler = this._getDropNodeHandler();
        if (handler && resolveToValue(handler.canReorderNodes, false) && dnd.isSameControl(e))
            super.dragOver(e);
        else
            this.handleAutoExpand(e);
    }
    drop(e) {
        let handler = this._getDropNodeHandler();
        if (handler && handler.drop) {
            let n = this._dropNode;
            e._dropNode = n;
            let index = this.getDropIndex(e);
            if (n.parent)
                index = index - n.parent.globalIndex - 1;
            handler.drop(this._dropNode.dataSource, e, index);
        }
        this.cancelDrop();
    }
    setDragElementData(element, e) {
        super.setDragElementData(element, e);
        if (this.dataSource && (element.itemIndex < this.dataSource.count)) {
            this.dataSource.locked(function () {
                let item = this.dataSource.getNodeByIndex(element.itemIndex);
                if (item && item.handlerID) {
                    e.dataTransfer.setUserData(DRAG_DATATYPE, item.handlerID);
                }
            }.bind(this));
        }
    }
    getDraggedObject(e) {
        let ret = null;
        if (this.dataSource) {
            this.dataSource.locked(function () {
                if (this.dataSource.focusedNode)
                    ret = this.dataSource.focusedNode.dataSource;
            }.bind(this));
        }
        return ret;
    }
    setNodePath(path, noAutoExpand, noFocusEvent) {
        ODS('TreeView.setNodePath FROM ' + this.nodePath + ' TO ' + path);
        return new Promise(function (resolve, reject) {
            this.settingNodePath = true;
            let _resolve = function (node) {
                this.settingNodePath = false;
                resolve(node);
            }.bind(this);
            let _reject = function () {
                this.settingNodePath = false;
                reject();
            }.bind(this);
            if (this.nodePath == path || !path) {
                ODS('TreeView.setNodePath: path is same as the currently focused, no need for a job');
                _resolve(this.focusedNode);
                return;
            }
            // focus node according to the given path
            let pathParts = path.split(this.getNodePathSeparator);
            // eliminate empty items from the end (in case path is a file system path)
            while (pathParts.length) {
                if (pathParts[pathParts.length - 1] == '') {
                    pathParts.pop();
                }
                else
                    break;
            }
            let _focusNode = function (n) {
                this.focusNode(n, noFocusEvent);
            }.bind(this);
            let processNode = function (node, idx) {
                if (this._cleanUpCalled) {
                    ODS('TreeView.setNodePath: tree has been destroyed');
                    _reject();
                    return;
                }
                assert(idx < pathParts.length, 'idx = ' + idx + ' while pathParts.length = ' + pathParts.length);
                let child = this.getPathPartNodeChild(node, pathParts[idx]);
                if (child && !child.hidden) {
                    if (nodeUtils.getHasTreeChildren(child)) {
                        if (idx == pathParts.length - 1) {
                            ODS('TreeView.setNodePath: this is the last path part, we are done, focus this node');
                            _focusNode(child);
                            _resolve(child);
                        }
                        else {
                            // we need to expand this node and continue
                            if (!child.expanded && !child.expanding) {
                                if (noAutoExpand) {
                                    ODS('TreeView.setNodePath: this is the last expanded node, we are done, focus this node');
                                    _focusNode(child);
                                    _resolve(child);
                                }
                                else {
                                    this.expandNode(child).then(function () {
                                        processNode(child, idx + 1);
                                    });
                                }
                            }
                            else {
                                child.children.whenLoaded().then(function () {
                                    processNode(child, idx + 1);
                                });
                            }
                        }
                    }
                    else {
                        ODS('TreeView.setNodePath: this node does not have further children, focus this node');
                        _focusNode(child);
                        _resolve(child);
                    }
                }
                else {
                    ODS('TreeView.setNodePath: the searched node no longer exists (' + pathParts[idx] + '), focus parent');
                    if (node.persistentID != this.root.persistentID)
                        _focusNode(node);
                    _resolve(node);
                }
            }.bind(this);
            if (!this.canProcessPath(pathParts)) {
                ODS('TreeView.setNodePath: focus root, collapse its subnodes = "Go home"');
                _focusNode(this.root);
                let subNodes = this.root.children;
                subNodes.locked(function () {
                    for (let i = 0; i < subNodes.count; i++) {
                        let node = subNodes.getValue(i);
                        this.collapseNode(node);
                    }
                }.bind(this));
                _resolve(this.root);
            }
            else {
                this.localPromise(this.root.children.whenLoaded()).then(function () {
                    processNode(this.root, this.rootIncludedInSearchPath ? 1 : 0);
                }.bind(this));
            }
        }.bind(this));
    }
    canProcessPath(pathParts) {
        return pathParts.length > 1;
    }
    _getNodePath(node) {
        if (node)
            return node.nodePath;
        else
            return '';
    }
    get getNodePathSeparator() {
        return '/';
    }
    get rootIncludedInSearchPath() {
        return true; // by default 'root' is in path, co locate from second item
    }
    get nodePath() {
        return this._getNodePath(this.focusedNode);
    }
    set nodePath(path) {
        if (this.nodePath != path)
            this.setNodePath(path);
    }
    get focusedNode() {
        return this.dataSource.focusedNode;
    }
    set focusedNode(node) {
        this.dataSource.focusedNode = node;
    }
    get previousFocusedNode() {
        return this.dataSource.previousFocusedNode;
    }
    get root() {
        return this.dataSource.root;
    }
}
registerClass(TreeView);
