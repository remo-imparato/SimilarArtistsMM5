/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

/**
@module UI
*/

requirejs('controls/listview');
requirejs('controls/checkbox');
requirejs('controls/dropdown');

window.initDropdown = function () {
    if (window.dropdownHandlerOrig) {
        window.dropdownHandler = new DropdownHandler();
        var t;
        // copy all params
        for (var key in window.dropdownHandlerOrig) {
            if (this.dropdownHandler[key] === undefined)
                this.dropdownHandler[key] = window.dropdownHandlerOrig[key];
        }
        window.dropdownHandler.window = window;
        window.dropdownHandler.parentel = document.body;
        window.dropdownHandler.initDropdown();
        window.dropdownHandlerOrig = undefined;
    }
}

window.handleKeypressed = function (key, shiftKey, ctrlKey, altKey, metaKey) {
    if (window.dropdownHandler)
        window.dropdownHandler.handleKeypressed(key, shiftKey, ctrlKey, altKey, metaKey);
}

window.filterLV = function (newval) {
    if (window.dropdownHandler)
        window.dropdownHandler.filterLV(newval);
}

window.forcedCloseWindow = function () {
    if (window.dropdownHandler)
        window.dropdownHandler.forcedCloseWindow();
    else
        window.closeWindow();
}

window.getFocusedIndex = function () {
    if (window.dropdownHandler)
        return window.dropdownHandler.focusedIndex;
    else
        return -2;
}

window.isDropdownListEmpty = function () {
    if (window.dropdownHandler)
        return window.dropdownHandler.isDropdownListEmpty();
    else
        return true;
}