/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

optionPanels.pnl_Player.subPanels.pnl_Streaming.load = function (sett) {

    let btnPlayerConfig = qid('btnPlayerConfig');
    let edtChoosePlayer = qid('edtChoosePlayer');

    let activePlayer = app.sharing.getActivePlayer();
    let remotePlayers = app.sharing.getAvailablePlayers();
    this.remotePlayers = remotePlayers;
    localListen(edtChoosePlayer, 'change', () => {
        let player = getValueAtIndex(remotePlayers, edtChoosePlayer.controlClass.focusedIndex);
        setVisibility(btnPlayerConfig, player && player.getDeviceType() != 'Google Cast Group');
    });

    localListen(btnPlayerConfig, 'click', function () {

        let player = getValueAtIndex(remotePlayers, edtChoosePlayer.controlClass.focusedIndex);
        if (!player)
            return;

        if (player.isMultiZone) {
            uitools.openDialog('dlgMultizone', {
                modal: true
            }, function () {
                let pl = this;
                if (pl.players.count > 0)
                    app.sharing.setActivePlayerUUID(pl.uuid);
                else
                    app.sharing.setActivePlayerUUID(''); // switch to internal player when "no player" is in the multi-zone
            }.bind(player));
        } else
        if (player.uuid === '' /* internal player*/ ) {
            // configure output plugin, #16554                
            app.player.outputPluginConfig();
        } else
        if (player.getDeviceType() != 'Google Cast Group') {
            // configure auto-conversion per #16349                                
            app.sharing.getClientForPlayerAsync(player).then((item) => {
                uitools.openDialog('dlgClientConfig', {
                    modal: true,
                    configMode: 'autoConvert',
                    client: item
                });
            });
        }
    });
    addEnterAsClick(window, btnPlayerConfig);

    let _update = () => {
        if (window._cleanUpCalled || !edtChoosePlayer.controlClass)
            return;

        let list = newStringList();
        let focusIndex = 0;
        remotePlayers.locked(function () {
            for (let i = 0; i < remotePlayers.count; i++) {
                let pl = remotePlayers.getValue(i);
                list.add(pl.name);
                if (activePlayer && pl.uuid == activePlayer.uuid)
                    focusIndex = i;
            }
        });
        edtChoosePlayer.controlClass.dataSource = list;
        edtChoosePlayer.controlClass.focusedIndex = focusIndex;
    }
    localListen(remotePlayers, 'change', _update);
    remotePlayers.whenLoaded().then(_update);

    
    qid('chbPlayAsSingleStream').controlClass.checked = sett.MediaSharing.PlayAsSingleStream;

    qid('chbAcceptDLNAControl').controlClass.checked = sett.MediaSharing.AllowControlViaUPnP;
    qid('edtRendererName').controlClass.value = sett.MediaSharing.RendererName;
    bindDisabled2Checkbox(qid('edtRendererName'), qid('chbAcceptDLNAControl'));
    bindDisabled2Checkbox(qid('lblRendererName'), qid('chbAcceptDLNAControl'));

    let cacheDir = qid('edtStreamCacheDir');
    cacheDir.controlClass.value = sett.streaming.StreamCacheDir;
    localListen(qid('btnStreamCacheDir'), 'click', function () {
        window.uitools.showSelectFolderDlg(cacheDir.controlClass.value).then(function (path) {
            if (path != '') {
                cacheDir.controlClass.value = path;
            }
        });
    });
    addEnterAsClick(window, qid('btnStreamCacheDir'));
    qid('chbStreamCacheSize').controlClass.checked = sett.streaming.LimitStreamCacheContent;
    qid('edtStreamCacheSize').controlClass.value = sett.streaming.LimitStreamCacheContentSize;
    bindDisabled2Checkbox(qid('edtStreamCacheSize'), qid('chbStreamCacheSize'));
    bindDisabled2Checkbox(qid('lblStreamCacheSize'), qid('chbStreamCacheSize'));
}

optionPanels.pnl_Player.subPanels.pnl_Streaming.save = function (sett) {
    let edtChoosePlayer = qid('edtChoosePlayer');
    if (edtChoosePlayer.controlClass.dataSource) { // players already loaded
        let index = edtChoosePlayer.controlClass.focusedIndex;
        let remotePlayers = this.remotePlayers;
        remotePlayers.locked(function () {
            let pl = remotePlayers.getValue(index);
            if (pl)
                app.sharing.setActivePlayerUUID(pl.uuid);
        });
    }
    app.sharing.setPlayerControlAllowed(qid('chbAcceptDLNAControl').controlClass.checked);
    sett.MediaSharing.RendererName = qid('edtRendererName').controlClass.value;
    sett.MediaSharing.PlayAsSingleStream = qid('chbPlayAsSingleStream').controlClass.checked;

    sett.streaming.StreamCacheDir = qid('edtStreamCacheDir').controlClass.value;
    sett.streaming.LimitStreamCacheContent = qid('chbStreamCacheSize').controlClass.checked;
    sett.streaming.LimitStreamCacheContentSize = qid('edtStreamCacheSize').controlClass.value;
}
