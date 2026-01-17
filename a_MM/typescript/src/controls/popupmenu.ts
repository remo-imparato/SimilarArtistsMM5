'use strict';

import Checkbox from './checkbox';
import Control from './control';
import '../actions';
import { MenuItem } from '../actions';

registerFileImport('controls/popupmenu');

/**
@module UI
*/

requirejs('controls/innerWindow');

function usePopupMenuWindows() {
    if (window.popupMenuWindows != undefined) // popupMenuWindows property is defined in native window because of OSX Full Screen mode where windows popup cannot be used (and we need to use inplace menu elements instead)
        return window.popupMenuWindows;
    return !window.isStub;
}
 
/*
Popup menu windows handling
*/
(function () {
    let windows = [];
    let windowIdx = 1;
    let activeWindows = 0;
    let __hoverBlockDiv = undefined;
    let __hoverBlockDivEvent = undefined;
    let __hoverBlockDivDownEvent = undefined;
    let menuClosedTimestamp = 0;

    let mainWnd = app.dialogs.getMainWindow();
    let globalClose = function (e) {
        if (!e) {
            if (!app.anyDialogActive()) {
                mainWnd.getValue('popupWindow').closeAll();
            }
        }
    };
    if (usePopupMenuWindows())
        app.listen(mainWnd, 'activated', globalClose);


    let __removeBlockDiv = function (forceClose?: boolean) {
        if (__hoverBlockDiv && (forceClose || (activeWindows === 0))) {
            if (__hoverBlockDivEvent) app.unlisten(__hoverBlockDiv, 'mousemove', __hoverBlockDivEvent, true);
            if (__hoverBlockDivDownEvent) app.unlisten(__hoverBlockDiv, 'mousedown', __hoverBlockDivDownEvent, true);
            __hoverBlockDiv.remove();
            __hoverBlockDiv = undefined;
            __hoverBlockDivEvent = undefined;
            __hoverBlockDivDownEvent = undefined;
        }
    };

    let __createBlockDiv = function () {
        // this attribute is here because of menu .. when any menu window is open, all hover actions are disabled
        if (!__hoverBlockDiv) {
            __hoverBlockDiv = document.createElement('div');
            __hoverBlockDiv.classList.add('fill');
            __hoverBlockDiv.style.zIndex = 9999999;
            document.body.appendChild(__hoverBlockDiv);
            // allow hover on mainmenu
            let mainmenu = q('[data-control-class=MainMenu]');
            let mainmenupos = undefined;
            if (mainmenu) {
                mainmenupos = findScreenPos(mainmenu);
                let pos = getAbsPosRect(mainmenu);
                mainmenupos.width = pos.width;
                mainmenupos.height = pos.height;
            }
            __hoverBlockDivEvent = app.listen(__hoverBlockDiv, 'mousemove', function (e) {

            }, true);

            __hoverBlockDivDownEvent = app.listen(__hoverBlockDiv, 'mousedown', function (e) {
                if (mainmenupos) {
                    if ((e.screenX >= mainmenupos.left) && (e.screenX <= mainmenupos.left + mainmenupos.width) &&
                        (e.screenY >= mainmenupos.top) && (e.screenY <= mainmenupos.top + mainmenupos.height)) {
                        return;
                    }
                }
                __removeBlockDiv(true);
                // hide all menu windows and forward event to main
                popupWindow.closeAll();

                let sendEvent = function (eventName, sender) {
                    let event = createNewEvent(eventName);
                    event.initEvent(eventName, true, true); // @ts-ignore
                    event.clientX = e.clientX; // @ts-ignore
                    event.clientY = e.clientY; // @ts-ignore
                    event.screenX = e.screenX; // @ts-ignore
                    event.screenY = e.screenY;
                    sender.dispatchEvent(event);
                };


                sendEvent('mousemove', document.body);

                let element = document.elementFromPoint(e.clientX, e.clientY);
                if (element) {
                    sendEvent('mouseenter', element);
                    sendEvent('mousemove', element);
                    sendEvent('mousedown', element);
                    sendEvent('click', element);
                    sendEvent('mouseup', element);
                }

            }, true);

        }
    };

    let initializeWindow = function (w, handler, _thisWindow) {

        if (window._cleanUpCalled || _thisWindow._window._cleanUpCalled)
            return;

        if (w._handler && w._handler.menuHandler && (w._handler !== handler)) {
            w._handler.menuHandler.cleanUp();
            delete w._handler.menuHandler;
            w._handler.menuHandler = null;
        }

        w._handler = handler;
        w._thisWindow = _thisWindow;
        w._mainWindow = thisWindow;
        handler.loaded = w.windowInitialized;

        addMethods(w);

        if (!w.eventsInitialized && w._handler) {
            app.listen(w, 'closed', w.closed);
            if (w._handler.onmovedhandler) w._movedEvent = app.listen(w._thisWindow, 'moved', w._handler.onmovedhandler);
            if (w._handler.onmousestatehandler) w._mouseStateChangedEvent = app.listen(w._thisWindow, 'mouseStateChanged', w._handler.onmousestatehandler, true); // PETR: do not close submenu (#14014)
            if (w._handler.onblurhandler) w._activatedEvent = app.listen(w._thisWindow, 'activated', w._handler.onblurhandler);
            w.eventsInitialized = true;
        }

        let windowDataInit = function () {
            if (!w) {
                //ODS('windowDataInit - window not exists');
                return;
            }
            if (!w.isloaded) {
                if (w.windowIsLoaded) {
                    w.doLoaded();
                }
                requestTimeout(windowDataInit, 10);
                return;
            }

            if (w._handler && w.windowIsLoaded)
                w.setValue('menuHandlerOrig', w._handler.menuHandler);
            if (!w.windowInitialized) {
                w.getValue('requirejs')('controls/popupmenupopup');
                w.windowInitialized = true;
                if (w._handler)
                    w._handler.loaded = true;
            }
        };

        windowDataInit();
    };

    let uninitializeWindow = function (w) {
        if (w.eventsInitialized) {
            if (w.windowIsLoaded) app.unlisten(w, 'closed', w.closed);
            if (w._movedEvent) app.unlisten(w._thisWindow, 'moved', w._movedEvent);
            if (w._mouseStateChangedEvent) app.unlisten(w._thisWindow, 'mouseStateChanged', w._mouseStateChangedEvent, true); // PETR: do not close submenu (#14014)
            if (w._activatedEvent) app.unlisten(w._thisWindow, 'activated', w._activatedEvent);

            w._movedEvent = w._mouseStateChangedEvent = w._activatedEvent = undefined;

            w.eventsInitialized = undefined;
        }
    };

    let createNewWindow = function () {
        mainWnd = app.dialogs.getMainWindow();
        let w = mainWnd.createOwnWindow('file:///dialogs/menu.html', {
            left: 0,
            top: 0,
            bordered: false,
            flat: true,
            atTopMost: true,
            width: -1,
            height: -1,
            show: false,
            ismenu: true,
            beforeLoadCode: 'window.doNotCheckLess=true;'
        }); // @ts-ignore
        w._menuWindowIdx = windowIdx++; // @ts-ignore
        w.isloaded = false; // @ts-ignore
        w.doInitialize = function (w, handler) {
            initializeWindow(w, handler, thisWindow);
        }; // @ts-ignore
        w.doLoaded = function () {
            app.unlisten(this, 'load', this.doLoaded);

            this.setValue('nativeWindow', this);

            this.isloaded = true;
            this.resizeable = false;

            if (!this._handler || this._handler.closeAfterLoad) {
                if (!this._handler || !this._handler.menuHandler || this._handler.menuHandler.ownwindow) {
                    if (this.hideWindow) {
                        //ODS('Menu w.loaded - closing after load');
                        this.hideWindow();
                    }
                }
            }
        }.bind(w); // @ts-ignore
        app.listen(w, 'load', w.doLoaded);

        windows.push(w);
        return w;
    };

    let hookWindowMouse = function (_thisWindow) {
        if (_thisWindow && !_thisWindow._globalMouseStateChangedEvent) {
            let onmousestatehandler = function (x, y, hitTestCode, lButtonDown, mButtonDown, rButtonDown, lButtonDblClick, mButtonDblClick, rButtonDblClick) {
                //console.log(arguments);
                if ((!usingTouch) && (lButtonDown || mButtonDown || rButtonDown) && (!thisWindow.getValue('popupWindow').ptInAnyMenuWindow(x, y))) {
                    thisWindow.getValue('popupWindow').closeAll();
                }
            }; // PETR: do not close submenu (#14014)

            _thisWindow._globalMouseStateChangedEvent = app.listen(_thisWindow, 'mouseStateChanged', onmousestatehandler, true); // PETR: do not close submenu (#14014)
        }
    };

    let unhookWindowMouse = function (_thisWindow) {
        if (_thisWindow && _thisWindow._globalMouseStateChangedEvent) {
            app.unlisten(_thisWindow, 'mouseStateChanged', _thisWindow._globalMouseStateChangedEvent, true);
            _thisWindow._globalMouseStateChangedEvent = undefined;
        }
    };

    let addMethods = function (w) {

        w.addChildWindow = function (subWin) {
            if (this) {
                this.__childs = this.__childs || [];
                this.__childs.push(subWin);
                this.__level = this.__level || 1;
                subWin.__level = this.__level + 1;
            }
        }.bind(w);

        w.setWindowBounds = function (l, t, w, h) {
            this.__goingToShow = true;
            this.bounds.setBounds(Math.ceil(l), Math.ceil(t), Math.ceil(w), Math.ceil(h));
        }.bind(w);

        w.setWindowSize = function (w, h) {
            this.__goingToShow = true;
            this.bounds.setSize(Math.ceil(w), Math.ceil(h));
        }.bind(w);

        w.hideWindow = function () {
            //console.log('********* hideWindow called from ' + app.utils.logStackTrace());
            for (let wnd in this.__childs) { // @ts-ignore
                if (wnd.hideWindow) // @ts-ignore
                    wnd.hideWindow();
            }
            this.__childs = [];
            this.__goingToShow = undefined;
            this.hide();
            this.closed();
            if (this.windowInitialized) {
                this.getValue('afterClose')();
            }
            // no need to call unlock as it is called inside 'closed' method
        }.bind(w);

        w.showWindow = function () {
            let initAndShow = function () {
                if (this._handler && !this._handler.closeAfterLoad) {
                    this.__goingToShow = true;
                    if (this.windowInitialized) {
                        requestAnimationFrame(function () {
                            if (this.getValue('resizeAndShow') && this.__goingToShow && this._handler && this.__locked && !this._handler.closeAfterLoad) { // this method is defined in popupmenupopup.js
                                this.getValue('resizeAndShow')();
                                popupWindow.createBlockDiv();
                            } else
                                this.unlock();
                        }.bind(this));
                    } else {
                        requestAnimationFrameMM(initAndShow);
                    }
                } else
                    this.unlock();
            }.bind(this);

            initAndShow();
        }.bind(w);

        w.closed = function () {
            //ODS('Menu w.closed');
            if (this._handler && this._handler.menuHandler && this._handler.menuHandler.onmenuclosed)
                this._handler.menuHandler.onmenuclosed();

            if (this.unlock)
                this.unlock();
        }.bind(w);

    };

    /*
    let getLastUsedWindow = function () {
        let wnd = undefined;
        for (let i = 0; i < windows.length; i++) {
            if (windows[i].__locked && windows[i].isloaded) {
                wnd = windows[i];
            } else {
                break;
            }
        }
        return wnd;
    };
    */

    let getAvailableWindow = function () {
        for (let i = 0; i < windows.length; i++) {
            if (!windows[i].__locked) {
                return windows[i];
            }
        }
        return undefined;
    };

    if (usePopupMenuWindows()) {
        if (!isMainWindow) { // we need to always use popupWindow class from main window
            mainWnd = app.dialogs.getMainWindow();
            window.popupWindow = mainWnd.getValue('popupWindow');
        } else {
            window.popupWindow = {
                prepareWindow: function () {
                    let win = getAvailableWindow();
                    if (!win) {
                        win = createNewWindow();
                    }
                    addMethods(win);
                },
                getWindowAndLock: function (handler, _thisWindow) {
                    let win = getAvailableWindow();
                    if (!win) {
                        win = createNewWindow();
                    }
                    win.__locked = true;
                    if (++activeWindows === 1) {
                        hookWindowMouse(_thisWindow);
                    }
                    win.unlock = function () {
                        if (!win.__locked)
                            return; // already unlocked
                        if (win._handler && win._handler.menuHandler && win._handler.menuHandler.onmenuclosed)
                            win._handler.menuHandler.onmenuclosed();
                        win.__locked = undefined;
                        let oldThisWindow = win._thisWindow;
                        uninitializeWindow(win);
                        if (win.isloaded && win.visible) {
                            win.hideWindow();
                        }
                        
                        if (win._handler && (win._handler != handler) && win._handler.menuHandler) {
                            win._handler.menuHandler.cleanUp();
                            delete win._handler.menuHandler;
                            win._handler.menuHandler = null;
                        }                        

                        win._handler = undefined;
                        win._thisWindow = undefined;
                        win._mainWindow = undefined;
                        activeWindows--;
                        if (activeWindows === 0) { // need to be here, because in case more than 1 menu window is hiding
                            menuClosedTimestamp = Date.now();
                            popupWindow.removeBlockDiv(true);

                            // force closing MainMenu, so arrwos can be used in other lists
                            if (window.mainMenuButton && window.mainMenuButton.controlClass &&  // @ts-ignore
                                window.mainMenuButton.controlClass.forceClose) // @ts-ignore
                                window.mainMenuButton.controlClass.forceClose();

                            unhookWindowMouse(oldThisWindow);
                        }
                    };
                    initializeWindow(win, handler, _thisWindow);
                    return win;
                },
                createBlockDiv: function () {
                    __createBlockDiv();
                },
                removeBlockDiv: function (forceClose) {
                    __removeBlockDiv(forceClose);
                },
                getMainRect: function (w) {
                    if (w) {
                        if (w._thisWindow.maximized)
                            return w._thisWindow.bounds.clientRect;
                        else
                            return w._thisWindow.bounds.windowRect;
                    } else
                        return bounds.windowRect;
                },
                ptInAnyMenuWindow: function (x, y) {
                    for (let i = 0; i < windows.length; i++) {
                        let w = windows[i];
                        if (w.visible) {
                            let rect = w.bounds.windowRect;
                            if ((rect.left < x && rect.right > x) &&
                                (rect.top < y) && (rect.bottom > y)) {
                                return true;
                            }
                        }
                    }
                    return false;
                },
                cleanUp: function () {
                    for (let i = 0; i < windows.length; i++) {
                        let w = windows[i];
                        uninitializeWindow(w);
                        app.unlisten(w);
                    }
                    __removeBlockDiv();
                },
                closeAll: function () {
                    //console.log('********* closeAll called from ' + app.utils.logStackTrace());
                    for (let i = 0; i < windows.length; i++) {
                        let w = windows[i];
                        if (w.__locked && !w.isloaded) {
                            w._handler.closeAfterLoad = true;
                        }
                        if (w.visible) {
                            w.hideWindow();
                        }
                    }
                },
                readyToHandleHotKey: function (e) {
                    if (friendlyKeyName(e) === 'Esc') // do not block ESC key
                        return true;
                    return !this.menuVisible() && (menuClosedTimestamp + 250 /*ms*/ < Date.now());
                },
                menuVisible: function () {
                    return activeWindows > 0;
                },
                menuWindowsOpened: function () {
                    return activeWindows;
                },
                menuReallyVisible: function () {
                    if (activeWindows > 0) {
                        for (let i = 0; i < windows.length; i++) {
                            let w = windows[i];
                            if (w.__locked && w.isloaded && w.visible) {
                                return true;
                            }
                        }
                    }
                    return false;
                },
            };
        }
    }

    window.isMenuVisible = function () {
        if (usePopupMenuWindows()) {
            if (thisWindow.getValue('popupWindow'))
                return thisWindow.getValue('popupWindow').menuVisible();
        } else
            return false;
    };

}());


