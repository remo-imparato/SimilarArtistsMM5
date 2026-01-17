'use strict';

registerFileImport('controls/yearAlbums');

import AlbumListView from './albumlistView';
import Control from './control';
import IconButton from './iconButton';

/**
@module UI
*/

/**
UI YearAlbums subview element

@class YearAlbums
@constructor
@extends Control
*/


export default class YearAlbums extends Control {
    private _promises: AnyDict;
    UI: { [key: string]: HTMLElement; };
    private _ds: any;
    myMusicSet: boolean;
    private _dataSourceChangeHandler: any;
    private _scrollingParent: any;

    initialize(rootelem, params) {
        super.initialize(rootelem, params);
        this.isSearchable = true;
        this.container.classList.add('oneRowControl');
        this.UI = undefined;
        this._promises = {};
        this.initializeView();
        this.helpContext = 'Filelisting';
    }

    clearData(params) {
        this.cancelAll();
        this.setAlbumsDS(null); // clear DS
        this.myMusicSet = false;
    }

    _getTopAlbums(collQuery) {
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

        // @ts-ignore
        return dO.getAlbumList('SELECT DISTINCT Albums.* FROM Albums, Songs WHERE (Albums.ID = Songs.IDAlbum) AND ' + viewCond + collQuery + ' ORDER BY ' + UI.albumSortByContainer.controlClass.orderByString);
    }

    _setTopAlbumsDS() {
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

    _updateTitle(listCtrl, titleCtrl, cnt) {
        let UI = this.UI;

        let expanded = !(UI.albumlist.controlClass as AlbumListView).oneRow;
        
        if (cnt > (UI.albumlist.controlClass as AlbumListView).itemsPerRow) {
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

    _updateAlbumsTitle(cnt) {
        let UI = this.UI;
        let _this = this;
        // @ts-ignore // LS: is the loadedText below used somewhere ?
        UI.albumsHeader.loadedText = _('Albums');
        this._updateTitle(UI.albumlist, UI.albumsHeader, cnt);
    }

    updateView() {
        let UI = this.UI;
        if (!UI)
            return;
        let _this = this;

        enterLayoutLock(this.scrollingParent);

        let isSomeAlbum = UI.albumlist.controlClass.dataSource && (UI.albumlist.controlClass.dataSource.count > 0);
        setVisibility(UI.albumsHeader, isSomeAlbum);
        setVisibility(UI.albumSortByContainer, isSomeAlbum && UI.albumlist.controlClass.dataSource.count > 1);
        setVisibility(UI.albumlist, isSomeAlbum);

        leaveLayoutLock(this.scrollingParent);

        if (!_this.myMusicSet && _this.year) {
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
                _this._updateAlbumsTitle(_this._ds.cache.allAlbums.count);
        }
    }

    setAlbumsDS(ds) {
        if (this._dataSourceChangeHandler && this.UI.albumlist.controlClass.dataSource) {
            app.unlisten(this.UI.albumlist.controlClass.dataSource, 'change', this._dataSourceChangeHandler);
            this._dataSourceChangeHandler = undefined;
        }
        if (this._promises.alblistLoaded)
            cancelPromise(this._promises.alblistLoaded);
        if (!this._ds)
            return;
        if (ds) {
            if ((this.UI.albumlist.controlClass as AlbumListView).autoSortString)
                (this.UI.albumlist.controlClass as AlbumListView).autoSortString = ''; // force no sorting, we sort DS itself
            this.UI.albumlist.controlClass.dataSource = ds;
            this._promises.alblistLoaded = ds.whenLoaded();
            this._promises.alblistLoaded.then(function () {
                this._promises.alblistLoaded = undefined;
                this._ds.cache.allAlbums = ds;
                this._updateAlbumsTitle(ds.count);
                this._dataSourceChangeHandler = app.listen(ds, 'change', function () {
                    this.updateViewRequest();
                }.bind(this));
                this.updateViewRequest();
            }.bind(this), function () {
                this._promises.alblistLoaded = undefined;
            }.bind(this));
        }
    }

    initializeView() {
        let rootelem = this.container;
        let _this = this;
        this.container.innerHTML =
            '<div class="oneRowControlHeader">' +
            '    <div>'+
            '       <h3 data-id="albumsHeader" class="inline verticalCenter">Albums</h3>' +
            '       <div data-id="showTopAlbums" tabindex="0" data-icon="showMore" class="inline verticalCenter noPadding" data-control-class="IconButton"></div>' +            
            '    </div>'+
            '    <div data-id="albumSortByContainer" class="floatRight verticalCenter" data-control-class="SortBy" data-init-params="{sortType: \'album\', sortID:\'popularity\'}"></div>' +
            '</div>' +
            '<div data-id="albumlist" class="showInline" data-control-class="AlbumListView" data-init-params="{isHorizontal: false, isGrouped: false, dynamicSize: true}"></div>';
        initializeControls(this.container);
        this.UI = getAllUIElements(this.container);
        let UI = this.UI;

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

        this.localListen(UI.albumlist, 'itemdblclick', navigateAlbum.bind(this));
        this.localListen(UI.albumlist, 'itementer', navigateAlbum.bind(this));
        this.localListen(UI.albumlist, 'itemview', navigateAlbum.bind(this));

        this.localListen(UI.showTopAlbums, 'click', function () {
            (UI.albumlist.controlClass as AlbumListView).oneRow = !(UI.albumlist.controlClass as AlbumListView).oneRow;
            _this._updateAlbumsTitle(UI.albumlist.controlClass.dataSource.count);
            if((UI.albumlist.controlClass as AlbumListView).oneRow)
                deferredNotifyLayoutChangeDown(_this.scrollingParent, 'scrollerContentChanged'); // #20968
        });        
        addEnterAsClick(this, UI.showTopAlbums);
        
        this.localListen(UI.albumSortByContainer, 'change', function () {
            if((UI.albumlist.controlClass as AlbumListView).isPopupShown()) {
                (UI.albumlist.controlClass as AlbumListView).closePopupFast();
                _this.requestFrame(()=> {_this._setTopAlbumsDS();});
            } else
                _this._setTopAlbumsDS();
        });

        (UI.albumlist.controlClass as AlbumListView).oneRow = true;

        _this.updateViewRequest();

        this.localListen(this.container, 'layoutchange', () => {this.updateViewRequest();});
    }

    cleanUp() {
        this.clearData({
            clearAll: true
        });
        super.cleanUp();
    }

    cancelAll() {
        for (let key in this._promises) {
            cancelPromise(this._promises[key]);
        }
        this._promises = {};
    }

    storeState() {
        return {};
    }

    restoreState(state) { }

    setFocus() {
        if (isVisible(this.UI.albumlist))
            this.UI.albumlist.focus();
        else
            this.container.focus();
    }

    get dataSource() {
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
        if (!value) {
            if ((this.UI.albumlist.controlClass as AlbumListView).reportStatus)
                (this.UI.albumlist.controlClass as AlbumListView).setStatus('');
        }
        this.updateView(); // synchro so set as fast as possible
    }

    get year() {
        if (this.dataSource)
            return this.dataSource.year;
        else
            return undefined;
    }
    
    get scrollingParent () {
        this._scrollingParent = uitools.getScrollingParent(this.container, this._scrollingParent);
        return this._scrollingParent;
    }
}
registerClass(YearAlbums);
