/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

import '../commonControls';

class DiscListView extends ColumnTrackList {};
registerClass(DiscListView);

window.init = function(params) {
    let wnd = this;
    wnd.title = _('Lookup Audio CD metadata');
    wnd.resizeable = true;

    let lbl = qid('lblCaption');
    lbl.innerText = _('Choose an Album');

    let firstMedia = getValueAtIndex(wnd.cddata, 0);

    let lvDiscList = qid('lvDiscList');
    lvDiscList.controlClass.isSortable = false;
    lvDiscList.controlClass.autoSortString = '';
    lvDiscList.controlClass.presetColumns(['albumArtist', 'album', 'genre', 'date', 'comment', 'discNo']);
    lvDiscList.controlClass.disableColumnsEdit();
    lvDiscList.controlClass.disabledClearingSelection = true;
    lvDiscList.controlClass.dataSource = firstMedia.getResultsAsTracks();
    let restoreCalled = false;
    window.localListen(lvDiscList, 'focuschange', () => {
        let result = getValueAtIndex(firstMedia.results, lvDiscList.controlClass.focusedIndex);
        if (result)
            lvTracks.controlClass.dataSource = result.tracklist;
        else
            lvTracks.controlClass.dataSource = undefined;
        if (!restoreCalled) {
            uitools.browseAndRestoreUIState('dlgCDDBResult');
            lvDiscList.controlClass.rebind();
            restoreCalled = true;
        }
    });
    if (lvDiscList.controlClass.dataSource.count > 0)
        lvDiscList.controlClass.setFocusedAndSelectedIndex(0);

    let lvTracks = qid('lvTracks');
    lvTracks.controlClass.autoSortString = '';
    lvTracks.controlClass.presetColumns(['order', 'artist', 'title', 'genre', 'date', 'comment', 'discNo']);
    lvTracks.controlClass.disableColumnsEdit();

    window.localListen(qid('btnOK'), 'click', function () {
        firstMedia.useResultIndex = lvDiscList.controlClass.focusedIndex;
        let res = {
            btnID: 'btnOK'
        };
        uitools.browseAndStoreUIState('dlgCDDBResult');
        setResult(res);
        closeWindow();
    });

    let _cancelFunct = function () {
        let res = {
            btnID: 'btnCancel'
        };
        uitools.browseAndStoreUIState('dlgCDDBResult');
        setResult(res);
        closeWindow();
    };

    window.localListen(qid('btnCancel'), 'click', _cancelFunct);

    let list = app.filesystem.getInsertedMediaList();
    window.localListen(list, 'change', () => {
        // to self-close the dialog when CD is ejected (#15453)
        let cd_inserted = false;
        listForEach(list, function (drive) {
            if (drive.driveType == 'optical_drive')
                cd_inserted = true;
        });
        if (!cd_inserted)
            _cancelFunct();
    });

    showModal();
};
