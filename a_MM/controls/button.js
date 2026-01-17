/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

'use strict';
registerFileImport('controls/button');
import Control from './control';
/**
 * Base class for button in Buttons control.
 */
export default class Button extends Control {
    initialize(elem, params) {
        super.initialize(elem, params);
        this.isButton = !elem.hasAttribute('data-no-button');
        if (this.isButton) {
            this.buttonDiv = document.createElement('div');
            this.buttonDiv.classList.add('button');
            this.buttonDiv.setAttribute('role', 'button');
            if (this.container.hasAttribute('data-default')) {
                this.buttonDiv.setAttribute('data-default', this.container.getAttribute('data-default') || '');
            }
            // need to localize it here, to correctly compute width, where needed
            if (elem.hasAttribute('data-add-dots')) {
                elem.textContent = _(elem.textContent) + '...';
            }
            if (elem.textContent != '') {
                this.textContent = _(elem.textContent);
                elem.textContent = '';
            }
            elem.setAttribute('data-no-localize', '1'); // in order to not localize again
            this.container.appendChild(this.buttonDiv);
            this.localListen(this.container, 'click', (e) => {
                if (e.clientX && e.clientY) { // be sure that it is click by mouse (not 'click' event raised by Enter key in buttons.handleKeyDown) -- issue #19197
                    if (this.buttonDiv && this.container.contains(this.buttonDiv) && !isInElement(e.clientX, e.clientY, this.buttonDiv)) {
                        e.stopImmediatePropagation();
                        e.stopPropagation();
                    }
                }
            }, true);
        }
    }
    /**
    Gets/sets data-value attribute of the button element. Get returns null if not found.

    @property dataValue
    @type string
    */
    get dataValue() {
        let retval = null;
        if (this.container && this.container.hasAttribute('data-value')) {
            retval = this.container.getAttribute('data-value');
        }
        return retval || '';
    }
    set dataValue(value) {
        if (this.container)
            this.container.setAttribute('data-value', value);
    }
    /**
    Gets/sets text content of the button

    @property textContent
    @type string
    */
    get textContent() {
        return this.buttonDiv.textContent || '';
    }
    set textContent(value) {
        let ak = uitools.getAccessKey(value);
        if (ak) {
            this.buttonDiv.accessKey = ak.toLowerCase();
            this.buttonDiv.innerHTML = value.replace('&' + ak, '<u>' + ak + '</u>');
        }
        else {
            this.buttonDiv.textContent = value;
        }
    }
    /**
    Gets/sets width of the button

    @property width
    @type integer
    */
    get width() {
        let cs = getComputedStyle(this.buttonDiv, null);
        return parseFloat(cs.getPropertyValue('width'));
    }
    set width(value) {
        this.buttonDiv.style.width = value + 'px';
    }
    /**
    Gets/sets the button default (highlighted)

    @property default
    @type boolean
    */
    get default() {
        return this.buttonDiv.hasAttribute('data-default');
    }
    set default(value) {
        if (value) {
            this.buttonDiv.setAttribute('data-default', '1');
            this.container.setAttribute('data-default', '1');
            let parent = this.container.parentNode;
            while (parent) {
                if (parent.controlClass && parent.controlClass.constructor.name == 'Buttons') {
                    parent.controlClass.defaultBtn = this.container;
                    break;
                }
                parent = parent.parentNode;
            }
        }
        else {
            this.buttonDiv.removeAttribute('data-default');
            this.container.removeAttribute('data-default');
        }
    }
}
registerClass(Button);
