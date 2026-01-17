'use strict';

registerFileImport('controls/colorPicker');

import Control from './control';
import Edit from './edit';

/**
 * UI color picker control.
 */
class ColorPicker extends Control {
    private svCanv: HTMLCanvasElement;
    private hueCanv: HTMLCanvasElement;
    private prvCanv: HTMLCanvasElement;
    private edit: ElementWith<Edit>;
    private svRect: DOMRect;
    private hueRect: DOMRect;
    private width: number;
    private pad: number;
    private sqPad: number;
    private svCtx: CanvasRenderingContext2D;
    private hueCtx: CanvasRenderingContext2D;
    private prvCtx: CanvasRenderingContext2D;
    
    private _svSeekHandler: (e: MouseEvent) => void;
    private _hueSeekHandler: (e: MouseEvent) => void;
        
    private animationFrameTimeout: number;
    private boundingRectUpdateNeeded: boolean;
    
    private _hsv: HSVObject;
    private _hexValue: string;
    private _hueWidth: number;
    private _prvWidth: number;
    private _prvHeight: number;
    
    private _grdRed: CanvasGradient;
    private _grdGreen: CanvasGradient;
    private _grdBlue: CanvasGradient;
    private _grdWhite: CanvasGradient;
    private _grdBlack: CanvasGradient;

