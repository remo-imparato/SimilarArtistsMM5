registerFileImport('controls/deviceConfig');

'use strict';

/**
@module UI
*/

import Control from './control';
import Tabs from './tabs';

requirejs('controls/compositeBarGraph');

/**
UI device configuration element

@class DeviceConfig
@constructor
@extends Control
*/

class DeviceConfig extends Control {
    capacityBar: any;
    spaceFiller: any;
    btnApply: any;
    unsavedChanges: boolean;
    keepInCache: boolean;
    tabLoaded: AnyDict;
    tabNeedsReload: AnyDict;
    private _tabsInitialized: boolean;
    private _viewData: ViewData;
    tabs: AnyDict;
    device: Device;
    tabControl: ElementWith<Tabs>;
    private _reloadingTabs: boolean;
    private _reloadingTab: boolean;
    private _syncedObjects: SharedList<SharedMediaObject>;
    contentSelectionMode: boolean;

    initialize(rootelem, params) {
        super.initialize(rootelem, params);
        this.container.innerHTML = loadFile('file:///controls/deviceConfig.html');
        initializeControls(this.container);

        this.capacityBar = this.qChild('capacityBar');
        this.spaceFiller = this.qChild('spaceFiller');
        this.btnApply = this.qChild('btnApply');
        this.btnApply.controlClass.disabled = true;
        setVisibility(this.btnApply, window.uitools.getCanEdit());
        this.localListen(this.btnApply, 'click', () => {
            this.save();
        });
        this.localListen(this.qChild('btnSync'), 'click', () => {
            if (this.unsavedChanges) {
                this.showChangesConfirm(() => {
                    window.uitools.syncDevice(this.device);
                });
            } else {
                window.uitools.syncDevice(this.device);
            }
        });

        if (params && params.hideButtons)
            setVisibilityFast(this.qChild('bottom'), false);

        this.localListen(thisWindow, 'closequery', (token) => {
            if (this.unsavedChanges) {
                token.asyncResult = true;
                token.waitsUserConfirm();
                this.keepInCache = true; // so that is not used for another dataSource meanwhile (or destroyed)              
                this.showChangesConfirm(() => {
                    token.resolved();
                });
            }
        });

        this.tabLoaded = {};
        this.tabNeedsReload = {};
    }

    showChangesConfirm(callback) {
        let message = sprintf(_('You have changed the settings for %s'), ['\'' + escapeXml(this.dataSource.name) + '\'']) + '. ' + _('Would you like to apply these changes?');
        messageDlg(message, 'Confirmation', ['btnYes', 'btnNo'], {
            defaultButton: 'btnYes'
        }, (result) => {
            if (!this._cleanUpCalled) {
                if (result.btnID === 'btnYes') {
                    this.save().then(() => {
                        callback(result);
                    });
                } else {
                    this.unsavedChanges = false;
                    this.btnApply.controlClass.disabled = true;
                    this.refresh();
                    callback(result);
                }
            } else
                callback(result);
        });
    }

    initTabs() {
        if (!this._tabsInitialized) {
            let devTabs = this.tabs;
            let keys = Object.keys(devTabs);
            for (let i = 0; i < keys.length; i++) {
                let tab = devTabs[keys[i]];
                if (tab.order === undefined)
                    tab.order = 10 * (i + 1);
            }
            keys.sort(function (i1, i2) {
                let retval = devTabs[i1].order - devTabs[i2].order;
                return retval;
            });

            this.tabControl = this.qChild('tabs');
            for (let i = 0; i < keys.length; i++) {
                let key = keys[i];
                let tab = devTabs[key];
                this.tabLoaded[key] = false;
                let t = this.tabControl.controlClass.addTab(tab.name);
                t.setAttribute('data-id', key);
            }
            this.tabControl.controlClass.selectedIndex = 0;

            this.localListen(this.tabControl, 'change', () => {
                if (!this._reloadingTabs) { // when re-loading tabs the 'change' can be unnecessarily raised from tabs.setTabVisibility() -- when current tab index becomes invisible
                    let currentTab = this.tabControl.controlClass.selectedTab;
                    if (currentTab !== '')
                        this.loadTab(currentTab);
                }
            });
            this._tabsInitialized = true;
        }
    }

    _monitorChanges(contentDiv) {
        let list = qes(contentDiv, '[data-control-class]');
        for (let itm of list) {

            let _changeHandler = (e) => {
                if (!this._reloadingTab) {
                    let proceed = true;
                    let item = e.target;
                    while (item) {
                        if (item.hasAttribute('data-no-config-change'))
                            proceed = false;
                        item = window.getParent(item);
                    }
                    if (proceed) {
                        this.unsavedChanges = true;
                        this.btnApply.controlClass.disabled = false;
                    }
                }
            };

            this.dataSourceListen(itm, 'change', _changeHandler);
            this.dataSourceListen(itm, 'checkchange', _changeHandler); // for treeview / checkboxTree
        }
    }

