/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

// TS compilation is computationally expensive, so it's better that we do it in a child thread
const ts = require('typescript');
const path = require('path');
const fs = require('fs');
const parseDelphi = require('../parseDelphi');
const chokidar = require('chokidar');
require('colors');

const tsName =     'TS'.brightYellow;
const delphiName = 'Delphi'.brightGreen;
const pathToTs = path.join(__dirname, '..',);
const pathToBin = path.join(pathToTs, '..');
const pathToTypes = path.join(pathToBin, 'types');
const pathToDelphi = path.join(pathToBin, '..');

const formatHost = {
    getCanonicalFileName: path => path,
    getCurrentDirectory: ts.sys.getCurrentDirectory,
    getNewLine: () => ts.sys.newLine
};

// https://github.com/Microsoft/TypeScript/wiki/Using-the-Compiler-API
function watchModeTS(path, name, afterProgramCreate) {

    const configPath = ts.findConfigFile(
        path,
        ts.sys.fileExists,
        'tsconfig.json'
    );
    if (!configPath) {
        throw new Error('Could not find a valid \'tsconfig.json\'.');
    }
    const createProgram = ts.createEmitAndSemanticDiagnosticsBuilderProgram;

    // Note that there is another overload for `createWatchCompilerHost` that takes
    // a set of root files.
    const host = ts.createWatchCompilerHost(
        configPath,
        {},
        ts.sys,
        createProgram,
        reportDiagnostic,
        reportWatchStatusChanged
    );

    // You can technically override any given hook on the host, though you probably
    // don't need to.
    // Note that we're assuming `origCreateProgram` and `origPostProgramCreate`
    // doesn't use `this` at all.
    const origCreateProgram = host.createProgram;
    host.createProgram = (rootNames, options, host, oldProgram) => {
        return origCreateProgram(rootNames, options, host, oldProgram);
    };
    const origPostProgramCreate = host.afterProgramCreate;

    host.afterProgramCreate = program => {
        origPostProgramCreate(program);
        if (afterProgramCreate) afterProgramCreate();
    };

    // `createWatchProgram` creates an initial program, watches files, and updates
    // the program over time.
    let watchProgram = ts.createWatchProgram(host);

    return watchProgram;

    function reportDiagnostic(diagnostic) {
        // console.log(diagnostic);
        // console.error(`${name}: ${errorName}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, formatHost.getNewLine())}`);
        let formattedDiag = ts.formatDiagnosticsWithColorAndContext([diagnostic], {
            getCurrentDirectory: () => pathToBin,
            getCanonicalFileName: fileName => fileName,
            getNewLine: () => formatHost.getNewLine()
        })
        console.error(`${name}: ${formattedDiag}`);
    }

    /**
     * Prints a diagnostic every time the watch status changes.
     * This is mainly for messages like "Starting compilation" or "Compilation completed".
     * @param {ts.Diagnostic} diagnostic
     */
    function reportWatchStatusChanged(diagnostic) {
        console.log(`${name}: ${diagnostic.messageText}`);
    }
}

if (require.main === module) {
    
    // Parse typedoc before compiling and watching TS
    console.log(`${delphiName}: Parsing typedoc...`);
    parseDelphi({silent: true});

    // Watch the typescript dir for changes
    watchModeTS(pathToTs, tsName, () => {
        // After the incremental compilation is done, make sure to delete the outputted 'types' folder
        if (fs.existsSync(pathToTypes)) fs.rmSync(pathToTypes, { recursive: true });
    });
    
    // Watch the Delphi dir for changes (depth: 0 makes it non recursive, since all .pas files are in one folder)
    chokidar.watch(pathToDelphi, {depth: 0})
        .on('change', (path) => {
            if (path.endsWith('.pas')) {
                console.log(`${delphiName}: Change detected. Re-parsing typedoc...`);
                parseDelphi({silent: true});
            }
        })
}

