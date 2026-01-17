/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Custom extensions of the Window object.
 * @module Window
*/

'use strict';


// This code is required to proper handling of then1 when using async/await (it is using native promise instead of our customized).
Object.defineProperty(Promise.prototype, 'then1', {
    enumerable: false,
    value: function (method) {
        return this.then(method, method);
    }
});

window.webApp = (window['webAppIdentifier'] !== undefined);
window.oneSourceApp = !window.webApp && (window['appSourcesPackage'] !== undefined);
window.isStub = (window['createPromise'] === undefined); // createPromise is created in global scope right after app start

window.settings = {
    browser: {
        isOpera: !!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0,
        // Opera 8.0+ (UA detection to detect Blink/v8-powered Opera)
        isFirefox: typeof InstallTrigger !== 'undefined', // Firefox 1.0+
        isSafari: Object.prototype.toString.call(window.HTMLElement).indexOf('Constructor') > 0,
        // At least Safari 3+: "[object HTMLElementConstructor]"
        isChrome: !!window.chrome && !this.isOpera, // Chrome 1+
        isIE: /*@cc_on!@*/ false || !!document.documentMode, // At least IE6
        isEdge: navigator.userAgent.indexOf(' Edge/') >= 0,
    },
    disableCache: false, // Change to true if you want to debug leaks (with disabled UI cache)
    UI: {
        canEdit: !webApp, // whatever editations, is in "read only" mode when false
        canDelete: !webApp, // whatever deletions (track, album, etc)
        canDragDrop: true,
        canReorder: true, // items re-ordering (e.g. in list view)
        hideMenu: false,
        disableRepositioning: false, // repositioning of UI controls (e.g. changing size or visibility)
        disablePlayerControls: {
            play: false,
            pause: false,
            stop: false,
            next: false,
            previous: false,
            volume: false,
            seek: false,
            playTo: false,
            repeat: false,
            shuffle: false,
            crossfade: false
        },
        tabs: true, // tabs support
        useSharedWindows: true && !webApp,
        //dockableDialogs: true,
        mediaTree: {
            showAllNodes: true, // ahows all subnodes like in MM4 (including individual albums) -- default changed to true in #18272
            enableSearch: false, // performs 'Scroll to match within tree', i.e. mediaTree.enableIncrementalSearch (#17810)
            autoExpand: false // auto-expands to nodes when navigating outside of tree
        },
        store: () => {
            if (app.inPartyMode)
                app.setValue('UI_SETTINGS_PARTY', window.settings.UI);
            else {
                app.setValue('UI_SETTINGS_GLOBAL', 'old value deprecated because of bug #16386 / item 4');
                app.setValue('UI_SETTINGS', window.settings.UI);
            }
        },
        restore: () => {
            if (!window.isStub) {
                if (app.inPartyMode)
                    window.settings.UI = app.getValue('UI_SETTINGS_PARTY', window.settings.UI);
                else
                    window.settings.UI = app.getValue('UI_SETTINGS', window.settings.UI);

                // see rationale for the default in Mantis issue #17810
                if (window.settings.UI.mediaTree.enableSearch == undefined)
                    window.settings.UI.mediaTree.enableSearch = window.settings.UI.mediaTree.showAllNodes;
            }
        }
    },
    init: function (this: WindowSettings) {
        let ObservableObject: typeof import('./helpers/observableObject').default = window['ObservableObject'];
        this.observer = new ObservableObject();
        app.listen(app, 'settingsChange', function (this: WindowSettings) {
            this._settingsCache = {};
            if (!isMainWindow)
                window.settings.UI.restore(); // so party settings is updated in external players
            this.observer.notifyChange();
        }.bind(this));
    },
    get: function (filter) {
        // this gets the values stored in MediaMonkey.ini
        // !!! for getting values from persistent.JSON use app.getValue() method !!!
        this._settingsCache = this._settingsCache || {};
        if (!filter)
            filter = '';
        let key = filter;
        if (key == '')
            key = 'all';
        if (!this._settingsCache[key])
            this._settingsCache[key] = JSON.parse(app.settings.getJSON(filter));
        return this._settingsCache[key];
    },
    set: function (value, filter) {
        // passes the values to be stored in MediaMonkey.ini
        // !!! for storing values to persistent.JSON use app.setValue() method !!!
        if (!filter)
            filter = '';
        this._settingsCache = {};
        app.settings.setJSON(JSON.stringify(value), filter);
    },
    clearCache: function () {
        this._settingsCache = {};
    },
    _settingsCache: undefined,
    observer: undefined,
    readyTime: -1,
};

/**
Miscellaneous UI tools. Most can be found in actions.js. Not all are included in the API documentation.
@class uitools
@static
 */

window.uitools = window.uitools || {};

/**
Whether the user is currently allowed to modify things like track properties. False when in Party Mode.
@for uitools
@method getCanEdit
@returns {boolean} 
 */
window.uitools.getCanEdit = function () {
    return window.settings.UI.canEdit;
};
/**
Whether the user is currently allowed to delete items.
@for uitools
@method getCanDelete
@returns {boolean}
 */
window.uitools.getCanDelete = function () {
    return window.settings.UI.canDelete;
};
/**
Get either the helpContext of a controlClass or the data-help attribute of an element.
@for uitools
@method getHelpContext
@param {HTMLElement} el
@returns {string} The help context of the element.
 */
window.uitools.getHelpContext = function (el) {
    if (el.controlClass) {
        if (isFunction(el.controlClass.helpContext)) {
            return el.controlClass.helpContext();
        } else
            return el.controlClass.helpContext || el.getAttribute('data-help') || '';
    } else
        return el.getAttribute('data-help') || '';
};
window.settings.UI.restore();
let usedLang = app.utils.getUsedLanguage(); // cache used language to set element.lang correctly because of asian languages #19606

/**
@for Window
 */


declare function addPassiveOption(capture: any): any;
declare function passiveSupported(): boolean;
declare function alertInetException(url: string, error: any);
declare function _alert(msg: string, scriptName?: string): void;
declare function requiredListen(obj: any, listener: any, func: any, capture?: any);
declare function recallRequired();

declare function registerLocalCleanup(func);
declare function registerStyleCleanup(func);
declare function doLocalCleanup();
declare function doStyleCleanup();

declare function logMemoryStats();

(function () {
    let localCleanUpMethods = [];
    let styleCleanUpMethods = [];

    window.registerLocalCleanup = function(func) {
        localCleanUpMethods.push(func);
    };

    window.doLocalCleanup = function() {
        localCleanUpMethods.forEach((func) => {
            func();
        });
    };

    window.registerStyleCleanup = function(func) {
        styleCleanUpMethods.push(func);
    };

    window.doStyleCleanup = function() {
        styleCleanUpMethods.forEach((func) => {
            func();
        });
    };

    let requiredListeners = [];
    window.requiredListen = (obj, listener, func, capture) => {
        requiredListeners.push({
            obj: obj,
            listener: listener,
            func: func,
            capture: capture});
        app.listen(obj,listener,func,capture);
    };
    window.recallRequired = () => {
        requiredListeners.forEach((item) => {
            app.listen(item.obj,item.listener,item.func,item.capture);
        });
    };

    // Test via a getter in the options object to see if the passive property is accessed
    let supportsPassive = false;
    try {
        let opts = Object.defineProperty({}, 'passive', {
            get: function () {
                supportsPassive = true;
            }
        });
        window.addEventListener('testPassive', null, opts);
        window.removeEventListener('testPassive', null, opts);
    } catch (e) { /* */ }

    window.passiveSupported = function () {
        return supportsPassive;
    };

    window.addPassiveOption = function (capture) {
        if (window.passiveSupported())
            return {
                passive: true,
                capture: (capture !== undefined) ? capture : false
            };
        else
            return (capture !== undefined) ? capture : false;
    };

    let lastLineNumber = undefined;

    window.alertInetException = function (url, error) {
        // for now, ignore all (external script) errors except those from Youtube
        if (url.indexOf('https://www.youtube.com/') === 0) {
            // use only ODS, the error does not always causes problem with playback, error message could be confusing
            ODS('Youtube script error: ' + error.message + ', script: ' + error.scriptResourceName + ', line: ' + error.lineNumber);
        } else
            ODS('External script error: ' + error.message + ', URL: ' + url + ', script: ' + error.scriptResourceName + ', line: ' + error.lineNumber);
    };

    window.onerror = function (msg, url, line, column, errorObj) {

        if (!url && !window['__currentFile'])
            return; // LS: not enough info, let it bubble further (e.g. to "unexpected JSON input" like in case of #18603) to show more accurate callstack/problem

        // JL: added ODS catch so that we can see when there's an error with the window initialization
        if (('ODS' in window) && app.utils)
            ODS('window.onerror: ' + msg + ', ' + url + ', ' + line + ', ' + column + ', ' + errorObj + ', called from ' + app.utils.logStackTrace());        

        let addStr = '';
        let addonName = '';
        let crashLines = '';
        let crashSource: string[] | undefined = undefined;
        let crashLine = line || -1;
        if (window['__currentFileLoad']) {
            addStr = 'Call requirejs(' + window['__currentFileLoad'] + ') failed';
        }

        if (window['__lastScriptName']) {
            addonName = window['__lastScriptName'];
        }

        // get source file where it crashed (to show row where it crashed)
        if (window['__currentFile']) {
            crashSource = window['__currentFile'].split('\n');
        } else {
            if (app && app.filesystem) { // in crash C4910CDA the app.filesystem was undefined (thus the crash source cannot be loaded)
                assert(url, 'URL is not defined');
                let fileContent = loadFile(url); // filename            
                crashSource = fileContent.split('\n');
            }
        }

        // get crash row
        if (crashSource) {
            if (crashSource.length > crashLine) {
                if (!addonName) {
                    let re = new RegExp('(var __scriptName = window\\[\\"__lastScriptName\\"\\] = \\")(.*?)\\"', 'igm');
                    for (let i = crashLine - 1; i >= 0; i--) {
                        let arrMatches = re.exec(crashSource[i]);
                        if (arrMatches && arrMatches.length) {
                            addonName = arrMatches[2];
                            break;
                        }
                    }
                }

                for (let i = crashLine - 5; i < crashLine + 5; i++)
                    if (crashSource[i])
                        crashLines = crashLines + (i + 1) + '. ' + crashSource[i] + '\n';
            }
        }

        if (addonName) {
            addStr = addStr + ' in addon "' + addonName + '"';
        }
        if (crashLine) {
            addStr = addStr + ' at line ' + crashLine;
        }
        if (addStr) {
            addStr = addStr + '!!';
        }

        if (crashLines) {
            addStr = addStr + '\n\nSource code:\n' + crashLines;
        }

        if (errorObj) {
            alertException(errorObj, addStr);
        } else {
            myAlert(msg + '\nScript: ' + url + '\nLine: ' + crashLine + '\nColumn: ' + column + ((addStr !== undefined) ? '\n' + addStr + '\n' : ''));
        }
    };

    window.onunhandledrejection = function(e: PromiseRejectionEvent) {
        if (app.tests)
            myAlert('Unhandled Rejection :' + e.reason.stack);
        else    
            ODS('Unhandled Rejection :' + e.reason.stack);
    };
    
    if (window.webApp) {
        window._alert = function (msg: string, scriptName?: string) {
            console.log(msg, scriptName);
        };

        window.alert = function (msg: string, scriptName?: string) {
            _alert(msg, scriptName);
        };
    }

    window.myAlert = function (str) {
        let silentTest = window.qUnit && app.tests && app.tests.silent();
        if (!silentTest) {
            if (typeof _alert === 'function') {
                _alert(str, window['__lastScriptName']);
            } else {
                alert(str);
            }
        } else {
            app.tests.addTestFailureInfo('failed', str);
        }
    };

    window.alertException = function (exception, addedInfo) {
        myAlert(getMessageWithStack(exception) + ((addedInfo !== undefined) ? '\n' + addedInfo + '\n' : ''));
    };

    window.getMessageWithStack = function (exception: Error) {
        let ExceptionLimit = 5000;
        let line = lastLineNumber;
        if (exception.stack !== undefined) {
            return '"' + exception.message.slice(0, ExceptionLimit) + '"' + (line ? ' at line ' + line : '') + '\n\n' + exception.stack.slice(0, ExceptionLimit);
        }
        if (exception.message !== undefined)
            return '"' + exception.message.slice(0, ExceptionLimit) + '"\n\n' + new Error().stack;
        else
            return '\n\n' + new Error().stack;
    };

})();

let idleInterval = setInterval(function () {
    app.idle();
}, 10000);

function getDocumentBody() {
    assert(document.body, 'Required document.body does not exist yet!');
    return document.body;
}

/**
 * A MUTABLE object (reused throughout an {@link asyncLoop} call) containing info about the currently processing asyncLoop.
 */
type AsyncLoopToken = {
    /**
     * Whether to cancel the loop next
     */
    cancel?: boolean;
    /**
     * how long really took setTimeout to run this code
     */
    __lastTime: number;
}

/**
Call function repeatedly while not fully blocking the main JS thread. It's useful for execution of loops that can take some time process and we don't want to block the main thread completely (and don't want to start a new thread either).
@example

    asyncLoop( function(i) {
        if (i >= arr.length)
            return false;
        else {
            arr[i].processIt;
        }
    });

@method asyncLoop
@param fn Function to be called with counter as a first parameter and token as a second parameter starting from second parameter of this function. Returns true when all operations are complete or false when new loop is needed.
@param valFrom Starting counter value
@param token Token. An object with cancel property to cancel loop
@param finishedCallback Function to be called when all operations are done (main function from first parameter returns true) with parameters - counter, token.
*/
function asyncLoop(
    fn: (idx: integer, token?: AsyncLoopToken) => boolean,
    valFrom?: integer, token?: AsyncLoopToken,
    finishedCallback?: ((idx: integer, token?: AsyncLoopToken) => void)
) {
    let i = valFrom || 0;
    let startTime = performance.now();
    let lastTime = (token && token.__lastTime) || 0;

    while (true) {
        if ((token && token.cancel) || window._cleanUpCalled)
            break;
        if (!fn(i++, token)) { // function returned false - need another loop
            if (performance.now() - startTime > 1) {

                let usedTimeout = Math.min(lastTime, 5);
                let currTm = performance.now();

                requestTimeout(function () {
                    if (token) {
                        // how long really took setTimeout to run this code
                        token.__lastTime = Math.max(Math.floor(((performance.now() - currTm - usedTimeout) / 10)) - 1, 0);
                        //ODS( 'asyncLoop time '+token.__lastTime);
                    }

                    asyncLoop(fn, i, token, finishedCallback);
                }, usedTimeout);
                break;
            }
        } else {
            if (finishedCallback)
                finishedCallback(i, token);
            break;
        }
    }
}
window.asyncLoop = asyncLoop;

/**
Uses generator function to be asynchronously called until completed (or canceled by canceling the promise).

@method asyncGenerator
@param {Function} fn Generator function to be called
@return {Promise} 
*/
function asyncGenerator(fn) {
    let generator = fn();

    const promise = new Promise(function (resolve, reject) {
        function processSteps() {
            if (promise.canceled) {
                reject();
                return;
            }

            let step = generator.next(); // JH: To do more steps here, until some timeout (specified by a parameter)?
            if (step.done)
                resolve(undefined);
            else
                setTimeout(processSteps, 0);
        }

        setTimeout(processSteps, 0); // JH: To be (optionally) replaced by a requestAnimationFrame call?
    });

    return promise;
}

let requirePrefix = !oneSourceApp;
let filePrefix = 'file:///';

if (window.isStub) {
    if (window.location.href.indexOf('http://') != -1) {
        filePrefix = window.location.href.slice(0, window.location.href.lastIndexOf('/') + 1);
        requirePrefix = (filePrefix.indexOf('http://') != -1);
    } else {
        requirePrefix = false;
    }
}

function fixFile(fname) {
    let prefixSize = filePrefix.length;
    if (fname.slice(0, 8) === 'file:///')
        fname = fname.slice(8);
    if (webApp) {
        if (fname.indexOf(getRootURL()) >= 0) {
            fname = fname.slice(getRootURL().length);
        }
    } else {
        if (requirePrefix) {
            if ((fname.slice(0, prefixSize) !== filePrefix) && (fname.slice(0, 4) !== 'http'))
                fname = filePrefix + fname;
        } else {
            if (fname.slice(0, prefixSize) === filePrefix)
                fname = fname.slice(prefixSize);
        }
    }
    if (window.extendedFixFile)
        fname = window.extendedFixFile(fname);
    return fname;
}

function lowerFirstLetter(string) {
    return string.charAt(0).toLowerCase() + string.slice(1);
}

function createNewCustomEvent(eventName: string, params: any) {
    let event: CustomEvent;
    if (window.settings.browser.isIE || window.settings.browser.isEdge || window.settings.browser.isSafari) {
        event = document.createEvent('CustomEvent');
        event.initCustomEvent(eventName, params.cancelable, params.bubbles, params.detail);
        event.returnValue = true;
    } else {
        event = new CustomEvent(eventName, params);
    }
    return event;
}
window.createNewCustomEvent = createNewCustomEvent;

function createNewEvent(eventName) {
    let event: Event;
    if (window.settings.browser.isIE || window.settings.browser.isEdge || window.settings.browser.isSafari) {
        event = document.createEvent('Event');
        event.initEvent(eventName, true, true);
    } else {
        event = new Event(eventName);
    }
    return event;
}
window.createNewEvent = createNewEvent;

function updateLoadedFile(fname, content): typeof content {
    return content;
}

type LoadFileRequest = {
    statusTest: string;
    responseText: string;
    getResponseHeader: (...params) => string;
}

/**
 * Loads file content (synchronously).
 * @param fname File name or path
 * @param callback Callback to fire 
 * @param params 
 * @returns 
 */
function loadFile(fname: string, callback?: (contents: string, request?: LoadFileRequest) => void, params?: any): string {
    const async = (callback !== undefined);
    let parseParam = function (param, def) {
        if (!params) {
            return def;
        } else {
            return resolveToValue(params[param], def);
        }
    };
    let isEmpty = fname === '';

    fname = fixFile(fname);

    let required = parseParam('required', true);

    let myCallback;
    if (async) {
        myCallback = function (request) {
            if (request.statusText != 'NOT FOUND' || !required)
                callback(updateLoadedFile(fname, request.responseText), request);
            else {
                myAlert('File: ' + fname + ' can\'t be loaded! (' + request.statusText + ')');
                return '';
            }
        };
    }
    
    let response: SharedResponse;

    if (!window._cleanUpCalled || parseParam('alwaysLoad', false)) {
        response = app.filesystem.loadSkinFile({
            file: fname,
            callback: myCallback
        });
    } else {
        if (async && myCallback) {
            myCallback({
                statusTest: 'OK',
                responseText: '',
                getResponseHeader: function () {
                    return '';
                }
            });
        } else {
            return '';
        }
    }
    if (!async) {
        if (response.statusText != 'NOT FOUND' || !required)
            return updateLoadedFile(fname, response.responseText);
        else {
            if (!isEmpty)
                myAlert('File: ' + fname + ' can\'t be loaded! (' + response.statusText + ')');
            return '';
        }
    }
    return '';
}
window.loadFile = loadFile;

