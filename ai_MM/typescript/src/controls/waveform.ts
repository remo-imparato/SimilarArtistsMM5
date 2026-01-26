
'use strict';


registerFileImport('controls/waveform');

/**
@module UI
*/


import Slider from './slider';


/**
UI Waveform element

@class Waveform
@constructor
@extends Control
*/

let cache = {
    lastTrack: {
        sd: undefined,
        values: undefined
    },
    currentTrack: {
        sd: undefined,
        values: undefined
    },
    nextTrack: {
        sd: undefined,
        values: undefined
    },
};

class Waveform extends Slider {
    _getWFPromise: Promise<any>;
    private _gettingWFforSD: Track;
    _visCanvas: HTMLCanvasElement;
    private _wasVisible: boolean;
    private _visCanvasCtx: any;
    _currState: any;
    private _fillStyle1: string;
    sd: Track;
    playLength: number;
    songLength: number;
    startTimeKoef: number;
    stopTimeKoef: number;
    isVideo: boolean;
    values: number[][];
    _getNextTimer: number;
    waveCalcCancelled: boolean;
    closing: boolean;
    _clearedCanvas: boolean;
    animateProgress: boolean;
    lastAnimate: any;

    initialize(parentel, params) {
        params = params || {};
        params.orientation = 'horizontal';
        params.invert = false;
        params.tickPlacement = 'none';
        params.mergeParentContextMenu = true;
        super.initialize(parentel, params);

        let _this = this;
        this.container.classList.add('no-cpu');
        this.container.classList.add('waveform');
        this._visCanvas = document.createElement('canvas');
        this._seekBar.appendChild(this._visCanvas);
        this._wasVisible = this.visible;
        this._currState = undefined;
        this._visCanvasCtx = null;

        let prepareColors = () => {
            let style = getComputedStyle(this.container, null);
            this._fillStyle1 = style.getPropertyValue('color') || 'white';
        };

        prepareColors();

        this.localListen(app, 'customLessChange', () => {
            this.requestFrame(() => { // has to be in the next frame, so styles are already updated
                prepareColors();
                this.redraw();
            }, 'customStyleUpdate');
        });

        this.handle_layoutchange();

        let player = app.player;

        // start visualization when playback is already running (e.g. skin was changed)
        if (player.paused)
            this.onPlaybackState('pause');
        else if (player.isPlaying)
            this.onPlaybackState('play');

        this.registerEventHandler('layoutchange');
        this.localListen(app, 'lesschange', function () {
            requestFrame(this.handle_layoutchange.bind(this)); // #18315 JL: Skin size settings
        }.bind(this)); 
        if (this.animateProgress)
            this.toggleAnimate(true);

        this.localListen(thisWindow, 'closequery', function (token) {
            if (this._getWFPromise && (this._getWFPromise.canceled === false) && (this._getWFPromise.finished === false)) {
                token.asyncResult = true;
                this.waveCalcCancelled = false;
                this.closing = true;
                this.cancelGetWaveform();
                let tm = Date.now();
                let _checkTerminated = () => {
                    if ((!this.waveCalcCancelled && (Date.now() - tm) < 1000)) { // limit time, to finish, when something went wrong and we are not in consistent state
                        requestTimeout(() => {
                            _checkTerminated();
                        }, 10);
                    } else {
                        //ODS('--- cancelled getWave');
                        token.resolved();
                    }
                };
                _checkTerminated();

            } else {
                token.resolved();
            }
        }.bind(this));

        this.addToContextMenu(function () {
            return [{
                action: {
                    title: _('Update waveform'),
                    execute: function () {
                        _this.cancelGetWaveform();
                        _this.clearWave();
                        _this.values = undefined;
                        if (cache.currentTrack.sd) {
                            if (cache.lastTrack.sd && cache.currentTrack.sd.isSame(cache.lastTrack.sd)) {
                                cache.lastTrack.values = undefined;
                                cache.lastTrack.sd = undefined;
                            }
                            if (cache.nextTrack.sd && cache.currentTrack.sd.isSame(cache.nextTrack.sd)) {
                                cache.nextTrack.values = undefined;
                                cache.nextTrack.sd = undefined;
                            }
                            cache.currentTrack.values = undefined;
                            cache.currentTrack.sd = undefined;
                        }
                        _this.updateWaveform(true);
                    },
                    visible: function () {
                        return !_this._getWFPromise;
                    }
                },
                order: 10,
                grouporder: 0
            }];
        });
        this.localListen(app, 'afterreload', function () {
            ODS('WF: after reload');
            _this.value = player.trackPositionMS / 1000.0;
            _this.requestTimeout(function () { // not sure why it sometimes draws "invisible waveform", postponing seems to help here
                _this.redraw();
            }, 50);
        });
    }

