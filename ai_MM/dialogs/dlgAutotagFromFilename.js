/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

let cancellationToken = null;
let origTracks = null;
let newTracks = null;
let tracks = null;
let updateOnlyEmpty = false;
let editedFields = new Array();

class AutotagTrackList extends TrackListView {

    initialize(rootelem, params) {
        super.initialize(rootelem, params);
        let _this = this;
        this.statusParams = {};
        this.isSortable = false;

        // redefine fieldDefs, we have some changes

        let origFieldDefs = this.fieldDefs;
        this.fieldDefs = getAutotagFieldDefs(origFieldDefs);
        this.mainColumns = this.getDefaultColumns();

        this.defaultColumns = [];
        for (let columnType in this.fieldDefs) {
            let col = this.fieldDefs[columnType];
            _this.defaultColumns.push({
                visible: col.visible,
                disabled: col.disabled,
                title: col.title,
                order: col.order,
                width: col.width,
                minWidth: col.minWidth,
                align: col.align,
                fixed: col.fixed,
                bindData: col.bindData,
                getValue: col.getValue,
                setValue: col.setValue,
                sortFunc: col.sortFunc,
                editor: col.editor,
                editorParams: col.editorParams,
                columnType: columnType,
                shortcutFunc: col.shortcutFunc,
                direction: col.direction || 'ASC',
                headerRenderer: col.headerRenderer,
                setupCell: col.setupCell
            });
        };
        this.setColumns(this.defaultColumns);
        this.header.controlClass.contextMenu = function (evt) {
            return menus.createTracklistColumnsMenu(this.headerItems, evt);
        }.bind(this);
    }
    
    getDefaultColumns() {
        return ['title', 'artist', 'album', 'path'];
    }

    editStart() {
        if (this.focusedIndex % 2 == 1)
            super.editStart();
    }

    storePersistentState() {
        let state = {}
        state.allColumns = this.storeColumns();
        return state;
    }

    restorePersistentState(state) {
        if (state.allColumns && (state.allColumns.length > 0))
            this.restoreColumns(state.allColumns);
    }
}
registerClass(AutotagTrackList);

window.init = function(params) {
    assert(params.tracks, 'dlgAutotagFromFilename - tracks must not be empty!');

    let wnd = this;
    wnd.title = uitools.getPureTitle(_('&Tag from filename')); 
    wnd.resizeable = true;

    let tracksList = qid('lvTracksList');

    let cbMasks = qid('cbMasks');
    let maskList = app.settings.getMaskList('AutoTagMasks');
    cbMasks.controlClass.masks = maskList;
    cbMasks.controlClass.value = maskList.getFirst();
    cbMasks.controlClass.hideWizardButton = true;
    cbMasks.controlClass.showSkipMask = true;
    origTracks = params.tracks;
    window.localPromise(origTracks.whenLoaded()).then(function () {
        newTracks = origTracks.getTemporaryCopies();
        window.localPromise(newTracks.whenLoaded()).then(function () {
            tracks = origTracks.merge(newTracks, 'oddeven');

            editedFields.length = origTracks.count;
            for (let i = 0; i < editedFields.length; i++) {
                editedFields[i] = {};
            }

            tracksList.controlClass.dataSource = tracks;
            tracksList.controlClass.highlightPlayingTrack = false;

            window.localListen(cbMasks, 'change', refreshTracksView, false);
            window.localListen(qid('btnOK'), 'click', btnOkPressed);

            // by default, all tracks are checked
            tracks.setAllChecked(true);
            if (tracksList && tracksList.controlClass)
                tracksList.controlClass.updateTopCheckbox();

            let sett = window.settings.get('AutoTag');
            qid('chbUpdateEmptyFieldsOnly').controlClass.checked = sett.AutoTag.UpdateEmptyOnly;
            updateOnlyEmpty = sett.AutoTag.UpdateEmptyOnly;
            window.localListen(qid('chbUpdateEmptyFieldsOnly'), 'click', chbEmptyFieldsOnlyChanged);
            qid('chbRemoveUnderscores').controlClass.checked = sett.AutoTag.RemoveUnderscores;
            window.localListen(qid('chbRemoveUnderscores'), 'click', updateResults);
            updateResults();
            uitools.browseAndRestoreUIState('dlgAutoTagFromFilename');
        });
    });

    window.localListen(thisWindow, 'closed', function () {
        uitools.browseAndStoreUIState('dlgAutoTagFromFilename');
        if (cancellationToken) {
            cancellationToken.cancel = true;
            cancellationToken = undefined;
        }
    });
}

