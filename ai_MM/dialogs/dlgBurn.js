/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

let _tracks;
let edtDrive;

function init(params) {
    let wnd = this;
    wnd.title = _('Burn');
    wnd.resizeable = false;
    _tracks = params.tracks;
    edtDrive = qid('edtDrive');
    window.localPromise(app.utils.getBurnDriveListAsync()).then((list) => {
        edtDrive.controlClass.dataSource = list;
        edtDrive.controlClass.focusedIndex = 0;
        if (list.count == 0)
            qid('btnBurn').controlClass.disabled = true; // #19482
    });

    window.localListen(qid('btnBurn'), 'click', btnBurnPressed);
    window.localListen(qid('btnCancel'), 'click', btnCancelSleepPressed);

    let sett = settings.get('Options, Burn');
    qid('chbLevelVolume').controlClass.checked = sett.Burn.NormalizeVolume;
    qid('cbLevelSource').controlClass.focusedIndex = sett.Burn.LevelSource;
    qid('edtLevelCDsVal').controlClass.value = sett.Options.NormalizeTargetBurnLevel;

    qid('chbCDText').controlClass.checked = sett.Burn.WriteCDText;
    qid('chbCacheNetFiles').controlClass.checked = sett.Burn.CacheNetFiles;
    qid('chbOnFly').controlClass.checked = sett.Burn.OnTheFly;
    qid('chbEject').controlClass.checked = sett.Burn.EjectMedia;
    qid('chbSoundAlert').controlClass.checked = sett.Burn.SoundAlert;

}

function saveSettings() {
    let sett = settings.get('Options, Burn');

    sett.Burn.NormalizeVolume = qid('chbLevelVolume').controlClass.checked;
    sett.Burn.LevelSource = qid('cbLevelSource').controlClass.focusedIndex;
    sett.Options.NormalizeTargetBurnLevel = qid('edtLevelCDsVal').controlClass.value;
    sett.Burn.WriteCDText = qid('chbCDText').controlClass.checked;
    sett.Burn.CacheNetFiles = qid('chbCacheNetFiles').controlClass.checked;
    sett.Burn.OnTheFly = qid('chbOnFly').controlClass.checked;
    sett.Burn.EjectMedia = qid('chbEject').controlClass.checked;
    sett.Burn.SoundAlert = qid('chbSoundAlert').controlClass.checked;

    settings.set(sett, 'Options, Burn');
}

function btnBurnPressed() {
    saveSettings();
    if (edtDrive.controlClass.focusedIndex >= 0)
        app.utils.burnAudioCDTracksAsync(_tracks, edtDrive.controlClass.focusedIndex);
    closeWindow();
}

function btnCancelSleepPressed() {
    closeWindow();
}

window.windowCleanup = function () {
    edtDrive = undefined;
    _tracks = undefined;
}