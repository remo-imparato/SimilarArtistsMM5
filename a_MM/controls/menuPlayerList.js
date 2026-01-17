/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

'use strict';
/**
@module UI
*/
import ListView from './listview';
/**
UI element to represent menu items as list view

@class MenuPlayerList
@constructor
@extends ListView
*/
class MenuPlayerList extends ListView {
    initialize(rootelem, params) {
        super.initialize(rootelem, params);
        this.isGrid = true;
        this.canBeUsedAsSource = false;
        this.localListen(this.container, 'itemclick', function (e) {
            if (e.detail.item && e.detail.item.action) {
                if (e.detail.item.action.execute)
                    e.detail.item.action.execute();
                else {
                    if (e.detail.item.action.submenu) {
                        let menu = new Menu(e.detail.item.action.submenu, {
                            parentMenuAction: e.detail.item.action,
                            rootMenuAction: e.detail.item.action,
                            //parent: e.detail.div
                        });
                        let pos = findScreenPos(e.detail.div);
                        menu.show(pos.left, pos.top, false, true);
                    }
                }
            }
        });
    }
    cleanUp() {
        super.cleanUp();
    }
    notifyControlFocus() {
        // do not notify about focus of this LV
    }
    setUpDiv(div) {
        div.classList.add('smallItem');
        div.classList.add('verySmallItem');
        templates.imageItem(div, {
            imgBind: 'func: templates.nodeIconFunc(div, item.action);',
            line1Bind: 'func: var title = resolveToValue(item.action.title, \'\'); if (isFunction(title.replace)) el.textContent = title.replace(\'&\', \'\'); else el.textContent = title;',
        });
    }
}
registerClass(MenuPlayerList);