let bindTextProperty = function (propName, div, item, index) {
    removeCellHighlights(div);
    if (index % 2 === 1) {
        let origTrack = getOrigTrack(index);
        if ((tracks.isChecked(index)) && (!updateOnlyEmpty || origTrack[propName] === '')) {
            if (item[propName] !== origTrack[propName])
                div.classList.add('cellHighlight');
            div.textContent = item[propName];
        } else {
            div.textContent = origTrack[propName];
        }
    } else {
        div.classList.add('cellDisabled');
        div.textContent = item[propName];
    }
};

let bindMultivalProperty = function (propName, div, item, index) {
    removeCellHighlights(div);
    if (index % 2 === 1) {
        let origTrack = getOrigTrack(index);
        if ((tracks.isChecked(index)) && (!updateOnlyEmpty || origTrack[propName] === '')) {
            if (item[propName] !== origTrack[propName])
                div.classList.add('cellHighlight');
            div.textContent = app.utils.multiString2VisualString(item[propName]);
        } else {
            div.textContent = app.utils.multiString2VisualString(origTrack[propName]);
        }
    } else {
        div.classList.add('cellDisabled');
        div.textContent = app.utils.multiString2VisualString(item[propName]);
    }
};

let bindDateProperty = function (propName, div, item, index) {
    removeCellHighlights(div);
    if (index % 2 === 1) {
        let origTrack = getOrigTrack(index);
        if ((tracks.isChecked(index)) && (!updateOnlyEmpty || origTrack[propName] === '')) {
            if (item[propName] !== origTrack[propName])
                div.classList.add('cellHighlight');
            div.textContent = app.utils.myEncodeDate(item[propName]);
        } else {
            div.textContent = app.utils.myEncodeDate(origTrack[propName]);
        }
    } else {
        div.classList.add('cellDisabled');
        div.textContent = app.utils.myEncodeDate(item[propName]);
    }
};

let setTextValue = function (propName, item, newValue, index) {
    if (index % 2 == 1) {
        item[propName] = newValue;
        editedFields[index / 2 | 0][propName] = newValue;
    }
    return true; // don't save
};

let setDateValue = function (propName, item, newValue, raw, index) {
    if (index % 2 == 1) {
        if (raw) {
            item[propName] = newValue;
            editedFields[index / 2 | 0][propName] = newValue;
        } else {
            item[propName] = app.utils.myDecodeDate(newValue);
            editedFields[index / 2 | 0][propName] = item[propName];
        }
    }
    return true; // don't save
};

