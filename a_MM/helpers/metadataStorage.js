/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

'use strict';
import ArrayDataSource from './arrayDataSource';
/**
MetadataStorage

@class MetadataStorage
@constructor
*/
export default class MetadataStorage {
    constructor(profile_id) {
        this.handler = app.sharing.createMetadataStorageHandler(profile_id);
        this.db_dump_items_treshold = 100; // this means that the delta JSON will include 100 items at max, otherwise it dumps into database
        //this.bypass = true; // uncomment this to bypass metadata storage
    }
    updateTrack(id, path, metadata) {
        if (this.bypass)
            return dummyPromise();
        else
            return this.handler.updateTrack(id, path, metadata);
    }
    updatePlaylist(playlist) {
        if (this.bypass)
            return dummyPromise();
        else
            return this.handler.updatePlaylist(playlist);
    }
    deletePlaylist(playlist) {
        if (this.bypass)
            return dummyPromise();
        else
            return this.handler.deletePlaylist(playlist.guid);
    }
    removeTrack(id) {
        if (!this.bypass)
            this.handler.removeTrack(id);
    }
    readContent() {
        if (this.bypass)
            return dummyPromise();
        else
            return this.handler.readContent();
    }
    getTracklist() {
        let list = app.utils.createTracklist();
        this.fillTracklist(list);
        return list;
    }
    fillTracklist(list) {
        return this.handler.fillTracklist(list);
    }
    listPlaylists(parent) {
        let _this = this;
        return new Promise(function (resolve, reject) {
            let parent_id;
            if (!parent)
                parent_id = ''; // root
            else
                parent_id = parent.id;
            _this.handler.listPlaylists(parent_id).then(function (list) {
                let playlists = new ArrayDataSource([]);
                list.locked(function () {
                    for (let i = 0; i < list.count; i++) {
                        let pl = list.getValue(i);
                        playlists.add({
                            name: pl.name,
                            id: pl.guid,
                            guid: pl.guid,
                            last_modified: pl.lastModified,
                            criteria: pl.getCriteriaJSON(),
                            trackSyncIDs: pl.trackSyncIDs,
                            hasChildren: pl.hasChildren
                        });
                    }
                });
                resolve({
                    playlists: playlists
                });
            });
        });
    }
    listPlaylistContent(playlist, list) {
        return this.handler.fillTracklist(list, playlist.trackSyncIDs);
    }
    sheduledFlush(delayMS) {
        if (this._delayedFlushTimeout)
            clearTimeout(this._delayedFlushTimeout);
        this._delayedFlushTimeout = setTimeout(function () {
            this.flush();
        }.bind(this), delayMS);
    }
    flush() {
        if (this.bypass)
            return dummyPromise();
        else {
            return this.handler.flush(this.db_dump_items_treshold);
        }
    }
    exportToFiles(compressed) {
        if (this.bypass)
            return dummyPromise();
        else
            return this.handler.exportToFiles(compressed);
    }
    filterFilesToImport(files, info_url) {
        if (this.bypass)
            return dummyPromise(files);
        else
            return this.handler.filterFilesToImport(files, info_url);
    }
    importFromFiles(files) {
        if (this.bypass)
            return dummyPromise();
        else
            return this.handler.importFromFiles(files);
    }
    deleteLocalFiles() {
        if (this.bypass)
            return dummyPromise();
        else
            return this.handler.deleteLocalFiles();
    }
    assignTracklistMetadata(list) {
        return new Promise((resolve, reject) => {
            let metaList = app.utils.createTracklist();
            metaList.autoUpdateDisabled = true;
            this.fillTracklist(metaList);
            metaList.whenLoaded().then(() => {
                this._mergeWithRealContent(list, metaList, 'sync_id').then(function () {
                    resolve(list);
                });
            });
        });
    }
    _mergeWithRealContent(realList, metaList, mergeType) {
        if (this.bypass)
            return dummyPromise();
        else
            return this.handler.mergeWithRealContent(realList, metaList, mergeType);
    }
    getFileName(type) {
        if (type == 'info') {
            return 'info.json';
        }
        else if (type == 'lock') {
            return 'sync_lock.json';
        }
        else {
            assert(false, 'MetadataStorage.getFileName(): Unknown type: ' + type);
        }
    }
    getVersion() {
        return this.handler.getVersion();
    }
    generateSyncLockFile() {
        if (this.bypass)
            return dummyPromise('');
        else
            return this.handler.generateSyncLockFile();
    }
    parseSyncLockFile(url) {
        if (this.bypass)
            return dummyPromise('');
        else
            return this.handler.parseSyncLockFile(url);
    }
}
registerClass(MetadataStorage);
