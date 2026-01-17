registerFileImport('controls/customToolbar');

'use strict';

import Control from './control';

requirejs('controls/control');

/**
@module UI
*/


/**
UI CustomToolbar element

@class CustomToolbar
@constructor
@extends Control
*/

class CustomToolbar extends Control {
    divs: any[];
    private _focusedIdx: number;
    private _goAway: boolean;

    initialize(parentel, params) {
        super.initialize(parentel, params);
        this.divs = [];
        this.registerEventHandler('keydown');
        this._focusedIdx = -1;
        this.refreshItems();
        this.localListen(app, 'settingschange', () => {
            this.refreshItems();
        });
        this.localListen(this.container, 'focus', () => {
            // received focus, detect all toolbuttons
            if (!isUsingKeyboard() || this._goAway)
                return;

            let btns = qeclass(this.container, 'toolbutton');
            this.divs = [];
            if (btns) {
                forEach(btns, (el) => {
                    if (isVisible(el) && !el.classList.contains('taskControllerIndicator')) {
                        el.tabIndex = -1; // focusable only by our handling
                        el._leftPos = el.getBoundingClientRect().x;
                        el.controlClass = el.controlClass || new Control(el); // needed for ignoring hotkey functionality
                        el.controlClass.ignoreHotkey = el.controlClass.ignoreHotkey || this.ignoreHotkey;
                        this.divs.push(el);
                    }
                });
            }
            if (this.divs.length) {
                this.divs.sort(function (d1, d2) {
                    let retval = d1._leftPos - d2._leftPos;
                    return retval;
                });

                this._focusedIdx = 0;
                this.focusFirstEnabled();
            } else
                this._focusedIdx = -1;
        });
        this.localListen(this.container, 'blur', () => {
            this._goAway = false;
        });        
    }

    refreshItems() {
        let someExists = false;
        cleanElement(this.container, true /* only children*/ );
        app.getValue('toolbarItems', []).forEach((key) => {
            if (key == 'separator') {
                this.addButton({isSeparator: true});
            } else {
                let act = hotkeys.getAction(key);
                if (act) {
                    this.addButton(act);
                    someExists = true;
                }
            }
        });
        let vis = app.getValue('toolbarVisible', true /* #19549 */);
        setVisibility( this.container, vis);
        if(someExists) // do not allow focus on empty toolbar
            this.tabIndex = 0;
        else
            this.tabIndex = -1;
    }

    addButton(action) {
        let parent = this.container;        

        let btn = document.createElement('div');
        if (!action.isSeparator) {
            let tooltip = window.hotkeys.getActionTitleWithCategory(action);
            btn.setAttribute('data-icon',  window.hotkeys.getActionIcon(action));
            btn.setAttribute('data-tip', tooltip);
            btn.setAttribute('data-aria-label', tooltip); // Give it a screen reader label from the tooltip
        }
        if (action.submenu)
            btn.setAttribute('data-control-class', 'MenuButton');
        else
            btn.setAttribute('data-control-class', 'ToolButton');
        parent.appendChild(btn);
        initializeControls(parent);
        if (action.isSeparator)
            btn.controlClass.disabled = true;
        if (action.submenu)
            btn.controlClass.menuArray = action.submenu;
        else
        if (action.execute) {
            btn.controlClass.localListen(btn, 'click', () => {
                action.execute();
            });
            //addEnterAsClick(btn.controlClass, btn);
        }
        return btn;
    }
    focusFirstEnabled(back?:boolean) {
        if (!this.divs.length || (this._focusedIdx === -1))
            return;
        let div = this.divs[this._focusedIdx];
        if (!isElementDisabled(div)) {
            div.focus();
            return;
        }
        let step = back ? -1 : 1;
        let i = this._focusedIdx + step;
        while (i !== this._focusedIdx) {
            div = this.divs[i];
            if (!isElementDisabled(div)) {
                this._focusedIdx = i;
                div.focus();
                return;
            }
            i = this._focusedIdx + step;
            if (i < 0)
                i = this.divs.length - 1;
            else if (i >= this.divs.length)
                i = 0;
        }
        this._focusedIdx = -1;
    }

    handle_keydown(e) {
        if (!this.divs.length)
            return;
        let focusedElement = document.activeElement;
        if (focusedElement && ((focusedElement.nodeName == 'INPUT') || (focusedElement.hasAttribute('contenteditable'))))
            return;

        let handled = false;
        let back = false;
        switch (friendlyKeyName(e)) {
        case 'Home':
            this._focusedIdx = 0;
            handled = true;
            break;
        case 'End':
            this._focusedIdx = this.divs.length - 1;
            handled = true;
            back = true;
            break;
        case 'Left':
            if (this._focusedIdx < 0)
                break;
            this._focusedIdx--;
            if (this._focusedIdx < 0)
                this._focusedIdx = this.divs.length - 1;
            handled = true;
            back = true;
            break;
        case 'Right':
            this._focusedIdx++;
            if (this._focusedIdx >= this.divs.length)
                this._focusedIdx = 0;
            handled = true;
            break;
        case 'Enter':
            if (focusedElement) {
                if((focusedElement as HTMLDivElement).controlClass)
                    (focusedElement as HTMLDivElement).controlClass._lastKey = 'Enter';
                simulateFullClick(focusedElement);
            }
            handled = true;
            break;
        case 'Tab':
            if (e.shiftKey) {
                this._goAway = true;
                this.container.focus(); // needed so default handling can skip to previous tabable element
            }
            break;
        }

        if (handled) {
            this.focusFirstEnabled(back);
            e.stopPropagation();
            e.preventDefault();
        }
    }

    ignoreHotkey(hotkey) {
        let ar = ['Right', 'Left', 'Enter', 'Home', 'End'];
        return inArray(hotkey, ar, true /* ignore case */ );
    }

    cleanUp() {
        this.divs = [];
        super.cleanUp();
    }
}
registerClass( CustomToolbar);
