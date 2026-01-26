/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

'use strict';
import Control from './control';
/**
@module UI
*/
/**
UI YearArtists subview element

@class YearArtists
@constructor
@extends Control
*/
export default class YearArtists extends Control {
    initialize(rootelem, params) {
        super.initialize(rootelem, params);
        this.isSearchable = true;
        this.container.classList.add('oneRowControl');
        this.helpContext = 'Filelisting';
        this.container.innerHTML =
            '<div class="oneRowControlHeader">' +
                '    <h3 data-id="artistsHeader" class="inline verticalCenter">Artists</h3>' +
                '    <div data-id="artistSortByContainer" class="floatRight verticalCenter" data-control-class="SortBy" data-init-params="{sortType: \'artist\', sortID:\'popularity\'}"></div>' +
                '</div>' +
                '<div data-id="artistlist" class="showInline" data-control-class="ArtistGrid" data-init-params="{isHorizontal: false, isGrouped: false, dynamicSize: true}"></div>';
        initializeControls(this.container);
        this.UI = getAllUIElements(this.container);
        let UI = this.UI;
        let _this = this;
        this._promises = {};
        let navigateArtist = function (e) {
            let artist = e.detail.item;
            app.getObject('artist', {
                id: artist.id,
                name: artist.name,
                mbgid: artist.mbgid,
                canCreateNew: (artist.id < 0)
            }).then(function (artist) {
                if (artist) {
                    if (isNewTabEvent(e)) {
                        uitools.navigateInNewTab('artist', artist);
                    }
                    else
                        navigationHandlers.artist.navigate(artist);
                }
            }.bind(this));
        };
        this.localListen(UI.artistlist, 'itemdblclick', navigateArtist.bind(this));
        this.localListen(UI.artistlist, 'itementer', navigateArtist.bind(this));
        this.localListen(UI.artistlist, 'itemview', navigateArtist.bind(this));
        this.localListen(UI.artistlist, 'datasourcechanged', function () {
            if (UI.artistlist.controlClass.dataSource) {
                _this._promises.artlistLoaded = UI.artistlist.controlClass.dataSource.whenLoaded();
                _this._promises.artlistLoaded.then(function () {
                    _this._promises.artlistLoaded = undefined;
                    _this.updateViewRequest();
                });
            }
            else {
                _this.updateViewRequest();
            }
        });
        this.localListen(UI.artistsHeader, 'click', function () {
            _this._updateArtistsTitle(UI.artistlist.controlClass.dataSource.count, UI.artistlist.controlClass.oneRow);
        });
        this.localListen(UI.artistSortByContainer, 'change', () => {
            if (UI.artistlist.controlClass.isPopupShown()) {
                UI.artistlist.controlClass.closePopupFast();
                _this.requestFrame(() => { _this._setTopArtistsDS(); });
            }
            else
                _this._setTopArtistsDS();
        });
        UI.artistlist.controlClass.oneRow = true;
        _this.updateViewRequest();
        this.localListen(this.container, 'layoutchange', () => { this.updateViewRequest(); });
    }
    _getTopArtists(collQuery) {
        if (!this.year)
            return undefined;
        let UI = this.UI;
        let dO = this.year;
        let viewCond;
        let yearCol = dO.yearColumn;
        if (dO.objectType === 'year')
            viewCond = sprintf('((Songs.%s = %d) or (Songs.%s / 10000 = %d))', yearCol, dO.value, yearCol, dO.value);
        else { // decade
            viewCond = sprintf('(((Songs.%s >= %d) and (Songs.%s < %d)) or ((Songs.%s / 10000 >= %d) and (Songs.%s / 10000 < %d)))', yearCol, dO.value, yearCol, dO.value + 10, yearCol, dO.value, yearCol, dO.value + 10);
        }
        return this.year.getArtistList('SELECT DISTINCT artists.* FROM artists, songs, artistssongs ' +
            ' WHERE ' + viewCond + ' AND artistssongs.IDSong = songs.ID AND artistssongs.PersonType = 1 AND artists.ID = artistssongs.IDArtist ' + collQuery + // @ts-ignore
            ' ORDER BY ' + UI.artistSortByContainer.controlClass.orderByString);
    }
    setArtistsDS(ds) {
        if (this._dataSourceChangeHandler && this.UI.artistlist.controlClass.dataSource) {
            app.unlisten(this.UI.artistlist.controlClass.dataSource, 'change', this._dataSourceChangeHandler);
            this._dataSourceChangeHandler = undefined;
        }
        if (this._promises.artistlistLoaded)
            cancelPromise(this._promises.artistlistLoaded);
        if (!this._ds)
            return;
        if (ds) {
            this.UI.artistlist.controlClass.dataSource = ds;
            this._promises.artistlistLoaded = ds.whenLoaded();
            this._promises.artistlistLoaded.then(function () {
                this._promises.artistlistLoaded = undefined;
                this._ds.cache.artistlist = ds;
                this._updateArtistsTitle(ds.count);
                this._dataSourceChangeHandler = app.listen(ds, 'change', function () {
                    this.updateViewRequest();
                }.bind(this));
                this.updateViewRequest();
            }.bind(this), function () {
                this._promises.artistlistLoaded = undefined;
            }.bind(this));
        }
    }
    _setTopArtistsDS() {
        if (!this.year)
            return;
        let dO = this.year;
        let coll;
        if (dO.idColl > 0)
            coll = app.collections.getCollection(dO.idColl);
        else
            coll = app.collections.getEntireLibrary(); // #14293 / item 17
        if (coll) {
            if (this._promises.getCollectionQuery)
                cancelPromise(this._promises.getCollectionQuery);
            this._promises.getCollectionQuery = coll.getCollectionQueryAsync();
            this._promises.getCollectionQuery.then(function (sql) {
                this._promises.getCollectionQuery = undefined;
                if (sql) {
                    this.setArtistsDS(this._getTopArtists('AND ' + sql));
                }
            }.bind(this));
        }
        else {
            this.setArtistsDS(this._getTopArtists(''));
        }
    }
    _updateTitle(listCtrl, titleCtrl, cnt, expanded) {
        let UI = this.UI;
        let _this = this;
        let expandIndicator = expanded ? 'v' : '>';
        listCtrl.controlClass.oneRow = !expanded;
        titleCtrl.classList.remove('clickable');
        if (cnt > UI.artistlist.controlClass.itemsPerRow) {
            titleCtrl.loadedText += ' (' + cnt + ')';
            titleCtrl.innerText = titleCtrl.loadedText + ' ' + expandIndicator;
            titleCtrl.classList.add('clickable');
        }
        else
            titleCtrl.innerText = titleCtrl.loadedText;
    }
    _updateArtistsTitle(cnt, expanded) {
        let UI = this.UI;
        // @ts-ignore  // LS: the loadedText property below does not seem to be used anywhere ?
        UI.artistsHeader.loadedText = _('Artists');
        this._updateTitle(UI.artistlist, UI.artistsHeader, cnt, expanded);
    }
    updateViewRequest() {
        this.requestTimeout(this.updateView.bind(this), 50, 'updateView');
    }
    updateView() {
        let UI = this.UI;
        if (!UI)
            return;
        let _this = this;
        enterLayoutLock(this.container);
        let isSomeArtist = UI.artistlist.controlClass.dataSource && (UI.artistlist.controlClass.dataSource.count > 0);
        setVisibility(UI.artistsHeader, isSomeArtist);
        setVisibility(UI.artistSortByContainer, isSomeArtist && UI.artistlist.controlClass.dataSource.count > 1);
        setVisibility(UI.artistlist, isSomeArtist);
        leaveLayoutLock(this.container);
        if (!_this.myMusicSet && _this.year) {
            _this.myMusicSet = true;
            UI.artistsHeader.innerText = _('Artists');
            if (_this._ds.cache.artistlist) {
                UI.artistlist.controlClass.dataSource = _this._ds.cache.artistlist;
                _this._updateArtistsTitle(_this._ds.cache.artistlist.count);
            }
            else {
                _this._setTopArtistsDS();
            }
        }
        else {
            if (_this._ds && _this._ds.cache.artistlist)
                _this._updateArtistsTitle(_this._ds.cache.artistlist.count, !UI.artistlist.controlClass.oneRow);
        }
    }
    cancelAll() {
        musicBrainz.cancelDownloads(this.uniqueID);
        for (let key in this._promises) {
            cancelPromise(this._promises[key]);
        }
        if (this._relatedArtistsCancelToken) {
            this._relatedArtistsCancelToken.cancel = true;
        }
        this._promises = {};
        ODS('YearArtists: cancelled all ' + this.uniqueID);
    }
    clearData(params) {
        this.cancelAll();
        this.setArtistsDS(null); // clear DS
        this.isSomeRelatedArtist = false;
        this.myMusicSet = false;
    }
    cleanUp() {
        this.cancelAll();
        this._relatedArtistsCancelToken = undefined;
        super.cleanUp();
    }
    storeState() {
        return {};
    }
    restoreState(state) { }
    setFocus() {
        if (isVisible(this.UI.artistlist))
            this.UI.artistlist.focus();
        else
            this.container.focus();
    }
    get dataSource() {
        return this._ds;
    }
    set dataSource(obj) {
        if (obj === this._ds)
            return;
        if (obj && this._ds && isFunction(obj.isSame) && obj.isSame(this._ds))
            return;
        if (this.year) {
            this.clearData({
                clearAll: true
            });
        }
        this._ds = obj;
        if (!obj) {
            if (this.UI.artistlist.controlClass.reportStatus)
                this.UI.artistlist.controlClass.setStatus('');
        }
        this.updateView();
    }
    get year() {
        if (this.dataSource)
            return this.dataSource.dataObject;
        else
            return undefined;
    }
}
registerClass(YearArtists);
