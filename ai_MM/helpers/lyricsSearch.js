/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

function LyricsSource() {
    this.host = '';
    this.name = '';
    this.onSuccess = null;
    this.onFailure = requestNext;
}

// !!! see /scripts/lyricsSources/helpers/lyricsSearch_add.js !!!
window.lyricsSources = window.lyricsSources || []; //  filled by the lyricsSources script !!!
let cacheTimeout = 14 * 86400; // 14 days

// ----------------------

String.prototype._decodeHTML = function () {
    let map = {
        "gt": ">",
        "lt": "<",
        "quot": "\"",
        "amp": "&",
        "nbsp": " ",
        "Scaron": "Š",
        "scaron": "š",
        "circ": "ˆ",
        "tilde": "˜",
        "ensp": " ",
        "emsp": " ",
        "thinsp": " ",
        "ndash": "–",
        "mdash": "—",
        "lsquo": "‘",
        "rsquo": "’",
        "sbquo": "‚",
        "ldquo": "“",
        "rdquo": "”",
        "bdquo": "„",
        "dagger": "†",
        "Dagger": "‡",
        "permil": "‰",
        "lsaquo": "‹",
        "rsaquo": "›",
        "euro": "€",
        "frasl": "/",
        "deg": "°",
        "plusmn": "±",
        "sup2": "²",
        "sup3": "³",
        "acute": "´",
        "micro": "µ",
        "para": "¶",
        "cedil": "¸",
        "sup1": "¹",
        "ordm": "º",
        "frac14": "¼",
        "frac12": "½",
        "frac34": "¾",
        "iquest": "¿",
        "Agrave": "À",
        "Aacute": "Á",
        "Acirc": "Â",
        "Atilde": "Ã",
        "Auml": "Ä",
        "Aring": "Å",
        "AElig": "Æ",
        "Ccedil": "Ç",
        "Egrave": "È",
        "Eacute": "É",
        "Ecirc": "Ê",
        "Euml": "Ë",
        "Igrave": "Ì",
        "Iacute": "Í",
        "Icirc": "Î",
        "Iuml": "Ï",
        "ETH": "Ð",
        "Ntilde": "Ñ",
        "Ograve": "Ò",
        "Oacute": "Ó",
        "Ocirc": "Ô",
        "Otilde": "Õ",
        "Ouml": "Ö",
        "times": "×",
        "Oslash": "Ø",
        "Ugrave": "Ù",
        "Uacute": "Ú",
        "Ucirc": "Û",
        "Uuml": "Ü",
        "Yacute": "Ý",
        "THORN": "Þ",
        "szlig": "ß",
        "agrave": "à",
        "aacute": "á",
        "acirc": "â",
        "atilde": "ã",
        "auml": "ä",
        "aring": "å",
        "aelig": "æ",
        "ccedil": "ç",
        "egrave": "è",
        "eacute": "é",
        "ecirc": "ê",
        "euml": "ë",
        "igrave": "ì",
        "iacute": "í",
        "icirc": "î",
        "iuml": "ï",
        "eth": "ð",
        "ntilde": "ñ",
        "ograve": "ò",
        "oacute": "ó",
        "ocirc": "ô",
        "otilde": "õ",
        "ouml": "ö",
        "divide": "÷",
        "oslash": "ø",
        "ugrave": "ù",
        "uacute": "ú",
        "ucirc": "û",
        "uuml": "ü",
        "yacute": "ý",
        "thorn": "þ",
        "yuml": "ÿ",
        "Yuml": "Ÿ",
        "copy": "©",
        "trade": "™"
    };
    return this.replace(/&(#(?:x[0-9a-f]+|\d+)|[a-z]+);?/gi, function ($0, $1) {
        if ($1[0] === "#") {
            return String.fromCharCode($1[1].toLowerCase() === "x" ? parseInt($1.substr(2), 16) : parseInt($1.substr(1), 10));
        } else {
            return map.hasOwnProperty($1) ? map[$1] : $0;
        }
    });
};

String.prototype._trim = function () {
    return String(this).replace(/^\s+|\s+$/g, '');
};
String.prototype.test = function (regex) {
    return regex.test(this);
};

function _add(arr, item) {
    if (arr.indexOf(item) < 0) arr.push(item);
    return arr;
}

function _merge(arr, C) {
    for (let B = 0, A = C.length; B < A; B++) {
        _add(arr, C[B]);
    }
    return arr;
}

function _map(arr, fn, bind) {
    let length = arr.length >>> 0,
        results = Array(length);
    for (let i = 0; i < length; i++) {
        if (i in arr) results[i] = fn.call(bind, arr[i], i, arr);
    }
    return results;
}

function _clean(arr) {
    return arr.filter(function (item) {
        return item != null;
    });
}

function _remove(arr, B) {
    for (let A = arr.length; A--; A) {
        if (arr[A] === B) {
            arr.splice(A, 1);
        }
    }
    return arr;
}


