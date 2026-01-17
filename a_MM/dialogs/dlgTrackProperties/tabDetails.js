/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

let bookmarkVisible = false;
let abVisible = false;

function roundNormalizationNum(num) {
    return parseFloat(num.toFixed(6)).toString(); // use max. 6 places, more do not correctly fit to float/single value and are confusing
}

propertiesTabs.tabDetails.load = function (track, dialog) {

    let mainElement = qid('tabDetailsContent');
    let utils = app.utils;
    let UI = getAllUIElements(mainElement);

    UI.grouping.controlClass.value = track.groupDesc;
    let txt = '';
    if (track.bpm > 0)
        txt = String(track.bpm);
    UI.bpm.controlClass.value = txt;
    UI.initialKey.controlClass.value = track.initialKey;
    UI.involvedpeople.controlClass.value = utils.multiString2VisualString(track.involvedPeople);
    UI.origartist.controlClass.value = utils.multiString2VisualString(track.origArtist);
    UI.origtitle.controlClass.value = track.origTitle;
    UI.origlyricist.controlClass.value = utils.multiString2VisualString(track.origLyricist);
    UI.isrc.controlClass.value = track.isrc;
    let basicTab = qid('tabBasicContent');
    let basicPublisher = undefined;
    let basicAuthors = undefined;
    if(basicTab) {
        basicPublisher = qeid(basicTab, 'publisherAB');
        basicAuthors = qeid(basicTab, 'authors');
    }
    if(basicPublisher && basicPublisher.controlClass)
        UI.publisher.controlClass.value = basicPublisher.controlClass.value;
    else
        UI.publisher.controlClass.value = track.publisher;
    if(basicAuthors && basicAuthors.controlClass)
        UI.authorsAB.controlClass.value = basicAuthors.controlClass.value;
    else
        UI.authorsAB.controlClass.value = utils.multiString2VisualString(track.author);
    // events to update synchronized fields in Basic tab, if existing
    dialog.trackLocalListen(UI.publisher, 'change', function () {
        basicTab = basicTab || qid('tabBasicContent');
        if(basicTab) {
            basicPublisher = basicPublisher ||qeid(basicTab, 'publisherAB');
            if(basicPublisher && basicPublisher.controlClass && (basicPublisher.controlClass.value !== UI.publisher.controlClass.value)) {
                basicPublisher.controlClass.value = UI.publisher.controlClass.value;
            }
        }
    });
    dialog.trackLocalListen(UI.authorsAB, 'change', function () {
        basicTab = basicTab || qid('tabBasicContent');
        if(basicTab) {
            basicAuthors = basicAuthors || qeid(basicTab, 'authors');
            if(basicAuthors && basicAuthors.controlClass && (basicAuthors.controlClass.value !== UI.authorsAB.controlClass.value)) {
                basicAuthors.controlClass.value = UI.authorsAB.controlClass.value;
            }
        }
    });

    UI.encoder.controlClass.value = track.encoder;
    UI.copyright.controlClass.value = track.copyright;
    UI.parentalrating.controlClass.value = track.parentalRating;

    UI.starttime.controlClass.value = utils.songTimeToStrEx(track.startTime);

    if (track.playCounter >= 0)
        UI.playcounter.controlClass.value = track.playCounter;
    if (track.skipCount >= 0)    
        UI.skipcounter.controlClass.value = track.skipCount;

    if (track.normalizeTrack > utils.getConst('NORMALIZE_TRACK_NULL_VALUE'))
        UI.volume_track.controlClass.value = roundNormalizationNum(track.normalizeTrack + utils.normalizationDiff());
    else
        UI.volume_track.controlClass.value = '';

    if (track.normalizeAlbum > utils.getConst('NORMALIZE_TRACK_NULL_VALUE'))
        UI.volume_album.controlClass.value = roundNormalizationNum(track.normalizeAlbum + utils.normalizationDiff());
    else
        UI.volume_album.controlClass.value = '';

    UI.bookmark.controlClass.value = utils.songTimeToStrEx(track.playbackPos);
    if (!dialog.isGroup) {
        if (track.stopTime > 0)
            UI.stoptime.controlClass.value = utils.songTimeToStrEx(track.stopTime);
        else
            UI.stoptime.controlClass.value = utils.songTimeToStrEx(track.songLength);

        UI.val_len.innerText = getFormatedTime(track.songLength, {
            useEmptyHours: false
        });
        UI.val_fs.innerText = formatFileSize(track.fileLength);

        if (track.bitrate > 0)
            UI.val_bitrate.innerText = utils.bitRateToStr(track.bitrate) + ' ' + _('kbps');
        else
            UI.val_bitrate.innerText = _('Unknown');
        if (track.lastTimePlayed > 0)
            UI.val_lastplay.innerText = utils.dateTimeToStr(track.lastTimePlayed);
        else
            UI.val_lastplay.innerText = _('Never');

        UI.val_added.innerText = (track.dateAdded > 0) ? (utils.dateTimeToStr(track.dateAdded)) : _('Never');
        UI.val_timestamp.innerText = utils.dateTimeToStr(track.fileModified);

        if (track.isVideo) {
            //            setVisibility(UI.volume_track'), false);
            setVisibility(UI.volume_album, false);
            setVisibility(UI.lbl_volume_album, false);
            setVisibility(UI.detailsLine3, false);
            setVisibility(UI.detailsLine4, false);
            setVisibility(UI.lbl_bps, false);
            setVisibility(UI.val_bps, false);
            setVisibility(UI.streamsLine, true);
            let slEl = UI.streamList;
            let sl = newStringList(true);
            dialog.localPromise(track.getVideoFormatAsync()).then(function (vf) {
                if (vf) {
                    for (let i = 0; i < vf.streamCount; i++) {
                        sl.add(vf.getInfoString(' ', i + 1));
                    };
                    slEl.controlClass.dataSource = sl;
                }
            });
        } else {
            setVisibility(UI.streamsLine, false);
            UI.val_freq.innerText = utils.freqToStr(track.frequency) + ' ' + _('Hz');
            UI.val_channels.innerText = utils.stereoToStr(track.stereo);
            UI.val_vbr.innerText = utils.boolToYesNo(track.vbr);
            //UI.val_norm.innerText = utils.getNormalizeText(track.normalizeTrack, track.normalizeAlbum);
            if (track.bps > 0) {
                setVisibility(UI.lbl_bps, true);
                UI.val_bps.innerText = track.bps;
                setVisibility(UI.val_bps, true);
            } else {
                setVisibility(UI.lbl_bps, false);
                setVisibility(UI.val_bps, false);
            }
        }
    } else {
        UI.stoptime.value = utils.songTimeToStrEx(0);
        let el = UI.section4;
        setVisibility(el, false);
        el.setAttribute('readonly', 1);
    }
}

