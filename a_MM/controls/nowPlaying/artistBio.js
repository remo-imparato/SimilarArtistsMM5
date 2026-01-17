/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

/**
@module UI
*/

requirejs('controls/control');
requirejs('controls/listview');
requirejs('controls/trackListView');
requirejs('templates');
requirejs('controls/rating');
requirejs('helpers/musicBrainz')
requirejs('helpers/lang');

/**
UI NowPlayingView element

@class NowPlayingView
@constructor
@extends Control
*/

class NowPlayingArtistBio extends Control {

    initialize(elem, params) {
        super.initialize(elem, params);

        this.container.innerHTML = loadFile('file:///controls/nowPlaying/artistBio.html');

        precompileBinding(this.container, this);
        this.UI = getAllUIElements(this.container);
        this.NPContainer = this.UI.NPContainer;
        setVisibilityFast(this.NPContainer, false, {
            animate: false
        });

        this.localListen(app.player, 'playbackState', function (state) {
            if (state == 'trackChanged') {
                this.unregisterPropertyChange();
                this.registerPropertyChange();
            }
        }.bind(this));

        this.localListen(this.UI.artistBio, 'click', function (e) {
            e.stopPropagation();
        });

        this.localListen(this.UI.expandPanel, 'click', function (e) {
            e.stopPropagation();
            this.bigSize = true;
            this.handle_layoutchange();
        }.bind(this));

        this.localListen(this.UI.collapsePanel, 'click', function (e) {
            e.stopPropagation();
            this.bigSize = false;
            this.handle_layoutchange();
        }.bind(this));

        initializeControls(this.container);

        this.registerPropertyChange();
        var _this = this;
        this.menuItems = this.UI.artistImage.controlClass.menuItems;
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
            },
            action: {
                title: _('Choose different language'),
                visible: function () {
                    return _this.wikiInfo && _this.wikiInfo.wikipages && (_this.wikiInfo.wikipages.length > 0);
                },
                submenu: function () {
                    var retArray = [];
                    forEach(_this.wikiInfo.wikipages, function (pgObj, i) {
                        retArray.push({
                            title: window.getLanguageNativeName(pgObj.lang),
                            checked: function () {
                                return _this.wikiInfo && (_this.wikiInfo.wikiurl === pgObj.url.replace('http://', 'https://'));
                            },
                            execute: function () {
                                window.uitools.globalSettings.defaultWikiLang = pgObj.lang;
                                if (_this.bindFn && _this.currentTrack) {
                                    _this.bindFn(_this.container, _this.currentTrack);
                                };
                            }
                        });
                    });
                    return retArray;
                }
            }
        });
        this.bigSize = false;
        this.initialMaxHeight = this.UI.bioPanel.style.maxHeight;
        this.handle_layoutchange();
        this.registerEventHandler('layoutchange');
        this.updateVisibility();
    }

    updateTrack() {
        var _this = this;
        this.currentTrack = app.player.getCurrentTrack();
        var track = this.currentTrack;
        if (track) {
            var a = track.artist || track.albumArtist;
            if (a && this.lastArtistName && (a.localeCompare(this.lastArtistName, undefined, {
                    sensitivity: 'accent'
                }) === 0)) {
                return; // same artist, no change needed
            }
            this.lastArtistName = a;
        } else {
            this.lastArtistName = undefined;
        }

        cleanElement(this.UI.artistBio, true /* only children */ );
        if (!track)
            return;

        if (this.bindFn) {
            this.bindFn(this.container, track);
        };
    }

    handle_layoutchange(evt) {
        if (this.currentTrack) {
            var UI = this.UI;
            var contentHeight = UI.bioTextContainer.clientHeight;
            var panelHeight = UI.bioPanel.clientHeight;
            var diffHeight = Math.max(contentHeight - panelHeight, 0);
            var descriptionIsBig = diffHeight > 0;
            var wikiDescriptionEmpty = (UI.artistBio.textContent == '');
            setVisibilityFast(UI.expandPanel, !this.bigSize && descriptionIsBig && !wikiDescriptionEmpty);
            setVisibilityFast(UI.collapsePanel, this.bigSize && !wikiDescriptionEmpty && descriptionIsBig);
            setVisibilityFast(UI.bottomFadeout, !this.bigSize && descriptionIsBig);
            UI.bioScroller.classList.toggle('scrollable', this.bigSize);
            if (this.bigSize) {
                if (UI.bioPanel.style.maxHeight !== '100%') {
                    UI.bioPanel.style.maxHeight = '100%';
                    this.handle_layoutchange();
                }
            } else {
                if (UI.bioPanel.style.maxHeight !== this.initialMaxHeight) {
                    UI.bioPanel.style.maxHeight = this.initialMaxHeight;
                    this.handle_layoutchange();
                }
            }
        };
        
        if (evt)
            super.handle_layoutchange(evt);
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
        };
        this.updateTrack();
    }

    storeState() {
        var state = super.storeState();
        state.bigSize = this.bigSize;
        state.npHidden = this.npHidden;
        return state;
    }

    restoreState(state) {
        this.bigSize = !!state.bigSize;
        if (state.npHidden !== undefined)
            this.npHidden = state.npHidden;
        else
            this.npHidden = true;

        super.restoreState(state);
        this.handle_layoutchange();
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

    updateVisibility() {
        var vis = this.maximized && !this.npHidden;
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
registerClass(NowPlayingArtistBio);
