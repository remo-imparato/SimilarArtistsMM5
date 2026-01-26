'use strict';

registerFileImport('controls/episodeListView');


/**
@module UI
*/

import ListView from './listview';
requirejs('templates');
import './trackListView';

/**
UI Podcast episode list element

@class EpisodeListView
@constructor
@extends ListView
*/

export default class EpisodeListView extends ListView {    
    checkRefresh: any;
    onDownloadFinished: (DownloadItem: any, ResponseCode: any) => void;
    private _onIconCloseClick: (e: any) => void;
    private _onIconDeleteClick: (e: any) => void;
    private _onIconDownloadClick: (e: any) => void;
    private _onIconPlayClick: (e: any) => void;

    initialize(rootelem, params) {
        super.initialize(rootelem, params);

        this.itemCloningAllowed = false; // with cloning the progress bar is shown twice on each row (because controlClass is not cloned and thus ProgressBar is initialized again)
        this.isSearchable = true; // #18124

        this.enableDragNDrop();
        this.hasMediaContent = true;

        let episodelist = this.container;
        app.listen(episodelist, 'focuschange', function () {
            (episodelist.controlClass as ListView).raiseItemFocusChange();
        });

        this.contextMenu = menus.createTracklistMenu(this.container);

        let downloader = app.downloader;
        let doLastRefresh = false;
        this.checkRefresh = function () {
            this.requestTimeout(function () {
                if (downloader.anyDownloadInProgress()) {
                    this.rebind(); // to update the progress bars of individual items
                    doLastRefresh = true;
                } else {
                    if (doLastRefresh) {
                        this.rebind();
                        doLastRefresh = false;
                    }
                }
                this.checkRefresh();
            }.bind(this), 1000);
        }.bind(this);
        this.checkRefresh();

        this.onDownloadFinished = (DownloadItem, ResponseCode) => {
            if (ResponseCode == 200 && isVisible(this.container)) {
                // update the download status and path
                actions.view.refresh.execute();
            }
        };
        this.localListen(downloader, 'DownloadFinished', this.onDownloadFinished);
    }

    bindData(div, index, item) {
        div.classList.toggle('itemNowPlaying', item.isPlaying);
        if (this.bindFn)
            this.bindFn(div, item);
    }

    setUpDiv(div) {
        if (!div.cloned) {
            div.classList.add('episodeRow');
            div.innerHTML = '<div class="verticalCenter paddingColumnSmall">' +
                '  <div class="flex row">' +
                '    <div data-id="iconClose" class="iconHoverable" data-icon="close"></div>' +
                '    <div data-id="iconPlay" class="iconHoverable" data-icon="play"></div>' +
                '    <div data-id="iconDelete" class="iconHoverable" data-icon="delete"></div>' +
                '    <div data-id="iconDownload" class="iconHoverable" data-icon="download"></div>' +
                '    <div class="vSeparatorTiny"></div>' +
                '    <div data-id="titleDate" data-bind="func: templates.episodeTitleDateFunc(div, item, el);" class="flex fill column"></div>' +
                '    <div data-bind="func: templates.bookmarkFunc(div, item, el);" class="flex column textRight"></div>' +
                '  </div>' +
                '  <div data-id="lineDesc" data-bind="func: templates.episodeCommentFunc(div, item, el);" class="textOther textEllipsis"></div>' +
                '  <div data-bind="func: templates.podcastDownloadFunc(div, item, el);" data-control-class="ProgressBar" data-init-params="{transition: true}"></div>' +
                '</div>';
        }
        initializeControls(div);

        div.unlisteners = div.unlisteners || [];

        let _this = this;

        div.secondLine = qe(div, '[data-id=lineDesc]');
        templates.addEllipsisTooltip(div.secondLine, div);

        div.iconClose = qe(div, '[data-id=iconClose]');
        _this._onIconCloseClick = function (e) {
            if (div.itemIndex === undefined)
                return;
            let itm = _this.getItem(div.itemIndex);
            let di = app.downloader.getDownloadItem(itm.path);
            app.downloader.cancelDownload(di);
        };
        let listenerC = app.listen(div.iconClose, 'click', _this._onIconCloseClick);
        div.unlisteners.push(function () {
            app.unlisten(div.iconClose, 'click', listenerC);
        });

        div.iconDelete = qe(div, '[data-id=iconDelete]');
        _this._onIconDeleteClick = function (e) {
            if (div.itemIndex === undefined)
                return;
            let itm = _this.getItem(div.itemIndex);
            app.trackOperation.deleteFile(itm);
        };
        let listenerD = app.listen(div.iconDelete, 'click', _this._onIconDeleteClick);
        div.unlisteners.push(function () {
            app.unlisten(div.iconDelete, 'click', listenerD);
        });

        div.iconDownload = qe(div, '[data-id=iconDownload]');
        _this._onIconDownloadClick = function (e) {
            if (div.itemIndex === undefined)
                return;
            let itm = _this.getItem(div.itemIndex);
            app.trackOperation.downloadFile(itm);
        };
        let listenerDL = app.listen(div.iconDownload, 'click', _this._onIconDownloadClick);
        div.unlisteners.push(function () {
            app.unlisten(div.iconDownload, 'click', listenerDL);
        });

        div.iconPlay = qe(div, '[data-id=iconPlay]');
        _this._onIconPlayClick = function (e) {
            if (div.itemIndex === undefined)
                return;
            let itm = _this.getItem(div.itemIndex);
            app.player.addTracksAsync(itm, {
                withClear: true,
                startPlayback: true
            });
        };

        let listenerP = app.listen(div.iconPlay, 'click', _this._onIconPlayClick);
        div.unlisteners.push(function () {
            app.unlisten(div.iconPlay, 'click', listenerP);
        });
    }

    cleanUp() {
        app.unlisten(this.container);        
        this.checkRefresh = function () {};
        super.cleanUp();
    }

}
registerClass(EpisodeListView);
