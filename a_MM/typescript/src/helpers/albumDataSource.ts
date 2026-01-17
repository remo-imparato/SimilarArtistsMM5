'use strict';

import DataSourceObject from './dataSourceObject';


/**
AlbumDataSource object, for use in album views

@class AlbumDataSource
@constructor
@extends DataSourceObject
*/

export default class AlbumDataSource extends DataSourceObject {
    private _fetchDataTimeout: number;

    initialize(albumObj, params) {
        super.initialize(albumObj, params);
    }

    fetchReleaseInfo() {
        this.onlineData = this.onlineData || {};
        if ((!this.album) || (this.album.mbgid === '0') || this.onlineData.release) {
            return dummyPromise();
        }
        if (!this._promises.fetchReleaseInfo) {
            this._promises.fetchReleaseInfo = this.localPromise(uitools.getMusicBrainz().getReleaseInfo(this.uniqueID, this.album.mbgid)).then(function (dsObj) {
                this._promises.fetchReleaseInfo = undefined;
                if (dsObj) {
                    this.onlineData.release = dsObj.release;
                    this.onlineData._releaseHasCover = dsObj.isCover;
                    this.onlineData.year = dsObj.year;
                    this.notifyChange({
                        senderID: this.uniqueID,
                        onlyOnline: true
                    });
                }
            }.bind(this), function () {
                this._promises.fetchReleaseInfo = undefined;
            }.bind(this));
        }
        return this._promises.fetchReleaseInfo;
    }

    parseReleaseGroupInfo(rgObj) {
        if (!rgObj)
            return;
        this.onlineData = this.onlineData || {};
        this.onlineData = rgObj;
        let art = rgObj['artist-credit'];
        if (art && (art.length > 0)) {
            let art0 = art[0];
            if (art0.artist && art0.artist.name) {
                this.onlineData.artistName = art0.artist.name;
            }
        }
        let media = rgObj.media;
        if (media && (media.length > 0) && (!this.album.mbgid || (this.album.mbgid === media[0].release))) {
            let released = rgObj['first-release-date'];
            let year = 0;
            if (released) {
                let releasedDate = new Date(released);
                year = releasedDate.getFullYear();
            }
            this.onlineData.year = year;
            this.onlineData._releaseHasCover = (media[0].artwork === 'present');
        }

        this.notifyChange({
            senderID: this.uniqueID,
            onlyOnline: true
        });
    }

    fetchReleaseGroupInfo() {
        if (!this.album || !this.album.mbrggid)
            return dummyPromise();
        if (this.album.mbrggid === '0') { // "Another album", i.e. album not found in MB database
            this.album.mbgid = '0';
            return dummyPromise();
        }
        if (!this._promises.fetchReleaseGroupInfo) {
            this._promises.fetchReleaseGroupInfo = this.localPromise(uitools.getMusicBrainz().getReleaseGroupInfo(this.uniqueID, this.album.mbrggid)).then(function (rgObj) {
                this._promises.fetchReleaseGroupInfo = undefined;
                if (this.album) {
                    this.parseReleaseGroupInfo(rgObj);
                }
            }.bind(this), function () {
                this._promises.fetchReleaseGroupInfo = undefined;
            }.bind(this));
        }
        return this._promises.fetchReleaseGroupInfo;
    }