    initialize(elem: HTMLElement, params: AnyDict) {
        super.initialize(elem, params);
        
        if (!params) params = {};
        
        // Default size: 300px. Can be controlled with params.size.
        let width: number;
        if (params.size && !isNaN(params.size)) width = parseInt(params.size);
        else width = 300;
        this.width = width;
        
        this._hueWidth = Math.round(width * 0.2);
        this._prvWidth = Math.round(width * 0.5);
        this._prvHeight = Math.round(width * 0.3);
        this.pad = 7;
        this.sqPad = 5;

        this.svCanv = document.createElement('canvas');
        this.hueCanv = document.createElement('canvas');
        this.prvCanv = document.createElement('canvas');
        this.edit = document.createElement('div') as ElementWith<Edit>;
        let editContainer = document.createElement('div');
        let rest = document.createElement('div');
        let parent = document.createElement('div');
        
        // Sat-Val (square)
        this.svCanv.width = width;
        this.svCanv.height = width;
        this.svCanv.classList.add('floatLeft');
        // Hue (rectabgle)
        this.hueCanv.height = width;
        this.hueCanv.width = this._hueWidth;
        this.hueCanv.classList.add('floatLeft');
        // Preview
        this.prvCanv.width = 1;
        this.prvCanv.height = 1;
        this.prvCanv.style.width = this._prvWidth.toString();
        this.prvCanv.style.height = this._prvHeight.toString();
        this.prvCanv.style.padding = this.pad.toString();
        // Text edit
        editContainer.style.padding = this.pad.toString();
        editContainer.style.width = this._prvWidth.toString();
        this.edit.setAttribute('data-control-class', 'Edit');
        parent.style.position = 'relative';
        parent.classList.add('floatRow');
        rest.classList.add('floatLeft');
        this.container.classList.add('colorPicker');

        parent.appendChild(this.svCanv);
        parent.appendChild(this.hueCanv);
        parent.appendChild(rest);
        rest.appendChild(this.prvCanv);
        rest.appendChild(editContainer);
        editContainer.appendChild(this.edit);
        this.container.appendChild(parent);
        
        initializeControl(this.edit);

        this.svCtx = this.svCanv.getContext('2d');
        this.hueCtx = this.hueCanv.getContext('2d');
        this.prvCtx = this.prvCanv.getContext('2d');
        
        let hsv = {h: 0.5, s: 0.5, v: 0.5};
        // Default color: Middle blueish. Can be customized with params.value (hex value), params.rgb (array, 0-255), or params.hsv (array, 0-1).
        if (params.value && typeof params.value === 'string') {
            let rgb = this.hexToRgb(params.value);
            if (rgb) hsv = this.rgbToHsv(rgb.r, rgb.g, rgb.b);
        }
        if (params.rgb && params.rgb[0] && params.rgb[1] && params.rgb[2]) {
            hsv = this.rgbToHsv(params.rgb[0], params.rgb[1], params.rgb[2]);
        }
        if (params.hsv && params.hsv[0] && params.hsv[1] && params.hsv[2]) {
            hsv.h = Math.min(Math.max(params.hsv[0], 0), 1);
            hsv.s = Math.min(Math.max(params.hsv[1], 0), 1);
            hsv.v = Math.min(Math.max(params.hsv[2], 0), 1);
        }
        this._hsv = hsv;
        
    
        this._svSeekHandler = (e: { clientX: any; clientY: any; }) => {
            let rect = this.svRect;
            assert(rect, 'SV bounding client rect not');
            let x = e.clientX, y = e.clientY;
            
            let svX: number, svY: number;
            
            // too far to the top
            if (y < rect.top + this.pad)
                svY = 0;
            // too far to the bottom
            else if (y > rect.top + rect.height - this.pad)
                svY = 1;
            else 
                svY = (y - rect.top - this.pad) / (this.width-this.pad*2);
            
            // too far to the left
            if (x < rect.left + this.pad)
                svX = 0;
            // too far to the bottom
            else if (x > rect.x + rect.width - this.pad)
                svX = 1;
            else
                svX = (x - rect.left - this.pad) / (this.width-this.pad*2);
            
            this._hsv.s = svX;
            this._hsv.v = 1 - svY;
            
            // request a new frame
            if (!this.animationFrameTimeout) {
                this.animationFrameTimeout = requestFrame(() => {
                    this._render();
                    this._updateEditValue();
                });
            }
        };
        
        this._hueSeekHandler = (e: { clientY: any; }) => {
            let rect = this.hueRect;
            let y = e.clientY;
            
            let huePos: number;
            
            // too far to the top
            if (y < rect.top)
                huePos = 0;
            // too far to the bottom
            else if (y > rect.top + rect.height)
                huePos = 1;
            else
                huePos = (y - rect.top) / this.width;
            
            this._hsv.h = huePos;
            
            // request a new frame
            if (!this.animationFrameTimeout) {
                this.animationFrameTimeout = requestFrame(() => {
                    this._render();
                    this._updateEditValue();
                });
            }
        };
        
        this.localListen(this.hueCanv, 'mousedown', (e) => this._hueSeekStart(e));
        this.localListen(this.svCanv, 'mousedown', (e) => this._svSeekStart(e));
        this.localListen(window, 'mouseup', () => {
            this._hueSeekEnd();
            this._svSeekEnd();
        });
        this.localListen(window, 'blur', () => {
            this._hueSeekEnd();
            this._svSeekEnd();
        });
        this.localListen(this.edit.controlClass, 'change', () => {
            let editValue = this.edit.controlClass.value;
            if (editValue) this._setValue(String(editValue));
        });
        this.localListen(this.container, 'layoutchange', () => this._updateBoundingRect());
        this.localListen(window, 'scroll', () => this._handleScroll(), true);
        
        // === initial setup ===
        // hue line
        this._grdRed = this.hueCtx.createLinearGradient(this.pad, this.pad, this.pad, width-this.pad);
        this._grdRed.addColorStop(0.16666, '#FF0000FF');
        this._grdRed.addColorStop(0.33333, '#FF000000');
        this._grdRed.addColorStop(0.66666, '#FF000000');
        this._grdRed.addColorStop(0.83333, '#FF0000FF');
        this._grdGreen = this.hueCtx.createLinearGradient(this.pad, this.pad, this.pad, width-this.pad);
        this._grdGreen.addColorStop(0, '#00FF0000');
        this._grdGreen.addColorStop(0.16666, '#00FF00FF');
        this._grdGreen.addColorStop(0.5, '#00FF00FF');
        this._grdGreen.addColorStop(0.66666, '#00FF0000');
        this._grdBlue = this.hueCtx.createLinearGradient(this.pad, this.pad, this.pad, width-this.pad);
        this._grdBlue.addColorStop(0.33333, '#0000FF00');
        this._grdBlue.addColorStop(0.5, '#0000FFFF');
        this._grdBlue.addColorStop(0.83333, '#0000FFFF');
        this._grdBlue.addColorStop(1, '#0000FF00');
        // B/W sat/val square
        this._grdWhite = this.svCtx.createLinearGradient(this.pad, this.pad, width-this.pad, this.pad);
        this._grdWhite.addColorStop(0, '#FFFFFFFF');
        this._grdWhite.addColorStop(1, '#FFFFFF00');
        this._grdBlack = this.svCtx.createLinearGradient(this.pad, this.pad, this.pad, width-this.pad);
        this._grdBlack.addColorStop(0, '#00000000');
        this._grdBlack.addColorStop(1, '#000000FF');
        
        this._updateBoundingRect();
        this._render();
        this._updateEditValue();
    }
    
