'use strict';

registerFileImport('controls/relatedArtists');

import ArtistGrid from './artistGrid';
import Control from './control';

/**
@module UI
*/

const minRelatedArtistsCount = 10; // minimal count of related artists, if found
const maxRelatedArtistsCount = 25; // maximal count of related artists, if found. Used only for "My Music" mode
const minRelatedArtistsWeight = 0.7; // minimal affinity weight, it is applied only for related artists > minRelatedArtistsCount. Used only for "Online" mode

/**
UI RelatedArtists subview element

@class RelatedArtists
@constructor
@extends Control
*/

export default class RelatedArtists extends Control {
    titleDiv: HTMLHeadingElement;
    relatedArtists: HTMLDivElement;
    private _promises: AnyDict;
    showingOnline: boolean;
    private _ds: any;
    onlineRA: any;
    private _relatedArtistsCancelToken: AsyncLoopToken;
    _dataSourceChangeHandler: any;

    initialize(rootelem, params) {
        super.initialize(rootelem, params);
        this.container.classList.add('noOverflow');
        this.container.classList.add('showIfVisibleChild');
        // add title line
        this.titleDiv = document.createElement('h3');
        this.titleDiv.className = 'inline blockTitleMargin';
        this.titleDiv.textContent = _('Related Artists');
        this.container.appendChild(this.titleDiv);

        // add artists grid
        this.relatedArtists = document.createElement('div');
        this.container.appendChild(this.relatedArtists);
        this.relatedArtists.controlClass = new ArtistGrid(this.relatedArtists, {
            showHeader: false,
            showInline: true,
            isHorizontal: false,
            isGrouped: false,
            noItemButtons: true,
            dynamicSize: true
        });
        this._promises = {};

        let navigateArtist = function (e) {
            if (this.showingOnline) {
                if (e && e.detail && e.detail.item && e.detail.item.name) {
                    if (isNewTabEvent(e)) {
                        uitools.navigateInNewTab('artist', e.detail.item.name, undefined, e.detail.item.mbgid);
                    } else
                        navigationHandlers.artist.navigate(e.detail.item.name, undefined, e.detail.item.mbgid);
                }
            } else {
                if (e && e.detail && e.detail.item) {
                    if (isNewTabEvent(e)) {
                        uitools.navigateInNewTab('artist', e.detail.item);
                    } else
                        navigationHandlers.artist.navigate(e.detail.item);
                }
            }
        }.bind(this);

        this.localListen(this.relatedArtists, 'itemdblclick', navigateArtist);
        this.localListen(this.relatedArtists, 'itementer', navigateArtist);
        this.localListen(this.relatedArtists, 'itemview', navigateArtist);
        this.showingOnline = uitools.globalSettings ? !!uitools.globalSettings.showingOnline : false;
        this.helpContext = 'Filelisting';
        this.updateVisibility();
    }

    updateVisibility() {
        let vis = this.relatedArtists.controlClass && this.relatedArtists.controlClass.dataSource && (this.relatedArtists.controlClass.dataSource.count > 0);
        setVisibility(this.titleDiv, vis);
        setVisibility(this.relatedArtists, vis);
    }

    fillExistingRelatedArtists() {
        let _this = this;
        if (!_this._ds.onlineData)
            return;
        let relatedA = _this.onlineRA;
        if (relatedA && (relatedA.length > 0)) {
            let ralist = [];

            // get local artist to "My Music" related artists list
            let testA = [];
            let maxRA = Math.min(maxRelatedArtistsCount, relatedA.length);
            for (let i = 0; i < maxRA; i++) {
                if (i < maxRA) {
                    testA.push({
                        name: relatedA[i].name,
                        mbgid: relatedA[i].id
                    });
                }
            }
            let ds = app.db.getExistingArtistList(testA);

            _this.localPromise(ds.whenLoaded()).then(function () {
                if (!_this._ds)
                    return;
                _this.relatedArtists.controlClass.dataSource = ds;
                _this._ds.cache.relatedArtists = ds;
                _this.updateVisibility();
            });
        }
    }

