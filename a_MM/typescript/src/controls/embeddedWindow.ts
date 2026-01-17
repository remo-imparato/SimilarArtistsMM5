registerFileImport('controls/embeddedWindow');

'use strict';

import Control from './control';


/**
@module UI snippets
*/


/**
EmbeddedWindow - control for embedding window with custom content

@class EmbeddedWindow
@constructor
@extends Control
*/

class EmbeddedWindow extends Control {
    private _windowCreated: boolean;
    private _access: boolean;
    private _url: string;
    private _type: string;
    private _current: boolean;
    private _initializationDone: boolean;
    private _window: any;
    private _inTab: boolean;
    private _multiViewUID: string;
    private _lastUrl: string;
    private _lastUniqueID: string;
    private _lastType: string;
    private _lastVis: boolean;
    private _lastCurrent: boolean;
    private _lastPos: DOMRect;
    private _lastSize: { width: number; height: number; };    
    private _pos: DOMRect;
    layoutChanged: any;
    windowCreated: any;
    private _size: { width: number; height: number; };

    initialize(elem, params) {
        super.initialize(elem, params);

        this._windowCreated = false;
        this._access = true;

        this.layoutChanged = function (e) {
            this.requestFrame(this.updateWindow.bind(this), 'updateWindow'); // async, otherwise bounding client rectangle has sometime old values yet, e.g. when switching main tab
        }.bind(this);

        this.windowCreated = function (uid, wndType) {
            if (uid == this.uniqueID) {
                app.unlisten(thisWindow, 'embeddedWindowCreate', this.windowCreated);
                this._windowCreated = true;
                this.raiseEvent('created', {}, true, true);
            }
        }.bind(this);

        this.localListen(this.container, 'layoutchange', this.layoutChanged);
        app.listen(thisWindow, 'embeddedWindowCreate', this.windowCreated);
        
        const resizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
                if (entry.target === this.container) {
                    this.requestFrame(this.updateWindow.bind(this), 'updateWindow');
                }
            }
        });
        
        resizeObserver.observe(this.container);
        this._url = '';
        this._type = '';
        this._current = false;
        this._initializationDone = false;

        // set passed attributes
        for (let key in params) {
            this[key] = params[key];
        }

        this.container.classList.add('fill');

        this._inTab = !(!this.parentView);
        this._multiViewUID = '';
        if (this._inTab) {
            let parent = getParent(this.container);
            while (parent) {
                if (parent.controlClass && parent.controlClass.constructor.name == 'Multiview') {
                    this._multiViewUID = parent.controlClass.uniqueID;
                    break;
                }
                parent = getParent(parent);
            }
        }

        this._initializationDone = true;
        this.updateWindow();
    }

    cleanUp() {
        ODS('embeddedWindow cleanup begin');
        if (!this._windowCreated)
            app.unlisten(thisWindow, 'embeddedWindowCreate', this.windowCreated);
        
        app.unlisten(this._window, 'initialized');
        app.unlisten(this._window, 'ready');
        app.unlisten(this._window, 'mousestatechanged');
        
        this.hideWindow().then(function (wnd) {
            if (wnd)
                app.unlisten(wnd, 'mousestatechanged');
        });
        super.cleanUp();
        ODS('embeddedWindow cleanup done');
    }

    hideWindow() {
        ODS('embeddedWindow hideWindow');
        return handleEmbeddedWindow({
            uid: this.uniqueID,
            show: false,
            unregister: true
        });
    }

    setWindowHandler(el) {
        el.appendChild(this.container);
        this.updateWindow();
    }

    _readyHandler(e) {
        app.unlisten(this._window, 'ready');
        this.raiseEvent('ready', {}, false, false);
    }

    _mouseState(x, y, hitTest, lButtonDown, mButtonDown, rButtonDown, lButtonDblClick, mButtonDblClick, rButtonDblClick) {
        this.raiseEvent('mousestatechanged', {
            x: x,
            y: y,
            hitTest: hitTest,
            lButtonDown: lButtonDown,
            mButtonDown: mButtonDown,
            rButtonDown: rButtonDown,
            lButtonDblClick: lButtonDblClick,
            mButtonDblClick: mButtonDblClick,
            rButtonDblClick: rButtonDblClick
        }, false, false);
    }

    updateWindow(force?:boolean) {
        let _this = this;
        if (this._initializationDone) {
            this._pos = this.container.getBoundingClientRect();
            this._size = {
                width: this._pos.width,
                height: this._pos.height
            };

            let isCurrentTab = (window.currentTabControl && window.currentTabControl.multiviewControl.uniqueID == this._multiViewUID) ||
                (!this._inTab); // tabless or current tab
            let vis = (isVisible(this.container, true) && isCurrentTab) || !!force;
            if ((this.uniqueID != this._lastUniqueID || this._url != this._lastUrl || this._type != this._lastType ||
                vis != this._lastVis || this._current != this._lastCurrent || this._pos != this._lastPos ||
                this._size != this._lastSize) || (force)) {

                this._lastUniqueID = this.uniqueID;
                this._lastUrl = this._url;
                this._lastType = this._type;
                this._lastVis = vis;
                this._lastCurrent = this._current;
                this._lastPos = this._pos;
                this._lastSize = this._size;

                handleEmbeddedWindow({
                    uid: this.uniqueID,
                    url: this._url,
                    type: this._type,
                    show: vis,
                    current: this._current,
                    left: this._pos.left,
                    top: this._pos.top,
                    width: this._size.width,
                    height: this._size.height,
                    access: this._access,
                    ischild: true,
                    forced: force
                }).then(function (wnd) {
                    if (!_this._window) {
                        _this._window = wnd;
                        if (_this._access && (_this._type === 'browser')) {
                            let initListener;
                            initListener = app.listen(_this._window, 'initialized', function () {
                                app.unlisten(_this._window, 'initialized', initListener);
                                _this.raiseEvent('initialized', {}, true, true);
                            });
                            app.listen(_this._window, 'ready', _this._readyHandler.bind(_this));
                            app.listen(_this._window, 'mousestatechanged', _this._mouseState.bind(_this));
                        } else if (_this._type != '' && _this._type != 'browser') { // video window and other non-browser windows                        
                            app.listen(_this._window, 'ready', _this._readyHandler.bind(_this));
                            app.listen(_this._window, 'mousestatechanged', _this._mouseState.bind(_this));
                        }
                    }
                });

                this.raiseEvent('update', {
                    position: this._pos,
                    size: this._size
                }, true, true);
            }
        }
    }

    makeCurrent() {
        this._current = true;
        this.updateWindow();
    }

    getPos() {
        return this._pos;
    }

    getSize() {
        return this._size;
    }
    
    get url () {
        return this._url;
    }
    set url (value) {
        this._url = value;
        this.updateWindow();
    }    
    
    get type () {
        return this._type;
    }
    set type (value) {
        this._type = value;
        this.updateWindow();
    }
        
    get created () {
        return this._windowCreated;
    }
        
    get access () {
        return this._access;
    }
    set access (value) {
        this._access = value;
    }
        
    get window () {
        return this._window;
    }
    
}
registerClass(EmbeddedWindow);
