registerFileImport('controls/expandableLabel');

'use strict';

import Control from './control';

/**
Expandable label element.

@class ExpandableLabel
@constructor
@extends Control
*/

class ExpandableLabel extends Control {
    private _icon: string;
    label: HTMLElement;
    icon: HTMLDivElement;
    _expanded: boolean;

    initialize(parentel, params) {
        let labelText = parentel.innerHTML;
        parentel.innerHTML = '';

        super.initialize(parentel, params);

        let labelType = 'label';
        if(params && params.labelType) {
            labelType = params.labelType;
        }
        
        this._icon = 'downArrow';
        this.container.style.position = 'relative';
        
        this.label = document.createElement(labelType);
        this.label.setAttribute('data-id', 'lbl');
        this.label.classList.add('noMargin');
        this.label.innerText = labelText;
        this.container.appendChild(this.label);

        this.icon = document.createElement('div');
        this.icon.classList.add('noMargin');
        this.icon.setAttribute('data-id', 'icon');
        this.icon.setAttribute('data-icon', this._icon);
        this.container.appendChild(this.icon);

        this.container.classList.add('flex');
        this.container.classList.add('row');
        this.container.classList.add('verticalCenter');
        this.container.classList.add('clickable');
        this.container.classList.add('expandableButton');
        
        this._expanded = false;

        initializeControls(this.container);

        this.localListen(this.label, 'click', this._doToggle.bind(this));
        this.localListen(this.icon, 'click', this._doToggle.bind(this));
    }

    _sendChangeEvent() {
        let event = createNewCustomEvent('change', {
            detail: {
                expanded: this.expanded
            },
            bubbles: true,
            cancelable: true
        });
        this.container.dispatchEvent(event);
    }
    
    _doToggle() {
        this.expanded = !this.expanded;
    }
    
    set expanded (value) {
        if(this._expanded != value) {
            this._expanded = value;
            this._icon = value ? 'upArrow' : 'downArrow';
            let iconDiv = this.icon;
            loadIcon(this._icon, function (iconData) {
                iconDiv.innerHTML = iconData;
            });
            this._sendChangeEvent();
        }
    }
    get expanded () {
        return this._expanded;
    }
    

}
registerClass(ExpandableLabel);