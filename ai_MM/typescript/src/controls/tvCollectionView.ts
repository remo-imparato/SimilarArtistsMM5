'use strict';

/**
@module UI
*/

import BaseCollectionView from './baseCollectionView';
import AlbumListView from './albumlistView';

/**
UI TVCollectionView element

@class TVCollectionView
@constructor
@extends BaseCollectionView
*/

export default class TVCollectionView extends BaseCollectionView {
    watchedView: CustomElementWith<AlbumListView>;
    addedView: CustomElementWith<AlbumListView>;
    collQry: string;

    initialize(rootelem, params) {
        super.initialize(rootelem, params);

        let _this = this;

        this.collection = null;
        this.container.innerHTML = loadFile('file:///controls/tvCollectionView.html');
        initializeControls(this.container);

        let navigateAlbum = function (e) {
            let album = e.detail.item;
            uitools.globalSettings.showingOnline = false; // opens My Library mode
            if (isNewTabEvent(e))
                uitools.navigateInNewTab('album', album, _this.collection);
            else
                navigationHandlers['album'].navigate(album, _this.collection);
            //_this.openView(album, 'album', e.detail.div); // opens as sub-view to keep the Music context (#13363)
        };

        // watched row:
        let watchedHeader = this.qChild('watchedLabel');
        this.watchedView = this.qChild('watchedView');
        this.watchedView.controlClass.isGrouped = false;
        /*      // should be here?
        this.localListen(watchedHeader, 'click', function (e) {
            if (isNewTabEvent(e))
                uitools.navigateInNewTab('series', _this.collection);
            else
                navigationHandlers['series'].navigate(_this.collection);
        });
        */
        this.localListen(this.watchedView, 'itemdblclick', navigateAlbum);
        this.localListen(this.watchedView, 'itementer', navigateAlbum);
        this.localListen(this.watchedView, 'itemview', navigateAlbum);
        this.watchedView.controlClass.oneRow = true; // keep always just one row of artists
        this.localListen(this.watchedView, 'datasourcechanged', function () {
            let ds = _this.watchedView.controlClass.dataSource;
            if (!ds) {
                setVisibility(watchedHeader, false);
                setVisibility(_this.watchedView, false);
            } else {
                _this.localPromise(ds.whenLoaded()).then(function () {
                    setVisibility(watchedHeader, (ds.count > 0));
                    setVisibility(_this.watchedView, (ds.count > 0));
                });
            }
        });

        // added row:
        let addedHeader = this.qChild('addedLabel');
        /*      // should be here?
        this.localListen(addedHeader, 'click', function (e) {
            if (isNewTabEvent(e))
                uitools.navigateInNewTab('series', _this.collection);
            else
                navigationHandlers['series'].navigate(_this.collection);
        });
        */
        this.addedView = this.qChild('addedView');
        this.addedView.controlClass.isGrouped = false;
        this.localListen(this.addedView, 'itemdblclick', navigateAlbum);
        this.localListen(this.addedView, 'itementer', navigateAlbum);
        this.localListen(this.addedView, 'itemview', navigateAlbum);
        this.addedView.controlClass.oneRow = true; // keep always just one row of albums
        this.localListen(this.addedView, 'datasourcechanged', function () {
            let ds = _this.addedView.controlClass.dataSource;
            if (!ds) {
                setVisibility(addedHeader, false);
                setVisibility(_this.addedView, false);
            } else {
                _this.localPromise(ds.whenLoaded()).then(function () {
                    setVisibility(addedHeader, (ds.count > 0));
                    setVisibility(_this.addedView, (ds.count > 0));
                });
            }
        });

        // Pinned row:
        pinViews.prepare.call(this);
    }

    _getWatched() {
        let limit = 100;
        if (window.isStub) {
            limit = 10;
        }
        let q =
            ' SELECT A.*, MAX(Songs.LastTimePlayed) AS MaxLastTimePlayed ' +
            ' FROM Albums A ' +
            '  INNER JOIN Songs ON (A.ID = Songs.IDAlbum) AND ' + this.collQry +
            ' GROUP BY A.ID ' +
            ' ORDER BY MaxLastTimePlayed DESC ' +
            ' LIMIT ' + limit;
        return app.db.getAlbumList(q, (this.collection ? this.collection.id : -1)).whenLoaded();
    }

    _getAdded(){
        let limit = 100;
        if (window.isStub) {
            limit = 10;
        }
        let q =
            ' SELECT A.*, MAX(Songs.DateAdded) AS MaxDateAdded ' +
            ' FROM Albums A ' +
            '  INNER JOIN Songs ON (A.ID = Songs.IDAlbum) AND ' + this.collQry +
            ' GROUP BY A.ID ' +
            ' ORDER BY MaxDateAdded DESC ' +
            ' LIMIT ' + limit;
        return app.db.getAlbumList(q, (this.collection ? this.collection.id : -1)).whenLoaded();
    }

    refresh() {
        let viewData = this.viewData;
        viewData.promise(this.collection.getCollectionQueryAsync()).then((sql) => {

            this.collQry = sql;

            viewData.dataSourceCache[this.constructor.name] = viewData.dataSourceCache[this.constructor.name] || {};
            let dsCache = viewData.dataSourceCache[this.constructor.name];

            if (dsCache.watched && dsCache.added) {
                this.watchedView.controlClass.dataSource = dsCache.watched;
                this.addedView.controlClass.dataSource = dsCache.added;
            } else {
                viewData.promise(this._getWatched()).then((list) => {
                    if (list) {
                        this.localPromise(list.whenLoaded()).then(() => {
                            dsCache.watched = list;
                        });
                        this.watchedView.controlClass.dataSource = list;
                    }
                    viewData.promise(this._getAdded()).then((alblist) => {
                        if (!alblist)
                            return;
                        this.localPromise(alblist.whenLoaded()).then(() => {
                            dsCache.added = alblist;
                        });
                        this.addedView.controlClass.dataSource = alblist;
                    });
                });
            }

        });
    }

    collectionCleanup() {
        this.watchedView.controlClass.dataSource = null;
        this.addedView.controlClass.dataSource = null;
    }

    cleanUp() {
        super.cleanUp();
        this.watchedView = undefined;
        this.addedView = undefined;
    }
}
registerClass(TVCollectionView);
