/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";
let speedSetChanged = {};
let _inTrackTypeSwitching = false;
let UI = null;

function trackTypeSwitched(newIndex) {
    _inTrackTypeSwitching = true;
    let lvTrackTypesList = UI.lvTrackTypesList;
    let DS = lvTrackTypesList.controlClass.dataSource;
    let newValue = null;    
    DS.locked(function () {        
        newValue = DS.getValue(lvTrackTypesList.controlClass.focusedIndex);        
    });

    if (newValue) {
        let trackTypeSett = JSON.parse(newValue.toString());
        UI.chbBookmark.controlClass.checked = trackTypeSett.Player.BookmarkEnabled;
        UI.chbShuffle.controlClass.checked = trackTypeSett.Player.IgnoreShuffle;
        UI.chbIgnoreAutoDJ.controlClass.checked = trackTypeSett.Player.IgnoreAutoDJ;
        UI.fadeIn.controlClass.value = trackTypeSett.Player.FadeIn / 1000;
        UI.fadeOut.controlClass.value = trackTypeSett.Player.FadeOut / 1000;
        UI.gapOverlap.controlClass.value = trackTypeSett.Player.GapOverlap / 1000;
        UI.chbRemoveSilence.controlClass.checked = trackTypeSett.Player.RemoveSilence;
        UI.edtTrackTypePlayAction.controlClass.focusedIndex = trackTypeSett.Player.PlayNowAction + 1;
        UI.chbShuffleAllInPlayNow.controlClass.checked = trackTypeSett.Player.ShuffleAllInPlayNow;
        UI.edtPlayCounterPerc.controlClass.value = trackTypeSett.Player.PlayCounterPerc;
        UI.cbSummaryPlayer.controlClass.value = app.masks.mask2VisMask(trackTypeSett.Player.Summary);
        UI.chbSpeed.controlClass.checked = trackTypeSett.Player.SpeedEnabled;
        setVisibility( UI.rowShuffleRule,  (UI.edtTrackTypePlayAction.controlClass.focusedIndex == 1)); // PNACT_Clear_PlayAll
    }
    _inTrackTypeSwitching = false;
}

function trackTypeConfigChanged() {
    if (_inTrackTypeSwitching)
        return; // #20830

    let lvTrackTypesList = UI.lvTrackTypesList;
    let DS = lvTrackTypesList.controlClass.dataSource;
    let value = null;
    let ttfi = lvTrackTypesList.controlClass.focusedIndex;
    DS.locked(function () {
        value = DS.getValue(ttfi);
    });
    setVisibility( UI.rowShuffleRule,  (UI.edtTrackTypePlayAction.controlClass.focusedIndex == 1)); // PNACT_Clear_PlayAll
    if (value) {
        let trackTypeSett = JSON.parse(value.toString());
        trackTypeSett.Player.BookmarkEnabled = UI.chbBookmark.controlClass.checked;
        trackTypeSett.Player.IgnoreShuffle = UI.chbShuffle.controlClass.checked;
        trackTypeSett.Player.IgnoreAutoDJ = UI.chbIgnoreAutoDJ.controlClass.checked;
        trackTypeSett.Player.FadeIn = Math.round(1000 * UI.fadeIn.controlClass.value);
        trackTypeSett.Player.FadeOut = Math.round(1000 * UI.fadeOut.controlClass.value);
        trackTypeSett.Player.GapOverlap = Math.round(1000 * UI.gapOverlap.controlClass.value);
        trackTypeSett.Player.RemoveSilence = UI.chbRemoveSilence.controlClass.checked;
        trackTypeSett.Player.PlayNowAction = UI.edtTrackTypePlayAction.controlClass.focusedIndex - 1;
        if(trackTypeSett.Player.PlayNowAction === 0)
            trackTypeSett.Player.ShuffleAllInPlayNow = UI.chbShuffleAllInPlayNow.controlClass.checked;
        trackTypeSett.Player.PlayCounterPerc = UI.edtPlayCounterPerc.controlClass.value;
        trackTypeSett.Player.Summary = app.masks.visMask2Mask(UI.cbSummaryPlayer.controlClass.value);
        let lastSpeedEnabled = trackTypeSett.Player.SpeedEnabled;
        trackTypeSett.Player.SpeedEnabled = UI.chbSpeed.controlClass.checked;        
        DS.modifyAsync(function () {
            DS.setValue(ttfi, JSON.stringify(trackTypeSett));            
        });
        if(trackTypeSett.Player.SpeedEnabled !== lastSpeedEnabled)
            speedSetChanged[ttfi] = true;
    }    
}
optionPanels.pnl_Player.subPanels.pnl_PlaybackRules.load = function (sett) {
    UI = getAllUIElements(qid('pnlPlaybackRulesRoot'));

    let lvTrackTypesList = UI.lvTrackTypesList;
    lvTrackTypesList.controlClass.dataSource = app.settings.utils.getTrackTypeSettings();
    lvTrackTypesList.controlClass.localListen(lvTrackTypesList, 'focuschange', trackTypeSwitched);
    lvTrackTypesList.controlClass.focusedIndex = 0;
    lvTrackTypesList.controlClass.setSelectedIndex(0);
    let cbSummary = UI.cbSummaryPlayer;
    cbSummary.controlClass.masks = newStringList();
    cbSummary.controlClass.hideWizardButton = true;
    UI.lblShuffleRule.innerText = _('Shuffle') + ' (' + _('On') + '): ';
    localListen(UI.chbBookmark, 'click', trackTypeConfigChanged);
    localListen(UI.chbShuffle, 'click', trackTypeConfigChanged);
    localListen(UI.chbIgnoreAutoDJ, 'click', trackTypeConfigChanged);   
    localListen(UI.edtTrackTypePlayAction, 'change', trackTypeConfigChanged);
    localListen(UI.chbShuffleAllInPlayNow, 'change', trackTypeConfigChanged);
    localListen(UI.edtPlayCounterPerc, 'change', trackTypeConfigChanged);
    localListen(UI.cbSummaryPlayer, 'change', trackTypeConfigChanged);
    localListen(UI.chbSpeed, 'click', trackTypeConfigChanged);
    let rsEl = UI.chbRemoveSilence;
    localListen(rsEl, 'click', trackTypeConfigChanged);

    let goEl = UI.gapOverlap;
    let foEl = UI.fadeOut;
    let fiEl = UI.fadeIn;
    let gapTxt = _('Gap');
    let overlapTxt = _('Overlap');
    let goTxt = _('Gap/Overlap');

    let goChange = function (e) {
        let val = Math.round(10 * goEl.controlClass.value) / 10;
        let txt = '';
        if (val < 0)
            txt = (-val) + 's ' + gapTxt;
        else if (val > 0)
            txt = (val) + 's ' + overlapTxt;
        else
            txt = '0s ' + goTxt;
        uitools.toastMessage.show('&nbsp;' + txt + '&nbsp;', {
            disableClose: true,
            delay: 3000
        });
        if (e && !e.detail) // onchange
            trackTypeConfigChanged();
    }

    let fChange = function (e) {
        let val = Math.round(10 * e.currentTarget.controlClass.value) / 10;
        let txt = '&nbsp;' + val + 's' + '&nbsp;';
        uitools.toastMessage.show(txt, {
            disableClose: true,
            delay: 3000
        });
        if (e && !e.detail) // onchange
            trackTypeConfigChanged();
    }

    localListen(goEl, 'change', goChange);
    localListen(goEl, 'livechange', goChange);
    localListen(foEl, 'change', fChange);
    localListen(foEl, 'livechange', fChange);
    localListen(fiEl, 'change', fChange);
    localListen(fiEl, 'livechange', fChange);
   
    optionPanels.pnl_Player.subPanels.pnl_PlaybackRules.onactivate();
}

