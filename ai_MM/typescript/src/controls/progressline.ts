/**
@module UI
*/

import Control from './control';

/**
UI progress line element (e.g. bookmark indicator)

@class ProgressLine
@constructor
@extends Control
*/
export default class ProgressLine extends Control {
    back: HTMLDivElement;
    front: HTMLDivElement;
    Fvalue: number;

    initialize(parentEl, params) {
        super.initialize(parentEl, params);
        this.container = parentEl;
        cleanElement(this.container); // remove possible elements created by cloning

        this.container.classList.add('progressLine');

        this.back = document.createElement('div');
        this.back.className = 'backLine fill flex column';
        this.container.appendChild(this.back);

        this.front = document.createElement('div');
        this.front.className = 'frontLine';
        this.back.appendChild(this.front);

        this.Fvalue = 0;
        for (let key in params) {
            this[key] = params[key];
        }
    }

    validate(val) {
        return Math.max(Math.min(val, 1), 0);
    }

    refresh() {
        let curr = this.validate(this.value);
        let newPos = curr * 100;
        this.front.style.width = newPos + '%';
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
    
}
registerClass(ProgressLine);