/**
Base static class for Window.menus property.

@class Menus
@static
*/

/**
Object with several methods for working with menus.

@property menus
@for Window
@type Menus
*/
if (!window.menus) // prepare object for menu generation functions
    window.menus = {};

/**
Creates Menu object by merging context menu items from the sourceElement and menuItemsToAdd.

@method createMergedMenu
@for Menus
@param {Object} parent Parent element for the menu.
@param {Array} menuItemsToAdd Array of menu items to add.
@param {HTMLElement} [sourceElement] HTML element, which has context menu to merge.
@return {Menu} Created Menu object.
*/

window.menus.createMergedMenu = function (parent, menuItemsToAdd, sourceElement) {
    if (sourceElement && sourceElement.controlClass) {
        return new Menu(sourceElement.controlClass.getContextMenuItems().concat(menuItemsToAdd), {
            parent: parent
        });
    } else {
        return new Menu(menuItemsToAdd, {
            parent: parent
        });
    }
};

/**
Eliminates redundant separators

@method eliminateSeparators
@for Menus
@param {Array} items Menu items to eliminate separators from
@return items {Array} Filtered items (with eliminated separators)
*/
window.menus.eliminateSeparators = function (items) {
    for (let i = 0; i < items.length - 1; i++) {
        // eliminate siblings separators 
        if (items[i].separator && items[i + 1].separator) {
            items.splice(i, 1);
            break;
        }
    }
    if (items.length > 0 && items[0].separator)
        items.splice(0, 1); // eliminate the first separator    
    if (items.length > 0 && items[items.length - 1].separator)
        items.splice(items.length - 1, 1); // eliminate the last separator
    return items;
};

/**
Base class for popup menu

@class Menu
@constructor
@extends Control
@param {Array|Function} menuitems Array of menu items to add or function returning array of menu items or promise.
@param {Object} [params] Object with optional parameters. Possible parameters:<br><ul>
    <li>parent {Object}: parent object for the menu. Could be used by some menu actions, passed as second parameter to execute method of the menu item.</li>
</ul>
    
*/
window.Menu = function (menuitems, params) {
    // set passed attributes
    if (!menuitems)
        menuitems = []; // to fix #20962
    // @ts-ignore
    this.menuHandler = new MenuHandler({
        menuitems: menuitems
    });
    for (let key in params) {
        this.menuHandler[key] = params[key];
    }
    if (params && params.menuwindow) {
        this.w = params.menuwindow;
        if (usePopupMenuWindows()) {
            this.w.doInitialize(this.w, this);
        }
        this.menuHandler.ownwindow = false;
        this.loaded = true;
    } else {
        this.menuHandler.ownwindow = true;
    }

    if (usePopupMenuWindows()) {
        let actioncalled = function (params) {
            if (!params || !params.ctrlKey) {
                this.close();
            }
        }.bind(this);
        if (this.menuHandler.onactioncalled === undefined)
            this.menuHandler.onactioncalled = actioncalled;
    } else {
        this.windowDataInit = function () { }.bind(this);
    }

    if (!usePopupMenuWindows() && (!params || !params.issubpopup)) {
        this.onblurhandler = function (evt) {
            this.close();
        }.bind(this);

        this.mousestatechangedHandler = function (x, y, hitTest, lDown, mDown, rDown) {
            //ODS('--- MouseStateChanged - X=' + x + ',Y=' + y + ',hitTest=' + hitTest + ',lDown=' + lDown + ',mDown=' + mDown + ',rDown = ' + rDown);
            let rect = window.bounds.clientRect;
            if ((lDown || mDown || rDown) && ((x < rect.left) || (x > rect.right) || (y < rect.top) || (y > rect.bottom))) {
                this.close();
            }
        }.bind(this);
    } else {
        if (usePopupMenuWindows()) {
            this.onblurhandler = function (evt, nc) {
                if (typeof evt === 'boolean') {
                    if (evt)
                        return;
                }
                if (!isMainWindow || nc) {
                    this.close(true); // PETR: do not close submenu (#14488) - main window blur is handled by overlay
                }
            }.bind(this);
            this.onmovedhandler = function () {
                this.close(true);
            }.bind(this);
            this.onmousestatehandler = function (x, y, hitTestCode, lButtonDown, mButtonDown, rButtonDown, lButtonDblClick, mButtonDblClick, rButtonDblClick) {
                //console.log(arguments);
                if ((!usingTouch) && (lButtonDown || mButtonDown || rButtonDown) && (!thisWindow.getValue('popupWindow').ptInAnyMenuWindow(x, y)) && (thisWindow.getValue('popupWindow').menuReallyVisible())) {
                    this.close(true);
                }
            }.bind(this); // PETR: do not close submenu (#14014)
        }
    }


};

