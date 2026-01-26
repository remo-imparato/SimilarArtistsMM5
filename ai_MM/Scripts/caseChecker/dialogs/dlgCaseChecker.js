/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// MediaMonkey Case Checker script
// Based on VBS script TitleCase written by Risser
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

// Purpose:
// - To update case on Artist, Album Artist, Album and Song Title fields.
//
// Notes:
// - This script writes tags then immediately updates the DB.  There is no
//   impact on the DB for tracks that are not part of the library (particularly, 
//   the tracks are not auto-added to the library)
// - If you update an Artist name or an Album name, it updates the name in the 
//   database and this change is reflected for all instances of that name, even 
//   if it wasn't one of the selected tracks.
// - It's pretty smart about the location of punctuation, roman numerals, foreign contractions 
//   (d', l', etc.), initials, cardinal numbers (1st, 40th), years (1950s, 1960's) and words with 
//   no vowels, but it's not perfect.
// - There are also two pipe-separated (|) lists of words.  One is a "little" words list, like "the", 
//   "an", "a", "of" etc.  If there's a word you'd like treated like a little word (maybe "on" or 
//   "by", or other words if your tags aren't english), add it to the list.
// - The second list is a list of "forced-case" words.  If the parser sees this word in any case, it 
//   replaces it with the word in the list, making it exactly that case.  This is good for acronyms 
//   with vowels (BTO, REM, ELO; CCR and CSN have no vowels, so they are auto-uppercased), things that 
//   need to stay lower case, or abbreviations with no vowels that should be uppercase, like Dr, Mr, 
//   Mrs, St, etc.  Feel free to change these lists to match your collection.
// - It treats apostrophes as a letter, so these can be included in a word.  For example, for "James 
//   Brown and the JB's", I have "JB's" and "JBs" in my forced case list.  
// - Also, on the forced case list, you can specify a final piece of punctuation.  Thus, I have "w/", 
//   which will lowercase "w/", but leave "W" alone to be uppercase.  Also, I have "silence]" which 
//   will force that configuration to be lowercase (for tracks that are all silence), but will treat 
//   "Silence" normally.
//


"use strict";
requirejs('controls/trackListView');
requirejs('animationTools');

var littleWordString = "a|an|and|at|de|del|di|du|e|el|en|et|for|from|la|le|in|n|'n|n'|'n'|o'|'o'|of|or|por|the|to|un|une|und|with|vs|ft|feat|aka|vol|w/|y";
var forceCapString = "AC|EBN|OZN|MCs|MC's|DJs|DJ's|JBs|JB's|10cc|Mr|Mrs|Dr|Jr|Sr|Pt|St.|St|ABC|ABCs|AC/|ASCII|ASCIII|ATV|BTO|ELO|ELP|EMI|EP|DuShon|FYC|INXS|MacArthur|OMC|OMD|OMPS|PSI|PTA|REM|REO|Sgt|UB40|UK|USA|USMC|UTFO|T's|OK|USSR";
var customStrings = ''; // User-specified custom strings, updated when dialog loads
var customLittleWordStrings = ''; // #18292 suggested change #2

var res;

var alphaNum = new RegExp("['`´A-Za-z0-9" + String.fromCharCode(192) + "-" + String.fromCharCode(65276) + "]", "i");
var whiteSpace = new RegExp("^[\\s,&]+$"); //include comma, ampersand, because we don't want to cap after these

var isMc = new RegExp("^(O['`]|MC)", "i"); // handle O'Brien and McHenry
var vowels = new RegExp("[AEIOUY" + String.fromCharCode(192) + "-" + String.fromCharCode(601) + "]", "i");
var romanNumerals = new RegExp("^M*(C(M|D)|D?C{0,3})(X(C|L)|L?X{0,3})(I(X|V)|V?I{0,3})$", "i");
var cardinal = new RegExp("^\\d*(1st|2nd|3rd|[0-9]th|[0-9]['`]?s)$", "i"); //also handles years, like 1950s
var isForeignPref = new RegExp("^([dl]|dell)['`]", "i"); // handle l', d' and dell'
var doubleQuotes = new RegExp("[“”«»„“„”]", "g"); // Option to fix quotation marks & apostrophes for #18751
var singleQuotes = new RegExp("[‘’‚‹›`]", "g");

