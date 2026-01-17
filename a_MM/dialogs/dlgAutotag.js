/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

requirejs('controls/maskedit');
requirejs('controls/groupedTracklist');
requirejs('controls/popupmenu');
requirejs('actions');
requirejs('controls/editable');
requirejs('controls/menubutton');
requirejs('helpers/searchTools');
requirejs('controls/toastMessage');
requirejs('helpers/autoTagFramework.js');
requirejs('helpers/arrayDataSource');

var autotagCoverChanged = [];
var autotagFields = [];
var searchManager = null;

let newTracks = null;
let tracksLoaded = false;
let lvTracklist;
let confirm = false;
let confirmAll = false,
    cancelAll = false;
const FIELD_AUDIO = 0,
    FIELD_VIDEO = 1,
    FIELD_BOTH = 2;
let columns = [];
let setTracksToLV = null;
let currentColumnsDataType;
let fieldsToUpdate;
let progress = 0;
let regroupShown = false;
let editing = false;
let editorList = [];
let coverLookups = [];
let currentLookup;
let trackGenreAddonsCache = [];
let closeReceived = false;
let finishedTracks = 0;
let tracksTotal = 0;
let oldSearchManager = null;
let goldShown = false;
let errorShown = false;
let findMoreProcessing = false;
let multiValueFields = ['artist', 'albumArtist', 'genre', 'actors', 'publisher', 'director', 'producer'];
let lookupFinished = false;

const moreValue = '<i>' + _('Find more results...') + '</i>';
const moreValueFingerprint = '<i>' + _('Lookup via fingerprint...') + '</i>';
const emptyValue = '< ' + _('empty') + ' >';
const wndTitle = _('Auto-tag');

function initializeSearchManager(params) {

    oldSearchManager = searchManager;

    searchManager = autoTagFramework.getSearchManager('musicbrainz');
    searchManager.override({
        changeTagger: function ($super, tagger) {
            this.finishSearch();
            $super(tagger);
            if (!this.isCanceled()) {
                hideProgress();
                this.scriptedStartSearch();
            }
        },

        notifyBatchFinished: function ($super) {
            $super();
            if (!this.isCanceled()) {
                if (canRegroup())
                    callRegroup();
                else
                    notifyRegroupRequired(true);
                isLookupFinished(true);
            }
        },

        notifyError: function ($super, code, info, errorCode) {
            $super();
            showError(code, info, errorCode);
        },

        startSearch: function ($super) {
            return new Promise(function (resolve, reject) {
                if (!this.isCanceled()) {
                    isLookupFinished(false);
                    showProgress();
                    showCopyright();
                    $super().then(function (res) {
                        if (!this.isCanceled()) {
                            this.refreshViews(res);
                            hideProgress(true);
                            resolve();
                        } else {
                            hideProgress();
                            reject();
                        }
                    }.bind(this));
                } else
                    reject();
            }.bind(this));
        },

        refresh: function ($super) {
            if (!this.isCanceled())
                this.refreshViews();
        },

        refreshViews: function (res) {
            if (!this.isCanceled()) {
                if (canRegroup())
                    callRegroup(true);
                updateResults();
            }
        },

        artworkSearch: function ($super, path, finished) {
            $super(finished);

            if (this.isCanceled())
                return;

            coverLookups[path] = finished;

            if (finished)
                refreshLVCover(path);
            else
                refreshLV(path);
        },

        notifyNextBatch: function ($super, info) {
            if (this.isCanceled())
                return;
            if ((info.fromIndex !== 0) || (info.toIndex !== newTracks.count - 1)) {
                updateWindowTitle(info.fromIndex, info.toIndex, tracksTotal);
            }

            if (info.fromIndex !== 0)
                if (!app.utils.isRegistered())
                    notifyGold();
        },

        notifyProgress: function ($super, current, total, label) {
            if (this.isCanceled())
                return;
            if (findMoreProcessing) {
                let lbl = sprintf(_('File %d of %d processing'), 1, 1);
                if (label)
                    lbl += ' (' + label + ')';
                setProgressVal(0, lbl);
            } else {
                let totalCount = 0;

                if (current === undefined)
                    current = this._lastCurrent;

                if (total === undefined)
                    total = this._lastTotal;

                if (total !== undefined)
                    totalCount = total;
                
                let tracks = this.getOrigTracks();
                if ((tracks) && ((totalCount == 0) || (totalCount > tracks.count)))
                    totalCount = tracks.count;

                let lbl = sprintf(_('File %d of %d processing'), Math.min((current + 1), totalCount), totalCount);
                if (label)
                    lbl += ' (' + label + ')';
                setProgressVal((current + 1) / (totalCount + 1), lbl);

                this._lastCurrent = current;
                this._lastTotal = total;
            }
        }

    });
}

function getEmptyFields() {
    return {
        trackNumber: '',
        discNumber: '',
        seasonNumber: '',
        episodeNumber: '',
        title: '',
        album: '',
        albumArtist: '',
        artist: '',
        genre: '',
        date: -1,
        year: -1,
        actors: '',
        involvedPeople: '',
        publisher: '',
        director: '',
        producer: '',
        lyricist: '',
        parentalRating: '',
        commentShort: '',
        lyricsShort: '',
        albumType: '',
    };
};

function prepareArrays() {
    newTracks.locked(function () {
        let track;
        for (let i = 0; i < newTracks.count; i++) {
            let path = newTracks.getFastObject(i, track).path;
            autotagFields[path] = {
                origTrackPath: path,
                editedFields: getEmptyFields(),
                lookupFields: getEmptyFields()
            };
        }
    });

    editorList = [];
    coverLookups = [];
}

function prepareTracks(params) {

    prepareArrays();

    let prepareColumns = function (tracks) {
        let lastType = -1;
        let isMulti = false;
        let fastObj = null;
        tracks.locked(function () {
            for (let i = 0; i < tracks.count; i++) {
                fastObj = tracks.getFastObject(i, fastObj);
                let newType = fastObj.isVideo ? 1 : 0;
                if (lastType === -1)
                    lastType = newType;
                else
                if (lastType !== newType) {
                    isMulti = true;
                    break;
                }
            }
        });

        addColumns(isMulti ? 2 : lastType);
    }

    setTracksToLV = function (addColumns) {
        let tracks = searchManager.getTracks();
        if (tracks) {
            //tracks.autoSortDisabled = true;
            tracks.disableAlbumTracksLimit = true;
            tracks.setAllCollapsed(false);
            if (addColumns)
                prepareColumns(tracks);
        }
        if (tracks && lvTracklist && lvTracklist.controlClass) {
            tracks.autoUpdateDisabled = true; // #15938
            lvTracklist.controlClass.dataSource = tracks;
            lvTracklist.controlClass.autoSortString = 'album;albumArtist;discNo;order;title';
            lvTracklist.controlClass.forceAutoSort();
            lvTracklist.controlClass.disableAlbumTracksLimit = true;
        }

        updateTagButton();
    };

    if (confirm) {
        qid('btnTag').controlClass.textContent = _('Confirm');
        setVisibility(qid('btnConfirmAll'), false);
    } else {
        qid('btnSkip').controlClass.textContent = _('Skip & Continue');
        setVisibility(qid('btnConfirmAll'), false);
        //setVisibility(qid('btnSkip'), false);
    }

    if (oldSearchManager) {
        searchManager.importTracks(oldSearchManager).then(function () {
            if (!window._cleanUpCalled && lvTracklist && lvTracklist.controlClass)
                setTracksToLV(!lvTracklist.controlClass.columns.length);
            oldSearchManager = null;
        });
    } else {
        tracksTotal = newTracks.count;
        searchManager.addTracks(newTracks, true).then(function () {
            if (!window._cleanUpCalled && lvTracklist && lvTracklist.controlClass)
                setTracksToLV(!lvTracklist.controlClass.columns.length);
        });
    }

    tracksLoaded = true;
}

function cleanUpBeforeReset(cancel) {
    if (cancel && searchManager && searchManager.isRunning()) {
        searchManager.cancel();
    }

    autotagFields = [];
    autotagCoverChanged = [];
    tracksLoaded = false;
    columns = [];
    editing = false;
    regroupShown = false;
    editorList = [];
    coverLookups = [];
    trackGenreAddonsCache = [];
    errorShown = false;
    if(lvTracklist && lvTracklist.controlClass)
        lvTracklist.controlClass.clearDivs();
    qid('btnTag').controlClass.disabled = true;
    qid('btnSkip').controlClass.disabled = false;
}

window.windowCleanup = function () {
    // return settings back, to avoid #18940
    window.settings.UI.hideShuffleGroupCommands = undefined;
    window.settings.UI.hideClipboardCommands = undefined;
    window.settings.UI.hidePinCommands = undefined;
    window.settings.UI.allowTrackProperties = undefined;
    
    lvTracklist = undefined;
    autotagCoverChanged = undefined;
    autotagFields = undefined;
    searchManager = null;
    oldSearchManager = null;
};

function init(params) {
    assert(params.tracks, 'dlgAutotag - tracks must not be empty!');

    goldShown = false;
    closeReceived = false;
    errorShown = false;
    confirm = params.confirm;
    let wnd = this;
    wnd.title = wndTitle;
    wnd.resizeable = true;
    window.settings.UI.allowTrackProperties = params.allowTrackProperties;

    // hide some menu commands
    window.settings.UI.hideShuffleGroupCommands = true;
    window.settings.UI.hideClipboardCommands = true;
    window.settings.UI.hidePinCommands = true;

    newTracks = params.tracks;
    //newTracks.autoSort = false;
    newTracks.setAllChecked(false);
    newTracks.setAllCollapsed(false);
    newTracks.suspendAutoUpdates(); // disable any notifications for this tracklist


    window.localListen(window, 'keydown', function (e) {
        if (friendlyKeyName(e) === 'F5') {
            callRegroup(true, false, true);
        }
    });

    initializeSearchManager(params);

    initLVTracklist();
    setVisibility(qid('progress'), false);

    prepareTracks(params);

    let chbAllowCompilations = qid('chbAllowCompilations');
    chbAllowCompilations.controlClass.checked = !searchManager.avoidCompilations();
    window.localListen(chbAllowCompilations, 'click', () => {
        cleanUpBeforeReset(true);

        let sett = settings.get('Options');
        sett.Options.AutoTagAvoidCompilations = !chbAllowCompilations.controlClass.checked;
        settings.set(sett, 'Options');

        initializeSearchManager(params);
        prepareTracks(params);
    });

    window.localListen(thisWindow, 'closed', function () {
        if (!confirm) {
            searchManager.finishSearch();
        }
        if (newTracks)
            newTracks.resumeAutoUpdates();
        uitools.browseAndStoreUIState('dlgAutotag');
        //saveColumnsOrder();
    });

    window.localListen(qid('btnTag'), 'click', btnTagPressed);
    window.localListen(qid('btnSkip'), 'click', btnSkipPressed);

    window.localListen(qid('lvTracksList'), 'checkedchanged', function () {
        updateTagButton();
    });
    qid('btnTag').controlClass.disabled = true;

    let skipBtn = qid('btnSkip');
    if (skipBtn)
        setVisibility(skipBtn, false);

    window.localListen(qid('btnConfirmAll'), 'click', function () {
        searchManager.confirmAll = true;
        qid('btnTag').click();
    });
    window.localListen(qid('btnCancel'), 'click', function () {
        searchManager.cancelAll = true;
    });

    window.localListen(qid('btnSettings'), 'click', function () {
        uitools.openDialog('dlgOptions', {
            modal: true,
            defaultPanel: 'pnl_MetadataLookup',
        });
    });

}

let lastFrom = undefined,
    lastTo = undefined;

