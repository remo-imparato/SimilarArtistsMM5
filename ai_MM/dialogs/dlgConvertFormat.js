/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

//requirejs('controls/maskedit');
//requirejs('controls/columntracklist');
//requirejs('utils');

let cancellationToken = null;
let lastAsyncMethod = null;
let tracks = null;
let newNamesAll = newStringList();
let state = {
    replaceOriginals: false,
    lastAudioFormatIdx: 0,
    lastVideoFormatIdx: 0
};
let isCDRip = false;
let isSendTo = false;
let FormatSettings = null;
let FirstTrackPath = '';
let windowHandled = false;
let missingCodec = false;
let isVideo = false;

function init(params) {

    assert(params.tracks, 'dlgConvertFormat - tracks must not be empty!');

    let wnd = this;
    wnd.title = _('Convert Files');
    wnd.resizeable = true;

    tracks = params.tracks;
    let destinationPath = params.destinationPath;

    let tracksList = qid('lvTracksList');
    initDefaultColumns(tracksList.controlClass);
    tracksList.controlClass.disableColumnsEdit();    
    tracksList.controlClass.highlightPlayingTrack = false;

    if ((params.mode) && (params.mode == 'rip'))
        isCDRip = true;

    if (isCDRip) {
        state = app.getValue('dlgConvertFilesRip', state);
        if (!state.isRip) // to make the settings split correctly in course of #17542
            state = app.getValue('dlgConvertFiles', state);
    } else {
        state = app.getValue('dlgConvertFiles', state);
    }

    if (isCDRip) {
        document.body.setAttribute('data-help', 'Ripping Tracks from CDs');
        setVisibility(qid('rbCopy'), false);
        setVisibility(qid('rbReplace'), false);
        setVisibility(qid('lblRip'), true);
        setVisibility(qid('chbAddToLib'), false);
        if (!app.utils.isRegistered())
            window.uitools.handleGoldCheckbox(qid('chbVerify'), _('CD Ripping is supported in the free version of MediaMonkey, however, verification via AccurateRip is only included with the Gold version. '));
    } else {
        document.body.setAttribute('data-help', 'Converting Formats');
        let rbCopy = qid('rbCopy');
        window.localListen(rbCopy, 'click', radioButtonClick);
        window.localListen(qid('rbReplace'), 'click', radioButtonClick);
        rbCopy.controlClass.checked = (!state.replaceOriginals);
        qid('rbReplace').controlClass.checked = state.replaceOriginals;
        setVisibility(qid('lblRip'), false);
        qid('lineMaskConfig').classList.add('left-indent');
        setVisibility(qid('chbEject'), false);
        setVisibility(qid('chbVerify'), false);
        setVisibility(qid('chbOnTheFly'), false);
        setVisibility(qid('groupRipType'), false);
    }

    let cbMasks = qid('cbMasks');
    let maskList = null;
    if (isCDRip)
        maskList = app.settings.getMaskList('RipMasks');
    else if (destinationPath) { // it is 'Send to' action
        isSendTo = true;
        maskList = app.settings.getMaskList('SendToMasks');
        maskList.modifyAsync(function () {
            if (maskList.count > 0) {
                let m = destinationPath + getJustFilename(maskList.getValue(0));
                if (m !== maskList.getValue(0))
                    maskList.insert(0, m); // #18349
            }
            cbMasks.controlClass.value = maskList.getFirst(); // have to set it again, changes made asynchronously
        });
    } else {
        maskList = app.settings.getMaskList('EncodeMasks');
    }

    cbMasks.controlClass.masks = maskList;
    cbMasks.controlClass.value = maskList.getFirst();

    window.localPromise(tracks.whenLoaded()).then(function () {

        if (!isCDRip) // #21068
            tracks = tracks.getCopy(); // #21011
        tracksList.controlClass.dataSource = tracks;
        
        tracks.locked(() => {
            cbMasks.controlClass.sampleTrack = tracks.getValue(0).getTemporaryCopy();
        });

        let OKClick = function () {
            let btn = qid('btnOK');
            if (!btn.controlClass.disabled) {
                btnOkPressed();
            }
        };

        window.localListen(cbMasks, 'change', refreshTracksView, false);
        window.localListen(tracksList, 'checkedchanged', refreshDuplicates, false);
        window.localListen(qid('btnOK'), 'click', OKClick);
        window.localListen(qid('btnSettings'), 'click', settingsButtonClick);

        let cbFormat = qid('cbFormat');
        if (tracks.count > 0) {
            tracks.locked(function () {
                let FirstTrck = tracks.getValue(0);
                isVideo = FirstTrck.isVideo;
                FirstTrackPath = FirstTrck.path;
            });
            fastForEach(tracks, (track, idx) => {
                track.temporaryOrder = idx; // for the <Auto number> mask
            });
        }
        if (isCDRip)
            FormatSettings = app.fileFormats.getConvertSettings('Rip', isVideo);
        else
            FormatSettings = app.fileFormats.getConvertSettings('Default', isVideo);
        assert(FormatSettings, 'FormatSettings is null!');
        cbFormat.controlClass.dataSource = FormatSettings.getFormatsList();
        window.localListen(cbFormat, 'change', formatChanged, false);
        window.localPromise(cbFormat.controlClass.dataSource.whenLoaded()).then(function () {
            if (window._cleanUpCalled)
                return;
            let lastFormatIdx = isVideo ? (state.lastVideoFormatIdx || 0) : (state.lastAudioFormatIdx || 0);
            if (lastFormatIdx < 0)
                lastFormatIdx = 0;
            if (cbFormat.controlClass.dataSource && (lastFormatIdx < cbFormat.controlClass.dataSource.count))
                cbFormat.controlClass.focusedIndex = lastFormatIdx;
        });
        qid('chbAddToLib').controlClass.checked = FormatSettings.addTracksToLib;
        qid('chbLevelTracks').controlClass.checked = FormatSettings.levelTracks;

        if (isCDRip) {
            let RipSett = JSON.parse(app.settings.utils.getRipSettings(FirstTrackPath));
            qid('edtRipType').controlClass.focusedIndex = RipSett.Drive.ReadType;
            qid('chbEject').controlClass.checked = RipSett.General.EjectCD;
            qid('chbVerify').controlClass.checked = RipSett.General.VerifyRippedTracks;
            qid('chbOnTheFly').controlClass.checked = RipSett.Drive.ConvertOnFly;
        }

        tracks.modifyAsync(function () {
            tracks.beginUpdate();

            // at first, filter duplicates (#18758)
            let hasher = {};
            for (let i = 0; i < tracks.count; i++) {
                let track = tracks.getValue(i);
                let key = tracks.id + '|' + track.path;
                if (hasher[key]) {
                    tracks.setChecked(i, false); // duplicate, ucheck it
                } else {
                    hasher[key] = true;
                    tracks.setChecked(i, true); // by default, all tracks are checked
                }
            }

            let anySelected = false;
            for (let i = 0; i < tracks.count; i++) {
                if (tracks.isSelected(i))
                    anySelected = true;
            }
            for (let i = 0; i < tracks.count; i++) {
                if (isCDRip && anySelected)
                    tracks.setChecked(i, tracks.isSelected(i)); // #15782 / #16581
            }
            tracks.endUpdate();
        }).then(function () {

            updateNewPaths();
            formatChanged();
            radioButtonClick();

            if (tracksList && tracksList.controlClass) {
                tracksList.controlClass.updateTopCheckbox();
                            
                if (state.columns && state.columns.length > 1)
                    tracksList.controlClass.restoreColumns(state.columns, true);
            }
            window.dialogInitialized = true;
        });

        let chbCutPaths = qid('chbCutPaths');
        let sett = window.settings.get();
        chbCutPaths.controlClass.checked = sett['Auto-organize'].TrimLongPaths;
        window.localListen(chbCutPaths, 'click', updateNewPaths, false);
    });
}

