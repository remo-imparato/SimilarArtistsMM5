'use strict';

registerFileImport('controls/genreViewHeader');

import ViewHeader from './viewHeader';

/**
@module UI
*/


/**
UI GenreViewHeader element

@class GenreViewHeader
@constructor
@extends ViewHeader
*/

export default class GenreViewHeader extends ViewHeader {
    private _triedLocalImage: boolean;
    thumbToken: any;
    private _gettingImagePending: boolean;

    initialize(rootelem, params) {
        params = params || {};
        params.icon = params.icon || 'genre';
        params.useCollage = true;
        params.useImage = false;
        params.useGenres = false;
        params.disabledOnline = true;
        super.initialize(rootelem, params);
        this.mbDataType = undefined; // MusicBrainz data type
        let UI = this.UI;
        let _this = this;

        // @ts-ignore
        UI.btnMenu.controlClass.menuArray = [{
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
                title: actions.trackProperties.title,
                icon: actions.trackProperties.icon,
                visible: function () {
                    return !_this.showingOnline;
                },
                disabled: function () {
                    if (_this._ds.cache.allTracks)
                        return (_this._ds.cache.allTracks.count === 0);
                    let tracks = _this.genre.getTracklist();
                    return tracks.whenLoaded().then(function () {
                        _this._ds.cache.allTracks = tracks;
                        return (tracks.count === 0);
                    });
                },
                execute: function () {
                    let tracks = _this._ds.cache.allTracks;
                    if (!tracks) {
                        tracks = _this.genre.getTracklist();
                        _this._ds.cache.allTracks = tracks;
                    }
                    uitools.openDialog('dlgTrackProperties', {
                        modal: true,
                        tracks: tracks
                    });
                }
            },
            order: 20,
            grouporder: 40,
        }, {
            action: {
                title: function () {
                    return _('Pin it');
                },
                icon: 'pin',
                visible: function () {
                    return uitools.isPinnedAsync(_this.genre, false);
                },
                execute: function () {
                    uitools.pinItem(_this.genre, true);
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
                    return uitools.isPinnedAsync(_this.genre, true);
                },
                execute: function () {
                    uitools.pinItem(_this.genre, false);
                }
            },
            order: 20,
            grouporder: 50

        }];

        this.localListen(this.UI.headerTitle, 'dblclick', () => {
            if (!this.showingOnline)
                this.setEditMode(true);
        });

        this.localListen(this.UI.headerTitle, 'change', (evt) => {
            if (this.genre) {
                this.genre.name = evt.detail.value;
                this.genre.commitAsync();
            }
        });
    }

    clearData(params) {
        super.clearData(params);
        this._triedLocalImage = false;
        if (this.thumbToken) {
            app.cancelLoaderToken(this.thumbToken);
            this.thumbToken = undefined;
            this._gettingImagePending = false;
        }
    }

    updateImage() {
        let UI = this.UI;
        if (!this.dataSource || this._cleanUpCalled || this._gettingImagePending)
            return;
        let _this = this;
        if (_this.genre && _this.genre.title) {
            let pixelSize = 200;
            if (!_this._triedLocalImage) {
                _this._triedLocalImage = true;
                _this._gettingImagePending = true;
                _this.thumbToken = _this.genre.getThumbAsync(pixelSize, pixelSize, function (imageLink) {
                    _this._gettingImagePending = false;
                    if (imageLink && (imageLink !== '-')) { // @ts-ignore
                        _this._imageCtrl.showImage(imageLink);
                    } else {
                        _this.updateImage();
                    }
                });
            }
        } else { // @ts-ignore
            _this._imageCtrl.hideImage();
        }

    }

    updateValues() {
        let ds = this.dataSource;
        if (!ds || !this.genre)
            return;
        super.updateValues();
        this.updateImage();
    }

    getTitle() {
        if (!this.genre)
            return '';
        if (this.genre.title)
            return this.genre.title;
        else
            return _('Unknown Genre');
    }

    getTracklist() {
        if (!this._ds)
            return undefined;
        this._ds.cache = this._ds.cache || {};
        let tl;
        if (this.showingOnline) {
            if (!this._ds.cache.allOnlineTracks) {
                this._ds.cache.allOnlineTracks = app.utils.createTracklist(false); // not loaded flag;
                this._promises.allOnlineTracks = musicBrainz.getTagTracks(this.uniqueID, this.genre, {
                    tracklist: this._ds.cache.allOnlineTracks
                });
                this._promises.allOnlineTracks.then1(function (allTracksDS) {
                    this._promises.allOnlineTracks = undefined;
                }.bind(this));
            }
            tl = this._ds.cache.allOnlineTracks;
        } else {
            let pars : AnyDict = {};
            let sortString = nodeUtils.getBrowserTracksSortString();

            if (sortString) {
                if (sortString === 'playOrder ASC') {
                    pars.topTracksSort = true;
                } else {
                    pars.sortString = sortString;
                }
            }

            if (!this._ds.cache.allTracks || pars.topTracksSort) {
                this._ds.cache.allTracks = this.genre.getTracklist(pars);
            } else if (sortString) {
                let origList = this._ds.cache.allTracks;
                this._ds.cache.allTracks = app.utils.createTracklist();
                let newList = this._ds.cache.allTracks;
                this.localPromise(origList.setAutoSortAsync(sortString)).then(function () {
                    newList.addList(origList);
                    newList.notifyLoaded();
                });
            }
            tl = this._ds.cache.allTracks;
        }
        return tl;
    }

    setFocus() {
        this.UI.tabMyMusic.focus();
    }

    get genre () {
        if (this.dataSource)
            return this.dataSource.dataObject;
        else
            return undefined;
    }
    
}
registerClass(GenreViewHeader);
