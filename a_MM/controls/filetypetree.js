/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

registerFileImport('controls/fileTypeTree');
import GridView from './gridview';
/**
UI file type tree element.

@class FileTypeTree
@constructor
@extends GridView
*/
export default class FileTypeTree extends GridView {
    initialize(rootelem, params) {
        super.initialize(rootelem, params);
        let _this = this;
        this.checkboxes = true;
        this.showHeader = true;
        this.defaultColumns = [];
        this.defaultColumns.push({
            title: '',
            disabled: false,
            headerRenderer: GridView.prototype.headerRenderers.renderCheck,
            setupCell: GridView.prototype.cellSetups.setupCheckbox,
            bindData: GridView.prototype.defaultBinds.bindCheckboxCell,
            width: 20,
        });
        this.defaultColumns.push({
            title: function () {
                return _this.getTitle();
            },
            disabled: false,
            bindData: function (div, item) {
                div.textContent = item.toString();
            },
        });
        this.setColumns(this.defaultColumns);
    }
    canDrop(e) {
        return false;
    }
    getTitle() {
        return _('Format');
    }
    setItemsChecked(itemCallback) {
        if (itemCallback && this.checkboxes) {
            let ds = this.dataSource;
            ds.modifyAsync(function () {
                for (let i = 0; i < ds.count; i++) {
                    ds.setChecked(i, itemCallback(ds.getValue(i)));
                }
                this.invalidateAll();
            }.bind(this));
        }
    }
}
registerClass(FileTypeTree);
