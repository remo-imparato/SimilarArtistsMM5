/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

var blacklist = ['covershut.com', 'searchednews.com', 'fansshare.com', 'musicnow.cz', 'images-na.ssl-images-amazon.com', 'selcdn.ru', 'lookaside.fbsbx.com', 'lookaside.instagram.com', 'www.tiktok.com', 'shutterstock.com'];
var currentRequest = 0;
var cachedArtist;
var cachedAlbum;
var wasClosed = true;

var rGoogle;
var rBing;
var tryGoogle = true;
if(app) {
    tryGoogle = ((app.versionHi >= 2024) && (app.versionBuild >= 3012)) ||
                ((app.versionHi >= 5) && (app.versionBuild >= 2695));
}

var tryBing = true;
var useWhiteList = false;
var usingCustomPhrase = false;

var usingAutomaticSearch = false;

var aR = new Array();
var aResult = new Array();
var reswlnum = 0;
var whitelist = new Array("grooveshark.com", "coveralia.com", "jazz.com", "bandzone.cz", "7digital.com", "7static.com", "ecover.to", "deejay.de", "deezer.com", "discogs.com", "djshop.de", "ebreggae.com", "eclassical.com", "textalk.se",
    "esenshop.com", "hitparade.ch", "hmv.ca", "chartstats.com", "itunes.apple.com", "juno.co.uk", "kalahari.com", "audioscrobbler.com", "maniadb.com", "mndigital.com", "mega-media.nl", "metal-archives.com",
    "metallibrary.ru", "nuclearblast.de", "psyshop.com", "qobuz.com", "revhq.com", "musique.sfr.fr", "soundstation.dk", "takealot.com", "theorchard.com", "vgmdb.net", "wantitall.co.za", "yesasia.com", "uulyrics.com");

function WebRequest() {
    this.host = '';
    this.name = '';
    this.className = '';
    this.onSuccess = null;
    this.onFailure = null;
}

function ImageResult() {
    this.imglink = '';
    this.height = '';
    this.width = '';
    this.thumblink = '';
}

var downloadPromise = null;

var registerClosed = function () {
    wasClosed = false;
    if (!window.qUnit) {
        window.localListen(thisWindow, 'closed', function () {
            wasClosed = true;
            if (downloadPromise) {
                cancelPromise(downloadPromise);
            }
            downloadPromise = null;
            currentRequest = 0;
            cachedArtist = undefined;
            cachedTitle = undefined;
        });
    }
};

function NotifyWebReq(str) {
    NotifyDebug('NotifyWebReq: ' + str);
    if (downloadPromise) {
        cancelPromise(downloadPromise);
    }

    downloadPromise = searchTools.readWebPageAsync(str);
    downloadPromise.then((Content) => {
        downloadPromise = null;
        if ((Content) && (Content != ''))
            LoadedWebPage(Content);
        else
            LoadWebPageFailed();
    }, () => {
        downloadPromise = null; // when promise canceled, do nothing
    });
    /*    
        var headers = newStringList();
        headers.add('User-Agent: Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/54.0.2840.99 Safari/537.36');

        if (downloadPromise)
            downloadPromise.cancel();
        downloadPromise = app.utils.web.getURLContentAsync(str, {
            headers: headers
        });
        downloadPromise.then(function (Content) {
            downloadPromise = null;
            if ((Content) && (Content != ''))
                LoadedWebPage(Content);
            else
                LoadWebPageFailed();
        }, function () {
            LoadWebPageFailed();
        });
    */
}

function NotifyResult(res) {
    searchTools.interfaces.aaSearch.showResult(res.imglink, res.thumblink, res.width, res.height, res.thumbwidth, res.thumbheight, undefined, undefined, res.filesize);
    //res.thumblink
    //res.width + 'x' + res.height
}

function NotifyDebug(str) {
    ODS('aaSearch.js: ' + str);
}

