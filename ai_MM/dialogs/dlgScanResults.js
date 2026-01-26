/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

requirejs("controls/gridview");
requirejs("controls/columntracklist");

let tracks = null;

function init(params) {

    title = _('Scan results');
    resizeable = false;

    let pnlResults = qid('pnlResults');

    function addResultLine(par, txt, link, linkType, addLibrarySettingsLink) {

        let div = document.createElement('div');
        div.classList.add('flex');
        div.classList.add('row');
        div.classList.add('uiRow');
        par.appendChild(div);

        let lbl = document.createElement('label');
        lbl.innerText = txt;
        if (link) {
            lbl.classList.add('hotlink');
            window.localListen(lbl, 'click', () => {
                let emptyList = newStringList();
                if (linkType == 'imported')
                    app.filesystem.showScanLog(params.scanInfo.ImportedFiles, emptyList, emptyList, emptyList);
                else
                if (linkType == 'updated')
                    app.filesystem.showScanLog(emptyList, emptyList, params.scanInfo.UpdatedFiles, emptyList);
                else
                if (linkType == 'failed')
                    app.filesystem.showScanLog(emptyList, params.scanInfo.FailedFiles, emptyList, emptyList);
                else
                if (linkType == 'skipped')
                    app.filesystem.showScanLog(emptyList, emptyList, emptyList, params.scanInfo.SkippedFiles);              
            });            
        }
        div.appendChild(lbl);

        if (addLibrarySettingsLink) {
            let lblLeftBracket = document.createElement('label');
            lblLeftBracket.innerText = ' (' + _('filtered or disabled in') + ' ';
            lblLeftBracket.classList.add('noLeftPadding');   
            div.appendChild(lblLeftBracket);

            let lblLibLink = document.createElement('label');
            lblLibLink.innerText = _('Library settings');
            lblLibLink.classList.add('hotlink');
            lblLibLink.classList.add('inline');
            lblLibLink.classList.add('noLeftPadding');
            lblLibLink.classList.add('noRightPadding');
            window.localListen(lblLibLink, 'click', () => {
                uitools.showOptions('pnl_Library');
            }); 
            div.appendChild(lblLibLink);

            let lblRightBracket = document.createElement('label');
            lblRightBracket.innerText = ')';
            lblRightBracket.classList.add('noLeftPadding');
            div.appendChild(lblRightBracket);
        }
    };

    if (params.filesInLib)
        addResultLine(pnlResults, sprintf(_('Library now has %d files'), params.filesInLib));
    if (params.scanInfo.ScanTime)
        addResultLine(pnlResults, sprintf(_('Search and update took %s'), params.scanInfo.ScanTime));
    addResultLine(pnlResults, sprintf(_('Added %d new files'), params.scanInfo.ImportedFiles.count), (params.scanInfo.ImportedFiles.count > 0), 'imported');
    addResultLine(pnlResults, sprintf(_('Updated %d files'), params.scanInfo.UpdatedFiles.count), (params.scanInfo.UpdatedFiles.count > 0), 'updated');
    addResultLine(pnlResults, sprintf(_('Failed to add %d files'), params.scanInfo.FailedFiles.count), (params.scanInfo.FailedFiles.count > 0), 'failed');
    addResultLine(pnlResults, sprintf(_('Skipped %d files'), params.scanInfo.SkippedFiles.count), (params.scanInfo.SkippedFiles.count > 0), 'skipped', true);
    initializeControls(pnlResults);

    setVisibility(qid('btnLog'), params.scanInfo.ImportedFiles.count ||
        params.scanInfo.FailedFiles.count ||
        params.scanInfo.UpdatedFiles.count ||
        params.scanInfo.SkippedFiles.count);

    window.localListen(qid('btnLog'), 'click', function () {
        app.filesystem.showScanLog(params.scanInfo.ImportedFiles, params.scanInfo.FailedFiles,
            params.scanInfo.UpdatedFiles, params.scanInfo.SkippedFiles);
    });

    window.localListen(qid('btnClose'), 'click', function () {
        let sett = window.settings.get();
        sett.Confirmations.ConfirmScanResults = !qid('chbConfirmScanResults').controlClass.checked;
        window.settings.set(sett);

        closeWindow();
    });
}

window.windowCleanup = function () {
    tracks = null;
}