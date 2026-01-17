/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

registerFileImport('controls/navigationBar');
'use strict';
import Control from './control';
/**
@module UI snippets
*/
/*
requirejs('controls/control');
requirejs('controls/button');
requirejs('controls/popupmenu');
*/
/**
NavigationBar - control for manage history

@class NavigationBar
@constructor
@extends Control
*/
class NavigationBar extends Control {
    initialize(rootelem, params) {
        super.initialize(rootelem, params);
        this._navButtons = [];
        this._history = null;
        this._shrinked = false;
        this._fullSize = 0;
        this._customDocks = {};
        this.container.className = 'flex row';
        this.helpContext = 'Filelisting#Navigating_with_Breadcrumbs';
        this.navContainer = document.createElement('div');
        this.navContainer.className = 'flex row';
        this.container.appendChild(this.navContainer);
        this.addUndoButton();
        this.addNavbar();
        initializeControls(this.container);
        this.updateButtons();
        this.updateNavigation(null);
        this.layoutChanged = function () {
            if (this.totalButtons > 0 && !this.__layoutChange) {
                this.__layoutChange = true;
                enterLayoutLock(this.container);
                let left = this.container.offsetLeft + this._navDock.offsetLeft + this._navButtons[0].offsetLeft + this._navButtons[0].offsetWidth;
                let right = left + this._navDock.offsetWidth;
                let par = this.container.nextElementSibling || this.container.parentElement.nextElementSibling;
                if (par) {
                    right = par.offsetLeft;
                }
                let next = this.container.firstElementChild;
                while (next) {
                    if (next.classList.contains('searchBox')) {
                        right -= next.offsetWidth;
                        left += next.offsetWidth;
                        break;
                    }
                    next = next.nextElementSibling;
                }
                let width = right - left;
                let sz = 0;
                let ar = [];
                for (let i = this.totalButtons - 1; i > 0; i--) {
                    let btn = this._navButtons[i];
                    if (btn._offsetWidth == -1 || isVisible(btn))
                        btn._offsetWidth = btn.offsetWidth;
                    sz += btn._offsetWidth; // we need to use this cached value as hidden element have offsetWidth 0
                    ar.unshift({
                        btn: btn,
                        sz: btn._offsetWidth,
                    });
                    if (i == this.totalButtons - 1)
                        btn.labelSpan.classList.add('lastButton');
                    else
                        btn.labelSpan.classList.remove('lastButton');
                }
                this._shrinked = false;
                if (ar.length) {
                    let lastBtn = ar[ar.length - (ar.length > 1 ? 2 : 1)]; // show at least two last buttons (if possible) - issue #14573
                    let shouldShowHideMark = false;
                    let idx = ar.length - 3; // last item should be always visible (exclude 'All')
                    if (ar.length > 1 && ar[ar.length - 1].btn.viewData.viewNode.handlerID === 'all') {
                        // ignore 'all' and always show last 2 items
                        lastBtn = ar[idx];
                        idx--;
                    }
                    if (lastBtn)
                        setVisibilityFast(lastBtn.btn, true);
                    while (idx >= 0) {
                        let canShow = sz < width;
                        setVisibilityFast(ar[idx].btn, canShow);
                        sz -= ar[idx].sz;
                        idx--;
                        if (!canShow) {
                            shouldShowHideMark = true; // '...' mark should be visible when any path part is hidden
                            this._shrinked = true;
                        }
                    }
                    if (lastBtn && lastBtn.btn.hideMark) {
                        setVisibilityFast(lastBtn.btn.hideMark, shouldShowHideMark, {
                            animate: false
                        });
                    }
                }
                if (!this._shrinked)
                    this.container.classList.remove('shrinked');
                else
                    this.container.classList.add('shrinked');
                leaveLayoutLock(this.container);
                this.__layoutChange = undefined;
            }
        }.bind(this);
        this.localListen(this.container, 'layoutchange', this.layoutChanged);
        this.actionChange = function () {
            this.update();
        }.bind(this);
        this.container.setAttribute('data-actionchangelisten', '1');
        this.localListen(this.container, 'actionchange', this.actionChange);
        this.initSearchIndicator();
        this.initViewFilterIndicator();
    }
    initSearchIndicator() {
        this.localListen(document.body, 'searchchange', (e) => {
            let searchData = e.detail;
            if (searchData.type == 'activelist' || searchData.type == 'scrollmatches') {
                if (searchData.visible)
                    this.addCustomIcon('search', 'search');
                else
                    this.addCustomIcon(undefined, 'search');
            }
            else {
                this.addCustomIcon(undefined, 'search');
                if (!searchData.isContextualSearch)
                    this.update(); // to update the search text from the node.dataSource (queryData)
            }
        });
    }
    initViewFilterIndicator() {
        let QD = app.db.getQueryDataSync('filter');
        this.localListen(QD, 'change', (e) => {
            this.localPromise(QD.getTextAsync()).then((txt) => {
                if (txt != '') {
                    let icon = this.addCustomIcon('filter_remove', 'viewFilter');
                    if (!icon.___initialized) {
                        icon.___initialized = true;
                        icon.classList.add('hoverHighlight');
                        icon.setAttribute('data-tip', _('Cancel filter'));
                        this.localListen(icon, 'click', function (e) {
                            actions.viewFilter.discard(true /* manual*/);
                            e.stopPropagation();
                        });
                    }
                }
                else
                    this.addCustomIcon(undefined, 'viewFilter');
                let lbl = this.addCustomText(txt, 'viewFilter');
                if (!lbl.___initialized) {
                    lbl.___initialized = true;
                    lbl.classList.add('hoverHighlight');
                    this.localListen(lbl, 'click', function (e) {
                        actions.viewFilter.execute();
                        e.stopPropagation();
                    });
                }
            });
        });
    }
    _anyCustomDockVisible() {
        let anyVisible = false;
        for (let dock_id in this._customDocks) {
            let dock = this._customDocks[dock_id];
            if (dock.__visible)
                anyVisible = true;
        }
        return anyVisible;
    }
    _handleCustomVisibility(dock_id) {
        let dock = this._customDocks[dock_id];
        let lblEmpty = true;
        let iconEmpty = true;
        if (dock) {
            if (dock.customLabel)
                lblEmpty = dock.customLabel.innerHTML == '';
            if (dock.customIcon)
                iconEmpty = dock.customIcon.innerHTML == '';
        }
        let visible = !lblEmpty || !iconEmpty;
        setVisibility(dock, visible);
        dock.__visible = visible;
    }
    _addCustomDock(showExpPopup, dock_id) {
        if (!this._customDocks[dock_id]) {
            this._customDocks[dock_id] = document.createElement('div');
            this._customDocks[dock_id].className = 'btn navbar appendix flex row';
            this.navContainer.appendChild(this._customDocks[dock_id]);
        }
        if (this.totalButtons) {
            let lastButton = this._navButtons[this.totalButtons - 1];
            if (!isVisible(lastButton.popupSpan))
                setVisibility(lastButton.btnSpan.popupSpanDummy, showExpPopup);
        }
        return this._customDocks[dock_id];
    }
    addCustomText(text, dock_id) {
        let dock = this._addCustomDock(text != '', dock_id);
        let lbl = dock.customLabel;
        if (!lbl) {
            lbl = document.createElement('label');
            lbl.className = 'verticalCenter';
            dock.customLabel = lbl;
            dock.appendChild(lbl);
        }
        let txts = isOurHTML(text);
        if (txts)
            lbl.innerHTML = txts;
        else {
            txts = text;
            lbl.innerText = text;
        }
        lbl.tooltipValueCallback = (tipDiv) => {
            tipDiv.innerText = txts;
        };
        this._handleCustomVisibility(dock_id);
        return lbl;
    }
    addCustomIcon(icon, dock_id) {
        let dock = this._addCustomDock(icon != undefined, dock_id);
        let span = dock.customIcon;
        if (!span) {
            span = document.createElement('div');
            span.classList.add('icon');
            span.classList.add('verticalCenter');
            dock.customIcon = span;
            dock.appendChild(span);
        }
        if (!icon) {
            span.innerHTML = '';
            span._icon = undefined;
            this._handleCustomVisibility(dock_id);
        }
        else {
            if (span._icon != icon) {
                loadIcon(icon, (iconData) => {
                    span.innerHTML = iconData;
                    span._icon = icon;
                    this._handleCustomVisibility(dock_id);
                });
            }
        }
        return span;
    }
    /*
    // LS: following methods seems no longer needed, but left them commented for future usage?
    
    resetCustomText: function () {
        var docks = getSortedAsArray(this._customDocks);
        for (var i = 0; i < docks.length; i++) {
            var dock = docks[i];
            this.addCustomIcon(undefined, dock.key);
            this.addCustomText('', dock.key);
        }
    },

    storeCustomText: function () {
        var docks = getSortedAsArray(this._customDocks);
        var state = [];
        for (var i = 0; i < docks.length; i++) {
            var dock = docks[i];
            var st = {};
            if (dock.customLabel)
                st.text = dock.customLabel.innerHTML;
            if (dock.customIcon)
                st.icon = dock.customIcon._icon;
            st.dock_id = dock.key;
            state.push(st);
        }
        return state;
    },

    restoreCustomText: function (state) {
        if (state) {
            for (var i = 0; i < state.length; i++) {
                var st = state[i];
                if (st.icon)
                    this.addCustomIcon(st.icon, st.dock_id);
                if (st.text)
                    this.addCustomText(st.text, st.dock_id);
            }
        }
    },
    */
    doUndo() {
        if (this._history) {
            this._history.undo();
        }
    }
    addUndoButton() {
        // add default undo button
        this._undoBtn = document.createElement('div');
        this._undoBtn.setAttribute('data-icon', 'undo');
        this._undoBtn.tooltipValueCallback = (tipDiv) => {
            let act = actions.history.backward;
            if (act.shortcut)
                tipDiv.innerText = resolveToValue(act.title) + ' (' + act.shortcut + '). ' + _('Right-click for history.');
            else
                tipDiv.innerText = resolveToValue(act.title);
        };
        this._undoBtn.setAttribute('data-control-class', 'Control');
        this._undoBtn.setAttribute('data-aria-label', _('&Undo').replace('&', '')); // Label for screen readers ("Undo" is not translated, only "&Undo")
        this._undoBtn.className = 'toolbutton';
        this.navContainer.appendChild(this._undoBtn);
        initializeControl(this._undoBtn);
        let undoBtnCls = this._undoBtn.controlClass;
        this.localListen(this._undoBtn, 'mousedown', (e) => {
            let isLeftButton = (e.button === 0);
            if (isLeftButton) {
                undoBtnCls.mousedownTm = Date.now();
                this.requestTimeout(() => {
                    if (undoBtnCls.mousedownTm) {
                        undoBtnCls.contextMenuHandler(e);
                        undoBtnCls.mousedownTm = 0;
                    }
                }, 500, 'longclicktimeout'); // name timeout, so only last is called
            }
        });
        this.localListen(this._undoBtn, 'mouseup', (e) => {
            let isLeftButton = (e.button === 0);
            if (isLeftButton)
                this.doUndo();
            undoBtnCls.mousedownTm = 0;
        });
        // add right-click menu with all items:
        undoBtnCls.contextMenu = []; // to init the menu
        undoBtnCls.getContextMenuItems = function () {
            let menuItems = [];
            let history = this._history;
            for (let i = history._currentPos - 1; i >= 0; i--) {
                let viewData = history._historyItems[i];
                menuItems.push({
                    title: viewData.title,
                    icon: resolveToValue(viewData.icon),
                    historyPos: i,
                    execute: function () {
                        history.moveToPosition(this.historyPos);
                    }
                });
            }
            if (menuItems.length > 0) {
                menuItems.push(menuseparator);
                menuItems.push({
                    title: _('Clear history'),
                    icon: 'delete',
                    execute: function () {
                        history.clearHistory();
                    }
                });
            }
            return menuItems;
        }.bind(this);
    }
    addNavbar() {
        this._navDock = document.createElement('div');
        this._navDock.classList.add('flex');
        this._navDock.classList.add('row');
        this._navDock.classList.add('navbar');
        this._navDock.tooltipValueCallback = (tipDiv, show, displayParams) => {
            if (this._shrinked && show) {
                tipDiv.innerHTML = sanitizeHtml(this._tooltip);
                displayParams.limitWidth = false;
                displayParams.posX = 1;
            }
            else
                tipDiv.innerHTML = '';
        };
        this.navContainer.appendChild(this._navDock);
    }
    cleanUp() {
        //cancelPromise(this._renderPromise);        
        this._navButtons.forEach(function (btn) {
            app.unlisten(btn, 'click');
            let obj = btn._changeEventPersistentObject;
            let func = btn._changeEventPersistentFunc;
            if (obj && func) {
                app.unlisten(obj, 'change', func);
            }
        });
        super.cleanUp();
    }
    updateButtons() {
        if (this._history && this._history.canUndo())
            this._undoBtn.controlClass.disabled = false;
        else
            this._undoBtn.controlClass.disabled = true;
    }
    update() {
        if (this._history) {
            this.updateNavigation(this._history.getCurrent());
        }
    }
    createItemsMenu(event, parent, viewData) {
        let _this = this;
        let prepareMenuItem = function (item) {
            return {
                data: item,
                icon: nodeUtils.getNodeIcon(item),
                title: nodeUtils.getNodeTitle(item),
                execute: function (action) {
                    if (_this._history) {
                        let historyObj = _this._history;
                        historyObj.add(historyObj.createViewData({
                            node: this
                        }), true);
                    }
                }.bind(item)
            };
        };
        let fillMenu = (items) => {
            let menuitems = [];
            items.locked(function () {
                let MAX_COUNT = 300; // more than this is hard to navigate anyway
                let use_count = Math.min(items.count, MAX_COUNT);
                for (let i = 0; i < use_count; i++) {
                    let item = items.getValue(i);
                    let menuitem = prepareMenuItem(item);
                    menuitems.push(menuitem);
                }
                if (items.count > MAX_COUNT)
                    menuitems.push({
                        title: '...'
                    });
            });
            return new Menu(menuitems, {
                parent: parent,
                onmenuclosed: () => {
                    loadIcon('rightArrow', (iconData) => {
                        parent.innerHTML = iconData;
                    });
                    setTimeout(() => {
                        parent._menuOpened = false;
                    }, 500);
                }
            });
        };
        let node = viewData.viewNode;
        if (!parent._menuOpened) {
            nodeUtils.loadChildren(node).then(() => {
                let pos = findScreenPos(parent);
                if (parent.controlClass && (parent.controlClass._lastKey === 'Enter')) {
                    parent.controlClass._lastKey = '';
                }
                pos.top += Math.floor(parent.clientHeight);
                parent._menuOpened = true;
                loadIcon('downArrow', function (iconData) {
                    parent.innerHTML = iconData;
                });
                fillMenu(node.children).show(pos.left, pos.top);
            });
        }
    }
    _callCloseSearch(mode) {
        let event = createNewCustomEvent('closesearch', {
            detail: {
                searchType: mode,
            },
            bubbles: true,
            cancelable: true
        });
        document.body.dispatchEvent(event);
    }
    navButtonClick(event) {
        if (this._history) {
            let viewData = null;
            let ctrl = event.target;
            while (ctrl && getParent(ctrl)) {
                if (ctrl.viewData) {
                    viewData = ctrl.viewData;
                    break;
                }
                ctrl = getParent(ctrl);
            }
            let historyObj = this._history;
            if (event.target.hasAttribute('data-popupLabel')) {
                this.createItemsMenu(event, event.target, viewData);
            }
            else {
                if (viewData.nodePath == 'root') { // do not use root, but home node instead
                    historyObj.home();
                }
                else {
                    if (viewData.viewNode.handlerID != 'all') {
                        this._callCloseSearch('activelist'); // #14103: Clicking the last breadcrumbs item should reset the filtered results
                        historyObj.add(viewData, true);
                    }
                }
            }
            event.stopPropagation();
        }
    }
    presetNavButton(btn, viewData, caption, tooltip, isLast) {
        let createlabel = function (parent) {
            let lbl = parent.buttonLabel;
            if (!lbl) {
                lbl = document.createElement('label');
                parent.buttonLabel = lbl;
                parent.appendChild(lbl);
            }
            if ((btn._lastTitleFormatData != undefined) && (viewData.viewNode) && (btn._lastTitlePersistentID == viewData.viewNode.persistentID) && (isLast)) {
                let txt = resolveToValue(btn._lastTitleFormatData, '');
                let txts = isOurHTML(txt);
                if (txts)
                    lbl.innerHTML = txts;
                else
                    lbl.innerText = txt;
            }
            else {
                let txts = isOurHTML(caption);
                if (txts)
                    lbl.innerHTML = txts; // LS: needs to be innerHTML for SVG rating stars to show correctly
                else
                    lbl.innerText = caption;
            }
            setVisibility(parent, (lbl.innerHTML).toString().trim() !== '');
        };
        let createpopup = function (parent, dummy) {
            let lbl = parent.buttonPopup;
            if (!lbl) {
                lbl = document.createElement('label');
                parent.buttonPopup = lbl;
                lbl.classList.add('btn');
                if (!dummy)
                    lbl.setAttribute('data-popupLabel', '1');
                parent.appendChild(lbl);
                lbl.innerText = '>';
            }
        };
        let createBtnDiv = function (parent, name) {
            let div = parent[name];
            if (!div) {
                div = document.createElement('div');
                parent[name] = div;
                parent.appendChild(div);
            }
            return div;
        };
        let createFullSpan = function (parent, name) {
            let div = parent[name];
            if (!div) {
                div = document.createElement('div');
                div.setAttribute('data-id', name);
                parent[name] = div;
                parent.appendChild(div);
            }
            return div;
        };
        btn.viewData = viewData;
        let btnDiv = createBtnDiv(btn, 'btnSpan');
        btnDiv.classList.add('toolbutton');
        btnDiv.classList.add('flex');
        btnDiv.classList.add('row');
        let iconSpan = createFullSpan(btnDiv, 'iconSpan');
        iconSpan.classList.add('icon');
        let labelSpan = createFullSpan(btnDiv, 'labelSpan');
        createlabel(labelSpan);
        if (labelSpan.buttonLabel) {
            btnDiv.buttonLabel = labelSpan.buttonLabel;
            btnDiv.buttonLabel.setAttribute('data-navbar-button-label', '1');
        }
        btn.buttonLabel = btnDiv.buttonLabel;
        btn.labelSpan = labelSpan;
        let icon = viewData.icon();
        if (icon) {
            if (btn.icon != icon) {
                loadIcon(icon, function (iconData) {
                    iconSpan.innerHTML = iconData;
                    // Give the svg a label for screen readers; prioritize text caption, fallback to just the icon name (with uppercase first letter)
                    let label = (caption && caption.trim()) ? caption : (icon[0].toUpperCase() + icon.substring(1, icon.length));
                    setIconAriaLabel(iconSpan, _(label));
                });
            }
        }
        else { // no icon            
            iconSpan.innerHTML = '';
        }
        btn.icon = icon;
        btn.iconSpan = iconSpan;
        let node = viewData.viewNode;
        let handler = nodeHandlers[node.handlerID];
        let isVirtualNode = !isFunction(handler.getChildren);
        let isExpandable = !isVirtualNode && nodeUtils.getHasChildren(node) && (handler.isNavbarExpandable != false);
        // create expandable [>] button:
        let popupSpan = createBtnDiv(btn, 'popupSpan');
        popupSpan.setAttribute('data-popupLabel', '1');
        popupSpan.classList.add('toolbutton');
        popupSpan.classList.add('popupButton');
        setVisibility(popupSpan, isExpandable);
        // create just dummy [>] button for virtual subnodes like albums (issue #12783):
        let useDummyPopup = !isExpandable && (!isLast || this._anyCustomDockVisible() /* #14293 - item 11 */);
        let popupSpanDummy = createBtnDiv(btnDiv, 'popupSpanDummy');
        popupSpanDummy.classList.add('toolbutton');
        popupSpanDummy.classList.add('popupButton');
        popupSpanDummy.setAttribute('data-dummy-popup', '1');
        setVisibility(popupSpanDummy, useDummyPopup);
        if (useDummyPopup) {
            btnDiv.setAttribute('data-dummy-popup', '1');
        }
        else
            btnDiv.removeAttribute('data-dummy-popup');
        loadIcon('rightArrow', function (iconData) {
            popupSpan.innerHTML = iconData;
            popupSpanDummy.innerHTML = iconData;
            setIconAriaLabel(popupSpan, _('Sub-nodes')); // #17949: Change to "Dropdown" in the future when it's translated
            setIconAriaLabel(popupSpanDummy, _('Sub-nodes'));
        });
        if (!btn._nodeTitleChangeEventAdded) {
            btn._nodeTitleChangeEventAdded = true;
            this.localListen(window, 'nodetitlechange', function (e) {
                if ((e.detail.node.persistentID === btn.viewData.viewNode.persistentID) && isLast) { // it's this button
                    btn._lastTitlePersistentID = e.detail.node.persistentID;
                    if (e.detail.data)
                        btn._lastTitleFormatData = e.detail.data.formatTitle;
                    else
                        btn._lastTitleFormatData = undefined; // #13639
                    labelSpan.buttonLabel.innerText = e.detail.caption;
                }
            });
        }
        // capture title changes to update navbar
        if (viewData && viewData.viewNode && viewData.viewNode.dataSource && viewData.viewNode.dataSource.isObservable) {
            if (viewData.viewNode.persistentID != btn._changeEventPersistentID) {
                if (btn._changeEventPersistentObject && btn._changeEventPersistentFunc) {
                    // release change event of old object in new frame so it will not break up current button refresh
                    let obj = btn._changeEventPersistentObject;
                    let func = btn._changeEventPersistentFunc;
                    this.requestFrame(function () {
                        app.unlisten(obj, 'change', func);
                    });
                }
                btn._changeEventPersistentID = viewData.viewNode.persistentID;
                btn._changeEventPersistentObject = viewData.viewNode.dataSource;
                btn._changeEventPersistentFunc = app.listen(viewData.viewNode.dataSource, 'change', function (e, title) {
                    if (e === 'title') {
                        labelSpan.buttonLabel.innerText = title;
                    }
                });
            }
        }
    }
    addNavButton(viewData, caption, tooltip, asButton, isLast) {
        let btn = document.createElement('div');
        if (asButton) {
            btn.setAttribute('data-control-class', 'Button');
            initializeControl(btn);
        }
        else {
            // this hideMark should be shown when any navigation path is shortened because of size of the navigator bar (#14089)
            btn.hideMark = document.createElement('div');
            btn.hideMark.classList.add('verticalCenter');
            btn.hideMark.style.display = 'none'; // hidden by default
            btn.hideMark.innerText = '...';
            btn.appendChild(btn.hideMark);
        }
        btn.classList.add('button_container');
        btn.classList.add('flex');
        btn.classList.add('row');
        this._navDock.appendChild(btn);
        this.presetNavButton(btn, viewData, caption, tooltip, isLast);
        app.listen(btn, 'click', this.navButtonClick.bind(this));
        if (viewData) {
            this._navButtons.push(btn);
        }
        return btn;
    }
    hideButtons(fromIdx, toIdx) {
        assert(fromIdx >= 0 && fromIdx < this._navButtons.length);
        assert(toIdx >= 0 && toIdx > fromIdx && toIdx <= this._navButtons.length);
        for (let i = fromIdx; i < toIdx; i++) {
            setVisibility(this._navButtons[i], false);
        }
    }
    updateNavigation(viewData) {
        // WHEN GENERATOR IS SUPPORTED
        // this.updateStep = function* () {
        // WHEN GENERATOR IS NOT SUPPORTED
        // this.updateStep = function () {
        //this.updateStep = function *() {
        //this._updateTimeout = undefined;
        this.updateButtons();
        //var customTextState = this.storeCustomText();
        //this.resetCustomText();
        let _this = this;
        this.totalButtons = 0;
        if (viewData && _this._history) {
            let parents = [];
            let hasRoot = false;
            let rootNode = window.currentTabControl.rootNode;
            let node = viewData.viewNode;
            while (node) {
                if (node.handlerID == rootNode.handlerID)
                    hasRoot = true;
                parents.unshift(node);
                node = node.parent;
            }
            if (!hasRoot) {
                parents.unshift(rootNode);
            }
            // check last node is folder or DB folder (with includeSubfoldersSupport support) and window.includeSubfoldersInLocations is true
            if (window.includeSubfoldersInLocations) {
                if (parents.length) {
                    let item = parents[parents.length - 1];
                    let vd = _this._history.createViewData({
                        node: item
                    });
                    if (resolveToValue(vd.nodehandler.includeSubfoldersSupport, false)) {
                        parents.push({
                            handlerID: 'all',
                        });
                    }
                }
            }
            enterLayoutLock(this.container);
            this._shrinked = false;
            this.container.classList.remove('shrinked');
            this._tooltip = '<div class="flex row navbar">';
            let lastIconName = '';
            for (let i = 0; i < parents.length; i++) {
                let item = parents[i];
                if (item && item.handlerID != 'home') {
                    let title = nodeUtils.getNodeTitle(item);
                    let btn = null;
                    let vd = _this._history.createViewData({
                        node: item
                    });
                    let isLast = i == parents.length - 1;
                    if (_this._navButtons.length >= this.totalButtons + 1) { // use cached button
                        btn = _this._navButtons[this.totalButtons];
                        _this.presetNavButton(btn, vd, title, '', isLast);
                        setVisibility(btn, true);
                    }
                    else { //create new button
                        btn = _this.addNavButton(vd, title, '', false, isLast);
                    }
                    btn.style.order = i;
                    btn._offsetWidth = -1;
                    let iconVisible = (btn.icon !== lastIconName && btn.icon);
                    setVisibilityFast(btn.iconSpan, iconVisible);
                    if (btn.buttonLabel) {
                        if (iconVisible)
                            btn.buttonLabel.setAttribute('data-navbar-button-label', '1');
                        else
                            btn.buttonLabel.removeAttribute('data-navbar-button-label');
                    }
                    if (btn.hideMark)
                        setVisibilityFast(btn.hideMark, false, {
                            animate: false
                        });
                    lastIconName = btn.icon;
                    this._tooltip = this._tooltip + btn.outerHTML;
                    this.totalButtons++;
                }
            }
            this._tooltip = this._tooltip + '</div>';
            if (this._navButtons.length > 0 && this.totalButtons < this._navButtons.length) {
                this.hideButtons(this.totalButtons, this._navButtons.length);
            }
            //this.restoreCustomText(customTextState);
            this.layoutChanged();
            leaveLayoutLock(this.container);
        }
        else {
            if (this._navButtons.length > 0) {
                this.hideButtons(0, this._navButtons.length);
            }
        }
        //}.bind(this);
        // WHEN GENERATOR IS SUPPORTED
        /*cancelPromise(this._renderPromise);

        if (!this._cleanUpCalled) { // it can get here after cleanUp via 'historyupdate' event handler
            var _this = this;
            this._renderPromise = asyncGenerator(this.updateStep);
            this._renderPromise.then(function () {
                _this._renderPromise = undefined
            });
        }*/
        // WHEN GENERATOR IS NOT SUPPORTED
        //this.updateStep();
    }
    set history(value) {
        this._history = value;
        this.updateButtons();
    }
    get history() {
        return this._history;
    }
}
registerClass(NavigationBar);
