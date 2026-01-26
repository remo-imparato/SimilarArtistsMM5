/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";
let enc23 = [_('ASCII (always)'), _('ASCII + UTF-16 (when needed)')];
let enc24 = [_('ASCII (always)'), _('ASCII + UTF-16 (when needed)'), _('ASCII + UTF-8 (when needed)')];
let UI = undefined;
let used24 = undefined;

let prepareTextEncoderCB = function (initIdx) {
    let tagIdx = UI.cbID3Tag.controlClass.focusedIndex;
    let lastIdx = -1;
    if ((initIdx === undefined) && UI.cbID3Enc.controlClass.dataSource)
        lastIdx = UI.cbID3Enc.controlClass.focusedIndex;

    let use24 = (tagIdx === 2) || (tagIdx === 4);
    if (used24 !== use24) {
        let ar;
        used24 = use24;
        if (use24) {
            ar = enc24;
            if (initIdx === undefined) {
                if (lastIdx !== 0)
                    initIdx = 2; // for ID3v2.4 use UTF8 instead of UTF16, by default
                else
                    initIdx = 0;
            }
        } else {
            ar = enc23;
            if (initIdx === undefined) {
                if ((lastIdx < 2) && (lastIdx >= 0))
                    initIdx = lastIdx;
                else
                    initIdx = 1;
            }
        }
        let ds = newStringList();
        forEach(ar, function (itm) {
            ds.add(itm);
        });
        UI.cbID3Enc.controlClass.dataSource = ds;
        if (initIdx >= UI.cbID3Enc.controlClass.dataSource.count)
            initIdx = UI.cbID3Enc.controlClass.dataSource.count - 1;
        UI.cbID3Enc.controlClass.focusedIndex = initIdx;
    }
};

optionPanels.pnl_Library.subPanels.pnl_TagsAndPlaylists.load = function (sett) {
    UI = getAllUIElements(document.body);
    let tag = sett.Options.StoreID3TagVersion - 1;
    let ver = sett.Options.StoreID3v2Version - 2;

    UI.cbID3Tag.controlClass.focusedIndex = tag + (tag > 1 ? 1 : 0) + (tag > 0 ? ver : 0);
    let encIdx;
    if (sett.Options.StoreID3v2Encoding > 1)
        encIdx = sett.Options.StoreID3v2Encoding - 1;
    else
        encIdx = sett.Options.StoreID3v2Encoding;
    prepareTextEncoderCB(encIdx);

    UI.cbID3Tag.controlClass.localListen(UI.cbID3Tag, 'change', function () {
        prepareTextEncoderCB();
    });

    UI.ChBStoreID3AfterEdit.controlClass.checked = sett.Options.StoreID3AfterEdit;
    UI.ChBModifyTimeOnTag.controlClass.checked = sett.Options.ModifyTimeOnTag;
    UI.chbStoreM3UinUTF8.controlClass.checked = sett.Options.StoreM3UinUTF8;
    UI.chbPlstRelPaths.controlClass.checked = sett.Options.StoreM3URelativePaths;
    UI.chbLinuxSeparator.controlClass.checked = sett.Options.StoreM3ULinuxFolderSeparator;
    UI.chbExtendedM3U.controlClass.checked = sett.Options.StoreExtendedM3U;
    UI.chbCreateAddedPlst.controlClass.checked = sett.Options.CreateAddedPlst;
    UI.chbWarnPlstDups.controlClass.checked = sett.Options.CheckPlaylistDups;
    UI.cbImgLocation.controlClass.focusedIndex = app.settings.utils.getCoverStorageType();
    let cbMasks = qid('cbImgFilename1');
    let maskList = app.settings.getMaskList('AAMasks');
    cbMasks.controlClass.masks = maskList;
    cbMasks.controlClass.value = maskList.getFirst();
    cbMasks.controlClass.hideWizardButton = true;
    let cbMasks2 = qid('cbImgFilename2');
    let maskList2 = app.settings.getMaskList('AAMasks2');
    cbMasks2.controlClass.masks = maskList2;
    cbMasks2.controlClass.value = maskList2.getFirst();
    cbMasks2.controlClass.hideWizardButton = true;
}

optionPanels.pnl_Library.subPanels.pnl_TagsAndPlaylists.save = function (sett) {

    let idx = UI.cbID3Tag.controlClass.focusedIndex;
    sett.Options.StoreID3TagVersion = (idx > 0 ? Math.floor((idx - 1) / 2) + 1 : 0) + 1;
    sett.Options.StoreID3v2Version = ((idx & 1) == 1 ? 0 : 1) + 2;
    let encIdx = UI.cbID3Enc.controlClass.focusedIndex;
    if (encIdx > 1)
        encIdx++;
    sett.Options.StoreID3v2Encoding = encIdx;
    sett.Options.StoreID3AfterEdit = UI.ChBStoreID3AfterEdit.controlClass.checked;
    sett.Options.ModifyTimeOnTag = UI.ChBModifyTimeOnTag.controlClass.checked;
    sett.Options.StoreM3UinUTF8 = UI.chbStoreM3UinUTF8.controlClass.checked;
    sett.Options.StoreM3URelativePaths = UI.chbPlstRelPaths.controlClass.checked;
    sett.Options.StoreM3ULinuxFolderSeparator = UI.chbLinuxSeparator.controlClass.checked;
    sett.Options.StoreExtendedM3U = UI.chbExtendedM3U.controlClass.checked;
    sett.Options.CreateAddedPlst = UI.chbCreateAddedPlst.controlClass.checked;
    sett.Options.CheckPlaylistDups = UI.chbWarnPlstDups.controlClass.checked;
    app.settings.utils.setCoverStorageType(UI.cbImgLocation.controlClass.focusedIndex);
    app.settings.addMask2History(UI.cbImgFilename1.controlClass.value, 'AAMasks');
    app.settings.addMask2History(UI.cbImgFilename2.controlClass.value, 'AAMasks2');
}

optionPanels.pnl_Library.subPanels.pnl_TagsAndPlaylists.beforeWindowCleanup = function () {
    UI = undefined;
}