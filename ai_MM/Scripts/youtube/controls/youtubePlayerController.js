/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";
requirejs('controls/control');
requirejs('controls/toastMessage');
requirejs('playerUtils');

// delay for hiding frame with YT video, needed, because YT player needs to be visible at least some time after playback end (otherwise it consumes CPU after hiding)
var hideVideoDelay = 1000;

var player = app.player;
var showEmbeddedPlayer = false;

/**
@module UI
*/

/**
Player wrapper between HTML/JS and Youtube API in Youtube window

@class YTPlayerController
@constructor
@extends Control
*/
class YoutubePlayerController extends Control {

    initialize(elem, params) {
        super.initialize(elem, params);
        var _this = this;
        _this.ytWindow = undefined;
        _this.isActive = false;
        _this.hideVideoTimer = undefined;
        _this.lastMousePos = {
            x: 0,
            y: 0
        };
        this.localListen(player, 'htmlPlaybackState', this.onHTMLPlaybackState.bind(this));

        app.listen(thisWindow, 'closequery', function (token) {
            _this.cleanUp.call(_this);
            token.resolved();
        });

        app.listen(app, 'beforereload', function (store) {
            _this._beforeReload(store);
        });

        app.listen(app, 'afterreload', function (store) {
            _this._afterReload(store);
        });
    }

    _beforeReload(store) {
        var _this = this;
        ODS('YoutubePlayerController: called beforereload');
        if (!_this.ytWindow || !_this.ytWindow.controlClass || _this.hideVideoTimer || !isVisible(_this.ytWindowBg, false))
            return;
        var w = _this.ytWindow.controlClass.window;
        if (w) {
            var state = w.getValue('getState')();
            if (state && (state.isPlaying || state.isPaused)) {
                store.addData('YoutubePlayer_state', JSON.stringify(state));
                _this.cleanUp.call(_this);
            }
        }
    }

    _afterReload(store) {
        var _this = this;
        ODS('YoutubePlayerController: called afterreload');
        var stateStr = store.getData('YoutubePlayer_state');
        if (stateStr) {
            var state = JSON.parse(stateStr);
            if (state.isPlaying || state.isPaused) {
                _this.initializeYTPlayer().then(function () {
                    if (!_this.ytWindow || !_this.ytWindow.controlClass)
                        return;
                    var w = _this.ytWindow.controlClass.window;
                    if (w) {
                        w.getValue('restoreState')(state);
                    };
                });
            };
        }
    }