// get root folder of this document
function getRootURL() {
    if (!window.rootURL) {
        window.rootURL = document.URL;
        let i = rootURL.lastIndexOf('/');
        if (i >= 0)
            rootURL = rootURL.slice(0, i + 1);
    }
    return rootURL;
}

/**
Includes a JS file. Uses window.eval(), so that the content is executed in the 'window' context and also immediatelly available for the following code. 
'.js' extension isn't necessary and is added if missing. Duplicates (including those from &lt;script&gt; tag) are automatically ignored.

@method requirejs
@param files File or a list of files to be included
@param callback Function to be called when the inclusion is complete
@param isolate Indicates whether the script code should be loaded as isolated, so that its global variables don't interfere with other scripts (useful for custom scripts)
@param local
@param reload
*/
declare function requirejs(files: string | string[], callback?: callback, isolate?: boolean, local?: string, reload?: boolean);
declare function localRequirejs(files: string, callback?: callback, isolate?: boolean): void;
declare function registerFileImport(file: string);
declare function registerClass(controlClass: any);

(function () {
    let loadedScripts: string[] = [];
    let importedScripts: string[] = [];
    let scannedCount = 0;

    // Import scripts from <script> tag present in the document.
    // Note that we have to repeat it on each request, since they are processed sequentially and so they are available as the HTML parser processes the file.
    // TODO: We could stop calling this code after DOM loaded event, because not more scripts are loaded then?
    function initLoadedScripts() {
        let scripts = document.getElementsByTagName('script');
        for (let i = scannedCount; i < scripts.length; i++) {
            let script = scripts[i];
            if (typeof script.src == 'string' && script.src.length > 0) {
                if (script.src.startsWith('file:')) {
                    loadedScripts.push(script.src.slice(8 /* file:/// */).toLowerCase());
                } else {
                    loadedScripts.push(script.src.slice(getRootURL().length).toLowerCase());
                }
            }
        }
        scannedCount = scripts.length;
    }

    function createDevToolsSource(url) {
        if (window.prepareSourceURL)
            url = window.prepareSourceURL(url);
        return String.fromCharCode(13) + String.fromCharCode(10) + ' //# sourceURL=' + url; // add source map to support dynamic script debugging 
    }

    window.reloadScript = function (fn) {
        fn = fn.toLowerCase();
        loadedScripts = loadedScripts.filter((item) => !item.includes(fn));
    };
    function normalizeFileImport(file, local) {
        if (file.slice(-3) != '.js')
            file = file + '.js';
        if (local) {
            if (file.slice(0, 8) === 'file:///')
                file = 'file:///' + local + '/' + file.substring(8, file.length); // #18654
            else
                file = local + '/' + file;
        }
        file = fixFile(file);
        return file;
    }
    function registerFileImport(file) {
        //window.callODS('registerFileImport: ' + file);
        if (file.startsWith('/'))
            file = file.substr(1);
        let lowFile = normalizeFileImport(file, false).toLowerCase();
        if (importedScripts.indexOf(lowFile) < 0) {
            importedScripts.push(lowFile);
            //window.callODS('registerFileImport: REGISTERED :' + lowFile);
        } else {            
            //window.callODS('registerFileImport ALREADY IMPORTED: ' + lowFile);
        }
    }
    window.registerFileImport = registerFileImport;

    function registerClass(controlClass) {
        let className = controlClass.prototype.constructor.name;
        window[className] = controlClass; // store to window object (for data-control-class initializations)
    }
    window.registerClass = registerClass;

    function _checkFileImportsInitialized() {
        // LS: register common file imports -- so that they are not loaded via requirejs() later
        if (!window._fileImportsInitialized) {
            window._fileImportsInitialized = true;
            let str = loadFile('file:///commonControls.js');
            str = str.split('import ').join('registerFileImport(');
            str = str.split('\';').join('\');');
            window.eval(str);
            if (window.isMainWindow || window.qUnit) {
                str = loadFile('file:///mainWindowControls.js');
                str = str.split('import ').join('registerFileImport(');
                str = str.split('\';').join('\');');
                window.eval(str);
            }
        }
    }

    function requirejs(files: string | string[], callback?: callback, isolate?: boolean, local?: string, reload?: boolean) {
        let fileArr: string[];
        if (typeof files === 'string')
            fileArr = [files];
        else
            fileArr = files;

        let _reloadNeeded = (!window.webApp && !oneSourceApp) || reload;

        _checkFileImportsInitialized();

        fileArr.forEach(function (file) {
            file = normalizeFileImport(file, local);
            let lowFile = file.toLowerCase();
            if ((loadedScripts.indexOf(lowFile) < 0) && _reloadNeeded) {
                initLoadedScripts();
                _reloadNeeded = false;
            }

            if (((loadedScripts.indexOf(lowFile) < 0) || reload) && (importedScripts.indexOf(lowFile) < 0)) {
                loadedScripts.push(lowFile);
                window.callODS('requirejs on file: ' + lowFile);
                let content = loadFile(file);

                let devToolsSource = createDevToolsSource(file);

                // PETR: handle eval error in onerror handler, where we have line number of the error so we can show the code
                window['__lastScriptName'] = undefined;
                window['__currentFileLoad'] = file;
                window['__currentFile'] = content;

                if (window.beforeRequireJSEval)
                    window.beforeRequireJSEval();

                if (isolate)
                    window.eval('(function () {' + content + '})();' + devToolsSource);
                else
                    window.eval(content + devToolsSource);

                if (window.afterRequireJSEval)
                    window.afterRequireJSEval();

                window['__currentFileLoad'] = undefined;
                window['__currentFile'] = undefined;
                window['__lastScriptName'] = undefined;
            }
        });

        if (typeof callback === 'function')
            callback();
    }
    window.requirejs = requirejs;

    window.localRequirejs = function (files, callback, isolate) {
        requirejs(files, callback, isolate, __scriptName);
    };
})();

if (isStub || oneSourceApp) {
    // stub can have different loader
    if (window.customLoader !== undefined) {
        window._old_loadFile = window.loadFile;
        window.loadFile = window.customLoader;
    }
    if (!oneSourceApp)
        requirejs('mmstub');
}

/**
Merges two objects into the first one, props of object2 overrides object1 props/methods
@method concatObjects
@param {Object} o1 object1
@param {Object} o2 object2
@return {Object} merged object1
*/
function concatObjects(o1: object, o2: object) {
    for (let key in o2)
        o1[key] = o2[key];
    return o1;
}
if (!window.concatObjects)
    window.concatObjects = concatObjects;

(function () {
    let __windowListeners = [];
    let __windowPromises = [];

    /**
    This method is pretty similar as app.listen(), but app.unlisten() is called automatically in window.cleanupDocument()

    @method localListen
    @param {object} object Object where to set listener
    @param {string} eventName Event name of the listener
    @param {eventCallback} func Method for callback dispatch
    @param {boolean} [capture] Capture?
    */
    window.localListen = function (object, eventName, func, capture) {

        if (window.notifyListenCall)
            window.notifyListenCall(object, eventName, func, capture);

        __windowListeners.push({
            _object: object,
            _name: eventName,
            _capture: capture,
            _method: app.listen(object, eventName, func, capture),
            unlisten: function () {
                if (this._name) {
                    app.unlisten(this._object, this._name, this._method, this._capture);
                    this._name = '';
                }
            }
        });
    };

    window.unlistenLocalListeners = function () {
        __windowListeners.forEach(function (item) {
            item.unlisten();
        });
        __windowListeners = [];

    };

    window.localPromise = function (promise) {
        let _uid = createUniqueID();
        let pr = promise.then1(function (e) {
            __windowPromises[_uid] = undefined;
            return e;
        });
        __windowPromises[_uid] = promise;
        return promise; // return the original promise, not the pr (as pr does not reject because of then1 usage)
    };

    window.cleanUpLocalPromises = function () {
        for (let ids in __windowPromises) {
            if ((__windowPromises[ids]) && (isPromise(__windowPromises[ids]))) {
                cancelPromise(__windowPromises[ids]);
            }
        }
        __windowPromises = [];
    };


})();

let layoutHandlingActive = false;

(function () {
    // #18600: Methods to reduce forced reflow. Provided callbacks will fire at the end of an 
    //  animation frame (via requestFrame) and at the end of a layout change (notifyLayoutChangeDown).

    let _callbacksQueue = {
        frameCallbacks: {},
        layoutQueryCallbacks: [],
        stylingCallbacks: []
    };

    // Note: Added in 5.0.3 (four below methods)
    window.queryLayoutAfterFrame = function (callback) {
        if(layoutHandlingActive)
            _callbacksQueue.layoutQueryCallbacks.push(callback);
        else // called outside notifyLayoutChangeDown or requestFrame, in such case we have to call it immediatelly, as there are no apply callbacks calls
            callback();
    };

    window.applyStylingAfterFrame = function (callback) {
        if(layoutHandlingActive)
            _callbacksQueue.stylingCallbacks.push(callback);
        else // called outside notifyLayoutChangeDown or requestFrame, in such case we have to call it immediatelly, as there are no apply callbacks calls
            callback();

    };

    window._applyLayoutQueryCallbacks = function () {
        let i = 0;
        for (let cb of _callbacksQueue.layoutQueryCallbacks) {
            performance.mark(`callback_${i}`);
            cb();
            if (i > 0) performance.measure(`callback_${i}`, `callback_${i - 1}`, `callback_${i}`);
            i++;
        }
        _callbacksQueue.layoutQueryCallbacks = [];
    };

    window._applyStylingCallbacks = function () {
        for (let cb of _callbacksQueue.stylingCallbacks)
            cb();
        _callbacksQueue.stylingCallbacks = [];
    };
})();

declare var fullWindowModeActive: boolean;

(function () {
    let notVisibleTimeout = 500;
    let notActiveTimeout = 30;

    let windowIsVisible = isStub;
    let windowIsActive = isStub;

    let lastFrameRenderStart = 0;
    let lastWindowState = -1;
    
    let _fullWindowModeActive = false;
    let _sleepSuppressActive = false;

    let checkSleepModeSuppression = function () {
        if(!_sleepSuppressActive) {
            if(_fullWindowModeActive && windowIsVisible && windowIsActive) {
                _sleepSuppressActive = true;
                app.utils.disableComputerSleep();
            }
        } else {
            if(!_fullWindowModeActive || !windowIsVisible || !windowIsActive) {
                _sleepSuppressActive = false;
                app.utils.enableComputerSleep();
            }
        }
    };

    Object.defineProperty(window, 'fullWindowModeActive', {
        set: function (val) {
            if((window.document && window.document.body && _fullWindowModeActive !== val))
                window.document.body.classList.toggle('fullWindowModeActive', !!val);
            if(_fullWindowModeActive !== val) {
                _fullWindowModeActive = val;
                checkSleepModeSuppression(); // #21269
            }
        },
        get: function () {
            return _fullWindowModeActive;
        }
    });

    requiredListen(window.thisWindow, 'visibilityChanged', function (minimized, hidden, state) {
        windowIsVisible = !minimized && !hidden;
        ODS('Main window is ' + (minimized ? 'minimized' : 'not minimized') + ' and ' + (hidden ? 'hidden' : 'not hidden'));
        if(lastWindowState !== state && window.document && window.document.body) {
            window.document.body.toggleAttribute('data-maximized', (state===2));
            lastWindowState = state;
        }
        checkSleepModeSuppression(); // #21269
    });

    requiredListen(window.thisWindow, 'activated', function (active) {
        windowIsActive = active;
        usingKeyboard = false;
        if(window.document && window.document.body)
            window.document.body.classList.toggle('inactive', !active);
        checkSleepModeSuppression(); // #21269
    });

    let queueRequest = function (func) {
        // JL for 5.0.3: make queueRequest return the token + 0.5, so we can identify a timeout token vs an animation frame token.
        return setTimeout(function () {
            lastFrameRenderStart = performance.now();
            if (window.reloading) return;
            func();
        }, (!windowIsVisible) ? notVisibleTimeout : notActiveTimeout) + 0.5;
    };

    window.requestAnimationFrameMM = function (callback) {
        if (windowIsVisible) {

            if (!windowIsActive) {
                return queueRequest(callback);
            } else {
                let mycall = function (starttime) {
                    lastFrameRenderStart = starttime;
                    if (window.reloading) return;
                    callback();
                };

                //lastFrameRenderStart = performance.now();
                return requestAnimationFrame(mycall);
            }
        } else {
            return queueRequest(callback);
        }
    };

    /**
     * <b>[ADDED IN VERSION 5.0.3]</b><br> Cancel a frame returned by window.requestFrame() or window.requestAnimationFrameMM(). 
     * Because the token type of requestAnimationFrameMM can either be that of a Timeout or an AnimationFrame, you must use this method instead of cancelAnimationFrame() to guarantee that it is cancelled.
     * @example
     * 
     *      var token = requestFrame(myCall);
     *      cancelFrame(token);
     * @method cancelFrame
     * @param {number} token 
     */
    window.cancelFrame = function (token) {
        if (Number.isInteger(token))
            cancelAnimationFrame(token);
        else
            clearTimeout(token);
    };

    window.getFrameRenderDuration = function () {
        return performance.now() - lastFrameRenderStart;
    };

})();

function requirejsDeferred(fname: string) {
    let fileref = document.createElement('script');
    fileref.setAttribute('type', 'text/javascript');
    fileref.setAttribute('src', fname);
    document.head.appendChild(fileref);
}

// ===== ICONS =====

function setIconFast(div: HTMLElement, icon: SVGElement) {
    if (div) {
        div.innerHTML = ''; // to prevent from doubling the icon
        if (icon) // icon loaded successfully, append it
            div.appendChild(icon);
    }
}

/**
Loads a specific SVG file from 'skin/icon' folder. Handles duplicate requests and asynchronous loading. Instead of returning the SVG code, this method provides a live DOM element, which is faster.

Doesn't need to be called directly as it's automatically used by HTML like

    <div data-icon=’closeTab’></div>

The loaded icon can be further styled by CSS, e.g.

    fill: red;

@method loadIconFast
@param iconName Name of the icon to load, without extension, e.g. 'close'.
@param callback Function to call, when icon content is loaded.
@return SVG element.
*/
declare function loadIconFast(iconName: string, callback?: Callback<SVGElement | undefined>): SVGElement | undefined;

/**
Loads a specific SVG file from 'skin/icon' folder. Handles duplicate requests and asynchronous loading. Returns the SVG code, not a live DOM element.

Doesn't need to be called directly as it's automatically used by HTML like

    <div data-icon=’closeTab’></div>

The loaded icon can be further styled by CSS, e.g.

    fill: red;

@method loadIcon
@param iconName Name of the icon to load, without extension, e.g. 'close'.
@param callback Function to call, when icon content is loaded.
@return SVG code. Use innerHTML to create the icon.
*/
declare function loadIcon(iconName: string, callback?: Callback<string>)

(function () {
    let loadedIconsHTML: Dictionary<string> = {};
    let loadingIcons: Dictionary<
        Array<
            Callback<string>
            | undefined
        >
    > = {};
    let loadedIconsDOM: Dictionary<SVGElement | ''> = {};
    let loadingIconsFast: Dictionary<
        Array<
            Callback<SVGElement | undefined>
            | undefined
        >
    > = {};

    registerLocalCleanup(() => {
        loadedIconsHTML = {};
        loadingIcons = {};
        loadedIconsDOM = {};
        loadingIconsFast = {};
    });

    window.loadIconFast = function (iconName: string, callback?: Callback<SVGElement | undefined>): SVGElement | undefined {
        if (iconName === undefined || iconName === '') return;
        let loadedIcon = loadedIconsDOM[iconName];
        if (loadedIcon !== undefined) {
            let clone;
            if (loadedIcon) {
                clone = loadedIcon.cloneNode(true);
                if (callback)
                    callback(clone);
            } else { // icon not found
                if (callback)
                    callback(undefined);
            }
            return;
        }
        let inProgress = loadingIconsFast[iconName];
        if (inProgress) {
            inProgress.push(callback);
        } else {
            loadingIconsFast[iconName] = [callback];

            loadIcon(iconName, function (iconCode) {
                if (!window._cleanUpCalled) {
                    // Create the SVG item from the code, and save it in loadedIconsDOM
                    let parent = document.createElement('div');
                    parent.innerHTML = iconCode;
                    let svg = parent.querySelector('svg');
                    if (!svg) {
                        loadedIconsDOM[iconName] = ''; // indication, that icon does not exist, do not try to load it next time
                        loadingIconsFast[iconName].forEach(function (cbk) {
                            if (cbk)
                                cbk(undefined);
                        });
                    } else {
                        parent.removeChild(svg);
                        loadedIconsDOM[iconName] = svg;
                        // Now, clone the icon & return for each of the loading requests
                        let clone;
                        loadingIconsFast[iconName].forEach(function (cbk) {
                            if (cbk && svg) {
                                clone = svg.cloneNode(true);
                                cbk(clone);
                            }
                        });
                    }
                }
                delete loadingIconsFast[iconName];
            });
        }
    };

    window.loadIcon = function (iconName: string, callback?: Callback<string>): void {
        if (iconName === undefined || iconName === '') return;
        let loadedData = loadedIconsHTML[iconName];
        if (loadedData) {
            if (callback)
                callback(loadedData);
            return;
        }

        let inProgress = loadingIcons[iconName];
        if (inProgress) {
            inProgress.push(callback);
        } else {
            loadingIcons[iconName] = [callback];
            let loadIconName = iconName;
            if (loadIconName.indexOf('/') == -1 && loadIconName.indexOf('\\') == -1) {
                loadIconName = 'skin/icon/' + loadIconName;
            }
            if (loadIconName.indexOf('.svg') == -1) {
                loadIconName = loadIconName + '.svg';
            }
            if (!isStub && !oneSourceApp)
                loadIconName = 'file:///' + loadIconName;
            loadFile(loadIconName, function (data) {
                // mark icon with data-hasSVGAnimation when animated (to improve performance when hiding divs in LV)
                if (data.toLowerCase().includes('<animate')) {
                    data = data.replace('<svg', '<svg data-hasSVGAnimation');
                }
                loadedIconsHTML[iconName] = data;
                if (!window._cleanUpCalled && loadingIcons[iconName]) {
                    loadingIcons[iconName].forEach(function (cbk) {
                        if (cbk)
                            cbk(data);
                    }); // Call all registered callbacks
                }
                delete loadingIcons[iconName];
            }, {
                required: false /* do not throw critical error, when icons is not found (log it instead) */
            });
        }
    };
})();

