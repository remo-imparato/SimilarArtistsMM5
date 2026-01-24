/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

/*
    Adds methods for accessing AcoustID service
*/

(function () {

    var serviceURL = 'http://api.acoustid.org/v2/';
    var apiKey = 'kWP9wFltL5';

    var requestURL = serviceURL + 'lookup?client=' + apiKey + '&meta=recordings+releasegroups+tracks';
    var trackRequestURL = serviceURL + 'lookup?client=' + apiKey + '&meta=recordings+recordingids+releases+releaseids+releasegroups+releasegroupids+tracks+compress+usermeta+sources&trackid=';

    var counter = 0;
    var lastCall = 0;
    var requestLimit = 1000; // in ms


    window.acoustID = {
        getTrackFingerPrint: function (track) {
            return new Promise(function (resolve, reject) {

                var call = function () {
                    if (counter === 0) {
                        counter++;
                        if (app && app.fileFormats) {
                            app.fileFormats.getAcoustIDFingerprintAsync(track.path).then(function (res) {
                                resolve(res);
                                counter--;
                            });
                        } else {
                            reject();
                            counter--;
                        }
                    } else
                        setTimeout(call, 10);
                };

                call();

            });
        },

        getTrackInfo: function (track) {
            return new Promise(function (resolve) {
                if (!track) {
                    resolve();
                    return;
                }

                this.getTrackFingerPrint(track).then(function (res) {
                    if (res) {
                        var data = JSON.parse(res);
                        if (window._cleanUpCalled) {
                            resolve();
                            return;
                        }

                        var requestAcoustIDServer = function () {
                            lastCall = performance.now();
                            app.utils.web.getURLContentAsync(requestURL + '&duration=' + parseInt(data.duration) + '&fingerprint=' + data.fingerprint).then(function (content) {
                                if (content === '')
                                    content = '{}';
                                try {
                                    var output = JSON.parse(content);

                                    if (output && (output.status === 'ok') && output.results && output.results.length) {
                                        // check results contain recordings
                                        var fillRecordings = function (idx) {
                                            if (output.results.length > idx) {
                                                if (!output.results[idx].recordings && output.results[idx].id) {
                                                    var adr = trackRequestURL + output.results[idx].id;
                                                    app.utils.web.getURLContentAsync(adr).then(function (content) {
                                                        if (content === '')
                                                            content = '{}';
                                                        try {
                                                            var data = JSON.parse(content);
                                                            if ((data.status === 'ok') && (data.results && data.results.length && data.results[0].recordings)) {
                                                                try {
                                                                    output.results[idx].recordings = data.results[0].recordings[0].releasegroups[0].releases[0].mediums[0].tracks;
                                                                    if (data.results[0].recordings[0].releasegroups[0].releases[0].mediums[0].tracks[0].artists) {
                                                                        var src = data.results[0].recordings[0].releasegroups[0].releases[0].mediums[0].tracks[0].artists;
                                                                        output.results[idx].recordings[0].artists = [];
                                                                        for (var i = 0; i < src.length; i++) {
                                                                            output.results[idx].recordings[0].artists.push({
                                                                                name: src[i]
                                                                            });
                                                                        }
                                                                        if (!data.results[0].recordings[0].releasegroups[0].artists)
                                                                            data.results[0].recordings[0].releasegroups[0].artists = output.results[idx].recordings[0].artists;
                                                                    }
                                                                } catch (err) {
                                                                    output.results[idx].recordings = data.results[0].recordings;
                                                                }
                                                            }

                                                        } catch (err) {}
                                                        fillRecordings(++idx);
                                                    }, function () {});

                                                } else
                                                    fillRecordings(++idx);
                                            } else
                                                resolve(output);
                                        }
                                        fillRecordings(0);

                                    } else
                                        resolve(output);
                                } catch (err) {
                                    resolve();
                                }
                            }, function () {
                                resolve();
                            });
                        };

                        if (requestLimit && app.utils.isRegistered())
                            requestLimit = 0;

                        if (requestLimit) {
                            if (lastCall + requestLimit > performance.now()) {
                                setTimeout(requestAcoustIDServer, requestLimit);
                                return;
                            }
                        }
                        requestAcoustIDServer();

                        return;
                    }
                    resolve();
                });
            }.bind(this));
        }
    };

})();
