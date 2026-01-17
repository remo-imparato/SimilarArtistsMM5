/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

window.appSourcesPackage = null;
window.webAppIdentifier = 'webApp';

window._currentSkin = 'default';
window._currentLayout = 'Desktop';
window._skins = [];
window._layouts = [];
window._scripts = [];
window._scriptsStartup = [];
window.storageSupported = (typeof (Storage) !== 'undefined');

window.storageGetValue = function (id, def) {
    if (storageSupported) {
        var data = localStorage.getItem(id);
        if (data) {
            if ((def && (typeof def === 'object')) || (data.length > 0 && (data[0] == '[' || data[0] == '{'))) {
                return JSON.parse(data);
            }
            return data;
        } else
            return def;
    } else
        alert('Local storage is not supported!');
};

window.storageSetValue = function (id, value) {
    if (storageSupported) {
        var dataToStore = value;
        if (dataToStore && (typeof dataToStore === 'object')) {
            dataToStore = JSON.stringify(dataToStore);
        }
        localStorage.setItem(id, dataToStore);
    } else
        alert('Local storage is not supported!');
};

window.storageClear = function () {
    if (storageSupported) {
        localStorage.clear();
    } else
        alert('Local storage is not supported!');
};

window.storageRemoveItem = function (id) {
    if (storageSupported) {
        localStorage.removeItem(id);
    } else
        alert('Local storage is not supported!');
};

window.getCommandSeparator = function () {
    return '|';
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
        if (props.substr(0, 6) === 'skins-') {
            addToList(getName(props.substr(6)), window._skins);
        } else if (props.substr(0, 8) === 'layouts-') {
            addToList(getName(props.substr(8)), window._layouts);
        } else if (props.substr(0, 8) === 'scripts-') {
            addToList(getName(props.substr(8)), window._scripts);
        } else if (props.substr(0, 15) === 'scriptsstartup-') {
            addToList(getName(props.substr(15)), window._scriptsStartup);
        }
    }

    if (window._skins.indexOf('default') < 0)
        window._skins.push('default');
    if (window._layouts.indexOf('default') < 0)
        window._layouts.push('default');
}

function prepareArrays() {
    scanFolders();
    window._skins.sort(function (a, b) {
        if (a === 'default') return -1;
        else if (b === 'default') return 1;
        else return a - b;
    });
    window._layouts.sort(function (a, b) {
        if (a === 'default') return -1;
        else if (b === 'default') return 1;
        else return a - b;
    });
}

window.prepareSourceURL = function (url) {
    url = url.replace(new RegExp('-', "g"), '/');
    return window.location.href + url;
}

// Loads file content (synchronously).
function _loadFile(fname, callback, method, sync) {
    var async = callback !== undefined;
    var request = new XMLHttpRequest();
    if (async) {
        request.onreadystatechange = function () {
            if (request.readyState == request.DONE) {
                if (request.status === 0 || request.status === 200)
                    callback.call(window, request.responseText);
                else {
                    callback.call(window, '');
                }
            }
        };
    }

    request.open(method || 'GET', fname, (sync !== undefined ? false : async));
    request.setRequestHeader('MMCustomRequest', '1'); // ID of the webapp
    //request.setRequestHeader('accept-encoding','gzip');
    //try {
    request.send(fname);
    //} catch (err) {
    //    alert(err);
    //}
    if (sync) {
        callback.call(window, request.responseText);
    }
    if (!async) {
        return request.responseText;
    }
}

var my_unescape = function (x) {
    if (!x) return x;
    var r = /\\u([0-9a-fA-F]{4})/gi;
    var ret = x.replace(r, function (match, grp) {
        return String.fromCharCode(parseInt(grp, 16));
    });
    ret = unescape(ret);
    return ret;
}

// method for incremental loading of the long lists
window.loadListFromServer = function (fname, toList, beforeItemAddCallback, callback, sync) {
    var step = 0;
    var localLoadFile = function (hash) {
        _loadFile(document.URL + 'data:' + (hash ? getCommandSeparator() + 'hash:' + hash : '') + getCommandSeparator() + fname, loadCallback, 'POST', sync);
    };

    var loadCallback = function (result) {
        try {
            if (result === '') {
                result = '{"data":[]}';
            }
            var data = my_unescape(result);
            data = JSON.parse(data);
            toList.beginUpdate();
            for (var i = 0; i < data.data.length; i++) {
                var item = data.data[i];
                if (beforeItemAddCallback) {
                    item = beforeItemAddCallback(item);
                }
                if (item) {
                    toList.add(item);
                }
            }
            data.data = undefined;
            toList.endUpdate('newcontent');

            if (data.async === true) {
                setTimeout(function () {
                    localLoadFile(data.hash);
                }, Math.max(200, step++ * 100));
            } else {
                toList.notifyLoaded();
                if (callback)
                    callback(result);
            }
        } catch (err) {
            alert(err);
        }
    };

    localLoadFile();
};

