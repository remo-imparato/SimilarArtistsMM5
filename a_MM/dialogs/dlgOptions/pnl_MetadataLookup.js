/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";
requirejs('helpers/searchTools');
requirejs('helpers/autoTagFramework');

let newLyricsSources = undefined;
let fieldPairs = [];
let checkStates = null;
const FIELD_AUDIO = 0,
    FIELD_VIDEO = 1,
    FIELD_BOTH = 2;
let currentTaggers = [];

optionPanels.pnl_Library.subPanels.pnl_MetadataLookup.load = function (sett) {
    qid('chbSearchMissingLyrics').controlClass.checked = sett.Options.SearchMissingLyrics;
    qid('chbSaveMissingLyrics').controlClass.checked = app.utils.isRegistered() && sett.Options.SaveMissingLyrics;
    bindDisabled2Checkbox(qid('chbSaveMissingLyrics'), qid('chbSearchMissingLyrics'));
    qid('chbSearchMissingArtwork').controlClass.checked = sett.Options.SearchMissingArtwork;
    qid('chbSearchMissingArtistImage').controlClass.checked = sett.Options.SearchMissingArtistImage;
    qid('chbSaveMissingArtwork').controlClass.checked = app.utils.isRegistered() && sett.Options.SaveMissingArtwork;
    qid('chbSearchInfoPanel').controlClass.checked = app.getValue('InfoPanelAutoLookup', true);

    bindDisabled2Checkbox(qid('chbSaveMissingArtwork'), qid('chbSearchMissingArtwork'));
    let edtLServers = qid('edtLServers');
    let edtATServers = qid('edtATServers');
    searchTools.prepareLyricSearch(); // to be sure, search servers are loaded and sorted

    if (!app.utils.isRegistered()) {
        window.uitools.handleGoldCheckbox(qid('chbSaveMissingLyrics'), _('To automatically update tags, please upgrade to MediaMonkey Gold!'));
        window.uitools.handleGoldCheckbox(qid('chbSaveMissingArtwork'), _('To automatically update tags, please upgrade to MediaMonkey Gold!'));
    }

    let updateSourcesEdit = function (lst, parent) {
        let txt = '';
        forEach(lst, function (src, idx) {
            if (!src.disabled) {
                if (txt !== '')
                    txt += '; '
                txt += src.name;
            }
        });
        parent.controlClass.value = txt;
    }
    updateSourcesEdit(window.lyricsSources, edtLServers);

    let setServers = function (srcList, title) {
        return new Promise(function (resolve, reject) {
            let allServerColumns = [];
            forEach(srcList, function (src, idx) {
                allServerColumns.push({
                    title: src.name,
                    columnType: src.name,
                    visible: !src.disabled
                });
            });

            let dlg = uitools.openDialog('dlgSelectColumns', {
                modal: true,
                title: title,
                listLabel: '',
                allColumns: allServerColumns,
                helpContext: 'Getting_Track_Information_from_the_Internet#Lyrics_lookup'
            });
            dlg.whenClosed = function () {
                app.unlisten(dlg, 'closed', dlg.whenClosed);
                if (dlg.modalResult == 1) {
                    let newList = dlg.getValue('getColumnList')();
                    let obj = JSON.parse(newList);
                    let newSources = [];
                    obj.forEach(function (item) {
                        let it = srcList[item.origIndex];
                        if (it) {
                            it.disabled = !item.visible;
                            newSources.push(it);
                        }
                    });
                    resolve(newSources);
                }
            };
            app.listen(dlg, 'closed', dlg.whenClosed);
        });
    };



    localListen(qid('btnSetLServers'), 'click', function () {
        let srcList;
        if (newLyricsSources)
            srcList = newLyricsSources;
        else
            srcList = window.lyricsSources;
        setServers(srcList, _('Lyrics sources')).then(function (newList) {
            updateSourcesEdit(newList, edtLServers);
            newLyricsSources = newList;
        });
    });
    addEnterAsClick(window, qid('btnSetLServers'));

    localListen(qid('btnSetATServers'), 'click', function () {
        setServers(currentTaggers, _('Auto-tag metadata sources')).then(function (newList) {
            currentTaggers = newList;
            updateSourcesEdit(newList, edtATServers);
        });
    });
    addEnterAsClick(window, qid('btnSetATServers'));
    // Audio CD metadata lookup

    let edtProtocol = qid('edtAudioCDbase');
    localListen(edtProtocol, 'change', () => {
        let useMusicBrainz = (edtProtocol.controlClass.focusedIndex == 0);
        if (useMusicBrainz) {
            qid('edtFreedbServerName').controlClass.value = sett.FreedbSettings.MusicBrainzServer;
        } else {
            qid('edtFreedbServerName').controlClass.value = sett.FreedbSettings.ServerName;
        }
        setVisibility( qid('boxServerName'),  (edtProtocol.controlClass.focusedIndex < 3));
    });

    if (sett.FreedbSettings.Disabled)
        edtProtocol.controlClass.focusedIndex = 3;
    else
    if (sett.FreedbSettings.UseMusicBrainz)
        edtProtocol.controlClass.focusedIndex = 0;
    else
    if (sett.FreedbSettings.UseHTTP)
        edtProtocol.controlClass.focusedIndex = 2;
    else
        edtProtocol.controlClass.focusedIndex = 1;            

    // Auto-tagging

    //<div>Audio:<div data-id="edtAudioFields" data-control-class="Edit" data-init-params="{readOnly: true}"></div><div data-id="edtAudioFieldsSelect" data-control-class="Button">Select</div></div>
    //<div>Video:<div data-id="edtVideoFields" data-control-class="Edit" data-init-params="{readOnly: true}"></div><div data-id="edtVideoFieldsSelect" data-control-class="Button">Select</div></div>

    checkStates = JSON.parse(app.utils.web.getAutoTagFieldsChecks());
    let edtAudioFields = qid('edtAudioFields');
    let edtVideoFields = qid('edtVideoFields');
    let edtAudioFieldsSelect = qid('edtAudioFieldsSelect');
    let edtVideoFieldsSelect = qid('edtVideoFieldsSelect');

    let addFieldPair = function (name, title, type) {
        fieldPairs.push({
            columnType: name,
            name: name,
            title: title,
            type: type,
        });
    }
    addFieldPair('summary', _('Album Summary'), FIELD_BOTH);
    addFieldPair('title', _('Title'), FIELD_BOTH);
    addFieldPair('artist', _('Artist'), FIELD_AUDIO);
    addFieldPair('album', _('Album'), FIELD_BOTH);
    addFieldPair('trackNum', _('Track #'), FIELD_BOTH);
    addFieldPair('discNum', _('Disc #'), FIELD_BOTH);
    addFieldPair('date', _('Date'), FIELD_BOTH);
    addFieldPair('year', _('Year'), FIELD_BOTH);
    addFieldPair('genre', _('Genre'), FIELD_AUDIO);
    addFieldPair('director', _('Director'), FIELD_VIDEO);
    //addFieldPair('writer', _('Lyricist'), FIELD_AUDIO);
    //addFieldPair('publisher', _('Publisher'), FIELD_AUDIO);
    addFieldPair('actors', _('Actors'), FIELD_VIDEO);
    addFieldPair('parentalRating', _('Parental Rating'), FIELD_VIDEO);
    addFieldPair('comment', _('Comment'), FIELD_VIDEO);
    addFieldPair('lyrics', _('Lyrics'), FIELD_AUDIO);
    addFieldPair('involvedPeople', _('Involved people'), FIELD_BOTH);

    let getTypePairs = function (isAudio, sort) {
        let allowed = [FIELD_BOTH];
        if (isAudio)
            allowed.push(FIELD_AUDIO);
        else
            allowed.push(FIELD_VIDEO);
        let ds = [];
        fieldPairs.forEach(function (pair) {
            if (allowed.indexOf(pair.type) >= 0) {
                let obj = copyObject(pair);
                if (pair.name === 'year')
                    obj.uniqueWith = 'date';
                if (pair.name === 'date')
                    obj.uniqueWith = 'year';
                
                if (pair.name === 'summary') {
                    obj.locked = true;
                    obj.visible = true;
                } else {
                    obj.visible = checkStates[isAudio ? 'audio' : 'video'][pair.name];
                }
                ds.push(obj);
            }
        });

        if (sort) {
            let tempAr = checkStates[isAudio ? 'audio' : 'video']._order.split(';');
            ds.sort(function (item1, item2) {
                return tempAr.indexOf(item1.columnType) - tempAr.indexOf(item2.columnType);
            });
        }

        return ds;
    };

    let updateTypeEdits = function () {
        let getVisibleFields = function (ds, name) {
            let ret = newStringList();
            let lockedCol = _('Album Summary');
            let lockedColExist = false;
            ds.forEach(function (field) {
                let title = field[name ? 'name' : 'title'];
                if (title === lockedCol)
                    lockedColExist = true;
                if (field.visible)
                    ret.add(title);
            });

            if (!lockedColExist) 
                ret.add(lockedCol);
            
            return ret;
        }

        let audioPairs = getTypePairs(true, true);
        let videoPairs = getTypePairs(false, true);

        checkStates.audio._order = getVisibleFields(audioPairs, true).commaText.replace(/,/g, ';');
        checkStates.video._order = getVisibleFields(videoPairs, true).commaText.replace(/,/g, ';');

        edtAudioFields.controlClass.value = getVisibleFields(audioPairs).commaText;
        edtVideoFields.controlClass.value = getVisibleFields(videoPairs).commaText;
    };

    let showSelection = function (isAudio) {
        let ds = getTypePairs(isAudio, true);

        let dlg = uitools.openDialog('dlgSelectFromList', {
            modal: true,
            allColumns: ds,
            allowEmpty: false,
            title: _('Choose fields'),
            listLabelAll: _('Tags'),
            listLabel: _('Tags to look up'),
        });
        dlg.whenClosed = function () {
            app.unlisten(dlg, 'closed', dlg.whenClosed);
            if (dlg.modalResult == 1) {
                let newList = dlg.getValue('getColumnList')();
                let obj = JSON.parse(newList);
                let newStr = '';
                obj.forEach(function (item) {
                    checkStates[isAudio ? 'audio' : 'video'][item.columnType] = item.visible;
                    if (item.visible) {
                        if (newStr !== '')
                            newStr += ';';
                        newStr += item.columnType;
                    }
                });
                checkStates[isAudio ? 'audio' : 'video']._order = newStr;
                updateTypeEdits();
            }
        };
        app.listen(dlg, 'closed', dlg.whenClosed);
    }

    localListen(edtAudioFieldsSelect, 'click', function () {
        showSelection(true);
    });
    addEnterAsClick(window, edtAudioFieldsSelect);

    localListen(edtVideoFieldsSelect, 'click', function () {
        showSelection(false);
    });
    addEnterAsClick(window, edtVideoFieldsSelect);

    updateTypeEdits();

    if (sett.Options.AutoTagTaggers) {
        let tg = sett.Options.AutoTagTaggers.replace('; ', ','); // fix possible saved wrong separator, #17218
        let taggers = tg.split(',');
        let existingTaggers = autoTagFramework.getTaggers();
        existingTaggers.forEach(function(tagger) {
            tagger.disabled = !!!taggers.find((o) => (o === tagger.name));
            currentTaggers.push(tagger);
        });
    } else {
        currentTaggers = autoTagFramework.getTaggers();
    }

    updateSourcesEdit(currentTaggers, edtATServers);

    qid('chbAutoTagAudioArtwork').controlClass.checked = sett.Options.AutoTagAudioArtwork;
    qid('chbAutoTagVideoArtwork').controlClass.checked = sett.Options.AutoTagVideoArtwork;

    qid('chbAutoTagPreferAlbums').controlClass.checked = sett.Options.AutoTagPreferAlbums;
    qid('chbAutoTagAvoidCompilations').controlClass.checked = sett.Options.AutoTagAvoidCompilations;

    qid('chbAutoTagReplace').controlClass.checked = sett.Options.AutoTagReplace;
    qid('edtReplaceLimit').controlClass.value = sett.Options.AutoTagReplaceLimit;

    qid('chbPreferFastLookup').controlClass.checked = sett.Options.PreferFastLookup;

    bindDisabled2Checkbox(qid('edtReplaceLimit'), qid('chbAutoTagReplace'));
    bindDisabled2Checkbox(qid('lblReplaceLimit'), qid('chbAutoTagReplace'));
    
};

