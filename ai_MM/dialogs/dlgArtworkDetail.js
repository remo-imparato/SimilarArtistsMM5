/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

requirejs("controls/popupmenu");

function init(params) {
    window.resizeable = true;
    window.canMinimize = false;

    let dataObject = null;
    if (params.albumObject) {
        dataObject = params.albumObject;
        q("[data-id=albumTitle]").innerHTML = _('Album') + ': ' + params.albumObject.title;
        q("[data-id=albumArtist]").innerHTML = _('Album Artist') + ': ' + params.albumObject.albumArtist;
        // setClientSize(250, 340);
    } else
    if (params.dataObject) {
        dataObject = params.dataObject;
        //setClientSize(500, 500);
    } else
    if (params.coverItem) {
        dataObject = params.coverItem;
        //setClientSize(250, 250);
    } else
    if (params.trackItem) {
        dataObject = params.trackItem;
        //setClientSize(250, 250);
    }

    let image = q('[data-id=artwork]');
    image.src = "file:///empty.png";
    let artworkBox = q('[data-id=artworkBox]');

    window.localListen(image, 'error', function () {
        let mw = app.dialogs.getMainWindow();
        mw.getValue('requirejs')('controls/toastMessage');
        mw.getValue('_window').uitools.toastMessage.show(_('Image download failed'), {
            delay: 5000
        });
        closeWindow();
    });

    let _Height = 0;
    let _Width = 0;
    let updateStep = 50 /* px */ ;

    window.localListen(window, 'resize', function () {
        if ((Math.abs(_Width - window.clientWidth) > updateStep) || (Math.abs(_Height - window.clientHeight) > updateStep)) {
            if (params.preferImgPath && params.imgPath) {
                image.src = params.imgPath;
            } else {
                dataObject.getThumbAsync(window.clientWidth + updateStep, window.clientHeight + updateStep, function (path) {
                    if (window._cleanUpCalled)
                        return;
                    if (path && (path !== '-')) {
                        image.src = path;
                    } else if (params.imgPath) {
                        image.src = params.imgPath;
                    }
                });
            }
            _Height = window.clientHeight;
            _Width = window.clientWidth;
        }
    });


    let handleKeyDown = function (event, isGlobal) {
        switch (friendlyKeyName(event)) {
            case 'Esc':
                closeWindow();
                event.stopPropagation();
                break;
        }
    };

    window.localListen(window, 'keydown', handleKeyDown, false);

}
