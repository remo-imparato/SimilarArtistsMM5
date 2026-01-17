/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

requirejs('controls/listview');
requirejs('helpers/mediaSync');

let utils = app.utils;

let gPaths = undefined;
let gPathsToSave = newStringList();
let gServerContainers = app.utils.createSharedList();
let gImporters = undefined;
let foldersList = null;
let lvMonitoredFolders = null;
let lvMonitoredFoldersDataSource;
let deleted = [];

let isDeviceFolder = function (folder) {
    return (folder.tag && folder.tag.objectType == 'device');
}

let isOneTimeFolder = function (folder) {
    return (folder.tag && folder.tag.oneTime);
}

let _refreshMonitoredDevices = function () {
    return new Promise((resolve, reject) => {
        mediaSyncDevices.getBy({
            scannedToLib: true
        }).then((devices) => {
            if (window._cleanUpCalled)
                return;
            let foldersList = lvMonitoredFoldersDataSource;
            foldersList.modifyAsync(function () {
                for (let i = foldersList.count - 1; i >= 0; i--) {
                    if (isDeviceFolder(foldersList.getValue(i)))
                        foldersList.delete(i);
                }
            }).then(function () {
                if (window._cleanUpCalled)
                    return;
                let newList = app.utils.createSharedList();
                listForEach(devices, function (device) {
                    if (mediaSyncDevices.isSyncable(device)) { // #15087
                        let folder = app.filesystem.getFolderFromString(device.name, true /* temporary */ );
                        folder.tag = device;
                        folder.icon = mediaSyncDevices.getIcon(device);
                        newList.add(folder);
                    }
                });
                applyNewFolders(newList);
                resolve();
            });
        }, reject);
    });
}

function _configureDevice(device, enableScanCheckbox) {
    let dlg = uitools.openDialog('dlgDeviceConfig', {
        modal: true,
        device: device,
        enableScanCheckbox: enableScanCheckbox
    });
    dlg.whenClosed = function () {
        _refreshMonitoredDevices();
    };
    app.listen(dlg, 'closed', dlg.whenClosed);
}

// Add folder popup-menu -------------------------------------

function getAddFolderMenuAsync(control) {
    foldersList = app.utils.createSharedList();
    return new Promise(function (resolve) {

        let presetColumns = [{
            action: {
                title: _('Local storage') + '...',
                icon: 'drive',
                execute: function () {
                    let dlg = uitools.openDialog('dlgChooseFolders', {
                        modal: true,
                        initFolder: foldersList,
                        showAddButton: true
                    });
                    dlg.whenClosed = function () {
                        if (dlg.modalResult == 1) {
                            foldersList = dlg.getValue('getPaths')();
                            applyNewFolders(foldersList);
                        }
                    };
                    app.listen(dlg, 'closed', dlg.whenClosed);
                }
            },
            order: 10,
            grouporder: 10
        }, {
            action: {
                title: function () {
                    return _('Network') + '...';
                },
                icon: 'network',
                execute: function () {
                    // get network paths
                    let p = newStringList();
                    foldersList.locked(function () {
                        for (let i = 0; i < foldersList.count; i++) {
                            let path = foldersList.getValue(i).path;
                            if (path.substr(0, 2) == '\\\\') {
                                p.add(path);
                            }
                        }
                    });

                    let dlg = uitools.openDialog('dlgNetworkFolder', {
                        modal: true,
                        initFolder: p.commaText,
                        editSupport: false
                    });
                    dlg.whenClosed = function () {
                        if (dlg.modalResult == 1) {
                            let p = dlg.getValue('getPaths')();
                            foldersList.modifyAsync(function () {
                                for (let i = foldersList.count - 1; i >= 0; i--) {
                                    let path = foldersList.getValue(i).path;
                                    if (path.substr(0, 2) == '\\\\') {
                                        foldersList.delete(i);
                                    }
                                }
                                p.locked(function () {
                                    for (let i = 0; i < p.count; i++) {
                                        let path = p.getValue(i);
                                        if (!foldersList.isDuplicate(function (item) {
                                                return item.path == path;
                                            })) {
                                            foldersList.add(app.filesystem.getFolderFromString(path, true /* temporary */ ));
                                        }
                                    }
                                });
                                applyNewFolders(foldersList);
                            });
                        }
                    };
                    app.listen(dlg, 'closed', dlg.whenClosed);
                }
            },
            order: 20,
            grouporder: 10,
        }, {
            action: {
                title: _('Media server') + '...',
                icon: 'server',
                execute: function () {
                    let dlg = uitools.openDialog('dlgChooseFolders', {
                        modal: true,
                        rootNode: 'servers',
                        initFolder: foldersList                        
                    });
                    dlg.whenClosed = function () {
                        if (dlg.modalResult == 1) {
                            let serverContainers = dlg.getValue('getServerContainers')();
                            if (serverContainers.count > 0) {
                                messageDlg(_('Media Server content is read-only.') + '<br>'+ _("You might want to add the content via a 'Network' location instead.") + ' <br><br>' + _('Are you sure you want to proceed?'), 'Confirmation', ['btnYes', 'btnNo'], {
                                    defaultButton: 'btnNo'
                                }, function (result) {
                                    if (result.btnID === 'btnYes') {
                                        let newList = app.utils.createSharedList();
                                        listForEach(serverContainers, function (container) {
                                            let folder = app.filesystem.getFolderFromString(container.fullName, true /* temporary */ );
                                            folder.tag = container;
                                            folder.icon = 'server';
                                            newList.add(folder);
                                        });
                                        applyNewFolders(newList);
                                    }
                                });
                            }
                        }
                    };
                    app.listen(dlg, 'closed', dlg.whenClosed);
                }
            },
            order: 30,
            grouporder: 10
        }, {
            action: {
                title: function () {
                    return _('Cloud storage');
                },
                icon: 'cloud',
                submenu: generateCloudStorageSubmenu
            },
            order: 40,
            grouporder: 10,
        }];

        let menu = new Menu(presetColumns, {
            parent: control
        });

        resolve(menu);
    });
}

