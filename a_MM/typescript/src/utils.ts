'use strict';

/*
declare global {
    function GetFName(path: string)     
    function getFormatedTime(msec_num, params?)     
    function formatFileSize(fs: number)
    function isOurHTML(txt: string) 
    function isURLPath(path: string)    
    function isLocalPath(path: string) 
    function isNetworkPath(path: string)     
    function getFileExt(path: string)     
    function getFileFolder(path: string)     
    function getJustFilename(path: string)    
    function removeFileExt(path: string)    
    function isYoutubePath(path: string)
    function convertSpecialToEntities(str: string)     
    function yearFromDateString(dateStr: string)         
    function convertUnixToMSTimestamp(unixTimeMS)
    function replaceAll(old_pattern: string, new_pattern: string, str: string)     
    function escapeXml(unsafe) 
    function decodeHTML(str: string)     
    function isImgSrcEmpty(imgEl)    
    function generateUUID()    
    function removeFirstSlash(str)    
    function removeLastSlash(str)     
    function isNewTabEvent(evt)    
    function divFromSimpleMenu(divToFill, items)    
    function getExtendedTagsList(extendedTagsString)    
    function getSimplifiedExtendedTags(extendedTagsString, sep?: string)     
    function getTextDirection(s)         
    function simulateFullClick(el)         
    function addEnterAsClick(ctrl, el)
    function sanitizeHtml (inputStr: String, extraSelector?: String)
}
*/

window.utils = app.utils; // LS: previsouly was as 'var utils = app.utils' in templateFormats.js

function GetFName(path: string) {
    return path.replace(/^.*[\\/]/, '');
}
window.GetFName = GetFName;

function getFormatedTime(msec_num, params?) {
    let useEmptyHours = true;
    let useUnknownString = true;
    let useNegativeTime = false;
    let time: string;

    if (params) {
        if (params.useEmptyHours !== undefined)
            useEmptyHours = params.useEmptyHours;
        if (params.useUnknownString !== undefined)
            useUnknownString = params.useUnknownString;
        if (params.useNegativeTime !== undefined)
            useNegativeTime = params.useNegativeTime;
    }
    let sign = '';
    let sec_num = Math.round(msec_num / 1000.0);
    if ((msec_num < 0) && (useNegativeTime)) {
        sec_num = -sec_num;
        msec_num = -msec_num;
        sign = '-';
    }
    if (msec_num < -1) {
        time = '';
    } else {
        if (msec_num < 0) {
            if (useUnknownString) {
                time = _('Unknown');
            } else {
                time = '';
            }
        } else {
            let hours = Math.floor(sec_num / 3600);
            let minutes = Math.floor((sec_num - (hours * 3600)) / 60);
            let seconds = sec_num - (hours * 3600) - (minutes * 60);

            if (hours < 10) { // @ts-ignore
                hours = '0' + hours;
            }
            if (minutes < 10) { // @ts-ignore
                minutes = '0' + minutes;
            }
            if (seconds < 10) { // @ts-ignore
                seconds = '0' + seconds;
            }
            if (useEmptyHours || (hours > 0))
                time = sign + hours + ':' + minutes + ':' + seconds;
            else {
                time = sign + minutes + ':' + seconds;
            }
        }
    }
    return time;
}
window.getFormatedTime = getFormatedTime;

function formatFileSize(fs: number) {
    if (fs < 0)
        return '';
    else {
        if (fs < 1000)
            return fs + ' ' + _('B');
        else {
            let fracFs = fs / 1024;
            if (fracFs < 1024)
                return fracFs.toFixed(1) + ' ' + _('KB');
            else {
                fracFs = fracFs / 1024;
                if (fracFs < 1024)
                    return fracFs.toFixed(1) + ' ' + _('MB');
                else {
                    fracFs = fracFs / 1024;
                    return fracFs.toFixed(1) + ' ' + _('GB');
                }
            }
        }
    }
}
window.formatFileSize = formatFileSize;

