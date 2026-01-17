/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

'use strict';
registerFileImport('controls/statusbar');
/**
@module UI snippets
*/
import Control from './control';
/**
Statusbar -

@class Statusbar
@constructor
@extends Control
*/
/**
Set listener control (where status messages are listening).

property listener
*/
export default class Statusbar extends Control {
    initialize(elem, params) {
        super.initialize(elem, params);
        this.container.classList.add('statusbar');
        this._statusActive = true;
        this._statusEnabled = true;
        this.listener = document.body;
        if (params && params.listener) {
            let ctrl = this.container;
            while (ctrl) {
                if (ctrl.getAttribute('data-id') === params.listener) {
                    break;
                }
                ctrl = getParent(ctrl);
            }
            if (!ctrl) {
                ctrl = qid(params.listener);
                if (!ctrl) {
                    ctrl = getParent(this.container);
                }
            }
            if (ctrl)
                this.listener = ctrl;
        }
        this.handler = function (e) {
            if (!this.statusEnabled)
                return;
            if (isVisible(e.detail.sender, true) && isVisible(this.container)) {
                if (e.detail.params) {
                    this.statusActive = resolveToValue(e.detail.params.visible, true, e);
                }
                this.statusMessage = statusbarFormatters.getConcatenatedStatus(e, this);
            }
            //e.cancelBubble = true;
            //e.stopPropagation(); // LS: commented out so that also other component like PlaylistHeader can listen to this
        }.bind(this);
        if (this.listener)
            this.localListen(this.listener, 'statusinfochange', this.handler);
    }
    changeVisibility(makeVisible) {
        if (!this.alwaysVisible)
            setVisibility(this.container, makeVisible, {
                animate: this.container.classList.contains('animate'),
                onComplete: function () {
                    notifyLayoutChange();
                }
            });
    }
    set statusMessage(value) {
        this.container.innerHTML = value;
        if (this.statusActive) {
            if (value !== '')
                this.changeVisibility(true);
            else
                this.changeVisibility(false);
        }
    }
    get statusEnabled() {
        return this._statusEnabled;
    }
    set statusEnabled(value) {
        if (this._statusEnabled != value) {
            this._statusEnabled = value;
            this.changeVisibility(false);
        }
    }
    get statusActive() {
        return this._statusActive;
    }
    set statusActive(value) {
        if (this._statusActive != value) {
            this._statusActive = value;
            this.changeVisibility(false); // hide it until we get a message via this.statusMessage (it doesn't look good to show empty status bar)
        }
    }
}
registerClass(Statusbar);
(function () {
    let getTypeText = function (type, cnt) {
        return (type == 'genres' ? _('genre', 'genres', cnt) : (type == 'artists' || type == 'albumartists' ? _('artist', 'artists', cnt) : _('album', 'albums', cnt)));
    };
    window.statusbarFormatters = {
        formatSimpleTotal: function (data, val1, val2) {
            return data.totalCount + ' ' + (_(val1, val2, data.totalCount)) + ', ' +
                getFormatedTime(data.totalLength, {
                    useEmptyHours: false
                });
        },
        formatTracklistStatus: function (data, ignoreSelected) {
            let totalResult = data.totalCount + ' ' + (_('file', 'files', data.totalCount)) + ', ' +
                formatFileSize(data.totalSize) + ', ' + getFormatedTime(data.totalLength, {
                useEmptyHours: false
            });
            let selectedResult = '';
            if (data.selectedCount && !ignoreSelected) {
                selectedResult = ' <span class="selectedPart">(' + _('Selected') + ': ' +
                    data.selectedCount + ' ' + (_('file', 'files', data.selectedCount)) + ', ' +
                    formatFileSize(data.selectedSize) + ', ' +
                    getFormatedTime(data.selectedLength, {
                        useEmptyHours: false
                    }) + ')</span>';
            }
            return totalResult + selectedResult;
        },
        formatPlayinglistStatus: function (e) {
            let info;
            if ((e) && (e.totalCount > 0)) {
                let pos = app.player.playlistPos + 1;
                if (pos <= 0)
                    pos = 1;
                info = '<span data-id="playingOrderStatus">';
                if (app.player.autoDJ.enabled) {
                    info = info + _('Playing') + ' ' + pos + '/' + e.totalCount + ' (' + _('Auto-DJ') + ')';
                }
                else {
                    info = info + _('Playing') + ' ' + pos + '/' + e.totalCount + ' (' + getFormatedTime(e.totalLength, {
                        useEmptyHours: false
                    }) + ')';
                }
                info = info + '</span>';
                if (e.selectedCount) {
                    info = info + ' <span class="selectedPart" data-id="playingSelStatus">(' + _('Selected') + ': ' +
                        e.selectedCount + ' ' + (_('file', 'files', e.selectedCount)) + ', ' +
                        formatFileSize(e.selectedSize) + ', ' +
                        getFormatedTime(e.selectedLength, {
                            useEmptyHours: false
                        }) + ')</span>';
                }
            }
            else {
                if (app.player.autoDJ.enabled) {
                    info = _('\'Playing\' list') + ' (' + _('Auto-DJ') + ')';
                }
                else {
                    info = _('\'Playing\' list');
                }
            }
            return info;
        },
        formatAlbumListStatus: function (data, type, ignoreSelected) {
            let itemName = getTypeText(type, data.totalCount);
            let totalResult;
            if (data.selectedCount > 1) // #16360
                totalResult = sprintf(_('Selected %d of %d'), data.selectedCount, data.totalCount) + ' ' + itemName;
            else
                totalResult = data.totalCount + ' ' + itemName;
            if (data.selectedCount && data.selectedTracksCount && !ignoreSelected) {
                itemName = _('file', 'files', data.totalCount);
                totalResult = totalResult + ' <span class="selectedPart">(' + _('Selected') + ': ' +
                    data.selectedTracksCount + ' ' + itemName + ', ' + formatFileSize(data.selectedSize) + ', ' +
                    getFormatedTime(data.selectedLength, {
                        useEmptyHours: false
                    }) + ')</span>';
            }
            return totalResult;
        },
        formatDefaultSimpleStatus: function (data, textCountCallback, ignoreSelected) {
            // Selected %d of %d artists
            let ret;
            if (data.selectedCount > 1) // #16360
                ret = sprintf(_('Selected %d of %d'), data.selectedCount, data.totalCount) + ' ' + textCountCallback(data.totalCount);
            else
                ret = data.totalCount + ' ' + textCountCallback(data.totalCount);
            return ret;
        },
        getConcatenatedStatus: function (e, statusBar) {
            let res = '';
            if ((e.detail.message !== undefined) && e.detail.sender && e.detail.sender.controlClass && e.detail.sender.controlClass.parentView) {
                let view = e.detail.sender.controlClass.parentView;
                if (view == statusBar.parentView) {
                    if (!statusBar._messageStack || (view && statusBar.lastViewId != view.currentViewId) || (view && statusBar.lastViewNodePath != view.nodePath)) {
                        statusBar._messageStack = {};
                        statusBar.lastViewNodePath = view.nodePath;
                        statusBar.lastViewId = view.currentViewId;
                    }
                    if (e.detail.data && e.detail.data.totalCount == 0)
                        statusBar._messageStack[e.detail.sender.controlClass.uniqueID] = ''; // to not show 'Selected 0 of 0 playlists'
                    else
                        statusBar._messageStack[e.detail.sender.controlClass.uniqueID] = e.detail.message;
                    statusBar._sendersStack = statusBar._sendersStack || {};
                    statusBar._sendersStack[e.detail.sender.controlClass.uniqueID] = e.detail.sender;
                }
                // concatenate the stack
                for (let key in statusBar._messageStack) {
                    let sender = statusBar._sendersStack[key];
                    if (sender) {
                        if (!getDocumentBody().contains(sender) || !isVisible(sender, true)) {
                            statusBar._messageStack[key] = undefined;
                            statusBar._sendersStack[key] = undefined;
                        }
                    }
                    let iMsg = statusBar._messageStack[key];
                    if (iMsg && iMsg != '') {
                        if (res)
                            res = res + '&nbsp;&nbsp;|&nbsp;&nbsp;';
                        res = res + iMsg;
                    }
                }
            }
            else {
                if (e.detail.message)
                    res = e.detail.message;
            }
            return res;
        }
    };
})();
