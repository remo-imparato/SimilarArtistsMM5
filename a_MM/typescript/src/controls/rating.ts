'use strict';

import Control, { ControlState, getPixelSize } from './control';

registerFileImport('controls/rating');

/**
@module UI
*/


/**
UI Rating element

@class Rating
@constructor
@extends Control
*/
export default class Rating extends Control {
    private _readOnly: any;
    private _tabbable: boolean;
    position: string;
    readOnlyPadding: string;
    useUnknown: boolean;
    useBigRating: boolean;
    starWidth: any;
    starMargin: number;
    starWidthOrig: any;
    starMarginOrig: number;
    paddingLeft: any;
    paddingRight: any;
    unkownText: any;
    _value: number;
    tempvalue: number;
    pressed: boolean;
    parentContainer: any;
    canvasPaddingLeft: any;
    canvasPaddingRight: any;
    canvasPaddingLeftPx: number;
    canvasPaddingRightPx: number;
    bigRating: HTMLDivElement;
    bigRatingCtrl: Rating;
    unknownDiv: HTMLDivElement;
    stars: any;
    private _readOnlyChangeTime: number;
    private _globalListenerSet: any;
    editingStarted: boolean;
    listenersSet: any;
    _initialized: boolean;
    keyMode: boolean;
    static getHTML: (params: any) => string;

