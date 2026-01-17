/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

'use strict';
import Control from './control';
/**
Playlist Editor

@class PlaylistEditor
@constructor
@extends Control
*/
export default class PlaylistEditor extends Control {
    initialize(rootelem, params) {
        super.initialize(rootelem, params);
        this.container.classList.add('listview'); // so that it is rendered as LV (i.e. with border on 'default' skin)
        this.header = document.createElement('div');
        this.header.className = 'flex row lvHeader';
        this.header.style.zIndex = '10'; // to make overflow of title focus visible
        this.title = document.createElement('label');
        this.title.className = 'fill  lvHeaderSingleItem';
        this.title.setAttribute('data-control-class', 'Editable');
        let _this = this;
        this.localListen(this.title, 'input', function (e) {
            if (_this.playlist) {
                let newName = this.textContent;
                if (_this._playlist.name != newName) {
                    // so that it is not called too often when typing
                    _this.requestTimeout(function () {
                        _this._playlist.name = newName;
                        _this._playlist.commitAsync();
                    }, 100, '_playlistTitleTm');
                }
            }
        });
        this.header.appendChild(this.title);
        this.closeBtn = document.createElement('div');
        this.closeBtn.className = 'closeButton hoverHeader animate';
        this.closeBtn.setAttribute('data-icon', 'close');
        this.localListen(this.closeBtn, 'click', function (e) {
            e.stopPropagation();
            this.close();
        }.bind(this));
        this.header.appendChild(this.closeBtn);
        this.legend = document.createElement('p');
        this.legend.classList.add('controlInfo');
        this.legend.innerText = _('Drag and drop or Send tracks to the playlist to populate it.');
        this.legend.setAttribute('data-control-class', 'Control'); // make element as Control class so we can use it as D&D target
        this.tracklist = document.createElement('div');
        this.tracklist.classList.add('fill');
        this.tracklist.classList.add('showInline');
        this.tracklist.setAttribute('data-control-class', 'SimpleTracklist');
        this.container.appendChild(this.header);
        this.container.appendChild(this.legend);
        this.container.appendChild(this.tracklist);
        initializeControl(this.tracklist);
        this.tracklist.controlClass.showHeader = false;
        this.tracklist.controlClass.enableDragNDrop();
        this.localListen(this.tracklist, 'itemdblclick', uitools.defaultItemAction);
        this.localListen(this.tracklist, 'itementer', uitools.defaultItemAction);
        //@ts-ignore
        this.tracklist.controlClass.deleteInfo = function () {
            return {
                confType: 'playlist',
                playlist: this.playlist
            };
        }.bind(this);
        //@ts-ignore
        this.tracklist.controlClass.getDefaultSortString = function () {
            return 'order ASC';
        };
        // D&D
        this.tracklist.controlClass.getDropMode = function (e) {
            if (dnd.isSameControl(e)) {
                return 'move';
            }
            else {
                // check source is playlist or not ... we can move from playlists only
                return e.shiftKey ? 'move' : 'copy';
            }
        }.bind(this);
        this.tracklist.controlClass.canDrop = function (e) {
            return dnd.isAllowedType(e, 'media');
        }.bind(this);
        this.tracklist.controlClass.drop = function (e) {
            let isCopy = dnd.getDropMode(e) == 'copy';
            if (dnd.isSameControl(e)) {
                if (!isCopy) {
                    let pos = this.tracklist.controlClass.getDropIndex(e);
                    let ds = this.tracklist.controlClass.dataSource;
                    ds.autoSort = false;
                    ds.moveSelectionTo(pos);
                    this._isSelfEditing = true;
                    this.playlist.reorderAsync(ds).then(() => {
                        this._isSelfEditing = false;
                    });
                }
            }
            else {
                let srcControl;
                if (e && e.dataTransfer)
                    srcControl = e.dataTransfer.getSourceControl(e);
                this.tracklist.controlClass.localPromise(dnd.getTracklistAsync(dnd.getDragObject(e))).then(function (items) {
                    let _items = items.getCopy();
                    let processDrop = () => {
                        let pos = this.tracklist.controlClass.getDropIndex(e);
                        let handleTracks = (tracks) => {
                            if (!this.tracklist.controlClass.dataSource) {
                                this.tracklist.controlClass.dataSource = tracks;
                                window.uitools.refreshView(100); // refresh the view (just in case of another source playlist instance)
                            }
                        };
                        if (pos > 0) {
                            this.localPromise(this.playlist.insertTracksAsync(pos, _items)).then(function (tracks) {
                                handleTracks(tracks);
                            });
                        }
                        else {
                            this.localPromise(this.playlist.addTracksAsync(_items)).then(function (tracks) {
                                handleTracks(tracks);
                            });
                        }
                    };
                    if (!isCopy) { // we need to handle move before we actually process drop because of IdPlaylistSong change
                        if (srcControl) {
                            // case Drag & Drop + Shift for move
                            this.localPromise(dnd.handleMoveToPlaylist(srcControl, items)).then(() => {
                                processDrop();
                            });
                        }
                        else {
                            processDrop();
                            // case paste clipboard: Cutting is handled via window.uitools.pasteClipboard -> obj.doCut
                        }
                    }
                    else
                        processDrop();
                }.bind(this));
            }
            this.tracklist.controlClass.cancelDrop();
        }.bind(this);
        initializeControls(this.container); // initialize all the subcontrols
        dnd.redirectDnDHandling(this.legend, this.tracklist);
        this.onPlaylistChange = function () {
            if (this._isSelfEditing)
                return;
            if (this.playlist && this.playlist.deleted)
                this.close(); // Close this component in case our playlist was deleted
            else {
                let savedScroll = this.tracklist.controlClass.saveRealScroll();
                let ds = this.playlist.getTracklist();
                this.tracklist.controlClass.dataSource = ds;
                this.localPromise(ds.whenLoaded()).then(function () {
                    setVisibility(this.legend, ds.count == 0);
                    if (ds.count && savedScroll) {
                        this.tracklist.controlClass.restoreRealScroll(savedScroll);
                    }
                }.bind(this));
            }
            this.updateData();
        }.bind(this);
    }
    cleanUp() {
        this.playlist = undefined; // to clean up events        
        super.cleanUp();
    }
    checkPlaylistRemoval() {
        // LS: the following subsequently reverted per #16261
        //if (this._playlist && this._playlist.isNew)
        //    this._playlist.deleteAsync(); // remove newly created playlist when there wasn't any edit change (item 2a in #13530)
    }
    close() {
        this.checkPlaylistRemoval();
        deferredNotifyLayoutChangeDown(this.container.parentElement); // #17500
        removeElement(this.container, true);
    }
    startEditTitle() {
        this.title.controlClass.contenteditable = true;
        this.title.focus();
        window.uitools.selectAllText(this.title);
    }
    updateData() {
        if (this.playlist)
            this.title.controlClass.text = this.playlist.name;
    }
    get playlist() {
        return this._playlist;
    }
    set playlist(value) {
        if (this._playlist) {
            app.unlisten(this._playlist, 'change', this.onPlaylistChange);
            this.checkPlaylistRemoval();
            this._playlist = undefined;
        }
        if (value) {
            this._playlist = value;
            app.listen(this._playlist, 'change', this.onPlaylistChange);
            this.updateData();
            this.tracklist.controlClass.dataSource = this._playlist.getTracklist();
            if (this._playlist.isNew)
                this.startEditTitle();
            setVisibility(this.legend, this._playlist.isNew);
        }
    }
}
registerClass(PlaylistEditor);
