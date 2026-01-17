/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

registerFileImport('helpers/searchTools');

window.searchTools = window.searchTools || {};
window.searchTools.interfaces = window.searchTools.interfaces || {};

var searchMissingArtwork = undefined;
var searchMissingArtistImage = undefined;
var autoGenThumbs = undefined;

var sortLyricServers = function () {
    // sort lyric sources and set saved disabled state
    var settLookup = app.getValue('MetadataLookup', {});
    var ls = settLookup.lyricSources;
    if (ls && (ls.length > 0)) {
        var srcObj = {};
        forEach(ls, function (src, idx) {
            src.order = idx;
            srcObj[src.name] = src;
        });
        var idx = ls.length; // next index
        forEach(window.lyricsSources, function (lr) {
            if (srcObj[lr.name] === undefined) {
                srcObj[lr.name] = {
                    order: idx,
                    name: lr.name,
                    disabled: false
                };
                idx++;
            } else {
                lr.disabled = srcObj[lr.name].disabled;
            }
        });
        window.lyricsSources.sort(function (src1, src2) {
            return (srcObj[src1.name].order - srcObj[src2.name].order);
        });
    };
}

var loadSettings = function () {
    var sett = window.settings.get('Options');
    searchMissingArtwork = sett.Options.SearchMissingArtwork;
    searchMissingArtistImage = sett.Options.SearchMissingArtistImage;
    if (searchTools.interfaces.lyrics) {
        sortLyricServers();
    }
}

app.listen(window.settings.observer, 'change', function () {
    loadSettings();
});

Object.defineProperty(window.searchTools, 'searchMissingArtwork', {
    get: function () {
        if (searchMissingArtwork === undefined) {
            loadSettings();
        }
        return searchMissingArtwork;
    }
});

Object.defineProperty(window.searchTools, 'searchMissingArtistImage', {
    get: function () {
        if (searchMissingArtistImage === undefined) {
            loadSettings();
        }
        return searchMissingArtistImage;
    }
});

Object.defineProperty(window.searchTools, 'autoGenThumbs', {
    get: function () {
        if (autoGenThumbs === undefined) {
            loadSettings();
        }
        return autoGenThumbs;
    }
});

// used for loading search script, so all lookup servers will be known
searchTools.prepareLyricSearch = function (sett) {
    var _interface = window.searchTools.getInterface('helpers\\lyricsSearch.js');
};

searchTools.getCachedLyrics = function (track) {
    let _interface = searchTools.interfaces.lyrics;
    if (!_interface || !_interface.getCachedLyrics)
        return;
    return _interface.getCachedLyrics(track.artist, track.title);
};

searchTools.startMonitoringLyricsSearchTimes = function () {
    // monitor times and temporary disable slow servers
    var _interface = window.searchTools.getInterface('helpers\\lyricsSearch.js');    
    if(_interface && isFunction(_interface.startMonitoringLyricsSearchTimes)) {
        _interface.startMonitoringLyricsSearchTimes();
    }
};

searchTools.stopMonitoringLyricsSearchTimes = function () {
    // reset temporary disabled slow servers
    var _interface = window.searchTools.getInterface('helpers\\lyricsSearch.js');
    if(_interface && isFunction(_interface.stopMonitoringLyricsSearchTimes)) {
        _interface.stopMonitoringLyricsSearchTimes();
    }    
};

searchTools.searchLyrics = function (track, autoSave, overwrite, progressFunc) {
    return new Promise(function (resolve, reject) {

        if (!track) {
            ODS('searchTools.searchLyrics - no track ');
            reject();
            return;
        }

        var runner = function () {

            if (this.canceled) {
                ODS('searchTools.searchLyrics - canceled ');
                reject(); // this promise was canceled
                return;
            }

            var _interface = window.searchTools.getInterface('helpers\\lyricsSearch.js');

            if (!_interface.searchInProgress) {
                _interface.searchInProgress = true;
                track.getLyricsAsync().then(function (lyrics) {
                    if (window._cleanUpCalled) {
                        _interface.searchInProgress = undefined;
                        return;
                    }
                    if (lyrics == '' || overwrite) {
                        var doSearch = function () {
                            _interface.showResult = function (lyrics, provider, isclosing) {
                                if (lyrics == '') {
                                    if (!isclosing)
                                        resolve(lyrics, provider);
                                    _interface.searchInProgress = undefined;
                                } else {
                                    if (autoSave) {
                                        track.setLyricsAsync(lyrics).then(function () {
                                            resolve(lyrics, provider);
                                            track.commitAsync();
                                            _interface.searchInProgress = undefined;
                                        });
                                    } else {
                                        resolve(lyrics, provider);
                                        _interface.searchInProgress = undefined;
                                    }
                                }
                            };
                            _interface.progressFunc = function (message) {
                                if (isFunction(progressFunc))
                                    progressFunc(message);
                            };
                            _interface.startSearch(track.artist, track.title, overwrite, track);
                        };

                        doSearch();
                    } else {
                        resolve(lyrics);
                        _interface.searchInProgress = undefined;
                    }
                });
            } else {
                requestTimeout(runner, 100);
            }
        }.bind(this);

        runner();
    });
};