    initialize(parentel, params) {
        params = params || {};
        super.initialize(parentel, params);

        // set default values

        this._readOnly = undefined;
        this.keyMode = false;
        this._tabbable = false;

        /**
        Determines aligning of the control. <br>
        Possible values: 'left', 'right', 'center'
        @property position
        @type string
        @default 'center'
        */
        this.position = 'center';

        /**
        Determines, if padding around control should be used in readOnly mode
        Possible values: 'none', 'left', 'right', 'both'
        @property readOnlyPadding
        @type string
        @default 'both'
        */
        this.readOnlyPadding = 'both';

        /**
        If true, rating control could contain negative value (= unknown/unset rating)

        @property useUnknown
        @type boolean
        @default false
        */
        this.useUnknown = false;

        /**
        If true, control uses larger helper rating control for preview during setting value.

        @property useBigRating
        @type boolean
        @default true
        */
        this.useBigRating = true;

        /**
        Star size, in pixels or em. 0 means auto size computed from parent size (experimental)

        @property starWidth
        @type integer
        @default 1.72em
        */
        this.starWidth = '1.72em';

        /**
        Margin before and after every star icon, in pixels or em.

        @property starMargin
        @type integer
        @default 1
        */
        this.starMargin = 1;

        /**
        Left padding value for rating canvas. Overrides default padding value (half of star width)
    
        @property paddingLeft
        @type String
        @default undefined
        */
        this.paddingLeft = undefined;

        /**
        Right padding value for rating canvas. Overrides default padding value (half of star width)
    
        @property paddingRight
        @type String
        @default undefined
        */
        this.paddingRight = undefined;

        /**
        Text for unknown rating when useUnknown is true.

        @property unkownText
        @type string
        @default 'Unknown'
        */
        this.unkownText = _('Unknown');

        this._value = 0;
        this.tempvalue = 0;
        this.pressed = false;
        this.container = parentel;
        cleanElement(this.container); // remove possible elements created by cloning
        this.container.classList.add('rating');
        if (!params || !params.noFlex)
            this.container.classList.add('ratingFlex');
        this.canvas = document.createElement('div');
        this.canvas.className = 'ratingCanvas';

        // set passed attributes, except value, it have to be set later after init, so just prepare it in _value        
        for (let key in params) {
            if (key === 'value')
                this._value = params[key];
            else
                this[key] = params[key];
        }
        if (this._readOnly === undefined)
            this.readOnly = !window.uitools.getCanEdit();
        this.canvas.classList.add(this.position);
        this.starWidthOrig = this.starWidth;
        this.starMarginOrig = this.starMargin;

        this.initializeFromStyle();

        if (params) {
            // we maybe changed these values
            params.starWidth = this.starWidth;
            params.starMargin = this.starMargin;
        }
        if (this.readOnly) {
            if (this.starWidth === 0) {
                // experimental
                this.canvas.classList.add('flex');
                this.canvas.classList.add('row');
            }
        }

        this.container.appendChild(this.canvas);
        let _this = this;
        this.mergeParentContextMenu = true;
        this.canBeUsedAsSource = false;
        this.addToContextMenu([{
            action: {
                title: _('Remove rating'),
                icon: 'star',
                execute: function () {
                    _this.removeRating();
                },
                visible: function () {
                    return !_this.readOnly && !_this.disabled && (_this._value >= 0);
                }
            },
            order: 10,
            grouporder: 5,
        }]);

        this._initialized = true;

        this.updateControl();

        this._updateDisabledAttribute = function () {
            if (_this.disabled) {
                _this.container.setAttribute('data-disabled', '1');
                _this.canvas.setAttribute('data-disabled', 1);
                _this.updateControl();
            } else {
                _this.container.removeAttribute('data-disabled');
                _this.canvas.removeAttribute('data-disabled');
                _this.updateControl();
            }
        };
        this.localListen(app, 'lesschange', () => {
            cleanElement(this.canvas, true);
            this.initializeFromStyle();
            this.updateControl();
        });
    }
    initializeFromStyle() {
        this.starMargin = Math.floor(getPixelSize(this.starMarginOrig));
        if (this.starWidthOrig === 0) {
            // experimental
            if (this.parentContainer) {
                // compute from parent size
                let cs = getComputedStyle(this.parentContainer);
                let h = 0;
                let w = 0;
                if (cs.height) {
                    h = parseFloat(cs.height);
                }
                if (cs.width) {
                    w = parseFloat(cs.width);
                    if (this.readOnly)
                        w = w / 5;
                    else
                        w = w / 6;
                    w -= 2 * this.starMargin;
                }
                if ((h > 0) && (h < w))
                    w = h;
                w = Math.floor(w);
                if (w > 0)
                    this.starWidth = w;
            }
            else {
                this.container.classList.add('stretchWidth');
            }
        }
        else {
            this.starWidth = Math.floor(getPixelSize(this.starWidthOrig));
        }
        let swidth = this.starWidth + 2 * this.starMargin;
        let swidthHalf = Math.floor((swidth) / 2);
        if (this.starWidth > 0)
            this.canvas.style.width = String(5 * swidth) + 'px';
        if (this.paddingLeft !== undefined)
            this.canvasPaddingLeft = this.paddingLeft;
        else
            this.canvasPaddingLeft = String(swidthHalf) + 'px';
        if (this.paddingRight !== undefined)
            this.canvasPaddingRight = this.paddingRight;
        else
            this.canvasPaddingRight = String(swidthHalf) + 'px';
        this.canvasPaddingLeftPx = Math.floor(getPixelSize(this.canvasPaddingLeft));
        this.canvasPaddingRightPx = Math.floor(getPixelSize(this.canvasPaddingRight));
        // add divs for stars
        this.stars = [];

        // cache star for this size
        let templateName = 'ratingStarW' + this.starWidth + 'M' + this.starMargin;
        let st = undefined;
        window.cachedStyleValues = window.cachedStyleValues || {};
        if (window.cachedStyleValues.starTemplates) {
            st = window.cachedStyleValues.starTemplates[templateName];
            if (st && !st._loading && !st.children.length)
                st = undefined;
        } else {
            window.cachedStyleValues.starTemplates = {};
        }

        let finishInit = function () {
            if (!this._cleanUpCalled) {                
                for (let i = 0; i < 5; i++) {
                    let newSt = st.cloneNode(true);
                    newSt.style.display = 'inline-block';
                    newSt.removeAttribute('data-id');
                    this.canvas.appendChild(newSt);
                    this.stars.push(newSt);
                }
                this.setRating(this._value, {
                    disableChangeEvent: true,
                    /* do not call change event, we are setting (initial) value programatically */
                    force: true
                });
                this.updateBigRating();

                let evt = createNewEvent('load');
                this.container.dispatchEvent(evt);
            }
        }.bind(this);

        if (!st) {
            st = document.createElement('div');
            st.style.display = 'none';
            st.className = 'ratingStar';
            st.style.marginLeft = this.starMargin + 'px';
            st.style.marginRight = this.starMargin + 'px';
            if (this.starWidth > 0) {
                st.style.width = this.starWidth + 'px';
                st.style.height = this.starWidth + 'px';
            } else {
                if (this.starMargin)
                    st.style.width = 'calc(20% - ' + (2 * this.starMargin) + 'px)';
                else
                    st.style.width = '20%';
            }
            st.setAttribute('data-id', templateName);
            document.body.appendChild(st);
            st._loading = true;
            loadIconFast('star', function (icon) {
                setIconFast(st, icon);
                finishInit();
                st._loading = false;
                if (st._initQueue) {
                    forEach(st._initQueue, function (fn) {
                        fn();
                    });
                    st._initQueue = undefined;
                }
            });
            window.cachedStyleValues.starTemplates[templateName] = st;
        } else {
            if (st._loading) {
                st._initQueue = st._initQueue || [];
                st._initQueue.push(finishInit);
            } else
                finishInit();
        }
    }

