/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

/**
@module UI snippets
*/

requirejs('controls/checkboxTree');

/**
Tree that shows playlists to which a given song belongs (used e.g. in Track Properties dialog)

@class TrackPlaylistsTree
@constructor
@extends TreeView
*/

class TrackPlaylistsTree extends CheckboxTree {

    initialize(rootelem, params) {
        super.initialize(rootelem, params);
        this.checkboxes = true;

        nodeHandlers['_playlistTreeNode'] = mergeObjects(nodeHandlers['playlist'], {
            hideCheckbox: function (dataSource) {
                if (dataSource.isAutoPlaylist)
                    return true;
                else
                    return false;
            },
            hasChildren: false
        });
        var _this = this;
        nodeHandlers['_playlistTreeNodeRoot'] = {
            getChildren: function (node) {
                cancelPromise(_this.loadPlaylistPromise);
                var playlists = app.playlists.getPlaylistsForTrackAsync(_this._track);
                _this.loadPlaylistPromise = playlists.whenLoaded();
                return nodeUtils.fillFromList(node, playlists, '_playlistTreeNode');
            },
            hasChildren: true
        };
        this.root.handlerID = '_playlistTreeNodeRoot';
    }

    cleanUp() {
        cancelPromise(this.loadPlaylistPromise);
        super.cleanUp();
        nodeHandlers['_playlistTreeNode'] = undefined;
        nodeHandlers['_playlistTreeNodeRoot'] = undefined;
    }
    
    get track () {
        return this._track;
    }
    set track (track) {
        this._track = track;
        this.expandNode(this.root);
    }
    
}
registerClass(TrackPlaylistsTree);