optionPanels.pnl_Player.subPanels.pnl_PlaybackRules.onactivate = function () {
    let outPluginInfo;
    if(window.getOutputPluginFeatures) { // set by outputPlugins tab, if exists, current value from there
        outPluginInfo = window.getOutputPluginFeatures();
    } else {
        outPluginInfo = app.player.getOutputPluginFeatures();
    }
    let fsc = UI.fsCrossfading;
    let rsEl = UI.chbRemoveSilence;
    fsc.controlClass.disabled = !outPluginInfo.hasMMFunctions;
    rsEl.controlClass.disabled = !outPluginInfo.hasMMFunctions;
    if (!outPluginInfo.hasMMFunctions) {
        // Unsupported by <NameofCurrentOutputPlugin>. Please change "Audio Output" ("plug-ins").
        let tipTxt = sprintf(_('Unsupported by %s.\nPlease change \"%s\" (\"%s\")'), outPluginInfo.description + ' (' + outPluginInfo.name + ')', _('Audio Output'), _('plug-ins'));
        UI.fsCrossfadingWrapper.setAttribute('data-tip', tipTxt);
        setVisibility(UI.fsTipOverlay, true); // needed for catching mouse events for tooltip above disabled elements
    } else {
        UI.fsCrossfadingWrapper.removeAttribute('data-tip');
        setVisibility(UI.fsTipOverlay, false); // needed for catching mouse events for tooltip above disabled elements
    }
}

optionPanels.pnl_Player.subPanels.pnl_PlaybackRules.save = function (sett) {
    let lvTrackTypesList = UI.lvTrackTypesList;
    app.settings.utils.setTrackTypeSettings(lvTrackTypesList.controlClass.dataSource);
    let sd = app.player.getCurrentTrack();
    if(sd) {
        let tti = sd.trackType;
        if(speedSetChanged[tti]) {
            let DS = lvTrackTypesList.controlClass.dataSource;
            let value = null;
            DS.locked(function () {
                value = DS.getValue(tti);
            });
            if(value) {
                let typeSettings = JSON.parse(value.toString());
                if(typeSettings.Player.SpeedEnabled) {
                    app.player.speed = typeSettings.Player.Speed;
                    app.player.pitchChange = typeSettings.Player.Pitch;
                }
                else {
                    app.player.speed = 1;
                    app.player.pitchChange = 0;
                }
            }
        }
    }
}

optionPanels.pnl_Player.subPanels.pnl_PlaybackRules.beforeWindowCleanup = function () {
    UI = null;
}

// TrackTypesListView --------------------------------------------
class TrackTypesListView extends PanelListView {

    bindData(div, index) {
        if (this.dataSource && div) {
            let value = this.dataSource.getValue(index);
            let TypeSett = JSON.parse(value.toString());
            div.label.innerText = TypeSett.TrackType.Name;
        }
    }
}
registerClass(TrackTypesListView);
