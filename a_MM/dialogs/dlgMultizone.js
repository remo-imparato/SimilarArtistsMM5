/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

requirejs("controls/gridview");

function init(params) {
    let wnd = this;
    wnd.resizeable = true;
    wnd.title = _('Configure multi-zone playback');

    maskSet = params.maskSet;
    config = params.config;


    let LV = qid('lvFieldsList');
    LV.controlClass.showHeader = false;
    LV.controlClass.isSortable = false;
    LV.controlClass.multiselect = false;

    let columns = new Array();
    columns.push({
        order: 1,
        headerRenderer: GridView.prototype.headerRenderers.renderCheck,
        setupCell: GridView.prototype.cellSetups.setupCheckbox,
        bindData: GridView.prototype.defaultBinds.bindCheckboxCell
    });
    columns.push({
        order: 2,
        bindData: function (div, item, index) {
            div.innerText = item.name;
        }
    });
    LV.controlClass.setColumns(columns);
    LV.controlClass.dataSource = app.sharing.getMultiZonePlayers();

    window.localListen(qid('btnOK'), 'click', function () {
        saveCurrentState();
        modalResult = 1;
        closeWindow();
    });
};

function saveCurrentState() {
    let players = qid('lvFieldsList').controlClass.dataSource;
    players.locked(function () {
        for (let i = 0; i < players.count; i++) {
            let pl = players.getValue(i);
            app.sharing.setMultiZoneUUID(pl.uuid, players.isChecked(i));
        }
    });
}