    updateWaveform(forceUpdate?:boolean) {
        let _this = this;
        if (_this.visible && !_this._getWFPromise && _this.playLength && !_this.isVideo && _this.sd.path != '') {
            if(!_this.values) {
                ODS('WF: ' + _this.uniqueID + ' ' + _this.container.getAttribute('data-id') + /*' ' + document._isEmbedded +*/ ': getting waveform for ' + _this.sd.path);
                let calledForSD = _this.sd;

                if (cache.lastTrack.sd && calledForSD.isSame(cache.lastTrack.sd) && !forceUpdate) {
                    // if lastTrack matches, then swap currentTrack for lastTrack
                    let lastSD = cache.currentTrack.sd;
                    let lastValues = cache.currentTrack.values;
                    cache.currentTrack.sd = cache.lastTrack.sd;
                    cache.currentTrack.values = cache.lastTrack.values;
                    cache.lastTrack.sd = lastSD;
                    cache.lastTrack.values = lastValues;

                    ODS('WF: ' + _this.uniqueID + ': got waveform from last-track cache, calling redraw for ' + _this.sd.path);
                    _this.values = cache.currentTrack.values;
                    _this.redraw();
                } else if (cache.currentTrack.sd && calledForSD.isSame(cache.currentTrack.sd) && !forceUpdate) {
                    ODS('WF: ' + _this.uniqueID + ': got waveform from current-track cache, calling redraw for ' + _this.sd.path);
                    _this.values = cache.currentTrack.values;
                    _this.redraw();
                } else if (cache.nextTrack.sd && calledForSD.isSame(cache.nextTrack.sd) && !forceUpdate) {
                    // put currentTrack into lastTrack & nextTrack into currentTrack
                    cache.lastTrack.sd = cache.currentTrack.sd;
                    cache.lastTrack.values = cache.currentTrack.values;
                    cache.currentTrack.sd = cache.nextTrack.sd;
                    cache.currentTrack.values = cache.nextTrack.values;

                    ODS('WF: ' + _this.uniqueID + ': got waveform from next-track cache, calling redraw for ' + _this.sd.path);
                    _this.values = cache.currentTrack.values;
                    _this.redraw();
                    _this.prepareNextWFData();
                }
                // if wf could not be found in cache
                else {
                    _this.getWaveformData(calledForSD, forceUpdate, (values) => {
                        if (!values || !_this.sd || !_this.sd.isSame(calledForSD)) {
                            calledForSD = undefined;
                            return;
                        }
                        _this.values = values;
                        ODS('WF: ' + _this.uniqueID + ': values set, calling redraw for ' + _this.sd.path);
                        _this.redraw();

                        // put current track cache values into last track cache
                        if (cache.currentTrack.sd && cache.currentTrack.values) {
                            cache.lastTrack.sd = cache.currentTrack.sd;
                            cache.lastTrack.values = cache.currentTrack.values;
                        }

                        // set current track cache values
                        cache.currentTrack.sd = calledForSD;
                        cache.currentTrack.values = values;
                        calledForSD = undefined;
                        _this.prepareNextWFData();
                    });
                }
            } else
                _this.redraw();
        }
    }

    prepareNextWFData() {
        let _this = this;
        if (this._getNextTimer) {
            clearTimeout(this._getNextTimer);
        }
        this._getNextTimer = setTimeout(function () {
            if (!_this._cleanUpCalled) {
                this._getNextTimer = undefined;
                let nextTrackSD = app.player.getNextTrack();
                if (nextTrackSD) {
                    ODS('WF: getting values for upcoming track');
                    _this.getWaveformData(nextTrackSD, false, (values) => {
                        if (!values) {
                            nextTrackSD = undefined;
                            return;
                        }
                        ODS('WF: ' + _this.uniqueID + ': values set for ' + nextTrackSD.path + ', saved to cache');
                        // put values and sd into next track cache
                        cache.nextTrack.sd = nextTrackSD;
                        cache.nextTrack.values = values;
                    });
                }
            }
        }, 1000);
    }

