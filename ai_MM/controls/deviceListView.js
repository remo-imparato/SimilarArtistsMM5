/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

registerFileImport('controls/deviceListView');
'use strict';
/**
@module UI
*/
import ListView from './listview';
/**
UI element for presentation of available devices/storages to sync

@class DeviceListView
@constructor
@extends ListView
*/
export default class DeviceListView extends ListView {
    initialize(rootelem, params) {
        super.initialize(rootelem, params);
        // this.isGrid = true;       
        this.showHeader = false;
        this.isSearchable = true;
        this.itemCloningAllowed = false;
        this.useFastBinding = false; // #16284
        this._registerEvents();
    }
    _registerEvents() {
        let _this = this;
        this.localListen(this.container, 'focuschange', function () {
            _this.requestFrame(function () {
                let item = _this.dataSource.focusedItem;
                if (item) {
                    // @ts-ignore
                    _this.contextMenu = new Menu(nodeHandlers.device.menu({
                        dataSource: item,
                        handlerID: 'device'
                    }));
                }
            }, 'itemContextMenu');
        });
    }
    bindData(div, index, item) {
        if (this.bindFn)
            this.bindFn(div, item);
        let icon = mediaSyncDevices.getIcon(item);
        if (icon != div._loadedIcon) {
            cleanBasicElement(div.iconDiv);
            loadIcon(icon, function (iconData) {
                div._loadedIcon = icon;
                div.iconDiv.innerHTML = iconData;
            });
        }
        else if (!icon && div.cloned)
            cleanBasicElement(div.iconDiv);
        div.titleDiv.textContent = item.name;
        if (!item.enabled)
            div.titleDiv.setAttribute('data-disabled', '1');
        else
            div.titleDiv.removeAttribute('data-disabled');
        div.descDiv.textContent = mediaSyncDevices.getStatus(item);
        // @ts-ignore
        div.btnMenu.controlClass.menuArray = nodeHandlers.device.menu({
            dataSource: item
        });
    }
    setUpDiv(div) {
        div.classList.add('gridViewSmallHeight');
        div.innerHTML =
            '<div class="flex fill row paddingLeft">' +
                '  <div class="imageItem smallItem flex">' +
                '    <div class="flex dynamic center">' +
                '      <img data-id="artwork" data-bind="func: templates.itemImageFunc(div, item, div.itemIndex);" class="centerStretchImage gridViewSmallMaxHeight">' +
                '      <div data-id="iconDiv" class="fill largeIconColor"></div>' +
                '    </div>' +
                '  </div>' +
                '  <div class="flex fill column center rowHeight2LineEx paddingLeft paddingRight">' +
                '     <div class="flex row verticalCenter">' +
                '       <label data-id="titleDiv" class="inline textEllipsis noLeftPadding sectionHeader"></label>' +
                '       <div data-id="btnMenuPopup" class="inline noPadding" data-control-class="MenuButton" data-icon="menu" data-tip="Menu"></div>' +
                '     </div>' +
                '     <div>' +
                '         <span data-id="descDiv"></span>' +
                '     </div>' +
                '  </div>' +
                '</div>';
        initializeControls(div);
        div.iconDiv = qeid(div, 'iconDiv');
        div.noaa = div.iconDiv;
        div.artwork = qeid(div, 'artwork');
        div.titleDiv = qeid(div, 'titleDiv');
        div.descDiv = qeid(div, 'descDiv');
        div.btnMenu = qeid(div, 'btnMenuPopup');
    }
}
registerClass(DeviceListView);
