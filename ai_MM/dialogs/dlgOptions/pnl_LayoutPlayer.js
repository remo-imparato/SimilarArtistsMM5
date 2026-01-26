/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";
requirejs("utils");

let checkDivs = undefined;

optionPanels.pnl_Layouts.subPanels.pnl_LayoutPlayer.load = function (sett, pnlDiv) {
    pnlDiv.setAttribute('data-help', 'Player#Customizing_the_Player');
    let mainWnd = app.dialogs.getMainWindow();
    let plPanel = mainWnd.getValue('qid')('mainPlayer');
    let plEl = undefined;
    if (plPanel) {
        plEl = qe(plPanel, '[data-control-class=Player]');
    } else {
        pnlDiv.innerHTML = '<label>' + _('Player panel not found.') + '</label>';
        return;
    }
    if (!plEl) {
        pnlDiv.innerHTML = '<label>' + _('Player control not found.') + '</label>';
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
        pnlDiv.innerHTML = '<label>' + _('Player layout cannot be set.') + '</label>';
        return;
    }
    
    checkDivs = divFromSimpleMenu(pnlDiv, items);
}

optionPanels.pnl_Layouts.subPanels.pnl_LayoutPlayer.cancel = function (sett) {
    if(checkDivs) {
        forEach(checkDivs, function (chdiv) {
            if(chdiv.isRadio) {
                if (chdiv.checked && (chdiv.div.controlClass.checked !== chdiv.checked)) {
                    chdiv.div.controlClass.checked = chdiv.checked;
                    chdiv.div.controlClass.radioChange();
                }
            } else {
                if(chdiv.div.controlClass.checked !== chdiv.checked) {
                    chdiv.div.controlClass.checked = chdiv.checked;
                    chdiv.div.controlClass.checkChange();
                }
            }
        });
    }
}

optionPanels.pnl_Layouts.subPanels.pnl_LayoutPlayer.save = function (sett) {

}

optionPanels.pnl_Layouts.subPanels.pnl_LayoutPlayer.beforeWindowCleanup = function () {
    checkDivs = null;
}