Menu.prototype.focusHandler = function (element, newState) { };

Menu.prototype.show = function (screenX, screenY, oppositeX, forceCloseAll) {

    if (forceCloseAll && usePopupMenuWindows()) {
        thisWindow.getValue('popupWindow').closeAll();
    }

    let popupWindowShow = function (doInit) {
        let initAndShow = function () {
            if (window._cleanUpCalled || !this.menuHandler)
                return;
            if (!this.w || !this.w.__locked)
                this.w = thisWindow.getValue('popupWindow').getWindowAndLock(this, thisWindow);

            if (this.w && this.w._cleanUpCalled)
                return;

            if (this.w && this.w.windowInitialized && !this.w._handler.closeAfterLoad) {
                if (doInit) {
                    this.w.getValue('initMenu')(screenX, screenY, oppositeX, this.w, this.menuHandler.showAccessKeys, this.menuHandler.helpContext);
                    if (thisWindow.getValue('nativeWindow')) {
                        thisWindow.getValue('nativeWindow').addChildWindow(this.w);
                    }
                }
            } else {
                if (this.w) {
                    requestAnimationFrameMM(initAndShow);
                }
            }
        }.bind(this);

        initAndShow();
    }.bind(this);

    if (!this.w) {
        if (usePopupMenuWindows()) {
            popupWindowShow(true);
        } else {
            let actioncalled = function (params) {
                if (!params || !params.ctrlKey) {
                    this.close();
                }
            }.bind(this);
            // @ts-ignore
            this.w = new InnerWindow({
                left: screenX,
                top: screenY,
                clearWindow: this.menuHandler.clearWindow.bind(this.menuHandler),
                initMenu: this.menuHandler.initMenu.bind(this.menuHandler),
                forcedCloseWindow: this.menuHandler.forcedCloseWindow.bind(this.menuHandler)
            });
            this.menuHandler.window = this.w;
            this.menuHandler.parentel = this.w.windowDiv;
            if (this.menuHandler.onactioncalled === undefined)
                this.menuHandler.onactioncalled = actioncalled;
            this.loaded = false;
        }
    } else {
        if (!this.loaded || !this.w.getValue('clearWindow')) {
            requestAnimationFrameMM(function () {
                this.show(screenX, screenY, oppositeX);
            }.bind(this));
            return;
        }

        this.w.getValue('clearWindow')();
        if (!usePopupMenuWindows()) {
            this.windowDataInit();
            this.w.getValue('requirejs')('controls/popupmenupopup');
            this.w.getValue('initMenu')(screenX, screenY, oppositeX, this.w, this.menuHandler.showAccessKeys);
        } else {
            popupWindowShow(true);
        }
        return;
    }
    if (!usePopupMenuWindows()) {

        this.w.loaded = function () {
            //ODS('Menu w.loaded ');
            if (!this.w) {
                //ODS('Menu w.loaded - window not exists');
                return;
            }
            if (this.closeAfterLoad) {
                if (this.menuHandler.ownwindow) {
                    //ODS('Menu w.loaded - closing after load');
                    this.w.closeWindow();
                    window.activate();
                }
                return;
            }
            this.loaded = true;
            this.w.resizeable = false;
            this.w.bordered = false;
            this.w.atTop = true;
            this.windowDataInit();
            // prepare source html
            this.w.getValue('initMenu')(screenX, screenY, oppositeX);
            this.w.show();
        }.bind(this);

        this.w.closed = function () {
            //ODS('Menu w.closed');
            if (!this.menuHandler.issubpopup) {
                app.unlisten(window, 'blur', this.onblurhandler);
                app.unlisten(thisWindow, 'mousestatechanged', this.mousestatechangedHandler);
            }
            this.w = undefined;
            if (this.menuHandler.onmenuclosed)
                this.menuHandler.onmenuclosed();
        }.bind(this);


        if (!this.menuHandler.issubpopup) {
            app.listen(window, 'blur', this.onblurhandler);
            app.listen(thisWindow, 'mousestatechanged', this.mousestatechangedHandler);
        }
        this.w.loaded();
    }
};
Menu.prototype.close = function (closeAll) {
    if (this.w) {
        if ((!usePopupMenuWindows() && !this.loaded) || (!this.w.isloaded && usePopupMenuWindows())) { // closing before loaded
            //ODS('forcedCloseWindow - Menu.prototype.close not loaded window');
            this.closeAfterLoad = true;
            if (closeAll && usePopupMenuWindows()) {
                thisWindow.getValue('popupWindow').closeAll();
            }
            if (this.menuHandler && this.menuHandler.onmenuclosed)
                this.menuHandler.onmenuclosed();
        } else {
            let cf = this.w.getValue('forcedCloseWindow');
            if (cf) {
                //ODS('forcedCloseWindow - Menu.prototype.close');
                cf();
            } else {
                //ODS('*** menu close - forcedCloseWindow does not exist');
            }
            if (closeAll && usePopupMenuWindows()) {
                thisWindow.getValue('popupWindow').closeAll();
            }
        }
        if (usePopupMenuWindows() && this.w) {
            this.w.unlock();
            this.w = undefined;
        }
    }
};

let _loadersRunning = 0;
let doLoadIcon = function (iconName, dest) {
    _loadersRunning++;
    loadIconFast(iconName, function (icon) {
        setIconFast(dest, icon);
        _loadersRunning--;
    });
};

// -----------------------------------------------------------------

class MenuHandler {
    left: number;
    top: number;
    _localPromises: any[];
    onblurHandler: any;
    checkclosemenu: any;
    private _mouseupSet: boolean;
    private _scrollEventsSet: boolean;
    mouseouthandler: any;
    mouseoverhandler: any;
    window: any;
    divs: any[];
    subpopup: any;
    nativeWindow: any;
    onmenuclosed: any;
    ownwindow: any;
    parentel: HTMLDivElement;
    items: any;
    menuitems: any;
    selectedItem: any;
    _cleanUpCalled: boolean;
    _menuItemsPromise: any;
    canvas: any;
    menucontainer: HTMLDivElement;
    focusedItem: any;
    viewport: HTMLDivElement;
    scrollDown: HTMLDivElement;
    scrollUp: HTMLDivElement;
    layoutchangehandler: any;
    lessloadedhandler: any;

    constructor(params) {
        this.left = 0;
        this.top = 0;
        this._localPromises = [];

        for (let key in params) {
            this[key] = params[key];
        }

        if (!this.menuitems)
            this.menuitems = []; // #20962

        if (usePopupMenuWindows()) {
            this.onblurHandler = function () {
                if (!this.subpopup && this.ownwindow) {
                    this.forcedCloseWindow();
                    if (this.onactioncalled)
                        this.onactioncalled();
                }
            }.bind(this);

            requestAnimationFrameMM(function () {
                // prepare window in cache
                getValue('popupWindow').prepareWindow();
            }.bind(this));
        } else {
            this.checkclosemenu = function (e) {
                if (this.window) {
                    if ((e.button === 2) && (!builtInMenu)) { // OSX displays contextmenu already after mousedown, so first mouseup event for right button is fired after contextpopup
                        let timeFromInit = Date.now() - this.initTime;
                        this.initTime = 0;
                        if (timeFromInit < 400)
                            return;
                    } else if (e.button === 0) {
                        // test only left button
                        for (let element = e.target; element; element = element.parentNode) {
                            if (element.classList && (element.classList.contains('menuitem') || element.classList.contains('menuButton')) /* && !element.classList.contains('mainmenuitem')*/) {
                                return;
                            }
                        }
                    }
                    //ODS('*** button='+e.button + ', ScreenX='+e.screenX+', screenY='+e.screenY+', window.top='+this.window.bounds.top+', window.left='+this.window.bounds.left+', window.width='+this.window.bounds.width+', window.height='+this.window.bounds.height);

                    //ODS('forcedCloseWindow - checkclosemenu');
                    this.forcedCloseWindow();
                }
            }.bind(this);
        }
    }

