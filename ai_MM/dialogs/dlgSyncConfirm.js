/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

import '../commonControls';


nodeHandlers._syncConfirmItem = inheritNodeHandler('_SyncConfirmItem', 'Base', {
    title: function (node) {
        return node.dataSource;
    }
});

nodeHandlers._confirmSyncUpdateOperations = inheritNodeHandler('_ConfirmSyncUpdateOperations', 'Base', {
    title: function (node) {
        return sprintf(_('Existing file(s) and playlist(s) to update from the device to the PC (%d)'), node.dataSource.count);
    },
    icon: 'synchronize',
    getChildren: function (node) {
        return new Promise(function (resolve, reject) {
            node.addChildren(node.dataSource, '_syncConfirmItem');
            resolve();
        });
    },
});

nodeHandlers._confirmSyncCopyOperations = inheritNodeHandler('_ConfirmSyncCopyOperations', 'Base', {
    title: function (node) {
        return sprintf(_('New file(s) and playlist(s) to copy from the device to the PC (%d)'), node.dataSource.count);
    },
    icon: 'copy',
    getChildren: function (node) {
        return new Promise(function (resolve, reject) {
            node.addChildren(node.dataSource, '_syncConfirmItem');
            resolve();
        });
    },
});

nodeHandlers._confirmSyncDeleteOperations = inheritNodeHandler('_ConfirmSyncDeleteOperations', 'Base', {
    title: function (node) {
        return sprintf(_('File(s) and playlist(s) to delete from the device (%d)'), node.dataSource.count);
    },
    icon: 'delete',
    getChildren: function (node) {
        return new Promise(function (resolve, reject) {
            node.addChildren(node.dataSource, '_syncConfirmItem');
            resolve();
        });
    },
});

let deleteOpsNode, updateOpsNode, copyOpsNode;

nodeHandlers._confirmSyncOperations = inheritNodeHandler('_ConfirmSyncOperations', 'Base', {
    getChildren: function (node) {
        return new Promise(function (resolve, reject) {

            let deleteList = node.dataSource.getFiles('delete');
            if (deleteList.count > 0)
                deleteOpsNode = node.addChild(deleteList, '_confirmSyncDeleteOperations');

            let updateList = node.dataSource.getFiles('updateFrom');
            if (updateList.count > 0)
                updateOpsNode = node.addChild(updateList, '_confirmSyncUpdateOperations');

            let copyList = node.dataSource.getFiles('copyFrom');
            if (copyList.count > 0)
                copyOpsNode = node.addChild(copyList, '_confirmSyncCopyOperations');

            resolve();
        });
    },
});

window.init = function(params) {
    let wnd = this;
    wnd.title = _('Auto-sync');
    wnd.resizeable = true;

    qid('lblCaption').innerText = _('Please confirm the following changes:');

    let tree = qid('lvTree');
    let root = tree.controlClass.root;
    root.handlerID = '_confirmSyncOperations';
    root.dataSource = wnd.getInfo();
    window.localPromise(tree.controlClass.expandAll()).then(function () {
        if (deleteOpsNode) {
            tree.controlClass.collapseNode(deleteOpsNode);
            deleteOpsNode.checked = true;
        }
        if (updateOpsNode) {
            tree.controlClass.collapseNode(updateOpsNode);
            updateOpsNode.checked = true;
        }
        if (copyOpsNode) {
            tree.controlClass.collapseNode(copyOpsNode);
            copyOpsNode.checked = true;
        }
    });

    let btnOK = qid('btnOK');
    btnOK.controlClass.textContent = _('Continue');
    window.localListen(btnOK, 'click', function () {
        let operInfo = wnd.getInfo();

        function saveNode(node, kind) {
            if (node) {
                let list = newStringList();
                if (!node.checked && !node.partlyChecked) {
                    operInfo.setFiles(kind, list /* empty list*/ );
                } else
                if (node.expanded) {
                    fastForEach(node.children, function (child) {
                        if (child.checked)
                            list.add(child.dataSource.toString());
                    });
                    operInfo.setFiles(kind, list);
                }
            }
        }
        saveNode(deleteOpsNode, 'delete');
        saveNode(updateOpsNode, 'updateFrom');
        saveNode(copyOpsNode, 'copyFrom');

        let res = {
            btnID: 'btnOK'
        };
        setResult(res);
        closeWindow();
    });
    window.localListen(qid('btnCancel'), 'click', function () {
        let res = {
            btnID: 'btnCancel'
        };
        setResult(res);
        closeWindow();
    });

    showModal();
};

window.windowCleanup = function () {
    deleteOpsNode = undefined;
    updateOpsNode = undefined;
    copyOpsNode = undefined;
}