window.btnOkPressed = function() {
    if (cancellationToken) {
        requestTimeout(function () {
            btnOkPressed();
        }, 10);
        return;
    }

    if (!qid('btnOK').controlClass.disabled) {

        let cbFormat = qid('cbFormat');
        window.localPromise(app.utils.checkFormatAvailability(cbFormat.controlClass.dataSource.focusedItem)).then(function (res) {

            if (cancellationToken) {
                // new calc started once checkFormatAvailability was performed
                requestTimeout(function () {
                    btnOkPressed();
                }, 10);
                return;
            }

            if (res && !windowHandled) {
                windowHandled = true;
                let outputFNames = newStringList();
                let sl = app.utils.createTracklist();
                tracks.locked(function () {
                    newNamesAll.locked(function () {
                        let track = undefined;
                        for (let i = 0; i < tracks.count; i++) {
                            if (tracks.isChecked(i)) {
                                track = tracks.getFastObject(i, track);
                                let newPath = newNamesAll.getValue(i);
                                sl.add(track);
                                outputFNames.add(newPath);
                            }
                        }
                    });
                });
                FormatSettings.addTracksToLib = qid('chbAddToLib').controlClass.checked;
                FormatSettings.levelTracks = qid('chbLevelTracks').controlClass.checked;
                FormatSettings.deleteAfterConvert = !isCDRip && qid('rbReplace').controlClass.checked;
                if (isCDRip) {
                    let RipSett = JSON.parse(app.settings.utils.getRipSettings(FirstTrackPath));
                    RipSett.Drive.ReadType = qid('edtRipType').controlClass.focusedIndex;
                    RipSett.General.EjectCD = qid('chbEject').controlClass.checked;
                    RipSett.General.VerifyRippedTracks = qid('chbVerify').controlClass.checked;
                    RipSett.Drive.ConvertOnFly = qid('chbOnTheFly').controlClass.checked;
                    app.settings.utils.setRipSettings(FirstTrackPath, JSON.stringify(RipSett));

                    app.settings.addMask2History(qid('cbMasks').controlClass.value, 'RipMasks');
                    app.fileFormats.convertFiles(sl, outputFNames, FormatSettings, 'rip');
                } else {
                    if (isSendTo)
                        app.settings.addMask2History(qid('cbMasks').controlClass.value, 'SendToMasks');
                    else
                        app.settings.addMask2History(qid('cbMasks').controlClass.value, 'EncodeMasks');
                    app.fileFormats.convertFiles(sl, outputFNames, FormatSettings, 'convert');
                }
                if (isVideo)
                    state.lastVideoFormatIdx = cbFormat.controlClass.focusedIndex;
                else
                    state.lastAudioFormatIdx = cbFormat.controlClass.focusedIndex;

                let tracksList = qid('lvTracksList');
                state.columns = tracksList.controlClass.storeColumns();

                if (isCDRip) {
                    state.isRip = true;
                    app.setValue('dlgConvertFilesRip', state);
                } else
                    app.setValue('dlgConvertFiles', state);

                let sett = window.settings.get();
                sett['Auto-organize'].TrimLongPaths = qid('chbCutPaths').controlClass.checked;
                window.settings.set(sett);

                closeWindow();
            } else {
                windowHandled = false;
            }
        });
    }
}

