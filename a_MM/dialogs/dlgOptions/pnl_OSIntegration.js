/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

optionPanels.pnl_General.subPanels.pnl_OSIntegration.load = function (sett) {

    qid('edtDefaultAction').controlClass.focusedIndex = sett.Options.ActionForFiles;
    qid('chbAudioCDPlaybck').controlClass.checked = sett.Options.AutoPlayAct_CDPlay;
    qid('chbVideoPlayback').controlClass.checked = sett.Options.AutoPlayAct_DVDPlay;
    qid('chbAudioRipping').controlClass.checked = sett.Options.AutoPlayAct_CDRip;
    //qid('chbDiscBurning').controlClass.checked = sett.Options.AutoPlayAct_CDBurn;

    let chbPlayInMediaMonkey = qid('chbPlayInMediaMonkey');
    let chbPlayNextInMediaMonkey = qid('chbPlayNextInMediaMonkey');
    let chbPlayLastInMediaMonkey = qid('chbPlayLastInMediaMonkey');
    let ver = app.utils.getApplicationVersion(1);
    chbPlayInMediaMonkey.controlClass.text = sprintf(uitools.getPureTitle(_("&Play in MediaMonkey %s")), ver);
    chbPlayNextInMediaMonkey.controlClass.text = sprintf(uitools.getPureTitle(_("Queue &next in MediaMonkey %s")), ver);
    chbPlayLastInMediaMonkey.controlClass.text = sprintf(uitools.getPureTitle(_("Queue &last in MediaMonkey %s")), ver);

    chbPlayInMediaMonkey.controlClass.checked = sett.Options.ContextMnuAct_Play;
    chbPlayNextInMediaMonkey.controlClass.checked = sett.Options.ContextMnuAct_PlayNext;
    chbPlayLastInMediaMonkey.controlClass.checked = sett.Options.ContextMnuAct_PlayLast;

    let lastButtonActionTime = 0;

    localListen(qid('btnReassociate'), 'click', function () {
        let tm = Date.now();
        if ((tm - lastButtonActionTime) > 2000) { // to avoid double dialogs by two quick clicks
            lastButtonActionTime = tm;
            app.reAssocApp();
        }
    });
    addEnterAsClick(window, qid('btnReassociate'));
}

optionPanels.pnl_General.subPanels.pnl_OSIntegration.save = function (sett) {

    let edtDefaultAction = qid('edtDefaultAction');
    let chbAudioCDPlaybck = qid('chbAudioCDPlaybck');
    let chbVideoPlayback = qid('chbVideoPlayback');
    let chbAudioRipping = qid('chbAudioRipping');
    //let chbDiscBurning = qid('chbDiscBurning');
    let chbPlayInMediaMonkey = qid('chbPlayInMediaMonkey');
    let chbPlayNextInMediaMonkey = qid('chbPlayNextInMediaMonkey');
    let chbPlayLastInMediaMonkey = qid('chbPlayLastInMediaMonkey');

    let Needs_OS_Reintegration =
        (sett.Options.ActionForFiles != edtDefaultAction.controlClass.focusedIndex) ||
        (sett.Options.AutoPlayAct_CDPlay != chbAudioCDPlaybck.controlClass.checked) ||
        (sett.Options.AutoPlayAct_DVDPlay != chbVideoPlayback.controlClass.checked) ||
        (sett.Options.AutoPlayAct_CDRip != chbAudioRipping.controlClass.checked) ||
        //(sett.Options.AutoPlayAct_CDBurn != chbDiscBurning.controlClass.checked) ||
        (sett.Options.ContextMnuAct_Play != chbPlayInMediaMonkey.controlClass.checked) ||
        (sett.Options.ContextMnuAct_PlayNext != chbPlayNextInMediaMonkey.controlClass.checked) ||
        (sett.Options.ContextMnuAct_PlayLast != chbPlayLastInMediaMonkey.controlClass.checked);

    sett.Options.ActionForFiles = edtDefaultAction.controlClass.focusedIndex;
    sett.Options.AutoPlayAct_CDPlay = chbAudioCDPlaybck.controlClass.checked;
    sett.Options.AutoPlayAct_DVDPlay = chbVideoPlayback.controlClass.checked;
    sett.Options.AutoPlayAct_CDRip = chbAudioRipping.controlClass.checked;
    // sett.Options.AutoPlayAct_CDBurn = chbDiscBurning.controlClass.checked;
    sett.Options.ContextMnuAct_Play = chbPlayInMediaMonkey.controlClass.checked;
    sett.Options.ContextMnuAct_PlayNext = chbPlayNextInMediaMonkey.controlClass.checked;
    sett.Options.ContextMnuAct_PlayLast = chbPlayLastInMediaMonkey.controlClass.checked;

    if (Needs_OS_Reintegration) {
        window.settings.set(sett);
        app.reAssocApp();
    }
}
