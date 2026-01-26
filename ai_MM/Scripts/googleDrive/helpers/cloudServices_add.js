/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

window.cloudServices.googleDrive = {
    title: 'Google Drive',
    icon: 'googledrive',
    needsExternalAuth: true, // needs external auth (in the default browser) -- otherwise in some environments it can be considered as XSRF attack -- see #15676 for details

    logWindowDefaultSize: {
        width: 500,
        height: 600
    },

    _authData: {
        client_type: 'google',
        client_version: 2,
        scope: 'https://www.googleapis.com/auth/drive.file', // temporary removed drive.readonly due to #17960
        //scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly', // #17711
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
            request.open('POST', 'https://www.googleapis.com/oauth2/v3/token', true);
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
            request.open('POST', 'https://www.googleapis.com/oauth2/v3/token', true);
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
        return 'https://accounts.google.com/o/oauth2/auth?scope=' + this._authData.scope + '&redirect_uri=' + redirect_uri + '&response_type=code' + app.utils.web.getClientKey(this._authData.client_type, this._authData.client_version, false);
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
                            spaceTotal: info.storageQuota.limit,
                            spaceUsed: info.storageQuota.usage
                        });
                    } else {
                        reject('getStorageInfo error: ' + request.status + ' :' + request.responseText);
                    }
                }
            };
            request.open('GET', 'https://www.googleapis.com/drive/v3/about?fields=storageQuota', true);
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
                        var img;
                        if (info.user.photoLink)
                            img = info.user.photoLink;
                        resolve({
                            user: info.user.displayName,
                            email: info.user.emailAddress,
                            photo: img
                        });
                    } else {
                        reject('getUserInfo error: ' + request.status + ' :' + request.responseText);
                    }
                }
            };
            request.open('GET', 'https://www.googleapis.com/drive/v3/about?fields=user', true);
            request.setRequestHeader('Authorization', _this._authData.tokenType + ' ' + _this._authData.accessToken);
            try {
                request.send();
            } catch (err) {
                reject(err);
            }
        });
    },

    getStreamUrl: function (sourceInfo) {
        return this.checkAuth((resolve, reject) => {

            if (!sourceInfo.id) {
                this._findItem(sourceInfo.path).then((id) => {
                    sourceInfo.id = id;
                    this.getStreamUrl(sourceInfo).then(resolve, reject);
                }, reject);
                return;
            }

            var url = 'https://www.googleapis.com/drive/v3/files/' + sourceInfo.id + '?alt=media'; // persistent link, but needs authorization
            if (!window._cleanUpCalled) {
                app.utils.web.setLinkAuthorization(url, this._authData.tokenType + ' ' + this._authData.accessToken);
                app.utils.web.setLinkExtension(url, cloudTools.getFileExt(sourceInfo.path)); // just to speed up playback init (no need to get MIME type)
            }
            resolve(url);

            // TODO?: how to get temporal public link that wouldn't need authorization ?
            // all the possible links below needs authorization anyway:
            /*
                        var request = new XMLHttpRequest();
                        request.onreadystatechange = function () {
                            if (request.readyState == request.DONE) {
                                if (request.status === 200) {
                                    var info = JSON.parse(request.responseText);                     
                                    //resolve(info.webContentLink); // temporal, but needs authorization :-/
                                    resolve(info.downloadUrl); // needs to be without the last '?ud=' param and needs authorization anyway :-/
                                } else {
                                    reject('getStreamUrl error: ' + request.status + ' :' + request.responseText);
                                }
                            }
                        };
                        request.open('GET', 'https://www.googleapis.com/drive/v3/files/' + sourceInfo.id, true);
                        request.setRequestHeader('Authorization', this._authData.tokenType + ' ' + this._authData.accessToken);
                        try {
                            request.send();
                        } catch (err) {
                            reject(err);
                        }
            */
        });
    },

    listContent: function (path, aFiles, recursive, all_files) {
        var _this = this;
        return this.checkAuth(function (resolve, reject) {
            var performRequest = function (folder_id) {
                var request = new XMLHttpRequest();
                var hasher = {};
                var items = [];
                var files = aFiles || app.utils.createTracklist();

                if (!folder_id)
                    folder_id = 'root';
                var uriParams = '?q=' + encodeURIComponent("trashed=false and '" + folder_id + "' in parents");
                if (recursive)
                    uriParams = '?q=' + encodeURIComponent('trashed=false and \'me\' in owners'); // list all but trashed and just shared with me
                uriParams = uriParams + '&pageSize=500&fields=' + encodeURIComponent('nextPageToken,files(id,name,mimeType,size,parents)') + '&orderBy=name';

                request.onreadystatechange = function () {
                    if (request.readyState == request.DONE) {
                        // ODS('**** ' + request.status + ' -- ' + request.responseText);
                        if (request.status === 200) {
                            var info = JSON.parse(request.responseText);

                            items.push(...info.files);

                            var _whenLoaded = files.whenLoaded();

                            if (info.nextPageToken && !isPromiseCanceled(_whenLoaded)) {
                                // further items are available via nextPageToken, continue...                                
                                request.open('GET', 'https://www.googleapis.com/drive/v3/files' + uriParams + '&pageToken=' + info.nextPageToken, true);
                                request.setRequestHeader('Authorization', _this._authData.tokenType + ' ' + _this._authData.accessToken);
                                try {
                                    request.send();
                                } catch (err) {
                                    files.notifyLoaded(); // #17979
                                    reject(err);
                                }
                            } else {

                                if (recursive) {
                                    // in case of recursive we don't know the parent path, we need to construct it from parents:                                
                                    for (var i = 0; i < items.length; i++) {
                                        var item = items[i];
                                        item.title = item.name; // V2 -> V3
                                        if (!item.parents.length)
                                            continue;

                                        hasher[item.id] = {
                                            title: item.title,
                                            parent: item.parents[0]
                                        }
                                    }
                                    var getPath = function (item) {
                                        var res = '/' + item.title;
                                        if (item.parents.length) {
                                            var parent = hasher[item.parents[0]];
                                            while (parent) {
                                                res = '/' + parent.title + res;
                                                parent = hasher[parent.parent];
                                            }
                                        }
                                        return res;
                                    }
                                }

                                var folders = new ArrayDataSource([]);
                                for (var i = 0; i < items.length; i++) {
                                    var item = items[i];
                                    item.title = item.name; // V2 -> V3

                                    if (recursive)
                                        var _path = getPath(item);
                                    else
                                        var _path = (path ? path + '/' + item.title : '/' + item.title);

                                    if (item.mimeType == 'application/vnd.google-apps.folder') {
                                        var folder = {};
                                        folder.title = item.title;
                                        folder.path = _path;
                                        folders.add(folder);
                                    } else {
                                        if (!all_files && !cloudTools.isSupportedFileExt(item.title)) // to filter '*.txt', '*.docx', '*.jpg' etc.
                                            continue;
                                        var file = cloudTools.createTrack(_this, {
                                            // info needed only on demand in getStreamUrl()
                                            id: item.id,
                                            path: _path
                                        });
                                        file.dontNotify = true;
                                        file.sync_id = cloudTools.syncIdFromPath(_path);
                                        file.title = item.title;
                                        //file.path = item.webContentLink; // just temporal for unauthorized access
                                        //file.path = item.downloadUrl; // also isn't long lived and predictable (according to Google's docs)
                                        //file.path = 'https://www.googleapis.com/drive/v3/files/' + item.id + '?alt=media'; // persistent link
                                        file.path = ''; // will be obtained via getStreamUrl() above
                                        file.fileLength = item.size;
                                        file.dontNotify = false;
                                        files.add(file);
                                    }

                                    if (isPromiseCanceled(_whenLoaded))
                                        break;
                                }

                                files.notifyLoaded();
                                resolve({
                                    folders: folders,
                                    files: files
                                });
                            }
                        } else {
                            files.notifyLoaded(); // #17979
                            reject('listContent error: ' + request.status + ' :' + request.responseText);
                        }
                    }
                };

                request.open('GET', 'https://www.googleapis.com/drive/v3/files' + uriParams, true);

                request.setRequestHeader('Authorization', _this._authData.tokenType + ' ' + _this._authData.accessToken);
                try {
                    request.send();
                } catch (err) {
                    files.notifyLoaded();
                    reject(err);
                }
            }


            if (path) {
                _this._findItem(path).then(
                    function (folder_id) {
                        performRequest(folder_id);
                    },
                    reject
                );
            } else {
                performRequest();
            }

        });
    },

    getContentSignature: function (last_token) {
        var _this = this;
        return this.checkAuth(function (resolve, reject) {
            var request = new XMLHttpRequest();
            request.onreadystatechange = function () {
                if (request.readyState == request.DONE) {
                    //ODS('***** ' + request.status + ' -- ' + request.responseText);
                    if (request.status === 200) {
                        var info = JSON.parse(request.responseText);
                        if (!last_token) {
                            resolve(info['startPageToken']);
                        } else {
                            if (info.changes.length > 0)
                                resolve(info['newStartPageToken']); // any changes, return the new token
                            else
                                resolve(last_token); // no changes, use still the old token
                        }
                    } else {
                        reject('getContentSignature error: ' + request.status + ' :' + request.responseText);
                    }
                }
            };

            var uri = 'https://www.googleapis.com/drive/v3/changes';
            if (last_token)
                uri = uri + '?pageToken=' + last_token + '&restrictToMyDrive=true';
            else
                uri = uri + '/startPageToken';
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

    CHUNK_SIZE: 262144 * 10, // 262144 is minimum for GoogleDrive (recommended are multiples of this minimum)

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
            var contentRange = 'bytes ' + startOffset + '-' + (endOffset - 1) + '/' + params.size;

            cloudTools.request({
                method: 'PUT',
                uri: params.sessionURI,
                content: params.content,
                progressCallback: progressCallback,
                headers: {
                    'Authorization': _this._authData.tokenType + ' ' + _this._authData.accessToken,
                    'Content-Type': params.mimeType,
                    'X-Upload-Content-Type': params.mimeType,
                    'Content-Range': contentRange,
                },
                doneCallback: function (status, responseText) {
                    if (status == 200 || status == 308) {
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
            var pathParts = cloudTools.getPathParts(params.path);
            var folderPath = '';
            if (pathParts.length > 1)
                folderPath = cloudTools.removeLastPathPart(params.path);

            var _uploadFile = function (parent_id) {
                var metaObject = {
                    name: pathParts[pathParts.length - 1]
                };
                if (parent_id)
                    metaObject.parents = [parent_id];

                var metadata = JSON.stringify(metaObject);
                var request = new XMLHttpRequest();
                request.onreadystatechange = function () {
                    if (request.readyState == request.DONE) {
                        //ODS('**** uploadFile ' + request.status + ' -- ' + request.responseText);
                        if (request.status === 200) {
                            params.sessionURI = request.getResponseHeader('Location');
                            _this.resumeFileUpload(params, progressCallback).then(resolve, reject);
                        } else {
                            reject('Upload file error: ' + request.status + ' :' + request.responseText);
                        }
                    }
                };
                request.open('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', true);
                request.setRequestHeader('Content-Type', 'application/json; charset=UTF-8');
                request.setRequestHeader('Content-Length', metadata.length);
                request.setRequestHeader('Authorization', _this._authData.tokenType + ' ' + _this._authData.accessToken);
                request.setRequestHeader('X-Upload-Content-Type', params.mimeType);
                request.setRequestHeader('X-Upload-Content-Length', params.size);
                try {
                    request.send(metadata);
                } catch (err) {
                    reject(err);
                }
            }

            var _replaceFile = function (parent_id) {
                _this.deleteItem(params).then(
                    function () {
                        _uploadFile(parent_id);
                    },
                    function (err) {
                        _uploadFile(parent_id);
                    });
            }

            if (folderPath != '')
                _this.createPath(folderPath).then(function (folder_id) {
                    _replaceFile(folder_id);
                });
            else
                _replaceFile();
        });
    },

    deleteItem: function (params) {
        var _this = this;
        return this.checkAuth(function (resolve, reject) {

            var delete_item = function (item_id) {
                var request = new XMLHttpRequest();
                request.onreadystatechange = function () {
                    if (request.readyState == request.DONE) {
                        if (request.status === 204 || request.status === 200 || request.status === 404 /* no longer exists*/ ) {
                            resolve();
                        } else {
                            reject('Delete file/folder error: ' + request.status + ' :' + request.responseText);
                        }
                    }
                };
                request.open('DELETE', 'https://www.googleapis.com/drive/v3/files/' + item_id, true);
                request.setRequestHeader('Authorization', _this._authData.tokenType + ' ' + _this._authData.accessToken);
                try {
                    request.send();
                } catch (err) {
                    reject(err);
                }
            }

            if (params.id)
                delete_item(params.id);
            else
                _this._findItem(params.path).then(delete_item, function () {
                    reject('File/folder not found')
                });
        });
    },

    _findFolder: function (folder_title, parent_id) {
        var _this = this;
        return this.checkAuth(function (resolve, reject) {
            var request = new XMLHttpRequest();
            request.onreadystatechange = function () {
                if (request.readyState == request.DONE) {
                    //ODS('***** ' + request.status + ' -- ' + request.responseText);
                    if (request.status === 200) {
                        var info = JSON.parse(request.responseText);
                        var items = info.files;
                        if (items.length > 0)
                            resolve(items[0].id);
                        else
                            reject('Folder ' + folder_title + ' not found');
                    } else {
                        reject('Find folder error: ' + request.status + ' :' + request.responseText);
                    }
                }
            };
            var folder_id = 'root';
            if (parent_id)
                folder_id = parent_id;
            folder_title = replaceAll("'", "\\'", folder_title); // to escape apostrophes used in title query bellow                       
            var q = "name='" + folder_title + "' and trashed=false and '" + folder_id + "' in parents";
            var uriParams = '?q=' + encodeURIComponent(q) + '&pageSize=500&fields=' + encodeURIComponent('files(id)');
            request.open('GET', 'https://www.googleapis.com/drive/v3/files' + uriParams, true);
            request.setRequestHeader('Authorization', _this._authData.tokenType + ' ' + _this._authData.accessToken);

            try {
                request.send();
            } catch (err) {
                reject(err);
            }
        });
    },

    _findItem: function (path) {
        var _this = this;
        return this.checkAuth(function (resolve, reject) {
            var pathParts = cloudTools.getPathParts(path);
            var idx = 0;
            var findFld = function (idx, parent_id) {
                var folder_title = pathParts[idx];
                _this._findFolder(folder_title, parent_id).then(function (folder_id) {
                    if (idx < pathParts.length - 1)
                        findFld(idx + 1, folder_id)
                    else
                        resolve(folder_id);
                }, reject);
            }
            findFld(0);
        });
    },

    _createFolder: function (folder_title, parent_id) {
        var _this = this;
        return this.checkAuth(function (resolve, reject) {
            var request = new XMLHttpRequest();
            request.onreadystatechange = function () {
                if (request.readyState == request.DONE) {
                    //ODS('****  _createFolder ' + request.status + ' -- ' + request.responseText);
                    if (request.status === 200) {
                        var info = JSON.parse(request.responseText);
                        resolve(info.id);
                    } else {
                        reject('Create folder error: ' + request.status + ' :' + request.responseText);
                    }
                }
            };
            request.open('POST', 'https://www.googleapis.com/drive/v3/files/', true);
            request.setRequestHeader('Content-Type', 'application/json');
            request.setRequestHeader('Authorization', _this._authData.tokenType + ' ' + _this._authData.accessToken);
            var metadata = {
                name: folder_title,
                mimeType: 'application/vnd.google-apps.folder'
            };
            if (parent_id)
                metadata.parents = [parent_id];

            try {
                request.send(JSON.stringify(metadata));
            } catch (err) {
                reject(err);
            }
        });
    },

    createPath: function (path) {
        var _this = this;
        return new Promise(function (resolve, reject) {
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
};