let currentArtist = 0;
let currentTitle = 0;
let currentRequest = 0;
let cachedArtist;
let cachedTitle;
let cachedTrack;
let enabledLyricsSources; // filtered only enabled sources
let lyricsCache = {}; // cache during one run of lyrics
let lyricsCacheSources = ''; // sources used for last caching, clear cache in case they changed
let disabledSourcesTmp = {}; // temporarily disabled sources
let timeMonitoring = false;
let timeLimitForDisable = 9000; // in ms, monitored requests longer then this will be temporarily disabled, used for autotag sesssion

let CACHED_TIME = 1000 * 60 * 60; // keep lyrics one hour, should be enough to avoid too much requests when not saving lyrics

let aA = new Array();
let aT = new Array();

let bruteForce = true;
let tryCleanupWhitespace = true;
let tryAllArtists = true;
let tryCommaArtists = true;
let tryRejectSingleLine = false;
let trySingleLineSearch = 'Instr';
let trySingleLineReplace = '[Instrumental]';
let tryParensA = true;
let tryParensT = true;
let tryBracketsA = true;
let tryBracketsT = true;
let tryBracesA = true;
let tryBracesT = true;
let tryQuotesA = true;
let tryQuotesT = true;
let tryTheA = true;
let tryTheT = true;
let tryFeatA = true;
let tryFeatT = true;
let trySplitArrayA = 'and;&;+';
let trySplitArrayT = '';
let tryBlackListA = '';
let tryBlackListT = 'Medley';
let wasClosed = true;