    touchStartHandler(evt) {
        evt.preventDefault();
        this.pressed = true;
        this.editingStarted = true;
    }

    touchMoveHandler(evt) {
        evt.preventDefault();
        this.mouseMoveHandler(evt);
    }

    touchEndHandler(evt) {
        evt.preventDefault();
        evt.clientX = evt.changedTouches[0].clientX;
        this.pressed = false;
        this.mouseUpHandler(evt);
    }

    mouseMoveHandler(evt) {
        evt.preventDefault();
        let x = evt.clientX - this.canvas.getBoundingClientRect().left;
        x = this.XtoRating(x, this.starWidth + 2 * this.starMargin);
        this.setRating(x, {
            temporary: true
        });
        //this.pressed = IsPressed(this, evt);
        this.updateBigRating();
        this.mouseOutHandler(evt);
    }

    mouseOverHandler(evt) {
        evt.preventDefault();
        this.canvas.setAttribute('data-hover', 1);
        //this.pressed = IsPressed(this, evt);
        if (!this._globalListenerSet) {            
            this._globalListenerSet = app.listen(window, 'mousemove', (e) => { this.mouseMoveHandler(e); }, true);
        }
    }

    mouseDownHandler(evt) {
        this.keyMode = false;
        if (this._readOnlyChangeTime) {
            if ((Date.now() - this._readOnlyChangeTime) < 500) // click just after removing readonly, do not handle as click, #15702
                return;
        }
        let isLeftButton = (evt.button === 0);
        if (isLeftButton) { // do not edit e.g. when displaying context menu by right click
            evt.preventDefault();
            evt.stopPropagation();
            this.canvas.setAttribute('data-hover', 1); // for touch events
            //this.pressed = IsPressed(this, evt);
            this.editingStarted = true;
            this.updateBigRating();
        }
    }

    mouseUpHandler(evt) {
        evt.preventDefault();
        if (this.editingStarted) {
            let x = evt.clientX - this.canvas.getBoundingClientRect().left;
            x = this.XtoRating(x, this.starWidth + 2 * this.starMargin);
            this.setRating(x, {
                force: true
            }); // @ts-ignore
            if (this.onchange) { // @ts-ignore
                this.onchange(x);
            }
        }
        this.pressed = false;
        this.editingStarted = false;
        this.updateBigRating();
    }

    mouseOutHandler(evt) {
        let totalpos = this.canvas.getBoundingClientRect();
        let x = evt.clientX - totalpos.left;
        let y = evt.clientY - totalpos.top;
        if ((x <= 0) || (y <= 0) || (x >= totalpos.width) || (y >= totalpos.height)) {
            this.canvas.removeAttribute('data-hover');
            this.setRating(this._value, {
                force: true
            });
            if (this._globalListenerSet) {
                app.unlisten(window, 'mousemove', this._globalListenerSet, true);
                this._globalListenerSet = undefined;
            }
            this.pressed = false;
            this.editingStarted = false;
        }
        this.updateBigRating();
    }

