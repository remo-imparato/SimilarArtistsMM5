registerFileImport('controls/genreAlbums');

'use strict';


/**
@module UI
*/

import Control from './control';
import AlbumListView from './albumlistView';
import SortBy from './sortBy';
import ArrayDataSource from '../helpers/arrayDataSource';
import IconButton from './iconButton';


/**
UI GenreAlbums subview element

@class GenreAlbums
@constructor
@extends Control
*/

class GenreAlbums extends Control {
    disabledOnline: boolean;
    private _promises: AnyDict;
    UI: { [key: string]: HTMLElement; };
    showingOnline: boolean;
    isSomeOnlineAlbum: boolean;
    myMusicSet: boolean;
    longOnlineAlbums: ArrayDataSource;
    private _albumlistChangeHandler: (...params: any[]) => void;
    private _dataSourceChangeHandler: (...params: any[]) => void;
    private _ds: any;
    shortOnlineAlbums: boolean;

    initialize(rootelem, params) {
        super.initialize(rootelem, params);
        this.isSearchable = true;
        this.disabledOnline = true;
        this.helpContext = 'Filelisting';
        this.container.classList.add('oneRowControl');
        this.UI = undefined;
        this._promises = {};
        this.initializeView();
    }

    clearData(params) {
        this.cancelAll();
        this.UI.onlinealbumlist.controlClass.dataSource = null;
        this.isSomeOnlineAlbum = false;
        this.myMusicSet = false;
        this.setAlbumsDS(null); // clear DS
    }

    _getTopAlbums(collQuery) {
        let UI = this.UI;
        return this.genre.getAlbumList('SELECT DISTINCT albums.* FROM albums, genressongs, songs ' +
            ' WHERE genressongs.IDGenre = ' + this.genre.id + ' AND genressongs.IDSong = songs.ID AND albums.ID = songs.IDAlbum ' + collQuery +
            ' ORDER BY ' + (UI.albumSortByContainer.controlClass as SortBy).orderByString);
    }

    setAlbumsDS(ds) {
        if (this._albumlistChangeHandler && this.UI.albumlist.controlClass.dataSource) {
            app.unlisten(this.UI.albumlist.controlClass.dataSource, 'change', this._albumlistChangeHandler);
            this._albumlistChangeHandler = undefined;
        }
        if (this._promises.alblistLoaded)
            cancelPromise(this._promises.alblistLoaded);
        if (this._promises.alblistLoadedDCH)
            cancelPromise(this._promises.alblistLoadedDCH);
        if (!this._ds)
            return;
        if (ds) {
            if ((this.UI.albumlist.controlClass as AlbumListView).autoSortString)
                (this.UI.albumlist.controlClass as AlbumListView).autoSortString = ''; // force no sorting, we sort DS in SQL query
            this.UI.albumlist.controlClass.dataSource = ds;
            this._promises.alblistLoaded = ds.whenLoaded();
            this._promises.alblistLoaded.then(function () {
                this._promises.alblistLoaded = undefined;
                this._ds.cache.allAlbums = ds;
                this._updateAlbumsTitle(ds.count);
                this._albumlistChangeHandler = app.listen(ds, 'change', function () {
                    this.updateViewRequest();
                }.bind(this));
                this.updateViewRequest();
            }.bind(this), function () {
                this._promises.alblistLoaded = undefined;
            }.bind(this));
        }
    }

