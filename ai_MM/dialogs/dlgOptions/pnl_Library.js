/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

let scanAudioExts = undefined;
let scanVideoExts = undefined;
let scanPlaylistExts = undefined;

optionPanels.pnl_Library.load = function (sett) {
    qid('chbInferAudioProps').controlClass.checked = sett.Options.UseFileToGuessMetadata;
    bindDisabled2Checkbox(qid('lineInferAudioFrom'), qid('chbInferAudioProps'));
    bindDisabled2Checkbox(qid('lineInferAudioType'), qid('chbInferAudioProps'));
    if (sett.Options.UsePathToGuessMetadata)
        qid('cbInferAudioPropsFrom').controlClass.focusedIndex = 1;
    else
        qid('cbInferAudioPropsFrom').controlClass.focusedIndex = 0;
    if (sett.Options.PreferTagsForMetadata)
        qid('cbInferAudioPropsType').controlClass.focusedIndex = 0;
    else
        qid('cbInferAudioPropsType').controlClass.focusedIndex = 1;
    if (sett.Options.UseTrackNumbersFromPlaylists) {
        if (sett.Options.TrackNumbersFromPlaylists)
            qid('cbInferAudioPlaylistMetadata').controlClass.focusedIndex = 1;
        else
            qid('cbInferAudioPlaylistMetadata').controlClass.focusedIndex = 0;
    } else
        qid('cbInferAudioPlaylistMetadata').controlClass.focusedIndex = 2;


    setVisibility(qid('chbInferVideoProps'), false);
    setVisibility(qid('tblVideoProps'), false);

    qid('chbInferVideoProps').controlClass.checked = sett.Options.UseFileToGuessMetadataVideo;
    bindDisabled2Checkbox(qid('lineInferVideoFrom'), qid('chbInferVideoProps'));
    bindDisabled2Checkbox(qid('lineInferVideoType'), qid('chbInferVideoProps'));

    if (sett.Options.UseNFOToGuessMetadataVideo) {
        if (sett.Options.UsePathToGuessMetadataVideo)
            qid('cbInferVideoPropsFrom').controlClass.focusedIndex = 3;
        else
            qid('cbInferVideoPropsFrom').controlClass.focusedIndex = 0;
    } else {
        if (sett.Options.UsePathToGuessMetadataVideo)
            qid('cbInferVideoPropsFrom').controlClass.focusedIndex = 2;
        else
            qid('cbInferVideoPropsFrom').controlClass.focusedIndex = 1;
    }
    if (sett.Options.PreferTagsForMetadataVideo)
        qid('cbInferVideoPropsType').controlClass.focusedIndex = 0;
    else
        qid('cbInferVideoPropsType').controlClass.focusedIndex = 1;
    if (sett.Options.UseTrackNumbersFromPlaylistsVideo) {
        if (sett.Options.TrackNumbersFromPlaylistsVideo)
            qid('cbInferVideoPlaylistMetadata').controlClass.focusedIndex = 1;
        else
            qid('cbInferVideoPlaylistMetadata').controlClass.focusedIndex = 0;
    } else
        qid('cbInferVideoPlaylistMetadata').controlClass.focusedIndex = 2;


    qid('chbScanForArtwork').controlClass.checked = sett.Options.ScanCoversFiles;
    qid('chbAnalyzeDuplicates').controlClass.checked = sett.Options.UseMD5Signature;
    qid('chbIgnoreShorterKB').controlClass.checked = sett.Options.doIgnoreShorterKB;
    qid('edtIgnoreShorterKB').controlClass.value = sett.Options.IgnoreShorterKB;
    qid('chbIgnoreShorterSec').controlClass.checked = sett.Options.doIgnoreShorterSec;
    qid('edtIgnoreShorterSec').controlClass.value = sett.Options.IgnoreShorterSec;
    qid('chbUpdateFromTagsOnReScan').controlClass.checked = sett.Options.RescanDBInfo;
    qid('chbUpdateFromTagsOnReScanOnlyNew').controlClass.checked = sett.Options.RescanModifFilesOnly;
    bindDisabled2Checkbox(qid('chbUpdateFromTagsOnReScanOnlyNew'), qid('chbUpdateFromTagsOnReScan'));
    qid('chbRemoveUnusedAttrib').controlClass.checked = sett.AutoScan.autoRemoveAttributes;
    qid('chbRemoveDeadlinks').controlClass.checked = sett.AutoScan.autoRemoveDeadLinks;
    qid('chbGenerateThumbnails').controlClass.checked = sett.Options.AutoGenThumbs;
    qid('chbShowScanResults').controlClass.checked = sett.Confirmations.ConfirmScanResults;

    bindDisabled2Checkbox(qid('edtIgnoreShorterKB'), qid('chbIgnoreShorterKB'));
    bindDisabled2Checkbox(qid('lblIgnoreShorterKB'), qid('chbIgnoreShorterKB'));

    bindDisabled2Checkbox(qid('edtIgnoreShorterSec'), qid('chbIgnoreShorterSec'));
    bindDisabled2Checkbox(qid('lblIgnoreShorterSec'), qid('chbIgnoreShorterSec'));

    let edtAudioFormats = qid('edtAudioFormats');
    let btnSetAudioFormats = qid('btnSetAudioFormats');

    let edtVideoFormats = qid('edtVideoFormats');
    let btnSetVideoFormats = qid('btnSetVideoFormats');

    let edtPlaylistFormats = qid('edtPlaylistFormats');
    let btnSetPlaylistFormats = qid('btnSetPlaylistFormats');

    let scanExts = app.filesystem.getScanExtensions();

    let getExts = function (formats) {
        let list = newStringList();
        scanExts.locked(function () {
            for (let i = 0; i < scanExts.count; i++) {
                let value = scanExts.getValue(i);
                if (formats.indexOf(value) >= 0) {
                    list.add(value);
                }
            }
        });
        return list;
    };

    scanAudioExts = getExts(app.filesystem.getAudioFileTypes(false));
    scanVideoExts = getExts(app.filesystem.getVideoFileTypes(false));
    scanPlaylistExts = getExts(app.filesystem.getPlaylistFileTypes(false));

    edtAudioFormats.value = scanAudioExts.commaText;
    edtVideoFormats.value = scanVideoExts.commaText;
    edtPlaylistFormats.value = scanPlaylistExts.commaText;

    let setFormats = function (ds, usedExts, callback) {
        let dlg = uitools.openDialog('dlgFileTypes', {
            modal: true,
            usedExts: usedExts,
            dataSource: ds
        });
        dlg.whenClosed = function () {
            if (dlg.modalResult == 1) {
                callback(dlg.getValue('getExts')());
            }
        };
        app.listen(dlg, 'closed', dlg.whenClosed);
    };

    localListen(btnSetAudioFormats, 'click', function () {
        setFormats(app.filesystem.getAudioFileTypes(false), scanAudioExts, function (l) {
            scanAudioExts = l;
            edtAudioFormats.value = scanAudioExts.commaText;
        });
    });
    addEnterAsClick(window, btnSetAudioFormats);

    localListen(btnSetVideoFormats, 'click', function () {
        setFormats(app.filesystem.getVideoFileTypes(false), scanVideoExts, function (l) {
            scanVideoExts = l;
            edtVideoFormats.value = scanVideoExts.commaText;
        });
    });
    addEnterAsClick(window, btnSetVideoFormats);

    localListen(btnSetPlaylistFormats, 'click', function () {
        setFormats(app.filesystem.getPlaylistFileTypes(false), scanPlaylistExts, function (l) {
            scanPlaylistExts = l;
            edtPlaylistFormats.value = scanPlaylistExts.commaText;
        });
    });
    addEnterAsClick(window, btnSetPlaylistFormats);

    localListen(qid('btnAddRescan'), 'click', function () {
        uitools.openDialog('dlgScanTracks', {
            modal: true,
            showScanButton: false,
            showOptionsButton: false,
        });
    });
    addEnterAsClick(window, qid('btnAddRescan'));
}

