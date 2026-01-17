/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

optionPanels.pnl_General.subPanels.pnl_Confirmations.load = function (sett) {
    qid('chbConfirmCopyDBFolder').controlClass.checked = sett.Confirmations.ConfirmCopyDBFolder;
    qid('chbConfirmMoveDBFolder').controlClass.checked = sett.Confirmations.ConfirmMoveDBFolder;
    qid('chbConfirmDeletePlaylist').controlClass.checked = sett.Confirmations.ConfirmDeletePlaylist;
    qid('chbConfirmDeletePlaying').controlClass.checked = sett.Confirmations.ConfirmDeletePlaying;
    qid('chbConfirmRemovePlaying').controlClass.checked = sett.Confirmations.ConfirmRemovePlaying;
    qid('chbConfirmMore64PathChars').controlClass.checked = sett.Confirmations.ConfirmMore64PathChars;
    qid('chbConfirmScanResults').controlClass.checked = sett.Confirmations.ConfirmScanResults;
    qid('chbAskUserMassEdit').controlClass.checked = sett.System.AskUserMassEdit;
    qid('chbConfirmDeviceNotEnoughSpace').controlClass.checked = sett.Confirmations.ConfirmDeviceNotEnoughSpace;
}

optionPanels.pnl_General.subPanels.pnl_Confirmations.save = function (sett) {
    sett.Confirmations.ConfirmCopyDBFolder = qid('chbConfirmCopyDBFolder').controlClass.checked;
    sett.Confirmations.ConfirmMoveDBFolder = qid('chbConfirmMoveDBFolder').controlClass.checked;
    sett.Confirmations.ConfirmDeletePlaylist = qid('chbConfirmDeletePlaylist').controlClass.checked;
    sett.Confirmations.ConfirmDeletePlaying = qid('chbConfirmDeletePlaying').controlClass.checked;
    sett.Confirmations.ConfirmRemovePlaying = qid('chbConfirmRemovePlaying').controlClass.checked;
    sett.Confirmations.ConfirmMore64PathChars = qid('chbConfirmMore64PathChars').controlClass.checked;
    sett.Confirmations.ConfirmScanResults = qid('chbConfirmScanResults').controlClass.checked;
    sett.System.AskUserMassEdit = qid('chbAskUserMassEdit').controlClass.checked;
    sett.Confirmations.ConfirmDeviceNotEnoughSpace = qid('chbConfirmDeviceNotEnoughSpace').controlClass.checked;
}