    private _render() {
        // === Hue rectangle ===
        this.hueCtx.clearRect(0, 0, this._hueWidth, this.width);
        this.hueCtx.globalCompositeOperation = 'lighter';
        this.hueCtx.fillStyle = this._grdRed;
        this.hueCtx.fillRect(this.pad, this.pad, this._hueWidth-this.pad*2, this.width-this.pad*2);
        this.hueCtx.fillStyle = this._grdGreen;
        this.hueCtx.fillRect(this.pad, this.pad, this._hueWidth-this.pad*2, this.width-this.pad*2);
        this.hueCtx.fillStyle = this._grdBlue;
        this.hueCtx.fillRect(this.pad, this.pad, this._hueWidth-this.pad*2, this.width-this.pad*2);
        
        
        // === SV square === 
        this.svCtx.clearRect(0, 0, this.width, this.width);
        
        let fullSatRGB = this.hsvToRgb(this._hsv.h, 1, 1);
        this.svCtx.fillStyle = rgb(fullSatRGB.r, fullSatRGB.g, fullSatRGB.b);
        this.svCtx.fillRect(this.pad, this.pad, this.width-this.pad*2, this.width-this.pad*2);
        
        this.svCtx.fillStyle = this._grdWhite;
        this.svCtx.fillRect(this.pad, this.pad, this.width-this.pad*2, this.width-this.pad*2);
        this.svCtx.fillStyle = this._grdBlack;
        this.svCtx.fillRect(this.pad, this.pad, this.width-this.pad*2, this.width-this.pad*2);
        
        // === Preview window === 
        let thisRGB = this.hsvToRgb(this._hsv.h, this._hsv.s, this._hsv.v);
        this.prvCtx.fillStyle = rgb(thisRGB.r, thisRGB.g, thisRGB.b);
        this.prvCtx.fillRect(0, 0, 1, 1);
        
        // === Draw hue rectangle === 
        this.hueCtx.globalCompositeOperation = 'source-over';
        let pixelPos = this.lerp(this.pad, this.width-this.pad, this._hsv.h);
        // black surrounding stroke
        this.hueCtx.strokeStyle = 'black';
        this.hueCtx.lineWidth = 4;
        this.hueCtx.strokeRect(this.pad, pixelPos-this.sqPad, this._hueWidth-this.pad*2, this.sqPad*2);
        // white box
        this.hueCtx.strokeStyle = 'white';
        this.hueCtx.lineWidth = 2;
        this.hueCtx.strokeRect(this.pad, pixelPos-this.sqPad, this._hueWidth-this.pad*2, this.sqPad*2);
        
        // === Draw SV rectangle === 
        this.svCtx.globalCompositeOperation = 'source-over';
        let pixelX = this.lerp(this.pad, this.width-this.pad, this._hsv.s);
        let pixelY = this.lerp(this.pad, this.width-this.pad, (1 - this._hsv.v));
        // black surrounding stroke
        this.svCtx.strokeStyle = 'black';
        this.svCtx.lineWidth = 4;
        this.svCtx.strokeRect(pixelX-this.sqPad, pixelY-this.sqPad, this.sqPad*2, this.sqPad*2);
        // colored inside
        this.svCtx.fillStyle = rgb(thisRGB.r, thisRGB.g, thisRGB.b);
        this.svCtx.fillRect(pixelX-this.sqPad, pixelY-this.sqPad, this.sqPad*2, this.sqPad*2);
        // white box
        this.svCtx.strokeStyle = 'white';
        this.svCtx.lineWidth = 2;
        this.svCtx.strokeRect(pixelX-this.sqPad, pixelY-this.sqPad, this.sqPad*2, this.sqPad*2);
        
        function rgb(r: number, g: number, b: number) {
            return 'rgb(' + String(r) + ',' + String(g) + ',' + String(b) + ')';
        }
        
        this.animationFrameTimeout = undefined;
    }
    
