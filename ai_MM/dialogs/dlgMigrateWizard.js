/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

function init(params) {
    let wnd = this;
    wnd.resizeable = true;
    title = _('Migration Wizard');

    window.localPromise(app.db.getQueryResultAsync('SELECT count(*) FROM Songs')).then((results) => {
        let totalTracks = results.fields.getValue(0);

        let device = params.device;
        let syncHandler = mediaSyncHandlers[device.handlerID];

        qid('lblHeading').textContent = sprintf(_('A %s was detected. It can be used to store and share portions of your library with multiple MediaMonkey clients even if this instance of MediaMonkey isn\'t running. Content on the MediaMonkey Server can be managed and accessed via MediaMonkey as if the content were local, as long as the server is accessible. If not, content can be cached locally.'), device.name);

        let sett = mediaSyncDevices.getCustomSettings(device);

        if (totalTracks > 0) {

            setVisibility(qid('boxMigrate'), true);
            setVisibility(qid('boxScan'), false);

            qid('lblSubHeading').textContent = sprintf(_('By default, this wizard migrates all MediaMonkey data and content to the %s'), device.name);
            qid('chbCacheContent').controlClass.text = sprintf(_('Retain local cache of %s content'), device.name);

            let contentCustomized;            

            let syncList;
            let summaryBox = qid('summaryBox');
            let chbCacheContent = qid('chbCacheContent');
            chbCacheContent.controlClass.checked = !sett.deleteAfterUpload;
            window.localListen(chbCacheContent, 'click', () => {
                sett.deleteAfterUpload = !chbCacheContent.controlClass.checked;
                updateSummary();
            });

            let link = qid('linkSetContent');
            link.textContent = sprintf(_('Fine-tune which content to store on %s...'), device.name);
            setVisibility(link, (totalTracks > 0));
            window.localListen(link, 'click', () => {
                device.calculator.clear();
                window.localPromise(syncHandler._showContentSelectionDlg(device)).then((modalResult) => {
                    device.calculator.mode = 'migration';
                    if (modalResult == 1) {
                        contentCustomized = true;
                        sett = mediaSyncDevices.getCustomSettings(device);
                        chbCacheContent.controlClass.checked = sett.deleteAfterUpload;
                    } else
                    if (!contentCustomized)
                        device.calculator.setPreSelectedItems(syncList);
                });
            });

            let defaultDirectories = {
                audio: '',
                video: ''
            }

            let addSummaryRow = (rowHtml) => {
                if (summaryBox.innerHTML)
                    summaryBox.innerHTML = summaryBox.innerHTML + '<br>' + rowHtml;
                else
                    summaryBox.innerHTML = rowHtml;
            }

            let updateSummary = () => {

                if (window._cleanUpCalled)
                    return;

                let list = device.calculator.sizeInfo.locationList.getCopy();
                let sampleTracks = [];
                listForEach(list, (info) => {
                    sampleTracks.push({
                        needUpload: true,
                        track: info.sampleTrack
                    });
                });

                let getFilesTxt = (count) => {
                    if (count > 1)
                        return '(' + count + ' ' + _('files') + ')';
                    else
                        return '(' + count + ' ' + _('file') + ')';
                }

                let updateStatus = (showServerCheckingText) => {
                    if (window._cleanUpCalled)
                        return;
                    qid('summaryBox').innerHTML = '';
                    let uploadNeeded = false;
                    listForEach(list, (info, i) => {
                        let domain = info.domain;
                        if (domain == 'cloud')
                            domain = _('Cloud');
                        if (sampleTracks[i].needUpload) {
                            uploadNeeded = true;

                            if (sett.deleteAfterUpload && (info.domain != 'cloud')) {
                                if (info.audioCount > 0)
                                    addSummaryRow(sprintf(_('%s will be moved to %s (%s)'), domain + ' ' + getFilesTxt(info.audioCount), device.name, defaultDirectories.audio));
                                if (info.videoCount > 0)
                                    addSummaryRow(sprintf(_('%s will be moved to %s (%s)'), domain + ' ' + getFilesTxt(info.videoCount), device.name, defaultDirectories.video));
                            } else {
                                if (info.audioCount > 0)
                                    addSummaryRow(sprintf(_('%s will be copied to %s (%s)'), domain + ' ' + getFilesTxt(info.audioCount), device.name, defaultDirectories.audio));
                                if (info.videoCount > 0)
                                    addSummaryRow(sprintf(_('%s will be copied to %s (%s)'), domain + ' ' + getFilesTxt(info.videoCount), device.name, defaultDirectories.video));
                            }
                        } else
                            addSummaryRow(sprintf(_('%s will be scanned and shared via %s'), domain + ' ' + getFilesTxt(info.audioCount + info.videoCount), device.name));
                    });
                    setVisibilityFast(chbCacheContent, uploadNeeded);
                    if (showServerCheckingText)
                        addSummaryRow(_('Checking for files on the server') + '...');
                }
                updateStatus(true);

                window.localPromise(syncHandler._getServer(device)).then(() => { // this will force also the 'Sign in' dialog (if needed)                    
                    window.localPromise(syncHandler._checkTracksNeedUpload(new MediaSync(device), sampleTracks, true /* justCheckAccess */ )).then(() => {
                        updateStatus(false);
                    });
                }, (err) => {
                    if (!window._cleanUpCalled) {
                        qid('summaryBox').innerHTML = '';
                        addSummaryRow(_('Server error') + ': ' + err);
                    }
                });

            }
            window.localListen(device.calculator, 'change', updateSummary);
            device.calculator.mode = 'migration';

            // create default sync list (all collections + playlists)
            window.localPromise(app.collections.getCollectionListAsync({
                includeEntireLibrary: false
            })).then(function (collections) {
                syncList = app.utils.createSharedList();
                listForEach(collections, (coll) => {
                    syncList.add(coll);
                });
                syncList.add(app.playlists.root);
                syncList.setAllChecked(true);
                syncList.notifyLoaded();
                device.calculator.setPreSelectedItems(syncList);
            });

            window.localPromise(syncHandler.getStorageInfo(device)).then((info) => {
                if (info.defaultDirectories)
                    defaultDirectories = info.defaultDirectories;
            });

        } else {
            setVisibility(qid('boxScan'), true);
            setVisibility(qid('boxMigrate'), false);
            setVisibility(qid('chbCacheContent'), false);
            qid('chbScan').controlClass.text = sprintf(_('Scan \'%s\' content to the local database'), device.name);
            qid('chbScan').controlClass.checked = true; // pre-selected
        }

        window.localListen(qid('btnOk'), 'click', () => {

            let scanToLib = true;
            if (totalTracks > 0) {
                mediaSyncDevices.setCustomSettings(device, sett); // to store the deleteAfterUpload state 
                if (!contentCustomized)
                    device.setSyncedObjects(syncList);
            } else {
                scanToLib = qid('chbScan').controlClass.checked;
            }

            let handler = mediaSyncHandlers[device.handlerID];
            mediaSyncDevices.changeLibraryScanSettings(device, {
                scanToLib: scanToLib,
                scan_interval_ms: handler._scan_intervals()[0],
                downloadToLib: false
            });
            modalResult = 1;
            closeWindow();
        });
    });
}
