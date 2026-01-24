/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

/**
@module UI
*/

requirejs('controls/baseVis');

/**
UI Visualizer element - oscillator.

@class Vis_oscillator
@constructor
@extends BaseVis
*/

class Vis_oscillator extends BaseVis {

    initialize(parentel, params) {
        super.initialize(parentel, params);
        this._visCanvas = document.createElement('canvas');
        this._nonvisCanvas = document.createElement('canvas');
        this.container.appendChild(this._visCanvas);
        this._visCanvasCtx = null;
        this._nonvisCanvasCtx = null;
       
        this._visCanvas.classList.add('textColor'); // adds also background
        this._lineWidth = 2;
        app.player.visualization.registerVisTypes(['oscilloscope']);
    }

    prepareColors (style) {
        style = style || getComputedStyle(this.container, null);
        this._fillStyle1 = style.getPropertyValue('color') || 'white';
        this._fillStyle2 = style.getPropertyValue('--visPeaksColor') || 'yellow';
        super.prepareColors(style);
    }

    cleanUp() {
        this.clearVis();
        app.player.visualization.unregisterVisTypes(['oscilloscope']);
        if (this._visCanvas && (this._visCanvas.parentNode === this.container)) {
            this.container.removeChild(this._visCanvas);
        };
        super.cleanUp();
    }

    clearVis() {
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
        var x = 0;
        this._oscData = visData.getOscValues(this._oscData);
        this.oscData = new Int32Array(this._oscData);
        var val = this.oscData[0];
        var y = (Math.abs(val) >> 16) / 65536;
        if (val < 0)
            y = -y;
        y = this._height / 2 - y * this._height;
        this._visCanvasCtx.clearRect(0, 0, this._visCanvas.width, this._visCanvas.height);
        this._visCanvasCtx.beginPath();
        this._visCanvasCtx.lineWidth = this._lineWidth;
        this._visCanvasCtx.strokeStyle = this._fillStyle1;
        this._visCanvasCtx.moveTo(x, y);
        var stepX = this._width / this.oscData.length;
        for (var i = 1; i < this.oscData.length; i++) {
            val = this.oscData[i];
            y = (Math.abs(val) >> 16) / 65536;
            if (val < 0)
                y = -y;
            y = this._height / 2 - y * this._height;
            x += stepX;
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
registerClass(Vis_oscillator);