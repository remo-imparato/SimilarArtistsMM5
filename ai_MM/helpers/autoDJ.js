/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

'use strict';
registerFileImport('helpers/autoDJ');
// This unit manages player's "Auto DJ" feature and its sources
window.autoDJ = {
    getCurrentSource: function () {
        // currently selected source, the default is entire library
        let res = autoDJ.sources[app.player.autoDJ.source];
        if (!res)
            res = autoDJ.sources['library'];
        return res;
    },
    sources: {
        // sources object, this is the list of all sources, addons can add its own source to this list
        library: {
            name: function () {
                return _('Entire Library');
            },
            order: 10,
            execute: function (addCount) {
                return autoDJ.getRandomList(app.db.getTracklist('SELECT * FROM Songs ORDER BY RANDOM(*) LIMIT ' + addCount * 10, -1), addCount);
            }
        },
        playlist: {
            name: function () {
                return _('Playlist');
            },
            order: 20,
            loadConfig: function (panel) {
                this.playlistID = app.player.autoDJ.playlistID;
                panel.innerHTML =
                    '<div class="flex row maskEdit">' +
                        '  <input class="fill" type="text" readonly="true" />' +
                        '  <div class="button">' + _('Choose') + '</div>' +
                        '</div>';
                this.edit = qe(panel, '[type=text]');
                this.edit.value = 'Accessible Tracks';
                this.button = qe(panel, '[class=button]');
                this._onButtonClick = function () {
                    let dlg = uitools.openDialog('dlgSelectPlaylist', {
                        modal: true,
                    });
                    dlg.whenClosed = function () {
                        if (dlg.modalResult == 1) {
                            let playlist = dlg.getValue('getPlaylist')();
                            if (playlist) {
                                this.playlistID = playlist.id;
                                this.edit.value = playlist.name;
                            }
                        }
                    }.bind(this);
                    app.listen(dlg, 'closed', dlg.whenClosed);
                }.bind(this);
                app.listen(this.button, 'click', this._onButtonClick);
                this.button.tabIndex = 0;
                this._onKeyDown = app.listen(this.button, 'keydown', (e) => {
                    if (friendlyKeyName(e) === 'Enter') {
                        this._onButtonClick();
                        e.stopPropagation();
                        e.preventDefault();
                    }
                });
                app.getObject('playlist', {
                    id: app.player.autoDJ.playlistID
                }).then(function (playlist) {
                    this.edit.value = playlist.name;
                }.bind(this));
            },
            saveConfig: function ( /*panel*/) {
                app.unlisten(this.button, 'click', this._onButtonClick);
                app.unlisten(this.button, 'keydown', this._onKeyDown);
                app.player.autoDJ.playlistID = this.playlistID;
            },
            execute: function (addCount) {
                return new Promise(function (resolve, reject) {
                    app.getObject('playlist', {
                        id: app.player.autoDJ.playlistID
                    }).then(function (playlist) {
                        let tracks = playlist.getTracklist();
                        autoDJ.getRandomList(tracks, addCount).then(function (list) {
                            resolve(list);
                        });
                    }, reject);
                }.bind(this));
            }
        },
        collection: {
            name: function () {
                return _('Collection');
            },
            order: 30,
            loadConfig: function (panel) {
                panel.innerHTML =
                    '<div class="flex row maskEdit">' +
                        '  <div data-control-class="Dropdown" data-init-params="{readOnly: true}"></div>' +
                        '</div>';
                this.dropdown = qe(panel, '[data-control-class=Dropdown]');
                initializeControl(this.dropdown);
                app.collections.getCollectionListAsync({
                    cacheVisibility: false,
                    includeEntireLibrary: false
                }).then(function (list) {
                    this.collList = list;
                    let stringList = newStringList();
                    let collName = '';
                    list.forEach(function (coll) {
                        stringList.add(coll.name);
                        if (coll.id == app.player.autoDJ.collectionID)
                            collName = coll.name;
                    }.bind(this));
                    this.dropdown.controlClass.dataSource = stringList;
                    let index = stringList.indexOf(collName);
                    if (index < 0)
                        this.dropdown.controlClass.focusedIndex = 0;
                    else
                        this.dropdown.controlClass.focusedIndex = index;
                }.bind(this));
            },
            saveConfig: function (panel) {
                this.collList.locked(function () {
                    this._coll = this.collList.getFastObject(this.dropdown.controlClass.focusedIndex, this._coll);
                    app.player.autoDJ.collectionID = this._coll.id;
                }.bind(this));
            },
            execute: function (addCount) {
                return autoDJ.getRandomList(app.db.getTracklist('SELECT * FROM Songs', app.player.autoDJ.collectionID), addCount);
            }
        },
    },
    /*
      getRandomList is just helper function to get X random tracks that were not played recently and are accessible for playing
    */
    getRandomList: function (tracks, addCount) {
        return new Promise(function (resolve, reject) {
            tracks.autoUpdateDisabled = true; // disable auto update to avoid unnecessary updates
            tracks.dontNotify = true; // disable notifications to avoid unnecessary updates
            tracks.whenLoaded().then(function () {
                // filter dead links
                tracks.getAccessibleAsync().then(function (accessible) {
                    let playqueue = app.player.getSongList().getTracklist();
                    playqueue.whenLoaded().then(() => {
                        let exludeIDs = [];
                        playqueue.locked(function () {
                            let CHECK_MAX = addCount * 4;
                            let i = 0;
                            if (playqueue.count > CHECK_MAX) // check the last CHECK_MAX tracks in the now playing queue
                                i = playqueue.count - CHECK_MAX;
                            let t = undefined;
                            for (i; i < playqueue.count; i++) {
                                t = playqueue.getFastObject(i, t);
                                exludeIDs.push(t.id);
                            }
                        });
                        // filter tracks that were played recently or are in playback queue and select random tracks
                        let retList = app.utils.createTracklist();
                        retList.autoUpdateDisabled = true; // disable auto update to avoid unnecessary updates
                        retList.dontNotify = true; // disable notifications to avoid unnecessary updates
                        accessible.randomize();
                        fastForEach(accessible, function (t) {
                            if (t.lastTimePlayed < (Date.now() - 2 * 60 * 60 * 1000 /* 2 hours not played */))
                                if (exludeIDs.indexOf(t.id) < 0) // is not in the NP queue
                                    retList.add(t);
                            return (retList.count >= addCount);
                        });
                        ODS(sprintf('autoDJ.getRandomList(tracks.count = %d, accessible.count = %d, playqueue.count = %d, addCount = %d, exludeIDs.length = %d, retList.count = %d)', tracks.count, accessible.count, playqueue.count, addCount, exludeIDs.length, retList.count));
                        ODS('autoDJ: tracks = ' + listGetCommaIDs(tracks, 10));
                        ODS('autoDJ: accessible = ' + listGetCommaIDs(accessible, 10));
                        ODS('autoDJ: result = ' + listGetCommaIDs(retList));
                        resolve(retList);
                    });
                });
            });
        });
    },
    checkPerforming: function (state) {
        let player = app.player;
        if (state == 'trackChanged') {
            if (player.autoDJ.enabled) {
                let track = player.getCurrentTrack();
                if (track && !track.getPlaybackRule('isAutoDjIgnored')) {
                    track.isAccessibleAsync().then((res) => {
                        if (!res && (player.entriesCount - player.getCountOfPlayedEntries() == 1)) {
                            ODS('autoDJ: track is not accessible:' + track.summary + ', but it is the LAST track, we need to perform...');
                            res = true;
                        }
                        if (res) {
                            ODS('autoDJ: to be performed (track is accessible:' + track.summary + ')');
                            let source = autoDJ.getCurrentSource();
                            let numberToAdd = player.autoDJ.addTrackCount - (player.entriesCount - player.getCountOfPlayedEntries()) + 1;
                            if (numberToAdd > 0 && !window.autoDJ.isPerforming) {
                                window.autoDJ.isPerforming = true;
                                source.execute(numberToAdd).then(function (tracks) {
                                    player.addTracksAsync(tracks).then(() => {
                                        window.autoDJ.isPerforming = false;
                                    });
                                });
                            }
                        }
                        else {
                            ODS('autoDJ: skipped as track is not accessible:' + track.summary);
                        }
                    });
                }
                else {
                    if (track)
                        ODS('autoDJ: not enabled for track:' + track.summary);
                    else
                        ODS('autoDJ: no current track');
                }
            }
            else {
                ODS('autoDJ: not enabled');
            }
        }
    }
};