    keyDownHandler(evt) {
        switch (friendlyKeyName(evt)) {
        case 'Left': // left
        case 'Down': // down
        {
            let val = this.tempvalue - 10;
            if (val < 0) {
                if (this.useUnknown)
                    val = -1;
                else
                    val = 0;
            } else
                val = 10 * Math.round(val / 10);
            this.setRating(val, {
                force: true,
                temporary: this.keyMode
            });
            evt.stopPropagation();
            break;
        }
        case 'Up': // up
        case 'Right': // right
        {
            let val: number;
            if (this._value < 0) {
                val = 0;
            } else {
                val = this.tempvalue + 10;
                val = 10 * Math.round(val / 10);
            }
            this.setRating(val, {
                force: true,
                temporary: this.keyMode
            });
            evt.stopPropagation();
            break;
        }
        case '1': 
        {
            this.setRating(20, {
                force: true,
                temporary: this.keyMode
            });
            evt.stopPropagation();
            break;
        }
        case '2': 
        {
            this.setRating(40, {
                force: true,
                temporary: this.keyMode
            });
            evt.stopPropagation();
            break;
        }
        case '3': 
        {
            this.setRating(60, {
                force: true,
                temporary: this.keyMode
            });
            evt.stopPropagation();
            break;
        }
        case '4': 
        {
            this.setRating(80, {
                force: true,
                temporary: this.keyMode
            });
            evt.stopPropagation();
            break;
        }
        case '5': 
        {
            this.setRating(100, {
                force: true,
                temporary: this.keyMode
            });
            evt.stopPropagation();
            break;
        }
        case 'Esc':
        {
            if(this.keyMode) {
                this.setRating(this._value, {
                    force: true
                });
                this.canvas.blur();
                this.requestFrame(()=> {
                    this.container.focus();
                    setFocusState(this.container, true);
                });
                evt.stopPropagation();
                this.keyMode = false;
            }
            break;
        }
        case 'Enter':
        {
            if(this.keyMode) {
                if(this.tempvalue !== this._value) {
                    this.setRating(this.tempvalue, {
                        force: true
                    });    
                    this.canvas.blur();
                    this.requestFrame(()=> {
                        this.container.focus();
                        setFocusState(this.container, true);
                    });
                    evt = createNewEvent('change');
                    this.container.dispatchEvent(evt);
                }
                evt.stopPropagation();
                this.keyMode = false;
            }
            break;    
        }        
        }
    }

    dblClickHandler(evt) {
        if (this._readOnlyChangeTime) {
            if ((Date.now() - this._readOnlyChangeTime) < 500) // doubleclick just after removing readonly, do not handle as dblclick, #15702
                return;
        }
        this.removeRating();
        evt.stopPropagation();
    }

    updateControl() {

        if (!this.readOnly && !this.disabled) {
            if (!this.listenersSet) {
                let canvas = this.canvas;


                app.listen(canvas, 'mouseover', (e) => { this.mouseOverHandler(e); });
                app.listen(canvas, 'mousedown', (e) => { this.mouseDownHandler(e); });
                app.listen(canvas, 'click', (e) => {
                    this.keyMode = false;
                    setFocusState(this.container, false);
                    e.stopPropagation(); // #15431
                });
                app.listen(canvas, 'touchstart', (e) => { this.touchStartHandler(e); });
                app.listen(canvas, 'touchmove', (e) => { this.touchMoveHandler(e); });
                app.listen(canvas, 'mouseup', (e) => { this.mouseUpHandler(e); });
                app.listen(canvas, 'touchend', (e) => { this.touchEndHandler(e); });
                app.listen(canvas, 'mouseout', (e) => { this.mouseOutHandler(e); });
                app.listen(canvas, 'keydown', (e) => { this.keyDownHandler(e); });
                app.listen(canvas, 'dblclick', (e) => { this.dblClickHandler(e); });
                app.listen(canvas, 'blur', (e) => {
                    if(this.keyMode) {
                        if(this.tempvalue !== this._value) {
                            this.setRating(this.tempvalue, {
                                force: true
                            });    
                            e = createNewEvent('change');
                            this.container.dispatchEvent(e);
                        }
                    }
                    e.stopPropagation();   
                    this.keyMode = false;
                });
                app.listen(this.container, 'keydown', (e) => { 
                    let key = friendlyKeyName(e);
                    if(key === 'F2') {
                        this.focus(true);
                        e.stopPropagation();
                    }
                });
                this.listenersSet = true;
                canvas.style.paddingLeft = this.canvasPaddingLeft;
                canvas.style.paddingRight = this.canvasPaddingRight;
            }
            if (this.tabbable)
                this.canvas.tabIndex = 0; // makes it tabable and able to catch keys
            else {
                this.canvas.tabIndex = -1;
                //this.canvas.removeAttribute('tabIndex');
            }
        } else {
            if (this.listenersSet) {
                app.unlisten(this.canvas);
                this.listenersSet = false;
            }
            let both = (this.readOnlyPadding === 'both');
            if (both || (this.readOnlyPadding === 'left'))
                this.canvas.style.paddingLeft = this.canvasPaddingLeft;
            else
                this.canvas.style.paddingLeft = '';
            if (both || (this.readOnlyPadding === 'right'))
                this.canvas.style.paddingRight = this.canvasPaddingRight;
            else
                this.canvas.style.paddingRight = '';

            //this.canvas.removeAttribute('tabIndex');
            this.canvas.tabIndex = -1;
        }
    }

