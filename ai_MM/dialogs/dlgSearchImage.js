/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

requirejs('controls/listview');
requirejs('controls/popupmenu');
requirejs('helpers/searchTools');
requirejs('controls/toastMessage');
requirejs('uitools');

let searchTerm1;
let searchTerm2;
let scriptInterface;
let data = newStringList();
let iSearch;
let lvImages;
let artworkLinks = [];
let selectedObjs = undefined;
let initBrowsePath;
let multiselect = false;

function init(params) {
    title = _('Image search');
    //    resizeable = false;
    window.noAutoSize = true; // disable auto sizing mechanism, we have fixed size

    searchTerm1 = params.searchTerm1;
    searchTerm2 = params.searchTerm2;
    multiselect = !!params.multiselect;
    initBrowsePath = params.initBrowsePath || '';
    let scriptInterface = searchTools.getInterface(params.searchScript);

    scriptInterface.showResult = function (artworkLink, thumbLink, w, h, tw, th, src, srclink, filesize) {
        if (artworkLink) {
            let obj = {
                artworkLink: artworkLink,
                thumbLink: thumbLink,
                width: w,
                height: h,
                thumbWidth: tw,
                thumbHeight: th,
                source: src,
                sourcelink: srclink,
                filesize: filesize
            };
            artworkLinks.push(obj);
        }
    };

    let toastMessageCtrl = undefined;
    let applyBtn = qid('btnApply');
    let btnSearch = qid('btnSearch');
    btnSearch.controlClass.disabled = false;

    let beforeImageDownload = function (lnk) {
        applyBtn.controlClass.disabled = true;
        btnSearch.controlClass.disabled = true;
        toastMessageCtrl = uitools.toastMessage;
        let msg = ''
        if (lnk)
            msg = ' ' + lnk;
        toastMessageCtrl.show(_('Getting') + ' ' + _('image') + msg, {
            delay: 60000,
            disableClose: true
        });
    };

    let afterImageDownload = function () {
        if (!window._cleanUpCalled) {
            if (toastMessageCtrl)
                toastMessageCtrl.finish(true, true);
            applyBtn.controlClass.disabled = false;
            btnSearch.controlClass.disabled = false;
        }
    };

    let closeDialogOK = function () {
        if (applyBtn.controlClass.disabled)
            return;
        if (!selectedObjs) {
            selectedObjs = [];
            let ds = lvImages.controlClass.dataSource;
            ds.locked(function () {
                if (ds.count) {
                    fastForEach(ds, function (item, idx) {
                        if (ds.isSelected(idx))
                            selectedObjs.push(artworkLinks[idx]);
                    });
                }
            }.bind(this))
        };

        if (!selectedObjs || (selectedObjs.length === 0)) {
            selectedObjs = undefined;
            return;
        }

        if (!multiselect || (selectedObjs.length === 1)) {
            let artworkLink = selectedObjs[0].artworkLink;
            let thumbLink = selectedObjs[0].thumbLink;
            if (artworkLink !== undefined) {
                if ((artworkLink === '-') || (artworkLink === '')) {
                    // default icon or generated choosed
                    if (params.callback)
                        params.callback(artworkLink);
                    modalResult = 1;
                } else if (!isURLPath(artworkLink) || params.dontDownloadLink) {
                    // local file choosed
                    if (params.callback)
                        params.callback(artworkLink);
                    modalResult = 1;
                } else {
                    if (params.beforeImageDownload)
                        params.beforeImageDownload(artworkLink);
                    beforeImageDownload(artworkLink);
                    window.localPromise(app.utils.saveImageAsync(artworkLink)).then(function (cachedImgPath) {
                        if (cachedImgPath && (cachedImgPath !== -1)) {
                            if (params.afterImageDownload)
                                params.afterImageDownload(artworkLink);
                            afterImageDownload();
                            if (params.callback) {
                                params.callback(cachedImgPath, true /* isInTemp */ );
                                modalResult = 1;
                            }
                        } else if (!window._cleanUpCalled) {
                            //afterImageDownload(); // close old message and enable apply button
                            uitools.toastMessage.show(_('Image download failed'), {
                                delay: 5000
                            });
                            // update info about original image - change size to thumb size only
                            if (selectedObjs[0]) {
                                selectedObjs[0].artworkLink = selectedObjs[0].thumbLink;
                                selectedObjs[0].width = selectedObjs[0].thumbWidth;
                                selectedObjs[0].height = selectedObjs[0].thumbHeight;
                                lvImages.controlClass.rebind();
                            }
                            applyBtn.controlClass.disabled = false;
                        }
                    });
                };
            }
        } else {
            // multiselect allowed only from disk now (to avoid problems with handling, when something cannot be downloaded)
            let retarr = selectedObjs.map((o) => (o.artworkLink));
            if (params.callback)
                params.callback(retarr);
            modalResult = 1;
        }
    };
    lvImages = qid('lvImages');
    let searchingPlaceholder = qid('searchingPlaceholder');
    lvImages.controlClass.dataSource = data;
    iSearch = qid('iSearch');
    iSearch.controlClass.value = scriptInterface.defaultSearchPhrase(searchTerm1, searchTerm2);
    window.localListen(iSearch, 'keydown', function (evt) {
        if (friendlyKeyName(evt) === 'Enter') {
            evt.stopPropagation();
            evt.preventDefault();
            beginSearch(true);
        }
    }, true);

    let isSearching = false;

    let cancelSearch = function () {
        if (isSearching) {
            if (scriptInterface.cancelSearch)
                scriptInterface.cancelSearch();
            isSearching = false;
            setVisibility(lvImages, false);
            setVisibility(searchingPlaceholder, false);
            data.clear();
            artworkLinks = [];
        }
    };

    window.localListen(iSearch, 'change', function (evt) {
        evt.stopPropagation();
        ODS('--- change text');
        cancelSearch();
    });


    scriptInterface.endSearch = function () {
        if (window._cleanUpCalled)
            return;
        setVisibility(lvImages, true);
        setVisibility(searchingPlaceholder, false);
        isSearching = false;
        data.beginUpdate();
        forEach(artworkLinks, function (obj) {
            data.add(obj.thumbLink);
        });
        data.endUpdate();
        btnSearch.controlClass.disabled = false;
    };
    let beginSearch = function (useCustomSearch) {
        cancelSearch();
        data.clear();
        artworkLinks = [];
        setVisibility(lvImages, false);
        setVisibility(searchingPlaceholder, true);
        isSearching = true;
        if (useCustomSearch)
            scriptInterface.startCustomSearch(iSearch.controlClass.value);
        else
            scriptInterface.startSearch(searchTerm1, searchTerm2, params);
    };
    beginSearch();
    window.localListen(btnSearch, 'click', function () {
        beginSearch(true);
    });
    window.localListen(applyBtn, 'click', closeDialogOK);
    window.localListen(lvImages, 'itemdblclick', closeDialogOK);
    window.localListen(lvImages, 'itementer', closeDialogOK);

    let defaultIconBtn = qid('btnDefaultIcon');
    if (params.noDefaultIcon) {
        setVisibilityFast(defaultIconBtn, false);
    } else {
        window.localListen(defaultIconBtn, 'click', function () {
            selectedObjs = [{
                artworkLink: '-',
                thumbLink: '-',
                width: 0,
                height: 0
            }];
            closeDialogOK();
        });
    };
    let btnGenerated = qid('btnGenerated');
    if (params.noGenerated) {
        setVisibilityFast(btnGenerated, false);
    } else {
        window.localListen(btnGenerated, 'click', function () {
            selectedObjs = [{
                artworkLink: '',
                thumbLink: '',
                width: 0,
                height: 0
            }];
            closeDialogOK();
        });
    };
    let btnBrowse = qid('btnBrowse');
    if (params.noBrowse) {
        setVisibilityFast(btnBrowse, false);
    } else {
        window.localListen(btnBrowse, 'click', function () {
            let promise = app.utils.dialogOpenFile(initBrowsePath, 'jpg', 'Image files (*.jpg, *.png, *.bmp, *.gif, *.thm)|*.jpg;*.jpeg;*.png;*.bmp;*.gif;*.thm|All files (*.*)|*.*', _('Select image files'), multiselect);
            window.localPromise(promise).then(function (filenames) {
                selectedObjs = [];
                if (multiselect) {
                    if (filenames && (filenames.count > 0)) {
                        filenames.locked(function () {
                            fastForEach(filenames, function (item, index) {
                                selectedObjs.push({
                                    artworkLink: item.toString()
                                });
                            });
                        });
                        closeDialogOK();
                    }
                } else if (filenames) {
                    selectedObjs.push({
                        artworkLink: filenames
                    });
                    closeDialogOK();
                }
            });
        });
    }
};

