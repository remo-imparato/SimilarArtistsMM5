/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

var AT_STATE_UNKNOWN = 0,
    AT_STATE_WAITING = 1,
    AT_STATE_IN_PROCESS = 2,
    AT_STATE_FINGERPRINTING = 3,
    AT_STATE_PROCESSING = 4,
    AT_STATE_LOCATED = 5,
    AT_STATE_LOADING_ARTWORK = 6,
    AT_STATE_LOADING_LYRICS = 7,
    AT_STATE_FIRSTPASS_DONE = 8,
    AT_STATE_FAILED = 9,
    AT_STATE_SKIPPED = 10,
    AT_STATE_DONE = 11;



(function () {

    /*
        Web tagger template.
        
        Methods:
        ------------------------------------------------
            groupingSupport: function
                - plugin can handle tracks by groups (albums/series)
                
            fingerprintingSupport: function
                - plugin support fingerprinting (detection using accoustID for example). When false is returned, searchByFingerprints never be called. Default is false.
            
            getPluginPriority: function (type)
                - get priority of the plugin for specified track type ... default value is 1000, less vaue = higher priority
                
            albumSearchStep: function (searchManager, album, albumArtist, list) 
                - process one album. This method is called by startSearch, when grouping to albums is enabled (in settings)
                
            startSearch: function (searchManager) 
                - this is an entry method and in normal circumstances plugin do not need to override default functionality
                
            finishSearch: function (searchManager) 
                - method to clean up all temporary variables
                
            checkExistingLinks: function (searchManager, list)
                - method where we check it tracks have already existing links (like recording in musicBrainz server or ID in iMDB).
                  When just some of them have and some not, finished tracks should have changed state to AT_STATE_DONE and these tracks should be skipped in next processing.
                  Returning promise should return true, when all tracks are processed and finished - no need to make any lookups for these tracks.
                
            searchTrack: function (searchManager, track)
                - search one track
                  Called when groupingSupport is false OR for tracks which have no Album defined
            
            searchByFingerprints: function (searchManager, list) 
                - search by fingerprint detection (if supported). Tagger can add variants user can choose from using searchManager.addTrackLookup method.
                  Called when groupingSupport is true
                
            searchByAlbum: function (searchManager, list, data) 
                - search by album (e.g. search album and compare tracks) ... if this method fails, fingerprint detection is called
                  Called when groupingSupport is true
                
            searchByTracks: function (searchManager, list)
                - search tracks (and it's album) information based on track details (title, artist etc.). This method is not used by normal search loop, but manually when located info is not sufficient (e.g. clicking on 'More...'). This method should add additional lookup data using searchManager.addTrackLookup (format of locatedTrack described below). Because of performance reason (popular tracks can be within 
                hundreds of albums), only basic info (album name, id) should be filled and using async getDetailAsync method download all info when necessary.
                
            useArtwork: function (searchManager, release, list, url) 
                - store cover detected by search engine to local variables (for futher usage using searchManager.getArtworkLink) - typically not need to override this method

            checkArtworkLoad: function (searchManager, founds, list, item)
                - every plugins should search artwork only when this method returns true (this means artwork search is enabled in settings). ApplyToTrack and ApplyToTracks are already covered when used it's default implementation.

            getArtwork: function (searchManager, founds, list) 
                - search artwork(s) for specified track(s)
                
            applyToTrack: function (searchManager, fieldsToUpdate, item) 
                - apply new values to track
                
            applyToTracks: function (searchManager, founds, list) 
                - apply new values to tracks. This method will call applyToTrack to each track - typically not need to override this method
            
            findCoverForAlbum: function (album, pixelSize) 
                -
                
            getAlbumInfo: function (album, pixelSize) 
                -
                
            notifyProgress: function (processingTrackNum, total, label)
                - notify owner about current progress
            
            getCopyrightInfo: function ()
                - get provider copyright/license info
        


            Main detection methods (checkExistingLinks, searchTrack, searchByFingerprints, searchByAlbum and searchByTracks) should call 
            resolve (promise JS resolve command) with false in case method failed or array with objects in this format:
                {
                    track: original_track,
                    locatedTrack: {
                        number: ...,            // number of located track
                        title: ...,             // title of located track
                        artist-credit: [{       // array with artists
                            name: ...,          // artist name
                        }],
                        artist: ...,
                        album: ...,             
                        albumArtist: ...,
                        genre: ...,
                        date: ...,              // date encoded using app.utils.myDecodeDate method 
                        length: ...,            
                        involvedPeople: ...,
                        composer: ...,
                        lyricist: ...,
                        publisher: ...,
                        albumType: ...,         // album type like Album, Single, Compilation, Live etc.
                    
                        release: ...,           // release identifier (mainly from musicbrainz) .. it will be stored as a link, but plugin need to have correctly defined lookupSource
                        releaseGroup:...,
                        recording:...,
                        
                        getDetailAsync: function (original_track)  // define this method to DL all data (method will be removed after usage)
                        
                    }
                }
                    

         Detection workflow:
         -------------------
            
            When grouping is supported:
                album == ''
                    - searchTrack
                        - searchFingerprint (if supported)
                album != ''
                    - searchByAlbum
                        - searchTrack
                            - searchFingerprint (if supported)
                        
            When grouping is NOT supported
                - searchTrack
                    - searchFingerprint (if supported)


        Properties:
        ------------------------------------------------
            menu              -
            customMenu        - 
            albumTracksLimit  - limit of minimal tracks in the album for 'by album' lookup usage

    
    
    */
    window.webTaggers = {};


    /**
    Framework to operate auto tag plugins.

    @class window.autoTagFramework
    */

    window.autoTagFramework = {
        initialize: function () {





        },

        /**
        Get menu with list of all taggers with their custom settings.

        @method getMenu
        @return {Menu}
        */

        getMenu: function (searchManager, parent) {
            var allMenusItems = [];
            var keys = Object.keys(webTaggers);
            for (var i = 0; i < keys.length; i++) {
                var key = keys[i];
                var menuItems = webTaggers[key].menu;
                for (var j in menuItems) {
                    var item = menuItems[j];
                    item.taggerKey = key;
                    // (re)define 'execute' function if needed:
                    if (!item._origExecFnDef) {
                        item._origExecFn = item.execute;
                        item.execute = function () {
                            if (this._origExecFn)
                                this._origExecFn(this);
                            searchManager.changeTagger(this.taggerKey);
                        }.bind(item);
                        item._origExecFnDef = true;
                    }
                    // (re)define 'checked' function if needed:    
                    if (!item._origCheckedFnDef) {
                        item._origCheckedFn = item.checked;
                        item.checked = function () {
                            var isCurrentTagger = (searchManager._currentWebTagger == this.taggerKey);
                            if (this._origCheckedFn) {
                                return isCurrentTagger && this._origCheckedFn(this);
                            } else
                                return isCurrentTagger;
                        }.bind(item);
                        item._origCheckedFnDef = true;
                    }
                    item.radiogroup = 'webTaggers';
                    allMenusItems.push(item);
                }
            };
            if (webTaggers[searchManager._currentWebTagger].customMenu.length > 0)
                allMenusItems = allMenusItems.concat([menuseparator], webTaggers[searchManager._currentWebTagger].customMenu);

            return new Menu(allMenusItems, {
                parent: parent
            });
        },

        /**
        Get list of all installed taggers.

        @method getTaggers
        @return {Array}
        */
        getTaggers: function (all) {
            var allTaggers = [];
            var keys = Object.keys(webTaggers);
            for (var i = 0; i < keys.length; i++) {
                var key = keys[i];
                if (!resolveToValue(webTaggers[key].isDummy, false) || all) {
                    allTaggers.push({
                        name: key,
                        title: key,
                        columnType: key,
                        visible: true
                    });
                }
            }

            return allTaggers;
        },

        /**
        Get list of usable taggers based on track type.

        @method getTypeTaggers
        @return {Array}
        */
        getTypeTaggers: function (typeStr) {
            var ret = [];
            var keys = Object.keys(webTaggers);
            for (var i = 0; i < keys.length; i++) {
                var key = keys[i];
                var allowedTypes = resolveToValue(webTaggers[key].allowedTypes, 'all');
                var allowedTypesArray = allowedTypes.split(',');
                if ((allowedTypesArray.indexOf(typeStr) >= 0) || (allowedTypes === 'all')) {
                    ret.push(key);
                }
            }
            // sort taggers by priority
            ret.sort(function (item1, item2) {
                return webTaggers[item1].getPluginPriority(typeStr) - webTaggers[item2].getPluginPriority(typeStr);
            });
            return ret;
        },

        getStateText: function (state) {
            switch (state) {
                case AT_STATE_UNKNOWN:
                    return _('Unknown');
                case AT_STATE_WAITING:
                    return _('Queued');
                case AT_STATE_IN_PROCESS:
                    return _('Processing');
                case AT_STATE_PROCESSING:
                    return _('Processing');
                case AT_STATE_FINGERPRINTING:
                    return _('Fingerprinting');
                case AT_STATE_LOCATED:
                    return _('Searching');
                case AT_STATE_LOADING_ARTWORK:
                    return _('Searching') + ' ' + _('artwork');
                case AT_STATE_LOADING_LYRICS:
                    return _('Searching') + ' ' + _('lyrics');
                case AT_STATE_FIRSTPASS_DONE:
                    return _('Located');
                case AT_STATE_FAILED:
                    return _('Fail');
                case AT_STATE_SKIPPED:
                    return _('Skip');
                case AT_STATE_DONE:
                    return _('Done');
            }
            return '';
        },

        /**
        Get SearchManager instance. This manager is used to access taggers.

        @method getSearchManager
        @return {SearchManager}
        */
        getSearchManager: function (defaultTagger) {

            /**
            Accessor to all installed taggers. Developer should use this manager to find and tag tracks.

            @class window.SearchManager
            */

            var ret = {
                _tracks: null,
                _batchSize: 0,
                _origTracks: null,
                _batch: [],
                _currentWebTagger: 'dummy',
                _running: 0,
                _results: null,
                _currentBatchProcessed: false,
                _coverArts: [],
                _coverArtSources: [],
                _lookups: [],
                _currentLookups: [],
                _links: [],
                _fingerprinted: [],
                _fingerprintTitles: [],
                _defaults: {
                    _allChecked: false,
                    _autoContinue: false,
                    _detectTagger: false,
                },
                _genresList: null,
                _origValues: [],

                _AutoTagPreferAlbums: null,
                _AutoTagAvoidCompilations: null,
                _AutoTagAudioArtwork: null,
                _AutoTagVideoArtwork: null,
                _fieldsToUpdate: null,

                _ignoredGenres: [_('Genre').toLowerCase()],

                _checkRevertFieldsToUpdate: function () {
                    var oldFields = this._fieldsToUpdate;
                    this._fieldsToUpdate = JSON.parse(app.utils.web.getAutoTagFieldsChecks());

                    // check we need to revert some fields
                    var changed = false;

                    var checkObject = function (data, oldData) {
                        var keys = Object.keys(data);
                        for (var i = 0; i < keys.length; i++)
                            if (oldData[keys[i]] !== data[keys[i]])
                                return true;
                        return false;
                    }

                    if (this._tracks) {
                        if (checkObject(this._fieldsToUpdate['audio'], oldFields['audio']) ||
                            checkObject(this._fieldsToUpdate['video'], oldFields['video'])) {

                            // metadata lookup settings changed so assign old data and run manually applyToTrack
                            //this.assignOrigValues();

                            var tracks = this.getTracks();
                            var origTracks = this.getOrigTracks();

                            if (tracks && origTracks) {
                                var doRefresh = false;
                                tracks.locked(() => {

                                    function getOrigTrackByPath(path) {
                                        var retVal = undefined;
                                        origTracks.locked(function () {
                                            var __origTrack;
                                            for (var i = 0; i < origTracks.count; i++) {
                                                __origTrack = origTracks.getFastObject(i, __origTrack);
                                                if (__origTrack.path === path) {
                                                    retVal = origTracks.getValue(i);
                                                    break;
                                                }
                                            }
                                        });
                                        return retVal;
                                    }

                                    var track;
                                    for (var i = 0; i < tracks.count; i++) {
                                        track = tracks.getFastObject(i, track);
                                        var lookup = this.getCurrentTrackLookup(track.path);
                                        if (lookup) { // we've found current lookup so we need to revert that and apply new based on fields to update
                                            var origTrack = getOrigTrackByPath(track.path);
                                            if (origTrack) {
                                                track.assign(origTrack);
                                                this.getCurrentTagger().applyToTrack(this, track.isVideo ? this._fieldsToUpdate['video'] : this._fieldsToUpdate['audio'], {
                                                    track: track,
                                                    locatedTrack: lookup
                                                });
                                                doRefresh = true;
                                            }
                                        }
                                    }
                                });
                                if (doRefresh) {
                                    this.refresh();
                                }
                            }
                        }
                    }
                },

                init: function () {
                    var _this = this;
                    this.genresList = app.db.getGenresList();
                    this._fieldsToUpdate = JSON.parse(app.utils.web.getAutoTagFieldsChecks());

                    window.localListen(app, 'SettingsChange', () => {

                        this._AutoTagPreferAlbums = null;
                        this._AutoTagAvoidCompilations = null;
                        this._AutoTagAudioArtwork = null;
                        this._AutoTagVideoArtwork = null;
                        this._checkRevertFieldsToUpdate();

                    });

                },

                updateExistingTrackGenre: function (track, genre) {
                    if (this.genresList.isLoaded) {
                        var g = genre.split(';');
                        var newGenre = '';
                        for (var i = 0; i < g.length; i++) {
                            var _genreStr = g[i].trimStart().trimEnd();
                            if (!this._ignoredGenres.includes(_genreStr.toLowerCase()) && _genreStr)
                                if (this.genresList.existsCI(_genreStr)) {
                                    if (newGenre)
                                        newGenre += ';';
                                    newGenre += _genreStr;
                                }
                        }

                        track.genre = newGenre;

                    } else {
                        this.genresList.whenLoaded().then(function () {
                            this.updateExistingTrackGenre(track, genre);
                        }.bind(this));
                    }
                },

                getCurrentTagger: function () {
                    return webTaggers[this._currentWebTagger];
                },

                getAlbumInfo: function (data) {
                    return new Promise(function (resolve) {
                        data.getTrackTypeAsync().then(function (tt) { // to be sure, we have trackType initialized
                            if (window._cleanUpCalled)
                                return;
                            var taggers = autoTagFramework.getTypeTaggers(tt);
                            if (!taggers.length) {
                                var all = autoTagFramework.getTaggers(true);
                                all.forEach(function (tagger) {
                                    taggers.push(tagger.name);
                                });
                            }
                            if (taggers.length) {
                                webTaggers[taggers[0]].getAlbumInfo(data).then(function (info) {
                                    resolve(info);
                                });
                            }
                        });
                    });
                },

                groupAlbums: function () {
                    return true;
                },

                getSeparator: function () {
                    var _this = this;
                    if (!this._separator) {
                        var loadSettings = function () {
                            var sett = settings.get('Appearance');
                            _this._separator = sett.Appearance.MultiStringSeparator;
                        }
                        window.localListen(app, 'settingsChange', function () {
                            loadSettings();
                        });
                        loadSettings();
                    }
                    return this._separator;
                },

                preferAlbums: function () {
                    if (this._AutoTagPreferAlbums === null) {
                        var sett = settings.get('Options');
                        this._AutoTagPreferAlbums = sett.Options.AutoTagPreferAlbums;
                    }
                    return this._AutoTagPreferAlbums;
                },

                avoidCompilations: function () {
                    if (this._AutoTagAvoidCompilations === null) {
                        var sett = settings.get('Options');
                        this._AutoTagAvoidCompilations = sett.Options.AutoTagAvoidCompilations;
                    }
                    return this._AutoTagAvoidCompilations;
                },

                addAdditional: function () {
                    if ((this._AutoTagAudioArtwork === null) || (this._AutoTagVideoArtwork === null)) {
                        var sett = settings.get('Options');
                        this._AutoTagAudioArtwork = sett.Options.AutoTagAudioArtwork;
                        this._AutoTagVideoArtwork = sett.Options.AutoTagVideoArtwork;
                    }
                    return {
                        addArtwork: {
                            audio: this._AutoTagAudioArtwork,
                            video: this._AutoTagVideoArtwork,
                        }
                    };
                },

                getFieldsToUpdate: function (forAudio) {
                    var data = JSON.parse(app.utils.web.getAutoTagFieldsChecks());
                    if (forAudio !== undefined)
                        return data[forAudio ? 'audio' : 'video'];
                    else
                        return data;
                },

                setFieldsToUpdate: function (data) {
                    app.utils.web.setAutoTagFieldsChecks(JSON.stringify(data));
                },

                /**
                Set new tagger manager should use to find and tag.

                @method changeTagger
                */
                changeTagger: function (newTaggerKey) {
                    this._currentWebTagger = newTaggerKey;
                },
                /**
                Start searching.

                @method scriptedStartSearch
                */
                scriptedStartSearch: function () {
                    this._cancel = false;
                    this._running++;
                    if (this._currentBatchProcessed) {
                        this.nextBatch();
                    }
                    this.assignOrigValues().then(function (assigned) {
                        if (assigned) {
                            return this.startSearch().then1(function (res) {
                                if (!this.isCanceled()) {
                                    this.notifyBatchFinished();
                                    this._currentBatchProcessed = true;
                                    if (res) {
                                        if (this._batch.length && this._defaults._autoContinue) { // there's more than one in the batch
                                            if (this.nextBatch())
                                                this.scriptedStartSearch();
                                        }
                                    }
                                }
                                this._running--;
                                return res;
                            }.bind(this));
                        } else {
                            return new Promise(function (resolve) {
                                resolve();
                            });
                        }
                    }.bind(this));
                },
                /**
                Get state if any search is running (in progress).

                @method isRunning
                @return boolean
                */
                isRunning: function () {
                    return this._running > 0;
                },

                isCanceled: function () {
                    return window._cleanUpCalled || !!this._cancel;
                },

                startSearch: function () {
                    assert(this._running > 0, 'Do not call startSearch directly .. instead call scriptedStartSearch!');
                    return new Promise(function (resolve, reject) {
                        if (!this._tracks) {
                            reject();
                            return;
                        }

                        if (this._defaults._detectTagger) {
                            var taggers = this.detectTagger();
                            if (taggers && taggers.length && this._currentWebTagger != taggers[0]) {
                                var oldRunningVal = this._running;
                                this.changeTagger(taggers[0]);
                                var newRunningVal = this._running;
                                if (oldRunningVal != newRunningVal) { // change tagger was probably overrided and run scriptedStartSearch so exit this loop
                                    this._running--;
                                    return;
                                }
                            }
                        }

                        this._tracks.setAutoTagStateAsync(AT_STATE_IN_PROCESS).then(function () {
                            this.finishSearch();
                            return webTaggers[this._currentWebTagger].startSearch(this);
                        }.bind(this)).then1(function (res) {
                            resolve(res);
                        }.bind(this));
                    }.bind(this));
                },

                cancel: function () {
                    if (this._running) {
                        this._cancel = true;


                    }
                },

                getTaggerCopyrightInfo: function (forType) {
                    var tagger;
                    if (forType === undefined) {
                        tagger = webTaggers[this._currentWebTagger];
                    } else {
                        var taggers = autoTagFramework.getTypeTaggers(forType);
                        if (taggers && taggers.length)
                            tagger = taggers[0];
                    }
                    if (tagger)
                        return tagger.getCopyrightInfo();
                    return new Promise(function (resolve) {
                        resolve('');
                    });
                },

                whenReady: function () {
                    var _this = this;
                    return new Promise(function (resolve, reject) {
                        var waitTillFinished = function () {
                            if (_this.isRunning() && _this.isCanceled()) {
                                requestTimeout(() => {
                                    waitTillFinished();
                                }, 100);
                            } else {
                                _this._cancel = false;
                                resolve();
                            }
                        };
                        waitTillFinished();
                    });
                },

                /**
                Notify one batch is finished

                @method notifyBatchFinished
                */
                notifyBatchFinished: function () {

                },

                /**
                Method to clean up data when search is done.

                @method finishSearch
                */
                finishSearch: function () {
                    if (this._currentWebTagger && webTaggers[this._currentWebTagger]) {
                        webTaggers[this._currentWebTagger].finishSearch(this);
                        webTaggers[this._currentWebTagger].cleanUp();
                    }
                },

                /**
                Detect usable taggers based on track type.

                @method detectTagger
                @return {Array}
                */
                detectTagger: function () {
                    if (this._tracks) {
                        var types = [];
                        var track = undefined;
                        this._tracks.locked(function () {
                            for (var i = 0; i < this._tracks.count; i++) {
                                track = this._tracks.getFastObject(i, track);
                                var type = track.trackTypeStringId;
                                if (types.indexOf(type) < 0) {
                                    types.push(type);
                                    break;
                                }
                            }
                        }.bind(this));
                        if (types.length)
                            return autoTagFramework.getTypeTaggers(types[0]);
                    }
                    return ['dummy'];
                },

                nextBatch: function () {
                    this._tracks = null;
                    this._origTracks = null;
                    this._results = null;
                    this._batchSize = 0;
                    this._currentBatchProcessed = false;
                    if (this._batch.length) {
                        var batchClass = this._batch.shift();
                        this._origTracks = batchClass.data;
                        this._tracks = this._origTracks.getTemporaryCopies();
                        this._tracks.whenLoaded().then(() => {
                            if (this._defaults._allChecked) {
                                this._tracks.setAllChecked(true);
                            }
                            this._batchSize = this._tracks.count;
                            this._tracks.locked(() => {
                                var track;
                                for (var i = 0; i < this._tracks.count; i++) {
                                    track = this._tracks.getFastObject(i, track);
                                    this._origValues[track.path] = {
                                        title: track.title,
                                        artist: track.artist
                                    };
                                }
                            });
                            this.notifyNextBatch(batchClass.info);
                        });
                    }
                    return this._tracks;
                },

                batchEmpty: function () {
                    return !this._batch.length;
                },

                currentBatchSize: function () {
                    return this._batchSize;
                },

                /**
                Add tracks from another search manager instance (including batches).

                @method importTracks
                @param {SearchManager} anotherManager another search manager instance
                */
                importTracks: function (anotherManager) {
                    var _this = this;
                    return new Promise(function (resolve, reject) {
                        var batchIdx = -1;
                        var addList = function (list) {
                            if (!list)
                                resolve();
                            else {
                                _this.addTracks(list, true).then1(() => {
                                    if (anotherManager._batch.length > batchIdx + 1) {
                                        addList(anotherManager._batch[++batchIdx].data);
                                    } else
                                        resolve();
                                });
                            }
                        };
                        var l = anotherManager.getOrigTracks();
                        if (l) {
                            l.notifyLoaded();
                            addList(l);
                        } else {
                            resolve();
                        }
                    });
                },

                /**
                Add tracks batch to the search engine .. tracks are handled in batches (batch can be a tracks from one folder etc.).

                @method addTracks
                @return {Promise}
                */
                addTracks: function (newTracks, detectTagger) {
                    var _this = this;
                    return new Promise(function (resolve, reject) {
                        this._defaults._detectTagger = detectTagger;
                        if (!newTracks || !newTracks.count) {
                            reject();
                            return;
                        }

                        newTracks.splitToBatches().then(function (list) {

                            var adder = function (range, from, to) {
                                _this._batch.push({
                                    data: range,
                                    info: {
                                        fromIndex: from,
                                        toIndex: to
                                    }
                                });
                            };

                            list.locked(() => {
                                var from = 0;
                                for( var i = 0; i < list.count; i++) {
                                    var l = list.getValue(i);
                                    adder(l, from, from + (l.count - 1));
                                    from += l.count;
                                }
                            });

                            newTracks.setAutoTagStateAsync(AT_STATE_WAITING).then(function () {
                                if (!this._tracks || (this._currentBatchProcessed && this._defaults._autoContinue)) {
                                    this.nextBatch();
                                    if (this._tracks && !this.isRunning()) {
                                        this._tracks.whenLoaded().then(function () {
                                            this.scriptedStartSearch();
                                            resolve();
                                        }.bind(this));
                                    } else
                                        resolve();
                                } else
                                    resolve();
                            }.bind(this));


                        }.bind(this));

                    }.bind(this));
                },

                /**
                Get tracks to be tagged.

                @method getTracks
                @return {TrackList}
                */
                getTracks: function () {
                    return this._tracks;
                },
                /**
                Get original tracks.

                @method getOrigTracks
                @return {TrackList}
                */
                getOrigTracks: function () {
                    return this._origTracks;
                },
                /**
                Commit all changes to original tracks.

                @method commitAsync
                */
                commitAsync: function () {
                    return new Promise(function (resolve) {
                        let _this = this;
                        let origTracks = this.getOrigTracks();

                        if (!origTracks) {
                            resolve();
                            return;
                        }

                        let additionals = this.addAdditional();

                        let lst = this._tracks.getTemporaryCopies();
                        lst.whenLoaded().then(function() {
                            let __covers = [];
                            let __links = [];

                            lst.locked(function() {
                                let track;
                                for (let i = 0; i < lst.count; i++) {
                                    track = lst.getFastObject(i, track);
                                    let path = track.path;
                                    __covers[path] = _this._coverArts[path];
                                    __links[path] = _this._links[path];
//                                    ODS('--- assigned ' + __covers[path] + ' for ' + path);
                                }
                            });

                            origTracks.assignFrom({
                                tracks: lst,
                                assignAudioCovers: additionals.addArtwork.audio,
                                assignVideoCovers: additionals.addArtwork.video,
                                covers: __covers,
                                links: __links,
                                save: true
                            }).then(function () {
                                origTracks = undefined;
                                lst = undefined;
                                resolve();
                            });
                        });

                    }.bind(this));
                },

                getTrackOrigValues: function (trackID) {
                    return this._origValues[trackID];
                },

                setTrackLinks: function (trackID, links) {
                    this._links[trackID] = links;
                },

                getTrackLinks: function (trackID) {
                    return this._links[trackID];
                },

                assignLinks: function (track) {
                    track.removeLink();
                    var links = this._links[track.path];
                    if (links && links.forEach) {
                        links.forEach(function (link) {
                            var linkType = link.linkType;
                            var info = link.info;
                            var link = link.link;
                            if (typeof linkType !== 'string')
                                linkType = linkType.toString();
                            if (typeof info !== 'string')
                                info = info.toString();
                            if (typeof link !== 'string')
                                link = link.toString();
                            track.addLink(linkType, info, link);
                        });
                    }
                },

                /**
                Returns true when any track is changed so confirmation is required.

                @method confirmRequired
                @return {boolean}
                */
                confirmRequired: function () {
                    if (!this._tracks || !this._origTracks) return false;

                    var tracks = this._tracks;
                    var origTracks = this._origTracks;

                    var res = false;
                    var track1;
                    var track2;
                    tracks.locked(function () {
                        origTracks.locked(function () {
                            for (var i = 0; i < tracks.count; i++) {
                                track1 = tracks.getFastObject(i, track1);
                                track2 = origTracks.getFastObject(i, track2);

                                res = (track1.title !== track2.title) ||
                                    (track1.artist !== track2.artist) ||
                                    (track1.album !== track2.album) ||
                                    (track1.trackNumberInt !== track2.trackNumberInt);

                                if (res)
                                    break;
                            }
                        });
                    });
                    return res;
                },

                // virtual methods
                assignOrigValues: function () {
                    return new Promise(function (resolve) {
                        var newTracks = this.getTracks();
                        var origTracks = this.getOrigTracks();
                        if (newTracks && origTracks) {
                            newTracks.assignFrom({
                                tracks: origTracks,
                                assignAudioCovers: false,
                                assignVideoCovers: false,
                                save: false
                            }).then(function () {
                                resolve(true);
                            });
                        } else {
                            resolve(false);
                        }
                    }.bind(this));
                },
                getArtworkLink: function (trackID) {
                    return this._coverArts[trackID];
                },
                setArtworkLink: function (trackID, fn) {
                    this._coverArts[trackID] = fn;
                },
                getSourceInfo: function (trackID) {
                    return this._coverArtSources[trackID];
                },
                setSourceInfo: function (trackID, info) {
                    this._coverArtSources[trackID] = info;
                },

                /**
                Set current track lookup.

                @method setCurrentTrackLookup
                @param {string} trackID Unique track identifier (path is preferred)
                @param {object} lookup Current track lookup
                */
                setCurrentTrackLookup: function (trackID, lookup) {
                    this._currentLookups = this._currentLookups || [];
                    this._currentLookups[trackID] = lookup;
                    lookup.genre = this.normalizeGenres(lookup.genre);
                },

                /**
                Returns current track lookup.

                @method getCurrentTrackLookup
                @param {string} trackID Unique track identifier (path is preferred)
                @return {object}
                */
                getCurrentTrackLookup: function (trackID) {
                    this._currentLookups = this._currentLookups || [];
                    return this._currentLookups[trackID];
                },

                /**
                Returns all lookups of the track in the JS array.

                @method getTrackLookups
                @param {string} trackID Unique track identifier (path is preferred)
                @return {Array}
                */
                getTrackLookups: function (trackID) {
                    this._lookups[trackID] = this._lookups[trackID] || [];
                    return this._lookups[trackID];
                },

                /**
                Add track lookup to his lookups. Tagger is responsible for adding lookup object with properties like title, artist, album etc. as a variants user can choose from.

                @method addTrackLookup
                @param {string} trackID Unique track identifier (path is preferred)
                @param {object} lookup Track lookup class
                */
                addTrackLookup: function (trackID, lookup, lookupSource) {
                    var deniedValues = ['track', 'unkno'];
                    var _this = this;
                    this._lookups[trackID] = this._lookups[trackID] || [];

                    // check content
                    var cnt = 0;

                    if (lookup.title != undefined) if ((deniedValues.indexOf(lookup.title.slice(0, 5).toLowerCase()) >= 0) || (lookup.title == "")) cnt++;
                    if (lookup.artist != undefined) if ((deniedValues.indexOf(lookup.artist.slice(0, 5).toLowerCase()) >= 0) || (lookup.artist == "")) cnt++;
                    if (lookup.albumArtist != undefined) if ((deniedValues.indexOf(lookup.albumArtist.slice(0, 5).toLowerCase()) >= 0) || (lookup.albumArtist == "")) cnt++;
                    if (lookup.album != undefined) if ((deniedValues.indexOf(lookup.album.slice(0, 5).toLowerCase()) >= 0) || (lookup.album == "")) cnt++;

                    if (cnt > 1) // more than one main property is wrong
                        return false;

                    if (lookup && typeof lookup === 'object')
                        lookup.lookupSource = lookupSource;
                    if (!this._lookups[trackID].some(function (item) {
                        var ret = (item.album === lookup.album) &&
                            (item.albumArtist === lookup.albumArtist) &&
                            (item.albumType === lookup.albumType);
                        if (ret) { // update info
                            if (!item.number) item.number = lookup.number;
                            if (!item.title) item.title = lookup.title;
                            if (!item['artist-credit'] || !item['artist-credit'].length) item['artist-credit'] = lookup['artist-credit'];
                            if (!item.artist) item.artist = lookup.artist;
                            if (!item.genre) item.genre = _this.normalizeGenres(lookup.genre);
                            if (!item.date) item.date = lookup.date;
                            if (!item.length) item.length = lookup.length;
                            if (!item.involvedPeople) item.involvedPeople = lookup.involvedPeople;
                            if (!item.composer) item.composer = lookup.composer;
                            if (!item.lyricist) item.lyricist = lookup.lyricist;
                            if (!item.publisher) item.publisher = lookup.publisher;
                            if (!item.release) item.release = lookup.release;
                            if (!item.releaseGroup) item.releaseGroup = lookup.releaseGroup;
                            if (!item.recording) item.recording = lookup.recording;
                            if (!item.albumType) item.albumType = lookup.albumType;
                        }
                        return ret;
                    })) {
                        this._lookups[trackID].push(copyObject(lookup));
                    }
                    return true;
                },

                normalizeGenres: function (genres) {
                    return genres;
                },

                /**
                Returns all fingerprinted titles of the track in the JS array.

                @method getTrackFingerprintTitles
                @param {string} trackID Unique track identifier (path is preferred)
                @return {Array}
                */
                getTrackFingerprintTitles: function (trackID) {
                    this._fingerprintTitles[trackID] = this._fingerprintTitles[trackID] || [];
                    return this._fingerprintTitles[trackID];
                },

                /**
                Add track fingerprinted title.

                @method setTrackFingerprintTitles
                @param {string} trackID Unique track identifier (path is preferred)
                @param {string} title Track title
                */
                setTrackFingerprintTitles: function (trackID, title) {
                    this._fingerprintTitles[trackID] = this._fingerprintTitles[trackID] || [];
                    if (this._fingerprintTitles[trackID].indexOf(title) < 0) {
                        this._fingerprintTitles[trackID].push(title);
                    }
                },



                /**
                Make additional lookup based on title and artist or using fingerprint (if track wasn't fingerprinted yet).

                @method searchMoreByTracks
                @param {TrackList} tracklist to lookup
                @param {boolean} prefer fingerprinting
                */
                searchMoreByTracks: function (list, preferFingerprint) {
                    return webTaggers[this._currentWebTagger].searchMoreByTracks(this, list, preferFingerprint);
                },

                refresh: function () {},

                artworkSearch: function (path, finished) {},

                // Notifications
                notifyError: function (code, info, errorCode) {},

                notifyNextBatch: function (info) {},

                notifyProgress: function (current, total, label) {},

                notifyTrackProgress: function (track, state) {},

                notifyTrackFingerprinted: function (trackPath) {
                    this._fingerprinted[trackPath] = true;
                },

                wasFingerprinted: function (trackPath) {
                    return !!this._fingerprinted[trackPath];
                },

            };

            ret.init();
            return ret;
        },


    };

})();

// register web tagger engines
requirejs('helpers/searchDummy.js', null, true /*isolated*/ );
