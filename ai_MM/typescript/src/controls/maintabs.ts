registerFileImport('controls/mainTabs');

'use strict';

export interface MainTabElement extends TabElement {
    _iconName: string;
}

/**
@module UI
*/

import Tabs, { TabElement } from './tabs';

/**
UI Main Tabs element

@class MainTabs
@constructor
@extends Tabs
*/
class MainTabs extends Tabs {
    private _onAddClosedTab: any;
    getDropTab: (e: any) => any;
    hideElement: any;
    _newTabButton: any;
    private _initializing: boolean;
    private _lastDragOverX: number;
    private _lastDragOverY: number;
    getCurrentTabNodeInfo: (e: any) => {
        handler: any; dataSource: any;
    };    

    initialize(elem, params) {
        super.initialize(elem, params);
        let _this = this;
        this.resizable = true; // Optimization: it doesn't care about panels size then
        this.hideElement = undefined;
        this.focusOnRightClick = false; // #20516
        this.canBeUsedAsSource = false; // #21443
        this.disableArrowsNavigation = true; // #21610

        // LS: close on hover disabled until it is fixed
        //     1) it is not working when hovering over inactive tab
        //     2) it does not work either for the active tab (until user hovers the tiny space where the close bshould be situated)
        //this.closeBtnOnHover = true;

        this.enableDragNDrop();

        this.contextMenu = new Menu([
            {
                title: _('Close tab'),
                icon: 'close',
                execute: function () {
                    if (_this._lastClickedTab)
                        _this.closeTab(_this._lastClickedTab);
                    else
                        _this.closeCurrentTab();
                },
                disabled: function () {
                    return _this.isOneTab() || window.settings.UI.disableRepositioning;
                }
            }, {
                title: _('Close other tabs'),
                icon: 'close',
                execute: function () {
                    let fromIndex = _this.selectedIndex;
                    if (_this._lastClickedTab)
                        fromIndex = _this._lastClickedTab.parentTabs.getTabIndex(_this._lastClickedTab);

                    for (let i = fromIndex - 1; i >= 0; i--)
                        _this.closeTab(_this.items[i]);

                    fromIndex = _this.selectedIndex;
                    if (_this._lastClickedTab)
                        fromIndex = _this._lastClickedTab.parentTabs.getTabIndex(_this._lastClickedTab);    
                    for (let i = _this.length - 2; i > fromIndex; i--)
                        _this.closeTab(_this.items[i]);
                },
                disabled: function () {
                    return _this.isOneTab() || window.settings.UI.disableRepositioning;
                }
            }, {
                title: _('Close tabs to the right'),
                icon: 'close',
                execute: function () {
                    let fromIndex = _this.selectedIndex;
                    if (_this._lastClickedTab)
                        fromIndex = _this._lastClickedTab.parentTabs.getTabIndex(_this._lastClickedTab);

                    for (let i = _this.length - 2; i > fromIndex; i--)
                        _this.closeTab(_this.items[i]);
                },
                disabled: function () {
                    let fromIndex = _this.selectedIndex;
                    if (_this._lastClickedTab)
                        fromIndex = _this._lastClickedTab.parentTabs.getTabIndex(_this._lastClickedTab);
                    return _this.isOneTab() || (fromIndex === _this.length - 2) || window.settings.UI.disableRepositioning;
                }
            }
        ]);

        this._onAddClosedTab = function (e) {
            whenReady(function () {
                let showTabs = true; //this.length > 2;
                if (this.hideElement) {
                    setVisibility(qid(this.hideElement), showTabs);
                } else {
                    setVisibility(this.container, showTabs);
                }
                if (window.maintoolbar) {
                    if (!showTabs)
                        window.maintoolbar.showActions([actions.newTab]);
                    else
                        window.maintoolbar.hideActions([actions.newTab]);
                }
            }.bind(this));
        }.bind(this);

        this.localListen(this, 'newtab', () => {
            this.addNewTab();
        });
        this.localListen(this, 'closed', this._onAddClosedTab);
        this.localListen(this, 'added', this._onAddClosedTab);
        this.localListen(this.container, 'contextmenu', this._contextMenuHandler);
        this.localListen(window.settings.observer, 'change', () => {
            setVisibility(this._newTabButton, !window.settings.UI.disableRepositioning);            
            if (this.items.length > 1) {
                forEach(this.items, (tab) => {
                    if (!tab.isAddNew)
                        this.showCloseButton(tab, !window.settings.UI.disableRepositioning);
                });
            }
        });

        this.getDropTab = function (e) {
            let totalPos = this.container.getBoundingClientRect();
            let offsetX = e.clientX - totalPos.left;
            let offsetY = e.clientY - totalPos.top;

            let tabIndex = this.getDropTabIndexFromRelativePosition(offsetX, offsetY);
            if (tabIndex == this.length)
                return null; // cannot drop to 'add new'
            let tab = this.items[tabIndex];
            let tabPanel = tab.getAttribute('tabname');
            let tabPanelElement = qid(tabPanel);
            return tabPanelElement;
        };

        this.getCurrentTabNodeInfo = function (e) {
            let tabPanel = this.getDropTab(e);
            if (tabPanel && tabPanel.controlClass && tabPanel.controlClass.multiviewControl.activeView) {
                return {
                    handler: tabPanel.controlClass.multiviewControl.activeView.nodehandler,
                    dataSource: tabPanel.controlClass.multiviewControl.activeView.viewNode.dataSource
                };
            }
            return {
                handler: null,
                dataSource: null
            };
        };

        // set passed attributes
        for (let key in params) {
            this[key] = params[key];
        }

        this.addNewTabButton();

        // hide main tabs by default
        let el = this.container;
        if (this.hideElement) {
            el = qid(this.hideElement);
        }

        setVisibility(el, false, {
            animate: false
        });

        // LS: later restoreState() is called via window.tabsUtils.initializeTabs()
    }

