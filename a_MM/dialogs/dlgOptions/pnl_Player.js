/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

let UI = null;

optionPanels.pnl_Player.load = function (sett) {
    UI = getAllUIElements(qid('pnlPlayerRoot'));

    UI.edtItemActionStopped.controlClass.focusedIndex = sett.Options.ItemActionStopped;
    UI.edtItemActionPlaying.controlClass.focusedIndex = sett.Options.ItemAction;

    UI.lblShuffleRule.innerText = _('Shuffle') + ' (' + _('On') + '): ';

    UI.edtDefaultPlayNowAction.controlClass.focusedIndex = sett.Options.DefaultPlayNowAction;
    setVisibility( UI.rowShuffleRule,  (sett.Options.DefaultPlayNowAction === 0)); // PNACT_Clear_PlayAll
    localListen(UI.edtDefaultPlayNowAction, 'change', () => {
        setVisibility( UI.rowShuffleRule,  (UI.edtDefaultPlayNowAction.controlClass.focusedIndex == 0)); // PNACT_Clear_PlayAll
    });
    UI.chbShuffleAllInPlayNow.controlClass.checked = sett.Options.ShuffleAllInPlayNow;

    if (app.utils.getPortableMode())
        setVisibility(UI.linkOSIntegration, false);
    else
        localListen(UI.linkOSIntegration, 'click', () => {
            // open OS integration tab
            selectPanel('pnl_OSIntegration');
        });

    localListen(UI.linkPlaybackRules, 'click', () => {
        // open Playback Rules tab
        selectPanel('pnl_PlaybackRules');
    });                

    let showNewTrackInfo = sett.Appearance.ShowNewTrackInfo; // 0 - never, 1 - minimized, 2 - always
    UI.chbPopupFileInfo.controlClass.checked = (showNewTrackInfo > 0);
    UI.chbPopupFileInfoInactive.controlClass.checked = (showNewTrackInfo === 1);
    UI.chbExternalVideoPlayer.controlClass.checked = sett.System.UseExternalVideoPlayer;
    UI.edtPopupSeconds.controlClass.value = sett.InfoPopUp.ShowTime / 1000;

    setVisibility( UI.fPopup, !app.focusAssistIsOn()); // #20678

    let fadeTime = sett.InfoPopUp.FadeTime; // 0 = no fade, otherwise = time in milliseconds
    //console.log(sett);
    //console.log(fadeTime);
    UI.chbPopupFileInfoSlowFade.controlClass.checked = (fadeTime != 0);
    UI.edtPopupFadeTimeSeconds.controlClass.value = fadeTime / 1000;

    let opacitySlider = UI.popupOpacity;
    let horizontalSlider = UI.popupHorizontalPos;
    let verticalSlider = UI.popupVerticalPos;
    opacitySlider.controlClass.value = sett.InfoPopUp.Opacity;
    horizontalSlider.controlClass.value = sett.InfoPopUp.Horizontal;
    verticalSlider.controlClass.value = sett.InfoPopUp.Vertical;

    bindDisabled2Checkbox(UI.chbPopupFileInfoInactive, UI.chbPopupFileInfo);
    bindDisabled2Checkbox(UI.edtPopupSeconds, UI.chbPopupFileInfo);
    bindDisabled2Checkbox(UI.chbPopupFileInfoSlowFade, UI.chbPopupFileInfo);
    bindDisabled2Checkbox(UI.lblPopupSeconds, UI.chbPopupFileInfo);
    bindDisabled2Checkbox(UI.edtPopupFadeTimeSeconds, UI.chbPopupFileInfoSlowFade);    
    bindDisabled2Checkbox(UI.edtPopupFadeTimeSeconds, UI.chbPopupFileInfo); 
    bindDisabled2Checkbox(UI.lblPopupFadeTimeSeconds, UI.chbPopupFileInfoSlowFade);
    bindDisabled2Checkbox(UI.lblPopupFadeTimeSeconds, UI.chbPopupFileInfo);
    bindDisabled2Checkbox(UI.popupOpacity, UI.chbPopupFileInfo);
    bindDisabled2Checkbox(UI.popupHorizontalPos, UI.chbPopupFileInfo);
    bindDisabled2Checkbox(UI.popupVerticalPos, UI.chbPopupFileInfo);
    bindDisabled2Checkbox(UI.popupPosLabel, UI.chbPopupFileInfo);    
    bindDisabled2Checkbox(UI.lblPopupOpacity, UI.chbPopupFileInfo);
    bindDisabled2Checkbox(UI.lblTransparent, UI.chbPopupFileInfo);
    bindDisabled2Checkbox(UI.lblOpaque, UI.chbPopupFileInfo);
    bindDisabled2Checkbox(UI.lblHorizontal, UI.chbPopupFileInfo);
    bindDisabled2Checkbox(UI.lblVertical, UI.chbPopupFileInfo);    

    let trackInfoDlgParams = {
        modal: false,
        atTopMost: true,
        bordered: false,
        flat: true,
        disableAutoHide: true,
        show: false,
        sd: {
            title: _('Title'),
            artist: _('Artist'),
            album: _('Album')
        }
    };
    let trackInfoDlg = uitools.openDialog('dlgTrackInfo', trackInfoDlgParams);
    trackInfoDlg.onloaded = function () {
        app.unlisten(trackInfoDlg, 'load', trackInfoDlg.onloaded);
        trackInfoDlg.loaded = true;
        if (trackInfoDlg.closeAfterLoad) {
            closeTrackInfo();
            trackInfoDlg.closeWindow();
        }
    };
    localListen(trackInfoDlg, 'load', trackInfoDlg.onloaded);
    localListen(thisWindow, 'closed', function () {
        if (trackInfoDlg.loaded) {
            trackInfoDlg.closeWindow();
        } else {
            trackInfoDlg.closeAfterLoad = true;
        }
    });

    let showTrackInfo = function () {
        if (trackInfoDlg.loaded) {
            trackInfoDlg.show();
        } else {
            setTimeout(showTrackInfo, 10);
        }
    };
    let closeTrackInfo = function () {
        if (trackInfoDlg) {
            if (trackInfoDlg.loaded) {
                trackInfoDlg.hide();
            }
        }
    }
    let sliderChanged = function (evt) {
        closeTrackInfo();
    }
    let sliderLivechanged = function (evt) {
        if (!trackInfoDlg) {
            showTrackInfo();
            return;
        }
        if (trackInfoDlg.loaded) {
            trackInfoDlg.getValue('showTrackInfo')(trackInfoDlgParams);
            trackInfoDlg.getValue('setPos')(horizontalSlider.controlClass.value, verticalSlider.controlClass.value);
            trackInfoDlg.opacity = opacitySlider.controlClass.value;
            showTrackInfo();
        }
    }
    localListen(opacitySlider, 'change', sliderChanged);
    localListen(opacitySlider, 'livechange', sliderLivechanged);
    localListen(horizontalSlider, 'change', sliderChanged);
    localListen(horizontalSlider, 'livechange', sliderLivechanged);
    localListen(verticalSlider, 'change', sliderChanged);
    localListen(verticalSlider, 'livechange', sliderLivechanged);
}