    private _svSeekStart(e: any) {
        if (this.container.hasAttribute('data-disabled') && !!this.container.getAttribute('data-disabled')) return;
        app.listen(document, 'mousemove', this._svSeekHandler);
        // Update the bounding rect if needed first
        if (this.boundingRectUpdateNeeded) {
            this._updateBoundingRect();
            this.boundingRectUpdateNeeded = false;
        }
        this._svSeekHandler(e);
    }
    
    private _svSeekEnd() {
        app.unlisten(document, 'mousemove', this._svSeekHandler);
    }
    
    
    private _hueSeekStart(e: any) {
        if (this.container.hasAttribute('data-disabled') && !!this.container.getAttribute('data-disabled')) return;
        app.listen(document, 'mousemove', this._hueSeekHandler);
        // Update the bounding rect if needed first
        if (this.boundingRectUpdateNeeded) {
            this._updateBoundingRect();
            this.boundingRectUpdateNeeded = false;
        }
        this._hueSeekHandler(e);
    }
    
    private _hueSeekEnd() {
        app.unlisten(document, 'mousemove', this._hueSeekHandler);
    }
    
    // When the document scrolls, the bounding rect will need to be updated.
    private _handleScroll () {
        this.boundingRectUpdateNeeded = true;
    }
    
    private _updateBoundingRect () {
        this.hueRect = this.hueCanv.getBoundingClientRect();
        this.svRect = this.svCanv.getBoundingClientRect();
    }
    /**
     * Update the value of the color picker
     * @param {string} value 
     */
    private _setValue (value: string) {
        let rgb = this.hexToRgb(value);
        // Only update and render if we have an interpretable value
        if (rgb) {
            this._hsv = this.rgbToHsv(rgb.r, rgb.g, rgb.b);
            if (value != this._hexValue) this._render();
            this._hexValue = value;
            
            // If the contents don't include a # at the start, add it
            if (!value.startsWith('#')) {
                this.edit.controlClass.value = '#' + value;
            }
        }
    }
    
    /**
     * Internal function to update the edit's value when the HSV variable changes.
     */
    private _updateEditValue() {
        let rgb = this.hsvToRgb(this._hsv.h, this._hsv.s, this._hsv.v);
        let hex = this.rgbToHex(rgb.r, rgb.g, rgb.b);
        this._hexValue = hex;
        this.edit.controlClass.value = hex;
    }
    
    private _getValue() {
        let rgb = this.hsvToRgb(this._hsv.h, this._hsv.s, this._hsv.v);
        return this.rgbToHex(rgb.r, rgb.g, rgb.b);
    }
    
    private _getHSV() {
        return [this._hsv.h, this._hsv.s, this._hsv.v];
    }
    
    private _setHSV(h: number, s: number, v: number) {
        this._hsv.h = Math.min(Math.max(h, 0), 1);
        this._hsv.s = Math.min(Math.max(s, 0), 1);
        this._hsv.v = Math.min(Math.max(v, 0), 1);
        this._updateEditValue();
        this._render();
    }
    
    private _getRGB() {
        let rgb = this.hsvToRgb(this._hsv.h, this._hsv.s, this._hsv.v);
        return [rgb.r, rgb.g, rgb.b];
    }
    
    private _setRGB(r: number, g: number, b: number) {
        this._hsv = this.rgbToHsv(r, g, b);
        this._updateEditValue();
        this._render();
    }
    
