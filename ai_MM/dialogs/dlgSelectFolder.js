/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

function init(params) {
    title = _('Select folder');
    params = params || {};
    if (params.title)
        title = params.title;
    let multiselect = false;
    if (params.multiselect)
        multiselect = params.multiselect;

    let path = '';

    if (params.subtitle)
        qid('lblSubtitle').innerText = params.subtitle;
    else
        setVisibility( qid('lblSubtitle'), false);

    let UI = getAllUIElements();

    if (params.helpContext)
        document.body.setAttribute('data-help', params.helpContext);

    setVisibility(UI.customPanel, multiselect);

    let selectFolder = function (folder) {
        return new Promise(function (resolve, reject) {
            folder = removeLastSlash(folder) + app.filesystem.getPathSeparator();
            window.localPromise(UI.fldFolders.controlClass.setFolderPath(folder, false /* auto expand */ , true)).then(
                function (node) {
                    if (node) {
                        if ((node.handlerID !== 'computer') && multiselect) {
                            node.checked = true;
                        }
                        UI.fldFolders.controlClass.focusedNode = node;
                    }
                    resolve(node);
                }, reject);
        });
    };

    let addNetworkFolder2Tree = function (folder) {
        if (folder != '') {
            if (!isNetworkPath(folder)) {
                messageDlg(sprintf(_('The location %s does not exist.'), [escapeXml(folder)]), 'Error', ['btnOK'], {
                    defaultButton: 'btnOK'
                }, undefined);
                return;
            }
            let lvFolders = UI.fldFolders;
            let path = folder;
            path = replaceAll('/', '\\', path); //              '\\192.168.0.16/music/'   -> '\\192.168.0.16\music\'
            let res = app.filesystem.networkResourceFromPath(path);
            let root = lvFolders.controlClass.root;
            root.addChild(res, 'networkResource');

            // and try to fucus and check a sub-path entered by user (#15811)                        
            path = replaceAll('\\\\', '\\', path); //           '\\192.168.0.16\music\'   -> '\192.168.0.16\music\'
            path = removeFirstSlash(removeLastSlash(path)); //  '\192.168.0.16\music\'    -> '192.168.0.16\music'                 
            let pathParts = path.split('\\'); //                '192.168.0.16\music'      -> ['192.168.0.16', 'music']

            if (pathParts.length > 0) {
                window.localPromise(nodeUtils.getNodeByPath(lvFolders.controlClass.root, [navUtils.createNodeState(root.handlerID), navUtils.createNodeState('networkResource', res)])).then((node) => {
                    let inode = node;
                    inode.checked = true;
                    asyncForEach(pathParts, (part, nextPart) => {
                        window.localPromise(lvFolders.controlClass.expandNode(inode)).then(() => {
                            let found;
                            listForEach(inode.children, (child) => {
                                if (child.title.toLowerCase() == part.toLowerCase()) {
                                    inode = child;
                                    inode.checked = true;
                                    found = true;
                                    nextPart();
                                    return true; // terminate the children loop
                                }
                            });
                            if (!found)
                                nextPart(true /* terminate */ );
                        });
                    }, () => {
                        if (inode != node) {
                            lvFolders.controlClass.focusedNode = inode;
                            lvFolders.controlClass.checkFocused();
                        }
                    });
                });
            }
        }
    };

    let selectFolders = function (ar, idx) {
        if (ar && ar.length > idx) {
            window.localPromise(selectFolder(ar[idx])).then(function (node) {
                if (!node || (node.handlerID === 'computer')) { // not found in the tree ... probably network path ? Add as a new node
                    addNetworkFolder2Tree(ar[idx]);
                }
                selectFolders(ar, idx + 1);
            }, () => {
                // not found in the tree ... probably network path ? Add as a new node
                addNetworkFolder2Tree(ar[idx]);                
            });
        }
    }

    if (params && params.defaultDir) {
        selectFolder(params.defaultDir);
    }

    window.localListen(qid('btnOK'), 'click', function () {
        if (multiselect) {
            path = UI.fldFolders.controlClass.getCheckedFolders();
        } else {
            let n = UI.fldFolders.controlClass.focusedNode;
            if (n && n.dataSource)
                path = n.dataSource.path;
        }
        modalResult = 1;
    });

    if (params.hideUnselectedVisible == false)
        setVisibility(UI.chbHideUnselected, false);
    else
    window.localListen(UI.chbHideUnselected, 'click', function () {
        UI.fldFolders.controlClass.hideUnselectedAsync(this.controlClass.checked);
    });

    window.localListen(UI.btnAdd, 'click', function () {
        let folders = UI.edtAddFolder.controlClass.value;
        if (folders !== '') {
            let ar = folders.split(',');
            selectFolders(ar, 0);
        }

    });

    if (params.newFolderVisible == false)
        setVisibility(UI.btnNewFolder, false);
    else
        window.localListen(UI.btnNewFolder, 'click', function () {
            let focusedNode = UI.fldFolders.controlClass.dataSource.focusedNode;
            if (focusedNode) {
                let act = bindAction(window.actions.newFolderNode, focusedNode);
                act.execute();
            }
        });

    if (params && params.checkboxes == false)
        UI.fldFolders.controlClass.checkboxes = false;


    this.getResult = function () {
        return path;
    };
}
