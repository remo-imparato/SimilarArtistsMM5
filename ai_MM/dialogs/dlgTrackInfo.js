/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

let _widthEm = 30; // in em
let _heightEm = 9.5; // in em
let _width; // in px
let _height; // in px
let _opacity;
let initOpacity = 100;
let opacityStepSize = 1;
let opacityStepDuration = 20;
let _timeout;
let _settingsChangeRegistered = false;
let _params;
let _hideTimeout;
let lastCoverPath;
let usedSD;
let thumbCancelToken = undefined;

let _mouseListenersRegistered = false;
let _mouseHandlers = {};
let _artworkLoadHandler;
let _settingsChangeHandler;

function init(params) {
    resizeable = false;
    _params = params || {};

    _width = emToPx(_widthEm);
    _height = emToPx(_heightEm);
    if (_params.width)
        _width = resolveToValue(_params.width, _width);
    if (_params.height)
        _height = resolveToValue(_params.height, _height);
    loadFromSettings();
};

window.windowCleanup = function () {
    if (thumbCancelToken !== undefined) {
        app.cancelLoaderToken(thumbCancelToken);
        thumbCancelToken = undefined;
    }
    usedSD = undefined;

    if (_mouseListenersRegistered) {
        app.unlisten(document.body, 'mouseover', _mouseHandlers.over);
        app.unlisten(document.body, 'mouseout', _mouseHandlers.out);
        app.unlisten(document.body, 'click', _mouseHandlers.click);
        _mouseListenersRegistered = false;
        _mouseHandlers = {};
    }

    if (_artworkLoadHandler) {
        let artworkEl = qid('artwork');
        artworkEl && app.unlisten(artworkEl, 'load', _artworkLoadHandler);
        _artworkLoadHandler = undefined;
    }

    if (_settingsChangeHandler) {
        app.unlisten(window.settings.observer, 'change', _settingsChangeHandler);
        _settingsChangeHandler = undefined;
        _settingsChangeRegistered = false;
    }
};

function loadFromSettings() {
    let sett = window.settings.get('Options');
    let screen = app.utils.getMainMonitorInfo();

    let _left = Math.floor((screen.availLeft + Math.floor((sett.InfoPopUp.Horizontal / 100) * (screen.availWidth - _width))));
    let _top = Math.floor((screen.availTop + Math.floor((sett.InfoPopUp.Vertical / 100) * (screen.availHeight - _height))));
    if (!_width || !_height || isNaN(_left) || isNaN(_top)) {
        return;
    }

    //For users that are concerned with processing/battery power (On my computer, a stepSize of 1 did NOT have significant CPU usage, however)
    if (sett.InfoPopUp.LessSmooth == true) opacityStepSize = 4;

    if (sett.InfoPopUp.FadeTime) {
        //For fade time under 10ms, make it disappear immediately
        if (sett.InfoPopUp.FadeTime < 10) opacityStepSize = 100;
        //For fade time under 1 second, increase opacity step size to save processing power
        else if (sett.InfoPopUp.FadeTime < 1000) {
            opacityStepSize = (sett.InfoPopUp.LessSmooth == true) ? 10 : 4;
        }
        //Calculate stepDuration based on fadeTime and the previously set opacityStepSize
        opacityStepDuration = Math.floor(sett.InfoPopUp.FadeTime * opacityStepSize * 0.01);
    }

    //console.log(`_left=${_left} _top=${_top} _width=${_width} _height=${_height}`);

    _timeout = sett.InfoPopUp.ShowTime;
    initOpacity = sett.InfoPopUp.Opacity;
    setBounds(_left, _top, _width, _height);
    if (!_params.ignoreSettings) {
        _opacity = sett.InfoPopUp.Opacity;
        window.opacity = _opacity;
    }
}

