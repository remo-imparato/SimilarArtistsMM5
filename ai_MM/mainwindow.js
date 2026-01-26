/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

//import '/commonControls';
import '/mainWindowControls';

window.hotkeys.register();

if (!window.isStub) {

    var wndTrackInfo = undefined;
    var wndVideoWindow = undefined;
    var createTrackInfo = function (cbk) {
        wndTrackInfo = uitools.openDialog('dlgTrackInfo', {
            modal: false,
            show: false,
            atTopMost: true,
            flat: true,
            bordered: false,
            active: false
        });
        wndTrackInfo.afterInit = function () {
            app.unlisten(wndTrackInfo, 'afterInit');
            wndTrackInfo.isLoaded = true;
            if (isFunction(cbk))
                cbk();
        };
        app.listen(wndTrackInfo, 'afterInit', wndTrackInfo.afterInit);
    };

    var createVideoWindow = function (doShow) {
        wndVideoWindow = uitools.openDialog('dlgVideo', {
            toolWindow: true,
            show: doShow,
            atTopMost: true,
            type: 'video',
            notShared: true
        });
    }

    whenReady(function () {
        setTimeout(function () {
            if (window._cleanUpCalled) return;

            var wasMinimized = minimized;

            app.listen(thisWindow, 'visibilitychanged', function (minimized, hidden, state) { // state: 0 normal, 1 minimized, 2 maximized
                if (window._cleanUpCalled)
                    return;

                if (app.getCurrentPlayer() == 0) {
                    if (!wasMinimized && minimized) {
                        var sett = window.settings.get('Appearance,Options');
                        if (sett.Appearance.MinimizeToTray) {
                            if (sett.Options.ShowPlsWhenMinimized)
                                actions.switchToMiniPlayer.execute();
                            else
                                actions.switchToMicroPlayer.execute();
                        }
                    }
                }
                wasMinimized = minimized;
            });
            
            if (!wndTrackInfo) {
                createTrackInfo();
            }
        }, 5000); // delayed microplayer window prepare (to speed up app start)
    });
    var lastTrackInfoParams;
    var _showTrackInfo = function (params) {
        lastTrackInfoParams = params;
        if (!wndTrackInfo) {
            createTrackInfo(function () {
                _showTrackInfo(lastTrackInfoParams);
            });
        }
        if (!wndTrackInfo.isLoaded)
            return; // already preparing, will be called from createTrackInfo

        if (!params && !wndTrackInfo.visible) 
            callWndFn(wndTrackInfo, 'loadFromSettings');

        if (params && params.callback) {
            params.callback();
        }

        callWndFn(wndTrackInfo, 'showTrackInfo', params);
    };
    app.listen(thisWindow, 'closeQuery', function () {
        if (wndTrackInfo && wndTrackInfo.isLoaded) {
            wndTrackInfo.closeWindow();
        }
    });

}

window.uitools = window.uitools || {};
window.uitools.getTrackInfoSize = function () {
    if (wndTrackInfo && wndTrackInfo.isLoaded) {
        return {
            width: wndTrackInfo.bounds.width,
            height: wndTrackInfo.bounds.height
        };
    }
    return {
        width: 0,
        height: 0
    };
};
window.uitools.showTrackInfo = function (params) {
    params = params || {};
    var sett = window.settings.get('Appearance');
    if (params.ignoreSettings || (((sett.Appearance.ShowNewTrackInfo === 2 /*always*/ ) || ((sett.Appearance.ShowNewTrackInfo === 1 /*minimized*/ ) && (!app.anyDialogActive()))) && (!app.focusAssistIsOn()))) {
        if (!window.isStub) {
            _showTrackInfo(params);
        }
    }
};
window.uitools.hideTrackInfo = function () {
    if (wndTrackInfo && wndTrackInfo.isLoaded) {
        wndTrackInfo.hide();
    }
};
window.uitools.mouseInsideTrackInfo = function () {
    if (wndTrackInfo && wndTrackInfo.isLoaded) {
        return wndTrackInfo.bounds.mouseInside();
    }
    return false;
}

window.uitools.showVideoWindow = function () {
    createVideoWindow(true);
}

window.uitools.hideVideoWindow = function () {
    if (wndVideoWindow)
        wndVideoWindow.closeWindow();
}

// global visualization handling, track info window handling
app.listen(app.player, 'playbackState', function (state) {
    if (window._cleanUpCalled)
        return;
    switch (state) {
        case 'play':
        case 'unpause':
            if (uitools.currPlayerState !== 'play') {
                uitools.currPlayerState = 'play';
                var player = app.player;
                if (player.visualization.active) {
                    var sd = app.player.getFastCurrentTrack(sd);
                    if (sd && !sd.isVideo && !isYoutubePath(sd.path)) {
                        playerUtils.initializeVisualization();
                    };
                };
                uitools.showTrackInfo();
            };
            break;
        case 'stop':
        case 'pause':
        case 'end':
            uitools.currPlayerState = state;
            break;
        case 'trackChanged':
            break;
    }
});