function isLookupFinished(finished) {
    lookupFinished = finished;
    updateTagButton();
}

function updateTagButton() {
    let ds = qid('lvTracksList').controlClass.dataSource;
    if (ds && ds.anyChecked) {
        qid('btnTag').controlClass.disabled = !ds.anyChecked() || !lookupFinished;
    }

    if (!confirm) {
        if (searchManager.batchEmpty())
            qid('btnTag').controlClass.textContent = _('Save');
        else
            qid('btnTag').controlClass.textContent = _('Tag & Continue');
    }
}

function updateWindowTitle(from, to, total) {
    let lv = qid('lvTracksList');
    if (window._cleanUpCalled || !searchManager || !lv)
        return;
    if (from !== undefined && to !== undefined) {
        lastFrom = from;
        lastTo = to;
    } else {
        from = finishedTracks;
        to = from + lv.controlClass.dataSource.count;
    }
    to = Math.min(to, total - 1);
    thisWindow.title = wndTitle + ': ' + sprintf(_('Tracks %d to %d of %d'), (from + 1), (to + 1), total);
}

let incomingTracks = null;

function getNewTracklist() {
    incomingTracks = app.utils.createTracklist(true);
    return incomingTracks;
}

function addNewTracks() {
    if (window._cleanUpCalled || !searchManager)
        return;
    if (incomingTracks) {
        let tracks = incomingTracks;
        incomingTracks = null;
        let newList = app.utils.createTracklist(true);
        newList.addList(tracks);
        tracksTotal += newList.count;
        searchManager.addTracks(newList, true /* detect tagger */ ).then1(() => {
            updateWindowTitle(lastFrom, lastTo, tracksTotal);
        });
    }
}

function setProgressVal(value, text) {
    let pr = qid('progress');
    if (pr && pr.controlClass) {
        if (value !== null) {
            pr.controlClass.value = value;
        } else {
            pr.controlClass.value = newTracks.count;
        }
        if (text)
            pr.controlClass.text = text;
    }
}

function showCopyright() {
    let div = qid('copyright');
    if (div) {
        searchManager.getTaggerCopyrightInfo().then(function (text) {
            if (window._cleanUpCalled || !searchManager)
                return;
            div.innerHTML = text;
        });
    }
}

function showProgress() {
    progress++;
    let pr = qid('progress');
    if (pr)
        setVisibility(pr, true);
}

function hideProgress(completed) {
    if (--progress == 0) {
        if (!completed) {
            let pr = qid('progress');
            if (pr)
                setVisibility(pr, false);
        } else {
            setProgressVal(null, _('Lookups completed'));
            progress++;
            requestTimeout(() => {
                hideProgress();
            }, 5000);
        }
    }
}

function btnSkipPressed() {
    if (searchManager.batchEmpty()) {
        if (closeReceived) return;
        closeReceived = true;

        modalResult = 1;
        closeWindow();
    } else {
        qid('btnTag').controlClass.disabled = true;
        qid('btnSkip').controlClass.disabled = true;

        let processedTracks = searchManager.currentBatchSize();
        finishedTracks += processedTracks;

        if (searchManager.isRunning())
            searchManager.cancel();
        searchManager.whenReady().then(() => {
            if (searchManager.nextBatch()) {
                newTracks = searchManager.getOrigTracks();
                cleanUpBeforeReset(false);
                prepareArrays();
                searchManager.scriptedStartSearch();
                setTracksToLV(true);
                updateWindowTitle(undefined, undefined, tracksTotal);
            } else {
                modalResult = 1;
                closeWindow();
            }
        });
    }
}

function btnTagPressed() {

    let storeAsync = function () {
        return new Promise(function (resolve) {
            let ds = lvTracklist.controlClass.dataSource;
            ds.locked(function () {
                let track;

                // remove artworks for tracks/albums where user choose 'use original artwork'
                for (let i = 0; i < ds.count; i++) {
                    track = ds.getFastObject(i, track);
                    let group = ds.getItemGroup(i, false);
                    if ((group && (autotagFields[group.id] && autotagFields[group.id].showLookupCover !== false))) {

                    } else {
                        searchManager.setArtworkLink(track.path, '');
                    }
                }

                // set same cover for all tracks from each album
                let cnt = ds.getGroupsCount();
                for (let i = 0; i < cnt; i++) {
                    let group = ds.getItemGroup(i, true);
                    track = ds.getFastObject(group.index, track);
                    let cvr = searchManager.getArtworkLink(track.path);
                    for (let j = group.index + 1; j < group.index + group.itemCount; j++) {
                        track = ds.getFastObject(j, track);
                        searchManager.setArtworkLink(track.path, cvr);
                    }
                }
            });

            searchManager.commitAsync().then(function () {
                resolve();
            });
        }.bind(this));
    };

    if (searchManager.batchEmpty()) {
        if (closeReceived) return;
        closeReceived = true;

        showProgress();

        if (searchManager && !confirm) {
            // remove artworks for tracks/albums where user choose 'use original artwork'
            storeAsync().then(function () {
                modalResult = 1;
                closeWindow();
            });
        } else {
            modalResult = 1;
            closeWindow();
        }
    } else {
        qid('btnTag').controlClass.disabled = true;
        qid('btnSkip').controlClass.disabled = true;

        let processedTracks = searchManager.currentBatchSize();

        storeAsync().then(function () {
            finishedTracks += processedTracks;
            if (searchManager.isRunning())
                searchManager.cancel();
            searchManager.whenReady().then(() => {
                if (searchManager.nextBatch()) {
                    newTracks = searchManager.getOrigTracks();
                    cleanUpBeforeReset(false);
                    prepareArrays();
                    searchManager.scriptedStartSearch();
                    setTracksToLV(true);
                    updateWindowTitle(lastFrom, lastTo, tracksTotal);
                } else {
                    modalResult = 1;
                    closeWindow();
                }
            });
        }.bind(this));
    }
}

function getCloseInfo() {
    return {
        confirmAll: confirmAll,
        cancelAll: cancelAll
    };
}

function resetGroupId(path) {
    let group;
    lvTracklist.controlClass.dataSource.locked(function() {
        let tr;
        for(let i = 0; i < lvTracklist.controlClass.dataSource.count; i++) {
            tr = lvTracklist.controlClass.dataSource.getFastObject(i, tr);
            if (tr.path === path) {
                group = lvTracklist.controlClass.dataSource.getItemGroup(i, false);
                break;
            }
        }
    });

    if (group) {
        lvTracklist.controlClass.groupDivs.forEach(function (div) {
            if (div.groupid === group.id)
                div.groupid = null;
        }.bind(this));

        lvTracklist.controlClass.invalidateAll();
    }
}

function refreshLVCover(path) {
    if (!window.getCurrentEditor() && !editing && lvTracklist && lvTracklist.controlClass && !window._cleanUpCalled)
        //autotagCoverChanged[path] = true;
        if(path)
            resetGroupId(path);
        else
            lvTracklist.controlClass.rebind();
}

function refreshLV(path) {
    if (!window.getCurrentEditor() && !editing && lvTracklist && lvTracklist.controlClass && !window._cleanUpCalled) {
        if(path)
            resetGroupId(path);
        else
            lvTracklist.controlClass.rebind();//invalidateAll();
    }
}

function canRegroup() {
    return !regroupShown && !window.getCurrentEditor() && !editing && !window._cleanUpCalled;
}

function showError(code, info, errorCode) {
    if (!errorShown) {
        if (errorCode === undefined) {
            errorCode = _('Server is down!');
        }
        if (errorCode && errorCode.toLowerCase && (errorCode.toLowerCase() === 'not found')) {
            return;
        }
        let rect = lvTracklist.getBoundingClientRect();
        uitools.toastMessage.show(_('Error') + ': ' + _('Metadata lookup') + ' (' + info + ') ' + _('Fail') + '!<br>' + _('Error code') + ': ' + errorCode, {
            disableClose: false,
            delay: 15000,
            left: rect.left,
            right: rect.right,
        });
        errorShown = true;
    }
}

function notifyGold() {
    if (!goldShown) {
        let rect = lvTracklist.getBoundingClientRect();
        uitools.toastMessage.show(_('Auto-tag more / faster with') + ' <a data-id="link" class="hotlink clickable inline" data-control-class="Control">MediaMonkey Gold</a>', {
            disableClose: false,
            delay: 15000,
            left: rect.left,
            right: rect.right,
            onLinkClick: function () {
                uitools.openWeb(app.utils.registerLink());
            }
        });
        goldShown = true;
    }
}

function notifyRegroupRequired(force) {
    if (!regroupShown || force) {
        let rect = lvTracklist.getBoundingClientRect();
        uitools.toastMessage.show(_('Press F5 to re-sort/re-group tracks'), {
            disableUndo: true,
            disableClose: true,
            delay: 3000,
            left: rect.left,
            right: rect.right
        });
        regroupShown = true;
        lvTracklist.controlClass.dataSource.autoSortDisabled = true;
    }
}

function callRegroup(invalidateViewport, forceFocus, forceResort) {
    if (lvTracklist && lvTracklist.controlClass) {
        if (forceResort) {
            lvTracklist.controlClass.dataSource.autoSortDisabled = false;
            regroupShown = false;
        }
        let trackToFocus = null;
        if (typeof forceFocus === 'object')
            trackToFocus = forceFocus;
        else
        if (forceFocus >= 0) {
            lvTracklist.controlClass.dataSource.focusedIndex = forceFocus;
            trackToFocus = lvTracklist.controlClass.dataSource.focusedItem;
        }
        lvTracklist.controlClass.groupsRecompute(true, invalidateViewport).then(function () {
            if (lvTracklist && lvTracklist.controlClass) {
                let ds = lvTracklist.controlClass.dataSource;
                ds.locked(function () {
                    let cnt = ds.getGroupsCount();
                    for (let i = 0; i < cnt; i++) {
                        let group = ds.getItemGroup(i, true);
                        autotagFields[group.id] = autotagFields[group.id] || {};
                        if (autotagFields[group.id] && autotagFields[group.id].showLookupCover === undefined) {
                            autotagFields[group.id].showLookupCover = true; // use lookup cover by default
                        }
                    }
                });
                let idx = -1;
                if (trackToFocus) {
                    idx = ds.indexOf(trackToFocus);
                }
                if (idx >= 0) {
                    let div = lvTracklist.controlClass.getDiv(idx);
                    if (div) {
                        div.setAttribute('highlightFocused', 1);
                        requestTimeout(function () {
                            lvTracklist.controlClass.setUpTransition(div, 'highlightFocusedFadeOut', function () {
                                div.removeAttribute('highlightFocused');
                            });
                        }, 500);
                    }
                    lvTracklist.controlClass.focusedIndex = idx;
                    lvTracklist.controlClass.setItemFullyVisible(idx);
                }
            }
        });
    }
}

function updateLink(track, field, lookup) {

    let processLookup = function (lookup) {
        let ar = [];

        if (lookup['recording']) {
            ar.push({
                linkType: lookup.lookupSource,
                info: 'recording',
                link: lookup['recording']
            });
        }
        if (lookup['release']) {
            ar.push({
                linkType: lookup.lookupSource,
                info: 'release',
                link: lookup['release']
            });
        }
        if (lookup['releaseGroup']) {
            ar.push({
                linkType: lookup.lookupSource,
                info: 'releaseGroup',
                link: lookup['releaseGroup']
            });
        }
        return ar;
    }

    if (lookup) {
        searchManager.setTrackLinks(track.path, processLookup(lookup));
    } else {
        let path = track.path;
        let lookups = searchManager.getTrackLookups(path);
        let value = track[field];
        if (value !== '') {
            for (let i = 0; i < lookups.length; i++) {
                if (lookups[i][field] === value) {
                    let ar = processLookup(lookups[i]);
                    if (ar.length) {
                        searchManager.setTrackLinks(path, ar);
                        return;
                    }
                }

            }
        }
        searchManager.setTrackLinks(path, []);
    }
}