    isOneTab() {
        let ret = super.isOneTab();
        if (!this.container.previousElementSibling && !this.container.nextElementSibling && (app.utils.system() == 'macos')) { // main tabs is the only control on same row ... hide when single tab is opened
            setVisibility(this.container, !ret);
        }
        return ret;
    }
    
    _addNewTabFunc(title: string, canClose: boolean, emptyClass: boolean, icon: string, dontRestoreNavHistory?:boolean) {
        let tab = this.addTab(title, undefined, icon);
        let panelSpot = q('[data-mainPanelSpot]');
        let panel = document.createElement('div');
        panel.classList.add('fill');
        panel.classList.add('animate');
        panel.setAttribute('data-id', 'tab' + Date.now());
        panelSpot.appendChild(panel); // must be before panel initialize, so that style is correctly computed (e.g. for animated visibility)
        if (!emptyClass) {
            panel.setAttribute('data-control-class', 'MainTabContent');
            panel.setAttribute('data-is-tab-panel', 'true');
            panel.setAttribute('data-init-params', '{withoutRestore: ' + (dontRestoreNavHistory ? 'true' : 'false') + '}');
            initializeControl(panel);
        }
        tab.setAttribute('tabname', panel.getAttribute('data-id'));
        this.showCloseButton(this.getTabIndex(tab), canClose);
        this.render();
        return tab;
    }

    getTabPanel(tab) {
        return qid(tab.getAttribute('tabname'));
    }

    addNewTabButton() {
        this._initializing = true;

        this._newTabButton = this._addNewTabFunc('', false, true, 'add');
        this._newTabButton.isAddNew = true;
        this._newTabButton.classList.add('newTabButton');
        this._newTabButton.tabIndex = 0;
        let _this = this;
        app.listen(this._newTabButton, 'keydown', function (e) {
            if(friendlyKeyName(e) === 'Enter') {
                e.stopPropagation();
                _this.clickTab(this);
            }
        });
        this._initializing = false;
    }

    addNewTab(dontRestoreNavHistory?:boolean) {
        // open new tab
        let newTab = this._addNewTabFunc('', true, false, undefined, dontRestoreNavHistory);

        // following to resolve #18437: Left Panel width not duplicated on new tab:
        let currTabState = undefined;
        let currTab = this.items[this.selectedIndex];
        if (currTab) {
            let currPanel = this.getTabPanel(currTab);
            currTabState = currPanel.controlClass.storeState(true, true);
        }

        this.selectedIndex = this.getTabIndex(newTab);
        let newPanel = this.getTabPanel(newTab);
        if (currTabState)
            newPanel.controlClass.restoreState(currTabState, true);
        return newPanel.controlClass.loadingPromise;
    }

    cleanUp() {
        super.cleanUp();
    }

    addTab(title, contentPanel, icon) {
        let newIndex = this._initializing ? this.length : (this.length - 1);
        if (newIndex < 0)
            newIndex = 0;
        return this.insertTab(newIndex, title, contentPanel, icon);
    }

    handle_keydown(e) {
        let key = friendlyKeyName(e);
        if (!(key == 'F4' && e.ctrlKey && this.items.length <= 2)) // LS: to prevent from closing/re-open of the last active tab when Ctrl+F4 is pressed
            super.handle_keydown(e);
    }

    closeTab(tab) {
        if (this.length <= 2) // do not allow close if we have last tab
            return;
        let panel = qid(tab.getAttribute('tabname'));
        requestIdleCallback(function () { // No rush with panel removal
            removeElement(panel);
        });
        super.closeTab(tab);
    }