    // initializeYTPlayer is called automatically right before first YT playback
    initializeYTPlayer() {
        if (this._YTPlayerInitPromise)
            return this._YTPlayerInitPromise;
        this._YTPlayerInitPromise = new Promise(async function (resolve, reject) {
            if (this.YTPlayerInitialized) {
                resolve();
                return;
            }
            await playerUtils.initializeFSPlayer();
            this.videoSwitchPanel = null;
            uitools.globalSettings.lastVideoMode = uitools.globalSettings.lastVideoMode || window.videoModes.C_WINDOWED;
            var videoParent = prepareWindowModeSwitching();
            if (!videoParent) {
                reject();
                return;
            }
            var videoNode = qeid(videoParent, 'videoContent');
            var switcher = qeid(videoParent, 'videoSwitch');
            if (!videoNode || !switcher) {
                reject();
                return;
            }
            this.videoSwitchPanel = switcher.controlClass;
            this.ytWindowBg = document.createElement('div'); // needed when stretching embedded window
            this.ytWindowBg.classList.add('fill');
            this.ytWindowBg.style.backgroundColor = 'black';
            this.ytWindowBg.style.zIndex = '999'; // so it is above elements like menu button
            this.ytWindow = document.createElement('div');
            this.ytWindow.classList.add('fill');
            this.ytWindow.setAttribute('data-control-class', 'EmbeddedWindow');
            this.ytWindow.setAttribute('data-init-params', '{type: "ytplayer", access: true, url:"file:///controls/youtubeWindow.html"}');
            this.ytWindow.setAttribute('data-id', 'ytPlayerWindow');
            videoNode.appendChild(this.ytWindowBg);
            this.ytWindowBg.appendChild(this.ytWindow);
            setVisibility(this.ytWindowBg, false); // hide before initialization is complete, to avoid flickering

            var initHandler = app.listen(this.ytWindow, 'ready', function () {
                ODS('YoutubePlayerController: embedded YT window initialized');
                app.unlisten(this.ytWindow, 'ready', initHandler);
                this.addTemporaryListen(this.ytWindow, 'layoutchange', this.handle_layoutchange.bind(this));
                var fPlayer = playerUtils.getFullWindowPlayer();
                this.addTemporaryListen(this.videoSwitchPanel, 'change', function (e) {
                    if (this.ytWindowBg && !this.hideVideoTimer && isVisible(this.ytWindowBg, false))
                        uitools.globalSettings.lastVideoMode = e.detail.newMode;
                    showEmbeddedPlayer = e.detail.newMode !== window.videoModes.C_WINDOWED;
                    if (!showEmbeddedPlayer && fPlayer) {
                        this.hideFWPlayer(fPlayer);
                    }
                    if((e.detail.newMode == window.videoModes.C_WINDOWED) && !this.hideVideoTimer) {
                        // check panel width, assume video AR 16:9 for now, as YT does not return video size or AR
                        ODS('YoutubePlayerController: set min size from change');
                        this.setPanelMinSizes(16, 9);
                    }            
                }.bind(this));

                var lastVis = undefined;

                this.addTemporaryListen(fPlayer, 'visibilitychanged', function (min, vis, state) { // state: 0 normal, 1 minimized, 2 maximized
                    if (vis !== lastVis) {
                        if (this.ytWindow) {
                            if (!vis) {
                                animTools.animate(this.ytWindow, {
                                    marginBottom: fPlayer.bounds.height
                                });
                            } else {
                                animTools.animate(this.ytWindow, {
                                    marginBottom: 0
                                });
                            }
                        };
                        lastVis = vis;
                    }
                }.bind(this));

                this.addTemporaryListen(thisWindow, 'mousestatechanged', this.mousestatechangedHandler.bind(this));
                this.localListen(player, 'playbackState', this.onPlaybackState.bind(this));
                this.videoSwitchPanel.contentControl = videoNode;
                this.videoSwitchPanel.switchToMode(uitools.globalSettings.lastVideoMode, true);
                showEmbeddedPlayer = (uitools.globalSettings.lastVideoMode !== window.videoModes.C_WINDOWED);
                this.YTPlayerInitialized = true;
                this._YTPlayerInitPromise = undefined;
                if (this.isActive) {
                    setVisibility(this.ytWindowBg, true); // initialized, we can show it
                    this.listenTemporary();
                }
                resolve();
            }.bind(this));
            initializeControl(this.ytWindow);
            this.ytWindow.controlClass.addCleanFunc(function () {
                this.cleanYTPlayer();
            }.bind(this));
        }.bind(this));
        return this._YTPlayerInitPromise;
    }

    addTemporaryListen(obj, event, func, capture) {
        this._tempListeners = this._tempListeners || [];
        this._tempUnlisteners = this._tempUnlisteners || [];
        this._tempListeners.push(function () {
            app.listen(obj, event, func, capture);
        });
        this._tempUnlisteners.push(function () {
            app.unlisten(obj, event, func, capture);
        });

    }

    unlistenTemporary() {
        // call clean events for temporary listeners
        if (!this._tempUnlisteners || !this._temporaryListenersSet)
            return;
        forEach(this._tempUnlisteners, function (f) {
            f();
        });
        this._temporaryListenersSet = false;
    }

    listenTemporary() {
        // call all saved temp listen functions to start listening again
        if (!this._tempListeners || this._temporaryListenersSet)
            return;
        forEach(this._tempListeners, function (f) {
            f();
        });
        this._temporaryListenersSet = true;
        showEmbeddedPlayer = (uitools.globalSettings.lastVideoMode !== window.videoModes.C_WINDOWED); // need to initialize by current value
    }