let cancellationToken = null;

function updateResults() {

    if (window._cleanUpCalled)
        return;

    let skipBtn = qid('btnSkip');
    if (skipBtn)
        setVisibility(skipBtn, !searchManager.batchEmpty());

    if (cancellationToken) {
        cancellationToken.cancel = true;
    }
    let localCancelToken = {
        cancel: false
    };
    cancellationToken = localCancelToken;

    let idx = 0;

    let processTrack = function (track) {
        let path = track.path;
        let autoTagData = autotagFields[path];
        if (autoTagData) {
            let lookup = autoTagData.lookupFields;
            let edited = autoTagData.editedFields;

            let processTrackField = function (field, zeroVal, writeProp, multiValue) {
                zeroVal = zeroVal || '';
                if (edited[field] != zeroVal)
                    track[writeProp || field] = edited[field];
                lookup[field] = track[field];
            }

            track.beginUpdate();
            processTrackField('trackNumber');
            processTrackField('discNumber');
            processTrackField('seasonNumber');
            processTrackField('episodeNumber');
            processTrackField('title');
            processTrackField('artist');
            processTrackField('albumArtist');
            processTrackField('album');
            processTrackField('genre');
            processTrackField('date', -1);
            processTrackField('year', -1);
            processTrackField('actors');
            processTrackField('involvedPeople');
            processTrackField('publisher');
            processTrackField('director');
            processTrackField('producer');
            processTrackField('lyricist');
            processTrackField('parentalRating');
            processTrackField('commentShort', '', 'comment');
            processTrackField('lyricsShort', '', 'lyrics');
            track.endUpdate();
        }
    }

    let _nextStep = function () {
        if (!searchManager || localCancelToken.cancel || window._cleanUpCalled)
            return;
        let tracks = searchManager.getTracks();
        if (!tracks) return;

        tracks.beginUpdate();
        let fromVal = idx;
        let toVal = Math.min(fromVal + 10, tracks.count);
        let tr = tracks.getRange(fromVal, toVal - 1);
        let track = undefined;
        tr.locked(function () {
            for (let i = 0; i < tr.count; i++) {
                track = tr.getFastObject(i, track);
                let iTrck = fromVal + i;

                if (track.autoTagState === AT_STATE_FAILED) {
                    tracks.setChecked(iTrck, false);
                }

                processTrack(track);
            }
        });
        tracks.endUpdate();

        if (toVal == tracks.count) {
            // finished event
            if (canRegroup())
                callRegroup();
            notifyLayoutChange();
        } else {
            idx = toVal;
            requestIdleCallback(_nextStep);
        }
    }
    requestIdleCallback(_nextStep);
}

let __origTrack = null;

function getOrigTrack(path, notFast) {
    let origTracks = newTracks;
    if (notFast) {
        let track;
        origTracks.locked(function () {
            for(let i = 0; i < origTracks.count; i++) {
                let tr = origTracks.getValue(i);
                if (tr.path === path) {
                    track = tr;
                    break;
                }
            }
        });
        return track;
    } else {
        origTracks.locked(function () {
            let tr;
            for(let i = 0; i < origTracks.count; i++) {
                tr = origTracks.getFastObject(i, tr);
                if (tr.path === path) {
                    __origTrack = tr;
                    break;
                }
            }
        });

        return __origTrack;
    }
}

function removeCellHighlights(div) {
    div.classList.remove('lookupField');
    div.classList.remove('lookupFieldInConflict');
    div.classList.remove('cellHighlight');
    div.classList.remove('cellDisabled');
}

function onTracksViewChecked() {

}

function bindField(div, item, index, type, isDate) {
    let ctrl = div;
    if (div.contentCtrl)
        ctrl = div.contentCtrl;

    if (div.hasAttribute('data-disabled')) {
        ctrl.setAttribute('data-disabled', 1);
        ctrl.classList.remove('clickable'); // #17793
    } else {
        ctrl.removeAttribute('data-disabled');
        ctrl.classList.add('clickable'); // #17793
    }

    removeCellHighlights(ctrl);

    let autoTagInfo = autotagFields[item.path];
    if (!autoTagInfo)
        return;
    let origTrack = getOrigTrack(autoTagInfo.origTrackPath, true);

    if (!item || !origTrack)
        return;

    let addon = '';

    function removeSpecial(s) {
        return s.replace(/[^a-z0-9\(\)\x00-\x7F]/ig, '')
    }

    function compareSpecial(a, b) {
        if ((a && !b) || (!b && a) || (!a && !b) || (a.length !== b.length))
            return false;
        return removeSpecial(a).toUpperCase() == removeSpecial(b).toUpperCase();
    }

    let lookupEmpty = (autoTagInfo.lookupFields[type] === '') || (autoTagInfo.lookupFields[type] === -1);
    let editedEmpty = (autoTagInfo.editedFields[type] === '') || (autoTagInfo.editedFields[type] === -1);

    if (!lookupEmpty || !editedEmpty) {
        let lookupVal = autoTagInfo.lookupFields[type].toString();
        if (!editedEmpty) {
            lookupVal = autoTagInfo.editedFields[type].toString();
        }
        let origVal = musicBrainz.normalizeString(origTrack[type].toString());
        let newVal = musicBrainz.normalizeString(item[type].toString());

        let lookupSim = compareSpecial(lookupVal, origVal);
        let origSim = compareSpecial(newVal, origVal);
        if ((!lookupSim) || (!origSim)) {
            ctrl.classList.add('lookupField');
            let value = origTrack[type];
            if (type === 'date' || type === 'year') {
                value = app.utils.myEncodeDate(value);
            }

            if ((!origSim) && (value)) {
                if (value !== '')
                    addon = '<span class="lookupFieldInConflict" ' + (ctrl.hasAttribute('data-disabled') ? 'data-disabled' : '') + ' data-tip="Conflicts with original value: ' + value + '">!</span>';
            }
        }

        if (type === 'genre') {
            if (trackGenreAddonsCache[item.path]) {
                addon += app.utils.multiString2VisualString(trackGenreAddonsCache[item.path]);
            } else {
                let mbTrack = searchManager.getCurrentTrackLookup(item.path);
                if (mbTrack) {
                    let sep = ';';
                    let ret = newStringList(true);
                    ret.separator = sep;
                    ret.text = mbTrack.genre;
                    let genres = newVal.split(sep);
                    for (let i = 0; i < genres.length; i++) {
                        let idx = ret.indexOfCI(genres[i]);
                        if (idx >= 0)
                            ret.delete(idx);
                    }
                    if (ret.count > 0) {
                        trackGenreAddonsCache[item.path] = '<span class="lookupUnknownGenres">';
                        ret.locked(function () {
                            for (let i = 0; i < ret.count; i++) {
                                trackGenreAddonsCache[item.path] += sep + ' ' + ret.getValue(i);
                            }
                        });
                        trackGenreAddonsCache[item.path] += '</span>';
                        addon += app.utils.multiString2VisualString(trackGenreAddonsCache[item.path]);
                    }
                }
            }
        }
    }

    let text = item[type];
    if (type === 'genre') {
        let sep = ';';
        text = text.split(sep).join(sep+' ');
    }

    if (isDate || (type === 'year'))
        text = app.utils.myEncodeDate(text);

    if (multiValueFields.indexOf(type) >= 0)
        text = app.utils.multiString2VisualString(text);

    if (addon !== '')
        ctrl.innerHTML = text + addon;
    else
        ctrl.innerText = text;
};

function isMore(value) {
    return (value === moreValue) || (value === moreValueFingerprint);
}

function fillList(index, prop) {
    editorList = [];
    let ret = new ArrayDataSource([], {
        isLoaded: true
    });

    let track;
    let tracks = searchManager.getTracks();
    if (!tracks)
        return ret;

    tracks.locked(function () {
        track = tracks.getValue(index);
    });

    if (!track)
        return ret;

    let autoTagData = autotagFields[track.path];

    if (!autoTagData || !autoTagData.editedFields || !autoTagData.lookupFields)
        return ret;

    let origTrack = getOrigTrack(autoTagData.origTrackPath, true);

    if (!origTrack)
        return ret;

    let addAdditionals = prop === 'album';

    let getOrderPriority = function (albumType) {
        if (albumType) {
            let low = albumType.toLowerCase();
            if (low === 'album' || low === 'single' || low === 'ep')
                return 1;
            if (low === 'soundtrack' || low === 'remix')
                return 2;
        }
        return 999;
    }

    let addVal = function (val, date, isOld, albumType, current, source) {
        if (isOld && val.trim() === '')
            val = emptyValue;

        if (typeof date === 'string')
            date = app.utils.myDecodeDate(date);

        let valLower = '';
        if (val)
            valLower = val.toLowerCase();
        if (val && (val.trim() !== '') && (!editorList.some(function (item) {
                let ret = item.valueLower === valLower;
                if (ret) {
                    if (addAdditionals) { // check date and album type
                        if ((item.date > 0) && (item.date !== date)) return false;
                        if (albumType && item.albumType && item.albumType !== albumType) return false;
                    }

                    if ((!item.date || item.date <= 0) && date) item.date = date;
                    item.albumType = albumType;
                    item.albumPriority = getOrderPriority(albumType);
                    if (current)
                        item.current = true;
                }
                return ret;
            }))) {

            if (multiValueFields.indexOf(prop) >= 0)
                val = app.utils.multiString2VisualString(val);
        
            let newval = val + (isOld ? ' <i>(' + _('old value') + ')</i>' : '');
            let dt = date;
            editorList.push({
                isOld: isOld,
                current: current,
                date: dt,
                valueLower: valLower,
                value: newval,
                title: newval,
                albumType: albumType,
                albumPriority: getOrderPriority(albumType),
                source: source,
                toString: function () {
                    return this.title;
                }
            });
        }
    };

    addVal(autoTagData.editedFields[prop], autoTagData.editedFields['date'], false, '', true, autoTagData.editedFields);
    addVal(autoTagData.lookupFields[prop], autoTagData.lookupFields['date'], false, '', true, autoTagData.lookupFields);
    addVal(origTrack[prop], origTrack.date, true, '', false, origTrack);

    if (prop === 'albumArtist') {
        addVal(autoTagData.lookupFields['artist'], autoTagData.lookupFields['date'], false, '', false, autoTagData.lookupFields);
        addVal(autoTagData.editedFields['artist'], autoTagData.editedFields['date'], false, '', false, autoTagData.editedFields);
        addVal(origTrack['artist'], origTrack.date, false, '', false, origTrack);
        addVal(track['artist'], track.date, false, '', true, track);
    }

    let albumArtistFilter = '';
    // PETR: disabled filter for now as we need to update MB server to fill album artist to all releases they send
    /*if ((autoTagData.editedFields.albumArtist !== '') && (prop === 'album')) {
        albumArtistFilter = autoTagData.editedFields.albumArtist;
    }*/

    let lookups = searchManager.getTrackLookups(origTrack.path);
    for (let i = 0; i < lookups.length; i++) {
        let val = lookups[i][prop];
        if ((albumArtistFilter === '') ||
            ((lookups[i].albumArtist && (lookups[i].albumArtist === albumArtistFilter)) ||
                (!lookups[i].albumArtist && (lookups[i].artist === albumArtistFilter)))) {
            addVal(val, lookups[i]['date'], false, lookups[i].albumType, false, lookups[i]);
        }
    }

    if (prop === 'title') {
        let titles = searchManager.getTrackFingerprintTitles(origTrack.path);
        for (let i = 0; i < titles.length; i++) {
            addVal(titles[i]);
        }
    }

    editorList.sort(function (i1, i2) {
        if (i1.isOld)
            return -1;
        if (i2.isOld)
            return 1;
        
        if (i1.albumPriority !== i2.albumPriority)
            return i1.albumPriority - i2.albumPriority;
        if (i1.date < 1)
            return 1;
        else if (i2.date < 1)
            return -1;
        return i1.date - i2.date;
    });
    let itemIndex = -1;
    editorList.forEach(function (data) {
        let val = data.value;
        if (addAdditionals) {
            let additional = '';
            if (data.date > 0)
                additional = app.utils.myEncodeDate(data.date);
            if (data.albumType) {
                if (additional !== '')
                    additional += '  ';
                additional += '<small>' + data.albumType + '</small>';
            }
            if (additional !== '')
                val += '<sup> (' + additional + ')</sup>';
        }

        data.title = val;
        ret.add(data);
        if (data.current)
            itemIndex = ret.count - 1;
    });
    if (prop === 'title')
        ret.add({
            title: moreValueFingerprint,
            toString: function () {
                return this.title;
            }
        });
    else if (prop !== 'albumArtist')
        ret.add({
            title: moreValue,
            toString: function () {
                return this.title;
            }
        });

    ret.focusedIndex = itemIndex;

    return ret;
}

