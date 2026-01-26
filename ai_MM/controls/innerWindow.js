/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

/**
Base class for inner "window" in html

@class InnerWindow
@constructor
*/
window.InnerWindow = function (params) {
    this.windowDiv = document.createElement('div');
    this.windowDiv.classList.add('innerWindow');
    this._left = 0;
    this._top = 0;
    this._width = 0;
    this._height = 0;
    var _this = this;

    this.bounds = new function () {
        Object.defineProperty(this,
            'left', {
                get: function () {
                    return _this._left;
                },

                set: function (value) {
                    _this._left = value;
                    if (_this.windowDiv)
                        _this.windowDiv.style.left = (value - window.bounds.clientRect.left) + 'px';
                }
            });

        Object.defineProperty(this,
            'top', {
                get: function () {
                    return _this._top;
                },

                set: function (value) {
                    _this._top = value;
                    if (_this.windowDiv)
                        _this.windowDiv.style.top = (value - window.bounds.clientRect.top) + 'px';
                }
            });

        Object.defineProperty(this,
            'width', {
                get: function () {
                    return _this._width;
                },

                set: function (value) {
                    _this._width = value;
                    if (_this.windowDiv) {
                        if (value > 0)
                            _this.windowDiv.style.width = value + 'px';
                        else
                            _this.windowDiv.style.width = '';
                    }
                }
            });

        Object.defineProperty(this,
            'height', {
                get: function () {
                    return _this._height;
                },

                set: function (value) {
                    _this._height = value;
                    if (_this.windowDiv) {
                        if (value > 0)
                            _this.windowDiv.style.height = value + 'px';
                        else
                            _this.windowDiv.style.height = '';
                    }
                }
            });

        this.setBounds = function (l, t, w, h) {
            this.bounds.left = l;
            this.bounds.top = t;
            this.bounds.width = w;
            this.bounds.height = h;
        }.bind(_this);

        this.setSize = function (w, h) {
            this.bounds.width = w;
            this.bounds.height = h;
        }.bind(_this);
    };
    for (var key in params) {
        this[key] = params[key];
    }
    if (params.left)
        this.bounds.left = params.left;
    if (params.top)
        this.bounds.top = params.top;
    if (params.width)
        this.bounds.width = params.width;
    if (params.height)
        this.bounds.height = params.height;
    document.body.appendChild(this.windowDiv);
}

Object.defineProperty(InnerWindow.prototype,
    'innerWidth', {
        get: function () {
            if (this.windowDiv)
                return this.windowDiv.offsetWidth;
            else
                return 0;
        },
    });

Object.defineProperty(InnerWindow.prototype,
    'innerHeight', {
        get: function () {
            if (this.windowDiv)
                return this.windowDiv.offsetHeight;
            else
                return 0;
        },
    });

Object.defineProperty(InnerWindow.prototype,
    'clientX', {
        get: function () {
            if (this.windowDiv)
                return this.windowDiv.offsetLeft;
            else
                return 0;
        },
    });

Object.defineProperty(InnerWindow.prototype,
    'clientY', {
        get: function () {
            if (this.windowDiv)
                return this.windowDiv.offsetTop;
            else
                return 0;
        },
    });

InnerWindow.prototype.setValue = function (key, value) {
    this[key] = value;
}

InnerWindow.prototype.getValue = function (key) {
    return this[key];
}

InnerWindow.prototype.show = function () {
    if (this.windowDiv)
        this.windowDiv.style.display = 'block';
}

InnerWindow.prototype.hide = function () {
    if (this.windowDiv)
        this.windowDiv.style.display = 'none';
}

InnerWindow.prototype.closeWindow = function () {
    if (!this.windowDiv)
        return;
    if (this.closed)
        this.closed();
    if (this.windowDiv.parentNode === document.body) {
        var lastWindowDiv = this.windowDiv;
        requestTimeout(function () {
            if (lastWindowDiv.parentNode === document.body)
                removeElement(lastWindowDiv); // give some time to process needed events before destroying all, #16773
        }, 1);
    }
    this.windowDiv = undefined;
}

InnerWindow.prototype.addEventListener = function (eventName, func, useCapture) {
    if (this.windowDiv)
        app.listen(this.windowDiv, eventName, func, useCapture);
}

InnerWindow.prototype.removeEventListener = function (eventName, func, useCapture) {
    if (this.windowDiv)
        app.unlisten(this.windowDiv, eventName, func, useCapture);
}
