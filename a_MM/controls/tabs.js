/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

registerFileImport('controls/tabs');
'use strict';
import Control from './control';
/**
@module UI
*/
/**
UI Tabs element

@class Tabs
@constructor
@extends Control
*/
export default class Tabs extends Control {
    initialize(elem, params) {
        super.initialize(elem, params);
        // Configuration properties
        /**
        Allows reordering of tabs using Drag&Drop.

        @property dndReordering
        @type boolean
        @default false
        */
        this.dndReordering = false; // Allow reordering of tabs by d&d.
        this._fixedWidth = false;
        this.focusVisible = false;
        this.closeBtnOnHover = false;
        this.focusOnRightClick = true;
        this._checkParentFocus = false;
        this.disableArrowsNavigation = false;
        if (params && params.resizeable)
            this.resizeable = true;
        else
            this.resizeable = false;
        // Process header items
        let list = qetag(this.container, 'ul');
        if (list.length > 0) {
            this.header = list[0];
            forEach(this.items, function (tab) {
                // localization needed, as we bypass default processing
                tab.innerHTML = _(tab.innerHTML);
                this.initializeTab(tab);
            }.bind(this));
        }
        else {
            this.header = document.createElement('ul');
            this.container.appendChild(this.header);
        }
        // Process panels
        let srcpanels = filterTag(this.container.children, 'div');
        this.panelsContainer = document.createElement('div');
        forEach(srcpanels, function (panel) {
            this.panelsContainer.appendChild(this.initializePanel(panel));
        }.bind(this));
        // Make sure that there's enough panels for all tabs
        let diff = this.length - this.panels.length;
        if (diff < 0)
            throw 'Not enough tab headers!';
        else
            while (diff--) {
                this.panelsContainer.appendChild(this.initializePanel(document.createElement('div')));
            }
        this.container.classList.add('tabs');
        this.header.classList.add('tabsHeaders');
        this.container.setAttribute('role', 'tablist'); // Screen reader support
        this.panelsContainer.classList.add('tabPanels');
        if (this.resizeable) {
            this.container.classList.add('resizeable');
        }
        this.container.appendChild(this.panelsContainer);
        this.registerEventHandler('keydown');
        this.registerEventHandler('layoutchange');
        if (this.length > 0 && this.selectedIndex < 0)
            this.selectedIndex = 0;
        if ((this.container.tabIndex === undefined) || (this.container.tabIndex < 0))
            this.container.tabIndex = 0; // Tab index makes sure that we can get focus        
        // #16958: ctrl+tab/ctrl+shift+tab need to be captured always
        this.localListen(window, 'keydown', (e) => {
            let key = friendlyKeyName(e);
            if (key === 'Tab' && e.ctrlKey) {
                this.handle_keydown(e);
            }
        });
    }
    closeCurrentTab() {
        this.closeTab(this.items[this.selectedIndex]);
    }
    handle_keydown(e) {
        let key = friendlyKeyName(e);
        // some buttons handle only in case, they are really pressed on this control, to avoid e.g. tab switching during pressing arrow keys in child edit boxes
        let pressedOnThisTab = e.target && (e.target.getAttribute('data-uniqueid') === this.uniqueID);
        let _afterKeyboardNav = function () {
            this.focusVisible = true; // After a keyboard operation, make focus rectangle visible                 
            this.container.focus(); // focus tabs header, so that we don't lose focus when hiding old tab
            e.stopPropagation();
        }.bind(this);
        switch (key) {
            case 'Tab':
                if (e.ctrlKey) {
                    let i = this.selectedIndex;
                    while (true) {
                        i = this.getNextTabIndex(i, e.shiftKey);
                        if (this._getCanBeSelected(i)) {
                            this.selectedIndex = i;
                            break;
                        }
                        if (i == this.selectedIndex) // we haven't found any selectable tab (other than currently selected)
                            break;
                    }
                    _afterKeyboardNav();
                }
                break;
            case 'F4':
            case 'w':
            case 'W':
                if (e.ctrlKey && this.selectedIndex >= 0 && this.hasCloseButton(this.selectedIndex)) {
                    this.closeCurrentTab();
                    _afterKeyboardNav();
                }
                break;
            case 'Left':
                if (pressedOnThisTab && !this.disableArrowsNavigation) {
                    this.previousTab();
                    _afterKeyboardNav();
                }
                break;
            case 'Right':
                if (pressedOnThisTab && !this.disableArrowsNavigation) {
                    this.nextTab();
                    _afterKeyboardNav();
                }
                break;
        }
    }
    handle_layoutchange(e) {
        this.requestFrame(this.render.bind(this));
        super.handle_layoutchange(e);
    }
    canDrawFocus() {
        return false;
    }
    markFocused(idx, focused) {
        if (idx >= this.items.length)
            return;
        let div = this.items[idx];
        if (focused) {
            div.setAttribute('data-focused', '1');
            if (this.focusVisible)
                div.setAttribute('data-keyfocused', '1');
            setAriaActiveDescendant(div, this.container); // Screen reader support
        }
        else {
            div.removeAttribute('data-focused');
            div.removeAttribute('data-keyfocused');
            clearAriaID(div); // Screen reader support
        }
    }
    focusRefresh(newFocusState) {
        this.focusVisible = newFocusState;
        this.markFocused(this.selectedIndex, newFocusState);
    }
    ignoreHotkey(hotkey) {
        let ar = ['Right', 'Left', 'Ctrl+F4', 'Ctrl+W', 'Ctrl+Tab'];
        return inArray(hotkey, ar, true /* ignore case */);
    }
    cleanUp() {
        app.unlisten(this.header);
        forEach(this.items, function (tab, i) {
            app.unlisten(tab);
            app.unlisten(tab.closebtn);
        });
        super.cleanUp();
    }
    /**
    Returns index of the tab header element.

    @method getTabIndex
    @param {li} tab Tab header element
    @return {int} index of the tab (or -1 if not found).
    */
    getTabIndex(tab) {
        let index = -1;
        forEach(this.items, function (item, i) {
            if (item === tab)
                index = i;
        });
        return index;
    }
    _getCanBeSelected(index) {
        let canProceed = true;
        forEach(this.items, (item, i) => {
            if (i == index && (item.hidden || item.isAddNew))
                canProceed = false; // we cannot select hidden tab
        });
        return canProceed;
    }
    previousTab() {
        let i = this.selectedIndex;
        while (i > 0) {
            i--;
            if (this._getCanBeSelected(i)) {
                this.selectedIndex = i;
                break;
            }
        }
    }
    nextTab() {
        let i = this.selectedIndex;
        while (i < this.length - 1) {
            i++;
            if (this._getCanBeSelected(i)) {
                this.selectedIndex = i;
                break;
            }
        }
    }
    getDropTabIndexFromRelativePosition(offsetX, offsetY) {
        let res;
        forEach(this.items, function (tab, index) {
            if (res === undefined && offsetX < tab.offsetLeft + tab.offsetWidth)
                res = index;
        });
        if (res >= 0)
            return res;
        else
            return this.length;
    }
    /**
    Set given tab caption (title).

    @method setTabTitle
    @param {integer} tab given tab or tab id
    @param {string} caption New caption of the tab
    */
    setTabTitle(tab, title) {
        if (tab.invalid)
            return;
        if (typeof tab == 'string')
            tab = this.getTabByID(tab);
        if (tab) {
            let sval = isOurHTML(title);
            if (sval) // to avoid unwanted HTML interpretation
                tab.caption.innerHTML = sval; // innerHTML is needed here, because e.g. nodeHandlers.rating returns the stars collage
            else
                tab.caption.innerText = title;
        }
        setVisibility(tab.caption, title != ''); // To prevent showing empty string of a minimal width (which is driven by CSS).
    }
    setTabIcon(tab, icon) {
        if (tab.invalid)
            return;
        if (icon) {
            loadIcon(icon, function (data) {
                if (document.body.contains(tab.icon)) { // we have still tab in DOM, continue
                    tab.icon.innerHTML = data;
                    setVisibility(tab.icon, true);
                    // janky way of setting "new tab" label (No collections or nodes have the "add" icon by default)
                    if (icon === 'add')
                        setIconAriaLabel(tab.icon, _('New tab'));
                }
            });
        }
        else {
            setVisibility(tab.icon, false);
        }
        tab._iconName = icon;
    }
    clickTab(tab) {
        if (tab.invalid)
            return;
        if (tab.isAddNew) {
            this.raiseEvent('newtab', {}); // clicked new tab button (+)
        }
        else {
            let tabs = tab.parentTabs;
            let currentIndex = tabs.selectedIndex;
            let newIndex = tabs.getTabIndex(tab);
            if (newIndex != tabs.selectedIndex) {
                tabs.selectedIndex = newIndex;
            }
        }
    }
    /**
    This method is called for each newly added tab header.

    @method initializeTab
    @param {HTMLElement} tab Tab item to be initialized
    */
    initializeTab(tab) {
        let _this = this;
        let icon = tab.getAttribute('data-icon');
        tab.removeAttribute('data-icon');
        tab.classList.add('tabsHeader');
        tab.setAttribute('role', 'tab'); // Screen reader support
        tab.parentTabs = this;
        tab.invalid = false;
        let inner = tab.innerHTML;
        tab.innerHTML = '';
        if (this.fixedWidth)
            tab.classList.add('fixedWidth');
        tab.draggable = true;
        this.makeDraggable(tab, this.dndReordering);
        app.listen(tab, 'dragstart', function (e) {
            if (!this.parentTabs.dndReordering)
                e.preventDefault();
            this.parentTabs.draggingTab = this;
        }, false);
        app.listen(tab, 'click', function (e) {
            _this.clickTab(this);
        }, false);
        app.listen(tab, 'mousedown', function (e) {
            _this._lastClickedTab = tab;
        }, false);
        app.listen(tab, 'mouseup', function (e) {
            if (tab.isAddNew && e.button === 0) {
                e.stopPropagation();
                return;
            }
            if (e.button == 2 /*right*/ && _this.focusOnRightClick) {
                _this.clickTab(this);
            }
            else if (e.button == 1) {
                if (_this.closeBtnOnHover || tab.closebtn.showIt) // center button - close tab    
                    tab.parentTabs.closeTab(tab);
            }
        }, false);
        // Icon part
        tab.icon = document.createElement('div');
        tab.icon.classList.add('tabsHeaderIcon');
        tab.icon.classList.add('icon');
        tab.appendChild(tab.icon);
        this.setTabIcon(tab, icon);
        // Caption part (i.e. text, or something custom drawn)    
        tab.caption = document.createElement('div');
        tab.caption.classList.add('tabsHeaderCaption');
        tab.caption.innerHTML = inner;
        tab.appendChild(tab.caption);
        //        templates.addEllipsisTooltip(tab.caption, tab);
        tab.tooltipValueCallback = function (tipdiv, vis) {
            if (!vis) {
                return;
            }
            if (tab.caption.clientWidth < tab.caption.scrollWidth) {
                tipdiv.innerHTML = tab.caption.innerHTML;
            }
            else
                tipdiv.innerText = '';
        };
        // Close button
        tab.closebtn = document.createElement('div');
        tab.closebtn.classList.add('tabsHeaderCloseButton');
        tab.closebtn.classList.add('closeButton');
        tab.closebtn.setAttribute('data-icon', 'close');
        tab.closebtn.setAttribute('data-aria-label', 'Close tab');
        this.localListen(tab.closebtn, 'click', function (e) {
            let tab = this.parentNode;
            let tabs = tab.parentTabs;
            if (!tabs.closeBtnOnHover || (tabs.getTabIndex(tab) == tabs.selectedIndex)) {
                e.stopPropagation();
                tabs.closeTab(tab);
            }
        });
        tab.closebtn.showIt = false;
        tab.appendChild(tab.closebtn);
        setVisibility(tab.closebtn, false);
        return tab;
    }
    /**
    This method is called for each newly added panel.

    @method initializePanel
    @param {div} panel Panel to be initialized
    */
    initializePanel(panel) {
        panel.classList.add('tabPanel');
        panel.classList.add('scrollable');
        panel.setAttribute('data-hidebyvisibility', '');
        panel.style.visibility = 'hidden';
        return panel;
    }
    // internal
    setUpTransition(div, attribute) {
        let transitionFinished = function () {
            this.removeAttribute(attribute);
            app.unlisten(this, 'webkitTransitionEnd', transitionFinished);
        }.bind(div);
        if (!div.hasAttribute(attribute)) {
            app.listen(div, 'webkitTransitionEnd', transitionFinished);
            div.setAttribute(attribute, '1');
        }
    }
    // internal
    updateDropEffect(itemIndex) {
        let dropBefore = -1;
        if (itemIndex >= 0) {
            if (itemIndex < this.length)
                dropBefore = itemIndex;
        }
        let dragging = this.draggingTab;
        let draggingIndex = -1;
        for (let i = 0; i < this.items.length; i++)
            if (this.items[i] === dragging) {
                draggingIndex = i;
                break;
            }
        let resetMove = (from, to) => {
            for (let i = from; i < to; i++) {
                let div = this.items[i];
                if (div) {
                    if (div.hasAttribute('data-dropbefore')) {
                        this.setUpTransition(div, 'data-dropeffect');
                        div.removeAttribute('data-dropbefore');
                    }
                }
            }
        };
        resetMove(0, dropBefore);
        this.oldDragIndex = dropBefore;
        if (((dropBefore > draggingIndex - 1) && (dropBefore <= draggingIndex + 1)) || (dropBefore == -1)) {
            resetMove(0, this.items.length);
            return;
        }
        for (let i = dropBefore; i < this.items.length; i++) {
            let div = this.items[i];
            if (div) {
                this.setUpTransition(div, 'data-dropeffect');
                div.setAttribute('data-dropbefore', '1');
            }
        }
    }
    // internal
    dragOver(e) {
        e.preventDefault();
        let totalPos = this.header.getBoundingClientRect();
        let offsetX = e.clientX - totalPos.left;
        let offsetY = e.clientY - totalPos.top;
        this.lastMousePosX = offsetX;
        this.lastMousePosY = offsetY;
        // Show where the drop is going to happen
        this.updateDropEffect(this.getDropTabIndexFromRelativePosition(offsetX, offsetY));
    }
    // internal
    dragLeave(e) {
        e.preventDefault();
        if (!isInElement(e.clientX, e.clientY, this.header)) {
            this.cancelDrop();
        }
    }
    // internal
    canDrop(e) {
        return true;
    }
    // internal
    /** @hidden internal */
    getDropMode(e) {
        return 'move';
    }
    // internal
    drop(e) {
        e.preventDefault();
        this.cancelDrop();
        let totalPos = this.container.getBoundingClientRect();
        let offsetX = e.clientX - totalPos.left;
        let offsetY = e.clientY - totalPos.top;
        this.moveTabTo(this.getTabIndex(this.draggingTab), this.getDropTabIndexFromRelativePosition(offsetX, offsetY));
    }
    // internal
    cancelDrop() {
        this.updateDropEffect(undefined);
    }
    /**
    Moves a tab to a new location.

    @method moveTabTo
    @param {integer} tabIndex Index of the tab that will be moved.
    @param {integer} newIndex Target index - where the tab will be moved.
    */
    moveTabTo(tabIndex, newIndex) {
        let tabs = this.items;
        let panels = this.panels;
        if (newIndex == tabIndex)
            newIndex++;
        let moveTab = tabs[tabIndex];
        let moveBefore = tabs[newIndex];
        moveTab.remove();
        this.header.insertBefore(moveTab, moveBefore);
        let movePanel = panels[tabIndex];
        let moveBefore2 = panels[newIndex];
        movePanel.remove();
        this.panelsContainer.insertBefore(movePanel, moveBefore2);
    }
    setTabPanel(tabID, contentPanel) {
        let _this = this;
        forEach(this.items, function (item, i) {
            if (item.getAttribute('data-id') == tabID) {
                let oldPanel = _this.panels[i];
                _this.panelsContainer.insertBefore(contentPanel, _this.panels[i]);
                _this.initializePanel(contentPanel);
                if (_this.selectedTab == tabID)
                    setVisibility(contentPanel, true);
                removeElement(oldPanel);
            }
        });
    }
    /**
    Array of all tab headers (HTML elements &lt;li&gt;)

    @property items
    @type array
    */
    get items() {
        return filterCondition(qetag(this.header, 'li'), function (item) {
            return !item.invalid;
        });
    }
    /**
    Array of all tab panels (HTML elements &lt;div&gt;), i.e. all the content

    @property panels
    @type array
    */
    get panels() {
        return this.panelsContainer.children;
    }
    /**
    Returns the number of tabs.

    @property length
    @type integer
    */
    get length() {
        return this.items.length;
    }
    /**
    Gets/sets the currently selected tab (by its index).

    @property selectedIndex
    @type integer
    */
    get selectedIndex() {
        let index = -1;
        forEach(this.items, function (item, i) {
            if (item.hasAttribute('data-selected') && !item.isAddNew /* new tab button*/)
                index = i;
        });
        return index;
    }
    set selectedIndex(value) {
        if (!this._getCanBeSelected(value))
            return;
        let oldSelected = this.selectedIndex;
        // Dispatch 'selecting' event
        if (!this.raiseEvent('selecting', {
            tabIndex: value,
            oldTabIndex: oldSelected
        }, true))
            return; // canceled, do not change selection
        forEach(this.items, function (item, i) {
            if (i == value) {
                item.setAttribute('data-selected', 1);
                this.markFocused(i, true);
            }
            else {
                item.removeAttribute('data-selected');
                this.markFocused(i, false);
            }
        }.bind(this));
        forEach(this.panels, function (panel, i) {
            if ((i === oldSelected) && (i !== value))
                setVisibility(panel, false, {
                    animate: true,
                    //                        layoutchange: false, // #18600
                });
            else if (i === value)
                setVisibility(panel, true, {
                    animate: true,
                    //                        layoutchange: false, // #18600  MP: we need layoutchange here, so controls inside panel can react to the change in visibility, e.g. draw contents of grid in tab
                });
        });
        // Dispatch 'selected' event
        this.raiseEvent('selected', {
            tabIndex: value,
            oldTabIndex: oldSelected
        });
        // Dispatch 'change' event
        this.raiseEvent('change', {});
    }
    /**
    Gets/sets the currently selected tab (by its data-id).

    @property selectedTab
    @type string
    */
    get selectedTab() {
        let res = '';
        forEach(this.items, function (item, i) {
            if (item.hasAttribute('data-selected'))
                if (item.hasAttribute('data-id'))
                    res = item.getAttribute('data-id');
        });
        return res;
    }
    set selectedTab(value) {
        let _this = this;
        forEach(this.items, function (item, i) {
            if (item.getAttribute('data-id') == value)
                _this.selectedIndex = i;
        });
    }
    isOneTab() {
        let isOneTab = false;
        if (this.items.length <= 2) {
            let cnt = 0;
            forEach(this.items, function (tab) {
                if (!tab.isAddNew)
                    cnt++;
            });
            isOneTab = (cnt === 1);
        }
        return isOneTab;
    }
    /**
    Recalculates positions of individual sub-controls

    @method render
    */
    render() {
        // Adjust close buttons visibility
        let _this = this;
        let selected = this.selectedIndex;
        let isOneTab = this.isOneTab();
        forEach(this.items, function (tab, index) {
            let closeBtn = tab.closebtn;
            if (_this.closeBtnOnHover && !isOneTab)
                closeBtn.setAttribute('data-showOnHover', '');
            else
                closeBtn.removeAttribute('data-showOnHover');
            let showIt = !isOneTab && closeBtn.showIt;
            if (showIt) {
                if (tab.clientWidth < 80 && selected != index && _this.fixedWidth)
                    showIt = false; // Don't show the close button when there isn't enough place for it or when it is last openned tab
            }
            if (isVisible(closeBtn) != showIt) {
                toggleVisibility(closeBtn);
            }
        });
        if (!this.resizeable) {
            // Make sure that the panel container has the size to fit even the largest panel (don't know a way how to do it automatically, since the panels are absolutely positioned)
            let minHeight = 0;
            let minWidth = 0;
            forEach(this.panels, function (panel) {
                minHeight = Math.max(minHeight, panel.clientHeight);
                minWidth = Math.max(minWidth, panel.clientWidth);
            });
            let update = (this.panelsContainer.clientHeight < minHeight || this.panelsContainer.clientWidth < minWidth);
            this.panelsContainer.style.minHeight = minHeight.toString();
            this.panelsContainer.style.minWidth = minWidth.toString();
            this.oldWidth = this.container.clientWidth;
            this.oldHeight = this.container.clientHeight;
            if (update)
                notifyLayoutChangeUp(this.container); // this is needed e.g. for "Song properties" dialog to be wide enough for the tabs
        }
    }
    /**
    Inserts a new tab at a specified position.

    @method insertTab
    @param {integer} index Index where to insert the new tab
    @param {string} [title] Title of the new tab
    @param {HTMLElement} [contentPanel] The new panel
    @param {string} [icon] Icon name
    @return {HTMLElement} The new tab element (&lt;li&gt;).
    */
    insertTab(index, title, contentPanel, icon) {
        let tab;
        lockedLayout(this.container, function () {
            tab = document.createElement('li');
            this.header.insertBefore(tab, this.items[index]);
            if (icon)
                tab.setAttribute('data-icon', icon);
            this.initializeTab(tab);
            initializeControls(tab);
            this.setTabTitle(tab, title);
            if (contentPanel === undefined)
                contentPanel = document.createElement('div');
            this.panelsContainer.insertBefore(contentPanel, this.panels[index]);
            this.initializePanel(contentPanel);
        }.bind(this));
        // Dispatch 'added' event
        this.raiseEvent('added', {
            tabIndex: index,
        }, true);
        return tab;
    }
    /**
    Adds a new tab to the last position.

    @method addTab
    @param {string} [title] Title of the new tab
    @param {HTMLElement} [contentPanel] The new panel
    @param {string} [icon] Icon name
    @return {HTMLElement} The new tab element (&lt;li&gt;).
    */
    addTab(title, contentPanel, icon) {
        return this.insertTab(this.length, title, contentPanel, icon);
    }
    /**
    Closes given tab.

    @method closeTab
    @param {HTMLElement} tab Tab header element to be closed
    */
    closeTab(tab) {
        let index = this.getTabIndex(tab);
        // Dispatch 'closing' event
        if (!this.raiseEvent('closing', {
            tabIndex: index,
        }, true))
            return; // canceled, do not close the tab
        let sel = this.selectedIndex;
        if (sel == index) {
            if (sel > 0)
                this.selectedIndex = sel - 1;
            else if (sel + 1 < this.length)
                this.selectedIndex = sel + 1;
        }
        tab.invalid = true;
        app.unlisten(tab);
        animTools.animateTabHeaderRemove(tab);
        removeElement(this.panels[index]);
        // Dispatch 'closed' event
        if (!this.raiseEvent('closed', {
            tabIndex: index,
        }, true))
            return; // canceled, do not change selection
    }
    /**
    Shows/hides given tab.

    @method setTabVisibility
    @param {HTMLElement} tab Tab header element to be hidden/shown
    */
    setTabVisibility(tab, value) {
        if (typeof tab == 'string')
            tab = this.getTabByID(tab);
        let index = this.getTabIndex(tab);
        if (!value) {
            // LS: the tab is about to be hidden,
            //     check whether it is not the active tab and move to the next if needed
            let sel = this.selectedIndex;
            if (sel == index) {
                if (sel > 0)
                    this.selectedIndex = sel - 1;
                else if (sel + 1 < this.length)
                    this.selectedIndex = sel + 1;
            }
        }
        tab.hidden = !value;
        setVisibility(tab, value);
    }
    getTabByID(tabID) {
        let tab;
        forEach(this.items, function (item, i) {
            if (item.getAttribute('data-id') == tabID)
                tab = item;
        });
        return tab;
    }
    clearTabs() {
        let _this = this;
        forEach(this.items, function (tab, i) {
            removeElement(tab);
            removeElement(_this.panels[i]);
        });
    }
    /**
    Show/hide close button of a particular tab.

    @method showCloseButton
    @param {integer} index Index of the tab to close. Optionally it could be the tab header element itself.
    @param {boolean} [show=true] Show/hide the close button
    @return {HTMLElement} Tabs element.
    */
    showCloseButton(index, show) {
        if (typeof (index) !== 'number') {
            index = this.getTabIndex(index);
        }
        if (show === undefined)
            show = true;
        // @ts-ignore    
        this.items[index].closebtn.showIt = show;
        this.render();
        return this;
    }
    /**
    Returns whether the tab has a close button.

    @method hasCloseButton
    @param {integer} index Index of the tab. Optionally it could be the tab header element itself.
    @return {boolean} Whether the close button is there and thus the tab is closable.
    */
    hasCloseButton(index) {
        if (typeof (index) !== 'number') {
            index = this.getTabIndex(index);
        }
        // @ts-ignore
        return this.items[index].closebtn.showIt;
    }
    // internal
    getNextTabIndex(currentIndex, backward) {
        let i = currentIndex;
        if (backward) {
            if (--i < 0)
                i = this.length - 1;
        }
        else {
            if (++i >= this.length)
                i = 0;
        }
        return i;
    }
    /**
    Specifies whether all tabs have the same width (given by 'fixedWidth' css class).

    @property fixedWidth
    @type boolean
    */
    get fixedWidth() {
        return this._fixedWidth;
    }
    set fixedWidth(value) {
        this._fixedWidth = value;
        forEach(this.items, function (tab) {
            if (value)
                tab.classList.add('fixedWidth');
            else
                tab.classList.remove('fixedWidth');
        });
    }
}
registerClass(Tabs);
