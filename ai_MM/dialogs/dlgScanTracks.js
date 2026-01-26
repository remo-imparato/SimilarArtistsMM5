/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

var optionPanels = {
    pnlScan: {}
};

let gScanData = {};

function init(params) {

    if (params.title) {
        title = params.title;
    } else {
        title = _('Add/Rescan files to the Library...');
    }

    // load scan panel
    requirejs('file:///dialogs/dlgWizard/pnlScan.js');
    let div = qid('panel');
    div.innerHTML = loadFile('file:///dialogs/dlgWizard/pnlScan.html');
    initializeControls(div);

    optionPanels.pnlScan.load(params);

    if (params && params.showScanButton == false) {
        setVisibility(qid('btnCustomOptions'), false);
    } else {
        window.localListen(qid('btnCustomOptions'), 'click', function () {
            uitools.openDialog('dlgOptions', {
                modal: true,
                defaultPanel: 'pnl_Library',
            });
        });
    }

    if (params && params.showScanButton == false) {
        setVisibility(qid('btnScan'), false);
    } else {
        window.localListen(qid('btnScan'), 'click', function () {
            let data = optionPanels.pnlScan.save(params);
            gScanData = data;            
            app.filesystem.setLastScannedFolders(data.pathsToSave);
            app.filesystem.startAutoScanner(); // #17782
            modalResult = 1;
        }.bind(this));

        // following because of #17660
        qid('btnScan').controlClass.default = true;
        qid('btnSave').controlClass.default = false;
    }

    window.localListen(qid('btnSave'), 'click', function () {
        let data = optionPanels.pnlScan.save(params);
        gScanData = data;        
        app.filesystem.setLastScannedFolders(data.pathsToSave);
        app.filesystem.startAutoScanner(); // #17782
        modalResult = 2;
    }.bind(this));

    window.localListen(thisWindow, 'closed', function () {
        if (modalResult !== 1) {
            optionPanels.pnlScan.cancel(params);
        }
    });
}

function getScanData() {
    return gScanData;
}

function getPaths() {
    return gScanData.paths;
}

function getImporters() {
    return gScanData.importers;
}

function getServerContainers() {
    return gScanData.serverContainers;
}
