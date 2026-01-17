/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

requirejs("controls/gridview");
requirejs("controls/trackListView");

// ColumnGridView --------------------------------------------
class ColumnGridView extends GridView {

    initialize(rootelem, params) {
        super.initialize(rootelem, params);
        this.showHeader = false;
        this.enableDragNDrop();
        this.defaultColumns = new Array();
        this.defaultColumns.push({
            order: 1,
            headerRenderer: GridView.prototype.headerRenderers.renderCheck,
            setupCell: GridView.prototype.cellSetups.setupCheckbox,
            bindData: GridView.prototype.defaultBinds.bindCheckboxCell
        });
        this.defaultColumns.push({
            order: 2,
            bindData: function (div, item, index) {
                div.innerText = (index + 1) + '.';
            }
        });
        this.defaultColumns.push({
            order: 3,
            bindData: function (div, item, index) {
                if (div.parentListView && div.parentListView.dataSource) {
                    let it = div.parentListView.dataSource.getValue(index);
                    let obj = JSON.parse(it);
                    div.innerText = obj.title;
                }
            }
        });
        this.setColumns(this.defaultColumns);
    }
}
registerClass(ColumnGridView);

function init(params) {
    title = params.title || '';    
    document.body.setAttribute('data-help', params.helpContext);
    let UI = getAllUIElements();

    if (params.listLabel !== undefined) {
        UI.listLabel.textContent = params.listLabel;
    }
    let ds = newStringList();
    if (params.allColumns) {
        let allColumns = [];
        for (let i = 0; i < params.allColumns.length; i++) {
            let col = params.allColumns[i];
            if (!resolveToValue(col.disabled, false)) {
                let obj = {
                    title: resolveToValue(col.title, ''),
                    columnType: col.columnType,
                    checked: col.visible,
                    origIndex: i
                };
                allColumns.push(obj);
            }
        }

        ds.modifyAsync(function () {
            for (let i = 0; i < allColumns.length; i++) {
                let idx = ds.add(JSON.stringify(allColumns[i]));
                ds.setChecked(idx, allColumns[i].checked);
            }
        });
    }
    UI.gvColumnList.controlClass.dataSource = ds;

    window.localListen(qid('btnOK'), 'click', function () {
        // get checked
        modalResult = 1;
    });

    window.getColumnList = function () {
        let res = new Array();
        ds.locked(function () {
            for (let i = 0; i < ds.count; i++) {
                let value = ds.getValue(i);
                let col = JSON.parse(value);
                col.visible = ds.isChecked(i);
                res.push(col);
            }
        });
        return JSON.stringify(res);
    }
}