function getAutotagFieldDefs(origFieldDefs) {
    let usedCols = ['title', 'artist', 'album', 'path', 'actors', 'albumArtist', 'bpm', 'composer', 'conductor', 'custom1', 'custom2', 'custom3', 'custom4', 'custom5',
                    'custom6', 'custom7', 'custom8', 'custom9', 'custom10', 'director', 'discNo', 'episode', 'filename', 'genre', 'grouping', 'involvedPeople', 'order',
                    'parentalRating', 'producer', 'publisher', 'screenwriter', 'season', 'series', 'date', 'origDate'];

    let readOnlyFields = {
        path: true,
        filename: true
    };

    let fieldMapping = {
        discNo: 'discNumber',
        grouping: 'groupDesc',
        order: 'trackNumber',
        series: 'album',
        episode: 'episodeNumber',
        director: 'artist',
        season: 'seasonNumber',
        screenwriter: 'lyricist'
    }; // only for those, where fieldName differs from columnType


    let getPropertyName = function (columnType) {
        if (fieldMapping[columnType])
            return fieldMapping[columnType];
        else
            return columnType;
    };

    let result = {
        checkColumn: {
            visible: true,
            title: '',
            order: 0,
            disabled: false,
            fixed: true, // not movable, not hideable, do not show in column selection dialog
            columnType: 'checkColumn',
            headerRenderer: AutotagTrackList.prototype.headerRenderers.renderCheck,
            setupCell: AutotagTrackList.prototype.cellSetups.setupCheckbox,
            bindData: AutotagTrackList.prototype.defaultBinds.bindCheckboxCell_HideOdd
        }
    };

    forEach(usedCols, function (columnType, index) {
        let defCol = origFieldDefs[columnType];
        let readOnlyCol = !!readOnlyFields[columnType];
        let col = {
            visible: index < 4,
            title: defCol.title,
            width: defCol.width,
            minWidth: defCol.minWidth,
            order: index + 1,
            editor: (readOnlyCol ? undefined : defCol.editor),
            editorParams: (readOnlyCol ? undefined : defCol.editorParams),
            getValue: defCol.getValue,
            align: defCol.align,
            direction: defCol.direction,
            sortFunc: defCol.sortFunc,
            shortcutFunc: defCol.shortcutFunc,
            columnType: columnType
        };
        let propName = getPropertyName(columnType);
        if (readOnlyCol) {
            col.bindData = function (div, item, index) {
                div.textContent = item[propName];
                if (index % 2 == 0) {
                    div.classList.add('cellDisabled');
                } else {
                    div.classList.remove('cellDisabled');
                }
            };
            col.editor = undefined;
            col.editorParams = undefined;
        } else if ((col.editor == editors.gridViewEditors.textEdit) || (col.editor == editors.gridViewEditors.numberEdit) || (col.editor == editors.gridViewEditors.textDropdownEdit)) {
            col.bindData = function (div, item, index) {
                bindTextProperty(propName, div, item, index);
            };
            col.setValue = function (item, newValue, raw, index) {
                return setTextValue(propName, item, newValue, index);
            };

        } else if (col.editor == editors.gridViewEditors.multiValueEdit) {
            col.bindData = function (div, item, index) {
                bindMultivalProperty(propName, div, item, index);
            };
            col.setValue = function (item, newValue, raw, index) {
                return setTextValue(propName, item, newValue, index);
            };
        } else if (col.editor == editors.gridViewEditors.dateEdit) {
            col.bindData = function (div, item, index) {
                bindDateProperty(propName, div, item, index);
            };
            col.setValue = function (item, newValue, raw, index) {
                return setDateValue(propName, item, newValue, raw, index);
            };
        }
        result[columnType] = col;
    });

    return result;
}

function chbEmptyFieldsOnlyChanged() {
    updateOnlyEmpty = qid('chbUpdateEmptyFieldsOnly').controlClass.checked;
    refreshTracksView();
}