    fetchReleaseGroups() {
        if (this._promises.fetchReleaseGroups)
            return this._promises.fetchReleaseGroups;

        if (!this.album)
            return dummyPromise();
        if (this.cache.foundReleaseGroups && this.cache.foundReleaseGroupsSelect) {
            return dummyPromise();
        }

        this._promises.fetchReleaseGroups = this.localPromise(uitools.getMusicBrainz().findReleaseGroup(this.uniqueID, this.album)).then(function (relArray) {
            this._promises.fetchReleaseGroups = undefined;
            if (relArray && isArray(relArray) && this.album) {
                this.cache = this.cache || {};

                // add "Another release" item
                relArray.push({
                    title: this.album.title,
                    id: '0',
                    score: 0,
                    isAnother: true

                });
                this.cache.foundReleaseGroups = relArray;
                let currIdx = 0;
                let currGid = this.album.mbrggid;
                if (currGid)
                    currIdx = -1; // we have exact gid, do not allow changing it in case search does not find it
                let ds = newStringList();
                let upperArtist = this.album.albumArtist.toUpperCase();
                let alreadySet = false;
                forEach(this.cache.foundReleaseGroups, function (rg, idx) {
                    let ttl = '';
                    let art = rg['artist-credit'];
                    if (art && (art.length > 0)) {
                        let art0 = art[0];
                        if (art0.artist && art0.artist.name && (art0.artist.name.toUpperCase() !== upperArtist)) {
                            ttl = art0.artist.name + ' - ';
                        }
                    }
                    ttl += (rg.isAnother ? ('<span class="textOther">' + ' ' + _('Don\'t display info') + '</span>') : escapeXml(rg.title));
                    if (rg['primary-type']) {
                        ttl += ' (' + rg['primary-type'];
                        let secTypes = rg['secondary-types'];
                        if (secTypes && (secTypes.length > 0)) {
                            ttl += ' - ';
                            forEach(secTypes, function (tp, tpidx) {
                                if (tpidx > 0)
                                    ttl += ', ';
                                ttl += tp;
                            });
                        }
                        ttl += ')';
                    }
                    let txt = '<div data-html="1" class="inline paddingSmall vSeparatorTiny" style="width: 2.5em;"><div class="scoreBar" style="height: 0.5em; width: ' + rg.score + '%"></div></div>' + ttl;
                    ds.add(txt);
                    if (currGid === rg.id) {
                        currIdx = idx;
                        alreadySet = true; // for already binded albums, we read details already during fetchReleaseGroupInfo
                    }
                });

                this.cache.foundReleaseGroupsSelect = ds;
                if (currIdx >= 0)
                    ds.focusedIndex = currIdx;
                if ((currIdx === 0) && (!alreadySet)) {
                    this.parseReleaseGroupInfo(this.cache.foundReleaseGroups[currIdx]);
                } else {
                    if ((!this.onlineData || !this.onlineData.id) && (currIdx >= 0)) {
                        let rgObj = this.cache.foundReleaseGroups[currIdx];
                        this.onlineData = this.onlineData || {};
                        for (let attr in rgObj) {
                            if (rgObj.hasOwnProperty(attr)) this.onlineData[attr] = rgObj[attr];
                        }
                    }

                    this.notifyChange({
                        senderID: this.uniqueID,
                        onlyOnline: true
                    });
                }
            }
        }.bind(this), function () {
            this._promises.fetchReleaseGroups = undefined;
        }.bind(this));
        return this._promises.fetchReleaseGroups;
    }

    fetchReleases() {
        if (this._promises.fetchReleases)
            return this._promises.fetchReleases;
        if (!this.album || !this.album.mbrggid || (this.album.mbrggid === '0'))
            return dummyPromise();
        if (this.cache.foundReleases && this.cache.foundReleasesSelect) {
            return dummyPromise();
        }
        this._promises.fetchReleases = this.localPromise(uitools.getMusicBrainz().getReleases(this.uniqueID, this.album.mbrggid)).then(function (relArray) {
            this._promises.fetchReleases = undefined;
            if (relArray && isArray(relArray) && this.album) {
                relArray.sort(function (i1, i2) {
                    let retval = i1.releasedDate - i2.releasedDate;
                    if (!retval)
                        retval = i1.mbgid.localeCompare(i2.mbgid);
                    return retval;
                });
                // add "Another release" item - removed now, #15590
                /*                relArray.push({
                                    title: '<span class="textOther">' + _('Don\'t look up') + '</span>',
                                    mbgid: '0'
                                });*/
                this.cache.foundReleases = relArray;
                let currIdx = 0;
                let currGid = this.album.mbgid;
                if (currGid)
                    currIdx = -1; // we have exact gid, do not allow changing it in case search does not find it
                let ds = newStringList();
                forEach(this.cache.foundReleases, function (rel, ridx) {
                    let txt = '<div data-html="1" class="inline vSeparatorTiny textRight" style="width: 5.5em;">' + (rel.date ? rel.date : '') + '</div>' + escapeXml(rel.title);
                    if (rel.disambiguation)
                        txt += ' (' + rel.disambiguation + ')';
                    // add label, track count?
                    if (rel['label-info'] && (rel['label-info'].length > 0)) {
                        txt += ' [';
                        forEach(rel['label-info'], function (li, idx) {
                            if (li.label) {
                                if (idx > 0)
                                    txt += ', ';
                                txt += li.label.name;
                            }
                        });
                        txt += ']';
                    }
                    ds.add(txt);
                    if (rel.mbgid === currGid) {
                        currIdx = ridx;
                    }
                });

                this.cache.foundReleasesSelect = ds;
                if (currIdx >= 0)
                    ds.focusedIndex = currIdx;
                this.notifyChange({
                    senderID: this.uniqueID,
                    onlyOnline: true
                });
            }
        }.bind(this), function () {
            this._promises.fetchReleases = undefined;
        }.bind(this));
        return this._promises.fetchReleases;
    }