function generateCloudStorageSubmenu() {

    return new Promise(function (resolve, reject) {

        mediaSyncDevices.getBy({
            handler: 'cloud'
        }).then(function (profiles) {
            if (window._cleanUpCalled)
                return;
            let presetColumns = [];

            let order = 30;
            // add existing cloud profiles that can be scanned to library:
            let subscribed_services = {};
            profiles.locked(function () {
                for (let i = 0; i < profiles.count; i++) {
                    let pr = profiles.getValue(i);
                    let service = mediaSyncHandlers[pr.handlerID /*cloud*/ ].getService(pr);
                    subscribed_services[service.id] = true;

                    presetColumns.push({
                        action: {
                            device: pr,
                            title: function () {
                                return resolveToValue(this.device.name);
                            },
                            icon: function (node) {
                                return mediaSyncDevices.getIcon(this.device);
                            },
                            execute: function () {
                                _configureDevice(this.device, true);
                            }
                        },
                        order: order,
                        grouporder: 10,
                    });
                    order += 10;
                }
            });

            // if there isn't any cloud profile yet (for the given service) then add it to register:
            let keys = Object.keys(window.cloudServices);
            for (let i = 0; i < keys.length; i++) {
                let service = copyObject(window.cloudServices[keys[i]]);
                service.id = keys[i];
                if (!subscribed_services[service.id]) {
                    presetColumns.push({
                        action: {
                            service: service,
                            title: function () {
                                return resolveToValue(this.service.title);
                            },
                            icon: function (node) {
                                return resolveToValue(this.service.icon, 'cloud');
                            },
                            execute: function () {
                                mediaSyncHandlers['cloud'].addNewProfile(this.service).then(function (device) {
                                    if (window._cleanUpCalled)
                                        return;
                                    _configureDevice(device, true);
                                });
                            },
                        },
                        order: order,
                        grouporder: 10,
                    });
                    order += 10;
                }
            }

            resolve(presetColumns);
        });
    });
}

function applyNewFolders(foldersList, asUnchecked) {
    if (foldersList && !window._cleanUpCalled) {
        lvMonitoredFolders.controlClass.checkExchangeServer2Device(foldersList).then((foldersList) => {
            if (window._cleanUpCalled)
                return;
            foldersList.setAllChecked(!asUnchecked);
            let useDS = lvMonitoredFoldersDataSource;
            useDS.addList(foldersList);
            useDS.modifyAsync(function () {
                for (let i = 0; i < foldersList.count; i++) {
                    let idx = (useDS.count - 1) - i;
                    useDS.getValue(idx).isTemporary = true;
                    useDS.setChecked(idx, !asUnchecked);
                }
            });
        });
    }
}

