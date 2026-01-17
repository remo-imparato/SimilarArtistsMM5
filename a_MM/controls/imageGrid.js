/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

'use strict';
registerFileImport('controls/imageGrid');
import ListView from './listview';
import './statusbar';
/**
@module UI
*/
/**
UI ImageGrid element

@class ImageGrid
@constructor
@extends ListView
*/
export default class ImageGrid extends ListView {
    initialize(rootelem, params) {
        super.initialize(rootelem, params);
        this.enableDragNDrop();
        this.isGrid = true;
        this.editSupported = true;
        this.isHorizontal = true;
        this.showHeader = false;
        this.isSearchable = true;
        this.itemCloningAllowed = false;
        this.hasMediaContent = true;
        if (params && params.icon)
            this.noThumbIcon = params.icon;
        else
            this.noThumbIcon = 'unknownAA';
        this.addArtworkRules = {
            showApply2Album: false
        };
        this.localListen(this.container, 'contextmenu', (e) => {
            this.addArtworkRules.track = null;
            this.addArtworkRules.firstTrack = null;
            this.addArtworkRules.album = null;
            if (this.dataSource) {
                let item = this.dataSource.focusedItem;
                if (item) {
                    if (item.objectType === 'track') {
                        this.addArtworkRules.track = item;
                        this.addArtworkRules.firstTrack = item;
                    }
                    else if (item.objectType === 'album') {
                        this.addArtworkRules.album = item;
                    }
                }
            }
        }, true);
        uitools.enableTitleChangeNotification(this);
    }
    setUpDiv(div) {
        let temp;
        if (this.imageTemplate)
            temp = templates.imageItemsParams[this.imageTemplate];
        else
            temp = templates.imageItemsParams['standardItem'];
        if (!temp.noThumbIcon)
            temp.noThumbIcon = this.noThumbIcon;
        templates.imageItem(div, temp);
    }
    canDrop(e) {
        return false;
    }
    formatStatus(data) {
        let view = this.parentView;
        let handlerID = 'albums';
        if (view) {
            handlerID = view.viewNode.handlerID;
            let handler = nodeHandlers[handlerID];
            if (handler.formatStatus)
                return handler.formatStatus(data);
        }
        return statusbarFormatters.formatAlbumListStatus(data, handlerID);
    }
}
registerClass(ImageGrid);