    storeState() {
        let state : AnyDict = {};
        state.selectedIndex = this.selectedIndex;
        state.tabs = [];
        for (let i = 0; i < this.items.length; i++) {
            let tab = this.items[i] as MainTabElement;
            if (!tab.invalid && !tab.isAddNew) {
                let panel = qid(tab.getAttribute('tabname'));
                let tabstate : AnyDict = {};
                let ttl = tab.caption.innerHTML;
                if(isOurHTML(ttl)) 
                    tabstate.title = ttl;
                else
                    tabstate.title = tab.caption.innerText;
                tabstate.icon = tab._iconName;
                tabstate.state = panel.controlClass.storeState(true, i == state.selectedIndex /*current tab*/ );
                state.tabs.push(tabstate);
            }
        }
        app.setValue(window.uitools.getCurrentLayout().name + '_maintabs', state); // store individually, some skins (like Golden) has maintabs placed elsewhere 
        return {};
    }

    restoreState() {
        let state = app.getValue(window.uitools.getCurrentLayout().name + '_maintabs', {}); // restore individually, some skins (like Golden) has maintabs placed elsewhere
        if (state.tabs) {
            let tabsToRemove = [];
            for (let i = 0; i < this.items.length; i++) {
                if (!(this.items[i] as MainTabElement).isAddNew)
                    tabsToRemove.push(this.items[i]);
            }
            for (let i = 0; i < state.tabs.length; i++) {
                let iTab = state.tabs[i];
                let tab = this._addNewTabFunc(iTab.title, true, false, '');
                let panel = qid(tab.getAttribute('tabname'));
                if (i == state.selectedIndex) {
                    window.currentTabControl = panel.controlClass;
                    uitools.getDocking().refreshCurrentLayout();
                }
                setVisibility(panel, false);
                panel.controlClass.restoreState(iTab.state, i == state.selectedIndex /*current tab*/ );
                this.setTabTitle(tab, iTab.title);
                if (iTab.icon)
                    this.setTabIcon(tab, iTab.icon);
            }
            this.selectedIndex = state.selectedIndex + tabsToRemove.length;

            for (let i = 0; i < tabsToRemove.length; i++) {
                this.closeTab(tabsToRemove[i]);
            }
        } else {
            this.addNewTab(); // add first default tab
        }
    }

    setTabTitle(tab, title) {
        super.setTabTitle(tab, title);
        if (headerClass) {
            headerClass.refreshMoveableRegion();
        }
    }

    getDropMode(e) {
        let info = this.getCurrentTabNodeInfo(e);
        if (info.handler) {
            if (info.handler.getDropMode) {
                return info.handler.getDropMode(info.dataSource, e);
            } else {
                return 'copy';
            }
        }
        return 'none';
    }

    canDrop(e) {
        if (!dnd.isSameControl(e) && (dnd.getDropDataType(e) != '')) {
            if (!e.preventDefault) // LS: Don't know how this could happen, but it happened in #20252
                return false;
            e.preventDefault();
            let info = this.getCurrentTabNodeInfo(e);
            if (info.handler) {
                if (info.handler.canDrop && info.handler.drop) {
                    return info.handler.canDrop(info.dataSource, e);
                }
            }
            return true; // to activate the tab at first (#16954)
        } else {
            return super.canDrop(e);
        }
    }

    dragOver(e) {
        if (!dnd.isSameControl(e) && (dnd.getDropDataType(e) != '')) {

            let totalPos = this.container.getBoundingClientRect();
            let offsetX = e.clientX - totalPos.left;
            let offsetY = e.clientY - totalPos.top;

            if (this._lastDragOverX != offsetX || this._lastDragOverY != offsetY) {
                let tabIndex = this.getDropTabIndexFromRelativePosition(offsetX, offsetY);
                this.requestTimeout(() => {
                    if (this._lastDragOverX == offsetX && this._lastDragOverY == offsetY) {
                        // mouse cursor position not changed for 200 ms, switch to that tab (like in Chrome)
                        if (tabIndex >= 0 && tabIndex < this.length && this.selectedIndex != tabIndex) {
                            if (this._getCanBeSelected(tabIndex))
                                this.selectedIndex = tabIndex;
                        }
                    }
                }, 200, '_tabHeaderGragOverTm');

                this._lastDragOverX = offsetX;
                this._lastDragOverY = offsetY;
            }

        } else {
            super.dragOver(e);
        }
    }

    drop(e) {
        if (!dnd.isSameControl(e) && (dnd.getDropDataType(e) != '')) {
            e.preventDefault();
            let info = this.getCurrentTabNodeInfo(e);
            if (info.handler) {
                if (info.handler.drop) {
                    return info.handler.drop(info.dataSource, e);
                }
            }
        } else {
            super.drop(e);
        }
    }

    getNextTabIndex(currentIndex, backward) {
        let i = currentIndex;
        if (backward) {
            if (--i < 0)
                i = this.length - 2;
        } else {
            if (++i >= this.length - 1)
                i = 0;
        }
        return i;
    }

}
registerClass(MainTabs);
