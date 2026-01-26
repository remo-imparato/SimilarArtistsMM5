/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

import '/commonControls';
requirejs("controls/popupmenu");

let SampleRatesVal = ['0', '11025', '22050', '44100', '48000'];
let Channels = [_('Original'), 1, 2, 3, 4, 5, 6, 7, 8];
let ConvertVal = [45, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 500, 500];

window.outData = '';

window.init = function (params) {
    resizeable = false;
    title = _('OGG settings');


    let setType = params.setType;
    let limitMin = params.limitMin;
    let limitMax = params.limitMax;
    let minBitRate = params.minBitRate;
    let maxBitRate = params.maxBitRate;
    let quality = params.quality;
    let channels = params.channels;
    let sampleRate = params.sampleRate;
    let bitRate = params.bitRate;

    let UI = getAllUIElements();


    let qualityToBitrate = function (quality) {
        let iqual = Math.trunc(quality + 1) - 1; // +-1 because of trunc
        return (iqual - quality + 1) * ConvertVal[iqual + 1] + (quality - iqual) * ConvertVal[iqual + 2];
    }
    let updateQualityValues = function (value) {
        UI.lblQuality.innerText = sprintf('%.1f', value);
        UI.lblBitrate.innerText = sprintf('~%d kbps', Math.round(qualityToBitrate(value)));
    }
    window.localListen(UI.slider, 'livechange', function (e) {
        let value = e.detail.value;
        updateQualityValues(value);
    });

    UI.slider.controlClass.value = quality;
    updateQualityValues(quality);

    UI.edtNominalBitrate.controlClass.value = bitRate;
    UI.edtMinimal.value = minBitRate;
    UI.edtMaximal.value = maxBitRate;

    UI.chbMinimal.controlClass.checked = limitMin;
    UI.chbMaximal.controlClass.checked = limitMax;

    bindDisabled2Checkbox(UI.edtMinimal, UI.chbMinimal);
    bindDisabled2Checkbox(UI.edtMaximal, UI.chbMaximal);


    let sl = newStringList();
    sl.add(_('Original'));
    let idx = 0;
    for (let i = 1; i < SampleRatesVal.length; i++) {
        sl.add(SampleRatesVal[i]);
        if (SampleRatesVal[i] == sampleRate)
            idx = i;
    }
    UI.cbSampleRate.controlClass.dataSource = sl;
    UI.cbSampleRate.controlClass.focusedIndex = idx;


    sl = newStringList();
    for (let i = 0; i < Channels.length; i++)
        sl.add(String(Channels[i]));
    UI.cbChannels.controlClass.dataSource = sl;
    if ((channels < 0) || (channels > 8))
        channels = 0;
    UI.cbChannels.controlClass.focusedIndex = channels;


    let enableTypeBy = function (byQuality) {
        UI.typeByQuality.controlClass.disabled = !byQuality;
        UI.typeByBitrate.controlClass.disabled = byQuality;
        if (!byQuality) {
            UI.edtMinimal.disabled = !UI.chbMinimal.controlClass.checked;
            UI.edtMaximal.disabled = !UI.chbMaximal.controlClass.checked;
        }
    }

    window.localListen(UI.rbByQuality, 'click', function () {
        enableTypeBy(true);
    });
    window.localListen(UI.rbByBitrate, 'click', function () {
        enableTypeBy(false);
    });

    if (setType == 0) {
        UI.rbByQuality.controlClass.checked = true;
        enableTypeBy(true);
    } else {
        UI.rbByBitrate.controlClass.checked = true;
        enableTypeBy(false);
    }

    window.localListen(qid('btnOK'), 'click', function () {
        window.outData = '' +
            (UI.slider.controlClass.value) + '|' +
            (UI.rbByQuality.controlClass.checked ? '0' : '1') + '|' +
            (UI.chbMinimal.controlClass.checked ? 'true' : 'false') + '|' +
            (UI.chbMaximal.controlClass.checked ? 'true' : 'false') + '|' +
            (UI.cbChannels.controlClass.focusedIndex) + '|' +
            (UI.edtMinimal.value) + '|' +
            (UI.edtMaximal.value) + '|' +
            (parseInt(SampleRatesVal[UI.cbSampleRate.controlClass.focusedIndex])) + '|' +
            (UI.edtNominalBitrate.controlClass.value);
        closeWindow();
    });
    requestTimeout(function () {
        setComputedSize(true);
    }, 1);
};
