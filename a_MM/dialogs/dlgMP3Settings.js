/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

import '/commonControls';
requirejs("controls/popupmenu");

let Presets = [_('Compatible: CBR  96 kbps - Fair Quality'), _('Compatible: CBR 128 kbps - Average Quality'),
    _('Compatible: CBR 160 kbps - Good Quality'), _('Medium (fast): VBR ~160 kbps - High Quality'),
    _('Medium: VBR ~160 kbps - High Quality+'), _('Compatible: CBR 192 kbps - High Quality+'),
    _('Standard (fast): VBR ~192 kbps - Very High Quality'), _('Standard: VBR ~192 kbps - Very High Quality+'),
    _('Extreme (fast): VBR ~256 kbps - Near CD Quality'), _('Extreme: VBR ~256 kbps - Near CD Quality+'),
    _('Insane: CBR ~320 kbps - Highest Quality'), _('Phone: ABR ~16 kbps mono'), _('Short Wave: ABR ~24 kbps mono'),
    _('AM: ABR ~40 kbps mono '), _('Voice: ABR ~56 kbps mono'), _('Tape: ABR ~112 kbps'), _('Hifi: ABR ~160 kbps'),
    _('Near-CD: ABR ~192 kbps'), _('Studio: ABR ~256 kbps')];

let SampleTypes = [_('Constant bitrate (CBR - most compatible)'),_('Variable bitrate (VBR - most efficient)'),
    _('Average bitrate (ABR - controlled/efficient)')];

let Channels = [_('Stereo'),_('Joint stereo'), _('Dual channel'), _('Mono')];


let CBRbps = ['8', '16', '24', '32', '40', '48', '56', '64', '80', '96', '112', '128', '144', '160', '176', '192', '224', '256', '288', '320'];

let VBRbps = ['245', '225', '190', '175', '165', '130', '115', '100', '85', '65'];

let SampleRates = ['Auto', '48000  (MPEG 1)', '44100  (MPEG 1)', '32000  (MPEG 1)', '24000  (MPEG 2)', '22050  (MPEG 2)',
     '16000  (MPEG 2)', '12000  (MPEG 2.5)', '11025  (MPEG 2.5)', '  8000  (MPEG 2.5)'];

let SampleRatesInt = [0, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000];

let EncodingQuality = [_('0 - Highest quality, very slow'), _('1'), _('2 - High quality (recommended)'), _('3'),
    _('4'), _('5 - Standard (default)'), _('6'), _('7 - Fast, ok quality'), _('8'), _('9 - Lowest quality, very fast')];

let VBRMethods = [_('Default (slow)'), _('New (faster)')];


window.outData = '';