var littleWordList = littleWordString.split("|");
var forceCapList = forceCapString.split("|");
var customStringList = [];
var customLittleStringList = [];
var holds = []; // Remnant of the old caseChecker; used in actions_add.js
var newHolds = {}; // Automatically generated values by case checker 
var userTypedValues = {}; // Values that the user selected

var supportedTags = [
    ['artist', 'title', 'album', 'albumArtist'],
    ['genre', 'conductor', 'composer', 'director'],
    ['custom1', 'custom2', 'custom3', 'custom4', 'custom5'],
    ['custom6', 'custom7', 'custom8', 'custom9', 'custom10']
];
var defaultTags = ['artist', 'title', 'album', 'albumArtist'];
var enabledTags = [];

var sett = {};

var lvTracklist;

function uppercase(s) {
    var resultVal;
    if ((s.length > 1) && ((s[0] === "'") || (s[0] === "“"))) {
        resultVal = s[0] + s[1].toUpperCase() + s.substring(2).toLowerCase();
    } else {
        resultVal = s[0].toUpperCase() + s.substring(1).toLowerCase();
    }
    return resultVal;
};

function fixUp(s, prevChars, nextChar) {
    var i;
    var littleUpped, forceUpped;
    var forceIndex = -1;
    var littleIndex = -1;
    var capMe = false;
    var allCaps = false;
    var upcased = s.toUpperCase();
    var foreignPref = isForeignPref.test(s);
    
    if (sett.fixQuotes) {
        s = s.replace(doubleQuotes, '"');
        s = s.replace(singleQuotes, "'");
    }
    if (sett.useForceCaps) {
        for (i = 0; i < forceCapList.length; i++) {
            forceUpped = (forceCapList[i]).toUpperCase();
            if (((forceCapList[i]).toUpperCase() === upcased) || (forceUpped === upcased + nextChar)) {
                forceIndex = i;
                break;
            }
        }
    }
    if (sett.useLittleWords) {
        for (i = 0; i < littleWordList.length; i++) {
            littleUpped = (littleWordList[i]).toUpperCase();
            if ((littleUpped == upcased) || (littleUpped == upcased + nextChar)) {
                littleIndex = i;
                break;
            }
        }
    }
    if (forceIndex >= 0) {
        s = forceCapList[forceIndex];
    } else {
        if ((s.length === 1) && (nextChar === ".")) {
            // if it's a single character followed by a period (an initial), caps it
            allCaps = true;
        } else if (!vowels.test(s) && !cardinal.test(s) && (littleIndex < 0) /*issue with "ft."*/) {
            // if it's all consonants, no vowels, and not a cardinal number, caps it
            allCaps = true;
        } else if (romanNumerals.test(s) && (s.toUpperCase() !== "MIX") && (s.toUpperCase() !== "MI") && (s.toUpperCase() !== "DI")) {
            // if it's roman numerals (and not 'mix' or 'di' which are valid roman numerals), caps it
            allCaps = true;
        } else if ((prevChars === "") || ((nextChar === "") && !foreignPref)) {
            //if it's the first or last word, cap it
            capMe = true;
        } else if (!whiteSpace.test(prevChars) || ((nextChar != "") && ((")}]").indexOf(nextChar) >= 0))) {
            // if it follows a punctuation mark (with or without spaces) or if it's before a close-bracket, cap it
            capMe = true;
        } else if ((littleIndex < 0) && !foreignPref) {
            // if it's not on the 'little word' list, cap it
            capMe = true;
        }
        if (allCaps) {
            s = s.toUpperCase();
        } else if (capMe) {
            s = uppercase(s);
        } else {
            s = s.toLowerCase();
        };
        if (isMc.test(s) && (s.length > 2)) {
            // if it's Mc or O', cap the 3rd character (this assumes no names like McA)
            s = s.substring(0, 2) + s[2].toUpperCase() + s.substring(3).toLowerCase();
        }
        if (foreignPref) {
            // if it's l', d' or dell', lowercase the first letter and uppercase the first letter after the apostrophe
            var pos = s.indexOf("'");
            if (pos < 0) {
                pos = s.indexOf("`");
            }
            if ((pos >= 0) && (pos < (s.length - 1))) {
                s = s.substring(0, pos + 1) + s[pos + 1].toUpperCase() + s.substring(pos + 2).toLowerCase();
            }
        }
    }
    return s;
}

