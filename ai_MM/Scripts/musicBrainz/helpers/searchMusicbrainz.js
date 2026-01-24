/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

requirejs('helpers/searchCommon');
requirejs('helpers/musicBrainz');
requirejs('helpers/acoustID');
requirejs('helpers/discogs');

requirejs('consts');

const LIMIT_ALL = -1;

webTaggers.musicbrainz = inheritTagger('MusicBrainz', 'Common', {
    debug: false,
    albumTracksLimit: 3,

    fingerprintingSupport: function () {
        return true;
    },

    finishSearch: function (searchManager) {
        musicBrainz.cancelDownloads(this.uniqueID);
    },

    isError: function (searchManager, data, type, par1, par2) {
        if (data && data.responseCode && (data.responseCode.name === 'AbortError'))
            return false; // ignore Abort error

        var addon = '';
        if (type === 'track') {
            addon = _('track') + ' "' + par1 + '"';
        } else if (type === 'album') {
            addon = _('album') + ' "' + par1;
            if (par2) {
                addon += ' ('+par2+')';
            }
            addon += '"';
        } else if (type === 'recording') {
            addon = _('File') + ' "' + par1 + '"';
        }
        if (data && ((data.status && (data.status === 'error')) || (data.error))) {
            searchManager.notifyError(data.responseCode, addon, data.error || data.response);
            return true;
        }
        return false;
    },

    _removeBrackets: function (input) {
        var str = webTaggersClasses.MusicBrainz.$super._removeBrackets.apply(this, arguments);
        str = musicBrainz.normalizeString(str);
        return str;
    },
    
    albumSearchStep: function (searchManager, album, albumArtist, lst) {
        var _this = this;
        return new Promise(function (resolve) {
            if (albumArtist == 'Various')
                albumArtist = 'Various Artists';

            let doSearch = function (num) {
                searchManager.notifyProgress(undefined, undefined, _('Searching')+': '+_('albums'));
                window.musicBrainz.findReleaseGroup(_this.uniqueID, {
                    title: album,
                    albumArtist: albumArtist
                }, true /* only official albums */ , true /* include tracks to all releases */ , num).then(function (data) {
                    if (searchManager.isCanceled() || _this.isError(searchManager, data, 'album', album, albumArtist))
                        resolve(false);
                    if (data && data.length) {
                        var ar = [];
                        for (var i = 0; i < data.length; i++) {
                            ar = ar.concat(data[i]);
                        }
                        ar._lookForAlbum = album;
                        ar._lookForAlbumArtist = albumArtist;
                        _this.searchByAlbum(searchManager, lst, ar).then(function (res) {
                            if (res) {
                                _this.applyToTracks(searchManager, res, lst).then(function (resolution) {
                                    if (lst.count !== res.length)
                                        resolve(res);
                                    else
                                        resolve(true);
                                });
                            } else {
                                resolve(false);
                            }
                        });
                    } else {
                        resolve(false);
                    }
                });
            };

            doSearch(100);

        });
    },

    lookupSource: LINK_MUSICBRAINZ,
    allowedTypes: 'music,classical',

    maxMonthDistance: 12,
    maxDaysDistance: 30 * 12,
    
    getDateDistance: function (date1, date2) {
        if (!date1 || date1 < 0)
            return 0;
        if (!date2 || date2 < 0)
            return 0;
        var ds1 = date1.toString();
        var ds2 = date2.toString();
        var dt1 = new Date(ds1.substr(4, 2) + '/' + ds1.substr(6, 2) + '/' + ds1.substr(0, 4));
        var dt2 = new Date(ds2.substr(4, 2) + '/' + ds2.substr(6, 2) + '/' + ds2.substr(0, 4));
        var diff = Math.abs(dt1.getTime() - dt2.getTime());
        return diff / (1000 * 3600 * 24);
    },

    preferedCountries: ['US', 'GB', 'DE', 'AU', 'JP'],

    sortByPreferedCountry: function (country1, country2) {
        var idx1 = this.preferedCountries.indexOf(country1);
        var idx2 = this.preferedCountries.indexOf(country2);
        if ((idx1 >= 0) && (idx2 >= 0))
            if (idx1 > idx2)
                return 1;
            else
                return -1;

        if (idx1 >= 0)
            return -1;
        if (idx2 >= 0)
            return 1;
        return 0;
    },

    defaultCompare: function(searchManager, item1, item2) {
        var item1date = item1.release._mmdate;
        var item2date = item2.release._mmdate;

        if (this.getDateDistance(item1date, item2date) < this.maxDaysDistance) {
            if (searchManager.preferAlbums()) {
                // prefer albums and then single
                if (this.isSingle(item1.release))
                    return 1;
                if (this.isSingle(item2.release))
                    return -1;
            }

            if (item1.release.title === item2.release.title) {
                var res = this.sortByPreferedCountry(item1.release.country, item2.release.country);
                if (res !== 0)
                    return res;
            }

            if (item1date == item2date)
                return item2.score - item1.score;
        }

        return item1date - item2date;
    },

    isVariousArtistAlbum: function (album) {
        if (album.artists && album.artists.length) {
            for (var i = 0; i < album.artists.length; i++) {
                if ((this.isVariousArtist(album.artists[i].name)) ||
                    (album.artists[i].id === '89ad4ac3-39f7-470e-963a-56509c546377')) {
                    return true;
                }
            }
        } else
        if (album['artist-credit']) {
            for (var i = 0; i < album['artist-credit'].length; i++) {
                if ((this.isVariousArtist(album['artist-credit'][i].artist.name)) ||
                    (album['artist-credit'][i].artist.id === '89ad4ac3-39f7-470e-963a-56509c546377')) {
                    return true;
                }
            }
        }
        return false;
    },

    getAlbumTypeText: function (album) {
        var type = album.type || album['primary-type'];
        var sec = album.secondarytypes || album['secondary-types'];

        var ret = type;
        if (sec) {
            ret = '';
            for (var i = 0; i < sec.length; i++) {
                if (ret)
                    ret += ', ';
                ret += sec[i];
            }
        }
        return ret;
    },

    acceptableStatus: ['Official', 'Promotion', 'Bootleg'], // to be used in future related to #21332
    isAcceptedStatus: function (album) {
        return this.acceptableStatus.includes(album.status);
    },

    isOfficialStatus: function (album) {
        if (album && (this.isAcceptedStatus(album) || album.status === undefined /* #15345 item 31 ... single for this track have no status */ ))
            return true;
        return false;
    },

    isOfficialAlbumOrSingle: function (album) {
        return this.isOfficialAlbum(album) || this.isSingle(album);
    },

    acceptableSecondaryTypes: ['Soundtrack', 'Remix'],
    isAcceptableSecondaryType: function (sec) {
        if (!sec || !sec.length)
            return true;

        return (sec.length === 1) && this.acceptableSecondaryTypes.includes(sec[0]);
    },

    isSingle: function (album) {
        if (!album)
            return false;
        if (album['release-group'])
            album = album['release-group'];
        var sec = album.secondarytypes || album['secondary-types'];
        var type = album.type || album['primary-type'];
        if (type) {
            if (type.toLowerCase() === 'single')
                if (this.isAcceptableSecondaryType(sec))
                    return true;
        } else 
            if (!sec)
                return this.isOfficialStatus(album);
        return false;
    },

    isOfficialAlbum: function (album) {
        var oldAlbum = album;
        if (!album)
            return false;
        if (album['release-group'])
            album = album['release-group'];
        var sec = album.secondarytypes || album['secondary-types'];
        var type = album.type || album['primary-type'];
        if (type) {
            type = type.toLowerCase();
            if ((type === 'album') || (type === 'ep'))
                if (!sec || this.isAcceptableSecondaryType(sec)) {
                    // also check artist whether it's various
                    return !this.isVariousArtistAlbum(album) && !this.isVariousArtistAlbum(oldAlbum);
                }
        }
        return false;
    },

    fixDate: function (date, isAlbumOrSingle) {
        if (date && typeof date === 'string') {
            if (date.length === 4)
                if (isAlbumOrSingle)
                    date += '-01-01';
                else
                    date += '-12-31';
            if (date.length > 4 && date.length < 8)
                date += '-28';
        }
        return date;
    },

    getYear: function (mmdate) {
        if ((typeof mmdate === 'integer') || (typeof mmdate === 'number')) {
            if (mmdate > 9999)
                return parseInt(mmdate / 10000);
        } else if (typeof mmdate === 'string') {
            if (mmdate.length > 4)
                return mmdate.substring(1, 4);
        }
        return mmdate;
    },

    addTrackLookup: function (searchManager, path, locatedTrack) {
        var _handler = this;
        if (locatedTrack.album) {
            if (locatedTrack.getDetailAsync === undefined) {
                if (!locatedTrack.number || !locatedTrack.date) {
                    locatedTrack.getDetailAsync = function (track) {
                        var _this = this;
                        return new Promise(function (resolve) {
                            if (_this.releaseGroup) {
                                musicBrainz.getReleaseGroupInfo(_this.uniqueID, _this.releaseGroup, false, true).then(function (data) {
                                    if (searchManager.isCanceled() || _handler.isError(searchManager, data, 'track', app.utils.getFilename(path))) {
                                        resolve(false);
                                        return;
                                    }
                                    if (data) {
                                        var browseMedia = function (media) {
                                            if (media && media.length) {
                                                for (var m = 0; m < media.length; m++) {
                                                    if (media[m].tracks) {
                                                        for (var i = 0; i < media[m].tracks.length; i++) {
                                                            var recording = media[m].tracks[i].recording;
                                                            if (typeof recording === 'object')
                                                                recording = recording.id;
                                                            if (recording === _this.recording) {
                                                                _this.number = i + 1;
                                                                return true;
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                            return false;
                                        };

                                        _this.originalDate = app.utils.myDecodeDate(data['first-release-date']);
                                        if (data['artist-credit'])
                                            _this.albumArtist = _handler.getArtistText(data['artist-credit']);
                                        if (_this.recording) {
                                            browseMedia(data.media);
                                        }
                                    }
                                    resolve();
                                });
                                return;
                            }
                            resolve();
                        });
                    }
                }
            }
            searchManager.addTrackLookup(path, locatedTrack, LINK_MUSICBRAINZ);
        }
    },

    getRecordingInfo: function (recordingId, path) {
        var _this = this;
        return new Promise(function (resolve) {
            musicBrainz.getRecordingTags(_this.uniqueID, recordingId).then(function (data) {
                if (_this.isError(searchManager, data, 'recording', app.utils.getFilename(path), recordingId)) {
                    resolve();
                    return;
                }

                var loc = {
                    title: '',
                    genre: '',
                };

                function capitalizeFirstLetter(string) {
                    return string.charAt(0).toUpperCase() + string.slice(1);
                }

                if (data) {
                    loc.title = data.title;
                    if (data.tags) {
                        data.tags.sort(function (item1, item2) {
                            return item2.count - item1.count;
                        });
                        var genre = '';
                        data.tags.forEach(function (item, index) {
                            if (genre)
                                genre += '; ';
                            genre += capitalizeFirstLetter(item.name);
                        });
                        loc.genre = genre;
                    }
                }
                resolve(loc);
            });
        });
    },

    _splitArtist: function (artist, splitFeatured) {
        var ret = [];

        var artists = artist.split(';');
        for (var i = 0; i < artists.length; i++) {

            var usedSep = false;
            if (splitFeatured) {
                var arts = this.splitFeaturedArtists(artists[i]);
                usedSep = arts.length > 1;
                if (usedSep)
                    ret = ret.concat(arts);
            }

            if (!usedSep)
                ret.push(artists[i]);
        }
        return ret;
    },

    _compareArtists: function (originalArtists, locatedArtists) {
        var locArts = this.getArtistText(locatedArtists);

        var orgArtsList = (isArray(originalArtists) ? originalArtists : this._splitArtist(originalArtists.toLowerCase()));

        var founds = 0;

        if (orgArtsList.length) {
            for (var rA = 0; rA < locatedArtists.length; rA++) {
                var rArtist = locatedArtists[rA].artist.name;
                for (var aa = 0; aa < orgArtsList.length; aa++) {
                    if ((app.utils.stringSimilarity(orgArtsList[aa], rArtist, false) >= 0.8) ||
                        (app.utils.stringSimilarity(orgArtsList[aa].replace(/\bthe\b/ig, ''), rArtist.replace(/\bthe\b/ig, ''), false) >= 0.8)) {
                        founds++;
                    }
                }
            }
        }

        if (founds >= 1 /*orgArtsList.length*/ )
            return true;
        return false;
    },

    _searchTrackByTitle: function (searchManager, track, progress) {
        var _this = this;
        return new Promise(function (resolve) {

            var title = _this._removeBrackets(track.title);
            var artist = _this._removeBrackets(track.artist);
            if (!artist || _this.isVariousArtist(artist))
                artist = _this._removeBrackets(track.albumArtist);
            var artists = _this._splitArtist(artist, true);

            var album = _this._removeBrackets(track.album);

            var artsInTitle = _this.splitFeaturedArtists(title);
            if (artsInTitle.length > 1) {
                artsInTitle.shift();
                artists = artists.concat(artsInTitle);
            }

            if (artists.length > 1)
                artist = artists[0];

            var origTrackLen = track.songLength;
            var allAlbums = [];
            var current = 0;
            var total = 0;

            var preferAlbums = searchManager.preferAlbums();
            
            var processAlbum = function (album, origTrack, lookupClass) {
                return new Promise(function (resolve, reject) {
                    musicBrainz.getReleaseInfo(_this.uniqueID, album.id, true /* create tracklist */ , true /* relations */ , true /* track artists */ ).then(function (retval) {
                        if (searchManager.isCanceled() || _this.isError(searchManager, retval, 'album', album.name)) {
                            resolve(false);
                            return;
                        }
                        if (!retval || !retval.release) {
                            resolve();
                            return;
                        }
                        var loc = {};
                        if (lookupClass) {
                            loc = lookupClass;
                        }
                        loc.albumArtist = _this.getArtistText(retval.release['artist-credit']);
                        loc.date = (retval.release.date !== undefined) ? parseInt(app.utils.myDecodeDate(retval.release.date)) : 0;
                        loc.albumType = _this.getAlbumTypeText(album['release-group']);
                        loc.release = album.id;

                        var rgTracks = retval.tracklist;
                        if (rgTracks) {
                            var founds = [];
                            if (!origTrack)
                                origTrack = track;
                            rgTracks.whenLoaded().then(function () {
                                if (searchManager.isCanceled()) {
                                    resolve(false);
                                    return;
                                }
                                rgTracks.locked(function () {
                                    for (var i = 0; i < rgTracks.count; i++) {
                                        var track = rgTracks.getValue(i);
                                        var title = track.title;
                                        var length = track.songLength;
                                        var trackNo = track.trackNumberInt;

                                        if ((app.utils.stringSimilarity(origTrack.title, title, false) >= 0.8)) { // &&
                                            //(Math.abs(origTrack.songLength - length) < 1000 /* length difference less than a second */ )) {

                                            loc.number = trackNo;
                                            loc.title = title;
                                            loc['artist-credit'] = [];
                                            loc.artist = track.artist;
                                            loc.album = track.album;
                                            loc.date = (retval.release.date !== undefined) ? parseInt(app.utils.myDecodeDate(retval.release.date)) : track.date;
                                            loc.length = track.songLength;
                                            loc.involvedPeople = track.involvedPeople;
                                            loc.composer = track.composer;
                                            loc.lyricist = track.lyricist;
                                            loc.publisher = track.publisher;
                                            loc['artist-credit'].push({
                                                artist: {
                                                    name: track.artist
                                                }
                                            });

                                            resolve();
                                            return;
                                        }
                                    }
                                });

                                resolve();
                            });
                        } else
                            resolve();
                    });
                });
            };

            var processAlbums = function (albums) {
                return new Promise(function (resolve) {

                    var process = function (idx) {
                        if (idx < albums.length) {
                            processAlbum(albums[idx]).then(function (res) {
                                if (!searchManager.isCanceled())
                                    process(++idx);
                            });
                        } else
                            resolve();
                    }
                    process(0);
                });
            };

            var search = function (title, type, usePrimaryArtist) {
                let promise;
                if (album) {
                    promise = musicBrainz.getTrackRecordingWithAlbum(_this.uniqueID, title, (usePrimaryArtist || artists.length) ? artists[0] : artists, album, type /* only official albums */ , 100);
                } else {
                    promise = musicBrainz.getTrackRecording(_this.uniqueID, title, (usePrimaryArtist || artists.length) ? artists[0] : artists, type /* only official albums */ , 100);
                }
                return promise.then(function (_recordings) {
                    if (!_recordings || searchManager.isCanceled() || _this.isError(searchManager, _recordings, 'track', title)) {
                        resolve(false);
                        return;
                    }
                    
                    var recordings = _recordings.recordings;
                    if (recordings && recordings.length) {
                        if (progress && !searchManager.isRunning()) {
                            total += recordings.length;
                            searchManager.notifyProgress(current, total);
                        }

                        for (var i = 0; i < recordings.length; i++) {
                            if (recordings[i].releases) {
                                for (var j = 0; j < recordings[i].releases.length; j++) {
                                    var release = recordings[i].releases[j];
                                    if (_this.isOfficialStatus(release)) { // get all official albums

                                        var canAdd = true;

                                        if (!progress) {
                                            var recArtists = recordings[i]['artist-credit'];
                                            // check artist is correct
                                            canAdd = artists.length < 1;
                                            if (!canAdd && recArtists)
                                                canAdd = _this._compareArtists(artists, recArtists);

                                            /*for (var rA = 0; rA < recArtists.length; rA++) {
                                                var rArtist = recArtists[rA].artist.name;
                                                for (var aa = 0; aa < artists.length; aa++) {
                                                    if ((app.utils.stringSimilarity(artists[aa], rArtist, false) >= 0.8) ||
                                                        (app.utils.stringSimilarity(artists[aa], rArtist.replace(/\bthe\b/ig, ''), false) >= 0.8)) {
                                                        canAdd = true;
                                                        break;
                                                    }
                                                }

                                                if (canAdd) break;
                                            }*/
                                        }

                                        if (canAdd) {
                                            var titleScore = 0;
                                            var titleScoreWithoutBrackets = 0;
                                            if (release.media && release.media.length && release.media[0].track && release.media[0].track.length) {
                                                titleScore = app.utils.stringSimilarity(title, /*_this._removeBrackets*/ (release.media[0].track[0].title), false);
                                                titleScoreWithoutBrackets = app.utils.stringSimilarity(title, _this._removeBrackets(release.media[0].track[0].title), false);
                                            }

                                            //if (!release['artist-credit'])
                                            release['artist-credit'] = recordings[i]['artist-credit'];
                                            recordings[i].score = parseInt(recordings[i].score);
                                            if (release.date) {
                                                var releaseDate = _this.fixDate(release.date, _this.isOfficialAlbumOrSingle(release));
                                                release._mmdate = parseInt(app.utils.myDecodeDate(releaseDate));
                                                release._mmyear = _this.getYear(release._mmdate);

                                                if (preferAlbums) {
                                                    if (_this.isSingle(release)) {
                                                        var ds1 = release._mmdate.toString();
                                                        var dt1 = new Date(ds1.substr(4, 2) + '/' + ds1.substr(6, 2) + '/' + ds1.substr(0, 4));
                                                        dt1.setMonth(dt1.getMonth() + _this.maxMonthDistance);
                                                        release._mmdate = parseInt(app.utils.myDecodeDate(dt1.toLocaleDateString("en-US")));
                                                        release._mmyear = _this.getYear(release._mmdate);
                                                    }
                                                }
                                                
                                            }
                                            allAlbums.push({
                                                searchTitle: title,
                                                id: recordings[i].id,
                                                release: release,
                                                originalDate: app.utils.myDecodeDate(release['date']),
                                                score: recordings[i].score,
                                                titleScore: titleScore,
                                                titleScoreWithoutBrackets: titleScoreWithoutBrackets,
                                                remixes: release.title.toUpperCase().includes('REMIX'),
                                                karaoke: release.title.toUpperCase().includes('KARAOKE')
                                            });
                                        }
                                    }
                                }
                            }
                            if (progress && !searchManager.isRunning()) {
                                current++;
                                searchManager.notifyProgress(current, total);
                            }
                        }
                    } else {
                        if (!usePrimaryArtist)
                            return search(title, type, true);
                    }
                });
            }

            var ar = [];
            ar.push(search(title, 'all'));

            var updateTitle = function (t) {
                t = t.replace(/\bnumber\b/ig, '#');

                t = t.replace(/\bten\b/ig, '10');
                t = t.replace(/\beleven\b/ig, '11');
                t = t.replace(/\btwelve\b/ig, '12');
                t = t.replace(/\bthirdteen\b/ig, '13');
                t = t.replace(/\bfourteen\b/ig, '14');
                t = t.replace(/\bfiveteen\b/ig, '15');
                t = t.replace(/\bsixteen\b/ig, '16');
                t = t.replace(/\bseventeen\b/ig, '17');
                t = t.replace(/\beighteen\b/ig, '18');
                t = t.replace(/\bnineteen\b/ig, '19');

                t = t.replace(/\bone\b/ig, '1');
                t = t.replace(/\btwo\b/ig, '2');
                t = t.replace(/\bthree\b/ig, '3');
                t = t.replace(/\bfour\b/ig, '4');
                t = t.replace(/\bfive\b/ig, '5');
                t = t.replace(/\bsix\b/ig, '6');
                t = t.replace(/\bseven\b/ig, '7');
                t = t.replace(/\beight\b/ig, '8');
                t = t.replace(/\bnine\b/ig, '9');
                t = t.replace(/\bzero\b/ig, '0');

                t = t.replace(/\bmister\b/ig, 'mr.');
                t = t.replace(/\bmiss\b/ig, 'ms.');

                t = t.replace(/\'n'\b/ig, " 'N ");

                return t;
            }

            var updateTitleNum = function (t) {
                t = t.replace(/\b#\b/ig, 'number');

                t = t.replace(/\b10\b/ig, 'ten');
                t = t.replace(/\b11\b/ig, 'eleven');
                t = t.replace(/\b12\b/ig, 'twelve');
                t = t.replace(/\b13\b/ig, 'thirdteen');
                t = t.replace(/\b14\b/ig, 'fourteen');
                t = t.replace(/\b15\b/ig, 'fiveteen');
                t = t.replace(/\b16\b/ig, 'sixteen');
                t = t.replace(/\b17\b/ig, 'seventeen');
                t = t.replace(/\b18\b/ig, 'eighteen');
                t = t.replace(/\b19\b/ig, 'nineteen');

                t = t.replace(/\b1\b/ig, 'one');
                t = t.replace(/\b2\b/ig, 'two');
                t = t.replace(/\b3\b/ig, 'three');
                t = t.replace(/\b4\b/ig, 'four');
                t = t.replace(/\b5\b/ig, 'five');
                t = t.replace(/\b6\b/ig, 'six');
                t = t.replace(/\b7\b/ig, 'seven');
                t = t.replace(/\b8\b/ig, 'eight');
                t = t.replace(/\b9\b/ig, 'nine');
                t = t.replace(/\b0\b/ig, 'zero');

                t = t.replace(/\bmr.\b/ig, 'mister');
                t = t.replace(/\bms.\b/ig, 'miss');

                return t;
            }

            var updateTitleSecondPass = function (t) {
                t = t.replace(/\bnumber /ig, '#');
                t = updateTitle(t);
                return t;
            }

            var altTitle = _this._removeBrackets(updateTitle(title));
            if (altTitle !== title) {
                ar.push(search(altTitle, 'all'));
            }

            altTitle = _this._removeBrackets(updateTitleNum(title));
            if (altTitle !== title) {
                ar.push(search(altTitle, 'all'));
            }

            var altTitle2nd = _this._removeBrackets(updateTitleSecondPass(title));
            if (altTitle2nd !== title && altTitle2nd !== altTitle) {
                ar.push(search(altTitle2nd, 'all'));
            }

            // change ', ’ and others 
            let curr = _this._removeBrackets(title);

            altTitle3rd = curr.replace(/’/ig, '-');
            if (altTitle3rd !== title && altTitle3rd !== altTitle) {
                ar.push(search(altTitle3rd, 'all'));
            }

            altTitle3rd = curr.replace(/’/ig, '\'');
            if (altTitle3rd !== title && altTitle3rd !== altTitle) {
                ar.push(search(altTitle3rd, 'all'));
            }

            whenAll(ar).then(function () {
                if (searchManager.isCanceled()) {
                    resolve(false);
                    return;
                }

                // sort found release groups by date
                allAlbums.sort(function (item1, item2) {
                    if ((item1.release._mmdate <= 0) || (!item1.release._mmdate))
                        return 1;
                    if ((item2.release._mmdate <= 0) || (!item2.release._mmdate))
                        return -1;

                    return _this.defaultCompare(searchManager, item1, item2);
                });

                for (var i = 0; i < allAlbums.length; i++) {
                    var album = allAlbums[i].release;

                    var artist = _this.getArtistText(album['artist-credit']);
                    var number = '';
                    var title = '';
                    var media = album.media;
                    if (media && media.length && media[0].track && media[0].track.length) {
                        number = media[0].track[0].number;
                        title = media[0].track[0].title;
                    }

                    var loc = {
                        number: number || '',
                        title: title || '',
                        'artist-credit': [],
                        artist: artist,
                        album: album.title,
                        albumArtist: '',
                        date: (album.date !== undefined) ? parseInt(app.utils.myDecodeDate(album.date)) : '',
                        length: '',
                        involvedPeople: '',
                        composer: '',
                        lyricist: '',
                        publisher: '',
                        release: album.id,
                        __album: album,
                        albumType: _this.getAlbumTypeText(album['release-group']),
                        releaseGroup: (album['release-group']) ? album['release-group'].id : '',
                        getDetailAsync: function (track) {
                            var _this = this;
                            return new Promise(function (resolve) {
                                processAlbum(_this.__album, track, _this).then(function (res) {
                                    if (res) {
                                        resolve(res);
                                    }
                                    resolve();
                                });
                            });
                        },
                    };
                    loc['artist-credit'].push({
                        artist: {
                            name: track.artist
                        }
                    });


                    _this.addTrackLookup(searchManager, track.path, loc);
                }

                resolve(allAlbums);
            });
        });
    },

    searchTrack: function (searchManager, track) {
        var _this = this;
        return new Promise(function (resolve, reject) {

            _this._searchTrackByTitle(searchManager, track, false).then(function (allAlbums) {
                if (searchManager.isCanceled()) {
                    resolve(false);
                    return;
                }

                var loops = 0;

                var processAlbums = function () {
                    if (allAlbums.length) {
                        // get first album or single without any secondary
                        var adepts = [];
                        var bestByAlbumNameIdx;
                        var bestByAlbumNameScore = 0;
                        var bestByAlbumYear = 99990101;
                        var trackNumberSame = false;
                        var discNumberSame = false;
                        var album = track.album;
                        var isKaraoke = track.album.toLowerCase().includes('karaoke');
                        var anyKaraoke = false;
                        var anyRemixes = false;
                        var topScore = 0;

                        var trackLength = track.songLength;
                        var trackNum = track.trackNumberInt;
                        var discNum = track.discNumberInt || 1;

                        var usedAlbum = null;

                        var debugInfo = '';
                        var debugEnabled = _this.debug;
                        var avoidCompilations = searchManager.avoidCompilations();

                        for (var i = 0; i < allAlbums.length; i++) {
                            var release = allAlbums[i].release;
                            if (avoidCompilations)
                                if (!_this.isOfficialAlbumOrSingle(release))
                                    continue;
                            if (!release._deprecated && release['release-group']) {
                                if (album) {
                                    var score = app.utils.stringSimilarity(album, release.title, false);
                                    if (score >= bestByAlbumNameScore) {
                                        var date = release._mmdate;

                                        // prefer track and disc number (when filled)
                                        trackNumberSame = !trackNum;
                                        discNumberSame = !discNum;

                                        if (release.media && release.media.length && release.media[0].track && release.media[0].track.length && trackNum && (parseInt(release.media[0].track[0].number) == trackNum)) {
                                            trackNumberSame = true;
                                        }
                                        if (release.media && release.media.length && release.media[0] && discNum && (parseInt(release.media[0].position) == discNum)) {
                                            discNumberSame = true;
                                        }

                                        if (((!date || (bestByAlbumYear > date)) || (score > bestByAlbumNameScore)) && trackNumberSame && discNumberSame) { // album is older or album title is more relevant
                                            // compare track title and length
                                            var title = allAlbums[i].searchTitle;
                                            var len = trackLength;

                                            if (release.media && release.media.length && release.media[0].track && release.media[0].track.length) {
                                                var mediaTrack = release.media[0].track[0];
                                                title = mediaTrack.title;
                                                len = mediaTrack.duration || mediaTrack.length;
                                            }
                                            if (((app.utils.stringSimilarity(allAlbums[i].searchTitle, title, false) >= 0.9) ||
                                                    (app.utils.stringSimilarity(allAlbums[i].searchTitle, _this._removeBrackets(title), false) >= 0.9)) &&
                                                (Math.abs(trackLength - len) < 5000)) {

                                                if (date)
                                                    bestByAlbumYear = date;
                                                bestByAlbumNameIdx = i;
                                                bestByAlbumNameScore = score;
                                            }
                                        }
                                    }
                                    if (allAlbums[i].karaoke && isKaraoke) {
                                        topScore = Math.max(topScore, allAlbums[i].titleScore);
                                        adepts.push(allAlbums[i]);
                                        anyKaraoke = true;
                                    }
                                }
                                if (_this.isOfficialAlbumOrSingle(release['release-group'])) {
                                    if (allAlbums[i].remixes)
                                        anyRemixes = true;
                                    topScore = Math.max(topScore, allAlbums[i].titleScore);
                                    adepts.push(allAlbums[i]);
                                }
                            }
                        }

                        // in case track is not in any official album or single (track is only on compilations)
                        if (!album && !adepts.length && allAlbums.length) {
                            if (!avoidCompilations)
                                adepts.push(allAlbums[0]);
                        }

                        // basic sorting
                        adepts.sort(function (item1, item2) {
                            return _this.defaultCompare(searchManager, item1, item2);
                        });

                        if (isKaraoke && anyKaraoke) {
                            adepts.sort(function (item1, item2) {
                                if (item1.karaoke)
                                    return -1;
                                if (item2.karaoke)
                                    return 1;

                                return 0;
                            });
                        }

                        // album is not known and lookup doesn't work well for short titles (like 'No' by 'Meghan Trainor')
                        if (!album) {
                            if (track.title.length < 5) {
                                adepts.sort(function (item1, item2) {
                                    if (item1.titleScore === item2.titleScore)
                                        return item1._mmdate - item2._mmdate;
                                    return item2.titleScore - item1.titleScore;
                                });
                            } else {
                                if (anyRemixes) {
                                    adepts.sort(function (item1, item2) {
                                        if (item1.remixes)
                                            return 1;
                                        if (item2.remixes)
                                            return -1;

                                        return 0;
                                    });
                                }
                            }
                        }

                        var oldAlbumFound = (bestByAlbumNameScore >= 0.9);

                        if (!oldAlbumFound && (!adepts.length || (topScore < 0.8)) && ((resolveToValue(_this.fingerprintingSupport, false) && !searchManager.wasFingerprinted(track.path)) || (avoidCompilations))) {
                            resolve();
                            return;
                        }

                        var id = adepts.length ? adepts[0].id : allAlbums[0].id;
                        var release = adepts.length ? adepts[0].release : allAlbums[0].release;

                        if (debugEnabled)
                            debugInfo += 'initial release is\n' + JSON.stringify(release) + '\n\n';

                        if (oldAlbumFound) { // prefer old album
                            usedAlbum = allAlbums[bestByAlbumNameIdx];
                            id = allAlbums[bestByAlbumNameIdx].id;
                            release = allAlbums[bestByAlbumNameIdx].release;

                            if (debugEnabled)
                                debugInfo += 'recommended album\n' + JSON.stringify(release) + '\n\n';
                        } else { // group adepts by gid and use most used

                            // check highest title score 
                            var maxTitleScore = 0;
                            for (var i = 0; i < adepts.length; i++) {
                                maxTitleScore = Math.max(maxTitleScore, adepts[i].titleScore);
                            }

                            var findCorrectRelease = function () {
                                var listByReleases = [];
                                for (var i = 0; i < adepts.length; i++) {
                                    if (adepts[i].release.id === release.id) {
                                        listByReleases.push(adepts[i]);
                                    }
                                }

                                var titleSim = 0;
                                if (listByReleases.length) {
                                    var trackLen = track.songLength;
                                    var trackTitle = listByReleases[0].searchTitle;
                                    //var maxScore = 0;
                                    for (var i = 0; i < listByReleases.length; i++) {
                                        var rel = listByReleases[i].release;

                                        if (rel.media && rel.media.length && rel.media[0].track && rel.media[0].track.length) {
                                            var mediaTrack = rel.media[0].track[0];
                                            var len = mediaTrack.duration || mediaTrack.length;
                                            var sim = listByReleases[i].titleScore + listByReleases[i].titleScoreWithoutBrackets;
                                            if ((Math.abs(len - trackLen) < trackLen / 5) && (sim >= titleSim)) {
                                                id = listByReleases[i].id;
                                                release = rel;
                                                //maxScore = score;
                                                titleSim = sim;

                                                if (debugEnabled)
                                                    debugInfo += 'recommending album based on track title (similarity ' + sim + ')\n' + JSON.stringify(release) + '\n\n';
                                            }
                                        }
                                    }
                                }
                                //return titleSim === maxTitleScore;
                                return titleSim >= 1.6;
                            }
                            if (!findCorrectRelease() && adepts.length) {
                                if (debugEnabled)
                                    debugInfo += 'recommendation based on track title not sufficient\n\n';

                                adepts.sort(function (item1, item2) {
                                    return _this.defaultCompare(searchManager, item1, item2);
                                });

                                id = adepts[0].id;
                                release = adepts[0].release;
                                usedAlbum = adepts[0];

                                if (debugEnabled)
                                    debugInfo += 'new release after sort by score is\n' + JSON.stringify(release) + '\n\n';

                                findCorrectRelease();
                            }
                        }

                        var loc = {
                            number: track.trackNumberInt,
                            title: track.title,
                            'artist-credit': [],
                            artist: _this.getArtistText(release['artist-credit']),
                            album: release.title,
                            albumArtist: '',
                            genre: track.genre,
                            date: (release.date !== undefined) ? parseInt(app.utils.myDecodeDate(release.date)) : '',
                            originalDate: (usedAlbum ? usedAlbum.originalDate : ''),
                            length: '',
                            involvedPeople: '',
                            composer: '',
                            lyricist: '',
                            publisher: '',
                            release: release.id,
                            releaseGroup: (release['release-group']) ? release['release-group'].id : '',
                            albumType: _this.getAlbumTypeText(release['release-group']),
                        }

                        var ar = [];
                        ar.push({
                            linkType: _this.lookupSource,
                            info: 'release',
                            link: release.id
                        });
                        searchManager.setTrackLinks(track.path, ar);

                        var saveToFile = function (loc) {
                            if (debugEnabled) {
                                var fn = 'track - ' + track.path.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.json';
                                var content = 'debug info:\n\n' + debugInfo + '\n\n\nrelease:\n\n' + JSON.stringify(release) + '\n\n\nloc:\n\n' + JSON.stringify(loc) + '\n\n\nadepts:\n\n' + JSON.stringify(adepts);
                                app.filesystem.saveTextToFileAsync(fn, content);
                            }
                        }

                        var parseMedia = function () {
                            if (release.media && release.media.length && release.media[0].track && release.media[0].track.length) {

                                if (release.media[0].track[0].number !== undefined)
                                    loc.number = release.media[0].track[0].number;
                                if (release.media[0].track[0].title !== undefined)
                                    loc.title = release.media[0].track[0].title;

                                _this.getRecordingInfo(id, loc.path).then(function (data) {
                                    if (searchManager.isCanceled()) {
                                        resolve(false);
                                        return;
                                    }
                                    if (data) {
                                        if (data.title !== '')
                                            loc.title = data.title;
                                        if (data.genre !== '')
                                            loc.genre = data.genre;
                                    }
                                    saveToFile(loc);
                                    resolve(loc);
                                });
                            } else {
                                saveToFile(loc);
                                resolve(loc);
                            }
                        };

                        if (release['release-group']) {
                            musicBrainz.getReleaseGroupInfo(_this.uniqueID, release['release-group'].id).then(function (data) {
                                if (_this.isError(searchManager, data)) {
                                    resolve();
                                    return;
                                }
                                if (data) {
                                    loc.albumArtist = _this.getArtistText(data['artist-credit']);
                                    if (_this.isVariousArtist(loc.albumArtist) && _this.isOfficialAlbumOrSingle(release) && (loops < 5)) { // #15994
                                        var rel = allAlbums.find(function (rec) {
                                            return rec.release.id === loc.release;
                                        });
                                        if (rel && adepts.length > 1) {
                                            rel.release._deprecated = true;
                                            loops++;
                                            processAlbums();
                                            return;
                                        }
                                    }
                                    if (!loc.originalDate)
                                        loc.originalDate = parseInt(app.utils.myDecodeDate(data['first-release-date']));
                                    if (!loc.date)
                                        loc.date = parseInt(app.utils.myDecodeDate(data.date));
                                }
                                parseMedia();
                            });
                        } else
                            parseMedia();


                        return;
                    }
                    resolve();
                }

                processAlbums();
            });
        });
    },

    searchByFingerprints: function (searchManager, list) {
        var _this = this;
        return new Promise(function (resolve, reject) {

            var notFoundNormalWay = false;
            var tracks = list || searchManager.getTracks();
            var fingerprints = [];
            var founds = [];
            var doubtful = [];
            var ar = [];
            var tracksFoundInAlbum = 0;
            var sett = settings.get('Options');
            var releaseGroupDate = [];

            tracks.locked(function () {
                for (var i = 0; i < tracks.count; i++) {
                    var track = tracks.getValue(i);
                    fingerprints.push({
                        track: track,
                        acoustData: ''
                    });
                }
            });

            var getFingerprintData = function (track) {
                var trackData = track;
                return new Promise(function (resolve) {
                    _this.setTrackState(searchManager, trackData.track, AT_STATE_FINGERPRINTING);
                    window.acoustID.getTrackInfo(trackData.track).then1(function (data) {
                        if (data && !searchManager.isCanceled()) {
                            trackData.acoustData = data;
                            searchManager.notifyTrackFingerprinted(trackData.track.path);
                            processTrack(trackData).then(function (newRec) {
                                if (searchManager.isCanceled()) {
                                    resolve();
                                    return;
                                }
                                if (trackData.track.autoTagState === AT_STATE_LOCATED) {
                                    newRec.newTrackState = AT_STATE_LOADING_ARTWORK;
                                    _this.applyToTrack(searchManager, searchManager.getFieldsToUpdate(true), newRec);
                                    searchManager.refresh();
                                }
                                resolve(trackData);
                            });
                        } else
                            resolve();
                    });
                });
            };

            // get all missing album details for located track and fill
            var getReleaseGroupDetails = function (releaseGroup, newRec) {
                return new Promise(function (resolve) {

                    var browseMedia = function (media) {
                        if (media && media.length) {
                            for (var m = 0; m < media.length; m++) {
                                if (media[m].tracks) {
                                    for (var i = 0; i < media[m].tracks.length; i++) {
                                        var recording = media[m].tracks[i].recording;
                                        if (typeof recording === 'object')
                                            recording = recording.id;
                                        if (recording === newRec.locatedTrack.recording) {
                                            newRec.locatedTrack.number = i + 1;
                                            return true;
                                        }
                                    }
                                }
                            }
                        }
                        return false;
                    };

                    var setReleaseGroupDetails = function (releaseGroupData) {
                        // get release group (album) info from MusicBrainz and fill up album date and track numbers
                        if (releaseGroupData) {
                            newRec.locatedTrack.originalDate = app.utils.myDecodeDate(releaseGroupData['first-release-date']);
                            newRec.locatedTrack.date = app.utils.myDecodeDate(releaseGroupData.date);
                            newRec.__locatedReleaseGroup = releaseGroupData;
                            browseMedia(releaseGroupData.media);
                            _this.addTrackLookup(searchManager, newRec.track.path, newRec.locatedTrack);
                        }
                    };

                    musicBrainz.getReleaseGroupInfo(_this.uniqueID, releaseGroup.id, false, true /* fast */ ).then(function (data) {
                        if (searchManager.isCanceled() || _this.isError(searchManager, data)) {
                            resolve(false);
                            return;
                        }
                        setReleaseGroupDetails(data);


                        if (releaseGroup.releases && releaseGroup.releases.length) {
                            var fields = searchManager.getFieldsToUpdate(true);
                            if (fields.involvedPeople || fields.writer || fields.publisher) {
                                // we need to load additional data for release
                                ar.push(musicBrainz.getReleaseInfo(_this.uniqueID, releaseGroup.releases[0].id, false, true).then(function (res) {
                                    if (searchManager.isCanceled() || _this.isError(searchManager, res)) {
                                        resolve(false);
                                        return;
                                    }
                                    return musicBrainz.browseRelations(newRec.locatedTrack, res.relations);
                                }));
                            }
                        } else {
                            if (!newRec.locatedTrack.number) {
                                musicBrainz.getReleases(_this.uniqueID, releaseGroup.id, false, true /* incl. tracks */ ).then(function (data) {
                                    if (searchManager.isCanceled() || _this.isError(searchManager, data)) {
                                        resolve(false);
                                        return;
                                    }
                                    if (data) {
                                        var handleRelease = function (idx) {
                                            if (idx < data.length) {
                                                if (!browseMedia(data[idx].media))
                                                    handleRelease(++idx);
                                                else
                                                    resolve();
                                            } else
                                                resolve();
                                        };
                                        handleRelease(0);
                                    } else
                                        resolve();
                                });
                                return;
                            }
                        }

                        resolve();
                    });
                });
            };

            // we've found album where track persist ... use it
            var applyReleaseGroup = function (releaseGroup, newRec, forceOverwrite) {
                if (releaseGroup && (newRec.origTrack.album === '' || forceOverwrite)) {
                    newRec.locatedTrack.album = releaseGroup.title;
                }
                var name = '';
                if (releaseGroup.artists) {
                    name = _this.getArtistText(releaseGroup.artists);
                } else if (releaseGroup['artist-credit']) {
                    name = _this.getArtistText(releaseGroup['artist-credit']);
                }
                newRec.locatedTrack.albumArtist = name;
                newRec.locatedTrack.releaseGroup = releaseGroup.id;
                _this.addTrackLookup(searchManager, newRec.track.path, newRec.locatedTrack);
            };

            var processTrack = function (track) {
                return new Promise(function (resolved) {

                    var usedRecordingIdx = 0;
                    var possibleAlbums = [];
                    var bestAlbumPick;
                    var useReleaseGroup = null;

                    var addPossibleAlbum = function (album, recording) {
                        // check album is not already in the list
                        if (!possibleAlbums.some(function (item) {
                                return item.album.id === album.id;
                            })) {
                            possibleAlbums.push({
                                album: album,
                                recording: recording
                            });
                        }

                    }

                    // method to browse all recordings and albums and pick best album(s) to use
                    var getBestRecordingIndex = function (newRec, recordings) {
                        var resultIdx = 0;

                        var title = newRec.track.title;
                        var album = newRec.track.album;
                        var albumArtist = newRec.track.albumArtist;
                        var artist = newRec.track.artist;
                        var trackNo = newRec.track.trackNumberInt;
                        var origTrackLen = newRec.track.songLength / 1000;
                        var trackPath = newRec.track.path;
                        var bestScore = 0;
                        var bestTitleScore = 0;

                        var loTitle = title.toLowerCase();

                        if ((loTitle.substring(0, 5) == 'track') && (loTitle.length <= 8))
                            title = '';

                        var bestMatch = 0;
                        var bestAlbumMatch = 0;
                        var bestReleaseByAlbum = -1;
                        var bestReleaseAlbumIdx = 0;
                        var bestReleaseClass;
                        var firstOfficial = true;

                        var replaceLimit = 0;
                        if (sett.Options.AutoTagReplace)
                            replaceLimit = sett.Options.AutoTagReplaceLimit;

                        // we try to get best recording based on original metadata
                        for (var i = 0; i < recordings.length; i++) {
                            var recording = recordings[i];
                            var loc = {
                                number: null,
                                title: recording.title,
                                'artist-credit': [],
                                artist: '',
                                album: null,
                                albumArtist: '',
                                recording: recording.id,
                                date: 0,
                                length: recording.duration,
                            };

                            // a. Calculate similarity of the returned tracks with the already existing metadata as a sum of
                            var score = 0;

                            //  i. String similarity of artist name (0, if smaller than 0.8?)
                            var bestArtistMatch = 0;
                            var artists = recording.artists;
                            if (artists) {
                                var recordingMatch = 0;
                                var artStr = '';
                                for (var j = 0; j < artists.length; j++) {
                                    var art = artists[j].name;
                                    if (artist) {
                                        recordingMatch = Math.max(recordingMatch, app.utils.stringSimilarity(artist, art, false));
                                        if (recordingMatch >= bestArtistMatch) {
                                            bestArtistMatch = recordingMatch;
                                        }
                                    }
                                    if (art.toUpperCase() !== 'UNKNOWN') {
                                        loc['artist-credit'].push({
                                            artist: {
                                                name: art
                                            }
                                        });
                                        if (artStr)
                                            artStr += ';';
                                        artStr += art;
                                    }
                                }
                                loc.artist = artStr;
                                if (artist)
                                    score += (bestArtistMatch >= 0.8) ? 1 : 0;
                                else
                                    score++;
                            }

                            var isOfficial = false;
                            var officialIdx = -1;

                            //  ii. String similarity of album name (0, if smaller than 0.8?)
                            if (album && recording.releasegroups) { // track have album defined
                                // get best matching album for a track
                                var topReleaseGroupMatch = 0;
                                for (var j = 0; j < recording.releasegroups.length; j++) {
                                    if (_this.isOfficialAlbumOrSingle(recording.releasegroups[j])) {

                                        // check album have no 'Various Artists'
                                        if (!_this.isVariousArtistAlbum(recording.releasegroups[j])) {
                                            isOfficial = true;
                                            if (officialIdx < 0)
                                                officialIdx = j;

                                            if (!artist || (bestArtistMatch >= 0.8)) {
                                                addPossibleAlbum(recording.releasegroups[j], recording);
                                            }

                                        }
                                    }

                                    var alb = recording.releasegroups[j].title;
                                    var releaseGroupMatch = app.utils.stringSimilarity(album, alb, false);

                                    if (releaseGroupMatch > bestAlbumMatch && alb) {
                                        bestAlbumMatch = releaseGroupMatch;
                                        //bestReleaseByAlbum = i;
                                        if (isOfficial)
                                            officialIdx = j;
                                        bestReleaseAlbumIdx = j;
                                        bestReleaseClass = recording.releasegroups[j];
                                        loc.album = alb;
                                    }
                                    if (releaseGroupMatch > topReleaseGroupMatch) {
                                        topReleaseGroupMatch = releaseGroupMatch;
                                    }
                                }
                                score += (topReleaseGroupMatch >= 0.8) ? 4 : 0; // we need to give album more priority than others

                                //  iv. +1 in case of a matching track# (just in case of reasonably similar album name?)
                                if (recording.number == trackNo)
                                    score++;
                            } else {
                                if (!album && recording.releasegroups) {
                                    var prefferedArtist = '';
                                    if (artist && bestArtistMatch >= 0.8)
                                        prefferedArtist = artist;
                                    else if (artist) {
                                        if (recording.artists) {
                                            for (var j = 0; j < recording.artists.length; j++) {
                                                var art = recording.artists[j].name;
                                                if (prefferedArtist)
                                                    prefferedArtist += ';';
                                                prefferedArtist += art;
                                            }
                                        }
                                    }

                                    // check any of release groups is official release album (give it maximum score if so)
                                    for (var alb = 0; alb < recording.releasegroups.length; alb++) {
                                        if (_this.isOfficialAlbumOrSingle(recording.releasegroups[alb])) {

                                            // add official album to the lookup list so user can choose it manually
                                            var albumArt = '';
                                            if (recording.releasegroups[alb].artists) {
                                                for (var j = 0; j < recording.releasegroups[alb].artists.length; j++) {
                                                    var art = recording.releasegroups[alb].artists[j].name;
                                                    if (albumArt)
                                                        albumArt += ';';
                                                    albumArt += art;
                                                }
                                            }

                                            var artistScore = 1;
                                            if (prefferedArtist) {
                                                artistScore = app.utils.stringSimilarity(prefferedArtist, albumArt, false);
                                            }

                                            // check album have no 'Various Artists'
                                            if (!_this.isVariousArtistAlbum(recording.releasegroups[alb]) && (artistScore >= 0.8)) {
                                                isOfficial = true;
                                                if (officialIdx < 0)
                                                    officialIdx = alb;

                                                if (!artist || (bestArtistMatch >= 0.8)) {
                                                    addPossibleAlbum(recording.releasegroups[alb], recording);
                                                }
                                            }

                                            loc.album = recording.releasegroups[alb].title;
                                            loc.albumArtist = albumArt;
                                            loc.releaseGroup = recording.releasegroups[alb].id;
                                            loc.albumType = _this.getAlbumTypeText(recording.releasegroups[alb]);
                                            var storeLoc = loc;
                                            _this.addTrackLookup(searchManager, trackPath, storeLoc);
                                        }

                                    }
                                    if (isOfficial) {
                                        // use length to enum a score for official album
                                        var lenScore = 3;
                                        var mbTrackLen = recording.duration;
                                        if (mbTrackLen) {
                                            if (origTrackLen && !isNaN(origTrackLen) && mbTrackLen && !isNaN(mbTrackLen))
                                                if (Math.abs(origTrackLen - mbTrackLen) < 5) {
                                                    lenScore = lenScore - (Math.abs(origTrackLen - mbTrackLen) / 2);
                                                } else
                                                    lenScore = 0;
                                        }

                                        score += lenScore;
                                    } else
                                        score -= 0.5; // non of the albums is official
                                }
                            }

                            //  iii. String similarity of title (0, if smaller than 0.8?)
                            var titleScore = 0;
                            if (title) {
                                if (recording.title && _this.acceptedTitle(recording.title)) {
                                    var maxLen = Math.min(title.length, recording.title.length);
                                    titleScore = app.utils.stringSimilarity(recording.title.substring(0, maxLen), title.substring(0, maxLen), false);
                                    titleScore = Math.max(titleScore, app.utils.stringSimilarity(recording.title, title, false));
                                    score += (titleScore >= 0.8) ? 5 : 0;
                                }
                            } else
                                score++;

                            //  v. +abs(5-track_length_difference_in_sec)
                            var mbTrackLen = recording.duration;
                            if (mbTrackLen) {
                                if (origTrackLen && !isNaN(origTrackLen) && mbTrackLen && !isNaN(mbTrackLen))
                                    score += Math.min(2, Math.abs(1 - Math.abs(origTrackLen - mbTrackLen)));
                            } else
                                score += 0.2;

                            // b. The best match will be presented to user in the UI. We also could assign it a confidence as ‘the value above * 20 %’.
                            // c. If confidence is higher than a value set in Options, just show ‘Found’ and a checked checkbox.
                            // d. If lower confidence, there should be a dropdown to choose from the available values and the checkbox would be unchecked until some result is chosen.                        
                            score = Math.min(100, score * 20);

                            if (score >= replaceLimit) {
                                var betterScore = ((bestScore <= score) && (!title || bestTitleScore <= titleScore));
                                if ((bestReleaseByAlbum === -1) || ( /*isOfficial &&*/ betterScore && album) || (!album && isOfficial && (firstOfficial || betterScore))) {
                                    if (recordings[i].releasegroups) {
                                        bestReleaseByAlbum = i;
                                        if (officialIdx >= 0)
                                            bestReleaseAlbumIdx = officialIdx;
                                        bestReleaseClass = recordings[bestReleaseByAlbum].releasegroups[bestReleaseAlbumIdx];
                                        if (officialIdx >= 0)
                                            useReleaseGroup = bestReleaseClass; // as we've found official album (not a compilation etc.) .. it's probably right album
                                        resultIdx = i;
                                        bestScore = score;

                                        if (!isOfficial && bestReleaseClass) { // official albums are added directly in albums loop
                                            addPossibleAlbum(bestReleaseClass, recording);
                                        }
                                    }
                                }
                            } else {
                                if (isOfficial && (!title || (titleScore * 100 >= replaceLimit /*0.8*/ ))) { // we've found some official album .. check if it's more relevant than old one
                                    if ((bestReleaseByAlbum === -1) || (bestReleaseClass && (bestReleaseClass.type !== 'Album' ||
                                            (bestReleaseClass.secondarytypes && bestReleaseClass.secondarytypes.length)))) {

                                        bestReleaseByAlbum = i;
                                        bestReleaseClass = recording.releasegroups[officialIdx];
                                        useReleaseGroup = bestReleaseClass; // as we've found official album (not a compilation etc.) .. it's probably right album
                                        resultIdx = i;
                                    }
                                }
                            }
                            bestTitleScore = Math.max(bestTitleScore, titleScore);
                            _this.addTrackLookup(searchManager, trackPath, loc);

                            if (!album && isOfficial)
                                firstOfficial = false;
                        }

                        if ((bestReleaseByAlbum >= 0) && (bestReleaseAlbumIdx >= 0) && (!album || bestAlbumMatch > 0.8)) { // best album is different than best recording by artist detection
                            useReleaseGroup = recordings[bestReleaseByAlbum].releasegroups[bestReleaseAlbumIdx];
                            if (useReleaseGroup) {
                                tracksFoundInAlbum++;
                                useReleaseGroup.trackAlbumName = album;
                                return bestReleaseByAlbum;
                            }
                        } else {
                            if (album) // album is defined, but not found exact album
                                doubtful.push(newRec);
                        }

                        return resultIdx;
                    };

                    var getBestReleaseGroupIndex = function (newRec, recordings) {

                        var browseRecording = function (recording, prefered) {
                            if (recording && recording.releasegroups) {
                                var minDate = 9999;
                                var idx = -1;
                                for (var j = 0; j < recording.releasegroups.length; j++) {
                                    if (_this.isOfficialAlbumOrSingle(recording.releasegroups[j])) {

                                        // if we have dates of official albums, use them to find correct album
                                        if (releaseGroupDate[recording.releasegroups[j].id]) {
                                            var dt = releaseGroupDate[recording.releasegroups[j].id];
                                            if (dt < minDate)
                                                idx = j;
                                        } else
                                            return recording.releasegroups[j];
                                    }
                                }
                                if (idx >= 0)
                                    return recording.releasegroups[idx];

                                if (prefered) {
                                    // not found, try compilation album
                                    for (var j = 0; j < recording.releasegroups.length; j++) {
                                        if (recording.releasegroups[j].secondarytypes) {
                                            for (var s = 0; s < recording.releasegroups[j].secondarytypes.length; s++) {
                                                if (recording.releasegroups[j].secondarytypes[s] === 'Compilation')
                                                    return recording.releasegroups[j];
                                            }
                                        }
                                    }

                                    return recording.releasegroups[0];
                                }
                            }
                            return null;
                        };

                        if (useReleaseGroup || bestAlbumPick) {
                            // check track can be placed on prefered album (it's known album in track recordings)
                            var canBeUsed = false;
                            for (var i = 0; i < recordings.length; i++) {
                                if (recordings[i] && recordings[i].releasegroups) {
                                    for (var j = 0; j < recordings[i].releasegroups.length; j++) {
                                        if ((bestAlbumPick && (recordings[i].releasegroups[j].id === bestAlbumPick.id)) ||
                                            (!bestAlbumPick && (recordings[i].releasegroups[j].id === useReleaseGroup.id))) {
                                            canBeUsed = true;
                                            break;
                                        }
                                    }
                                }
                                if (canBeUsed)
                                    break;
                            }

                            if (canBeUsed)
                                return bestAlbumPick || useReleaseGroup;
                        }

                        var rec = browseRecording(recordings[usedRecordingIdx], true);
                        if (!rec) {
                            for (var i = 0; i < recordings.length; i++) {
                                if (i !== usedRecordingIdx) {
                                    var recording = recordings[i];
                                    rec = browseRecording(recording, false);
                                    if (rec)
                                        break;
                                }
                            }
                        }
                        return rec;
                    };


                    var handleRecordings = function () {
                        return new Promise(function (resolve) {

                            var origTrack = track.track;
                            var newRec = {
                                track: origTrack,
                                origTrack: {
                                    number: origTrack.trackNumberInt,
                                    title: origTrack.title,
                                    album: origTrack.album
                                },
                                locatedTrack: _this.createLocatedTrack()
                            };

                            _this.setTrackState(searchManager, origTrack, AT_STATE_PROCESSING);
                            if (track.acoustData && track.acoustData.results && track.acoustData.results.length) {

                                var getRecordings = function (getTrackRecordings) {
                                    return new Promise(function (resolved) {
                                        var results = track.acoustData.results;
                                        var allRecordings = [];

                                        // merge all results recordings into one
                                        for (var i = 0; i < results.length; i++) {
                                            if (results[i].recordings && results[i].recordings.length)
                                                allRecordings = allRecordings.concat(results[i].recordings);
                                        }

                                        if (getTrackRecordings) {
                                            if (origTrack.title && origTrack.artist) {
                                                var title = origTrack.title;
                                                var artist = origTrack.artist;
                                                var album = origTrack.album;

                                                musicBrainz.getTrackRecording(_this.uniqueID, title, artist).then(function (res) {
                                                    if (searchManager.isCanceled() || _this.isError(searchManager, res, 'track', title)) {
                                                        resolve(false);
                                                        return;
                                                    }
                                                    if (res && res.recordings) {
                                                        for (var i = 0; i < res.recordings.length; i++) {
                                                            var recording = res.recordings[i];

                                                            var outData = {
                                                                title: recording.title,
                                                                duration: recording.length / 1000,
                                                                id: recording.id,
                                                                artists: [],
                                                                releasegroups: []
                                                            };

                                                            // add artists
                                                            if (recording['artist-credit']) {
                                                                for (var j = 0; j < recording['artist-credit'].length; j++) {
                                                                    var art = recording['artist-credit'][j].artist;
                                                                    outData.artists.push(art);
                                                                }
                                                            }

                                                            // add release groups
                                                            if (recording.releases) {
                                                                for (var j = 0; j < recording.releases.length; j++) {
                                                                    var release = recording.releases[j];
                                                                    var rel = {
                                                                        title: release.title,
                                                                        date: release.date,
                                                                        id: release['release-group'].id,
                                                                        artists: [],
                                                                        secondarytypes: release['release-group']['secondary-types'],
                                                                        type: release['release-group']['primary-type'],
                                                                    };
                                                                    if (release['artist-credit']) {
                                                                        for (var k = 0; k < release['artist-credit'].length; k++) {
                                                                            rel.artists.push(release['artist-credit'][k].artist);
                                                                        }
                                                                    } else {
                                                                        rel.artists.push({
                                                                            name: artist
                                                                        });
                                                                    }
                                                                    if (release.media && release.media.length && release.media[0].track && release.media[0].track.length) {
                                                                        //outData.number = release.media[0].track[0].number;
                                                                        rel.number = release.media[0].track[0].number;
                                                                    }
                                                                    outData.releasegroups.push(rel);
                                                                }

                                                            }


                                                            allRecordings.push(outData);
                                                        }


                                                        //allRecordings = allRecordings.concat(res.recordings);
                                                    }
                                                    resolved(allRecordings);
                                                });
                                                return;
                                            }
                                        } else {
                                            /*var getInfo = function(recording) {
                                                return musicBrainz.getRecordingReleaseGroups(_this.uniqueID, recording.id).then(function(data) {
                                                    if (data) {
                                                        recording.releases = data.releases;
                                                    }
                                                    if (recording.releases && recording.releases.length) {
                                                        var releaseDate = _this.fixDate(recording.releases[0].date, _this.isOfficialAlbumOrSingle(recording.releases[0]));
                                                        recording._mmdate = parseInt(app.utils.myDecodeDate(releaseDate));
                                                        recording._mmyear = _this.getYear(recording._mmdate);
                                                    }
                                                });
                                            };
                                            
                                            var ar = [];
                                            for(var i = 0; i < allRecordings.length; i++) {
                                                if (allRecordings[i].id && allRecordings[i].title) {
                                                    ar.push(getInfo(allRecordings[i]));
                                                }
                                            }
                                            
                                            whenAll(ar).then(() => {
                                                allRecordings.sort(function(item1, item2) {
                                                    if ((!item1._mmdate) || (item1._mmdate <= 0))
                                                        return 1;
                                                    if ((!item2._mmdate) || (item2._mmdate <= 0))
                                                        return -1;
                                                    return item1._mmdate - item2._mmdate;
                                                });
                                                resolved(allRecordings);        
                                            });
                                            
                                            return;*/
                                        }
                                        resolved(allRecordings);
                                    });
                                }

                                // as we have best albums for a track, we need to get dates of them and use earlier album
                                var getOfficialReleaseGroupsDate = function (recording) {
                                    return new Promise(function (resolve) {
                                        // we need to get album date only when more than one official album is in the list
                                        var albums = [];

                                        if (possibleAlbums.length) {
                                            possibleAlbums.forEach(function (item) {
                                                if (albums.indexOf(item.album.id) < 0)
                                                    albums.push(item.album.id);
                                            });
                                        } else {
                                            if (recording.releasegroups) {
                                                for (var j = 0; j < recording.releasegroups.length; j++) {
                                                    if (_this.isOfficialAlbumOrSingle(recording.releasegroups[j])) {
                                                        albums.push(recording.releasegroups[j].id);
                                                    }
                                                }
                                            }
                                        }

                                        if (albums.length > 1) {

                                            var sortedAlbums = [];

                                            var getAlbum = function (id) {
                                                if (possibleAlbums.length) {
                                                    for (var i = 0; i < possibleAlbums.length; i++)
                                                        if (possibleAlbums[i].album.id === id)
                                                            return possibleAlbums[i];
                                                } else {
                                                    for (var j = 0; j < recording.releasegroups.length; j++)
                                                        if (recording.releasegroups[j].id === id)
                                                            return {
                                                                album: recording.releasegroups[j],
                                                                recording: recording
                                                            };
                                                }
                                                return null;
                                            }

                                            var lookups = searchManager.getTrackLookups(track.track.path);

                                            var processAlbum = function (idx) {
                                                if (albums.length > idx) {
                                                    musicBrainz.getReleaseGroupInfo(_this.uniqueID, albums[idx], false, true /* fast */ ).then(function (data) {
                                                        if (searchManager.isCanceled() || _this.isError(searchManager, data)) {
                                                            resolve(false);
                                                            return;
                                                        }
                                                        if (data) {
                                                            var date = data["first-release-date"];
                                                            var dateAlbum = data.date;
                                                            if (date) {
                                                                var dt = parseInt(date.substring(0, 4));
                                                                releaseGroupDate[albums[idx]] = dt;
                                                                sortedAlbums.push({
                                                                    date: dt,
                                                                    id: albums[idx],
                                                                    album: getAlbum(albums[idx]),
                                                                    media: data.media
                                                                });

                                                                var recs = [];
                                                                if (data.media) {
                                                                    for (var i = 0; i < data.media.length; i++) {
                                                                        if (data.media[i].tracks) {
                                                                            for (var j = 0; j < data.media[i].tracks.length; j++) {
                                                                                recs.push(data.media[i].tracks[j].recording);
                                                                            }
                                                                        }
                                                                    }
                                                                }


                                                                // browse all stored lookups and fill them date
                                                                lookups.forEach(function (item) {
                                                                    if (item.releaseGroup === albums[idx] || recs.indexOf(item.recording) >= 0) {
                                                                        if (!item.date && dateAlbum)
                                                                            item.date = dateAlbum;
                                                                        if (!item.originalDate)
                                                                            item.originalDate = dt;
                                                                    }
                                                                });
                                                            }
                                                        }
                                                        processAlbum(++idx);
                                                    });
                                                } else {
                                                    if (useReleaseGroup) {
                                                        bestAlbumPick = useReleaseGroup;
                                                        resolve();
                                                        return;
                                                    } else if (sortedAlbums.length) {

                                                        sortedAlbums.sort(function (i1, i2) {
                                                            var dt = i1.date - i2.date;
                                                            // sort by date and type (Album have more preference than Single)
                                                            if (dt === 0) {
                                                                var a1 = i1.album;
                                                                var a2 = i2.album;
                                                                if (a1.album.type === 'Album')
                                                                    return -1;
                                                                else if (a2.album.type === 'Album')
                                                                    return 1;
                                                                else
                                                                    return 0;
                                                            } else
                                                                return dt;
                                                        });

                                                        var getMedia = function (alb) {
                                                            return new Promise(function (resolve) {
                                                                if (alb.media && alb.media.length) {
                                                                    resolve(alb.media);
                                                                } else {
                                                                    musicBrainz.getReleaseGroupTracks(_this.uniqueID, alb.album.id, false, false /* do not create tracklist */ ).then(function (data) {
                                                                        if (data && !_this.isError(searchManager, data))
                                                                            resolve(data.media);
                                                                        else
                                                                            resolve(null);
                                                                    });
                                                                }
                                                            });
                                                        };

                                                        var checkAlbum = function (idx) {
                                                            if (sortedAlbums.length > idx) {
                                                                var alb = sortedAlbums[idx].album;
                                                                // check recording is really in album (acoustID sometimes return album even when track is not listed in)
                                                                getMedia(sortedAlbums[idx]).then(function (media) {
                                                                    if (media && media.length) {
                                                                        // try to find recording in any media
                                                                        var recodingToFind = alb.recording.id;
                                                                        var titleToFind = alb.recording.title;
                                                                        var lengthToFind = alb.recording.duration;

                                                                        for (var i = 0; i < media.length; i++) {
                                                                            if (media[i].tracks) {
                                                                                for (var j = 0; j < media[i].tracks.length; j++) {
                                                                                    if ((media[i].tracks[j].recording === recodingToFind) ||
                                                                                        ((media[i].tracks[j].title === titleToFind) &&
                                                                                            Math.abs((media[i].tracks[j].length / 1000) - lengthToFind) < 2)) {
                                                                                        useReleaseGroup = alb.album;
                                                                                        bestAlbumPick = useReleaseGroup;
                                                                                        resolve();
                                                                                        return;
                                                                                    }
                                                                                }
                                                                            }
                                                                        }
                                                                    }
                                                                    checkAlbum(++idx);
                                                                });
                                                            } else
                                                                resolve();
                                                        }
                                                        checkAlbum(0);
                                                    } else
                                                        resolve();
                                                }
                                            };
                                            processAlbum(0);

                                        } else
                                            resolve();
                                    });
                                }

                                getRecordings().then(function (allRecordings) {
                                    if (searchManager.isCanceled()) {
                                        resolve(false);
                                        return;
                                    }
                                    if (allRecordings.length) {

                                        if (_this.debug) {
                                            ODS('Located track ' + track.track.path + ' using fingerprint with results :' + JSON.stringify(allRecordings));
                                        }
                                        // we have a guess 'what it is' so use it and look musicbrainz for albums
                                        var bestIdx = 0;
                                        var bestSim = 0;
                                        var bestSimLenDiff = 9999;
                                        var bestLenIdx = -1;
                                        var bestLenDif = 9999;
                                        var bestArtistIdx = -1;
                                        var bestAlbumIdx = -1;
                                        var bestAlbumSim = 0;
                                        var path = track.track.path;
                                        var isCD = path.includes('.cda');
                                        var title = track.track.title;
                                        var trackLength = track.track.songLength / 1000;
                                        var artist = track.track.artist;
                                        var album = track.track.album;
                                        if (title == '')
                                            title = app.filesystem.getFileFromString(path);
                                        var lowPath = path.toLowerCase();
                                        var maxScore = 0;
                                        var replaceLimit = 0;
                                        if (sett.Options.AutoTagReplace)
                                            replaceLimit = sett.Options.AutoTagReplaceLimit;

                                        for (var i = 0; i < allRecordings.length; i++) {
                                            searchManager.setTrackFingerprintTitles(path, allRecordings[i].title);
                                            var foundArtist = '';
                                            if (allRecordings[i].artists) {
                                                foundArtist = _this.getArtistText(allRecordings[i].artists);
                                            }
                                            var sim = app.utils.stringSimilarity(allRecordings[i].title, title, false);
                                            if (artist !== '')
                                                sim = sim + app.utils.stringSimilarity(foundArtist, artist, false);

                                            var lenDif = Math.abs(trackLength - allRecordings[i].duration);
                                            allRecordings[i].titleSim = sim;
                                            allRecordings[i].lenDiff = lenDif;

                                            if (sim >= bestSim) {

                                                var acceptable = true;
                                                if (sim === bestSim) { // it's already similar with another release ... check there's any official album (not compilation etc.)
                                                    var groups = allRecordings[i].releasegroups;
                                                    if (groups) {
                                                        acceptable = false;
                                                        for (var j = 0; j < groups.length; j++) {
                                                            if (_this.isOfficialAlbumOrSingle(groups[j])) {
                                                                acceptable = true;
                                                                break;
                                                            }
                                                        }
                                                    }
                                                    if (acceptable && isNaN(lenDif))
                                                        acceptable = false;
                                                }

                                                if (acceptable) {
                                                    bestIdx = i;
                                                    bestSim = sim;
                                                    bestSimLenDiff = lenDif;
                                                }
                                                var foundArtist = _this.getArtistText(allRecordings[i]['artists']);
                                                if ((foundArtist.length > 3) && lowPath.includes(foundArtist.toLowerCase())) {
                                                    bestArtistIdx = i; // artist name is used in track path ... it most probably IS correct artist
                                                }
                                            }

                                            if (((bestLenIdx == -1) && (lenDif < 10)) ||
                                                (bestLenIdx >= 0) && (lenDif < bestLenDif)) {

                                                bestLenDif = lenDif;
                                                bestLenIdx = i;
                                            }

                                            allRecordings[i].score = sim * 2; // prefer title similarity
                                            if (artist) {
                                                allRecordings[i].score += app.utils.stringSimilarity(_this.getArtistText(allRecordings[i]['artists']), artist, false);
                                            }
                                            if (isNaN(lenDif) && (allRecordings[i].score >= 1.9))
                                                lenDif = 0;
                                            if (lenDif < 10) {
                                                allRecordings[i].score += (10 - lenDif);
                                            }
                                            var groups = allRecordings[i].releasegroups;
                                            if (groups) {
                                                acceptable = false;
                                                for (var j = 0; j < groups.length; j++) {
                                                    if (_this.isOfficialAlbumOrSingle(groups[j])) {
                                                        allRecordings[i].score += 1;
                                                        break;
                                                    }
                                                }
                                            }

                                            if (album && !artist && !searchManager.avoidCompilations()) { // #17683
                                                var groups = allRecordings[i].releasegroups;
                                                if (groups) {
                                                    for (var j = 0; j < groups.length; j++) {
                                                        groups[j].score = app.utils.stringSimilarity(groups[j].title, album, false);
                                                        if (bestAlbumSim <= groups[j].score) {
                                                            bestAlbumSim = groups[j].score;
                                                            bestAlbumIdx = i;
                                                        }
                                                    }
                                                }
                                            }

                                            /*if (maxScore < allRecordings[i].score) {
                                                maxScore = allRecordings[i].score;
                                                //bestIdx = i;
                                            }*/

                                        }

                                        if ((bestSim >= 0.9) && (bestSimLenDiff < 5)) {
                                            if (bestAlbumIdx >= 0)
                                                bestIdx = bestAlbumIdx;
                                        } else
                                        if (bestAlbumIdx >= 0)
                                            bestIdx = bestAlbumIdx;
                                        else if (bestArtistIdx >= 0)
                                            bestIdx = bestArtistIdx;
                                        else
                                        if ((bestLenIdx >= 0) && ((allRecordings[bestLenIdx].titleSim >= 0.7) || (isCD)))
                                            bestIdx = bestLenIdx;
                                        else {
                                            if ((bestSim * 100 < replaceLimit) && (title || artist)) {
                                                _this.setTrackState(searchManager, origTrack, AT_STATE_FAILED);
                                                resolve();
                                                return;
                                            }
                                        }

                                        var parseFinderprintedAlbums = function (allRecordings) {
                                            //app.filesystem.saveTextToFileAsync('data.json', JSON.stringify(allRecordings));
                                            usedRecordingIdx = getBestRecordingIndex(newRec, allRecordings);

                                            getOfficialReleaseGroupsDate(allRecordings[usedRecordingIdx]).then(function () {
                                                if (searchManager.isCanceled()) {
                                                    resolve(false);
                                                    return;
                                                }
                                                newRec.locatedTrack.recording = allRecordings[usedRecordingIdx].id;
                                                newRec.locatedTrack.length = allRecordings[usedRecordingIdx].duration;
                                                newRec.locatedTrack.title = allRecordings[usedRecordingIdx].title;
                                                if (allRecordings[usedRecordingIdx].artists) {
                                                    for (var i = 0; i < allRecordings[usedRecordingIdx].artists.length; i++) {
                                                        newRec.locatedTrack['artist-credit'].push({
                                                            artist: {
                                                                name: allRecordings[usedRecordingIdx].artists[i].name
                                                            }
                                                        });
                                                    }
                                                }

                                                var ar = [];
                                                ar.push(_this.getRecordingInfo(newRec.locatedTrack.recording, newRec.track.path).then(function (data) {
                                                    if (data) {
                                                        if (data.genre !== '')
                                                            newRec.locatedTrack.genre = data.genre;
                                                    }
                                                }));

                                                // get correct release group .. browse all recordings (prefer current) and find release group without any secondarytypes (where Compilation etc. can be)
                                                var releaseGroup = getBestReleaseGroupIndex(newRec, allRecordings);
                                                if (releaseGroup) {
                                                    applyReleaseGroup(releaseGroup, newRec, true);
                                                    ar.push(getReleaseGroupDetails(releaseGroup, newRec));

                                                    searchManager.setTrackLinks(track.path, [{
                                                        linkType: _this.lookupSource,
                                                        info: 'releaseGroup',
                                                        link: releaseGroup.id
                                                    }]);
                                                }

                                                _this.setTrackState(searchManager, origTrack, AT_STATE_LOCATED);
                                                founds.push(newRec);
                                                resolve(newRec);
                                            });
                                        }

                                        var doSearchTrack = function (idx) {
                                            var locateTrack = track.track.getTemporaryCopy();

                                            locateTrack.title = allRecordings[idx].title;
                                            locateTrack.artist = _this.getArtistText(allRecordings[idx].artists)

                                            if (_this.debug) {
                                                ODS('Fingerprint detected track ' + track.track.path + ' as a ' + locateTrack.title + ' by ' + locateTrack.artist);
                                            }

                                            var groups = allRecordings[idx].releasegroups;
                                            if (groups) {

                                                var preferAlbums = searchManager.preferAlbums();
                                                groups.sort(function (item1, item2) {
                                                    if (preferAlbums) {
                                                        // prefer albums and then single
                                                        if (_this.isSingle(item1))
                                                            return 1;
                                                        if (_this.isSingle(item2))
                                                            return -1;
                                                    }
                                                    return 0;
                                                });

                                                var used = false;
                                                for (var i = 0; i < groups.length; i++) {
                                                    if (_this.isOfficialAlbumOrSingle(groups[i])) {
                                                        used = true;
                                                        locateTrack.album = groups[i].title;
                                                        locateTrack.releaseGroup = groups[i].id;
                                                        var aartists = _this.getArtistText(groups[i].artists);
                                                        if (aartists) {
                                                            locateTrack.albumArtist = aartists;
                                                        }
                                                        break;
                                                    }
                                                }
                                                // #17683
                                                if (!used && groups.length && !searchManager.avoidCompilations()) {
                                                    locateTrack.album = groups[0].title;
                                                    var aartists = _this.getArtistText(groups[0].artists);
                                                    if (aartists) {
                                                        locateTrack.albumArtist = aartists;
                                                    }
                                                }
                                            }

                                            _this.searchTrack(searchManager, locateTrack).then(function (loc) {
                                                if (loc) {
                                                    newRec.locatedTrack = loc;
                                                    founds.push(newRec);
                                                    resolve(newRec);
                                                } else {
                                                    // try to get album info and find the track in there
                                                    if (locateTrack.releaseGroup) {
                                                        _this._processTrackReleaseGroup(track.track, locateTrack, locateTrack.releaseGroup, '', '').then((data) => {
                                                            newRec.locatedTrack = locateTrack;
                                                            founds.push(newRec);
                                                            resolve(newRec);
                                                        });
                                                    } else {
                                                        getRecordings(true).then(function (allRecordings) {
                                                            parseFinderprintedAlbums(allRecordings);
                                                        });
                                                    }
                                                }
                                            });
                                        };

                                        if (!allRecordings[bestIdx].title || !allRecordings[bestIdx].artists) {
                                            musicBrainz.getRecordingInfo(_this.uniqueID, allRecordings[bestIdx].id).then(function (data) {
                                                if (!_this.isError(searchManager, data) && data && data.recordings && data.recordings.length) {
                                                    allRecordings[bestIdx].title = data.recordings[0].title;
                                                    allRecordings[bestIdx].artists = data.recordings[0]['artist-credit'];
                                                }
                                                doSearchTrack(bestIdx);
                                            });
                                        } else {
                                            doSearchTrack(bestIdx);
                                        }
                                    } else
                                        resolve(newRec);
                                });
                            } else {
                                _this.setTrackState(searchManager, origTrack, AT_STATE_FAILED);
                                resolve(newRec);
                            }
                        });
                    };

                    handleRecordings().then(function (newRec) {
                        resolved(newRec);
                    });
                });
            }


            /*var processSingleFile = function (idx) {
                if (idx < fingerprints.length) {
                    var track = fingerprints[idx];
                    getFingerprintData(track).then1(function () {
                        processSingleFile(++idx);
                    });
                } else {
                    whenAll(ar).then(function () {
                        resolve(founds);
                    });
                }
            }
            processSingleFile(0);*/

            // allow fingerprint and process more that one track at once
            var all = [];

            for (var i = 0; i < fingerprints.length; i++) {
                var track = fingerprints[i];
                all.push(getFingerprintData(track));
            }
            whenAll(all).then(function () {
                whenAll(ar).then(function () {
                    resolve(founds);
                });
            });


        });
    },

    _assignAlbumData: function (track, locatedObj, releaseObj) {

        if (typeof releaseObj === 'object') {
            if (releaseObj['artist-credit'] && releaseObj['artist-credit'].length) {
                var art = this.getArtistText(releaseObj['artist-credit']);
                locatedObj.albumArtist = art;
                if (!locatedObj['artist-credit'] || !locatedObj['artist-credit'].length) {
                    locatedObj['artist-credit'] = releaseObj['artist-credit'];
                    locatedObj.artist = art;
                }
            }
            locatedObj.album = releaseObj.title;
            if (releaseObj.date !== undefined)
                locatedObj.date = app.utils.myDecodeDate(releaseObj.date);
            if (releaseObj['first-release-date'] !== undefined) {
                locatedObj.originalDate = app.utils.myDecodeDate(releaseObj['first-release-date']);
                if ((releaseObj.date <= 0) && locatedObj.originalDate) {
                    locatedObj.date = locatedObj.originalDate;
                }
            }
        }
    },

    _assignRecording: function (track, locatedObj, mbTrackObj, releaseObj) {

        if (mbTrackObj.number !== undefined)
            locatedObj.number = mbTrackObj.number;
        else
            locatedObj.number = track.trackNumberInt;
        locatedObj.title = mbTrackObj.title;
        locatedObj.length = track.songLength;

        if (mbTrackObj.recording) {
            if (typeof mbTrackObj.recording === 'object') {
                locatedObj.recording = mbTrackObj.recording.id;
                musicBrainz.browseRelations(locatedObj, mbTrackObj.recording.relations);
            } else {
                locatedObj.recording = mbTrackObj.recording;
            }
        }

        if (releaseObj) {
            this._assignAlbumData(track, locatedObj, releaseObj);
            if (typeof releaseObj === 'object')
                locatedObj.release = releaseObj.id;
            else
                locatedObj.release = releaseObj;
        }

        this.setTrackState(null, track, AT_STATE_LOCATED);
    },

    _locateTrack: function (track, locatedObj, tracks, data, recording) {
        var _this = this;

        var compareTrack = function (title, trackTitle, trackNumber, trackLength) {

            if (((app.utils.stringSimilarity(title, trackTitle, false) >= 0.7) ||
                    ((track.trackNumberStr === trackNumber) && (Math.abs(parseInt(track.songLength / 100) - parseInt(trackLength / 100)) < 2))) ||

                ((app.utils.stringSimilarity(title, trackTitle, false) >= 0.5) &&
                    (Math.abs(parseInt(track.songLength / 100) - parseInt(trackLength / 100)) < 2))) {
                return true;
            }

            return false;

        }

        for (var i = tracks.length - 1; i >= 0; i--) {
            if (recording !== '') {
                if (tracks[i].recording) {
                    var locatedRecording = tracks[i].recording;
                    if (typeof locatedRecording === 'object')
                        locatedRecording = locatedRecording.id;

                    if ((locatedRecording === recording) || 
                        (app.utils.stringSimilarity(track.title, tracks[i].title, false) >= 0.9)) {
                        _this._assignRecording(track, locatedObj, tracks[i], data.release);
                        return true;
                    }
                }
            } else { // use track name/length to detect
                if (compareTrack(track.title, tracks[i].title, tracks[i].number, tracks[i].length)) {
                    _this._assignRecording(track, locatedObj, tracks[i], data.release);
                    return true;
                }

                // try to detect using length
                if (compareTrack(_this._removeBrackets(track.title), _this._removeBrackets(tracks[i].title), tracks[i].number, tracks[i].length)) {
                    _this._assignRecording(track, locatedObj, tracks[i], data.release);
                    return true;
                }
            }
        }
        return false;
    },

    _processTrackReleaseGroup: function (track, locatedObj, releaseGroup, release, recording) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            if (/*(releaseGroup === '') &&*/ (release !== '')) { // prefer release if defined
                _this._processTrackRelease(track, locatedObj, release, recording).then(function (data) {
                    resolve();
                });
            } else {
                musicBrainz.getReleaseGroupInfo(_this.uniqueID, releaseGroup, false, /* fast */ ).then(function (data) {

                    if (!searchManager) { // LS: window has been already cleaned up (A14ACCF3)
                        resolve();
                        return;
                    }

                    var located = false;
                    if (!_this.isError(searchManager, data) && data && data.media && data.media.length) {
                        _this._assignAlbumData(track, locatedObj, data);
                        for (var i = 0; i < data.media.length; i++) {
                            if (_this._locateTrack(track, locatedObj, data.media[i].tracks, data.media[i], recording)) {
                                if (locatedObj.number && (typeof locatedObj.number == 'number') && (data.media.length > 1 /*more than one disc*/)) {
                                    locatedObj.number = String.fromCharCode(i+1+64) + locatedObj.number;
                                }
                                //_this._assignAlbumData(track, locatedObj, data);
                                located = true;
                                break;
                            }
                        }
                    }

                    if (!located && recording) {
                        _this._processTrackRecording(track, locatedObj, recording).then(function () {
                            resolve();
                        });
                    } else
                        resolve();
                });
            }
        });
    },

    _processTrackRelease: function (track, locatedObj, release, recording) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            if (release === '') {
                _this._processTrackRecording(track, locatedObj, recording).then(function (data) {
                    resolve();
                });
            } else {
                musicBrainz.getReleaseInfo(_this.uniqueID, release, false, false).then(function (data) {
                    if (!_this.isError(searchManager, data) && data && data.release) {
                        // check if we have recording we can use
                        let found = false;
                        if (data.release.media && data.release.media.length) {
                            for (let i = 0; i < data.release.media.length; i++) {                        
                                if (data.release.media[i].tracks && data.release.media[i].tracks.length) {
                                    if (_this._locateTrack(track, locatedObj, data.release.media[i].tracks, data, recording)) {
                                        found = true;
                                        if (locatedObj.number && /*(typeof locatedObj.number == 'number') &&*/ (data.release.media.length > 1 /*more than one disc*/)) 
                                            locatedObj.number = String.fromCharCode(i+1+64) + locatedObj.number;
                                        
                                        break;
                                    }
                                }
                            }
                            if (!found)
                                _this._locateTrack(track, locatedObj, data.release.media[0].tracks, data, '');                            
                        }
                    }

                    resolve();
                });
            }
        });
    },

    _processTrackRecording: function (track, locatedObj, recording) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            if (recording === '') {
                resolve();
            } else {
                musicBrainz.getRecording(_this.uniqueID, recording).then(function (data) {

                    resolve();
                });
            }
        });
    },

    checkExistingLinks: function (searchManager, list) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var ar = [];
            var links = [];
            list.locked(function () {
                for (var i = 0; i < list.count; i++) {
                    var l = list.getValue(i).getLinksList(LINK_MUSICBRAINZ);
                    links.push(l);
                    ar.push(l.whenLoaded());
                }
            });

            whenAll(ar).then(function () {
                // all links are loaded ... all tracks assigned release/releaseGroup or recording will be filled now (and removed from search process)
                var process = [];
                var results = [];

                list.locked(function () {
                    links.forEach(function (linksList, idx) {
                        // check for recording link
                        var releaseGroup = '';
                        var release = '';
                        var recording = '';

                        linksList.locked(function () {
                            for (var i = 0; i < linksList.count; i++) {
                                var link = linksList.getValue(i);
                                if (link.linkInfo === 'release')
                                    release = link.link;
                                if (link.linkInfo === 'releaseGroup')
                                    releaseGroup = link.link;
                                if (link.linkInfo === 'recording')
                                    recording = link.link;
                            }
                        });
                        if (!!releaseGroup || !!release || !!recording) {
                            var loc = _this.createLocatedTrack();

                            results.push(loc);
                            process.push(_this._processTrackReleaseGroup(list.getValue(idx), loc, releaseGroup, release, recording));
                        }
                    });
                });

                whenAll(process).then(function () {
                    // check all tracks are processed or not
                    var founds = [];
                    list.locked(function () {
                        var track;
                        for (var i = 0; i < list.count; i++) {
                            track = list.getFastObject(i, track);
                            if (track.autoTagState !== AT_STATE_IN_PROCESS) {
                                founds.push({
                                    track: list.getValue(i),
                                    locatedTrack: results[i]
                                });
                                break;
                            }
                        }
                    });
                    resolve(founds);
                });
            });
        });
    },

    searchByAlbum: function (searchManager, list, data) {
        var _this = this;
        return new Promise(function (resolve, reject) {

            var tracks = list || searchManager.getTracks();

            // get tracks lengths and compare with releases we've got from server
            var lengths = [];
            var ids = [];
            var founds = [];
            var ar = [];
            var release = undefined;
            var proposedYear = 0;

            tracks.locked(function () {
                for (var i = 0; i < tracks.count; i++) {
                    var track = tracks.getValue(i);
                    _this.guessTrack(track);

                    if ((track.year >= 0) && (proposedYear < track.year))
                        proposedYear = track.year;

                    // first check this track is duplicate of another track (has same length and very similar title ... 0.9 or more)
                    var isDup = false;
                    var len = parseInt(track.songLength / 1000);
                    var title = track.title;
                    for (var j = 0; j < lengths.length; j++) {
                        if (lengths[j].len === len) {
                            if (app.utils.stringSimilarity(title, lengths[j].title, false) > 0.9) {
                                lengths[j].dupTracks.push(track);
                                isDup = true;
                                break;
                            }
                        }
                    }

                    if (!isDup) {
                        lengths.push({
                            len: len,
                            track: track,
                            title: title,
                            dupTracks: [],
                            trackNum: track.trackNumberInt
                        });
                    }
                }
            });
            var tracksCount = lengths.length;
            var origTracksCount = tracks.count;

            var processReleaseGroupData = function (data) {
                return new Promise(function (innerResolve) {
                    var releaseGroup = data.id;
                    var album = data._lookForAlbum.toUpperCase();
                    //data._lookForAlbumArtist;

                    var firstReleaseDate = app.utils.myDecodeDate(data['first-release-date']);
                    var albumArtist = _this.getArtistText(data['artist-credit']);

                    var handleRelations = function (mbTrack, release) {
                        var fields = searchManager.getFieldsToUpdate(true);
                        if (fields.involvedPeople || fields.writer || fields.publisher) {
                            // we need to load additional data for release
                            ar.push(musicBrainz.getReleaseInfo(this.uniqueID, release.id, false, true).then(function (res) {
                                if (res && res.release && res.release.relations) {
                                    musicBrainz.browseRelations(mbTrack, res.release.relations);
                                }
                            }));
                        }
                    }.bind(this);


                    // sort releases so first are releases with same or similar name
                    data.releases.sort(function (item1, item2) {
                        var item1Up = item1.title.toUpperCase();
                        if (item1Up === album) {
                            if (item2.title.toUpperCase() === album) {
                                // first prefer single CD
                                if (item1.media && item2.media && item1.media.length !== item2.media.length)
                                    return item1.media.length - item2.media.length;
                                // check also numbers ... when there's 'A1' or so it means multi-disc
                                if (item1.media && item1.media.length && item1.media[0].tracks.length) {
                                    var num = item1.media[0].tracks[0].number;
                                    if (num) {
                                        var firstCharNum = num.charCodeAt(0);
                                        if ((firstCharNum >= 65) && (num.charCodeAt(1) < 65)) { // probably starts with 'A' etc.
                                            return 1;
                                        }
                                    }
                                }
                                if (item2.media && item2.media.length && item2.media[0].tracks.length) {
                                    var num = item2.media[0].tracks[0].number;
                                    if (num) {
                                        var firstCharNum = num.charCodeAt(0);
                                        if ((firstCharNum >= 65) && (num.charCodeAt(1) < 65)) { // probably starts with 'A' etc.
                                            return -1;
                                        }
                                    }
                                }


                                // same album names ... sort by media tracks
                                if (item1.media && item1.media.length && item2.media && item2.media.length) {
                                    if (item1.media[0].tracks.length == origTracksCount)
                                        return -1;
                                    if (item2.media[0].tracks.length == origTracksCount)
                                        return 1;
                                    return item1.media[0].tracks.length - item2.media[0].tracks.length;
                                }
                            }
                            return -1;
                        }
                        var item2Up = item2.title.toUpperCase();
                        if (item2Up === album)
                            return 1;
                        return 0;
                    });

                    var leave = false;
                    var avoidCompilations = searchManager.avoidCompilations();
                    if (avoidCompilations)
                        if (!_this.isOfficialAlbumOrSingle(data))
                            leave = true;

                    if (!leave) {

                        var useReleaseOnTrack = function (mbTrack, track, release) {

                            var finish = function (item) {
                                mbTrack.album = release.title;
                                if (albumArtist)
                                    mbTrack.albumArtist = albumArtist;

                                handleRelations(mbTrack, release);

                                founds.push({
                                    track: item,
                                    locatedTrack: mbTrack
                                });
                                mbTrack._paired = true;
                                mbTrack.release = release.id;
                                mbTrack.releaseGroup = releaseGroup;
                                mbTrack.date = release._mmdate;
                                mbTrack._mmdate = release._mmdate;
                                mbTrack._mmyear = release._mmyear;
                                _this.addTrackLookup(searchManager, item.path, mbTrack);
                            }

                            finish(track.track);
                        };

                        var processRelease = function (release) {
                            var totalTracks = 0;
                            var mediaTrackNumbers = null;

                            var medias = release.media;
                            // compute total # of tracks in release
                            if (medias && medias.length) {
                                for (var j = 0; j < medias.length; j++) {
                                    if (medias[j].tracks) {
                                        totalTracks += medias[j].tracks.length;
                                    } else {
                                        ODS('AutoTagFramework - searchMusicbrainz - searchByAlbum - release ' + release.title + '(' + release.id + ') - media ' + j + ' tracks not found !');
                                    }
                                }
                            }

                            var clearReleaseScore = function () {
                                release._proposedScore = 0;
                                release._pairedTracks = [];
                            }

                            clearReleaseScore();
                            if (totalTracks >= tracksCount) { // ignore release with less tracks than scanned
                                var localLengths = lengths.slice(0);

                                var fixTrackNumber = function (number) {
                                    var num = number;
                                    if (num && typeof num === 'string') {
                                        var firstCharNum = num.charCodeAt(0);
                                        if ((firstCharNum >= 65) && (num.charCodeAt(1) < 65)) { // probably starts with 'A' etc.
                                            num = parseInt(num.substring(1));
                                            if (firstCharNum > 65) {
                                                if (!mediaTrackNumbers) {
                                                    mediaTrackNumbers = {};
                                                    for (var m = 0; m < medias.length; m++) {
                                                        for (var t = 0; t < medias[m].tracks.length; t++) {
                                                            var n = medias[m].tracks[t].number;
                                                            if (n && typeof n == 'string') {
                                                                var frst = n.charCodeAt(0);
                                                                if ((frst >= 65) && (n.charCodeAt(1) < 65)) {
                                                                    n = parseInt(n.substring(1));
                                                                    mediaTrackNumbers[frst] = mediaTrackNumbers[frst] || 0;
                                                                    mediaTrackNumbers[frst] = Math.max(mediaTrackNumbers[frst], n);
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                                for (var i = 65; i < firstCharNum; i++)
                                                    num += mediaTrackNumbers[i];
                                            }
                                        } else
                                        if ((firstCharNum >= 65) && (num.length == 1)) { // probably single LP with sides A and B
                                            num = (firstCharNum - 65) + 1;
                                        }
                                    }
                                    return num;
                                }

                                var getTrackByLength = function (len) { // get time (+- 2secs)
                                    var searchLength = function (l) {
                                        for (var m = 0; m < medias.length; m++) {
                                            for (var t = 0; t < medias[m].tracks.length; t++) {
                                                var mbTrack = medias[m].tracks[t];
                                                var len = parseInt(mbTrack.length / 1000);
                                                if ((len >= l - 2) && (len <= l + 2) && (!mbTrack._paired)) {
                                                    release._proposedScore += 1;
                                                    return mbTrack;
                                                }
                                            }
                                        }
                                        return null;
                                    }

                                    var mbTrack = searchLength(len);
                                    if (mbTrack)
                                        return mbTrack;
                                    return null;
                                };

                                var getTrackByNumberAndLength = function (discNum, trackNum, l, title) {
                                    for (var m = 0; m < medias.length; m++) {
                                        for (var t = 0; t < medias[m].tracks.length; t++) {
                                            var mbTrack = medias[m].tracks[t];
                                            if ((mbTrack.number == trackNum) || (fixTrackNumber(mbTrack.number) == trackNum)) {
                                                release._proposedScore += 1;
                                                var len = parseInt(mbTrack.length / 1000);
                                                if ((((len >= l - 2) && (len <= l + 2)) || (app.utils.stringSimilarity(title, mbTrack.title, false) > 0.9)) && (!mbTrack._paired)) {
                                                    release._proposedScore += 1;
                                                    mbTrack._paired = true;
                                                    return mbTrack;
                                                }
                                            }
                                        }
                                    }
                                    return null;
                                }

                                var getTrackByNumber = function (discNum, trackNum) {
                                    for (var m = 0; m < medias.length; m++) {
                                        for (var t = 0; t < medias[m].tracks.length; t++) {
                                            var mbTrack = medias[m].tracks[t];
                                            if (mbTrack.number == trackNum) {
                                                release._proposedScore += 1;
                                                return mbTrack;
                                            }
                                        }
                                    }
                                    return null;
                                }

                                var getTrackByTitle = function (title, trackLen) {
                                    var maxSim = 0;
                                    var ret = null;
                                    var limit = 0.9;
                                    if (trackLen !== undefined)
                                        limit = 0.8;
                                    for (var m = 0; m < medias.length; m++) {
                                        for (var t = 0; t < medias[m].tracks.length; t++) {
                                            var mbTrack = medias[m].tracks[t];
                                            var sim = app.utils.stringSimilarity(title, mbTrack.title, false);

                                            if ((trackLen !== undefined) && (sim < 0.9)) {
                                                var len = parseInt(mbTrack.length / 1000);
                                                if ((len >= trackLen - 2) && (len <= trackLen + 2) && (!mbTrack._paired)) {
                                                    sim += 0.1;
                                                }
                                            }

                                            if ((sim > limit) && (sim > maxSim)) {
                                                maxSim = sim;
                                                ret = mbTrack;
                                            }
                                        }
                                    }
                                    return ret;
                                }

                                var artistMatch = function (track, mbTrack) {
                                    var mbArtist = _this.getArtistText(mbTrack['artist-credit']);
                                    if (mbArtist) {
                                        var mbArtists = mbArtist.toLowerCase().split(';');
                                        var trackArtists = track.track.artist.toLowerCase().split(';');

                                        for (var i = 0; i < trackArtists.length; i++) {
                                            if (mbArtists.indexOf(trackArtists[i]) >= 0) {
                                                return true;
                                            }
                                        }
                                        return false;
                                    }
                                    return true;
                                }

                                // browse release and compare track# or track length
                                var usedTracks = [];
                                tracks.locked(function () {

                                    var addTrackMatch = function (mbTrack, track, idx) {

                                        var finish = function (item) {
                                            /*mbTrack.album = release.title;
                                            if (albumArtist)
                                                mbTrack.albumArtist = albumArtist;

                                            handleRelations(mbTrack, release);

                                            founds.push({
                                                track: item,
                                                locatedTrack: mbTrack
                                            });
                                            mbTrack._paired = true;
                                            mbTrack.release = release.id;
                                            mbTrack.releaseGroup = releaseGroup;
                                            _this.addTrackLookup(searchManager, item.path, mbTrack);*/
                                            usedTracks.push(mbTrack);

                                            release._pairedTracks.push({
                                                track: track,
                                                mbTrack: mbTrack
                                            });
                                            release._proposedScore += 20;
                                        }

                                        finish(track.track);
                                        for (var i = 0; i < track.dupTracks.length; i++) {
                                            finish(track.dupTracks[i]);
                                        }

                                        if (idx !== undefined)
                                            localLengths[idx] = 0;

                                    };

                                    var roundByLength = function () {
                                        for (var i = 0; i < localLengths.length; i++) {
                                            if (localLengths[i]) {
                                                var track = localLengths[i];
                                                var mbTrack = getTrackByNumberAndLength(track.track.discNumberInt, track.track.trackNumberInt, track.len, track.track.title);
                                                if (mbTrack) {
                                                    addTrackMatch(mbTrack, track);
                                                }
                                            }
                                        }
                                    }

                                    var round = function (second) {

                                        for (var m = 0; m < medias.length; m++) {
                                            for (var t = 0; t < medias[m].tracks.length; t++) {
                                                var mbTrack = medias[m].tracks[t];
                                                mbTrack._paired = undefined;
                                            }
                                        }

                                        for (var i = 0; i < localLengths.length; i++) {
                                            if (localLengths[i]) {
                                                var track = localLengths[i];
                                                var mbTrack = getTrackByTitle(track.track.title, track.len);
                                                if (!mbTrack && second) {
                                                    mbTrack = getTrackByLength(track.len);
                                                    if (mbTrack && (usedTracks.indexOf(mbTrack) >= 0)) {
                                                        // track was already used!!
                                                        mbTrack = null;
                                                    }
                                                }
                                                /*if (!mbTrack) {
                                                    mbTrack = getTrackByNumber(track.track.discNumberInt, track.track.trackNumberInt);
                                                }*/
                                                if ((mbTrack) && artistMatch(track, mbTrack)) {
                                                    addTrackMatch(mbTrack, track, i);
                                                }
                                            }
                                        }
                                    }

                                    // first try to pair tracks by it's length and track #
                                    clearReleaseScore();
                                    roundByLength();

                                    if (usedTracks.length !== origTracksCount) { // not all tracks were paired
                                        //founds = [];
                                        usedTracks = [];
                                        clearReleaseScore();

                                        round(false);
                                        if (usedTracks.length !== origTracksCount) { // not all tracks were paired
                                            clearReleaseScore();
                                            round(true);
                                        }
                                    }

                                }.bind(this));

                                /*if (usedTracks.length >= (origTracksCount / 2)) { // we've found all tracks!!
                                    for (var i = 0; i < usedTracks.length; i++) {
                                        usedTracks[i].__usedRelease = release;
                                    }
                                    return true;
                                } else
                                    usedTracks = [];*/
                            }
                        }


                        var storeReleaseDate = function (release) {
                            var releaseDate = _this.fixDate(release.date, _this.isOfficialAlbumOrSingle(release));
                            release._mmdate = parseInt(app.utils.myDecodeDate(releaseDate));
                            release._mmyear = _this.getYear(release._mmdate);
                        }

                        var applyYearScore = function (release) {
                            if (proposedYear === release._mmyear) {
                                release._proposedScore += 100;
                            } else {
                                release._proposedScore += 2020 - release._mmyear;
                            }
                        }

                        var getReleaseDetail = function (release) {
                            adepts.push(musicBrainz.getReleaseInfo(this.uniqueID, release.id, false, true).then(function (res) {
                                if (res && res.release) {
                                    release.date = res.release.date;
                                    storeReleaseDate(release);
                                    applyYearScore(release);
                                }
                            }));
                        }

                        var adepts = [];
                        for (var i = 0; i < data.releases.length; i++) {
                            founds = [];
                            release = data.releases[i];

                            storeReleaseDate(release);

                            if (avoidCompilations)
                                if (!_this.isOfficialAlbumOrSingle(release))
                                    continue;

                            processRelease(release);

                            if (release._mmyear <= 0) {
                                if (release._pairedTracks.length === origTracksCount) { // get release info only when all tracks were paired
                                    getReleaseDetail(release);
                                }
                            } else {
                                applyYearScore(release);
                            }
                        }

                        whenAll(adepts).then(function () {
                            // sort releases by score and use release with biggest score
                            data.releases.sort(function (item1, item2) {
                                return item2._proposedScore - item1._proposedScore;
                            });

                            if (_this.debug) {
                                ODS('Proposed releases for album ' + album);
                            }
                            for (var i = 0; i < data.releases.length; i++) {
                                founds = [];
                                release = data.releases[i];

                                if (!release.date && data['first-release-date']) {
                                    release.date = data['first-release-date'];
                                    release._mmdate = parseInt(app.utils.myDecodeDate(release.date));
                                    release._mmyear = _this.getYear(release._mmdate);
                                }

                                if (_this.debug) {
                                    ODS('Proposed release ' + release.title + ' with score ' + release._proposedScore + ': ' + JSON.stringify(release));
                                }

                                if (release._pairedTracks && (release._pairedTracks.length === origTracksCount)) {
                                    for (var j = 0; j < release._pairedTracks.length; j++)
                                        useReleaseOnTrack(release._pairedTracks[j].mbTrack, release._pairedTracks[j].track, release);

                                    break;
                                }
                            }

                            whenAll(ar).then(function () {
                                if (founds.length)
                                    innerResolve(founds);
                                else
                                    innerResolve(false);
                            });

                        });

                    } else
                        innerResolve(false);

                });

            }.bind(this);

            data.sort(function (item1, item2) {
                if (!item1._mmdate && item1['first-release-date']) {
                    var releaseDate = _this.fixDate(item1['first-release-date'], true);
                    item1._mmdate = parseInt(app.utils.myDecodeDate(releaseDate));
                }
                if (!item2._mmdate && item2['first-release-date']) {
                    var releaseDate = _this.fixDate(item2['first-release-date'], true);
                    item2._mmdate = parseInt(app.utils.myDecodeDate(releaseDate));
                }
                if (!item1._mmdate)
                    return 1;
                if (!item2._mmdate)
                    return -1;

                return item1._mmdate - item2._mmdate;
            });

            var run = function (idx) {
                if (idx < data.length) {
                    data[idx]._lookForAlbum = data._lookForAlbum;
                    data[idx]._lookForAlbumArtist = data._lookForAlbumArtist;

                    processReleaseGroupData(data[idx]).then(function (founds) {
                        if (founds) {
                            resolve(founds);
                        } else
                            run(++idx);
                    });
                } else
                    resolve(false);
            }

            run(0);

        });
    },

    searchByTracks: function (searchManager, list) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            if (list.count) {

                if (!searchManager.isRunning())
                    searchManager.notifyProgress(0, 0);
                var ar = [];

                var processTrack = function (track) {
                    return new Promise(function (resolve) {
                        _this._searchTrackByTitle(searchManager, track, true).then(function (allAlbums) {
                            resolve(allAlbums);
                        });
                    });
                }

                var browseTracks = function (idx) {
                    if (list.count > idx) {
                        list.locked(function () {
                            var track = list.getValue(idx);
                            processTrack(track).then(function (albums) {
                                ar = ar.concat(albums);
                                browseTracks(++idx);
                            });
                        });
                    } else
                        resolve(ar);
                };
                browseTracks(0);

            } else
                resolve(false);
        });
    },

    getArtwork: function (searchManager, founds, list) {
        let _this = this;
        return new Promise(function (resolve_getArtwork, reject_getArtwork) {

            let tracklist = list || searchManager.getTracks();
            let tracks;

            let loadLyrics = _this.checkLyricsLoad(searchManager, founds, tracklist, null);

            if (_this.checkArtworkLoad(searchManager, founds, tracklist, null)) {

                let searchCommonArtwork = function () {
                    return new Promise(function (resolve, reject) {
                        _this.getCommonArtwork(searchManager, tracks).then(resolve, reject);
                    });
                };

                let processImages = function (images, title, checkRelease) {
                    // get first front cover (approved first)
                    let getImage = function (approved) {
                        for (let i = 0; i < images.length; i++) {
                            if ((!approved || images[i].approved) && images[i].front) {
                                return images[i].image;
                            }
                        }
                        return '';
                    }
                    let url = getImage(true);

                    if (!url)
                        url = getImage(false);

                    if (!url && images.length)
                        url = images[0].image;

                    return _this.useArtwork(searchManager, title, tracks, url, checkRelease);
                }
                let processRelations = function(relArr, title) {
                    return new Promise(async function (resolve, reject) {
                        let rel;
                        for(let i=0; i<relArr.length;i++) {
                            rel = relArr[i];
                            if((rel.type === 'discogs') && rel.url && rel.url.resource) {
                                try {
                                    let dimg = await discogs.fetchMasterImageFromURL(_this.uniqueID, rel.url.resource);
                                    if(dimg && dimg.imglink) {
                                        await _this.useArtwork(searchManager, title, tracks, {url: dimg.imglink, source:'Discogs', sourceUrl: _utils.cleanAndValidateURL(dimg.sourcelink)});
                                        resolve(true);
                                        break;
                                    }
                                } catch(e) {

                                }
                            }
                        }
                        if(reject)
                            reject();
                    });
                };

                let processRelease = function (id, title) {
                    return new Promise(function (resolve, reject) {
                        musicBrainz.getReleaseCovers(_this.uniqueID, id).then(function (images) {
                            if (images) {
                                processImages(images, title).then(function () {
                                    resolve(true);
                                }, reject);
                            } else {
                                searchCommonArtwork().then(resolve, reject);
                            }
                        }, reject);
                    });
                };

                let processReleaseGroup = function (id, title) {
                    return new Promise(async function (resolve, reject) {
                        let succ = false;
                        try {
                            let data = await musicBrainz.getReleaseGroupCover(_this.uniqueID, id);
                            if (data && data.images) {
                                await processImages(data.images, title, true).then(function () {
                                    resolve(true);
                                    succ = true;
                                });
                            };
                        } catch(e) {
                            succ = false;
                        }
                        if(succ)
                            return;
                        try {
                            let relArr = await musicBrainz.getReleaseGroupRelations(_this.uniqueID, id);
                            if(relArr && isArray(relArr)) {
                                await processRelations(relArr, title).then(function() {
                                    succ = true;
                                    resolve();
                                });
                            }
                        } catch(e) {
                            succ = false;
                        }
                        if(succ)
                            return;
                        try {
                            let data = await musicBrainz.getReleases(_this.uniqueID, id, false);
                            if (data && data.length) {
                                succ = true; // searhCommonArtwork called already from processRelease
                                await processRelease(data[0].mbgid, title).then(resolve);
                            };
                        } catch(e) {
                            succ = false;
                        };
                        if(succ)
                            return;
                        searchCommonArtwork().then1(function () {
                            resolve();
                        });
                    });
                };

                if (founds.length && (founds[0].__usedRelease || founds[0].locatedTrack.release || founds[0].locatedTrack.releaseGroup)) {

                    tracks = tracklist.getCopy();

                    if (tracklist.count) {
                        if (founds[0].__usedRelease && (founds[0].__usedRelease.id === founds[0].locatedTrack.release)) {

                            var title = founds[0].locatedTrack.album;
                            var release = founds[0].locatedTrack.release;

                            if ((release === founds[0].locatedTrack.release) && (founds[0].locatedTrack.releaseGroup)) {
                                processReleaseGroup(founds[0].locatedTrack.releaseGroup, title).then1(function (done) {
                                    resolve_getArtwork();
                                });
                            } else {
                                processRelease(release, title).then1(function (done) {
                                    resolve_getArtwork();
                                });
                            }

                        } else {
                            if (!founds[0].__usedRelease) {
                                if (founds[0].locatedTrack.releaseGroup) {
                                    processReleaseGroup(founds[0].locatedTrack.releaseGroup, title).then1(function (done) {
                                        resolve_getArtwork();
                                    });
                                } else
                                if (founds[0].locatedTrack.release) {
                                    processRelease(founds[0].locatedTrack.release, founds[0].locatedTrack.title).then1(function (done) {
                                        resolve_getArtwork();
                                    });
                                } else {
                                    resolve_getArtwork();
                                }

                            } else {
                                processRelease(founds[0].__usedRelease.id, founds[0].__usedRelease.title).then1(function (done) {
                                    resolve_getArtwork();
                                });
                            }
                        }
                    } else {
                        searchCommonArtwork().then1(function () {
                            resolve_getArtwork();
                        });
                    }
                    return;

                } else {
                    if (tracklist && tracklist.count) { // try to find cover based on Album of the tracks

                        let processTrack = function (idx) {
                            if (searchManager.isCanceled()) {
                                resolve_getArtwork(false);
                                return;
                            }
                            if (idx < tracklist.count) {

                                let track;
                                let album = '';
                                let albumArtist = '';
                                let path = '';
                                let title = '';

                                tracklist.locked(function () {
                                    track = tracklist.getValue(idx);
                                    title = track.title;
                                    path = track.path;
                                    album = track.album;
                                    albumArtist = track.albumArtist;
                                    tracks = app.utils.createTracklist(true);
                                    tracks.add(track);
                                });

                                _this.setTrackState(searchManager, track, AT_STATE_LOADING_ARTWORK);
                                searchManager.artworkSearch(path, false);

                                let processByAlbumAndArtist = function (album, albumArtist) {
                                    return new Promise(function (resolve) {
                                        let ar = searchManager.getTrackLinks(path);
                                        if (ar) {
                                            ar.sort(function (item1, item2) {
                                                if (item1.release)
                                                    return -1;
                                                if (item2.release)
                                                    return 1;
                                                if (item1.releaseGroup)
                                                    return -1;
                                                if (item2.releaseGroup)
                                                    return 1;
                                                return 0;
                                            });
                                            for (let i = 0; i < ar.length; i++) {
                                                if (ar[i].linkType === _this.lookupSource) {
                                                    if (ar[i].info === 'release') {
                                                        processRelease(ar[i].link, album).then1(function () {
                                                            resolve();
                                                        });
                                                        return;
                                                    } else
                                                    if (ar[i].info === 'releaseGroup') {
                                                        processReleaseGroup(ar[i].link, album).then1(function () {
                                                            resolve();
                                                        });
                                                        return;
                                                    }
                                                }
                                            }
                                        }

                                        musicBrainz.findReleaseGroup(_this.uniqueID, {
                                            title: album,
                                            albumArtist: albumArtist
                                        }, true, false).then(function (data) {
                                            if (searchManager.isCanceled() || _this.isError(searchManager, data, 'album', album, albumArtist)) {
                                                resolve(false);
                                                return;
                                            }
                                            if (data && data.length) {
                                                let recIdx = 0;
                                                let maxSim = 0;

                                                data.forEach(function (rec, idx) {
                                                    if (rec.id && rec.title) {
                                                        let sim = app.utils.stringSimilarity(rec.title, album, false);
                                                        if (maxSim < sim) {
                                                            maxSim = sim;
                                                            recIdx = idx;
                                                        }
                                                    }
                                                });

                                                processReleaseGroup(data[recIdx].id, data[recIdx].title).then1(function () {
                                                    resolve();
                                                });
                                            } else
                                                searchCommonArtwork().then1(function () {
                                                    resolve();
                                                });
                                        });
                                    });
                                }

                                let finishTrack = function () {
                                    searchManager.artworkSearch(path, true);
                                    if (!loadLyrics)
                                        _this.setTrackState(searchManager, track, AT_STATE_DONE);
                                    processTrack(++idx);
                                }

                                if (album && albumArtist) {
                                    processByAlbumAndArtist(album, albumArtist).then(function () {
                                        if (!searchManager.isCanceled())
                                            finishTrack();
                                    });
                                } else
                                    searchCommonArtwork().then1(function () {
                                        if (!searchManager.isCanceled())
                                            finishTrack();
                                    });
                            } else
                                resolve_getArtwork();
                        }
                        processTrack(0);
                        return;
                    }
                }
                searchCommonArtwork().then1(function () {
                    resolve_getArtwork();
                });
            } else
                resolve_getArtwork();
        });
    },



});