    processOnlineData() {
        // process related artists
        if (!this.showingOnline) {
            this.fillExistingRelatedArtists();
            return;
        }
        let _this = this;
        let relatedA = this.onlineRA;
        if (relatedA && (relatedA.length > 0)) {
            let ralist = [];
            _this._relatedArtistsCancelToken = {
                cancel: false
            } as AsyncLoopToken;

            asyncLoop(function (j) {
                let ritem = relatedA[j];
                ritem.mbgid = ritem.id;
                if ((ritem.weight < minRelatedArtistsWeight) && (j > minRelatedArtistsCount))
                    return true;

                if ((ritem.weight >= minRelatedArtistsWeight) || (j <= minRelatedArtistsCount)) {
                    musicBrainz.getArtistClass(_this.uniqueID, ritem);
                    ralist.push(ritem);
                }
                return (j + 1 >= relatedA.length);
            }, 0, _this._relatedArtistsCancelToken,
            function () {
                // finished asyncLoop
                let alds = app.utils.createArtistlist(false); // not loaded flag
                _this._promises.fillRelatedArtists = alds.asyncFill(ralist.length, function (idx, artist) {
                    musicBrainz.fillArtist(_this.uniqueID, artist, ralist[idx]);
                }).then(function () {
                    _this._promises.fillRelatedArtists = undefined;
                    if (_this._ds) {
                        _this._ds.cache.relatedOnlineArtists = alds;
                        if (_this.showingOnline) {
                            _this.relatedArtists.controlClass.dataSource = alds;
                            _this.updateVisibility();
                        }
                    }
                    _this._relatedArtistsCancelToken = undefined;
                });
            }
            );
        }
    }

    updateGrid() {
        if (this.showingOnline) {
            if (this._ds.cache.relatedOnlineArtists) {
                this.relatedArtists.controlClass.dataSource = this._ds.cache.relatedOnlineArtists;
                if (this._ds.onlineData)
                    this.onlineRA = this._ds.onlineData['related-artists'];
            } else if (this._ds.onlineData && this._ds.onlineData['related-artists']) {
                this.processOnlineData();
            }
        } else {
            if (this._ds.cache.relatedArtists) {
                this.relatedArtists.controlClass.dataSource = this._ds.cache.relatedArtists;
                if (this._ds.onlineData)
                    this.onlineRA = this._ds.onlineData['related-artists'];
            } else if (this._ds.onlineData && this._ds.onlineData['related-artists']) {
                this.fillExistingRelatedArtists();
            }
        }
        this.updateVisibility();
    }

    dataSourceChangeHandler(params?) {
        if (params) {
            if (params.eventType === 'clear') {
                this.relatedArtists.controlClass.dataSource = null;
                if (this._ds.cache) {
                    this._ds.cache.relatedOnlineArtists = undefined;
                    this._ds.cache.relatedArtists = undefined;
                }
                return;
            }
            if (params.eventType === 'settings') {
                let showingOnline = uitools.globalSettings ? !!uitools.globalSettings.showingOnline : false;
                if (showingOnline !== this.showingOnline) {
                    this.showingOnline = showingOnline;
                    this.relatedArtists.controlClass.dataSource = null;
                    this.updateGrid();
                }
                return;
            }

        }

        if (this._ds && this._ds.onlineData && ((this._ds.onlineData['related-artists'] !== this.onlineRA) || !this.relatedArtists.controlClass.dataSource)) {
            this.onlineRA = this._ds.onlineData['related-artists'];
            this.relatedArtists.controlClass.dataSource = null;
            this.processOnlineData();
        }
    }

    cleanUp() {
        this.dataSource = undefined; // will clear listener(s) and cancel promises
        this.relatedArtists = undefined;
        this.onlineRA = undefined;
        super.cleanUp();
    }
    
    get dataSource () {
        return this._ds;
    }
    set dataSource (value) {
        if (this._ds && this._dataSourceChangeHandler) {
            app.unlisten(this._ds, 'change', this._dataSourceChangeHandler);
            this._dataSourceChangeHandler = undefined;
            if (this._relatedArtistsCancelToken) {
                this._relatedArtistsCancelToken.cancel = true;
            }
            for (let key in this._promises) {
                cancelPromise(this._promises[key]);
            }
            this._promises = {};
            this.relatedArtists.controlClass.dataSource = null;
        }
        this._ds = value;
        /*
            includes:
            dataObject - object with getThumbAsync function
            onlineData - data read from MusicBrainz
            cache - cached objects, lists
        */
        if (this._ds) {
            this._ds.cache = this._ds.cache || {};
            this.updateGrid();
            this.dataSourceChangeHandler();
            this._dataSourceChangeHandler = app.listen(this._ds, 'change', this.dataSourceChangeHandler.bind(this));
        } else { // @ts-ignore
            if(this.relatedArtists.controlClass.reportStatus)
                this.relatedArtists.controlClass.setStatus('');
        }
    }
    
}
registerClass(RelatedArtists);
