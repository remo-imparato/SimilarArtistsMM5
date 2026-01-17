/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

'use strict';
const fs = require('fs');
const path = require('path');
const tokenize = require('./tokenize');

/*
    Uses of inline comments:
        1. After a generic type inside a function declaration (e.g. ICefv8Value), write the TypeScript value in a {} comment
            e.g.: BaseShared.pas:
                procedure forEach( const cbk: ICefV8Value {(item: T, index: number) => void});
            *** The way it behaves is slightly different depending on what generic type precedes the comment!!!! ***
                - ICefv8Value: The value gets passed without any modifications
                    e.g.: ICefv8Value {string}      ->      string;
                - IJSPromise: The value gets wrapped inside a Promise generic
                    e.g.: IJSPromise {string}       ->      Promise<string>;
                - TCefv8ValueArray: The ENTIRE function parameters block gets passed as-is into the TS function parameters block, instead of going one-by-one
                    e.g.: myFunc(const params: TCefv8ValueArray (*fileName: string, params: {encoding: TextEncoding}*)): IJSPromise {string};
                        ->  myFunc: (fileName: string, params: {encoding: TextEncoding}) => Promise<string>;
        2. To ignore the next line, in the case of TypeScript getting upset at duplicate values (since the parser ignores $IFDEF statements), write a comment {ts-ignore} before the line
            e.g.: BaseApp.pas:
                {$IFDEF OPENWININJS}
                property _window: ICefv8Value read FWindowRef;
                {$else}
                {ts-ignore} property _window: ICefv8Value read GetWindowRef;
        3. To manually insert a line into the TypeScript declaration, write a comment {ts-insert "<TS code to add>"}
            e.g. ArtistsManage.pas: (the '@property title' comment was added without it being re-declared in Delphi)
                {ts-insert "title: string;"}
        4. The parser is not very smart and can't deal with every edge case. Sometimes it gets confused by data types defined INSIDE a class/interface, e.g. TStorage inside TSharedList. To fix, add a comment right after the "published" tag where it should start looking for methods: {ts-begin [class name] published}
            e.g. BaseShared.pas: {ts-begin TSharedList published}
    * note: Add stuff like type aliases and whatever else needed in add_before.ts, which will be inserted at the top of the generated file *
*/