function normalizeValue(value) {
    // remove HTML tags like <i>(old value)</i>
    let tmp = document.createElement("DIV");
    tmp.innerHTML = value;
    value = '';
    for (let i = 0; i < tmp.childNodes.length; i++) {
        if (tmp.childNodes[i].nodeName === '#text') {
            value += tmp.childNodes[i].data;
        }
    }

    // trim left and right
    value = value.trimLeft().trimRight();

    // check empty value
    if (value === emptyValue)
        value = '';
    return value;
}

function getLookup(track, value, type) {

    let path = track.path;
    let fields = autotagFields[path];
    let origTrack = getOrigTrack(fields.origTrackPath);

    if (fields.lookupFields[type] === value) return fields.lookupFields;

    let lookups = searchManager.getTrackLookups(path);
    for (let i = 0; i < lookups.length; i++) {
        if (lookups[i][type] === value)
            return lookups[i];
    }

    if (fields.editedFields[type] === value) return fields.editedFields;
    if (origTrack[type] === value) return origTrack;

    return null;
}

function _applyAlbumValueToTrack(track, value, type, lookup) {

    track[type] = value;

    let otherValue = '';
    let otherField = (type === 'album') ? 'albumArtist' : 'album';
    lookup = lookup || getLookup(track, value, type);
    if (lookup) {
        let fields = autotagFields[track.path];
        fields.editedFields['date'] = '';
        fields.editedFields['year'] = '';
        if (lookup[otherField])
            otherValue = lookup[otherField];
        if (fieldsToUpdate.date) {
            let val = 0;
            if (lookup['date'] !== undefined) {
                val = lookup['date'];
            }
            track.date = val;
        }
        if (fieldsToUpdate.year) {
            let val = -1;
            if (lookup['year'] !== undefined) {
                val = lookup['year'];
            } else
            if (lookup['date'] !== undefined) {
                val = lookup['date'];
                if (val > 10000)
                    val = parseInt(val / 10000);
            }
            track.year = val;
        }

        if (lookup.trackNumber !== undefined) {
            lookup.number = lookup.trackNumber;
        }

        if (lookup.number != '') {

            let trackNums = searchManager.getCurrentTagger().parseTrackNumber(lookup.number);

            if (fieldsToUpdate.trackNum) {
                if (typeof trackNums.number === 'string')
                    track.trackNumber = trackNums.number;
                else
                    track.trackNumberInt = trackNums.number;
            }

            if (fieldsToUpdate.discNum) {
                if (typeof trackNums.disc === 'string')
                    track.discNumber = trackNums.disc;
                else
                    track.discNumberInt = trackNums.disc;
            }
        }
    }
    refreshLV();
    return otherValue;
}

function applyValueToSingleTrack(track, value, type, lookup) {
    return new Promise(function (resolve) {
        value = normalizeValue(value);

        lookup = lookup || getLookup(track, value, type);
        if (lookup) {
            let applyLookup = function (lookup) {
                let fields = autotagFields[track.path];
                fields.editedFields[type] = value;

                if ((type === 'album' || type === 'albumArtist') && (currentColumnsDataType !== FIELD_VIDEO)) {
                    let otherField = (type === 'album') ? 'albumArtist' : 'album';
                    let otherValue = _applyAlbumValueToTrack(track, value, type, lookup);
                    track[otherField] = otherValue;
                    fields.editedFields[otherField] = otherValue;
                    updateLink(track, type, lookup);
                    searchManager.setArtworkLink(track.path, '');
                    notifyRegroupRequired();
                    let list = app.utils.createTracklist(true);
                    list.add(track);
                    searchManager.getCurrentTagger().getArtwork(searchManager, [], list);
                } else {
                    searchManager.getCurrentTagger().applyToTrack(searchManager, fieldsToUpdate, {
                        track: track,
                        locatedTrack: lookup,
                        lookupArtwork: true,
                    });
                    updateLink(track, type, lookup);
                }
                resolve();
            }

            if (lookup.getDetailAsync) {
                lookup.getDetailAsync(track).then(function () {
                    lookup.getDetailAsync = undefined;
                    if (window._cleanUpCalled || !searchManager)
                        return;
                    applyLookup(lookup);
                });
                refreshLV();
            } else
                applyLookup(lookup);
        } else
        if (type === 'title') {
            let tracks = app.utils.createTracklist(true);
            tracks.add(track);
            findMoreForTracks(tracks);
        }
    });
}

function applyValue(group, value, type, lookup) {
    if (!group) return;
    value = normalizeValue(value);
    let tracks = lvTracklist.controlClass.dataSource.getRange(group.index, group.index + (group.itemCount - 1));
    tracks.locked(function () {
        if (currentColumnsDataType === FIELD_VIDEO) {
            let ar = [];
            for (let i = 0; i < tracks.count; i++) {
                ar.push(applyValueToSingleTrack(tracks.getValue(i), value, type, lookup));
            }
            whenAll(ar).then(function () {
                notifyRegroupRequired();
            });

        } else {
            let track;
            let otherValue = '';
            let otherField = (type === 'album') ? 'albumArtist' : 'album';
            let ar = [];

            for (let i = 0; i < tracks.count; i++) {
                let track = tracks.getValue(i);
                let fields = autotagFields[track.path];
                fields.editedFields[type] = value;
                let trackLookup = lookup || getLookup(track, value, type);
                if (trackLookup && trackLookup.getDetailAsync) {
                    ar.push(trackLookup.getDetailAsync(track).then(function () {
                        trackLookup.getDetailAsync = undefined;
                    }));
                }
            }

            whenAll(ar).then(function () {
                tracks.locked(function () {
                    for (let i = 0; i < tracks.count; i++) {
                        track = tracks.getFastObject(i, track);

                        otherValue = _applyAlbumValueToTrack(track, value, type, lookup);

                        track[type] = value;
                        track[otherField] = otherValue;

                        let fields = autotagFields[track.path];
                        fields.editedFields[otherField] = otherValue;

                        updateLink(track, type, lookup);
                        if (i === 0) {
                            if (type === 'album') {
                                searchManager.setArtworkLink(track.path, '');
                            }
                        }
                    }
                    refreshLV();
                    notifyRegroupRequired();
                    searchManager.getCurrentTagger().getArtwork(searchManager, [], tracks);
                });
            });
        }
    });
}

function showCoverWindow(tracks, groupID) {

    if (!autotagFields[groupID]) return;

    let track = null;
    tracks.locked(() => {
        track = tracks.getValue(0);
    });
    track.getThumbAsync(0, 0, function (mainCover) {
        //let mainCover = track.getCachedThumb(500, 500);
        let lookupCover = searchManager.getArtworkLink(track.path);
        let useLookup = autotagFields[groupID].showLookupCover && (!!lookupCover);
        let originalState = track.autoTagState;
        if (!lookupCover || (mainCover.length < 2)) {

            searchTools.searchImageDlg({
                callback: function (imgPath, isInTemp) {
                    if (imgPath && !window._cleanUpCalled)
                        autotagFields[groupID].showLookupCover = true;

                    tracks.locked(() => {
                        let track;
                        for (let i = 0; i < tracks.count; i++) {
                            track = tracks.getFastObject(i, track);
                            track.autoTagState = originalState;
                            if (imgPath && !window._cleanUpCalled) {
                                searchManager.setArtworkLink(track.path, imgPath);
                            }
                        }
                    });
                    refreshLV();
                },
                beforeImageDownload: function (imgPath) {
                    originalState = track.autoTagState;
                    track.autoTagState = AT_STATE_LOADING_ARTWORK;
                    refreshLV();
                },
                searchTerm1: track.albumArtist || track.artist,
                searchTerm2: track.album || track.title,
                noDefaultIcon: true,
                noGenerated: true,
                searchScript: 'helpers\\aaSearch.js'
            });


        } else {
            let wnd = uitools.openDialog('dlgAutotagCover', {
                show: true,
                modal: true,
                track: track,
                origCover: mainCover,
                lookupCover: lookupCover,
                useLookup: useLookup
            });
            wnd.closed = function () {
                app.unlisten(wnd, 'closed', wnd.closed);

                if (wnd.modalResult === 1) {
                    let data = wnd.getValue('getCover')();
                    autotagFields[groupID].showLookupCover = !data.useOriginal;
                    autotagFields[groupID].forceOriginal = data.useOriginal;
                    tracks.locked(() => {
                        let track;
                        for (let i = 0; i < tracks.count; i++) {
                            track = tracks.getFastObject(i, track);
                            searchManager.setArtworkLink(track.path, data.lookupCover);
                        }
                    });
                    refreshLV();
                }
            };
            app.listen(wnd, 'closed', wnd.closed);
        }
    });
}

