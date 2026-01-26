'use strict';

registerFileImport('controls/tooltipController');

/**
@module UI
*/

import Control from './control';

/**
Class for tooltips. Gets tooltip value from element's data-tip attribute or title attribute.

@class TooltipController
@constructor
@extends Control
*/

export default class TooltipController extends Control {
    private _mouseLeaveHandler: (evt: any) => void;
    private _scrollHandler: () => void;
    private _mouseDownHandler: (evt: any) => void;
    private _disableTooltips: () => void;
    private _enableTooltips: () => void;
    private _mouseUpHandler: any;

    lastElementPos: {
        left: number;
        right: number;
        top: number;
        bottom: number;
    };    

    initialize(parentel, params) {
        super.initialize(parentel, params);
        this.container.classList.add('tooltip');
        this.container.classList.add('animate');
        this.container.classList.add('ignoreMouse');
        this.container.style.display = 'none';
        let tipOffsetHoriz = -5;
        let tipOffsetTop = 2;
        let tipOffsetBottom = 20;
        let lastmovetime = 0;
        let mouseX = -1;
        let mouseY = -1;
        let mousedown = false;
        let lastElement: Maybe<HTMLElement> = undefined;
        let lastTopElement = undefined;
        let doNotShow = false;
        let _this = this;
        let windowIsActive = isStub;

        let hideTip = function () {
            setVisibilityFast(_this.container, false);
            if (lastElement && lastElement.tooltipValueCallback) {
                lastElement.tooltipValueCallback(_this.container, false, {}); // so caller can react to tooltip hiding
            }
        };

        let findTipElement = function (el) {
            if ((el.tooltipValueCallback) || el.hasAttribute('title') || el.hasAttribute('data-tip')) {
                lastElement = el;
            } else {
                if (getParent(el))
                    findTipElement(getParent(el));
            }
        };

        let getTipValue = function () {
            if (!lastElement)
                return '';

            let res : string | null = '';
            if (lastElement.hasAttribute('data-tip'))
                res = lastElement.getAttribute('data-tip');
            else if (lastElement.hasAttribute('title'))
                res = lastElement.getAttribute('title');
                
            if (res != '') {
                res = _(res); //  translate
                res = replaceAll('\n', '</br>', res);
            }
            if (res)
                return sanitizeHtml(res.toString());
            else
                return '';    
        };

        let displayTip = function (forceUpdate?:boolean) {
            if (mousedown || !lastElement || doNotShow || !windowIsActive) {
                return;
            }
            if (!_this.visible || forceUpdate) {
                let displayParams: AnyDict = {
                    limitWidth: true
                };
                if (lastElement.tooltipValueCallback) {
                    lastElement.tooltipValueCallback(_this.container, true, displayParams);
                } else {
                    _this.container.innerHTML = getTipValue();
                }
                if (_this.container.innerHTML === '')
                    return; // empty - do not display

                if (displayParams.limitWidth)
                    _this.container.classList.add('tooltipMaxWidth');
                else
                    _this.container.classList.remove('tooltipMaxWidth');

                setVisibilityFast(_this.container, true);
                // first set tooltip to left top corner, so tooltip can expand as much as possible. It is needed for reading correct offset size of this tooltip control
                _this.container.style.top = '0px';
                _this.container.style.left = '0px';
                let w = _this.container.offsetWidth;
                let h = _this.container.offsetHeight;
                let wbounds = window.bounds;

                let x = mouseX + tipOffsetHoriz;
                if (displayParams.posX)
                    x = displayParams.posX;
                if ((x + w + 2) > wbounds.clientWidth) {
                    x = wbounds.clientWidth - 2 + tipOffsetHoriz - w;
                    if (x < 1)
                        x = 1;
                }
                let y = mouseY + tipOffsetBottom;
                if (displayParams.posY)
                    y = displayParams.posY;
                if ((y + h + 2) >= wbounds.clientHeight) {
                    y = mouseY - h - tipOffsetTop;
                    if (y < 1)
                        y = 1;
                }
                _this.container.style.top = y + 'px';
                _this.container.style.left = x + 'px';
                if (displayParams.height)
                    _this.container.style.height = displayParams.height;
                if (lastElement) {
                    let pgPos = lastElement.getBoundingClientRect();
                    _this.lastElementPos = {
                        left: pgPos.left,
                        right: pgPos.right,
                        top: pgPos.top,
                        bottom: pgPos.bottom
                    };
                }
            } else {
                if (!lastElement.tooltipValueCallback) {
                    _this.container.innerHTML = getTipValue();
                    _this.notifyContentChange();
                }
            }
        };

        let checktimer = function () {
            if (mousedown || !lastElement || doNotShow || !windowIsActive) {
                return;
            }
            let diff = Date.now() - lastmovetime;
            if (diff >= _this.delay) {
                displayTip();
            } else {
                _this.requestTimeout(checktimer, _this.delay - diff, 'checkTimer', true);
            }
        };

        this._mouseMoveHandler = function (evt) {
            if (evt && (evt.which === 0)) {
                if (_this._mouseUpHandler) {
                    app.unlisten(window, 'mouseup', _this._mouseUpHandler, true);
                    _this._mouseUpHandler = undefined;
                }
                mousedown = false;
            }
            if ((mouseX !== evt.clientX) || (mouseY !== evt.clientY)) {
                lastmovetime = Date.now();
                mouseX = evt.clientX;
                mouseY = evt.clientY;

                if (_this.visible && _this.lastElementPos) {
                    let pos = _this.lastElementPos;
                    if ((mouseX < pos.left) || (mouseX > pos.right) || (mouseY < pos.top) || (mouseY > pos.bottom))
                        hideTip();
                    else if (lastElement && lastElement.tooltipImmediate) {
                        displayTip(true);
                    }
                    // following is commented out as it causes issue #19273
                    // else
                    //    hideTip(); 
                }
            }
            if (lastTopElement != evt.target) {
                lastTopElement = evt.target;
                lastElement = undefined;
                findTipElement(lastTopElement);
            }
            if (!mousedown && lastElement && !doNotShow) {
                if (lastElement.tooltipImmediate) {
                    displayTip();
                } else {
                    _this.requestTimeout(checktimer, _this.delay, 'checkTimer', true);
                }
            }
        };

        let mouseUpHandler = function () {
            mousedown = false;
            if (_this._mouseUpHandler) {
                app.unlisten(window, 'mouseup', _this._mouseUpHandler, true);
                _this._mouseUpHandler = undefined;
            }
        };

        this._mouseDownHandler = function () {
            mousedown = true;
            if (_this.visible)
                hideTip();
            if (!_this._mouseUpHandler)
                _this._mouseUpHandler = app.listen(window, 'mouseup', mouseUpHandler, true);
        };

        this._scrollHandler = function () {
            if (_this.visible)
                hideTip();
        };
        this._mouseLeaveHandler = function (evt) {
            if (evt.clientY <= 0 || evt.clientX <= 0 || (evt.clientX >= window.innerWidth || evt.clientY >= window.innerHeight)) {
                if (_this.visible) {
                    hideTip();
                }
                lastElement = undefined;
                lastTopElement = undefined;
                mouseX = -1;
                mouseY = -1;
            }
        };
        this.localListen(window, 'mousedown', this._mouseDownHandler, true);
        this.localListen(window, 'mousemove', this._mouseMoveHandler, true);
        this.localListen(window, 'scroll', this._scrollHandler, true);
        this.localListen(window.document, 'mouseleave', this._mouseLeaveHandler);
        this.localListen(window.thisWindow, 'activated', function (active) {
            if(!active && _this.visible) {
                hideTip();
            }
            windowIsActive = active;
        });        
        this._disableTooltips = function () {
            doNotShow = true;
            if (getDocumentBody().contains(_this.container)) {
                hideTip();
            }
        };
        
        this._enableTooltips = function () {
            doNotShow = false;
        };
        
    }
    
    disableTooltips() {
        this._disableTooltips();
    }
    
    enableTooltips() {
        this._enableTooltips();
    }

    notifyContentChange() {
        if (!this.container)
            return;
        let wbounds = window.bounds;

        if ((this.container.offsetLeft + this.container.offsetWidth) >= wbounds.clientWidth) {
            this.container.style.left = Math.max(wbounds.clientWidth - this.container.offsetWidth - 1, 0) + 'px';
        }
        if ((this.container.offsetTop + this.container.offsetHeight) >= wbounds.clientHeight) {
            this.container.style.top = Math.max(wbounds.clientHeight - this.container.offsetHeight - 1, 0) + 'px';
        }
    }

    manualMouseUpdate(evt) {
        if (this._mouseMoveHandler)
            this._mouseMoveHandler(evt);
    }

    cleanUp() {
        if (this._mouseUpHandler) {
            app.unlisten(window, 'mouseup', this._mouseUpHandler, true);
            this._mouseUpHandler = undefined;
        }

        super.cleanUp();
    }

    /**
    Tooltip delay, in ms.

    @property delay
    @type Number
    */    
    get delay () {
        return 500;
    }
    
}
registerClass(TooltipController);