    loadTab(key:string, reload?:boolean) {

        this._reloadingTab = true;

        reload = reload || this.tabNeedsReload[key];
        this.tabNeedsReload[key] = false;

        let tab = this.tabs[key];
        if (tab) {
            let tabContent;
            if (!this.tabLoaded[key] && this.device) {
                // create layout:
                let contentDiv = document.createElement('div');
                contentDiv.innerHTML = window.loadFile('file:///controls/deviceConfig/' + key + '.html');
                requirejs('controls/deviceConfig/' + key + '.js');
                tabContent = contentDiv.firstElementChild;
                tabContent.setAttribute('data-id', 'tab_panel_' + key);
                this.tabControl.controlClass.setTabPanel(key, tabContent);
                initializeControls(tabContent);
            } else {
                tabContent = this.qChild('tab_panel_' + key);
            }

            if ((!this.tabLoaded[key] || reload) && this.device) {
                // load values:
                tab.load.apply(this, [reload && this.tabLoaded[key]]);
                this.tabLoaded[key] = true;
                let h = mediaSyncHandlers[this.device.handlerID];
                if (h.configPage && h.configPage[key])
                    h.configPage[key].load.apply(h, [this.device, this]);
            }
            this._monitorChanges(tabContent);
        } else
            alert('Tab with key ' + key + ' not found!');

        this._reloadingTab = false;
    }

    reloadTabs() {
        this.initTabs();
        let keys = Object.keys(this.tabs);
        this._reloadingTabs = true;
        let visibleTabs = [];
        let tabs = this.tabControl.controlClass;
        for (let i = 0; i < keys.length; i++) {
            let key = keys[i];            
            let h = mediaSyncHandlers[this.device.handlerID];
            let vis;
            if (this.contentSelectionMode) {
                vis = inArray(key, ['syncToDevice']);
            } else {
                vis = (!h.tabVisible || (h.tabVisible && h.tabVisible(key, this.device)));
            }
            tabs.setTabVisibility(key, vis);
            if (vis)
                visibleTabs.push(key);
            if (h.tabName && h.tabName(key, this.device))
                tabs.setTabTitle(key, h.tabName(key, this.device));
            else
                tabs.setTabTitle(key, this.tabs[key].name);

            setVisibility(tabs.header, (visibleTabs.length > 1));

            if ( /*vis && */ this.tabLoaded[key]) {
                // LS: just mark it to re-load as re-loading invisible tabs can result in some unpredicable issues when invisible controls (LVs) are re-loaded
                this.tabNeedsReload[key] = true;
                // this.loadTab(key, true /*reload*/ );            
            }
        }
        assert(visibleTabs.length > 0, 'deviceConfig: no tabs to show!');
        if (!inArray(tabs.selectedTab, visibleTabs))
            tabs.selectedTab = visibleTabs[0];
        this._reloadingTabs = false;
    }

    save() {
        return new Promise<void>((resolve/*, reject*/) => {
            if (this.device) {
                let keys = Object.keys(this.tabs);
                let h = mediaSyncHandlers[this.device.handlerID];
                for (let i = 0; i < keys.length; i++) {
                    let key = keys[i];
                    let tab = this.tabs[key];
                    if (this.tabLoaded[key] && !this.tabNeedsReload[key]) {
                        if (tab.save)
                            tab.save.apply(this);
                        if (h.configPage && h.configPage[key] && h.configPage[key].save)
                            h.configPage[key].save.apply(h, [this.device, this]);
                    }
                }
                //this.device.commitAsync(); // LS: not needed -- it is already part of the modifyCustomSettings below
                mediaSyncDevices.modifyCustomSettings(this.device, {
                    syncNeeded: true
                }).then(resolve);
                this.unsavedChanges = false;
                this.btnApply.controlClass.disabled = true;
            } else {
                resolve();
            }
        });
    }

    storePersistentState() {
        let state : AnyDict = {
            selTabIndex: this.tabControl.controlClass.selectedIndex
        };
        let tab = this.tabs[this.tabControl.controlClass.selectedTab];
        if (tab.storeState)
            state.selTabState = tab.storeState.apply(this);
        return state;
    }

    restorePersistentState(state) {
        if (!state)
            return;
        if (state.selTabIndex)
            this.tabControl.controlClass.selectedIndex = state.selTabIndex;
        if (this.device && !this.device.enabled)
            this.tabControl.controlClass.selectedIndex = 0; // #18620 - item 3

        if (state.selTabState) {
            let tab = this.tabs[this.tabControl.controlClass.selectedTab];
            if (tab.restoreState)
                tab.restoreState.call(this, state.selTabState);
        }
    }

    storeState() {
        return {}; // all is loaded via individial sheets from this.device data source + restorePersistentState above
    }

    cleanUp() {
        let keys = Object.keys(this.tabs);
        for (let i = 0; i < keys.length; i++) {
            let key = keys[i];
            if (this.tabLoaded[key] && this.tabs[key].cleanUp) {
                this.tabs[key].cleanUp.apply(this);
            }
        }
        this.dataSource = null; // to clean up events, calculator etc.
        super.cleanUp();
    }

