/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

/**
@module UI
*/

requirejs('controls/control');
requirejs('controls/listview');
requirejs('controls/trackListView');
requirejs('controls/nowplayingList');
requirejs('templates');
requirejs('controls/rating');

/**
UI NowPlayingView element

@class NowPlayingView
@constructor
@extends Control
*/

class NowPlayingFullList extends Control {

    initialize(elem, params) {
        super.initialize(elem, params);
        var _this = this;

        this.container.innerHTML = loadFile('file:///controls/nowPlaying/fullList.html');

        this.nowPlayingList = qeid(this.container, 'nowPlayingList');
        this.NPContainer = qeid(this.container, 'NPContainer');
        setVisibilityFast(this.NPContainer, false, {
            animate: false
        });

        this.comingUp = this.qChild('comingUp');
        this.nextTrackSummary = this.qChild('nextTrackSummary');

        var currentTrackPanel = qeid(this.container, 'nowPlayingCurrentTrackPanel');
        this._currentTrackPanel = currentTrackPanel;

        currentTrackPanel.artworkImg = qeid(currentTrackPanel, 'artwork');
        currentTrackPanel.albumLabel = qeid(currentTrackPanel, 'albumLabel');
        currentTrackPanel.artistLabel = qeid(currentTrackPanel, 'artistLabel');
        currentTrackPanel.genreLabel = qeid(currentTrackPanel, 'genreLabel');
        currentTrackPanel.yearLabel = qeid(currentTrackPanel, 'yearLabel');
        currentTrackPanel.lyrics = qeid(currentTrackPanel, 'lyrics');
        currentTrackPanel.itemIndex = 0;
        currentTrackPanel.rating = qeid(currentTrackPanel, 'rating');
        currentTrackPanel.controlClass = currentTrackPanel.controlClass || new Control(currentTrackPanel); // to allow correct cleaning
        currentTrackPanel.controlClass.saveBtn = qeid(currentTrackPanel, 'saveLyricsBtn');
        currentTrackPanel.controlClass.addCleanFunc(function () {
            currentTrackPanel.artworkImg = undefined;
            currentTrackPanel.albumLabel = undefined;
            currentTrackPanel.artistLabel = undefined;
            currentTrackPanel.genreLabel = undefined;
            currentTrackPanel.yearLabel = undefined;
            currentTrackPanel.lyrics = undefined;
            currentTrackPanel.rating = undefined;
        });

        let lastWidth = currentTrackPanel.style.width;
        this.localListen(currentTrackPanel, 'layoutchange', function () {
            if(lastWidth !== currentTrackPanel.style.width) {
                lastWidth = currentTrackPanel.style.width;
                _this.requestTimeout(()=>{_this.updateTrack(true);}, 100, 'updateTrack');
            }
        });

        this.localListen(currentTrackPanel, 'click', function (e) {
            e.stopPropagation(); // Just don't pass clicks through
        });

        this.localListen(currentTrackPanel.rating, 'change', function () {
            var itm = app.player.getCurrentTrack();
            if (itm) {
                if (itm && (itm.objectType === 'track') && (itm.rating != this.controlClass.value)) {
                    itm.rating = this.controlClass.value;
                    itm.commitAsync();
                }
            }
        }.bind(currentTrackPanel.rating));

        this.localListen(currentTrackPanel.albumLabel, 'click', function (e) {
            e.stopPropagation();
            var track = app.player.getCurrentTrack();
            navigationHandlers.album.navigate(track);
        });

        this.localListen(currentTrackPanel.controlClass.saveBtn, 'click', function (evt) {
            if (_this.lastTrack && currentTrackPanel.foundLyrics) {
                var track = _this.lastTrack;
                track.setLyricsAsync(currentTrackPanel.foundLyrics).then(function () {
                    currentTrackPanel.foundLyrics = undefined;
                    track.commitAsync();
                });
            }
            evt.stopPropagation();
        });

        this.localListen(app.player, 'playbackState', function (state) {
            if (state == 'trackChanged') {
                this.unregisterPropertyChange();
                this.registerPropertyChange();
            }
        }.bind(this));

        initializeControls(this.container);
        precompileBinding(currentTrackPanel, this);

        this.nowPlayingList.controlClass._autoScrollToCurrentTrack = false; // do not auto scroll to current playing track (#13826)

        this.registerPropertyChange();
        this.menuItems = this.qChild('ArtistImage').controlClass.menuItems;

        this.menuItems.push({
            title: _('Save image'),
            icon: 'save',
            disabled: function () {
                return !_this.lastTrack;
            },
            visible: function () {
                return !!(currentTrackPanel.saveIcon && currentTrackPanel.showSaveIcon && currentTrackPanel.saveIcon.controlClass.saveImage && currentTrackPanel.saveIcon.controlClass);
            },
            execute: function () {
                currentTrackPanel.saveIcon.controlClass.saveImage();
            },
            order: 50
        });

        this.menuItems.push({
            action: {
                title: _('Save lyrics'),
                icon: 'save',
                disabled: function () {
                    return !_this.lastTrack;
                },
                visible: function () {
                    return _this.lastTrack && currentTrackPanel.foundLyrics;
                },
                execute: function () {
                    var track = _this.lastTrack;
                    track.setLyricsAsync(currentTrackPanel.foundLyrics).then(function () {
                        currentTrackPanel.foundLyrics = undefined;
                        track.commitAsync();
                    });
                }
            }
        });

        this.menuItems.push({
            action: {
                title: _('Show \'Playing\' list'),
                icon: 'listview',
                checked: function () {
                    return !_this.npHidden;
                },
                checkable: true,
                visible: function () {
                    return _this.maximized;
                },
                execute: function () {
                    if (_this.maximized)
                        _this.npHidden = !_this.npHidden;
                }
            }
        });
        this.updateVisibility();
    }