    private _isSimilarTo(otherValue: unknown, dataType: any, customThreshold: number) {
        let rgbObj: RGBObject;
        let rgbArray: number[];
        if (typeof otherValue === 'string') {
            switch(otherValue) {
            case 'white': rgbObj = this.hexToRgb('#FFFFFF'); break;
            case 'black': rgbObj = this.hexToRgb('#000000'); break;
            default: rgbObj = this.hexToRgb(otherValue);
            }
        }
        // arrays return 'object' as 
        else if (typeof otherValue === 'object') {
            // is array
            if (Array.isArray(otherValue) && !isNaN(otherValue[0]) && !isNaN(otherValue[1]) && !isNaN(otherValue[2])) {
                switch (dataType) {
                case 'rgb': case 'RGB':
                    rgbArray = otherValue;
                    break;
                case 'hsv': case 'HSV': case 'hsb': case 'HSB':
                    rgbObj = this.hsvToRgb(otherValue[0], otherValue[1], otherValue[2]);
                    break;
                default:
                    throw new TypeError('When specifying an array, dataType must be either "rgb" or "hsv".');
                }
            }
            // is color picker
            else if (otherValue instanceof ColorPicker) {
                rgbArray = otherValue.rgb;
            }
            else if (otherValue instanceof HTMLElement && otherValue.controlClass && otherValue.controlClass instanceof ColorPicker) {
                rgbArray = otherValue.controlClass.rgb;
            }
        }
        else throw new TypeError('otherValue must either be a hexadecimal string, an array, or a ColorPicker control class.');
        // turn r,g,b object into r,g,b array
        if (rgbObj && !rgbArray) rgbArray = [rgbObj.r, rgbObj.g, rgbObj.b];
        
        // do a distance comparison
        if (rgbArray && !isNaN(rgbArray[0]) && !isNaN(rgbArray[1]) && !isNaN(rgbArray[2])) {
            let myRGB = this.rgb;
            let dist0 = Math.pow(myRGB[0]/10 - rgbArray[0]/10, 2);
            let dist1 = Math.pow(myRGB[1]/10 - rgbArray[1]/10, 2);
            let dist2 = Math.pow(myRGB[2]/10 - rgbArray[2]/10, 2);
            // Return the distance compared to the threshold
            let threshold = !isNaN(customThreshold) ? customThreshold : 40;
            return (dist0 + dist1 + dist2 < threshold);
        }
        else {
            throw new Error(`An invalid color has been provided. rgbObj=${JSON.stringify(rgbObj)}, rgbArray=${JSON.stringify(rgbArray)}, dataType=${dataType}, customThreshold=${customThreshold}, otherValue=${otherValue}`);
        }
    }
    /**
     * @param {number} r 
     * @param {number} g 
     * @param {number} b 
     * @returns {string}
     */
    rgbToHex(r: number, g: number, b: number) {
        // Clamp r, g, and b
        r = Math.min(Math.max(r, 0), 255);
        g = Math.min(Math.max(g, 0), 255);
        b = Math.min(Math.max(b, 0), 255);
        // Turn them into hexadecimal
        let strR = Math.ceil(r).toString(16).padStart(2,'0');
        let strG = Math.ceil(g).toString(16).padStart(2,'0');
        let strB = Math.ceil(b).toString(16).padStart(2,'0');
        return `#${strR}${strG}${strB}`;
    }
    
    /**
     * Converts a hexadecimal string to RGB.
     */
    hexToRgb(hex: string) {
        // Remove the # if needed
        if (hex.startsWith('#')) hex = hex.substring(1, hex.length);
        let r: number, g: number, b: number;
        // 3-length hex codes just have an 8-bit color instead of 16-bit
        if (hex.length == 3) {
            r = parseInt(hex[0], 16) * 17;
            g = parseInt(hex[1], 16) * 17;
            b = parseInt(hex[2], 16) * 17;
        }
        // 6-length hex codes are the standard
        else if (hex.length >= 6) {
            r = parseInt(hex.substring(0, 2), 16);
            g = parseInt(hex.substring(2, 4), 16);
            b = parseInt(hex.substring(4, 6), 16);
        }
        else {
            // if the hex's length is 1, 2, or 4, we have no way to interpret it
            return;
        }
        return {r, g, b};
    }