/**
Returns class with all named elements inside the specified rootElement (document is used when not defined) to direct access.
Script can then do not need to call qid for any named element. 
@example

    var UI = getAllUIElements();
    UI.lvTracklist.controlClass.dataSource = data;

@method getAllUIElements
@param {HTMLElement} [rootElement] element
@return class with named elements
*/
function getAllUIElements(rootElement?: HTMLElement): { [key: string]: HTMLElement } {
    let ret = {};
    let root = rootElement || document;
    let elements = qes(root, '[data-id]');
    if (elements) {
        forEach(elements, function (el) {
            ret[el.getAttribute('data-id')] = el;
        });
    }
    return ret;
}

/**
Returns the first document element for the selector. It's recommended to use more specific functions when possible, e.g. {@link qid}, since its
faster than a generic selector usage.

@method q
@param {string} s Selector
@return {HTMLElement|null} Element found
*/
function q(s) {
    return document.querySelector(s);
}

/**
Returns all document elements for the selector.

@method qs
@param s Selector
@return Elements found
*/
function qs(s: string): NodeListOf<HTMLElement> {
    return document.querySelectorAll(s);
}

/**
Returns the first document element for the given ID.

@method qid
@param {string} id ID of the requested element
@return {HTMLElement} Element found
*/
function qid(id) {
    return qe(document, '[data-id=' + id + ']');
}

/**
Returns all elements for the given class.

@method qclass
@param {string} cls Class name of the requested elements
@return {HTMLCollectionOf<Element>} Elements found
*/
function qclass(cls) {
    return document.getElementsByClassName(cls);
}


/**
Returns all elements for the given class, starting from a particular element.
@method qeclass
@param {HTMLElement} e Element to search within
@param {string} cls Class name of the requested elements
@returns {HTMLCollectionOf<Element>} Elements found
 */
function qeclass(e, cls) {
    return e.getElementsByClassName(cls);
}

/**
Returns all elements for a given tag name
@method qtag
@param {string} tg Tag name
@returns {HTMLCollectionOf<Element>} Elements found
 */
function qtag(tg) {
    return document.getElementsByTagName(tg);
}

/**
Returns all elements for the tag name that are descendants of the given element
@method qetag
@param e Element to search within
@param tag Tag name
@returns Elements found
 */
function qetag<TagName extends keyof HTMLElementTagNameMap>(e: HTMLElement, tag: TagName): HCO<HTMLElementTagNameMap[TagName]> {
    return e.getElementsByTagName(tag);
}

/**
Returns the first element matching the selector (that is subnode of the given element)
@method qe
@param {HTMLElement|Document} e Element to search within
@param {string} s Query selector
@returns {HTMLElement} Found element
 */
function qe(e, s) {
    return e.querySelector(s);
}


/**
Returns all elements for the given selector that are subnodes of the given element.
@method qes
@param e Element to search within
@param s Query selector
 */
function qes(e: HTMLElement | Window | Document, s: string): NodeListOf<HTMLElement> {
    if (e instanceof Window)
        return qs(s);
    else
        return e.querySelectorAll(s);
}

/**
Returns the first descendant element of the given element matching the given data ID.
@method qeid
@param {HTMLElement} e Element to search within
@param {string} id data-id of the requested element
@returns {HTMLElement} Found element
 */
function qeid(e, id) {
    return qe(e, '[data-id=' + id + ']');
}

function filterTag(nodeList: HTMLCollection, tag: string) {
    let res: Element[] = [];
    tag = tag.toUpperCase();

    for (let i = 0; i < nodeList.length; i++) {
        if (nodeList[i].tagName === tag)
            res.push(nodeList[i]);
    }

    return res;
}

/**
 * Filter an ArrayLike based on a condition. Useful on types like {@link HTMLCollection} which lack {@link Array.prototype.filter}
 * @param nodeList List of items to filter.
 * @param callback Callback to filter
 * @returns Filtered array
 */
function filterCondition<T = unknown>(nodeList: ArrayLike<T>, callback: (node: T) => boolean) {
    let res: T[] = [];
    for (let i = 0; i < nodeList.length; i++) {
        if (callback(nodeList[i]))
            res.push(nodeList[i]);
    }
    return res;
}

/**
Execute a callback function for every element in an array.
@example

    forEach(arr, function (item, idx) { ... });
@method forEach
@param {ArrayLike} nodeList List to iterate through
@param {function} callback Callback (It is passed each item of nodeList and its index)
 */
function forEach<T = any>(nodeList: ArrayLike<T>, callback: (itm: T, i: integer) => void) {
    for (let i = 0; i < nodeList.length; i++) {
        callback(nodeList[i], i);
    }
}

/**
Execute a callback function for every item in a SharedList, using getFastObject. The same object reference is reused, so do not use this method if you need to store the list contents. 
In that case, use {@link listForEach}, {@link listAsyncForEach:method} or {@link SharedList.forEach}.
@example
 
     fastForEach(tracklist, function (item, idx) \{ ... \});
@method fastForEach
@param {SharedList} list The list to iterate (e.g. songs, albums, etc.)
@param {function} callback Callback (It is passed each item of the list and its index)
 */
function fastForEach(list, callback: (itm, i?: integer) => boolean | void) {
    list.locked(function () {
        let itm;
        for (let i = 0; i < list.count; i++) {
            itm = list.getFastObject(i, itm);
            if (callback(itm, i))
                break;
        }
    });
}

/**
Get a comma-separated list of IDs of a SharedList.
@method listGetCommaIDs
@param {SharedList} list The list object
@param {Number} maxCount Max number of items (If there are more, it will be truncated with a ...)
@returns {string} Comma-separated list
 */
function listGetCommaIDs(list, maxCount?:number) {
    let res = '[';
    fastForEach(list, (item, i) => {
        res = res + item.id;
        if (i < list.count - 1)
            res = res + ',';
        if (maxCount && (i >= (maxCount - 1)))
            return true; // terminate
    });
    if (maxCount && (maxCount < list.count))
        res = res + '...';
    res = res + ']';
    return res;
}

/**
Execute a callback function for every item in a SharedList, using getValue.
@example
 
     listForEach(tracklist, function (item, idx) { ... });
@method listForEach
@param {SharedList} list The list to iterate (e.g. songs, albums, etc.)
@param {function} callback Callback (It is passed each item of the list and its index), return true to break the loop
@param {function} [final_callback] Callback to be executed after all items have been gone through
 */
function listForEach(list, callback, final_callback?) {
    list.locked(function () {
        for (let i = 0; i < list.count; i++) {
            let itm = list.getValue(i);
            if (callback(itm, i))
                break;
        }
        if (final_callback)
            final_callback();
    });
}

/**
Asynchronously process each item in an array.
@example

    asyncForEach(arr, function (item, next) {
        ...
        next();
    });
@method asyncForEach
@param {Array} list Array to process
@param {function} next_item_callback Callback for each item. Parameter 2 is the callback function to process the next item. Parameter 3 is item index.
@param {function} [final_callback] Final callback after everything has been done.
 */
function asyncForEach(list, next_item_callback, final_callback) {
    if (!(list instanceof Array))
        assert(false, 'asyncForEach is for Array, use listAsyncForEach is for SharedList or ArrayDataSource');
    let _processItem = (idx) => {
        if (idx >= list.length) {
            if (final_callback)
                final_callback();
        } else
            next_item_callback(list[idx], (terminate) => {
                if (terminate) {
                    if (final_callback)
                        final_callback();
                } else {
                    if (idx % 100 == 0) {
                        setTimeout(_processItem, 0, idx + 1); // to prevent RangeError: Maximum call stack size exceeded
                    } else
                        _processItem(idx + 1);
                }
            }, idx);
    };
    _processItem(0);
}

/**
Asynchronously process each item in a SharedList or ArrayDataSource.
@example 

    listAsyncForEach(tracklist, function (item, next) {
        ...
        next(); // pass true as first param if you want to break the loop
    });
@method listAsyncForEach
@param {SharedList|ArrayDataSource} list Array to process
@param {function} next_item_callback Callback for each item. Parameter 2 is the callback function to process the next item. Parameter 3 is item index.
@param {function} [final_callback] Final callback after everything has been done.
 */
function listAsyncForEach(list, next_item_callback, final_callback?) {
    if (list instanceof Array)
        assert(false, 'listAsyncForEach is for SharedList or ArrayDataSource, use asyncForEach for Array!');
    let _processItem = (idx) => {
        if (idx >= list.count) {
            if (final_callback)
                final_callback();
        } else {
            let itm = getValueAtIndex(list, idx);
            if (itm) {
                next_item_callback(itm, (terminate) => {
                    if (terminate) {
                        if (final_callback)
                            final_callback();
                    } else {
                        if (idx % 100 == 0) {
                            setTimeout(_processItem, 0, idx + 1); // to prevent RangeError: Maximum call stack size exceeded
                        } else
                            _processItem(idx + 1);
                    }
                }, idx);
            } else {
                if (final_callback)
                    final_callback();
            }
        }
    };
    _processItem(0);
}

/**
<b>[ADDED IN VERSION 5.0.1]</b><br> For screen reader support: Sets a focused element's active descendant. Required for keyboard navigation to work properly with screen readers. <br>
Gives the div a unique ID and sets the parent's aria-activedescendant. Use in conjunction with ARIA roles: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Techniques <br>
The parent element must have a role (for example: table) as well as the active element (for example: row)

@method setAriaActiveDescendant
@param {HTMLElement} div The div which is active
@param {HTMLElement} parent The parent element which is focused
 */
function setAriaActiveDescendant(div, parent) {
    // Screen reader support: Give the selected element a unique id, and set the active descendant to that id
    let id = '' + Date.now();
    div.id = id;
    div.setAttribute('aria-selected', 'true');
    parent.setAttribute('aria-activedescendant', id);
}

/**
<b>[ADDED IN VERSION 5.0.1]</b><br> For screen reader support: Clears the element's unique ID.
@method clearAriaID
@param {HTMLElement} div The div which is no longer active
 */
function clearAriaID(div) {
    div.removeAttribute('id');
    div.removeAttribute('aria-selected');
}

/**
<b>[ADDED IN VERSION 5.0.1]</b><br>
For screen reader support: Sets the aria-label attribute of the icon within the provided element. Screen readers will then read the label when moused over.
@example 
    
    <div data-icon="home"><svg>...</svg></div>
    
    setIconAriaLabel(myDiv, 'Home button');
    The div becomes <div data-icon="home"><svg aria-label='Home button'>...</svg></div>
 
@method setIconAriaLabel
@param {HTMLElement} div The div which contains the icon.
@param {string} label The label for screen readers to read when moused over.
 */
function setIconAriaLabel(div, label) {
    let svg = qe(div, 'svg');
    if (svg) svg.setAttribute('aria-label', label);
}

function getValueAtIndex(list, index) {
    let res;
    list.locked(function () {
        if ((index < list.count) && (index >= 0))
            res = list.getValue(index);
    });
    return res;
}

function assignProperties(target, source) {
    for (let key in source) {
        if (source.hasOwnProperty(key))
            target[key] = source[key];
    }
}

function requestTimeout(callback, tm) {
    return setTimeout(() => {
        if (!window._cleanUpCalled)
            callback();
    }, tm);
}

/**
Request an animation frame to run, with the same features as {@link requestAnimationFrameMM} but automatically stops if the user has closed the window.
The token returned may correspond to either an AnimationFrame or a Timeout, so to cancel it, you must use {@link cancelFrame}.
@param {function} callback Callback to execute.
@method requestFrame
@returns {number} AnimationFrame/Timeout token.
 */
function requestFrame(callback) {
    return requestAnimationFrameMM(function () {
        if (!window._cleanUpCalled) {
            layoutHandlingActive = true;
            callback();
            _applyLayoutQueryCallbacks(); // #18600
            _applyStylingCallbacks();
            layoutHandlingActive = false;
        }
    });
}

/**
Returns true, when parameter is Function
@method isFunction
@param {any} x Parameter to test
@return {boolean}
*/
function isFunction(x): x is AnyFunction {
    return typeof x === 'function';
}

/**
 * Resolve anything to a defined value. If a function is provided, then the return of that function is returned.
 * @param property Property to resolve.
 * @param whenUndefined Default value if undefined.
 * @param params Parameters to apply, if property is a function.
 * @param bindObj Object to bind, if the "this" property needs to be accessible.
 */
function resolveToValue(property: unknown, whenUndefined?: unknown, params?: AnyDict, bindObj?: unknown) {
    if ((property !== undefined) && (property !== null)) {
        if (typeof property === 'function') {
            if (bindObj)
                return property.apply(bindObj, params);
            else
                return property(params);
        } else
            return property;
    }
    return whenUndefined;
}

function cleanupDocument() {
    window._cleanUpCalled = true;
    window.cleanUpLocalPromises();
    window.cleanUpLasso();
    clearInterval(idleInterval);
    doStyleCleanup();
    if (window.beforeWindowCleanup) {
        window.beforeWindowCleanup();
        window.beforeWindowCleanup = undefined;
    }
    cleanElement(document.body);
    window.unlistenLocalListeners();
    if (window.windowCleanup) {
        window.windowCleanup();
        window.windowCleanup = undefined;
    }
    doLocalCleanup();
    window._rootElement = null;
    window._lastFocusedLVControl = null;
    window.cleanUp = undefined;
    lastFocusedControl = null;
    canBeFreed = true;
}

function cleanControlClass(e: Node) {

    if (!e)
        return;

    if ((e as HTMLElement).controlClass) {
        //console.log('cleanControlClass: ' + e.controlClass.constructor.name + ' | ' + e.controlClass.uniqueID);
        (e as HTMLElement).controlClass.checkedCleanUp();
        (e as HTMLElement).controlClass = undefined;
    }
    for (let i = 0; i < e.childNodes.length; i++)
        cleanControlClass(e.childNodes[i]);
}

/**
Returns control inside which this element is contained.

@method elementControl
@param {HTMLElement|null} [el] Element to check
@return {Control|undefined} Control found (or undefined).
*/

function elementControl(el: Element) {
    if (el) {
        do {
            if ((el as HTMLElement).controlClass)
                return (el as HTMLElement).controlClass;
        // eslint-disable-next-line no-cond-assign
        } while (el = el.parentElement);
    }
    return undefined;
}

/**
Removes all children elements of the given element. Note that it uses e.removeChild() method in a loop, which is much faster than e.innerHTML=''.
Also calls cleanElement for all descendant controls.

@method cleanElement
@param {HTMLElement} e Element to clean
@param {Boolean} [onlyChildren] Default false, cleans only children of e if set to 'true'.
@return {HTMLElement|undefined} The same element
*/
function cleanElement(e: Element, onlyChildren?: boolean) {

    if (!e)
        return;

    if (!onlyChildren)
        cleanControlClass(e);
    else {
        for (let i = 0; i < e.childNodes.length; i++)
            cleanControlClass(e.childNodes[i]);
    }

    return cleanBasicElement(e);
}

/**
Removes all children elements of the given element. Unlike cleanElement() function, it doesn't clean all inner controls and so it's an optimized version 
used when there aren't controls used (otherwise, it would leave memory leaks).

@method cleanBasicElement
@param {HTMLElement} e Element to clean
@return {HTMLElement} The same element
*/
function cleanBasicElement(e: Element) {

    function rm(e: Element) {
        if (window.Velocity) // Velocity maintains its cache and we have to manually clear it, otherwise there can remain some leaks.
            Velocity.Utilities.removeData(e);
        let ec;
        // eslint-disable-next-line no-cond-assign
        while (ec = e.firstChild) {
            rm(ec); // call on all descendants at first (in order to not leak)
            e.removeChild(ec);
        }
    }

    rm(e);
    return e;
}

/**
Removes an element from DOM in a safe way, cleaning all its controls (including descendants).

@method removeElement
@param {HTMLElement} e Element to remove
@param {boolean} [hideParentWhenNoChild] Whether to hide the element's parentNode if it contains no additional children.
*/
function removeElement(e: Element, hideParentWhenNoChild?: boolean) {
    if (!e)
        return;

    let parent = e.parentNode;
    if (!parent)
        throw 'Element doesn\'t have a parent.';

    cleanElement(e);

    // JH: Note that the following could possibly be done for all descendants. Currently it doesn't seem to be necessary and so for performance reasons, it's done only here, in the top element
    if ((e as HTMLElement).unlisteners) {
        forEach((e as HTMLElement).unlisteners, function (unlistenFunc) {
            unlistenFunc();
        });
        (e as HTMLElement).unlisteners = undefined;
    }
    app.unlisten(e);

    if (parent.removeChild) {
        parent.removeChild(e);
        if (hideParentWhenNoChild && !parent.childElementCount && parent instanceof HTMLElement /* #19015 */)
            setVisibility(parent, false);
    } else
        throw 'Can\'t remove element'; // Can this ever happen?
}

/**
Return parent of the element.

@method getParent
@param {HTMLElement} e Element to get his parent
*/

function getParent(e) {
    if (e.parentElement !== undefined)
        return e.parentElement;
    else if (e.parentNode !== undefined) // IE 11 does not support parentElement
        return e.parentNode;
    return undefined;
}

function getLeftTop() {
    let cr = bounds.clientRect;
    return {
        left: cr.left,
        top: cr.top
    };
}

