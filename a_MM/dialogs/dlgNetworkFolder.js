/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

requirejs('controls/listview');
requirejs('controls/treeview');
requirejs("controls/columntracklist");

let utils = app.utils;

// initialization --------------------------------------------
function init(params) {

    title = _('Add folders');

    this.paths = newStringList();

    let lvFolders = qid('lvFolders');
    let edtPath = qid('edtPath');

    let addFolder2Tree = function (folder) {
        if (folder != '') {
            let res = app.filesystem.networkResourceFromPath(folder);
            let root = lvFolders.controlClass.root;
            root.addChild(res, 'networkResource');

            // and try to fucus and check a sub-path entered by user (#15811)
            let path = folder;
            path = replaceAll('/', '\\', path); //              '\\192.168.0.16/music/'   -> '\\192.168.0.16\music\'            
            path = replaceAll('\\\\', '\\', path); //           '\\192.168.0.16\music\'   -> '\192.168.0.16\music\'
            path = removeFirstSlash(removeLastSlash(path)); //  '\192.168.0.16\music\'    -> '192.168.0.16\music'                 
            let pathParts = path.split('\\'); //                '192.168.0.16\music'      -> ['192.168.0.16', 'music']
            pathParts.shift(); //                               ['192.168.0.16', 'music'] -> ['music']

            if (pathParts.length > 0) {
                window.localPromise(nodeUtils.getNodeByPath(lvFolders.controlClass.root, [navUtils.createNodeState(root.handlerID), navUtils.createNodeState('networkResource', res)])).then((node) => {
                    let inode = node;
                    asyncForEach(pathParts, (part, nextPart) => {
                        window.localPromise(lvFolders.controlClass.expandNode(inode)).then(() => {
                            let found;
                            listForEach(inode.children, (child) => {
                                if (child.title.toLowerCase() == part.toLowerCase()) {
                                    inode = child;
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
    }.bind(this);
    addFolder2Tree(params.initFolder);

    if (params.editSupport !== undefined) {
        lvFolders.controlClass.editSupport = params.editSupport;
    }


    let btnAdd = qid('btnAdd');
    window.localListen( edtPath, 'input', () => {
        if ((edtPath.value.length > 1) && (edtPath.value.substr(1,1) == ':'))
            btnAdd.controlClass.disabled = true; // #19975
        else
            btnAdd.controlClass.disabled = false;
    });

    window.localListen(btnAdd, 'click', function () {
        addFolder2Tree(edtPath.value);
    }.bind(this));

    window.localListen(qid('btnOK'), 'click', function () {

        let list = lvFolders.controlClass.getCheckedNodes();
        listAsyncForEach(list, (node, next) => {
            if (node.parent && node.parent.checked)
                next(); // skip this node, its parent is checked too, no need to add (#14917)
            else
                window.localPromise(navUtils.getNodeFolder(node)).then((path) => {
                    this.paths.add(path);
                    next();
                });
        }, () => {
            modalResult = 1;
        });

    }.bind(this));

    qid('btnOK').focus();
}

function getPaths() {
    return this.paths;
}
