/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

registerFileImport('controls/trackListView');
'use strict';
/**
@module UI
*/
import Control from './control';
import GridView from './gridview';
import './statusbar';
import '../actions';
let defaultColWidth = 100;
let utils = app.utils;
let Custom1Title = _('Custom 1');
let Custom2Title = _('Custom 2');
let Custom3Title = _('Custom 3');
let Custom4Title = _('Custom 4');
let Custom5Title = _('Custom 5');
let Custom6Title = _('Custom 6');
let Custom7Title = _('Custom 7');
let Custom8Title = _('Custom 8');
let Custom9Title = _('Custom 9');
let Custom10Title = _('Custom 10');
let paddingColumnSmallRight = undefined;
let paddingColumnSmallLeft = undefined;
if (typeof (String.prototype.localeCompare) === 'undefined') {
    // @ts-ignore
    String.prototype.localeCompare = function (str, locale, options) {
        return ((this == str) ? 0 : ((this > str) ? 1 : -1));
    };
}
// Other group is default
window.uitools.tracklistFieldGroups = [
    {
        group: _('Audio'),
        fields: ['album', 'albumArtist', 'albumArt', 'artist', 'author', 'bpm', 'comment', 'composer', 'conductor', 'copyright', 'encoder', 'genre', 'grouping', 'initialKey', 'involvedPeople', 'isrc', 'lyricist', 'lyrics',
            'origArtist', 'origLyricist', 'origAlbumTitle', 'origDate', 'producer', 'publisher', 'podcast', 'rating', 'order', 'discNo', 'title', 'normalize', 'normalizeAlbum', 'date',
            {
                group: _('Classification'),
                fields: ['occasion', 'mood', 'tempo', 'quality']
            }]
    },
    {
        group: _('Video'),
        fields: ['actors', 'director', 'comment', 'copyright', 'encoder', 'episode', 'season', 'genre', 'origAlbumTitle', 'origDate', 'producer', 'publisher', 'parentalRating', 'rating', 'series', 'screenwriter', 'title', 'date']
    },
    {
        group: _('Custom'),
        fields: ['custom1', 'custom2', 'custom3', 'custom4', 'custom5', 'custom6', 'custom7', 'custom8', 'custom9', 'custom10', 'summary', 'extendedTags']
    },
    {
        group: _('Properties'),
        fields: ['dateAdded', 'bps', 'bitrate', 'stereo', 'filesize', 'fileType', 'filename', 'folder', 'framerate', 'length', 'media', 'path', 'organizedPath', 'dimensions', 'sampleRate', 'source', 'timeStamp', 'trackType']
    },
    {
        group: _('Play History'),
        fields: ['lastPlayed', 'playCounter', 'skipped', 'lastSkipped']
    },
    {
        group: _('Groups'),
        fields: ['group_artwork', 'group_album'],
    }
];
/**
 * List of all tracklist field types, their titles, and relevant attributes such as data-binding functions and editor parameters.
 * @for uitools
 * @property tracklistFieldDefs
 * @type object
 */
