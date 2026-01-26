/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

registerFileImport('controls/mainMenu');
import Control from './control';
'use strict';
function usePopupMenuWindows() {
    if (window.popupMenuWindows != undefined) // popupMenuWindows property is defined in native window because of OSX Full Screen mode where windows popup cannot be used (and we need to use inplace menu elements instead)
        return window.popupMenuWindows;
    return !window.isStub;
}
let showAccelerator = function (midiv, show) {
    let mitem = midiv.mitem;
    let title = resolveToValue(mitem.action.title, '', undefined, mitem /*bind*/);
    let ak = mitem.action.noAccessKey ? '' : uitools.getAccessKey(title);
    if (show) {
        if (ak) {
            midiv.accessKey = ak.toLowerCase();
            midiv.innerHTML = title.replace('&' + ak, '<u>' + ak + '</u>');
        }
        else
            midiv.innerHTML = title;
    }
    else {
        midiv.innerHTML = title.replace('&' + ak, ak);
    }
};
// -----------------------------------------------------------------
/**
UI main menu element.

@class MainMenu
@constructor
@extends Control
*/
class MainMenu extends Control {
    initialize(parentel, params) {
        super.initialize(parentel, params);
        let _this = this;
        if (!builtInMenu) {
            uitools.prepareMenuForOSX(window.mainMenuItems).then((data) => {
                menuJSON = data;
            });
        }
        this.submenu = undefined;
        this.selectedItem = undefined;
        this.activemenu = false;
        this.divs = [];
        this._lastCloseTime = 0;
        let showAccelerators = function (show) {
            this.divs.forEach(function (midiv) {
                showAccelerator(midiv, show);
            });
        }.bind(this);
        this.closepopups = function () {
            if (this.subpopup)
                this.subpopup.close();
            if (this.selectedItem) {
                this.selectedItem.removeAttribute('data-selected');
            }
            this.selectedItem = undefined;
            window._mainMenuOpen = false;
            _this.activemenu = false;
        }.bind(this);
        // set passed attributes
        for (let key in params) {
            this[key] = params[key];
        }
        this.forceClose = function () {
            if (this._mouseupSet) {
                app.unlisten(window, 'mouseup', this.checkclosemenu, true);
                this._mouseupSet = false;
            }
            this.closepopups();
            showAccelerators(false);
            this._lastCloseTime = Date.now();
        }.bind(this);
        this.checkclosemenu = function (e) {
            if (e.button === 0) {
                for (let element = e.target; element; element = element.parentNode) {
                    if (element.classList && element.classList.contains('menuitem')) {
                        return;
                    }
                }
            }
            this.forceClose();
        }.bind(this);
        this.items = document.createElement('div');
        this.items.classList.add('mainmenu');
        this.container.appendChild(this.items);
        this.addItems(mainMenuItems);
        this.localListen(window.settings.observer, 'change', () => {
            this.addItems(mainMenuItems);
        });
        this.setTemporalFocus = function (keyEvt) {
            if (this.divs.length) {
                if (!this.activemenu) {
                    this.activemenu = true;
                    this.selectedItem = this.divs[0];
                    this.divs[0].setAttribute('data-selected', 1);
                    showAccelerators(true);
                }
                else {
                    this.activemenu = false;
                    if (this.selectedItem)
                        this.selectedItem.removeAttribute('data-selected');
                    this.selectedItem = undefined;
                    showAccelerators(false);
                }
            }
            if (keyEvt) {
                this.keyDownHandler(keyEvt);
            }
        }.bind(this);
        this.keyDownHandler = function (e) {
            let handled = _this.activemenu;
            if (_this.activemenu || window.isMenuVisible()) {
                let newIdx = -1;
                let friendlyKey = friendlyKeyName(e);
                switch (friendlyKey) {
                    case 'Down':
                        if (!isMenuVisible() && _this.selectedItem) {
                            _this.showsubmenu(_this.selectedItem.mitem.action, _this.selectedItem);
                        }
                        break;
                    case 'Up':
                        // _this.forceClose(); // disabled because of #15374 - item 4
                        break;
                    case 'Right':
                        {
                            let idx = _this.divs.indexOf(_this.selectedItem);
                            if (idx < _this.divs.length - 1) {
                                newIdx = ++idx;
                            }
                            else {
                                newIdx = 0;
                            }
                        }
                        break;
                    case 'Left':
                        {
                            let idx = _this.divs.indexOf(_this.selectedItem);
                            if (idx == 0) {
                                newIdx = _this.divs.length - 1;
                            }
                            else {
                                newIdx = --idx;
                            }
                        }
                        break;
                    case 'Enter':
                        if (!isMenuVisible() && _this.selectedItem) {
                            _this.showsubmenu(_this.selectedItem.mitem.action, _this.selectedItem);
                        }
                        break;
                    case 'Esc':
                        if (!_this.activemenu && (window.popupWindow.menuWindowsOpened() === 1)) {
                            window.popupWindow.closeAll();
                        }
                        else {
                            _this.forceClose();
                        }
                        break;
                    default:
                        handled = false;
                }
                let divs = _this.divs;
                if (divs) { // LS: accessKey workaround, our menu window no longer has focus (starting from CEF51)                
                    for (let i = 0; i < divs.length; i++) {
                        let it = divs[i];
                        if (it.accessKey == friendlyKey) {
                            _this.showsubmenu(it.mitem.action, it);
                            handled = true;
                        }
                    }
                }
                if (newIdx != -1) {
                    if (_this.selectedItem) {
                        _this.selectedItem.removeAttribute('data-selected');
                    }
                    let newSelectedItem = _this.divs[newIdx];
                    if (newSelectedItem) {
                        if (isMenuVisible()) {
                            if (_this.subpopup) {
                                _this.closepopups();
                            }
                            if (newSelectedItem.submenu) {
                                _this.showsubmenu(newSelectedItem.mitem.action, newSelectedItem);
                            }
                        }
                        else {
                            newSelectedItem.setAttribute('data-selected', 1);
                        }
                    }
                    _this.selectedItem = newSelectedItem;
                }
            }
            return handled;
        };
        _this.localListen(window, 'keydown', function (e) {
            if (_this.keyDownHandler(e)) {
                e.stopImmediatePropagation();
                e.preventDefault();
            }
        }, true);
    }
    ignoreHotkey(hotkey) {
        let ar = ['Right', 'Left', 'Down', 'Up', 'Enter', 'Esc'];
        return inArray(hotkey, ar, true /* ignore case */);
    }
    showsubmenu(action, div, byMouse) {
        window._mainMenuOpen = true;
        this.activemenu = true;
        if ((this.subpopup === undefined) && (div.offsetWidth > 0)) {
            if (this.selectedItem && (this.selectedItem != div)) {
                this.selectedItem.removeAttribute('data-selected');
            }
            let submenuclosed = function () {
                div.removeAttribute('data-selected');
                if (this.subpopup && this.subpopup.menuHandler) {
                    this.subpopup.menuHandler.cleanUp();
                    this.subpopup.menuHandler = null;
                }
                this.subpopup = undefined;
                this.selectedItem = null;
            }.bind(this);
            let submenukeydown = (e) => {
                // handle left/right keys when sent from submenus to skip to previous/next menu
                let friendlyKey = friendlyKeyName(e);
                let newIdx = -1;
                switch (friendlyKey) {
                    case 'Right':
                        {
                            let idx = this.divs.indexOf(this.selectedItem);
                            if (idx < this.divs.length - 1) {
                                newIdx = ++idx;
                            }
                            else {
                                newIdx = 0;
                            }
                        }
                        break;
                    case 'Left':
                        {
                            let idx = this.divs.indexOf(this.selectedItem);
                            if (idx == 0) {
                                newIdx = this.divs.length - 1;
                            }
                            else {
                                newIdx = --idx;
                            }
                        }
                        break;
                }
                if (newIdx != -1) {
                    if (this.selectedItem) {
                        this.selectedItem.removeAttribute('data-selected');
                    }
                    let newSelectedItem = this.divs[newIdx];
                    if (newSelectedItem) {
                        if (this.subpopup) {
                            this.closepopups();
                        }
                        if (newSelectedItem.submenu) {
                            this.showsubmenu(newSelectedItem.mitem.action, newSelectedItem);
                        }
                    }
                    this.selectedItem = newSelectedItem;
                }
            };
            this.subpopup = new Menu(action.submenu, {
                // @ts-ignore LS: Is the following this.parent assignment OK? It seems undefined?
                parent: this.parent,
                parentMenuAction: action,
                rootMenuAction: action,
                onmenuclosed: submenuclosed,
                onkeydown: submenukeydown,
                byMouse: byMouse,
                showAccessKeys: !byMouse
            });
            //ODS('*** created submenu');
            let pos = findScreenPos(div);
            if (thisWindow.maximized) {
                let screen = thisWindow.getWindowMonitor();
                if (pos.left < screen.availLeft)
                    pos.left = screen.availLeft;
                if (pos.top < screen.availTop)
                    pos.top = screen.availTop;
            }
            this.subpopup.show(pos.left, pos.top + div.offsetHeight, pos.left);
            div.setAttribute('data-selected', 1);
            this.selectedItem = div;
        }
    }
    addItems(mainMenuItems) {
        let _this = this;
        let handleDisabled = function (midiv, mitem, isdisabled) {
            if (!isdisabled) {
                midiv.menudown = function (evt) {
                    evt.stopPropagation();
                    if ((Date.now() - _this._lastCloseTime) < 25) // #17153 just closed menu, ignore click, it was on this div and already closed
                        return;
                    if (!window._mainMenuOpen) {
                        if (window.isMenuVisible()) { // another popup is visible (probably popup menu ?)
                            popupWindow.closeAll();
                        }
                        _this.showsubmenu(mitem.action, this, true /* by mouse */);
                    }
                    else {
                        _this.closepopups();
                    }
                }.bind(midiv);
                midiv.menuclick = function (evt) { }.bind(midiv);
                midiv.menumouseover = function (e) {
                    if (window.isMenuVisible() && window._mainMenuOpen) {
                        if (_this.selectedItem !== this) {
                            if (_this.subpopup) {
                                _this.closepopups();
                            }
                            if (this.submenu) {
                                _this.showsubmenu(mitem.action, this, true /* by mouse */);
                            }
                        }
                    }
                }.bind(midiv);
                this.localListen(midiv, 'mousedown', midiv.menudown);
                this.localListen(midiv, 'mouseup', midiv.menuclick);
                this.localListen(midiv, 'mouseenter', midiv.menumouseover, true);
                this.divs.push(midiv);
            }
        }.bind(this);
        let addItem = function (mitem) {
            let isdisabled = resolveToValue(mitem.disabled, false, {
                action: mitem,
                parent: this.parent
            });
            let midiv = document.createElement('div');
            midiv.classList.add('mainmenuitem');
            midiv.classList.add('menuitem');
            midiv.mitem = mitem;
            midiv.style.zIndex = '99999999';
            showAccelerator(midiv, false);
            midiv.submenu = mitem.action.submenu;
            this.items.appendChild(midiv);
            if (isPromise(isdisabled)) {
                isdisabled.then(function (res) {
                    handleDisabled(midiv, mitem, res);
                });
            }
            else
                handleDisabled(midiv, mitem, isdisabled);
        }.bind(this);
        cleanElement(this.items, true);
        forEach(mainMenuItems, function (mitem) {
            let isvisible = resolveToValue(mitem.action.visible, true, undefined, mitem /*bind*/);
            if (isPromise(isvisible)) {
                isvisible.then(function (res) {
                    if (res) {
                        addItem(mitem);
                    }
                });
            }
            else if (isvisible) {
                addItem(mitem);
            }
        }.bind(this));
    }
    /**
    Should clean up all the control stuff, i.e. mainly unlisten events.

    @method cleanUp
    */
    cleanUp() {
        if (usePopupMenuWindows()) {
            popupWindow.cleanUp();
        }
        if (this.divs) {
            for (let i = 0; i < this.divs.length; i++) {
                let midiv = this.divs[i];
                if (midiv.menuclick) {
                    app.unlisten(midiv, 'mouseup', midiv.menuclick);
                }
                if (midiv.menumouseover) {
                    app.unlisten(midiv, 'mouseover', midiv.menumouseover);
                }
            }
        }
        this.divs = undefined;
        window._mainMenuOpen = false;
        super.cleanUp();
    }
}
registerClass(MainMenu);
