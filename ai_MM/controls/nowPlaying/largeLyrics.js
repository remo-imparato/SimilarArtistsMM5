/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

/**
@module UI
*/

requirejs('controls/control');
requirejs('controls/listview');
requirejs('controls/trackListView');
requirejs('templates');
requirejs('controls/rating');

/**
UI NowPlayingLargeLyrics element

@class NowPlayingLargeLyrics
@constructor
@extends Control
*/

class NowPlayingLargeLyrics extends Control {

    initialize(elem, params) {
        super.initialize(elem, params);

        this.container.innerHTML = loadFile('file:///controls/nowPlaying/largeLyrics.html');

        precompileBinding(this.container, this);
        this.lyricsDiv = this.qChild('lyrics');
        this.titleDiv = this.qChild('titleDiv');
        this.scroller = this.qChild('foreground');
        this.NPContainer = this.qChild('NPContainer');
        setVisibilityFast(this.NPContainer, false, {
            animate: false
        });

        this.saveBtn = this.qChild('saveLyricsBtn');

        this.localListen(app.player, 'playbackState', function (state) {
            if (state == 'trackChanged') {
                this.unregisterPropertyChange();
                this.registerPropertyChange();
            }
        }.bind(this));

        this.localListen(settings.observer, 'change', () => {
            this._lastData = undefined;
            this.updateTrack();
        });

        initializeControls(this.container);
        precompileBinding(this.lyricsDiv, this);

        this.registerPropertyChange();
        let _this = this;
        
        this.saveBtn.controlClass.localListen(this.saveBtn, 'click', function (evt) {
            if (_this.lastTrack && _this.container.foundLyrics) {
                var track = _this.lastTrack;
                track.setLyricsAsync(_this.container.foundLyrics).then(function () {
                    _this.container.foundLyrics = undefined;
                    track.commitAsync();
                });
            }
            evt.stopPropagation();
        });
        
        
        this.menuItems = this.qChild('ArtistImage').controlClass.menuItems;
        this.menuItems.push({
            action: {
                title: _('Save lyrics'),
                icon: 'save',
                disabled: function () {
                    return !_this.lastTrack;
                },
                visible: function () {
                    return _this.lastTrack && _this.container.foundLyrics;
                },
                execute: function () {
                    var track = _this.lastTrack;
                    track.setLyricsAsync(_this.container.foundLyrics).then(function () {
                        _this.container.foundLyrics = undefined;
                        track.commitAsync();
                    });
                }
            }
        });

        let origFontSize = this.lyricsDiv.style.fontSize;
        let currentSize = parseInt(origFontSize);
        let updateSize = () => {
            let sz = app.getValue('NowPlaylistLyricsSize', 0);
            if (sz !== 0) {
                this.lyricsDiv.style.fontSize = parseInt(sz) + 'px';
                this.titleDiv.style.fontSize = parseInt(sz) + 'px';
                currentSize = parseInt(sz);
            }
            else {
                this.lyricsDiv.style.fontSize = origFontSize;
                this.titleDiv.style.fontSize = origFontSize;
                currentSize = parseInt(origFontSize);
            }
        };

        let addFontSizeSubmenu = function () {
            let ar = [];

            let addItem = function (_sz) {
                ar.push({
                    sz: _sz,
                    title: function () {
                        if (this.sz !== 0)
                            return this.sz + 'px';
                        return _('Reset to original');
                    },
                    execute: function () {
                        app.setValue('NowPlaylistLyricsSize', this.sz);
                        updateSize();
                    },
                    checked: function () {
                        return (this.sz === currentSize);
                    }
                });
            };

            for (var i = 10; i <= 80; i = i + 10)
                addItem(i);

            addItem(0);

            return ar;
        };

        this.menuItems.push({
            title: _('Font size'),
            submenu: addFontSizeSubmenu,
        });

        updateSize();
        
        let loadSettings = function () {
            var sett = window.settings.get('Options');
            _this._autoSave = sett.Options.SaveMissingLyrics && window.uitools.getCanEdit();
            _this._autoSearch = !!sett.Options.SearchMissingLyrics;
        };

        this.localListen(app, 'settingschange', function () {
            loadSettings();
        });
        loadSettings();        
    }

    updateTrack() {
        this.currentTrack = app.player.getCurrentTrack();
        let track = this.currentTrack;
        let key; 
        if (track)
            key = track.title + track.artist + track.lyricsShort;
        
        if (this.bindFn && (this._lastData != key /* #20164 */)) {
            this._lastData = key;            
            this.bindFn(this.container, track, {
                autoSearch: this._autoSearch,
                saveLyrics: this._autoSave,
                onComplete: (lyrics) => {                    
                    this.scroller.scrollTop = 0;                    
                }
            });
        }
    }

    unregisterPropertyChange() {
        if (this.lastTrack) {
            app.unlisten(this.lastTrack, 'change', this.__trackChangeFunc);
        }
    }

    registerPropertyChange() {
        this.lastTrack = app.player.getCurrentTrack();
        if (this.lastTrack) {
            this.__trackChangeFunc = app.listen(this.lastTrack, 'change', this.updateTrack.bind(this));
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

    storeState() {
        let state = super.storeState();
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

    updateVisibility() {
        let vis = this.maximized && !this.npHidden;
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
            this.updateVisibility();
        }
    }
    
}
registerClass(NowPlayingLargeLyrics);
