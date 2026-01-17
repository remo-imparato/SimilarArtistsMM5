/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

registerFileImport('controls/feedListView');
/**
@module UI
*/
import ListView from './listview';
import './statusbar';
/**
UI Podcast feed list element (unsubscribed podcasts in a podcast directory)

@class FeedListView
@constructor
@extends ListView
*/
export default class FeedListView extends ListView {
    initialize(rootelem, params) {
        super.initialize(rootelem, params);
        this.multiselect = false;
        this.isSearchable = true;
        this.popupSupport = true;
        // LS: Context menu disabled because of #13751 - item 1
        //        this.contextMenu = new Menu([
        //            {
        //                title: 'Subscribe',
        //                icon: 'rss',
        //                execute: function () {
        //                    var item = this.getItem(this.focusedIndex);
        //                    uitools.subscribePodcast(item);
        //                }.bind(this)
        //            }]);
    }
    setUpDiv(div) {
        if (!div.cloned) {
            div.style.height = fontSizePx() * 4;
            div.innerHTML = '<div class="flex row">' +
                '  <div class="flex column">' +
                '    <div class="iconLarger" data-icon="rss"></div>' +
                '  </div>' +
                '  <div class="flex column fill">' +
                '    <label data-bind="func: el.textContent = item.title"></label>' +
                '    <label data-bind="func: el.textContent = item.podcastURL" class="smallText textEllipsis textOther"></label>' +
                '  </div>' +
                '</div>';
        }
        initializeControls(div);
        div.unlisteners = div.unlisteners || [];
    }
    renderPopup(div, item, scrollToView) {
        let LV = div.parentListView;
        return templates.popupRenderers.feed(LV, div, item, scrollToView);
    }
    formatStatus(data) {
        return statusbarFormatters.formatDefaultSimpleStatus(data, function (cnt) {
            return _('feed', 'feeds', cnt);
        });
    }
    filterSource(phrase) {
        let view = this.parentView;
        if (view && view.viewNode.dataSource) {
            let dir = view.viewNode.dataSource;
            if (dir.isIndexDirectory) {
                if (dir.searchString != phrase) {
                    dir.searchString = phrase;
                    uitools.refreshView();
                    this.requestTimeout(() => {
                        // LS: following is just a hack, to be found why it fails to draw when feed count == 1
                        if (this.dataSource.count == 1)
                            this.deferredDraw();
                    }, 500);
                }
            }
            else {
                super.filterSource(phrase);
            }
        }
        else {
            super.filterSource(phrase);
        }
    }
}
registerClass(FeedListView);
