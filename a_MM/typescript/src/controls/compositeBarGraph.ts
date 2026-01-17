registerFileImport('controls/compositeBarGraph');

/**
@module UI
*/

import Control from './control';

/**
UI composite bar graph element

@class CompositeBarGraph
@constructor
@extends Control
*/
class CompositeBarGraph extends Control {
    back: HTMLDivElement;
    FBarCount: number;
    bars: any[];
    fValues: any;
    private _animateTransitions: boolean;

    initialize(parentEl, params) {
        super.initialize(parentEl, params);
        this.container = parentEl;

        this.container.classList.add('graphContainer');
        this.container.setAttribute('data-grow', '1');

        this.back = document.createElement('div');
        this.back.className = 'compositeBar';
        this.container.appendChild(this.back);

        this.FBarCount = params.barCount;

        let bars = [];
        this.bars = bars;

        for (let i = 0; i < this.FBarCount; i++) {
            let bar = document.createElement('div');
            let percent = 100 / params.barCount;
            bar.style.width = percent + '%';
            bar.style.left = (i * percent) + '%';
            bar.classList.add('graphBar');
            bar.classList.add('graphBar' + (i + 1));
            bars.push(bar);
            this.back.appendChild(bar);
        }

        for (let key in params) {
            this[key] = params[key];
        }
    }

    refresh() {
        let values = this.fValues;
        let percentOffset = 0;
        for (let i = 0; i < values.length; i++) {
            let val = values[i];
            let bar = this.bars[i];
            if (val.text) {
                bar.innerText = val.text;
                if (val.hint)
                    bar.setAttribute('data-tip', val.hint);
                else
                    bar.setAttribute('data-tip', val.text);
            }
            let percent = val.percent;
            bar.style.width = percent + '%';
            bar.style.left = percentOffset + '%';
            percentOffset = percentOffset + percent;
        }
    }

    /**
    Gets/Sets text/hint/percentage values of the composite bar

    @property values
    @type Array
    */    
    get values () {
        return this.fValues;
    }
    set values (val) {
        this.fValues = val;
        this.refresh();
    }
    
    /**
    Gets/Sets whether transitions should be animated 

    @property animateTransitions
    @type Boolean
    */    
    get animateTransitions () {
        return this._animateTransitions;
    }
    set animateTransitions (val) {
        this._animateTransitions = val;
        let _this = this;
        this.requestFrame(function () {
            // LS: needs to be in RAF to not affect currently running animations                
            for (let i = 0; i < _this.FBarCount; i++) {
                let bar = _this.bars[i];
                if (_this._animateTransitions)
                    bar.classList.add('transition');
                else
                    bar.classList.remove('transition');
            }
        }, 'animateTransitions');
    }
    
}
registerClass(CompositeBarGraph);