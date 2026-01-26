/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

'use strict';
registerFileImport('controls/mediaItemGrid');
/**
@module UI
*/
import ImageGrid from './imageGrid';
import './statusbar';
import './trackListView';
/**
UI MediaItemGrid element

@class MediaItemGrid
@constructor
@extends ImageGrid
*/
export default class MediaItemGrid extends ImageGrid {
    initialize(rootelem, params) {
        super.initialize(rootelem, params);
        this.contextMenu = menus.createTracklistMenu(this.container);
        //uitools.enableTitleChangeNotification(this); // this is already registered in the descendant (see ImageGrid.initialize)
        this.helpContext = 'Filelisting';
    }
    canDeleteSelected() {
        return true;
    }
    deleteSelected() {
        let itemlist = this.dataSource.getSelectedList();
        let tracklist = this.dataSource.getSelectedTracklist();
        let _this = this;
        whenAll([itemlist.whenLoaded(), tracklist.whenLoaded()]).then(function () {
            window.uitools.deleteTracklist(tracklist).then(function (removed) {
                if (removed && _this.dataSource)
                    itemlist.locked(function () {
                        let itm;
                        for (let i = 0; i < itemlist.count; i++) {
                            itm = itemlist.getFastObject(i, itm);
                            itm.deleted = true;
                            _this.dataSource.remove(itm);
                        }
                    });
            });
        });
    }
    editStart() {
        let item = this.focusedItem;
        if (item) {
            requirejs('controls/editors');
            let div = this.getDiv(this.focusedIndex);
            if (!div)
                return;
            let cellDiv = div;
            let textPart = qe(div, '[data-id=firstLine]');
            if (!textPart)
                textPart = qe(div, '[data-id=firstLineText]');
            if (textPart)
                cellDiv = textPart;
            this.inEdit = {
                listview: this,
                editor: editors.gridViewEditors.textEdit,
                div: div,
                item: item,
                cellDiv: cellDiv,
                getValue: function (item) {
                    return resolveToValue(item.name);
                },
                setValue: function (item, value) {
                    item.name = value;
                    item.commitAsync();
                    return true; // to not save (already saved by calling commitAsync above)
                },
            };
            this.inEdit.editor('edit', this.inEdit.cellDiv, this.inEdit.item);
        }
    }
    editSave() {
        if (this.inEdit) {
            this.inEdit.editor('save', this.inEdit.cellDiv, this.inEdit.item);
            this.inEdit.div.itemIndex = undefined; // force rebind 
            this.draw();
            this.inEdit = undefined;
        }
    }
    editCancel() {
        if (this.inEdit) {
            this.inEdit.editor('cancel', this.inEdit.cellDiv, this.inEdit.item);
            this.inEdit = undefined;
        }
    }
}
registerClass(MediaItemGrid);
