/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

'use strict';
import Control from './control';
registerFileImport('controls/slider');
/**
@module UI
*/
/**
UI Slider element

@class Slider
@constructor
@extends Control
*/
export default class Slider extends Control {
    initialize(parentel, params) {
        super.initialize(parentel, params);
        this.initialized = false;
        this._orientation = 'horizontal', this._invert = false;
        this._fromZero = false;
        this._min = 0;
        this._max = 0;
        this._value = 0;
        this._step = 0;
        this._wheelStep = undefined;
        this._speechUnit = undefined;
        this._speechName = undefined;
        this._speechDecimals = 0;
        this._tickPlacement = 'none';
        this._tickInterval = 1;
        this._seekBarSize = 0;
        this._seekBarThumbSizes = {
            offsetWidth: 0,
            offsetHeight: 0
        };
        this._seekBarSizes = {
            offsetWidth: 0,
            offsetHeight: 0
        };
        let _mouseOffset = 0;
        let _seeking = false;
        // ** to prevent having too many concurrent wheel events
        this._lastEventTime = 0;
        this._minTimeBetweenTicks = 30;
        this._sliderContainer = document.createElement('div');
        this.container.appendChild(this._sliderContainer);
        this._seekBarOuter = document.createElement('div');
        this._sliderContainer.appendChild(this._seekBarOuter);
        this._seekBarOuter.setAttribute('role', 'slider');
        this._seekBarOuter.setAttribute('aria-valuemin', this._min.toString());
        this._seekBarOuter.setAttribute('aria-valuemax', this._max.toString());
        this._ticksOuter = document.createElement('div');
        this._sliderContainer.appendChild(this._ticksOuter);
        this._seekBar = document.createElement('div');
        this._seekBarOuter.appendChild(this._seekBar);
        this._seekBarBefore = document.createElement('div');
        this._seekBarOuter.appendChild(this._seekBarBefore);
        this._seekBarThumb = document.createElement('div');
        this._seekBarOuter.appendChild(this._seekBarThumb);
        let _isHorz = function () {
            return (this._orientation === 'horizontal');
        }.bind(this);
        let _validSize = function () {
            return (this._max > this._min);
        }.bind(this);
        let _enumWidth = function () {
            if (!this._seekBarSize) {
                let wProp = '';
                if (_isHorz()) {
                    wProp = 'offsetWidth';
                }
                else {
                    wProp = 'offsetHeight';
                }
                if (this._seekBarSizes[wProp] > 0)
                    this._seekBarSize = this._seekBarSizes[wProp];
                _mouseOffset = Math.round(this._seekBarThumbSizes[wProp] / 2);
            }
        }.bind(this);
        let _liveEvent = function () {
            let liveevt = createNewCustomEvent('livechange', {
                detail: {
                    value: this.value
                },
                bubbles: true,
                cancelable: true
            });
            this.container.dispatchEvent(liveevt);
        }.bind(this);
        let _changeEvent = function () {
            let evt = createNewEvent('change');
            this.container.dispatchEvent(evt);
        }.bind(this);
        this._roundToStep = function (val, st) {
            st = st || this.step;
            if (st !== 0)
                return Math.round(val / st) * st;
            else
                return val;
        }.bind(this);
        let _getSize = function () {
            _enumWidth();
            return this._seekBarSize;
        }.bind(this);
        let _getOffset = function (e) {
            let horz = _isHorz();
            let val;
            if (e.elX !== undefined) {
                if (horz) {
                    val = e.elX - _mouseOffset;
                }
                else {
                    val = e.elY - _mouseOffset;
                }
            }
            else {
                if (e.currentTarget !== e.target) {
                    if (!this.sbOuterPos) {
                        this.sbOuterPos = findScreenPos(this._seekBarOuter);
                    }
                    if (horz) {
                        val = e.screenX - this.sbOuterPos.left - _mouseOffset;
                    }
                    else {
                        val = e.screenY - this.sbOuterPos.top - _mouseOffset;
                    }
                }
                else {
                    if (horz) {
                        val = e.offsetX - _mouseOffset;
                    }
                    else {
                        val = e.offsetY - _mouseOffset;
                    }
                }
            }
            return Math.min(Math.max(val, 0), _getSize());
        }.bind(this);
        this._updateInvert = function () {
            let horz = _isHorz();
            if (this._invert) {
                let twHalf = Math.round(this._seekBarThumbSizes[horz ? 'offsetWidth' : 'offsetHeight'] / 2);
                this._seekBarBefore.style[horz ? 'left' : 'top'] = 'auto';
                this._seekBarBefore.style[horz ? 'right' : 'bottom'] = twHalf + 'px';
            }
            else {
                this._seekBarBefore.style[horz ? 'left' : 'top'] = '';
                this._seekBarBefore.style[horz ? 'right' : 'bottom'] = '';
            }
        };
        let _updateBarBefore = function (pos) {
            let horz = _isHorz();
            let twHalf = Math.round(this._seekBarThumbSizes[horz ? 'offsetWidth' : 'offsetHeight'] / 2);
            if (this._invert) {
                let w = _getSize();
                pos = w - pos /* + tw*/;
            }
            else {
                //pos += tw;
            }
            if (this._fromZero) {
                let zP = Math.round(this.zeroPos + twHalf);
                if (this.zeroPos < pos) {
                    this._seekBarBefore.style[horz ? 'left' : 'top'] = zP + 'px';
                    this._seekBarBefore.style[horz ? 'width' : 'height'] = (pos - this.zeroPos) + 'px';
                }
                else {
                    this._seekBarBefore.style[horz ? 'left' : 'top'] = (pos + twHalf) + 'px';
                    this._seekBarBefore.style[horz ? 'width' : 'height'] = (this.zeroPos - pos) + 'px';
                }
            }
            else {
                if (this._invert) {
                    this._seekBarBefore.style[horz ? 'right' : 'bottom'] = twHalf + 'px';
                }
                else {
                    this._seekBarBefore.style[horz ? 'left' : 'top'] = twHalf + 'px';
                }
                this._seekBarBefore.style[horz ? 'width' : 'height'] = pos + 'px';
            }
        }.bind(this);
        let _setPos = function (pos) {
            pos = Math.round(pos);
            this._seekBarThumb.style[_isHorz() ? 'left' : 'top'] = pos + 'px';
            _updateBarBefore(pos);
        }.bind(this);
        this._assignClasses = function () {
            if (!this.initialized)
                return;
            this._sliderContainer.classList.toggle('slider', true);
            this._seekBarOuter.className = 'seekBarOuter';
            this._seekBar.className = 'seekBar';
            this._seekBarBefore.className = 'seekBarBefore';
            this._seekBarThumb.className = 'seekBarThumb';
            this._ticksOuter.className = 'ticksOuter';
            this._sliderContainer.classList.toggle('horizontal', (this._orientation == 'horizontal'));
            this._sliderContainer.classList.toggle('vertical', (this._orientation !== 'horizontal'));
            this._sliderContainer.classList.toggle('tickNone', (this.tickPlacement === 'none'));
            this._sliderContainer.classList.toggle('tickBoth', (this.tickPlacement === 'both'));
            this._sliderContainer.classList.toggle('tickBottomRight', (this.tickPlacement === 'bottomRight'));
            this._sliderContainer.classList.toggle('tickTopLeft', (this.tickPlacement === 'topLeft'));
            this._sliderContainer.classList.toggle('tickCenter', (this.tickPlacement === 'center'));
            this._seekBarSize = 0;
        }.bind(this);
        let _updateVal = function (e) {
            let w = _getSize();
            if (w > 0) {
                let one = (this._max - this._min) / w;
                let val = _getOffset(e);
                let pos = one * val;
                if (this._invert) {
                    this._value = this._max - pos;
                }
                else
                    this._value = this._min + pos;
            }
        }.bind(this);
        this._updatePos = function () {
            if (this._seekBarThumb && !_seeking) {
                let w = _getSize();
                if (w > 0) {
                    let one = (this._max - this._min) / w;
                    if (one > 0) {
                        let pos = (this.value - this._min) / one;
                        if (this._fromZero) {
                            this.zeroPos = (0 - this._min) / one;
                        }
                        else if (this._invert) {
                            pos = w - pos;
                        }
                        _setPos(pos);
                    }
                }
                let value = this.value.toFixed(this._speechDecimals);
                this._seekBarOuter.setAttribute('aria-valuenow', value);
                if (this._speechUnit) {
                    this._seekBarOuter.setAttribute('aria-valuetext', value + ' ' + this._speechUnit);
                }
                else {
                    this._seekBarOuter.setAttribute('aria-valuetext', value);
                }
            }
        }.bind(this);
        let _pointerDownEvent = function (e) {
            if (!_validSize() || this._disabled || (e.button !== 0) /* take only left button */)
                return;
            _seeking = true;
            let _moveaction = function (e) {
                if (_seeking) {
                    _setPos(_getOffset(e));
                    _updateVal(e);
                    _liveEvent();
                }
            }.bind(this);
            let _endaction = function (e) {
                if (_seeking) {
                    // apply
                    _setPos(_getOffset(e));
                    _updateVal(e);
                }
                _seeking = false;
                this._updatePos();
                _liveEvent();
                _changeEvent();
            }.bind(this);
            _liveEvent(); // call this, so listeners will know, that slider was catched
            handleCapture(this._seekBarOuter, _moveaction, _endaction);
        }.bind(this);
        let _keyDownHandler = function (evt) {
            if (!_validSize())
                return;
            if (evt.ctrlKey || evt.altKey || evt.shiftKey)
                return;
            let horz = _isHorz();
            let keydown = horz ? 37 : 40;
            let keyup = horz ? 39 : 38;
            let step = this.step || (this.max - this.min) / 100;
            if ((!this.invert && !horz) || (horz && this.invert)) {
                step = -step;
            }
            switch (evt.keyCode) {
                case keydown:
                    {
                        this.value = this.value - step;
                        _liveEvent();
                        _changeEvent();
                        evt.stopPropagation();
                        break;
                    }
                case keyup:
                    {
                        this.value = this.value + step;
                        _liveEvent();
                        _changeEvent();
                        evt.stopPropagation();
                        break;
                    }
            }
        }.bind(this);
        this.mouseWheelHandler = function (evt) {
            if (!_validSize())
                return;
            let step = 0;
            if (evt.shiftKey)
                step = this.step;
            else
                step = this.wheelStep;
            step = step || (this.max - this.min) / 100;
            // ** only process event if it's after the minimum time
            let dt = Date.now() - this._lastEventTime;
            if (dt > this._minTimeBetweenTicks) {
                this._lastEventTime = Date.now();
                let delta;
                // if trackpad
                if (Math.abs(evt.wheelDelta) < 60) {
                    let maxStep, minStep;
                    // if step is less than 1, it could be very small, so make maxStep in relation to minStep
                    if (step < 1) {
                        minStep = step / 2; // If it's already a decimal, we can lower the min for greater precision
                        maxStep = step * 10;
                    }
                    // if step is greater than 1, give maxStep a bit more oomph
                    else {
                        minStep = 1;
                        maxStep = (step > 2) ? step * 2 : 5;
                    }
                    let rawDelta = evt.wheelDelta * (maxStep - minStep) / 40;
                    // ** Add or subtract minStep from rawDelta depending on pos. or neg.
                    delta = (rawDelta > 0) ? rawDelta + minStep : rawDelta - minStep;
                    this.value = this._roundToStep(this.value + delta, minStep);
                }
                else {
                    delta = step * (evt.wheelDelta / 120);
                    this.value = this._roundToStep(this.value + delta, step);
                }
                evt.stopPropagation();
                _liveEvent();
                _changeEvent();
            }
            else {
                evt.stopPropagation();
            }
        }.bind(this);
        this.setTabbable = function (val) {
            if (val === this._tabbable)
                return;
            this._tabbable = val;
            if (this._tabbable) {
                this._seekBarOuter.tabIndex = 0; // makes it tabbable and able to catch keys
                app.listen(this._seekBarOuter, 'keydown', _keyDownHandler);
                app.listen(this._seekBarOuter, 'wheel', this.mouseWheelHandler);
            }
            else {
                this._seekBarOuter.tabIndex = -1;
                app.unlisten(this._seekBarOuter, 'keydown', _keyDownHandler);
                app.unlisten(this._seekBarOuter, 'wheel', this.mouseWheelHandler);
            }
        }.bind(this);
        this._generateTicks = function () {
            if (!this.initialized)
                return;
            cleanElement(this._ticksOuter);
            if ((this._tickPlacement !== 'none') && _validSize()) {
                if (this._tickInterval) {
                    this._ticks = [];
                    for (let i = this.min; i <= this.max; i += this.tickInterval) {
                        this._ticks.push(i);
                    }
                }
                if (this._ticks) {
                    let horz = _isHorz();
                    let both = (this._tickPlacement === 'both');
                    let cls = both ? 'topLeft' : this._tickPlacement;
                    for (let b = 0; b < (both ? 2 : 1); b++) {
                        for (let i = 0; i < this._ticks.length; i++) {
                            let t = document.createElement('div');
                            t.className = 'tick ' + cls;
                            let pval = 100.0 * ((this._ticks[i] - this.min) / (this.max - this.min));
                            if (this._invert)
                                pval = 100 - pval;
                            t.style[horz ? 'left' : 'top'] = pval + '%';
                            this._ticksOuter.appendChild(t);
                        }
                        cls = 'bottomRight';
                    }
                }
            }
        }.bind(this);
        this.activateImmediateTooltipHandling = function (formatValueFunc) {
            this.container.tooltipImmediate = true;
            if (formatValueFunc)
                this.formatTooltipValue = formatValueFunc;
            else
                this.formatTooltipValue = undefined;
            app.listen(this._seekBarOuter, 'mousemove', function (e) {
                let w = _getSize();
                if (w > 0) {
                    let one = (this._max - this._min) / w;
                    let val = _getOffset(e);
                    let pos = one * val;
                    if (this._invert) {
                        this._hoverValue = this._max - pos;
                    }
                    else
                        this._hoverValue = this._min + pos;
                }
                else
                    this._hoverValue = undefined;
            }.bind(this), true);
            this.container.tooltipValueCallback = function (tipdiv, vis) {
                if (!vis || (this._hoverValue === undefined) || this.disabled) {
                    tipdiv.innerText = '';
                    return;
                }
                else {
                    if (this.formatTooltipValue)
                        tipdiv.innerText = this.formatTooltipValue(this._hoverValue);
                    else
                        tipdiv.innerText = this._hoverValue;
                }
            }.bind(this);
        }.bind(this);
        this.tabbable = true; // default
        if (params) {
            // set passed attributes
            for (let key in params) {
                this[key] = params[key];
            }
        }
        this.initialized = true;
        this._assignClasses();
        this._updateInvert();
        this._generateTicks();
        app.listen(this._seekBarOuter, 'mousedown', _pointerDownEvent);
        app.listen(this._seekBarOuter, 'touchstart', _pointerDownEvent);
        this.registerEventHandler('layoutchange');
        this.handle_layoutchange(); // make initial setting
    }
    cleanUp() {
        app.unlisten(this._seekBarOuter);
        super.cleanUp();
    }
    handle_layoutchange(evt) {
        this.sbOuterPos = undefined;
        queryLayoutAfterFrame(() => {
            if (this._seekBarThumb) {
                this._seekBarThumbSizes.offsetWidth = this._seekBarThumb.offsetWidth;
                this._seekBarThumbSizes.offsetHeight = this._seekBarThumb.offsetHeight;
            }
            if (this._seekBar) {
                this._seekBarSizes.offsetWidth = this._seekBar.offsetWidth;
                this._seekBarSizes.offsetHeight = this._seekBar.offsetHeight;
            }
            if (this._max > this._min) {
                this._seekBarSize = 0;
                this._updatePos();
            }
        });
        if (evt)
            super.handle_layoutchange(evt);
    }
    ignoreHotkey(hotkey) {
        let ar = ['Right', 'Left'];
        return inArray(hotkey, ar, true /* ignore case */);
    }
    /**
    Slider orientation. Possible values: 'vertical', 'horizontal'

    @property orientation
    @type string
    @default 'horizontal'
    */
    get orientation() {
        return this._orientation;
    }
    set orientation(val) {
        if (this._orientation !== val) {
            this._orientation = val;
            this._assignClasses();
            this._updateInvert();
            this._generateTicks();
        }
    }
    /**
    If true, reverse direction of the slider.

    @property invert
    @type boolean
    @default false
    */
    get invert() {
        return this._invert;
    }
    set invert(val) {
        if (this._invert !== val) {
            this._invert = val;
            this._updateInvert();
            this._updatePos();
            this._generateTicks();
        }
    }
    /**
    If true, show slider value with beginning in zero

    @property fromZero
    @type boolean
    @default false
    */
    get fromZero() {
        return this._fromZero;
    }
    set fromZero(val) {
        if (this._fromZero !== val) {
            this._fromZero = val;
            if (this._fromZero)
                this._invert = false;
            this._updateInvert();
            this._updatePos();
            this._generateTicks();
        }
    }
    /**
    Get/set minimal value of the slider.

    @property min
    @type number
    @default 0
    */
    get min() {
        return this._min;
    }
    set min(val) {
        if (this._min !== val) {
            this._min = val;
            if (this.value < this._min)
                this.value = this._min;
            this._updatePos();
            this._generateTicks();
            if (this._seekBarOuter)
                this._seekBarOuter.setAttribute('aria-valuemin', val.toString());
        }
    }
    /**
    Get/set maximal value of the slider.

    @property max
    @type number
    @default 0
    */
    get max() {
        return this._max;
    }
    set max(val) {
        if (this._max !== val) {
            this._max = val;
            if (this.value > this._max)
                this.value = this._max;
            this._updatePos();
            this._generateTicks();
            if (this._seekBarOuter)
                this._seekBarOuter.setAttribute('aria-valuemax', val.toString());
        }
    }
    /**
    Get/set step of the slider. 0 means no discrete step.

    @property step
    @type number
    @default 0
    */
    get step() {
        return this._step;
    }
    set step(val) {
        if (this._step !== val) {
            this._step = val;
            this._updatePos();
        }
    }
    /**
    Get/set wheel step of the slider (step used by mouse wheel). Default is undefined = wheel uses "step" property.

    @property wheelStep
    @type number
    @default undefined
    */
    get wheelStep() {
        if (this._wheelStep !== undefined)
            return this._wheelStep;
        else
            return this._step;
    }
    set wheelStep(val) {
        if (this._wheelStep !== val) {
            this._wheelStep = val;
        }
    }
    /**
    Get/set actual value of the slider.

    @property value
    @type number
    @default 0
    */
    get value() {
        return this._roundToStep(this._value);
    }
    set value(val) {
        val = this._roundToStep(val);
        if (val < this.min)
            val = this.min;
        else if (val > this.max)
            val = this.max;
        if (val !== this._value) {
            this._value = val;
            this._updatePos();
        }
    }
    /**
    If true, enables focusing control and controlling by arrow keys.

    @property tabbable
    @type boolean
    @default true
    */
    get tabbable() {
        return this._tabbable;
    }
    set tabbable(val) {
        this.setTabbable(val);
    }
    /**
    Slider ticks placement. Possible values: 'none', 'both', 'bottomRight', 'topLeft', 'center'

    @property tickPlacement
    @type string
    @default 'none'
    */
    get tickPlacement() {
        return this._tickPlacement;
    }
    set tickPlacement(val) {
        if (this._tickPlacement !== val) {
            this._tickPlacement = val;
            this._assignClasses();
            this._generateTicks();
        }
    }
    /**
    Slider ticks interval.

    @property tickInterval
    @type number
    @default 1
    */
    get tickInterval() {
        return this._tickInterval;
    }
    set tickInterval(val) {
        if (this._tickInterval !== val) {
            this._tickInterval = val;
            this._generateTicks();
        }
    }
    /**
    Array of slider ticks values. For regular ticks user should rather use tickInterval.

    @property ticks
    @type array
    @default []
    */
    get ticks() {
        return this._ticks;
    }
    set ticks(val) {
        this._ticks = val;
        this._tickInterval = 0;
        this._generateTicks();
    }
    /**
     * For screen readers, this is the unit that the screen readers say when reading the slider value. (For example: "Percent")
     * @property speechUnit
     * @type string
     * @default undefined
     */
    get speechUnit() {
        return this._speechUnit;
    }
    set speechUnit(val) {
        this._speechUnit = val;
    }
    /**
     * For screen readers, is is the name of the slider. (For example: "Volume")
     * @property speechName
     * @type string
     * @default undefined
     */
    get speechName() {
        return this._speechName;
    }
    set speechName(val) {
        this._speechName = val;
        if (val && this._seekBarOuter) {
            this._seekBarOuter.setAttribute('aria-label', val);
        }
    }
    /**
     * For screen readers, is is the number of decimals that the screen reader outputs when reading the slider value.
     * @property speechDecimals
     * @type number
     * @default 0
     */
    get speechDecimals() {
        return this._speechDecimals;
    }
    set speechDecimals(val) {
        this._speechDecimals = val;
    }
}
registerClass(Slider);
