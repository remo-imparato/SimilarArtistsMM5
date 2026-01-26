/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

'use strict';
import DataSourceObject from './dataSourceObject';
/**
ArtistDataSource object, for use in artist views

@class ArtistDataSource
@constructor
@extends DataSourceObject
*/
export default class ArtistDataSource extends DataSourceObject {
    initialize(artistObj, params) {
        super.initialize(artistObj, params);
        if (this.dataObject)
            this.isVariousArtist = _utils.isVariousArtist(this.dataObject.name);
    }
    fetchArtistInfo(id) {
        if (!this._promises.fetchArtistInfo) {
            let taskid = this.beginTask(_('Getting') + ' ' + _('artist info'));
            this._promises.fetchArtistInfo = this.localPromise(uitools.getMusicBrainz().getArtistInfo(this.uniqueID, id)).then(function (artObj) {
                this.endTask(taskid);
                this._promises.fetchArtistInfo = undefined;
                if (artObj) {
                    this.wasError = false;
                    if (!this.onlineData) {
                        this.onlineData = artObj;
                        this.notifyChange({
                            senderID: this.uniqueID,
                            onlyOnline: true
                        });
                    }
                }
                else {
                    this.wasError = true;
                }
            }.bind(this), function () {
                this._promises.fetchArtistInfo = undefined;
                this.endTask(taskid);
            }.bind(this));
        }
        return this._promises.fetchArtistInfo;
    }
    switchToOtherArtist(i) {
        if (this.foundArtists && (i >= 0) && (this.foundArtists.length > i)) {
            this.cache.foundArtistsSelect.focusedIndex = i;
            this.notifyChange({
                senderID: this.uniqueID,
                eventType: 'clear',
                clearAll: false,
                onlyOnline: true
            });
            this.onlineData = undefined;
            this.cache = {
                foundArtists: this.cache.foundArtists,
                foundArtistsSelect: this.cache.foundArtistsSelect
            };
            let art = this.cache.foundArtists[i];
            if (!art.isAnother) // not "Another artist"
                this.fetchArtistInfo(art.id);
            else if (this.artist) {
                this.artist.mbgid = '0';
                if (this.artist.id > 0)
                    this.artist.commitAsync();
                this.onlineData = art;
                this.notifyChange({
                    senderID: this.uniqueID,
                    onlyOnline: true
                });
            }
        }
    }
    searchArtists() {
        if (!this.artist || this.isVariousArtist)
            return dummyPromise();
        if (this.cache && this.cache.foundArtists && this.cache.foundArtistsSelect) {
            return dummyPromise();
        }
        if (!this._promises.searchArtists) {
            let taskid = this.beginTask(_('Searching') + ' ' + _('artist'));
            this._promises.searchArtists = this.localPromise(uitools.getMusicBrainz().findArtistPrepareSelection(this.uniqueID, this.artist)).then(function (res) {
                this._promises.searchArtists = undefined;
                this.endTask(taskid);
                if (!res)
                    return;
                let dschanged = false;
                if (!this.cache.foundArtists || !this.cache.foundArtistsSelect) {
                    this.cache.foundArtists = res.artists;
                    this.cache.foundArtistsSelect = res.artistsSL;
                    dschanged = true;
                }
                if (!this.onlineData) {
                    dschanged = true;
                    this.onlineData = res.artists[res.artistsSL.focusedIndex];
                }
                this.foundArtists = this.cache.foundArtists;
                this.foundArtistsSelect = this.cache.foundArtistsSelect;
                if (dschanged) {
                    this.notifyChange({
                        senderID: this.uniqueID,
                        onlyOnline: true
                    });
                }
            }.bind(this), function () {
                this._promises.searchArtists = undefined;
                this.endTask(taskid);
            }.bind(this));
        }
        return this._promises.searchArtists;
    }
    fetchMBData() {
        if ((this._fetchDataTimeout === undefined) && !this.isVariousArtist) {
            this._fetchDataTimeout = this.requestTimeout(function () {
                this._fetchDataTimeout = null; // different from undefined
                let taskid;
                if (this.artist.mbgid && (this.artist.mbgid !== '0')) {
                    this.mbgidIsGuessed = false;
                    this.fetchArtistInfo(this.artist.mbgid, true /* show error */).then(function () {
                        if (!this.wasError)
                            this.searchArtists(); // search for alternate artists only if there was no download error
                    }.bind(this));
                }
                else {
                    this.mbgidIsGuessed = (this.artist.mbgid !== '0'); // '0' is special value for "Another artist", i.e. artist not paired with MB            
                    this.searchArtists();
                }
            }.bind(this), 500);
        }
    }
    readAllOnlineTracks() {
        if (!this.artist || this.isVariousArtist)
            return dummyPromise();
        if (this.cache && this.cache.allOnlineTracks) {
            return dummyPromise(this.cache.allOnlineTracks);
        }
        if (this.artist.mbgid === '0')
            return dummyPromise();
        if (!this._promises.allOnlineTracks) {
            if (!this.artist.mbgid) {
                let taskid;
                this._promises.allOnlineTracks = this.searchArtists().then(function () {
                    taskid = this.beginTask(_('Getting') + ' ' + _('tracks'));
                    return uitools.getMusicBrainz().getArtistTracks(this.uniqueID, this.artist.mbgid).then(function (allTracksDS) {
                        this._promises.allOnlineTracks = undefined;
                        this.endTask(taskid);
                        if (allTracksDS) {
                            this.cache.allOnlineTracks = allTracksDS;
                            return allTracksDS;
                        }
                    }.bind(this), function () {
                        this._promises.allOnlineTracks = undefined;
                        this.endTask(taskid);
                    }.bind(this));
                }.bind(this), function () {
                    this._promises.allOnlineTracks = undefined;
                    this.endTask(taskid);
                }.bind(this));
            }
            else {
                let taskid = this.beginTask(_('Getting') + ' ' + _('tracks'));
                this._promises.allOnlineTracks = uitools.getMusicBrainz().getArtistTracks(this.uniqueID, this.artist.mbgid).then(function (allTracksDS) {
                    this._promises.allOnlineTracks = undefined;
                    this.endTask(taskid);
                    if (allTracksDS) {
                        this.cache.allOnlineTracks = allTracksDS;
                        return allTracksDS;
                    }
                }.bind(this), function () {
                    this._promises.allOnlineTracks = undefined;
                    this.endTask(taskid);
                }.bind(this));
            }
        }
        return this._promises.allOnlineTracks;
    }
    readAllTracks(pars) {
        if (!this.artist)
            return dummyPromise();
        pars = pars || {};
        if (this.cache && this.cache.allTracks && !pars.topTracksSort) {
            if (pars.sortString) {
                return new Promise(function (resolve) {
                    if (this.cache && this.cache.allTracks && !pars.topTracksSort) {
                        this._ds.cache.allTracks.setAutoSortAsync(pars.sortString).then(function () {
                            resolve(this._ds.cache.allTracks);
                        }.bind(this));
                    }
                }.bind(this));
            }
            else {
                return dummyPromise(this.cache.allTracks);
            }
        }
        if (!this._promises.allTracks || pars.topTracksSort) {
            this._promises.allTracks = new Promise(function (resolve, reject) {
                if (this.cache.allTracks && (!pars.topTracksSort || (this.cache.allTracks.autoSortString === 'playOrder ASC'))) {
                    this._promises.allTracks = undefined;
                    resolve(this.cache.allTracks);
                    return;
                }
                let tracklist = undefined;
                if (!this._promises.getTracklist) {
                    if (!pars.topTracksSort)
                        pars.sortString = pars.sortString || 'date ASC;album ASC;order ASC;title ASC';
                    tracklist = this.artist.getTracklist(pars);
                    this._promises.getTracklist = tracklist.whenLoaded();
                }
                this._promises.getTracklist.then(function () {
                    this._promises.getTracklist = undefined;
                    this._promises.allTracks = undefined;
                    this.cache.allTracks = tracklist;
                    resolve(this.cache.allTracks);
                }.bind(this), function (err) {
                    this._promises.getTracklist = undefined;
                    this._promises.allTracks = undefined;
                    reject(err);
                }.bind(this));
            }.bind(this));
        }
        return this._promises.allTracks;
    }
    cancelDownloads() {
        if (searchTools.interfaces.artistSearch)
            searchTools.cancelSearch(searchTools.interfaces.artistSearch, this.uniqueID);
        if ((this._fetchDataTimeout !== undefined) && (this._fetchDataTimeout !== null)) {
            clearTimeout(this._fetchDataTimeout);
        }
        this._fetchDataTimeout = undefined;
        super.cancelDownloads();
    }
    get artist() {
        return this.dataObject;
    }
    set artist(artObj) {
        if (this.dataObject && (this.dataObject !== artObj)) {
            this.cleanUp();
        }
        this.dataObject = artObj;
    }
}
registerClass(ArtistDataSource);
