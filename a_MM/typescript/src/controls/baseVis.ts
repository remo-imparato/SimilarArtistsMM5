'use strict';

registerFileImport('controls/baseVis');

import Control from './control';

requirejs('controls/switchWindow');

window.uitools = window.uitools || {};

window.uitools.getVisMenuItems = function () {
    let menuitems = [];
    for (let i = 0; i < visualizations.length; i++) {
        let vis = visualizations[i];
        let act = {
            title: vis.visName,
            visObj: vis,

            execute: function () {
                playerUtils.initializeVisualization(this.visObj);
            },

            checked: function () {
                uitools.globalSettings.selectedVisualization = uitools.globalSettings.selectedVisualization || 'Vis_milkdrop';
                return (uitools.globalSettings.selectedVisualization === this.visObj.className);
            }
        };
        menuitems.push(act);
    }
    return menuitems;
};

/**
 * Base class for visualizer controls.
 */
export default class BaseVis extends Control {
    private _width: number;
    private _height: number;
    private _textDuration: number;
    private _textEndStart: number;
    private _textStartTime: number;
    private _fonts: any;    
    private _title: string;
    private _artist: string;
    private _fillStyleText: string;
    private _textShadowColor: string;
    showingFPSInfo: boolean;
    automaticPresetChange: boolean;
    switcher: any;
    private _currMode: string;
    switchFullMode: () => void;
    sd: Track;
    prepareVis: () => void;
    switchToFullScreen: () => void;
    exitFullScreen: () => void;
    restoreMainWindow: () => void;
    private _doOnPlaybackState: (state: any) => void;
    stopVisTimer: number;
    exitVis: any;

