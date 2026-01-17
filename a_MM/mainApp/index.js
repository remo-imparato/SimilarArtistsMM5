/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

window.appSourcesPackage = null;
window._scripts = [];
window._scriptsStartup = [];
var __this = this;
var __currentSkinName = app.currentSkin().id.toLowerCase();
var __currentLayoutName = app.currentLayout().id.toLowerCase();

function getAllUrlParams(url) {

    // get query string from url (optional) or window
    var queryString = url ? url.split('?')[1] : window.location.search.slice(1);

    // we'll store the parameters here
    var obj = {};

    // if query string exists
    if (queryString) {

        // stuff after # is not part of query string, so get rid of it
        queryString = queryString.split('#')[0];

        // split our query string into its component parts
        var arr = queryString.split('&');

        for (var i = 0; i < arr.length; i++) {
            // separate the keys and the values
            var a = arr[i].split('=');

            // in case params look like: list[]=thing1&list[]=thing2
            var paramNum = undefined;
            var paramName = a[0].replace(/\[\d*\]/, function (v) {
                paramNum = v.slice(1, -1);
                return '';
            });

            // set parameter value (use 'true' if empty)
            var paramValue = typeof (a[1]) === 'undefined' ? true : a[1];

            // (optional) keep case consistent
            paramName = paramName.toLowerCase();
            paramValue = paramValue.toLowerCase();

            // if parameter name already exists
            if (obj[paramName]) {
                // convert value to array (if still string)
                if (typeof obj[paramName] === 'string') {
                    obj[paramName] = [obj[paramName]];
                }
                // if no array index number specified...
                if (typeof paramNum === 'undefined') {
                    // put the value on the end of the array
                    obj[paramName].push(paramValue);
                }
                // if array index number specified...
                else {
                    // put the value at that index number
                    obj[paramName][paramNum] = paramValue;
                }
            }
            // if param name doesn't exist yet, set it
            else {
                obj[paramName] = paramValue;
            }
        }
    }

    return obj;
}

// scan folders for scripts/skins/layouts
function scanFolders() {

    var addToList = function (str, list) {
        if (list.lastIndexOf(str) == -1) {
            list.push(str);
        }
    }

    var getName = function (str) {
        var n = str.indexOf('-');
        if (n > 0) {
            return str.substr(0, n);
        } else
            return str;
    }

    for (var props in window.appSourcesPackage) {
        if (props.substr(0, 8) === 'scripts-') {
            addToList(getName(props.substr(8)), window._scripts);
        } else if (props.substr(0, 15) === 'scriptsstartup-') {
            addToList(getName(props.substr(15)), window._scriptsStartup);
        }
    }
}

function prepareArrays() {
    scanFolders();
}

window.fixFile = function (fname) {
    if (fname.slice(0, 8) === 'file:///')
        fname = fname.slice(8);
    return fname;
}

window.customLoader = function (fname, callback, params) {
    window.callODS('customLoader: Loading file ' + fname);

    var async = (callback !== undefined);
    var parseParam = function (param, def) {
        if (!params) {
            return def;
        } else {
            return resolveToValue(params[param], def);
        }
    };
    fname = fixFile(fname);

    var content = '';
    fname = fname.replace("\\", "/");
    fname = fname.replace(new RegExp('/', "g"), '-').toLowerCase();

    var appendFile = function (fn, add, scriptName) {
        if (window.appSourcesPackage[fn]) {
            var addScriptName = function () {
                if (fn.lastIndexOf('.js') > 0 && scriptName) {
                    content = content + '\nvar __scriptName = "' + scriptName + '";';
                }
            };

            addScriptName();
            if (content) content = content + '\n';
            content = content + atob(window.appSourcesPackage[fn]);

            return true;
        }
        return false;
    }

    var loadInternal = function (fname, add) {
        // process scripts
        for (var i = 0; i < window._scripts.length; i++) {
            var scriptID = 'scripts-' + window._scripts[i];
            if (fname.substr(0, scriptID.length + 1) == scriptID + '-')
                addfile = fname;
            else
                addfile = scriptID + '-' + fname;
            if (appendFile(addfile, add, scriptID) && !add) return true;
        }
        for (var i = 0; i < window._scriptsStartup.length; i++) {
            var scriptID = 'scriptsstartup-' + window._scriptsStartup[i];
            if (fname.substr(0, scriptID.length + 1) == scriptID + '-')
                addfile = fname;
            else
                addfile = scriptID + '-' + fname;
            if (appendFile(addfile, add, scriptID) && !add) return true;
        }

        // check skin
        var addfile = 'skins-' + __currentSkinName + '-' + fname;
        if (appendFile(addfile) && !add) return true;

        // now layout
        addfile = 'layouts-' + __currentLayoutName + '-' + fname;
        if (appendFile(addfile) && !add) return true;

        // main file
        if (!add)
            if (appendFile(fname) && !add) return true;

        return false;
    };

    loadInternal(fname, false);

    // append _add files
    var ext = fname.lastIndexOf('.');
    if (['.js', '.less', '.html'].indexOf(fname.substr(ext)) >= 0) {
        fname = fname.substr(0, ext) + '_add' + fname.substr(ext);
        loadInternal(fname, true);
    }

    if (async) {
        callback(content, {
            getResponseHeader: function () {
                return '';
            }
        });
    } else {
        return content;
    }

}

