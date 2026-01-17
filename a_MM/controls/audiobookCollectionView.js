/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

'use strict';
registerFileImport('controls/audiobookCollectionView');
import BaseCollectionView from './baseCollectionView';
/**
 * UI AudiobookCollectionView element
 */
export default class AudiobookCollectionView extends BaseCollectionView {
    initialize(rootelem, params) {
        super.initialize(rootelem, params);
        let _this = this;
        this.collection = null;
        this.container.innerHTML = loadFile('file:///controls/audiobookCollectionView.html');
        initializeControls(this.container);
        let navigateAlbum = function (e) {
            let album = e.detail.item;
            uitools.globalSettings.showingOnline = false; // opens My Library mode
            if (isNewTabEvent(e)) {
                uitools.navigateInNewTab('album', album, _this.collection);
            }
            else {
                navigationHandlers['album'].navigate(album, _this.collection);
            }
            //_this.openView(album, 'album', e.detail.div); // opens as sub-view to keep the Music context (#13363)
        };
        // in Progress > row:
        let inProgressHeader = this.qChild('inProgressLabel');
        this.inProgressView = this.qChild('inProgressView');
        this.inProgressView.controlClass.isGrouped = false;
        this.localListen(this.inProgressView, 'itemdblclick', navigateAlbum);
        this.localListen(this.inProgressView, 'itementer', navigateAlbum);
        this.localListen(this.inProgressView, 'itemview', navigateAlbum);
        this.inProgressView.controlClass.oneRow = true; // keep always just one row of artists
        this.localListen(this.inProgressView, 'datasourcechanged', function () {
            let ds = _this.inProgressView.controlClass.dataSource;
            if (!ds) {
                setVisibility(inProgressHeader, false);
                setVisibility(_this.inProgressView, false);
            }
            else {
                _this.localPromise(ds.whenLoaded()).then(function () {
                    setVisibility(inProgressHeader, (ds.count > 0));
                    setVisibility(_this.inProgressView, (ds.count > 0));
                });
            }
        });
        // Albums > row:
        let albumsHeader = this.qChild('albumsLabel');
        this.localListen(albumsHeader, 'click', function (e) {
            if (isNewTabEvent(e)) {
                uitools.navigateInNewTab('albums', _this.collection);
            }
            else {
                navigationHandlers['albums'].navigate(_this.collection);
            }
        });
        addEnterAsClick(this, albumsHeader);
        this.albumsView = this.qChild('albumsView');
        this.albumsView.controlClass.isGrouped = false;
        this.localListen(this.albumsView, 'itemdblclick', navigateAlbum);
        this.localListen(this.albumsView, 'itementer', navigateAlbum);
        this.localListen(this.albumsView, 'itemview', navigateAlbum);
        //this.localListen(this.albumsView, 'itemclick', navigateAlbum);
        this.albumsView.controlClass.oneRow = true; // keep always just one row of albums
        this.localListen(this.albumsView, 'datasourcechanged', function () {
            let ds = _this.albumsView.controlClass.dataSource;
            if (!ds) {
                setVisibility(albumsHeader, false);
                setVisibility(_this.albumsView, false);
            }
            else {
                _this.localPromise(ds.whenLoaded()).then(function () {
                    setVisibility(albumsHeader, (ds.count > 0));
                    setVisibility(_this.albumsView, (ds.count > 0));
                });
            }
        });
        // Pinned row:
        pinViews.prepare.call(this);
    }
    _getTopAlbums() {
        let q = ' SELECT A.*, MAX(Songs.DateAdded) AS MaxDateAdded ' +
            ' FROM Albums A ' +
            '  INNER JOIN Songs ON (A.ID = Songs.IDAlbum) AND ' + this.collQry +
            ' GROUP BY A.ID ' +
            ' ORDER BY MaxDateAdded DESC ' +
            ' LIMIT 100 ';
        return app.db.getAlbumList(q, (this.collection ? this.collection.id : -1)).whenLoaded();
    }
    _getInProgress() {
        let q = ' SELECT A.*, MAX(Songs.DateAdded) AS MaxDateAdded, MAX(Songs.LastTimePlayed) AS MaxLastTimePlayed ' +
            ' FROM Albums A ' +
            '  INNER JOIN Songs ON (A.ID = Songs.IDAlbum) AND (Songs.PlaybackPos > 0) AND ' + this.collQry +
            ' GROUP BY A.ID ' +
            ' ORDER BY MaxLastTimePlayed DESC ' +
            ' LIMIT 100 ';
        return app.db.getAlbumList(q, (this.collection ? this.collection.id : -1)).whenLoaded();
    }
    refresh() {
        let viewData = this.viewData;
        viewData.promise(this.collection.getCollectionQueryAsync()).then((sql) => {
            this.collQry = sql;
            viewData.dataSourceCache[this.constructor.name] = viewData.dataSourceCache[this.constructor.name] || {};
            let dsCache = viewData.dataSourceCache[this.constructor.name];
            if (dsCache.inProgress && dsCache.albums) {
                this.inProgressView.controlClass.dataSource = dsCache.inProgress;
                this.albumsView.controlClass.dataSource = dsCache.albums;
            }
            else {
                viewData.promise(this._getInProgress()).then((list) => {
                    if (list) {
                        this.localPromise(list.whenLoaded()).then(() => {
                            dsCache.inProgress = list;
                        });
                        this.inProgressView.controlClass.dataSource = list;
                    }
                    viewData.promise(this._getTopAlbums()).then((alblist) => {
                        if (!alblist)
                            return;
                        viewData.promise(alblist.whenLoaded()).then(() => {
                            dsCache.albums = alblist;
                        });
                        this.albumsView.controlClass.dataSource = alblist;
                    });
                });
            }
        });
        pinViews.setDataSource.call(this, viewData);
    }
    collectionCleanup() {
        this.inProgressView.controlClass.dataSource = null;
        this.albumsView.controlClass.dataSource = null;
    }
    cleanUp() {
        super.cleanUp();
        this.albumsView = undefined;
    }
}
registerClass(AudiobookCollectionView);
