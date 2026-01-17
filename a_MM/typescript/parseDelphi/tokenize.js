/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

const fs = require('fs');
const path = require('path');

const keywords = [
    'begin',   'boolean',   'class',
    'const',   'else',      'end',
    'false',   'finally',   'function',
    'if',      'integer',   'interface',
    'not',     'of',        'or',
    'private', 'procedure', 'public',
    'string',  'then',      'to',
    'true',    'try',       'type',
    'unit',    'uses',      'var'
]

const punctuation = [';', ':', '<', '>', '+', '-', '*', '/', '^', ',', '.', '(', ')', '[', ']', '=', '@'];

/**
 * @param {string} filepath 
 * @returns {{tokens: Array<{type: 'numeric'|'string'|'identifier'|'punctuation'|'comment'|'blockComment'|'character', value: string, range: [number, number]}>, string: string}} 
 */
function tokenize(filepath) {
    // Read the file
    const thisFile = path.resolve(filepath);
    const original = fs.readFileSync(thisFile, 'utf-8').replace(/\r/g, '').trim();
    
    const tokens = [];
    let i = 0;
    let lastI = 0; // To avoid an infinite loop
    let str = original;
    while (i < original.length) {
        lastI = i;
        // remove beginning whitespace
        while(original[i] === ' ' || original[i] === '\n' || original[i] === '\t') {
            i++;
        }
        // break the loop if we exceeded the string
        if (i >= original.length) {
            console.log('Breaking');
            break;
        }
        str = original.substring(i);
        let nextSpace, thisSubstr;
        
        let startChar = str[0]; // for handling special characters
        
        // comments or IFDEF stuff... for this parser we don't care about IFDEF
        if (str.startsWith('{')) {
            nextSpace = str.indexOf('}') + 1;
            thisSubstr = str.substring(1, nextSpace-1); // remove the { and }
            tokens.push({
                type: 'comment',
                value: thisSubstr,
                range: [i, i ]
            });
        }
        // one-line comments
        else if (str.startsWith('//')) {
            nextSpace = str.indexOf('\n') + 1;
        }
        // hexadecimal numbers
        else if (str.startsWith('$')) {
            nextSpace = str.search(/[^$\d]/g); // next non digit / non $
            thisSubstr = str.substring(0, nextSpace);
            tokens.push({
                type: 'numeric',
                value: thisSubstr,
                range: [i, i + nextSpace],
            });
        }
        // character values
        else if (str.startsWith('#')) {
            nextSpace = str.substring(1).search(/[^$\d]/g); // next non digit after the first #
            tokens.push({
                type: 'character',
                value: thisSubstr,
                range: [i, i + nextSpace],
            });
        }
        // empty string
        else if (str.startsWith("''")) {
            nextSpace = 2;
            tokens.push({
                type: 'string',
                value: "''",
                range: [i, i + 2]
            });
        }
        // literal strings
        else if (str.startsWith('\'')) {
            nextSpace = str.search(/[^']'/g) + 2; // find an end quotation mark that follows a NON quotation mark (cuz '' represents an escaped ')
            thisSubstr = str.substring()
            tokens.push({
                type: 'string',
                value: str.substring(0, nextSpace),
                range: [i, i + nextSpace],
            })
        }
        // block comments
        else if (str.startsWith('(*')) {
            nextSpace = str.indexOf('*)') + 2; // end of block comment
            thisSubstr = str.substring(2, nextSpace - 2).trim();
            tokens.push({
                type: 'blockComment',
                value: thisSubstr,
                range: [i + 2, i + nextSpace - 2],
            });
        }
        // punctuation
        else if (punctuation.includes(startChar)) {
            tokens.push({
                type: 'punctuation', 
                value: startChar,
                range: [i, i + 1],
            });
            nextSpace = 1; // proceed to next character
        }
        // pointers
        else if (str.startsWith('&')) {
            nextSpace = str.substring(1).search(/\W/g);
            // i could add this as a token but it doens't matter
        }
        else {
            nextSpace = str.search(/\W/g);
            
            if (nextSpace === -1) throw new Error('Could not find a space or newline');
            if (nextSpace === 0) {
                // Logging to help identify where the parsing error was
                console.log('Index', i, 'startString', str.substring(0, 20), 'last few tokens:');
                for (let i = tokens.length - 1; i > Math.max(0, tokens.length - 10); i--) {
                    console.log(tokens[i]);
                }
                throw new Error('nextSpace is zero!');
            } 
            
            thisSubstr = str.substring(0, nextSpace);
            // we now have the word, check if it's a keyword or a name
            if (keywords.includes(thisSubstr)) {
                tokens.push({
                    type: 'keyword',
                    value: thisSubstr,
                    range: [i, i + nextSpace]
                });
            }
            else {
                tokens.push({
                    type: 'identifier',
                    value: thisSubstr,
                    range: [i, i + nextSpace]
                });
            }
        }
        i += nextSpace;
        if (lastI === i) {
            // Logging to help identify where the parsing error was
            console.log('Index', i, 'startString', str.substring(0, 20), 'last few tokens:');
            for (let i = tokens.length - 1; i > Math.max(0, tokens.length - 10); i--) {
                console.log(tokens[i]);
            }
            throw new Error('index did not change! Parser error!');
        } 
    }
    return {tokens: tokens, string: original};
}

module.exports = tokenize;