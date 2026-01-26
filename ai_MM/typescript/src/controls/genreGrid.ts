'use strict';

registerFileImport('controls/genreGrid');

/**
@module UI
*/

import MediaItemGrid from './mediaItemGrid';
import './statusbar';

/**
UI GenreGrid element

@class GenreGrid
@constructor
@extends MediaItemGrid
*/

export default class GenreGrid extends MediaItemGrid {

    initialize(rootelem, params) {
        super.initialize(rootelem, params);
        this.popupSupport = true;
        this.isHorizontal = false;
        this.isGrouped = false; // grouping does not work well for vertical LVs, there is sometimes problem in item placing, they do not stretch after adding group legend        
        this.helpContext = 'Filelisting';
    }

    setUpDiv(div) {
        templates.imageItem(div, {
            imgBind: 'func: templates.itemImageFunc(div, item, div.itemIndex);',
            noThumbIcon: 'genre',
            selectButton: true,
            line1Bind: 'func: if (item.name === \'\') el.textContent = _(\'Unknown\'); else el.textContent = item.name;',
        });
    }

    renderPopup(div, item, scrollToView) {
        let LV = div.parentListView;
        return templates.popupRenderers.genre(LV, div, item, scrollToView);
    }

}
registerClass(GenreGrid);