propertiesTabs.tabDetails.saveAsync = function (track, dialog) {
    let mainElement = qid('tabDetailsContent');
    let UI = getAllUIElements(mainElement);    
    let utils = app.utils;

    if (!dialog.isGroup) {
        track.groupDesc = UI.grouping.controlClass.value;
        track.initialKey = UI.initialKey.controlClass.value;
        track.involvedPeople = utils.visualString2MultiString(UI.involvedpeople.controlClass.value);
        track.origTitle = UI.origtitle.controlClass.value;
        track.origArtist = utils.visualString2MultiString(UI.origartist.controlClass.value);
        track.parentalRating = UI.parentalrating.controlClass.value;
        track.origLyricist = utils.visualString2MultiString(UI.origlyricist.controlClass.value);
        track.bpm = utils.string2BPM(UI.bpm.controlClass.value);
        track.isrc = UI.isrc.controlClass.value;
        if(abVisible)
            track.author = utils.visualString2MultiString(UI.authorsAB.controlClass.value);
        else
            track.publisher = UI.publisher.controlClass.value;
        track.encoder = UI.encoder.controlClass.value;
        track.copyright = UI.copyright.controlClass.value;
        track.startTime = utils.strToSongTimeEx(UI.starttime.controlClass.value);
        track.stopTime = utils.strToSongTimeEx(UI.stoptime.controlClass.value);
        if (bookmarkVisible) {
            track.playbackPos = utils.strToSongTimeEx(UI.bookmark.controlClass.value);
            if (track.playbackPos >= track.songLength)
                track.playbackPos = 0;
        }

        if (track.stopTime >= track.songLength)
            track.stopTime = 0;

        let val = UI.playcounter.controlClass.value;
        if (val == '')
            val = 0;
        let c = parseInt(val);
        if (!isNaN(c) && (track.playCounter != c)) {
            track.playCounter = c;
            if (c == 0)
                track.lastTimePlayed = -1;
            else
                track.lastTimePlayed = utils.now();
            utils.addToPlayedAsync(track);
        }

        val = UI.skipcounter.controlClass.value;
        if (val == '')
            val = 0;        
        c = parseInt(val);
        if (!isNaN(c)) {
            track.skipCount = c;
            if (c == 0)
                track.lastTimeSkipped = -1;
            else
                track.lastTimeSkipped = utils.now();
        }

        let v = UI.volume_track.controlClass.value;
        if (v == '')
            v = utils.getConst('NORMALIZE_TRACK_NULL_VALUE');
        c = parseFloat(v);
        if (!isNaN(c))
            track.normalizeTrack = c - utils.normalizationDiff();

        v = UI.volume_album.controlClass.value;
        if (v == '')
            v = utils.getConst('NORMALIZE_TRACK_NULL_VALUE');
        c = parseFloat(v);
        if (!isNaN(c))
            track.normalizeAlbum = c - utils.normalizationDiff();

    } else {
        // multiple tracks modification
        let ischecked = function (id) {
            let res = false;
            let chb = UI['chb_' + id];
            if (chb)
                res = chb.controlClass.checked;
            return res;
        };
        let setccval = function (val, id) {
            if (ischecked(id))
                track[val] = UI[id].controlClass.value;
        };
        let setmulticcval = function (val, id) {
            if (ischecked(id))
                track[val] = utils.visualString2MultiString(UI[id].controlClass.value);
        };

        setccval('groupDesc', 'grouping');
        setccval('initialKey', 'initialKey');
        setccval('involvedPeople', 'involvedpeople');
        setccval('origTitle', 'origtitle');
        setmulticcval('origArtist', 'origartist');
        setccval('parentalRating', 'parentalrating');
        setmulticcval('origLyricist', 'origlyricist');
        if (ischecked('bpm'))
            track.bpm = utils.string2BPM(UI.bpm.controlClass.value);

        setccval('isrc', 'isrc');
        if(abVisible)
            setmulticcval('author', 'authorsAB');
        else
            setccval('publisher', 'publisher');
        setccval('encoder', 'encoder');
        setccval('copyright', 'copyright');
        if (ischecked('starttime'))
            track.startTime = utils.strToSongTimeEx(UI.starttime.controlClass.value);
        if (ischecked('stoptime')) {
            track.stopTime = utils.strToSongTimeEx(UI.stoptime.controlClass.value);
            if (track.stopTime === track.songLength)
                track.stopTime = 0;
        }
        if (bookmarkVisible && ischecked('bookmark')) {
            track.playbackPos = utils.strToSongTimeEx(UI.bookmark.controlClass.value);
            if (track.playbackPos >= track.songLength)
                track.playbackPos = 0;
        }

        let c;
        let v;
        if (ischecked('playcounter')) {
            c = parseInt(UI.playcounter.controlClass.value);
            if (!isNaN(c))
                track.playCounter = c;
        }
        if (ischecked('skipcounter')) {
            c = parseInt(UI.skipcounter.controlClass.value);
            if (!isNaN(c))
                track.skipCount = c;
        }
        if (ischecked('volume_track')) {
            v = UI.volume_track.controlClass.value;
            if (v == '')
                v = utils.getConst('NORMALIZE_TRACK_NULL_VALUE');
            c = parseFloat(v);
            if (!isNaN(c))
                track.normalizeTrack = c - utils.normalizationDiff();
        }
        if (ischecked('volume_album')) {
            v = UI.volume_album.controlClass.value;
            if (v == '')
                v = utils.getConst('NORMALIZE_TRACK_NULL_VALUE');
            c = parseFloat(v);
            if (!isNaN(c))
                track.normalizeAlbum = c - utils.normalizationDiff();
        }
    }
    return dummyPromise();
}

