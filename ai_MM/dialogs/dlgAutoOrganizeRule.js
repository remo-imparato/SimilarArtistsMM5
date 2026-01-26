/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

requirejs("controls/maskedit");
requirejs("controls/treeview");

function init(params) {

    let item = params.item;
    if (!item) {
        modalResult = 0;
        return;
    }

    title = _('Auto-organize Rule');
    resizeable = true;

    let UI = getAllUIElements();

    let tree = app.createTree();
    tree.root.handlerID = 'autoOrganizeTreeRoot';
    tree.root.dataSource = item;
    UI.lvTree.controlClass.dataSource = tree;
    UI.lvTree.controlClass.expandNode(tree.root);

    window.localPromise(item.getRulesAsync()).then(function (text) {
        let rules = text.split(';');
        let selectRules = function (idx) {
            if (idx >= rules.length) {
                UI.lvTree.controlClass.invalidateAll();
                return;
            }

            window.localPromise(UI.lvTree.controlClass.setNodePath('autoOrganizeTreeRoot/' + rules[idx])).then(function (node) {
                node.checked = true;
                selectRules(idx + 1);
            });
        };
        selectRules(0);
    });

    UI.edtMask.controlClass.value = item.path + item.mask;

    window.localListen(UI.btnOK, 'click', function () {

        let val = UI.edtMask.controlClass.value;
        item.path = app.masks.getPathPart(val);
        item.mask = app.masks.getMaskPart(val);
        item.removeAllCollections();
        item.removeAllGenres();
        item.removeAllPlaylists();

        let skipIndividualCollections;
        let skipIndividualGenres;
        let checkedNodes = tree.getCheckedNodes();
        checkedNodes.locked(function () {
            for (let i = 0; i < checkedNodes.count; i++) {
                let node = checkedNodes.getValue(i);
                if (node.handlerID == 'collections') {
                    item.addCollectionIntoRule(-1);
                    skipIndividualCollections = true;
                } else
                if (node.handlerID == 'allGenres') {
                    item.addGenreIntoRule(-1);
                    skipIndividualGenres = true;
                } else {
                    let ds = node.dataSource;
                    if (ds) {
                        if (ds.objectType == 'playlist') {
                            item.addPlaylistIntoRule(ds.id);
                        } else if (ds.objectType == 'collection') {
                            if (!skipIndividualCollections)
                                item.addCollectionIntoRule(ds.id);
                        } else if (ds.objectType == 'genre') {
                            if (!skipIndividualGenres)
                                item.addGenreIntoRule(ds.id);
                        }
                    }
                }
            }
        });

        modalResult = 1;
    });
}
