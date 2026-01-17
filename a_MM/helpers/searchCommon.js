/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

/* This file shouldn't be edited by user ! */
/* It's common script for all taggers ! */

requirejs('helpers/searchTools.js');

function inheritTagger(className, parentClass, methods, properties) {
    window.webTaggersClasses[className] = inherit(className, webTaggersClasses[parentClass], methods, properties);
    return new window.webTaggersClasses[className]();
}

window.webTaggersClasses = {};
window.webTaggersClasses.Common = function () {
    this.uniqueID = createUniqueID();
};
window.webTaggersClasses.Common.prototype = {
    lookupSource: '',
    sourceMultivalSeparator: ';',
    finishedNum: 0,
    trackStatus: [],
    trackStatusCounted: [],
    firstPassDone: [],
    _lyricsQueue: [],
    _lyricsSearchInProgress: false,
    albumTracksLimit: 1,


    cleanUp: function () {
        this.lookupSource = '';
        this.finishedNum = 0;
        this.trackStatus = [];
        this.trackStatusCounted = [];
        this.firstPassDone = [];
        this._lyricsQueue = [];
        this._lyricsSearchInProgress = false;
    },

    isError: function (searchManager, data) {
        return false;
    },

    normalizeMultivalue: function (searchManager, str) {
        // we're using ; as a separator internally
        if (this.sourceMultivalSeparator !== ';') {
            str = str.replaceAll(this.sourceMultivalSeparator, ';');
        }
        str = this.normalizeValue(searchManager, app.utils.normalizeMultipleString(str));
        return str;
    },

    normalizeValue: function (searchManager, str) {
        str = str.replaceAll('…', '...');
        return str;
    },

    acceptedTitle: function (title) {

        if (title) {
            // check track titles like 'TrackXXX' or 'TitleXXX' etc.
            var loTitle = title.toLowerCase();

            if (loTitle.startsWith('track')) {
                return false;
            }
            if (loTitle.startsWith('title')) {
                return false;
            }
        }
        return true;
    },

    _trackHandled: function (track) {
        return track.autoTagState >= AT_STATE_FAILED;
    },

    _removeBrackets: function (input) {
        if (input) {
            return input
                .replace(/{.*?}/g, "")
                .replace(/\[.*?\]/g, "")
                .replace(/<.*?>/g, "")
                .replace(/\(.*?\)/g, "")
                .trimStart()
                .trimEnd();
        } else
            return input;
    },

    notifyTrackFinished: function (searchManager, track) {
        var path = track.path;
        if ((this.trackStatus[path] === undefined) || (this.trackStatus[path] < AT_STATE_FAILED)) {
            if (this.trackStatusCounted[path] === undefined) {
                this.trackStatusCounted[path] = ++this.finishedNum;
            }
            this.trackStatus[path] = track.autoTagState;
            searchManager.notifyProgress(this.finishedNum, undefined, app.utils.getFilename(path));
        }
    },

    notifyTrackProgress: function (searchManager, track) {
        if (track) {
            var path = track.path;
            var state = track.autoTagState;
            if ((!this.firstPassDone[path]) && (state > AT_STATE_FIRSTPASS_DONE) && (state !== AT_STATE_FAILED)) {
                state = AT_STATE_FIRSTPASS_DONE;
                track.autoTagState = state;
            }
            if ((this.trackStatus[path] !== state) || (state === AT_STATE_LOADING_ARTWORK) || (state === AT_STATE_LOADING_LYRICS)) {

                if (state >= AT_STATE_FAILED)
                    this.notifyTrackFinished(searchManager, track);

                if (searchManager) {
                    searchManager.notifyTrackProgress(track, state);
                    if (state < AT_STATE_FAILED) {
                        var stateText = window.autoTagFramework.getStateText(state);
                        if (stateText)
                            searchManager.notifyProgress(this.finishedNum, undefined, app.utils.getFilename(path) + ' ' + _('Status') + ': ' + stateText);
                    }
                }

                this.trackStatus[path] = state;
            }
        }
    },

    setTrackState: function (searchManager, track, state) {
        track.autoTagState = state;
        this.notifyTrackProgress(searchManager, track);
    },

    setTracklistState: function (searchManager, tracks, state) {
        tracks.locked(() => {
            var track;
            for (var i = 0; i < tracks.count; i++) {
                track = tracks.getFastObject(i, track);
                this.setTrackState(searchManager, track, state);
            }
        });
    },

    isVariousArtist: function (artist) {
        if (artist) {
            if (!this._variousArtistsNames) {
                this._variousArtistsNames = [_('Various').toLowerCase(), _('Various Artists').toLowerCase(), 'various', 'various artists'];
            }
            return this._variousArtistsNames.indexOf(artist.toLowerCase()) >= 0;
        }
        return false;
    },

    checkArtworkLoad: function (searchManager, founds, list, item) {
        var isVideo = false;
        if (item && (item.isVideo !== undefined)) {
            isVideo = item.isVideo;
        } else if (founds && founds.length && founds[0].track) {
            isVideo = founds[0].track.isVideo;
        } else if (list && list.count) {
            list.locked(() => {
                isVideo = list.getValue(0).isVideo;
            });
        }

        var additionals = searchManager.addAdditional();
        return ((isVideo && additionals.addArtwork.video) ||
            (!isVideo && additionals.addArtwork.audio));
    },

    checkLyricsLoad: function (searchManager, founds, list, item) {

        var isVideo = false;
        if (item && (item.isVideo !== undefined)) {
            isVideo = item.isVideo;
        } else if (founds && founds.length) {
            isVideo = founds[0].track.isVideo;
        } else if (list && list.count) {
            list.locked(() => {
                if (list.count > 0) {
                    var itm = list.getValue(0);
                    if (itm && (itm.objectType === 'track'))
                        isVideo = itm.isVideo;
                }
            });
        }

        var searchFields = searchManager.getFieldsToUpdate(!isVideo);
        return searchFields.lyrics;
    },

    splitFeaturedArtists: function (artists) {
        var ret = [];
        var seps = [' feat ', ' Feat ', ' feat.', ' Feat.', ' ft ', ' Ft ', ' ft.', ' Ft.' /*, ' & '*/ ];
        artists = artists.replace('(', '').replace(')', '').replace('[', '').replace(']', '').replace('{', '').replace('}', '');

        for (var i = 0; i < seps.length; i++) {
            var lst = artists.split(seps[i]);
            if (lst.length > 1) {
                for (var j = 0; j < lst.length; j++) {
                    var value = lst[j].trimStart().trimEnd();
                    var ar = this.splitFeaturedArtists(value);
                    if (!ar || !ar.length)
                        ret.push(value);
                    else
                        ret = ret.concat(ar);
                }
            }
        }
        return ret;
    },

    guessTrack: function (track) {

        if (track.trackNumberInt <= 0) {
            // check track titles like 'TrackXXX' or 'TitleXXX' etc.
            var loTitle = track.title.toLowerCase();
            if (loTitle.startsWith('track')) {
                loTitle = loTitle.replace('track', '');
            }
            if (loTitle.startsWith('title')) {
                loTitle = loTitle.replace('title', '');
            }

            var num = parseInt(title);
            if (typeof num === 'number')
                track.trackNumberInt = num;
        }
    },

    getArtistText: function (artists) {
        var ret = '';
        if (artists) {
            var joinphrase = ';';
            for (var i = 0; i < artists.length; i++) {
                var artistText = '';

                if (typeof artists[i].artist === 'object') {
                    artistText = artists[i].artist.name;
                } else if (artists[i].name !== undefined) {
                    artistText = artists[i].name;
                } else if (typeof artists[i] === 'string') {
                    artistText = artists[i];
                }

                if (artistText) {
                    if (ret) {
                        ret += joinphrase;
                        joinphrase = ';';
                    }
                    ret += artistText;
                }

                /*if (artists[i].joinphrase !== undefined) {
                    joinphrase = artists[i].joinphrase;
                }*/
            }
        }
        return ret;

    },

    createLocatedTrack: function () {
        var loc = {
            number: '',
            title: '',
            'artist-credit': [],
            artist: '',
            album: '',
            albumArtist: '',
            genre: '',
            date: '',
            originalDate: '',
            length: '',
            involvedPeople: '',
            composer: '',
            lyricist: '',
            publisher: '',
            release: '',
            releaseGroup: null,
            recording: null,
            albumType: '',
        };

        return loc;
    },

    parseTrackNumber: function (number) {
        if (typeof number === 'string') {
            var trackNum = parseInt(number);
            var discNum = 0;

            if (trackNum.toString() !== number) {
                var frst = number.charCodeAt(0);
                var Acode = 'A'.charCodeAt(0);
                var Zcode = 'Z'.charCodeAt(0);
                if (number.length === 1) {
                    trackNum = (frst - Acode) + 1;
                } else {
                    if (frst >= Acode && frst <= Zcode) {
                        discNum = (frst - Acode) + 1;
                        while (number.charCodeAt(0) >= Acode && number.charCodeAt(0) <= Zcode) {
                            number = number.substr(1);
                        }
                        trackNum = parseInt(number);
                    }
                }
            }

            return {
                number: (isNaN(trackNum) || trackNum === 0) ? number : trackNum,
                disc: discNum
            };
        } else
            return {
                number: number,
                disc: 0
            };
    },

    groupingSupport: function () {
        return true;
    },

    fingerprintingSupport: function () {
        return false;
    },

    getPluginPriority: function (type) {
        return 1000; // less value = higher priority
    },

    albumSearchStep: function (searchManager, album, albumArtist, lst) {
        return new Promise(function (resolve) {
            resolve(false);
        });
    },

    startSearch: function (searchManager) {
        var _this = this;
        return new Promise(function (resolveSearch) {
            var sett = settings.get('Options');
            var tracks = searchManager.getTracks();
            _this.finishedNum = 0;
            _this.trackStatus = [];
            searchManager.notifyProgress(_this.finishedNum);
            if (tracks && tracks.count) {
                var finished = function (tracks, needApply) {
                    return new Promise(function (resolve) {

                        if (searchManager.isCanceled()) {
                            resolve();
                            return;
                        }

                        tracks.locked(function () {
                            var track;
                            var albums = [];
                            var alreadyDone = 0;
                            for (var i = 0; i < tracks.count; i++) {
                                track = tracks.getFastObject(i, track);
                                var path = track.path;
                                var name = track.album + '~~' + track.albumArtist;
                                if (!albums.includes(name))
                                    albums.push(name);
                                if (_this.firstPassDone[path]) {
                                    alreadyDone++;
                                    if (track.autoTagState !== AT_STATE_FAILED)
                                        _this.setTrackState(searchManager, track, AT_STATE_DONE);
                                } else {
                                    _this.firstPassDone[path] = true;
                                    if (track.autoTagState < AT_STATE_LOCATED) { // old state ... not changed to DONE so track is failed to locate
                                        _this.setTrackState(searchManager, track, AT_STATE_FAILED);
                                    }

                                    _this.trackStatus[path] = AT_STATE_IN_PROCESS;
                                }
                            }

                            if (alreadyDone === tracks.count) {
                                resolve();
                                searchManager.refresh();
                                return;
                            }

                            var callArtworkLoad = true;

                            searchManager.notifyProgress(_this.finishedNum, undefined, _('Pairing') + ' ' + tracks.count + ' ' + _('tracks'));

                            var finishTracks = function (tracks) {

                                tracks.splitToAlbums().whenLoaded().then(function (albs) {

                                    var ar = [];

                                    var processAlbum = function (idx) {

                                        if (searchManager.isCanceled()) {
                                            resolveSearch();
                                            return;
                                        }
                                        if (albs.count > idx) {

                                            albs.notifyChanged();
                                            searchManager.refresh();

                                            var tracks = undefined;
                                            albs.locked(function () {
                                                tracks = albs.getValue(idx);
                                            });

                                            var founds = [];
                                            tracks.locked(() => {
                                                if (tracks.count) {
                                                    var album = tracks.getValue(0).album;
                                                    searchManager.notifyProgress(_this.finishedNum, undefined, _('Album') + ' ' + album + ': ' + autoTagFramework.getStateText(AT_STATE_LOADING_ARTWORK));
                                                }
                                                for (var t = 0; t < tracks.count; t++) {
                                                    var track = tracks.getValue(t);
                                                    if (!_this._trackHandled(track)) {
                                                        var lookup = searchManager.getCurrentTrackLookup(track.path);
                                                        if (lookup) {
                                                            founds.push({
                                                                track: track,
                                                                locatedTrack: lookup,
                                                                __usedRelease: {
                                                                    id: lookup.release,
                                                                    title: lookup.album
                                                                }
                                                            });

                                                            track.newTrackState = AT_STATE_LOADING_ARTWORK; // set current state to artwork loading
                                                            searchManager.artworkSearch(track.path, false);
                                                        }
                                                    }
                                                }
                                            });

                                            if (founds.length) {
                                                var promise;
                                                if (needApply)
                                                    promise = _this.applyToTracks(searchManager, founds, tracks);
                                                else
                                                    promise = _this.finalizeTracks(searchManager, founds, tracks);

                                                promise.then(() => {
                                                    processAlbum(++idx);
                                                });
                                            } else
                                                processAlbum(++idx);

                                        } else {
                                            resolve();
                                            searchManager.refresh();
                                        }
                                    }

                                    processAlbum(0);

                                });

                            }

                            if (tracks.count > 5) {
                                // we can use compilations as well ... check whether all tracks belong to same album
                                let avoidCompilations = searchManager.avoidCompilations();
                                let releases = [];
                                let counter = [];
                                let names = [];
                                let dates = [];
                                let albumDetails = [];
                                for (var i = 0; i < tracks.count; i++) {
                                    track = tracks.getFastObject(i, track);
                                    if (!_this._trackHandled(track)) {
                                        let lookups = searchManager.getTrackLookups(track.path);

                                        let usedReleases = [];
                                        let usedGroups = [];

                                        lookups.forEach((item) => {
                                            var canAdd = true;
                                            if (avoidCompilations)
                                                if (item.__album)
                                                    if (_this.isOfficialAlbumOrSingle)
                                                        canAdd = _this.isOfficialAlbumOrSingle(item.__album);

                                            if (canAdd) {
                                                let sameTrackCount = false;
                                                if (item.__album && item.__album['track-count']) {
                                                    sameTrackCount = item.__album['track-count'] === tracks.count;
                                                }
                                                let id = 'release_'+item.release;
                                                if (!releases.includes(id)) {
                                                    if (sameTrackCount)
                                                        releases.unshift(id);
                                                    else
                                                        releases.push(id);
                                                    names[id] = item.album;
                                                    counter[id] = 0;
                                                    if (item.__album && item.__album._mmdate)
                                                        dates[id] = item.__album._mmdate;
                                                    else
                                                    if (item.date !== undefined) {
                                                        if (typeof item.date == 'string')
                                                            dates[id] = app.utils.myDecodeDate(item.date);
                                                        else
                                                            dates[id] = item.date;
                                                    }

                                                    if (item.__album)
                                                        albumDetails[id] = item.__album;
                                                }

                                                if (!usedReleases.includes(id)) { // allow only one instance per track
                                                    counter[id] = ++counter[id];
                                                    usedReleases.push(id);
                                                }

                                                if ((avoidCompilations && !item.release && item.releaseGroup) ||
                                                    (!avoidCompilations && item.releaseGroup)) {
                                                    let id = 'group_'+item.releaseGroup;
                                                    if (!releases.includes(id)) {
                                                        if (sameTrackCount)
                                                            releases.unshift(id);
                                                        else
                                                            releases.push(id);
                                                        names[id] = item.album;
                                                        counter[id] = 0;
                                                        if (item.__album && item.__album._mmdate)
                                                            dates[id] = item.__album._mmdate;
                                                        else
                                                        if (item.date !== undefined) {
                                                            if (typeof item.date == 'string')
                                                                dates[id] = app.utils.myDecodeDate(item.date);
                                                            else
                                                                dates[id] = item.date;
                                                        }
                                                    }

                                                    if (!usedGroups.includes(id)) { // allow only one instance per track
                                                        counter[id] = ++counter[id];
                                                        usedGroups.push(id);
                                                    }
                                                }

                                            }
                                        });
                                    }
                                }

                                var top = -1;
                                var max = 0;
                                var topReleases = [];
                                var date = 0;
                                let trackDiff = avoidCompilations ? 0 : 2;
                                // sort releases array
                                releases.sort(function (item1, item2) {
                                    if (item1.startsWith('release_'))
                                        return -1;
                                    if (item2.startsWith('release_'))
                                        return 1;
                                    return 0;
                                });
                                for (var i = 0; i < releases.length; i++) {
                                    let id = releases[i];
                                    let cnt = counter[id];
                                    if (cnt >= max) {

                                        if (cnt > max) {
                                            topReleases = [];
                                            date = 0;
                                        }
                                        topReleases.push(id);
                                        if ((date <= 0) || ((date > dates[id]) && (dates[id] > 0))) {
                                            top = i;
                                            max = cnt;
                                            date = dates[id];
                                        }
                                    }                                
                                }

                                if (top >= 0)
                                    if (max >= Math.max(5, tracks.count - trackDiff)) {

                                        var foundTracks = app.utils.createTracklist(true);
                                        var notFoundTracks = app.utils.createTracklist(true);
                                        callArtworkLoad = false;
                                        var founds = [];
                                        var ar = [];
                                        for (var t = 0; t < tracks.count; t++) {
                                            var track = tracks.getValue(t);

                                            var lookups = searchManager.getTrackLookups(track.path);
                                            if (!lookups.some((look) => {
                                                    let topVal = releases[top];
                                                    let isGroup = topVal.startsWith('group_');
                                                    
                                                    if (((look.release !== undefined) && (!isGroup) && ('release_'+look.release === releases[top])) ||
                                                       ((look.releaseGroup !== undefined) && (isGroup) && ('group_'+look.releaseGroup === releases[top])) ||
                                                       ((look.release === undefined) && (look.album === names[releases[top]]))) {

                                                        if (!look.originalDate && look.date)
                                                            look.originalDate = look.date;

                                                        if (look.getDetailAsync) {
                                                            ar.push(look.getDetailAsync(track));
                                                            look.getDetailAsync = undefined;
                                                        }

                                                        if (_this._processTrackReleaseGroup && isGroup) {
                                                            ar.push(_this._processTrackReleaseGroup(track, look, !!look.releaseGroup ? look.releaseGroup : '', !!look.release ? look.release : '', look.recording));
                                                        } else
                                                        if (_this._processTrackRelease && !isGroup) {
                                                            ar.push(_this._processTrackRelease(track, look, look.release, look.recording));
                                                        }
                                                        var info = {
                                                            track: track,
                                                            locatedTrack: look,
                                                        };

                                                        if (look.release && !isGroup)
                                                            info.__usedRelease = {
                                                                id: look.release,
                                                                title: names[releases[top]]
                                                            };
                                                        if (look.releaseGroup && isGroup)
                                                            info.__usedReleaseGroup = {
                                                                id: look.releaseGroup,
                                                                title: names[releases[top]]
                                                            };

                                                        founds.push(info);
                                                        foundTracks.add(track);
                                                        return true;
                                                    }
                                                    return false;
                                                })) {
                                                notFoundTracks.add(track);
                                            }
                                        }

                                        whenAll(ar).then(() => {
                                            //searchManager.notifyProgress(_this.finishedNum, undefined, item.locatedTrack. + ': ' + autoTagFramework.getStateText(AT_STATE_LOADING_ARTWORK));

                                            var minDate = 99991231;
                                            var maxDate = 0;
                                            founds.forEach((item) => {
                                                if (item.locatedTrack.originalDate && maxDate < item.locatedTrack.originalDate) {
                                                    maxDate = item.locatedTrack.originalDate;
                                                }
                                                if (item.locatedTrack.originalDate && minDate > item.locatedTrack.originalDate) {
                                                    minDate = item.locatedTrack.originalDate;
                                                }
                                            });
                                            var dt = Math.max(minDate, maxDate);
                                            if (dt) {
                                                founds.forEach((item) => {
                                                    item.locatedTrack.date = dt;
                                                });
                                            }

                                            _this.applyToTracks(searchManager, founds, foundTracks).then(() => {

                                                if (notFoundTracks) {
                                                    finishTracks(notFoundTracks);
                                                } else {
                                                    resolve();
                                                    searchManager.refresh();
                                                }
                                            });
                                        });
                                        return;
                                    }

                            }

                            if (callArtworkLoad) {

                                finishTracks(tracks);

                            }
                        });
                    });
                };

                var useSearchAndFingerprints = function (list) {
                    return new Promise(function (resolve) {
                        if (searchManager.isCanceled()) {
                            resolve();
                            return;
                        }
                        var notProcessedList = app.utils.createTracklist(true);

                        var processTrack = function (list, index) {
                            if (searchManager.isCanceled()) {
                                resolve();
                                return;
                            }
                            if (index < list.count) {
                                var track;
                                list.locked(function () {
                                    track = list.getValue(index);
                                });
                                if (track.title && (track.artist || (track.albumArtist && track.album) || track.isVideo)) {
                                    _this.searchTrack(searchManager, track).then(function (res) {
                                        if (searchManager.isCanceled()) {
                                            resolve();
                                            return;
                                        }
                                        if (res) {
                                            var lst = app.utils.createTracklist(true);
                                            lst.add(track);
                                            _this.applyToTracks(searchManager, [{
                                                track: track,
                                                locatedTrack: res
                                            }], lst, true /* do not load artwork */ ).then(function () {
                                                processTrack(list, index + 1);
                                            });
                                        } else {
                                            notProcessedList.add(track);
                                            processTrack(list, index + 1);
                                        }

                                    });
                                } else {
                                    notProcessedList.add(track);
                                    processTrack(list, index + 1);
                                }
                            } else {
                                if (notProcessedList.count && _this.groupingSupport() && resolveToValue(_this.fingerprintingSupport, false)) {
                                    _this.searchByFingerprints(searchManager, notProcessedList).then(function (res) {
                                        if (searchManager.isCanceled()) {
                                            resolve();
                                            return;
                                        }
                                        if (res) {
                                            _this.applyToTracks(searchManager, res, notProcessedList, true /* do not load artwork */ ).then(function (res) {
                                                finished(list).then(() => {
                                                    resolve(res);
                                                });
                                            });
                                        } else {
                                            finished(notProcessedList, true).then(() => {
                                                resolve(res);
                                            });
                                        }
                                    });
                                } else {
                                    finished(list, true).then(() => {
                                        resolve();
                                    });
                                }
                            }
                        };

                        processTrack(list, 0);
                    });
                }

                var processExisting = function (res, lst) {
                    return new Promise(function (resolve) {
                        if (res) {
                            var founds = res;
                            var list = lst;
                            var all = res.length === lst.count;

                            if (!all) { // not all tracks were processed using existing links
                                list = app.utils.createTracklist(true);
                                founds.forEach(function (rec) {
                                    list.add(rec.track);
                                    lst.remove(rec.track); // remove track from original list as it's already processed
                                });
                            }

                            if (founds.length) {
                                _this.applyToTracks(searchManager, founds, list).then(function (res) {
                                    resolve(all);
                                });
                            } else {
                                resolve(false);
                            }
                        } else
                            resolve(false);
                    });
                }

                var groupAlbums = searchManager.groupAlbums() && _this.groupingSupport();

                if (!groupAlbums) {
                    _this.checkExistingLinks(searchManager, tracks).then(function (res) {
                        if (searchManager.isCanceled()) {
                            resolveSearch();
                            return;
                        }
                        processExisting(res, tracks).then(function (allProcessed) {
                            if (searchManager.isCanceled()) {
                                resolveSearch();
                                return;
                            }
                            if (!allProcessed) {
                                useSearchAndFingerprints(tracks).then(function () {
                                    resolveSearch();
                                });
                            } else
                                resolveSearch(res);
                        });
                    });
                } else {
                    tracks.splitToAlbums().whenLoaded().then(function (result) {
                        if (searchManager.isCanceled()) {
                            resolveSearch();
                            return;
                        }
                        var processAlbum = function (idx) {
                            if (searchManager.isCanceled()) {
                                resolveSearch();
                                return;
                            }
                            if (result.count > idx) {

                                tracks.notifyChanged();
                                searchManager.refresh();

                                var lst = undefined;
                                result.locked(function () {
                                    lst = result.getValue(idx);
                                });
                                var processNextAlbum = true;

                                if (lst && lst.count) {

                                    if (lst.count >= _this.albumTracksLimit) {
                                        var album = '';
                                        var albumArtist = '';
                                        var isMovie = false;
                                        var isVideo = false;
                                        lst.locked(function () {
                                            var track = lst.getValue(0);
                                            album = track.album;
                                            albumArtist = track.albumArtist;
                                            isVideo = track.isVideo;
                                            isMovie = (isVideo) && (track.trackTypeStr !== 'TV');
                                        });

                                        if (((album && (sett.Options.PreferFastLookup || isVideo)) || isMovie) && ((lst.count > 0) || (!resolveToValue(_this.fingerprintingSupport, false)))) {
                                            processNextAlbum = false;
                                            _this.checkExistingLinks(searchManager, lst).then(function (res) {
                                                if (searchManager.isCanceled()) {
                                                    resolveSearch();
                                                    return;
                                                }
                                                processExisting(res, lst).then(function (allProcessed) {
                                                    if (searchManager.isCanceled()) {
                                                        resolveSearch();
                                                        return;
                                                    }
                                                    if (!allProcessed) {
                                                        if (album && albumArtist) {
                                                            _this.albumSearchStep(searchManager, album, albumArtist, lst).then(function (res) {
                                                                if (searchManager.isCanceled()) {
                                                                    resolveSearch();
                                                                    return;
                                                                }
                                                                if (res) {
                                                                    if ((typeof res === 'object') && (isArray(res)) && (lst.count !== res.length)) {
                                                                        // probably not all tracks fits to the album
                                                                        if (resolveToValue(_this.fingerprintingSupport, false)) {
                                                                            var newList = app.utils.createTracklist(true);
                                                                            lst.locked(function () {
                                                                                var track;
                                                                                for (var i = 0; i < lst.count; i++) {
                                                                                    track = lst.getFastObject(i, track);
                                                                                    var path = track.path;
                                                                                    var found = false;
                                                                                    for (var j = 0; j < res.length; j++) {
                                                                                        if (res[j].track.path === path) {
                                                                                            found = true;
                                                                                            break;
                                                                                        }
                                                                                    }
                                                                                    if (!found) {
                                                                                        newList.add(lst.getValue(i));
                                                                                    }
                                                                                }
                                                                            });

                                                                            useSearchAndFingerprints(newList).then(function () {
                                                                                processAlbum(++idx);
                                                                            });
                                                                        } else
                                                                            finished(lst).then(() => {
                                                                                processAlbum(++idx);
                                                                            });
                                                                    } else
                                                                        finished(lst).then(() => {
                                                                            processAlbum(++idx);
                                                                        });
                                                                } else {
                                                                    if (resolveToValue(_this.fingerprintingSupport, false)) {
                                                                        useSearchAndFingerprints(lst).then(function () {
                                                                            processAlbum(++idx);
                                                                        });
                                                                    } else
                                                                        finished(lst).then(() => {
                                                                            processAlbum(++idx);
                                                                        });
                                                                }
                                                            });
                                                        } else {
                                                            if (resolveToValue(_this.fingerprintingSupport, false)) {
                                                                useSearchAndFingerprints(lst).then(function () {
                                                                    processAlbum(++idx);
                                                                });
                                                            } else {

                                                                if (isVideo) {

                                                                    if (isMovie) {
                                                                        var processVideoTrack = (i) => {
                                                                            if (i < lst.count) {
                                                                                var track;
                                                                                lst.locked(() => {
                                                                                    track = lst.getValue(i);
                                                                                });
                                                                                _this.searchTrack(searchManager, track).then(function (res) {
                                                                                    if (searchManager.isCanceled()) {
                                                                                        resolveSearch();
                                                                                        return;
                                                                                    }
                                                                                    if (res) {
                                                                                        _this.applyToTracks(searchManager, [{
                                                                                            track: track,
                                                                                            locatedTrack: res,
                                                                                            lookupArtwork: true
                                                                                        }], lst, false).then(function () {
                                                                                            processVideoTrack(++i);
                                                                                        });
                                                                                    } else {
                                                                                        processVideoTrack(++i);
                                                                                    }
                                                                                });
                                                                            } else {
                                                                                finished(lst).then(() => {
                                                                                    processAlbum(++idx);
                                                                                });
                                                                            }
                                                                        };
                                                                        processVideoTrack(0);
                                                                    } else { // TV show or series
                                                                        _this.albumSearchStep(searchManager, album, albumArtist, lst).then(function (res) {
                                                                            if (searchManager.isCanceled()) {
                                                                                resolveSearch();
                                                                                return;
                                                                            }
                                                                            if (res) {
                                                                                var track;
                                                                                lst.locked(() => {
                                                                                    track = lst.getValue(0);
                                                                                });
                                                                                _this.applyToTracks(searchManager, [{
                                                                                    track: track,
                                                                                    locatedTrack: res,
                                                                                    lookupArtwork: true
                                                                                }], lst, false).then(function () {
                                                                                    finished(lst).then(() => {
                                                                                        processAlbum(++idx);
                                                                                    });
                                                                                });
                                                                            } else {
                                                                                finished(lst).then(() => {
                                                                                    processAlbum(++idx);
                                                                                });
                                                                            }

                                                                        });
                                                                    }
                                                                } else {
                                                                    finished(lst).then(() => {
                                                                        processAlbum(++idx);
                                                                    });
                                                                }
                                                            }
                                                        }
                                                    } else
                                                        finished(lst).then(() => {
                                                            processAlbum(++idx);
                                                        });
                                                });
                                            });
                                        } else {
                                            processNextAlbum = false;
                                            if (resolveToValue(_this.fingerprintingSupport, false)) {
                                                useSearchAndFingerprints(lst).then(function () {
                                                    processAlbum(++idx);
                                                });
                                            } else
                                                finished(lst).then(() => {
                                                    processAlbum(++idx);
                                                });
                                        }
                                    } else {
                                        processNextAlbum = false;
                                        if (resolveToValue(_this.fingerprintingSupport, false)) {
                                            useSearchAndFingerprints(lst).then(function () {
                                                processAlbum(++idx);
                                            });
                                        } else
                                            finished(lst).then(() => {
                                                processAlbum(++idx);
                                            });
                                    }
                                }
                                if (processNextAlbum)
                                    finished(lst).then(() => {
                                        processAlbum(++idx);
                                    });
                            } else {
                                finished(tracks).then(() => {
                                    resolveSearch();
                                });
                            }

                        };

                        processAlbum(0);
                    });
                }
            } else
                resolveSearch();
        }.bind(this));
    },

    finishSearch: function (searchManager) {
        // clean up everything related to our search script here:
    },

    checkExistingLinks: function (searchManager, list) {
        return new Promise(function (resolve, reject) {
            resolve(false);
        });
    },

    searchTrack: function (searchManager, track) {
        return new Promise(function (resolve, reject) {
            resolve(false);
        });
    },

    searchByFingerprints: function (searchManager, list) {
        return new Promise(function (resolve, reject) {
            resolve(false);
        });
    },

    searchByAlbum: function (searchManager, list) {
        return new Promise(function (resolve, reject) {
            resolve(false);
        });
    },

    searchByTracks: function (searchManager, list) {
        return new Promise(function (resolve, reject) {
            resolve();
        });
    },

    searchMoreByTracks: function (searchManager, list, preferFingerprint) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var searchRest = function (l) {
                _this.searchByTracks(searchManager, l).then(function (res) {
                    /*if (res) {
                        _this.applyToTracks(searchManager, null, l).then(function (resolution) {
                            if (resolution)
                                searchManager.refresh();
                            resolve(res);
                        });
                    } else*/
                    resolve(res);
                });
            }

            if (preferFingerprint && resolveToValue(_this.fingerprintingSupport, false)) {
                var l = app.utils.createTracklist(true);
                list.locked(function () {
                    for (var i = 0; i < list.count; i++) {
                        var track = list.getValue(i);
                        if (!searchManager.wasFingerprinted(track.path)) {
                            l.add(track);
                        }
                    }
                });

                if (l.count) {
                    _this.searchByFingerprints(searchManager, l).then(function (res) {
                        if (searchManager.isCanceled()) {
                            resolve();
                            return;
                        }
                        if (res) {
                            _this.applyToTracks(searchManager, res, l).then(function (resolution) {
                                searchManager.refresh();
                                resolve(res);
                            });
                        } else
                            searchRest(list);
                    });
                    return;
                }
            }
            searchRest(list);

        });
    },

    useArtwork: function (searchManager, release, list, urlObj, checkRelease) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            if (urlObj) {
                if(isString(urlObj)) {
                    urlObj = {url: urlObj};
                }
                var tracks = list || searchManager.getTracks();

                var storeCover = function (fnObj) {
                    searchManager.setArtworkLink(release, fnObj.url);
                    if(fnObj.source) {
                        searchManager.setSourceInfo(release, fnObj);
                    }
                    var handleTrack = function (track) {
                        if ((!checkRelease) || (checkRelease && (track.album === release))) {
                            searchManager.setArtworkLink(track.path, fnObj.url);
                            if(fnObj.source) {
                                searchManager.setSourceInfo(track.path, fnObj);
                            }
                            searchManager.artworkSearch(track.path, true);
                        } else {
                            var tracks = app.utils.createTracklist(true);
                            tracks.add(track);
                            _this.getCommonArtwork(searchManager, tracks);
                        }
                    }

                    if (tracks) {
                        if (tracks.objectType === 'track') {
                            handleTrack(tracks);

                        } else {
                            tracks.locked(function () {
                                var track = undefined;
                                for (var i = 0; i < tracks.count; i++) {
                                    var track = tracks.getFastObject(i, track);
                                    handleTrack(track);
                                }
                            });
                        }
                    }
                    searchManager.refresh();
                    resolve();
                }

                // add cover (but do not save)
                if (urlObj.url.indexOf('file:///') === 0) {
                    storeCover(urlObj);
                } else {
                    app.utils.prepareImage(urlObj.url, 1920, 1920, function (fn) {
                        //app.utils.saveImageAsync(url).then(function (fn) {
                        if (fn) {
                            urlObj.url = fn;
                            storeCover(urlObj);
                        } else
                            resolve();
                    });
                }
            } else {
                _this.getCommonArtwork(searchManager, list).then(function () {
                    resolve();
                });
            }
        });
    },

    getCommonArtwork: function (searchManager, list) {
        var _this = this;
        return new Promise(function (resolve) {

            if (list && list.count) {

                list.splitToAlbums().whenLoaded().then(function (l) {

                    if (l.count) {

                        var processTracks = function (idx) {

                            if (idx < l.count) {

                                var tracks;
                                l.locked(() => {
                                    tracks = l.getValue(idx);
                                });

                                var infoClass = {};
                                var path;
                                tracks.locked(() => {
                                    var track = tracks.getValue(0);
                                    infoClass.objectType = 'album';
                                    infoClass.albumArtist = track.albumArtist;
                                    infoClass.album = track.album;
                                    infoClass.title = track.album;
                                    path = track.path;
                                });

                                searchManager.notifyProgress(_this.finishedNum, undefined, app.utils.getFilename(path) + ' ' + _('Status') + ': ' + window.autoTagFramework.getStateText(AT_STATE_LOADING_ARTWORK));

                                searchTools.getAAImage(infoClass, function (path) {
                                    if (path !== '') {
                                        tracks.locked(() => {
                                            var track;
                                            for (var i = 0; i < tracks.count; i++) {
                                                track = tracks.getFastObject(i, track);

                                                searchManager.setArtworkLink(track.path, path);
                                                searchManager.artworkSearch(track.path, true);
                                            }
                                        });
                                        searchManager.refresh();
                                    }
                                    processTracks(++idx);
                                });
                            } else
                                resolve();
                        }

                        processTracks(0);


                    } else {
                        var processTracks = function (idx) {
                            if (idx < list.count) {

                                var track;
                                list.locked(() => {
                                    track = list.getValue(idx);
                                });

                                searchManager.notifyProgress(_this.finishedNum, undefined, app.utils.getFilename(track.path) + ' ' + _('Status') + ': ' + window.autoTagFramework.getStateText(AT_STATE_LOADING_ARTWORK));

                                searchTools.getAAImage(track, function (path) {
                                    if (path !== '') {
                                        searchManager.setArtworkLink(track.path, path);
                                        searchManager.artworkSearch(track.path, true);
                                        searchManager.refresh();
                                    }
                                    processTracks(++idx);
                                });
                            } else {
                                resolve();
                            }
                        };

                        processTracks(0);
                    }
                });
            } else
                resolve();
        });
    },

    getArtwork: function (searchManager, founds, list) {
        return this._getCommonArtwork(searchManager, list);
    },

    runLyricsSearch: function (searchManager) {
        var _this = this;
        if (!_this._lyricsSearchInProgress) {
            _this._lyricsSearchInProgress = true;
            searchTools.startMonitoringLyricsSearchTimes();
            var func = function (idx) {

                if (idx < _this._lyricsQueue.length && !searchManager.isCanceled()) {

                    var item = _this._lyricsQueue[idx];
                    var trackDone = function () {
                        _this.setTrackState(searchManager, item.track, AT_STATE_DONE);
                        searchManager.refresh();
                        item.resolve();
                    }

                    if (!item.lyricsSearched && (item.track.title || item.track.artist || item.track.albumArtist)) {
                        item.lyricsSearched = true;
                        var progress = function (txt) {
                            searchManager.notifyProgress(_this.finishedNum, undefined, app.utils.getFilename(item.track.path) + ' ' + _('Status') + ': ' + window.autoTagFramework.getStateText(AT_STATE_LOADING_LYRICS) + ' (' + txt + ')');
                        };

                        _this.setTrackState(searchManager, item.track, AT_STATE_LOADING_LYRICS);
                        searchTools.searchLyrics(item.track, false /* do not save */ , true /* overwrite */ , progress).then(function (lyrics) {
                            if (lyrics === '') {
                                var origValues = searchManager.getTrackOrigValues(item.track.path);
                                if (origValues) {
                                    searchTools.searchLyrics({
                                        objectType: 'track',
                                        title: origValues.title,
                                        artist: origValues.artist,
                                        setLyricsAsync: function (lyrics) {
                                            return item.track.setLyricsAsync(lyrics);
                                        },
                                        getLyricsAsync: function () {
                                            return new Promise(function (resolve) {
                                                resolve('');
                                            })
                                        },
                                    }, false /* do not save */ , true /* overwrite */ , progress).then(function (lyrics) {
                                        trackDone();
                                        func(++idx);
                                    });
                                    return;
                                }

                            } else
                                item.track.setLyricsAsync(lyrics);
                            trackDone();
                            func(++idx);
                        });
                    } else {
                        trackDone();
                        func(++idx);
                    }
                } else {
                    _this._lyricsQueue = [];
                    _this._lyricsSearchInProgress = false;
                    searchTools.stopMonitoringLyricsSearchTimes();
                }
            }
            func(0);
        }
    },

    processLyrics: function (searchManager, track) {
        var _this = this;
        return new Promise(function (resolve) {
            if (!searchManager.isCanceled() && !track.isVideo) {
                if (_this.checkLyricsLoad(searchManager, null, null, track)) {

                    _this._lyricsQueue.push({
                        track: track,
                        resolve: resolve
                    });
                    _this.runLyricsSearch(searchManager);

                    return;
                }
            }
            resolve();
        });
    },

    applyToTrack: function (searchManager, fieldsToUpdate, item) {
        var track = item.track;
        var mbTrack = item.locatedTrack;

        if (searchManager.isRunning()) {
            if (!searchManager.addTrackLookup(track.path, mbTrack, this.lookupSource)) {
                this.setTrackState(searchManager, track, resolveToValue(item.newTrackState, AT_STATE_DONE));
                return;
            }
        }

        var checkVal = function (val) {
            return (val !== undefined) &&
                (((typeof val == 'string') && (val !== '')) ||
                    ((typeof val == 'number') && (val !== 0)));
        }

        searchManager.setCurrentTrackLookup(track.path, mbTrack);

        if (fieldsToUpdate.discNum) {
            if (checkVal(mbTrack.seasonNumber)) {
                track.seasonNumber = mbTrack.seasonNumber;
                track.discNumber = mbTrack.seasonNumber;
            }
        }
        if (fieldsToUpdate.trackNum) {
            if (checkVal(mbTrack.episodeNumber)) {
                track.episodeNumber = mbTrack.episodeNumber;
                track.trackNumber = mbTrack.episodeNumber;
            }
        }

        if (checkVal(mbTrack.number)) {
            var trackNums = this.parseTrackNumber(mbTrack.number);

            if (fieldsToUpdate.trackNum) {
                if (typeof trackNums.number === 'string')
                    track.trackNumber = trackNums.number;
                else
                    track.trackNumberInt = trackNums.number;
            }

            if (fieldsToUpdate.discNum) {
                if (typeof trackNums.disc === 'string')
                    track.discNumber = trackNums.disc;
                else
                    track.discNumberInt = trackNums.disc;
            }
        }
        if (fieldsToUpdate.trackNum) {
            track.temporaryOrder = track.trackNumberInt - 1;
        }


        if (fieldsToUpdate.title && checkVal(mbTrack.title)) {

            // PETR: disabled for now, but maybe we will use it ... related to #15373 item 5c
            /*var artsInTitle = this.splitFeaturedArtists(mbTrack.title);
            if (artsInTitle.length > 1) {
                var first = artsInTitle.shift();
                for (var i = artsInTitle.length - 1; i >= 0; i--) {
                    if (artsInTitle[i] === first)
                        artsInTitle.splice(i);
                }
                var art = this.getArtistText(mbTrack['artist-credit']);
                var artists;
                if (art)
                    artists = art.split(';');
                if (!artists || !artists.length) 
                    if (mbTrack.artist !== undefined)
                        artists = mbTrack.artist.split(';');
                    else
                        artists = [];
                    
                for (var i = 0; i < artsInTitle.length; i++) {
                    if (!artists.includes(artsInTitle[i])) {
                        artists.push(artsInTitle[i]);
                    }
                }
                            
                mbTrack['artist-credit'] = undefined;
                mbTrack.artist = this.getArtistText(artists);
                
            }*/

            track.title = this.normalizeValue(searchManager, mbTrack.title);
        }

        if (fieldsToUpdate.artist) {
            if (mbTrack['artist-credit'] && mbTrack['artist-credit'].length) {
                var artist = '';
                for (var i = 0; i < mbTrack['artist-credit'].length; i++) {
                    if (artist)
                        artist += ';';
                    artist += mbTrack['artist-credit'][i].artist.name;
                }
                track.artist = this.normalizeMultivalue(searchManager, artist);
            }
            if (checkVal(mbTrack.artist)) {
                track.artist = this.normalizeMultivalue(searchManager, mbTrack.artist);
            }
        }

        if (fieldsToUpdate.genre && mbTrack.genre) {
            searchManager.updateExistingTrackGenre(track, searchManager.normalizeGenres(this.normalizeMultivalue(searchManager, mbTrack.genre)));
        }

        if (fieldsToUpdate.actors && checkVal(mbTrack.actors)) {
            track.actors = this.normalizeMultivalue(searchManager, mbTrack.actors);
        }

        if (fieldsToUpdate.date || fieldsToUpdate.year) {
            if (mbTrack.date !== undefined) {
                if (!fieldsToUpdate.date) {
                    var val = mbTrack.date;
                    if (val > 10000) {
                        val = parseInt(val / 10000);
                    }
                    mbTrack.date = val;
                    track.year = val;
                } else
                    track.date = mbTrack.date;
            } else
            if (mbTrack.year !== undefined) {
                track.year = mbTrack.year;
            }

            if (mbTrack.originalDate) {
                track.origDate = mbTrack.originalDate;
                if (track.date <= 0)
                    track.date = track.origDate;
            }
        }

        if (fieldsToUpdate.director && checkVal(mbTrack.director)) {
            track.director = this.normalizeMultivalue(searchManager, mbTrack.director);
        }

        if (fieldsToUpdate.producer && checkVal(mbTrack.producer)) {
            track.producer = this.normalizeMultivalue(searchManager, mbTrack.producer);
        }

        if (fieldsToUpdate.parentalRating && mbTrack.parentalRating) {
            track.parentalRating = mbTrack.parentalRating;
        }

        // always update album/album artist
        if (fieldsToUpdate.album) {
            if (mbTrack.album)
                track.album = this.normalizeValue(searchManager, mbTrack.album);
            if (mbTrack.albumArtist)
                track.albumArtist = this.normalizeMultivalue(searchManager, mbTrack.albumArtist);
            if (track.album && !track.albumArtist && !track.isVideo)
                track.albumArtist = this.normalizeMultivalue(searchManager, track.artist);
        }

        if (fieldsToUpdate.comment && checkVal(mbTrack.description)) {
            track.setCommentAsync(mbTrack.description);
        }

        if (fieldsToUpdate.involvedPeople && checkVal(mbTrack.involvedPeople))
            track.involvedPeople = this.normalizeMultivalue(searchManager, mbTrack.involvedPeople);

        if (checkVal(mbTrack.composer))
            track.composer = this.normalizeMultivalue(searchManager, mbTrack.composer);

        if (fieldsToUpdate.writer && checkVal(mbTrack.lyricist))
            track.lyricist = this.normalizeMultivalue(searchManager, mbTrack.lyricist);

        if (fieldsToUpdate.publisher && checkVal(mbTrack.publisher))
            track.publisher = this.normalizeMultivalue(searchManager, mbTrack.publisher);

        if (item.lookupArtwork) {

            if (this.checkArtworkLoad(searchManager, null, null, track)) {

                var l = app.utils.createTracklist(true);
                l.add(track);
                this.setTrackState(searchManager, track, resolveToValue(item.newTrackState, AT_STATE_LOADING_ARTWORK));
                searchManager.setArtworkLink(track.path, '');
                searchManager.artworkSearch(track.path, false);
                this.getArtwork(searchManager, [item], l).then1(() => {
                    if (searchManager.isCanceled()) {
                        return;
                    }
                    searchManager.artworkSearch(track.path, true);
                    this.processLyrics(searchManager, track).then(() => {
                        this.setTrackState(searchManager, track, AT_STATE_DONE);
                    });
                });
                return;
            } else
                this.processLyrics(searchManager, track).then(() => {
                    this.setTrackState(searchManager, track, resolveToValue(item.newTrackState, AT_STATE_DONE));
                });
        } else
            this.setTrackState(searchManager, track, resolveToValue(item.newTrackState, AT_STATE_DONE));
    },

    applyToTracks: function (searchManager, founds, list) {
        var _this = this;
        return new Promise(function (resolve, reject) {

            var tracks = list || searchManager.getTracks();

            if (founds.length) {

                var doProcessArtworkAndLyrics = _this.firstPassDone[founds[0].track.path] || founds[0].track.isVideo;

                var fieldsToUpdate = searchManager.getFieldsToUpdate(!founds[0].track.isVideo);
                var track;
                var searchArtwork = doProcessArtworkAndLyrics;
                var searchLyrics = doProcessArtworkAndLyrics;

                if (tracks) {
                    tracks.locked(function () {
                        track = tracks.getValue(0);
                        searchArtwork = _this.checkArtworkLoad(searchManager, founds, tracks, track) && doProcessArtworkAndLyrics;
                        searchLyrics = _this.checkLyricsLoad(searchManager, null, null, track) && doProcessArtworkAndLyrics;

                        founds.forEach(function (item) {
                            item.newTrackState = searchArtwork ? AT_STATE_LOADING_ARTWORK : searchLyrics ? AT_STATE_LOADING_LYRICS : AT_STATE_DONE; // set current state to artwork loading
                            _this.applyToTrack(searchManager, fieldsToUpdate, item);
                        });
                    });
                }

                searchManager.refresh();

                if (doProcessArtworkAndLyrics && list) {

                    _this.finalizeTracks(searchManager, founds, list).then1(function () {
                        resolve(true);
                    });
                } else
                    resolve(true);

                return;
            }


            resolve(false);

        });
    },

    finalizeTracks: function (searchManager, founds, list) {
        var _this = this;
        return new Promise(function (resolve, reject) {

            founds.forEach(function (item) {
                item.newTrackState = AT_STATE_LOADING_ARTWORK;
                searchManager.artworkSearch(item.track.path, false);
            });

            if (list) {
                _this.getArtwork(searchManager, founds, list).then1(function () {
                    if (searchManager.isCanceled()) {
                        resolve();
                        return;
                    }
                    founds.forEach(function (item) {
                        searchManager.artworkSearch(item.track.path, true);
                    });

                    var ar = [];
                    list.locked(function () {
                        for (var i = 0; i < list.count; i++) {
                            ar.push(_this.processLyrics(searchManager, list.getValue(i)));
                        }
                    });

                    whenAll(ar).then(function () {
                        _this.setTracklistState(searchManager, list, AT_STATE_DONE);
                        resolve(true);
                    });
                });
            } else
                resolve(true);
        });
    },

    menu: [],
    customMenu: [],

    findCoverForAlbum: function (data) {
        return new Promise(function (resolve, reject) {
            if (data.album && data.album.title) {
                cancelPromise(data.album._promises.albumThumb);
                var cancelToken = data.album.getThumbAsync(data.pixelSize, data.pixelSize, function (imageLink) {
                    data.album._promises.albumThumb = undefined;
                    resolve(imageLink);
                });
                data.album._promises.albumThumb = {
                    cancel: function () {
                        app.cancelLoaderToken(cancelToken);
                        data.album._promises.albumThumb = undefined;
                    }
                };
            }
        });
    },

    getAlbumInfo: function (data) {
        return new Promise(function (resolve, reject) {
            resolve();
        });
    },

    getCopyrightInfo: function () {
        return new Promise(function (resolve, reject) {
            resolve('');
        });
    },

};