    hideVideo(forceHide, callRestore) {
        this.clearHideTimer();
        if (!this.isActive)
            return;
        var hideFunc = function () {
            ODS('YoutubePlayerController: hideVideo, hideFunc');
            this.hideVideoTimer = undefined;
            //this.YTPlayerInitialized = false;
            if (this.ytWindowBg && isChildOf(document.body, this.ytWindowBg)) {
                ODS('YoutubePlayerController: hideVideo, hide ytWindowBg');
                this.resetPanelMinSizes();
                setVisibility(this.ytWindowBg, false);
                //removeElement(this.ytWindow);
                //this.ytWindow = undefined;
                //this.ytFrame = undefined;
            }
            if (this.isActive) {
                this.unregisterEventHandler('layoutchange');
                this.isActive = false;
                this.unlistenTemporary();
                this.getSwitcher();
                if (this.videoSwitchPanel && (forceHide || !player.isPlaying)) {
                    ODS('YoutubePlayerController: hideVideo, hideContent');
                    this.videoSwitchPanel.hideContent();
                    this.forceHideSwitcher();
                    if (callRestore && this.videoSwitchPanel) {
                        this.videoSwitchPanel.restoreWParentVisibility();
                    }    
                }
            }
        }.bind(this);

        if (forceHide)
            hideFunc();
        else
            this.hideVideoTimer = this.requestTimeout(hideFunc, hideVideoDelay);
        this.hideFWPlayer();
    }

    hideFWPlayer(fPlayer) {
        fPlayer = fPlayer || playerUtils.getFullWindowPlayer();
        if (fPlayer) {
            fPlayer.hide();
        }
    }

    showFWPlayer(fPlayer) {
        fPlayer = fPlayer || playerUtils.getFullWindowPlayer();
        if (fPlayer) {
            fPlayer.show();
        };
    }
    resetPanelMinSizes() {
        if(!this.ytWindowBg)
            return;
        let next = getParent(this.ytWindowBg);
        while (next) {
            if (next.hasAttribute('data-dock')) {
                if(next.hasAttribute('data-minWidthDefault')) {
                    let reqMinWidth = next.getAttribute('data-minWidthDefault');
                    if(reqMinWidth)
                        next.style.minWidth = reqMinWidth + 'px';
                    else
                        next.style.minWidth = '';
                    //ODS('YoutubePlayerController: reset minWidth to ' + reqMinWidth + 'px' + ', ' + next.getAttribute('data-id'));
                    window.notifyLayoutChange();
                }
                break;
            }
            next = getParent(next);
        }
    }

    setPanelMinSizes(arX, arY) {
        // find first data-dock and increase min-width, if needed
        if(!this.ytWindowBg || !arX || !arY)
            return;
        let next = getParent(this.ytWindowBg);
        while (next) {
            if (next.hasAttribute('data-dock')) {
                let reqMinWidth = Math.ceil(200*arX/arY) + 10;
                let currMinWidth = window.getMinWidth(next);
                if(currMinWidth<reqMinWidth) {
                    if(!next.hasAttribute('data-minWidthDefault')) {
                        next.setAttribute('data-minWidthDefault', currMinWidth);
                    }
                    if(next.clientWidth<reqMinWidth)
                        uitools.toastMessage.show(_('Switching to minimum width for YouTube video.'));
                    next.style.minWidth = reqMinWidth + 'px';
                    //ODS('YoutubePlayerController: set minWidth to ' + reqMinWidth + 'px' + ', ' + next.getAttribute('data-id'));
                    window.notifyLayoutChange();
                }
                break;
            }
            next = getParent(next);
        }
    }

    showVideo() {
        if (this.ytWindowBg && !this.isActive) {
            setVisibility(this.ytWindowBg, true);
            this.registerEventHandler('layoutchange');
            this.isActive = true;
            this.listenTemporary();
        }
        if (this.videoSwitchPanel) {
            this.videoSwitchPanel.showContent(true);
        }
        if(uitools.globalSettings.lastVideoMode == window.videoModes.C_WINDOWED) {
            // check panel width, assume video AR 16:9 for now, as YT does not return video size or AR
            //ODS('YoutubePlayerController: set min size from showVideo');
            this.requestTimeout(()=> {
                if(this.isActive)
                    this.setPanelMinSizes(16, 9);
            }, 500); // run after possible panel open animation, to have correct value
        }
    }

