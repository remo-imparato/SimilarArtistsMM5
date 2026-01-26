/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

registerFileImport('sprintf');

/**
C-style sprintf() function.

@method sprintf
@param {string} format
@param {any} param1
@return {string}
*/

/**
C-style vsprintf() function.

@method vsprintf
@param {string} format
@param {Array} param
@return {string}
*/
/*! sprintf.js | Copyright (c) 2007-2013 Alexandru Marasteanu <hello at alexei dot ro> | 3 clause BSD license */
(function (ctx) {
    var sprintf = function () {
        if (!sprintf.cache.hasOwnProperty(arguments[0])) {
            sprintf.cache[arguments[0]] = sprintf.parse(arguments[0]);
        }
        return sprintf.format.call(null, sprintf.cache[arguments[0]], arguments);
    };

    sprintf.format = function (parse_tree, argv) {
        var cursor = 1,
            tree_length = parse_tree.length,
            node_type = '',
            arg, output = [],
            i, k, match, pad, pad_character, pad_length;
        for (i = 0; i < tree_length; i++) {
            node_type = get_type(parse_tree[i]);
            if (node_type === 'string') {
                output.push(parse_tree[i]);
            } else if (node_type === 'array') {
                match = parse_tree[i]; // convenience purposes only
                if (match[2]) { // keyword argument
                    arg = argv[cursor];
                    for (k = 0; k < match[2].length; k++) {
                        if (!arg.hasOwnProperty(match[2][k])) {
                            throw (sprintf('[sprintf] property "%s" does not exist', match[2][k]));
                        }
                        arg = arg[match[2][k]];
                    }
                } else if (match[1]) { // positional argument (explicit)
                    arg = argv[match[1]];
                } else { // positional argument (implicit)
                    arg = argv[cursor++];
                }

                if (/[^s]/.test(match[8]) && (get_type(arg) != 'number')) {
                    throw (sprintf('[sprintf] expecting number but found %s', get_type(arg)));
                }
                switch (match[8]) {
                    case 'b':
                        arg = arg.toString(2);
                        break;
                    case 'c':
                        arg = String.fromCharCode(arg);
                        break;
                    case 'd':
                        arg = parseInt(arg, 10);
                        break;
                    case 'e':
                        arg = match[7] ? arg.toExponential(match[7]) : arg.toExponential();
                        break;
                    case 'f':
                        arg = match[7] ? parseFloat(arg).toFixed(match[7]) : parseFloat(arg);
                        break;
                    case 'o':
                        arg = arg.toString(8);
                        break;
                    case 's':
                        arg = ((arg = String(arg)) && match[7] ? arg.substring(0, match[7]) : arg);
                        break;
                    case 'u':
                        arg = arg >>> 0;
                        break;
                    case 'x':
                        arg = arg.toString(16);
                        break;
                    case 'X':
                        arg = arg.toString(16).toUpperCase();
                        break;
                }
                arg = (/[def]/.test(match[8]) && match[3] && arg >= 0 ? '+' + arg : arg);
                pad_character = match[4] ? match[4] == '0' ? '0' : match[4].charAt(1) : ' ';
                pad_length = match[6] - String(arg).length;
                pad = match[6] ? str_repeat(pad_character, pad_length) : '';
                output.push(match[5] ? arg + pad : pad + arg);
            }
        }
        return output.join('');
    };

    sprintf.cache = {};

    sprintf.parse = function (fmt) {
        var _fmt = fmt,
            match = [],
            parse_tree = [],
            arg_names = 0;
        while (_fmt) {
            if ((match = /^[^\x25]+/.exec(_fmt)) !== null) {
                parse_tree.push(match[0]);
            } else if ((match = /^\x25{2}/.exec(_fmt)) !== null) {
                parse_tree.push('%');
            } else if ((match = /^\x25(?:([1-9]\d*)\$|\(([^\)]+)\))?(\+)?(0|'[^$])?(-)?(\d+)?(?:\.(\d+))?([b-fosuxX])/.exec(_fmt)) !== null) {
                if (match[2]) {
                    arg_names |= 1;
                    var field_list = [],
                        replacement_field = match[2],
                        field_match = [];
                    if ((field_match = /^([a-z_][a-z_\d]*)/i.exec(replacement_field)) !== null) {
                        field_list.push(field_match[1]);
                        while ((replacement_field = replacement_field.substring(field_match[0].length)) !== '') {
                            if ((field_match = /^\.([a-z_][a-z_\d]*)/i.exec(replacement_field)) !== null) {
                                field_list.push(field_match[1]);
                            } else if ((field_match = /^\[(\d+)\]/.exec(replacement_field)) !== null) {
                                field_list.push(field_match[1]);
                            } else {
                                throw ('[sprintf] huh?');
                            }
                        }
                    } else {
                        throw ('[sprintf] huh?');
                    }
                    match[2] = field_list;
                } else {
                    arg_names |= 2;
                }
                if (arg_names === 3) {
                    throw ('[sprintf] mixing positional and named placeholders is not (yet) supported');
                }
                parse_tree.push(match);
            } else {
                throw ('[sprintf] huh?');
            }
            _fmt = _fmt.substring(match[0].length);
        }
        return parse_tree;
    };

    var vsprintf = function (fmt, argv, _argv) {
        _argv = argv.slice(0);
        _argv.splice(0, 0, fmt);
        return sprintf.apply(null, _argv);
    };

    /*
     * helpers
     */
    function get_type(variable) {
        return Object.prototype.toString.call(variable).slice(8, -1).toLowerCase();
    }

    function str_repeat(input, multiplier) {
        for (var output = []; multiplier > 0; output[--multiplier] = input) {
            /* do nothing */
        }
        return output.join('');
    }

    /*
     * export to either browser or node.js
     */
    ctx.sprintf = sprintf;
    ctx.vsprintf = vsprintf;


    var sscanf = function (str, format) {
        //  discuss at: http://locutus.io/php/sscanf/
        // original by: Brett Zamir (http://brett-zamir.me)
        //   example 1: sscanf('SN/2350001', 'SN/%d')
        //   returns 1: [2350001]
        //   example 2: var myVar = {}
        //   example 2: sscanf('SN/2350001', 'SN/%d', myVar)
        //   example 2: var $result = myVar.value
        //   returns 2: 2350001
        //   example 3: sscanf("10--20", "%2$d--%1$d") // Must escape '$' in PHP, but not JS
        //   returns 3: [20, 10]
        var retArr = []
        var _NWS = /\S/
        var args = arguments
        var digit
        var _setExtraConversionSpecs = function (offset) {
            // Since a mismatched character sets us off track from future
            // legitimate finds, we just scan
            // to the end for any other conversion specifications (besides a percent literal),
            // setting them to null
            // sscanf seems to disallow all conversion specification components (of sprintf)
            // except for type specifiers
            // Do not allow % in last char. class
            // var matches = format.match(/%[+-]?([ 0]|'.)?-?\d*(\.\d+)?[bcdeufFosxX]/g);
            // Do not allow % in last char. class:
            var matches = format.slice(offset).match(/%[cdeEufgosxX]/g)
            // b, F,G give errors in PHP, but 'g', though also disallowed, doesn't
            if (matches) {
                var lgth = matches.length
                while (lgth--) {
                    retArr.push(null)
                }
            }
            return _finish()
        }
        var _finish = function () {
            if (args.length === 2) {
                return retArr
            }
            for (var i = 0; i < retArr.length; ++i) {
                args[i + 2].value = retArr[i]
            }
            return i
        }
        var _addNext = function (j, regex, cb) {
            if (assign) {
                var remaining = str.slice(j)
                var check = width ? remaining.substr(0, width) : remaining
                var match = regex.exec(check)
                // @todo: Make this more readable
                var key = digit !== undefined ?
                    digit :
                    retArr.length
                var testNull = retArr[key] = match ?
                    (cb ?
                        cb.apply(null, match) :
                        match[0]) :
                    null
                if (testNull === null) {
                    throw new Error('No match in string')
                }
                return j + match[0].length
            }
            return j
        }
        if (arguments.length < 2) {
            throw new Error('Not enough arguments passed to sscanf')
        }
        // PROCESS
        for (var i = 0, j = 0; i < format.length; i++) {
            var width = 0
            var assign = true
            if (format.charAt(i) === '%') {
                if (format.charAt(i + 1) === '%') {
                    if (str.charAt(j) === '%') {
                        // a matched percent literal
                        // skip beyond duplicated percent
                        ++i
                        ++j
                        continue
                    }
                    // Format indicated a percent literal, but not actually present
                    return _setExtraConversionSpecs(i + 2)
                }
                // CHARACTER FOLLOWING PERCENT IS NOT A PERCENT
                // We need 'g' set to get lastIndex
                var prePattern = new RegExp('^(?:(\\d+)\\$)?(\\*)?(\\d*)([hlL]?)', 'g')
                var preConvs = prePattern.exec(format.slice(i + 1))
                var tmpDigit = digit
                if (tmpDigit && preConvs[1] === undefined) {
                    var msg = 'All groups in sscanf() must be expressed as numeric if '
                    msg += 'any have already been used'
                    throw new Error(msg)
                }
                digit = preConvs[1] ? parseInt(preConvs[1], 10) - 1 : undefined
                assign = !preConvs[2]
                width = parseInt(preConvs[3], 10)
                var sizeCode = preConvs[4]
                i += prePattern.lastIndex
                // @todo: Does PHP do anything with these? Seems not to matter
                if (sizeCode) {
                    // This would need to be processed later
                    switch (sizeCode) {
                        case 'h':
                        case 'l':
                        case 'L':
                            // Treats subsequent as short int (for d,i,n) or unsigned short int (for o,u,x)
                            // Treats subsequent as long int (for d,i,n), or unsigned long int (for o,u,x);
                            //    or as double (for e,f,g) instead of float or wchar_t instead of char
                            // Treats subsequent as long double (for e,f,g)
                            break
                        default:
                            throw new Error('Unexpected size specifier in sscanf()!')
                    }
                }
                // PROCESS CHARACTER
                try {
                    // For detailed explanations, see http://web.archive.org/web/20031128125047/http://www.uwm.edu/cgi-bin/IMT/wwwman?topic=scanf%283%29&msection=
                    // Also http://www.mathworks.com/access/helpdesk/help/techdoc/ref/sscanf.html
                    // p, S, C arguments in C function not available
                    // DOCUMENTED UNDER SSCANF
                    switch (format.charAt(i + 1)) {
                        case 'F':
                            // Not supported in PHP sscanf; the argument is treated as a float, and
                            //  presented as a floating-point number (non-locale aware)
                            // sscanf doesn't support locales, so no need for two (see %f)
                            break
                        case 'g':
                            // Not supported in PHP sscanf; shorter of %e and %f
                            // Irrelevant to input conversion
                            break
                        case 'G':
                            // Not supported in PHP sscanf; shorter of %E and %f
                            // Irrelevant to input conversion
                            break
                        case 'b':
                            // Not supported in PHP sscanf; the argument is treated as an integer,
                            // and presented as a binary number
                            // Not supported - couldn't distinguish from other integers
                            break
                        case 'i':
                            // Integer with base detection (Equivalent of 'd', but base 0 instead of 10)
                            var pattern = /([+-])?(?:(?:0x([\da-fA-F]+))|(?:0([0-7]+))|(\d+))/
                            j = _addNext(j, pattern, function (num, sign, hex,
                                oct, dec) {
                                return hex ? parseInt(num, 16) : oct ? parseInt(num, 8) : parseInt(num, 10)
                            })
                            break
                        case 'n':
                            // Number of characters processed so far
                            retArr[digit !== undefined ? digit : retArr.length - 1] = j
                            break
                            // DOCUMENTED UNDER SPRINTF
                        case 'c':
                            // Get character; suppresses skipping over whitespace!
                            // (but shouldn't be whitespace in format anyways, so no difference here)
                            // Non-greedy match
                            j = _addNext(j, new RegExp('.{1,' + (width || 1) + '}'))
                            break
                        case 'D':
                        case 'd':
                            // sscanf documented decimal number; equivalent of 'd';
                            // Optionally signed decimal integer
                            j = _addNext(j, /([+-])?(?:0*)(\d+)/, function (num, sign, dec) {
                                // Ignores initial zeroes, unlike %i and parseInt()
                                var decInt = parseInt((sign || '') + dec, 10)
                                if (decInt < 0) {
                                    // PHP also won't allow less than -2147483648
                                    // integer overflow with negative
                                    return decInt < -2147483648 ? -2147483648 : decInt
                                } else {
                                    // PHP also won't allow greater than -2147483647
                                    return decInt < 2147483647 ? decInt : 2147483647
                                }
                            })
                            break
                        case 'f':
                        case 'E':
                        case 'e':
                            // Although sscanf doesn't support locales,
                            // this is used instead of '%F'; seems to be same as %e
                            // These don't discriminate here as both allow exponential float of either case
                            j = _addNext(j, /([+-])?(?:0*)(\d*\.?\d*(?:[eE]?\d+)?)/, function (num, sign, dec) {
                                if (dec === '.') {
                                    return null
                                }
                                // Ignores initial zeroes, unlike %i and parseFloat()
                                return parseFloat((sign || '') + dec)
                            })
                            break
                        case 'u':
                            // unsigned decimal integer
                            // We won't deal with integer overflows due to signs
                            j = _addNext(j, /([+-])?(?:0*)(\d+)/, function (num, sign, dec) {
                                // Ignores initial zeroes, unlike %i and parseInt()
                                var decInt = parseInt(dec, 10)
                                if (sign === '-') {
                                    // PHP also won't allow greater than 4294967295
                                    // integer overflow with negative
                                    return 4294967296 - decInt
                                } else {
                                    return decInt < 4294967295 ? decInt : 4294967295
                                }
                            })
                            break
                        case 'o':
                            // Octal integer // @todo: add overflows as above?
                            j = _addNext(j, /([+-])?(?:0([0-7]+))/, function (num, sign, oct) {
                                return parseInt(num, 8)
                            })
                            break
                        case 's':
                            // Greedy match
                            j = _addNext(j, /\S+/)
                            break
                        case 'X':
                        case 'x':
                            // Same as 'x'?
                            // @todo: add overflows as above?
                            // Initial 0x not necessary here
                            j = _addNext(j, /([+-])?(?:(?:0x)?([\da-fA-F]+))/, function (num, sign, hex) {
                                return parseInt(num, 16)
                            })
                            break
                        case '':
                            // If no character left in expression
                            throw new Error('Missing character after percent mark in sscanf() format argument')
                        default:
                            throw new Error('Unrecognized character after percent mark in sscanf() format argument')
                    }
                } catch (e) {
                    if (e === 'No match in string') {
                        // Allow us to exit
                        return _setExtraConversionSpecs(i + 2)
                    }
                    // Calculate skipping beyond initial percent too
                }
                ++i
            } else if (format.charAt(i) !== str.charAt(j)) {
                // @todo: Double-check i whitespace ignored in string and/or formats
                _NWS.lastIndex = 0
                if ((_NWS)
                    .test(str.charAt(j)) || str.charAt(j) === '') {
                    // Whitespace doesn't need to be an exact match)
                    return _setExtraConversionSpecs(i + 1)
                } else {
                    // Adjust strings when encounter non-matching whitespace,
                    // so they align in future checks above
                    // Ok to replace with j++;?
                    str = str.slice(0, j) + str.slice(j + 1)
                    i--
                }
            } else {
                j++
            }
        }
        // POST-PROCESSING
        return _finish()
    }

    ctx.sscanf = sscanf;

})(window);