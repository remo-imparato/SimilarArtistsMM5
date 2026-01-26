/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";
requirejs("utils");

let checkDivs = undefined;
let fontSizes = ['smallest', 'smaller', 'default', 'larger', 'largest'];

optionPanels.pnl_Layouts.subPanels.pnl_LayoutPreview.load = function (sett, pnlDiv) {
    pnlDiv.setAttribute('data-help', 'Customizing MediaMonkey#Customizing Preview');
    let mainWnd = app.dialogs.getMainWindow();
    let plEl = mainWnd.getValue('qid')('artWindow');
    if (!plEl) {
        pnlDiv.innerHTML = '<label>' + _('Preview control not found.') + '</label>';
        return;
    }
    let items = plEl.controlClass.dockMenuItems;
    if (!isArray(items)) {
        items = items.submenu;
    }
    if (isFunction(items)) {
        items = items();
    }

    if (!items) {
        pnlDiv.innerHTML = '<label>' + _('Preview layout cannot be set.') + '</label>';
        return;
    } else {
        pnlDiv.innerHTML = '<label class="uiRow">' + _('This panel element displays details of the playing or selected file') + '</label>'+      
        '<div data-id="boxFontSize" class="uiRow">'+
        '<label for="cbFontSize" data-add-colon>Font size</label>'+
        '<div data-id="cbFontSize" data-control-class="Dropdown" data-init-params="{readOnly: true}">'+
        '    <option>' + _('Smallest') + '</option>'+
        '    <option>' + _('Smaller') + '</option>'+
        '    <option>' + _('Default') + '</option>'+
        '    <option>' + _('Larger') + '</option>'+
        '    <option>' + _('Largest') + '</option>'+
        '</div>'+
        '</div>';
        initializeControls(pnlDiv);

        let s = app.getValue('artWindow', {
            fontSize: 'smaller'
        });
        qid('cbFontSize').controlClass.focusedIndex = fontSizes.indexOf(s.fontSize);       
    }
    
    checkDivs = divFromSimpleMenu(pnlDiv, items, _('Preview'));
}

optionPanels.pnl_Layouts.subPanels.pnl_LayoutPreview.cancel = function (sett) {
    if (checkDivs) {
        forEach(checkDivs, function (chdiv) {
            if (chdiv.isRadio) {
                if (chdiv.checked && (chdiv.div.controlClass.checked !== chdiv.checked)) {
                    chdiv.div.controlClass.checked = chdiv.checked;
                    chdiv.div.controlClass.radioChange();
                }
            } else {
                if (chdiv.div.controlClass.checked !== chdiv.checked) {
                    chdiv.div.controlClass.checked = chdiv.checked;
                    chdiv.div.controlClass.checkChange();
                }
            }
        });
    }
}

optionPanels.pnl_Layouts.subPanels.pnl_LayoutPreview.save = function (sett) {

    let s = app.getValue('artWindow', {
        fontSize: 'smaller',
        columnCount: 2
    });
    let focusedIndex = qid('cbFontSize').controlClass.focusedIndex;
    s.fontSize = fontSizes[focusedIndex];    
    app.setValue('artWindow', s);
    
    let plEl = app.dialogs.getMainWindow().getValue('qid')('artWindow');
    if (plEl && plEl.controlClass)
        plEl.controlClass.refresh(true); // to refresh also the layout (not only the data)

}

optionPanels.pnl_Layouts.subPanels.pnl_LayoutPreview.beforeWindowCleanup = function () {
    checkDivs = undefined;
}
