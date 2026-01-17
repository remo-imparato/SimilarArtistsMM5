/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

/**
@module UI Snippets
*/
import ListView from './listview';
import MenuButton from './menuButton';
/**
'Playing' list.

@class NowplayingListView
@constructor
@extends ListView
*/
class NowplayingListView extends ListView {
    initialize(rootelem, params) {
        this.standalone = !params || (params.standalone === undefined) || params.standalone;
        this._displayMode = 'oneRow';
        super.initialize(rootelem, params);
        let _this = this;
        this.helpContext = 'Now Playing';
        this.player = app.player;
        this.showHeader = true;
        this._fastSD = undefined;
        this.enableDragNDrop();
        this.forbiddenWhenLoadedCancel = true; // playing list should be always loaded without canceling, it could be used elsewhere
        this.dataSource = app.player.getSongList();
        this._statusInHeader = false;
        this._autoScrollToCurrentTrack = true;
        this.enableIncrementalSearch = true; // #15182
        this.hasMediaContent = true;
        this._alwaysFollowCurrentTrack = false;
        this.container.classList.add('simpletracklist');
        this.updateListClasses();
        if (app.player.isPlaying) {
            if (app.player.paused)
                this.lastPlaybackState = 'pause';
            else
                this.lastPlaybackState = 'play';
        }
        else
            this.lastPlaybackState = 'stop';
        if (params && (params.statusInHeader !== undefined)) {
            this._statusInHeader = params.statusInHeader;
        }
        if (params && (params.alwaysFollowCurrentTrack !== undefined)) {
            this._alwaysFollowCurrentTrack = params.alwaysFollowCurrentTrack;
        }
        let itemAction = function (e) {
            if (e && e.detail && e.detail.div && (e.detail.div.itemIndex !== undefined)) {
                if ((this.player.playlistPos === e.detail.div.itemIndex) && e.detail.div.classList.contains('itemNowPlaying')) { // we have to check nowplaying flag, cause it could be deleted during playing
                    this.player.playAsync();
                    return;
                }
                if (!window.settings.UI.disablePlayerControls.next) {
                    this.localPromise(this.player.setPlaylistPosAsync(e.detail.div.itemIndex)).then(function () {
                        this.player.playAsync();
                    }.bind(this));
                }
            }
        }.bind(this);
        this.localListen(rootelem, 'itemdblclick', itemAction);
        this.localListen(rootelem, 'itementer', itemAction);
        if (params && params.registerDeletion) {
            this.localListen(rootelem, 'keydown', (e) => {
                if (friendlyKeyName(e) == 'Delete') {
                    this.deleteSelected();
                    e.stopPropagation();
                }
            });
        }
        this.localListen(rootelem, 'focuschange', function () {
            rootelem.controlClass.raiseItemFocusChange();
        });
        if (this._statusInHeader) {
            this.localListen(this.dataSource, 'statuschange', (e) => {
                this.statusHandler(e);
            });
            this.localListen(window.settings.observer, 'change', () => {
                this.statusHandler(this._lastStatusInfo);
            });
            this.localListen(app.player, 'playbackState', (state) => {
                this.statusHandler(this._lastStatusInfo);
                if ((state === 'trackChanged') || (state === 'listReordered') || ((this.lastPlaybackState === 'stop') && (state === 'play'))) {
                    // scroll to newly playing track ony if user does not have focus in NP list, otherwise it could make unwanted change
                    if (!document.activeElement || thisWindow.minimized || ((document.activeElement !== this.container) && !this.container.contains(document.activeElement)) || this._alwaysFollowCurrentTrack) {
                        this.scrollToCurrentTrack();
                    }
                }
                switch (state) {
                    case 'unpause':
                        this.lastPlaybackState = 'play';
                        break;
                    case 'play':
                    case 'pause':
                    case 'stop':
                        this.lastPlaybackState = state;
                        break;
                }
            });
            this.headerStatusBar.classList.add('clickable');
            this.localListen(this.headerStatusBar, 'click', function () {
                if (window.mainTabs) {
                    let canNavigate = true;
                    let tabIndex = window.mainTabs.selectedIndex;
                    if (tabIndex < window.mainTabs.length) {
                        let tab = window.mainTabs.items[tabIndex];
                        let tabPanel = tab.getAttribute('tabname');
                        let tabPanelElement = qid(tabPanel);
                        if (tabPanelElement && tabPanelElement.controlClass && tabPanelElement.controlClass.multiviewControl.activeView) {
                            canNavigate = tabPanelElement.controlClass.multiviewControl.activeView.nodehandler != nodeHandlers['npview'];
                        }
                    }
                    if (canNavigate)
                        navigationHandlers.nowPlaying.navigate();
                    else
                        actions.history.backward.execute();
                }
            });
        }
        this.contextMenu = function (evt) {
            return menus.createTracklistMenu(this.container);
        }.bind(this);
        this.addArtworkRules = {
            showApply2Album: true,
            showReplace: true
        };
        if (window.uitools.getCanEdit()) {
            this.addToContextMenu({
                action: {
                    title: actions.coverLookup.title,
                    icon: actions.coverLookup.icon,
                    visible: function () {
                        return new Promise(function (resolve) {
                            if (_this.dataSource) {
                                _this.dataSource.getSelectedList().whenLoaded().then(function (list) {
                                    list.locked(function () {
                                        let track;
                                        let npobj;
                                        let lastAlbum;
                                        let isPlaylist = list.objectType === 'playlistentries';
                                        for (let i = 0; i < list.count; i++) {
                                            if (isPlaylist)
                                                track = list.getFastObject(i, npobj).getFastSD(track);
                                            else
                                                track = list.getFastObject(i, track);
                                            let albumHash = track.album + ' & ' + track.albumArtist;
                                            if (lastAlbum && albumHash !== lastAlbum) {
                                                resolve(false);
                                                return;
                                            }
                                            lastAlbum = albumHash;
                                        }
                                        let tracks = list;
                                        if (isPlaylist) {
                                            tracks = list.getTracklist();
                                            tracks.autoUpdateDisabled = true;
                                        }
                                        tracks.whenLoaded().then(function () {
                                            _this.addArtworkRules.tracks = tracks;
                                            resolve(true);
                                        });
                                    });
                                });
                            }
                            else
                                resolve(false);
                        });
                    },
                    execute: function () {
                        let origItem = _this.addArtworkRules.track || _this.addArtworkRules.tracks;
                        _this.addArtworkRules.tracks = null;
                        if (!origItem)
                            return;
                        searchTools.searchAAImageDlg(origItem, function () {
                            _this.rebind();
                        }.bind(_this), {
                            showApply2Album: _this.addArtworkRules.showApply2Album,
                            showReplace: _this.addArtworkRules.showReplace,
                            noDefaultIcon: (origItem.itemImageType !== 'notsavedimage') && (origItem.itemImageType !== 'icon')
                        });
                    }
                },
                order: 100,
                grouporder: 50, // shoudl be same as auto-tag
            });
        }
        this.localListen(this.container, 'contextmenu', (e) => {
            this.addArtworkRules.track = null;
            this.addArtworkRules.firstTrack = null;
            this.addArtworkRules.album = null;
            this.addArtworkRules.tracks = null;
            if (this.dataSource) {
                let track = this.dataSource.focusedItem;
                if (track) {
                    if (track.objectType === 'playlistentry')
                        track = track.sd;
                    this.addArtworkRules.track = track;
                    this.addArtworkRules.firstTrack = this.addArtworkRules.track;
                }
            }
        }, true);
        if (this.makeInSync) {
            let updateInProgress = 0;
            let scrollTimeout = undefined;
            this.localListen(window, 'scrollSync', function (e) {
                if (e.detail.sender !== _this.container) {
                    let idx = e.detail.index;
                    let setOffset = function () {
                        if (_this.itemHeight > 1) {
                            let ofs = _this.getItemTopOffset(idx);
                            updateInProgress++;
                            _this.setScrollOffset(ofs, true);
                            _this.requestTimeout(function () {
                                updateInProgress--;
                            }, 10);
                        }
                        else
                            _this.requestTimeout(setOffset, 10);
                    };
                    _this.requestTimeout(setOffset, 10);
                }
            });
            this.localListen(this.canvas, 'scroll', function (e) {
                if (updateInProgress == 0) {
                    if (scrollTimeout) {
                        clearTimeout(scrollTimeout);
                    }
                    // no not process every scroll events .. just the last one
                    scrollTimeout = _this.requestTimeout(function () {
                        //var idx = _this.getItemFromRelativePosition(1, _this.itemHeight / 3 /* to eliminate partially visible item */ );
                        let idx = _this.getItemFromAbsolutePosition(1, (_this.itemHeight / 3) + _this.getScrollOffset() /* to eliminate partially visible item */);
                        _this.raiseEvent('scrollSync', {
                            sender: _this.container,
                            index: idx
                        }, true, true, window);
                    }, 10);
                }
            });
        }
    }
    statusHandler(e) {
        this._lastStatusInfo = e;
        let statusHTML = statusbarFormatters.formatPlayinglistStatus(e);
        if (this._lastStatusHTML != statusHTML) {
            this._lastStatusHTML = statusHTML;
            this.headerStatusBar.innerHTML = statusHTML;
            // swap the selected part and order part for X seconds per suggestion in #19285
            clearTimeout(this._selTimeout);
            let selPart = qeid(this.headerStatusBar, 'playingSelStatus');
            if (selPart) {
                if (this._lastStatusText == selPart.innerText) {
                    setVisibilityFast(selPart, false);
                }
                else {
                    this._lastStatusText = selPart.innerText;
                    selPart.innerText = _('Playing') + ' ' + selPart.innerText;
                    let orderPart = qeid(this.headerStatusBar, 'playingOrderStatus');
                    if (orderPart)
                        setVisibilityFast(orderPart, false);
                    this._selTimeout = this.requestTimeout(() => {
                        if (selPart)
                            setVisibilityFast(selPart, false);
                        if (orderPart)
                            setVisibilityFast(orderPart, true);
                    }, 3000, 'playingSelStatus');
                }
            }
        }
    }
    canDeleteSelected() {
        return true; // all tracks are always deletable from Playing (#17445)
    }
    deleteSelected() {
        let list = this.dataSource.getSelectedTracklist();
        if (list) {
            if (this.isFiltered() && this._dataSourceOrig)
                this._dataSourceOrig.copySelectionAsync(list).then(() => {
                    this._dataSourceOrig.deleteSelected();
                    uitools.deleteTracklist(list, false, this.container);
                });
            else
                uitools.deleteTracklist(list, false, this.container);
        }
    }
    setItemFullyVisible(itemIndex) {
        if (this._autoScrollToCurrentTrack)
            super.setItemFullyVisible(itemIndex);
    }
    updateListClasses() {
        this.container.classList.toggle('multirow', (this._displayMode === 'multiRow'));
        this.container.classList.toggle('onerow', (this._displayMode !== 'multiRow'));
        this.container.classList.toggle('fixedcols', (this._displayMode === 'fixedWidthRow'));
    }
    resizeDivs(w, h) {
        let ret = super.resizeDivs(w, h);
        // Find the first div and update based on its content
        for (let i = 0; i < this.divs.length; i++) {
            let div = this.divs[i];
            if (div) {
                if (div.classList.contains('rowHeight2line')) {
                    if (this._displayMode !== 'multiRow') {
                        // was changed to multi-line
                        this._displayMode = 'multiRow';
                        this.updateListClasses();
                    }
                }
                else {
                    if (div.classList.contains('fixedWidthColumns')) {
                        if (this._displayMode !== 'fixedWidthRow') {
                            // was changed to single-line with fixed columns
                            this._displayMode = 'fixedWidthRow';
                            this.updateListClasses();
                        }
                    }
                    else {
                        if (this._displayMode !== 'oneRow') {
                            // was changed to single-line without fixed columns
                            this._displayMode = 'oneRow';
                            this.updateListClasses();
                        }
                    }
                }
                break;
            }
        }
        return ret;
    }
    setUpDiv(div) {
        window.templates.npListItem(div);
    }
    setUpHeader(header) {
        if (this.headerSet)
            return;
        this.headerSet = true;
        if (this.standalone) {
            header.classList.add('flex');
            header.classList.add('row');
            let headerMenuBtn = document.createElement('div');
            headerMenuBtn.className = 'lvHeaderSingleItem';
            headerMenuBtn.controlClass = new MenuButton(headerMenuBtn, {
                menuArray: window.playingListMenuItems
            });
            header.appendChild(headerMenuBtn);
            if (window.settings.UI.hideMenu)
                setVisibility(headerMenuBtn, false);
        }
        // "fake" menu button in flex, so the height is set appropriately (real menu button is positioned absolutely with no impact on automatic header height)
        uitools.insertFakeMenuButton(header, 'lvHeaderSingleItem');
        let headerTitleContainer = document.createElement('div');
        headerTitleContainer.className = 'lvHeaderSingleItem flex fill';
        header.appendChild(headerTitleContainer);
        let headerTitle = document.createElement('div');
        headerTitle.className = 'fill textEllipsis';
        if (app.player.autoDJ.enabled) {
            headerTitle.textContent = _('\'Playing\' list') + ' (' + _('Auto-DJ') + ')';
        }
        else {
            headerTitle.textContent = _('\'Playing\' list');
        }
        headerTitleContainer.appendChild(headerTitle);
        header.setAttribute('data-hideInFullWindowMode', '1');
        this.headerStatusBar = headerTitle;
    }
    bindData(div, index, item) {
        this._fastSD = item.getFastSD(this._fastSD);
        div.classList.toggle('itemInaccessible', !this._fastObject.accessible);
        div.classList.toggle('itemNowPlaying', ((this.player.playlistPos === div.itemIndex) && this.player.isPlayingTrack(this._fastSD)));
        if (!this._fastSD)
            return;
        if (this.bindFn)
            this.bindFn(div, this._fastSD);
    }
    formatStatus(data) {
        return statusbarFormatters.formatTracklistStatus(data);
    }
    getDropMode(e) {
        if (dnd.isSameControl(e))
            return 'move';
        else
            return 'copy';
    }
    canDrop(e) {
        return this.dndEventsRegistered && dnd.isAllowedType(e, 'media');
    }
    drop(e) {
        dnd.listview_player_handleDrop(e, this);
    }
    getDraggedObject(e) {
        let ret = null;
        if (this.dataSource) {
            this.dataSource.locked(function () {
                ret = this.dataSource.getSelectedTracklist();
            }.bind(this));
        }
        return ret;
    }
    restoreState(fromObject) {
        if (fromObject && (fromObject.scrollOffset !== undefined)) {
            fromObject.scrollOffset = undefined; // do not restore to the last scroll position, we prefer scroll to current file, #19088
        }
        super.restoreState(fromObject);
        this.scrollToCurrentTrack();
    }
    scrollToCurrentTrack() {
        if (!this.dataSource || this._waitingForLoad)
            return;
        this._waitingForLoad = true;
        this.localPromise(this.dataSource.whenLoaded()).then(() => {
            this._waitingForLoad = false;
            let idx = app.player.playlistPos;
            if (idx >= 0)
                this.setItemFullyVisibleCentered(idx);
        }, () => {
            this._waitingForLoad = false;
        });
    }
    get multiselect() {
        if (window.settings.UI.canReorder == false)
            return false; // #20883
        else
            return this._multiselect;
    }
}
registerClass(NowplayingListView);
