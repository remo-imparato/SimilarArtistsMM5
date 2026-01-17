/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";
requirejs("utils");

let checkDivs = undefined;
let plsett = undefined;
let statusEl = undefined;
let plEl = undefined;

optionPanels.pnl_Layouts.subPanels.pnl_LayoutPlaying.load = function (sett, pnlDiv) {
    pnlDiv.setAttribute('data-help', 'Customizing_MediaMonkey#Customizing_Playing');
    let mainWnd = app.dialogs.getMainWindow();
    plEl = mainWnd.getValue('qid')('nowplayinglistContainer');
    if (!plEl) {
        pnlDiv.innerHTML = '<label>' + _('\'Playing\' list') + ' ' + _('not found!') + '</label>';
        return;
    }
    let items = plEl.controlClass.dockMenuItems;
    if (!isArray(items)) {
        items = items.submenu;
    }
    if (isFunction(items)) {
        items = items();
    }

    checkDivs = divFromSimpleMenu(pnlDiv, items);
    statusEl = document.createElement('div');
    statusEl.innerText = _('Status bar');
    plsett = app.getValue('Playing_options', {statusbar: true});
    pnlDiv.appendChild(statusEl);
    statusEl.controlClass = new Checkbox(statusEl, {
        type: 'checkbox',
        checked: plsett.statusbar,
    });
    
    let updateStatusSettingVisibility = function () {
        if(checkDivs && items) {
            let foundIdx = -1;
            let chdiv;
            for(let i =0; i<checkDivs.length; i++) {
                chdiv = checkDivs[i];
                if(chdiv.div.controlClass.checked) {
                    foundIdx = i;
                    break;
                }
            }
            if(foundIdx >= 0) {
                setVisibilityFast(statusEl, !!items[foundIdx].statusbar);
            }
        } else
            setVisibilityFast(statusEl, false);
    };
    updateStatusSettingVisibility();
    window.localListen(pnlDiv, 'change', updateStatusSettingVisibility);
    window.localListen(statusEl, 'change', function() {
        if(plEl && plEl.controlClass)
            plEl.controlClass.updateStatusbarVisibility(statusEl.controlClass.checked);
    });
}

optionPanels.pnl_Layouts.subPanels.pnl_LayoutPlaying.cancel = function (sett) {
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
    if(plEl && plEl.controlClass)
        plEl.controlClass.updateStatusbarVisibility();    
}

optionPanels.pnl_Layouts.subPanels.pnl_LayoutPlaying.save = function (sett) {
    if(isVisible(statusEl) && plEl) {
        plsett.statusbar = statusEl.controlClass.checked;
        app.setValue('Playing_options', plsett);
    }
    if(plEl && plEl.controlClass)
        plEl.controlClass.updateStatusbarVisibility();
}

optionPanels.pnl_Layouts.subPanels.pnl_LayoutPlaying.beforeWindowCleanup = function () {
    checkDivs = undefined;
    plsett = undefined;
    statusEl = undefined;
    plEl = undefined;    
}
