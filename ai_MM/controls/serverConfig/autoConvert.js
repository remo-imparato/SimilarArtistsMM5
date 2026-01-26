/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

ServerConfig.prototype.tabs.autoConvert.load = function () {
    this.qChild('autoConvertConfig').controlClass.initStrings({
        headings: _('Convert the following formats when playing remotely') + ' (UPnP/DLNA)',
        sourceFormat: _('Format on PC'),
        targetFormat: _('Streaming format'),
        supportedFormats: _('Supported formats on UPnP/DLNA clients'),
        levelVolumeText: _('Level volume when sharing audio')
    });
    this.qChild('autoConvertConfig').controlClass.dataSource = this.server.autoConvertConfig;
};

ServerConfig.prototype.tabs.autoConvert.save = function () {
    this.server.autoConvertConfig = this.qChild('autoConvertConfig').controlClass.dataSource;
};
