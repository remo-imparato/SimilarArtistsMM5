/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

/**
@module UI
*/
import GroupedTrackList from '../groupedTracklist';
/**
UI NowPlayingView element

@class NowPlayingTracklist
@constructor
@extends ColumnTrackList
*/
export default class NowPlayingGroupedlist extends GroupedTrackList {
    constructor() {
        super(...arguments);
        this.getDefaultSortString = function () {
            return '';
        };
    }
    initialize(rootelem, params) {
        this.sortStoringDisabled = true;
        super.initialize(rootelem, params);
        let _this = this;
        this.collapseSupport = false; // we show always all tracks in Playing list        
        this.canSaveNewOrder = true;
        this.showHeader = true;
        this.highlightPlayingTrack = false; // we have own handling
        this._autoScrollToCurrentTrack = true;
        this.disabledModeChanges = true; // for list do not allow fullwindow/fullscreen modes
        this.forbiddenWhenLoadedCancel = true; // playing list should be always loaded without canceling, it could be used elsewhere
        this.player = app.player;
        this._lastVisible = this.visible;
        this._prepareSortColumns('playOrder ASC');
        this.refreshDatasource(true, true);
        //this.dataSource = this.player.getSongList();
        if (this.player.isPlaying) {
            if (this.player.paused)
                this.lastPlaybackState = 'pause';
            else
                this.lastPlaybackState = 'play';
        }
        else
            this.lastPlaybackState = 'stop';
        let itemAction = function (e) {
            if (e && e.detail && e.detail.item && e.detail.div) {
                let sd = e.detail.item.sd;
                if (sd) {
                    let idx = sd.playlistSongOrder;
                    e.stopPropagation();
                    if ((this.player.playlistPos === idx) && e.detail.div.classList.contains('itemNowPlaying')) { // we have to check nowplaying flag, cause it could be deleted during playing
                        this.player.playAsync();
                        return;
                    }
                    this.player.setPlaylistPosAsync(idx).then(function () {
                        this.player.playAsync();
                    }.bind(this));
                }
            }
        }.bind(this);
        this.localListen(rootelem, 'itemdblclick', itemAction);
        this.localListen(rootelem, 'itementer', itemAction);
        this.localListen(app.player, 'playbackState', function (state) {
            if (((state === 'trackChanged') || (state === 'listReordered') || ((this.lastPlaybackState === 'stop') && (state === 'play'))) && !this.inEdit) {
                // scroll to newly playing track only if user does not have focus in NP list, otherwise it could make unwanted change
                if (!document.activeElement || thisWindow.minimized || ((document.activeElement !== this.container) && !this.container.contains(document.activeElement))) {
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
                case 'trackChanged':
                    this.rebind();
                    break;
                case 'listReordered':
                    this.refreshDatasource(false, true);
                    break;
            }
        }.bind(this));
        if (!this.disableStatusbar) {
            this.localListen(window.settings.observer, 'change', () => {
                this.setStatus(this._lastStatusInfo);
            });
        }
    }
    isUnsavedSort() {
        let lastSortString = this.getSortingStr();
        return (lastSortString && (lastSortString !== 'playOrder') && (lastSortString !== 'playOrder ASC'));
    }
    async refreshDatasource(dosync, doforce) {
        let lastSortString = this.getSortingStr() || 'playOrder ASC';
        let sl = this.player.getSongList();
        if (!sl)
            return;
        let changed = doforce || (this.dataSource && (this.dataSource.count !== sl.count)) || (this.lastRefreshDatasourceTm > 0);
        let ds;
        this.lastRefreshDatasourceTm = Date.now();
        let ourTime = this.lastRefreshDatasourceTm;
        if (changed) {
            if (!dosync) {
                await sl.whenLoaded();
                if (ourTime !== this.lastRefreshDatasourceTm)
                    return;
            }
            ODS('--- taking copy');
            ds = sl.getCopyPreserveFlags();
            ds.resetSortingInfo();
        }
        else {
            ds = this.dataSource;
            if (ds) {
                ODS('--- only sort reset');
                ds.resetSortingInfo();
            }
        }
        if (lastSortString) {
            if (dosync)
                ds.setAutoSortAsync(lastSortString);
            else
                await ds.setAutoSortAsync(lastSortString);
        }
        if (changed && (ourTime === this.lastRefreshDatasourceTm)) {
            let fstr = '';
            let lastFocus = -1;
            if (this.dataSource) {
                if (this._isFiltered && this.__lastFilterPhrase) {
                    fstr = this.__lastFilterPhrase;
                }
                if (changed) {
                    lastFocus = this.focusedIndex;
                    if (lastFocus >= ds.count)
                        lastFocus = ds.count - 1;
                }
            }
            ODS('--- assign ds');
            this.dataSource = ds;
            if (this._stateToRestore) {
                let st = this._stateToRestore;
                this._stateToRestore = undefined;
                this.restoreState(st);
            }
            if (fstr) {
                this.filterSource(fstr);
            }
            if (changed && (lastFocus >= 0)) {
                this.setFocusedAndSelectedIndex(lastFocus);
            }
            if (!document.activeElement || ((document.activeElement !== this.container) && !this.container.contains(document.activeElement))) {
                this.scrollToCurrentTrack();
            }
        }
        if (ourTime === this.lastRefreshDatasourceTm)
            this.lastRefreshDatasourceTm = 0;
        if (!this._changeRegistered) {
            this._changeRegistered = true;
            let pl = this.player.getSongList();
            this.localListen(pl, 'change', (eventType, itemIndex, obj, flags) => {
                if (flags === 'flagchange')
                    return;
                this.requestTimeout(async () => {
                    await this.refreshDatasource(false, false);
                    //ODS('--- call rebind');
                    this.rebind();
                }, 100, 'refreshDatasource');
            });
        }
    }
    handleItemChange(eventType, itemIndex, obj, flags, flagData, flagValue) {
        super.handleItemChange(eventType, itemIndex, obj, flags, flagData, flagValue);
        if ((this._waitingForLoad) || (flags === 'flagchange'))
            return;
        this.requestTimeout(() => {
            this.groupsRecompute(true);
        }, 50, 'groupsRecompute');
    }
    onShow() {
        this.scrollToCurrentTrack();
    }
    onHide() {
        this._prepareSortColumns('playOrder ASC');
        if (this.dataSource)
            this.dataSource.setAutoSortAsync('playOrder ASC');
    }
    bindData(div, index, item) {
        this._fastSD = item.getFastSD(this._fastSD);
        if (!this._fastSD)
            return;
        div.classList.toggle('itemInaccessible', !this._fastObject.accessible);
        div.classList.toggle('itemNowPlaying', ((this.player.playlistPos === (this._fastSD.playlistSongOrder)) && this.player.isPlayingTrack(this._fastSD)));
        super.bindData(div, index, this._fastSD);
    }
    setItemFullyVisible(itemIndex) {
        if (this._autoScrollToCurrentTrack)
            super.setItemFullyVisible(itemIndex);
    }
    scrollToCurrentTrack() {
        if (!this.dataSource || this._waitingForLoad /* || this.isUnsavedSort()*/)
            return;
        this._waitingForLoad = true;
        this.localPromise(this.dataSource.whenLoaded()).then(() => {
            this._waitingForLoad = false;
            this.groupsRecompute(true);
            let idx = app.player.playlistPos;
            if (this.isUnsavedSort()) {
                idx = this.dataSource.orderFromPlayOrder(idx);
            }
            if (idx >= 0)
                this.setItemFullyVisibleCentered(idx);
        }, () => {
            this._waitingForLoad = false;
        });
    }
    getItemForEdit(index) {
        let item = this.getItem(index);
        if (item)
            return item.sd; // we are editing SD, not PlaylistEntry
    }
    canDeleteSelected() {
        return true; // all tracks are always deletable from Playing (#17445)
    }
    deleteSelected() {
        let list = this.dataSource.getSelectedTracklist();
        if (list) {
            let f = this.dataSource.firstSelected;
            if (f) {
                this.focusedIndex = this.dataSource.indexOf(f); // used for #21266
            }
            if (this.isFiltered() && this._dataSourceOrig)
                this._dataSourceOrig.copySelectionAsync(this.dataSource).then(() => {
                    this._dataSourceOrig.deleteSelected();
                    uitools.deleteTracklist(list);
                });
            else {
                uitools.deleteTracklist(list);
            }
        }
    }
    getDropMode(e) {
        if (dnd.isSameControl(e))
            return 'move';
        else
            return 'copy';
    }
    canDrop(e) {
        // Drag&Drop should not be possible when playing list is dis-ordered to prevent from original order loss
        let canD = this.dataSource && !this.isUnsavedSort();
        return canD && this.dndEventsRegistered && dnd.isAllowedType(e, 'media');
    }
    drop(e) {
        dnd.listview_player_handleDrop(e, this);
        if (!this.isUnsavedSort()) {
            this.requestFrame(function () {
                // sync our list to NP list
                if (this.dataSource) {
                    app.player.assignUpdatedSonglist(this.dataSource);
                }
            }.bind(this));
        }
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
        if (this.dataSource) {
            super.restoreState(fromObject);
            this.scrollToCurrentTrack();
        }
        else if (fromObject) {
            this._stateToRestore = fromObject;
        }
    }
    handle_layoutchange(e) {
        super.handle_layoutchange(e);
        let isVisible = this.visible;
        if (isVisible !== this._lastVisible) {
            this._lastVisible = isVisible;
            if (isVisible)
                this.onShow();
        }
    }
    formatStatus(data) {
        this._lastStatusInfo = data;
        return this.disableStatusbar ? '' : statusbarFormatters.formatPlayinglistStatus(data);
    }
    doRefresh() {
        this.requestFrame(() => {
            this._prepareSortColumns('playOrder ASC');
            this._refreshSortIndicators();
            if (this.dataSource) {
                this._lastSorting = this.dataSource.setAutoSortAsync('playOrder ASC');
                this._lastSorting.then(() => {
                    this._lastSorting = undefined;
                    uitools.cleanUpSaveButton();
                    this.invalidateAll();
                });
            }
        });
    }
}
registerClass(NowPlayingGroupedlist);
