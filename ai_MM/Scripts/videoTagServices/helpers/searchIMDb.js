/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

requirejs('helpers/searchCommon');
requirejs('helpers/imdb');
requirejs('consts');


webTaggers.omdb = inheritTagger('OMDb', 'Common', {
    groupingSupport: function () {
        return true;
    },

    lookupSource: LINK_IMDB,
    allowedTypes: 'video,tv',

    decodeYear: function (year) {
        // check year-year
        var pos = Math.max(year.indexOf('-'), year.indexOf('–'));
        if (pos > 0) {
            year = year.substr(0, pos);
        }
        return year;
    },
    
    albumSearchStep: function (searchManager, album, albumArtist, lst) {
        var _this = this;
        return new Promise(function (resolve) {
            var isMovie = false;
            lst.locked(() => {
                var track = lst.getValue(0);
                isMovie = (track.trackTypeStr !== 'TV');
            });

            if (isMovie) {
                var ar = [];
                var fieldsToUpdate = searchManager.getFieldsToUpdate(false);

                var processTrack = function (track) {
                    ar.push(_this.searchTrack(searchManager, track).then((res) => {
                        if (res) {
                            _this.applyToTrack(searchManager, fieldsToUpdate, {
                                track: track,
                                locatedTrack: res
                            });
                            resolve(true);
                        } else
                            resolve(false);
                    }));
                };

                lst.locked(() => {
                    for (var i = 0; i < lst.count; i++) {
                        processTrack(lst.getValue(i));
                    }
                });

                whenAll(ar).then(() => {
                    resolve(true);
                });

            } else {
                window.IMDb.findSeriesAsync(app.utils.normalizeAlbumName(album)).then(function (data) {
                    if (data && data.length) {
                        _this.searchByAlbum(searchManager, lst, data).then(function (res) {
                            if (res) {
                                _this.applyToTracks(searchManager, res, lst).then(function (res) {
                                    resolve(true);
                                });
                            } else
                                resolve(false);
                        });
                    } else
                        resolve(false);
                });
            }

        }.bind(this));
    },

    checkExistingLinks: function (searchManager, list) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            resolve(false);
        });
    },

    searchTrack: function (searchManager, track) {
        var _this = this;
        return new Promise(function (resolve, reject) {

            var processResult = function (title, res) {

                var maxSim = 0;
                var maxSimIdx = -1;

                for (var i = 0; i < res.length; i++) {
                    var sim = app.utils.stringSimilarity(title, res[i].Title, false);
                    if (sim > maxSim) {
                        maxSimIdx = i;
                        maxSim = sim;
                    }
                }

                if ((maxSim >= 0.8) && (maxSimIdx >= 0)) {
                    window.IMDb.getMovieInfo(res[maxSimIdx].imdbID).then(function (movieInfo) {
                        searchManager.addTrackLookup(track.path, movieInfo, LINK_IMDB);
                        resolve(movieInfo);
                    });
                } else
                    resolve(false);
            };


            if (track.trackTypeStr === 'TV') {

                var series = _this._removeBrackets(track.album);
                window.IMDb.findSeriesAsync(series).then(function (res) {
                    if (res) {
                        processResult(series, res);
                    } else
                        resolve(false);
                });

            } else {

                var title = _this._removeBrackets(track.title);
                window.IMDb.findMovieAsync(title).then(function (res) {
                    if (res) {
                        processResult(title, res);
                    } else
                        resolve(false);
                });
            }
        });
    },

    searchByAlbum: function (searchManager, list, data) {
        var _this = this;
        return new Promise(function (resolve, reject) {

            var tracks = list || searchManager.getTracks();
            var tracksCount = tracks.count;
            var founds = [];
            var album = '';

            if (data && data.length) {

                var addTrack = function (track, data, lookup) {
                    var path = track.path;
                    if (!founds.some(function (item) {
                            return item.id === path;
                        })) {
                        founds.push({
                            id: path,
                            track: track,
                            locatedTrack: data
                        });
                    }
                    searchManager.addTrackLookup(track.path, data, LINK_TVDB);
                    if (lookup) {
                        for (var key in data)
                            lookup[key] = data[key];
                    }
                };

                tracks.locked(function () {
                    album = tracks.getValue(0).album;
                });

                var processSeries = function (id, seriesName, track, lookup) {
                    return new Promise(function (resolve) {
                        window.IMDb.getMovieInfo(id).then(function (info) {
                            //app.filesystem.saveTextToFileAsync('data.json', JSON.stringify(info));
                            var actors = '';
                            var actorsDesc = '';
                            if (info && info.actors && info.actors.data && info.actors.data.length) {
                                for (var i = 0; i < info.actors.data.length; i++) {
                                    if (actors)
                                        actors += ';';
                                    if (actorsDesc)
                                        actorsDesc += '\n';
                                    if (info.actors.data[i].name) {
                                        actors += info.actors.data[i].name;
                                        actorsDesc += info.actors.data[i].role + ': ' + info.actors.data[i].name;
                                    }
                                }
                            }
                            if (actorsDesc)
                                actorsDesc = '\n' + actorsDesc;

                            window.IMDb.getSeriesEpisodes(id, info.seasons).then(function (d) {
                                var episodesData = d;
                                if (!episodesData || !episodesData.length) {
                                    resolve(false);
                                    return;
                                }
                                var ar = [];

                                var lookForEpisodeInfo = function (track, episodeID) {
                                    return new Promise(function (resolve) {
                                        window.IMDb.getEpisodeInfo(episodeID).then(function (d) {
                                            addTrack(track, {
                                                recording: id,
                                                album: seriesName,
                                                description: d.description,
                                                seasonNumber: d.season,
                                                episodeNumber: d.episode,
                                                title: d.title,
                                                actors: d.actors,
                                                year: d.year,
                                                date: d.date,
                                                genre: d.genre,
                                                director: d.director,
                                                writer: d.writer,
                                                cover: d.cover,
                                                rating: d.rating,
                                            }, lookup);
                                            resolve();
                                        });
                                    });
                                };

                                var processTrack = function (track) {
                                    var seasonNumber = track.seasonNumber;
                                    var episodeNumber = track.episodeNumber;
                                    if (!seasonNumber)
                                        seasonNumber = 1;
                                    var title = track.title;

                                    if (!seasonNumber || !episodeNumber) {
                                        return;
                                    }

                                    // get episode info (like air date, title etc.)
                                    var episodeID = 0;
                                    seasonNumber = parseInt(seasonNumber);
                                    episodeNumber = parseInt(episodeNumber);
                                    var year = firstAiredDate;
                                    if (seasonNumber && episodeNumber) {
                                        for (var e = 0; e < episodesData.length; e++) {
                                            if (parseInt(episodesData[e].season) == seasonNumber) {
                                                var imdbTracks = episodesData[e].tracks;
                                                for (var i = 0; i < imdbTracks.length; i++) {
                                                    if (parseInt(imdbTracks[i].Episode) == episodeNumber) {

                                                        ar.push(lookForEpisodeInfo(track, imdbTracks[i].imdbID));

                                                        break;
                                                    }
                                                }
                                            }
                                        }
                                    }

                                };

                                if (track) {
                                    processTrack(track);
                                } else {
                                    tracks.locked(function () {
                                        for (i = 0; i < tracks.count; i++) {
                                            var track = tracks.getValue(i);
                                            processTrack(track);
                                        }
                                    });
                                }

                                whenAll(ar).then(function () {
                                    resolve(founds);
                                });
                            });
                        });
                    });
                }

                // try to search correct album
                var getBestSeriesIndex = function () {
                    var resultIdx = 0;
                    if (!tracksCount) return resultIdx;

                    var bestMatch = 0;

                    // we try to get best recording based on original metadata
                    tracks.locked(function () {
                        for (var i = 0; i < data.length; i++) {
                            var seriesInfo = data[i];
                            var serie = seriesInfo.Title;
                            var serieMatch = app.utils.stringSimilarity(album, serie, false);
                            if (serieMatch > bestMatch) {
                                bestMatch = serieMatch;
                                resultIdx = i;

                                /*for (var t = 0; t < tracks.count; t++) {
                                    addTrack(tracks.getValue(t), {
                                        recording: seriesInfo.imdbID,
                                        album: serie,
                                        description: '',
                                        date: app.utils.myDecodeDate(seriesInfo.Year),
                                        getDetailAsync: function (track) {
                                            var _this = this;
                                            return new Promise(function (resolve) {
                                                processSeries(_this.recording, _this.album, track, _this).then(function (founds) {
                                                    resolve(founds);
                                                });
                                            });
                                        },
                                    });
                                }*/
                            }
                        }
                    });

                    return resultIdx;
                };

                var idx = getBestSeriesIndex();

                var foundAlbum = data[idx];
                var seriesName = foundAlbum.Title || album;
                var overview = '';

                var firstAiredDate = app.utils.myDecodeDate(_this.decodeYear(foundAlbum.Year));

                if (seriesName) {
                    data.__usedRelease = {
                        id: foundAlbum.imdbID,
                        title: seriesName
                    };
                    processSeries(foundAlbum.imdbID, seriesName).then(function (founds) {
                        resolve(founds);
                    });
                    return;
                }
            }
            resolve(false);
        });
    },

    getArtwork: function (searchManager, founds, list) {
        var _this = this;
        return new Promise(function (resolve, reject) {

            var tracks = list || searchManager.getTracks();

            if (_this.checkArtworkLoad(searchManager, founds, tracks, null)) {
                if (founds.length && founds[0].locatedTrack.cover) {
                    _this.useArtwork(searchManager, '', tracks, founds[0].locatedTrack.cover, false);
                }
            }

            resolve();
        });
    },

});