    initialize(parentel, params) {
        super.initialize(parentel, params);
        params = params || {};
        this.container.classList.add('basevis');
        let _this = this;
        this._width = 0;
        this._height = 0;
        this._currMode = parentel.isFullScreen ? window.videoModes.C_FULLSCREEN : 'hidden'; // hidden, modeFullWindow, modeFullScreen
        this._textDuration = 7000;
        this._textEndStart = (this._textDuration - 2000);        
        this.sd = undefined;
        this.showingFPSInfo = false;
        this.automaticPresetChange = true;
        let currPlayerState = 'stop';
        let waitforupdate = false;
        //let wasBordered = true;
        let visPrepared = false;

        /*
        let changeVis = function (list, vis) {
            for (let a = 0; a < list.length; a++) {
                if (list[a] != window.intPlayer)
                    setVisibility(list[a], vis);
            }
        };
        */
        this.switcher = null;
        let player = app.player;
        let vis = player.visualization;
        let style = getComputedStyle(this.container, null);
        this.prepareColors(style);

        this.localListen(app, 'customLessChange', () => {
            this.requestFrame(() => { // has to be in the next frame, so styles are already updated
                style = getComputedStyle(_this.container, null);
                _this.prepareColors(style);
            }, 'customStyleUpdate');
        });

        let stopVisualization = function () {
            if (_this.currMode !== 'hidden') {
                _this.currMode = 'hidden';
                _this.onStopHandler.call(_this);
                if (_this.switcher)
                    _this.switcher.hideContent();
                playerUtils.exitVisualization();
                _this.sendVisChanged(false);
            }
        };

        this.switchFullMode = function () {
            let currentMode = _this.currMode;
            let newMode = currentMode;
            if (_this.switcher) {
                currentMode = _this.switcher.currentMode;
            }
            if (currentMode === window.videoModes.C_WINDOWED) {
                newMode = window.videoModes.C_FULLSCREEN;
            } else
            if (currentMode === window.videoModes.C_FULLWINDOW) {
                newMode = window.videoModes.C_FULLSCREEN;
            } else if (currentMode === window.videoModes.C_FULLSCREEN) {
                if (_this.switcher)
                    newMode = _this.switcher.previousMode;
                else
                    newMode = window.videoModes.C_WINDOWED;
            }

            if (_this.switcher) {
                _this._currMode = newMode;
                _this.switcher.switchToMode(newMode);
                parentel.isFullScreen = (newMode === window.videoModes.C_FULLSCREEN);
            } else {
                _this.currMode = newMode;
            }
        };

        let keyHandler = function (evt) {
            if (evt.shiftKey || evt.ctrlKey)
                return;
            let handled = true;
            switch (evt.keyCode) {
            case 122:
                /* F11 */
                _this.switchFullMode();
                break;
            case 27:
                /* ESC */
                if ((_this.currMode !== window.videoModes.C_FULLWINDOW) && (_this.currMode !== window.videoModes.C_FULLSCREEN))
                    handled = false;
                else
                    app.player.visualization.active = false;
                break;
            case 84:
                /* t */
                break;
            case 113:
                /* F2 */
                // display title again
                _this.sd = player.getFastCurrentTrack(_this.sd);
                if (_this.sd && !_this.sd.isVideo && !_utils.isOnlineTrack(_this.sd)) {
                    _this.onPaintTitle(_this.sd.title, app.utils.multiString2VisualString(_this.sd.artist));
                }
                break;
            case 116: // F5 - toggle FPS info
                _this.showingFPSInfo = !_this.showingFPSInfo;
                break;
            case 121: // F10 - toggle automatic preset change
            {
                _this.automaticPresetChange = !_this.automaticPresetChange;
                let s_On = _('Automatic preset change') + ' (' + _('On') + ')';
                let s_Off = _('Automatic preset change') + ' (' + _('Off') + ')';
                _this.onPaintTitle('', _this.automaticPresetChange ? s_On : s_Off);
                break;
            }
            default:
                handled = false;
            }
            if (handled) {
                evt.stopPropagation();
                evt.preventDefault();
            }
        };

        this.prepareVis = function () {
            if (!vis.active) {
                return;
            }
            if (!visPrepared) {
                visPrepared = true;
                if (!_this.switcher) {
                    let switcherDiv = qid('videoSwitch');
                    if (switcherDiv)
                        _this.switcher = switcherDiv.controlClass;
                }
                // start catching event
                app.listen(window, 'keyup', keyHandler);
                _this.registerEventHandler('dblclick');
            }
            if (_this.switcher) {
                _this.switcher.active = true;
                _this.switcher.resume();
                this._currMode = _this.switcher.currentMode;
                setVisibility(this.container, true);
                _this.switcher.showContent();
                _this.sendVisChanged(true);
            }
        };

        this.switchToFullScreen = function () {
            // remove window borders and maximize window
            parentel.isFullScreen = true;
            if (_this.switcher)
                _this.switcher.switchToMode(window.videoModes.C_FULLSCREEN);
        };

        this.exitFullScreen = function () {
            // remove window borders and maximize window
            parentel.isFullScreen = false;
            if (_this.switcher)
                _this.switcher.exitFullScreen();
        };

        this.restoreMainWindow = function () {
            _this.exitVis();
            window.stopFullWindowMode();
        };

        this.registerEventHandler('layoutchange');

        let requpdate = function () {
            if ((currPlayerState === 'play') && !waitforupdate) {
                waitforupdate = true;
                requestAnimationFrameMM(doUpdate);
            }
        };

        let currData, tm;

        let doUpdate = function () {
            waitforupdate = false;
            if (!visPrepared || !vis || (currPlayerState !== 'play')) {
                return;
            }
            if (!vis.active) {
                // vis was deactivated - stop it
                stopVisualization();
                return;
            }

            tm = player.trackPositionMS;
            currData = vis.getNextResult(tm, currData);
            if (currData) {
                _this.onUpdateHandler.call(_this, currData);
                requpdate();
            } else {
                _this.requestTimeout(function () {
                    requpdate();
                }, 200);
            }
        };

        this._doOnPlaybackState = function (state) {
            if (!vis.active)
                return;
            _this.sd = player.getFastCurrentTrack(_this.sd);
            if (!_this.sd || _this.sd.isVideo || _utils.isOnlineTrack(_this.sd)) {
                if (_this.stopVisTimer) {
                    clearTimeout(_this.stopVisTimer);
                    _this.stopVisTimer = undefined;
                }
                stopVisualization();
                if (!_this.sd)
                    ODS('baseVis.onPlaybackState ' + state + ', sd not defined');
                else
                    ODS('baseVis.onPlaybackState ' + state + ', sd.isVideo=' + _this.sd.isVideo);
                return;
            }
            ODS('baseVis.onPlaybackState ' + state + ', sd=' + _this.sd.title);
            switch (state) {
            case 'unpause':
            case 'play':
                if (currPlayerState !== 'play') {
                    currPlayerState = 'play';
                }
                if (_this.stopVisTimer) {
                    clearTimeout(_this.stopVisTimer);
                    _this.stopVisTimer = undefined;
                }
                _this.currMode = uitools.globalSettings.lastVideoMode; // uitools.globalSettings.lastVisualizationMode;
                if (_this.switcher) {
                    if (uitools.globalSettings.lastVideoMode !== _this.switcher.currentMode) {
                        _this.switcher.switchToMode(uitools.globalSettings.lastVideoMode);
                        if (!visPrepared)
                            this.prepareVis();
                    }
                    //_this.switcher.checkWParentVisibility();
                }
                _this.onPaintTitle(_this.sd.title, app.utils.multiString2VisualString(_this.sd.artist));
                requpdate();
                break;
            case 'stop':
            case 'end':
                currPlayerState = state;
                if (window.appIsClosing) {
                    if (_this.stopVisTimer)
                        clearTimeout(_this.stopVisTimer);
                    stopVisualization();
                } else {
                    if (!_this.stopVisTimer) { // small timeout, so we do not switch off visualization in case other audio is starting immediately, reduces blinking                        
                        _this.stopVisTimer = _this.requestTimeout(function () {
                            _this.stopVisTimer = undefined;
                            if(!app.player.isPlaying)
                                stopVisualization();
                            else { // already starting playback of the next track, do not stop, if this is audio
                                _this.sd = player.getFastCurrentTrack(_this.sd);
                                if (!_this.sd || _this.sd.isVideo || _utils.isOnlineTrack(_this.sd))
                                    stopVisualization();
                            }
                        }, 250);
                    }
                }
                break;
            case 'pause':
                currPlayerState = state;
                stopVisualization();
                break;
            }
        };
        let menuitems = [];
        menuitems.push({
            action: actions.view.visualization,
            order: 10,
            grouporder: 4
        });

        this.addToContextMenu(menuitems);

        this.exitVis = function () {
            app.unlisten(window, 'keyup', keyHandler);
            _this.unregisterEventHandler('dblclick');
            if (_this.switcher) {
                _this.switcher.active = false;
            }
            visPrepared = false;
        };

        app.listen(player, 'playbackState', this._doOnPlaybackState);
        this.handle_layoutchange();
        this.requestFrame(function () { // call later, so initialize is finished first, to avoid problems with restoring docks
            this.restoreVis();
        }.bind(this));
    }

