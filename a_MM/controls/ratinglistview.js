/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

'use strict';
import ListView from './listview';
import Rating from './rating';
/**
@module UI
*/
/**
UI RatingListView element - a control for showing a list of ratings

@class RatingListView
@constructor
@extends ListView
*/
export default class RatingListView extends ListView {
    setUpDiv(div) {
        div.controlClass = new Rating(div, {
            useUnknown: true,
            readOnly: true,
            position: 'left',
            starWidth: '1.2em'
        });
        div.tooltipValueCallback = function (tipdiv, vis) {
            if (!vis) {
                return;
            }
            if (this.controlClass && this.controlClass.canvas && (this.clientWidth < this.controlClass.canvas.clientWidth)) {
                tipdiv.innerHTML = Rating.getHTML({
                    starWidth: '1.2em',
                    readOnlyPadding: 'none',
                    readOnly: true,
                    useUnknown: true,
                    value: div.controlClass.value
                });
            }
            else
                tipdiv.innerText = '';
        }.bind(div);
    }
    bindData(div, index) {
        let val = this.dataSource.getValue(index);
        let ival = parseInt(val);
        if (!isNaN(ival)) {
            if (!div.controlClass)
                div.controlClass = new Rating(div, {
                    useUnknown: true,
                    readOnly: true,
                    position: 'left',
                    starWidth: '1.2em'
                });
            div.controlClass.value = ival;
        }
        else {
            div.controlClass = undefined;
            div.innerText = val;
        }
    }
}
registerClass(RatingListView);
