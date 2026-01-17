/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

import '../commonControls';

window.init = function(params) {

    resizeable = true;
    title = _('Accompanying files');    

    qid('lvMoveList').controlClass.dataSource = pairs;

    window.localListen(qid('btnMove'), 'click', function () {
        qid('btnMove').controlClass.disabled = true;
        let res = {
            btnID: 'btnOK'
        };
        setResult(res);
        closeWindow();
    });

    showModal();
}

// myMoveListView --------------------------------------------
class MyMoveListView extends ColumnTrackList {
    initialize(rootelem, params) {
        super.initialize(rootelem, params);

        this.showHeader = true;

        this.defaultColumns = new Array();
        this.defaultColumns.push({
            visible: true,
            title: '',
            width: 20,
            order: 1,
            headerRenderer: ColumnTrackList.prototype.headerRenderers.renderCheck,
            setupCell: ColumnTrackList.prototype.cellSetups.setupCheckbox,
            bindData: ColumnTrackList.prototype.defaultBinds.bindCheckboxCell
        });
        this.defaultColumns.push({
            visible: true,
            title: _('Old Path'),
            width: 280,
            order: 2,
            bindData: function (div, item) {
                div.innerText = item.srcPath;
            },
        });
        this.defaultColumns.push({
            visible: true,
            title: _('New Path'),
            width: 280,
            order: 3,
            bindData: function (div, item) {
                div.innerText = item.dstPath;
            },
        });
        this.setColumns(this.defaultColumns);
    }
}
registerClass(MyMoveListView);
