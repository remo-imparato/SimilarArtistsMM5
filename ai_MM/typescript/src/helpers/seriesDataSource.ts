'use strict';

import { LINK_TVDB } from '../consts';
import DataSourceObject from './dataSourceObject';

/**
SeriesDataSource object, for use in series views

@class SeriesDataSource
@constructor
@extends DataSourceObject
*/

export default class SeriesDataSource extends DataSourceObject {

    initialize(seriesObj, params) {
        super.initialize(seriesObj, params);
    }

    getTVDBID() {
        if (this.onlineData && this.onlineData.tvdbid)
            return dummyPromise(this.onlineData.tvdbid);
        let _this = this;
        if (!_this._promises.findSeriesID) {
            _this._promises.findSeriesID = new Promise(function (resolve, reject) {
                if (!_this.series) {
                    if (reject)
                        reject();
                    return;
                }
                let linksList = _this.series.getLinksList(LINK_TVDB, 'id');
                _this.localPromise(linksList.whenLoaded()).then(function () {
                    if (!_this.series) {
                        if (reject)
                            reject();
                        return;
                    }
                    let id = undefined;
                    _this.cache = _this.cache || {};
                    linksList.locked(function () {
                        if (linksList.count > 0) {
                            let link = linksList.getValue(0);
                            id = link.link;
                        }
                    });
                    if (id && (id !== '0')) {
                        _this._promises.findSeriesID = undefined;
                        _this.onlineData.tvdbid = id;
                        resolve(id);
                        // prepare search results, if not fetched yet
                        if (!_this.cache.foundSeries) {
                            _this.cache.foundSeries = []; // so it is not fetched again
                            _this.localPromise(TVDB.findSeriesInfo(_this.series.title)).then(function (resData) {
                                if (!_this.series) {
                                    return;
                                }
                                if (resData && resData.data) {
                                    _this.cache.foundSeries = resData.data;
                                    _this.generateFoundSeriesSelect();
                                }
                            });
                        }
                        return;
                    }
                    let taskid = _this.beginTask(_('Searching') + ' ' + _('series'));
                    _this.localPromise(TVDB.findSeriesInfo(_this.series.title)).then(function (resData) {
                        _this.endTask(taskid);
                        if (!_this.series) {
                            if (reject)
                                reject();
                            return;
                        }
                        if (resData && resData.data) {
                            _this.cache.foundSeries = resData.data;
                            if (resData.data.length > 0) {
                                id = resData.data[0].id;
                            }
                        }
                        id = String(id || 0);
                        _this._promises.findSeriesID = undefined;
                        _this.onlineData.tvdbid = id;
                        _this.series.addLink(LINK_TVDB, 'id', '' + id);

                        if (!_this.cache.foundSeriesSelect)
                            _this.generateFoundSeriesSelect();
                        resolve(id);
                    }, function () {
                        _this.endTask(taskid);
                        _this._promises.findSeriesID = undefined;
                        if (reject)
                            reject();
                    });
                });
            });
        }
        return _this._promises.findSeriesID;
    }

    generateFoundSeriesSelect() {
        if (!this.cache || !this.cache.foundSeries || this.cache.foundSeriesSelect)
            return;
        // add "Another series" item
        this.cache.foundSeries.push({
            seriesName: this.series.title,
            id: '0',
            isAnother: true
        });
        let currIdx = 0;
        let currGid = this.onlineData.tvdbid;
        if (currGid)
            currIdx = -1; // we have exact gid, do not allow changing it in case search does not find it
        let ds = newStringList();
        forEach(this.cache.foundSeries, function (si, idx) {
            let ttl = '';
            ttl += (si.isAnother ? ('<span class="textOther">' + _('Another series') + '</span>') : si.seriesName);
            if (si.network || si.firstAired) {
                ttl += ' (';
                if (si.network) {
                    ttl += si.network;
                    if (si.firstAired)
                        ttl += ', ';
                }
                if (si.firstAired) {
                    ttl += 'aired: ' + si.firstAired;
                }
                ttl += ')';
            }
            ds.add(ttl);
            if (currGid == si.id) {
                currIdx = idx;
            }
        });

        this.cache.foundSeriesSelect = ds;
        if (currIdx >= 0)
            ds.focusedIndex = currIdx;
    }

    reloadOnlineData() {
        this.cancelAll();
        this.onlineData = {
            tvdbid: this.onlineData.tvdbid
        };
        this.cache = {
            foundSeries: this.cache.foundSeries,
            foundSeriesSelect: this.cache.foundSeriesSelect
        };
        this.notifyChange({
            senderID: this.uniqueID,
            eventType: 'clear',
            clearAll: false,
            onlyOnline: true
        });
        this.fetchSeriesInfo();
    }

    switchToOtherSeries(i) {
        if ((i >= 0) && this.cache && (this.cache.foundSeries.length > i) && (this.onlineData.tvdbid !== this.cache.foundSeries[i].id)) {
            this.cache.foundSeriesSelect.focusedIndex = i;
            this.series.addLink(LINK_TVDB, 'id', '' + this.cache.foundSeries[i].id).then(function () {
                this.cancelAll();
                this.onlineData = {
                    tvdbid: this.cache.foundSeries[i].id
                };
                this.cache = {
                    foundSeries: this.cache.foundSeries,
                    foundSeriesSelect: this.cache.foundSeriesSelect
                };
                this.notifyChange({
                    senderID: this.uniqueID,
                    eventType: 'clear',
                    clearAll: false,
                    onlyOnline: true
                });
                this.fetchSeriesInfo();
            }.bind(this));
        }
    }

