/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

propertiesTabs.tabClassification.load = function (track, dialog) {

    let mainElement = qid('tabClassificationContent');
    let utils = app.utils;

    qeid(mainElement, 'tempo').controlClass.value = utils.multiString2VisualString(track.tempo);
    qeid(mainElement, 'mood').controlClass.value = utils.multiString2VisualString(track.mood);
    qeid(mainElement, 'occasion').controlClass.value = utils.multiString2VisualString(track.occasion);
    qeid(mainElement, 'quality').controlClass.value = utils.multiString2VisualString(track.quality);
    let playlistTree = qeid(mainElement, 'playlistTree');
    dialog.trackLocalListen(playlistTree, 'checkchange', () => {
        dialog.modified = true;
    });
    if (!dialog.isGroup) {
        setVisibility(playlistTree, true);
        playlistTree.controlClass.track = track;
    } else {
        setVisibility(playlistTree, false);
        setVisibility(qeid(mainElement, 'lblPlaylists'), false);
    }
}

propertiesTabs.tabClassification.saveAsync = function (track, dialog) {

    let mainElement = qid('tabClassificationContent');
    let utils = app.utils;

    if (!dialog.isGroup) {
        track.tempo = utils.visualString2MultiString(qeid(mainElement, 'tempo').controlClass.value);
        track.mood = utils.visualString2MultiString(qeid(mainElement, 'mood').controlClass.value);
        track.occasion = utils.visualString2MultiString(qeid(mainElement, 'occasion').controlClass.value);
        track.quality = utils.visualString2MultiString(qeid(mainElement, 'quality').controlClass.value);

        // and remove the track from unchecked playlists (#17821)
        let playlistTree = qeid(mainElement, 'playlistTree');
        let playlists = playlistTree.controlClass.getUncheckedObjects();
        listAsyncForEach(playlists, (playlist, next) => {
            if (!playlist.isAutoPlaylist)
                playlist.removeTrackAsync(track).then(next, next);
            else
                next();
        });

    } else {
        // multiple tracks modification
        let ischecked = function (id) {
            let res = false;
            let chb = qeid(mainElement, 'chb_' + id);
            if (chb)
                res = chb.controlClass.checked;
            return res;
        };
        let setccval = function (val, id) {
            if (ischecked(id))
                track[val] = qeid(mainElement, id).controlClass.value;
        };
        let setmulticcval = function (val, id) {
            if (ischecked(id))
                track[val] = utils.visualString2MultiString(qeid(mainElement, id).controlClass.value);
        };

        setmulticcval('tempo', 'tempo');
        setmulticcval('mood', 'mood');
        setmulticcval('occasion', 'occasion');
        setmulticcval('quality', 'quality');
    }
    return dummyPromise();
}
