/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

'use strict';
// This helper file is for creating auto-generated skin configs in either tools > options > layout > skin or tools > addons.
(() => {
    let pxVars = ['@baseFontSize', '@borderWidth', '@windowBorderSize'];
    let pxVarsA = {};
    pxVars.forEach((varName) => {
        pxVarsA[varName] = true;
    })
    /**
     * Element hierarchy: pnlDiv > parent > pnl > row > label and other controls
     * @param {Addon} addon Addon info object
     */
    window.generateSkinConfig = function(addon, {parent, pnl}) {
        var skinOptions = addon.skinOptions;
        if (skinOptions) skinOptions = JSON.parse(skinOptions);
        
        assert(skinOptions instanceof Array, 'skin_options must be an array, if provided.');
        
        var userSetOptions = app.getValue(`${addon.ext_id}_skinOptions`, {});
        
        // Generate controls for each item in the skin options array
        for (let i in skinOptions) {
            let option = skinOptions[i];
            assert(typeof option === 'object', 'Each option in skin_options must be an object.');
            assert(option.hasOwnProperty('type'), 'Each option in skin_options must contain a property "type".');
            assert(option.hasOwnProperty('default'), 'Each option in skin_options must contain a property "default".');
            assert(option.hasOwnProperty('title'), 'Each option in skin_options must contain a property "title".');
            
            let row = document.createElement('div');
            
            let label = document.createElement('div');
            label.innerHTML = `<label>${_(option.title)}:</label>`;
            row.appendChild(label);
            
            let userSetOption;
            if (option.type === 'radio') {
                // Generate key based on the title
                userSetOption = userSetOptions[`radio_${titleToKey(option.title)}`];
            }
            else {
                // Generate a key based on the variable and type
                userSetOption = userSetOptions[`${option.type}_${option.variable}`];
            }
            let defaultValue = (userSetOption) ? userSetOption : option.default;
            
            option.type = option.type.toLowerCase();
            option.optionID = createUniqueID(); // Unique name for each option (radiogroup or otherwise)
            
            // Control varies depending on the type
            if (option.type === 'radio') {
                // Radio buttons
                let radioList = option.options;
                
                let radioParent = document.createElement('div');
                radioParent.classList.add('left-indent', 'uiRows');
                
                for (let key in radioList) {
                    
                    let initParams = JSON.stringify({
                        type: 'radio', 
                        value: key,
                        name: option.optionID,
                        checked: (key === defaultValue)
                    });
                    
                    let radioDiv = document.createElement('div');
                    radioDiv.innerHTML = '<div data-control-class="Checkbox" data-init-params=\'' + initParams +
                        '\'' + 'data-group-id=\'' + option.optionID +
                        '\'>' + _(radioList[key].title) + '</div>';
                    initializeControls(radioDiv);
                    radioParent.appendChild(radioDiv);
                    
                    radioList[key].uniqueID = radioDiv.firstElementChild.getAttribute('data-uniqueid');
                }
                
                row.appendChild(radioParent);
            }
            else if (option.type === 'dropdown') {
                // Dropdowns
                assert(option.hasOwnProperty('variable'), 'Dropdown option must have property "variable" (for LESS variable it controls)');
                let dropdownList = option.options;
                assert(typeof dropdownList === 'object', 'Dropdown option must have property "options", either an object or array.');
                
                let initParams = JSON.stringify({
                    readOnly: true
                });
                
                let dropdown = document.createElement('div');
                dropdown.setAttribute('data-control-class', 'Dropdown');
                dropdown.setAttribute('data-init-params', initParams);
                dropdown.setAttribute('data-id', option.optionID);
                initializeControl(dropdown);
                
                // List can be either an array of values or an object of value:labels
                if (dropdownList instanceof Array) {
                    dropdown.controlClass.items = dropdownList.join(',');
                    dropdown.controlClass.value = defaultValue;
                }
                else {
                    // {1: 'One', 2: 'Two', 3: 'Three'} becomes ['One', 'Two', 'Three']
                    let itemsArr = [];
                    for (let key in dropdownList) {
                        itemsArr.push(dropdownList[key]);
                    }
                    dropdown.controlClass.items = itemsArr.join(',');
                    dropdown.controlClass.value = dropdownList[defaultValue];
                }
                
                label.appendChild(dropdown);
            }
            else if (option.type === 'color') {
                // Color pickers
                assert(option.hasOwnProperty('variable'), 'Color option must have property "variable" (for LESS variable it controls)');
                
                let initParams = JSON.stringify({
                    size: 200,
                    value: defaultValue
                });
                
                let pickerParent = document.createElement('div');
                pickerParent.classList.add('paddingLeft');
                
                let picker = document.createElement('div');
                picker.setAttribute('data-control-class', 'ColorPicker');
                picker.setAttribute('data-init-params', initParams);
                picker.setAttribute('data-id', option.optionID);
                
                pickerParent.appendChild(picker);
                row.appendChild(pickerParent);
                
                // Color pickers need to be added to HTML before they are initialized
                requestFrame(() => {
                    initializeControl(picker);
                });
            }
            else {
                myAlert(`Unsupported skin option type "${option.type}"`);
            }
            
            pnl.appendChild(row);
        }
        
        let resetRow = document.createElement('div');
        resetRow.innerHTML = '<div data-id="btnReset" data-control-class="Button" class="marginTop">Reset changes</div>';
        initializeControls(resetRow);
        pnl.appendChild(resetRow);
        
        // Reset controls to defaults
        localListen(qeid(pnl, 'btnReset'), 'click', function () {
            for (let i in skinOptions) {
                let option = skinOptions[i];
                let defaultValue = option.default;
                
                if (option.type === 'radio') {
                    if (option.options[defaultValue]) {
                        q(`[data-uniqueid=${option.options[defaultValue].uniqueID}]`).controlClass.checked = true;
                    }
                }
                else if (option.type === 'dropdown') {
                    if (option.options instanceof Array) {
                        qid(option.optionID).controlClass.value = defaultValue;
                    }
                    else {
                        qid(option.optionID).controlClass.value = option.options[defaultValue];
                    }
                }
                else if (option.type === 'color') {
                    qid(option.optionID).controlClass.value = defaultValue;
                }
            }
        });
        addEnterAsClick(window, qeid(pnl, 'btnReset'));
        parent.configInfo = {
            path: addon.path,
            // Apply skin settings to custom LESS
            _save: function () {
                var variablesToSet = {};
                var userSetOptions = {};
                
                for (let i in skinOptions) {
                    let option = skinOptions[i];
                    
                    if (option.type === 'radio') {
                        let radioList = document.querySelectorAll(`[data-group-id=${option.optionID}]`);
                        for (let radio of radioList) {
                            if (radio.controlClass.checked === true) {
                                let value = radio.controlClass.value;
                                let selectedOption = option.options[value];
                                for (let key in selectedOption.variables) {
                                    variablesToSet[key] = selectedOption.variables[key];
                                }
                                userSetOptions[`radio_${titleToKey(option.title)}`] = value;
                            }
                        }
                    }
                    else if (option.type === 'dropdown') {
                        let dropdownList = option.options;
                        let dropdown = qid(option.optionID);
                        let value;
                        
                        if (dropdownList instanceof Array) {
                            value = dropdown.controlClass.value;
                        }
                        else {
                            // Get the variable VALUE for whatever is selected
                            for (let key in dropdownList) {
                                if (String(dropdownList[key]) === dropdown.controlClass.value) {
                                    value = key;
                                }
                            }
                        }
                        
                        if (value) {
                            variablesToSet[option.variable] = value;
                            userSetOptions[`dropdown_${option.variable}`] = value;
                        }
                    }
                    else if (option.type === 'color') {
                        let value = qid(option.optionID).controlClass.value;
                        
                        let doSetColor = true;
                        
                        // visibilityCheck option is a color to compare the chosen color against, to ensure visibility of all elements
                        if (typeof option.visibilityCheck === 'string') {
                            if (qid(option.optionID).controlClass.isSimilarTo(option.visibilityCheck)) {
                                doSetColor = false;
                                messageDlg(_('The color combination you chose would result in text being unreadable. Please choose a different color combination.'), 
                                    'Error',
                                    ['btnOK'], 
                                    {defaultButton: 'btnOK'},
                                    undefined
                                );
                                // Indicate that the variable setting failed
                                return false;
                            }
                        }
                        
                        if (doSetColor) {
                            variablesToSet[option.variable] = value;
                            userSetOptions[`color_${option.variable}`] = value;
                        }
                    }
                }
                
                // #21066: JL: Non-pixel numerical values should not be saved as px; instead, "px" should now be included in skin_config as necessary
                // Turn numerical values into #px, because if line-height is fed a raw number, it'll be unnaturally big
                for (let key in variablesToSet) {
                    if (variablesToSet[key] && pxVarsA[key] && !isNaN(variablesToSet[key])) {
                        variablesToSet[key] = variablesToSet[key] + 'px';
                    }
                }
                
                // Save the user-set options for next time
                app.setValue(`${addon.ext_id}_skinOptions`, userSetOptions);
                
                // Set custom LESS
                setLessValues(variablesToSet, addon.ext_id, true);
                
                // If everything passes, return true to indicate that the variable setting was a success.
                return true;
            }
        }
    }
    
    function titleToKey(title) {
        return title.toLowerCase().replace(/\s/g, '_').replace(/\W/g, '')
    }
})();