window.init = function (params) {
    resizeable = false;
    title = _('MP3 settings');
    
    let usePreset = params.usePreset;
    let presetId = params.presetId;
    let minBitRate = params.minBitRate;
    let maxBitRate = params.maxBitRate;
    let quality = params.quality;
    let bitrateType = params.bitrateType;
    let VBRQual = params.VBRQual;
    let ABR = params.ABR;
    let useAdvanced = params.useAdvanced;
    let VBRMethod = params.VBRMethod;
    let bitReservoir = params.bitReservoir;
    let strictISO = params.strictISO;
    let justApplyMP3Gain = params.justApplyMP3Gain;
    let channels = params.channels;
    let sampleRate = params.sampleRate;
    let bitRate = params.bitRate;
    let maxAllowedMP3Bitrate = params.maxAllowedMP3Bitrate;
    
    let UI = getAllUIElements();
    let currentManualBitrateMode = -1;
    
    let saveLastBitrateMode = function () {
        if(currentManualBitrateMode == 0)
            bitRate = CBRbps[UI.bps.controlClass.focusedIndex];
        else
            if(currentManualBitrateMode == 1)
                VBRQual = UI.bps.controlClass.focusedIndex;
            else 
                if(currentManualBitrateMode == 2)
                    ABR = UI.avgBitrate.value;
    };
    
    let fillCBR = function () {
        let idx = 0;
        let sl = newStringList();
        for(let i = 0; i < CBRbps.length; i++) {
            sl.add(CBRbps[i]);
            if(CBRbps[i] == bitRate)
                idx = i;
        }
        UI.bps.controlClass.dataSource = sl;
        UI.bps.controlClass.focusedIndex = idx;
        UI.lbl_bps.innerText = _('Bitrate')+':';
        setVisibilityFast(UI.bps, true);
        setVisibilityFast(UI.avgBitrate, false);
        UI.cbBitrateMin.controlClass.disabled = true;
        UI.cbBitrateMax.controlClass.disabled = true;
        UI.cbVBRMethod.controlClass.disabled = true;
    };
    
    let fillVBR = function () {
        let sl = newStringList();
        for(let i = 0; i < VBRbps.length; i++) {
            sl.add('V'+i+' (~'+VBRbps[i]+' kbps)');
        }
        UI.bps.controlClass.dataSource = sl;
        UI.bps.controlClass.focusedIndex = VBRQual;
        UI.lbl_bps.innerText = _('VBR Quality')+':';
        setVisibilityFast(UI.bps, true);
        setVisibilityFast(UI.avgBitrate, false);
        UI.cbBitrateMin.controlClass.disabled = false;
        UI.cbBitrateMax.controlClass.disabled = false;
        UI.cbVBRMethod.controlClass.disabled = false;
    };
    
    let fillABR = function () {
        UI.avgBitrate.value = ABR;
        UI.lbl_bps.innerText = _('Avg. bitrate')+':';
        setVisibilityFast(UI.bps, false);
        setVisibilityFast(UI.avgBitrate, true);
        UI.cbBitrateMin.controlClass.disabled = false;
        UI.cbBitrateMax.controlClass.disabled = false;
        UI.cbVBRMethod.controlClass.disabled = true;
    };    
    

    let minmax = function(value, min, max) {
        if(parseInt(value) < min || isNaN(parseInt(value))) 
            return min; 
        else if(parseInt(value) > max) 
            return max; 
        else 
            return value;
    };

    window.localListen(UI.avgBitrate, 'blur', function () {
        UI.avgBitrate.value = minmax(UI.avgBitrate.value, 4, 310);
    });
    
    // fill presets
    let sl = newStringList();
    for(let i = 0; i < Presets.length; i++) {
        sl.add(Presets[i]);
    }
    UI.presets.controlClass.dataSource = sl;
    UI.presets.controlClass.focusedIndex = presetId;
    
    // fill sample types
    sl = newStringList();
    for(let i = 0; i < SampleTypes.length; i++)
        sl.add(SampleTypes[i]);
    UI.samplerate.controlClass.dataSource = sl;

    window.localListen(UI.samplerate, 'change', function () {
        saveLastBitrateMode();
        let idx = UI.samplerate.controlClass.focusedIndex;
        if(idx == 0)
            fillCBR();
        else if(idx == 1)
            fillVBR();
        else if(idx == 2)
            fillABR();            
        currentManualBitrateMode = idx;
    });
    UI.samplerate.controlClass.focusedIndex = bitrateType;

    // fill channels
    sl = newStringList();
    for(let i = 0; i < Channels.length; i++) 
        sl.add(Channels[i]);
    UI.channels.controlClass.dataSource = sl;
    UI.channels.controlClass.focusedIndex = channels;
    
    // fill sample rates
    let sampleRateIdx = 0;
    sl = newStringList();
    for(let i = 0; i < SampleRates.length; i++) {
        sl.add(SampleRates[i]); 
        if(SampleRatesInt[i] == sampleRate)
            sampleRateIdx = i;
    }
    UI.cbSampleRate.controlClass.dataSource = sl;
    
    // fill encoding quality
    sl = newStringList();
    for(let i = 0; i < EncodingQuality.length; i++)
        sl.add(EncodingQuality[i]);
    UI.cbEncQuality.controlClass.dataSource = sl;
    UI.cbEncQuality.controlClass.focusedIndex = quality;
    
    // fill min/max bitrate
    let idx1 = 0;
    let idx2 = 0;
    sl = newStringList();
    sl.add(_('No limit'));
    for(let i = 0; i < CBRbps.length; i++) {
        sl.add(CBRbps[i]);
        if(CBRbps[i] == minBitRate)
            idx1 = i+1;
        if(CBRbps[i] == maxBitRate)
            idx2 = i+1;
    }
    UI.cbBitrateMin.controlClass.dataSource = sl.getCopy();
    UI.cbBitrateMax.controlClass.dataSource = sl;
    UI.cbBitrateMin.controlClass.focusedIndex = idx1;
    UI.cbBitrateMax.controlClass.focusedIndex = idx2;
    
    // VBR method
    sl = newStringList();
    for(let i = 0; i < VBRMethods.length; i++) 
        sl.add(VBRMethods[i]);
    UI.cbVBRMethod.controlClass.dataSource = sl;
    UI.cbVBRMethod.controlClass.focusedIndex = VBRMethod;
    
    UI.chbUseBitReservoir.controlClass.checked = bitReservoir;
    UI.chbStrictISOCompliance.controlClass.checked = strictISO;

    setVisibilityFast(UI.groupbox, useAdvanced);
    if(useAdvanced) {
        UI.cbBitrateMax.controlClass.calcAutoWidth();
        UI.cbBitrateMin.controlClass.calcAutoWidth();
    }
    window.localListen(UI.rbAdvanced, 'click', function () {
        setVisibilityFast(UI.groupbox, UI.rbAdvanced.controlClass.checked);
        if(UI.rbAdvanced.controlClass.checked) {
            UI.cbBitrateMax.controlClass.calcAutoWidth();
            UI.cbBitrateMin.controlClass.calcAutoWidth();
        }
    });
               
    window.localListen(UI.btnOK, 'click', function () {
        
        saveLastBitrateMode();
        let bMin = UI.cbBitrateMin.controlClass.focusedIndex;
        let bMax = UI.cbBitrateMax.controlClass.focusedIndex;
        
        window.outData = (UI.rbPresets.controlClass.checked ? 'true':'false')+ '|' +
                         UI.presets.controlClass.focusedIndex + '|' +
                         ((bMin == 0) ? '0' : CBRbps[bMin-1]) + '|' +
                         ((bMax == 0) ? '0' : CBRbps[bMax-1]) + '|' +
                         UI.cbEncQuality.controlClass.focusedIndex + '|' +
                         UI.samplerate.controlClass.focusedIndex + '|' +
                         VBRQual + '|' +
                         ABR + '|' +
                         (UI.rbAdvanced.controlClass.checked ? 'true':'false') + '|' +
                         UI.cbVBRMethod.controlClass.focusedIndex + '|' +
                         (UI.chbUseBitReservoir.controlClass.checked ? 'true':'false') + '|' +
                         (UI.chbStrictISOCompliance.controlClass.checked ? 'true':'false') + '|' +
                         (justApplyMP3Gain ? 'true':'false') + '|' +
                         UI.channels.controlClass.focusedIndex + '|' +
                         SampleRatesInt[UI.cbSampleRate.controlClass.focusedIndex] + '|' +
                         bitRate;
        closeWindow();
    });

    let enableManual = function (en) {
        UI.presets.controlClass.disabled = en;
        UI.manual.controlClass.disabled = !en;
    };
    
    window.localListen(UI.rbPresets, 'click', function () {
        enableManual(false);
    });
    
    window.localListen(UI.rbManual, 'click', function () {
        enableManual(true);
    });    
    
    if (usePreset) {
        UI.rbPresets.controlClass.checked = true;
        enableManual(false);
    } else {
        UI.rbManual.controlClass.checked = true;
        enableManual(true);
    }
        
    if(useAdvanced) {
        UI.rbAdvanced.controlClass.checked = true;
    }
    UI.cbSampleRate.controlClass.focusedIndex = sampleRateIdx;
    notifyLayoutChange();
};