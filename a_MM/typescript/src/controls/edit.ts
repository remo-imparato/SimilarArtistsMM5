'use strict';

import Control from './control';

/**
@module UI
*/

registerFileImport('controls/edit');

/**
Base class for editable line control (default type 'text', optionally 'number').

@example
    <div id="testD" data-control-class="Edit" data-init-params="{type: 'number', min:1, max:10}">        
    </div>

@class Edit
@constructor
@extends Control
*/
export default class Edit extends Control {
    edit: HTMLInputElement;
    private _calcAutoWidthTimeout: number;
    private _readOnly: any;
    
    initialize(elem: HTMLDivElement, params: AnyDict) {
        super.initialize( elem, params);

        this.edit = document.createElement('input');
        if (params && params.type)
            this.edit.type = params.type;
        else
            this.edit.type = 'text';
        if (params) {
            if (params.min != undefined)
                this.edit.setAttribute('min', params.min);
            if (params.max != undefined)
                this.edit.setAttribute('max', params.max);
            if (params.step != undefined)
                this.edit.setAttribute('step', params.step);
        }
        this.edit.classList.add('stretchWidth');
        let edit = this.edit;

        /* LS: based on testing the following workaround is no longer needed in the newer Chromium versions (+ the workaround caused #16465)
        var initText = '{C0354CB1-8728-40BA-A91F-64169905F55C}'; // LS: initial text is needed otherwise controls won't align to baseline (until window resize)                
        edit.value = initText
        this.requestFrame(function () {
            if (edit.value == initText)
                edit.value = '';
        });*/

        this.container.appendChild(this.edit);
        this.container.classList.add('inline');
        this.container.classList.add('edit');

        let _this = this;
        this.localListen(this.edit, 'focus', function (e) {
            e.stopPropagation();
            let evt = createNewEvent('focus');
            _this.container.dispatchEvent(evt);
        });
        this.localListen(this.edit, 'blur', function (e) {
            e.stopPropagation();
            let evt = createNewEvent('blur');
            _this.container.dispatchEvent(evt);
        });
        this.localListen(this.edit, 'change', function (e) {
            e.stopPropagation();
            let evt = createNewEvent('change');
            _this.container.dispatchEvent(evt);
        });
        this.localListen(this.edit, 'input', function (e) {
            e.stopPropagation();
            let evt = createNewEvent('input');
            _this.container.dispatchEvent(evt);
            let evt2 = createNewEvent('change');
            _this.container.dispatchEvent(evt2);
        });
        this.readOnly = (params && params.readOnly);
    }

    focus() {
        this.edit.focus();
    }

    blur() {
        this.edit.blur();
    }

    select() {
        this.edit.select();
    }

    _setAutoWidth() {
        if (!this.edit)
            return;
        let mtag = document.createElement('div');
        mtag.style.display = 'inline-block';
        mtag.style.position = 'absolute';
        mtag.style.top = '-1000px';
        mtag.style.left = '-1000px';
        let cs = getComputedStyle(this.edit, null);
        mtag.style.font = cs.getPropertyValue('font');
        this.container.appendChild(mtag);
        let w = 0;

        mtag.innerText = this.value + '.';
        let twidth = getFullWidth(mtag);

        let ow = getOuterWidth(this.edit, cs);
        twidth += ow + 1;
        this.container.removeChild(mtag);
        this.edit.style.width = twidth + 'px';
    }

    setAutoWidth() {
        // moved to requestTimeout because of #13810 , don't move it to requestFrame (it doesn't help for some reason)
        this._calcAutoWidthTimeout = 1; /*ms*/
        this.requestTimeout(this._setAutoWidth.bind(this), this._calcAutoWidthTimeout);
    }

    calcAutoWidth() {
        // re-calculates auto-width now (e.g. called manually when all is visible so that getOuterWidth returns correct values)
        this._setAutoWidth();
    }



    /**
    Gets/sets value (text or number based on type)

    @property value
    @type string
    */

    get value (): string | number {
        if (this.edit.type == 'number') {
            let ret = Number(this.edit.value); // LS: convert to number (to be passed correctly to shared object properties)
            let min = ret;
            let max = ret;

            if (this.edit.hasAttribute('min'))
                min = Number( this.edit.getAttribute('min'));
            if (this.edit.hasAttribute('max'))
                max = Number( this.edit.getAttribute('max'));

            return Math.max(min, Math.min(max, ret));
        } else
            return this.edit.value;
    }
    set value (value: string | number) {
        if (this.edit.value != value) {
            this.edit.value = value.toString();
            this.raiseEvent('change', {});
        }
    }
    
    /**
    Gets/sets whether the line should be read only

    @property readOnly
    @type {boolean}
    */        
    get readOnly () {
        return this._readOnly;
    }
    set readOnly (value) {
        this._readOnly = value;
        if (this.edit) {
            if (value)
                this.edit.setAttribute('readonly', '1');
            else
                this.edit.removeAttribute('readonly');
        }
    }
    
}
registerClass( Edit);
