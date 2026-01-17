/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";
requirejs('utils');
requirejs('helpers/skinConfig');

let selectSkinPath;
let currentConfig;

optionPanels.pnl_Layouts.subPanels.pnl_LayoutSkin.load = function (sett, pnlDiv, wndParams) {
    pnlDiv.setAttribute('data-help', 'Customizing MediaMonkey#Customizing the Skin');
    let items = window.uitools.getSkins();
    forEach(items, (itm) => {
        itm.execute = function () {
            selectSkinPath = this.fullPath;
            displayAddonConfig(this);
        }
		// #18483 If this panel was opened from View > Skin submenu, open the selected skin instead of the current skin
		if (wndParams && wndParams.selectedSkinId) {
			if (itm.id === wndParams.selectedSkinId) {
				if (!itm.checked) selectSkinPath = itm.fullPath; // If skin isn't currently used
				itm.checked = true;
			}
			else 
				itm.checked = false;
		}
    })
    divFromSimpleMenu(pnlDiv, items);
    
    let fullSkinsList = app.getAddonList( 'skins', 'all', 'justInstalled');
    
    fullSkinsList.whenLoaded()
    .then(() => {
        // Assign each addon's full info to the items list, so to get its config files
        fullSkinsList.forEach(skin => {
            forEach(items, (itm) => {
                // This is a nested loop; only run this code when the "itm" matches the "skin"
                if (itm.fullPath === skin.path) {
                    itm.addon = skin;
                    
                    // Show the config panel if it's already selected
                    if (itm.checked === true) {
                        displayAddonConfig(itm);
                    }
                }
            })
        });
    });
    
    // Hide the currently-shown config panel
    function hideAddonConfig() {
        if (currentConfig) {
            currentConfig.style.display = 'none';
            currentConfig = undefined;
        }
    }
    
    // Hide current addon config, then display an addon config by either un-hiding it or loading it
    function displayAddonConfig(itm) {
        let addon = itm.addon;
        hideAddonConfig();
        if (addon) {
            let alreadyLoadedConfig = qeid(pnlDiv, fixQuerySelector(addon.ext_id));
            if (alreadyLoadedConfig) {
                alreadyLoadedConfig.style.display = '';
                currentConfig = alreadyLoadedConfig;
            }
            // Auto generated skin options
            else if (addon.skinOptions) {
                generateAddonConfig(itm);
            }
            // Custom skin options
            else if (addon.hasConfig && addon.configFile) {
                loadAddonConfig(addon);
            }
        }
    }
    
    // Remove any invalid characters from a query selector
    function fixQuerySelector(string) {
        return string.replace(/ /g, '-').replace(/[^_a-zA-Z0-9-]/g, '');
    }
    
    // Generate an addon config from the skin_options object inside info.json.
    function generateAddonConfig(itm) {
		let {parent, pnl} = createAddonConfigContainer(itm.addon);
		currentConfig = parent;
		
		generateSkinConfig(itm.addon, {parent, pnl});
    }
    
    function createAddonConfigContainer(addon) {
        // Container for the options panel
        let parent = document.createElement('fieldset');
        let legend = document.createElement('legend');
        parent.classList.add('marginsColumn');
        legend.innerText = _(addon.title);
        
        parent.appendChild(legend);
        parent.setAttribute('data-id', fixQuerySelector(addon.ext_id)); // So we can access it when it's hidden
        
        let pnl = document.createElement('div');
        pnl.classList.add('marginsColumn', 'uiRows');
        parent.appendChild(pnl);
		
		pnlDiv.appendChild(parent);
        
        return {parent, pnl};
    }
    
    function loadAddonConfig(addon) {        
        requirejs(addon.configFile, null, null, null, true );
        if (typeof window.configInfo === 'object' && typeof window.configInfo.load === 'function' && typeof window.configInfo.save === 'function') {
            
            let {parent, pnl} = createAddonConfigContainer(addon);
            
            pnl.innerHTML = window.loadFile(removeFileExt(addon.configFile) + '.html', undefined, {
                required: false // html is optional
            });
            initializeControls(pnl);
            
            currentConfig = parent;
    
            window.configInfo.load(pnl, addon);
            
            // Cache window.configInfo so we can retrieve it later even after it's overwritten
            parent.configInfo = window.configInfo;
            parent.configInfo.path = addon.path;
            parent.configInfo._save = () => {
                parent.configInfo.save(pnl, addon);
            }
    
        } else {
            messageDlg(_('Invalid Addon!') + '</br></br>' + 'window.configInfo must be defined, and window.configInfo.load and window.configInfo.save must be functions.', 'Error', ['btnOk'], {
                defaultButton: 'btnOk'
            }, undefined);
        }
    }
}

optionPanels.pnl_Layouts.subPanels.pnl_LayoutSkin.save = function (sett) {
    // If the skin is currently loaded, then run the skin's save method immediately
    if (currentConfig && currentConfig.configInfo && (!selectSkinPath || selectSkinPath == currentConfig.configInfo.path)) {
        let success = currentConfig.configInfo._save();
        
        if (!success) return console.error('currentConfig.configInfo._save() returned false, indicating that something went wrong with the saving process.');
    }
    
    if (selectSkinPath) {
        let mainWnd = app.dialogs.getMainWindow();
        mainWnd.getValue('uitools').activateSkin({
            path: selectSkinPath
        });
    }
}

optionPanels.pnl_Layouts.subPanels.pnl_LayoutSkin.cancel = function (sett) {

}

optionPanels.pnl_Layouts.subPanels.pnl_LayoutSkin.beforeWindowCleanup = function () {
    window.configInfo = undefined;
    if(currentConfig) {
        currentConfig.configInfo = undefined;
        currentConfig = undefined;
    }
}