/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

requirejs('controls/youtubePlayerController');
requirejs('playerUtils');

window.alwaysShowHeader = true;

window.doInit = function () {

    window.playerUtils.initialize();
    window.playerUtils.initializeVideoPlayer();

    magnetToScreen = true;
    magnetToWindows = true;
}

whenReady(function () {

    if (app.getCurrentPlayer() === 0) {
        closeWindow();
    } else {

        doInit();

        localListen(thisWindow, 'Activated', (activated) => {
            if (activated) {
                if (window.intPlayer && window.intPlayer.controlClass)
                    window.intPlayer.controlClass.updateWindow(true);
            }
        });
    }
});

window.windowCleanup = function () {
    window.intPlayer = undefined;
    window.fullWindowModeActive = undefined;
    window.extPlayerWindow = undefined;
    window.alwaysShowHeader = undefined;
}
