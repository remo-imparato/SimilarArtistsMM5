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
const
    ID_WINDOWED = 1,
    ID_FULLWINDOW = 2,
    ID_FULLSCREEN = 3;

function initButtons() {
    var parent = document.createElement('div');
    parent.classList.add('flex');
    parent.classList.add('row');
    document.body.appendChild(parent);

    var createVideoModeSwitchButton = function (iconName, id) {
        var div = document.createElement('div');
        div.classList.add('toolbutton');
        div.style.zIndex = 999999;
        //div.style.position = 'absolute';
        loadIcon(iconName, function (iconData) {
            div.innerHTML = iconData;
        });
        div.id = id;
        app.listen(div, 'click', function (e) {
            if (this.id == ID_WINDOWED) {
                switchToVideoMode('modeWindowed');
            } else if (this.id == ID_FULLWINDOW) {
                switchToVideoMode('modeFullWindow');
            } else if (this.id == ID_FULLSCREEN) {
                switchToVideoMode('modeFullScreen');
            }
        }.bind(div));
        parent.appendChild(div);
        setVisibility(div, false);
        return div;
    }

    btnVideoModeToWindowed = createVideoModeSwitchButton('mode_windowed', ID_WINDOWED);
    btnVideoModeToFullWindow = createVideoModeSwitchButton('mode_fullwindow', ID_FULLWINDOW);
    btnVideoModeToFullScreen = createVideoModeSwitchButton('mode_fullscreen', ID_FULLSCREEN);
}

function layoutChange(rect) {
    watchWindowPos = rect;
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

    var pos = intPlayer.controlClass.getPos();
    var playerSize = intPlayer.controlClass.getSize();

    var playerLeft = pos.left;
    var playerTop = pos.top;
    var playerWidth = playerSize.width;
    var playerHeight = playerSize.height;

    style = getComputedStyle(btnVideoModeToWindowed, null);
    var btnWidth = parseFloat(style.getPropertyValue('width'));
    var btnHeight = parseFloat(style.getPropertyValue('height'));

    var prepareButtons = function (button1, button2, hideButton) {
        if(currentMode == 'modeFullScreen') {
            var finalLeft = (watchWindowPos.right - (btnWidth * 4)) | 0;
            var finalTop = (watchWindowPos.top + btnHeight) | 0;
        }else{
            var finalLeft = (watchWindowPos.left + ((playerLeft + playerWidth) - (btnWidth * 4))) | 0;
            var finalTop = (watchWindowPos.top + (playerTop + (btnHeight * 2))) | 0;
        }
        window.setBounds(finalLeft, finalTop, (btnWidth * 4) | 0, (btnHeight * 2) | 0);
        setVisibility(button1, true);
        setVisibility(button2, true);
        setVisibility(hideButton, false);
    };

    if (btnVideoModeToWindowed && btnVideoModeToFullScreen && btnVideoModeToFullWindow) {
        if (currentMode == 'modeFullWindow') {
            prepareButtons(btnVideoModeToWindowed, btnVideoModeToFullScreen, btnVideoModeToFullWindow);
        } else if (currentMode == 'modeWindowed') {
            prepareButtons(btnVideoModeToFullWindow, btnVideoModeToFullScreen, btnVideoModeToWindowed);
        } else if (currentMode == 'modeFullScreen') {
            prepareButtons(btnVideoModeToWindowed, btnVideoModeToFullWindow, btnVideoModeToFullScreen);
        }
    }
    lastCurrentMode = currentMode;
}