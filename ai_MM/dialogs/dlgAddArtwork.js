/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

requirejs("controls/popupmenu");

const ImageLocations = [_('Save image to tag (if possible) otherwise save to file folder'),
                        _('Save image to file folder'),
                        _('Save image to tag (if possible) and to file folder')];

let UI = undefined;
let result = undefined;

function init(params) {
    window.resizeable = false;

    let track = params.track;
    let album = params.album;
    let tracks = params.tracks;
    let cover = params.cover;
    let showApply2Album = !!album || !!tracks || resolveToValue(params.showApply2Album, false);
    let showReplace = !!album || resolveToValue(params.showReplace, false);
    let doNotSave = resolveToValue(params.doNotSave, false);
    let firstTrack = params.firstTrack;
    let deletedArtworks = params.deletedArtworks;

    if (!cover)
        return;

    title = _('Add cover');

    UI = getAllUIElements();
    let bodyCtrl = UI.body.controlClass;
    let sett = window.settings.get('Options');

    setVisibility(UI.chbAlbum, showApply2Album);
    setVisibility(UI.chbReplace, showReplace);
    setVisibility(UI.artwork, false);
    setVisibility(UI.unknownAA, true);

    if (showApply2Album) {
        if (!album && track && (track.artist !== track.albumArtist))
            UI.chbAlbum.controlClass.checked = false;
        else
            UI.chbAlbum.controlClass.checked = !!album || sett.Options.ApplyCoversToAlbum;
        if (album)
            UI.chbAlbum.controlClass.disabled = true;
    }

    UI.cbImageType.controlClass.dataSource = app.utils.getCoverTypes();
    window.localPromise(UI.cbImageType.controlClass.dataSource.whenLoaded()).then(function () {
        UI.cbImageType.controlClass.value = cover.coverTypeDesc;
        UI.cbImageType.controlClass.focus();
    });

    let _this = this;

    /*    app.listen(UI.cbImageType, 'click', function (e) {
            div.parentListView.container.dispatchEvent(createNewEvent('change'));
            e.stopPropagation();
        });*/

    UI.boxDescription.value = cover.description;

    let stopPropFunc = function (e) {
        e.stopPropagation();
    };

    window.localPromise(cover.getSizeInfoAsync()).then(function (infoStr) {
        UI.sizeLbl.innerText = infoStr;
    })

    let cancelToken = cover.getThumbAsync(200, 200, function (path) {
        if (!window._cleanUpCalled && path && (path != '-') && UI.body.controlClass) {
            bodyCtrl.localListen(UI.artwork, 'load', function () {
                setVisibility(UI.artwork, true);
                setVisibility(UI.unknownAA, false);
            });
            UI.artwork.src = path;
        };
        cancelToken = undefined;
    });

    window.windowCleanup = function () {
        if (cancelToken !== undefined) {
            app.cancelLoaderToken(cancelToken);
            cancelToken = undefined;
        }
    };

    let list = newStringList();
    for (let i = 0; i < ImageLocations.length; i++)
        list.add(ImageLocations[i]);
    UI.cbImageLocation.controlClass.dataSource = list;
    let mw = app.dialogs.getMainWindow();
    let defVal = mw.getValue('settings').lastCoverStorageType;
    if (defVal === undefined)
        defVal = app.settings.utils.getCoverStorageType();
    UI.cbImageLocation.controlClass.focusedIndex = defVal;

    if (track) {
        let sd;
        if (firstTrack)
            sd = firstTrack; // group editing
        else
            sd = track;
        if (sd.cuePath != '')
            UI.cbImageLocation.controlClass.focusedIndex = 1; // save to file folder only (#21773 / 2)
        bodyCtrl.localPromise(sd.getArtworkFileNameAsync(deletedArtworks)).then(function (fname) {
            UI.edtImageFilename.controlClass.value = fname;
        });
    } else if (album) {
        bodyCtrl.localPromise(album.getArtworkFileNameAsync(deletedArtworks)).then(function (fname) {
            UI.edtImageFilename.controlClass.value = fname;
        });
    } else
        UI.edtImageFilename.controlClass.disabled = true;

    bodyCtrl.localListen(UI.btnCustomOptions, 'click', function () {
        uitools.openDialog('dlgOptions', {
            modal: true,
            defaultPanel: 'pnl_TagsAndPlaylists',
        });
    });

    bodyCtrl.localListen(UI.btnOK, 'click', function () {
        cover.description = UI.boxDescription.value;
        cover.coverTypeDesc = UI.cbImageType.controlClass.value;

        result = {
            imageLocation: UI.cbImageLocation.controlClass.focusedIndex,
            imageFilename: UI.edtImageFilename.controlClass.value,
            doNotSave: !!doNotSave,
            track: track,
            album: album,
            tracks: tracks
        };

        mw.getValue('_window').settings.lastCoverStorageType = result.imageLocation;

        if (showApply2Album) {
            result.applyCoversToAlbum = UI.chbAlbum.controlClass.checked;
        };
        if (showReplace) {
            result.replaceExisting = UI.chbReplace.controlClass.checked;
        };

        if (showApply2Album) {
            if (sett.Options.ApplyCoversToAlbum !== result.applyCoversToAlbum) {
                sett.Options.ApplyCoversToAlbum = result.applyCoversToAlbum;
                window.settings.set(sett, 'Options');
                app.flushState();
            };
        }
        modalResult = 1;
    });
}

function getResult() {
    return result;
};

window.windowCleanup = function () {
    UI = undefined;
    result = undefined;
}