registerFileImport('controls/checkboxTree');

/**
@module UI snippets
*/

import TreeView from './treeview';

/**
 * UI tree element with support for checkbox handling
 */
export default class CheckboxTree extends TreeView {
    private _checkedObjects: any;

    initialize(rootelem, params) {
        super.initialize(rootelem, params);
        this.checkboxes = true;
        this.dataSource.keepChildrenWhenCollapsed = true;
        app.listen(this, 'expandfinish', this._onExpanded.bind(this));
    }

    reinitNodes(rootHandlerID) {
        let handlerID = rootHandlerID || this.root.handlerID;
        let keepChildrenWhenCollapsed = this.dataSource.keepChildrenWhenCollapsed;
        this.dataSource = app.createTree();
        this.dataSource.keepChildrenWhenCollapsed = keepChildrenWhenCollapsed;
        this.root.handlerID = handlerID;
    }

    cleanUp() {
        app.unlisten(this, 'expandfinish');
        super.cleanUp();
    }

    /**
    Returns list of checked objects

    @method getCheckedObjects
    @return {SharedList}
    */
    getCheckedObjects() {
        let returnList = app.utils.createSharedList();

        let processNode = function (node, list) {
            fastForEach(node.children, function (child) {
                if (child.checked) {
                    list.add(child.dataSource);
                } else
                    processNode(child, list);
            });
        };
        processNode(this.root, returnList);

        return returnList;
    }

    /**
    Returns list of unchecked objects

    @method getUncheckedObjects
    @return {SharedList}
    */
    getUncheckedObjects() {
        let returnList = app.utils.createSharedList();

        let processNode = function (node, list) {
            fastForEach(node.children, function (child) {
                if (!child.checked) {
                    list.add(child.dataSource);
                } else
                    processNode(child, list);
            });
        };
        processNode(this.root, returnList);

        return returnList;
    }

    /**
    Returns list of all objects for which check state was modified, check state is indicated via isChecked within the list

    @method getObjectList
    @return {SharedList}
    */
    getObjectList() {
        return this.root.getModifiedChildrenDataSources(); // does the same as the commented out code below, but is much faster (native)
        /*
        var returnList = app.utils.createSharedList();
        var processNode = function (node, list) {
            var children = node.children;
            children.forEach(function (child) {
                if (child.modified) {
                    list.modifyAsync(function () {
                        list.add(child.dataSource);
                        if (child.checked)
                            list.setChecked(list.count - 1, true);
                    });
                    if (!child.checked)
                        processNode(child, list);
                }
            });
        }
        processNode(this.root, returnList);
        return returnList;
        */
    }

    /**
    Sets list of objects to be checked

    @method setCheckedObjects
    @param {SharedList}
    */
    setCheckedObjects(list) {
        return new Promise(function (resolve, reject) {
            this.collapseNode(this.root);
            this._checkedObjects = list;
            this.expandNode(this.root).then(resolve);
        }.bind(this));
    }

    _onExpanded(e) {
        let node = e.detail.currentNode;
        if (this.dataSource.keepChildrenWhenCollapsed && node.expandCount > 1)
            return;

        let checkboxRule = resolveToValue(nodeHandlers[node.handlerID].checkboxRule);
        if ((node.persistentID != this.root.persistentID) && (((checkboxRule != 'parent_independent') && node.checked) || (node.modified /*modified manually by user*/ ))) {
            // inherit state of the expanded parent
            node.children.setAllChecked(node.checked);
            node.children.setAllModified(node.checked);
        } else
        if (this._checkedObjects)
            node.children.setCheckedObjects(this._checkedObjects);
    }

}
registerClass(CheckboxTree);
