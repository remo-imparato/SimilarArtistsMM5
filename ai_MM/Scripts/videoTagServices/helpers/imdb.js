/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

/*
    Adds methods for accessing IMDb service
*/

(function () {

    var apiKey = 'c226451d';//'6014631b';
    var searchURL = 'http://www.omdbapi.com/?apikey=' + apiKey + '&s=';
    var serviceURL = 'http://www.omdbapi.com/?apikey=' + apiKey + '&plot=full&i=';
    var requestParams = {
        cacheTimeout: 14 * 86400
    };

        var fixRating = function (str) {
            return parseFloat(str) * 10;
        }

        var fixStr = function (str) {
            if (str)
                return str.replace(new RegExp(', ', 'g'), ';');
            return '';
        }
        
    function parseIMDbResponse(data) {
        if (data === '')
            data = '{}';

        var obj = JSON.parse(data);


        var ret = {
            actors: fixStr(obj.Actors),
            director: fixStr(obj.Director),
            rating: fixRating(obj.imdbRating),
            genres: fixStr(obj.Genre),
            title: obj.Title,
            cover: obj.Poster,
            year: obj.Year,
            releaseDate: obj.Released,
            producer: obj.Production,
            lyricist: fixStr(obj.Writer),
            description: obj.Plot,
            parentalRating: obj.Rated,
            seasons: obj.totalSeasons,
        };

        return ret;
    }

    function parseIMDbEpisodeResponse(data) {
        if (data === '')
            data = '{}';

        var obj = JSON.parse(data);

        var ret = {   
            title: obj.Title,
            year: parseInt(obj.Year),
            date: obj.Released,
            season: parseInt(obj.Season),
            episode: parseInt(obj.Episode),
            genre: fixStr(obj.Genre),
            director: fixStr(obj.Director),
            writer: fixStr(obj.Writer),
            actors: fixStr(obj.Actors),
            description: obj.Plot,
            cover: obj.Poster,
            rating: fixRating(obj.imdbRating),
        };
        return ret;
    }
    
    function createQuery(phrase, isSeries) {
        
        var ret = searchURL + encodeURIComponent(phrase) + '&type=';
        if (isSeries) {
            ret += 'series';
        } else
            ret += 'movie';
        
        
        return ret;
    }
    
    window.IMDb = {

        _doSearch: function (phrase, isSeries) {
            return new Promise(function (resolve) {
                app.utils.web.getURLContentAsync(createQuery(phrase, isSeries), requestParams).then(function (res) {
                    if (res)
                        res = res.slice(1);
                    if (res === '')
                        res = '{}';
                    try {
                        var obj = JSON.parse(res);
                        if (obj.totalResults)
                            resolve(obj.Search);
                        else
                            resolve([]);
                    } catch (err) {
                        resolve([]);
                    }
                }, function () {
                    resolve([]);
                });
            });
        },

        findMovieAsync: function (title) {
            return this._doSearch(title);
        },

        findSeriesAsync: function (serie) {
            return this._doSearch(serie, true);
        },
        
        getMovieInfo: function (movieID) {
            return new Promise(function (resolve) {
                app.utils.web.getURLContentAsync(serviceURL + movieID, requestParams).then(function (res) {
                    if (res)
                        res = res.slice(1);
                    resolve(parseIMDbResponse(res));
                }, function () {
                    resolve(parseIMDbResponse(''));
                });
            });
        },
        
        getSeriesEpisodes: function (seriesID, seasons) { 
            return new Promise(function (resolve) {
                var tracks = [];
                
                var loadSeason = function(idx) {
                    if (idx <= seasons) { 
                        app.utils.web.getURLContentAsync(serviceURL + seriesID + '&type=series&Season='+idx, requestParams).then(function (res) {
                            if (res) {
                                res = res.slice(1);
                                var obj = JSON.parse(res);
                            
                                tracks.push({
                                    season: idx,
                                    tracks: obj.Episodes
                                });
                            }
                            loadSeason(++idx);
                        }, function () {
                            loadSeason(++idx);
                        });
                    } else {
                        resolve(tracks);
                    }
                }
                loadSeason(1);
            });
        },
        
        getEpisodeInfo: function (episodeID) {
            return new Promise(function (resolve) {
                app.utils.web.getURLContentAsync(serviceURL + episodeID + '&type=episode', requestParams).then(function (res) {
                    if (res)
                        res = res.slice(1);
                    resolve(parseIMDbEpisodeResponse(res));
                }, function () {
                    resolve(parseIMDbEpisodeResponse(''));
                });
            });
        },

    };

})();
