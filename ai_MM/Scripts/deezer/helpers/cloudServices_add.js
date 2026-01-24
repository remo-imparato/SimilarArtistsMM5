/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

window.cloudServices.deezer = {
    title: 'Deezer',
    icon: 'deezer',
    needsExternalAuth: true, // LS: not needed, but seems safer to open the log on screen in the default browser
    downloadSupported: false,
    folder_based: false,
    _service_url: 'https://api.deezer.com/',
    _testWebPlaybackSDK: false,

    initProfileDefaults: function (device) {
        device.biDirSyncMetadata = false;
        device.saveAAToFolder = false;

        // uncheck all default auto-convert rules
        var convertConfig = device.autoConvertConfig;
        convertConfig.rules.setAllChecked(false);
        convertConfig.setSupportedFormatsList(app.utils.createSharedList()); // Unknown (all formats)
        device.autoConvertConfig = convertConfig;

        var sett = mediaSyncDevices.getCustomSettings(device);
        sett.excludeNewFiles = true; // [x] Only include content that matches files in the database
        mediaSyncDevices.setCustomSettings(device, sett);
    },

    init: function () {
        var blackList = actions.downloadToLibrary._blacklist;
        var black_item = 'https://p.scdn.co/mp3-preview/';
        if (blackList.indexOf(black_item) < 0)
            blackList.push(black_item);
    },

    configBoxVisible: function (box) {
        return !inArray(box, ['boxDelete', 'collectionSequencer', 'collectionRandomizer', 'collections', 'chbSyncMetadata']);
    },

    configTabVisible: function (tab) {
        return inArray(tab, ['summary', 'syncToDevice']);
    },

    _authData: {
        client_type: 'deezer',
        client_version: 1,
        accessToken: '',
        refreshToken: '',
        tokenExpiration: 0, // when the accessToken expires and needs to be refreshed via refreshToken            
        tokenType: 'Bearer',
    },

    _getAccessToken: function (authorizationCode, redirect_uri) {
        var _this = this;
        return new Promise((resolve, reject) => {
            this.request({
                method: 'GET',
                uri: 'https://connect.deezer.com/oauth/access_token.php?app_id=556102&secret=0351d13f17053d4c694d310ffe7b4d22&code=' + authorizationCode,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                doneCallback: function (request, status) {
                    if (status === 200) {
                        var tokenInfo = request.responseText;
                        if (tokenInfo.startsWith('access_token=')) {
                            ODS('Deezer token info: ' + tokenInfo);
                            tokenInfo = tokenInfo.substr('access_token='.length);
                            var idxExpire = tokenInfo.indexOf('&expires=');
                            if (idxExpire > 0) {
                                var expiresInSeconds = tokenInfo.substr(idxExpire + '&expires='.length);
                                ODS('expiresInSeconds ' + expiresInSeconds);
                                if (expiresInSeconds > 0)
                                    _this._authData.tokenExpiration = Date.now() + (expiresInSeconds * 1000);
                                _this._authData.accessToken = tokenInfo.substr(0, idxExpire);
                                ODS('accessToken ' + _this._authData.accessToken);
                            }
                            cloudTools.storeAuthState(_this);
                            resolve();
                        } else {
                            reject('Unexpected token info: ' + tokenInfo);
                        }
                    } else {
                        reject('Authorization error: ' + status + ' :' + request.responseText);
                    }
                }
            });
        });
    },

    getAuthURL: function (redirect_uri) {
        return 'https://connect.deezer.com/oauth/auth.php?app_id=556102&redirect_uri=' + redirect_uri + '&perms=basic_access,manage_library,delete_library,offline_access';
    },

    isAuthorized: function () {
        if (this._authData.accessToken)
            return true;
        else
            return false;
    },

    checkAuth: function (whenAuthorized) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            if (!_this.isAuthorized())
                reject(_this.title + ' not authorized');
            whenAuthorized(resolve, reject);
        });
    },

    getUserInfo: function () {
        var _this = this;
        return this.checkAuth((resolve, reject) => {
            this.request({
                method: 'GET',
                uri: this._service_url + 'user/me?output=json&access_token=' + this._authData.accessToken,
                doneCallback: function (request, status) {
                    if (status === 200) {
                        var info = JSON.parse(request.responseText);
                        var photo;
                        if (info.picture_small)
                            photo = info.picture_small;
                        if (info) {
                            ODS('Deezer user info: ' + JSON.stringify(info));
                            resolve({
                                user: info.name,
                                id: info.id, // user id
                                //email: info.email,
                                photo: photo
                            });
                        } else {
                            reject('no content returned');
                        }
                    } else {
                        reject('getUserInfo error: ' + status + ' :' + request.responseText);
                    }
                }
            });
        });
    },

    addCustomNodes: function (node) {
        node.addChild(node.dataSource, 'cloudPlaylists');
        node.addChild(node.dataSource, 'deezerFavoriteArtists');
        node.addChild(node.dataSource, 'deezerFavoriteAlbums');
        node.addChild(node.dataSource, 'cloudTracks');
    },

    listFavArtists: function () {
        return this.checkAuth((resolve, reject) => {
            var items = [];
            this.request({
                method: 'GET',
                uri: this._service_url + 'user/me/artists?output=json&access_token=' + this._authData.accessToken,
                doneCallback: function (request, status) {
                    if (status === 200) {
                        var info = JSON.parse(request.responseText);
                        items.push(...info.data);
                        var list = new ArrayDataSource([]);
                        for (var i = 0; i < items.length; i++) {
                            var ar = items[i];
                            ar.title = ar.name;
                            ar.getCachedThumb = function () { return this.picture_medium; }.bind(ar);
                            ar.guid = ar.id.toString();
                            list.add(ar);
                        }
                        resolve(list);
                    } else {
                        reject('listFavArtists error: ' + status + ' :' + request.responseText);
                    }
                }
            });
        });
    },

    listArtistContent: function (artist) {
        ODS('Deezer: listArtistContent: ' + artist.id + ', name: ' + artist.name);
        var _this = this;
        var files = app.utils.createTracklist();
        this.checkAuth((resolve, reject) => {
            var uri = this._service_url + 'artist/' + artist.id + '/top?limit=100&output=json&access_token=' + this._authData.accessToken;
            this.request({
                method: 'GET',
                uri: uri,
                doneCallback: function (request, status) {
                    if (status === 200) {
                        var info = JSON.parse(request.responseText);
                        var items = info.data;
                        files.asyncFill(items.length, function (idx, track) {
                            _this._fillTrack(track, items[idx]);
                        }).then1(function () {
                            resolve({
                                files: files
                            });
                        });
                    } else {
                        reject('listArtistContent error: ' + status + ' :' + request.responseText);
                    }
                }
            });
        });
        return files;
    },

    listFavAlbums: function () {
        return this.checkAuth((resolve, reject) => {
            var items = [];
            this.request({
                method: 'GET',
                uri: this._service_url + 'user/me/albums?output=json&access_token=' + this._authData.accessToken,
                doneCallback: function (request, status) {
                    if (status === 200) {
                        var info = JSON.parse(request.responseText);
                        items.push(...info.data);
                        var list = new ArrayDataSource([]);
                        for (var i = 0; i < items.length; i++) {
                            var al = items[i];
                            al.name = al.title;
                            al.getCachedThumb = function () { return this.cover_medium; }.bind(al);
                            list.add(al);
                        }
                        resolve(list);
                    } else {
                        reject('listFavAlbums error: ' + status + ' :' + request.responseText);
                    }
                }
            });
        });
    },

    listAlbumContent: function (album) {
        ODS('Deezer: listAlbumContent: ' + album.id + ', name: ' + album.name);
        var _this = this;
        var files = app.utils.createTracklist();
        this.checkAuth((resolve, reject) => {
            var uri = this._service_url + 'album/' + album.id + '/tracks&output=json&access_token=' + this._authData.accessToken;
            this.request({
                method: 'GET',
                uri: uri,
                doneCallback: function (request, status) {
                    if (status === 200) {
                        var info = JSON.parse(request.responseText);
                        var items = info.data;
                        files.asyncFill(items.length, function (idx, track) {
                            items[idx].album = album;
                            items[idx].track_position = idx + 1;
                            _this._fillTrack(track, items[idx]);
                        }).then1(function () {
                            resolve({
                                files: files
                            });
                        });
                    } else {
                        reject('listAlbumContent error: ' + status + ' :' + request.responseText);
                    }
                }
            });
        });
        return files;
    },


    listPlaylists: function (parent_playlist, params) {
        var _this = this;
        return this.checkAuth((resolve, reject) => {

            if (parent_playlist && (!parent_playlist.isRoot)) {
                // Deezer doesn't support hierarchical playlists
                resolve({
                    playlists: new ArrayDataSource([])
                });
            } else
                if (!parent_playlist && params && params.purpose == 'scan') {
                    // in case of scanning Deezer playlists to MM library we want to group them under the 'Deezer' parent playlist in MM library
                    // the reasons are described in #15396
                    var playlists = new ArrayDataSource([]);
                    var pl = {
                        title: params.device.name,
                        hasChildren: true,
                        isRoot: true
                    };
                    pl.name = pl.title;
                    pl.guid = 'deezer_pls_root_' + pl.title;
                    playlists.add(pl);
                    resolve({
                        playlists: playlists
                    });
                } else {

                    var items = [];
                    this.request({
                        method: 'GET',
                        uri: this._service_url + 'user/me/playlists?output=json&access_token=' + this._authData.accessToken,
                        doneCallback: function (request, status) {
                            if (status === 200) {
                                var info = JSON.parse(request.responseText);
                                items.push(...info.data);
                                if (info.next) {
                                    // further items are available via nextLink, continue...
                                    request.open('GET', info.next, true);
                                    request.setRequestHeader('Authorization', _this._authData.tokenType + ' ' + _this._authData.accessToken);
                                    try {
                                        request.send();
                                    } catch (err) {
                                        reject(err);
                                    }
                                } else {
                                    var playlists = new ArrayDataSource([]);
                                    for (var i = 0; i < items.length; i++) {
                                        var pl = items[i];
                                        pl.name = pl.title;
                                        pl.guid = pl.id.toString();
                                        playlists.add(pl);
                                    }
                                    resolve({
                                        playlists: playlists
                                    });
                                }
                            } else {
                                reject('listPlaylists error: ' + status + ' :' + request.responseText);
                            }
                        }
                    });
                }
        });
    },

    listPlaylistContent: function (playlist, files) {
        ODS('Deezer: listPlaylistContent: ' + playlist.id + ', name: ' + playlist.name);
        var _this = this;
        return this.checkAuth((resolve, reject) => {

            if (playlist.isRoot) {
                files.notifyLoaded();
                resolve({
                    files: files
                });
                return;
            }

            var uri = this._service_url + 'playlist/' + playlist.id + '/tracks?output=json&access_token=' + this._authData.accessToken;

            var BATCH_SIZE = 100;
            var items = [];
            this.request({
                method: 'GET',
                uri: uri + '&index=0&limit=' + BATCH_SIZE,
                doneCallback: function (request, status) {
                    if (status === 200) {
                        var info = JSON.parse(request.responseText);
                        items.push(...info.data);
                        if (info.data.length == BATCH_SIZE) {
                            // further items are available, continue...
                            request.open('GET', uri + '&index=' + items.length + '&limit=' + BATCH_SIZE, true);
                            try {
                                request.send();
                            } catch (err) {
                                reject(err);
                            }
                        } else {
                            var list = items.filter((item) => {
                                if (item.id) // some broken playlists has the track info NULL! 
                                    return true;
                            });
                            files.asyncFill(list.length, function (idx, track) {
                                _this._fillTrack(track, list[idx]);
                                track.playlistSongOrder = idx;
                            }).then1(function () {
                                resolve({
                                    files: files
                                });
                            });
                        }
                    } else {
                        reject('getPlaylistContent error: ' + status + ' :' + request.responseText);
                    }

                }
            });
        });
    },

    _fillTrack: function (track, item) {
        var _this = this;
        track.dontNotify = true;
        track.title = item.title;
        if (item.album)
            track.album = item.album.title;
        if (item.artist) {
            track.artist = item.artist.name;
            track.albumArtist = item.artist.name;
        }
        if (item.track_position)
            track.trackNumberInt = item.track_position;
        if (item.disk_number)
            track.discNumberInt = item.disk_number;
        else
            track.discNumberInt = 1;
        track.songLength = item.duration * 1000;
        track.sync_id = item.id.toString();
        cloudTools.createSourceInfo(track, this, {
            // info needed only on demand in getStreamUrl()
            id: track.sync_id
        });

        if (item.preview)
            track.path = item.preview;
        else
            track.path = '';
        track.dontNotify = false;
        return track;
    },

    getStreamInfo: function (track) {
        if (track.songLength > 30000)
            track.songLength = 30000;
        return '[' + 'Deezer' + ' ' + _('Preview') + ']'; // to show "[Deezer Preview]" text on player (#17288)
    },

    _createPlaylist: function (name, isPublic) {
        ODS('Deezer: _createPlaylist ' + name);

        return this.checkAuth((resolve, reject) => {
            this.getUserInfo().then((user_info) => {

                var postData = {
                    title: name
                };

                this.request({
                    method: 'POST',
                    uri: this._service_url + 'user/me/playlists?output=json&access_token=' + this._authData.accessToken + '&request_method=POST&title=' + encodeURIComponent(name),
                    content: JSON.stringify(postData),
                    doneCallback: (request, status) => {
                        if (status == 200 || status == 201) {
                            var playlist = JSON.parse(request.responseText);
                            ODS('Deezer: _createPlaylist, created ' + playlist.id + ' :' + request.responseText);
                            if (!isPublic)
                                this.request({
                                    method: 'POST',
                                    uri: this._service_url + 'playlist/'+playlist.id+'?output=json&access_token=' + this._authData.accessToken + '&request_method=POST&public=false',
                                    content: JSON.stringify(postData),
                                    doneCallback: (request, status) => {
                                        if (status == 200 || status == 201) {                                            
                                            ODS('Deezer: _createPlaylist, set to private: ' + request.responseText);
                                            resolve(playlist.id);
                                        } else {
                                            reject('Deezer: _createPlaylist, set to private: error: ' + status + ' :' + request.responseText);
                                        }
                                    }
                                });
                            else
                                resolve(playlist.id);
                        } else {
                            reject('Deezer: _createPlaylist error: ' + status + ' :' + request.responseText);
                        }
                    }
                });

            }, reject);
        });
    },

    _findPlaylist: function (name) {
        var _this = this;
        return this.checkAuth(function (resolve, reject) {
            _this.listPlaylists().then(function (info) {
                for (var i = 0; i < info.playlists.count; i++) {
                    var pl = info.playlists.getValue(i);
                    if (pl.name.trim() == name.trim()) {
                        resolve(pl);
                        return;
                    }
                }
                reject();
            },
                reject
            );
        });
    },

    uploadPlaylist: function (sync, upPlaylist) {
        return this.checkAuth((resolve, reject) => {
            if (upPlaylist.tracks.count == 0) {
                resolve(); // ignore empty playlists to not sync the dummy playlist parent(s) in MM library (#15396)
            } else
                this._findPlaylist(upPlaylist.name).then(
                    (foundPlaylist) => {
                        // playlist exists
                        if (upPlaylist.lastModified > sync.device.lastSyncTime) {
                            // playlist content has changed from the last sync, update its content:                                      
                            var canWrite = (foundPlaylist.creator != undefined);
                            ODS('Deezer: uploadPlaylist: found playlist: ' + upPlaylist.name + ' -- ' + JSON.stringify(foundPlaylist));
                            if (canWrite) {
                                this.getUserInfo().then((user_info) => {
                                    ODS('Deezer: uploadPlaylist: our user id: ' + user_info.id + ', creator: ' + foundPlaylist.creator.id);
                                    if (user_info.id == foundPlaylist.creator.id) {
                                        // we need to delete the old playlist at first, there is no effective way to "clear" the playlist:
                                        this.deletePlaylist(foundPlaylist).then(() => {
                                            this._createPlaylist(upPlaylist.name, foundPlaylist.public).then((id) => {
                                                this._fillPlaylist(id, upPlaylist, sync, true).then(resolve, reject);
                                            }, reject);
                                        }, reject);
                                    } else
                                        resolve(); // we cannot write playlist that we did not create
                                });
                            } else {
                                resolve();
                            }
                        } else
                            resolve(); // no need for update
                    },
                    () => {
                        // playlist doesn't exist, create new
                        this._createPlaylist(upPlaylist.name).then((id) => {
                            this._fillPlaylist(id, upPlaylist, sync, true).then(resolve, reject);
                        }, reject);
                    }
                );
        });
    },

    _queryStringify: function (obj, prefix) {

        function stringifyString(str, prefix) {
            return prefix + '=' + encodeURIComponent(str);
        }

        var ret = [],
            keys = Object.keys(obj),
            key;

        for (var i = 0, len = keys.length; i < len; ++i) {
            key = keys[i];
            ret.push(stringifyString(obj[key], encodeURIComponent(key)));
        }

        return ret.join('&');
    },

    _compareStr: function (s1, s2, fieldID) {
        var res;
        if (fieldID == 'length') {
            var latitude = Math.abs(s1 - s2);
            res = (latitude < 5000); // 5s
            //ODS('Deezer: latitude ' + latitude);
        } else {
            res = app.utils.lingCompare(s1, s2, true /* ignore brackets */);
        }

        if (res)
            ODS('Deezer: matched ' + fieldID + ': ' + s1 + ' | ' + s2);
        else
            ODS('Deezer: not matched ' + fieldID + ': ' + s1 + ' | ' + s2);
        return res;
    },

    _searchTrack: function (track) {
        var _this = this;
        return this.checkAuth((resolve, reject) => {

            var checkArtist = (artist) => {
                var res = app.utils.getLingBase(artist);
                if (res.toLowerCase() == 'various')
                    return ''
                else
                    if (res.toLowerCase() == 'various artists')
                        return ''
                    else
                        if (res.toLowerCase() == 'rem')
                            return 'R.E.M'
                        else
                            return res;
            }

            var searchStr = 'track:"' + app.utils.getLingBase(track.title.trim()) + '" artist:"' + checkArtist(track.artist.trim()) + '"';

            if (track.title.trim() != '' && track.artist.trim() != '') {
                var qp = {
                    q: searchStr,
                    limit: 5
                }
                var qstring = _this._queryStringify(qp);

                this.request({
                    method: 'GET',
                    uri: this._service_url + 'search?' + qstring + '&access_token=' + this._authData.accessToken,
                    doneCallback: function (request, status) {
                        if (status === 200) {
                            var info = JSON.parse(request.responseText);
                            var items = info.data;
                            if (items.length) {
                                ODS('Deezer search res: item count: ' + items.length);

                                var use_item;
                                for (var i = 0; i < items.length; i++) {
                                    var itm = items[i];
                                    ODS('Deezer res ' + i + '------for "' + searchStr + '"-------------:');
                                    // ODS('Deezer: track full debug: ' + JSON.stringify(itm));

                                    var artist = '';
                                    if (itm.artist)
                                        artist = itm.artist.name;
                                    var artistMatch = _this._compareStr(artist, track.artist, 'artist');
                                    var titleMatch = _this._compareStr(itm.title, track.title, 'title');
                                    var albumMatch = (itm.album && _this._compareStr(itm.album.title, track.album, 'album'));
                                    var lenMatch = _this._compareStr(itm.duration * 1000, track.songLength, 'length');

                                    if (titleMatch && albumMatch && artistMatch) {
                                        use_item = itm;
                                        break; // we have full match and can break
                                    } else
                                        if ((titleMatch && albumMatch) || (titleMatch && artistMatch)) {
                                            if (!use_item)
                                                use_item = itm;
                                            else
                                                if (lenMatch) // better length than the previous result
                                                    use_item = itm;
                                        }

                                }

                                if (use_item) {
                                    var s = 'Deezer search res: used item: ' + use_item.id + ' | title: ' + use_item.title;
                                    if (use_item.album && use_item.artist)
                                        s = s + ' | album: ' + use_item.album.title + ' | artist: ' + use_item.artist.name;
                                    ODS(s);

                                    var use_id = use_item.id.toString();
                                    cloudTools.createSourceInfo(track, _this, {
                                        id: use_id // so that server id is stored for the playlist sync and future sync operations
                                    }, true);
                                    track.sync_id = use_id;
                                    resolve({
                                        id: use_id,
                                    });
                                } else {
                                    var err = 'Match error: No Deezer track match for "' + searchStr + '" in results';
                                    ODS(err);
                                    reject(err);
                                }
                            } else {
                                var err = 'Match error: No Deezer track for "' + searchStr + '"';
                                ODS(err);
                                reject(err);
                            }
                        } else {
                            var err = 'Match error: ' + status + ' :' + request.responseText;
                            ODS(err);
                            reject(err);
                        }
                    }
                });

            } else {
                var err = 'Match error: Track title or artist is missing (' + track.id + '|' + track.title + '|' + track.artist + ')';
                ODS(err);
                reject(err);
            }
        });
    },

    getServerTrackID: function (track) {
        var sourceInfo = cloudTools.getSourceInfo(track);
        if (sourceInfo.service_id == this.id)
            return sourceInfo.id;
    },

    matchTrack: function (track) {
        return new Promise((resolve, reject) => {
            var id = this.getServerTrackID(track);
            if (id)
                resolve(id); // already matched
            else
                this._searchTrack(track).then(resolve, reject);
        });
    },

    _fillPlaylist: function (playlist_id, upPlaylist, sync, canWriteIncomplete) {
        ODS('Deezer: _fillPlaylist ' + playlist_id);
        return this.checkAuth((resolve, reject) => {
            var song_ids = [];
            var track;
            listAsyncForEach(upPlaylist.tracks, (item, next) => {
                track = item.getTrackFast(track);
                var id = this.getServerTrackID(track);
                if (id) {
                    ODS('Deezer: _fillPlaylist > known track id: ' + id);
                    song_ids.push(id); // already known
                    next(sync.taskProgress.terminated);
                } else {
                    next(sync.taskProgress.terminated);
                    // LS: the following is no longer needed (_searchTrack has been already called during matching process in matchTrack above -- so it would just result in match error again)
                    /*
                    this._searchTrack(track).then((res) => {
                        ODS('Deezer: _fillPlaylist > found track id: ' + res.id);
                        song_ids.push(res.id);
                        next(sync.taskProgress.terminated);
                    }, (err) => {
                        ODS('Deezer: _fillPlaylist > match track error: ' + err);
                        next(sync.taskProgress.terminated);
                    });
                    */
                }
            }, () => {
                if (sync.taskProgress.terminated)
                    resolve();
                else {
                    if (song_ids.length == upPlaylist.tracks.count || canWriteIncomplete)
                        this._addTracks2Playlist(playlist_id, song_ids, true).then(resolve, reject);
                    else
                        reject('Some tracks failed to match');
                }
            });
        });
    },

    request: function (pars) {

        var _this = this;

        var request = new XMLHttpRequest();
        request.onreadystatechange = function () {
            if (request.readyState == request.DONE) {

                var errCode = request.status;
                if (request.status == 200 && request.responseText.startsWith('{"error"')) {
                    var res = JSON.parse(request.responseText);
                    if (res.error && res.error.code)
                        errCode = res.error.code;
                    ODS('Deezer error ' + errCode + ': ' + request.responseText);
                }

                if (errCode == 429 || errCode == 4 /*QUOTA*/ || errCode == 700 /*SERVICE_BUSY*/) {
                    ODS('Deezer: API rate limit exceeded');
                    var retrySeconds = request.getResponseHeader('Retry-After');
                    ODS('Deezer: API rate limit exceeded, retry after: ' + retrySeconds);
                    if (isNaN(retrySeconds))
                        retrySeconds = 1;

                    setTimeout(() => {
                        _this.request(pars);
                    }, retrySeconds * 1000)
                } else {
                    if (pars.doneCallback)
                        pars.doneCallback(request, errCode);
                }
            }
        };

        request.open(pars.method, pars.uri, true);

        if (pars.headers) {
            var keys = Object.keys(pars.headers);
            for (var i = 0; i < keys.length; i++) {
                var key = keys[i];
                var value = pars.headers[key];
                value = cloudTools.encode_utf8(value); // header values needs to be UTF-8 encoded to be valid (throws exception for unicode chars otherwise)
                request.setRequestHeader(key, value);
            };
        }

        if (pars.progressCallback)
            request.upload.onprogress = function (e) {
                if (!pars.progressCallback(e))
                    request.abort();
            };

        if (pars.content) {
            if (pars.content.constructor === String) {
                request.send(pars.content);
            } else {
                var fileBuffer = pars.content;
                var arrayBuffer = fileBuffer.getArrayBuffer().slice(0);
                var dataView = new Uint8Array(arrayBuffer);
                request.send(dataView);
            }
        } else {
            request.send();
        }
    },

    _addTracks2Playlist: function (playlist_id, song_ids, withClear) {
        var _this = this;
        return this.checkAuth((resolve, reject) => {

            // Deezer playlists can't include duplicate songs:  
            var used = {};
            song_ids = song_ids.filter((item) => {
                if (!used[item]) {
                    used[item] = true;
                    return true;
                }
            });

            var BATCH_SIZE = 100;
            var batch = song_ids.slice(0, BATCH_SIZE);
            var rest = song_ids.slice(BATCH_SIZE);

            ODS('Deezer: _addTracks2Playlist ' + playlist_id + ', add tracks: ' + BATCH_SIZE + ' from ' + song_ids.length);

            this.request({
                method: 'POST',
                uri: this._service_url + 'playlist/' + playlist_id + '/tracks&access_token=' + this._authData.accessToken + '&songs=' + batch.join(','),
                doneCallback: function (request, status) {
                    if (status == 200 || status == 201) {
                        var res = 'Deezer: _addTracks2Playlist result: ' + status + ' :' + request.responseText;
                        ODS(res);
                        if (rest.length)
                            _this._addTracks2Playlist(playlist_id, rest).then(resolve, reject);
                        else
                            resolve();
                    } else {
                        var err = 'Deezer: _addTracks2Playlist error: ' + status + ' :' + request.responseText;
                        ODS(err);
                        reject(err);
                    }
                }
            });
        });
    },

    deletePlaylist: function (playlist) {
        return this.checkAuth((resolve, reject) => {
            ODS('Deezer: deletePlaylist ' + playlist.id);
            this.request({
                method: 'DELETE',
                uri: this._service_url + 'playlist/' + playlist.id + '&access_token=' + this._authData.accessToken,
                doneCallback: function (request, status) {
                    if (status == 200 || status == 201) {
                        var res = 'Deezer: deletePlaylist result: ' + status + ' :' + request.responseText;
                        resolve();
                    } else {
                        var err = 'Deezer: deletePlaylist error: ' + status + ' :' + request.responseText;
                        ODS(err);
                        reject(err);
                    }
                }
            });
        });
    },

    listContent: function (path, files) {
        ODS('Deezer: listContent');
        return this.checkAuth((resolve, reject) => {
            var folders = new ArrayDataSource([]);
            if (!files) {
                resolve({
                    folders: folders
                });
            } else {
                var cancelToken = files.whenLoaded();
                this.listFavArtists().then((list) => {
                    listAsyncForEach(list, (itm, next) => {
                        var _files = this.listArtistContent(itm);
                        _files.whenLoaded().finally(() => {
                            files.addList(_files);
                            next(isPromiseCanceled(cancelToken));
                        });
                    }, () => {
                        this.listFavAlbums().then((list) => {
                            listAsyncForEach(list, (itm, next) => {
                                var _files = this.listAlbumContent(itm);
                                _files.whenLoaded().finally(() => {
                                    files.addList(_files);
                                    next(isPromiseCanceled(cancelToken));
                                });
                            }, () => {
                                this.listPlaylists().then((params) => {
                                    listAsyncForEach(params.playlists, (playlist, next) => {
                                        this.listPlaylistContent(playlist, files).then1(() => {
                                            var terminated = isPromiseCanceled(cancelToken);
                                            next(terminated);
                                        });
                                    }, () => {
                                        files.notifyLoaded();
                                        ODS('Deezer: listContent finished, tracks count = ' + files.count);
                                        resolve({
                                            folders: folders,
                                            files: files
                                        });
                                    });
                                }, (err) => {
                                    files.notifyLoaded(); // to not assert in files destructor (EBD4E0E1)
                                    reject(err);
                                });

                            });
                        }, (err) => {
                            files.notifyLoaded(); // to not assert in files destructor (EBD4E0E1)
                            reject(err);
                        });
                    });
                }, (err) => {
                    files.notifyLoaded(); // to not assert in files destructor (EBD4E0E1)
                    reject(err);
                });
            }
        });
    }

};