class SimpleImageGrid extends ListView {

    initialize(rootelem, params) {
        super.initialize(rootelem, params);

        this.isGrid = true;
        this.isGrouped = false;
        this.showHeader = false;
        this.isSearchable = false;
        this.multiselect = false;
        let _this = this;

        this.addToContextMenu([
            {
                action: {
                    title: _('Show full size'),
                    visible: function () {
                        let index = _this.focusedIndex;
                        if ((index < 0) || !_this.dataSource)
                            return false;
                        return true;
                    },
                    execute: function () {
                        _this.showFullSizeImage();
                    }
                },
                order: 10,
                grouporder: 10
        }]);
    }

    setUpDiv(div) {
        if (!div.cloned) {
            div.classList.add('gridItemSquare');
            div.classList.add('imageItem');
            div.innerHTML =
                '<div class="fill gridItemInner imageSquare">' +
                '  <div class="fill padding">' +
                '    <img data-id="artwork" class="allinside box autoMargin ignoreMouse autosize" />' +
                '  </div><label data-id="sizeLbl" class="sizeLabel clickable" data-tip="Click to show full size"></label>' +
                '</div>';
        }
        div.artwork = qe(div, '[data-id=artwork]');
        div.sizeLabel = qe(div, '[data-id=sizeLbl]');
        div.artwork.src = '';
        div.sizeLabel.textContent = '';
        this.localListen(div.sizeLabel, 'click', function (e) {
            this.showFullSizeImage();
        }.bind(this));
    }