    XtoRating(x, w) { // convert mouse position and star width to rating
        let w2 = this.canvasPaddingLeftPx;
        let w3 = 5 * w + w2;
        if (x < w2)
            x = w2;
        if (x > w3)
            x = w3;
        x = Math.floor(2 * ((x - w2) / w + 0.49)) / 2.0; // round to halves
        return 20.0 * x;
    }

    canFocus() {
        return !this._disabled && !this._readOnly;
    }

    removeRating() {
        this.setRating(-1, {
            force: true
        });
    }

    setRating(val, params?) {
        params = params || {};
        if (!params.force && (this.tempvalue !== this._value) && !params.temporary) // displayed temp value, do not change to avoid #18238
            return;
        let rating = val;
        if (rating > 100)
            rating = 100;
        if (rating < -1)
            rating = -1;
        if (!params.temporary && (rating === this._value) && (this.tempvalue === this._value) && (rating > 0)) {
            return;
        }
        this.tempvalue = rating;
        if (rating < 0) {
            if (this.useUnknown && this.readOnly) { // unknown text used only for readOnly, we must allow to edit stars otherwise
                this.canvas.removeAttribute('data-unknown');
                for (let i = 0; i < 5; i++) {
                    if (this.stars[i])
                        this.stars[i].style.display = 'none';
                }
                if (!this.unknownDiv) {
                    this.unknownDiv = document.createElement('div');
                    this.unknownDiv.className = 'unknownText';
                    this.unknownDiv.style.width = '100%';
                    this.canvas.appendChild(this.unknownDiv);
                    this.unknownDiv.innerText = this.unkownText;
                }
                this.unknownDiv.style.display = 'inline-block';
                if (!params.temporary) {
                    this._value = rating;
                }
                return;
            } else {
                rating = 0;
                this.canvas.setAttribute('data-unknown', 1);
            }
        } else
            this.canvas.removeAttribute('data-unknown');
        if (this.unknownDiv)
            this.unknownDiv.style.display = 'none';
        for (let i = 0; i < 5; i++) {
            if (this.stars[i])
                this.stars[i].style.display = 'inline-block';
        }

        rating = (Number(rating) + 4) / 20.0; // +4 because of #18306: Songs with rating 76 are interpreted as 3.5 stars (used to be 4 stars in MM4)

        let i = 0;
        for (; i < Math.floor(rating); i++) {
            if (this.stars[i]) {
                this.stars[i].removeAttribute('data-emptystar');
                this.stars[i].removeAttribute('data-halfstar');
                this.stars[i].setAttribute('data-fullstar', 1);
            }
        }
        if ((rating - Math.floor(rating)) >= 0.5) {
            if (this.stars[i]) {
                this.stars[i].removeAttribute('data-emptystar');
                this.stars[i].removeAttribute('data-fullstar');
                this.stars[i].setAttribute('data-halfstar', 1);
            }
            rating = i + 1;
        }
        for (i = Math.floor(rating); i < 5; i++) {
            if (this.stars[i]) {
                this.stars[i].removeAttribute('data-fullstar');
                this.stars[i].removeAttribute('data-halfstar');
                this.stars[i].setAttribute('data-emptystar', 1);
            }
        }
        if (!params.temporary) {
            let changed = (this._value !== this.tempvalue);
            this._value = this.tempvalue;
            if (changed && !params.disableChangeEvent) {
                let evt;
                evt = createNewEvent('change');
                this.container.dispatchEvent(evt);
            }
        }
    }

