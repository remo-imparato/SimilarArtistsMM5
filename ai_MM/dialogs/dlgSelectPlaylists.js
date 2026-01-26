/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

let playlists = null;

function init(params) {
    title = _('Select playlists');

    let playlistTree = qid('playlistTree');
    let btnOK = qid('btnOK');
    btnOK.controlClass.disabled = true;

    let _whenReady = () => {
        let acceptFunct = function () {
            playlists = playlistTree.controlClass.getCheckedPlaylists();
            modalResult = 1;
        }
        btnOK.controlClass.disabled = false;
        window.localListen(btnOK, 'click', acceptFunct);
    }

    if (params && params.checkedPlaylists) {
        window.localPromise(playlistTree.controlClass.setCheckedObjects(params.checkedPlaylists)).then(() => {
            window.localPromise(playlistTree.controlClass.expandAll()).then(_whenReady); // to solve #16215
        });
    } else {
        window.localPromise(playlistTree.controlClass.expandNode(playlistTree.controlClass.root)).then(_whenReady);
    }

    let chbHideUnselected = qid('chbHideUnselected');
    window.localListen(chbHideUnselected, 'click', function () {
        playlistTree.controlClass.hideUnselectedAsync(this.controlClass.checked);
    });
}

function getPlaylists() {
    return playlists;
}
