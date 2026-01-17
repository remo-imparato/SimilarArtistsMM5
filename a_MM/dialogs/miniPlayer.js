/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

import '/commonControls';

requirejs('templates');
requirejs('controls/nowplayingList');
requirejs('controls/popupmenu');
requirejs('controls/menuButton');

window.init = function(params) {
    this.resizeable = false;
    this.noAutoSize = true;

    let remove = null;
    let style = getComputedStyle(document.body.firstElementChild, null);
    let clr = style.getPropertyValue('background-color');
    setMoveableColor(clr);

    let refreshControl = function (ctrl) {
        let width = bounds.clientWidth;

    };

    // window.hotkeys.register(); // doesn't seem to be needed atm, main window is still there (although hidden) catching the hotkeys

    window.localListen(qid('restore'), 'click', function () {
        app.switchToMainPlayer();
    });
    window.localListen(qid('npwindow'), 'click', function () {
        showNowPlaying();
    });
    window.localListen(qid('close'), 'click', function () {
        app.closeApp();
    });

    window.localListen(thisWindow, 'show', function () {
        refreshControl(qid('restore'));
    });

    magnetToScreen = true;
    let _origTop = bounds.top;
    let  supressNextMovedEvt = false;

    let npList = qid('npList');

    let showNowPlaying = function () {
        if (window._cleanUpCalled)
            return;
        
        if (!visible) {
            requestTimeout(showNowPlaying, 5);
            return;
        }

        doShowHideNP(!isVisible(npList));
    };

    let doShowHideNP = function(doShow) {
        window.cachedStyleValues = undefined;
        let originalSize = { 
            width: emToPx(33, getDocumentBody()),
            height: emToPx(6, getDocumentBody())
        };

        supressNextMovedEvt = true;

        if (!doShow) {
            setVisibility(npList, false);
            bounds.height = originalSize.height;
            if (_origTop !== undefined)
                bounds.top = _origTop;
        } else {
            _origTop = bounds.top;                      
            setVisibility(npList, true);
            let monitor = app.utils.getMonitorInfoFromCoords(bounds.left, bounds.top);
            if (bounds.top + (originalSize.height * 5) > monitor.availTop + monitor.availHeight) {
                bounds.top = (monitor.availTop + monitor.availHeight) - (originalSize.height * 5);
            }
            bounds.height = originalSize.height * 5;
            requestTimeout(function () {
                npList.controlClass.invalidateAll();
                npList.controlClass.setItemFullyVisible(app.player.playlistPos);
                npList.controlClass.notifyControlFocus(); // #18018: required to make np 'focused' manually (because of window style)
                bounds.refreshFrame();
            }, 100);
        }
        bounds.width = originalSize.width;
        app.setValue('miniPlayerNPVisible', isVisible(npList));
    };

    const ratioUpdate = function () {
        if (remove)
            remove();

        const mqString = `(resolution: ${window.devicePixelRatio}dppx)`;
        const media = matchMedia(mqString);
        media.addEventListener("change", ratioUpdate);
        remove = () => {
          media.removeEventListener("change", ratioUpdate);
        };
      
        doShowHideNP(isVisible(npList));
    }
    
    let player = qid('pnlPlayer');
    if (player && player.controlClass) {
        player.controlClass.restoreState();
    }
    
/*    if (window.tooltipDiv) {
        removeElement(window.tooltipDiv);
        window.tooltipDiv = undefined;
    }*/
    
    window.restoreNP = () => {
        if (app.getValue('miniPlayerNPVisible', false)) {
            doShowHideNP(true);
        } else {
            doShowHideNP(false);
        }
    };

    whenReady(() => {
        restoreNP();
    });
    
    window.localListen(thisWindow, 'closed', () => {
        app.setValue('miniPlayerNPVisible', isVisible(npList));
    });

    window.localListen(thisWindow, 'moved', () => {
        if (!supressNextMovedEvt)
            _origTop = undefined;
        supressNextMovedEvt = false;
    });

    ratioUpdate();

}