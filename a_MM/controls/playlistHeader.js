/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

/**
@module UI
*/
import Control from './control';
import './artworkRectangle';
/**
Playlist header

@class PlaylistHeader
@constructor
@extends Control
*/
export default class PlaylistHeader extends Control {
    initialize(elem, params) {
        super.initialize(elem, params);
        let _this = this;
        this.container.innerHTML = loadFile('file:///controls/PlaylistHeader.html');
        initializeControls(this.container);
        this.titleEdit = this.qChild('titleEdit');
        this.titleEdit.controlClass.editable = true;
        this.localListen(this.titleEdit, 'change', function () {
            let newName = this.controlClass.text;
            let pllst = _this._playlist; // remember, it could be already cleared/changed after the timeout 
            if (pllst) {
                // so that it is not called too often when typing
                _this.requestTimeout(function () {
                    pllst.name = newName;
                    pllst.commitAsync();
                }, 100, '_playlistTitleTm');
            }
        });
        this._initButtons();
        this.imageSquare = this.qChild('imageSquare');
        this.playlistImage = this.qChild('playlistImage');
        this.searchEditor = this.qChild('searchEditor');
        this.tracksInfo = this.qChild('tracksInfo');
        this.playlistsInfo = this.qChild('playlistsInfo');
        this._createContextMenu();
        dnd.makeImageDroppable(this.imageSquare, function (picturePath) {
            if (picturePath && !_this._cleanUpCalled) {
                _this.localPromise(_this._playlist.saveThumbAsync(picturePath)).then(function () {
                    if (!_this._cleanUpCalled)
                        _this._assignImage();
                });
            }
        });
        this.localListen(qid('contentContainer'), 'statusinfochange', function (e) {
            this.tracksInfo.innerHTML = statusbarFormatters.getConcatenatedStatus(e, this);
        }.bind(this));
        this.localListen(this.container, 'contextmenu', function () {
            window.lastFocusedControl = _this.container;
            window._lastFocusedLVControl = undefined; // so it always take this control for actions
        }, true);
    }
    _initButtons() {
        let player = app.player;
        this.btnPlay = this.qChild('btnPlay');
        this.localListen(this.btnPlay, 'click', function () {
            window.lastFocusedControl = undefined; // reset, so it will use always our tracklist
            uitools.handlePlayAction({
                actionType: 'playNow',
                getTracklist: this.getTracklist.bind(this)
            });
        }.bind(this));
        addEnterAsClick(this, this.btnPlay);
        uitools.addPlayButtonMenu(this.btnPlay);
        this.btnShuffle = this.qChild('btnShuffle');
        this.localListen(this.btnShuffle, 'click', function () {
            window.lastFocusedControl = undefined; // reset, so it will use always our tracklist
            uitools.handlePlayAction({
                actionType: 'playNowShuffled',
                getTracklist: this.getTracklist.bind(this)
            });
        }.bind(this));
        addEnterAsClick(this, this.btnShuffle);
        uitools.addShuffleButtonMenu(this.btnShuffle);
        let _this = this;
        this.btnEditAP = this.qChild('btnEditAP');
        this.localListen(this.btnEditAP, 'click', function () {
            let enableEdit = !this._inEditMode;
            this.setEditMode(enableEdit);
            if (!enableEdit && this._playlist.isNew)
                this._playlist.deleteAsync(); // remove newly created playlist when edit is canceled for newly created playlist without a change (item 3 in #14005)           
        }.bind(this));
        addEnterAsClick(this, this.btnEditAP);
        this.btnCancelEdit = this.qChild('btnCancelEdit');
        this.localListen(this.btnCancelEdit, 'click', function () {
            this.QueryData.loadFromString(this._origQueryData);
            this.setEditMode(false);
        }.bind(this));
        addEnterAsClick(this, this.btnCancelEdit);
        setVisibility(this.btnEditAP, window.uitools.getCanEdit());
        this.btnMenu = this.qChild('btnMenu');
        this.btnMenu.controlClass.menuArray = [];
        this.btnMenu.controlClass.getMenuArray = () => {
            let ar = [{
                    action: {
                        title: _('Rename'),
                        icon: 'edit',
                        execute: function () {
                            _this.startEditTitle();
                        },
                        visible: function () {
                            return !_this._playlist.isAutoPlaylist && window.uitools.getCanEdit();
                        }
                    },
                    order: 10,
                    grouporder: 10,
                }, {
                    action: {
                        title: _('Edit in Playlist Panel'),
                        icon: 'edit',
                        execute: function () {
                            window.uitools.showPlaylistEditor(_this._playlist, false, 'editMenu');
                        },
                        visible: function () {
                            return !_this._playlist.isAutoPlaylist && window.uitools.getCanEdit();
                        }
                    },
                    order: 20,
                    grouporder: 10,
                }, {
                    action: {
                        title: actions.coverLookup.title,
                        icon: actions.coverLookup.icon,
                        execute: function () {
                            searchTools.searchPlaylistImageDlg(_this._playlist, function () {
                                _this._assignImage();
                            });
                        }
                    },
                    order: 30,
                    grouporder: 10,
                }, {
                    action: bindAction(window.actions.playlistRemoveDuplicates, () => {
                        return _this._playlist;
                    }),
                    order: 40,
                    grouporder: 10,
                }, {
                    action: bindAction(window.actions.pin, () => {
                        return _this._playlist;
                    }),
                    order: 50,
                    grouporder: 10,
                }, {
                    action: bindAction(window.actions.unpin, () => {
                        return _this._playlist;
                    }),
                    order: 60,
                    grouporder: 10
                }, {
                    action: {
                        title: function () {
                            return _('Remove');
                        },
                        icon: 'delete',
                        execute: function () {
                            let message = sprintf(_('Are you sure you want to remove playlist "%s" ?'), escapeXml(_this._playlist.name));
                            if (_this._playlist.childrenCount > 0)
                                message = message + '\n\n' + _('This playlist is a parent of other playlists. Deleting it will also remove its children. Are you sure you want to delete it?');
                            messageDlg(message, 'Confirmation', ['btnYes', 'btnNo'], {
                                defaultButton: 'btnYes'
                            }, function (result) {
                                if (result.btnID === 'btnYes') {
                                    _this._playlist.deleteAsync().then(() => {
                                        navUtils.getOutOfActiveView();
                                    });
                                }
                            });
                        }
                    },
                    order: 70,
                    grouporder: 10
                }];
            return ar.concat(this.btnMenu.controlClass.menuArray);
        };
        setVisibility(this.btnMenu, window.uitools.getCanEdit());
    }
    getTracklist() {
        return this.tracklist.getCopy(); // get copy because of #17854
    }
    _createContextMenu() {
        let _this = this;
        if (window.uitools.getCanEdit()) {
            this.imageSquare.controlClass.addToContextMenu([{
                    action: {
                        title: actions.coverLookup.title,
                        icon: actions.coverLookup.icon,
                        execute: function () {
                            searchTools.searchPlaylistImageDlg(_this._playlist, function () {
                                _this._assignImage();
                            });
                        }
                    },
                    order: 10,
                    grouporder: 10,
                }], {
                parent: this.container
            });
        }
    }
    cleanUp() {
        this.dataSource = undefined; // to clean up events       
        this.QueryData = undefined;
        super.cleanUp();
    }
    startEditTitle() {
        this.titleEdit.controlClass.contenteditable = true;
        window.uitools.selectAllText(this.titleEdit);
        this.titleEdit.focus();
    }
    stopEditTitle() {
        if (this.titleEdit === document.activeElement) {
            window.uitools.unselectAllText(this.titleEdit);
            this.titleEdit.blur();
        }
    }
    _assignImage() {
        let pixelSize = parseInt(this.imageSquare.offsetWidth);
        this.imageSquare.controlClass.hideImage();
        let cancelToken = this._playlist.getThumbAsync(pixelSize, pixelSize, function (imageData) {
            if (!this._cleanUpCalled) {
                if (imageData != '')
                    this.imageSquare.controlClass.showImage(imageData);
            }
        }.bind(this));
        this._thumbLoadPromise = {
            cancel: function () {
                app.cancelLoaderToken(cancelToken);
            }
        };
    }
    setShowJustTitle(enable) {
        this._showJustTitle = enable;
        setVisibility(this.imageSquare, !this._showJustTitle);
        setVisibility(this.qChild('infoBox'), !this._showJustTitle);
    }
    _setEditorVisibility(enable) {
        if (!enable) { // #13821 - when hiding editor, we need to save state and hide cbField & cbOperator for future usage
            this.searchEditor.controlClass.closeEditing();
        }
        setVisibility(this.searchEditor, enable, {
            onComplete: notifyLayoutChange // #14559
        });
        if (!enable)
            setVisibility(this.btnCancelEdit, false);
        setVisibility(this.imageSquare, !enable);
        setVisibility(this.btnShuffle, !enable);
        setVisibility(this.btnPlay, !enable);
        setVisibility(this.btnMenu, !enable && window.uitools.getCanEdit());
    }
    setEditMode(enable) {
        if (this._inEditMode == enable)
            return; // #16568 - item 2
        this._inEditMode = enable;
        if (this._playlist)
            this._playlist.inEdit = enable;
        if (enable) {
            this.btnEditAP.controlClass.icon = 'upArrow';
            this.btnEditAP.controlClass.tip = _('Hide editor');
        }
        else {
            this.btnEditAP.controlClass.icon = 'edit';
            this.btnEditAP.controlClass.tip = _('Edit');
        }
        cancelPromise(this.QDPromise);
        cancelPromise(this.tracksPromise);
        if (this.QueryData)
            app.unlisten(this.QueryData, 'change', this.onQueryDataChange);
        if (enable && this._playlist.isAutoPlaylist) {
            this.startEditTitle();
            this.QDPromise = app.db.getQueryData({
                category: 'empty'
            }).then((aQD) => {
                this.QueryData = aQD;
                this.QueryData.loadFromString(this._playlist.queryData);
                this._origQueryData = this.QueryData.saveToString();
                this.searchEditor.controlClass.setQueryData(this.QueryData);
                this._setEditorVisibility(true);
                this.onQueryDataChange = () => {
                    this.requestFrame(() => {
                        if (this._playlist) {
                            let queryData = this.QueryData.saveToString();
                            if (this._playlist.queryData != queryData) {
                                this._playlist.queryData = queryData;
                                setVisibility(this.btnCancelEdit, this._playlist.queryData != this._origQueryData);
                                this._playlist.commitAsync().then(() => {
                                    this._playlist.notifyChanged('tracklist'); // to live update tracks -- is listened e.g. by viewHandlers.tracklistBase.onShow
                                });
                            }
                        }
                    }, 'onQueryDataChange');
                };
                app.listen(this.QueryData, 'change', this.onQueryDataChange);
            });
        }
        else {
            this.stopEditTitle();
            this._setEditorVisibility(false);
        }
    }
    updateTimestamp() {
        if (!this._playlist.isAutoPlaylist) {
            setVisibilityFast(this.playlistsInfo, true);
            this._playlist.getLastModifiedAsync().then((lm) => {
                this.playlistsInfo.textContent = _('Timestamp') + ': ' + app.utils.myFormatDateTime(lm);
            });
        }
        else {
            setVisibilityFast(this.playlistsInfo, false);
        }
    }
    get dataSource() {
        return this._playlist;
    }
    set dataSource(value) {
        if (this._playlist) {
            app.unlisten(this._playlist, 'change', this._playlistChange);
            cancelPromise(this._thumbLoadPromise);
            // LS: the following subsequently reverted per #16261
            //if (this._playlist.isNew)
            //    this._playlist.deleteAsync(); // remove newly created playlist when there was no edit change (item 3a in #13530)
        }
        this.setEditMode(false);
        this._playlist = value;
        if (value) {
            this.titleEdit.controlClass.text = this._playlist.name;
            this.imageSquare.controlClass.icon = value.isAutoPlaylist ? 'autoplaylist' : 'playlist';
            this.updateTimestamp();
            this._playlistChange = function () {
                this.titleEdit.controlClass.text = this._playlist.name;
                this.updateTimestamp();
            }.bind(this);
            app.listen(value, 'change', this._playlistChange);
            this._playlistChange();
            setVisibility(this.btnEditAP, value.isAutoPlaylist && window.uitools.getCanEdit());
            this._assignImage();
            if (this._playlist.isNew || this._playlist.inEdit)
                this.setEditMode(true);
        }
    }
    get tracklist() {
        return this._tracklist;
    }
    set tracklist(value) {
        this._tracklist = value;
    }
}
registerClass(PlaylistHeader);
