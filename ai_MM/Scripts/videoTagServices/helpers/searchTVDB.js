/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

requirejs('helpers/searchCommon');
requirejs('helpers/tvdb');
requirejs('consts');

webTaggers.tvdb = inheritTagger('TVDB', 'Common', {

    albumSearchStep: function (searchManager, album, albumArtist, lst) {
        var _this = this;
        return new Promise(function (resolve) {
            window.TVDB.findSeriesInfo(app.utils.normalizeAlbumName(album), lst).then(function (data) {
                if (data && data.data.length) {
                    _this.searchByAlbum(searchManager, lst, data).then(function (res) {
                        if (res) {
                            _this.applyToTracks(searchManager, res, lst).then(function (res) {
                                resolve(true);
                            });
                        }
                    });
                } else
                    resolve(false);
            });

        }.bind(this));
    },

    lookupSource: LINK_TVDB,
    allowedTypes: 'tv',

    checkExistingLinks: function (searchManager, list) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            resolve(false);
        });
    },

    searchByAlbum: function (searchManager, list, data) {
        var _thisPlugin = this;
        return new Promise(function (resolve, reject) {

            var tracks = list || searchManager.getTracks();
            var tracksCount = tracks.count;
            var founds = [];
            var album = '';

            if (data && data.data.length) {

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
                        window.TVDB.getSeriesInfo(id).then(function (info) {
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

                            window.TVDB.getSeriesEpisodes(id).then(function (d) {
                                var episodesData = d;
                                if (!episodesData) {
                                    resolve(false);
                                    return;
                                }
                                var ar = [];

                                var lookForEpisodeInfo = function (track, episodeID, seasonNumber, episodeNumber) {
                                    return new Promise(function (resolve) {
                                        window.TVDB.getEpisodeInfo(episodeID).then(function (d) {
                                            addTrack(track, {
                                                recording: id,
                                                album: seriesName,
                                                description: d.data.overview + actorsDesc,
                                                seasonNumber: seasonNumber,
                                                episodeNumber: episodeNumber,
                                                title: d.data.episodeName,
                                                actors: actors,
                                            }, lookup);
                                            resolve();
                                        });
                                    });
                                };

                                var processTrack = function (track) {
                                    var seasonNumber = track.seasonNumber;
                                    var episodeNumber = track.episodeNumber;
                                    var title = track.title;

                                    if (!seasonNumber || !episodeNumber) {
                                        var details = window.TVDB.detectSeasonAndEpisode(track.path);
                                        if (details.season) {
                                            seasonNumber = details.season;
                                        }
                                        if (details.episode) {
                                            episodeNumber = details.episode;
                                        }
                                    }

                                    // get episode info (like air date, title etc.)
                                    var episodeID = 0;
                                    seasonNumber = parseInt(seasonNumber);
                                    episodeNumber = parseInt(episodeNumber);
                                    var year = firstAiredDate;
                                    if (seasonNumber && episodeNumber) {
                                        for (var e = 0; e < episodesData.data.length; e++) {
                                            if ((parseInt(episodesData.data[e].airedSeason) == seasonNumber) &&
                                                (parseInt(episodesData.data[e].airedEpisodeNumber) == episodeNumber)) {

                                                if (episodesData.data[e].episodeName) {
                                                    title = episodesData.data[e].episodeName;
                                                } else {
                                                    episodeID = episodesData.data[e].id;
                                                }
                                                year = app.utils.myDecodeDate(episodesData.data[e]['firstAired']);
                                                break;
                                            }
                                        }
                                    }

                                    if (episodeID) {
                                        ar.push(lookForEpisodeInfo(tracks.getValue(i), episodeID, seasonNumber, episodeNumber));
                                    } else {
                                        addTrack(track, {
                                            recording: id,
                                            album: seriesName,
                                            description: overview + actorsDesc,
                                            seasonNumber: seasonNumber,
                                            episodeNumber: episodeNumber,
                                            title: title,
                                            date: year,
                                            actors: actors,
                                        }, lookup);
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
                        for (var i = 0; i < data.data.length; i++) {
                            var seriesInfo = data.data[i];
                            var serie = seriesInfo.seriesName;
                            var serieMatch = app.utils.stringSimilarity(album, serie, false);
                            if (serieMatch > bestMatch) {
                                bestMatch = serieMatch;
                                resultIdx = i;

                                for (var t = 0; t < tracks.count; t++) {
                                    addTrack(tracks.getValue(t), {
                                        recording: seriesInfo.id,
                                        album: serie,
                                        description: seriesInfo.overview,
                                        date: app.utils.myDecodeDate(seriesInfo.firstAired),
                                        getDetailAsync: function (track) {
                                            var _this = this;
                                            return new Promise(function (resolve) {
                                                processSeries(_this.recording, _this.album, track, _this).then(function (founds) {
                                                    resolve(founds);
                                                });
                                            });
                                        },
                                    });
                                }
                            }
                        }
                    });

                    return resultIdx;
                };

                var idx = getBestSeriesIndex();

                var foundAlbum = data.data[idx];
                var seriesName = foundAlbum.seriesName || album;
                var overview = foundAlbum.overview;

                var firstAiredDate = app.utils.myDecodeDate(foundAlbum['firstAired']);

                if (seriesName) {
                    data.__usedRelease = {
                        id: foundAlbum.id,
                        title: seriesName
                    };
                    processSeries(foundAlbum.id, seriesName).then(function (founds) {
                        resolve(founds);
                    });
                    return;
                }
            }
            resolve(false);
        });
    },

    getSeriesPoster: function (releaseID) {
        return window.TVDB.getSeriesImage(releaseID);
    },

    getArtwork: function (searchManager, founds, list) {
        var _this = this;
        return new Promise(function (resolve, reject) {

            var tracks = list || searchManager.getTracks();

            if (_this.checkArtworkLoad(searchManager, founds, tracks, null)) {
                if (founds.length && (founds.length === tracks.count)) {
                    if (tracks.count) {
                        var recording = founds[0].recording;
                        if (!recording && founds[0].locatedTrack)
                            recording = founds[0].locatedTrack.recording;
                        
                        _this.getSeriesPoster(recording).then(function (fn) {
                            if (fn) {
                                _this.useArtwork(searchManager, founds[0].album, tracks, fn);
                            }
                            resolve();
                        });
                        return;
                    }
                } else {
                    if (founds && founds.length && founds[0].__usedRelease && tracks.count) {
                        _this.getSeriesPoster(founds[0].__usedRelease.id).then(function (fn) {
                            if (fn) {
                                _this.useArtwork(searchManager, founds[0].__usedRelease.title, tracks, fn);
                            }
                            resolve();
                        });
                        return;
                    }
                }
            }
            resolve();
        });
    },

    getAlbumInfo: function (album, pixelSize) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var infoClass = {
                cover: '',
                genres: [],
                name: '',
                description: '',
                date: 0,
            };
            var ar = [];
            var serieID = album.tvdbid;
            if (!serieID) {
                ar.push(window.TVDB.findSeriesID(album.title).then(function (id) {
                    serieID = id;
                    album.tvdbid = id;
                    album.commitAsync();
                }));
            }

            whenAll(ar).then(function () {
                var ar = [];
                if (serieID) {
                    ar.push(_this.getSeriesPoster(serieID).then(function (fn) {
                        infoClass.cover = fn;
                    }));

                    ar.push(window.TVDB.getSeriesInfo(serieID).then(function (data) {
                        if (data) {
                            infoClass.genres = data.genre;
                            infoClass.name = data.seriesName;
                            infoClass.description = data.overview;
                            infoClass.date = data.firstAired;
                            infoClass.imdb = data.imdbId;
                        }
                    }));
                }

                whenAll(ar).then(function () {
                    resolve(infoClass);
                });
            });
        });
    },

    getCopyrightInfo: function () {
        return new Promise(function (resolve, reject) {
            loadIcon('tvdb', function (data) {
                resolve('<span class="inline hotlink" style="width: 3.2em; height: 1.85em" onclick="app.utils.shellExecute(\'https://www.thetvdb.com\', \'https://www.thetvdb.com/\');">' + data + '</span>' +               
                    '<span class="left-indent-small textOther">TV information and images are provided by TheTVDB.com, but we are not endorsed or certified by TheTVDB.com or its affiliates.</span>');
            });
        });
    },

});