function albumGroupTemplate(div) {

    div.prepareValues = function (track) {
        if (track && autotagFields[track.path]) {
            let origTrack = getOrigTrack(autotagFields[track.path].origTrackPath);
            track.lookupalbum = autotagFields[track.path].lookupFields.album;
            track.origalbum = origTrack.album;
            track.lookupalbumArtist = autotagFields[track.path].lookupFields.artist;
            track.origalbumArtist = origTrack.albumArtist;
        }
        return track;
    };

    div.fillList = fillList;
    div.bindField = bindField;
    div.ArtworkProgressUpdate = function (div, group) {

        let tracks = div.parentListView.dataSource.getRange(group.index, group.index + (group.itemCount - 1));
        div._coverSearchInProgress = false;
        tracks.locked(function () {
            let track;
            for (let i = 0; i < tracks.count; i++) {
                track = tracks.getFastObject(i, track);
                if (track.autoTagState === AT_STATE_LOADING_ARTWORK) {
                    if (!coverLookups[track.path])
                        div._coverSearchInProgress = true;
                    break;
                }
            }
        });
        if (div._coverSearchInProgress) {
            if (!div._coverProgress) {
                div._coverProgress = document.createElement('div');
                div._coverProgress.classList.add('fill');
                div.coverContainer.appendChild(div._coverProgress);
                loadIcon('progress', function (data) {
                    if (div._coverProgress)
                        div._coverProgress.innerHTML = data;
                });
            }
        } else {
            if (div._coverProgress) {
                div._coverProgress.remove();
                div._coverProgress = undefined;
            }
        }
    }

    templates.groupedTracklistByAlbum(div, {
        imgBind: function () {
            return 'func: ' +
                'let group = div.parentListView.dataSource.getGroupByID(div._groupID); let idx = group.index; ' +
                'div.ArtworkProgressUpdate(div, group);' +
                'if (!div._lookupMark) { ' +
                '  div._lookupMark = document.createElement(\'div\'); ' +
                '  div._lookupMark.classList.add(\'lookupFieldCover\'); ' +
                '  div.coverContainer.appendChild(div._lookupMark); ' +
                '} ' +
                'let showMark = false; ' +
                'let track = div.prepareValues(div.parentListView.dataSource.getValue(idx)); ' +
                'let params = { useCoverImage: true, defaultPixelSize: 500, notUseCache: false, addContext: true, addShowFullSizeMenu: true }; ' +
                'let path = track.getCachedThumb(params.defaultPixelSize, params.defaultPixelSize); ' +
                'let origTrack = getOrigTrack(track.path); ' +
                'let albumChanged = (track.album !== origTrack.album) || (track.albumArtist !== origTrack.albumArtist) || (track.isVideo) || !!autotagCoverChanged[track.path]; ' +
                'let showLookupCover = true; ' +
                'let forceOriginal = false; ' +
                'if(div._sourceLabel) { div._sourceLabel.remove(); div._sourceLabel = undefined;}' + 
                'autotagCoverChanged[track.path] = false; '+
                'if (autotagFields[div._groupID] && !track.isVideo) { ' +
                '  showLookupCover = autotagFields[div._groupID].showLookupCover; ' +
                '  forceOriginal = autotagFields[div._groupID].forceOriginal; ' +
                '} ' +
                'if ((showLookupCover) || (path.length <= 1) || (albumChanged && !forceOriginal)) { ' +
                '  if (autotagFields[div._groupID]) autotagFields[div._groupID].showLookupCover = true; ' +
                '  let imagePath = searchManager.getArtworkLink(track.path); ' +
                '  params.imagePath = imagePath; ' +
                '  showMark = !!imagePath; ' +
                '  if(showMark) {' +
                '    let imageSrcObj = searchManager.getSourceInfo(track.path); ' +
                '    if (imageSrcObj && imageSrcObj.source) { ' +
                '      div._sourceLabel = document.createElement(\'label\'); ' +
                '      div.coverContainer.appendChild(div._sourceLabel);' +
                '      div._sourceLabel.classList.add(\'sizeLabel\'); ' +
                '      div._sourceLabel.setAttribute(\'data-tip\',\'' + _('Data provided by') + ' ' + '\' + imageSrcObj.source); ' +
                '      if(imageSrcObj.sourceUrl) {' + 
                '        div._sourceLabel.classList.add(\'clickable\'); ' +
                '        div._sourceLabel.setAttribute(\'onclick\', \'event.stopPropagation(); app.utils.web.openURL(\\\'\' + imageSrcObj.sourceUrl + \'\\\');\'); ' + 
                '      };' +
                '      div._sourceLabel.innerText = imageSrcObj.source' +
                '    };' +
                '  }; ' +
                '} ' +
                ' if (isVisible(div._lookupMark) !== showMark) ' +
                '   setVisibility(div._lookupMark, showMark); ' +
                'templates.itemImageFunc(div, track, div.itemIndex, params);';
        },
        detailsCreate: function (div, details) {

            let fillFunc = function (type) {
                return 'func: let group = div.parentListView.dataSource.getGroupByID(div._groupID); ' +
                    ' let track = div.parentListView.dataSource.getValue(group.index); div.item = track; ' +
                    ' el.controlClass.value = track.' + type + '; ' +
                    ' el.controlClass.group = group; ';
            }

            let bindFunc = function (type) {
                return 'func: let group = div.parentListView.dataSource.getGroupByID(div._groupID); let idx = group.index; let track = div.prepareValues(div.parentListView.dataSource.getValue(idx)); div.item = track; ' +
                    ' if (\'' + type + '\' === \'album\') div.ArtworkProgressUpdate(div, group); ' +
                    ' div.bindField(el, track, idx, \'' + type + '\');';
            }

            details.innerHTML =
                '<div class="paddingTop paddingBottom">Album:</div> ' +
                '<div class="textEllipsis" data-id="lblAlbum" data-bind="' + bindFunc('album') + '"></div> ' +
                '<div class="textEllipsis" data-id="cbAlbum" data-control-class="Dropdown" data-init-params="{autoConfirm: true, removeHTMLTags: true, textOnly: false}" style="display: none" data-bind="' + fillFunc('album') + '"></div> ' +
                '<div class="paddingTop paddingBottom marginTop">Album Artist:</div> ' +
                '<div class="textEllipsis" data-id="lblAlbumArtist" data-bind="' + bindFunc('albumArtist') + '"></div> ' +
                '<div class="textEllipsis" data-id="cbAlbumArtist" data-control-class="Edit" data-init-params="{type: \'text\'}" style="display: none" data-bind="' + fillFunc('albumArtist') + '"></div> ';

            div.lblAlbum = qeid(div, 'lblAlbum');
            div.lblAlbumArtist = qeid(div, 'lblAlbumArtist');
            div.cbAlbum = qeid(div, 'cbAlbum');
            div.cbAlbumArtist = qeid(div, 'cbAlbumArtist');
            if(div.coverContainer) {
                div.coverContainer.controlClass.addCleanFunc(function () {
                    div.lblAlbum = undefined;
                    div.lblAlbumArtist = undefined;
                    div.cbAlbum = undefined;
                    div.cbAlbumArtist = undefined;
                });
            };
        }
    });

    window.localListen(div.coverContainer, 'click', function () {
        let group = div.parentListView.dataSource.getGroupByID(div._groupID);
        if (!group)
            return;
        let idx = group.index;
        let cnt = group.itemCount;
        let lst = div.parentListView.dataSource.getRange(idx, idx + (cnt - 1));
        lst.locked(() => {
            for (let i = 0; i < lst.count; i++) {
                div.prepareValues(lst.getValue(i));
            }
        });
        showCoverWindow(lst, div._groupID);
    });

    function lowerFirstLetter(string) {
        return string.charAt(0).toLowerCase() + string.slice(1);
    }

    let showHideCombo = function (comboName, show) {
        if (window._cleanUpCalled)
            return;

        if (!isChildOf(document.body, div['lbl' + comboName]) ||
            !isChildOf(document.body, div['cb' + comboName]))
            return;

        setVisibility(div['lbl' + comboName], !show);
        setVisibility(div['cb' + comboName], show);
        let cb = div['cb' + comboName];
        editing = show;
        div.parentListView.enableIncrementalSearch = !show;
        if (cb.controlClass.openDropdown !== undefined) {
            if (show) {
                cb.controlClass.textOnly = false;
                cb.controlClass.dataSource = div.fillList(cb.controlClass.group.index, lowerFirstLetter(comboName));
                window.openDropdownPopup({
                    wnd: cb.controlClass,
                    control: cb,
                    width: cb.offsetWidth,
                    filter: '',
                    preserveFocus: true // required otherwise dropdown will reset focusedIndex and can set wrong index!
                });

            } else {
                if (cb.controlClass.isDropdownOpen())
                    cb.controlClass.closeDropdown();
            }
        } else {
            cb.controlClass.select();
            cb.controlClass.focus();
        }
        if (!show) {
            app.unlisten(cb, 'change');
        }
    }

    window.localListen(div.lblAlbum, 'click', function () {
        let group = div.cbAlbum.controlClass.group;

        let itemClass = {
            getValue: function (item) {
                return div.lblAlbum.innerText;
            },
            setValue: function (item, newValue, raw, index, sender) {
                if (isMore(newValue)) {
                    handleMore(-1, -1, true);
                    return true;
                }

                let lookup = getSelectedLookup();
                newValue = normalizeValue(newValue);

                if (newValue !== div.lblAlbum.innerText) {
                    applyValue(group, newValue, 'album', lookup.source);
                    div.lblAlbum.innerText = newValue;
                    notifyRegroupRequired();
                }
                return true; // don't save
            },
            editor: editors.gridViewEditors.multiValueEdit,
            editorParams: '{readOnly: false, multivalue: false, filtering: false, expanded: true, autoConfirm: true, removeHTMLTags: true, textOnly: false}',
            editorFocusChange: handleMore,
            editorData: function (params) {
                return fillList(group.index, 'album');
            },
            beforePosition: function () {
                itemClass.editline.controlClass.calcAutoWidth();
                div.lblAlbum.style.minWidth = itemClass.editline.controlClass.edit.style.width;
            },
            listview: new window['Control'](div.lblAlbum)
        };
        itemClass.listview.editSave = function () {
            window.editors.gridViewEditors.multiValueEdit.call(itemClass, 'save', div.lblAlbum, group);
        };
        itemClass.listview.editCancel = function () {
            window.editors.gridViewEditors.multiValueEdit.call(itemClass, 'cancel', div.lblAlbum, group);
        };
        itemClass.listview.setFocus = function () {

        };
        window.editors.gridViewEditors.multiValueEdit.call(itemClass, 'edit', div.lblAlbum, group);
        itemClass.editline.controlClass.openDropdown();
    });

    window.localListen(div.lblAlbumArtist, 'click', function () {
        showHideCombo('AlbumArtist', true);
        app.listen(div.cbAlbumArtist, 'change', function () {
            if (isVisible(div.cbAlbumArtist)) {
                let group = div.cbAlbumArtist.controlClass.group;
                let value = normalizeValue(div.cbAlbumArtist.controlClass.value);
                if (value !== div.lblAlbumArtist.innerText) {
                    div.lblAlbumArtist.innerText = value;
                    let tracks = div.parentListView.dataSource.getRange(group.index, group.index + (group.itemCount - 1));
                    tracks.locked(function () {
                        let track;
                        for (let i = 0; i < tracks.count; i++) {
                            track = tracks.getFastObject(i, track);

                            if (track.albumArtist !== value) {
                                track.albumArtist = value;
                                autotagFields[track.path].editedFields.albumArtist = value;
                            }
                        }
                    });
                    showHideCombo('albumArtist', false);
                    refreshLV();
                    notifyRegroupRequired();
                }
            }
        });
    });

    window.localListen(window, 'focusin', function (e) {
        if (isVisible(div.cbAlbum) && !isChildOf(div.cbAlbum, e.target)) {
            requestTimeout(function () { // do not hide combo imediatelly, otherwise value picked from popup will not be applied in 'change' event
                showHideCombo('Album', false);
            }, 100);
        }
    });

    window.localListen(div.cbAlbum, 'popupclosed', function () {
        requestTimeout(function () { // do not hide combo imediatelly, otherwise value picked from popup will not be applied in 'change' event
            showHideCombo('Album', false);
        }, 200);
    });
    window.localListen(div.cbAlbumArtist, 'focusout', function () {
        requestTimeout(function () {
            showHideCombo('AlbumArtist', false);
        }, 100);
    });



    window.localListen(div.cbAlbumArtist, 'keydown', function (e) {
        let key = friendlyKeyName(e);
        if (key === 'Enter')
            div.cbAlbumArtist.controlClass.blur();

    });

};

