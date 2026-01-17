/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

requirejs('controls/trackListView');

optionPanels.pnl_Library.subPanels.pnl_Appearance.load = function (sett) {
    let cbMultiSep = qid('cbMultiSep');
    cbMultiSep.controlClass.value = sett.Appearance.MultiStringSeparator;
    //qid('chbShowTrackToolTip').controlClass.checked = sett.Appearance.ShowTrackToolTip;
    //qid('chbM3UComp').controlClass.checked = sett.Tree.ShowM3Us;

    qid('chbIgnorePrefixes').controlClass.checked = sett.Options.IgnoreTHEs;
    qid('cbIgnorePrefixes').controlClass.value = sett.Options.IgnoreTHEStrings;

    let _updateIgnoredPrefixes = () => {
        var set = window.settings.get('Options');
        var selectedMasks = set.Options.IgnorePrefixFields.split(';');
        var flds = '';
        forEach(selectedMasks, (mask, i) => {
            var fld = app.masks.mask2VisMask(mask);
            fld = fld.substr(1, fld.length - 2); // '<Artist>' -> 'Artist'
            if (i == 0)
                flds = flds + fld;
            else
                flds = flds + ', ' + fld;
        });
        qid('lblIgnorePrefixFields').textContent = flds;
    }
    _updateIgnoredPrefixes();

    localListen(qid('btnChooseIgnorePrefixFields'), 'click', function () {
        let w = uitools.openDialog('dlgChooseFields', {
            modal: true,
            maskSet: 'removePrefixTheFields',
            left: thisWindow.bounds.left,
            top: thisWindow.bounds.top, // LS: Don't use window.top, it contains window object by standards (returns a reference to the topmost window in the window hierarchy)
            width: 400, // #17649
            height: thisWindow.bounds.height,
            config: {
                trackType: false,             
                sortable: false
            }
        });
        app.listen(w, 'closed', _updateIgnoredPrefixes);
    });
    addEnterAsClick(window, qid('btnChooseIgnorePrefixFields'));

    bindDisabled2Checkbox(qid('cbIgnorePrefixes'), qid('chbIgnorePrefixes'));
    bindDisabled2Checkbox(qid('lblIgnorePrefix'), qid('chbIgnorePrefixes'));
    bindDisabled2Checkbox(qid('lblIgnorePrefixFields'), qid('chbIgnorePrefixes'));
    bindDisabled2Checkbox(qid('btnChooseIgnorePrefixFields'), qid('chbIgnorePrefixes'));
    
    let i;
    for (i = 1; i <= 10; i++) {
        qid('edtCustom' + i).controlClass.value = sett.CustomFields['Fld' + i + 'Name'];
    }
    let re = new RegExp('^( ?\\S ?)$');

    let autoAdjustSeparator = function (sep) {
        let cnt = sep.length;
        let ch0 = '';
        let ch1 = '';
        let ch2 = '';
        for (let i = 0; i < cnt; i++) {
            if (sep[i] === ' ') {
                if (!ch0) {
                    if (!ch1)
                        ch0 = ' ';
                    else
                        ch2 = ' ';
                } else if (ch1)
                    ch2 = ' ';
            } else
            if (!ch1)
                ch1 = sep[i];
        };
        if (!ch1)
            return '; '; // no valid character, reset to default
        return ch0 + ch1 + ch2;
    };

    localListen(cbMultiSep, 'change', function () {
        let val = cbMultiSep.controlClass.value;
        if (!re.test(val) && (cbMultiSep.controlClass.edit !== document.activeElement)) {
            cbMultiSep.controlClass.value = autoAdjustSeparator(val);
        }
    });

    let colSett = app.getValue('sharedColumns_Settings', {mode: 'perNode'});
    let mode = colSett.mode;
    if (mode == 'perNode')
        qid('perNode').controlClass.checked = true;
    else
    if (mode == 'perCollection')
        qid('perCollection').controlClass.checked = true;
    else
    if (mode == 'perCollections')
        qid('perCollections').controlClass.checked = true;
}

optionPanels.pnl_Library.subPanels.pnl_Appearance.save = function (sett) {
    sett.Appearance.MultiStringSeparator = qid('cbMultiSep').controlClass.value;
    //sett.Appearance.ShowTrackToolTip = qid('chbShowTrackToolTip').controlClass.checked;
    //sett.Tree.ShowM3Us = qid('chbM3UComp').controlClass.checked;

    sett.Options.IgnoreTHEs = qid('chbIgnorePrefixes').controlClass.checked;
    sett.Options.IgnoreTHEStrings = qid('cbIgnorePrefixes').controlClass.value;

    for (var i = 1; i <= 10; i++) {        
        let val = qid('edtCustom' + i).controlClass.value;
        let maskVal = '<' + val + '>';
        if (maskVal == app.masks.visMask2Mask( maskVal) || val.toLowerCase().startsWith('custom')) // not used field (#20606 - item 2)        
            sett.CustomFields['Fld' + i + 'Name'] = val;
    }

    let colSett = app.getValue('sharedColumns_Settings', {mode: 'perNode'});  
    if (qid('perNode').controlClass.checked)
        colSett.mode = 'perNode';
    else
    if (qid('perCollection').controlClass.checked)
        colSett.mode = 'perCollection';
    else
    if (qid('perCollections').controlClass.checked)
        colSett.mode = 'perCollections';

    app.setValue('sharedColumns_Settings', colSett);
}