    handle_layoutchange(evt?) {
        let cs = window.getComputedStyle(this.container, null);
        let w = Math.round(Math.abs(parseFloat(cs.getPropertyValue('width'))));
        let h = Math.round(Math.abs(parseFloat(cs.getPropertyValue('height'))));
        if ((w !== this._width) || (h !== this._height)) {
            this._height = h;
            this._width = w;
            this.onResizeHandler.call(this, w, h);
        }
        if (evt)
            super.handle_layoutchange(evt);
    }

    handle_dblclick(evt) {
        evt.stopPropagation();
        evt.preventDefault();
        this.switchFullMode();
    }

    cleanUp() {
        app.unlisten(app.player, 'playbackState', this._doOnPlaybackState);
        this.exitVis();
        this.sendVisChanged(false);
        super.cleanUp();
    }

    restoreVis() {
        // restore visualization playback state, start visualization when playback is already running
        let player = app.player;
        if (!player.visualization.active) {
            return;
        }
        this.sd = player.getFastCurrentTrack(this.sd);
        if (!this.sd || this.sd.isVideo || _utils.isOnlineTrack(this.sd)) {
            return;
        }

        if (player.paused) {
            this._doOnPlaybackState('pause');
        } else if (player.isPlaying) {
            this.prepareVis();
            this._doOnPlaybackState('play');
        }
    }