function NotifyEnd() {
    if (searchTools.interfaces.aaSearch.endSearch)
        searchTools.interfaces.aaSearch.endSearch();
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var rNextGoogle = function () {
    NotifyDebug('rNextGoogle');
    whatNext();
}
var rNextBing = function () {
    NotifyDebug('rNextBing');
    whatNext();
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var searchSend = async function (r, a, t) {
    if (window._cleanUpCalled || wasClosed)
        return;
    NotifyDebug('SearchSend');
    var site = r.className;
    var host;
    if (usingCustomPhrase)
        host = r.host.replace('%custom%', encodeURIComponent(a));
    else {
        var q = '';
        if (r.usingQuotation)
            q = '"';
        var artistList = a.split(';'); // can be more than one
        var astr = '';
        artistList.forEach(function (artist) {
            if (astr)
                astr += q + '%20' + q;
            astr += encodeURIComponent(artist);
        });

        host = r.host.replace('%artist%', astr).replace('%album%', encodeURIComponent(t));
    }
    //        host = encodeURI(host).replace('%2526', '%26');
    try {
        if(searchTools.noticeGoogleSearch) {
            searchTools.noticeGoogleSearch(r);
        }
        if(usingAutomaticSearch && (r.name = 'Google') && searchTools.processGoogleDelay) {
            NotifyDebug('start Google request delay');
            await searchTools.processGoogleDelay();
            NotifyDebug('finished Google request delay');
            if (window._cleanUpCalled || wasClosed || (currentRequest >= aR.length))
                return;    
        }
        NotifyWebReq(host);
    } catch (err) {}
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var whatNext = function (init) {
    if (window._cleanUpCalled || wasClosed)
        return;
    var a;
    var t;
    a = cachedArtist;
    if (usingCustomPhrase) {
        t = '';
    } else {
        t = cachedAlbum;
    }
    if (init) {
        NotifyDebug('whatNext init');
    } else {
        NotifyDebug('whatNext continue');
        currentRequest++;
    }
    if (currentRequest < aR.length) {
        NotifyDebug('Calling search send');
        searchSend(aR[currentRequest], a, t);
    } else
        NotifyEnd();
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var AddResult = function (res) {
    var iswl = false;
    if (useWhiteList) {
        for (var i = 0; whitelist[i]; i++) {
            if (res.imglink.search(whitelist[i]) != -1) {
                iswl = true;
                break;
            }
        }
    }
    if (iswl) {
        aResult.splice(reswlnum, 0, res);
        reswlnum++;
    } else {
        for (var i = 0; blacklist[i]; i++) {
            if (res.imglink.search(blacklist[i]) != -1) {
                NotifyDebug('AddResult - blacklisted ' + res.imglink);
                return;
            }
        }
        NotifyDebug('AddResult ' + res.imglink);
        aResult.push(res);
    }
}
var rSuccessGoogle = function (html) {
    NotifyDebug('rSuccessGoogle');
    var googleRes = searchTools.parseGoogleImgSearchResponse(html);
    for (var i = 0; i < googleRes.length; i++) {
        AddResult(googleRes[i]);
    }
    if (aResult.length > 0) {
        for (var i = 0; i < aResult.length; i++) {
            NotifyResult(aResult[i]);
        }
        NotifyEnd();
        aResult.length = 0;
    } else
        whatNext();
}
var rSuccessBing = function (html) {
    NotifyDebug('rSuccessBing');
    var bingRes = searchTools.parseBingImgSearchResponse(html);
    for (var i = 0; i < bingRes.length; i++) {
        AddResult(bingRes[i]);
    }
    if (aResult.length > 0) {
        for (var i = 0; i < aResult.length; i++) {
            NotifyResult(aResult[i]);
        }
        NotifyEnd();
        aResult.length = 0;
    } else
        whatNext();
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var addGoogleRequests = function () {
    if (tryGoogle && (!searchTools.priorities || (searchTools.priorities.google !== 0))) {
        if (usingCustomPhrase) {
            rGoogle = new WebRequest();
            rGoogle.onSuccess = rSuccessGoogle;
            rGoogle.onFailure = rNextGoogle;
            rGoogle.host = 'https://www.google.com/search?safe=active&tbs=iar:s,ift:jpg&q=%custom%&tbm=isch';
            rGoogle.sendString = '';
            rGoogle.name = 'Google';
            rGoogle.className = 'Google';
            aR.push(rGoogle);
        } else {
            rGoogle = new WebRequest();
            rGoogle.onSuccess = rSuccessGoogle;
            rGoogle.onFailure = rNextGoogle;
            rGoogle.host = 'https://www.google.com/search?safe=active&tbs=iar:s,ift:jpg&q="%artist%"+"%album%"&tbm=isch';
            rGoogle.sendString = '';
            rGoogle.name = 'Google';
            rGoogle.className = 'Google';
            rGoogle.usingQuotation = true;
            aR.push(rGoogle);

            // second request - try without quotation marks
            rGoogle = new WebRequest();
            rGoogle.onSuccess = rSuccessGoogle;
            rGoogle.onFailure = rNextGoogle;
            rGoogle.host = 'https://www.google.com/search?safe=active&tbs=iar:s,ift:jpg&q=%artist%+%album%&tbm=isch';
            rGoogle.sendString = '';
            rGoogle.name = 'Google';
            rGoogle.className = 'Google';
            rGoogle.usingQuotation = false;
            aR.push(rGoogle);
        }
    }
}

var addBingRequests = function () {
    if (tryBing) {
        if (usingCustomPhrase) {
            rBing = new WebRequest();
            rBing.onSuccess = rSuccessBing;
            rBing.onFailure = rNextBing;
            rBing.host = 'https://www.bing.com/images/search?q=%custom%&qft=+filterui:aspect-square&form=IRFLTR&first=1&tsc=ImageBasicHover&sc=1-100';
            rBing.sendString = '';
            rBing.name = 'Bing';
            rBing.className = 'Bing';
            aR.push(rBing);
        } else {
            /* do not use quotations marks, it seems it often ruins the result, as Bing is somehow ignoring the phrases and looks for only some words
            rBing = new WebRequest();
            rBing.onSuccess = rSuccessBing;
            rBing.onFailure = rNextBing;
            rBing.host = 'https://www.bing.com/images/search?q="%artist%"+"%album%"&qft=+filterui:aspect-square&form=IRFLTR&first=1&tsc=ImageBasicHover&sc=1-100';
            rBing.sendString = '';
            rBing.name = 'Bing';
            rBing.className = 'Bing';
            rBing.usingQuotation = true;
            aR.push(rBing);
*/
            // without quotation marks
            rBing = new WebRequest();
            rBing.onSuccess = rSuccessBing;
            rBing.onFailure = rNextBing;
            rBing.host = 'https://www.bing.com/images/search?q=%artist%+%album%&qft=+filterui:aspect-square&form=IRFLTR&first=1&tsc=ImageBasicHover&sc=1-100';
            rBing.sendString = '';
            rBing.name = 'Bing';
            rBing.className = 'Bing';
            rBing.usingQuotation = false;
            aR.push(rBing);
        }
    }
}

var init = function () {
    NotifyDebug('init');
    aResult.length = 0;
    aR.length = 0;
    reswlnum = 0;
    currentRequest = 0;
    if(tryGoogle && usingAutomaticSearch && searchTools.checkGoogleFreq && (searchTools.priorities.google !== 0)) {
        let allowGoogleFirst = searchTools.checkGoogleFreq();
        if(allowGoogleFirst) {
            NotifyDebug('Standard Google priority');
            searchTools.priorities.google = 10;
        } else {
            NotifyDebug('Decreasing Google priority');
            searchTools.priorities.google = 100;
        }
    }
    if(searchTools.priorities && (searchTools.priorities.google > searchTools.priorities.bing)) {
        addBingRequests();
        addGoogleRequests();
    } else {
        addGoogleRequests();
        addBingRequests();
    }

    whatNext(true);
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
searchTools.interfaces.aaSearch.startSearch = function (artist, title, params) {
    if (wasClosed) {
        registerClosed();
    }
    params = params || {};
    NotifyDebug('SearchAA: Artist: ' + artist + ' ,Album: ' + title + ', isAutoSearch:' + (params ? params.isAutoSearch : false));
    cachedArtist = artist || ''; // to avoid undefined value
    cachedAlbum = title || '';
    usingCustomPhrase = false;
    usingAutomaticSearch = params.isAutoSearch;
    init();
}
searchTools.interfaces.aaSearch.startCustomSearch = function (searchPhrase) {
    if (wasClosed) {
        registerClosed();
    }
    NotifyDebug('SearchAA: ' + searchPhrase);
    cachedArtist = searchPhrase;
    usingCustomPhrase = true;
    usingAutomaticSearch = false;
    init();
}
searchTools.interfaces.aaSearch.defaultSearchPhrase = function (artist, title) {
    var retval = ''
    if (artist)
        retval = '"' + artist + '"';
    if (title) {
        if (retval)
            retval += '+';
        retval += '"' + title + '"';
    }
    return retval;
}
searchTools.interfaces.aaSearch.cancelSearch = function () {
    if (downloadPromise) {
        cancelPromise(downloadPromise);
        downloadPromise = null;
    }
    aResult.length = 0;
    aR.length = 0;
    reswlnum = 0;
    currentRequest = 0;
}

var LoadedWebPage = function (webcontent) {
    NotifyDebug('LoadedWebPage');
    if ((currentRequest < aR.length) && (aR[currentRequest].onSuccess != null)) {
        aR[currentRequest].onSuccess(webcontent);
    }
}
var LoadWebPageFailed = function () {
    if (window._cleanUpCalled || wasClosed)
        return;
    NotifyDebug('LoadWebPageFailed');
    if ((currentRequest < aR.length) && (aR[currentRequest].onFailure != null)) {
        aR[currentRequest].onFailure();
    }
}