window.btnOkPressed = function() {

    app.settings.addMask2History(qid('cbMasks').controlClass.value, 'AutoTagMasks');

    let sett = window.settings.get('AutoTag');
    sett.AutoTag.UpdateEmptyOnly = qid('chbUpdateEmptyFieldsOnly').controlClass.checked;
    sett.AutoTag.RemoveUnderscores = qid('chbRemoveUnderscores').controlClass.checked;
    window.settings.set(sett, 'AutoTag');


    if (tracks.getAllChecked()) {
        app.trackOperation.assignMetadata(origTracks, newTracks, updateOnlyEmpty, false);
    } else {
        newTracks.modifyAsync(() => {
            tracks.locked(() => {
                for (let i = 0; i < newTracks.count; i++) {
                    if (tracks.isChecked(2 * i + 1))
                        newTracks.setChecked(i, true);
                };
            });
        }).then(() => {
            app.trackOperation.assignMetadata(origTracks, newTracks, updateOnlyEmpty, true /* only checked*/ );
        });
    }
    // LS: used the native code app.trackOperation.assignMetadata above 
    // to be faster than the original JS code commented out below (#19077)
    /*
    let tracksToUpdate = app.utils.createTracklist();
    origTracks.beginUpdate();
    origTracks.locked(function () {
        let origTrack = undefined;
        let newTrack = undefined;
        newTracks.locked(function () {
            tracks.locked(function () {
                for (let i = 0; i < origTracks.count; i++) {
                    origTrack = origTracks.getFastObject(i, origTrack);
                    newTrack = newTracks.getFastObject(i, newTrack);
                    if (tracks.isChecked(i)) {
                        if (updateOnlyEmpty) {
                            newTrack.longTextLoaded = true;
                            origTrack.addData(newTrack);
                        } else
                            origTrack.assign(newTrack);
                        tracksToUpdate.add(origTrack);
                    }
                }
            });
        });
    });
    origTracks.endUpdate();
    tracksToUpdate.commitAsync();
    */

    qid('lvTracksList').controlClass.storePersistentStates();
    uitools.browseAndStoreUIState('dlgAutoTagFromFilename');
    closeWindow();
}

function refreshTracksView() {
    updateResults();
    qid('lvTracksList').controlClass.invalidateAll();
};

function updateResults() {

    if (cancellationToken) {
        cancellationToken.cancel = true;
    }
    cancellationToken = {
        cancel: false
    };

    let visMask = qid('cbMasks').controlClass.value;
    let removeUnderscores = qid('chbRemoveUnderscores').controlClass.checked;
    let btnOK = qid('btnOK');
    let lblProgress = qid('lblProgress');
    let textProgress = _('Preparing list of files');
    btnOK.controlClass.disabled = true;

    // LS: TODO: once web workers will be added, move whole asyncLoop into a web worker
    //          , otherwise we would need to use our delphi worker and do filename2TrackInfo on whole list newTracks (would be much faster and less JS thread consuming)    
    asyncLoop(function (idx) {
        let fromVal = idx * 10;
        let toVal = Math.min(fromVal + 10, newTracks.count);
        let trO = origTracks.getRange(fromVal, toVal - 1);
        let trN = newTracks.getRange(fromVal, toVal - 1);
        let origTrack = undefined;
        let track = undefined;
        lblProgress.textContent = textProgress + ' (' + fromVal + '/' + newTracks.count + ')';
        newTracks.beginUpdate();
        trO.locked(function () {
            trN.locked(function () {
                for (let i = 0; i < trO.count; i++) {
                    origTrack = trO.getFastObject(i, origTrack);
                    track = trN.getFastObject(i, track);
                    track.assign(origTrack);
                    app.trackOperation.filename2TrackInfo(visMask, track, removeUnderscores);
                    let iTrck = fromVal + i;
                    for (let propName in editedFields[iTrck]) {
                        track[propName] = editedFields[iTrck][propName];
                    }
                }
            });
        });
        newTracks.endUpdate();
        return toVal == newTracks.count;
    }, 0, cancellationToken, function () {
        // finished event        
        qid('lvTracksList').controlClass.invalidateAll();
        btnOK.controlClass.disabled = false;
        lblProgress.textContent = '';
    });
}

let __origTrack = null;

function getOrigTrack(doubleIndex) {
    origTracks.locked(function () {
        __origTrack = origTracks.getFastObject(doubleIndex / 2 | 0, __origTrack); // there are two rows for each track, we need to divide the index by two
    });
    return __origTrack;
}

function removeCellHighlights(div) {
    div.classList.remove('cellHighlight');
    div.classList.remove('cellDisabled');
}

window.windowCleanup = function () {
    origTracks = null;
    newTracks = null;
    tracks = null;
    editedFields = undefined;    
    window.btnOkPressed = undefined;
}