/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

requirejs('actions');

var npWnd;
var defaultNPWindowSize = '30em';
var defaultNPWindowSizeInPix;
var lastRatio = 1;
var showWaiter = null;
var autoHideInterval;
window.isMicroPlayer = true;

function init(params) {

    // window.hotkeys.register(); // doesn't seem to be needed atm, main window is still there (although hidden) catching the hotkeys

    // remove tooltip controller
    if (window.tooltipDiv) {
        removeElement(window.tooltipDiv);
        window.tooltipDiv = undefined;
    }

    var getNPRect = function (size) {
        var ret = {};
        
        if (!defaultNPWindowSizeInPix || (lastRatio !== devicePixelRatio)) {
            defaultNPWindowSizeInPix = emToPx(defaultNPWindowSize);
            lastRatio = devicePixelRatio;
        }
        
        var width = defaultNPWindowSizeInPix;
        var height = defaultNPWindowSizeInPix * 2;
        if (size !== undefined) {
            width = size.width;
            height = size.height;
        }

        var r = app.utils.getTaskbarPosition();
        if (r.width > r.height) {
            ret.left = bounds.left;
            if (ret.left + width > r.right)
                ret.left = r.right - width - 8;
            if (r.top < 50)
                ret.top = r.bottom;
            else
                ret.top = r.top - height;
        } else {
            ret.top = bounds.top;
            if (r.left < 50)
                ret.left = r.right;
            else
                ret.left = r.left - width;
        }        
        ret.width = width;
        ret.height = height;
        return ret;
    }

    var showNowPlaying = function () {

        hideTrackInfo();
        
        var npRect = getNPRect();
        if (!npWnd) {
            npWnd = uitools.openDialog('empty', {
                show: false,
                modal: false,
                top: npRect.top,
                left: npRect.left,
                width: npRect.width,
                height: npRect.height,
                atTopMost: true,
                bordered: false,
                flat: true,
            });
            npWnd.loaded = function () {
                app.unlisten(npWnd, 'load', npWnd.loaded);

                npWnd.executeCode('requirejs("controls/nowplayingList");');
                npWnd.executeCode('requirejs("controls/popupmenu");');
                npWnd.executeCode('requirejs("controls/menuButton");');

                var np = document.createElement('div');
                np.setAttribute('data-control-class', 'NowplayingListView');
                np.setAttribute('data-init-params', '{statusInHeader: true, alwaysFollowCurrentTrack: true}');
                np.setAttribute('data-id', 'npList');
                np.className = 'fill flex';
                npWnd.getValue('document').body.appendChild(np);
                npWnd.executeCode('initializeControls(document.body);');
                npWnd.bounds.setPosition(npRect.left, npRect.top);
                npWnd.show();
                npWnd.executeCode('qid(\'npList\').controlClass.setItemFullyVisible(app.player.playlistPos);');
            };
            npWnd.closed = function () {
                npWnd = null;
            };
            app.listen(npWnd, 'load', npWnd.loaded);
            app.listen(npWnd, 'closequery', npWnd.closed);
        } else {
            if (npWnd.windowIsLoaded) {
                if (npWnd.visible)
                    npWnd.hide();
                else {
                    npWnd.show();
                    npWnd.bounds.setPosition(npRect.left, npRect.top);
                }
            }
        }
    };

    var prepareRestore = function (isVertical) {
        var nameAdd = (isVertical ? '_vertical' : '');

        app.listen(qid('restore' + nameAdd), 'click', function () {
            app.switchToMainPlayer();
        });
        app.listen(qid('npwindow' + nameAdd), 'click', function () {
            showNowPlaying();
        });
        app.listen(qid('close' + nameAdd), 'click', function () {
            app.closeApp();
        });
    }

    prepareRestore(false);
    prepareRestore(true);

    var horzPlayer = qid('horizontal');
    var vertPlayer = qid('vertical');

    var updatePlayer = function (isHorz) {
        setVisibility(horzPlayer, isHorz, {
            animate: false
        });
        setVisibility(vertPlayer, !isHorz, {
            animate: false
        });
        if (isHorz) {
            bounds.width = horzPlayer.offsetWidth;
        } else {
            bounds.height = vertPlayer.offsetHeight;
        }
    };

    app.listen(app, 'dockchange', function (isHorz) {
        updatePlayer(isHorz);
    });

    function invert(rgb) {
        rgb = Array.prototype.join.call(arguments).match(/(-?[0-9\.]+)/g);
        for (var i = 0; i < rgb.length; i++) {
            rgb[i] = (i === 3 ? 1 : 255) - rgb[i];
        }
        return rgb;
    }

    var updateColors = function () {
        var taskbarColor = app.utils.getTaskbarColor();
        var newColor = 'rgb(' + taskbarColor.r + ', ' + taskbarColor.g + ', ' + taskbarColor.b + ')';
        document.body.style.backgroundColor = newColor;
        var inverted = invert(newColor);
        var textColor = 'rgb(' + inverted[0] + ', ' + inverted[1] + ', ' + inverted[2] + ')';

        var setColor = function (ctrl, inclBackground) {
            if (ctrl) {
                ctrl.style.fill = textColor;
                ctrl.style.color = textColor;
                if (inclBackground) {
                    ctrl.style.backgroundColor = textColor;
                }
            }
        }

        setColor(document.body);
        setColor(document.body);

        var sliders = qes(document.body, '[data-control-class=Slider]');
        sliders.forEach(function (slider) {
            setColor(slider);
            setColor(slider.controlClass._seekBarOuter);
            setColor(slider.controlClass._seekBar, true);
            setColor(slider.controlClass._seekBarThumb);
        });
    };
    updateColors();

    app.listen(thisWindow, 'visibilitychanged', function (minimized, hidden) {
        if (hidden) {
            hideTrackInfo();
            if (npWnd && npWnd.windowIsLoaded)
                npWnd.closeWindow();
            npWnd = undefined;
        }

        if (!minimized && !hidden) {
            var taskbarPos = app.utils.getTaskbarPosition();
            updatePlayer(taskbarPos.width > taskbarPos.height);
            updateColors();
        }
    });

    var mouseInPlayer = function () {
        var inNP = false;
        if (npWnd)
            inNP = npWnd.bounds.mouseInside();
        var mainWindow = app.dialogs.getMainWindow();
        var inPl = mainWindow.getValue('uitools').mouseInsideTrackInfo();
        return bounds.mouseInside() || inPl || inNP;
    };

    var hideTrackInfo = function () {
        var mainWindow = app.dialogs.getMainWindow();
        mainWindow.getValue('uitools').hideTrackInfo();
        stopAutoHideInterval();
    }
    
    var startAutoHideTimer = function () {
        stopAutoHideInterval();
        autoHideInterval = setInterval(function () {
            // check mouse is not over microplayer or info window ... if so, hide info window
            if (!mouseInPlayer()) {
                hideTrackInfo();
            }

        }, 1000);
    };

    var stopAutoHideInterval = function () {
        if (autoHideInterval)
            clearInterval(autoHideInterval);
        autoHideInterval = null;
    };

    var canShowInfo = function () {
        var npVisible = npWnd && npWnd.visible;
        
        if (!mouseInPlayer() || (npVisible) || (window.popupWindow.menuVisible()))
            return false;
        return true;
    }
    
    var showTrackInfo = function () {
        if (window._cleanUpCalled)
            return;
        
        if (!canShowInfo())
            return;
        
        var mainWindow = app.dialogs.getMainWindow();
        
        var params = {
            callback: function () { // callback is called right before show (when window is already created and prepared)
                var trackInfoSize = mainWindow.getValue('uitools').getTrackInfoSize();
                var npRect = getNPRect(trackInfoSize);
                this.left = npRect.left;
                this.top = npRect.top;
            },
            opacity: 100,
            width: emToPx(25),
            disableAutoHide: true,
            ignoreSettings: true // ignore settings for this window
        }
        
        mainWindow.getValue('uitools').showTrackInfo(params);
        
        startAutoHideTimer();
    };

    app.listen(document.body, 'mousemove', function () {
        if (showWaiter)
            clearTimeout(showWaiter);
        showWaiter = null;
        if (!window._cleanUpCalled) {
            showWaiter = setTimeout(function () {

                if (!window._cleanUpCalled) {
                    showTrackInfo();
                }

                showWaiter = null;
            }, 500);
        }
    }, true);

    app.listen(app.player, 'playbackState', function (state) {
        if (window._cleanUpCalled) return;
        if (state === 'trackChanged') {
            showTrackInfo();
        }
        
    });

}