let _storeMonitoredServerContainers = function (serverContainers) {
    let ar = [];
    listForEach(serverContainers, function (container) {
        ar.push(container.asJSON);
    });
    app.setValue('_monitoredServerContainers', ar);
}

let _restoreMonitoredServerContainers = function () {
    let serverContainers = app.getValue('_monitoredServerContainers', []);
    let newList = app.utils.createSharedList();
    forEach(serverContainers, function (JSON) {
        let container = app.sharing.getServerContainerFromJSON(JSON);
        if (container) {
            let folder = app.filesystem.getFolderFromString(container.fullName, true /* temporary */ );
            folder.tag = container;
            folder.icon = 'server';
            newList.add(folder);
        }
    });
    applyNewFolders(newList, true);
}

// initialization --------------------------------------------
optionPanels.pnlScan.load = function (params) {

    let lblTopTitle = qid('lblTopTitle');
    if (params.topTitle) {
        lblTopTitle.innerText = params.topTitle;
    }
    setVisibility(lblTopTitle, !!params.topTitle);

    let _this = this;
    if (params.justSelectPaths) {
        setVisibility(qid('PnlRight'), false);
    }

    let sett = window.settings.get();
    gImporters = app.importer.getInstalledImporters();

    lvMonitoredFolders = qid('lvMonitoredFolders');

    let confDev = function (e) {
        let folder = e.detail.item;
        if (isDeviceFolder(folder))
            _configureDevice(folder.tag);
    }
    app.listen(lvMonitoredFolders, 'itemclick', confDev);
    app.listen(lvMonitoredFolders, 'itemdelete', function (e) {
        let folder = e.detail.item;
        deleted.push(folder);
        if (isDeviceFolder(folder)) {
            let device = folder.tag;
            mediaSyncDevices.changeLibraryScanSettings(device, {
                scanToLib: false
            });
            _refreshMonitoredDevices();
        }
    });

    let btnChooseFolders = qid('btnChooseFolders');
    app.listen(btnChooseFolders, 'click', function (e) {
        getAddFolderMenuAsync(btnChooseFolders).then(function (menu) {
            if (window._cleanUpCalled)
                return;
            let pos = findScreenPos(btnChooseFolders);            
            menu.show(pos.left, pos.top + btnChooseFolders.offsetHeight, false, true);
        });
    });
    btnChooseFolders.controlClass.textContent = btnChooseFolders.controlClass.textContent + ' >> ';


    let importersList = qid('lvImporters');
    let chbImport = qid('chbImport');

    gImporters.whenLoaded().then(function () {
        if (chbImport && !window._cleanUpCalled) {
            chbImport.enabled = gImporters.count > 0;
            gImporters.modifyAsync(function () {
                if (window._cleanUpCalled)
                    return;

                for (let i = 0; i < gImporters.count; i++) {
                    gImporters.setChecked(i, true);
                    // create importer checkbox
                    let div = document.createElement('div');
                    div.setAttribute('data-control-class', 'Checkbox');
                    div.setAttribute('data-init-params', '{checked: true}');
                    div.classList.add('lvItem');
                    div._data = gImporters.getValue(i);
                    div._index = i;
                    div.innerText = div._data.GetTitle();
                    importersList.appendChild(div);
                    app.listen(div, 'change', function (e) {
                        let chb = elementControl(e.target);
                        if (chb) {
                            gImporters.modifyAsync(function () {
                                gImporters.setChecked(chb.container._index, chb.checked);
                            });
                        }
                    });
                }
                initializeControls(importersList);
                if (chbImport && chbImport.controlClass) {
                    updateImportersState(!chbImport.controlClass.checked);
                }
            }.bind(this));
        }
    }.bind(this));

    let updateImportersState = function (disabled) {
        let list = qes(importersList, '[data-control-class]');
        if (list) {
            forEach(list, function (el) {
                el.controlClass.disabled = disabled;
            });
        }
    };

    app.listen(qid('chbImport'), 'change', function () {
        updateImportersState(!qid('chbImport').controlClass.checked);
    });

    sett = window.settings.get();
    qid('chbImport').controlClass.checked = false;
    updateImportersState(!qid('chbImport').controlClass.checked);


    window.initPromise = new Promise((resolve, reject) => {
        gPaths = app.filesystem.getLastScannedFolders();
        let initFolderAdded = false;
        if (params.initFolder && (isLocalPath(params.initFolder) || isNetworkPath(params.initFolder))) {
            let exists = false;
            listForEach(gPaths, (path) => {                
                if (path == params.initFolder)
                    exists = true; 
            });
            if (!exists) {               
                gPaths.insert(0, params.initFolder);
                gPaths.setChecked(0, false); // #21299  
                initFolderAdded = true;
            }
        }

        lvMonitoredFoldersDataSource = app.utils.createSharedList();

        let foldersList = lvMonitoredFoldersDataSource;
        foldersList.modifyAsync(() => {
            gPaths.locked(() => {
                for (let i = 0; i < gPaths.count; i++) {
                    let path = gPaths.getValue(i);
                    if (!foldersList.isDuplicate(function (item) {
                            return item.path == path;
                        })) {
                        let folder = app.filesystem.getFolderFromString(path, true /* temporary .. it will not modify anything till commit called */ );
                        if (initFolderAdded && (i == 0))
                            folder.tag = {oneTime: true};
                        foldersList.add(folder);
                        foldersList.setChecked(foldersList.count - 1, gPaths.isChecked(i))
                    }
                }
            });
            _restoreMonitoredServerContainers();
            _refreshMonitoredDevices().then(() => {
                if (window._cleanUpCalled)
                    return;
                // LS: assign the dataSource as the very last, otherwise 'change' event on it would cause updateMonitoredFolders() calling and would slow down start up
                lvMonitoredFolders.controlClass.prepareDataSource(lvMonitoredFoldersDataSource);                
            });
        });

        resolve();
    });
}

