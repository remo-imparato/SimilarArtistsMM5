/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

ClientConfig.prototype.tabs.autoConvert.load = function () {
    this.qChild('autoConvertConfig').controlClass.initStrings({
        headings: sprintf(_('Convert the following formats when playing %s content remotely'), '\'' + this.client.server.name + '\''),
        sourceFormat: _('Format on PC'),
        targetFormat: _('Streaming format'),
        supportedFormats: sprintf(_('Supported formats on \'%s\''), [this.client.name]),
        levelVolumeText: _('Level volume when sharing audio')
    });
    var autoConvertConfig = this.qChild('autoConvertConfig');
    autoConvertConfig.controlClass.dataSource = this.client.autoConvertConfig;

    var chb = this.qChild('chbCustomizeConversion');
    chb.controlClass.checked = this.client.customizeConversion;
    bindDisabled2Checkbox(autoConvertConfig, chb);
};

ClientConfig.prototype.tabs.autoConvert.save = function () {
    this.client.customizeConversion = this.qChild('chbCustomizeConversion').controlClass.checked;
    this.client.autoConvertConfig = this.qChild('autoConvertConfig').controlClass.dataSource;
};
