/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

let playlist = null;

function init(params) {
    title = _('Select playlist');

    let playlistTree = qid('playlistTree');
    playlistTree.controlClass.expandNode(playlistTree.controlClass.root);

    let acceptFunct = function () {
        playlist = playlistTree.controlClass.getSelectedPlaylist();
        modalResult = 1;
    }

    let newPlaylistFunct = function () {
        playlist = app.playlists.root.newPlaylist();        
        playlist.isNew = true;
        modalResult = 1;
    }

    setVisibility(qid('btnNew'), params && params.showNewPlaylist);

    window.localListen(qid('btnNew'), 'click', newPlaylistFunct);
    window.localListen(qid('btnOK'), 'click', acceptFunct);
    window.localListen(qid('playlistTree'), 'dblclick', acceptFunct);
}

function getPlaylist() {
    return playlist;
}