optionPanels.pnl_Library.save = function (sett) {
    sett.Options.UseFileToGuessMetadata = qid('chbInferAudioProps').controlClass.checked;
    if (qid('cbInferAudioPropsFrom').controlClass.focusedIndex == 1)
        sett.Options.UsePathToGuessMetadata = true;
    else
        sett.Options.UsePathToGuessMetadata = false;
    if (qid('cbInferAudioPropsType').controlClass.focusedIndex == 0)
        sett.Options.PreferTagsForMetadata = true;
    else
        sett.Options.PreferTagsForMetadata = false;
    let ind = qid('cbInferAudioPlaylistMetadata').controlClass.focusedIndex;
    sett.Options.UseTrackNumbersFromPlaylists = (ind in [0, 1]);
    sett.Options.TrackNumbersFromPlaylists = (ind == 1);

    // video props
    sett.Options.UseFileToGuessMetadataVideo = qid('chbInferVideoProps').controlClass.checked;
    ind = qid('cbInferVideoPropsFrom').controlClass.focusedIndex;
    if (ind === 0 || ind === 3) {
        sett.Options.UseNFOToGuessMetadataVideo = true;
        sett.Options.UsePathToGuessMetadataVideo = ind === 3;
    } else {
        sett.Options.UseNFOToGuessMetadataVideo = false;
        sett.Options.UsePathToGuessMetadataVideo = ind === 2;
    }
    if (qid('cbInferVideoPropsType').controlClass.focusedIndex == 0)
        sett.Options.PreferTagsForMetadataVideo = true;
    else
        sett.Options.PreferTagsForMetadataVideo = false;
    ind = qid('cbInferVideoPlaylistMetadata').controlClass.focusedIndex;
    sett.Options.UseTrackNumbersFromPlaylistsVideo = (ind in [0, 1]);
    sett.Options.TrackNumbersFromPlaylistsVideo = (ind == 1);

    sett.Options.ScanCoversFiles = qid('chbScanForArtwork').controlClass.checked;
    sett.Options.UseMD5Signature = qid('chbAnalyzeDuplicates').controlClass.checked;
    sett.Options.doIgnoreShorterKB = qid('chbIgnoreShorterKB').controlClass.checked;
    sett.Options.IgnoreShorterKB = qid('edtIgnoreShorterKB').controlClass.value;
    sett.Options.doIgnoreShorterSec = qid('chbIgnoreShorterSec').controlClass.checked;
    sett.Options.IgnoreShorterSec = qid('edtIgnoreShorterSec').controlClass.value;
    sett.Options.RescanDBInfo = qid('chbUpdateFromTagsOnReScan').controlClass.checked;
    sett.Options.RescanModifFilesOnly = qid('chbUpdateFromTagsOnReScanOnlyNew').controlClass.checked;
    sett.AutoScan.autoRemoveAttributes = qid('chbRemoveUnusedAttrib').controlClass.checked;
    sett.AutoScan.autoRemoveDeadLinks = qid('chbRemoveDeadlinks').controlClass.checked;
    sett.Options.AutoGenThumbs = qid('chbGenerateThumbnails').controlClass.checked;
    sett.Confirmations.ConfirmScanResults = qid('chbShowScanResults').controlClass.checked;

    let scanExts = newStringList();
    scanExts.addList(scanAudioExts);
    scanExts.addList(scanVideoExts);
    scanExts.addList(scanPlaylistExts);

    app.filesystem.setScanExtensions(scanExts);

    scanExts.delimiter = ';';
    sett.Options.ScanExts = scanExts.text;
}