function isOurHTML(txt: string) {
    if(txt && ((txt.indexOf(' data-html="1"')>-1) || ((txt.indexOf('class="ratingStar"')>-1))))
        return  sanitizeHtml(txt);
    else
        return false;
}
window.isOurHTML = isOurHTML;

function isURLPath(path: string) {
    return (path.length >= 2) && (path[0] !== '\\') && (path[0] !== '/') && (path[0] !== ':') && (path[1] !== ':') && (path[0] !== '[');
}
window.isURLPath = isURLPath;

function isLocalPath(path: string) {
    return (path.length >= 2) && (path[1] == ':');
}
window.isLocalPath = isLocalPath;

function isNetworkPath(path: string) {
    return (path.length >= 2) && (path[0] == '\\') && (path[1] == '\\');
}
window.isNetworkPath = isNetworkPath;

function getFileExt(path: string) {
    let dot_pos = path.lastIndexOf('.');
    let back_pos = path.lastIndexOf('\\');
    let slash_pos = path.lastIndexOf('/');
    if ((dot_pos > 0) && (dot_pos > back_pos) && (dot_pos > slash_pos))
        return path.substr(dot_pos + 1);
    else
        return '';
}
window.getFileExt = getFileExt;

function getFileFolder(path: string) {
    let pos = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'));
    if (pos >= 0)
        return path.substr(0, pos + 1);
    else
        return '';
}
window.getFileFolder = getFileFolder;

function getJustFilename(path: string) {
    let pos = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'));
    if (pos >= 0)
        return path.substr(pos + 1);
    else
        return path;
}
window.getJustFilename = getJustFilename;

function removeFileExt(path: string) {
    let dot_pos = path.lastIndexOf('.');
    let back_pos = path.lastIndexOf('\\');
    let slash_pos = path.lastIndexOf('/');
    if ((dot_pos > 0) && (dot_pos > back_pos) && (dot_pos > slash_pos))
        return path.substr(0, dot_pos);
    else
        return path;
}
window.removeFileExt = removeFileExt;

