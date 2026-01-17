/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

requirejs('dndutils');
requirejs('controls/toastMessage');

let showAlbum = false;
let UI;
let oldCoverPaths;
let sdpath = '';
let notSavedCI = undefined;
let savedData = undefined;
let oldCoverList = undefined;
let trackAlbum = undefined;

propertiesTabs.tabArtwork.load = function (track, dialog) {
    savedData = undefined;
    oldCoverList = undefined;
    trackAlbum = undefined;

    let coverList;
    if (dialog.isGroup)
        coverList = track.coverList;
    else
        coverList = track.loadCoverListAsync();
    UI = getAllUIElements(qid('tabArtworkContent'));

    let LV = UI.lvArtworkList;
    oldCoverPaths = [];

    if (!window.isAccessible || window.isReadOnly || _utils.isOnlineTrack(track)) { // we currently do not support artworks for YT tracks and not accessible tracks
        setVisibility(UI.btnSearchArtwork, false);
        LV.controlClass.readOnly = true;
        setVisibility(UI.chbApplyToAlbum, false);
        setVisibility(UI.chb_artworks, false);
    } else {
        setVisibility(UI.chb_artworks, dialog.isGroup);
        if (!dialog.reloadingProperties) {
            dialog.localListen(UI.lvArtworkList, 'keydown', function (e) {
                if (friendlyKeyName(e) === 'Delete') { // have to handle it manually, hotkeys are not working in dialogs, #14133
                    uitools.coverRemove(LV);
                    e.stopPropagation();
                    e.preventDefault();
                }
            });
        }
    }

    LV.controlClass.dataSource = coverList;
    LV.controlClass.addArtworkRules = {
        track: track,
        showApply2Album: false,
        doNotSave: true,
        deletedArtworks: []
    };
    if (dialog.isGroup) {
        dialog.tracks.locked(function () {
            LV.controlClass.addArtworkRules.firstTrack = dialog.tracks.getValue(0);
            sdpath = LV.controlClass.addArtworkRules.firstTrack.path;
        }.bind(this));
    } else {
        sdpath = track.path;
    };

    let sett = window.settings.get('Options');

    let __coverChangeFunct = function (eventType, itemIndex, obj, eventDesc, flagValue, value) {
        if ((eventDesc !== 'flagchange') && coverList.isLoaded) {
            if ((coverList.count > 1) && notSavedCI && (notSavedCI.coverStorage === 2)) { // csNotSaved, remove this, user added another image manually
                coverList.isLoaded = false; // to avoid calling change event
                coverList.removeAsync(notSavedCI).then(function () {
                    coverList.isLoaded = true;
                    notSavedCI = undefined;
                });
            }
            dialog.coversModified = true;
            dialog.modified = true;
            if (dialog.isGroup) {
                UI.chb_artworks.controlClass.checked = true;
                UI.chbApplyToAlbum.controlClass.disabled = false;
            }
        }
    }

    dialog.localPromise(coverList.whenLoaded()).then(function () {
        oldCoverList = coverList.getCopy();
        if (!dialog.isGroup && sdpath) {
            coverList.forEach(function (cvr) {
                if ((cvr.coverStorage === 1) || (cvr.coverStorage === 3)) { // csFile or csTagAndFile
                    let cvrpath = cvr.getFullPicturePath(sdpath);
                    if (oldCoverPaths.indexOf(cvrpath) < 0)
                        oldCoverPaths.push(cvrpath);
                };
            });
        }
        if (track.idalbum > 0) {
            dialog.localPromise(app.getObject('album', {
                id: track.idalbum,
                name: track.album,
                artist: track.albumArtist || track.artist,
                canCreateNew: false
            })).then(function (album) {
                if (album) {
                    trackAlbum = album;
                    if(coverList.count === 0) {
                        dialog.localPromise(album.getSearchedCoverAsync()).then(function (ci) {
                            if (ci) {
                                notSavedCI = ci;
                                coverList.isLoaded = false; // to avoid setting modified flag in change event
                                coverList.add(ci);
                                coverList.isLoaded = true;
                            }
                        });
                    }
                };
            });
        }
        dialog.trackLocalListen(coverList, 'change', __coverChangeFunct);
        dialog.trackLocalListen(LV, 'itemchange', __coverChangeFunct);
    });

    showAlbum = (track.idalbum > 0) && (!!track.album);
    if (isVisible(UI.chbApplyToAlbum)) {
        setVisibility(UI.chbApplyToAlbum, showAlbum);
    }
    LV.controlClass.showAlbum = showAlbum;

    if (showAlbum) {
        UI.chbApplyToAlbum.controlClass.checked = sett.Options.ApplyCoversToAlbum && (track.artist === track.albumArtist);
    }

    if (isVisible(UI.chbApplyToAlbum)) {
        dialog.trackLocalListen(UI.chbApplyToAlbum, 'click', function (e) {
            dialog.coversModified = true;
            dialog.modified = true;
        });
    };

    if (isVisible(UI.chb_artworks)) {
        dialog.trackLocalListen(UI.chb_artworks, 'click', function (e) {
            dialog.coversModified = true;
            dialog.modified = true;
        });
        if (isVisible(UI.chbApplyToAlbum)) {
            bindDisabled2Checkbox(UI.chbApplyToAlbum, UI.chb_artworks);
            UI.chbApplyToAlbum.classList.add('left-indent');
        };
    }
    LV = UI.lvArtworkList;

    dialog.trackLocalListen(UI.btnSearchArtwork, 'click', function () {
        // fetch current values from basic tabs
        let basicTab = qid('tabBasicContent');
        let term1 = undefined;
        let term2 = undefined;
        if (basicTab) {
            let basicUI = getAllUIElements(basicTab);

            term1 = utils.visualString2MultiString(basicUI.albumArtists.controlClass.value);

            if (!term1) {
                let ttInt = utils.text2TrackType(basicUI.typeSelect.controlClass.value);
                let tt = utils.getTypeStringId(ttInt);
                if ((tt === 'video') || (tt === 'tv')) {
                    term1 = utils.visualString2MultiString(basicUI.directors.controlClass.value); // director
                } else {
                    term1 = utils.visualString2MultiString(basicUI.artists.controlClass.value);
                }
            };

            term2 = basicUI.album.controlClass.value || basicUI.title.controlClass.value;
        }

        searchTools.searchAAImageDlg(track, undefined, {
            track: track,
            showApply2Album: false,
            doNotSave: true,
            showReplace: false,
            searchTerm1: term1,
            searchTerm2: term2,
            deletedArtworks: LV.controlClass.addArtworkRules.deletedArtworks
        });
    });
    dialog.trackLocalListen(UI.btnBrowse, 'click', function () {
        let promise = app.utils.dialogOpenFile(sdpath, 'jpg', 'Image files (*.jpg, *.png, *.bmp, *.gif, *.thm)|*.jpg;*.jpeg;*.png;*.bmp;*.gif;*.thm|All files (*.*)|*.*', _('Select image files'), true);
        window.localPromise(promise).then(async function (filenames) {
            let imgPaths = [];
            if (filenames && (filenames.count > 0)) {
                filenames.locked(function () {
                    fastForEach(filenames, function (item, index) {
                        imgPaths.push(item.toString());
                    });
                });
            }
            if (imgPaths.length > 0) {
                for (let idx = 0; (idx < imgPaths.length) && (!window._cleanUpCalled); idx++) {
                    let fn = imgPaths[idx];
                    await uitools.addNewArtwork(fn, {
                        track: track,
                        showApply2Album: false,
                        doNotSave: true,
                        showReplace: false,
                    });
                }
            };
        });
    });
};