searchTools.searchArtistImages = function (artistName, cbk, params) {
    params = params || {};
    params.term1 = artistName;
    params.callback = cbk;
    params.fetchAllLinks = true;
    params.scriptInterface = searchTools.getInterface('helpers\\artistSearch.js');
    params.imageType = 'artist';
    searchTools.searchImage(params);
};

let processImageSearch = function (si, params) {
    return new Promise(async function (resolve, reject) {
        if (params.canceled || window._cleanUpCalled || (params.isAutoSearch && ((nodeUtils && !nodeUtils.canUseAutoSearch()) || ((params.imageType === 'artist') && !window.searchTools.searchMissingArtistImage) || ((params.imageType !== 'artist') && !window.searchTools.searchMissingArtwork)))) {
            params.callback('');
            resolve();
            return;
        };    
        let artworkLinks = [];
        si.showResult = function (artworkLink, thumbLink, w, h, tw, th) {
            if (artworkLink) {
                if (params.fetchAllLinks) {
                    artworkLinks.push({
                        artworkLink: artworkLink,
                        thumbLink: thumbLink,
                        width: w,
                        height: h,
                        thumbwidth: tw,
                        thumbheight: th
                    });
                } else
                    artworkLinks.push(artworkLink);
            }
        };
        var doCallback = function (txt) {
            if (params.callback && !params.canceled && !params.fetchAllLinks)
                params.callback(txt, true /* isInTemp */ );
            resolve();
        };
        var getResult = async function (idx) {
            let retval = true;
            if (window._cleanUpCalled)
                return true;

            var artworkLink = artworkLinks[idx];
            if ((artworkLink != '') && !params.canceled) {
                await app.utils.saveImageAsync(artworkLink).then(function (cachedImgPath) {
                    if ((cachedImgPath !== -1) && (cachedImgPath !== ''))
                        doCallback(cachedImgPath)
                    else {
                        if (cachedImgPath !== -1) {
                            retval = false;
                            if (idx === (artworkLinks.length-1))
                                doCallback ('');
                        } else
                            doCallback('');
                    }
                });
            } else {
                doCallback('');
            }
            return retval;
        };
        si.endSearch = async function () {
            if (params.fetchAllLinks) {
                params.callback(artworkLinks);
                resolve();
            } else {
                if (artworkLinks.length > 0) {
                    let idx = 0;
                    while (idx<artworkLinks.length) {
                        let res = await getResult(idx);
                        if(res)
                            break;
                        else
                            idx++;
                    }
                }
                else {
                    doCallback('');
                }
            }
        };
        si.startSearch(params.term1, params.term2, params);
    });
};

searchTools.searchImage = async function (params) {
    if (params.canceled || window._cleanUpCalled || (params.isAutoSearch && ((nodeUtils && !nodeUtils.canUseAutoSearch()) || ((params.imageType === 'artist') && !window.searchTools.searchMissingArtistImage) || ((params.imageType !== 'artist') && !window.searchTools.searchMissingArtwork)))) {
        params.callback('');
        return;
    };

    if (params.isAutoSearch) {  // #21107
        let res;
        try {
            res = await app.utils.web.isConnectedToInternetAsync();
        } catch (e) {
            res = false;
        }
        if (!res)   
            return;
    }

    let si = params.scriptInterface;
    let obj = {
        params: params
    };
    si.reqqueue = si.reqqueue || [];
    if (params && params.highestPriority) {
        si.reqqueue.splice(0, 0, obj);
    } else {
        si.reqqueue.push(obj);
    }

    if(!si.runSearching) {
        si.runSearching = async function () {
            while (si.reqqueue && (si.reqqueue.length > 0)) {
                let nextReq = si.reqqueue.shift();
                if (nextReq.params.canceled)
                    continue;
                await processImageSearch(si, nextReq.params);
            }
            si.runSearching = undefined;
        }
        si.runSearching();
    }
};