function showTrackInfo(params) {
    params = params || _params || {};
    let thumbSize = 10 * Math.round(emToPx(7) / 10);

    if (thumbCancelToken !== undefined) {
        app.cancelLoaderToken(thumbCancelToken);
        thumbCancelToken = undefined;
    }

    if (!_settingsChangeRegistered && !params.ignoreSettings) {
        _settingsChangeRegistered = true;
        _settingsChangeHandler = loadFromSettings;
        app.listen(window.settings.observer, 'change', _settingsChangeHandler);
    }
    let sd;
    sd = params.sd || app.player.getFastCurrentTrack(sd);
    if (!sd) {
        ODS('*** dlgTrackInfo init - no SD');
        //closeWindow();
        return false;
    }

    if (visible && usedSD && sd) {
        // check SD is same
        if (usedSD.persistentID === sd.persistentID) {
            return;
        }
    }

    if (_hideTimeout) {
        clearTimeout(_hideTimeout);
        _hideTimeout = undefined;
    }

    usedSD = sd;
    const expectedPID = sd.persistentID;

    if (params.opacity !== undefined) {
        initOpacity = params.opacity;
    }

    if (params.left !== undefined && params.top !== undefined) {
        bounds.setPosition(params.left, params.top);
    }

    if (params.width !== undefined) {
        bounds.width = params.width;
    }

    if (params.height !== undefined) {
        bounds.height = params.height;
    }

    _opacity = initOpacity;
    window.opacity = initOpacity;

    let titleEl = qid('title');
    let artistEl = qid('artist');
    let albumEl = qid('album');

    let artworkEl = qid('artwork');
    let unknownAAEl = qid('unknownAA');
    let ready = false;
    let _hidingcalled = false;
    let _mouseIn = false;

    //callSlowHide is now only called once
    let callSlowHide = function (time) {
        //clear any already-existing timeouts to slowHide
        clearTimeout(_hideTimeout);

        _hidingcalled = true;
        _hideTimeout = requestTimeout(doSlowHide, time);
    }

    let doSlowHide = function () {
        _hideTimeout = undefined;
        if (_mouseIn) {
            _hidingcalled = false;
            return;
        }
        _opacity -= opacityStepSize;
        if (_opacity <= 0) {
            //_hidingcalled is set to false here instead of at the top
            _hidingcalled = false;
            hide();
        } else {
            window.opacity = _opacity;
            _hideTimeout = requestTimeout(doSlowHide, opacityStepDuration);
        }
    }

    let loadingPath = undefined;

    let showWin = function () {
        if (!visible) {
            show();
            if (!params.disableAutoHide && !_hidingcalled)
                callSlowHide(_timeout);
        };
    };

    if (_artworkLoadHandler) {
        app.unlisten(artworkEl, 'load', _artworkLoadHandler);
    }
    _artworkLoadHandler = function () {
        if (loadingPath === artworkEl.src)
            showWin();
    };
    app.listen(artworkEl, 'load', _artworkLoadHandler);

    let applyCover = function (path, notEmpty) {
        lastCoverPath = path;
        if (path && (path !== '-')) {
            artworkEl.src = ''; // needed, otherwise load event is not called sometimes
            artworkEl.src = path;
            loadingPath = artworkEl.src;
            setVisibility(artworkEl, true);
            setVisibility(unknownAAEl, false);
            ready = true;
        } else if (!notEmpty) {
            setVisibility(artworkEl, false);
            setVisibility(unknownAAEl, true);
            loadingPath = undefined;
            requestFrame(showWin);
        }
    };

    titleEl.innerText = sd.title;
    artistEl.innerText = sd.artist;
    albumEl.innerText = sd.album;
    unknownAAEl.style.width = thumbSize + 'px';
    //unknownAAEl.style.height = thumbSize + 'px';
    //artworkEl.style.width = thumbSize + 'px';
    //artworkEl.style.height = thumbSize + 'px';
    if (sd.getCachedThumb) {
        let path = sd.getCachedThumb(thumbSize, thumbSize);
        if (lastCoverPath !== path) {
            applyCover(path, true); // do not empty if not found cached image, to avoid flickering, #17740
        } else
            ready = (path !== '');
    }
    if (!ready && sd.getThumbAsync) {
        thumbCancelToken = sd.getThumbAsync(thumbSize, thumbSize, function (path) {
            if (window._cleanUpCalled || expectedPID !== (usedSD && usedSD.persistentID))
                return;
            thumbCancelToken = undefined;
            if (path && (path !== '-'))
                applyCover(path);
            else {
                if (sd.idalbum > 0) {
                    window.localPromise(app.getObject('album', {
                        id: sd.idalbum,
                        name: sd.album,
                        artist: sd.albumArtist || sd.artist,
                        canCreateNew: false
                    })).then(function (album) {
                        if (!album || expectedPID !== (usedSD && usedSD.persistentID))
                            return;
                        thumbCancelToken = album.getThumbAsync(thumbSize, thumbSize, function (path) {
                            if (window._cleanUpCalled || expectedPID !== (usedSD && usedSD.persistentID))
                                return;
                            applyCover(path);
                            thumbCancelToken = undefined;
                        });
                    });
                } else
                    applyCover(''); // cover not found, show noaa icon
            }
        });
    } else if(params.ignoreSettings) { // forced show
        showWin();   
    }


    let handleMouseOver = function (evt) {
        let b = window.bounds.windowRect;
        if ((evt.screenX > b.left) && (evt.screenX < b.right) && (evt.screenY > b.top) && (evt.screenY < b.bottom)) {
            let sett = window.settings.get('Options');
            _mouseIn = true;
            if (!_params.ignoreSettings) {
                _opacity = sett.InfoPopUp.Opacity;
                window.opacity = _opacity;
            }
        } else {
            _mouseIn = false;
        }
    }.bind(this);

    let handleMouseOut = function (evt) {
        let b = window.bounds.windowRect;
        if ((evt.screenX > b.left) && (evt.screenX < b.right) && (evt.screenY > b.top) && (evt.screenY < b.bottom)) {
            _mouseIn = true;
        } else {
            _mouseIn = false;
            if (!_hidingcalled)
                callSlowHide(_timeout);
        }
    }.bind(this);

    let handleMouseClick = function () {
        //set opacity to 0 to end the doSlowHide loop
        _opacity = 0;
        hide();
    }.bind(this);

    if (!params.disableAutoHide) {
        if (!_mouseListenersRegistered) {
            _mouseHandlers = {
                over: handleMouseOver,
                out: handleMouseOut,
                click: handleMouseClick
            };
            app.listen(document.body, 'mouseover', _mouseHandlers.over);
            app.listen(document.body, 'mouseout', _mouseHandlers.out);
            app.listen(document.body, 'click', _mouseHandlers.click);
            _mouseListenersRegistered = true;
        }
        if (!_hidingcalled)
            callSlowHide(_timeout);
    } else if (_mouseListenersRegistered) {
        app.unlisten(document.body, 'mouseover', _mouseHandlers.over);
        app.unlisten(document.body, 'mouseout', _mouseHandlers.out);
        app.unlisten(document.body, 'click', _mouseHandlers.click);
        _mouseListenersRegistered = false;
        _mouseHandlers = {};
    }
};

function setPos(x, y) {
    //ODS('--- set pos ' + x + ', ' + y);
    let screen = app.utils.getMainMonitorInfo();

    window.bounds.left = screen.availLeft + Math.floor((x / 100) * (screen.availWidth - _width));
    window.bounds.top = screen.availTop + Math.floor((y / 100) * (screen.availHeight - _height));
}
