/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

registerFileImport('controls/selectPlaylistTree');
/**
@module UI snippets
*/
import CheckboxTree from './checkboxTree';
/**
UI playlist tree element for selection of playlist.

@class SelectPlaylistTree
@constructor
@extends TreeView
*/
class SelectPlaylistTree extends CheckboxTree {
    initialize(rootelem, params) {
        super.initialize(rootelem, params);
        this.checkboxes = (params && params.checkboxes);
        this.root.dataSource = app.playlists.root;
        this.root.handlerID = 'playlists';
        if (params && params.preExpand)
            this.expandNode(this.root);
    }
    getSelectedPlaylist() {
        let node = this.dataSource.focusedNode;
        if (node)
            return node.dataSource;
        else
            return undefined;
    }
    getCheckedPlaylists() {
        let playlists = app.utils.createSharedList();
        let processNode = function (node, list) {
            let children = node.children;
            children.forEach(function (child) {
                if (child.checked)
                    list.add(child.dataSource);
                processNode(child, list);
            });
        };
        processNode(this.root, playlists);
        playlists.notifyLoaded();
        return playlists;
    }
}
registerClass(SelectPlaylistTree);
