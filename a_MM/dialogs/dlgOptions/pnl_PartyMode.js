/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

optionPanels.pnl_General.subPanels.pnl_PartyMode.load = function (sett) {
    qid('chbPartyPassword').controlClass.checked = sett.PartyMode.PasswEnabled;
    qid('edtPartyPassword').controlClass.value = sett.PartyMode.PartyPasswEditText;
    qid('chbPartyLockdown').controlClass.checked = sett.PartyMode.TotalLock;
    bindDisabled2Checkbox(qid('chbPartyLockdown'), qid('chbPartyPassword'));
    qid('chbPartyHideMenu').controlClass.checked = sett.PartyMode.HideMenu;
    qid('chbPartyFullScreen').controlClass.checked = sett.PartyMode.FullScreen;
    qid('chbPartyPreventSwitching').controlClass.checked = sett.PartyMode.PreventSwitching;
    bindDisabled2Checkbox(qid('chbPartyPreventSwitching'), qid('chbPartyFullScreen'));
    qid('chbPartyDisableRepositioning').controlClass.checked = sett.PartyMode.DisableRepositioning;
    qid('chbPartyDisableReorder').controlClass.checked = sett.PartyMode.DisableAudioControls;
    qid('chbPartyEnablePlayerControl').controlClass.checked = sett.PartyMode.EnableVolumePlayPause;
    bindDisabled2Checkbox(qid('chbPartyEnablePlayerControl'), qid('chbPartyDisableReorder'));
    qid('edtPartyDblClickStopped').controlClass.focusedIndex = sett.PartyMode.PartyItemActionStopped;
    qid('edtPartyDblClickPlaying').controlClass.focusedIndex = sett.PartyMode.PartyItemAction;
    qid('edtPartyPlayAction').controlClass.focusedIndex = sett.PartyMode.PartyPlayNowAction;
    bindDisabled2Checkbox(qid('edtPartyPassword'), qid('chbPartyPassword'));
}

optionPanels.pnl_General.subPanels.pnl_PartyMode.save = function (sett) {
    sett.PartyMode.PasswEnabled = qid('chbPartyPassword').controlClass.checked;
    sett.PartyMode.PartyPasswEditText = qid('edtPartyPassword').controlClass.value;
    sett.PartyMode.TotalLock = qid('chbPartyLockdown').controlClass.checked;
    sett.PartyMode.HideMenu = qid('chbPartyHideMenu').controlClass.checked;
    sett.PartyMode.FullScreen = qid('chbPartyFullScreen').controlClass.checked;
    sett.PartyMode.PreventSwitching = qid('chbPartyPreventSwitching').controlClass.checked;
    sett.PartyMode.DisableRepositioning = qid('chbPartyDisableRepositioning').controlClass.checked;
    sett.PartyMode.DisableAudioControls = qid('chbPartyDisableReorder').controlClass.checked;
    sett.PartyMode.EnableVolumePlayPause = qid('chbPartyEnablePlayerControl').controlClass.checked;
    sett.PartyMode.PartyItemActionStopped = qid('edtPartyDblClickStopped').controlClass.focusedIndex;
    sett.PartyMode.PartyItemAction = qid('edtPartyDblClickPlaying').controlClass.focusedIndex;
    sett.PartyMode.PartyPlayNowAction = qid('edtPartyPlayAction').controlClass.focusedIndex;     
}
