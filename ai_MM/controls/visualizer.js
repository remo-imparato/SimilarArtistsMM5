/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

'use strict';
registerFileImport('controls/visualizer');
/**
@module UI
*/
import Control from './control';
const modes = ['off', 'bars'];
const MODE_OFF = 0;
const MODE_BARS = 1;
const MODE_OSC = 2; // removed #12956
const MODE_DIVS = 3; // removed now, #12956
const BANDCOUNT_LOW = 5;
const BANDCOUNT_HIGH = 20;
/**
UI Visualizer element

@class Visualizer
@constructor
@extends Control
*/
class Visualizer extends Control {
    initialize(parentel, params) {
        super.initialize(parentel, params);
        let _this = this;
        this.container.classList.add('no-cpu');
        this.container.classList.add('clickable');
        this._BAR1DASHHEIGHT = 3.0;
        this._BAR1SPACEHEIGHT = 1.0;
        this._BAR1HEIGHT = (this._BAR1DASHHEIGHT + this._BAR1SPACEHEIGHT);
        this._FALL_DUR = 450.0;
        this._lastVisData = null;
        this._lastTime = 0;
        this._bandcount = BANDCOUNT_HIGH;
        app.player.visualization.spectrumSections = this._bandcount;
        this._gapsize = 2;
        this._barwidth = 10;
        this._maxHeight = 100;
        this._maxWidth = 800;
        this._width = 0;
        this._height = 0;
        this._visCanvas = document.createElement('canvas');
        this._nonvisCanvas = document.createElement('canvas');
        this.container.appendChild(this._visCanvas);
        this._visCanvasCtx = null;
        this._nonvisCanvasCtx = null;
        let prepareColors = () => {
            let style = getComputedStyle(this.container, null);
            this._fillStyle1 = style.getPropertyValue('color') || 'white';
            this._fillStyle2 = style.getPropertyValue('--visPeaksColor') || 'yellow';
        };
        prepareColors();
        this._mode = MODE_BARS;
        this.setEnable(true);
        this._waitforupdate = false;
        let currState = 'stop';
        let MAXSPECVAL = 8192;
        let INERTIAKOEF = MAXSPECVAL / this._FALL_DUR;
        // set passed attributes
        for (let key in params) {
            this[key] = params[key];
        }
        this.handle_layoutchange();
        let onClick = function () {
            let newMode = _this._mode + 1;
            if (newMode >= modes.length)
                newMode = 0;
            _this.mode = newMode;
        };
        this.localListen(this.container, 'click', onClick);
        this.localListen(app, 'customLessChange', () => {
            this.requestFrame(() => {
                prepareColors();
            }, 'customStyleUpdate');
        });
        let player = app.player;
        this.vis = player.visualization;
        this.vis.registerVisTypes(['spectrum', 'oscilloscope']);
        this.lasttm = 0;
        let val, visData, oscData, _visData, _oscData, x, y, h;
        let tm, currData;
        let ticks, maxDiff;
        let stepX;
        let requpdate = function (delay) {
            _this.requestTimeout(function () {
                if ((currState === 'play') && !_this._waitforupdate) {
                    _this._waitforupdate = true;
                    requestAnimationFrameMM(_this.update);
                }
            }, delay, 'reqUpdate');
        };
        this.update = function () {
            _this._waitforupdate = false;
            if (!this.vis || !this.isOurTrack || (currState !== 'play') || !this._isVisible || this._isHidden || (_this._mode === MODE_OFF))
                return;
            if ((!_this._visCanvasCtx || !_this._nonvisCanvas.width || !_this._nonvisCanvas.height) && ((_this._mode === MODE_OSC) || (_this._mode === MODE_BARS))) {
                requpdate(200);
                return;
            }
            tm = player.trackPositionMS;
            currData = this.vis.getNextResult(tm, currData);
            if (currData /* && (Math.abs(currData.timestamp - tm) <= 500)*/) {
                // add some inertia
                if ((_this._mode !== MODE_OSC)) {
                    _visData = currData.getSpectrumValues(_visData);
                    visData = new Float64Array(_visData);
                    if (!_this._lastVisData) {
                        _this._lastVisData = visData.slice();
                    }
                    else {
                        ticks = Date.now();
                        maxDiff = ticks - _this._lastTime;
                        if (maxDiff >= _this._FALL_DUR)
                            maxDiff = MAXSPECVAL;
                        else
                            maxDiff = INERTIAKOEF * maxDiff;
                        _this._lastTime = ticks;
                        for (let i = 0; i < visData.length; i++) {
                            val = visData[i];
                            if (val < (_this._lastVisData[i] - maxDiff)) {
                                val = _this._lastVisData[i] - maxDiff;
                                visData[i] = val;
                            }
                            _this._lastVisData[i] = val;
                        }
                    }
                }
                // draw frame
                x = 0;
                if (_this._mode === MODE_OSC) {
                    _oscData = currData.getOscValues(_oscData);
                    oscData = new Int32Array(_oscData);
                    val = oscData[0];
                    y = (Math.abs(val) >> 16) / 65536;
                    if (val < 0)
                        y = -y;
                    y = _this._maxHeight / 2 - y * _this._maxHeight;
                    _this._visCanvasCtx.clearRect(0, 0, _this._visCanvas.width, _this._visCanvas.height);
                    _this._visCanvasCtx.beginPath();
                    _this._visCanvasCtx.lineWidth = '1';
                    _this._visCanvasCtx.strokeStyle = _this._fillStyle1;
                    _this._visCanvasCtx.moveTo(x, y);
                    stepX = _this._maxWidth / oscData.length;
                    for (let i = 1; i < oscData.length; i++) {
                        val = oscData[i];
                        y = (Math.abs(val) >> 16) / 65536;
                        if (val < 0)
                            y = -y;
                        y = _this._maxHeight / 2 - y * _this._maxHeight;
                        x += stepX;
                        _this._visCanvasCtx.lineTo(x, y);
                    }
                    _this._visCanvasCtx.stroke();
                }
                else if (_this._mode === MODE_BARS) {
                    _this._nonvisCanvasCtx.fillStyle = _this._fillStyle1;
                    _this._nonvisCanvasCtx.clearRect(0, 0, _this._nonvisCanvas.width, _this._nonvisCanvas.height);
                    for (let i = 0; i < visData.length; i++) {
                        h = Math.min(Math.round(_this._height * (visData[i]) / MAXSPECVAL), _this._maxHeight) - _this._BAR1DASHHEIGHT - _this._BAR1SPACEHEIGHT;
                        _this._nonvisCanvasCtx.fillRect(x, _this._height - h, _this._barwidth, h);
                        x += _this._barwidth + _this._gapsize;
                    }
                    for (y = _this._height - _this._BAR1DASHHEIGHT - _this._BAR1SPACEHEIGHT; y > 0; y -= _this._BAR1DASHHEIGHT + _this._BAR1SPACEHEIGHT) {
                        _this._nonvisCanvasCtx.clearRect(0, y, _this._width, _this._BAR1SPACEHEIGHT);
                    }
                    _this._nonvisCanvasCtx.fillStyle = _this._fillStyle2;
                    x = 0;
                    for (let i = 0; i < visData.length; i++) {
                        h = Math.min(Math.round(_this._height * (visData[i]) / MAXSPECVAL), _this._maxHeight);
                        _this._nonvisCanvasCtx.fillRect(x, _this._height - h, _this._barwidth, Math.min(h, _this._BAR1DASHHEIGHT));
                        x += _this._barwidth + _this._gapsize;
                    }
                    _this._visCanvasCtx.clearRect(0, 0, _this._visCanvas.width, _this._visCanvas.height);
                    _this._visCanvasCtx.drawImage(_this._nonvisCanvas, 0, 0);
                }
                else if (_this._mode === MODE_DIVS) {
                    for (let i = 0; i < _this._bandcount; i++) {
                        h = _this._height - Math.min(Math.round(_this._height * (visData[i]) / MAXSPECVAL), _this._height);
                        _this._divs[i].style.top = h + 'px';
                    }
                }
                requpdate(30);
            }
            else {
                requpdate(200);
            }
        }.bind(this);
        this.onPlaybackState = function (state) {
            switch (state) {
                case 'unpause':
                case 'play':
                    if (currState !== 'play') {
                        currState = 'play';
                        _this.sd = player.getFastCurrentTrack(_this.sd);
                        if (!_this.sd || _this.sd.isVideo || _utils.isOnlineTrack(_this.sd)) {
                            _this.isOurTrack = false;
                            _this.clearVis();
                            return;
                        }
                        _this.isOurTrack = true;
                        if (!_this._waitforupdate)
                            _this.update();
                    }
                    break;
                case 'stop':
                case 'pause':
                case 'end':
                    currState = state;
                    _this.clearVis();
                    break;
            }
        };
        app.listen(player, 'playbackState', this.onPlaybackState);
        // start visualization when playback is already running (e.g. skin was changed)
        if (player.paused)
            this.onPlaybackState('pause');
        else if (player.isPlaying)
            this.onPlaybackState('play');
        this.registerEventHandler('layoutchange');
        this.localListen(thisWindow, 'visibilitychanged', function (minimized, hidden) {
            if (_this._isHidden !== (minimized || hidden)) {
                _this._isHidden = (minimized || hidden);
                _this.refreshVisibility();
            }
        });
    }
    refreshVisibility() {
        this._isVisible = this.visible;
        if (this._isVisible && this._visCanvasCtx && !this._waitforupdate && !this._isHidden) {
            this.update();
        }
    }
    handle_layoutchange(evt) {
        this.refreshVisibility();
        if (this._isVisible && !this._isHidden && this._visCanvas) {
            let cs = window.getComputedStyle(this.container, null);
            let w = Math.round(Math.abs(parseFloat(cs.getPropertyValue('width'))));
            let h = Math.round(Math.abs(parseFloat(cs.getPropertyValue('height'))));
            if (w > this._maxWidth) {
                this._visCanvas.style.left = (Math.round((w - this._maxWidth) / 2)).toString();
            }
            else {
                this._visCanvas.style.left = '0';
            }
            w = Math.min(w, this._maxWidth);
            this._height = h;
            this._width = w;
            this._maxHeight = this._height;
            this._barwidth = Math.floor((this._width - this._gapsize * (this._bandcount - 1)) / this._bandcount);
            if (this._barwidth < 1)
                this._barwidth = 1;
            if ((this._mode === MODE_BARS) || (this._mode === MODE_OSC)) {
                if ((this._visCanvas.width !== w) || (this._visCanvas.height !== h)) {
                    this._visCanvas.width = w;
                    this._visCanvas.height = h;
                    this._nonvisCanvas.width = w;
                    this._nonvisCanvas.height = h;
                    this._visCanvasCtx = this._visCanvas.getContext('2d');
                    this._nonvisCanvasCtx = this._nonvisCanvas.getContext('2d');
                }
            }
        }
        if (evt)
            super.handle_layoutchange(evt);
    }
    clearVis() {
        if (this._visCanvasCtx) {
            this._visCanvasCtx.clearRect(0, 0, this._visCanvas.width, this._visCanvas.height);
            this._nonvisCanvasCtx.clearRect(0, 0, this._nonvisCanvas.width, this._nonvisCanvas.height);
        }
        if (this._divsParent) {
            for (let i = 0; i < this._bandcount; i++) {
                this._divs[i].style.top = this._height + 'px';
            }
        }
    }
    cleanUp() {
        app.unlisten(app.player, 'playbackState', this.onPlaybackState);
        this.vis.unregisterVisTypes(['spectrum', 'oscilloscope']);
        super.cleanUp();
    }
    storePersistentState() {
        let state = {
            mode: this.mode,
        };
        return state;
    }
    restorePersistentState(state) {
        if ((state.mode !== undefined) && (state.mode >= 0) && (state.mode < modes.length)) {
            this.mode = state.mode;
        }
    }
    setEnable(value) {
        if (value)
            this.container.setAttribute('data-checked', '1');
        else
            this.container.removeAttribute('data-checked');
    }
    get maxWidth() {
        return this._maxWidth;
    }
    set maxWidth(val) {
        this._maxWidth = val;
    }
    get maxHeight() {
        return this._maxHeight;
    }
    set maxHeight(val) {
        this._maxHeight = val;
    }
    get mode() {
        return this._mode;
    }
    set mode(val) {
        if (val === this._mode)
            return;
        let lastMode = this._mode;
        this._mode = val;
        if (this._mode === MODE_OFF) {
            this.clearVis();
        }
        else {
            if (this._mode === MODE_DIVS) {
                setVisibility(this._visCanvas, false);
                if (!this._divsParent) {
                    this._divsParent = document.createElement('div');
                    this._divsParent.className = 'fill noOverflow';
                    this._divs = [];
                    for (let i = 0; i < this._bandcount; i++) {
                        this._divs[i] = document.createElement('div');
                        this._divs[i].style.display = 'inline-block';
                        this._divs[i].style.position = 'absolute';
                        this._divs[i].style.width = '1px';
                        this._divs[i].style.height = '100%';
                        this._divs[i].style.left = i * 2 + 'px';
                        this._divs[i].style.top = this._height + 'px';
                        this._divs[i].style.backgroundColor = this._fillStyle2;
                        this._divsParent.appendChild(this._divs[i]);
                    }
                    this.container.appendChild(this._divsParent);
                }
                else
                    setVisibility(this._divsParent, true);
            }
            else {
                if (this._divsParent)
                    setVisibility(this._divsParent, false);
                setVisibility(this._visCanvas, true);
                this.handle_layoutchange();
            }
        }
        this.setEnable(val !== MODE_OFF);
        if ((lastMode === MODE_OFF) && !this._waitforupdate)
            this.update();
    }
}
registerClass(Visualizer);
