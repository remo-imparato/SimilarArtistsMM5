/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

requirejs('animationTools');

function init(params) {
    params = params || {};
    let isInPlace = !!resolveToValue(params.inplace, undefined);
    
    if (!isInPlace)
        resizeable = false;
    
    let dialogRoot = qid('dlgProgress');
    
    let progressBar = qeid(dialogRoot, 'progress');
    let progressMessage = qeid(dialogRoot, 'lblProgressMessage');

    let token = app.db.getProgressToken();

    function setProgress() {
        progressMessage.innerHTML = token.text;
        progressBar.controlClass.value = token.value;
    }
    window.localListen(token, 'change', setProgress);
    setProgress();
};