function fixScreenCoords(coords, ctrl?: Element) {

    let ret = coords;

    let screenInfo = app.utils.getMonitorInfoFromCoords(Math.round(ret.left), Math.round(ret.top), true);
    if (screenInfo && screenInfo.ratio !== window.devicePixelRatio) {

        // #17311: is control really on different display ? Check regular position of the control as it can be internal scrolled canvas        
        if (ctrl) {
            let useCtrl = ctrl; // @ts-ignore
            if (ctrl.controlClass && (ctrl.controlClass.dynamicSize !== undefined)) // @ts-ignore
                if (ctrl.controlClass.dynamicSize && ctrl.controlClass.scrollingParent) // @ts-ignore
                    useCtrl = ctrl.controlClass.scrollingParent;
                else // @ts-ignore
                    useCtrl = ctrl.controlClass.canvas;

            let cr2 = {
                left: ret.left + useCtrl.scrollLeft,
                top: ret.top + useCtrl.scrollTop
            };

            let screenInfo2 = app.utils.getMonitorInfoFromCoords(Math.round(cr2.left), Math.round(cr2.top), true);
            if (screenInfo2 && Math.round(screenInfo2.ratio * 1000) === Math.round(window.devicePixelRatio * 1000)) {
                // no need to recompute coords because of same DPI
                return ret;
            }
        }

        let curInfo = app.utils.getMonitorInfoFromCoords(Math.round(ret.left + bounds.width), Math.round(ret.top + bounds.height), true);

        if ((curInfo.ratio == screenInfo.ratio) && screenInfo.ratio != window.devicePixelRatio) { // something's wrong!
            window.devicePixelRatio = screenInfo.ratio;
        }

        if (curInfo) {
            ret.left = Math.round(((ret.left - curInfo.origLeft) * window.devicePixelRatio) / screenInfo.ratio) + curInfo.origLeft;
            ret.top = Math.round(((ret.top - curInfo.origTop) * window.devicePixelRatio) / screenInfo.ratio) + curInfo.origTop;
        } else {
            ret.left = Math.round((ret.left * window.devicePixelRatio) / screenInfo.ratio);
            ret.top = Math.round((ret.top * window.devicePixelRatio) / screenInfo.ratio);
        }
    }

    if (window.maximized && window.headerClass) {
        let border = window.headerClass.borderSize * 2;
        ret.left += border;
        ret.top += border;
    }

    return ret;
}

function getScreenCoordsFromEvent(e: MouseEvent) {
    if (window.maximized) {
        let add = 0;
        if (window.headerClass)
            add = window.headerClass.borderSize * 2;
        return {
            left: bounds.left + e.clientX + add,
            top: bounds.top + e.clientY + add
        };
    } else {
        let leftTop = getLeftTop();

        return window.fixScreenCoords({
            left: leftTop.left + Math.round(e.clientX),
            top: leftTop.top + Math.round(e.clientY)
        });
    }
}

function findScreenPos(obj: Element) {
    let leftTop = getLeftTop();

    let pagePosition = obj.getBoundingClientRect(); // contains float, have to make integer from it
    return window.fixScreenCoords({
        left: leftTop.left + Math.round(pagePosition.left),
        top: leftTop.top + Math.round(pagePosition.top)
    }, obj);
}

function getAbsPosRect(div) {
    return div.getBoundingClientRect();
}

function getOffsetRect(div) {
    return {
        left: div.offsetLeft,
        top: div.offsetTop,
        width: div.offsetWidth,
        height: div.offsetHeight
    };
}

function newElement(parent, type, className) {
    let el = document.createElement(type);
    if (className)
        el.className = className;
    parent.appendChild(el);
    return el;
}

function isInElement(X, Y, obj) {
    let pos = obj.getBoundingClientRect();
    return (pos.left <= X) && (X < pos.right) && (pos.top <= Y) && (Y < pos.bottom);
}

function debugObject(object) {
    let output = '';
    for (let property in object) {
        output += property + ': ' + object[property] + '; ';
    }
    return output;
}

window.pageLoaded = false;
window.pageReady = false;
window.cssLoaded = false;
let pageLoadedEvents: callback[] = [];
let pageReadyEvents: callback[] = [];

requirejs('promise.js');

if (isStub) {
    Promise.prototype.cancel = function () { };
}

(function () {

    let getHashName = function (skin, layout) {
        return '_' + skin.id + '_' + layout.id;
    };

    let skinAndLayout = getHashName(app.currentSkin(), app.currentLayout());

    let precompiledHashID = (app.inSafeMode() ? 'precompiledLessMD5Safe' : 'precompiledLessMD5') + skinAndLayout;
    let precompiledName = (app.inSafeMode() ? 'precompiledLessSafe' : 'precompiledLess') + skinAndLayout + '.css';
    let isDebug = app.debug !== undefined;
    let loadLessWithoutCheck = !window.builtInMenu || (!isMainWindow && (window.doNotCheckLess || !isDebug));
    let precompiledHashTimestampID = precompiledHashID + 'Timestamp';

    let precompiledLessMD5 = app.getValue(precompiledHashID, '');
    let precompiledLessTimestamp = app.getValue(precompiledHashTimestampID, '');
    let currentMD5 = '';
    let currentTimestamp = '';

    let precompiledFile = 'file:///data/' + precompiledName;
    let lessStyleElement = null;
    let precompiledLess = '';

    if (isStub)
        precompiledLessMD5 = '';
    window.logger = {
        info(msg) {
            console.log(msg);
            window.callODS(msg);
        },
        debug(msg) {
            window.callODS(msg);
        }
    };
    if (isDebug) {
        /**
        Debug logger. Use DbgView: https://docs.microsoft.com/en-us/sysinternals/downloads/debugview
        @method ODS
        @param {string} msg Message to log
         */
        window.ODS = function (msg) {
            logger.debug(msg);
        };
    } else {
        window.ODS = function () { };
    }

    /**
    Execute an app/window reload.
    @method doReload
    @param {boolean} [storeState=true] Whether to store UI state during reload
    @param {boolean} [softReload=false] Whether to JUST reload LESS styling
    @param {boolean} [lessChanged=false] Whether LESS was changed
    @param {string} [customCaption] Custom caption to display in the reload prompt.
     */
    window.doReload = function (storeState, softReload, lessChanged, customCaption) {
        if (storeState != false) // the default is true
            uitools.storeUIState();

        let callReload = function () {
            uitools.beforeReloadAnimation().then(function () {
                if (lessChanged)
                    app.setValue(precompiledHashID, '');
                if (softReload) {
                    reloadLess();
                    app.selectSkin(app.currentSkin(), true /* soft */);
                } else {
                    app.restart();
                }
            });
        };

        if (softReload) {
            callReload();
        } else {
            uitools.showReloadConfirm(customCaption).then(function () {
                callReload();
            });
        }
    };

    let getCustomLessID = function (ext_id) {
        let name = 'CustomLESS';
        if (ext_id) {
            name += '_' + ext_id;
        }
        return name;
    };

    window.getRuntimeLessValues = function (ext_id) {
        return app.getValue(getCustomLessID(ext_id), {
            values: []
        }).values;
    };

    /**
    @method logMemoryStats
     * 
     */
    window.logMemoryStats = function () {
        // @ts-ignore
        let mem = performance.memory;

        ODS('JS memory log: totalJSHeapSize: '+mem.totalJSHeapSize+', usedJSHeapSize: '+mem.usedJSHeapSize+', jsHeapSizeLimit: '+mem.jsHeapSizeLimit);
    };

    /**
    <b>[ADDED IN VERSION 5.0.2]</b><br>
    Set runtime values for LESS variables, for skins, without destroying existing values.
    
    @example 
        
        // The following will be interpreted as "@warningColor: red;" and Monkey Groove's main color will be changed to red.
        setLessValues({warningColor: 'red'}, 'Monkey Groove'); 
        
        // The following will remove the custom "@warningColor: red;" from the previous example, on the Monkey Groove skin only.
        setLessValues({warningColor: ''}, 'Monkey Groove'); 
        setLessValues({warningColor: null}, 'Monkey Groove'); 
        
        // The following will be interpreted as "@textColor: green;" and be applied to ALL skins.
        setLessValues({textColor: 'green'}); 
    @method setLessValues
    @param {object} values Values, in key-value format. If the value is undefined (or null or empty string), the variable will be removed.
    @param {string} [ext_id] Optional: Addon ID of the skin. If specified, the LESS variables will only apply to the one skin.
    @param {boolean} [flush] Optional: Flush (reset) existing LESS variables
     */
    window.setLessValues = function (values, ext_id, flush) {
        // Generate a keyed object for each runtime less value (e.g. {"@warningColor": "#FB12A1"})
        let currentValuesArr = getRuntimeLessValues(ext_id);
        let lessValues = {};
        if (!flush) {
            for (let i in currentValuesArr) {
                let split = currentValuesArr[i].split(':');
                lessValues[split[0].trim()] = split[1].trim();
            }
        }

        for (let key in values) {
            let value = values[key];
            key = key.trim();
            // add an @ to the start of the variable
            if (!key.startsWith('@')) key = '@' + key;

            // if value is not defined or is an empty string, remove it from lessValues
            if (!value) {
                delete lessValues[key];
            } else {
                // add a semicolon to the end of the value
                if (!value.endsWith(';')) value = value + ';';
                lessValues[key] = value;
            }
        }

        // combine back into an array
        let newLessValues: string[] = [];
        for (let key in lessValues) {
            let str = `${key}: ${lessValues[key]}`;
            newLessValues.push(str);
        }

        if (JSON.stringify(currentValuesArr) === JSON.stringify(newLessValues)) {
            return ODS('LESS values are identical; Not recompiling.');
        }

        setRuntimeLessValues(newLessValues, ext_id);
    };

    window.setRuntimeLessValues = function (values, ext_id) {
        let data = {
            values: values
        };
        app.setValue(getCustomLessID(ext_id), data);

        if (ext_id) {
            let id = (app.inSafeMode() ? 'precompiledLessMD5Safe' : 'precompiledLessMD5') + getHashName({
                id: ext_id
            }, app.currentLayout());
            let precompiledHashTimestampID = id + 'Timestamp';
            app.setValue(id, '');
            app.setValue(precompiledHashTimestampID, '');
        } else {
            app.setValue(precompiledHashID, '');
            app.setValue(precompiledHashTimestampID, '');
        }
        app.flushState();
        app.notifyCustomLessChange();
    };

    // React to custom LESS changes: ONLY on main window
    let customLessChange = function () {
        if (window.windowIsLoaded && window.isMainWindow) {
            reloadLess();
        }
    };
    app.listen(app, 'customLessChange', customLessChange);

    /**
    Reload LESS styling (Only allowed in main window).
    @method reloadLess
    @returns {Promise}
     */
    window.reloadLess = function () {
        return new Promise(function (resolve, reject) {
            if (window.isMainWindow) {
                requirejs('less.js', function () {
                    let fn = 'skin/skin_complete.less';
                    if (!isStub) fn = 'file:///' + fn;

                    let opts = {
                        math: 'always',
                        env: 'production',
                        useFileCache: false,
                    };

                    less.render('@import url("' + fn + '");', opts)
                        .then(function (output) {
                            // output.css = string of css
                            // output.map = string of sourcemap
                            // output.imports = array of string filenames of the imports referenced

                            let newCSS = output.css;
                            setAsCSS(newCSS);

                            if (!isStub) {
                                // @ts-ignore (undocumented function)
                                app.filesystem.saveToFileAsync(precompiledFile, newCSS, newCSS.length).then(function () {
                                    loadFile(precompiledFile, function (data, xhr) {
                                        assert(xhr, 'Could not find Last-Modified header!!!');
                                        currentTimestamp = xhr.getResponseHeader('Last-Modified');
                                        app.setValue(precompiledHashTimestampID, currentTimestamp);
                                    }, {
                                        required: false /* file is not required */
                                    });
                                    app.notifyLessChange();
                                    resolve(undefined);
                                });
                            } else {
                                app.notifyLessChange();
                                resolve(undefined);
                            }

                        }, function (err) {
                            cssLoaded = true;
                            reject();
                            // Alert the parsing error as a crash
                            if (err.extract)
                                myAlert('(LESS) ' + err.message + '\n\nProblematic code:\n' + JSON.stringify(err.extract, null, 2));
                            else
                                myAlert(err.message);
                        });
                });
            } else {
                cssLoaded = true;
                reject();
            }
        });
    };

    let setAsCSS = function (str) {
        let style;
        cssLoaded = false;
        if (lessStyleElement) {
            style = lessStyleElement;
        } else {
            style = document.createElement('style');
            lessStyleElement = style;
            style.setAttribute('type', 'text/css');
            let head = document.getElementsByTagName('head')[0];
            if (head.hasChildNodes()) {
                head.insertBefore(style, head.childNodes[0]);
            } else
                head.appendChild(style);
        }
        style.onload = function () {
            cssLoaded = true;
            let event = createNewCustomEvent('lessloaded', {
                bubbles: true,
                cancelable: true,
            });
            window.dispatchEvent(event);
        };
        style.innerHTML = str;
    };

    // Dynamic loading of LESS CSS
    let loadLess = function (enumMD5?: any) {
        ODS('Loading less and running parse');
        if (enumMD5) {
            let pr = app.filesystem.getCurrentLessMD5Async();
            pr.then(function (md5) {
                app.setValue(precompiledHashID, md5);
            });
        }
        reloadLess();
    };

    // Attempt to load precompiled LESS; if out-of-date and allowed, reload LESS
    let loadCompiledLess = function (allowRecompile) {
        // some state is already cached
        if ((precompiledLessMD5 !== '') || (isStub)) {
            let precompiledLoaded = false;
            let md5computed = false;
            let processLess = function () {
                if (md5computed && precompiledLoaded) {
                    ODS('******** currentMD5=' + currentMD5 + ', precompiledLessMD5=' + precompiledLessMD5 + ', currentTimestamp=' + currentTimestamp + ', precompiledLessTimestamp=' + precompiledLessTimestamp);
                    if ((((currentMD5 !== precompiledLessMD5) || (precompiledLess == '')) ||
                        ((currentTimestamp !== precompiledLessTimestamp) || (precompiledLessTimestamp == ''))) && allowRecompile) {
                        loadLess();
                    } else {
                        ODS('******** using precompiled LESS');
                        setAsCSS(precompiledLess);
                    }
                    app.setValue(precompiledHashID, currentMD5);
                } else {
                    setTimeout(processLess, 1);
                }
            };

            let continueLoad = function (md5) {
                currentMD5 = md5;
                md5computed = true;
                processLess();
            };

            if (isStub) {
                loadFileFromServer(precompiledFile, function (data) {
                    if (data != '') {
                        precompiledLess = data;
                    }
                    precompiledLoaded = true;
                    setAsCSS(precompiledLess);
                    //continueLoad(precompiledLessMD5);
                });
            } else {
                loadFile(precompiledFile, function (data, xhr) {
                    assert(xhr, 'Could not find Last-Modified header!!!');

                    currentTimestamp = xhr.getResponseHeader('Last-Modified');
                    if (data != '') {
                        precompiledLess = data;
                    }
                    precompiledLoaded = true;
                    if (loadLessWithoutCheck) {
                        continueLoad(precompiledLessMD5);
                    }
                }, {
                    required: false, // File is not required
                    alwaysLoad: !window.isMainWindow, // Load even if cleanUp has been called (in case of closed dialog windows)
                });
            }

            if (!loadLessWithoutCheck && !isStub) {
                app.filesystem.getCurrentLessMD5Async().then(function (md5) {
                    continueLoad(md5);
                });
            }
        } else {
            loadLess(!isStub);
        }
    };

    if (!window.isMainWindow && app.inSafeMode()) {
        requirejs('less.js', function () {
            let fn = 'file:///skin/skin_complete.less';
            let opts = {
                math: 'always',
                env: 'production',
                useFileCache: false,
            };
            less.render('@import url("' + fn + '");', opts).then(function (output) {
                // output.css = string of css
                // output.map = string of sourcemap
                // output.imports = array of string filenames of the imports referenced
                let newCSS = output.css;
                setAsCSS(newCSS);
                app.notifyLessChange();
            });
        });
    } else {
        if (!window.qUnit) {
            loadCompiledLess(window.isMainWindow);
        } else {
            cssLoaded = true;
        }
    }

    let lessChange = function () {
        ODS('LESS change: Reloading compiled LESS');

        // Reload precompiled LESS only if this is not the main window
        if (!window.isMainWindow) {
            loadCompiledLess(false);
        }

        // Raise lesschange event for this window
        let event = createNewCustomEvent('lesschange', {
            bubbles: true,
            cancelable: true,
        });
        window.dispatchEvent(event);
        doStyleCleanup();
    };
    app.listen(app, 'lessChange', lessChange);
})();

/**
Loads a HTML file and includes it in the given element. It also executes all the scripts of the HTML file. Note that a call to initializeControls 
 might be needed in order to initialize any custom UI control in the loaded HTML. <br>
For all the scripts within the included HTML there's window.rootElement set to the element where the HTML is being included, in order to be able to modify the correct part of DOM (if needed).
@method includeHTML
@param {HTMLElement} element Element where to load HTML
@param {string} filename Source file for the HTML
 */
function includeHTML(element, filename) {

    if (!isStub)
        if (filename.slice(0, 8) != 'file:///')
            filename = 'file:///' + filename;

    element.innerHTML = loadFile(filename);

    processIncludes(element);

    let backCurrentRoot = window.rootElement;
    window.rootElement = element; // Set the current root element, so that scripts in the inner HTML know what they can work with.

    let codes = element.getElementsByTagName('script');
    for (let i = 0; i < codes.length; i++) {
        let code = codes[i];
        if (!code.executed) {
            code.executed = true;
            if (typeof code.src == 'string' && code.src.length > 0) {
                requirejs(code.src);
            } else
                window.eval(codes[i].text);
        }
    }

    window.rootElement = backCurrentRoot;
}

/**
Process our internal attributes to properly initialize the document
@method processIncludes
@param {HTMLElement} element 
 */
function processIncludes(element) {
    forEach(qes(element, '[data-uiblock]'), function (block) {
        includeHTML(block, block.getAttribute('data-uiblock') + '.html');
        block.removeAttribute('data-uiblock'); // to prevent dom created again, #19378
    });
}

/**
Initializes an HTML element to a ControlClass. (see {@link Control})
@example

    <div data-id="chbExample" data-control-class="Checkbox">This is a Checkbox</div>
    
    initializeControl(qid('chbExample'));
@method initializeControl
@param {HTMLElement} control Element to initialize
 */
