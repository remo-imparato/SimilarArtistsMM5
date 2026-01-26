/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

requirejs("controls/popupmenu");
requirejs("actions");

function init(params) {
    let wnd = this;
    wnd.resizeable = true;
    wnd.noAutoSize = true; // disable auto sizing mechanism, we have fixed size
    title = _('About MediaMonkey');
    qid('lblAppName').innerHTML = 'MediaMonkey';
    qid('lblVersion').innerText = app.utils.getApplicationVersion(4) + (app.utils.getPortableMode() ? ' (' + _('Portable mode') + ')' : '');
    qid('lblLicense').innerText = app.utils.getGoldInfo();

    let status;
    let _refreshGoldStatus = function () {
        let goldStatus = app.utils.getGoldStatus();
        status = JSON.parse( goldStatus);
        if (status.text != '')
            qid('lblLicenseStatus').innerText = _('Status') + ': ' + status.text;
        else
            setVisibility( qid('lblLicenseStatus'), false);
        if (status.buttonText != '')
            qid('btnLicenseStatus').controlClass.textContent = status.buttonText;
        else
            setVisibility( qid('btnLicenseStatus'), false);
    }
    _refreshGoldStatus();

    window.localListen(qid('btnLicenseStatus'), 'click', () => {
        if (status.buttonLink == 'register') {
            app.utils.registerLicense().then(() => {
                _refreshGoldStatus();
            });
        } else {
            window.uitools.openWeb( status.buttonLink);
        }
    });
    qid('lblCopyright').innerHTML = sprintf('Copyright &copy; %d Ventis Media Inc., All rights reserved.', new Date().getFullYear());
    qid('lblWarning').innerText = 'MediaMonkey is protected by copyright law. You may not redistribute MediaMonkey without authorization--please download it from:';
    qid('lblUrl').innerText = 'https://www.mediamonkey.com';
    let content = window.loadFile('file:///dialogs/about.html');
    qid('aboutTxt').innerHTML = content;
    window.localListen(qid('btnOK'), 'click', function () {
        closeWindow();
    });
    let developerModeAvailable = !!app.enabledDeveloperMode;
    setVisibility(qid('chbDeveloperMode'), developerModeAvailable);
    if (developerModeAvailable)
        qid('chbDeveloperMode').controlClass.checked = app.isDeveloperModeEnabled();
    window.localListen(qid('chbDeveloperMode'), 'change', function () {
        let status = qid('chbDeveloperMode').controlClass.checked;
        app.enabledDeveloperMode(status);
        app.setValue('developerMode', status);
    });
    window.localListen(qid('lblLicenseLink'), 'click', () => {
        window.uitools.openWeb('https://www.mediamonkey.com/sw/mmw/'+app.versionHi+'/license.txt');        
    });
    window.localListen(qid('lblUrl'), 'click', () => {
        window.uitools.openWeb('https://www.mediamonkey.com/');
    });
    setVisibility( qid('btnEnterLicenseLink'), !app.inPartyMode);
    window.localListen(qid('btnEnterLicenseLink'), 'click', () => {
        modalResult = 2;
        closeWindow();        
    });    
};
