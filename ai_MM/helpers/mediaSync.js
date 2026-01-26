/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

/* eslint-disable @typescript-eslint/no-unused-vars */
'use strict';
import ArrayDataSource from './arrayDataSource';
import MetadataStorage from './metadataStorage';
import '../helpers/cloudServices';
/*
mediaSyncHandlers allows to utilize media sync process for various sync types (e.g. cloud, usb, etc.)

By adding new handler here you can create custom sync process to whatever location or a device type
See /scripts/syncToFolder/ script for examples

Default handlers are:

'cloud' - used for cloud services sync (DropBox, OneDrive, Google Drive, Google Play Music)
'usb' - used for USB connected device sync (iPods, iPhones, Android devices, SD cards, USB memory sticks)
'server' - used for "writeable" UPnP/DLNA server sync (e.g. MediaMonkey server installed on NAS or Raspberry Pi)

*/
// todo: Export
window.mediaSyncHandlers = {};
window.mediaSyncHandlers['cloud'] = {
    icon(device) {
        let service = this.getService(device);
        if (service.icon)
            return service.icon;
        else
            return 'cloud';
    },
    getService(device) {
        let sett = mediaSyncDevices.getCustomSettings(device);
        let serviceID;
        if (sett.serviceInfo)
            serviceID = sett.serviceInfo.serviceID;
        if (serviceID && cloudServices[serviceID]) {
            let authData = sett.serviceInfo.authData;
            let key = device.id;
            if (!cloudTools.serviceInstanceCache[key]) {
                cloudTools.serviceInstanceCache[key] = copyObject(cloudServices[serviceID]);
                let service = cloudTools.serviceInstanceCache[key];
                service.device = device;
                service.id = serviceID;
                service.device_id = key;
                cloudTools.setAuthData(service, authData);
                if (service.init)
                    service.init(device);
            }
            return cloudTools.serviceInstanceCache[key];
        }
        else
            return undefined; // no longer existing cloud service (e.g. googleMusic addon uninstalled)
    },
    isFolderBased(device) {
        let service = this.getService(device);
        if (service.folder_based == false) // e.g. GPM, Spotify
            return false;
        else
            return true;
    },
    helpContext(device) {
        let service = this.getService(device);
        if (service.downloadSupported == false)
            return 'Syncing_with_Services';
        else
            return 'Cloud_Services';
    },
    metadataStorageEnabled(device) {
        return this.isFolderBased(device);
    },
    showContent(device) {
        let service = this.getService(device);
        return service.isAuthorized();
    },
    syncEnabled(device) {
        let service = this.getService(device);
        return (service && service.isAuthorized());
    },
    initProfileDefaults(device) {
        device.saveAAToFolder = true; // is used in getArtworkUrl() for folder based services (OneDrive, DropBox, Google Drive)
        device.imagePath = ''; // so that the default service icons are used
        let service = this.getService(device);
        if (service.initProfileDefaults) {
            // e.g. Google Play Music service defines own rules (as it supports only MP3 tracks)
            return service.initProfileDefaults(device);
        }
        else {
            // otherwise convert rules should be all disabled by default for cloud profiles 
            // so that user isn't degrading his library once he decides to migrate to the cloud (#14272 / item 9)
            let convertConfig = device.autoConvertConfig;
            convertConfig.rules.setAllChecked(false);
            convertConfig.setSupportedFormatsList(app.utils.createSharedList()); // Unknown (all formats)
            device.autoConvertConfig = convertConfig;
            // some M3U copy default for folder based services (#16561):
            let sett = JSON.parse(device.getPlaylistSettingsJSON());
            sett.generateFor.playlists = true;
            sett.generateFor.artists = false;
            sett.generateFor.albums = false;
            sett.generateFor.locations = false;
            sett.storage.playlistFormat = 'M3U8';
            sett.storage.playlistFormats = 'M3U,M3U8,PLS,XSPF,ASX';
            sett.storage.destDirectory = '\\Playlists\\';
            sett.m3u.useRelativePaths = true;
            sett.m3u.linuxFolderSeparator = false;
            sett.m3u.useUnicode = true;
            sett.m3u.useExtendedM3U = true;
            sett.organize.enabled = false;
            sett.organize.type = 0;
            device.setPlaylistSettingsJSON(JSON.stringify(sett));
        }
    },
    justMatchingSupport(device) {
        let service = this.getService(device);
        if (service.matchTrack && !service.uploadFile)
            return true;
    },
    addCustomNodes(node) {
        let device = node.dataSource;
        let service = this.getService(device);
        if (service.addCustomNodes)
            service.addCustomNodes(node);
        else {
            node.addChild(node.dataSource, 'cloudFolders');
            node.addChild(node.dataSource, 'cloudTracks');
            let ms = mediaSyncDevices.getMetadataStorage(device);
            if (!ms.bypass)
                node.addChild(node.dataSource, 'cloudPlaylists');
        }
    },
    getStorageInfo(device) {
        return new Promise((resolve, reject) => {
            let service = this.getService(device);
            if (service && service.getStorageInfo) {
                service.getStorageInfo().then(function (info) {
                    resolve({
                        spaceTotal: info.spaceTotal,
                        spaceUsed: info.spaceUsed
                    });
                }, reject);
            }
            else {
                reject('getStorageInfo not assigned for service ' + service.title);
            }
        });
    },
    _removeItem(sync, path, track) {
        return this._syncAccessStorage(sync, () => {
            let service = this.getService(sync.device);
            let sourceInfo = {};
            if (track) { // it is track file (not artwork file)
                sourceInfo = cloudTools.getSourceInfo(track);
                if (!sourceInfo.path && !sourceInfo.id)
                    return dummyPromise(); //#19020
                let ms = mediaSyncDevices.getMetadataStorage(sync.device);
                ms.removeTrack(this._getTrackSyncId(sourceInfo.path || path, track));
            }
            let _path = cloudTools.normPath(sourceInfo.path || path);
            if (service.deleteItem)
                return service.deleteItem({
                    path: _path,
                    id: sourceInfo.id,
                    track: track,
                    sync: sync
                });
            else
                return dummyPromise();
        });
    },
    useSingleItemRemoval(sync) {
        let service = this.getService(sync.device);
        if (service.deleteItems)
            return false;
        else
            return true;
    },
    removeFiles(sync, filePaths, tracks) {
        return this._syncAccessStorage(sync, () => {
            let service = this.getService(sync.device);
            let ms = mediaSyncDevices.getMetadataStorage(sync.device);
            fastForEach(tracks, function (track, idx) {
                let path = getValueAtIndex(filePaths, idx);
                let sourceInfo = cloudTools.getSourceInfo(track);
                ms.removeTrack(this._getTrackSyncId(sourceInfo.path || path, track));
            }.bind(this));
            return service.deleteItems({
                paths: filePaths,
                tracks: tracks,
                sync: sync
            });
        });
    },
    removeFile(sync, filePath, track) {
        return this._removeItem(sync, filePath, track);
    },
    removeEmptyFolder(sync, path) {
        return this._removeItem(sync, path);
    },
    removeDevice(device) {
        device.removeAsync();
    },
    _uploadFile(sync, sourcePath, targetPath, progressCallback, metadata) {
        let service = this.getService(sync.device);
        if (!service.uploadFile) // like Spotify
            return dummyPromise();
        let uploader = new MediaUploader();
        function _progressCallback(e) {
            if (progressCallback)
                progressCallback(e.loaded / e.total);
            if (sync.taskProgress.terminated)
                uploader.stop();
        }
        let destination = replaceAll(app.filesystem.getPathSeparator(), cloudTools.PATH_SEPARATOR, targetPath);
        let uploadParams = {
            sourcePath: sourcePath,
            destinationPath: destination,
            service: service,
            progressCallback: _progressCallback,
            metadata: metadata
        };
        return uploader.uploadFile(uploadParams);
    },
    uploadFile(sync, file) {
        return this._uploadFile(sync, file.sourcePath, file.targetPath);
    },
    uploadTrack(sync, info, progressCallback) {
        let service = this.getService(sync.device);
        if (service.matchTrack) {
            return service.matchTrack(info.track); // like Spotify (cannot upload, only match)
        }
        else {
            cloudTools.createSourceInfo(info.track, service, {
                path: cloudTools.normPath(info.targetPath)
            }, true); // due to #15023 -- some services (like GPM) updates this info again after the upload
            info.hasRemoteCopy = true; // to mark the library track with the cloud icon after successful upload (has remote copy mark -- #15023)
            return this._uploadFile(sync, info.sourcePath, info.targetPath, progressCallback, info);
        }
    },
    _getTrackSyncId(targetPath, track) {
        return cloudTools.syncIdFromPath(targetPath); // TODO?: per cloud service, e.g. GPM doesn't support path
    },
    _syncAccessStorage(sync, callback) {
        return new Promise((resolve, reject) => {
            if (sync._metaFilesAcquired) {
                callback().then(resolve, reject);
            }
            else {
                sync.readMetaFiles(sync.device, sync).then(() => {
                    sync._metaFilesAcquired = true;
                    callback().then(resolve, reject);
                }, reject);
            }
        });
    },
    updateTrack(sync, info) {
        return this._syncAccessStorage(sync, () => {
            // update/write track metadata during sync  
            let ms = mediaSyncDevices.getMetadataStorage(sync.device);
            if (!sync.taskProgress.terminated) {
                let service = this.getService(sync.device);
                if (service && service.modifyTrack)
                    return service.modifyTrack(info.track); // e.g. GPM utilizes own modifyTrack
                else
                    return ms.updateTrack(this._getTrackSyncId(info.targetPath, info.track), info.targetPath, info.track);
            }
            else
                return dummyPromise();
        });
    },
    isModifiableTrack(track) {
        let res = false;
        let sourceInfo = cloudTools.getSourceInfo(track);
        let device = mediaSyncDevices.getById(sourceInfo.device_id);
        if (device && device.handlerID == 'cloud') {
            let sett = mediaSyncDevices.getCustomSettings(device);
            if (sett.syncMetadata != false || !_utils.isLibraryTrack(track)) {
                if (this.metadataStorageEnabled(device))
                    res = true;
                else {
                    let service = this.getService(device);
                    if (service && service.modifyTrack)
                        res = true;
                }
            }
        }
        return res;
    },
    modifyTrack(track) {
        // a track was modified by user right now (e.g. rated in tracklist), check whether it is "our" cloud track and update the metadata storage
        let sourceInfo = cloudTools.getSourceInfo(track);
        if (sourceInfo.device_id) {
            let device = mediaSyncDevices.getById(sourceInfo.device_id);
            if (device) {
                let sett = mediaSyncDevices.getCustomSettings(device);
                if (sett.syncMetadata != false || !_utils.isLibraryTrack(track)) {
                    let metadataStorage = mediaSyncDevices.metadataStorages[sourceInfo.device_id];
                    if (metadataStorage && !metadataStorage.bypass) {
                        metadataStorage.updateTrack(this._getTrackSyncId(sourceInfo.path, track), sourceInfo.path, track);
                        metadataStorage.sheduledFlush(1000);
                    }
                    let service = this.getService(device);
                    if (service && service.modifyTrack)
                        service.modifyTrack(track); // e.g. GPM utilizes own modifyTrack
                }
            }
        }
    },
    uploadPlaylist(sync, playlist) {
        let service = this.getService(sync.device);
        let ms = mediaSyncDevices.getMetadataStorage(sync.device);
        if (service.uploadPlaylist) {
            // services that supports playlists (Google Play Music)
            return service.uploadPlaylist(sync, playlist);
        }
        else {
            return new Promise((resolve, reject) => {
                let sett = JSON.parse(sync.device.getPlaylistSettingsJSON());
                let saveM3U = sett.generateFor.playlists;
                let _uploadM3U = () => {
                    if (saveM3U /*&& (playlist.lastModified > sync.device.lastSyncTime)*/ && (playlist.sourcePath != ''))
                        this._uploadFile(sync, playlist.sourcePath, playlist.targetPath).then(resolve, reject); // #16561
                    else
                        resolve();
                };
                if (!ms.bypass) {
                    // services that are folder based and supports meta files (DropBox, Google Drive, OneDrive)
                    this._syncAccessStorage(sync, () => {
                        playlist.trackSyncIDs.clear();
                        listForEach(playlist.tracks, (info) => {
                            playlist.trackSyncIDs.add(this._getTrackSyncId(info.targetPath, info.track));
                        });
                        return ms.updatePlaylist(playlist);
                    }).then(_uploadM3U, reject);
                }
                else {
                    _uploadM3U();
                }
            });
        }
    },
    getFolderContent(device, path) {
        let service = this.getService(device);
        return service.listContent(path, null, false /* non-recursive*/, true /*all files*/);
    },
    getStreamUrl(device, file) {
        let service = this.getService(device);
        return cloudTools.getStreamUrl(file, service);
    },
    getStreamUrls(device, files) {
        let service = this.getService(device);
        return cloudTools.getStreamUrls(files, service);
    },
    getArtworkUrl(device, track) {
        return new Promise((resolve, reject) => {
            let service = this.getService(device);
            let sourceInfo = cloudTools.getSourceInfo(track);
            if (sourceInfo.artwork_link)
                resolve(sourceInfo.artwork_link); // e.g. GPM uses artwork_link
            else if (sourceInfo.path && (service.folder_based != false) && service.isAuthorized()) {
                let folderPath = cloudTools.removeLastPathPart(sourceInfo.path);
                let list = app.utils.createTracklist();
                service.listContent(folderPath, list, false /* non-recursive*/, true /* all files*/).then(() => {
                    let foundImage = false;
                    fastForEach(list, (file) => {
                        if (!foundImage && inArray(cloudTools.getFileExt(file.title).toLowerCase(), ['thm', 'jpg', 'png', 'bpm'])) {
                            foundImage = true;
                            service.getStreamUrl(cloudTools.getSourceInfo(file)).then((url) => resolve(url), reject);
                        }
                    });
                    if (!foundImage)
                        reject('no image file');
                }, reject);
            }
            else
                reject('no artwork link');
        });
    },
    PATH_SEPARATOR: cloudTools.PATH_SEPARATOR,
    getMetadataDirectory(metadataStorage) {
        return this.PATH_SEPARATOR + 'MediaMonkey' + this.PATH_SEPARATOR + 'meta_files' + this.PATH_SEPARATOR + 'v' + metadataStorage.getVersion();
    },
    startSyncing(sync, mode) {
        let service = this.getService(sync.device);
        if (service.onSyncStart)
            service.onSyncStart();
        if (service.folder_based == false) // e.g. GPM
            sync.device.isFolderBased = false;
        // Read the meta files and acquire the sync lock once needed,
        // see _syncAccessStorage() that is used on demand
        // this prevents from unnecessary meta files reading and sync lock acquiring when there is nothing to sync        
        sync._metaFilesAcquired = false;
        return new Promise((resolve, reject) => {
            let _fail = (err) => {
                logger.debug('MediaSync: ' + err);
                if (!sync.isScheduled) {
                    messageDlg(sprintf(_('There was a problem syncing "%s".') + ' ' + _('There is a problem with your internet connection.'), escapeXml(sync.device.name)), 'Error', ['btnHelp', 'btnOK'], {
                        defaultButton: 'btnOK'
                    }, function (result) {
                        if (result.btnID === 'btnHelp') {
                            window.uitools.openWeb('https://www.mediamonkey.com/upnp-client-connect-error');
                        }
                    });
                }
                reject(sync._ERR_TERMINATED /* to not force crash report */);
            };
            app.utils.web.isConnectedToInternetAsync().then(resolve, _fail);
        });
    },
    finishSyncing(sync, mode) {
        let service = this.getService(sync.device);
        if (service.onSyncEnd)
            service.onSyncEnd();
        if (sync._metaFilesAcquired)
            return sync.exportMetaFiles(sync);
        else
            return dummyPromise(); // e.g. when there was nothing to sync
    },
    getContentSignature(device, last_signature) {
        let service = this.getService(device);
        return new Promise(function (resolve, reject) {
            if (service.isAuthorized()) {
                if (service.getContentSignature)
                    service.getContentSignature(last_signature).then(resolve, function (err) {
                        logger.debug('getContentSignature error: ' + err);
                        resolve(undefined);
                    });
                else
                    resolve(undefined);
            }
            else {
                reject('service not authorized');
            }
        });
    },
    __assignTracksMetadataCachedVersion(device, list) {
        return new Promise((resolve, reject) => {
            // this assigns the content from locally 'cached' metadata files (might be outdate)
            let ms = mediaSyncDevices.getMetadataStorage(device);
            ms.readContent().then(() => {
                ms.assignTracklistMetadata(list).then(resolve);
            });
        });
    },
    _assignTracksMetadata(device, list) {
        return new Promise((resolve, reject) => {
            // the first round assign the content from locally 'cached' metadata files (to speed up):
            this.__assignTracksMetadataCachedVersion(device, list).then(() => {
                list.notifyChanged();
                ODS(device.name + ': metadata read from cached meta files');
                // and now check the 'real' server files and update (if needed):
                let sync = new MediaSync(device);
                sync.readMetaFiles(device).then((meta_files_exist) => {
                    if (meta_files_exist) {
                        ODS(device.name + ': our metadata files exist, use it');
                        let ms = mediaSyncDevices.getMetadataStorage(device);
                        ms.assignTracklistMetadata(list).then(function () {
                            list.notifyChanged();
                            list.notifyLoaded();
                            resolve(list);
                        });
                    }
                    else {
                        list.notifyLoaded();
                        resolve(list);
                    }
                });
            });
        });
    },
    scanContent(device, fillList, purpose) {
        let service = this.getService(device);
        return new Promise((resolve, reject) => {
            if (service.isAuthorized()) {
                let list = fillList || app.utils.createTracklist();
                list.beginUpdate();
                ODS(service.title + ' - scanContent: scan the real cloud content at first');
                service.listContent('' /* root */, list, true /* recursive == list all contents in subfolders */).then((content) => {
                    if (list.count == 0)
                        list.addList(content.files);
                    if (purpose == 'scan' || purpose == 'sync') {
                        // enable notifications just for listing, notifications during scan and sync is significant performance leak
                        fastForEach(list, (track) => {
                            track.dontNotify = true;
                        });
                    }
                    this._assignTracksMetadata(device, list).then((list) => {
                        list.endUpdate();
                        resolve(list);
                    });
                }, (err) => {
                    list.endUpdate();
                    reject(err);
                });
            }
            else {
                reject('service not authorized');
            }
        });
    },
    scanContentForSync(device) {
        return new Promise((resolve, reject) => {
            let ms = mediaSyncDevices.getMetadataStorage(device);
            if (ms.bypass)
                resolve();
            else {
                this.scanContent(device, null, 'sync').then((list) => {
                    list.whenLoaded().then(() => resolve(list));
                }, () => resolve(null));
            }
        });
    },
    listPlaylists(device, parent_playlist, params) {
        let service;
        if (parent_playlist && parent_playlist.service)
            service = parent_playlist.service;
        else
            service = this.getService(device);
        return new Promise(function (resolve, reject) {
            let listFunct;
            if (service.listPlaylists)
                listFunct = service.listPlaylists.bind(service);
            else {
                let ms = mediaSyncDevices.getMetadataStorage(device);
                if (!ms.bypass)
                    listFunct = ms.listPlaylists.bind(ms);
            }
            if (listFunct) {
                listFunct(parent_playlist, params).then(function (content) {
                    for (let i = 0; i < content.playlists.count; i++) {
                        let playlist = content.playlists.getValue(i);
                        playlist.persistentInfo = {
                            id: playlist.id
                        };
                        playlist.service = service;
                    }
                    resolve(content.playlists);
                }, function (err) {
                    ODS(service.title + ': ' + err);
                    reject();
                });
            }
            else {
                reject('no cloud playlists filling method');
            }
        });
    },
    listPlaylistContent(device, playlist) {
        let list = app.utils.createTracklist();
        let service = playlist.service || this.getService(device);
        let listFunct;
        if (service.listPlaylistContent) {
            listFunct = service.listPlaylistContent.bind(service);
            list.globalModifyWatch = true; // to update highlighting of playing track etc.
        }
        else {
            let ms = mediaSyncDevices.getMetadataStorage(device);
            if (!ms.bypass) {
                listFunct = ms.listPlaylistContent.bind(ms);
                list.whenLoaded().then(function () {
                    fastForEach(list, function (track) {
                        cloudTools.createSourceInfo(track, service, {
                            path: cloudTools.normPath(track.path)
                        });
                        track.dontNotify = true;
                        track.path = ''; // for clouds we are getting streamURL on demand (and leaving path empty)
                        track.dontNotify = false;
                    });
                    list.globalModifyWatch = true; // to update highlighting of playing track etc.
                });
            }
        }
        if (service.isAuthorized() && listFunct)
            listFunct(playlist, list);
        else
            list.notifyLoaded();
        return list;
    },
    tabVisible(page_id, device) {
        if (!window.uitools.getCanEdit())
            return inArray(page_id, ['summary']);
        else {
            let service = this.getService(device);
            if (service.configTabVisible) {
                return service.configTabVisible(page_id);
            }
            else
                return inArray(page_id, ['summary', 'syncToDevice', 'options']);
        }
    },
    tabName(page_id) {
        if (page_id == 'summary')
            return _('Remote content');
        if (page_id == 'syncToDevice')
            return _('Library content');
    },
    getVisibleOptionsPanels(device) {
        let service = this.getService(device);
        if (service.getVisibleOptionsPanels) {
            return service.getVisibleOptionsPanels();
        }
        else
            return ['pnl_DeviceProfile', 'pnl_AutoConversion', 'pnl_Playlists', 'pnl_FileLocations', 'pnl_Tagging'];
    },
    configBoxVisible(box_id, device) {
        let service = this.getService(device);
        if (service.configBoxVisible)
            return service.configBoxVisible(box_id); // e.g. Spotify does not support deletion
        else
            return true;
    },
    _scan_interval_names() {
        let list = newStringList();
        list.add(_('Manual'));
        list.add(_('At startup'));
        list.add(_('Hourly'));
        list.add(_('2x / day'));
        list.add(_('Daily'));
        list.add(_('Weekly'));
        list.add(_('Monthly'));
        return list;
    },
    _scan_intervals() {
        let HOUR = 60 * 60 * 1000;
        return [100 * 365 * 24 * HOUR,
            1,
            HOUR,
            12 * HOUR,
            24 * HOUR,
            7 * 24 * HOUR,
            30 * 24 * HOUR];
    },
    configPage: {
        summary: {
            load(device, config) {
                let service = this.getService(device);
                if (!service.isAuthorized()) {
                    let headbox = config.qChild('summaryHeadingBox');
                    headbox.innerHTML = '<label data-id="linkSignIn" class="hotlink"></label>';
                    let lbl = config.qChild('linkSignIn');
                    lbl.innerText = _('Sign in') + '...';
                    config.localListen(lbl, 'click', function () {
                        if (!service.isAuthorized() && !service.isAuthorizing)
                            cloudTools.authorize(service).then(function () {
                                config.refresh(); // to refresh UI after authorization
                            });
                    });
                }
                else {
                    let headbox = config.qChild('summaryHeadingBox');
                    headbox.innerHTML =
                        '<div class="flex row">' +
                            '  <div class="flex column verticalCenter">' +
                            '    <img data-id="userPhoto" class="userIcon">' +
                            '  </div>' +
                            '  <div class="flex column">' +
                            '    <label data-id="linkSignOut" class="hotlink">Sign out</label>' +
                            '    <label data-id="lblUserInfo" class="textEllipsis"></label>' +
                            '  </div>' +
                            '</div>';
                    initializeControls(headbox);
                    let lblInfo = config.qChild('lblUserInfo');
                    let userPhoto = config.qChild('userPhoto');
                    setVisibilityFast(userPhoto, false);
                    cloudTools.getUserInfo(service).then(function (info) {
                        if (info && document.body.contains(userPhoto)) {
                            lblInfo.innerText = info.user;
                            if (info.email)
                                lblInfo.innerText = lblInfo.innerText + ' (' + info.email + ')';
                            if (info.photo) {
                                setVisibilityFast(userPhoto, true);
                                userPhoto.src = info.photo;
                            }
                        }
                    });
                    config.localListen(config.qChild('linkSignOut'), 'click', function () {
                        cloudTools.unauthorize(service).then(function () {
                            mediaSyncDevices.terminateSync(device);
                            config.refresh();
                        });
                    });
                    setVisibility(config.qChild('linkSignOut'), window.uitools.getCanEdit());
                    // layout proposals in Mantis issue #14983
                    let box = config.qChild('summaryOptionsBox');
                    let devicename = escapeXml(device.name);
                    let scan_box_text = sprintf(_('Scan \'%s\' content to the local database'), devicename);
                    let scan_box_tooltip = sprintf(_('On sync, the database is updated with links to files and playlists from \'%s\''), devicename);
                    let add_links_text = _('Only include content that matches files already in the database');
                    let add_links_tooltip = sprintf(_('On sync, the database is only updated with links to files & playlists from \'%s\' that match files already in the database'), devicename);
                    let download_links_text = sprintf(_('Download \'%s\' content that is not accessible locally'), devicename);
                    let download_links_tooltip = sprintf(_('Downloads files and playlists from \'%s\' that are not accessible via the local drive or network'), devicename);
                    let update_metadata_text = sprintf(_('Sync \'%s\' metadata to the Library'), devicename);
                    let update_metadata_tooltip = _('Update metadata for matching tracks and playlists');
                    box.innerHTML =
                        '<div>' +
                            '  <div data-id="chbScanToLib" data-control-class="Checkbox" data-tip="' + scan_box_tooltip + '">' + scan_box_text + '</div>' +
                            '</div>' +
                            '<div data-id="boxScan" data-control-class="Control" class="left-indent uiRows">' +
                            '  <div>' +
                            '    <div data-id="chbExcludeNewFiles" data-control-class="Checkbox" data-tip="' + add_links_tooltip + '">' + add_links_text + '</div>' +
                            '  </div>' +
                            '  <div>' +
                            '    <div data-id="chbDwlToLib" data-control-class="Checkbox" data-tip="' + download_links_tooltip + '">' + download_links_text + '</div>' +
                            '  </div>' +
                            '  <div>' +
                            '    <div data-id="chbSyncMetadata" data-control-class="Checkbox" data-tip="' + update_metadata_tooltip + '">' + update_metadata_text + '</div>' +
                            '  </div>' +
                            '</div>' +
                            '<div>' +
                            '  <label>Sync schedule:</label>' +
                            '  <div data-id="cbScanInterval" class="inline" data-control-class="Dropdown" data-init-params="{readOnly: true, filtering: false, preserveSpaces: true}"></div> ' +
                            '</div>';
                    initializeControls(box);
                    setVisibility(box, window.uitools.getCanEdit());
                    let sett = mediaSyncDevices.getCustomSettings(device);
                    let chbScanToLib = config.qChild('chbScanToLib');
                    chbScanToLib.controlClass.checked = sett.scanToLib;
                    let chbExcludeNewFiles = config.qChild('chbExcludeNewFiles');
                    if (sett.excludeNewFiles != undefined)
                        chbExcludeNewFiles.controlClass.checked = sett.excludeNewFiles;
                    else
                        chbExcludeNewFiles.controlClass.checked = false;
                    let chbDwlToLib = config.qChild('chbDwlToLib');
                    chbDwlToLib.controlClass.checked = sett.downloadToLib;
                    setVisibility(chbDwlToLib, resolveToValue(service.downloadSupported, true));
                    bindDisabled2Checkbox(chbDwlToLib, chbScanToLib);
                    bindDisabled2Checkbox(config.qChild('boxScan'), chbScanToLib);
                    let focIdx = 0;
                    let ints = this._scan_intervals();
                    for (let i = 0; i < ints.length; i++) {
                        if (ints[i] == sett.scan_interval_ms) {
                            focIdx = i;
                            break;
                        }
                    }
                    let cbScanInterval = config.qChild('cbScanInterval');
                    cbScanInterval.controlClass.dataSource = this._scan_interval_names();
                    cbScanInterval.controlClass.focusedIndex = focIdx;
                    let chbSyncMetadata = config.qChild('chbSyncMetadata');
                    chbSyncMetadata.controlClass.checked = device.biDirSyncMetadata;
                    if (service.configBoxVisible)
                        setVisibility(chbSyncMetadata, service.configBoxVisible('chbSyncMetadata'));
                    else
                        setVisibility(chbSyncMetadata, true);
                }
            },
            save(device, config) {
                device.biDirSyncMetadata = config.qChild('chbSyncMetadata').controlClass.checked;
                mediaSyncDevices.changeLibraryScanSettings(device, {
                    runAutoSyncAfterScan: true,
                    scanToLib: config.qChild('chbScanToLib').controlClass.checked,
                    scan_interval_ms: this._scan_intervals()[config.qChild('cbScanInterval').controlClass.focusedIndex],
                    downloadToLib: config.qChild('chbDwlToLib').controlClass.checked,
                    excludeNewFiles: config.qChild('chbExcludeNewFiles').controlClass.checked
                });
            },
        }
    },
    addNewProfile(service) {
        return new Promise(function (resolve, reject) {
            cloudTools.authorize(service).then(function () {
                // add new sync storage target (profile):
                let profile_id = service.id + generateUUID();
                mediaSyncDevices.register({
                    id: profile_id,
                    name: service.title,
                    handlerID: 'cloud',
                    serviceInfo: {
                        serviceID: service.id,
                        authData: cloudTools.getAuthData(service)
                    }
                });
                mediaSyncDevices.initRegistered().then1(function () {
                    app.devices.getDeviceAsync(profile_id, service.title).then(function (device) {
                        resolve(device);
                    }, reject);
                });
            });
        });
    },
    getAddStorageMenu() {
        let _this = this;
        let res = [];
        let keys = Object.keys(window.cloudServices);
        for (let i = 0; i < keys.length; i++) {
            let service = copyObject(window.cloudServices[keys[i]]);
            service.id = keys[i];
            res.push({
                title: service.title,
                service: service,
                icon: function () {
                    if (this.service.icon)
                        return this.service.icon;
                    else
                        return 'cloud';
                },
                execute: function () {
                    _this.addNewProfile(this.service);
                }
            });
        }
        return res;
    }
};
window.mediaSyncHandlers['usb'] = {
    icon(device) {
        /*if (device.scanning)
            return 'progress' // LS: showing progress like this (instead of real icon) is rather confusing and could remain on navbar indefinetely
        else */
        if (device.connected)
            return 'usb_connected';
        else
            return 'device';
    },
    getStatus(device) {
        if (!device.enabled)
            return _('Disabled');
        else if (device.scanning)
            return _('Scanning');
        else if (device.connected)
            return _('Connected');
        else
            return _('Disconnected');
    },
    addCustomNodes(node) {
        let device = node.dataSource;
        if (device.connected) {
            node.addChild(device, 'deviceMusic');
            node.addChild(device, 'deviceVideos');
            node.addChild(device, 'deviceAudiobooks');
            node.addChild(device, 'devicePodcasts');
            if (device.hasFolderSupport)
                node.addChild(device, 'deviceFolders');
            if (device.hasPlaylistSupport)
                node.addChild(device, 'devicePlaylists');
        }
    },
    metadataStorageEnabled(device, metadataStorage) {
        metadataStorage.db_dump_items_treshold = 0; // in order to always flush into DB (and never to delta.JSON)
        let devtype = device.usbType();
        if ((devtype == 'Android' || devtype == 'Generic USB') && (device.profile_id != ''))
            return true; // #14105
        else
            return false;
    },
    getFolderContent(device, path) {
        let pathDelim = this.PATH_SEPARATOR;
        return new Promise(function (resolve, reject) {
            let pathParts = removeFirstSlash(path).split(pathDelim);
            let processPathPart = function (index, folder) {
                let list;
                if (index == 0)
                    list = device.getFolderList('content');
                else
                    list = folder.getFolderList();
                list.whenLoaded().then(function () {
                    let found;
                    list.locked(function () {
                        for (let i = 0; i < list.count; i++) {
                            let folder = list.getValue(i);
                            if (folder.title == pathParts[index]) {
                                found = true;
                                if (index < pathParts.length - 1)
                                    processPathPart(index + 1, folder);
                                else {
                                    let files = folder.getTracklist();
                                    files.whenLoaded().then(function () {
                                        resolve({
                                            files: files
                                        });
                                    });
                                }
                                break;
                            }
                        }
                    });
                    if (!found)
                        resolve({
                            files: app.utils.createTracklist()
                        });
                });
            };
            processPathPart(0);
        });
    },
    PATH_SEPARATOR: app.filesystem.getPathSeparator(),
    getMetadataDirectory(metadataStorage) {
        return this.PATH_SEPARATOR + 'MediaMonkey' + this.PATH_SEPARATOR + 'meta_files' + this.PATH_SEPARATOR + 'v' + metadataStorage.getVersion();
    },
    startSyncing(sync, mode) {
        return sync.readMetaFiles(sync.device, sync);
    },
    finishSyncing(sync, mode) {
        return sync.exportMetaFiles(sync);
    },
    showContent(device) {
        return device.connected;
    },
    syncEnabled(device) {
        return device.connected && device.enabled;
    },
    _getTrackSyncId(targetPath, track) {
        //return track.id.toString(); // we used MMW's track id in MMA, but now seems better to unify this with cloud storages and use targetPath as the identificator
        return cloudTools.syncIdFromPath(targetPath);
    },
    removeFiles(sync, filePaths, tracks) {
        let ms = mediaSyncDevices.getMetadataStorage(sync.device);
        fastForEach(tracks, function (track, idx) {
            let path = getValueAtIndex(filePaths, idx);
            ms.removeTrack(this._getTrackSyncId(path, track));
        }.bind(this));
        return sync.process.removeFiles(filePaths);
    },
    uploadFile(sync, file) {
        return sync.process.uploadFile(file.sourcePath, file.targetPath);
    },
    downloadFile(sync, file) {
        return sync.process.downloadFile(file.sourcePath, file.targetPath, sync.taskProgress);
    },
    uploadTrack(sync, info, progressCallback) {
        progressCallback(0);
        return sync.process.uploadTrack(info.sourcePath, info.targetPath, info, sync.taskProgress);
    },
    updateTrack(sync, info) {
        return sync.process.updateTrack(info).then(function () {
            if (sync.taskProgress.terminated)
                return dummyPromise();
            let ms = mediaSyncDevices.getMetadataStorage(sync.device);
            return ms.updateTrack(this._getTrackSyncId(info.targetPath, info.track), info.targetPath, info.track);
        }.bind(this));
    },
    uploadPlaylist(sync, playlist) {
        return sync.process.uploadPlaylist(playlist).then(() => {
            let ms = mediaSyncDevices.getMetadataStorage(sync.device);
            playlist.trackSyncIDs.clear();
            fastForEach(playlist.tracks, (info) => {
                let track = sync._getFastTrack(info);
                playlist.trackSyncIDs.add(this._getTrackSyncId(info.targetPath, track));
            });
            return ms.updatePlaylist(playlist);
        });
    },
    tabVisible(page_id, device) {
        if (!window.uitools.getCanEdit())
            return inArray(page_id, ['summary']);
        else {
            let ar = ['summary', 'syncToDevice', 'options'];
            if (device.canBiDiSynch())
                ar.push('syncFromDevice');
            return inArray(page_id, ar);
        }
    },
    getVisibleOptionsPanels(device) {
        let ar = ['pnl_DeviceProfile', 'pnl_AutoConversion', 'pnl_Tagging'];
        if (!device.is_iPodType()) {
            ar.push('pnl_FileLocations');
            ar.push('pnl_Playlists');
        }
        return ar;
    },
    contentSelectionText: function (device) {
        return _('Choose which files to keep synced:');
    },
    configPage: {
        summary: {
            load: function (device, config) {
                let hBox = config.qChild('summaryHeadingBox');
                hBox.innerHTML =
                    '<div class="fill"></div>' +
                        '<label data-id="lblRecommendation" class="noMargin"></label>' +
                        '<label data-id="lblRecommendation2" class="noMargin">' + _('Once installed, you may initiate Wi-Fi sync from the device (USB sync is not reliable on some devices).') + '</label>';
                initializeControls(hBox);
                let box = config.qChild('summaryOptionsBox');
                box.innerHTML =
                    '<div data-id="boxWiFiSync">' +
                        '    <div data-id="chbWiFiSync" data-control-class="Checkbox" data-tip="' + _('Allows remote MediaMonkey clients to sync via Wi-Fi, if they\'ve also been granted rights to library content (by default, initial attempts by a device to connect will trigger a prompt).') + '"></div>' +
                        '    <div data-id="linkSyncServer" class="hotlink inline"></div>' +
                        '</div>' +
                        '<div data-id="chbScanOnConnect" data-control-class="Checkbox" data-tip="' + _('Once scanned, MediaMonkey can accurately display the contents of the device. It may take awhile for some devices, though.') + '">' + _('Scan as soon as the device is connected') + '</div>' +
                        '<div data-id="chbSyncOnConnect" data-control-class="Checkbox" data-tip="' + _('This initiates an auto-sync whenever the device is plugged into the PC') + '">' + _('Auto-Sync as soon as the device is connected') + '</div>' +
                        '<div data-id="chbAutoUnmount" data-control-class="Checkbox" data-tip="' + _('Causes the device to automatically disconnect after auto-sync has completed.') + '">' + _('Automatically unmount device after Auto-Sync') + '</div>' +
                        '</div>';
                initializeControls(box);
                setVisibility(box, window.uitools.getCanEdit());
                config.qChild('chbScanOnConnect').controlClass.checked = device.scanOnConnect;
                config.qChild('chbSyncOnConnect').controlClass.checked = device.syncOnConnect;
                config.qChild('chbAutoUnmount').controlClass.checked = device.autoUnmount;
                config.qChild('chbWiFiSync').controlClass.text = sprintf(_('Allow %s to remotely sync with the'), '\'' + device.name + '\'');
                config.qChild('chbWiFiSync').controlClass.checked = device.allowWifiSync;
                let sett = mediaSyncDevices.getCustomSettings(device);
                if (sett.wifi_sync_supported == undefined) {
                    sett.wifi_sync_supported = (device.usbType() == 'Android');
                    mediaSyncDevices.setCustomSettings(device, sett);
                }
                setVisibility(config.qChild('boxWiFiSync'), sett.wifi_sync_supported);
                setVisibility(config.qChild('lblRecommendation'), sett.wifi_sync_supported);
                setVisibility(config.qChild('lblRecommendation2'), sett.wifi_sync_supported);
                config.linkSyncServer = config.qChild('linkSyncServer');
                if (sett.wifi_sync_supported) {
                    let serverList = app.sharing.getServers();
                    serverList.whenLoaded().then(function () {
                        serverList.locked(function () {
                            assert(serverList.count, 'At least one media server expected');
                            config.server = serverList.getValue(0);
                            config.linkSyncServer.innerText = config.server.name;
                            config.localListen(config.linkSyncServer, 'click', function () {
                                uitools.openDialog('dlgServerConfig', {
                                    modal: true,
                                    server: config.server
                                });
                            });
                        });
                    });
                }
                config.qChild('lblRecommendation').innerHTML = sprintf(_('To sync with Android devices, %s should be installed for improved sync performance.'), ['<div data-id="linkMMA" class="hotlink inline">MediaMonkey for Android</div>']);
                let linkMMA = config.qChild('linkMMA');
                if (linkMMA) // correctly translated string above                    
                    config.localListen(linkMMA, 'click', function () {
                        window.uitools.openWeb('https://www.mediamonkey.com/android');
                    });
            },
            save: function (device, config) {
                device.scanOnConnect = config.qChild('chbScanOnConnect').controlClass.checked;
                device.syncOnConnect = config.qChild('chbSyncOnConnect').controlClass.checked;
                device.autoUnmount = config.qChild('chbAutoUnmount').controlClass.checked;
                device.allowWifiSync = config.qChild('chbWiFiSync').controlClass.checked;
            },
        }
    }
};
window.mediaSyncHandlers['server'] = {
    icon(device) {
        return 'server';
    },
    syncEnabled(device) {
        let key = device.id;
        this._running_servers = this._running_servers || {};
        this._checkServerIsRunning(device).then((res) => {
            this._running_servers[key] = true;
        }, (err) => {
            this._running_servers[key] = false;
        });
        return (this._running_servers[key] != false);
    },
    //hideSyncButton: true,
    showContent(device) {
        return true;
    },
    initProfileDefaults(device) {
        // NPM's music-metadata package reads the artwork from tags
        // but copy also images to file folder (for the images that are not in the file tag)
        // MMS already supports linked images
        device.saveAAToFolder = true;
        device.syncAAMask = 'folder.jpg';
        //device.saveAAToTag = true;
        let convertConfig = device.autoConvertConfig;
        // convert rules should be all disabled by default for cloud profiles (so that user isn't degrading his library once he decides to migrate to the cloud) - #14272 - item 9)
        convertConfig.rules.setAllChecked(false);
        convertConfig.setSupportedFormatsList(app.utils.createSharedList()); // Unknown (all formats)
        device.autoConvertConfig = convertConfig;
        // set default masks to be merged with the root (the first folder of configured MMS collections (music, video)
        // note that we are not using %P here (to preserve original path), because:
        //      1) tracks from GPM has no original path 
        //      2) there is no general way how to merge original paths from various drives/locations
        device.setTargetMask('music', '\\%R - %L\\%02T $Left(%A,20) - %S');
        device.setTargetMask('classical', '\\Classical\\%C\\%L\\%02T $Left(%A,20) - %S');
        device.setTargetMask('audiobook', '\\Audiobooks\\%L - %A\\%02T %S');
        device.setTargetMask('podcast', '\\Podcasts\\%ZU\\%ZP %S');
        device.setTargetMask('videopodcast', '\\Podcasts\\%ZU\\%ZP %S');
        device.setTargetMask('video', '\\%S - %Y');
        device.setTargetMask('musicvideo', '\\Music Video\\%R - %L\\%02T %S');
        device.setTargetMask('tv', '\\TV\\%ZV\\%02ZY %S');
        return this._showMigrationWizard(device);
    },
    _showMigrationWizard(device) {
        return new Promise(function (resolve, reject) {
            uitools.openDialog('dlgMigrateWizard', {
                modal: true,
                device: device
            }, (dlg) => {
                if (dlg.modalResult == 1)
                    new MediaSync(device).runAutoSync(true);
                resolve(dlg.modalResult);
            });
        });
    },
    _showContentSelectionDlg(device) {
        return new Promise(function (resolve, reject) {
            uitools.openDialog('dlgDeviceConfig', {
                modal: true,
                device: device,
                contentSelectionMode: true
            }, (dlg) => {
                resolve(dlg.modalResult);
            });
        });
    },
    checkProfileUpdate(device) {
        if (app.sharing.getIsInitialized() /* #17638/3a */) {
            this._getServer(device).then(function (res) {
                let server = res.server;
                if (device.imagePath != server.iconUrl || server.name != device.name) {
                    device.name = server.name;
                    device.imagePath = server.iconUrl;
                    device.commitAsync();
                }
            });
        }
    },
    configUI(device) {
        return {
            disabledEdit: ['name', 'icon']
        };
    },
    addCustomNodes(node) {
        let device = node.dataSource;
        this._getServer(device, true).then(function (res) {
            node.addChild(device, 'cloudTracks');
            nodeUtils.fillFromList(node, res.server.getContainers(), 'serverContainer');
        }, (err) => {
            // server is not running
        });
    },
    isModifiableTrack(track) {
        let url = track.path;
        let sourceInfo = cloudTools.getSourceInfo(track);
        if (sourceInfo && sourceInfo.sourceType == 'server' && sourceInfo.sync_id) {
            return true; // MMS track scanned into lib or accessed via /api/tracks
        }
        else {
            // just UPnP track from MMS (to be deprecated)
            let ar = app.getValue('SYNCABLE_UUIDS', []);
            for (let i = 0; i < ar.length; i++) {
                let uuid = ar[i];
                if (isURLPath(url) && (url.indexOf(uuid) > 0)) // it is our writeable server
                    return true;
            }
        }
    },
    modifyTrack(track) {
        // a track was modified by user right now (e.g. rated in tracklist), check whether it is "our" server track and update the metadata on the server        
        let path = track.path;
        if (this.isModifiableTrack(track)) {
            track.getLyricsAsync().then(() => {
                let sourceInfo = cloudTools.getSourceInfo(track);
                if (sourceInfo && sourceInfo.sourceType == 'server' && sourceInfo.sync_id) {
                    // MMS track scanned into lib or accessed via MMS > All tracks
                    let device = mediaSyncDevices.getById(sourceInfo.device_id);
                    if (device) {
                        let _fail = (err) => {
                            ODS('MMS: modifyTrack error: ' + err);
                            // track could not be modified right now (as server is down)
                            // let's plan the update later:
                            mediaSyncDevices.modifyCustomSettings(device, {
                                syncNeeded: true
                            });
                        };
                        this._getServer(device).then((res) => {
                            let metas = this._createTrackMetas(track);
                            metas.sync_id = sourceInfo.sync_id;
                            this._updateTrackMetas(metas, res.server.baseUrl, res.auth).then(() => { }, _fail);
                        }, _fail);
                    }
                }
                else {
                    // just UPnP track from MMS (to be deprecated)
                    app.utils.web.transformPathUUID2URL(path).then((url) => {
                        let s = '/cds/content/';
                        let idx = url.indexOf(s);
                        if (idx > 0) {
                            let url_base = url.substr(0, idx);
                            let metas = this._createTrackMetas(track);
                            metas.db_id = removeFileExt(url.substr(idx + s.length));
                            assert(metas.db_id && !isNaN(metas.db_id), 'Metas.db_id number expected: ' + metas.db_id);
                            this._updateTrackMetas(metas, url_base, {
                                token: 'dummy'
                            });
                        }
                    });
                }
            });
        }
    },
    handleNewTrack(track) {
        // a new track was added to library right now
        ODS('MMS: handleNewTrack: ' + track.title);
        clearTimeout(this._newTrackTm);
        this._newTrackTm = setTimeout(() => {
            mediaSyncDevices.getBy({
                handler: 'server'
            }).then((list) => {
                listForEach(list, function (device) {
                    mediaSyncDevices.modifyCustomSettings(device, {
                        syncNeeded: true
                    });
                });
            });
        }, 2000);
    },
    _updateTrackMetas(metas, url_base, auth) {
        return new Promise((resolve, reject) => {
            let contentJSON = JSON.stringify(metas);
            cloudTools.request({
                method: 'POST',
                uri: url_base + '/api/update',
                content: contentJSON,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': auth.token
                },
                doneCallback(status, responseText) {
                    logger.debug('Track update on the server: HTTP status: ' + status + ': ' + responseText + ', track: ' + metas.title + ' id:' + metas.db_id || metas.sync_id);
                    if (status == 200) {
                        resolve(responseText);
                    }
                    else {
                        reject('Track has failed to update: ' + status + ' ' + responseText);
                    }
                }
            });
        });
    },
    updateTrack(sync, info) {
        // update/write track metadata during sync      
        return new Promise((resolve, reject) => {
            this._getServer(sync.device).then((res) => {
                if (!sync.taskProgress.terminated) {
                    let metas = this._createTrackMetas(info.track);
                    metas.sync_id = this._getSyncIdForTrack(sync, info);
                    this._updateTrackMetas(metas, res.server.baseUrl, res.auth).then((res) => {
                        if (res.startsWith('{')) { // from MMS 0.1.7
                            let objRes = JSON.parse(res);
                            if (objRes.sync_id)
                                info.track.sync_id = objRes.sync_id;
                        }
                        resolve();
                    }, reject);
                }
                else {
                    reject();
                }
            }, reject);
        });
    },
    _getResources(device, track) {
        return new Promise((resolve, reject) => {
            this._getServer(device).then((res) => {
                let sourceInfo = cloudTools.getSourceInfo(track);
                cloudTools.request({
                    method: 'POST',
                    uri: res.server.baseUrl + '/api/get-resources',
                    content: JSON.stringify({
                        sync_id: sourceInfo.sync_id
                    }),
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': res.auth.token
                    },
                    doneCallback(status, responseText) {
                        if (status == 200) {
                            let result = JSON.parse(responseText);
                            result.baseUrl = res.server.baseUrl;
                            resolve(result);
                        }
                        else
                            reject('get-resources error: ' + status + ' ' + responseText);
                    }
                });
            }, reject);
        });
    },
    getArtworkUrl(device, track) {
        return new Promise((resolve, reject) => {
            this._getResources(device, track).then((res, baseUrl) => {
                if (res.images.length)
                    resolve(res.baseUrl + res.images[0].path);
                else
                    reject('no artwork link');
            }, reject);
        });
    },
    getStreamUrl(device, track) {
        if (isURLPath(track.path)) {
            ODS('MMS.getStreamUrl: using UPnP path: ' + track.path);
            return app.utils.web.transformPathUUID2URL(track.path);
        }
        else {
            return new Promise((resolve, reject) => {
                let _getStreamUrl = (device, track) => {
                    this._getResources(device, track).then((res) => {
                        this._getServer(device).then((serverInfo) => {
                            let token = serverInfo.auth.token;
                            if (token.startsWith('Bearer '))
                                token = token.substr(7);
                            let url = res.baseUrl + res.media[0].path + '?token=' + token;
                            ODS('MMS.getStreamUrl: got stream URL: ' + url);
                            app.utils.web.setLinkExtension(url, cloudTools.getFileExt(res.media[0].path)); // just to speed up playback init (no need to get MIME type)
                            resolve(url);
                        }, reject);
                    }, reject);
                };
                let remotePath = cloudTools.getRemotePath(track);
                if (remotePath) {
                    app.filesystem.fileExistsAsync(remotePath).then((exists) => {
                        if (exists) {
                            // we can access remote path directly, it is either same UNC path on the same network (or same local path on the same PC), use it
                            ODS('MMS.getStreamUrl: using remote path directly: ' + remotePath);
                            resolve(remotePath);
                        }
                        else {
                            _getStreamUrl(device, track);
                        }
                    });
                }
                else {
                    _getStreamUrl(device, track);
                }
            });
        }
    },
    deletePlaylist(device, playlist) {
        return new Promise((resolve, reject) => {
            this._getServer(device).then((res) => {
                cloudTools.request({
                    method: 'DELETE',
                    uri: res.server.baseUrl + '/cds/content/' + playlist.uuid,
                    headers: {
                        'Authorization': res.auth.token
                    },
                    doneCallback(status, responseText) {
                        if (status == 200) {
                            resolve();
                        }
                        else
                            reject('Playlist has failed to delete: ' + status + ' ' + responseText);
                    }
                });
            }, reject);
        });
    },
    removeFile(sync, filePath, track) {
        return new Promise(function (resolve, reject) {
            app.utils.web.transformPathUUID2URL(filePath).then(function (url) {
                cloudTools.request({
                    method: 'DELETE',
                    uri: url,
                    doneCallback(status, responseText) {
                        if (status == 200) {
                            resolve();
                        }
                        else
                            reject('File ' + filePath + ' has failed to delete: ' + status + ' ' + responseText);
                    }
                });
            });
        });
    },
    _createTrackMetas(track) {
        let metas = {
            title: track.title,
            album: track.album,
            albumArtists: track.albumArtist.split(';'),
            artists: track.artist.split(';'),
            producers: track.producer.split(';'),
            actors: track.actors.split(';'),
            authors: track.author.split(';'),
            directors: track.director.split(';'),
            publishers: track.publisher.split(';'),
            lyricists: track.lyricist.split(';'),
            conductors: track.conductor.split(';'),
            genres: track.genre.split(';'),
            year: track.date,
            originalTrackNumber: track.trackNumberInt,
            originalDiscNumber: track.discNumberInt,
            comment: track.getCommentSync(),
            lyrics: track.getLyricsSync(),
            playcount: track.playCounter,
            skipcount: track.skipCount,
            bookmark: track.playbackPos,
            bpm: track.bpm,
            size: track.fileLength,
            duration: track.songLength / 1000,
            rating: track.rating,
            volumeLeveling: track.volumeLeveling,
            volumeLevelTrack: track.normalizeTrack,
            volumeLevelAlbum: track.normalizeAlbum,
            last_time_played: app.utils.dateTime2Timestamp(track.lastTimePlayed_UTC),
            parental_rating: track.parentalRating,
            grouping: track.groupDesc,
            contributors: track.involvedPeople.split(';'),
            tempo: track.tempo,
            mood: track.mood,
            occasion: track.occasion,
            quality: track.quality,
            isrc: track.isrc,
            initialKey: track.initialKey,
            originalTitle: track.origTitle,
            originalArtist: track.origArtist,
            originalLyricist: track.origLyricist,
            originalDate: track.origDate,
            encoder: track.encoder,
            copyright: track.copyright,
            subtitle: track.subtitle,
            custom1: track.custom1,
            custom2: track.custom2,
            custom3: track.custom3,
            custom4: track.custom4,
            custom5: track.custom5,
            custom6: track.custom6,
            custom7: track.custom7,
            custom8: track.custom8,
            custom9: track.custom9,
            custom10: track.custom10
        };
        return metas;
    },
    _createSourceInfo(track, server, device, metas) {
        track.dontNotify = true;
        let info = {
            sourceType: 'server',
            server_id: server.uuid,
            device_id: device.id,
            sync_id: metas.sync_id,
            path: metas.path // full path on the server
        };
        track.sync_id = metas.sync_id;
        track.webSource = JSON.stringify(info);
        track.path = ''; // stream url on demand (like in case of cloud content) via getStreamUrl() above
        track.cacheStatus = cloudTools.CACHE_STREAMED; // e.g. for the icon in tracklist (trackListView.js > fieldDefs > source)
        track.dontNotify = false;
    },
    _getSourceInfo(track) {
        if (track.webSource)
            return JSON.parse(track.webSource);
        else
            return {};
    },
    _fillTrackFromMetas(track, metas, purpose) {
        track.dontNotify = true;
        if (metas.sync_id)
            track.sync_id = metas.sync_id;
        if (metas.size)
            track.fileLength = metas.size;
        if (purpose != 'sync') {
            if (metas.title)
                track.title = metas.title;
            if (metas.duration)
                track.songLength = Math.round(metas.duration * 1000);
            if (metas.album)
                track.album = metas.album;
            if (metas.albumArtists)
                track.albumArtist = metas.albumArtists.join(';');
            if (metas.artists)
                track.artist = metas.artists.join(';');
            if (metas.producers)
                track.producer = metas.producers.join(';');
            if (metas.actors)
                track.actors = metas.actors.join(';');
            if (metas.authors)
                track.author = metas.authors.join(';');
            if (metas.directors)
                track.director = metas.directors.join(';');
            if (metas.publishers)
                track.publisher = metas.publishers.join(';');
            if (metas.lyricists)
                track.lyricist = metas.lyricists.join(';');
            if (metas.conductors)
                track.conductor = metas.conductors.join(';');
            if (metas.genres)
                track.genre = metas.genres.join(';');
            if (metas.year)
                track.year = metas.year;
            if (metas.originalTrackNumber)
                track.trackNumberInt = metas.originalTrackNumber;
            if (metas.originalDiscNumber)
                track.discNumberInt = metas.originalDiscNumber;
            if (metas.comment)
                track.setCommentAsync(metas.comment);
            if (metas.playcount)
                track.playCounter = metas.playcount;
            if (metas.skipcount)
                track.skipCount = metas.skipcount;
            if (metas.bookmark)
                track.playbackPos = metas.bookmark;
            if (metas.bpm)
                track.bpm = metas.bpm;
            if (metas.rating)
                track.rating = metas.rating;
            if (metas.volumeLevelTrack)
                track.normalizeTrack = metas.volumeLevelTrack;
            if (metas.volumeLevelAlbum)
                track.normalizeAlbum = metas.volumeLevelAlbum;
            if (metas.last_time_played)
                track.lastTimePlayed_UTC = app.utils.timestamp2DateTime(metas.last_time_played);
            if (metas.parental_rating)
                track.parentalRating = metas.parental_rating;
            if (metas.grouping)
                track.groupDesc = metas.grouping;
            if (metas.contributors)
                track.involvedPeople = metas.contributors.join(';');
            if (metas.tempo)
                track.tempo = metas.tempo;
            if (metas.mood)
                track.mood = metas.mood;
            if (metas.occasion)
                track.occasion = metas.occasion;
            if (metas.quality)
                track.quality = metas.quality;
            if (metas.isrc)
                track.isrc = metas.isrc;
            if (metas.initialKey)
                track.initialKey = metas.initialKey;
            if (metas.originalTitle)
                track.origTitle = metas.originalTitle;
            if (metas.originalArtist)
                track.origArtist = metas.originalArtist;
            if (metas.originalLyricist)
                track.origLyricist = metas.originalLyricist;
            if (metas.originalDate)
                track.origDate = metas.originalDate;
            if (metas.custom1)
                track.custom1 = metas.custom1;
            if (metas.custom2)
                track.custom2 = metas.custom2;
            if (metas.custom3)
                track.custom3 = metas.custom3;
            if (metas.custom4)
                track.custom4 = metas.custom4;
            if (metas.custom5)
                track.custom5 = metas.custom5;
            if (metas.custom6)
                track.custom6 = metas.custom6;
            if (metas.custom7)
                track.custom7 = metas.custom7;
            if (metas.custom8)
                track.custom8 = metas.custom8;
            if (metas.custom9)
                track.custom9 = metas.custom9;
            if (metas.custom10)
                track.custom10 = metas.custom10;
            if (purpose != 'scan') // enable notifications just for listing, notifications per track during scan and sync is significant performance leak, TODO: add a batch notifs?
                track.dontNotify = false;
        }
    },
    getStorageInfo(device) {
        return new Promise((resolve, reject) => {
            this._getServer(device).then(function (res) {
                cloudTools.request({
                    method: 'GET',
                    uri: res.server.baseUrl + '/api/storage',
                    headers: {
                        'Authorization': res.auth.token
                    },
                    doneCallback(status, responseText) {
                        if (status == 200) {
                            let info = JSON.parse(responseText);
                            resolve({
                                spaceTotal: info.space.total,
                                spaceUsed: info.space.used,
                                defaultDirectories: info.defaultDirectories
                            });
                        }
                        else {
                            reject('getStorageInfo error: ' + status + ' :' + responseText);
                        }
                    }
                });
            }, reject);
        });
    },
    getContentSignature(device) {
        return new Promise((resolve, reject) => {
            this._getServer(device).then((res) => {
                cloudTools.request({
                    method: 'GET',
                    uri: res.server.baseUrl + '/api/last-content-token',
                    headers: {
                        'Authorization': res.auth.token
                    },
                    doneCallback: (status, responseText) => {
                        if (status == 200) {
                            let info = JSON.parse(responseText);
                            resolve(info.token);
                        }
                        else {
                            reject('getContentSignature error: ' + status + ' :' + responseText);
                        }
                    }
                });
            }, reject);
        });
    },
    _fillTrackList(list, array, server, device, purpose) {
        return list.asyncFill(array.length, (idx, track) => {
            let metas = array[idx];
            this._createSourceInfo(track, server, device, metas);
            this._fillTrackFromMetas(track, metas, purpose);
        });
    },
    getContentChanges(device, content_signature, purpose) {
        return new Promise((resolve, reject) => {
            this._getServer(device).then((res) => {
                cloudTools.request({
                    method: 'GET',
                    uri: res.server.baseUrl + '/api/content-changes/' + content_signature,
                    headers: {
                        'Authorization': res.auth.token
                    },
                    doneCallback: (status, responseText) => {
                        if (status == 200) {
                            let changes = JSON.parse(responseText);
                            // convert track arrays to our shared Tracklists:
                            let tracks_added = app.utils.createTracklist();
                            this._fillTrackList(tracks_added, changes.tracks.added, res.server, device, purpose).then1(() => {
                                changes.tracks.added = tracks_added;
                                let tracks_updated = app.utils.createTracklist();
                                this._fillTrackList(tracks_updated, changes.tracks.updated, res.server, device, purpose).then1(() => {
                                    changes.tracks.updated = tracks_updated;
                                    resolve(changes);
                                });
                            });
                        }
                        else {
                            reject('getContentChanges error: ' + status + ' :' + responseText);
                        }
                    }
                });
            }, reject);
        });
    },
    finishSyncing(sync, mode) {
        return new Promise((resolve, reject) => {
            if (mode == 'auto') {
                this.getContentSignature(sync.device).then((sign) => {
                    let sett = mediaSyncDevices.getCustomSettings(sync.device);
                    logger.debug('MediaSync: end of sync with MMS: ' + sync.device.name + ' => token: last = ' + sett.content_signature + ' , current = ' + sign);
                    // check whether the token increased only by one from the start of our sync
                    // if it was increased by one then it means that we were the only instance that made some changes on MMS
                    // so just store the new signature to prevent from needless processing of changes that were made by our instance
                    if (sett.content_signature + 1 == sign) {
                        sett.content_signature = sign;
                        mediaSyncDevices.setCustomSettings(sync.device, sett);
                    }
                    resolve();
                }, reject);
            }
            else {
                resolve();
            }
        });
    },
    scanContent(device, fillList, purpose) {
        return new Promise((resolve, reject) => {
            let list = fillList || app.utils.createTracklist();
            this._getServer(device).then((res) => {
                cloudTools.request({
                    method: 'GET',
                    uri: res.server.baseUrl + '/api/tracks/0',
                    headers: {
                        'Authorization': res.auth.token
                    },
                    doneCallback: (status, responseText) => {
                        if (status == 200) {
                            let files = JSON.parse(responseText);
                            this._fillTrackList(list, files, res.server, device, purpose).then1(() => {
                                resolve(list);
                            });
                        }
                        else {
                            reject('scanContent error: ' + status + ' :' + responseText);
                        }
                    }
                }, true /* prefer native request -- as XHR fails once two same GET requests are initiated at the same time */);
            }, reject);
        });
    },
    scanContentForSync(device) {
        return new Promise((resolve, reject) => {
            let sett = mediaSyncDevices.getCustomSettings(device);
            if (sett.scanToLib) {
                // MMS is configured to continually scan content
                // so we have the actual content in the DeviceTracks table , use it:
                device.scanContentAsync(true).then(resolve);
            }
            else {
                // MMS scan is disabled, we don't know the real content, get it:
                this.scanContent(device, null, 'sync').then((list) => {
                    list.whenLoaded().then(() => resolve(list));
                }, reject);
            }
        });
    },
    listPlaylists(device, parent_playlist) {
        return new Promise((resolve, reject) => {
            this._getServer(device).then((res) => {
                let parent_guid = '0'; // root
                if (parent_playlist)
                    parent_guid = parent_playlist.guid;
                cloudTools.request({
                    method: 'GET',
                    uri: res.server.baseUrl + '/api/playlists/' + parent_guid,
                    headers: {
                        'Authorization': res.auth.token
                    },
                    doneCallback: (status, responseText) => {
                        if (status == 200) {
                            let content = JSON.parse(responseText);
                            let playlists = new ArrayDataSource([]);
                            for (let pl of content.playlists) {
                                playlists.add({
                                    guid: pl.guid,
                                    name: pl.name,
                                    last_modified: pl.last_modified,
                                    criteria: pl.criteria,
                                    persistentInfo: {
                                        id: pl.guid
                                    }
                                });
                            }
                            resolve(playlists);
                        }
                        else {
                            reject('listPlaylists error: ' + status + ' :' + responseText);
                        }
                    }
                });
            }, reject);
        });
    },
    listPlaylistContent(device, playlist) {
        let list = app.utils.createTracklist();
        this._getServer(device).then((res) => {
            cloudTools.request({
                method: 'GET',
                uri: res.server.baseUrl + '/api/playlists/' + playlist.guid,
                headers: {
                    'Authorization': res.auth.token
                },
                doneCallback: (status, responseText) => {
                    if (status == 200) {
                        let content = JSON.parse(responseText);
                        if (content.tracks) {
                            list.asyncFill(content.tracks.length, (idx, track) => {
                                let metas = content.tracks[idx];
                                this._createSourceInfo(track, res.server, device, metas);
                                this._fillTrackFromMetas(track, metas);
                            }).then1(() => {
                                list.notifyLoaded();
                            });
                        }
                        else
                            list.notifyLoaded();
                    }
                    else {
                        ODS('listPlaylistContent error: ' + status + ' :' + responseText);
                        list.notifyLoaded();
                    }
                }
            });
        }, (err) => {
            list.notifyLoaded();
        });
        return list;
    },
    _uploadService: {
        resumeFileUpload(params, progressCallback) {
            return new Promise(function (resolve, reject) {
                let startOffset = 0;
                if (params.startOffset)
                    startOffset = params.startOffset;
                let endOffset = params.size;
                if (params.endOffset)
                    endOffset = params.endOffset;
                let contentRange = 'bytes ' + startOffset + '-' + (endOffset - 1) + '/' + params.size;
                cloudTools.request({
                    method: 'PUT',
                    uri: params.sessionURI,
                    content: params.content,
                    progressCallback: progressCallback,
                    headers: {
                        'Content-Type': params.mimeType,
                        'Content-Range': contentRange,
                        'Authorization': params.auth.token
                    },
                    doneCallback: function (status, responseText) {
                        if (status == 200) {
                            resolve(responseText);
                        }
                        else {
                            reject('Upload file error: ' + status + ' :' + responseText);
                        }
                    }
                });
            });
        },
        uploadFile(params, progressCallback) {
            return this.resumeFileUpload(params, progressCallback);
        }
    },
    _getSyncIdForTrack(sync, metadata) {
        let track = sync._getFastTrack(metadata);
        if (track.sync_id) {
            // this should be always presented in the newest MMS/MM5 versions
            return track.sync_id;
        }
        else {
            // this "old" method can be removed in the future
            let sourceInfo = this._getSourceInfo(track);
            if (sourceInfo.sync_id)
                return sourceInfo.sync_id;
            else
                return removeFileExt(cloudTools.normPath(metadata.targetPath)).toLowerCase();
        }
    },
    _createUploadSession(url_base, sourcePath, targetPath, metadata, auth) {
        return new Promise((resolve, reject) => {
            let content = {};
            content.path = targetPath;
            content.source_path = sourcePath;
            if (metadata && metadata.track) {
                if (metadata.track.path)
                    content.source_path = metadata.track.path; // in case of track the sourcePath could be auto-converted track in temporary directory, so take the real source path
                content.sync_id = metadata.track.sync_id;
            }
            let contentJSON = JSON.stringify(content);
            cloudTools.request({
                method: 'POST',
                uri: url_base + '/api/upload-session',
                content: contentJSON,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': auth.token
                },
                doneCallback(status, responseText) {
                    if (status == 200) {
                        resolve(responseText);
                    }
                    else {
                        reject({
                            status: status,
                            responseText: responseText
                        });
                    }
                }
            });
        });
    },
    _login(server, username, password) {
        return new Promise((resolve, reject) => {
            username = username || 'admin';
            password = password || 'admin';
            let contentJSON = JSON.stringify({
                user: username,
                pass: password
            });
            cloudTools.request({
                method: 'POST',
                uri: server.baseUrl + '/api/user/login',
                content: contentJSON,
                headers: {
                    'Content-Type': 'application/json',
                },
                doneCallback: function (status, responseText) {
                    if (status == 200) {
                        resolve(JSON.parse(responseText));
                    }
                    else {
                        reject(responseText + ', http: ' + status);
                    }
                }
            });
        });
    },
    _assignAuthRes(auth, res) {
        auth.token = 'Bearer ' + res.token;
        auth.userInfo = res.user;
    },
    _LOGIN_ERROR: 'login error',
    _logInDialog(server, auth) {
        return new Promise((resolve, reject) => {
            uitools.openDialog('dlgLogin', {
                modal: true,
                server: server,
                auth: auth
            }, (dlg) => {
                this._lastCloseLoginDlgTm = Date.now();
                if (dlg.modalResult == 1) {
                    let res = dlg.getValue('getResultValue')();
                    if (res) {
                        this._assignAuthRes(auth, res);
                        resolve();
                    }
                    else {
                        reject(this._LOGIN_ERROR);
                    }
                }
                else
                    reject(this._LOGIN_ERROR);
            });
        });
    },
    _checkAuthValidity(server, auth, dontShowLoginDlg) {
        return new Promise((resolve, reject) => {
            cloudTools.request({
                method: 'GET',
                uri: server.baseUrl + '/api/version',
                headers: {
                    'Authorization': auth.token
                },
                doneCallback: (status, responseText) => {
                    if (status == 200) {
                        resolve();
                    }
                    else if (status == 401) {
                        this._login(server).then((res) => {
                            this._assignAuthRes(auth, res);
                            resolve();
                        }, () => {
                            // default auth failed, show log-in dialog
                            if ((!this._lastCloseLoginDlgTm || (Date.now() - this._lastCloseLoginDlgTm > 5000)) && !dontShowLoginDlg) {
                                this._logInDialog(server, auth).then(resolve, reject);
                            }
                            else
                                reject(this._LOGIN_ERROR);
                        });
                    }
                    else {
                        reject('_checkAuthValidity error: ' + status + ' :' + responseText);
                    }
                }
            });
        });
    },
    _getServerPromises: {},
    _getServer(device, dontCheckAuthValidity) {
        let key = device.id;
        if (!this._lastAccessTm || (Date.now() - this._lastAccessTm > 5000)) {
            this._cached_servers = {};
            this._cached_auths = {};
            this._getServerPromises[key] = null;
        }
        this._lastAccessTm = Date.now();
        if (!this._getServerPromises[key]) {
            this._getServerPromises[key] = new Promise((resolve, reject) => {
                let _resolve = (server, auth) => {
                    this._cached_servers[key] = server;
                    if (!dontCheckAuthValidity)
                        this._cached_auths[key] = auth;
                    this._getServerPromises[key] = null;
                    resolve({
                        server: server,
                        auth: auth
                    });
                };
                let _reject = (e) => {
                    this._getServerPromises[key] = null;
                    reject(e);
                };
                if (this._cached_servers[key] && this._cached_auths[key]) {
                    _resolve(this._cached_servers[key], this._cached_auths[key]);
                }
                else {
                    let sett = mediaSyncDevices.getCustomSettings(device);
                    if (!sett.serviceInfo) {
                        _reject('No service info');
                        return;
                    }
                    let server_uuid = sett.serviceInfo.server_uuid;
                    let servers = app.sharing.getRemoteServers();
                    servers.whenLoaded().then(() => {
                        let server;
                        listForEach(servers, function (item) {
                            if (item.uuid == server_uuid)
                                server = item;
                        });
                        if (server) {
                            if (this._cached_auths[key]) {
                                _resolve(server, this._cached_auths[key]);
                            }
                            else {
                                let sett = mediaSyncDevices.getCustomSettings(device);
                                if (!sett.authData) {
                                    sett.authData = {
                                        token: 'Bearer dummy'
                                    };
                                }
                                if (dontCheckAuthValidity)
                                    _resolve(server, sett.authData);
                                else
                                    this._checkAuthValidity(server, sett.authData).then(() => {
                                        mediaSyncDevices.setCustomSettings(device, sett);
                                        _resolve(server, sett.authData);
                                    }, _reject);
                            }
                        }
                        else {
                            _reject(sprintf('"%s" is turned off or inaccessible', device.name) + ', udn:' + server_uuid);
                        }
                    });
                }
            });
        }
        return this._getServerPromises[key];
    },
    _checkServerIsRunning(device) {
        let pr;
        pr = new Promise((resolve, reject) => {
            this._getServer(device, true).then((res) => {
                cloudTools.request({
                    method: 'GET',
                    uri: res.server.descriptionUrl,
                    doneCallback: function (status, responseText) {
                        if (isPromiseCanceled(pr))
                            return;
                        if (status == 200) {
                            resolve();
                        }
                        else {
                            reject('error: fail to GET ' + res.server.descriptionUrl + ', ' + status + ' :' + responseText);
                        }
                    }
                });
            }, reject);
        });
        return pr;
    },
    startSyncing(sync, mode) {
        return new Promise((resolve, reject) => {
            let _fail = (err) => {
                logger.debug('MediaSync: ' + err);
                if (!sync.isScheduled) {
                    messageDlg(sprintf(_('There was a problem syncing "%s". It is turned off or inaccessible.'), escapeXml(sync.device.name)), 'Error', ['btnHelp', 'btnOK'], {
                        defaultButton: 'btnOK'
                    }, function (result) {
                        if (result.btnID === 'btnHelp') {
                            window.uitools.openWeb('https://www.mediamonkey.com/upnp-client-connect-error');
                        }
                    });
                }
                reject(sync._ERR_TERMINATED /* to not force crash report */);
            };
            this._checkServerIsRunning(sync.device).then(resolve, _fail);
        });
    },
    _uploadFile(sync, sourcePath, targetPath, progressCallback, metadata) {
        return new Promise((resolve, reject) => {
            this._getServer(sync.device).then((res) => {
                this._createUploadSession(res.server.baseUrl, sourcePath, targetPath, metadata, res.auth).then((sessionID) => {
                    let uploader = new MediaUploader();
                    function _progressCallback(e) {
                        if (progressCallback)
                            progressCallback(e.loaded / e.total);
                        if (sync.taskProgress.terminated)
                            uploader.stop();
                    }
                    let destination = replaceAll(app.filesystem.getPathSeparator(), cloudTools.PATH_SEPARATOR, targetPath);
                    let uploadParams = {
                        sourcePath: sourcePath,
                        destinationPath: destination,
                        service: this._uploadService,
                        progressCallback: _progressCallback,
                        metadata: metadata,
                        sessionURI: res.server.baseUrl + '/api/upload/' + sessionID,
                        auth: res.auth
                    };
                    uploader.uploadFile(uploadParams).then((res) => {
                        if (res.startsWith('{')) { // from MMS 0.1.7
                            let objRes = JSON.parse(res);
                            if (metadata && metadata.track) {
                                if (objRes.sync_id)
                                    metadata.track.sync_id = objRes.sync_id;
                                else {
                                    reject(objRes.error || res); // e.g. scan error on MMS
                                    return;
                                }
                            }
                        }
                        resolve();
                    }, reject);
                }, (res) => {
                    if (res.status == 409) {
                        // the file is accessible by the server under the same path, we cannot proceed with the upload as it would result in copying file to itself
                        resolve();
                    }
                    else
                        reject('createUploadSession error: ' + res.status + ' :' + res.responseText);
                });
            }, reject);
        });
    },
    uploadFile(sync, file) {
        return this._uploadFile(sync, file.sourcePath, file.targetPath);
    },
    uploadTrack(sync, info, progressCallback) {
        return new Promise((resolve, reject) => {
            this._checkTracksNeedUpload(sync, [info]).then1((res) => {
                if (info.needUpload) {
                    // track needs upload
                    this._linkRemoteTrackImages(sync, info).then1(() => {
                        this._uploadFile(sync, info.sourcePath, info.targetPath, progressCallback, info).then(() => {
                            info.hasRemoteCopy = true; // to mark the library track with the cloud icon after successful upload (has remote copy mark -- #15023)
                            if (info.deleteLocalCopy) {
                                // track was successfuly uploaded and its local copy is going to be deleted
                                // create source info to store in subsequent trackUploadSuccess (for streaming purposes)
                                this._getServer(sync.device).then((res) => {
                                    let track = info.track;
                                    let localPath = track.path;
                                    this._createSourceInfo(track, res.server, sync.device, {
                                        sync_id: track.sync_id
                                    });
                                    track.path = localPath; // to be sure that local path hasn't been cleared in _createSourceInfo                                    
                                    resolve({});
                                });
                            }
                            else {
                                resolve({});
                            }
                        }, reject);
                    });
                }
                else {
                    // track is accessible by MMS under the same path (when MMS and MM5 are part of the same network) or for local tracks (when MMS and MM5 are installed on the same PC)  
                    resolve({
                        skipUploadingAssociatedFiles: true // to not upload additional files like artwork and subtitles, they are already there
                    });
                }
            });
        });
    },
    _linkRemoteTrackImages(sync, info) {
        let track = info.track;
        let images = [];
        listForEach(info.files, (file) => {
            let fname = getJustFilename(file.targetPath);
            if (getFileExt(fname) == getFileExt(sync.device.syncAAMask)) {
                images.push({
                    path: fname,
                });
            }
        });
        return this._linkImages(sync, images, track.sync_id);
    },
    _linkImages(sync, images, sync_id) {
        if (!images.length)
            return dummyPromise();
        else
            return new Promise((resolve, reject) => {
                this._getServer(sync.device).then((res) => {
                    cloudTools.request({
                        method: 'POST',
                        uri: res.server.baseUrl + '/api/images',
                        content: JSON.stringify({
                            sync_id: sync_id,
                            images: images
                        }),
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': res.auth.token
                        },
                        doneCallback(status, responseText) {
                            if (status == 200) {
                                resolve(responseText);
                            }
                            else {
                                reject(responseText);
                            }
                        }
                    });
                });
            });
    },
    _getTrackImages(track) {
        return new Promise((resolve, reject) => {
            let coverList = track.loadCoverListAsync(true /* info from db only -- for speed */);
            coverList.whenLoaded().then(() => {
                let images = [];
                listForEach(coverList, (item) => {
                    if (item.coverStorage == 1 /* csFile*/) {
                        images.push({
                            path: getJustFilename(item.picturePath),
                            mimeType: item.pictureType
                        });
                    }
                    else if (item.coverStorage == 0 /* csTag*/) {
                        images.push({
                            tagIndex: item.coverTagIndex,
                            mimeType: item.pictureType
                        });
                    }
                });
                resolve(images);
            });
        });
    },
    _checkTracksNeedUpload(sync, tracks, justCheckAccess, data_sent_callback) {
        return new Promise((resolve, reject) => {
            let content = [];
            asyncForEach(tracks, (info, next) => {
                let track = sync._getFastTrack(info);
                let pr;
                if (justCheckAccess)
                    pr = dummyPromise();
                else
                    pr = this._getTrackImages(track);
                pr.then((images) => {
                    let _res = (use_path) => {
                        let itm = {
                            path: use_path,
                            metas: undefined
                        };
                        if (!justCheckAccess) {
                            itm.metas = this._createTrackMetas(track);
                            itm.metas.images = images;
                        }
                        content.push(itm);
                        next();
                    };
                    let path = track.path;
                    if (this._last_passed_drive && path.startsWith(this._last_passed_drive)) {
                        _res(path);
                    }
                    else {
                        app.utils.getUNCPath(path).then((unc_path) => {
                            if (path == unc_path)
                                this._last_passed_drive = path.substr(0, 3); // like 'C:\'
                            _res(unc_path);
                        });
                    }
                });
            }, () => {
                // check whether the same files are already accessible on the server under the same path
                // e.g. for network tracks in UNC form (when MMS and MM5 are part of the same network) or for local tracks (when MMS and MM5 are installed on the same PC)
                this._getServer(sync.device).then((res) => {
                    cloudTools.request({
                        method: 'POST',
                        uri: res.server.baseUrl + '/api/scan',
                        content: JSON.stringify({
                            content: content,
                            justCheckAccess: justCheckAccess
                        }),
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': res.auth.token
                        },
                        doneCallback(status, responseText) {
                            let promises = [];
                            if (status == 200) {
                                let result = JSON.parse(responseText);
                                assert(tracks.length == result.items.length, 'unexpected result from MMS /api/scan');
                                for (let i = 0; i < tracks.length; i++) {
                                    let item = result.items[i];
                                    let info = tracks[i];
                                    if (item.status != 'not_found') {
                                        // the track is accessible under the same path on the server -- it is the same track, use it (don't re-upload as it would result in copying file to itself!)                   
                                        info.needUpload = false;
                                        if (!justCheckAccess) {
                                            let track = sync._getFastTrack(info);
                                            info.needMetadataUpdate = false;
                                            info.targetPath = track.path;
                                            track.sync_id = item.sync_id;
                                            promises.push(sync.process.trackUploadSuccess(info));
                                        }
                                    }
                                }
                            }
                            else {
                                logger.debug('file-info: failure: ' + responseText);
                            }
                            if (promises.length > 0) {
                                whenAll(promises).then(function () {
                                    resolve();
                                });
                            }
                            else {
                                resolve();
                            }
                        }
                    });
                    if (data_sent_callback)
                        data_sent_callback();
                });
            });
        });
    },
    linkTracks(sync, tracks, taskProgress) {
        return new Promise((resolve, reject) => {
            taskProgress.addLevels(tracks.count);
            let alreadyDone = 0;
            let _progressTextUpdate = (info) => {
                taskProgress.text = sprintf('(%s %d/%d: %s)', _('Updating'), alreadyDone, tracks.count, sync._getFastTrack(info).title);
            };
            let batch = [];
            listAsyncForEach(tracks, (info, next) => {
                _progressTextUpdate(info);
                taskProgress.nextLevel();
                if (info.needUpload)
                    batch.push(info);
                else
                    alreadyDone++;
                let batch_size = 6;
                if (batch.length >= (batch_size * 2)) {
                    // make two parallel batches here so that one is constructing data while the other is waiting for the server to process the data
                    let _batch1 = batch.slice(0, batch_size);
                    let _batch2 = batch.slice(batch_size, batch_size * 2);
                    batch = [];
                    let pr1;
                    pr1 = this._checkTracksNeedUpload(sync, _batch1, false, () => {
                        alreadyDone = alreadyDone + batch_size;
                        _progressTextUpdate(_batch1[0]);
                        this._checkTracksNeedUpload(sync, _batch2, false, () => {
                            alreadyDone = alreadyDone + batch_size;
                            _progressTextUpdate(_batch2[0]);
                        }).then1(() => {
                            pr1.then1(() => {
                                next(taskProgress.terminated);
                            });
                        });
                    });
                }
                else {
                    next(taskProgress.terminated);
                }
            }, resolve);
        });
    },
    _sendPlaylistPart(sync, content) {
        return new Promise((resolve, reject) => {
            let contentJSON = JSON.stringify(content);
            this._getServer(sync.device).then((res) => {
                cloudTools.request({
                    method: 'POST',
                    uri: res.server.baseUrl + '/api/upload-playlist',
                    content: contentJSON,
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': res.auth.token
                    },
                    doneCallback: function (status, responseText) {
                        if (status == 200) {
                            resolve(responseText);
                        }
                        else {
                            reject(responseText + ', http: ' + status);
                        }
                    }
                });
            }, reject);
        });
    },
    uploadPlaylist(sync, playlist) {
        return new Promise((resolve, reject) => {
            playlist.getParentGUID_Async().then((parent_guid) => {
                playlist.getCriteriaJSON_Async().then((criteria_json) => {
                    let content = {
                        name: playlist.name,
                        guid: playlist.guid,
                        criteria: criteria_json,
                        last_modified: playlist.lastModified
                    };
                    if (parent_guid && parent_guid != '')
                        content.parent_guid = parent_guid;
                    content.track_ids = [];
                    let idx = 0;
                    let tracks = playlist.tracks;
                    listAsyncForEach(tracks, (metadata, next) => {
                        // next item callback
                        idx++;
                        content.track_ids.push(this._getSyncIdForTrack(sync, metadata));
                        if (content.track_ids.length < 200) {
                            next();
                        }
                        else {
                            content.batch = {
                                from: idx - content.track_ids.length,
                                to: idx - 1
                            };
                            this._sendPlaylistPart(sync, content).then(() => {
                                content.track_ids = [];
                                next();
                            }, (e) => {
                                reject(e);
                                next(true /* terminate*/);
                            });
                        }
                    }, () => {
                        // final callback
                        content.batch = {
                            from: idx - content.track_ids.length,
                            to: idx - 1,
                            isFinal: true
                        };
                        this._sendPlaylistPart(sync, content).then(resolve, reject);
                    });
                }, reject);
            });
        });
    },
    _getAllPlaylists(sync) {
        let result = [];
        let _processParent = (parent_playlist) => {
            return new Promise((resolve, reject) => {
                this.listPlaylists(sync.device, parent_playlist).then((playlists) => {
                    listAsyncForEach(playlists, (pl, next) => {
                        // next item callback
                        result.push(pl);
                        _processParent(pl).then(() => {
                            next();
                        });
                    }, () => {
                        // final callback
                        resolve(result);
                    });
                }, reject);
            });
        };
        return _processParent();
    },
    filterPlaylists2Upload(sync, playlists) {
        return new Promise((resolve, reject) => {
            this._getAllPlaylists(sync).then((mms_playlists) => {
                let result = app.utils.createSharedList();
                fastForEach(playlists, (item) => {
                    let needSync = true;
                    for (let pl of mms_playlists) {
                        if (pl.guid == item.guid) {
                            if (pl.last_modified == item.lastModified) {
                                ODS('MediaSync: Playlist ' + item.name + '(' + item.guid + ') already synced with last_modified = ' + item.lastModified);
                                needSync = false;
                            }
                        }
                    }
                    if (needSync)
                        result.add(item);
                });
                resolve(result);
            }, reject);
        });
    },
    _isSyncableServer(server) {
        return server.modelName == 'MediaMonkey sync capable server';
    },
    _getProfileIDForServer(server) {
        return 'server:mms:' + server.uuid;
    },
    _registerNewProfiles(servers) {
        let _list = app.getValue('SYNCABLE_UUIDS', []);
        fastForEach(servers, (server, idx) => {
            // add new sync storage target (profile):
            let profile_id = this._getProfileIDForServer(server);
            if (this._isSyncableServer(server)) {
                mediaSyncDevices.register({
                    id: profile_id,
                    name: server.name,
                    handlerID: 'server',
                    serviceInfo: {
                        server_uuid: server.uuid,
                    }
                });
                if (_list.indexOf(server.uuid) < 0)
                    _list.push(server.uuid);
                mediaSyncDevices.initRegistered();
            }
        });
        app.setValue('SYNCABLE_UUIDS', getDistinctArray(_list));
    },
    initNewProfiles() {
        let servers = app.sharing.getRemoteServers({
            noRefresh: true // #17638/3a
        });
        let _regProfiles = function () {
            this._registerNewProfiles(servers);
        }.bind(this);
        // servers.whenLoaded().then(_regProfiles); // commented because of #17638/3a
        app.listen(servers, 'change', _regProfiles);
    },
    tabVisible(page_id) {
        return inArray(page_id, ['summary']);
    },
    tabName(page_id) {
        if (page_id == 'summary')
            return _('Remote content');
        if (page_id == 'syncToDevice')
            return _('Library content');
    },
    _scan_interval_names() {
        let list = newStringList();
        list.add(_('Continuously'));
        return list;
    },
    _scan_intervals() {
        return [30 * 1000]; // continuously (polling method, TODO: do this via notifications from MMS?)
    },
    contentSelectionText: function (device) {
        return sprintf(_('Set content to store on \'%s\''), device.name);
    },
    contentSelectionSubText: function (device) {
        return sprintf(_('This content will be copied (by default) to \'%s\' so that it can be shared with other clients'), device.name);
    },
    configPage: {
        summary: {
            load: function (device, config) {
                let thisHandler = mediaSyncHandlers[device.handlerID];
                let headbox = config.qChild('summaryHeadingBox');
                headbox.innerHTML = '<label data-id="showWebConfig" class="hotlink">Configure...</label>' +
                    '<label data-id="showMigrationWizard" class="hotlink">Migration wizard...</label>' +
                    '<label data-id="lblNotRunning" class="clrError"></label>' +
                    '<div data-id="boxSignOut" class="flex row">' +
                    '    <label data-id="linkSignOut" class="hotlink">Sign out</label>' +
                    '    <label data-id="lblUserInfo" class="textEllipsis"></label>' +
                    '</div>' +
                    '<label data-id="linkSignIn" class="hotlink"></label>';
                initializeControls(headbox);
                let lblNotRunning = config.qChild('lblNotRunning');
                let showWebConfig = config.qChild('showWebConfig');
                let linkSignIn = config.qChild('linkSignIn');
                let boxSignOut = config.qChild('boxSignOut');
                setVisibility(boxSignOut, window.uitools.getCanEdit());
                config.dataSourceListen(showWebConfig, 'click', function () {
                    thisHandler._getServer(device).then((res) => {
                        window.uitools.openWeb(res.server.baseUrl);
                    });
                });
                let showMigrationWizard = config.qChild('showMigrationWizard');
                config.dataSourceListen(showMigrationWizard, 'click', function () {
                    thisHandler._showMigrationWizard(device).then(() => {
                        config.dataSource = device; // to refresh the values set in the wizard
                    });
                });
                let _updateRunningState = (running, authorized) => {
                    if (window._cleanUpCalled)
                        return;
                    setVisibility(lblNotRunning, !running || !authorized);
                    if (!running)
                        lblNotRunning.innerText = _('Server is down!');
                    else if (!authorized)
                        lblNotRunning.innerText = _('Access is denied');
                    setVisibility(showWebConfig, running && authorized);
                    setVisibility(showMigrationWizard, running && authorized);
                    setVisibility(boxSignOut, running && authorized);
                };
                _updateRunningState(false, false);
                let updateRunningState = () => {
                    config.dataSourcePromise(thisHandler._checkServerIsRunning(device)).then(() => {
                        _updateRunningState(true, true);
                    }, (e) => {
                        if (!isAbortError(e)) { // promise canceled
                            if (e == thisHandler._LOGIN_ERROR)
                                _updateRunningState(true, false);
                            else
                                _updateRunningState(false, false);
                        }
                    });
                };
                config.dataSourceListen(app.sharing.getRemoteServers(), 'change', updateRunningState);
                config.localListen(config.qChild('linkSignOut'), 'click', function () {
                    let sett = mediaSyncDevices.getCustomSettings(device);
                    sett.authData = {};
                    mediaSyncDevices.setCustomSettings(device, sett);
                    mediaSyncDevices.terminateSync(device);
                    config.refresh();
                });
                setVisibility(linkSignIn, false);
                setVisibility(boxSignOut, false);
                config.dataSourcePromise(thisHandler._getServer(device, true /* dontCheckAuthValidity*/)).then((res) => {
                    config.dataSourcePromise(thisHandler._checkAuthValidity(res.server, res.auth, true /* dontShowLoginDlg  */)).then(() => {
                        if (res.auth.userInfo) // older MMS versions don't have the userInfo yet
                            config.qChild('lblUserInfo').innerText = '(' + _('User') + ': ' + res.auth.userInfo.name + ')';
                        setVisibility(linkSignIn, false);
                        setVisibility(boxSignOut, true);
                        updateRunningState();
                    }, (err) => {
                        if (isAbortError(err)) // promise canceled
                            return;
                        if (err == thisHandler._LOGIN_ERROR) {
                            setVisibility(linkSignIn, true);
                            setVisibility(boxSignOut, false);
                            linkSignIn.innerText = _('Sign in') + '...';
                            config.localListen(linkSignIn, 'click', function () {
                                thisHandler._logInDialog(res.server, res.auth).then(function () {
                                    let sett = mediaSyncDevices.getCustomSettings(device);
                                    sett.authData = res.auth;
                                    mediaSyncDevices.setCustomSettings(device, sett);
                                    config.refresh(); // to refresh UI after authorization
                                });
                            });
                            _updateRunningState(true, false);
                        }
                        else {
                            updateRunningState();
                        }
                    });
                }, (err) => {
                    if (!isAbortError(err)) // promise canceled                            
                        _updateRunningState(false, false);
                });
                // layout proposals in Mantis issue #15183
                let box = config.qChild('summaryOptionsBox');
                let devicename = escapeXml(device.name);
                let scan_text = sprintf(_('Scan \'%s\' content to the local database'), devicename);
                let scan_box_tooltip = sprintf(_('On sync, the database is updated with links to files and playlists from \'%s\''), devicename);
                let link_text = sprintf(_('Set content to store on \'%s\'') + '...', devicename);
                box.innerHTML =
                    '<label>' + _('Sync settings') + ':</label>' +
                        '<div data-id="chbScanToLib" data-control-class="Checkbox" data-tip="' + scan_box_tooltip + '">' + scan_text +
                        '</div>' +
                        '<div data-id="boxScan" data-control-class="Control" class="uiRows left-indent">' +
                        '  <label data-id="linkSetContent" class="hotlink">' + link_text + '</label>' +
                        '</div>';
                initializeControls(box);
                setVisibility(box, window.uitools.getCanEdit());
                //setVisibility(config.qChild('deviceContentView'), false); // disabled in #15183, but subsequently re-enabled due to #15330
                //setVisibility(config.qChild('middleSeparator'), false);
                let sett = mediaSyncDevices.getCustomSettings(device);
                let chbScanToLib = config.qChild('chbScanToLib');
                chbScanToLib.controlClass.checked = sett.scanToLib;
                let linkSetContent = config.qChild('linkSetContent');
                config.localListen(linkSetContent, 'click', () => {
                    thisHandler._showContentSelectionDlg(device).then(() => {
                        config.dataSource = device; // to refresh the values set in the dialog
                    });
                });
            },
            save: function (device, config) {
                mediaSyncDevices.changeLibraryScanSettings(device, {
                    scanToLib: config.qChild('chbScanToLib').controlClass.checked,
                    scan_interval_ms: this._scan_intervals()[0],
                    downloadToLib: false,
                    syncMetadata: true,
                    excludeNewFiles: false
                });
            },
        }
    }
};
// ------------------------------------------------------------------------------------------------------------------------------------------
window.mediaSyncDevices = {
    _devices: [],
    metadataStorages: {},
    register(reginfo) {
        for (let i = 0; i < this._devices.length; i++) {
            if (this._devices[i].id == reginfo.id)
                return;
        }
        assert(reginfo.id, 'sync device id not defined!');
        assert(reginfo.handlerID, 'sync hanlder not defined!');
        this._devices.push(reginfo);
    },
    initRegistered() {
        let _this = this;
        let anyChange = false;
        return new Promise(function (resolve, reject) {
            function _initDevice(idx) {
                if ((idx >= _this._devices.length) || window._cleanUpCalled) {
                    if (anyChange && !window._cleanUpCalled)
                        app.devices.getAll().notifyChanged(); // to notify the change (e.g. to update the device list in the 'DevicesView')
                    resolve();
                }
                else {
                    let reginfo = _this._devices[idx];
                    if (reginfo.registered)
                        _initDevice(idx + 1);
                    else {
                        reginfo.registered = true;
                        app.devices.getDeviceAsync(reginfo.id, reginfo.name).then(function (device) {
                            if (device) {
                                device.handlerID = reginfo.handlerID; // required ('usb', 'cloud')
                                if (reginfo.serviceInfo) { // optional info
                                    let sett = _this.getCustomSettings(device);
                                    if (JSON.stringify(sett.serviceInfo) != JSON.stringify(reginfo.serviceInfo)) {
                                        sett.serviceInfo = reginfo.serviceInfo;
                                        _this.setCustomSettings(device, sett);
                                    }
                                }
                                let handler = mediaSyncHandlers[device.handlerID];
                                let _checkUpdate = () => {
                                    if (handler.checkProfileUpdate) // optional, e.g. 'server' handler uses it to update icon/name
                                        handler.checkProfileUpdate(device);
                                    anyChange = true;
                                    _initDevice(idx + 1);
                                };
                                if (device.isNewlyCreated) {
                                    let pr;
                                    if (handler.initProfileDefaults)
                                        pr = handler.initProfileDefaults(device);
                                    if (pr && isPromise(pr))
                                        pr.then1(() => {
                                            device.commitAsync().then1(_checkUpdate);
                                        });
                                    else
                                        device.commitAsync().then1(_checkUpdate); // to commit the newly created device profile into DB
                                }
                                else {
                                    _checkUpdate();
                                }
                            }
                            else
                                _initDevice(idx + 1);
                        });
                    }
                }
            }
            _initDevice(0);
        });
    },
    getSyncable() {
        return this.getBy({
            onlySyncable: true
        });
    },
    getMetadataStorage(device) {
        let handler = mediaSyncHandlers[device.handlerID];
        if (!this.metadataStorages[device.id])
            this.metadataStorages[device.id] = new MetadataStorage(device.profile_id);
        let ms = this.metadataStorages[device.id];
        if (handler.metadataStorageEnabled && handler.metadataStorageEnabled(device, ms))
            ms.bypass = false;
        else
            ms.bypass = true;
        return ms;
    },
    getBy(params) {
        let _this = this;
        return new Promise(function (resolve, reject) {
            _this.initRegistered().then(function () {
                if (window._cleanUpCalled) {
                    reject();
                    return;
                }
                let res = app.utils.createEmptyList();
                let devices = app.devices.getAll().getCopy();
                devices.locked(function () {
                    for (let i = 0; i < devices.count; i++) {
                        let dev = devices.getValue(i);
                        if (dev.handlerID == 'cloud' && !mediaSyncHandlers.cloud.getService(dev))
                            continue; // no longer existing cloud service (e.g. googleMusic addon uninstalled)
                        if ((!params.handler || params.handler == dev.handlerID) && (params.exceptHandler != dev.handlerID)) {
                            let handler = mediaSyncHandlers[dev.handlerID];
                            if (handler) {
                                let add = true;
                                if (params.onlySyncable)
                                    add = handler.syncEnabled(dev);
                                if (params.onlyRecentlySynced) {
                                    let _lastSyncTm_UTC = app.utils.timestamp2DateTime(dev.lastSyncTime);
                                    add = handler.syncEnabled(dev) || (dev.enabled && ((app.utils.getDateNow_UTC() - _lastSyncTm_UTC) < 7 /* days */)); // connected or synced in the last week (per #13697/~46512)
                                }
                                if (params.visibleInTree)
                                    add = handler.syncEnabled(dev) || (dev.allowWifiSync && dev.handlerID == 'usb'); // #13767 - item f)
                                if (params.scannedToLib || params.scheduledSync) {
                                    let sett = mediaSyncDevices.getCustomSettings(dev);
                                    let scheduled = _this._isScheduledSyncInterval(sett.scan_interval_ms);
                                    if (params.scannedToLib && params.scheduledSync)
                                        add = scheduled && sett.scanToLib;
                                    else if (params.scannedToLib && params.scheduledSync == false)
                                        add = !scheduled && sett.scanToLib;
                                    else if (params.scannedToLib)
                                        add = sett.scanToLib;
                                    else
                                        add = scheduled;
                                }
                                if (params.hasTracksInLib) {
                                    // similar to scannedToLib above, but veryfing whether some tracks are still in library even when no longer configured so (details in #14980)
                                    let sett = mediaSyncDevices.getCustomSettings(dev);
                                    add = sett.hasContentInLibrary || sett.scanToLib;
                                }
                                if (params.onlyFolderBased && handler.isFolderBased) {
                                    if (!handler.isFolderBased(dev))
                                        add = false;
                                }
                                if (dev.getIsDummy()) // in MM4 we used to create dummmy device profile for each device plugin, this is no longer used in MM5 (#16081)
                                    add = false;
                                if (add) {
                                    res.add(dev);
                                }
                                if (params.limit_max && (params.limit_max <= res.count))
                                    break;
                            }
                        }
                    }
                });
                res.isLoaded = true;
                resolve(res);
            });
        });
    },
    getById(device_id) {
        this._devicesByID = this._devicesByID || {};
        if (this._devicesByID[device_id])
            return this._devicesByID[device_id];
        let res;
        listForEach(app.devices.getAll(), (device) => {
            if (device_id == device.id)
                res = device;
            this._devicesByID[device.id] = device;
        });
        return res;
    },
    getIcon(device) {
        let handler = mediaSyncHandlers[device.handlerID];
        if (isFunction(handler.icon))
            return handler.icon(device);
        else
            return handler.icon;
    },
    getStatus(device) {
        let status = '';
        if (this.isSyncInProgress(device)) {
            status = _('Syncing');
        }
        else {
            let handler = mediaSyncHandlers[device.handlerID];
            if (handler.getStatus && isFunction(handler.getStatus))
                status = handler.getStatus(device);
        }
        let s = _('Last synced') + ': ';
        if (device.lastSyncTime != '')
            s = s + app.utils.formatTimestamp(device.lastSyncTime);
        else
            s = s + _('Never');
        if (status != '')
            s = status + ', ' + s;
        return s;
    },
    isSyncable(device) {
        let syncHandler = mediaSyncHandlers[device.handlerID];
        return syncHandler.syncEnabled(device);
    },
    isFieldEditable(device, fieldName) {
        let syncHandler = mediaSyncHandlers[device.handlerID];
        if (syncHandler.configUI) {
            let config = syncHandler.configUI(device);
            if ((config.disabledEdit) && (config.disabledEdit.indexOf(fieldName) >= 0))
                return false;
        }
        return true;
    },
    getCustomSettings(device) {
        if (device.customJSON)
            return JSON.parse(device.customJSON);
        else
            return {};
    },
    setCustomSettings(device, sett) {
        return new Promise((resolve, reject) => {
            device.customJSON = JSON.stringify(sett);
            device.commitAsync().then(resolve);
        });
    },
    modifyCustomSettings(device, values) {
        let sett = this.getCustomSettings(device);
        for (let v in values) {
            sett[v] = values[v];
        }
        return this.setCustomSettings(device, sett);
    },
    appStartInit() {
        this.initCloudPlayback();
        this.initLibraryScan(10000);
        this.initTrackModifications();
        this.initPlaylistModifications();
        this.initDownloading();
        this.initNewProfiles();
        this.initDevicesArrival();
        app.listen(thisWindow, 'closeQuery', (token) => {
            token.asyncResult = true;
            this.terminateAll(token).then(() => {
                token.resolved();
            });
        });
    },
    initCloudPlayback() {
        this.getBy({
            handler: 'cloud'
        }).then(function (cloudProfiles) {
            cloudProfiles.locked(function () {
                for (let i = 0; i < cloudProfiles.count; i++) {
                    // call getService() to get the service instances to the cloudTools.serviceInstanceCahce (used in cloudTools._onHTMLPlaybackState)
                    let pr = cloudProfiles.getValue(i);
                    mediaSyncHandlers[pr.handlerID /*cloud*/].getService(pr);
                }
                cloudTools.registerPlayback(); // services get stream URL once playback is initiated
            });
        });
    },
    initNewProfiles() {
        let handlers = getSortedAsArray(mediaSyncHandlers);
        for (let i = 0; i < handlers.length; i++) {
            let h = handlers[i];
            if (h.initNewProfiles)
                h.initNewProfiles();
        }
    },
    initDevicesArrival() {
        app.listen(app, 'commonChange', (obj, type, device) => {
            if (obj == 'device' && type == 'connected') {
                let thisDevice = device;
                if (thisDevice.enabled && !window._cleanUpCalled) {
                    // show toast message that device has been connected (#15402): 
                    uitools.toastMessage.show(_('Connected') + ': ' + escapeXml(thisDevice.name), {
                        button: {
                            caption: _('Configure') + '...',
                            onClick: () => {
                                navUtils.navigateNodePath([navUtils.createNodeState('root'),
                                    navUtils.createNodeState('devicesList'),
                                    navUtils.createNodeState('device', device)]);
                            }
                        },
                        delay: 15000
                    });
                    // check whether "sync on connect" is enabled:
                    if (thisDevice.syncOnConnect)
                        new MediaSync(thisDevice).runAutoSync(true);
                }
            }
        });
    },
    initTrackModifications() {
        let handlers = getSortedAsArray(mediaSyncHandlers);
        for (let i = 0; i < handlers.length; i++) {
            let h = handlers[i];
            if (h.modifyTrack) {
                app.listen(app, 'trackModified', function (track) {
                    if (!mediaSyncDevices.isSyncInProgress()) // TODO: better handling of track changes during sync, for now just ignoring them
                        this.modifyTrack(track);
                }.bind(h));
            }
            if (h.handleNewTrack) {
                app.listen(app, 'trackAdded', function (track) {
                    // a new track was added to library right now
                    this.handleNewTrack(track);
                }.bind(h));
            }
        }
    },
    isModifiableTrack(track) {
        let handlers = getSortedAsArray(mediaSyncHandlers);
        for (let i = 0; i < handlers.length; i++) {
            let h = handlers[i];
            if (h.isModifiableTrack) {
                if (h.isModifiableTrack(track))
                    return true;
            }
        }
        return false;
    },
    initPlaylistModifications() {
        this._scheduledPlaylistTm = {};
        app.listen(app, 'playlistChange', (playlist) => {
            clearTimeout(this._scheduledPlaylistTm[playlist.id]);
            this._scheduledPlaylistTm[playlist.id] = window.requestTimeout(() => {
                this.playlistModified(playlist);
            }, 10000); // wait 10s for another change, if there isn't any then run the sync
        });
    },
    playlistModified(playlist) {
        // check whether this playlist is on the sync list of a connected device/storage and sync it:
        this.getSyncable().then(function (connected_devices) {
            listForEach(connected_devices, (device) => {
                if (inArray(device.handlerID, [/*'cloud',*/ 'server'])) // #16644
                    device.getIsOnSyncList(playlist.objectType, playlist.id).then((exists) => {
                        if (exists && !mediaSyncDevices.isSyncInProgress(device)) {
                            let sync = new MediaSync(device);
                            sync.runAutoSync().then(() => { }, () => {
                                // sync has failed (or was terminated), schedule sync for the next time
                                mediaSyncDevices.modifyCustomSettings(sync.device, {
                                    syncNeeded: true
                                });
                            });
                        }
                    });
            });
        });
    },
    changeLibraryScanSettings(device, state) {
        let sett = mediaSyncDevices.getCustomSettings(device);
        let oldScanToLib = sett.scanToLib;
        sett.scanToLib = state.scanToLib;
        sett.hasContentInLibrary = state.scanToLib;
        if (oldScanToLib && !sett.scanToLib) {
            this.terminateSync(device); // to cancel scanning/downloading
            device.removeTracksFromLibrary(true /* show the confirmation */).then((deletionApproved) => {
                if (!deletionApproved) { // user did not wish to remove the already scanned tracks from the library                    
                    let _sett = mediaSyncDevices.getCustomSettings(device);
                    _sett.hasContentInLibrary = true;
                    mediaSyncDevices.setCustomSettings(device, _sett);
                }
            });
            sett.last_scan_time = null; // to be scanned immediatelly once re-enabled
            sett.content_signature = null;
        }
        if (state.scan_interval_ms)
            sett.scan_interval_ms = state.scan_interval_ms;
        if (state.downloadToLib != undefined)
            sett.downloadToLib = state.downloadToLib;
        if (state.runAutoSyncAfterScan)
            sett.runAutoSyncAfterScan = state.runAutoSyncAfterScan;
        if (state.syncMetadata != undefined)
            sett.syncMetadata = state.syncMetadata;
        if (state.excludeNewFiles != undefined)
            sett.excludeNewFiles = state.excludeNewFiles;
        mediaSyncDevices.setCustomSettings(device, sett);
        if (sett.scanToLib) {
            mediaSyncDevices.checkLibraryScan(device);
            mediaSyncDevices.initLibraryScan(0);
        }
        device.notifyChanged();
    },
    notifyChange(device) {
        device.notifyChanged();
        if (!window._cleanUpCalled)
            app.devices.getAll().notifyChanged(); // to update the device list in the 'DevicesView', the list order depends on the device status
    },
    registerSync(sync) {
        this._syncTasks = this._syncTasks || [];
        this._syncTasks.push(sync);
        this.notifyChange(sync.device);
    },
    unregisterSync(sync) {
        this._syncTasks = this._syncTasks.filter(item => item !== sync);
        this.notifyChange(sync.device);
    },
    terminateSync(device) {
        if (!this._syncTasks)
            return;
        for (let sync of this._syncTasks) {
            if (sync.device.id == device.id) {
                sync.taskProgress.terminate();
            }
        }
    },
    terminateAll(token) {
        return new Promise((resolve, reject) => {
            if (this._syncTasks)
                for (let sync of this._syncTasks)
                    sync.taskProgress.terminate();
            let _checkTerminated = () => {
                if (this.isSyncInProgress()) {
                    ODS('MediaSync: waiting for termination...');
                    assert(!window._cleanUpCalled, 'Window clean up was called before the close token was resolved!!');
                    setTimeout(() => {
                        if (token)
                            token.stillWorking(); // to not assert "not close events finished" in case of MTP freeze (#16329)
                        _checkTerminated();
                    }, 200);
                }
                else
                    resolve();
            };
            _checkTerminated();
        });
    },
    isSyncInProgress(device /* optional*/) {
        if (device && device.isAutoSyncRunning) // e.g. Wi-Fi sync started remotely (from MMA)
            return true;
        // and now check sync tasks run by us (via registerSync)
        if (!this._syncTasks)
            return;
        for (let sync of this._syncTasks) {
            if (!device || sync.device.id == device.id) {
                return true;
            }
        }
    },
    getSyncTaskInProgress(device, taskType) {
        // check sync tasks run by us (via registerSync)
        if (!this._syncTasks)
            return;
        for (let sync of this._syncTasks) {
            if (sync.device.id == device.id && sync.taskType == taskType) {
                return sync;
            }
        }
    },
    _alreadyScannedDevices: {},
    _isScheduledSyncInterval(int) {
        return (int > 0) && (int < 3153600000000 /* 100 years used for "manual" option */);
    },
    checkLibraryScan(device, scanNow) {
        let sett = this.getCustomSettings(device);
        if ((sett.scanToLib || sett.scan_interval_ms > 0) && window.isMainWindow /* #14586 */) {
            let lastScanTm = sett.last_scan_time;
            if (scanNow) {
                sett.content_signature = null; // to force re-scan now (manual option)
                this.setCustomSettings(device, sett);
            }
            if (!this.isSyncInProgress(device) && (scanNow || !lastScanTm || lastScanTm + sett.scan_interval_ms < Date.now())) {
                ODS('Check scheduled scan/sync for: ' + device.name + ', Last scan: ' + lastScanTm + ', Interval: ' + sett.scan_interval_ms + ', now: ' + Date.now());
                if (sett.scan_interval_ms == 1 && this._alreadyScannedDevices[device.id]) // this indicates "At startup" option
                    return;
                this._alreadyScannedDevices[device.id] = true;
                sett.last_scan_time = Date.now();
                this.setCustomSettings(device, sett);
                if (!this.isSyncable(device)) {
                    ODS(device.name + ' is not syncable now');
                    return;
                }
                let sync = new MediaSync(device);
                sync.isScheduled = true;
                if (sett.syncNeeded) { // e.g. MMS sets this value when the server was down (for tracks/playlists that were added or modified meanwhile)
                    sync.runAutoSync(true).then(() => {
                        mediaSyncDevices.modifyCustomSettings(device, {
                            syncNeeded: false
                        });
                    });
                }
                else if (sett.runAutoSyncAfterScan) {
                    if (this._isScheduledSyncInterval(sett.scan_interval_ms) || scanNow)
                        sync.runAutoSync(true); // scheduled auto-sync per #14983
                }
                else {
                    if (sett.scanToLib)
                        sync.scanToLibrary().then(() => {
                            if (sett.downloadToLib)
                                sync.downloadTracks2Library();
                        });
                }
            }
        }
    },
    initLibraryScan(schedule_timeout) {
        let scanNow = false;
        if (!schedule_timeout) {
            schedule_timeout = 0;
            scanNow = true;
        }
        if ((!scanNow && this.__libraryScanScheduled) || !window.isMainWindow)
            return;
        this.__libraryScanScheduled = true;
        window.requestTimeout(() => {
            this.getBy({
                scannedToLib: true,
                scheduledSync: !scanNow
            }).then((profiles) => {
                if (!app.db.getIsLocked()) // to not start scheduled scan when db is locked (maintenance, backup)            
                    profiles.locked(() => {
                        for (let i = 0; i < profiles.count; i++)
                            this.checkLibraryScan(profiles.getValue(i), scanNow);
                    });
                this.__libraryScanScheduled = false;
                if (profiles.count > 0)
                    this.initLibraryScan(10000); // schedule next check after 10s
            });
        }, schedule_timeout);
    },
    initDownloading() {
        let downloader = app.downloader;
        app.listen(downloader, 'change', (oper, item) => {
            if (oper == 'streamUrlRequest') {
                ODS('initDownloading: streamUrlRequest, pending count: ' + downloader.streamUrlRequests);
                if (downloader.streamUrlRequests < 4) { // to not initiate too many stream url requests (would result in too many download threads)
                    downloader.streamUrlRequests = downloader.streamUrlRequests + 1;
                    cloudTools.getSourceUrl(item.track).then((url) => {
                        ODS('initDownloading: got URL: ' + url);
                        if (url) {
                            if (url.indexOf('://') > 0) {
                                item.source = url;
                                item.queued = true;
                                downloader.resumeDownload(item, true /* to start immediatelly - link could expire otherwise */);
                            }
                            else {
                                downloader.downloadFinished(item, -1, 'URL format error: ' + url);
                            }
                        }
                        else {
                            downloader.downloadFinished(item, -1, 'no url');
                        }
                        downloader.streamUrlRequests = downloader.streamUrlRequests - 1;
                    }, (err) => {
                        ODS('initDownloading: streamUrlRequest, error: ' + err);
                        downloader.downloadFinished(item, -1, err.toString());
                        downloader.streamUrlRequests = downloader.streamUrlRequests - 1;
                    });
                }
                else
                    item.queued = true;
            }
        });
    }
};
/**
Object for initiating media sync to/from a device or storage

@class MediaSync
@constructor
*/
export default class MediaSync {
    constructor(device) {
        this.device = device;
        this._ERR_TERMINATED = 'terminated by user';
    }
    /**
    Sends tracks into device
    
    @method sendToDevice
    @param {Tracklist} tracks to send
    */
    async sendToDevice(tracks, playlist) {
        this.taskType = 'send';
        this.queue = [];
        this.queuedTracksCount = 0;
        this.queuedTracksUploadedCount = 0;
        let addToQueue = (task) => {
            task.queue.push({
                tracks: tracks,
                playlist: playlist
            });
            task.queuedTracksCount += tracks.count;
            task.taskProgress.addLevels(tracks.count);
        };
        let runningTask = mediaSyncDevices.getSyncTaskInProgress(this.device, this.taskType);
        if (runningTask) {
            addToQueue(runningTask);
        }
        else {
            this.taskProgress = app.backgroundTasks.createNew();
            this.taskProgress.leadingText = sprintf(_('Copying to %s:'), this.device.name);
            addToQueue(this);
            try {
                await this.startProcess('send');
                while (this.queue.length) {
                    let _tracks = this.queue[0].tracks;
                    let _playlist = this.queue[0].playlist;
                    this.queue.shift();
                    await this.addTracks(_tracks);
                    if (_playlist)
                        await this.addPlaylist(_playlist, _tracks);
                    await this.runFileConversion();
                    await this.uploadTracks();
                    await this.uploadPlaylists();
                    this.queuedTracksUploadedCount += _tracks.count;
                }
                this.finishProcess(true);
            }
            catch (e) {
                this.finishProcess(false);
                if (e != this._ERR_TERMINATED)
                    myAlert('Sync error: ' + e); // using throw here in async function just returns rejected promise (so used alert to be catched by Eureka log)            
                throw e; // returns rejected promise
            }
        }
    }
    /**
    Initiates auto sync with this device
    
    @method runAutoSync
    */
    async runAutoSync(runLibraryScan) {
        // note that this function is used (and waited) in /tests/sync.js
        if (!mediaSyncDevices.isSyncable(this.device)) {
            ODS(this.device.name + ' is not syncable now');
            return;
        }
        ODS('MediaSync: runAutoSync: ' + this.device.name + ', runLibraryScan: ' + runLibraryScan);
        let scan_terminated;
        if (runLibraryScan) {
            let sett = mediaSyncDevices.getCustomSettings(this.device);
            ODS('MediaSync: runAutoSync: scanToLib: ' + sett.scanToLib);
            if (sett.scanToLib) {
                try {
                    await this.scanToLibrary();
                    if (sett.downloadToLib)
                        await this.downloadTracks2Library();
                }
                catch (err) {
                    ODS('MediaSync: Scan of ' + this.device.name + ' has failed, error: ' + err);
                    if (err == this._ERR_TERMINATED)
                        scan_terminated = true;
                }
            }
        }
        if (!scan_terminated) {
            this.taskProgress = app.backgroundTasks.createNew();
            this.taskProgress.leadingText = sprintf(_('Syncing %s:'), this.device.name);
            try {
                await this.startProcess('auto');
                await this.getStorageInfo();
                this.taskProgress.text = '(' + _('Scanning') + '...)';
                await this.scanContent(this.device);
                await this.getSyncList();
                await this.linkTracks();
                await this.checkFreeSpace();
                await this.runFileConversion();
                await this.downloadTracks();
                await this.removeOldContent();
                await this.uploadTracks();
                await this.uploadPlaylists();
                await this.removeEmptySubfolders();
                this.finishProcess(true);
            }
            catch (e) {
                this.finishProcess(false);
                if (e != this._ERR_TERMINATED)
                    myAlert('Sync error: ' + e); // using throw here in async function just returns rejected promise (so used alert to be catched by Eureka log)            
                throw e; // to return rejected promise
            }
        }
    }
    /**
    Removes tracks from the device
    
    @method removeFromDevice
    @param {Tracklist} tracks to delete
    */
    removeFromDevice(tracklist) {
        if (!mediaSyncDevices.isSyncable(this.device)) {
            ODS(this.device.name + ' is not syncable now');
            return;
        }
        if (this.taskProgress && !this.taskProgress.terminated) {
            // previous batch of files isn't finished yet, schedule it later:
            if (tracklist) {
                if (!this._queuedList) {
                    this._queuedList = tracklist;
                }
                else {
                    this._queuedList.addList(tracklist);
                }
                this.updateDeletionText(this._removingFiles + this._queuedList.count);
            }
            requestTimeout(() => {
                this.removeFromDevice();
            }, 1000);
            return;
        }
        if (this._queuedList) {
            if (tracklist)
                this._queuedList.addList(tracklist);
            tracklist = this._queuedList;
            this._queuedList = null;
        }
        if (!tracklist)
            return; // nothing to delete
        this._removingFiles = tracklist.count;
        this.taskProgress = app.backgroundTasks.createNew();
        this.taskProgress.leadingText = this.device.name + ': ';
        let tracks = tracklist.getCopy();
        let paths = newStringList();
        fastForEach(tracks, (track) => {
            paths.add(track.path);
        });
        this.updateDeletionText(paths.count);
        this.startProcess('remove').then(() => {
            return this.removeFiles(paths, tracks);
        }).then(() => {
            this.finishProcess(true);
        }, () => {
            this.finishProcess(false);
        });
    }
    updateDeletionText(count) {
        if (count > 1)
            this.taskProgress.text = _('Removing') + ' ' + count + ' ' + _('files');
        else
            this.taskProgress.text = _('Removing') + ' ' + count + ' ' + _('file');
    }
    addTracks(tracks) {
        return new Promise((resolve, reject) => {
            this.taskProgress.text = _('(Preparing list of files)');
            this.process.addTracksAsync(tracks).then((files) => {
                this.files = files;
                resolve();
            }, reject);
        });
    }
    addPlaylist(playlist, tracks) {
        this.taskProgress.text = _('(Preparing list of files)');
        return this.process.addPlaylistAsync(playlist, tracks);
    }
    getSyncList() {
        return new Promise((resolve, reject) => {
            this.taskProgress.text = _('Initializing');
            this.process.getSyncListAsync(this.taskProgress).then((files) => {
                this.files = files;
                if (this.taskProgress.terminated) {
                    reject(this._ERR_TERMINATED);
                }
                else {
                    resolve();
                }
            }, reject);
        });
    }
    linkTracks() {
        return new Promise((resolve, reject) => {
            // sometimes the same tracks are accessibly by both the sync target and our MM5 instance
            // in such a cases the tracks don't need to be uploaded, but just "linked" by the sync target
            // e.g. in case of MM5-MMS sync
            let syncHandler = mediaSyncHandlers[this.device.handlerID];
            if (syncHandler.linkTracks) {
                syncHandler.linkTracks(this, this.files, this.taskProgress).then(() => {
                    if (this.taskProgress.terminated) {
                        reject(this._ERR_TERMINATED);
                    }
                    else {
                        resolve();
                    }
                }, reject);
            }
            else
                resolve();
        });
    }
    checkFreeSpace() {
        return new Promise((resolve, reject) => {
            this.process.checkFreeSpaceAsync().then1((res) => {
                if (!res)
                    this.taskProgress.terminate();
                resolve();
            });
        });
    }
    getStorageInfo() {
        return new Promise((resolve, reject) => {
            this.taskProgress.text = _('Initializing');
            let syncHandler = mediaSyncHandlers[this.device.handlerID];
            if (syncHandler.getStorageInfo) {
                syncHandler.getStorageInfo(this.device).then((info) => {
                    this.device.setCapacityAsync(info.spaceTotal.toString(), info.spaceUsed.toString()).then(resolve, reject);
                }, (err) => {
                    resolve(); // e.g. some cloud services (like Google Music) cannot get storage info, not critical
                });
            }
            else
                resolve();
        });
    }
    removeFile(target) {
        let handler = mediaSyncHandlers[this.device.handlerID];
        if (handler.removeFile)
            return handler.removeFile(this, target);
        else if (handler.removeFiles) {
            let paths = newStringList();
            paths.add(target);
            return handler.removeFiles(this, paths, app.utils.createTracklist());
        }
        else {
            assert(false, 'Either removeFile() or removeFiles() need to be defined for handler ' + this.device.handlerID);
        }
    }
    removeFiles(filePaths, tracks) {
        return new Promise((resolve, reject) => {
            logger.debug('MediaSync: removeFiles: count: ' + filePaths.count);
            if (filePaths.count == 0)
                resolve();
            else {
                let syncHandler = mediaSyncHandlers[this.device.handlerID];
                if (syncHandler.removeFiles && (!syncHandler.useSingleItemRemoval || !syncHandler.useSingleItemRemoval(this))) {
                    this.updateDeletionText(filePaths.count);
                    syncHandler.removeFiles(this, filePaths, tracks).then(() => {
                        logger.debug('MediaSync: removeFiles: success, count: ' + filePaths.count);
                        if (this.process && this.process.fileDeletionsSuccess)
                            this.process.fileDeletionsSuccess(filePaths).then(resolve);
                        else
                            resolve();
                    }, (err) => {
                        logger.debug('MediaSync: removeFiles: failure: ' + err);
                        reject(err);
                    });
                }
                else if (syncHandler.removeFile) {
                    let delFile = (idx) => {
                        if (idx >= filePaths.count)
                            resolve();
                        else if (!this.taskProgress.terminated) {
                            logger.debug('MediaSync: removeFile: ' + idx + '/' + filePaths.count);
                            let path = getValueAtIndex(filePaths, idx);
                            let track = undefined;
                            if (idx < tracks.count) // non-track paths (jpg, m3u are above this index)
                                track = getValueAtIndex(tracks, idx);
                            if (track)
                                this.taskProgress.text = _('Removing') + ' ' + idx + '/' + filePaths.count + '(' + track.title + ')';
                            else
                                this.taskProgress.text = _('Removing') + ' ' + idx + '/' + filePaths.count + '(' + path + ')';
                            syncHandler.removeFile(this, path, track).then(() => {
                                logger.debug('MediaSync: removeFile: success for ' + path);
                                if (this.process && this.process.fileDeletionSuccess) {
                                    this.process.fileDeletionSuccess(path).then(() => {
                                        delFile(idx + 1);
                                    });
                                }
                                else
                                    delFile(idx + 1);
                            }, (err) => {
                                logger.debug('MediaSync: removeFile: failure for ' + path + ', err: ' + err);
                                if (!this.taskProgress.terminated && this.process && this.process.fileDeletionFailure) {
                                    if (!path && track)
                                        path = cloudTools.getSourceInfo(track).path;
                                    this.process.fileDeletionFailure(path, err);
                                }
                                delFile(idx + 1);
                            });
                        }
                        else {
                            logger.debug('MediaSync: removeFiles: terminated');
                            reject(this._ERR_TERMINATED);
                        }
                    };
                    delFile(0);
                }
                else {
                    assert('removeFile(s) not defined for ' + this.device.handlerID + ' sync handler');
                }
            }
        });
    }
    removeOldContent() {
        return new Promise((resolve, reject) => {
            this.taskProgress.text = _('(Removing old content)');
            this.process.getDeleteListAsync().then((params) => {
                this.removeFiles(params.paths, params.tracks).then(resolve, reject);
            });
        });
    }
    runFileConversion() {
        return new Promise((resolve, reject) => {
            let syncHandler = mediaSyncHandlers[this.device.handlerID];
            let justMatching = (syncHandler.justMatchingSupport && syncHandler.justMatchingSupport(this.device));
            this.process.initFileConversion(justMatching).then(resolve, reject);
        });
    }
    uploadAdditionalFiles(files) {
        // copies additional track files like artwork or video subtitles
        let _this = this;
        return new Promise(function (resolve, reject) {
            function copyFile(idx) {
                if (idx >= files.count)
                    resolve();
                else if (!_this.taskProgress.terminated) {
                    let file = getValueAtIndex(files, idx);
                    let syncHandler = mediaSyncHandlers[_this.device.handlerID];
                    if (syncHandler.uploadFile) {
                        syncHandler.uploadFile(_this, file).then(function () {
                            logger.debug('MediaSync: uploadAdditionalFiles: success for ' + file.sourcePath);
                            copyFile(idx + 1);
                        }, function (err) {
                            logger.debug('MediaSync: uploadAdditionalFiles: failure for ' + file.sourcePath + ' , err:' + err);
                            copyFile(idx + 1);
                        });
                    }
                    else {
                        assert('uploadFile not defined for ' + _this.device.handlerID + ' sync handler');
                    }
                }
                else {
                    logger.debug('MediaSync: uploadAdditionalFiles: terminated');
                    reject(_this._ERR_TERMINATED);
                }
            }
            copyFile(0);
        });
    }
    downloadTracks() {
        let _this = this;
        return new Promise(function (resolve, reject) {
            if (_this.device.biDirSync) {
                _this.process.getFilesToDownloadAsync().then(function (files) {
                    let syncHandler = mediaSyncHandlers[_this.device.handlerID];
                    if (syncHandler.downloadFile) {
                        let _downloadFile = function (idx) {
                            if (idx >= files.count)
                                resolve();
                            else if (!_this.taskProgress.terminated) {
                                let file = getValueAtIndex(files, idx);
                                _this.taskProgress.text = sprintf(_('(Copying Device -> PC, %d of %d: %s)'), idx, files.count, file.track.title);
                                _this.taskProgress.nextLevel();
                                syncHandler.downloadFile(_this, file).then(function _resolve() {
                                    logger.debug('MediaSync: downloadTracks: success for ' + file.track.title);
                                    _this.process.fileDownloadSuccess(file).then(function () {
                                        _downloadFile(idx + 1);
                                    });
                                }, function _reject(err) {
                                    logger.debug('MediaSync: downloadTracks: failure for ' + file.track.title + ' , error: ' + err);
                                    if (!_this.taskProgress.terminated)
                                        _this.process.fileDownloadFailure(file, err);
                                    _downloadFile(idx + 1);
                                });
                            }
                            else {
                                logger.debug('MediaSync: downloadTracks: terminated by user');
                                reject(_this._ERR_TERMINATED);
                            }
                        };
                        _this.taskProgress.addLevels(files.count);
                        _downloadFile(0);
                    }
                    else {
                        logger.debug('MediaSync:downloadFile not defined for ' + _this.device.handlerID + ' sync handler');
                        resolve();
                    }
                });
            }
            else {
                resolve();
            }
        });
    }
    prepareTrackSource(info) {
        return new Promise((resolve, reject) => {
            cloudTools.getSourceUrl(info.track).then((url) => {
                if (!url && isURLPath(info.sourcePath))
                    url = info.sourcePath; // not a cloud track, but media server track or a track with permanent url            
                if (url) {
                    // this is a remote track, cache it locally:
                    app.utils.getTempFilePathAsync().then((tempPath) => {
                        this.taskProgress.addLevels(1); // add level for downloading
                        app.utils.web.getURLContentAsync(url, {
                            filePath: tempPath,
                            taskProgress: this.taskProgress
                        }).then((tempPath) => {
                            this.taskProgress.nextLevel(); // download level has finished
                            info.sourcePath = tempPath;
                            let _ext = getFileExt(info.targetPath);
                            if (!_ext) {
                                let ext = app.utils.web.getLinkExtension(url);
                                if (!ext) {
                                    let remotePath = cloudTools.getRemotePath(info.track);
                                    ext = getFileExt(remotePath);
                                }
                                info.targetPath = removeFileExt(info.targetPath) + '.' + ext;
                            }
                            info.addTempFile(tempPath);
                            resolve();
                        }, reject);
                    }, reject);
                }
                else {
                    resolve(); // is local track (no need to download anything)
                }
            }, reject);
        });
    }
    uploadTracks() {
        let files = this.files;
        if (!this.queue)
            this.taskProgress.addLevels(files.count);
        let sett = mediaSyncDevices.getCustomSettings(this.device);
        let deleteAfterUpload = sett.deleteAfterUpload;
        return new Promise((resolve, reject) => {
            let syncHandler = mediaSyncHandlers[this.device.handlerID];
            let previousItem = null;
            let copyNextTrack = () => {
                if (previousItem) {
                    previousItem.cleanTempFilesAsync();
                    previousItem = null;
                }
                if (this.taskProgress.terminated) {
                    logger.debug('MediaSync: uploadTracks: terminated by user');
                    reject(this._ERR_TERMINATED);
                }
                else if (this.process.uploadTrackIndex >= files.count)
                    resolve();
                else {
                    logger.debug('MediaSync: uploadTracks: ' + (this.process.uploadTrackIndex + 1) + '/' + files.count);
                    let matching = (syncHandler.justMatchingSupport && syncHandler.justMatchingSupport(this.device));
                    this.process.getNextUploadTrack(matching).then((info) => {
                        if (info) {
                            // track to upload is available
                            previousItem = info;
                            if (deleteAfterUpload)
                                info.deleteLocalCopy = true;
                            let alreadyUploadedCount = this.process.uploadTrackIndex;
                            if (this.queuedTracksUploadedCount)
                                alreadyUploadedCount += this.queuedTracksUploadedCount;
                            let act = _('Updating');
                            if (info.needUpload)
                                act = _('Copying');
                            if (matching)
                                act = _('Matching');
                            this.taskProgress.text = sprintf('(%s %d/%d: %s)', act, alreadyUploadedCount, this.queuedTracksCount || files.count, this._getFastTrack(info).summary);
                            if (alreadyUploadedCount > 1)
                                this.taskProgress.nextLevel();
                            let _progressCallback = (value) => {
                                this.taskProgress.value = value;
                            };
                            if (info.needUpload) {
                                // track needs to be uploaded
                                this.prepareTrackSource(info).then(() => {
                                    if (syncHandler.uploadTrack) {
                                        syncHandler.uploadTrack(this, info, _progressCallback).then((res) => {
                                            logger.debug('MediaSync: uploadTracks: upload success for ' + info.sourcePath);
                                            this.process.trackUploadSuccess(info).then(() => {
                                                if (!this.taskProgress.terminated) {
                                                    let pr;
                                                    if (res && res.skipUploadingAssociatedFiles)
                                                        pr = dummyPromise();
                                                    else
                                                        pr = this.uploadAdditionalFiles(info.files);
                                                    pr.then(() => {
                                                        if (syncHandler.updateTrack && !this.taskProgress.terminated && info.needMetadataUpdate)
                                                            syncHandler.updateTrack(this, info).then(copyNextTrack, copyNextTrack);
                                                        else
                                                            copyNextTrack();
                                                    }, reject);
                                                }
                                                else {
                                                    copyNextTrack();
                                                }
                                            });
                                        }, (err) => {
                                            logger.debug('MediaSync: uploadTracks: upload failure for ' + info.sourcePath + ', err: ' + err);
                                            if (!this.taskProgress.terminated)
                                                this.process.trackUploadFailure(info, err.toString());
                                            if (err == 'STORAGE_FULL')
                                                reject(this._ERR_TERMINATED); // no more tracks to copy, storage is full (#18360)
                                            else
                                                copyNextTrack();
                                        });
                                    }
                                    else {
                                        assert('uploadTrack not defined for ' + this.device.handlerID + ' sync handler');
                                    }
                                }, (err) => {
                                    logger.debug('MediaSync: uploadTracks: getting source stream url failure for ' + info.sourcePath + ', err: ' + err);
                                    if (!this.taskProgress.terminated)
                                        this.process.trackUploadFailure(info, err.toString());
                                    copyNextTrack();
                                });
                            }
                            else {
                                // track needs just update of metadata
                                if (syncHandler.updateTrack && info.needMetadataUpdate)
                                    syncHandler.updateTrack(this, info).then(copyNextTrack, (err) => {
                                        logger.debug('MediaSync: uploadTracks: metadata update failure for ' + info.sourcePath + ', err: ' + err);
                                        copyNextTrack();
                                    });
                                else
                                    copyNextTrack();
                            }
                        }
                        else {
                            // waiting for file conversion
                            this.process.getConvertionProgress().then((progress) => {
                                if (progress.operation == 'DOWNLOAD')
                                    this.taskProgress.text = sprintf('(' + _('Downloading file: %s') + ')', progress.track.title);
                                else if (progress.operation == 'CONVERT')
                                    this.taskProgress.text = sprintf('(' + _('Converting file: %s') + ')', progress.track.title);
                                this.taskProgress.value = progress.value;
                                window.requestTimeout(copyNextTrack, 500);
                            });
                        }
                    });
                }
            };
            copyNextTrack();
        });
    }
    _uploadPlaylists(playlists) {
        return new Promise((resolve, reject) => {
            let syncHandler = mediaSyncHandlers[this.device.handlerID];
            if (syncHandler.uploadPlaylist) {
                let copyPlaylist = (idx) => {
                    logger.debug('MediaSync: uploadPlaylists: ' + idx + '/' + playlists.count);
                    if (idx >= playlists.count)
                        resolve();
                    else if (!this.taskProgress.terminated) {
                        let playlist = getValueAtIndex(playlists, idx);
                        this.taskProgress.text = sprintf('(' + _('Copying playlist %s') + ')', (idx + 1) + '/' + playlists.count + ' - ' + playlist.name);
                        this.taskProgress.nextLevel();
                        logger.debug('MediaSync: uploading playlist ' + playlist.name + ', guid: ' + playlist.guid);
                        syncHandler.uploadPlaylist(this, playlist).then(() => {
                            logger.debug('MediaSync: playlist ' + playlist.name + ' successfuly uploaded');
                            copyPlaylist(idx + 1);
                        }, (err) => {
                            logger.debug('MediaSync: playlist ' + playlist.name + ' has failed to upload: ' + err);
                            if (!this.taskProgress.terminated)
                                this.process.playlistUploadFailure(playlist, err);
                            copyPlaylist(idx + 1);
                        });
                    }
                    else {
                        logger.debug('MediaSync: playlist upload terminated by user');
                        reject(this._ERR_TERMINATED);
                    }
                };
                copyPlaylist(0);
            }
            else {
                logger.debug('uploadPlaylist not defined for ' + this.device.handlerID + ' sync handler');
                resolve();
            }
        });
    }
    uploadPlaylists() {
        return new Promise((resolve, reject) => {
            this.taskProgress.text = '(' + _('Preparing playlists') + ')';
            this.process.getPlaylistsAsync().then((playlists) => {
                let syncHandler = mediaSyncHandlers[this.device.handlerID];
                if (syncHandler.filterPlaylists2Upload) {
                    syncHandler.filterPlaylists2Upload(this, playlists).then((playlists) => {
                        this._uploadPlaylists(playlists).then(resolve, reject);
                    }, reject);
                }
                else
                    this._uploadPlaylists(playlists).then(resolve, reject);
            });
        });
    }
    removeEmptySubfolders() {
        let _this = this;
        return new Promise(function (resolve, reject) {
            if (_this.device.deleteUnsync || _this.device.deleteUnknown) {
                _this.taskProgress.text = _('(Removing old content)');
                _this.process.getEmptyFoldersAsync().then(function (paths) {
                    let syncHandler = mediaSyncHandlers[_this.device.handlerID];
                    if (syncHandler.removeEmptyFolder) {
                        let delFolder = function (idx) {
                            if (idx >= paths.count)
                                resolve();
                            else if (!_this.taskProgress.terminated) {
                                let path = getValueAtIndex(paths, idx);
                                syncHandler.removeEmptyFolder(_this, path).then(function _resolve() {
                                    logger.debug('MediaSync: removeEmptyFolder: success for ' + path);
                                    delFolder(idx + 1);
                                }, function _reject(err) {
                                    logger.debug('MediaSync: removeEmptyFolder: failure for ' + path + ', err: ' + err);
                                    delFolder(idx + 1);
                                });
                            }
                            else {
                                logger.debug('MediaSync: removeEmptyFolder: terminated');
                                reject(_this._ERR_TERMINATED);
                            }
                        };
                        delFolder(0);
                    }
                    else {
                        resolve(); // removeEmptyFolder is optional
                    }
                });
            }
            else {
                resolve();
            }
        });
    }
    startProcess(mode) {
        mediaSyncDevices.registerSync(this);
        this.process = this.device.createSyncProcess(mode);
        return new Promise((resolve, reject) => {
            this.process.startAsync().then(() => {
                let syncHandler = mediaSyncHandlers[this.device.handlerID];
                if (syncHandler.startSyncing)
                    syncHandler.startSyncing(this, mode).then(resolve, reject);
                else
                    resolve();
            }, reject);
        });
    }
    _finishProcess(success) {
        this.process.finishAsync(success).then(() => {
            this.taskProgress.terminate();
            mediaSyncDevices.unregisterSync(this);
        });
    }
    finishProcess(success) {
        let syncHandler = mediaSyncHandlers[this.device.handlerID];
        if (syncHandler.finishSyncing) {
            syncHandler.finishSyncing(this, this.process.mode, success).then(() => {
                this._finishProcess(success);
            }, () => {
                this._finishProcess(false);
            });
        }
        else
            this._finishProcess(success);
    }
    getStreamUrl(device, file) {
        let handler = mediaSyncHandlers[device.handlerID];
        if (handler.getStreamUrl)
            return handler.getStreamUrl(device, file);
        else
            return dummyPromise(file.path);
    }
    getStreamUrls(device, files) {
        let handler = mediaSyncHandlers[device.handlerID];
        if (handler.getStreamUrls)
            return handler.getStreamUrls(device, files);
        else
            return dummyPromise();
    }
    _readContentFromMetaFiles(device, info_file, files) {
        return new Promise((resolve, reject) => {
            let ms = mediaSyncDevices.getMetadataStorage(device);
            if (!info_file)
                ms.readContent().then(resolve);
            else {
                this.getStreamUrl(device, info_file).then1((info_url) => {
                    return ms.filterFilesToImport(files, info_url);
                }).then(() => {
                    return this.getStreamUrls(device, files);
                }).then(() => {
                    ms.serverContentChanged = (files.count > 0);
                    return ms.importFromFiles(files);
                }).then(() => {
                    return ms.readContent();
                }).then(() => {
                    resolve(true /* meta files exist*/);
                });
            }
        });
    }
    readMetaFiles(device, sync /* optional */, retryNumber) {
        let handler = mediaSyncHandlers[device.handlerID];
        let metadataStorage = mediaSyncDevices.getMetadataStorage(device);
        if (metadataStorage.bypass)
            return dummyPromise();
        return new Promise((resolve, reject) => {
            if (sync && !retryNumber)
                sync.taskProgress.text = _('Reading metadata');
            handler.getFolderContent(device, handler.getMetadataDirectory(metadataStorage)).then((content) => {
                let files = content.files;
                let info_file;
                let sync_lock_file;
                files.locked(() => {
                    for (let i = 0; i < files.count; i++) {
                        let file = files.getValue(i);
                        let title = file.title;
                        if (file.path)
                            title = getJustFilename(file.path);
                        ODS('MediaSync: readMetaFiles: file: ' + title);
                        if (title == metadataStorage.getFileName('info'))
                            info_file = file;
                        if (title == metadataStorage.getFileName('lock'))
                            sync_lock_file = file;
                    }
                });
                if (sync) {
                    if (sync_lock_file) {
                        // we are trying to start sync, but sync lock is acquired! -- waiting                    
                        this.getStreamUrl(device, sync_lock_file).then1((url) => {
                            return metadataStorage.parseSyncLockFile(url);
                        }).then((lockInfoText) => {
                            ODS('MediaSync: readMetaFiles: lockInfoText: ' + lockInfoText);
                            if (lockInfoText == 'OUR_LOCK') { // was actually our lock file from the last sync
                                this._readContentFromMetaFiles(device, info_file, files).then(resolve);
                            }
                            else if (lockInfoText == 'OLD_LOCK') { // isn't our lock, but is too old, it is safe to replace it
                                this._releaseSyncLock(metadataStorage, sync).then(() => {
                                    this._acquireSyncLock(metadataStorage, sync).then(() => {
                                        this._readContentFromMetaFiles(device, info_file, files).then(resolve);
                                    });
                                });
                            }
                            else {
                                sync.taskProgress.text = _('Waiting for sync connection') + ': ' + lockInfoText;
                                window.requestTimeout(() => {
                                    if (sync.taskProgress.terminated)
                                        resolve(undefined);
                                    else {
                                        if (!retryNumber)
                                            retryNumber = 0;
                                        retryNumber++;
                                        this.readMetaFiles(device, sync, retryNumber).then(resolve);
                                    }
                                }, 2000);
                            }
                        }, (err) => {
                            ODS('MediaSync: readMetaFiles: lock info parsing error: ' + err);
                            reject(err);
                        });
                    }
                    else {
                        //acquire our sync lock
                        this._acquireSyncLock(metadataStorage, sync).then(() => {
                            this._readContentFromMetaFiles(device, info_file, files).then(resolve);
                        });
                    }
                }
                else
                    this._readContentFromMetaFiles(device, info_file, files).then(resolve);
            }, (err) => {
                logger.debug('readMetaFiles: Metadata directory does not exist: ' + handler.getMetadataDirectory(metadataStorage) + ' (' + err + ')');
                this._readContentFromMetaFiles(device).then(resolve);
            });
        });
    }
    uploadFile(source, target) {
        let handler = mediaSyncHandlers[this.device.handlerID];
        let file = {
            sourcePath: source,
            targetPath: target
        };
        return handler.uploadFile(this, file);
    }
    exportMetaFiles(sync) {
        let handler = mediaSyncHandlers[sync.device.handlerID];
        let metadataStorage = mediaSyncDevices.getMetadataStorage(sync.device);
        let _this = this;
        return new Promise((resolve, reject) => {
            if (metadataStorage.bypass)
                resolve();
            else {
                sync.taskProgress.text = _('Uploading metadata');
                metadataStorage.flush().then(() => {
                    metadataStorage.exportToFiles(true /* compressed*/).then((files) => {
                        // metadata files to upload (zipped delta JSON and/or SQLite database)
                        function copyFile(idx) {
                            if ((idx >= files.count) || sync.taskProgress.terminated) {
                                _this._releaseSyncLock(metadataStorage, sync).then1(resolve); // release sync lock and finish
                            }
                            else {
                                let source = getValueAtIndex(files, idx);
                                let fname = app.utils.getFilename(source);
                                let target = handler.getMetadataDirectory(metadataStorage) + handler.PATH_SEPARATOR + fname;
                                sync.taskProgress.text = _('Uploading metadata') + ' - ' + fname;
                                _this.removeFile(target).then1(function () {
                                    _this.uploadFile(source, target).then1(function () {
                                        copyFile(idx + 1);
                                    });
                                });
                            }
                        }
                        copyFile(0);
                    });
                });
            }
        });
    }
    _acquireSyncLock(metadataStorage, sync) {
        let handler = mediaSyncHandlers[sync.device.handlerID];
        return new Promise((resolve, reject) => {
            metadataStorage.generateSyncLockFile().then((source) => {
                let target = handler.getMetadataDirectory(metadataStorage) + handler.PATH_SEPARATOR + metadataStorage.getFileName('lock');
                this.uploadFile(source, target).then1(resolve);
            });
        });
    }
    _releaseSyncLock(metadataStorage, sync) {
        let handler = mediaSyncHandlers[sync.device.handlerID];
        return this.removeFile(handler.getMetadataDirectory(metadataStorage) + handler.PATH_SEPARATOR + metadataStorage.getFileName('lock'));
    }
    scanContent(device) {
        return new Promise((resolve, reject) => {
            let syncHandler = mediaSyncHandlers[device.handlerID];
            if (syncHandler.scanContentForSync) {
                // e.g. 'cloud' handler defined own scanContent method
                syncHandler.scanContentForSync(device, this.taskProgress).then((tracks) => {
                    if (this.taskProgress.terminated)
                        reject(this._ERR_TERMINATED);
                    else if (tracks) {
                        device.setContentAsync(tracks).then(resolve);
                    }
                    else {
                        device.scanContentAsync(true).then(resolve); // this uses last "synced" content (from DeviceTracks table)
                    }
                }, reject);
            }
            else {
                // scans content internally (e.g. for 'usb'  handler -- or uses the last "synced" content for other handlers without scanContent method)
                device.scanContentAsync(true).then(resolve);
            }
        });
    }
    /**
    Scans remote (cloud/device) content into library
    
    @method scanToLibrary
    */
    scanToLibrary() {
        return new Promise((resolve, reject) => {
            mediaSyncDevices.registerSync(this);
            this.taskProgress = app.backgroundTasks.createNew();
            this.taskProgress.leadingText = sprintf(_('Scanning %s:'), this.device.name);
            this.taskProgress.text = _('Reading metadata');
            let _resolve = () => {
                this.taskProgress.terminate();
                mediaSyncDevices.unregisterSync(this);
                resolve();
            };
            let _reject = (err) => {
                this.taskProgress.terminate();
                mediaSyncDevices.unregisterSync(this);
                reject(err);
            };
            let syncHandler = mediaSyncHandlers[this.device.handlerID];
            if (syncHandler.scanContent) {
                if (syncHandler.getContentSignature) {
                    let sett = mediaSyncDevices.getCustomSettings(this.device);
                    logger.debug('MediaSync: scanToLibrary: ' + this.device.name + ' => content signature: last: ' + sett.content_signature);
                    syncHandler.getContentSignature(this.device, sett.content_signature).then((sign) => {
                        logger.debug('MediaSync: scanToLibrary: ' + this.device.name + ' => content signature: current: ' + sign + ', last: ' + sett.content_signature);
                        if (sett.content_signature != sign || !sett.content_signature || !sign) {
                            if (this.taskProgress.terminated)
                                _reject(this._ERR_TERMINATED);
                            else
                                this.__scanToLibrary(syncHandler, sett.content_signature).then(() => {
                                    // success, store the signature so that we don't need to scan needlessly next time
                                    let sett = mediaSyncDevices.getCustomSettings(this.device);
                                    sett.content_signature = sign;
                                    mediaSyncDevices.setCustomSettings(this.device, sett);
                                    _resolve();
                                }, _reject);
                        }
                        else {
                            logger.debug('MediaSync: scanToLibrary: signature has not changed, we are done');
                            _resolve(); // signature hasn't changed (no content changes detected), we are done
                        }
                    }, _reject);
                }
                else {
                    this.__scanToLibrary(syncHandler).then(_resolve, _reject);
                }
            }
            else {
                _reject('scanContent method missing for handler ' + this.device.handlerID);
            }
        });
    }
    __scanToLibrary(syncHandler, last_content_signature) {
        return new Promise((resolve, reject) => {
            logger.debug('MediaSync: __scanToLibrary: ' + this.device.name + ', last_content_signature: ' + last_content_signature);
            let _runFullScan = () => {
                logger.debug('MediaSync: __scanToLibrary: ' + this.device.name + ' => _runFullScan');
                syncHandler.scanContent(this.device, null, 'scan').then((tracks) => {
                    this._updateTracks2Lib(tracks, false, true).then(() => {
                        this._scanPlaylists(syncHandler).then(resolve, reject);
                    }, reject);
                }, reject);
            };
            if (last_content_signature && syncHandler.getContentChanges) {
                syncHandler.getContentChanges(this.device, last_content_signature, 'scan').then((changes) => {
                    let playlists2update = changes.playlists.added.concat(changes.playlists.updated);
                    asyncForEach(playlists2update, (playlist, next) => {
                        if (this.taskProgress.terminated)
                            next();
                        else
                            this._updatePlaylist2Library(syncHandler, playlist).then(next, next);
                    }, () => {
                        let deletedTracks = app.utils.createTracklist();
                        this._updateTracks2Lib(changes.tracks.added, false).then(() => {
                            return this._updateTracks2Lib(changes.tracks.updated, true); // updates tracks metadata changes into local library
                        }).then(() => {
                            return deletedTracks.asyncFill(changes.tracks.deleted.length, (idx, track) => {
                                track.dontNotify = true;
                                track.sync_id = changes.tracks.deleted[idx];
                            });
                        }).then(() => {
                            return this.device.removeTracksFromLibrary(false /* no confirmation */, deletedTracks); // deleted no longer existing tracks from the local library
                        }).then(resolve, reject);
                    });
                }, _runFullScan /* content changes failure, run full scan*/);
            }
            else {
                _runFullScan();
            }
        });
    }
    _updatePlaylist2Library(syncHandler, playlist) {
        return new Promise((resolve, reject) => {
            let canUsePartialPlaylists = (syncHandler.justMatchingSupport && syncHandler.justMatchingSupport(this.device)); // #18396
            let tracks = syncHandler.listPlaylistContent(this.device, playlist);
            tracks.whenLoaded().then(() => {
                logger.debug('MediaSync: _updatePlaylist2Library: name: ' + playlist.name + ', guid: ' + playlist.guid + ', last_modified: ' + playlist.last_modified + ', tracks count: ' + tracks.count);
                this.device.updatePlaylist2Library(playlist.name, playlist.guid || '', playlist.parent_guid || '', playlist.last_modified || '', playlist.criteria || '', tracks, canUsePartialPlaylists).then(resolve, reject);
            });
        });
    }
    _scanPlaylists(syncHandler, parent_playlist) {
        return new Promise((resolve, reject) => {
            syncHandler.listPlaylists(this.device, parent_playlist, {
                purpose: 'scan',
                device: this.device
            }).then((playlists) => {
                if (parent_playlist)
                    logger.debug('MediaSync: _scanPlaylists: count: ' + playlists.count + ', parent: ' + parent_playlist.name);
                else
                    logger.debug('MediaSync: _scanPlaylists: count: ' + playlists.count + ', parent: root');
                let _processPlaylist = (idx) => {
                    if (idx >= playlists.count) {
                        resolve();
                    }
                    else if (!this.taskProgress.terminated) {
                        let playlist = getValueAtIndex(playlists, idx);
                        this.taskProgress.text = sprintf('%d / %d: %s', idx, playlists.count, playlist.name);
                        logger.debug('MediaSync: _scanPlaylists: ' + this.taskProgress.text);
                        this.taskProgress.value = idx / playlists.count;
                        if (!playlist.parent_guid && parent_playlist && parent_playlist.guid)
                            playlist.parent_guid = parent_playlist.guid;
                        this._updatePlaylist2Library(syncHandler, playlist).then1(() => {
                            this._scanPlaylists(syncHandler, playlist).then(() => {
                                _processPlaylist(idx + 1);
                            }, reject);
                        });
                    }
                    else {
                        reject(this._ERR_TERMINATED);
                    }
                };
                _processPlaylist(0);
            }, reject);
        });
    }
    _updateTracks2Lib(tracks, replaceExisting, isFullScan) {
        return new Promise((resolve, reject) => {
            logger.debug('MediaSync: _updateTracks2Lib: count: ' + tracks.count + ', replaceExisting: ' + replaceExisting);
            let sett = mediaSyncDevices.getCustomSettings(this.device);
            if (sett.scan_mediaType && sett.scan_mediaType >= 0) {
                fastForEach(tracks, (track) => {
                    track.trackType = sett.scan_mediaType; // #14923
                });
            }
            let scheduled = mediaSyncDevices._isScheduledSyncInterval(sett.scan_interval_ms);
            this.device.addTracks2Library(tracks, replaceExisting, false, this.taskProgress, isFullScan || false).then((pars) => {
                resolve();
                if (!scheduled) {
                    // show log when the scan was manually initiated (#15360)
                    let confsett = window.settings.get().Confirmations;
                    if (confsett.ConfirmScanResults) {
                        uitools.openDialog('dlgScanResults', {
                            modal: true,
                            scanInfo: pars.scaninfo,
                            filesInLib: pars.filesInLib
                        });
                    }
                }
            }, (err) => {
                if (this.taskProgress.terminated)
                    reject(this._ERR_TERMINATED);
                else
                    reject(err);
            });
        });
    }
    downloadTracks2Library() {
        let _this = this;
        return new Promise(function (resolve, reject) {
            mediaSyncDevices.registerSync(_this);
            _this.taskProgress = app.backgroundTasks.createNew();
            _this.taskProgress.leadingText = sprintf(_('Initializing download from %s'), _this.device.name);
            let _resolve = function () {
                mediaSyncDevices.unregisterSync(_this);
                _this.taskProgress.terminate();
                resolve();
            };
            _this.device.getTracksToDownload().then(function (tracks) {
                // inits download of this tracks (adds to download queue)
                // stream url is got on demand later, app.downloader calls 'change' event with 'streamUrlRequest' (once the file is about to be downloaded)        
                app.trackOperation.downloadFiles(tracks);
                _resolve();
            }, _resolve);
        });
    }
    _getFastTrack(info) {
        if (info.getTrackFast) {
            this._fastTrackAccess = info.getTrackFast(this._fastTrackAccess);
            return this._fastTrackAccess;
        }
        else {
            return info.track;
        }
    }
}
registerClass(MediaSync);