    forcedCloseWindow() {
        this.cleanUp();
        if (this.subpopup) {
            this.subpopup.close();
            this.subpopup = undefined;
        }
        if (this.ownwindow) {
            //ODS('--- forcedCloseWindow, closing when own window');
            if (this.window) {
                if (this.nativeWindow) {
                    this.nativeWindow.hideWindow();
                } else {
                    this.window.closeWindow();
                }
                this.window = undefined;
            }
            this.parentel = undefined;
        } else {
            //ODS('--- forcedCloseWindow, hiding');
            if (this.nativeWindow) {
                this.nativeWindow.hideWindow();
            } else {
                this.window.hide();
            }
            if (this.onmenuclosed) {
                this.onmenuclosed();
            }
        }
    }

    clearWindow() {
        this.cleanUpLight();
        if (!usePopupMenuWindows()) {
            if (this._mouseupSet) {
                app.unlisten(window, 'mouseup', this.checkclosemenu, true);
                this._mouseupSet = false;
            }
        }
        if (this.items) {
            this.menuitems = undefined;
        }
        if (this.subpopup) {
            this.subpopup.close();
            this.subpopup = undefined;
        }
        this.selectedItem = null;
        this.divs = [];
    }

    localPromise(promise) {
        let _this = this;
        let _uid = createUniqueID();
        let pr = promise.then1(function (e) {
            _this._localPromises[_uid] = undefined;
            return e;
        });
        this._localPromises[_uid] = promise;
        return promise; // return the original promise, not the pr (as pr does not reject because of then1 usage)
    }

    cleanUpPromises = function () {
        for (let ids in this._localPromises) {
            if ((this._localPromises[ids]) && (isPromise(this._localPromises[ids]))) {
                cancelPromise(this._localPromises[ids]);
            }
        }
        this._localPromises = [];
    };

