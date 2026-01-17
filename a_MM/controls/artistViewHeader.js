/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

'use strict';
registerFileImport('controls/artistViewHeader');
import ViewHeader from './viewHeader';
/**
 * UI ArtistViewHeader element
*/
export default class ArtistViewHeader extends ViewHeader {
    initialize(rootelem, params) {
        params = params || {};
        params.icon = params.icon || 'person';
        params.useCollage = true;
        params.useImage = true;
        params.useGenres = true;
        params.descEditSupport = true;
        super.initialize(rootelem, params);
        this.mbDataType = 'artist'; // MusicBrainz data type
        let UI = this.UI;
        let _this = this;
        if (window.uitools.getCanEdit()) {
            this._imageCtrl.addToContextMenu([{
                    action: {
                        title: actions.coverLookup.title,
                        icon: actions.coverLookup.icon,
                        execute: function () {
                            if (!_this.artist)
                                return;
                            searchTools.searchArtistImageDlg(_this.artist, function () {
                                this.updateImage(true);
                            }.bind(_this), {
                                uid: _this.uniqueID,
                                highPriority: true
                            });
                        }
                    },
                    order: 20,
                    grouporder: 5,
                }]);
        }
        dnd.makeImageDroppable(UI.itemImageSquare, function (picturePath) {
            if (picturePath && !_this._cleanUpCalled) {
                _this.localPromise(_this.artist.saveThumbAsync(picturePath)).then(function () {
                    if (!_this._cleanUpCalled)
                        _this.updateImage(true);
                });
            }
        });
        _this.localListen(_this.UI.headerTitle, 'dblclick', function () {
            if (!_this.showingOnline)
                _this.setEditMode(true);
        });
        // @ts-ignore
        UI.btnMenu.controlClass.menuArray = [{
                action: {
                    visible: function () {
                        return _this.artist && !_this.isVariousArtist;
                    },
                    title: function () {
                        if (_this.showingOnline || !app.getValue('autoRenameWrongArtist', true))
                            return _('Switch') + ' (' + _('Artist') + ')';
                        else
                            return _('Switch') + ' / ' + _('Edit') + ' (' + _('Artist') + ')';
                    },
                    submenu: function () {
                        return new Promise(function (resolve, reject) {
                            let retArray = [];
                            if (_this._ds.cache && _this._ds.cache.foundArtistsSelect && (_this._ds.cache.foundArtistsSelect.count > 1)) {
                                let ds = _this._ds.cache.foundArtistsSelect;
                                ds.forEach(function (artHTML, i) {
                                    retArray.push({
                                        action: {
                                            title: artHTML.toString(),
                                            checked: function () {
                                                return ds.focusedIndex === i;
                                            },
                                            execute: function () {
                                                _this.artist.mbgid = _this._ds.cache.foundArtists[i].id;
                                                if (!_this.showingOnline && !_this._ds.cache.foundArtists[i].isAnother && (_this._ds.cache.foundArtists[i].name !== _this.artist.name) && app.getValue('autoRenameWrongArtist', true)) {
                                                    _this.renameArtist(_this._ds.cache.foundArtists[i].name, true);
                                                }
                                                else {
                                                    if (_this.artist.id > 0)
                                                        _this.artist.commitAsync();
                                                    _this.clearData({
                                                        clearAll: true
                                                    });
                                                    _this._ds.switchToOtherArtist(i);
                                                }
                                            }
                                        },
                                        order: i * 10,
                                        grouporder: 10
                                    });
                                });
                            }
                            retArray.push({
                                action: {
                                    visible: function () {
                                        return _this.artist && !_this.isVariousArtist && !_this.showingOnline;
                                    },
                                    title: _('Update properties'),
                                    checkable: true,
                                    checked: function () {
                                        return app.getValue('autoRenameWrongArtist', true);
                                    },
                                    execute: function () {
                                        let newVal = !app.getValue('autoRenameWrongArtist', true);
                                        app.setValue('autoRenameWrongArtist', newVal);
                                    }
                                },
                                order: 10,
                                grouporder: 20
                            });
                            resolve(retArray);
                        });
                    }
                },
                order: 10,
                grouporder: 10,
            }, {
                action: {
                    title: _('Choose different language'),
                    visible: function () {
                        return _this.wikipages && (_this.wikipages.length > 0);
                    },
                    submenu: function () {
                        let retArray = [];
                        forEach(_this.wikipages, function (pgObj, i) {
                            retArray.push({
                                title: window.getLanguageNativeName(pgObj.lang),
                                checked: function () {
                                    return _this._ds.onlineData && (_this._ds.onlineData.wikiUrl === pgObj.url.replace('http://', 'https://'));
                                },
                                execute: function () {
                                    _this.setWikiLanguage(pgObj.lang, pgObj);
                                }
                            });
                        });
                        return retArray;
                    }
                },
                order: 10,
                grouporder: 20,
            }, {
                action: {
                    title: _('Edit in Wikipedia'),
                    visible: function () {
                        return !!_this._ds.onlineData && !!_this._ds.onlineData.wikiUrl;
                    },
                    execute: function () {
                        app.utils.web.openURL(musicBrainz.getWikiEditLink(_this._ds.onlineData.wikiUrl));
                    }
                },
                order: 20,
                grouporder: 30,
            }, {
                action: {
                    title: _('Edit in MusicBrainz'),
                    visible: function () {
                        return !!_this.artist && !!_this.artist.mbgid && !_this.isVariousArtist;
                    },
                    execute: function () {
                        app.utils.web.openURL(musicBrainz.getMBEditLink('artist', _this.artist.mbgid));
                    }
                },
                order: 30,
                grouporder: 30,
            }, {
                action: {
                    title: _('Rename') + '...',
                    icon: 'edit',
                    visible: function () {
                        return !_this.showingOnline;
                    },
                    execute: function () {
                        _this.setEditMode(true);
                    }
                },
                order: 10,
                grouporder: 40
            }, {
                action: {
                    title: _('Edit comment') + '...',
                    icon: 'edit',
                    visible: function () {
                        return !_this.showingOnline;
                    },
                    execute: function () {
                        if (!_this.showingOnline && _this.UI.wikiDescription && _this.UI.wikiDescription.controlClass) { // @ts-ignore
                            if (_this.UI.wikiDescription.controlClass.startEdit) { // @ts-ignore
                                _this.UI.wikiDescription.controlClass.startEdit();
                            }
                        }
                    }
                },
                order: 20,
                grouporder: 40
            }, {
                action: {
                    title: actions.trackProperties.title,
                    icon: actions.trackProperties.icon,
                    visible: function () {
                        return !_this.showingOnline;
                    },
                    disabled: function () {
                        if (_this._ds.cache.allTracks)
                            return (_this._ds.cache.allTracks.count === 0);
                        let tracks = _this.artist.getTracklist();
                        return tracks.whenLoaded().then(function () {
                            _this._ds.cache.allTracks = tracks;
                            return (tracks.count === 0);
                        });
                    },
                    execute: function () {
                        let tracks = _this._ds.cache.allTracks;
                        if (!tracks) {
                            tracks = _this.artist.getTracklist();
                            _this._ds.cache.allTracks = tracks;
                        }
                        uitools.openDialog('dlgTrackProperties', {
                            modal: true,
                            tracks: tracks,
                            //selectTab: 'tabArtwork'
                        });
                    }
                },
                order: 30,
                grouporder: 40,
            },
            /*        {
                        action: {
                            title: _('Show All Albums'),
                            visible: function () {
                                return !_this.showingOtherAlbums;
                            },
                            execute: function () {
                                _this.showingOtherAlbums = true;
                                _this.updateView();
                            }
                        },
                        order: 10,
                        grouporder: 40,
                    }, {
                        action: {
                            title: _('Show Studio Albums only'),
                            visible: function () {
                                return _this.showingOtherAlbums;
                            },
                            execute: function () {
                                _this.showingOtherAlbums = false;
                                _this.updateView();
                            }
                        },
                        order: 20,
                        grouporder: 40,
                    },
            */
            {
                action: {
                    title: function () {
                        return _('Pin it');
                    },
                    icon: 'pin',
                    visible: function () {
                        return uitools.isPinnedAsync(_this.artist, false);
                    },
                    execute: function () {
                        uitools.pinItem(_this.artist, true);
                    }
                },
                order: 10,
                grouporder: 50,
            }, {
                action: {
                    title: function () {
                        return _('Unpin it');
                    },
                    icon: 'pin',
                    visible: function () {
                        return uitools.isPinnedAsync(_this.artist, true);
                    },
                    execute: function () {
                        uitools.pinItem(_this.artist, false);
                    }
                },
                order: 20,
                grouporder: 50
            }
            /* deprecated in course of #16884
            , {
                    action: {
                        title: _('Purchase'),
                        visible: function () {
                            return !!_this.artist && _this.showingOnline && !_this.isVariousArtist;
                        },
                        submenu: function () {
                            var menuItems = [];
                            TrackShortcuts.sort(function (i1, i2) {
                                return i1.order - i2.order;
                            });
                            forEach(TrackShortcuts, function (shortcut, idx) {
                                menuItems.push({
                                    action: {
                                        title: shortcut.title,
                                        icon: shortcut.icon,
                                        execute: function () {
                                            TrackShortcuts[idx].execute('artist', 'artist', _this.artist);
                                        }
                                    },
                                    grouporder: 10
                                });
                            });
                            return menuItems;
                        }
                    },
                    order: 10,
                    grouporder: 60,
            } */
        ];
        this.localListen(this.UI.headerTitle, 'change', function (evt) {
            _this.renameArtist(evt.detail.value);
        });
        this.localListen(this.container, 'contextmenu', function () {
            window.lastFocusedControl = rootelem;
            window._lastFocusedLVControl = undefined; // so it always take this control for actions
        }, true);
        this.localListen(UI.wikiDescription, 'change', function (e) {
            if (this.showingOnline)
                return;
            this.artist.comment = e.detail.value;
            if (this.artist.id > 0)
                this.artist.commitAsync();
            this.updateValues();
        }.bind(this));
        if (UI.searchWikiLink) {
            this.localListen(UI.searchWikiLink, 'click', () => {
                setVisibility(UI.searchWikiText, false);
                setVisibility(UI.searchWikiLink, false);
                this._ds.fetchMBData();
            });
            addEnterAsClick(this, UI.searchWikiLink);
        }
    }
    getTracklist() {
        // get all tracks, not just current (top)tracklist
        if (!this._ds)
            return undefined;
        let tracksPromise = undefined;
        if (this.showingOnline) {
            if (!this.isVariousArtist) {
                if (this._ds.cache && this._ds.cache.allOnlineTracks)
                    return this._ds.cache.allOnlineTracks;
                tracksPromise = this._ds.readAllOnlineTracks();
            }
        }
        else {
            let pars = {};
            let sortString = nodeUtils.getBrowserTracksSortString();
            if (sortString) {
                if (sortString === 'playOrder ASC') {
                    pars.topTracksSort = true;
                }
                else {
                    pars.sortString = sortString;
                }
            }
            if (this._ds.cache && this._ds.cache.allTracks && !pars.topTracksSort) {
                if (sortString) {
                    let origList = this._ds.cache.allTracks;
                    this._ds.cache.allTracks = app.utils.createTracklist();
                    let newList = this._ds.cache.allTracks;
                    this.localPromise(origList.setAutoSortAsync(sortString)).then(function () {
                        newList.addList(origList);
                        newList.notifyLoaded();
                    });
                }
                return this._ds.cache.allTracks;
            }
            tracksPromise = this._ds.readAllTracks(pars);
        }
        let tracklist = app.utils.createTracklist();
        if (tracksPromise) {
            this.localPromise(tracksPromise).then(function (tl) {
                if (tl) {
                    tracklist.addList(tl);
                }
                tracklist.notifyLoaded();
            });
        }
        else
            tracklist.notifyLoaded();
        return tracklist;
    }
    renameArtist(newName, setTitleText) {
        let oldName = this.artist.name;
        let setName = function () {
            if (!this.showingOnline && setTitleText) {
                this.UI.headerTitle.innerText = newName;
            }
            let origID = this.artist.id;
            this.artist.name = newName;
            this.localPromise(this.artist.commitAsync()).then(function () {
                if (this.artist && ((this.artist.id !== origID) || setTitleText)) {
                    // id or mbgid changed, reload view
                    this._ds.clearData();
                    this.clearData({
                        clearAll: true
                    });
                    this._ds.notifyChange({
                        senderID: this.uniqueID,
                        eventType: 'clear',
                        clearAll: true
                    });
                    this._ds.notifyChange({
                        senderID: this.uniqueID
                    });
                    this._ds.fetchMBData();
                }
            }.bind(this));
        }.bind(this);
        this.localPromise(this.artist.getItemCountAsync('track')).then(function (cnt) {
            let sett = window.settings.get('System');
            if ((cnt <= 50) || (!sett.System.AskUserMassEdit)) {
                setName();
                return;
            }
            let msg = sprintf(_('Are you sure that you want to modify %d files ?'), cnt);
            messageDlg(msg, 'Confirmation', ['btnYes', 'btnNo'], {
                defaultButton: 'btnNo',
                chbCaption: _('In the future, do not ask me'),
                checked: false
            }, function (result) {
                if (result.btnID === 'btnYes') {
                    if (result.checked) {
                        sett.System.AskUserMassEdit = false;
                        window.settings.set(sett, 'System');
                    }
                    setName();
                }
                else {
                    if (!this.showingOnline)
                        this.UI.headerTitle.innerText = oldName;
                }
            }.bind(this));
        }.bind(this));
    }
    clearData(params) {
        super.clearData(params);
        enterLayoutLock(this.container);
        this._mbImageUrl = undefined;
        this._triedDownloadImage = false;
        this._triedImageFromMB = false;
        this._triedDiscogsRGImage = false;
        this._gettingImagePending = false;
        this.isVariousArtist = false;
        if (params && params.clearAll) {
            this._localThumbTried = false;
        }
        leaveLayoutLock(this.container);
    }
    updateImage(forceUpdate) {
        let UI = this.UI;
        if (!this.artist || this._cleanUpCalled || this._gettingImagePending)
            return; // @ts-ignore
        if (!forceUpdate && !this._imageCtrl.emptyArtwork)
            return;
        if (forceUpdate)
            this._ds.cache.artistImage = undefined;
        else if (this._ds.cache.artistImage) { // @ts-ignore
            this._imageCtrl.showImage(this._ds.cache.artistImage);
            return;
        }
        if (this.artist && this.artist.name) {
            let _this = this;
            let pixelSize = 500;
            cancelPromise(this._promises.artistThumb);
            _this._gettingImagePending = true;
            let token = this.artist.getThumbAsync(pixelSize, pixelSize, function (imageLink) {
                _this._gettingImagePending = false;
                if (!_this._ds) { // data source already cleared
                    return;
                }
                _this._localThumbTried = true;
                _this._promises.artistThumb = undefined;
                if (imageLink) {
                    _this._ds.cache.artistImage = imageLink; // @ts-ignore
                    _this._imageCtrl.showImage(imageLink);
                }
                else { // @ts-ignore
                    _this._imageCtrl.hideImage();
                    if (!_this.autoDownloadImage && !app.getValue('InfoPanelAutoLookup', true))
                        return; // do not search for image if we already tried to get it and user does not want to auto lookup
                    if (!_this._triedImageFromMB && !_this.isVariousArtist) {
                        if (_this._ds.onlineData) {
                            let imgUrl = _this._ds.onlineData['image-url'];
                            if (imgUrl) {
                                _this._gettingImagePending = true;
                                _this.localPromise(musicBrainz.getDirectImageURLAsync(_this.uniqueID, imgUrl)).then1(function (res) {
                                    if (isAbortError(res)) {
                                        _this._gettingImagePending = false;
                                        return;
                                    }
                                    _this._triedImageFromMB = true;
                                    if (res && res.url) { // @ts-ignore
                                        if (_this._localThumbTried && _this._imageCtrl.emptyArtwork) {
                                            _this.artist.saveThumbAsync(res.url).then1(function () {
                                                ODS('Saved image from MB');
                                                _this._gettingImagePending = false;
                                                _this.updateImage();
                                            });
                                        }
                                        else
                                            _this._gettingImagePending = false;
                                    }
                                    else {
                                        _this._gettingImagePending = false;
                                        _this.updateImage();
                                    }
                                });
                                return;
                            }
                            else {
                                _this._triedImageFromMB = true;
                                _this.updateImage();
                            }
                        }
                    }
                    else if (!_this._triedDiscogsRGImage) {
                        if (_this._ds.onlineData) {
                            let relArr = _this._ds.onlineData['relations'];
                            if (relArr && isArray(relArr)) {
                                let rel;
                                for (let i = 0; i < relArr.length; i++) {
                                    rel = relArr[i];
                                    if ((rel.type === 'discogs') && rel.url && rel.url.resource) {
                                        ODS('Getting artist image (Discogs)');
                                        _this._gettingImagePending = true;
                                        let taskid = _this._ds.beginTask(_('Getting') + ' ' + _('artist image') + ' (Discogs)');
                                        _this.localPromise(discogs.fetchArtistImageFromURL(_this.uniqueID, rel.url.resource)).then1(function (dimg) {
                                            if (isAbortError(dimg)) {
                                                _this._gettingImagePending = false;
                                                _this.safeEndTask(taskid);
                                                return;
                                            }
                                            _this._triedDiscogsRGImage = true;
                                            if (dimg && dimg.imglink) { // @ts-ignore
                                                if (_this._localThumbTried && _this._imageCtrl.emptyArtwork) {
                                                    _this.artist.saveThumbAsync(dimg.imglink).then(function () {
                                                        _this._gettingImagePending = false;
                                                        _this.safeEndTask(taskid);
                                                        _this.updateImage();
                                                        _this._imageCtrl.setImageSourceInfo('Discogs', rel.url.resource);
                                                    });
                                                }
                                                else {
                                                    _this._gettingImagePending = false;
                                                    _this.safeEndTask(taskid);
                                                }
                                            }
                                            else {
                                                _this._gettingImagePending = false;
                                                _this.safeEndTask(taskid);
                                                _this.updateImage();
                                            }
                                            return;
                                        });
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    else if (!_this._triedDownloadImage && !_this.isVariousArtist /*&& _this.autoDownloadImage*/) { // we now always search for image in this view
                        _this._triedDownloadImage = true;
                        _this._gettingImagePending = true;
                        let taskid = _this._ds.beginTask(_('Searching') + '...');
                        searchTools.getArtistImage(_this.artist, function (origImgLink) {
                            _this._gettingImagePending = false;
                            if (origImgLink) {
                                _this.updateImage(true);
                            }
                            _this.safeEndTask(taskid);
                        }, {
                            uid: _this.uniqueID,
                            highPriority: true
                        });
                    }
                }
            });
            this._promises.artistThumb = {
                cancel: function () {
                    app.cancelLoaderToken(token);
                    _this._promises.artistThumb = undefined;
                }.bind(this)
            };
        }
        else { // @ts-ignore
            this._imageCtrl.hideImage();
        }
    }
    updateValues() {
        let ds = this.dataSource;
        if (!ds || !this.artist) {
            this.isVariousArtist = false;
            return;
        }
        this.isVariousArtist = _utils.isVariousArtist(this.artist.name);
        super.updateValues();
        this.updateImage();
    }
    getTitle() {
        let ds = this.dataSource;
        if (!ds)
            return '';
        if (this.showingOnline) {
            if (ds.onlineData && ds.onlineData.name)
                return ds.onlineData.name;
        }
        if (!this.artist)
            return '';
        if (this.artist.name)
            return this.artist.name;
        else
            return _('Unknown Artist');
    }
    getParenthesis() {
        let ds = this.dataSource;
        if (!ds || !ds.onlineData || !ds.onlineData['life-span'])
            return '';
        let ls = ds.onlineData['life-span'];
        let fromDate = yearFromDateString(ls.begin);
        let toDate = ls.ended ? yearFromDateString(ls.end) : '';
        if (fromDate || toDate)
            return '' + fromDate + '-' + toDate;
        return '';
    }
    cancelAll() {
        if (searchTools.interfaces.artistSearch)
            searchTools.cancelSearch(searchTools.interfaces.artistSearch, this.uniqueID);
        super.cancelAll();
    }
    setFocus() {
        this.UI.tabMyMusic.focus();
    }
    get artist() {
        if (this.dataSource)
            return this.dataSource.dataObject;
        else
            return undefined;
    }
}
registerClass(ArtistViewHeader);
