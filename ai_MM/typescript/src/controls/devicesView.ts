
registerFileImport('controls/devicesView');

'use strict';

/**
@module UI
*/

import Control from './control';
import DeviceListView from './deviceListView';
import Dropdown from './dropdown';
//requirejs('controls/control');

/**
List of external devices/storages

@class DevicesView
@constructor
@extends Control
*/

class DevicesView extends Control {
    UI: { [key: string]: HTMLElement; };
    private _showAllDevices: boolean;

    initialize(rootelem, params) {
        super.initialize(rootelem, params);
        this.container.innerHTML = loadFile('file:///controls/devicesView.html');
        initializeControls(this.container);

        let _this = this;

        this.UI = getAllUIElements(this.container);
        this._showAllDevices = false;
        this.UI.portableDevicesExpander.textContent = '';
        this.localListen(this.UI.portableDevicesExpander, 'click', function () {
            if (_this._showAllDevices)
                _this._showAllDevices = false;
            else
                _this._showAllDevices = true;
            _this._refreshPortableDevices();

        });
        addEnterAsClick(this, this.UI.portableDevicesExpander);

        requirejs('helpers/mediaSync');
        this.localPromise(mediaSyncDevices.initRegistered()).then(function () {

            // portable devices
            let wholeList = app.devices.getAll();
            _this.UI.portableDevices.controlClass.dataSource = wholeList;
            _this._registerItemOpen(_this.UI.portableDevices, 'device');
            _this.localListen(wholeList, 'change', _this._refreshPortableDevices.bind(_this));
            _this._refreshPortableDevices();

            // storages
            _this.UI.storages.controlClass.dataSource = wholeList;
            _this._registerItemOpen(_this.UI.storages, 'device');
            _this.localListen(wholeList, 'change', _this._refreshStorages.bind(_this));
            _this._refreshStorages();
            _this._initAddStorageMenu();
        });

        // media servers
        setVisibility(this.UI.iconLoadingServers, true);
        this._refreshMediaServers();
        this.localListen(app.sharing.getRemoteServers(), 'change', this._refreshMediaServers.bind(this));
        this._registerItemOpen(this.UI.mediaServers, 'mediaServer');

        setVisibility(_this.UI.rowAddServer, false);
        this.localListen(this.UI.btnSubmitServer, 'click', function () {  //@ts-ignore
            let url = _this.UI.cbServerProtocol.controlClass.value + '://' + _this.UI.cbServerIP.controlClass.value + '/' + _this.UI.cbServerPath.controlClass.value;
            actions.addMediaServer._execute(url);
            animTools.animateHideRow(_this.UI.rowAddServer);
        });
        addEnterAsClick(this, this.UI.btnSubmitServer);

        this.localListen(this.UI.btnCloseAddServer, 'click', function () {
            animTools.animateHideRow(_this.UI.rowAddServer, () => {
                notifyLayoutChange(); // #17656
            });
        });
        addEnterAsClick(this, this.UI.btnCloseAddServer);

        uitools.addToolButton(this.UI.btnAddServer, 'add', function () {
            animTools.animateShowRow(_this.UI.rowAddServer);

            let ds = newStringList();
            ds.add('http');
            ds.add('https');
            _this.UI.cbServerProtocol.controlClass.dataSource = ds;
            (_this.UI.cbServerProtocol.controlClass as Dropdown).value = 'http';

            (_this.UI.cbServerIP.controlClass as Dropdown).value = 'XXX.XXX.XXX.XXX:YYYYY';

            ds = newStringList();
            ds.add('DeviceDescription.xml');
            ds.add('desc/device.xml');
            ds.add('description.xml');
            ds.add('rootDesc.xml');
            _this.UI.cbServerPath.controlClass.dataSource = ds;
            (_this.UI.cbServerPath.controlClass as Dropdown).value = 'DeviceDescription.xml';

        }, uitools.getPureTitle(actions.addMediaServer.title), this);
    }

