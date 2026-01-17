/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

'use strict';
registerFileImport('controls/toolbutton');
/**
@module UI
*/
import Control from './control';
/**
Base class for button in Buttons control.

@class ToolButton
@constructor
@extends Control
*/
export default class ToolButton extends Control {
    initialize(elem, params) {
        super.initialize(elem, params);
        this.buttonDiv = document.createElement('div');
        params = params || {};
        if (!params.noAddClasses)
            this.buttonDiv.classList.add('toolbutton');
        if (params.caption)
            this.buttonDiv.textContent = params.caption;
        let icon = elem.getAttribute('data-icon');
        if (icon && icon != '') {
            this.buttonDiv.setAttribute('data-icon', icon);
            elem.removeAttribute('data-icon');
        }
        // For screen readers: aria-label is added to the svg after loaded
        let ariaLabel = elem.getAttribute('data-aria-label');
        if (ariaLabel && ariaLabel != '') {
            this.buttonDiv.setAttribute('data-aria-label', _(ariaLabel));
            elem.removeAttribute('data-aria-label');
        }
        this.container.appendChild(this.buttonDiv);
    }
    focusHandler(element, newState) {
        // handle and draw keyboard focus - override to allow focusing menu button inside LV, like popups
        let state = false;
        if (!this.standalone)
            state = super.focusHandler(element, newState);
        else {
            if (element) {
                if (newState)
                    element.setAttribute(getFocusAttribute(), '1');
                else
                    element.removeAttribute(getFocusAttribute());
                if (element.controlClass)
                    element.controlClass.focusRefresh(newState);
                this.focusRefresh(newState);
            }
        }
        return state;
    }
    /**
    If true, makes rating control tabbable

    @property tabbable
    @type boolean
    @default false
    */
    get standalone() {
        return this._standalone;
    }
    set standalone(val) {
        if (val === this._standalone)
            return;
        this._standalone = val;
        if (val)
            this.tabIndex = 0;
        else
            this.tabIndex = -1;
    }
}
registerClass(ToolButton);