    initMenu = function (screenX, screenY, oppositeX) {
        if (window._cleanUpCalled) // app started closing before calling this
            return;
        let _this = this;

        this.initTime = Date.now();
        if (!this._initialized) {
            if (usePopupMenuWindows()) {
                this.menucontainer = document.createElement('div');
                this.menucontainer.classList.add('innerWindow');
                this.parentel.appendChild(this.menucontainer);
            } else
                this.menucontainer = this.parentel;

            this.canvas = document.createElement('div');
            this.canvas.classList.add('menuCanvas');
            this.canvas.tabIndex = 999; // Tab index makes sure that we can get focus

            this.menucontainer.appendChild(this.canvas);

            if (this.helpContext) {
                this.canvas.setAttribute('data-help', this.helpContext);
            }

            // disable context menu in popups
            app.listen(this.canvas, 'contextmenu', function (e) {
                e.stopPropagation();
            }, true);

            let closeSubmenu = function () {
                if (_this.subpopup) {
                    _this.subpopup.close();
                    _this.subpopup = undefined;
                }

                if (_this.focusedItem) {
                    _this.focusedItem.removeAttribute('data-focused');
                    _this.focusedItem = undefined;
                }
            };
            this.scrollUp = document.createElement('div');
            this.scrollUp.className = 'menuScrollBtn up';
            doLoadIcon('upArrow', this.scrollUp);
            this.canvas.appendChild(this.scrollUp);
            this.viewport = document.createElement('div');
            this.viewport.className = 'menuViewport dynamic';
            this.canvas.appendChild(this.viewport);
            this.scrollDown = document.createElement('div');
            this.scrollDown.className = 'menuScrollBtn down';
            doLoadIcon('downArrow', this.scrollDown);
            this.canvas.appendChild(this.scrollDown);

            app.listen(this.scrollUp, 'mouseenter', function (evt) {
                if (evt)
                    evt.stopPropagation();
                closeSubmenu();
            });
            app.listen(this.scrollDown, 'mouseenter', function (evt) {
                if (evt)
                    evt.stopPropagation();
                closeSubmenu();
            });

            this.items = document.createElement('div');
            this.items.classList.add('menu');
            this.items.style.top = '0px';
            this.viewport.appendChild(this.items);

            this._initialized = true;
        }

        this.selectedItem = null;
        this.mouseIn = true;
        this.divs = [];
        this.pageItemCount = 0;
        this.makeItemVisible = undefined;

        let _prepareScroll = function (fullh, h) {
            this.scrollUp.style.display = 'block';
            this.scrollDown.style.display = 'block';
            let scrollUpHeight = Math.ceil(getFullHeight(this.scrollUp));
            let scrollDownHeight = Math.ceil(getFullHeight(this.scrollDown));
            let sh = scrollUpHeight + scrollDownHeight;
            let viewportHeight = (h - sh - Math.ceil(getOuterHeight(this.viewport) + getOuterHeight(this.canvas)) + 1);
            this.viewport.style.height = viewportHeight + 'px';
            let scrolling_delta = 0;
            let scroll_interval = 300;
            let scroll_step = 40;
            this.pageItemCount = Math.max(Math.floor(viewportHeight / this.divs[0].clientHeight) - 1, 1);

            let _scroll = function (delta, cont) {
                if (this._cleanUpCalled)
                    return;
                let t = parseInt(this.items.style.top);
                let mint = h - fullh - sh;
                t += delta;
                if (t > 0)
                    t = 0;
                if (t < mint)
                    t = mint;
                this.items.style.top = t + 'px';
                if (cont && (scrolling_delta !== 0)) {
                    requestTimeout(function () {
                        _scroll(scrolling_delta, true);
                    }, 300);
                }
            }.bind(this);

            this.makeItemVisible = function (div) {
                let divh = div.clientHeight;
                let divt = div.offsetTop;
                let itemt = _this.items.style.top ? parseInt(_this.items.style.top) : 0;
                let scrolld = divt + itemt;
                if (scrolld < 0) {
                    _scroll(-scrolld);
                } else {
                    scrolld += divh - viewportHeight;
                    if (scrolld > 0)
                        _scroll(-scrolld);
                }
            };

            let _mouseWheelHandler = function (evt) {
                let delta = scroll_step * (evt.wheelDelta / 120);
                _scroll(delta);
            }.bind(this);

            let _mouseOverHandler = function (evt) {
                scrolling_delta = (evt.currentTarget == this.scrollUp) ? scroll_step : -scroll_step;
                requestTimeout(function () {
                    _scroll(scrolling_delta, true);
                }, scroll_interval);
            }.bind(this);

            let _mouseOutHandler = function (evt) {
                scrolling_delta = 0;
            }.bind(this);

            if(this._scrollEventsSet) {
                app.unlisten(this.viewport, 'mousewheel');
                app.unlisten(this.scrollUp, 'mouseover');
                app.unlisten(this.scrollDown, 'mouseover');
                app.unlisten(this.scrollUp, 'mouseout');
                app.unlisten(this.scrollDown, 'mouseout');
            }

            app.listen(this.viewport, 'mousewheel', _mouseWheelHandler);
            app.listen(this.scrollUp, 'mouseover', _mouseOverHandler);
            app.listen(this.scrollDown, 'mouseover', _mouseOverHandler);
            app.listen(this.scrollUp, 'mouseout', _mouseOutHandler);
            app.listen(this.scrollDown, 'mouseout', _mouseOutHandler);
            this._scrollEventsSet = true;
        }.bind(this);

        let menuitems = [];

        let callAction = function (action, div, params) {
            params = params || {};
            if ((action.checkable) && (action.changedstate === undefined)) {
                action.changedstate = !div.icondiv.controlClass.checked;
                if (!isFunction(action.checked)) {
                    action.checked = action.changedstate;
                }
            }
            if (action.execute !== undefined) {
                action.execute.apply(action);
                if (!action.noCloseAfterExecute) {
                    if (_this.onactioncalled) {
                        _this.onactioncalled(params);
                    }
                    _this.forcedCloseWindow();
                }
            }
            if (div.submenu) {
                if (!_this.subpopup) {
                    if (params.mouseoverhandler)
                        params.mouseoverhandler();
                }
            }
        };

        let openSubmenu = function (action, div, byMouse?: boolean) {
            if ((_this.subpopup === undefined) && (div.offsetWidth > 0)) {
                let submenuclosed = function () {
                    //ODS('--- submenuclosed');
                    div.removeAttribute('data-selected');
                    if (_this.subpopup) {
                        if (_this.subpopup.menuHandler) {
                            _this.subpopup.menuHandler.cleanUp();
                            delete _this.subpopup.menuHandler;
                            _this.subpopup.menuHandler = undefined;
                        }
                        delete _this.subpopup;
                    }
                    _this.subpopup = undefined;
                    _this.selectedItem = null;
                    if(_this.canvas)
                        _this.canvas.focus();
                    if (_this.mouseIn || div.hasAttribute('data-focused')) {
                        if (window['activate'] && visible)
                            activate(); // prev. menu is deactivated after the submenu is closed for some reason, reactivate
                    } else
                    if (!_this.ownwindow)
                        _this.forcedCloseWindow();
                };
                _this.subpopup = new Menu(action.submenu, {
                    issubpopup: true,
                    parent: _this.parent,
                    parentMenuAction: action,
                    rootMenuAction: _this.rootMenuAction || action,
                    onmenuclosed: submenuclosed,
                    onactioncalled: _this.onactioncalled,
                    onkeydown: _this.onkeydown,
                    byMouse: byMouse,
                    showAccessKeys: !byMouse,
                    bindFn: _this.bindFn
                });
                //ODS('*** created submenu');
                let pos = findScreenPos(div);
                _this.subpopup.show(pos.left + div.offsetWidth, pos.top, pos.left);
                div.setAttribute('data-selected', 1);
                _this.selectedItem = div;
            }
        };

        let _generateItems = function (items, justUpdate) {
            let mitems = [];
            if (this._cleanUpCalled || !items || !this.items)
                return;

            if (justUpdate)
                items.push(actions.loading); // loading placeholder

            if (this.divs && (this.divs.length > 0)) {
                if (!justUpdate) // #18604
                    this.cleanUpLight();
                cleanElement(this.items);
                this.divs = [];
                if (this.nativeWindow) {
                    this.nativeWindow.setWindowSize(0, 0);
                } else
                    this.window.bounds.setSize(0, 0);
            }

            for (let i = 0; i < items.length; i++) {
                let mitem;
                if (!items[i].action) {
                    mitem = {
                        action: items[i],
                        order: items[i].order,
                        grouporder: items[i].grouporder,
                        grouptitle: items[i].grouptitle
                    };
                } else
                    mitem = items[i];
                if (mitem.order === undefined)
                    mitem.order = 10 * (i + 1);
                if (mitem.grouporder === undefined)
                    mitem.grouporder = 1000;

                if (this.bindFn && mitem.action)
                    mitem.action = bindAction(mitem.action, this.bindFn);

                mitems.push(mitem);
            }
            // sort by grouporder and order
            mitems.sort(function (i1, i2) {
                let retval = i1.grouporder - i2.grouporder;
                if (retval === 0)
                    retval = i1.order - i2.order;
                return retval;
            });
            // insert to menuitems, add separators between groups
            menuitems = [];
            let lastgroup = undefined;
            let lastsep = undefined;
            let addItem = function (mitem) {
                if (((lastgroup !== undefined) || mitem.grouptitle) && (lastgroup !== mitem.grouporder)) {
                    lastsep = copyObject(menuseparator);
                    if (mitem.grouptitle) {
                        lastsep.title = mitem.grouptitle;
                    }
                    menuitems.push(lastsep);
                } else if (lastsep && !lastsep.title && mitem.grouptitle) {
                    lastsep.title = mitem.grouptitle;
                }

                lastgroup = mitem.grouporder;
                menuitems.push(mitem.action);
            };

            let _this = this;
            let processMenuItem = function (mitem) {
                let isvisible = resolveToValue(mitem.action.visible, true, undefined, mitem.action /*bind*/);
                mitem.action.visiblePromiseResult = undefined;
                if (isvisible && (typeof isvisible === 'object')) {
                    mitem.action.visiblePromiseResult = false;
                    _this.localPromise(isvisible).then(function (res) {
                        if (_this._cleanUpCalled || window._cleanUpCalled)
                            return; // menu was destroyed meanwhile

                        mitem.action.visiblePromiseResult = res;
                        if (mitem.action.divItem && getDocumentBody().contains(mitem.action.divItem)) {
                            if (res) {
                                setVisibility(mitem.action.divItem, true);
                            } else {
                                let itemIndex = _this.divs.indexOf(mitem.action.divItem);
                                if (itemIndex >= 0) {
                                    _this.divs.splice(itemIndex, 1);
                                    // update indexes, they changed
                                    for (let i = itemIndex; i < _this.divs.length; i++) {
                                        _this.divs[i].itemIndex = i;
                                    }
                                }

                                mitem.action.divItem.remove();
                                _this.removeDoubleSeparator();
                                _this._canvasHeight = Math.ceil(getFullHeight(_this.canvas));
                            }                        
                            if (_this.windowSizeUpdate)
                                _this.windowSizeUpdate(true);
                        }
                        mitem.action.divItem = undefined;
                    }, function () {
                        mitem.action.divItem = undefined;
                    });
                    addItem(mitem);
                } else
                if (isvisible) {
                    addItem(mitem);
                }
            };

            this.removeDoubleSeparator = function () {
                let child = this.items.firstChild;
                let last = undefined;
                while (child) {
                    if (child.classList.contains('menuseparator')) {
                        if (last) {
                            if (last.classList.contains('menuseparator')) // last was separator as well
                                last.remove();
                        } else {
                            // first item is separator, remove
                            last = child.nextSibling;
                            child.remove();
                            child = last;
                            continue;
                        }
                    }
                    last = child;
                    child = child.nextSibling;
                    if (!child && last.classList.contains('menuseparator')) { // last item is separator, remove
                        last.remove();
                    }
                }
            }.bind(this);

            for (let i = 0; i < mitems.length; i++) {
                let mitem = mitems[i];
                processMenuItem(mitem);
            }

            this._cleanUpCalled = false;
            this.pageItemCount = menuitems.length;
            forEach(menuitems, function (item, idx) {
                let it = document.createElement('div');
                it.itemIndex = idx;
                if (item.visiblePromiseResult !== undefined) {
                    item.divItem = it;
                    if (item.visiblePromiseResult === false) {
                        it.style.display = 'none';
                    }
                }
                this.divs.push(it);
                let isdisabled = resolveToValue(item.disabled, false, {
                    action: item,
                    parent: item.parent || _this.parent
                }, item);
                let ischecked = resolveToValue(item.checked, false, null, item);
                if (isPromise(ischecked)) {
                    let prom = ischecked;
                    ischecked = false;
                    _this.localPromise(prom).then(function (ret) {
                        if (_this._cleanUpCalled || window._cleanUpCalled)
                            return; // menu was destroyed meanwhile
                        if (ret) {
                            if ((item.radiogroup !== undefined) || (item.checkable)) { // @ts-ignore
                                it.icondiv.controlClass.checked = true;
                            } else {
                                it.setAttribute('data-checked', '1');
                            }
                        }
                    });
                }

                it.className = 'menuitem';
                let action = item;
                this.items.appendChild(it);
                if (item.separator) {
                    if (item.title) {
                        // separator with title
                        it.classList.add('menuseparator');
                        it.classList.add('entitledseparator');
                        it.setAttribute('data-disabled', '1');
                        let sepContainer = document.createElement('div');
                        sepContainer.classList.add('stretchWidth');
                        it.appendChild(sepContainer);
                        let sep = document.createElement('hr');
                        sepContainer.appendChild(sep);
                        let sepText = document.createElement('div');
                        sepText.textContent = item.title;
                        sepText.classList.add('separatorText');
                        sepContainer.appendChild(sepText);
                    } else {
                        // simple separator
                        let sep = document.createElement('hr');
                        it.classList.add('menuseparator');
                        it.setAttribute('data-disabled', '1');
                        it.appendChild(sep);
                    }
                } else {
                    if (item.custom) {
                        it.classList.add('menucustom');
                    } else {
                        it.icondiv = document.createElement('div') as ElementWith<Checkbox>;
                        it.icondiv.className = 'menuicon';
                        it.appendChild(it.icondiv);

                        if (item.radiogroup !== undefined) {
                            it.icondiv.controlClass = new Checkbox(it.icondiv, {
                                type: 'radio',
                                name: item.radiogroup
                            }); // @ts-ignore
                            it.icondiv.controlClass.radioChange = function (e) {
                                if (!isFunction(action.checked)) // @ts-ignore
                                    action.checked = it.icondiv.controlClass.checked;
                                if (action.execute !== undefined) {
                                    action.execute();
                                }
                            }; // @ts-ignore
                            app.listen(it.icondiv, 'change', it.icondiv.controlClass.radioChange);
                            if (ischecked) // @ts-ignore
                                it.icondiv.controlClass.checked = ischecked;
                        } else if (item.checkable) {
                            action.changedstate = undefined;
                            it.icondiv.controlClass = new Checkbox(it.icondiv, {
                                type: 'checkbox',
                                checked: ischecked,
                            });
                            let wasCtrlKey = false; // @ts-ignore
                            it.icondiv.controlClass.checkChange = function (e) { // @ts-ignore
                                action.changedstate = it.icondiv.controlClass.checked;
                                if (!isFunction(action.checked)) {
                                    action.checked = action.changedstate;
                                }
                                let params = {
                                    ctrlKey: wasCtrlKey
                                };
                                if (e && (e.ctrlKey !== undefined))
                                    params.ctrlKey = e.ctrlKey;

                                wasCtrlKey = false;
                                callAction(action, it, params);
                                action.changedstate = undefined;
                            }; // @ts-ignore
                            app.listen(it.icondiv, 'change', it.icondiv.controlClass.checkChange, true);
                            // PETR: it is required as 'click' event is not handled by item click handler (we will handle it inside change event)
                            app.listen(it.icondiv, 'click', function (e) {
                                wasCtrlKey = e.ctrlKey;
                                e.stopPropagation();
                            });
                        } else {
                            if (ischecked) {
                                it.setAttribute('data-checked', '1');
                            }

                            let icon = resolveToValue(item.icon, undefined, undefined, item /*bind*/);
                            if (icon) {
                                doLoadIcon(icon, it.icondiv); // it is not cleaned yet
                            }
                        }
                    }
                    it.textdiv = document.createElement('div');
                    it.textdiv.className = 'menutext';
                    let title = resolveToValue(item.title, '', undefined, item /*bind*/);
                    let ak = uitools.getAccessKey(title);

                    if (ak) {
                        if (_this.showAccessKeys && !item.noAccessKey) {
                            it.accessKey = ak.toLowerCase();
                            it.textdiv.innerHTML = title.replace('&' + ak, '<u>' + ak + '</u>');
                        } else {
                            it.textdiv.innerHTML = title.replace('&' + ak, ak);
                        }
                    } else {
                        let sval = isOurHTML(title);
                        if(sval) {
                            it.textdiv.innerHTML = sval;
                        } else {
                            it.textdiv.innerText = title;
                        }
                    }
                    it.appendChild(it.textdiv as Node);

                    if (item.shortcut) {
                        it.shortcutdiv = document.createElement('div');
                        it.shortcutdiv.className = 'menutext';
                        it.shortcutdiv.classList.add('textRight');
                        it.shortcutdiv.innerHTML = resolveToValue(item.shortcut, undefined, undefined, item /*bind*/);
                        it.appendChild(it.shortcutdiv as Node);
                    }

                    if (item.hotlinkExecute && item.hotlinkIcon) {
                        it.hotlink = document.createElement('div');
                        it.hotlink.className = 'menuhotlink';
                        it.appendChild(it.hotlink as Node);
                        app.listen(it.hotlink, 'click', function (e) {
                            e.stopPropagation();
                            item.hotlinkExecute();
                            _this.forcedCloseWindow();
                            thisWindow.getValue('popupWindow').closeAll(); // #19961
                        });
                        doLoadIcon(item.hotlinkIcon, it.hotlink); // it is not cleaned yet
                    }

                    let enabledInit = function (disabled) {
                        if (!disabled) {
                            it.removeAttribute('data-disabled');
                            if (!_this.focusedItem && !_this.byMouse) {
                                _this.focusedItem = it;
                                it.setAttribute('data-focused', '1');
                            }

                            if (action.buttonActions) { // menu item has own buttons, do not use global hover/click
                                initializeControls(it);
                                app.listen(it, 'mouseenter', function (evt) {
                                    if (evt)
                                        evt.stopPropagation();
                                    if (_this.selectedItem && (_this.selectedItem != it)) {
                                        if (_this.subpopup) {
                                            //ODS('*** going to close subpopup');
                                            _this.subpopup.close();
                                            _this.subpopup = undefined;
                                        }
                                    }

                                    if (_this.focusedItem) {
                                        _this.focusedItem.removeAttribute('data-focused');
                                        _this.focusedItem = undefined;
                                    }
                                });
                                forEach(action.buttonActions, function (btnAct) {
                                    let btn = qeid(it, btnAct.id);
                                    if (btn) {
                                        let btnDisabled = resolveToValue(btnAct.disabled, false, {
                                            action: action,
                                            parent: _this.parent
                                        }, action);
                                        if (btnDisabled) {
                                            btn.setAttribute('data-disabled', 1);
                                        } else {
                                            btn.controlClass = btn.controlClass || new Control(btn); // to allow localListen
                                            btnAct.events = btnAct.events || ['click'];
                                            forEach(btnAct.events, function (evtName) {
                                                btn.controlClass.localListen(btn, evtName, function (e) {
                                                    let canClose = btnAct.execute.call(btn, evtName, e);
                                                    if (canClose && _this.onactioncalled && !action.noCloseAfterExecute) {
                                                        let params = {
                                                            ctrlKey: e.ctrlKey
                                                        };
                                                        _this.onactioncalled(params);
                                                    }
                                                });
                                            });
                                            btn.controlClass.localListen(btn, 'mouseenter', function () {
                                                btn.setAttribute('data-focused', 1);
                                            });
                                            btn.controlClass.localListen(btn, 'mouseleave', function () {
                                                btn.removeAttribute('data-focused');
                                            });
                                        }
                                    }
                                });
                            } else {
                                let mouseouthandler = function (evt) {
                                    it.removeAttribute('data-focused');
                                    _this.focusedItem = undefined;
                                    evt.stopPropagation();
                                };

                                let submenu = undefined;
                                if (item.submenu) {
                                    submenu = item.submenu; // @ts-ignore
                                    it.submenu = submenu;
                                    let subicondiv = document.createElement('div');
                                    it.subicondiv = subicondiv;
                                    subicondiv.className = 'submenuicon';
                                    it.appendChild(subicondiv);
                                    doLoadIcon('menuArrow', subicondiv);
                                }
                                let mouseoverhandler = function (evt) {
                                    if (usePopupMenuWindows() && _this.nativeWindow)
                                        if (!visible)
                                            return;
                                    if (evt)
                                        evt.stopPropagation();
                                    if (_this.selectedItem && (_this.selectedItem != it)) {
                                        if (_this.subpopup) {
                                            //ODS('*** going to close subpopup');
                                            _this.subpopup.close();
                                            _this.subpopup = undefined;
                                        }
                                    }

                                    if (submenu) {
                                        openSubmenu(action, it, true /* by mouse */);
                                    }
                                    if (_this.focusedItem != it) {
                                        if (_this.focusedItem) {
                                            _this.focusedItem.removeAttribute('data-focused');
                                        }
                                        it.setAttribute('data-focused', '1');
                                        _this.focusedItem = it;
                                    }
                                };

                                let mouseclick = function (e) {
                                    let haveCheckbox = (item.checkable && it.icondiv.controlClass);
                                    if (haveCheckbox) {
                                        (it.icondiv.controlClass as Checkbox).checked = !(it.icondiv.controlClass as Checkbox).checked;
                                        action.changedstate = (it.icondiv.controlClass as Checkbox).checked;
                                    } else {
                                        action.changedstate = true;
                                    }

                                    if ((action.checked !== undefined) && !isFunction(action.checked)) {
                                        action.checked = action.changedstate;
                                    }
                                    let params = {
                                        mouseoverhandler: mouseoverhandler,
                                        ctrlKey: false
                                    };
                                    if (e && e.ctrlKey)
                                        params.ctrlKey = true;
                                    callAction(action, it, params);

                                    action.changedstate = undefined;
                                };

                                app.listen(it, 'mouseout', mouseouthandler);
                                app.listen(it, 'click', mouseclick);

                                // @ts-ignore
                                it.mouseoverhandler = mouseoverhandler;
                                app.listen(it, 'mouseover', mouseoverhandler);
                            }
                        } else {
                            it.setAttribute('data-disabled', '1');
                        }
                    };
                    if (isPromise(isdisabled)) {
                        it.setAttribute('data-disabled', '1');
                        _this.localPromise(isdisabled).then(function (_disabled) {
                            if (_this.divs) // not cleaned yet
                                enabledInit(_disabled);
                        });
                    } else {
                        enabledInit(isdisabled);
                    }
                }
            }.bind(this));

            this.windowSizeUpdate = function (forceUpdate) {
                if (this._cleanUpCalled || !app || !app.utils || !document.body.contains(this.canvas)) {
                    // this canvas already removed or closing app, return
                    return false;
                }
                let newCanvasWidth = this._canvasWidth;
                let newCanvasHeight = this._canvasHeight;

                if (forceUpdate || !newCanvasWidth || !newCanvasHeight) {
                    newCanvasWidth = Math.ceil(getFullWidth(this.canvas));
                    newCanvasHeight = Math.ceil(getFullHeight(this.canvas));
                }

                let l = parseInt(screenX);
                let t = parseInt(screenY);

                if (usePopupMenuWindows() && this.nativeWindow) { // to move window to correct position (in case target display have set different DPI)
                    this.nativeWindow.bounds.setPosition(l, t);
                }

                this._canvasWidth = newCanvasWidth;
                this._canvasHeight = newCanvasHeight;

                let w = _this._canvasWidth;
                let h = _this._canvasHeight;
                let fullh = Math.max(Math.ceil(getFullHeight(_this.items)) + Math.ceil(getOuterHeight(_this.canvas)), h);
                ODS('menu coords ' + l + 'x' + t);
                let screen = app.utils.getMonitorInfoFromCoords(parseInt(l), parseInt(t));
                if (usePopupMenuWindows()) {
                    if (window.screen.availHeight !== screen.availHeight)
                        screen.availHeight = window.screen.availHeight;

                    let mainLeft = screen.availLeft;
                    if (oppositeX !== undefined) {
                        if (typeof oppositeX === 'boolean' && oppositeX) { // #15866
                            l = l - w;
                        }

                        if (l <= mainLeft)
                            l = mainLeft + 1;
                        let r = l + w + 1;
                        if (r > (mainLeft + screen.availWidth)) {
                            if (typeof oppositeX === 'boolean')
                                l = mainLeft + screen.availWidth - w;
                            else
                                l = oppositeX - w;
                        }
                    }
                    if (l <= mainLeft)
                        l = mainLeft + 1;
                    else {
                        if ((l + w) >= (mainLeft + screen.availWidth))
                            l = mainLeft + screen.availWidth - w - 1;
                    }
                    if (t <= screen.availTop)
                        t = screen.availTop + 1;
                    else {
                        if ((t + h) >= (screen.availTop + screen.availHeight))
                            t = screen.availTop + screen.availHeight - h - 1;
                    }
                    if (t <= screen.availTop) {
                        let diff = h - screen.availHeight + 1;
                        h -= diff;
                        t += diff;
                        _prepareScroll(fullh, h);
                    }
                    if (this.nativeWindow) {
                        let pos = {
                            left: l,
                            top: t,
                            width: w,
                            height: h
                        };
                        this.nativeWindow.setWindowBounds(pos.left, pos.top, pos.width, pos.height);
                    } else
                        this.window.bounds.setBounds(l, t, w, h);
                } else {
                    let rect = window.bounds.clientRect;
                    let availLeft = 0;
                    let availTop = 0;
                    let mainLeft = screen.availLeft;

                    if (oppositeX !== undefined) {
                        if (typeof oppositeX === 'boolean' && oppositeX) { // #15866
                            l = l - w;
                        }
                        if (l <= availLeft)
                            l = availLeft + 1;
                        let r = l + w + 1;
                        if ((r > (availLeft + screen.availWidth)) || (r > rect.right))
                            if (typeof oppositeX === 'boolean')
                                l = mainLeft + screen.availWidth - w;
                            else
                                l = oppositeX - w;
                        if (l <= rect.left)
                            l = rect.left + 1;
                    }
                    if (l <= availLeft)
                        l = availLeft + 1;
                    else {
                        if ((l + w) >= (availLeft + screen.availWidth))
                            l = availLeft + screen.availWidth - w - 1;
                        if ((l + w) >= rect.right)
                            l = rect.right - w - 1;
                    }
                    if (t <= availTop)
                        t = availTop + 1;
                    else {
                        if ((t + h) >= (availTop + screen.availHeight))
                            t = availTop + screen.availHeight - h - 1;
                        if ((t + h) >= rect.bottom)
                            t = rect.bottom - h - 1;
                    }
                    if (t <= rect.top) {
                        let _diff = h - rect.bottom + rect.top + 1;
                        h -= _diff;
                        t += _diff;
                        _prepareScroll(fullh, h);
                    }
                    this.window.bounds.setBounds(l, t, w, h);
                    if (!this._mouseupSet) {
                        app.listen(window, 'mouseup', this.checkclosemenu, true);
                        this._mouseupSet = true;
                    }
                }
                return true;
            }.bind(this);
            this.windowSizeUpdate(true);

            _this._doShow = true;

            let showPopup = function () {
                if (document.readyState != 'complete' || !cssLoaded || _loadersRunning) {
                    requestTimeout(showPopup, 10);
                    return;
                }

                document.fonts.ready.then(function () {
                    if (_this._cleanUpCalled)
                        return;
                    _this.windowSizeUpdate(true);
                    if (_this.nativeWindow) {
                        _this.nativeWindow.showWindow();
                    } else
                    if (_this.window)
                        _this.window.show();
                    _this.canvas.focus();
                    _this._doShow = false;
                });
            };

            if (!_this.initialized) {
                _this.mouseoverhandler = function (e) {
                    if (!this.mouseIn) {
                        this.mouseIn = true;
                    }
                }.bind(_this);

                _this.mouseouthandler = function (e) {
                    let mouseX = e.clientX;
                    let mouseY = e.clientY;
                    if (!usePopupMenuWindows()) {
                        mouseX -= _this.window.clientX;
                        mouseY -= _this.window.clientY;
                    }
                    if ((mouseY > 0) && (mouseY < this.window.innerHeight) && (mouseX > 0) && (mouseX < this.window.innerWidth)) {
                        return; // still inside
                    }
                    this.mouseIn = false;
                }.bind(_this);

                _this.layoutchange = function () {
                    // layout was changed so wait a little and call window update
                    if (_this._layoutChangeTimeout)
                        clearTimeout(_this._layoutChangeTimeout);
                    _this._layoutChangeTimeout = requestTimeout(function () {
                        _this._layoutChangeTimeout = undefined;
                        if (_this._doShow)
                            showPopup();
                    }, 10);
                };
                _this.mouseoverhandler = app.listen(_this.window, 'mouseover', _this.mouseoverhandler, false);
                _this.mouseouthandler = app.listen(_this.window, 'mouseout', _this.mouseouthandler, false);
                _this.layoutchangehandler = app.listen(document.body, 'layoutchange', _this.layoutchange);
                _this.lessloadedhandler = app.listen(_this.window, 'lessloaded', _this.layoutchange);

                // wait 5ms and show window (in case layoutchange is not called within this timeout)
                requestTimeout(function () {
                    if (!_this._layoutChangeTimeout && _this._doShow) {
                        showPopup();
                    }
                }, 5);
            }
            _this.initialized = true;

            _this.keyDownHandler = function (e) {
                let handled = true;
                let newIdx = -1;

                let findFirstEnabledDown = function (isCyclic?: boolean) {
                    let j = 0;
                    while ((j < _this.divs.length) && (_this.divs[newIdx].hasAttribute('data-disabled'))) {
                        j++;
                        newIdx++;
                        if (newIdx >= _this.divs.length) {
                            if (isCyclic)
                                newIdx = 0;
                            else {
                                newIdx = -1;
                                break;
                            }
                        }
                    }
                    if (j === _this.divs.length)
                        newIdx = -1; // no enabled item found
                };

                let findFirstEnabledUp = function (isCyclic?: boolean) {
                    let j = 0;
                    while ((j < _this.divs.length) && (_this.divs[newIdx].hasAttribute('data-disabled'))) {
                        j++;
                        newIdx--;
                        if (newIdx < 0) {
                            if (isCyclic)
                                newIdx = _this.divs.length - 1;
                            else {
                                newIdx = -1;
                                break;
                            }
                        }
                    }
                    if (j === _this.divs.length)
                        newIdx = -1; // no enabled item found
                };

                let moveFocus = function (step, isCyclic?: boolean) {
                    let isUp = (step < 0);
                    if (_this.focusedItem) {
                        newIdx = (_this.focusedItem.itemIndex + step);
                        if (isCyclic) {
                            if (newIdx < 0)
                                newIdx += _this.divs.length;
                            newIdx %= _this.divs.length;
                        } else {
                            if (newIdx < 0)
                                newIdx = 0;
                            else if (newIdx >= _this.divs.length) {
                                newIdx = _this.divs.length - 1;
                            }
                        }
                    } else {
                        newIdx = isUp ? (_this.divs.length - 1) : 0;
                    }
                    if (isUp)
                        findFirstEnabledUp(isCyclic);
                    else
                        findFirstEnabledDown(isCyclic);
                };
                let friendlyKey = friendlyKeyName(e);

                switch (friendlyKey) {
                case 'Down':
                    moveFocus(1, true);
                    break;
                case 'Up':
                    moveFocus(-1, true);
                    break;
                case 'Home':
                    newIdx = 0;
                    findFirstEnabledDown();
                    break;
                case 'End':
                    newIdx = _this.divs.length - 1;
                    findFirstEnabledUp();
                    break;
                case 'PageDown':
                    moveFocus(_this.pageItemCount, false);
                    break;
                case 'PageUp':
                    moveFocus(-_this.pageItemCount, false);
                    break;
                case 'Right':
                    if (_this.focusedItem) {
                        let action = menuitems[_this.focusedItem.itemIndex];
                        if (action.submenu) {
                            openSubmenu(action, _this.focusedItem);
                        } else if (_this.focusedItem.hotlink) {
                            simulateFullClick(_this.focusedItem.hotlink);
                        } else if (_this.onkeydown) {
                            _this.onkeydown(e); // send key to main menu, so it can switch to the next main menu item
                        }
                    } else if (_this.onkeydown) {
                        _this.onkeydown(e);
                    }
                    break;
                case 'Left':
                    if (_this.onkeydown && (_this.parentMenuAction == _this.rootMenuAction)) {
                        _this.onkeydown(e); // send key to main menu, so it can switch to the previous main menu item
                    } else
                        _this.forcedCloseWindow();
                    break;
                case 'Enter':
                    if (_this.focusedItem) {
                        let action = menuitems[_this.focusedItem.itemIndex];
                        if (action.submenu) {
                            openSubmenu(action, _this.focusedItem);
                        } else {
                            let _ctrlKey = e.ctrlKey;
                            window.requestTimeout(() => { // workaround so that the Enter key is not catched also by the main window (#17384)
                                callAction(action, _this.focusedItem, {
                                    ctrlKey: _ctrlKey,
                                    mouseoverhandler: _this.focusedItem.mouseoverhandler
                                });
                            }, 0);
                        }
                    }
                    break;
                case 'Esc':
                    _this.forcedCloseWindow();
                    break;
                case 'Tab': // close menus, skipping to other part of GUI
                    _this.forcedCloseWindow();
                    if (this.onactioncalled)
                        this.onactioncalled();
                    break;
                case 'ContextMenu': // contextmenu button, new menu will be opening, close this
                    _this.forcedCloseWindow();
                    if (this.onactioncalled)
                        this.onactioncalled();
                    break;
                default:
                    handled = false;
                }

                let divs = _this.divs;
                if (divs) { // LS: accessKey workaround, our menu window no longer has focus (starting from CEF51)                
                    for (let i = 0; i < divs.length; i++) {
                        let it = divs[i];
                        if (it.accessKey == friendlyKey) {
                            let _it = it;
                            window.requestTimeout(() => { // workaround so that the key stroke (accessKey) is not catched also by the main window (#17319 - item 2)
                                _it.click();
                            }, 0);
                            handled = true;
                        }
                    }
                }

                if (newIdx >= 0) {
                    if ((_this.focusedItem) && (_this.focusedItem.itemIndex !== newIdx)) {
                        _this.focusedItem.removeAttribute('data-focused');
                    }
                    _this.focusedItem = _this.divs[newIdx];
                    _this.focusedItem.setAttribute('data-focused', 1);
                    if (_this.makeItemVisible)
                        _this.makeItemVisible(_this.focusedItem);
                }
                return handled;
            };

            app.listen(this.canvas, 'keydown', function (e) {
                if (_this.keyDownHandler(e)) {
                    e.stopImmediatePropagation();
                    e.preventDefault();
                }
            }, true);
        }.bind(this);

        if (isFunction(this.menuitems)) {
            let _update = (retval, final) => {
                if (this.divs && retval) { // not cleaned yet
                    _generateItems(retval, !final /* do not call cleanUp, just update*/);
                }
            };
            let items = this.menuitems({
                parent: this.parent,
                parentMenuAction: this.parentMenuAction,
                rootMenuAction: this.rootMenuAction,
                updateCallback: _update
            });
            assert((items !== undefined), 'Menuitems returned undefined. ' + (this.parentMenuAction ? ('Parent menu item: "' + uitools.getPureTitle(this.parentMenuAction.title) + '"') : ''));
            if (isPromise(items)) {
                // show loading placeholder
                _generateItems([actions.loading]);
                _this.localPromise(items).then((res) => {
                    _update(res, true);
                });
                this._menuItemsPromise = items;
            } else {
                _generateItems(items);
            }
        } else {
            _generateItems(this.menuitems);
        }
    };
    
