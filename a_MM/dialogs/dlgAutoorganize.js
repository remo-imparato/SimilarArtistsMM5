/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

let newNamesAll = newStringList();
let tracksList;

let tracks = null;
let cancellationToken = null;
let lastAsyncMethod = null;
let UI = null;
let windowHandled = false;
let state = {
    mode: 'move'
}

function init(params) {

    assert(params.tracks, 'dlgAutoOrganize - tracks must not be empty!');

    title = uitools.getPureTitle(_('Organi&ze files'));
    resizeable = true;

    tracks = params.tracks;
    UI = getAllUIElements();

    tracksList = UI.lvTracksList;
    initDefaultColumns(tracksList.controlClass);    
    tracksList.controlClass.highlightPlayingTrack = false;
    window.localListen(tracksList, 'checkedchanged', refreshDuplicates, false);

    state = app.getValue('dlgAutoOrganize', state);
    UI.moveFiles.controlClass.checked = (state.mode == 'move');
    UI.copyFiles.controlClass.checked = (state.mode != 'move');
    window.localListen(UI.moveFiles, 'click', updateNewFilesOperation);
    window.localListen(UI.copyFiles, 'click', updateNewFilesOperation);

    let sett = window.settings.get();
    UI.filesOp.controlClass.checked = sett['Auto-organize'].DeleteEmptiedFolders;
    UI.chbCutPaths.controlClass.checked = sett['Auto-organize'].TrimLongPaths;
    window.localListen(UI.chbCutPaths, 'click', updateNewPaths, false);

    let cbMasks = UI.cbMasks;
    let maskList = app.settings.getMaskList('OrganizeMasks');
    cbMasks.controlClass.masks = maskList;
    cbMasks.controlClass.value = maskList.getFirst();

    window.localPromise(tracks.whenLoaded()).then(function () {

        tracks = tracks.getCopy(); // #20664
        tracksList.controlClass.dataSource = tracks;

        tracks.modifyAsync(function () {
            tracks.beginUpdate();

            // at first, filter duplicates (#18758)
            let hasher = {};
            let track;
            for (let i = tracks.count - 1; i >= 0; i--) {
                track = tracks.getFastObject(i, track);
                let key = tracks.id + '|' + track.path;
                if (hasher[key])
                    tracks.delete(i);
                else
                    hasher[key] = true;
            }

            for (let i = 0; i < tracks.count; i++) {
                track = tracks.getFastObject(i, track);
                track.temporaryOrder = i; // for the <Auto number> mask  
            }

            tracks.endUpdate();

        }).then(function () {

            tracks.locked(function () {
                cbMasks.controlClass.sampleTrack = tracks.getValue(0);
            });

            let refreshMask = function () { // event when user change mask        
                updateNewPaths();
            };

            window.localListen(cbMasks, 'change', refreshMask, false);

            let OKClick = function () {
                let btn = UI.btnOK;
                if (!btn.controlClass.disabled) {
                    btnOkPressed();
                }
            };

            window.localListen(UI.btnOK, 'click', OKClick);

            // by default, all tracks are checked
            tracks.setAllChecked(true);
            if (tracksList && tracksList.controlClass)
                tracksList.controlClass.updateTopCheckbox();

            updateNewPaths();
            updateNewFilesOperation();
            let sett = app.getValue('dlgAutoOrganize', {});
            if (sett.columns && sett.columns.length > 3)
                tracksList.controlClass.restoreColumns(sett.columns, true);
        });
    });

    window.localListen(thisWindow, 'closed', function () {
        let sett = app.getValue('dlgAutoOrganize', {});
        sett.columns = tracksList.controlClass.storeColumns();
        app.setValue('dlgAutoOrganize', sett);
    });
}

