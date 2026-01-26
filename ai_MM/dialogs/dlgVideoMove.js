/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";
let slMoveVertical;
let slMoveHorizontal;
let videoSettings;
let moveXorig;
let moveYorig;
let player;

let saveSize = function () {
    let newX = slMoveHorizontal.controlClass.value;
    let newY = slMoveVertical.controlClass.value;
    if ((newX !== videoSettings.moveX) || (newY !== videoSettings.moveY)) {
        videoSettings.moveX = newX;
        videoSettings.moveY = newY;
        player.setVideoSettings(videoSettings);
    }
}

function init(params) {
    window.resizeable = false;
    player = app.player;
    videoSettings = player.getVideoSettings();
    slMoveVertical = qid('slMoveVertical');
    slMoveVertical.controlClass.value = videoSettings.moveY;
    moveYorig = videoSettings.moveY;
    slMoveHorizontal = qid('slMoveHorizontal');
    slMoveHorizontal.controlClass.value = videoSettings.moveX;
    moveXorig = videoSettings.moveX;
    window.localListen(slMoveVertical, 'change', saveSize);
    window.localListen(slMoveVertical, 'livechange', saveSize);
    window.localListen(slMoveHorizontal, 'change', saveSize);
    window.localListen(slMoveHorizontal, 'livechange', saveSize);

    window.localListen(qid('btnReset'), 'click', function () {
        slMoveVertical.controlClass.value = 0;
        slMoveHorizontal.controlClass.value = 0;
        saveSize();
    });

    window.localListen(qid('btnCancel'), 'click', function () {
        slMoveVertical.controlClass.value = moveXorig;
        slMoveHorizontal.controlClass.value = moveYorig;
        saveSize();
    }, true);

    window.localListen(qid('btnOK'), 'click', function () {
        modalResult = 1;
    }, true);
}

window.windowCleanup = function () {
    slMoveVertical = undefined;
    slMoveHorizontal = undefined;
    videoSettings = undefined;
    player = undefined;
}