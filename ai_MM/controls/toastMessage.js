/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

registerFileImport('controls/toastMessage');

"use strict";

var toastMessageCtrl = undefined;

/**
@module UI
*/

requirejs('controls/control');

/**
Class for handling toast messages.

@class ToastMessage
@constructor
@extends Control
*/

class ToastMessage extends Control {

    initialize(parentel, params) {
        super.initialize(parentel, params);
        this.container.innerHTML = loadFile('file:///controls/toastMessage.html');
        initializeControls(this.container);
        this.disableStateStoring = true;
        this.txtElement = this.qChild('toastText');
        this.undoButton = this.qChild('undoButton');
        this.customButton = this.qChild('customButton');
        this.closeButton = this.qChild('closeButton');
        this.lastCallback = undefined;
        this.isMousedOver = false;
        this.enableHoverPersistence = true; // can be disabled via an addon
        this.localListen(this.undoButton, 'click', function () {
            this.finish(false, true);
        }.bind(this));
        this.localListen(this.closeButton, 'click', function () {
            this.finish(true, true);
        }.bind(this));
        this.localListen(this.container, 'click', function () {
            if (this._timeoutIDs && this.enableHoverPersistence == true) {
                clearTimeout(this._timeoutIDs.hidetimer);
                setVisibilityFast(this.closeButton, true);
            }
        }.bind(this));
        this.localListen(this.container, 'mouseenter', function () {
            this.isMousedOver = true;
        }.bind(this));
        this.localListen(this.container, 'mouseleave', function () {
            this.isMousedOver = false;
        }.bind(this));
        setVisibilityFast(this.container, false);
    }

    finish(retval, doClose) {
        if (doClose) {
            animTools.animateToastMessage(this.container, false);
        }
        if (this.lastCallback) {
            this.lastCallback(retval);
            this.lastCallback = undefined;
        }
    }
    /**
    Hides toast message prematurely.

    @method hide
    */
    hide() {
        this.finish(true, true);
    }

    /**
    Displays toast message.

    @method show
    @param {string} txt Text of the message to show, could be HTML formatted.
    @param {Object} [params] Object with optional parameters. Supported properties are:<br><ul>
        <li>callback: optional, function called after the end of displaying toast message, returns true if "Undo" was not pressed</li>
        <li>disableUndo: optional, if true, do not display "Undo" button in the message</li>        
        <li>onCloseClick: optional, specifies close button click function</li>
        <li>disableClose: optional, if true, do not display "Close" button in the message</li>
        <li>button: optional, specifies custom button definition (caption and onClick needs to be specified)</li>
        <li>delay: display time in ms, default is 12000ms</li>
        </ul>
    */


    show(txt, params) {
        if (!txt)
            return;
        params = params || {};
        this.finish(true, false);

        cleanElement(this.txtElement);
        this.txtElement.innerHTML = txt;
        initializeControls(this.txtElement);

        if (params && params.onLinkClick) {
            var link = this.qChild('link');
            if (link)
                link.controlClass.localListen(link, 'click', () => {
                    params.onLinkClick();
                    this.finish(true, true);
                });
        }

        if (this._onCustomBtnClickFn)
            app.unlisten(this.customButton, 'click', this._onCustomBtnClickFn);

        if (params.button) {
            setVisibilityFast(this.customButton, true);
            this.customButton.textContent = params.button.caption;
            if (params.button.onClick)
                this._onCustomBtnClickFn = app.listen(this.customButton, 'click', () => {
                    params.button.onClick();
                    this.finish(true, true);
                });
        } else {
            setVisibilityFast(this.customButton, false);
        }
        if (!params.callback)
            setVisibilityFast(this.undoButton, false);
        else
            setVisibilityFast(this.undoButton, !params.disableUndo);
        setVisibilityFast(this.closeButton, !params.disableClose);
        if (this._onCloseBtnClickFn)
            app.unlisten(this.closeButton, 'click', this._onCloseBtnClickFn);
        if (params && params.onCloseClick)
            this._onCloseBtnClickFn = app.listen(this.closeButton, 'click', params.onCloseClick);

        if (!isVisible(this.container, false))
            animTools.animateToastMessage(this.container, true);
        this.lastCallback = params.callback;
        var delay = params.delay || this.delay;
        this.requestTimeout(function () {
            if (this.isMousedOver)
                setVisibilityFast(this.closeButton, true);
            else
                this.finish(true, true);
        }.bind(this), delay, 'hidetimer');

        if (params.top)
            this.container.style.top = params.top;

        if (params.left)
            this.container.style.left = params.left;
        else
            this.container.style.left = '';

        if (params.left && params.right)
            this.container.style.width = params.right - params.left;
        else
            this.container.style.width = '';
    }

    cleanUp() {
        cleanElement(this.txtElement);
        if (this._onCustomBtnClickFn)
            app.unlisten(this.customButton, 'click', this._onCustomBtnClickFn);
        if (this._onCloseBtnClickFn)
            app.unlisten(this.closeButton, 'click', this._onCloseBtnClickFn);

        super.cleanUp();
        toastMessageCtrl = undefined;
    }

    /**
    Toast message delay, in ms.

    @property delay
    @type Number
    */    
    get delay() {
        return 12000; // #17179
    }
    
};
registerClass(ToastMessage);

// prepare uitools.toastMessage
window.uitools = window.uitools || {};

Object.defineProperty(window.uitools, 'toastMessage', {
    get: function () {
        if (toastMessageCtrl && !window.isMicroPlayer)
            return toastMessageCtrl;

        if (window._cleanUpCalled || window.isMicroPlayer) {
            // document has been already cleaned up, return "dummy" (to prevent crash A40E8AEF) 
            return {
                show: () => {}
            };
        }

        var tmess = qid('toastMessage'); // predefined placing
        if (!tmess) {
            // no predefined placing, use default one in the body
            var tmess = document.createElement('div');
            tmess.setAttribute('data-id', 'toastMessage');
            tmess.classList.add('toastContainer');
            tmess.style.display = 'none';
            document.body.appendChild(tmess);
            tmess.controlClass = new ToastMessage(tmess);
        };
        toastMessageCtrl = tmess.controlClass;
        return toastMessageCtrl;
    },
});