let defaultDiacriticsRemovalMap = [
    {
        'base': 'A',
        'letters': /[\u0041\u24B6\uFF21\u00C0\u00C1\u00C2\u1EA6\u1EA4\u1EAA\u1EA8\u00C3\u0100\u0102\u1EB0\u1EAE\u1EB4\u1EB2\u0226\u01E0\u00C4\u01DE\u1EA2\u00C5\u01FA\u01CD\u0200\u0202\u1EA0\u1EAC\u1EB6\u1E00\u0104\u023A\u2C6F]/g
    },
    {
        'base': 'AA',
        'letters': /[\uA732]/g
    },
    {
        'base': 'AE',
        'letters': /[\u00C6\u01FC\u01E2]/g
    },
    {
        'base': 'AO',
        'letters': /[\uA734]/g
    },
    {
        'base': 'AU',
        'letters': /[\uA736]/g
    },
    {
        'base': 'AV',
        'letters': /[\uA738\uA73A]/g
    },
    {
        'base': 'AY',
        'letters': /[\uA73C]/g
    },
    {
        'base': 'B',
        'letters': /[\u0042\u24B7\uFF22\u1E02\u1E04\u1E06\u0243\u0182\u0181]/g
    },
    {
        'base': 'C',
        'letters': /[\u0043\u24B8\uFF23\u0106\u0108\u010A\u010C\u00C7\u1E08\u0187\u023B\uA73E]/g
    },
    {
        'base': 'D',
        'letters': /[\u0044\u24B9\uFF24\u1E0A\u010E\u1E0C\u1E10\u1E12\u1E0E\u0110\u018B\u018A\u0189\uA779]/g
    },
    {
        'base': 'DZ',
        'letters': /[\u01F1\u01C4]/g
    },
    {
        'base': 'Dz',
        'letters': /[\u01F2\u01C5]/g
    },
    {
        'base': 'E',
        'letters': /[\u0045\u24BA\uFF25\u00C8\u00C9\u00CA\u1EC0\u1EBE\u1EC4\u1EC2\u1EBC\u0112\u1E14\u1E16\u0114\u0116\u00CB\u1EBA\u011A\u0204\u0206\u1EB8\u1EC6\u0228\u1E1C\u0118\u1E18\u1E1A\u0190\u018E]/g
    },
    {
        'base': 'F',
        'letters': /[\u0046\u24BB\uFF26\u1E1E\u0191\uA77B]/g
    },
    {
        'base': 'G',
        'letters': /[\u0047\u24BC\uFF27\u01F4\u011C\u1E20\u011E\u0120\u01E6\u0122\u01E4\u0193\uA7A0\uA77D\uA77E]/g
    },
    {
        'base': 'H',
        'letters': /[\u0048\u24BD\uFF28\u0124\u1E22\u1E26\u021E\u1E24\u1E28\u1E2A\u0126\u2C67\u2C75\uA78D]/g
    },
    {
        'base': 'I',
        'letters': /[\u0049\u24BE\uFF29\u00CC\u00CD\u00CE\u0128\u012A\u012C\u0130\u00CF\u1E2E\u1EC8\u01CF\u0208\u020A\u1ECA\u012E\u1E2C\u0197]/g
    },
    {
        'base': 'J',
        'letters': /[\u004A\u24BF\uFF2A\u0134\u0248]/g
    },
    {
        'base': 'K',
        'letters': /[\u004B\u24C0\uFF2B\u1E30\u01E8\u1E32\u0136\u1E34\u0198\u2C69\uA740\uA742\uA744\uA7A2]/g
    },
    {
        'base': 'L',
        'letters': /[\u004C\u24C1\uFF2C\u013F\u0139\u013D\u1E36\u1E38\u013B\u1E3C\u1E3A\u0141\u023D\u2C62\u2C60\uA748\uA746\uA780]/g
    },
    {
        'base': 'LJ',
        'letters': /[\u01C7]/g
    },
    {
        'base': 'Lj',
        'letters': /[\u01C8]/g
    },
    {
        'base': 'M',
        'letters': /[\u004D\u24C2\uFF2D\u1E3E\u1E40\u1E42\u2C6E\u019C]/g
    },
    {
        'base': 'N',
        'letters': /[\u004E\u24C3\uFF2E\u01F8\u0143\u00D1\u1E44\u0147\u1E46\u0145\u1E4A\u1E48\u0220\u019D\uA790\uA7A4]/g
    },
    {
        'base': 'NJ',
        'letters': /[\u01CA]/g
    },
    {
        'base': 'Nj',
        'letters': /[\u01CB]/g
    },
    {
        'base': 'O',
        'letters': /[\u004F\u24C4\uFF2F\u00D2\u00D3\u00D4\u1ED2\u1ED0\u1ED6\u1ED4\u00D5\u1E4C\u022C\u1E4E\u014C\u1E50\u1E52\u014E\u022E\u0230\u00D6\u022A\u1ECE\u0150\u01D1\u020C\u020E\u01A0\u1EDC\u1EDA\u1EE0\u1EDE\u1EE2\u1ECC\u1ED8\u01EA\u01EC\u00D8\u01FE\u0186\u019F\uA74A\uA74C]/g
    },
    {
        'base': 'OI',
        'letters': /[\u01A2]/g
    },
    {
        'base': 'OO',
        'letters': /[\uA74E]/g
    },
    {
        'base': 'OU',
        'letters': /[\u0222]/g
    },
    {
        'base': 'P',
        'letters': /[\u0050\u24C5\uFF30\u1E54\u1E56\u01A4\u2C63\uA750\uA752\uA754]/g
    },
    {
        'base': 'Q',
        'letters': /[\u0051\u24C6\uFF31\uA756\uA758\u024A]/g
    },
    {
        'base': 'R',
        'letters': /[\u0052\u24C7\uFF32\u0154\u1E58\u0158\u0210\u0212\u1E5A\u1E5C\u0156\u1E5E\u024C\u2C64\uA75A\uA7A6\uA782]/g
    },
    {
        'base': 'S',
        'letters': /[\u0053\u24C8\uFF33\u1E9E\u015A\u1E64\u015C\u1E60\u0160\u1E66\u1E62\u1E68\u0218\u015E\u2C7E\uA7A8\uA784]/g
    },
    {
        'base': 'T',
        'letters': /[\u0054\u24C9\uFF34\u1E6A\u0164\u1E6C\u021A\u0162\u1E70\u1E6E\u0166\u01AC\u01AE\u023E\uA786]/g
    },
    {
        'base': 'TZ',
        'letters': /[\uA728]/g
    },
    {
        'base': 'U',
        'letters': /[\u0055\u24CA\uFF35\u00D9\u00DA\u00DB\u0168\u1E78\u016A\u1E7A\u016C\u00DC\u01DB\u01D7\u01D5\u01D9\u1EE6\u016E\u0170\u01D3\u0214\u0216\u01AF\u1EEA\u1EE8\u1EEE\u1EEC\u1EF0\u1EE4\u1E72\u0172\u1E76\u1E74\u0244]/g
    },
    {
        'base': 'V',
        'letters': /[\u0056\u24CB\uFF36\u1E7C\u1E7E\u01B2\uA75E\u0245]/g
    },
    {
        'base': 'VY',
        'letters': /[\uA760]/g
    },
    {
        'base': 'W',
        'letters': /[\u0057\u24CC\uFF37\u1E80\u1E82\u0174\u1E86\u1E84\u1E88\u2C72]/g
    },
    {
        'base': 'X',
        'letters': /[\u0058\u24CD\uFF38\u1E8A\u1E8C]/g
    },
    {
        'base': 'Y',
        'letters': /[\u0059\u24CE\uFF39\u1EF2\u00DD\u0176\u1EF8\u0232\u1E8E\u0178\u1EF6\u1EF4\u01B3\u024E\u1EFE]/g
    },
    {
        'base': 'Z',
        'letters': /[\u005A\u24CF\uFF3A\u0179\u1E90\u017B\u017D\u1E92\u1E94\u01B5\u0224\u2C7F\u2C6B\uA762]/g
    },
    {
        'base': 'a',
        'letters': /[\u0061\u24D0\uFF41\u1E9A\u00E0\u00E1\u00E2\u1EA7\u1EA5\u1EAB\u1EA9\u00E3\u0101\u0103\u1EB1\u1EAF\u1EB5\u1EB3\u0227\u01E1\u00E4\u01DF\u1EA3\u00E5\u01FB\u01CE\u0201\u0203\u1EA1\u1EAD\u1EB7\u1E01\u0105\u2C65\u0250]/g
    },
    {
        'base': 'aa',
        'letters': /[\uA733]/g
    },
    {
        'base': 'ae',
        'letters': /[\u00E6\u01FD\u01E3]/g
    },
    {
        'base': 'ao',
        'letters': /[\uA735]/g
    },
    {
        'base': 'au',
        'letters': /[\uA737]/g
    },
    {
        'base': 'av',
        'letters': /[\uA739\uA73B]/g
    },
    {
        'base': 'ay',
        'letters': /[\uA73D]/g
    },
    {
        'base': 'b',
        'letters': /[\u0062\u24D1\uFF42\u1E03\u1E05\u1E07\u0180\u0183\u0253]/g
    },
    {
        'base': 'c',
        'letters': /[\u0063\u24D2\uFF43\u0107\u0109\u010B\u010D\u00E7\u1E09\u0188\u023C\uA73F\u2184]/g
    },
    {
        'base': 'd',
        'letters': /[\u0064\u24D3\uFF44\u1E0B\u010F\u1E0D\u1E11\u1E13\u1E0F\u0111\u018C\u0256\u0257\uA77A]/g
    },
    {
        'base': 'dz',
        'letters': /[\u01F3\u01C6]/g
    },
    {
        'base': 'e',
        'letters': /[\u0065\u24D4\uFF45\u00E8\u00E9\u00EA\u1EC1\u1EBF\u1EC5\u1EC3\u1EBD\u0113\u1E15\u1E17\u0115\u0117\u00EB\u1EBB\u011B\u0205\u0207\u1EB9\u1EC7\u0229\u1E1D\u0119\u1E19\u1E1B\u0247\u025B\u01DD]/g
    },
    {
        'base': 'f',
        'letters': /[\u0066\u24D5\uFF46\u1E1F\u0192\uA77C]/g
    },
    {
        'base': 'g',
        'letters': /[\u0067\u24D6\uFF47\u01F5\u011D\u1E21\u011F\u0121\u01E7\u0123\u01E5\u0260\uA7A1\u1D79\uA77F]/g
    },
    {
        'base': 'h',
        'letters': /[\u0068\u24D7\uFF48\u0125\u1E23\u1E27\u021F\u1E25\u1E29\u1E2B\u1E96\u0127\u2C68\u2C76\u0265]/g
    },
    {
        'base': 'hv',
        'letters': /[\u0195]/g
    },
    {
        'base': 'i',
        'letters': /[\u0069\u24D8\uFF49\u00EC\u00ED\u00EE\u0129\u012B\u012D\u00EF\u1E2F\u1EC9\u01D0\u0209\u020B\u1ECB\u012F\u1E2D\u0268\u0131]/g
    },
    {
        'base': 'j',
        'letters': /[\u006A\u24D9\uFF4A\u0135\u01F0\u0249]/g
    },
    {
        'base': 'k',
        'letters': /[\u006B\u24DA\uFF4B\u1E31\u01E9\u1E33\u0137\u1E35\u0199\u2C6A\uA741\uA743\uA745\uA7A3]/g
    },
    {
        'base': 'l',
        'letters': /[\u006C\u24DB\uFF4C\u0140\u013A\u013E\u1E37\u1E39\u013C\u1E3D\u1E3B\u017F\u0142\u019A\u026B\u2C61\uA749\uA781\uA747]/g
    },
    {
        'base': 'lj',
        'letters': /[\u01C9]/g
    },
    {
        'base': 'm',
        'letters': /[\u006D\u24DC\uFF4D\u1E3F\u1E41\u1E43\u0271\u026F]/g
    },
    {
        'base': 'n',
        'letters': /[\u006E\u24DD\uFF4E\u01F9\u0144\u00F1\u1E45\u0148\u1E47\u0146\u1E4B\u1E49\u019E\u0272\u0149\uA791\uA7A5]/g
    },
    {
        'base': 'nj',
        'letters': /[\u01CC]/g
    },
    {
        'base': 'o',
        'letters': /[\u006F\u24DE\uFF4F\u00F2\u00F3\u00F4\u1ED3\u1ED1\u1ED7\u1ED5\u00F5\u1E4D\u022D\u1E4F\u014D\u1E51\u1E53\u014F\u022F\u0231\u00F6\u022B\u1ECF\u0151\u01D2\u020D\u020F\u01A1\u1EDD\u1EDB\u1EE1\u1EDF\u1EE3\u1ECD\u1ED9\u01EB\u01ED\u00F8\u01FF\u0254\uA74B\uA74D\u0275]/g
    },
    {
        'base': 'oi',
        'letters': /[\u01A3]/g
    },
    {
        'base': 'ou',
        'letters': /[\u0223]/g
    },
    {
        'base': 'oo',
        'letters': /[\uA74F]/g
    },
    {
        'base': 'p',
        'letters': /[\u0070\u24DF\uFF50\u1E55\u1E57\u01A5\u1D7D\uA751\uA753\uA755]/g
    },
    {
        'base': 'q',
        'letters': /[\u0071\u24E0\uFF51\u024B\uA757\uA759]/g
    },
    {
        'base': 'r',
        'letters': /[\u0072\u24E1\uFF52\u0155\u1E59\u0159\u0211\u0213\u1E5B\u1E5D\u0157\u1E5F\u024D\u027D\uA75B\uA7A7\uA783]/g
    },
    {
        'base': 's',
        'letters': /[\u0073\u24E2\uFF53\u00DF\u015B\u1E65\u015D\u1E61\u0161\u1E67\u1E63\u1E69\u0219\u015F\u023F\uA7A9\uA785\u1E9B]/g
    },
    {
        'base': 't',
        'letters': /[\u0074\u24E3\uFF54\u1E6B\u1E97\u0165\u1E6D\u021B\u0163\u1E71\u1E6F\u0167\u01AD\u0288\u2C66\uA787]/g
    },
    {
        'base': 'tz',
        'letters': /[\uA729]/g
    },
    {
        'base': 'u',
        'letters': /[\u0075\u24E4\uFF55\u00F9\u00FA\u00FB\u0169\u1E79\u016B\u1E7B\u016D\u00FC\u01DC\u01D8\u01D6\u01DA\u1EE7\u016F\u0171\u01D4\u0215\u0217\u01B0\u1EEB\u1EE9\u1EEF\u1EED\u1EF1\u1EE5\u1E73\u0173\u1E77\u1E75\u0289]/g
    },
    {
        'base': 'v',
        'letters': /[\u0076\u24E5\uFF56\u1E7D\u1E7F\u028B\uA75F\u028C]/g
    },
    {
        'base': 'vy',
        'letters': /[\uA761]/g
    },
    {
        'base': 'w',
        'letters': /[\u0077\u24E6\uFF57\u1E81\u1E83\u0175\u1E87\u1E85\u1E98\u1E89\u2C73]/g
    },
    {
        'base': 'x',
        'letters': /[\u0078\u24E7\uFF58\u1E8B\u1E8D]/g
    },
    {
        'base': 'y',
        'letters': /[\u0079\u24E8\uFF59\u1EF3\u00FD\u0177\u1EF9\u0233\u1E8F\u00FF\u1EF7\u1E99\u1EF5\u01B4\u024F\u1EFF]/g
    },
    {
        'base': 'z',
        'letters': /[\u007A\u24E9\uFF5A\u017A\u1E91\u017C\u017E\u1E93\u1E95\u01B6\u0225\u0240\u2C6C\uA763]/g
    }
];