    _initAddStorageMenu() {
        let res = [];
        let keys = Object.keys(window.mediaSyncHandlers);
        for (let iHandler = 0; iHandler < keys.length; iHandler++) {
            let h = window.mediaSyncHandlers[keys[iHandler]];
            if (h.getAddStorageMenu) {
                let _actions = h.getAddStorageMenu();
                for (let iAct = 0; iAct < _actions.length; iAct++) {
                    res.push({
                        action: _actions[iAct],
                        order: 10 * (iAct + 1),
                        grouporder: 10 * iHandler
                    });
                }
            }
        }
        //res.push(actions.addMediaServer);
        this.UI.btnAddStorage.controlClass.menuArray = res;
    }

    _refreshStorages() {
        let _this = this;
        setVisibility(this.UI.iconLoadingStorages, true);
        mediaSyncDevices.getBy({
            exceptHandler: 'usb'
        }).then(function (devices) {
            _this.UI.storages.controlClass.dataSource = devices;
            setVisibility(_this.UI.lblNoStorage, devices.count == 0);
            setVisibility(_this.UI.iconLoadingStorages, false);
        });
    }

    _refreshPortableDevices() {
        setVisibility(this.UI.iconLoadingDevices, true);
        let _this = this;
        let params = {
            handler: 'usb'
        };
        mediaSyncDevices.getBy(params).then(function (devices) {
            if (!_this._showAllDevices) {
                let params = {
                    handler: 'usb',
                    onlyRecentlySynced: true, // connected or synced in the last week (per #13697/~46512)
                };
                mediaSyncDevices.getBy(params).then(function (recentDevices) {
                    (_this.UI.portableDevices.controlClass as DeviceListView).showRowCount = Math.max(recentDevices.count, Math.min(2 /* show at least two*/ , devices.count));
                });
            } else {
                (_this.UI.portableDevices.controlClass as DeviceListView).showRowCount = 0; // = show all
            }
            _this.UI.portableDevices.controlClass.dataSource = devices;
            setVisibility(_this.UI.lblNoDevice, devices.count == 0);
            _this._setExpandText();
            setVisibility(_this.UI.iconLoadingDevices, false);
        });
    }

    _refreshMediaServers() {
        let serverList = app.sharing.getRemoteServers();
        this.localPromise(serverList.whenLoaded()).then(() => {
            setVisibility(this.UI.iconLoadingServers, false);
            let filteredList = app.utils.createEmptyList();
            listForEach(serverList, (server, idx) => {
                if (!mediaSyncHandlers['server']._isSyncableServer(server)) // syncable servers already appear in the 'Storage & Services' as device profiles
                    filteredList.add(server);
            });
            filteredList.isLoaded = true;
            this.UI.mediaServers.controlClass.dataSource = filteredList;
        });
    }

    doRefresh() { // for F5 to work (actions.view.refresh)        
        this._refreshStorages();
        this._refreshPortableDevices();
        this._refreshMediaServers();
    }

    _setExpandText() {
        if (!this._showAllDevices)
            this.UI.portableDevicesExpander.textContent = '(' + _('Show all') + ')';
        else
            this.UI.portableDevicesExpander.textContent = '(' + _('Show less') + ')';
    }

    _registerItemOpen(LV, nodeHandlerID) {
        let navigateDevice = function (e) {
            LV.controlClass.openView(e.detail.item, nodeHandlerID, e.detail.div, isNewTabEvent(e));
        };
        this.localListen(LV, 'itemdblclick', navigateDevice);
        this.localListen(LV, 'itemclick', navigateDevice);
        this.localListen(LV, 'itemtap', navigateDevice);
        this.localListen(LV, 'itementer', navigateDevice);
        this.localListen(LV, 'itemview', navigateDevice);
    }

    storeState() {
        return {}; // override to prevent from restore on LV descendant, it would assert in ListView.RestoreState  (dataSource == null)
    }

    restoreState(/*state*/) {

    }

}
registerClass(DevicesView);
