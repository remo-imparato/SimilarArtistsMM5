/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

registerFileImport('controls/nowPlayingView');
import Control from './control';
export const PS_ALWAYS_VISIBLE = 1;
export const PS_ON_MOUSE_MOVE = 2;
export const PS_NEVER_VISIBLE = 3;
// TODO: make following three values imported consts (once now playing layouts are ES6 modules)
//@ts-ignore 
window.PS_ALWAYS_VISIBLE = PS_ALWAYS_VISIBLE, //@ts-ignore
    window.PS_ON_MOUSE_MOVE = PS_ON_MOUSE_MOVE, //@ts-ignore
    window.PS_NEVER_VISIBLE = PS_NEVER_VISIBLE;
const PS_TIMEOUT = 3000, // timeout to auto hide player
BTNS_TIMEOUT = 2000; // timeout to auto hide switcher buttons
window.nowPlayingLayouts = [
    {
        title: _('Album Art'),
        icon: 'song',
        classname: 'NowPlayingFullList',
        req: 'controls/nowPlaying/fullList',
        priority: 10
    },
    {
        title: _('Artist Bio'),
        icon: 'artist',
        classname: 'NowPlayingArtistBio',
        req: 'controls/nowPlaying/artistBio',
        priority: 20
    },
    {
        title: _('Lyrics'),
        icon: 'listview',
        classname: 'NowPlayingLargeLyrics',
        req: 'controls/nowPlaying/largeLyrics',
        priority: 30
    },
    {
        title: _('List'),
        icon: 'listview',
        classname: 'NowPlayingTracklist',
        classList: 'fill',
        req: 'controls/nowPlaying/tracklist',
        toolbarActions: function (view) {
            return [{
                    icon: 'menu',
                    identifier: 'playing_menu',
                    submenu: window.playingListMenuItems.concat([
                        {
                            action: actions.saveNewOrder,
                            order: 5,
                            grouporder: 20
                        }
                    ])
                }];
        },
        subViews: ['statusBar'],
        priority: 40
    },
    {
        title: _('List (by Album)'),
        icon: 'columnlist',
        classname: 'NowPlayingGroupedlist',
        classList: 'fill',
        req: 'controls/nowPlaying/groupedlist',
        toolbarActions: function (view) {
            return [{
                    icon: 'menu',
                    identifier: 'playing_menu',
                    submenu: window.playingListMenuItems.concat([
                        {
                            action: actions.saveNewOrder,
                            order: 5,
                            grouporder: 20
                        }
                    ])
                }];
        },
        subViews: ['statusBar'],
        priority: 50
    }
];
/**
 * UI NowPlayingView element
 * @class NowPlayingView
 * @constructor
 * @extends Control
 * @module Controls
 * @module NowPlayingView
 * @name NowPlayingView
*/
export default class NowPlayingView extends Control {
    initialize(rootelem, params) {
        let _this = this;
        super.initialize(rootelem, params);
        this.contextMenu = new Menu(this.getMenu.bind(this));
        this.restoreCalled = false;
        this.disabledModeChanges = false;
        this.requestFrame(function () {
            if (!_this.restoreCalled)
                _this.restoreState({});
        }, 'restoreState');
        this.localListen(window, 'keyup', function (e) {
            if (this._inFullWindowMode || this._inFullScreenMode) {
                if (e.key === 'Escape')
                    this.restoreView();
            }
        }.bind(this));
        this.localListen(window, 'beforeshowoptions', function (e) {
            if (this._inFullWindowMode || this._inFullScreenMode) {
                this.restoreView();
            }
        }.bind(this));
        // prepare mode switcher buttons
        this.switcherDiv = document.createElement('div');
        this.switcherDiv.classList.add('alignright');
        this.switcherDiv.classList.add('animate');
        this.switcherDiv.setAttribute('data-button-parent', '1');
        this.switcherDiv.classList.add('flex');
        this.switcherDiv.classList.add('row');
        this.switcherDiv.classList.add('margins');
        this.switcherDiv.classList.add('baseBackgroundBitTransparent');
        this.container.appendChild(this.switcherDiv);
        let createVideoModeSwitchButton = function (iconName, switchFunc, datatip) {
            let div = document.createElement('div');
            div.classList.add('toolbutton');
            div.classList.add('paddingSmall');
            div.style.zIndex = '999999';
            if (datatip) {
                datatip = resolveToValue(datatip);
                if (datatip)
                    div.setAttribute('data-tip', datatip);
            }
            loadIcon(iconName, function (iconData) {
                if (!_this._cleanUpCalled)
                    div.innerHTML = iconData;
            });
            this.localListen(div, 'click', function (e) {
                switchFunc();
                e.stopPropagation();
            }.bind(div));
            this.switcherDiv.appendChild(div);
            return div;
        }.bind(this);
        this.btnToWindowed = createVideoModeSwitchButton('mode_windowed', this.restoreView.bind(this), function () {
            if (_this._inFullWindowMode)
                return _('Normal window'); // full window -> normal
            else
                return _('Normal window'); // full screen -> normal
        });
        this.btnToFullWindow = createVideoModeSwitchButton('mode_fullwindow', function () {
            this.maximizeView(false);
        }.bind(this), _('Full window'));
        this.btnToFullScreen = createVideoModeSwitchButton('mode_fullscreen', function () {
            this.maximizeView(true);
        }.bind(this), _('Full screen'));
        this.btnShowNPList = createVideoModeSwitchButton('listview', function () {
            if (_this.layoutDiv && _this.layoutDiv.controlClass) {
                _this.layoutDiv.controlClass.npHidden = false;
                _this.updateSwitchButtonsVisibility();
            }
        }.bind(this), _('Show \'Playing\' list'));
        this.btnShowNPList.classList.add('left-indent-small'); // separate slightly from other buttons
        if (params && params.layout)
            this.updateLayout(params.layout);
        else
            this.updateSwitchButtonsVisibility();
        setVisibilityFast(this.switcherDiv, false);
        let lastMousePos = {};
        let hideTimer = undefined;
        let aboveButtons = false;
        let cancelAutohide = function () {
            if (hideTimer) {
                clearTimeout(hideTimer);
                hideTimer = undefined;
            }
        };
        let startAutoHide = function () {
            if (_this.disabledModeChanges)
                return;
            if (hideTimer)
                cancelAutohide();
            else
                setVisibility(_this.switcherDiv, true);
            hideTimer = _this.requestTimeout(function () {
                setVisibility(_this.switcherDiv, false);
                hideTimer = undefined;
            }, BTNS_TIMEOUT);
        };
        this.localListen(this.container, 'mousemove', function (e) {
            if (lastMousePos.x != e.x || lastMousePos.y != e.y) {
                lastMousePos = {
                    x: e.x,
                    y: e.y
                };
                if (!aboveButtons)
                    startAutoHide();
            }
        }.bind(this));
        this.localListen(this.switcherDiv, 'mouseover', function (e) {
            aboveButtons = true;
            cancelAutohide();
        }.bind(this));
        this.localListen(this.switcherDiv, 'mouseout', function (e) {
            aboveButtons = false;
            if (!hideTimer)
                startAutoHide();
        }.bind(this));
        this.localListen(thisWindow, 'closeQuery', function () {
            if (_this._inFullWindowMode || this._inFullScreenMode)
                _this.restoreView();
        });
        this.localListen(settings.observer, 'change', () => {
            this.doRefresh();
        });
    }
    updateSwitchButtonsVisibility() {
        setVisibilityFast(this.btnToWindowed, this._inFullWindowMode || this._inFullScreenMode);
        setVisibilityFast(this.btnToFullWindow, !this._inFullWindowMode);
        setVisibilityFast(this.btnToFullScreen, !this._inFullScreenMode);
        setVisibilityFast(this.btnShowNPList, (this._inFullWindowMode || this._inFullScreenMode) && this.layoutDiv && this.layoutDiv.controlClass && this.layoutDiv.controlClass.npHidden);
    }
    // Main context manu of Now Playing view
    getMenu() {
        let menuArray = [];
        let _this = this;
        if (!this._inFullWindowMode)
            menuArray.push({
                action: {
                    title: _('Show full window'),
                    icon: 'mode_fullwindow',
                    execute: function () {
                        _this.maximizeView(false /* not fullscreen */);
                    }
                },
                order: 1,
                grouporder: 10
            });
        if (!this._inFullScreenMode)
            menuArray.push({
                action: {
                    title: _('Show full screen'),
                    icon: 'mode_fullscreen',
                    execute: function () {
                        _this.maximizeView(true /* to fullscreen */);
                    }
                },
                order: 2,
                grouporder: 10
            });
        if (this._inFullWindowMode || this._inFullScreenMode) {
            menuArray.push({
                action: {
                    title: function () {
                        if (_this._inFullWindowMode)
                            return _('Cancel full window');
                        else
                            return _('Cancel full screen');
                    },
                    icon: 'mode_windowed',
                    execute: function () {
                        _this.restoreView();
                    }
                },
                order: 5,
                grouporder: 10
            });
        }
        if (window.currentTabControl && window.currentTabControl.multiviewControl) {
            let mc = window.currentTabControl.multiviewControl;
            let actions = mc._getViewActions(mc.activeView, true, true /* get only view selection */);
            menuArray.push({
                action: {
                    title: _('Choose layout'),
                    submenu: actions
                },
                order: 1,
                grouporder: 20,
            });
        }
        if (this.layoutDiv.controlClass.menuItems)
            return menuArray.concat(this.layoutDiv.controlClass.menuItems);
        else
            return menuArray;
    }
    // Generates Layouts submenu
    /*   getLayoutsMenu() {
           var res = [];
           for (var i = 0; i < nowPlayingLayouts.length; i++) {
               var layout = nowPlayingLayouts[i];
               res.push({
                   title: layout.title,
                   order: layout.priority,
                   grouporder: 1,
                   checked: (layout == this.currentLayout),
                   _this: this,
                   _layout: layout,
                   execute: function () {
                       var _this = this._this;
                       _this.updateLayout(this._layout);
                   }
               });
           }
           return res;
       }
       */
    // maximize view to full-window or full-screen
    maximizeView(toFullScreen) {
        if (toFullScreen) {
            if (this._inFullScreenMode)
                return;
        }
        else {
            if (this._inFullWindowMode)
                return;
        }
        let res = PS_ALWAYS_VISIBLE;
        if (this.layoutDiv && this.layoutDiv.controlClass && this.layoutDiv.controlClass.notifyMaximized) {
            res = this.layoutDiv.controlClass.notifyMaximized(toFullScreen);
        }
        uitools.maximizeView(this.container, toFullScreen, this._inFullScreenMode, res === PS_ALWAYS_VISIBLE);
        if (res === PS_ON_MOUSE_MOVE)
            uitools.showPlayer(true, PS_TIMEOUT);
        this._inFullScreenMode = toFullScreen;
        this._inFullWindowMode = !toFullScreen;
        this.updateSwitchButtonsVisibility();
    }
    // restore view from full-window or full-screen
    restoreView(noAnimation) {
        if (this._inFullWindowMode || this._inFullScreenMode) {
            if (this.layoutDiv && this.layoutDiv.controlClass && this.layoutDiv.controlClass.notifyRestored) {
                this.layoutDiv.controlClass.notifyRestored();
            }
            uitools.showPlayer(false);
            uitools.restoreView(this._inFullScreenMode, noAnimation);
            this._inFullScreenMode = false;
            this._inFullWindowMode = false;
            this.updateSwitchButtonsVisibility();
        }
    }
    // Show the selected Layout
    updateLayout(newLayout) {
        let _this = this;
        if (this.currentLayout == newLayout)
            return; // No layout change
        if (this.currentLayout) {
            this.currentLayout.state = this.layoutDiv.controlClass.storeState();
        }
        this.currentLayout = newLayout;
        requirejs(this.currentLayout.req);
        let oldLayoutDiv;
        if (this.layoutDiv) {
            oldLayoutDiv = this.layoutDiv;
            oldLayoutDiv.style.zIndex = 1;
        }
        this.layoutDiv = document.createElement('div');
        if (this.currentLayout.classList)
            this.layoutDiv.classList = this.currentLayout.classList;
        else
            this.layoutDiv.classList = 'stretchMinHeight';
        this.layoutDiv.setAttribute('data-control-class', this.currentLayout.classname);
        if (this.currentLayout.initParams)
            this.layoutDiv.setAttribute('data-init-params', this.currentLayout.initParams);
        this.container.appendChild(this.layoutDiv);
        initializeControls(this.container);
        if (this.currentLayout.state)
            this.layoutDiv.controlClass.restoreState(this.currentLayout.state);
        if (this._inFullWindowMode || this._inFullScreenMode) {
            let res = PS_ALWAYS_VISIBLE;
            if (this.layoutDiv && this.layoutDiv.controlClass && this.layoutDiv.controlClass.notifyMaximized) {
                res = this.layoutDiv.controlClass.notifyMaximized(this._inFullScreenMode);
            }
            uitools.showPlayer((res === PS_ALWAYS_VISIBLE) || (res === PS_ON_MOUSE_MOVE), (res === PS_ON_MOUSE_MOVE) ? PS_TIMEOUT : undefined);
        }
        if (this.layoutDiv && this.layoutDiv.controlClass) {
            let switcherDivCont = qe(this.layoutDiv, '[data-switcherDivContainer]');
            if (switcherDivCont) {
                switcherDivCont.appendChild(this.switcherDiv);
            }
            else {
                this.container.appendChild(this.switcherDiv);
            }
            let lcc = this.layoutDiv.controlClass;
            if (lcc.NPContainer) { // has support for NP list in full window
                let closeNPList = {
                    execute: function () {
                        lcc.npHidden = true;
                        _this.updateSwitchButtonsVisibility();
                    },
                    title: _('Close'),
                };
                lcc.NPContainer.controlClass.setCloseButtonAction(closeNPList);
            }
        }
        else
            this.container.appendChild(this.switcherDiv);
        if (oldLayoutDiv) {
            this.requestTimeout(function () {
                animTools.animate(oldLayoutDiv, {
                    opacity: [0.0, 1.0]
                }, {
                    complete: function () {
                        cleanElement(oldLayoutDiv);
                        oldLayoutDiv.remove();
                    }
                });
            }, 150); // Give it some time to load, don't show immediatelly
        }
        this.updateSwitchButtonsVisibility();
    }
    onShow() {
        if (this.layoutDiv && this.layoutDiv.controlClass) {
            if (this.layoutDiv.controlClass.onShow)
                this.layoutDiv.controlClass.onShow();
            this.disabledModeChanges = !!this.layoutDiv.controlClass.disabledModeChanges;
            if (this.disabledModeChanges)
                setVisibilityFast(this.switcherDiv, false);
        }
        else
            this.disabledModeChanges = false;
    }
    onHide() {
        if (this.layoutDiv && this.layoutDiv.controlClass && this.layoutDiv.controlClass.onHide) {
            this.layoutDiv.controlClass.onHide();
        }
        this.restoreView(); // we do not currently support keeping mode among layouts
    }
    storePersistentState() {
        // store all as persistent, we want to share all for all NP views
        //return this.storeState(); // #14853
    }
    restorePersistentState(state) {
        // restore all as persistent, we share all for all NP views
        //this.restoreState(state); // #14853
    }
    storeState() {
        let state = super.storeState();
        for (let i = 0; i < nowPlayingLayouts.length; i++) {
            state[nowPlayingLayouts[i].classname] = nowPlayingLayouts[i].state;
        }
        if (this.currentLayout)
            state._currentLayout = this.currentLayout.classname;
        if (this.layoutDiv && this.layoutDiv.controlClass && this.layoutDiv.controlClass.storeState)
            state[this.layoutDiv.controlClass.constructor.name] = this.layoutDiv.controlClass.storeState();
        return state;
    }
    restoreState(state) {
        this.restoreCalled = true;
        let setLayoutNum = 0;
        for (let i = 0; i < nowPlayingLayouts.length; i++) {
            nowPlayingLayouts[i].state = state[nowPlayingLayouts[i].classname];
            if (nowPlayingLayouts[i].classname == state._currentLayout) {
                setLayoutNum = i;
            }
        }
        super.restoreState(state);
        if (this.layoutDiv && this.layoutDiv.controlClass && this.layoutDiv.controlClass.restoreState) {
            let st = state[this.layoutDiv.controlClass.constructor.name];
            if (st) {
                this.layoutDiv.controlClass.restoreState(st); // to restore scroll offset etc (#17615)
            }
        }
        //this.updateLayout(nowPlayingLayouts[setLayoutNum]); // is driven by viewHandlers now (#14328)
    }
    doRefresh() {
        if (this.layoutDiv && this.layoutDiv.controlClass && isFunction(this.layoutDiv.controlClass.doRefresh))
            this.layoutDiv.controlClass.doRefresh();
    }
}
registerClass(NowPlayingView);
