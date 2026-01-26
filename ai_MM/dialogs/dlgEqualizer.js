/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

function init(params) {
    var wnd = this;
    wnd.title = _('Equalizer');
    wnd.resizeable = false;

    qid('equalizerBox').controlClass.showButtons = true;
}