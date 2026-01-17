/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

function init(params) {
    let wnd = this;
    wnd.resizeable = true;

    if (params.purpose == 'search') {
        wnd.title = _('Search');
    } else
    if (params.purpose == 'autoPlaylist') {
        wnd.title = _('AutoPlaylist criteria');
    }

    window.localPromise(app.db.getQueryData({
        category: params.purpose
    })).then(function (aQD) {
        qid('searchEditor').controlClass.setQueryData(aQD);
    });

    window.localListen(qid('btnOK'), 'click', function () {
        closeWindow();
    });
}