function updateCase(s) {
    var fixed, theChar;
    var forceIndex;
    var currentWord = "";
    var result = "";
    var lastNonWordChars = "";
    
    // First do per-word case checking
    for (var i = 0; i < s.length; i++) {
        theChar = s[i];
        if (alphaNum.test(theChar)) {
            currentWord = currentWord + theChar;
        } else {
            if (currentWord !== "") {
                fixed = fixUp(currentWord, lastNonWordChars, theChar);
                if (fixed.slice(-1) === theChar) { // handle stuff like w/
                    fixed = fixed.substring(0, fixed.length - 1);
                    lastNonWordChars = "";
                } else {
                    lastNonWordChars = theChar;
                }
                result = result + fixed;
                currentWord = "";
            } else {
                lastNonWordChars = lastNonWordChars + theChar;
            }
            result = result + theChar;
        }
    };
    if (currentWord.length > 0) {
        result = result + fixUp(currentWord, lastNonWordChars, "");
    }
    // Then go through user-set custom words
    result = applyCustomStrings(result);
    return result;
};

function applyCustomStrings(s) {
    
    var result = s;
    
    for (let customStr of customStringList) {
        let regex = new RegExp('(^|[^\\w])(' + escapeRegexCharacters(customStr) + ')($|[^\\w])', 'gi');
        result = result.replace(regex, '$1' + customStr + '$3');
    }
    
    for (let customStr of customLittleStringList) {
        let regex = new RegExp('(^.*[^\\w])(' + escapeRegexCharacters(customStr) + ')([^\\w]+.*$)', 'gi');
        result = result.replace(regex, '$1' + customStr + '$3');
    }
    
    return result;
}

// Replaces comma or semicolons, with optional spaces, to pipe symbols (to append to the forceCapString)
function fixCustomStrings(str) {
    return str.replace(/[,;\|]\s?/g, '|');
}

// #20408: Escape regular expression control characters for use when matching inside applyCustomStrings.
function escapeRegexCharacters(str) {
    return str.replace(/([\\\.\[\]\{\}\(\)\<\>\*\+\-\=\!\?\^\$])/g, `\\$1`);
}