function initLVTracklist() {

    lvTracklist = qid('lvTracksList');
    lvTracklist.controlClass.showHeader = true;
    lvTracklist.controlClass.isSortable = false;
    lvTracklist.controlClass.highlightPlayingTrack = false;
    lvTracklist.controlClass.disableAlbumTracksLimit = true;
    let tracks = app.utils.createTracklist(true /* loaded */ );
    tracks.autoUpdateDisabled = true; // #15938
    lvTracklist.controlClass.dataSource = tracks;
    lvTracklist.controlClass._completeRestore = false;
    lvTracklist.controlClass.singleClickEdit = true;

    lvTracklist.controlClass.groupHeaderDef[0].title = _('Artwork');
    lvTracklist.controlClass.groupHeaderDef[1].title = _('Summary');
    lvTracklist.controlClass.groupHeaderDef[1].fixed = true;

    lvTracklist.controlClass.forceDisableCustomSort = true;
    lvTracklist.controlClass.customChooseColumnsTitle = _('Choose fields');


    window.localListen(lvTracklist, 'checkedchanged', onTracksViewChecked);
    window.localListen(app, 'settingschange', function () {
        fieldsToUpdate = searchManager.getFieldsToUpdate(currentColumnsDataType !== FIELD_VIDEO);
    });
}

function findMoreForTracks(tracks, preferFingerprint) {
    return new Promise(function (resolve) {
        findMoreProcessing = true;
        showProgress();
        lvTracklist.controlClass.disabled = true;

        searchManager.searchMoreByTracks(tracks, preferFingerprint).then(function (res) {
            if (window._cleanUpCalled)
                return;
            hideProgress();
            lvTracklist.controlClass.disabled = false;
            findMoreProcessing = false;

            resolve(res);
        });
    });
}

function loadMore(group, preferFingerprint, isFromEditor) {
    return new Promise(function (resolve) {
        let tracks = null;
        if (group) {
            tracks = lvTracklist.controlClass.dataSource.getRange(group.index, group.index + group.itemCount);
        } else {
            let focused = lvTracklist.controlClass.focusedIndex;
            if (isFromEditor && (focused >= 0))
                tracks = lvTracklist.controlClass.dataSource.getRange(focused, focused);
            else
                tracks = searchManager.getTracks();
        }

        requestAnimationFrame(function () {
            if (!window._cleanUpCalled && tracks)
                findMoreForTracks(tracks, preferFingerprint).then(function () {
                    if (tracks.count == 1) { // make track focused
                        tracks.locked(() => {
                            let track = tracks.getValue(0);
                            if (track) {
                                let idx = lvTracklist.controlClass.dataSource.indexOf(track);
                                if (idx >= 0) {
                                    lvTracklist.controlClass.dataSource.focusedIndex = idx;
                                    lvTracklist.controlClass.setItemFullyVisible(idx, true);
                                }
                            }

                        });
                    }
                    if (!group && isFromEditor) {
                        lvTracklist.controlClass._openEditorAfterRefreshIdx = lvTracklist.controlClass.dataSource.focusedIndex;
                        lvTracklist.controlClass._openEditorAfterRefresh = true;
                    }
                    resolve();
                });
        }.bind(this));
    });
}

function handleMore(index, oldIndex, force, group, preferFingerprint) {

    let cb = window.getCurrentEditor();

    let moreSelected = force || (cb && cb.controlClass && (index === cb.controlClass.dataSource.count - 1));

    if (moreSelected) {
        if (!force && cb && cb.controlClass && cb.controlClass.dataSource) {
            // check 'find more' is supported
            cb.controlClass.dataSource.locked(() => {
                let val = cb.controlClass.dataSource.getValue(cb.controlClass.dataSource.count - 1);
                if ((val.title !== moreValue) && (val.title !== moreValueFingerprint))
                    moreSelected = false;
            });
        }

        if (moreSelected) {

            if (cb && cb.controlClass && cb.controlClass.dataSource && cb.controlClass.dataSource.count > 1) { // set first value
                cb.controlClass.dataSource.locked(function () {
                    cb.controlClass.value = cb.controlClass.dataSource.getValue(0).title;
                });
            }
            requestAnimationFrame(function () {
                loadMore(group, preferFingerprint, true).then(function () {});
            }.bind(this));
        }
        if (cb && cb.controlClass && cb.controlClass.closeDropdown && cb.controlClass.isDropdownOpen())
            cb.controlClass.closeDropdown();
        lvTracklist.controlClass.editCancel();
    }
}

function getSelectedLookup() {
    let lookup = {};
    let editor = getCurrentEditor();
    if (editor && editor.controlClass && editor.controlClass.dataSource) {
        lookup = editor.controlClass.dataSource.focusedItem;
    }
    if (!lookup)
        lookup = {};
    return lookup;
}

function setColorAttribute(div, enabled) {
    if (!enabled)
        div.setAttribute('data-disabled', '1');
    else
        div.removeAttribute('data-disabled');
}

function notifyChanged(groupChanged) {
    if (groupChanged) {
        notifyRegroupRequired();
    }
}

function saveColumnsOrder() {
    let orderList = fieldsToUpdate._order.split(';');
    let cols = lvTracklist.controlClass.visibleColumns;

    let newAr = [];

    cols.forEach(function (item, idx) {
        if (item.columnType) {
            // find fieldID
            let found = columns.find(function (itm) {
                return itm.columnType == item.columnType;
            });
            if (found && found.fieldID && (orderList.indexOf(found.fieldID) >= 0)) {
                newAr.push(found.fieldID);
            }
        }
    });

    let order = newAr.join(';');
    let data = JSON.parse(app.utils.web.getAutoTagFieldsChecks());
    if (currentColumnsDataType == 0) {
        data.audio._order = order;
    } else if (currentColumnsDataType == 1) {
        data.video._order = order;
    }
    app.utils.web.setAutoTagFieldsChecks(JSON.stringify(data));
}