searchTools.searchImageDlg = function (params) {
    params.modal = true;
    var dlg = uitools.openDialog('dlgSearchImage', params);
};

searchTools.clearArtistSearchQueue = function () {
    if (searchTools.interfaces.artistSearch)
        searchTools.interfaces.artistSearch.reqqueue = [];
};

searchTools.clearAASearchQueue = function () {
    if (searchTools.interfaces.aaSearch)
        searchTools.interfaces.aaSearch.reqqueue = [];
};

searchTools.getInterface = function (searchScript) {

    var TScriptInterface = function () {
        this.showResult = null; // script callback method (called from script, to be assigned by us)
        this.startSearch = null; // to be assigned by script
        this.endSearch = null; // script callback method (called from script, to be assigned by us)
    }

    if (searchScript == 'helpers\\lyricsSearch.js') {
        if (!searchTools.interfaces.lyrics) {
            searchTools.interfaces.lyrics = new TScriptInterface();
            requirejs(searchScript, null, true /*isolated*/ );
            sortLyricServers();
        }
        return searchTools.interfaces.lyrics;
    } else
    if (searchScript == 'helpers\\aaSearch.js') {
        if (!searchTools.interfaces.aaSearch) {
            searchTools.interfaces.aaSearch = new TScriptInterface();
            requirejs(searchScript, null, true /*isolated*/ );
        }
        return searchTools.interfaces.aaSearch;
    } else
    if (searchScript == 'helpers\\artistSearch.js') {
        if (!searchTools.interfaces.artistSearch) {
            searchTools.interfaces.artistSearch = new TScriptInterface();
            requirejs(searchScript, null, true /*isolated*/ );
        }
        return searchTools.interfaces.artistSearch;
    }
}

searchTools.getAAImage = function (item, callback, params) {
    // returns the first one image that is catched
    params = params || {};
    if (params.canceled || (params.isAutoSearch && (!window.searchTools.searchMissingArtwork || (nodeUtils && !nodeUtils.canUseAutoSearch()) || ((item.objectType === 'track') && item.isVideo))) || ((item.objectType === 'album') && !item.title)) {
        callback('');
        return;
    };

    var resolve = function (txt, isInTemp) {
        if (callback)
            callback(txt, isInTemp);
    };
    var cbk = function (imgPath, isInTemp) {
        if (!imgPath || (imgPath === -1)) {
            resolve('');
            return;
        } else
            resolve(imgPath, isInTemp);
    };
    params.callback = cbk;
    params.term1 = item.albumArtist || item.artist;
    params.term2 = item.album || item.title;
    params.scriptInterface = searchTools.getInterface('helpers\\aaSearch.js');
    params.imageType = 'artwork';
    searchTools.searchImage(params);
};

searchTools.searchAAImageDlg = function (item, updateFunc, params) {
    if (!item)
        return;
    searchTools.clearAASearchQueue();
    params = params || {};
    if (params.noDefaultIcon === undefined)
        params.noDefaultIcon = true;
    var isAlbum = (item.objectType === 'album');
    var isList = (item.objectType === 'tracklist');
    var term1, term2;
    var initBrowsePath;

    var _showDialog = () => {

        var cbk = async function (imgPath, isInTemp) {
            if (params.justReturnLink) {
                if (window._cleanUpCalled)
                    return;
                updateFunc(imgPath, isInTemp);
                return;
            }

            if (imgPath && item) {
                if (imgPath === '-') {
                    if (window._cleanUpCalled)
                        return;

                    // change to default icon
                    if (isAlbum) {
                        item.saveThumbAsync(imgPath).then(function () {
                            if (updateFunc)
                                updateFunc();
                        });
                    }
                } else {
                    if (window._cleanUpCalled) {
                        if (isInTemp)
                            app.filesystem.deleteFileAsync(imgPath);
                        return;
                    }

                    if (isAlbum) {
                        params.album = item;
                        if (params.showReplace === undefined)
                            params.showReplace = true;
                    } else if (isList) {
                        params.tracks = item;
                    } else {
                        params.track = item;
                    }

                    var imgPaths;
                    if (isString(imgPath)) {
                        imgPaths = [imgPath];
                    } else
                        imgPaths = imgPath; // list of local files

                    if (imgPaths.length > 0) {
                        for (let idx = 0; (idx < imgPaths.length) && (!window._cleanUpCalled); idx++) {
                            let fn = imgPaths[idx];
                            let deleteTempFile = function () {
                                if (isInTemp)
                                    app.filesystem.deleteFileAsync(fn);
                            };

                            await uitools.addNewArtwork(fn, params).then(function () {
                                deleteTempFile();
                            }, deleteTempFile);
                        }
                        if (updateFunc)
                            updateFunc();
                    };
                };
            };
        };

        searchTools.searchImageDlg({
            callback: cbk,
            searchTerm1: term1,
            searchTerm2: term2,
            noDefaultIcon: params.noDefaultIcon,
            dontDownloadLink: params.dontDownloadLink,
            noGenerated: true,
            multiselect: !params.justReturnLink,
            searchScript: 'helpers\\aaSearch.js',
            initBrowsePath: initBrowsePath,
            beforeImageDownload: params.beforeImageDownload,
            afterImageDownload: params.afterImageDownload
        });
    }

    if (isAlbum) {
        term1 = item.albumArtist;
        term2 = item.title;
        item.getFirstTrackAsync().then((track) => {
            if (track)
                initBrowsePath = track.path;
            _showDialog();
        });
    } else if (isList) {
        item.locked(function () {
            var i = item.getValue(0);
            if (i) {
                term1 = i.albumArtist || i.artist;
                term2 = i.album || i.title;
                if (!initBrowsePath)
                    initBrowsePath = i.path;
            }
        });
        _showDialog();
    } else {
        term1 = params.searchTerm1 || item.albumArtist || item.artist;
        term2 = params.searchTerm2 || item.album || item.title;
        initBrowsePath = item.path;
        _showDialog();
    }
};

