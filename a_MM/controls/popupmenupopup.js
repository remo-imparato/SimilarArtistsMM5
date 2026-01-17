/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

/**
@module UI
*/

requirejs("controls/control");
requirejs("actions.js");
requirejs("controls/popupmenu");

window.isMenuWindow = true;

window.initMenu = function (screenX, screenY, oppositeX, wndClass, showAccessKeys, helpContext) {
    if (window.menuHandlerOrig && !window._cleanUpCalled) {
        if (window.menuHandler) {
            window.menuHandler.cleanUp();
            window.menuHandler = null;
        }


        window.menuHandler = new MenuHandler({
            menuitems: window.menuHandlerOrig.menuitems,
            bindFn: window.menuHandlerOrig.bindFn
        });
        window.menuHandler.parent = window.menuHandlerOrig.parent;
        window.menuHandler.ownwindow = window.menuHandlerOrig.ownwindow;
        window.menuHandler.onmenuclosed = window.menuHandlerOrig.onmenuclosed;
        window.menuHandler.onkeydown = window.menuHandlerOrig.onkeydown;
        window.menuHandler.onactioncalled = window.menuHandlerOrig.onactioncalled;
        window.menuHandler.parentMenuAction = window.menuHandlerOrig.parentMenuAction;
        window.menuHandler.rootMenuAction = window.menuHandlerOrig.rootMenuAction;
        window.menuHandler.byMouse = window.menuHandlerOrig.byMouse;
        window.menuHandler.trayMenu = window.menuHandlerOrig.trayMenu;
        window.menuHandler.window = window;
        window.menuHandler.nativeWindow = wndClass;
        window.menuHandler.parentel = document.body;
        window.menuHandler.showAccessKeys = showAccessKeys; 
        window.menuHandler.helpContext = helpContext;
        window.menuHandler.initMenu(screenX, screenY, oppositeX);
        window.menuHandlerOrig = undefined;
    }
}

window.afterClose = function () {
    if (window.menuHandler) {
        window.menuHandler.clearWindow();
        if (window.menuHandler.menucontainer) {
            window.menuHandler.menucontainer.remove();
            window.menuHandler.menucontainer = undefined;
        }
    }
}

window.keydownforward = function (e) {
    return window.menuHandler.keyDownHandler(e);
}

window.resizeAndShow = function () {
    show();
}

window.clearWindow = function () {
    if (window.menuHandler) {
        window.menuHandler.clearWindow();
        window.menuHandler = undefined;
    }
}

window.forcedCloseWindow = function (closeAll) {
    if (window.menuHandler)
        window.menuHandler.forcedCloseWindow(closeAll);
}
