/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

function init(params) {
    let wnd = this;
    wnd.resizeable = true;
    title = _('New version available');
    qid('lblInstalledVersion').innerText = app.utils.getApplicationVersion(4);
    qid('lblNewVersion').innerText = params.verFull + (params.isBeta ? ' (beta)' : '');
    let infoText = params.verDescription;
    if (params.purchaseMsg != '') 
       infoText += ' <br>---------------------------------------------------------------------------------------------------------------------------------------<br> ' + params.purchaseMsg; 
    qid('newVerDesc').innerHTML = infoText;
    let btnOK = qid('btnOK');
    let btnBuy = qid('btnBuy');
    setVisibility(btnBuy, params.purchaseURL != '');
    if (params.purchaseURL != '') {
        btnBuy.controlClass.default = true;
        btnOK.controlClass.default = false;
    }

    let btnDismiss = qid('btnDismiss');
    setVisibility(btnDismiss, !params.manualCheck);
    if (!params.manualCheck) {
        btnDismiss.setAttribute('data-tip', _('Dismiss') + ' ' + params.verFull + (params.isBeta ? ' (beta)' : ''));
    }
    window.outData = '';
    let downURL = params.downloadURL || 'https://download.mediamonkey.com';

    let install = false;
    if (downURL.endsWith('.exe')) {
        install = true;
        btnOK.controlClass.textContent = _('Install Now');
    }

    window.localListen(btnOK, 'click', function () {
        if (install) {
            // download and install the installer
            app.utils.downloadAndRunInstaller( downURL);
        } else {
            // open a web page
            uitools.openWeb(downURL);
        }
        closeWindow();
    });
    if (!params.manualCheck) {
        window.localListen(btnDismiss, 'click', () => {
            window.outData = 'dismiss';
            closeWindow();
        });
    }

    if (params.betaInfoURL) {
        setVisibility( btnBuy, true);
        btnBuy.controlClass.textContent = _('Info');
        window.localListen(btnBuy, 'click', () => {
            uitools.openWeb(params.betaInfoURL);          
        });
    }
    else
    if (params.purchaseURL) {
        window.localListen(btnBuy, 'click', () => {
            uitools.openWeb(params.purchaseURL);
            closeWindow();
        });
    }
};