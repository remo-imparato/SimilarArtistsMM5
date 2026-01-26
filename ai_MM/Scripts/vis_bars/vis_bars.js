/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

/**
@module UI
*/

requirejs('controls/baseVis');

/**
UI Visualizer element - bars.

@class Vis_bars
@constructor
@extends BaseVis
*/

class Vis_bars extends BaseVis {

    initialize(parentel, params) {
        super.initialize(parentel, params);
        this.container.classList.add('no-cpu');
        this._BAR1DASHHEIGHT = 3.0;
        this._BAR1SPACEHEIGHT = 1.0;
        this._BAR1HEIGHT = (this._BAR1DASHHEIGHT + this._BAR1SPACEHEIGHT);
        this._FALL_DUR = 450.0;
        this._lastSpectData = null;
        this._lastTime = 0;
        this._bandcount = 20;
        app.player.visualization.spectrumSections = this._bandcount;
        this._gapsize = 2;
        this._barwidth = 10;
        this._visCanvas = document.createElement('canvas');
        this._nonvisCanvas = document.createElement('canvas');
        this.container.appendChild(this._visCanvas);
        this._visCanvasCtx = null;
        this._nonvisCanvasCtx = null;

        this._visCanvas.classList.add('textColor'); // adds also background
        this._MAXSPECVAL = 8192;
        this._INERTIAKOEF = this._MAXSPECVAL / this._FALL_DUR;
        app.player.visualization.registerVisTypes(['spectrum']);
    }

    prepareColors (style) {
        style = style || getComputedStyle(this.container, null);
        this._fillStyle1 = style.getPropertyValue('color') || 'white';
        this._fillStyle2 = style.getPropertyValue('--visPeaksColor') || 'yellow';
        super.prepareColors(style);
    }

    cleanUp() {
        this.clearVis();
        app.player.visualization.unregisterVisTypes(['spectrum']);
        if (this._visCanvas && (this._visCanvas.parentNode === this.container)) {
            this.container.removeChild(this._visCanvas);
        };
        super.cleanUp(this);
    }

    clearVis() {
        this._lastSpectData = undefined;
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
            //this._visCanvasCtx.globalCompositeOperation='copy';            
            this._nonvisCanvasCtx = this._nonvisCanvas.getContext('2d');
            this._barwidth = Math.floor((this._width - this._gapsize * (this._bandcount - 1)) / this._bandcount);
            if (this._barwidth < 1)
                this._barwidth = 1;
        }
    }

    onUpdateHandler(visData) {
        if (!this._visCanvas) // not initialized yet
            return;
        if (!this._visCanvasCtx) {
            this.onResizeHandler(this._width, this._height);
        }
        var i;
        // add some inertia
        this._spectData = visData.getSpectrumValues(this._spectData);
        this.spectData = new Float64Array(this._spectData);
        if (!this._lastSpectData) {
            this._lastSpectData = this.spectData.slice();
        } else {
            var ticks = Date.now();
            var maxDiff = ticks - this._lastTime;
            if (maxDiff >= this._FALL_DUR)
                maxDiff = this._MAXSPECVAL;
            else
                maxDiff = this._INERTIAKOEF * maxDiff;
            this._lastTime = ticks;
            var val;
            for (i = 0; i < this.spectData.length; i++) {
                val = this.spectData[i];
                if (val < (this._lastSpectData[i] - maxDiff)) {
                    val = this._lastSpectData[i] - maxDiff;
                    this.spectData[i] = val;
                }
                this._lastSpectData[i] = val;
            }
        }

        // draw frame
        var x = 0;
        var h, y;

        this._nonvisCanvasCtx.fillStyle = this._fillStyle1;
        this._nonvisCanvasCtx.clearRect(0, 0, this._nonvisCanvas.width, this._nonvisCanvas.height);
        for (i = 0; i < this.spectData.length; i++) {
            h = Math.min(Math.round(this._height * (this.spectData[i]) / this._MAXSPECVAL), this._height) - this._BAR1DASHHEIGHT - this._BAR1SPACEHEIGHT;
            this._nonvisCanvasCtx.fillRect(x, this._height - h, this._barwidth, h);
            x += this._barwidth + this._gapsize;
        }
        for (y = this._height - this._BAR1DASHHEIGHT - this._BAR1SPACEHEIGHT; y > 0; y -= this._BAR1DASHHEIGHT + this._BAR1SPACEHEIGHT) {
            this._nonvisCanvasCtx.clearRect(0, y, this._width, this._BAR1SPACEHEIGHT);
        }
        this._nonvisCanvasCtx.fillStyle = this._fillStyle2;
        x = 0;
        for (i = 0; i < this.spectData.length; i++) {
            h = Math.min(Math.round(this._height * (this.spectData[i]) / this._MAXSPECVAL), this._height);
            this._nonvisCanvasCtx.fillRect(x, this._height - h, this._barwidth, Math.min(h, this._BAR1DASHHEIGHT));
            x += this._barwidth + this._gapsize;
        }
        var time = Date.now();
        if (this._textStartTime && (time <= (this._textStartTime + this._textDuration)))
            this.defaultRenderText(time, this._nonvisCanvasCtx);
        this._visCanvasCtx.clearRect(0, 0, this._visCanvas.width, this._visCanvas.height);
        if ((this._nonvisCanvas.width > 0) && (this._nonvisCanvas.height > 0))
            this._visCanvasCtx.drawImage(this._nonvisCanvas, 0, 0);
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
registerClass(Vis_bars);
