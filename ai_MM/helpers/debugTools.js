/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

/**
@module Debugging Tools
*/

// Output FPS info to Debug log.
function ODS_FPS() {
    var lastFPSTime = performance.now();
    var fpsChecker = function () {
        var newTime = performance.now();
        ODS('FPS/Time: ' + (newTime - lastFPSTime) + " (" + window.url + ")");
        lastFPSTime = newTime;
        requestAnimationFrameMM(fpsChecker);
    }
    requestAnimationFrameMM(fpsChecker);
}

function waitForDebugger(settings) {
    if ((settings === undefined) || (settings.callback === undefined) || (typeof settings.callback !== 'function'))
        return;

    showDevTools();
    messageDlg('Wait for DevTools to open, place breakpoint where you want and click on OK button.', 'Information', ['btnOK'], {
        defaultButton: 'btnOK'
    }, function (result) {
        settings.callback.apply(this, settings.params);
    });
}


/**
Inject entry point (method) to show debugger and allow debug this method.
For example see debuggerTools sample code.

@method registerDebuggerEntryPoint
@param {string} Name of the entry point (method)
*/

function registerDebuggerEntryPoint(callbackName) {
    var callback = this[callbackName];
    if ((callback === undefined) || (typeof callback !== 'function'))
        return;

    var origFunction = callback;
    this[callbackName] = function () {
        var args = arguments;
        waitForDebugger.call(this, {
            callback: origFunction,
            params: args
        });
        this[callbackName] = origFunction; // restore old entry point
    }.bind(this);
}