let changes;

function removeDiacritics(str) {
    if(!str)
        return str;
    if (!changes) {
        changes = defaultDiacriticsRemovalMap;
    }
    for (let i = 0; i < changes.length; i++) {
        str = str.replace(changes[i].letters, changes[i].base);
    }
    return str;
}

let downloadPromise = null;

let registerClosed = function () {
    wasClosed = false;
    if (!window.qUnit) {
        window.localListen(thisWindow, 'closed', function () {
            wasClosed = true;
            if (downloadPromise) {
                downloadPromise.cancel();
            }
            downloadPromise = null;
            currentArtist = 0;
            currentTitle = 0;
            currentRequest = 0;
            cachedArtist = '';
            cachedTitle = '';
            NotifyResult('', '', true); // closing
        });
    }
};

function NotifyWebReq(str, provider) {
    let headers = newStringList();
    headers.add('User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36'); // so that www.azlyrics.com accept us    
    
    if (downloadPromise)
        downloadPromise.cancel();
    let tm;
    if (timeMonitoring)
        tm = Date.now();
    downloadPromise = app.utils.web.getURLContentAsync(str, {
        headers: headers,
        cacheTimeout: cacheTimeout,
    });

    let checkTime = function () {
        if (timeMonitoring) {
            tm = Date.now() - tm;
            if(tm>timeLimitForDisable) {
                ODS('--- search duration ' + tm + 'ms, temp. disabling server ' + provider);
                disabledSourcesTmp[provider] = true;
                NotifyProgress(_('Source') + ' ' + provider + ':' + _('Disabled'));
            }
        }
    };

    downloadPromise.then(function (Content) {
        downloadPromise = null;
        checkTime();
        if ((Content) && (Content != '')) {
            LoadedWebPage(Content);
        }
        else {
            LoadWebPageFailed();
        }
    }, function (err) {
        checkTime();
        LoadWebPageFailed(err);
    });
}

