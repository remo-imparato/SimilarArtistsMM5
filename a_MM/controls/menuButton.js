/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

'use strict';
registerFileImport('controls/menubutton');
/**
@module UI
*/
import IconButton from './iconButton';
/**
UI menu button element.

@class MenuButton
@constructor
@extends ToolButton
*/
export default class MenuButton extends IconButton {
    initialize(parentel, params) {
        params = params || {};
        if (!params.caption) {
            let icon = parentel.getAttribute('data-icon');
            if (!icon)
                parentel.setAttribute('data-icon', 'menu');
            // Set aria-label if not previously set
            if (!parentel.getAttribute('data-aria-label'))
                parentel.setAttribute('data-aria-label', 'Menu');
        }
        super.initialize(parentel, params);
        let justClosed = false;
        let closetm = 0;
        if (!params.noAddClasses)
            parentel.classList.add('menuButton'); // to allow individual styling of menu buttons
        this.menuArray = params.menuArray;
        this.getMenuArray = params.getMenuArray;
        this.parent = params.parent;
        let _this = this;
        this.isMainMenu = resolveToValue(params.isMainMenu, false);
        if (!builtInMenu && this.isMainMenu) {
            uitools.prepareMenuForOSX(copyObject(this.menuArray)).then((data) => {
                menuJSON = data;
            });
        }
        if (!this.isMainMenu) {
            this.tabIndex = 0;
        }
        let showmenu = function (showAccessKeys, byMouse) {
            this.container.setAttribute('data-selected', '1');
            let menuclosed = function () {
                if (this._cleanUpCalled)
                    return;
                this.container.removeAttribute('data-selected');
                if (this.subpopup && this.subpopup.menuHandler) {
                    this.subpopup.menuHandler.cleanUp();
                    this.subpopup.menuHandler = null;
                }
                this.subpopup = undefined;
                justClosed = true;
                closetm = Date.now();
            }.bind(this);
            let actioncalled = function (params) {
                if (this.subpopup && (!params || !params.ctrlKey))
                    this.subpopup.close();
                this.raiseEvent('change');
            }.bind(this);
            let ar;
            if (this.getMenuArray)
                ar = this.getMenuArray();
            else
                ar = this.menuArray;
            this.subpopup = new Menu(ar, {
                onmenuclosed: menuclosed,
                onactioncalled: actioncalled,
                parent: _this.parent,
                showAccessKeys: showAccessKeys,
                helpContext: this.helpContext,
                byMouse: byMouse
            });
            let pos = findScreenPos(this.container);
            this.subpopup.show(pos.left + (this.oppositeX ? this.container.offsetWidth : 0), pos.top + this.container.offsetHeight, this.oppositeX);
        }.bind(this);
        let usePopupMenuWindows = !window.isStub;
        if (usePopupMenuWindows && (window.popupMenuWindows != undefined)) // popupMenuWindows property is defined in native window because of OSX Full Screen mode where windows popup cannot be used (and we need to use inplace menu elements instead)
            usePopupMenuWindows = window.popupMenuWindows;
        let handleMenubtnClick = function (evt, byKey) {
            if (!params.propagateEvtOnClick)
                evt.stopPropagation();
            if (justClosed && ((Date.now() - closetm) < 100)) {
                // click event just after closing menu - ignore
                justClosed = false;
                return;
            }
            if (this.subpopup) {
                if (usePopupMenuWindows) {
                    getValue('popupWindow').closeAll();
                }
                else
                    this.subpopup.close();
            }
            else {
                showmenu(undefined, !byKey);
            }
        }.bind(this);
        if (!params.disabled) {
            this.localListen(this.container, 'mousedown', handleMenubtnClick);
            this.localListen(this.container, 'click', (e) => {
                e.stopPropagation(); // #16252, #19377
            });
            this.localListen(this.container, 'mouseup', (e) => {
                e.stopPropagation();
            });
            this.localListen(window, 'keyup', (e) => {
                if (this.container === window.mainMenuButton) {
                    let key = friendlyKeyName(e);
                    if (key === 'Alt') {
                        if (this.subpopup) {
                            handleMenubtnClick(e, true);
                            return;
                        }
                        else {
                            e.stopPropagation();
                            showmenu(true);
                        }
                    }
                }
            }, true);
            this.localListen(this.container, 'keydown', function (e) {
                if (window._mainMenuOpen)
                    return;
                let key = friendlyKeyName(e);
                if (key == 'Enter') {
                    handleMenubtnClick(e, true);
                }
                else if (key == 'Down' && !this.subpopup) {
                    e.stopPropagation();
                    showmenu();
                }
            }.bind(this));
        }
    }
    setTemporalFocus() {
        // setting "temporal" focus - e.g. 'Alt' focuses the main menu button, but it is not in the 'Tab' sequence
        this.tabIndex = 9999;
        this.container.focus();
        if (this.isMainMenu)
            this.tabIndex = -1;
        else
            this.tabIndex = 0;
    }
    focusHandler(element, newState) {
        // handle and draw keyboard focus - override to allow focusing menu button inside LV, like Media Tree
        let state = false;
        if (element) {
            if (newState)
                element.setAttribute(getFocusAttribute(), '1');
            else
                element.removeAttribute(getFocusAttribute());
            if (element.controlClass)
                element.controlClass.focusRefresh(newState);
            this.focusRefresh(newState);
        }
        return state;
    }
}
registerClass(MenuButton);
window.uitools = window.uitools || {};
window.uitools.insertFakeMenuButton = function (btnContainer, btnClassName) {
    // insert invisible menu button, used to reserve correct height in the container for absolute positioned MenuButton
    let headerMenuBtnHeight = document.createElement('div');
    headerMenuBtnHeight.className = btnClassName;
    btnContainer.appendChild(headerMenuBtnHeight); // LS: needs to be before controlClass creation bellow (due to setVisibility in MenuButton.initialize when window.settings.UI.hideMenu == true)
    headerMenuBtnHeight.controlClass = new MenuButton(headerMenuBtnHeight, {
        menuArray: [],
        disabled: true
    });
    headerMenuBtnHeight.style.position = 'relative';
    headerMenuBtnHeight.style.overflow = 'hidden';
    headerMenuBtnHeight.style.zIndex = '0';
    // make full width zero
    headerMenuBtnHeight.style.width = '0px';
    headerMenuBtnHeight.style.borderLeftWidth = '0px';
    headerMenuBtnHeight.style.borderRightWidth = '0px';
    headerMenuBtnHeight.style.paddingLeft = '0px';
    headerMenuBtnHeight.style.paddingRight = '0px';
    headerMenuBtnHeight.style.marginLeft = '0px';
    headerMenuBtnHeight.style.marginRight = '0px';
};
