/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

requirejs('controls/listview');
requirejs('controls/treeview');
requirejs('viewHandlers.js');
requirejs('controls/editors');

let utils = app.utils;
let foldersList;
let serverContainers;

const
    T_ONETIME = _('One time'),
    T_STARTUP = _('At startup'),
    T_CONT = _('Continuously'),
    T_BOTH = T_STARTUP + ' & ' + T_CONT;

// initialization --------------------------------------------
function init(params) {

    title = _('Add folders');

    foldersList = app.utils.createSharedList();
    serverContainers = app.utils.createSharedList();

    window.localListen(qid('btnOK'), 'click', function () {
        qid('btnOK').controlClass.disabled = true;

        let list = lvFolders.controlClass.getCheckedNodes();

        listAsyncForEach(list, (node, next) => {
            if (node.dataSource && node.dataSource.objectType == 'serverContainer') {
                serverContainers.add(node.dataSource);
                next();
            } else {
                if (node.parent && node.parent.checked)
                    next(); // skip this node, its parent is checked too, no need to add (#14917)
                else
                    window.localPromise(navUtils.getNodeFolder(node)).then(function (path) {
                        foldersList.add(app.filesystem.getFolderFromString(path));
                        next();
                    });
            }
        }, () => {
            foldersList.setAllChecked(true);
            modalResult = 1;
        });
    });

    let addFolder2Tree = (folder) => {
        if (folder != '') {                        
            // and try to focus and check a sub-path entered by user
            let path = folder;
            path = replaceAll('/', '\\', path);
            path = removeFirstSlash(removeLastSlash(path));
            let pathParts = path.split('\\'); 
            let wholePartFound = true;

            if (pathParts.length > 0) {                
                let inode = lvFolders.controlClass.root;
                asyncForEach(pathParts, (part, nextPart) => {
                    window.localPromise(lvFolders.controlClass.expandNode(inode)).then(() => {
                        let found = false;
                        listForEach(inode.children, (child) => {
                            let match = (child.title.toLowerCase() == part.toLowerCase());
                            if (child.title.length > 1 && part.length > 1 && child.title[1] == ':' && part[1] == ':')
                                match = (child.title[0].toLowerCase() == part[0].toLowerCase());

                            if (match) {
                                inode = child;
                                found = true;
                                nextPart();
                                return true; // terminate the children loop
                            }
                        });
                        if (!found) {    
                            wholePartFound = false;                                                   
                            nextPart(true /* terminate */ );
                        }
                    });
                }, () => {
                    if (inode != lvFolders.controlClass.focusedNode) {
                        lvFolders.controlClass.focusedNode = inode;                        
                        lvFolders.controlClass.setFocusedFullyVisible();
                        if (wholePartFound)
                            lvFolders.controlClass.checkFocused();
                        else {
                            messageDlg(sprintf(_('The location %s does not exist.'), [escapeXml(folder)]), 'Error', ['btnOK'], {
                                defaultButton: 'btnOK'
                            }, undefined);
                        }
                    }
                });                
            }
        }
    };
    
    if (params && params.showAddButton) {
        window.localListen(qid('btnAdd'), 'click', () => {
            addFolder2Tree(qid('edtPath').value);
        });
    } else {
        setVisibility(qid('btnAdd'), false);
        setVisibility(qid('edtPath'), false);
    }

    let lvFolders = qid('lvFolders');
    if (params && params.rootNode)
        lvFolders.controlClass.useRootNode(params.rootNode);
    else
        lvFolders.controlClass.useRootNode('localComputer');

    if (params.editSupport !== undefined) {
        lvFolders.controlClass.editSupport = params.editSupport;
    }

    window.initPromise = new Promise(function (resolve, reject) {
        let checkFolder = function (list, idx) {
            let current = idx;
            let total = list.count;
            if (list.count) {
                list.locked(function () {
                    let folder = list.getValue(current);
                    if (typeof folder !== 'string') {
                        folder = folder.path;
                    }
                    if (folder.substr(0, 2) != '\\\\') {
                        window.localPromise(lvFolders.controlClass.setFolderPath(folder, false /* auto expand */ , (current + 1 < total) /* focus only the last folder */ )).then(
                            function (node) {
                                if (node) {
                                    node.checked = false;
                                    lvFolders.controlClass.handleNodeCheck(node); // checked here
                                }
                                if (++current < total) {
                                    checkFolder(list, current);
                                } else
                                    resolve();
                            }
                        );
                    } else {
                        if (++current < total) {
                            checkFolder(list, current);
                        } else
                            resolve();
                    }
                });
            }
        }

        window.localPromise(lvFolders.controlClass.expandNode(lvFolders.controlClass.root)).then(function () {
            if (params.initFolder) {
                checkFolder(params.initFolder, 0);
            } else {
                let lastScannedFolders = app.filesystem.getLastScannedFolders();
                if (lastScannedFolders.count) {
                    checkFolder(lastScannedFolders, 0);
                }
            }
        });
    });

}

function getPaths() {
    return foldersList;
}

function getServerContainers() {
    return serverContainers;
}

window.windowCleanup = function () {
    utils = undefined;
    foldersList = undefined;
    serverContainers = undefined;
}