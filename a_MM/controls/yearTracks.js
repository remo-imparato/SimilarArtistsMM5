/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

'use strict';
import ColumnTrackList from './columntracklist';
import Control from './control';
/**
@module UI
*/
const maxTopTracksCount = 10;
/**
UI YearTracks subview element

@class YearTracks
@constructor
@extends Control
*/
export class YearTrackList extends ColumnTrackList {
} // #18456
registerClass(YearTrackList);
export default class YearTracks extends Control {
    initialize(rootelem, params) {
        super.initialize(rootelem, params);
        this.isSearchable = true;
        this._searchPhrase = '';
        this.container.classList.add('noOverflow');
        this.container.classList.add('browserTracks');
        this.container.style.display = 'inline'; // to properly handle scrollbars of Scroller per the LV content
        this.container.innerHTML =
            '<div data-id="yearTracklistHeading">' +
                '    <h3 data-id="yearTopTracklistTitle" class="inline blockTitleMargin" data-no-localize>' + _('Top Tracks') + ' <div data-id="showAllTracks" tabindex="0" data-icon="showMore" class="inline verticalCenter noPadding left-indent-small" data-control-class="ToolButton"></div><span data-id="loadingAllTracks" class="inline unimportantText">(' + _('Loading all tracks') + '... <div data-id="progressWheel1" class="icon inline" data-icon="progress"></div>)</span></h3>' +
                '    <h3 data-id="yearAllTracklistTitle" class="inline blockTitleMargin">' +
                '        <span data-id="yearAllTracklistInnerTitle">All tracks</span> <div data-id="showTopTracks" tabindex="0" data-icon="showLess" class="inline verticalCenter noPadding left-indent-small" data-control-class="ToolButton" data-tip="' + _('Show Top Tracks only') + '"></div>' +
                '    </h3>' +
                '    <h3 data-id="yearMatchedTracklistTitle" class="inline blockTitleMargin">Matched Tracks</h3>' +
                '</div>' +
                '<div data-id="yearTracklist" data-control-class="YearTrackList" data-init-params="{showHeader: true, disableStateStoring: false, dynamicSize: true, showInline: true}">' +
                '</div>';
        initializeControls(this.container);
        this.UI = getAllUIElements(this.container);
        let UI = this.UI;
        let _this = this;
        this.showingAllTracks = false;
        this._promises = {};
        this.tracklistMode = '';
        this.prepareDefaultSortStrings();
        this.helpContext = 'Filelisting';
        this.localListen(UI.showAllTracks, 'click', function () {
            _this.showingAllTracks = true;
            _this.loadingTracklist = true;
            _this.updateView();
        });
        addEnterAsClick(_this, UI.showAllTracks);
        this.localListen(UI.showTopTracks, 'click', function () {
            _this.showingAllTracks = false;
            _this.updateView();
            deferredNotifyLayoutChangeDown(_this.scrollingParent, 'scrollerContentChanged'); // #20968
        });
        addEnterAsClick(_this, UI.showTopTracks);
        let tl = UI.yearTracklist;
        tl.controlClass.localListen(tl, 'touchend', uitools.touchDefaultItemAction);
        tl.controlClass.localListen(tl, 'itemdblclick', uitools.defaultItemAction);
        tl.controlClass.localListen(tl, 'itementer', uitools.defaultItemAction);
    }
    prepareDefaultSortStrings() {
        if (this._ds)
            this._ds.sortStrings = {
                allTracks: (this.year.useOrigYear ? 'origDate' : 'date') + ' ASC;album ASC;order ASC;title ASC',
                topTracks: 'playOrder ASC',
            };
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
                    tracklist = _this.year.getTracklist();
                    _this._promises.getTracklist = tracklist.whenLoaded();
                }
                _this._promises.getTracklist.then(function () {
                    _this._promises.getTracklist = undefined;
                    if (!_this._ds.cache.allTracks)
                        _this._ds.cache.allTracks = tracklist;
                    _this._promises.allTracks = undefined;
                    resolve(_this._ds.cache.allTracks);
                }, function () {
                    _this._promises.allTracks = undefined;
                    _this._promises.getTracklist = undefined;
                    if (reject)
                        reject();
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
                    tracklist = _this.year.getTopTracklist(maxTopTracksCount);
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
        if ((_this.tracklistMode !== mode) || (!UI.yearTracklist.controlClass.dataSource && !_this.loadingTracklist)) {
            // store sort string of current tracklist, so it can be restored after switching back
            if (_this.tracklistMode && (_this.tracklistMode !== 'topTracks'))
                _this._ds.sortStrings[_this.tracklistMode] = UI.yearTracklist.controlClass.sortString;
            _this.tracklistMode = mode;
            if (UI.yearTracklist.controlClass.dataSource && _this._listChangeHandler) {
                app.unlisten(UI.yearTracklist.controlClass.dataSource, 'change', _this._listChangeHandler);
                _this._listChangeHandler = undefined;
            }
            if (!mode) {
                UI.yearTracklist.controlClass.dataSource = undefined;
                _this.updateViewRequest();
                return;
            }
            let _setDS = function () {
                _this.loadingTracklist = false;
                if ((_this.tracklistMode === mode) && (_this._ds.cache[mode])) { // mode not changed yet
                    if (_this.tracklistMode === 'topTracks') {
                        UI.yearTracklist.controlClass.autoSortString = 'rating DESC;playCounter DESC'; // prepare right sort string for new data source
                    }
                    else {
                        UI.yearTracklist.controlClass.sortString = _this._ds.sortStrings[mode]; // prepare right sort string for new data source
                    }
                    if (!_this._searchPhrase)
                        UI.yearTracklist.controlClass.dataSource = _this._ds.cache[mode].getCopy(); // #18441
                    else {
                        UI.yearTracklist.controlClass.filterSource(_this._searchPhrase);
                        _this.tracklistMode === 'allTracks';
                    }
                    UI.yearTracklist.controlClass.dataSource.globalModifyWatch = true; // monitor changes, so the list will be correctly updated, e.g. nowplaying indicator
                    if ((_this.tracklistMode === 'topTracks') || (_this.tracklistMode === 'allTracks')) {
                        _this._listChangeHandler = app.listen(UI.yearTracklist.controlClass.dataSource, 'change', function (eventType, itemIndex, obj, flags) {
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
                _this.loadingTracklist = true;
                _this.thenWithProgress(getTracklistFunc(), {
                    thenFunc: _setDS,
                    delayedFunc: function () {
                        if (_this.tracklistMode === mode) {
                            _this.updateViewRequest();
                        }
                    },
                    errorFunc: function () {
                        _this.loadingTracklist = false;
                        _this.updateViewRequest();
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
            this.tracklistMode = 'search'; // to force update / cancel search (in setTracklist > _setDS)
            if (!this.showingAllTracks) {
                // we are in "Top Tracks" mode, but we need to search all tracks:              
                this.loadingTracklist = true;
                this.showingAllTracks = true;
                this.readAllTracks().then((tracks) => {
                    this.UI.yearTracklist.controlClass.dataSource = tracks.getCopy();
                    this.UI.yearTracklist.controlClass.autoSortString = this._ds.sortStrings['allTracks']; // prepare right sort string for new data source
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
        if (!this.year)
            return;
        let UI = this.UI;
        if (!UI)
            return;
        let _this = this;
        let processItemCount = function (cnt) {
            _this.allTracksCount = cnt;
            UI.showAllTracks.setAttribute('data-tip', sprintf(_('show all %d tracks'), cnt));
            if (cnt > maxTopTracksCount)
                UI.yearAllTracklistInnerTitle.textContent = sprintf(_('All %d tracks'), cnt);
            else
                UI.yearAllTracklistInnerTitle.textContent = _('All tracks');
            _this.updateViewRequest();
        };
        if (_this._ds.cache.itemCount !== undefined) {
            processItemCount(_this.allTracksCount);
        }
        else {
            if (!_this._promises.itemCount) {
                _this._promises.itemCount = _this.year.getItemCountAsync('track');
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
        let nonEmptyTracklist = !!(UI.yearTracklist.controlClass.dataSource && (UI.yearTracklist.controlClass.dataSource.count > 0));
        let loadingAllTracks = this.loadingTracklist && ((this.tracklistMode === 'allTracks'));
        let showingAllTracks = this.showingAllTracks && (this.tracklistMode === 'allTracks');
        enterLayoutLock(this.scrollingParent);
        setVisibility(UI.yearTracklist, nonEmptyTracklist);
        setVisibility(UI.showAllTracks, !showingAllTracks && !loadingAllTracks && (this.allTracksCount > maxTopTracksCount));
        setVisibility(UI.showTopTracks, showingAllTracks && (this.allTracksCount > maxTopTracksCount));
        setVisibility(UI.loadingAllTracks, loadingAllTracks);
        setVisibility(UI.yearMatchedTracklistTitle, false); // not used yet
        setVisibility(UI.yearTopTracklistTitle, nonEmptyTracklist && (loadingAllTracks || !showingAllTracks));
        setVisibility(UI.yearAllTracklistTitle, !loadingAllTracks && showingAllTracks);
        leaveLayoutLock(this.scrollingParent);
        if (_this.year) {
            if (_this.showingAllTracks) {
                _this.setTracklist(_this.readAllTracks.bind(_this), 'allTracks');
            }
            else {
                _this.setTracklist(_this.readTopTracks.bind(_this), 'topTracks');
            }
        }
        if (!_this.myMusicSet && _this.year) {
            _this.myMusicSet = true;
            _this.requestTimeout(_this.updateAllTracksCount.bind(_this), 50, 'tracklistCount'); // to not call too often
        }
    }
    storeState() {
        let state = super.storeState();
        state.showingAllTracks = this.showingAllTracks;
        return state;
    }
    restoreState(state) {
        if (this.UI.yearTracklist.controlClass && this.UI.yearTracklist.controlClass.dataSource) // restore state only when we already have tracklist ds, issue #14671
            super.restoreState(state);
        this.showingAllTracks = !!state.showingAllTracks;
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
                this.UI.yearTracklist.controlClass.sortString = this._ds.sortStrings.allTracks;
        }
    }
    cancelAll() {
        for (let key in this._promises) {
            cancelPromise(this._promises[key]);
        }
        this._promises = {};
        ODS('YearTracks: cancelled all ' + this.uniqueID);
    }
    selectAll() {
        return this.UI.yearTracklist.controlClass.selectAll();
    }
    clearData(params) {
        let UI = this.UI;
        this.cancelAll();
        if (UI.yearTracklist.controlClass.dataSource && this._listChangeHandler) {
            app.unlisten(UI.yearTracklist.controlClass.dataSource, 'change', this._listChangeHandler);
            this._listChangeHandler = undefined;
        }
        UI.yearTracklist.controlClass.dataSource = null;
        this.tracklistMode = ''; // reset so correct tracklist can be set
        UI.showAllTracks.removeAttribute('data-tip');
        UI.yearAllTracklistInnerTitle.textContent = '';
        this.allTracksCount = 0;
        this.myMusicSet = false;
    }
    cleanUp() {
        this.clearData({
            clearAll: true
        });
        super.cleanUp();
    }
    setFocus() {
        if (isVisible(this.UI.yearTracklist))
            this.UI.yearTracklist.focus();
        else
            this.container.focus();
    }
    getCurrenSortString() {
        if (this.UI && this.UI.yearTracklist.controlClass)
            return this.UI.yearTracklist.controlClass.sortString;
        else
            return '';
    }
    get dataSource() {
        if (this.tracklistMode && !this.loadingTracklist && this._ds && this.UI && this.UI.yearTracklist.controlClass) {
            this._ds.sortStrings[this.tracklistMode] = this.UI.yearTracklist.controlClass.autoSortString;
        }
        return this._ds;
    }
    set dataSource(value) {
        if (value === this._ds)
            return;
        if (value && this._ds && isFunction(value.isSame) && value.isSame(this._ds))
            return;
        this.clearData({
            clearAll: true
        });
        this._ds = value;
        if (this._ds && !this._ds.sortStrings)
            this.prepareDefaultSortStrings();
        if (!value) {
            if (this.UI.yearTracklist.controlClass.reportStatus)
                this.UI.yearTracklist.controlClass.setStatus('');
        }
        this.updateView(); // synchro to set as fast as possible
    }
    get year() {
        if (this.dataSource)
            return this.dataSource.year;
        else
            return undefined;
    }
    get scrollingParent() {
        this._scrollingParent = uitools.getScrollingParent(this.container, this._scrollingParent);
        return this._scrollingParent;
    }
}
registerClass(YearTracks);
