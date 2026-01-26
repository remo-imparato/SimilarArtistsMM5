/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";
requirejs('helpers/skinConfig');

function init(params) {
    let wnd = this;
    wnd.resizeable = true;

    let calledInternally = (wnd.setResult != undefined); /* when called from EXE during installAddonAsync */

    let item;
    if (calledInternally)
        item = wnd.addon;
    else {
        assert(params && params.addon, 'params.addon not defined');
        item = params.addon;
    }

    wnd.title = _('Addon Configuration') + ' | ' + item.title;
    
    let parent = qid('pnlContent');
    
    window.configInfo;
    
    // Normal addons with configFile
    if (item.configFile) {
        requirejs(item.configFile, null, null, null, true /* reload - #17831 */ );
        
        if (typeof window.configInfo === 'object' && typeof window.configInfo.load === 'function' && typeof window.configInfo.save === 'function') {
    
            let pnl = document.createElement('div');
            pnl.innerHTML = window.loadFile(removeFileExt(item.configFile) + '.html', undefined, {
                required: false // html is optional
            });
            parent.appendChild(pnl);
            initializeControls(pnl);
    
            window.configInfo.load(pnl, item);
    
            window.localListen(qid('btnOK'), 'click', function () {
                window.configInfo.save(pnl, item);
                if (calledInternally) {
                    let res = {
                        btnID: 'btnOK'
                    };
                    wnd.setResult(res);
                }
                closeWindow();
            });
    
        } else {
            messageDlg(_('Invalid Addon!') + '</br></br>' + 'window.configInfo must be defined, and window.configInfo.load and window.configInfo.save must be functions.', 'Error', ['btnOk'], {
                defaultButton: 'btnOk'
            }, () => {
                if (calledInternally) {
                    let res = {
                        btnID: 'btnCancel'
                    };
                    wnd.setResult(res);
                }
                closeWindow();
            });
        }
    }
    // Skins with skin_options in info.json
    else if (item.skinOptions) {
        
        // Container for the options panel
        let fieldset = document.createElement('fieldset');
        let legend = document.createElement('legend');
        fieldset.classList.add('marginsColumn');
        legend.innerText = _(item.title);
        
        let pnl = document.createElement('div');
        pnl.classList.add('marginsColumn', 'uiRows');
        
        fieldset.appendChild(legend);
        fieldset.appendChild(pnl);
        parent.appendChild(fieldset);
        
        generateSkinConfig(item, {parent: fieldset, pnl});
        
        window.localListen(qid('btnOK'), 'click', function () {
            let success = fieldset.configInfo._save();
            
            if (!success) return console.error('fieldset.configInfo._save() returned false, indicating that something went wrong with the saving process.');
            
            // If called internally, skin activation will be handled natively
            if (calledInternally) {
                let res = {
                    btnID: 'btnOK'
                };
                wnd.setResult(res);
            }
            else {
                let mainWnd = app.dialogs.getMainWindow();
                mainWnd.getValue('uitools').activateSkin({
                    path: item.path
                });
            }
            closeWindow();
        });
    }

    if (calledInternally)
        wnd.showModal();
}

window.windowCleanup = function () {
    window.configInfo = undefined;
}