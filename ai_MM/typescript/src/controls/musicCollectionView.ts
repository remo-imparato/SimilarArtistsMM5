'use strict';

import AlbumListView from './albumlistView';
import ArtistGrid from './artistGrid';
import BaseCollectionView from './baseCollectionView';

/**
@module UI
*/

/**
UI MusicCollectionView element

@class MusicCollectionView
@constructor
@extends BaseCollectionView
*/

class MusicCollectionView extends BaseCollectionView {
    artistsView: ElementWith<ArtistGrid>;
    albumsView: ElementWith<AlbumListView>;
    collQry: string;
    artistIds: string;
    albumIds: string;

    initialize(rootelem, params) {
        super.initialize(rootelem, params);

        let _this = this;

        this.collection = null;
        this.container.innerHTML = loadFile('file:///controls/musicCollectionView.html');
        initializeControls(this.container);

        // Artists > row:
        let artistHeader = this.qChild('artistsLabel');
        this.localListen(artistHeader, 'click', function () {
            navigationHandlers['artists'].navigate(_this.collection);
        });
        addEnterAsClick(this, artistHeader);

        this.artistsView = this.qChild('artistsView');
        this.artistsView.controlClass.isGrouped = false;
        let navigateArtist = function (e) {
            let artist = e.detail.item;
            uitools.globalSettings.showingOnline = false; // opens My Library mode
            if (isNewTabEvent(e)) {
                uitools.navigateInNewTab('artist', artist, _this.collection);
            } else {
                navigationHandlers['artist'].navigate(artist, _this.collection);
            }
            //_this.openView(artist, 'artist', e.detail.div); // opens as sub-view to keep the Music context (#13363)
        };
        this.localListen(this.artistsView, 'itemdblclick', navigateArtist);
        this.localListen(this.artistsView, 'itementer', navigateArtist);
        this.localListen(this.artistsView, 'itemview', navigateArtist);
        //this.localListen(this.artistsView, 'itemclick', navigateArtist);
        this.artistsView.controlClass.oneRow = true; // keep always just one row of artists
        this.localListen(this.artistsView, 'datasourcechanged', function () {
            let ds = _this.artistsView.controlClass.dataSource;
            if (!ds) {
                setVisibility(artistHeader, false);
                setVisibility(_this.artistsView, false);
            } else {
                _this.localPromise(ds.whenLoaded()).then(function () {
                    setVisibility(artistHeader, (ds.count > 0));
                    setVisibility(_this.artistsView, (ds.count > 0));
                });
            }
        });

        // Albums > row:
        let albumsHeader = this.qChild('albumsLabel');
        this.localListen(albumsHeader, 'click', function () {
            navigationHandlers['albums'].navigate(_this.collection);
        });
        addEnterAsClick(this, albumsHeader);

        this.albumsView = this.qChild('albumsView');
        this.albumsView.controlClass.isGrouped = false;
        let navigateAlbum = function (e) {
            let album = e.detail.item;
            uitools.globalSettings.showingOnline = false; // opens My Library mode
            if (isNewTabEvent(e)) {
                uitools.navigateInNewTab('album', album, _this.collection);
            } else {
                navigationHandlers['album'].navigate(album, _this.collection);
            }
            //_this.openView(album, 'album', e.detail.div); // opens as sub-view to keep the Music context (#13363)
        };
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
            } else {
                _this.localPromise(ds.whenLoaded()).then(function () {
                    setVisibility(albumsHeader, (ds.count > 0));
                    setVisibility(_this.albumsView, (ds.count > 0));
                });
            }
        });

        // Pinned row:
        pinViews.prepare.call(this);
    }

    _getTopAlbums(view: ViewData) {
        let limit = 15;
        let q =
            'SELECT albums.id, avg(playcounter) as pc, albums.rating as rat, count(*) as cnt, albpopularity(avg(playcounter), albums.rating, count(*), COALESCE(albums.LastTimeShown, 0.0)) as popul, albums.album, COALESCE(albums.LastTimeShown, 0.0) AS LastTimeShown ' +
            'FROM songs, albums ' +
            'WHERE (songs.idalbum = albums.id) AND ' + this.collQry + ' ' +
            'GROUP BY albums.id ' +
            'HAVING count(*)>1 ' +
            'ORDER BY albpopularity(pc, rat, cnt, COALESCE(albums.LastTimeShown, 0.0)) * (random() % 1000) desc ' +
            ' LIMIT ' + limit;
        return view.promise(app.db.getQueryResultAsync(q)).then((resData) => {
            if (resData && (resData.count > 0)) {       
                let now = convertUnixToMSTimestamp(Date.now()); // now datime converted to MS timestamp
                let allList = [];
                while (!resData.eof) {
                    let fields = resData.fields;
                    let albObj = {
                        id: fields.getValue(0),
                        popul: fields.getValue(3),
                        lastShownDays: now - fields.getValue(5),
                        title: fields.getValue(4), // only temporary here, for better debugging                        
                    };
                    allList.push(albObj);       
                    resData.next();
                }
                
                this.albumIds = '';
                allList.forEach((val) => this.albumIds += (this.albumIds == '' ? '' : ', ') + val.id);

                if (this.albumIds !== '') {
                    let ret = app.db.getAlbumList('SELECT * FROM Albums WHERE ID IN (' + this.albumIds + ') ORDER BY COALESCE(LastTimeShown, 0.0)', (this.collection ? this.collection.id : -1));
                    ret.autoUpdateDisabled = true; // this list is random, so do not call auto-update as we do not need to reload on any change
                    return ret;
                }

            }
        });
    }

    _getTopArtists(view: ViewData) {
        let limit = 15;
        let q =
            'SELECT artists.id, avg(playcounter) as pc, avg(rating) as rat, count(*) as cnt, artpopularity(avg(playcounter), avg(rating), count(*), COALESCE(artists.LastTimeShown, 0.0)) as popul, artists.artist, COALESCE(artists.LastTimeShown, 0.0) AS LastTimeShown ' +
            'FROM songs, artistsalbums aa, artists ' +
            'WHERE (songs.idalbum = aa.idalbum) and (aa.idartist = artists.id) and ' + this.collQry + ' ' +
            'GROUP BY artists.id ' +
            'ORDER BY artpopularity(pc, rat, cnt, COALESCE(artists.LastTimeShown, 0.0)) * (random() % 1000) desc ' +
            'LIMIT ' + limit;
        return view.promise(app.db.getQueryResultAsync(q)).then((resData) => {
            if (resData && (resData.count > 0)) {             
                let now = convertUnixToMSTimestamp(Date.now()); // now datime converted to MS timestamp
                let allList = [];
                while (!resData.eof) {
                    let fields = resData.fields;
                    let albObj = {
                        id: fields.getValue(0),
                        popul: fields.getValue(3),
                        lastShownDays: now - fields.getValue(5),
                        title: fields.getValue(4), // only temporary here, for better debugging                        
                    };
                    allList.push(albObj);                
                    resData.next();
                }
                
                this.artistIds = '';
                allList.forEach((val) => this.artistIds += (this.artistIds == '' ? '' : ', ') + val.id);

                if (this.artistIds !== '') {
                    let ret = app.db.getArtistList('SELECT Artists.* FROM Artists WHERE ID IN (' + this.artistIds + ') ORDER BY COALESCE(LastTimeShown, 0.0)', (this.collection ? this.collection.id : -1));
                    ret.autoUpdateDisabled = true; // this list is random, so do not call auto-update as we do not need to reload on any change
                    return ret;
                }
            }
        });
    }

    refresh() {
        let viewData = this.viewData;
        viewData.promise(this.collection.getCollectionQueryAsync()).then((sql) => {

            this.collQry = sql;

            viewData.dataSourceCache[this.constructor.name] = viewData.dataSourceCache[this.constructor.name] || {};
            let dsCache = viewData.dataSourceCache[this.constructor.name];

            if (dsCache.artists && dsCache.albums) {
                this.artistsView.controlClass.dataSource = dsCache.artists;
                this.albumsView.controlClass.dataSource = dsCache.albums;
            } else {
                this._getTopArtists(viewData).then((artlist) => {
                    if (artlist) {
                        viewData.promise(artlist.whenLoaded()).then(() => {
                            dsCache.artists = artlist;
                            // loaded, update lastTimeShown
                            // currently for all given artists, should only for really visible
                            if (this.artistIds) {
                                app.db.executeQueryAsync('UPDATE Artists SET LastTimeShown=' + convertUnixToMSTimestamp(Date.now()) + ' WHERE ID IN (' + this.artistIds + ')');
                            }
                        });
                        this.artistsView.controlClass.dataSource = artlist;
                    }
                    this._getTopAlbums(viewData).then((alblist) => {
                        if (!alblist || (this.viewData !== viewData))
                            return;
                        viewData.promise(alblist.whenLoaded()).then(() => {
                            if (this.viewData !== viewData)
                                return;
                            dsCache.albums = alblist;
                            // loaded, update lastTimeShown
                            // currently for all given albums, should only for really visible
                            if (this.albumIds) {
                                app.db.executeQueryAsync('UPDATE Albums SET LastTimeShown=' + convertUnixToMSTimestamp(Date.now()) + ' WHERE ID IN (' + this.albumIds + ')');
                            }
                        });
                        this.albumsView.controlClass.dataSource = alblist;
                    });
                });
            }
        });
    }

    collectionCleanup() {
        this.artistsView.controlClass.dataSource = null;
        this.albumsView.controlClass.dataSource = null;
    }

    cleanUp() {
        super.cleanUp();
        this.artistsView = undefined;
        this.albumsView = undefined;
    }
}
registerClass(MusicCollectionView);
