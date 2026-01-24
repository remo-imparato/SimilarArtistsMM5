/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

window.cloudServices.dropBox = {
    title: 'Dropbox',
    icon: 'dropbox',
    needsExternalAuth: true, // LS: not needed, but seems safer to open the log on screen in the default browser

    logWindowDefaultSize: {
        width: 500,
        height: 700
    },

    _authData: {
        client_type: 'dropbox',
        client_version: 2,
        CSRF_token: 'FuY2Ugb2YgZGVsaW', // base 64, 16 byte random number        
        accessToken: '',
        refreshToken: '',
        tokenExpiration: 0, // when the accessToken expires and needs to be refreshed via refreshToken            
        tokenType: 'Bearer',
    },

    _getAccessToken: function (authorizationCode, redirect_uri) {
        var _this = this;

        // starting from 12/2021 DropBox now returns the authorization code like
        //  "-LyQ6YjtVgAAAAAAAAAAUK1p3DexTcny3-lLtux0ZGw&state=FuY2Ugb2YgZGVsaW"
        //  instead of just
        // "-LyQ6YjtVgAAAAAAAAAAUK1p3DexTcny3-lLtux0ZGw"
        // ...and then it rejects the 'state' part when trying to exchange the code for token.
        // => remove the state (or any other) param (issue #18702)
        var ampPos = authorizationCode.indexOf('&');
        if (ampPos)
            authorizationCode = authorizationCode.substr(0, ampPos);

        return new Promise(function (resolve, reject) {
            var request = new XMLHttpRequest();
            request.onreadystatechange = function () {
                if (request.readyState == request.DONE) {
                    if (request.status === 200) {
                        var tokenInfo = JSON.parse(request.responseText);
                        _this._authData.accessToken = tokenInfo.access_token;
                        _this._authData.refreshToken = tokenInfo.refresh_token;
                        _this._authData.tokenExpiration = Date.now() + ((tokenInfo.expires_in - 5) * 1000); // subtracted 5 seconds for sure (because of #15025)
                        _this._authData.tokenType = tokenInfo.token_type;
                        if (_this._authData.tokenType == 'bearer')
                            _this._authData.tokenType = 'Bearer'; // otherwise DropBox returns "authorization header is not well formed"
                        cloudTools.storeAuthState(_this);
                        resolve();
                    } else {
                        reject('Authorization error: ' + request.status + ' :' + request.responseText);
                    }
                }
            };
            request.open('POST', 'https://api.dropbox.com/oauth2/token', true);
            request.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
            var postData = 'grant_type=authorization_code&code=' + authorizationCode + app.utils.web.getClientKey(_this._authData.client_type, _this._authData.client_version, true) + '&redirect_uri=' + redirect_uri;
            try {
                request.send(postData);
            } catch (err) {
                reject(err);
            }
        });
    },

    _refreshAccessToken: function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var request = new XMLHttpRequest();
            request.onreadystatechange = function () {
                if (request.readyState == request.DONE) {
                    if (request.status === 200 && !window._cleanUpCalled) {
                        var tokenInfo = JSON.parse(request.responseText);
                        _this._authData.accessToken = tokenInfo.access_token;
                        _this._authData.tokenExpiration = Date.now() + ((tokenInfo.expires_in - 5) * 1000); // subtracted 5 seconds for sure (because of #15025)
                        _this._authData.tokenType = tokenInfo.token_type;
                        if (_this._authData.tokenType == 'bearer')
                            _this._authData.tokenType = 'Bearer'; // otherwise DropBox returns "authorization header is not well formed"
                        cloudTools.storeAuthState(_this);
                        resolve();
                    } else {
                        reject('Authorization error: ' + request.status + ' :' + request.responseText);
                    }
                }
            };
            request.open('POST', 'https://api.dropbox.com/oauth2/token', true);
            request.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
            var postData = 'grant_type=refresh_token&refresh_token=' + _this._authData.refreshToken + app.utils.web.getClientKey(_this._authData.client_type, _this._authData.client_version, true);
            try {
                request.send(postData);
            } catch (err) {
                reject(err);
            }
        });
    },

    getAuthURL: function (redirect_uri) {
        return 'https://www.dropbox.com/oauth2/authorize?state=' + this._authData.CSRF_token + '&redirect_uri=' + redirect_uri + '&response_type=code&token_access_type=offline' + app.utils.web.getClientKey(this._authData.client_type, this._authData.client_version, false);
    },

    isAuthorized: function () {
        if (this._authData.accessToken && this._authData.refreshToken)
            return true;
        else
            return false;
    },

    checkAuth: function (whenAuthorized) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            if (!_this.isAuthorized())
                reject(_this.title + ' not authorized');

            if (_this._authData.tokenExpiration < Date.now())
                _this._refreshAccessToken().then(function () {
                    whenAuthorized(resolve, reject);
                }, reject);
            else
                whenAuthorized(resolve, reject);
        });
    },

    getStorageInfo: function () {
        var _this = this;
        return this.checkAuth(function (resolve, reject) {
            var request = new XMLHttpRequest();
            request.onreadystatechange = function () {
                if (request.readyState == request.DONE) {
                    if (request.status === 200) {
                        var info = JSON.parse(request.responseText);
                        resolve({
                            spaceTotal: info.allocation.allocated,
                            spaceUsed: info.used
                        });
                    } else {
                        reject('getStorageInfo error: ' + request.status + ' :' + request.responseText);
                    }
                }
            };
            request.open('POST', 'https://api.dropboxapi.com/2/users/get_space_usage', true);
            request.setRequestHeader('Authorization', _this._authData.tokenType + ' ' + _this._authData.accessToken);
            try {
                request.send();
            } catch (err) {
                reject(err);
            }
        });
    },

    getUserInfo: function () {
        var _this = this;
        return this.checkAuth(function (resolve, reject) {
            var request = new XMLHttpRequest();
            request.onreadystatechange = function () {
                if (request.readyState == request.DONE) {
                    if (request.status === 200) {
                        var info = JSON.parse(request.responseText);
                        resolve({
                            user: info.name.display_name,
                            email: info.email
                        });
                    } else {
                        reject('getUserInfo error: ' + request.status + ' :' + request.responseText);
                    }
                }
            };
            request.open('POST', 'https://api.dropboxapi.com/2/users/get_current_account', true);
            request.setRequestHeader('Authorization', _this._authData.tokenType + ' ' + _this._authData.accessToken);
            try {
                request.send();
            } catch (err) {
                reject(err);
            }
        });
    },

    listContent: function (path, aFiles, recursive, all_files, cursor /*continuation cursor*/ ) {
        var _this = this;
        return this.checkAuth(function (resolve, reject) {
            var request = new XMLHttpRequest();
            request.onreadystatechange = function () {
                if (request.readyState == request.DONE) {
                    if (request.status === 200) {
                        var info = JSON.parse(request.responseText);
                        var files = aFiles || app.utils.createTracklist();
                        var _whenLoaded = files.whenLoaded();
                        var folders = new ArrayDataSource([]);
                        var any_deleted;
                        if (info.entries) { // in one ELP (C62E4A73) the info.entries was missing, how is that possible?
                            var items = info.entries;
                            for (var i = 0; i < items.length; i++) {
                                var item = items[i];
                                var type = item['.tag'];
                                if (type == 'file') {
                                    if (!all_files && !cloudTools.isSupportedFileExt(item.name)) // to filter '*.txt', '*.docx', '*.jpg' etc.
                                        continue;
                                    var file = cloudTools.createTrack(_this, {
                                        // info needed only on demand in getStreamUrl()
                                        path: item.path_display
                                    });
                                    file.dontNotify = true;
                                    file.sync_id = cloudTools.syncIdFromPath(item.path_display);
                                    file.title = item.name;
                                    file.path = ''; //item.path_display;
                                    file.fileLength = item.size;
                                    file.dontNotify = false;
                                    files.add(file);
                                } else
                                if (type == 'folder') {
                                    var folder = {};
                                    folder.title = item.name;
                                    folder.path = item.path_display;
                                    folders.add(folder);
                                } else
                                if (type == 'deleted') {
                                    any_deleted = true;
                                }

                                if (isPromiseCanceled(_whenLoaded))
                                    break;
                            }
                        }

                        if (info.has_more && info.cursor && !isPromiseCanceled(_whenLoaded)) {
                            _this.listContent(path, files, recursive, all_files, info.cursor /* continuation*/ ).then(function (content) {
                                files.notifyLoaded();
                                resolve({
                                    folders: folders,
                                    files: files,
                                    any_deleted: any_deleted
                                });
                            }, (err) => {
                                files.notifyLoaded();
                                reject(err);
                            });
                        } else {
                            files.notifyLoaded();
                            resolve({
                                folders: folders,
                                files: files,
                                any_deleted: any_deleted
                            });
                        }
                    } else {
                        reject('listContent error: ' + request.status + ' :' + request.responseText);
                    }
                }
            };
            var folderPath = ''; // root
            if (path)
                folderPath = path;

            var data = {
                path: folderPath,
                recursive: recursive,
                //include_media_info: true // returns just dimensions for images (no info for music files)
            };
            var uriParams = '';
            if (cursor) {
                uriParams = '/continue';
                data = {
                    cursor: cursor
                };
            }

            request.open('POST', 'https://api.dropboxapi.com/2/files/list_folder' + uriParams, true);
            request.setRequestHeader('Authorization', _this._authData.tokenType + ' ' + _this._authData.accessToken);
            request.setRequestHeader('Content-Type', 'application/json');
            try {
                request.send(JSON.stringify(data));
            } catch (err) {
                reject(err);
            }
        });
    },

    getContentSignature: function (last_cursor) {
        var _this = this;
        return this.checkAuth(function (resolve, reject) {

            if (last_cursor) {
                // using last cursor at first to find whether there are any changes:
                var files = app.utils.createTracklist();
                _this.listContent(null /*root*/ , files, true /*recursive*/ , false, last_cursor).then(function (content) {
                    if (files.count > 0 || content.any_deleted) {
                        // some files changed, get the latest cursor
                        _this.getContentSignature(null /* to get the latest cursor*/ ).then(resolve, reject);
                    } else {
                        // no changes, return the last cursor
                        resolve(last_cursor);
                    }
                }, reject);
            } else {
                // get the latest cursor:
                var request = new XMLHttpRequest();
                request.onreadystatechange = function () {
                    if (request.readyState == request.DONE) {
                        if (request.status === 200) {
                            var info = JSON.parse(request.responseText);
                            resolve(info.cursor);
                        } else {
                            reject('getContentSignature error: ' + request.status + ' :' + request.responseText);
                        }
                    }
                };
                var data = {
                    path: '', // root
                    recursive: true
                };
                request.open('POST', 'https://api.dropboxapi.com/2/files/list_folder/get_latest_cursor', true);
                request.setRequestHeader('Authorization', _this._authData.tokenType + ' ' + _this._authData.accessToken);
                request.setRequestHeader('Content-Type', 'application/json');
                try {
                    request.send(JSON.stringify(data));
                } catch (err) {
                    reject(err);
                }
            }
        });
    },

    _commitChunkedUpload: function (params, progressCallback) {
        var _this = this;
        return this.checkAuth(function (resolve, reject) {

            cloudTools.request({
                method: 'POST',
                uri: 'https://content.dropboxapi.com/2/files/upload_session/finish',
                headers: {
                    'Authorization': _this._authData.tokenType + ' ' + _this._authData.accessToken,
                    'Content-Type': params.mimeType,
                    'Content-Length': params.size,
                    'Dropbox-API-Arg': JSON.stringify({
                        cursor: {
                            session_id: params.session_id,
                            offset: params.size
                        },
                        commit: {
                            path: params.path,
                            mode: 'add',
                            autorename: true,
                            mute: false
                        }
                    })
                },
                doneCallback: function (status, responseText) {
                    if (status == 200) {
                        resolve();
                    } else {
                        reject('Commit upload file error: ' + status + ' :' + responseText);
                    }
                }
            });
        });
    },

    CHUNK_SIZE: 1048576 * 4, // 4 MB is typical chunk according to DropBox docs (maximum is 150 MB)

    resumeFileUpload: function (params, progressCallback) {
        var _this = this;
        return this.checkAuth(function (resolve, reject) {
            // resumable file upload:                                    
            var startOffset = 0;
            if (params.startOffset)
                startOffset = params.startOffset;

            var performCommit = false;
            if (!params.endOffset || (params.endOffset && (params.endOffset == params.size)))
                performCommit = true;

            cloudTools.request({
                method: 'POST',
                uri: 'https://content.dropboxapi.com/2/files/upload_session/append_v2',
                content: params.content,
                progressCallback: progressCallback,
                headers: {
                    'Authorization': _this._authData.tokenType + ' ' + _this._authData.accessToken,
                    'Content-Type': params.mimeType,
                    //'Content-Length': params.endOffset - startOffset,
                    'Dropbox-API-Arg': JSON.stringify({
                        cursor: {
                            session_id: params.session_id,
                            offset: startOffset
                        },
                        close: false
                    })
                },
                doneCallback: function (status, responseText) {
                    if (status == 200) {
                        if (performCommit)
                            _this._commitChunkedUpload(params, progressCallback).then(resolve, reject);
                        else
                            resolve();
                    } else {
                        reject('Resume upload file error: ' + status + ' :' + responseText);
                    }
                }
            });
        });
    },

    uploadFile: function (params, progressCallback) {
        var _this = this;
        return this.checkAuth(function (resolve, reject) {            
            if (params.sourcePath.startsWith( app.filesystem.getUserFolder() + 'Dropbox')) {
                reject('File already in DropBox folder: ' + app.filesystem.getUserFolder() + 'Dropbox');
                return;
            }

            var request = new XMLHttpRequest();
            request.onreadystatechange = function () {
                if (request.readyState == request.DONE) {
                    if (request.status === 200) {
                        var info = JSON.parse(request.responseText);
                        params.session_id = info.session_id;
                        _this.resumeFileUpload(params, progressCallback).then(resolve, reject);
                    } else {
                        reject('Upload file error: ' + request.status + ' :' + request.responseText);
                    }
                }
            };
            request.open('POST', 'https://content.dropboxapi.com/2/files/upload_session/start', true);
            request.setRequestHeader('Authorization', _this._authData.tokenType + ' ' + _this._authData.accessToken);
            request.setRequestHeader('Dropbox-API-Arg', JSON.stringify({
                close: false
            }));
            request.setRequestHeader('Content-Type', params.mimeType);
            request.setRequestHeader('Content-Length', params.size);
            try {
                request.send();
            } catch (err) {
                reject(err);
            }
        });
    },

    deleteItem: function (params) {
        var _this = this;
        return this.checkAuth(function (resolve, reject) {
            var request = new XMLHttpRequest();
            request.onreadystatechange = function () {
                if (request.readyState == request.DONE) {
                    if (request.status === 204 || request.status === 200 || request.status === 404 /* no longer exists*/ ) {
                        resolve();
                    } else {
                        reject('Delete file error: ' + request.status + ' :' + request.responseText);
                    }
                }
            };
            request.open('POST', 'https://api.dropbox.com/2/files/delete', true);
            request.setRequestHeader('Authorization', _this._authData.tokenType + ' ' + _this._authData.accessToken);
            request.setRequestHeader('Content-Type', 'application/json');

            var path = cloudTools.checkFirstSlash(params.path);
            path = cloudTools.removeLastSlash(path);
            try {
                request.send(JSON.stringify({
                    path: path
                }));
            } catch (err) {
                reject(err);
            }
        });
    },

    createPath: function (path) {
        var _this = this;
        return this.checkAuth(function (resolve, reject) {
            var request = new XMLHttpRequest();
            request.onreadystatechange = function () {
                if (request.readyState == request.DONE) {
                    if (request.status === 200 /*created*/ || request.status === 403 /*already exists*/ ) {
                        resolve();
                    } else {
                        reject('Create folder error: ' + request.status + ' :' + request.responseText);
                    }
                }
            };
            var uriParams = 'root=auto&path=' + path;
            request.open('POST', 'https://api.dropboxapi.com/2/files/create_folder?' + uriParams, true);
            request.setRequestHeader('Authorization', _this._authData.tokenType + ' ' + _this._authData.accessToken);
            request.setRequestHeader('Content-Type', 'application/json');

            var path = cloudTools.checkFirstSlash(params.path);
            path = cloudTools.removeLastSlash(path);
            try {
                request.send(JSON.stringify({
                    path: path,
                    autorename: false
                }));
            } catch (err) {
                reject(err);
            }
        });
    },

    getStreamUrl: function (sourceInfo) {
        var _this = this;
        var path = sourceInfo.path;
        return this.checkAuth(function (resolve, reject) {

            var sep = app.filesystem.getPathSeparator();
            var cachePath = app.filesystem.getUserFolder() + 'DropBox' + sep + 'Apps' + sep + 'MediaMonkey' + cloudTools.normPath(path, true);
            app.filesystem.fileExistsAsync(cachePath).then((exists) => {
                if (exists) {
                    ODS('DropBox desktop app seems to be installed, use the cached file directly from there');
                    resolve(cachePath);
                } else {
                    // get the temporary stream link:
                    var request = new XMLHttpRequest();
                    request.onreadystatechange = function () {
                        if (request.readyState == request.DONE) {
                            if (request.status === 200) {
                                var info = JSON.parse(request.responseText);
                                if (!window._cleanUpCalled) {
                                    app.utils.web.setLinkExtension(info.link, cloudTools.getFileExt(path)); // just to speed up playback init (no need to get MIME type)
                                    app.utils.web.setLinkExpiration(url, 4 * 60 * 60); // 4 hours
                                }
                                resolve(info.link); // this link will expire in four hours and afterwards you will get 410 Gone
                            } else {
                                reject('getStreamUrl error: ' + request.status + ' :' + request.responseText);
                            }
                        }
                    };
                    var uriParams = 'root=auto&path=' + path;
                    request.open('POST', 'https://api.dropboxapi.com/2/files/get_temporary_link', true);
                    request.setRequestHeader('Authorization', _this._authData.tokenType + ' ' + _this._authData.accessToken);
                    request.setRequestHeader('Content-Type', 'application/json');

                    var _path = cloudTools.checkFirstSlash(path);
                    _path = cloudTools.removeLastSlash(_path);
                    try {
                        request.send(JSON.stringify({
                            path: _path
                        }));
                    } catch (err) {
                        reject(err);
                    }
                }
            });
        });
    },
};

// Create DropBox limited version (sync/access to app folder only):
window.cloudServices.dropBoxLimited = window.copyObject(window.cloudServices.dropBox);
window.cloudServices.dropBoxLimited.title = 'Dropbox (app folder)';
window.cloudServices.dropBoxLimited._authData.client_version = 3;