    updateVideo(state) {
        if (player === undefined)
            player = app.player;
        this.tmpSD = player.getFastCurrentTrack(this.tmpSD);
        var isYoutube = this.tmpSD && _utils.isYoutubeTrack(this.tmpSD);
        var isAudioWithoutVis = !isYoutube && !player.visualization.active && this.tmpSD && !this.tmpSD.isVideo;
        var unknown = !this.tmpSD;

        if (player.isPlaying && (state !== 'stop')) {
            ODS('YoutubePlayerController: updateVideo, isYoutube=' + isYoutube + ', unknown=' + unknown);
            if (isYoutube || unknown) {
                this.clearHideTimer();
                if (this.videoSwitchPanel) {
                    if ((uitools.globalSettings.lastVideoMode !== this.videoSwitchPanel.currentMode) || !this.isActive) {
                        this.videoSwitchPanel.switchToMode(uitools.globalSettings.lastVideoMode, true);
                    }
                }
                if (uitools.globalSettings.lastVideoMode !== window.videoModes.C_WINDOWED)
                    startFullWindowMode();
                else {
                    this.getSwitcher();
                }
                this.showVideo();
            } else {
                this.hideVideo(isAudioWithoutVis);
            }
        } else {
            ODS('YoutubePlayerController: updateVideo, not playing');
            stopFullWindowMode();
            this.hideVideo(isAudioWithoutVis, true);
        }
    }

    getSwitcher() {
        if (!this.videoSwitchPanel) {
            var switcher = qid('videoSwitch');
            if (switcher) {
                this.videoSwitchPanel = switcher.controlClass;
            }
        }
    }

    forceHideSwitcher() {
        this.getSwitcher();
        if (this.videoSwitchPanel) {
            this.videoSwitchPanel.exitFullScreen();
        }
    }

    onPlaybackState(state) {
        ODS('YoutubePlayerController: onPlaybackState, state=' + state);
        switch (state) {
            case 'pause':
                break;
            case 'unpause':
            case 'play':
            case 'stop':
            case 'end':
            case 'trackChanged':
                this.updateVideo(state);
                break;
        }
    }

    onHTMLPlaybackState(state, value) {
        ODS('YoutubePlayerController: onHTMLPlaybackState called, state=' + state + ' called from ' + app.utils.logStackTrace());
        var _this = this;

        if (state === 'play') {
            this.currSD = player.getCurrentTrack();
            if (this.currSD.webSource) {
                var item = JSON.parse(this.currSD.webSource);
                if (item.sourceType && item.sourceType != 'youtube')
                    return; // handled in cloudTools._onHTMLPlaybackState (item.sourceType == 'cloud')
            }
            if (!this.YTPlayerInitialized && !this.YTPlayerInitializing) {
                this.YTPlayerInitializing = true;
                this.localPromise(this.initializeYTPlayer()).then(function () {
                    _this.YTPlayerInitializing = false;
                    _this.onHTMLPlaybackState(state, value);
                }, function () {
                    _this.YTPlayerInitializing = false;
                });
                return;
            }

            if (!this.currSD.path) {
                requirejs('helpers/youtubeHelper');
                // find file on YT first
                // search already here, so it could be played optionally on different device like Chromecast instead of YT window
                if (this.searchingSD && this.searchingSD.isSame(this.currSD))
                    return;
                var sd = this.searchingSD = this.currSD;

                this.localPromise(ytHelper.searchVideosForTrack(sd, {
                    maxResults: 10
                })).then(function (resArray) {
                    _this.searchingSD = undefined;
                    if (resArray && resArray.length > 0) {
                        var res0 = resArray[0];
                        sd.path = res0.path;
                        if (sd.id > 0)
                            sd.commitAsync();
                        if (_this.currSD && (_this.currSD.isSame(sd))) { // did not change yet
                            _this.lastSearchInfo = {
                                sd: _this.currSD,
                                index: 0,
                                resArray: resArray
                            };
                            app.player.playAsync();
                        }
                    } else {
                        // no video found or quota exceeded, end playback, so it could skip the file properly
                        player.htmlPlaybackState.state = 'end';
                    }
                }, function () {
                    _this.searchingSD = undefined;
                    player.htmlPlaybackState.state = 'end';
                });
                return;
            }
        } else {
            this.lastSearchInfo = undefined;
        }
        if (!this.YTPlayerInitialized || !this.currSD || !this.ytWindow || !this.ytWindow.controlClass)
            return;

        var w = this.ytWindow.controlClass.window;
        if (w) {
            w.getValue('onHTMLPlaybackState')(state, value, this.lastSearchInfo);
            this.lastSearchInfo = undefined;
        }

        if (_this.updateVideo && (state !== 'pause'))
            _this.updateVideo(state);
    }

