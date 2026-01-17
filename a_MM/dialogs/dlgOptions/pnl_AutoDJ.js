/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

requirejs('helpers/autoDJ');

optionPanels.pnl_Player.subPanels.pnl_AutoDJ.load = function (sett) {
    let player = app.player;
    qid('chbEnableAutoDJ').controlClass.checked = player.autoDJ.enabled;
    if (player.autoDJ.addTrackCount == 0)
        qid('cbNumberToAdd').controlClass.value = _('None');
    else
        qid('cbNumberToAdd').controlClass.value = player.autoDJ.addTrackCount;

    if (player.autoDJ.keepTrackCount < 0)
        qid('cbNumberToKeep').controlClass.value = _('All');
    else
        qid('cbNumberToKeep').controlClass.value = player.autoDJ.keepTrackCount;

    let keys = Object.keys(autoDJ.sources);
    this.keys = keys;
    for (let i = 0; i < keys.length; i++) {
        let source = autoDJ.sources[keys[i]];
        if (source.order === undefined)
            source.order = 10 * (i + 1);
    };
    keys.sort(function (i1, i2) {
        let retval = autoDJ.sources[i1].order - autoDJ.sources[i2].order;
        return retval;
    });
    let sourceList = newStringList();
    for (let i = 0; i < keys.length; i++) {
        let source = autoDJ.sources[keys[i]];
        sourceList.add(resolveToValue(source.name));
    }
    let cbAutoDJSource = qid('cbAutoDJSource');
    let panel = qid('autoDJConfigPanel');
    this._onAutoDJChanged = function () {
        let source = autoDJ.sources[keys[cbAutoDJSource.controlClass.focusedIndex]];
        panel.innerHTML = '';
        if (source.loadConfig)
            source.loadConfig(panel);
    };
    cbAutoDJSource.controlClass.localListen(cbAutoDJSource, 'change', this._onAutoDJChanged);
    cbAutoDJSource.controlClass.dataSource = sourceList;
    let value = resolveToValue(autoDJ.getCurrentSource().name);
    cbAutoDJSource.controlClass.focusedIndex = sourceList.indexOf(value);

    bindDisabled2Checkbox(qid('cbNumberToAdd'), qid('chbEnableAutoDJ')); 
    bindDisabled2Checkbox(qid('lblNumberToAdd'), qid('chbEnableAutoDJ'));
    bindDisabled2Checkbox(qid('lblNumberToAdd2'), qid('chbEnableAutoDJ'));    
    bindDisabled2Checkbox(qid('lblAutoDJSource'), qid('chbEnableAutoDJ'));
    bindDisabled2Checkbox(qid('cbAutoDJSource'), qid('chbEnableAutoDJ'));
    bindDisabled2Checkbox(qid('autoDJConfigPanel'), qid('chbEnableAutoDJ'));    
}

optionPanels.pnl_Player.subPanels.pnl_AutoDJ.save = function (sett) {
    let player = app.player;
    player.autoDJ.enabled = qid('chbEnableAutoDJ').controlClass.checked;
    if (qid('cbNumberToAdd').controlClass.value == _('None'))
        player.autoDJ.addTrackCount = Number(0);
    else
        player.autoDJ.addTrackCount = Number(qid('cbNumberToAdd').controlClass.value);
    if (qid('cbNumberToKeep').controlClass.value == _('All'))
        player.autoDJ.keepTrackCount = Number(-1);
    else
        player.autoDJ.keepTrackCount = Number(qid('cbNumberToKeep').controlClass.value);

    let cbAutoDJSource = qid('cbAutoDJSource');
    let key = this.keys[cbAutoDJSource.controlClass.focusedIndex];
    player.autoDJ.source = key;
    var source = autoDJ.sources[key];
    if (source.saveConfig)
        source.saveConfig(qid('autoDJConfigPanel'));
}