    getVisFonts() {
        let bodycs = getComputedStyle(document.body, null);
        let bodyfnt = bodycs.fontFamily;
        let fs = parseFloat(bodycs.fontSize);
        return {
            big: {
                font: 'bold ' + Math.ceil(3 * fs) + 'px ' + bodyfnt,
                fontSize: Math.ceil(3 * fs)
            },
            middle: {
                font: Math.ceil(2.5 * fs) + 'px ' + bodyfnt,
                fontSize: Math.ceil(2.5 * fs)
            }
        };
    }
    prepareColors (style) {
        style = style || getComputedStyle(this.container, null);
        this._fillStyleText = style.getPropertyValue('--visTextColor') || 'white';
        this._textShadowColor = style.getPropertyValue('--visTextShadowColor') || 'yellow';
    }

    defaultRenderText (time, context) {
        this._fonts = this._fonts || this.getVisFonts();
        let diff = time - this._textStartTime;
        let txt1 = this._title;
        let txt2 = this._artist;
        context.save();
        context.fillStyle = this._fillStyleText;
        context.font = this._fonts.big.font;
        context.shadowColor = this._textShadowColor;
        context.shadowOffsetX = 1;
        context.shadowOffsetY = 1;
        context.shadowBlur = 6;
        context.textAlign = 'center';
        let txtW1 = context.measureText(txt1).width;
        context.font = this._fonts.middle.font;
        let txtW2 = context.measureText(txt2).width;
        context.font = this._fonts.big.font;
        let txtW = Math.max(txtW1, txtW2);
        let coef = 1;
        let gA = context.globalAlpha;
        if (diff < 1000) {
            coef = diff / 1000;
            context.globalAlpha = coef;
        } else if (diff >= this._textEndStart) {
            coef = (this._textDuration - diff) / 2000;
            context.globalAlpha = coef;
        }
        if (txtW > this._width) {
            coef = coef * this._width / txtW;
        }
        if (coef !== 1)
            context.scale(coef, coef);
        let coef2 = 2 * coef;
        let posX = this._width / coef2;
        let posY1 = this._height / coef2 - Math.floor(this._fonts.big.fontSize / 2);
        let posY2 = posY1 + this._fonts.big.fontSize;
        context.fillText(txt1, posX, posY1);
        context.font = this._fonts.middle.font;
        context.fillText(txt2, posX, posY2);
        context.globalAlpha = gA;
        context.restore();        
    }
    
    modeChanged(newMode) {
        // mode changed externally, update state
        this._currMode = newMode; // @ts-ignore
        this.container.isFullScreen = (newMode === window.videoModes.C_FULLSCREEN);
    }

    sendVisChanged(vis) {
        let evt = createNewCustomEvent('visVisibilityChanged', {
            detail: {
                visible: vis
            },
            bubbles: true,
            cancelable: true
        });
        this.container.dispatchEvent(evt);
    }

    /**
    Function called on every parent control size change

    @method onResizeHandler
    @param {Number} w New width of visualization parent control, in pixels.
    @param {Number} h New height of visualization parent control, in pixels.
    */
    onResizeHandler(w, h) {}

    /**
    Function called for visualization update. Make all vis. drawing actions here.

    @method onUpdateHandler
    @param {Object} visData {{#crossLink "VisResult"}}VisResult object{{/crossLink}} with visualization data. 
    */
    onUpdateHandler(visData) {}

    /**
    Function called when playback stopped or paused.

    @method onStopHandler
    */
    onStopHandler() {}

    /**
    Function called for possible drawing new track title and artist, after track change.

    @method onPaintTitle
    @param {string} title
    @param {string} artist
    */
    onPaintTitle(title, artist) {}


    
    get currMode() {
        return this._currMode;
    }
    set currMode(newMode) {
        if (newMode === this._currMode) {
            return;
        }
        if (this._currMode === window.videoModes.C_FULLSCREEN) {
            this.sd = app.player.getFastCurrentTrack(this.sd);
            if (!this.sd || !app.player.isPlaying || (!this.sd.isVideo && !_utils.isOnlineTrack(this.sd))) {
                //ODS('--- vis calling exitFullscreen, newMode=' + newMode);
                this.exitFullScreen();
            }
        }
        if (newMode === window.videoModes.C_FULLWINDOW) {
            this.prepareVis();
        } else if (newMode === window.videoModes.C_FULLSCREEN) {
            this.prepareVis();
            this.switchToFullScreen();
        } else {
            this.restoreMainWindow();
        }
        setVisibility(this.container, (newMode !== 'hidden'));
        this._currMode = newMode;
    }
    
}
registerClass(BaseVis);