function isYoutubePath(path: string) {
    if (path === '')
        return true; // empty path -> we will try to find the track on Youtube
    if (!path)
        return false; // undefined/null path, something is wrong, not YT track
    let regExp = /^.*\b(youtu\.be|youtube\.com|youtube-nocookie\.com)\/(v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    return !!path.match(regExp);
}
window.isYoutubePath = isYoutubePath;

interface __UTILS {
    // following consts corresponds to internal cache status values in GlobVars.pas
    CACHE_NONE: number; // default for local library tracks
    CACHE_CACHED: number; // deprecated, was used in MM4 for Virtual CDs
    CACHE_DOWNLOADED: number; // track downloaded to library from cloud
    CACHE_STREAMED: number; // track added to library from cloud
    CACHE_LINKED: number; // track matched/linked with a remote cloud copy
    
    isRemoteTrack(track: Track): boolean; 
    hasRemoteTrackLink(track: Track): boolean; 
    isCloudTrack(track: Track): boolean; 
    isOnlineTrack(track: Track): boolean; 
    youtubeWebSource: () => string; 
    isYoutubeTrack(track: Track): boolean; 
    isMediaServerTrack(track: Track): boolean; 
    isAudioCDTrack(track: Track): boolean; 
    isLibraryTrack(track: Track): boolean; 
    getFirstTrackAsync(tracklist: Tracklist): Promise<Track>; 
    getTrackCountAsync(tracklist: Tracklist): Promise<integer>; 
    isSyncableTrack(track: Track): boolean; 
    isDeletableTrack(track: Track): boolean; 
    isTrackWithEditablePath(track: Track): boolean; 
    getFileSourceIcons: (track: Track) => string[]; 
    isVariousArtist: (artist: string) => boolean;
    cleanAndValidateURL(inputStr: string):string;
    isImageFile(url: string):boolean;
    /**
     * Can be overridden or appended by addons
     */
    _variousArtistsNames: any[];
}

let __utils = {

    // following consts corresponds to internal cache status values in GlobVars.pas
    CACHE_NONE: 0, // default for local library tracks
    CACHE_CACHED: 1, // deprecated, was used in MM4 for Virtual CDs
    CACHE_DOWNLOADED: 2, // track downloaded to library from cloud
    CACHE_STREAMED: 3, // track added to library from cloud
    CACHE_LINKED: 4, // track matched/linked with a remote cloud copy

    isRemoteTrack(track: Track) {
        return _utils.isCloudTrack(track) || isURLPath(track.path) || (track.path == '') || _utils.isYoutubeTrack(track) || _utils.isMediaServerTrack(track);
    },

    hasRemoteTrackLink(track: Track) {
        return inArray(track.cacheStatus, [_utils.CACHE_LINKED, _utils.CACHE_DOWNLOADED, _utils.CACHE_STREAMED]);
    },

    isCloudTrack(track: Track) {
        return (track.cacheStatus == _utils.CACHE_STREAMED);
    },

    isOnlineTrack(track: Track) {
        return _utils.isYoutubeTrack(track); // currently only YT tracks supported
    },

    youtubeWebSource: function () {
        return '{ "sourceType": "youtube" }';
    },

    isYoutubeTrack(track: Track) {
        let cs = track.cacheStatus;
        if ((cs === _utils.CACHE_LINKED) || (cs === _utils.CACHE_DOWNLOADED) || (cs === _utils.CACHE_STREAMED))
            return false;
        if (track.webSource) {
            let sourceInfo;
            try {
                sourceInfo = JSON.parse(track.webSource);
            } catch (e) {
                ODS('Parsing webSource failed, err:' + e + ', value: ' + track.webSource);
                return false;
            }
            return (sourceInfo.sourceType === 'youtube');
        }
        return isYoutubePath(track.path);
    },

    isMediaServerTrack(track: Track) {
        return track.path.startsWith('uuid://');
    },

    isAudioCDTrack(track: Track) {
        let ext = getFileExt(track.path);
        return (ext == 'cda' || ext == 'CDA');
    },

    isLibraryTrack(track: Track) {
        return (track.id > 0);
    },

    getFirstTrackAsync(tracklist: Tracklist) {
        return new Promise<Track>((resolve) => {
            if (tracklist) {
                tracklist.whenLoaded().then(() => {
                    if (tracklist.count)
                        resolve(getValueAtIndex(tracklist, 0));
                    else
                        resolve(null);
                });
            } else
                resolve(null);
        });
    },

    getTrackCountAsync(tracklist: Tracklist) {
        return new Promise<integer>((resolve) => {
            if (tracklist) {
                tracklist.whenLoaded().then(() => {
                    if (tracklist.count)
                        resolve(tracklist.count);
                    else
                        resolve(null);
                });
            } else
                resolve(null);
        });
    },

    isSyncableTrack(track: Track) {
        return !_utils.isYoutubeTrack(track);
    },

    isDeletableTrack(track: Track) {
        return _utils.isLibraryTrack(track) || !_utils.isOnlineTrack(track); // youtube tracks aren't deletable from online views (#14693)
    },

    isTrackWithEditablePath(track: Track) {
        return !_utils.isCloudTrack(track) && !_utils.isMediaServerTrack(track) && !_utils.isOnlineTrack(track);
    },

    getFileSourceIcons: function (track: Track) {

        /* legend (per suggestions in #15023)
        [drive][cloud] - cloud track that has been matched with already existing local track on hdd
        [download][cloud] - cloud track that has been downloaded to library (cached)
        [link][cloud] - cloud track presented in library (added into library), but not cached
        [cloud] - just cloud track (e.g. in Devices & Services > GPM > All tracks) - not in library
        [drive] - just local track scanned into library (as in MM4)
        [link][youtube] - youtube track in library
        [youtube] - just youtube track (not in library)
        */

        let icons = ['drive']; // local HDD

        let checkLibraryStatus = (icons) => {
            if (track.id > 0)
                icons.splice(0, 0, 'link');
            return icons;
        };

        if (track.cacheStatus == _utils.CACHE_LINKED)
            icons = ['drive', 'cloud']; // track matched/linked with a remote cloud copy 
        else
        if (track.cacheStatus == _utils.CACHE_DOWNLOADED)
            icons = ['download', 'cloud']; // downloaded from cloud
        else
        if (track.cacheStatus == _utils.CACHE_STREAMED) {
            let icon = 'cloud'; // available to stream from cloud
            /*var sourceInfo = cloudTools.getSourceInfo(track);
                    if (sourceInfo.service_id)
                        icon = resolveToValue(cloudServices[sourceInfo.service_id].icon);*/

            icons = checkLibraryStatus([icon]);
        } else
        if (_utils.isMediaServerTrack(track)) {
            icons = checkLibraryStatus(['server']);
        } else
        if (_utils.isOnlineTrack(track)) {
            icons = checkLibraryStatus(['youtube']);
        } else
        if (_utils.isRemoteTrack(track))
            icons = checkLibraryStatus(['server']);
        else
        if (_utils.isAudioCDTrack(track))
            icons = checkLibraryStatus(['cd']);
        return icons;
    },

    isVariousArtist: function (artist) {
        if (artist) {
            return _utils._variousArtistsNames.indexOf(artist.toLowerCase()) >= 0;
        }
        return false;
    },
    
    cleanAndValidateURL: function(inputStr: string) {
        if(!inputStr)
            return '';
        let cleanedInput = inputStr.replace(/['"`]/g, ''); // to avoid string injection
        let urlPattern = /^(https?:\/\/)?([a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*)(\.[a-zA-Z]{2,})(\/[^\s]*)?$/;
        if (urlPattern.test(cleanedInput)) {
            return cleanedInput;
        }
        return '';
    },

    isImageFile: function(url: string) {
        if(!url)
            return false;
        let ext = getFileExt(url);
        return ((ext === 'jpg') || (ext === 'jpeg') || (ext === 'png') || (ext === 'gif'));
    },
    
    /**
     * Can be overridden or appended by addons
     */
    _variousArtistsNames: [_('Various').toLowerCase(), _('Various Artists').toLowerCase(), 'various', 'various artists'],
};
window._utils = __utils;

function convertSpecialToEntities(str: string) {
    // currenctly do not contain ampersand, to not double-convert already existing entities
    let regexEscape = /["'<>`]/g;
    let encodeMap = {
        '\'': 'apos',
        '"': 'quot',
        '<': 'lt',
        '>': 'rt',
        '`': 'grave',
    };
    return str.replace(regexEscape, function (s) {
        return '&' + encodeMap[s] + ';';
    });
}
window.convertSpecialToEntities = convertSpecialToEntities;

function yearFromDateString(dateStr: string) {
    let retval = '';
    if (dateStr) {
        let dt = new Date(dateStr);
        retval = dt.getFullYear().toString();
    }
    return retval;
}
window.yearFromDateString = yearFromDateString;

// convert Unix timestamp (ms from 1.1.1970) to MS timestamp (days from 30.12.1899)
function convertUnixToMSTimestamp(unixTimeMS) {
    return 25569 + unixTimeMS / 86400000.0;
}
window.convertUnixToMSTimestamp = convertUnixToMSTimestamp;

function replaceAll(old_pattern: string, new_pattern: string, str: string) {
    // LS: taken from https://jsfiddle.net/sgmnawf8/1/ -- bunch of alternate methods there + speed compare
    return str.split(old_pattern).join(new_pattern);
}
window.replaceAll = replaceAll;

function escapeXml(unsafe) {
    return unsafe.replace(/[<>&'"]/g, function (c) {
        switch (c) {
        case '<':
            return '&lt;';
        case '>':
            return '&gt;';
        case '&':
            return '&amp;';
        case '\'':
            return '&apos;';
        case '"':
            return '&quot;';
        }
    });
}
window.escapeXml = escapeXml;

/** @since 5.0.2 */
function decodeHTML(str: string) {
    let map = {
        'gt': '>',
        'lt': '<',
        'quot': '"',
        'amp': '&',
        'nbsp': ' ',
        'Scaron': 'Š',
        'scaron': 'š',
        'circ': 'ˆ',
        'tilde': '˜',
        'ensp': ' ',
        'emsp': ' ',
        'thinsp': ' ',
        'ndash': '–',
        'mdash': '—',
        'lsquo': '‘',
        'rsquo': '’',
        'sbquo': '‚',
        'ldquo': '“',
        'rdquo': '”',
        'bdquo': '„',
        'dagger': '†',
        'Dagger': '‡',
        'permil': '‰',
        'lsaquo': '‹',
        'rsaquo': '›',
        'euro': '€',
        'frasl': '/',
        'deg': '°',
        'plusmn': '±',
        'sup2': '²',
        'sup3': '³',
        'acute': '´',
        'micro': 'µ',
        'para': '¶',
        'cedil': '¸',
        'sup1': '¹',
        'ordm': 'º',
        'frac14': '¼',
        'frac12': '½',
        'frac34': '¾',
        'iquest': '¿',
        'Agrave': 'À',
        'Aacute': 'Á',
        'Acirc': 'Â',
        'Atilde': 'Ã',
        'Auml': 'Ä',
        'Aring': 'Å',
        'AElig': 'Æ',
        'Ccedil': 'Ç',
        'Egrave': 'È',
        'Eacute': 'É',
        'Ecirc': 'Ê',
        'Euml': 'Ë',
        'Igrave': 'Ì',
        'Iacute': 'Í',
        'Icirc': 'Î',
        'Iuml': 'Ï',
        'ETH': 'Ð',
        'Ntilde': 'Ñ',
        'Ograve': 'Ò',
        'Oacute': 'Ó',
        'Ocirc': 'Ô',
        'Otilde': 'Õ',
        'Ouml': 'Ö',
        'times': '×',
        'Oslash': 'Ø',
        'Ugrave': 'Ù',
        'Uacute': 'Ú',
        'Ucirc': 'Û',
        'Uuml': 'Ü',
        'Yacute': 'Ý',
        'THORN': 'Þ',
        'szlig': 'ß',
        'agrave': 'à',
        'aacute': 'á',
        'acirc': 'â',
        'atilde': 'ã',
        'auml': 'ä',
        'aring': 'å',
        'aelig': 'æ',
        'ccedil': 'ç',
        'egrave': 'è',
        'eacute': 'é',
        'ecirc': 'ê',
        'euml': 'ë',
        'igrave': 'ì',
        'iacute': 'í',
        'icirc': 'î',
        'iuml': 'ï',
        'eth': 'ð',
        'ntilde': 'ñ',
        'ograve': 'ò',
        'oacute': 'ó',
        'ocirc': 'ô',
        'otilde': 'õ',
        'ouml': 'ö',
        'divide': '÷',
        'oslash': 'ø',
        'ugrave': 'ù',
        'uacute': 'ú',
        'ucirc': 'û',
        'uuml': 'ü',
        'yacute': 'ý',
        'thorn': 'þ',
        'yuml': 'ÿ',
        'Yuml': 'Ÿ',
        'copy': '©',
        'trade': '™'
    };
    return str.replace(/&(#(?:x[0-9a-f]+|\d+)|[a-z]+);?/gi, function ($0, $1) {
        if ($1[0] === '#') {
            return String.fromCharCode($1[1].toLowerCase() === 'x' ? parseInt($1.substr(2), 16) : parseInt($1.substr(1), 10));
        } else {
            return map.hasOwnProperty($1) ? map[$1] : $0;
        }
    });
}
window.decodeHTML = decodeHTML;

function isImgSrcEmpty(imgEl) {
    let src = imgEl.src;
    return ((src === '') || (src === imgEl.baseURI.substr(0, src.length) /* Chrome bug, setting empty string to src fills baseURI */));
}
window.isImgSrcEmpty = isImgSrcEmpty;

function generateUUID() {
    if (!window.isStub) {
        return app.utils.createUUID();
    } else {
        let d = new Date().getTime();
        let uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            let r = (d + Math.random() * 16) % 16 | 0;
            d = Math.floor(d / 16);
            return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
        return uuid;
    }
}
window.generateUUID = generateUUID;

function removeFirstSlash(str) {
    let firstChar = str.substr(0, 1);
    if (firstChar === '/' || firstChar === '\\') {
        return str.substr(1, str.length - 1);
    }
    return str;
}
window.removeFirstSlash = removeFirstSlash;

function removeLastSlash(str) {
    let endChar = str.substr(-1);
    if (endChar === '/' || endChar === '\\') {
        return str.substr(0, str.length - 1);
    }
    return str;
}
window.removeLastSlash = removeLastSlash;

function isNewTabEvent(evt) {
    if (!evt)
        return false;
    return ((evt.which === 2 /* middle button */) || ((evt.which === 1 /* left button */) && evt.ctrlKey) || (evt.detail && evt.detail.newTab));
}
window.isNewTabEvent = isNewTabEvent;

function getExtendedTagsList(extendedTagsString) {
    // getting list of extendeed tags, safer version
    let result;
    try {
        result = JSON.parse(extendedTagsString);
    } catch (e) {
        ODS('Parsing ExtendedTags failed, err:' + e + ', tags: ' + extendedTagsString);
        result = [];
    }
    return result;
}
window.getExtendedTagsList = getExtendedTagsList;

function getSimplifiedExtendedTags(extendedTagsString, sep?: string) {
    if (!extendedTagsString || (extendedTagsString === '[]'))
        return '';
    sep = sep || '; ';
    // '","value":"' -> ': '
    // '"},{"title":"' -> '; '
    // '[{"title":"' -> ''
    // '"}]' -> ''
    let result = extendedTagsString.replace(/","value":"/g, ': ');
    result = result.replace(/"\},\{"title":"/g, sep);
    result = result.replace(/^\[\{"title":"/, '');
    result = result.replace(/"\}\]$/, '');

    // remove possible artefacts caused by cutting, at least the recognizable ones
    result = result.replace(/"\},.{0,10}\.\.\.$/, '...');
    result = result.replace(/",".{0,8}\.\.\.$/, '...');
    return result;
}
window.getSimplifiedExtendedTags = getSimplifiedExtendedTags;

function getTextDirection(s) { // detect text direction in given string
    const rtlRange = '\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC';
    const ltrRange = 'A-Za-z\u00C0-\u00D6\u00D8-\u00F6' +
        '\u00F8-\u02B8\u0300-\u0590\u0800-\u1FFF\u200E\u2C00-\uFB1C' +
        '\uFE00-\uFE6F\uFEFD-\uFFFF';
    const rtl = new RegExp('^[^' + rtlRange + ']*?[' + rtlRange + ']');
    const ltr = new RegExp('^[^' + ltrRange + ']*?[' + ltrRange + ']');
    let hasRTL = rtl.test(s);
    let hasLTR = ltr.test(s);

    if (hasRTL && !hasLTR)
        return 'rtl';

    if (hasLTR && !hasRTL)
        return 'ltr';

    return 'mix';
}
window.getTextDirection = getTextDirection;

/** @since 5.0.1 */
function simulateFullClick(el) {
    const mdEvent = new MouseEvent('mousedown', {
        view: window,
        bubbles: true,
        cancelable: true
    });
    el.dispatchEvent(mdEvent);
    const muEvent = new MouseEvent('mouseup', {
        view: window,
        bubbles: true,
        cancelable: true
    });
    el.dispatchEvent(muEvent);
    el.click();
}
window.simulateFullClick = simulateFullClick;

/** @since 5.0.1 */
function blockNextEnterKeyUp() {
    let tempListener = app.listen(window, 'keyup', (e) => {
        if (friendlyKeyName(e) === 'Enter') {
            app.unlisten(window, 'keyup', tempListener, true);
            e.stopPropagation();
            e.preventDefault();
        }
    }, true);
}
function addEnterAsClick(ctrl, el) {
    el.tabIndex = 0;
    if(ctrl) {
        ctrl.localListen(el, 'keydown', function (e) {
            if (friendlyKeyName(e) === 'Enter') {
                e.stopPropagation();
                e.preventDefault();
                blockNextEnterKeyUp();
                simulateFullClick(el);
            }
        });        
    }
    else {
        app.listen(el, 'keydown', function (e) {
            if (friendlyKeyName(e) === 'Enter') {
                e.stopPropagation();
                e.preventDefault();
                blockNextEnterKeyUp();
                simulateFullClick(el);
            }
        });
    }
}
window.addEnterAsClick = addEnterAsClick;

//JavaScript HTML Sanitizer v2.0.2, (c) Alexander Yumashev, Jitbit Software.
//homepage https://github.com/jitbit/HtmlSanitizer
//License: MIT https://github.com/jitbit/HtmlSanitizer/blob/master/LICENSE

const _tagWhitelist = { // added tags for SVG, as we need allowed them too
    'A': true, 'ABBR': true, 'B': true, 'BLOCKQUOTE': true, 'BODY': true, 'BR': true, 'CENTER': true, 'CODE': true, 'DD': true, 'DIV': true, 'DL': true, 'DT': true, 'EM': true, 'FONT': true,
    'H1': true, 'H2': true, 'H3': true, 'H4': true, 'H5': true, 'H6': true, 'HR': true, 'I': true, 'IMG': true, 'LABEL': true, 'LI': true, 'OL': true, 'P': true, 'PRE': true,
    'SMALL': true, 'SOURCE': true, 'SPAN': true, 'STRONG': true, 'SUB': true, 'SUP': true, 'TABLE': true, 'TBODY': true, 'TR': true, 'TD': true, 'TH': true, 'THEAD': true, 'UL': true, 'U': true, 'VIDEO': true,
    'SVG': true, 'ANIMATE': true, 'ANIMATEMOTION': true, 'ANIMATETRANSFORM': true, 'CIRCLE': true, 'CLIPPATH': true, 'DEFS': true, 'DESC': true, 'ELLIPSE': true, 'FEBLEND': true, 'FECOLORMATRIX': true, 
    'FECOMPONENTTRANSFER': true, 'FECOMPOSITE': true, 'FECONVOLVEMATRIX': true, 'FEDIFFUSELIGHTING': true, 'FEDISPLACEMENTMAP': true, 'FEDISTANTLIGHT': true, 'FEDROPSHADOW': true, 'FEFLOOD': true, 'FEFUNCA': true,
    'FEFUNCB': true, 'FEFUNCG': true, 'FEFUNCR': true, 'FEGAUSSIANBLUR': true, 'FEIMAGE': true, 'FEMERGE': true, 'FEMERGENODE': true, 'FEMORPHOLOGY': true, 'FEOFFSET': true, 'FEPOINTLIGHT': true, 
    'FESPECULARLIGHTING': true, 'FESPOTLIGHT': true, 'FETILE': true, 'FETURBULENCE': true, 'FILTER': true, 'FOREIGNOBJECT': true, 'G': true, 'HATCH': true, 'HATCHPATH': true, 'IMAGE': true, 'LINE': true,
    'LINEARGRADIENT': true, 'MARKER': true, 'MASK': true, 'METADATA': true, 'MPATH': true, 'PATH': true, 'PATTERN': true, 'POLYGON': true, 'POLYLINE': true, 'RADIALGRADIENT': true, 'RECT': true, 'SET': true,
    'STOP': true, 'STYLE': true, 'SWITCH': true, 'SYMBOL': true, 'TEXT': true, 'TEXTAREA': true, 'TEXTPATH': true, 'TITLE': true, 'TSPAN': true, 'USE': true, 'VIEW': true
};
const _contentTagWhiteList = { 'FORM': true, 'GOOGLE-SHEETS-HTML-ORIGIN': true }; //tags that will be converted to DIVs
const _attributeWhitelist = { 'align': true, 'color': true, 'controls': true, 'height': true, 'href': true, 'id': true, 'src': true, 'style': true, 'target': true, 'title': true, 'type': true, 'width': true };
const _cssWhitelist = { 'background-color': true, 'color': true, 'font-size': true, 'font-weight': true, 'text-align': true, 'text-decoration': true, 'width': true };
const _schemaWhiteList = [ 'http:', 'https:', 'data:', 'm-files:', 'file:', 'ftp:', 'mailto:', 'pw:' ]; //which "protocols" are allowed in "href", "src" etc
const _uriAttributes = { 'href': true, 'action': true };
const _parser = new DOMParser();

function startsWithAny(str, substrings) {
    for (let i = 0; i < substrings.length; i++) {
        if (str.indexOf(substrings[i]) == 0) {
            return true;
        }
    }
    return false;
}

function sanitizeHtml (inputStr: string, extraSelector?:string) {
    if(!inputStr)
        return '';
    // do not trim here, as spaces may corrupt string for translation purposes
    if (inputStr.trim() == '') return ''; // to save performance

    //firefox "bogus node" workaround for wysiwyg's
    if (inputStr == '<br>') return '';

    if (inputStr.indexOf('<body')==-1) inputStr = '<body>' + inputStr + '</body>'; //add "body" otherwise some tags are skipped, like <style>

    let doc = _parser.parseFromString(inputStr, 'text/html');

    //DOM clobbering check (damn you firefox)
    if (doc.body.tagName !== 'BODY')
        doc.body.remove();
    // @ts-ignore
    if (!isFunction(doc.createElement) && doc.createElement && isFunction(doc.createElement.remove)) // @ts-ignore
        doc.createElement.remove();

    function makeSanitizedCopy(node) {
        let newNode;
        if (node.nodeType == Node.TEXT_NODE) {
            newNode = node.cloneNode(true);
        } else if (node.nodeType == Node.ELEMENT_NODE && (_tagWhitelist[node.tagName.toUpperCase()] || _contentTagWhiteList[node.tagName] || (extraSelector && node.matches(extraSelector)))) { //is tag allowed?

            if (_contentTagWhiteList[node.tagName])
                newNode = doc.createElement('DIV'); //convert to DIV
            else
                newNode = doc.createElement(node.tagName);

            for (let i = 0; i < node.attributes.length; i++) {
                let attr = node.attributes[i];
                if (_uriAttributes[attr.name]) { //if this is a "uri" attribute, that can have "javascript:" or something
                    if (attr.value.indexOf(':') > -1 && !startsWithAny(attr.value, _schemaWhiteList))
                        continue;
                }
                if (attr.name.indexOf('on') == 0) { // event handlers forbidden
                    continue;
                }
                newNode.setAttribute(attr.name, attr.value);

                //removed whitelisting of attributes, we can use a lot of them
                /*                if (_attributeWhitelist[attr.name]) {
                    if (attr.name == 'style') {
                        for (let s = 0; s < node.style.length; s++) {
                            let styleName = node.style[s];
                            if (_cssWhitelist[styleName])
                                newNode.style.setProperty(styleName, node.style.getPropertyValue(styleName));
                        }
                    }
                    else {
                        if (_uriAttributes[attr.name]) { //if this is a "uri" attribute, that can have "javascript:" or something
                            if (attr.value.indexOf(':') > -1 && !startsWithAny(attr.value, _schemaWhiteList))
                                continue;
                        }
                        newNode.setAttribute(attr.name, attr.value);
                    }
                }*/
            }
            for (let i = 0; i < node.childNodes.length; i++) {
                let subCopy = makeSanitizedCopy(node.childNodes[i]);
                newNode.appendChild(subCopy, false);
            }

            //remove useless empty spans (lots of those when pasting from MS Outlook)
            if ((newNode.tagName == 'SPAN' || newNode.tagName == 'B' || newNode.tagName == 'I' || newNode.tagName == 'U')
                && newNode.innerHTML.trim() == '') {
                return doc.createDocumentFragment();
            }
            
        } else {
            newNode = doc.createDocumentFragment();
        }
        return newNode;
    }

    let resultElement = makeSanitizedCopy(doc.body);
    
    return resultElement.innerHTML;
}

window.sanitizeHtml = sanitizeHtml;