function NotifyResult(str, provider, isclosing) {
    if (searchTools.interfaces.lyrics)
        searchTools.interfaces.lyrics.showResult(str, provider, isclosing);
}

function NotifyProgress(str) {
    if (searchTools.interfaces.lyrics && searchTools.interfaces.lyrics.progressFunc) {
        searchTools.interfaces.lyrics.progressFunc(str);
    }
}

function NotifyDebug(str) {
    ODS('lyricsSearch.js: ' + str);
}

let requestNext = function () {
    whatNext('');
}

let suspiciousLyrics = function (l) {
    // lyrics after cleanup could contain only <br>. So all other tags looks like a bug
    if (l.test(/<\//))
        return true;
    //very short lyrics are probably wrong. Take lyrics with 
    if (l.length < 5)
        return true;
    return false;
}

let cleanupLyrics = function (l) {
    if (l.test(/&#93;&#10;/)) l = ''; //LyricWikia - Missing due to copyright law.
    l = l._decodeHTML();
    if (l.test(/Sorry, but these lyrics are protected by copyright./)) l = ''; //LyrDB - Missing due to copyright law.
    if (l.test(/We haven\'t lyrics of this song/)) l = ''; //LyrDB - Missing
    if (l.test(/Unfortunately, we are not licensed to display the full lyrics/)) l = '';
    l = l.replace(/\<br[\s]*[\/]*\>/gi, '<br>'); // Converts all "New Line" to the same
    l = l.replace(/[\s]+/g, ' '); // Converts all "spaces" to the same
    l = l.replace(/^(<br>|\s)/gi, ''); // Lyrics starts with a "New Line" or Space
    l = l.replace(/\r/g, ''); // End of Line
    l = l.replace(/&nbsp;+/gi, ' '); // HTML Code
    l = l.replace(/&amp;+/gi, 'and'); // HTML Code
    l = l.replace(/(<i>|<\/i>|<b>|<\/b>|<div(.*?)>|<span(.*?)>)+/gi, ''); // HTML Tags
    l = l.replace(/(<img(.*?)>(.*?)>|<a(.*?)>(.*?)<\/a>)+/gi, ''); // Images & Links
    l = l.replace(/<(h1|h2)>(.*?)<\/(h1|h2)> <br>/gi, ''); // For source: AZLyrics
    l = l.replace(/<\/?[^br>]+(>|$)+/gi, ''); // All other HTML tags that isn't <br>
    l = l.replace(/<script>.*<\/script>/gi, ''); // remove script part added by LyricWikia, #12146

    if (tryCleanupWhitespace) {
        l = l.replace(/\<br\>\<br\>(\<br\>)+/g, '<br><br>');
        l = l.replace(/(\s)*\<br\>/g, '<br>');
        l = l.replace(/\s\s/gi, ' ');
    }
    if (tryRejectSingleLine || trySingleLineSearch) {
        let a = l.split('<br>');
        if (a.length <= 1 || (a.length == 2 && a[1]._trim() == '')) {
            if (tryRejectSingleLine) return false;
            if (l.toUpperCase().indexOf(trySingleLineSearch.toUpperCase()) >= 0)
                l = trySingleLineReplace;
        }
    }
    if (l.search("<br>") == 0)
        l = l.replace(/<br>/, '');
    if (l.replace(/<br>/g, '').test(/^[\s]+$/)) l = '';
    if (suspiciousLyrics(l)) // suspicious, probably wrong lyrics, try another
        l = '';
    return l;
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
let reS = new RegExp("[']*", "g");
let reD = new RegExp("[\"]*", "g");
let mapTrim = function (e, i) {
    return e._trim();
}
let mapQuoteS = function (e, i) {
    return e.replace(reS, '')._trim();
}
let mapQuoteD = function (e, i) {
    return e.replace(reD, '')._trim();
}
let mapParens = function (e, i) {
    return e.replace(/\(.*?\)/g, '')._trim();
} //  *** TODO ***  What about half?
let mapBrackets = function (e, i) {
    return e.replace(/\[.*?\]/g, '')._trim();
} //  *** TODO ***  What about half?
let mapBraces = function (e, i) {
    return e.replace(/\{.*?\}/g, '')._trim();
} //  *** TODO ***  What about half?
let mapThe = function (e, i) {
    return e.replace(/The /gi, '')._trim();
} // *** TODO *** What about "and" , / & + - =
let mapFeat = function (e, i) {
    return e.replace(/ (Ft|Ft.|feat|feat.|featuring) .*/gi, '')._trim();
}
let mapDash = function (e, i) {
    return e.replace(/-(.*?)+/g, '')._trim();
}
let mapIncomplete = function (e, i) {
    return e.replace(/\((.*?)+/g, '')._trim();
}

let buildBruteForce = function () {

    NotifyDebug('buildBruteForce');
    aA.length = 0;
    aT.length = 0;

    aA.push(cachedArtist);
    aT.push(cachedTitle);

    let s;
    let sa;
    if (tryAllArtists) {
        s = cachedArtist.split(';');
        s.forEach(function (e) {
            _add(aA, e._trim());
        });
    }

    // ...ing -> ...in' and vice versa, issue #14640
    if (cachedTitle.test(/ing\b/)) {
        aT.push(cachedTitle.replace(/ing\b/g, "in\'"));
    } else if (cachedTitle.test(/in\b\'/)) {
        aT.push(cachedTitle.replace(/in\b\'/g, 'ing'));
    }

    if (tryCommaArtists) {
        _add(aA, cachedArtist.replace(/([\w ]+), ([\w ]+)/g, "$2 $1"));
    } // Code from "datta"

    if (tryTheA) {
        _merge(aA, _map(aA, mapThe));
    }
    if (tryTheT) {
        _merge(aT, _map(aT, mapThe));
    }

    if (tryFeatA) {
        _merge(aA, _map(aA, mapFeat));
    }
    if (tryFeatT) {
        _merge(aT, _map(aT, mapFeat));
    }

    if (tryFeatT) {
        _merge(aT, _map(aT, mapDash));
    }
    if (tryFeatT) {
        _merge(aT, _map(aT, mapIncomplete));
    }

    if (tryParensA) _merge(aA, _map(aA, mapParens));
    if (tryParensT) _merge(aT, _map(aT, mapParens));
    if (tryBracketsA) _merge(aA, _map(aA, mapBrackets));
    if (tryBracketsT) _merge(aT, _map(aT, mapBrackets));
    if (tryBracesA) _merge(aA, _map(aA, mapBraces));
    if (tryBracesT) _merge(aT, _map(aT, mapBraces));

    if (trySplitArrayA) {
        sa = trySplitArrayA.split(';');
        sa.forEach(function (e) {
            aA.forEach(function (e2) {
                _merge(aA, _map(e2.split(e), mapTrim));
            });
        });
    }
    if (trySplitArrayT) {
        sa = trySplitArrayT.split(';');
        sa.forEach(function (e) {
            aT.forEach(function (e2) {
                _merge(aT, _map(e2.split(e), mapTrim));
            });
        });
    }

    if (tryBlackListA) {
        sa = tryBlackListA.split(';');
        sa.forEach(function (e) {
            _remove(aA, e);
        });
    }
    if (tryBlackListT) {
        sa = tryBlackListT.split(';');
        sa.forEach(function (e) {
            _remove(aT, e);
        });
    }

    if (tryAllArtists) {
        _add(aA, 'Various');
    }

    aA = _clean(aA);
    aT = _clean(aT);
}


let searchSend = function (r, a, t) {
    if (window._cleanUpCalled || wasClosed)
        return;
    NotifyDebug('SearchSend - site: ' + r.name);
    NotifyProgress(r.name);
    if (r.formatArtist)
        a = r.formatArtist(a);

    if (r.formatTitle)
        t = r.formatTitle(t);

    if(!a || !t) {
        LoadWebPageFailed();
        return;
    }
    let artistFirstChar = a.substr(0, 1);
    if ((artistFirstChar >= '0') && (artistFirstChar <= '9'))
        artistFirstChar = '0-9';
    let s = r.sendString.replace('%artistfirstchar%', artistFirstChar).replace('%artist%', escape(a)).replace('%title%', escape(t));
    a = a.replace('&', '%26');
    t = t.replace('&', '%26'); // Dirty Dirty hack.....                                    
    let host = r.host.replace('%artistfirstchar%', artistFirstChar).replace('%artist%', a).replace('%title%', t);

    if (r.formatURL)
        host = r.formatURL(host);

    host = encodeURI(host).replace('%2526', '%26');
    try {
        NotifyWebReq(host, r.name);
    } catch (err) {}
}

let lastCacheCheck = 0;
let addToCache = function (l, foundProvider) {
    let tm = Date.now();
    // empty expired elements
    if ((tm - lastCacheCheck) > (CACHED_TIME / 2)) {
        lastCacheCheck = tm;
        let lyricsCacheNew = {};
        tm = tm - CACHED_TIME;
        for (let key in lyricsCache) {
            let o = lyricsCache[key];
            if (o && (o.time > tm))
                lyricsCacheNew[key] = lyricsCache[key];
        }
        lyricsCache = lyricsCacheNew;
    }
    lyricsCache[cachedArtist + '__' + cachedTitle] = {
        time: Date.now(),
        l: l,
        provider: foundProvider
    };
}

let whatNext = function (l, foundProvider, init) {
    if (window._cleanUpCalled || wasClosed)
        return;
    let a;
    let t;
    let search = true;

    let findNextRequest = function () {
        do {
            if (currentRequest < enabledLyricsSources.length - 1) {
                currentRequest++;
            } else {
                currentRequest = 0;
                if (currentTitle < aT.length - 1) {
                    currentTitle++;
                } else {
                    currentTitle = 0;
                    currentArtist++;
                }
            }

            if (currentArtist >= aA.length) {
                NotifyDebug('whatNext: no further artist string modifications');
                search = false;
            } else {
                a = aA[currentArtist];
                t = aT[currentTitle];
                if (!a || !t)
                    search = false;
            }
        } while(search && disabledSourcesTmp[enabledLyricsSources[currentRequest].name]);
    };

    if (init) {
        NotifyDebug('whatNext init');
        a = cachedArtist;
        t = cachedTitle;
    } else if (l) {
        NotifyDebug('whatNext result');
        l = l.replace(/[\s]*<br>[\s]*/gi, '\r\n'); // remove <br>
        if (l && l.trim())
            addToCache(l, foundProvider);
        NotifyResult(l, foundProvider);
        search = false;
    } else {
        NotifyDebug('whatNext continue: currentArtist = ' + currentArtist + ', currentTitle = ' + currentTitle + ', currentRequest: ' + currentRequest);
        if (bruteForce) {
            if ((!currentArtist && !currentTitle && !currentRequest) || (!aA.length || !aT.length /* when dialog is re-opened*/ )) {
                buildBruteForce();
            }
            findNextRequest();
        } else {
            NotifyDebug('whatNext continue failed: bruteForce = false');
            search = false;
        }
        if (!search) {
            NotifyDebug('whatNext continue null result');
            NotifyResult('', '');
        }
    }
    if (search) {
        let src = enabledLyricsSources[currentRequest];
        if(disabledSourcesTmp[src.name]) {
            findNextRequest();
            if (!search) {
                NotifyDebug('whatNext continue null result');
                NotifyResult('', '');
                return;
            }    
        }
        NotifyDebug('Calling search send');
        searchSend(enabledLyricsSources[currentRequest], a, t);
    }
}


let checkSourcesChanged = function () {
    enabledLyricsSources = [];

    forEach(window.lyricsSources, function (src) {
        if (!src.disabled)
            enabledLyricsSources.push(src);
    })
    let currentlyricsCacheSources = enabledLyricsSources.map((a) => (a.name));
    if (currentlyricsCacheSources)
        currentlyricsCacheSources = currentlyricsCacheSources.join();
    if (lyricsCacheSources !== currentlyricsCacheSources) {
        lyricsCacheSources = currentlyricsCacheSources;
        lyricsCache = {};
    }
};

//---------------------------------------------------------------------------------------------------
searchTools.interfaces.lyrics.getCachedLyrics = function (artist, title) {
    checkSourcesChanged();
    let cachedRes = lyricsCache[artist + '__' + title];
    if (cachedRes) {
        cachedRes.time = Date.now();
        return {
            lyrics: cachedRes.l,
            provider: cachedRes.provider
        };
    } else
        return;
};

searchTools.interfaces.lyrics.startSearch = function (artist, title, forceSearch, track) {
    if (wasClosed) {
        registerClosed();
    }
    NotifyDebug('SearchLyrics: Artist: ' + artist + ' ,Title: ' + title + ' ,currentRequest = ' + currentRequest);
    checkSourcesChanged();
    if (!forceSearch) {
        let cachedRes = lyricsCache[artist + '__' + title];
        if (cachedRes && ((Date.now() - cachedRes.time) < CACHED_TIME)) {
            cachedRes.time = Date.now();
            NotifyDebug('Cached result, Artist: ' + artist + ' ,Title: ' + title);
            NotifyResult(cachedRes.l, cachedRes.provider);
            return;
        }
    }

    if ((cachedArtist != artist) || (cachedTitle != title)) {
        cachedArtist = artist;
        currentArtist = 0;
        cachedTitle = title;
        cachedTrack = track;
        currentTitle = 0;
        currentRequest = 0;
    } else {
        if (currentRequest < enabledLyricsSources.length - 1)
            currentRequest++; // to search from another server for the same track next time
        else
            currentRequest = 0;
    }
    if (!enabledLyricsSources.length) {
        NotifyResult('', ''); // no lyrics servers
        return;
    }
    NotifyDebug('init');
    bruteForce = tryAllArtists || tryCommaArtists || tryParensA || tryBracketsA || tryBracesA || trySplitArrayA || tryParensT || tryBracketsT || tryBracesT || trySplitArrayT;
    whatNext(null, null, true);
}

let LoadedWebPage = function (webcontent) {
    NotifyDebug('LoadedWebPage');
    if ((currentRequest < enabledLyricsSources.length) && (enabledLyricsSources[currentRequest].onSuccess != null)) {
        enabledLyricsSources[currentRequest].onSuccess(webcontent);
    }
}

let LoadWebPageFailed = function (err) {
    if (window._cleanUpCalled || wasClosed)
        return;
    NotifyDebug('LoadWebPageFailed');
    if ((currentRequest < enabledLyricsSources.length) && (enabledLyricsSources[currentRequest].onFailure != null)) {
        enabledLyricsSources[currentRequest].onFailure(err);
    }
}

searchTools.interfaces.lyrics.startMonitoringLyricsSearchTimes = function () {
    timeMonitoring = true;
}

searchTools.interfaces.lyrics.stopMonitoringLyricsSearchTimes = function () {
    disabledSourcesTmp = {}; // temporarily disabled sources
    timeMonitoring = false;
}