let showConfirmationMBAsync = function (imagepath, cnt) {
    return new Promise(function (resolve, reject) {
        let msg = sprintf(_('The change in artwork at %s will apply to %d other file(s) on the album.') + ' ' + _('Do you want to proceed?'), escapeXml(imagepath), cnt);
        messageDlg(msg, 'Confirmation', ['btnYes', 'btnNo'], {
            defaultButton: 'btnNo',
        }, function (result) {
            if (result.btnID === 'btnYes') {
                resolve(true);
            } else {
                resolve(false);
            }
        });
    });
}

propertiesTabs.tabArtwork.saveAsync = function (track, dialog) {
    let autoSearchA = false;
    if (showAlbum) {
        let sett = window.settings.get('Options');
        sett.Options.ApplyCoversToAlbum = UI.chbApplyToAlbum.controlClass.checked;
        autoSearchA = sett.Options.SearchMissingArtwork;
        window.settings.set(sett, 'Options');
        app.flushState();
    }
    let coverList = UI.lvArtworkList.controlClass.dataSource;
    let reinsertedArtworks = UI.lvArtworkList.controlClass.reinsertedArtworks;
    coverList.modified = true;

    let retPromise = new Promise(function (resolve, reject) {
        let saveActions = async function (deletedNotSaved) {
            let checkOldPaths = function () {
                if (oldCoverPaths && (oldCoverPaths.length > 0)) {
                    coverList.forEach(function (cvr) {
                        if (cvr.coverStorage === 1) { // csFile
                            let cvrpath = cvr.getFullPicturePath(sdpath);
                            let idx = oldCoverPaths.indexOf(cvrpath);
                            if (idx >= 0)
                                oldCoverPaths.splice(idx, 1);
                        };
                    });
                    if (oldCoverPaths.length > 0) {
                        dialog.afterCommitCalls = dialog.afterCommitCalls || [];
                        dialog.afterCommitCalls.push(function () {
                            app.utils.removeCoversIfLast(oldCoverPaths);
                        });
                    }
                };
            };

            if (!dialog.isGroup) {
                if (sdpath && reinsertedArtworks && (reinsertedArtworks.length > 0)) {
                    // we have some deleted and inserted artworks again, for save to file, delete old in advance, so new can be saved with correct filename, #17640
                    let sddir = app.utils.getDirectory(sdpath);
                    // we have some deleted and inserted artworks again, for save to file, delete old in advance for all tracks, so new can be saved with correct filename, #17640
                    if (!showAlbum || !UI.chbApplyToAlbum.controlClass.checked) {
                        // display warning, if more files has linked the artwork(s)
                        let cnt = 0;
                        let cont = true;
                        for (let i = 0; i < reinsertedArtworks.length; i++) {
                            cnt = await app.utils.getNumberOfTracksUsingCoverAsync(sddir + reinsertedArtworks[i]);
                            if (cnt > 1) {
                                cont = await showConfirmationMBAsync(sddir + reinsertedArtworks[i], cnt - 1);
                                if (!cont) {
                                    if (oldCoverList) {
                                        track.coverList = oldCoverList;
                                    }
                                }
                                break;
                            }
                        };
                        if (!cont) {
                            resolve();
                            return;
                        }
                    }
                    for (let i = 0; i < reinsertedArtworks.length; i++) {
                        await app.filesystem.deleteFileAsync(sddir + reinsertedArtworks[i]);
                    }
                }

                let coverListA = []; // prepare covers to array, forEach does not work with async function as expected, serially
                coverList.forEach(function (cvr) {
                    if (cvr.coverStorage === 1) { // csFile
                        coverListA.push(cvr);
                    }
                });
                for (let cvr of coverListA) {
                    await cvr.saveToFileFolder(sdpath, cvr.picturePath, true /* save only if not exists */ );
                }
                checkOldPaths(); // call after saving, so the filenames are already final, #17666
                if (deletedNotSaved && trackAlbum) {
                    // save icon as artwork for album
                    await trackAlbum.saveThumbAsync('-'); // set default icon as artwork for album
                }

                if (showAlbum && UI.chbApplyToAlbum.controlClass.checked) {
                    // add to afterCommitCalls, so it will not interfere with saving covers to the edited track
                    dialog.afterCommitCalls = dialog.afterCommitCalls || [];
                    dialog.afterCommitCalls.push(function () {
                        app.trackOperation.applyCovers2AlbumAsync(track);
                    });
                }
            } else {
                // apply artwork to all album files -- is done in app.utils.assignGroupData2ListAsync()
                checkOldPaths();
                dialog.applyArtworkToAlbum = (showAlbum && UI.chbApplyToAlbum.controlClass.checked);
                if (reinsertedArtworks && (reinsertedArtworks.length > 0)) {
                    let sddir;
                    let deletedFiles = {};
                    dialog.tracks.forEach((sd) => {
                        sddir = app.utils.getDirectory(sd.path);
                        deletedFiles[sddir] = true;
                    });
                    for (sddir in deletedFiles) {
                        for (let i = 0; i < reinsertedArtworks.length; i++) {
                            await app.filesystem.deleteFileAsync(sddir + reinsertedArtworks[i]);
                        }
                    }
                }

                if (UI.chb_artworks.controlClass.checked)
                    track.coverList = coverList;
                if (deletedNotSaved && trackAlbum) {
                    // save icon as artwork for album
                    await trackAlbum.saveThumbAsync('-'); // set default icon as artwork for album
                } else if(dialog.applyArtworkToAlbum && !autoSearchA) {
                    await trackAlbum.clearArtworkCacheAsync(false); // clear possible cached artworks including album notsaved artwork, so it is not returning without search
                }
            }
            savedData = true;
            resolve();
        };
        if (notSavedCI && (notSavedCI.coverStorage === 2)) { // csNotSaved
            // remove not saved artwork
            if (coverList.count == 0) {
                // notSaved cover was deleted, if editing album, save later as icon only
                notSavedCI = undefined;
                saveActions(true);
                return;
            }
            coverList.isLoaded = false;
            coverList.removeAsync(notSavedCI).then(function () {
                coverList.isLoaded = true;
                notSavedCI = undefined;
                saveActions();
            });
        } else {
            saveActions();
        }
    });
    return retPromise;
}

propertiesTabs.tabArtwork.cancelAsync = function (track, dialog) {
    notSavedCI = undefined;
    trackAlbum = undefined;
    if (!savedData && oldCoverList /* #18652  */ ) {
        track.coverList = oldCoverList;
        oldCoverList = undefined;
    }
    return dummyPromise();
}

propertiesTabs.tabArtwork.beforeWindowCleanup = function () {
    UI = undefined;
    notSavedCI = undefined;
    savedData = undefined;
    oldCoverList = undefined;
    trackAlbum = undefined;    
}
