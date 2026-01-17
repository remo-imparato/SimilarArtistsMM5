/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

/**
@module UI
*/
import Control from './control';
/**
UI progressBar element

@class progressBar
@constructor
@extends Control
*/
export default class ProgressBar extends Control {
    initialize(parentEl, params) {
        super.initialize(parentEl, params);
        params = params || {};
        this.container = parentEl;
        cleanElement(this.container); // remove possible elements created by cloning
        this.container.classList.add('progressContainer');
        this.back = document.createElement('div');
        this.back.className = 'progressBar';
        this.container.appendChild(this.back);
        this.client = document.createElement('div');
        this.client.className = 'client fill flex column center';
        this.back.appendChild(this.client);
        this.label = document.createElement('div');
        this.label.className = 'label';
        this.back.appendChild(this.label);
        this.progress = document.createElement('div');
        if (params.transition == false)
            this.progress.className = 'progress';
        else
            this.progress.className = 'progress transition';
        this.back.appendChild(this.progress);
        if (params.grow !== undefined) {
            this.container.setAttribute('data-grow', '1');
        }
        this.Fvalue = 0;
        this.Ftext = '';
        this.Fhint = '';
        this.invalidate = function (val) {
            return Math.max(Math.min(val, 1), 0);
        };
        this.refresh = function () {
            let curr = this.invalidate(this.value);
            let newPos = curr * 100;
            this.progress.style.width = newPos + '%';
            this.label.innerText = this.Ftext;
            if (this.Fhint)
                this.back.setAttribute('data-tip', this.Fhint);
            else
                this.back.removeAttribute('data-tip');
        }.bind(this);
        for (let key in params) {
            this[key] = params[key];
        }
    }
    cleanUp() {
        this.back = null;
        this.client = null;
        this.label = null;
        this.progress = null;
        super.cleanUp();
    }
    /**
    Gets/Sets value of the progress (in range 0..1)

    @property value
    @type float
    */
    get value() {
        return this.Fvalue;
    }
    set value(val) {
        this.Fvalue = val;
        this.refresh();
    }
    /**
    Gets/Sets text of the progress

    @property text
    @type string
    */
    get text() {
        return this.Ftext;
    }
    set text(val) {
        this.Ftext = val;
        this.refresh();
    }
    /**
    Gets/Sets hint of the progress

    @property hint
    @type string
    */
    get hint() {
        return this.Fhint;
    }
    set hint(val) {
        this.Fhint = val;
        this.refresh();
    }
}
registerClass(ProgressBar);