function radioButtonClick() {
    if (!isCDRip && FormatSettings) {
        state.replaceOriginals = !qid('rbCopy').controlClass.checked;
        qid('lineMaskConfig').controlClass.disabled = state.replaceOriginals;
        setVisibility(qid('chbAddToLib'), !state.replaceOriginals);
        refreshTracksView();
    }
}

function refreshDuplicates() {
    app.utils.fixFilenames(newNamesAll, tracks /* evaluate check states from tracks*/ , qid('chbCutPaths').controlClass.checked);
    qid('lvTracksList').controlClass.rebind(); // to update the fixed filenames
    qid('btnOK').controlClass.disabled = false;
};

function refreshTracksView() {    
    updateNewPaths();
    qid('lvTracksList').controlClass.invalidateAll();
};

function formatChanged() {
    let cbFormat = qid('cbFormat');
    let btnSettings = qid('btnSettings');
    let ds = qid('cbFormat').controlClass.dataSource;
    missingCodec = false;
    let selFmt = ds.focusedItem;
    if (selFmt) {
        if (selFmt.objectType === 'formatToDownladSettings') {
            qid('lblFormatInfo').innerText = '';
            missingCodec = true;
        } else {
            FormatSettings.setActiveFormat(selFmt);
            qid('lblFormatInfo').innerText = selFmt.getInfo();
        }
    }
    if (btnSettings.controlClass)
        btnSettings.controlClass.disabled = missingCodec;
    else
        btnSettings.disabled = missingCodec;
    refreshTracksView();
}

function settingsButtonClick() {
    let prom = FormatSettings.ActiveFormatSetting().showSettingsDialogAsync();
    if (prom) {
        window.localPromise(prom).then(function () {
            qid('lblFormatInfo').innerText = FormatSettings.ActiveFormatSetting().getInfo();
        });
    }
}

