/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

requirejs('controls/radiogridview');

optionPanels.pnl_Player.subPanels.pnl_DSPModules.load = function (sett) {
    let LV = qid('lvDSPModulesList');
    LV.controlClass.showHeader = true;
    LV.controlClass.isSortable = false;
    LV.controlClass.multiselect = true;
    LV.controlClass.enableDragNDrop();
    let legend = _('The MediaMonkey Player supports DSP Audio effect plug-ins that are compatible with Winamp 2. They generally enhance and/or modify the audio in some way.') + '\n\n' +

        _('To install a plug-in you\'ll have to follow either of the following procedures:') + '\n\n' +

        _('1) If the plug-in is provided with an installer, the installer often chooses a default directory of /Program Files/Winamp. Change this to /Program Files/MediaMonkey. If you\'re unable to change the installation directory, you\'ll have to install to the Winamp directory and then manually copy the installed .dll file(s) to the Program Files/MediaMonkey/Plug-ins directory.') + '\n\n' +

        _('2) If the plug-in is a .dll, simply copy the .dll to the Program Files/MediaMonkey/Plugins directory, and follow the instructions provided with the plug-in.') + '\n\n' +

        _('Once the plug-in is installed, you can access it from the plug-ins pane, and press the Configure button.') + _('For DSP Audio Effect plug-ins, you can also set the order in which the plugins process the audio using the up/down arrows.');
    qid('dspPlugsPane').setAttribute('data-tip', legend);

    let columns = new Array();
    columns.push({
        order: 1,
        width: 20,
        setupCell: GridView.prototype.cellSetups.setupCheckbox,
        bindData: GridView.prototype.defaultBinds.bindCheckboxCell
    });
    columns.push({
        order: 1,
        title: _('Name'),
        width: 130,
        bindData: function (div, item, index) {
            div.innerText = item.description;
        }
    });
    columns.push({
        order: 2,
        title: _('Plug-in description'),
        width: 150,
        bindData: function (div, item, index) {
            div.innerText = item.pluginDescription;
        }
    });

    columns.push({
        order: 3,
        title: _('File'),
        width: 120,
        bindData: function (div, item, index) {
            div.innerText = item.filename;
        }
    });
    LV.controlClass.setColumns(columns);

    let configBtn = qid('btnDSPModuleConf');
    let downloadBtn = qid('aDownloadMoreDSPPlugins');

    LV.controlClass.dataSource = app.player.getDSPModules();

    let lastButtonActionTime = 0;

    let checkClickTm = function () { // do not allow two clicks in 2 seconds, it could open two dialogs at once
        let tm = Date.now();
        let retval = ((tm - lastButtonActionTime) > 2000);
        if (retval)
            lastButtonActionTime = tm;
        return retval;
    };

    LV.controlClass.localListen(LV, 'dblclick', function () {
        if (!checkClickTm())
            return;
        let module = LV.controlClass.getItem(LV.controlClass.focusedIndex);
        if (module)
            module.showConfig();
    });
    localListen(configBtn, 'click', function () {
        if (!checkClickTm())
            return;
        let module = LV.controlClass.getItem(LV.controlClass.focusedIndex);
        if (module)
            module.showConfig();
    });
    localListen(downloadBtn, 'click', function () {
        window.uitools.openWeb('https://www.mediamonkey.com/re/dsp');
    });
}

optionPanels.pnl_Player.subPanels.pnl_DSPModules.save = function (sett) {
    let DS = qid('lvDSPModulesList').controlClass.dataSource;
    if(DS)
        app.player.setDSPModules(DS);
}
