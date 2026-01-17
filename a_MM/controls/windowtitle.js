/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

/**
@module UI
*/
registerFileImport('controls/windowtitle');
import Control from './control';
/**
UI window title element for borderless HTML shaped window.

@class WindowTitle
@constructor
*/
class WindowTitle extends Control {
    initialize(elem, params) {
        super.initialize(elem, params);
        let _this = this;
        this._isresizable = true;
        this._loadInternalFrame();
        this.UI = getAllUIElements(this.container);
        // --------------------------------
        // Internal events
        // --------------------------------
        this.localListen(settings.observer, 'change', () => {
            setVisibility(this.UI.closeBtn, !app.inPartyMode);
        });
        this.localListen(this.UI.closeBtn, 'click', function (e) {
            if (window.showAsVideoPlayer) {
                app.player.stopAsync().then1(function () {
                    app.endVideoInMainWindow();
                });
            }
            else {
                window.closeWindow();
            }
        });
        this.localListen(this.UI.maximizeBtn, 'click', function (e) {
            window.maximize();
        });
        this.localListen(this.UI.restoreBtn, 'click', function (e) {
            window.restore();
        });
        this.localListen(this.UI.minimizeBtn, 'click', function (e) {
            window.minimize();
        });
        this.localListen(this.UI.helpBtn, 'click', function (e) {
            window.uitools.openHelpContent();
        });
        this.localListen(this.UI.maximizeBtn, 'mousedown', function (e) {
            e.preventDefault(); // will suppress focus change
        });
        this.localListen(this.UI.restoreBtn, 'mousedown', function (e) {
            e.preventDefault(); // will suppress focus change
        });
        this.localListen(this.UI.minimizeBtn, 'mousedown', function (e) {
            e.preventDefault(); // will suppress focus change
        });
        this.localListen(this.UI.helpBtn, 'mousedown', function (e) {
            e.preventDefault(); // will suppress focus change
        });
        let statChange = function (maximized, minimized) {
            if (isChildOf(document.body, _this.container)) {
                let min = qeid(_this.container, 'minimizeBtn');
                let res = qeid(_this.container, 'restoreBtn');
                let max = qeid(_this.container, 'maximizeBtn');
                if (min)
                    setVisibility(min, resizeable && !minimized && canMinimize);
                if (res)
                    setVisibility(res, resizeable && ((maximized && canMaximize) || (minimized && canMinimize)));
                if (max)
                    setVisibility(max, resizeable && !maximized && canMaximize);
                let helpExists = !window.isMainWindow && document.body.hasAttribute('data-help'); // do not display help button for main window
                setVisibility(this.UI.helpBtn, helpExists);
            }
        }.bind(this);
        this.resetMoveable = function () {
            _this.refreshMoveableRegion();
        };
        this.localListen(elem, 'layoutchange', function () {
            _this.resetMoveable();
            _this._handleBorders();
        });
        this.localListen(thisWindow, 'moved', function () {
            _this.resetMoveable();
        });
        this.localListen(thisWindow, 'visibilitychanged', function (min, vis, state) {
            statChange(state == 2, state == 1);
            this.prepareForVideoPlayback(window.showAsVideoPlayer);
            this.resetMoveable();
        }.bind(this));
        statChange(false);
        // initialize window with header class
        window.headerClass = _this;
        this.localListen(this.UI.iconElement, 'contextmenu', function (e) {
            e.stopPropagation();
        });
        this.localListen(this.UI.iconElement, 'click', function (e) {
            let ar = [actions.restore, actions.maximize, actions.minimize, menuseparator, actions.closeWindow];
            let menu = new Menu(ar, {
                parent: _this.UI.iconElement
            });
            let pos = window.getScreenCoordsFromEvent(e);
            menu.show(pos.left, pos.top, false, true);
            e.stopPropagation();
        });
        this.localListen(window, 'menuchange', function (e) {
            let newVal = e.detail.alwaysVisible;
            setVisibility(_this.UI.titleElement, !newVal);
            _this.resetMoveable();
        });
        if (webApp) {
            setVisibility(this.UI.buttonsContainer, false);
        }
        //let border = this.borderSize; // #18403: cache border size
        this.prepareForVideoPlayback(false);
        if (isMainWindow) {
            this.UI.titleElement.classList.toggle('dynamic', false); // #19128
        }
    }
    cleanUp() {
        headerClass = null;
        this._border_left = null;
        this._border_right = null;
        this._border_top = null;
        this._border_bottom = null;
        super.cleanUp();
    }
    // --------------------------------
    // Internal functions
    // --------------------------------
    _handleBorders() {
        if (!window.webApp) {
            let shouldBeVisible = (!flat || app.inPartyMode) && !maximized;
            if (this._border_left)
                setVisibility(this._border_left, shouldBeVisible);
            if (this._border_right)
                setVisibility(this._border_right, shouldBeVisible);
            if (this._border_top)
                setVisibility(this._border_top, shouldBeVisible);
            if (this._border_bottom)
                setVisibility(this._border_bottom, shouldBeVisible);
            if (shouldBeVisible)
                this.container.parentElement.classList.add('winborder');
            else
                this.container.parentElement.classList.remove('winborder');
            if (shouldBeVisible) {
                this._borderSize = this._enumBorderSize();
            }
        }
    }
    _enumBorderSize() {
        if (!webApp && !isStub) {
            let style = getComputedStyle(this._border_left, null);
            return parseInt(style.getPropertyValue('width'));
        }
        return 0;
    }
    _loadInternalFrame() {
        this.container.innerHTML = loadFile('file:///controls/windowtitle.html');
        if (!window.isMainWindow) { // remove main tabs for other than main window
            let elements = qes(this.qChild('header'), '[data-mainWindowOnly]');
            if (elements) {
                forEach(elements, function (el) {
                    el.remove();
                });
            }
            setVisibility(this.qChild('mainMenuButton'), false);
            this.qChild('titleElement').classList.add('left-indent-small');
        }
        if (!webApp && !isStub) {
            this.container.parentElement.classList.add('winborder');
            let addDiv = function (className) {
                let d = document.createElement('div');
                d.classList.add(className);
                d.setAttribute('data-winborder', '1');
                document.body.appendChild(d);
                return d;
            };
            this._border_left = addDiv('winborder-left');
            this._border_right = addDiv('winborder-right');
            this._border_top = addDiv('winborder-top');
            this._border_bottom = addDiv('winborder-bottom');
            this._handleBorders();
        }
        if (!window.isMainWindow)
            return;
        // and add them into window title
        let customHolders = qe(this.container, '[data-windowheader-custom-placeholder]');
        if (customHolders) {
            // move main tabs from content and place to title header
            let content = qid('mainContentDiv');
            if (content) {
                let tabs_parent = qeid(content, 'tabs_parent');
                if (tabs_parent)
                    customHolders.appendChild(tabs_parent);
            }
        }
        initializeControls(this.container);
        this.refreshMoveableRegion();
    }
    _updateResizeable() {
        setVisibility(this.UI.maximizeBtn, this._isresizable && canMaximize);
        setVisibility(this.UI.minimizeBtn, this._isresizable && canMinimize);
    }
    _updateIcon() {
        if (this._icon) {
            loadIcon(this._icon, function (iconData) {
                this.UI.iconElement.innerHTML = iconData;
            }.bind(this));
        }
        else {
            this.UI.iconElement.innerHTML = '';
        }
    }
    getMoveableArea() {
        let gaps = [];
        if (this.disabled || this.disableWindowMove)
            return gaps;
        let l = 0;
        let tabsElem;
        if (window.isMainWindow && window.mainTabs) {
            tabsElem = window.mainTabs.items;
        }
        else
            tabsElem = [];
        const elements = [
            this.UI.iconElement,
            this.UI.mainMenuButton,
            ...this.UI.menuContainer.children,
            ...tabsElem,
            this.UI.buttonsContainer
        ];
        const visibleElements = elements.filter(el => el && isVisible(el));
        let currentRect = { left: 0, right: 0 };
        let nextRect;
        for (let i = 0; i < visibleElements.length; i++) {
            nextRect = visibleElements[i].getBoundingClientRect();
            let l = Math.round(currentRect.right);
            let r = Math.round(nextRect.left);
            if (r > l) {
                gaps.push({ left: l, right: r });
            }
            currentRect = nextRect;
        }
        return gaps;
    }
    prepareForVideoPlayback(enable) {
        if (this._cleanUpCalled || window._cleanUpCalled)
            return;
        let minimizeAllowed = window.resizeable;
        if (this.UI.switchBtn && isChildOf(getDocumentBody(), this.UI.switchBtn)) {
            setVisibility(this.UI.switchBtn, window.isMainWindow && !enable);
            if (enable) {
                let track = app.player.getCurrentTrack();
                if (track) {
                    minimizeAllowed = !track.isYoutubeVideo;
                }
            }
        }
        if (this.UI.minimizeBtn && isChildOf(getDocumentBody(), this.UI.minimizeBtn)) {
            setVisibility(this.UI.minimizeBtn, minimizeAllowed && canMinimize);
        }
        let menu = qe(this.container, '[data-control-class="MainMenu"]');
        if (menu && isChildOf(getDocumentBody(), menu)) {
            setVisibility(menu, app.getCurrentPlayer() == 0);
        }
        let customHolders = qe(this.container, '[data-windowheader-custom-placeholder]');
        if (customHolders && isChildOf(getDocumentBody(), customHolders)) {
            setVisibility(customHolders, app.getCurrentPlayer() == 0);
        }
    }
    _updateDisabledAttribute() {
        super._updateDisabledAttribute();
        setVisibility(this.UI.buttonsContainer, !this.disabled && !this.disableWindowMove);
        this.resetMoveable();
    }
    refreshMoveableRegion() {
        let _this = this;
        _this.requestIdle(() => window.setMoveableArea(_this.getMoveableArea()), 'WindowMoveArea');
        bounds.setSkinBorderSize(this.borderSize);
    }
    // --------------------------------
    // Properties
    // --------------------------------
    /**
    Get/set caption of the window

    @property caption
    @type string
    @default ''
    */
    get caption() {
        return this.UI.titleElement.innerText;
    }
    set caption(val) {
        this.UI.titleElement.innerText = val;
    }
    get headersize() {
        let style = getComputedStyle(this.UI.header, null);
        return parseFloat(style.getPropertyValue('height')) || 24;
    }
    /**
    Get/set svg icon of the window

    @property icon
    @type string
    @default ''
    */
    get icon() {
        return this._icon;
    }
    set icon(value) {
        if (this._icon != value) {
            this._icon = value;
            this._updateIcon();
        }
    }
    /**
    Get/set when window can be resized

    @property resizable
    @type bool
    @default true
    */
    get resizable() {
        return this._isresizable;
    }
    set resizable(val) {
        this._isresizable = val;
        this._updateResizeable();
    }
    get borderSize() {
        if (this._borderSize === undefined)
            this._borderSize = this._enumBorderSize();
        return this._borderSize;
    }
    get disableWindowMove() {
        return this._disableWindowMove;
    }
    set disableWindowMove(val) {
        this._disableWindowMove = val;
        this._updateDisabledAttribute();
    }
}
registerClass(WindowTitle);