export const tracklistFieldDefs = {
    playOrder: {
        title: '#',
        disabled: function (usedLV) {
            let currentListView = usedLV || window.lastFocusedControl;
            if (!currentListView || !currentListView.controlClass) {
                return true;
            }
            if (currentListView.controlClass.orderColumnSupport)
                return false; // #19569
            let pV = currentListView.controlClass.parentView;
            if (!pV)
                return true;
            let handler = getNodeHandler(pV);
            return !handler.orderColumnSupport;
        },
        checked: function () {
            let currentListView = window.lastFocusedControl;
            if (!currentListView || !currentListView.controlClass) {
                return false;
            }
            let pV = currentListView.controlClass.parentView;
            if (!pV)
                return false;
            let handler = getNodeHandler(pV);
            return handler.orderColumnSupport;
        },
        bindData: function (div, item) {
            div.textContent = item.playlistSongOrder + 1;
        },
        getValue: function (item) {
            return item.playlistSongOrder + 1;
        },
        width: 50,
        // fixed: true, // originally 'fixed column' per #20309, but then reverted becuase of #20573 and #20992
        adaptableSize: false,
        notForAlbum: true // this field should not be used for whole album, specific for each track
    },
    title: {
        title: _('Title'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            if (_utils.isOnlineTrack(item)) {
                if (!div._youtubeIcon || !div._youtubeTitle) {
                    div.textContent = '';
                    div._youtubeTitle = document.createElement('div');
                    div.classList.add('flex');
                    div.classList.add('row');
                    div._youtubeTitle.classList.add('textEllipsis');
                    div._youtubeTitle.classList.add('fill');
                    div.appendChild(div._youtubeTitle);
                    div._youtubeIcon = document.createElement('div');
                    templates.setYoutubeIconDiv(div._youtubeIcon);
                    div.appendChild(div._youtubeIcon);
                    /* div._youtubeIcon.classList.add('icon');
                    div.appendChild(div._youtubeIcon);
                    loadIcon('youtube', function (iconData) {
                        if (div._youtubeIcon) {
                            div._youtubeIcon.innerHTML = iconData;
                            div._youtubeIcon.setAttribute('data-tip', 'YouTube');
                        }
                    });*/
                    templates.addEllipsisTooltip(div._youtubeTitle, div);
                }
                div._youtubeTitle.textContent = item.title;
            }
            else {
                div.textContent = item.title;
                div._youtubeIcon = undefined;
                div._youtubeTitle = undefined;
            }
        },
        getValue: function (item) {
            return item.title;
        },
        setValue: function (item, newValue) {
            return checkAndUpdateValue(item, 'title', newValue);
        },
        editor: editors.gridViewEditors.textEdit,
        width: 200,
        minWidth: '1em',
        mask: 'S',
        notForAlbum: true, // this field should not be used for whole album, specific for each track
        /* moved to 'showLinks' addon in SampleScripts folder (#16884)
        shortcutFunc: function (item, shortcutID) {
            handleShortcut(shortcutID, 'title', 'title', item);
        } */
    },
    artist: {
        title: _('Artist'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = utils.multiString2VisualString(item.artist);
        },
        getValue: function (item) {
            return utils.multiString2VisualString(item.artist);
        },
        setValue: function (item, newValue) {
            return checkAndUpdateValue(item, 'artist', newValue);
        },
        editor: editors.gridViewEditors.multiValueEdit,
        editorParams: '{dbFunc:"getPeople", dbFuncParams: {category: "artist"}}',
        width: 100,
        minWidth: '1em',
        mask: 'A',
        notForAlbum: true, // this field should not be used for whole album, specific for each track
        /* moved to 'showLinks' addon in SampleScripts folder (#16884)
        shortcutFunc: function (item, shortcutID) {
            handleShortcut(shortcutID, 'artist', 'artist', item);
        }*/
    },
    album: {
        title: _('Album'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = item.album;
        },
        getValue: function (item) {
            return item.album;
        },
        setValue: function (item, newValue) {
            return checkAndUpdateValue(item, 'album', newValue);
        },
        editor: editors.gridViewEditors.textDropdownEdit,
        editorParams: '{dbFunc:"getStringList", dbFuncParams: {category: "album"}}',
        width: 200,
        minWidth: '1em',
        mask: 'L',
        alias: ['series', 'podcast'],
        /* moved to 'showLinks' addon in SampleScripts folder (#16884)
        shortcutFunc: function (item, shortcutID) {
            handleShortcut(shortcutID, 'album', 'album', item);
        }*/
    },
    filename: {
        title: _('Filename'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = item.filename;
        },
        getValue: function (item) {
            return item.filename;
        },
        setValue: function (item, newValue) {
            let newPath = utils.getDirectory(item.path) + newValue;
            uitools.changePath(item, newPath);
            return true; // dontSave -- to not call afterSave in editors.js (as uitools.changePath above takes care of the DB updates #19518)
        },
        editor: editors.gridViewEditors.textEdit,
        width: defaultColWidth,
        mask: 'F',
        notForAlbum: true, // this field should not be used for whole album, specific for each track
    },
    folder: {
        title: _('Folder'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = removeLastSlash(getFileFolder(item.path));
        },
        getValue: function (item) {
            return removeLastSlash(getFileFolder(item.path));
        },
        width: defaultColWidth,
        mask: 'P'
    },
    length: {
        title: _('Length'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            templates.bookmarkFunc(div.parentElement, item, div); // #18030
        },
        getValue: function (item, raw) {
            if (raw)
                return item.songLength;
            else {
                return getFormatedTime(item.playLength);
            }
        },
        align: 'right',
        usesRaw: true,
        width: 80,
        mask: 'H',
        notForAlbum: true, // this field should not be used for whole album, specific for each track
    },
    date: {
        title: _('Date'),
        disabled: false,
        checked: false,
        bindFunc: function (div, item) {
            div.textContent = utils.myEncodeDate(item.date);
        },
        getValue: function (item, raw) {
            if (raw)
                return item.date;
            else
                return utils.myEncodeDate(item.date);
        },
        setValue: function (item, newValue, raw) {
            if (raw)
                return checkAndUpdateValue(item, 'date', newValue);
            else
                return checkAndUpdateValue(item, 'date', utils.myDecodeDate(newValue));
        },
        editor: editors.gridViewEditors.dateEdit,
        align: 'right',
        width: 50,
        direction: 'DESC',
        mask: 'ZP'
    },
    /*    year: { // removed, #15764
            title: _('Year'),
            disabled: false,
            checked: false,
            bindFunc: function (div, item) {
                div.textContent = utils.myEncodeDate(item.year);
                },
                getValue: function (item, raw) {
                    if (raw) {
                        if (item.year > 0)
                            return item.year;
                        else
                            return undefined;
                    } else
                        return utils.myEncodeDate(item.year);
                },
                setValue: function (item, newValue, raw) {
                    if (newValue <= 0)
                        newValue = -1;
                    return checkAndUpdateValue(item, 'year', newValue);
                },
                editor: editors.gridViewEditors.numberEdit,
                align: 'right',
                width: 50,
                direction: 'DESC',
                mask: 'Y'
            },*/
    genre: {
        title: _('Genre'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = utils.multiString2VisualString(item.genre);
        },
        getValue: function (item) {
            return utils.multiString2VisualString(item.genre);
        },
        setValue: function (item, newValue) {
            return checkAndUpdateValue(item, 'genre', newValue);
        },
        editor: editors.gridViewEditors.multiValueEdit,
        editorParams: '{dbFunc:"getStringList", dbFuncParams: {category: "genre"}}',
        width: defaultColWidth,
        mask: 'G'
    },
    playCounter: {
        title: _('Played #'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = item.playCounter;
        },
        getValue: function (item) {
            return item.playCounter;
        },
        setValue: function (item, newValue) {
            let res = checkAndUpdateValue(item, 'playCounter', newValue);
            if (!res) {
                if (newValue == 0)
                    item.lastTimePlayed = -1;
                else
                    item.lastTimePlayed = app.utils.now();
                app.utils.addToPlayedAsync(item);
            }
            return res;
        },
        isNumber: true,
        editor: editors.gridViewEditors.numberEdit,
        align: 'right',
        width: defaultColWidth,
        direction: 'DESC',
        mask: 'ZZJ',
        notForAlbum: true, // this field should not be used for whole album, specific for each track
    },
    lastPlayed: {
        title: _('Last Played'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = utils.myFormatDateTime(item.lastTimePlayed);
        },
        getValue: function (item) {
            return utils.myFormatDateTime(item.lastTimePlayed);
        },
        align: 'right',
        direction: 'DESC',
        width: defaultColWidth,
        mask: 'ZZK',
        notForAlbum: true, // this field should not be used for whole album, specific for each track
    },
    lastSkipped: {
        title: _('Last Skipped'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = utils.myFormatDateTime(item.lastTimeSkipped);
        },
        getValue: function (item) {
            return utils.myFormatDateTime(item.lastTimeSkipped);
        },
        align: 'right',
        direction: 'DESC',
        width: defaultColWidth,
        notForAlbum: true, // this field should not be used for whole album, specific for each track
    },
    rating: {
        title: _('Rating'),
        disabled: false,
        checked: false,
        editor: editors.gridViewEditors.rating,
        bindData: function (div, item) {
            if (paddingColumnSmallRight === undefined) {
                paddingColumnSmallRight = getStyleRuleValue('padding-right', '.paddingColumnSmall');
            }
            if (paddingColumnSmallLeft === undefined) {
                paddingColumnSmallLeft = getStyleRuleValue('padding-left', '.paddingColumnSmall');
            }
            templates.ratingEditableFunc(div.parentElement, item, div, {
                noZeroWidth: true,
                paddingLeft: paddingColumnSmallLeft,
                paddingRight: paddingColumnSmallRight,
            });
        },
        getValue: function (item) {
            return item.rating;
        },
        setValue: function (item, newValue) {
            return checkAndUpdateValue(item, 'rating', newValue);
        },
        isNumber: true,
        width: 100,
        direction: 'DESC',
        adaptableSize: false,
        headerRenderer: function (div, column) {
            div.innerText = resolveToValue(column.title, '');
        },
        mask: 'ZR'
    },
    bitrate: {
        title: _('Bitrate'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = this.getValue(item);
        },
        getValue: function (item, raw) {
            let bitrate = item.bitrate;
            if (raw)
                return bitrate;
            if (bitrate >= 0)
                return Math.round(bitrate / 1000);
            else
                return '';
        },
        isNumber: true,
        usesRaw: true,
        align: 'right',
        width: 60,
        mask: 'B',
        notForAlbum: true, // this field should not be used for whole album, specific for each track
    },
    media: {
        title: _('Media'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = item.mediaLabel;
        },
        getValue: function (item) {
            return item.mediaLabel;
        },
        width: defaultColWidth,
        mask: 'ZZM'
    },
    custom1: {
        title: function () {
            return Custom1Title;
        },
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = item.custom1;
        },
        getValue: function (item) {
            return item.custom1;
        },
        setValue: function (item, newValue) {
            return checkAndUpdateValue(item, 'custom1', newValue);
        },
        editor: editors.gridViewEditors.textEdit,
        width: defaultColWidth,
        mask: 'U'
    },
    custom2: {
        title: function () {
            return Custom2Title;
        },
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = item.custom2;
        },
        getValue: function (item) {
            return item.custom2;
        },
        setValue: function (item, newValue) {
            return checkAndUpdateValue(item, 'custom2', newValue);
        },
        editor: editors.gridViewEditors.textEdit,
        width: defaultColWidth,
        mask: 'V'
    },
    custom3: {
        title: function () {
            return Custom3Title;
        },
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = item.custom3;
        },
        getValue: function (item) {
            return item.custom3;
        },
        setValue: function (item, newValue) {
            return checkAndUpdateValue(item, 'custom3', newValue);
        },
        editor: editors.gridViewEditors.textEdit,
        width: defaultColWidth,
        mask: 'W'
    },
    custom4: {
        title: function () {
            return Custom4Title;
        },
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = item.custom4;
        },
        getValue: function (item) {
            return item.custom4;
        },
        setValue: function (item, newValue) {
            return checkAndUpdateValue(item, 'custom4', newValue);
        },
        editor: editors.gridViewEditors.textEdit,
        width: defaultColWidth,
        mask: 'J'
    },
    custom5: {
        title: function () {
            return Custom5Title;
        },
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = item.custom5;
        },
        getValue: function (item) {
            return item.custom5;
        },
        setValue: function (item, newValue) {
            return checkAndUpdateValue(item, 'custom5', newValue);
        },
        editor: editors.gridViewEditors.textEdit,
        width: defaultColWidth,
        mask: 'K'
    },
    custom6: {
        title: function () {
            return Custom6Title;
        },
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = item.custom6;
        },
        getValue: function (item) {
            return item.custom6;
        },
        setValue: function (item, newValue) {
            return checkAndUpdateValue(item, 'custom6', newValue);
        },
        editor: editors.gridViewEditors.textEdit,
        width: defaultColWidth,
        mask: 'ZZ0'
    },
    custom7: {
        title: function () {
            return Custom7Title;
        },
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = item.custom7;
        },
        getValue: function (item) {
            return item.custom7;
        },
        setValue: function (item, newValue) {
            return checkAndUpdateValue(item, 'custom7', newValue);
        },
        editor: editors.gridViewEditors.textEdit,
        width: defaultColWidth,
        mask: 'ZZ1'
    },
    custom8: {
        title: function () {
            return Custom8Title;
        },
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = item.custom8;
        },
        getValue: function (item) {
            return item.custom8;
        },
        setValue: function (item, newValue) {
            return checkAndUpdateValue(item, 'custom8', newValue);
        },
        editor: editors.gridViewEditors.textEdit,
        width: defaultColWidth,
        mask: 'ZZ2'
    },
    custom9: {
        title: function () {
            return Custom9Title;
        },
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = item.custom9;
        },
        getValue: function (item) {
            return item.custom9;
        },
        setValue: function (item, newValue) {
            return checkAndUpdateValue(item, 'custom9', newValue);
        },
        editor: editors.gridViewEditors.textEdit,
        width: defaultColWidth,
        mask: 'ZZ3'
    },
    custom10: {
        title: function () {
            return Custom10Title;
        },
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = item.custom10;
        },
        getValue: function (item) {
            return item.custom10;
        },
        setValue: function (item, newValue) {
            return checkAndUpdateValue(item, 'custom10', newValue);
        },
        editor: editors.gridViewEditors.textEdit,
        width: defaultColWidth,
        mask: 'ZZ4'
    },
    extendedTags: {
        title: function () {
            return _('Extended tags');
        },
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            let txt = item.extendedTagsShort;
            div.tooltipValueCallback = undefined;
            div.textContent = getSimplifiedExtendedTags(txt);
            let tipTxt = getSimplifiedExtendedTags(txt, '\n');
            if (tipTxt) {
                div.setAttribute('data-tip', tipTxt);
            }
            else
                div.removeAttribute('data-tip');
        },
        getValue: function (item) {
            let txt = '';
            if (item.extendedTagsShort) {
                txt = getSimplifiedExtendedTags(item.extendedTagsShort);
            }
            return txt;
        },
        width: defaultColWidth,
        notForAlbum: true, // this field should not be used for whole album, specific for each track
    },
    filesize: {
        title: _('Filesize'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = formatFileSize(item.fileLength);
        },
        getValue: function (item) {
            return item.fileLength;
        },
        isNumber: true,
        align: 'right',
        width: defaultColWidth,
        mask: 'ZZL',
        notForAlbum: true, // this field should not be used for whole album, specific for each track
    },
    bpm: {
        title: _('BPM'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = (item.bpm > 0) ? (item.bpm) : '';
        },
        align: 'right',
        getValue: function (item) {
            return item.bpm;
        },
        setValue: function (item, newValue) {
            if (newValue <= 0)
                newValue = -1;
            return checkAndUpdateValue(item, 'bpm', newValue);
        },
        editor: editors.gridViewEditors.numberEdit,
        width: defaultColWidth,
        mask: 'M'
    },
    sampleRate: {
        title: _('Sample rate'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = utils.freqToStr(item.frequency);
        },
        getValue: function (item) {
            if (item.frequency <= 0)
                return '';
            else
                return item.frequency;
        },
        isNumber: true,
        align: 'right',
        width: defaultColWidth,
        mask: 'ZZD'
    },
    stereo: {
        title: _('Channels'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = utils.stereoToStr(item.stereo);
        },
        getValue: function (item) {
            if (item.stereo < 0)
                return '';
            else
                return (item.stereo + 1);
        },
        isNumber: true,
        width: defaultColWidth,
        mask: 'ZZN'
    },
    bps: {
        title: _('Bit depth'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = this.getValue(item);
        },
        getValue: function (item) {
            if (item.bps > 0)
                return item.bps;
            else
                return '';
        },
        isNumber: true,
        align: 'right',
        width: defaultColWidth,
        mask: 'ZZO'
    },
    normalize: {
        title: _('Track volume'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = utils.formatNormalization(item.normalizeTrack);
        },
        getValue: function (item) {
            if (Math.abs(item.normalizeTrack) < 100)
                return item.normalizeTrack + utils.normalizationDiff(); // to show full value like 6.245689785 (and not '6.25 dB' via utils.formatNormalization)
            else
                return utils.formatNormalization(item.normalizeTrack);
        },
        setValue: function (item, newValue) {
            if (newValue == '')
                newValue = app.utils.getConst('NORMALIZE_TRACK_NULL_VALUE');
            let c = parseFloat(newValue);
            if (!isNaN(c))
                return checkAndUpdateValue(item, 'normalizeTrack', c - utils.normalizationDiff());
        },
        isNumber: true,
        editor: editors.gridViewEditors.textEdit,
        align: 'right',
        width: 50,
        mask: 'ZZP',
        notForAlbum: true, // this field should not be used for whole album, specific for each track
    },
    albumArtist: {
        title: _('Album Artist'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = utils.multiString2VisualString(item.albumArtist);
        },
        getValue: function (item) {
            return utils.multiString2VisualString(item.albumArtist);
        },
        setValue: function (item, newValue) {
            return checkAndUpdateValue(item, 'albumArtist', newValue);
        },
        editor: editors.gridViewEditors.multiValueEdit,
        editorParams: '{dbFunc:"getPeople", dbFuncParams: {category: "artist"}}',
        width: 100,
        mask: 'R'
        /* moved to 'showLinks' addon in SampleScripts folder (#16884)
        shortcutFunc: function (item, shortcutID) {
            handleShortcut(shortcutID, 'albumArtist', 'albumArtist', item);
        }*/
    },
    source: {
        title: _('Source'),
        disabled: false,
        checked: false,
        setupCell: function (div, column) {
            GridView.prototype.cellSetups.setupBase(div, column);
            div.style.alignSelf = 'center';
        },
        bindData: function (div, item) {
            let track_id = item.id;
            let location_info = item.path;
            div.tooltipValueCallback = function (tipdiv, vis) {
                if (!vis)
                    return;
                let devices = app.devices.getForTrackId(track_id);
                devices.whenLoaded().then(() => {
                    let info = location_info;
                    fastForEach(devices, (device) => {
                        if (info != '')
                            info = info + '</br>';
                        info = info + escapeXml(device.name);
                    });
                    tipdiv.innerHTML = info;
                });
            };
            let icons = _utils.getFileSourceIcons(item);
            templates.itemDoubleIconFunc(div, item, icons[0], icons[1]);
        },
        getValue: function (item) {
            let icons = _utils.getFileSourceIcons(item);
            if (!icons)
                return '';
            else
                return icons.join('; ');
        },
        width: 75,
        minWidth: '1.5em',
        mask: 'ZZI'
    },
    path: {
        title: _('Path'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            if (div.organizedPathColumnSupported)
                div.innerHTML = window.uitools.highlightDiffs(item.path, item.organizedPath);
            else
                div.textContent = this.getValue(item);
        },
        getValue: function (item) {
            if (item.path.startsWith('uuid://'))
                return app.utils.web.transformPathUUID2URL_Sync(item.path);
            else if (item.cacheStatus == cloudTools.CACHE_STREAMED)
                return cloudTools.getRemotePath(item);
            else
                return item.path;
        },
        setValue: function (item, newValue) {
            let newPath = newValue;
            if (_utils.isTrackWithEditablePath(item))
                uitools.changePath(item, newPath);
            return true; // dontSave -- to not call afterSave in editors.js (as uitools.changePath above takes care of the DB updates #19518)
        },
        editable: function (item) {
            return _utils.isTrackWithEditablePath(item);
        },
        editor: editors.gridViewEditors.textEdit,
        width: 400,
        notForAlbum: true, // this field should not be used for whole album, specific for each track
    },
    organizedPath: {
        title: _('Recommended path'),
        disabled: function (usedLV) {
            let currentListView = usedLV || window.lastFocusedControl;
            if (!currentListView || !currentListView.controlClass) {
                return true;
            }
            let pV = currentListView.controlClass.parentView;
            if (!pV)
                return true;
            let handler = getNodeHandler(pV);
            return !handler.organizedPathColumnSupported;
        },
        checked: false,
        bindData: function (div, item) {
            div.textContent = item.organizedPath;
        },
        getValue: function (item) {
            return item.organizedPath;
        },
        width: 400,
        noExport: true,
        notForAlbum: true, // this field should not be used for whole album, specific for each track
    },
    fileType: {
        title: _('Extension'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = item.fileType;
        },
        getValue: function (item) {
            return item.fileType;
        },
        width: 50,
        mask: 'E'
    },
    timeStamp: {
        title: _('Timestamp'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = utils.myFormatDateTime(item.fileModified);
        },
        getValue: function (item) {
            return utils.myFormatDateTime(item.fileModified);
        },
        align: 'right',
        width: 80,
        mask: 'ZZR',
        notForAlbum: true, // this field should not be used for whole album, specific for each track
    },
    dateAdded: {
        title: _('Added'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = utils.myFormatDateTime(item.dateAdded);
        },
        getValue: function (item) {
            return utils.myFormatDateTime(item.dateAdded);
        },
        align: 'right',
        width: 80,
        mask: 'ZT',
    },
    composer: {
        title: _('Composer'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = utils.multiString2VisualString(item.composer);
        },
        getValue: function (item) {
            return utils.multiString2VisualString(item.composer);
        },
        setValue: function (item, newValue) {
            return checkAndUpdateValue(item, 'composer', newValue);
        },
        editor: editors.gridViewEditors.multiValueEdit,
        editorParams: '{dbFunc:"getPeople", dbFuncParams: {category: "author"}}',
        width: 100,
        mask: 'C'
    },
    origDate: {
        title: _('Original Date'),
        disabled: false,
        checked: false,
        bindFunc: function (div, item) {
            div.textContent = utils.myEncodeDate(item.origDate);
        },
        getValue: function (item, raw) {
            if (raw)
                return item.origDate;
            else
                return utils.myEncodeDate(item.origDate);
        },
        setValue: function (item, newValue, raw) {
            if (raw)
                return checkAndUpdateValue(item, 'origDate', newValue);
            else
                return checkAndUpdateValue(item, 'origDate', utils.myDecodeDate(newValue));
        },
        editor: editors.gridViewEditors.dateEdit,
        align: 'right',
        width: 80,
        mask: 'ZS'
    },
    tempo: {
        title: _('Tempo'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = utils.multiString2VisualString(item.tempo);
        },
        getValue: function (item) {
            return utils.multiString2VisualString(item.tempo);
        },
        setValue: function (item, newValue) {
            return checkAndUpdateValue(item, 'tempo', newValue);
        },
        editor: editors.gridViewEditors.multiValueEdit,
        editorParams: '{dbFunc:"getStringList", dbFuncParams: {category: "tempo"}}',
        width: defaultColWidth,
        mask: 'ZC'
    },
    mood: {
        title: _('Mood'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = utils.multiString2VisualString(item.mood);
        },
        getValue: function (item) {
            return utils.multiString2VisualString(item.mood);
        },
        setValue: function (item, newValue) {
            return checkAndUpdateValue(item, 'mood', newValue);
        },
        editor: editors.gridViewEditors.multiValueEdit,
        editorParams: '{dbFunc:"getStringList", dbFuncParams: {category: "mood"}}',
        width: defaultColWidth,
        mask: 'ZA'
    },
    occasion: {
        title: _('Occasion'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = utils.multiString2VisualString(item.occasion);
        },
        getValue: function (item) {
            return utils.multiString2VisualString(item.occasion);
        },
        setValue: function (item, newValue) {
            return checkAndUpdateValue(item, 'occasion', newValue);
        },
        editor: editors.gridViewEditors.multiValueEdit,
        editorParams: '{dbFunc:"getStringList", dbFuncParams: {category: "occasion"}}',
        width: defaultColWidth,
        mask: 'ZB'
    },
    quality: {
        title: _('Quality'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = utils.multiString2VisualString(item.quality);
        },
        getValue: function (item) {
            return utils.multiString2VisualString(item.quality);
        },
        setValue: function (item, newValue) {
            return checkAndUpdateValue(item, 'quality', newValue);
        },
        editor: editors.gridViewEditors.multiValueEdit,
        editorParams: '{dbFunc:"getStringList", dbFuncParams: {category: "quality"}}',
        width: defaultColWidth,
        mask: 'ZL'
    },
    comment: {
        title: _('Comment'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = item.commentShort;
        },
        getValue: function (item) {
            return item.commentShort;
        },
        getValueAsync: function (item) {
            return item.getCommentAsync();
        },
        setValue: function (item, newValue) {
            if (item.commentShort !== newValue) {
                item.setCommentAsync(newValue).then(function () {
                    if (item.commitAsync)
                        item.commitAsync({
                            forceSaveToDB: true
                        });
                });
            }
            return true; // dont save sync, it will be saved async
        },
        editor: editors.gridViewEditors.multiLineEdit,
        width: defaultColWidth,
    },
    lyrics: {
        title: _('Lyrics'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            let lyricsShort = item.lyricsShort;
            if (lyricsShort.startsWith('uuid://')) {
                // this is DLNA link to lyrics file, load it
                div.textContent = _('Loading') + '...';
                item.getLyricsAsync().then(() => {
                    div.textContent = item.lyricsShort;
                });
            }
            else
                div.textContent = lyricsShort;
        },
        getValue: function (item) {
            return item.lyricsShort;
        },
        getValueAsync: function (item) {
            return item.getLyricsAsync();
        },
        setValue: function (item, newValue) {
            if (item.lyricsShort !== newValue) {
                item.setLyricsAsync(newValue).then(function () {
                    if (item.commitAsync)
                        item.commitAsync({
                            forceSaveToDB: true
                        });
                });
            }
            return true; // dont save sync, it will be saved async
        },
        editor: editors.gridViewEditors.multiLineEdit,
        width: defaultColWidth,
        notForAlbum: true, // this field should not be used for whole album, specific for each track
    },
    normalizeAlbum: {
        title: _('Album volume'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = utils.formatNormalization(item.normalizeAlbum);
        },
        getValue: function (item) {
            if (Math.abs(item.normalizeAlbum) < 100)
                return item.normalizeAlbum + utils.normalizationDiff(); // to show full value like 6.245689785 (and not '6.25 dB' via utils.formatNormalization)
            else
                return utils.formatNormalization(item.normalizeAlbum);
        },
        setValue: function (item, newValue) {
            if (newValue == '')
                newValue = app.utils.getConst('NORMALIZE_TRACK_NULL_VALUE');
            let c = parseFloat(newValue);
            if (!isNaN(c))
                return checkAndUpdateValue(item, 'normalizeAlbum', c - utils.normalizationDiff());
        },
        editor: editors.gridViewEditors.textEdit,
        align: 'right',
        width: 50,
        mask: 'ZZQ'
    },
    conductor: {
        title: _('Conductor'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = utils.multiString2VisualString(item.conductor);
        },
        getValue: function (item) {
            return utils.multiString2VisualString(item.conductor);
        },
        setValue: function (item, newValue) {
            return checkAndUpdateValue(item, 'conductor', newValue);
        },
        editor: editors.gridViewEditors.multiValueEdit,
        editorParams: '{dbFunc:"getPeople", dbFuncParams: {category: "conductor"}}',
        width: defaultColWidth,
        mask: 'ZN'
    },
    discNo: {
        title: _('Disc #'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = item.discNumber;
        },
        getValue: function (item) {
            return item.discNumber;
        },
        setValue: function (item, newValue) {
            return checkAndUpdateValue(item, 'discNumber', newValue);
        },
        editor: editors.gridViewEditors.textEdit,
        align: 'right',
        width: 50,
        mask: 'ZM',
        notForAlbum: true, // this field should not be used for whole album, specific for each track
    },
    involvedPeople: {
        title: _('Involved people'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = item.involvedPeople;
        },
        getValue: function (item) {
            return item.involvedPeople;
        },
        setValue: function (item, newValue) {
            return checkAndUpdateValue(item, 'involvedPeople', newValue);
        },
        editor: editors.gridViewEditors.textEdit,
        width: defaultColWidth,
        mask: 'ZZF'
    },
    origArtist: {
        title: _('Original Artist'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = utils.multiString2VisualString(item.origArtist);
        },
        getValue: function (item) {
            return utils.multiString2VisualString(item.origArtist);
        },
        setValue: function (item, newValue) {
            return checkAndUpdateValue(item, 'origArtist', newValue);
        },
        editor: editors.gridViewEditors.multiValueEdit,
        editorParams: '{dbFunc:"getPeople", dbFuncParams: {category: "artist"}}',
        width: defaultColWidth,
        mask: 'ZH'
    },
    origAlbumTitle: {
        title: _('Original Album'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = item.origTitle;
        },
        getValue: function (item) {
            return item.origTitle;
        },
        setValue: function (item, newValue) {
            return checkAndUpdateValue(item, 'origTitle', newValue);
        },
        editor: editors.gridViewEditors.textEdit,
        width: defaultColWidth,
        mask: 'ZJ'
    },
    origLyricist: {
        title: _('Original Lyricist'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = utils.multiString2VisualString(item.origLyricist);
        },
        getValue: function (item) {
            return utils.multiString2VisualString(item.origLyricist);
        },
        setValue: function (item, newValue) {
            return checkAndUpdateValue(item, 'origLyricist', newValue);
        },
        editor: editors.gridViewEditors.multiValueEdit,
        editorParams: '{dbFunc:"getPeople", dbFuncParams: {category: "lyricist"}}',
        width: defaultColWidth,
        mask: 'ZI'
    },
    lyricist: {
        title: _('Lyricist'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = utils.multiString2VisualString(item.lyricist);
        },
        getValue: function (item) {
            return utils.multiString2VisualString(item.lyricist);
        },
        setValue: function (item, newValue) {
            return checkAndUpdateValue(item, 'lyricist', newValue);
        },
        editor: editors.gridViewEditors.multiValueEdit,
        editorParams: '{dbFunc:"getPeople", dbFuncParams: {category: "lyricist"}}',
        width: defaultColWidth,
        mask: 'ZG'
    },
    grouping: {
        title: _('Grouping'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = item.groupDesc;
        },
        getValue: function (item) {
            return item.groupDesc;
        },
        setValue: function (item, newValue) {
            return checkAndUpdateValue(item, 'groupDesc', newValue);
        },
        editor: editors.gridViewEditors.textEdit,
        width: defaultColWidth,
        mask: 'ZO'
    },
    albumArt: {
        title: _('Artwork'),
        disabled: function (usedLV) {
            if (usedLV && usedLV.controlClass)
                return usedLV.controlClass.isGroupedView;
            return false;
        },
        checked: false,
        setupCell: function (div, column) {
            GridView.prototype.cellSetups.setupBase(div, column);
            div.setAttribute('artworkHolder', '1');
        },
        bindData: function (div, item, itemIndex) {
            if (div.loadingPromise) {
                cancelPromise(div.loadingPromise);
            }
            let removeImg = function () {
                if (div.thumbImg) {
                    setVisibilityFast(div.thumbImg, false);
                    div.thumbImg.src = ''; // needed, otherwise load event is not called sometimes
                    div.thumbImg.removeAttribute('data-tip');
                }
            };
            let showThumb = function (path) {
                if ((div.loadingPromise && div.loadingPromise.canceled) || (window._cleanUpCalled)) {
                    return;
                }
                div.loadingPromise = undefined;
                if (div.itemIndex === itemIndex) {
                    if (path !== '' && path !== '-') {
                        if (!div.thumbImg) {
                            div.thumbImg = document.createElement('img');
                            div.thumbImg.classList.add('allinside');
                            div.thumbImg.classList.add('autosize');
                            let sd = undefined;
                            let imgpath;
                            let fullsize = 200;
                            div.thumbImg.tooltipValueCallback = function (tipdiv, vis) {
                                if (!vis || !div.parentListView || !div.parentListView.dataSource) {
                                    return;
                                }
                                tipdiv.innerHTML = div.thumbImg.getAttribute('data-defaulttip');
                                let showFullImg = function (p, cached) {
                                    if (tipdiv.itemIndex !== div.itemIndex)
                                        return;
                                    tipdiv.innerHTML = '<img src="' + p + '">';
                                    if (window.tooltipDiv && window.tooltipDiv.controlClass) // @ts-ignore
                                        window.tooltipDiv.controlClass.notifyContentChange();
                                };
                                let lv = div.parentListView;
                                tipdiv.itemIndex = div.itemIndex;
                                lv.dataSource.locked(function () {
                                    sd = lv.dataSource.getFastObject(div.itemIndex, sd);
                                    if (sd) {
                                        if (sd.getCachedThumb)
                                            imgpath = sd.getCachedThumb(fullsize, fullsize);
                                        if (imgpath === '' && sd.getThumbAsync) {
                                            sd.getThumbAsync(fullsize, fullsize, showFullImg);
                                        }
                                        else if (imgpath !== '-')
                                            showFullImg(imgpath, true);
                                    }
                                });
                            };
                            div.appendChild(div.thumbImg);
                        }
                        div.thumbImg.src = path;
                        if (getDocumentBody().contains(div.thumbImg)) {
                            setVisibility(div.thumbImg, true, {
                                animate: false,
                                layoutchange: false
                            });
                        }
                        div.thumbImg.setAttribute('data-defaulttip', '<img src="' + path + '">');
                    }
                    else
                        removeImg();
                }
            };
            let path = '';
            let pixelSize = 40;
            if (item.getCachedThumb)
                path = item.getCachedThumb(pixelSize, pixelSize);
            if (path === '' && item.getThumbAsync) {
                if (div.thumbImg)
                    removeImg();
                let cancelToken = item.getThumbAsync(pixelSize, pixelSize, showThumb);
                div.loadingPromise = {
                    cancel: function () {
                        app.cancelLoaderToken(cancelToken);
                    }
                };
            }
            else {
                if (path === '-') {
                    removeImg();
                }
                else {
                    div.loadingPromise = undefined;
                    showThumb(path);
                }
            }
            if (!div._context) {
                div._context = div.parentListView.localListen(div, 'contextmenu', function (e) {
                    let allitems = [{
                            action: {
                                title: actions.coverLookup.title,
                                icon: actions.coverLookup.icon,
                                item: function () {
                                    let item;
                                    let lv = div.parentListView;
                                    lv.dataSource.locked(function () {
                                        item = lv.dataSource.getValue(div.itemIndex);
                                    });
                                    return item;
                                },
                                visible: function () {
                                    return true;
                                },
                                execute: function () {
                                    let item = this.item();
                                    let origItem = app.utils.createTracklist(true);
                                    origItem.add(item);
                                    searchTools.searchAAImageDlg(origItem, function () {
                                        //_this.rebind();
                                    }.bind(this), {
                                        showApply2Album: true,
                                        noDefaultIcon: (origItem.itemImageType !== 'notsavedimage') && (origItem.itemImageType !== 'icon')
                                    });
                                }
                            },
                            order: 100,
                            grouporder: 50, // shoudl be same as auto-tag
                        }];
                    let ctrl = new Control(div);
                    ctrl.addToContextMenu(allitems);
                    ctrl.contextMenuHandler(e);
                    e.stopPropagation();
                }, true);
            }
        },
        width: 100,
        notForAlbum: true, // this field should not be used for whole album, summary has own artwork field
    },
    order: {
        title: _('Track #'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = item.trackNumber;
        },
        getValue: function (item) {
            return item.trackNumber;
        },
        setValue: function (item, newValue) {
            return checkAndUpdateValue(item, 'trackNumber', newValue);
        },
        editor: editors.gridViewEditors.textEdit,
        align: 'right',
        width: 50,
        mask: 'T',
        notForAlbum: true, // this field should not be used for whole album, specific for each track
    },
    skipped: {
        title: _('Skipped #'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = item.skipCount;
        },
        getValue: function (item) {
            return item.skipCount;
        },
        setValue: function (item, newValue) {
            let res = checkAndUpdateValue(item, 'skipCount', newValue);
            if (!res) {
                if (newValue == 0)
                    item.lastTimeSkipped = -1;
                else
                    item.lastTimeSkipped = app.utils.now();
            }
            return res;
        },
        editor: editors.gridViewEditors.numberEdit,
        align: 'right',
        width: 50,
        mask: 'ZZ5',
        notForAlbum: true, // this field should not be used for whole album, specific for each track
    },
    summary: {
        title: _('Track summary'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = item.summary;
        },
        getValue: function (item) {
            return item.summary;
        },
        width: defaultColWidth,
        mask: 'ZZS',
        notForAlbum: true, // this field should not be used for whole album, specific for each track
    },
    dimensions: {
        title: _('Resolution'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = item.dimensions;
        },
        getValue: function (item) {
            return item.dimensions;
        },
        width: 80,
        mask: 'ZZT'
    },
    framerate: {
        title: _('Framerate'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = item.frameRateStr;
        },
        getValue: function (item) {
            return item.frameRateStr;
        },
        width: 80,
        mask: 'ZZU'
    },
    podcast: {
        title: _('Podcast'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = item.album;
        },
        getValue: function (item) {
            return item.album;
        },
        setValue: function (item, newValue) {
            return checkAndUpdateValue(item, 'album', newValue);
        },
        editor: editors.gridViewEditors.textEdit,
        width: defaultColWidth,
        mask: 'ZU',
        alias: ['album', 'series'],
    },
    series: {
        title: _('Series'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = item.album;
        },
        getValue: function (item) {
            return item.album;
        },
        setValue: function (item, newValue) {
            return checkAndUpdateValue(item, 'album', newValue);
        },
        editor: editors.gridViewEditors.textEdit,
        width: defaultColWidth,
        mask: 'ZV',
        alias: ['album', 'podcast'],
        /* moved to 'showLinks' addon in SampleScripts folder (#16884)
        shortcutFunc: function (item, shortcutID) {
            handleShortcut(shortcutID, 'series', 'album', item);
        }*/
    },
    episode: {
        title: _('Episode #'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = item.episodeNumber;
        },
        getValue: function (item) {
            return item.episodeNumber;
        },
        setValue: function (item, newValue) {
            return checkAndUpdateValue(item, 'episodeNumber', newValue);
        },
        editor: editors.gridViewEditors.textEdit,
        align: 'right',
        width: defaultColWidth,
        mask: 'ZY',
        notForAlbum: true, // this field should not be used for whole album, specific for each track
    },
    producer: {
        title: _('Producer'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = utils.multiString2VisualString(item.producer);
        },
        getValue: function (item) {
            return utils.multiString2VisualString(item.producer);
        },
        setValue: function (item, newValue) {
            return checkAndUpdateValue(item, 'producer', newValue);
        },
        editor: editors.gridViewEditors.multiValueEdit,
        editorParams: '{dbFunc:"getPeople", dbFuncParams: {category: "producer"}}',
        width: defaultColWidth,
        mask: 'ZW'
    },
    director: {
        title: _('Director'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = utils.multiString2VisualString(item.artist);
        },
        getValue: function (item) {
            return utils.multiString2VisualString(item.artist);
        },
        setValue: function (item, newValue) {
            return checkAndUpdateValue(item, 'artist', newValue);
        },
        editor: editors.gridViewEditors.multiValueEdit,
        editorParams: '{dbFunc:"getPeople", dbFuncParams: {category: "director"}}',
        width: defaultColWidth,
        mask: 'ZX'
    },
    season: {
        title: _('Season #'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = item.seasonNumber;
        },
        getValue: function (item) {
            return item.seasonNumber;
        },
        setValue: function (item, newValue) {
            return checkAndUpdateValue(item, 'seasonNumber', newValue);
        },
        editor: editors.gridViewEditors.textEdit,
        align: 'right',
        width: defaultColWidth,
        mask: 'ZZA',
    },
    screenwriter: {
        title: _('Screenwriter'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = utils.multiString2VisualString(item.lyricist);
        },
        getValue: function (item) {
            return utils.multiString2VisualString(item.lyricist);
        },
        setValue: function (item, newValue) {
            return checkAndUpdateValue(item, 'lyricist', newValue);
        },
        editor: editors.gridViewEditors.multiValueEdit,
        editorParams: '{dbFunc:"getPeople", dbFuncParams: {category: "screenwriter"}}',
        width: defaultColWidth,
        mask: 'ZZW'
    },
    publisher: {
        title: _('Publisher'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = item.publisher;
        },
        getValue: function (item) {
            return item.publisher;
        },
        setValue: function (item, newValue) {
            return checkAndUpdateValue(item, 'publisher', newValue);
        },
        editor: editors.gridViewEditors.textEdit,
        width: defaultColWidth,
        mask: 'ZK'
    },
    actors: {
        title: _('Actor(s)'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = utils.multiString2VisualString(item.actors);
        },
        getValue: function (item) {
            return utils.multiString2VisualString(item.actors);
        },
        setValue: function (item, newValue) {
            return checkAndUpdateValue(item, 'actors', newValue);
        },
        editor: editors.gridViewEditors.multiValueEdit,
        editorParams: '{dbFunc:"getPeople", dbFuncParams: {category: "actor"}}',
        width: defaultColWidth,
        mask: 'ZZB'
    },
    parentalRating: {
        title: _('Parental Rating'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = item.parentalRating;
        },
        getValue: function (item) {
            return item.parentalRating;
        },
        setValue: function (item, newValue) {
            return checkAndUpdateValue(item, 'parentalRating', newValue);
        },
        editor: editors.gridViewEditors.textEdit,
        width: defaultColWidth,
        mask: 'ZZE'
    },
    trackType: {
        title: _('Type'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = item.trackTypeStr;
        },
        getValue: function (item) {
            return item.trackTypeStr;
        },
        width: 80,
        mask: 'ZZC'
    },
    initialKey: {
        title: _('Initial Key'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = item.initialKey;
        },
        getValue: function (item) {
            return item.initialKey;
        },
        setValue: function (item, newValue) {
            return checkAndUpdateValue(item, 'initialKey', newValue);
        },
        editor: editors.gridViewEditors.textEdit,
        width: 80,
        mask: 'ZZH'
    },
    isrc: {
        title: _('ISRC'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = item.isrc;
        },
        getValue: function (item) {
            return item.isrc;
        },
        setValue: function (item, newValue) {
            return checkAndUpdateValue(item, 'isrc', newValue);
        },
        editor: editors.gridViewEditors.textEdit,
        width: 80,
        mask: 'ZF'
    },
    encoder: {
        title: _('Encoder'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = item.encoder;
        },
        getValue: function (item) {
            return item.encoder;
        },
        setValue: function (item, newValue) {
            return checkAndUpdateValue(item, 'encoder', newValue);
        },
        editor: editors.gridViewEditors.textEdit,
        width: 80,
        mask: 'ZE'
    },
    copyright: {
        title: _('Copyright'),
        disabled: false,
        checked: false,
        bindData: function (div, item) {
            div.textContent = item.copyright;
        },
        getValue: function (item) {
            return item.copyright;
        },
        setValue: function (item, newValue) {
            return checkAndUpdateValue(item, 'copyright', newValue);
        },
        editor: editors.gridViewEditors.textEdit,
        width: 80,
        mask: 'ZZX'
    }
};
window.uitools.tracklistFieldDefs = tracklistFieldDefs;
if (!window.menus) // prepare object for menu generation functions
    window.menus = {};
