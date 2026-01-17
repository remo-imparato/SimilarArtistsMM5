/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

/**
@module UI
*/

requirejs('controls/listview');

/**
UI StringListView element - a control for showing a list of ordinary strings

@class StringListView
@constructor
@extends ListView
*/

class StringListView extends ListView {    

    setUpDiv(div) {
        var _this = this;

        var isPartOutOfListview = function (coldiv) {
            var totalPos = this.container.getBoundingClientRect();
            var divPos = coldiv.getBoundingClientRect();
            return ((divPos.left < totalPos.left) || (divPos.right > totalPos.right));
        }.bind(this);

        div.tooltipValueCallback = function (tipdiv, vis) {
            if (!vis || _this._cleanUpCalled) {
                return;
            }
            if ((this.clientWidth < this.scrollWidth) || (isPartOutOfListview(this))) {
                tipdiv.innerHTML = _this.onTooltip(this, this.innerHTML);
            } else
                tipdiv.innerText = '';
        }.bind(div);
    }

    bindData(div, index) {
        div.innerText = this.dataSource.getValue(index);
    }
    
    onTooltip(div, tip) {
        return tip;
    }
}
registerClass(StringListView);