/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

var rELyrics = new LyricsSource();
rELyrics.onSuccess = function (html, xml) {
    var l = '';
    var p = '';
    try {
        l = html.split('<div id=\'inlyr\'>')[1].split('</div><br>')[0].trim();
        // contains some divs with ads by Google, change them to new lines only
        l = l.replace(/(\r|\n)/g, ''); // remove End of Line, so next replace works correcty
        l = l.replace(/<div(.*?)>(.*?)<\/div>/gi, '<br><br>'); // Google ads div
        l = cleanupLyrics(l);
        if (l) {
            p = 'ELyrics.com';
        }
    } catch (ex) {}
    whatNext(l, p);
};
rELyrics.onFailure = requestNext;
rELyrics.host = 'http://www.elyrics.net/read/%artistfirstchar%/%artist%-lyrics/%title%-lyrics.html';
rELyrics.sendString = '';
rELyrics.name = 'ELyrics';
rELyrics.formatURL = function (host) {
    return host.replace(/\s+/g, '-').replace(/\'+/g, '_').toLowerCase();
};
window.lyricsSources.push(rELyrics);


var rLyricsMode = new LyricsSource();
rLyricsMode.onSuccess = function (html, xml) {
    var l = '';
    var p = '';
    try {
        var rg = /<div id="lyrics_text"[^>]*>[\s]*(.*?)[\s]*<div/igms;
        var m = rg.exec(html);
        if (m.length > 1) {
            l = cleanupLyrics(m[1]);
            if (l) {
                p = 'lyricsmode.com';
            }
        }
    } catch (ex) {}
    whatNext(l, p);
};
rLyricsMode.onFailure = requestNext;
rLyricsMode.host = 'http://www.lyricsmode.com/lyrics/%artistfirstchar%/%artist%/%title%.html';
rLyricsMode.sendString = '';
rLyricsMode.name = 'Lyrics Mode';
rLyricsMode.formatURL = function (host) {
    return host.replace(/\s+/g, '_').replace(/\'+/g, '').toLowerCase().replace(/\?/g, '');
};
window.lyricsSources.push(rLyricsMode);



var rMusInfo = new LyricsSource();
rMusInfo.onSuccess = function (html, xml) {
    var l = '';
    var p = '';
    try {
        var txt = html.split('<table id="lyric"')[1].split('</table>')[0];
        txt = txt.replace(/(\r|\n)/g, ' '); // remove End of Lines
        txt = txt.replace(/<div class="h3 text-center">(.*?)<\/div><br>/, ''); // remove song title
        txt = txt.replace(/<\/div><br><div class="line">/gi, '</div><div class="line"><br></div><div class="line">'); // to preserve new lines in lyrics
        if (txt) {
            var rg = /<div class="line">(.*?)<\/div>/gi;
            var line = rg.exec(txt);
            while (line) {
                l += line[1] + '<br>';
                line = rg.exec(txt);
            }
            l = cleanupLyrics(l);
        }
        if (l) {
            p = 'musinfo.net';
        }
    } catch (ex) {}
    whatNext(l, p);
};
rMusInfo.onFailure = requestNext;
rMusInfo.host = 'http://musinfo.net/lyrics/%artist%/%title%';
rMusInfo.sendString = '';
rMusInfo.name = 'MusInfo';
rMusInfo.formatURL = function (host) {
    return host.replace(/\s+/g, '-').replace(/\'+/g, '').toLowerCase();
};
window.lyricsSources.push(rMusInfo);



var rChartlyrics = new LyricsSource();
var ChartlyricsStopWordsRE = new RegExp('\\babout\\b|\\bafter\\b|\\ball\\b|\\balso\\b|\\ban\\b|\\band\\b|\\banother\\b|\\bany\\b|\\bare\\b|\\bas\\b|\\bat\\b|\\bbe\\b|\\bbecause\\b|\\bbeen\\b|\\bbefore\\b|\\bbeing\\b|\\bbetween\\b|\\bboth\\b|\\bbut\\b|\\bby\\b|\\bcame\\b|\\bcan\\b|\\bcome\\b|\\bcould\\b|\\bdid\\b|\\bdo\\b|\\bdoes\\b|\\beach\\b|\\belse\\b|\\bfor\\b|\\bfrom\\b|\\bget\\b|\\bgot\\b|\\bhad\\b|\\bhas\\b|\\bhave\\b|\\bhe\\b|\\bher\\b|\\bhere\\b|\\bhim\\b|\\bhimself\\b|\\bhis\\b|\\bhow\\b|\\bif\\b|\\bin\\b|\\binto\\b|\\bis\\b|\\bit\\b|\\bits\\b|\\bjust\\b|\\blike\\b|\\bmake\\b|\\bmany\\b|\\bme\\b|\\bmight\\b|\\bmore\\b|\\bmost\\b|\\bmuch\\b|\\bmust\\b|\\bmy\\b|\\bnever\\b|\\bno\\b|\\bnow\\b|\\bof\\b|\\bon\\b|\\bonly\\b|\\bor\\b|\\bother\\b|\\bour\\b|\\bout\\b|\\bover\\b|\\bre\\b|\\bsaid\\b|\\bsame\\b|\\bsee\\b|\\bshould\\b|\\bsince\\b|\\bso\\b|\\bsome\\b|\\bstill\\b|\\bsuch\\b|\\btake\\b|\\bthan\\b|\\bthat\\b|\\bthe\\b|\\btheir\\b|\\bthem\\b|\\bthen\\b|\\bthere\\b|\\bthese\\b|\\bthey\\b|\\bthis\\b|\\bthose\\b|\\bthrough\\b|\\bto\\b|\\btoo\\b|\\bunder\\b|\\bup\\b|\\buse\\b|\\bvery\\b|\\bwant\\b|\\bwas\\b|\\bway\\b|\\bwe\\b|\\bwell\\b|\\bwere\\b|\\bwhat\\b|\\bwhen\\b|\\bwhere\\b|\\bwhich\\b|\\bwhile\\b|\\bwho\\b|\\bwill\\b|\\bwith\\b|\\bwould\\b|\\byou\\b|\\byour\\b', 'gi');
var ChartlyricsStopCharsRE = new RegExp('[\\(\\)\\[\\]\'\\!\\.:;,"\\|~\\?\\!]', 'gi');

var removeChartlyricsStopWords = function (txt) {
    if (!txt)
        return txt;
    var resTxt = txt.replace(ChartlyricsStopWordsRE, '');
    resTxt = resTxt.replace(ChartlyricsStopCharsRE, '');
    resTxt = resTxt.replace(/[\s]+/g, ' ');
    return resTxt.trim();
};

rChartlyrics.onSuccess = function (html) {
    NotifyDebug('rSuccessChartlyrics');
    var l = '';
    var p = '';
    try {
        if (isString(html) && (html.indexOf('<Lyric>') !== -1)) {
            let lA = html.split('<LyricArtist>')[1].split('</LyricArtist>')[0];
            let lT = html.split('<LyricSong>')[1].split('</LyricSong>')[0];
            if ((app.utils.stringSimilarity(lA, cachedArtist, false) >= 0.8) && (app.utils.stringSimilarity(lT, cachedTitle, false) >= 0.8)) { // it sometimes returns very different result because of removed stopwords
                l = html.split('<Lyric>')[1].split('</Lyric>')[0];
                l = l.replace(/\&#13;/gi, '<br>'); // Converts all "New Line" to br tag
                if (l) {
                    p = 'chartlyrics.com';
                }
            }
        }
    } catch (ex) {}
    whatNext(l, p);
};
rChartlyrics.onFailure = requestNext;
rChartlyrics.host = 'http://api.chartlyrics.com/apiv1.asmx/SearchLyricDirect?artist=%artist%&song=%title%';
rChartlyrics.sendString = '';
rChartlyrics.name = 'Chart Lyrics';
rChartlyrics.formatArtist = function (a) {
    return removeChartlyricsStopWords(a);
};
rChartlyrics.formatTitle = function (t) {
    return removeChartlyricsStopWords(t);
};
window.lyricsSources.push(rChartlyrics);


var replaceSonglyricsSpecialChars = function (txt) {
    if (!txt)
        return txt;
    var resTxt = txt.replace(/\s+/g, '-').replace(/\'+/g, '-').toLowerCase();
    resTxt = resTxt.replace(/[\.\+]/g, '-');
    resTxt = resTxt.replace(/[^a-z0-9\!\- ]/gi, '');
    return resTxt.replace(/-+/g, '-');
};
var rSonglyrics = new LyricsSource();
rSonglyrics.onSuccess = function (html, xml) {
    var l = '';
    var p = '';
    try {
        l = html.split('<p id="songLyricsDiv"  class="songLyricsV14 iComment-text">')[1].split('</p>')[0].trim();
        l = cleanupLyrics(l);
        if (l.startsWith('We do not have the lyrics')) {
            l = '';
        }
        if (l) {
            p = 'songlyrics.com';
        }
    } catch (ex) {}
    whatNext(l, p);
};
rSonglyrics.onFailure = requestNext;
rSonglyrics.host = 'http://www.songlyrics.com/%artist%/%title%-lyrics/';
rSonglyrics.sendString = '';
rSonglyrics.name = 'Song Lyrics';
rSonglyrics.formatArtist = function (a) {
    return replaceSonglyricsSpecialChars(a);
};
rSonglyrics.formatTitle = function (t) {
    return replaceSonglyricsSpecialChars(t);
};
window.lyricsSources.push(rSonglyrics);


var replaceLyricsTranslateSpecialChars = function (txt) {
    if (!txt)
        return txt;
    var resTxt = txt.replace(/\s+/g, '-').toLowerCase();
    resTxt = resTxt.replace(/[\?,\]\[\(\)\.;']/g, '');
    return resTxt;
};
var rLyricsTranslate = new LyricsSource();
rLyricsTranslate.onSuccess = function (html, xml) {
    var l = '';
    var p = '';
    try {
        l = html.split('<div id="song-body">')[1].split('<div id="song-transliteration">')[0].trim();
        l = l.replace(/<div class='emptyline'>\&nbsp;<\/div>/gi, '<br>');
        l = l.replace(/<div class="ll(.*?)">/gi, '<br>');
        l = cleanupLyrics(l);
        if (l) {
            p = 'lyricstranslate.com';
        }
    } catch (ex) {}
    whatNext(l, p);
};
rLyricsTranslate.onFailure = requestNext;
rLyricsTranslate.host = 'https://lyricstranslate.com/en/%artist%-%title%-lyrics.html';
rLyricsTranslate.sendString = '';
rLyricsTranslate.name = 'Lyrics Translate';
rLyricsTranslate.formatArtist = function (a) {
    return removeDiacritics(replaceLyricsTranslateSpecialChars(a));
};
rLyricsTranslate.formatTitle = function (t) {
    return replaceLyricsTranslateSpecialChars(t);
};
window.lyricsSources.push(rLyricsTranslate);


var replaceMoronNLSpecialChars = function (txt) {
    if (!txt)
        return txt;
    var resTxt = txt.replace(/\s+/g, '-').toLowerCase();
    resTxt = resTxt.replace(/['\!\&\]\[\/]/g, '');
    return resTxt;
};
var rMoronNL = new LyricsSource();
rMoronNL.onSuccess = function (html, xml) {
    var l = '';
    var p = '';
    try {
        l = html.split('<div class="sl">')[1].split('</div>')[0].trim();
        l = cleanupLyrics(l);
        if (l) {
            p = 'moron.nl';
        }
    } catch (ex) {}
    whatNext(l, p);
};
rMoronNL.onFailure = requestNext;
rMoronNL.host = 'https://moron.nl/lyrics/%artist%/%title%-lyrics.html';
rMoronNL.sendString = '';
rMoronNL.name = 'Moron.nl';
rMoronNL.formatArtist = function (a) {
    return removeDiacritics(replaceMoronNLSpecialChars(a));
};
rMoronNL.formatTitle = function (t) {
    return replaceMoronNLSpecialChars(t);
};
window.lyricsSources.push(rMoronNL);


var replaceAbsoluteLyricsSpecialChars = function (txt) {
    if (!txt)
        return txt;
    var resTxt = txt.replace(/\s+/g, '_').toLowerCase();
    resTxt = resTxt.replace(/,/g, ',2c');
    resTxt = resTxt.replace(/\!/g, ',21');
    resTxt = resTxt.replace(/\&/g, ',26');
    resTxt = resTxt.replace(/\//g, ',2f');
    resTxt = resTxt.replace(/\?/g, ',3f');
    resTxt = resTxt.replace(/\+/g, ',2b');
    resTxt = resTxt.replace(/=/g, ',3d');
    resTxt = resTxt.replace(/:/g, ',3a');
    resTxt = resTxt.replace(/"/g, ',22');
    resTxt = resTxt.replace(/\*/g, ',2a');
    return resTxt;
};
var rAbsoluteLyrics = new LyricsSource();
rAbsoluteLyrics.onSuccess = function (html, xml) {
    var l = '';
    var p = '';
    try {
        l = html.split('<p id="view_lyrics">')[1].split('</p>')[0].trim();
        l = cleanupLyrics(l);
        if (l) {
            p = 'absolutelyrics.com';
        }
    } catch (ex) {}
    whatNext(l, p);
};
rAbsoluteLyrics.onFailure = requestNext;
rAbsoluteLyrics.host = 'http://www.absolutelyrics.com/lyrics/view/%artist%/%title%';
rAbsoluteLyrics.sendString = '';
rAbsoluteLyrics.name = 'Absolute Lyrics';
rAbsoluteLyrics.formatArtist = function (a) {
    return replaceAbsoluteLyricsSpecialChars(a);
};
rAbsoluteLyrics.formatTitle = function (t) {
    return replaceAbsoluteLyricsSpecialChars(t);
};
window.lyricsSources.push(rAbsoluteLyrics);

var rLrcLib = new LyricsSource();
rLrcLib.onSuccess = function (html, xml) {
    var l = '';
    var p = '';
    try {
        l = html.split('"plainLyrics":"')[1].split('","syncedLyrics"')[0].trim();
        l = l.replace(/\\n/g, '<br>'); // Converts all "New Line" to br tag
        l = cleanupLyrics(l);
        if (l) {
            p = 'lrclib.net';
        }
    } catch (ex) {}
    whatNext(l, p);
};
rLrcLib.onFailure = requestNext;
rLrcLib.host = 'https://lrclib.net/api/get?artist_name=%artist%&track_name=%title%';
rLrcLib.sendString = '';
rLrcLib.name = 'lrclib.net';
rLrcLib.formatURL = function(host) { 
    let _host = host;
    if (cachedTrack)
        _host = _host + '&album_name=' + cachedTrack.album + '&duration=' + Math.round(Number(cachedTrack.songLength) / 1000);
    return _host;  
};
window.lyricsSources.push(rLrcLib);

var rTextyl = new LyricsSource();
rTextyl.onSuccess = function (html, xml) {
    var l = '';
    var p = '';
    try {        
        let json = html.substr(html.indexOf('['));     
        let ar = JSON.parse(json);        
        forEach(ar, function (obj) {
            l = l + obj.lyrics + '<br>';
        });    
        l = cleanupLyrics(l);
        if (l) {
            p = 'textyl.co';
        }
    } catch (ex) {}
    whatNext(l, p);
};
rTextyl.onFailure = requestNext;
rTextyl.host = 'https://api.textyl.co/api/lyrics?q=%artist% %title%';
rTextyl.sendString = '';
rTextyl.name = 'textyl.co';
rTextyl.disabled = true; //#21297, #21298
window.lyricsSources.push(rTextyl);
