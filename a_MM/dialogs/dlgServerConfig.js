/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

function init(params) {
    let wnd = this;
    wnd.resizeable = true;
    assert(params.server, 'params.server not defined');
    wnd.title = _('Media Sharing') + ' (' + params.server.name + ')';

    qid('serverConfig').controlClass.dataSource = params.server;

    window.localListen(qid('btnOK'), 'click', function () {
        qid('serverConfig').controlClass.save();
        closeWindow();
    });
}