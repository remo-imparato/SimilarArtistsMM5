/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

function init(params) {
    let wnd = this;
    wnd.resizeable = true;
    assert(params.client, 'params.client not defined');
    wnd.title = _('Media Sharing') + ' > ' + params.client.name;

    let cls = qid('clientConfig').controlClass;
    cls.dataSource = params.client;

    if (params.configMode == 'autoConvert') {
        // when accessed via 'gear' icon associated with player output (casting)
        cls.tabControl.controlClass.setTabVisibility('content', false);        
    }

    window.localListen(qid('btnOK'), 'click', function () {
        qid('clientConfig').controlClass.save();
        closeWindow();
    });
}
