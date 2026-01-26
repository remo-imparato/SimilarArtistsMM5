/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

'use strict';
registerFileImport('helpers/cloudServices');
// This unit manages access to cloud services (e.g. for cloud sync)
requirejs('helpers/arrayDataSource');
requirejs('utils');
window.cloudServices = {}; // all custom cloud services (like Google Drive, DropBox, etc.) are added to this object by scripts
// !!! see dropBox, googleDrive, oneDrive, googleMusicUploader scripts in the /scripts/ directory !!!
// ------------------------------------------------------------------------------------------------------------------------------------------------------------
window.cloudTools = {
    serviceInstanceCache: {},
    PATH_SEPARATOR: '/',
    FILESYSTEM_PATH_SEPARATOR: app.filesystem.getPathSeparator(),
    normPath: function (path, toFileSystem) {
        if (toFileSystem)
            return replaceAll(this.PATH_SEPARATOR, this.FILESYSTEM_PATH_SEPARATOR, path);
        else
            return replaceAll(this.FILESYSTEM_PATH_SEPARATOR, this.PATH_SEPARATOR, path);
    },
    trim: function (path) {
        let _path = path;
        if (_path.charAt(0) == this.PATH_SEPARATOR)
            _path = _path.substr(1);
        if (_path.charAt(_path.length - 1) == this.PATH_SEPARATOR)
            _path = _path.substr(0, _path.length - 1);
        return _path;
    },
    getPathParts: function (path) {
        let _path = this.trim(path);
        return _path.split(this.PATH_SEPARATOR);
    },
    _loadSuppFileExtList: function () {
        let ar = [];
        let list = app.filesystem.getScanExtensions();
        fastForEach(list, function (item) {
            ar.push(item.toString().toLowerCase());
        });
        this._suppExtensions = ar;
        setTimeout(function () {
            if (!window._cleanUpCalled)
                this._suppExtensions = null;
        }.bind(this), 3000);
    },
    getFileExt: function (path) {
        let dot_pos = path.lastIndexOf('.');
        let back_pos = path.lastIndexOf(this.FILESYSTEM_PATH_SEPARATOR);
        let slash_pos = path.lastIndexOf(this.PATH_SEPARATOR);
        if ((dot_pos > 0) && (dot_pos > back_pos) && (dot_pos > slash_pos))
            return path.substr(dot_pos + 1, path.length).toLowerCase();
        else
            return '';
    },
    syncIdFromPath: function (path) {
        return removeFileExt(this.normPath(path, true)).toLowerCase();
    },
    isSupportedFileExt: function (path) {
        let dot_pos = path.lastIndexOf('.');
        if (dot_pos > 0) {
            let ext = path.substr(dot_pos + 1, path.length).toLowerCase();
            if (ext == 'm3u' || ext == 'm3u8' || ext == 'pla' || ext == 'pls')
                return false; // #20026
            if (!this._suppExtensions)
                this._loadSuppFileExtList();
            return (this._suppExtensions.indexOf(ext) >= 0);
        }
        else
            return false;
    },
    removeLastPathPart: function (path) {
        return path.substr(0, path.lastIndexOf(this.PATH_SEPARATOR));
    },
    getLastPathPart: function (path) {
        return path.substr(path.lastIndexOf(this.PATH_SEPARATOR) + 1);
    },
    checkFirstSlash: function (path) {
        if (path.indexOf(this.PATH_SEPARATOR) == 0)
            return path;
        else
            return this.PATH_SEPARATOR + path;
    },
    removeLastSlash: function (path) {
        if (path.lastIndexOf(this.PATH_SEPARATOR) == (path.length - 1))
            return path.substr(0, path.length - 1);
        else
            return path;
    },
    getRedirectURI: function (use_IP_in_redirect) {        
        let ip = 'http://localhost:';
        if (use_IP_in_redirect)
            ip = 'http://127.0.0.1:';        
        return ip + app.sharing.getAuthServerPort() + '/MM/auth/'; // our auth server is running, we will get the AC code from the GET request uri to our auth server
    },
    getAuthURL: function (service) {
        return service.getAuthURL(this.getRedirectURI(service.use_IP_in_redirect));
    },
    getAuthData: function (service) {
        let sd = service._authData;
        return {
            client_version: sd.client_version || 1,
            accessToken: sd.accessToken,
            refreshToken: sd.refreshToken,
            tokenExpiration: sd.tokenExpiration,
            tokenType: sd.tokenType
        };
    },
    setAuthData: function (service, authData) {
        service._authData.client_version = authData.client_version;
        service._authData.accessToken = authData.accessToken;
        service._authData.refreshToken = authData.refreshToken;
        service._authData.tokenExpiration = authData.tokenExpiration;
        service._authData.tokenType = authData.tokenType;
    },
    storeAuthState: function (service) {
        let device = service.device;
        if (device) {
            // log-on and auth info stored per device/storage profile (so that user can use more accounts of the same service)
            let sett = mediaSyncDevices.getCustomSettings(device);
            sett.serviceInfo.authData = cloudTools.getAuthData(service);
            mediaSyncDevices.setCustomSettings(device, sett);
            device.commitAsync();
        }
    },
    getUserInfo: function (service) {
        if (service.getUserInfo)
            return service.getUserInfo();
        else
            return new Promise(function (resolve) {
                resolve(undefined);
            });
    },
    authorize: function (service, webControl) {
        service.isAuthorizing = true;
        return new Promise(function (resolve) {
            let _authURL = cloudTools.getAuthURL(service);
            let dlgWeb;
            if (webControl)
                webControl.controlClass.url = _authURL;
            else {
                if (service.needsExternalAuth) { // to open in the default browser -- e.g. GPM uses it (as in some environments it can be considered as XSRF attack -- see #15676 for details)
                    window.uitools.openWeb(_authURL);
                }
                else {
                    let defSize = service.logWindowDefaultSize || {
                        width: 500,
                        height: 600
                    };
                    defSize.top = thisWindow.bounds.top + ((thisWindow.bounds.height - defSize.height) / 2);
                    defSize.left = thisWindow.bounds.left + ((thisWindow.bounds.width - defSize.width) / 2);
                    dlgWeb = uitools.openDialog('dlgWeb', {
                        modal: true,
                        top: defSize.top,
                        left: defSize.left,
                        width: defSize.width,
                        height: defSize.height,
                        url: _authURL
                    });
                    app.listen(dlgWeb, 'closed', function () {
                        service.isAuthorizing = false;
                    });
                }
            }
            app.sharing.runAuthServer();
            let authReceiver = app.sharing.getAuthReceiver();
            app.unlisten(authReceiver, 'change');
            app.listen(authReceiver, 'change', function () {
                app.unlisten(authReceiver, 'change');
                service._getAccessToken(authReceiver.authCode, cloudTools.getRedirectURI(service.use_IP_in_redirect)).then(function () {
                    if (dlgWeb)
                        dlgWeb.closeWindow();
                    app.sharing.stopAuthServer();
                    service.isAuthorizing = false;
                    resolve(undefined);
                });
            });
        });
    },
    unauthorize: function (service) {
        return new Promise(function (resolve) {
            service._authData.accessToken = '';
            service._authData.refreshToken = '';
            cloudTools.storeAuthState(service);
            resolve(undefined);
        });
    },
    _XHR_request: function (pars) {
        let request = new XMLHttpRequest();
        if (pars.doneCallback)
            request.onreadystatechange = function () {
                if (request.readyState == request.DONE) {
                    pars.doneCallback(request.status, request.responseText);
                }
            };
        request.open(pars.method, pars.uri, true);
        if (pars.headers) {
            let keys = Object.keys(pars.headers);
            for (let i = 0; i < keys.length; i++) {
                let key = keys[i];
                let value = pars.headers[key];
                value = cloudTools.encode_utf8(value); // header values needs to be UTF-8 encoded to be valid (throws exception for unicode chars otherwise)
                request.setRequestHeader(key, value);
            }
        }
        if (pars.progressCallback)
            request.upload.onprogress = function (e) {
                if (!pars.progressCallback(e))
                    request.abort();
            };
        if (pars.content) {
            if (pars.content.constructor === String) {
                request.send(pars.content);
            }
            else {
                let fileBuffer = pars.content;
                let arrayBuffer = fileBuffer.getArrayBuffer().slice(0);
                let dataView = new Uint8Array(arrayBuffer);
                request.send(dataView);
            }
        }
        else {
            request.send();
        }
    },
    encode_utf8: function (s) {
        // LS: taken from http://monsur.hossa.in/2012/07/20/utf-8-in-javascript.html
        return unescape(encodeURIComponent(s));
    },
    decode_utf8: function (s) {
        return decodeURIComponent(escape(s));
    },
    _native_request: function (pars) {
        let headers;
        if (pars.headers) {
            headers = newStringList();
            let keys = Object.keys(pars.headers);
            for (let i = 0; i < keys.length; i++) {
                let key = keys[i];
                let value = pars.headers[key];
                headers.add(key + ':' + value);
            }
        }
        app.utils.web.requestAsync({
            uri: pars.uri,
            method: pars.method,
            headers: headers,
            doneCallback: pars.doneCallback,
            progressCallback: function (read) {
                if (pars.progressCallback)
                    return pars.progressCallback({
                        lengthComputable: true,
                        loaded: read
                    });
                else
                    return true;
            },
            content: pars.content
        });
    },
    request: function (pars, prefer_native) {
        if (!pars.content && !prefer_native) {
            // LS: currently we don't use XHR for uploading as XHR.send() leaks memory and allocating bigger ArrayBuffer can throw AV in libcef.dll
            //     also when two same XHR GET requests are initiated at the same time (with same URI) then the latter fails
            //     therefore we might want to always use only native request (via Indy) ?
            this._XHR_request(pars);
        }
        else
            this._native_request(pars);
    },
    createTrack: function (service, onDemandInfo) {
        let track = app.utils.createEmptyTrack();
        this.createSourceInfo(track, service, onDemandInfo);
        return track;
    },
    getServerTrackID: function (track) {
        let sourceInfo = this.getSourceInfo(track);
        return sourceInfo.id;
    },
    getStreamUrl: function (file, service) {
        if (file.cacheStatus == cloudTools.CACHE_STREAMED && file.webSource) {
            let sourceInfo = JSON.parse(file.webSource);
            if (!service)
                service = cloudTools.serviceInstanceCache[sourceInfo.device_id];
            if (!service)
                return dummyPromise('no longer existing service'); // e.g. GPM was removed
            if (!service.getStreamUrl) {
                // when service hasn't getStreamUrl defined
                if (file.path)
                    return dummyPromise(file.path);
                else
                    return dummyPromise('no stream url for service ' + resolveToValue(service.title));
            }
            else
                return service.getStreamUrl(sourceInfo);
        }
        else {
            return dummyPromise(file.path);
        }
    },
    getStreamInfo: function (file, service) {
        if (file.cacheStatus == cloudTools.CACHE_STREAMED && file.webSource) {
            let sourceInfo = JSON.parse(file.webSource);
            if (!service)
                service = cloudTools.serviceInstanceCache[sourceInfo.device_id];
            if (service && service.getStreamInfo) {
                return service.getStreamInfo(file);
            }
        }
    },
    getStreamUrls: function (files, service) {
        let _this = this;
        return new Promise(function (resolve, reject) {
            function getForFile(idx) {
                if (idx >= files.count)
                    resolve(undefined);
                else {
                    let file = getValueAtIndex(files, idx);
                    _this.getStreamUrl(file, service).then1(function (url) {
                        file.path = url;
                        getForFile(idx + 1);
                    });
                }
            }
            getForFile(0);
        });
    },
    CACHE_DOWNLOADED: _utils.CACHE_DOWNLOADED,
    CACHE_STREAMED: _utils.CACHE_STREAMED,
    createSourceInfo: function (track, service, onDemandInfo, dontChangeStatus) {
        track.dontNotify = true;
        let info = onDemandInfo || {};
        info.sourceType = 'cloud'; // needed in _onHTMLPlaybackState below
        info.service_id = service.id; // needed in _onHTMLPlaybackState below
        info.device_id = service.device_id; // device profile id
        track.webSource = JSON.stringify(info);
        if (!dontChangeStatus)
            track.cacheStatus = cloudTools.CACHE_STREAMED; // e.g. for the icon in tracklist (trackListView.js > fieldDefs > source)
        if (!track.sync_id && info.id)
            track.sync_id = info.id;
        track.dontNotify = false;
    },
    getSourceInfo: function (track) {
        if (track.webSource)
            return JSON.parse(track.webSource);
        else
            return {};
    },
    getRemotePath: function (track, forced) {
        // if track.path != '' then it is the temporal stream link got in getStreamUrl(s) above
        if (track.cacheStatus == cloudTools.CACHE_STREAMED && (track.path == '' || forced)) {
            let sourceInfo = cloudTools.getSourceInfo(track);
            if (sourceInfo.path)
                return this.normPath(sourceInfo.path, true);
        }
        return track.path;
    },
    addRemoteArtwork: function (track) {
        return new Promise((resolve, reject) => {
            if (_utils.isCloudTrack(track)) {
                app.devices.getTrackSourceInfoAsync(track).then(() => {
                    let sourceInfo = cloudTools.getSourceInfo(track);
                    if (!track.coverList.count && sourceInfo.sourceType && sourceInfo.device_id) { // currently 'cloud' and 'server' types do it this way
                        requirejs('helpers/mediaSync');
                        let handler = mediaSyncHandlers[sourceInfo.sourceType];
                        if (handler && handler.getArtworkUrl) {
                            let device = mediaSyncDevices.getById(sourceInfo.device_id);
                            if (device) {
                                handler.getArtworkUrl(device, track).then(function (url) {
                                    track.addCoverAsync(url).then1(() => {
                                        track.coverList.isLoaded = true;
                                        resolve(undefined);
                                    });
                                }, reject);
                            }
                            else
                                reject('Device profile does not exist, device_id: ' + sourceInfo.device_id);
                        }
                        else
                            reject('getArtworkUrl() missing for handler ' + sourceInfo.sourceType);
                    }
                    else
                        reject('already added');
                });
            }
            else
                reject('is not remote track');
        });
    },
    getSourceUrl: function (track) {
        return new Promise((resolve, reject) => {
            let needPrepare;
            if (_utils.isCloudTrack(track)) {
                let sourceInfo = cloudTools.getSourceInfo(track);
                ODS('cloudTools.getSourceUrl: ' + JSON.stringify(sourceInfo));
                if (sourceInfo.sourceType && sourceInfo.device_id) { // currently 'cloud' and 'server' types are played this way                     
                    requirejs('helpers/mediaSync');
                    let handler = mediaSyncHandlers[sourceInfo.sourceType];
                    if (handler && handler.getStreamUrl) {
                        needPrepare = true;
                        let device = mediaSyncDevices.getById(sourceInfo.device_id);
                        if (device) {
                            ODS('cloudTools.getSourceUrl: remote track ' + track.title + ' getting stream url via profile: ' + device.name);
                            handler.getStreamUrl(device, track).then((streamURL) => {
                                resolve(streamURL);
                            }, reject);
                        }
                        else {
                            let err = sourceInfo.sourceType + ' profile does not exist anymore, profile id: ' + sourceInfo.device_id;
                            ODS('cloudTools.getSourceUrl: ' + err);
                            reject(err);
                        }
                    }
                }
            }
            if (!needPrepare)
                resolve(undefined);
        });
    },
    _onHTMLPlaybackState: function (state, value) {
        let track;
        switch (state) {
            case 'play':
                track = app.player.getCurrentTrack();
                if (!track)
                    return;
                if (_utils.isCloudTrack(track)) {
                    cloudTools.getSourceUrl(track).then((streamURL) => {
                        track.path = streamURL;
                        app.player.playAsync();
                    }, (err) => {
                        ODS('cloudTools._onHTMLPlaybackState: skipping to the next track because of error: ' + err);
                        app.player.nextAsync(false, true /* cannot play*/);
                    });
                }
                break;
        }
    },
    registerPlayback: function () {
        if (!this._isPlaybackRegistered) {
            app.listen(app.player, 'htmlPlaybackState', this._onHTMLPlaybackState);
            this._isPlaybackRegistered = true;
        }
    },
};
