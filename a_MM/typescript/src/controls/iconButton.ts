'use strict';

registerFileImport('controls/iconButton');

/**
@module UI
*/

import ToolButton from './toolbutton'; 

/**
Base class for a generic icon button.

@class IconButton
@constructor
@extends ToolButton
*/
export default class IconButton extends ToolButton {
    private _icon: any;
    private _tip: any;

    initialize(elem, params) {
        super.initialize(elem, params);
        this.buttonDiv.classList.add('icon-button');
        if (params && params.background == true) {
            this.buttonDiv.classList.add('icon-button-background');
        }
    }
    
    set icon (value) {
        if (value && this._icon != value) {
            this._icon = value;
            let iconDiv = this.buttonDiv;
            loadIconFast(value, (icon) => {
                if (this._icon == value) { // icon could change during loading -- #21003
                    setIconFast(iconDiv, icon);
                    // Screen reader support
                    let ariaLabel = iconDiv.getAttribute('data-aria-label');
                    if (ariaLabel && ariaLabel != '') {
                        setIconAriaLabel(iconDiv, _(ariaLabel));
                    }
                }
            });
        }
    }
    get icon () {
        return this._icon;
    }
        
    set tip(value) {
        if (value && this._tip != value) {
            this._tip = value;
            this.container.setAttribute('data-tip', value);
        }
    }
    get tip () {
        return this._tip;
    }
    
}
registerClass(IconButton);