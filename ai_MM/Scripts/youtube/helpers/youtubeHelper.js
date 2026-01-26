/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";
requirejs('controls/toastMessage');
requirejs('utils');

/*
    Adds methods for accessing Youtube data service
*/

(function () {
    var apiKey = app.utils.web.getAPIKey('YoutubeApiKey');
    var cacheTimeout = 86400 /* 24h */ ;

    // videoEmbeddable probably still not working, issue: https://code.google.com/p/gdata-issues/issues/detail?id=6346    
    var apiBase = 'https://www.googleapis.com/youtube/v3/';

    var searchQueryBase = 'search?part=id%2Csnippet&type=video&videoEmbeddable=true&q=';
    var videoQueryBase = 'videos?part=id%2Csnippet%2CcontentDetails&id=';
    var downloadPromises = [];

    var buildQuery = function (qbase, q) {
        return apiBase + qbase + encodeURIComponent(q) + '&key=' + apiKey;
    };

    var removeFromPromises = function (prom) {
        var idx = downloadPromises.indexOf(prom);
        if (idx >= 0)
            downloadPromises.splice(idx, 1);
    };

    var downloadResponseObject = function (query) {
        return new Promise(function (resolve, reject) {
            var downloadPromise = app.utils.web.getURLContentAsync(query, {
                cacheTimeout: cacheTimeout,
                useReferrer: true
            });
            downloadPromises.push(downloadPromise);
            downloadPromise.then(function (resultsJSON) {
                removeFromPromises(downloadPromise);
                downloadPromise = undefined;
                resultsJSON = resultsJSON.slice(1);
                try {
                    var results = JSON.parse(resultsJSON);
                    if(typeof results === 'object') {
                        resolve(results);
                    }
                    else {
                        ODS('Parsing YT result failed - not JSON object');
                        resolve();
                    }
                }
                catch (error){
                    ODS('Parsing YT result failed, ' + error);
                    resolve();
                }
            }, function (errJSON) {
                // url request failed, check for quota exceeded
                if (errJSON.responseCode) {
                    var res = (new Function('return ' + errJSON.response + ';'))();
                    ODS('YT query error: ' + JSON.stringify(res.error));
                    if ((errJSON.responseCode >= 400) && (errJSON.responseCode <= 404) && res.error && res.error.errors) {
                        uitools.toastMessage.show(_('YouTube query failed: ') + res.error.errors[0].message, {
                            delay: 8000
                        });
                    }
                } else {
                    ODS('YT query error: ' + errJSON.response);
                }
                resolve();
            });
        });
    }

    var getVideoInfoFromItem = function (item) {
        var thumb;
        var thumbObj = item.snippet.thumbnails;
        if (thumbObj) {
            if (thumbObj.standard)
                thumb = thumbObj.standard.url;
            else if (thumbObj.high)
                thumb = thumbObj.high.url;
            else if (thumbObj.medium)
                thumb = thumbObj.medium.url;
            else if (thumbObj.default)
                thumb = thumbObj.default.url;
        }
        return {
            id: item.id.videoId,
            title: decodeHTML(item.snippet.title),
            comment: decodeHTML(item.snippet.description),
            path: 'https://www.youtube.com/watch?v=' + item.id.videoId,
            thumbnail: thumb,
            songLength: item.duration
        };
    };

    var isoDurationToMS = function (val) {
        var regex = /P((([0-9]*\.?[0-9]*)Y)?(([0-9]*\.?[0-9]*)M)?(([0-9]*\.?[0-9]*)W)?(([0-9]*\.?[0-9]*)D)?)?(T(([0-9]*\.?[0-9]*)H)?(([0-9]*\.?[0-9]*)M)?(([0-9]*\.?[0-9]*)S)?)?/;
        var matches = val.match(regex);
        var years = parseFloat(matches[3]) || 0;
        var months = parseFloat(matches[5]) || 0;
        var weeks = parseFloat(matches[7]) || 0;
        var days = parseFloat(matches[9]) || 0;
        var hours = parseFloat(matches[12]) || 0;
        var minutes = parseFloat(matches[14]) || 0;
        var seconds = parseFloat(matches[16]) || 0;

        return 1000 * (60 * (60 * (24 * (365.25 * years + 30.6 * months + 7 * weeks + days) + hours) + minutes) + seconds);
    };

    window.ytHelper = {
        searchVideosForTrack: function (track, params) {
            return new Promise(function (resolve, reject) {
                var query = buildQuery(searchQueryBase, track.title + ' ' + track.artist);
                params = params || {};
                if (params.maxResults)
                    query += '&maxResults=' + params.maxResults;

                downloadResponseObject(query).then(function (results) {
                    var res = [];
                    if (results && (results.kind === 'youtube#searchListResponse')) {
                        forEach(results.items, function (item) {
                            res.push(getVideoInfoFromItem(item));
                        });
                    }
                    resolve(res);
                });
            });
        },
        searchVideos: function (searchTerm, params) {
            return new Promise(function (resolve, reject) {
                var query = buildQuery(searchQueryBase, searchTerm);
                params = params || {};
                if (params.maxResults)
                    query += '&maxResults=' + params.maxResults;
                if (params.pageToken)
                    query += '&pageToken=' + params.pageToken;
                downloadResponseObject(query).then(function (results) {
                    if (results && (results.kind === 'youtube#searchListResponse')) {

                        // find details for all videos, so we can set and display durations, which are not included in the search result
                        var ids = '';
                        forEach(results.items, function (item) {
                            if (ids !== '')
                                ids += ',';
                            ids += item.id.videoId;
                        });

                        var vquery = buildQuery(videoQueryBase, ids);
                        downloadResponseObject(vquery).then(function (vresults) {
                            if (vresults && (vresults.kind === 'youtube#videoListResponse') && vresults.items && (vresults.items.length > 0)) {
                                var asocAr = {};
                                forEach(vresults.items, function (vitem) {
                                    asocAr[vitem.id] = vitem;
                                });
                                forEach(results.items, function (item) {
                                    var it = asocAr[item.id.videoId];
                                    if (it && it.contentDetails) {
                                        item.duration = isoDurationToMS(it.contentDetails.duration); // in ISO 8601 string, like PT4M23S, convert to seconds
                                    }
                                });
                            }
                            var tracksds = app.utils.createTracklist(false); // not loaded flag

                            // prepare input array for fillFromArray procedure
                            var arr = results.items.map(it => getVideoInfoFromItem(it));
                            tracksds.fillOnlineFromArray(arr, {
                                dontCheckDB: true,
                                checkDuplicates: !!params.checkDuplicates,
                                existingTracklist: params.existingTracklist
                            });
                            tracksds.whenLoaded().then1(function (e) {
                                if (!isAbortError(e)) {
                                    resolve({
                                        tracklist: tracksds,
                                        nextPageToken: results.nextPageToken
                                    });
                                } else {
                                    resolve();
                                }
                            })
                        });
                    }
                });
            });
        },
        getVideoDetails: function (id) {
            var query = buildQuery(videoQueryBase, id);
            return new Promise(function (resolve, reject) {
                downloadResponseObject(query).then(function (results) {
                    if (results && (results.kind === 'youtube#videoListResponse') && results.items && (results.items.length > 0)) {
                        var item = results.items[0];
                        resolve(getVideoInfoFromItem(item));
                    } else
                        resolve();
                });
            });
        },
        // cancels all ongoing and queued downloads from Rhapsody server
        cancelDownloads: function () {
            forEach(downloadPromises, function (prom) {
                prom.cancel();
                prom = null;
            });
            downloadPromises = [];
        }
    };
})();
