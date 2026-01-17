/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

registerFileImport('controls/seriesViewHeader');
'use strict';
import { LINK_TVDB } from '../consts';
import Control from './control';
import Editable from './editable';
import ViewHeader from './viewHeader';
/**
@module UI
*/
/**
UI SeriesViewHeader element

@class SeriesViewHeader
@constructor
@extends ViewHeader
*/
class SeriesViewHeader extends ViewHeader {
    initialize(rootelem, params) {
        params = params || {};
        params.icon = params.icon || 'series';
        params.useCollage = false;
        params.descEditSupport = true;
        super.initialize(rootelem, params);
        let UI = this.UI;
        let _this = this;
        // add artist name to header
        UI.beforeDescriptionContainer.innerHTML =
            '  <div class="inline floatRight textRight paddingLeft">' +
                '    <span data-id="seasonCount" class="inline"></span><br/>' +
                '    <span data-id="seriesTotalTracks" class="inline"></span><br/>' +
                '    <span data-id="seriesTotalLength" class="inline"></span>' +
                '  </div>';
        UI.seasonCount = qeid(UI.beforeDescriptionContainer, 'seasonCount');
        UI.seriesTotalTracks = qeid(UI.beforeDescriptionContainer, 'seriesTotalTracks');
        UI.seriesTotalLength = qeid(UI.beforeDescriptionContainer, 'seriesTotalLength');
        //        UI.headerTitleParenthesis.classList.add('clickable');
        //        UI.headerTitleParenthesis.classList.add('hotlink');
        precompileBinding(this.container, this);
        /*        this.localListen(UI.headerTitleParenthesis, 'click', function (e) {
                    if ((e.which === 2  ) || ((e.which === 1 ) && e.ctrlKey)) {
                        // middle button or CTRL used .. open in new tab
                        uitools.navigateInNewTab('year', _this.series);
                    } else {
                        navigationHandlers.year.navigate(_this.series);
                    }
                });*/
        this._imageCtrl.saveImageFunc = templates.saveImageToAlbum;
        this._imageCtrl.canBeUsedAsSource = false; // handling will be made for whole header, so we can use track actions here
        if (window.uitools.getCanEdit()) {
            this._imageCtrl.addToContextMenu(menus.tracklistMenuItems.concat([{
                    action: {
                        title: actions.coverLookup.title,
                        icon: actions.coverLookup.icon,
                        visible: function () {
                            return (_this.series && (_this.series.id > 0));
                        },
                        execute: function () {
                            searchTools.searchAAImageDlg(_this.series, function () {
                                this._triedLocalImage = false; // force to reload local image
                                this.updateImage(true);
                            }.bind(_this), {
                                noDefaultIcon: (_this.series.itemImageType !== 'notsavedimage') && (_this.series.itemImageType !== 'icon')
                            });
                        }
                    },
                    order: 100,
                    grouporder: 50,
                }]));
        }
        _this.localListen(_this.container, 'contextmenu', function () {
            window.lastFocusedControl = _this.container;
            window._lastFocusedLVControl = undefined; // so it always take this control for actions
        }, true);
        dnd.makeImageDroppable(UI.itemImageSquare, function (picturePath) {
            if (picturePath && !_this._cleanUpCalled) {
                uitools.addNewArtwork(picturePath, {
                    album: _this.series,
                    showReplace: true
                }).then(function () {
                    if (!_this._cleanUpCalled) {
                        _this._triedLocalImage = false; // force to reload local image
                        _this.updateImage(true);
                    }
                });
            }
        });
        _this.localListen(_this.UI.headerTitle, 'dblclick', function () {
            if (!_this.showingOnline)
                _this.setEditMode(true);
        });
        UI.btnMenu.controlClass.menuArray = [{
                action: {
                    title: _('Wrong series?'),
                    submenu: function () {
                        return new Promise(function (resolve, reject) {
                            let ds = _this._ds.cache.foundSeriesSelect;
                            let retArray = [];
                            if (_this._ds.cache.foundSeriesSelect && (_this._ds.cache.foundSeriesSelect.count > 1)) {
                                ds.forEach(function (rgHTML, i) {
                                    retArray.push({
                                        action: {
                                            title: rgHTML.toString(),
                                            checked: function () {
                                                return _this._ds.cache.foundSeriesSelect.focusedIndex === i;
                                            },
                                            execute: function () {
                                                let sObj = _this._ds.cache.foundSeries[i];
                                                if ((sObj.seriesName !== _this.series.title) && !_this._ds.cache.foundSeries[i].isAnother) {
                                                    _this._ds.onlineData.tvdbid = sObj.id;
                                                    _this.series.addLink(LINK_TVDB, 'id', '' + sObj.id).then(function () {
                                                        _this.renameSeries(_this._ds.cache.foundSeries[i].seriesName, true);
                                                    });
                                                }
                                                else {
                                                    _this._ds.switchToOtherSeries(i);
                                                }
                                            }
                                        },
                                        order: i * 10,
                                        grouporder: 10
                                    });
                                });
                            }
                            retArray.push({
                                action: {
                                    title: _('Enter name') + '...',
                                    icon: 'edit',
                                    visible: function () {
                                        return !_this.showingOnline;
                                    },
                                    execute: function () {
                                        _this.setEditMode(true);
                                    }
                                },
                                order: 10,
                                grouporder: 20
                            });
                            resolve(retArray);
                        });
                    }
                },
                order: 10,
                grouporder: 10,
            }, {
                action: {
                    title: _('Choose different language'),
                    visible: function () {
                        return !!_this.series && !!_this.dataSource.onlineData && !!_this.dataSource.onlineData.tvdbid;
                    },
                    submenu: function () {
                        return new Promise(function (resolve, reject) {
                            let result = [];
                            let currLang = TVDB.language;
                            _this.localPromise(TVDB.getLanguages()).then(function (langs) {
                                if (!langs)
                                    return;
                                forEach(langs, function (lang) {
                                    result.push({
                                        title: lang.name,
                                        checked: (lang.abbreviation === currLang),
                                        execute: function () {
                                            TVDB.language = lang.abbreviation;
                                            _this._ds.reloadOnlineData();
                                        }
                                    });
                                });
                                resolve(result);
                            });
                        });
                    }
                },
                order: 10,
                grouporder: 20,
            }, {
                action: {
                    title: _('Edit series in TVDB'),
                    visible: function () {
                        return !!_this.series && !!_this.dataSource.onlineData && !!_this.dataSource.onlineData.tvdbid;
                    },
                    execute: function () {
                        app.utils.web.openURL(TVDB.getSeriesLink(_this.dataSource.onlineData.tvdbid));
                    }
                },
                order: 20,
                grouporder: 30,
            }, {
                action: {
                    title: _('Edit comment') + '...',
                    icon: 'edit',
                    visible: function () {
                        return !_this.showingOnline;
                    },
                    execute: function () {
                        if (!_this.showingOnline && _this.UI.wikiDescription && _this.UI.wikiDescription.controlClass) {
                            if (_this.UI.wikiDescription.controlClass.startEdit) {
                                _this.UI.wikiDescription.controlClass.startEdit();
                            }
                        }
                    }
                },
                order: 10,
                grouporder: 40
            }, {
                action: {
                    title: actions.trackProperties.title,
                    icon: actions.trackProperties.icon,
                    visible: function () {
                        return !_this.showingOnline;
                    },
                    disabled: function () {
                        if (!window.uitools.getCanEdit())
                            return true;
                        return !_this._ds.currentTracklist || (_this._ds.currentTracklist.count === 0);
                    },
                    execute: function () {
                        uitools.openDialog('dlgTrackProperties', {
                            modal: true,
                            tracks: _this._ds.currentTracklist,
                            //selectTab: 'tabArtwork'
                        });
                    }
                },
                order: 20,
                grouporder: 40,
            }, {
                action: {
                    title: function () {
                        return _('Pin it');
                    },
                    icon: 'pin',
                    visible: function () {
                        return uitools.isPinnedAsync(_this.series, false);
                    },
                    execute: function () {
                        uitools.pinItem(_this.series, true);
                    }
                },
                order: 10,
                grouporder: 50,
            }, {
                action: {
                    title: function () {
                        return _('Unpin it');
                    },
                    icon: 'pin',
                    visible: function () {
                        return uitools.isPinnedAsync(_this.series, true);
                    },
                    execute: function () {
                        uitools.pinItem(_this.series, false);
                    }
                },
                order: 20,
                grouporder: 50
            }];
        this.localListen(this.UI.headerTitle, 'change', function (evt) {
            _this.renameSeries(evt.detail.value);
        });
        this.enableDragNDrop();
    }
    canDrop(e) {
        let allowed = !this.showingOnline && !dnd.isSameControl(e) && (dnd.isAllowedType(e, 'cover') || dnd.isAllowedType(e, 'media'));
        if (allowed && e.dataTransfer) {
            let src = e.dataTransfer.getSourceControl();
            allowed = !src || !this.container.contains(src);
        }
        return this.dndEventsRegistered && allowed;
    }
    drop(e) {
        if (dnd.isAllowedType(e, 'cover')) {
            // dropped cover
            if (this.UI.itemImageSquare.controlClass && this.UI.itemImageSquare.controlClass.drop) {
                this.UI.itemImageSquare.controlClass.drop(e);
            }
        }
        else {
            // media files
        }
    }
    canDeleteSelected() {
        return !this.showingOnline;
    }
    renameSeries(newTitle, setTitleText) {
        let oldTitle = this.series.title;
        let setTitle = function () {
            if (!this.showingOnline && setTitleText) {
                this.UI.headerTitle.innerText = newTitle;
            }
            this.series.title = newTitle;
            this.localPromise(this.series.commitAsync()).then(function () {
                // reload view, series could be merged
                this._ds.onlineData = undefined;
                this._ds.cache = {};
                this._ds.notifyChange({
                    senderID: this.uniqueID,
                    eventType: 'clear',
                    clearAll: true
                });
                this._ds.notifyChange({
                    senderID: this.uniqueID
                });
                this._ds.fetchSeriesInfo();
            }.bind(this));
        }.bind(this);
        this.localPromise(this.series.getNumberOfTracks()).then(function (cnt) {
            let sett = window.settings.get('System');
            if ((cnt <= 50) || (!sett.System.AskUserMassEdit)) {
                setTitle();
                return;
            }
            let msg = sprintf(_('Are you sure that you want to modify %d files ?'), cnt);
            messageDlg(msg, 'Confirmation', ['btnYes', 'btnNo'], {
                defaultButton: 'btnNo',
                chbCaption: _('In the future, do not ask me'),
                checked: false
            }, function (result) {
                if (result.btnID === 'btnYes') {
                    if (result.checked) {
                        sett.System.AskUserMassEdit = false;
                        window.settings.set(sett, 'System');
                    }
                    setTitle();
                }
                else {
                    if (!this.showingOnline)
                        this.UI.headerTitle.innerText = oldTitle;
                }
            }.bind(this));
        }.bind(this));
    }
    _processMBCoverObj(cvrObj) {
        if (cvrObj && cvrObj.images && cvrObj.images.length > 0) {
            let pathL = undefined;
            let pathS = undefined;
            let pathImg = undefined;
            let img = cvrObj.images[0];
            if (img.thumbnails) {
                if (img.thumbnails.small)
                    pathS = img.thumbnails.small;
                if (img.thumbnails.large)
                    pathL = img.thumbnails.large;
            }
            if (img.image) {
                pathImg = img.image;
            }
            pathImg = pathImg || pathL || pathS;
            if (pathImg) {
                if (this.series) {
                    return this.series.saveThumbAsync(pathImg, true /* from auto search */);
                }
            }
        }
        return dummyPromise();
    }
    showImage(imgLink, pathToOrigCachedFile) {
        this._ds.cache.seriesImage = imgLink;
        this._ds.cache.cachedSeriesImage = pathToOrigCachedFile;
        this._imageCtrl.showImage(imgLink, pathToOrigCachedFile);
    }
    updateImage(forceUpdate) {
        let UI = this.UI;
        if (!this.series || this._cleanUpCalled || this._gettingImagePending)
            return;
        if (!forceUpdate && !this._imageCtrl.emptyArtwork)
            return;
        if (this._ds.cache.seriesImage && !forceUpdate && (this.series.itemImageType !== 'icon')) {
            this._imageCtrl.showImage(this._ds.cache.seriesImage, this._ds.cache.cachedSeriesImage);
            return;
        }
        let _this = this;
        if (_this.series && (_this.series.itemImageType !== 'icon')) {
            let pixelSize = 500;
            if (!_this._triedLocalImage) {
                _this._triedLocalImage = true;
                _this._gettingImagePending = true;
                cancelPromise(_this._promises.seriesThumb);
                let cancelToken = _this.series.getThumbAsync(pixelSize, pixelSize, function (imageLink, pathToOrigCachedFile) {
                    _this._promises.seriesThumb = undefined;
                    _this._gettingImagePending = false;
                    if (imageLink && (imageLink !== '-')) {
                        _this.showImage(imageLink, pathToOrigCachedFile);
                    }
                    else {
                        _this.updateImage();
                    }
                });
                _this._promises.seriesThumb = {
                    cancel: function () {
                        app.cancelLoaderToken(cancelToken);
                        _this._gettingImagePending = false;
                        _this._promises.seriesThumb = undefined;
                    }.bind(this)
                };
            }
            else if (!_this._triedTVDBImage && _this._ds.onlineData && _this._ds.onlineData.tvdbid) {
                _this._triedTVDBImage = true;
                _this._gettingImagePending = true;
                let taskid = _this._ds.beginTask(_('Getting') + ' ' + _('series image') + ' (TVDB)');
                _this._promises.seriesGetPoster = TVDB.getSeriesImage(_this._ds.onlineData.tvdbid);
                _this._promises.seriesGetPoster.then(function (origImgLink) {
                    _this._promises.seriesGetPoster = undefined;
                    if (origImgLink) {
                        cancelPromise(_this._promises.seriesSaveImage);
                        _this._promises.seriesSaveImage = _this.series.saveThumbAsync(origImgLink, true /* from auto search */);
                        _this._promises.seriesSaveImage.then1(function (ret) {
                            _this.safeEndTask(taskid);
                            _this._gettingImagePending = false;
                            _this._promises.seriesSaveImage = undefined;
                            if (!ret || !isAbortError(ret)) {
                                if (ret === 1) { // saved to temp/tags, read local image again
                                    _this._triedLocalImage = false;
                                    _this.updateImage();
                                }
                                else {
                                    // not saved for some reason, fill original link
                                    _this.showImage(origImgLink, origImgLink);
                                }
                            }
                        });
                    }
                    else {
                        _this.safeEndTask(taskid);
                        _this._gettingImagePending = false;
                        _this.updateImage();
                    }
                }, function () {
                    _this.safeEndTask(taskid);
                    _this._gettingImagePending = false;
                    _this._promises.seriesGetPoster = undefined;
                });
            }
            else if (!_this._triedWikiImage && _this._ds.onlineData && _this._ds.onlineData.wikiUrl) {
                _this._triedWikiImage = true;
                _this._gettingImagePending = true;
                let taskid = _this._ds.beginTask(_('Getting') + ' ' + _('series image') + ' (Wikipedia)');
                musicBrainz.getWikiPageImage(_this.uniqueID, _this._ds.onlineData.wikiUrl, 250).then(function (res) {
                    if (res && res.url && _this.series) {
                        cancelPromise(_this._promises.seriesSaveImage);
                        _this._promises.seriesSaveImage = _this.series.saveThumbAsync(res.url, true /* from auto search */);
                        _this._promises.seriesSaveImage.then1(function (ret) {
                            _this.safeEndTask(taskid);
                            _this._gettingImagePending = false;
                            _this._promises.seriesSaveImage = undefined;
                            if (!ret || !isAbortError(ret)) {
                                if (ret === 1) { // saved to temp/tags, read local image again
                                    _this._triedLocalImage = false;
                                    _this.updateImage();
                                }
                                else {
                                    // not saved for some reason, try to fill original links
                                    _this.showImage(res.thumb, res.url);
                                }
                            }
                        });
                    }
                    else {
                        _this.safeEndTask(taskid);
                        _this._gettingImagePending = false;
                        _this.updateImage();
                    }
                });
            }
            else if (!_this._triedDownloadImage /*&& _this.autoDownloadImage*/) { // we now always search for image in this view
                _this._triedDownloadImage = true;
                let taskid = _this._ds.beginTask(_('Getting') + ' ' + _('series image'));
                if (_this._promises.imageSearchParams) {
                    _this._promises.imageSearchParams.cancel();
                }
                _this._promises.imageSearchParams = {
                    highPriority: true,
                    canceled: false,
                    cancel: function () {
                        this.canceled = true;
                        _this.safeEndTask(taskid);
                        _this._promises.imageSearchParams = undefined;
                    }
                };
                searchTools.getAAImage(_this.series, function (origImgLink) {
                    if (origImgLink) {
                        cancelPromise(_this._promises.seriesSaveImage);
                        _this._promises.seriesSaveImage = _this.series.saveThumbAsync(origImgLink, true /* from auto search */);
                        _this._promises.seriesSaveImage.then1(function (ret) {
                            _this.safeEndTask(taskid);
                            _this._gettingImagePending = false;
                            _this._promises.seriesSaveImage = undefined;
                            if (!ret || !isAbortError(ret)) {
                                if (ret === 1) { // saved to temp/tags, read local image again
                                    _this._triedLocalImage = false;
                                    _this.updateImage();
                                }
                                else {
                                    // not saved for some reason, try to fill original link
                                    _this.showImage(origImgLink, origImgLink);
                                }
                            }
                        });
                    }
                    else {
                        _this.safeEndTask(taskid);
                    }
                    _this._promises.imageSearchParams = undefined;
                }, _this._promises.imageSearchParams);
            }
        }
        else {
            this._imageCtrl.hideImage();
        }
    }
    clearData(params) {
        super.clearData(params);
        enterLayoutLock(this.container);
        let UI = this.UI;
        this._mbImageUrl = undefined;
        this._triedDownloadImage = false;
        this._triedImageFromMB = false;
        this._triedWikiImage = false;
        this._triedTVDBImage = false;
        this.lastDesc = '';
        this.actors = undefined;
        if (UI.wikiDescription)
            cleanElement(UI.wikiDescription, true /* only children */);
        if (params && params.clearAll) {
            this._triedLocalImage = false;
        }
        leaveLayoutLock(this.container);
    }
    updateValues() {
        let ds = this.dataSource;
        if (!ds || !this.series)
            return;
        if (!ds.onlineData) {
            this._ds.fetchSeriesInfo();
        }
        let UI = this.UI;
        super.updateValues();
        this.updateImage();
        if (this._statusInfo) {
            if (this._statusInfo.groupsCount > 0) {
                UI.seasonCount.innerText = this._statusInfo.groupsCount + ' ' + (_('season', 'seasons', this._statusInfo.groupsCount));
                setVisibilityFast(UI.seasonCount, true);
            }
            else {
                setVisibilityFast(UI.seasonCount, false);
            }
            if (this._statusInfo.totalCount > 0) {
                UI.seriesTotalTracks.innerText = this._statusInfo.totalCount + ' ' + (_('episode', 'episodes', this._statusInfo.totalCount));
                setVisibilityFast(UI.seriesTotalTracks, true);
            }
            else {
                setVisibilityFast(UI.seriesTotalTracks, false);
            }
            if (this._statusInfo.totalLength > 0) {
                UI.seriesTotalLength.innerText = getFormatedTime(this._statusInfo.totalLength, {
                    useEmptyHours: false
                });
                setVisibilityFast(UI.seriesTotalLength, true);
            }
            else {
                setVisibilityFast(UI.seriesTotalLength, false);
            }
        }
        let wikiDescFilled = false;
        if (!this.showingOnline && this.descEditSupport) {
            let desc = this.getDescription();
            if (desc) {
                this.fillDescriptionElement(desc, {
                    onlyText: true,
                    editable: true
                });
                wikiDescFilled = true;
            }
        }
        if (!wikiDescFilled && ds.onlineData) {
            if (ds.onlineData.overview && ((this.wikidesc !== ds.onlineData.overview)) || (this.actors !== ds.onlineData.actors) || (this.descEditSupport && (this.showingOnline !== this.lastWikiShowingOnline))) {
                this.wikidesc = ds.onlineData.overview;
                this.actors = ds.onlineData.actors;
                this.lastWikiShowingOnline = this.showingOnline;
                this.fillDescriptionElement(this.wikidesc, {
                    actors: this.actors,
                    editable: !this.showingOnline,
                    fromOnline: true
                });
            }
        }
        if (this.bindFn)
            this.bindFn(this.container, this.dataSource);
    }
    setStatus(data) {
        this._statusInfo = data;
        this.updateValues();
    }
    getTitle() {
        let ds = this.dataSource;
        if (!ds)
            return '';
        let retval = '';
        if (this.showingOnline && this.series) {
            if (ds.onlineData) {
                if (ds.onlineData.title)
                    retval = ds.onlineData.title;
            }
        }
        if (!retval && this.series) {
            if (this.series.title) {
                retval = this.series.title;
            }
            else {
                retval = _('Unknown Series');
            }
        }
        return retval;
    }
    getParenthesis() {
        let ds = this.dataSource;
        if (!ds)
            return '';
        if (this.showingOnline) {
            if (ds.onlineData && ds.onlineData.year)
                return ds.onlineData.year;
        }
        else {
            if (this.series && (this.series.year > 0))
                return this.series.year;
        }
        return '';
    }
    cancelAll() {
        if (searchTools.interfaces.aaSearch)
            searchTools.cancelSearch(searchTools.interfaces.aaSearch, this.uniqueID);
        super.cancelAll();
    }
    fillDescriptionElement(wikiText, params) {
        params = params || {};
        let wikiEl = this.UI.wikiDescription;
        let _this = this;
        cleanElement(wikiEl, true /* only children */); // correct cleaning including listeners
        wikiEl.controlClass = wikiEl.controlClass || new Control(wikiEl); // needed Control for correct listeners handling
        let prepareElement = function () {
            let wikiDesc = document.createElement('span');
            wikiEl.appendChild(wikiDesc);
            wikiDesc.controlClass = new Editable(wikiDesc, {
                multiline: true,
                editable: false
            });
            if (params.onlyText)
                wikiDesc.innerText = wikiText;
            else {
                if (params.actors && (params.actors.length > 0)) {
                    // add Actors line
                    let actors = '';
                    wikiDesc.innerHTML = '<span data-id="actors"><p><span>Actors: </span><span data-id="actorLinks"></span></p></span>' + wikiText;
                    let actorLinks = qeid(wikiDesc, 'actorLinks');
                    forEach(params.actors, function (act) {
                        if (actors !== '')
                            actors += ', ';
                        actors += act.name;
                    });
                    actorLinks.innerText = actors;
                    //templates.hotlinkHandler(UI.actorLinks, actors, UI.actorLinks, {type: 'actor'});
                }
                else
                    wikiDesc.innerHTML = wikiText;
            }
            wikiDesc.controlClass.localListen(wikiDesc, 'change', function (e) {
                if (_this.showingOnline)
                    return;
                _this.series.description = e.detail.value;
                _this.series.commitAsync();
            });
            if (params.editable) {
                wikiDesc.controlClass.localListen(wikiDesc, 'editStart', function (e) {
                    wikiEl.controlClass.raiseEvent('editStart', e.detail);
                });
                wikiDesc.controlClass.localListen(wikiDesc, 'editEnd', function (e) {
                    wikiDesc.controlClass.editable = false;
                    wikiDesc.controlClass.container.blur();
                    wikiEl.controlClass.raiseEvent('editEnd', e.detail);
                });
                wikiEl.controlClass.startEdit = function () {
                    wikiDesc.controlClass.editable = true;
                    wikiDesc.controlClass.container.focus();
                };
            }
            return wikiDesc;
        };
        if (params.fromOnline) {
            loadIcon('tvdb', function (data) {
                if (wikiEl && wikiEl.controlClass) { // not cleared yet
                    prepareElement();
                    let wikiLink = document.createElement('span');
                    wikiLink.innerHTML = '<p class="textOther smallText"> <span class="inline hotlink marginTopLarge vSeparatorTiny" onclick="app.utils.web.openURL(TVDB.getSeriesLink(' + _this.dataSource.onlineData.tvdbid + '));" style="width: 3.2em; height: 1.85em">' + data + '</span><span>TV information and images are provided by TheTVDB.com, but we are not endorsed or certified by TheTVDB.com or its affiliates.</span></p>';
                    wikiEl.appendChild(wikiLink);
                    notifyLayoutChangeUp(wikiEl);
                }
            });
        }
        else {
            let wikiDesc = prepareElement();
            notifyLayoutChangeUp(wikiDesc);
        }
    }
    get series() {
        if (this.dataSource)
            return this.dataSource.dataObject;
        else
            return undefined;
    }
}
registerClass(SeriesViewHeader);
