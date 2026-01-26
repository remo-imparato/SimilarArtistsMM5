/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

requirejs('actions');
requirejs('helpers/mediaSync');

function init(params) {
    let wnd = this;
    let _result;
    wnd.resizeable = false;
    title = _('Sign in') + ' \'' + params.server.name + '\'';


    let chbUser = qid('chbUser');
    let chbPass = qid('chbPass');
    chbPass.setAttribute('type', 'password');
    let btnOK = qid('btnOK');
    let lblDesc = qid('lblDesc');
    let lblErr = qid('lblErr');
    lblDesc.innerText = sprintf(_('Please enter your username and password to sign in \'%s\''), params.server.name);

    chbUser.focus();

    let btnOKUpdate = function () {
        if (!window._cleanUpCalled)
            btnOK.controlClass.disabled = (chbUser.value === '') || (chbPass.value === '');
    };

    window.localListen(chbUser, 'change', btnOKUpdate);
    window.localListen(chbPass, 'change', btnOKUpdate);
    window.localListen(chbUser, 'keyup', btnOKUpdate);
    window.localListen(chbPass, 'keyup', btnOKUpdate);
    btnOKUpdate();

    window.localListen(btnOK, 'click', () => {

        let username = chbUser.value;
        let pass = chbPass.value;

        window.localPromise(mediaSyncHandlers.server._login(params.server, username, pass)).then((res) => {
            _result = res;
            wnd.modalResult = 1;
            closeWindow();
        }, (err) => {
            ODS('Login error: ' + err);
            lblErr.innerText = _('Your username or password is incorrect, try it again.');
        });
    });

    this.getResultValue = function () {
        return _result;
    };
}
