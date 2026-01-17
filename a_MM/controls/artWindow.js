/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

'use strict';
registerFileImport('controls/artWindow');
import './popupmenu';
import './switchWindow';
import MenuButton from './menuButton';
import Control from './control';
/**
 * UI Art & details window element
 */
export default class ArtWindow extends Control {
    initialize(rootelem, params) {
        super.initialize(rootelem, params);
        this.container.className = 'animate allinside initialSize';
        this.helpContext = 'Customizing MediaMonkey#Customizing Preview';
        this.track = null;
        this._tabbableDivs = [];
        this._focusedIdx = -1;
        this._minHeightSet = false;
        this.showProperties = true;
        this.enableDragNDrop();
        this._artworkAR = 1; // not known yet
        this._fieldListeners = [];
        this.usePartialOverflow = true;
        this.contextMenu = new Menu(this._getMenuArray());
        this._createlayout();
        this.mode = 'selectedTrack';
        this.layout = 'advanced';
        this._fieldsEditable = app.getValue('artWindowEditable', false);
        this.handle_layoutchange();
        this._registerListeners();
    }
    _setMinHeight() {
        // call only when visible!
        if (this._minHeightSet)
            return;
        let header = this.qChild('header');
        let hh = getFullHeight(header);
        this.container.style.minHeight = (hh + minsize) + 'px';
        this._minHeightSet = true;
    }
    _createlayout() {
        let _this = this;
        let div = document.createElement('div');
        div.className = 'flex column stretchHeight stretchWidth listview';
        div.innerHTML =
            '  <div data-id="header" data-hideInFullWindowMode class="flex row lvHeader" >' +
                '    <div data-id="btnMenu" class="lvHeaderSingleItem"></div>' +
                '    <div class="lvHeaderSingleItem fill flex">' +
                '      <div class="fill"></div>' +
                '      <div class="flex row">' +
                '        <div data-id="lblMode" class="clickableLabel textEllipsis"></div>' +
                '        <div data-id="modeSpacer" style="width: 0.5em"></div>' +
                '        <div data-id="bToggle" class="toolbutton verticalCenter" data-icon="downArrow" data-control-class="MenuButton"></div>' +
                '      </div>' +
                '      <div class="fill"></div>' +
                '    </div>' +
                '    <div data-id="modeButtons" class="flex row lvHeaderSingleItem" style="display: none; position: absolute; right: 0em; top:0; bottom:0; padding-right:1.5em">' +
                '      <div data-id="btnMode_fullwindow" data-icon="mode_fullwindow" class="toolbutton"></div>' +
                '      <div data-id="spacer" style="width: 0.5em"></div>' +
                '      <div data-id="btnMode_fullscreen" data-icon="mode_fullscreen" class="toolbutton"></div>' +
                '    </div>' +
                '    <div data-id="viewButtons" class="flex row lvHeaderSingleItem" style="position: absolute; right: 0em; top:0; bottom:0;">' +
                '      <div data-id="btnView" data-icon="browser" data-control-class="MenuButton"></div>' +
                '    </div>' +
                '  </div>' +
                '  <div data-videoWindowed data-id="tabBox" class="fill">' +
                '    <div data-hideInFullWindowMode data-id="artworkLayer" class="flex column bottom fill verticalCenter">' +
                '      <img data-id="artwork" class="coverImage"/>' +
                '      <div data-id="unknownAA" class="largeIconColor" data-icon="unknownAA"></div>' +
                '    </div>' +
                '    <div data-hideInFullWindowMode data-id="propsBase" class="fill scrollable transparentBackground">' +
                '      <div data-id="propsLayer" class="paddingLeft paddingTop" style="position: absolute; left: 0; top: 0; right: 0; z-index: 2;"></div>' + // marginLeftSmall is related to to margin for npListItem
                '    </div>';
        '  </div>';
        this.container.appendChild(div);
        initializeControls(div);
        // Setup header navigation
        let header = this.qChild('header');
        uitools.createBoundFocusHandling(this, header, ['btnMenu', 'bToggle', 'btnMode_fullwindow', 'btnMode_fullscreen', 'btnView']);
        let btnMenu = this.qChild('btnMenu');
        btnMenu.controlClass = new MenuButton(btnMenu, {
            menuArray: this._getMenuArray()
        });
        for (let item in artWindowModes) {
            artWindowModes[item].modeType = item;
        }
        let bToggle = this.qChild('bToggle');
        let ar = [];
        for (let item in artWindowModes) {
            ar.push({
                modeItem: artWindowModes[item],
                title: function () {
                    return resolveToValue(this.modeItem.title, '');
                },
                execute: function () {
                    _this.activateMode(this.modeItem.modeType);
                },
                checked: function () {
                    return this.modeItem.modeType === _this.mode;
                },
                visible: artWindowModes[item].visible
            });
        }
        bToggle.controlClass.tabIndex = -1;
        bToggle.controlClass.menuArray = ar;
        // "fake" menu button in flex, so the height is set appropriately (real menu button is positioned absolutely with no impact on automatic header height)
        uitools.insertFakeMenuButton(header, 'lvHeaderSingleItem');
        this.lblMode = this.qChild('lblMode');
        this.modeButtons = this.qChild('modeButtons');
        this.viewButtons = this.qChild('viewButtons');
        this.localListen(this.lblMode, 'click', function (evt) {
            // toggle between selected/playing/visualization
            let changed;
            if (_this.mode == 'playingTrack') {
                changed = _this.activateMode('selectedTrack');
            }
            else if (_this.mode == 'selectedTrack') {
                if (artWindowModes.visualization.visible()) {
                    changed = _this.activateMode('visualization');
                }
                else
                    changed = _this.activateMode('playingTrack');
            }
            else {
                changed = _this.activateMode('playingTrack');
            }
            if (changed)
                _this.trackChangeRegister();
            evt.stopPropagation();
        });
        this.registerEventHandler('keydown');
        let tabBox = this.qChild('tabBox');
        // issue #17405
        // min size of derived from min size of Youtube window: https://developers.google.com/youtube/terms/required-minimum-functionality
        // count with 4px border and 12px reserve
        tabBox.style.minWidth = minsize + 'px';
        tabBox.style.minHeight = minsize + 'px';
        if (this.visible)
            this._setMinHeight();
        let artwork = this.qChild('artwork');
        this.artwork = artwork;
        this.artworkLayer = this.qChild('artworkLayer');
        this.localListen(artwork, 'click', function (evt) {
            _this.showArtworkDetail();
            evt.stopPropagation();
        });
        //this.localListen(artwork, 'click', this.toggleShowProperties);       
        setVisibilityFast(artwork, false);
        this.unknownAA = qe(div, '[data-id=unknownAA]');
        setVisibilityFast(this.unknownAA, false);
        this.propsLayer = this.qChild('propsLayer');
        this.propsLayer.style.maxHeight = 'inherit'; // to make lyrics layer scrollable        
        this.propsLayer.tabIndex = 0;
        this.propsBgLayer = this.qChild('propsBase');
        this.localListen(this.propsBgLayer, 'click', this.showArtworkDetail.bind(this) /*this.toggleShowProperties*/); // #15042
        this.localListen(this.propsLayer, 'click', (e) => {
            if (this._fieldsEditable)
                e.stopPropagation(); // #15042 - stop propagation, seems strange that clicking empty area brings artwork when editing fields
        });
        this.localListen(this.propsLayer, 'focusin', (evt) => {
            let el = evt.target;
            if (this.propsLayer.contains(el)) {
                let id = el.getAttribute('data-id');
                let idx = -1;
                this._fillTabbableDivs(true);
                if (this._tabbableDivs) {
                    for (let i = 0; i < this._tabbableDivs.length; i++) {
                        if (this._tabbableDivs[i].id === id) {
                            idx = i;
                            break;
                        }
                    }
                }
                if (idx >= 0) {
                    this._focusedIdx = idx;
                }
            }
        });
        this.localListen(this.propsLayer, 'focus', (evt) => {
            // received focus, detect all accessible fields
            if (!isUsingKeyboard() || this._goAway) {
                return;
            }
            this._fillTabbableDivs();
        });
        this.localListen(this.propsLayer, 'blur', () => {
            this._goAway = false;
            this._tabbableDivs = [];
        });
        this.localListen(this.propsLayer, 'dblclick', (e) => {
            this.showArtworkDetail(); // #15042 - seems to make sense to always show the artwork on double-clicking properties layer
            e.stopPropagation();
        });
        this.dataSource = null;
        this.localListen(document.body, 'itemselectchange', this.onTrackFocus.bind(this), true);
        this.localListen(document.body, 'focusedcontrol', function (evt) {
            let control = evt.detail.control;
            if (control && this.__lastFocusedControl != control) {
                if (control.getFocusedItemLink) {
                    let link = control.getFocusedItemLink();
                    if (link) {
                        _this._onNewFocusedLink(link);
                    }
                }
                this.__lastFocusedControl = evt.detail.control;
            }
        }.bind(this));
        let player = app.player;
        let switcher = undefined;
        let btnFullWindow = this.qChild('btnMode_fullwindow');
        let btnFullScreen = this.qChild('btnMode_fullscreen');
        let btnView = this.qChild('btnView');
        addEnterAsClick(this, btnFullWindow);
        addEnterAsClick(this, btnFullScreen);
        btnFullWindow.tabIndex = -1;
        btnFullScreen.tabIndex = -1;
        this.localListen(btnFullWindow, 'click', function () {
            if (switcher) {
                switcher.controlClass.switchToMode(window.videoModes.C_FULLWINDOW);
            }
        });
        this.localListen(btnFullScreen, 'click', function () {
            if (switcher) {
                switcher.controlClass.switchToMode(window.videoModes.C_FULLSCREEN);
            }
        });
        btnView.controlClass.tabIndex = -1;
        btnView.controlClass.menuArray = this.layoutSubmenuItems;
        this.onPlaybackState = function (state) {
            if (state == 'trackChanged') {
                if (_this.mode == 'playingTrack')
                    _this.trackChangeRegister();
            }
            if (!switcher && ((state === 'play') || (state === 'unpause'))) {
                prepareWindowModeSwitching();
                switcher = qid('videoSwitch');
                if (switcher) {
                    _this.localListen(switcher, 'contentvisibilitychanged', function (e) {
                        setVisibilityFast(_this.modeButtons, e.detail.visible);
                        setVisibilityFast(_this.viewButtons, !e.detail.visible);
                    });
                    setVisibilityFast(_this.modeButtons, isVisible(switcher.controlClass.contentControl, false));
                    setVisibilityFast(_this.viewButtons, !isVisible(switcher.controlClass.contentControl, false));
                }
            }
        };
        this.localListen(player, 'playbackState', this.onPlaybackState);
        this.trackChangeRegister();
        this.tabBox = tabBox;
        tabBox.lastWidth = 0;
        tabBox.lastHeight = 0;
        this.registerEventHandler('layoutchange');
        if (player.isPlaying)
            whenReady(() => this.onPlaybackState('play')); // #19449
    }
    activateMode(newMode) {
        if (newMode !== this.mode) {
            let prevItem = artWindowModes[this.mode];
            let modeItem = artWindowModes[newMode];
            if (modeItem && resolveToValue(modeItem.visible, true)) {
                if (prevItem && prevItem.deactivate)
                    prevItem.deactivate(this);
                modeItem.activate(this, true);
                return true;
            }
        }
        return false;
    }
    _getTrackAsync(link) {
        return new Promise(function (resolve) {
            let obj = link.getFastAccess();
            if (obj && obj.objectType === 'track')
                resolve(link.get());
            else if (obj && obj.objectType === 'album') {
                obj.getTracklist().whenLoaded().then(function (list) {
                    if (list.count) {
                        list.locked(function () {
                            resolve(list.getValue(0));
                        });
                    }
                    else
                        resolve(null);
                });
            }
            else
                resolve(null);
        });
    }
    _onNewFocusedLink(link) {
        this.requestIdle(() => {
            if (!this._anyFieldInEdit()) {
                this._getTrackAsync(link).then((newTrack) => {
                    if (newTrack) {
                        this.selectedTrack = newTrack;
                        if (this.mode == 'selectedTrack')
                            this.trackChangeRegister();
                    }
                });
            }
        }, '_onTrackFocus');
    }
    onTrackFocus(e) {
        const activeElement = document.activeElement;
        if (activeElement && (e.target == activeElement)) { // update only if calling element was active, ignore changes in not active LV, #21488
            this._onNewFocusedLink(e.detail.link);
        }
    }
    _registerListeners() {
        this.localListen(document.body, 'maintabchange', function (e) {
            if (this.mode == 'selectedTrack') {
                this._lastTabSelectedTrack = this._lastTabSelectedTrack || {};
                if (e.detail.oldTabPanel)
                    this._lastTabSelectedTrack[e.detail.oldTabPanel.controlClass.uniqueID] = this.selectedTrack;
                if (this._lastTabSelectedTrack[e.detail.newTabPanel.controlClass.uniqueID]) {
                    this.selectedTrack = this._lastTabSelectedTrack[e.detail.newTabPanel.controlClass.uniqueID];
                    this.trackChangeRegister();
                }
            }
        }.bind(this));
        let inittm = Date.now();
        let firstCall = true;
        this.localListen(document.body, 'viewchange', (e) => {
            if (this.mode == 'selectedTrack') {
                if (e.detail.income.view == e.detail.outcome.view)
                    return; // just a view refresh, skip it, we would cause the first item being selected otherwise (in _selectFirstTrack below)
                // based on suggestions in #13987:                
                let panel = e.detail.income.panel;
                let node = e.detail.income.view.viewNode;
                this.requestTimeout(() => {
                    if (firstCall) {
                        firstCall = false;
                        if (this.selectedTrack && ((Date.now() - inittm) < 5000)) // already selected during init, do not override
                            return;
                    }
                    this._selectFirstTrack(panel, node);
                }, 500, 'selectTrackAfterViewChangeTm');
            }
            else
                firstCall = false;
        });
        this.localListen(document.body, 'visVisibilityChanged', function (e) {
            if (e.detail.visible) {
                this.mode = 'visualization';
            }
            else {
                this.mode = this._lastNonvisMode || 'playingTrack';
            }
        }.bind(this));
        this.localListen(settings.observer, 'change', () => {
            this._makeFieldsEditable(this._fieldsEditable && window.uitools.getCanEdit());
            this.refresh(true); // to refresh also the layout (to hide/show the hotlinks)
        });
    }
    _getPanelSubControls(panel) {
        let result = [];
        let searchControl = (ctrl) => {
            let cls = ctrl.controlClass;
            if (cls)
                result.push(ctrl);
        };
        searchControl(panel);
        forEach(panel.querySelectorAll('div'), searchControl);
        return result;
    }
    _selectFirstTrack(panel, node) {
        let found;
        let controls = this._getPanelSubControls(panel);
        for (let item of controls) {
            if (item.controlClass && item.controlClass.dataSource) {
                let clsname = item.controlClass.constructor.name;
                let ds = item.controlClass.dataSource;
                if (clsname == 'TracklistFilter' || clsname == 'NodeListView' || clsname == 'Dropdown' || !ds.objectType /*|| !(ds.objectType.indexOf('list') > 0)*/)
                    continue;
                if (!ds.isLoaded && ds.whenLoaded) {
                    ODS('A&D: First item not loaded yet within ' + clsname + ', dataSource: ' + ds.objectType);
                    // first control dataSource is not loaded yet, schedule another attempt to fetch the first track 
                    cancelPromise(this._lastSelectFirstControlPr);
                    this._lastSelectFirstControlPr = ds.whenLoaded();
                    this.localPromise(this._lastSelectFirstControlPr).then(() => {
                        this._lastSelectFirstControlPr = null;
                        this._selectFirstTrack(panel, node);
                    }, () => {
                        this._lastSelectFirstControlPr = null; // otherwise caused leak (#21234)
                    });
                    return;
                }
                let itm;
                let idx = 0;
                ds.locked(() => {
                    if (ds.count) {
                        let foc_idx = item.controlClass.focusedIndex;
                        if (foc_idx > 0 && foc_idx < ds.count)
                            idx = foc_idx;
                        itm = getValueAtIndex(ds, idx);
                    }
                });
                if (itm) {
                    ODS('A&D: Using item ' + itm.objectType + ' (index ' + idx + ') within ' + clsname + ', dataSource: ' + ds.objectType);
                    if (itm.objectType == 'track') {
                        this.selectedTrack = itm;
                        this.trackChangeRegister();
                        if (item.controlClass.setFocusedAndSelectedIndex)
                            item.controlClass.setFocusedAndSelectedIndex(idx);
                        found = true;
                        break;
                    }
                    else {
                        if (itm.getTracklist) { // like artist, album, genre                                              
                            this._setFirstTrackFrom(itm.getTracklist());
                            if (item.controlClass.setFocusedAndSelectedIndex)
                                item.controlClass.setFocusedAndSelectedIndex(idx);
                            found = true;
                            break;
                        }
                    }
                }
            }
        }
        if (!found && node && node.dataSource && node.dataSource.getTracklist) {
            let tracklist = node.dataSource.getTracklist();
            if (tracklist) {
                tracklist.autoUpdateDisabled = true;
                ODS('A&D: Not found any usable item within view controls, using node dataSource tracklist: ' + node.dataSource.objectType);
                this._setFirstTrackFrom(tracklist);
            }
        }
    }
    _setFirstTrackFrom(tracklist) {
        cancelPromise(this._lastFirstTrackPr);
        this._lastFirstTrackPr = tracklist.whenLoaded();
        this.localPromise(this._lastFirstTrackPr).then(() => {
            this._lastFirstTrackPr = null;
            let track;
            if (tracklist.count)
                track = getValueAtIndex(tracklist, 0);
            this.selectedTrack = track;
            this.trackChangeRegister();
        }, () => {
            this._lastFirstTrackPr = null;
        });
    }
    trackChangeRegister() {
        this._unregisterPropertyChange();
        this._registerPropertyChange();
    }
    _updateMonitoredTrack() {
        if (this.dataSource && this.dataSource.isSame(this.monitoredTrack)) {
            if (!this._anyFieldInEdit()) { // to fix #15792 - item 5, and #15830
                this.artworkObject = this.track; // to force also artwork refresh
                if (!this.monitoredTrack.getCanSearchLyrics())
                    this.foundLyrics = undefined;
                let focusedElement = document.activeElement;
                if (this.container.contains(focusedElement)) {
                    this._previousFocusedID = focusedElement.getAttribute('data-id');
                }
                this.refresh(true);
            }
        }
    }
    _unregisterPropertyChange() {
        if (this.monitoredTrack) {
            if (this.__trackChangeFunc) {
                app.unlisten(this.monitoredTrack, 'change', this.__trackChangeFunc);
                this.__trackChangeFunc = undefined;
            }
            if (this.__trackGlobalChangeFunc) {
                app.unlisten(app, 'trackChange', this.__trackGlobalChangeFunc);
                this.__trackGlobalChangeFunc = undefined;
            }
        }
    }
    _registerPropertyChange() {
        if (this.mode == 'playingTrack') {
            this.monitoredTrack = app.player.getCurrentTrack();
        }
        else {
            this.monitoredTrack = this.selectedTrack;
        }
        if (this.monitoredTrack) {
            if (this.monitoredTrack.idsong > 0)
                this.__trackChangeFunc = app.listen(this.monitoredTrack, 'change', this._updateMonitoredTrack.bind(this));
            else { // for nonlibrary files use this, as they could not share data and events
                this.__trackGlobalChangeFunc = app.listen(app, 'trackChange', function (track) {
                    if (track && track.isWeakSame(this.monitoredTrack)) {
                        if (track.isSame(this.monitoredTrack))
                            this._updateMonitoredTrack();
                        else {
                            if (track.cuePath != '')
                                return;
                            // not same non library SD, need to reload tags from file
                            if (!this.__reloadingTags || !this.__reloadingTags.isSame(this.monitoredTrack)) {
                                this.__reloadingTags = this.monitoredTrack;
                                app.trackOperation.reloadTagsFromFile(this.monitoredTrack).then1(function () {
                                    this.__reloadingTags = undefined;
                                }.bind(this));
                            }
                        }
                    }
                }.bind(this));
            }
        }
        this.dataSource = this.monitoredTrack;
        if ((this.mode !== 'visualization') && uitools.globalSettings && (uitools.globalSettings.lastVideoMode === window.videoModes.C_WINDOWED)) {
            let showVideoContent = (app.player.isPlaying || app.player.paused) && this.monitoredTrack && this.monitoredTrack.isVideo && this.mode == 'playingTrack';
            if (window.playerUtils)
                window.playerUtils.showHideVideoContent(showVideoContent);
            let modeButtons = this.qChild('modeButtons');
            if (modeButtons) {
                setVisibility(modeButtons, showVideoContent);
            }
            let viewButtons = this.qChild('viewButtons');
            if (viewButtons) {
                setVisibility(viewButtons, !showVideoContent);
            }
        }
        //this._updateMonitoredTrack(); // LS: why it was here?? (orig by Petr in SVN revision 28117), but this way the dataSource setter was called twice (resulting in double loading of artwork thumb etc.)
    }
    showArtworkDetail(evt) {
        if (!this.artwork || !this.artworkObject || !isVisible(this.artwork, false))
            return; // no artwork displayed -> no detail
        if (evt && evt.stopPropagation)
            evt.stopPropagation();
        let pars = {
            modal: true,
        };
        if (this.artworkObject.objectType == 'track')
            pars.trackItem = this.artworkObject;
        else if (this.artworkObject.objectType == 'cover')
            pars.coverItem = this.artworkObject;
        else if (this.artworkObject.objectType == 'album')
            pars.dataObject = this.artworkObject;
        uitools.openDialog('dlgArtworkDetail', pars);
    }
    // JL: Split into two sections to avoid mid-frame layout recalculations
    adjust_transparency() {
        this.adjust_transparency_prepare();
        this.adjust_transparency_apply();
    }
    adjust_transparency_prepare() {
        this._stylesCache = this._stylesCache || {};
        this._stylesCache.heightDiff = this.tabBox.lastHeight - this.tabBox.lastWidth / this._artworkAR;
        this._stylesCache.propsLayerOffset = this.propsLayer.offsetHeight + this.propsLayer.offsetTop;
    }
    adjust_transparency_apply() {
        // LS: to behave like in MM4, i.e. so that artwork is not grayed out when the text layer isn't overflowing it
        if (this._stylesCache.heightDiff > (this._stylesCache.propsLayerOffset) || this.usePartialOverflow) {
            this.propsLayer.classList.toggle('transparentBackground', true);
            this.propsBgLayer.classList.toggle('transparentBackground', false);
        }
        else {
            this.propsLayer.classList.toggle('transparentBackground', false);
            this.propsBgLayer.classList.toggle('transparentBackground', true);
        }
    }
    handle_layoutchange(evt) {
        if (this.visible) {
            this._setMinHeight();
            queryLayoutAfterFrame(() => {
                let w = this.tabBox.clientWidth;
                let h = this.tabBox.clientHeight;
                this.adjust_transparency_prepare();
                if ((w === this.tabBox.lastWidth) && (h === this.tabBox.lastHeight))
                    return;
                this.tabBox.lastWidth = w;
                this.tabBox.lastHeight = h;
                applyStylingAfterFrame(() => {
                    if (this.artwork.classList.contains('coverImage')) { // set only for cover displayed with this style, i.e. filled to the whole window
                        this.artwork.style.maxWidth = w;
                        this.artwork.style.maxHeight = h;
                    }
                    this.unknownAA.style.maxWidth = w;
                    this.unknownAA.style.maxHeight = h;
                    // next 2 lines are workaround, otherwise Chromium does not use 100% of the height for some reason sometimes, e.g. after application start
                    this.unknownAA.style.width = w;
                    this.unknownAA.style.height = h;
                    this.requestIdle(() => this._loadArtworkLayer(false), '_loadArtworkLayer');
                    this.adjust_transparency_apply();
                    // store settings to the disc for case system will restart/shutdown as it's problem for us to catch this situation
                    this.requestTimeout(() => {
                        uitools.storeUIState();
                        app.flushState();
                    }, 500, '_savePreviewSizeTimeout');
                });
            });
        }
        if (evt)
            super.handle_layoutchange(evt);
    }
    canDrop(e) {
        return this.dndEventsRegistered && dnd.isAllowedType(e, 'cover');
    }
    drop(e) {
        let _this = this;
        if (dnd.droppingFileNames(e) && this.track) {
            let track = this.track;
            let items = dnd.getDragObject(e, 'cover');
            items.whenLoaded().then(() => {
                items.locked(function () {
                    for (let i = 0; i < items.count; i++) {
                        let imageLink = items.getValue(i);
                        uitools.addNewArtwork(imageLink, {
                            track: track,
                            showApply2Album: (track.album !== ''),
                            showReplace: true
                        }).then(function () {
                            _this.refresh(); // to load the new image thumb
                        });
                    }
                });
            });
        }
    }
    /*
    toggleShowProperties() {
        if (this.showProperties)
            this.showProperties = false;
        else
            this.showProperties = true;
        setVisibilityFast(this.propsLayer, this.showProperties);
        setVisibilityFast(this.propsBgLayer, this.showProperties);
        this.refresh(true);
    }*/
    _getMenuArray() {
        let _this = this;
        function isTrackUnassigned() {
            return !_this.track;
        }
        function isTrackArtworkDisplayed() {
            return _this.showArtworkLayer && _this.artwork && isVisible(_this.artwork, false) && _this.artworkObject && ((_this.artworkObject.objectType !== 'album') || (_this.artworkObject.itemImageType !== 'notsavedimage'));
        }
        let menuArray = [];
        if (window.uitools.getCanEdit()) {
            menuArray.push({
                title: actions.coverLookup.title,
                icon: actions.coverLookup.icon,
                disabled: () => {
                    return isTrackUnassigned() || !window.uitools.getCanEdit();
                },
                execute: function () {
                    searchTools.searchAAImageDlg(_this.track, _this.refresh.bind(_this), {
                        showApply2Album: (_this.track.album !== ''),
                        showReplace: true
                    });
                },
                grouporder: 1,
                grouptitle: _('Preview'),
                order: 10
            });
            menuArray.push({
                title: _('Paste'),
                icon: 'paste',
                disabled: function (params) {
                    return isTrackUnassigned() || !uitools.canPasteClipboard(_this.canDrop.bind(_this));
                },
                execute: function () {
                    let track = _this.track;
                    let coverList = track.loadCoverListAsync();
                    let loadedPromise = coverList.whenLoaded();
                    loadedPromise.then(function () {
                        uitools.pasteItem(_this.container);
                    });
                },
                grouporder: 1,
                order: 20
            });
            menuArray.push({
                title: _('Remove image'),
                icon: 'delete',
                disabled: () => {
                    return isTrackUnassigned() || !window.uitools.getCanEdit();
                },
                visible: isTrackArtworkDisplayed,
                execute: function () {
                    let track = _this.track;
                    let coverList = track.loadCoverListAsync();
                    let loadedPromise = coverList.whenLoaded();
                    loadedPromise.then(function () {
                        if (coverList.count > 0)
                            coverList.modifyAsync(function () {
                                coverList.delete(0);
                                track.commitAsync();
                                _this.refresh(); // to load the new image thumb
                            });
                    });
                },
                grouporder: 1,
                order: 30
            });
            menuArray.push({
                title: _('Save thumbnail'),
                disabled: () => {
                    return isTrackUnassigned() || !window.uitools.getCanEdit();
                },
                visible: function () {
                    return _this.track && _this.track.isVideo;
                },
                execute: function () {
                    app.trackOperation.generateThumbnailAsync(_this.track);
                },
                grouporder: 1,
                order: 40
            });
            menuArray.push({
                title: _('Save image'),
                icon: 'save',
                disabled: () => {
                    return isTrackUnassigned() || !window.uitools.getCanEdit();
                },
                visible: function () {
                    return !!_this.saveArtwork;
                },
                execute: function () {
                    _this.saveArtwork();
                },
                order: 50
            });
            menuArray.push({
                title: _('Save lyrics'),
                icon: 'save',
                disabled: () => {
                    return isTrackUnassigned() || !window.uitools.getCanEdit();
                },
                visible: function () {
                    return _this.track && _this.foundLyrics;
                },
                execute: function () {
                    let track = _this.track;
                    track.setLyricsAsync(_this.foundLyrics).then(function () {
                        _this.foundLyrics = undefined;
                        track.commitAsync();
                    });
                },
                grouporder: 1,
                order: 60
            });
        }
        menuArray.push({
            title: _('Images'),
            disabled: isTrackUnassigned,
            visible: isTrackArtworkDisplayed,
            submenu: function () {
                return new Promise(function (resolve, reject) {
                    let track = _this.track;
                    let coverList = track.loadCoverListAsync();
                    let loadedPromise = coverList.whenLoaded();
                    loadedPromise.then(function () {
                        let menuItems = [];
                        coverList.locked(function () {
                            if (coverList.count > 0) {
                                for (let i = 0; i < coverList.count; i++) {
                                    let cover = coverList.getValue(i);
                                    let tit = _('Image') + ' ' + (i + 1);
                                    let desc = cover.coverTypeDesc;
                                    if (desc != '')
                                        tit = tit + ': ' + cover.coverTypeDesc;
                                    let item = {
                                        title: tit,
                                        cover: cover,
                                        index: i,
                                        checked: function () {
                                            if (_this.artworkObject.objectType == 'track')
                                                return (this.index == 0);
                                            else if (_this.artworkObject.objectType == 'cover')
                                                return (_this.artworkObject.persistentID == this.cover.persistentID);
                                        },
                                        radiogroup: 'image',
                                        execute: function () {
                                            _this.artworkObject = this.cover;
                                            _this.refresh(); // to load the new image thumb
                                        }
                                    };
                                    menuItems.push(item);
                                }
                            }
                            else {
                                menuItems.push({
                                    title: _('No images')
                                });
                            }
                        });
                        resolve(menuItems);
                    }, reject);
                });
            },
            grouporder: 1,
            order: 70
        });
        menuArray.push({
            title: _('Properties') + '...',
            icon: 'properties',
            disabled: isTrackUnassigned,
            execute: function () {
                let tracks = app.utils.createTracklist(true /*loaded*/);
                tracks.add(_this.track);
                let _allTracks;
                if (_this.mode == 'selectedTrack')
                    _allTracks = uitools.getTracklist();
                else
                    _allTracks = app.player.getSongList().getTracklist();
                uitools.openDialog('dlgTrackProperties', {
                    modal: true,
                    tracks: tracks,
                    //selectTab: 'tabArtwork'
                    allTracks: _allTracks
                });
            },
            grouporder: 1,
            order: 80
        });
        // menuArray.push(menuseparator);
        let layoutSubmenuItems = function () {
            let menuItems = [];
            let layouts = getSortedAsArray(window.artDetailsLayouts);
            for (let i = 0; i < layouts.length; i++) {
                let l = layouts[i];
                let item = {
                    title: l.title,
                    key: l.key,
                    //checkable: true,
                    checked: function () {
                        return (_this.layout == this.key);
                    },
                    radiogroup: 'artwindowlayout',
                    execute: function () {
                        _this.layout = this.key;
                    },
                    hotlinkIcon: undefined,
                    hotlinkExecute: undefined
                };
                if (l.supportsFieldsSelector) {
                    item.hotlinkIcon = 'options';
                    item.hotlinkExecute = function () {
                        let trackType;
                        if (_this.track)
                            trackType = _this.track.trackType;
                        let w = uitools.openDialog('dlgChooseFields', {
                            modal: true,
                            trackType: trackType,
                            maskSet: 'preview',
                            height: thisWindow.bounds.height,
                            width: 400,
                            config: {
                                trackType: true,
                                columnCount: true,
                                sortable: true
                            }
                        });
                        app.listen(w, 'closed', function () {
                            _this.refresh(true); // to refresh also the layout (not only the data)
                        });
                    };
                }
                menuItems.push(item);
            }
            return menuItems;
        };
        this.layoutSubmenuItems = layoutSubmenuItems;
        this.dockMenuItems = {
            title: _('Layout'),
            icon: 'customize',
            submenu: layoutSubmenuItems,
            visible: () => {
                return !window.settings.UI.disableRepositioning;
            }
        };
        if (window.uitools.getCanEdit()) {
            menuArray.push({
                title: _('Layout') + '...',
                icon: 'options',
                execute: function () {
                    window.uitools.showOptions('pnl_LayoutPreview');
                },
                visible: window.uitools.getCanEdit,
                grouporder: 2,
                order: 10
            });
            menuArray.push({
                title: _('Show image'),
                checkable: true,
                checked: function () {
                    let sett = window.settings.get('System');
                    return sett.System.ShowCoverInAAWindow;
                },
                visible: function () {
                    let layout = window.artDetailsLayouts[_this.layout];
                    return layout && !layout.hideArtworkLayer;
                },
                execute: function () {
                    let sett = window.settings.get('System');
                    sett.System.ShowCoverInAAWindow = !sett.System.ShowCoverInAAWindow;
                    window.settings.set(sett, 'System');
                    _this.showArtworkLayer = sett.System.ShowCoverInAAWindow;
                    _this._loadArtworkLayer();
                },
                grouporder: 2,
                order: 20
            });
            menuArray.push({
                title: _('Allow edits'),
                icon: 'edit',
                checkable: true,
                checked: function () {
                    return _this._fieldsEditable;
                },
                disabled: () => {
                    return isTrackUnassigned() || !window.uitools.getCanEdit();
                },
                visible: function () {
                    let layout = window.artDetailsLayouts[_this.layout];
                    return layout && layout.supportsFieldsEdit;
                },
                execute: function () {
                    // toggle edit mode
                    if (_this._fieldsEditable)
                        _this._fieldsEditable = false;
                    else
                        _this._fieldsEditable = true;
                    app.setValue('artWindowEditable', _this._fieldsEditable);
                    _this._makeFieldsEditable(_this._fieldsEditable && window.uitools.getCanEdit());
                    _this.refresh(true); // to refresh also the layout (to hide/show the hotlinks)
                },
                grouporder: 2,
                order: 30
            });
        }
        menuArray.push({
            action: actions.view.visualization,
            grouporder: 2,
            order: 30
        });
        return menuArray;
    }
    focusFirstEnabled(back, col) {
        if (!this._tabbableDivs.length || (this._focusedIdx === -1)) {
            return;
        }
        let div = this._tabbableDivs[this._focusedIdx].div;
        let len = this._tabbableDivs.length;
        let colID = undefined;
        let step = back ? -1 : 1;
        let origIdx = this._focusedIdx;
        if (col) {
            colID = this._tabbableDivs[this._focusedIdx].col;
            this._focusedIdx += step;
            if (this._focusedIdx >= len)
                this._focusedIdx = 0;
            else if (this._focusedIdx < 0) {
                this._focusedIdx = len - 1;
            }
            div = this._tabbableDivs[this._focusedIdx].div;
        }
        if (!isElementDisabled(div) && (!col || (colID === this._tabbableDivs[this._focusedIdx].col))) {
            div.focus();
            setFocusState(div, true);
            return;
        }
        let i = this._focusedIdx + step;
        if (i < 0)
            i = this._tabbableDivs.length - 1;
        else if (i >= this._tabbableDivs.length)
            i = 0;
        while (i !== origIdx) {
            div = this._tabbableDivs[i].div;
            if (!isElementDisabled(div) && (!col || (colID === this._tabbableDivs[i].col))) {
                this._focusedIdx = i;
                div.focus();
                setFocusState(div, true);
                return;
            }
            i += step;
            if (i < 0)
                i = this._tabbableDivs.length - 1;
            else if (i >= this._tabbableDivs.length)
                i = 0;
        }
        if (!col)
            this._focusedIdx = -1;
    }
    _fillTabbableDivs(fromFocusIn) {
        this._tabbableDivs = [];
        if (this._fieldsEditable) {
            forEach(qes(this.propsLayer, '[data-control-class=Editable], [data-control-class=Rating]'), (el) => {
                if (isVisible(el)) {
                    el.tabIndex = -1; // focusable only by our handling
                    let rc = el.getBoundingClientRect();
                    let col = 1;
                    if (el.hasAttribute('data-col')) {
                        col = Number(el.getAttribute('data-col'));
                    }
                    this._tabbableDivs.push({
                        div: el,
                        left: rc.left,
                        top: rc.top,
                        col: col,
                        id: el.getAttribute('data-id')
                    });
                }
            });
        }
        forEach(qes(this.propsLayer, '.clickable, .hotlink'), (el) => {
            if (isVisible(el)) {
                el.tabIndex = -1; // focusable only by our handling
                let rc = el.getBoundingClientRect();
                let col = 1;
                if (el.hasAttribute('data-col')) {
                    col = Number(el.getAttribute('data-col'));
                }
                else {
                    let parentEl = el.parentElement;
                    if (parentEl.hasAttribute('data-col'))
                        col = Number(parentEl.getAttribute('data-col'));
                }
                this._tabbableDivs.push({
                    div: el,
                    left: rc.left,
                    top: rc.top,
                    col: col,
                    hotlink: true
                });
            }
        });
        if (this._tabbableDivs.length) {
            this._tabbableDivs.sort(function (d1, d2) {
                let retval = d1.top - d2.top;
                if ((retval > -10) && (retval < 10)) // some reserve for different margins/padding
                    retval = d1.left - d2.left;
                return retval;
            });
            if (!fromFocusIn) {
                let idx = 0;
                if (this._previousFocusedID) {
                    for (let i = 0; i < this._tabbableDivs.length; i++) {
                        if (this._tabbableDivs[i].id === this._previousFocusedID) {
                            idx = i;
                            break;
                        }
                    }
                    this._previousFocusedID = undefined;
                }
                this._focusedIdx = idx;
                this.focusFirstEnabled();
            }
        }
        else {
            this._focusedIdx = -1;
        }
    }
    _makeFieldsEditable(value) {
        forEach(qes(this.propsLayer, '[data-control-class=Editable]'), function (el) {
            if (el.controlClass) {
                el.controlClass.autoEditOnFocus = false;
                el.controlClass.editable = value;
            }
        });
        true;
    }
    _anyFieldInEdit() {
        let res = false;
        forEach(qes(this.propsLayer, '[data-control-class=Editable]'), function (el) {
            if (el.controlClass && el.controlClass.inEdit)
                res = true;
        });
        if (!res && document.activeElement) {
            forEach(qes(this.propsLayer, '[data-control-class=Rating]'), function (el) {
                if (el.controlClass && (el.controlClass.canvas === document.activeElement))
                    res = true;
            });
        }
        return res;
    }
    handle_keydown(e) {
        if (!this._tabbableDivs || !this._tabbableDivs.length)
            return;
        let key = friendlyKeyName(e);
        let focusedElement = document.activeElement;
        if (focusedElement && (key !== 'Tab') && ((focusedElement.nodeName == 'INPUT') || (focusedElement.hasAttribute('contenteditable')) || (this.propsLayer && !this.propsLayer.contains(focusedElement))))
            return;
        let handled = false;
        let back = false;
        let colMove = false;
        switch (key) {
            case 'Home':
                this._focusedIdx = 0;
                handled = true;
                break;
            case 'End':
                this._focusedIdx = this._tabbableDivs.length - 1;
                handled = true;
                back = true;
                break;
            case 'Left':
                if (this._focusedIdx < 0)
                    break;
                this._focusedIdx--;
                if (this._focusedIdx < 0)
                    this._focusedIdx = this._tabbableDivs.length - 1;
                handled = true;
                back = true;
                break;
            case 'Right':
                this._focusedIdx++;
                if (this._focusedIdx >= this._tabbableDivs.length)
                    this._focusedIdx = 0;
                handled = true;
                break;
            case 'Up':
                if (this._focusedIdx < 0)
                    break;
                handled = true;
                back = true;
                colMove = true;
                break;
            case 'Down':
                handled = true;
                colMove = true;
                break;
            case 'F2':
                if (focusedElement) {
                    if (this._fieldsEditable) {
                        let el = focusedElement;
                        if (el.controlClass && (el.controlClass.constructor.name === 'Rating')) {
                            el.controlClass.focus(true);
                        }
                    }
                    e.stopPropagation();
                }
                break;
            case 'Tab':
                if (e.shiftKey) {
                    if ((this._focusedIdx > 0) && this._anyFieldInEdit()) {
                        this._focusedIdx--;
                        handled = true;
                    }
                    else {
                        this._goAway = true;
                        this.propsLayer.focus(); // needed so default handling can skip to previous tabable element
                    }
                }
                else {
                    if (this._anyFieldInEdit() && (this._focusedIdx < (this._tabbableDivs.length - 1))) {
                        this._focusedIdx++;
                        handled = true;
                    }
                }
                if (handled) {
                    e.preventDefault();
                    this.focusFirstEnabled(back, colMove);
                    e.stopPropagation();
                    let focusedElement = document.activeElement;
                    if (this._fieldsEditable) {
                        let el = focusedElement;
                        if (el.controlClass) {
                            if (el.controlClass.constructor.name === 'Rating')
                                el.controlClass.focus(true);
                            else if (el.controlClass.constructor.name === 'Editable')
                                el.controlClass.startEditMode();
                        }
                    }
                    handled = false;
                }
                break;
            case 'Esc':
                e.stopPropagation(); // to not propagate Esc to search bar, which changes focus
                break;
            case 'Enter':
                if (focusedElement) {
                    if ((this._focusedIdx >= 0) && (this._focusedIdx < this._tabbableDivs.length)) {
                        let obj = this._tabbableDivs[this._focusedIdx];
                        if (obj.hotlink) {
                            simulateFullClick(obj.div);
                            e.stopPropagation();
                            e.preventDefault();
                        }
                    }
                }
                break;
        }
        if (handled) {
            this.focusFirstEnabled(back, colMove);
            e.stopPropagation();
            e.preventDefault();
        }
    }
    unlistenFields() {
        forEach(this._fieldListeners, function (unlistenFunc) {
            unlistenFunc();
        });
        this._fieldListeners = [];
    }
    getFontSize() {
        let size = '1em';
        let s = app.getValue('artWindow', {
            fontSize: 'smaller'
        });
        if (s.fontSize == 'smaller')
            size = '0.85em';
        else if (s.fontSize == 'smallest')
            size = '0.7em';
        else if (s.fontSize == 'larger')
            size = '1.2em';
        else if (s.fontSize == 'largest')
            size = '2em';
        return size;
    }
    getColumnCount() {
        let res = app.getValue('artWindow', {
            columnCount: 2
        });
        return Number(res.columnCount);
    }
    setPropertiesLayer(track, lyrics, newAssignment, newLayout, notSameTracks) {
        if (this._cleanUpCalled)
            return;
        if (newAssignment)
            this.unlistenFields();
        newLayout = newLayout || (this._lastLayout != this.layout);
        if (newLayout && this._lastLayout) {
            let oldLayout = window.artDetailsLayouts[this._lastLayout];
            if (oldLayout.onLayoutClose)
                oldLayout.onLayoutClose(this);
        }
        this._lastLayout = this.layout;
        let layout = window.artDetailsLayouts[this.layout];
        let _scrollTop = this.propsBgLayer.scrollTop;
        setVisibilityFast(this.propsBgLayer, !window.fullWindowModeActive);
        if (window.fullWindowModeActive)
            this.propsBgLayer.wasVisibleBeforeFullWindow = true;
        setVisibilityFast(this.propsLayer, true);
        layout.setPropertiesLayer(this, track, lyrics, newAssignment, newLayout);
        let artworkSearchLink = this.qChild('artworkSearchLink');
        if (newAssignment) {
            this.artworkTextRow = this.qChild('artworkTextRow');
            this.artworkParagraph = this.qChild('artworkParagraph');
            if (this.artworkTextRow)
                setVisibility(this.artworkTextRow, false);
            if (this.artworkParagraph)
                setVisibility(this.artworkParagraph, !!artworkSearchLink);
            if (artworkSearchLink) {
                setVisibility(artworkSearchLink, window.uitools.getCanEdit());
                let imgSearchRun = () => {
                    if (!this.track || _utils.isOnlineTrack(this.track))
                        return;
                    if (this.track.isVideo) {
                        app.trackOperation.generateThumbnailAsync(this.track);
                        return;
                    }
                    searchTools.searchAAImageDlg(this.track, function () {
                        if (this.artworkObject.objectType !== 'track')
                            this.artworkObject = track;
                        this.refresh();
                    }.bind(this), {
                        showApply2Album: (this.track.album !== ''),
                        showReplace: true
                    });
                };
                let _lf1 = app.listen(artworkSearchLink, 'click', (evt) => {
                    evt.stopPropagation();
                    imgSearchRun();
                });
                let _lf2 = app.listen(artworkSearchLink, 'keydown', (evt) => {
                    if (friendlyKeyName(evt) === 'Enter') {
                        evt.stopPropagation();
                        imgSearchRun();
                    }
                });
                this._fieldListeners.push(function () {
                    app.unlisten(artworkSearchLink, 'click', _lf1);
                    app.unlisten(artworkSearchLink, 'keydown', _lf2);
                });
            }
        }
        let ratingControl = this.qChild('ratingControl');
        if (ratingControl) {
            ratingControl.controlClass.value = track.rating;
            if (this.ratingControl)
                app.unlisten(this.ratingControl);
            let _lf = app.listen(ratingControl, 'change', () => {
                let bykey = isUsingKeyboard();
                if (!bykey) {
                    track.rating = ratingControl.controlClass.value;
                    track.commitAsync();
                }
                else {
                    this.requestTimeout(() => {
                        track.rating = ratingControl.controlClass.value;
                        track.commitAsync();
                    }, 1000, 'ratingchange');
                }
            });
            this._fieldListeners.push(function () {
                app.unlisten(ratingControl, 'change', _lf);
            });
            this.ratingControl = ratingControl;
        }
        if (!notSameTracks)
            this.propsBgLayer.scrollTop = _scrollTop;
    }
    startLyricsSearching(force) {
        if (this.track != this._lyricsSearchTrack) {
            this._lyricsSearchTrack = this.track;
            let _this = this;
            if (this.lyricsSearchPromise)
                cancelPromise(this.lyricsSearchPromise);
            if (_this.lyricsParagraph) {
                _this.lyricsParagraph.innerHTML =
                    '<label data-add-dots>Searching</label>' +
                        '<div data-icon="progress" class="icon inline"></div>';
                initializeControls(_this.lyricsParagraph); // due to data-icon above        
            }
            this.lyricsSearchPromise = searchTools.searchLyrics(this.track, _this.saveLyrics, force);
            let lPromise = this.lyricsSearchPromise;
            this.lyricsSearchPromise.then(function (lyrics) {
                if (_this.lyricsSearchPromise && !_this.lyricsSearchPromise.canceled) {
                    if (lyrics !== '') {
                        if (!_this.saveLyrics)
                            _this.foundLyrics = lyrics;
                        _this.refresh(true); // to refresh also the layout (for the newly found lyrics)
                    }
                    else {
                        if (_this.lyricsParagraph)
                            _this.lyricsParagraph.innerText = _('Lyrics not found');
                    }
                }
                _this.lyricsSearchPromise = undefined;
                _this._lyricsSearchTrack = undefined;
            }, function () {
                if (lPromise === _this.lyricsSearchPromise) { // clear only when not searching already something different, #18612
                    _this.lyricsSearchPromise = undefined;
                    _this._lyricsSearchTrack = undefined;
                }
            });
        }
    }
    searchArtwork(save, fromAutoSearch) {
        let origTrack = this.track;
        let _this = this;
        // try to find the artwork of the album, then use image searching
        // do not search for album image, if album is not known, it would not get good results and we cannot save the image to album for later use
        // for videos create thumb from the video itself, do not search on web
        if (_utils.isOnlineTrack(origTrack))
            return;
        if (!origTrack.isVideo) {
            if (((origTrack.idalbum > 0) || (origTrack.album && (origTrack.albumArtist || origTrack.artist))) && (this.artworkObject.objectType !== 'album')) {
                if (this.artworkTextRow && (!fromAutoSearch || (window.searchTools.searchMissingArtwork && origTrack.album))) { // do not replace with Searching progress when searching only in album, not on web with album name
                    setVisibility(this.artworkTextRow, true);
                    if (this.artworkParagraph) {
                        cleanElement(this.artworkParagraph, true);
                        this.artworkParagraph.innerHTML =
                            '<label data-add-dots>Searching</label>' +
                                '<div data-icon="progress" class="icon inline"></div>';
                        initializeControls(this.artworkParagraph); // due to data-icon above    
                    }
                }
                let isCD = _utils.isAudioCDTrack(origTrack);
                app.getObject('album', {
                    id: origTrack.idalbum,
                    name: origTrack.album,
                    artist: origTrack.albumArtist || origTrack.artist,
                    canCreateNew: isCD,
                    checkInstances: !isCD // otherwise could cause crash for audioCD
                }).then(function (album) {
                    if (origTrack != _this.track)
                        return;
                    if (album) {
                        localPromise(album.getSearchedCoverAsync()).then(function (ci) {
                            if (origTrack != _this.track)
                                return;
                            if (ci) {
                                _this.artworkObject = ci;
                                _this._loadArtworkLayer(false, true /* from search */, fromAutoSearch);
                            }
                            else {
                                // cover not found
                                _this.artworkObject = album;
                                _this._loadArtworkLayer(false, true /* from search */, fromAutoSearch);
                            }
                        });
                    }
                }, function () {
                    // album not found
                    if (_this.artworkTextRow && !_this._cleanUpCalled) {
                        setVisibility(_this.artworkTextRow, true);
                        if (_this.artworkParagraph) {
                            let artworkSearchLink = qeid(_this.artworkParagraph, 'artworkSearchLink');
                            if (!artworkSearchLink)
                                cleanElement(_this.artworkParagraph, true); // to clean the 'Searching for artwork...'
                        }
                    }
                });
            }
            else if (this.artworkTextRow) {
                setVisibility(this.artworkTextRow, true);
            }
        }
        else {
            if (!fromAutoSearch || window.searchTools.autoGenThumbs)
                app.trackOperation.generateThumbnailAsync(origTrack);
            else {
                if (this.artworkTextRow)
                    setVisibility(this.artworkTextRow, true);
                if (this.artworkParagraph)
                    setVisibility(this.artworkParagraph, true);
            }
        }
    }
    autoSearchArtwork() {
        let sett = settings.get('Options');
        if (this._autoAASearchTrack != this.track) {
            this._autoAASearchTrack = this.track;
            let autoSave = sett.Options.SaveMissingArtwork && window.uitools.getCanEdit();
            this.searchArtwork(autoSave, true /* from auto search*/);
        }
        else {
            if (this.artworkTextRow)
                setVisibility(this.artworkTextRow, true);
            if (this.artworkParagraph)
                setVisibility(this.artworkParagraph, true);
        }
    }
    _loadArtworkLayer(newAssignment, fromSearch, fromAutoSearch, afterError) {
        if (this._cleanUpCalled)
            return;
        this.artworkLayer = this.qChild('artworkLayer'); // we have to re-set this, it could be overwritten in previous custom layout
        setVisibilityFast(this.artworkLayer, this.showArtworkLayer);
        this.adjust_transparency();
        if (!this.showArtworkLayer)
            return;
        this.artwork = this.qChild('artwork'); // we have to re-set this, it could be overwritten in previsou custom layout
        this.unknownAA = this.qChild('unknownAA');
        this.artwork.controlClass = this.artwork.controlClass || new Control(this.artwork);
        if (!this.artwork.controlClass.loadListener) {
            this.artwork.controlClass.localListen(this.artwork, 'load', function () {
                if (this.artwork.naturalHeight && this.artwork.naturalWidth) {
                    this._artworkAR = this.artwork.naturalWidth / this.artwork.naturalHeight;
                    this.adjust_transparency();
                }
            }.bind(this));
            this.artwork.controlClass.loadListener = true;
        }
        if (!this.artwork.controlClass.loadFailedListener) {
            this.artwork.controlClass.localListen(this.artwork, 'error', function () {
                setVisibilityFast(this.artwork, false);
                setVisibilityFast(this.unknownAA, true);
                if (this.saveArtworkButton)
                    setVisibilityFast(this.saveArtworkButton, false);
                if (this.srcAsAssigned && _utils.isImageFile(this.srcAsAssigned)) {
                    ODS('Failed to load ' + this.srcAsAssigned);
                    if (afterError) {
                        // do not try again to avoid deadlock
                        this.srcAsAssigned = undefined;
                        app.utils.clearThumbPathsCache();
                    }
                    else {
                        app.filesystem.deleteURLFileAsync(this.srcAsAssigned).then((wasDeleted) => {
                            this.srcAsAssigned = undefined;
                            app.utils.clearThumbPathsCache();
                            this._loadArtworkLayer(true, fromSearch, fromAutoSearch, true /* after error */);
                        });
                    }
                }
            }.bind(this));
            this.artwork.controlClass.loadFailedListener = true;
        }
        if (this.artworkPromise) { // @ts-ignore
            newAssignment |= !!this.artworkPromise.newAssignment; // keep newAssignment setting, if previous was not finished yet
            this.artworkPromise.cancel();
            this.artworkPromise = null;
        }
        let track = this.dataSource;
        this.saveArtwork = undefined;
        if (this.artworkObject && this.showArtworkLayer) {
            let params = {
                canReturnAlbumArtwork: ((this.artworkObject.objectType !== 'album') && (!track.isVideo)),
                isAutoSearch: fromAutoSearch,
                newArtworkObject: undefined
            };
            this.hideTimer = this.requestTimeout(() => {
                setVisibilityFast(this.artwork, false);
                setVisibilityFast(this.unknownAA, true);
                this.hideTimer = undefined;
            }, 250, 'hidePreviousArtwork');
            let cancelToken = uitools.getItemThumb(this.artworkObject, this.tabBox.lastWidth, this.tabBox.lastHeight, function (path, pathToOrigCachedFile) {
                if (this.hideTimer) {
                    clearTimeout(this.hideTimer);
                    this._timeoutIDs['hidePreviousArtwork'] = undefined;
                    this.hideTimer = undefined;
                }
                this.artworkPromise = undefined;
                if (this._cleanUpCalled || (track !== this.dataSource))
                    return;
                if (params.newArtworkObject)
                    this.artworkObject = params.newArtworkObject;
                if (path && (path !== '-')) {
                    setVisibilityFast(this.artwork, true);
                    setVisibilityFast(this.unknownAA, false);
                    this.srcAsAssigned = path;
                    this.artwork.src = path;
                    let artVis = false;
                    if ((this.artworkObject.objectType === 'album' && this.artworkObject.id > 0 /* e.g. not Audio CD*/) || ((this.artworkObject.objectType === 'cover') && (this.artworkObject.coverStorage === 2 /*not saved artwork*/))) {
                        let sett = settings.get('Options');
                        if (!sett.Options.SaveMissingArtwork) {
                            // we have not saved image from album, possible path to full image in pathToOrigCachedFile, display save possibility
                            if (this.artworkParagraph && window.uitools.getCanEdit()) {
                                artVis = true;
                                cleanElement(this.artworkParagraph, true);
                                this.artworkParagraph.innerHTML = '<div data-id="saveArtwork" data-icon="save" data-tip="Save image to tag or file folder" class="clickable inline icon verticalTextBottom vSeparatorTiny" data-control-class="Control"></div>';
                                initializeControls(this.artworkParagraph); // due to data-icon above
                                this.saveArtworkButton = this.artworkParagraph.controlClass.qChild('saveArtwork');
                                this.saveArtwork = function (evt) {
                                    let callAdd = function (picturePath) {
                                        uitools.addNewArtwork(picturePath, {
                                            track: this.track,
                                            showReplace: true,
                                            showApply2Album: true
                                        }).then(function (res) {
                                            if (res && res.done && (track == this.track)) {
                                                cleanElement(this.artworkParagraph, true);
                                                this.saveArtwork = undefined;
                                                if (this.artworkTextRow) {
                                                    setVisibility(this.artworkTextRow, false);
                                                }
                                                if (this.artworkParagraph)
                                                    setVisibility(this.artworkParagraph, false);
                                                this.artworkObject = this.track; // saved to track, so we should read it from track next time
                                            }
                                        }.bind(this));
                                    }.bind(this);
                                    if (pathToOrigCachedFile) {
                                        callAdd(pathToOrigCachedFile);
                                    }
                                    else {
                                        // get path to orig. size picture
                                        uitools.getItemThumb(this.artworkObject, 0, 0, function (path0) {
                                            if (this.track == track) {
                                                callAdd(path0);
                                            }
                                        }.bind(this));
                                    }
                                    if (evt)
                                        evt.stopPropagation();
                                }.bind(this);
                                this.saveArtworkButton.controlClass.localListen(this.saveArtworkButton, 'click', this.saveArtwork);
                                this.saveArtworkButton.controlClass.localListen(this.saveArtworkButton, 'keydown', (evt) => {
                                    if (friendlyKeyName(evt) === 'Enter')
                                        this.saveArtwork(evt);
                                });
                                this.saveArtworkButton.controlClass.addCleanFunc(function () {
                                    this.saveArtworkButton = undefined;
                                }.bind(this));
                            }
                        }
                    }
                    if (this.artworkTextRow)
                        setVisibility(this.artworkTextRow, artVis);
                    if (this.artworkParagraph)
                        setVisibility(this.artworkParagraph, artVis);
                }
                else {
                    this.srcAsAssigned = undefined;
                    setVisibilityFast(this.artwork, false);
                    setVisibilityFast(this.unknownAA, true);
                    if (this.saveArtworkButton)
                        setVisibilityFast(this.saveArtworkButton, false);
                    if (newAssignment && !fromSearch) {
                        this.autoSearchArtwork();
                    }
                    else {
                        if (this.artworkTextRow && this.artworkParagraph && (fromSearch || (this.artworkObject.objectType === 'album'))) {
                            let artworkSearchLink = this.qChild('artworkSearchLink');
                            if (!artworkSearchLink) { // search link is present only if searching artwork in album a not on web (when searchMissingArtwork is false)
                                cleanElement(this.artworkParagraph, true);
                                this.artworkParagraph.innerText = _('Artwork not found');
                            }
                        }
                        if (this.artworkTextRow)
                            setVisibility(this.artworkTextRow, true);
                        if (this.artworkParagraph)
                            setVisibility(this.artworkParagraph, true);
                    }
                }
            }.bind(this), params);
            this.artworkPromise = {
                cancel: function () {
                    app.cancelLoaderToken(cancelToken);
                    this.artworkPromise = undefined;
                    if (this.hideTimer) {
                        clearTimeout(this.hideTimer);
                        this._timeoutIDs['hidePreviousArtwork'] = undefined;
                        this.hideTimer = undefined;
                    }
                }.bind(this),
                newAssignment: newAssignment
            };
        }
    }
    storeState() {
        let state = {};
        state.mode = this._lastNonvisMode || this.mode;
        state.layout = this.layout;
        state.visible = isVisible(this.container, false);
        return state;
    }
    restoreState(state) {
        if (state && state.mode)
            this.mode = state.mode;
        if (state && state.layout)
            this.layout = state.layout;
        if (state.visible !== undefined)
            setVisibility(this.container, state.visible);
    }
    cleanUp() {
        this._unregisterPropertyChange();
        this.unlistenFields();
        this._tabbableDivs = [];
        super.cleanUp();
    }
    refresh(alsoLayout) {
        this._layoutChangeRequest = alsoLayout;
        this.dataSource = this.track;
        this._layoutChangeRequest = false;
    }
    ignoreHotkey(hotkey) {
        let ar = ['Right', 'Left', 'Up', 'Down', 'Enter', 'Home', 'End', 'Esc', 'F2'];
        return inArray(hotkey, ar, true /* ignore case */);
    }
    get dataSource() {
        return this.track;
    }
    set dataSource(track) {
        let notSameTracks = ((!this.track && track) || (this.track && !track) || (this.track && track && !this.track.isSame(track)));
        let newLayout = this._layoutChangeRequest;
        let newAssignment = notSameTracks || newLayout;
        if (notSameTracks) {
            this.artworkObject = track; // artworkObject can be also cover item selected via the 'Images' submenu
            this.saveArtwork = undefined;
            this.foundLyrics = undefined;
        }
        if (notSameTracks)
            this.track = track;
        if (this.artworkPromise) { // @ts-ignore
            newAssignment |= !!this.artworkPromise.newAssignment; // keep newAssignment setting, if previous was not finished yet
            this.artworkPromise.cancel();
            this.artworkPromise = null;
        }
        if (this.propsPromise) { // @ts-ignore
            newAssignment |= !!this.propsPromise.newAssignment; // keep newAssignment setting, if previous was not finished yet
            this.propsPromise.cancel();
            this.propsPromise = null;
        }
        if (this.lyricsSearchPromise) {
            cancelPromise(this.lyricsSearchPromise);
            this.lyricsSearchPromise = undefined;
            this._lyricsSearchTrack = undefined;
        }
        if (track) {
            if (this.settingDSPending && !notSameTracks) // already waiting for this request and nothing changed
                return;
            this.settingDSPending = true;
            this.requestTimeout(function () {
                this.settingDSPending = false;
                if (track && this.track && (track.isSame(this.track))) { // track has not been changed, load the props.
                    let __loadArtwork = () => {
                        if (newAssignment)
                            cloudTools.addRemoteArtwork(this.track).then1(() => this._loadArtworkLayer(newAssignment));
                        else
                            this._loadArtworkLayer(newAssignment);
                    };
                    if (this.showProperties) {
                        this.propsPromise = track.getLyricsAsync();
                        this.propsPromise.newAssignment = newAssignment;
                        this.propsPromise.then(function (lyrics) {
                            this.propsPromise = undefined;
                            if (lyrics)
                                this.foundLyrics = undefined;
                            else if (this.foundLyrics)
                                lyrics = this.foundLyrics;
                            this.setPropertiesLayer(track, lyrics, newAssignment, newLayout, notSameTracks);
                            __loadArtwork();
                        }.bind(this));
                    }
                    else {
                        __loadArtwork();
                    }
                }
            }.bind(this), 50, '_loadPropsTm');
        }
        else {
            if (this.artwork)
                setVisibilityFast(this.artwork, false);
            if (this.unknownAA)
                setVisibilityFast(this.unknownAA, true);
            if (this.propsLayer)
                setVisibilityFast(this.propsLayer, false);
        }
    }
    get mode() {
        return this._mode;
    }
    set mode(value) {
        if (value === this._mode)
            return;
        let newMode = artWindowModes[value];
        if (newMode) {
            newMode.activate(this);
        }
        else {
            assert(false, 'Art+Details window: Unknown track mode: ' + value);
        }
        if (value !== 'visualization') {
            this.raiseEvent('detailsModeChanged', {
                newMode: value
            });
        }
    }
    get layout() {
        return this._layoutKey;
    }
    set layout(value) {
        let layout = window.artDetailsLayouts[value];
        if (layout) {
            this._layoutKey = value;
            this.showArtworkLayer = !layout.hideArtworkLayer;
            if (this.showArtworkLayer) {
                let sett = window.settings.get('System');
                this.showArtworkLayer &= sett.System.ShowCoverInAAWindow;
            }
            if (this.track) {
                let track = this.track;
                if (this.propsPromise) {
                    this.propsPromise.cancel();
                }
                this.propsPromise = track.getLyricsAsync();
                this.propsPromise.then(function (lyrics) {
                    this.propsPromise = undefined;
                    this.setPropertiesLayer(track, lyrics, true);
                    this._loadArtworkLayer();
                }.bind(this));
            }
        }
    }
}
registerClass(ArtWindow);
/*
artDetailsLayouts allows to utilize 'Art & Details' panel

By adding new handler here you can create new custom layout
*/
window.artDetailsLayouts = {};
let minsize = 220; // min size of art window
/* 'Artwork only' layout definition */
window.artDetailsLayouts.artworkOnly = {
    title: _('Artwork only'),
    order: 10,
    setPropertiesLayer: function (artWindow, track, lyrics, newAssignment, newLayout) {
        artWindow.artwork.classList.toggle('bottom', false);
        let div = artWindow.propsLayer;
        if (newLayout) {
            // backup style, we will change it, so background will be only under Save icon
            div._rightBackup = div.style.right;
            div._paddingLeft = div.style.paddingLeft;
            div._paddingTop = div.style.paddingTop;
            div.style.right = '';
            div.style.paddingLeft = '0px';
            div.style.paddingTop = '0px';
            cleanElement(div, true);
            setVisibilityFast(div, true);
            // prepare div for possible artwork Save icon
            div.innerHTML =
                '   <div data-id="artworkParagraph" class="inline" data-control-class="Control">' +
                    '   </div>';
            initializeControls(div);
            // Add left/right arrows to flip through images like in a photo gallery (#17078)
            artWindow.selectCoverIndex = (index) => {
                let track = artWindow.track;
                ODS('artWindow.selectCoverIndex: ' + index);
                let coverList = track.loadCoverListAsync();
                artWindow.localPromise(coverList.whenLoaded()).then(function () {
                    coverList.locked(function () {
                        if ((index >= 0) && (index < coverList.count) && (index != artWindow.currentCoverIndex)) {
                            let cover = coverList.getValue(index);
                            artWindow.artworkObject = cover;
                            artWindow.currentCoverIndex = index;
                            artWindow.refresh(); // to load the new image thumb
                        }
                    });
                    setVisibility(artWindow.leftArrow, index > 0);
                    setVisibility(artWindow.rightArrow, index < coverList.count - 1);
                });
            };
            let parentLayer = artWindow.propsBgLayer;
            if (!artWindow.leftArrow) {
                let div = document.createElement('div');
                div.className = 'alignLeft';
                div.setAttribute('data-control-class', 'IconButton');
                initializeControl(div);
                div.controlClass.icon = 'leftArrow';
                parentLayer.appendChild(div);
                div.controlClass.localListen(div, 'click', (e) => {
                    artWindow.selectCoverIndex(artWindow.currentCoverIndex - 1);
                    e.stopPropagation();
                });
                artWindow.leftArrow = div;
            }
            if (!artWindow.rightArrow) {
                let div = document.createElement('div');
                div.className = 'alignRight';
                div.setAttribute('data-control-class', 'IconButton');
                initializeControl(div);
                parentLayer.appendChild(div);
                div.controlClass.icon = 'rightArrow';
                div.controlClass.localListen(div, 'click', (e) => {
                    artWindow.selectCoverIndex(artWindow.currentCoverIndex + 1);
                    e.stopPropagation();
                });
                artWindow.rightArrow = div;
            }
        }
        if (newAssignment) {
            artWindow.selectCoverIndex(0);
        }
    },
    onLayoutClose: function (artWindow) {
        let div = artWindow.propsLayer;
        if (div._rightBackup !== undefined)
            div.style.right = div._rightBackup;
        if (div._paddingLeft !== undefined)
            div.style.paddingLeft = div._paddingLeft;
        if (div._paddingTop !== undefined)
            div.style.paddingTop = div._paddingTop;
        removeElement(artWindow.leftArrow);
        artWindow.leftArrow = undefined;
        removeElement(artWindow.rightArrow);
        artWindow.rightArrow = undefined;
        artWindow.selectCoverIndex = undefined;
    }
};
/* 'Simple' layout definition */
window.artDetailsLayouts.simple = {
    title: _('Basic'),
    order: 20,
    setPropertiesLayer: function (artWindow, track, lyrics, newAssignment, newLayout) {
        artWindow.artwork.classList.toggle('bottom', true);
        let div = artWindow.propsLayer;
        if (div._fieldListeners) {
            // unlisten listeners added in templates.itemImageFunc()
            forEach(div._fieldListeners, function (unlistenFunc) {
                unlistenFunc();
            });
            div._fieldListeners = null;
        }
        if (newLayout) {
            cleanElement(div, true);
            setVisibilityFast(div, true);
            let fontSize = artWindow.getFontSize();
            div.innerHTML = '<div style="text-align: center; font-size: ' + fontSize + '">' +
                '  <div data-id="fArtist" data-bind="call: trackHyperlinks.artist"></div>' +
                '  <div data-id="fTitle" data-bind="func: templates.propertyHandler(div, item, el, {type: \'title\'});"></div>' +
                '  <div data-id="ratingControl" tabindex="-1" class="inline" data-control-class="Rating" data-init-params="{starMargin: 1}"></div>' +
                '  <div data-id="fAlbum" class="hSeparatorTiny" data-bind="call: trackHyperlinks.album"></div>' +
                '  <div data-id="artworkParagraph" class="inline" data-control-class="Control"></div>' +
                '  <div data-id="fLyrics" data-bind="func: el.innerText=params.lyrics; setVisibilityFast(el, !!el.textContent);"></div>' +
                '</div>';
            initializeControls(div);
            recompileBinding(div, artWindow);
        }
        if (artWindow.bindFn) {
            artWindow.bindFn(div, track, {
                lyrics: lyrics
            });
        }
        artWindow.lyricsParagraph = artWindow.qChild('fLyrics');
    }
};
/* 'Advanced' layout definition (with editable and configurable fields) */
window.artDetailsLayouts.advanced = {
    title: _('Advanced'),
    order: 100,
    supportsFieldsSelector: true,
    supportsFieldsEdit: true,
    _createFieldHeading: function (mask) {
        let text = _(app.masks.getVisName(mask));
        let data_id = 'h_' + mask.substring(1);
        return '<label data-id="' + data_id + '" class="inline noLeftPadding">' + text + ': </label>';
    },
    _createFieldLayout: function (params) {
        let HTML = '';
        let mask = params.mask;
        let track = params.track;
        let artWindow = params.artWindow;
        params.col = params.col || '1';
        let col = ' data-col="' + params.col + '" ';
        if (mask === '%ZZG') {
            if (params.lyrics === '') {
                HTML = this._createFieldHeading(mask) + '<div data-id="lyricsParagraph" class="inline">';
                if (params.autoSearchLyrics && track && track.getCanSearchLyrics())
                    artWindow.requestTimeout(artWindow.startLyricsSearching.bind(artWindow), 200);
                else
                    HTML = HTML + '<a data-id="lyricsSearchLink" tabindex="0" class="hotlink">' + _('Lookup') + '</a>';
                HTML = HTML + '</div><br>';
            }
            else {
                HTML = this._createFieldHeading(mask) + '<div data-id="saveLyricsBtn" data-icon="save" data-tip="Save lyrics to tag" style="display: none" class="clickable inline icon verticalTextBottom" data-control-class="Control"></div><br>' + '<div data-id="lyricsParagraph" data-control-class="Editable" data-init-params="{multiline: true, tabbable: false, autoEditOnFocus: false}" class="margins" style="text-align: center" ' + col + '></div><br>'; // lyrics are centered
            }
            return '<div>' + HTML + '</div>';
        }
        if (mask === '%ZR') {
            HTML = this._createFieldHeading(mask) + '<div data-id="ratingControl" tabindex="-1" class="inline" data-control-class="Rating" data-init-params="{starMargin: 1, noFlex: true, starWidth:\'' + params.fontSize + '\'}"' + col + '></div>';
            return '<div>' + HTML + '</div>';
        }
        if (((mask === '%T') && (track.trackNumber === '')) ||
            ((mask === '%ZM') && (track.discNumber === '')) ||
            ((mask === '%ZZA') && (track.seasonNumber === '')) ||
            ((mask === '%ZZO') && (track.bps <= 0)) ||
            ((mask === '%ZY') && (track.episodeNumber === '')) ||
            ((mask === '%Y') && (track.year <= 0)) ||
            ((mask === '%ZP') && (track.date <= 0))) {
            return '';
        }
        let visMask = app.masks.mask2VisMask(mask);
        let maskValue = app.masks.getMaskResultForItem(track, visMask, false, true, false);
        if (maskValue != '') {
            let bind = '';
            if (!artWindow._fieldsEditable) {
                if (mask == '%A' /*artist*/)
                    bind = 'data-bind="call: trackHyperlinks.artist"';
                if (mask == '%R' /*album artist*/)
                    bind = 'data-bind="call: trackHyperlinks.albumArtist"';
                if (mask == '%L' /*album*/)
                    bind = 'data-bind="call: trackHyperlinks.album"';
                if (mask == '%G' /*genre*/)
                    bind = 'data-bind="call: trackHyperlinks.genre"';
                if ((mask == '%Y') || (mask == '%ZP') /*year*/)
                    bind = 'data-bind="call: trackHyperlinks.year"';
            }
            let editable = 'data-control-class="Editable" data-init-params="{editable: false, tabbable: false}" ' + col;
            HTML = this._createFieldHeading(mask) + '<div data-id="' + mask.substring(1) + '" ' + editable + bind + 'class="inline"></div>';
            HTML = '<div>' + HTML + '</div>';
        }
        return HTML;
    },
    _setFieldValue: function (artWindow, mask, track, newAssignment) {
        let elId = mask.substring(1);
        if (!elId)
            return;
        let editLine = artWindow.qChild(elId);
        if (editLine && !editLine.hasAttribute('data-bind')) { // fields with binding will be filled later in bindFn
            let visMask = app.masks.mask2VisMask(mask);
            let maskValue = app.masks.getMaskResultForItem(track, visMask, false, true, false);
            editLine.innerText = maskValue; // assign field value
            if (newAssignment) {
                // listener for 'live' edit:                      
                editLine.__listenFunc = app.listen(editLine, 'change', function (e) {
                    let value = this.innerText;
                    let fieldId = this.getAttribute('data-id');
                    artWindow.requestTimeout(() => {
                        let track = artWindow.track;
                        let visMask = app.masks.mask2VisMask('%' + fieldId);
                        app.trackOperation.assignFieldByMask(visMask, track, value);
                        track.commitAsync();
                    }, 1000, fieldId);
                });
                artWindow._fieldListeners.push(function () {
                    app.unlisten(this, 'change', this.__listenFunc);
                    this.__listenFunc = undefined;
                }.bind(editLine));
            }
        }
    },
    setPropertiesLayer: function (artWindow, track, lyrics, newAssignment) {
        artWindow.artwork.classList.toggle('bottom', true);
        let sett = settings.get('System, Options');
        let masks = sett.System['ShowDetailsInOrder' + track.trackType].split(';');
        masks = getDistinctArray(masks); // due to a bug from MM4
        if (newAssignment) {
            artWindow.unlistenFields();
            artWindow.saveLyrics = sett.Options.SaveMissingLyrics && window.uitools.getCanEdit();
            let autoSearchLyrics = sett.Options.SearchMissingLyrics;
            let fontSize = artWindow.getFontSize();
            let columnCount = artWindow.getColumnCount();
            let column1_HTML = '';
            let column2_HTML = '';
            let column3_HTML = '';
            let lyrics_HTML = '';
            if (artWindow.artworkParagraph) {
                cleanElement(artWindow.artworkParagraph);
                artWindow.artworkParagraph = undefined;
            }
            lyrics_HTML =
                '<div data-id="artworkTextRow" class="inline">' +
                    '   <label class="inline noLeftPadding" data-add-colon>Artwork</label>' +
                    '   <div data-id="artworkParagraph" class="inline" data-control-class="Control">' +
                    '       <a data-id="artworkSearchLink" class="hotlink" tabindex="0" data-control-class="Control">' + _('Lookup') + '</a>' +
                    '   </div>' +
                    '</div>';
            let params = {
                track: track,
                lyrics: lyrics,
                autoSearchLyrics: autoSearchLyrics,
                fontSize: fontSize,
                artWindow: artWindow,
                mask: null,
                col: 1
            };
            let _fieldNum = 0;
            let _col = 0;
            for (let i = 0; i < masks.length; i++) {
                params.mask = masks[i];
                _col = (_fieldNum % columnCount);
                params.col = 1 + _col;
                let fieldHTML = this._createFieldLayout(params);
                if (params.mask === '%ZZG') {
                    lyrics_HTML = lyrics_HTML + fieldHTML;
                }
                else {
                    if (_col == 0) // to be multi-column layout (#13406)
                        column1_HTML = column1_HTML + fieldHTML;
                    else if (_col == 1)
                        column2_HTML = column2_HTML + fieldHTML;
                    else
                        column3_HTML = column3_HTML + fieldHTML;
                    _fieldNum++;
                }
            }
            cleanElement(artWindow.propsLayer, true);
            setVisibilityFast(artWindow.propsLayer, true);
            let _HTML = '<div class="flex row" style="font-size: ' + fontSize + '">';
            if (column1_HTML != '')
                _HTML = _HTML + '    <div class="fill flex column autoMinWidth">' + column1_HTML + '</div>';
            if (column2_HTML != '')
                _HTML = _HTML + '    <div class="fill flex column autoMinWidth">' + column2_HTML + '</div>';
            if (column3_HTML != '')
                _HTML = _HTML + '    <div class="fill flex column autoMinWidth">' + column3_HTML + '</div>';
            _HTML = _HTML + '</div>';
            if (lyrics_HTML != '')
                _HTML = _HTML + '<div class="flex column" style="font-size: ' + fontSize + '">' + lyrics_HTML + '</div>';
            artWindow.propsLayer.innerHTML = _HTML;
            initializeControls(artWindow.propsLayer);
            recompileBinding(artWindow.propsLayer, artWindow);
            artWindow._makeFieldsEditable(artWindow._fieldsEditable && window.uitools.getCanEdit());
        }
        for (let i = 0; i < masks.length; i++) {
            this._setFieldValue(artWindow, masks[i], track, newAssignment);
        }
        if (artWindow.bindFn)
            artWindow.bindFn(artWindow.propsLayer, track, {
                lyrics: lyrics
            });
        let lyricsParagraph = artWindow.qChild('lyricsParagraph');
        let saveLyricsBtn = artWindow.qChild('saveLyricsBtn');
        if (saveLyricsBtn && newAssignment) {
            saveLyricsBtn.controlClass.tabIndex = 0;
            let saveL = function (evt) {
                if (artWindow.track && artWindow.foundLyrics) {
                    let track = artWindow.track;
                    track.setLyricsAsync(artWindow.foundLyrics).then(function () {
                        artWindow.foundLyrics = undefined;
                        track.commitAsync();
                    });
                }
                evt.stopPropagation();
            };
            saveLyricsBtn.controlClass.localListen(saveLyricsBtn, 'click', saveL);
            saveLyricsBtn.controlClass.localListen(saveLyricsBtn, 'keydown', (evt) => {
                if (friendlyKeyName(evt) === 'Enter') {
                    saveL(evt);
                }
            });
        }
        if (lyricsParagraph) {
            if (lyrics !== '') {
                lyricsParagraph.innerText = lyrics;
                if (newAssignment) {
                    let lyricsEditFunc = function (e) {
                        let value = this.innerText;
                        if (value.trim() === '')
                            value = '';
                        let track = artWindow.track;
                        track.setLyricsAsync(value, (!!artWindow.foundLyrics && !value)).then(function () {
                            artWindow.foundLyrics = undefined;
                            track.commitAsync();
                        });
                    };
                    app.listen(lyricsParagraph, 'change', lyricsEditFunc);
                    artWindow._fieldListeners.push(function () {
                        app.unlisten(lyricsParagraph, 'change', lyricsEditFunc);
                    });
                }
                if (saveLyricsBtn) {
                    setVisibilityFast(saveLyricsBtn, !!artWindow.foundLyrics);
                }
            }
            else {
                let lyricsSearchLink = artWindow.qChild('lyricsSearchLink');
                if (lyricsSearchLink && newAssignment) {
                    setVisibilityFast(lyricsSearchLink, window.uitools.getCanEdit());
                    let manualSearchLyricsFunc = function (evt) {
                        artWindow.saveLyrics = true; // we want to always save lyrics when clicked manually by user
                        artWindow.startLyricsSearching(true);
                        if (evt)
                            evt.stopPropagation();
                    };
                    app.listen(lyricsSearchLink, 'click', manualSearchLyricsFunc);
                    let kl = app.listen(lyricsSearchLink, 'keydown', (evt) => {
                        if (friendlyKeyName(evt) === 'Enter') {
                            evt.stopPropagation();
                            manualSearchLyricsFunc(evt);
                        }
                    });
                    artWindow._fieldListeners.push(function () {
                        app.unlisten(lyricsSearchLink, 'click', manualSearchLyricsFunc);
                        app.unlisten(lyricsSearchLink, 'keydown', kl);
                    });
                }
            }
        }
        artWindow.lyricsParagraph = lyricsParagraph;
        if (artWindow._previousFocusedID && artWindow._fieldsEditable) {
            requestFrame(() => {
                if (artWindow && artWindow._previousFocusedID && artWindow._fieldsEditable) {
                    artWindow._fillTabbableDivs();
                }
            });
        }
    }
};
let artWindowModes = {
    playingTrack: {
        title: function () {
            return _('Playing');
        },
        activate: function (owner) {
            owner.playingTrack = app.player.getFastCurrentTrack(owner.playingTrack);
            owner.lblMode.innerText = resolveToValue(this.title, '');
            owner._mode = 'playingTrack';
            owner._lastNonvisMode = owner._mode;
            owner.trackChangeRegister();
            owner.raiseEvent('detailsModeChanged', {
                newMode: owner._mode
            });
        },
        visible: true
    },
    selectedTrack: {
        title: function () {
            return _('Selected');
        },
        activate: function (owner) {
            owner.lblMode.innerText = resolveToValue(this.title, '');
            owner._mode = 'selectedTrack';
            owner._lastNonvisMode = owner._mode;
            owner.trackChangeRegister();
            owner.raiseEvent('detailsModeChanged', {
                newMode: owner._mode
            });
        },
        visible: function () {
            let player = app.player;
            let canShow = true;
            if (player.isPlaying) {
                let sd;
                sd = player.getFastCurrentTrack(sd);
                if (sd && _utils.isOnlineTrack(sd)) {
                    // YT videos (unlike standard videos) need to be always visible (due to licensing)
                    canShow = false;
                }
            }
            return canShow;
        }
    },
    visualization: {
        title: function () {
            return uitools.getPureTitle(actions.view.visualization.title);
        },
        activate: function (owner, manualCall) {
            if ((owner._mode !== 'visualization') && this.visible()) {
                owner.lblMode.innerText = this.title();
                owner._lastNonvisMode = owner._mode;
                owner._mode = 'visualization';
                owner.trackChangeRegister();
                owner.raiseEvent('detailsModeChanged', {
                    newMode: owner._mode
                });
                if (manualCall && !app.player.visualization.active)
                    actions.view.visualization.execute();
            }
        },
        visible: function () {
            let player = app.player;
            let canShow = false;
            if (!webApp && player.isPlaying && !player.paused) {
                let sd;
                sd = player.getFastCurrentTrack(sd);
                if (sd && !sd.isVideo && !_utils.isOnlineTrack(sd)) {
                    // YT videos (unlike standard videos) need to be always visible (due to licensing)
                    canShow = true;
                }
            }
            return canShow && !!q('[data-player-control=visualizer]') && !!q('[data-id=artWindow]');
        },
        deactivate: function () {
            if (app.player.visualization.active)
                actions.view.visualization.execute();
        },
    }
};