    getMBRGGID() {
        return new Promise(function (resolve, reject) {
            if (!this.album) {
                reject();
                return;
            }
            if (this.album.mbrggid)
                resolve(this.album.mbrggid);
            else {
                this.fetchReleaseGroups().then1(function (e) {
                    if (isAbortError(e)) { // was canceled
                        reject(e);
                        return;
                    }
                    if (this.cache.foundReleaseGroups && (this.cache.foundReleaseGroups.length > 0))
                        resolve(this.cache.foundReleaseGroups[0].id);
                    else
                        resolve();
                }.bind(this));
            }
        }.bind(this));
    }

    getGID() {
        return new Promise(function (resolve, reject) {
            if (!this.album) {
                reject();
                return;
            }
            if (this.album.mbgid)
                resolve(this.album.mbgid);
            else {
                //fetch releases for release group (it has to exist)
                this.fetchReleases().then1(function (e) {
                    if (isAbortError(e)) { // was canceled
                        reject(e);
                        return;
                    }
                    if (this.cache.foundReleases && (this.cache.foundReleases.length > 0))
                        resolve(this.cache.foundReleases[0].mbgid);
                    else
                        resolve();
                }.bind(this));
            }
        }.bind(this));
    }

    fetchMBData(forceImmediate) {
        let _this = this;
        if (this._promises.fetchMBData)
            return this._promises.fetchMBData;
        if (!forceImmediate) {
            if (this._fetchDataTimeout === undefined) {
                this._fetchDataTimeout = this.requestTimeout(function () {
                    this._fetchDataTimeout = null;
                    this.fetchMBData(true);
                }.bind(this), 500);
            }
            return;
        }
        this._promises.fetchMBData = this.getMBRGGID().then(function (rggid) {
            if (rggid) {
                if (_this.album.mbrggid !== rggid) {
                    _this.album.mbrggid = rggid;
                    if (_this.album.id > 0)
                        _this.album.commitAsync();
                }

                return _this.fetchReleaseGroupInfo();
            } else
                return dummyPromise();
        }).then(function () {
            return _this.getGID().then(function (gid) {
                if (gid && (!_this.onlineData || !_this.onlineData.media || (_this.onlineData.media.length === 0) || (_this.onlineData.media[0].release !== _this.album.mbgid))) {
                    if (_this.album.mbgid !== gid) {
                        _this.album.mbgid = gid;
                        if (_this.album.id > 0)
                            _this.album.commitAsync();
                    }
                    return _this.fetchReleaseInfo();
                } else
                    return dummyPromise();
            });
        }).then(function () {
            _this._promises.fetchMBData = undefined;
            if (!_this.cache.foundReleaseGroups && !_this._promises.fetchReleaseGroups) {
                _this.fetchReleaseGroups();
            }
            if (!_this.cache.foundReleases && !_this._promises.fetchReleases) {
                _this.fetchReleases();
            }
        }, function (e) {
            _this._promises.fetchMBData = undefined;
        });
        return this._promises.fetchMBData;
    }

