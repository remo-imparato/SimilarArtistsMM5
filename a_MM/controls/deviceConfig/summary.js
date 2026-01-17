/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";
requirejs('helpers/mediaSync');

DeviceConfig.prototype.tabs.summary.load = function (reload) {

    var lblName = this.qChild('lblName');
    lblName.textContent = this.device.name;
    lblName.controlClass.editable = mediaSyncDevices.isFieldEditable(this.device, 'name');
    if (!this.device.enabled)
        lblName.setAttribute('data-disabled', '1');
    else
        lblName.removeAttribute('data-disabled');

    this.dataSourceListen(lblName, 'change', () => {        
        if (this.device.name != lblName.textContent) {
            this.device.name = lblName.textContent; // LS: previously lbl.innerText was here, but it is empty string when [Apply] is hit on another tab (i.e. when a parent node is invisible)    
            this.device.updateDriveLabelAsync(); // #18158
            this.device.commitAsync(); // #21490          
        }
    });

    var _this = this;

    var img = this.qChild('imgDeviceSummary');
    var ico = this.qChild('icnDeviceSummary');

    function updateImage() {
        _this.dataSourcePromise(app.filesystem.fileExistsAsync(_this.device.imagePath)).then((exists) => {
            if (exists) {
                setVisibilityFast(img, true);
                setVisibilityFast(ico, false);
                img.src = _this.device.imagePath;
            } else {
                ico.controlClass.icon = mediaSyncDevices.getIcon(_this.device);
                setVisibilityFast(ico, true);
                setVisibilityFast(img, false);
            }
        });
    }
    updateImage();

    var lblLastSynced = this.qChild('lblLastSynced');
    var updateStatus = function (device) {
        lblLastSynced.innerText = mediaSyncDevices.getStatus(device);
    }
    updateStatus(this.device);

    var btnMenu = this.qChild('btnMenu');
    btnMenu.controlClass.menuArray = nodeHandlers.device.menu({
        dataSource: this.device
    });

    var lblCapacity = this.qChild('lblCapacity');
    var lblAvailSpace = this.qChild('lblAvailSpace');
    if (!this.device.enabled) {
        lblCapacity.setAttribute('data-disabled', '1');
        lblAvailSpace.setAttribute('data-disabled', '1');
    } else {
        lblCapacity.removeAttribute('data-disabled');
        lblAvailSpace.removeAttribute('data-disabled');
    }
    var capacityInfoFn = function () {
        var info = _this.device.calculator.sizeInfo;
        setVisibility(lblCapacity, info.capacity > 0);
        setVisibility(lblAvailSpace, info.availSpace > 0);
        lblCapacity.innerText = _('Capacity') + ': ' + formatFileSize(info.capacity);
        lblAvailSpace.innerText = _('Free') + ': ' + formatFileSize(info.availSpace);
    };
    this.dataSourceListen(this.device.calculator, 'change', capacityInfoFn);
    capacityInfoFn();

    if (this.viewData) {
        var contentView = this.qChild('deviceContentView');
        contentView.controlClass.prepareDatasource(this.viewData.viewNode);
        viewHandlers.nodeList.registerActions(contentView, this.viewData);

        this.dataSourceListen(this.device, 'change', (oper) => {

            if (oper == 'connected' || oper == 'disconnected') {
                // when device was just (dis)connected
                var node = this.viewData.viewNode;
                node.clear();
                contentView.controlClass.prepareDatasource(node);
            }

            if (oper == 'enabled' || oper == 'disabled') {
                uitools.refreshView(); // to update the summary options box disabled state (#18816)
            }

            // when device was just synced
            updateStatus(this.device);

            if (oper == 'title') {
                // when device was just renamed (e.g. in media tree)
                lblName.textContent = this.device.name;
                uitools.refreshView(500); // #18611
            }

            updateImage();
        });
    }

    // clean custom boxes utilized via mediaSyncHandlers:
    function rm(e) {
        var ec;
        while (ec = e.firstChild) {
            rm(ec); // call on all descendants at first (in order to not leak)
            removeElement(ec);
        }
    };
    rm(this.qChild('summaryHeadingBox'));
    rm(this.qChild('summaryOptionsBox'));

    var summaryOptionsBoxCls = this.qChild('summaryOptionsBox').controlClass;
    summaryOptionsBoxCls.requestFrame(() => {
        summaryOptionsBoxCls.disabled = !this.device.enabled;
    });

    // some mediaSyncHandlers hides the following, se re-show it for the other handlers
    setVisibility(this.qChild('deviceContentView'), true);
    setVisibility(this.qChild('middleSeparator'), true);
};