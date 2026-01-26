registerFileImport('controls/sourceIconListView');

'use strict';

import ListView from './listview';

/**
@module UI
*/


/**
UI SourceIconListView element - a control for showing a list of source icons

@class SourceIconListView
@constructor
@extends ListView
*/

class SourceIconListView extends ListView {
    datatips: AnyDict;

    initialize(elem, params) {
        super.initialize(elem, params);
        this.itemCloningAllowed = false;
        this.datatips = {};
    }

    setUpDiv(div) {
        div.icon = document.createElement('div');
        div.icon.classList.add('allinside');
        div.icon.classList.add('autosize');
        div.appendChild(div.icon);
    }

    bindData(div, index) {
        let val = this.dataSource.getValue(index);
        let ival = parseInt(val);
        if (!isNaN(ival)) {
            let icons = ['drive']; // local HDD
            if (ival === _utils.CACHE_DOWNLOADED)
                icons = ['download', 'cloud']; // downloaded from cloud
            if (ival === _utils.CACHE_STREAMED)
                icons = ['link', 'cloud']; // available to stream from cloud
            if (ival === _utils.CACHE_LINKED)
                icons = ['drive', 'cloud'];

            templates.itemDoubleIconFunc(div, undefined, icons[0], icons[1]);

            // TODO: introduce the tooltips based on wording to be suggested by Rusty in #15023
            let icon = icons[0];
            if (!this.datatips[icon])
                this.datatips[icon] = _(icon);
            div.setAttribute('data-tip', this.datatips[icon]);

        } else {
            div.removeAttribute('data-tip');
            div.icon.innerText = val;
        }
    }
}
registerClass(SourceIconListView);