    _setTopAlbumsDS() {
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
                    this.setAlbumsDS(this._getTopAlbums('AND ' + sql));
                }
            }.bind(this));
        } else {
            this.setAlbumsDS(this._getTopAlbums(''));
        }
    }

    updateViewRequest() {
        this.requestTimeout(this.updateView.bind(this), 50, 'updateView');
    }

    filterSource(phrase) {
        super.filterSource(phrase);
        this.updateViewRequest();
    }

    _updateTitle(listCtrl, titleCtrl, cnt: number, expanded?:boolean) {    
        listCtrl.controlClass.oneRow = !expanded;
        
        if (cnt > (this.UI.albumlist.controlClass as AlbumListView).itemsPerRow) {
            titleCtrl.loadedText += ' (' + cnt + ')';
            titleCtrl.innerText = titleCtrl.loadedText;
            if (expanded)
                (this.UI.showTopAlbums.controlClass as IconButton).icon = 'showLess';
            else
                (this.UI.showTopAlbums.controlClass as IconButton).icon = 'showMore';
            setVisibility(this.UI.showTopAlbums, true);
        } else {
            titleCtrl.innerText = titleCtrl.loadedText;
            setVisibility(this.UI.showTopAlbums, false);
        }       
    }

    _updateAlbumsTitle(cnt: number, expanded?:boolean) {
        let UI = this.UI; // @ts-ignore
        UI.albumsHeader.loadedText = _('Albums');
        this._updateTitle(UI.albumlist, UI.albumsHeader, cnt, expanded);
    }

    updateView() {
        let UI = this.UI;
        if (!UI)
            return;
        let _this = this;
        let showOnline = _this.showingOnline;

        enterLayoutLock(this.container);

        let isSomeAlbum = UI.albumlist.controlClass.dataSource && (UI.albumlist.controlClass.dataSource.count > 0);
        setVisibility(UI.albumsHeader, !showOnline && isSomeAlbum);
        setVisibility(UI.albumSortByContainer, !showOnline && isSomeAlbum && UI.albumlist.controlClass.dataSource.count > 1);
        setVisibility(UI.albumlist, !showOnline && isSomeAlbum);

        setVisibility(UI.onlinealbumsHeader, showOnline && this.isSomeOnlineAlbum);
        setVisibility(UI.onlinealbumlist, showOnline && this.isSomeOnlineAlbum);

        leaveLayoutLock(this.container);

        if (!showOnline) {
            if (!_this.myMusicSet && _this.genre) {
                _this.myMusicSet = true;

                UI.albumsHeader.innerText = _('Albums');

                if (_this._ds.cache.allAlbums) {
                    UI.albumlist.controlClass.dataSource = _this._ds.cache.allAlbums;
                    _this._updateAlbumsTitle(_this._ds.cache.allAlbums.count);
                } else {
                    _this._setTopAlbumsDS();
                }
            } else {
                if (_this._ds && _this._ds.cache.allAlbums)
                    _this._updateAlbumsTitle(_this._ds.cache.allAlbums.count, !(UI.albumlist.controlClass as AlbumListView).oneRow);
            }
        } else {
            // top online albums not fetched yet 
        }
    }

    initializeView() {       
        let _this = this;
        this.container.innerHTML =
            '<div class="oneRowControlHeader">' +
            '    <div>'+
            '        <h3 data-id="albumsHeader" class="inline verticalCenter">Albums</h3>' +
            '        <div data-id="showTopAlbums" tabindex="0" data-icon="showMore" class="inline verticalCenter noPadding" data-control-class="IconButton"></div>' +
            '    </div>'+            
            '    <div data-id="albumSortByContainer" class="floatRight verticalCenter" data-control-class="SortBy" data-init-params="{sortType: \'album\', sortID:\'popularity\'}"></div>' +
            '</div>' +
            '<div data-id="albumlist" class="showInline" data-control-class="AlbumListView" data-init-params="{isHorizontal: false, isGrouped: false, dynamicSize: true}"></div>' +
            '<h3 data-id="onlinealbumsHeader" class="blockTitleMargin">Albums</h3>' +
            '<div data-id="onlinealbumlist" class="showInline" data-control-class="AlbumListView" data-init-params="{isHorizontal: false, isGrouped: false, dynamicSize: true}"></div>';
        initializeControls(this.container);
        this.UI = getAllUIElements(this.container);
        let UI = this.UI;

        this.showingOnline = (uitools.globalSettings && !this.disabledOnline) ? uitools.globalSettings.showingOnline || false : false;

        let navigateAlbum = function (e) {
            let fAlbum = e.detail.item;
            // get unfiltered album object
            app.getObject('album', {
                id: fAlbum.id
            }).then(function (album) {
                if (album) {
                    if (isNewTabEvent(e)) {
                        uitools.navigateInNewTab('album', album);
                    } else
                        navigationHandlers.album.navigate(album);
                }
            }.bind(this));
        };
        let navigateOnlineAlbum = function (e) {
            let album = e.detail.item;
            musicBrainz.getReleases(_this.uniqueID, album.mbgid).then(function (releases) {
                if (releases.length) {
                    let alb = releases[0];
                    alb.objectType = 'album';
                    alb.mbrggid = album.mbgid;
                    if (isNewTabEvent(e)) {
                        uitools.navigateInNewTab('album', alb);
                    } else
                        navigationHandlers.album.navigate(alb);
                }
            });
        };
        this.localListen(UI.albumlist, 'itemdblclick', navigateAlbum.bind(this));
        this.localListen(UI.albumlist, 'itementer', navigateAlbum.bind(this));
        this.localListen(UI.albumlist, 'itemview', navigateAlbum.bind(this));
        this.localListen(UI.onlinealbumlist, 'itemdblclick', navigateOnlineAlbum);
        this.localListen(UI.onlinealbumlist, 'itementer', navigateOnlineAlbum);
        this.localListen(UI.onlinealbumlist, 'itemview', navigateOnlineAlbum);

        this.localListen(UI.albumlist, 'datasourcechanged', function () {
            if (UI.albumlist.controlClass.dataSource) {
                _this._promises.alblistLoadedDCH = UI.albumlist.controlClass.dataSource.whenLoaded();
                _this._promises.alblistLoadedDCH.then(function () {
                    _this._promises.alblistLoadedDCH = undefined;
                    _this.updateViewRequest();
                }, function () {
                    _this._promises.alblistLoadedDCH = undefined;
                });
            } else {
                _this.updateViewRequest();
            }
        });

        this.localListen(UI.showTopAlbums, 'click', function () {
            _this._updateAlbumsTitle(UI.albumlist.controlClass.dataSource.count, (UI.albumlist.controlClass as AlbumListView).oneRow);
        });
        addEnterAsClick(this, UI.showTopAlbums);
        this.localListen(UI.onlinealbumsHeader, 'click', function () {
            if (_this.shortOnlineAlbums) {
                UI.onlinealbumlist.controlClass.dataSource = null;
                (UI.onlinealbumlist.controlClass as AlbumListView).oneRow = !(UI.onlinealbumlist.controlClass as AlbumListView).oneRow;
                if ((UI.onlinealbumlist.controlClass as AlbumListView).oneRow) {
                    UI.onlinealbumlist.controlClass.dataSource = _this.shortOnlineAlbums;
                } else {
                    if (_this.longOnlineAlbums) {
                        UI.onlinealbumlist.controlClass.dataSource = _this.longOnlineAlbums;
                    } else {
                        musicBrainz.getTagReleaseGroups(_this.uniqueID, _this.genre).then(function (data) {
                            _this.longOnlineAlbums = new ArrayDataSource(data);
                            UI.onlinealbumlist.controlClass.dataSource = _this.longOnlineAlbums;
                        });
                    }
                }
            }
        });
        addEnterAsClick(this, UI.onlinealbumsHeader);
        this.localListen(UI.albumSortByContainer, 'change', function () {
            let popupShownList: AlbumListView = undefined;
            if(_this.showingOnline && !_this.disabledOnline) {
                if((UI.onlinealbumlist.controlClass as AlbumListView).isPopupShown())
                    popupShownList = UI.onlinealbumlist.controlClass as AlbumListView;
            } else {
                if((UI.albumlist.controlClass as AlbumListView).isPopupShown())
                    popupShownList = UI.albumlist.controlClass as AlbumListView;
            }
            if(popupShownList) {
                popupShownList.closePopupFast();
                _this.requestFrame(()=> {_this._setTopAlbumsDS();});
            } else
                _this._setTopAlbumsDS();
        });

        (UI.albumlist.controlClass as AlbumListView).oneRow = true;
        (UI.onlinealbumlist.controlClass as AlbumListView).oneRow = true;

        _this.updateViewRequest();

        this.localListen(this.container, 'layoutchange', () => {this.updateViewRequest();});
    }

    cleanUp() {
        this.dataSource = undefined; // will clear listener(s) and cancel all
        super.cleanUp();
    }

    cancelAll() {
        musicBrainz.cancelDownloads(this.uniqueID);
        for (let key in this._promises) {
            cancelPromise(this._promises[key]);
        }
        this._promises = {};
    }

    storeState() {
        return {};
    }

    restoreState(state) {}

    setFocus() {
        if (!this.showingOnline) {
            if (isVisible(this.UI.albumlist))
                this.UI.albumlist.focus();
            else
                this.container.focus();
        } else {
            if (isVisible(this.UI.onlinealbumlist))
                this.UI.onlinealbumlist.focus();
            else
                this.container.focus();
        }
    }

    dataSourceChangeHandler(params) {
        if (params && (params.uniqueID === this.uniqueID)) { // to avoid deadlock, do not call if we are the caller
            return;
        }

        if (params.eventType === 'clear') {
            this.clearData(params.clearAll);
            return;
        }
        if (params.eventType === 'settings') {
            this.showingOnline = (uitools.globalSettings && !this.disabledOnline) ? !!uitools.globalSettings.showingOnline : false;
            this.updateView();
            return;
        }
        this.updateViewRequest();
    }
    
    get dataSource () {
        return this._ds;
    }
    set dataSource (obj) {
        if (obj === this._ds)
            return;
        if (obj && this._ds && isFunction(obj.isSame) && obj.isSame(this._ds))
            return;

        if (this._ds) {
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
        } else {
            if (!this.showingOnline) {
                if ((this.UI.albumlist.controlClass as AlbumListView).reportStatus)
                    this.UI.albumlist.controlClass.setStatus('');
            } else if ((this.UI.onlinealbumlist.controlClass as AlbumListView).reportStatus)
                this.UI.onlinealbumlist.controlClass.setStatus('');
        }
        this.updateView(); // synchro so set as fast as possible
    }

    get genre() {
        if (this.dataSource)
            return this.dataSource.genre;
        else
            return undefined;
    }

    get mainControl() {
        if (this.showingOnline) {
            return this.UI.onlinealbumlist;
        } else {
            return this.UI.albumlist;
        }
    }
    
}
registerClass(GenreAlbums);
