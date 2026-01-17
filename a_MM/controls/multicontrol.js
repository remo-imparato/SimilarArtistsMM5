/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

/**
@module UI
*/
import Control from './control';
/**
UI element. Parent of all controls, that support more variants for more screen resolutions

@class MultiControl
@constructor
@extends Control
*/
class MultiControl extends Control {
    initialize(rootelem, params) {
        super.initialize(rootelem, params);
        this.activeControlName = '';
        let lastWidth = 0;
        let lastHeight = 0;
        let resizeHandler = function (e) {
            if (this.visible) {
                if ((lastWidth === this.container.offsetWidth) && (lastHeight === this.container.offsetHeight))
                    return;
                lastWidth = this.container.offsetWidth;
                lastHeight = this.container.offsetHeight;
                let newcontrolname = this.decideFn(this.container.offsetWidth, this.container.offsetHeight);
                if (this.activeControlName !== newcontrolname) {
                    if (this.activeControl) {
                        removeElement(this.activeControl);
                        this.activeControl = undefined;
                    }
                    this.activeControlName = newcontrolname;
                    let div = this.addControl(newcontrolname, params);
                    div.classList.add('fill');
                    this.activeControl = div;
                }
            }
        }.bind(this);
        this.localListen(this.container, 'layoutchange', resizeHandler);
        resizeHandler();
    }
    decideFn(w, h) {
        assert(false, 'multicontrol.decideFn must be predefined');
    }
    get dataSource() {
        return this.activeControl ? this.activeControl.controlClass.dataSource : null;
    }
    set dataSource(ds) {
        if (this.activeControl)
            this.activeControl.controlClass.dataSource = ds;
    }
}
registerClass(MultiControl);