function updateNewPaths() {
    // process all tracks to get new paths. We need to process all because of duplicity and length overflow.

    if (cancellationToken) {
        cancellationToken.cancel = true;
    }
    if (lastAsyncMethod) {
        cancelPromise(lastAsyncMethod);
        lastAsyncMethod = null;
    }

    cancellationToken = {
        cancel: false
    };
    let localCancel = cancellationToken;

    newNamesAll = newStringList();
    let ActiveSett = FormatSettings.ActiveFormatSetting();
    assert(ActiveSett, 'ActiveSett is null!');
    let FileExt = ActiveSett.getExtension();
    let cbMasks = qid('cbMasks');
    if (cbMasks.controlClass.sampleTrack && cbMasks.controlClass.sampleTrack.fileType.toLowerCase() != FileExt.toLowerCase()) {        
        cbMasks.controlClass.sampleTrack.path = removeFileExt( cbMasks.controlClass.sampleTrack.path) + '.' + FileExt.toLowerCase(); // #19612
    }

    let visMask = cbMasks.controlClass.value;
    let lvTracksList = qid('lvTracksList');
    let masks = app.masks;    
    let done = 0;
    let track;
    let lastRefresh = 0;
    qid('btnOK').controlClass.disabled = true;

    function perform() {
        if (window._cleanUpCalled)
            return;
        let fromVal = done;
        let toVal = Math.min(fromVal + 50, tracks.count);
        let tr = tracks.getRange(fromVal, toVal - 1);
        if (!state.replaceOriginals || isCDRip) {
            if (!app.utils.isAbsolutePath(visMask) && isCDRip)
                visMask = 'C:\\' + visMask;                
            lastAsyncMethod = masks.getMaskResultForListAsync(tr, visMask, true, false, true, FileExt);
        } else
            lastAsyncMethod = tr.getPaths();

        lastAsyncMethod.then(function (newNames) {
            return app.utils.modifyFilenamesExtAsync(newNames, FileExt);
        }).then(function (newNames) {
            lastAsyncMethod = null;

            if (window._cleanUpCalled || !newNames || !newNames.locked)
                return;
            tracks.locked(function () {
                newNames.locked(function () {
                    if (!localCancel.cancel) {
                        for (let i = fromVal; i < toVal; i++) {
                            track = tracks.getFastObject(i, track);
                            //let trackPath = track.path;
                            let newPath = newNames.getValue(i - fromVal);
                            newNamesAll.add(newPath);
                        }
                        done = toVal;
                        if (done < tracks.count)
                            requestIdleCallback(perform);
                        else {
                            refreshDuplicates();
                            cancellationToken = null;
                        }
                        if (performance.now() - lastRefresh > 250) {
                            lvTracksList.controlClass.rebind();
                            lastRefresh = performance.now();
                        }
                    }
                });
            });
        });
    }

    requestIdleCallback(perform);
}

function initDefaultColumns(LV) {

    LV.defaultColumns.length = 0;
    LV.defaultColumns.push({
        visible: true,
        title: '',
        columnType: 'checkbox',
        order: 1,
        isSortable: false,
        headerRenderer: ColumnTrackList.prototype.headerRenderers.renderCheck,
        setupCell: ColumnTrackList.prototype.cellSetups.setupCheckbox,
        bindData: ColumnTrackList.prototype.defaultBinds.bindCheckboxCell
    });
    LV.defaultColumns.push({
        visible: true,
        title: _('New Path'),
        columnType: 'newPath',
        width: 480,
        order: 2,
        getValue: function (item, raw, index) {
            let val = getValueAtIndex(newNamesAll, index);
            if (val)
                return val;
            else
                return '';
        },
        setValue: function (item, newValue, raw, index) {
            newNamesAll.modifyAsync(function () {
                if (!window._cleanUpCalled) {
                    newNamesAll.setValue(this.index, this.value);
                    refreshDuplicates();
                }
            }.bind({
                index: index,
                value: newValue
            }));
        },
        editor: editors.gridViewEditors.textEdit,
        bindData: function (div, item) {
            let index;
            index = div.offsetParent.itemIndex;
            if (index >= 0) {
                div.classList.remove('cellWarning');
                div.classList.remove('cellError');

                let oldPath = item.path;
                let newPath = oldPath;

                let itm = getValueAtIndex(newNamesAll, index);
                if (itm) {
                    newPath = itm;

                    if (oldPath != newPath)
                        div.classList.add('cellWarning');
                }

                div.innerText = newPath;
            }
        }
    });
    LV.defaultColumns.push({
        visible: true,
        title: _('Old Path'),
        columnType: 'oldPath',
        width: 480,
        order: 3,
        bindData: function (div, item) {
            div.innerText = item.path;
        }
    });
    LV.setColumns(LV.defaultColumns);
    LV.defaultColumns.forEach((col) => {
        LV.fieldDefs[col.columnType] = col;
    });
}

window.windowCleanup = function () {
    tracks = null;
    newNamesAll = null;
    FormatSettings = null;
    window.btnOkPressed = undefined;
}