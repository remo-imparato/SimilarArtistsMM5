/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

requirejs("controls/gridview");
requirejs("controls/columntracklist");

let tracks = null;

function init(params) {

    title = _('Remove unavailable files');
    window.noAutoSize = true; // disable auto sizing mechanism, we have fixed size

    tracks = params.tracks;
    tracks.setAllChecked(true); // #16789

    let tracksList = qid('lvTracksList');
    initDefaultColumns(tracksList.controlClass);
    if (tracksList && tracksList.controlClass) {
        tracksList.controlClass.data = tracks;
        tracksList.controlClass.dataSource = tracksList.controlClass.data;
    }

    window.localListen(qid('btnLocate'), 'click', function () {
        modalResult = 2;
    });
    window.localListen(qid('btnRemove'), 'click', function () {

        let trackids = '';
        let delTrack;
        tracks.locked(function () {
            for (let a = 0; a < tracks.count; a++) {
                let item = tracks.getValue(a);
                if (tracks.isChecked(a)) { // track is checked
                    if (trackids == '') {
                        trackids = item.id;
                        delTrack = item;
                    } else {
                        trackids = trackids + ',' + item.id;
                    }
                }
            }
        });

        if (trackids != '') {
            window.localPromise(app.db.executeQueryAsync('DELETE FROM Songs WHERE Songs.ID IN (' + trackids + ')')).then(function (done) {
                outData = 'remove';
                delTrack.notifyDeleted();
                closeWindow();
            });
        } else {
            outData = 'remove';
            closeWindow();
        }
    });

    function addResultLine(par, txt) {
        let lbl = document.createElement('label');
        lbl.innerText = txt;
        par.appendChild(lbl);
    };

    let captions = qid('CaptionContainer');

    addResultLine(captions, sprintf(_('The following %d file(s) could not be found in their expected locations.'), tracks.count));
    addResultLine(captions, _('Do you want to remove them from the Library?'));
}

function getCheckedTracks() {
    return tracks.getCheckedList();
}

function initDefaultColumns(LV) {

    LV.showHeader = true;

    LV.defaultColumns.length = 0;
    LV.defaultColumns.push({
        visible: true,
        title: '',
        order: 1,
        headerRenderer: ColumnTrackList.prototype.headerRenderers.renderCheck,
        setupCell: ColumnTrackList.prototype.cellSetups.setupCheckbox,
        bindData: ColumnTrackList.prototype.defaultBinds.bindCheckboxCell
    });
    LV.defaultColumns.push({
        visible: true,
        title: _('Title'),
        width: 180,
        order: 2,
        bindData: function (div, item) {
            div.innerText = item.title;
        }
    });
    LV.defaultColumns.push({
        visible: true,
        title: _('Artist'),
        width: 150,
        order: 3,
        bindData: function (div, item) {
            div.innerText = item.artist;
        }
    });
    LV.defaultColumns.push({
        visible: true,
        title: _('Path'),
        width: 480,
        order: 4,
        bindData: function (div, item) {
            div.innerText = item.path;
        }
    });
    LV.setColumns(LV.defaultColumns);
}

window.windowCleanup = function () {
    tracks = null;
}