    cleanUpLight() {
        // do not clean all, used for replacing loading placeholder
        if (this._menuItemsPromise)
            cancelPromise(this._menuItemsPromise);
        this._menuItemsPromise = undefined;
        if (this.cleanUpPromises)
            this.cleanUpPromises();
        if (this.divs) {
            for (let i = 0; i < this.divs.length; i++) {
                let it = this.divs[i];
                if (it.icondiv) {
                    app.unlisten(it.icondiv, 'change');
                    if (it.icondiv.controlClass)
                        it.icondiv.controlClass.cleanUp();
                    it.icondiv.remove();
                    it.icondiv = undefined;
                }
                if (it.subicondiv) {
                    if (it.subicondiv.controlClass)
                        it.subicondiv.controlClass.cleanUp();
                    it.subicondiv.remove();
                    it.subicondiv = undefined;
                }
                if (it.hotlink) {
                    app.unlisten(it.hotlink, 'click');
                    it.hotlink.remove();
                    it.hotlink = undefined;
                }
                if (it.mouseoverhandler) {
                    app.unlisten(it, 'mouseover', it.mouseoverhandler);
                    it.mouseoverhandler = undefined;
                }
                if(it.shortcutdiv) {
                    it.shortcutdiv.remove();
                }
                if(it.textdiv) {
                    it.textdiv.remove();
                }
                it.shortcutdiv = undefined;
                it.textdiv = undefined;
                app.unlisten(it);
                it.remove();
            }
            this.divs = undefined;
        }
    }