function init(params) {
    var wnd = this;
    wnd.resizeable = true;
    wnd.noAutoSize = true; // disable auto sizing mechanism, we have fixed size
    wnd.title = params.title;
    
    /* CUSTOMIZATION MENU */

    var table = qid('selectedFields');
    for (let group of supportedTags) {
        var tableRow = document.createElement('tr');
        // tableRow.classList.add('')
        for (let tag of group) {
            let newTD = document.createElement('td');
            let newChb = document.createElement('div');
            newChb.setAttribute('data-control-class', 'Checkbox');
            newChb.setAttribute('data-id', `chb_${tag}`);
            newChb.innerText = resolveToValue(uitools.tracklistFieldDefs[tag].title);
            newTD.appendChild(newChb);
            tableRow.appendChild(newTD);
            initializeControl(newChb);
        }
        table.appendChild(tableRow);
    }
    
    var trackList = params.tracks;
    initLVTracklist(trackList);

    var UI = getAllUIElements();
    
    // #17880
    sett = app.getValue('caseChecker_useCaps', {useLittleWords: true, useForceCaps: true, fixQuotes: true});
    
    UI.chbLittleWords.controlClass.checked = sett.useLittleWords;
    UI.chbForceCaps.controlClass.checked = sett.useForceCaps;
    UI.chbFixQuotes.controlClass.checked = sett.fixQuotes;
    UI.chbLittleWords.setAttribute('data-tip', littleWordString.replace(/\|/g, ', '));
    UI.chbForceCaps.setAttribute('data-tip', forceCapString.replace(/\|/g, ', '));

    var _enabledTags = app.getValue('caseChecker_enabledTags', JSON.parse(JSON.stringify(defaultTags)));
    // Filter to just supported tags (in case something went wrong while saving)
    for (let tag of _enabledTags) {
        enabledTags.push(tag);
        var thisChb = UI[`chb_${tag}`];
        if (thisChb) {
            thisChb.controlClass.checked = true;
        }
    }

    UI.btnOK.controlClass.disabled = true;

    customStrings = fixCustomStrings(app.getValue('caseChecker_customStrings', 'Mr|Mrs|OK'));
    UI.edtCustomForceCaps.controlClass.value = customStrings;
    customStringList = customStrings.split('|');
    UI.edtCustomForceCaps.controlClass.localListen(UI.edtCustomForceCaps, 'keydown', handleEditKeyDown);
    
    customLittleWordStrings = fixCustomStrings(app.getValue('caseChecker_customLittleWords', 'a|an|feat'));
    UI.edtCustomLittleStrings.controlClass.value = customLittleWordStrings;
    customLittleStringList = customLittleWordStrings.split('|');
    UI.edtCustomLittleStrings.controlClass.localListen(UI.edtCustomLittleStrings, 'keydown', handleEditKeyDown);
    
    function showProgress() {
        UI.ccContainer.style.display = "none";
        UI.ccProgress.style.display = "";
    }
    
    function hideProgress() {
        UI.ccContainer.style.display = "";
        UI.ccProgress.style.display = "none";
    }
    
    function handleEditKeyDown(e) {
        // When the enter key is pressed, update customization instead of closing the dialog
        if (e.key === 'Enter') {
            e.stopPropagation();
            updateCustomization();
        }
    }
    
    // Animate the dropdown
    var calculatedHeight = '300px',
        dropdownOpen = false,
        iconBtnDropdown;
    // SVG may take a small bit of time to load; wait some time to avoid error
    setTimeout(() => {
        iconBtnDropdown = UI.btnDropdown.querySelector('svg');
        if (iconBtnDropdown) {
            iconBtnDropdown.style.transform = 'rotate(0deg)';
            iconBtnDropdown.style.transition = `transform ${animTools.animationTime}s`;
    
            UI.btnDropdown.firstElementChild.classList.add('flex', 'row');       
        }
    }, 200);
    var deg = 0;
    UI.btnDropdown.controlClass.localListen(UI.btnDropdown, 'click', function () {
        if (!dropdownOpen) {
            animTools.animate(UI.optionsDropdown, {
                height: calculatedHeight
            }, {
                complete: () => {
                    // Get its true height for next time we open the drawer
                    UI.optionsDropdown.style.height = 'auto';
                    calculatedHeight = UI.optionsDropdown.offsetHeight + 'px';
                }
            });
            dropdownOpen = true;
        } else {
            animTools.animate(UI.optionsDropdown, {
                height: '0px'
            });
            dropdownOpen = false;
        }
        // To let the button continually rotate
        deg += 90;
        if (iconBtnDropdown) iconBtnDropdown.style.transform = `rotate(${deg}deg)`;
    });
    // Reset the preferences
    UI.btnReset.controlClass.localListen(UI.btnReset, 'click', function () {
        // Custom strings
        customStrings = fixCustomStrings('Mr|Mrs|OK');
        UI.edtCustomForceCaps.controlClass.value = customStrings;
        customStringList = customStrings.split('|');
        app.setValue('caseChecker_customStrings', customStrings);
        
        customLittleWordStrings = fixCustomStrings('a|an|feat');
        UI.edtCustomLittleStrings.controlClass.value = customLittleWordStrings;
        customLittleStringList = customLittleWordStrings.split('|');
        
        // Enabled tags
        enabledTags = JSON.parse(JSON.stringify(defaultTags));
        for (let group of supportedTags) {
            for (let tag of group) {
                let chb = UI[`chb_${tag}`];
                if (chb) {
                    chb.controlClass.checked = (defaultTags.includes(tag));
                }
            }
        }
        app.setValue('caseChecker_enabledTags', enabledTags);
        
        sett.useLittleWords = UI.chbLittleWords.controlClass.checked = true;
        sett.useForceCaps = UI.chbForceCaps.controlClass.checked = true;
        sett.fixQuotes = UI.chbFixQuotes.controlClass.checked = true;
        app.setValue('caseChecker_useCaps', sett);
        // Reload the HTML
        prepareListContents();
    });
	
	var lastUpdateTime; // For throttling events that occur super fast
	
	function updateCustomization() {
		
		var now = Date.now();
		if (now - lastUpdateTime < 50) return;
		else lastUpdateTime = now;
		
        // Update the custom strings
        customStrings = fixCustomStrings(UI.edtCustomForceCaps.controlClass.value);
        UI.edtCustomForceCaps.controlClass.value = customStrings;
        app.setValue('caseChecker_customStrings', customStrings);
        customStringList = customStrings.split('|');
        
        customLittleWordStrings = fixCustomStrings(UI.edtCustomLittleStrings.controlClass.value);
        UI.edtCustomLittleStrings.controlClass.value = customLittleWordStrings;
        app.setValue('caseChecker_customLittleWords', customLittleWordStrings);
        customLittleStringList = customLittleWordStrings.split('|');
        
        // Update the custom tags
        enabledTags = [];
        for (let group of supportedTags) {
            for (let tag of group) {
                let chb = UI[`chb_${tag}`];
                if (chb && chb.controlClass.checked) {
                    enabledTags.push(tag);
                }
            }
        }
        app.setValue('caseChecker_enabledTags', enabledTags);
        
        sett.useLittleWords = UI.chbLittleWords.controlClass.checked;
        sett.useForceCaps = UI.chbForceCaps.controlClass.checked;
        sett.fixQuotes = UI.chbFixQuotes.controlClass.checked;
        app.setValue('caseChecker_useCaps', sett);
		
        // Reload the HTML
        prepareListContents();
	}
	
	// Instead of a save button, 
	var dropdownControls = getAllUIElements(UI.optionsDropdown);
	for (let key in dropdownControls) {
		let control = dropdownControls[key];
		if (control.controlClass && !(control.controlClass instanceof Button)) {
			control.controlClass.localListen(control.controlClass, 'change', function() {
				// We don't want the updateCustomization to update every time the user types a letter
				if (this.controlClass instanceof Edit) {
					// If document.activeElement is the text input, we want to ignore the event
					if (document.activeElement && this.contains(document.activeElement)) {
						return;
					}
					updateCustomization();
				}
				else {
					updateCustomization();
				}
			});
		}
	}
	
    /* CASE CHECKER */

    prepareListContents();
    
    // When Case Checker loads initially, start by checking all of the items.
    let ds = lvTracklist.controlClass.dataSource;
    ds.modifyAsync(() => {
        for (let i = 0; i < ds.count; i++) {
            ds.setChecked(i, true);
        }
    })
    .then(() => {
        lvTracklist.controlClass.updateTopCheckbox();
    });
    
    var lastEnabledTags; // Small performance optimization, don't override the tracklist columns unless they've been modified
    
    async function prepareListContents() {
        newHolds = {}; // Reset holds
        userTypedValues = {};
        for (let tag of enabledTags) {
            newHolds[tag] = {};
            userTypedValues[tag] = {};
        }
        
        // Handle the tracks
        await trackList.whenLoaded();
        // Make sure there are tracks loaded
        if (trackList.count == 0) {
            messageDlg(_("Select tracks to be updated"), 'Error', [btnOK], {
                defaultButton: 'btnOK'
            }, function (result) {
                modalResult = 0;
            });
            return;
        }
        
        let jobStartTime = performance.now();
        let progressShown = false;
        
        // #20407: Changed from forEach to listAsyncForEach so UI doesn't freeze when thousands of songs are selected
        listAsyncForEach(trackList, (track, next) => {
            for (let i in enabledTags) {
                let tag = enabledTags[i];
                let fieldDef = uitools.tracklistFieldDefs[tag];
                let thisValue = updateCase(track[tag]);
                
                if ((thisValue !== '') && (thisValue !== track[tag]) && (newHolds[tag])) {
                    newHolds[tag][track.persistentID] = thisValue;
                }
            }
            
            // If the job hasn't finished in a short amount of time, show the progress icon
            if (!progressShown && (performance.now() - jobStartTime) > 100) {
                showProgress();
            }
            
            // Proceed if window has not been closed yet
            if (!window._cleanUpCalled) next();
        }, () => {
            hideProgress();
            if (JSON.stringify(enabledTags) !== JSON.stringify(lastEnabledTags)) {
                // Handle the columns
                var columns = [];   
                columns.push({
                    columnType: 'check',
                    title: '',
                    width: 30,
                    minWidth: 30,
                    fixed: true,
                    order: 1,
                    headerRenderer: TrackListView.prototype.headerRenderers.renderCheck,
                    setupCell: function (div, column) {
                        TrackListView.prototype.cellSetups.setupCheckbox(div, column);
                    },
                    bindData: function (div, item, index) {
                        TrackListView.prototype.defaultBinds.bindCheckboxCell(div, item, index);
                    },
                    visible: true,
                    adaptableSize: false,
                });
                
                for (let tag of enabledTags) {
                    let fieldDef = uitools.tracklistFieldDefs[tag];
                    columns.push({
                        columnType: tag,
                        fieldID: tag,
                        checked: fieldDef.checked,
                        disabled: fieldDef.disabled,
                        editor: editors.gridViewEditors.multiValueEdit,
                        getValue: fieldDef.getValue,
                        mask: fieldDef.mask,
                        title: fieldDef.title,
                        editorParams: '{readOnly: false, multivalue: false, filtering: false, expanded: true, autoConfirm: true, removeHTMLTags: true}',
                        bindData: function (div, item, index) {
                            bindField(div, item, index, tag); // Custom handler for binding a div with a track data
                        },
                        setValue: function (item, newValue, raw, index) {
                            // Instead of writing to the track data, simply write to the userTypedValues with the new value
                            //  bindData is automatically called after this, so the div's contents will be updated
                            let value = normalizeValue(newValue);
                            if (value === newHolds[tag][item.persistentID]) {
                                delete userTypedValues[tag][item.persistentID]; // If the new value is the same as the suggested value, remove it from userTypedValues
                            }
                            else {
                                userTypedValues[tag][item.persistentID] = value; 
                            }
                        },
                        editable: function (item) {
                            // When a user requests to edit a field, set it as checked
                            let ds = lvTracklist.controlClass.dataSource;
                            ds.modifyAsync(() => {
                                let index = ds.indexOf(item);
                                ds.setChecked(index, true);
                            });
                            return true;
                        },
                        editorData: function (params) {
                            return getEditorData(params, tag);
                        }
                    });
                }
                lvTracklist.controlClass.setColumns(columns);
                lastEnabledTags = JSON.parse(JSON.stringify(enabledTags));
            }
            else {
                // JL: If the columns don't have to be changed, we still have to invalidate the LV contents so that the
                //  updated custom strings & case fixes are taken into account
                lvTracklist.controlClass.invalidateAll();
            }
            
            UI.btnOK.controlClass.localListen(UI.btnOK, 'click', btnOKClick);
        });
    }
    
    lvTracklist.controlClass.localListen(lvTracklist.controlClass.dataSource, 'change', function () {
        let anyChecked = lvTracklist.controlClass.dataSource.anyChecked();
        UI.btnOK.controlClass.disabled = !anyChecked; // Update the button to only show if some items are checked
    });
    
    async function btnOKClick() {
        UI.btnOK.controlClass.disabled = true;
        holds = [];
        var anyChecked = lvTracklist.controlClass.dataSource.anyChecked();
        if (anyChecked) {
            // Update only the tracks that have been checked
            let tracksToUpdate = lvTracklist.controlClass.dataSource.getCheckedList();
			await tracksToUpdate.whenLoaded();
			
            tracksToUpdate.forEach(item => {
                for (let tag of enabledTags) {
                    let userValue = userTypedValues[tag][item.persistentID];
                    let newValue = newHolds[tag][item.persistentID];
                    // Take priority of user-provided value
                    if (userValue) {
                        holds.push({
                            tag: tag,
                            id: item.persistentID,
                            item: item,
                            str: userValue
                        });
                    }
                    // if no user provided value, set as the auto-fixed one
                    else if (newValue) {
                        holds.push({
                            tag: tag,
                            id: item.persistentID,
                            item: item,
                            str: newValue
                        });
                    }
                }
            });
        }
        
        // Close the window
        modalResult = 1;
    }
}

