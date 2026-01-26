/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";
requirejs('helpers/discogs');

var blacklist = ['covershut.com', 'searchednews.com', 'fansshare.com', 'musicnow.cz', 'images-na.ssl-images-amazon.com', 'selcdn.ru', 'lookaside.fbsbx.com', 'lookaside.instagram.com', 'www.tiktok.com', 'shutterstock.com'];
var artistSearchTermMapping = {
    '10cc': '10cc band',
    'abba': 'abba+band',
    'ace of base': '"ace of base"+band',
    'a-ha': '"a-ha"+band',
    'air': 'air+band',
    'airwolf': 'aiwolf+band',
    'animals': 'the+animals+band',
    'the animals': 'the+animals+band',
    'aqua': 'aqua+band',
    'bangles': 'bangles+band',
    'the bangles': 'bangles+band',
    'beach boys': '"the beach boys"',
    'bee gees': '"bee gees" -tribute',
    'the bee gees': '"bee gees" -tribute',
    'bleach': 'Bleach Christian Band',
    'bush': 'Bush (band)',
    'buty': 'buty skupina',
    'camouflage': 'camouflage+band',
    'chevelle': 'Chevelle (band)',
    'cold': 'Cold (band)',
    'cranberries': 'the cranberries',
    'cream': 'cream+band',
    'creed': 'Creed (band)',
    'd12': 'D12 (rap group)',
    'dune': 'dune+band',
    'doors': 'doors+band',
    'eagles': 'the eagles',
    'ellery': 'Ellery Justin and Tasha golden',
    'eric serra': '"eric serra" music',
    'europe': 'europe+band',
    'everclear': 'Everclear (band)',
    'fastball': 'Fastball (band)',
    'fuel': 'Fuel (band)',
    'gala': 'gala rizzatto',
    'garbage': 'garbage+band',
    'gaudi': 'gaudi+band',
    'go home productions': 'go home productions vidler',
    'heart': 'heart band',
    'jars of clay': 'Jars of Clay (band)',
    'jill phillips': 'Jill Phillips (musician)',
    'john reuben': 'John Reuben (musician)',
    'kopecky': 'kopecky band',
    'larue': 'Natalie and Phillip LaRue',
    'love': 'love+band',
    'lamb': 'lamb+band',
    'marion black': '"marion black" songwriter',
    'mark moon': 'mark+moon+music',
    'mig 21': '"mig 21" skupina',
    'mig21': '"mig 21" skupina',
    'meatloaf': 'meat loaf singer',
    'monkey business': '"monkey business" bandzone',
    'muse': 'Muse (band)',
    'oasis': 'Oasis (band)',
    'one more time': '"one more time" highland',
    'pink floyd': '"pink floyd"+band',
    'plumb': 'Plumb (band)',
    'police': 'police+band',
    'prince': 'prince musician',
    'queen': 'Queen band',
    'rare earth': '"Rare Earth" band',
    'richard wright': '"richard wright" musician',
    'rolling stones': '"the rolling stones"',
    'rob d': '"rob dougan"',
    'roxette': 'roxette -tribute',
    'rush': 'rush band',
    'sandra': 'sandra+singer',
    'say hi': 'say hi band',
    'scorpions': 'scorpions+band',
    'skillet': 'Skillet (band)',
    'sleepwave': 'Sleepwave (band) (spencer chamberlain)',
    'stick figure': '"stick figure" band',
    'texas': 'texas+band',
    'the grapes of wrath': '"the grapes of wrath" band',
    'the police': 'the police band',
    'the postal service': 'the postal service band',
    'the who': 'the who band',  
    'tonic': 'tonic+band',
    'vangelis': 'vangelis+composer',
    'yes': 'yes+band'
}

var onlySquare = false;
var currentRequest = 0;
var cachedArtist;
var rGoogle;
var tryGoogle = true;
if(app) {
    tryGoogle = ((app.versionHi >= 2024) && (app.versionBuild >= 3012)) ||
                ((app.versionHi >= 5) && (app.versionBuild >= 2695));
}
var tryBing = true;
var tryDiscogs = true;
var usingAutomaticSearch = false;
var usingCustomPhrase = false;
var aR = new Array();
var aResult = new Array();
var onlyOneSearch = false;
var params = {};
var wasClosed = true;