window.btnOkPressed = function() {
    if (cancellationToken) {
        requestTimeout(function () {
            btnOkPressed();
        }, 10);
        return;
    }

    let btn = UI.btnOK;
    if (btn.controlClass && !btn.controlClass.disabled && !windowHandled) {
        windowHandled = true;

        let isMoving = UI.moveFiles.controlClass.checked;
        if (isMoving)
            state.mode = 'move';
        else
            state.mode = 'copy';
        app.setValue('dlgAutoOrganize', state);
        let filesOp = UI.filesOp;
        let addToLib = false;
        let removeEmpty = false;
        if (isMoving) {
            removeEmpty = filesOp.controlClass.checked;
        } else {
            addToLib = filesOp.controlClass.checked;
        }

        let sett = window.settings.get();
        sett['Auto-organize'].DeleteEmptiedFolders = filesOp.controlClass.checked;
        sett['Auto-organize'].TrimLongPaths = UI.chbCutPaths.controlClass.checked;
        window.settings.set(sett);

        // prepare list of tracks to organize and their new names
        let sl = app.utils.createTracklist();
        let names = newStringList();
        tracks.locked(function () {
            newNamesAll.locked(function () {
                let track = undefined;
                for (let i = 0; i < tracks.count; i++) {
                    if (tracks.isChecked(i)) { // track is checked                        
                        track = tracks.getFastObject(i, track);
                        let newPath = newNamesAll.getValue(i);
                        if (track.path != newPath) {
                            sl.add(track);
                            names.add(newPath);
                        }
                    }
                }
            });
        });

        if (sl.count > 0) {
            // run auto organize (it's done in background)
            app.trackOperation.autoOrganize(sl, names, isMoving, addToLib, removeEmpty);
        }

        app.settings.addMask2History(UI.cbMasks.controlClass.value, 'OrganizeMasks');

        closeWindow();
    }
}

function updateNewFilesOperation() {
    if (UI.moveFiles.controlClass.checked) {
        UI.filesOp.controlClass.text = ' ' + _('Delete emptied folders');
    } else {
        UI.filesOp.controlClass.text = ' ' + _('Add copied files to the Library');
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
    UI.btnOK.controlClass.disabled = true;

    let masks = app.masks;
    let visMask = UI.cbMasks.controlClass.value;
    let tracklist = UI.lvTracksList;

    let done = 0;
    let track;
    let lastRefresh = 0;

    function perform() {
        let fromVal = done;
        let toVal = Math.min(fromVal + 50, tracks.count);
        let tr = tracks.getRange(fromVal, toVal - 1);
        lastAsyncMethod = masks.getMaskResultForListAsync(tr, visMask, true, false, true, '');
        window.localPromise(lastAsyncMethod).then(function (newNames) {
            lastAsyncMethod = null;

            let wasLastBatch = false;
            tracks.locked(function () {
                newNames.locked(function () {
                    if (!localCancel.cancel && !window._cleanUpCalled) {
                        for (let i = fromVal; i < toVal; i++) {
                            let newPath = newNames.getValue(i - fromVal);
                            newNamesAll.add(newPath);
                        }
                        done = toVal;
                        if (done < tracks.count)
                            window.requestFrame(perform);
                        else
                            wasLastBatch = true;

                        if (performance.now() - lastRefresh > 250) {
                            UI.lvTracksList.controlClass.rebind();
                            lastRefresh = performance.now();
                        }
                    }
                });
            });
            if (wasLastBatch) {
                refreshDuplicates();
                cancellationToken = null;
            }
        });
    }

    window.requestFrame(perform);
}

function refreshDuplicates() {
    app.utils.fixFilenames(newNamesAll, tracks /* evaluate check states from tracks*/ , UI.chbCutPaths.controlClass.checked);
    UI.lvTracksList.controlClass.rebind(); // to update the binding for fixed filenames
    UI.btnOK.controlClass.disabled = false;
};

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
            return true; // don't save
        },
        editor: editors.gridViewEditors.textEdit,
        bindData: function (div, item) {
            if (!div.offsetParent) // this happened in crash log A14A6CAD, why?
                return;
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

    // add some further columns per #19034
    let defCols = ['title', 'artist', 'album', 'date', 'genre', 'length'];
    for (let columnType of defCols) {
        let col = window.uitools.tracklistFieldDefs[columnType];
        if (col) {
            col.columnType = columnType;
            LV.defaultColumns.push(col);
        }
    }

    LV.setColumns(LV.defaultColumns);
    LV.defaultColumns.forEach((col) => {
        LV.fieldDefs[col.columnType] = col;
    });
}

window.windowCleanup = function () {
    tracks = null;
    cancellationToken = null;
    lastAsyncMethod = null;
    UI = null;    
    window.btnOkPressed = undefined;
}