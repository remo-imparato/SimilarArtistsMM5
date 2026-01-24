/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

window.cloudServices.oneDrive = {
    title: 'OneDrive',
    needsExternalAuth: true, // needs external auth -- otherwise in some environments the login dialog isn't rendered correctly (see #13765 for details)

    logWindowDefaultSize: {
        height: 600,
        width: 800
    },

    _authData: {
        client_type: 'onedrive',
        client_version: 2,
        scope: 'wl.offline_access onedrive.readwrite',
        accessToken: '',
        refreshToken: '',
        tokenExpiration: 0, // when the accessToken expires and needs to be refreshed via refreshToken  
        tokenType: 'Bearer',
    },

    _getAccessToken: function (authorizationCode, redirect_uri) {
        var _this = this;
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
                        cloudTools.storeAuthState(_this);
                        resolve();
                    } else {
                        reject('Authorization error: ' + request.status + ' :' + request.responseText);
                    }
                }
            };
            request.open('POST', 'https://login.live.com/oauth20_token.srf', true);
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
                        cloudTools.storeAuthState(_this);
                        resolve();
                    } else {
                        reject('Authorization error: ' + request.status + ' :' + request.responseText);
                    }
                }
            };
            request.open('POST', 'https://login.live.com/oauth20_token.srf', true);
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
        return 'https://login.live.com/oauth20_authorize.srf?scope=' + this._authData.scope + '&redirect_uri=' + redirect_uri + '&response_type=code' + app.utils.web.getClientKey(this._authData.client_type, this._authData.client_version, false);
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
                            spaceTotal: info.quota.total,
                            spaceUsed: info.quota.used
                        });
                    } else {
                        reject('getStorageInfo error: ' + request.status + ' :' + request.responseText);
                    }
                }
            };
            request.open('GET', 'https://api.onedrive.com/v1.0/drive', true);
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
                        var r2 = new XMLHttpRequest();
                        r2.onreadystatechange = function () {
                            if (r2.readyState == r2.DONE) {
                                if (r2.status === 200) {
                                    var info2 = JSON.parse(r2.responseText);
                                    resolve({
                                        user: info2.name
                                    });
                                } else {
                                    reject('getUserInfo error: ' + request.status + ' :' + request.responseText);
                                }
                            }
                        };
                        r2.open('GET', 'https://apis.live.net/v5.0/' + info.id + '?access_token=' + _this._authData.accessToken, true);
                        try {
                            r2.send();
                        } catch (err) {
                            reject(err);
                        }
                    } else {
                        reject('getUserInfo error: ' + request.status + ' :' + request.responseText);
                    }
                }
            };
            request.open('GET', 'https://api.onedrive.com/v1.0/drive', true);
            request.setRequestHeader('Authorization', _this._authData.tokenType + ' ' + _this._authData.accessToken);
            try {
                request.send();
            } catch (err) {
                reject(err);
            }
        });
    },

    getStreamUrl: function (sourceInfo) {
        var _this = this;
        return this.checkAuth(function (resolve, reject) {

            /* LS: following disabled as the OneDrive client can be disabled and cached files outdated ( #20026 )
            var sep = app.filesystem.getPathSeparator();
            var cachePath = app.filesystem.getUserFolder() + 'OneDrive' + cloudTools.normPath(sourceInfo.path, true);
            app.filesystem.fileExistsAsync(cachePath).then((exists) => {
                if (exists) {
                    ODS('OneDrive desktop app is installed and the file is chached, take it directly from there');
                    resolve(cachePath);
                } else {*/
                    var need_auth_link = 'https://api.onedrive.com/v1.0/drive/items/';
                    if (sourceInfo.id)
                        need_auth_link = need_auth_link + sourceInfo.id + '/content';
                    else
                        need_auth_link = need_auth_link + 'root:/' + cloudTools.trim(sourceInfo.path) + ':/content';

                    var public_link_assigned = false;

                    var _resolve = function (url) {
                        if (!window._cleanUpCalled) {
                            app.utils.web.setLinkExtension(url, cloudTools.getFileExt(sourceInfo.path)); // just to speed up playback init (no need to get MIME type)                
                            app.utils.web.setLinkExpiration(url, 3 * 60); // "a few minutes" accoring to https://dev.onedrive.com/items/download.htm
                        }
                        resolve(url);
                    }

                    var request = new XMLHttpRequest();
                    request.onreadystatechange = function () {
                        if (request.responseURL != '') {
                            _resolve(request.responseURL); // this is a public temporal link, expires in a few minutes according to https://dev.onedrive.com/items/download.htm 
                            public_link_assigned = true;
                            request.abort();
                        }
                        if (request.readyState == request.DONE && !public_link_assigned) {
                            if (request.responseURL != '') {
                                _resolve(request.responseURL);
                            } else {
                                _resolve(need_auth_link);
                            }
                        }
                    };
                    request.open('GET', need_auth_link, true);
                    request.setRequestHeader('Authorization', _this._authData.tokenType + ' ' + _this._authData.accessToken);
                    try {
                        request.send();
                    } catch (err) {
                        reject(err);
                    }
            /*    }
            });*/
        });
    },

    listContent: function (path, aFiles, recursive, all_files) {
        var _this = this;
        return this.checkAuth(function (resolve, reject) {
            var request = new XMLHttpRequest();
            var items = [];
            var files = aFiles || app.utils.createTracklist();
            var folders = new ArrayDataSource([]);

            request.onreadystatechange = function () {
                if (request.readyState == request.DONE) {
                    if (request.status === 200) {

                        var _whenLoaded = files.whenLoaded();
                                                
                        var info = JSON.parse(request.responseText);
                        if (info.value) // based on log C62EACD8 it happened that info.value was undefined
                            items.push(...info.value);

                        ODS('OneDrive: listContent: count: ' + items.length + ', keys: ' + Object.keys(info).join(', ') + '| '+ info['@odata.nextLink']);
                                                
                        if (info['@odata.nextLink'] && !isPromiseCanceled(_whenLoaded)) {
                            // further items are available via nextPage link, continue...
                            request.open('GET', info['@odata.nextLink'], true);
                            request.setRequestHeader('Authorization', _this._authData.tokenType + ' ' + _this._authData.accessToken);
                            try {
                                request.send();
                            } catch (err) {
                                files.notifyLoaded(); // #17979
                                reject(err);
                            }
                        } else {
                            
                            for (var i = 0; i < items.length; i++) {
                                var item = items[i];
                                if (!item.folder) {
                                    if (!all_files && !cloudTools.isSupportedFileExt(item.name)) // to filter '*.txt', '*.docx', '*.jpg' etc.
                                        continue;
                                    var _path = (path ? path + '/' + item.name : '/' + item.name);
                                    var file = cloudTools.createTrack(_this, {
                                        // info needed only on demand in getStreamUrl()
                                        id: item.id,
                                        path: _path
                                    });
                                    file.dontNotify = true;
                                    file.sync_id = cloudTools.syncIdFromPath(_path);
                                    file.title = item.name;
                                    //file.path = item['@content.downloadUrl']; // just temporal link for unauthorized access
                                    //file.path = 'https://api.onedrive.com/v1.0/drive/items/' + item.id + '/content';
                                    file.path = ''; // will be obtained via getStreamUrl() above
                                    file.fileLength = item.size;
                                    file.dontNotify = false;
                                    files.add(file);
                                } else {
                                    var folder = {};
                                    folder.title = item.name;
                                    folder.path = (path ? path + '/' + item.name : '/' + item.name);
                                    folders.add(folder);
                                }
                                if (isPromiseCanceled(_whenLoaded))
                                    break;
                            }                            

                            if (!recursive || folders.count == 0 || isPromiseCanceled(_whenLoaded)) {
                                files.notifyLoaded();
                                resolve({
                                    folders: folders,
                                    files: files
                                });
                            } else {
                                var _fldCnt = folders.count;
                                for (var i = 0; i < folders.count; i++) {
                                    var folder = folders.getValue(i);
                                    _this.listContent(folder.path, files, recursive, all_files).then1(function () {
                                        _fldCnt--;
                                        if (_fldCnt == 0) {
                                            files.notifyLoaded();
                                            resolve({
                                                files: files
                                            });
                                        }
                                    });
                                }
                            }
                        }
                    } else {
                        reject('listContent error: ' + request.status + ' :' + request.responseText);
                    }
                }
            };

            var uri = 'https://api.onedrive.com/v1.0/drive/root/children'; // root
            if (path)
                uri = 'https://api.onedrive.com/v1.0/drive/root:' + path + ':/children';

            request.open('GET', uri, true);
            request.setRequestHeader('Authorization', _this._authData.tokenType + ' ' + _this._authData.accessToken);
            try {
                request.send();
            } catch (err) {
                reject(err);
            }
        });
    },

    getContentSignature: function (last_signature) {
        var _this = this;
        return this.checkAuth(function (resolve, reject) {
            var request = new XMLHttpRequest();
            request.onreadystatechange = function () {
                if (request.readyState == request.DONE) {
                    if (request.status === 200) {
                        var info = JSON.parse(request.responseText);
                        var value = info.value;
                        if (!last_signature)
                            resolve(info['@delta.token']);
                        else
                        if (value.length == 0) {
                            // no new items
                            resolve(last_signature);
                        } else
                        if (value.length > 0) {
                            _this.getContentSignature(null /* to get the latest token*/ ).then(resolve, reject);
                        }

                    } else {
                        reject('getContentSignature error: ' + request.status + ' :' + request.responseText);
                    }
                }
            };

            var uri = 'https://api.onedrive.com/v1.0/drive/root/view.delta?token=';
            if (last_signature)
                uri = uri + last_signature
            else
                uri = uri + 'latest';
            request.open('GET', uri, true);
            request.setRequestHeader('Authorization', _this._authData.tokenType + ' ' + _this._authData.accessToken);
            request.setRequestHeader('Accept', 'application/json');
            try {
                request.send();
            } catch (err) {
                reject(err);
            }
        });
    },

    _commitChunkedUpload: function (params, progressCallback) {
        var _this = this;
        return this.checkAuth(function (resolve, reject) {
            var request = new XMLHttpRequest();
            request.onreadystatechange = function () {
                if (request.readyState == request.DONE) {
                    if (request.status === 200 || request.status === 201 /*created*/ ) {
                        resolve();
                    } else {
                        reject('Commit upload file error: ' + request.status + ' :' + request.responseText);
                    }
                }
            };

            var pathParts = cloudTools.getPathParts(params.path);
            var folderPath = '';
            if (pathParts.length > 1)
                folderPath = cloudTools.removeLastPathPart(params.path);

            var uri = 'https://api.onedrive.com/v1.0/drive/root';
            if (folderPath != '')
                uri = 'https://api.onedrive.com/v1.0/drive/root:/' + folderPath;

            request.open('PUT', uri, true);
            request.setRequestHeader('Authorization', _this._authData.tokenType + ' ' + _this._authData.accessToken);
            request.setRequestHeader('Content-Type', 'application/json');

            var filename = pathParts[pathParts.length - 1];
            var postData = {
                name: filename,
                //description: 'file description',
                '@name.conflictBehavior': 'rename',
                '@content.sourceUrl': params.uploadUrl
            }
            request.send(JSON.stringify(postData));
        });
    },

    CHUNK_SIZE: 1048576 * 5, // 5 - 10 MB is recommended chunk according to OneDrive docs    

    resumeFileUpload: function (params, progressCallback) {
        var _this = this;
        return this.checkAuth(function (resolve, reject) {
            // resumable file upload:                                    
            var startOffset = 0;
            if (params.startOffset)
                startOffset = params.startOffset;

            var endOffset = params.size;
            if (params.endOffset)
                endOffset = params.endOffset;

            var performCommit = (endOffset == params.size);

            cloudTools.request({
                method: 'PUT',
                uri: params.uploadUrl,
                content: params.content,
                progressCallback: progressCallback,
                headers: {
                    'Authorization': _this._authData.tokenType + ' ' + _this._authData.accessToken,
                    'Content-Type': params.mimeType,
                    'Content-Length': endOffset - startOffset,
                    'Content-Range': 'bytes ' + startOffset + '-' + (endOffset - 1) + '/' + params.size,
                },
                doneCallback: function (status, responseText) {
                    if (status == 200 || status == 201 /* created */ || status == 202 /* accepted */ ) {
                        //if (performCommit && status != 201)
                        //    _this._commitChunkedUpload(params, progressCallback).then(resolve, reject); // seems no longer needed and actually returns HTTP 400 for already existing items
                        //else
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

            if (params.sourcePath.startsWith( app.filesystem.getUserFolder() + 'OneDrive')) {
                reject('File already in OneDrive folder: ' + app.filesystem.getUserFolder() + 'OneDrive');
                return;
            } 

            var performRequest = function () {
                var request = new XMLHttpRequest();
                request.onreadystatechange = function () {
                    if (request.readyState == request.DONE) {
                        if (request.status === 200) {
                            var info = JSON.parse(request.responseText);
                            params.uploadUrl = info.uploadUrl;
                            _this.resumeFileUpload(params, progressCallback).then(resolve, reject);
                        } else {
                            reject('Upload file error: ' + request.status + ' :' + request.responseText);
                        }
                    }
                };

                var uri = 'https://api.onedrive.com/v1.0/drive/root:/' + cloudTools.trim(params.path) + ':/upload.createSession';
                request.open('POST', uri, true);
                request.setRequestHeader('Authorization', _this._authData.tokenType + ' ' + _this._authData.accessToken);
                request.setRequestHeader('Content-Type', 'application/json');

                try {
                    request.send();
                } catch (err) {
                    reject(err);
                }
            }

            var pathParts = cloudTools.getPathParts(params.path);
            var folderPath = '';
            if (pathParts.length > 1)
                folderPath = cloudTools.removeLastPathPart(params.path);

            if (folderPath != '')
                _this.createPath(folderPath).then(performRequest, reject);
            else
                performRequest();
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
            if (params.id)
                request.open('DELETE', 'https://api.onedrive.com/v1.0/drive/items/' + params.id, true);
            else
                request.open('DELETE', 'https://api.onedrive.com/v1.0/drive/root:/' + cloudTools.trim(params.path), true);
            request.setRequestHeader('Authorization', _this._authData.tokenType + ' ' + _this._authData.accessToken);
            try {
                request.send();
            } catch (err) {
                reject(err);
            }
        });
    },

    _findFolder: function (folder_title, parent_id) {
        var _this = this;
        return this.checkAuth(function (resolve, reject) {
            var request = new XMLHttpRequest();
            request.onreadystatechange = function () {
                if (request.readyState == request.DONE) {
                    if (request.status === 200) {
                        var info = JSON.parse(request.responseText);
                        var items = info.value;
                        var found = false;
                        for (var i = 0; i < items.length; i++) {
                            if (items[i].name == folder_title) {
                                resolve(items[i].id);
                                found = true;
                            }
                        }
                        if (!found)
                            reject('Folder ' + folder_title + ' not found');
                    } else {
                        reject('Find folder error: ' + request.status + ' :' + request.responseText);
                    }
                }
            };

            var uri = 'https://api.onedrive.com/v1.0/drive/root/view.search?q=' + folder_title;
            if (parent_id)
                uri = 'https://api.onedrive.com/v1.0/drive/items/' + parent_id + '/view.search?q=' + folder_title;

            request.open('GET', uri, true);
            request.setRequestHeader('Authorization', _this._authData.tokenType + ' ' + _this._authData.accessToken);
            try {
                request.send();
            } catch (err) {
                reject(err);
            }
        });
    },

    _createFolder: function (folder_title, parent_id) {
        var _this = this;
        return this.checkAuth(function (resolve, reject) {
            var request = new XMLHttpRequest();
            request.onreadystatechange = function () {
                if (request.readyState == request.DONE) {
                    if (request.status === 200 || request.status === 201 /*created*/ ) {
                        var info = JSON.parse(request.responseText);
                        resolve(info.id);
                    } else {
                        reject('Create folder error: ' + request.status + ' :' + request.responseText);
                    }
                }
            };
            var uri = 'https://api.onedrive.com/v1.0/drive/root/children';
            if (parent_id)
                uri = 'https://api.onedrive.com/v1.0/drive/items/' + parent_id + '/children';

            request.open('POST', uri, true);
            request.setRequestHeader('Content-Type', 'application/json');
            request.setRequestHeader('Authorization', _this._authData.tokenType + ' ' + _this._authData.accessToken);
            var metadata = {
                name: folder_title,
                folder: {}
            };
            try {
                request.send(JSON.stringify(metadata));
            } catch (err) {
                reject(err);
            }
        });
    },

    createPath: function (path) {
        var _this = this;
        return this.checkAuth(function (resolve, reject) {
            var pathParts = cloudTools.getPathParts(path);
            var idx = 0;
            var _handleFld = function (idx, parent_id) {
                _this._findFolder(pathParts[idx], parent_id).then(
                    function (folder_id) {
                        // folder found
                        if (idx < pathParts.length - 1)
                            _handleFld(idx + 1, folder_id) // continue the recursion
                        else
                            resolve(folder_id); // this is the last folder in the path, resolve
                    },
                    function () {
                        // folder not found, create the new
                        _this._createFolder(pathParts[idx], parent_id).then(
                            function (folder_id) {
                                // folder created successfuly
                                if (idx < pathParts.length - 1)
                                    _handleFld(idx + 1, folder_id) // continue the recursion
                                else
                                    resolve(folder_id); // this is the last folder in the path, resolve
                            },
                            function (err) {
                                // folder creation error
                                reject(err);
                            });

                    }
                );
            }
            _handleFld(0);
        });
    },
}