propertiesTabs.tabDetails.updateVisibility = function (trackType, dialog, trackTypeID) {
    let ttSetts = app.settings.utils.getTrackTypeSettings();
    if ((trackTypeID >= 0) && (trackTypeID < ttSetts.count)) {
        let ttsett;
        ttSetts.locked(function () {
            ttsett = ttSetts.getValue(trackTypeID);
            ttsett = JSON.parse(ttsett.toString());
        });
        if (ttsett.Player.BookmarkEnabled) {
            dialog.showControls(['tr_bookmark']);
        } else {
            dialog.hideControls(['tr_bookmark']);
        }
        bookmarkVisible = ttsett.Player.BookmarkEnabled;
    }
    abVisible = (trackType == 'audiobook');
    dialog.hideControls(['authorsAB', 'tr_parentalrating', 'tr_origartist', 'tr_origtitle', 'tr_origlyricist']);

    switch (trackType) {
        case 'music':
        case 'musicvideo':
        case 'classical':
        case 'podcast':
        case 'videopodcast':
            {
                dialog.showControls(['publisher', 'tr_origartist', 'tr_origtitle', 'tr_origlyricist']);
                break;
            }
        case 'audiobook':
            {
                dialog.hideControls(['publisher']);
                dialog.showControls(['authorsAB', 'tr_origartist', 'tr_origtitle']);
                break;
            }
        case 'video':
        case 'tv':
            {
                dialog.showControls(['publisher', 'tr_parentalrating']);
                break;
            }
    }
}
