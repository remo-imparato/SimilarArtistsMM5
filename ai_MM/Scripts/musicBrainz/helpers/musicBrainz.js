/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";
requirejs('controls/editable');

/*
    Adds methods for accessing MusicBrainz service
*/

const LIMIT_ALL = -1;

(function () {
    var musicBrainzURL = 'mb.mediamonkey.com:5000'; //'rsamuels.asuscomm.com:8183';
    var downloadPromises = [];
    var downloadQueue = [];
    var downloadCoverPromises = [];
    var downloadCoverQueue = [];
    var fetchAllTrackTokens = [];
    var cachedPromises = {};
    var headers = newStringList();
    headers.add('User-Agent: MediaMonkey/' + app.utils.getApplicationVersion(4) + ' ( https://www.mediamonkey.com )');
    headers.add('Accept: application/json');
    var lastRequestTime = 0;
    var minTimeout = 0; // for our server removed
    var defaultLimitForLoadAll = 100;
    var cacheTimeout = 3600; // 1 hour, we update our MB server once per hour
    var fastSD = undefined;

    var getDataInternal = function (uid, query, resolve, reject, params) {
        if (query.substr(0, 4) !== 'http') {
            query = 'http://' + musicBrainzURL + '/ws/2/' + query + '&fmt=json';
        };

        var timeout;
        if (params && (params.cacheTimeout !== undefined)) {
            timeout = params.cacheTimeout;
        } else
            timeout = cacheTimeout;

        downloadPromises[uid] = app.utils.web.getURLContentAsync(query, {
            cacheTimeout: timeout,
            headers: headers
        });
        downloadPromises[uid].then(function (content) {
            downloadPromises[uid] = undefined;
            if (window._cleanUpCalled)
                return;
            if (content) {
                if (content[0] !== '1') // not read from cache
                    lastRequestTime = Date.now();
                content = content.slice(1);
                if (content !== '') {
                    resolve(content);
                } else {
                    resolve();
                }
            } else {
                ODS('Nothing downloaded from MusicBrainz site, ' + uid + ', ' + query);
                resolve();
            }
            processNextFromQueue();
        }, function (responseCode, response) {
            downloadPromises[uid] = undefined;
            if (window._cleanUpCalled)
                return;
            var data = {
                status: 'error',
                responseCode: responseCode,
                response: response
            };
            resolve(JSON.stringify(data));
            processNextFromQueue();
        });
    };

    var processNextFromQueue = function () {
        if ((downloadQueue.length === 0) || window._cleanUpCalled)
            return;
        var diff = Date.now() - lastRequestTime;
        if (diff < minTimeout) {
            requestTimeout(processNextFromQueue, diff);
        } else {
            var nextReq = downloadQueue.shift();
            getDataInternal(nextReq.uid, nextReq.query, nextReq.resolve, nextReq.reject, nextReq.params);
        };
    };

    var getData = function (uid, query, params) {
        return new Promise(function (resolve, reject) {
            var req = {
                uid: uid,
                query: query,
                resolve: resolve,
                reject: reject,
                params: params
            };
            if (params && params.highPriority) {
                downloadQueue.unshift(req);
            } else {
                downloadQueue.push(req);
            }
            if (!downloadPromises[uid] && (downloadQueue.length === 1)) {
                processNextFromQueue();
            }
        });
    };

    var prepareArtistTerm = function (term) {
        // it seems, there could be problems with artist names beginning with "The" (like for The Beatles - LOVE), remove it
        var retval = term;
        if (term) {
            retval = term.replace(/^the/i, '');
            if (retval == '')
                retval = term;
        }
        return retval;
    };

    var prepareSearchTerm = function (term) {
        // escape special characters of Lucene Search Syntax
        // https://lucene.apache.org/core/4_3_0/queryparser/org/apache/lucene/queryparser/classic/package-summary.html#Escaping_Special_Characters
        if (term) {
            term = term.replace(/(\(.*?\))/g, '');
            var retval = term.replace(/([\+|\-|&|\||\!|\(|\)|\{|\}|\[|\]|\^|"|\~|\*|\?|\:|\\|\/])/g, '\\\$1');
            return retval;
        } else
            return '';
    };

    var doSearch = function (uid, searchTerm, searchType, limitNum, offsetNum, isRetry, additional) {
        return new Promise(function (resolve, reject) {
            var limit = '';
            var page = '';
            var add = '';
            var all = limitNum === LIMIT_ALL;
            if (limitNum) {
                limit = '&limit=' + limitNum;
            }
            if (offsetNum) {
                page = '&offset=' + offsetNum;
            }
            if (additional) {
                add = '&' + additional;
            }

            var params = undefined;
            if (isRetry) {
                params = {
                    cacheTimeout: 1, // have to be >0, the response will be saved then
                    highPriority: true
                };
            };

            if (all) {
                // call doSearch in the loop
                var finalObject = {};
                var loop = function (offset) {
                    doSearch(uid, searchTerm, searchType, defaultLimitForLoadAll, offset, isRetry, additional).then(function (data) {
                        if (data) {
                            finalObject = advancedMergeObjects(finalObject, data);
                            if (data.count !== undefined && data.offset !== undefined) {
                                if (data.offset + defaultLimitForLoadAll < data.count) {
                                    loop(offset + defaultLimitForLoadAll);
                                    return;
                                }
                            }
                        }
                        resolve(finalObject);
                    });
                }
                loop(0);
            } else {
                getData(uid, searchType + '/?query=' + encodeURIComponent(searchTerm) + limit + page + add, params).then(function (content) {
                    if (!content) {
                        resolve();
                        return;
                    }
                    var retryQuery = function () {
                        // retry without using request cache
                        doSearch(uid, searchTerm, searchType, limitNum, offsetNum, true).then(function (res) {
                            resolve(res);
                        });
                    };

                    var resObj = tryEval(content);
                    var isBadRequest = (content) && (content.length < 1024) && (content.includes('Bad request'));
                    if ((resObj !== undefined) && (!isBadRequest)) {
                        if (isObjectLiteral(resObj)) {
                            if (resObj.error !== undefined) {
                                assert('MusicBrainz request error (' + searchType + '/?query=' + encodeURIComponent(searchTerm) + ') - ' + resObj.error);
                            } else {
                                if ((resObj.count !== undefined) && (resObj.offset !== undefined) && (!isRetry)) {
                                    // object is empty and it is not retry
                                    if ((resObj.count === 0) && (resObj.offset === 0) && (resObj.created !== undefined)) {
                                        // check when this result was obtained and try to obtain again if it wasn't today
                                        var dt;
                                        if (resObj.created.includes('T')) {
                                            dt = new Date(resObj.created.substr(0, resObj.created.indexOf('T')));
                                        } else {
                                            dt = new Date(resObj.created);
                                        }
                                        var now = new Date(Date.now());

                                        if (now.toDateString() !== dt.toDateString()) {
                                            retryQuery();
                                            return;
                                        }
                                    }
                                }
                            }
                            resolve(resObj);
                        } else {
                            resolve();
                        }
                    } else {
                        // getting value failed
                        if (isRetry)
                            resolve();
                        else {
                            retryQuery();
                        };
                    };
                }, function () {
                    resolve();
                });
            }
        });
    };

    var extractThumbPath = function (cvrObj) {
        var path = '';
        if (cvrObj && cvrObj.images && cvrObj.images.length > 0) {
            // prefer front covers
            var img = cvrObj.images[0];
            if (!img.front) {
                var i = 1;
                while (i < cvrObj.images.length) {
                    var tmpImg = cvrObj.images[i];
                    if (tmpImg.front) {
                        // we have main front cover
                        img = tmpImg;
                        break;
                    } else if (tmpImg.types && tmpImg.types.indexOf('Front') !== -1) {
                        // front cover, but probably not the main front, is does not have "front" flag
                        img = tmpImg;
                    }
                    i++;
                }
            }
            if (img.thumbnails) {
                if (img.thumbnails.small)
                    path = img.thumbnails.small;
                else if (img.thumbnails.large)
                    path = img.thumbnails.large;
            }
            if (!path && img.image) {
                path = img.image;
            }
        }
        return path;
    };

    var getArtistData = function (uid, artistId, incItems, isRetry) {
        return new Promise(function (resolve, reject) {
            var params = undefined;
            if (isRetry) {
                params = {
                    cacheTimeout: 1, // have to be >0, the response will be saved then
                    highPriority: true
                };
            };
            getData(uid, 'artist/' + artistId + '?inc=' + incItems, params).then(function (content) {
                var resObj = tryEval(content);
                if (resObj !== undefined) {
                    if (isObjectLiteral(resObj)) {
                        if (resObj['release-groups']) {
                            musicBrainz.addAlbumFunctionsToRGArray(uid, resObj['release-groups'], resObj.name)
                        }
                        resolve(resObj);
                    } else
                        resolve();
                } else {
                    // getting value failed
                    if (isRetry)
                        resolve();
                    else {
                        // retry without using request cache
                        getArtistData(uid, artistId, incItems, true).then(function (val) {
                            resolve(val);
                        })
                    }
                }
            }, function () {
                resolve();
            });
        });
    };

    var getNextArtistReleaseGroups = function (uid, artistId, resultGroups, params, isRetry) {
        var offsetStr = '';
        var limitStr = '&limit=100';
        if (params.offset)
            offsetStr = '&offset=' + params.offset;
        if (params.limit)
            limitStr = '&limit=' + params.limit;

        if (isRetry) {
            params.cacheTimeout = 1; // have to be >0, the response will be saved then
            params.highPriority = true;
        };

        getData(uid, 'release-group/?artist=' + artistId + offsetStr + limitStr).then(function (content) {
            var resObj = tryEval(content);
            if (resObj !== undefined) {
                if (isObjectLiteral(resObj) && resObj['release-groups']) {
                    // merge to previously fetched results
                    musicBrainz.addAlbumFunctionsToRGArray(uid, resObj['release-groups'], params.artistName);
                    resultGroups = resultGroups.concat(resObj['release-groups']);
                    params.offset = resultGroups.length + params.startOffset;
                    if (params.offset >= resObj['release-group-count'])
                        params.resolve(resultGroups);
                    else {
                        getNextArtistReleaseGroups(uid, artistId, resultGroups, params);
                    }
                } else
                    params.resolve(resultGroups);
            } else {
                // getting value failed
                if (isRetry)
                    params.resolve(resultGroups);
                else {
                    // retry without using request cache
                    getNextArtistReleaseGroups(uid, artistId, resultGroups, params, true);
                }
            }
        }, function () {
            params.resolve();
        });
    };;
    var getCoverDataInternal = function (uid, query, resolve, reject, params) {
        if (params && params.canceled) {
            if (reject)
                reject();
            processNextFromCoverQueue();
            return;
        }
        if (query.substr(0, 4) !== 'http') {
            query = 'https://coverartarchive.org/' + query;
        };
        var timeout;
        if (params && (params.cacheTimeout !== undefined)) {
            timeout = params.cacheTimeout;
        } else
            timeout = cacheTimeout;

        downloadCoverPromises[uid] = app.utils.web.getURLContentAsync(query, {
            cacheTimeout: timeout,
            headers: headers
        });
        downloadCoverPromises[uid].then(function (content) {
            downloadCoverPromises[uid] = undefined;
            if (window._cleanUpCalled)
                return;
            if (content) {
                var contentObj = tryEval(content.slice(1));
                if (isObjectLiteral(contentObj)) {
                    resolve(contentObj);
                } else {
                    resolve();
                }
            } else {
                if (params && params.title)
                    ODS('Nothing downloaded from CoverArtArchive site for ' + params.title);
                else
                    ODS('Nothing downloaded from CoverArtArchive site for ' + query);
                resolve();
            }
            processNextFromCoverQueue();
        }, function () {
            downloadCoverPromises[uid] = undefined;
            if (window._cleanUpCalled)
                return;
            resolve();
            processNextFromCoverQueue();
        });
    };

    var processNextFromCoverQueue = function () {
        if ((downloadCoverQueue.length === 0) || window._cleanUpCalled)
            return;
        var nextReq = downloadCoverQueue.shift();
        getCoverDataInternal(nextReq.uid, nextReq.query, nextReq.resolve, nextReq.reject, nextReq.params);
    };

    var getWikiData = function (uid, query, params) {
        return new Promise(function (resolve, reject) {
            if (params && params.canceled) {
                if (reject)
                    reject();
                return;
            }
            if (downloadCoverPromises[uid]) {
                var req = {
                    uid: uid,
                    query: query,
                    resolve: resolve,
                    reject: reject,
                    params: params
                };
                if (params && params.highPriority) {
                    downloadCoverQueue.unshift(req);
                } else {
                    downloadCoverQueue.push(req);
                }
            } else {
                getCoverDataInternal(uid, query, resolve, reject, params);
            };
        });
    };

    var fillTrack = function (track, titem, artObj) {
        // helper function for asyncFill callbacks
        if (track.beginUpdate)
            track.beginUpdate();
        track.title = titem.title;
        track.songLength = Number(titem.length);
        var dt = titem['date'];
        if (!dt && artObj)
            dt = artObj['date'];
        if (dt) {
            track.date = musicBrainz.decodeMBDate(dt);
        }

        if (titem['artist-credit'] && titem['artist-credit'].length) {
            var art = titem['artist-credit'][0];
            if (art && art.artist) {
                track.albumArtist = art.artist.name;
                track.artist = art.artist.name;
            } else {
                track.albumArtist = art.name;
                track.artist = art.name;
            }
        }
        if (titem.artist)
            track.artist = titem.artist;
        if (artObj && artObj.name) {
            track.albumArtist = artObj.name;
            if (!track.artist)
                track.artist = artObj.name;
        }
        if (titem['releases'] && titem['releases'].length) {
            track.album = titem['releases'][0].title;
        } else
        if (titem.album_name) {
            track.album = titem.album_name;
        }
        if (titem.discNumber !== undefined) {
            track.discNumber = '' + titem.discNumber; // to be sure, we fill string
        }
        if (titem.trackNumber !== undefined) {
            track.trackNumber = '' + titem.trackNumber; // to be sure, we fill string
        }
        track.webSource = _utils.youtubeWebSource(); // MB tracks are searched and played from Youtube now
        if (track.endUpdate)
            track.endUpdate();
    };

    window.musicBrainz = {
        normalizeString: function (str) {
            str = str.replace(/'/ig, '’'); // convert ' to preferred unicode ’
            return str;
        },
        
        formatAnnotationText: function (srcTxt) {
            if (srcTxt) {
                var outTxt = srcTxt.replace(/ {8}.*\r\n/g, '<code>$1</code>');
                outTxt = outTxt.replace(/\r\n/g, '<br>'); // convert new lines
                outTxt = outTxt.replace(/\'{5}([^\']*)\'{5}/g, '<b><i>$1</i></b>'); // convert '''''bold italics'''''
                outTxt = outTxt.replace(/\'{3}([^\']*)\'{3}/g, '<b>$1</b>'); // convert '''bold'''
                outTxt = outTxt.replace(/\'{2}([^\']*)\'{2}/g, '<b><i>$1</i></b>'); // convert ''italics''
                outTxt = outTxt.replace(/-{4}/g, '<hr>');
                outTxt = outTxt.replace(/\={3} ([^\=]*) \={3}/g, '<h3>$1</h3>');
                outTxt = outTxt.replace(/\={2} ([^\=]*) \={2}/g, '<h2>$1</h2>');
                outTxt = outTxt.replace(/\= ([^\=]*) \=/g, '<h1>$1</h1>');
                return outTxt;
            } else
                return '';
        },

        addAlbumFunctionsToRGArray: function (uid, rgArray, artistName) {
            forEach(rgArray, function (item) {
                if (artistName)
                    item.albumArtist = artistName;
                musicBrainz.getReleaseGroupClass(uid, item);
            });
        },

        getDirectImageURLAsync: function (uid, imgUrl, size) {
            return new Promise(function (resolve, reject) {
                var regExp = /.*wikimedia\.org.*File\:.*\.(jpg|png|gif|jpeg)$/i;
                if (imgUrl && imgUrl.match(regExp)) {
                    // it is wiki page with file, convert to thumb link
                    size = size || 500;
                    musicBrainz.getWikiImageThumbURL(uid, imgUrl, size).then(function (res) {
                        resolve(res);
                    });
                } else {
                    // not wiki link, hopefully link directly to artist image
                    return resolve({
                        thumb: imgUrl,
                        url: imgUrl
                    });
                }
            });
        },

        // returns array with found tags
        findTag: function (uid, genre) {
            return new Promise(function (resolve, reject) {
                var term = genre.title;
                doSearch(uid, term, 'tag').then(function (searchRes) {
                    if (searchRes && searchRes['tags']) {
                        resolve(searchRes['tags']);
                    } else
                        resolve();
                });
            });
        },

        getNameRecordings: function (uid, track, params) {
            params = params || {};
            return new Promise(function (resolve, reject) {
                var term = 'recording:' + prepareSearchTerm(track.title) + ' AND artist:' + prepareSearchTerm(prepareArtistTerm(track.artist)) + ' AND primarytype:album';
                doSearch(uid, term, 'recording', params.top ? 10 : 100).then(function (searchRes) {
                    if (searchRes && searchRes.recordings) {
                        resolve(searchRes.recordings);
                    } else {
                        resolve([]);
                    }
                });
            });
        },

        getTagTracks: function (uid, genre, params) {
            params = params || {};
            return new Promise(function (resolve, reject) {
                var term = 'tag:' + prepareSearchTerm(genre.title);
                doSearch(uid, term, 'recording', params.top ? 10 : 100).then(function (searchRes) {
                    if (searchRes && searchRes.recordings) {
                        var allTracks = searchRes.recordings;
                        var tracksds = params.tracklist || app.utils.createTracklist(false); // not loaded flag

                        tracksds.asyncFill(allTracks.length, function (idx, track) {
                            fillTrack(track, allTracks[idx]);
                        }).then1(function (e) {
                            if (!isAbortError(e)) {
                                tracksds.globalModifyWatch = true; // monitor changes, so the list will be correctly updated, e.g. nowplaying indicator
                                resolve(tracksds);
                            } else {
                                resolve();
                            }
                        });
                    } else {
                        resolve();
                    }
                });
            });
        },

        // returns array with release-group by given genre
        getTagReleaseGroups: function (uid, genre, limit) {
            var _this = this;
            return new Promise(function (resolve, reject) {
                var term = 'tag:' + prepareSearchTerm(genre.title);
                doSearch(uid, term, 'release-group', (limit !== undefined) ? limit : 100).then(function (resObj) {
                    if (isObjectLiteral(resObj)) {
                        for (var i = 0; i < resObj['release-groups'].length; i++) {
                            resObj['release-groups'][i] = _this.getReleaseGroupClass(uid, resObj['release-groups'][i]);
                        }
                        resolve(resObj['release-groups']);
                    } else {
                        resolve([]);
                    }
                });
            });
        },

        // returns array with artists by given genre
        getTagArtists: function (uid, genre) {
            return new Promise(function (resolve, reject) {
                var term = 'tag:' + prepareSearchTerm(genre.title);
                doSearch(uid, term, 'artist', 100).then(function (resObj) {
                    resolve(resObj);
                });
            });
        },


        // returns array with search results - one item for every result, sorted by relevance in descending order
        findReleaseGroup: function (uid, album, officialOnly, allTracks, all) {
            return new Promise(function (resolve, reject) {
                if (!album.title && !album.albumArtist) {
                    resolve();
                    return;
                }
                var add = '';
                if (allTracks) {
                    add = 'tracks=1';
                }
                var term = ''; // 'status:official AND '; // status filter removed now, so we can search in unofficial releases too
                if (officialOnly) {
                    term = 'status:official AND ';
                }
                if (album.title)
                    term += ' releasegroup:' + prepareSearchTerm(album.title);
                if (album.albumArtist)
                    term += ' artist:' + prepareSearchTerm(prepareArtistTerm(album.albumArtist));
                doSearch(uid, term, 'release-group', (all === true) ? LIMIT_ALL : (typeof all == 'number' ? all : undefined), undefined, undefined, add).then(function (searchRes) {
                    if (searchRes && searchRes['release-groups']) {
                        resolve(searchRes['release-groups']);
                    } else
                        resolve();
                });
            });
        },

        findArtistPrepareSelection: function (uid, artist) {
            var prName = 'findArtistPrepareSelection_' + artist.name;
            if (cachedPromises[prName] && !cachedPromises[prName].canceled) {
                return cachedPromises[prName];
            }
            cachedPromises[prName] = musicBrainz.findArtist(uid, artist, {
                includeAnotherArtist: true,
                prepareSelectItems: true
            }).then1(function (res) {
                cachedPromises[prName] = undefined;
                return res;
            });
            return cachedPromises[prName];
        },

        // returns array with search results - one item for every result, sorted by relevance in descending order
        findArtist: function (uid, artist, params) {
            return new Promise(function (resolve, reject) {
                var term = prepareSearchTerm(artist.name); // do not remove "The", it can cause problems sometimes, issue #15288
                doSearch(uid, 'artist:' + term + ' OR sortname:' + term + ' OR alias:' + term/* + ' OR artistaccent:' + term*/, 'artist').then(function (searchRes) {
                    var mbgid = artist.mbgid; // save previous state before search, it will fill default mbgid, if found, automatically
                    if (searchRes && searchRes.artists) {
                        if (searchRes.count && searchRes.artists.length > 0) {
                            var rgroups = searchRes.artists[0]['release-groups'];
                            if (rgroups)
                                musicBrainz.addAlbumFunctionsToRGArray(uid, rgroups);
                            if (!artist.mbgid) {
                                // update mbgid in DB
                                artist.mbgid = searchRes.artists[0].id;
                                if (artist.id > 0)
                                    artist.commitAsync();
                            }
                        }
                        var artistsSL = undefined;
                        if (params) {
                            if (params.includeAnotherArtist) {
                                // add "Another artist" item
                                searchRes.artists.push({
                                    'score': 0,
                                    'lucenescore': '0',
                                    'name': artist.name,
                                    'id': '0',
                                    isAnother: true
                                });
                            }
                            if (params.prepareSelectItems) {
                                // prepare items for artist selection popups
                                artistsSL = newStringList();
                                var resIdx;
                                if (mbgid)
                                    resIdx = -1; // we have exact gid, do not allow changing it in case search does not find it
                                else
                                    resIdx = 0;
                                forEach(searchRes.artists, function (art, idx) {
                                    var artName = art.isAnother ? ('<span class="textOther">' + ' ' + _('Don\'t display info') + '</span>') : escapeXml(art.name);
                                    var txt = '<div data-html="1" class="inline paddingSmall vSeparatorTiny" style="width: 2.5em;"><div class="scoreBar" style="height: 0.5em; width: ' + art.score + '%"></div></div>' + artName;
                                    if (art.disambiguation)
                                        txt += ' (' + art.disambiguation + ')';
                                    artistsSL.add(txt);
                                    if (mbgid && (mbgid === art.id)) {
                                        resIdx = idx;
                                    }
                                })
                                if (resIdx >= 0)
                                    artistsSL.focusedIndex = resIdx;
                            }
                        }
                        if (artistsSL)
                            resolve({
                                artists: searchRes.artists,
                                artistsSL: artistsSL
                            });
                        else
                            resolve(searchRes.artists);
                    } else
                        resolve();
                });
            });
        },

        // returns object with artist info - annotation, life-span, area, first 25 release-groups, url-rels, top tracks and related artists
        getArtistInfo: function (uid, artistId) {
            return getArtistData(uid, artistId, 'annotation+release-groups+url-rels+tags+top-tracks+related-artists');
        },

        getWikiURLFromWikipages: function (wikipages, lang) {
            if (!wikipages || (wikipages.length === 0))
                return '';
            var w;
            if (!lang) {
                // searching fo default wikiperex link
                for (var i = 0; i < wikipages.length; i++) {
                    w = wikipages[i];
                    if (w.lang === 'en') {
                        return w.url.replace('http://', 'https://');
                    }
                };
                // if no english wiki url is found, wikiperex is taken from the first wiki page, so fill link with the first url
                return wikipages[0].url.replace('http://', 'https://');
            } else {
                // searching for specific language link
                for (var i = 0; i < wikipages.length; i++) {
                    w = wikipages[i];
                    if (w.lang === lang) {
                        return w.url.replace('http://', 'https://');
                    }
                };
                return '';
            }
        },

        // returns object with wikiperex and wikipages for the artist
        getArtistWikiInfo: function (uid, artist) {
            return new Promise(function (resolve, reject) {
                window.uitools.globalSettings.defaultWikiLang = window.uitools.globalSettings.defaultWikiLang || 'en';
                var returnPrefLangWiki = function (resObj) {
                    var wikiUrl = musicBrainz.getWikiURLFromWikipages(resObj.wikipages);
                    if (resObj.wikipages && (resObj.wikipages.length > 0)) {
                        resObj.wikipages.sort(function (i1, i2) {
                            return i1.lang.localeCompare(i2.lang);
                        });
                    };

                    var prefWikiUrl = musicBrainz.getWikiURLFromWikipages(resObj.wikipages, window.uitools.globalSettings.defaultWikiLang);
                    if (prefWikiUrl && ((prefWikiUrl !== wikiUrl) || !resObj.wikiperex)) {
                        musicBrainz.getWikiPerex(uid, prefWikiUrl).then1(function (wperex) {
                            if (!isAbortError(wperex)) {
                                if (wperex) {
                                    resolve({
                                        wikiperex: wperex,
                                        wikipages: resObj.wikipages,
                                        wikiurl: prefWikiUrl
                                    })
                                } else
                                    resolve();
                            }
                        });
                    } else if (resObj.wikiperex) {
                        resolve({
                            wikiperex: resObj.wikiperex,
                            wikipages: resObj.wikipages,
                            wikiurl: wikiUrl
                        })
                    } else
                        resolve();
                };

                if (artist.mbgid) {
                    if (artist.mbgid === '0') {
                        resolve();
                    } else {
                        getArtistData(uid, artist.mbgid, 'annotation').then(function (resObj) {
                            if (resObj) {
                                returnPrefLangWiki(resObj);
                            } else
                                resolve();

                        });
                    };
                } else {
                    musicBrainz.findArtist(uid, artist).then(function (mbartists) {
                        if (mbartists && (mbartists.length > 0)) {
                            var resObj = mbartists[0];
                            if (resObj)
                                returnPrefLangWiki(resObj);
                            else
                                resolve();
                        } else
                            resolve();
                    });
                }
            });
        },

        // returns object with artist info - url-rels
        getArtistRelations: function (uid, artistId) {
            return getArtistData(uid, artistId, 'url-rels');
        },

        // returns array with artist albums (album represented by object with basic info)
        getArtistReleaseGroups: function (uid, artistId, params) {
            return new Promise(function (resolve, reject) {
                params = params || {};
                params.resolve = resolve;
                params.reject = reject;
                params.startOffset = params.offset;
                var resultGroups = [];
                getNextArtistReleaseGroups(uid, artistId, resultGroups, params);
            });
        },

        // returns list of all tracks
        getArtistTracks: function (uid, artistId) {
            return new Promise(function (resolve, reject) {
                getArtistData(uid, artistId, 'tracks').then(function (artObj) {
                    if (artObj && artObj.tracks) {
                        var allTracks = artObj.tracks;
                        var tracksds = app.utils.createTracklist(false); // not loaded flag
                        // prepare input array for fillFromArray procedure
                        var arr = [];
                        forEach(allTracks, function (trObj) {
                            var o = {};
                            fillTrack(o, trObj, artObj);
                            arr.push(o);
                        });

                        tracksds.fillOnlineFromArray(arr);
                        tracksds.whenLoaded().then(function () {
                            resolve(tracksds);
                        })
                    } else {
                        resolve();
                    }
                });
            });
        },

        // return object with info about release-group cover
        getReleaseGroupCover: function (uid, rgid, params) {
            return getWikiData(uid, 'release-group/' + rgid, params);
        },

        getReleaseCover: function (uid, rid, params) {
            return getWikiData(uid, 'release/' + rid, params);
        },
        
        // return object with info about release-group relations
        getReleaseGroupRelations: function (uid, rgid, params, isRetry) {
            return new Promise(function (resolve, reject) {
                var params = undefined;
                if (isRetry) {
                    params = {
                        cacheTimeout: 1, // have to be >0, the response will be saved then
                        highPriority: true
                    };
                };
                var defaultInc = '?inc=url-rels';

                getData(uid, 'release-group/' + rgid + defaultInc, params).then(function (content) {
                    var resObj = tryEval(content);
                    if (resObj !== undefined) {
                        if (isObjectLiteral(resObj)) {
                            resolve(resObj.relations);
                        } else {
                            resolve();
                        }
                    } else {
                        // getting value failed
                        if (isRetry)
                            resolve();
                        else {
                            // retry without using request cache
                            musicBrainz.getReleaseGroupRelations(uid, releaseGroupId, true).then(function (res) {
                                resolve(res.relations);
                            });
                        };
                    }
                }, function () {
                    resolve();
                });
            });
        },

        // returns info about release-group - object with related urls, annotation and tracklist
        getReleaseGroupInfo: function (uid, releaseGroupId, isRetry, fast) {
            return new Promise(function (resolve, reject) {
                var params = undefined;
                if (isRetry) {
                    params = {
                        cacheTimeout: 1, // have to be >0, the response will be saved then
                        highPriority: true
                    };
                };
                var defaultInc = '?inc=annotation+url-rels+tags+artists+releases';
                if (fast)
                    defaultInc = '?inc=annotation';

                getData(uid, 'release-group/' + releaseGroupId + defaultInc, params).then(function (content) {
                    var resObj = tryEval(content);
                    if (resObj !== undefined) {
                        if (isObjectLiteral(resObj)) {
                            resolve(resObj);
                        } else
                            resolve();
                    } else {
                        // getting value failed
                        if (isRetry)
                            resolve();
                        else {
                            // retry without using request cache
                            musicBrainz.getReleaseGroupInfo(uid, releaseGroupId, true).then(function (res) {
                                resolve(res);
                            });
                        };
                    }
                }, function () {
                    resolve();
                });
            });
        },

        // returns array with releases for given release-group
        getReleases: function (uid, releaseGroupId, isRetry, tracks) {
            var _this = this;
            return new Promise(function (resolve, reject) {
                var params = undefined;
                if (isRetry) {
                    params = {
                        cacheTimeout: 1, // have to be >0, the response will be saved then
                        highPriority: true
                    };
                };
                var additionals = '';
                if (tracks)
                    additionals = '+recordings';
                getData(uid, 'release?release-group=' + releaseGroupId + '&inc=labels+media+artist-credits' + additionals + '&limit=100', params).then(function (content) {
                    var resObj = tryEval(content);
                    if (resObj !== undefined) {
                        if (isObjectLiteral(resObj) && resObj.releases) {
                            for (var i = 0; i < resObj.releases.length; i++) {
                                resObj.releases[i] = _this.getAlbumClass(uid, resObj.releases[i]);
                            }
                            resolve(resObj.releases);
                        } else {
                            resolve();
                        }
                    } else {
                        // getting value failed
                        if (isRetry)
                            resolve();
                        else {
                            // retry without using request cache
                            musicBrainz.getReleases(uid, releaseGroupId, true).then(function (res) {
                                resolve(res);
                            });
                        };
                    }
                }, function () {
                    resolve();
                });
            });
        },

        // returns release object, with media, tracks, recordings and related artists for given release        
        getRecordings: function (uid, releaseId, isRetry, relations, trackArtists) {
            return new Promise(function (resolve, reject) {
                var params = undefined;
                if (isRetry) {
                    params = {
                        cacheTimeout: 1, // have to be >0, the response will be saved then
                        highPriority: true
                    };
                };
                var addon = '';
                if (relations)
                    addon = '+work-rels+work-level-rels';
                getData(uid, 'release/' + releaseId + '?inc=recordings+artists+recording-level-rels+artist-rels+ratings' + (trackArtists ? '+artist-credits' : '') + addon, params).then(function (content) {
                    var resObj = tryEval(content);
                    if (resObj !== undefined) {
                        if (isObjectLiteral(resObj)) {
                            resolve(resObj);
                        } else
                            resolve();
                    } else {
                        // getting value failed
                        if (isRetry)
                            resolve();
                        else {
                            // retry without using request cache
                            musicBrainz.getRecordings(uid, releaseId, true).then(function (res) {
                                resolve(res);
                            });
                        };
                    };
                }, function () {
                    resolve();
                });
            });
        },

        getTrackRecordingWithAlbum: function (uid, title, artist, album, primaryType, limit) {
            return new Promise(function (resolve, reject) {
                var term = 'recording:"' + title + '"';
                if (artist) {
                    if (isArray(artist)) {
                        for (var i = 0; i < artist.length; i++) {
                            term += ' AND artistname:"' + artist[i] + '"';
                        }
                    } else
                        term += ' AND artist:"' + artist + '"';
                }
                if (album) {
                    term += ' AND release:"' + album + '"';
                }
                if (primaryType)
                    if (primaryType === 'all')
                        term += ' AND status:Official';
                    else
                        term += ' AND status:Official AND primarytype:' + primaryType;

                doSearch(uid, term, 'recording', limit).then(function (searchRes) {
                    if (searchRes) {
                        resolve(searchRes);
                    } else
                        resolve();
                });
            });
        },

        getTrackRecording: function (uid, title, artist, primaryType, limit) {
            return new Promise(function (resolve, reject) {
                var term = 'recording:"' + title + '"';
                if (artist) {
                    if (isArray(artist)) {
                        for (var i = 0; i < artist.length; i++) {
                            term += ' AND artistname:"' + artist[i] + '"';
                        }
                    } else
                        term += ' AND artist:"' + artist + '"';
                }
                if (primaryType)
                    if (primaryType === 'all')
                        term += ' AND status:Official';
                    else
                        term += ' AND status:Official AND primarytype:' + primaryType;

                doSearch(uid, term, 'recording', limit).then(function (searchRes) {
                    if (searchRes) {
                        resolve(searchRes);
                    } else
                        resolve();
                });
            });
        },

        getRecordingInfo: function (uid, recording) {
            return new Promise(function (resolve, reject) {
                var term = 'rid:"' + recording + '"';
                doSearch(uid, term, 'recording').then(function (searchRes) {
                    if (searchRes) {
                        resolve(searchRes);
                    } else
                        resolve();
                });
            });
        },

        getRecording: function (uid, recording) {
            return new Promise(function (resolve, reject) {
                getData(uid, 'recording/' + recording + '?inc=artists+ratings').then(function (content) {
                    var resObj = tryEval(content);
                    if (resObj !== undefined) {
                        if (isObjectLiteral(resObj)) {
                            resolve(resObj);
                        } else
                            resolve();
                    } else {
                        resolve();
                    };
                }, function () {
                    resolve();
                });
            });
        },

        getRecordingTags: function (uid, recording) {
            return new Promise(function (resolve, reject) {
                getData(uid, 'recording/' + recording + '?inc=tags').then(function (content) {
                    var resObj = tryEval(content);
                    if (resObj !== undefined) {
                        if (isObjectLiteral(resObj)) {
                            resolve(resObj);
                        } else
                            resolve();
                    } else {
                        resolve();
                    };
                }, function () {
                    resolve();
                });
            });
        },

        getRecordingReleaseGroups: function (uid, recording) {
            return new Promise(function (resolve, reject) {
                getData(uid, 'recording/' + recording + '?inc=releases+release-groups').then(function (content) {
                    var resObj = tryEval(content);
                    if (resObj !== undefined) {
                        if (isObjectLiteral(resObj)) {
                            resolve(resObj);
                        } else
                            resolve();
                    } else {
                        resolve();
                    };
                }, function () {
                    resolve();
                });
            });
        },

        browseRelations: function (track, relations) {

            var processRelations = function (relations) {
                if (!relations) return;
                relations.forEach(function (relation) {
                    var targetType = relation['target-type'];
                    if (relation[targetType].relations) { // sub relations
                        processRelations(relation[targetType].relations);
                    }

                    var handleAttributes = function () {
                        if (relation.attributes && relation.attributes.length) {
                            var value = '';
                            relation.attributes.forEach(function (attr) {
                                if (value)
                                    value += ', ';
                                value += attr;
                            });
                            if (value)
                                value += ': ' + getValue();
                            addValue('involvedPeople', value);
                        } else {
                            var value = relation.type + ': ' + getValue();
                            addValue('involvedPeople', value);
                        }
                    }

                    var getValue = function () {
                        return relation[targetType].name || relation[targetType].title;
                    }

                    var addValue = function (prop, value) {
                        if (track[prop] === undefined)
                            track[prop] = '';
                        if (track[prop] !== '')
                            track[prop] += '; ';
                        track[prop] += value;
                    }

                    var value = getValue();

                    switch (relation.type) {
                        case 'composer':
                            addValue('composer', value);
                            break;
                        case 'lyricist':
                            addValue('lyricist', value);
                            break;
                        case 'publisher':
                            addValue('publisher', value);
                            break;
                        case 'based on':
                            break;
                        case 'discogs':
                            if(relation.url && relation.url.resource) {
                                addValue.value('discogs', relation.url.resource);
                            }
                            break;
                        default:
                            handleAttributes();

                            break;
                    }
                });
            };

            processRelations(relations);
        },

        getTracklistFromMedia: function (rObj) {
            var year;
            if (rObj['date'])
                year = rObj['date'];
            else
                year = rObj['first-release-date'];
            var ds = app.utils.createTracklist(!rObj.media);
            if (rObj.media) {
                var artistTitle = '';
                if (rObj['artist-credit']) {
                    forEach(rObj['artist-credit'], function (art) {
                        if (artistTitle)
                            artistTitle += ';';
                        artistTitle += art.artist.name;
                    });
                }

                var discNumber, trackNum;
                var allTracks = [];
                var fillDiscNo = (rObj.media.length > 1); // fill and show disc number only for albums with more than one medium

                forEach(rObj.media, function (mObj) {
                    discNumber = mObj.position;
                    trackNum = 1;
                    forEach(mObj.tracks, function (track) {
                        if (fillDiscNo)
                            track.discNumber = discNumber;
                        track.trackNumber = trackNum; // track.number - not used, it contains things like "A1", "B1" to differentiate side of vinyl, cassette, etc.
                        track.album_name = rObj.title;
                        if (track.recording && track.recording.relations) {
                            musicBrainz.browseRelations(track, track.recording.relations);
                        }
                        if (track.recording['artist-credit']) {
                            var artistTitle = '';
                            forEach(track.recording['artist-credit'], function (art) {
                                if (artistTitle)
                                    artistTitle += ';';
                                artistTitle += art.artist.name;
                            });
                            track.artist = artistTitle;
                        } else
                        if (track['artist-credit']) {
                            var artistTitle = '';
                            forEach(track['artist-credit'], function (art) {
                                if (artistTitle)
                                    artistTitle += ';';
                                artistTitle += art.artist.name;
                            });
                            track.artist = artistTitle;
                        }

                        trackNum++;
                        allTracks.push(track);
                    });
                });

                var artObj = {
                    name: artistTitle,
                    date: year
                };
                // prepare input array for fillFromArray procedure
                var arr = [];
                forEach(allTracks, function (trObj) {
                    var o = {};
                    fillTrack(o, trObj, artObj);
                    arr.push(o);
                });
                ds.fillOnlineFromArray(arr);
            }
            return ds;
        },

        // returns release tracks and cover image existence flag
        getReleaseInfo: function (uid, releaseId, forceCreateTracklist, relations, trackArtists) {
            return musicBrainz.getRecordings(uid, releaseId, false, relations, trackArtists).then(function (rObject) {
                var retval = {};
                if (!rObject)
                    return retval;
                var released = rObject['date'];
                if (released) {
                    var releasedDate = new Date(released);
                    retval.year = releasedDate.getFullYear();
                } else {
                    retval.year = 0;
                }
                retval.release = rObject; // do not convert to tracklist yet, it is time consuming and may be not needed yet
                if (forceCreateTracklist) {
                    retval.tracklist = musicBrainz.getTracklistFromMedia(rObject);
                }
                var caa = rObject['cover-art-archive'];
                retval.isCover = caa && caa.artwork && caa.count;
                return retval;
            });
        },

        getReleaseCovers: function (uid, releaseId) {
            return new Promise(function (resolve) {
                musicBrainz.getReleaseCover(uid, releaseId).then(function (infoClass) {
                    if (infoClass && infoClass.images) {
                        resolve(infoClass.images);
                        return;
                    }
                    resolve();
                }, function () {
                    resolve();
                });
            });
        },

        // returns release-group tracks
        getReleaseGroupTracks: function (uid, rgId, isRetry, createTracklist) {
            var promise = new Promise(function (resolve, reject) {
                var params = {
                    highPriority: true // tracklist fetching have to be as fast as possible, needed e.g.in popups
                };

                if (isRetry) {
                    params.cacheTimeout = 1; // have to be >0, the response will be saved then
                };
                getData(uid, 'release-group/' + rgId + '?inc=artists', params).then(function (content) {
                    if (promise.canceled) {
                        if (reject)
                            reject();
                        return;
                    };
                    var resObj = tryEval(content);
                    if (resObj !== undefined) {
                        if (isObjectLiteral(resObj)) {
                            if (createTracklist || (createTracklist === undefined))
                                resolve(musicBrainz.getTracklistFromMedia(resObj));
                            else
                                resolve(resObj);
                        } else
                            resolve();
                    } else {
                        // getting value failed
                        if (isRetry)
                            resolve();
                        else {
                            // retry without using request cache
                            musicBrainz.getReleaseGroupTracks(uid, rgId, true).then(function (res) {
                                resolve(res);
                            }, function () {
                                if (reject)
                                    reject();
                            });
                        };
                    };
                }, function () {
                    resolve();
                });
            });
            return promise;
        },

        getMBEditLink: function (datatype, gid) {
            var uri;
            if (gid && (gid !== '0'))
                uri = gid + '/edit';
            else
                uri = 'create';
            return 'https://musicbrainz.org/' + datatype + '/' + uri;

        },

        // convert Wikipedia URL for page with image to direct thumbnail image url
        getWikiImageThumbURL: function (uid, fileurl, width) {
            return new Promise(function (resolve, reject) {
                var regExp = /File\:.*\.(jpg|png|gif|jpeg)$/i;
                var matches = fileurl.match(regExp);
                if (matches && (matches.length > 0)) {
                    if (!width)
                        width = 200;
                    var q = 'https://en.wikipedia.org/w/api.php?action=query&titles=' + matches[0] + '&format=json&prop=imageinfo&&iiprop=url&iiurlwidth=' + width;
                    getWikiData(uid, q, {
                        highPriority: true
                    }).then(function (cvrObj) {
                        if (cvrObj && cvrObj.query && cvrObj.query.pages) {
                            var pgs = cvrObj.query.pages;
                            var keys = Object.keys(pgs);
                            if (keys && (keys.length > 0)) {
                                var pg = pgs[keys[0]];
                                if (pg && pg.imageinfo && pg.imageinfo.length > 0) {
                                    resolve({
                                        thumb: pg.imageinfo[0].thumburl,
                                        url: pg.imageinfo[0].url
                                    });
                                } else
                                    resolve();
                            } else
                                resolve();
                        } else {
                            resolve();
                        }
                    });
                } else
                    resolve();
            });
        },

        getCorrectWikiPage: function (uid, wikilink, callback) {

            var processReferToPage = function (usedAddr, str) {
                if ((str.length < 4000) && (str.indexOf('may refer to:') > -1)) {
                    var redirect = [];
                    if (str) {
                        var tempArray;
                        var patt = /\[\[(.*?)\]\]/g;
                        while ((tempArray = patt.exec(str)) !== null) {
                            redirect.push(tempArray[1]);
                        }
                    }

                    for (var i = 0; i < redirect.length; i++) {
                        var item = redirect[i];
                        if ((item.indexOf('music') > -1 || item.indexOf('genre') > -1) && (item.indexOf('musician') == -1)) {
                            if (item.indexOf('|') > -1) {
                                item = item.substring(0, item.indexOf('|'));
                            }
                            callback(item);
                            return;
                        }
                    }
                }
                callback(usedAddr);
            }

            getWikiData(uid, 'https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&format=json&titles=' + wikilink, {
                highPriority: true
            }).then(function (wikiObj) {
                var content = JSON.stringify(wikiObj);
                var redirectAddr = /#REDIRECT \[\[(.*?)\]\]/gi.exec(content);
                if (redirectAddr) {
                    getWikiData(uid, 'https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&format=json&titles=' + redirectAddr[1], {
                        highPriority: true
                    }).then(function (wikiObj) {
                        processReferToPage(redirectAddr[1], JSON.stringify(wikiObj));
                    });
                } else {
                    processReferToPage(wikilink, content);
                }
            });
        },

        // return HTML formatted perex from Wikipedia link
        getWikiPerex: function (uid, wikilink) {
            return new Promise(function (resolve, reject) {
                var q = wikilink.replace('.wikipedia.org/wiki/', '.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&format=json&titles=');
                getWikiData(uid, q, {
                    highPriority: true
                }).then(function (wikiObj) {
                    if (wikiObj && wikiObj.query && wikiObj.query.pages) {
                        var pgs = wikiObj.query.pages;
                        var keys = Object.keys(pgs);
                        if (keys && (keys.length > 0)) {
                            var txt = pgs[keys[0]].extract || '';
                            // remove error messages from Wiki result
                            txt = txt.replace(/<p>((?!\/p>).)*HIDDEN ERROR:((?!\/p>).)*<\/p>/gi, '');
                            resolve(txt);
                        } else
                            resolve();
                    } else {
                        resolve();
                    }
                }, function () {
                    if (reject)
                        reject();
                });
            });
        },

        // return title image from Wikipadia page, if exists. It could be album artwork or artist image
        getWikiPageImage: function (uid, wikilink, size) {
            return new Promise(function (resolve, reject) {
                var q = wikilink.replace('.wikipedia.org/wiki/', '.wikipedia.org/w/api.php?action=query&prop=pageprops&format=json&titles=');
                getWikiData(uid, q, {
                    highPriority: false
                }).then(function (wikiObj) {
                    if (wikiObj && wikiObj.query && wikiObj.query.pages) {
                        var pgs = wikiObj.query.pages;
                        var keys = Object.keys(pgs);
                        if (keys && (keys.length > 0)) {
                            var pp = pgs[keys[0]].pageprops;
                            if (pp && pp.page_image) {
                                size = size || 200;
                                musicBrainz.getWikiImageThumbURL(uid, 'File:' + pp.page_image, size).then(function (res) {
                                    resolve(res);
                                });
                            } else {
                                resolve();
                            }
                        } else
                            resolve();
                    } else {
                        resolve();
                    }
                });
            });
        },

        getWikiLinkFromWikidata: function (uid, wikidataLink) {
            return new Promise(function (resolve, reject) {
                var matches = wikidataLink.match(/.*wikidata.*\/(Q[^\/]*)$/i);
                if (matches && (matches.length > 1)) {
                    var id = matches[1];
                    var q = 'https://www.wikidata.org/w/api.php?action=wbgetentities&props=sitelinks&format=json&ids=' + id;
                    getWikiData(uid, q, {
                        highPriority: true
                    }).then(function (wikiObj) {
                        if (wikiObj && wikiObj.entities && wikiObj.entities[id]) {
                            var sites = wikiObj.entities[id].sitelinks;
                            var keys = Object.keys(sites);
                            if (keys && keys.length) {
                                var retlink = undefined;
                                for (var i = 0; i < keys.length; i++) {
                                    // TODO: choose possible right language?
                                    var s = sites[keys[i]];
                                    var matches = s.site.match(/^(.*)wiki$/); // match language prefix
                                    if (matches && (matches.length > 1)) {
                                        retlink = 'https://' + matches[1] + '.wikipedia.org/wiki/' + s.title.replace(/ /g, '_');
                                        break;
                                    }
                                }
                                resolve(retlink);
                            } else
                                resolve();

                        } else
                            resolve();
                    });
                } else
                    resolve();
            });
        },

        getWikiEditLink: function (wikilink) {
            return wikilink.replace('.wikipedia.org/wiki/', '.wikipedia.org/w/index.php?action=edit&title=');
        },

        // fills given element with text from wikipedia, link to the original article and link to the license
        fillWikiElement: function (wikiEl, wikiURL, wikiText, callback, params) {
            cleanElement(wikiEl, true /* only children */ ); // correct cleaning including listeners
            wikiEl.controlClass = wikiEl.controlClass || new Control(wikiEl); // needed Control for correct listeners handling
            wikiEl.controlClass.wikiURL = wikiURL;
            params = params || {};

            var prepareWikiElement = function () {
                var wikiDesc = document.createElement('span');
                if (params.onlyText) {
                    var wikiDescP = document.createElement('p'); // to have default paragraph cursor
                    wikiDescP.innerText = wikiText;
                    wikiDesc.appendChild(wikiDescP);
                }
                else
                    wikiDesc.innerHTML = wikiText;
                wikiEl.appendChild(wikiDesc);
                wikiDesc.controlClass = new Editable(wikiDesc, {
                    multiline: true,
                    editable: false
                });
                wikiDesc.controlClass.localListen(wikiDesc, 'change', function (e) {
                    wikiEl.controlClass.raiseEvent('change', e.detail);
                });
                if (params.editable) {
                    wikiDesc.controlClass.localListen(wikiDesc, 'editStart', function (e) {
                        wikiEl.controlClass.raiseEvent('editStart', e.detail);
                    });
                    wikiDesc.controlClass.localListen(wikiDesc, 'editEnd', function (e) {
                        wikiDesc.controlClass.editable = false;
                        wikiDesc.controlClass.container.blur();
                        wikiEl.controlClass.raiseEvent('editEnd', e.detail);
                    });
                    wikiEl.controlClass.startEdit = function () {
                        wikiDesc.controlClass.editable = true;
                        wikiDesc.controlClass.container.focus();
                    };
                    wikiDesc.controlClass.addCleanFunc(function () {
                        if (wikiEl.controlClass)
                            wikiEl.controlClass.startEdit = undefined; // #18956
                    });
                };
                return wikiDesc;
            };

            if (params.fromWiki) {
                loadIcon('by-sa', function (data) {
                    if (wikiEl && wikiEl.controlClass && (wikiEl.controlClass.wikiURL === wikiURL)) { // not cleared yet
                        var wikiCont = '';
                        if (wikiURL) {
                            wikiCont = '<span data-id="wikiContinue" class="hotlink">' + _('Continue reading at Wikipedia...') + '</span>&nbsp;&nbsp;';
                        }
                        var wikiLink = document.createElement('p');
                        wikiLink.className = 'textOther';
                        wikiLink.innerHTML = wikiCont + ' <span class="inline hotlink" onclick="uitools.openWeb(\'https://creativecommons.org/licenses/by-sa/3.0/\');" style="width: 5.5em; height: 1em">' + data + '</span>';
                        var wikiDesc = prepareWikiElement();
                        wikiEl.appendChild(wikiLink);

                        if (wikiURL) {
                            var wc = qeid(wikiLink, 'wikiContinue');
                            if (wc) {
                                wc.controlClass = new Control(wc); // to allow correct automatic unlisten
                                wc.controlClass.localListen(wc, 'click', function (e) {
                                    e.stopPropagation();
                                    uitools.openWeb(wikiURL);
                                }, true);
                                wc = undefined;
                            }
                        };
                        notifyLayoutChangeUp(wikiDesc);
                        if (callback)
                            callback();
                    };
                });
            } else {
                var wikiDesc = prepareWikiElement();
                notifyLayoutChangeUp(wikiDesc);
                if (callback)
                    callback();
            };
        },

        // fills given element with clickable error text
        fillWikiElementWithError: function (wikiEl, clickCallback) {
            cleanElement(wikiEl, true /* only children */ ); // correct cleaning including listeners
            wikiEl.innerHTML = '<div data-id="wikiError" class="hotlink paddingRow">' + _('Error downloading content. Click to retry.') + '</div>';
            var we = qeid(wikiEl, 'wikiError');
            if (we) {
                we.controlClass = new Control(we); // to allow correct automatic unlisten
                we.controlClass.localListen(we, 'click', clickCallback);
                we = undefined;
            }
        },

        // fills given element with text for no matching content online
        fillWikiElementWithNoMatch: function (wikiEl, datatype) {
            cleanElement(wikiEl, true /* only children */ ); // correct cleaning including listeners
            var mblink = '<span data-id="MBLink" class="hotlink">MusicBrainz</span>';
            wikiEl.innerHTML = '<div data-id="wikiNoMatch" class="paddingRow">' + _('No matching content online. Please verify the spelling of existing metadata or edit the entry in ') + mblink + '.</div>';
            var mbl = qeid(wikiEl, 'MBLink');
            if (mbl) {
                mbl.controlClass = new Control(mbl); // to allow correct automatic unlisten
                mbl.controlClass.localListen(mbl, 'click', function () {
                    uitools.openWeb(musicBrainz.getMBEditLink(datatype));
                });
                mbl = undefined;
            }
        },

        // cancels all ongoing and queued downloads from MB of Wiki server
        cancelDownloads: function (uid) {
            if (fetchAllTrackTokens[uid]) {
                fetchAllTrackTokens[uid].cancel = true;
                fetchAllTrackTokens[uid] = undefined;
            };
            downloadQueue = downloadQueue.filter(function (req) {
                if ((req.uid === uid) && req.reject) {
                    req.reject();
                }
                return (req.uid !== uid);
            });
            if (downloadPromises[uid]) {
                downloadPromises[uid].cancel();
            }
            downloadCoverQueue = downloadCoverQueue.filter(function (req) {
                if ((req.uid === uid) && req.reject) {
                    req.reject();
                }
                return (req.uid !== uid);
            });
            if (downloadCoverPromises[uid]) {
                downloadCoverPromises[uid].cancel();
            }
        },

        // perform online search. In searchRes result are 3 main arrays: artists, genres and albums
        onlineSearch: function (uid, query, limit, offset) {
            return new Promise(function (resolve, reject) {
                musicBrainz.cancelDownloads(uid); // #15460

                var term = query;
                doSearch(uid, term, 'place', limit, offset).then(function (searchRes) {
                    searchRes = searchRes || {};
                    if (searchRes.artists) {
                        for (var i = 0; i < searchRes.artists.length; i++) {
                            searchRes.artists[i] = musicBrainz.getArtistClass(uid, searchRes.artists[i]);
                        }
                    } else {
                        searchRes.artists = [];
                    }
                    if (searchRes.albums) {
                        for (var i = 0; i < searchRes.albums.length; i++) {
                            searchRes.albums[i] = musicBrainz.getReleaseGroupClass(uid, searchRes.albums[i]);
                        }
                    } else {
                        searchRes.albums = [];
                    }
                    if (searchRes.genres) {
                        for (var i = 0; i < searchRes.genres.length; i++) {
                            searchRes.genres[i] = musicBrainz.getGenreClass(uid, searchRes.genres[i]);
                        }
                    } else {
                        searchRes.genres = [];
                    }
                    if (searchRes.composers) {
                        for (var i = 0; i < searchRes.composers.length; i++) {
                            searchRes.composers[i] = musicBrainz.getArtistClass(uid, searchRes.composers[i]);
                        }
                    } else {
                        searchRes.composers = [];
                    }
                    if (searchRes.tracks) {
                        var jstracks = searchRes.tracks;
                        searchRes.tracks = app.utils.createTracklist(false);

                        // prepare input array for fillFromArray procedure
                        var arr = [];
                        forEach(jstracks, function (trObj) {
                            var o = {};
                            fillTrack(o, trObj);
                            arr.push(o);
                        });

                        searchRes.tracks.fillOnlineFromArray(arr);
                        resolve(searchRes);
                    } else {
                        searchRes.tracks = app.utils.createTracklist(true); // set loaded flag
                        resolve(searchRes);
                    }
                });
            });
        },

        // convert MB artist class (from any query to MB server) to MM artist class
        getArtistClass: function (uid, mbArt) {
            var fetchArtistImage = function (artist, callback, pixelSizeW, pixelSizeH, params) {
                if (!artist || !artist.mbgid)
                    return;

                var addPathToCache = function (url) {
                    if (params && params.origArtist)
                        app.utils.addCachedThumbPath(params.origArtist, url, pixelSizeW, pixelSizeH);
                };

                var _this = this;
                if (artist['image-url'] !== undefined) {
                    musicBrainz.getDirectImageURLAsync(uid, artist['image-url'], pixelSizeW).then(function (res) {
                        if (res && res.thumb) {
                            artist.thumbPath = res.thumb;
                            addPathToCache(res.thumb);
                        }
                        callback(url);
                    });
                } else {
                    this.getArtistRelations(uid, artist.mbgid).then(function (artObj) {
                        if (artObj) {
                            // check relations - find image url and Wikipedia url
                            var imgUrl = '';
                            if (artObj.relations) {
                                var rel;
                                for (var i = 0; i < artObj.relations.length; i++) {
                                    rel = artObj.relations[i];
                                    if ((rel.type === 'image') && rel.url && rel.url.resource) {
                                        imgUrl = rel.url.resource;
                                    }
                                };
                            }
                            if (imgUrl) {
                                _this.getDirectImageURLAsync(_this.uniqueID, imgUrl, pixelSizeW).then(function (res) {
                                    if (res && res.thumb) {
                                        artist._triedImageFromMB = true;
                                        artist.thumbPath = res.thumb;
                                        addPathToCache(res.thumb);
                                        callback(res.thumb);
                                    } else
                                        callback();
                                });
                            } else {
                                artist._triedImageFromMB = true;
                            }
                        }
                    });
                };
            }.bind(this);


            var ritem = mbArt;
            ritem.jsclass = true; // indication, that it is not real Delphi TArtist class
            ritem.isOnline = true; // indication, that it is item from online content
            if(ritem.gid)
                ritem.mbgid = ritem.gid;
            else
                ritem.mbgid = ritem.id;
            ritem.title = ritem.name;
            ritem.thumbPath = '';
            ritem.objectType = 'artist';
            ritem.getCachedThumb = function () {
                return ritem.thumbPath;
            };

            ritem.getThumbAsync = function (pixelSizeW, pixelSizeH, callback, params) {
                if (ritem.thumbPath) {
                    callback(ritem.thumbPath);
                    return 0;
                }

                app.getObject('artist', {
                    name: ritem.name,
                    mbgid: ritem.mbgid,
                    canReturnEmpty: true
                }).then(function (artistObj) {
                    if (artistObj) {
                        artistObj.getThumbAsync(pixelSizeW, pixelSizeH, function (imgLink) {
                            if (imgLink) {
                                ritem.thumbPath = imgLink;
                                callback(imgLink);
                            } else {
                                fetchArtistImage(ritem, callback, pixelSizeW, pixelSizeH, params);
                            }
                        });
                    } else {
                        fetchArtistImage(ritem, callback, pixelSizeW, pixelSizeH, params);
                    }
                }, function (err) {
                    assert(false, err);
                });
                return 0;
            };

            ritem.thumbCallback = function (pixelSizeW, pixelSizeH, callback, origArtist, params) {
                params = params || {};
                params.origArtist = origArtist;
                ritem.getThumbAsync(pixelSizeW, pixelSizeH, callback, params);
            };

            ritem.tracksCallback = function () {
                var sl = app.utils.createTracklist(false);
                musicBrainz.getArtistTracks(uid, ritem.mbgid).then1(function (allTracksDS) {
                    if (!isAbortError(allTracksDS) && allTracksDS) {
                        sl.addList(allTracksDS);
                        sl.notifyLoaded();
                    } else
                        sl.notifyLoaded();
                });
                return sl;
            };

            ritem.getTracklist = function () {
                return ritem.tracksCallback();
            };

            ritem.albumsCallback = function () {
                if (ritem.cachedAlbumlist)
                    return ritem.cachedAlbumlist;
                var al = app.utils.createAlbumlist(false);
                musicBrainz.getArtistReleaseGroups(uid, ritem.mbgid, {
                    offset: 0,
                    artistName: ritem.name
                }).then(function (rg) {
                    // for now, filter studio albums only - Album with no secondary type and stats Official
                    var rgArray = [];
                    forEach(rg, function (item) {
                        if ((item['primary-type'] === 'Album') && (item['secondary-types'].length === 0) && (item['status'] === 'Official')) {
                            rgArray.push(item);
                        }
                    });

                    al.asyncFill(rgArray.length, function (idx, album) {
                        musicBrainz.fillAlbumFromRG(album, rgArray[idx]);
                    }).then(function () {
                        ritem.cachedAlbumlist = al;
                    });
                });

                return al;
            };

            ritem.getItemList = function (listType, sortStr) {
                var lst = undefined;
                if (listType === 'albums') {
                    lst = ritem.albumsCallback();
                } else if (listType === 'tracks') {
                    lst = ritem.tracksCallback();
                }
                if (lst && sortStr) {
                    lst.setAutoSortAsync(sortStr);
                }
                return lst;
            };

            return ritem;
        },

        getAlbumClass: function (uid, mbAlbum) {
            var _this = this;
            var item = mbAlbum;
            var released = item['date'];
            if (released) {
                if (released.length === 4) { // only year - add 31. december, so it will be sorted later as last in the year
                    released += '-12-31';
                } else if ((released.length === 6) || (released.length === 7)) { // only year and month - add last day of the month, so it will be sorted as last in the month
                    var tmpD = new Date(released);
                    item.releasedDate = new Date(tmpD.getFullYear(), tmpD.getMonth() + 1, 0); // date with day 0 of the next month = last day of current month
                }
                if (!item.releasedDate)
                    item.releasedDate = new Date(released);
            } else
                item.releasedDate = new Date('9999-1-1');
            // prepare standard properties of Album object
            item.jsclass = true; // indication, that it is not real Delphi TAlbum class
            item.isOnline = true; // indication, that it is item from online content
            item.year = item.releasedDate.getFullYear();
            item.albumArtist = '';
            item.description = '';
            item.thumbPath = '';
            item.getCachedThumb = function () {
                return item.thumbPath;
            };
            if (item.releases && item.releases.length) {
                item.mbgid = item.releases[0].id;
            } else {
                item.mbgid = item.id;
            }
            item.gid = item.id;
            item.id = -2; // not in DB
            item.objectType = 'album';

            item.getRatingAsync = function () {
                return dummyPromise(-1);
            };

            item.getThumbAsync = function (pixelSizeW, pixelSizeH, callback, params) {
                if (item.thumbPath) {
                    callback(item.thumbPath);
                    return 0;
                }

                _this.getReleaseCover(uid, item.mbgid, params).then(function (cvrObj) {
                    item.thumbPath = extractThumbPath(cvrObj);
                    callback(item.thumbPath);
                });
                return 0;
            };

            item.getTracklist = function () {
                var sl = app.utils.createTracklist(false /* do not set loaded flag */ );
                _this.getReleaseInfo(uid, item.mbgid, true /* create tracklist */ ).then1(function (tl) {
                    if (!isAbortError(tl) && tl && tl.tracklist && tl.tracklist.whenLoaded) {
                        tl.tracklist.whenLoaded().then(function () {
                            sl.addList(tl.tracklist);
                            sl.notifyLoaded();
                        });
                    } else
                        sl.notifyLoaded();
                });
                return sl;
            };

            var artC = item['artist-credit'];
            if (artC) {
                forEach(artC, function (art, idx) {
                    if (idx > 0)
                        item.albumArtist += ';';
                    if (art.artist !== undefined) {
                        item.albumArtist += art.artist.name;
                    } else {
                        item.albumArtist += art.name;
                    }
                });
            }
            var caa = item['cover-art-archive'];
            item.isCover = caa && caa.artwork && caa.count;

            return item;
        },

        fillAlbumFromRG: function (album, rgItem) {
            album.beginUpdate();
            album.id = -2; // not in DB
            album.title = rgItem.title;
            album.year = rgItem.year;
            album.albumArtist = rgItem.albumArtist;
            album.mbrggid = rgItem.mbrggid;
            album.mbgid = rgItem.mbgid;
            album.thumbCallback = rgItem.thumbCallback;
            album.tracksCallback = rgItem.getTracklist;
            album.endUpdate();
        },

        fillArtist: function (uid, artist, artItem) {
            artist.beginUpdate();
            artist.id = -2;
            artist.mbgid = artItem.id;
            artist.name = artItem.name;
            artist.thumbCallback = artItem.thumbCallback;
            artist.tracksCallback = artItem.tracksCallback;
            artist.albumsCallback = artItem.albumsCallback;
            artist.endUpdate();
        },

        getReleaseGroupClass: function (uid, item) {
            var released = item['first-release-date'];
            if (released)
                item.releasedDate = new Date(released);
            else
                item.releasedDate = new Date('9999-1-1');

            if (item.releasedDate)
                item.year = item.releasedDate.getFullYear();
            item.jsclass = true; // indication, that it is not real Delphi class
            item.isOnline = true; // indication, that it is item from online content
            item.albumArtist = item.albumArtist || '';
            item.description = '';
            item.thumbPath = '';
            item.getCachedThumb = function () {
                return item.thumbPath;
            };
            item.mbrggid = item.id;
            item.id = -2; // = not in DB
            item.objectType = 'album';

            item.getRatingAsync = function () {
                return dummyPromise(-1);
            };

            var getCoverAsync = function (pixelSizeW, pixelSizeH, callback, params) {
                if (item.thumbPath) {
                    callback(item.thumbPath);
                    return;
                }
                musicBrainz.getReleaseGroupCover(uid, item.mbrggid, params).then(function (cvrObj) {
                    item.thumbPath = extractThumbPath(cvrObj);
                    if (params && params.canceled) {
                        callback();
                        return;
                    }
                    if (item.thumbPath) {
                        if (params && params.origAlbObj) {
                            app.utils.addCachedThumbPath(params.origAlbObj, item.thumbPath, pixelSizeW, pixelSizeH);
                        }
                        callback(item.thumbPath);
                    } else if (item.wiki) {
                        // try to get image from wiki page
                        musicBrainz.getWikiPageImage(uid, item.wiki, 200).then(function (res) {
                            if (res && res.thumb) {
                                item.thumbPath = res.thumb;
                                if (params && params.origAlbObj) {
                                    app.utils.addCachedThumbPath(params.origAlbObj, item.thumbPath, pixelSizeW, pixelSizeH);
                                }
                            }
                            callback(item.thumbPath);
                        });
                    } else
                        callback();
                }, function () {
                    callback();
                });
            };

            item.getThumbAsync = function (pixelSizeW, pixelSizeH, callback, params) {
                getCoverAsync(pixelSizeW, pixelSizeH, callback, params);
                return 0;
            };

            item.thumbCallback = function (pixelSizeW, pixelSizeH, callback, origAlbObj, params) {
                params = params || {};
                params.origAlbObj = origAlbObj;
                getCoverAsync(pixelSizeW, pixelSizeH, callback, params);
                return 0;
            };

            item.getTracklist = function () {
                if (item.cachedTracklist)
                    return item.cachedTracklist;
                var sl = app.utils.createTracklist(false);
                musicBrainz.getReleaseGroupTracks(uid, item.mbrggid).then1(function (tl) {
                    if (!isAbortError(tl) && tl && tl.whenLoaded) {
                        tl.whenLoaded().then(function () {
                            sl.addList(tl);
                            item.cachedTracklist = sl;
                            sl.notifyLoaded();
                        });
                    } else {
                        sl.notifyLoaded(); // even when failed/canceled we have to set loaded flag to avoid possible "notifyLoaded was not called" error
                    }
                });
                return sl;
            };

            var artC = item['artist-credit'];
            if (artC && artC.length && !item.albumArtist) {
                var art = artC[0];
                item.albumArtist = art.artist.name;
                item.albumArtistMBGID = art.artist.id;
            }

            return item;
        },

        getGenreClass: function (uid, mbGenre) {
            var _title = mbGenre.name;
            var _url = mbGenre.url || mbGenre.name;
            if (_title.indexOf('|') >= 0) {
                _title = /\|(.*)/g.exec(_title)[1];
                _url = /(.*)\|/g.exec(_url)[1];
            }
            return {
                id: -1,
                jsclass: true, // indication, that it is not real Delphi TGenre class
                isOnline: true, // indication, that it is item from online content
                title: _title,
                name: _title,
                url: _url,
                thumbPath: '',
                objectType: 'genre',
                getCachedThumb: function (dimX, dimY) {
                    return this.thumbPath;
                },
                getThumbAsync: function (dimX, dimY, callback) {
                    this.thumbPath = '';
                    callback(this.thumbPath);
                    return 0;
                },
                getItemList: function (type, sortStr) {
                    var lst = undefined;
                    if (type === undefined || type === 'albums')
                        lst = this.getAlbumList();
                    else
                        lst = this.getTracklist();
                    if (lst && sortStr) {
                        lst.setAutoSortAsync(sortStr);
                    }
                    return lst;
                },
                getTracklist: function () {},
                getAlbumList: function () {},
                getTopTracklist: function (maxCount) {},
            };
        },

        decodeMBDate: function (date) {
            if (date) {
                var d = new Date(date);
                return parseInt(sprintf('%4d%02d%02d', d.getFullYear(), d.getMonth() + 1, d.getDate()));
            }
            return -1;
        }

    };
})();
