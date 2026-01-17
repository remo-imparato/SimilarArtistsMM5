/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

requirejs('animationTools');

let stepTime = 200;
let progressBar;
let cTm = undefined;
let token = app.db.getProgressToken();

function init(params) {
    let wnd = this;

    stepTime = animTools.animationTime * 1000;

    qid('lblProgressMessage').innerText = wnd.progressMessage;
    progressBar = qid('progress');

    cTm = setTimeout(onTimer, stepTime);

    wnd.showModal();
};

window.localListen(thisWindow, 'closed', function () {
    if(cTm) {
        clearTimeout(cTm);
        cTm = undefined;
    }
})

let progressValue = 0;

let onTimer = function () {

    progressValue = progressValue + 0.05;
    if (progressValue >= 1)
        progressValue = 0;
    if (token.value > 0)
        progressBar.controlClass.value = token.value;
    else
        progressBar.controlClass.value = progressValue;
    progressBar.controlClass.text = token.text; // #14322

    if (window.finished) {
        let res = {
            btnID: 'btnIgnore'
        };
        setResult(res);
        closeWindow();
    } else {
        cTm = setTimeout(onTimer, stepTime);
    }
}

window.windowCleanup = function () {
    if(cTm) {
        clearTimeout(cTm);
        cTm = undefined;
    }
    progressBar = undefined;
    token = undefined;
}