    cleanUp() {
        this._cleanUpCalled = true;
        this.cleanUpLight();
        if (this.canvas)
            app.unlisten(this.canvas);

        if (this.items) {
            this.menuitems = undefined;
        }
        this.canvas = null;
        // PETR: this variable is defined later in generation code
        this.menucontainer = null;
        this.focusedItem = undefined;
        if(this.scrollUp) {
            app.unlisten(this.scrollUp);
            this.scrollUp.remove();
            this.scrollUp = null;
        }
        if(this.scrollDown) {
            app.unlisten(this.scrollDown);
            this.scrollDown.remove();
            this.scrollDown = null;
        }
        if(this.viewport) {
            app.unlisten(this.viewport);
            this.viewport = null;
        }        
        this.items = null;
        this.selectedItem = null;

        if (this.mouseoverhandler) {
            app.unlisten(this.window, 'mouseover', this.mouseoverhandler, false);
            this.mouseoverhandler = undefined;
        }
        if (this.mouseouthandler) {
            app.unlisten(this.window, 'mouseout', this.mouseouthandler, false);
            this.mouseouthandler = undefined;
        }
        if(this.layoutchangehandler) {
            app.unlisten(document.body, 'layoutchange', this.layoutchangehandler);
            this.layoutchangehandler = undefined;
        }
        if(this.lessloadedhandler) {
            app.unlisten(this.window, 'lessloaded', this.lessloadedhandler);
            this.lessloadedhandler = undefined;
        }
        if (usePopupMenuWindows()) {
            popupWindow.cleanUp();
        } else {
            if (this._mouseupSet) {
                app.unlisten(window, 'mouseup', this.checkclosemenu, true);
                this._mouseupSet = false;
            }
        }
        this.checkclosemenu = undefined;
        this.cleanUpPromises = undefined;
        this.initMenu = undefined;
    }
}
registerClass(MenuHandler);

