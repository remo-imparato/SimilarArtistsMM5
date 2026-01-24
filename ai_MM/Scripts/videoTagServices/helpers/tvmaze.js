/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

/*
    Adds methods for accessing TVDB service
*/

(function () {

    var serviceURL = 'http://api.tvmaze.com/';

    var requestLimit = 1000; // minimal requests interval (in ms)
    var lastRequest = 0;


    var searchURL = serviceURL + 'search/shows?q=';

    var downloadPromise = null;

    window.TVMaze = {

        _query: function (query) {
            return new Promise(function (resolve, reject) {
                var call = function () {
                    if (lastRequest + requestLimit < performance.now()) {
                        lastRequest = performance.now();
                        app.utils.web.getURLContentAsync(query).then(function (data) {
                            resolve(JSON.parse(data));
                        }.bind(this), function () {
                            reject();
                        });
                    } else
                        setTimeout(call, 10);
                };

                call();

            }.bind(this));
        },

        getSeriesInfo: function (serie) {
            return this._query(searchURL + serie);
        },
    };

})();
