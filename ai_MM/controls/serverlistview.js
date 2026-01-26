/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

registerFileImport('controls/seriesListView');
'use strict';
import Control from './control';
import ListView from './listview';
/**
UI element for presentation of available media servers on LAN

@class ServerListView
@constructor
@extends ListView
*/
class ServerListView extends ListView {
    initialize(elem, params) {
        super.initialize(elem, params);
        this.itemCloningAllowed = false;
        this.isSearchable = true;
        this._registerFocusChange();
    }
    _registerFocusChange() {
        let _this = this;
        this.localListen(this.container, 'focuschange', function () {
            _this.requestFrame(function () {
                let item = _this.dataSource.focusedItem;
                if (item) //@ts-ignore
                    _this.contextMenu = new Menu(nodeHandlers.mediaServer.menu({
                        dataSource: item
                    }));
            }, 'itemContextMenu');
        });
    }
    setUpDiv(div) {
        div.classList.add('gridViewSmallHeight');
        div.innerHTML =
            '<div class="flex fill row paddingLeft">' +
                '  <div class="imageItem smallItem flex">' +
                '    <div class="flex dynamic center">' +
                '      <img data-id="artwork" data-bind="func: templates.itemImageFunc(div, item, div.itemIndex, {imagePath: item.iconUrl});" class="centerStretchImage gridViewSmallMaxHeight">' +
                '      <div data-id="unknownAA" class="fill largeIconColor" data-icon="server"></div>' +
                '    </div>' +
                '  </div>' +
                '  <div class="flex fill column center rowHeight2LineEx paddingLeft paddingRight">' +
                '     <div class="flex row verticalCenter">' +
                '       <label data-bind="func: el.textContent = item.name" class="inline textEllipsis noLeftPadding sectionHeader"></label>' +
                '       <div data-id="btnMenuPopup" class="inline noPadding" data-control-class="MenuButton" data-icon="menu" data-tip="Menu"></div>' +
                '     </div>' +
                '     <div>' +
                '         <span data-bind="func: el.textContent = item.modelName+\' \'+item.modelNumber+\' (\'+item.manufacturer+\')\'"></span>' +
                '     </div>' +
                /* // LS: commented out, it is useful probably just for debug purposes
                            '     <div>' +
                            '         <span data-bind="func: el.textContent = item.modelDescription" class="textOther"></span>' +
                            '     </div>' +
                            '     <div class="textEllipsis">' +
                            '         <span data-bind="func: el.textContent = _(\'Device description URL\')+\':  \'"></span>' +
                            '         <span data-id="link" data-bind="func: el.textContent = item.descriptionUrl" class="textOther clickable"></span>' +
                            '     </div>' +
                */
                '  </div>' +
                '</div>';
        initializeControls(div);
        div.unlisteners = div.unlisteners || [];
        div.artwork = qe(div, '[data-id=artwork]');
        div.noaa = qe(div, '[data-id=unknownAA]');
        div.controlClass = div.controlClass || new Control(div); // to allow correct cleaning
        div.controlClass.addCleanFunc(function () {
            div.artwork = undefined;
            div.noaa = undefined;
        });
        setVisibility(div.artwork, false);
        /*
                div.link = qe(div, '[data-id=link]');
                app.listen(div.link, 'click', function (e) {
                    if (div.itemIndex === undefined)
                        return;
                    e.stopPropagation();
                    var itm = div.parentListView.getItem(div.itemIndex);
                    window.uitools.openWeb(itm.descriptionUrl);
                });
        
                app.listen(div.link, 'mousedown', function (e) {
                    e.stopPropagation();
                });
                div.unlisteners.push(function () {
                    app.unlisten(div.link);
                });
        */
        let btnMenu = qeid(div, 'btnMenuPopup');
        //@ts-ignore
        let ar = nodeHandlers.mediaServer.menu({});
        for (let itm of ar)
            itm.action.boundObject = function () {
                return div.parentListView.getItem(div.itemIndex);
            };
        btnMenu.controlClass.menuArray = ar;
    }
}
registerClass(ServerListView);
