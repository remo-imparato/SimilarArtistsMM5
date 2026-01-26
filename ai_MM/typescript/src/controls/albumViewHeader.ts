'use strict';

registerFileImport('controls/albumViewHeader');

import ViewHeader from './viewHeader';

requirejs('helpers/searchTools');
requirejs('helpers/lang');
requirejs('helpers/discogs');

/**
 * UI AlbumViewHeader element
*/
export default class AlbumViewHeader extends ViewHeader {
    private _triedLocalImage: boolean;
    private _gettingImagePending: boolean;
    private _triedImageFromRelease: boolean;
    private _triedDiscogsRGImage: boolean;
    private _triedWikiImage: boolean;
    private _triedImageFromReleaseGroup: boolean;
    private _triedDownloadImage: any;
    private _mbImageUrl: any;
    private _triedImageFromMB: boolean;
    private _statusInfo: any;
    
    initialize(rootelem, params) {
        params = params || {};
        params.icon = params.icon || 'album';
        params.useCollage = false;
        params.useGenres = true;
        params.descEditSupport = true;
        super.initialize(rootelem, params);
        this.mbDataType = 'release-group'; // MusicBrainz data type
        let UI = this.UI;
        let _this = this;

        // add artist name to header
        UI.beforeDescriptionContainer.innerHTML =
            '<div data-id="albumArtistContainer" class="marginsColumn"><span data-id="albumArtist" class="clickable slightlyLargerText" data-bind="call: trackHyperlinks.albumArtist"></span>' +
            '  <div class="floatRight textRight">' +
            '  <div class="inline">' +
            '    <span data-id="albumTotalTracks" class="inline"></span><br/>' +
            '    <span data-id="albumTotalLength" class="inline"></span></div>' +
            '  </div>' +
            '  <div class="floatRight textRight">' +
            '    <div class="inline"><div data-id="albumRating" data-control-class="Rating" data-init-params="{starMargin: 1, readOnly: true, starWidthX: \'1.5em\'}"></div></div>' +
            '  </div>' +
            '</div>';
        UI.albumArtist = qeid(UI.beforeDescriptionContainer, 'albumArtist');
        UI.albumTotalTracks = qeid(UI.beforeDescriptionContainer, 'albumTotalTracks');
        UI.albumTotalLength = qeid(UI.beforeDescriptionContainer, 'albumTotalLength');
        UI.albumRating = qeid(UI.beforeDescriptionContainer, 'albumRating');
        UI.headerTitleParenthesis.classList.add('clickable');
        UI.headerTitleParenthesis.classList.add('hotlink');
        initializeControls(UI.beforeDescriptionContainer);
        precompileBinding(this.container, this);

        this.localListen(UI.headerTitleParenthesis, 'click', function (e) {
            if ((e.which === 2 /* middle button */) ||
                ((e.which === 1 /* left button */) && e.ctrlKey)) {
                // middle button or CTRL used .. open in new tab
                uitools.navigateInNewTab('year', _this.album);
            } else {
                navigationHandlers.year.navigate(_this.album);
            }
        });
        addEnterAsClick(this, UI.headerTitleParenthesis);

        // @ts-ignore
        this._imageCtrl.saveImageFunc = templates.saveImageToAlbum;
        this._imageCtrl.canBeUsedAsSource = false; // handling will be made for whole header, so we can use track actions here
        if (window.uitools.getCanEdit()) {
            this._imageCtrl.addToContextMenu(menus.tracklistMenuItems.concat([{
                action: {
                    title: actions.coverLookup.title,
                    icon: actions.coverLookup.icon,

                    visible: function () {
                        return (_this.album && (_this.album.id > 0) && window.uitools.getCanEdit());
                    },

                    execute: function () {
                        searchTools.searchAAImageDlg(_this.album, function () {
                            this._triedLocalImage = false; // force to reload local image
                            this.updateImage(true);
                        }.bind(_this), {
                            noDefaultIcon: (_this.album.itemImageType !== 'notsavedimage') && (_this.album.itemImageType !== 'icon')
                        });
                    }
                },
                order: 100,
                grouporder: 50,
            }]));
        }

        _this.localListen(_this.container, 'contextmenu', function () {
            window.lastFocusedControl = _this.container;
            window._lastFocusedLVControl = undefined; // so it always take this control for actions
        }, true);

        dnd.makeImageDroppable(UI.itemImageSquare, function (picturePath) {
            if (picturePath && !_this._cleanUpCalled) {
                uitools.addNewArtwork(picturePath, {
                    album: _this.album,
                    showReplace: true
                }).then(function () {
                    if (!_this._cleanUpCalled) {
                        _this._triedLocalImage = false; // force to reload local image
                        _this.updateImage(true);
                    }
                });
            }
        });

        _this.localListen(_this.UI.headerTitle, 'dblclick', function (e) {
            if (!_this.showingOnline) {
                _this.setEditMode(true);
                e.stopPropagation();
            }

        });

        // @ts-ignore
        UI.btnMenu.controlClass.menuArray = [{
            action: {
                title: function () {
                    if (_this.showingOnline || !app.getValue('autoRenameWrongAlbum', true))
                        return _('Switch') + ' (' + _('Album') + ')';
                    else
                        return _('Switch') + ' / ' + _('Edit') + ' (' + _('Album') + ')';
                },
                submenu: function () {
                    return new Promise(function (resolve, reject) {
                        let ds = _this._ds.cache.foundReleaseGroupsSelect;
                        let retArray = [];
                        if (_this._ds.cache && _this._ds.cache.foundReleaseGroupsSelect && (_this._ds.cache.foundReleaseGroupsSelect.count > 1)) {
                            ds.forEach(function (rgHTML, i) {
                                retArray.push({
                                    action: {
                                        title: rgHTML.toString(),
                                        checked: function () {
                                            return _this._ds.cache.foundReleaseGroupsSelect.focusedIndex === i;
                                        },
                                        execute: function () {
                                            let rgObj = _this._ds.cache.foundReleaseGroups[i];
                                            let art = rgObj['artist-credit'];
                                            let albumArtist = '';
                                            if (art && (art.length > 0)) {
                                                let art0 = art[0];
                                                if (art0.artist && art0.artist.name) {
                                                    albumArtist = art0.artist.name;
                                                }
                                            }

                                            if (!_this.showingOnline && app.getValue('autoRenameWrongAlbum', true) && ((rgObj.title !== _this.album.title) || (albumArtist && (albumArtist !== _this.album.albumArtist)))) {
                                                _this.album.mbrggid = rgObj.id;
                                                _this.album.mbgid = '';
                                                if (!_this._ds.cache.foundReleaseGroups[i].isAnother)
                                                    _this.renameAlbum(_this._ds.cache.foundReleaseGroups[i].title, albumArtist, true);
                                            } else {
                                                if ((i >= 0) && (_this.album.mbrggid !== rgObj.id)) {
                                                    _this.clearData({
                                                        clearAll: true
                                                    });
                                                    _this._ds.switchToOtherReleaseGroup(i);
                                                }
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
                                title: _('Update properties'),
                                visible: function () {
                                    return !_this.showingOnline;
                                },
                                checkable: true,
                                checked: function () {
                                    return app.getValue('autoRenameWrongAlbum', true);
                                },
                                execute: function () {
                                    let newVal = !app.getValue('autoRenameWrongAlbum', true);
                                    app.setValue('autoRenameWrongAlbum', newVal);
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
                title: _('Switch') + ' (' + _('Release') + ')',
                visible: function () {
                    return _this.showingOnline && _this._ds.cache && _this._ds.cache.foundReleasesSelect && (_this._ds.cache.foundReleasesSelect.count > 1);
                },
                submenu: function () {
                    return new Promise(function (resolve, reject) {
                        let ds = _this._ds.cache.foundReleasesSelect;
                        let retArray = [];
                        ds.forEach(function (relHTML, i) {
                            retArray.push({
                                title: relHTML.toString(),
                                checked: function () {
                                    return _this._ds.cache.foundReleasesSelect.focusedIndex === i;
                                },
                                execute: function () {
                                    _this._ds.switchToOtherRelease(i);
                                }
                            });
                        });
                        resolve(retArray);
                    });
                }
            },
            order: 20,
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
                        retArray.push({ // @ts-ignore
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
                title: _('Edit album in MusicBrainz'),
                visible: function () {
                    return !!_this.album && !!_this.album.mbrggid;
                },
                execute: function () {
                    app.utils.web.openURL(musicBrainz.getMBEditLink('release-group', _this.album.mbrggid));
                }
            },
            order: 30,
            grouporder: 30,
        }, {
            action: {
                title: _('Edit release in MusicBrainz'),
                visible: function () {
                    return !!_this.album && !!_this.album.mbgid && (_this.album.mbrggid !== '0'); // cannot edit/add release of unknown album
                },
                execute: function () {
                    app.utils.web.openURL(musicBrainz.getMBEditLink('release', _this.album.mbgid));
                }
            },
            order: 40,
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
                    if (!window.uitools.getCanEdit())
                        return true;
                    return !_this._ds.currentTracklist || (_this._ds.currentTracklist.count === 0);
                },
                execute: function () {
                    uitools.openDialog('dlgTrackProperties', {
                        modal: true,
                        tracks: _this._ds.currentTracklist,
                        //selectTab: 'tabArtwork'
                    });
                }
            },
            order: 30,
            grouporder: 40
        }, {
            action: {
                title: function () {
                    return _('Pin it');
                },
                icon: 'pin',
                visible: function () {
                    return uitools.isPinnedAsync(_this.album, false);
                },
                execute: function () {
                    uitools.pinItem(_this.album, true);
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
                    return uitools.isPinnedAsync(_this.album, true);
                },
                execute: function () {
                    uitools.pinItem(_this.album, false);
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
                        return !!_this.album && _this.showingOnline;
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
                                        TrackShortcuts[idx].execute('album', 'album', _this.album);
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
            }
            */
        ];
        this.localListen(this.UI.headerTitle, 'change', function (evt) { // @ts-ignore
            _this.renameAlbum(evt.detail.value);
        });
        this.enableDragNDrop();
        this.localListen(this.UI.wikiDescription, 'change', function (e) {
            if (this.showingOnline)
                return;
            this.album.description = e.detail.value;
            this.album.commitAsync();
        }.bind(this));

        if (UI.searchWikiLink) {
            this.localListen( UI.searchWikiLink, 'click', () => {
                setVisibility( UI.searchWikiText, false);
                setVisibility( UI.searchWikiLink, false);
                this._ds.fetchMBData();
            });
            addEnterAsClick(this, UI.searchWikiLink);
        }
    }

    canDrop(e) {
        let allowed = !this.showingOnline && !dnd.isSameControl(e) && (dnd.isAllowedType(e, 'cover') || dnd.isAllowedType(e, 'media'));
        if (allowed && e.dataTransfer) {
            let src = e.dataTransfer.getSourceControl();
            allowed = !src || !this.container.contains(src);
        }
        return this.dndEventsRegistered && allowed;
    }

    drop(e) {
        if (dnd.isAllowedType(e, 'cover')) {
            // dropped cover
            if (this.UI.itemImageSquare.controlClass && this.UI.itemImageSquare.controlClass.drop) { // @ts-ignore
                this.UI.itemImageSquare.controlClass.drop(e);
            }
        } else {
            // media files
        }
    }

    canDeleteSelected() {
        return !this.showingOnline;
    }

    renameAlbum(newTitle, newArtist, setTitleText) {
        let oldTitle = this.album.title;
        let oldArtist = this.album.albumArtist;

        let setTitle = function () {
            if (!this.showingOnline && setTitleText) {
                this.UI.headerTitle.innerText = newTitle;
            }
            if (newArtist) {
                this.album.albumArtist = newArtist;
                this._ds.onlineData.artistName = newArtist;
            }
            this.album.title = newTitle;
            this.localPromise(this.album.commitAsync()).then(function () {
                // reload view, album cloud be merged
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
            }.bind(this));
        }.bind(this);

        this.localPromise(this.album.getNumberOfTracks()).then(function (cnt) {
            let sett = window.settings.get('System');
            if ((cnt <= 50) || (!sett.System.AskUserMassEdit)) {
                setTitle();
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
                    setTitle();
                } else {
                    if (!this.showingOnline)
                        this.UI.headerTitle.innerText = oldTitle;
                }
            }.bind(this));
        }.bind(this));
    }

    _processMBCoverObj(cvrObj) {
        if (cvrObj && cvrObj.images && cvrObj.images.length > 0) {
            let pathL = undefined;
            let pathS = undefined;
            let pathImg = undefined;
            let img = cvrObj.images[0];
            if (img.thumbnails) {
                if (img.thumbnails.small)
                    pathS = img.thumbnails.small;
                if (img.thumbnails.large)
                    pathL = img.thumbnails.large;
            }
            if (img.image) {
                pathImg = img.image;
            }
            pathImg = pathImg || pathL || pathS;
            if (pathImg) {
                if (this.album) {
                    return this.album.saveThumbAsync(pathImg, true /* from auto search */);
                }
            }
        }
        return dummyPromise();
    }

    showImage(imgLink, pathToOrigCachedFile) {
        this._ds.cache.albumImage = imgLink;
        this._ds.cache.cachedAlbumImage = pathToOrigCachedFile; // @ts-ignore
        this._imageCtrl.showImage(imgLink, pathToOrigCachedFile);
    }

    updateImage(forceUpdate?:boolean) {
        let UI = this.UI;
        if (!this.album || this._cleanUpCalled || this._gettingImagePending)
            return; // @ts-ignore
        if (!forceUpdate && !this._imageCtrl.emptyArtwork)
            return;
        if (forceUpdate)
            this._ds.cache.albumImage = undefined;
        else if (this._ds.cache.albumImage && (this.album.itemImageType !== 'icon')) { // @ts-ignore
            this._imageCtrl.showImage(this._ds.cache.albumImage, this._ds.cache.cachedAlbumImage);
            return;
        }

        let _this = this;
        if (_this.album && (_this.album.itemImageType !== 'icon')) {
            if(_this._triedLocalImage && !_this.autoDownloadImage && !app.getValue('InfoPanelAutoLookup', true))
                return; // do not search for image if we already tried to get it and user does not want to auto lookup

            let pixelSize = 500;
            if (!_this._triedLocalImage) {
                _this._triedLocalImage = true;
                _this._gettingImagePending = true;
                cancelPromise(_this._promises.albumThumb);
                let cancelToken = _this.album.getThumbAsync(pixelSize, pixelSize, function (imageLink, pathToOrigCachedFile) {
                    _this._promises.albumThumb = undefined;
                    _this._gettingImagePending = false;
                    if (imageLink && (imageLink !== '-')) {
                        _this.showImage(imageLink, pathToOrigCachedFile);
                    } else { // @ts-ignore
                        _this._imageCtrl.hideImage();
                        _this.updateImage();
                    }
                });
                _this._promises.albumThumb = {
                    cancel: function () {
                        app.cancelLoaderToken(cancelToken);
                        _this._gettingImagePending = false;
                        _this._promises.albumThumb = undefined;
                    }.bind(this)
                };
            } else if (!_this._triedImageFromRelease && _this.album.mbgid) {
                _this._triedImageFromRelease = true;
                if (_this._ds.onlineData && _this._ds.onlineData._releaseHasCover) {
                    _this._gettingImagePending = true;
                    let taskid = _this._ds.beginTask(_('Getting') + ' ' + _('album image'));
                    musicBrainz.getReleaseCover(_this.uniqueID, _this.album.mbgid).then1(function (cvrObj) {
                        if (isAbortError(cvrObj)) {
                            _this.safeEndTask(taskid);
                            _this._gettingImagePending = false;
                            return;
                        }
                        cancelPromise(_this._promises.albumSaveImage);
                        _this._promises.albumSaveImage = _this._processMBCoverObj(cvrObj);
                        _this._promises.albumSaveImage.then1(function (ret) {
                            _this.safeEndTask(taskid);
                            _this._gettingImagePending = false;
                            _this._promises.albumSaveImage = undefined;
                            if (!ret || !isAbortError(ret)) {
                                if (ret === 1) { // saved to temp/tags, read local image again
                                    _this._triedLocalImage = false;
                                }
                                _this.updateImage();
                            }
                        });
                    });
                } else {
                    _this.updateImage();
                }
            } else if (!_this._triedImageFromReleaseGroup && _this.album.mbrggid) {
                _this._triedImageFromReleaseGroup = true;
                let taskid = _this._ds.beginTask(_('Getting') + ' ' + _('album image'));
                _this._gettingImagePending = true;
                musicBrainz.getReleaseGroupCover(_this.uniqueID, _this.album.mbrggid).then1(function (cvrObj) {
                    if (isAbortError(cvrObj)) {
                        _this.safeEndTask(taskid);
                        _this._gettingImagePending = false;
                        return;
                    }
                    cancelPromise(_this._promises.albumSaveImage);
                    _this._promises.albumSaveImage = _this._processMBCoverObj(cvrObj);
                    _this._promises.albumSaveImage.then1(function (ret) {
                        _this.safeEndTask(taskid);
                        _this._gettingImagePending = false;
                        _this._promises.albumSaveImage = undefined;
                        if (!ret || !isAbortError(ret)) {
                            if (ret === 1) { // saved to temp/tags, read local image again
                                _this._triedLocalImage = false;
                            }
                            _this.updateImage();
                        }
                    });
                });
            } else if (!_this._triedDiscogsRGImage && _this.album.mbrggid) {
                _this._triedDiscogsRGImage = true;
                let taskid = _this._ds.beginTask(_('Getting') + ' ' + _('album image') + ' (Discogs)');
                _this._gettingImagePending = true;
                ODS('Getting album image (Discogs) - relations');
                musicBrainz.getReleaseGroupRelations(_this.uniqueID, _this.album.mbrggid).then1(async function (relArr) {
                    if (isAbortError(relArr)) {
                        _this.safeEndTask(taskid);
                        _this._gettingImagePending = false;
                        return;
                    }
                    if(relArr && isArray(relArr)) {
                        let rel;
                        for(let i=0; i<relArr.length;i++) {
                            rel = relArr[i];
                            if((rel.type === 'discogs') && rel.url && rel.url.resource) {
                                try {
                                    ODS('Getting album image (Discogs) - image link');
                                    let dimg = await discogs.fetchMasterImageFromURL(_this.uniqueID, rel.url.resource);
                                    if(dimg && dimg.imglink) {
                                        cancelPromise(_this._promises.albumSaveImage);
                                        _this._promises.albumSaveImage = _this.album.saveThumbAsync(dimg.imglink, true /* from auto search */);
                                        _this._promises.albumSaveImage.then1(function (ret) {
                                            _this.safeEndTask(taskid);
                                            _this._gettingImagePending = false;
                                            _this._promises.albumSaveImage = undefined;
                                            if (!ret || !isAbortError(ret)) {
                                                if (ret === 1) { // saved to temp/tags, read local image again
                                                    _this._triedLocalImage = false;
                                                    _this.updateImage();
                                                } else {
                                                    // not saved for some reason, try to fill original links
                                                    _this.showImage(dimg.thumblink, dimg.imglink);
                                                }
                                                _this._imageCtrl.setImageSourceInfo('Discogs', rel.url.resource);
                                            }
                                        });                
                                        return;
                                    }
                                } catch(e) {
                                    ODS('Fetching Discogs image failed, ' + rel.url.resource);
                                }
                            }
                        }
                    }
                    _this.safeEndTask(taskid);
                    _this._gettingImagePending = false;
                    _this.updateImage();
                });
            } else if (!_this._triedWikiImage && _this._ds.onlineData && _this._ds.onlineData.wikiUrl) {
                _this._triedWikiImage = true;
                _this._gettingImagePending = true;
                let taskid = _this._ds.beginTask(_('Getting') + ' ' + _('album image') + ' (Wikipedia)');
                musicBrainz.getWikiPageImage(_this.uniqueID, _this._ds.onlineData.wikiUrl, 250).then1(function (res) {
                    if (!isAbortError(res) && res && res.url && _this.album) {
                        cancelPromise(_this._promises.albumSaveImage);
                        _this._promises.albumSaveImage = _this.album.saveThumbAsync(res.url, true /* from auto search */);
                        _this._promises.albumSaveImage.then1(function (ret) {
                            _this.safeEndTask(taskid);
                            _this._gettingImagePending = false;
                            _this._promises.albumSaveImage = undefined;
                            if (!ret || !isAbortError(ret)) {
                                if (ret === 1) { // saved to temp/tags, read local image again
                                    _this._triedLocalImage = false;
                                    _this.updateImage();
                                } else {
                                    // not saved for some reason, try to fill original links
                                    _this.showImage(res.thumb, res.url);
                                }
                            }
                        });
                    } else {
                        _this.safeEndTask(taskid);
                        _this._gettingImagePending = false;
                        _this.updateImage();
                    }
                });
            } else if (_this._triedImageFromRelease && _this._triedImageFromReleaseGroup && !_this._triedDownloadImage /*&& _this.autoDownloadImage*/) { // we now always search for image in this view
                _this._triedDownloadImage = true;
                let taskid = _this._ds.beginTask(_('Searching') + '...');
                if (_this._promises.imageSearchParams) {
                    _this._promises.imageSearchParams.cancel();
                }
                _this._promises.imageSearchParams = {
                    highPriority: true,
                    canceled: false,
                    cancel: function () {
                        this.canceled = true;
                        _this.safeEndTask(taskid);
                        _this._promises.imageSearchParams = undefined;
                    }
                };
                searchTools.getAAImage(_this.album, function (origImgLink) {
                    if (origImgLink) {
                        cancelPromise(_this._promises.albumSaveImage);
                        _this._promises.albumSaveImage = _this.album.saveThumbAsync(origImgLink, true /* from auto search */);
                        _this._promises.albumSaveImage.then1(function (ret) {
                            _this.safeEndTask(taskid);
                            _this._gettingImagePending = false;
                            _this._promises.albumSaveImage = undefined;
                            if (!ret || !isAbortError(ret)) {
                                if (ret === 1) { // saved to temp/tags, read local image again
                                    _this._triedLocalImage = false;
                                    _this.updateImage();
                                } else {
                                    // not saved for some reason, try to fill original link
                                    _this.showImage(origImgLink, origImgLink);
                                }
                            }
                        });
                    } else {
                        _this.safeEndTask(taskid);
                    }
                    _this._promises.imageSearchParams = undefined;
                }, _this._promises.imageSearchParams);
            }
        } else { // @ts-ignore
            this._imageCtrl.hideImage();
        }
    }

    clearData(params) {
        super.clearData(params);
        enterLayoutLock(this.container);
        let UI = this.UI;
        this._mbImageUrl = undefined;
        this._triedDownloadImage = false;
        this._triedImageFromMB = false;
        this._triedWikiImage = false;
        this._triedImageFromReleaseGroup = false;
        this._triedImageFromRelease = false;
        this._triedDiscogsRGImage = false;
        if (params && params.clearAll) {
            this._triedLocalImage = false;
        }
        leaveLayoutLock(this.container);
    }

    updateValues() {
        let ds = this.dataSource;
        if (!ds || !this.album) {
            setVisibility(this.UI.albumRating, false);
            return;
        }
        this._triedLocalImage = false; // to refetch image after DS change
        if (!ds.onlineData && app.getValue('InfoPanelAutoLookup', true)) {
            this._ds.fetchMBData();
        }
        if (!this.showingOnline) {
            this.localPromise(this.album.getRatingAsync()).then(function (rating) {
                setVisibility(this.UI.albumRating, true);
                this.UI.albumRating.controlClass.value = rating;
            }.bind(this));
        } else
            setVisibility(this.UI.albumRating, false);
        super.updateValues();
        this.updateImage();
        if (this._statusInfo) {
            this.UI.albumTotalTracks.innerText = this._statusInfo.totalCount + ' ' + (_('track', 'tracks', this._statusInfo.totalCount));
            this.UI.albumTotalLength.innerText = getFormatedTime(this._statusInfo.totalLength, {
                useEmptyHours: false
            });
        } // @ts-ignore
        if (this.bindFn) // @ts-ignore
            this.bindFn(this.container, this.dataSource);
    }

    setStatus(data) {
        this._statusInfo = data;
        this.updateValues();
    }

    getTitle() {
        let ds = this.dataSource;
        if (!ds)
            return '';
        let retval = '';
        if (this.showingOnline && this.album && (this.album.mbrggid !== '0')) {
            if (ds.onlineData) {
                if (ds.onlineData.title)
                    retval = ds.onlineData.title;
            }
        }
        if (!retval && this.album) {
            if (this.album.title) {
                retval = this.album.title;
            } else {
                retval = _('Unknown Album');
            }
        }
        return retval;
    }

    getParenthesis() {
        let ds = this.dataSource;
        if (!ds)
            return '';
        if (this.showingOnline) {
            if (ds.onlineData && ds.onlineData.year)
                return ds.onlineData.year;
        } else {
            if (this.album && (this.album.year > 0))
                return this.album.year;
        }
        return '';
    }

    cancelAll() {
        if (searchTools.interfaces.aaSearch)
            searchTools.cancelSearch(searchTools.interfaces.aaSearch, this.uniqueID);
        super.cancelAll();
    }

    dataSourceChangeHandler(params) {
        if (params) {
            if (params.eventType === 'artwork') {
                this._triedDownloadImage = false;
                this._triedImageFromMB = false;
                this._triedWikiImage = false;
                this._triedImageFromReleaseGroup = false;
                this._triedImageFromRelease = false;
                this._triedDiscogsRGImage = false;
                this._triedLocalImage = false;
                this.updateImage(true);
                return; // changed only artwork, no need to call other updates
            }
        }
        super.dataSourceChangeHandler(arguments);
    }

    get album() {
        if (this.dataSource)
            return this.dataSource.dataObject;
        else
            return undefined;
    }
}
registerClass(AlbumViewHeader);
