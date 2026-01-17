/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

registerFileImport('controls/genreTracks');
'use strict';
import ColumnTrackList from './columntracklist';
import Control from './control';
requirejs('helpers/musicBrainz');
/**
@module UI
*/
const maxTopTracksCount = 10;
/**
UI GenreTracks subview element

@class GenreTracks
@constructor
@extends Control
*/
class GenreTrackList extends ColumnTrackList {
} // #18456
registerClass(GenreTrackList);
class GenreTracks extends Control {
    initialize(rootelem, params) {
        super.initialize(rootelem, params);
        this.isSearchable = true;
        this._searchPhrase = '';
        this.disabledOnline = true;
        this.container.classList.add('noOverflow');
        this.container.classList.add('browserTracks');
        this.container.style.display = 'inline'; // to properly handle scrollbars of Scroller per the LV content.
        this.container.innerHTML =
            '<div data-id="genreTracklistHeading">' +
                '    <h3 data-id="genreTopTracklistTitle" class="inline blockTitleMargin" data-no-localize>' + _('Top Tracks') + ' <div data-id="showAllTracks" tabindex="0" data-icon="showMore" class="inline verticalCenter noPadding left-indent-small" data-control-class="ToolButton"></div><div data-id="showOnlineAllTracks" tabindex="0" data-icon="showMore" class="inline verticalTextBottom noPadding left-indent-small" data-control-class="ToolButton" data-tip="' + _('Show all tracks') + '"></div><span data-id="loadingAllTracks" class="inline unimportantText">(' + _('Loading all tracks') + '... <div data-id="progressWheel1" class="icon inline" data-icon="progress"></div>)</span></h3>' +
                '    <h3 data-id="genreAllTracklistTitle" class="inline blockTitleMargin">' +
                '        <span data-id="genreOnlineAllTracklistInnerTitle">' + _('All tracks') + '</span><span data-id="genreAllTracklistInnerTitle">' + _('All tracks') + '</span> <div data-id="showTopTracks" tabindex="0" data-icon="showLess" class="inline verticalCenter noPadding left-indent-small" data-control-class="ToolButton" data-tip="' + _('Show Top Tracks only') + '"></div>' +
                '    </h3>' +
                '    <h3 data-id="genreMatchedTracklistTitle" class="inline blockTitleMargin">Matched Tracks</h3>' +
                '</div>' +
                '<div data-id="genreTracklist" data-control-class="GenreTrackList" data-init-params="{showHeader: true, disableStateStoring: false, dynamicSize: true, showInline: true}">' +
                '</div>';
        initializeControls(this.container);
        this.UI = getAllUIElements(this.container);
        let UI = this.UI;
        let _this = this;
        this.showingOnline = (uitools.globalSettings && !this.disabledOnline) ? !!uitools.globalSettings.showingOnline : false;
        this.showingAllTracks = false;
        this._promises = {};
        this.tracklistMode = '';
        this.helpContext = 'Filelisting';
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
        let tl = UI.genreTracklist;
        tl.controlClass.localListen(tl, 'touchend', uitools.touchDefaultItemAction);
        tl.controlClass.localListen(tl, 'itemdblclick', uitools.defaultItemAction);
        tl.controlClass.localListen(tl, 'itementer', uitools.defaultItemAction);
        tl.controlClass.getDefaultSortString = function () {
            if (this._ds && this._ds.defaultSortStrings)
                return this._ds.defaultSortStrings[this.tracklistMode];
            else
                return '';
        }.bind(this);
    }
    prepareDefaultSortStrings() {
        if (this._ds) {
            this._ds.sortStrings = {
                allTracks: 'date ASC;album ASC;order ASC;title ASC',
                allOnlineTracks: 'album ASC;title ASC',
                topTracks: 'playOrder ASC',
                onlineTopTracks: 'playOrder ASC'
            };
            this._ds.defaultSortStrings = {
                allTracks: 'date ASC;album ASC;order ASC;title ASC',
                allOnlineTracks: 'album ASC;title ASC',
                topTracks: 'playOrder ASC',
                onlineTopTracks: 'playOrder ASC'
            };
        }
    }
    readAllTracks() {
        let _this = this;
        let UI = this.UI;
        if (!_this._promises.allTracks) {
            _this._promises.allTracks = new Promise(function (resolve, reject) {
                if (_this._ds.cache.allTracks) {
                    _this._promises.allTracks = undefined;
                    resolve(_this._ds.cache.allTracks);
                    return;
                }
                let tracklist = undefined;
                if (!_this._promises.getTracklist) {
                    tracklist = _this.genre.getTracklist();
                    _this._promises.getTracklist = tracklist.whenLoaded();
                }
                _this._promises.getTracklist.then(function () {
                    _this._promises.getTracklist = undefined;
                    if (!_this._ds.cache.allTracks)
                        _this._ds.cache.allTracks = tracklist;
                    _this._promises.allTracks = undefined;
                    resolve(_this._ds.cache.allTracks);
                }, function (err) {
                    _this._promises.allTracks = undefined;
                    _this._promises.getTracklist = undefined;
                    reject(err);
                });
            });
        }
        return _this._promises.allTracks;
    }
    readTopTracks() {
        let _this = this;
        let UI = this.UI;
        if (!_this._promises.topTracks) {
            _this._promises.topTracks = new Promise(function (resolve, reject) {
                if (_this._ds.cache.topTracks) {
                    _this._promises.topTracks = undefined;
                    resolve(_this._ds.cache.topTracks);
                    return;
                }
                let tracklist = undefined;
                if (!_this._promises.getTopTracklist) {
                    tracklist = _this.genre.getTopTracklist(maxTopTracksCount);
                    _this._promises.getTopTracklist = tracklist.whenLoaded();
                }
                _this._promises.getTopTracklist.then(function () {
                    _this._promises.getTopTracklist = undefined;
                    if (!_this._ds.cache.topTracks)
                        _this._ds.cache.topTracks = tracklist;
                    _this._promises.topTracks = undefined;
                    resolve(_this._ds.cache.topTracks);
                }, function () {
                    _this._promises.getTopTracklist = undefined;
                    _this._promises.topTracks = undefined;
                    if (reject)
                        reject();
                });
            });
        }
        return _this._promises.topTracks;
    }
    setTracklist(getTracklistFunc, mode) {
        let UI = this.UI;
        let _this = this;
        if (_this.tracklistMode !== mode) {
            // store sort string of current tracklist, so it can be restored after switching back
            if (_this.tracklistMode && (_this.tracklistMode != 'topTracks'))
                _this._ds.sortStrings[_this.tracklistMode] = UI.genreTracklist.controlClass.sortString;
            _this.tracklistMode = mode;
            if (UI.genreTracklist.controlClass.dataSource && _this._listChangeHandler) {
                app.unlisten(UI.genreTracklist.controlClass.dataSource, 'change', _this._listChangeHandler);
                _this._listChangeHandler = undefined;
            }
            if (!mode) {
                UI.genreTracklist.controlClass.dataSource = undefined;
                _this.updateViewRequest();
                return;
            }
            let _setDS = function () {
                _this.loadingTracklist = false;
                if ((_this.tracklistMode === mode) && (_this._ds.cache[mode])) { // mode not changed yet
                    if (_this.tracklistMode === 'topTracks') {
                        UI.genreTracklist.controlClass.autoSortString = _this._ds.defaultSortStrings[mode]; // prepare right sort string for new data source
                    }
                    else {
                        UI.genreTracklist.controlClass.sortString = _this._ds.sortStrings[mode]; // prepare right sort string for new data source
                    }
                    if (!_this._searchPhrase || !UI.genreTracklist.controlClass.dataSource /* # 19066 */)
                        UI.genreTracklist.controlClass.dataSource = _this._ds.cache[mode].getCopy(); // #18441
                    if (_this._searchPhrase) {
                        UI.genreTracklist.controlClass.filterSource(_this._searchPhrase);
                        _this.tracklistMode === 'allTracks';
                    }
                    UI.genreTracklist.controlClass.dataSource.globalModifyWatch = true; // monitor changes, so the list will be correctly updated, e.g. nowplaying indicator
                    if ((_this.tracklistMode === 'topTracks') || (_this.tracklistMode === 'allTracks')) {
                        _this._listChangeHandler = app.listen(UI.genreTracklist.controlClass.dataSource, 'change', function (eventType, itemIndex, obj, flags) {
                            if (_this._ds && (((!eventType && (flags !== 'flagchange')) || (eventType === 'newcontent') || eventType === 'delete' || eventType === 'insert'))) {
                                _this._ds.cache.itemCount = undefined;
                                _this.requestTimeout(_this.updateAllTracksCount.bind(_this), 50, 'tracklistCount'); // to not call too often
                            }
                        });
                    }
                    _this.updateViewRequest();
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
    filterSource(phrase) {
        if (this._searchPhrase != phrase) { // to not reload unfiltered list via searchBar > restoreLocalSearch > comeOut > searchText = ''  .. to just hide the search bar (#17855)
            this._searchPhrase = phrase;
            this.tracklistMode = 'search'; // to force update / cancel search (in setTracklist > _setDS above)
            if (!this.showingAllTracks) {
                // we are in "Top Tracks" mode, but we need to search all tracks:              
                this.loadingTracklist = true;
                this.showingAllTracks = true;
                this.readAllTracks().then((tracks) => {
                    this.UI.genreTracklist.controlClass.dataSource = tracks.getCopy();
                    this.UI.genreTracklist.controlClass.autoSortString = this._ds.sortStrings['allTracks']; // prepare right sort string for new data source
                    this.updateView();
                });
            }
            else
                this.updateView();
        }
    }
    updateViewRequest() {
        this.requestTimeout(this.updateView.bind(this), 50, 'updateView');
    }
    updateAllTracksCount() {
        if (this.showingOnline || !this.genre)
            return;
        let UI = this.UI;
        if (!UI)
            return;
        let _this = this;
        let processItemCount = function (cnt) {
            _this.allTracksCount = cnt;
            UI.showAllTracks.setAttribute('data-tip', sprintf(_('show all %d tracks'), cnt));
            if (cnt > maxTopTracksCount)
                UI.genreAllTracklistInnerTitle.textContent = sprintf(_('All %d tracks'), cnt);
            else
                UI.genreAllTracklistInnerTitle.textContent = _('All tracks');
            _this.updateViewRequest();
        };
        if (_this._ds.cache.itemCount !== undefined) {
            processItemCount(_this.allTracksCount);
        }
        else {
            if (!_this._promises.itemCount) {
                _this._promises.itemCount = _this.genre.getItemCountAsync('track');
                _this._promises.itemCount.then(function (cnt) {
                    _this._promises.itemCount = undefined;
                    processItemCount(cnt);
                }, function () {
                    _this._promises.itemCount = undefined;
                });
            }
        }
    }
    updateView() {
        let UI = this.UI;
        if (!UI)
            return;
        let _this = this;
        let showOnline = _this.showingOnline;
        let nonEmptyTracklist = !!(UI.genreTracklist.controlClass.dataSource && (UI.genreTracklist.controlClass.dataSource.count > 0));
        let loadingAllTracks = this.loadingTracklist && ((this.tracklistMode === 'allTracks') || (this.tracklistMode === 'allOnlineTracks'));
        let showingAllOnlineTracks = this.showingAllOnlineTracks && (this.tracklistMode === 'allOnlineTracks');
        let showingAllTracks = this.showingAllTracks && (this.tracklistMode === 'allTracks');
        enterLayoutLock(this.scrollingParent);
        setVisibility(UI.genreTracklist, nonEmptyTracklist);
        setVisibility(UI.showAllTracks, !showOnline && !showingAllTracks && !loadingAllTracks && (this.allTracksCount > maxTopTracksCount));
        setVisibility(UI.showOnlineAllTracks, showOnline && !showingAllOnlineTracks && !loadingAllTracks);
        setVisibility(UI.showTopTracks, (showOnline && showingAllOnlineTracks) || (!showOnline && showingAllTracks && (this.allTracksCount > maxTopTracksCount)));
        setVisibility(UI.loadingAllTracks, loadingAllTracks);
        setVisibility(UI.genreMatchedTracklistTitle, false); // not used yet
        setVisibility(UI.genreTopTracklistTitle, nonEmptyTracklist && (loadingAllTracks || ((showOnline && !showingAllOnlineTracks) || (!showOnline && !showingAllTracks))));
        setVisibility(UI.genreAllTracklistTitle, !loadingAllTracks && nonEmptyTracklist && ((showOnline && showingAllOnlineTracks) || (!showOnline && showingAllTracks)));
        setVisibility(UI.genreAllTracklistInnerTitle, !showOnline);
        setVisibility(UI.genreOnlineAllTracklistInnerTitle, showOnline);
        leaveLayoutLock(this.scrollingParent);
        if (!showOnline) {
            if (_this.genre) {
                if (_this.showingAllTracks) {
                    _this.setTracklist(_this.readAllTracks.bind(_this), 'allTracks');
                }
                else {
                    _this.setTracklist(_this.readTopTracks.bind(_this), 'topTracks');
                }
            }
            if (!_this.myMusicSet && _this.genre) {
                _this.myMusicSet = true;
                _this.requestTimeout(_this.updateAllTracksCount.bind(_this), 50, 'tracklistCount'); // to not call too often
            }
        }
        else {
            // currently not used online tracklists (does not return good results yet), always hide
            if (UI.genreTracklist.controlClass.dataSource) {
                UI.genreTracklist.controlClass.dataSource = undefined;
                _this.tracklistMode = '';
                _this.updateViewRequest();
            }
        }
    }
    storeState() {
        let state = super.storeState();
        state.showingAllTracks = this.showingAllTracks;
        return state;
    }
    restoreState(state) {
        if (this.UI.genreTracklist.controlClass && this.UI.genreTracklist.controlClass.dataSource) // restore state only when we already have tracklist ds, issue #14671
            super.restoreState(state);
        this.showingOnline = !this.disabledOnline && (uitools.globalSettings.showingOnline || false);
        this.showingAllTracks = !!state.showingAllTracks;
        this.tracklistMode = ''; // reset so correct tracklist can be set
    }
    storePersistentState() {
        let state = {
            showingAllTracks: this.showingAllTracks,
        };
        if (this._ds && this._ds.sortStrings)
            state.sortStrings = this._ds.sortStrings;
        return state;
    }
    restorePersistentState(state) {
        this.showingAllTracks = !!state.showingAllTracks;
        if (this._ds && state.sortStrings) {
            this._ds.sortStrings = state.sortStrings; // #18519
            if (this._ds.sortStrings.allTracks === 'playOrder ASC') // #17855, this is not used for all tracks
                this._ds.sortStrings.allTracks = this._ds.defaultSortStrings.allTracks;
            if (this.showingAllTracks)
                this.UI.genreTracklist.controlClass.sortString = this._ds.sortStrings.allTracks;
        }
    }
    cancelAll() {
        musicBrainz.cancelDownloads(this.uniqueID);
        for (let key in this._promises) {
            cancelPromise(this._promises[key]);
        }
        this._promises = {};
        ODS('GenreTracks: cancelled all ' + this.uniqueID);
    }
    selectAll() {
        return this.UI.genreTracklist.controlClass.selectAll();
    }
    clearData(params) {
        let UI = this.UI;
        if (UI.genreTracklist.controlClass.dataSource && this._listChangeHandler) {
            app.unlisten(UI.genreTracklist.controlClass.dataSource, 'change', this._listChangeHandler);
            this._listChangeHandler = undefined;
        }
        UI.genreTracklist.controlClass.dataSource = null;
        this.tracklistMode = ''; // reset so correct tracklist can be set
        UI.showAllTracks.removeAttribute('data-tip');
        UI.genreAllTracklistInnerTitle.textContent = '';
        this.allOnlineTracksRead = false;
        this.allTracksCount = 0;
        this.myMusicSet = false;
    }
    dataSourceChangeHandler(params) {
        if (params) {
            if (params.eventType === 'clear') {
                this.clearData(params);
                return;
            }
            if (params.eventType === 'settings') {
                let showingOnline = (uitools.globalSettings && !this.disabledOnline) ? !!uitools.globalSettings.showingOnline : false;
                if (showingOnline !== this.showingOnline) {
                    this.showingOnline = showingOnline;
                    this.updateViewRequest();
                }
                return;
            }
        }
        this.updateViewRequest();
    }
    cleanUp() {
        this.dataSource = undefined; // will clear listener(s) and cancel all
        super.cleanUp();
    }
    setFocus() {
        if (isVisible(this.UI.genreTracklist))
            this.UI.genreTracklist.focus();
        else
            this.container.focus();
    }
    getCurrenSortString() {
        if (this.UI && this.UI.genreTracklist.controlClass)
            return this.UI.genreTracklist.controlClass.sortString;
        else
            return '';
    }
    get dataSource() {
        // update sort string, to be sure, we return current
        if (this.tracklistMode && !this.loadingTracklist && this._ds && this.UI && this.UI.genreTracklist.controlClass) {
            this._ds.sortStrings[this.tracklistMode] = this.UI.genreTracklist.controlClass.autoSortString;
        }
        return this._ds;
    }
    set dataSource(obj) {
        if (this.genre) {
            if (this._dataSourceChangeHandler) {
                app.unlisten(this._ds, 'change', this._dataSourceChangeHandler);
                this._dataSourceChangeHandler = undefined;
            }
            this.cancelAll();
            this.clearData({
                clearAll: true
            });
        }
        this._ds = obj;
        if (obj) {
            if (!this._ds.sortStrings)
                this.prepareDefaultSortStrings();
            this._dataSourceChangeHandler = app.listen(this._ds, 'change', this.dataSourceChangeHandler.bind(this));
        }
        else {
            if (this.UI.genreTracklist.controlClass.reportStatus)
                this.UI.genreTracklist.controlClass.setStatus('');
        }
        if (this.genre) {
            ODS('GenreTracks: set DS to ' + this.genre + ', ' + this.uniqueID);
            this.updateView();
        }
    }
    get genre() {
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
registerClass(GenreTracks);
