/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

'use strict';
registerFileImport('controls/artistTracks');
import ColumnTrackList from './columntracklist';
import Control from './control';
requirejs('helpers/musicBrainz');
requirejs('helpers/youtubeHelper');
/**
 * UI ArtistTracks subview element
 */
export default class ArtistTracks extends Control {
    /** @constructor */
    initialize(rootelem, params) {
        super.initialize(rootelem, params);
        this.container.classList.add('noOverflow');
        this.container.classList.add('browserTracks');
        this.container.style.display = 'inline'; // to properly handle scrollbars of Scroller per the LV content.
        this.container.innerHTML =
            '<div data-id="artistTracklistHeading">' +
                '  <h3 data-id="artistTopTracklistTitle" class="inline blockTitleMargin" data-no-localize>' + _('Top Tracks') + '</h3>' +
                '  <div data-id="artistTopTracklistFooter" class="inline">' +
                '    <div data-id="showAllTracks" data-icon="showMore" tabindex="0" class="inline verticalTextBottom noPadding left-indent-small" data-control-class="ToolButton"></div>' +
                '    <div data-id="showOnlineAllTracks" data-icon="showMore" tabindex="0" class="inline verticalTextBottom noPadding left-indent-small" data-control-class="ToolButton" data-tip="' + _('Show all tracks') + '"></div>' +
                '    <span data-id="loadingAllTracks" class="inline unimportantText">' + _('Loading all tracks') + '... <div data-id="progressWheel1" class="icon inline" data-icon="progress"></div></span>' +
                '  </div>' +
                '  <h3 data-id="artistAllTracklistTitle" class="inline blockTitleMargin">' +
                '    <span data-id="artistOnlineAllTracklistInnerTitle">' + _('All tracks') + '</span>' +
                '    <span data-id="artistAllTracklistInnerTitle">' + _('All tracks') + '</span>' +
                '  </h3>' +
                '  <div data-id="artistAllTracklistFooter" class="inline">' +
                '    <div data-id="showTopTracks" tabindex="0" data-icon="showLess" class="inline verticalCenter noPadding left-indent-small" data-control-class="ToolButton" data-tip="' + _('Show Top Tracks only') + '"></div>' +
                '  </div>' +
                '  <h3 data-id="artistMatchedTracklistTitle" class="inline blockTitleMargin" data-no-localize>Matched Tracks</h3>' +
                '</div>' +
                '<div data-id="artistTracklist" data-control-class="ArtistTrackList" data-init-params="{showHeader: true, hideArtists: true, checkGroups: true, disableStatusbar: false, disableStateStoring: false, dynamicSize: true, showInline: true}">' +
                '</div>' +
                '<h3 data-id="artistYTTracklistTitle" class="inline blockTitleMargin" data-no-localize>' + _('Tracks (unclassified)') + '</h3>' +
                '<div data-id="artistYTTracklist" data-control-class="SimpleTracklist" data-init-params="{showHeader: true, hideArtists: true, checkGroups: true, disableStatusbar: true, disableStateStoring: false, dynamicSize: true, showInline: true, autoSortString: \'\'}">' +
                '</div>' +
                '<h4 data-id="showYTTracks" class="inline clickable" tabindex="0" data-no-localize>' + _('Show more from YouTube') + '...</h4>' +
                '<h4 data-id="loadingYTTracks" class="inline" data-no-localize>' + _('Loading more from YouTube') + '... <div data-id="progressWheel2" class="icon inline" data-icon="progress"></div></h4>';
        initializeControls(this.container);
        this.UI = getAllUIElements(this.container);
        let UI = this.UI;
        let _this = this;
        let showingOnline = uitools.globalSettings ? !!uitools.globalSettings.showingOnline : false;
        this.showingAllTracks = false;
        this.showingAllOnlineTracks = false;
        this.allTracksCount = 0;
        this.tracklistMode = '';
        this._searchPhrase = '';
        this.prepareDefaultSortStrings();
        this._promises = {};
        this.isSearchable = true;
        let tlCtrl = UI.artistTracklist.controlClass;
        tlCtrl.localListen(UI.artistTracklist, 'touchend', uitools.touchDefaultItemAction);
        tlCtrl.localListen(UI.artistTracklist, 'itemdblclick', uitools.defaultItemAction);
        tlCtrl.localListen(UI.artistTracklist, 'itementer', uitools.defaultItemAction);
        tlCtrl.getDefaultSortString = function () {
            if (this._ds && this._ds.defaultSortStrings)
                return this._ds.defaultSortStrings[this.tracklistMode];
            else
                return '';
        }.bind(this);
        this.localListen(UI.showAllTracks, 'click', function () {
            _this.showingAllTracks = true;
            _this.loadingTracklist = true;
            _this.updateView();
        });
        addEnterAsClick(_this, UI.showAllTracks);
        this.localListen(UI.showOnlineAllTracks, 'click', function () {
            _this.showingAllOnlineTracks = true;
            _this.loadingTracklist = true;
            _this.updateView();
        });
        addEnterAsClick(_this, UI.showOnlineAllTracks);
        this.localListen(UI.showTopTracks, 'click', function () {
            if (_this.showingOnline)
                _this.showingAllOnlineTracks = false;
            else
                _this.showingAllTracks = false;
            _this.updateView();
            deferredNotifyLayoutChangeDown(_this.scrollingParent, 'scrollerContentChanged'); // #20968
        });
        addEnterAsClick(_this, UI.showTopTracks);
        UI.artistYTTracklist.controlClass.addToContextMenu([{
                action: {
                    title: _('Add to MusicBrainz'),
                    disabled: function () {
                        let ds = UI.artistYTTracklist.controlClass.dataSource;
                        return !_this.artist || !ds || (ds.focusedIndex < 0);
                    },
                    execute: function () {
                        let lnk = musicBrainz.getMBEditLink('recording');
                        let ds = UI.artistYTTracklist.controlClass.dataSource;
                        ds.locked(function () {
                            let item = ds.getValue(ds.focusedIndex);
                            if (item) {
                                let ttl = item.title;
                                let hidx = ttl.indexOf('-');
                                if (hidx > -1) {
                                    ttl = ttl.slice(hidx + 1);
                                }
                                ttl = encodeURIComponent(ttl.trim());
                                lnk += '?edit-recording.name=' + ttl + '&edit-recording.artist_credit.names.0.name=' + encodeURIComponent(_this.artist.title);
                                if (item.songLength > 0)
                                    lnk += '&edit-recording.length=' + item.songLength;
                            }
                        });
                        app.utils.web.openURL(lnk);
                    }
                },
                order: 10,
                grouporder: 5,
            }]);
        this.localListen(this.UI.artistYTTracklist, 'touchend', uitools.touchDefaultItemAction);
        this.localListen(this.UI.artistYTTracklist, 'itemdblclick', uitools.touchDefaultItemAction);
        this.localListen(this.UI.artistYTTracklist, 'itementer', uitools.touchDefaultItemAction);
        this.updateView();
        this.helpContext = 'Filelisting';
    }
    prepareDefaultSortStrings() {
        if (!this._ds)
            return;
        this._ds.sortStrings = {
            allTracks: 'date ASC;album ASC;order ASC;title ASC',
            allOnlineTracks: 'title ASC',
            topTracks: 'playOrder ASC',
            onlineTopTracks: 'playOrder ASC'
        };
        this._ds.defaultSortStrings = {
            allTracks: 'date ASC;album ASC;order ASC;title ASC',
            allOnlineTracks: 'title ASC',
            topTracks: 'playOrder ASC',
            onlineTopTracks: 'playOrder ASC'
        };
    }
    cancelAll() {
        musicBrainz.cancelDownloads(this.uniqueID);
        for (let key in this._promises) {
            cancelPromise(this._promises[key]);
        }
        this._promises = {};
    }
    clearData(params) {
        enterLayoutLock(this.scrollingParent);
        this.prepareDefaultSortStrings();
        this.cancelAll();
        if (this.UI.artistTracklist.controlClass.dataSource && this._listChangeHandler) {
            app.unlisten(this.UI.artistTracklist.controlClass.dataSource, 'change', this._listChangeHandler);
            this._listChangeHandler = undefined;
        }
        this.UI.artistTracklist.controlClass.dataSource = null;
        this.tracklistMode = ''; // reset so correct tracklist can be set
        this.nextYTPageToken = undefined;
        this.UI.artistYTTracklist.controlClass.dataSource = null;
        this.myMusicSet = false;
        this._onlineDataParsed = false;
        if (params && params.clearAll) {
            this.showingAllOnlineTracks = false;
        }
        leaveLayoutLock(this.scrollingParent);
    }
    readTopTracks() {
        let _this = this;
        let UI = this.UI;
        if (!_this._promises.topTracks) {
            _this._promises.topTracks = new Promise(function (resolve, reject) {
                if (_this._ds.cache.topTracks) {
                    resolve(_this._ds.cache.topTracks);
                    return;
                }
                let tracklist = undefined;
                if (!_this._promises.getTopTracklist) {
                    tracklist = _this.artist.getTopTracklist(maxTopTracksCount);
                    _this._promises.getTopTracklist = tracklist.whenLoaded();
                }
                _this._promises.getTopTracklist.then(function () {
                    _this._promises.getTopTracklist = undefined;
                    if (!_this._ds.cache.topTracks)
                        _this._ds.cache.topTracks = tracklist;
                    resolve(_this._ds.cache.topTracks);
                }, function () {
                    _this._promises.getTopTracklist = undefined;
                    if (reject)
                        reject();
                });
            });
        }
        return _this._promises.topTracks;
    }
    filterSource(phrase) {
        if (this._searchPhrase != phrase) { // to not reload unfiltered list via searchBar > restoreLocalSearch > comeOut > searchText = ''  .. to just hide the search bar (#17855)
            this._searchPhrase = phrase;
            this.tracklistMode = 'search'; // to force update / cancel search (in setTracklist > _setDS)
            if (!this.showingOnline && !this.showingAllTracks && this._ds) {
                // we are in "Top Tracks" mode, but we need to search all tracks
                this.loadingTracklist = true;
                this.showingAllTracks = true;
                this._ds.readAllTracks().then((tracks) => {
                    this.UI.artistTracklist.controlClass.dataSource = tracks.getCopy();
                    this.UI.artistTracklist.controlClass.autoSortString = this._ds.sortStrings['allTracks']; // prepare right sort string for new data source
                    this.updateView();
                });
            }
            else {
                this.updateView();
            }
        }
    }
    updateViewRequest() {
        this.requestTimeout(this.updateView.bind(this), 50, 'updateView');
    }
    updateAllTracksCount() {
        if (this.showingOnline || !this.artist)
            return;
        let UI = this.UI;
        if (!UI)
            return;
        let _this = this;
        let setAllTracksTitle = function (cnt) {
            UI.showAllTracks.setAttribute('data-tip', sprintf(_('show all %d tracks'), cnt));
            if (cnt > maxTopTracksCount)
                UI.artistAllTracklistInnerTitle.textContent = sprintf(_('All %d tracks'), cnt);
            else
                UI.artistAllTracklistInnerTitle.textContent = _('All tracks');
        };
        if (_this._ds.cache.allTracksCount !== undefined) {
            _this.allTracksCount = _this._ds.cache.allTracksCount;
            setAllTracksTitle(_this.allTracksCount);
            _this.updateViewRequest();
        }
        else {
            if (!_this._promises.allTracksCount) { // not called yet
                _this._promises.allTracksCount = _this.artist.getItemCountAsync('track');
                _this._promises.allTracksCount.then(function (cnt) {
                    _this._promises.allTracksCount = undefined;
                    _this.allTracksCount = cnt;
                    _this._ds.cache.allTracksCount = cnt;
                    setAllTracksTitle(cnt);
                    _this.updateViewRequest();
                }, function () {
                    _this._promises.allTracksCount = undefined;
                });
            }
        }
    }
    updateView() {
        enterLayoutLock(this.scrollingParent);
        let UI = this.UI;
        if (!UI)
            return;
        let _this = this;
        let showOnline = this.showingOnline;
        let nonEmptyTracklist = UI.artistTracklist.controlClass && UI.artistTracklist.controlClass.dataSource && (UI.artistTracklist.controlClass.dataSource.count > 0);
        let loadingAllTracks = this.loadingTracklist && ((this.tracklistMode === 'allTracks') || (this.tracklistMode === 'allOnlineTracks'));
        let showingAllOnlineTracks = this.showingAllOnlineTracks && (this.tracklistMode === 'allOnlineTracks');
        let showingAllTracks = this.showingAllTracks && (this.tracklistMode === 'allTracks');
        let showYTTracklist = showOnline && showingAllOnlineTracks && UI.artistYTTracklist.controlClass.dataSource && (UI.artistYTTracklist.controlClass.dataSource.count > 0);
        setVisibility(UI.artistTracklist, nonEmptyTracklist);
        setVisibility(UI.showYTTracks, showOnline && showingAllOnlineTracks && !loadingAllTracks && !_this._promises.loadingYTTracks);
        setVisibility(UI.loadingYTTracks, showOnline && showingAllOnlineTracks && _this._promises.loadingYTTracks);
        setVisibility(UI.artistYTTracklistTitle, showYTTracklist);
        setVisibility(UI.artistYTTracklist, showYTTracklist);
        setVisibility(UI.showAllTracks, !showOnline && !loadingAllTracks && !showingAllTracks && (this.allTracksCount > maxTopTracksCount));
        setVisibility(UI.showOnlineAllTracks, showOnline && !showingAllOnlineTracks && !loadingAllTracks);
        setVisibility(UI.loadingAllTracks, loadingAllTracks);
        setVisibility(UI.showTopTracks, (showOnline && showingAllOnlineTracks) || (!showOnline && showingAllTracks));
        setVisibility(UI.artistMatchedTracklistTitle, false); // not used yet
        let vis = (loadingAllTracks || (nonEmptyTracklist && ((showOnline && !showingAllOnlineTracks) || (!showOnline && !showingAllTracks))));
        setVisibility(UI.artistTopTracklistTitle, vis);
        setVisibility(UI.artistTopTracklistFooter, vis);
        vis = !loadingAllTracks && nonEmptyTracklist && ((showOnline && showingAllOnlineTracks) || (!showOnline && showingAllTracks));
        setVisibility(UI.artistAllTracklistTitle, vis);
        setVisibility(UI.artistAllTracklistFooter, vis && ((showOnline && showingAllOnlineTracks) || (!showOnline && showingAllTracks && (this.allTracksCount > maxTopTracksCount))));
        setVisibility(UI.artistAllTracklistInnerTitle, !showOnline);
        setVisibility(UI.artistOnlineAllTracklistInnerTitle, showOnline);
        if (!showOnline) {
            if (_this.artist) {
                if (_this.showingAllTracks) {
                    _this.setTracklist(_this._ds.readAllTracks.bind(_this._ds), 'allTracks');
                }
                else {
                    _this.setTracklist(_this.readTopTracks.bind(_this), 'topTracks');
                }
                if (!_this.myMusicSet) {
                    _this.myMusicSet = true;
                    _this.requestTimeout(_this.updateAllTracksCount.bind(_this), 50, 'tracklistCount'); // to not call too often
                }
            }
        }
        else {
            if (!_this.onlineEventsSet) {
                _this.onlineEventsSet = true;
                _this.localListen(UI.showYTTracks, 'click', function () {
                    if (_this._promises.loadingYTTracks)
                        return;
                    let existingTracklist = app.utils.createTracklist(true);
                    if (UI.artistTracklist.controlClass.dataSource)
                        existingTracklist.addList(UI.artistTracklist.controlClass.dataSource);
                    if (UI.artistYTTracklist.controlClass.dataSource)
                        existingTracklist.addList(UI.artistYTTracklist.controlClass.dataSource);
                    _this._promises.loadingYTTracks = ytHelper.searchVideos(_this.artist.name, {
                        pageToken: _this.nextYTPageToken,
                        maxResults: 25,
                        checkDuplicates: true,
                        existingTracklist: existingTracklist
                    });
                    _this._promises.loadingYTTracks.then(function (res) {
                        _this._promises.loadingYTTracks = undefined;
                        existingTracklist.clear();
                        existingTracklist = undefined;
                        if (res) {
                            if (res.tracklist) {
                                if (UI.artistYTTracklist.controlClass.dataSource) {
                                    UI.artistYTTracklist.controlClass.dataSource.addList(res.tracklist);
                                    res.tracklist = undefined;
                                }
                                else {
                                    UI.artistYTTracklist.controlClass.dataSource = res.tracklist;
                                }
                            }
                            _this.nextYTPageToken = res.nextPageToken;
                            _this.updateViewRequest();
                        }
                    }, function () {
                        _this._promises.loadingYTTracks = undefined;
                    });
                    _this.updateViewRequest();
                });
                addEnterAsClick(_this, UI.showYTTracks);
            }
            if (_this._ds && _this._ds.onlineData && !_this._onlineDataParsed) {
                _this.parseOnlineData();
                _this._onlineDataParsed = true;
            }
            if (_this.artist && _this.artist.mbgid && (_this.artist.mbgid !== '0')) {
                if (_this.showingAllOnlineTracks) {
                    if (_this.tracklistMode !== 'allOnlineTracks') {
                        _this.setTracklist(); // clear tracklist, reading online data could last longer or fail
                        _this.setTracklist(_this._ds.readAllOnlineTracks.bind(_this._ds), 'allOnlineTracks');
                    }
                }
                else {
                    if (_this.tracklistMode !== 'onlineTopTracks') {
                        _this.setTracklist(); // clear tracklist, reading online data could last longer or fail
                        if (_this._ds.cache.onlineTopTracks) // tracks already prepared
                            _this.setTracklist(undefined, 'onlineTopTracks');
                    }
                }
            }
            else
                _this.setTracklist(); // clear tracklist
        }
        leaveLayoutLock(this.scrollingParent);
    }
    setTracklist(getTracklistFunc, mode) {
        let UI = this.UI;
        let _this = this;
        if (_this.tracklistMode !== mode) {
            let tracklistCls = UI.artistTracklist.controlClass;
            // store sort string of current tracklist, so it can be restored after switching back
            if (_this.tracklistMode && (_this.tracklistMode != 'topTracks')) {
                _this._ds.sortStrings[_this.tracklistMode] = tracklistCls.autoSortString;
            }
            _this.tracklistMode = mode;
            if (tracklistCls.dataSource && _this._listChangeHandler) {
                app.unlisten(tracklistCls.dataSource, 'change', _this._listChangeHandler);
                _this._listChangeHandler = undefined;
            }
            if (!mode) {
                tracklistCls.dataSource = undefined;
                _this.updateViewRequest();
                return;
            }
            let _setDS = function () {
                _this.loadingTracklist = false;
                if ((_this.tracklistMode === mode) && (_this._ds.cache[mode]) && tracklistCls) { // mode not changed yet  
                    if (_this._searchPhrase && tracklistCls.dataSource) {
                        tracklistCls.filterSource(_this._searchPhrase); // #18441
                        _this._ds.currentTracklist = tracklistCls.dataSource;
                        _this.tracklistMode === 'allTracks';
                        _this.updateViewRequest();
                        return;
                    }
                    if (_this.tracklistMode === 'topTracks' || _this.tracklistMode === 'onlineTopTracks') {
                        tracklistCls.autoSortString = _this._ds.defaultSortStrings[mode]; // prepare right sort string for new data source
                        tracklistCls.dataSource = _this._ds.cache[mode].getCopy();
                        tracklistCls.dataSource.globalModifyWatch = true; // monitor changes, so the list will be correctly updated, e.g. nowplaying indicator
                        tracklistCls.dataSource.notifyLoaded();
                        _this.updateViewRequest();
                    }
                    else {
                        tracklistCls.autoSortString = _this._ds.sortStrings[mode]; // prepare right sort string for new data source
                        tracklistCls.dataSource = _this._ds.cache[mode].getCopy();
                        tracklistCls.dataSource.globalModifyWatch = true; // monitor changes, so the list will be correctly updated, e.g. nowplaying indicator
                        tracklistCls.dataSource.whenLoaded().then(function () {
                            _this.updateViewRequest();
                        });
                    }
                    if ((_this.tracklistMode === 'topTracks') || (_this.tracklistMode === 'allTracks')) {
                        _this._listChangeHandler = app.listen(tracklistCls.dataSource, 'change', function (eventType, itemIndex, obj, flags) {
                            if (_this._ds && (((!eventType && (flags !== 'flagchange')) || (eventType === 'newcontent') || eventType === 'delete' || eventType === 'insert'))) {
                                _this._ds.cache.allTracksCount = undefined;
                                _this.requestTimeout(_this.updateAllTracksCount.bind(_this), 50, 'tracklistCount'); // to not call too often
                            }
                        });
                    }
                    _this._ds.currentTracklist = tracklistCls.dataSource;
                }
                else {
                    if ((_this.tracklistMode === 'allOnlineTracks') && (mode === 'allOnlineTracks') && !_this._ds.cache[mode]) {
                        // no online tracks found, probably MB server timout/failed connection
                        uitools.toastMessage.show(_('Download error'));
                        _this.showingAllOnlineTracks = false;
                        _this.updateViewRequest();
                    }
                }
            };
            if (getTracklistFunc && (!_this._ds.cache || !_this._ds.cache[mode])) {
                _this.thenWithProgress(getTracklistFunc(), {
                    progress: _this._ds,
                    thenFunc: _setDS,
                    delayedFunc: function () {
                        if (_this.tracklistMode === mode) {
                            _this.updateViewRequest();
                        }
                    }
                });
            }
            else {
                _setDS();
            }
        }
    }
    parseOnlineData() {
        let _this = this;
        let artistName = _this._ds.onlineData.name;
        let UI = _this.UI;
        // process top tracks
        if (_this._ds.cache.onlineTopTracks) {
            if (_this.showingOnline && !_this.showingAllOnlineTracks) {
                _this.setTracklist(undefined, 'onlineTopTracks');
            }
        }
        else if (_this._ds.onlineData) {
            if (!_this._promises.fillTopTracks) {
                let topT = _this._ds.onlineData['top-tracks'];
                if (topT && (topT.length > 0)) {
                    let maxNum = Math.min(maxTopTracksCount, topT.length);
                    let ttds = app.utils.createTracklist(false); // not set loaded flag
                    _this._promises.fillTopTracks = ttds.asyncFill(maxNum, function (idx, track) {
                        let titem = topT[idx];
                        track.title = titem.title;
                        track.songLength = titem.length;
                        track.albumArtist = artistName;
                        track.artist = artistName;
                        track.album = titem.album;
                        track.webSource = _utils.youtubeWebSource(); // MB tracks are searched and played from Youtube now
                        let dt = titem['date'];
                        if (dt) {
                            track.date = musicBrainz.decodeMBDate(dt);
                        }
                    }).then(function () {
                        _this._promises.fillTopTracks = undefined;
                        if (!_this._ds)
                            return;
                        ttds.globalModifyWatch = true; // monitor changes, so the list will be correctly updated, e.g. nowplaying indicator
                        _this._ds.cache.onlineTopTracks = ttds;
                        if (_this.showingOnline && !_this.showingAllOnlineTracks) {
                            _this.setTracklist(undefined, 'onlineTopTracks');
                            _this.updateViewRequest();
                        }
                    });
                }
            }
        }
    }
    dataSourceChangeHandler(params) {
        if (params) {
            if (params.eventType === 'clear') {
                this.clearData(params);
                return;
            }
            if (params.eventType === 'settings') {
                let showingOnline = uitools.globalSettings ? !!uitools.globalSettings.showingOnline : false;
                if (showingOnline !== this.showingOnline) {
                    this.showingOnline = showingOnline;
                    this.updateViewRequest();
                }
                return;
            }
        }
        this.updateViewRequest();
    }
    storeState() {
        let state = super.storeState();
        state.showingAllTracks = this.showingAllTracks;
        return state;
    }
    restoreState(state) {
        this.showingAllTracks = !!state.showingAllTracks;
        if (this.UI.artistTracklist.controlClass && this.UI.artistTracklist.controlClass.dataSource) // restore state only when we already have tracklist ds, issue #14671
            super.restoreState(state);
        this.showingOnline = uitools.globalSettings.showingOnline || false;
        this.tracklistMode = ''; // reset so correct tracklist can be set
    }
    storePersistentState() {
        let state = {
            showingAllTracks: this.showingAllTracks
        };
        if (this._ds && this._ds.sortStrings)
            state.sortStrings = this._ds.sortStrings;
        return state;
    }
    restorePersistentState(state) {
        this.showingAllTracks = !!state.showingAllTracks;
        this.showingOnline = uitools.globalSettings.showingOnline || false;
        if (this._ds && state.sortStrings) {
            this._ds.sortStrings = state.sortStrings; // #18519
            if (this._ds.sortStrings.allTracks === 'playOrder ASC') // #17855, this is not used for all tracks
                this._ds.sortStrings.allTracks = this._ds.defaultSortStrings.allTracks;
            if (this.showingAllTracks)
                this.UI.artistTracklist.controlClass.sortString = this._ds.sortStrings.allTracks;
        }
    }
    selectAll() {
        return this.UI.artistTracklist.controlClass.selectAll();
    }
    cleanUp() {
        this.dataSource = undefined; // will clear listener(s) and cancel all
        super.cleanUp();
    }
    setFocus() {
        if (isVisible(this.UI.artistTracklist))
            this.UI.artistTracklist.focus();
        else
            this.container.focus();
    }
    getCurrenSortString() {
        if (this.UI && this.UI.artistTracklist.controlClass)
            return this.UI.artistTracklist.controlClass.sortString;
        else
            return '';
    }
    get dataSource() {
        // update sort string, to be sure, we return current
        if (this.tracklistMode && !this.loadingTracklist && this._ds && this.UI && this.UI.artistTracklist.controlClass) {
            this._ds.sortStrings[this.tracklistMode] = this.UI.artistTracklist.controlClass.autoSortString;
        }
        return this._ds;
    }
    set dataSource(value) {
        if (this._ds && this._dataSourceChangeHandler) {
            app.unlisten(this._ds, 'change', this._dataSourceChangeHandler);
            this._dataSourceChangeHandler = undefined;
        }
        this.cancelAll();
        this._ds = value;
        if (this._ds) {
            if (!this._ds.sortStrings)
                this.prepareDefaultSortStrings();
            this._ds.cache = this._ds.cache || {};
            this._dataSourceChangeHandler = app.listen(this._ds, 'change', this.dataSourceChangeHandler.bind(this));
            this.updateView(); // have to be sync, so DS is set. 
        }
        else {
            this.clearData({
                clearAll: true
            });
            if (this.UI.artistTracklist.controlClass.reportStatus)
                this.UI.artistTracklist.controlClass.setStatus('');
        }
    }
    get artist() {
        if (this.dataSource)
            return this.dataSource.dataObject;
        else
            return undefined;
    }
    get scrollingParent() {
        this._scrollingParent = uitools.getScrollingParent(this.container, this._scrollingParent);
        return this._scrollingParent;
    }
}
registerClass(ArtistTracks);
/** Maximum number of artist's "Top tracks" to display */
let maxTopTracksCount = 10;
export class ArtistTrackList extends ColumnTrackList {
} // #18456
registerClass(ArtistTrackList);
