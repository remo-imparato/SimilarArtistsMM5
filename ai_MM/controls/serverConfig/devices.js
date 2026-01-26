/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

ServerConfig.prototype.tabs.devices.load = function () {
    var _this = this;
    this.qChild('chbUpdatePlayCounter').controlClass.checked = this.server.enablePlayCount;    
    this.qChild('chbScrobble').controlClass.checked = this.server.scrobble; 
    bindDisabled2Checkbox(this.qChild('chbScrobble'), this.qChild('chbUpdatePlayCounter'));   
    this.qChild('chbAutoShare').controlClass.checked = this.server.autoShare;

    var list = this.server.getClientList();
    this.clientList = list;
    var LV = this.qChild('lvRemoteDevicesListView');
    LV.controlClass.showHeader = true;
    LV.controlClass.isSortable = false;
    LV.controlClass.multiselect = false;

    var columns = new Array();
    columns.push({
        order: 0,
        width: 80,
        title: _('Enabled'),
        setupCell: GridView.prototype.cellSetups.setupCheckbox,
        bindData: GridView.prototype.defaultBinds.bindCheckboxCell
    });
    columns.push({
        order: 1,
        width: 150,
        title: _('MAC address'),
        bindData: function (div, item, index) {
            div.innerText = item.mac;
        }
    });
    columns.push({
        order: 2,
        width: 150,
        title: _('IP address'),
        bindData: function (div, item, index) {
            div.innerText = item.ip;
        }
    });
    columns.push({
        order: 3,
        width: 300,
        title: _('Name'),
        bindData: function (div, item, index) {
            div.innerText = item.name;
        },
        getValue: function (item) {
            return item.name;
        },
        setValue: function (item, newValue) {
            item.name = newValue;
            item.commitAsync();
            return true;
        },
        editor: editors.gridViewEditors.textEdit,
    });
    columns.push({
        order: 4,
        width: 150,
        title: _('Last access'),
        bindData: function (div, item, index) {
            div.innerText = item.lastAccess;
        }
    });
    LV.controlClass.setColumns(columns);
    LV.controlClass.dataSource = list;
    var handleButtonsDisableState = function () {
        var noItemFocused = (LV.controlClass.focusedIndex < 0);
        _this.qChild('btnRemoveDevice').controlClass.disabled = noItemFocused;
        _this.qChild('btnConfDevice').controlClass.disabled = noItemFocused;
    }
    this.localListen(LV, 'focuschange', handleButtonsDisableState);
    handleButtonsDisableState();
    this.localListen(this.qChild('btnRemoveDevice'), 'click', function () {
        var client = list.focusedItem;
        if (client) {
            list.removeAsync(client);
            client.removeAsync();
        }
    });
    addEnterAsClick(this, this.qChild('btnRemoveDevice'));

    var openConfig = function (itm) {
        if (itm)
            uitools.openDialog('dlgClientConfig', {
                modal: true,
                client: itm
            });
    }
    this.localListen(LV, 'itemdblclick', function (e) {
        openConfig(e.detail.item);
    });
    this.localListen(LV, 'itementer', function (e) {
        openConfig(e.detail.item);
    });
    this.localListen(this.qChild('btnConfDevice'), 'click', function () {
        openConfig(list.focusedItem);
    });
    addEnterAsClick(this, this.qChild('btnConfDevice'));
};

ServerConfig.prototype.tabs.devices.save = function () {
    this.server.enablePlayCount = this.qChild('chbUpdatePlayCounter').controlClass.checked;
    this.server.scrobble = this.qChild('chbScrobble').controlClass.checked;
    this.server.autoShare = this.qChild('chbAutoShare').controlClass.checked;
    this.clientList.commitAsync(); // to store check states
};
