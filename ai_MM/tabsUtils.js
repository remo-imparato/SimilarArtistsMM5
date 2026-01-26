/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

registerFileImport('tabsUtils');

(function () {

    function mainTabChange(tab, oldtab) {
        
        let currTabState = undefined;
        if (oldtab) {
            var oldTabPanel = window.mainTabs.getTabPanel(oldtab);
            if (oldTabPanel) {
                if(oldTabPanel.controlClass && oldTabPanel.controlClass.storeSizeState) {
                    currTabState = oldTabPanel.controlClass.storeSizeState(); // left Panel sizes duplicate on the next tab, #18457
                }
                
                if (isChildOf( oldTabPanel, window.lastFocusedControl)) {
                    oldtab.lastFocusedControl = window.lastFocusedControl;
                    window.lastFocusedControl = undefined;
                } else
                    oldtab.lastFocusedControl = undefined;
                                    
                if (isChildOf( oldTabPanel, window._lastFocusedLVControl)) {
                    oldtab._lastFocusedLVControl = window._lastFocusedLVControl;
                    window._lastFocusedLVControl = undefined;
                } else
                    oldtab._lastFocusedLVControl = undefined;
                
                setVisibilityFast(oldTabPanel, false); // fast version because of #17572
            }
            //app.unlisten(oldTabPanel, 'historyupdate'); // this is done automatically via RemoveElement() in MainTabs.prototype.closeTab()            
        }

        var newTabPanel = window.mainTabs.getTabPanel(tab);
        setVisibilityFast(newTabPanel, true); // fast version because of #17572

        window.currentTabControl = newTabPanel.controlClass;

        // notifyLayoutChangeDown(newTabPanel); No longer needed: #18600

        var panelHistoryClass = null;
        if (newTabPanel && newTabPanel.controlClass && newTabPanel.controlClass.history) {
            panelHistoryClass = newTabPanel.controlClass.history;
            forEach(mainNavbars, function (navbar) {
                navbar.controlClass.history = panelHistoryClass;
            });
        }

        var emitMainTabChange = function (viewData) {
            if (oldTabPanel && !oldTabPanel.controlClass)
                oldTabPanel = null; // might be already destroyed by tab close (based on C62E2781, C62EBE52)

            var event = createNewCustomEvent('maintabchange', {
                detail: {
                    oldTabPanel: oldTabPanel,
                    newTabPanel: newTabPanel,
                    newViewData: viewData
                },
                bubbles: true,
                cancelable: true
            });
            document.body.dispatchEvent(event);
        }

        var mainTabChangeEmitted = false;

        var updateTabTitle = function (vD) {
            if (!panelHistoryClass) return;
            whenReady(function () {
                var viewData = vD || panelHistoryClass.getCurrent();
                if (tab && !tab.isAddNew && !tab.invalid) {
                    var caption = tab.caption;
                    if (viewData) {

                        var _setTabTitle = (text) => {
                            if (text && text.trim() != '')
                                window.mainTabs.setTabTitle(tab, text);
                            window.mainTabs.setTabIcon(tab, viewData.icon());
                            if (!mainTabChangeEmitted) {
                                emitMainTabChange(viewData);
                                mainTabChangeEmitted = true;
                            }
                        }

                        var text;
                        var parent = viewData.viewNode.parent;
                        if (parent && parent.handlerID == 'collection')
                            text = nodeUtils.getNodeTitle(parent); // as suggested in #14457
                        else
                            text = nodeUtils.getNodeTitle(viewData.viewNode, false, true);

                        if (isPromise(text)) {
                            window.localPromise(text).then((txt) => {
                                _setTabTitle(txt);
                            });
                        } else {
                            _setTabTitle(text);
                        }

                    }
                }
            });
        };

        var updateStatusBar = function () {
            newTabPanel.controlClass.setStatus(newTabPanel.controlClass.lastStatusMessage);
        };

        newTabPanel.controlClass.loadAsync().then(function () {
            app.listen(newTabPanel, 'historyupdate', function (e) {
                forEach(mainNavbars, function (navbar) {
                    if (navbar && navbar.controlClass) {
                        if (navbar.controlClass.history == e.detail.owner)
                            navbar.controlClass.updateNavigation(e.detail.viewData);
                    }
                });

                var cls = newTabPanel.controlClass;
                var viewData = e.detail.viewData;
                updateTabTitle(viewData);

                cls.dataSourceUnlistenFuncts();
                if (viewData && viewData.viewNode && viewData.viewNode.dataSource && viewData.viewNode.dataSource.isObservable) {
                    cls.dataSourceListen(viewData.viewNode.dataSource, 'change', () => {
                        if (isVisible(newTabPanel))
                            updateTabTitle(viewData); // #16452
                    });
                }
            });
            forEach(mainNavbars, function (navbar) {
                if (navbar && navbar.controlClass) {
                    navbar.controlClass.update();
                }
            });
                        
            // to resolve #19158
            newTabPanel.controlClass.requestTimeout(() => {
                
                let focusControl;
                if (tab.lastFocusedControl && isChildOf( newTabPanel, tab.lastFocusedControl))
                    focusControl = tab.lastFocusedControl;                

                if (tab._lastFocusedLVControl && isChildOf( newTabPanel, tab._lastFocusedLVControl))
                    focusControl = tab._lastFocusedLVControl;
                
                if (!focusControl)
                    focusControl = window.lastFocusedControl;

                if (focusControl) {
                    focusControl.focus();
                    if (focusControl.controlClass && focusControl.controlClass.dataSource && focusControl.controlClass.dataSource.isStatusBarSource)
                        focusControl.controlClass.dataSource.updateStatus(); // #19534
                }

            }, 50);

            //newTabPanel.controlClass.restoreDocksVisibility();
            if(currTabState && newTabPanel.controlClass && newTabPanel.controlClass.restoreSizeState) {
                newTabPanel.controlClass.restoreSizeState(currTabState);
            };
        }.bind(this));
        updateTabTitle();
        updateStatusBar();
    }


    window.tabsUtils = {
        initializeNavbar: function () {
            window.mainNavbars = qes(document, '[data-navigation-bar]');
        },
        initializeTabs: function () {
            var tabs = qid('tabs');
            window.mainTabs = tabs.controlClass;
            
            if (!builtInMenu) {
                tabs.classList.add('windowheader');
            }

            tabs.controlClass.dndReordering = true;

            app.listen(tabs, 'selected', function (e) {
                var oldTab = undefined;
                if (e.detail.oldTabIndex >= 0)
                    oldTab = tabs.controlClass.items[e.detail.oldTabIndex];
                var currtab = tabs.controlClass.items[e.detail.tabIndex];
                if (window.currentTabControl && oldTab) {
                    //window.currentTabControl.storeDocksVisibility();
                    window.currentTabControl._storeSharedHistory();
                }
                if (currtab) {
                    mainTabChange(currtab, oldTab);
                    uitools.getDocking().refreshCurrentLayout(oldTab);
                }
            });
            tabs.controlClass.restoreState();
            uitools.restoreLastFocusedControl();

            if (window.currentTabControl) {
                let mediaTree = qe(window.currentTabControl.container, '[data-id=mediaTree]');
                if (mediaTree && mediaTree.controlClass && isVisible(mediaTree))
                    mediaTree.focus();
                else {
                    let multiView = qe(window.currentTabControl.container, '[data-id=multiview]');
                    if (multiView && multiView.controlClass) {
                        let setOnceLoaded = function () {
                            if (multiView.controlClass.activeView) {
                                let ctrl = multiView.controlClass.getDefaultFocusControl({setFocus: true});
                                return;
                            }
                            setTimeout(setOnceLoaded, 100);
                        }
                        
                        setOnceLoaded();
                    }
                }
            }
        }
    };


})();