    fetchSeriesInfo() {
        this.onlineData = this.onlineData || {};
        if ((!this.series) || (this.onlineData.tvdbid === '0')) {
            return dummyPromise();
        }
        let _this = this;
        if (!_this._promises.fetchSeriesInfo) {
            let taskid = _this.beginTask(_('Getting') + ' ' + _('Series'));
            _this._promises.fetchSeriesInfo = new Promise<void>(function (resolve, reject) {
                _this.getTVDBID().then(function (id) {
                    if (id == '0') {
                        _this._promises.fetchSeriesInfo = undefined;
                        _this.endTask(taskid);
                        if (reject)
                            reject();
                        return;
                    }
                    _this.localPromise(TVDB.getSeriesInfo(id)).then(function (res) {
                        _this._promises.fetchSeriesInfo = undefined;
                        _this.endTask(taskid);
                        if (!res || !res.data) {
                            if (reject)
                                reject();
                            return;
                        }
                        let airedDate = new Date(res.data.firstAired);
                        _this.onlineData.year = airedDate.getFullYear();
                        _this.onlineData.title = res.data.seriesName;
                        _this.onlineData.genres = res.data.genre;
                        _this.onlineData.actors = res.data.actors;
                        _this.onlineData.overview = res.data.overview;
                        if (res.imdbdata) {
                            if (!_this.onlineData.overview) {
                                _this.onlineData.overview = res.imdbdata.description;
                            }
                            if ((!_this.onlineData.actors || (_this.onlineData.actors.length === 0)) && res.imdbdata.actors) {
                                let actors = res.imdbdata.actors.split(';');
                                _this.onlineData.actors = actors.map((nm) => ({
                                    name: nm
                                }));
                            }
                        }
                        _this.notifyChange({
                            senderID: _this.uniqueID,
                            onlyOnline: true
                        });
                        resolve();
                    }, function () {
                        _this._promises.fetchSeriesInfo = undefined;
                        _this.endTask(taskid);
                        if (reject)
                            reject();
                    });
                }, function () {
                    _this._promises.fetchSeriesInfo = undefined;
                    _this.endTask(taskid);
                    if (reject)
                        reject();
                });
            });
        }
        return this._promises.fetchSeriesInfo;
    }

    _getTrackItem(titem) {
        // helper function for preparing track item
        let track : AnyDict = {};
        track.title = titem.episodeName;
        track.date = uitools.getMusicBrainz().decodeMBDate(titem.firstAired);
        if (titem.airedSeason === 0) {
            track.seasonNumber = _('Specials');
        } else {
            track.seasonNumber = '' + titem.airedSeason;
        }
        track.episodeNumber = '' + titem.airedEpisodeNumber;
        track.tvdbid = '' + titem.id;
        track.comment = titem.overview;
        track.album = this.onlineData.title; // = series
        track.webSource = _utils.youtubeWebSource(); // online tracks are searched and played from Youtube now
        return track;
    }

    fetchSeriesEpisodes() {
        this.onlineData = this.onlineData || {};
        if ((!this.series) || (this.onlineData.tvdbid === '0')) {
            return dummyPromise();
        }
        let _this = this;
        if (!_this._promises.fetchSeriesEpisodes) {
            let taskid = _this.beginTask(_('Getting') + ' ' + _('Series'));
            _this._promises.fetchSeriesEpisodes = new Promise(function (resolve, reject) {
                let _reject = function () {
                    _this._promises.fetchSeriesEpisodes = undefined;
                    _this.endTask(taskid);
                    if (reject)
                        reject();
                };
                _this.localPromise(_this.getTVDBID()).then(function (id) {
                    let finishFetch = function () {
                        _this.localPromise(TVDB.getSeriesEpisodes(id)).then(function (res) {
                            if (res && res.data) {
                                let sourceItems = res.data.map((it) => (_this._getTrackItem(it)));
                                let tracksds = app.utils.createTracklist(false); // not loaded flag
                                tracksds.fillOnlineFromArray(sourceItems);
                                tracksds.whenLoaded().then(function () {
                                    _this._promises.fetchSeriesEpisodes = undefined;
                                    _this.endTask(taskid);
                                    resolve(tracksds);
                                }, _reject);
                            } else {
                                _reject();
                                return;
                            }
                        }, _reject);
                    };

                    if (!_this.onlineData.title) {
                        _this.fetchSeriesInfo().then(finishFetch, _reject);
                    } else {
                        finishFetch();
                    }
                }, _reject);
            });
        }
        return _this._promises.fetchSeriesEpisodes;
    }

    cancelAll() {
        for (let key in this._promises) {
            cancelPromise(this._promises[key]);
        }
        this._promises = {};
    }

    cleanUp() {
        this.cancelAll();
        super.cleanUp();
    }
    
    get series () {
        return this.dataObject;
    }
    set series (seriesObj) {
        if (this.dataObject && (this.dataObject !== seriesObj)) {
            this.cleanUp();
        }
        this.dataObject = seriesObj;
    }
    
}
registerClass(SeriesDataSource);
