/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

var btnVideoModeToWindowed = null;
var btnVideoModeToFullWindow = null;
var btnVideoModeToFullScreen = null;
var watchWindowPos = {
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 0
};
var lastCurrentMode = null;
var contentControlSize = null;
window.videoModes = {
    C_WINDOWED: 'windowed',
    C_FULLWINDOW: 'fullwindow',
    C_FULLSCREEN: 'fullscreen'
};
let buttonsOwner;
let switchToModeFunc;

function setContentControlSize(size) {
    contentControlSize = size;
}

function initButtons(availableButtons, owner, _switchToModeFunc) {
    buttonsOwner = owner;
    switchToModeFunc = _switchToModeFunc;
    let body = owner || document.body;
    var parent = qe(body, '[data-button-parent]');
    if (!parent) {
        parent = document.createElement('div');
        parent.setAttribute('data-button-parent', '1');
        parent.classList.add('flex');
        parent.classList.add('row');
        body.appendChild(parent);
    }else{
        parent.innerHTML = '';
    }

    var createVideoModeSwitchButton = function (iconName, id) {
        var div = document.createElement('div');
        div.classList.add('toolbutton');
        div.classList.add('paddingSmall');
        div.style.zIndex = 999999;
        loadIcon(iconName, function (iconData) {
            div.innerHTML = iconData;
        });
        div.id = id;
        app.listen(div, 'click', function (e) {
            if (switchToModeFunc)
                switchToModeFunc(this.id);
            else
                switchToMode(this.id);
        }.bind(div));
        parent.appendChild(div);
        setVisibility(div, false);
        return div;
    }

    var modes = availableButtons.split(',');

    if (modes.indexOf(window.videoModes.C_WINDOWED) >= 0)
        btnVideoModeToWindowed = createVideoModeSwitchButton('mode_windowed', window.videoModes.C_WINDOWED);
    else
        btnVideoModeToWindowed = null;

    if (modes.indexOf(window.videoModes.C_FULLWINDOW) >= 0)
        btnVideoModeToFullWindow = createVideoModeSwitchButton('mode_fullwindow', window.videoModes.C_FULLWINDOW);
    else
        btnVideoModeToFullWindow = null;

    if (modes.indexOf(window.videoModes.C_FULLSCREEN) >= 0)
        btnVideoModeToFullScreen = createVideoModeSwitchButton('mode_fullscreen', window.videoModes.C_FULLSCREEN);
    else
        btnVideoModeToFullScreen = null;
}

function layoutChange(rect, doUpdate) {
    watchWindowPos = rect;
    if (doUpdate || doUpdate === undefined)
        updateButtons(lastCurrentMode);
}

function showButtons(doShow) {
    if (doShow) {
        show();
    } else {
        hide();
    }
}

function updateButtons(currentMode) {
    if (!currentMode) return;

    var s = contentControlSize;
    var pos = s.pos;
    var playerSize = s.size;

    var playerLeft = pos.left;
    var playerTop = pos.top;
    var playerWidth = playerSize.width;
    var playerHeight = playerSize.height;

    if (playerWidth === 0) {
        playerWidth = watchWindowPos.width - 16;
    }
    if (playerHeight === 0) {
        playerHeight = watchWindowPos.height;
    }

    var btnWidth = getFullWidth(btnVideoModeToFullWindow);
    var btnHeight = getFullHeight(btnVideoModeToFullWindow);

    var prepareButtons = function (button1, button2, hideButton) {
        var finalLeft;
        var finalTop;
        if (currentMode === window.videoModes.C_FULLSCREEN) {
            finalLeft = (watchWindowPos.right - (btnWidth * 2.5)) | 0;
            finalTop = (watchWindowPos.top + btnHeight/2) | 0;
        } else {
            finalLeft = (watchWindowPos.left + ((playerLeft + playerWidth) - (btnWidth * 2.5))) | 0;
            finalTop = (watchWindowPos.top + (playerTop + (btnHeight/2))) | 0;
        }
        if (isMainWindow && buttonsOwner) {
            buttonsOwner.style.left = finalLeft;
            buttonsOwner.style.top = finalTop;
            buttonsOwner.style.width = (btnWidth * 2) | 0;
            buttonsOwner.style.height = btnHeight | 0;
        } else
            window.setBounds(finalLeft, finalTop, (btnWidth * 2) | 0, btnHeight | 0);
        if (button1) setVisibility(button1, true);
        if (button2) setVisibility(button2, true);
        if (hideButton) setVisibility(hideButton, false);
    };

    //if (btnVideoModeToWindowed && btnVideoModeToFullScreen && btnVideoModeToFullWindow) {
        if (currentMode === window.videoModes.C_FULLWINDOW) {
            prepareButtons(btnVideoModeToWindowed, btnVideoModeToFullScreen, btnVideoModeToFullWindow);
        } else if (currentMode === window.videoModes.C_WINDOWED) {
            prepareButtons(btnVideoModeToFullWindow, btnVideoModeToFullScreen, btnVideoModeToWindowed);
        } else if (currentMode === window.videoModes.C_FULLSCREEN) {
            prepareButtons(btnVideoModeToWindowed, btnVideoModeToFullWindow, btnVideoModeToFullScreen);
        }
    //}
    lastCurrentMode = currentMode;
}