function getEditorData(params, tag) {
    const ret = new ArrayDataSource([], {
        isLoaded: true
    });
    const track = params.item;
    const index = params.itemIndex;
    
    if (!track || !index) return ret;
    
    // Old value first, to match behavior of auto-tag
    let oldValue = track[tag] + ' <i>(' + _('old value') + ')</i>';
    ret.add({
        title: oldValue,
        value: oldValue,
        toString: function () {return this.title}
    });
    
    // Auto-generated value next
    let newValue = newHolds[tag][track.persistentID];
    if (newValue) {
        ret.add({
            title: newValue,
            value: newValue,
            toString: function () {return this.title}
        });
    }
    
    // If the user has already typed their own value, include it & put priority on that one by setting focusedIndex
    let userValue = userTypedValues[tag][track.persistentID];
    if (userValue && userValue !== track[tag] && userValue !== newValue) {
        ret.add({
            title: userValue,
            value: newValue,
            toString: function () {return this.title}
        });
        ret.focusedIndex = ret.count - 1;
    }
    
    return ret;
}

/**
 * 
 * @param {HTMLElement} div 
 * @param {Song} item 
 * @param {number} index 
 * @param {string} tag 
 */
function bindField(div, item, index, tag) {
    let fieldDef = uitools.tracklistFieldDefs[tag];

    let userValue;
    let newValue;    
    if (newHolds[tag]) {
        userValue = userTypedValues[tag][item.persistentID];
        newValue = newHolds[tag][item.persistentID];
    }
    
    // Check if the user has provided their own correction for this field & track
    if (userValue) {
        div.textContent = userTypedValues[tag][item.persistentID];
        // If the user-provided value is the same as the track's original value, remove the highlight color
        if (userValue === item[tag]) {
            div.classList.remove('lookupField');
        }
        else {
            div.classList.add('lookupField');
        }
    }
    // Check if we've found an auto correction for this field & track
    else if (newValue) {
        div.classList.add('lookupField');
        div.textContent = newValue;
    }
    else {
        div.classList.remove('lookupField'); // #19040 - reused divs must lose the highlighted class if no conflict exists
        fieldDef.bindData(div, item, index);
    }
}