function parseDelphi({silent}) {

    const DIRNAME = path.dirname(__filename);
    const DELPHI_DIR = path.join(DIRNAME, '..', '..', '..');
    let tsBeforeContent = fs.readFileSync(path.join(DIRNAME, 'add_before.ts'), 'utf-8'); // TS code/declarations that goes on the top of all the generated output code.
    let str = tsBeforeContent + '\n\n';

    const TAB = '    ';
    // Include source filename as a comment above each class.
    const INCLUDE_SOURCE_FILENAME = false;
    const OUTPUT_FILENAME = path.join(DIRNAME, '..', 'src', 'types', 'Native.ts');

    if (!silent) console.log(`Reading from ${DELPHI_DIR}`);

    // {[Name in Delphi code]: [Name in output TS]}
    //  For when we have a different name in the documentation
    const delphiNameToTSMap = {
        'ISharedStringList': 'StringList',
        'TSharedStringList': 'StringList',
        'ISharedString': 'string',
        'TSharedWindow': 'SharedWindow',
        'PWideChar': 'string',
        'variant': 'any',
        'TMainApplication': 'App',
        'TDebugClass': 'Debug',
        'TDialogsClass': 'Dialogs',
        'TTrackOperationClass': 'TrackOperation',
        'TFilesystemClass': 'Filesystem',
        'TFileFormatsClass': 'FileFormats',
        'TPlaylistsClass': 'Playlists',
        'TSharingClass': 'Sharing',
        'TDevicesClass': 'Devices',
        'TEqualizerSettingsClass': 'EqualizerSettings',
        'TSettingsUtilsClass': 'SettingsUtils',
        'TTrayIconClass': 'TrayIcon',
        'TImporterClass': 'Importer',
        'TMasksClass': 'Masks',
        'TUtilsClass': 'Utils',
        'TSettingsClass': 'Settings',
        'THotkeysClass': 'Hotkeys',
        'TDBClass': 'DB',
        'TFullPlayer': 'Player',

        'ISongListData': 'Track',
        'TSongListData': 'Track',
        'ISongList': 'Tracklist',
        'TSongList': 'Tracklist',
        'TCoverItem': 'Cover',
        'ICoverItem': 'Cover',
        'TDateTime': 'float',
        'TQueryPlus': 'Query',
        'TDeviceLibrary': 'Device',
        'IDeviceLibrary': 'Device',
        'TMediaMonkeyApp': 'App',
        'TEqualizerSettings': 'EqualizerSettings',
        'ISharedNodeList': 'SharedNodeList',
        'TSharedNodeList': 'SharedNodeList',
        'TSQLiteField': 'Field',
        'ISQLiteField': 'Field',
        'ISQLiteTable': 'QueryBase',
        'TWebUtils': 'Web',
        'TWebUtilsClass': 'Web',
        'TDownloadManager': 'Downloader',
        'IDownloadManager': 'Downloader',
        'IRating': 'RatingItem',
        'TRating': 'RatingItem',
        'TResponse': 'SharedResponse',
        'IResponse': 'SharedResponse',
    }

    const otherNameMap = {
        'longint': 'integer',
        'shortint': 'integer',
        'smallint': 'integer',
        'integer': 'integer',
        'int32': 'integer',
        'int64': 'integer',
        'single': 'float',
        'double': 'float',
        'intarray': 'integer[]',
        // Other primitives which should be lowercase
        'string': 'string',
        'ansistring': 'string',
        'byte': 'byte',
        'bool': 'boolean',
        'boolean': 'boolean',
    }

    const filesToSearch = [
        {
            filename: 'BaseShared.pas',
            classes: [
                'TSharedBase', 'TSharedObject', 'TSharedObservable', 'TSharedCommonObject', 'TSharedList',
                'TSharedUIList', 'TJSCallback', 'TJSCallbacks', 'ISharedUICommonList', 'TSharedStringList',
                'TFileBuffer', 'TSharedObjectLink',
            ],
        },
        {
            filename: 'BaseMedia.pas',
            classes: [
                'TPinableObject', 'TSongListData', 'TExternalLinksList', 'TTrackListBase',
                'TSharedMediaObject', 'TSongList', 'IPlaylistEntry', 'TPlaylistEntries',
                'TAlbum', 'TQueryResultRow', 'TQueryResults', 'TAlbumList', 'TExternalLink',
                'TListItem', 'TListItemList', 'TPerson', 'TPersonList', 'TWebNodesList',
                'TPinnedObjectsList',
            ]
        },
        {
            filename: 'BaseApp.pas',
            classes: ['TBounds', 'TBaseSharedWindow', 'TSharedWindow', 'TDialogs', 'TDebug', 'TMainApplication',]
        },
        {
            filename: 'ArtistsManage.pas',
            classes: [
                'TAlbumsGroupParent', 'TAlbumsGroup', 'TArtist', 'TGenre', 'TGenreList', 'TDecadeList', 'TDecade',
                'TYear', 'TYearList', 'TArtistList',
            ],
        },
        {
            filename: 'AutoOrganize.pas',
            classes: ['TAutoOrganizeRule', 'TAutoOrganizeMgr',]
        },
        {
            filename: 'Covers.pas',
            classes: ['TCoverItem', 'TCoverList',]
        },
        {
            filename: 'DatabaseManage.pas',
            classes: ['TProgressToken',]
        },
        {
            filename: 'DBPlus.pas',
            classes: ['TQueryPlus',]
        },
        {
            filename: 'Devices.pas',
            classes: ['TDeviceLibrary', 'TDevices', 'TDeviceCalculator', 'TDeviceCollection', 'TSizeInfo', 'TSyncPlaylist', 'TSynchSong', 'TSyncFile', 'TDevicePlaylist']
        },
        {
            filename: 'Extensions.pas',
            classes: ['TAddonList', 'TAddon',]
        },
        {
            filename: 'Filters.pas',
            classes: ['TRating', 'TCollection', 'TCollections', 'TCollectionList',]
        },
        {
            filename: 'FormatsManage.pas',
            classes: ['TAutoConvertSettings', 'TAutoConvertRule', 'TSuppType', 'TFormatSettingsList', 'TFileFormats', 'TFormatSettings',]
        },
        {
            filename: 'FullPlayer.pas',
            classes: ['TVisResult', 'IVisualization', 'TFullPlayer', 'TAutoDJSettings', 'THTMLPlaybackState',]
        },
        {
            filename: 'Hotkeys.pas',
            classes: ['THotkeys', 'THotkeyList', 'THotkeyData',]
        },
        {
            filename: 'Importers.pas',
            classes: ['TImporter', 'TImportParent',]
        },
        {
            filename: 'MaskHelper.pas',
            classes: ['TMasks',]
        },
        {
            filename: 'MediaManage.pas',
            classes: ['TSharedFolder', 'TSharedDrive', 'TNetworkResource', 'TDBFolderList', 'TDBFolder',]
        },
        {
            filename: 'MP3Utils.pas',
            classes: ['TGenFormatSettings',]
        },
        {
            filename: 'PlaylistManage.pas',
            classes: ['TPlaylist', 'TPlaylists', 'TPlaylistList',]
        },
        {
            filename: 'PodcastManage.pas',
            classes: ['IPodcast', 'TPodcasts', 'TPodcastList',]
        },
        {
            filename: 'ResourceLoader.pas',
            classes: ['TResponse',]
        },
        {
            filename: 'QueryManage.pas',
            classes: ['TQueryCondition', 'TQueryData', 'TQueryConditionList']
        },
        {
            filename: 'Settings.pas',
            classes: ['TEqualizerSettings', 'TSettings', 'TSettingsUtils',]
        },
        {
            filename: 'SharedTree.pas',
            classes: ['TSharedNodeList', 'TSharedNode', 'TSharedTree',]
        },
        {
            filename: 'Shutdowner.pas',
            classes: ['TShutdowner',]
        },
        {
            filename: 'SQLiteDB.pas',
            classes: ['TSQLiteField', 'ISQLiteTable']
        },
        {
            filename: 'ThreadedProgress.pas',
            classes: ['IBackgroundTask', 'TBackgroundTasks',]
        },
        {
            filename: 'MetadataStorageHandler.pas',
            classes: ['TMetadataStorageHandler',]
        },
        {
            filename: 'UpNp.pas',
            classes: [
                'TServerContainer', 'TRemoteServer', 'TRemoteClient', 'TMediaServer',
                'TRemotePlayer', 'TSharing', 'TServerList', 'TAuthReceiver', 'TRemoteDeviceList',
            ]
        },
        {
            filename: 'WebUtils.pas',
            classes: ['TDownloadItem', 'TWebUtils', 'TDownloadManager', 'TDownloadItemList',]
        },
        {
            filename: 'WinAmpPlugins.pas',
            classes: ['TBasePlugin', 'TPluginList', 'TWAOutputPlugin',]
        },
        {
            filename: 'VirtualRegistry.pas',
            classes: ['TRegistryAccess',]
        },
        {
            filename: 'MediaMonkeyApp.pas',
            classes: [
                'TSkin', 'TTrayIcon', 'TUtils', 'TTrackOperation', 'TFilesystem', 'TDB',
                'TIniFileAccess', 'TSkinList', 'TMediaMonkeyApp',
            ]
        },
        {
            filename: 'AppManager.pas',
            classes: [
                'TCloseToken',
            ]
        }
    ];

    // Special case. Both TMainApplication and TMediaMonkeyApp have methods/properties published under 'App'.
    //  Gonna store a string with all the properties of TMainApplication and add it when we parse TMediaMonkeyApp.
    let TMainApplicationStr = '';
    // for "declare var X" for all properties in SharedWindow
    let SharedWindowStr = '';

    let startTime = Date.now();
    for (let file of filesToSearch) {
        try {
            parseFile(file);
        }
        catch (err) {
            console.log(err);
            fs.writeFileSync(OUTPUT_FILENAME, str, 'utf-8'); // output what we have so far
            process.exit(); // quit
        }
    }

    str += SharedWindowStr;
    fs.writeFileSync(OUTPUT_FILENAME, str, 'utf-8');

    console.log(`Done parsing in ${Date.now() - startTime} ms`);
    if (!silent) console.log(`Output to ${OUTPUT_FILENAME}`);

    function parseFile(file) {
        if (!silent) console.log(`Parsing ${file.filename}...`);

        const { tokens, string: originalString } = tokenize(path.join(DELPHI_DIR, file.filename));

        for (let className of file.classes) {
            parseClass(className, false);
        }
        if (file.classesNoExtends) {
            for (let className of file.classesNoExtends) {
                parseClass(className, true);
            }
        }

        function parseClass(classStr, ignoreExtends) {
            let className;
            // for names that are different in the docs
            if (delphiNameToTSMap[classStr]) {
                className = delphiNameToTSMap[classStr];
            }
            else {
                className = classStr.substring(1);
            }

            // To spit out "declare x" at the bottom of the file
            const isBrowserWindowClass = (classStr === 'TBaseSharedWindow' || classStr === 'TSharedWindow')

            if (!silent) console.log(`${TAB}Parsing class: ${classStr}`);
            if (INCLUDE_SOURCE_FILENAME) str += `// ${file.filename}\n`;

            let classVariableIdx = nextIndexOfValue(classStr, 0);

            let classIdx = whichIndexFirst(nextIndexOfValue('class', classVariableIdx), nextIndexOfValue('interface', classVariableIdx)); // whichever comes first

            // ex: TSharedWindow = class; declared before the full declaration
            if (tokens[classIdx + 1].value === ';') {
                classVariableIdx = nextIndexOfValue(classStr, classVariableIdx + 1);
            }
            // theeeen, skip all mentions of the class name that don't have an = after
            while (tokens[classVariableIdx + 1].value !== '=' && tokens[classVariableIdx + 1].value !== '<') {
                // console.log(printToken(classVariableIdx));
                classVariableIdx = nextIndexOfValue(classStr, classVariableIdx + 1);
            }

            // update classIdx in case it classVariableIdx got fixed
            classIdx = whichIndexFirst(nextIndexOfValue('class', classVariableIdx), nextIndexOfValue('interface', classVariableIdx));

            // check if it has a "wrapper" obj, e.g. TSharedList<T:IBase>
            let wrapperAppend = '';
            if (tokens[classVariableIdx + 1].value === '<') {
                if (tokens[classVariableIdx + 2].type !== 'identifier') throw new Error(`Expected identifier: ${printToken(classVariableIdx + 2)}`);
                if (tokens[classVariableIdx + 3].value !== ':') throw new Error(`Expected colon: ${printToken(classVariableIdx + 3)}`);
                if (tokens[classVariableIdx + 4].type !== 'identifier') throw new Error(`Expected identifier: ${printToken(classVariableIdx + 3)}`);
                wrapperAppend = `<${tokens[classVariableIdx + 2].value} = ${getType(classVariableIdx + 4)}>`;
            }

            // for seeing which class it extends from
            let parenIdxA = nextIndexOfValue('(', classVariableIdx);
            let parenIdxB = nextIndexOfValue(')', parenIdxA);

            let publishedIdx = nextIndexOfValue('published', classVariableIdx);
            let endIdx = nextIndexOfValue('end', parenIdxB);

            // Custom "begin published" tag because the parser is dumb and can't deal with every edge case
            let customBeginPublishedIdx = nextIndexOfValue(`ts-begin ${classStr} published`);
            if (customBeginPublishedIdx > 0) {
                publishedIdx = customBeginPublishedIdx;
                endIdx = nextIndexOfValue('end', publishedIdx);
            }

            // e.g. extends TSharedList<T>
            let extendsWrapperAppend = '';
            // if (tokens[parenIdxA+2].value === '<') {
            //     if (tokens[parenIdxA+3].type !== 'identifier') throw new Error(`Expected identifier: ${printToken(parenIdxA+3)}`);
            //     extendsWrapperAppend = `<${getType(parenIdxA+3)}>`;
            // }

            let implementsAppend = '';

            // jsdoc comment
            let prevToken = tokens[classVariableIdx - 1];
            if (prevToken.type === 'blockComment' && classStr !== 'TMainApplication' /* special case */) {
                let value = prevToken.value;
                str += `${value}\n`;

                // @implements <string>
                const regex = /@implements (.*?)(\n|$)/g;
                let matches = regex.exec(value);
                if (matches && matches[1]) {
                    // implementsAppend = ' implements ' + matches[1];
                }
            }


            // example: TDialogs = class (then it starts with public properties)
            if (['private', 'protected', 'public', 'published'].includes(tokens[nextIndexOfValue('class', classVariableIdx) + 1].value)) {
                ignoreExtends = true;
            }

            let thisStr = '', classDefStr = '';

            // class declaration without inheritance
            if (parenIdxA !== classIdx + 1) {
                classDefStr += `declare class ${className}${wrapperAppend}${implementsAppend} {`;
            }
            else if (ignoreExtends) {
                classDefStr += `declare class ${className}${wrapperAppend}${implementsAppend} {`;
            }
            else {
                classDefStr += `declare class ${className}${wrapperAppend} extends ${getType(parenIdxA + 1)}${extendsWrapperAppend}${implementsAppend} {`;
            }

            let ignoreNextLine = false; // {ts-ignore}

            let i = publishedIdx + 1;
            while (i < endIdx && publishedIdx < endIdx && publishedIdx > 0) {

                // Ignore some keywords
                if (tokens[i].value.toLowerCase() === 'override') { i += 2; continue; };
                if (tokens[i].value.toLowerCase() === 'virtual') { i += 2; continue; };
                if (tokens[i].value.toLowerCase() === 'reintroduce') { i += 2; continue; };
                if (tokens[i].value.toLowerCase() === 'overload') { i += 2; continue; };
                if (tokens[i].value.toLowerCase() === 'abstract') { i += 2; continue; };

                if (tokens[i].type === 'comment') {
                    // special comment to ignore a line
                    if (tokens[i].value === 'ts-ignore') {
                        ignoreNextLine = true; // Skip rendering the next line
                        i++; continue;
                    }
                    // ignore other line/$ comments (except the one below)
                    else if (!tokens[i].value.startsWith('ts-insert')) {
                        i++; continue;
                    }
                }

                // ignore "types" inside of a class (e.g. TEnumerator)
                if (tokens[i].value === 'type') {
                    i = nextIndexOfValue('end', i) + 2; // +2 because semicolon
                    // Must then update endIdx 
                    endIdx = nextIndexOfValue('end', i);
                    continue;
                }

                // add block comment before function declaration
                if (tokens[i].type === 'blockComment') {
                    thisStr += TAB + tokens[i].value + '\n';
                    if (isBrowserWindowClass) SharedWindowStr += `${tokens[i].value}\n`;
                    i++; continue;
                }

                // special comment to insert TS code as described
                if (tokens[i].type === 'comment' && tokens[i].value.startsWith('ts-insert')) {
                    const regex = /^ts-insert "(.*)"$/g;
                    let matches = tokens[i].value.matchAll(regex);
                    if (!matches) throw new Error(`ts-insert comment does not follow regex: ${regex}! ${printToken(i)}`);

                    for (let match of matches) {
                        thisStr += TAB + match[1] + '\n'; // match #1: First match is whole string, second match is the text inside parentheses
                    }
                    i++; continue; // skip to the next token
                }

                // class function can appear after a block comment
                if (tokens[i].value.toLowerCase() === 'class') { i++; continue; }

                let nextSemi = nextIndexOfValue(';', i);
                let nextOpenParen = nextIndexOfValue('(', i);
                let nextCloseParen = nextIndexOfValue(')', i);

                let propertyName = tokens[i + 1].value;

                let isJSFunction = false;
                if (propertyName.startsWith('js_')) {
                    isJSFunction = true;
                    propertyName = propertyName.substring(3);
                }

                let nextLine, funcParams;
                switch (tokens[i].value) {
                    case 'constructor':
                    case 'destructor':
                    case 'procedure':
                        funcParams = '';
                        if (nextOpenParen < nextSemi) { // if there are parameters to the procedure
                            funcParams = getFunctionParameters(isJSFunction);
                        }
                        nextLine = `${TAB}${propertyName}(${funcParams}): void;\n`

                        if (isBrowserWindowClass && !ignoreNextLine) {
                            SharedWindowStr += `declare function ${propertyName}(${funcParams}): void;\n`
                        }
                        i = nextIndexOfValue(';', i) + 1; // skip to after the semi after the close paren
                        break;

                    // nextLine = `${TAB}${propertyName}: (`;
                    // funcParams = '';
                    // if (nextOpenParen < nextSemi) { // if there are parameters to the procedure
                    //     funcParams = getFunctionParameters(isJSFunction);
                    // }
                    // nextLine += funcParams;
                    // nextLine += ') => void;\n';
                    // i = nextIndexOfValue(';', i) + 1; // skip to after the semi after the close paren
                    // if (isBrowserWindowClass && !ignoreNextLine) {
                    // 	SharedWindowStr += `declare function ${propertyName}(${funcParams}): void;\n`
                    // }
                    case 'function':
                        funcParams = '';
                        if (nextOpenParen < nextSemi) { // if there are parameters to the method
                            funcParams = getFunctionParameters(isJSFunction);
                        }
                        let thisType = getType(nextIndexOfValue(':', i) + 1); // return type
                        nextLine = `${TAB}${propertyName}(${funcParams}): ${thisType};\n`;

                        if (isBrowserWindowClass && !ignoreNextLine) {
                            SharedWindowStr += `declare function ${propertyName}(${funcParams}): ${thisType};\n`
                        }
                        i = nextIndexOfValue(';', i) + 1; // skip to after the semi after the close paren
                        break;

                    // nextLine = `${TAB}${propertyName}: (`;
                    // funcParams = '';
                    // if (nextOpenParen < nextSemi) { // if there are parameters to the procedure
                    //     funcParams = getFunctionParameters(isJSFunction);
                    // }
                    // nextLine += funcParams;
                    // nextLine += ') => ';
                    // let thisType = getType(nextIndexOfValue(':', i)+1); // return type
                    // nextLine += thisType + ';\n';
                    // i = nextIndexOfValue(';', i) + 1; // skip to after the semi after the close paren
                    // if (isBrowserWindowClass && !ignoreNextLine) {
                    // 	SharedWindowStr += `declare function ${propertyName}(${funcParams}): ${thisType};\n`
                    // }
                    case 'property':
                        let type = getType(i + 3); // i + 2 b/c after the colon
                        nextLine = `${TAB}${propertyName}: ${type};\n`;
                        if (isBrowserWindowClass && !ignoreNextLine) {
                            SharedWindowStr += `declare let ${propertyName}: ${type};\n`
                        }
                        i = nextIndexOfValue(';', i) + 1; // skip to after the next semicolon
                        break;
                    default:
                        throw new Error(`Unrecognized token ${printToken(i)}`);
                }

                if (ignoreNextLine) ignoreNextLine = false;
                else thisStr += nextLine; // Add line

                // Used for both procedures and functions. Uses some variables that are declared outside of this func's scope
                //  warning for future self: it mutates i, i has to be explicitly assigned later 
                function getFunctionParameters(isJSFunction) {
                    // js_X functions always have the first 3 tokens as "params: TCefv8ValueArray".
                    //  So for these, use ONE comment that names each param. Example:
                    //      (* params?: {cacheVisibility?: boolean, includeEntireLibrary?: boolean, cacheIsEmpty?: boolean} *)
                    //      { param0: number, param1?: boolean }
                    if (isJSFunction) {
                        let ret;
                        let cefValueArrayLocation = nextIndexOfValue('TCefv8ValueArray', nextOpenParen);
                        if (
                            tokens[cefValueArrayLocation + 1].type === 'comment' || tokens[cefValueArrayLocation + 1].type === 'blockComment'
                        ) {
                            ret = tokens[cefValueArrayLocation + 1].value;
                        }
                        // if not specified, use a rest param
                        else {
                            ret = '...params: any[]';
                        }
                        i = nextCloseParen + 1; // exit
                        return ret;
                    }
                    else {
                        i = nextOpenParen + 1;
                        let params = [];
                        while (i < nextCloseParen) {
                            if (tokens[i].value === 'const' || tokens[i].value === 'var') i++; // ignore const and var
                            let thisPropName = tokens[i].value;

                            let nextColon = nextIndexOfValue(':', i);
                            let thisValue = getType(nextColon + 1); // token AFTER the next colon

                            params.push(`${thisPropName}: ${thisValue}`); // add to string

                            // multiple names with the same type, e.g. foo, bar: integer
                            if (tokens[i + 1].value === ',') {
                                i += 2; // next identifier
                                while (i < nextColon) {
                                    if (tokens[i].type !== 'identifier') throw new Error(`Expected identifier: ${printToken(i)}`); // sanity check
                                    let nextPropName = tokens[i].value;
                                    params.push(`${nextPropName}: ${thisValue}`);
                                    i += 2; // skip to next identifier
                                }
                            }
                            // if (tokens[i+1].value !== ':') throw new Error(`Unrecognized token after propName: ${printToken(i+1)}`); // sanity check
                            i = whichIndexFirst(nextIndexOfValue(';', i), nextCloseParen) + 1; // skip to after next semi (or close paren, whichever is first), it's after the next paren the loop will exit
                        }
                        return params.join(', ');
                    }
                }
            }

            // events are usually in private/protected sections, i.e. before "published"
            for (let i = classVariableIdx; i < endIdx; i++) {
                if (tokens[i].type === 'blockComment' && tokens[i].value.includes('@event')) {
                    thisStr += `${TAB}${tokens[i].value}\n`;
                    continue;
                    let thisVal = tokens[i].value;
                    let startIdx = thisVal.indexOf('@event') + 6;
                    let endIdx = thisVal.substring(startIdx).search(/\n/);
                    let eventValue = thisVal.substring(startIdx, startIdx + endIdx).trim();
                    // thisStr += TAB + tokens[i].value + '\n' + TAB + `event_${eventValue} = '${eventValue}'// (Must be used with app.listen())\n`;
                    // thisStr += TAB + tokens[i].value + '\n' + TAB + `${eventValue}: 'app.listen(myObj, "${eventValue}", () => {})'\n`;
                    thisStr += TAB + tokens[i].value + '\n' + TAB + `event_${eventValue}: (foo: number) => void;\n`;
                    // e.g. "onClosed: AnyCallback;";
                    let eventHandlerValue = 'on' + eventValue[0].toUpperCase() + eventValue.substring(1);
                    if (!thisStr.includes(eventHandlerValue)) // Only add to declaration if it isn't actually a real property
                        thisStr += `${TAB}/**\n${TAB}@hidden (Used to optionally attach "on X" handlers to the object itself)\n\n${TAB}Event is not automatically listened if you specify this property. Must still use app.listen(). */\n`
                            + `${TAB}${eventHandlerValue}?: (...args: any) => void;\n`;
                }
            }

            // special case for App, described above
            if (classStr === 'TMainApplication') {
                TMainApplicationStr = thisStr;
            }
            else if (classStr === 'TMediaMonkeyApp') {
                str += 'declare class App {\n\n' + TMainApplicationStr + thisStr + '\n}\n\n'; // end of class
            }
            else {
                if (thisStr.length === 0) {
                    str += classDefStr + '  }\n\n'; // Class with no contents, make it one line
                }
                else {
                    str += classDefStr + '\n\n' + thisStr + '\n}\n\n'; // end of class
                }
            }
        }

        /**
         * Search for the index of a token with the specified string value and starting index in the token array
         * @param {string} value 
         * @param {number} startIdx 
         */
        function nextIndexOfValue(value, startIdx) {
            startIdx ??= 0; // default 0
            for (let i = startIdx; i < tokens.length; i++) {
                if (tokens[i].value === value) {
                    return i;
                }
            }
            return -1;
        }

        /**
         * 
         * @param {number} index 
         * @returns {string}
         */
        function getType(index) {
            let type = tokens[index].value;

            let isPromise = (type.toLowerCase() === 'ijspromise' || type.toLowerCase() === 'ipromise');
            let isUnknown = (type.toLowerCase() === 'icefv8value');
            let isArray = (type.toLowerCase() === 'tcefv8valuearray');

            if (isPromise || isUnknown || isArray) {
                type = 'any';
            }
            // class names which are different in the documentation
            if (delphiNameToTSMap[type]) {
                type = delphiNameToTSMap[type];
            }
            // shared object types, remove preceeding I or T (which are not inside the names map)
            else if (shouldChopFirstLetter(type)) {
                type = type.substring(1);
            }
            let commentLocation = index + 1;
            // array of X
            if (tokens[index].value.toLowerCase() === 'array' && tokens[index + 1].value.toLowerCase() === 'of') {
                commentLocation = index + 3;
                type = 'any[]';
            }
            // generic objects, i.e. <T>
            if (tokens[index + 1].value === '<' && tokens[index + 3].value === '>') {
                let genericType = tokens[index + 2].value;
                if (delphiNameToTSMap[genericType]) {
                    genericType = delphiNameToTSMap[genericType];
                }
                else if (shouldChopFirstLetter(genericType)) {
                    genericType = genericType.substring(1);
                }
                type += `<${genericType}>`;
                commentLocation = index + 4; // comment location is later in the case of a generic
            }
            // manually specified data type, e.g. functions like () => any
            if (tokens[commentLocation].type === 'comment' || tokens[commentLocation].type === 'blockComment') {
                type = tokens[commentLocation].value;
            }
            // promise of EITHER the specified data type (above^) or the default (any)
            if (isPromise) {
                return `Promise<${type}>`;
            }
            else if (isArray) {
                return `${type}[]`;
            }
            // non promise
            else {
                // Primitives and other miscellaneous types to be transformed
                if (otherNameMap[type.toLowerCase()]) {
                    return otherNameMap[type.toLowerCase()];
                }
                // all others: a-ok!
                else
                    return type;
            }

            function shouldChopFirstLetter(type) {
                return (type.startsWith('I') || type.startsWith('T'))
                    && type.length > 1 /*if it's Object<T> then type might be T*/
                    && !type.toLowerCase().startsWith('int') /*integers*/
            }
        }

        function printToken(index) {
            let token = tokens[index];
            if (!token) return 'TOKEN NOT DEFINED';
            let str = JSON.stringify(token);
            let context = originalString.substring(token.range[0] - 40, token.range[1] + 40).trim().replace(/[\n\s]+/g, ' ');
            return `\nToken: \n\t${str}. \nContext:\n\t"${context}"`;
        }
    }

    function whichIndexFirst(a, b) {
        if (a === -1) return b;
        if (b === -1) return a;
        return Math.min(a, b);
    }
}

module.exports = parseDelphi;

// If called from the command line instead of via require()
if (require.main === module) {
    let silent = false;
    for (let arg of process.argv) {
        if (arg === '--silent') {
            silent = true;
        }
    }
    parseDelphi({silent});
}