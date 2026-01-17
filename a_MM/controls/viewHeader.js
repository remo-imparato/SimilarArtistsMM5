/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

registerFileImport('controls/viewheader');
'use strict';
import Control from './control';
/**
@module UI
*/
/**
UI ViewHeader element

@class ViewHeader
@constructor
@extends Control
*/
export default class ViewHeader extends Control {
    initialize(rootelem, params) {
        super.initialize(rootelem, params);
        this.useCollage = false; // artwork as collage
        this.useImage = true; // artwork as image
        this.useGenres = true; // add Genres line
        this.useSourceSwitcher = true;
        this.useShuffleButton = true;
        this.usePlayButton = true;
        this.useMenuButton = true;
        this.autoDownloadImage = true;
        this.autoSaveImage = false;
        this.icon = 'person';
        this.artworkSizeClass = 'biggerImageSize';
        this.artworkExactSizeClass = 'biggerImageSizeExact';
        this.headerHeightClass = 'biggerHeaderHeight';
        this.headerMinHeightClass = 'biggerHeaderMinHeight';
        this._maxOverflowHeaderPx = 0; //4 * window.fontLineSizePx();
        this.mbDataType = undefined; // MusicBrainz data type, like "artist" or "release-group". If empty/undefined, link to MusicBrainz is not made (Genres)
        this._promises = {};
        for (let key in params) {
            this[key] = params[key];
        }
        this.helpContext = 'Filelisting';
        this.container.innerHTML = loadFile('file:///controls/viewHeader.html');
        this.container.classList.add('noOverflow');
        this.container.classList.add('relativeBase');
        this.UI = getAllUIElements(this.container);
        let UI = this.UI;
        let _this = this;
        setVisibilityFast(UI.sourceSwitcher, this.useSourceSwitcher);
        setVisibilityFast(UI.btnPlay, this.usePlayButton);
        setVisibilityFast(UI.btnShuffle, this.useShuffleButton);
        setVisibilityFast(UI.btnMenu, this.useMenuButton);
        if (this.headerHeightClass)
            UI.headerHeight.classList.add(this.headerHeightClass);
        //if (!this.useCollage) // do not use columns with collages, it could split collage to two columns
        // trying to use even with collages, return in case of problems, seems to be working ok
        UI.headerColumnsContainer.style.columnWidth = '40em';
        UI.headerColumnsContainer.classList.add(this.headerMinHeightClass);
        if (this.useGenres) {
            // add Genres line
            UI.genres = document.createElement('div');
            UI.genres.className = 'paddingBottom'; // cannot use margin, Chromium then renders header incorrectly
            UI.genres.setAttribute('data-id', 'genres');
            UI.descriptionContainer.insertBefore(UI.genres, UI.wikiDescription);
        }
        UI.searchWikiText = document.createElement('span');
        UI.searchWikiText.className = 'paddingBottom';
        UI.searchWikiText.innerText = 'Wikipedia: ';
        UI.searchWikiText.setAttribute('data-id', 'searchWikiText');
        UI.descriptionContainer.insertBefore(UI.searchWikiText, UI.wikiDescription);
        UI.searchWikiLink = document.createElement('span');
        UI.searchWikiLink.className = 'paddingBottom hotlink';
        UI.searchWikiLink.innerText = _('Lookup') + '...';
        UI.searchWikiLink.setAttribute('data-id', 'searchWikiLink');
        UI.descriptionContainer.insertBefore(UI.searchWikiLink, UI.wikiDescription);
        let artworkInitParams = {
            useCollage: this.useCollage,
            useImage: this.useImage,
            icon: this.icon,
            sizeClass: this.artworkSizeClass,
            exactSizeClass: this.artworkExactSizeClass
        };
        UI.itemImageSquare.setAttribute('data-init-params', JSON.stringify(artworkInitParams));
        initializeControls(this.container);
        this.localListen(UI.itemImageSquare, 'load', function () {
            this.notfiySizeCouldChanged(UI.itemImageSquare);
            this.secondImageAttempt = false;
        }.bind(this));
        this.localListen(UI.itemImageSquare, 'error', function (evt) {
            if (!this.secondImageAttempt && evt.detail.deleted) {
                this.secondImageAttempt = true;
                this.updateImage(true);
            }
        }.bind(this));
        this.showingOnline = (uitools.globalSettings && !this.disabledOnline) ? !!uitools.globalSettings.showingOnline : false;
        window.uitools.globalSettings.defaultWikiLang = window.uitools.globalSettings.defaultWikiLang || 'en';
        if (uitools.globalSettings.showingOnlineDisabled || !this.useSourceSwitcher || this.disabledOnline)
            setVisibilityFast(UI.sourceSwitcher, false);
        else // @ts-ignore
            UI.sourceSwitcher.controlClass.selectedIndex = this.showingOnline ? 1 : 0;
        this.biggerHeaderHeight = UI.headerHeight.clientHeight; // it was there only for measurement, remove
        this.container.removeChild(UI.headerHeight);
        UI.headerHeight = undefined;
        this.localListen(UI.expandHeader, 'click', () => {
            this.bigHeader = true;
            this.handle_layoutchange();
        });
        this.localListen(UI.collapseHeader, 'click', () => {
            this.bigHeader = false;
            this.handle_layoutchange();
        });
        addEnterAsClick(this, UI.expandHeader);
        addEnterAsClick(this, UI.collapseHeader);
        if (this.useSourceSwitcher) {
            this.localListen(UI.sourceSwitcher, 'selected', (e) => {
                this.showingOnline = (e.detail.tabIndex === 1);
                uitools.globalSettings.showingOnline = this.showingOnline;
                if (this.dataSource) {
                    this.dataSource.notifyChange({
                        eventType: 'settings'
                    });
                }
                if (!app.getValue('InfoPanelAutoLookup', true) && this.showingOnline && this._ds) {
                    this._ds.fetchMBData(); // #21048
                }
            });
        }
        this._imageCtrl = UI.itemImageSquare.controlClass;
        if (this.usePlayButton) {
            this.localListen(UI.btnPlay, 'click', function () {
                window.lastFocusedControl = undefined; // reset, so it will use always our tracklist
                uitools.handlePlayAction({
                    actionType: 'playNow',
                    getTracklist: _this.getTracklist.bind(_this)
                });
            });
            addEnterAsClick(this, UI.btnPlay);
            uitools.addPlayButtonMenu(UI.btnPlay);
        }
        if (this.useShuffleButton) {
            this.localListen(UI.btnShuffle, 'click', function () {
                window.lastFocusedControl = undefined; // reset, so it will use always our tracklist
                uitools.handlePlayAction({
                    actionType: 'playNowShuffled',
                    getTracklist: _this.getTracklist.bind(_this)
                });
            });
            addEnterAsClick(this, UI.btnShuffle);
            uitools.addShuffleButtonMenu(UI.btnShuffle);
        }
        let loadSettings = function () {
            let sett = settings.get('Options');
            this.autoDownloadImage = sett.Options.SearchMissingArtwork;
            this.autoSaveImage = sett.Options.SaveMissingArtwork;
        }.bind(this);
        loadSettings();
        this.localListen(settings.observer, 'change', function () {
            let oldAutoDownload = this.autoDownloadImage;
            let oldAutoSaveImage = this.autoSaveImage;
            loadSettings();
            if (this.autoDownloadImage && (!oldAutoDownload || (oldAutoSaveImage !== this.autoSaveImage))) {
                this.updateImage();
            }
        }.bind(this));
        if (this.descEditSupport) {
            let wasExpanded = undefined;
            this.localListen(_this.container, 'dblclick', function (e) {
                if (!_this.showingOnline && UI.wikiDescription && UI.wikiDescription.controlClass) { // @ts-ignore
                    if (UI.wikiDescription.controlClass.startEdit) { // @ts-ignore
                        UI.wikiDescription.controlClass.startEdit();
                    }
                    e.stopPropagation();
                }
            });
            this.localListen(UI.wikiDescription, 'editStart', function (e) {
                wasExpanded = this.bigHeader;
                if (!wasExpanded) { // temporary expand to allow editing of larger texts
                    this.bigHeader = true;
                }
                this.handle_layoutchange();
            }.bind(this));
            this.localListen(UI.wikiDescription, 'editEnd', function (e) {
                if (wasExpanded === false) {
                    this.bigHeader = false;
                }
                wasExpanded = undefined;
                this.handle_layoutchange();
            }.bind(this));
        }
        uitools.createBoundFocusHandling(this, UI.playButtons, ['btnPlay', 'btnShuffle', 'btnMenu']);
    }
    notfiySizeCouldChanged(el) {
        notifyLayoutChangeUp(el);
        let pEl = this.container.offsetParent;
        if (pEl)
            notifyLayoutChangeDown(pEl);
    }
    setWikiLanguage(lang, pgObj) {
        if (!this._ds || !this._ds.onlineData)
            return;
        if (!pgObj) {
            if (!this.wikipages)
                return;
            pgObj = this.wikipages.find((o) => (o.lang === lang));
            if (!pgObj)
                return;
        }
        this._ds.onlineData.wikiUrl = pgObj.url.replace('http://', 'https://');
        cleanElement(this.UI.wikiDescription, true);
        this.wikidesc = undefined;
        let wikitaskid = this._ds.beginTask(_('Searching') + '...');
        this.readingWiki = true;
        this.localPromise(musicBrainz.getWikiPerex(this.uniqueID, this._ds.onlineData.wikiUrl)).then1((txt) => {
            this.readingWiki = false;
            this.safeEndTask(wikitaskid);
            window.uitools.globalSettings.defaultWikiLang = lang;
            if (!this._cleanUpCalled && !isAbortError(txt)) {
                if (txt) {
                    this._ds.onlineData.wikiperex = txt;
                    this._ds.notifyChange({
                        senderID: this.uniqueID
                    });
                }
            }
        });
    }
    getTracklist() {
        let tds;
        if (this._ds) {
            // get copy because of #17854
            tds = this._ds.currentTracklist.getCopy();
        }
        return tds;
    }
    startEditTitle() {
        window.uitools.selectAllText(this.UI.headerTitle);
        this.UI.headerTitle.focus();
    }
    stopEditTitle() {
        window.uitools.unselectAllText(this.UI.headerTitle);
        this.UI.headerTitle.blur();
    }
    setEditMode(en) {
        // @ts-ignore
        if (this.UI.headerTitle.controlClass.editable !== en) { // @ts-ignore
            this.UI.headerTitle.controlClass.editable = en;
            if (!en) {
                this.stopEditTitle();
            }
            else {
                this.startEditTitle();
            }
        }
    }
    updateImage(forceUpdate) {
        // should be implemented in derived header classes
    }
    clearData(params) {
        for (let key in this._promises) {
            cancelPromise(this._promises[key]);
        }
        this._promises = {};
        this.cleanUpPromises();
        enterLayoutLock(this.container);
        let UI = this.UI;
        cleanElement(UI.wikiDescription, true);
        this.wikidesc = undefined;
        this.wikiUrl = undefined;
        this.noMatchFilled = false;
        if (!params || params.clearAll || !params.onlyOnline || this.showingOnline) {
            UI.headerTitleParenthesis.textContent = '';
            UI.headerTitle.innerText = '';
            this.parenthesis = undefined;
            this.title = undefined;
        }
        if (UI.genres) {
            cleanElement(UI.genres, true /* only childs */);
            this.genres = undefined;
        }
        if (params && params.clearAll) {
            this.wikipages = undefined;
            this.imgUrl = undefined;
            this._imageCtrl.hideImage();
            this.cancelAll();
        }
        leaveLayoutLock(this.container);
    }
    safeEndTask(taskid) {
        if (this._ds)
            this._ds.endTask(taskid);
    }
    updateValues() {
        let UI = this.UI;
        let ds = this.dataSource;
        if (!ds) {
            //            this.clearData(true);
            return;
        }
        this.showingOnline = (uitools.globalSettings && !this.disabledOnline) ? !!uitools.globalSettings.showingOnline : false;
        let ttl = this.getTitle();
        if (this.title !== ttl) {
            UI.headerTitle.innerText = ttl;
            notifyLayoutChangeUp(UI.headerTitle);
        }
        let par = this.getParenthesis();
        if (this.parenthesis !== par) {
            this.parenthesis = par;
            let ptxt = par;
            if (ptxt) {
                UI.headerTitleParenthesis.innerText = ptxt;
                setVisibilityFast(UI.headerTitleParenthesisContainer, true);
            }
            else {
                setVisibilityFast(UI.headerTitleParenthesisContainer, false);
            }
            notifyLayoutChangeUp(UI.headerTitleParenthesis);
        }
        let wikiDescFilled = false;
        if (!this.showingOnline && this.descEditSupport) {
            let desc = this.getDescription();
            if (desc) {
                musicBrainz.fillWikiElement(UI.wikiDescription, '', desc, function () {
                    this.notfiySizeCouldChanged(UI.wikiDescription);
                }.bind(this), {
                    editable: true,
                    fromWiki: false,
                    onlyText: true
                });
                wikiDescFilled = true;
            }
        }
        let data = ds.onlineData || {};
        if (!this.readingWiki) {
            if (!data.wikiUrl && data.wikipages) {
                data.wikiUrl = musicBrainz.getWikiURLFromWikipages(data.wikipages);
                if (data.wikipages && (data.wikipages.length > 0)) {
                    this.wikipages = data.wikipages;
                    this.wikipages.sort(function (i1, i2) {
                        return i1.lang.localeCompare(i2.lang);
                    });
                }
                // check, if we have user preferred language of wiki
                let prefWikiUrl = musicBrainz.getWikiURLFromWikipages(this.wikipages, window.uitools.globalSettings.defaultWikiLang);
                if (prefWikiUrl && ((prefWikiUrl !== data.wikiUrl) || !data.wikiperex)) {
                    this.setWikiLanguage(window.uitools.globalSettings.defaultWikiLang);
                }
            }
            if (!this.readingWiki) {
                if (data.wikiperex) {
                    if ((data.wikiperex !== this.wikidesc) || (data.wikiUrl !== this.wikiUrl) || (this.descEditSupport && (this.showingOnline !== this.lastWikiShowingOnline))) {
                        this.wikidesc = data.wikiperex;
                        this.wikiUrl = data.wikiUrl;
                        this.lastWikiShowingOnline = this.showingOnline;
                        if (!wikiDescFilled) {
                            musicBrainz.fillWikiElement(UI.wikiDescription, data.wikiUrl, data.wikiperex, function () {
                                this.notfiySizeCouldChanged(UI.wikiDescription);
                            }.bind(this), {
                                editable: (!this.showingOnline && this.descEditSupport),
                                fromWiki: true
                            });
                        }
                    }
                }
                else if (data.annotation) {
                    if (this.wikidesc !== data.annotation) {
                        this.wikidesc = data.annotation;
                        if (!wikiDescFilled) {
                            musicBrainz.fillWikiElement(UI.wikiDescription, data.wikiUrl, data.wikidesc, function () {
                                this.notfiySizeCouldChanged(UI.wikiDescription);
                            }.bind(this), {
                                editable: (!this.showingOnline && this.descEditSupport)
                            });
                        }
                    }
                }
                else if (data.isAnother && this.mbDataType && !wikiDescFilled) {
                    this.wikidesc = ' ';
                    if (!this.noMatchFilled) {
                        this.noMatchFilled = true;
                        musicBrainz.fillWikiElementWithNoMatch(UI.wikiDescription, this.mbDataType);
                        notifyLayoutChangeUp(UI.wikiDescription);
                    }
                }
                else if (!wikiDescFilled) {
                    this.noMatchFilled = false;
                    this.wikidesc = ' ';
                    musicBrainz.fillWikiElement(UI.wikiDescription, '', '&nbsp;', function () {
                        this.notfiySizeCouldChanged(UI.wikiDescription);
                    }.bind(this), {
                        editable: true,
                        fromWiki: false
                    });
                }
            }
        }
        if (data['wiki-tags'] !== this.genres) {
            this.genres = data['wiki-tags'];
            cleanElement(UI.genres, true /* only childs */);
            if (this.genres && (this.genres.length > 0)) {
                let i = 0;
                let totalWeight = 0;
                forEach(this.genres, function (tag) {
                    tag.weight = parseFloat(tag.weight);
                    totalWeight += tag.weight;
                });
                let maxWeight = totalWeight * 0.9;
                let curr = 0;
                let sett = settings.get('Appearance');
                let sep = sett.Appearance.MultiStringSeparator;
                let genres = '';
                UI.genres.innerHTML = '<span>Genres: </span><span data-id="genreLinks"></span>';
                UI.genreLinks = qeid(UI.genres, 'genreLinks');
                forEach(this.genres, function (tag) {
                    if (curr < maxWeight && i <= 5) {
                        if (genres !== '')
                            genres += sep;
                        genres += tag.name;
                        i++;
                    }
                    curr += tag.weight;
                });
                templates.hotlinkHandler(UI.genreLinks, genres, UI.genreLinks, {
                    type: 'genre'
                });
            }
            else {
                cleanElement(UI.genres, true /* only childs */);
            }
        }
        /*        if (ds.imgUrl !== this.imgUrl) {
                    this.imgUrl = ds.imgUrl;
                    if (this.imgUrl) {
                        this._imageCtrl.showImage(this.imgUrl);
                    } else {
                        this._imageCtrl.hideImage();
                    }
                }*/
        let emptyInfo = (UI.wikiDescription.innerText.trim() == '');
        setVisibility(UI.searchWikiText, !app.getValue('InfoPanelAutoLookup', true) && emptyInfo);
        setVisibility(UI.searchWikiLink, !app.getValue('InfoPanelAutoLookup', true) && emptyInfo);
    }
    handle_layoutchange(evt) {
        this.requestFrame(() => {
            this._handle_layoutchange(evt);
        }, '_handle_layoutchange');
    }
    _handle_layoutchange(evt) {
        if (this.dataSource) {
            if (!this.headerAnimating) {
                if ((this.lastHeaderHeight === undefined) || (this.container.style.height === '')) {
                    this.lastHeaderHeight = this.container.clientHeight;
                }
                let contentHeight = this.UI.headerContainer.clientHeight;
                let wholeBiggerHeaderHight = this.biggerHeaderHeight + this.UI.headerTitlePart.clientHeight;
                let diffHeight = Math.max(contentHeight - wholeBiggerHeaderHight, 0);
                let descriptionIsBig = diffHeight > 0;
                this.slightlyOverflowedHeader = descriptionIsBig && (diffHeight < this._maxOverflowHeaderPx);
                setVisibilityFast(this.UI.expandHeader, !this.bigHeader && this.wikidesc && descriptionIsBig && !this.slightlyOverflowedHeader);
                setVisibilityFast(this.UI.collapseHeader, this.bigHeader && this.wikidesc && descriptionIsBig && !this.slightlyOverflowedHeader);
                let smallHeader = !this.bigHeader && descriptionIsBig && !this.slightlyOverflowedHeader;
                setVisibilityFast(this.UI.bottomFadeout, smallHeader);
                this.container.classList.toggle('hSeparatorTiny', smallHeader);
                let setLimitedHeader = !this.bigHeader && !this.slightlyOverflowedHeader && (contentHeight > wholeBiggerHeaderHight);
                if (setLimitedHeader) {
                    contentHeight = wholeBiggerHeaderHight;
                }
                if ((this.lastHeaderHeight !== contentHeight) && (contentHeight > 0)) {
                    if (evt) {
                        // standard layout change - fast, without animation
                        this.container.style.height = contentHeight + 'px';
                        this.lastHeaderHeight = contentHeight;
                        this.notfiySizeCouldChanged(this.container); // #19067 / #19473
                    }
                    else {
                        // manually called - animate
                        this.headerAnimating = true;
                        animTools.animate(this.container, {
                            height: contentHeight,
                            complete: function () {
                                this.headerAnimating = false;
                                this.lastHeaderHeight = contentHeight;
                                this.notfiySizeCouldChanged(this.container); // #19067 / #19473
                            }.bind(this)
                        });
                    }
                }
            }
        }
        if (evt)
            super.handle_layoutchange(evt);
    }
    getTitle() {
        let ds = this.dataSource;
        if (!ds)
            return '';
        if (this.showingOnline) {
            if (ds.onlineData)
                return ds.onlineData.title || '';
            else
                return '';
        }
        else {
            if (ds.dataObject)
                return ds.dataObject.title;
            else
                return '';
        }
    }
    getDescription() {
        let ds = this.dataSource;
        if (!ds)
            return '';
        if (this.showingOnline) {
            if (ds.onlineData)
                return ds.onlineData.wikiperex || '';
            else
                return '';
        }
        else {
            if (ds.dataObject)
                return ds.dataObject.description || ds.dataObject.comment || '';
            else
                return '';
        }
    }
    getParenthesis() {
        return '';
    }
    // called, when content of datasource changed
    dataSourceChangeHandler(params) {
        if (params) {
            if (params.eventType === 'clear') {
                this.clearData(params);
                return;
            }
        }
        this.updateValues();
    }
    storeState() {
        let state = super.storeState();
        state.bigHeader = this.bigHeader;
        return state;
    }
    restoreState(state) {
        this.bigHeader = !!state.bigHeader;
        if (!this.bigHeader) {
            this.container.style.height = this.biggerHeaderHeight + 'px';
            this.lastHeaderHeight = this.biggerHeaderHeight;
        }
        else {
            this.container.style.height = '';
        }
        this.showingOnline = (uitools.globalSettings && !this.disabledOnline) ? !!uitools.globalSettings.showingOnline : false;
        if (this.useSourceSwitcher) // @ts-ignore
            this.UI.sourceSwitcher.controlClass.selectedIndex = this.showingOnline ? 1 : 0;
        super.restoreState(state);
    }
    storePersistentState() {
        let state = {
            bigHeader: this.bigHeader,
        };
        return state;
    }
    restorePersistentState(state) {
        this.bigHeader = !!state.bigHeader;
        if (!this.bigHeader) {
            this.container.style.height = this.biggerHeaderHeight + 'px';
            this.lastHeaderHeight = this.biggerHeaderHeight;
        }
        else {
            this.container.style.height = '';
        }
        this.showingOnline = (uitools.globalSettings && !this.disabledOnline) ? !!uitools.globalSettings.showingOnline : false;
        if (this.useSourceSwitcher) // @ts-ignore
            this.UI.sourceSwitcher.controlClass.selectedIndex = this.showingOnline ? 1 : 0;
    }
    cancelAll() {
        musicBrainz.cancelDownloads(this.uniqueID);
        if (this._ds)
            this._ds.cancelProgress();
    }
    cleanUp() {
        this.cancelAll();
        this.dataSource = null; // needs to be here to unregister this._dataSourceChangeHandler
        super.cleanUp();
    }
    get dataSource() {
        return this._ds;
    }
    set dataSource(value) {
        if (value === this._ds)
            return;
        if (value && this._ds && isFunction(value.isSame) && value.isSame(this._ds))
            return;
        if (this._ds) {
            if (this._dataSourceChangeHandler) {
                app.unlisten(this._ds, 'change', this._dataSourceChangeHandler);
                this._dataSourceChangeHandler = undefined;
            }
            this.clearData({
                clearAll: true
            });
        }
        this.setEditMode(false);
        this._ds = value;
        this.secondImageAttempt = false;
        /*
            includes:
            dataObject - object with getThumbAsync function
            onlineData - data read from MusicBrainz
            cache - cached objects, lists
        */
        if (value) {
            this._ds.progressCtrl = this.UI.btnProgress.controlClass;
            this._imageCtrl.dataObject = value.dataObject;
            if (!this._ds.cache)
                this._ds.cache = {};
        }
        else
            this._imageCtrl.dataObject = undefined;
        this.updateValues();
        if (this._ds)
            this._dataSourceChangeHandler = app.listen(this._ds, 'change', this.dataSourceChangeHandler.bind(this));
    }
}
registerClass(ViewHeader);
