registerFileImport('controls/icon');

'use strict';

/**
@module UI
*/

import Control from './control';

/**
Base class for a generic icon div.

@class Icon
@constructor
@extends Control
*/
class Icon extends Control {
    private _icon: string;

    initialize(elem: HTMLDivElement, params: AnyDict) {
        super.initialize(elem, params);

        if (!params || !params.custom)
            this.container.classList.add('icon');

        if (params && params.icon)
            this.icon = params.icon;
    }

    reload() {
        if (this.icon) {
            let ic = this.icon;
            this.icon = '';
            this.icon = ic;
        }
    }
    
    set icon (value: string) {
        if (this._icon != value) {
            this._icon = value;
            if (value) {
                let iconDiv = this.container;
                loadIconFast(value, function (icon) {
                    setIconFast(iconDiv, icon);
                });
            }
        }
    }
    get icon () : string {
        return this._icon;
    }
    
}
registerClass(Icon);