window.prepareSourceURL = function (url) {
    url = url.replace(new RegExp('-', "g"), '/');
    return 'file:///' + url;
}

window.extendedFixFile = function (fname) {
    if (fname.indexOf('mainApp/') >= 0)
        return fname.replace('mainApp/', '');
    return fname;
}

function callWindowLoadEvent() {
    notifyLoaded();

    var event = createNewEvent('load');
    window.dispatchEvent(event);
}

function callScriptsInit() {
    for (var i = 0; i < window._scripts.length; i++) {
        var addfile = 'scripts-' + window._scripts[i] + '-init.js';
        if (window.appSourcesPackage[addfile]) {
            requirejs(addfile);
        }
    }
}

// main method for running app
function runApp(initScripts) {

    var restoreRequired = false;

    for (var i = 0; i < initScripts.length; i++) {
        var script = initScripts[i];
        var code = window.customLoader(script);

        code = code + String.fromCharCode(13) + String.fromCharCode(10) + ' //@ sourceURL=' + window.prepareSourceURL(script);
        //__this.eval.call(null, code);
        executeCode(code);
    }

    callWindowLoadEvent();

    if (isMainWindow)
        callScriptsInit();

};

// Loads file content
function _loadFile(fname, callback, method, sync) {
    var async = callback !== undefined;
    var request = new XMLHttpRequest();
    if (async) {
        request.onreadystatechange = function () {
            if (request.readyState == request.DONE) {
                if (request.status === 0 || request.status === 200)
                    callback.call(window, request.responseText, request);
                else {
                    callback.call(window, '', request);
                }
            }
        };
    }

    request.open(method || 'GET', fname, (sync !== undefined ? false : async));
    request.send(fname);
    if (sync) {
        callback.call(window, request.responseText, request);
    }
    if (!async) {
        return request.responseText;
    }
}


function loadSource() {
    prepareArrays();

    var src = getAllUrlParams().src;

    var srcContent = customLoader(src);

    // get folder from src
    var folder = '';
    var last = src.lastIndexOf('/');
    if (last >= 0) {
        folder = src.substring(0, last + 1);
    }

    // once we have loaded source html we need to parse

    // first enum all 'script' tags
    var regex1 = RegExp('src="(.*)"><\/script>', 'gi');
    var array1;
    var scripts = [];
    while ((array1 = regex1.exec(srcContent)) !== null) {
        var scriptName = array1[1];
        var qoutesPos = scriptName.indexOf('"');
        if (qoutesPos !== -1) {
            scriptName = scriptName.substring(0, qoutesPos);
        }
        if (scriptName.indexOf('file://') === -1) { // it's relative path
            scriptName = folder + scriptName;
        }
        scripts.push(scriptName);
    }

    // not whole body and put it into outerHTML
    var justBody = srcContent.match(/(<body .*<\/body>)/gims);

    document.body.outerHTML = justBody;

    window.runApp.call(window, scripts);
}

if (!isMainWindow) {
    var mainWnd = app.dialogs.getMainWindow();
    window.appSourcesPackage = mainWnd.getValue('appSourcesPackage');

    setTimeout(loadSource, 1); // need to by async as we need to have access body
} else {
    console.log(__currentSkinName);
    // load main sources file and then run app
    _loadFile('file:///mm5content.json', function (data) {
        try {
            window.appSourcesPackage = JSON.parse(data);
        } catch (err) {
            alert(err);
        }
        loadSource();
    });
}
