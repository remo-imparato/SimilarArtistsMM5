/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

optionPanels.pnl_Library.subPanels.pnl_MediaServers.load = function (sett) {
    let edtUPnPDir = qid('edtUPnPDir');
    edtUPnPDir.controlClass.value = sett.MediaSharing.UPNP_CacheDir;
    localListen(qid('btnUPnPDir'), 'click', function () {
        window.uitools.showSelectFolderDlg(edtUPnPDir.controlClass.value).then(function (path) {
            if (path != '') {
                edtUPnPDir.controlClass.value = path;
            }
        });
    });
    addEnterAsClick(window, qid('btnUPnPDir'));

    qid('chbUPnPCacheSize').controlClass.checked = sett.MediaSharing.LimitConvertedContent;
    qid('edtUPnPCacheSize').controlClass.value = sett.MediaSharing.LimitConvertedContentSize;
    bindDisabled2Checkbox(qid('edtUPnPCacheSize'), qid('chbUPnPCacheSize'));
    bindDisabled2Checkbox(qid('lblUPnPCacheSize'), qid('chbUPnPCacheSize'));

    qid('chbFirewall').controlClass.checked = sett.MediaSharing.AddFirewallException;

    let LV = qid('lvMediaServerListView');
    LV.controlClass.showHeader = true;
    LV.controlClass.isSortable = false;
    LV.controlClass.multiselect = false;

    let columns = new Array();
    columns.push({
        order: 0,
        width: 80,
        title: _('Enabled'),
        setupCell: GridView.prototype.cellSetups.setupCheckbox,
        bindData: GridView.prototype.defaultBinds.bindCheckboxCell
    });
    columns.push({
        order: 1,
        width: 300,
        title: _('Server name'),
        bindData: function (div, item, index) {
            div.innerText = item.name;
        }
    });
    columns.push({
        order: 2,
        width: 150,
        title: _('IP'),
        bindData: function (div, item, index) {
            if (item.running)
                div.innerText = item.runningIP + ':' + item.port;
            else
            if (item.ip != '')
                div.innerText = item.ip;
            else
                div.innerText = _('Automatic') + ':' + item.port;
            if (app.tests)
                div.innerText = '192.168.unit.test:4000'; // so that screen tests are user independent
        }
    });
    columns.push({
        order: 2,
        width: 100,
        title: _('Status'),
        bindData: function (div, item, index) {
            if (item.running)
                div.innerText = _('Running');
            else
                div.innerText = _('Stopped');
        }
    });
    LV.controlClass.setColumns(columns);

    let serverList = app.sharing.getServers();
    LV.controlClass.dataSource = serverList;
    let openServerConfig = function (server) {
        let dialog = uitools.openDialog('dlgServerConfig', {
            modal: true,
            server: server
        });
        let closed = function () {
            app.unlisten(dialog, 'closed', closed);
            serverList.notifyChanged();
        };
        app.listen(dialog, 'closed', closed);
    }
    let handleButtonsDisableState = function () {
        let noItemFocused = (LV.controlClass.focusedIndex < 0);
        qid('btnRemoveServer').controlClass.disabled = noItemFocused;
        qid('btnConfServer').controlClass.disabled = noItemFocused;
    }
    LV.controlClass.localListen(LV, 'focuschange', handleButtonsDisableState);
    handleButtonsDisableState();
    LV.controlClass.localListen(LV, 'itemdblclick', function (e) {
        openServerConfig(e.detail.item);
    });
    LV.controlClass.localListen(LV, 'itementer', function (e) {
        openServerConfig(e.detail.item);
    });
    localListen(qid('btnAddServer'), 'click', function () {
        let server = app.sharing.createNewServer();
        if (server)
            openServerConfig(server);
    });
    addEnterAsClick(window, qid('btnAddServer'));
    localListen(qid('btnConfServer'), 'click', function () {
        let server = serverList.focusedItem;
        if (server)
            openServerConfig(server);
    });
    addEnterAsClick(window, qid('btnConfServer'));
    localListen(qid('btnRemoveServer'), 'click', function () {
        let server = serverList.focusedItem;
        if (server) {
            serverList.removeAsync(server);
            server.removeAsync();
        }
    });
    addEnterAsClick(window, qid('btnRemoveServer'));

    let serviceIsInstalled = false;
    let btnService = qid('btnInstallService');
    let updateButtonText = function () {
        if (!serviceIsInstalled)
            btnService.controlClass.textContent = _('Install as service') + '...';
        else
            btnService.controlClass.textContent = _('Uninstall service') + '...';
    }
    setVisibility(btnService, false);
    if (!app.utils.getPortableMode()) { // #16142
        app.sharing.getServieIsInstalled().then(function (res) {
            if (window._cleanUpCalled)
                return;
            setVisibility(btnService, true);
            serviceIsInstalled = res;
            updateButtonText();
        });
    }

    localListen(btnService, 'click', function () {
        if (serviceIsInstalled)
            app.sharing.uninstallService().then(function () {
                if (window._cleanUpCalled)
                    return;
                serviceIsInstalled = false;
                updateButtonText();
            });
        else {
            let username = app.utils.getUserName();
            let dlg = uitools.openDialog('dlgInputText', {
                modal: true,
                title: _('Install Service'),
                description: sprintf(_('Installing MediaMonkey as service allows you to browse media server even if MediaMonkey is not running and you are not logged into your account. Please input your account (%s) password:'), username),
                type: 'password'
            });
            dlg.whenClosed = function () {
                if (dlg.modalResult === 1) {
                    let pass = dlg.getValue('getTextInput')();
                    app.sharing.installService(username, pass).then(function () {
                        if (window._cleanUpCalled)
                            return;
                        serviceIsInstalled = true;
                        updateButtonText();
                    });
                }
            };
            app.listen(dlg, 'closed', dlg.whenClosed);
        }
    });
    addEnterAsClick(window, btnService);
}

optionPanels.pnl_Library.subPanels.pnl_MediaServers.save = function (sett) {

    let serverList = app.sharing.getServers();
    serverList.commitAsync(); // to store check states
    
    if (sett.MediaSharing.AddFirewallException != qid('chbFirewall').controlClass.checked) {
        sett.MediaSharing.AddFirewallException = qid('chbFirewall').controlClass.checked;
        app.sharing.addFirewallException(sett.MediaSharing.AddFirewallException);
    }

    sett.MediaSharing.UPNP_CacheDir = qid('edtUPnPDir').controlClass.value;
    sett.MediaSharing.LimitConvertedContent = qid('chbUPnPCacheSize').controlClass.checked;
    sett.MediaSharing.LimitConvertedContentSize = qid('edtUPnPCacheSize').controlClass.value;
}