function getArtistSearchMapping(artist) {
    var retval = '';
    if (artistSearchTermMapping[artist])
        retval = artistSearchTermMapping[artist];
    return retval;
}

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

    /*    var headers = newStringList();
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
    searchTools.interfaces.artistSearch.showResult(res.imglink, res.thumblink, res.width, res.height, res.thumbwidth, res.thumbheight, res.source, res.sourcelink, res.filesize);
    //res.thumblink
    //res.width + 'x' + res.height
}

function NotifyDebug(str) {
    ODS('artistSearch.js: ' + str);
}

function NotifyEnd() {
    if (searchTools.interfaces.artistSearch.endSearch)
        searchTools.interfaces.artistSearch.endSearch();
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
var searchSend = async function (r, a) {
    if (window._cleanUpCalled || wasClosed)
        return;
    NotifyDebug('SearchSend');
    var site = r.className;
    var ma = undefined;
    if (!usingCustomPhrase)
        ma = getArtistSearchMapping(a);
    var host;
    if (!ma || !r.withQuotes) {
        ma = ma || a;
        host = r.host.replace('%artist%', ma.replace('&', '%26'));
    } else {
        host = r.host.replace('"%artist%"', ma.replace('&', '%26')); // quotes should be already contained in mapped string, if needed
        onlyOneSearch = true; // we use only one searching for mapped artists
    }
    host = encodeURI(host).replace('%2526', '%26');
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
    if (init) {
        NotifyDebug('whatNext init');
        a = cachedArtist.toLowerCase();
    } else {
        NotifyDebug('whatNext continue');
        a = cachedArtist.toLowerCase();
        currentRequest++;
    }
    if ((aResult.length < params.maxResults) && (currentRequest < aR.length) && (!onlyOneSearch)) {
        NotifyDebug('Calling search send');
        var req = aR[currentRequest];
        if (req)
            searchSend(req, a);
        else
            NotifyEnd();
    } else
        NotifyEnd();
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var AddResult = function (res) {
    for (var i = 0; blacklist[i]; i++) {
        if (res.imglink.search(blacklist[i]) != -1) {
            NotifyDebug('AddResult - blacklisted ' + res.imglink);
            return;
        }
    }
    NotifyDebug('AddResult ' + res.imglink);
    aResult.push(res);
}
var rSuccessGoogle = function (html) {
    NotifyDebug('rSuccessGoogle');
    var nextResultIndex = aResult.length;
    var googleRes = searchTools.parseGoogleImgSearchResponse(html);
    for (var i = 0; i < googleRes.length; i++) {
        AddResult(googleRes[i]);
    }
    if (aResult.length > nextResultIndex) {
        for (var i = nextResultIndex; i < aResult.length; i++) {
            NotifyResult(aResult[i]);
        }
        NotifyEnd();
        aResult.length = 0;
    } else
        whatNext();
}
var rSuccessBing = function (html) {
    NotifyDebug('rSuccessBing');
    var nextResultIndex = aResult.length;
    var bingRes = searchTools.parseBingImgSearchResponse(html);
    for (var i = 0; i < bingRes.length; i++) {
        AddResult(bingRes[i]);
    }
    if (aResult.length > nextResultIndex) {
        for (var i = nextResultIndex; i < aResult.length; i++) {
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
        let sq = '';
        if (onlySquare)
            sq = 'tbs=iar:s,';
        if (params.minSize) {
            if (params.minSize === 'large') {
                sq += 'tbs=isz:l,';
            } else {
                var minSizeN = Number(params.minSize);
                if (!isNaN(minSizeN) && (minSizeN > 400)) {
                    if (minSizeN < 640) {
                        sq += 'tbs=isz:lt,islt:qsvga,';
                    } else if (minSizeN < 800) {
                        sq += 'tbs=isz:lt,islt:vga,';
                    } else if (minSizeN < 1024) {
                        sq += 'tbs=isz:lt,islt:svga,';
                    } else if (minSizeN < 1600) {
                        sq += 'tbs=isz:lt,islt:xga,';
                    } else if (minSizeN < 2272) {
                        sq += 'tbs=isz:lt,islt:2mp,';
                    } else {
                        sq += 'tbs=isz:lt,islt:4mp,';
                    }
                }
            }
        };
        if (!usingCustomPhrase) {
            // request with quotes
            rGoogle = new WebRequest();
            rGoogle.onSuccess = rSuccessGoogle;
            rGoogle.onFailure = rNextGoogle;
            rGoogle.host = 'https://www.google.com/search?safe=active&' + sq + 'itp:photo,ift:jpg&tbm=isch&q="%artist%"';
            rGoogle.sendString = '';
            rGoogle.name = 'Google';
            rGoogle.className = 'Google';
            rGoogle.withQuotes = true;
            aR.push(rGoogle);
        }
        // request without quotes
        rGoogle = new WebRequest();
        rGoogle.onSuccess = rSuccessGoogle;
        rGoogle.onFailure = rNextGoogle;
        rGoogle.host = 'https://www.google.com/search?safe=active&' + sq + 'itp:photo,ift:jpg&tbm=isch&q=%artist%';
        rGoogle.sendString = '';
        rGoogle.name = 'Google';
        rGoogle.className = 'Google';
        aR.push(rGoogle);
    }
}

var addBingRequests = function () {
    if (tryBing) {
        let sq = '';
        sq = '+filterui:photo-photo';
        if (onlySquare)
            sq += '+filterui:aaspect-square';
        var minSizeN = Number(params.minSize);
        if (!isNaN(minSizeN) && (minSizeN > 400)) {
            if (minSizeN < 400) {
                sq += '+filterui:imagesize-small';
            } else if (minSizeN < 800) {
                sq += '+filterui:imagesize-medium';
            } else if (minSizeN < 1200) {
                sq += '+filterui:imagesize-large';
            } else {
                sq += '+filterui:imagesize-wallpaper';
            };
        }
        if (!usingCustomPhrase) {
            // request with quotes
            rBing = new WebRequest();
            rBing.onSuccess = rSuccessBing;
            rBing.onFailure = rNextBing;
            rBing.host = 'https://www.bing.com/images/search?q="%artist%"&qft=' + sq + '&form=IRFLTR&first=1&tsc=ImageBasicHover&sc=1-100';
            rBing.sendString = '';
            rBing.name = 'Bing';
            rBing.className = 'Bing';
            rBing.withQuotes = true;
            aR.push(rBing);
        }
        rBing = new WebRequest();
        rBing.onSuccess = rSuccessBing;
        rBing.onFailure = rNextBing;
        rBing.host = 'https://www.bing.com/images/search?q=%artist%&qft=' + sq + '&form=IRFLTR&first=1&tsc=ImageBasicHover&sc=1-100';
        rBing.sendString = '';
        rBing.name = 'Bing';
        rBing.className = 'Bing';
        rBing.usingQuotation = false;
        aR.push(rBing);
    }
}

var init = function () {
    NotifyDebug('init');
    aResult.length = 0;
    aR.length = 0;
    currentRequest = 0;
    onlyOneSearch = false;
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

    if (tryDiscogs && !usingCustomPhrase) {
        NotifyDebug('Trying Discogs first');
        params.uid = params.uid || createUniqueID();
        window.discogs.findArtistImage(params.uid, cachedArtist).then(function (res) {
            if (res) {
                AddResult(res);
                NotifyResult(res);
            }
            whatNext(true);
        });
    } else
        whatNext(true);
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
searchTools.interfaces.artistSearch.startSearch = function (artist, term2, rParams) {
    if (wasClosed) {
        registerClosed();
    }
    NotifyDebug('SearchArtist: Artist: ' + artist);
    usingCustomPhrase = false;
    cachedArtist = artist;
    params = rParams || {};
    params.maxResults = params.maxResults || 30; // only the first 30 results seem to be relevant (in case of Google search)    
    usingAutomaticSearch = params.isAutoSearch;
    if (params.onlyGoogle) {
        tryDiscogs = false;
    } else {
        tryDiscogs = true;
    }
    init();
}
searchTools.interfaces.artistSearch.startCustomSearch = function (searchPhrase) {
    if (wasClosed) {
        registerClosed();
    }
    NotifyDebug('SearchArtist: ' + searchPhrase);
    cachedArtist = searchPhrase;
    usingCustomPhrase = true;
    usingAutomaticSearch = false;
    init();
}
searchTools.interfaces.artistSearch.defaultSearchPhrase = function (artist) {
    var a = artist.toLowerCase();
    var ma = getArtistSearchMapping(a);
    ma = ma || '"' + a + '"';
    return ma;
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
