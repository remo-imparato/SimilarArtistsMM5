registerFileImport('controls/homeView');

'use strict';

/**
@module UI
*/

import BaseCollectionView from './baseCollectionView';

/**
UI HomeView element

@class HomeView
@constructor
@extends BaseCollectionView
*/

class HomeView extends BaseCollectionView {
    artistsView: any;
    albumsView: any;
    nodesGridView: any;
    artistIds: any;
    albumIds: any;

    initialize(elem, params) {
        super.initialize(elem, params);

        let _this = this;

        this.container.innerHTML = loadFile('file:///controls/homeView.html');
        initializeControls(this.container);

        // Artists > row:
        let artistHeader = this.qChild('artistsLabel');
        this.localListen(artistHeader, 'click', function (e) {
            _this.openView(app.collections.getEntireLibrary(), 'artists', artistHeader, isNewTabEvent(e));
            //navigationHandlers['artists'].navigate(app.collections.getEntireLibrary());
        });
        addEnterAsClick(this, artistHeader);

        this.artistsView = this.qChild('artistsView');
        this.artistsView.controlClass.isGrouped = false;
        let navigateArtist = function (e) {
            let artist = e.detail.item;
            uitools.globalSettings.showingOnline = false; // opens My Library mode
            //navigationHandlers['artist'].navigate(artist, app.collections.getEntireLibrary());
            _this.openView(artist, 'artist', e.detail.div, isNewTabEvent(e)); // opens as sub-view to keep the current context
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
        this.localListen(albumsHeader, 'click', function (e) {
            _this.openView(app.collections.getEntireLibrary(), 'albums', albumsHeader, isNewTabEvent(e));
            //navigationHandlers['albums'].navigate(app.collections.getEntireLibrary());
        });
        addEnterAsClick(this, albumsHeader);

        this.albumsView = this.qChild('albumsView');
        this.albumsView.controlClass.isGrouped = false;
        let navigateAlbum = function (e) {
            let album = e.detail.item;
            uitools.globalSettings.showingOnline = false; // opens My Library mode
            //navigationHandlers['album'].navigate(album, app.collections.getEntireLibrary());
            _this.openView(album, 'album', e.detail.div, isNewTabEvent(e)); // opens as sub-view to keep the current context 
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

        this.nodesGridView = this.qChild('nodesGridView');
    }

    setFocus() {
        uitools.focusFirstControl(this.container);
    }

    _getTopAlbums(view: ViewData) {
        if (!this.artistIds) {
            return dummyPromise() as Promise<AlbumList>;
        }
        let limit = 15;
        let q =
            'SELECT albums.id, avg(playcounter) as pc, avg(Songs.rating) as rat, count(*) as cnt, albpopularity(avg(playcounter), avg(Songs.rating), count(*), COALESCE(albums.LastTimeShown, 0.0)) as popul, albums.album, COALESCE(albums.LastTimeShown, 0.0) AS LastTimeShown ' +
            'FROM songs, albums ' +
            'WHERE (songs.idalbum = albums.id) AND (songs.TrackType = 0) ' +
            'GROUP BY albums.id ' +
            'HAVING count(*)>1 ' +
            'ORDER BY albpopularity(pc, rat, cnt, COALESCE(albums.LastTimeShown, 0.0)) * (random() % 1000) desc ' +
            'LIMIT ' + limit;
        return view.promise(app.db.getQueryResultAsync(q)).then((resData) => {
            if (resData && (resData.count > 0)) {
                let i = 0;
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
                    i++;
                    resData.next();
                }

                this.albumIds = '';
                allList.forEach((val) => this.albumIds += (this.albumIds == '' ? '' : ', ') + val.id);

                if (this.albumIds !== '') {
                    let ret = app.db.getAlbumList('SELECT * FROM Albums WHERE ID IN (' + this.albumIds + ') ORDER BY COALESCE(LastTimeShown, 0.0)');
                    ret.autoUpdateDisabled = true; // this list is random, so do not call auto-update as we do not need to reload on any change
                    return ret;
                }

            }
        });
    }

    _getTopArtists(view: ViewData) {
        let limit = 15;
        let q =
            'SELECT artists.id, avg(playcounter) as pc, avg(Songs.rating) as rat, count(*) as cnt, artpopularity(avg(playcounter), avg(Songs.rating), count(*), COALESCE(artists.LastTimeShown, 0.0)) as popul, artists.artist, COALESCE(artists.LastTimeShown, 0.0) AS LastTimeShown ' +
            'FROM songs, artistsalbums aa, artists ' +
            'WHERE (songs.TrackType = 0) and (songs.idalbum = aa.idalbum) and (aa.idartist = artists.id) ' +
            'GROUP BY artists.id ' +
            'ORDER BY artpopularity(pc, rat, cnt, COALESCE(artists.LastTimeShown, 0.0)) * (random() % 1000) desc ' +
            'LIMIT ' + limit;
        return view.promise(app.db.getQueryResultAsync(q)).then((resData) => {
            if (resData && (resData.count > 0)) {
                let i = 0;
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
                    i++;
                    resData.next();
                }
                
                this.artistIds = '';
                allList.forEach((val) => this.artistIds += (this.artistIds == '' ? '' : ', ') + val.id);

                if (this.artistIds !== '') {
                    let ret = app.db.getArtistList('SELECT Artists.* FROM Artists WHERE ID IN (' + this.artistIds + ') ORDER BY COALESCE(LastTimeShown, 0.0)');
                    ret.autoUpdateDisabled = true; // this list is random, so do not call auto-update as we do not need to reload on any change
                    return ret;
                }

            }
        });
    }

    storeState() {
        return {};
    }

    restoreState(state) {
        // something to restore here?
    }

    refresh() {
        let viewData = this.viewData;
        
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

        let node = viewData.viewNode.parent ? viewData.viewNode.parent : viewData.viewNode;
        let _refreshChildren = (l) => {
            let list = l.getCopy();
            viewData.promise(list.modifyAsync(() => {
                for (let i = 0; i < list.count; i++) {
                    if (list.getValue(i).handlerID == 'home') {
                        list.delete(i); // remove home icon from navigation
                        break;
                    }
                }
                if (this.nodesGridView && this.nodesGridView.controlClass)
                    this.nodesGridView.controlClass.prepareDatasource(viewData.viewNode, list);
            }));
            list.notifyLoaded();
        };
        viewData.promise(node.children.whenLoaded()).then((l) => {
            _refreshChildren(l);
            viewData.listen(node.children, 'change', () => {
                _refreshChildren(node.children);
            });
        });

        viewHandlers.nodeList.registerActions(this.nodesGridView, viewData);
    }

    collectionCleanup() {
        this.artistsView.controlClass.dataSource = null;
        this.albumsView.controlClass.dataSource = null;
        this.nodesGridView.controlClass.prepareDatasource(null);
    }

    cleanUp() {
        super.cleanUp();
        this.artistsView = undefined;
        this.albumsView = undefined;
        this.nodesGridView = undefined;
    }
}
registerClass(HomeView);
