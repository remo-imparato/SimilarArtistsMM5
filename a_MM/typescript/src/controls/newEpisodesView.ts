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