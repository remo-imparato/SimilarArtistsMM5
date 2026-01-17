/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

let UI = null;

function init(params) {
    let wnd = this;
    wnd.resizeable = false;
    UI = getAllUIElements();
    title = _('Confirmation');
    params = params || {};
    params.action = params.action || 'delete';
    params.confType = params.confType || 'library'; // folder, library, playlist, nowplaying, device
    let q;
    if (params.shift) {
        q = _('Are you sure you want to permanently delete ');
        setVisibility(UI.selectionDiv, false);
    } else {
        q = _('Are you sure you want to delete');
    }

    if (params.heading)
        q = params.heading;
    else
    if (params.fileName) {
        q += ' ' + '"' + params.fileName + '"?';
    } else {
        params.fileCount = params.fileCount || 0;
        q += ' ' + params.fileCount + ' ' + _('track', 'tracks', params.fileCount) + '?';
    };

    let showAskNext = false;
    let doAskNextName = undefined;
    let confirmName = undefined;
    let _sett = window.settings.get('Confirmations');
    let sett = _sett.Confirmations;
    let selIdx = 0;

    setVisibility(UI.chbSel21, false);
    setVisibility(UI.chbSel3, false);
    setVisibility(UI.chbSel4, false);
    setVisibility(UI.chbSel5, false);

    switch (params.confType) {
        case 'library':
            UI.lbl_sel0.innerText = _('Delete from the database only');
            UI.lbl_sel1.innerText = _('Delete from the database and drive');
            UI.chbSel0.controlClass.retValues = ['library'];
            UI.chbSel1.controlClass.retValues = ['library', 'computer'];
            confirmName = 'ConfirmDeleteValue';
            setVisibility(UI.chbSel2, false);
            if (!_utils.isLibraryTrack(params.firstTrack))
                setVisibility(UI.chbSel0, false);
            if (_utils.isRemoteTrack(params.firstTrack))
                setVisibility(UI.chbSel1, false);
            else if (params.shift)
                selIdx = 1;
            break;
        case 'folder':
            UI.lbl_sel0.innerText = _('Delete Library content from the database only');
            UI.lbl_sel1.innerText = _('Delete Library content from the database and drive');
            UI.lbl_sel2.innerText = _('Delete all content from the database and drive');
            UI.chbSel0.controlClass.retValues = ['library'];
            UI.chbSel1.controlClass.retValues = ['library', 'computer'];
            UI.chbSel2.controlClass.retValues = ['library', 'computer', 'folder'];
            confirmName = 'ConfirmDeleteFolderValue';
            if (params.firstTrack) {
                if (!_utils.isLibraryTrack(params.firstTrack)) {
                    setVisibility(UI.chbSel0, false);
                    setVisibility(UI.chbSel1, false);
                }
                if (_utils.isRemoteTrack(params.firstTrack))
                    setVisibility(UI.chbSel1, false);
            }
            if (params.shift)
                selIdx = 2;
            break;
        case 'playlist':
            showAskNext = !params.shift;
            doAskNextName = 'ConfirmDeletePlaylist';
            confirmName = 'ConfirmDeletePlaylistValue';

            if (params.device) {
                // per suggestions in #15029 / ~53040
                UI.lbl_sel0.innerText = _('Remove from the Playlist only');
                UI.chbSel0.controlClass.retValues = ['playlist'];

                UI.lbl_sel1.innerText = _('Remove from the Playlist and');
                setVisibility(UI.chbSel2, false);
                setVisibility(UI.chbSel3, true);
                setVisibility(UI.chbSel4, true);
                setVisibility(UI.chbSel5, true);

                bindDisabled2Checkbox(UI.chbSel3, UI.chbSel1);
                bindDisabled2Checkbox(UI.chbSel4, UI.chbSel1);
                bindDisabled2Checkbox(UI.chbSel5, UI.chbSel1);

                UI.lbl_sel3.innerText = _('Delete local copy and update the database');
                UI.lbl_sel4.innerText = _('Delete remote copy and update the database');
                UI.lbl_sel5.innerText = _('Delete all copies and remove from the database');
                UI.chbSel3.controlClass.retValues = ['playlist', 'device_local'];
                UI.chbSel4.controlClass.retValues = ['playlist', 'device_remote'];
                UI.chbSel5.controlClass.retValues = ['playlist', 'device_remote_local'];
                if (params.hasRemoteTracksOnly) {
                    UI.chbSel4.controlClass.checked = true;
                    setVisibility(UI.chbSel3, false);
                    setVisibility(UI.chbSel5, false);
                } else
                    UI.chbSel5.controlClass.checked = true;
            } else {
                UI.lbl_sel0.innerText = _('Remove from the Playlist only');
                UI.lbl_sel1.innerText = _('Delete from the Playlist and database only');
                UI.lbl_sel2.innerText = _('Delete from the Playlist, database and drive');
                UI.chbSel0.controlClass.retValues = ['playlist'];
                UI.chbSel1.controlClass.retValues = ['playlist', 'library'];
                UI.chbSel2.controlClass.retValues = ['playlist', 'library', 'computer'];
                if (!_utils.isLibraryTrack(params.firstTrack))
                    setVisibility(UI.chbSel1, false);
                if (_utils.isRemoteTrack(params.firstTrack)) {
                    setVisibility(UI.chbSel2, false);
                    if (params.shift)
                        selIdx = 1;
                } else if (params.shift)
                    selIdx = 2;
            }
            break;
        case 'nowplaying':
            showAskNext = !params.shift;
            doAskNextName = 'ConfirmDeletePlaying';
            confirmName = 'ConfirmDeletePlayingValue';

            if (params.device) {
                // per suggestions in #15029 / ~53040
                UI.lbl_sel0.innerText = _('Remove from \'Playing\' list only');
                UI.chbSel0.controlClass.retValues = ['nowplaying'];

                UI.lbl_sel1.innerText = _('Remove from \'Playing\' list and');
                setVisibility(UI.chbSel2, false);
                setVisibility(UI.chbSel3, true);
                setVisibility(UI.chbSel4, true);
                setVisibility(UI.chbSel5, true);

                bindDisabled2Checkbox(UI.chbSel3, UI.chbSel1);
                bindDisabled2Checkbox(UI.chbSel4, UI.chbSel1);
                bindDisabled2Checkbox(UI.chbSel5, UI.chbSel1);

                UI.lbl_sel3.innerText = _('Delete local copy and update the database');
                UI.lbl_sel4.innerText = _('Delete remote copy and update the database');
                UI.lbl_sel5.innerText = _('Delete all copies and remove from the database');
                UI.chbSel3.controlClass.retValues = ['nowplaying', 'device_local'];
                UI.chbSel4.controlClass.retValues = ['nowplaying', 'device_remote'];
                UI.chbSel5.controlClass.retValues = ['nowplaying', 'device_remote_local'];

                if (params.hasRemoteTracksOnly) {
                    UI.chbSel4.controlClass.checked = true;
                    setVisibility(UI.chbSel3, false);
                    setVisibility(UI.chbSel5, false);
                } else
                    UI.chbSel5.controlClass.checked = true;
            } else {
                UI.lbl_sel0.innerText = _('Remove from \'Playing\' list only');
                UI.lbl_sel1.innerText = _('Delete from \'Playing\' list and the database only');
                UI.lbl_sel2.innerText = _('Delete from \'Playing\' list, the database and drive');
                UI.chbSel0.controlClass.retValues = ['nowplaying'];
                UI.chbSel1.controlClass.retValues = ['nowplaying', 'library'];
                UI.chbSel2.controlClass.retValues = ['nowplaying', 'library', 'computer'];
                if (!_utils.isLibraryTrack(params.firstTrack))
                    setVisibility(UI.chbSel1, false);
                if (_utils.isRemoteTrack(params.firstTrack)) {
                    setVisibility(UI.chbSel2, false);
                    if (params.shift)
                        selIdx = 1;
                } else if (params.shift)
                    selIdx = 2;
            }
            break;
        case 'computer':
            setVisibility(UI.selectionDiv, false);
            UI.chbSel0.controlClass.retValues = ['computer'];
            break;
        case 'device':
            if (!params.hasRemoteTracksOnly) { // per #15029
                setVisibility(UI.chbSel21, true);
                UI.lbl_sel0.innerText = _('Delete local copy and update the database');
                UI.lbl_sel1.innerText = _('Delete remote copy and update the database');
                UI.lbl_sel2.innerText = _('Delete all copies and remove from the database');
                UI.lbl_sel21.innerText = _('Delete from the database only');
                UI.chbSel0.controlClass.retValues = ['device_local'];
                UI.chbSel1.controlClass.retValues = ['device_remote'];
                UI.chbSel2.controlClass.retValues = ['device_remote_local'];
                UI.chbSel21.controlClass.retValues = ['library'];
                selIdx = 2;
            } else {
                q = sprintf(_("Are you sure you want to remove %d files from the ''%s'' ?"), params.fileCount, params.device.name);
                setVisibility(UI.selectionDiv, false);
                UI.chbSel0.controlClass.retValues = ['device_remote'];
            }
            break;
    };


    if (params.checkboxes) {
        // custom checkbox definitions:
        setVisibility(UI.chbSel0, false);
        setVisibility(UI.chbSel1, false);
        setVisibility(UI.chbSel2, false);
        if (params.checkboxes[1]) {
            setVisibility(UI.chbSel0, true);
            UI.lbl_sel0.innerText = params.checkboxes[1].text;
            UI.chbSel0.controlClass.retValues = params.checkboxes[1].retvals;
        }
        if (params.checkboxes[2]) {
            setVisibility(UI.chbSel1, true);
            UI.lbl_sel1.innerText = params.checkboxes[2].text;
            UI.chbSel1.controlClass.retValues = params.checkboxes[2].retvals;
        }
        if (params.checkboxes[3]) {
            setVisibility(UI.chbSel2, true);
            UI.lbl_sel2.innerText = params.checkboxes[3].text;
            UI.chbSel2.controlClass.retValues = params.checkboxes[3].retvals;
        }
    }


    if (!params.shift && confirmName && ((sett[confirmName] == 0) || (sett[confirmName] == 1) || (sett[confirmName] == 2))) {
        if (isVisible(UI['chbSel' + selIdx]))
            selIdx = sett[confirmName];
    };
    UI['chbSel' + selIdx].controlClass.checked = true;
    if (showAskNext) {
        UI.lbl_ask.innerText = _('In the future, do not ask me');
    } else {
        setVisibility(UI.askDiv, false);
    };
    UI.lblQuestion.innerText = q;
    let getValueNum = function () {
        if (UI.chbSel1.controlClass.checked)
            return 1;
        else if (UI.chbSel2.controlClass.checked)
            return 2;
        else
            return 0;
    };
    UI['chbSel' + selIdx].controlClass.focus();

    this.getResultValue = function () {

        let _getForIdx = (i) => {
            if (UI['chbSel' + i].controlClass.checked && !UI['chbSel' + i].controlClass.disabled && UI['chbSel' + i].controlClass.retValues)
                return UI['chbSel' + i].controlClass.retValues;
        }

        for (let i = 0; i <= 5; i++) {
            let res = _getForIdx(i);
            if (res)
                return res;
        }
        let res = _getForIdx(21);
        if (res)
           return res;
    };

    window.localListen(UI.btnNo, 'click', function () {
        modalResult = 0;
    });
    window.localListen(UI.btnYes, 'click', function () {
        if (!params.shift) {
            sett[confirmName] = getValueNum();
            if (showAskNext && sett[doAskNextName])
                sett[doAskNextName] = !UI.chbAsk.controlClass.checked;
            window.settings.set(_sett, 'Confirmations');
        };
        modalResult = 1;
    });
    showModal();
};

window.windowCleanup = function () {
    UI = null;
}