/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

function CPUCoresValue2String(NumCPUCores) {
    if (NumCPUCores == 0)
        return _('All');
    else
        return app.utils.convertProcessorsCount(NumCPUCores).toString();
}

function String2CPUCoresValue(StringCPUCores) {
    if (StringCPUCores == _('All'))
        return 0;
    else
        return parseInt(StringCPUCores);
}

optionPanels.pnl_General.subPanels.pnl_Performance.load = function (sett) {

    let _initCombos = () => {
        qid('edtCoresAutoConv').controlClass.value = CPUCoresValue2String(sett.Options._UseProcessorCores_AutoConvert);
        qid('edtCoresConv').controlClass.value = CPUCoresValue2String(sett.Options._UseProcessorCores_Convert);      
        qid('edtCoresVolumeAnal').controlClass.value = CPUCoresValue2String(sett.Options._UseProcessorCores_Leveling);
    }
    _initCombos();

    let _listenCombo = (comboId) => {
        localListen(qid(comboId), 'click', () => {
            if (!app.utils.isRegistered()) {
                window.uitools.showGoldMessage(_('Please upgrade to MediaMonkey Gold for this feature!'));
                _initCombos();
            }
        });
    }
    _listenCombo('edtCoresAutoConv');
    _listenCombo('edtCoresConv');    
    _listenCombo('edtCoresVolumeAnal');

    qid('edtThreadPriority').controlClass.focusedIndex = sett.Options.DefaultThreadPriority;
    //qid('chbSmoothScroll').controlClass.checked = sett.Appearance.SmoothScroll; // removed per #20772
    qid('chbHWAcceleration').controlClass.checked = !sett.System.DisableGPU;
    qid('chbHWAcceleration').controlClass.text = _('Use hardware acceleration when available') + ' ' + _('(requires restart)');
}

optionPanels.pnl_General.subPanels.pnl_Performance.save = function (sett) {
    sett.Options._UseProcessorCores_AutoConvert = String2CPUCoresValue(qid('edtCoresAutoConv').controlClass.value);
    sett.Options._UseProcessorCores_Convert = String2CPUCoresValue(qid('edtCoresConv').controlClass.value);    
    sett.Options._UseProcessorCores_Leveling = String2CPUCoresValue(qid('edtCoresVolumeAnal').controlClass.value);
    sett.Options.DefaultThreadPriority = qid('edtThreadPriority').controlClass.focusedIndex;
    //sett.Appearance.SmoothScroll = qid('chbSmoothScroll').controlClass.checked;
    sett.System.DisableGPU = !qid('chbHWAcceleration').controlClass.checked;
}
