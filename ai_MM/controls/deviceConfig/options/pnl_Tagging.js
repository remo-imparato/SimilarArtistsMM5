/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

DeviceConfig.prototype.tabs.options.panels.pnl_Tagging.load = function (device, reload) {

    this.qChild('lblModifyMetadata').textContent = sprintf(_('Update files and metadata as follows when syncing to \'%s\''), device.name);

    this.qChild('chbSyncAAToFolders').controlClass.checked = device.saveAAToFolder;

    var cbAAFolder = this.qChild('cbAAFolder');
    cbAAFolder.controlClass.masks = app.settings.getMaskList('AAMasks');
    cbAAFolder.controlClass.hideWizardButton = true;
    cbAAFolder.controlClass.value = app.masks.mask2VisMask(device.syncAAMask);

    this.qChild('chbSyncAAToTag').controlClass.checked = device.saveAAToTag;
    this.qChild('chbRemoveAAFromTag').controlClass.checked = device.removeAAFromTag;
    this.qChild('edtIgnoreShorterKB').controlClass.value = device.removeAAByteRate;

    let chbConvertAA = this.qChild('chbConvertAA');    
    chbConvertAA.controlClass.checked = device.convertArtwork;
    let cbConvertAAType = this.qChild('cbConvertAAType'); 
    cbConvertAAType.controlClass.value = device.convertArtworkType;
    let _checkMaskExtension = () => {
        if (chbConvertAA.controlClass.checked)            
            cbAAFolder.controlClass.value = removeFileExt(cbAAFolder.controlClass.value) + '.' +  cbConvertAAType.controlClass.value.toLowerCase();        
        else
            cbAAFolder.controlClass.value = removeFileExt(cbAAFolder.controlClass.value) + '.jpg';
    };
    this.localListen( chbConvertAA, 'change', _checkMaskExtension);
    this.localListen( cbConvertAAType, 'change', _checkMaskExtension);

    this.qChild('chbResizeAA').controlClass.checked = device.resizeArtwork;
    bindDisabled2Checkbox(qid('chbResizeAA'), qid('chbConvertAA'));    
    this.qChild('edtMaxAARes').controlClass.value = device.resizeArtworkMaxRes;
    bindDisabled2Checkbox(qid('edtMaxAARes'), qid('chbConvertAA'));    

    this.qChild('chbFirstGenre').controlClass.checked = device.syncOnlyFirstGenre;
    this.qChild('chbFirstArtist').controlClass.checked = device.syncOnlyFirstArtist;

    let sett = mediaSyncDevices.getCustomSettings(device);                
    this.qChild('chbForceResync').controlClass.checked = sett.forceReSync;
}

DeviceConfig.prototype.tabs.options.panels.pnl_Tagging.save = function (device) {
    device.saveAAToFolder = this.qChild('chbSyncAAToFolders').controlClass.checked;

    let cbAAFolder = this.qChild('cbAAFolder');
    app.settings.addMask2History(cbAAFolder.controlClass.value, 'AAMasks');

    device.syncAAMask = app.masks.visMask2Mask(cbAAFolder.controlClass.value);
    device.saveAAToTag = this.qChild('chbSyncAAToTag').controlClass.checked;
    device.removeAAFromTag = this.qChild('chbRemoveAAFromTag').controlClass.checked;
    device.removeAAByteRate = Number(this.qChild('edtIgnoreShorterKB').controlClass.value);
    
    device.convertArtwork = this.qChild('chbConvertAA').controlClass.checked;
    device.convertArtworkType = this.qChild('cbConvertAAType').controlClass.value;

    device.resizeArtwork = this.qChild('chbResizeAA').controlClass.checked;
    device.resizeArtworkMaxRes = Number(this.qChild('edtMaxAARes').controlClass.value);

    device.syncOnlyFirstGenre = this.qChild('chbFirstGenre').controlClass.checked;
    device.syncOnlyFirstArtist = this.qChild('chbFirstArtist').controlClass.checked;

    let sett = mediaSyncDevices.getCustomSettings(device);    
    sett.forceReSync = this.qChild('chbForceResync').controlClass.checked;
    mediaSyncDevices.setCustomSettings(device, sett);
}
