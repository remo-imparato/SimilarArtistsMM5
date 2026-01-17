/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

optionPanels.pnl_Player.subPanels.pnl_VolumeLeveling.load = function (sett) {

    let chbAutoAnalyzeVolume = qid('chbAutoAnalyzeVolume');
    let txt = _('Automatically analyze volume of unanalyzed files');
    if (!app.utils.isRegistered())
        txt += ' <b>(Gold)</b>';
    chbAutoAnalyzeVolume.controlClass.text = txt + ':';

    qid('chbNormalizeNewOnly').controlClass.checked = sett.Options.NormalizeNewOnly;
    qid('chbAnalyzeAlbums').controlClass.checked = sett.Options.NormalizeAlbums;
    if (!app.utils.isRegistered()) {
        qid('chbAutoAnalyzeVolume').controlClass.checked = false;
        localListen(qid('chbAutoAnalyzeVolume'), 'change', () => {
            if (!app.utils.isRegistered()) {
                window.uitools.showGoldMessage(_('Automatically analyzes volume of tracks as a background process') + '. ' + _('Please upgrade to MediaMonkey Gold for this feature!'));
                qid('chbAutoAnalyzeVolume').controlClass.checked = false;
            }
        });
    } else
        qid('chbAutoAnalyzeVolume').controlClass.checked = sett.Options.AutoAnalyzeVolume;
    qid('cbAutoAnalyzeVolumType').controlClass.focusedIndex = sett.Options.AutoAnalyzeVolumeType;
    qid('cbLevelSource').controlClass.focusedIndex = sett.Options.NormalizationSource;
    qid('cbLevelSourceRip').controlClass.focusedIndex = sett.Options.NormalizationSourceRip;
    qid('chbLevelPlayback').controlClass.checked = sett.Options.NormalizeVolume;
    qid('edtLevelPlaybackVal').controlClass.value = sett.Options.NormalizeTargetPlayerLevel;
    qid('edtLevelFilesVal').controlClass.value = sett.Options.NormalizeTargetFileLevel;
    qid('edtLevelCDsVal').controlClass.value = sett.Options.NormalizeTargetRipLevel;
    qid('chbClippingPrevention').controlClass.checked = sett.Options.NormalizePreventClipping;

    bindDisabled2Checkbox(qid('edtLevelPlaybackVal'), qid('chbLevelPlayback'));
    bindDisabled2Checkbox(qid('lblLevelPlaybackVal'), qid('chbLevelPlayback'));
}

optionPanels.pnl_Player.subPanels.pnl_VolumeLeveling.save = function (sett) {
    sett.Options.NormalizationSource = qid('cbLevelSource').controlClass.focusedIndex;
    sett.Options.NormalizationSourceRip = qid('cbLevelSourceRip').controlClass.focusedIndex;
    sett.Options.NormalizeVolume = qid('chbLevelPlayback').controlClass.checked;
    sett.Options.NormalizeTargetPlayerLevel = qid('edtLevelPlaybackVal').controlClass.value;
    sett.Options.NormalizeTargetFileLevel = qid('edtLevelFilesVal').controlClass.value;
    sett.Options.NormalizeTargetRipLevel = qid('edtLevelCDsVal').controlClass.value;
    sett.Options.NormalizePreventClipping = qid('chbClippingPrevention').controlClass.checked;
    sett.Options.NormalizeNewOnly = qid('chbNormalizeNewOnly').controlClass.checked;
    sett.Options.NormalizeAlbums = qid('chbAnalyzeAlbums').controlClass.checked;
    sett.Options.AutoAnalyzeVolume = qid('chbAutoAnalyzeVolume').controlClass.checked;
    sett.Options.AutoAnalyzeVolumeType = qid('cbAutoAnalyzeVolumType').controlClass.focusedIndex;
}