    setCalculatorValues() {
        let info = this.device.calculator.sizeInfo;
        if (info.capacity > 0) {
            let utils = app.utils;
            let values = [];
            values.push({
                text: _('Audio'),
                hint: _('Audio') + ': ' + info.audioCount + ' ' + _('files') + ', ' + formatFileSize(info.audioSize) + ', ' + utils.songTimeToStr(info.audioLen),
                percent: ((info.audioSize / info.capacity) * 100)
            });
            values.push({
                text: _('Video'),
                hint: _('Video') + ': ' + info.videoCount + ' ' + _('files') + ', ' + formatFileSize(info.videoSize) + ', ' + utils.songTimeToStr(info.videoLen),
                percent: ((info.videoSize / info.capacity) * 100)
            });
            values.push({
                text: _('Other'),
                hint: _('Other') + ': ' + formatFileSize(info.otherSize),
                percent: ((info.otherSize / info.capacity) * 100)
            });
            if (this.device.calculator.calculating) {
                // we are still calculating, let it known in the UI:
                values.push({
                    text: _('Calculating') + '...',
                    percent: ((info.freeSpace / info.capacity) * 100)
                });
            } else {
                values.push({
                    text: _('Free') + ': ' + formatFileSize(info.freeSpace),
                    hint: _('Free') + ': ' + formatFileSize(info.freeSpace),
                    percent: ((info.freeSpace / info.capacity) * 100)
                });
            }
            this.capacityBar.controlClass.values = values;
        }
    }

    _initCalculator() {
        // note that the calculator is needed even if capacity bar is hidden -- it is used also to get "half-checked" state of collection nodes!!
        this.dataSourceListen(this.device.calculator, 'change', this.setCalculatorValues.bind(this)); // this needs to be registered before setPreSelectedItems below 
        this.device.calculator.setPreSelectedItems(this._syncedObjects);
        this.device.scanContent(false /* to be sure that the content was scanned*/ );
    }

    _getSyncedObjects() {
        if (!this._syncedObjects) {
            this._syncedObjects = this.device.getSyncedObjects();
            this.dataSourcePromise(this._syncedObjects.whenLoaded());
            this._initCalculator();
        }
        return this._syncedObjects;
    }

    initCapacityBar() {
        if (this._cleanUpCalled)
            return;
        this.capacityBar.controlClass.animateTransitions = false;
        let info = this.device.calculator.sizeInfo;
        setVisibility(this.capacityBar, info.capacity > 0);
        setVisibility(this.spaceFiller, info.capacity <= 0);
        if (info.capacity > 0)
            this._getSyncedObjects(); // also counts pre-selected items and initiates calculator
    }

    refresh() {
        // eslint-disable-next-line no-self-assign
        this.dataSource = this.dataSource;
    }
    
    get dataSource () {
        return this.device;
    }
    set dataSource (device) {
        if (this.device) {
            this.dataSourceUnlistenFuncts();
            this.cancelDataSourcePromises();
            this.device.calculator.clear();
            this.device.calculator.mode = 'size';
            this._syncedObjects = undefined;
        }

        this.device = device;

        if (this.device) {

            this.reloadTabs(); // set tabs titles and visibility (varies per media sync handler - 'usb' vs 'cloud')
            this.loadTab(this.tabControl.controlClass.selectedTab, true /* reload */ );

            let syncHandler = mediaSyncHandlers[this.device.handlerID];
            let _this = this;
            if (syncHandler.getStorageInfo) {
                this.dataSourcePromise(syncHandler.getStorageInfo(this.device)).then(
                    (info) => {
                        this.dataSourcePromise(this.device.setCapacityAsync(info.spaceTotal.toString(), info.spaceUsed.toString())).then(() => {
                            this.initCapacityBar();
                        });
                    },
                    (err) => {
                        if (!isAbortError(err))
                            this.initCapacityBar();
                    }
                );
            } else {
                this.initCapacityBar();
            }

            let _deviceChangeFunc = function() {
                let btn = _this.qChild('btnSync');
                if (resolveToValue(syncHandler.hideSyncButton))
                    setVisibility(btn, false);
                else
                    setVisibility(btn, syncHandler.syncEnabled(_this.device) && window.uitools.getCanEdit());
                btn.controlClass.disabled = mediaSyncDevices.isSyncInProgress(_this.device);
            };
            _deviceChangeFunc();
            this.dataSourceListen(this.device, 'change', _deviceChangeFunc);
        }
    }
    
    get viewData() : ViewData {
        return this._viewData;
    }
    set viewData (item: ViewData) {
        this._viewData = item; // for the content browser on the 'Summary' page
    }
    
}
registerClass(DeviceConfig);


DeviceConfig.prototype.tabs = {
    summary: {
        name: _('Summary'),
        order: 10
    },
    syncToDevice: {
        name: _('Sync list (Library --> Device)'),
        order: 20
    },
    syncFromDevice: {
        name: _('Sync list (Device --> Library)'),
        order: 30
    },
    options: {
        name: _('Sync profile'),
        order: 40
    },
};
