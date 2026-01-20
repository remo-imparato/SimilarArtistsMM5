/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

requirejs('actions');
requirejs('helpers/cloudServices');
requirejs('controls/toastMessage');

(function () {
    var apiKey = app.utils.web.getAPIKey('lastfmApiKey');
    var rootURL = 'http://ws.audioscrobbler.com/2.0/';
    var cacheFileName = 'LastFM_Cache.jsonl'; // JSON Lines text format
    var cacheFilePath = app.filesystem.getDataFolder() + cacheFileName;
    var cachedRecords = undefined;
    var sendingCache = false;
    var qData = undefined;

    var logRequestError = function (obj, query) {
        if (isString(obj)) {
            ODS('last.fm: error ' + obj + ', query: ' + query);
        } else {
            ODS('last.fm: error ' + obj.error + ' - ' + obj.message + ', query: ' + query);
        }
    };

    var loadCache = function () {
        return app.filesystem.loadTextFromFileAsync(cacheFilePath).then(function (txt) {
            if (txt) {
                var recs = txt.split('\r\n');
                cachedRecords = recs.map(ln => JSON.parse(ln));
            } else {
                cachedRecords = [];
            }
        }, function (err) {
            cachedRecords = [];
            ODS('last.fm: error during loading cache: ' + err);
        });
    };

    var saveCachedRecords = function () {
        var txt = '';
        forEach(cachedRecords, function (ti, i) {
            if (i > 0) {
                txt += '\r\n';
            }
            txt += JSON.stringify(ti);
        });
        if (txt === '') {
            return app.filesystem.deleteFileAsync(cacheFilePath);
        } else {
            return app.filesystem.saveTextToFileAsync(cacheFilePath, txt, {
                append: false // rewrite, if exists
            });
        }
    };

    var makeHTTPRequestGET = function (url) {
        return new Promise(function (resolve, reject) {
            var headers = newStringList();
            headers.add('User-Agent: MediaMonkey/' + app.utils.getApplicationVersion(4) + ' ( https://www.mediamonkey.com )');
            headers.add('Accept: application/json');
            
            var doneCallback = function (status, responseText) {
                if (status === 200) {
                    try {
                        var resObj = JSON.parse(responseText);
                        if ((resObj !== undefined) && isObjectLiteral(resObj)) {
                            resolve(resObj);
                        } else {
                            reject('last.fm makeHTTPRequest error status ' + status + ': ' + responseText);
                        }
                    } catch(err) {
                        reject(err);
                    }
                } else {
                    reject('last.fm makeHTTPRequest error status ' + status + ': ' + responseText);
                }
            };
            
            app.utils.web.requestAsync({
                uri: url,
                method: 'GET',
                headers: headers,
                doneCallback: doneCallback
            });
        });
    };

    var makeHTTPRequestPOST = function (data) {
        return new Promise(function (resolve, reject) {
            cloudTools.request({
                uri: rootURL,
                method: 'POST',
                headers: {
                    'User-Agent': app.utils.getApplicationVersion(4) + ' ( https://www.mediamonkey.com )',
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': data.length,
                    'Accept': 'application/json'
                },
                doneCallback: function (status, responseText) {
                    if (status === 200) {
                        try {
                            ODS('last.fm received:' + responseText);
                            var resObj = JSON.parse(responseText);
                            if ((resObj !== undefined) && isObjectLiteral(resObj)) {
                                resolve(resObj);
                            } else {
                                reject('last.fm: makeHTTPRequest error status ' + status + ': ' + responseText);
                            }
                        } catch(err) {
                            reject(err);
                        }
                    } else
                        reject('last.fm makeHTTPRequest error status ' + status + ': ' + responseText);
                },
                content: data
            });
        });
    };

    var sendSignedRequest = function (params, isPost) {
        return new Promise(function (resolve, reject) {
            // sort params alphabetically by parameter name
            params.sort();
            // concatenate all strings and secret key
            var concParams = '';
            forEach(params, function (paramPair) {
                concParams += paramPair[0] + paramPair[1];
            });

            // compute MD5 signature and append it to params            
            var md5sig = app.utils.md5HexaHash(concParams, 'lastfm'); // will append lastfm secret key before hashing
            params.push(['api_sig', md5sig]);

            // append format json, as we always want json. It must not be included in the hash, so we are adding it later
            params.push(['format', 'json']);

            // prepare whole query
            var query;
            var httpReqFunc;
            if (isPost) {
                query = '';
                httpReqFunc = makeHTTPRequestPOST;
            } else {
                query = rootURL + '?';
                httpReqFunc = makeHTTPRequestGET;
            }
            forEach(params, function (paramPair, idx) {
                if (idx > 0)
                    query += '&';
                query += paramPair[0] + '=' + encodeURIComponent(paramPair[1]);
            });
            ODS('last.fm: going to send: ' + query);
            localPromise(httpReqFunc(query)).then(function (resObj) {
                if (resObj.error) {
                    logRequestError(resObj, query);
                    reject(resObj.error);
                } else
                    resolve(resObj);
            }, function (errMsg) {
                logRequestError(errMsg, query);
                reject(errMsg);
            });
        });
    };
    var authorizingPromise;
    window.lastfm = {
        authorize: function () {
            if (authorizingPromise)
                return authorizingPromise;
            authorizingPromise = new Promise(function (resolve, reject) {
                if (window._cleanUpCalled) {
                    if (reject)
                        reject();
                    return;
                }
                // first get request token
                sendSignedRequest([['method', 'auth.gettoken'], ['api_key', apiKey]]).then(function (res) {
                    var token = res.token;
                    // open web, so user can authorize this app
                    var defSize = {
                        width: 1000,
                        height: 800
                    }
                    defSize.top = Math.max(0, thisWindow.bounds.top + ((thisWindow.bounds.height - defSize.height) / 2));
                    defSize.left = Math.max(0, thisWindow.bounds.left + ((thisWindow.bounds.width - defSize.width) / 2));
                    var dlg = uitools.openDialog('dlgWeb', {
                        modal: true,
                        top: defSize.top,
                        left: defSize.left,
                        width: defSize.width,
                        height: defSize.height,
                        url: 'http://www.last.fm/api/auth/?api_key=' + apiKey + '&token=' + res.token
                    });
                    dlg.whenClosed = function () {
                        // hopefully authorized, try to fetch session token
                        sendSignedRequest([['method', 'auth.getSession'], ['api_key', apiKey], ['token', res.token]]).then(function (resSession) {
                            // session token received, save
                            lastfm.scrobblerState.sessionKey = resSession.session.key;
                            lastfm.scrobblerState.name = resSession.session.name;
                            lastfm.scrobblerState = lastfm.scrobblerState; // save new state with settingschanged event

                            authorizingPromise = undefined;
                            resolve(lastfm.scrobblerState.sessionKey);
                        }, function (err) {
                            lastfm.scrobblerState.scrobblerMode = 'ModeOff'; // switch off, we do not have authorized access
                            lastfm.scrobblerState = lastfm.scrobblerState; // save new state with settingschanged event
                            authorizingPromise = undefined;
                            reject(err);
                        });
                    };
                    localListen(dlg, 'closed', dlg.whenClosed);
                }, function (err) {
                    authorizingPromise = undefined;
                    lastfm.scrobblerState.scrobblerMode = 'ModeOff'; // switch off, we do not have authorized access
                    lastfm.scrobblerState = lastfm.scrobblerState; // save new state with settingschanged event
                    uitools.toastMessage.show(_('There was an error while connecting to ') + rootURL + (err?'<br/><i>'+ err + '</i>':''), {
                        disableUndo: true,
                        delay: 10000,
                    });
                    reject(err);
                });
            });
            return authorizingPromise;
        },

        sendNowPlayingTrack: function (trackInfo) {
            if (!lastfm.scrobblerState.sessionKey) {
                ODS('last.fm: no session key');
                return;
            }
            var paramsToSend = [['method', 'track.updateNowPlaying'], ['api_key', apiKey], ['sk', lastfm.scrobblerState.sessionKey],
                                ['artist', trackInfo.artist], ['track', trackInfo.title]];
            if (trackInfo.album)
                paramsToSend.push(['album', trackInfo.album]);
            if (trackInfo.trackNumber)
                paramsToSend.push(['trackNumber', trackInfo.trackNumber]);
            if (lastfm.scrobblerState.sendAlbumArtist && (trackInfo.albumArtist !== trackInfo.artist))
                paramsToSend.push(['albumArtist', trackInfo.albumArtist]);
            if (trackInfo.duration && (trackInfo.duration > 1))
                paramsToSend.push(['duration', trackInfo.duration]);

            // hopefully authorized, try to fetch session token
            sendSignedRequest(paramsToSend, true /* POST */ ).then(function (res) {
                ODS('last.fm: sending NP succeeded');
            }, function (errCode) {
                ODS('last.fm: sending NP failed, errCode=' + errCode);
            });
        },

        sendScrobble: function (trackInfo) {
            if (!lastfm.scrobblerState.sessionKey) {
                ODS('last.fm: no session key');
                return;
            }
            if (cachedRecords === undefined) {
                ODS('last.fm: cached files not read, ignoring scrobble');
                return;
            };

            if (cachedRecords.length > 0) {
                lastfm.addToCache(trackInfo); // append to current cache, new scrobble should be sent as the last one
                lastfm.sendCachedScrobbles();
                return;
            }

            var paramsToSend = [['method', 'track.scrobble'], ['api_key', apiKey], ['sk', lastfm.scrobblerState.sessionKey],
                                ['artist', trackInfo.artist], ['track', trackInfo.title], ['timestamp', trackInfo.timestamp]];
            if (trackInfo.album)
                paramsToSend.push(['album', trackInfo.album]);
            if (trackInfo.trackNumber)
                paramsToSend.push(['trackNumber', trackInfo.trackNumber]);
            if (lastfm.scrobblerState.sendAlbumArtist && (trackInfo.albumArtist !== trackInfo.artist))
                paramsToSend.push(['albumArtist', trackInfo.albumArtist]);
            if (trackInfo.duration && (trackInfo.duration > 1))
                paramsToSend.push(['duration', trackInfo.duration]);

            // hopefully authorized, try to fetch session token
            sendSignedRequest(paramsToSend, true /* POST */ ).then(function (res) {
                // successfully posted
                ODS('last.fm: sending scrobble succeeded');
            }, function (errCode) {
                ODS('last.fm: sending scrobble failed, errCode=' + errCode);
                if ((errCode == '11') || (errCode == '16')) { // sevice offline or unavailable, cache to try later
                    lastfm.addToCache(trackInfo);
                };
            });
        },

        sendCachedScrobbles: function () {
            if (!lastfm.scrobblerState.sessionKey) {
                ODS('last.fm: no session key');
                return;
            }
            if (cachedRecords === undefined) {
                ODS('last.fm: cached files not read, ignoring scrobble');
                return;
            };

            if (sendingCache || (cachedRecords.length === 0))
                return;
            sendingCache = true;
            // we can send max 50 records at one time
            var recsToSend = cachedRecords.slice(0, Math.min(cachedRecords.length, 50));

            var paramsToSend = [['method', 'track.scrobble'], ['api_key', apiKey], ['sk', lastfm.scrobblerState.sessionKey]];

            forEach(recsToSend, function (trackInfo, i) {
                var idx = '[' + i + ']';
                paramsToSend.push(['artist' + idx, trackInfo.artist]);
                paramsToSend.push(['track' + idx, trackInfo.title]);
                paramsToSend.push(['timestamp' + idx, trackInfo.timestamp]);
                if (trackInfo.album)
                    paramsToSend.push(['album' + idx, trackInfo.album]);
                if (trackInfo.trackNumber)
                    paramsToSend.push(['trackNumber' + idx, trackInfo.trackNumber]);
                if (lastfm.scrobblerState.sendAlbumArtist && (trackInfo.albumArtist !== trackInfo.artist))
                    paramsToSend.push(['albumArtist' + idx, trackInfo.albumArtist]);
                if (trackInfo.duration && (trackInfo.duration > 1))
                    paramsToSend.push(['duration' + idx, trackInfo.duration]);
            });

            // hopefully authorized, try to fetch session token
            sendSignedRequest(paramsToSend, true /* POST */ ).then(function (res) {
                // if successfully posted, remove from cache and send it, if anything to post
                cachedRecords.splice(0, recsToSend.length);
                // save change to the file
                localPromise(saveCachedRecords()).then(function () {
                    sendingCache = false;
                    // send next batch, if needed
                    if (cachedRecords.length > 0) {
                        lastfm.sendCachedScrobbles();
                    }
                }, function () {
                    sendingCache = false;
                });
            }, function () {
                sendingCache = false;
            });
        },

        addToCache: function (ti) {
            if (cachedRecords === undefined) {
                ODS('last.fm: cached files not read, ignoring scrobble');
                return;
            };
            ODS('last.fm: adding record to cache: ' + JSON.stringify(ti));
            localPromise(app.filesystem.getFileSizeAsync(cacheFilePath)).then(function (fileSize) {
                if (isString(fileSize)) {
                    ODS('last.fm: getFileSizeAsync error: ' + fileSize);
                    return;
                }
                cachedRecords.push(ti);
                var line;
                if (fileSize > 0) {
                    line = '\r\n';
                } else {
                    line = '';
                };
                line += JSON.stringify(ti);
                app.filesystem.saveTextToFileAsync(cacheFilePath, line, {
                    append: true
                });
                ODS('last.fm: record added to cache: ' + JSON.stringify(ti));
            });
        },

        trackSatisfyQueryData: function (sd) {
            if (qData) {
                return app.db.trackSatisfyQueryData(sd, qData);
            }
            return new Promise(function (resolve, reject) {
                if (window._cleanUpCalled) {
                    if (reject)
                        reject();
                    return;
                }
                localPromise(app.db.getQueryData({
                    category: 'empty'
                })).then(function (aQD) {
                    aQD.loadFromString(lastfm.scrobblerState.queryData);
                    qData = aQD;
                    localPromise(app.db.trackSatisfyQueryData(sd, qData)).then(function (b) {
                        resolve(b);
                    }, function (err) {
                        if (reject)
                            reject(err);
                    });
                }, function (err) {
                    if (reject)
                        reject(err);
                })
            });
        },

        getUserInfo: function () {
            return new Promise(function (resolve, reject) {
                if (!lastfm.scrobblerState.sessionKey || !lastfm.scrobblerState.name) {
                    resolve();
                    return;
                }

                // hopefully authorized, try to fetch session token
                sendSignedRequest([['method', 'user.getinfo'], ['user', lastfm.scrobblerState.name], ['api_key', apiKey], ['sk', lastfm.scrobblerState.sessionKey]]).then(function (res) {
                    if (lastfm.scrobblerState.sessionKey) // still logged
                        resolve(res);
                    else
                        resolve();
                }, function () {
                    // failed, most probably due to wrong session key, reset it
                    lastfm.scrobblerState.sessionKey = undefined;
                    lastfm.scrobblerState.scrobblerMode = 'ModeOff'; // switch off, we do not have correct session
                    lastfm.scrobblerState = lastfm.scrobblerState; // save new state with settingschanged event
                    resolve();
                });

            });
        }
    };

    var _scrobblerState = undefined;

    Object.defineProperty(window.lastfm, 'scrobblerState', {
        get: function () {
            if (!_scrobblerState) {
                var loadScrobblerState = function () {
                    _scrobblerState = app.getValue('_lastFMService', {
                        scrobblerMode: 'ModeOff',
                        sessionKey: undefined,
                        name: '',
                        showNowplaying: true,
                        sendAlbumArtist: true,
                        scrobbleStreams: false,
                        scrobbleOnlyLibrary: true,
                        queryData: '[Common]\r\nQueryVersion=1\r\nQueryType=2\r\nCollectionID=-1\r\nQuickSearch=0\r\n\r\n[Basic]\r\n[Adv]\r\nConditionsCount=2\r\nOrdersCount=0\r\nLimitTop=0\r\nTop=0\r\nLimitMB=0\r\nMaxMB=650\r\nLimitLen=0\r\nMaxLen=74\r\nUseORcon=0\r\n\r\n[AdvCond1]\r\nDBField=Songs.Album\r\nDBFieldPerType=0\r\nCondition=703\r\nValue=\r\nValue2=\r\nnestOperator=or\r\nnestLevel=0\r\nisOperator=0\r\n\r\n[AdvCond2]\r\nDBField=Songs.TrackType\r\nDBFieldPerType=0\r\nCondition=301\r\nValue=0,3,4\r\nValue2=\r\nnestOperator=or\r\nnestLevel=0\r\nisOperator=0\r\n\r\n'
                    });
                    if(_scrobblerState.sendAlbumArtist === undefined)
                        _scrobblerState.sendAlbumArtist = true;
                    qData = undefined; // will force reload, if already set
                };
                localListen(app, 'settingschange', function () {
                    loadScrobblerState();
                });
                loadScrobblerState();
            };
            return _scrobblerState;
        },
        set: function (val) {
            _scrobblerState = val;
            app.setValue('_lastFMService', val);
            app.notifySettingsChange();
        }
    });
    loadCache(); // prepare cached files in advance
})();