    mousemoveHandler(e) {
        if (window.showAsVideoPlayer || !this.isActive)
            return;

        if (this.lastMousePos.x != e.x || this.lastMousePos.y != e.y) {
            this.lastMousePos.x = e.x;
            this.lastMousePos.y = e.y;
            if (player.isPlaying)
                this.videoSwitchPanel.autoHide();
            var fPlayer = playerUtils.getFullWindowPlayer();
            if (fPlayer && showEmbeddedPlayer && window.fullWindowModeActive) {
                if (!fPlayer.visible)
                    this.showFWPlayer(fPlayer);
            };
        }
    }

    mousestatechangedHandler(x, y, hitTest, lDown, mDown, rDown) {
        //ODS('--- YoutubePlayerController x=' + x + ', y=' + y + ', hitTest=' + hitTest + ', lDown=' + lDown + ', mDown=' + mDown + ', rDown=' + rDown);
        if (!this.ytWindow || !this.isActive) {
            return;
        }
        var rect = window.bounds.clientRect;
        var clientX = x - rect.left;
        var clientY = y - rect.top;
        if ((uitools.globalSettings.lastVideoMode !== window.videoModes.C_WINDOWED) ||
            (isInElement(clientX, clientY, this.ytWindow))) {
            if (!lDown && !mDown && !rDown) {
                this.mousemoveHandler({
                    x: clientX,
                    y: clientY
                });
            }
        }
    }

    clearHideTimer() {
        if (this.hideVideoTimer !== undefined) {
            clearTimeout(this.hideVideoTimer);
            this.hideVideoTimer = undefined;
        }
    }

    handle_layoutchange(evt) {
        if (this.videoSwitchPanel) {
            this.videoSwitchPanel._switchPanelLayoutChange();
        }

        if (evt)
            super.handle_layoutchange(evt);
    }

    cleanYTPlayer() {
        if (this._YTPlayerInitPromise) {
            cancelPromise(this._YTPlayerInitPromise)
            this._YTPlayerInitPromise = undefined;
            this.YTPlayerInitializing = false;
        };
        this.unlistenTemporary();
        this._tempListeners = undefined;
        this._tempUnlisteners = undefined;
        this.videoSwitchPanel = undefined;
        this.ytWindow = undefined;
        this.ytWindowBg = undefined;
        this.YTPlayerInitialized = undefined;
        this.clearHideTimer();
    }

    cleanUp() {
        //ODS('YoutubePlayerController: cleanUp BEGIN');
        if (this.ytWindow && this.ytWindow.controlClass) {
            var w = this.ytWindow.controlClass.window;
            if (w) {
                ODS('YoutubePlayerController: cleanUp calling YTWindow cleanUp');
                w.getValue('cleanUp')();
            }
            this.ytWindow.controlClass.cleanUp();
        };
        this.cleanYTPlayer();
        super.cleanUp();
        //ODS('YoutubePlayerController: cleanUp END');
    }
}
registerClass(YoutubePlayerController);
