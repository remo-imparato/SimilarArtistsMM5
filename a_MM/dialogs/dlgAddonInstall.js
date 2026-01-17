/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

function init(params) {
    let wnd = this;
    wnd.resizeable = true;
    wnd.title = _('Product installation');

    let addon = wnd.addon;

    qid('lblName').innerText = addon.title;
    qid('lblDescription').innerText = addon.description;
    qid('lblVersion').innerText = addon.version;
    qid('lblType').innerText = addon.archiveType;
    qid('lblAuthor').innerText = addon.author;
    let btnInstall = qid('btnOK');

    //addon.minAppVersion = '5.0.3;
    let isAppVersionHigher = function( minAppVersion, appVersion) {
        let minAppVerAr = minAppVersion.split('.');
        let appVerAr = appVersion.split('.');
        if (minAppVerAr.length && appVerAr.length) {
            if (Number(minAppVerAr[0]) > Number(appVerAr[0])) {  
                return true;
            } else 
            if (Number(minAppVerAr[0]) == Number(appVerAr[0])) {
                if ((minAppVerAr.length > 0) && (appVerAr.length > 0)) {
                    if (Number(minAppVerAr[1]) > Number(appVerAr[1]))
                        return true;
                    else
                    if (Number(minAppVerAr[1]) == Number(appVerAr[1]))
                        if ((minAppVerAr.length > 1) && (appVerAr.length > 1) && (Number(minAppVerAr[2]) > Number(appVerAr[2])))
                            return true;
                }
            }
        }
    }

    if (addon.minAppVersion && isAppVersionHigher( addon.minAppVersion, app.utils.getApplicationVersion(3 /*#19062*/))) {
        qid('lblCompatibility').innerHTML = _('This addon is incompatible with current version of MediaMonkey') + ' (' + app.utils.getApplicationVersion(3) + ')';
        qid('lblCompatibility2').innerHTML = sprintf(_('Please update to MediaMonkey %s or higher.'), [addon.minAppVersion]);
        btnInstall.controlClass.disabled = true;
        setVisibility(qid('lblTrust'), false);
        setVisibility(qid('lblMalicious'), false);        
    } else
    if (addon.maxAppVersion && isAppVersionHigher( app.utils.getApplicationVersion(3 /*#19062*/), addon.maxAppVersion)) {
        qid('lblCompatibility').innerHTML = _('This addon is incompatible with current version of MediaMonkey');
        qid('lblCompatibility2').innerHTML = app.utils.getApplicationVersion(3) + ' <> '+ addon.maxAppVersion;
        btnInstall.controlClass.disabled = true;
        setVisibility(qid('lblTrust'), false);
        setVisibility(qid('lblMalicious'), false);        
    } else {
        setVisibility(qid('lblCompatibility'), false);
        setVisibility(qid('lblCompatibility2'), false);
    }

    if (addon.license) {
        qid('licenseTxt').innerText = addon.license;
        if (clientWidth < 600)
            clientWidth = 600;
        if (clientHeight < 600)
            clientHeight = 600;
        let chb = qid('chbAccept');
        chb.controlClass.localListen(chb, 'change', function () {
            btnInstall.controlClass.disabled = !chb.controlClass.checked;
        });
        btnInstall.controlClass.disabled = !chb.controlClass.checked;
    } else {
        setVisibility(qid('license'), false);
        if (clientWidth > 500)
            clientWidth = 500;
        if (clientHeight > 300)
            clientHeight = 300;
    };
    let image = qid('image');
    let icon = qid('icon');
    let imageBox = qid('imageBox');

    window.localPromise(addon.getIconAsync()).then(function (path) {
        let ext = path.substr(path.length - 4, 4);
        if (ext == '.svg') {
            setVisibility(image, false);
            setVisibility(imageBox, (path != ''));
            loadIcon(path, function (iconData) {
                if (!window._cleanUpCalled)
                    icon.innerHTML = iconData;
            });
        } else {
            setVisibility(icon, false);
            setVisibility(imageBox, (path != ''));
            image.src = path;
        }
    });

    window.localListen(btnInstall, 'click', function () {
        if (btnInstall.controlClass.disabled)
            return;
        let res = {
            btnID: 'btnOK'
        };
        setResult(res);
        closeWindow();
    });

    wnd.showModal();
};