function initializeControl(control) {
    control.lang = usedLang;

    let classname: string;
    let cls: undefined|(typeof import('./controls/control').default);
    
    function loadClass() {
        control.initInProgress = true;
        // JH: Todo - we could replace eval() by JSON.parse() here, but we'd need to use " for each string then (unquoted strings are forbidden by JSON)
        try {
            let initParams;
            let params = control.getAttribute('data-init-params');
            if (params && params.trim() != '')
                initParams = eval('(' + params + ')');
            control.controlClass = new cls(control, initParams);
        } catch (err) {
            myAlert(getMessageWithStack(err) + ' in class ' + classname);
        }
        control.initInProgress = undefined;
    }

    if (!control.controlClass && !control.initInProgress) { // The class isn't initialized yet
        classname = control.getAttribute('data-control-class');
        if (classname) {
            cls = window[classname];

            if (typeof cls == 'function')
                loadClass();
            else {
                ODS('Loading class ' + classname);
                requirejs('controls/' + lowerFirstLetter(classname));
                cls = window[classname];
                if (typeof cls == 'function')
                    loadClass();
                else
                    myAlert('Class ' + control.getAttribute('data-control-class') + ' doesn\'t exist!!');
            }
        }
    }
}

interface HTMLTextAreaElement {
    oldWidth?: number;
    oldHeight?: number;
}

/**
Initializes all UI controls below a particular HTML element. This means loading a necessary JS and all the initialization code. This is normally done automatically on window load by mminit.js inclusion.
@method initializeControls
@param {HTMLElement} element Element to process (and all its children)
 */
function initializeControls(element) {

    if (!element)
        element = document;

    // Initialize all standard UI controls
    forEach(qes(element, '[data-control-class]'), initializeControl);

    // Load all icons
    forEach(qes(element, '[data-icon]'), function (div) {
        // 2023 JL: changed from div._iconInitialized to div.has/setAttribute('data-icon-initialized') to avoid additional HTMLElement properties (Performance impact is negligible)
        if (!div.hasAttribute('data-icon-initialized') && div.hasAttribute('data-icon')) {
            div.setAttribute('data-icon-initialized', '1');
            let iconName = div.getAttribute('data-icon');
            // empty icon before loading, co additional div(s) can be added over icon (badge)
            div.innerHTML = ''; // #18563: Div has to be cleared before adding icon. (Setting innerHTML="" is faster than div.removeChild(div.lastChild))            
            loadIconFast(iconName, function (icon) {
                assert(icon, `Icon named "${iconName}" not found`);
                div.appendChild(icon);
                // Screen reader support: Give the svg an aria-label attribute if provided by data-aria-label.
                let ariaLabel = div.getAttribute('data-aria-label');
                if (ariaLabel && ariaLabel != '') {
                    setIconAriaLabel(div, _(ariaLabel));
                }
            });
        }
    });
    // Handle all 'textarea' elements resizing
    forEach(qetag(element, 'textarea'), function (control) {
        control.oldWidth = control.clientWidth;
        control.oldHeight = control.clientHeight;

        function notifyTextAreaResize() {
            if (control.oldHeight != control.clientHeight || control.oldWidth != control.clientWidth) {
                control.oldWidth = control.clientWidth;
                control.oldHeight = control.clientHeight;

                notifyLayoutChangeUp(control);
            }
        }

        app.listen(control, 'mousemove', notifyTextAreaResize);

        // JH: This is here, because a quick move out of the window isn't registered by the event above. This slightly improves the situation.
        app.listen(document, 'mouseout', notifyTextAreaResize);
    });
    translateElement(element);
    deferredNotifyLayoutChangeDown(element);
}

function checkNaN(num, def) {
    if (isNaN(num))
        return def;
    return num;
}

function getRootEl() : Element {
    // find first div, which is not window header or fixed or absolute positioned element
    if (!window._cleanUpCalled && !window._rootElement) {
        let root = getDocumentBody();
        if (headerClass && headerClass.container.parentElement && !webApp)
            root = headerClass.container.parentElement;

        let i = 0;
        for (; i < root.children.length; i++) {
            let el = root.children[i];
            if (el.nodeName === 'DIV' && el instanceof HTMLElement) {
                if (!webApp) {
                    if (headerClass && (headerClass.container == el)) // skip window header
                        continue;
                }
                let style = getComputedStyle(el, null);
                let posType = style.getPropertyValue('position');
                if ((posType !== 'fixed') && (posType !== 'absolute') && isVisible(el, false)) {
                    window._rootElement = el;
                    break;
                }
            }
        }
        if (!window._rootElement)
            window._rootElement = getDocumentBody();
    }
    return window._rootElement;
}

function getComputedSize() {
    if (headerClass) {
        // PETR: in borderless window we need to remove header from size compute because it is always
        // stretched to window width. Just compute size of the rest and include just height of the header.

        let border = headerClass.borderSize;
        let w = 0;
        let h = 0;
        let par = getBodyForControls();
        if (par) {
            for (let i = 0; i < par.children.length; i++) {
                let el = par.children[i];
                if (el.nodeName === 'DIV' && isVisible(el)) {
                    let style = getComputedStyle(el, null);
                    let posType = style.getPropertyValue('position');
                    if ((posType === 'fixed') || (posType === 'absolute')) // do not count fixed or absolute elements, they would distort result
                        continue;
                    let isHeader = el.hasAttribute('data-control-class') && (el.getAttribute('data-control-class') === 'WindowTitle');
                    if (!isHeader) {
                        w = Math.max(w, Math.round(parseFloat(style.getPropertyValue('width')) || 0) + getOuterWidth(el, style));
                    }
                    h += Math.round(parseFloat(style.getPropertyValue('height')) || 0) + getOuterHeight(el, style);
                }
            }
        }
        return {
            width: Math.round(w + (border * 2)),
            height: Math.round(h + (border * 2))
        };
    } else {
        let root = getRootEl();
        if (root) {
            let style = getComputedStyle(root, null);
            let w = Math.round(parseFloat(style.getPropertyValue('width')) || 100)+getOuterWidth(root, style);
            let h = Math.round(parseFloat(style.getPropertyValue('height')) || 100)+getOuterHeight(root, style);
            return {
                width: w,
                height: h
            };
        }
    }
}

let _setCoSizeTm;

function setComputedSize(force: boolean, secondLoop?: boolean) {
    // preset content size before show to prevent 'flickering'    
    if ((!window.resizeable && (window.bordered || !!window.shape) && !window.noAutoSize) || (force)) {

        clearTimeout(_setCoSizeTm);
        _setCoSizeTm = requestTimeout(() => { // moved to timeout to not needlessly re-computed when called many times during dialog init (like Properties) -- #17642
            _setCoSizeTm = undefined;

            let size = window.getComputedSize();
            if (size) {

                ODS('window.setComputedSize: ' + size.width + '/' + size.height);

                if (headerClass) {
                    window.setSize(size.width, size.height);
                } else {
                    window.setClientSize(size.width, size.height);
                }
            }

            // some elements can change it's size after window size is changed (like texts can flow from one line to another)
            // so we need to call second loop as height might need to be updated
            if (!secondLoop) {
                requestTimeout(function () {
                    setComputedSize(true, true);
                }, 50);
            }
        }, 100);
    }
}

let _scrollBarWidth;

function getScrollbarWidth() {
    if (_scrollBarWidth === undefined) {
        let outer = document.createElement('div');
        outer.style.visibility = 'hidden';
        outer.style.width = '100px';
        outer.style.overflow = 'scroll';
        // outer.style.msOverflowStyle = 'scrollbar';

        getDocumentBody().appendChild(outer);

        let widthNoScroll = outer.offsetWidth;
        // force scrollbars
        outer.style.overflow = 'scroll';

        // add innerdiv
        let inner = document.createElement('div');
        inner.style.width = '100%';
        outer.appendChild(inner);

        let widthWithScroll = inner.offsetWidth;

        // remove divs
        if (outer.parentNode) outer.parentNode.removeChild(outer);

        _scrollBarWidth = widthNoScroll - widthWithScroll;
    }
    return _scrollBarWidth;
}

/**
Calls the specified function when all page scripts are loaded and processed. So it's processed after window.onLoad event, but before {@link whenReady|whenReady()} event. <br>
If called after this event, the callback function is executed immediately.
@method whenLoaded
@param {Function} callback Callback function to be executed when ready.
 */
function whenLoaded(callback) {
    if (pageLoaded)
        callback();
    else {
        pageLoadedEvents.push(callback);
    }
}

function getBodyForControls() {
    if (headerClass)
        return headerClass.container.parentElement;
    else
        return getDocumentBody();
}

function addDialogContent(content) {
    let div = document.createElement('div');
    getBodyForControls().appendChild(div);
    div.innerHTML = content;
    return div;
}

// internal
function addBorderlessHeader() {
    // PETR: add windowTitle class automatically to all windows when data-addHeader is defined in the skin (for borderless skins)
    let documentBody = getDocumentBody();
    if ((documentBody.hasAttribute('data-addHeader') || window.addHeader) && (!headerClass) && (!window._cleanUpCalled) && (builtInMenu)) {

        setComputedSize(false);

        requirejs('controls/windowtitle');

        let top_container = qid('top-container') /* || document.body*/;
        if (!top_container) {
            if (!webApp) {
                top_container = document.createElement('div');
                if (documentBody.childNodes.length)
                    documentBody.insertBefore(top_container, documentBody.childNodes[0]);
                else
                    documentBody.appendChild(top_container);

                while (documentBody.childNodes.length > 1) {
                    top_container.appendChild(documentBody.childNodes[1]);
                }
            } else {
                top_container = documentBody;
            }
        }
        if (top_container) {
            let header = document.createElement('div');
            header.setAttribute('data-control-class', 'WindowTitle'); // will be initialized later in whenReady handler
            header.setAttribute('data-id', 'windowheader');
            if (top_container.childNodes.length) // add header to be always first item in DOM
                top_container.insertBefore(header, top_container.childNodes[0]);
            else
                top_container.appendChild(header);
        }
    }
}

function notifyPageLoaded() {
    addBorderlessHeader();
    pageLoaded = true;
    let events = pageLoadedEvents;
    pageLoadedEvents = [];
    events.forEach(function (event) {
        event();
    });
}

/**
Calls the specified function when all scripts are loaded, the whole DOM is processed by our parser and all controls are initialized. I.e. at this point everything is ready to be used. So both window.onLoad and {@link whenLoaded|whenLoaded()} events occur before this one.
If called after this event, the callback function is executed immediately.

@method whenReady
@param {Function} callback Callback function to be called.
 */
function whenReady(callback) {
    if (pageReady)
        callback();
    else {
        pageReadyEvents.push(callback);
    }
}

// internal
function notifyPageReady() {
    callDialogInit(); // page is ready so call init function of the dialog
    if (headerClass) {
        lockedLayout(window, function () {
            let next = headerClass.container.nextElementSibling;
            while (next) {
                if (!next.hasAttribute('data-winborder')) {
                    next.classList.add('windowHeaderOffset' + (webApp ? '_webApp' : ''));
                    if (next.parentElement && (next.parentElement.tagName === 'BODY')) {
                        if (resizeable)
                            next.classList.add('windowContentOffset_body');
                    }
                    if (!headerClass._offsetElement)
                        headerClass._offsetElement = next;
                }
                next = next.nextElementSibling;
            }
        });
    }
    if ((!moveable && flat) && headerClass && !webApp && !resolveToValue(window.alwaysShowHeader, false))
        setVisibility(headerClass.container, false);
    pageReady = true;
    let events = pageReadyEvents;
    pageReadyEvents = [];
    events.forEach(function (event) {
        event();
    });
}

/**
Must be called whenever some layout change is made to a document, e.g. visibility or dimension of an element is changed. This way other controls can adjust their specific properties by listening to
{@link layoutchange}.

@method notifyLayoutChange
*/

/**
This event is dispatched whenever some control modifies layout in any way, or e.g. the window is resized. Custom code should manually dispatch this event by calling {@link notifyLayoutChange}.

@event layoutchange
*/

type LayoutChangeTarget = Window | HTMLElement;

function notifyCloseDropdownLists() {
    let event = createNewCustomEvent('closedropdowns', {
        bubbles: true,
        cancelable: true,
    });
    window.dispatchEvent(event);
}

declare function notifyLayoutChange(rightNow?: boolean): void;
declare function notifyLayoutChangeDown(element: LayoutChangeTarget, uniqueLayoutChangeID?: number | string): void;
declare function notifyLayoutChangeUp(element: LayoutChangeTarget): void;
declare function deferredNotifyLayoutChangeDown(element: LayoutChangeTarget, uniqueLayoutChangeID?: number | string): void;
declare function idleNotifyLayoutChangeDown(element: LayoutChangeTarget): void;
/**
Can be called to avoid any {@link layoutchange} event occurence during execution of some code.

@method lockedLayout
@param {HTMLElement} element Element where all the changes occur (its sub-tree is modified).
@param {Function} callback A function during which execution won't any layout procession occur (only on its end).
*/
declare function lockedLayout(element: LayoutChangeTarget, callback: callback): void;
declare function enterLayoutLock(element?: LayoutChangeTarget): void;
declare function leaveLayoutLock(element?: LayoutChangeTarget): void;
/**
 * @since 5.0.3
 */
declare function notifySplitterChange(): void;

interface Window {
    layoutLocked: number;
    layoutUpdateNeeded?: boolean;
    event_focusedcontrol: (e: CustomEvent) => any; // TODO update
    event_layoutchange: (e: CustomEvent) => any;
}
interface Element {
    layoutLocked: number;
    layoutUpdateNeeded?: boolean;
    event_layoutchange: (e: CustomEvent) => any;
}

(function () {
    let layoutLock = 0;
    let pendingCall = false;
    window.layoutChangeCounter = 0;

    window.notifyLayoutChange = function (rightNow) {
        if (layoutLock > 0) {
            pendingCall = true;
            return;
        }

        if (!rightNow)
            deferredNotifyLayoutChangeDown(window); // deferred, to not cumulate when e.g. many Dropdowns in Properties calls this via Dropdown._setAutoWidth
        else
            notifyLayoutChangeDown(window);
    };

    window.invalidateLayoutCache = function () {
        layoutChangeCounter++;
    };

    /**
    Can be called to avoid any {@link layoutchange} event occurence during execution of some code.

    @method lockedLayout
    @param element Element where all the changes occur (its sub-tree is modified).
    @param callback A function during which execution won't any layout procession occur (only on its end).
    */
    window.lockedLayout = function (element: LayoutChangeTarget, callback) {
        enterLayoutLock(element);
        callback();
        leaveLayoutLock(element);
    };

    window.enterLayoutLock = function (element?: LayoutChangeTarget) {
        if (!element)
            element = document.documentElement;
        element.layoutLocked = (element.layoutLocked || 0) + 1;
    };

    window.leaveLayoutLock = function (element?: LayoutChangeTarget) {
        if (!element)
            element = document.documentElement;
        if (!(--element.layoutLocked)) {
            if (element.layoutUpdateNeeded) {
                element.layoutUpdateNeeded = undefined;
                let uniqueLayoutChangeID = Date.now();
                deferredNotifyLayoutChangeDown(element, uniqueLayoutChangeID); // LS: changed to deferred version due to #17572
            }
        }
    };

    let oldlisten = app.listen;
    app.listen = function (target, event, func, capture) {
        if (event === 'layoutchange') {
            if (target != window && target instanceof Element)
                target.setAttribute('data-layoutlisten', '');
        }
        // @ts-ignore JL note: Not sure what this TS error is about (Argument of type 'IArguments' is not assignable to parameter of type '[object: any, event: string, callback: (...params: any[]) => void, capture?: boolean | undefined])
        return oldlisten.apply(this, arguments);
    };

    function sendNotifyEvent(element, uniqueLayoutChangeID) {
        let event = createNewCustomEvent('layoutchange', {
            detail: {
                uniqueLayoutChangeID: uniqueLayoutChangeID,
            },
            bubbles: false,
            cancelable: true,
        });
        element.dispatchEvent(event);
        return event.defaultPrevented;
    }

    window.notifyLayoutChangeUp = function (element) {
        //        ODS('LAYOUT UP');

        assert(element, 'Element required!');

        let event = createNewCustomEvent('layoutchange', {
            detail: {},
            bubbles: true,
            cancelable: true
        });
        if (element instanceof Element && element.parentElement) {
            element.parentElement.dispatchEvent(event);
        }
    };

    let scheduledLayoutDownTimeout: number | undefined;
    let scheduledLayoutDownCallbacks: callback[] = [];

    window.deferredNotifyLayoutChangeDown = function (element, uniqueLayoutChangeID) {
        let currentTime = Date.now();
        if (!uniqueLayoutChangeID)
            uniqueLayoutChangeID = currentTime;

        if (!element._scheduledLayoutDown) {
            element._scheduledLayoutDown = true;

            // #18338: Within a short time after window startup, throttle the number of notifyLayoutChangeDown calls
            if (!window.hasBeenShown || (currentTime - window.settings.readyTime < 2000)) {
                //ODS('deferredNotifyLayoutChangeDown: ' + currentTime + ' -- ' + window.settings.readyTime);
                if (scheduledLayoutDownTimeout)
                    clearTimeout(scheduledLayoutDownTimeout);
                scheduledLayoutDownCallbacks = scheduledLayoutDownCallbacks || [];
                scheduledLayoutDownCallbacks.push(function () {
                    element._scheduledLayoutDown = undefined;
                    if (!window._cleanUpCalled)
                        notifyLayoutChangeDown(element, uniqueLayoutChangeID);
                });
                scheduledLayoutDownTimeout = setTimeout(function () {
                    scheduledLayoutDownCallbacks.forEach(function (callback) {
                        callback();
                    });
                    scheduledLayoutDownCallbacks = [];
                    scheduledLayoutDownTimeout = undefined;
                }, 1000);
            } else {
                requestAnimationFrameMM(function () {
                    element._scheduledLayoutDown = undefined; // LS: this is important to always set -- even on closing the window (so that the re-opened window has this value correctly cleaned -- issue #18487
                    if (!window._cleanUpCalled)
                        notifyLayoutChangeDown(element, uniqueLayoutChangeID);
                });
            }
        }
    };

    window.notifySplitterChange = function () {
        let splitters = document.body.querySelectorAll('[data-control-class=Splitter]');
        splitters.forEach(itm => {
            if (itm instanceof HTMLElement && itm.controlClass)
                itm.controlClass._needsFullRecalculation = true;
        });
    };

    window.idleNotifyLayoutChangeDown = function (element: LayoutChangeTarget) {
        let uniqueLayoutChangeID = Date.now();
        if (!element._scheduledLayoutDown) {
            element._scheduledLayoutDown = true;
            requestIdleCallback(function () {
                element._scheduledLayoutDown = undefined;
                notifyLayoutChangeDown(element, uniqueLayoutChangeID);
            });
        }
    };

    window.notifyLayoutChangeDown = function (element: LayoutChangeTarget, uniqueLayoutChangeID?: number | string) {
        if (!uniqueLayoutChangeID)
            uniqueLayoutChangeID = Date.now();
        if (window.hasBeenShown) {
            layoutHandlingActive = true;
            doNotifyLayoutChangeDown(element, uniqueLayoutChangeID);
            _applyLayoutQueryCallbacks(); // Query changed layout first
            _applyStylingCallbacks(); // Then apply styles
            layoutHandlingActive = false;
            return;
        } else
            deferredNotifyLayoutChangeDown(element, uniqueLayoutChangeID);
    };

    // Renamed from window._notifyLayoutChangeDown as it was used exclusively in this code block
    function doNotifyLayoutChangeDown(element, uniqueLayoutChangeID) {
        //        ODS("notifyLayoutChangeDown Started!");
        assert(element, 'Element required!');

        let el = element;
        while (el) {
            if (el.layoutLocked) {
                //                ODS("notifyLayoutChangeDown was IGNORED.");
                el.layoutUpdateNeeded = true;
                return; // The element is locked, ignore notification
            }
            el = el.parentElement;
        }

        if (element.hasAttribute && element.hasAttribute('data-layoutlisten') && sendNotifyEvent(element, uniqueLayoutChangeID))
            return; // Don't notify descendants

        let els = qes(element, '[data-layoutlisten]'); // Get all descendants-listeners, but notify only those, where isn't another listener between us
        for (let i = 0; i < els.length; i++) {
            let el = els[i];
            let parent: HTMLElement | null = el;
            let notify = true;
            while ((parent = parent.parentElement) && parent !== element && parent.hasAttribute) {
                if (parent.hasAttribute('data-layoutlisten')) {
                    // There's another listener between this element and the notification source - don't notify this element, notify the parent only
                    notify = false;
                    break;
                }
            }

            if (notify) {
                if (!sendNotifyEvent(el, uniqueLayoutChangeID))
                    doNotifyLayoutChangeDown(el, uniqueLayoutChangeID); // Also notify descendants, if not prevented by 'el'
            }
        }

        element._lastLayoutChange = performance.now();
    }

})();

