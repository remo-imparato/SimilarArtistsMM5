/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

DeviceConfig.prototype.tabs.options.panels.pnl_AutoConversion.load = function (device, reload) {
    var conf = this.qChild('autoConvertConfig')
    conf.controlClass.initStrings({
        headings: sprintf(_('Convert the following formats when syncing to \'%s\''), device.name),
        sourceFormat: _('Format in Library'),
        targetFormat: _('Format on the target'),
        supportedFormats: sprintf(_('Supported formats on \'%s\''), device.name),
        levelVolumeText: _('Level volume when syncing audio')
    });
    conf.controlClass.dataSource = device.autoConvertConfig;

    this.dataSourceListen(conf, 'change', () => {
        device.calculator.updateAutoConversion(conf.controlClass.dataSource);
    });
}

DeviceConfig.prototype.tabs.options.panels.pnl_AutoConversion.save = function (device) {
    device.autoConvertConfig = this.qChild('autoConvertConfig').controlClass.dataSource;
}
