/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */


registerFileImport('helpers/docking');

/**
@module Docks&Docking
*/

// Helpers for docking system. Docks and dockable planels MUST have their own data-id and
// must be marked as data-dock or data-dockable. As a title (for Options UI) is used data-dock-title
// attribute or data-id (if data-dock-title itn's present) or class name.
// In runtime you can use Control properties isDock, dockable, dockTitle.

(function () {

    const DEFAULT_PANEL_NAME = '_default_';

    var getTabStorage = function (control) {
        return {
            docks: 'docks',
            panels: 'panels'
        };
    }

    var _layoutRestoreProcessing = false;
    var _playbackSafe = false;
    var _currentLayout = null;
    var customDockableControls = [];
    var mainPanel = null;
    var classInfoStorage = []; // store create params in this array
    // will be used later for create panels .. only global panels can be destroyed/created when required

    var getMainTabPanel = function () {
        if (!mainPanel) {
            mainPanel = qe(document.body, '[data-mainPanelSpot]');
        }
        return mainPanel;
    };

    var getMainStorage = function () {
        var main = getMainTabPanel();
        var storage = qe(main, '[data-dock-storage]');
        if (!storage) {
            storage = document.createElement('div');
            storage.setAttribute('data-dock-storage', '');
            storage.style.display = 'none';
            main.appendChild(storage);
        }
        return storage;
    };

    var canBeAdded = function (el) {
        if (el._tabDockParent === undefined) // it's global panel
            return true;
        else
            return (window.currentTabControl && (el._tabDockParent === window.currentTabControl.container));
    };

    var createDockClass = function (className, createParams, title, domElement, uiblock, support) {
        var id = '';
        if (domElement) { // domElement can be element or ID for a possible new element
            if (typeof domElement === 'string') {
                id = domElement;
                domElement = undefined;
            } else if (typeof domElement === 'object') {
                id = domElement.getAttribute('data-id');
            }
        }
        if (!domElement || (domElement && domElement.hasAttribute('data-dockable'))) { // add just panels (not docks)
            if (!classInfoStorage[id]) {
                classInfoStorage[id] = {
                    className: className,
                    createParams: createParams,
                    uiblock: uiblock,
                    title: resolveToValue(title, className),
                    titleLC: (!!title) ? _(title) : className,
                    support: support || '',
                    isGlobal: (!!domElement) ? (domElement._tabDockParent === undefined) : true /* registered panels are always global (not tab related) */
                };
            }
        }

        var retClass = {
            constructor: className,
            params: createParams,
            domElement: domElement,
            uiblock: uiblock,
            title: resolveToValue(title, className),
            titleLC: (!!title) ? _(title) : className,
            objectType: 'dockInfo',
            id: id,
            support: support
        };
        addPanelFunc(retClass);
        return retClass;
    };

    var createDockClassFromElement = function (el) {
        return createDockClass(el.getAttribute('data-control-class'),
            el.getAttribute('data-init-params'),
            el.hasAttribute('data-dock-title') ? el.getAttribute('data-dock-title') : el.getAttribute('data-id'),
            el,
            el.hasAttribute('data-uiblock') ? el.getAttribute('data-uiblock') : '',
            el.hasAttribute('data-dock-support') ? el.getAttribute('data-dock-support') : 'all');
    };

    var getDock = function (id) {
        // first try to find dock in current tab
        var dock = null;
        if (window.currentTabControl && window.currentTabControl.container) {
            dock = qeid(window.currentTabControl.container, id);
        }
        if (!dock) {
            dock = qid(id);
        }
        return dock;
    };

    // Methods cannot be stored in JSON so will add methods manually
    var addPanelFunc = function (dock) {
        if (dock.panels === undefined)
            dock.panels = [];

        dock.addPanel = function (panelID, visible) {
            if (dock.panelAllowed(panelID)) {
                var panel = {
                    id: panelID,
                    visible: resolveToValue(visible, true)
                };
                this.panels.push(panel);
                return panel;
            }
            return null;
        };
        dock.panelExists = function (panelID) {
            for (var i = 0; i < this.panels.length; i++) {
                if (this.panels[i].id === panelID) {
                    return true;
                }
            }
            return false;
        };
        dock.anyPanelVisible = function () {
            for (var i = 0; i < this.panels.length; i++) {
                if (isVisible(qeid(qid(dock.id), this.panels[i].id))) {
                    return true;
                }
            }
            return false;
        };
        dock.containAnyPanel = function () {

            let el = dock.domElement;
            if (window.currentTabControl) {
                let elem = qe(window.currentTabControl.container, '[data-id=' + dock.id + ']');
                if (elem)
                    el = elem;
            }
            if (!el)
                el = qe(document.body, '[data-id=' + dock.id + ']');

            if (el) {             
                var elements = qes(el, '[data-control-class]');
                return elements.length > 0;
            }
            return false;
        };
        dock.isPanelVisible = function (panelID) {
            for (var i = 0; i < this.panels.length; i++) {
                if (this.panels[i].id === panelID) {
                    var dockElem = qid(dock.id);
                    if (dockElem) {
                        var pnlElem = qeid(dockElem, this.panels[i].id);
                        if (pnlElem) {
                            var ret = isVisible(pnlElem);
                            if (!ret && this.panels[i].visible) { //panel is not really visible, but is visible in layout 
                                ret = true;
                            }
                            return ret;
                        }
                    }
                }
            }
            return false;
        };
        dock.containForcedPanel = function () {
            var dockElem = qid(dock.id);
            if (dockElem) {
                for (var i = 0; i < this.panels.length; i++) {
                    var pnlElem = qeid(dockElem, this.panels[i].id);
                    if (pnlElem) {
                        if (pnlElem._forcedVisible)
                            return true;
                    }
                }
            }
            return false;
        };
        dock.isPanelForcedVisible = function (panelID) {
            var dockElem = qid(dock.id);
            if (dockElem) {
                for (var i = 0; i < this.panels.length; i++) {
                    if (this.panels[i].id === panelID) {
                        var pnlElem = qeid(dockElem, this.panels[i].id);
                        if (pnlElem) {
                            return !!pnlElem._forcedVisible;
                        }
                    }
                }
            }
            return false;
        };
        dock.playbackSafe_changePanelVisibility = function (panelID, visible) {
            _playbackSafe = true;
            this.changePanelVisibility(panelID, visible);
            _playbackSafe = false;
        };
        dock.changePanelVisibility = function (panelID, visible) {
            var anyVisible = visible;
            for (var i = 0; i < this.panels.length; i++) {
                if (this.panels[i].id === panelID) {
                    this.panels[i].visible = visible;
                    var elements = qs('[data-id=' + panelID + ']');
                    elements.forEach(function (elem) {
                        elem._manualVisibilityState = visible;
                        var newVisible = visible || (_playbackSafe && !!elem._forcedVisible);
                        setVisibility(elem, newVisible);
                        if (!anyVisible && newVisible)
                            anyVisible = true;
                    })
                }
            }
            if (anyVisible) {
                var elements = qs('[data-id=' + this.id + ']');
                elements.forEach((elem) => {
                    if (elem._manualVisibilityState || elem._manualVisibilityState === undefined)
                        setVisibility(elem, true);
                });
            }
        };
        dock.playbackSafe_changeDockVisibility = function (visible) {
            _playbackSafe = true;
            this.changeDockVisibility(visible);
            _playbackSafe = false;
        };
        dock.changeDockVisibility = function (visible) {
            var containForced = this.containForcedPanel();

            var elements = qs('[data-id=' + this.id + ']');
            elements.forEach(function (elem) {
                elem._manualVisibilityState = visible;
                if (!_playbackSafe || !containForced || visible) {
                    setVisibility(elem, visible);
                }
            });
        };
        dock.panelAllowed = function (panelID) {

            var panel = null;
            if (typeof panelID === 'object')
                panel = panelID;
            else if (typeof panelID === 'string') {
                var panels = window.docking.getDockableControls();
                for (var i = 0; i < panels.length; i++) {
                    if (panels[i].id === panelID) {
                        panel = panels[i];
                        break;
                    }
                }
            }

            if (panel) {
                var supports = panel.support.split(',');
                if (!supports.length)
                    supports.push('all');

                if (supports.indexOf('all') >= 0)
                    return true;

                var dockElem = qid(dock.id);
                if (dockElem) {
                    var dockType = [];
                    if (dockElem.hasAttribute('data-dock-right')) dockType.push('right');
                    if (dockElem.hasAttribute('data-dock-left')) dockType.push('left');
                    if (dockElem.hasAttribute('data-dock-bottom') || dockElem.hasAttribute('data-dock-middle-bottom')) dockType.push('bottom');
                    if (dockElem.hasAttribute('data-dock-top') || dockElem.hasAttribute('data-dock-middle-top')) dockType.push('top');
                    if (!dockType.length)
                        dockType.push('all');

                    // compare dockType and supports
                    for (var i = 0; i < supports.length; i++) {
                        if (dockType.indexOf(supports[i]) >= 0) {
                            return true;
                        }
                    }
                    return false;
                }
            }
            return true;
        };
    }

    var addFunctions = function (layout) {

        // browser docks and add panel funcs
        layout.docks.forEach(function (dock) {
            addPanelFunc(dock);
        });

        layout.addDock = function (dockID) {
            var dock = {
                id: dockID,
                panels: [],
            };
            addPanelFunc(dock);
            this.docks.push(dock);
            return dock;
        };
        layout.getDock = function (dockID, createIfNotExists) {
            for (var i = 0; i < this.docks.length; i++) {
                if (this.docks[i].id === dockID) {
                    return this.docks[i];
                }
            }
            if (createIfNotExists) {
                return this.addDock(dockID);
            }
            return undefined;
        };
        layout.getPanelDock = function (panelID) {
            for (var i = 0; i < this.docks.length; i++) {
                if (this.docks[i].panelExists(panelID)) {
                    return this.docks[i];
                }
            }
            return undefined;
        };
        layout.isPanelVisible = function (panelID) {
            var dock = this.getPanelDock(panelID);
            if (dock) {
                return dock.isPanelVisible(panelID);
            }
            return false;
        };

        layout.setIsPreview = function () {
            this._preview = true;
        };

        layout.toString = function () {
            return this.title();
        };

        layout.isChanged = function (setup) {
            return JSON.stringify(layout) !== JSON.stringify(setup);
        };

        layout.title = function () {
            if (layout.name == DEFAULT_PANEL_NAME)
                return _('Default');
            else
                return layout.name;
        };

        if ((layout.name === 'Default') || (layout.name === _('Default')))
            layout.name = DEFAULT_PANEL_NAME;
    };

    var emptyLayoutClass = function (name, useCurrent) {
        var ret = {
            name: name,
            docks: [],
        };
        addFunctions(ret);

        if (useCurrent) {
            var docks = docking.getAvailableDocks();
            var panels = docking.getDockableControls();

            docks.forEach(function (dock) {
                if (dock.domElement) {
                    var newDock = ret.addDock(dock.domElement.getAttribute('data-id'));
                    panels.forEach(function (panel) {
                        if (panel.domElement && isChildOf(dock.domElement, panel.domElement)) {
                            newDock.addPanel(panel.domElement.getAttribute('data-id'), isVisible(panel.domElement));
                        }
                    });
                }
            });
        }


        return ret;
    };

    /**
    Docks & Docking controls helpers.

    @class window.docking
    */

    if (!isMainWindow) { // we need to always use docking class from main window
        var mainWnd = app.dialogs.getMainWindow();
        window.docking = mainWnd.getValue('docking');
    } else {
        app.listen(window.settings.observer, 'change', function () {
            // check layout was changed
            var current = docking.getCurrentLayout();
            if (current) {
                if (current.isChanged(_currentLayout)) {
                    docking.refreshCurrentLayout();
                }
            }
        });
        window.docking = {

            handleDockVisibility: function (elem, vis) {

                if (vis) {
                    var anyVisible = false;
                    var layout = docking.getCurrentLayout();
                    if (layout) {
                        var dock = layout.getDock(elem.getAttribute('data-id'));
                        if (dock) {
                            for (var i = 0; i < dock.panels.length; i++) {
                                if ((dock.panels[i].visible && !window.fullWindowModeActive) || dock.isPanelForcedVisible(dock.panels[i].id)) { // in full screen mode display only panels forced to be visible, #18861
                                    dock.changePanelVisibility(dock.panels[i].id, true);
                                    anyVisible = true;
                                }
                            }
                        }
                    }

                    // at least one panel need to be visible .. check and make first panel visible (if necessary)
                    var elements = qes(elem, '[data-dockable]');
                    for (var i = 0; i < elements.length; i++) {
                        if (isVisible(elements[i], false /* do not include parents */ )) {
                            anyVisible = true;
                            break;
                        }
                    }
                    if (!anyVisible && elements.length) {
                        toggleVisibility(elements[0]);
                        // update layout as well
                        var id = elements[0].getAttribute('data-id');
                        if (id) {
                            var layout = docking.getCurrentLayout();
                            if (layout) {
                                var dock = layout.getDock('sidebar');
                                if (dock) {
                                    dock.changePanelVisibility(id, true);
                                    docking.storeLayout(layout);
                                }
                            }
                        }
                    }
                }
                
                notifySplitterChange(); // #18821
                setVisibility(elem, vis);
                this.notifyDockStateChange(elem.getAttribute('data-id'), vis);
            },

            getParentPanel: function (el) {
                var p = el;
                while (p && !p.hasAttribute('data-dockable'))
                    p = p.parentElement;
                return p;
            },

            anyPanelVisible: function (dockElement) {
                for (var i = 0; i < dockElement.children.length; i++) {
                    if (isVisible(dockElement.children[i], false)) {
                        return true;
                    }
                };
                return false;
            },

            markAllTabDockablePanels: function (tabElement) {
                var processItems = function (selector) {
                    var items = qes(tabElement, selector);
                    items.forEach(function (el) {
                        el._tabDockParent = tabElement;
                    });
                };
                processItems('[data-dockable]');
                processItems('[data-dock]');
            },

            /**
Get array of docks ready for dock controls. 

@method getAvailableDocks
@return {Array}
*/

            getAvailableDocks: function () {
                var elements = qes(document.body, '[data-dock]');
                var retArray = [];
                elements.forEach(function (el) {
                    if (canBeAdded(el)) {
                        retArray.push(createDockClassFromElement(el));
                    }
                });
                return retArray;
            },

            /**
Get array of dockable controls. 

@method getDockableControls
@return {Array}
*/

            getDockableControls: function () {
                var used = [];
                var elements = qes(document.body, '[data-dockable]');
                var retArray = [];
                elements.forEach(function (el) {
                    if (canBeAdded(el)) {
                        used[el.getAttribute('data-id')] = el;
                        retArray.push(createDockClassFromElement(el));
                    }
                });
                customDockableControls.forEach(function (p) {
                    if (!used[p.id]) {
                        used[p.id] = p;
                        retArray.push(used[p.id]);
                    }
                });

                // add not used elements
                for (var key in classInfoStorage) {
                    if (classInfoStorage[key] && !used[key]) {
                        retArray.push(createDockClass(classInfoStorage[key].className,
                            classInfoStorage[key].createParams,
                            classInfoStorage[key].title, key, '',
                            classInfoStorage[key].support));
                    }
                }
                return retArray;
            },

            getTabControls: function (tab) {
                var retArray = [];
                if (tab && window.mainTabs) {
                    var tabPanel = window.mainTabs.getTabPanel(tab);
                    if (tabPanel) {
                        var tabCtrl = tabPanel.controlClass;
                        var elements = qes(document.body, '[data-dockable]');
                        elements.forEach(function (el) {
                            if (el._tabDockParent === tabCtrl.container) {
                                retArray.push(createDockClassFromElement(el));
                            }
                        });
                    }
                }
                return retArray;
            },

            /**
Register dockable control in runtime (when there's no instance in DOM).

@method registerDockableControl
@param {string} Class of the control
@param {string} Parameters for control creation
@param {string} Title of the control (to show in Options etc.)
@param {string} Future ID of the control panel
@param {string} UIBlock UIBlock string of the panel (optional)
@param {string} dockSupport Info about which docks are supported (can be left, right, top, bottom or combination)
*/

            registerDockableControl: function (controlClass, createParams, title, id, uiblock, dockSupport) {
                customDockableControls.push(createDockClass(controlClass, createParams, title, id, uiblock, dockSupport));
            },

            /**
Get docking panels layout by name.

@method getLayout
@param {string} Layout name
@return {object}
*/

            getLayout: function (name) {
                var names = [name];
                if ((name === 'Default') || (name === _('Default')))
                    names.push(DEFAULT_PANEL_NAME);
                var layouts = this.storedLayouts();
                for (var i = 0; i < layouts.length; i++) {
                    if (names.includes(layouts[i].name))
                        return layouts[i];
                }

                return emptyLayoutClass(name);
            },

            /**
Get current layout preset.

@method getCurrentLayout
@return {object}
*/

            getCurrentLayout: function () {
                if (!window.isTouchMode) {
                    var currentLayoutPreset = app.getValue('currentLayoutPreset', DEFAULT_PANEL_NAME);
                    if (currentLayoutPreset !== '') {
                        return docking.getLayout(currentLayoutPreset);
                    }
                }
                return undefined;
            },

            /**
Store customized layout to data store.

@method storeLayout
@param {object} Layout object
*/

            storeLayout: function (obj) {
                if (!obj) return;

                var layouts = this.storedLayouts();
                var idx = -1;
                for (var i = 0; i < layouts.length; i++) {
                    if (layouts[i].name === obj.name) {
                        idx = i;
                        break;
                    }
                }

                if (idx >= 0)
                    layouts[idx] = obj;
                else
                    layouts.push(obj);

                docking.saveLayouts(layouts);
            },

            /**
Restore customized layout from data store.

@method restoreLayout
@param {string} Layout name or layout preset object
@param {boolean} Ignore all manual changes and reload UI based on preset (false by default)
*/

            restoreLayout: function (nameOrPreset, ignoreManualChanges, oldTab) {
                var _this = this;
                if (window.settings.UI.disableRepositioning || window.isTouchMode)
                    return;

                var layout = null;
                if (ignoreManualChanges === undefined) {
                    ignoreManualChanges = false;
                }
                if (typeof nameOrPreset === 'object') {
                    layout = nameOrPreset;
                } else {
                    layout = this.getLayout(nameOrPreset);
                }

                if (layout && !_layoutRestoreProcessing) {
                    _layoutRestoreProcessing = true;
                    lockedLayout(window, function () {
                        // check layout is not empty
                        if (!layout.docks.length) { // empty docks ? do not restore using this layout (it can remove all panels!)
                            return;
                        }

                        var lastActiveControl = document.activeElement;
                        var isPreview = resolveToValue(layout._preview, false);

                        if (!isPreview) {
                            _currentLayout = layout;
                        }

                        // create/get temporary hidden element (as a storage of non-docked panels)
                        var storage = getMainStorage();

                        // move all panels to storage
                        var panels = this.getDockableControls();

                        // we need to check this layout so every physical docks are defined in layout
                        // if not, panels from new dock(s) can disappear from UI when opening layout settings
                        var add = [];
                        panels.forEach(function (panel) {
                            if (panel.domElement) {
                                var dockID = panel.domElement.parentElement.getAttribute('data-id');
                                if (dockID && !layout.getDock(dockID)) {
                                    add.push(panel);
                                }
                            }
                        });

                        if (add.length) {
                            // now add new docks (and his panels) and save layout
                            add.forEach(function (panel) {
                                if (panel.domElement) {
                                    var dockID = panel.domElement.parentElement.getAttribute('data-id');
                                    var dock = layout.getDock(dockID, true /* create new if not exists */ );
                                    dock.addPanel(panel.domElement.getAttribute('data-id'), isVisible(panel.domElement));
                                }
                            });
                            docking.storeLayout(layout);
                        }

                        // now we can move them to storage (cannot be done in same loop with size getting!)
                        panels.forEach(function (panel) {
                            if (panel.domElement) {
                                panel.domElement.classList.toggle('onlyStaticVisible', false); // reset, not known yet
                                storage.appendChild(panel.domElement);
                                panel.domElement.removeAttribute('data-uiblock'); // remove ui-block to prevent dom created again
                            }
                        });

                        if (oldTab) {
                            // when tab is changed, we need to remove old tab controls and move them to storage (control in tab structure)
                            var ar = _this.getTabControls(oldTab);

                            var tabPanel = window.mainTabs.getTabPanel(oldTab);
                            if (tabPanel) {

                                var par = qe(tabPanel, '[data-dock]');
                                if (!par)
                                    par = tabPanel;

                                ar.forEach(function (panel) {
                                    if (panel.domElement) {
                                        par.appendChild(panel.domElement);
                                    }
                                });
                            }
                        }

                        // reorganize panels to docks
                        if (!isPreview) {
                            app.setValue('currentLayoutPreset', layout.name);
                        }
                        if (layout.docks.length) {
                            layout.docks.forEach(function (dock) {
                                ODS('Docking - handling dock ' + dock.id);
                                var dockElem = getDock(dock.id);
                                if (dockElem) {
                                    var anyVisiblePanel = false;
                                    if (dock.panels && dock.panels.length) {
                                        // remove unused splitters
                                        var splitters = qes(dockElem, '[data-control-class=Splitter]');
                                        // TODO: reuse old splitters
                                        splitters.forEach(function (splitter) {
                                            cleanControlClass(splitter);
                                            splitter.remove();
                                        });

                                        var panelsCount = 0;
                                        var lastPanel;
                                        dock.panels.forEach(function (p) {
                                            ODS('Docking - handling panel ' + p.id);
                                            var panel = qeid(storage, p.id); // get panel from storage only (because of multi-tab environment)
                                            if (!panel) { // not found in panel ... check our class info
                                                if (classInfoStorage[p.id] && classInfoStorage[p.id].isGlobal) {
                                                    panel = document.createElement('div');
                                                    if (classInfoStorage[p.id].uiblock) { // create panel as UIBlock
                                                        panel.setAttribute('data-uiblock', classInfoStorage[p.id].uiblock);
                                                    } else { // create as a control
                                                        panel.setAttribute('data-control-class', classInfoStorage[p.id].className);
                                                        panel.setAttribute('data-init-params', classInfoStorage[p.id].createParams);
                                                        if (dockElem.hasAttribute('data-dock-right')) {
                                                            panel.style.minHeight = '10em';
                                                            panel.style.width = '100%';
                                                        } else {
                                                            panel.style.height = '100%';
                                                            panel.style.minWidth = '10em';
                                                        }
                                                        panel.classList.add('fill');
                                                    }
                                                    panel.setAttribute('data-id', p.id);
                                                    panel.setAttribute('data-dock-title', classInfoStorage[p.id].title);
                                                    panel.setAttribute('data-dock-title-LC', _(classInfoStorage[p.id].titleLC));
                                                    panel.setAttribute('data-dockable', '1');
                                                    panel.setAttribute('data-dock-support', classInfoStorage[p.id].support);

                                                    storage.appendChild(panel);
                                                    processIncludes(storage);
                                                    initializeControls(storage);
                                                    ODS('Docking - created panel ' + p.id);
                                                }
                                            }
                                            if (panel) {
                                                ODS('Docking - setting up panel ' + p.id);
                                                lastPanel = panel;
                                                // check splitter is required
                                                if (panelsCount > 0) {
                                                    var splitter = document.createElement('div');
                                                    splitter.setAttribute('data-control-class', 'Splitter');
                                                    splitter.setAttribute('data-id', 'splitterFor' + p.id);
                                                    dockElem.appendChild(splitter);
                                                }
                                                dockElem.appendChild(panel);
                                                var isForcedVisible = ((isPreview || _playbackSafe) && !!panel._forcedVisible);
                                                var wasVisible = isVisible(panel);
                                                var newVisible = p.visible;
                                                if (!ignoreManualChanges) {
                                                    if (!isPreview && (panel._manualVisibilityState === false)) // manually hidden
                                                        newVisible = false;
                                                } else
                                                    panel._manualVisibilityState = undefined;

                                                newVisible = newVisible || isForcedVisible;

                                                setVisibility(panel, newVisible);

                                                ODS('Docking - setting panel visibility to ' + (newVisible ? 'true' : 'false'));

                                                if (wasVisible != newVisible) { // visibility status was changed
                                                    docking.notifyPanelStateChange(p.id, newVisible);
                                                }
                                                if (newVisible) {
                                                    anyVisiblePanel = true;
                                                }
                                                panelsCount++;
                                            }
                                        });
                                        if ((panelsCount == 1) && lastPanel) {
                                            if ((getComputedStyle(lastPanel).flexGrow === '0') || lastPanel.classList.contains('onlyStaticVisible')) // both needed, #18901
                                                    lastPanel.classList.toggle('onlyStaticVisible', true); // single panel on a dock
                                        }

                                        initializeControls(dockElem);
                                    }
                                    var wasVisible = isVisible(dockElem);
                                    var dockVisible = anyVisiblePanel;
                                    if (!ignoreManualChanges) {
                                        if (dockElem._manualVisibilityState === false)
                                            dockVisible = false;
                                    } else
                                        dockElem._manualVisibilityState = undefined;

                                    setVisibility(dockElem, dockVisible, {
                                        animate: false
                                    });

                                    ODS('Docking - setting dock visibility to ' + (dockVisible ? 'true' : 'false'));

                                    // need to be called always because of autoshow/hide NP list in NP view
                                    docking.notifyDockStateChange(dock.id, dockVisible);
                                }
                            });

                            // remove all other unused global panels
                            var unused = qes(storage, '[data-dockable]');
                            unused.forEach(function (panel) {
                                var id = panel.getAttribute('data-id');
                                if (classInfoStorage[id] && classInfoStorage[id].isGlobal && panel.controlClass) {
                                    cleanControlClass(panel); // cleanup after panel
                                    panel.remove(); // and remove from DOM
                                }
                            });

                            if (lastActiveControl != document.activeElement)
                                lastActiveControl.focus();

                            docking.notifyLayoutPresetChanged(layout.name);
                            notifyLayoutChange(); // needed to correctly update splitters
                        }
                    }.bind(this));
                    _layoutRestoreProcessing = false;
                }
            },



            storeDocksState: function (control) {

                var storage = getTabStorage(control);

                var isNew = (control[storage.docks] === undefined) || (control[storage.docks].length === 0);
                control[storage.docks] = [];
                control[storage.panels] = [];
                var d = docking.getAvailableDocks();
                d.forEach(function (dock) {
                    control[storage.docks].push({
                        id: dock.id,
                        visible: ((dock.domElement) ? isVisible(dock.domElement) : isNew ? true : false),
                    });
                });
                var p = docking.getDockableControls();
                p.forEach(function (panel) {
                    control[storage.panels].push({
                        id: panel.id,
                        visible: ((panel.domElement) ? isVisible(panel.domElement) : isNew ? true : false),
                    });
                });
            },

            restoreDocksState: function (control) {
                if (window.isTouchMode)
                    return;

                var storage = getTabStorage(control);

                lockedLayout(control.container, function () {
                    control[storage.panels] = control[storage.panels] || [];
                    control[storage.panels].forEach(function (panel) {
                        var elem = qe(control.container, '[data-id=' + panel.id + ']');
                        if (!elem) {
                            elem = qe(document.body, '[data-id=' + panel.id + ']');
                        }
                        if (elem) {
                            var wasVisible = isVisible(elem);
                            var vis = panel.visible;
                            elem._manualVisibilityState = vis;
                            setVisibility(elem, vis || !!elem._forcedVisible, {
                                animate: false
                            });
                            if (wasVisible != vis) {
                                docking.notifyPanelStateChange(elem.getAttribute('data-id'), vis);
                            }
                        }
                    });


                    control[storage.docks] = control[storage.docks] || [];
                    control[storage.docks].forEach(function (dock) {
                        var elem = qe(control.container, '[data-id=' + dock.id + ']');
                        if (!elem) {
                            elem = qe(document.body, '[data-id=' + dock.id + ']');
                        }
                        if (elem) {
                            var wasVisible = isVisible(elem);
                            var vis = dock.visible && docking.anyPanelVisible(elem);
                            elem._manualVisibilityState = vis;
                            setVisibility(elem, vis, {
                                animate: false
                            });
                            if (wasVisible != vis) {
                                docking.notifyDockStateChange(elem.getAttribute('data-id'), vis);
                            }
                        }
                    });
                });
            },


            /**
List of stored layouts.

@method storedLayouts
@return {array}
*/

            storedLayouts: function () {
                var layouts = app.getValue('layouts', []);
                if (!layouts.length) {
                    layouts.push(emptyLayoutClass(DEFAULT_PANEL_NAME, true));
                    docking.saveLayouts(layouts);
                }
                layouts.forEach(function (layout) {
                    addFunctions(layout);
                });
                return layouts;
            },

            /**
Save array of layouts to persistent.

@method saveLayouts
@param {array} Array of layouts
*/

            saveLayouts: function (layouts) {
                app.setValue('layouts', layouts);
            },

            /**
Refresh UI using current layout (e.g. after close options).

@method refreshCurrentLayout
*/

            refreshCurrentLayout: function (oldTab) {
                var layout = docking.getCurrentLayout();
                if (layout) {
                    _playbackSafe = true; // set it so video/vis panel will not hide when playback is in progress
                    docking.restoreLayout(layout, undefined, oldTab);
                    _playbackSafe = false;
                    return true;
                }
                return false;
            },

            /**
Notify system about docking panel state (visibility) change.

@method notifyPanelStateChange
*/

            notifyPanelStateChange: function (panelID, state) {
                var event = createNewCustomEvent('panelstate', {
                    cancelable: false,
                    bubbles: true,
                    detail: {
                        panelID: panelID,
                        state: state
                    }
                });
                window.dispatchEvent(event);
            },

            /**
Notify system about dock state (visibility) change.

@method notifyDockStateChange
*/

            notifyDockStateChange: function (dockID, state) {
                var layout = docking.getCurrentLayout();
                if (layout) {
                    var dock = layout.getDock(dockID);
                    if (dock) {
                        dock.panels.forEach(function (panel) {
                            docking.notifyPanelStateChange(panel.id, state);
                        });
                    }
                } else { // no current layout
                    var elements = qes(qid(dockID), '[data-dockable]');
                    elements.forEach(function (el) {
                        docking.notifyPanelStateChange(el.getAttribute('data-id'), state);
                    });
                }
                window.recomputeWindowMinHeight();
            },

            /**
Notify system about new layout was loaded.

@method notifyLayoutPresetChanged
*/

            notifyLayoutPresetChanged: function (name) {
                var event = createNewCustomEvent('dockschanged', {
                    cancelable: false,
                    bubbles: true,
                    detail: {
                        newLayoutName: name,
                    }
                });
                window.dispatchEvent(event);
            }

        };
    }







})();
