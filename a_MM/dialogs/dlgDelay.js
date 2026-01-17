/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

let secondsRemaining = 0;

function init(params) {
    let wnd = this;
    wnd.resizeable = false;

    qid('lblDelayMessage').innerText = wnd.delayMessage;

    secondsRemaining = wnd.showDlgSeconds;
    qid('lblSeconds').innerText = secondsRemaining;
    requestTimeout(onTimer, 1000);

    window.localListen(qid('btnCancel'), 'click', function () {
        let res = {
            btnID: 'btnCancel'
        };
        setResult(res);
        closeWindow();
    });

    wnd.showModal();
};

let onTimer = function () {
    secondsRemaining--;
    qid('lblSeconds').innerText = secondsRemaining;
    if (secondsRemaining == 0) {
        let res = {
            btnID: 'btnIgnore'
        };
        setResult(res);
        closeWindow();
    } else {
        requestTimeout(onTimer, 1000);
    }
}

// function for testing purposes, stops timeout and set fixed time 59s
window.prepareForScreenshot = function () {
    if (onTimer) {
        clearTimeout(onTimer);
    };
    qid('lblSeconds').innerText = '59';
};