    updateBigRating() {
        if (!this.useBigRating || this.disabled || this.readOnly)
            return;
        if (!this.bigRating && this.pressed) {
            this.bigRating = document.createElement('div');
            this.bigRating.className = 'ratingPreview';
            this.bigRating.style.position = 'absolute';
            let pos = this.container.getBoundingClientRect();
            this.bigRating.style.top = Math.max(pos.top - 90, 0) + 'px';
            this.bigRating.style.left = Math.max(pos.left + pos.width / 2 - 300 / 2, 0) + 'px';
            this.bigRatingCtrl = new Rating(this.bigRating, {
                useBigRating: false,
                starWidth: '2.9em',
                starMargin: '0.36em',
                disabled: true,
                readOnly: true
            });
            this.bigRating.style.display = 'inline-block';
            document.body.appendChild(this.bigRating);
        }
        if (this.pressed) {
            this.bigRatingCtrl.setRating(this.tempvalue);
        } else if (this.bigRating) {
            document.body.removeChild(this.bigRating);
            this.bigRating = null;
            delete (this.bigRatingCtrl);
            this.bigRatingCtrl = null;
        }
    }

    ignoreHotkey(hotkey) {
        let ar = ['Right', 'Left', 'Up', 'Down'];
        return inArray(hotkey, ar, true /* ignore case */);
    }

    /**
    Sets the focus on the control

    @method focus
    */
    focus(byKey?: boolean) {
        this.canvas.focus();
        if(byKey) {
            this.keyMode = true;
            setFocusState(this.canvas, true);
        }
    }

    /**
    Should clean up all the control stuff, i.e. mainly unlisten events.

    @method cleanUp
    */
    cleanUp() {
        app.unlisten(this.canvas);
        super.cleanUp();
    }

    storeState() {
        return {
            value: this.value
        } as ControlState;
    }

    restoreState(fromObject) {
        if (fromObject.value !== undefined)
            this.value = fromObject.value;
    }

    /**
    Gets/sets value of the rating (-1 - 100). Value -1 is allowed only for rating with useUnknown property set to true.

    @property value
    @type integer
    */
    get value() {
        return this._value;
    }
    set value(val) {
        this.setRating(val, {
            disableChangeEvent: true /* do not call change event, we are setting (initial) value programatically */
        });
    }


    /**
    If true, makes rating control readOnly

    @property readOnly
    @type boolean
    @default false
    */
    get readOnly() {
        return this._readOnly;
    }
    set readOnly(val) {
        if (val === this._readOnly)
            return;
        let lastVal = this._readOnly;
        this._readOnly = val;
        if (val) {
            this.canvas.setAttribute('data-readonly', 1);
            if(this.canvas.tooltipValueCallback)
                delete this.canvas.tooltipValueCallback;
        } else {
            this.canvas.removeAttribute('data-readonly');
            // set time to detect doubleclick just after change, but ignore during initialization
            if (lastVal !== undefined)
                this._readOnlyChangeTime = Date.now();
            this.canvas.tooltipValueCallback = function (tipdiv, vis) { // #20919
                tipdiv.innerText = '';
                return;
            };
        }
        if (this._initialized)
            this.updateControl();
    }


    /**
    If true, makes rating control tabbable

    @property tabbable
    @type boolean
    @default false
    */
    get tabbable() {
        return this._tabbable;
    }
    set tabbable(val) {
        if (val === this._tabbable)
            return;
        this._tabbable = val;
        if (this._initialized)
            this.updateControl();
    }

}
registerClass(Rating);

/**
Returns HTML code - div containing rating stars based on passed params.

@method getHTML
@static
@param {Object} params Rating control parameters, should include at least value (requsted number of stars) and starWidth properties.
@return {string} HTML code for rating stars
*/

Rating.getHTML = function (params) {
    let control = document.createElement('div');
    params = params || {};
    params.readOnly = true;
    params.nouniqueid = true;
    control.controlClass = new Rating(control, params);
    control.removeAttribute('data-control-class'); // to avoid reinitializing of control, we need only raw html
    control.setAttribute('data-html', '1');
    let retval = control.outerHTML;
    control.controlClass.cleanUp();
    control.controlClass = undefined;
    return retval;
};
