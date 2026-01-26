/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

registerFileImport('templateFormats');
import './utils';
let trackFormat = {
    id: 'item.id',
    title: 'item.title',
    artist: 'app.utils.multiString2VisualString(item.artist)',
    album: 'item.album',
    filename: 'item.filename',
    length: 'getFormatedTime(item.songLength, { useEmptyHours: false})',
    year: 'app.utils.myEncodeDate(item.date)',
    genre: 'app.utils.multiString2VisualString(item.genre)',
    playCounter: 'item.playCounter',
    lastPlayed: 'app.utils.myFormatDateTime(item.lastTimePlayed)',
    bitrate: '(item.bitrate >= 0)? Math.round(item.bitrate / 1000) : ""',
    media: 'item.mediaLabel',
    custom1: 'item.custom1',
    custom2: 'item.custom2',
    custom3: 'item.custom3',
    custom4: 'item.custom4',
    custom5: 'item.custom5',
    custom6: 'item.custom6',
    custom7: 'item.custom7',
    custom8: 'item.custom8',
    custom9: 'item.custom9',
    custom10: 'item.custom10',
    filesize: 'formatFileSize(item.fileLength)',
    bpm: '(item.bpm > 0)? (item.bpm) : ""',
    sampleRate: 'app.utils.freqToStr(item.frequency)',
    stereo: 'app.utils.stereoToStr(item.stereo)',
    bps: 'item.bps',
    normalize: 'app.utils.formatNormalization(item.normalizeTrack)',
    albumArtist: 'app.utils.multiString2VisualString(item.albumArtist)',
    path: 'item.path',
    fileType: 'item.fileType',
    timeStamp: 'app.utils.myFormatDateTime(item.fileModified)',
    dateAdded: 'app.utils.myFormatDateTime(item.dateAdded)',
    composer: 'app.utils.multiString2VisualString(item.author)',
    origDate: 'app.utils.myEncodeDate(item.origDate)',
    tempo: 'app.utils.multiString2VisualString(item.tempo)',
    mood: 'app.utils.multiString2VisualString(item.mood)',
    occasion: 'app.utils.multiString2VisualString(item.occasion)',
    quality: 'app.utils.multiString2VisualString(item.quality)',
    comment: 'item.commentShort',
    lyrics: 'item.lyricsShort',
    normalizeAlbum: 'app.utils.formatNormalization(item.normalizeAlbum)',
    conductor: 'app.utils.multiString2VisualString(item.conductor)',
    discNo: 'item.discNumber',
    involvedPeople: 'item.involvedPeople',
    origArtist: 'app.utils.multiString2VisualString(item.origArtist)',
    origLyricist: 'app.utils.multiString2VisualString(item.origLyricist)',
    origAlbumTitle: 'item.origTitle',
    lyricist: 'app.utils.multiString2VisualString(item.lyricist)',
    grouping: 'item.groupDesc',
    order: 'item.trackNumber',
    trackNumber: 'item.trackNumber + "."',
    skipped: 'item.skipCount',
    summary: 'item.summary',
    dimensions: 'item.dimensions',
    framerate: 'item.frameRateStr',
    podcast: 'item.album',
    series: 'item.album',
    episode: 'item.episodeNumber',
    author: 'app.utils.multiString2VisualString(item.author)',
    producer: 'app.utils.multiString2VisualString(item.producer)',
    director: 'app.utils.multiString2VisualString(item.artist)',
    season: 'item.seasonNumber',
    screenwriter: 'app.utils.multiString2VisualString(item.lyricist)',
    publisher: 'item.publisher',
    actors: 'app.utils.multiString2VisualString(item.actors)',
    parentalRating: 'item.parentalRating',
    trackType: 'item.trackTypeStr',
    initialKey: 'item.initialKey',
};
window.trackFormat = trackFormat;
let trackHyperlinks = {
    artist: 'templates.hotlinkHandler(div, item, el, {type: \'artist\'})',
    albumArtist: 'if(item && item.dataObject) { uitools.globalSettings.showingOnline?templates.hotlinkHandler(div, (item.onlineData?item.onlineData.artistName:""), el, {type: \'albumArtist\', handler: \'artist\'}):templates.hotlinkHandler(div, item.dataObject, el, {type: \'albumArtist\', handler: \'albumartist\'});} else templates.hotlinkHandler(div, item, el, {type: \'albumArtist\', handler: \'albumartist\'})',
    album: 'templates.hotlinkHandler(div, item, el, {type: \'album\'})',
    genre: 'templates.hotlinkHandler(div, item, el, {type: \'genre\'})',
    combinedAlbum: 'new Function(\'div\', \'item\', \'el\', "' +
        ' if (!el.albumSpan) { el.albumSpan = document.createElement(\'span\'); el.appendChild(el.albumSpan); } ' +
        ' templates.hotlinkHandler(div, item, el.albumSpan, {type: \'album\'}); ' +
        ' if (!el.artistSpan) { el.artistSpan = document.createElement(\'span\'); el.appendChild(el.artistSpan); } ' +
        ' templates.hotlinkHandler(div, item, el.artistSpan, {type: \'albumArtist\', handler: \'artist\', addBefore: \' (\', addAfter: \')\'}); ' +
        ' ")(div, item, el)',
    year: 'templates.hotlinkHandler(div, item, el, {type: \'year\'})'
};
window.trackHyperlinks = trackHyperlinks;
let albumHyperlinks = {
    album: 'templates.hotlinkHandler(div, item, el, {type: \'album\', secType: \'title\'})',
    albumArtist: 'templates.hotlinkHandler(div, item, el, {type: \'albumArtist\', handler: \'albumartist\'})',
    combinedAlbum: 'new Function(\'div\', \'item\', \'el\', "' +
        ' if (!el.albumSpan) { el.albumSpan = document.createElement(\'span\'); el.appendChild(el.albumSpan); } ' +
        ' templates.hotlinkHandler(div, item, el.albumSpan, {type: \'album\', secType: \'title\'}); ' +
        ' if (!el.artistSpan) { el.artistSpan = document.createElement(\'span\'); el.appendChild(el.artistSpan); } ' +
        ' templates.hotlinkHandler(div, item, el.artistSpan, {type: \'albumArtist\', handler: \'artist\', addBefore: \' (\', addAfter: \')\'}); ' +
        ' ")(div, item, el)',
};
window.albumHyperlinks = albumHyperlinks;
let artworkLoaders = {
    nowPlaying: `if (item) {
            templates.itemImageFunc(div, item, div.itemIndex, {
                isAutoSearch: true,
                imgSearchFunc: searchTools.getAAImage,
                saveImageFunc: templates.saveImageToTrack,
                defaultPixelSize: 500,
                minPixelSize: 500,
                updateWhenChanged: true,
                noAAShowDelay: 400,
                canReturnAlbumArtwork: (!item.isVideo)
            })
        } else {
            setVisibilityFast(div.artworkImg, false);
            setVisibilityFast(div.noaa, true);
        }`
};
window.artworkLoaders = artworkLoaders;
