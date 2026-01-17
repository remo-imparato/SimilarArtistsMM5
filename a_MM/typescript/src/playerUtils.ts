registerFileImport('playerUtils');

import ArtWindow from './controls/artWindow';


(function () {
    'use strict';
    let videoPlayerInitialized = false;
    let fullWindowPlayer = null;
    let fullWindowPlayerLoaded = false;
    let videoSwitchPanel = null;
    let showEmbeddedPlayer = true;
    let player = app.player;
    let ignoreMouseMovement = false;
    let fadeTime = 500;
    let videoParentChanged = false;
    let switcherCreated = false;

    let fullScreenMouseHandler = function () {
        if (isMainWindow && !window.showAsVideoPlayer) {
            if (app.getCurrentPlayer() !== 0)
                return;

            if (videoSwitchPanel && player.isPlaying) {
                videoSwitchPanel.autoHide();
            }
            if (fullWindowPlayer && fullWindowPlayerLoaded && showEmbeddedPlayer && !fullWindowPlayer.visible && window.fullWindowModeActive) {
                fullWindowPlayer.show();
            }
        }
    };
    let fsPlayerPromise = undefined;
    window.playerUtils = {
        initialize: function () {
            window.prepareWindowModeSwitching = function () {
                let wplist = qs('[data-videoWindowed]');
                let videoParent = undefined;
                if (wplist && wplist.length)
                    videoParent = wplist[0];
                if (!videoParent) {
                    videoParentChanged = true;

                    window.intPlayer = null;

                    // preview panel not visible
                    let layout = window.uitools.getDocking().getCurrentLayout();
                    if (layout) {
                        let dock = layout.getPanelDock('artWindow');
                        if (!dock) {
                            dock = layout.getDock('nowplaying');
                            dock.addPanel('artWindow');
                        }
                        window.uitools.getDocking().storeLayout(layout);
                        window.uitools.getDocking().refreshCurrentLayout();
                        dock.changePanelVisibility('artWindow', false);
                        window.uitools.getDocking().storeLayout(layout);

                        let wplist = qs('[data-videoWindowed]');
                        if (wplist && wplist.length)
                            videoParent = wplist[0];
                    }
                }
                // issue #17405
                // min size of derived from min size of Youtube window: https://developers.google.com/youtube/terms/required-minimum-functionality
                videoParent.style.minWidth = '200px';
                videoParent.style.minHeight = '200px';
                if (!isVisible(videoParent, true)) {
                    setVisibility(videoParent, true, { animate: false });
                }
                let windowedParentID = videoParent.getAttribute('data-id');
                let videoNode = qeid(videoParent, 'videoContent');
                if (!videoNode) {
                    videoNode = document.createElement('div');
                    videoNode.className = 'fill';
                    videoNode.style.display = 'none'; // by default hidden, to avoid stealing mouse events, in case video or visualization content is not displayed afterwards, #15042
                    videoNode.setAttribute('data-id', 'videoContent');
                    videoParent.appendChild(videoNode);
                }
                let switcher = qeid(videoParent, 'videoSwitch');
                if (!switcher) {
                    requirejs('controls/switchWindow');
                    switcher = document.createElement('div');
                    switcher.setAttribute('data-id', 'videoSwitch');
                    switcher.setAttribute('data-control-class', 'SwitchWindow');
                    switcher.setAttribute('data-init-params', '{contentControl: "videoContent", playerControl: "fullWindowPlayer", windowedParent: "' + windowedParentID + '"}');
                    videoParent.appendChild(switcher);
                    switcherCreated = true;
                } else {
                    switcher.controlClass.contentControl = 'videoContent';
                    switcher.controlClass.playerControl = 'fullWindowPlayer';
                    switcher.controlClass.windowedParent = windowedParentID;
                }
                window.globalVideoSwitcher = switcher;

                let fullWindowPlayer = qeid(videoParent, 'fullWindowPlayer');
                if (!fullWindowPlayer) {
                    fullWindowPlayer = document.createElement('div');
                    fullWindowPlayer.className = 'animate stretchWidth bgColorBase slightlytransparent';
                    fullWindowPlayer.style.position = 'absolute';
                    fullWindowPlayer.style.bottom = '0';
                    fullWindowPlayer.style.left = '0';
                    fullWindowPlayer.style.zIndex = '999';
                    fullWindowPlayer.style.display = 'none';
                    fullWindowPlayer.setAttribute('data-id', 'fullWindowPlayer');
                    fullWindowPlayer.setAttribute('data-control-class', 'Control');
                    fullWindowPlayer.setAttribute('data-uiblock', 'player');
                    fullWindowPlayer.setAttribute('data-animate-height', 1);
                    videoNode.appendChild(fullWindowPlayer);
                    processIncludes(videoParent);
                }
                initializeControls(videoParent);
                videoSwitchPanel = switcher.controlClass;

                if (switcherCreated) {
                    app.listen(switcher, 'beforechange', function (e) {
                        if (headerClass)
                            switcher.controlClass._contentControl.classList.remove('windowHeaderOffset');
                    });

                    app.listen(switcher, 'change', function (e) {
                        if (e.detail.newMode === window.videoModes.C_FULLWINDOW && (headerClass)) {
                            switcher.controlClass._contentControl.classList.add('windowHeaderOffset');
                        }
                        if ((e.detail.newMode === window.videoModes.C_WINDOWED) && (app.player && (app.player.isPlaying || app.player.paused))) {
                            let track = app.player.getCurrentTrack();
                            if (track && (track.isVideo || _utils.isOnlineTrack(track))) {
                                let ctrl = window.elementControl(videoParent);
                                if (ctrl instanceof ArtWindow) {
                                    ctrl.mode = 'playingTrack'; // switch to playing track when mode is changed to 'windowed'
                                }
                            }
                        }
                    });
                }

                if (videoParentChanged) {
                    let ctrl = window.elementControl(videoParent);
                    if (ctrl instanceof ArtWindow) {
                        app.listen(ctrl, 'detailsModeChanged', function (e) {
                            if ((switcher.controlClass.currentMode === window.videoModes.C_WINDOWED) && (app.player && (app.player.isPlaying || app.player.paused))) {
                                let track = app.player.getCurrentTrack();
                                if (track && track.isVideo) {
                                    if (e.detail.newMode === 'playingTrack')
                                        switcher.controlClass.showContent(true);
                                    else
                                        switcher.controlClass.hideContent(true);
                                }
                            }
                        });
                    }
                }

                return videoParent;
            };


            window.startFullWindowMode = function () {
                if (window.fullWindowModeActive)
                    return;
                //ODS('startFullWindowMode called from ' + app.utils.logStackTrace());
                let wplist = qs('[data-videoWindowed]');
                let videoParent = undefined;
                if (wplist && wplist.length)
                    videoParent = wplist[0];

                let list = qs('[data-hideInFullWindowMode]');
                forEach(list, function (el) {
                    el.wasVisibleBeforeFullWindow = isVisible(el, false);
                    if (el.wasVisibleBeforeFullWindow) {
                        if (!videoParent || !isChildOf(el, videoParent))
                            setVisibility(el, false, {
                                layoutchange: false,
                                animate: false
                            });
                    }
                });
                window.fullWindowModeActive = true;
                notifyLayoutChange();
            };

            window.stopFullWindowMode = function () {
                if (!window.fullWindowModeActive)
                    return;
                //ODS('stopFullWindowMode called from ' + app.utils.logStackTrace());
                let list = qs('[data-hideInFullWindowMode]');
                forEach(list, function (el) {
                    if (el.wasVisibleBeforeFullWindow && (el._beforeMaximizeState === undefined)) {
                        setVisibility(el, true, {
                            layoutchange: false,
                            animate: false
                        });
                    }
                    el.wasVisibleBeforeFullWindow = undefined;
                });
                window.fullWindowModeActive = undefined;
                notifyLayoutChange();
            };

        },

        intializeEmbeddedPlayer: function (myBody) { // to be used in video for embedded player
            return new Promise<void>(function (resolve) {
                let body = myBody || getBodyForControls();
                let div = document.createElement('div');
                div.setAttribute('data-control-class', 'Control');
                div.setAttribute('data-uiblock', 'player');

                body.appendChild(div);
                processIncludes(document.body);
                initializeControls(div);

                // disable player shadow
                div.firstElementChild.classList.add('noshadow');
                div.firstElementChild.classList.add('relativeBase');

                // add offset for case seekbar is at top of the player and thumb overflows over the edge
                let d = document.createElement('div');
                d.classList.add('fillWidth');
                d.classList.add('videoPlayerOffset');
                div.insertBefore(d, div.firstElementChild);

                whenReady(function () {
                    setComputedSize(true);
                    resolve();
                });
            });
        },

        enterOrExitFullScreen: function () {
            if (videoSwitchPanel) {
                if (videoSwitchPanel.currentMode !== window.videoModes.C_FULLSCREEN) {
                    // go to full screen
                    videoSwitchPanel.switchToMode(window.videoModes.C_FULLSCREEN);
                } else {
                    // go back from full screen
                    if (!videoSwitchPanel.toPreviousMode()) {
                        videoSwitchPanel.switchToMode(window.videoModes.C_WINDOWED);
                    }
                }
            }
        },

        getFullWindowPlayer: function () {
            if (fullWindowPlayerLoaded)
                return fullWindowPlayer;
            else
                return undefined;
        },

        hideFullWindowPlayer: function () {
            if (fullWindowPlayer && fullWindowPlayerLoaded) {
                fullWindowPlayer.hide();
            }
            if (videoSwitchPanel) {
                videoSwitchPanel.hide(true);
            }
        },

        initializeSwitcher: function () {
            if (!videoSwitchPanel) {
                let videoParent = prepareWindowModeSwitching();
                let switcher = qeid(videoParent, 'videoSwitch');
                videoSwitchPanel = switcher.controlClass;
            }
            if (videoSwitchPanel) {
                videoSwitchPanel.localListen(videoSwitchPanel, 'autohide', function () {
                    if (fullWindowPlayer && fullWindowPlayerLoaded) {
                        ODS('*** Hide player ***');
                        fullWindowPlayer.hide();
                        requestTimeout(function () {
                            ignoreMouseMovement = true;
                            requestTimeout(function () {
                                ignoreMouseMovement = false;
                            }, 200);
                        }, fadeTime - 100);
                    }
                });
            }
        },

        initializeFSPlayer: function () {
            if (app.utils.system() === 'macos') {
                let _this = this;
                if (fsPlayerPromise)
                    return fsPlayerPromise;
                if (!fullWindowPlayer) {
                    // load player in timeout to be sure video window is already stretched to full screen
                    fsPlayerPromise = new Promise<void>(function (resolve, reject) {
                        fullWindowPlayerLoaded = false;
                        let elem = document.createElement('div');
                        elem.classList.add('innerWindow');

                        fullWindowPlayer = {
                            element: elem,
                            show: () => {
                                setVisibility(this.element, true);
                            },
                            hide: () => {
                                setVisibility(this.element, true);
                            },
                            closeWindow: () => {
                                this.hide();

                            },
                            bounds: {
                                get left() {
                                    let rct = fullWindowPlayer.element.getBoundingClientRect();
                                    // @ts-ignore
                                    return thisWindow.left + rct.left;
                                },
                                set left(value) {
                                    // @ts-ignore
                                    fullWindowPlayer.element.style.left = value - thisWindow.left;
                                },
                                get top() {
                                    let rct = fullWindowPlayer.element.getBoundingClientRect();
                                    // @ts-ignore
                                    return thisWindow.top + rct.top;
                                },
                                set top(value) {
                                    // @ts-ignore
                                    fullWindowPlayer.element.style.top = value - thisWindow.top;
                                },
                                get width() {
                                    let rct = fullWindowPlayer.element.getBoundingClientRect();
                                    return rct.width;
                                },
                                set width(value) {
                                    fullWindowPlayer.element.style.width = value;
                                },
                                get height() {
                                    let rct = fullWindowPlayer.element.getBoundingClientRect();
                                    return rct.height;
                                },
                                set height(value) {
                                    fullWindowPlayer.element.style.height = value;
                                }

                            }
                        };

                        let body = getBodyForControls();
                        body.appendChild(fullWindowPlayer.element);

                        fsPlayerPromise = undefined;

                        fullWindowPlayerLoaded = true;
                        app.listen(fullWindowPlayer, 'mousestatechanged', function () {
                            fullScreenMouseHandler();
                        });
                        let utils = playerUtils;
                        utils.intializeEmbeddedPlayer(fullWindowPlayer.element).then(function () {
                            playerUtils.updatePlayerPos();
                        });

                        app.listen(thisWindow, 'moved', function () {
                            playerUtils.updatePlayerPos();
                            playerUtils.hideFullWindowPlayer();
                        });
                        _this.initializeSwitcher();

                        resolve();

                    });
                    return fsPlayerPromise;
                } else {
                    return dummyPromise();
                }
            } else {
                let _this = this;
                if (fsPlayerPromise)
                    return fsPlayerPromise;

                if (!fullWindowPlayer) {
                    // load player in timeout to be sure video window is already stretched to full screen
                    fsPlayerPromise = new Promise<void>(function (resolve, reject) {
                        fullWindowPlayerLoaded = false;
                        fullWindowPlayer = uitools.openDialog('empty', {
                            show: false,
                            bordered: false,
                            flat: true,
                            width: 620,
                            moveable: false,
                            atTop: true,
                            opacity: 80,
                            fadeTime: fadeTime
                        });

                        fullWindowPlayer.loaded = function () {
                            fsPlayerPromise = undefined;
                            if (fullWindowPlayer) {
                                fullWindowPlayerLoaded = true;
                                app.unlisten(fullWindowPlayer, 'load', fullWindowPlayer.loaded);
                                app.listen(fullWindowPlayer, 'mousestatechanged', function () {
                                    fullScreenMouseHandler();
                                });
                                fullWindowPlayer.getValue('requirejs')('controls/player');
                                fullWindowPlayer.getValue('requirejs')('playerUtils');
                                let utils = fullWindowPlayer.getValue('playerUtils');
                                utils.intializeEmbeddedPlayer().then(function () {
                                    playerUtils.updatePlayerPos();
                                });
                                ODS('--- prepared FS player');
                                resolve();
                                return;
                            }
                            if (reject)
                                reject();
                        };

                        app.listen(fullWindowPlayer, 'load', fullWindowPlayer.loaded);

                        let freeFSPlayer = function () {
                            if (fullWindowPlayer && fullWindowPlayerLoaded) {
                                fullWindowPlayer.closeWindow();
                                fullWindowPlayer = null;
                            }
                        };

                        let appClose = function () {
                            freeFSPlayer();
                        };

                        app.listen(app, 'close', appClose);

                        app.listen(thisWindow, 'moved', function () {
                            playerUtils.updatePlayerPos();
                            playerUtils.hideFullWindowPlayer();
                        });

                        _this.initializeSwitcher();
                    });
                    return fsPlayerPromise;
                } else {
                    return dummyPromise();
                }
            }
        },

        updatePlayerPos: function () {
            if (!window._cleanUpCalled) {
                if (fullWindowPlayer && fullWindowPlayerLoaded && fullWindowPlayer.bounds) {
                    let borderSize = thisWindow.borderSize;
                    if (thisWindow.headerClass) {
                        borderSize = thisWindow.headerClass.borderSize;
                    }
                    fullWindowPlayer.bounds.top = ((thisWindow.bounds.top + thisWindow.bounds.height) - fullWindowPlayer.bounds.height) - borderSize;
                    fullWindowPlayer.bounds.left = thisWindow.bounds.left + borderSize;
                    fullWindowPlayer.bounds.width = thisWindow.bounds.width - (borderSize * 2);
                }
                if (videoSwitchPanel) {
                    videoSwitchPanel._switchPanelLayoutChange();
                }
            }
        },

        isThisAR: function (arX, arY) {
            let origX = window.playerUtils.videoSettings.aspectRatioX;
            let origY = window.playerUtils.videoSettings.aspectRatioY;
            if ((origX === arX) && (origY === arY))
                return true;
            if ((origY === 0) || (origX === 0) || (arX === 0) || (arY === 0))
                return false;
            return (Math.abs(origX / origY - arX / arY) < 0.01);

        },

        setAR: function (arX, arY) {
            window.playerUtils.videoSettings.aspectRatioX = arX;
            window.playerUtils.videoSettings.aspectRatioY = arY;
            app.player.setVideoSettings(window.playerUtils.videoSettings);
        },

        showHideVideoContent: function (show) {
            if (videoSwitchPanel && !window._cleanUpCalled && isChildOf(document.body, videoSwitchPanel.contentControl)) {
                videoSwitchPanel.hide();
                setVisibility(videoSwitchPanel.contentControl, show);
            }
        },

        _initializeVideoWindow: function () {
            return new Promise<void>(function (resolve, reject) {
                if (window._cleanUpCalled)
                    return;
                window.menus.videoMenuItems = window.menus.videoMenuItems || [{
                    action: actions.playPause,
                    order: 10,
                    grouporder: 10
                }, {
                    action: actions.stop,
                    order: 20,
                    grouporder: 10
                }, {
                    action: {
                        title: _('Adjust video'),
                        submenu: [{
                            action: {
                                title: _('Zoom'),
                                submenu: [{
                                    action: actions.video.fitToWindow,
                                    order: 10,
                                    grouporder: 10
                                }, {
                                    action: actions.video.zoom50,
                                    order: 10,
                                    grouporder: 20
                                }, {
                                    action: actions.video.zoom100,
                                    order: 20,
                                    grouporder: 20
                                }, {
                                    action: actions.video.zoom150,
                                    order: 30,
                                    grouporder: 20
                                }, {
                                    action: actions.video.zoom200,
                                    order: 40,
                                    grouporder: 20
                                }, {
                                    action: actions.video.zoomIn,
                                    order: 10,
                                    grouporder: 30
                                }, {
                                    action: actions.video.zoomOut,
                                    order: 20,
                                    grouporder: 30
                                }, {
                                    action: actions.video.zoomSlider,
                                    order: 10,
                                    grouporder: 40
                                }]
                            },
                            order: 10,
                            grouporder: 10
                        }, {
                            action: {
                                title: _('Aspect Ratio'),
                                submenu: [{
                                    action: actions.video.arOriginal,
                                    order: 10,
                                    grouproder: 10
                                }, {
                                    action: actions.video.ar43,
                                    order: 20,
                                    grouproder: 10
                                }, {
                                    action: actions.video.ar54,
                                    order: 30,
                                    grouproder: 10
                                }, {
                                    action: actions.video.ar169,
                                    order: 40,
                                    grouproder: 10
                                }, {
                                    action: actions.video.ar1610,
                                    order: 50,
                                    grouproder: 10
                                }, {
                                    action: actions.video.ar1851,
                                    order: 60,
                                    grouproder: 10
                                }, {
                                    action: actions.video.ar2351,
                                    order: 70,
                                    grouproder: 10
                                }]
                            },
                            order: 20,
                            grouporder: 10
                        }, {
                            action: actions.video.move,
                            order: 30,
                            grouporder: 10
                        }, {
                            action: actions.video.resetVideoSettings,
                            order: 40,
                            grouporder: 10
                        }]
                    },
                    order: 10,
                    grouporder: 20
                }, {
                    action: actions.video.saveThumbnail,
                    order: 20,
                    grouporder: 20
                }, {
                    action: actions.video.audioStreams,
                    order: 10,
                    grouporder: 50
                }, {
                    action: actions.video.subtitles,
                    order: 10,
                    grouporder: 50
                }];

                // prepare innerplayer object
                if (!window.intPlayer) {
                    requirejs('controls/switchWindow');
                    requirejs('controls/embeddedWindow');

                    let lastVideoMode = window.videoModes.C_WINDOWED;
                    if (isMainWindow) {
                        uitools.globalSettings.lastVideoMode = uitools.globalSettings.lastVideoMode || window.videoModes.C_WINDOWED;
                        lastVideoMode = uitools.globalSettings.lastVideoMode;
                    }

                    let videoParent = prepareWindowModeSwitching();
                    if (!videoParent) {
                        if (isTouchMode) {
                            // video container is required, but cannot be found .. switch to NowPlaying view, where one is prepared
                            let mainTabContent = window.currentTabControl;
                            let mv = mainTabContent.multiviewControl;
                            let wasNP = (mv && mv._activeView && mv._activeView.viewNode && (mv._activeView.viewNode.handlerID == 'nowplaying'));
                            if (!wasNP) {
                                navigationHandlers.nowPlaying.navigate().then(function () {
                                    window.playerUtils._initializeVideoWindow();
                                });
                            }
                        }

                        videoPlayerInitialized = false;
                        reject();
                        return;
                    }

                    let videoNode = qeid(videoParent, 'videoContent');
                    let switcher = qeid(videoParent, 'videoSwitch');
                    videoSwitchPanel = switcher.controlClass;

                    window.intPlayer = document.createElement('div');
                    window.intPlayer.classList.add('fill');
                    window.intPlayer.setAttribute('data-control-class', 'EmbeddedWindow');
                    window.intPlayer.setAttribute('data-init-params', '{type: "video"}');
                    window.intPlayer.setAttribute('data-contentType', 'video');
                    videoNode.appendChild(window.intPlayer);
                    initializeControl(window.intPlayer);
                    window.intPlayer.controlClass.addCleanFunc(() => {
                        window.intPlayer = undefined;
                    });

                    /* // LS: does not seem to be used anymore?
                    window.intPlayerHide = function () {
                        window.intPlayer.controlClass.hideWindow();
                    }
                    */

                    videoSwitchPanel.contentControl = videoNode;
                    videoSwitchPanel.switchToMode(lastVideoMode, true);

                    playerUtils.initializeFSPlayer();

                    window.intPlayer.controlClass.localListen(videoSwitchPanel, 'change', function (e) {
                        if (isMainWindow) {
                            if (window.intPlayer && isVisible(window.intPlayer)) {
                                uitools.globalSettings.lastVideoMode = e.detail.newMode;
                            }
                            showEmbeddedPlayer = e.detail.newMode !== window.videoModes.C_WINDOWED;

                            if (!showEmbeddedPlayer && fullWindowPlayer) {
                                fullWindowPlayer.hide();
                            }
                        }
                    });

                    app.listen(window.intPlayer, 'created', function () {
                        app.unlisten(window.intPlayer, 'created');
                        resolve();
                    });

                    window.intPlayer.controlClass.localListen(window.intPlayer, 'update', function (e) {
                        playerUtils.updatePlayerPos();
                    });

                    window.intPlayer.controlClass.localListen(thisWindow, 'activated', function () {
                        if (videoSwitchPanel.currentMode !== window.videoModes.C_FULLSCREEN) {
                            if (videoSwitchPanel)
                                videoSwitchPanel.hide(true);
                        }
                    });

                    window.intPlayer.controlClass.localListen(window.intPlayer, 'mousestatechanged', function (e) {
                        if (window.showAsVideoPlayer)
                            return;

                        let currentMode = videoSwitchPanel.currentMode;
                        if (e.detail.lButtonDblClick) { // switch between windowed/fullscreen
                            let newMode = '';
                            if (currentMode === window.videoModes.C_WINDOWED) {
                                newMode = window.videoModes.C_FULLSCREEN;
                            } else
                            if (currentMode !== window.videoModes.C_FULLSCREEN) {
                                newMode = window.videoModes.C_FULLSCREEN;
                            } else {
                                newMode = videoSwitchPanel.previousMode;
                            }
                            videoSwitchPanel.switchToMode(newMode);

                        } else {
                            if (e.detail.lButtonDown) {
                                if (app.player.isPlaying) {
                                    app.player.playPauseAsync();
                                }
                            } else if (e.detail.rButtonDown) {
                                window.playerUtils.videoSettings = app.player.getVideoSettings(); // update to recent values
                                let menu = new Menu(window.menus.videoMenuItems, {
                                    parent: thisWindow
                                });
                                let playerRect = window.intPlayer.getBoundingClientRect();
                                let wRect = window.bounds.clientRect;
                                menu.show(e.detail.x + playerRect.left + wRect.left, e.detail.y + playerRect.top + wRect.top, false, true);
                            } else {
                                if (currentMode === window.videoModes.C_FULLSCREEN) {
                                    if (fullWindowPlayer && !ignoreMouseMovement) {
                                        /*var playerPos = fullWindowPlayer.bounds.windowRect;
                                        if (e.detail.x in [playerPos.left - playerPos.right] && e.detail.y in [playerPos.top - playerPos.bottom]) {

                                        } else*/
                                        {
                                            fullScreenMouseHandler();
                                        }
                                    }
                                } else {
                                    fullScreenMouseHandler();
                                }
                            }
                        }
                    });

                    let event = createNewCustomEvent('videoplayercreated', {
                        detail: {
                            bubbles: false,
                            cancelable: true,
                        }
                    });
                    window.dispatchEvent(event);

                } else {
                    if (window.intPlayer && window.intPlayer.controlClass && window.intPlayer.controlClass.created) {
                        setVisibility(window.intPlayer, true);
                        window.intPlayer.controlClass.updateWindow(true);
                        resolve();
                    }
                }
            });
        },


        // initializeVideoPlayer is called automatically right before first video playback
        initializeVideoPlayer: function () {

            if (videoPlayerInitialized) return;
            videoPlayerInitialized = true;

            let sd = undefined;
            let wasVideo = false;

            window.playerUtils._initializeVideoWindow().then(function () {
                if (window._cleanUpCalled)
                    return;
                updateVideo();
            });

            let getSwitcher = function () {
                if (videoSwitchPanel)
                    return;
                let node = qid('videoContent');
                if (node) {
                    let switcher = qeid(getParent(node), 'videoSwitch');
                    videoSwitchPanel = switcher.controlClass;
                }
            };

            let forceHideSwitcher = function () { };

            // eslint-disable-next-line mediamonkey/no-var-except-declare
            var updateVideo = function (state?:string) {

                if (player === undefined)
                    player = app.player;
                sd = player.getFastCurrentTrack(sd);
                let isVideo = sd && sd.isVideo && !_utils.isOnlineTrack(sd) && (!app.sharing.getActivePlayer() /* #17469 */);
                let unknown = !sd;
                if (!wasVideo && !isVideo)
                    return;

                let hideVideo = function () {
                    ODS('playerUtils.updateVideo, hideVideo');
                    getSwitcher();
                    if (videoSwitchPanel) {
                        videoSwitchPanel.hideContent(true /* video */);
                    }
                    if (window.intPlayer && isChildOf(document.body, window.intPlayer)) {
                        setVisibility(window.intPlayer, false);
                    }
                    forceHideSwitcher();
                    if (fullWindowPlayer && fullWindowPlayerLoaded) {
                        fullWindowPlayer.hide();
                    }
                    /* LS: seems no longer used
                    if (window.extPlayerWindow && window.extPlayerWindow.windowIsLoaded) {
                        window.extPlayerWindow.hide();
                    }*/
                    this._videoShown = false;
                }.bind(this);

                if (player.isPlaying) {
                    let lastVideoMode = window.videoModes.C_WINDOWED;
                    if (isMainWindow) {
                        lastVideoMode = uitools.globalSettings.lastVideoMode;
                    }
                    getSwitcher();
                    if (isVideo || unknown) {
                        ODS('playerUtils.updateVideo, isPlaying, isVideo=' + isVideo);

                        prepareWindowModeSwitching();

                        if (videoSwitchPanel) {
                            if ((lastVideoMode !== videoSwitchPanel.currentMode) || (!this._videoShown)) {
                                videoSwitchPanel.switchToMode(lastVideoMode, true);
                            }
                        }
                        if (lastVideoMode !== window.videoModes.C_WINDOWED)
                            startFullWindowMode();
                        if (videoSwitchPanel) {
                            videoSwitchPanel.showContent(true /* video */);
                        }
                        if (window.intPlayer) {
                            setVisibility(window.intPlayer, true);
                        }
                        /* LS: seems no longer used
                        if (window.extPlayerWindow && window.extPlayerWindow.windowIsLoaded) {
                            window.extPlayerWindow.show();
                        }
                        */
                        this._videoShown = true;
                    } else if (this._videoShown) {
                        //ODS('playerUtils.updateVideo, isPlaying, _videoShown, stopping fullwindow');
                        if (videoSwitchPanel)
                            videoSwitchPanel.exitFullScreen();
                        stopFullWindowMode();
                        hideVideo();
                        if (videoSwitchPanel)
                            videoSwitchPanel.restoreWParentVisibility();
                    }
                    if (isMainWindow) {
                        showEmbeddedPlayer = (uitools.globalSettings.lastVideoMode !== window.videoModes.C_WINDOWED);
                    }
                } else {
                    ODS('playerUtils.updateVideo, not isPlaying, stopping fullwindow');
                    if (videoSwitchPanel)
                        videoSwitchPanel.exitFullScreen();
                    stopFullWindowMode();
                    hideVideo();
                    if (videoSwitchPanel)
                        videoSwitchPanel.restoreWParentVisibility();
                }
                wasVideo = isVideo;
            }.bind(this);

            let onPlaybackState = function (state) {
                if (window._cleanUpCalled)
                    return;
                sd = player.getFastCurrentTrack(sd);
                if (!sd) {
                    ODS('playerUtils.onPlaybackState - no SD');
                    return;
                }
                ODS('playerUtils.onPlaybackState ' + state + ', sd=' + sd.title);
                switch (state) {
                case 'pause':
                    //forceHideSwitcher();
                    break;
                case 'play':
                case 'unpause':
                case 'stop':
                //case 'trackChanged': // should not be already needed, #15586 seems to not be problem and it was causing #21091 b) - closed video during advancing to the next track
                    updateVideo(state);
                    break;
                }
            };
            playerUtils._playbackStateListener = app.listen(player, 'playbackState', onPlaybackState);
        },

        unregisterVideoPlayer: function () {
            if (videoPlayerInitialized && playerUtils._playbackStateListener)
                app.unlisten(app.player, 'playbackState', playerUtils._playbackStateListener);
        },

        exitVisualization: function () {
            let winModeParent = prepareWindowModeSwitching();
            if (winModeParent && winModeParent.controlClass && winModeParent.controlClass.getCloseButtonAction && winModeParent._oldCloseButtonAction) {
                winModeParent.controlClass.setCloseButtonAction(winModeParent._oldCloseButtonAction);
                winModeParent._oldCloseButtonAction = undefined;
            }
        },

        initializeVisualization: function (selvis) {
            if (visualizations.length === 0)
                return;
            let winModeParent = prepareWindowModeSwitching();
            if (!winModeParent) {
                return;
            }
            if (winModeParent.controlClass && winModeParent.controlClass.getCloseButtonAction && (winModeParent._oldCloseButtonAction == undefined)) {
                winModeParent._oldCloseButtonAction = winModeParent.controlClass.getCloseButtonAction();
                winModeParent.controlClass.setCloseButtonAction(actions.view.visualization);
            }
            let visParent = qeid(winModeParent, 'videoContent');
            let nodeList = qes(winModeParent, '[data-contentType="visualization"]');
            let switcher = qeid(winModeParent, 'videoSwitch');
            let switchPanel = switcher.controlClass;
            uitools.globalSettings.lastVideoMode = uitools.globalSettings.lastVideoMode || window.videoModes.C_WINDOWED;
            let visNode;
            if (!nodeList || (nodeList.length === 0)) {
                visNode = document.createElement('div');
                visNode.className = 'fill';
                visNode.setAttribute('data-contentType', 'visualization');
                visParent.appendChild(visNode);

                app.listen(visParent, 'layoutchange', function () {
                    if (switchPanel) {
                        switchPanel._switchPanelLayoutChange();
                    }
                });

                app.listen(switcher, 'change', function (e) {
                    if (visNode && visNode.controlClass && (visNode.controlClass.currMode !== 'hidden')) {
                        uitools.globalSettings.lastVideoMode = e.detail.newMode;
                        visNode.controlClass.modeChanged(e.detail.newMode);
                    }
                });

                app.listen(thisWindow, 'moved', function () {
                    if (switchPanel) {
                        switchPanel.hide(true);
                    }
                });

                app.listen(thisWindow, 'closeQuery', function() {
                    app.unlisten(switcher);
                });

                localListen(app, 'beforeReload', function() {
                    app.unlisten(switcher);
                });

            } else {
                visNode = nodeList[0];
            }

            requestAnimationFrameMM(function () { // PETR: control can be hidden now, so wait to next frame
                switchPanel.contentControl = visNode.parentElement;
            });

            // TODO: get actual visualization class from actual settings
            if (visNode.controlClass) {
                if (!selvis || (visNode.controlClass.constructor.name === selvis.className)) {
                    switchPanel.switchToMode(uitools.globalSettings.lastVideoMode, true);
                    visNode.controlClass.restoreVis();
                    return;
                } else {
                    cleanElement(visNode);
                }
            }

            let lastMousePos = {
                x: 0,
                y: 0
            };
            let player = app.player;

            if (!selvis) {
                let selname = uitools.globalSettings.selectedVisualization || 'Vis_milkdrop';
                for (let i = 0; i < visualizations.length; i++) {
                    if (visualizations[i].className === selname) {
                        selvis = visualizations[i];
                        break;
                    }
                }
                if (!selvis) {
                    selvis = visualizations[0];
                }
            }
            uitools.globalSettings.selectedVisualization = selvis.className;
            requirejs(selvis.jsFile);
            let cls = window[selvis.className];
            // @ts-ignore
            visNode.controlClass = new cls(visNode, {
                closable: true,
                closeAction: actions.view.visualization
            });

            visNode.controlClass.localListen(thisWindow, 'mousestatechanged', function (x, y, hitTest, lDown, mDown, rDown) {
                if (window.showAsVideoPlayer)
                    return;
                if (uitools.globalSettings.lastVideoMode !== window.videoModes.C_WINDOWED) {
                    let rect = window.bounds.clientRect;
                    let clientX = x - rect.left;
                    let clientY = y - rect.top;
                    if (!lDown && !mDown && !rDown) {
                        if (lastMousePos.x != clientX || lastMousePos.y != clientY) {
                            lastMousePos = {
                                x: clientX,
                                y: clientY
                            };
                            if (player.isPlaying && !player.paused) {
                                switchPanel.autoHide();
                            }
                        }
                    }
                }
            }.bind(this));

            visNode.controlClass.localListen(visNode, 'mousemove', function (e) {
                if (window.showAsVideoPlayer)
                    return;
                if (uitools.globalSettings.lastVideoMode !== window.videoModes.C_WINDOWED) {
                    if (lastMousePos.x != e.x || lastMousePos.y != e.y) {
                        lastMousePos = {
                            x: e.x,
                            y: e.y
                        };
                        if (player.isPlaying && !player.paused) {
                            switchPanel.autoHide();
                        }
                    }
                }
            });
            if (player.visualization.active)
                switchPanel.switchToMode(uitools.globalSettings.lastVideoMode, true);
        },

    };
    window.playerUtils.videoSettings = app.player.getVideoSettings();
})();
