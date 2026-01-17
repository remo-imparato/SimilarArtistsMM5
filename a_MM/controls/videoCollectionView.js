/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

'use strict';
/**
@module UI
*/
import BaseCollectionView from './baseCollectionView';
/**
UI VideoCollectionView element

@class VideoCollectionView
@constructor
@extends BaseCollectionView
*/
class VideoCollectionView extends BaseCollectionView {
    initialize(rootelem, params) {
        super.initialize(rootelem, params);
        let _this = this;
        this.collection = null;
        this.container.innerHTML = loadFile('file:///controls/videoCollectionView.html');
        initializeControls(this.container);
        let navigateVideo = function (e) {
            //let video = e.detail.item;
            uitools.globalSettings.showingOnline = false; // opens My Library mode
            //navigationHandlers['album'].navigate(album, _this.collection);
            //_this.openView(album, 'album', e.detail.div); // opens as sub-view to keep the Music context (#13363)
        };
        // watched > row:
        let watchedHeader = this.qChild('watchedLabel');
        this.watchedView = this.qChild('watchedView');
        this.watchedView.controlClass.isGrouped = false;
        this.localListen(this.watchedView, 'itemdblclick', navigateVideo);
        this.localListen(this.watchedView, 'itementer', navigateVideo);
        this.localListen(this.watchedView, 'itemview', navigateVideo);
        this.watchedView.controlClass.oneRow = true; // keep always just one row of artists
        this.localListen(this.watchedView, 'datasourcechanged', function () {
            let ds = _this.watchedView.controlClass.dataSource;
            if (!ds) {
                setVisibility(watchedHeader, false);
                setVisibility(_this.watchedView, false);
            }
            else {
                _this.localPromise(ds.whenLoaded()).then(function () {
                    setVisibility(watchedHeader, (ds.count > 0));
                    setVisibility(_this.watchedView, (ds.count > 0));
                });
            }
        });
        // added > row:
        let addedHeader = this.qChild('addedLabel');
        this.addedView = this.qChild('addedView');
        this.addedView.controlClass.isGrouped = false;
        this.localListen(this.addedView, 'itemdblclick', navigateVideo);
        this.localListen(this.addedView, 'itementer', navigateVideo);
        this.localListen(this.addedView, 'itemview', navigateVideo);
        this.addedView.controlClass.oneRow = true; // keep always just one row of albums
        this.localListen(this.addedView, 'datasourcechanged', function () {
            let ds = _this.addedView.controlClass.dataSource;
            if (!ds) {
                setVisibility(addedHeader, false);
                setVisibility(_this.addedView, false);
            }
            else {
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
        let q = ' SELECT * FROM Songs WHERE (LastTimePlayed>0) AND ' + this.collQry +
            ' ORDER BY LastTimePlayed DESC ' +
            ' LIMIT ' + limit;
        return app.db.getTracklist(q, (this.collection ? this.collection.id : -1)).whenLoaded();
    }
    _getAdded() {
        let limit = 100;
        if (window.isStub) {
            limit = 10;
        }
        let q = ' SELECT * FROM Songs WHERE ' + this.collQry +
            ' ORDER BY DateAdded DESC ' +
            ' LIMIT ' + limit;
        return app.db.getTracklist(q, (this.collection ? this.collection.id : -1)).whenLoaded();
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
            }
            else {
                viewData.promise(this._getWatched()).then((list) => {
                    if (list) {
                        viewData.promise(list.whenLoaded()).then(() => {
                            dsCache.inProgress = list;
                        });
                        this.watchedView.controlClass.dataSource = list;
                    }
                    viewData.promise(this._getAdded()).then((alblist) => {
                        if (!alblist)
                            return;
                        viewData.promise(alblist.whenLoaded()).then(() => {
                            dsCache.albums = alblist;
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
registerClass(VideoCollectionView);
