'use strict';

registerFileImport('controls/relatedGenres');

import ArrayDataSource from '../helpers/arrayDataSource';
import Control from './control';
import ImageGrid from './imageGrid';

/**
@module UI
*/

/**
UI RelatedGenres subview element

@class RelatedGenres
@constructor
@extends Control
*/

export default class RelatedGenres extends Control {
    titleDiv: HTMLHeadingElement;
    relatedgenreslist: HTMLDivElement;
    private _promises: AnyDict;
    relatedGenres: any;
    private _ds: any;
    _dataSourceChangeHandler: any;

    initialize(rootelem, params) {
        super.initialize(rootelem, params);
        this.container.classList.add('noOverflow');
        this.container.classList.add('showIfVisibleChild');
        // add title line
        this.titleDiv = document.createElement('h3');
        this.titleDiv.className = 'inline blockTitleMargin';
        this.titleDiv.textContent = _('Related Genres');
        this.container.appendChild(this.titleDiv);

        // add genres grid
        this.relatedgenreslist = document.createElement('div');
        this.container.appendChild(this.relatedgenreslist);
        this.relatedgenreslist.controlClass = new ImageGrid(this.relatedgenreslist, {
            isHorizontal: false,
            icon: 'genre',
            isGrouped: false,
            dynamicSize: true,
        }); // @ts-ignore
        this.relatedgenreslist.controlClass.oneRow = true;
        this._promises = {};

        let navigateGenre = function (e) {
            let genre = e.detail.item.title;
            if (isNewTabEvent(e)) {
                uitools.navigateInNewTab('genre', genre);
            } else
                navigationHandlers.genre.navigate(genre);
        };

        this.localListen(this.relatedgenreslist, 'itemdblclick', navigateGenre);
        this.localListen(this.relatedgenreslist, 'itementer', navigateGenre);
        this.localListen(this.relatedgenreslist, 'itemview', navigateGenre);
        this.updateVisibility();
        this.helpContext = 'Filelisting';
    }

    updateVisibility() {
        let vis = !!this.relatedGenres && (this.relatedGenres.length > 0);
        setVisibility(this.titleDiv, vis);
        setVisibility(this.relatedgenreslist, vis);
    }

    processOnlineData() {
        let genrelist = [];
        if (this.relatedGenres && this.relatedGenres.length) {
            let relGenre;
            for (let i = 0; i < this.relatedGenres.length; i++) {
                relGenre = this.relatedGenres[i];
                if (relGenre && (relGenre.name !== '')) {
                    genrelist.push(musicBrainz.getGenreClass(this.uniqueID, {
                        name: relGenre.name,
                        url: relGenre.url
                    }));
                }
            }
        }
        this._ds.cache.relatedgenreslist = new ArrayDataSource(genrelist);
        this.relatedgenreslist.controlClass.dataSource = this._ds.cache.relatedgenreslist;
        this.updateVisibility();
    }

    dataSourceChangeHandler(params?) {
        if (params) {
            if (params.eventType === 'clear') {
                this.relatedgenreslist.controlClass.dataSource = null;
                if (this._ds.cache) {
                    this._ds.cache.relatedgenreslist = undefined;
                }
                return;
            }
            if (params.eventType === 'settings') {
                return;
            }

        }

        if (this._ds && this._ds.onlineData && ((this._ds.onlineData['related'] !== this.relatedGenres) || !this.relatedgenreslist.controlClass.dataSource)) {            
            this.relatedGenres = this._ds.onlineData['related'];
            this.relatedgenreslist.controlClass.dataSource = null;
            this.processOnlineData();
        } else if (this._ds && !this._ds.onlineData) {
            this._ds.fetchGenre();
        }
    }

    cleanUp() {
        this.relatedGenres = undefined;
        this.dataSource = undefined; // will clear listener(s) and cancel all
        super.cleanUp();
    }
    
    get dataSource () {
        return this._ds;
    }
    set dataSource (value) {
        if (this._ds && this._dataSourceChangeHandler) {
            app.unlisten(this._ds, 'change', this._dataSourceChangeHandler);
            this._dataSourceChangeHandler = undefined;
            this.relatedgenreslist.controlClass.dataSource = null;
            for (let key in this._promises) {
                cancelPromise(this._promises[key]);
            }
            this._promises = {};
        }
        this._ds = value;
        if (this._ds) {
            this._ds.cache = this._ds.cache || {};
            this.dataSourceChangeHandler();
            this._dataSourceChangeHandler = app.listen(this._ds, 'change', this.dataSourceChangeHandler.bind(this));
        }
    }
    
}
registerClass(RelatedGenres);
