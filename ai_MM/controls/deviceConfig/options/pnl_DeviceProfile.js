/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

DeviceConfig.prototype.tabs.options.panels.pnl_DeviceProfile.load = function (device, reload) {

    var _this = this;
    if (!reload) {
        this.localListen(this.qChild('btnLookupDev'), 'click', function () {
            window.uitools.openWeb('https://www.mediamonkey.com/deviceprofiles');
        });
        addEnterAsClick(this, this.qChild('btnLookupDev'));

        this.localListen(this.qChild('btnImportDev'), 'click', function () {
            var promise = app.utils.dialogOpenFile( app.devices.getExportProfileFolder(), 'mmdc', _('MediaMonkey Device Configuration file (*.mmdc)|*.mmdc'), _('Select MediaMonkey Device Configuration file'));
            promise.then(function (filename) {
                if (filename != '') {
                    _this.device.loadFromProfileAsync(filename).then(() => {
                        _this.dataSource = _this.device; // to refresh the values in UI
                    });
                }
            });
        });
        addEnterAsClick(this, this.qChild('btnImportDev'));

        this.localListen(this.qChild('btnExportDev'), 'click', () => {

            var _doExport = () => {
                var promise = app.utils.dialogSaveFile( app.devices.getExportProfileFolder(), 'mmdc', _('MediaMonkey Device Configuration file (*.mmdc)|*.mmdc'), _('Save as'), _this.device.name);
                promise.then(function (filename) {
                    if (filename != '') {
                        _this.device.saveToProfileAsync(filename);
                    }
                });
            }

            if (this.unsavedChanges) {                
                this.showChangesConfirm(() => {
                    _doExport();
                });
            } else {
                _doExport();
            }            
        });
        addEnterAsClick(this, this.qChild('btnExportDev'));

        this.localListen(this.qChild('btnResetDev'), 'click', () => {
            this.device.resetProfileAsync().then(() => {
                var handler = mediaSyncHandlers[this.device.handlerID];
                var pr;
                if (handler.initProfileDefaults)
                    pr = handler.initProfileDefaults(this.device);
                if (pr && isPromise(pr))
                    pr.then1(() => {
                        this.dataSource = this.device; // to refresh the values in UI
                    });
                else
                    this.dataSource = this.device; // to refresh the values in UI
            });
        });
        addEnterAsClick(this, this.qChild('btnResetDev'));
    }

    var btnChooseImageDir = this.qChild('btnChooseImageDir');
    var edtImagePath = this.qChild('edtImagePath');
    edtImagePath.controlClass.value = device.imagePath;
    var ico = this.qChild('icnDevice');
    var img = this.qChild('imgDevice');
    img.src = device.imagePath;

    function updateImage() {
        if (edtImagePath.controlClass.value != '') {
            setVisibilityFast(img, true);
            setVisibilityFast(ico, false);
            img.src = edtImagePath.controlClass.value;
        } else {
            ico.controlClass.icon = mediaSyncDevices.getIcon(_this.device);
            setVisibilityFast(ico, true);
            setVisibilityFast(img, false);
        }
    }
    updateImage();

    var iconEditable = mediaSyncDevices.isFieldEditable(this.device, 'icon');
    btnChooseImageDir.controlClass.disabled = !iconEditable;
    edtImagePath.controlClass.disabled = !iconEditable;

    if (!reload) {
        this.localListen(btnChooseImageDir, 'click', function () {
            if (btnChooseImageDir.controlClass.disabled)
                return;
            var promise = app.utils.dialogOpenFile(edtImagePath.controlClass.value, 'jpg', 'Image files (*.jpg, *.png, *.bmp, *.gif)|*.jpg;*.jpeg;*.png;*.bmp;*.gif', _('Select image files'));
            promise.then(function (filename) {
                if (filename != '') {
                    edtImagePath.controlClass.value = filename;
                    var evt = createNewEvent('change');
                    edtImagePath.dispatchEvent(evt);
                    img.src = filename;
                    updateImage();
                }
            });
        });
        addEnterAsClick(this, btnChooseImageDir);
        this.localListen(edtImagePath, 'change', updateImage);
    }

}

DeviceConfig.prototype.tabs.options.panels.pnl_DeviceProfile.save = function (device) {
    device.imagePath = this.qChild('edtImagePath').controlClass.value;
    this.qChild('imgDevice').src = device.imagePath;
    if (device.imagePath != this.qChild('edtImagePath').controlClass.value) // #16825
        this.qChild('edtImagePath').controlClass.value = device.imagePath;

}
