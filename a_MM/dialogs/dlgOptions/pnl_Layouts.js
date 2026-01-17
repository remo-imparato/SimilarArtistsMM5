/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

requirejs('helpers/docking');
requirejs('helpers/arrayDataSource');
requirejs('controls/dropdown');

let saveCurrentPreset = undefined;
let oldCurrentPreset = undefined;
let _livePreviewCalled = false;

const PRESET_DEFAULT = '_default_',
    PRESET_NEW = '< ' + _('Add new layout') + ' >';

let layoutSortFunc = function (i1, i2) {
    if ((i1.name == PRESET_DEFAULT) || (i2.name == PRESET_NEW)) {
        return -1;
    } else if ((i1.name == PRESET_NEW) || (i2.name == PRESET_DEFAULT)) {
        return 1;
    } else {
        let n1Up = i1.name.toUpperCase();
        let n2Up = i2.name.toUpperCase();
        if (n1Up < n2Up)
            return -1;
        else if (n1Up > n2Up)
            return 1;
        else
            return 0;
    }
};


optionPanels.pnl_Layouts.load = function (sett) {

    let _this = this;

    let docks = docking.getAvailableDocks();
    let panels = docking.getDockableControls();

    let layoutsRoot = qid('pnl_Layouts');
    let blockAvailableDocks = qid('blockAvailableDocks');
    let blockAvailableControls = qid('blockAvailableControls');

    let lvStoredLayouts = qid('lvStoredLayouts');
    let btnLayoutDelete = qid('btnLayoutDelete');

    this._currentLayout = undefined;

    let optionsIcon = '';
    let elementsToAdd = [];

    loadIcon('customize', function (data) {
        if (window._cleanUpCalled)
            return;
        optionsIcon = data;
        elementsToAdd.forEach(function (btn) {
            btn.innerHTML = optionsIcon;
        });
        elementsToAdd = [];
    });

    // prepare UI
    let updateDockVisible = function (dockClass, visible) {
        if (_this._currentLayout) {
            let dock = _this._currentLayout.getDock(dockClass.id);
            if (dock) {
                dock.playbackSafe_changeDockVisibility(visible);
            }
        }
    }

    let createDockControl = function (dockClass, params, parent) { // as a parameter use dockClass from docking array
        let container = document.createElement('div');
        container.classList.add('flex');
        container.classList.add('column');
        container.classList.add('vSeparator');
        container.style.width = '45%';

        let checkLabel = null;

        if (dockClass.title) {
            let isVis = true;
            if (dockClass.domElement) {
                isVis = isVisible(dockClass.domElement) || dockClass.domElement.hasAttribute('data-dock-enabled');
            }
            let label = document.createElement('div');
            label.setAttribute('data-control-class', 'Checkbox');
            label.setAttribute('data-init-params', '{checked: ' + isVis + '}');
            label.innerText = _(dockClass.title);
            label.classList.add('uiRow');
            label.classList.add('labelLeftPadding');
            container.appendChild(label);
            window.localListen(label, 'change', function () {
                updateDockVisible(dockClass, label.controlClass.checked);
            });
            checkLabel = label;
        }

        let lv = document.createElement('div');
        lv.dockInfo = dockClass;
        lv.checkLabel = checkLabel;
        lv.setAttribute('data-control-class', 'GridView');
        if (params) {
            lv.setAttribute('data-init-params', params);
        }
        lv.classList.add('stretchWidth');
        lv.classList.add('border');

        lv.classList.add('fill');
        lv.classList.add('flex');
        lv.classList.add('column');
        lv.classList.add('hSeparatorTiny');

        lv.style.minHeight = '8em';
        container.appendChild(lv);

        parent.appendChild(container);

        return lv;
    };

    let getContextMenu = function (div) {
        if (div) {
            if (div.controlClass && div.controlClass.dockMenuItems)
                if (typeof div.controlClass.dockMenuItems === 'object') {
                    return div.controlClass.dockMenuItems;
                }
            for (let i = 0; i < div.children.length; i++) {
                if (div.children[i] && div.children[i].controlClass && div.children[i].controlClass.dockMenuItems) {
                    if (typeof div.children[i].controlClass.dockMenuItems === 'object') {
                        return div.children[i].controlClass.dockMenuItems;
                    }
                }
            }
        }
        return null;
    };

    // this method is used for preset docks and available panels LVs
    let presetLV = function (LV, useCheckboxes) {
        LV.controlClass.showHeader = false;
        LV.controlClass.isSortable = false;
        LV.controlClass.multiselect = false;
        LV.controlClass.enableDragNDrop();

        let defaultColumns = [];

        if (useCheckboxes) {
            defaultColumns.push({
                visible: true,
                title: '',
                width: 20,
                order: 1,
                isSortable: false,
                headerRenderer: GridView.prototype.headerRenderers.renderCheck,
                setupCell: GridView.prototype.cellSetups.setupCheckbox,
                bindData: GridView.prototype.defaultBinds.bindCheckboxCell
            });
        }

        defaultColumns.push({
            visible: true,
            title: _('Title'),
            width: 480,
            order: 2,
            setupCell: function (div, column) {
                div.classList.add('flex');
                div.classList.add('fill');
                div.classList.add('row');

                div.content = document.createElement('div');
                //div.content.classList.add('fill');
                div.content.classList.add('textEllipsis');
                div.content.parentListView = div.parentListView;
                div.content.style.padding = 'inherit';
                div.appendChild(div.content);

                /*                let btn = document.createElement('div');
                                btn.classList.add('lvInlineIcon');
                                btn.classList.add('alignright');
                                btn.classList.add('clickable');
                                btn.innerHTML = optionsIcon;
                                div.appendChild(btn);

                                if (!optionsIcon)
                                    elementsToAdd.push(btn);

                                div.content.btn = btn;

                                localListen(btn, 'click', function (e) {
                                    let contextMenu = btn.contextMenu;
                                    if (contextMenu) {
                                        if (!isArray(contextMenu)) {
                                            contextMenu = contextMenu.submenu;
                                        }
                                        if (isFunction(contextMenu)) {
                                            contextMenu = contextMenu();
                                        }
                                        let dlg = uitools.openDialog('dlgSimpleMenu', {
                                            modal: true,
                                            title: _('Layout') + ' (' + btn.title + ')',
                                            menuItems: contextMenu
                                        });                        
                                    }
                                });*/

            },
            bindData: function (div, item) {
                if (item) {
                    div.innerText = item.titleLC;
                    /*                    let showMenuButton = false;
                                        if (item.domElement && item.domElement.hasAttribute('data-dock-configurable')) {
                                            let contextMenu = getContextMenu(item.domElement);
                                            div.btn.contextMenu = contextMenu;
                                            div.btn.title = item.title;
                                            showMenuButton = !!contextMenu;
                                        } else
                                            div.btn.contextMenu = null;
                                        if (div.btn)
                                            setVisibility(div.btn, showMenuButton);*/
                }
            }
        });

        LV.controlClass.setColumns(defaultColumns);

        LV.controlClass.getDropMode = function (e) {
            return 'move';
        };

        LV.controlClass.canDrop = function (e) {
            if (dnd.getDropDataType(e) == 'dockInfo') {
                if (useCheckboxes) {
                    let lst = dnd.getDragObject(e, 'dockInfo');
                    if (lst.count) {
                        let allowed = false;
                        lst.locked(function () {
                            let val = lst.getValue(0);
                            if (this.container.dockInfo.panelAllowed)
                                allowed = this.container.dockInfo.panelAllowed(val.id);
                        }.bind(this));
                        return allowed;
                    }
                }
                return true;
            }
            return false;
        };

        LV.controlClass.drop = function (e) {
            let srcCtrl = e.dataTransfer.getSourceControl();
            if (srcCtrl && srcCtrl.controlClass) {
                let data = dnd.getDragObject(e, 'dockInfo');
                if (data.count) {
                    data.locked(function () {
                        srcCtrl.controlClass.dataSource.locked(function () {
                            this.dataSource.locked(function () {
                                let item = data.getValue(0);
                                let dropidx = this.getDropIndex(e);
                                srcCtrl.controlClass.dataSource.remove(item);
                                this.dataSource.clearSelection();
                                this.dataSource.insert(dropidx, item);
                                this.dataSource.setChecked(dropidx, true);
                                // check dock is enabled
                                if (LV.dockInfo && LV.checkLabel) {
                                    LV.checkLabel.controlClass.checked = true;
                                    updateDockVisible(LV.dockInfo, LV.checkLabel.controlClass.checked);
                                } else {
                                    // check we're moving Preview panel to 'Available panels' while video/YT playback is running
                                    if (app.player.isPlaying || app.player.paused) {
                                        let track = app.player.getCurrentTrack();
                                        if (track.isVideo || _utils.isOnlineTrack(track)) {
                                            let lst = dnd.getDragObject(e, 'dockInfo');
                                            if (lst.count) {
                                                lst.locked(function () {
                                                    let val = lst.getValue(0);
                                                    if (val.domElement) {
                                                        let el = qe(val.domElement, '[data-videoWindowed]');
                                                        if (el) {
                                                            app.player.stopAsync().then1(() => {
                                                                requestFrame(() => {
                                                                    callLivePreview();
                                                                }, 'livepreview');
                                                            });
                                                            return;
                                                        }
                                                    }
                                                }.bind(this));
                                            }
                                        }
                                    }
                                }
                                callLivePreview();
                            }.bind(this));
                        }.bind(this));
                    }.bind(this));
                }
            }
        };

        LV.controlClass.localListen(LV, 'checkedchanged', function () {
            callLivePreview();
        });
    };

    // sort docks
    docks.sort(function (a, b) {
        if (a.domElement.hasAttribute('data-dock-top') || b.domElement.hasAttribute('data-dock-bottom'))
            return -1;
        else if (b.domElement.hasAttribute('data-dock-top') || a.domElement.hasAttribute('data-dock-bottom'))
            return 1;
        else if (a.domElement.hasAttribute('data-dock-left'))
            return -1;
        else if (b.domElement.hasAttribute('data-dock-left'))
            return 1;
        else if (a.domElement.hasAttribute('data-dock-right'))
            return 1;
        else if (b.domElement.hasAttribute('data-dock-right'))
            return -1;
        else if (a.domElement.hasAttribute('data-dock-middle-top') || b.domElement.hasAttribute('data-dock-middle-bottom'))
            return -1;
        else if (b.domElement.hasAttribute('data-dock-middle-top') || a.domElement.hasAttribute('data-dock-middle-bottom'))
            return 1;
        else
            return a.domElement.getAttribute('data-dock-title-LC') - b.domElement.getAttribute('data-dock-title-LC');

    });

    let dockLVs = [];
    docks.forEach(function (dock) {
        dockLVs.push(createDockControl(dock, '{checkbox: true}', blockAvailableDocks));
    });

    let availLV = createDockControl({}, undefined, blockAvailableControls);

    initializeControls(layoutsRoot);

    // use current panels settings
    dockLVs.forEach(function (lv) {
        presetLV(lv, true);
        let ds = new ArrayDataSource([]);
        lv.controlClass.dataSource = ds;
        if (lv.dockInfo.domElement) {
            for (let i = panels.length - 1; i >= 0; i--) {
                let info = panels[i];
                if (info.domElement) {
                    if (isChildOf(lv.dockInfo.domElement, info.domElement)) {
                        ds.insert(0, info);
                        ds.setChecked(0, true);
                        panels.splice(i, 1);
                    }
                }
            }
        }
    });

    availLV.controlClass.dataSource = new ArrayDataSource(panels, {isLoaded: true});
    presetLV(availLV, false);

    let callLivePreview = function () {       
        let newLayout = docking.getLayout(_('Preview'));
        storeSettingsToLayout(newLayout);
        newLayout.setIsPreview();
        docking.restoreLayout(newLayout);
        _livePreviewCalled = true;
    };

    // this method will remove all panels from docks
    let layoutReset = function () {
        dockLVs.forEach(function (lv) {
            availLV.controlClass.dataSource.addList(lv.controlClass.dataSource);
            lv.controlClass.dataSource.clear();
        });
    };

    // load panels layout (in editor only) .. use docking.restoreLayout to apply layout into main window
    let loadLayout = function (layout) {        
        if (!layout || (_this._currentLayout === layout)) return;
        _this._currentLayout = layout;
        //console.log('new focused layout '+layout.name);
        layoutReset();
        let availDS = availLV.controlClass.dataSource;
        dockLVs.forEach(function (lv) {
            let dockDS = lv.controlClass.dataSource;
            if (lv.dockInfo.domElement) {
                let dockID = lv.dockInfo.domElement.getAttribute('data-id');
                for (let i = 0; i < layout.docks.length; i++) {
                    if (layout.docks[i].id === dockID) { // dock found
                        layout.docks[i].panels.forEach(function (panel) {
                            availDS.locked(function () {
                                for (let j = 0; j < availDS.count; j++) {
                                    let item = availDS.getValue(j);
                                    let el = item.domElement;
                                    // do not forget item have domElement only when created and is in storage (!), 
                                    // but we support dynamic panels as well and they have item.id defined
                                    let id = '';
                                    if (el) {
                                        id = el.getAttribute('data-id');
                                    } else {
                                        id = item.id;
                                    }

                                    if (id === panel.id) { // panel found
                                        availDS.delete(j);
                                        dockDS.add(item);
                                        dockDS.setChecked(dockDS.count - 1, panel.visible);
                                        break;
                                    }
                                }
                            })
                        });

                        break;
                    }
                }
            }
        });        
        // callLivePreview(); // LS: commented out because of #20164
    };

    // save current panels layout to preset
    let storeSettingsToLayout = function (layout) {
        let changeCurrent = oldCurrentPreset === layout;
        //console.log('save settings to '+layout.name+' index '+storedDS.focusedIndex);
        layout.docks.length = 0;
        dockLVs.forEach(function (lv) {
            if (lv.dockInfo.domElement) {
                let dock = layout.addDock(lv.dockInfo.domElement.getAttribute('data-id'));
                lv.controlClass.dataSource.locked(function () {
                    for (let i = 0; i < lv.controlClass.dataSource.count; i++) {
                        let panel = lv.controlClass.dataSource.getValue(i);
                        let id = '';
                        if (panel.domElement) // static panels
                            id = panel.domElement.getAttribute('data-id');
                        if (id === '') // dynamic panels
                            id = panel.id;

                        if (id !== '') {
                            dock.addPanel(id, lv.controlClass.dataSource.isChecked(i));
                            if (changeCurrent)
                                dock.playbackSafe_changePanelVisibility(id, lv.controlClass.dataSource.isChecked(i));
                        }
                    }
                });
            }
        });
        return layout;
    };

    saveCurrentPreset = function () {
        if (_this._currentLayout) {
            storeSettingsToLayout(_this._currentLayout);
        }
    };

    let storedLayouts = docking.storedLayouts();
    let newLayout = docking.getLayout(PRESET_NEW);
    storedLayouts.push(newLayout);

    let storedDS = new ArrayDataSource(storedLayouts, {isLoaded: true});
    let resort = function () {
        storedDS.customSort(layoutSortFunc);

        if (_this._currentLayout) {
            let currentLayoutPreset = _this._currentLayout.name;
            storedDS.locked(function () {
                for (let i = 0; i < storedDS.count; i++) {
                    let preset = storedDS.getValue(i);
                    if (((currentLayoutPreset !== '') && (preset.name === currentLayoutPreset)) || // current preset 
                        (currentLayoutPreset === '')) { // or default
                        storedDS.focusedIndex = i;
                        break;
                    }
                }
            });
        }
    };
    resort();

    lvStoredLayouts.controlClass.dataSource = storedDS;

    let addNewLayout = function () {
        storedDS.dontNotify = true; // to prevent focuschange call when we move to new preset and start editing

        // if any preset is selected, save it (before change to new)
        if(saveCurrentPreset)
            saveCurrentPreset();

        let newLayout = docking.getLayout(_('New layout name'));
        // add current layout to new
        storeSettingsToLayout(newLayout);

        storedDS.insert(storedDS.count - 1, newLayout);
        storedDS.clearSelection();
        storedDS.setSelected(storedDS.count - 2, true);
        storedDS.focusedIndex = storedDS.count - 2;
        lvStoredLayouts.controlClass.readOnly = false;
        btnLayoutDelete.controlClass.disabled = false;

        lvStoredLayouts.controlClass.value = resolveToValue(newLayout.title, '');
        lvStoredLayouts.controlClass.focus();
        lvStoredLayouts.controlClass.selectText();
        storedDS.dontNotify = false;
        _this._currentLayout = newLayout;
    };

    lvStoredLayouts.controlClass.localListen(lvStoredLayouts, 'change', function () {
        storedDS.locked(function () { // focusedItem must be used here because this event is called before new itemIndex is set
            let item = storedDS.focusedItem;
            if (!item && _this._currentLayout) { // focusedIndex is -1 .. use current layout
                item = _this._currentLayout;
            }
            if (item && (item.name !== PRESET_DEFAULT)) {
                item.name = lvStoredLayouts.controlClass.value;
            }
        });
    });

    btnLayoutDelete.controlClass.localListen(btnLayoutDelete, 'click', function () {
        if (btnLayoutDelete.controlClass.disabled)
            return;
        if (storedDS.focusedItem === oldCurrentPreset) {
            // current preset deleted
            oldCurrentPreset = undefined;
        }
        let oldIdx = storedDS.focusedIndex;
        storedDS.delete(storedDS.focusedIndex);
        storedDS.focusedIndex = -1;
        storedDS.focusedIndex = Math.max(0, oldIdx - 1);
        lvStoredLayouts.controlClass.value = storedDS.focusedItem.toString();
    });

    window.localListen(storedDS, 'focuschange', function (event) {
        if (storedDS.focusedIndex >= 0) {
            let cannotBeEdited = (storedDS.focusedIndex == 0) || (storedDS.focusedIndex == storedDS.count - 1);
            lvStoredLayouts.controlClass.readOnly = cannotBeEdited;
            btnLayoutDelete.controlClass.disabled = cannotBeEdited;

            if (storedDS.focusedIndex == storedDS.count - 1) {
                closeDropdownPopup(lvStoredLayouts.controlClass);
                // closeDropdownPopup call need to be called otherwise selectText does not work correctly 
                // (because when it overwrites text when closes so selection is gone).
                addNewLayout();
            } else {
                if (!_this._currentLayout || (_this._currentLayout != storedDS.focusedItem)) { // ignore same preset
                    //console.log('new focused index '+storedDS.focusedIndex);
                    // save previous preset
                    if(saveCurrentPreset)
                        saveCurrentPreset();
                    loadLayout(storedDS.focusedItem);
                }
            }
        }
    });

    // get index of current layout preset (to be set)
    let currentLayoutPreset = app.getValue('currentLayoutPreset', '');
    let ds = lvStoredLayouts.controlClass.dataSource;
    ds.locked(function () {
        for (let i = 0; i < ds.count; i++) {
            let preset = ds.getValue(i);
            if (((currentLayoutPreset !== '') && (preset.name === currentLayoutPreset)) || // current preset 
                (currentLayoutPreset === '')) { // or default
                oldCurrentPreset = preset;
                ds.focusedIndex = i;
                //loadLayout(preset);
                break;
            }
        }
    });

}

optionPanels.pnl_Layouts.save = function (sett) {
    if(saveCurrentPreset)
        saveCurrentPreset();
    let lvStoredLayouts = qid('lvStoredLayouts');
    let ds = lvStoredLayouts.controlClass.dataSource;
    if (!ds)
        return;
    // delete last 'add new' item
    ds.delete(ds.count - 1);
    let newLayout = ds.focusedItem;
    ds.customSort(layoutSortFunc);
    docking.saveLayouts(ds.array);
    if (newLayout) {
        app.setValue('currentLayoutPreset', newLayout.name);
    } else {
        app.setValue('currentLayoutPreset', PRESET_DEFAULT);
    }
    lvStoredLayouts.controlClass.dataSource = undefined;
}

optionPanels.pnl_Layouts.cancel = function (sett) {
    if (_livePreviewCalled) // #20164
        docking.refreshCurrentLayout(); // we need to restore current layout when canceling options
}

optionPanels.pnl_Library.beforeWindowCleanup = function () {
    saveCurrentPreset = undefined;
    oldCurrentPreset = undefined;
}