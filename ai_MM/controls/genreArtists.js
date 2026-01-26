/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

registerFileImport('controls/genreArtists');
'use strict';
import Control from './control';
/**
@module UI
*/
/**
UI GenreArtists subview element

@class GenreArtists
@constructor
@extends Control
*/
class GenreArtists extends Control {
    initialize(rootelem, params) {
        super.initialize(rootelem, params);
        this.isSearchable = true;
        this.disabledOnline = true;
        this.helpContext = 'Filelisting';
        this.container.classList.add('oneRowControl');
        this.container.innerHTML =
            '<div class="oneRowControlHeader">' +
                '    <div>' +
                '        <h3 data-id="artistsHeader" class="inline verticalCenter">Artists</h3>' +
                '        <div data-id="showTopArtists" tabindex="0" data-icon="showMore" class="inline verticalCenter noPadding" data-control-class="IconButton"></div>' +
                '    </div>' +
                '    <div data-id="artistSortByContainer" class="floatRight verticalCenter" data-control-class="SortBy" data-init-params="{sortType: \'artist\', sortID:\'popularity\'}"></div>' +
                '</div>' +
                '<div data-id="artistlist" class="showInline" data-control-class="ArtistGrid" data-init-params="{isHorizontal: false, isGrouped: false, dynamicSize: true}"></div>' +
                '<h3 data-id="onlineartistsHeader" class="blockTitleMargin">Top Artists</h3>' +
                '<div data-id="onlineartistlist" class="showInline" data-control-class="ArtistGrid" data-init-params="{isHorizontal: false, isGrouped: false, dynamicSize: true}"></div>';
        initializeControls(this.container);
        this.UI = getAllUIElements(this.container);
        let UI = this.UI;
        this.showingOnline = (uitools.globalSettings && !this.disabledOnline) ? !!uitools.globalSettings.showingOnline : false;
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
        this.localListen(UI.onlineartistlist, 'itemdblclick', navigateArtist.bind(this));
        this.localListen(UI.onlineartistlist, 'itementer', navigateArtist.bind(this));
        this.localListen(UI.onlineartistlist, 'itemview', navigateArtist.bind(this));
        this.localListen(UI.artistlist, 'itemdblclick', navigateArtist.bind(this));
        this.localListen(UI.artistlist, 'itementer', navigateArtist.bind(this));
        this.localListen(UI.artistlist, 'itemview', navigateArtist.bind(this));
        let _this = this;
        this.localListen(UI.artistlist, 'datasourcechanged', () => {
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
        this.localListen(UI.showTopArtists, 'click', () => {
            _this._updateArtistsTitle(UI.artistlist.controlClass.dataSource.count, UI.artistlist.controlClass.oneRow);
        });
        addEnterAsClick(this, UI.showTopArtists);
        this.localListen(UI.artistSortByContainer, 'change', () => {
            let popupShownList = undefined;
            if (_this.showingOnline && !_this.disabledOnline) {
                if (UI.onlineartistlist.controlClass.isPopupShown())
                    popupShownList = UI.onlineartistlist.controlClass;
            }
            else {
                if (UI.artistlist.controlClass.isPopupShown())
                    popupShownList = UI.artistlist.controlClass;
            }
            if (popupShownList) {
                popupShownList.closePopupFast();
                _this.requestFrame(() => { _this._setTopArtistsDS(); });
            }
            else
                _this._setTopArtistsDS();
        });
        UI.artistlist.controlClass.oneRow = true;
        //UI.onlineartistlist.controlClass.oneRow = true;
        this.updateViewRequest();
        this.localListen(this.container, 'layoutchange', () => { this.updateViewRequest(); });
    }
    createGenreArtists(arts) {
        let _this = this;
        let UI = _this.UI;
        let ralist = [];
        if (arts && arts.length) {
            _this._relatedArtistsCancelToken = {
                cancel: false
            };
            asyncLoop(function (i) {
                let ritem = arts[i];
                musicBrainz.getArtistClass(_this.uniqueID, ritem);
                ralist.push(ritem);
                return (i + 1 >= arts.length);
            }, 0, _this._relatedArtistsCancelToken, function () {
                // finished asyncLoop
                let alds = app.utils.createArtistlist(false); // not loaded flag
                _this._promises.fillOnlineArtists = alds.asyncFill(ralist.length, function (idx, artist) {
                    musicBrainz.fillArtist(_this.uniqueID, artist, ralist[idx]);
                }).then(function () {
                    _this._promises.fillOnlineArtists = undefined;
                    _this._ds.cache.onlineartistlist = alds;
                    UI.onlineartistlist.controlClass.dataSource = alds;
                    _this.isSomeRelatedArtist = true;
                    _this._relatedArtistsCancelToken = undefined;
                    _this.updateViewRequest();
                });
            });
        }
    }
    _getTopArtists(collQuery) {
        let UI = this.UI;
        return this.genre.getArtistList('SELECT DISTINCT artists.* FROM artists, genressongs, songs, artistssongs ' +
            ' WHERE genressongs.IDGenre = ' + this.genre.id + ' AND genressongs.IDSong = songs.ID AND ' +
            ' artistssongs.IDSong = songs.ID AND artistssongs.PersonType = 1 AND artists.ID = artistssongs.IDArtist ' + collQuery + // @ts-ignore
            ' ORDER BY ' + UI.artistSortByContainer.controlClass.orderByString);
    }
    setArtistsDS(ds) {
        if (this._artistlistChangeHandler && this.UI.artistlist.controlClass.dataSource) {
            app.unlisten(this.UI.artistlist.controlClass.dataSource, 'change', this._artistlistChangeHandler);
            this._artistlistChangeHandler = undefined;
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
                this._artistlistChangeHandler = app.listen(ds, 'change', function () {
                    this.updateViewRequest();
                }.bind(this));
                this.updateViewRequest();
            }.bind(this), function () {
                this._promises.artistlistLoaded = undefined;
            }.bind(this));
        }
    }
    _setTopArtistsDS() {
        if (!this.genre)
            return;
        let dO = this.genre;
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
        listCtrl.controlClass.oneRow = !expanded;
        if (cnt > UI.artistlist.controlClass.itemsPerRow) {
            titleCtrl.loadedText += ' (' + cnt + ')';
            titleCtrl.innerText = titleCtrl.loadedText;
            if (expanded)
                UI.showTopArtists.controlClass.icon = 'showLess';
            else
                UI.showTopArtists.controlClass.icon = 'showMore';
            setVisibility(UI.showTopArtists, true);
        }
        else {
            titleCtrl.innerText = titleCtrl.loadedText;
            setVisibility(UI.showTopArtists, false);
        }
    }
    _updateArtistsTitle(cnt, expanded) {
        let UI = this.UI; // @ts-ignore
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
        let showOnline = _this.showingOnline;
        enterLayoutLock(this.container);
        let isSomeArtist = UI.artistlist.controlClass.dataSource && (UI.artistlist.controlClass.dataSource.count > 0);
        setVisibility(UI.artistsHeader, !showOnline && isSomeArtist);
        setVisibility(UI.artistSortByContainer, !showOnline && isSomeArtist && UI.artistlist.controlClass.dataSource.count > 1);
        setVisibility(UI.artistlist, !showOnline && isSomeArtist);
        setVisibility(UI.onlineartistsHeader, showOnline && this.isSomeRelatedArtist);
        setVisibility(UI.onlineartistlist, showOnline && this.isSomeRelatedArtist);
        leaveLayoutLock(this.container);
        if (!showOnline) {
            if (!_this.myMusicSet && _this.genre) {
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
        else {
            if (this._ds) {
                if (this._ds.onlineData) {
                    if (this.onlineartists !== this._ds.onlineData.artists) {
                        // get artists
                        this.onlineartists = this._ds.onlineData.artists;
                        if (this._ds.cache.onlineartistlist) {
                            this.UI.onlineartistlist.controlClass.dataSource = this._ds.cache.onlineartistlist;
                            this.isSomeRelatedArtist = true;
                            this.updateViewRequest();
                        }
                        else {
                            this.createGenreArtists(this.onlineartists);
                        }
                    }
                }
                else {
                    _this._ds.fetchGenre();
                }
            }
        }
    }
    filterSource(phrase) {
        super.filterSource(phrase);
        this.updateViewRequest();
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
        ODS('GenreArtists: cancelled all ' + this.uniqueID);
    }
    clearData(params) {
        this.cancelAll();
        this.setArtistsDS(null); // clear DS
        this.UI.onlineartistlist.controlClass.dataSource = null;
        this.isSomeRelatedArtist = false;
        this.myMusicSet = false;
        this.onlineartists = undefined;
    }
    cleanUp() {
        this.dataSource = undefined; // will clear listener(s) and cancel all
        this._relatedArtistsCancelToken = undefined;
        super.cleanUp();
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
                }
            }
        }
        this.updateViewRequest();
    }
    storeState() {
        return {};
    }
    restoreState(state) { }
    setFocus() {
        if (!this.showingOnline) {
            if (isVisible(this.UI.artistlist)) {
                this.UI.artistlist.focus();
            }
            else {
                this.container.focus();
            }
        }
        else {
            if (isVisible(this.UI.onlineartistlist)) {
                this.UI.onlineartistlist.focus();
            }
            else {
                this.container.focus();
            }
        }
    }
    get dataSource() {
        return this._ds;
    }
    set dataSource(obj) {
        if (obj === this._ds)
            return;
        if (obj && this._ds && isFunction(obj.isSame) && obj.isSame(this._ds))
            return;
        if (this.genre) {
            if (this._ds && this._dataSourceChangeHandler) {
                app.unlisten(this._ds, 'change', this._dataSourceChangeHandler);
                this._dataSourceChangeHandler = undefined;
            }
            this.clearData({
                clearAll: true
            });
        }
        this._ds = obj;
        if (obj) {
            this._dataSourceChangeHandler = app.listen(this._ds, 'change', this.dataSourceChangeHandler.bind(this));
        }
        else {
            if (!this.showingOnline) {
                if (this.UI.artistlist.controlClass.reportStatus)
                    this.UI.artistlist.controlClass.setStatus('');
            }
            else if (this.UI.onlineartistlist.controlClass.reportStatus)
                this.UI.onlineartistlist.controlClass.setStatus('');
        }
        this.updateView();
    }
    get genre() {
        if (this.dataSource)
            return this.dataSource.dataObject;
        else
            return undefined;
    }
}
registerClass(GenreArtists);
