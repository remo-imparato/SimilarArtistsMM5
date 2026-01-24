/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

/*
    Adds methods for accessing TVDB service
*/

(function () {

    var serviceURL = 'https://api.thetvdb.com/';
    var apiKey = '40b806d7db94992d8b418b67f680d0ef';//'77D30E61F9DE4BA9';

    var sett = app.getValue('TVDB', {
        language: 'en'
    });
    var usedLanguages = [];

    var serviceHeaders = ['Content-Type:application/json',
                   'Accept:application/json'];

    var requestLimit = 1000; // minimal requests interval (in ms)
    var lastRequest = 0;
    var limitedRequestRunning = false;

    var loginURL = serviceURL + 'login';
    var searchURL = serviceURL + 'search/series?name=';
    var searchIMDbURL = serviceURL + 'search/series?imdbId=';
    var languagesURL = serviceURL + 'languages';
    var seriesBaseAddress = serviceURL + 'series/';
    var episodeBaseAddress = serviceURL + 'episodes/';

    var seriesPoster = '/images/query?keyType=poster';
    var seriesEpisodes = '/episodes';

    var seriesActors = '/actors';
    var seriesSummary = '/episodes/summary';
    var seriesImageDL = 'http://thetvdb.com/banners/';

    var loggedIn = false;
    var token = '';
    var allLanguages = undefined;

    var checkIMDb = function () {
        if (!window.IMDb)
            requirejs('helpers/imdb');
    };

    window.TVDB = {

        getHeaders: function () {
            var headers = newStringList();
            //headers.add('User-Agent: Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/54.0.2840.99 Safari/537.36');
            serviceHeaders.forEach(function (header) {
                headers.add(header);
            });
            return headers;
        },

        sendRequest: function (type, url, params) { // data, useHeader, useLanguage
            var _this = this;
            params = params || {};
            if (params.useLanguage === undefined) // by default, use selected language
                params.useLanguage = true;
            return new Promise(function (resolve, reject) {
                var headers = newStringList(true);
                if (loggedIn && !!token) {
                    headers.add('Authorization:Bearer ' + token);
                }

                var langHeaderIdx = -1;
                if (params.seriesID) {
                    // check we've already know language for this series
                    var storedData = app.getValue('TVDB_SeriesID_Lang_' + params.seriesID, undefined);
                    if (storedData)
                        usedLanguages[params.seriesID] = storedData;
                    var usedLang = usedLanguages[params.seriesID];
                    if (!!usedLang) { // we already found correct language for series
                        langHeaderIdx = headers.add('Accept-Language:' + usedLang);
                    }
                }

                if (params.useHeader) {
                    serviceHeaders.forEach(function (header) {
                        headers.add(header);
                    });
                    if (params.useLanguage && (langHeaderIdx < 0)) {
                        langHeaderIdx = headers.add('Accept-Language:' + (params.language || sett.language));
                    };
                }
                var reqParams = {
                    headers: headers,
                    cacheTimeout: loggedIn ? 14 * 86400 : 0,
                    requestBody: ((type === 'POST') && params.data) ? params.data : '',
                };


                var useRequestLimit = (type === 'GET');
                var lastUsedLangIdx = -1;
                var langTestInProcess = false;
                var firstData;

                var callReq = function () {
                    app.utils.web.getURLContentAsync(url, reqParams).then(function (data) {
                        if (useRequestLimit)
                            limitedRequestRunning = false;
                        if (data) {
                            var cls = {};
                            if (useRequestLimit && ((reqParams.cacheTimeout === 0) || (data[0] !== '1'))) // not read from cache
                                lastRequest = performance.now();

                            if (reqParams.cacheTimeout !== 0) { // we used request with cache, first char is cached status
                                data = data.slice(1);
                            }
                            if (data[0] === '{') {
                                cls = JSON.parse(data);

                                if (cls.errors && (!!params.seriesID) && (!usedLanguages[params.seriesID])) {
                                    // we've got errors .. unfortunately current API does not receive info about languages for series so when
                                    // default english is not filled, 'invalidLanguage' error is received in 'errors' array.
                                    var isLangError = false;
                                    if (cls.errors["invalidLanguage"]) {
                                        isLangError = true;
                                    }
                                    if (isLangError) {
                                        if (!firstData)
                                            firstData = cls;

                                        // in current API we have no way how to receive languages in series so we need to browse all available

                                        var tryLanguage = function (idx) {
                                            if (idx < allLanguages.length) {
                                                langTestInProcess = true;
                                                var lang = allLanguages[idx].abbreviation;

                                                reqParams.headers.delete(langHeaderIdx);
                                                langHeaderIdx = reqParams.headers.add('Accept-Language:' + lang);
                                                callReq();
                                            } else
                                                resolve(firstData);
                                        }

                                        if (!allLanguages) {
                                            _this.getLanguages().then(function () {
                                                tryLanguage(++lastUsedLangIdx);
                                            });
                                            return;
                                        } else {
                                            tryLanguage(++lastUsedLangIdx);
                                        }
                                        return;
                                    }
                                } else if ((!!params.seriesID) && (!usedLanguages[params.seriesID]) && langTestInProcess) {
                                    usedLanguages[params.seriesID] = allLanguages[lastUsedLangIdx].abbreviation;
                                    app.setValue('TVDB_SeriesID_Lang_' + params.seriesID, allLanguages[lastUsedLangIdx].abbreviation);
                                    langTestInProcess = false;
                                }

                                resolve(cls);
                            } else
                                resolve();
                        } else {
                            resolve();
                        }
                    }, function (e) {
                        if (e)
                            ODS('Sending request failed, ' + url + ', ' + e.response);
                        if (useRequestLimit)
                            limitedRequestRunning = false;
                        if (reject)
                            reject();
                    });
                };

                if (useRequestLimit) {
                    var sendReq = function () {
                        var diff = performance.now() - lastRequest;
                        if ((diff > requestLimit) && !limitedRequestRunning) {
                            limitedRequestRunning = true;
                            callReq();
                        } else {
                            if (limitedRequestRunning)
                                diff = 20;
                            requestTimeout(sendReq, diff);
                        }
                    };
                    sendReq();
                } else {
                    callReq();
                }
            });
        },

        logIn: function () {
            return new Promise(function (resolve) {
                if (loggedIn) {
                    resolve(true);
                } else {
                    this.sendRequest('POST', loginURL, {
                        data: '{"apikey": "' + apiKey + '","userkey": "","username": ""}',
                        useHeader: true
                    }).then(function (res) {
                        if (res && res.token) {
                            token = res.token;
                            loggedIn = true;
                        }
                        resolve(loggedIn);
                    }, function () {
                        resolve();
                    });
                }
            }.bind(this));
        },

        _loggedQuery: function (query, params) {
            params = params || {};
            params.useHeader = true;
            var prevUseLanguage = params.useLanguage;
            params.useLanguage = undefined;
            return new Promise(function (resolve) {
                this.logIn().then(function (logged) {
                    if (!logged) {
                        resolve();
                    } else {
                        params.useLanguage = prevUseLanguage;
                        this.sendRequest('GET', query, params).then(function (res) {
                            resolve(res);
                        }, function () {
                            resolve();
                        });
                    }
                }.bind(this));
            }.bind(this));
        },

        findSeriesID: function (serie, tracks) {
            var _this = this;
            return new Promise(function (resolve) {
                // TVDB have really poor searching engine (it need full words) so we use TVMaze instead

                _this.findSeriesInfo(serie).then(function (data) {
                    if (data && data.data.length) {
                        resolve(data.data[0].id);
                    } else
                        resolve(0);
                });
            });
        },

        _searchUsingMaze: function (serie, tracks, year) {
            var _this = this;
            return new Promise(function (resolve) {
                if (!window.TVMaze)
                    requirejs('helpers/tvmaze');
                window.TVMaze.getSeriesInfo(searchParam).then(function (data) {
                    var nameToUse = serie;
                    if (data && data.length) {
                        // try to locate serie based on name (score) an year
                        var sInfos = [];
                        var ar = [];

                        var lookup = function (show) {
                            if (show.show && (show.score > 15)) {
                                ar.push(_this.getSeriesInfo(show.show.externals.thetvdb).then(function (sData) {
                                    sInfos.push({
                                        show: show,
                                        series: sData.data
                                    });
                                }));
                            }
                        }


                        for (var i = 0; i < data.length; i++) {
                            lookup(data[i]);
                        }

                        if (ar.length) {
                            whenAll(ar).then(function () {
                                sInfos.sort(function (item1, item2) {
                                    return item2.show.score - item1.show.score;
                                });

                                var retAr = [];
                                var idx = 0;
                                for (var i = 0; i < sInfos.length; i++) {
                                    retAr.push(sInfos[i].series);
                                }
                                resolve({
                                    data: retAr
                                });
                            });
                            return;
                        }

                        // in show.name we have full show name we can use in TVDB
                        nameToUse = data[0].show.name;
                    }
                    resolve(nameToUse);
                });
            });
        },

        findSeriesInfo: function (serie, tracks) {
            var _this = this;
            return new Promise(function (resolve) {
                var year = 0;
                if (tracks) {
                    tracks.locked(function () {
                        var track;
                        for (var i = 0; i < tracks.count; i++) {
                            track = tracks.getFastObject(i, track);
                            if (track && (track.year > 0)) {
                                year = track.year;
                                break;
                            }
                        }
                    });
                }

                var searchParam = serie;
                // first try to use TVDB searching and in case results are unusable, use TVMaze (which have better searching engine)

                _this._loggedQuery(searchURL + encodeURIComponent(serie)).then(function (data) {
                    if (!data) {
                        // nothing found ... try to use IMDb to search series
                        checkIMDb();
                        window.IMDb.findSeriesAsync(serie).then(function (data) {
                            if (data && data.length) {
                                for (var i = 0; i < data.length; i++) {
                                    if (app.utils.stringSimilarity(data[i].Title, serie, false) >= 0.8) {
                                        // this IMDb entry is very similar ... search by IMDb ID
                                        _this._loggedQuery(searchIMDbURL + data[i].imdbID).then(function (data) {
                                            if (data && data.data && data.data.length) {
                                                // check we have filled data
                                                if (!data.data[0].overview && !data.data[0].seriesName) {
                                                    _this.getSeriesInfo(data.data[0].id).then(function (detail) {
                                                        data.data.unshift(detail.data);
                                                        resolve(data);
                                                    });
                                                    return;
                                                }
                                            }
                                            resolve(data);
                                        });
                                        return;
                                    }
                                }
                                resolve();
                            } else
                                resolve();
                        }, function () {
                            resolve();
                        });
                    } else
                        resolve(data);
                });


            });
        },

        getSeriesInfo: function (seriesID) {
            var _this = this;
            return new Promise(function (resolve) {
                _this._loggedQuery(seriesBaseAddress + seriesID, {
                    seriesID: seriesID
                }).then(function (data) {
                    var infoData = data;
                    if (infoData) {
                        _this._loggedQuery(seriesBaseAddress + seriesID + seriesActors).then(function (data) {
                            infoData.actors = data;
                            if (infoData.data.imdbId) {
                                checkIMDb();
                                window.IMDb.getMovieInfo(infoData.data.imdbId).then(function (imdbInfo) {
                                    infoData.imdbdata = imdbInfo;
                                    resolve(infoData);
                                });
                            } else
                                resolve(infoData);
                        });
                    } else
                        resolve();
                });
            });
        },

        getSeriesEpisodes: function (seriesID) {
            var _this = this;
            return new Promise(function (resolve) {
                var data;

                var getPage = function (page) {
                    _this._loggedQuery(seriesBaseAddress + seriesID + seriesEpisodes + '?page=' + page, {
                        seriesID: seriesID
                    }).then(function (d) {
                        if (!d) {
                            resolve(data);
                        } else {
                            if (page === 1) {
                                data = d;
                            } else {
                                Array.prototype.push.apply(data.data, d.data);
                            }
                            getPage(++page);
                        }
                    });
                }
                getPage(1);
            });
        },

        getEpisodeInfo: function (episodeID) {
            return this._loggedQuery(episodeBaseAddress + episodeID);
        },

        getSeriesPoster: function (seriesID) {
            return this._loggedQuery(seriesBaseAddress + seriesID + seriesPoster);
        },

        getImage: function (imagePath) {
            return new Promise(function (resolve) {
                app.utils.prepareImage(seriesImageDL + imagePath, 1024, 1024, function (data) {
                    if (data) {
                        resolve(data);
                    } else
                        resolve();
                });
            }.bind(this));
        },
        
        getSeriesImage: function (seriesID) {
            return new Promise(function (resolve, reject) {
                TVDB.getSeriesPoster(seriesID).then(function (images) {
                    var url = '';
                    if (images) {
                        // get first front cover
                        for (var i = 0; i < images.data.length; i++) {
                            if (images.data[i].fileName) {
                                url = images.data[i].fileName;
                                break;
                            }
                        }
                    }
                    if (!url) {
                        resolve();
                        return;
                    }
                    window.TVDB.getImage(url).then(function (imagePath) {
                        resolve(imagePath);
                    }, function () {
                        if(reject)
                            reject();
                    });
                }, function () {
                    if(reject)
                        reject();
                })
            });
        },
        
        detectSeasonAndEpisode: function (path) {
            var ret = {
                season: 0,
                episode: 0
            };

            // season and episode are mostly in format SxxExx in file name

            //var data = sscanf('%sS%.2dE%.2d', path);


            return ret;
        },

        getSeriesLink: function (seriesID) {
            if (!seriesID || (seriesID === '0'))
                return 'https://www.thetvdb.com/?tab=addshow'
            else
                return 'https://www.thetvdb.com/?tab=series&id=' + seriesID;
        },

        getLanguages: function () {
            return new Promise(function (resolve) {
                if (allLanguages) {
                    resolve(allLanguages);
                    return;
                }
                this._loggedQuery(languagesURL, {
                    useLanguage: false
                }).then(function (data) {
                    if (data && data.data) {
                        allLanguages = data.data;
                        allLanguages.sort(function (i1, i2) {
                            return i1.abbreviation.localeCompare(i2.abbreviation);
                        });

                    }
                    resolve(allLanguages);
                });

            }.bind(this));
        },
    };

    Object.defineProperty(window.TVDB, 'language', {
        set: function (langAbbr) {
            sett.language = langAbbr;
            app.setValue('TVDB', sett);
        },
        get: function () {
            return sett.language;
        }
    });

})();
