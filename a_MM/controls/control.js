/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

'use strict';
import { DRAG_CONTROL } from '../consts';
/**
@module UI
*/
registerFileImport('controls/control');
/**
Base class for all UI controls

@class Control
@constructor
*/
export default class Control {
    constructor(elem, params) {
        this.initialize(elem, params);
        // LS: Following moved from classCreation to support ES6 class inheritance via extends
        // check data-control-class attribute, add in case it is not present yet
        if (elem && elem.hasAttribute && !elem.hasAttribute('data-control-class')) {
            elem.setAttribute('data-control-class', 'Control');
        }
        // set passed attributes
        for (let key in params) {
            this[key] = params[key];
        }
        if (elem && elem.hasAttribute && elem.hasAttribute('data-control-default-focus')) {
            this.container.focus();
        }
    }
    initialize(elem, params) {
        this.container = elem;
        if (this.constructor.name)
            this.container.setAttribute('data-control-class', this.constructor.name);
        this.disabledCounter = 0;
        this._disabled = false;
        // MP: commented out, it caused problems with TAB navigation inside genre popup, not sure why it was ever needed
        //        if (!this.noFocusOnClick && (!params || !params.noFocusOnClick) && (this.container.tabIndex == -1))
        //            this.container.tabIndex = -1; // for some reason this assignment is needed to get focus after click (for F1 to work)
        this._tabIndex = this.container.tabIndex;
        this._hasSplitters = false;
        this._dockable = this.container.hasAttribute('data-dockable');
        this._isDock = this.container.hasAttribute('data-dock');
        this._controlTitle = '';
        if (this.container.hasAttribute('data-dock-title-LC')) {
            this._controlTitle = String(this.container.getAttribute('data-dock-title-LC'));
        }
        else if (this.container.hasAttribute('data-dock-title')) {
            this._controlTitle = _(this.container.getAttribute('data-dock-title'));
            this.container.setAttribute('data-dock-title-LC', this._controlTitle);
        }
        else if (this.container.hasAttribute('data-id')) {
            this._controlTitle = String(this.container.getAttribute('data-id'));
        }
        this._localPromises = [];
        this._dataSourceListenFuncts = [];
        this.disableStateStoring = false;
        if (params && params.resizable) {
            this.resizable = params.resizable;
        }
        if (params && params.hasSplitters) {
            this.hasSplitters = params.hasSplitters;
        }
        if (this.container.hasAttribute('data-disabled'))
            this.disabled = true;
        if (params) {
            this.mergeParentContextMenu = params.mergeParentContextMenu || false;
            if (params.closable && !window.settings.UI.disableRepositioning) {
                this.closediv = document.createElement('div');
                this.closediv.className = 'hoverHeader animate closeButton';
                this.closediv.setAttribute('data-hideInFullWindowMode', '1');
                loadIconFast('close', (icon) => {
                    assert(icon, 'Could not load close icon!');
                    assert(this.closediv, 'closediv is not defined!');
                    setIconFast(this.closediv, icon);
                    setIconAriaLabel(this.closediv, _('Close'));
                });
                this.container.appendChild(this.closediv);
                let hideTimer = undefined;
                let setCloseIconVis = (vis) => {
                    if (!this._cleanUpCalled && this.closediv)
                        setVisibility(this.closediv, vis, {
                            layoutchange: false
                        });
                };
                let cancelAutohide = function () {
                    if (hideTimer)
                        clearTimeout(hideTimer);
                };
                let startAutohide = function () {
                    cancelAutohide();
                    hideTimer = setTimeout(function () {
                        setCloseIconVis(false);
                    }, 2000);
                };
                this._mouseOutHandler = (evt) => {
                    cancelAutohide();
                    setCloseIconVis(false);
                };
                let lastX = 0;
                let lastY = 0;
                this._mouseMoveHandler = (evt) => {
                    if (!(evt instanceof MouseEvent))
                        return;
                    if ((lastX === evt.screenX) && (lastY === evt.screenY))
                        return;
                    lastX = evt.screenX;
                    lastY = evt.screenY;
                    if (!window.fullWindowModeActive) { // do not show in fullwindow mode
                        setCloseIconVis(true);
                        startAutohide();
                    }
                };
                setCloseIconVis(false);
                this.getCloseButtonAction = () => {
                    assert(this.closediv);
                    return this.closediv.action;
                };
                this.setCloseButtonAction = (action) => {
                    assert(this.closediv);
                    this.closediv.action = action;
                    let title = '';
                    if (action && action.title) {
                        title = uitools.getPureTitle(action.title);
                        if (title !== _('Close'))
                            title = _('Close') + ' ' + title; // #19448
                    }
                    this.closediv.setAttribute('data-tip', title);
                };
                this.setCloseButtonAction(params.closeAction);
                app.listen(this.container, 'mouseout', this._mouseOutHandler);
                app.listen(this.container, 'mousemove', this._mouseMoveHandler);
                app.listen(this.closediv, 'click', (e) => {
                    assert(this.closediv);
                    if (this.closediv.action && this.closediv.action.execute && isFunction(this.closediv.action.execute)) {
                        this.closediv.action.execute();
                        e.stopPropagation();
                    }
                });
            }
            if (params.resizable) {
                this.resizediv = document.createElement('div');
                this.container.appendChild(this.resizediv);
                let mouseMoveHandler;
                let mouseUpHandler = (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    app.unlisten(window, 'mouseup', mouseUpHandler, true);
                    app.unlisten(window, 'mousemove', mouseMoveHandler, true);
                    document.body.style.cursor = ''; // JL: Editing style.cursor instead of changing document.body's class
                    this._resizing = false;
                };
                let lastSize = 0;
                if (params.resizable === 'horizontal') {
                    this.resizediv.className = 'resizeHorizontal';
                    if (params.splitterPosition && (params.splitterPosition === 'left')) {
                        this.resizediv.classList.add('splitterOpposite');
                        this.resizediv.isOpposite = true;
                    }
                    mouseMoveHandler = (e) => {
                        let diff = e.clientX - this._resizeStartX;
                        if (this.resizediv.isOpposite)
                            diff = -diff;
                        if (!this._resizing)
                            return;
                        e.stopPropagation();
                        e.preventDefault();
                        let newWidth = this._originalWidth + diff;
                        if (lastSize !== newWidth && this.container.parentElement) {
                            lastSize = newWidth;
                            if (this.container.style.flexBasis)
                                this.container.style.flexBasis = newWidth + 'px';
                            this.container.style.width = newWidth + 'px';
                            notifyLayoutChangeUp(this.container.parentElement);
                            deferredNotifyLayoutChangeDown(this.container.parentElement);
                        }
                    };
                    app.listen(this.resizediv, 'mousedown', (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        // JL: Changing document.body's class requires a full layout recalculation. Editing style.cursor directly does not require such.
                        document.body.style.cursor = 'ew-resize';
                        this._resizeStartX = e.clientX;
                        app.listen(window, 'mouseup', mouseUpHandler, true);
                        app.listen(window, 'mousemove', mouseMoveHandler, true);
                        let cs = getComputedStyle(this.container, null);
                        this._originalWidth = parseInt(cs.width);
                        this._resizing = true;
                    });
                }
                else if (params.resizable === 'vertical') {
                    this.resizediv.className = 'resizeVertical';
                    if (params.splitterPosition && (params.splitterPosition === 'top')) {
                        this.resizediv.classList.add('splitterOpposite');
                        this.resizediv.isOpposite = true;
                    }
                    mouseMoveHandler = (e) => {
                        if (!this._resizing)
                            return;
                        e.stopPropagation();
                        e.preventDefault();
                        let diff = e.clientY - this._resizeStartY;
                        if (this.resizediv.isOpposite)
                            diff = -diff;
                        let newHeight = this._originalHeight + diff;
                        if (lastSize !== newHeight && this.container.parentElement) {
                            lastSize = newHeight;
                            if (this.container.style.flexBasis)
                                this.container.style.flexBasis = newHeight + 'px';
                            this.container.style.height = newHeight + 'px';
                            notifyLayoutChangeUp(this.container.parentElement);
                            deferredNotifyLayoutChangeDown(this.container.parentElement);
                        }
                    };
                    app.listen(this.resizediv, 'mousedown', (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        // JL: Changing document.body's class requires a full layout recalculation. Editing style.cursor directly does not require such.
                        document.body.style.cursor = 'ns-resize';
                        this._resizeStartY = e.clientY;
                        app.listen(window, 'mouseup', mouseUpHandler, true);
                        app.listen(window, 'mousemove', mouseMoveHandler, true);
                        let cs = getComputedStyle(this.container, null);
                        this._originalHeight = parseInt(cs.height);
                        this._resizing = true;
                    });
                }
            }
            if (params.minHeight)
                this.container.style.minHeight = params.minHeight;
            if (params.height)
                this.container.style.height = params.height;
            if (params.minWidth)
                this.container.style.minWidth = params.minWidth;
            if (params.width)
                this.container.style.width = params.width;
        }
        let _this = this;
        this.statusParams = {
            visible: function (e) {
                // @ts-ignore
                return (e.detail.data.selectedCount > 0) && (resolveToValue(_this.selectionMode, false));
            }
        };
        if (!params || !params.nouniqueid) {
            this.uniqueID = createUniqueID();
            this.container.setAttribute('data-uniqueID', this.uniqueID);
        }
        this.canBeUsedAsSource = true; // true, when can be used as a data source (eq for menu items)
        this.localListen(elem, 'focus', () => {
            ODS('**** focusControl: ' + this.constructor.name);
            this.notifyControlFocus();
        });
        // set Default control values
        this.setDefaults();
    }
    qChild(id) {
        return qe(this.container, '[data-id=' + id + ']');
    }
    set helpContext(value) {
        this._helpContext = value;
    }
    get helpContext() {
        return this._helpContext || this.container.getAttribute('data-help') || undefined; // overriden in descendants (e.g. MultiView)
    }
    /**
        Request an animation frame in the control context. If the control has been cleaned up, then the callback will not execute.
        @example

            this.requestFrame(function () {
                // this callback will be executed at a maximum of your monitor's natural refresh rate.
            }, "myUniqueFrameCallbackName");
        @param callback Callback to run.
        @param callbackID Optional ID for callback, so that multiple instances of the callback do not execute at the same time.
    */
    requestFrame(callback, callbackID) {
        let _this = this;
        if (!this._frameIDs)
            this._frameIDs = {};
        if (callbackID && this._frameIDs[callbackID])
            cancelAnimationFrame(this._frameIDs[callbackID]);
        let frame_id = requestAnimationFrame(function () {
            if (!_this._cleanUpCalled) {
                callback();
            }
        });
        if (callbackID)
            this._frameIDs[callbackID] = frame_id;
    }
    /**
        Request an animation frame in the control context, with the same features as requestAnimationFrameMM(). If the control has been cleaned up, then the callback will not execute.
        @example

            this.requestFrame(function () {
                // this callback will be executed at a maximum of your monitor's natural refresh rate when focused, maximum of 30 fps when not focused, and maximum of 2 fps when window is not visible.
            }, "myUniqueFrameCallbackName");
        @method requestFrameMM
        @param callback Callback to run.
        @param callbackID Optional ID for callback, so that multiple instances of the callback do not execute at the same time.
    */
    requestFrameMM(callback, callbackID) {
        let _this = this;
        if (!this._frameMMIDs)
            this._frameMMIDs = {};
        if (callbackID && this._frameMMIDs[callbackID])
            return;
        if (!callbackID)
            callbackID = '';
        this._frameMMIDs[callbackID] = true;
        requestAnimationFrameMM(function () {
            if (!callbackID)
                callbackID = '';
            _this._frameMMIDs[callbackID] = undefined;
            if (!_this._cleanUpCalled) {
                callback();
            }
        });
    }
    /**
        Calls setTimeout, cancels the previous sheduled callback on cleanup or multiple calls

        @method requestTimeout
        @param callback Callback, which should be called after timeout
        @param timeMS Timeout, in ms
        @param callbackID String name, which identifies the callback. If present, it cancels the previous sheduled callback
        @param useFirst Valid only if callbackID is present, if true, previous unfinished timer is finished and the last is revoked
    */
    requestTimeout(callback, timeMS, callbackID, useFirst) {
        if (!this._timeoutIDs)
            this._timeoutIDs = {};
        if (callbackID) {
            if (this._timeoutIDs[callbackID] !== undefined) { // already waiting for calling this callback
                if (!useFirst) {
                    clearTimeout(this._timeoutIDs[callbackID]);
                    this._timeoutIDs[callbackID] = undefined;
                }
                else
                    return;
            }
        }
        let _this = this;
        let tmid = setTimeout(function () {
            if (!_this._cleanUpCalled) {
                if (callbackID)
                    _this._timeoutIDs[callbackID] = undefined;
                callback();
            }
        }, timeMS);
        if (callbackID)
            this._timeoutIDs[callbackID] = tmid;
        return tmid;
    }
    setDefaults() {
    }
    /**
    Calls requestIdleCallback, cancels the previous sheduled callback on cleanup or multiple calls
    
    @method requestIdle
    @param {Function} callback Callback, which should be called when idle
    @param {string} [callbackID] String name, which identifies the callback. If present, it cancels the previous sheduled callback
    @param {boolean} [useFirst] Valid only if callbackID is present, if true, previous unfinished timer is finished and the last is revoked
    */
    requestIdle(callback, callbackID, useFirst) {
        if (!this._idleCallIDs)
            this._idleCallIDs = {};
        if (callbackID) {
            if (this._idleCallIDs[callbackID] !== undefined) { // already waiting for calling this callback
                if (!useFirst) {
                    cancelIdleCallback(this._idleCallIDs[callbackID]);
                    this._idleCallIDs[callbackID] = undefined;
                }
                else
                    return;
            }
        }
        let _this = this;
        let handle = requestIdleCallback(function () {
            if (!_this._cleanUpCalled) {
                if (callbackID)
                    _this._idleCallIDs[callbackID] = undefined;
                callback();
            }
        });
        if (callbackID)
            this._idleCallIDs[callbackID] = handle;
        return handle;
    }
    _updateDisabledAttribute() {
        if (this.container) {
            if (this.disabled) {
                this._tabIndex = this.container.tabIndex;
                this.container.tabIndex = -1;
                this.container.setAttribute('data-disabled', '1');
            }
            else {
                this.container.removeAttribute('data-disabled');
                this.container.tabIndex = this._tabIndex;
            }
        }
    }
    enableDragNDrop() {
        if (this.dndEventsRegistered)
            return;
        this.dragging = false;
        this.dndEventsRegistered = true;
        let addDragMethods = (e) => {
            e._target = e.target;
            e.dataTransfer.getSourceControl = function () {
                if (dnd.droppingFileNames(e)) { // external D&D (like from explorer)
                    return null;
                }
                let id = e.dataTransfer.getUserData(DRAG_CONTROL);
                if (id) {
                    return qe(document, '[data-uniqueID=' + id + ']');
                }
                return null;
            };
            e.dataTransfer.isSameControl = () => {
                let srcID = e.dataTransfer.getUserData(DRAG_CONTROL);
                if (srcID === '')
                    return false;
                let ctrl = e._dropTargetControl || this.container;
                while (ctrl) {
                    let id = undefined;
                    if (ctrl.controlClass)
                        id = ctrl.controlClass.uniqueID;
                    if (!id)
                        id = ctrl.getAttribute('data-uniqueID');
                    if (id === srcID) {
                        return true;
                    }
                    ctrl = getParent(ctrl);
                }
                return false;
            };
            e.dataTransfer.srcObject = () => {
                let srcControl = e.dataTransfer.getSourceControl();
                if (srcControl && srcControl.controlClass) {
                    return srcControl.controlClass.getDraggedObject(e);
                }
                return null;
            };
            e.dataTransfer.setDropTargetControl = function (ctrl) {
                e._dropTargetControl = ctrl;
            };
        };
        let addUserDataGetter = function (e) {
            dnd.prepareDragEventMethods(e);
        };
        let isDragAllowed = function (e) {
            if (!window.settings.UI.canDragDrop || !('dataTransfer' in e))
                return false;
            addUserDataGetter(e);
            let id = e.dataTransfer.getUserData(DRAG_CONTROL);
            if (id === '') { // we're not dragging inside MM, but from outside
                dnd.finishedDragNDrop();
            }
            return ((id !== '') || (dnd.droppingFileNames(e))) && (!dnd.headerMoving(e));
        };
        this.dragStartHandler = (e) => { };
        this.dragEnterHandler = (e) => {
            if (isDragAllowed(e)) {
                addDragMethods(e);
                this.dragEnter(e);
            }
        };
        this.dragOverHandler = (e) => {
            if (isDragAllowed(e)) {
                e.preventDefault();
                addDragMethods(e);
                if (this.canDrop(e)) {
                    if (this.findDNDHandler(e) == this.container) {
                        this.dragging = true;
                        e.stopPropagation();
                    }
                }
                else {
                    e.dataTransfer.dropEffect = 'none';
                    return;
                }
                dnd.setDropMode(e, this.getDropMode(e));
                this.dragOver(e);
            }
        };
        this.dragLeaveHandler = (e) => {
            if (isDragAllowed(e)) {
                addDragMethods(e);
                this.dragLeave(e);
                this.dragging = false;
            }
        };
        this.dropHandler = (e) => {
            if (isDragAllowed(e)) {
                e.preventDefault();
                e.stopPropagation();
                addDragMethods(e);
                let ctrl = this.findDNDHandler(e);
                if (ctrl) {
                    dnd.setDropTargetControl(e, ctrl);
                    ctrl.controlClass.drop(e);
                    this.dragging = false;
                    dnd.finishedDragNDrop();
                }
            }
        };
        this.dragFinishedHandler = (e) => {
            this.dragFinished(e);
        };
        this.activatedHandler = (active) => {
            this.dragFinishedHandler();
        };
        app.listen(this.container, 'dragstart', this.dragStartHandler, false);
        app.listen(this.container, 'dragenter', this.dragEnterHandler, false);
        app.listen(this.container, 'dragover', this.dragOverHandler, true);
        app.listen(this.container, 'dragleave', this.dragLeaveHandler, true);
        app.listen(this.container, 'drop', this.dropHandler, true);
        app.listen(thisWindow, 'activated', this.activatedHandler, true);
        app.listen(window, 'dragfinished', this.dragFinishedHandler, true);
        this.findDNDHandler = function (e) {
            // browse parents
            let elem = ('_target' in e && e._target) ? e._target : this.container; //getParent(this.container);
            while (elem) {
                if (elem.controlClass && elem.controlClass.findDNDHandler) {
                    if (elem.controlClass.canDrop(e)) {
                        return elem;
                    }
                }
                elem = getParent(elem);
            }
            return null;
        };
    }
    enableTouch() {
        // focus handling
        if (this.focusEventsRegistered === undefined) {
            app.listen(this.container, 'focusin', this.focusIn);
            this.focusEventsRegistered = true;
        }
        if (this.touchEventsRegistered === undefined) {
            // touch support
            this.touchStart = (e) => {
                this._touchDownTime = Date.now();
                this._canBeLongTouch = true;
                this._isLongTouch = false;
                if (this._contextMenuHandler) {
                    // todo
                }
            };
            this.touchMove = (e) => {
                this._canBeLongTouch = false;
            };
            this.touchEnd = (e) => {
                if (this._contextMenuHandler) {
                    this._isLongTouch = this.longTouch(e);
                }
                this._touchDownTime = undefined;
            };
            app.listen(this.container, 'touchstart', this.touchStart, true);
            app.listen(this.container, 'touchend', this.touchEnd, true);
            app.listen(this.container, 'touchmove', this.touchMove, true);
            this.touchEventsRegistered = true;
        }
    }
    longTouch(e) {
        if (this._isLongTouch)
            return true;
        if (this._touchDownTime && this._canBeLongTouch) {
            if (Date.now() - this._touchDownTime > 500 /* 0.5s */) {
                return true;
            }
        }
        return false;
    }
    notifyControlFocus() {
        if (!this.noFocusOnClick) {
            this.raiseEvent('focusedcontrol', {
                control: this
            }, false, true /* bubbles */);
        }
    }
    focusHandler(element, newState) {
        // handle and draw keyboard focus
        let checkCanFocusControl = (element) => {
            let node = element;
            while (node) {
                if (node.controlClass && resolveToValue(node.controlClass._checkParentFocus, true))
                    if (!node.controlClass.canDrawFocus())
                        return false;
                node = node.parentNode;
            }
            return this.canDrawFocus();
        };
        let state = false;
        if (element) {
            state = (newState && checkCanFocusControl(element));
            if (state)
                element.setAttribute(getFocusAttribute(), '1');
            else
                element.removeAttribute(getFocusAttribute());
            if (element.controlClass)
                element.controlClass.focusRefresh(newState);
            this.focusRefresh(newState);
        }
        return state;
    }
    focusIn(e) {
        let element = e.target;
        // handle and set control in focus
        let getControlToFocus = (element) => {
            let node = element;
            while (node) {
                if (node.controlClass) {
                    if (node.controlClass.canFocus())
                        return node;
                }
                else if (((node.nodeName === 'TEXTAREA') || (node.nodeName === 'INPUT')) && (!node.readOnly) && (!node.disabled))
                    return node;
                node = getParent(node);
            }
            return null;
        };
        let focusWhenFilled = function (el) {
            let doFocus = function () {
                if (el.controlClass.focusedIndex == -1) {
                    el.controlClass.focusedIndex = 0;
                    el.focus({
                        preventScroll: true // #20446
                    });
                }
            };
            let repeat = false;
            if (el.controlClass && (document.activeElement == document.body /* no new element focused */))
                if (!el.controlClass.dataSource || (el.controlClass.dataSource && !el.controlClass.dataSource.count))
                    repeat = true;
            if (isUsingKeyboard()) {
                if (repeat) {
                    setTimeout(function () {
                        focusWhenFilled(el);
                    }, 200);
                }
                else {
                    doFocus();
                }
            }
        };
        let el = getControlToFocus(element);
        if (el) {
            if (el != element) {
                el.focus({
                    preventScroll: true // #20446
                });
            }
            else {
                if (el.controlClass && isUsingKeyboard()) {
                    el.controlClass.requestTimeout(function () {
                        if (document.activeElement != el) { // focus changed ... old control is hidden probably
                            // @ts-ignore ListView.js
                            if (el.controlClass instanceof ListView) { // ListView instance should be focused
                                focusWhenFilled(el);
                            }
                        }
                    }, 1);
                }
            }
        }
    }
    canFocus() {
        return !this._disabled && (this.container != document.body);
    }
    canDrawFocus() {
        return true;
    }
    focusRefresh(newFocusState) { }
    dragFinished(e) {
        dnd.finishedDragNDrop();
    }
    /**
    Handle drag enter operation
    
    @method dragEnter
    @param {object} Event object. dataTransfer property is used for D&D operations
    */
    dragEnter(e) {
        let handler = this.findDNDHandler(e);
        if (handler && (handler != this.container))
            handler.controlClass.dragEnter(e);
    }
    /**
    Control is allow drop objects.
    
    @method canDrop
    @param {object} Event object. dataTransfer property is used for D&D operations
    @return {bool} true if dragged object can be dropped here
    */
    canDrop(e) {
        if (!this.dndEventsRegistered)
            return false;
        else
            return this.findDNDHandler(e) !== null;
    }
    /**
    Handle drag over operation
    
    @method dragOver
    @param {object} Event object. dataTransfer property is used for D&D operations
    */
    dragOver(e) {
        let handler = this.findDNDHandler(e);
        if (handler && (handler != this.container)) {
            handler.controlClass.dragging = true;
            handler.controlClass.dragOver(e);
        }
    }
    /**
    Handle drag leave operation
    
    @method dragLeave
    @param {object} Event object. dataTransfer property is used for D&D operations
    */
    dragLeave(e) {
        let handler = this.findDNDHandler(e);
        if (handler && (handler != this.container)) {
            handler.controlClass.dragLeave(e);
            handler.controlClass.dragging = false;
        }
    }
    /**
    Handle drop operation
    
    @method drop
    @param {object} Event object. dataTransfer property is used for D&D operations
    */
    drop(e, isSameControl) {
        let handler = this.findDNDHandler(e);
        if (handler && (handler != this.container)) {
            handler.controlClass.drop(e);
            handler.controlClass.dragging = false;
        }
    }
    /**
    Gets new drop mode
    
    @method getDropMode
    @param {object} Event object. dataTransfer property is used for D&D operations
    @return {string} Drop mode
    */
    getDropMode(e) {
        let handler = this.findDNDHandler(e);
        if (handler && (handler != this.container))
            return handler.controlClass.getDropMode(e);
        return 'move';
    }
    getDragDataType() {
        return '';
    }
    getDraggedObject(e) {
        return null;
    }
    fileTransferPrepare(element, e) {
    }
    /**
    Control is allow drag object
    
    @method makeDraggable
    @param {object} Object to enable/disable drag
    @param {bool} true when object can be dragged. Default is true
    */
    makeDraggable(element, canBeDragged) {
        let newDraggable = (canBeDragged == undefined) ? true : canBeDragged;
        element.draggable = newDraggable;
        if (newDraggable) {
            if (!element.dragEventRegistered) {
                let _this = this;
                app.listen(element, 'dragstart', function (e) {
                    let clickedElem = document.elementFromPoint(e.pageX, e.pageY);
                    if (clickedElem && clickedElem.hasAttribute('data-ignoreDrag')) {
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                    }
                    dnd.initializeDragEvent(e);
                    _this.setDragElementData(element, e);
                    e.dataTransfer.setUserData(DRAG_CONTROL, _this.container.getAttribute('data-uniqueID'));
                    if (_this.contextMenuPromise) {
                        _this.contextMenuPromise.then(() => {
                            _this.fileTransferPrepare(element, e);
                        });
                    }
                    else
                        _this.fileTransferPrepare(element, e);
                }, false);
                app.listen(element, 'dragend', function (e) {
                    dnd.notifyDragFinished();
                }, false);
                element.dragEventRegistered = true;
            }
        }
        else {
            if (element.dragEventRegistered) {
                app.unlisten(element, 'dragstart');
                app.unlisten(element, 'dragend');
                element.dragEventRegistered = undefined;
            }
        }
    }
    /**
    Set details for dragged element
    
    @method setDragElementData
    @param {object} Object to drag
    @param {object} Drag event object
    */
    setDragElementData(element, e) {
        e.dataTransfer.setDragImage(element, e.offsetX, e.offsetY);
    }
    unregisterDragDrop() {
        if (this.dndEventsRegistered) {
            app.unlisten(this.container, 'dragstart', this.dragStartHandler, false);
            app.unlisten(this.container, 'dragenter', this.dragEnterHandler, false);
            app.unlisten(this.container, 'dragover', this.dragOverHandler, true);
            app.unlisten(this.container, 'dragleave', this.dragLeaveHandler, true);
            app.unlisten(this.container, 'drop', this.dropHandler, true);
            app.unlisten(thisWindow, 'activated', this.activatedHandler, true);
            app.unlisten(window, 'dragfinished', this.dragFinishedHandler, true);
            this.dndEventsRegistered = undefined;
        }
    }
    unregisterFocusEvents() {
        if (this.focusEventsRegistered) {
            app.unlisten(this.container, 'focusin', this.focusIn);
            this.focusEventsRegistered = undefined;
        }
    }
    unregisterTouchEvents() {
        if (this.touchEventsRegistered) {
            app.unlisten(this.container, 'touchstart', this.touchStart, true);
            app.unlisten(this.container, 'touchend', this.touchEnd, true);
            app.unlisten(this.container, 'touchmove', this.touchMove, true);
            this.touchEventsRegistered = undefined;
        }
    }
    checkedCleanUp() {
        this.cleanUp();
        assert(this._cleanUpCalled, '$super.cleanUp was not called !!');
    }
    /**
    Add function to be called once during Control cleanUp
    
    @method addCleanFunc
    @param {function} func Function to add
    */
    addCleanFunc(func) {
        this._cleanFuncs = this._cleanFuncs || [];
        this._cleanFuncs.push(func);
    }
    /**
    Should clean up all the control stuff, i.e. mainly unlisten events.
    
    @method cleanUp
    */
    cleanUp() {
        assert(this.container, 'Control.cleanUp called on prototype !!');
        this._cleanUpCalled = true;
        if (this.container === window._lastFocusedLVControl)
            window._lastFocusedLVControl = undefined;
        this._contextMenu = null; // without this the Menu() object leaks, not sure why it is not garbage collected?
        this._dockMenuItems = null;
        if (this._contextMenuHandler) {
            this._contextMenuHandler = undefined;
        }
        if (this.disabled) {
            this.disabled = false; // will unlisten mouse and keyboard event captures
        }
        if (this.resizediv) {
            app.unlisten(this.resizediv);
        }
        this.hasSplitters = false; // will unlisten events
        if (this.closediv) {
            app.unlisten(this.closediv);
            this.container.removeChild(this.closediv);
            this.closediv = undefined;
        }
        if (this.unregisterDragDrop)
            this.unregisterDragDrop();
        if (this.unregisterFocusEvents)
            this.unregisterFocusEvents();
        if (this.unregisterTouchEvents)
            this.unregisterTouchEvents();
        for (let event in this._listeners) {
            this.unregisterEventHandler(event);
        }
        for (let event in this._captureListeners) {
            this.unregisterEventHandler(event, true);
        }
        if (this._cleanFuncs) {
            forEach(this._cleanFuncs, function (cleanFunc) {
                cleanFunc();
            });
        }
        this._cleanFuncs = [];
        app.unlisten(this.container);
        this.cleanUpPromises();
        this.dataSourceUnlistenFuncts();
        this.cancelDataSourcePromises();
        this.cleanUpStatusBarSources();
        // Unlink us from DOM
        // @ts-ignore - It's ok for controlClass to be undefined after cleanUp call
        this.container.controlClass = undefined;
        this.container.removeAttribute('data-control-class');
        this.container = null;
    }
    /**
    Raise the event on the Control
    
    @example
    
        if (!this.raiseEvent('selecting', {
            tabIndex: value,
            oldTabIndex: oldSelected
        }, true))
            return; // canceled, do not change selection
    
    @param eventName Name of the event
    @param details Custom parameters to be sent with the event
    @param isCancelable Whether the event can be canceled.
    @param canBubble Whether the event can bubble.
    @param sender of the event. Container by default.
    @return Success. If 'false', the event was canceled.
    */
    raiseEvent(eventName, details, isCancelable, canBubble, sender) {
        let params = {
            detail: details
        };
        if (isCancelable !== undefined)
            params.cancelable = isCancelable;
        if (canBubble !== undefined)
            params.bubbles = canBubble;
        let event = createNewCustomEvent(eventName, params);
        let senderObject = this.container;
        if (sender)
            senderObject = sender;
        senderObject.dispatchEvent(event);
        return event.returnValue;
    }
    /**
    Creates a new sub-control.
    
    @method addControl
    @param {string} controlClass Class of the new control.
    @param {Object} initParams Initialization parameters.
    @return {Object} The new control.
    */
    addControl(controlClass, initParams) {
        let div = document.createElement('div');
        div.setAttribute('data-control-class', controlClass);
        if (initParams) {
            let initParamsVal = {};
            for (let key in initParams) {
                initParamsVal[key] = resolveToValue(initParams[key]);
            }
            div.setAttribute('data-init-params', JSON.stringify(initParamsVal));
        }
        this.container.appendChild(div);
        initializeControls(this.container);
        return div;
    }
    /**
    Returns the first ancestor in the HTML DOM tree, that has controlClass and data-id. Searching is stopped on topParentCtrl, if defined.
    
    @method getParentControl
    @param {Object} topParentCtrl ControlClass of the top parent, where to stop searching.
    @return {Control} Parent Control or undefined if there's no parent.
    */
    getParentControl(topParentCtrl) {
        let ctrl = this.container;
        while (ctrl.parentNode) {
            assert(ctrl.parentNode instanceof HTMLElement);
            ctrl = ctrl.parentNode;
            if (ctrl.controlClass && ((ctrl.controlClass == topParentCtrl) || ctrl.hasAttribute('data-id'))) {
                return ctrl.controlClass;
            }
        }
        return;
    }
    /**
    Stores state of the control and all its subcontrols having data-id specified.
    
    @method storeState
    @return {Object} hierarchical object including states of the control and the subcontrols
    */
    storeState() {
        if (this.disableStateStoring)
            return;
        let subNodesState = {};
        forEach(qes(this.container, '[data-id]'), (ctrl) => {
            if (ctrl.controlClass && ctrl.controlClass.storeState && ctrl.controlClass.getParentControl(this) == this) {
                let subnodeState = ctrl.controlClass.storeState();
                if (subnodeState && !isEmptyObject(subnodeState)) {
                    subNodesState[ctrl.getAttribute('data-id')] = subnodeState;
                }
            }
        });
        let state = {};
        /*if (this.resizable) {
            // LS: this does not seem to be needed, is handled by Splitter.storeState()
            if ((this.resizable === 'horizontal') || (this.resizable === 'both')) {
                if (this.container.style.width)
                    state.width = pxToEm(this.container.style.width);
            }
            if ((this.resizable === 'vertical') || (this.resizable === 'both')) {
                if (this.container.style.height)
                    state.height = pxToEm(this.container.style.height);
            }
        }*/
        //state.visible = isVisible(this.container, false); // LS: not needed, to be handled individually
        if (this.hasSplitters) {
            state.hasSplitters = true;
        }
        if (this.container._manualVisibilityState) // LS: this condition is here so that isEmptyObject(state) below returns true
            state.manualVisibilityState = this.container._manualVisibilityState; // used for layout independent dock hide
        let result = {};
        if (!isEmptyObject(state))
            result.state = state;
        if (!isEmptyObject(subNodesState))
            result.subNodesState = subNodesState;
        return result;
    }
    /**
    Restores state of the control and all its subcontrols having data-id specified.
    
    @method restoreState
    @param {Object} fromObject hierarchical object including states of the control and the subcontrols
    */
    restoreState(fromObject, isJustViewModeChange) {
        if (!fromObject || this.disableStateStoring)
            return;
        let fromSubObject = fromObject.subNodesState;
        if (fromSubObject) {
            forEach(qes(this.container, '[data-id]'), (ctrl) => {
                if (ctrl.controlClass && ctrl.controlClass.restoreState && ctrl.controlClass.getParentControl(this) == this) {
                    let restoreFrom = fromSubObject[ctrl.getAttribute('data-id')];
                    if (restoreFrom) {
                        ctrl.controlClass.restoreState(restoreFrom, isJustViewModeChange);
                    }
                }
            });
        }
        let state = fromObject.state;
        if (state) {
            //if (state.visible !== undefined)
            //    setVisibility(this.container, state.visible);
            if (state.manualVisibilityState !== undefined)
                this.container._manualVisibilityState = state.manualVisibilityState; // used for layout independent dock hide
            if (state.hasSplitters) {
                this.hasSplitters = true;
            }
        }
    }
    getPersistentStateRootKeyBase() {
        let key = undefined;
        if (this.parentView) {
            let coll = nodeUtils.getNodeCollection(this.parentView.viewNode);
            key = nodeUtils.getNodeStateRootKey(this.parentView.viewNode, coll);
            if (!key && coll) {
                // save it per collection+node, see #16391 note ~57235
                // and later per #17594
                let sett = app.getValue('sharedColumns_Settings', { mode: 'perNode' });
                if (sett.mode == 'perNode')
                    key = nodeUtils.getCollectionStateRootKey(coll) + '_NODE_' + this.parentView.viewNode.handlerID.toUpperCase();
                else if (sett.mode == 'perCollection')
                    key = nodeUtils.getCollectionStateRootKey(coll);
                else if (sett.mode == 'perCollections')
                    key = 'CONTROLS_STATE_COLLECTIONS';
            }
        }
        if (!key)
            key = 'CONTROLS_STATE_GLOBAL';
        return key;
    }
    /**
    Returns root key string under which the values are stored in persistent.JSON file on the disk.
    
    @method getPersistentStateRootKey
    @return {string} store key id
    */
    getPersistentStateRootKey() {
        let key = this.getPersistentStateRootKeyBase();
        if (isMainWindow)
            return key;
        else
            return 'DIALOG_' + window.posSaveName + '_' + key;
    }
    /**
    Returns control to decide which subcontrols should be stored
    e.g. Multiview component overrides this as it stores states only for the active control/view
    
    @method getPersistentStateRootControl
    @return {object} control
    */
    getPersistentStateRootControl() {
        return this.container;
    }
    /**
    Stores persistent (class) states for the control class and all subcontrols, this stores global (class) state (is same for all instances of the control)
    
    @method storePersistentStates
    */
    storePersistentStates() {
        if (this.disableStateStoring)
            return;
        let key = this.getPersistentStateRootKey();
        let state = app.getValue(key, {});
        let storeStateFn = function (ctrl) {
            if (ctrl.controlClass && ctrl.controlClass.storePersistentState) {
                state[ctrl.controlClass.constructor.name] = ctrl.controlClass.storePersistentState(state[ctrl.controlClass.constructor.name] || {});
            }
        };
        let rootCtrl = this.getPersistentStateRootControl();
        storeStateFn(rootCtrl);
        forEach(qes(rootCtrl, '[data-control-class]'), storeStateFn);
        if (!isEmptyObject(state))
            app.setValue(key, state);
    }
    /**
    Restores persistent (class) states for the control class and all subcontrols, this stores global (class) state (is same for all instances of the control)
    
    @method restorePersistentStates
    */
    restorePersistentStates() {
        if (this.disableStateStoring)
            return;
        let key = this.getPersistentStateRootKey();
        let state = app.getValue(key, {});
        let restoreStateFn = function (ctrl) {
            if (ctrl.controlClass && ctrl.controlClass.restorePersistentState) {
                let storedObj = state[ctrl.controlClass.constructor.name];
                if (!storedObj && ctrl.controlClass.getDefaultPersistentState)
                    storedObj = ctrl.controlClass.getDefaultPersistentState();
                if (storedObj)
                    ctrl.controlClass.restorePersistentState(storedObj);
            }
        };
        let rootCtrl = this.getPersistentStateRootControl();
        restoreStateFn(rootCtrl);
        forEach(qes(rootCtrl, 'div'), restoreStateFn);
    }
    registerStatusBarSource(source) {
        if (source) {
            let _this = this;
            this._statusBarSources = this._statusBarSources || [];
            this._statusBarPromises = this._statusBarPromises || [];
            this._statusBarSources[source.persistentID] = source;
            app.listen(source, 'statuschange', function (e) {
                _this.setStatus(e);
            });
            cancelPromise(_this._statusBarPromises[source.persistentID]);
            this.requestFrame(function () {
                let si = source.statusInfo;
                if (si) {
                    _this._statusBarPromises[source.persistentID] = si;
                    si.then(function (data) {
                        if (data && !_this._cleanUpCalled)
                            _this.setStatus(data);
                    });
                }
            }, 'statusInfo');
        }
    }
    unregisterStatusBarSource(source) {
        if (source) {
            app.unlisten(source, 'statuschange');
            this._statusBarSources = this._statusBarSources || [];
            this._statusBarSources[source.persistentID] = undefined;
            this._statusBarPromises[source.persistentID] = undefined;
        }
    }
    cleanUpStatusBarSources() {
        this._statusBarSources = this._statusBarSources || [];
        for (let i = 0; i < this._statusBarSources.length; i++) {
            if (typeof this._statusBarSources[i] === 'object') {
                this.unregisterStatusBarSource(this._statusBarSources[i]);
            }
        }
    }
    /**
    Set status text. Can be simple string or object with data formatted later in formatStatus method.
    
    @method setStatus
    @return {object} String message or object with detailed data
    */
    setStatus(data) {
        this.statusInfo = data;
        if (data !== undefined) {
            let msg = this.formatStatus(data);
            if (msg !== undefined)
                this.sendStatus(msg);
        }
    }
    sendStatus(message) {
        let view = this.parentView;
        if (!view || view.isActive)
            this.raiseEvent('statusinfochange', {
                message: message,
                data: this.statusInfo,
                sender: this.container,
                params: this.statusParams
            }, true, true);
    }
    openView(nodeDataSource, nodeHandlerID, clickedArea, newTab) {
        let view = this.parentView;
        if (view) {
            view.openSubNode({
                dataSource: nodeDataSource,
                handlerID: nodeHandlerID,
                clickedArea: clickedArea,
                newTab: newTab
            });
        }
    }
    /**
    Format status text in this callback, when using object with detailed data.
    
    @method formatStatus
    @return {object} String message or object with detailed data
    */
    formatStatus(data) {
        if (typeof data === 'string')
            return data;
        else
            return '';
    }
    _notifyFiltered(orig, filtered, phrase) {
        let event = createNewCustomEvent('datasourcefiltered', {
            detail: {
                original: orig,
                filtered: filtered,
                phrase: phrase
            },
            bubbles: true,
            cancelable: true
        });
        this.container.dispatchEvent(event);
    }
    /**
    Filters dataSource based on given criteria (used when searching/filtering items within, e.g. via search bar)
    
    @method filterSource
    @param {string} phrase string phrase to filter
    @return {object} String message or object with detailed data
    */
    filterSource(phrase) {
        if (this.isSearchable && this.dataSource && this.dataSource.filterBySearchPhrase) {
            this._isFiltered = (phrase != '');
            if (!this._dataSourceOrig) {
                if (this._isFiltered) {
                    let _ds = this.dataSource;
                    if (!_ds.isLoaded) {
                        this.localPromise(_ds.whenLoaded()).then(() => {
                            if (_ds == this.dataSource) {
                                this._dataSourceOrig = _ds.getCopy();
                                this.filterSource(phrase);
                            }
                        });
                        return;
                    }
                    else {
                        this._dataSourceOrig = _ds.getCopy();
                    }
                }
                else
                    return;
            }
            if (this.__preDataSource)
                cancelPromise(this.__preDataSource.whenLoaded());
            let _dataSourceOrig = this._dataSourceOrig;
            let _notify = () => {
                this._notifyFiltered(_dataSourceOrig, this.dataSource, phrase);
                this._dataSourceOrig = _dataSourceOrig; // orig source could be cleared in dataSource setter (and thus replaced by filtered source)
            };
            if (!this._isFiltered) {
                this.dataSource.useList(_dataSourceOrig); // useList() to keep the same instance (shared by sub-views)            
                this.dataSource.autoUpdateDisabled = _dataSourceOrig.autoUpdateDisabled;
                this.__preDataSource = null;
                _notify();
            }
            else {
                if (!_dataSourceOrig.filterBySearchPhrase) // LS: how this could happen? -- #21199
                    return;
                let _dataSourceFiltered = _dataSourceOrig.filterBySearchPhrase(phrase);
                this.__preSourceFiltered = _dataSourceFiltered;
                this.__preSource = this.dataSource;
                this.__lastFilterPhrase = phrase;
                let _setSource = () => {
                    if (!this._cleanUpCalled) {
                        if (this.dataSource && this.__preSourceFiltered === _dataSourceFiltered && this.__preSource === this.dataSource) {
                            this.dataSource.useList(_dataSourceFiltered); // useList() to keep the same instance (shared by sub-views)
                            this.dataSource.autoUpdateDisabled = true; // #18474
                            _notify();
                        }
                    }
                };
                // results should be showing after 500ms or once fully loaded, but not earlier (to prevent from too much blinking and scrollbar repositioning when results are similar or same)
                this._setFilteredSourceTm = this.requestTimeout(_setSource, 500, '_setFilteredSourceTm');
                this.localPromise(_dataSourceFiltered.whenLoaded()).then(() => {
                    clearTimeout(this._setFilteredSourceTm);
                    _setSource();
                });
            }
        }
    }
    clearFilterSource() {
        this._dataSourceOrig = null;
    }
    isFiltered() {
        return this._isFiltered;
    }
    setChildsDisabled(el, val, effectiveVal) {
        forEach(el.childNodes, (ctrl) => {
            if (ctrl.nodeType === 1) { // element
                if ((ctrl.controlClass !== undefined) && (ctrl.controlClass.setDisabledFromParent !== undefined)) {
                    ctrl.controlClass.setDisabledFromParent(val);
                    this.setChildsDisabled(ctrl, val, ctrl.controlClass.disabled);
                }
                else {
                    if (ctrl.disabled !== undefined)
                        ctrl.disabled = effectiveVal;
                    if (effectiveVal)
                        ctrl.setAttribute('data-disabled', 1);
                    else
                        ctrl.removeAttribute('data-disabled');
                    this.setChildsDisabled(ctrl, val, effectiveVal);
                }
            }
        });
    }
    /**
    This method is supposed to automatically cancel running promises when component is going to destroy.

    @method localPromise
    @param {Promise} object Promise
    @return {Promise}
    */
    localPromise(promise) {
        let _this = this;
        let _uid = createUniqueID();
        let pr = promise.then1(function (e) {
            _this._localPromises[_uid] = undefined;
            return e;
        });
        this._localPromises[_uid] = promise;
        return promise; // return the original promise, not the pr (as pr does not reject because of then1 usage)
    }
    cleanUpPromises() {
        for (let ids in this._localPromises) {
            if ((this._localPromises[ids]) && (isPromise(this._localPromises[ids]))) {
                cancelPromise(this._localPromises[ids]);
            }
        }
        this._localPromises = [];
    }
    dataSourceListen(object, event, func, capture) {
        // these listeners are unregistered when dataSource is changed
        let listenFunc = app.listen(object, event, func, capture);
        this._dataSourceListenFuncts.push(function () {
            app.unlisten(object, event, func, capture);
        });
        return listenFunc;
    }
    addDSCleanFunc(func) {
        // these functions are called when dataSource is changed
        this._dataSourceListenFuncts.push(func);
    }
    dataSourcePromise(pr) {
        this._dataSourcePromises = this._dataSourcePromises || [];
        this._dataSourcePromises.push(pr);
        return pr;
    }
    cancelDataSourcePromises() {
        if (this._dataSourcePromises) {
            forEach(this._dataSourcePromises, function (pr) {
                cancelPromise(pr);
            });
            this._dataSourcePromises = [];
        }
    }
    dataSourceUnlistenFuncts() {
        forEach(this._dataSourceListenFuncts, function (funct) {
            funct();
        });
        this._dataSourceListenFuncts = [];
    }
    /**
    Method for handling Promise with delayed progress.
    
    @method thenWithProgress
    @param {Promise} pPromise Passed promise
    @param {Object} [params] Object with possible parameters: <br><ul>
            <li>thenFunc - function called after resolving promise</li>
            <li>errorFunc - function called after rejecting promise</li>
            <li>delayedFunc - function called after given delay</li>
            <li>delayMS - progress delay, default 100ms. Progress is displayed after this time, in case promise was not resolved yet</li>
            <li>progressText - text displayed in delayed progress, default string is "Getting data"</li>
            <li>progress - SimpleTasksController object, used for progress. If not present, use global progress.</li>
            </ul>
    */
    thenWithProgress(pPromise, params) {
        params = params || {};
        params.delayMS = params.delayMS || 100;
        params.progressText = params.progressText || _('Getting data');
        let taskProgress = undefined;
        let taskId = undefined;
        if (params.progress)
            taskProgress = params.progress;
        let progressTimeout = this.requestTimeout(function () {
            progressTimeout = undefined;
            if (!taskProgress) {
                taskProgress = app.backgroundTasks.createNew();
                taskProgress.leadingText = params.progressText;
            }
            else
                taskId = taskProgress.beginTask(params.progressText);
            if (params.delayedFunc)
                params.delayedFunc();
        }, params.delayMS);
        pPromise.then1((e) => {
            if (progressTimeout !== undefined) {
                clearTimeout(progressTimeout);
                progressTimeout = undefined;
            }
            if (taskProgress) {
                if (taskId !== undefined) {
                    taskProgress.endTask(taskId);
                }
                else {
                    if (taskProgress.terminate)
                        taskProgress.terminate();
                }
                taskProgress = undefined;
            }
            if (!this._cleanUpCalled) {
                if (isAbortError(e)) {
                    if (params.errorFunc)
                        params.errorFunc(e);
                }
                else if (params.thenFunc) {
                    params.thenFunc(e);
                }
            }
        });
    }
    setDisabledFromParent(value) {
        if (value)
            this.disabledCounter++;
        else
            this.disabledCounter--;
        this._updateDisabledAttribute();
    }
    // internal
    contextMenuHandler(e) {
        let byKey = (this._lastKey === 'ContextMenu');
        this._lastKey = undefined;
        if (!byKey) {
            this._lastMousePos = {
                x: e.clientX,
                y: e.clientY
            };
        }
        if (e.srcElement && ((e.srcElement.nodeName === 'INPUT') || (e.srcElement.nodeName === 'TEXTAREA')))
            return; //  true; // LS: why return true; was here?
        if (this._contextMenu) {
            e.stopPropagation();
            e.preventDefault();
            if (this.contextMenuPromise) {
                // anybody's updating context menu
                this.contextMenuPromise.then(() => {
                    this.contextMenuHandler(e);
                });
                return;
            }
            this._contextMenuAddons = this._contextMenuAddons || [];
            let isTouch = usingTouch;
            window.rightClickOnImage = false; // JL note: unused
            if (!this._ignoreDefaultLookup) {
                let elem = e.target;
                while (elem) {
                    if (elem.nodeName === '<img>' || elem.nodeName === '<svg>' ||
                        (elem.artwork && elem.artworkImg && elem.artworkDiv /* from itemImageFunc */) ||
                        (elem.classList.contains('imageSquare')) ||
                        (elem.hasAttribute('artworkHolder') /* Artwork cell in column tracklist */)) {
                        window.rightClickOnImage = true;
                        break;
                    }
                    elem = elem.parentElement;
                }
            }
            // Add Inspect Element popup command (chromium 39 or later)
            if (window.inspectElementSupported && !this.debugMenuItemsCreated) {
                let _this = this;
                this._contextMenuAddons.push({
                    action: {
                        debug: true,
                        title: _('Inspect Element'),
                        execute: function () {
                            // _this._lastMousePos.x, _this._lastMousePos.y
                            let x = _this._pointerAtPos.x;
                            let y = _this._pointerAtPos.y;
                            window.showDevTools(x, y);
                        }
                    },
                    order: 99999,
                    grouporder: 99999
                });
                this._contextMenuAddons.push({
                    action: {
                        debug: true,
                        title: _('Open DevTools in Chrome'),
                        execute: function () {
                            window.showDevTools();
                        }
                    },
                    order: 99999,
                    grouporder: 99999
                });
                this.debugMenuItemsCreated = true;
            }
            // @ts-ignore
            const willShowInPanel = (window.mainMenuPanel && (this instanceof ListView) && uitools.startSelectionMode(this));
            let allitems = this.getContextMenuItems(e);
            this._contextMenuAddons.forEach((items) => {
                let mitems = resolveToValue(items, undefined, e);
                let add = true;
                if (willShowInPanel && mitems && mitems.action) {
                    add = !resolveToValue(mitems.action.debug, false);
                }
                if (add) {
                    allitems = allitems.concat(mitems);
                }
            });
            let bindFn = undefined;
            if (this._contextMenu.menuHandler)
                bindFn = this._contextMenu.menuHandler.bindFn;
            let menu = new Menu(allitems, {
                parent: this.container,
                bindFn: bindFn
            });
            if (willShowInPanel) {
                // @ts-ignore - mainMenuPanel items
                window.mainMenuPanel.controlClass.items = allitems;
                // @ts-ignore - mainMenuPanel show()
                window.mainMenuPanel.controlClass.show(this);
            }
            else {
                if (menu && menu.menuHandler && menu.menuHandler.menuitems && (!isArray(menu.menuHandler.menuitems) || (menu.menuHandler.menuitems.length > 0))) {
                    let pos = window.getScreenCoordsFromEvent(e);
                    let origX = window.screenX = pos.left;
                    let origY = window.screenY = pos.top;
                    if (byKey || (screenX === undefined)) { // PETR: don't know why, but sometimes when using touches screenX/Y is undefined!
                        origX = undefined;
                        origY = undefined;
                        // try to find focused or selected subitem, if exists
                        let focusedEl = undefined;
                        if (this.getFocusedElement)
                            focusedEl = this.getFocusedElement();
                        if (!focusedEl) {
                            let felements = qes(this.container, '[data-focused]');
                            if (!felements || (felements.length === 0)) {
                                felements = qes(this.container, '[data-selected]');
                            }
                            if (felements && (felements.length > 0)) {
                                focusedEl = felements[0];
                            }
                        }
                        if (focusedEl) {
                            let pos = findScreenPos(focusedEl);
                            window.screenX = pos.left + Math.floor(focusedEl.offsetWidth / 2);
                            window.screenY = pos.top + Math.floor(focusedEl.offsetHeight / 2);
                        }
                    }
                    // PETR: don't know why, but sometimes when using touches clientevent.screenX/Y is undefined!
                    if (screenX === undefined) {
                        window.screenX = screen.width / 2;
                        window.screenY = screen.height / 2;
                    }
                    let border = thisWindow.bounds.borderSize;
                    let titleHeight = thisWindow.bounds.titleSize;
                    // this structure is used for 'Inspect element'
                    this._pointerAtPos = {
                        x: (origX ? origX : screenX) - (thisWindow.bounds.left + border),
                        y: (origY ? origY : screenY) - (thisWindow.bounds.top + border + titleHeight)
                    };
                    menu.show(screenX, screenY, false, true);
                }
            }
        }
    }
    getFocusedElement() {
        return undefined; // overriden e.g. in ListView
    }
    /**
    Adds item(s) to control context menu.

    @method addToContextMenu
    @param {Array || Function} Array of menu items to add, or function returning menu items.
    */
    addToContextMenu(items) {
        this._contextMenuAddons = this._contextMenuAddons || [];
        this._contextMenuAddons.push(items);
        this.contextMenu = this.contextMenu || [];
    }
    getContextMenuItems(evt) {
        let menu = resolveToValue(this._contextMenu, undefined, evt);
        let retval;
        if (menu && menu.menuHandler) {
            if (isFunction(menu.menuHandler.menuitems))
                retval = menu.menuHandler.menuitems({
                    parent: this.container
                });
            else
                retval = menu.menuHandler.menuitems;
        }
        else
            retval = [];
        if (this.mergeParentContextMenu) {
            let pEl = getParent(this.container);
            if (pEl) {
                let pCtrl = elementControl(pEl);
                if (pCtrl) {
                    retval = retval.concat(pCtrl.getContextMenuItems(evt));
                }
            }
        }
        return retval;
    }
    addEventListener(event, func, capture) {
        app.listen(this.container, event, func, capture);
    }
    removeEventListener(event, func, capture) {
        app.unlisten(this.container, event, func, capture);
    }
    registerEventHandler(event, capture) {
        let handlerName = 'handle_' + event;
        let obj = this.container;
        if (!Control.prototype[handlerName]) {
            Control.prototype[handlerName] = function () { }; // to be sure, handler for $super always exists
        }
        if (!capture) {
            this._listeners = this._listeners || {};
            if (!this._listeners[event] && this[handlerName]) {
                this._listeners[event] = this[handlerName].bind(this);
                //            app.utils.logStackTrace();
                app.listen(obj, event, this._listeners[event]);
                //            ODS('--- registered ' + event + ', objid = ' + obj.ListenObjectID + ', uniqueID=' + obj.getAttribute('data-uniqueid'));
            }
        }
        else {
            this._captureListeners = this._captureListeners || {};
            if (!this._captureListeners[event] && this[handlerName]) {
                this._captureListeners[event] = this[handlerName].bind(this);
                app.listen(obj, event, this._captureListeners[event], true);
            }
        }
    }
    // TODO: EventCallbackMap<HTMLElement>
    unregisterEventHandler(event, capture) {
        let obj = this.container; // "as any" is temporary
        if (!capture) {
            if (!this._listeners || !this._listeners[event])
                return;
            //        ODS('--- unregister ' + event + ', objid = ' + obj.ListenObjectID + ', uniqueID=' + obj.getAttribute('data-uniqueid'));
            //        app.utils.logStackTrace();
            app.unlisten(obj, event, this._listeners[event]);
            this._listeners[event] = undefined;
        }
        else {
            if (!this._captureListeners || !this._captureListeners[event])
                return;
            app.unlisten(obj, event, this._captureListeners[event], true);
            this._captureListeners[event] = undefined;
        }
    }
    /**
    This method is pretty similar as app.listen(), but app.unlisten() is called automatically in Control.cleanUp()

    @method localListen
    @param object Object where to set listener
    @param event Event of the listener
    @param func Method for callback dispatch
    @param capture
    */
    localListen(object, event, func, capture) {
        let listenFunc = app.listen(object, event, func, capture);
        this.addCleanFunc(function () {
            app.unlisten(object, event, func, capture);
        });
        return listenFunc;
    }
    handle_layoutchange(e) {
        // overriden in descendants
    }
    /**
    Gets/sets dockable status of the control.

    @property dockable
    */
    get dockable() {
        return this._dockable;
    }
    set dockable(value) {
        this._dockable = value;
        if (this._dockable) {
            this.container.setAttribute('data-dockable', '');
        }
        else {
            this.container.removeAttribute('data-dockable');
        }
    }
    /**
    Gets/sets isDock status of the control.

    @property isDock
    */
    get isDock() {
        return this._isDock;
    }
    set isDock(value) {
        this._isDock = value;
        if (this._isDock) { // used for faster docks search
            this.container.setAttribute('data-dock', '');
        }
        else {
            this.container.removeAttribute('data-dock');
        }
    }
    /**
    Gets/sets dock title.

    @property dockTitle
    */
    get dockTitle() {
        return this._controlTitle;
    }
    set dockTitle(value) {
        this._controlTitle = value;
        this.container.setAttribute('data-dock-title-LC', this._controlTitle);
    }
    /**
    Gets/sets params for statusbar.
    
    @property statusParams
    @type {AnyDict}
    */
    get statusParams() {
        return this._statusParams;
    }
    set statusParams(value) {
        this._statusParams = value;
    }
    /**
    Gets/sets view data.

    @property parentView
    @type {ViewData}
    */
    get parentView() {
        if (this._cleanUpCalled)
            return;
        if (this._parentView) {
            return this._parentView;
        }
        else {
            // find nearest parent with controlClass
            let node = this.container.parentNode;
            while (node instanceof HTMLElement && (!node.controlClass || !node.controlClass.parentView))
                node = node.parentNode;
            if (node instanceof HTMLElement && node.controlClass) {
                let view = node.controlClass.parentView;
                /*if( view)
                    this._parentView = view;*/
                return view;
            }
            return null;
        }
    }
    set parentView(value) {
        this._parentView = value;
    }
    /**
    Gets/sets data-disabled attribute of the control and his childs

    @property disabled
    @type boolean
    */
    get disabled() {
        return (this._disabled || (this.disabledCounter > 0));
    }
    set disabled(value) {
        if (this._disabled === value)
            return;
        this._disabled = value;
        this._updateDisabledAttribute();
        if (this.container)
            this.setChildsDisabled(this.container, value, value);
    }
    /**
    Get/set whether this control is searchable (e.g. via search bar)

    @property isSearchable
    @type boolean
    */
    get isSearchable() {
        return this._searchable;
    }
    set isSearchable(value) {
        this._searchable = value;
    }
    /**
    Gets/sets tabIndex property. Use instead of tabIndex in HTMLElement for correct handling of disabled state.

    @property tabIndex
    @type integer
    */
    get tabIndex() {
        return this._tabIndex;
    }
    set tabIndex(value) {
        this._tabIndex = value;
        if (!this._disabled)
            this.container.tabIndex = value;
    }
    /**
    Gets/sets context menu of the control. It could be also a function returning Menu object.

    @property contextMenu
    @type Menu
    */
    get contextMenu() {
        return this._contextMenu;
    }
    set contextMenu(value) {
        this._contextMenu = value;
        if (value && this._contextMenuHandler === undefined) {
            this._contextMenuHandler = this.contextMenuHandler.bind(this);
            app.listen(this.container, 'contextmenu', this._contextMenuHandler);
            app.listen(this.container, 'keydown', (e) => {
                this._lastKey = friendlyKeyName(e);
            });
        }
    }
    /**
    Gets/sets dock menu of the control. It could be also a function returning Menu object.

    @property dockMenuItems
    @type Menu
    */
    get dockMenuItems() {
        return this._dockMenuItems;
    }
    set dockMenuItems(value) {
        this._dockMenuItems = value;
    }
    /**
    Gets/sets visibility state of the control.

    @property visible
    @type boolean
    */
    get visible() {
        return isVisible(this.container, true);
    }
    get minWidth() {
        let minWidthStr = this.container.style.minWidth;
        let retval;
        let cs;
        if (!minWidthStr) {
            cs = getComputedStyle(this.container);
            minWidthStr = cs.minWidth;
        }
        if (!minWidthStr || (minWidthStr === '0px') || (minWidthStr === 'auto')) {
            // compute min width from childs
            retval = getMinWidthFromChildren(this.container, cs);
        }
        else {
            retval = getPixelSize(minWidthStr, 'minWidth', this.container);
        }
        return retval;
    }
    set minWidth(value) {
        let num = Number(value);
        let val;
        if (isNaN(num)) {
            val = value;
        }
        else {
            val = value + 'px';
        }
        if (this.container) {
            this.container.style.minWidth = val;
        }
    }
    get minHeight() {
        let minHeightStr = this.container.style.minHeight;
        let retval;
        let cs;
        if (!minHeightStr) {
            cs = getComputedStyle(this.container);
            minHeightStr = cs.minHeight;
        }
        if (!minHeightStr || (minHeightStr === '0px') || (minHeightStr === 'auto')) {
            // compute min width from childs
            retval = getMinHeightFromChildren(this.container, cs);
        }
        else {
            retval = getPixelSize(minHeightStr, 'minHeight', this.container);
        }
        return retval;
    }
    set minHeight(value) {
        let num = Number(value);
        let val;
        if (isNaN(num)) {
            val = value;
        }
        else {
            val = value + 'px';
        }
        if (this.container) {
            this.container.style.minHeight = val;
        }
    }
    get hasSplitters() {
        return this._hasSplitters;
    }
    set hasSplitters(value) {
        if (!this.container)
            return;
        if (this._hasSplitters === value)
            return;
        this._hasSplitters = value;
        this.container.classList.toggle('hasSplitters', value);
        if (!this._hasSplitters) {
            if (this._layoutChangeHandler)
                //app.unlisten(this.container, 'layoutchange', this._layoutChangeHandler);
                this._layoutChangeHandler = undefined;
        }
        else {
            let visList = [];
            let allList = [];
            let ch, v, vis;
            let getFastWidth = function (div, minWidth) {
                let ws = div.style.width;
                if (ws && (ws.indexOf('px') > 0) && typeof minWidth !== 'undefined') {
                    return Math.max(parseFloat(ws), minWidth);
                }
                else {
                    let cs = getComputedStyle(div);
                    return parseFloat(cs.width);
                }
            };
            let getFastHeight = function (div, minHeight) {
                let hs = div.style.height;
                if (hs && (hs.indexOf('px') > 0) && typeof minHeight !== 'undefined') {
                    return Math.max(parseFloat(hs), minHeight);
                }
                else {
                    let cs = getComputedStyle(div);
                    return parseFloat(cs.height);
                }
            };
            this._layoutChangeHandler = (evt) => {
                if (!this.visible)
                    return;
                // check if visible children changed
                let children = this.container.children;
                let resetVisList = (visList.length === 0) || (allList.length !== children.length);
                if (!resetVisList) {
                    for (let i = 0; i < children.length; i++) {
                        ch = children[i];
                        v = allList[i];
                        if (v.div !== ch) { // some child changed
                            resetVisList = true;
                            break;
                        }
                        vis = isVisible(ch, false);
                        if (v.visible !== vis) {
                            resetVisList = true;
                            break;
                        }
                    }
                }
                let isRow = this.container.classList.contains('row');
                let diff = 0;
                let sum = 0;
                let cs;
                if (resetVisList) {
                    visList = [];
                    allList = [];
                    for (let i = 0; i < children.length; i++) {
                        ch = children[i];
                        vis = isVisible(ch, false);
                        allList.push({
                            div: ch,
                            visible: vis
                        });
                        if (!vis)
                            continue;
                        cs = getComputedStyle(ch);
                        if (isRow) {
                            let mw = getMinWidth(ch, cs);
                            let actualw = parseFloat(cs.width);
                            let ow = getOuterWidth(ch, cs);
                            sum += actualw + ow;
                            if (actualw < mw) {
                                diff += (mw - actualw);
                            }
                            visList.push({
                                div: ch,
                                minWidth: mw,
                                width: actualw,
                                outerWidth: ow,
                                flexGrow: cs.flexGrow,
                                issplitter: ch.classList.contains('splitter')
                            });
                        }
                        else {
                            let mh = getMinHeight(ch, cs);
                            let actualh = parseFloat(cs.height);
                            let oh = getOuterHeight(ch, cs);
                            sum += actualh + oh;
                            if (actualh < mh) {
                                diff += (mh - actualh);
                            }
                            visList.push({
                                div: ch,
                                minHeight: mh,
                                height: actualh,
                                outerHeight: oh,
                                flexGrow: cs.flexGrow,
                                issplitter: ch.classList.contains('splitter')
                            });
                        }
                    }
                }
                else {
                    // no visiblity change, just recalculate sizes
                    for (let i = 0; i < visList.length; i++) {
                        ch = visList[i];
                        if (isRow) {
                            ch.width = getFastWidth(ch.div, ch.minWidth);
                            sum += ch.width + ch.outerWidth;
                            if (ch.width < ch.minWidth) {
                                diff += (ch.minWidth - ch.width);
                            }
                        }
                        else {
                            ch.height = getFastHeight(ch.div, ch.minHeight);
                            sum += ch.height + ch.outerHeight;
                            if (ch.height < ch.minHeight) {
                                diff += (ch.minHeight - ch.height);
                            }
                        }
                    }
                }
                if (isRow) {
                    let w = getFastWidth(this.container, 0);
                    if (!w)
                        return;
                    sum -= w;
                    if (sum > diff)
                        diff = sum;
                    if (diff > 0) {
                        // we do not fit, try to find resizable child and reduce it
                        let obj;
                        let changed = false;
                        for (let i = 0; i < visList.length && diff > 0; i++) {
                            obj = visList[i];
                            if ((obj.flexGrow !== '0') || (obj.issplitter) || (obj.minWidth >= obj.width))
                                continue;
                            // must have splitter beside
                            if ((i > 0) && (visList[i - 1].issplitter) || (i < (visList.length - 1)) && (visList[i + 1].issplitter)) {
                                let usediff = Math.min(obj.width - obj.minWidth, diff);
                                if (obj.div.style.flexBasis)
                                    obj.div.style.flexBasis = (obj.width - usediff) + 'px';
                                obj.div.style.width = (obj.width - usediff) + 'px';
                                changed = true;
                                diff -= usediff;
                            }
                            if (diff <= 0)
                                break;
                        }
                        if (changed) {
                            evt.stopPropagation();
                            evt.preventDefault();
                            for (let i = 0; i < visList.length; i++) {
                                deferredNotifyLayoutChangeDown(visList[i].div); // call only down, we changed only childs
                            }
                        }
                    }
                }
                else {
                    // is column            
                    // check if we fit
                    let h = getFastHeight(this.container);
                    if (!h)
                        return;
                    sum -= h;
                    if (sum > diff)
                        diff = sum;
                    if (diff > 0) {
                        // we do not fit, try to find resizable child and reduce it
                        let obj;
                        let changed = false;
                        for (let i = 0; i < visList.length && diff > 0; i++) {
                            obj = visList[i];
                            if ((obj.flexGrow !== '0') || (obj.issplitter) || (obj.minHeight >= obj.height))
                                continue;
                            // must have splitter beside
                            if ((i > 0) && (visList[i - 1].issplitter) || (i < (visList.length - 1)) && (visList[i + 1].issplitter)) {
                                let usediff = Math.min(obj.height - obj.minHeight, diff);
                                if (obj.div.style.flexBasis)
                                    obj.div.style.flexBasis = (obj.height - usediff) + 'px';
                                obj.div.style.height = (obj.height - usediff) + 'px';
                                changed = true;
                                diff -= usediff;
                            }
                            if (diff <= 0)
                                break;
                        }
                        if (changed) {
                            evt.stopPropagation();
                            evt.preventDefault();
                            for (let i = 0; i < visList.length; i++) {
                                deferredNotifyLayoutChangeDown(visList[i].div); // call only down, we changed only childs
                            }
                        }
                    }
                }
            };
            //app.listen(this.container, 'layoutchange', this._layoutChangeHandler);
        }
    }
    setFocus() {
        this.container.focus(); // overriden in descendants
    }
    setFocusedAndSelectedIndex(idx) {
        // overriden in descendants
        return dummyPromise();
    }
    setItemFullyVisibleCentered(idx) {
        // overriden in descendants
    }
    setItemFullyVisible(idx) {
        // overriden in descendants
    }
    editStart() {
        // overriden in descendants
    }
    get selectionMode() {
        return false; // overriden in descendants
    }
    set selectionMode(value) {
        // overriden in descendants
    }
    get multiselect() {
        return false; // overriden in descendants
    }
    set multiselect(value) {
        // overriden in descendants
    }
    get resizable() {
        return this._isresizable;
    }
    set resizable(val) {
        this._isresizable = val; // overriden in descendants        
    }
    get dataSource() {
        return this._dataSource;
    }
    set dataSource(value) {
        this._dataSource = value;
    }
    get menuArray() {
        return this._menuArray;
    }
    set menuArray(value) {
        this._menuArray = value;
    }
}
registerClass(Control);
/**
NOTE: This is LEGACY in version 5.1, use ES6 class/extends and registerClass instead

Inherits a control to a new one. Such a newly created class also contains $super field.
This is because JavaScript does not include native inheritance. For a brief on inheritance, there are many helpful resources online about object-oriented programming. <a target="_blank" href="http://web.archive.org/web/20210717161345/https://www.educative.io/blog/object-oriented-programming">Here is one.</a>

@example

    inheritClass('ListView', Control, {
        initialize: function () {},
        anotherMethod: function (param) {}
    }, {
        aProperty: {
            get: function () {return _value;},
            set: function (value) {value = _value;}
        }
    });

@method inheritClass
@for Window
@param {string} className name of the new class
@param {any} parent parent class to inherit from
@param {Object} methods List of all methods, use 'initialize' as a constructor
@param {Object} properties List of all properties
*/
export function inheritClass(className, parent, methods, properties) {
    window[className] = inherit(className, parent, methods, properties);
}
window['inheritClass'] = inheritClass;
export function classCreation(rootelem, params) {
    if (this.initialize)
        this.initialize(rootelem, params);
    // check data-control-class attribute, add in case it is not present yet
    if (rootelem && rootelem.hasAttribute && !rootelem.hasAttribute('data-control-class')) {
        rootelem.setAttribute('data-control-class', 'Control');
    }
    // set passed attributes
    for (let key in params) {
        this[key] = params[key];
    }
    if (rootelem && rootelem.hasAttribute && rootelem.hasAttribute('data-control-default-focus')) {
        this.container.focus();
    }
}
window['classCreation'] = classCreation;
export function inherit(className, parent, methods, properties) {
    // JH: This way we can do it without eval(), which doesn't work the way we need here in the strict mode
    let newclass = new Function('return function ' + className + '() {"use strict";classCreation.apply(this, arguments)}')();
    newclass.prototype = Object.create(parent.prototype);
    newclass.prototype.constructor = newclass;
    newclass.$super = parent.prototype;
    newclass.$superclass = parent;
    newclass.inherit = function (methods, properties) {
        return inherit(newclass, methods, properties);
    };
    // Prepare methods
    if (methods) {
        for (let method in methods) {
            newclass.prototype[method] = methods[method];
        }
    }
    // Prepare properties
    if (properties) {
        Object.defineProperties(newclass.prototype, properties);
    }
    return newclass;
}
window['inherit'] = inherit;
export function inherited(method, control, args) {
    // LS: isn't used currently, but once completed then we could simply write
    //     inherited('initialize', this, arguments);  
    //     instead of current
    //     ListView.$super.initialize.apply(this, arguments); 
    //alert(JSON.stringify(args));
    // get/pass the inheritance level in args:
    let level = 0;
    let inheritInfo = args[args.length - 2]; // the last argument is always null
    if (!inheritInfo || !inheritInfo.__inheritanceLevel) {
        args[args.length - 1] = {
            __inheritanceLevel: 1
        };
        args.length++;
        args[args.length - 1] = null; // the last argument is always null
    }
    else if (inheritInfo && inheritInfo.__inheritanceLevel) {
        level = inheritInfo.__inheritanceLevel;
        inheritInfo.__inheritanceLevel++;
    }
    // get the correct class from constructor.name based on the level info:
    let cl = window[control.constructor.name];
    while (level > 0) {
        // @ts-ignore
        cl = window[cl.$super.constructor.name];
        level--;
    }
    // @ts-ignore
    return cl.$super[method].apply(control, args);
}
window['inherited'] = inherited;
export function getPixelSize(val, attr, ctrl) {
    if (!isNaN(Number(val))) {
        return val;
    }
    else {
        let lval = val.toLowerCase();
        if (lval.indexOf('px') > 0) {
            return parseFloat(lval);
        }
        else if (lval.indexOf('em') > 0) {
            return emToPx(lval);
        }
        else if (lval.indexOf('%') > 0) {
            let par = getParent(ctrl);
            if (par) {
                let cs = getComputedStyle(par);
                let sz = cs[attr];
                return parseFloat(sz);
            }
        }
        else
            return 0; // probably "auto"
    }
    return 0;
}
window['getPixelSize'] = getPixelSize;
export function getMinWidthFromChildren(div, p_cs) {
    let retval = 0;
    let children = div.children;
    let ch;
    let cs;
    p_cs = p_cs || getComputedStyle(div);
    let isrow = ((p_cs.flexDirection === 'row') || (p_cs.flexDirection === 'row-reverse')) && (p_cs.flexWrap === 'nowrap');
    let w;
    for (let i = 0; i < children.length; i++) {
        ch = children[i];
        if (!isVisible(ch, false))
            continue;
        cs = getComputedStyle(ch);
        w = getOuterWidth(ch, cs);
        if (ch.controlClass) {
            w += ch.controlClass.minWidth;
        }
        else {
            if (!cs.minWidth || (cs.minWidth === '0px') || (cs.minWidth === 'auto')) {
                w += getMinWidthFromChildren(ch, cs);
            }
            else {
                w += getPixelSize(cs.minWidth, 'minWidth', ch);
            }
        }
        if (isrow && (cs.position === 'relative'))
            retval += w;
        else {
            //  computing with absolute position removed, not working good
            //                if (cs.position === 'absolute') {
            //                    retval += getPixelSize(cs.left, 'left', ch) + getPixelSize(cs.right, 'right', ch)
            //                }
            retval = Math.max(retval, w);
        }
    }
    return retval;
}
export function getMinHeightFromChildren(div, p_cs) {
    let retval = 0;
    let children = div.children;
    let ch;
    let cs;
    let h;
    p_cs = p_cs || getComputedStyle(div);
    let iscol = ((p_cs.flexDirection === 'column') || (p_cs.flexDirection === 'column-reverse')) && (p_cs.flexWrap === 'nowrap');
    for (let i = 0; i < children.length; i++) {
        ch = children[i];
        if (!isVisible(ch, false))
            continue;
        cs = getComputedStyle(ch);
        h = getOuterHeight(ch, cs);
        if (ch.controlClass) {
            h += ch.controlClass.minHeight;
        }
        else {
            if (!cs.minHeight || (cs.minHeight === '0px') || (cs.minHeight === 'auto')) {
                h += getMinHeightFromChildren(ch, cs);
            }
            else {
                h += getPixelSize(cs.minHeight, 'minHeight', ch);
            }
        }
        if (iscol && (cs.position === 'relative'))
            retval += h;
        else {
            //  computing with absolute position removed, not working good
            //                if (cs.position === 'absolute') {
            //                    retval += getPixelSize(cs.top, 'top', ch) + getPixelSize(cs.bottom, 'bottom', ch)
            //                }
            retval = Math.max(retval, h);
        }
    }
    return retval;
}
export function getMinWidth(div, cs) {
    let retval = 0;
    if (div.controlClass) {
        retval = div.controlClass.minWidth;
    }
    else {
        let minWidthStr = div.style.minWidth;
        if (!minWidthStr) {
            cs = cs || getComputedStyle(div);
            minWidthStr = cs.minWidth;
        }
        if (!minWidthStr || (minWidthStr === '0px') || (minWidthStr === 'auto')) {
            // compute min width from childs
            retval = getMinWidthFromChildren(div, cs);
        }
        else {
            retval = getPixelSize(minWidthStr, 'minWidth', div);
        }
    }
    return retval;
}
window['getMinWidth'] = getMinWidth;
export function getMinHeight(div, cs) {
    let retval = 0;
    if (div.controlClass) {
        retval = div.controlClass.minHeight;
    }
    else {
        let minHeightStr = div.style.minHeight;
        if (!minHeightStr) {
            cs = cs || getComputedStyle(div);
            minHeightStr = cs.minHeight;
        }
        if (!minHeightStr || (minHeightStr === '0px') || (minHeightStr === 'auto')) {
            // compute min width from childs                
            retval = getMinHeightFromChildren(div, cs);
        }
        else {
            retval = getPixelSize(minHeightStr, 'minHeight', div);
        }
    }
    return retval;
}
window['getMinHeight'] = getMinHeight;
