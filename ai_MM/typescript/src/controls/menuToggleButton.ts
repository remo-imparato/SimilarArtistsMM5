'use strict';

import Control from './control';
import MenuButton from './menuButton';

/**
UI menu button element.

@class MenuToggleButton
@constructor
@extends Control
*/

class MenuToggleButton extends Control {
    btnToggle: HTMLDivElement;
    btnSwitch: HTMLDivElement;    
    private _icon: string;

    initialize(parentel, params) {
        super.initialize(parentel, params);

        let toolButtonClass = 'toolbutton';

        this.container.classList.add('flex');
        this.container.classList.add('row');

        this.btnToggle = document.createElement('div');
        this.btnToggle.classList.add('inline');
        this.btnToggle.classList.add(toolButtonClass);
        this.btnToggle.setAttribute('data-id', 'btnToggle');
        this.container.appendChild(this.btnToggle);

        this.btnSwitch = document.createElement('div');
        this.btnSwitch.classList.add('inline');
        this.btnSwitch.setAttribute('data-id', 'btnSwitch');
        this.btnSwitch.setAttribute('data-icon', 'downArrow');
        this.btnSwitch.setAttribute('data-control-class', 'MenuButton');
        this.btnSwitch.setAttribute('data-aria-label', _('Choose alternate') + ' ' + _('View'));
        params = params || {};
        if (typeof params === 'string')
            this.btnSwitch.setAttribute('data-init-params', params);
        this.container.appendChild(this.btnSwitch);
        initializeControls(this.container);
        this.btnSwitch.tabIndex = params.tabbable ? 0 : -1;
        this.localListen(this.btnToggle, 'click', this._doToggle.bind(this));
    }

    _doToggle() {
        let ar = this._menuArray;
        for (let i = 0; i < ar.length; i++) {
            let itm = ar[i];
            let isChecked = resolveToValue(itm.checked, false, null, itm);
            if (isChecked) {
                if (i + 1 < ar.length && !ar[i + 1].separator && (ar[i + 1].grouporder == ar[i].grouporder))
                    ar[i + 1].execute();
                else
                    ar[0].execute();
                break;
            }
        }
    }
    
    set menuArray (value) {
        this._menuArray = value;
        this._menuArray.sort(function (item1, item2) {
            return (item1.grouporder * 1000 + (item1.order || 0)) - (item2.grouporder * 1000 + (item2.order || 0)); // #16384
        });
        this.btnSwitch.controlClass.menuArray = this._menuArray;
    }
    get menuArray () {
        return this._menuArray;
    }
        
    set icon (value) {
        if (value && this._icon != value) {
            this._icon = value;
            let iconDiv = this.btnToggle;
            loadIcon(value, function (iconData) {
                iconDiv.innerHTML = iconData;
                setIconAriaLabel(iconDiv, _('Toggle') + ' ' + _('Views'));
            });
        }
    }
    get icon () {
        return this._icon;
    }
    
    set oppositeX (value) {
        //this._oppositeX = value;
        if (this.btnSwitch && this.btnSwitch.controlClass)
            (this.btnSwitch.controlClass as MenuButton).oppositeX = value;

    }
    
}
registerClass(MenuToggleButton);
