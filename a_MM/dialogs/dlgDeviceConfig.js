/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

function init(params) {
    let wnd = this;
    wnd.resizeable = true;
    wnd.title = params.device.name + ' ' + _('Sync settings');

    let devConfigClass = qid('deviceConfig').controlClass;
    devConfigClass.contentSelectionMode = params.contentSelectionMode;
    devConfigClass.dataSource = params.device;

    if (params.enableScanCheckbox) {
        let chbScanToLib = devConfigClass.qChild('chbScanToLib');
        chbScanToLib.controlClass.checked = true;
        devConfigClass.qChild('chbDwlToLib').controlClass.disabled = false;
        devConfigClass.qChild('boxScan').controlClass.disabled = false;    
    }

    window.localListen(qid('btnOK'), 'click', function () {
        devConfigClass.save();
        modalResult = 1;
        closeWindow();
    });

    /* removed per #14907
    app.listen(qid('btnSyncNow'), 'click', function () {
        window.uitools.syncDevice(devConfigClass.dataSource);
    });
    */
}