window.menus.tracklistMenuItems = window.menus.tracklistMenuItems || [
    {
        action: actions.saveNewOrder,
        order: 5,
        grouporder: 10
    },
    {
        action: actions.addToLibrary,
        order: 10,
        grouporder: 10
    },
    {
        action: actions.downloadToLibrary,
        order: 20,
        grouporder: 10
    },
    {
        action: concatObjects(copyObject(actions.synchronizeTags), {
            visible: () => {
                if (!window.uitools.getCanEdit())
                    return;
                let node = navUtils.getActiveNode();
                if (node && node.handlerID == 'files_to_edit_with_hightlight')
                    return true;
            }
        }),
        order: 30,
        grouporder: 10
    },
    {
        action: concatObjects(copyObject(actions.ripCD), {
            visible: () => {
                if (window.uitools.getCanEdit()) {
                    let node = navUtils.getActiveNode();
                    if (node && node.handlerID == 'optical_drive') {
                        let FC = window.lastFocusedControl;
                        if (FC && FC.controlClass && FC.controlClass.parentView)
                            return true;
                    }
                }
            }
        }),
        order: 10,
        grouporder: 10
    },
    {
        action: concatObjects(copyObject(actions.getCDInfo), {
            visible: () => {
                if (window.uitools.getCanEdit()) {
                    let node = navUtils.getActiveNode();
                    if (node && node.handlerID == 'optical_drive') {
                        let FC = window.lastFocusedControl;
                        if (FC && FC.controlClass && FC.controlClass.parentView)
                            return true;
                    }
                }
            }
        }),
        order: 20,
        grouporder: 10
    },
    {
        action: concatObjects(copyObject(actions.playNow), {
            visible: () => {
                if (window.settings.UI.canReorder == false)
                    return false;
                else
                    return !app.player.shufflePlaylist;
            }
        }),
        order: 10,
        grouporder: 20
    },
    {
        action: concatObjects(copyObject(actions.playNext), {
            visible: () => {
                if (window.settings.UI.canReorder == false)
                    return false;
                else if (!app.player.shufflePlaylist)
                    return true;
                else
                    return uitools.notMoreTracksSelectedAsync();
            }
        }),
        order: 20,
        grouporder: 20
    },
    {
        action: concatObjects(copyObject(actions.playLast), {
            visible: () => {
                if (!app.player.shufflePlaylist)
                    return true;
                else
                    return uitools.notMoreTracksSelectedAsync();
            }
        }),
        order: 30,
        grouporder: 20
    },
    {
        action: concatObjects(copyObject(actions.playNowShuffled), {
            title: function () {
                return _('Play now') + ' (' + _('shuffled') + ')';
            },
            visible: () => {
                if (window.settings.UI.canReorder == false)
                    return false;
                else
                    return app.player.shufflePlaylist;
            }
        }),
        order: 10,
        grouporder: 20
    },
    {
        action: concatObjects(copyObject(actions.playNextShuffled), {
            title: function () {
                return _('Queue next') + ' (' + _('shuffled') + ')';
            },
            visible: () => {
                if (window.settings.UI.canReorder == false)
                    return false;
                else if (!app.player.shufflePlaylist)
                    return false;
                else
                    return uitools.moreTracksSelectedAsync();
            }
        }),
        order: 20,
        grouporder: 20
    },
    {
        action: concatObjects(copyObject(actions.playMixedShuffled), {
            title: function () {
                return _('Queue mixed') + ' (' + _('shuffled') + ')';
            },
            visible: () => {
                if (window.settings.UI.canReorder == false)
                    return false;
                else if (!app.player.shufflePlaylist)
                    return false;
                else
                    return uitools.moreTracksSelectedAsync();
            }
        }),
        order: 30,
        grouporder: 20
    },
    {
        action: concatObjects(copyObject(actions.playLastShuffled), {
            title: function () {
                return _('Queue last') + ' (' + _('shuffled') + ')';
            },
            visible: () => {
                if (!app.player.shufflePlaylist)
                    return false;
                else
                    return uitools.moreTracksSelectedAsync();
            }
        }),
        order: 40,
        grouporder: 20
    },
    {
        action: actions.playShuffled,
        order: 40,
        grouporder: 20
    },
    {
        action: actions.playShuffledByAlbum,
        order: 50,
        grouporder: 20
    },
    {
        action: actions.playNormally,
        order: 60,
        grouporder: 20
    },
    {
        action: actions.sendTo,
        order: 10,
        grouporder: 30
    },
    {
        action: actions.findMoreFromSame,
        order: 20,
        grouporder: 30
    },
    {
        action: actions.cut,
        order: 10,
        grouporder: 40
    },
    {
        action: actions.copy,
        order: 20,
        grouporder: 40
    },
    {
        action: actions.paste,
        order: 30,
        grouporder: 40
    },
    {
        action: {
            title: function () {
                return _('Rename');
            },
            icon: 'edit',
            disabled: function (pars) {
                let LV = window.lastFocusedControl;
                if (!LV || !LV.controlClass || !isFunction(LV.controlClass.editStart) || !LV.controlClass.editSupported) {
                    return true;
                }
                return uitools.notMediaListSelected(pars);
            },
            visible: function (item) {
                return window.uitools.getCanEdit();
            },
            execute: function () {
                let LV = window.lastFocusedControl;
                if (!LV || !LV.controlClass || !isFunction(LV.controlClass.editStart) || !LV.controlClass.editSupported) {
                    return;
                }
                LV.controlClass.editStart();
            },
            shortcut: 'F2'
        },
        order: 35,
        grouporder: 40
    },
    {
        action: actions.remove,
        order: 40,
        grouporder: 40
    },
    {
        action: actions.myRating,
        order: 10,
        grouporder: 50
    },
    {
        action: actions.autoTag,
        order: 20,
        grouporder: 50
    },
    {
        action: actions.autoTagFromFilename,
        order: 30,
        grouporder: 50
    },
    {
        action: actions.autoOrganize,
        order: 40,
        grouporder: 50
    },
    {
        action: window._menuItems.editTags.action,
        order: 50,
        grouporder: 50
    },
    {
        action: actions.trackProperties,
        order: 1000,
        grouporder: 50
    },
    {
        action: actions.convertFiles,
        order: 10,
        grouporder: 60
    },
    {
        action: actions.analyzeVolume,
        order: 20,
        grouporder: 60
    }
    /* removed per #19180
    {
        action: actions.levelTrackVolume,
        order: 30,
        grouporder: 60
    }
    */
];
/**
Creates Menu object for tracklist.

@method createTracklistMenu
@for Menus
@param {Object} parent Parent element for the menu.
@return {Menu} Created Menu object.
*/
window.menus.createTracklistMenu = window.menus.createTracklistMenu || function (parent, bindFn) {
    // use copy of the items because of bindFn, see e.g. _generateItems in popupmenu.js where it changes binding (mitem.action = bindAction(mitem.action, this.bindFn);)
    let items = copyObject(menus.tracklistMenuItems);
    return new Menu(items, {
        parent: parent,
        bindFn: bindFn
    });
};
function checkAndUpdateValue(item, property, newVal) {
    if (item[property] !== newVal) {
        item[property] = newVal;
        return false;
    }
    return true; // do not save
}
export default class TrackListView extends GridView {
    constructor() {
        super(...arguments);
        this.getDefaultSortString = function () {
            return 'albumArtist ASC;album ASC;discNo ASC;order ASC;title ASC';
        };
    }
    initialize(rootelem, params) {
        super.initialize(rootelem, params);
        this.isSortable = true;
        this.isSearchable = true;
        this.highlightPlayingTrack = true;
        this.hasMediaContent = true;
        if (params) {
            if (params.orderColumnSupport)
                this.orderColumnSupport = true;
        }
        let loadSettings = function () {
            let sett = settings.get('CustomFields,Options');
            Custom1Title = sett.CustomFields.Fld1Name || Custom1Title;
            Custom2Title = sett.CustomFields.Fld2Name || Custom2Title;
            Custom3Title = sett.CustomFields.Fld3Name || Custom3Title;
            Custom4Title = sett.CustomFields.Fld4Name || Custom4Title;
            Custom5Title = sett.CustomFields.Fld5Name || Custom5Title;
            Custom6Title = sett.CustomFields.Fld6Name || Custom6Title;
            Custom7Title = sett.CustomFields.Fld7Name || Custom7Title;
            Custom8Title = sett.CustomFields.Fld8Name || Custom8Title;
            Custom9Title = sett.CustomFields.Fld9Name || Custom9Title;
            Custom10Title = sett.CustomFields.Fld10Name || Custom10Title;
            /* following has been moved to /sampleScripts/showLinks addon in course of #16884
            this._showShortcuts = sett.Options.ShowTrackShortcut;
            this._activeShortcut = sett.Options.ActiveTrackShortcutType;
            */
        }.bind(this);
        loadSettings();
        let registerSettingsChanges = true;
        if (params && params.isPopup)
            registerSettingsChanges = false; // #20881
        if (registerSettingsChanges) {
            this.localListen(settings.observer, 'change', () => {
                loadSettings();
                this.clearDivs();
                this.invalidateAll();
                if (this.headerItems) {
                    this.setUpHeader(this.headerItems);
                    this._refreshSortIndicators();
                }
                this.updateRequiredWidth();
                this.adjustSize(false);
                // workaround for probably Chromium bug, without this, items are wrongly rendered (content is not scrolled to the left)
                this.forceReRender();
            });
        }
        if (!params || !params.disableDragNDrop)
            this.enableDragNDrop();
        this.contextMenu = menus.createTracklistMenu(this.container);
        this.localListen(this.container, 'focuschange', function () {
            this.raiseItemFocusChange();
        }.bind(this));
        this._prepareSortColumns(this.getDefaultSortString());
        this.registerEventHandler('datasourcechanged');
    }
    cleanUp() {
        super.cleanUp();
        if (this.dataSource && this._sortedEvent) {
            app.unlisten(this.dataSource, 'sorted', this._sortedEvent);
            this._sortedEvent = undefined;
        }
    }
    handle_datasourcechanged(e) {
        let DS = e.detail.newDataSource;
        if (DS) {
            if (this.isSortable && this.autoSortSupported && DS.setAutoSortAsync) {
                DS.setAutoSortAsync(this.autoSortString);
            }
            this.localPromise(DS.whenLoaded()).then(() => {
                if (DS.count > 0 && this.focusedIndex < 0) {
                    this.focusedIndex = 0; // to force update of A&D pane (raises 'itemfocuschange') -- issue #13987
                    this._itemToShow = undefined; // to prevent from making this auto-focused item to be fully visible - fix of #14461
                }
            });
        }
        if (uitools.saveButtonSupported(this.parentView, DS)) { // hide save button, when new dataSource is sorted using default sort string
            if (e.detail.oldDataSource && this._sortedEvent) {
                app.unlisten(e.detail.oldDataSource, 'sorted', this._sortedEvent);
                this._sortedEvent = undefined;
            }
            if (DS) {
                let handler = getNodeHandler(this.parentView);
                let defSortStr = '';
                if (handler && handler.defaultColumnSort)
                    defSortStr = handler.defaultColumnSort;
                if (defSortStr !== '') {
                    this._sortedEvent = app.listen(DS, 'sorted', function () {
                        let newSortString = this.autoSortString || this.getSortingStr();
                        if (!newSortString || (newSortString == defSortStr + ' ASC') || (newSortString == defSortStr)) { // TODO: support more complex sort string
                            uitools.cleanUpSaveButton(null);
                        }
                        else {
                            if (window.currentTabControl && !window.currentTabControl._saveOrderButton) {
                                this.saveButtonHandle(newSortString, DS);
                            }
                        }
                    }.bind(this));
                }
            }
        }
    }
    formatStatus(data) {
        return (this.disableStatusbar || !data) ? '' : statusbarFormatters.formatTracklistStatus(data);
    }
    _incrementalSearchMessageSuffix(phrase) {
        if (phrase.includes(':')) { // scroll column was specified
            return ' ' + _('in') + ' "' + phrase.substr(0, phrase.indexOf(':')) + '"';
        }
        else if (this.sortColumns && this.sortColumns.length) {
            if (this.sortColumns[0].title == '#') // #19457
                return '';
            else
                return ' ' + _('in') + ' "' + resolveToValue(this.sortColumns[0].title, this.sortColumns[0].columnType) + '"';
        }
        else
            return '';
    }
    preBindData(div, index, fastObject) {
        if (fastObject.objectType === 'track') {
            if (this.highlightPlayingTrack)
                div.classList.toggle('itemNowPlaying', fastObject.isPlaying);
            if (fastObject.getIsPlayable)
                div.classList.toggle('itemInaccessible', !fastObject.getIsPlayable());
        }
    }
    canDeleteSelected() {
        if (this.dataSource) {
            let track = this.dataSource.firstSelected;
            if (track)
                return _utils.isDeletableTrack(track);
        }
    }
    get fieldGroups() {
        if (this._fieldGroups === undefined)
            this._fieldGroups = uitools.tracklistFieldGroups;
        return this._fieldGroups;
    }
    get multiselect() {
        if (window.settings.UI.canReorder == false)
            return false; // #20853
        else
            return this._multiselect;
    }
    get fieldDefs() {
        if (this._fieldDefs === undefined) {
            this._fieldDefs = {};
            for (let f in uitools.tracklistFieldDefs) {
                this.fieldDefs[f] = copyObject(uitools.tracklistFieldDefs[f]);
                this.fieldDefs[f].columnType = f;
            }
        }
        return this._fieldDefs;
    }
    set fieldDefs(value) {
        this._fieldDefs = value;
    }
}
registerClass(TrackListView);