function normalizeValue(value) {
    // remove HTML tags like <i>(old value)</i> (taken from auto-tag)
    var tmp = document.createElement("div");
    tmp.innerHTML = value;
    value = '';
    for (var i = 0; i < tmp.childNodes.length; i++) {
        if (tmp.childNodes[i].nodeName === '#text') {
            value += tmp.childNodes[i].data;
        }
    }
    return value.trim();
}

window.getHolds = function () {
    return holds;
};

function initLVTracklist(trackList) {
    lvTracklist = qid('ccContainer');
    lvTracklist.controlClass.showHeader = true;
    lvTracklist.controlClass.isSortable = false;
    lvTracklist.controlClass.highlightPlayingTrack = false;
    lvTracklist.controlClass.disableAlbumTracksLimit = true;
    var tracks = app.utils.createTracklist(true /* loaded */ );
    tracks.autoUpdateDisabled = true;
    tracks.addList(trackList);
    
    lvTracklist.controlClass.dataSource = tracks;
    lvTracklist.controlClass._completeRestore = false;
    lvTracklist.controlClass.singleClickEdit = true;
}

class CaseCheckerTracklist extends TrackListView {

    initialize(rootelem, params) {
        super.initialize(rootelem, params);
        this.alwaysShowTooltips = true;
    }

    /**
     * @param {HTMLElement} div 
     * @param {*} tip 
     * @returns 
     */
    onTooltip(div, tip) {
        
        let wasInConflict = div.classList.contains('lookupField');
        let field = div.column.fieldID;
        
        if (wasInConflict && field) {
            // Find the track information
            let track;
            this.dataSource.locked(() => {
                track = this.dataSource.getValue(div.itemIndex);
            });
            assert(newHolds[field], 'Could not find holds for field ' + field);
            assert(track, 'Could not find track');
            
            tip = _('old value') + ':<br>' + track[field];
        }

        return tip;
    }
}
registerClass(CaseCheckerTracklist);