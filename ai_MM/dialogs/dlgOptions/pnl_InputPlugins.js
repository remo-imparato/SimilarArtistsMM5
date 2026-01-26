/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

optionPanels.pnl_Player.subPanels.pnl_InputPlugins.load = function (sett) {
    let LV = qid('lvInputPluginsList');
    LV.controlClass.showHeader = true;
    LV.controlClass.isSortable = false;
    LV.controlClass.multiselect = false;
    LV.controlClass.disabledClearingSelection = true;

    let legend = _('The MediaMonkey Player supports Input plug-ins that are compatible with Winamp 2. They generally add support for new audio formats.') + '\n\n' +

        _('To install a plug-in you\'ll have to follow either of the following procedures:') + '\n\n' +

        _('1) If the plug-in is provided with an installer, the installer often chooses a default directory of /Program Files/Winamp. Change this to /Program Files/MediaMonkey. If you\'re unable to change the installation directory, you\'ll have to install to the Winamp directory and then manually copy the installed .dll file(s) to the Program Files/MediaMonkey/Plug-ins directory.') + '\n\n' +

        _('2) If the plug-in is a .dll, simply copy the .dll to the Program Files/MediaMonkey/Plugins directory, and follow the instructions provided with the plug-in.') + '\n\n' +

        _('Once the plug-in is installed, you can access it from the plug-ins pane, and press the Configure button.');
    qid('inPlugsPane').setAttribute('data-tip', legend);

    let columns = new Array();
    columns.push({
        order: 1,
        width: 300,
        title: _('Name'),
        bindData: function (div, item, index) {
            div.innerText = item.description;
        }
    });
    columns.push({
        order: 2,
        width: 120,
        title: _('File'),
        bindData: function (div, item, index) {
            div.innerText = item.filename;
        }
    });
    LV.controlClass.setColumns(columns);

    let configBtn = qid('btnInputPluginConf');
    let aboutBtn = qid('btnInputPluginAbout');
    let downloadBtn = qid('aDownloadMoreInputPlugins');

    LV.controlClass.dataSource = app.player.getInputPlugins();
    LV.controlClass.setFocusedAndSelectedIndex(0);

    let lastButtonActionTime = 0;

    let checkClickTm = function () { // do not allow two clicks in 2 seconds, it could open two dialogs at once
        let tm = Date.now();
        let retval = ((tm - lastButtonActionTime) > 2000);
        if (retval)
            lastButtonActionTime = tm;
        return retval;
    };

    window.localListen(LV, 'itemdblclick', function (e) {
        if (!checkClickTm())
            return;
        let plugin = e.detail.item;
        if (plugin)
            plugin.showConfig();
    });
    window.localListen(configBtn, 'click', function () {
        if (!checkClickTm())
            return;
        let plugin = LV.controlClass.getItem(LV.controlClass.focusedIndex);
        if (plugin)
            plugin.showConfig();
    });
    window.localListen(aboutBtn, 'click', function () {
        if (!checkClickTm())
            return;
        let plugin = LV.controlClass.getItem(LV.controlClass.focusedIndex);
        if (plugin)
            plugin.showAbout();
    });
    window.localListen(downloadBtn, 'click', function () {
        window.uitools.openWeb('https://www.mediamonkey.com/re/input-mm5');
    });
}

optionPanels.pnl_Player.subPanels.pnl_InputPlugins.save = function (sett) {
    // nothing to save here
}