    /**
     * Converts r, g, b values to h, s, and v.
     */
    rgbToHsv(r: number, g: number, b: number) {
        // Credit to MERAMU KODING https://en.meramukoding.com/js-converting-rgb-colorspace-to-hsv/
        let h: number, s: number, v: number;

        let maxColor = Math.max(r, g, b);
        let minColor = Math.min(r, g, b);
        let d = maxColor - minColor;

        if (d === 0) h = 0;
        else if (r === maxColor) h = (6 + (g - b) / d) % 6;
        else if (g === maxColor) h = 2 + (b - r) / d;
        else if (b === maxColor) h = 4 + (r - g) / d;
        else h = 0;
        h = h / 6;

        if (maxColor !== 0) s = d / maxColor;
        else s = 0;

        v = maxColor / 255;

        return { h: h, s: s, v: v };
    }
    
    hsvToRgb(h: number, s: number, v: number) {
        // Credit to EasyRGB: http://www.easyrgb.com/en/math.php
        //H, S and V input range = 0 ÷ 1.0
        //R, G and B output range = 0 ÷ 255
        let r: number, g: number, b: number, var_h: number, var_i: number, var_1: number, var_2: number, var_3: number, var_r: number, var_g: number, var_b: number;

        if (s == 0) {
            r = v * 255;
            g = v * 255;
            b = v * 255;
        }
        else {
            var_h = h * 6;
            if (var_h == 6) var_h = 0;
            var_i = parseInt(var_h);
            var_1 = v * (1 - s);
            var_2 = v * (1 - s * (var_h - var_i));
            var_3 = v * (1 - s * (1 - (var_h - var_i)));

            if (var_i == 0) { var_r = v; var_g = var_3; var_b = var_1; }
            else if (var_i == 1) { var_r = var_2; var_g = v; var_b = var_1; }
            else if (var_i == 2) { var_r = var_1; var_g = v; var_b = var_3; }
            else if (var_i == 3) { var_r = var_1; var_g = var_2; var_b = v; }
            else if (var_i == 4) { var_r = var_3; var_g = var_1; var_b = v; }
            else { var_r = v; var_g = var_1; var_b = var_2; }

            r = Math.round(var_r * 255);
            g = Math.round(var_g * 255);
            b = Math.round(var_b * 255);
        }
        return { r: r, g: g, b: b };
    }
    lerp(a: number, b: number, t: number) {
        return (1-t)*a + t*b;
    }

    cleanUp() {
        this.boundingRectUpdateNeeded = true;
        super.cleanUp();
    }

    /**
     * Determine whether this color picker's value is too similar to another color to be distinguishable.
     * Supported inputs: Hexadecimal string value, ColorPicker control, RGB array, HSV array. If RGB or HSV array, then dataType must be specified (either "rgb" or "hsv").
     * @method isSimilarTo
     * @param otherValue Another color or color picker.
     * @param dataType Either "hsv" or "rgb" (if an hsv/rgb array is specified)
     * @param customThreshold A custom threshold for the color comparison. The default is 40. The value doesn't have any units; if you specify a higher number, it'll have a higher threshold for color differences.
     */
    isSimilarTo(otherValue: string|number[]|ColorPicker|ElementWith<ColorPicker>, dataType?: 'hsv'|'rgb', customThreshold?: number) {
        return this._isSimilarTo(otherValue, dataType, customThreshold);
    }

    /**
        Get/set the hexadecimal value of the color picker. Can be a 3-digit hex value (#FFF) or a 6-digit hex value (#FFFFFF). The # is not necessary when setting; it is added automatically.
        @property value
        @type string
    */    
    get value (): string {
        return this._getValue();
    }
    set value (value: string) {
        this._setValue(value);
    }
    
    /**
     * Get/set the HSV value of the color picker. HSV ranges from 0 to 1 on all values. Set with an array [h, s, v].
     * @property hsv
     * @type array
     */    
    get hsv () {
        return this._getHSV();
    }
    set hsv(hsv) {
        this._setHSV(hsv[0], hsv[1], hsv[2]);
    }
    
    /**
     * Get/set the RGB value of the color picker. RGB ranges from 0 to 255 on all values. Set with an array [r, g, b].
     * @property rgb
     * @type array
     */    
    get rgb() {
        return this._getRGB();
    }
    set rgb(rgb) {
        this._setRGB(rgb[0], rgb[1], rgb[2]);
    }
    
}
registerClass(ColorPicker);

type RGBObject = {r: number, g: number, b: number};
type HSVObject = {h: number, s: number, v: number};