/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

/*
    Adds methods for accessing Discogs service
*/

(function () {
    let discogsURL = 'api.discogs.com';
    let ConsumerKey = app.utils.web.getAPIKey('DiscogsConsumerKey');
    let ConsumerSecret = app.utils.web.getAPIKey('DiscogsConsumerSecret');
    let downloadPromises = [];
    let downloadQueue = [];

    let headers = newStringList();
    headers.add('User-Agent: MediaMonkey/' + app.utils.getApplicationVersion(4) + ' ( https://www.mediamonkey.com )');
    headers.add('Accept: application/vnd.discogs.v2.html+json');
    let lastRequestTime = 0;
    let minTimeout = 500; // so 120 per minute, should be enough, server throttle is 240 per IP
    let cacheTimeout = 14 * 86400; // 14 days
    let fastSD = undefined;
    let authQ = '&key=' + ConsumerKey + '&secret=' + ConsumerSecret;

    let getDataInternal = function (uid, query, resolve, reject, params) {
        if (query.substr(0, 4) !== 'http') {
            query = 'https://' + discogsURL + '/' + query + authQ;
        };

        let timeout;
        if (params && (params.cacheTimeout !== undefined)) {
            timeout = params.cacheTimeout;
        } else
            timeout = cacheTimeout;
//        ODS('--- DC fetching ' + query);
        downloadPromises[uid] = app.utils.web.getURLContentAsync(query, {
            cacheTimeout: timeout,
            headers: headers
        });
        downloadPromises[uid].then(function (content) {
            downloadPromises[uid] = undefined;
            if (content) {
                if (content[0] !== '1') // not read from cache
                    lastRequestTime = Date.now();
                resolve(content.slice(1));
            } else {
                ODS('Nothing downloaded from Discogs site');
                resolve();
            }
        }, function () {
            downloadPromises[uid] = undefined;
            resolve();
        });
    };

    let processImageSearch = function (req) {
        return new Promise(async function (resolve, reject) {
            let diff = Date.now() - lastRequestTime;
            let resolveFunc = function (res) {
                req.resolve(res);
                resolve();
            };
            // reject not used, so not needed
            if (diff < minTimeout) {
                setTimeout(function () {
                    getDataInternal(req.uid, req.query, resolveFunc, req.reject, req.params);
                }, diff);
            } else {
                getDataInternal(req.uid, req.query, resolveFunc, req.reject, req.params);
            };
        });
    };

    let getData = function (uid, query, params) {
        return new Promise(async function (resolve, reject) {
            let req = {
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
                while (downloadQueue && (downloadQueue.length > 0) && !window._cleanUpCalled) {
                    let nextReq = downloadQueue.shift();
                    await processImageSearch(nextReq);
                }
            }
        });
    };

    let prepareSearchTerm = function (term) {
        // escape special characters of Lucene Search Syntax
        // https://lucene.apache.org/core/4_3_0/queryparser/org/apache/lucene/queryparser/classic/package-summary.html#Escaping_Special_Characters
        if (term) {
            let retval = term.replace(/([\+|\-|&|\||\!|\(|\)|\{|\}|\[|\]|\^|"|\~|\*|\?|\:|\\|\/])/g, '\\\$1');
            retval = retval.replace(/ /g, '+');
            return retval;
        } else
            return '';
    };

    let doSearch = function (uid, searchTerm, searchType, perPage, pageNum, isRetry) {
        return new Promise(function (resolve, reject) {
            let limit = '';
            let page = '';
            if (perPage) {
                limit = '&per_page=' + perPage;
            }
            if (pageNum) {
                page = '&page=' + pageNum;
            }
            let params = undefined;
            if (isRetry) {
                params = {
                    cacheTimeout: 1, // have to be >0, the response will be saved then
                    highPriority: true
                };
            };
            getData(uid, 'database/search?q=' + encodeURIComponent(searchTerm) + '&type=' + searchType + limit + page, params).then(function (content) {
                let resObj = tryEval(content);
                if (resObj !== undefined) {
                    if (isObjectLiteral(resObj)) {
                        resolve(resObj);
                    } else {
                        resolve();
                    }
                } else {
                    // getting value failed
                    if (isRetry)
                        resolve();
                    else {
                        // retry without using request cache
                        doSearch(uid, searchTerm, searchType, perPage, pageNum, true).then(function (res) {
                            resolve(res);
                        });
                    };
                };
            });
        });
    };
    
    let doSimpleGet = function (uid, cmd, id, isRetry) {
        return new Promise(function (resolve, reject) {
            let params = undefined;
            if (isRetry) {
                params = {
                    cacheTimeout: 1, // have to be >0, the response will be saved then
                    highPriority: true
                };
            };
            getData(uid, cmd + '/' + id + '?', params).then(function (content) {
                let resObj = tryEval(content);
                if (resObj !== undefined) {
                    if (isObjectLiteral(resObj)) {
                        resolve(resObj);
                    } else {
                        resolve();
                    }
                } else {
                    // getting value failed
                    if (isRetry)
                        resolve();
                    else {
                        // retry without using request cache
                        doSimpleGet(uid, cmd, id, true).then(function (res) {
                            resolve(res);
                        });
                    };
                };
            });
        });
    };

    let getImgSize = function (imgUri) {
        let path = imgUri;
        //"cover_image": "https://img.discogs.com/K_zxss1SHgben5JOSc7_f2ukkeY=/600x262/smart/filters:strip_icc():format(jpeg):mode_rgb():quality(90)/discogs-images/A-832962-1519811800-7082.jpeg.jpg",
        let matches = imgUri.match(/.*[api\-]?i[mg]?\.discogs\.com.*\/(\d+)x(\d+)\/[smart|filters].*\/discogs\-images\/(.*)\.jpe?g$/i);
        if (matches && (matches.length > 3)) {
            return {
                width: matches[1],
                height: matches[2]
            };
        } else {
            //"cover_image":"https://i.discogs.com/kjZKp0xikoArqperehOlZAtGkF09RlJTWzL_Kf093hU/rs:fit/g:sm/q:90/h:387/w:600/czM6Ly9kaXNjb2dz/LWRhdGFiYXNlLWlt/YWdlcy9BLTY5ODY2/LTE2ODcwNjM4Mjct/NjE2OC5qcGVn.jpeg"
            matches = imgUri.match(/.*i[mg]?\.discogs\.com.*\/h:(\d+)\/w:(\d+)\/.*\/(.*)\.jpe?g$/i);
            if (matches && (matches.length > 3)) {
                return {
                    width: matches[2],
                    height: matches[1]
                };
            } else {
                return {
                    width: '',
                    height: ''
                };
            }
        }
    };

    function extractDiscogsNumber(id, url) {
        // https://www.discogs.com/master/NNNN-xxxx
        let regex = new RegExp('^https:\\/\\/www\\.discogs\\.com\\/' + id + '\\/(\\d+)(?:-.+)?$');
        let match = url.match(regex);
        return match ? match[1] : null;
    };

    function fetchImageInfo(uid, idname, apiidname, url) {
        return new Promise(function (resolve, reject) {
            let id = extractDiscogsNumber(idname, url);
            if (!id) {
                reject();
                return;
            }
            doSimpleGet(uid, apiidname, id).then(function(res) {
                if(res.images && res.images.length) {
                    let img = res.images[0];
                    resolve({
                        thumblink: img.uri150,
                        imglink: img.resource_url,
                        source: 'Discogs',
                        width: img.width,
                        height: img.height,
                        thumbwidth: 150,
                        thumbheight: 150,
                        sourcelink: url
                    });
                } else {
                    if(reject)
                        reject();
                }
            });
        });
    };

    window.discogs = {
        findArtistImage: function (uid, artistName) {
            // return object with artworkLink and thumbLink or udnefined
            return new Promise(function (resolve, reject) {
                let term = prepareSearchTerm(artistName);
                doSearch(uid, term, 'artist', 1).then(function (searchRes) {
                    if (searchRes && searchRes.results) {
                        let i = 0;
                        while (i < searchRes.results.length) {
                            let res = searchRes.results[i];
                            // Discogs returns warning image in case of some redirect page, do not use such result, #15419 2)
                            if (res.thumb && !res.thumb.endsWith('warning.png') && !res.thumb.endsWith('spacer.gif') && (res.cover_image && !res.cover_image.endsWith('spacer.gif'))) {
                                let origSz = getImgSize(res.cover_image);
                                let thSz = getImgSize(res.thumb);
                                resolve({
                                    thumblink: res.thumb,
                                    imglink: res.cover_image,
                                    source: 'Discogs',
                                    width: origSz.width,
                                    height: origSz.height,
                                    thumbwidth: thSz.width,
                                    thumbheight: thSz.height,
                                    sourcelink: 'https://www.discogs.com' + ((res.uri[0]!=='/')?'/':'') +res.uri
                                });
                                return;
                            }
                            i++;
                        }
                    }
                    resolve();
                });
            });
        },
        fetchMasterImageFromURL: function (uid, url) {
            return fetchImageInfo(uid, 'master', 'masters', url);
        },
        fetchArtistImageFromURL: function (uid, url) {
            return fetchImageInfo(uid, 'artist', 'artists', url);
        },        
        cancelDownloads: function (uid) {
            downloadQueue = downloadQueue.filter(function (req) {
                return (req.uid !== uid);
            });
            if (downloadPromises[uid]) {
                downloadPromises[uid].cancel();
            }
        },
    };
})();

