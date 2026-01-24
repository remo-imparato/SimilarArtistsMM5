/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

mediaSyncHandlers.syncToFolder = {
    icon: 'folder',
    showContent: true,
    syncEnabled: function (device) {
        return true;
    },
    initProfileDefaults: function (device) {
        // here we can set up default values for the profile (configurable by users in DeviceConfig)
        device.saveAAToFolder = true;

        // convert rules should be all disabled by default (so that user isn't degrading his library)
        var convertConfig = device.autoConvertConfig;
        convertConfig.rules.setAllChecked(false);
        convertConfig.setSupportedFormatsList(app.utils.createSharedList()); // Unknown (all formats)
        device.autoConvertConfig = convertConfig;
    },
    addCustomNodes(node) {
        var device = node.dataSource;
        var rootFolder = app.filesystem.getFolderFromString(this._getSyncRoot(device));
        rootFolder.hasSubfolders = true;
        node.addChild(rootFolder, 'syncToFolder_FolderRoot');
    },
    getStorageInfo: function (device) {
        var root = this._getSyncRoot(device);
        return new Promise(function (resolve, reject) {
            app.filesystem.getDiskSpaceAsync(root).then(function (info) {
                resolve({
                    spaceTotal: info.spaceTotal,
                    spaceUsed: (info.spaceTotal - info.spaceFree)
                });
            }, reject);
        });
    },
    removeFile: function (sync, path) {
        var fullPath = this._getFullPath(sync.device, path);
        return app.filesystem.deleteFileAsync(fullPath);
    },
    PATH_DELIM: app.filesystem.getPathSeparator(),
    removeEmptyFolder: function (sync, path) {
        var fullPath = this._getFullPath(sync.device, this.PATH_DELIM + path);
        return app.filesystem.deleteFolderAsync(fullPath, false /* no recycle bin*/ , true /* only if empty */ );
    },
    _uploadFilePart: function (uploadData) {
        return app.filesystem.setFileContentAsync(uploadData.content, uploadData.path, uploadData.startOffset);
    },
    _uploadFile: function (sync, sourcePath, targetPath, progressCallback) {
        ODS('Sync local folder: uploading file: ' + sourcePath + ' -> ' + targetPath);
        var _this = this;
        var fullPath = this._getFullPath(sync.device, targetPath);
        var chunkSize = 500 * 1024; // 500 KB chunk
        return new Promise(async function (resolve, reject) {

            await app.filesystem.deleteFileAsync(fullPath);
            let fileSize = await app.filesystem.getFileSizeAsync(sourcePath);

            var uploadData = {
                path: fullPath,
                mimeType: 'application/octet-stream',
                size: fileSize
            }

            var uploadFilePart = function (partNum) {

                if (sync.taskProgress.terminated)
                    reject('Upload was cancelled by user');

                var startOffset = partNum * chunkSize;
                var endOffset = (partNum + 1) * chunkSize;
                app.filesystem.getFileContentAsync(sourcePath, startOffset, endOffset).then(
                    function (fileBuffer) {
                        uploadData.content = fileBuffer;
                        uploadData.startOffset = startOffset;
                        uploadData.endOffset = startOffset + fileBuffer.byteLength;

                        if (progressCallback)
                            progressCallback(startOffset / fileSize);

                        var callFinish = (fileBuffer.byteLength < chunkSize) || (endOffset == fileSize);

                        _this._uploadFilePart(uploadData).then(
                            function () {
                                if (!callFinish)
                                    uploadFilePart(partNum + 1);
                                else
                                    resolve();
                            },
                            reject
                        );
                    },
                    reject
                );
            }
            uploadFilePart(0);
         
        });
    },
    uploadFile: function (sync, file) {
        return this._uploadFile(sync, file.sourcePath, file.targetPath);
    },
    uploadTrack: function (sync, trackInfo, progressCallback) {
        trackInfo.targetPath = this._getFullPath(sync.device, trackInfo.targetPath);
        return this._uploadFile(sync, trackInfo.sourcePath, trackInfo.targetPath, progressCallback);
    },
    uploadPlaylist: function (sync, playlist) {
        if (playlist.filePaths.count > 0) // not an empty playlist
            return this._uploadFile(sync, playlist.sourcePath, playlist.targetPath);
        else
            return dummyPromise();
    },
    downloadFile(sync, file) {
        return app.filesystem.copyFileAsync(file.sourcePath, file.targetPath);
        //return sync.process.downloadFile(file.sourcePath, file.targetPath, sync.taskProgress);
    },
    _getFullPath: function (device, path) {
        var root = removeLastSlash(this._getSyncRoot(device));
        var letter = this._getDriveLetter(device);
        if (letter.length == 1 && path.length > 1 && path[1] != ':')
            return letter + ':' + this.PATH_DELIM + removeFirstSlash(path);
        else
            return path;
    },
    _getDriveLetter(device) {
        var root = this._getSyncRoot(device);
        if (root.length > 1 && root[1] == ':')
            return root[0];
        else
            return '';
    },
    _getSyncRoot: function (device) {
        var sett = mediaSyncDevices.getCustomSettings(device);
        if (sett.syncRoot)
            return sett.syncRoot;
        else
            return app.filesystem.getDataFolder();
    },
    _setSyncRoot: function (device, path) {
        var sett = mediaSyncDevices.getCustomSettings(device);
        if (sett.syncRoot != path) {
            sett.syncRoot = path;
            mediaSyncDevices.setCustomSettings(device, sett);

            var maskRoot = removeLastSlash(sett.syncRoot);
            if (maskRoot.length > 1 && maskRoot[1] == ':')
                maskRoot = maskRoot.slice(2);

            setTimeout(() => { // just be sure that it will be saved after the Sync Profile > File Locations tab (when [Apply] is clicked and the tab was already opened)
                device.resetTargetMasks();

                var setMask = function (trackType) {
                    var newMask = device.getTargetMask(trackType);
                    newMask = maskRoot + newMask;
                    device.setTargetMask(trackType, newMask);
                }.bind(this);

                setMask('music');
                setMask('classical');
                setMask('audiobook');
                setMask('podcast');
                setMask('videopodcast');
                setMask('video');
                setMask('musicvideo');
                setMask('tv');

                var sett = JSON.parse(device.getPlaylistSettingsJSON());
                sett.storage.destDirectory = maskRoot + '\\Playlists\\';
                device.setPlaylistSettingsJSON(JSON.stringify(sett));

                device.commitAsync();
            }, 1);
        }
    },
    scanContent(device, cancelToken) {
        return new Promise((resolve, reject) => {
            var list = device.getFolderStringList('scanFromDevice');
            var root = this._getSyncRoot(device);
            list.add(root);
            var tracklist = app.utils.createTracklist(true);
            listAsyncForEach(list, (path, next) => {
                var fPath = this._getFullPath(device, path);
                if (fPath.startsWith(root) && (fPath != root)) {
                    ODS('Sync local folder: scanContent: SKIPPED: ' + fPath);
                    next(cancelToken && cancelToken.terminated);
                } else {
                    var fld = app.filesystem.getFolderFromString(fPath);
                    var folderTracks = fld.getTracklist(true /*include sub-folders*/ );
                    folderTracks.whenLoaded().then(() => {
                        ODS('Sync local folder: scanContent: USED: ' + fPath + ', track count: ' + folderTracks.count);
                        tracklist.addList(folderTracks);
                        next(cancelToken && cancelToken.terminated);
                    }, next);
                }
            }, () => {
                ODS('Sync local folder: scanContent: TOTAL track count: ' + tracklist.count);
                if (cancelToken && cancelToken.terminated) {
                    resolve(tracklist);
                } else {
                    var sett = JSON.parse(device.getPlaylistSettingsJSON());
                    var pPath = this._getFullPath(device, sett.storage.destDirectory);
                    ODS('Sync local folder: scanContent: playlists dir path: ' + pPath);
                    var fld = app.filesystem.getFolderFromString(pPath);
                    var content = fld.getFolderList();
                    content.whenLoaded().then(() => {
                        ODS('Sync local folder: scanContent: TOTAL playlists count: ' + content.count);
                        fastForEach(content, (item) => {
                            var file = app.utils.createEmptyTrack();
                            file.dontNotify = true;
                            file.path = item.path;
                            tracklist.add(file);
                        });
                        resolve(tracklist);
                    });

                }
            });
        });
    },
    scanContentForSync(device, cancelToken) {
        var letter = this._getDriveLetter(device);
        if (letter.length == 1)
            device.setDriveLetter(letter);
        return this.scanContent(device, cancelToken);
    },
    configPage: {
        summary: {
            load: function (device, config) {
                var box = config.qChild('summaryOptionsBox');
                box.innerHTML =
                    '<div class="flex row uiRow">' +
                    '  <label>' + _('Sync root') + ':</label>' +
                    '  <div data-id="cbFolderPath" class="fill" data-control-class="Edit" data-init-params="{type: \'text\'}"></div>' +
                    '  <div data-id="btnBrowseFolder" data-control-class="Button">Browse</div>' +
                    '</div>';
                initializeControls(box);
                var btn = config.qChild('btnBrowseFolder');
                var cb = config.qChild('cbFolderPath');
                cb.controlClass.value = this._getSyncRoot(device);
                app.listen(btn, 'click', function () {
                    window.uitools.showSelectFolderDlg(cb.controlClass.value).then(function (path) {
                        if (path != '')
                            cb.controlClass.value = path;
                    });
                });
            },
            save: function (device, config) {
                var cb = config.qChild('cbFolderPath');
                this._setSyncRoot(device, cb.controlClass.value);
            },
        }
    },
    createSyncTarget: function (initPath) {
        var profile_id = 'syncToFolder_' + initPath;
        var name = initPath;
        mediaSyncDevices.register({
            id: profile_id,
            name: name,
            handlerID: 'syncToFolder'
        });
        mediaSyncDevices.initRegistered().then1(() => {
            app.devices.getDeviceAsync(profile_id, name).then((device) => {
                mediaSyncHandlers.syncToFolder._setSyncRoot(device, initPath);
                setTimeout(() => {
                    // and navigate this new profile in the UI:
                    navUtils.navigateNodePath([navUtils.createNodeState('root'),
                                       navUtils.createNodeState('devicesList'),
                                       navUtils.createNodeState('device', device)]);
                }, 100);
            });
        });
    },
    getAddStorageMenu: function () {
        var res = [];
        res.push({
            title: _('Local storage') + ' (' + _('folder') + ')',
            icon: 'folder',
            execute: () => {
                window.uitools.showSelectFolderDlg().then((path) => { // choose the sync root (#16558 / item 5)
                    if (path != '')
                        this.createSyncTarget(path); // adds new sync target (profile)                    
                });
            }
        });
        return res;
    }
};
