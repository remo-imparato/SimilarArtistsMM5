registerFileImport('controls/fileTypeTree');

import GridView from './gridview';

/**
UI file type tree element.

@class FileTypeTree
@constructor
@extends GridView
*/

export default class FileTypeTree extends GridView {
    defaultColumns: any[];

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