function addColumns(dataType /* 0 - music, 1 - video, 2 - mixed */ ) {

    currentColumnsDataType = dataType;
    fieldsToUpdate = searchManager.getFieldsToUpdate(currentColumnsDataType !== FIELD_VIDEO);
    let additionals = searchManager.addAdditional();

    let orderList = fieldsToUpdate._order.split(';');
    let lastColIdx = orderList.length + 100;

    let getColumnOrder = function (colID) {
        let idx = orderList.indexOf(colID);
        if (idx >= 0)
            return (idx + 10);
        return lastColIdx++;
    }

    columns.push({
        columnType: 'check',
        title: '',
        width: 30,
        minWidth: 30,
        fixed: true,
        order: 1,
        headerRenderer: ColumnTrackList.prototype.headerRenderers.renderCheck,
        setupCell: function (div, column) {
            ColumnTrackList.prototype.cellSetups.setupCheckbox(div, column);
        },
        bindData: function (div, item, index) {
            ColumnTrackList.prototype.defaultBinds.bindCheckboxCell(div, item, index);
        },
        visible: true,
        adaptableSize: false,
    });
    columns.push({
        columnType: 'order',
        title: _('Track #'),
        width: 20,
        order: getColumnOrder('trackNum'),
        setValue: function (item, newValue, raw, index) {
            if (item.isVideo) {
                if (item.episodeNumber !== newValue) {
                    item.episodeNumber = newValue;
                    autotagFields[item.path].editedFields.trackNumber = newValue;
                    notifyChanged();
                }
            } else {
                if (item.trackNumber !== newValue) {
                    item.trackNumber = newValue;
                    autotagFields[item.path].editedFields.trackNumber = newValue;
                    notifyChanged();
                }
            }
            return true; // don't save
        },
        getValue: function (item) {
            if (item.isVideo)
                return item.episodeNumber;
            else
                return item.trackNumber;
        },
        editor: editors.gridViewEditors.textEdit,
        bindData: function (div, item, index) {
            setColorAttribute(div, fieldsToUpdate.trackNum);
            if (item.isVideo)
                bindField(div, item, index, 'episodeNumber');
            else
                bindField(div, item, index, 'trackNumber');
        },
        fieldID: 'trackNum',
        visible: fieldsToUpdate.trackNum,
    });
    columns.push({
        columnType: 'discNo',
        title: _('Disc #'),
        width: 20,
        order: getColumnOrder('discNum'),
        setValue: function (item, newValue, raw, index) {
            if (item.isVideo) {
                if (item.seasonNumber !== newValue) {
                    item.seasonNumber = newValue;
                    autotagFields[item.path].editedFields.discNumber = newValue;
                    notifyChanged();
                }
            } else {
                if (item.discNumber !== newValue) {
                    item.discNumber = newValue;
                    autotagFields[item.path].editedFields.discNumber = newValue;
                    notifyChanged();
                }
            }
            return true; // don't save
        },
        getValue: function (item) {
            if (item.isVideo)
                return item.seasonNumber;
            else
                return item.discNumber;
        },
        editor: editors.gridViewEditors.textEdit,
        bindData: function (div, item, index) {
            setColorAttribute(div, fieldsToUpdate.discNum);
            if (item.isVideo)
                bindField(div, item, index, 'seasonNumber');
            else
                bindField(div, item, index, 'discNumber');
        },
        fieldID: 'discNum',
        visible: fieldsToUpdate.discNum,
    });
    columns.push({
        columnType: 'title',
        title: _('Title'),
        width: 50,
        order: getColumnOrder('title'),

        setupCell: function (div, column) {
            ColumnTrackList.prototype.cellSetups.setupDefault(div, column);
            let content = document.createElement('div');
            div.contentCtrl = content;
            div.appendChild(content);
        },

        getValue: function (item) {
            return item.title;
        },
        setValue: function (item, newValue, raw, index) {
            if (isMore(newValue)) {
                handleMore(-1, -1, true, undefined, true /* prefer fingerprinting */ );
                return true;
            }
            newValue = normalizeValue(newValue);
            if (item.title !== newValue) {
                item.title = newValue;
                autotagFields[item.path].editedFields.title = newValue;
                lvTracklist.controlClass.rebind();
                loadMore(undefined, false, true).then(function () {
                    if (this.dataSource && (dataType !== 1)) {
                        let albs = fillList(this.dataSource.indexOf(item), 'album');
                        if (albs && albs.count > 1) {
                            albs.locked(function () {
                                let album = normalizeValue(albs.getValue(0));
                                item.album = album;
                                updateLink(item, 'album');
                                applyValueToSingleTrack(item, album, 'album');
                                notifyChanged();
                            });
                        }
                    }
                }.bind(this));
            }
            return true; // don't save
        },
        editor: editors.gridViewEditors.multiValueEdit,
        editorParams: '{readOnly: false, multivalue: false, filtering: false, expanded: true, autoConfirm: true, removeHTMLTags: true, textOnly: false}',
        editorData: function (params) {
            return fillList(params.itemIndex, 'title');
        },
        editorFocusChange: function (index, oldIndex) {
            handleMore(index, oldIndex, false, undefined, true /* prefer fingerprinting */ );
        },
        bindData: function (div, item, index) {
            setColorAttribute(div, fieldsToUpdate.title);
            bindField(div, item, index, 'title');
        },
        fieldID: 'title',
        visible: fieldsToUpdate.title,
    });
    columns.push({
        columnType: 'artist',
        title: _('Artist'),
        width: 50,
        order: getColumnOrder('artist'),
        getValue: function (item) {
            return app.utils.multiString2VisualString(item.artist);
        },
        setValue: function (item, newValue, raw, index) {
            if (isMore(newValue)) {
                handleMore(-1, -1, true);
                return true;
            }
            newValue = normalizeValue(newValue);
            if (item.artist !== newValue) {
                item.artist = newValue;
                updateLink(item, 'artist');
                autotagFields[item.path].editedFields.artist = newValue;
                notifyChanged();
            }
            return true; // don't save
        },
        editor: editors.gridViewEditors.multiValueEdit,
        editorParams: '{readOnly: false, multivalue: false, filtering: false, expanded: true, autoConfirm: true, removeHTMLTags: true, textOnly: false}',
        editorFocusChange: handleMore,
        editorData: function (params) {
            return fillList(params.itemIndex, 'artist');
        },
        bindData: function (div, item, index) {
            setColorAttribute(div, fieldsToUpdate.artist);
            bindField(div, item, index, 'artist');
        },
        fieldID: 'artist',
        fieldFilter: dataType !== FIELD_VIDEO,
        visible: fieldsToUpdate.artist && (dataType !== FIELD_VIDEO),
    });
    columns.push({
        columnType: 'album',
        title: _('Album'),
        width: 50,
        order: getColumnOrder('album'),
        getValue: function (item) {
            return item.album;
        },
        setValue: function (item, newValue, raw, index, sender) {
            if (isMore(newValue)) {
                handleMore(-1, -1, true);
                return true;
            }

            let lookup = getSelectedLookup();
            newValue = normalizeValue(newValue);

            let same = item.album === newValue;
            if (same && lookup && lookup.date) {
                same = item.date === lookup.date;
            }

            if (!same) {
                item.album = newValue;
                applyValueToSingleTrack(item, newValue, 'album', lookup.source);
                notifyChanged(true);
            }
            return true; // don't save
        },
        editor: editors.gridViewEditors.multiValueEdit,
        editorParams: '{readOnly: false, multivalue: false, filtering: false, expanded: true, autoConfirm: true, removeHTMLTags: true, textOnly: false}',
        editorFocusChange: handleMore,
        editorData: function (params) {
            return fillList(params.itemIndex, 'album');
        },
        bindData: function (div, item, index) {
            setColorAttribute(div, fieldsToUpdate.album);
            bindField(div, item, index, 'album');
        },
        fieldID: 'album',
        fieldFilter: dataType !== FIELD_VIDEO,
        visible: fieldsToUpdate.album && (dataType !== FIELD_VIDEO),
    });
    columns.push({
        columnType: 'albumArtist',
        title: _('Album Artist'),
        width: 50,
        order: getColumnOrder('albumArtist'),
        getValue: function (item) {
            return app.utils.multiString2VisualString(item.albumArtist);
        },
        setValue: function (item, newValue, raw, index) {
            newValue = normalizeValue(newValue);
            if (item.albumArtist !== newValue) {
                item.albumArtist = newValue;
                autotagFields[item.path].editedFields.albumArtist = newValue;
                notifyChanged(true);
            }
            return true; // don't save
        },
        editor: editors.gridViewEditors.multiValueEdit,
        editorParams: '{readOnly: false, multivalue: false, filtering: false, expanded: true, autoConfirm: true, removeHTMLTags: true, textOnly: false}',
        editorData: function (params) {
            return fillList(params.itemIndex, 'albumArtist');
        },
        //editor: editors.gridViewEditors.textEdit,
        bindData: function (div, item, index) {
            setColorAttribute(div, fieldsToUpdate.album);
            bindField(div, item, index, 'albumArtist');
        },
        fieldID: 'albumArtist',
        fieldFilter: dataType !== FIELD_VIDEO,
        visible: fieldsToUpdate.album && (dataType !== FIELD_VIDEO),
    });
    columns.push({
        columnType: 'genre',
        title: _('Genre'),
        width: 50,
        order: getColumnOrder('genre'),
        getValue: function (item) {
            return app.utils.multiString2VisualString(item.genre);
        },
        setValue: function (item, newValue, raw, index) {
            newValue = normalizeValue(newValue);
            if (item.genre !== newValue) {
                trackGenreAddonsCache[item.path] = '';
                item.genre = newValue;
                autotagFields[item.path].editedFields.genre = newValue;
                notifyChanged();
            }
            return true; // don't save
        },
        editor: editors.gridViewEditors.multiValueEdit,
        editorParams: '{filtering: false, checkboxes: true, expanded: true, textOnly: false}',
        editorData: function (params) {
            let ret = newStringList(true);
            let sep = ';';
            ret.separator = sep;
            if (params.item.genre)
                ret.text = params.item.genre;
            let mbTrack = searchManager.getCurrentTrackLookup(params.item.path);
            if (mbTrack && mbTrack.genre) {
                ret.text += sep + mbTrack.genre;
            }
            ret.removeDuplicates();
            return ret;
        },
        bindData: function (div, item, index) {
            setColorAttribute(div, fieldsToUpdate.genre);
            bindField(div, item, index, 'genre');
        },
        fieldID: 'genre',
        fieldFilter: dataType !== FIELD_VIDEO,
        visible: fieldsToUpdate.genre && (dataType !== FIELD_VIDEO),
    });
    columns.push({
        columnType: 'actors',
        title: _('Actors'),
        getValue: function (item, raw) {
            return app.utils.multiString2VisualString(item.actors);
        },
        setValue: function (item, newValue, raw, index) {
            if (isMore(newValue)) {
                handleMore(-1, -1, true);
                return true;
            }
            newValue = normalizeValue(newValue);
            if (item.actors !== newValue) {
                item.actors = newValue;
                autotagFields[item.path].editedFields.actors = newValue;
                notifyChanged();
            }
            return true; // don't save
        },
        editor: editors.gridViewEditors.multiValueEdit,
        editorParams: '{readOnly: false, filtering: false, expanded: true, autoConfirm: true, removeHTMLTags: true, textOnly: false}',
        editorData: function (params) {
            return fillList(params.itemIndex, 'actors');
        },
        editorFocusChange: handleMore,
        bindData: function (div, item, index) {
            setColorAttribute(div, fieldsToUpdate.actors);
            bindField(div, item, index, 'actors');
        },
        width: 50,
        order: getColumnOrder('actors'),
        fieldID: 'actors',
        fieldFilter: dataType !== FIELD_AUDIO,
        visible: fieldsToUpdate.actors && (dataType !== FIELD_AUDIO),
    });
    columns.push({
        columnType: 'publisher',
        title: _('Publisher'),
        getValue: function (item, raw) {
            return app.utils.multiString2VisualString(item.publisher);
        },
        setValue: function (item, newValue, raw, index) {
            if (isMore(newValue)) {
                handleMore(-1, -1, true);
                return true;
            }
            newValue = normalizeValue(newValue);
            if (item.publisher !== newValue) {
                item.publisher = newValue;
                autotagFields[item.path].editedFields.publisher = newValue;
                notifyChanged();
            }
            return true; // don't save
        },
        editor: editors.gridViewEditors.multiValueEdit,
        editorParams: '{readOnly: false, filtering: false, expanded: true, autoConfirm: true, removeHTMLTags: true, textOnly: false}',
        editorData: function (params) {
            return fillList(params.itemIndex, 'publisher');
        },
        editorFocusChange: handleMore,
        bindData: function (div, item, index) {
            setColorAttribute(div, fieldsToUpdate.publisher);
            bindField(div, item, index, 'publisher');
        },
        width: 50,
        order: getColumnOrder('publisher'),
        fieldID: 'publisher',
        visible: fieldsToUpdate.publisher,
    });
    columns.push({
        columnType: 'director',
        title: _('Director'),
        getValue: function (item, raw) {
            return app.utils.multiString2VisualString(item.director);
        },
        setValue: function (item, newValue, raw, index) {
            if (isMore(newValue)) {
                handleMore(-1, -1, true);
                return true;
            }
            newValue = normalizeValue(newValue);
            if (item.director !== newValue) {
                item.director = newValue;
                autotagFields[item.path].editedFields.director = newValue;
                notifyChanged();
            }
            return true; // don't save
        },
        editor: editors.gridViewEditors.multiValueEdit,
        editorParams: '{readOnly: false, filtering: false, expanded: true, autoConfirm: true, removeHTMLTags: true, textOnly: false}',
        editorData: function (params) {
            return fillList(params.itemIndex, 'director');
        },
        editorFocusChange: handleMore,
        bindData: function (div, item, index) {
            setColorAttribute(div, fieldsToUpdate.director);
            bindField(div, item, index, 'director');
        },
        width: 50,
        order: getColumnOrder('director'),
        fieldID: 'director',
        fieldFilter: dataType !== FIELD_AUDIO,
        visible: fieldsToUpdate.director && (dataType !== FIELD_AUDIO),
    });
    columns.push({
        columnType: 'producer',
        title: _('Producer'),
        getValue: function (item, raw) {
            return app.utils.multiString2VisualString(item.producer);
        },
        setValue: function (item, newValue, raw, index) {
            if (isMore(newValue)) {
                handleMore(-1, -1, true);
                return true;
            }
            newValue = normalizeValue(newValue);
            if (item.producer !== newValue) {
                item.producer = newValue;
                autotagFields[item.path].editedFields.producer = newValue;
                notifyChanged();
            }
            return true; // don't save
        },
        editor: editors.gridViewEditors.multiValueEdit,
        editorParams: '{readOnly: false, filtering: false, expanded: true, autoConfirm: true, removeHTMLTags: true, textOnly: false}',
        editorFocusChange: handleMore,
        editorData: function (params) {
            return fillList(params.itemIndex, 'producer');
        },
        bindData: function (div, item, index) {
            setColorAttribute(div, fieldsToUpdate.producer);
            bindField(div, item, index, 'producer');
        },
        width: 50,
        order: getColumnOrder('producer'),
        fieldID: 'producer',
        visible: fieldsToUpdate.producer,
    });
    columns.push({
        columnType: 'lyricist',
        title: _('Lyricist'),
        getValue: function (item, raw) {
            return item.lyricist;
        },
        setValue: function (item, newValue, raw, index) {
            if (isMore(newValue)) {
                handleMore(-1, -1, true);
                return true;
            }
            newValue = normalizeValue(newValue);
            if (item.lyricist !== newValue) {
                item.lyricist = newValue;
                autotagFields[item.path].editedFields.lyricist = newValue;
                notifyChanged();
            }
            return true; // don't save
        },
        editor: editors.gridViewEditors.multiValueEdit,
        editorParams: '{readOnly: false, filtering: false, expanded: true, autoConfirm: true, removeHTMLTags: true, textOnly: false}',
        editorData: function (params) {
            return c(params.itemIndex, 'lyricist');
        },
        editorFocusChange: handleMore,
        bindData: function (div, item, index) {
            setColorAttribute(div, fieldsToUpdate.writer);
            bindField(div, item, index, 'lyricist');
        },
        width: 50,
        order: getColumnOrder('writer'),
        fieldID: 'writer',
        visible: fieldsToUpdate.writer,
    });
    columns.push({
        columnType: 'parental',
        title: _('Parental Rating'),
        getValue: function (item, raw) {
            return item.parentalRating;
        },
        setValue: function (item, newValue, raw, index) {
            if (isMore(newValue)) {
                handleMore(-1, -1, true);
                return true;
            }
            newValue = normalizeValue(newValue);
            if (item.parentalRating !== newValue) {
                item.parentalRating = newValue;
                autotagFields[item.path].editedFields.parentalRating = newValue;
                notifyChanged();
            }
            return true; // don't save
        },
        editor: editors.gridViewEditors.multiValueEdit,
        editorParams: '{readOnly: false, filtering: false, expanded: true, autoConfirm: true, removeHTMLTags: true, textOnly: false}',
        editorFocusChange: handleMore,
        editorData: function (params) {
            return fillList(params.itemIndex, 'parentalRating');
        },
        bindData: function (div, item, index) {
            setColorAttribute(div, fieldsToUpdate.parentalRating);
            bindField(div, item, index, 'parentalRating');
        },
        width: 50,
        order: getColumnOrder('parentalRating'),
        fieldID: 'parentalRating',
        fieldFilter: dataType !== FIELD_AUDIO,
        visible: fieldsToUpdate.parentalRating && (dataType !== FIELD_AUDIO),
    });
    columns.push({
        columnType: 'comment',
        title: _('Comment'),
        getValue: function (item, raw) {
            return item.commentShort;
        },
        setValue: function (item, newValue, raw, index) {
            if (isMore(newValue)) {
                handleMore(-1, -1, true);
                return true;
            }
            newValue = normalizeValue(newValue);
            if (item.commentShort !== newValue) {
                item.setCommentAsync(newValue);
                autotagFields[item.path].editedFields.commentShort = newValue;
                notifyChanged();
            }
            return true; // don't save
        },
        editor: editors.gridViewEditors.multiValueEdit,
        editorParams: '{readOnly: false, filtering: false, expanded: true, autoConfirm: true, removeHTMLTags: true, textOnly: false}',
        editorData: function (params) {
            return fillList(params.itemIndex, 'commentShort');
        },
        editorFocusChange: handleMore,
        bindData: function (div, item, index) {
            setColorAttribute(div, fieldsToUpdate.comment);
            bindField(div, item, index, 'commentShort');
        },
        width: 50,
        order: getColumnOrder('comment'),
        fieldID: 'comment',
        visible: fieldsToUpdate.comment,
    });

    columns.push({
        columnType: 'lyrics',
        title: _('Lyrics'),
        getValue: function (item, raw) {
            return item.getLyricsAsync();
        },
        setValue: function (item, newValue, raw, index) {
            if (isMore(newValue)) {
                handleMore(-1, -1, true);
                return true;
            }
            newValue = normalizeValue(newValue);
            if (item.lyricsShort !== newValue) {
                item.setLyricsAsync(newValue);
                autotagFields[item.path].editedFields.lyricsShort = newValue;
                notifyChanged();
            }
            return true; // don't save
        },
        editor: editors.gridViewEditors.multiLineEdit,
        bindData: function (div, item, index) {
            setColorAttribute(div, fieldsToUpdate.lyrics);
            bindField(div, item, index, 'lyricsShort');
        },
        width: 50,
        order: getColumnOrder('lyrics'),
        fieldID: 'lyrics',
        visible: fieldsToUpdate.lyrics,
    });
    columns.push({
        columnType: 'date',
        title: _('Date'),
        disabled: false,
        bindData: function (div, item, index) {
            bindField(div, item, index, 'date', true);
        },
        bindFunc: function (div, item, index) {
            setColorAttribute(div, fieldsToUpdate.date);
            bindField(div, item, index, 'date', true);
            //div.textContent = utils.myEncodeDate(item.date);
        },
        getValue: function (item, raw) {
            if (raw)
                return item.date;
            else
                return app.utils.myEncodeDate(item.date);
        },
        setValue: function (item, newValue, raw, index) {
            newValue = parseInt(normalizeValue(newValue));
            if (item.date !== newValue) {
                item.date = newValue;
                autotagFields[item.path].editedFields.date = item.date;
                notifyChanged();
            }
            return true; // don't save
        },
        editor: editors.gridViewEditors.dateEdit,
        align: 'right',
        width: 50,
        order: getColumnOrder('date'),
        fieldID: 'date',
        visible: fieldsToUpdate.date,
    });
    columns.push({
        columnType: 'year',
        title: _('Year'),
        disabled: false,
        bindData: function (div, item, index) {
            bindField(div, item, index, 'year', false);
        },
        bindFunc: function (div, item, index) {
            setColorAttribute(div, fieldsToUpdate.year);
            bindField(div, item, index, 'year', false);
            //div.textContent = utils.myEncodeDate(item.date);
        },
        getValue: function (item, raw) {
            return item.year;
        },
        setValue: function (item, newValue, raw, index) {
            newValue = parseInt(normalizeValue(newValue));
            if (newValue > 10000)
                newValue = parseInt(newValue / 10000);
            if (item.year !== newValue) {
                item.year = newValue;
                autotagFields[item.path].editedFields.year = item.year;
                notifyChanged();
            }
            return true; // don't save
        },
        editor: editors.gridViewEditors.dateEdit,
        align: 'right',
        width: 50,
        order: getColumnOrder('year'),
        fieldID: 'year',
        visible: fieldsToUpdate.year && !fieldsToUpdate.date,
    });
    columns.push({
        columnType: 'length',
        title: _('Length'),
        disabled: false,
        bindData: function (div, item) {
            div.textContent = getFormatedTime(item.songLength, {
                useEmptyHours: false
            });
        },
        align: 'right',
        width: 80,
        order: getColumnOrder('length'),
    });
    columns.push({
        columnType: 'path',
        title: _('Path'),
        disabled: false,
        bindData: function (div, item) {
            if (item.cacheStatus == cloudTools.CACHE_STREAMED)
                div.textContent = cloudTools.getRemotePath(item);
            else
                div.textContent = item.path;
        },
        width: 100,
        order: getColumnOrder('path'),
    });
    columns.push({
        columnType: 'status',
        visible: true,
        title: _('Status'),
        width: 70,
        order: getColumnOrder('status'),
        isSortable: false,
        bindData: function (div, item, index) {
            div.textContent = autoTagFramework.getStateText(item.autoTagState);
        }
    });

    whenReady(function () {
        if (!lvTracklist || !lvTracklist.controlClass || window._cleanUpCalled)
            return;
        for (let i = 0; i < columns.length; i++) {
            if (columns[i].columnType === undefined)
                columns[i].columnType = col;
            lvTracklist.controlClass.fieldDefs[columns[i].columnType] = columns[i];
        }

        lvTracklist.controlClass.defaultColumns = columns;
        lvTracklist.controlClass.setColumns(columns);
        //});

        localListen(app, 'settingschange', function () {
            // check auto-tag settings was changed

            let new_fieldsToUpdate = searchManager.getFieldsToUpdate(currentColumnsDataType !== FIELD_VIDEO);
            let new_additionals = searchManager.addAdditional();


            let colsAr = [];
            let colsArHide = [];
            let visibleColumns = lvTracklist.controlClass.visibleColumns;
            let isAudio = (currentColumnsDataType !== FIELD_VIDEO);
            columns.forEach(function (col) {
                if (col.fieldID) {
                    let isVisible = false;
                    for (let i = 0; i < visibleColumns.length; i++) {
                        if (visibleColumns[i].columnType === col.columnType) {
                            isVisible = true;
                            break;
                        }
                    }
                    if (isVisible && !new_fieldsToUpdate[col.fieldID]) {
                        colsArHide.push(col);
                    } else
                    if (!isVisible && new_fieldsToUpdate[col.fieldID]) {
                        colsAr.push(col);
                    }
                }
            });
            if (colsAr.length) {
                colsAr.forEach(function (col) {
                    lvTracklist.controlClass.setColumnVisibility(col.columnType, true);
                });
            }
            if (colsArHide.length) {
                colsArHide.forEach(function (col) {
                    lvTracklist.controlClass.setColumnVisibility(col.columnType, false);
                });
            }


            if (((additionals.addArtwork.audio !== new_additionals.addArtwork.audio) && (currentColumnsDataType !== FIELD_VIDEO)) ||
                ((additionals.addArtwork.video !== new_additionals.addArtwork.video) && (currentColumnsDataType === FIELD_VIDEO))) {

                if ((new_additionals.addArtwork.audio && (currentColumnsDataType !== FIELD_VIDEO)) ||
                    (new_additionals.addArtwork.video && (currentColumnsDataType === FIELD_VIDEO))) {

                    searchManager.getCurrentTagger().getArtwork(searchManager, [], lvTracklist.controlClass.dataSource);
                }
            }
        });

        uitools.browseAndRestoreUIState('dlgAutotag');

    });
}

