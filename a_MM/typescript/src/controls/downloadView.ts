registerFileImport('controls/downloadView');

'use strict';

import GridView from './gridview';

/**
@module UI
*/


/**
UI DownloadView element

@class DownloadView
@constructor
@extends GridView
*/

class DownloadView extends GridView {
    defaultColumns: any[];
    checkRefresh: procedure;

    initialize(rootelem, params) {
        super.initialize(rootelem, params);

        this.multiselect = true;
        this.showHeader = true;

        let downloader = app.downloader;

        this.contextMenu = new Menu([
            {
                title: function () {
                    return _('Resume');
                },
                icon: 'download',
                /*
                disabled: function () {
                    let item = this.focusedItem;
                    if (item)
                        return downloader.inProgressDownload(item);
                    else
                        return true;
                }.bind(this),
                */
                execute: function () {
                    let selItems = this.dataSource.getSelectedList();
                    let firstFile = true;
                    selItems.whenLoaded().then(function () {
                        selItems.forEach(function (item) {
                            downloader.resumeDownload(item, firstFile /* start immediatelly */);
                            firstFile = false;
                        });
                    });
                }.bind(this)
            }, {
                title: function () {
                    return _('Pause');
                },
                icon: 'pause',
                /*
                disabled: function () {
                    let item = this.focusedItem;
                    if (item && item.pauseIsPossible)
                        return !downloader.inProgressDownload(this.focusedItem);
                    else
                        return true;
                }.bind(this),
                */
                execute: function () {
                    let selItems = this.dataSource.getSelectedList();
                    selItems.whenLoaded().then(function () {
                        selItems.forEach(function (item) {
                            downloader.pauseDownload(item);
                        });
                    });
                }.bind(this)
            }, {
                title: function () {
                    return _('Cancel');
                },
                icon: 'delete',
                execute: function () {
                    let ds = this.dataSource;
                    let selItems = ds.getSelectedList();
                    selItems.whenLoaded().then(function () {
                        downloader.cancelDownloads(selItems);
                    });
                }.bind(this)
            }]);

        this.defaultColumns = [];
        this.defaultColumns.push({
            width: 150,
            title: function () {
                return _('Status');
            },
            setupCell: GridView.prototype.cellSetups.setupProgress,
            bindData: function (div, item, index) {
                let text = '';
                let percent = 0;
                let ratio = 0;
                if (item.bytesTotal > 0) {
                    ratio = (item.bytesDownloaded / item.bytesTotal);
                    percent = Math.round(100 * ratio);
                    percent = Math.max(percent, 0);
                }
                if (item.completed)
                    text = _('Completed');
                else
                if (item.queued)
                    text = _('Queued');
                else {
                    text = percent + ' %' + ',  ';
                    if (!downloader.inProgressDownload(item))
                        text = text + _('Paused');
                    else
                        text = text + (item.transferRateKBs * 8) + ' ' + _('kbps');
                }
                div.controlClass.text = text;
                div.controlClass.value = ratio;
            }
        });
        this.defaultColumns.push({
            width: 150,
            title: function () {
                return _('Title');
            },
            bindData: function (div, item, index) {
                div.innerText = item.title;
            }
        });
        this.defaultColumns.push({
            width: 150,
            title: function () {
                return _('Album');
            },
            bindData: function (div, item, index) {
                div.innerText = item.album;
            }
        });
        this.defaultColumns.push({
            width: 150,
            title: function () {
                return _('Artist');
            },
            bindData: function (div, item, index) {
                div.innerText = item.artist;
            }
        });
        this.defaultColumns.push({
            width: 100,
            title: function () {
                return _('Size');
            },
            bindData: function (div, item, index) {
                div.innerText = formatFileSize(item.bytesTotal);
            }
        });
        this.defaultColumns.push({
            width: 200,
            title: function () {
                return _('URL');
            },
            bindData: function (div, item, index) {
                div.innerText = item.source;
            }
        });
        this.defaultColumns.push({
            width: 300,
            title: function () {
                return _('Destination');
            },
            bindData: function (div, item, index) {
                div.innerText = item.destination;
            }
        });
        this.defaultColumns.push({
            width: 100,
            title: function () {
                return _('Genre');
            },
            bindData: function (div, item, index) {
                div.innerText = item.genre;
            }
        });
        this.setColumns(this.defaultColumns);

        this.dataSource = downloader.itemList;

        this.checkRefresh = function () {
            setTimeout(function () {
                if (downloader.anyDownloadInProgress())
                    this.invalidateAll();
                this.checkRefresh();
            }.bind(this), 1000);
        }.bind(this);
        this.checkRefresh();
    }

    cleanUp() {
        this.checkRefresh = function () {};
        super.cleanUp();
    }
    
}
registerClass(DownloadView);