    readAllOnlineTracks() {
        if (!this.album || (this.album.mbrggid === '0') || (this.album.mbgid === '0'))
            return dummyPromise();
        if (this.cache && this.cache.releaseOnlineTracklist) {
            return dummyPromise(this.cache.releaseOnlineTracklist);
        }
        this.onlineData = this.onlineData || {};
        if (!this._promises.readAllOnlineTracks) {
            let m = this.onlineData.release || this.onlineData;

            let resolveWhenLoadedMedia = function (rObj, resolve) {
                let ds = uitools.getMusicBrainz().getTracklistFromMedia(rObj);
                this.localPromise(ds.whenLoaded()).then(function () {
                    this._promises.readAllOnlineTracks = undefined;
                    this.cache.releaseOnlineTracklist = ds;
                    this.notifyChange({
                        senderID: this.uniqueID,
                        onlyOnline: true
                    });
                    resolve(ds);
                }.bind(this), function () {
                    this._promises.readAllOnlineTracks = undefined;
                }.bind(this));
            }.bind(this);

            if (m.media) {
                this._promises.readAllOnlineTracks = new Promise(function (resolve) {
                    if (this.album && m && m.media) {
                        resolveWhenLoadedMedia(m, resolve);
                    } else
                        resolve();
                }.bind(this));
            } else {
                if (this.album.mbgid) {
                    this._promises.readAllOnlineTracks = new Promise(function (resolve) {
                        this.fetchReleaseInfo().then(function () {
                            if (this.album && this.onlineData && this.onlineData.release) {
                                resolveWhenLoadedMedia(this.onlineData.release, resolve);
                            } else
                                resolve();
                        }.bind(this));
                    }.bind(this));
                } else if (this.album.mbrggid) {
                    this._promises.readAllOnlineTracks = new Promise(function (resolve) {
                        this.fetchReleaseGroupInfo().then(function () {
                            if (this.album && this.onlineData && this.onlineData.media) {
                                resolveWhenLoadedMedia(this.onlineData, resolve);
                            } else
                                resolve();
                        }.bind(this));
                    }.bind(this));
                } else {
                    this._promises.readAllOnlineTracks = new Promise(function (resolve) {
                        this.fetchMBData(true).then(function () {
                            if (this.album && this.onlineData) {
                                let m = this.onlineData.release || this.onlineData;
                                resolveWhenLoadedMedia(m, resolve);
                            } else
                                resolve();
                        }.bind(this));
                    }.bind(this));
                }
            }
        }
        return this._promises.readAllOnlineTracks;
    }

    switchToOtherReleaseGroup(i) {
        if ((i >= 0) && this.cache && (this.cache.foundReleaseGroups.length > i)) {
            this.cache.foundReleaseGroupsSelect.focusedIndex = i;
            this.album.mbrggid = this.cache.foundReleaseGroups[i].id;
            this.album.mbgid = '';
            if (this.album.id > 0)
                this.album.commitAsync();

            this.notifyChange({
                senderID: this.uniqueID,
                eventType: 'clear',
                clearAll: false,
                onlyRelease: false,
                onlyOnline: true
            });
            this.onlineData = undefined;
            this.cache = {
                foundReleaseGroups: this.cache.foundReleaseGroups,
                foundReleaseGroupsSelect: this.cache.foundReleaseGroupsSelect
            };
            cancelPromise(this._promises.fetchMBData);
            cancelPromise(this._promises.fetchReleaseInfo);
            let alb = this.cache.foundReleaseGroups[i];
            if (!alb.isAnother)
                this.fetchMBData(true);
            else if (this.album) {
                this.onlineData = alb;
                this.notifyChange({
                    senderID: this.uniqueID,
                    onlyOnline: true
                });
            }
        }
    }

    switchToOtherRelease(i) {
        if ((i >= 0) && this.cache && this.cache.foundReleases && (this.cache.foundReleases.length > i)) {
            this.cache.foundReleasesSelect.focusedIndex = i;
            this.album.mbgid = this.cache.foundReleases[i].mbgid;
            this.album.commitAsync().then(function () {
                this.cache.releaseOnlineTracklist = null;
                /*            {
                                foundReleaseGroups: this.cache.foundReleaseGroups,
                                foundReleaseGroupsSelect: this.cache.foundReleaseGroupsSelect,
                                foundReleases: this.cache.foundReleases,
                                foundReleasesSelect: this.cache.foundReleasesSelect
                            };*/
                if (this.onlineData) {
                    this.onlineData.release = undefined;
                    this.onlineData.media = undefined;
                }
                this.notifyChange({
                    senderID: this.uniqueID,
                    eventType: 'clear',
                    clearAll: false,
                    onlyRelease: true,
                    onlyOnline: true
                });
                cancelPromise(this._promises.fetchReleaseInfo);
                this.fetchReleaseInfo();
            }.bind(this));
        }
    }

    cancelDownloads() {
        if (searchTools.interfaces.aaSearch)
            searchTools.cancelSearch(searchTools.interfaces.aaSearch, this.uniqueID);
        if ((this._fetchDataTimeout !== undefined) && (this._fetchDataTimeout !== null)) {
            clearTimeout(this._fetchDataTimeout);
        }
        this._fetchDataTimeout = undefined;
        super.cancelDownloads();
    }
    
    get album () {
        return this.dataObject;
    }
    set album (albumObj) {
        if (this.dataObject && (this.dataObject !== albumObj) && (!albumObj || !this.dataObject.isSame(albumObj))) {
            this.cleanUp();
        }
        this.dataObject = albumObj;
    }
    
}
registerClass(AlbumDataSource);
