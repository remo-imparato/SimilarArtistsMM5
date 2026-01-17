/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

'use strict';
registerFileImport('controls/artistAlbums');
import Control from './control';
/**
 * UI ArtistAlbums element
 */
export default class ArtistAlbums extends Control {
    initialize(rootelem, params) {
        enterLayoutLock(rootelem);
        super.initialize(rootelem, params);
        this.isSearchable = true;
        this.showingOtherAlbums = false;
        this.isSomeOtherAlbum = false;
        this._promises = {};
        this.initializeView();
        this.helpContext = 'Filelisting';
        leaveLayoutLock(rootelem);
    }
    commonChange(obj, type, instance) {
        if (obj === 'artist') {
            if (type === 'modify' && instance == this.artist) {
                // this.doRefreshInternal();
            }
        }
        else if (obj === 'track') {
            if (this.artist && (this.artist.id <= 0) && instance && (instance.albumArtist === this.artist.name)) {
                // this artist was added to library, get its id and refresh local content and toolbar
                app.getObject('artist', {
                    name: instance.albumArtist,
                    mbgid: this.artist.mbgid
                }).then(function (newObj) {
                    if (newObj && this.artist && (this.artist.id <= 0) && instance && (instance.albumArtist === this.artist.name)) {
                        this.artist.id = newObj.id;
                        actions.view.refresh.execute(); // refresh toolbar and content
                    }
                }.bind(this));
            }
        }
        else {
            // commented now, we don't know, what has changed, it leads to deadlocks then
            /*            if (this.artist && (this.artist.id > 0)) {
                            app.getObject('artist', {
                                id: this.artist.id,
                                mbgid: this.artist.mbgid
                            }).then(function (newObj) {
                                if (newObj) {
                                    this.dataSource = {
                                        artist: newObj
                                    }; // do refresh
                                } else { // go back in history
                                    window.actions.history.backward.execute();
                                }
                            }.bind(this));
                        }*/
        }
    }
    setAlbumsTitle(cnt) {
        let t = _('Albums');
        if ((cnt !== undefined) && (cnt >= 5)) {
            t += ' (' + cnt + ')';
        }
        this.UI.albumsTitle.textContent = t;
        setVisibility(this.UI.albumsTitle, !!cnt || (this.showingOnline && this.isSomeOtherAlbum));
    }
    setLVVis(defObj, vis) {
        setVisibility(this.UI[defObj.lvName], vis);
        if (defObj.titleName)
            setVisibility(this.UI[defObj.titleName], vis); // @ts-ignore
        this.UI[defObj.lvName].controlClass.disableStatusbar = (defObj.lvName !== 'musicBrainzAlbums'); // not supported now, status bar would be overloaded
    }
    clearArtistData(clearAll /* if true, clear also foundArtists, we are changing whole data source */) {
        enterLayoutLock(this.scrollingParent); // lock scrollingParent for correct update of siblings/subviews in Scroller
        this.isSomeOtherAlbum = false;
        let UI = this.UI;
        forEach(mbListDefs, function (defObj, idx) {
            let lv = UI[defObj.lvName];
            lv.controlClass.dataSource = null;
            this.setLVVis(defObj, false);
        }.bind(this));
        this.cancelAll();
        this.myMusicSet = false;
        this.wasError = false;
        this._onlineDataParsed = false;
        if (clearAll) {
            this.foundArtists = undefined;
            UI.foundArtistsSelect.controlClass.dataSource = null;
        }
        leaveLayoutLock(this.scrollingParent);
    }
    updateViewRequest() {
        this.requestTimeout(this.updateView.bind(this), 50, 'updateView');
        //        this.requestFrame(this.updateView.bind(this)); // JH: Better this way?
    }
    updateView() {
        let UI = this.UI;
        if (!UI)
            return;
        enterLayoutLock(this.scrollingParent); // lock scrollingParent for correct update of siblings/subviews in Scroller
        let _this = this;
        let showOnline = _this.showingOnline;
        let isDSSet = !!this._ds;
        if (isDSSet && (this._ds.cache.foundArtists !== this.foundArtists)) {
            this.foundArtists = this._ds.cache.foundArtists;
            this.UI.foundArtistsSelect.controlClass.dataSource = this._ds.cache.foundArtistsSelect;
        }
        setVisibility(UI.artistAlbumlist, isDSSet && !showOnline);
        setVisibility(UI.albumSortByContainer, isDSSet && !showOnline && UI.artistAlbumlist.controlClass.dataSource && (UI.artistAlbumlist.controlClass.dataSource.count > 1));
        setVisibility(UI.foundArtistsSelect, isDSSet && showOnline && this.foundArtists && this.shouldShowWrongArtist(true));
        setVisibility(UI.showOtherAlbums, isDSSet && showOnline && !this.showingOtherAlbums && this.isSomeOtherAlbum);
        setVisibility(UI.showLessAlbums, isDSSet && showOnline && this.showingOtherAlbums && this.isSomeOtherAlbum);
        if (!showOnline) {
            forEach(mbListDefs, function (defObj) {
                _this.setLVVis(defObj, false);
            });
            let callUpdate = false;
            if (isDSSet && !_this.myMusicSet && _this.artist) {
                _this.setAlbumsTitle();
                _this.myMusicSet = true;
                if (_this._ds.cache.artistAlbumlist) {
                    // read from cache
                    UI.artistAlbumlist.controlClass.dataSource = _this._ds.cache.artistAlbumlist;
                    _this.setAlbumsTitle(_this._ds.cache.artistAlbumlist.count);
                    callUpdate = true;
                }
                else {
                    let lst; // @ts-ignore
                    if (UI.albumSortByControl.controlClass.sortString) // @ts-ignore
                        lst = _this.artist.getItemList('albums', UI.albumSortByControl.controlClass.sortString);
                    else
                        lst = _this.artist.getItemList('albums');
                    UI.artistAlbumlist.controlClass.dataSource = lst;
                    _this._promises.artistAlbumlist = lst.whenLoaded();
                    _this.dataSourcePromise(_this._promises.artistAlbumlist).then(function () {
                        _this._promises.artistAlbumlist = undefined;
                        if (_this._ds && _this._ds.cache) {
                            _this._ds.cache.artistAlbumlist = UI.artistAlbumlist.controlClass.dataSource;
                            if (!_this.showingOnline) {
                                _this.setAlbumsTitle(lst.count);
                                _this.updateViewRequest();
                            }
                        }
                    }, function () {
                        _this._promises.artistAlbumlist = undefined;
                    });
                }
                _this.localListen(UI.artistAlbumlist.controlClass.dataSource, 'change', _this.updateViewRequest.bind(_this));
            }
            else {
                if (UI.artistAlbumlist.controlClass.dataSource) {
                    _this.setAlbumsTitle(UI.artistAlbumlist.controlClass.dataSource.count);
                }
                else {
                    _this.setAlbumsTitle();
                }
            }
            if (callUpdate)
                _this.updateViewRequest();
        }
        else {
            forEach(mbListDefs, function (defObj, idx) {
                let lv = UI[defObj.lvName];
                let vis = isDSSet && (lv.controlClass.dataSource && (lv.controlClass.dataSource.count > 0)) && ((idx === 0) || _this.showingOtherAlbums);
                _this.setLVVis(defObj, vis);
            });
            if (!_this.onlineEventsSet) {
                forEach(mbListDefs, function (defObj) {
                    _this.localListen(UI[defObj.lvName], 'itemdblclick', _this.openRelease.bind(_this));
                    _this.localListen(UI[defObj.lvName], 'itementer', _this.openRelease.bind(_this));
                    _this.localListen(UI[defObj.lvName], 'itemview', _this.openRelease.bind(_this));
                });
                _this.localListen(UI.foundArtistsSelect, 'change', function () {
                    if (!_this._ds || !_this.foundArtists || !_this.foundArtists.length)
                        return;
                    // @ts-ignore    
                    let i = UI.foundArtistsSelect.controlClass.focusedIndex;
                    _this.artist.mbgid = _this.foundArtists[i].id;
                    if (_this.artist.id > 0)
                        _this.artist.commitAsync();
                    _this._ds.switchToOtherArtist(i);
                });
                _this.onlineEventsSet = true;
            }
            if (isDSSet && _this._ds.onlineData && !_this._onlineDataParsed) {
                _this.parseOnlineData();
                _this._onlineDataParsed = true;
            }
            else {
                let lv = UI[mbListDefs[0].lvName];
                if (lv.controlClass.dataSource) {
                    _this.setAlbumsTitle(lv.controlClass.dataSource.count);
                }
                else {
                    _this.setAlbumsTitle();
                }
            }
        }
        leaveLayoutLock(this.scrollingParent);
    }
    shouldShowWrongArtist(isStrict) {
        let ds = this.UI.foundArtistsSelect.controlClass.dataSource;
        let retval = ds && (ds.count > 1) && (this.foundArtists.length > 1);
        if (isStrict && retval) {
            // more strict mode - test score of the first and other result for guessed artist
            if (this._ds.mbgidIsGuessed) {
                let s0 = Number(this.foundArtists[0].score);
                let s1 = Number(this.foundArtists[1].score);
                retval = !((s0 > 95) && (s1 < 75)) && !((s0 > 80) && (s1 < 30));
            }
            else
                retval = false;
        }
        return retval;
    }
    initializeView() {
        let rootelem = this.container;
        let _this = this;
        this.container.innerHTML = loadFile('file:///controls/artistAlbums.html');
        initializeControls(this.container);
        this.UI = getAllUIElements(this.container);
        let UI = this.UI;
        this.showingOnline = uitools.globalSettings ? !!uitools.globalSettings.showingOnline : false;
        this.localListen(UI.showOtherAlbumsText, 'click', function () {
            _this.showingOtherAlbums = true;
            _this.updateView();
        });
        this.localListen(UI.showLessAlbumsText, 'click', function () {
            _this.showingOtherAlbums = false;
            _this.updateView();
            deferredNotifyLayoutChangeDown(_this.scrollingParent, 'scrollerContentChanged'); // #20968
        });
        addEnterAsClick(this, UI.showOtherAlbumsText);
        addEnterAsClick(this, UI.showLessAlbumsText);
        this.localListen(UI.artistAlbumlist, 'itemdblclick', this.navigateAlbum.bind(this));
        this.localListen(UI.artistAlbumlist, 'itementer', this.navigateAlbum.bind(this));
        this.localListen(UI.artistAlbumlist, 'itemview', this.navigateAlbum.bind(this));
        this.localListen(UI.artistAlbumlist, 'datasourcechanged', function () {
            let ds = UI.artistAlbumlist.controlClass.dataSource;
            if (ds)
                _this.localPromise(ds.whenLoaded()).then(function () {
                    _this.setAlbumsTitle(ds.count); // to hide header when there are no matches (when searching/filtering)
                });
        });
        this.localListen(UI.albumSortByControl, 'change', function () {
            if (UI.artistAlbumlist.controlClass.dataSource) { // @ts-ignore
                UI.artistAlbumlist.controlClass.dataSource.setAutoSortAsync(UI.albumSortByControl.controlClass.sortString);
            }
        });
        _this.updateView();
    }
    initializeValues() {
        /*        this.localListen(this.artist, 'change', function () {
                    if (!this.artist.deleted)
                        this.initializeValues();
                }.bind(this));*/
        this.updateViewRequest(); // to show already known values
        //this._ds.fetchMBData();
    }
    openRelease(evt) {
        let item = evt.detail.item;
        this.localPromise(app.getObject('album', {
            name: item.title,
            artist: this.artist.name,
            mbrggid: item.mbrggid,
            canCreateNew: true
        })).then(function (albObj) {
            if (albObj) {
                if (isNewTabEvent(evt)) {
                    uitools.navigateInNewTab('album', albObj);
                }
                else
                    navigationHandlers.album.navigate(albObj);
            }
        }.bind(this));
    }
    parseOnlineData() {
        let _this = this;
        let artistName = _this._ds.onlineData.name;
        let artistId = _this._ds.onlineData.id;
        let callUpdate = false;
        let UI = _this.UI;
        // process release groups        
        if (_this._ds.cache.lvDS) {
            // set data sources from cache
            forEach(mbListDefs, function (defObj, idx) {
                let lvName = defObj.lvName;
                UI[lvName].controlClass.dataSource = _this._ds.cache.lvDS[lvName];
                if (_this._ds.cache.lvDS[lvName] && (_this._ds.cache.lvDS[lvName].count > 0))
                    _this.isSomeOtherAlbum = true;
            });
            callUpdate = true;
        }
        else {
            let rg = _this._ds.onlineData['release-groups'];
            let getLVindex = function (primaryType, secondaryTypes, status) {
                let retval = mbListDefs.length - 1; // default goes to the last group - other
                let lobj;
                secondaryTypes = secondaryTypes || [];
                for (let i = 0; i < mbListDefs.length; i++) {
                    lobj = mbListDefs[i];
                    if (!lobj.onlyOfficial || (status === 'Official')) {
                        if (lobj.primaryType === primaryType) {
                            if (lobj.noSecondaryType) {
                                if (secondaryTypes.length === 0) {
                                    retval = i;
                                    break;
                                }
                            }
                            else if (lobj.secondaryType) {
                                if (lobj.secondaryType === secondaryTypes[0]) {
                                    retval = i;
                                    break;
                                }
                            }
                            else {
                                retval = i;
                                break;
                            }
                        }
                    }
                }
                return retval;
            };
            let tmpRGs = [];
            forEach(mbListDefs, function (defObj) {
                tmpRGs.push([]);
            });
            let lvidx;
            if (rg) {
                forEach(rg, function (item) {
                    lvidx = getLVindex(item['primary-type'], item['secondary-types'], item['status']);
                    tmpRGs[lvidx].push(item);
                });
            }
            let fillAlbumList = function (albumList, rgArray) {
                return albumList.asyncFill(rgArray.length, function (idx, album) {
                    musicBrainz.fillAlbumFromRG(album, rgArray[idx]);
                });
            };
            _this.fillAlbumsPromises = [];
            forEach(mbListDefs, function (defObj, idx) {
                let lvds = app.utils.createAlbumlist(false); // not loaded flag
                lvds.setAutoSortAsync('year ASC');
                UI[defObj.lvName].controlClass.dataSource = lvds;
                //ODS('--- adding promise for ' + defObj.lvName + ', ' + tmpRGs[idx].length + ' albums');                
                if (tmpRGs[idx].length > 0)
                    _this.fillAlbumsPromises.push(fillAlbumList(lvds, tmpRGs[idx]));
                if (tmpRGs[idx].length > 0) {
                    if (idx > 0) {
                        _this.isSomeOtherAlbum = true;
                    }
                    if (_this.showingOnline && ((idx === 0) || _this.showingOtherAlbums))
                        _this.setLVVis(defObj, true);
                }
            });
            let finishReadingAlbums = function () {
                if (!_this._ds)
                    return;
                _this._ds.cache.lvDS = {};
                //ODS('--- finished reading albums');
                forEach(mbListDefs, function (defObj, idx) {
                    let albumList = UI[defObj.lvName].controlClass.dataSource;
                    if (albumList) {
                        _this._ds.cache.lvDS[defObj.lvName] = albumList;
                        albumList.notifyLoaded();
                    }
                });
                if (_this.showingOnline)
                    _this.updateViewRequest();
            };
            if ((rg && (rg.length >= 100)) || (!rg)) {
                //ODS('--- going to read next albums');
                _this.updateViewRequest();
                // read the rest of items
                let offset = rg ? rg.length : 0;
                _this._promises.getArtistReleaseGroups = musicBrainz.getArtistReleaseGroups(_this.uniqueID, artistId, {
                    offset: offset,
                    artistName: artistName
                });
                _this._promises.getArtistReleaseGroups.then(function (rg) {
                    _this._promises.getArtistReleaseGroups = undefined;
                    //ODS('--- next albums received');
                    if (rg && _this.fillAlbumsPromises) {
                        let tmpDS = [];
                        let tmpRGs = [];
                        forEach(mbListDefs, function (defObj) {
                            tmpRGs.push([]);
                        });
                        forEach(rg, function (item) {
                            lvidx = getLVindex(item['primary-type'], item['secondary-types'], item['status']);
                            tmpRGs[lvidx].push(item);
                        });
                        //ODS('--- waiting for album promises 1');
                        whenAll(_this.fillAlbumsPromises).then(function () {
                            //ODS('--- fill albums finished, adding next');
                            _this.fillAlbumsPromises = [];
                            forEach(mbListDefs, function (defObj, idx) {
                                tmpDS[idx] = app.utils.createAlbumlist(false); // not loaded flag
                                _this.fillAlbumsPromises.push(fillAlbumList(tmpDS[idx], tmpRGs[idx]).then(function () {
                                    let lvds = UI[defObj.lvName].controlClass.dataSource;
                                    if (lvds)
                                        lvds.addList(tmpDS[idx]);
                                }));
                            });
                            whenAll(_this.fillAlbumsPromises).then(function () {
                                //ODS('--- rest of albums finished');
                                _this.fillAlbumsPromises = undefined;
                                forEach(tmpDS, function (ds, idx) {
                                    if (ds.count > 0) {
                                        if ((idx > 0) && !_this.isSomeOtherAlbum) {
                                            _this.isSomeOtherAlbum = true;
                                        }
                                        if (_this.showingOnline && ((idx === 0) || _this.showingOtherAlbums))
                                            _this.setLVVis(mbListDefs[idx], true);
                                    }
                                });
                                finishReadingAlbums();
                            });
                        });
                    }
                }, function () {
                    _this._promises.getArtistReleaseGroups = undefined;
                });
            }
            else {
                whenAll(_this.fillAlbumsPromises).then(function () {
                    //ODS('--- fill albums finished');
                    _this.fillAlbumsPromises = [];
                    finishReadingAlbums();
                });
            }
        }
        if (callUpdate)
            _this.updateViewRequest();
    }
    navigateAlbum(e) {
        let fAlbum = e.detail.item;
        // get unfiltered album object
        app.getObject('album', {
            id: fAlbum.id
        }).then(function (album) {
            if (album) {
                if (isNewTabEvent(e)) {
                    uitools.navigateInNewTab('album', album);
                }
                else
                    navigationHandlers.album.navigate(album);
            }
        }.bind(this));
    }
    cleanUp() {
        ODS('ArtistAlbums: cleanUp ' + this.uniqueID);
        this.cancelAll();
        this.dataSource = undefined;
        this._commonChange = undefined;
        super.cleanUp();
    }
    storeState() {
        let state = {
            showingOtherAlbums: this.showingOtherAlbums
        };
        return state;
    }
    restoreState(state) {
        this.showingOtherAlbums = !!state.showingOtherAlbums;
        this.showingOnline = uitools.globalSettings.showingOnline || false;
    }
    storePersistentState() {
        let state = {
            showingOtherAlbums: this.showingOtherAlbums,
        };
        return state;
    }
    restorePersistentState(state) {
        this.showingOtherAlbums = !!state.showingOtherAlbums;
        this.showingOnline = uitools.globalSettings.showingOnline || false;
    }
    cancelAll() {
        musicBrainz.cancelDownloads(this.uniqueID);
        if (searchTools.interfaces.artistSearch)
            searchTools.cancelSearch(searchTools.interfaces.artistSearch, this.uniqueID);
        for (let key in this._promises) {
            cancelPromise(this._promises[key]);
        }
        this._promises = {};
        if (this.fillAlbumsPromises) {
            forEach(this.fillAlbumsPromises, function (prom) {
                cancelPromise(prom);
            });
            this.fillAlbumsPromises = undefined;
        }
        ODS('ArtistAlbums: cancelled all ' + this.uniqueID);
    }
    doRefreshInternal() {
        this.cancelAll();
        this.clearArtistData();
        this.initializeValues();
    }
    // called, when content of datasource changed
    dataSourceChangeHandler(params) {
        if (params && (params.uniqueID === this.uniqueID)) { // to avoid deadlock, do not call if we are the caller
            return;
        }
        if (params.eventType === 'clear') {
            this.clearArtistData(params.clearAll);
            return;
        }
        if (params.eventType === 'settings') {
            this.showingOnline = uitools.globalSettings ? !!uitools.globalSettings.showingOnline : false;
            this.updateView();
            // LS: the following was originally added by Michal in 2017 for unknown reason, but was subsequently removed by Ludek to fix #17043            
            // reset focused control, the last one could be hidden
            //            if (this.mainControl) {
            //                this.raiseEvent('focusedcontrol', {
            //                    control: this.mainControl.controlClass
            //                }, false, true /* bubbles */ );
            //            };
            return;
        }
        this.updateViewRequest();
    }
    setFocus() {
        this.container.focus();
        if (!this.showingOnline)
            this.UI.artistAlbumlist.focus();
        else {
            let defObj = mbListDefs[0];
            this.UI[defObj.lvName].focus();
        }
    }
    get dataSource() {
        return this._ds;
    }
    set dataSource(artObj) {
        this.dataSourceUnlistenFuncts();
        this.cancelDataSourcePromises();
        if (artObj && this._ds && (artObj.dataObject === this._ds.dataObject))
            return;
        if (!this._commonChange) {
            this._commonChange = this.commonChange.bind(this);
            this.localListen(app, 'commonchange', this._commonChange);
        }
        if (this.artist) {
            ODS('ArtistAlbums: set new dataSource ' + this.uniqueID);
            if (this._ds && this._dataSourceChangeHandler) {
                app.unlisten(this._ds, 'change', this._dataSourceChangeHandler);
                this._dataSourceChangeHandler = undefined;
            }
            this.cancelAll();
            this.clearArtistData(true);
        }
        this._ds = artObj;
        if (this._ds) {
            this._dataSourceChangeHandler = app.listen(this._ds, 'change', this.dataSourceChangeHandler.bind(this));
            this.updateView();
        }
        else { // @ts-ignore
            if (this.UI.artistAlbumlist.controlClass.reportStatus)
                this.UI.artistAlbumlist.controlClass.setStatus('');
        }
    }
    get artist() {
        if (this.dataSource)
            return this.dataSource.dataObject;
        else
            return undefined;
    }
    get mainControl() {
        if (this.showingOnline) {
            let lc;
            for (let i = 0; i < mbListDefs.length; i++) {
                lc = this.UI[mbListDefs[i].lvName];
                if (isVisible(lc, false)) {
                    return lc;
                }
            }
        }
        else {
            if (isVisible(this.UI.artistAlbumlist, false)) {
                return this.UI.artistAlbumlist;
            }
        }
        return undefined;
    }
    get scrollingParent() {
        this._scrollingParent = uitools.getScrollingParent(this.container, this._scrollingParent);
        return this._scrollingParent;
    }
}
registerClass(ArtistAlbums);
let mbListDefs = [{
        lvName: 'musicBrainzAlbums',
        primaryType: 'Album',
        noSecondaryType: true,
        onlyOfficial: true // include only albums, which have at least one official release
    }, {
        lvName: 'musicBrainzAlbumsCompilation',
        titleName: 'musicBrainzAlbumsCompilationTitle',
        primaryType: 'Album',
        secondaryType: 'Compilation'
    }, {
        lvName: 'musicBrainzAlbumsLive',
        titleName: 'musicBrainzAlbumsLiveTitle',
        primaryType: 'Album',
        secondaryType: 'Live'
    }, {
        lvName: 'musicBrainzAlbumsSoundtrack',
        titleName: 'musicBrainzAlbumsSoundtrackTitle',
        primaryType: 'Album',
        secondaryType: 'Soundtrack'
    }, {
        lvName: 'musicBrainzSingles',
        titleName: 'musicBrainzSinglesTitle',
        primaryType: 'Single'
    }, {
        lvName: 'musicBrainzEPs',
        titleName: 'musicBrainzEPsTitle',
        primaryType: 'EP'
    }, {
        lvName: 'musicBrainzBroadcasts',
        titleName: 'musicBrainzBroadcastsTitle',
        primaryType: 'Broadcast'
    }, {
        lvName: 'musicBrainzOthers',
        titleName: 'musicBrainzOthersTitle',
        primaryType: 'Other'
    }];
