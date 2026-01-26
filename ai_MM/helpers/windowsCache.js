/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

registerFileImport('helpers/windowsCache');

/**
@module UI
*/


(function () {

    if (!window.webApp) {
        var windows = [];

        var mainWnd = app.dialogs.getMainWindow();

        var createNewWindow = function (url, pars) {
            pars = pars || {
                left: 0,
                top: 0,
                width: -1,
                height: -1,
                show: false,
            };
            pars.shared = true;

            var w = app.dialogs.openDialog('file:///dialogs/empty.html', pars);
            windows.push(w);

            w.isloaded = false;
            w.doLoaded = function () {
                //app.unlisten(this, 'load', this.doLoaded);
                this.getValue('requirejs')('helpers/windowsCache.js');
                this.getValue('requirejs')('controls/control.js');
                this.getValue('requirejs')('controls/listview.js');

                this.isloaded = true;
            }.bind(w);
            app.listen(w, 'load', w.doLoaded);

            w.unlock = () => {
                if (!w.__locked)
                    return; // already unlocked
                w.__locked = undefined;
                if (w.isloaded && w.visible) {
                    ODS('Window ' + w.url + ' still visible ... closing');
                    w.closeWindow();
                }
            };

            w.__cleanUp = () => {
                if (w.__locked) {
                    w.unlock();
                    if (w._window && !w._window._cleanUpCalled && w._window.cleanupDocument) {
                        ODS('Going to clean up document ' + w.url);
                        w._window.cleanupDocument();
                    }
                }
            };

            w.openURL = function (url, params) {
                if (!url)
                    return;

                var loadURL = (url) => {
                    if ( /*!this.windowIsLoaded ||*/ !this.isloaded) {
                        setTimeout(function () {
                            loadURL(url);
                        }, 10);
                        return;
                    }

                    let closedEvent = app.listen(this, 'closed', () => {
                        app.unlisten(this, 'closed', closedEvent);
                        ODS('Window ' + w.url + ' is closing');
                        setTimeout(() => { // cleanUp need to be called async so dialog method have chance to call his own closed events (like the one in uitools.openDialog method)
                            w.__cleanUp();
                        }, 100);
                    });
    
                    if (this.__locked)
                        this.getValue('initSharedWindow').call(this, url, params);
                };

                // call it in timeout so caller can finish it's execution (like load event register for dialogs)
                setTimeout(function () {
                    loadURL(url);
                }, 10);
            }.bind(w);

            return w;
        };

        var fixValue = function (val, def) {
            val = resolveToValue(val, def);
            val = parseInt(val);
            if (isNaN(val))
                return def;
            return val;
        };

        window.initSharedWindow = function (url, params) {

            cleanupDocument();
            canBeFreed = false;
            window._cleanUpCalled = false;
            window.pageLoaded = false;
            window.pageReady = false;
            window._windowIsReady = false;
            window._rootElement = null;
            window.noAutoSize = false;
            window.resizeable = true;
            window.canMinimize = true;
            window.canMaximize = true;
            window.shape = '';
            window.posSaveName = '';
            window.init = undefined; // this is required as new window scripts can be without init method
            window.less = undefined;
            window.newLanguage = undefined;
            window.reloadNeeded = undefined;
            window.settings.UI.allowTrackProperties = undefined;
            if (window.maximized || window.minimized)
                window.restore();

            var notifyListenCall = function (target, event, func, capture) {
                ODS('Potentially problematic window.localListen "' + event + '" called in script body from ' + app.utils.logStackTrace());
            }

            window.beforeRequireJSEval = function () {
                window.notifyListenCall = notifyListenCall;
            };

            window.afterRequireJSEval = function () {
                window.notifyListenCall = undefined;
            };

            var heads = document.getElementsByTagName('head');
            for (var i = 0; i < heads.length; i++)
                if (!heads[i].children.length)
                    heads[i].remove();

            var useWidth = fixValue(params.width, 1024);
            var useHeight = fixValue(params.height, 1024);

            if (params.parentSizeAndPos) {
                var leftVal = fixValue(params.parentSizeAndPos.left, -1);
                var topVal = fixValue(params.parentSizeAndPos.top, -1);
                var widthVal = fixValue(params.width, fixValue(params.parentSizeAndPos.width, useWidth));
                var heightVal = fixValue(params.height, fixValue(params.parentSizeAndPos.height, useHeight));
                bounds.setBounds(leftVal, topVal, widthVal, heightVal);
            } else {
                bounds.setSize(useWidth, useHeight);
            }

            var reloadNeeded = function (fname) {
                var reloadScripts = ['tracklistview'],
                    length = reloadScripts.length;
                while (length--) {
                    if (fname.indexOf(reloadScripts[length]) != -1) {
                        return true;
                    }
                }
                return false;
            };

            var lowURL = url.toLowerCase();
            window.updateLoadedFile = function (fname, content) {
                if (fname.toLowerCase().includes(lowURL + '.js') || reloadNeeded(fname.toLowerCase())) {
                    // we need to remove 'use strict' from the script because it can prevent redefine of existing function(s) and we need it (mainly because of dialog's init function)
                    var updated = content.replace('"use strict";', '').replace("'use strict';", '');
                    return updated;
                } else
                    return content;
            }

            // prepare file name
            var fn = url;

            reloadScript('file:///dialogs/'); // remove all 'dialogs' scripts from loadedScripts so they will be loaded again
            reloadScript('file:///less');
            reloadScript('less');
            reloadScript('controls/trackListView');

            if (!fn.startsWith('file:')) {
                if (!fn.includes('dialogs')) {
                    fn = 'dialogs/' + fn;
                }
                fn = 'file:///' + fn;
            }
            // remove extension
            if (fn.endsWith('.html')) {
                fn = fn.replace('.html', '');
            }

            var srcContent = loadFile(fn + '.html');

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
                    scriptName = 'file:///dialogs/' + scriptName;
                }
                if (!scriptName.toLowerCase().startsWith('file:///mminit'))
                    scripts.push(scriptName);
            }

            // not whole body and put it into outerHTML
            var justBody = srcContent.match(/(<body.*<\/body>)/gims);
            if (isArray(justBody) && justBody.length)
                justBody = justBody[0];

            applyWindowStates(url, params);

            document.body.outerHTML = justBody;

            for (var i = 0; i < scripts.length; i++) {
                requirejs(scripts[i]);
            }

            recallRequired();
            notifyLoaded();
            finishInitializeWindow();

            if (headerClass)
                headerClass.resetMoveable();

        };

        var isAnyAvailable = function () {
            for (var i = 0; i < windows.length; i++) {
                if (!windows[i].__locked) {
                    return true;
                }
            }
            return false;
        }

        var getAvailableWindow = function () {
            for (var i = 0; i < windows.length; i++) {
                if (!windows[i].__locked) {
                    return windows[i];
                }
            }
            return undefined;
        }

        var getOrCreateWindow = function (url, pars) {
            var win = getAvailableWindow();
            if (!win) {
                win = createNewWindow(url, pars);
            }
            win.__locked = true;
            return win;
        }

        if (!isMainWindow) { // we need to always use popupWindow class from main window
            window.windowsCache = mainWnd.getValue('windowsCache');
        } else {
            window.windowsCache = {
                getWindowAndLock: function (url, pars) {
                    var win = getOrCreateWindow(url, pars);
                    win.openURL(url, pars);

                    // create another window
                    if (url && !isAnyAvailable())
                        getOrCreateWindow().unlock();

                    return win;
                },

            };

            whenReady(() => {
                // create one window to cache at startup
                window.windowsCache.getWindowAndLock().unlock();
            });
        }



    }
})();