searchTools.getArtistImage = function (item, callback, params) {
    params = params || {};
    if ((params.isAutoSearch && (!window.searchTools.searchMissingArtistImage || (nodeUtils && !nodeUtils.canUseAutoSearch()))) || (!item.name)) {
        callback('');
        return;
    };

    params.uid = params.uid || createUniqueID(); // for sure, but uid should be always present here, for correct cancel
    var resolve = function (txt) {
        if (callback)
            callback(txt);
    };
    var cbk = function (imgPath, isInTemp) {
        if (!imgPath) {
            resolve('');
            return;
        };
        if (item && item.saveThumbAsync) {
            var deleteTempFile = function () {
                if (isInTemp)
                    app.filesystem.deleteFileAsync(imgPath);
            };

            item.saveThumbAsync(imgPath).then(function (imgLink) {
                deleteTempFile();
                if (imgLink) {
                    params.saved = true;
                    resolve(imgLink);
                } else
                    resolve('');
            }, deleteTempFile);
        } else
            resolve('');
    };
    params.callback = cbk;
    params.term1 = item.name;
    params.maxResults = 1; // one result is enough, we take only first
    params.scriptInterface = searchTools.getInterface('helpers\\artistSearch.js');
    params.imageType = 'artist';
    searchTools.searchImage(params);
};

searchTools.searchArtistImageDlg = function (artistItem, updateFunc, params) {
    if (!artistItem)
        return;
    params = params || {};
    if (params.noGenerated === undefined)
        params.noGenerated = true;
    searchTools.clearArtistSearchQueue();

    var cbk = function (imgPath, isInTemp) {
        if ((imgPath !== undefined) && artistItem) {
            var deleteTempFile = function () {
                if (isInTemp)
                    app.filesystem.deleteFileAsync(imgPath);
            };
            artistItem.saveThumbAsync(imgPath).then(function () {
                deleteTempFile();
                if (updateFunc)
                    updateFunc();
            }, deleteTempFile);
        };
    };

    searchTools.searchImageDlg({
        callback: cbk,
        initBrowsePath: (artistItem.getImagePath ? artistItem.getImagePath(artistItem.name) : ''),
        searchTerm1: artistItem.name,
        noGenerated: params.noGenerated,
        onlyGoogle: params.onlyGoogle,
        searchScript: 'helpers\\artistSearch.js'
    });
};

searchTools.searchPlaylistImageDlg = function (item, updateFunc, params) {
    params = params || {};
    params.onlyGoogle = true; // we use the same search as for artists, but not use Discogs
    params.noGenerated = false;
    searchTools.searchArtistImageDlg(item, updateFunc, params);
}

searchTools.cancelSearch = function (si, uid) {
    if (window.discogs) {
        window.discogs.cancelDownloads(uid);
    }
    if (!si.reqqueue || !si.reqqueue.length)
        return;
    si.reqqueue = si.reqqueue.filter(function (req) {
        return (req.params.uid !== uid);
    });
};
