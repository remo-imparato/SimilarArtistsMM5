/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

(function () {
    let lastMousePos;
    let createNowPlayingSubmenu = function () {
        let cnt = app.player.entriesCount;
        let ret = [];
        if (cnt) {
            let playlist = app.player.getSongList();
            playlist.locked(function () {
                let fromIndex = Math.max(app.player.playlistPos - 5, 0);
                let toIndex = Math.min(app.player.playlistPos + 5, cnt - 1);
                for (let i = fromIndex; i <= toIndex; i++) {
                    ret.push({
                        _value: i,
                        _sdLink: playlist.getValueLink(i),
                        title: function () {
                            let ret = '';
                            if (this._sdLink) {
                                let track = this._sdLink.get();
                                if (track) {
                                    ret = (this._value + 1) + '. ' + track.summary;
                                    ret += ' <span data-html="1" class="unimportantText">(' + getFormatedTime(track.songLength, {
                                        useEmptyHours: false
                                    }) + ')</span>';
                                    if (app.player.playlistPos === this._value) {
                                        ret = '<span data-html="1" class="itemNowPlaying">' + ret + '</span>';
                                    }
                                }
                            }
                            return ret;
                        },
                        execute: function () {
                            app.player.setPlaylistPosAsync(this._value).then(function () {
                                app.player.playAsync();
                            });
                        }
                    });
                }
            }.bind(this));
        }
        return ret;
    };
    let createVolumeSubmenu = function () {
        let ret = [];
        for (let i = 10; i >= 0; i--) {
            ret.push({
                _value: i,
                title: function () {
                    return (this._value * 10) + '%';
                },
                radiogroup: 1,
                checked: function () {
                    let val = this._value * 10;
                    return parseInt(app.player.volume * 100).between(val - 5, val + 4);
                },
                execute: function () {
                    app.player.volume = this._value / 10.0;
                }
            });
        }
        return ret;
    };
    let showTrayIconMenu = function () {
        if (window._cleanUpCalled)
            return;
        let entriesCount = app.player.entriesCount;
        let items = [
            {
                title: _('Restore'),
                execute: function () {
                    app.switchToMainPlayer();
                },
                order: 10,
                grouporder: 10
            }, {
                action: {
                    title: actions.myRating.title,
                    icon: actions.myRating.icon,
                    visible: actions.myRating.visible,
                    submenu: actions.myRating.submenu,
                    disabled: function () {
                        let track = app.player.getCurrentTrack();
                        return !track || !entriesCount;
                    },
                    getTracklist: function () {
                        let list = app.utils.createTracklist(true);
                        let tr = app.player.getCurrentTrack();
                        if (tr)
                            list.add(tr);
                        return list;
                    },
                },
                order: 20,
                grouporder: 10
            }, {
                title: _('\'Playing\' list'),
                disabled: function () {
                    return !entriesCount;
                },
                submenu: createNowPlayingSubmenu(),
                order: 30,
                grouporder: 10
            }, {
                title: _('Volume'),
                submenu: createVolumeSubmenu(),
                order: 40,
                grouporder: 10
            }, {
                action: actions.previousFile,
                order: 10,
                grouporder: 20
            }, {
                action: actions.play,
                order: 20,
                grouporder: 20
            }, {
                action: actions.pause,
                order: 30,
                grouporder: 20
            }, {
                action: actions.stop,
                order: 40,
                grouporder: 20
            }, {
                action: actions.nextFile,
                order: 50,
                grouporder: 20
            }, {
                action: actions.quit,
                order: 10,
                grouporder: 30
            }
        ];
        let menu = new Menu(items, {
            parent: items[1],
            trayMenu: true
        });
        menu.show(lastMousePos.left, lastMousePos.top, false, true);
    };
    window.localListen(app, 'trayIconEvent', function (eventName, button /* 0 - left, 1 - right, 2 - middle */, x, y) {
        if (eventName === 'click') {
            app.player.playPauseAsync();
        }
        else if (eventName === 'dblclick') {
            let mainWnd = app.dialogs.getMainWindow();
            if ((app.getCurrentPlayer() === 0) && (mainWnd)) {
                let sett = window.settings.get('Appearance');
                if (sett.Appearance.CloseToTray) {
                    if (mainWnd.visible)
                        mainWnd.closeWindow();
                    else
                        app.switchToMainPlayer();
                }
                else {
                    if (mainWnd.minimized)
                        mainWnd.restore();
                    else if (!mainWnd.visible)
                        app.switchToMainPlayer();
                    else
                        mainWnd.minimize();
                }
            }
            else {
                app.switchToMainPlayer();
            }
        }
        else if (eventName === 'mousedown') { //, integer(Button), X, Y);
            lastMousePos = {
                left: x,
                top: y
            };
            if (button === 1 /* right */) {
                showTrayIconMenu();
            }
        }
        else if (eventName === 'mouseup') { //, integer(Button), X, Y);
        }
        else if (eventName === 'mousemove') { //, integer(Button), X, Y);
            lastMousePos = {
                left: x,
                top: y
            };
        } /* else if (eventName === 'mouseenter') {

        } else if (eventName === 'mouseexit') {

        } else if (eventName === 'hintshow') {

        } else if (eventName === 'hinthide') {

        } else if (eventName === 'hinttimeout') {

        } else if (eventName === 'hintclick') {

        }*/
    });
})();
