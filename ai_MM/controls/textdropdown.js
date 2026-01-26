/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

/**
@module UI
*/

requirejs("controls/control");
requirejs("controls/dropdown");

var usePopupWindows = false;

/**
UI TextDropdown element

@class TextDropdown
@constructor
@extends Control
*/
class TextDropdown extends Control {

    initialize(parentel, params) {
        super.initialize(parentel, params);
        this.container.classList.add('clickable');

        this.readOnly = true;

        this.edit = this.container;

        if (!this.container.tabIndex || this.container.tabIndex < 0)
            this.container.tabIndex = 999; // Tab index makes sure that we can get focus

        this.sendKeyToLV = function (evt) {
            if (this.w) {
                this.w.getValue('handleKeypressed')(evt.key, evt.shiftKey, evt.ctrlKey, evt.altKey, evt.metaKey);
                return;
            }
        }.bind(this);

        this.handleKeyDown = function (evt) {
            if (this.openingList || this.disabled)
                return;
            switch (evt.keyCode) {
                case 33: // page up
                case 34: // page down
                case 35: // end
                case 36: // home
                case 38: // up
                case 40: // down
                    {
                        if (this.w) {
                            evt.preventDefault();
                            evt.stopPropagation();
                            this.sendKeyToLV(evt);
                        }
                        return;
                    }
                case 13: // Enter
                    {
                        evt.preventDefault();
                        evt.stopPropagation();
                        this.sendKeyToLV(evt);
                        return;
                    }
                case 27: // Esc
                    {
                        evt.preventDefault();
                        evt.stopPropagation();
                        this.escapedDropdown = true;
                        this.closePopup();
                        return;
                    }
            }
        }.bind(this);

        this.handleFocus = function (evt) {
            if (this.disabled)
                return;
            this.container.setAttribute('data-focused', '1');
        }.bind(this);

        this.handleBlur = function (evt) {
            if (this.disabled)
                return;
            this.container.removeAttribute('data-focused');
            if (!this.openingList && !this.clickInside) // close only when not clicked inside dropdown popup list 
                closeDropdownPopup(this);
            this.removeCaptureListeners();
        }.bind(this);

        this.clickInside = false;

        this.editboxMouseDownCapture = function (evt) {
            for (var element = evt.target; element; element = element.parentNode) {
                if (element.classList && element.classList.contains('innerWindow')) {
                    this.clickInside = true;
                    return;
                }
            }
            this.clickInside = false;
            this.escapedDropdown = true;
        }.bind(this);

        this.localListen(this.container, 'keydown', this.handleKeyDown);
        this.localListen(this.container, 'focus', this.handleFocus);
        this.localListen(this.container, 'blur', this.handleBlur);


        app.listen(this.container, 'click', function () {
            if (this._preventOpenPopup !== undefined) return;
            var focusedIdx = -1;
            if (this.valuelist)
                focusedIdx = this.valuelist.focusedIndex;
            if (this.w === undefined) {
                this._lastSelectedItem = undefined;
                openDropdownPopup({
                    wnd: this,
                    control: this.container,
                    width: this.getAutoWidth(),
                    filter: '',
                    preserveFocus: true,
                    selected: function (item) {
                        this.removeCaptureListeners();
                        if(!this.escapedDropdown) {
                            var evt = createNewEvent('change');
                            this.container.dispatchEvent(evt);
                        }
                    }.bind(this),
                });
                this.setCaptureListeners();
                this.escapedDropdown = false;
            } else {
                this.removeCaptureListeners();
                this.w.closeWindow();
            }
        }.bind(this));

        this.closePopup = function () {
            if (this.w) {
                this.removeCaptureListeners();
                this.w.closeWindow();
                // set timeout to prevent open popup again when user clicked
                this._preventOpenPopup = true;
                setTimeout(function () {
                    this._preventOpenPopup = undefined;
                }.bind(this), 200);
            }
        }.bind(this);

        // these functions need to be here because of dropdown
        ////////////////////////////////////////////////////////////
        this.getEditValue = function (val) {};

        this.setEditValue = function (val) {};

        this.changeSelected = function (val) {
            this._lastSelectedItem = val;
        };
        ////////////////////////////////////////////////////////////

        // set passed attributes
        for (var key in params) {
            this[key] = params[key];
        }
    }

    setCaptureListeners() {
        if (this.captureListenersSet)
            return;
        this.captureListenersSet = true;
        app.listen(window, 'mousedown', this.editboxMouseDownCapture, true);
    }

    removeCaptureListeners() {
        if (!this.captureListenersSet)
            return;
        this.captureListenersSet = false;
        app.unlisten(window, 'mousedown', this.editboxMouseDownCapture, true);
    }

    getAutoWidth() {
        if (!this.valuelist)
            return 0;
        var mtag = document.createElement('div');
        mtag.style.display = 'inline-block';
        mtag.style.position = 'absolute';
        mtag.style.top = '-1000px';
        mtag.style.left = '-1000px';
        document.body.appendChild(mtag);
        var twidth = 0;
        var w = 0;
        this.valuelist.locked(function () {
            for (var i = 0; i < this.valuelist.count; i++) {
                mtag.innerHTML = this.valuelist.getValue(i).toString();
                w = getFullWidth(mtag);
                if (w > twidth)
                    twidth = w;
            }
        }.bind(this));
        twidth += 15;
        document.body.removeChild(mtag);
        return twidth;
    }

    cleanUp() {
        this.removeCaptureListeners();
        super.cleanUp();
    }
    
    get dataSource () {
        return this.valuelist;
    }
    set dataSource (value) {
        this.valuelist = value;
    }
        
    get focusedIndex () {
        assert(this.readOnly && (this.valuelist !== undefined), 'focusedIndex supported only for dropdown list (readOnly: true)');
        var idx = -2;
        if (this.w)
            idx = this.w.getValue('getFocusedIndex')();
        else if (!usePopupWindows && this.dropdownHandler)
            idx = this.dropdownHandler.focusedIndex;
        if (idx === -2) {
            idx = this.valuelist.focusedIndex;
        }
        return idx;
    }
    set focusedIndex (value) {
        assert(this.readOnly && (this.valuelist !== undefined), 'focusedIndex supported only for dropdown list (readOnly: true)');
        this.valuelist.focusedIndex = value;
        if (!usePopupWindows && this.dropdownHandler)
            this.dropdownHandler.focusedIndex = value;
    }
    
}
registerClass(TextDropdown);