// method for loading file from server
window.loadFileFromServer = function (fname, callback, method) {
    var cb = function (data) {
        callback(my_unescape(data));
    };

    return my_unescape(_loadFile(document.URL + fname, (callback === undefined) ? undefined : cb, (method === undefined) ? 'GET' : method));
};

// method for loading small data/objects from server
window.loadDataFromServer = function (fname, callback, method) {
    var cb = function (data) {
        callback(my_unescape(data));
    };

    return my_unescape(_loadFile(document.URL + 'data:' + getCommandSeparator() + fname, (callback === undefined) ? undefined : cb, (method === undefined) ? 'POST' : method));
};

// helper method for getting URL for file loading from server
window.getFileAddress = function (filename) {
    if (filename === undefined)
        filename = '';
    return document.URL + 'getFile/path=' + encodeURI(filename);
};

// helper method for reloading app on skin/layout change
window.reloadApp = function () {
    loadDataFromServer('skinparams' + getCommandSeparator() + window._currentSkin + getCommandSeparator() + window._currentLayout); // send new skin/layout to the server
    storageSetValue('current_skin', window._currentSkin);
    storageSetValue('current_layout', window._currentLayout);
    app.player.saveState();
    storageSetValue('reload', true);
    document.location.reload();
};

window.updateFileName = function (fname) {
    fname = fname.replace("\\", "/");
    fname = fname.replace(new RegExp('/', "g"), '-').toLowerCase();
    return fname;
}

window.customLoader = function (fname, callback, params) {
    var async = (callback !== undefined);
    var parseParam = function (param, def) {
        if (!params) {
            return def;
        } else {
            return resolveToValue(params[param], def);
        }
    };
    fname = updateFileName(fixFile(fname));
    var content = '';

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
        var addfile = 'skins-' + window._currentSkin + '-' + fname;
        if (appendFile(addfile) && !add) return true;

        // now layout
        addfile = 'layouts-' + window._currentLayout + '-' + fname;
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
        callback(content);
    } else {
        return content;
    }

}

// main method for running app
function runApp() {

    var restoreRequired = false;
    if (storageGetValue('reload', false) === 'true') {
        restoreRequired = true;
        window._currentSkin = storageGetValue('current_skin', loadDataFromServer('app' + getCommandSeparator() + 'currentSkin'));
        window._currentLayout = storageGetValue('current_layout', loadDataFromServer('app' + getCommandSeparator() + 'currentLayout'));
        storageSetValue('reload', false);
    } else {
        window._currentSkin = loadDataFromServer('app' + getCommandSeparator() + 'currentSkin');
        window._currentLayout = loadDataFromServer('app' + getCommandSeparator() + 'currentLayout');
        storageClear();
    }
    
    window._currentSkin = JSON.parse(window._currentSkin);
    window._currentLayout = JSON.parse(window._currentLayout);
    
    window._currentSkin.path = updateFileName(window._currentSkin.path);
    window._currentLayout.path = updateFileName(window._currentLayout.path);
    window._addHeader = loadDataFromServer('app' + getCommandSeparator() + 'addHeader');
    
    document.body.classList.add('flex');
    document.body.classList.add('column');
    
    var topparent = document.createElement('div');
    topparent.setAttribute('data-store', '');
    topparent.setAttribute('data-control-class', 'Control');
    topparent.classList.add('fill');
    document.body.appendChild(topparent);

    var content = document.createElement('div');
    content.setAttribute('data-store', '');
    content.setAttribute('data-uiblock', 'maincontent');
    content.setAttribute('data-id', 'windowcontent');
    topparent.appendChild(content);

    var code = atob(window.appSourcesPackage['mminit.js']);
    try {
        code = code + String.fromCharCode(13) + String.fromCharCode(10) + ' //@ sourceURL=' + prepareSourceURL('mminit.js');
        window.eval(code);
    } catch (err) {
        var msg = err.message;
        for (var prop in err) {
            msg = msg + '\n' + prop + ': ' + err[prop];
        }

        alert(msg);
    }

    requirejs('controls/listview.js');
    requirejs('controls/gridview.js');
    requirejs('controls/trackListView.js');
    requirejs('controls/nowplaylistList.js');
    requirejs('controls/tracklistFilter.js');
    requirejs('controls/tabs.js');
    requirejs('controls/progressbar.js');
    requirejs('controls/taskscontroller.js');
    requirejs('controls/popupmenu.js');
    requirejs('controls/mainTabContent.js');
    requirejs('controls/navigationBar.js');
    requirejs('controls/mainTabs.js');
    requirejs('mainwindow.js');
    var event = createNewEvent('load');
    window.dispatchEvent(event);

    for (var i = 0; i < window._scripts.length; i++) {
        var addfile = 'scripts-' + window._scripts[i] + '-init.js';
        if (window.appSourcesPackage[addfile]) {
            requirejs(addfile);
        }
    }

    if (restoreRequired) {
        app.player.restoreState();

    }
};

// load main sources file and then run app
_loadFile(document.URL + 'mm5sources.json', function (data) {
    try {
        window.appSourcesPackage = JSON.parse(data);
    } catch (err) {
        alert(err);
    }
    prepareArrays();
    setTimeout(window.runApp, 0);
});