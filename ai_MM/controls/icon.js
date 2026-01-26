/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

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
    initialize(elem, params) {
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
    set icon(value) {
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
    get icon() {
        return this._icon;
    }
}
registerClass(Icon);
