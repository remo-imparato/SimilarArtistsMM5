/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

function init(params) {
    let wnd = this;
    if (params.podcast.podcastURL)
        wnd.title = _('Unsubscribe');
    else
        wnd.title = _('Remove');
    wnd.resizeable = false;
    wnd.podcast = params.podcast;

    qid('lblUnsubscribeText').innerText = _('Are you sure you want to unsubscribe') + ' ' + wnd.podcast.title + ' ?';
    qid('rbUnsubscribe').controlClass.checked = true;

    if (!params.podcast.podcastURL) {
        qid('rbUnsubscribe').controlClass.text = _('Remove');
        qid('rbUnsubscribeAndDelete').controlClass.text = qid('rbUnsubscribeAndDelete').controlClass.text.replace(_('Unsubscribe'), _('Remove'));
        qid('lblUnsubscribeText').innerText = qid('lblUnsubscribeText').innerText.replace('unsubscribe', 'remove');
    }

    window.localListen(qid('btnYes'), 'click', function () {
        let deleteEpisodes = qid('rbUnsubscribeAndDelete').controlClass.checked;
        wnd.podcast.unsubscribeAsync(deleteEpisodes);
        modalResult = 1;
        closeWindow();
    });
    window.localListen(qid('btnNo'), 'click', function () {
        closeWindow();
    });
}
