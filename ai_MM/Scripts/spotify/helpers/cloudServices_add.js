/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

window.cloudServices.spotify = {
    title: 'Spotify',
    icon: 'spotify',
    needsExternalAuth: true, // LS: not needed, but seems safer to open the log on screen in the default browser
    downloadSupported: false,
    folder_based: false,
    use_IP_in_redirect: true,
    _service_url: 'https://api.spotify.com/v1/',
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
        client_type: 'spotify',
        client_version: 1,
        scope: 'user-read-private user-read-email user-library-read user-library-modify playlist-read-private playlist-modify-private playlist-read-collaborative playlist-modify-public streaming',
        accessToken: '',
        refreshToken: '',
        tokenExpiration: 0, // when the accessToken expires and needs to be refreshed via refreshToken            
        tokenType: 'Bearer',
    },

    _getAccessToken: function (authorizationCode, redirect_uri) {
        var _this = this;
        return new Promise((resolve, reject) => {

            var postData = 'grant_type=authorization_code&code=' + authorizationCode + app.utils.web.getClientKey(_this._authData.client_type, _this._authData.client_version, true) + '&redirect_uri=' + redirect_uri;

            this.request({
                method: 'POST',
                content: postData,
                uri: 'https://accounts.spotify.com/api/token',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                doneCallback: function (request) {
                    if (request.status === 200) {
                        var tokenInfo = JSON.parse(request.responseText);
                        _this._authData.accessToken = tokenInfo.access_token;
                        _this._authData.refreshToken = tokenInfo.refresh_token;
                        _this._authData.tokenExpiration = Date.now() + (tokenInfo.expires_in * 1000);
                        _this._authData.tokenType = tokenInfo.token_type;
                        cloudTools.storeAuthState(_this);
                        resolve();
                    } else {
                        reject('Authorization error: ' + request.status + ' :' + request.responseText);
                    }
                }
            });
        });
    },

    _refreshAccessToken: function () {
        var _this = this;
        return new Promise((resolve, reject) => {
            var postData = 'grant_type=refresh_token&refresh_token=' + _this._authData.refreshToken + app.utils.web.getClientKey(_this._authData.client_type, _this._authData.client_version, true);
            this.request({
                method: 'POST',
                content: postData,
                uri: 'https://accounts.spotify.com/api/token',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                doneCallback: function (request) {
                    if (request.status === 200) {
                        var tokenInfo = JSON.parse(request.responseText);
                        _this._authData.accessToken = tokenInfo.access_token;
                        _this._authData.tokenExpiration = Date.now() + (tokenInfo.expires_in * 1000);
                        _this._authData.tokenType = tokenInfo.token_type;
                        cloudTools.storeAuthState(_this);
                        resolve();
                    } else {
                        reject('Authorization error: ' + request.status + ' :' + request.responseText);
                    }
                }
            });
        });
    },

    getAuthURL: function (redirect_uri) {
        return 'https://accounts.spotify.com/authorize?scope=' + this._authData.scope + '&redirect_uri=' + redirect_uri + '&response_type=code' + app.utils.web.getClientKey(this._authData.client_type, this._authData.client_version, false);
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

            if (_this._authData.tokenExpiration < Date.now()) {
                if (!window._cleanUpCalled) {
                    _this._refreshAccessToken().then(function () {
                        if (!window._cleanUpCalled)
                            whenAuthorized(resolve, reject);
                        else
                            reject('app terminating');
                    }, reject);
                } else {
                    reject('app terminating');
                }
            } else
                whenAuthorized(resolve, reject);
        });
    },

    getUserInfo: function () {
        var _this = this;
        return this.checkAuth((resolve, reject) => {
            this.request({
                method: 'GET',
                uri: this._service_url + 'me',
                headers: {
                    'Authorization': this._authData.tokenType + ' ' + this._authData.accessToken
                },
                doneCallback: function (request) {
                    if (request.status === 200) {
                        var info = JSON.parse(request.responseText);
                        var photo;
                        if (info.images)
                            photo = info.images[0];
                        if (info) {
                            ODS('Spotify user info: ' + JSON.stringify(info));
                            resolve({
                                user: info.display_name,
                                id: info.id, // user id
                                email: info.email,
                                photo: photo
                            });
                        } else {
                            reject('no content returned');
                        }
                    } else {
                        reject('getUserInfo error: ' + request.status + ' :' + request.responseText);
                    }
                }
            });
        });
    },

    addCustomNodes: function (node) {
        node.addChild(node.dataSource, 'cloudPlaylists');
        node.addChild(node.dataSource, 'cloudTracks');
    },

    listPlaylists: function (parent_playlist, params) {
        var _this = this;
        return this.checkAuth((resolve, reject) => {

            if (parent_playlist && (!parent_playlist.isRoot)) {
                // Spotify doesn't support hierarchical playlists
                resolve({
                    playlists: new ArrayDataSource([])
                });
            } else
            if (!parent_playlist && params && params.purpose == 'scan') {
                // in case of scanning Spotify playlists to MM library we want to group them under the 'Spotify' parent playlist in MM library
                // the reasons are described in #15396
                var playlists = new ArrayDataSource([]);
                var pl = {
                    title: params.device.name,
                    hasChildren: true,
                    isRoot: true
                };
                pl.name = pl.title;
                pl.guid = 'spotify_pls_root_' + pl.title;
                playlists.add(pl);
                resolve({
                    playlists: playlists
                });
            } else {

                var items = [];
                this.request({
                    method: 'GET',
                    uri: this._service_url + 'me/playlists',
                    headers: {
                        'Authorization': this._authData.tokenType + ' ' + this._authData.accessToken
                    },
                    doneCallback: function (request) {
                        if (request.status === 200) {
                            var info = JSON.parse(request.responseText);
                            items.push(...info.items);
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
                                    pl.name = pl.name;
                                    pl.guid = pl.id;
                                    playlists.add(pl);
                                }
                                resolve({
                                    playlists: playlists
                                });
                            }
                        } else {
                            reject('listPlaylists error: ' + request.status + ' :' + request.responseText);
                        }
                    }
                });
            }
        });
    },

    listPlaylistContent: function (playlist, files) {
        ODS('Spotify: listPlaylistContent: ' + playlist.id + ', name: ' + playlist.name);
        var _this = this;
        return this.checkAuth((resolve, reject) => {

            if (playlist.isRoot) {
                files.notifyLoaded();
                resolve({
                    files: files
                });
                return;
            }

            var uri;
            if (playlist.id == 'saved_tracks')
                uri = this._service_url + 'me/tracks';
            else
                uri = this._service_url + 'playlists/' + playlist.id + '/tracks';

            var items = [];
            this.request({
                method: 'GET',
                uri: uri,
                headers: {
                    'Authorization': this._authData.tokenType + ' ' + this._authData.accessToken
                },
                doneCallback: function (request) {
                    if (request.status === 200) {
                        var info = JSON.parse(request.responseText);
                        items.push(...info.items);
                        if (info.next) {
                            // further items are available via next link, continue...
                            request.open('GET', info.next, true);
                            request.setRequestHeader('Authorization', _this._authData.tokenType + ' ' + _this._authData.accessToken);
                            try {
                                request.send();
                            } catch (err) {
                                reject(err);
                            }
                        } else {
                            var list = items.filter((item) => {
                                if (item.track && item.track.id) // some broken playlists (e.g. https://open.spotify.com/playlist/4173ENNA5eMzHrz9pipvxI ) has the track info NULL! 
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
                        reject('getPlaylistContent error: ' + request.status + ' :' + request.responseText);
                    }

                }
            });
        });
    },

    _fillTrack: function (track, item) {
        var _this = this;
        track.dontNotify = true;
        track.title = item.track.name;
        if (item.track.album)
            track.album = item.track.album.name;
        if (item.track.artists) {
            forEach(item.track.artists, (artist) => {
                if (track.artist)
                    track.artist = track.artist + '; ' + artist.name;
                else
                    track.artist = artist.name;
            });
        }
        if (item.track.album && item.track.album.genres) {
            forEach(item.track.album.genres, (genre) => {
                if (track.genre)
                    track.genre = track.genre + '; ' + genre;
                else
                    track.genre = genre;
            });
        }
        if (item.track.album && item.track.album.artists) {
            forEach(item.track.album.artists, (artist) => {
                if (track.albumArtist)
                    track.albumArtist = track.albumArtist + '; ' + artist.name;
                else
                    track.albumArtist = artist.name;
            });
        }
        track.trackNumberInt = item.track.track_number;
        track.discNumberInt = item.track.disc_number;
        track.songLength = item.track.duration_ms;
        if (item.track.popularity)
            track.rating = item.track.popularity;

        track.sync_id = item.track.id;
        cloudTools.createSourceInfo(track, this, {
            // info needed only on demand in getStreamUrl()
            id: track.sync_id
        });

        if (item.track.preview_url && !this._testWebPlaybackSDK)
            track.path = item.track.preview_url;
        else
            track.path = '';
        track.dontNotify = false;
        return track;
    },

    getStreamInfo: function (track) {
        if (track.songLength > 30000)
            track.songLength = 30000;
        return '[' + 'Spotify' + ' ' + _('Preview') + ']'; // to show "[Spotify Preview]" text on player (#17288)
    },

    _createPlaylist: function (name) {
        ODS('Spotify: _createPlaylist ' + name);

        var _this = this;
        return this.checkAuth((resolve, reject) => {
            this.getUserInfo().then((user_info) => {

                var postData = {
                    name: name,
                    description: _this._ourPlaylistMarkDescription,
                    public: false
                };

                cloudTools.request({
                    method: 'POST',
                    uri: _this._service_url + 'users/' + user_info.id + '/playlists',
                    content: JSON.stringify(postData),
                    headers: {
                        'Authorization': _this._authData.tokenType + ' ' + _this._authData.accessToken,
                        'Content-Type': 'application/json'
                    },
                    doneCallback: function (status, responseText) {
                        if (status == 200 || status == 201) {
                            var res = JSON.parse(responseText);
                            ODS('Spotify: _createPlaylist, created ' + res.id /*+ ' :' + responseText*/ );
                            resolve(res.id);
                        } else {
                            reject('Spotify: _createPlaylist error: ' + status + ' :' + responseText);
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

    _ourPlaylistMarkDescription: "Created by MediaMonkey",

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
                            var canWrite = (foundPlaylist.description == this._ourPlaylistMarkDescription) && (foundPlaylist.owner);
                            ODS('Spotify: uploadPlaylist: found playlist: ' + upPlaylist.name + ', desc: ' + foundPlaylist.description);
                            if (canWrite) {
                                this.getUserInfo().then((user_info) => {
                                    ODS('Spotify: uploadPlaylist: our user id: ' + user_info.id + ', owner: ' + foundPlaylist.owner.id);
                                    if (user_info.id == foundPlaylist.owner.id)
                                        this._fillPlaylist(foundPlaylist.id, upPlaylist, sync, canWrite).then(resolve, reject);
                                    else
                                        resolve(); // we cannot write playlist that we don't own
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
            //ODS('Spotify: latitude ' + latitude);
        } else {
            res = app.utils.lingCompare(s1, s2, true /* ignore brackets */ );
        }

        if (res)
            ODS('Spotify: matched ' + fieldID + ': ' + s1 + ' | ' + s2);
        else
            ODS('Spotify: not matched ' + fieldID + ': ' + s1 + ' | ' + s2);
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

            var searchStr = app.utils.getLingBase(track.title) + ' ' + checkArtist(track.artist);

            if (track.title.trim() != '' && track.artist.trim() != '') {
                var qp = {
                    q: searchStr,
                    type: "track",
                    limit: 5
                }
                var qstring = _this._queryStringify(qp);

                this.request({
                    method: 'GET',
                    uri: this._service_url + 'search?' + qstring,
                    headers: {
                        'Authorization': this._authData.tokenType + ' ' + this._authData.accessToken
                    },
                    doneCallback: function (request) {
                        if (request.status === 200) {
                            var info = JSON.parse(request.responseText);
                            var items = info.tracks.items;
                            if (items.length) {
                                ODS('Spotify search res: item count: ' + items.length);

                                var use_item;
                                for (var i = 0; i < items.length; i++) {
                                    var itm = items[i];
                                    if (!itm) // this happened in ticket # 6358
                                        continue;
                                    ODS('Spotify res ' + i + '------for "' + searchStr + '"-------------:');
                                    //ODS('Spotify: track full debug: ' + JSON.stringify(itm));

                                    var artist = '';
                                    if (itm.artists && itm.artists.length)
                                        artist = itm.artists[0].name;
                                    var artistMatch = _this._compareStr(artist, track.artist, 'artist');
                                    var titleMatch = _this._compareStr(itm.name, track.title, 'title');
                                    var albumMatch = (itm.album && _this._compareStr(itm.album.name, track.album, 'album'));
                                    var lenMatch = _this._compareStr(itm.duration_ms, track.songLength, 'length');

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
                                    var s = 'Spotify search res: used item: ' + use_item.id + ' | title: ' + use_item.name;
                                    if (use_item.album && use_item.artists && use_item.artists.length)
                                        s = s + ' | album: ' + use_item.album.name + ' | artist: ' + use_item.artists[0].name;
                                    ODS(s);

                                    var use_id = use_item.id;
                                    cloudTools.createSourceInfo(track, _this, {
                                        id: use_id // so that server id is stored for the playlist sync and future sync operations
                                    }, true);
                                    track.sync_id = use_id;
                                    resolve({
                                        id: use_id,
                                    });
                                } else {
                                    var err = 'Match error: No Spotify track match for "' + searchStr + '" in results';
                                    ODS(err);
                                    reject(err);
                                }
                            } else {
                                var err = 'Match error: No Spotify track for "' + searchStr + '"';
                                ODS(err);
                                reject(err);
                            }
                        } else {
                            var err = 'Match error: ' + request.status + ' :' + request.responseText;
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
        ODS('Spotify: _fillPlaylist ' + playlist_id);
        return this.checkAuth((resolve, reject) => {
            var song_ids = [];
            var track;
            listAsyncForEach(upPlaylist.tracks, (item, next) => {
                track = item.getTrackFast(track);
                var id = this.getServerTrackID(track);
                if (id) {
                    ODS('Spotify: _fillPlaylist > known track id: ' + id);
                    song_ids.push(id); // already known
                    next(sync.taskProgress.terminated);
                } else {
                    next(sync.taskProgress.terminated);
                    // LS: the following is no longer needed (_searchTrack has been already called during matching process in matchTrack above -- so it would just result in match error again)
                    /*
                    this._searchTrack(track).then((res) => {
                        ODS('Spotify: _fillPlaylist > found track id: ' + res.id);
                        song_ids.push(res.id);
                        next(sync.taskProgress.terminated);
                    }, (err) => {
                        ODS('Spotify: _fillPlaylist > match track error: ' + err);
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
                if (request.status === 429) {
                    ODS('Spotify: API rate limit exceeded');
                    var retrySeconds = request.getResponseHeader('Retry-After');
                    ODS('Spotify: API rate limit exceeded, retry after: ' + retrySeconds);
                    if (isNaN(retrySeconds))
                        retrySeconds = 1;

                    setTimeout(() => {
                        _this.request(pars);
                    }, retrySeconds * 1000)
                } else {
                    if (pars.doneCallback)
                        pars.doneCallback(request);
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

            var batch_100 = song_ids.slice(0, 100);
            var rest = song_ids.slice(99);

            ODS('Spotify: _addTracks2Playlist ' + playlist_id + ', add tracks: 100 from ' + song_ids.length);

            var postArray = [];
            forEach(batch_100, (id) => {
                postArray.push('spotify:track:' + id);
            });
            var postData = JSON.stringify({
                uris: postArray
            });

            var method = 'POST';
            if (withClear)
                method = 'PUT'

            this.request({
                method: method,
                content: postData,
                uri: this._service_url + 'playlists/' + playlist_id + '/tracks',
                headers: {
                    'Authorization': this._authData.tokenType + ' ' + this._authData.accessToken,
                    'Content-Type': 'application/json'
                },
                doneCallback: function (request) {
                    if (request.status === 200 || request.status === 201) {
                        if (rest.length)
                            _this._addTracks2Playlist(playlist_id, rest).then(resolve, reject);
                        else
                            resolve();
                    } else {
                        var err = 'Spotify: _addTracks2Playlist error: ' + request.status + ' :' + request.responseText;
                        ODS(err);
                        reject(err);
                    }
                }
            });
        });
    },

    deletePlaylist: function (playlist) {
        return dummyPromise(); // not supported
    },

    listContent: function (path, files) {
        ODS('Spotify: listContent');
        return this.checkAuth((resolve, reject) => {
            var folders = new ArrayDataSource([]);
            if (!files) {
                resolve({
                    folders: folders
                });
            } else {
                var cancelToken = files.whenLoaded();
                this.listPlaylists().then((params) => {
                    listAsyncForEach(params.playlists, (playlist, next) => {
                        this.listPlaylistContent(playlist, files).then1(() => {
                            var terminated = isPromiseCanceled(cancelToken);
                            next(terminated);
                        });
                    }, () => {
                        this.listPlaylistContent({
                            id: 'saved_tracks'
                        }, files).then1(() => {
                            files.notifyLoaded();
                            ODS('Spotify: listContent finished, tracks count = ' + files.count);
                            resolve({
                                folders: folders,
                                files: files
                            });
                        });
                    });
                }, (err) => {
                    files.notifyLoaded(); // to not assert in files destructor (EBD4E0E1)
                    reject(err);
                });
            }
        });
    },

    getStreamUrl: function (sourceInfo) {
        return this.checkAuth((resolve, reject) => {
            this._testWebSDKPlayback(sourceInfo.id);
        });
    },

    handleMessage: (msgType, msg) => {
        ODS('Spotify WEB playback: ' + msgType + ': ' + msg);
    },

    _testWebSDKPlayback: function (trackID) {

        // based on https://developer.spotify.com/documentation/web-playback-sdk/quick-start/#

        if (this.webPlayer) {
            this._playTrack(trackID);
        } else {
            requirejsDeferred('https://sdk.scdn.co/spotify-player.js');
            var _this = this;
            window.onSpotifyWebPlaybackSDKReady = () => {
                const player = new Spotify.Player({
                    name: 'Web Playback SDK Quick Start Player',
                    getOAuthToken: cb => {
                        cb(_this._authData.accessToken);
                    },
                    volume: 0.5
                });

                player.connect().then(success => {
                    if (success) {
                        this.handleMessage('The Web Playback SDK successfully connected to Spotify! ', player._options.id);

                        this.webPlayer = player;
                        this.webPlayer.id = player._options.id;

                        player.addListener('initialization_error', ({
                            message
                        }) => {
                            // Most likely due to the browser not supporting EME protection
                            this.handleMessage('initialization_error', message);
                        });
                        player.addListener('authentication_error', ({
                            message
                        }) => {
                            this.handleMessage('authentication_error', message);
                        });
                        player.addListener('account_error', ({
                            message
                        }) => {
                            this.handleMessage('account_error', message);
                        });
                        player.addListener('playback_error', ({
                            message
                        }) => {
                            this.handleMessage('playback_error', message);
                        });

                        player.addListener('player_state_changed', state => {
                            this.handleMessage('player_state_changed', message);
                        });

                        player.addListener('ready', ({
                            device_id
                        }) => {
                            this.webPlayer.id = device_id;
                            this.handleMessage('Ready with Device ID', device_id);
                        });

                        player.addListener('not_ready', ({
                            device_id
                        }) => {
                            this.handleMessage('Device ID has gone offline', device_id);
                        });

                        this._playTrack(trackID);

                    } else {
                        this.handleMessage('player.connect', 'failure');
                    }
                });
            };
        }
    },

    _playTrack: function (trackID) {

        var postData = JSON.stringify({
            uris: ['spotify:track:' + trackID]
        });

        this.request({
            method: 'PUT',
            content: postData,
            uri: this._service_url + 'me/player/play?device_id=' + this.webPlayer.id,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': this._authData.tokenType + ' ' + this._authData.accessToken
            },
            doneCallback: (request) => {
                this.handleMessage('me/player/play: status: ', request.status + ' , response text:' + request.responseText);
            }
        });
    }


};
