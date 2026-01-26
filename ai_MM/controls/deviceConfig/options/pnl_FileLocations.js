/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

nodeHandlers.scanFromDeviceFolders = inheritNodeHandler('ScanFromDeviceFolders', 'Base', {
    getChildren: function (node) {
        return new Promise(function (resolve, reject) {
            var list = node.dataSource.getFolderList('scanFromDevice');
            list.whenLoaded().then(function () {
                node.addChildren(list, 'folder');
                resolve();
            });
        });
    },
});

DeviceConfig.prototype.tabs.options.panels.pnl_FileLocations.load = function (device, reload) {

    this.qChild('lblSyncFilesTo').innerText = sprintf(_('Save files to the following locations on \'%s\''), device.name);

    var initMaskCombo = function (trackType) {
        let cb = this.qChild('cbmask_' + trackType);
        let cls = cb.controlClass;
        cls.value = app.masks.mask2VisMask(device.getTargetMask(trackType));
        cls.localPromise( app.utils.getSampleTrackAsync(trackType)).then(function (track) {
            cls.sampleTrack = track
        });
        cls.hideConfDialogBrowseButton = true;
    }.bind(this);

    var rootDir = device.getWriteAccessRoot();
    if (rootDir != '') {
        setVisibility(this.qChild('boxRootDir'), true);
        var lblWriteAccess = this.qChild('lblWriteAccess');
        lblWriteAccess.innerText = rootDir;
        if (!reload) {
            this.localListen(lblWriteAccess, 'click', function () {
                window.uitools.openWeb('https://www.mediamonkey.com/android/write-limited');
            });
            addEnterAsClick(this, lblWriteAccess);
        }
    } else {
        setVisibility(this.qChild('boxRootDir'), false);
    }

    initMaskCombo('music');
    initMaskCombo('classical');
    initMaskCombo('audiobook');
    initMaskCombo('podcast');
    initMaskCombo('videopodcast');
    initMaskCombo('video');
    initMaskCombo('musicvideo');
    initMaskCombo('tv');

    this.qChild('chbEnforceMask').controlClass.text = sprintf(_('Enforce use of the sync mask for files already on \'%s\''), device.name);
    this.qChild('chbEnforceMask').controlClass.checked = device.resyncOnMaskChange;

    this.qChild('lblOtherMediaFiles').innerText = sprintf(_('Other locations on \'%s\' to scan for media files'), device.name);

    var folderTree = this.qChild('treeScanDeviceFolders');
    folderTree.controlClass.reinitNodes(); // to re-init when root.dataSource (device) is changed
    var root = folderTree.controlClass.root;
    root.handlerID = 'scanFromDeviceFolders';
    root.dataSource = device;
    folderTree.controlClass.expandMarked();

    if (!reload) {
        this.localListen(this.qChild('btnAddScanFolder'), 'click', function () {
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
                    device.setFolderList('scanFromDevice', folders);
                    nodeUtils.refreshNodeChildren(folderTree.controlClass.root).then(function () {
                        folderTree.controlClass.expandAll();
                        folderTree.controlClass.raiseEvent('change'); // to enable [Apply] button
                    });
                }
            };
            app.listen(dlg, 'closed', dlg.whenClosed);
        });
        addEnterAsClick(this, this.qChild('btnAddScanFolder'));
    }
}

DeviceConfig.prototype.tabs.options.panels.pnl_FileLocations.save = function (device) {

    var saveMaskCombo = function (trackType) {
        device.setTargetMask(trackType, app.masks.visMask2Mask(this.qChild('cbmask_' + trackType).controlClass.value));
    }.bind(this);

    saveMaskCombo('music');
    saveMaskCombo('classical');
    saveMaskCombo('audiobook');
    saveMaskCombo('podcast');
    saveMaskCombo('videopodcast');
    saveMaskCombo('video');
    saveMaskCombo('musicvideo');
    saveMaskCombo('tv');

    device.setFolderList('scanFromDevice', this.qChild('treeScanDeviceFolders').controlClass.getCheckedFolders());
    device.resyncOnMaskChange = this.qChild('chbEnforceMask').controlClass.checked;
}
