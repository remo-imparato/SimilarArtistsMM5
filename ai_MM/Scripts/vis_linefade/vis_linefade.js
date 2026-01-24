/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

/**
@module UI
*/

requirejs('controls/baseVis');

/**
UI Visualizer element - line fade.

@class Vis_linefade
@constructor
@extends BaseVis
*/

class Vis_linefade extends BaseVis {

    initialize(parentel, params) {
        super.initialize(parentel, params);
        this._visCanvas = document.createElement('canvas');
        this._nonvisCanvas = document.createElement('canvas');
        this.container.appendChild(this._visCanvas);
        this._visCanvasCtx = null;
        this._nonvisCanvasCtx = null;

        this._visCanvas.classList.add('textColor'); // adds also background
        this._lineWidth = 2;
        this._dataSize = 64;
        this._dataL = Array(this._dataSize);
        this._dataR = Array(this._dataSize);
        for (var i = 0; i < this._dataSize; i++) {
            this._dataL[i] = 0;
            this._dataR[i] = 0;
        };
        app.player.visualization.registerVisTypes(['vumeter']);
    }

    prepareColors (style) {
        style = style || getComputedStyle(this.container, null);
        this._fillStyle1 = style.getPropertyValue('color') || 'white';
        this._fillStyle2 = style.getPropertyValue('--visPeaksColor') || 'yellow';
        super.prepareColors(style);
    }

    cleanUp() {
        this.clearVis();
        app.player.visualization.unregisterVisTypes(['vumeter']);
        if (this._visCanvas && (this._visCanvas.parentNode === this.container)) {
            this.container.removeChild(this._visCanvas);
        };
        super.cleanUp();
    }

    clearVis() {
        for (var i = 0; i < this._dataSize; i++) {
            this._dataL[i] = 0;
            this._dataR[i] = 0;
        }
        if (this._visCanvasCtx)
            this._visCanvasCtx.clearRect(0, 0, this._visCanvas.width, this._visCanvas.height);
        if (this._nonvisCanvasCtx)
            this._nonvisCanvasCtx.clearRect(0, 0, this._nonvisCanvas.width, this._nonvisCanvas.height);
    }

    onResizeHandler(w, h) {
        if (this._visCanvas) {
            if ((this._visCanvas.width === w) && (this._visCanvas.height === h))
                return;
            this._visCanvas.width = w;
            this._visCanvas.height = h;
            this._nonvisCanvas.width = w;
            this._nonvisCanvas.height = h;
            this._visCanvasCtx = this._visCanvas.getContext('2d');
            this._nonvisCanvasCtx = this._nonvisCanvas.getContext('2d');
            this._lineWidth = Math.max(Math.ceil(w / 512) - 1, 1);
        }
    }

    onUpdateHandler(visData) {
        if (!this._visCanvas) // not initialized yet
            return;
        if (!this._visCanvasCtx) {
            this.onResizeHandler(this._width, this._height);
        }
        var i;

        // draw frame        
        var l = visData.maxLeft;
        var r = visData.maxRight;
        var halfHeight = Math.floor(this._height / 2);
        var halfWidth = Math.floor(this._width / 2);
        for (var i = this._dataSize - 2; i >= 0; i--) {
            this._dataL[i + 1] = 0.97 * this._dataL[i];
            this._dataR[i + 1] = 0.97 * this._dataR[i];
        }
        this._dataL[0] = Math.max(l - 4096, 0) / 28672;
        this._dataR[0] = Math.max(r - 4096, 0) / 28672;
        var x = halfWidth;
        var val = this._dataL[0];
        var y = halfHeight - val * halfHeight;
        this._visCanvasCtx.clearRect(0, 0, this._visCanvas.width, this._visCanvas.height);
        this._visCanvasCtx.beginPath();
        this._visCanvasCtx.lineWidth = this._lineWidth;
        this._visCanvasCtx.strokeStyle = this._fillStyle1;
        this._visCanvasCtx.moveTo(x, y);
        var stepX = halfWidth / this._dataSize;
        for (var i = 1; i < this._dataSize; i++) {
            val = this._dataL[i];
            y = halfHeight - val * halfHeight;
            x += stepX;
            this._visCanvasCtx.lineTo(x, y);
        }
        val = this._dataR[0];
        x = halfWidth;
        y = val * halfHeight + halfHeight;
        this._visCanvasCtx.moveTo(x, y);
        for (var i = 1; i < this._dataSize; i++) {
            val = this._dataR[i];
            y = val * halfHeight + halfHeight;
            x += stepX;
            this._visCanvasCtx.lineTo(x, y);
        }
        x = halfWidth;
        val = this._dataL[0];
        y = halfHeight - val * halfHeight;
        this._visCanvasCtx.moveTo(x, y);
        stepX = halfWidth / this._dataSize;
        for (var i = 1; i < this._dataSize; i++) {
            val = this._dataL[i];
            y = halfHeight - val * halfHeight;
            x -= stepX;
            this._visCanvasCtx.lineTo(x, y);
        }
        val = this._dataR[0];
        x = halfWidth;
        y = val * halfHeight + halfHeight;
        this._visCanvasCtx.moveTo(x, y);
        for (var i = 1; i < this._dataSize; i++) {
            val = this._dataR[i];
            y = val * halfHeight + halfHeight;
            x -= stepX;
            this._visCanvasCtx.lineTo(x, y);
        }

        this._visCanvasCtx.stroke();
        var time = Date.now();
        if (this._textStartTime && (time <= (this._textStartTime + this._textDuration)))
            this.defaultRenderText(time, this._visCanvasCtx);
    }

    onStopHandler() {
        this.clearVis();
    }

    onPaintTitle(title, artist) {
        this._title = title;
        this._artist = artist;
        this._textStartTime = Date.now();
    }
}
registerClass(Vis_linefade);