    updateNextTrack() {
        if (this.nextTrackSummary && this.npHidden) {
            var nextTrack = app.player.getNextTrack();
            if (!nextTrack)
                setVisibilityFast(this.comingUp, false);
            else {
                this.nextTrackSummary.innerText = nextTrack.summary;
                setVisibilityFast(this.comingUp, true);
            }
        }
    }

    updateTrack(force) {
        var currentTrackPanel = this._currentTrackPanel;

        var track = app.player.getCurrentTrack();
        setVisibility(currentTrackPanel, !!track);

        var autoSearchLyrics = false;
        var saveLyrics = false;

        var key;
        if (track) {
            if (this._lastPersistentID != track.persistentID) {
                var sett = settings.get('Options');
                autoSearchLyrics = sett.Options.SearchMissingLyrics;
                this.saveLyrics = sett.Options.SaveMissingLyrics;
                saveLyrics = this.saveLyrics;
            } else {
                // don't auto-search again for the same track (when another prop. was changed/updated)
                autoSearchLyrics = false;
            }

            this._lastPersistentID = track.persistentID;
            key = track.title + track.artist + track.album + track.rating + track.date + track.lyricsShort;
        }

        if (this.bindFn && force || (this._lastData != key /* #20164 */)) {
            this._lastData = key;
            this.bindFn(currentTrackPanel, track, {
                autoSearch: autoSearchLyrics,
                saveLyrics: saveLyrics,
                lookupText: _('Click to look up lyrics...'),
                lyricsFooter: '<br><br>&nbsp;',
                onComplete: function (lyrics) {}
            });
        }
        this.updateNextTrack();
    }

    unregisterPropertyChange() {
        if (this.lastTrack) {
            app.unlisten(this.lastTrack, 'change', this.__trackChangeFunc);
        }
    }

    registerPropertyChange() {
        var _this = this;
        this.lastTrack = app.player.getCurrentTrack();
        if (this.lastTrack) {
            this.__trackChangeFunc = app.listen(this.lastTrack, 'change', function () {
                _this.requestFrame(_this.updateTrack.bind(_this), 'updateTrack')
            });
        }
        this.updateTrack();
    }

    storePersistentState() {
        // store all as persistent, we want to share all for all NP views
        return this.storeState();
    }

    restorePersistentState(state) {
        // restore all as persistent, we share all for all NP views
        this.restoreState(state);
    }

    cleanUp() {
        if (this.container._fieldListeners)
            this.container._fieldListeners.forEach(function (func) {
                func();
            });
        this.container._fieldListeners = undefined;
        if (this.lyricsSearchPromise) {
            cancelPromise(this.lyricsSearchPromise);
        };
        if (searchTools.interfaces.aaSearch)
            searchTools.cancelSearch(searchTools.interfaces.aaSearch, this.uniqueID);
        super.cleanUp();
        this.unregisterPropertyChange();
        this.lastTrack = undefined;
    }

    notifyMaximized(toFullScreen) {
        // maximizing, show NP list, if switched on
        this.maximized = true;
        this.updateVisibility();
        return PS_ON_MOUSE_MOVE;
    }

    notifyRestored(toFullScreen) {
        // restoring, hide NP list
        this.maximized = false;
        this.updateVisibility();
        return PS_ON_MOUSE_MOVE;
    }

    storeState() {
        var state = super.storeState();
        state.npHidden = this.npHidden;
        return state;
    }

    restoreState(state) {
        if (state.npHidden !== undefined)
            this.npHidden = state.npHidden;
        else
            this.npHidden = true;
        super.restoreState(state);
    }

    updateVisibility() {
        var vis = this.maximized && !this.npHidden;
        if (this.comingUp)
            setVisibility(this.comingUp, this.npHidden);
        if (isVisible(this.NPContainer, false) != vis)
            setVisibility(this.NPContainer, vis);            
    }

    get npHidden () {
        if (this._npHidden === undefined)
            return true;

        return this._npHidden;
    }
    set npHidden (value) {
        if (this._npHidden !== value) {
            this._npHidden = value;
            if (value) {
                if (!this._comingUpListenersSet) {
                    this._comingUpListenersSet = true;
                    if (this.nextTrackSummary) {
                        this.localListen(this.nextTrackSummary, 'click', function (evt) {
                            app.player.nextAsync();
                            evt.stopPropagation();
                        });
                        var entries = app.player.getSongList();
                        if (entries) {
                            this.localListen(entries, 'statuschange', this.updateNextTrack.bind(this));
                        }
                        this.localListen(app.player, 'shufflechange', this.updateNextTrack.bind(this));
                        this.localListen(app.player, 'repeatchange', this.updateNextTrack.bind(this));
                    }
                };
                this.updateNextTrack();
            }
            this.updateVisibility();
        }
    }
    
}
registerClass(NowPlayingFullList);
