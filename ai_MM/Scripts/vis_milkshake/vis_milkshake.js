/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

/**
@module UI
*/

requirejs('controls/baseVis');
localRequirejs('milkshake');

/**
UI Visualizer element - Milkshake.

@class Vis_milkshake
@constructor
@extends BaseVis
*/

class Vis_milkshake extends BaseVis {

    initialize(parentel, params) {
        super.initialize(parentel, params);
        app.player.visualization.registerVisTypes(['oscilloscope']);
        var _this = this;
        this.presetChangeDuration = 15000;
        this.presetChangeTimer = undefined;

        var screenWidth = 0;
        var screenHeight = 0;
        var music;
        var screen;
        var musicData = {
            frameCount: 0,
            waveData: [],
        };

        var canvas = document.createElement("canvas");
        canvas.style.marginTop = "auto";
        canvas.style.marginBottom = "auto";
        canvas.style.position = "absolute";
        canvas.style.backgroundColor = "black";
        canvas.style.zIndex = 0;

        var overlayCanvas = document.createElement("canvas");
        var overlayCtx = overlayCanvas.getContext("2d");
        overlayCanvas.style.position = "absolute";
        overlayCanvas.style.zIndex = 1;

        this.setScreen = function (screenEl) {
            if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
            if (overlayCanvas.parentNode) overlayCanvas.parentNode.removeChild(overlayCanvas);
            if (screenEl) {
                screenEl.appendChild(canvas);
                screenEl.appendChild(overlayCanvas);
            }
            screen = screenEl;
        }

        this.setDimensions = function (w, h) {
            if (!screen || ((screenWidth === w) && (screenHeight === h)))
                return;
            screenWidth = w;
            screenHeight = h;

            canvas.width = overlayCanvas.width = screenWidth;
            canvas.height = overlayCanvas.height = screenHeight;
            canvas.style.width = overlayCanvas.style.width = screenWidth + "px";
            canvas.style.height = overlayCanvas.style.height = screenHeight + "px";
            if (milk.shaker) {
                milk.shaker.resize(w, h);
            };
        }

        this.setScreen(parentel);
        this.setDimensions(parentel.offsetWidth, parentel.offsetHeight);

        var currentPresetPos = 0;
        var currentPreset = '';

        var sett = app.getValue('vis_milkshake', {});
        currentPresetPos = sett.currentPresetPos || 0;
        currentPreset = sett.currentPreset;
        if (milk.init(canvas, musicData, currentPresetPos))
            ODS('Vis_milkshake: visualization engine initialized');

        let optSett = window.settings.get();    
        if (optSett.System.DisableGPU) {
            uitools.toastMessage.show(_('Milkshake requires Hardware Acceleration to be enabled'), {
                button: {
                    caption: _('Options'),
                    onClick: () => { 
                        uitools.showOptions('pnl_Performance');
                    }
                },
                delay: 5000
            });    
        }   

        var fps = 0;
        var frameHist = [];
        var fonts = this.getVisFonts();
        var textEndStart = (this._textDuration - 2000);

        var renderText = function (time) {
            var context = overlayCtx;
            context.clearRect(0, 0, context.canvas.width, context.canvas.height);
            var diff = time - _this._textStartTime;
            var txt1 = _this._title;
            var txt2 = _this._artist;
            context.save(); 
            context.fillStyle = 'white';
            context.font = fonts.big.font;
            context.shadowColor = _this._textShadowColor;
            context.shadowOffsetX = 1;
            context.shadowOffsetY = 1;
            context.shadowBlur = 6;
            context.textAlign = 'center';
            var txtW1 = context.measureText(txt1).width;
            context.font = fonts.middle.font;
            var txtW2 = context.measureText(txt2).width;
            context.font = fonts.big.font;
            var txtW = Math.max(txtW1, txtW2);
            var coef = 1;
            var gA = context.globalAlpha;
            if (diff < 1000) {
                coef = diff / 1000;
                context.globalAlpha = coef;
            } else if (diff >= textEndStart) {
                coef = (_this._textDuration - diff) / 2000;
                context.globalAlpha = coef;
            }
            if (txtW > _this._width) {
                coef = coef * _this._width / txtW;
            }
            if (coef !== 1)
                context.scale(coef, coef);
            var coef2 = 2 * coef;
            var posX = _this._width / coef2;
            var posY1 = _this._height / coef2 - Math.floor(fonts.big.fontSize / 2);
            var posY2 = posY1 + fonts.big.fontSize;
            context.fillText(txt1, posX, posY1);
            context.font = fonts.middle.font;
            context.fillText(txt2, posX, posY2);
            context.globalAlpha = gA;
            context.restore();
        };

        var renderFPS = function (time, doClear) {
            if (!_this.lastFrameTime) {
                _this.lastFrameTime = time;
                frameHist = [];
                return;
            }
            var frameTime = time - _this.lastFrameTime;
            _this.lastFrameTime = time;

            if (frameHist.length > 30)
                frameHist.shift();
            frameHist.push(frameTime);
            var totalFrameTime = 0;
            frameHist.forEach((x) => {
                totalFrameTime += x;
            });
            if (totalFrameTime > 0)
                fps = Math.round(1000 * frameHist.length / totalFrameTime);
            var context = overlayCtx;
            if (doClear)
                context.clearRect(0, 0, context.canvas.width, context.canvas.height);
            context.save();
            context.fillStyle = 'white';
            context.shadowColor = _this._textShadowColor;
            context.shadowOffsetX = 1;
            context.shadowOffsetY = 1;
            context.shadowBlur = 3;
            context.font = fonts.middle.font;
            context.fillText('fps: ' + fps, 8, 5 + fonts.middle.fontSize);
            context.restore();
        };

        this.updateVis = function (visData) {
            if (!screen) {
                _this.setScreen(parentel);
                _this.setDimensions(parentel.offsetWidth, parentel.offsetHeight);
            }
            var _waveData = musicData._waveData = visData.getNormalizedOscValues(musicData._waveData);
            var waveData = musicData.waveData = new Float64Array(musicData._waveData);

            if (waveData.length == 1024) {
                musicData.waveDataL = waveData.slice(0, 512);
                musicData.waveDataR = waveData.slice(512);
            } else {
                musicData.waveDataL = musicData.waveDataR = musicData.waveData;
            }

            musicData.frameCount++;
            musicData.position = visData.timestamp;
            if (milk.shaker) {
                milk.shaker.music.addPCM(musicData.waveDataL, musicData.waveDataR);
                if (musicData.waveDataL) {
                    milk.shaker.renderFrame.call(milk.shaker);
                };
                if (!_this.presetChangeTimer && _this.automaticPresetChange) {
                    _this.presetChangeTimer = _this.requestTimeout(_this.nextPreset.bind(_this), _this.presetChangeDuration);
                }
                var time = Date.now();
                var displayText = (_this._textStartTime && (time <= (_this._textStartTime + _this._textDuration)));
                if (_this.showingFPSInfo || displayText) {
                    if (!_this._overlayCanvasVisible) {
                        setVisibilityFast(overlayCanvas, true);
                        _this._overlayCanvasVisible = true;
                    }
                    if (displayText)
                        renderText(time);
                    if (_this.showingFPSInfo)
                        renderFPS(time, !displayText);
                    else
                        _this.lastFrameTime = undefined;
                } else {
                    if (_this._overlayCanvasVisible) {
                        setVisibilityFast(overlayCanvas, false);
                        _this._overlayCanvasVisible = false;
                    }
                }

            };
            //var time = Date.now();
        };

        var getPresetMenuItems = function () {
            return new Promise(function (resolve, reject) {
                var menuitems = new Array();
                var pNames = milk.presetNames;
                if (pNames) {
                    for (var i = 0; i < pNames.length; i++) {
                        var pname = pNames[i];
                        var act = {
                            title: pname,
                            presetPos: i,
                            execute: function () {
                                currentPresetPos = this.presetPos;
                                currentPreset = this.title;
                                var sett = {
                                    currentPresetPos: currentPresetPos,
                                    currentPreset: currentPreset
                                };
                                app.setValue('vis_milkshake', sett);
                                clearTimeout(_this.presetChangeTimer);
                                _this.presetChangeTimer = undefined;
                                milk.presetPos = this.presetPos;
                            },
                            checked: function () {
                                return (currentPresetPos === this.presetPos);
                            }
                        };
                        menuitems.push({
                            action: act,
                            order: i + 1,
                            grouporder: 10
                        });
                    };
                };
                resolve(menuitems);
            });
        };

        window.uitools.visMenuItems = window.uitools.VisMenuItems || {};
        window.uitools.visMenuItems['Vis_milkshake'] = [{
            title: _('Select preset'),
            submenu: getPresetMenuItems
        }];
    }

    cleanUp() {
        this.clearVis();
        app.player.visualization.unregisterVisTypes(['oscilloscope']);
        window.uitools.visMenuItems['Vis_milkshake'] = undefined;
        super.cleanUp();
    }

    clearVis() {
        if (this.setScreen)
            this.setScreen(undefined);
    }

    onResizeHandler(w, h) {
        if (this.setDimensions)
            this.setDimensions(w, h);
    }

    onUpdateHandler(visData) {
        if (this.updateVis)
            this.updateVis(visData);
    }

    onStopHandler() {
        if (this.presetChangeTimer) {
            clearTimeout(this.presetChangeTimer);
            this.presetChangeTimer = undefined;
        }
        this.clearVis();
    }

    onPaintTitle(title, artist) {
        this._title = title;
        this._artist = artist;
        this._textStartTime = Date.now();
    }

    nextPreset() {
        if (!this.automaticPresetChange) {
            this.presetChangeTimer = undefined;
            return;
        }
        milk.presetPos = Math.floor((Math.random() * milk.presetNames.length));
        this.presetChangeTimer = this.requestTimeout(this.nextPreset.bind(this), this.presetChangeDuration);
    }

}
registerClass(Vis_milkshake);