optionPanels.pnl_Player.save = function (sett) {

    sett.Options.ItemActionStopped = UI.edtItemActionStopped.controlClass.focusedIndex;
    sett.Options.ItemAction = UI.edtItemActionPlaying.controlClass.focusedIndex;
    sett.Options.DefaultPlayNowAction = UI.edtDefaultPlayNowAction.controlClass.focusedIndex;
    if(isVisible(UI.rowShuffleRule)) {
        sett.Options.ShuffleAllInPlayNow = UI.chbShuffleAllInPlayNow.controlClass.checked;
    }
    sett.Appearance.ShowNewTrackInfo = UI.chbPopupFileInfo.controlClass.checked ? (UI.chbPopupFileInfoInactive.controlClass.checked ? 1 : 2) : 0;
    sett.InfoPopUp.ShowTime = UI.edtPopupSeconds.controlClass.value * 1000;
    sett.InfoPopUp.FadeTime = UI.chbPopupFileInfoSlowFade.controlClass.checked ? UI.edtPopupFadeTimeSeconds.controlClass.value * 1000 : 0;

    sett.InfoPopUp.Opacity = UI.popupOpacity.controlClass.value;
    sett.InfoPopUp.Horizontal = UI.popupHorizontalPos.controlClass.value;
    sett.InfoPopUp.Vertical = UI.popupVerticalPos.controlClass.value;

    sett.System.UseExternalVideoPlayer = UI.chbExternalVideoPlayer.controlClass.checked;

    //console.log(sett);
}

optionPanels.pnl_Player.beforeWindowCleanup = function () {
    UI = null;
}