    bindData(div, index) {
        this._item = this.dataSource.getFastObject(index, this._item);
        div.artwork.src = '';
        div.artwork.src = this._item;
        let aObj = artworkLinks[index];
        if (aObj) {
            if (aObj.width && aObj.height) {
                if(aObj.filesize) {
                    div.sizeLabel.textContent = aObj.width + 'x' + aObj.height + ' (' + aObj.filesize + ')';
                } else {
                    div.sizeLabel.textContent = aObj.width + 'x' + aObj.height;
                }
                if(aObj.source && aObj.sourcelink) {
                    aObj.sourcelink = _utils.cleanAndValidateURL(aObj.sourcelink);
                    if(aObj.sourcelink)
                        div.sizeLabel.innerHTML = aObj.width + 'x' + aObj.height + '<br/>' + '<span data-id="dataSrc" data-tip="'+ _('Data provided by') + ' ' + aObj.source + '" onclick="event.stopPropagation(); app.utils.web.openURL(\'' + aObj.sourcelink + '\');">' + aObj.source + '</span>';
                }
            }
            else if (aObj.source) {
                div.sizeLabel.textContent = aObj.source;
            }
        };
    }

    showFullSizeImage() {
        let index = this.focusedIndex;
        if (this._fetchingIndex === index) {
            return; // already opening this image
        }
        if (index < 0)
            return;
        let aObj = artworkLinks[index];
        if (aObj) {
            this._fetchingIndex = index;
            this.localPromise(app.utils.saveImageAsync(aObj.artworkLink)).then(function (cachedImgPath) {
                if (index !== this.focusedIndex) {
                    // focus changed, delete and exit
                    if (cachedImgPath && (cachedImgPath !== -1)) {
                        app.filesystem.deleteFileAsync(cachedImgPath);
                    }
                    this._fetchingIndex = undefined;
                    return;
                }
                if (cachedImgPath && (cachedImgPath !== -1)) {
                    let dataObject = {
                        getThumbAsync: function (w, h, cbk) {
                            cbk(
                                encodeURIComponent(cachedImgPath)
                                    .replace(/%2F/g, '/')   // /
                                    .replace(/%5C/g, '\\')  // \
                                    .replace(/%3A/g, ':')   // :
                            );
                        }
                    };
                    let dlg = uitools.openDialog('dlgArtworkDetail', {
                        modal: true,
                        dataObject: dataObject,
                        imgPath: aObj.thumbLink
                    });
                    dlg.whenClosed = function () {
                        app.filesystem.deleteFileAsync(cachedImgPath);
                        this._fetchingIndex = undefined;
                    }.bind(this);
                    this.localListen(dlg, 'closed', dlg.whenClosed);
                } else {
                    this._fetchingIndex = undefined;
                    // downloading original image failed
                    uitools.toastMessage.show(_('Image download failed'), {
                        delay: 5000
                    });
                }
            }.bind(this), function () {
                this._fetchingIndex = undefined;
            }.bind(this));
        };

    }

    canDrop(e) {
        return false;
    }
}
registerClass(SimpleImageGrid);

window.windowCleanup = function () {
    scriptInterface = undefined;
    data = undefined;
    iSearch = undefined;
    lvImages = undefined;
    artworkLinks = undefined;
    selectedObjs = undefined;
}