    getWaveformData(sd, forceUpdate, cb) {
        let _this = this;
        if (_this._getWFPromise) {
            _this.cancelGetWaveform();
        }
        _this._gettingWFforSD = sd;
        _this._getWFPromise = app.player.getWaveform(sd, !!forceUpdate);
        _this._getWFPromise.then(
            // on complete
            function (ret) {
                if (_this._gettingWFforSD && sd.isSame(_this._gettingWFforSD)) {
                    _this._getWFPromise = undefined;
                    _this._gettingWFforSD = undefined;
                }

                if (!ret) {
                    if (!_this.sd || _this.closing || sd.isSame(_this.sd)) {
                        _this.waveCalcCancelled = true;
                    }
                    //callback with error
                    ODS('WF: ' + _this.uniqueID + ' no waveform for ' + sd.path);
                    return cb();
                }
                let values = JSON.parse(ret);
                cb(values);
            },
            // on reject
            function () {
                if (!_this.sd || _this.closing || sd.isSame(_this.sd)) {
                    _this.waveCalcCancelled = true;
                }
                if (_this._gettingWFforSD && sd.isSame(_this._gettingWFforSD)) {
                    _this._getWFPromise = undefined;
                    _this._gettingWFforSD = undefined;
                }
                ODS('WF: ' + _this.uniqueID + ' refused waveform for ' + sd.path);
                cb();
            }
        );
    }

    onPlaybackState(state, sd?:Track) {
        let _this = this;
        switch (state) {
        case 'play':
        case 'unpause':
        case 'pause':
            this.disabled = window.settings.UI.disablePlayerControls['seek'];
            this.forceDisabled = this.disabled;
            this._currState = state;
            this.updateWaveform();
            break;
        case 'end':
        case 'stop':
            this.disabled = true;
            this.forceDisabled = true;
            this._currState = state;
            break;
        case 'trackChanged':
            this.dataSource = sd;
            if ((this._currState === 'play') || (this._currState === 'pause') || (this._currState === 'unpause')) {
                if (sd && (sd.path === '')) {
                    this.dataSourceListen(sd, 'change', () => {
                        if (sd.path !== '')
                            this.requestTimeout(() => {
                                this.updateWaveform();
                            }, 500, '_updateWaveFormTm');
                    });
                } else
                    this.updateWaveform();
            }
            break;
        }
    }

    toggleAnimate(anim) {
        if (!this.animateProgress)
            return;
        if (this.lastAnimate !== anim) {
            this.lastAnimate = anim;
            this._seekBarThumb.classList.toggle('animate', anim);
            this._seekBarBefore.classList.toggle('animate', anim);
        }
    }

    recheckSize(checkSecond) {
        let cs = window.getComputedStyle(this._seekBar, null);
        let w = Math.round(Math.abs(parseFloat(cs.getPropertyValue('width'))));
        let h = Math.round(Math.abs(parseFloat(cs.getPropertyValue('height'))));
        if((this._visCanvas.width !== w) || (this._visCanvas.height !== h) || (this.visible !== this._wasVisible)) {
            ODS('--- layouchange after recheckSize, new size ' + w + 'x' + h);
            this.handle_layoutchange();
        } else if(!checkSecond) {
            this.requestTimeout(this.recheckSize.bind(this, true), 100, 'recheckSize'); // to be sure, it seems it could sometimes be needed
        }
    }

    redraw(changedVisibility?:boolean) {
        if (!this.sd || !this._wasVisible || this.isVideo || !this._visCanvasCtx || !this._visCanvas.width || !this._visCanvas.height)
            return;
        let x = 0;
        let yMin = 0;
        let yMax = 0;
        this.clearWave();
        if (this.values) {
            ODS('--- WF ' + this.uniqueID + ': drawing to (' + this._visCanvas.width + ', ' + this._visCanvas.height + '), ' + this.sd.path);
            this._visCanvasCtx.beginPath();
            this._visCanvasCtx.lineWidth = '1';
            this._visCanvasCtx.strokeStyle = this._fillStyle1;
            let xMin = Math.round(this.startTimeKoef*this.values.length);
            let xMax = Math.round(this.stopTimeKoef*this.values.length);
            if(xMax<=xMin)
                return;
            let stepX = this._visCanvas.width / (xMax-xMin);
            let stepY = this._visCanvas.height / 65535;
            for (let i = xMin; i < xMax; i++) {
                yMin = this._visCanvas.height - stepY * (this.values[i][0] + 32768);
                yMax = this._visCanvas.height - stepY * (this.values[i][1] + 32768);
                this._visCanvasCtx.moveTo(x, yMin);
                this._visCanvasCtx.lineTo(x, yMax);
                x += stepX;
            }
            this._visCanvasCtx.stroke();
            this._clearedCanvas = false;
            this.requestTimeout(this.recheckSize.bind(this), 10, 'recheckSize');
        } else if (changedVisibility) {
            //ODS('--- WF ' + this.uniqueID + ': redraw - called ' + this._currState + ' for ' + this.sd.path);
            this.onPlaybackState(this._currState);
        } // else
        //ODS('--- WF ' + this.uniqueID +': redraw - do nothing for ' + this.sd.path);
    }

