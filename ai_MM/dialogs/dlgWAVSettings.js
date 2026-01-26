/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

import '/commonControls';
requirejs("controls/popupmenu");

let srateVals = [0, 11025, 22050, 44100, 48000, 88200, 96000, 176400, 192000];
let bpsVals = [0, 8, 16, 24, 32];
let channelVals = [0, 1, 2, 3, 4, 5, 6, 7, 8];

window.outData = '';

window.init = function(params) {
    resizeable = false;
    title = _('WAV settings');
    let srate = qid('samplerate').controlClass;
    let bps = qid('bps').controlClass;
    let channels = qid('channels').controlClass;

    // prepare sampleRate dropDown
    let ds = newStringList();
    let sIdx = 0;
    let hz = _('Hz');
    forEach(srateVals, function (srItem, idx) {
        if (srItem === 0)
            ds.add(_('Original'));
        else
            ds.add(srItem + ' ' + hz);
        if (srItem === params.sampleRate)
            sIdx = idx;
    });
    srate.dataSource = ds;
    srate.focusedIndex = sIdx;

    // prepare channels dropDown
    ds = newStringList();
    sIdx = 0;
    forEach(channelVals, function (chItem, idx) {
        if (chItem === 0)
            ds.add(_('Original'));
        else
            ds.add('' + chItem);
        if (chItem === params.channels)
            sIdx = idx;
    });
    channels.dataSource = ds;
    channels.focusedIndex = sIdx;

    // prepare bps dropDown
    ds = newStringList();
    sIdx = 0;
    forEach(bpsVals, function (bpsItem, idx) {
        if (bpsItem === 0)
            ds.add(_('Original'));
        else
            ds.add('' + bpsItem);
        if (bpsItem == params.bps)
            sIdx = idx;
    });
    bps.dataSource = ds;
    bps.focusedIndex = sIdx;

    window.localListen(qid('btnOK'), 'click', function () {
        window.outData = '' + srateVals[srate.focusedIndex] + '|' + bpsVals[bps.focusedIndex] + '|' + channelVals[channels.focusedIndex];
        closeWindow();
    });
};