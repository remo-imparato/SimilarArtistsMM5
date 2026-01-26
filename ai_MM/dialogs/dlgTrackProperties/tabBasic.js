/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

requirejs('actions');
requirejs('helpers/searchTools');
requirejs('controls/trackListView');

let UI;
let isTabFullyLoaded = false;

propertiesTabs.tabBasic.load = function (track, dialog) {

    let utils = app.utils;

    let coverList;
    let ytSearchPromise = undefined;

    isTabFullyLoaded = false;

    let mainElement = qid('tabBasicContent');
    UI = getAllUIElements(mainElement);
    forEach(qes(mainElement, '[data-action-button]'), function (btn) {
        let act = actions[btn.getAttribute('data-action-button')];
        uitools.addToolButton(btn, act.icon, function () {
            act.execute();
            dialog.trackLocalListen(track, 'change', function () {
                refresh();
            });
        }, uitools.getPureTitle(act.title), dialog);
        btn.removeAttribute('data-action-button');
    });

    let refresh = function () {
        let seltype = UI.typeSelect;
        if (dialog.isGroup) {
            let mulseltxt = _('Multiple files selected');
            let el = UI.fpath;
            el.controlClass.value = mulseltxt;
            el.controlClass.readOnly = true;
            el = UI.fname;
            el.controlClass.value = mulseltxt;
            el.controlClass.readOnly = true;

            // get track type
            let tt = 0;
            let trck = undefined;
            dialog.tracks.locked(function () {
                trck = dialog.tracks.getFastObject(0, trck);
                tt = trck.trackType;
                for (let i = 1; i < dialog.tracks.count; i++) {
                    trck = dialog.tracks.getFastObject(i, trck);
                    if (trck.trackType !== tt) {
                        tt = -1;
                        break;
                    }
                }
            });

            let txt = _('Multiple file Types selected');
            if (tt >= 0) {
                seltype.controlClass.value = utils.getTypeText(tt);
            } else {
                seltype.controlClass.value = txt;
                UI.chb_typeSelect.disabled = true;
            }

            let sourceIcon = UI.fileSourceIcon;
            if (sourceIcon.controlClass && (sourceIcon.controlClass.constructor.name !== 'IconButton')) {
                cleanElement(sourceIcon);
            }
            if (!sourceIcon.controlClass)
                sourceIcon.controlClass = new IconButton(sourceIcon);
            setVisibility(sourceIcon, true);
            sourceIcon.controlClass.icon = actions.autoOrganize.icon;
            dialog.trackLocalListen(sourceIcon, 'click', () => {
                actions.autoOrganize.execute();
            });
            sourceIcon.controlClass.tip = uitools.getPureTitle(resolveToValue(actions.autoOrganize.title));
            addEnterAsClick(sourceIcon.controlClass, sourceIcon);
            setVisibility(UI.fileSourceIcon2, false);

        } else {
            let fpathF = UI.fpath;
            let fnameF = UI.fname;
            let path = window.uitools.tracklistFieldDefs.path.getValue(track); // to have same presentation value as in tracklist
            fpathF.controlClass.value = path;
            fnameF.controlClass.value = utils.getFilename(path);
            let editablePath = _utils.isTrackWithEditablePath(track) || _utils.isOnlineTrack(track);
            let isYTTrack = _utils.isOnlineTrack(track);
            fpathF.controlClass.readOnly = !editablePath || !window.uitools.getCanEdit();
            fnameF.controlClass.readOnly = !editablePath || !window.uitools.getCanEdit();
            if (ytSearchPromise)
                cancelPromise(ytSearchPromise);
            let icons = _utils.getFileSourceIcons(track);
            let sourceIcon = UI.fileSourceIcon;
            let lastSearchResult = undefined;
            if (!isYTTrack) {
                if (sourceIcon.controlClass && (sourceIcon.controlClass.constructor.name !== 'IconButton')) {
                    cleanElement(sourceIcon);
                }
                if (!sourceIcon.controlClass)
                    sourceIcon.controlClass = new IconButton(sourceIcon);
            } else {
                let makeTooltipString = function (item) {
                    if (!item)
                        return '';
                    let dataTip = '';
                    if (item.thumbnail) {
                        dataTip += '<img style=\'float:left; padding: 4px; max-width: 120px; maxHeight: 120px;\' src=\'' + item.thumbnail + '\'>';
                    }
                    if (item.title)
                        dataTip += convertSpecialToEntities(item.title) + '</br>';
                    if (item.comment) {
                        let desc = item.comment.replace(/\r\n/g, '</br>').replace(/["]/g, '\''); // quote to apostrophs so we can merge strings easily
                        dataTip += '<hr>' + desc.replace(/\n/g, '</br>');
                    }
                    
                    return dataTip;
                };

//                if (sourceIcon.controlClass && (sourceIcon.controlClass.constructor.name !== 'MenuButton')) {
                    cleanElement(sourceIcon);
//                }

                if (!sourceIcon.controlClass) {
                    sourceIcon.controlClass = new MenuButton(sourceIcon);
                    // Youtube track, allow searching it on Youtube
                    requirejs('helpers/youtubeHelper');
                    let getSubmenuFromSearchResult = function () {
                        let retval = [];
                        let idx = 10;
                        forEach(lastSearchResult, function (item, idx) {
                            let dataTip = makeTooltipString(item);
                            retval.push({
                                action: {
                                    title: '<span data-tip="' + dataTip + '" data-html="1">' + convertSpecialToEntities(item.title) + '</span>',
                                    noAccessKey: true,
                                    checked: (track && (item.path === fpathF.controlClass.value)),
                                    execute: function () {
                                        fpathF.controlClass.value = item.path;
                                        fnameF.controlClass.value = utils.getFilename(item.path);
                                        let coverList = track.loadCoverListAsync();
                                        dialog.localPromise(coverList.whenLoaded()).then(function () {
                                            coverList.clear();
                                            if (item.thumbnail) {
                                                track.addCoverAsync(item.thumbnail);
                                            }
                                        });
                                        window.modified = true;
                                    }
                                },
                                order: idx,
                                grouporder: 10
                            });
                            idx += 10;
                        });
                        return retval;
                    };
                    if(icons[0] === 'youtube') {
                        sourceIcon.controlClass.tip = _('Show more from YouTube');
                        sourceIcon.controlClass.menuArray = function () {
                            if (lastSearchResult)
                                return getSubmenuFromSearchResult();
                            else {
                                return new Promise(function (resolve, reject) {
                                    ytSearchPromise = ytHelper.searchVideosForTrack(track, {
                                        maxResults: 10
                                    })
                                    dialog.localPromise(ytSearchPromise).then(function (resArray) {
                                        ytSearchPromise = undefined;
                                        if (resArray && resArray.length > 0) {
                                            lastSearchResult = resArray;
                                            resolve(getSubmenuFromSearchResult());
                                        } else {
                                            resolve([]);
                                        }
                                    });
                                });
                            }
                        };
                    } else {
                        sourceIcon.removeAttribute('data-tip');
                    }
                }
            }

            if (icons[0] == 'drive')
                sourceIcon.controlClass.icon = actions.autoOrganize.icon; // #20873
            else
                sourceIcon.controlClass.icon = icons[0];            
            sourceIcon.controlClass.disabled = !editablePath && !isYTTrack;
            sourceIcon.classList.toggle('youtubeIcon', (icons[0] === 'youtube'));

            let sourceIcon2 = UI.fileSourceIcon2;
            if (icons[1]) {
                setVisibilityFast(sourceIcon2, true);
                sourceIcon2.controlClass.icon = icons[1];
                if(icons[1] === 'youtube') {
                    sourceIcon2.controlClass.tip = _('Show more from YouTube');
                    sourceIcon2.controlClass.menuArray = function () {
                        if (lastSearchResult)
                            return getSubmenuFromSearchResult();
                        else {
                            return new Promise(function (resolve, reject) {
                                ytSearchPromise = ytHelper.searchVideosForTrack(track, {
                                    maxResults: 10
                                })
                                dialog.localPromise(ytSearchPromise).then(function (resArray) {
                                    ytSearchPromise = undefined;
                                    if (resArray && resArray.length > 0) {
                                        lastSearchResult = resArray;
                                        resolve(getSubmenuFromSearchResult());
                                    } else {
                                        resolve([]);
                                    }
                                });
                            });
                        }
                    };
                } else {
                    sourceIcon2.removeAttribute('data-tip');
                    sourceIcon2.controlClass.menuArray = () => {
                        // list cloud (remote) locations per #15023:
                        return new Promise(function (resolve, reject) {
                            let retval = new Array();
                            let devices = app.devices.getForTrackId(track.id);
                            dialog.localPromise(devices.whenLoaded()).then(() => {
                                fastForEach(devices, (device) => {
                                    retval.push({
                                        title: device.name,
                                        icon: mediaSyncDevices.getIcon(device)
                                    });
                                });
                                resolve(retval);
                            });
                        });
                    }
                }
                sourceIcon2.classList.toggle('youtubeIcon', (icons[1] === 'youtube'));
            } else {
                setVisibilityFast(sourceIcon2, false);
            };

            if (editablePath && !isYTTrack) {
                dialog.trackLocalListen(fpathF, 'input', function () {
                    fnameF.controlClass.value = utils.getFilename(fpathF.controlClass.value);
                });
                dialog.trackLocalListen(fnameF, 'input', function () {
                    fpathF.controlClass.value = utils.getDirectory(fpathF.controlClass.value) + fnameF.controlClass.value;
                });
                dialog.trackLocalListen(sourceIcon, 'click', () => {
                    actions.autoOrganize.execute();
                });
                addEnterAsClick(sourceIcon.controlClass, sourceIcon);
                sourceIcon.controlClass.tip = uitools.getPureTitle(resolveToValue(actions.autoOrganize.title));
            }
            setVisibilityFast(UI.fnameIcon, editablePath);

            seltype.controlClass.value = utils.getTypeText(track.trackType);
        }

        UI.title.controlClass.value = track.title;
        UI.trackproperties_rating.controlClass.value = track.rating;
        setVisibility(UI.sp_unknownRating, (UI.trackproperties_rating.controlClass.value < 0));
        dialog.trackLocalListen(UI.trackproperties_rating, 'change', function () {
            setVisibility(UI.sp_unknownRating, (UI.trackproperties_rating.controlClass.value < 0));
            dialog.tagModified = true;
        });
        UI.artists.controlClass.value = utils.multiString2VisualString(track.artist);
        UI.directors.controlClass.value = UI.artists.controlClass.value;
        UI.genres.controlClass.value = utils.multiString2VisualString(track.genre);
        UI.album.controlClass.value = track.album;
        UI.album.controlClass.multivalue = false;
        UI.discNum.controlClass.value = track.discNumber;
        UI.trackNum.controlClass.value = track.trackNumber;
        if (dialog.tt === undefined)
            dialog.tt = utils.getTypeStringId(track.trackType);
        if ((dialog.tt == 'video') || (dialog.tt == 'tv')) {
            UI.trackNum.controlClass.value = track.episodeNumber;
            UI.discNum.controlClass.value = track.seasonNumber;
        } else {
            UI.trackNum.controlClass.value = track.trackNumber;
            UI.discNum.controlClass.value = track.discNumber;
        }
        UI.actors.controlClass.value = utils.multiString2VisualString(track.actors);
        UI.producers.controlClass.value = utils.multiString2VisualString(track.producer);
        UI.albumArtists.controlClass.value = utils.multiString2VisualString(track.albumArtist);
        UI.date.controlClass.value = utils.myEncodeDate(track.date);
        let detailsTab = qid('tabDetailsContent');
        let detailsPublisher = undefined;
        let detailsAuthors = undefined;
        if(detailsTab) {
            detailsPublisher = qeid(detailsTab, 'publisher');
            detailsAuthors = qeid(detailsTab, 'authorsAB');
        }
        if(detailsAuthors && detailsAuthors.controlClass)
            UI.authors.controlClass.value = detailsAuthors.controlClass.value;
        else
            UI.authors.controlClass.value = utils.multiString2VisualString(track.author);
        if(detailsPublisher && detailsPublisher.controlClass)
            UI.publisherAB.controlClass.value = detailsPublisher.controlClass.value;
        else
            UI.publisherAB.controlClass.value = track.publisher;
        // events to update synchronized fields in Details tab, if existing
        dialog.trackLocalListen(UI.publisherAB, 'change', function () {
            detailsTab = detailsTab || qid('tabDetailsContent');
            if(detailsTab) {
                detailsPublisher = detailsPublisher || qeid(detailsTab, 'publisher');
                if(detailsPublisher && detailsPublisher.controlClass && (detailsPublisher.controlClass.value !== UI.publisherAB.controlClass.value)) {
                    detailsPublisher.controlClass.value = UI.publisherAB.controlClass.value;
                }
            }
        });
        dialog.trackLocalListen(UI.authors, 'change', function () {
            detailsTab = detailsTab || qid('tabDetailsContent');
            if(detailsTab) {
                detailsAuthors = detailsAuthors || qeid(detailsTab, 'authorsAB');
                if(detailsAuthors && detailsAuthors.controlClass && (detailsAuthors.controlClass.value !== UI.authors.controlClass.value)) {
                    detailsAuthors.controlClass.value = UI.authors.controlClass.value;
                }
            }
        });
        UI.originalDate.controlClass.value = utils.myEncodeDate(track.origDate);
        UI.conductors.controlClass.value = utils.multiString2VisualString(track.conductor);
        UI.lyricists.controlClass.value = utils.multiString2VisualString(track.lyricist);
        UI.screenwriters.controlClass.value = UI.lyricists.controlClass.value;
        dialog.localPromise(track.getCommentAsync()).then(function (txt) {
            UI.comment.value = txt;
            isTabFullyLoaded = true;
        });
    };

    if (!dialog.reloadingProperties) {
        dialog.localListen(UI.albumArtists, 'focusin', function (e) {
            if ((UI.albumArtists.controlClass.value === '') && (UI.artists.controlClass.value !== '') && (dialog.tt !== 'video') && (dialog.tt !== 'tv')) {
                UI.albumArtists.controlClass.value = UI.artists.controlClass.value;
            }
        });
    };

    if (!uitools.isDockedDialog('dlgTrackProperties')) {
        let getTracklist = function () {
            return dialog.tracks;
        };
        actions.autoTagFromFilename.getTracklist = getTracklist;
        actions.autoTag.getTracklist = getTracklist;
        actions.autoOrganize.getTracklist = getTracklist;
    }

    dialog.localPromise(track.getTrackTypeAsync()).then(function (tt) { // to be sure, we have trackType initialized
        dialog._loadingValues = true; // #16388
        refresh();
        dialog._loadingValues = false;
    });
}

propertiesTabs.tabBasic.saveAsync = function (track, dialog) {
    if (!isTabFullyLoaded || window._cleanUpCalled)
        return dummyPromise();

    let utils = app.utils;
    let db = app.db;
    let retPromise = undefined;
    if (!dialog.isGroup) {
        track.title = UI.title.controlClass.value;

        let aartist = UI.albumArtists.controlClass.value;
        if (aartist !== track.albumArtist) {
            track.albumArtist = utils.visualString2MultiString(aartist);
        }
        let album = UI.album.controlClass.value;
        if (album !== track.album) {
            track.album = album;
        };

        let year = utils.myDecodeDate(UI.date.controlClass.value);
        if (year > 0)
            track.date = year;
        else
            track.date = -1;

        year = utils.myDecodeDate(UI.originalDate.controlClass.value);
        if (year > 0)
            track.origDate = year
        else
            track.origDate = -1;

        let commPromise = track.setCommentAsync(UI.comment.value);
        let ttInt = utils.text2TrackType(UI.typeSelect.controlClass.value);
        let tt = utils.getTypeStringId(ttInt);
        if ((tt === 'video') || (tt === 'tv')) {
            track.artist = utils.visualString2MultiString(UI.directors.controlClass.value); // director
            track.episodeNumber = UI.trackNum.controlClass.value;
            track.seasonNumber = UI.discNum.controlClass.value;
            track.lyricist = utils.visualString2MultiString(UI.screenwriters.controlClass.value); // screenwriter
        } else {
            track.artist = utils.visualString2MultiString(UI.artists.controlClass.value);
            track.trackNumber = UI.trackNum.controlClass.value;
            track.discNumber = UI.discNum.controlClass.value;
            track.lyricist = utils.visualString2MultiString(UI.lyricists.controlClass.value);
        }

        track.producer = utils.visualString2MultiString(UI.producers.controlClass.value);
        if(tt=='audiobook')
            track.publisher = UI.publisherAB.controlClass.value;
        else
            track.author = utils.visualString2MultiString(UI.authors.controlClass.value);
        track.actors = utils.visualString2MultiString(UI.actors.controlClass.value);
        track.conductor = utils.visualString2MultiString(UI.conductors.controlClass.value);
        track.genre = utils.visualString2MultiString(UI.genres.controlClass.value);
        track.trackType = ttInt;
        track.rating = UI.trackproperties_rating.controlClass.value;
        if (!UI.fpath.controlClass.disabled && (_utils.isTrackWithEditablePath(track) || _utils.isOnlineTrack(track))) { // allow editing path for YT track
            let newPath = UI.fpath.controlClass.value;
            if (newPath !== track.path) {
                if (isURLPath(newPath) || isURLPath(track.path)) {
                    track.path = newPath;
                } else {
                    retPromise = new Promise(function (resolve, reject) {
                        commPromise.then(function () {
                            let trackList = app.utils.createTracklist(true);
                            trackList.add(track);
                            app.filesystem.renameFilesAsync(trackList, newPath, {
                                move: true,
                                addDB: false,
                                changeFileName: true
                            }).then(resolve);
                        })
                    });
                }
            };
        }
        if (!retPromise)
            retPromise = commPromise;
    } else {

        let ischecked = function (id) {
            let res = false;
            let chb = UI['chb_' + id];
            if (chb && chb.controlClass)
                res = chb.controlClass.checked;
            return res;
        };
        let setccval = function (val, id) {
            if (ischecked(id))
                track[val] = UI[id].controlClass.value;
        };
        let setmultival = function (val, id) {
            if (ischecked(id))
                track[val] = utils.visualString2MultiString(UI[id].value);
        };
        let setmulticcval = function (val, id) {
            if (ischecked(id))
                track[val] = utils.visualString2MultiString(UI[id].controlClass.value);
        };

        if (ischecked('comment')) {
            track.dirtyModified = true;
            retPromise = track.setCommentAsync(UI.comment.value);
        }

        setccval('title', 'title');
        setmulticcval('albumArtist', 'albumArtists');
        setccval('album', 'album');

        let year;
        if (ischecked('date')) {
            year = utils.myDecodeDate(UI.date.controlClass.value);
            if (year > 0)
                track.date = year;
            else
                track.date = -1;
        }
        if (ischecked('originalDate')) {
            year = utils.myDecodeDate(UI.originalDate.controlClass.value);
            if (year > 0)
                track.origDate = year
            else
                track.origDate = -1;
        }

        let ttInt = utils.text2TrackType(UI.typeSelect.controlClass.value);
        if (ischecked('typeSelect')) {
            track.trackType = ttInt;
        }
        let tt = utils.getTypeStringId(ttInt);
        if ((tt === 'video') || (tt === 'tv')) {
            setmulticcval('artist', 'directors');
            setccval('episodeNumber', 'trackNum');
            setccval('seasonNumber', 'discNum');
            setmulticcval('lyricist', 'screenwriters');
        } else {
            setmulticcval('artist', 'artists');
            setccval('trackNumber', 'trackNum');
            setccval('discNumber', 'discNum');
            setmulticcval('lyricist', 'lyricists');
        }
        setmulticcval('producer', 'producers');
        if(tt=='audiobook')
            setccval('publisher', 'publisherAB');
        else
            setmulticcval('author', 'authors');
        setmulticcval('actors', 'actors');
        setmulticcval('conductor', 'conductors');
        setmulticcval('genre', 'genres');
        setccval('rating', 'trackproperties_rating');
    }
    if (retPromise)
        return retPromise
    else
        return dummyPromise();
}

propertiesTabs.tabBasic.updateVisibility = function (trackType, dialog) {
    dialog.tt = trackType;
    dialog.hideControls(['title', 'trackproperties_rating', 'artists', 'directors', 'genres', 'album', 'discNum', 'trackNum', 'albumArtists',
                  'producers', 'date', 'authors', 'actors', 'originalDate', 'conductors', 'lyricists', 'screenwriters', 'publisherAB', 'tr_albumdisctrack',
                  'tr_authorsorigdate', 'tr_conductorslyricists']);

    UI.lbl_album.innerText = _('Album') + ':';
    UI.lbl_artists.innerText = _('Artist(s)') + ':';
    UI.lbl_genres.innerText = _('Genre(s)') + ':';
    UI.lbl_discNum.innerText = _('Disc #') + ':';
    UI.lbl_trackNum.innerText = _('Track #') + ':';

    switch (trackType) {
        case 'music':
        case 'musicvideo':
            {
                dialog.showControls(['title', 'trackproperties_rating', 'artists', 'genres', 'album', 'discNum', 'trackNum', 'albumArtists',
                  'date', 'authors', 'originalDate', 'conductors', 'lyricists',
                  'tr_conductorslyricists', 'tr_authorsorigdate', 'tr_albumdisctrack']);
                break;
            }
        case 'audiobook':
            {
                UI.lbl_title.innerText = _('Title') + ' (' + _('title') + '; ' + _('episode title') + ')' + ':';
                UI.lbl_artists.innerText = _('Artist(s)') + ' (' + _('narrator') + '; ' + _('performer') + ')' + ':';
                UI.lbl_album.innerText = _('Album') + ' (' + _('book title') + '; ' + _('course title') + '; ' + _('performance') + ')' + ':';
                UI.lbl_albumArtists.innerText = _('Album Artist(s)') + ' (' + _('author') + '; ' + _('performer') + ')' + ':';
                UI.lbl_trackNum.innerText = _('Track #') + ' (' + _('part') + '; ' + _('chapter') + ')' + ':';
                dialog.showControls(['title', 'trackproperties_rating', 'artists', 'genres', 'album', 'discNum', 'trackNum', 'albumArtists',
                  'date', 'originalDate', 'publisherAB', 'tr_authorsorigdate', 'tr_albumdisctrack']);
                break;
            }
        case 'podcast':
        case 'videopodcast':
            {
                UI.lbl_album.innerText = _('Podcast') + ':';
                dialog.showControls(['title', 'trackproperties_rating', 'artists', 'genres', 'album', 'trackNum', 'albumArtists',
                  'date', 'tr_albumdisctrack']);
                break;
            }
        case 'video':
        case 'tv':
            {
                UI.lbl_album.innerText = _('Series') + ':';
                UI.lbl_discNum.innerText = _('Season #') + ':';
                UI.lbl_trackNum.innerText = _('Episode #') + ':';
                dialog.showControls(['title', 'trackproperties_rating', 'directors', 'genres', 'album', 'discNum', 'trackNum',
                  'producers', 'date', 'actors', 'screenwriters', 'tr_conductorslyricists', 'tr_albumdisctrack']);
                break;
            }
        case 'classical':
            {
                UI.lbl_artists.innerText = _('Artist(s)') + ' (' + _('ensemble') + '; ' + _('soloist') + ')' + ':';
                UI.lbl_genres.innerText = _('Genre(s)') + ' (' + _('genre') + '; ' + _('period') + ')' + ':';
                dialog.showControls(['title', 'trackproperties_rating', 'artists', 'genres', 'album', 'discNum', 'trackNum', 'albumArtists',
                  'date', 'authors', 'originalDate', 'conductors', 'lyricists',
                  'tr_conductorslyricists', 'tr_authorsorigdate', 'tr_albumdisctrack']);
                break;
            }
        case 'radio':
            {
                dialog.showControls(['album', 'tr_albumdisctrack']);
                break;
            }
        case '': // mixed
            {
                dialog.showControls(['title', 'trackproperties_rating', 'genres', 'date']);
                break;
            }
    }
}

propertiesTabs.tabBasic.beforeWindowCleanup = function () {
    UI = undefined;
    isTabFullyLoaded = false;
}