optionPanels.pnlScan.save = function (params) {
    let sett = window.settings.get();
    sett.Confirmations.ConfirmImportRatings = qid('chbImport').controlClass.checked;
    window.settings.set(sett);

    prepareFolders();
    return {
        paths: gPaths,
        pathsToSave: gPathsToSave,
        serverContainers: gServerContainers,
        importers: getImporters()
    };
}

optionPanels.pnlScan.cancel = function (params) {
    prepareFolders(true);
}

optionPanels.pnlScan.beforeWindowCleanup = function () {
    gPaths = undefined;
    gPathsToSave = undefined;
    gServerContainers = undefined;
    gImporters = undefined;
    foldersList = undefined;
    lvMonitoredFolders = undefined;
    lvMonitoredFoldersDataSource = undefined;
    deleted = undefined;
}

function doLookup() {
    return qid('chbLookup').controlClass.checked;
}

function getImporters() {
    let allowImport = qid('chbImport').controlClass.checked;
    let impList = gImporters.getEmptyList();
    gImporters.locked(function () {
        for (let i = 0; i < gImporters.count; i++) {
            if (allowImport && gImporters.isChecked(i)) {
                impList.add(gImporters.getValue(i));
            }
        }
    });
    return impList;
}

function prepareFolders(canceled) {
    deleted.forEach(function(folder) {
        folder.monitorChanges = false;
        folder.monitorContinous = false;
        folder.monitorStartup = false;
        if (folder.commit)
            folder.commit();
    });
    
    
    let p = lvMonitoredFoldersDataSource;
    let allContainers = app.utils.createSharedList();
    if (!canceled) {
        gPaths.clear();
        gPathsToSave.clear();
        gServerContainers.clear();        
    }
    p.locked(function () {
        for (let i = 0; i < p.count; i++) {
            let folder = p.getValue(i);
            if (folder.commit)
                folder.commit();

            if (!canceled) {
                if (folder.tag && folder.tag.objectType == 'serverContainer') {
                    if (p.isChecked(i))
                        gServerContainers.add(folder.tag);
                    allContainers.add(folder.tag);
                } else
                if (!isDeviceFolder(folder)) {
                    gPaths.add(folder.path);
                    gPaths.setLastChecked(p.isChecked(i));
                    if (!isOneTimeFolder(folder)) {
                        gPathsToSave.add(folder.path);
                        gPathsToSave.setLastChecked(p.isChecked(i));
                    }
                }
            }
        }
    });
    if (!canceled)
        _storeMonitoredServerContainers(allContainers);
}
