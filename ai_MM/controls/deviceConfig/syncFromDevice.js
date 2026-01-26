/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

nodeHandlers.syncFromDeviceFolders = inheritNodeHandler('SyncFromDeviceFolders', 'Base', {
    getChildren: function (node) {
        return new Promise(function (resolve, reject) {
            var list = node.dataSource.getFolderList('syncFromDevice');
            list.whenLoaded().then(function () {
                node.addChildren(list, 'folder');
                resolve();
            });
        });
    },
});

DeviceConfig.prototype.tabs.syncFromDevice.load = function (reload) {
    var chbSyncFromDevice = this.qChild('chbSyncFromDevice');
    chbSyncFromDevice.controlClass.checked = this.device.biDirSync;

    var _this = this;

    var folderTree = this.qChild('treeSyncFromDeviceFolders');
    folderTree.controlClass.reinitNodes(); // to re-init when root.dataSource (device) is changed
    var root = folderTree.controlClass.root;
    root.handlerID = 'syncFromDeviceFolders';
    root.dataSource = this.device;
    folderTree.controlClass.expandMarked();

    bindDisabled2Checkbox(folderTree, chbSyncFromDevice);

    var edtDestDir = this.qChild('edtDestDir');
    edtDestDir.controlClass.value = this.device.copyToPCFolder;

    if (!reload) {
        this.localListen(this.qChild('btnDestDir'), 'click', function () {
            window.uitools.showSelectFolderDlg(edtDestDir.controlClass.value).then(function (path) {
                if (path != '') {
                    edtDestDir.controlClass.value = path;
                }
            });
        });
        addEnterAsClick(this, this.qChild('btnDestDir'));
        this.localListen(this.qChild('btnAddSyncFolder'), 'click', function () {
            var dlg = uitools.openDialog('dlgSelectFiles', {
                modal: true,
                title: _('Add folder'),
                description: _('Enter folder path that you want to add:'),
                showBrowseButton: false
            });
            dlg.whenClosed = function () {
                if (dlg.modalResult === 1) {
                    var path = dlg.getValue('getPath')();
                    var folders = folderTree.controlClass.getCheckedFolders(true);
                    folders.add(path);
                    _this.device.setFolderList('syncFromDevice', folders);
                    nodeUtils.refreshNodeChildren(folderTree.controlClass.root).then(function () {
                        folderTree.controlClass.expandAll();
                    });
                }
            };
            app.listen(dlg, 'closed', dlg.whenClosed);
        });
        addEnterAsClick(this, this.qChild('btnAddSyncFolder'));
    }

    this.qChild('chbConfirmSyncFromDevice').controlClass.checked = this.device.biDirConfirm;
    this.qChild('chbSyncFromDeviceMetadata').controlClass.checked = this.device.biDirSyncMetadata;
};

DeviceConfig.prototype.tabs.syncFromDevice.save = function () {
    this.device.biDirSync = this.qChild('chbSyncFromDevice').controlClass.checked;

    this.device.setFolderList('syncFromDevice', this.qChild('treeSyncFromDeviceFolders').controlClass.getCheckedFolders());

    this.device.copyToPCFolder = this.qChild('edtDestDir').controlClass.value;
    this.device.biDirConfirm = this.qChild('chbConfirmSyncFromDevice').controlClass.checked;
    this.device.biDirSyncMetadata = this.qChild('chbSyncFromDeviceMetadata').controlClass.checked;
};