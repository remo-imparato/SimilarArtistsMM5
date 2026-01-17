/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

'use strict';
/**
@module UI
*/
import ListView from './listview';
/**
UI element for presentation of unplayed and downloaded episodes

@class NewEpisodesView
@constructor
@extends ListView
*/
class NewEpisodesView extends ListView {
    initialize(elem, params) {
        super.initialize(elem, params);
        this.popupSupport = true;
        this.isGrid = true;
        this.isSearchable = true;
    }
    renderPopup(div, item, scrollToView) {
        let LV = div.parentListView;
        return templates.popupRenderers.unplayedPodcast(LV, div, item, scrollToView);
    }
    setUpDiv(div) {
        templates.imageItem(div, {
            imgBind: 'func: templates.itemImageFunc(div, item, div.itemIndex);',
            noThumbIcon: 'podcast',
            line1Bind: 'func: el.textContent = item.title',
            line2Bind: 'func: el.textContent = _(\'Episodes\') + \': \' + item.getEpisodesCount(\'unplayed\')+\'/\'+item.getEpisodesCount(\'downloaded\');',
        });
    }
}
registerClass(NewEpisodesView);