/** @since 5.0.1 */
window.uitools.openHelpContent = function () {
    let helpId: string | undefined;
    let el: Element | null = document.activeElement || document.body;
    while (el instanceof HTMLElement) {
        helpId = uitools.getHelpContext(el);
        if (helpId)
            break;
        el = el.parentElement;
    }
    if (!helpId)
        helpId = 'Content';

    if (helpId.match(/^http[s]?:\/\//gi)) { // help id contains whole link - just open it, #19031
        app.utils.web.openURL(helpId);
        return;
    }

    helpId = helpId.replace(/ /g, '_').replace(/\//g, '%2F');
    // separate anchor, if exists
    let helpArr = helpId.split('#');
    helpId = helpArr[0];
    let anchor = helpArr[1] || '';
    if (anchor) {
        anchor = '&anchor=' + anchor.replace(/ /g, '_').replace(/\//g, '%2F');
    }
    //alert(anchor);
    app.utils.web.openURL('https://www.mediamonkey.com/webhelp?hp=' + helpId + '&vmaj=' + app.versionHi + '&vmin=' + app.versionLo + '&vrel=' + app.versionRelease + '&lang=' + app.utils.getUsedLanguage() + anchor);
};

// Window resizing handling
whenReady(function () {
    let rootWidth, rootHeight, forceResize;
    window.settings.readyTime = Date.now(); // save time, when was window first ready, so controls could detect time just after app. start

    if (window.qUnit) // do not init listeners in QUnit window
        return;

    app.listen(window, 'resize', function () {
        if (window._cleanUpCalled)
            return;
        let rootEl = getRootEl();
        if (rootEl) {
            rootWidth = rootEl.clientWidth;
            rootHeight = rootEl.clientHeight;
            forceResize = (rootWidth != window.clientWidth) || (rootHeight != window.clientHeight);
        }
        deferredNotifyLayoutChangeDown(window); // notify controls about window resize, so that they don't have to listen to resize event at all
    }, true);

    let layoutChangeFunc = function () {
        if (window._cleanUpCalled)
            return;
        if (!window.resizeable && (!window.flat) && !window.noAutoSize) {
            let rootEl = getRootEl();
            if (rootEl) {
                if (rootWidth != rootEl.clientWidth || rootHeight != rootEl.clientHeight || forceResize) {
                    setComputedSize(forceResize);
                    forceResize = false;
                }
            }
        }
    };

    app.listen(window, 'layoutchange', layoutChangeFunc, true);
    requiredListen(thisWindow, 'visibilityChanged', () => {
        // to catch this event when the window is maximized        
        if (window._cleanUpCalled)
            return;               
        deferredNotifyLayoutChangeDown(window); // notify controls about window resize, so that they don't have to listen to resize event at all        
    }, true);    

    app.listen(app, 'beforeReload', function () {
        window.reloading = true; // using this peoperty we can detect reloading        
    });

    whenReady(() => {
        if (isMainWindow)
            uitools.afterReloadAnimation();
    });

    let _disabledEventHandler = function (evt) {
        // @ts-ignore - defined in popupmenu.js
        let isMainAndMenuOpen = isMainWindow && (evt instanceof KeyboardEvent) && window.isMenuVisible() /* when menu is open, block just keyboard events*/;
        if ((isElementDisabled(evt.target) || isMainAndMenuOpen) && (evt.key !== 'Tab' /* #15438 */) && (evt.key !== 'Escape' /* #15865 */)) {
            evt.preventDefault();
            evt.stopImmediatePropagation();
        }
    };
    let Events = ['click', 'dblclick', 'mousedown', 'mousemove', 'mouseover', 'mouseout', 'mouseup', 'keydown', 'keypress', 'keyup'] as (keyof HTMLElementEventMap)[];
    forEach(Events, function (e) {
        app.listen(window, e, _disabledEventHandler, true);
    });

    // handle mouse pointer location
    app.listen(document, 'mousemove', function (e) {
        window.mouseX = e.clientX;
        window.mouseY = e.clientY;
        window.mouseScreenX = e.screenX;
        window.mouseScreenY = e.screenY;
        window.mouseTarget = e.target;
    });
    app.listen(document, 'mouseleave', function (e) {
        window.mouseX = undefined;
        window.mouseY = undefined;
        window.mouseScreenX = undefined;
        window.mouseScreenY = undefined;
        window.mouseTarget = undefined;
    });
    app.listen(document, 'dragover', function (e) {
        window.mouseX = e.clientX;
        window.mouseY = e.clientY;
        window.mouseScreenX = e.screenX;
        window.mouseScreenY = e.screenY;
        window.mouseTarget = e.target;
    });
    app.listen(document, 'dragleave', function (e) {
        window.mouseX = undefined;
        window.mouseY = undefined;
        window.mouseScreenX = undefined;
        window.mouseScreenY = undefined;
        window.mouseTarget = undefined;
    });

    // F1 handling
    app.listen(window, 'keydown', function (e) {
        if (e.ctrlKey || e.altKey || e.shiftKey || (friendlyKeyName(e) !== 'F1'))
            return;
        window.uitools.openHelpContent();
    }, true);

});

/** 
 * handle disabled states
 * @since 5.0.1 
 */
function isElementDisabled(el: any) {
    if (el && (el.disabled || (el.controlClass && el.controlClass.disabled)))
        return true;
    el = elementControl(el);
    if (el)
        return el.disabled;
    return false;
}

/**
Checks whether the target element is visible. Both <i>visibility</i> and <i>display</i> style properties are checked.

@method isVisible
@param element
@param includeParents Also check all parents for visibility. Default = true
@return Whether the element is visible.
*/
function isVisible(element: HTMLElement, includeParents?: boolean): boolean {
    let vis;
    let disp;
    if (!element) return false;
    if (element._ongoingAnimation !== undefined) { // element is animating to this visible state, return this
        vis = element._ongoingAnimation;
        disp = vis;
    } else {
        vis = (element.style.visibility !== 'hidden');
        disp = (element.style.display !== 'none');
    }
    if (!disp || !vis)
        return false;
    else
    if (includeParents || includeParents === undefined) {
        if (!getParent(element))
            return true;
        else
            return isVisible(getParent(element));
    } else
        return true;
}

/**
Sets visibility of the target element. Some elements can have custom handling, others are hidden by setting <i>display</i> to none.

@param element 
@param visible Whether the element should be visible.
@return Source element.
*/
function setVisibility(element: HTMLElement, visible: boolean, params?: {
    /** Whether to force animation @default false */
    animate?: boolean;
    /** Whether to call layoutchange event @default true */
    layoutchange?: boolean;
    /** calls function after animation with source element as first parameter */
    onComplete?: () => void;
}) {
    if (!getDocumentBody().contains(element)) {
        let errorMessage = 'setVisibility can be called only on elements in DOM tree!';
        if (!element)
            errorMessage = 'setVisibility called on undefined element!';
        if (app.debug) {
            let el: HTMLElement | null = element;
            while (el) {
                if (el.__removeCallStack) {
                    errorMessage += ' Element was removed from DOM in this callstack: ' + el.__removeCallStack;
                    break;
                }
                el = el.parentElement;
            }
        }
        assert(false, errorMessage);
    }
    if (isVisible(element, false) == visible) {
        return; // No change in visibility
    }

    if (element.classList.contains('animate') || (params && params.animate))
        animTools.animateVisibility(element, visible, params); // if (params.animate == false) then it needs to be passed into animTools.animateVisibility !!  
    // notifyLayoutChange() is supposed to be called directly after completion of the animation
    else {
        animTools.notAnimateVisibility(element, visible);
        if (
            (!params || (params.layoutchange === undefined) || params.layoutchange)
            && element.parentElement
        )
            deferredNotifyLayoutChangeDown(element.parentElement);
    }

    return element;
}

/**
Sets visibility of the target element without calling layoutchange event.

@method setVisibilityFast
@param {HTMLElement} element
@param {boolean} visible
@param {Object} [params]  Additional parameters. \{animate: false\} forbid animation, \{onComplete: someFunction\} calls function someFunction after animation with source element as first parameter
@return {HTMLElement} Source element.
*/
function setVisibilityFast(element: HTMLElement, visible: boolean, params?: AnyDict) {
    params = params || {};
    params.layoutchange = false;
    setVisibility(element, visible, params);
}

/**
Toggles visibility of the element using {@link setVisibility}.

@method toggleVisibility
@param {HTMLElement} element
@param {Object} params visibility params
@return {HTMLElement} Source element.
*/
function toggleVisibility(el: HTMLElement, params?: AnyDict) {
    return setVisibility(el, !isVisible(el, false /*no parents*/), params);
}

/**
Get info whether user's using keyboard (can be used to show focus rectangle).

@method isUsingKeyboard
@return {bool} True when user's using keyboard.
*/
let usingKeyboard = false;
let usedShift = false;
let usedCtrl = false;
let usedTab = false;

function isUsingKeyboard() {
    return usingKeyboard;
}

function isUsedShift() {
    return usedShift;
}

function isUsedCtrl() {
    return usedCtrl;
}

function isUsedTab() {
    return usedTab;
}

function initializeWindow() {
    // Make sure that all the scripts are loaded and executed
    // JH: I don't know any better method to find out that all scripts were loaded and _executed_
    //     I tried to load the last JS script in <head> to get notification about this event, but the result was slower.
    if (document.readyState != 'complete' || !cssLoaded) {
        setTimeout(function () {
            initializeWindow();
        }, 1);
        return;
    }
    if (!window.qUnit) { // do not init listeners in QUnit window
        app.listen(window, 'mousedown', function (e) {
            usingKeyboard = false;
            usedTab = false;
        }, true);

        app.listen(window, 'keydown', function (e) {
            if (e.shiftKey && e.ctrlKey && e.altKey && window.inspectElementSupported) {
                ODS('Showing dev tools');
                if (devToolsUrl == '') {
                    loadDevToolsURL(function (url) {
                        showDevTools();
                    });
                } else
                    showDevTools();
            }
            usingKeyboard = true;
            usedShift = e.shiftKey;
            usedCtrl = e.ctrlKey;
            usedTab = (e.key == 'Tab') || (e.key == 'ArrowLeft') || (e.key == 'ArrowRight') || (e.key == 'ArrowUp') || (e.key == 'ArrowDown'); // arrows also count, #20797
        }, true);
    }

    finishInitializeWindow();
}

let waitingForRecomputeMP = false;
function recomputeWindowMinHeight() {
    if (waitingForRecomputeMP)
        return;
    waitingForRecomputeMP = true;
    requestTimeout(function () {
        waitingForRecomputeMP = false;
        let h = 10; // some small reserve
        let el = q('[data-dock-top]');
        if (el) {
            h += el.offsetHeight;
        }
        el = q('[data-dock-bottom]');
        if (el) {
            h += el.offsetHeight;
        }
        let els = qs('[data-dock-left]');
        let lh = 0;
        if (els) {
            for (let i = 0; i < els.length; i++) {
                el = els[i];
                if (isVisible(el)) {
                    // @ts-ignore defined in control.js
                    lh = window.getMinHeight(el);
                    break;
                }
            }
        }
        els = qs('[data-dock-right]');
        let rh = 0;
        if (els) {
            for (let i = 0; i < els.length; i++) {
                el = els[i];
                if (isVisible(el)) {
                    // @ts-ignore defined in control.js
                    rh = window.getMinHeight(el);
                    break;
                }
            }
        }
        h += Math.max(rh, lh);
        el = qid('toolbuttons');
        if (el) {
            h += el.offsetHeight;
        }
        el = qid('windowheader');
        if (el) {
            h += el.offsetHeight;
        }
        if (h < 200)
            h = 200;

        h = Math.ceil(h);
        thisWindow.bounds.setMinHeight(h);
        if (thisWindow.bounds.height < h)
            thisWindow.bounds.height = h;
    },
    animTools.animationTime);
}

declare var tooltipDiv: HTMLElement;
declare var hasBeenShown: boolean;
declare var _windowIsReady: boolean;

function finishInitializeWindow() {
    
    notifyPageLoaded();
    initializeControls(document);
    // Add Inspect Element popup command (chromium 39 or later) for document.body
    if (window.inspectElementSupported && !window.qUnit && !window.isYoutubeWindow) { // not used also in youtube window, it was causing double context menus there sometimes
        let bControl = document.body.controlClass;     
        let Control: typeof import('./controls/control').default = window['Control']; // JL: Workaround since we wish not to make mminit.js a module
        if (!bControl) {
            bControl = new Control(document.body);
            document.body.controlClass = bControl; // to allow adding context menu
        }
        bControl.contextMenu = bControl.contextMenu || [];
    }
    if (!window.qUnit) {
        // prepre tooltip control
        window.tooltipDiv = document.createElement('div');
        window.tooltipDiv.setAttribute('data-control-class', 'TooltipController');
        document.body.appendChild(tooltipDiv);
        //requirejs('controls/tooltipController');
        let TooltipController: typeof import('./controls/tooltipController').default = window['TooltipController']; // JL: Same workaround as above
        tooltipDiv.controlClass = new TooltipController(tooltipDiv);
    }

    notifyPageReady();
    requestAnimationFrame(function () { // Added here to 'force' the rendering engine to layout the document, which hopefully forces loading of fonts
        // as documents.fonts.ready() isn't enough for fonts that are in 'unloaded' state. #13729

        let refreshLoadingFonts = function () {
            let totalLoading = 0;
            document.fonts.forEach(function (font) {
                if (font.status === 'loading')
                    totalLoading++;
            });

            if (!totalLoading) {
                app.unlisten(document.fonts, 'loadingdone', refreshLoadingFonts);
                app.unlisten(document.fonts, 'loadingerror', refreshLoadingFonts);

                window.hasBeenShown = true; //#18338 JL: To skip layout changes until the first time the window is shown
                notifyLayoutChangeDown(window); // Now that everything's loaded, give controls chance to react... 
                // here another requestAnimationFrame() might be needed in case layout changes depend on it. Not added yet, we'll see if really needed.
                window._windowIsReady = true;
                if (!webApp && headerClass) {
                    requestTimeout(function () {
                        setComputedSize(false);
                        notifyOnReady(); // also notify application window is ready to show
                        if (isMainWindow)
                            recomputeWindowMinHeight();
                    }, 1);
                } else
                    notifyOnReady(); // also notify application window is ready to show
            }
        };

        app.listen(document.fonts, 'loadingdone', refreshLoadingFonts);
        app.listen(document.fonts, 'loadingerror', refreshLoadingFonts);
        refreshLoadingFonts();

        /* PETR: this code was commented because of issue in chromium 64 where loaded promise can change during loading (so stored promise in loadingFonts can never be resolved).
        
                // We go through all the fonts of the FontFaceSet, since document.fonts can remain in 'loading' state forever, until even 'unloaded' fonts are requested by HTML.
                // This results in document.fonts.ready() never being fulfilled.
                var loadingFonts = [];
                document.fonts.forEach(function (font) {
                    if (font.status === 'loading')
                        loadingFonts.push(font.loaded);
                })

                whenAll(loadingFonts).then(function () {
                    notifyLayoutChangeDown(window); // Now that everything's loaded, give controls chance to react... 
                    // here another requestAnimationFrame() might be needed in case layout changes depend on it. Not added yet, we'll see if really needed.
                    notifyOnReady(); // also notify application window is ready to show
                });*/
    });
}

function applyOptions(value, options) {
    let retVal = 0;
    if (options && resolveToValue(options.rounded, false))
        retVal = Math.ceil(value);
    else
        retVal = value;
    return checkNaN(retVal, 0);
}

function getFullHeight(control, options?) {
    let cs = getComputedStyle(control, null);
    let h = applyOptions(parseFloat(cs.getPropertyValue('height')), options);
    h += getOuterHeight(control, cs, options);
    return checkNaN(h, 1);
}

function getFullWidth(control: HTMLElement, options?: AnyDict) {
    let cs = getComputedStyle(control, null);
    let w = applyOptions(parseFloat(cs.getPropertyValue('width')), options);
    w += getOuterWidth(control, cs, options);
    return checkNaN(w, 1);
}

function getOuterHeight(control, cs?, options?) {
    if (cs === undefined) cs = getComputedStyle(control, null);
    let h = applyOptions(parseFloat(cs.getPropertyValue('border-top-width')), options);
    h += applyOptions(parseFloat(cs.getPropertyValue('border-bottom-width')), options);
    h += applyOptions(parseFloat(cs.getPropertyValue('padding-top')), options);
    h += applyOptions(parseFloat(cs.getPropertyValue('padding-bottom')), options);
    h += applyOptions(parseFloat(cs.getPropertyValue('margin-top')), options);
    h += applyOptions(parseFloat(cs.getPropertyValue('margin-bottom')), options);
    return h;
}

function getOuterWidth(control, cs?, options?) {
    if (cs === undefined) cs = getComputedStyle(control, null);
    let w = applyOptions(parseFloat(cs.getPropertyValue('border-left-width')), options);
    w += applyOptions(parseFloat(cs.getPropertyValue('border-right-width')), options);
    w += applyOptions(parseFloat(cs.getPropertyValue('padding-left')), options);
    w += applyOptions(parseFloat(cs.getPropertyValue('padding-right')), options);
    w += applyOptions(parseFloat(cs.getPropertyValue('margin-left')), options);
    w += applyOptions(parseFloat(cs.getPropertyValue('margin-right')), options);
    return w;
}

function assert(condition: any, message?: string): asserts condition {
    if (!condition) {
        message = message || 'Assertion failed';
        myAlert(message);
        throw new Error();
    }
}
window.assert = assert;

app.listen(window, 'beforeunload', function () {
    window.thisWindow.notifyOnClose();
});

/**
Translate element and all his subelements using these selectors:
    label, input, option, button, li, h1, h2, h3, h4, h5, p
Also you can let translate any other selector by adding attribute
    data-localize
You can prevent any selector to be translated by adding data-no-localize
attribute.

@param {object} el Root Element to be translated
*/
declare function translateElement(el: HTMLElement | Document): void;

/**
Translate whole document. This function calls {@link translateElement} function with document element.
*/
declare function translateDocument(): void;


let // don't forget to update tests when change these constants
    TRANSLATION_CLASS_ID_BEGIN = '{',
    TRANSLATION_CLASS_ID_END = '}';
let TRANSLATION_CLASS_ID_LEN = TRANSLATION_CLASS_ID_BEGIN.length;

(function () {
    let _getElementTranslateText = function (el) {
        let retStr = '';
        forEach(el.childNodes, function (node, index) {
            if (['B', 'STRONG', 'I', 'U', 'FONT', '#text'].indexOf(node.nodeName) < 0) { // replace by identifier
                retStr += TRANSLATION_CLASS_ID_BEGIN + index + TRANSLATION_CLASS_ID_END;
            } else {
                retStr += node.nodeName == '#text' ? node.nodeValue : node.outerHTML;
            }
        });
        return retStr;
    };

    let _storeTranslatedText = function (el, text) {
        if (text.indexOf(TRANSLATION_CLASS_ID_BEGIN) < 0) { // no classes
            el.innerHTML = text;
        } else {
            let temp = el.cloneNode(true);
            temp.innerHTML = text;
            let pos = 0;
            let lastCopy = 0;

            let copyNodes = function (fromPos, toPos) { // copy nodes
                for (let index = fromPos; index < toPos; index++) {
                    if (temp.childNodes[index] && temp.childNodes[index].innerHTML) {
                        el.childNodes[index].innerHTML = temp.childNodes[index].innerHTML;
                    }
                }
            };

            while (true) {
                pos = text.indexOf(TRANSLATION_CLASS_ID_BEGIN, pos); // find class identifier
                if (pos >= 0) {
                    pos += TRANSLATION_CLASS_ID_LEN;
                    let id = text.substr(pos, text.indexOf(TRANSLATION_CLASS_ID_END, pos) - pos); // get class id
                    copyNodes(lastCopy, pos);
                    lastCopy = pos + 1;
                } else
                    break;
            }

            if (lastCopy < temp.childNodes.length)
                copyNodes(lastCopy, temp.childNodes.length);
        }
        return el.innerHTML;
    };

    function translateInnerText(el) {
        if (el && el.localized === undefined) {
            el.lang = usedLang;
            if (el.innerHTML) {
                let translated = _(_getElementTranslateText(el));
                if (el.hasAttribute('data-add-colon'))
                    translated = translated + ':';
                if (el.hasAttribute('data-add-dots'))
                    translated = translated + '...';
                if (el.hasAttribute('data-add-question'))
                    translated = translated + '?';

                _storeTranslatedText(el, translated);
            } else if (el.textContent) {
                el.textContent = _(el.textContent);
                if (el.hasAttribute('data-add-colon'))
                    el.textContent = el.textContent + ':';
                if (el.hasAttribute('data-add-dots'))
                    el.textContent = el.textContent + '...';
                if (el.hasAttribute('data-add-question'))
                    el.textContent = el.textContent + '?';
            }
            el.localized = true;
        }
    }

    // make getElementTranslateText and storeTranslatedText public when regression test is running
    if (window.qUnit != undefined) {
        window.getElementTranslateText = _getElementTranslateText;
        window.storeTranslatedText = _storeTranslatedText;
    }

    window.translateElement = function (el) {
        let sel = 'label, input, option, button, td, legend, li, h1, h2, h3, h4, h5, p, [data-localize]';

        forEach(qes(el, sel), function (ctrl) {
            if (!ctrl.hasAttribute('data-no-localize')) {
                translateInnerText(ctrl);
                ctrl.setAttribute('data-no-localize', '1'); // in order to not localize again
            }
        });
    };

    window.translateDocument = function () {
        translateElement(document);
    };
})();

let loadHandler = function () {
    app.unlisten(window, 'load', loadHandler); // unregister load event because of full window video
    if (isMainWindow) {
        if (window['reloadInProgress']) {
            if (resolveToValue(reloadInProgress, false))
                document.body.style.opacity = '0'; // reloading app .. make body invisible and later (when everything is ready) show it using animation
        }
    }
    processIncludes(document);
    window.translateDocument();
    initializeWindow();
};
app.listen(window, 'load', loadHandler);

/**
Converts event keyCode to its name, e.g. 9 is converted to 'Tab'.

@param e Source event.
*/
declare function friendlyKeyName(e: KeyboardEvent): string;

/**
Return true when touch is using currently (method or event was thrown by touch).
@type boolean
@property usingTouch
*/
declare var usingTouch: boolean;

(function () {

    let specialCharsMapTable = {
        'Meta': 'WinKey', // Windows logo key or ⌘ key on Mac keyboards
        'Control': 'Ctrl',
        'Escape': 'Esc',
        ' ': 'Space',
        'ArrowLeft': 'Left',
        'ArrowRight': 'Right',
        'ArrowUp': 'Up',
        'ArrowDown': 'Down',
    };

    window.friendlyKeyName = function (e: KeyboardEvent) {
        // e.keyCode -- is deprecated and can be used only for ASCII (returns non-senses on some Japanse keyboards based on research)
        // e.keyIdentifier -- is deprecated too
        // e.key -- non-deprecated (recommended)
        if (specialCharsMapTable[e.key])
            return specialCharsMapTable[e.key];
        else
        if (e.key.length == 1)
            return e.key.toLowerCase(); // case insensitive in case of 'a' vs 'A'
        else if (e.key.length > 1)
            return e.key; // case sensitive in case of 'PageUp' or 'ContextMenu'
        else
            return 'Unknown'; // e.key is empty for unknown key codes, like 255
    };

    let touchFinishTimeout: number | undefined = undefined;
    let holdIndicatorStartTimeout: number | undefined = undefined;
    let holdIndicator: HTMLDivElement | undefined = undefined;

    let startHoldIndicator = (position) => {
        holdIndicator = document.createElement('div');
        holdIndicator.classList.add('holdIndicator');
        getBodyForControls().appendChild(holdIndicator);
        holdIndicator.style.left = position.left;
        holdIndicator.style.top = position.top;

        requestTimeout(() => {
            if (holdIndicator) {
                holdIndicator.setAttribute('data-active', '1');
                requestTimeout(() => {
                    if (holdIndicator) {
                        holdIndicator.setAttribute('data-finished', '1');
                    }
                }, 1000);
            }
        }, 50);

    };

    let endHoldIndicator = () => {
        if (holdIndicator) {
            holdIndicator.remove();
            holdIndicator = undefined;
        }


    };

    let touchHoldCleanUp = () => {
        if (holdIndicatorStartTimeout)
            clearTimeout(holdIndicatorStartTimeout);
        holdIndicatorStartTimeout = undefined;
        endHoldIndicator();
    };

    whenReady(function () {
        if (window.qUnit)
            return;
        app.setValue('usingTouch', false);
        app.listen(document.body, 'touchstart', function (e) {
            if (touchFinishTimeout) {
                clearTimeout(touchFinishTimeout);
                touchFinishTimeout = undefined;
            }
            app.setValue('usingTouch', true);
            if (e.touches && (e.touches.length === 1)) {
                let position = {
                    left: e.touches[0].clientX,
                    top: e.touches[0].clientY
                };
                touchHoldCleanUp();
                holdIndicatorStartTimeout = requestTimeout(() => {
                    startHoldIndicator(position);
                }, 200);
            } else {
                touchHoldCleanUp();
            }
        });
        app.listen(document.body, 'touchend', function () {
            touchFinishTimeout = setTimeout(function (e) {
                app.setValue('usingTouch', false);
            }, 20);
            touchHoldCleanUp();
        }, true);
        app.listen(document.body, 'touchmove', function () {
            touchHoldCleanUp();
        }, true);
    });
})();

Object.defineProperty(window, 'usingTouch', {
    get: function () {
        return app.getValue('usingTouch', false);
    },
    enumerable: false,
    configurable: false
});

function isLetterChar(c: string) {
    return c.toLowerCase() != c.toUpperCase(); // this will take into account also non-ASCII Unicode character classes of foreign alphabets
}

function isSingleCharKey(e: KeyboardEvent) {
    return window.friendlyKeyName(e).length == 1;
}

function _updateDisabledAttr(disabled, elem) {
    if (disabled)
        elem.setAttribute('data-disabled', '1');
    else
        elem.removeAttribute('data-disabled');
}

/**
Binds disabled state of given element to given checkbox, i.e. element gets disabled once checkbox is unchecked and vice versa

@method bindDisabled2Checkbox
@param {HTMLElement} element element to disable based on checkbox state
@param {HTMLElement} checkbox checkbox that should disable the element
*/
function bindDisabled2Checkbox(elem, checkbox) {
    if (typeof elem == 'string')
        elem = qid(elem);
    if (typeof checkbox == 'string')
        checkbox = qid(checkbox);
    let el = elem.controlClass || elem;
    el.disabled = !checkbox.controlClass.checked;    
    if (!elem.controlClass)         
        _updateDisabledAttr(el.disabled, elem);    
    checkbox.controlClass.localListen(checkbox, 'change', function () {
        el.disabled = !checkbox.controlClass.checked;
        if (!elem.controlClass)  
            _updateDisabledAttr(el.disabled, elem);
    });
    checkbox.controlClass.localListen(checkbox, 'radiochange', function () {
        el.disabled = !checkbox.controlClass.checked;
        if (!elem.controlClass)  
            _updateDisabledAttr(el.disabled, elem);
    });
}

/**
Handle captured mouse/touch move action. Should be typically called from mousedown/touchstart handler.<br>
It will add <b>elX</b> and <b>elY</b> atributes to the event object - pointer coordinates relative to the top left corner of the element <b>el</b> - and passes it to <b>moveaction</b> and <b>endaction</b> functions.

@method handleCapture
@param {HTMLElement} el bounding element
@param {Function} moveaction pointermove handler
@param {Function} endaction pointerup handler
*/
function handleCapture(el, moveaction, endaction) {
    let _elX = 0;
    let _elY = 0;
    let _szX = 0;
    let _szY = 0;
    if (el) {
        let pos = el.getBoundingClientRect();
        _elX = pos.left;
        _elY = pos.top;
        _szX = pos.width;
        _szY = pos.height;
    }
    let _getOffsetX = function (e) {
        let val;
        val = Math.max(e.clientX - _elX, 0);
        if (_szX)
            val = Math.min(val, _szX);
        return val;
    };
    let _getOffsetY = function (e) {
        let val;
        val = Math.max(e.clientY - _elY, 0);
        if (_szY)
            val = Math.min(val, _szY);
        return val;
    };
    let _pointerMoveEvent = function (e) {
        e.elX = _getOffsetX(e);
        e.elY = _getOffsetY(e);
        if (moveaction)
            moveaction(e);
    };
    let _pointerUpEvent = function (e) {
        e.elX = _getOffsetX(e);
        e.elY = _getOffsetY(e);
        app.unlisten(window, 'mouseup', _pointerUpEvent, true);
        app.unlisten(window, 'mousemove', _pointerMoveEvent, true);
        app.unlisten(window, 'touchmove', _pointerMoveEvent, true);
        app.unlisten(window, 'touchend', _pointerUpEvent, true);
        if (endaction)
            endaction(e);
    };
    app.listen(window, 'mousemove', _pointerMoveEvent, true);
    app.listen(window, 'touchmove', _pointerMoveEvent, true);
    app.listen(window, 'mouseup', _pointerUpEvent, true);
    app.listen(window, 'touchend', _pointerUpEvent, true);
}

/**
Returns true, when parameter is promise
@param obj Function to test
*/
function isPromise(obj: any): obj is Promise<any> {
    if (obj && (obj.constructor) && (obj.constructor.name === 'Promise'))
        return true;
    return false;
}
window.isPromise = isPromise;

/**
Returns true, when promise is already finished (resolved, rejected or canceled)
@param promise Promise to test
*/
function isPromiseFinished(promise: any) {
    return (promise.finished || promise.canceled || promise.handled || promise._nativeFinished);
}
window.isPromiseFinished = isPromiseFinished;

/**
Returns true, promise was canceled
@param {Promise} promise Promise to test
*/
function isPromiseCanceled(promise: any) {
    return (promise.canceled || promise._nativeCanceled);
}
window.isPromiseCanceled = isPromiseCanceled;

/**
Returns true, when parameter is Array
@param x Parameter to test
*/
function isArray(x: unknown): x is Array<any> {
    return Array.isArray(x);
    // return Object.prototype.toString.call(x) === '[object Array]';
}
window.isArray = isArray;

/**
Returns true, when parameter is Object literal
@param x Parameter to test
*/
function isObjectLiteral(x: unknown): x is Record<any, any> {
    return ((!!x) && (x.constructor === Object));
}
window.isObjectLiteral = isObjectLiteral;

/**
Returns true, when parameter is String
@param {any} x Parameter to test
*/
function isString(x: unknown): x is string {
    return (typeof x === 'string');
}
window.isString = isString;

/**
Tries to evaluate content, returns the result or undefined (error)
@param {string} content Parameter to evaluate
@return {unknown} Evaluated content or undefined
*/
function tryEval(content: string) {
    try {
        let res = (new Function('return ' + content + ';'))();
        return res;
    } catch (err) {
        ODS('Error during evaluation, ' + err);
        return undefined;
    }
}
window.tryEval = tryEval;

/**
Returns style value from the CSS for given selector
@method getStyleRuleValue
@param {string} style Name of the style
@param {string} selector Selector in CSS
@return {string}
*/
function getStyleRuleValue(style, selector) {
    let sheets = document.styleSheets;
    let l = sheets.length;
    for (let i = 0; i < l; i++) {
        let sheet = sheets[i];
        if (!sheet || !sheet.cssRules) {
            continue;
        }
        for (let j = 0, k = sheet.cssRules.length; j < k; j++) {
            let rule = sheet.cssRules[j];
            // ODS('*** CSS: '+rule.selectorText+' - '+rule.cssText);
            if (rule instanceof CSSStyleRule) {
                if (rule.selectorText && (rule.selectorText.split(',').indexOf(selector) !== -1)) {
                    return rule.style[style];
                }
            }
        }
    }
    return undefined;
}
window.getStyleRuleValue = getStyleRuleValue;

// JH: Since the current code of this function is more or less obvious, should we rather move it to a class and get rid of this function?
function adjustImgAR(img: HTMLImageElement) {
    if (img && img.style) {
        img.style.width = 'auto';
        img.style.height = 'auto';
        img.style.maxWidth = '100%';
        img.style.maxHeight = '100%';
    }

    // JH: The code below doesn't seem to be necessary. At least not, unless we want to upscale smaller images?    
    //     if (img.naturalHeight > img.naturalWidth) {
    //         img.style.width = "auto";
    //         img.style.height = "inherit";
    //     } else {
    //         img.style.height = "auto";
    //         img.style.width = "inherit";
    //     }
}
window.adjustImgAR = adjustImgAR;

// JL: Moved loadDevToolsURL to a global function and has it return undefined when isStubb/webApp is true.
// Get DevTools JSON info and parse URL.
function loadDevToolsURL(callback?: (url: string) => void) {
    if (!webApp && !isStub) {
        let xmlhttp = new XMLHttpRequest();
        xmlhttp.onreadystatechange = function () {
            if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
                ODS('Page DevTools JSON ' + xmlhttp.responseText);
                let obj = JSON.parse(xmlhttp.responseText);
                for (let i = 0; i < obj.length; i++) {
                    if (obj[i].url.indexOf(window.url) >= 0) {
                        window.devToolsUrl = obj[i].devtoolsFrontendUrl;
                        break;
                    }
                }
                if (callback)
                    callback(window.devToolsUrl);
            }
        };
        xmlhttp.open('GET', 'http://localhost:9222/json', true);
        xmlhttp.send();
    }
}

if (!webApp && !isStub) {
    loadDevToolsURL();
}

function checkUIDAssiged(el) {
    if(el.hasAttribute('data-uniqueID'))
        return el.getAttribute('data-uniqueID');
    let uid = createUniqueID();
    el.setAttribute('data-uniqueID', uid);
    return uid;
}

/**
Computes width of the text in pixels, based on given parent control. If no parent control is set, document.body is used.
@method getTextWidth
@param {string} txt Source text.
@param {HTMLElement} [parentEl] Parent control. The default is body element.
@return {Number}
*/
function getTextWidth(txt, parentEl) {
    parentEl = parentEl || getDocumentBody();
    let uid = checkUIDAssiged(parentEl);
    window.cachedStyleValues = window.cachedStyleValues || {};
    window.cachedStyleValues.computedWidths = window.cachedStyleValues.computedWidths || {};
    let cw = window.cachedStyleValues.computedWidths;
    cw[uid] = cw[uid] || {};
    if (cw[uid][txt] === undefined) {
        let div = document.createElement('div');
        div.style.position = 'absolute';
        div.style.left = '-1000px';
        div.style.top = '-1000px';
        div.style.whiteSpace = 'nowrap';
        div.textContent = txt;
        parentEl.appendChild(div);
        cw[uid][txt] = parseFloat(getComputedStyle(div).width) + 1;
        parentEl.removeChild(div);
    }
    return cw[uid][txt];
}

/**
Converts value in em to pixels, based on given parent control. If no parent control is set, document.body is used.
@method emToPx
@param emNum Source value in em.
@param parentEl Parent control. The default is body element.
*/
function emToPx(emNum: number, parentEl?: HTMLElement): number {
    let emNumF = parseFloat(emNum);
    if (isNaN(emNumF))
        return 0;
    parentEl = parentEl || getDocumentBody();
    let uid = checkUIDAssiged(parentEl);
    window.cachedStyleValues = window.cachedStyleValues || {};
    window.cachedStyleValues.emToPxKoefs = window.cachedStyleValues.emToPxKoefs || {};
    let koef = window.cachedStyleValues.emToPxKoefs;

    if (koef[uid] === undefined) {
        let div = document.createElement('div');
        div.style.height = '1em';
        div.style.position = 'absolute';
        div.style.left = '0px';
        div.style.top = '0px';
        div.style.display = 'none';
        parentEl.appendChild(div);
        koef[uid] = parseFloat(getComputedStyle(div).height);
        parentEl.removeChild(div);
        if (isNaN(koef[uid]) && (parentEl !== getDocumentBody())) {
            // some parent not added to DOM, use default body size
            koef[uid] = undefined;
            return emToPx(emNum);
        }
    }
    return Math.round(koef[uid] * emNumF);
}

/**
Converts value in pixels to em, based on given parent control. If no parent control is set, document.body is used.
@method pxToEm
@param {Number} pxNum Source value in pixels.
@param {HTMLElement} [parentEl] Parent control. The default is body element.
@return {Number}
*/
function pxToEm(pxNum: number, parentEl?: HTMLElement) {
    let pxNumF = parseFloat(pxNum);
    if (isNaN(pxNumF))
        return 0;
    let em1 = emToPx(1, parentEl);
    if (!em1)
        return 0;
    return pxNumF / em1;
}

let fontLineSize = undefined;


/**
Get value of @fontLineSize, in px.
@method fontLineSizePx
@return {Number}
*/
function fontLineSizePx() {
    let documentBody = getDocumentBody();
    if (fontLineSize === undefined) {
        let div = document.createElement('div');
        div.className = 'fontLineSize';
        div.style.position = 'absolute';
        div.style.left = '0px';
        div.style.top = '0px';
        div.style.display = 'none';
        documentBody.appendChild(div);
        fontLineSize = parseFloat(getComputedStyle(div).height);
        documentBody.removeChild(div);
    }
    return fontLineSize;
}

let _fontSize = undefined;

function fontSizePx() {
    if (_fontSize === undefined) {
        let bodycs = getComputedStyle(getDocumentBody(), null);
        _fontSize = parseFloat(bodycs.fontSize);
    }
    return _fontSize;
}

registerStyleCleanup(() => {
    fontLineSize = undefined;
    _fontSize = undefined;
    if(window.cachedStyleValues && window.cachedStyleValues.starTemplates) {
        for (let tname in window.cachedStyleValues.starTemplates) {
            let el = window.cachedStyleValues.starTemplates[tname];
            if(el)
                el.remove();
        }
    }
    window.cachedStyleValues = undefined;
});

(function () {
    let uniqueID = 1;
    window.createUniqueID = function () {
        return 'uniqueID_' + uniqueID++;
    };
})();

requirejs('binding.js');

/**
Custom extensions of the default JS Object.

@class Object
*/

interface Object {
    override: <T> (this: T, overrideProps: {
        [key in keyof T]?: 							// Only allow .override() on existing methods of the object
        T[key] extends (...args: any) => any ? 	// Filter to only allow it on function properties of objects
        (
            $super: T[key],
            ...params: Parameters<T[key]> 		// Same parameters as rest parameters
        ) => ReturnType<T[key]> 				// Must return the same type
        : never;
    }) => void;
}

/**
Overrides a method of an object. The method doesn't have to exist yet in the object, i.e. non-existing method can be overriden. 
All the supplied functions are expected to have the first argument '$super'. E.g.:

    myClass.prototype.override( {
        someMethod: function ($super, param1, param2) {
            return $super(param1, param2);
            // ....
        }
    });
@method override
@param {Object} source Properties of object to override
*/

Object.defineProperty(Object.prototype, 'override', {
    enumerable: false, // So that it doesn't appear in for..in loops
    value: function (source) {
        let properties = Object.keys(source);

        // must be as a function otherwise newmethod and oldmethod is always last value
        let getNewMethod = function (this: any, property) {
            let newmethod = source[property],
                oldmethod = this[property];

            let method = function (this: any) {
                let fn;
                if (oldmethod && typeof oldmethod !== 'function') {
                    // it's a property
                    return newmethod;
                } else {
                    if (oldmethod)
                        fn = oldmethod.bind(this);
                    else
                        fn = function () { }; // An empty function, just to create something to be called as $super().
                    let a = [fn],
                        arrLength = a.length,
                        length = arguments.length;
                    while (length--) a[arrLength + length] = arguments[length];
                    return newmethod.apply(this, a);
                }
            };
            return method;
        }.bind(this);

        for (let i = 0, length = properties.length; i < length; i++) {
            let property = properties[i];
            this[property] = getNewMethod(property);
        }
    }
});

(function () {

    if (app.debug && window['domRemoveDetails'] /* added switch to enable this debug functionality */) {
        // this handlers are used for setVisibility to have more details, when node is not in DOM.
        let register = function (el, subs?) {
            if (subs) {
                register(el);
                let elements = qes(el, '*');
                elements.forEach(function (element) {
                    register(element);
                });
            } else {
                if (!el.__removeRegistered) {
                    el.__removeRegistered = app.listen(el, 'DOMNodeRemovedFromDocument', function () {
                        el.__removeCallStack = app.utils.logStackTrace();
                    });
                }
            }
        };

        Element.prototype.override({
            appendChild: function ($super, node) {
                register(node, true);
                return $super(node);
            }
        });

        whenReady(function () {
            register(document.documentElement, true);
        });


        // MutationObserver wasn't used because it's batch processing (callback is not called immediatelly)
        /*    var callback = function (list, sender) {
                //this.__removeCallStack = app.utils.logStackTrace();
                
                
            };
            
            var mutationObserver = new MutationObserver(callback);
            mutationObserver.observe(document.documentElement, {
                childList: true,
                subtree: true
            });*/


    }

    // #19606 .. set proper lang variable to all new DOM nodes so asian strings will show correctly
    Element.prototype.override({
        appendChild: function ($super, node) {
            // @ts-ignore
            node.lang = usedLang;
            return $super(node);
        }
    });

})();

/**
 * @class Window
 */

/**
Tests object for its emptiness

@method isEmptyObject
@param {Object} object object to test
@return {Boolean} returns true if the object is empty
*/
function isEmptyObject(obj: unknown): obj is Record<string, never> {
    return Object.keys(obj).length == 0;
}

/**
Merges two objects into one, props of object2 overrides object1 props/methods
@method mergeObjects
@param {Object} o1 object1
@param {Object} o2 object2
@return {Object} merged object
*/
function mergeObjects(o1, o2) {
    let res = {};

    for (let key in o1)
        res[key] = o1[key];

    for (let key in o2)
        res[key] = o2[key];

    return res;
}

/**
Merges two objects into one, props of object2 overrides object1 props/methods, but arrays are merged
@method advancedMergeObjects
@param {Object} o1 object1
@param {Object} o2 object2
@return {Object} merged object
*/
function advancedMergeObjects(o1, o2) {
    let res = {};

    for (let key in o1)
        res[key] = o1[key];

    for (let key in o2) {
        if (res[key] && typeof res[key] === 'object' && res[key].length && typeof res[key].concat === 'function' && typeof o2[key] === 'object') {
            res[key] = res[key].concat(o2[key]);
        } else
            res[key] = o2[key];
    }

    return res;
}

/**
Makes copy of object
@method copyObject
@param {Object} object object to copy
@return {Object} object copy of the object
*/
function copyObject(obj) {
    let copy;

    // Handle the 3 simple types, and null or undefined
    if ((null == obj) || ('object' != typeof obj) || (obj && obj.native)) return obj;

    // Handle Date
    if (obj instanceof Date) {
        copy = new Date();
        copy.setTime(obj.getTime());
        return copy;
    }

    // Handle Array
    if (obj instanceof Array) {
        copy = [];
        for (let i = 0, len = obj.length; i < len; i++) {
            copy[i] = copyObject(obj[i]);
        }
        return copy;
    }

    // Handle Object
    if ((obj instanceof Object) || (typeof obj === 'object' /* object from different context return false for instanceof */)) {
        copy = {};
        for (let attr in obj) {
            if (obj.hasOwnProperty(attr)) copy[attr] = copyObject(obj[attr]);
        }
        return copy;
    }

    throw new Error('Unable to copy obj! Its type isn\'t supported.');
}

function getFocusAttribute() {
    return 'data-keyfocused';
}

function setFocusState(element: HTMLElement, state?: boolean, setFocus?: boolean) {
    //ODS('--- setFocusState ' + state + ', ' + element.getAttribute('data-id'));
    if (setFocus) {
        element.focus();
    }
    if (element.focusContainer) { // we should make focused container of this element (e.g. checkbox)
        element = element.focusContainer;
    }
    if (element.controlClass) { // it's control, so run his focus handler
        element.controlClass.focusHandler(element, state);
    } else {
        if (state)
            element.setAttribute(getFocusAttribute(), '1');
        else
            element.removeAttribute(getFocusAttribute());
    }
}

declare function showSelectionLayer(show): void;
declare function updateLassoPosition(div, fromX, fromY, toX, toY): void;


(function () {

    const focusinhandler = function (e) {
        const el = e.target;

        if (isUsedTab() && !el.hasAttribute(getFocusAttribute())) {
            setFocusState(el, true);
        }
        e.stopPropagation();
    };

    const focusouthandler = function (e) {
        const el = e.target;
        setFocusState(el, false);
        e.stopPropagation();
    };

    const isContentBasedControl = function (ctrl) {
        return ctrl.hasMediaContent;
    };

    app.listen(window, 'focusin', focusinhandler);
    app.listen(window, 'focusout', focusouthandler);
    app.listen(window, 'focusedcontrol', function (evt) {
        const ctrl = evt.detail.control;
        if (ctrl) {
            if (ctrl.canBeUsedAsSource) {
                window.lastFocusedControl = ctrl.container;
                // for getSelectedDataSource we need to have stored last focused LV used for content (like tracklist, albums etc.), but not Media Tree etc.
                if (isContentBasedControl(ctrl))
                    window._lastFocusedLVControl = ctrl.container;
            }
        } else
            window.lastFocusedControl = undefined;
        evt.stopPropagation();
    });

    app.listen(window, 'dragover', function (e) {
        if (!e.defaultPrevented) { // nobody handled this event
            e.dataTransfer.dropEffect = 'none'; // disable D&D when no handler found
            e.stopPropagation();
            e.preventDefault();
        }
    });

    // lasso selection indicator
    let selectionLayer: HTMLDivElement | null = null;
    let nearestControl: HTMLElement | null = null;
    let nearestControlBounds: DOMRect | null = null;

    let initializeSelectionLayer = function () {
        let newSelectionLayer = document.createElement('div');
        newSelectionLayer.classList.add('lassoLayer');
        newSelectionLayer.classList.add('ignoreMouse'); // to ignore mouse events ... it's just visual representation of mouse lasso selection
        getBodyForControls().appendChild(newSelectionLayer);
        setVisibility(newSelectionLayer, false);
        return newSelectionLayer;
    };

    let findNearestParentControlType = function (ctrl, lookForScroller?: boolean): HTMLElement | null {
        while (ctrl) {
            if (ctrl.controlClass && ((ctrl.controlClass.lassoParentElement && !lookForScroller) || (ctrl.controlClass.lassoParentElementScroller && lookForScroller)))
                return ctrl;
            ctrl = window.getParent(ctrl);
        }
        return null;
    };

    window.showSelectionLayer = function (show) {
        if (!selectionLayer || !isChildOf(getBodyForControls(), selectionLayer))
            selectionLayer = initializeSelectionLayer();

        setVisibility(selectionLayer, show);
        if (!show) {
            nearestControl = null;
            nearestControlBounds = null;
        }
    };

    window.cleanUpLasso = function () {
        selectionLayer = null;
        nearestControl = null;
        nearestControlBounds = null;
    };

    window.updateLassoPosition = function (div, fromX, fromY, toX, toY) {

        let pos = div.getBoundingClientRect();

        let newleft = pos.left + Math.min(fromX, toX);
        let newtop = pos.top + Math.min(fromY, toY);
        let newwidth = Math.abs(fromX - toX);
        let newheight = Math.abs(fromY - toY);

        // get parent scroller or listview
        if (!nearestControl) {
            nearestControl = findNearestParentControlType(div, true /* look for scroller */);
            if (!nearestControl)
                nearestControl = findNearestParentControlType(div);

            if (nearestControl)
                nearestControlBounds = nearestControl.getBoundingClientRect();
        }

        if (nearestControlBounds) {
            let parpos = nearestControlBounds;
            if (newleft < parpos.left) {
                newwidth -= parpos.left - newleft;
                newleft = parpos.left;
            }
            if (newtop < parpos.top) {
                newheight -= parpos.top - newtop;
                newtop = parpos.top;
            }
            if (newtop + newheight > parpos.bottom) {
                newheight = parpos.bottom - newtop;
            }
            if (newleft + newwidth > parpos.right) {
                newwidth = parpos.right - newleft;
            }
        }

        if (!selectionLayer)
            selectionLayer = initializeSelectionLayer();

        selectionLayer.style.left = newleft;
        selectionLayer.style.top = newtop;
        selectionLayer.style.width = newwidth + 'px';
        selectionLayer.style.height = newheight + 'px';
    };


})();

declare function removeThe(str: string): string;

(function () {

    let ignoreThe = true;
    let theStrings = ['the'];

    window.removeThe = function (str) {
        if (ignoreThe && str) {
            let s = str;
            theStrings.forEach(function (mask) {
                if (s.toLowerCase().startsWith(mask + ' ')) {
                    s = s.slice(mask.length + 1);
                }
            });
            return s;
        }
        return str;
    };

    function loadSettings() {
        let sett = window.settings.get('Options');
        ignoreThe = sett.Options.IgnoreTHEs;
        theStrings = sett.Options.IgnoreTHEStrings.split(',');
    }

    app.listen(app, 'settingsChange', function () {
        loadSettings();
    });
    loadSettings();


    let mqString = '(resolution: ' + devicePixelRatio + 'dppx)';
    const updatePixelRatio = () => {
        window.thisWindow.updateDevicePixelRatio();
    };
    updatePixelRatio();
    matchMedia(mqString).addListener(updatePixelRatio);

})();

/** @hidden */
function AbortError(this: Error, stack: string) {
    this.name = 'AbortError';
    this.message = 'Promise was canceled!';
    this.stack = stack;
}
/** @hidden */
AbortError.prototype = Error.prototype;

function getAbortError(stack: string) {
    return new AbortError(stack);
}

function isError(x: unknown): x is Error {
    return x instanceof Error;
}

function isAbortError(x: unknown): x is typeof AbortError {
    return x instanceof AbortError;
}

/**
Cancels given promise (if not null and if can/need to be be canceled)
@method cancelPromise
@param {Promise} pr promise
*/
function cancelPromise(pr) {
    if (pr) {
        if (pr.cancel && isFunction(pr.cancel))
            pr.cancel();
        if (pr.docancel && isFunction(pr.docancel))
            pr.docancel();
        else
            pr.canceled = true; // for asyncGenerator

        if (pr.onCanceled && isFunction(pr.onCanceled))
            pr.onCanceled();
    }
}

function inArray(what: any, ar: Array<any>, ignoreCase?: boolean) {
    let length = ar.length;
    for (let i = 0; i < length; i++) {
        if (ignoreCase) {
            if (ar[i].toLowerCase() == what.toLowerCase())
                return true;
        } else {
            if (ar[i] == what)
                return true;
        }
    }
    return false;
}

function bindAction(action, object) {
    let act = copyObject(action);
    act.boundObject = object; // can be function or object
    return act;
}

Object.defineProperty(Array.prototype, 'insert', {
    enumerable: false, // so that it doesn't appear in for..in loops
    value: function (index, item) {
        this.splice(index, 0, item);
    }
});

Object.defineProperty(Array.prototype, 'delete', {
    enumerable: false, // so that it doesn't appear in for..in loops
    value: function (index, item) {
        this.splice(index, 1);
    }
});

Object.defineProperty(Array.prototype, 'move', {
    enumerable: false, // so that it doesn't appear in for..in loops
    value: function (from, to) {
        this.splice(to, 0, this.splice(from, 1)[0]);
    }
});

function getDistinctArray(ar) {
    /* with complexity O(n2) :
    return ar.filter(function (item, pos, self) {
        return self.indexOf(item) == pos;
    });*/
    // with complexity O(n) :
    let dups = {};
    return ar.filter(function (el) {
        let hash = el.valueOf();
        let isDup = dups[hash];
        dups[hash] = true;
        return !isDup;
    });
}

function getSortedAsArray<T>(items: Array<T> | Dictionary<T>) {
    let retitems: Array<T & { order: number, key: string }> = [];
    let item;
    let keys = Object.keys(items);
    for (let i = 0; i < keys.length; i++) {
        item = items[keys[i]];
        if (item.order === undefined)
            item.order = 10 * (i + 1);
        item.key = keys[i];
        retitems.push(item);
    }
    retitems.sort(function (i1, i2) {
        let retval = i1.order - i2.order;
        return retval;
    });
    return retitems;
}

function isChildOf(parent?: Element|null, child?: Element|null) {
    if (!child || !parent)
        return false;
    let node = child.parentNode;
    while (node != null) {
        if (node == parent) {
            return true;
        }
        node = node.parentNode;
    }
    return false;
}

declare var lastFocusedControl: HTMLElement | undefined;
let _lastFocusedControl;
Object.defineProperty(window, 'lastFocusedControl', {
    set: function (val) {
        _lastFocusedControl = val;
    },
    get: function () {
        return _lastFocusedControl;
    }
});

interface Number {
    between: (a, b) => boolean;
}
Number.prototype.between = function (a, b) {
    let min = Math.min.apply(Math, [a, b]),
        max = Math.max.apply(Math, [a, b]);
    return this >= min && this <= max;
};

requirejs('sprintf');
requirejs('animationTools.js');

// todo put this in mmstub?
if (webApp && !oneSourceApp) {
    requirejs('controls/html5PlayerController');
    app.player = getPlayer();
}

