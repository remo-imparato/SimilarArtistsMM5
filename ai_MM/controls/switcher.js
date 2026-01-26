/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

/**
@module UI snippets
*/

requirejs('controls/tabs');

/**
UI switcher element.

@class Switcher
@constructor
@extends Tabs
*/

class Switcher extends Tabs {

    initialize(rootelem, params) {
        super.initialize(rootelem, params);
        this.container.classList.add('switcher');
        this.focusedTabIndex = 0;
    }

    handle_keydown(e) {
        var key = friendlyKeyName(e);
        // some buttons handle only in case, they are really pressed on this control, to avoid e.g. tab switching during pressing arrow keys in child edit boxes
        var pressedOnThisTab = e.target && (e.target.getAttribute('data-uniqueid') === this.uniqueID);

        var _afterKeyboardNav = function () {
            this.focusVisible = true; // After a keyboard operation, make focus rectangle visible                 
            var items = this.items;
            for( var i = 0; i < items.length; i++) {
                var item = items[i];
                if (i == this.focusedTabIndex) {
                    item.setAttribute('data-keyfocused', '1');
                    setAriaActiveDescendant(item, this.container); // Screen reader support
                }
                else {
                    item.removeAttribute('data-keyfocused');
                    clearAriaID(item); // Screen reader support
                }
            }
            this.container.focus(); // focus tabs header, so that we don't lose focus when hiding old tab
            e.stopPropagation();
        }.bind(this);

        switch (key) {
        case 'Enter':
            this.selectedIndex = this.focusedTabIndex;
            this.requestTimeout( function () { // make switcher focused
                this.container.focus();
            }.bind(this), 200);
            break;
        case 'Tab':
            if (e.ctrlKey) {
                this.focusedTabIndex = this.getNextTabIndex(this.focusedTabIndex, e.shiftKey);
                _afterKeyboardNav();
            }
            break;
        case 'Left':
            if (pressedOnThisTab) {
                var i = this.focusedTabIndex - 1;
                if (i >= 0)
                    this.focusedTabIndex = i;
                _afterKeyboardNav();
            }
            break;
        case 'Right':
            if (pressedOnThisTab) {
                var i = this.focusedTabIndex + 1;
                if (i < this.length)
                    this.focusedTabIndex = i;
                _afterKeyboardNav();
            }
            break;
        }
    }
    
    ignoreHotkey(hotkey) {
        var ar = ['Right', 'Left', 'Ctrl+Tab', 'Enter'];
        return inArray(hotkey, ar, true /* ignore case */ );
    }
}
registerClass(Switcher);