optionPanels.pnl_Library.subPanels.pnl_MetadataLookup.save = function (sett) {
    if ((!sett.Options.SearchMissingArtwork && qid('chbSearchMissingArtwork').controlClass.checked) || (!sett.Options.SearchMissingArtistImage && qid('chbSearchMissingArtistImage').controlClass.checked))
        app.utils.clearThumbPathsCache(); // so thumbs could be refreshed and searched
    sett.Options.SearchMissingLyrics = qid('chbSearchMissingLyrics').controlClass.checked;
    sett.Options.SaveMissingLyrics = app.utils.isRegistered() && qid('chbSaveMissingLyrics').controlClass.checked;
    sett.Options.SearchMissingArtwork = qid('chbSearchMissingArtwork').controlClass.checked;
    sett.Options.SearchMissingArtistImage = qid('chbSearchMissingArtistImage').controlClass.checked;
    sett.Options.SaveMissingArtwork = app.utils.isRegistered() && qid('chbSaveMissingArtwork').controlClass.checked;
    app.setValue('InfoPanelAutoLookup', qid('chbSearchInfoPanel').controlClass.checked);
    if (newLyricsSources) {
        let lst = [];
        forEach(newLyricsSources, function (src) {
            lst.push({
                name: src.name,
                disabled: src.disabled
            });
        })
        app.setValue('MetadataLookup', {
            lyricSources: lst
        });
    }

    // Audio CD metadata lookup

    if (qid('edtAudioCDbase').controlClass.focusedIndex == 0)
        sett.FreedbSettings.UseMusicBrainz = true;
    else {
        sett.FreedbSettings.UseMusicBrainz = false;
        if (qid('edtAudioCDbase').controlClass.focusedIndex == 2)
            sett.FreedbSettings.UseHTTP = true;
        else
            sett.FreedbSettings.UseHTTP = false;
    }
    if (qid('edtAudioCDbase').controlClass.focusedIndex == 3)
        sett.FreedbSettings.Disabled = true;
    else
        sett.FreedbSettings.Disabled = false;

    if (sett.FreedbSettings.UseMusicBrainz)
        sett.FreedbSettings.MusicBrainzServer = qid('edtFreedbServerName').controlClass.value;
    else {
        sett.FreedbSettings.ServerName = qid('edtFreedbServerName').controlClass.value;
    }


    // auto-tagging

    let data = {
        audio: {
            _order: checkStates.audio._order,
        },
        video: {
            _order: checkStates.video._order
        }
    }

    let JSONString = JSON.stringify(data);
    app.utils.web.setAutoTagFieldsChecks(JSONString);

    sett.AutoTag.audioFields = checkStates.audio._order;
    sett.AutoTag.videoFields = checkStates.video._order;

    sett.Options.AutoTagTaggers = qid('edtATServers').controlClass.value.replace('; ', ',');

    sett.Options.AutoTagAudioArtwork = qid('chbAutoTagAudioArtwork').controlClass.checked;
    sett.Options.AutoTagVideoArtwork = qid('chbAutoTagVideoArtwork').controlClass.checked;

    sett.Options.AutoTagPreferAlbums = qid('chbAutoTagPreferAlbums').controlClass.checked;
    sett.Options.AutoTagAvoidCompilations = qid('chbAutoTagAvoidCompilations').controlClass.checked;


    sett.Options.AutoTagReplace = qid('chbAutoTagReplace').controlClass.checked;
    sett.Options.AutoTagReplaceLimit = qid('edtReplaceLimit').controlClass.value;

    sett.Options.PreferFastLookup = qid('chbPreferFastLookup').controlClass.checked;
}