    handle_layoutchange(evt?) {
        let wasVis = this._wasVisible;
        this._wasVisible = this.visible;
        if (this._wasVisible && this._visCanvas) {
            let cs = window.getComputedStyle(this._seekBar, null);
            let w = Math.round(Math.abs(parseFloat(cs.getPropertyValue('width'))));
            let h = Math.round(Math.abs(parseFloat(cs.getPropertyValue('height'))));

            if (!wasVis || (this._visCanvas.width !== w) || (this._visCanvas.height !== h)) {
                applyStylingAfterFrame(() => {
                    cs = window.getComputedStyle(this._seekBar, null);
                    w = Math.round(Math.abs(parseFloat(cs.getPropertyValue('width'))));
                    h = Math.round(Math.abs(parseFloat(cs.getPropertyValue('height'))));        
                    this._visCanvas.width = w;
                    this._visCanvas.height = h;
                    this._visCanvasCtx = this._visCanvas.getContext('2d');
                    this._wasVisible = this.visible;
                    this.redraw(this._wasVisible !== wasVis);
                    super.handle_layoutchange(evt);
                });
            } else if (!this.values) {
                this.redraw(this._wasVisible !== wasVis);
                super.handle_layoutchange(evt);
            } else {
                super.handle_layoutchange(evt);
            }
        } else
            super.handle_layoutchange(evt);
    }

    clearWave() {
        if (!this._clearedCanvas && this._visCanvasCtx) {
            this._visCanvasCtx.clearRect(0, 0, this._visCanvas.width, this._visCanvas.height);
            this._clearedCanvas = true;
        }
    }

    cancelGetWaveform() {
        if (this._getWFPromise) {
            cancelPromise(this._getWFPromise);
            this._getWFPromise = undefined;
        }
        if (this._getNextTimer) {
            clearTimeout(this._getNextTimer);
            this._getNextTimer = undefined;
        }        
    }

    valueUpdate() {
        if(!this.sd)
            return;
        this.playLength = this.sd.playLength;
        this.songLength = this.sd.songLength;
        if(this.songLength) {
            this.startTimeKoef = this.sd.startTime/this.songLength;
            this.stopTimeKoef = (this.sd.startTime+this.playLength)/this.songLength;
            if(this.stopTimeKoef>1)
                this.stopTimeKoef = 1;
            if(this.stopTimeKoef<0)
                this.stopTimeKoef = 0;
            if(this.startTimeKoef>1)
                this.startTimeKoef = 1;
            if(this.startTimeKoef<0) 
                this.startTimeKoef = 0;
        } else {
            this.startTimeKoef = 0;
            this.stopTimeKoef = 1;
        }

        this.max = this.playLength / 1000.0;
        this.updateWaveform();
    }

    cleanUp() {
        this.cancelGetWaveform();
        super.cleanUp();
    }

    get dataSource () {
        return this.sd;
    }
    set dataSource (sd) {
        if ((!this.sd && !sd) || (this.sd && sd && this.sd.isSame(sd)))
            return;
        this.dataSourceUnlistenFuncts();
        this.sd = sd;
        this.cancelGetWaveform();
        this.clearWave();
        this.values = undefined;
        if (!this.sd) {
            this.playLength = 0;
            this.songLength = 0;
            this.max = 0;
            this.startTimeKoef = 0;
            this.stopTimeKoef = 1;
            return;
        }
        this.isVideo = this.sd.isVideo || _utils.isYoutubeTrack(this.sd);
        //ODS('WF: ' + this.uniqueID + ': dataSource= ' + this.sd.path);
        this.valueUpdate();
        this.dataSourceListen(this.sd, 'change', this.valueUpdate.bind(this));
    }
    
}
registerClass(Waveform);