function divFromSimpleMenu(divToFill: HTMLDivElement, items: AnyDict[], groupTitle?:string) {
    // fills given div with grouped checkboxes and radiobuttons based on standard menuitems array
    // returns array with saved original states, so they could be used for restoring them
    let checkDivs = [];
    let mitems: any[] = [];
    let mitem;

    for (let i = 0; i < items.length; i++) {
        if (!items[i].action) {
            mitem = {
                action: items[i],
                order: items[i].order,
                grouporder: items[i].grouporder,
                grouptitle: items[i].grouptitle
            };
        } else
            mitem = items[i];
        if (mitem.order === undefined)
            mitem.order = 10 * (i + 1);
        if (mitem.grouporder === undefined)
            mitem.grouporder = 1000;
        mitems.push(mitem);
    }
    // sort by grouporder and order
    mitems.sort(function (i1, i2) {
        let retval = i1.grouporder - i2.grouporder;
        if (retval === 0)
            retval = i1.order - i2.order;
        return retval;
    });
    // insert to menuitems, add separators between groups
    let lastgroup = undefined;
    let lastsep: any;
    let menuitems: any[] = [];

    let addItem = function (mitem) {
        if (((lastgroup !== undefined) || mitem.grouptitle) && (lastgroup !== mitem.grouporder)) {
            lastsep = copyObject(menuseparator);
            if (mitem.grouptitle) {
                lastsep.title = mitem.grouptitle;
            }
            menuitems.push(lastsep);
        } else if (lastsep && !lastsep.title && mitem.grouptitle) {
            lastsep.title = mitem.grouptitle;
        }

        lastgroup = mitem.grouporder;
        menuitems.push(mitem.action);
    };

    for (let i = 0; i < mitems.length; i++) {
        mitem = mitems[i];
        let isvisible = resolveToValue(mitem.action.visible, true, undefined, mitem.action /*bind*/);
        if (isvisible) {
            addItem(mitem);
        }
    }
    let lastGoupDiv = undefined;

    forEach(menuitems, function (item, idx) {
        let it = document.createElement('div');
        it.itemIndex = idx;

        //let isdisabled = resolveToValue(item.disabled, false, {
        //    action: item
        //}, item);
        let ischecked = resolveToValue(item.checked, false, undefined, item);
        let action = item;

        if (item.separator) {
            let fs = document.createElement('fieldset');
            fs.className = 'marginsColumn';
            divToFill.appendChild(fs);

            lastGoupDiv = document.createElement('div');
            lastGoupDiv.className = 'uiRows';

            if (item.title) {
                // separator with title
                let legend = document.createElement('legend');
                legend.textContent = item.title;
                fs.appendChild(legend);
            }
            fs.appendChild(lastGoupDiv);
        } else {
            if (!lastGoupDiv) {
                let fs = document.createElement('fieldset');
                fs.className = 'marginsColumn';
                divToFill.appendChild(fs);
                if (groupTitle) {
                    let legend = document.createElement('legend');
                    legend.textContent = groupTitle;
                    fs.appendChild(legend);
                }
                lastGoupDiv = document.createElement('div');
                lastGoupDiv.className = 'uiRows marginsColumn';
                fs.appendChild(lastGoupDiv);
            }
            it.icondiv = document.createElement('div') as ElementWith<Checkbox>;
            it.appendChild(it.icondiv);

            if (item.radiogroup !== undefined) {
                it.icondiv.innerHTML = resolveToValue(item.title, '', undefined, item /*bind*/);
                it.icondiv.controlClass = new Checkbox(it.icondiv, {
                    type: 'radio',
                    name: item.radiogroup
                });
                it.icondiv.controlClass.radioChange = function (e) {
                    if (!isFunction(action.checked))
                        action.checked = it.icondiv.controlClass.checked;
                    if (action.execute !== undefined) {
                        action.execute();
                    }
                };
                it.icondiv.controlClass.localListen(it.icondiv, 'change', it.icondiv.controlClass.radioChange);
                if (ischecked)
                    it.icondiv.controlClass.checked = ischecked;
                checkDivs.push({
                    div: it.icondiv,
                    checked: ischecked,
                    isRadio: true
                });
            } else if (item.checkable) {
                it.icondiv.innerHTML = resolveToValue(item.title, '', undefined, item /*bind*/);
                action.changedstate = undefined;
                it.icondiv.controlClass = new Checkbox(it.icondiv, {
                    type: 'checkbox',
                    checked: ischecked,
                });
                it.icondiv.controlClass.checkChange = function (e) {
                    action.changedstate = it.icondiv.controlClass.checked;
                    if (!isFunction(action.checked)) {
                        action.checked = action.changedstate;
                    }
                    if (action.execute !== undefined) {
                        action.execute.apply(action);
                    }
                    action.changedstate = undefined;
                };
                it.icondiv.controlClass.localListen(it.icondiv, 'change', it.icondiv.controlClass.checkChange, true);
                checkDivs.push({
                    div: it.icondiv,
                    checked: ischecked,
                    isRadio: false
                });
            } else {
                it.icondiv.className = 'menuicon';
                if (ischecked) {
                    it.setAttribute('data-checked', '1');
                }

                let icon = resolveToValue(item.icon, undefined, undefined, item /*bind*/);
                if (icon) {
                    doLoadIcon(icon, it.icondiv); // it is not cleaned yet
                }
                it.textdiv = document.createElement('div');
                it.textdiv.className = 'menutext';
                //let title = resolveToValue(item.title, '', undefined, item /*bind*/);
            }
            lastGoupDiv.appendChild(it);
            if (item.hotlinkIcon && item.hotlinkExecute) {
                it.hotlink = document.createElement('div');
                it.hotlink.className = 'lvInlineIcon clickable center left-indent-small';
                it.classList.add('flex');
                it.appendChild(it.hotlink);
                it.icondiv.controlClass.localListen(it.hotlink, 'click', function (e) {
                    e.stopPropagation();
                    if (!resolveToValue(action.checked, false, null, action)) {
                        if ((item.radiogroup !== undefined) || (item.checkable)) {
                            if (it.icondiv.controlClass.radioChange)
                                it.icondiv.controlClass.radioChange();
                            else
                                it.icondiv.controlClass.checkChange();
                            it.icondiv.controlClass.checked = true;
                        } else
                            return;
                    }
                    action.hotlinkExecute();
                });
                addEnterAsClick(it.icondiv.controlClass, it.hotlink);
                loadIconFast(item.hotlinkIcon, function (icon) {
                    if (!window._cleanUpCalled && it.hotlink)
                        setIconFast(it.hotlink, icon);
                });
            }
        }
    });
    return checkDivs;
}

declare global {
    var divFromSimpleMenu: (divToFill: HTMLDivElement, items: AnyDict[]) => AnyDict[];
}
window.divFromSimpleMenu = divFromSimpleMenu;