// AutoTagGroupedTrackList --------------------------------------------
class AutoTagGroupedTrackList extends GroupedTrackList {

    initialize(rootelem, params) {
        super.initialize(rootelem, params);
        this.alwaysShowTooltips = true;
        this.getDefaultSortString = function () {
            return 'album ASC;albumArtist ASC;discNo ASC;order ASC;title ASC';
        };
    }

    restorePersistentState(state) {
        super.restorePersistentState(state);
        if (state.allColumns && columns && columns.length) {
            let newCols = [];
            columns.forEach(function (col) {
                let newCol = {
                    columnType: col.columnType,
                    visible: resolveToValue(col.visible, true),
                    width: col.width,
                    order: col.order,
                };
                for (let i = 0; i < state.allColumns.length; i++) {
                    if (state.allColumns[i].columnType === col.columnType) {
                        if (state.allColumns[i].columnType !== 'status') {
                            /*if (col.fieldID)
                                newCol.visible = resolveToValue(col.visible, true);
                            else*/
                            //newCol.visible = resolveToValue(state.allColumns[i].visible, true);
                            newCol.width = state.allColumns[i].width;
                        }
                        newCol.order = /*i; */ col.order;
                        break;
                    }
                }
                newCols.push(newCol);
            });
            newCols.sort(function (item1, item2) {
                return item1.order - item2.order;
            });
            this.restoreColumns(newCols, true);
        }
    }

    formatStatus(data) {
        let done = 0,
            failed = 0,
            inProgress = 0,
            lookup = 0;
        let ds = this.dataSource;
        ds.locked(function () {
            let track;
            for (let i = 0; i < ds.count; i++) {
                track = ds.getFastObject(i, track);
                let status = track.autoTagState;
                if (status === AT_STATE_DONE)
                    done++;
                else if (status === AT_STATE_FAILED)
                    failed++;
                else if (status === AT_STATE_LOADING_ARTWORK)
                    lookup++;
                else
                    inProgress++;
            }
        });

        let ret = done + '/' + ds.count + ' ' + _('track(s) matched');
        if (failed)
            ret += ', ' + failed + ' ' + _('track(s) failed');

        return ret;
    }

    onTooltip(div, tip) {
        // first remove exclamation mark from tip 
        let idx = tip.indexOf('<span class="lookupFieldInConflict"');
        if (idx >= 0)
            tip = tip.substring(0, idx);

        let wasInConflict = idx >= 0;

        // remove all remaining tags
        tip = tip.replace(/<\/?[^>]+(>|$)/g, "");

        if (wasInConflict && div.column.fieldID) {
            let track;
            this.dataSource.locked(function () {
                track = this.dataSource.getValue(div.itemIndex);
            }.bind(this));

            let autoTagInfo = autotagFields[track.path];
            if (autoTagInfo) {
                let origTrack = getOrigTrack(autoTagInfo.origTrackPath);

                tip = _('Conflict') + ':<br>' +
                    _('Original value') + ': ' + div.column.getValue(origTrack, false) + '<br>' +
                    _('New value') + ': ' + tip;
            }
        }

        return tip;
    }

    afterDraw() {
        super.afterDraw();
        if (this._openEditorAfterRefresh) {
            this._openEditorAfterRefresh = undefined;

            let startEditor = (cnt) => {
                if (this.isItemFullyVisible(this._openEditorAfterRefreshIdx) || (cnt > 20 /* wait up to 2s */ )) {
                    this._openEditorAfterRefreshIdx = undefined;
                    this.editStart();
                } else {
                    requestTimeout(() => {
                        startEditor(++cnt);
                    }, 100);
                }
            };
            startEditor(0);
        }
    }

    cleanUpGroupHeader(div) {
        div._coverProgress = undefined;
        div.fillList = undefined;
        div.bindField = undefined;
        div.prepareValues = undefined;
        div.ArtworkProgressUpdate = undefined;
        div._lookupMark = undefined;        
        super.cleanUpGroupHeader(div);
    }    
}
registerClass(AutoTagGroupedTrackList);

//requirejs('helpers/debugTools');
//registerDebuggerEntryPoint.call(this /* method class */ , 'init' /* method name to inject */ );
