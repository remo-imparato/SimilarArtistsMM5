/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

registerFileImport('templates');
'use strict';
import Control, { getPixelSize } from './controls/control';
import ProgressLine from './controls/progressline';
import Rating from './controls/rating';
import '/templateFormats';
import './helpers/color-thief';
/**
Custom extensions of the Window object.

@module DOMExtensions
*/
/**
Custom extensions of the Window object.

@class Window
*/
let isPartOutOfListview = function (d, lv) {
    if (lv._cleanUpCalled)
        return false;
    let totalPos = lv.container.getBoundingClientRect();
    let divPos = d.getBoundingClientRect();
    let isOut = ((divPos.left < totalPos.left) || (divPos.right > totalPos.right));
    if (isOut)
        return isOut;
    let p = getParent(lv.container);
    while (!isOut && p) {
        totalPos = p.getBoundingClientRect();
        isOut = ((divPos.left < totalPos.left) || (divPos.right > totalPos.right));
        if (!isOut)
            p = getParent(p);
    }
    return isOut;
};
// helper function to get ListView item from div
let getLVItem = function (div, item, idx) {
    let LV = div.parentListView;
    let itm = undefined;
    if (!LV) {
        if (item && !item.isFastAccessObject)
            itm = item;
    }
    else {
        if ((div._groupID !== undefined) && (LV && LV.dataSource)) {
            let group = LV.dataSource.getGroupByID(div._groupID);
            if (group) {
                itm = group.link.get();
            }
        }
        else {
            if (idx !== undefined) {
                itm = LV.getFastItem(idx);
            }
            else {
                itm = LV.getFastItem(div.itemIndex);
            }
        }
    }
    return itm;
};
// helper function for tooltip, have to be binded to the related div
let tooltipValueCallback = function (tipdiv, vis) {
    if (!vis) {
        return;
    }
    if (this.div.tooltipValueCallback) { // we will merge values if different, #18451
        this.div.tooltipValueCallback.call(this.el, tipdiv, vis, {});
    }
    if ((this.el.clientWidth < this.el.scrollWidth) || (this.div.parentListView && (isPartOutOfListview(this.el, this.div.parentListView)))) {
        if (this.div.tooltipValueCallback) {
            if (tipdiv.innerText.trim() !== this.el.innerText.trim()) {
                tipdiv.innerHTML = this.el.innerHTML + '<br>' + tipdiv.innerHTML;
            }
        }
        else
            tipdiv.innerHTML = this.el.innerHTML;
    }
    else if (!this.div.tooltipValueCallback)
        tipdiv.innerText = '';
};
let colorThief = new ColorThief();
let selectedStyle = undefined;
let hoverStyle = undefined;
let tbHoverStyle = undefined; // hover style of toolbutton
let getShiftedRGB = function (diff, rgbArr) {
    if (diff < 0)
        return 'rgb(' + Math.max(rgbArr[0] + diff, 0) + ', ' + Math.max(rgbArr[1] + diff, 0) + ', ' + Math.max(rgbArr[2] + diff, 0) + ')';
    else
        return 'rgb(' + Math.min(rgbArr[0] + diff, 255) + ', ' + Math.min(rgbArr[1] + diff, 255) + ', ' + Math.min(rgbArr[2] + diff, 255) + ')';
};
let paddingColumnSmallRight = undefined; // for aligning rating control
let ratingControlWidth = undefined; // for aligning rating column title
(function () {
    const showNoAA = 1, showImg = 2, showDiv = 3;
    let uniqueCounter = 1; // helper counter for unique IDs, alwas read as uniqueCounter++
    let cachedColors = {}; // Small memory cache for image colors, to reduce load time of grid view popup.
    let summaryColMapping = {
        'album': {
            bind: 'call: albumHyperlinks.album'
        },
        'albumArtist': {
            bind: 'call: albumHyperlinks.albumArtist'
        },
        'date': {
            bind: 'func: if (item.title !== \'\') { var fn = new Function(\'item\', \'return \'+trackFormat.year); el.textContent = (fn(item)); } else el.textContent = \'\';'
        },
        'rating': {
            bind: 'func: templates.albumRatingFunc(div, item, el, div.itemIndex, {position: \'left\'})',
            className: 'textEllipsis hSeparatorTiny'
        }
    };
    /**
     * Object for templates and template helper functions. Templates can use several custom attributes, described with {{#crossLink "Window/precompileBinding:method"}}{{/crossLink}}
     *
     * @property templates
     * @type Object
     */
    window.templates = {
        artworkClickFunc: function (artworkControl) {
            if (artworkControl.dataObject) {
                uitools.openDialog('dlgArtworkDetail', {
                    modal: true,
                    dataObject: artworkControl.dataObject,
                    imgPath: artworkControl.artworkImg.src
                });
            }
        },
        trackProperty: function (propName, div, album, el, params) {
            if (!params) {
                ODS('trackProperty - no params');
                return;
            }
            if (!params.track) {
                ODS('trackProperty - no track');
                return;
            }
            if ((album.title === '') && (album.albumArtist === '')) {
                ODS('trackProperty - unknown album');
                return;
            }
            let column = window.uitools.tracklistFieldDefs[propName];
            if (column.bindData) {
                el.itemIndex = div.itemIndex;
                column.bindData(el, params.track, div.itemIndex);
            }
            else if (column.getValue) {
                el.textContent = column.getValue(params.track);
            }
        },
        groupedTracklistByAlbum: function (div, params) {
            div.className = 'flex row'; // TODO: noOverflow
            let coverContainer = document.createElement('div');
            coverContainer.classList.add('lvColumnItem');
            //coverContainer.classList.add('stretchHeight');
            coverContainer.style.width = '11em';
            div.appendChild(coverContainer);
            coverContainer.controlClass = new Control(coverContainer, {
                canBeUsedAsSource: true
            }); // to allow adding context menu
            div.coverContainer = coverContainer;
            let imgBind = 'func: templates.itemImageFunc(div, item, div.itemIndex, {useCoverImage: true, isAutoSearch: true, registerChange: true, addListener: true, updateWhenChanged: true, saveImageFunc: templates.saveImageToAlbum, imgSearchFunc: searchTools.getAAImage, \
                      canSave: true, uid: \'' + this.uniqueID + '\', defaultPixelSize: 200, addContext: true, addLookup: true, makeDraggable: true});';
            if (params && params.imgBind) {
                imgBind = resolveToValue(params.imgBind, imgBind);
            }
            templates.imageItem(coverContainer, {
                imgBind: imgBind,
                noThumbIcon: 'unknownAA',
                noViewAction: true,
                useCoverImage: true
            });
            let details = document.createElement('div');
            div.appendChild(details);
            if (params && params.detailsCreate) {
                params.detailsCreate(div, details);
            }
            else {
                let bindFunc = function (type) {
                    return 'func: div.item = item; el.textContent = item.' + type + '; ';
                };
                let sumcols = undefined;
                if (div.parentListView) {
                    sumcols = div.parentListView.summaryColumns;
                }
                if (!sumcols) {
                    sumcols = ['album', 'albumArtist', 'date', 'rating'];
                }
                let dethtml = '';
                let scol, sclass, sbind;
                forEach(sumcols, (col) => {
                    scol = summaryColMapping[col];
                    if (scol) {
                        if (scol.className)
                            sclass = scol.className;
                        else
                            sclass = 'lvItem textEllipsis multiline hSeparatorTiny';
                        sbind = scol.bind;
                    }
                    else {
                        // standard track column
                        sclass = 'lvItem textEllipsis multiline hSeparatorTiny';
                        sbind = 'func: templates.trackProperty(\'' + col + '\', div, item, el, params)';
                    }
                    dethtml += sprintf('<div class="%s" data-id="%s" data-bind="%s"></div> ', sclass, 'lbl_' + col, sbind);
                });
                details.innerHTML = dethtml;
                details.classList.add('paddingRow');
            }
            if (details.children.length) {
                details.style.width = '19em';
                details.style.overflow = 'hidden';
                details.classList.add('flex');
                details.classList.add('fill');
                details.classList.add('column');
                details.classList.add('lvColumnItem');
            }
            div.artworkDiv = coverContainer.artworkDiv;
            div.artworkImg = coverContainer.artworkImg;
            div.noaa = coverContainer.noaa;
            div.details = details;
            for (let i = div.details.children.length - 1; i >= 0; i--) {
                let el = div.details.children[i];
                if (el.classList.contains('textEllipsis')) {
                    templates.addEllipsisTooltip(el, div);
                }
            }
            if (div.parentListView && isFunction(div.parentListView.groupColumnVisible)) {
                if (!div.parentListView.groupColumnVisible('group_album'))
                    div.details.style.display = 'none';
                if (!div.parentListView.groupColumnVisible('group_artwork'))
                    div.coverContainer.style.display = 'none';
            }
            coverContainer.controlClass.addCleanFunc(function () {
                if (div.loadingPromise) {
                    cancelPromise(div.loadingPromise);
                    div.loadingPromise = undefined;
                }
                div.coverContainer = undefined;
                div.artworkDiv = undefined;
                div.artworkImg = undefined;
                div.noaa = undefined;
                div.details = undefined;
            });
            coverContainer.classList.remove('imageItem'); // removed imageItem class so cover can be resized (by using header)
            let mouseUpHandler = function (e) {
                if (div.parentListView && div.parentListView.handleGroupSelection) {
                    div.parentListView.handleGroupSelection(div._groupID, e);
                    window.requestFrame(() => {
                        window._lastFocusedLVControl = div.parentListView.container;
                        window._lastFocusedLVControl.focus();
                    });
                }
            };
            coverContainer.controlClass.localListen(coverContainer, 'mousedown', mouseUpHandler);
            coverContainer.controlClass.localListen(details, 'mouseup', mouseUpHandler);
            let getAlbum = function () {
                let LV = div.parentListView;
                if (LV && (div._groupID !== undefined)) {
                    let group = LV.dataSource.getGroupByID(div._groupID);
                    if (group) {
                        return group.link.get();
                    }
                }
                return undefined;
            };
            // @ts-ignore
            coverContainer.controlClass.getTracklist = function () {
                let album = getAlbum();
                if (album) {
                    return album.getTracklist();
                }
            };
            // @ts-ignore
            coverContainer.controlClass.deleteSelected = function () {
                if (div.parentListView && div.parentListView.dataSource)
                    uitools.deleteTracklist(div.parentListView.dataSource.getSelectedTracklist());
            };
            coverContainer.controlClass.localListen(coverContainer, 'dblclick', function (e) {
                if (!div.coverContainer)
                    return;
                if (div.parentListView && div.parentListView.dataSource)
                    uitools.defaultItemAction(div.parentListView.dataSource.getSelectedTracklist());
            });
            dnd.makeImageDroppable(coverContainer, function (picturePath) {
                if (picturePath) {
                    let album = getAlbum();
                    if (album) {
                        uitools.addNewArtwork(picturePath, {
                            album: album,
                            showReplace: true
                        }).then(function () {
                            if (div.parentListView)
                                div.parentListView.rebind();
                        });
                    }
                }
            });
            //let maxHeight = '14em';
            //div.style.height = maxHeight;  // was really needed? Was causing #20987
            div.artworkDiv.style.width = '100%';
            initializeControls(div);
        },
        groupedTracklistByAlbumHeaders: [
            {
                disabled: function (usedLV) {
                    if (usedLV && usedLV.controlClass)
                        return !usedLV.controlClass.isGroupedView;
                    return true;
                },
                columnType: 'group_artwork',
                title: _('Artwork'),
                element: 'coverContainer',
                focusable: false,
                onGroupDivInit: function (div, column) {
                    if (column.width) {
                        let minHeight = column.minHeight;
                        let initWidth = column.width;
                        if (minHeight) {
                            initWidth = Math.floor(Math.max(initWidth, minHeight));
                        }
                        div.style.height = initWidth;
                        if (div.coverContainer) {
                            div.coverContainer.style.width = initWidth;
                            div.coverContainer.style.height = initWidth;
                        }
                        if (div.artworkDiv)
                            div.artworkDiv.style.height = initWidth;
                        if (div.noaa)
                            div.noaa.style.height = initWidth;
                        if (!this.groupHeight || this.groupHeight < initWidth) {
                            this.groupHeight = initWidth;
                            //ODS('--- 1 set this.groupHeight to ' + this.groupHeight);
                            this.groupsRecompute(false, true /* viewport size compute */); // recompute groups as we have changed size
                        }
                    }
                },
                onColumnResize: function (div) {
                    let minHeight = this.visibleColumns[div.column].minHeight;
                    if (!minHeight) {
                        minHeight = emToPx(3, this.container);
                        this.visibleColumns[div.column].minHeight = minHeight;
                    }
                    let newHeight = Math.floor(Math.max(minHeight || 20, this.visibleColumns[div.column].width));
                    if (!newHeight) { // column have no stored value ... use default size
                        newHeight = emToPx(11);
                        this.visibleColumns[div.column].width = newHeight;
                        div.style.flexBasis = newHeight + 'px';
                    }
                    this.groupHeight = newHeight;
                    //ODS('--- 2 set this.groupHeight to ' + this.groupHeight);
                    this.groupDivs.forEach((groupDiv) => {
                        groupDiv.style.height = newHeight;
                        if (groupDiv.coverContainer) {
                            groupDiv.coverContainer.style.width = newHeight;
                            groupDiv.coverContainer.style.height = newHeight;
                        }
                        if (groupDiv.artworkDiv)
                            groupDiv.artworkDiv.style.height = newHeight;
                        if (groupDiv.noaa)
                            groupDiv.noaa.style.height = newHeight;
                    });
                    if (this.dataSource) {
                        this.dataSource.setGroupsDimensions(newHeight, 0);
                        let idx = this.focusedIndex;
                        if (idx >= 0)
                            this._itemToShow = idx;
                    }
                    this.groupsRecompute(false, false, true);
                    this.requestTimeout(() => {
                        // force redrawing of groups with artworks, as artwork size could changed
                        this.groupDivs.forEach((groupDiv) => {
                            groupDiv.groupid = null;
                        });
                        this.deferredDraw();
                    }, 500, 'group_artwork_resize');
                },
                onResizeFinished: function (div) { },
                isGroupHeader: true,
                isSortable: false,
                isColMovable: false,
                visibleChange: function (visible) {
                    let _this = this;
                    if (this.groupDivs) {
                        this.groupDivs.forEach(function (groupDiv) {
                            if (groupDiv[_this.element])
                                groupDiv[_this.element].style.display = 'none';
                        });
                        this.itemHeightReset = true;
                        this.groupsRecompute(true, false, true);
                    }
                },
                visible: true,
                width: 100,
                groupIndex: 0,
                //fixed: true,
            },
            {
                disabled: function (usedLV) {
                    if (usedLV && usedLV.controlClass)
                        return !usedLV.controlClass.isGroupedView;
                    return true;
                },
                columnType: 'group_album',
                title: function (lv) {
                    return _('Summary');
                },
                visible: true,
                focusable: false,
                element: 'details',
                onColumnResize: function (div) {
                    if (!this.visibleColumns[div.column].width) {
                        let newWidth = this.getGroupDivSize(this.visibleColumns[div.column]);
                        if (newWidth) {
                            this.visibleColumns[div.column].width = newWidth;
                            div.style.flexBasis = newWidth + 'px';
                        }
                    }
                    this.groupsRecompute(false, false, true);
                },
                visibleChange: function (visible) {
                    let _this = this;
                    if (this.groupDivs) {
                        this.groupDivs.forEach(function (groupDiv) {
                            if (groupDiv[_this.element])
                                groupDiv[_this.element].style.display = 'none';
                        });
                        this.itemHeightReset = true;
                        this.groupsRecompute(true, false, true);
                    }
                },
                enumHeightSize: function (div) {
                    let lastCtrl = null;
                    if (!div.details)
                        return 0;
                    for (let i = div.details.children.length - 1; i >= 0; i--) {
                        let el = div.details.children[i];
                        if (isVisible(el)) {
                            lastCtrl = el;
                            break;
                        }
                    }
                    if (lastCtrl) {
                        return lastCtrl.offsetTop + lastCtrl.clientHeight;
                    }
                    else
                        return 0;
                },
                isGroupHeader: true,
                isSortable: true,
                isColMovable: false,
                //fixed: true,
                width: 100,
                groupIndex: 1,
            }
        ],
        addEllipsisTooltip: function (el, div) {
            if (el && div) {
                el.tooltipValueCallback = tooltipValueCallback.bind({
                    div: div,
                    el: el
                });
            }
        },
        propertyHandler: function (div, item, el, params) {
            params = params || {};
            let supportedTypes = ['track'];
            el.innerHTML = '';
            if (item && (supportedTypes.indexOf(item.objectType) >= 0)) {
                let t = params.type || 'title';
                el.textContent = item[t];
                setVisibilityFast(el, !!el.textContent);
            }
        },
        /*
        Function to generate hotlinks from object property (like track.artist) or from string with comma separated values.
        params.type are used to determine type of values (to correct navigation)
        */
        hotlinkHandler: function (div, item, el, params) {
            params = params || {};
            let supportedTypes = ['track', 'album', 'artist', 'genre', 'year', 'composer', 'producer', 'conductor', 'actor', 'publisher', 'director', 'albumartist'];
            let allowed = false;
            let text = '';
            let t = params.type || 'title';
            let multivalue = ((t != 'title') && (t != 'album'));
            let t2 = params.secType;
            let handler = params.handler || t;
            if (item) {
                if (typeof item === 'object') {
                    allowed = (supportedTypes.indexOf(item.objectType) >= 0);
                    if (allowed) {
                        text = '' + (item[t] || (t2 ? item[t2] : '') || '');
                        allowed = (text !== '');
                    }
                }
                else if (typeof item === 'string') {
                    text = item;
                    allowed = (text !== '');
                }
            }
            let clean = function () {
                cleanElement(el);
            };
            if (allowed) {
                // check hotlink need to be updated to speed up rendering
                div.__handlers = div.__handlers || [];
                let elName = el.getAttribute('data-id');
                let handlerName = handler + '__' + elName;
                let useHandler = div.__handlers[handlerName];
                if ((!useHandler) || ((useHandler.value !== text) || (!useHandler.element))) {
                    clean();
                    div.unlisteners = div.unlisteners || [];
                    div.__handlers[handlerName] = {
                        value: text,
                        element: el
                    };
                    let sett = settings.get('Appearance');
                    let sep = sett.Appearance.MultiStringSeparator;
                    let listenFunc = function (e) {
                        if ((e.which === 2 /* middle button */) ||
                            ((e.which === 1 /* left button */) && e.ctrlKey)) {
                            // middle button or CTRL used .. open in new tab
                            uitools.navigateInNewTab(handler, e.target.textContent, params.param1, params.param2, params.param3);
                        }
                        else {
                            navigationHandlers[handler].navigate(e.target.singleValue ? e.target.item : e.target.textContent, params.param1, params.param2, params.param3);
                        }
                        e.stopPropagation();
                    };
                    let addListen = function (span) {
                        span.controlClass.localListen(span, 'click', listenFunc);
                        span.controlClass.localListen(span, 'mouseup', (e) => { if ((e.which === 1 /* left button */))
                            e.stopPropagation(); });
                    };
                    let values = text.split(sep);
                    if (!multivalue) {
                        values[0] = text;
                        values.length = 1;
                    }
                    values.forEach(function (value, idx) {
                        if (idx === 0) {
                            let add = resolveToValue(params.addBefore, '');
                            if (add !== '') {
                                let lbl = document.createElement('span');
                                lbl.innerText = add;
                                el.appendChild(lbl);
                            }
                        }
                        else if (idx > 0) {
                            let lbl = document.createElement('span');
                            lbl.innerText = ', ';
                            el.appendChild(lbl);
                        }
                        let span = document.createElement('span');
                        span.controlClass = new Control(span, {
                            mergeParentContextMenu: true
                        }); // to allow context menu
                        if (navigationHandlers[handler]) {
                            span.classList.add('hotlink');
                            span.classList.add('clickable');
                        }
                        span.classList.add('trackInfoText');
                        span.classList.add('multiline');
                        span.innerText = value;
                        span.item = item;
                        span.singleValue = values.length == 1;
                        el.appendChild(span);
                        if (navigationHandlers[handler]) {
                            addListen(span);
                            span.controlClass.addToContextMenu([{
                                    action: {
                                        title: _('Open Link in New Tab'),
                                        icon: 'add',
                                        execute: function () {
                                            uitools.navigateInNewTab(handler, span.singleValue ? span.item : span.textContent, params.param1, params.param2, params.param3);
                                        }
                                    },
                                    order: 1,
                                    grouporder: 2,
                                }]);
                        }
                    });
                    let add = resolveToValue(params.addAfter, '');
                    if (add !== '' && el.children.length) {
                        let lbl = document.createElement('span');
                        lbl.innerText = add;
                        el.appendChild(lbl);
                    }
                }
            }
            else {
                if (div.__handlers) {
                    let elName = el.getAttribute('data-id');
                    let handlerName = handler + '__' + elName;
                    if (div.__handlers[handlerName]) {
                        div.__handlers[handlerName] = undefined;
                    }
                }
                clean();
            }
            setVisibilityFast(el, !!el.textContent);
        },
        lyricsFunc: function (div, item, el, params) {
            params = params || {};
            el.controlClass = el.controlClass || new Control(el); // for correct cleaning
            let sett = settings.get('System, Options');
            let saveLyrics = (params.saveLyrics || sett.Options.SaveMissingLyrics) && app.utils.isRegistered();
            let autoSearchLyrics = (params.autoSearch || sett.Options.SearchMissingLyrics) && item.getCanSearchLyrics();
            let lookupText = params.lookupText || _('Lookup');
            let lyricsNotFoundText = params.lyricsNotFoundText;
            if (lyricsNotFoundText === undefined)
                lyricsNotFoundText = _('Lyrics not found');
            if (div.controlClass && div.controlClass.saveBtn)
                setVisibilityFast(div.controlClass.saveBtn, false);
            div.foundLyrics = undefined;
            let startLyricsSearching = function (force) {
                if (!el.controlClass) // already cleaned
                    return;
                cleanElement(el, true);
                el.controlClass.editable = false;
                el.innerHTML =
                    '<label>' + _('Searching') + ' (' + _('Lyrics') + ')...' + '</label>' +
                        '<div data-icon="progress" class="icon inline"></div>';
                initializeControls(div); // due to data-icon above        
                let localSearchPromise = searchTools.searchLyrics(item, saveLyrics, force);
                div.lyricsSearchPromise = {
                    lastPromise: localSearchPromise
                };
                localSearchPromise.then(function (lyrics) {
                    if (!localSearchPromise.canceled) {
                        if (div.lyricsSearchPromise) {
                            div.lyricsSearchPromise.lastPromise = undefined;
                            div.lyricsSearchPromise = undefined;
                        }
                        if (el.controlClass) { // not cleaned yet
                            cleanElement(el, true);
                            if (lyrics !== '') {
                                el.innerText = lyrics;
                                if (params.lyricsFooter)
                                    el.innerHTML += params.lyricsFooter;
                                if (div.controlClass && div.controlClass.saveBtn) {
                                    setVisibilityFast(div.controlClass.saveBtn, !saveLyrics);
                                }
                                if (!saveLyrics)
                                    div.foundLyrics = lyrics;
                                el.controlClass.editable = uitools.getCanEdit();
                            }
                            else {
                                el.innerText = lyricsNotFoundText;
                                if (div.controlClass && div.controlClass.saveBtn)
                                    setVisibilityFast(div.controlClass.saveBtn, false);
                            }
                            if (params.onComplete)
                                params.onComplete(lyrics);
                        }
                    }
                    localSearchPromise = undefined;
                });
            };
            if (div.propsPromise) {
                cancelPromise(div.propsPromise);
            }
            if (div.lyricsSearchPromise) {
                cancelPromise(div.lyricsSearchPromise.lastPromise);
                div.lyricsSearchPromise = undefined;
            }
            cleanElement(el, true);
            if (el.controlClass._lyricsEditFunc) {
                app.unlisten(el, 'change', el.controlClass._lyricsEditFunc);
                el.controlClass._lyricsEditFunc = undefined;
            }
            let lyricsEditFunc = function (e) {
                let value = this.innerText;
                item.setLyricsAsync(value).then(function () {
                    div.foundLyrics = undefined;
                    if (div.controlClass && div.controlClass.saveBtn)
                        setVisibilityFast(div.controlClass.saveBtn, false);
                    item.commitAsync();
                });
            };
            el.controlClass._lyricsEditFunc = app.listen(el, 'change', lyricsEditFunc);
            div.propsPromise = item.getLyricsAsync();
            div.propsPromise.then(function (lyrics) {
                div.propsPromise = undefined;
                if (lyrics !== '') {
                    el.innerText = lyrics;
                    el.controlClass.lastLyrics = lyrics;
                    if (params.lyricsFooter)
                        el.innerHTML += params.lyricsFooter;
                    el.controlClass.editable = uitools.getCanEdit();
                    /*this.unlisteners.push(function () {
                        app.unlisten(div, 'input', lyricsEditFunc);
                    });*/
                    div.foundLyrics = undefined;
                    if (div.controlClass && div.controlClass.saveBtn)
                        setVisibilityFast(div.controlClass.saveBtn, false);
                    if (params.onComplete)
                        params.onComplete(lyrics);
                }
                else {
                    if (div.controlClass && div.controlClass.saveBtn)
                        setVisibilityFast(div.controlClass.saveBtn, false);
                    if (window.uitools.getCanEdit()) {
                        if (autoSearchLyrics && app.utils.isRegistered()) {
                            startLyricsSearching();
                        }
                        else {
                            el.innerHTML = '<a data-id="lyricsSearchLink" class="hotlink" tabindex="-1" href="#">' + lookupText + '</a>';
                            let lyricsSearchLink = qeid(el, 'lyricsSearchLink');
                            if (lyricsSearchLink) {
                                lyricsSearchLink.controlClass = new Control(lyricsSearchLink); // to allow correct cleaning
                                let manualSearchLyricsFunc = function (e) {
                                    e.stopPropagation();
                                    saveLyrics = true; // we want to always save lyrics when clicked manually by user
                                    startLyricsSearching(true);
                                };
                                lyricsSearchLink.controlClass.localListen(lyricsSearchLink, 'click', manualSearchLyricsFunc);
                            }
                            if (params.onComplete)
                                params.onComplete('');
                        }
                    }
                }
            });
        },
        artistBioFunc: function (div, item, el) {
            el.controlClass = el.controlClass || new Control(el);
            let objType = item.objectType;
            let requestid = uniqueCounter++;
            el.controlClass.requestid = requestid;
            if (item.objectType === 'artist') {
                el.controlClass.localPromise(musicBrainz.getArtistWikiInfo(div.controlClass.uniqueID, item)).then(function (resObj) {
                    if (resObj && resObj.wikiperex && (el.controlClass.requestid === requestid)) {
                        musicBrainz.fillWikiElement(el, resObj.wikiurl, resObj.wikiperex, undefined, {
                            fromWiki: true
                        });
                        if (div && div.controlClass) {
                            div.controlClass.wikiInfo = resObj;
                        }
                    }
                });
            }
            else if (item.objectType === 'track') {
                let artists = item.getPersonListAsync('artist');
                el.controlClass.localPromise(artists.whenLoaded()).then(function () {
                    artists.locked(function () {
                        if ((artists.count > 0) && (el.controlClass.requestid === requestid)) {
                            templates.artistBioFunc(div, artists.getValue(0), el);
                        }
                    });
                });
            }
        },
        bookmarkFunc: function (div, item, el) {
            let itm = item;
            if (itm.objectType === 'playlistentry')
                itm = itm.sd;
            let len = qe(el, '[data-id=_length]');
            if (!len) {
                len = document.createElement('div');
                len.setAttribute('data-id', '_length');
                len.className = 'flex column paddingColumnSmall textRight';
                el.appendChild(len);
            }
            len.innerText = getFormatedTime(item.playLength, {
                useEmptyHours: false
            });
            requirejs('controls/progressLine');
            let bookmarkLine = qe(el, '[data-id=_bookmarkLine]');
            if (!bookmarkLine) {
                bookmarkLine = document.createElement('div');
                bookmarkLine.setAttribute('data-id', '_bookmarkLine');
                bookmarkLine.setAttribute('data-control-class', 'ProgressLine');
                el.appendChild(bookmarkLine);
            }
            if (!bookmarkLine.controlClass) {
                bookmarkLine.controlClass = new ProgressLine(bookmarkLine);
            }
            if (div.cloned && (bookmarkLine.controlClass._ishidden === undefined)) {
                bookmarkLine.controlClass._ishidden = (bookmarkLine.style.display === 'none');
            }
            let percent = itm.percentPlayed;
            if (percent > 0) {
                if (bookmarkLine.controlClass._ishidden) {
                    bookmarkLine.controlClass._ishidden = false;
                    bookmarkLine.style.display = '';
                }
                bookmarkLine.controlClass.value = percent / 100;
            }
            else {
                if (!bookmarkLine.controlClass._ishidden) {
                    bookmarkLine.controlClass._ishidden = true;
                    bookmarkLine.style.display = 'none';
                }
                //bookmarkLine.controlClass.value = 0; // not needed, is hidden anyway
            }
            let lv = div.parentListView;
            if (lv && !lv._afterOptionsChangedSet) {
                lv.localListen(window.settings.observer, 'change', () => {
                    lv.rebind();
                });
                lv._afterOptionsChangedSet = true;
            }
        },
        getRatingWidth: function (div, item, el, params) {
            // returns width of rating control used in track lists, which use ratingEditableFunc
            if (ratingControlWidth === undefined)
                ratingControlWidth = 10 * 1 + 5 * Math.floor(getPixelSize('1.2em')); // 5 left and right star margins + 5 stars
            return ratingControlWidth;
        },
        ratingEditableFunc: function (div, item, el, params) {
            params = params || {};
            params.readOnlyPadding = params.readOnlyPadding || 'both';
            let itm = item;
            if (itm.objectType === 'playlistentry')
                itm = itm.sd;
            let ival = itm.rating;
            if (!el.controlClass) {
                el.setAttribute('data-control-class', 'Rating');
                el.setAttribute('data-init-params', '{useUnknown: true, unkownText: "", readOnly: true, position: "left", starWidth: "1.2em", readOnlyPadding: "' + params.readOnlyPadding + '"' + (params.paddingRight ? (', paddingRight: "' + params.paddingRight + '"') : '') + '}');
                el.controlClass = new Rating(el, {
                    useUnknown: true,
                    unkownText: '',
                    readOnly: true,
                    position: 'left',
                    starWidth: '1.2em',
                    readOnlyPadding: params.readOnlyPadding,
                    paddingRight: params.paddingRight,
                    paddingLeft: params.paddingLeft
                });
            }
            let focused = div.hasAttribute('data-focused') && div.hasAttribute('data-selected');
            // read only, if not focused, editing disabled, or online track not present in library
            el.controlClass.readOnly = !focused || !window.uitools.getCanEdit();
            if (focused) {
                if (!el.controlClass._changeRating) {
                    el.controlClass._changeRating = function () {
                        let lv = div.parentListView;
                        if (lv && (div.itemIndex !== undefined)) {
                            let itm = lv.getItem(div.itemIndex);
                            if (itm) {
                                if (itm.objectType === 'playlistentry')
                                    itm = itm.sd;
                                if (itm && (itm.objectType === 'track') && (itm.rating != this.controlClass.value)) {
                                    let origValue = itm.rating;
                                    itm.rating = this.controlClass.value;
                                    if ((itm.id <= 0) && ((itm.path === '') || isURLPath(itm.path)) && !mediaSyncDevices.isModifiableTrack(item)) {
                                        // online track not present in the library - toast message and add to the library                                        
                                        uitools.toastMessage.show(_('Track was added to the Library'), {
                                            callback: function (val) {
                                                if (val) {
                                                    // adding not canceled
                                                    itm.commitAsync({
                                                        forceSaveToDB: true
                                                    });
                                                }
                                                else {
                                                    this.controlClass.value = origValue;
                                                    itm.rating = origValue;
                                                }
                                            }.bind(this)
                                        });
                                    }
                                    else {
                                        itm.commitAsync();
                                    }
                                }
                            }
                        }
                    }.bind(el);
                    app.listen(el, 'change', el.controlClass._changeRating);
                }
            }
            else {
                if (el.controlClass._changeRating) {
                    app.unlisten(el, 'change', el.controlClass._changeRating);
                    el.controlClass._changeRating = undefined;
                }
            }
            if (!isNaN(ival)) {
                el.controlClass.value = ival;
            }
            else {
                el.controlClass.value = -1;
            }
            if (!params.noZeroWidth) {
                // hiding for not set values
                if (div.cloned && (el._ishidden === undefined)) {
                    el._ishidden = (el.style.width === '0px');
                }
                if (el.controlClass.readOnly && (el.controlClass.value < 0)) {
                    if (!el._ishidden) {
                        el._ishidden = true;
                        el.style.display = 'none';
                        el.style.width = '0px'; // reduces flickering during item resize
                    }
                }
                else {
                    if (el._ishidden) {
                        el._ishidden = false;
                        el.style.display = '';
                        el.style.width = '';
                    }
                }
            }
        },
        saveImageToAlbum: function (item, picturePath, refreshCbk) {
            uitools.addNewArtwork(picturePath, {
                album: item,
                showReplace: true,
            }).then(function (res) {
                if (refreshCbk && res && res.done)
                    refreshCbk();
            });
        },
        saveImageToTrack: function (item, picturePath, refreshCbk) {
            uitools.addNewArtwork(picturePath, {
                track: item,
                showReplace: true,
                showApply2Album: true,
            }).then(function (res) {
                if (refreshCbk && res && res.done)
                    refreshCbk();
            }.bind(this));
        },
        albumRatingFunc: function (div, item, el, itemIndex, params) {
            params = params || {};
            if (!el.controlClass) {
                let pos = params.position || 'center';
                el.setAttribute('data-control-class', 'Rating');
                el.setAttribute('data-init-params', '{readOnly: true, starWidth: "1.2em", paddingLeft: 0, paddingRight: 0, position: "' + pos + '"}');
                el.controlClass = new Rating(el, {
                    readOnly: true,
                    starWidth: '1.2em',
                    paddingLeft: 0,
                    paddingRight: 0,
                    position: pos
                });
                el.controlClass.cleanListener = function () {
                    let div = this;
                    if (el.controlClass && el.controlClass._changeListener) {
                        let itm = getLVItem(div, item, el.controlClass._lastEventsIdx); // was fast object, we need to find the correct one
                        if (itm) {
                            app.unlisten(itm, 'change', el.controlClass._changeListener);
                            el.controlClass._changeListener = undefined;
                        }
                        else {
                            if (div.parentListView)
                                ODS('Cannot unregister rating change event for ' + div._lastEventsIdx);
                            else
                                ODS('Cannot unregister rating change event for ' + div._lastEventsIdx + ' - no parent LV');
                        }
                    }
                }.bind(div);
                el.controlClass.addCleanFunc(function () {
                    el.controlClass.cleanListener();
                    el.controlClass.cleanListener = undefined;
                });
                let LV = div.parentListView;
                if (LV) {
                    LV.addDSCleanFunc(el.controlClass.cleanListener);
                }
            }
            if (el.controlClass._persistentID !== item.persistentID) {
                if (el.controlClass._changeListener && el.controlClass.cleanListener) {
                    el.controlClass.cleanListener();
                }
            }
            if (item.rating > -2) {
                el.controlClass.value = item.rating;
            }
            else {
                if (isFunction(item.getRatingAsync)) {
                    div.controlClass = div.controlClass || new Control(div);
                    if (el && el.controlClass && el.controlClass.canvas)
                        setVisibilityFast(el.controlClass.canvas, false);
                    if ((item.title === '') && (item.albumArtist === '')) // do not compute rating for unknown album group
                        return;
                    let gid = div._groupID;
                    div.controlClass.localPromise(item.getRatingAsync()).then((ival) => {
                        if ((div.itemIndex === itemIndex) && (gid === div._groupID)) {
                            el.controlClass.value = ival;
                            setVisibilityFast(el.controlClass.canvas, true);
                        }
                    });
                }
                else {
                    ODS('!! getRatingAsync not defined for ' + item.objectType);
                }
            }
            if (!el.controlClass._changeListener) {
                el.controlClass._persistentID = item.persistentID;
                el.controlClass._lastEventsIdx = itemIndex;
                el.controlClass._changeListener = app.listen(item, 'change', function () {
                    let itm = getLVItem(div, item, el.controlClass._lastEventsIdx); // was fast object, we need to find the correct one
                    if (itm)
                        el.controlClass.value = itm.rating;
                });
            }
        },
        assignHTMLifDifferent: function (el, txt) {
            if (el.innerHTML !== txt)
                el.innerHTML = txt;
        },
        imageItemsParams: {
            standardItem: {
                imgBind: 'func: templates.itemImageFunc(div, item, div.itemIndex);',
                selectButton: true,
                line1Bind: 'func: if (item.name === \'\') el.textContent = _(\'Unknown\'); else el.textContent = item.name;',
            },
            iconNode: {
                imgBind: 'func: templates.nodeIconFunc(div, item);',
                selectButton: true,
                line1Bind: 'func: templates.assignHTMLifDifferent(el, nodeUtils.getNodeTitle(item))',
            },
            imageNode: {
                selectButton: true,
                imgBind: 'func: templates.nodeItemImageFunc(div, item, div.itemIndex);',
                uimgBind: 'func: templates.nodeIconFunc(div, item);',
                line1Bind: 'func: templates.assignHTMLifDifferent(el, nodeUtils.getNodeTitle(item))'
            },
            podcastItem: {
                imgBind: 'func: templates.itemImageFunc(div, item, div.itemIndex);',
                noThumbIcon: 'podcast',
                line1Bind: 'func: el.textContent = item.title',
                line2Bind: 'func: if(item.podcastURL === \'\') el.textContent = _(\'Unsubscribed\'); else el.textContent = _(\'Episodes\') + \': \' + item.getEpisodesCount(\'downloaded\')+\' /\'+item.getEpisodesCount(\'total\');',
            },
            podcastNode: {
                imgBind: 'func: templates.nodeItemImageFunc(div, item, div.itemIndex);',
                noThumbIcon: 'podcast',
                line1Bind: 'func: el.textContent = nodeUtils.getNodeTitle(item)',
                line2Bind: 'func: if (item.handlerID == \'podcast\') {if(item.dataSource.podcastURL === \'\') el.textContent = _(\'Unsubscribed\'); else el.textContent = _(\'Episodes\') + \': \' + item.dataSource.getEpisodesCount(\'downloaded\')+\' /\'+item.dataSource.getEpisodesCount(\'total\');}',
            },
            playlistNode: {
                selectButton: true,
                imgBind: 'func: templates.nodeItemImageFunc(div, item, div.itemIndex, {registerChange: true});',
                uimgBind: 'func: templates.nodeIconFunc(div, item);',
                line1Bind: 'func: templates.assignHTMLifDifferent(el, nodeUtils.getNodeTitle(item))'
            },
            artistsGrid: function () {
                return {
                    imgBind: 'func: templates.itemImageFunc(div, item, div.itemIndex, {useCoverImage: true, isAutoSearch: true, imgSearchFunc: searchTools.getArtistImage, uid: \'' + this.uniqueID + '\'});',
                    noThumbIcon: this.noThumbIcon,
                    selectButton: !this.noItemButtons,
                    line1Bind: 'func: if (item.name === \'\') el.textContent = _(\'Unknown\'); else el.textContent = item.name;',
                    useCoverImage: true
                };
            },
            albumListView: function () {
                let secLineVal = this.hideArtists ? '(((item.year>100)&&(item.year<9999))?item.year:\'\')' : 'item.albumArtist';
                return {
                    imgBind: 'func: templates.itemImageFunc(div, item, div.itemIndex, {registerChange: true, useCoverImage: true, isAutoSearch: true, updateWhenChanged: true, saveImageFunc: templates.saveImageToAlbum, imgSearchFunc: searchTools.getAAImage, \
                      canSave: true, uid: \'' + this.uniqueID + '\'});',
                    noThumbIcon: 'unknownAA',
                    selectButton: true,
                    line1Bind: 'func: if (item.title === \'\') el.textContent = _(\'Unknown Album\'); else el.textContent = item.title;',
                    line2Bind: 'func: el.textContent = ' + secLineVal,
                    line2onclick: this.hideArtists ? undefined : function (event, item) {
                        let artist = item.albumArtist;
                        if (artist) {
                            if (!item.isOnline && !item.tracksCallback)
                                uitools.globalSettings.showingOnline = false; // opens My Library mode, if item is not for online content
                            if ((event.which === 2 /* middle button */) ||
                                ((event.which === 1 /* left button */) && event.ctrlKey)) {
                                // middle button or CTRL used .. open in new tab
                                uitools.navigateInNewTab('albumartist', artist, undefined, item.albumArtistMBGID);
                            }
                            else {
                                navigationHandlers.albumartist.navigate(artist, undefined, item.albumArtistMBGID /* exists for JS release groups */);
                            }
                            event.stopPropagation();
                        }
                    },
                    line3Bind: 'func: templates.albumRatingFunc(div, item, el, div.itemIndex);',
                    useCoverImage: true
                };
            },
            videoGrid: function () {
                return {
                    imgBind: 'func: templates.itemImageFunc(div, item, div.itemIndex, {useCoverImage: true});',
                    noThumbIcon: 'video',
                    selectButton: true,
                    line1Bind: 'func: if (item.title === \'\') el.textContent = _(\'Unknown Title\'); else el.textContent = item.title;',
                    useCoverImage: true
                };
            },
            trackGrid: function () {
                return {
                    imgBind: 'func: templates.itemImageFunc(div, item, div.itemIndex, {useCoverImage: true});',
                    noThumbIcon: 'music',
                    selectButton: true,
                    line1Bind: 'func: if (item.title === \'\') el.textContent = _(\'Unknown Title\'); else el.textContent = item.title;',
                    useCoverImage: true
                };
            },
            yearNode: {
                uimgBind: 'func: templates.nodeIconFunc(div, item, \'year\');',
                selectButton: true,
                line1Bind: 'func: if(item.value>0) el.textContent = item.value + \'s\'; else el.textContent =  _(\'Unknown\')',
            },
        },
        /* Function for creating item for grids with image and 1 or 2 lines of text. Possible params:
            imgBind - data-bind string for image/artwork
            uimgBind - data-bind string for alternative icon (displayed if artwork does not exist), do not combine with noThumbIcon
            noThumbIcon - name of alternative icon (displayed if artwork does not exist), e.g. 'unknownAA', do not combine with uimgBind
            buttons - if true, hover buttons are added to the item (play, shuffle, menu, select)
            noViewAction - if true, itemview action will not be added for click/touchend events on the main line of item text
            line1Bind -  data-bind string for first (main) line of text
            line2Bind -  data-bind string for second line of text
            line2onclick - function called when clicked on the second line of text
            line3Bind -  data-bind string for third line of text
            useCoverImage - display image with coverImage class, by default it means stretched with preserved AR
        */
        imageItem: function (div, params) {
            params = params || {};
            if (!div.cloned) {
                div.classList.add('imageItem');
                let imgTag = 'div';
                let artworkBind = params.imgBind ? (' data-bind="' + params.imgBind + '"') : '';
                let unknownAAbind = params.uimgBind ? (' data-bind="' + params.uimgBind + '"') : '';
                let unknownAAicon = params.noThumbIcon ? (' data-icon="' + params.noThumbIcon + '"') : '';
                let line1 = '';
                let line2 = '';
                let line3 = '';
                let lineNum = 0;
                let textclass;
                if (params.line1Bind) {
                    textclass = params.noViewAction ? '' : ' class="clickable"';
                    line1 = '<div data-id="firstLine" class="textEllipsis textCenter"><span data-id="firstLineText"' + textclass + ' data-bind="' + params.line1Bind + '"></span></div>';
                    lineNum++;
                }
                if (params.line2Bind) {
                    textclass = params.line2onclick ? ' class="clickable"' : '';
                    line2 = '<div data-id="secondLine" class="smallText textEllipsis textCenter"><span data-id="secondLineText"' + textclass + ' data-bind="' + params.line2Bind + '"></span></div>';
                    lineNum++;
                }
                if (params.line3Bind) {
                    line3 = '<div data-id="thirdLine" class="smallText textEllipsis textCenter"><span data-id="thirdLineText" data-bind="' + params.line3Bind + '"></span></div>';
                    lineNum++;
                }
                div.classList.toggle('twoLines', (lineNum > 1));
                div.classList.toggle('threeLines', (lineNum > 2));
                let cimg = params.useCoverImage ? 'coverImage' : 'autosize';
                div.innerHTML =
                    '<div class="fill gridItemInner">' +
                        '  <div class="imageSquare">' +
                        '    <div data-id="unknownAA" class="fill largeIconColor emptyImage" ' + unknownAAicon + unknownAAbind + '></div>' + // this line needs to be always presented (accessed e.g. in nodeIconFunc)
                        '    <div data-id="artworkDiv"' + artworkBind + ' class="box ignoreMouse fill artworkBg" ></div><img data-id="artworkImg" class="allinside box autoMargin ignoreMouse ' + cimg + '" />' +
                        '  </div>' +
                        '  <div class="imageInfo">' +
                        line1 +
                        line2 +
                        line3 +
                        '  </div>' +
                        '</div>';
            }
            initializeControls(div);
            div.controlClass = div.controlClass || new Control(div); // to allow correct cleaning
            div.artworkDiv = qeid(div, 'artworkDiv');
            div.artworkImg = qeid(div, 'artworkImg');
            div.noaa = qeid(div, 'unknownAA');
            if (params.buttons)
                templates.addImageGridButtons(div);
            if (params.selectButton)
                templates.addImageGridSelectButton(div);
            let LV = div.parentListView;
            if (params.line1Bind) {
                div.firstLine = qeid(div, 'firstLine');
                if (!params.noViewAction)
                    this.addViewAction(div, qeid(div, 'firstLineText'));
            }
            if (params.line2Bind && LV) {
                div.secondLine = qeid(div, 'secondLine');
                div.secondLineText = qeid(div, 'secondLineText');
                if (params.line2onclick && !div.line2listener && isFunction(params.line2onclick)) {
                    div.line2listener = function (event) {
                        if ((event.button !== 0 && !event.touches) || (div.itemIndex === undefined)) {
                            return;
                        }
                        let item = LV.getItem(div.itemIndex);
                        if (!item)
                            return;
                        params.line2onclick(event, item);
                    };
                    div.controlClass.localListen(div.secondLineText, 'click', div.line2listener);
                    div.controlClass.localListen(div.secondLineText, 'touchend', div.line2listener);
                }
            }
            // code needed for tooltip, when text does not fit
            if (div.firstLine) {
                templates.addEllipsisTooltip(div.firstLine, div);
            }
            if (div.secondLine) {
                templates.addEllipsisTooltip(div.secondLine, div);
            }
            div.controlClass.addCleanFunc(function () {
                div.artworkDiv = undefined;
                div.artworkImg = undefined;
                div.noaa = undefined;
                div.firstLine = undefined;
                div.secondLine = undefined;
                div.secondLineText = undefined;
            });
        },
        npItemText: function (cachedItem, item, params) {
            params = params || {};
            cachedItem.trackTypeStringId = cachedItem.trackTypeStringId || item.trackTypeStringId;
            if (!params.hideArtists && (cachedItem.artist === undefined))
                cachedItem.artist = item.artist;
            if (cachedItem.album === undefined)
                cachedItem.album = item.album;
            if (params.albumOnly)
                return cachedItem.album;
            let txt = '';
            if ((cachedItem.trackTypeStringId === 'music') || (cachedItem.trackTypeStringId === 'audiobook') || (cachedItem.trackTypeStringId === 'musicvideo') || (cachedItem.trackTypeStringId === 'radio')) {
                if ((cachedItem.album) || (cachedItem.artist)) {
                    if (!params.hideArtists && cachedItem.artist) {
                        txt = app.utils.multiString2VisualString(cachedItem.artist);
                        if (!params.artistOnly && cachedItem.album)
                            txt += ' - ' + cachedItem.album;
                    }
                    else if (!params.artistOnly) {
                        txt = cachedItem.album;
                    }
                }
            }
            else if ((cachedItem.trackTypeStringId === 'video') || (cachedItem.trackTypeStringId === 'tv')) {
                if (!params.artistOnly)
                    txt = cachedItem.album; // series title
            }
            else if ((cachedItem.trackTypeStringId === 'podcast') || (cachedItem.trackTypeStringId === 'videopodcast')) {
                if (!params.artistOnly)
                    txt = cachedItem.album; // podcast title
            }
            else if (cachedItem.trackTypeStringId === 'classical') {
                if (!params.hideArtists) {
                    if (cachedItem.author === undefined)
                        cachedItem.author = item.author;
                    if (!params.istracklist && cachedItem.author) {
                        txt = app.utils.multiString2VisualString(cachedItem.author); // composer
                    }
                    else {
                        txt = app.utils.multiString2VisualString(cachedItem.artist);
                    }
                }
            }
            if (params.brackets && txt)
                txt = '(' + txt + ')';
            return txt;
        },
        youtubeIcon: function (div, el, item) {
            if (_utils.isOnlineTrack(item)) {
                el._visible = true;
                if (el._iconLoaded) {
                    setVisibility(el, true);
                }
                else {
                    el._iconLoaded = true; // we do not use icon now
                    templates.setYoutubeIconDiv(el);
                    /*loadIconFast('youtube', function (icon) {
                        if (el._visible) {
                            setIconFast(el, icon);
                            el.setAttribute('data-tip', 'YouTube');
                            el._iconLoaded = true;
                            setVisibility(el, true);
                        }
                    });*/
                }
            }
            else {
                setVisibility(el, false);
                el._visible = false;
            }
        },
        npListItem: function (div, istracklist, hideArtists) {
            if (!div.cloned) {
                if (paddingColumnSmallRight === undefined) {
                    paddingColumnSmallRight = getStyleRuleValue('padding-right', '.paddingColumnSmall');
                }
                div.setAttribute('data-item-height', '[{toWidth: "40em", className: "rowHeight2line"}, {fromWidth: "40em", className: "rowHeight1line"}, {fromWidth: "55em", className: "fixedWidthColumns"}]');
                if (istracklist) {
                    div.setAttribute('data-cond-class', '{itemNowPlaying: \'item.isPlaying\', itemInaccessible: \'(item.getIsPlayable && !item.getIsPlayable())\'}');
                }
                div.innerHTML =
                    '<div class="flex fill column marginLeftSmall">' +
                        '  <div class="flex fill row">' +
                        '    <div data-id="lblTrackNum" data-cond-width="[{fromWidth: \'55em\', width: \'2.5em\'}]" ' + (istracklist ? 'data-show-if="item.playlistSongOrder >= 0"' : '') + ' data-bind="func: el.textContent = ( ' + (istracklist ? 'item.playlistSongOrder' : 'div.itemIndex') + ' + 1) + \'.\';" class="textEllipsis semitransparent vSeparatorTiny"></div>' +
                        '    <div data-id="title1" class="textEllipsis" data-cond-width="[{toWidth:\'55em\', className:\'fill\'}, {fromWidth: \'55em\', width: \'' + (hideArtists ? '45%' : '30%') + '\'}]">' +
                        '      <div data-id="ytIcon" class="inline vSeparatorTiny verticalCenter" data-bind="func: templates.youtubeIcon(div, el, item);"></div><span data-id="lblTitle" style="White-space : pre;" data-bind="text: trackFormat.title"></span>&nbsp;' +
                        '      <span data-width-from="40em" data-width-to="55em" class="semitransparent" data-bind="func: el.textContent = templates.npItemText(cachedItem, item, {istracklist: ' + !!istracklist + ', brackets: true, hideArtists: ' + (hideArtists === true) + '});">' +
                        '      </span>' +
                        '    </div>' + (hideArtists ? '' :
                        '    <div data-id="artistName" class="left-indent-small textEllipsis" data-width-from="55em" data-cond-width="[{fromWidth: \'55em\', width: \'25%\'}]" data-bind="func: el.textContent = templates.npItemText(cachedItem, item, {istracklist: ' + !!istracklist + ', artistOnly: true});">' +
                            '    </div>') +
                        '    <div data-id="albumTitle" class="left-indent-small fill textEllipsis" data-width-from="55em" data-bind="func: el.textContent = templates.npItemText(cachedItem, item, {istracklist: ' + !!istracklist + ', albumOnly: true});">' +
                        '    </div>' +
                        '    <div data-width-from="16em" data-bind="func: templates.ratingEditableFunc(div, item, el, {readOnlyPadding: \'right\', paddingRight: \'' + paddingColumnSmallRight + '\'});">' +
                        '    </div>' +
                        '    <div data-width-from="40em" data-minwidth-pattern="88:88:88" data-bind="func: templates.bookmarkFunc(div, item, el);"></div>' +
                        //'    <div data-width-from="40em" data-minwidth-pattern="88:88:88" data-bind="text: trackFormat.length" class="flex column paddingColumnSmall semitransparent textRight"></div>' +
                        '  </div>' +
                        '  <div data-width-to="40em" class="flex fill row right">' +
                        '    <div class="flex row fill">' +
                        '      <div data-id="title2" class="textEllipsis semitransparent dynamicShrink" data-bind="func: el.textContent = templates.npItemText(cachedItem, item, {istracklist: ' + !!istracklist + ', brackets: false, hideArtists: ' + (hideArtists === true) + '});">' +
                        '      </div>' +
                        '    </div>' +
                        //'    <div data-bind="text: trackFormat.length" class="paddingColumnSmall flex right semitransparent"></div>' +
                        '    <div data-bind="func: templates.bookmarkFunc(div, item, el);"></div>' +
                        '  </div>' +
                        '</div>';
            }
            let titleDiv1 = qeid(div, 'title1');
            let titleDiv2 = qeid(div, 'title2');
            if (titleDiv1) {
                templates.addEllipsisTooltip(titleDiv1, div);
            }
            if (titleDiv2) {
                templates.addEllipsisTooltip(titleDiv2, div);
            }
            let lblTrackNum = qeid(div, 'lblTrackNum');
            if (lblTrackNum) {
                templates.addEllipsisTooltip(lblTrackNum, div);
            }
            let artistName = qeid(div, 'artistName');
            if (artistName) {
                templates.addEllipsisTooltip(artistName, div);
            }
            let albumTitle = qeid(div, 'albumTitle');
            if (albumTitle) {
                templates.addEllipsisTooltip(albumTitle, div);
            }
            templates.addImageGridSelectButton(div, true);
        },
        simpleTracklistItem: function (div, hideArtists) {
            this.npListItem(div, true, hideArtists);
        },
        simpleTracklistSortMethods: function (view, hideArtists) {
            let ratingWidth = templates.getRatingWidth() + 'px';
            let list = {
                oneRow: {
                    rows: [
                        [
                            {
                                title: '#.&nbsp;',
                                columnType: 'playOrder',
                            },
                            {
                                title: _('Title'),
                                columnType: 'title',
                            },
                            {
                                title: '&nbsp;('
                            },
                            {
                                title: _('Artist'),
                                columnType: 'artist',
                            },
                            {
                                title: '&nbsp;-&nbsp;'
                            },
                            {
                                title: _('Album'),
                                columnType: 'album',
                            },
                            {
                                title: '&thinsp;)'
                            },
                            {
                                title: _('Rating'),
                                columnType: 'rating',
                                position: 'right',
                                style: 'width:' + ratingWidth,
                                class: 'paddingColumnSmall'
                            },
                            {
                                title: _('Length'),
                                columnType: 'length',
                                position: 'right',
                                style: 'margin-right: -0.5em'
                            }
                        ]
                    ]
                },
                multiRow: {
                    rows: [
                        [
                            {
                                title: '#.&nbsp;',
                                columnType: 'playOrder',
                            },
                            {
                                title: _('Title'),
                                columnType: 'title',
                            },
                            {
                                title: _('Rating'),
                                columnType: 'rating',
                                position: 'right',
                            }
                        ], [
                            {
                                title: _('Artist'),
                                columnType: 'artist',
                                class: 'left-indentX'
                            },
                            {
                                title: '&nbsp;-&nbsp;',
                            },
                            {
                                title: _('Album'),
                                columnType: 'album',
                            },
                            {
                                title: _('Length'),
                                columnType: 'length',
                                position: 'right',
                            }
                        ]
                    ]
                },
                fixedWidthRow: {
                    rows: [
                        [
                            {
                                title: '#.&nbsp;',
                                style: 'width: 3.1em',
                                columnType: 'playOrder',
                            },
                            {
                                title: _('Title'),
                                columnType: 'title',
                                style: 'width: ' + (hideArtists ? '45%' : '30%')
                            },
                            {
                                title: _('Artist'),
                                columnType: 'artist',
                                style: 'width: 25%',
                                class: 'left-indent-small'
                            },
                            {
                                title: _('Album'),
                                columnType: 'album',
                                class: 'left-indent-small'
                            },
                            {
                                title: _('Rating'),
                                columnType: 'rating',
                                position: 'right',
                                style: 'width:' + ratingWidth,
                                class: 'paddingColumnSmall'
                            },
                            {
                                title: _('Length'),
                                columnType: 'length',
                                position: 'right',
                                style: 'margin-right: -0.5em'
                            }
                        ]
                    ]
                }
            };
            if (hideArtists) {
                list.oneRow.rows[0].splice(3, 2);
                list.multiRow.rows[1].splice(0, 2);
                list.fixedWidthRow.rows[0].splice(2, 1);
            }
            if (view) {
                let handler = getNodeHandler(view);
                if (!resolveToValue(handler.orderColumnSupport, false)) {
                    list.oneRow.rows[0].shift();
                    list.multiRow.rows[0].shift();
                    list.fixedWidthRow.rows[0].shift();
                }
            }
            return list;
        },
        albumTracklistItem: function (div, hasVideoContent) {
            if (!div.cloned) {
                div.setAttribute('data-item-height', '[{toWidth: "35em", className: "rowHeight2line"}, {fromWidth: "35em", className: "rowHeight1line"}]');
                div.innerHTML =
                    '<div data-cond-class="{itemNowPlaying: \'item.isPlaying\', itemInaccessible: \'(item.getIsPlayable && !item.getIsPlayable())\'}" class="flex fill column">' +
                        ' <div class="flex fill row">' +
                        (!hasVideoContent ? '<div data-show-if="item.trackNumber!==\'\'" class="flex column paddingColumnSmall">' +
                            '    <div data-id="lblTrackNum" data-bind="text: trackFormat.trackNumber" class="textEllipsis semitransparent"></div>' +
                            '  </div>' : '  <div data-show-if="item.episodeNumber!==\'\'" class="flex column paddingColumnSmall">' +
                            '    <div data-id="lblEpisodeNum" data-bind="text: trackFormat.episode" class="textEllipsis semitransparent"></div>' +
                            '  </div>') +
                        '  <div class="flex row fill">' +
                        '    <div data-id="ytIcon" class="inline vSeparatorTiny verticalCenter" data-bind="func: templates.youtubeIcon(div, el, item);"></div>' +
                        '    <label data-id="lblTitle" data-bind="text: trackFormat.title" class="dynamicShrink textEllipsis" style="White-space : pre;"></label>' +
                        '    <label data-width-from="35em" data-show-if="(item.artist !== item.albumArtist) && item.artist" data-id="lblArtist" class="paddingColumnSmall textEllipsis semitransparent dynamicShrink">(<span data-bind="text: trackFormat.artist"></span>)</label>' +
                        '  </div>' +
                        '  <div data-width-from="23em" class="flex column center">' +
                        '    <div data-id="lblRating" data-bind="func: templates.ratingEditableFunc(div, item, el, {readOnlyPadding: \'right\'});" class="textEllipsis"></div>' +
                        '  </div>' +
                        '  <div data-width-from="35em" class="flex column paddingColumnSmall">' +
                        //'    <label data-id="lblLength" data-minwidth-pattern="88:88:88" data-bind="text: trackFormat.length" class="textEllipsis semitransparent textRight"></label>' +
                        '    <div data-minwidth-pattern="88:88:88" data-bind="func: templates.bookmarkFunc(div, item, el);"></div>' +
                        '  </div>' +
                        ' </div>' +
                        ' <div data-width-to="35em" class="flex fill row right">' +
                        '  <div data-show-if="item.artist !== item.albumArtist" class="flex column left-indent paddingColumnSmall fill">' +
                        '    <label data-id="lblArtist" data-bind="text: trackFormat.artist" class="paddingColumnSmall textEllipsis semitransparent dynamicShrink"></label>' +
                        '  </div>' +
                        '  <div class="paddingColumnSmall flex right">' +
                        //'    <label data-id="lblLength" data-bind="text: trackFormat.length" class="textEllipsis semitransparent"></label>' +
                        '    <div data-bind="func: templates.bookmarkFunc(div, item, el);"></div>' +
                        '  </div>' +
                        ' </div>' +
                        '</div>';
            }
        },
        findLVStyleColorTypes: function () {
            if ((selectedStyle === undefined) && (document.styleSheets[0])) {
                let selSt = undefined;
                let hoverSt = undefined;
                let tbhoverSt = undefined;
                let classes = document.styleSheets[0].cssRules;
                for (let i = 0; i < classes.length; i++) {
                    let rule = classes[i];
                    if (rule.selectorText === '.lvItem[data-selected]') {
                        selSt = rule.style;
                        if (hoverSt && tbhoverSt)
                            break;
                    }
                    if ((rule.selectorText === '.lvItem[data-hover]') || (rule.selectorText === '.lvItem[data-hover]:not([data-disabled])')) {
                        hoverSt = rule.style;
                        if (selSt && tbhoverSt)
                            break;
                    }
                    if (rule.selectorText && (rule.selectorText.indexOf('.toolbuttonbase:hover') !== -1)) {
                        tbhoverSt = rule.style;
                        if (hoverSt && selSt)
                            break;
                    }
                }
                for (let i = 0; i < hoverSt.length; i++) {
                    let propName = hoverSt.item(i);
                    let propValue = hoverSt.getPropertyValue(propName);
                    if (propName === 'background') {
                        if (propValue !== 'inherit') {
                            hoverStyle = 'background';
                            break; // do not search for other rules, when changing background, we change background and color
                        }
                    }
                    else if ((propName === 'color') || (propName === 'fill')) {
                        if (propValue !== 'inherit') {
                            if (!hoverStyle)
                                hoverStyle = 'color'; // candidate for changing color+fill only
                        }
                    }
                }
                hoverStyle = hoverStyle || 'background';
                for (let i = 0; i < selSt.length; i++) {
                    let propName = selSt.item(i);
                    let propValue = selSt.getPropertyValue(propName);
                    if (propName === 'background') {
                        if (propValue !== 'inherit') {
                            selectedStyle = 'background';
                            break; // do not search for other rules, when changing background, we change background and color
                        }
                    }
                    else if ((propName === 'color') || (propName === 'fill')) {
                        if (propValue !== 'inherit') {
                            if (!selectedStyle)
                                selectedStyle = 'color'; // candidate for changing color+fill only
                        }
                    }
                }
                selectedStyle = selectedStyle || 'background';
                for (let i = 0; i < tbhoverSt.length; i++) {
                    let propName = tbhoverSt.item(i);
                    let propValue = tbhoverSt.getPropertyValue(propName);
                    if (propName === 'background') {
                        if (propValue !== 'inherit') {
                            tbHoverStyle = 'background';
                            break; // do not search for other rules, when changing background, we change background and color
                        }
                    }
                    else if ((propName === 'color') || (propName === 'fill')) {
                        if (propValue !== 'inherit') {
                            if (!tbHoverStyle)
                                tbHoverStyle = 'color'; // candidate for changing color+fill only
                        }
                    }
                }
                tbHoverStyle = tbHoverStyle || 'color';
            }
        },
        setPopupListColors: function (uid, colors, containerUID) {
            let containerUidFilter;
            let uidFilter = '.lvPopup[data-uniqueid="' + uid + '"]';
            if (containerUID)
                containerUidFilter = '.lvPopupContainer[data-uniqueid="' + containerUID + '"]';
            else
                containerUidFilter = uidFilter;
            let styleTag = document.getElementById('popupStyle');
            if (styleTag) {
                let cssRules = styleTag.sheet.cssRules;
                if (cssRules.length > 0) {
                    for (let i = cssRules.length - 1; i >= 0; i--) {
                        if (cssRules[i].cssText.indexOf(containerUidFilter) >= 0) {
                            styleTag.sheet.deleteRule(i);
                            break; // we have one rule for each popup now
                        }
                    }
                }
            }
            if (!colors) {
                return;
            }
            templates.findLVStyleColorTypes();
            colors = colors || {};
            colors.nowplaying = colors.nowplaying || colors.text;
            colors.iconsHover = colors.iconsHover || 'inherit';
            colors.select = colors.select || colors.hover;
            colors.hoverSelect = colors.hoverSelect || colors.select;
            colors.textHover = colors.textHover || colors.nowplaying;
            if (!styleTag) {
                styleTag = document.createElement('style');
                styleTag.id = 'popupStyle';
                let head = document.getElementsByTagName('head')[0];
                head.appendChild(styleTag);
            }
            if (colors.hover !== undefined) {
                let rule = containerUidFilter + ' { ';
                rule += ' --lvPopup-Filter-Hover-Icon: drop-shadow(0px 0px 0.25rem ' + colors.iconsHover + ');';
                rule += ' --lvPopup-Clr-Text: ' + colors.text + ';';
                rule += ' --lvPopup-Clr-Hover-Text: ' + colors.textHover + ';';
                rule += ' --lvPopup-Clr-Hover: ' + ((hoverStyle === 'color') ? colors.hover : colors.text) + ';';
                rule += ' --lvPopup-BClr-Hover: ' + ((hoverStyle === 'color') ? 'inherit' : colors.hover) + ';';
                rule += ' --lvPopup-Clr-Select: ' + ((selectedStyle === 'color') ? colors.select : colors.text) + ';';
                rule += ' --lvPopup-BClr-Select: ' + ((selectedStyle === 'color') ? 'inherit' : colors.select) + ';';
                rule += ' --lvPopup-Clr-Hover-Select: ' + ((hoverStyle === 'color') ? colors.hoverSelect : colors.text) + ';';
                rule += ' --lvPopup-BClr-Hover-Select: ' + ((hoverStyle === 'color') ? 'inherit' : colors.hoverSelect) + ';';
                rule += ' --lvPopup-Clr-Hover-Icon: ' + ((tbHoverStyle === 'background') ? 'inherit' : colors.iconsHover) + ';';
                rule += ' --lvPopup-BClr-Hover-Icon: ' + ((tbHoverStyle === 'background') ? colors.iconsHover : 'inherit') + ';';
                rule += ' --lvPopup-Filter-Hover-Icon: ' + ((tbHoverStyle === 'background') ? 'inherit' : 'var(--lvPopup-Filter-Hover-Icon)') + ';';
                rule += ' --lvPopup-Clr-Nowplaying: ' + colors.nowplaying + ';';
                rule += '}';
                styleTag.sheet.insertRule(rule, styleTag.sheet.cssRules.length);
            }
        },
        setLVPopupStyles: function (img, div, doDullenColor) {
            // first, find the default style of lvItem selected color, hover color and toolbutton hover color
            templates.findLVStyleColorTypes();
            let LV = div.parentListView;
            // Grab image's color from either memory cache or image element.
            let path = img.getAttribute('src');
            let clr;
            if (cachedColors[path]) {
                clr = cachedColors[path];
            }
            else {
                clr = colorThief.getColor(img);
                cachedColors[path] = clr;
            }
            if (doDullenColor) {
                clr = [
                    clr[0] * 0.8,
                    clr[1] * 0.8,
                    clr[2] * 0.8
                ];
            }
            let backclr = 'rgb(' + clr[0] + ', ' + clr[1] + ', ' + clr[2] + ')';
            div.style.backgroundColor = backclr;
            LV.createPopupIndicator().style.fill = backclr;
            let parentEl = div.parentElement;
            let parentID = parentEl.controlClass.uniqueID;
            if (selectedStyle === 'color') {
                // change color
                if ((clr[0] + clr[1] + clr[2]) / 3 < 128) {
                    templates.setPopupListColors(div.controlClass.uniqueID, {
                        text: 'white',
                        hover: getShiftedRGB(20, clr),
                        select: getShiftedRGB(100, clr),
                        hoverSelect: getShiftedRGB(120, clr),
                        nowplaying: 'rgb(255, 255, 150)',
                        iconsHover: 'rgb(255, 215, 70)',
                        textHover: 'rgb(255, 215, 70)'
                    }, parentID);
                }
                else {
                    templates.setPopupListColors(div.controlClass.uniqueID, {
                        text: 'black',
                        hover: getShiftedRGB(-20, clr),
                        select: getShiftedRGB(-100, clr),
                        hoverSelect: getShiftedRGB(-120, clr),
                        nowplaying: 'rgb(0, 0, 0)',
                        iconsHover: 'rgb(100, 75, 0)'
                    }, parentID);
                }
            }
            else {
                // change background color
                if ((clr[0] + clr[1] + clr[2]) / 3 < 128) {
                    templates.setPopupListColors(div.controlClass.uniqueID, {
                        text: 'white',
                        hover: getShiftedRGB(20, clr),
                        select: getShiftedRGB(50, clr),
                        hoverSelect: getShiftedRGB(70, clr),
                        nowplaying: 'rgb(255, 255, 150)',
                        iconsHover: 'rgb(255, 215, 70)',
                        textHover: 'rgb(255, 215, 70)'
                    }, parentID);
                }
                else {
                    templates.setPopupListColors(div.controlClass.uniqueID, {
                        text: 'black',
                        hover: getShiftedRGB(-20, clr),
                        select: getShiftedRGB(-50, clr),
                        hoverSelect: getShiftedRGB(-70, clr),
                        nowplaying: 'rgb(0, 0, 0)',
                        iconsHover: 'rgb(100, 75, 0)'
                    }, parentID);
                }
            }
            if (div.controlClass && !div.controlClass._cleanStyleFuncAdded) {
                div.controlClass.addCleanFunc(function () {
                    templates.setPopupListColors(div.controlClass.uniqueID, undefined, parentID); // clean styles for this div
                });
                div.controlClass._cleanStyleFuncAdded = true;
            }
        },
        itemImageTooltip: function (div, item, itemIndex, el) {
            el.removeAttribute('data-tip');
            item.getInfoAsync().then(function (infoStr) {
                if (el && (div.itemIndex === itemIndex)) {
                    el.setAttribute('data-tip', infoStr);
                }
            });
        },
        nodeItemImageFunc: function (div, node, itemIndex, params) {
            templates.nodeIconFunc(div, node); // needs to be always called to be sure we have the actual icon (e.g. 'loading' vs 'podcast' -- issue #13757)
            if (node.handlerID != 'loading' && node.dataSource && (node.dataSource.getThumbAsync || node.dataSource.getCachedThumb))
                templates.itemImageFunc(div, node.dataSource, itemIndex, params);
            else
                templates.itemImageFunc(div, null /* to clean up and make icon visible*/, itemIndex, params);
        },
        itemImageFunc: function (div, item, itemIndex, params) {
            if (div.artwork && !div.artworkImg) {
                div.artworkImg = div.artwork;
                div.controlClass = div.controlClass || new Control(div); // to allow correct cleaning
                div.controlClass.addCleanFunc(function () {
                    div.artworkImg = undefined;
                });
            }
            let imgEl = div.artworkDiv || div.artworkImg;
            if (imgEl && (!div.noaa || !isChildOf(imgEl.parentElement, div.noaa))) {
                div.noaa = document.createElement('div');
                div.noaa.classList.add('artwork');
                div.noaa.setAttribute('data-icon', 'unknownAA');
                div.noaa.setAttribute('data-id', 'noaa');
                let next = imgEl.nextElementSibling;
                if (next)
                    imgEl.parentElement.insertBefore(div.noaa, next);
                else
                    imgEl.parentElement.appendChild(div.noaa);
                initializeControls(imgEl.parentElement);
                setVisibility(div.noaa, false);
                div.controlClass = div.controlClass || new Control(div); // to allow correct cleaning
                div.controlClass.addCleanFunc(function () {
                    div.noaa = undefined;
                });
            }
            //var showODS = div.getAttribute('data-id') === 'nowPlayingCurrentTrackPanel';
            if (!item) {
                if (div.artwork)
                    setVisibility(div.artwork, false);
                if (div.artworkImg)
                    setVisibility(div.artworkImg, false);
                if (div.artworkDiv)
                    setVisibility(div.artworkDiv, false);
                if (div.noaa)
                    setVisibility(div.noaa, true);
                if (div.saveIcon)
                    setVisibility(div.saveIcon, false);
                return;
            }
            params = params || {};
            let registerChange = resolveToValue(params.registerChange, false);
            let changed = true;
            let doInit = !params.noAAShowDelay || (div._lastImgPersistentID == undefined);
            if (params.updateWhenChanged) {
                changed = !item || (item && (item.persistentID != div._lastImgPersistentID));
            }
            let ready = false;
            let checkIsCurrentItem = function (div, item, itemIndex) {
                if (itemIndex !== undefined) {
                    return ((div.itemIndex === itemIndex) && (div._lastImgPersistentID === item.persistentID));
                }
                else {
                    let oldPersistentID = div._lastImgPersistentID;
                    if (div.loadingPromise)
                        oldPersistentID = div.loadingPromise.lastImgPersistentID;
                    return oldPersistentID === item.persistentID;
                }
            };
            if (div.loadingPromise) {
                if (checkIsCurrentItem(div, item, itemIndex)) {
                    //if (showODS) ODS('itemImageFunc - received for same item '+div.loadingPromise.lastImgPersistentID);
                    return; // already fetching image for the same item
                }
                cancelPromise(div.loadingPromise);
                div.loadingPromise = undefined;
            }
            div._lastgroupID = div._groupID;
            div._lastImgPersistentID = item.persistentID;
            div._lastTitle = item.title;
            //if (showODS) ODS('itemImageFunc - received update for '+div._lastImgPersistentID);
            let showNoAATimer = undefined;
            let cancelShowAA = function () {
                if (showNoAATimer)
                    clearTimeout(showNoAATimer);
                showNoAATimer = undefined;
                ready = true;
            };
            let handleVisibility = function (type) {
                if (window._cleanUpCalled)
                    return;
                if (div.artworkImg)
                    setVisibility(div.artworkImg, (type == showImg), {
                        animate: false,
                        layoutchange: false
                    });
                if (div.artworkDiv)
                    setVisibility(div.artworkDiv, (type === showDiv), {
                        animate: false,
                        layoutchange: false
                    });
                if (div.noaa)
                    setVisibility(div.noaa, (type === showNoAA), {
                        animate: false,
                        layoutchange: false
                    });
                if (div.saveIcon) {
                    setVisibilityFast(div.saveIcon, div.showSaveIcon && (type !== showNoAA));
                }
                if (params.onChangeVisibility) {
                    params.onChangeVisibility((type !== showNoAA));
                }
            };
            let imgLoaded = function () {
                //if (showODS) ODS('itemImageFunc - loaded image');
                if (div.srcAsAssigned) {
                    //if (showODS) ODS('itemImageFunc - loaded image - cancel noAA show');
                    cancelShowAA();
                    handleVisibility(showImg);
                }
                if (params.onLoad) {
                    params.onLoad();
                }
            };
            let imgFailed = function () {
                handleVisibility(showNoAA);
                if (div.srcAsAssigned && _utils.isImageFile(div.srcAsAssigned)) {
                    ODS('Failed to load ' + div.srcAsAssigned);
                    app.filesystem.deleteURLFileAsync(div.srcAsAssigned).then((wasDeleted) => {
                        if (wasDeleted) {
                            div.srcAsAssigned = undefined;
                            app.utils.clearThumbPathsCache();
                            if (div.parentListView) {
                                div.parentListView.rebind();
                            }
                        }
                    });
                }
                if (params.onError) {
                    params.onError();
                }
            };
            if (!params.doNotHideDiv && !div.loadListenerSet && div.artworkImg) {
                div.controlClass = div.controlClass || new Control(div);
                div.controlClass.localListen(div.artworkImg, 'load', function () {
                    imgLoaded();
                });
                div.controlClass.localListen(div.artworkImg, 'error', function () {
                    imgFailed();
                });
                div.loadListenerSet = true;
            }
            div._currentLoader = div._currentLoader || 0;
            let currentLoader = ++div._currentLoader;
            let showThumb = function (path, pathToOrigCachedFile, isSync) {
                div.loadingPromise = undefined;
                if ((currentLoader === div._currentLoader) && div.artworkImg && (div.parentListView || (item && !item.isFastAccessObject))) { // parentListView not present for NP view
                    //if (showODS) ODS('itemImageFunc - showThumb new path '+path);
                    if (path && path !== '-') {
                        let differentImage = div.srcAsAssigned !== path;
                        if (differentImage || params.saveImageFunc || ((div.artworkImg.style.display === 'none'))) { // need to call when saving image enabled, we need to check save button visibility
                            if (path && (path[0] == '<')) {
                                if (differentImage) {
                                    // there is multiple img tags in the "path", use innerHTML
                                    div.artworkDiv.innerHTML = path;
                                    initializeControls(div.artworkDiv); // due to data-icon
                                }
                                if (!params.doNotHideDiv) {
                                    cancelShowAA();
                                    handleVisibility(showDiv);
                                }
                            }
                            else {
                                if (differentImage) {
                                    div.artworkImg.src = ''; // needed, otherwise load event is not called sometimes
                                    div.artworkImg.src = path;
                                }
                                let canShowSaveIcon = true;
                                let itm;
                                if (isSync)
                                    itm = item;
                                else
                                    itm = getLVItem(div, item);
                                if (itm && (itm.objectType === 'album') && itm.id < 0) // to not show save icon for albums not in library (e.g. Audio CD)
                                    canShowSaveIcon = false;
                                if (canShowSaveIcon && pathToOrigCachedFile && (pathToOrigCachedFile !== '-') && params.saveImageFunc && window.uitools.getCanEdit()) {
                                    if (!div.saveIcon) {
                                        div.saveIcon = document.createElement('div');
                                        div.saveIcon.classList.add('artworkSaveIcon');
                                        div.saveIcon.setAttribute('data-icon', 'save');
                                        div.saveIcon.setAttribute('data-tip', 'Save image to tag or file folder');
                                        div.saveIcon.setAttribute('data-control-class', 'ToolButton');
                                        imgEl.parentElement.appendChild(div.saveIcon);
                                        initializeControls(imgEl.parentElement);
                                        div.saveIcon.controlClass.saveImage = function (evt) {
                                            let LV = div.parentListView;
                                            let itm = getLVItem(div, item);
                                            if (itm) {
                                                let addImgParams = undefined;
                                                if (LV)
                                                    addImgParams = LV.addArtworkRules;
                                                params.saveImageFunc(itm, div.saveIcon.controlClass.pathToOrigCachedFile, function () {
                                                    div.showSaveIcon = false;
                                                    if (div.saveIcon)
                                                        setVisibilityFast(div.saveIcon, false);
                                                    if (LV && LV.dataSource && LV.dataSource.notifyChanged)
                                                        LV.dataSource.notifyChanged();
                                                }, addImgParams);
                                            }
                                            if (evt)
                                                evt.stopPropagation();
                                        };
                                        if (!div.parentListView || !div.parentListView.readOnly) {
                                            div.saveIcon.controlClass.localListen(div.saveIcon, 'click', div.saveIcon.controlClass.saveImage);
                                            div.saveIcon.controlClass.localListen(div.saveIcon, 'touchend', div.saveIcon.controlClass.saveImage);
                                        }
                                        div.saveIcon.controlClass.addCleanFunc(function () {
                                            div.saveIcon = undefined;
                                        });
                                    }
                                    div.saveIcon.controlClass.pathToOrigCachedFile = pathToOrigCachedFile;
                                    div.showSaveIcon = true;
                                }
                                else {
                                    div.showSaveIcon = false;
                                    if (div.saveIcon) {
                                        div.saveIcon.controlClass.pathToOrigCachedFile = undefined;
                                    }
                                }
                                if (div.saveIcon)
                                    setVisibilityFast(div.saveIcon, false);
                            }
                        }
                        if (!differentImage && params.saveImageFunc && div.srcAsAssigned && div.saveIcon) {
                            setVisibilityFast(div.saveIcon, div.showSaveIcon);
                        }
                        ready = true;
                    }
                    else {
                        path = '';
                        if (div.saveIcon) {
                            div.saveIcon.controlClass.pathToOrigCachedFile = undefined;
                            div.showSaveIcon = undefined;
                        }
                        handleVisibility(showNoAA);
                    }
                    div.srcAsAssigned = path;
                }
            };
            let imgPath = '';
            if (params.imagePath) {
                imgPath = resolveToValue(params.imagePath, '');
            }
            if (imgPath) {
                showThumb(imgPath, undefined, true);
            }
            else {
                let w = parseInt(div.style.width);
                if (isNaN(w))
                    w = 0;
                let h = parseInt(div.style.height);
                if (isNaN(h))
                    h = 0;
                let pixelSize = Math.max(w, h);
                if (params.minPixelSize && (params.minPixelSize > pixelSize))
                    pixelSize = params.minPixelSize;
                if (!pixelSize) {
                    pixelSize = resolveToValue(params.defaultPixelSize, 200);
                    if (isNaN(pixelSize) || !pixelSize)
                        pixelSize = 200;
                }
                if (div._group) {
                    // we need to get album class
                    if (div._group.link)
                        item = div._group.link.get();
                }
                let path = '';
                if (item.itemImageType === 'icon') {
                    // use only icon, do not search for images
                    params.imgSearchFunc = undefined;
                }
                if (!params.notUseCache && item && item.getCachedThumb) {
                    path = item.getCachedThumb(pixelSize, pixelSize);
                    if ((path === '-') && (params.imgSearchFunc || params.canReturnAlbumArtwork)) { // we have search function or can search track artwork in album, reset, so image could be searched
                        path = '';
                    }
                }
                if (path === '' && item && item.getThumbAsync) {
                    params.tryCache = false; // we already checked cache and we want to avoid skipping automatic artwork searching by returning '-' from cache
                    params.title = item.title;
                    let cancelToken = uitools.getItemThumb(item, pixelSize, pixelSize, showThumb, params);
                    if (cancelToken >= 0) { // when path already exists, callback is called imediatelly so we need to check cancelToken (should be >0, or 0 when used thumbCallback)
                        div.loadingPromise = {
                            cancel: function () {
                                if (div.loadingPromise) {
                                    if (cancelToken > 0)
                                        app.cancelLoaderToken(cancelToken);
                                    div.loadingPromise.params.canceled = true;
                                    div.loadingPromise = undefined;
                                }
                            },
                            itemIndex: itemIndex,
                            lastImgPersistentID: div._lastImgPersistentID,
                            lastTitle: div._lastTitle,
                            params: params
                        };
                    }
                    else
                        div.loadingPromise = undefined;
                }
                else {
                    if (item.coverStorage === 2 /*csNotSaved*/)
                        showThumb(path, path, true); // we can use path to not original size, it is not used in this case, only indicates, that the cover is from temp, not saved yet
                    else
                        showThumb(path, undefined, true); // '-' handling inside showThumb
                }
            }
            if (!ready && !params.doNotHideDiv && changed) {
                let showNoAAIcon = function () {
                    if (!ready) {
                        //ODS('itemImageFunc - no thumb shown .. show noAA');
                        div.srcAsAssigned = undefined; // needed, because it can be already loading image for previous item in this div, which caused #15419 4)
                        handleVisibility(showNoAA);
                    }
                    showNoAATimer = undefined;
                };
                if (doInit)
                    showNoAAIcon();
                else
                    showNoAATimer = requestTimeout(showNoAAIcon, params.noAAShowDelay);
            }
            // register item change event handler (if required)
            if (div._lastImgPersistentID !== div._lastEventsID) {
                if (div._fieldListeners) {
                    forEach(div._fieldListeners, function (unlistenFunc) {
                        ODS('--- call unlisten for idx ' + div._lastEventsIdx);
                        unlistenFunc();
                    });
                    div._fieldListeners = undefined;
                }
            }
            if (changed && registerChange && (div._lastEventsID !== div._lastImgPersistentID)) {
                div._fieldListeners = div._fieldListeners || [];
                div.controlClass = div.controlClass || new Control(div); // to allow correct cleaning
                div._lastEventsID = div._lastImgPersistentID;
                div._lastEventsIdx = div.itemIndex;
                let changeListener = function (eventType) {
                    let div = this;
                    if ((eventType === 'artwork') && (div.controlClass)) {
                        let eid = div._lastEventsID;
                        div.controlClass.requestTimeout(() => {
                            if (eid !== div._lastImgPersistentID) {
                                return;
                            }
                            let itm = getLVItem(div, item, div._lastEventsIdx);
                            if (itm) {
                                let p = params;
                                p.registerChange = false;
                                templates.itemImageFunc(div, itm, itemIndex, p);
                            }
                        }, 50);
                    }
                }.bind(div);
                if (!div.controlClass.changeCleanerSet) {
                    div.controlClass.changeCleanerSet = true;
                    div.controlClass.addCleanFunc(function () {
                        let div = this;
                        if (div._fieldListeners) {
                            forEach(div._fieldListeners, function (unlistenFunc) {
                                unlistenFunc();
                            });
                            div._fieldListeners = undefined;
                        }
                    }.bind(div));
                }
                if (resolveToValue(params.addListener, false)) {
                    app.listen(item, 'change', changeListener);
                    div._fieldListeners.push(function () {
                        let div = this;
                        let itm = getLVItem(div, item, div._lastEventsIdx); // was fast object, we need to find the correct one
                        if (itm) {
                            //ODS('--- unregistering change event for ' + itm.title);
                            app.unlisten(itm, 'change', changeListener);
                        }
                        else {
                            ODS('--- cannot unregister change event for ' + div._lastEventsIdx);
                        }
                    }.bind(div));
                }
            }
            if (div.parentListView && params.makeDraggable) {
                div.parentListView.makeDraggable(div, true);
            }
            if (params.addShowFullSize) {
                div.unlisteners = div.unlisteners || [];
                let clickListener = app.listen(div, 'click', function () {
                    uitools.openDialog('dlgArtworkDetail', {
                        modal: true,
                        dataObject: item,
                        imgPath: div.srcAsAssigned,
                        preferImgPath: true
                    });
                });
                div.unlisteners.push(function () {
                    app.unlisten(div, 'click', clickListener);
                });
            }
            if (params.addContext) {
                div._item = item;
                if (!div._context) {
                    div._context = app.listen(div, 'contextmenu', function (e) {
                        let allitems = [];
                        if (params.addShowFullSize || params.addShowFullSizeMenu) {
                            allitems.push({
                                action: {
                                    title: _('Show full size'),
                                    visible: function () {
                                        return (div.srcAsAssigned) && (div.srcAsAssigned.length > 1);
                                    },
                                    execute: function () {
                                        uitools.openDialog('dlgArtworkDetail', {
                                            modal: true,
                                            dataObject: item,
                                            imgPath: div.srcAsAssigned,
                                            preferImgPath: true
                                        });
                                    }
                                },
                                order: 10,
                                grouporder: 10
                            });
                        }
                        if (params.addLookup) {
                            window.lastFocusedControl = div.coverContainer;
                            allitems.push({
                                action: {
                                    title: actions.coverLookup.title,
                                    icon: actions.coverLookup.icon,
                                    item: function () {
                                        return div._item;
                                    },
                                    visible: function () {
                                        let _this = this;
                                        return new Promise(function (resolve) {
                                            let item = _this.item();
                                            let isPlaylist = item.objectType === 'playlistentry';
                                            let isAlbum = item.objectType === 'album';
                                            let isTrack = item.objectType === 'track';
                                            let tracks;
                                            if (isAlbum) {
                                                _this._tracks = item; // so dlgAddArtwok later knows, it is album, #16550
                                                resolve(true);
                                                return;
                                            }
                                            else if (isPlaylist) {
                                                tracks = item.getTracklist();
                                            }
                                            else {
                                                tracks = app.utils.createTracklist(true);
                                                tracks.add(item);
                                            }
                                            tracks.whenLoaded().then(function () {
                                                _this._tracks = tracks;
                                                resolve(true);
                                            });
                                        });
                                    },
                                    execute: function () {
                                        let _this = this;
                                        let origItem = this._tracks;
                                        if (!origItem)
                                            return;
                                        let lastID = div._groupID;
                                        requirejs('helpers/searchTools');
                                        searchTools.searchAAImageDlg(origItem, function () {
                                            if (lastID === div._groupID) {
                                                templates.itemImageFunc(div, item, itemIndex, params);
                                            }
                                        }.bind(this), {
                                            showApply2Album: true,
                                            noDefaultIcon: (origItem.itemImageType !== 'notsavedimage') && (origItem.itemImageType !== 'icon')
                                        });
                                    }
                                },
                                order: 100,
                                grouporder: 50, // shoudl be same as auto-tag
                            });
                            // copy from tracklist menu, set traclist for menu to our ds
                            forEach(menus.tracklistMenuItems, function (mitem, idx) {
                                let mitemN = {};
                                let action = mitem.action;
                                mitemN.order = mitem.order;
                                mitemN.grouporder = mitem.grouporder;
                                mitemN.action = {
                                    title: action.title,
                                    icon: action.icon,
                                    actionType: action.actionType,
                                    visible: action.visible,
                                    disabled: action.disabled,
                                    checked: action.checked,
                                    checkable: action.checkable,
                                    execute: action.execute,
                                    getTracklist: function () {
                                        if (div.parentListView && div.parentListView.dataSource && isFunction(div.parentListView.dataSource.getSelectedTracklist))
                                            return div.parentListView.dataSource.getSelectedTracklist();
                                        let item = div._item;
                                        let isPlaylist = item.objectType === 'playlistentry';
                                        let isAlbum = item.objectType === 'album';
                                        let isTrack = item.objectType === 'track';
                                        let tracks;
                                        if (isAlbum || isPlaylist) {
                                            return item.getTracklist();
                                        }
                                        else {
                                            tracks = app.utils.createTracklist(true);
                                            tracks.add(item);
                                        }
                                    },
                                    shortcut: action.shortcut,
                                    submenu: action.submenu,
                                    parent: div.parentListView ? div.parentListView.container : div.coverContainer // assume we have selected tracks already in mouseup handler
                                };
                                allitems.push(mitemN);
                            });
                        }
                        if (allitems.length) {
                            let ctrl = new Control(div);
                            ctrl.addToContextMenu(allitems);
                            ctrl.contextMenuHandler(e);
                        }
                    }, true);
                }
            }
            else if (div._context) {
                app.unlisten(div, 'contextmenu', div._context, true);
                div._context = null;
            }
        },
        addViewAction: function (div, el) {
            let LV = div.parentListView;
            if (!div.vlistener) {
                div.vlistener = function (event) {
                    let newTabClick = isNewTabEvent(event);
                    if ((event.button !== 0 && !event.touches && !newTabClick) || (div.itemIndex === undefined)) {
                        return;
                    }
                    let item = LV.getItem(div.itemIndex);
                    if (item)
                        LV.raiseEvent('itemview', {
                            item: item,
                            div: div,
                            newTab: newTabClick
                        });
                    event.stopPropagation();
                };
                LV.localListen(el, 'click', div.vlistener);
                LV.localListen(el, 'touchend', div.vlistener);
            }
        },
        addImageGridSelectButton: function (div, onlyForTouch) {
            div.unlisteners = div.unlisteners || [];
            let LV = div.parentListView;
            LV.automaticSelectionMode = !onlyForTouch;
            if (div.selectButton || !LV.multiselect)
                return;
            if (!div.cloned) {
                div.selectButton = document.createElement('div');
                div.selectButton.setAttribute('data-id', 'selectButtonDiv');
                //div.selectButton.setAttribute('data-bind-undefined', 'func: if(div.hasAttribute(\'data-selected\')) el.setAttribute(\'data-selected\', 1); else el.removeAttribute(\'data-selected\');'); // is it needed? Removed because of #21022
                div.selectButton.className = 'selectButtonBg showWhenSelectionMode';
                div.selectButton.style.zIndex = 99999; // instead of topmost to fix issue F) at #12451
                div.selectButton.innerHTML = '<div data-id="btnSelectIcon" class="selectButtonIcon showWhenItemSelected showWhenSelectionMode" data-icon="check"></div>';
                div.appendChild(div.selectButton);
            }
            else {
                div.selectButton = qeid(div, 'selectButtonDiv');
            }
            initializeControls(div.selectButton);
            let btnSelectIcon = qeid(div.selectButton, 'btnSelectIcon');
            let selectListener = function (e) {
                if (e.shiftKey) // range selection handled by LV itself, #16259
                    return;
                let dIndex = div.itemIndex;
                let ds = LV.dataSource;
                ds.modifyAsync(function () {
                    let wasSelected = false;
                    if (LV.selectionMode)
                        wasSelected = ds.isSelected(dIndex);
                    else {
                        ds.clearSelection(); // clear selection, so previously selected item is not selected after activation of selection mode, it was confusing
                        LV.selectionMode = true; // have to be set before changing selection to correctly update statusbar
                    }
                    ds.setSelected(dIndex, !wasSelected);
                    ds.focusedIndex = dIndex;
                    if (wasSelected)
                        LV.closePopup();
                });
                e.stopPropagation();
            }.bind(this);
            let ignoreEvent = function (e) {
                if (e.shiftKey) // range selection handled by LV itself, #16259
                    return;
                e.stopPropagation();
            };
            LV.localListen(div.selectButton, 'mousedown', ignoreEvent); // overload mousedown, so default LV selection handling is not used here
            LV.localListen(div.selectButton, 'mouseup', ignoreEvent); // stop propagation, to avoid unwanted selection change in default LV handler
            LV.localListen(div.selectButton, 'touchstart', ignoreEvent, true);
            LV.localListen(div.selectButton, 'touchend', ignoreEvent, true);
            LV.localListen(div.selectButton, 'click', selectListener, true);
            if (!onlyForTouch && !LV.hoverChangeHandlerSet) {
                LV.hoverChangeHandlerSet = true;
                app.listen(LV.container, 'itemhoverchange', function (e) {
                    let det = e.detail;
                    if (det.lastDiv && det.lastDiv.selectButton) {
                        det.lastDiv.selectButton.style.display = ''; // reset display, so default is used
                    }
                    if (det.newDiv && !LV.selectionMode) {
                        LV.requestTimeout(function () {
                            if ((LV._lastClickedDiv === det.newDiv) && (det.newDiv.selectButton)) {
                                // cannot use setVisibility, we control visibility by special classes and attributes here, setVisibility works only when used inline styles
                                det.newDiv.selectButton.style.display = 'block';
                            }
                        }, 1000, 'hovertimeout');
                    }
                    LV._lastClickedDiv = det.newDiv;
                });
            }
        },
        addImageGridButtons: function (div) {
            div.unlisteners = div.unlisteners || [];
            let LV = div.parentListView;
            if (!LV.actionButtons) {
                LV.unlisteners = LV.unlisteners || [];
                LV.growDiv = function (d) {
                    // scaling removed now
                    /* d.style.WebkitTransformOrigin = '50% 20%';
                    animTools.animate(d, {
                        scale: [1.15, 1]
                    });
                    d._isScaled = true;*/
                    if (!LV.dataSource)
                        return;
                    d.appendChild(LV.actionButtons);
                    LV.dataSource.locked(function () {
                        if (d.itemIndex === undefined)
                            return;
                        let isSelected = LV.dataSource.isSelected(d.itemIndex);
                        if (isSelected) {
                            LV.btnSelect.setAttribute('data-selected', 1);
                        }
                        else {
                            LV.btnSelect.removeAttribute('data-selected');
                        }
                        setVisibilityFast(LV.btnSelectIcon, isSelected);
                    });
                    setVisibilityFast(LV.actionButtons, true);
                };
                LV.shrinkDiv = function (d) {
                    /* if (d._isScaled) {
                        animTools.animate(d, {
                            scale: [1, 1.15]
                        });
                        d._isScaled = false;
                    }*/
                    setVisibilityFast(LV.actionButtons, false);
                };
                let preBindFn = function (d) {
                    if ((d._isScaled) && (d.itemIndex != LV._lastClickedDivIndex)) {
                        LV.shrinkDiv(d);
                        LV._lastClickedDiv = undefined;
                    }
                };
                LV.prebindFns = LV.prebindFns || [];
                LV.prebindFns.push(preBindFn);
                LV.actionButtons = document.createElement('div');
                LV.actionButtons.setAttribute('data-id', 'buttons');
                LV.actionButtons.className = 'topmost flex row left';
                LV.actionButtons.style.position = 'relative';
                LV.actionButtons.innerHTML =
                    '    <div data-id="btnShuffle" class="toolbutton-background" data-icon="shuffle" data-tip="Shuffle"></div>' +
                        '    <div data-id="btnPlay" class="toolbutton-background" data-icon="play" data-tip="Play"></div>' +
                        '    <div data-id="btnMenu" class="toolbutton-background" data-icon="menu" data-tip="Menu"></div>' +
                        '    <div data-id="filler" class="fill"></div>' +
                        '    <div data-id="btnSelect" class="toolbutton-background" data-tip="Select"><div data-id="btnSelectIcon" class="fill" data-icon="check"></div></div>';
                LV.container.appendChild(LV.actionButtons);
                initializeControls(LV.actionButtons);
                let hdiv = div;
                if (div.artworkDiv && div.artworkDiv.offsetHeight)
                    hdiv = div.artworkDiv;
                else if (div.noaa && div.noaa.offsetHeight)
                    hdiv = div.noaa;
                LV.btnSelect = qeid(LV.actionButtons, 'btnSelect');
                LV.btnSelectIcon = qeid(LV.btnSelect, 'btnSelectIcon');
                setVisibilityFast(LV.btnSelect, LV.multiselect);
                setVisibilityFast(LV.actionButtons, false);
                let getItem = function () {
                    let d = LV._lastClickedDiv;
                    let item = LV.getItem(d.itemIndex);
                    return item;
                };
                let selectListener = function (e) {
                    if (e.shiftKey) // range selection handled by LV itself, #16259
                        return;
                    let dIndex = LV._lastClickedDivIndex;
                    let ds = LV.dataSource;
                    ds.modifyAsync(function () {
                        let wasSelected = ds.isSelected(dIndex);
                        if (wasSelected) {
                            LV.btnSelect.removeAttribute('data-selected');
                        }
                        else {
                            LV.btnSelect.setAttribute('data-selected', 1);
                        }
                        setVisibilityFast(LV.btnSelectIcon, !wasSelected);
                        ds.setSelected(dIndex, !wasSelected);
                    });
                    e.stopPropagation();
                }.bind(this);
                let ignoreEvent = function (e) {
                    if (e.shiftKey) // range selection handled by LV itself, #16259
                        return;
                    e.stopPropagation();
                };
                LV.localListen(LV.btnSelect, 'mousedown', ignoreEvent); // overload mousedown, so default LV selection handling is not used here
                LV.localListen(LV.btnSelect, 'mouseup', ignoreEvent); // stop propagation, to avoid unwanted selection change in default LV handler
                LV.localListen(LV.btnSelect, 'click', selectListener, true);
                LV.localListen(LV.btnSelect, 'touchend', selectListener, true);
                LV.btnPlay = qeid(LV.actionButtons, 'btnPlay');
                let playListener = function (event) {
                    if (event.button !== 0 && !event.touches)
                        return;
                    let item = getItem();
                    let tracklist = item.getTracklist();
                    tracklist.whenLoaded().then(function () {
                        app.player.addTracksAsync(tracklist, {
                            withClear: true,
                            startPlayback: true
                        });
                    }.bind(this));
                    event.stopPropagation();
                }.bind(this);
                LV.localListen(LV.btnPlay, 'click', playListener);
                LV.localListen(LV.btnPlay, 'touchend', playListener);
                LV.btnShuffle = qeid(LV.actionButtons, 'btnShuffle');
                let shuffleListener = function (event) {
                    if (event.button !== 0 && !event.touches)
                        return;
                    let item = getItem();
                    let tracklist = item.getTracklist();
                    tracklist.whenLoaded().then(function () {
                        app.player.addTracksAsync(tracklist, {
                            withClear: true,
                            shuffle: true,
                            startPlayback: true
                        });
                    }.bind(this));
                    event.stopPropagation();
                }.bind(this);
                LV.localListen(LV.btnShuffle, 'click', shuffleListener);
                LV.localListen(LV.btnShuffle, 'touchend', shuffleListener);
                let menuListener = function (event) {
                    if (event.button !== 0 && !event.touches)
                        return;
                    LV.contextMenuHandler(event);
                    event.stopPropagation();
                }.bind(this);
                LV.btnMenu = qeid(LV.actionButtons, 'btnMenu');
                LV.localListen(LV.btnMenu, 'click', menuListener, true);
                LV.localListen(LV.btnMenu, 'touchend', menuListener, true);
                /* LV.btnView = qe(LV.actionButtons, '[data-id=btnView]');
                var vlistener = app.listen(LV.btnView, 'click', function (event) {
                    if (event.button !== 0 && !event.touches)
                        return;
                    var d = LV._lastClickedDiv;
                    var item = LV.getItem(d.itemIndex);
                    LV.raiseEvent('itemview', {
                        item: item,
                        div: d
                    });
                    event.stopPropagation();
                }.bind(this));
                LV.unlisteners.push(function () {
                    app.unlisten(LV.btnView, 'click', vlistener);
                });
                app.listen(LV.btnView, 'touchend', vlistener);
                LV.unlisteners.push(function () {
                    app.unlisten(LV.btnView, 'touchend', vlistener);
                });
                */
                app.listen(LV.container, 'itemhoverchange', function (e) {
                    if (e.detail.lastDiv) {
                        LV.shrinkDiv(e.detail.lastDiv); // collapse last hovered div
                    }
                    if (e.detail.newDiv) {
                        LV.requestTimeout(function () {
                            if (LV._lastClickedDiv === e.detail.newDiv) {
                                LV.growDiv(e.detail.newDiv); // expand the new one
                            }
                        }, 1000, 'hovertimeout');
                        LV._lastClickedDivIndex = e.detail.newDiv.itemIndex;
                    }
                    else {
                        LV._lastClickedDivIndex = -1;
                    }
                    LV._lastClickedDiv = e.detail.newDiv;
                });
            }
            let clickEvent = function (event) {
                let lastDiv = div.parentListView._lastClickedDiv;
                if (lastDiv != div) {
                    if (lastDiv)
                        LV.shrinkDiv(lastDiv); // collapse last clicked div
                    if (!event.shiftKey && !event.ctrlKey)
                        LV.growDiv(div); // expand the new one
                    LV._lastClickedDiv = div;
                }
                else {
                    // the same div is clicked again -> toggle                    
                    LV.shrinkDiv(lastDiv);
                    LV._lastClickedDiv = undefined;
                }
                LV._lastClickedDivIndex = div.itemIndex;
            };
            let listener = app.listen(div, 'touchlongclick', clickEvent);
            div.unlisteners.push(function () {
                app.unlisten(div, 'touchlongclick', listener);
            });
        },
        artworkListSaveImage: function (item, picturePath, refreshCbk, addImageParams) {
            let params = {
                modal: true,
                cover: item
            };
            if (addImageParams) {
                for (let key in addImageParams) {
                    params[key] = addImageParams[key];
                }
            }
            uitools.openDialog('dlgAddArtwork', params, function (w) {
                if (w.modalResult == 1) {
                    let result = w.getValue('getResult')();
                    if (!result) {
                        return;
                    }
                    let cstorages = [0, 1, 3];
                    item.coverStorage = cstorages[result.imageLocation];
                    item.picturePath = result.imageFilename;
                    if (refreshCbk)
                        refreshCbk();
                }
            });
        },
        artworkListItem: function (div) {
            if (!div.cloned) {
                div.innerHTML =
                    '<div class="flex fill row">' +
                        '  <div data-id="artworkBox" data-bind="func: templates.itemImageTooltip(div, item, div.itemIndex, el);" class="gridItemSquare noOverflow">' +
                        '    <img data-id="artwork" data-bind="func: templates.itemImageFunc(div, item, div.itemIndex, {saveImageFunc: templates.artworkListSaveImage, canReturnAlbumArtwork: true});" class="fill autosize allinside autoMargin">' +
                        '    <div data-id="unknownAA" class="fill largeIconColor" data-icon="unknownAA"></div>' +
                        '    <div data-id="deleteBtn" data-icon="delete" class="artworkDeleteButton" data-tip="Remove" data-control-class="ToolButton"></div>' +
                        '    <label data-id="sizeLbl" class="sizeLabel left" data-bind="func: var elem = el; var si = item.getCoverStorageInfo(); div.controlClass.localPromise(item.getSizeInfoAsync()).then(function (infoStr) { elem.innerHTML = infoStr + \'<div class=&quot;imageDetails&quot;>\' + si + \'</div>\'; })"></label>' +
                        '  </div>' +
                        '  <div class="flex fill column">' +
                        '    <div class="paddingLeft">' +
                        '       <label data-add-colon>Image type</label>' +
                        '       <div data-id="cbImageType" class="inline" data-ignoreDrag data-bind="func: el.controlClass.setInitialValue(item.coverTypeDesc)" data-control-class="Dropdown" data-init-params="{readOnly: true}"></div>' +
                        '    </div>' +
                        '    <div class="flex fill column padding">' +
                        '       <label data-add-colon>Description</label>' +
                        '       <textarea rows="6" data-id="boxDescription" data-ignoreDrag data-bind="func: el.value = item.description" class="fill noresize"></textarea>' +
                        '    </div>' +
                        '  </div>' +
                        '</div>';
            }
            initializeControls(div);
            div.controlClass = div.controlClass || new Control(div); // to allow localListen
            div.controlClass.localListen(qeid(div, 'artworkBox'), 'click', function (e) {
                e.stopPropagation();
                if (div.itemIndex === undefined)
                    return;
                div.parentListView.dataSource.focusedIndex = div.itemIndex; // to be sure, we have right value
                uitools.coverShow(div.parentListView.container);
            });
            let delBtn = qeid(div, 'deleteBtn');
            if (!div.parentListView.readOnly) {
                let deleteCover = function (e) {
                    e.stopPropagation();
                    if (div.itemIndex === undefined) {
                        return;
                    }
                    div.parentListView.dataSource.focusedIndex = div.itemIndex; // to be sure, we have right value
                    uitools.coverRemove(div.parentListView.container, true /* delete only focused item */);
                };
                div.controlClass.localListen(delBtn, 'click', deleteCover);
                div.controlClass.localListen(delBtn, 'touchend', deleteCover);
            }
            else {
                setVisibility(delBtn, false);
            }
            div.artwork = qeid(div, 'artwork');
            div.artwork.draggable = false; // so dragging image will drag whole item instead img only
            setVisibility(div.artwork, false);
            div.noaa = qeid(div, 'unknownAA');
            setVisibility(div.noaa, false);
            div.cbImageType = qeid(div, 'cbImageType');
            div.cbImageType.controlClass.dataSource = app.utils.getCoverTypes();
            div.controlClass.localPromise(div.cbImageType.controlClass.dataSource.whenLoaded()).then(function () {
                if (div.itemIndex !== undefined) {
                    let cover = div.parentListView.getItem(div.itemIndex);
                    if (cover)
                        div.cbImageType.controlClass.value = cover.coverTypeDesc;
                }
            });
            let _this = this;
            let callChangeEvent = function () {
                if (div.parentListView) {
                    div.parentListView.raiseEvent('itemchange', {});
                }
            };
            div.description = qeid(div, 'boxDescription');
            if (div.parentListView.readOnly) {
                div.description.readOnly = true;
                div.cbImageType.controlClass.disabled = true;
            }
            else {
                div.controlClass.localListen(div.cbImageType, 'change', function (e) {
                    if (div.itemIndex === undefined)
                        return;
                    let cover = div.parentListView.getItem(div.itemIndex);
                    cover.coverTypeDesc = this.controlClass.value;
                    callChangeEvent();
                });
                div.controlClass.localListen(div.cbImageType, 'click', function (e) {
                    e.stopPropagation();
                });
                div.controlClass.localListen(div.description, 'change', function (e) {
                    if (div.itemIndex === undefined)
                        return;
                    let cover = div.parentListView.getItem(div.itemIndex);
                    cover.description = this.value;
                    callChangeEvent();
                });
            }
            let stopPropFunc = function (e) {
                e.stopPropagation();
            };
            div.controlClass.addCleanFunc(function () {
                div.artwork = undefined;
                div.noaa = undefined;
                div.cbImageType = undefined;
                div.description = undefined;
            });
            // disable some event propagation, so LV will not steal focus
            let events = ['keyup', 'keydown', 'click', 'mouseup', 'mousedown'];
            forEach(events, function (evt) {
                div.controlClass.localListen(div.description, evt, stopPropFunc);
            });
        },
        nodeIconFunc: function (div, item, icon) {
            if (div.artwork && !div.artworkDiv)
                div.artworkDiv = div.artwork;
            icon = icon || item.icon || nodeUtils.getNodeIcon(item);
            if (icon != div.loadedIcon) {
                div.srcAsAssigned = undefined;
                cleanBasicElement(div.noaa);
                loadIcon(icon, function (iconData) {
                    div.loadedIcon = icon;
                    if (div.noaa)
                        div.noaa.innerHTML = iconData;
                });
            }
            else if (!icon /* && div.cloned*/) // needs to be cleaned for cached divs too (#15516)
                cleanBasicElement(div.noaa);
            if (icon) {
                div.firstLine.classList.remove('largeText');
                div.firstLine.classList.remove('slopingText');
                div.firstLine.style.marginTop = '';
            }
            else {
                div.loadedIcon = undefined;
                div.firstLine.classList.add('largeText');
                div.firstLine.classList.add('slopingText'); // sloping text needed e.g. for Music > Rating --> stars/text "sloping" display 
                let itemHeight = parseFloat(div.style.height);
                div.firstLine.style.marginTop = -Math.floor((itemHeight / 2 - window.fontLineSizePx() / 2)) + 'px'; // move to the center of item div
            }
        },
        itemIconFunc: function (div, item, el, icon) {
            if (icon != div.loadedIcon) {
                cleanBasicElement(el);
                loadIcon(icon, function (iconData) {
                    div.loadedIcon = icon;
                    el.innerHTML = iconData;
                    el.classList.add('icon');
                });
            }
            else if (!icon && div.cloned)
                cleanBasicElement(el);
        },
        setYoutubeIconDiv: function (div) {
            div.classList.toggle('youtubeIconText', true);
            div.innerText = '[YouTube]';
            div.setAttribute('data-tip', 'YouTube');
        },
        itemDoubleIconFunc: function (div, item, icon1, icon2) {
            if (!div.icon1) {
                div.icon1 = document.createElement('div');
                div.appendChild(div.icon1);
            }
            if (!div.icon2) {
                div.classList.add('flex');
                div.classList.add('row');
                div.icon2 = document.createElement('div');
                div.appendChild(div.icon2);
            }
            if (icon1 && icon1 != div.loadedIcon1) {
                cleanBasicElement(div.icon1);
                if (icon1 === 'youtube') {
                    templates.setYoutubeIconDiv(div.icon1);
                }
                else {
                    div.icon1.classList.toggle('youtubeIconText', false);
                    loadIcon(icon1, function (iconData) {
                        div.loadedIcon1 = icon1;
                        div.icon1.innerHTML = iconData;
                        div.icon1.classList.add('icon');
                    });
                }
            }
            else if (!icon1 || icon1 != div.loadedIcon1) {
                cleanBasicElement(div.icon1);
                div.loadedIcon1 = undefined;
            }
            if (icon1 == '')
                div.icon1.classList.add('icon'); // take space of the 'empty' icon
            if (icon2 && icon2 != div.loadedIcon2) {
                cleanBasicElement(div.icon2);
                if (icon2 === 'youtube') {
                    templates.setYoutubeIconDiv(div.icon2);
                }
                else {
                    div.icon2.classList.toggle('youtubeIconText', false);
                    loadIcon(icon2, function (iconData) {
                        div.loadedIcon2 = icon2;
                        div.icon2.innerHTML = iconData;
                        div.icon2.classList.add('icon');
                    });
                }
            }
            else if (!icon2 || icon2 != div.loadedIcon2) {
                cleanBasicElement(div.icon2);
                div.loadedIcon2 = undefined;
            }
            if (icon2 == '')
                div.icon2.classList.add('icon'); // take space of the 'empty' icon
        },
        rowNodeIconFunc: function (div, item, el) {
            let icon = nodeUtils.getNodeIcon(item);
            templates.itemIconFunc(div, item, el, icon);
        },
        rowNodeItem: function (div) {
            // row node items used e.g. when showing sub-containers + items in "List view" mode (e.g. playlists, folders)
            if (!div.cloned) {
                div.setAttribute('data-item-height', '[{}]');
                div.classList.add('flex');
                div.classList.add('row');
                div.classList.add('verticalCenter');
                div.classList.add('stretchWidth');
                div.innerHTML =
                    '  <div class="inline icon margin" data-bind="func: templates.rowNodeIconFunc(div, item, el);"></div>' +
                        '  <label class="inline" data-bind="func: el.textContent = nodeUtils.getNodeTitle(item, true);"></label>';
            }
        },
        podcastDownloadFunc: function (div, item, el) {
            let downloadItem = app.downloader.getDownloadItem(item.path);
            div.iconDownload.style.display = 'none';
            div.iconPlay.style.display = 'none';
            div.iconDelete.style.display = 'none';
            div.iconClose.style.display = 'none';
            if ((item.path.indexOf('://') < 0) || (downloadItem)) {
                if (downloadItem) {
                    div.iconClose.style.display = ''; /* to cancel download */
                }
                else {
                    if (item.playCounter < 1) {
                        div.iconPlay.style.display = ''; /* to play file */
                    }
                    else {
                        div.iconDelete.style.display = ''; /* to delete played file */
                    }
                }
            }
            else {
                div.iconDownload.style.display = ''; /* to download file */
            }
            if (downloadItem) {
                /* downloading of this item is pending */
                el.style.display = '';
                let ratio = 0;
                if (downloadItem.bytesTotal > 0) {
                    ratio = (downloadItem.bytesDownloaded / downloadItem.bytesTotal);
                }
                el.controlClass.text = (downloadItem.transferRateKBs * 8) + ' ' + _('kbps') + ', ' + Math.round(100 * ratio) + '%';
                el.controlClass.value = ratio;
            }
            else
                el.style.display = 'none';
        },
        episodeTitleDateFunc: function (div, item, el) {
            let date = app.utils.myEncodeDate(item.date);
            if (date != '')
                date = ' (' + date + ')';
            el.innerText = item.title + date;
        },
        episodeCommentFunc: function (div, item, el) {
            let downloadItem = app.downloader.getDownloadItem(item.path);
            if (downloadItem) {
                /* downloading of this item is pending */
                el.style.display = 'none';
            }
            else {
                el.style.display = '';
                el.innerText = item.commentShort;
            }
        },
        fillMultiValue: function (div, el, string, handler) {
            let ret = '';
            let cnt = 0;
            el.handlers = [];
            let values = string.split(';');
            values.forEach(function (value) {
                el.handlers[cnt] = handler + cnt + 'Label';
                if (ret != '')
                    ret += ', ';
                ret += '<label data-id="' + el.handlers[cnt] + '" class="trackInfoText multiline hotlink clickable">' + value + '</label>';
                cnt++;
            });
            el.innerHTML = ret;
            el._clickHandler = function (e) {
                e.stopPropagation();
                navigationHandlers[handler].navigate(string);
            }.bind(this);
            for (let i = 0; i < el.handlers.length; i++) {
                app.listen(qeid(el, el.handlers[i]), 'click', el._clickHandler);
            }
        },
        popupRenderers: {
            artist: function (LV, div, item, scrollToView, personID) {
                personID = personID || 'artist';
                if (item) {
                    // passed item -> initialize popup contents
                    if (div.controlClass && (div.controlClass._popupInitialized !== 'artist')) {
                        div.controlClass.cleanUp();
                    }
                    if (!div.controlClass || !div.controlClass._popupInitialized) {
                        div.classList.add('attributePopup');
                        div.classList.add('padding');
                        div.classList.add('dynroot');
                        div.controlClass = div.controlClass || new Control(div); // to allow localListen etc.                
                        div.innerHTML = '<div data-id="popupHeader" class="popupHeader"> \
                            <h2 data-id="artistTitle" class="inlineText verticalCenter"></h2> \
                                <div class="flex row left inline verticalCenter"> \
                                    <div data-id="btnPlayPopup" class="inline" data-control-class="ToolButton" data-icon="play" data-tip="Play" data-init-params="{standalone: true}"></div> \
                                    <div data-id="btnShufflePopup" class="inline" data-control-class="ToolButton" data-icon="shuffle" data-tip="Shuffle" data-init-params="{standalone: true}"></div> \
                                    <div data-id="btnMenuPopup" class="inline" data-control-class="MenuButton" data-icon="menu" data-tip="Menu"></div> \
                                </div> \
                            <div data-id="albumSortByControl" class="floatRight" data-control-class="SortBy" data-init-params="{sortType: \'album\', sortID: \'year\', useSortIDs: [\'album\', \'year\']}"></div> \
                            <div style="clear: both"></div></div>\
                            <div data-id="artistAlbumlist" class="blockTitleMarginFirst" data-control-class="AlbumListView" data-init-params="{hideArtists: true, isHorizontal: false, isGrouped: false, showHeader: false, showInline: true, dynamicSize: true, disableStatusbar: true, noScroll: true, autoSortString: \'year\'}"></div> \
                            <div data-id="artistTracklist" class="blockTitleMarginFirst" data-control-class="TracklistGrid" data-init-params="{isPopup: true, showInline: true, dynamicSize: false, disableStatusbar: true, noScroll: true, hideTrackNumber: true, autoSortString: \'title ASC\'}"></div>';
                        initializeControls(div);
                        div.controlClass.UI = getAllUIElements(div);
                    }
                    let divCtrl = div.controlClass;
                    divCtrl.item = item;
                    let UI = divCtrl.UI;
                    if (!divCtrl._popupInitialized) {
                        UI.artistAlbumlist.controlClass.excludeFromGlobalContextualSearch = true;
                        UI.artistTracklist.controlClass.excludeFromGlobalContextualSearch = true;
                        let ignoreEvent = function (e) {
                            e.stopPropagation();
                        };
                        divCtrl._getTracklist = function () {
                            divCtrl.tracklist = divCtrl.tracklist || divCtrl.item.getItemList('tracks');
                            return divCtrl.tracklist;
                        };
                        // stop propagation of mouse events, so they are not handled by parent listview
                        LV.localListen(div, 'mousedown', ignoreEvent);
                        LV.localListen(div, 'mouseup', ignoreEvent);
                        LV.localListen(div, 'click', (e) => {
                            UI.artistAlbumlist.focus();
                            ignoreEvent(e);
                        });
                        LV.localListen(div, 'contextmenu', ignoreEvent);
                        let playListener = function (event) {
                            if ((event.button !== 0 && !event.touches) || (!divCtrl.item.getItemList))
                                return;
                            window.lastFocusedControl = undefined; // reset, so it will use always our tracklist
                            uitools.handlePlayAction({
                                actionType: this.shuffle ? 'playNowShuffled' : 'playNow',
                                getTracklist: divCtrl._getTracklist.bind(divCtrl)
                            });
                            event.stopPropagation();
                        };
                        divCtrl.localListen(UI.btnPlayPopup, 'click', playListener);
                        divCtrl.localListen(UI.btnPlayPopup, 'touchend', playListener);
                        uitools.addPlayButtonMenu(UI.btnPlayPopup);
                        divCtrl.localListen(UI.btnShufflePopup, 'click', playListener.bind({
                            shuffle: true
                        }));
                        divCtrl.localListen(UI.btnShufflePopup, 'touchend', playListener.bind({
                            shuffle: true
                        }));
                        uitools.addShuffleButtonMenu(UI.btnShufflePopup);
                        addEnterAsClick(divCtrl, UI.btnPlayPopup);
                        addEnterAsClick(divCtrl, UI.btnShufflePopup);
                        divCtrl.updatePopupSize = function (forceRefresh, _scrollToView) {
                            if (!divCtrl)
                                return;
                            if (divCtrl.showingTracks) {
                                if (!UI.artistTracklist || !UI.artistTracklist.controlClass)
                                    return;
                                let ds = UI.artistTracklist.controlClass.dataSource;
                                if (!ds)
                                    return;
                                let tWidth = UI.artistTracklist.offsetWidth;
                                if (!forceRefresh && (tWidth === divCtrl._lastPopupWidth)) {
                                    return;
                                }
                                divCtrl._lastPopupWidth = tWidth;
                                let tlCtrl = UI.artistTracklist.controlClass;
                                let colWidth = tlCtrl.mainColumnWidth + tlCtrl.itemBoxProperties.paddingLeft + tlCtrl.itemBoxProperties.paddingRight;
                                let numCol = Math.max(Math.floor(tWidth / colWidth), 1);
                                let oneColumnTrackCnt = Math.ceil(ds.count / numCol);
                                if (oneColumnTrackCnt < 3) { // wrap only more than 3 tracks
                                    if (ds.count > 3)
                                        oneColumnTrackCnt = 3;
                                    else
                                        oneColumnTrackCnt = ds.count;
                                }
                                let tlHeight = Math.ceil(oneColumnTrackCnt * tlCtrl.itemHeight);
                                if (!forceRefresh && (tlHeight === parseFloat(UI.artistTracklist.style.height))) {
                                    return;
                                }
                                let sz = Math.ceil(UI.popupHeader.offsetHeight + tlHeight + getOuterHeight(UI.artistTracklist));
                                UI.artistTracklist.style.height = tlHeight + 'px';
                                div.style.height = sz + 'px';
                            }
                            else {
                                if (!UI.artistAlbumlist || !UI.artistAlbumlist.controlClass)
                                    return;
                                let ds = UI.artistAlbumlist.controlClass.dataSource;
                                if (!ds)
                                    return;
                                let tHeight = getFullHeight(UI.artistAlbumlist) + UI.popupHeader.offsetHeight;
                                if (!forceRefresh && (tHeight === divCtrl._lastPopupHeight)) {
                                    return;
                                }
                                divCtrl._lastPopupHeight = tHeight;
                                div.style.height = tHeight + 'px';
                                div.targetOffsetHeight = (UI.artistAlbumlist.targetOffsetHeight ?
                                    UI.artistAlbumlist.targetOffsetHeight + getOuterHeight(UI.artistAlbumlist) + getOuterHeight(div) + UI.popupHeader.offsetHeight :
                                    undefined); // Set target size after animation of the inner LV popup
                            }
                            LV.updatePopupRequest(div, undefined, _scrollToView);
                        };
                        divCtrl.localListen(UI.artistAlbumlist, 'sizechanged', function () {
                            divCtrl.updatePopupSize();
                        });
                        let menuArray = [];
                        // copy from tracklist menu, set traclist for menu to our ds
                        forEach(menus.tracklistMenuItems, function (mitem, idx) {
                            let mitemN = {};
                            let action = mitem.action;
                            mitemN.order = mitem.order;
                            mitemN.grouporder = mitem.grouporder;
                            mitemN.action = {
                                title: action.title,
                                icon: action.icon,
                                actionType: action.actionType,
                                visible: action.visible,
                                disabled: action.disabled,
                                checked: action.checked,
                                checkable: action.checkable,
                                execute: action.execute,
                                getTracklist: divCtrl._getTracklist,
                                onlySelected: false,
                                shortcut: action.shortcut,
                                submenu: action.submenu
                            };
                            menuArray.push(mitemN);
                        });
                        UI.btnMenuPopup.controlClass.menuArray = menuArray;
                        UI.btnMenuPopup.controlClass.parent = UI.artistAlbumlist;
                        divCtrl.addCleanFunc(function () {
                            divCtrl.tracklist = undefined;
                            divCtrl.item = undefined;
                        });
                        let navigateAlbum = function (e) {
                            divCtrl.openView(e.detail.item, 'album', e.detail.div, isNewTabEvent(e));
                        };
                        divCtrl.localListen(UI.artistAlbumlist, 'itemdblclick', navigateAlbum);
                        divCtrl.localListen(UI.artistAlbumlist, 'itementer', navigateAlbum);
                        divCtrl.localListen(UI.artistAlbumlist, 'itemview', navigateAlbum);
                        divCtrl._popupInitialized = 'artist';
                        divCtrl.localListen(UI.albumSortByControl, 'change', function () {
                            if (divCtrl.item && UI.artistAlbumlist.controlClass && UI.artistAlbumlist.controlClass.dataSource) {
                                UI.artistAlbumlist.controlClass.dataSource.setAutoSortAsync(UI.albumSortByControl.controlClass.sortString);
                            }
                        });
                    }
                    else {
                        // clear promises of previous popup content
                        divCtrl.cleanUpPromises();
                        // remove old tracklist
                        divCtrl.tracklist = undefined;
                        UI.artistTracklist.controlClass.dataSource = undefined;
                    }
                    // by default, show albums
                    setVisibilityFast(UI.artistTracklist, false, {
                        animate: false
                    });
                    divCtrl.showingTracks = false;
                    templates.hotlinkHandler(divCtrl.UI.artistTitle, divCtrl.item, divCtrl.UI.artistTitle, {
                        type: 'title',
                        handler: personID
                    });
                    // Steal color for the artist's first image
                    let focusedDiv = LV.getDiv(LV.focusedIndex);
                    if (focusedDiv) {
                        let artistImage = qeid(focusedDiv, 'artworkImg');
                        if (artistImage && isVisible(artistImage)) {
                            templates.setLVPopupStyles(artistImage, div, true);
                        }
                        else {
                            artistImage = qeid(focusedDiv, 'artworkDiv');
                            if (artistImage && isVisible(artistImage) && artistImage.firstElementChild &&
                                artistImage.firstElementChild.nodeName === 'IMG' &&
                                artistImage.firstElementChild.complete) {
                                templates.setLVPopupStyles(artistImage.firstElementChild, div, true);
                            }
                            else {
                                // no loaded image, default colors
                                div.style.backgroundColor = '';
                                LV.createPopupIndicator().style.fill = ''; // use the default value from CSS
                                templates.setPopupListColors(divCtrl.uniqueID, undefined, div.parentElement.controlClass.uniqueID);
                            }
                        }
                    }
                    setVisibilityFast(UI.albumSortByControl, false, {
                        animate: false
                    });
                    if (item.getItemList) {
                        setVisibilityFast(UI.artistAlbumlist, true, {
                            animate: false
                        });
                        let alblst = item.getItemList('albums', UI.albumSortByControl.controlClass.sortString);
                        UI.artistAlbumlist.controlClass.dataSource = alblst;
                        divCtrl.localPromise(alblst.whenLoaded()).then(function () {
                            if (div.contains(UI.artistAlbumlist)) {
                                if (alblst.count === 0) {
                                    // no album found, read tracks
                                    setVisibilityFast(UI.artistAlbumlist, false, {
                                        animate: false
                                    });
                                    divCtrl.localPromise(divCtrl._getTracklist().whenLoaded()).then(function () {
                                        if (!UI.artistTracklist.controlClass)
                                            return;
                                        UI.artistTracklist.controlClass.dataSource = divCtrl.tracklist;
                                        setVisibilityFast(UI.artistTracklist, true, {
                                            animate: false
                                        });
                                        divCtrl.showingTracks = true;
                                        UI.artistTracklist.controlClass.adjustSize();
                                        divCtrl.updatePopupSize(true);
                                        if (!divCtrl._tracklistListenersSet) {
                                            divCtrl.localListen(UI.artistTracklist, 'itemdblclick', uitools.defaultItemAction);
                                            divCtrl.localListen(UI.artistTracklist, 'itementer', uitools.defaultItemAction);
                                            divCtrl._tracklistListenersSet = true;
                                        }
                                    });
                                }
                                else if (alblst.count > 1) {
                                    if (divCtrl.item && UI.artistAlbumlist.controlClass && UI.artistAlbumlist.controlClass.dataSource) {
                                        UI.artistAlbumlist.controlClass.dataSource.setAutoSortAsync(UI.albumSortByControl.controlClass.sortString);
                                    }
                                    setVisibilityFast(UI.albumSortByControl, true, {
                                        animate: false
                                    });
                                }
                            }
                        });
                    }
                    else {
                        UI.artistAlbumlist.controlClass.dataSource = undefined; // remove old albumlist
                        setVisibilityFast(UI.artistAlbumlist, false, {
                            animate: false
                        });
                    }
                    divCtrl.updatePopupSize(true); // set initial size
                    return false; // div filled asynchronously, do not call immediate udpate, to reduce flickering
                }
                else {
                    // no item -> only refresh popup size
                    if (div.controlClass && div.controlClass.updatePopupSize)
                        div.controlClass.updatePopupSize(true, scrollToView);
                }
            },
            album: function (LV, div, item, scrollToView) {
                if (item) {
                    // passed item -> initialize popup contents
                    let divCtrl, UI;
                    //var tm = Date.now();
                    if (div.controlClass && (div.controlClass._popupInitialized !== 'album')) {
                        div.controlClass.cleanUp();
                    }
                    if (!div.controlClass || !div.controlClass._popupInitialized) {
                        div.classList.add('attributePopup');
                        div.classList.add('padding');
                        div.controlClass = div.controlClass || new Control(div); // to allow localListen etc.
                        divCtrl = div.controlClass;
                        divCtrl.item = item;
                        div.innerHTML = '<div data-id="popupHeader" class="popupHeader"> \
                            <div data-id="albumImageSquare" class="padding floatLeft middleImageSize" data-control-class="ArtworkRectangle" data-init-params="{sizeClass: \'middleImageSize\', exactSizeClass: \'middleImageSizeExact\'}"> \
                            </div> \
                            <h2 data-id="albumTitle" class="inlineText noLeftPadding verticalCenter"></h2> \
                            <h2 data-id="releaseYear" class="inlineText verticalCenter"></h2> \
                                <div class="flex row left inline verticalCenter"> \
                                    <div data-id="btnPlayPopup" class="inline" data-control-class="ToolButton" data-icon="play" data-tip="Play" data-init-params="{standalone: true}"></div> \
                                    <div data-id="btnShufflePopup" class="inline" data-control-class="ToolButton" data-icon="shuffle" data-tip="Shuffle" data-init-params="{standalone: true}"></div> \
                                    <div data-id="btnMenuPopup" class="inline" data-control-class="MenuButton" data-icon="menu" data-tip="Menu"></div> \
                                </div> \
                            <br/><h2 data-id="albumArtist" class="inlineText noLeftPadding verticalCenter"></h2> <div style="clear: both"></div></div> \
                            <div data-id="albumTracklistContainer" class="flex column"> </div>';
                        initializeControls(div);
                        divCtrl.UI = getAllUIElements(div);
                        UI = divCtrl.UI;
                        let ignoreEvent = function (e) {
                            e.stopPropagation();
                        };
                        // stop propagation of mouse events, so they are not handled by parent listview
                        LV.localListen(div, 'mousedown', ignoreEvent);
                        LV.localListen(div, 'mouseup', ignoreEvent);
                        LV.localListen(div, 'click', (e) => {
                            if (UI.albumTracklistContainer._tracklists.length)
                                UI.albumTracklistContainer._tracklists[0].focus();
                            ignoreEvent(e);
                        });
                        LV.localListen(div, 'contextmenu', ignoreEvent);
                        divCtrl._getTracklist = function () {
                            divCtrl.tracklist = divCtrl.tracklist || divCtrl.item.getTracklist();
                            return divCtrl.tracklist;
                        };
                        let playListener = function (event) {
                            if (event.button !== 0 && !event.touches)
                                return;
                            window.lastFocusedControl = undefined; // reset, so it will use always our tracklist
                            uitools.handlePlayAction({
                                actionType: this.shuffle ? 'playNowShuffled' : 'playNow',
                                getTracklist: divCtrl._getTracklist.bind(divCtrl)
                            });
                            event.stopPropagation();
                        };
                        divCtrl.localListen(UI.btnPlayPopup, 'click', playListener);
                        divCtrl.localListen(UI.btnPlayPopup, 'touchend', playListener);
                        uitools.addPlayButtonMenu(UI.btnPlayPopup);
                        divCtrl.localListen(UI.btnShufflePopup, 'click', playListener.bind({
                            shuffle: true
                        }));
                        divCtrl.localListen(UI.btnShufflePopup, 'touchend', playListener.bind({
                            shuffle: true
                        }));
                        uitools.addShuffleButtonMenu(UI.btnShufflePopup);
                        addEnterAsClick(divCtrl, UI.btnPlayPopup);
                        addEnterAsClick(divCtrl, UI.btnShufflePopup);
                        let menuArray = [];
                        // copy from tracklist menu, set traclist for menu to our ds
                        forEach(menus.tracklistMenuItems, function (mitem, idx) {
                            let mitemN = {};
                            let action = mitem.action;
                            mitemN.order = mitem.order;
                            mitemN.grouporder = mitem.grouporder;
                            mitemN.action = {
                                title: action.title,
                                icon: action.icon,
                                actionType: action.actionType,
                                visible: action.visible,
                                disabled: action.disabled,
                                checked: action.checked,
                                checkable: action.checkable,
                                execute: action.execute,
                                getTracklist: divCtrl._getTracklist,
                                onlySelected: false,
                                shortcut: action.shortcut,
                                submenu: action.submenu
                            };
                            menuArray.push(mitemN);
                        });
                        UI.btnMenuPopup.controlClass.menuArray = menuArray;
                        UI.btnMenuPopup.controlClass.parent = UI.albumTracklist;
                        UI.albumImageSquare.controlClass.dataObject = item;
                        divCtrl.localListen(UI.albumImageSquare, 'load', function (evt) {
                            if ((LV.popupDiv !== div) || !evt || !evt.detail || !evt.detail.img)
                                return;
                            divCtrl.loaded.img = true;
                            //ODS('--- img loaded at time ' + (Date.now()-tm) + 'ms');
                            if (divCtrl && divCtrl.updatePopupSize)
                                divCtrl.updatePopupSize(true /* force refresh */);
                            // we have image loaded, set popup style based on colors from this image
                            // #17777 JL: Set recoloring to be after updateSize to avoid style recalc
                            templates.setLVPopupStyles(evt.detail.img, div);
                        });
                        divCtrl.localListen(UI.albumImageSquare, 'error', function (evt) {
                            if ((LV.popupDiv !== div) || !evt || !evt.detail || !evt.detail.img || !item)
                                return;
                            // image deleted, tried to fetch again, but only once
                            if (divCtrl.secondAttempt || !evt.detail.deleted) {
                                // cannot load image, default colors
                                divCtrl.secondAttempt = false;
                                divCtrl.showThumb('-');
                            }
                            else {
                                divCtrl.secondAttempt = true;
                                let cancelToken = item.getThumbAsync(200, 200, divCtrl.showThumb, {
                                    highPriority: true
                                });
                                divCtrl.loadingPromise = {
                                    cancel: function () {
                                        app.cancelLoaderToken(cancelToken);
                                        divCtrl.loadingPromise = undefined;
                                    },
                                };
                            }
                        });
                        divCtrl.showThumb = function (path) {
                            divCtrl.loadingPromise = undefined;
                            if ((LV.popupDiv !== div))
                                return;
                            if (path && (path !== '-')) {
                                setVisibility(UI.albumImageSquare, true);
                                UI.albumImageSquare.controlClass.showImage(path);
                            }
                            else {
                                // no image, default colors
                                div.style.backgroundColor = '';
                                templates.setPopupListColors(divCtrl.uniqueID, undefined, div.parentElement.controlClass.uniqueID);
                                divCtrl.loaded.img = true;
                                setVisibility(UI.albumImageSquare, false);
                            }
                        };
                        divCtrl.updatePopupSize = function (forceRefresh, _scrollToView) {
                            if (!UI.albumTracklistContainer || !UI.albumTracklistContainer._tracklists || !divCtrl)
                                return;
                            let computeLVSize = function (tlCtrl) {
                                let ds = tlCtrl.dataSource;
                                if (!ds) {
                                    return 0;
                                }
                                let tWidth = tlCtrl.container.offsetWidth;
                                if (!forceRefresh && (tWidth === divCtrl._lastPopupWidth)) {
                                    return 0;
                                }
                                divCtrl._lastPopupWidth = tWidth;
                                let colWidth = tlCtrl.mainColumnWidth + tlCtrl.itemBoxProperties.paddingLeft + tlCtrl.itemBoxProperties.paddingRight + tlCtrl.itemRowSpacing;
                                let numCol = Math.max(Math.floor((tWidth + tlCtrl.itemRowSpacing) / colWidth), 1); // spacing after last column does not count
                                let oneColumnTrackCnt = Math.ceil(ds.count / numCol);
                                if (oneColumnTrackCnt < 3) { // wrap only more than 3 tracks
                                    if (ds.count > 3)
                                        oneColumnTrackCnt = 3;
                                    else
                                        oneColumnTrackCnt = ds.count;
                                }
                                let tlHeight = Math.ceil(oneColumnTrackCnt * tlCtrl.itemHeight);
                                // stretch columns to fill the space
                                let lastRowDim = tlCtrl.rowDimension;
                                tlCtrl.rowDimension = Math.floor((tWidth + tlCtrl.itemRowSpacing) / numCol) - tlCtrl.itemRowSpacing - tlCtrl.itemBoxProperties.paddingRight - tlCtrl.itemBoxProperties.paddingLeft;
                                tlCtrl.itemBoxProperties.width = tlCtrl.rowDimension;
                                if (tlCtrl._outerHeight === undefined)
                                    tlCtrl._outerHeight = getOuterHeight(tlCtrl.container);
                                return tlHeight;
                            };
                            let total = 0;
                            for (let i = 0; i < UI.albumTracklistContainer._titles.length; i++) {
                                if (isVisible(UI.albumTracklistContainer._titles[i])) {
                                    if (UI.albumTracklistContainer._titles[i]._outerHeight === undefined) {
                                        UI.albumTracklistContainer._titles[i]._outerHeight = getOuterHeight(UI.albumTracklistContainer._titles[i]);
                                    }
                                    total += UI.albumTracklistContainer._titles[i]._outerHeight;
                                    if (UI.albumTracklistContainer._titles[i].textContent) {
                                        if (UI.albumTracklistContainer._titles[i]._cachedHeight === undefined) {
                                            UI.albumTracklistContainer._titles[i]._cachedHeight = UI.albumTracklistContainer._titles[i].offsetHeight;
                                        }
                                        total += UI.albumTracklistContainer._titles[i]._cachedHeight;
                                    }
                                }
                            }
                            for (let i = 0; i < UI.albumTracklistContainer._tracklists.length; i++) {
                                let tlCtrl = UI.albumTracklistContainer._tracklists[i];
                                if (isVisible(tlCtrl)) {
                                    let sz = computeLVSize(tlCtrl.controlClass);
                                    if (sz != 0) {
                                        tlCtrl.style.height = sz + 'px';
                                        total += sz + tlCtrl.controlClass._outerHeight;
                                    }
                                    else {
                                        total += parseFloat(tlCtrl.style.height) + tlCtrl.controlClass._outerHeight;
                                    }
                                }
                            }
                            div.style.height = Math.ceil(UI.popupHeader.offsetHeight + total + getOuterHeight(UI.albumTracklistContainer)) + 'px';
                            LV.updatePopupRequest(div, undefined, _scrollToView);
                            //notifyLayoutChange(); // commented out, really needed?
                        };
                        let parentEl = div.parentElement;
                        if (parentEl && parentEl.controlClass) {
                            parentEl.controlClass.addCleanFunc(function () {
                                // get back default colors
                                div.style.backgroundColor = '';
                                templates.setPopupListColors(divCtrl.uniqueID, undefined, parentEl.controlClass.uniqueID);
                                divCtrl.tracklist = undefined;
                                divCtrl.item = undefined;
                                if (divCtrl.loadingPromise) {
                                    cancelPromise(divCtrl.loadingPromise);
                                    divCtrl.loadingPromise = undefined;
                                }
                            });
                        }
                        divCtrl._popupInitialized = 'album';
                    }
                    else {
                        divCtrl = div.controlClass;
                        divCtrl.item = item;
                        UI = divCtrl.UI;
                        UI.albumImageSquare.controlClass.dataObject = item;
                        // clear promises of previous popup content
                        divCtrl.cleanUpPromises();
                        if (divCtrl.loadingPromise) {
                            cancelPromise(divCtrl.loadingPromise);
                            divCtrl.loadingPromise = undefined;
                        }
                        // remove old tracklist
                        if (UI.albumTracklistContainer) {
                            if (UI.albumTracklistContainer._titles) {
                                for (let i = 0; i < UI.albumTracklistContainer._titles.length; i++) {
                                    UI.albumTracklistContainer._titles[i].innerText = '';
                                }
                            }
                            if (UI.albumTracklistContainer._tracklists) {
                                for (let i = 0; i < UI.albumTracklistContainer._tracklists.length; i++) {
                                    UI.albumTracklistContainer._tracklists[i].controlClass.dataSource = undefined;
                                }
                            }
                        }
                        divCtrl.tracklist = undefined;
                        // clear old image
                        UI.albumImageSquare.controlClass.hideImage();
                    }
                    divCtrl.getMergedTracklist = function () {
                        let ret = app.utils.createTracklist();
                        let UI = divCtrl.UI;
                        if (UI.albumTracklistContainer._tracklists) {
                            for (let i = 0; i < UI.albumTracklistContainer._tracklists.length; i++) {
                                if (UI.albumTracklistContainer._tracklists[i].controlClass.dataSource)
                                    ret.addListPreserveFlags(UI.albumTracklistContainer._tracklists[i].controlClass.dataSource);
                            }
                            ret.notifyLoaded();
                        }
                        return ret;
                    };
                    templates.hotlinkHandler(UI.albumTitle, divCtrl.item, UI.albumTitle, {
                        type: 'title',
                        handler: 'album'
                    });
                    UI.releaseYear.textContent = ((item.year > 100) && (item.year < 9999)) ? ' (' + item.year + ')' : '';
                    divCtrl.loaded = {};
                    if (item && item.getThumbAsync) {
                        div.style.backgroundColor = 'rgba(0, 0, 0, 0)'; // transparent until image is loaded
                        LV.createPopupIndicator().style.fill = ''; // use the default value from CSS
                        divCtrl.secondAttempt = false;
                        let cancelToken = item.getThumbAsync(200, 200, divCtrl.showThumb, {
                            highPriority: true
                        });
                        divCtrl.loadingPromise = {
                            cancel: function () {
                                app.cancelLoaderToken(cancelToken);
                                divCtrl.loadingPromise = undefined;
                            },
                        };
                    }
                    else {
                        // no image
                        divCtrl.loaded.img = true;
                    }
                    let getTracklistTitle = function (idx) {
                        let ret;
                        if (UI.albumTracklistContainer._titles.length - 1 >= idx)
                            ret = UI.albumTracklistContainer._titles[idx];
                        else {
                            let div = document.createElement('h5');
                            div.classList.add('blockTitleMarginFirst');
                            UI.albumTracklistContainer.appendChild(div);
                            UI.albumTracklistContainer._titles.push(div);
                            ret = div;
                        }
                        setVisibility(ret, true, {
                            animate: false
                        });
                        return ret;
                    };
                    let getTracklistLV = function (lists, idx) {
                        let ret;
                        if (UI.albumTracklistContainer._tracklists.length - 1 >= idx)
                            ret = UI.albumTracklistContainer._tracklists[idx];
                        else {
                            let div = document.createElement('div');
                            div.setAttribute('data-control-class', 'TracklistGrid');
                            div.setAttribute('data-init-params', '{isPopup: true, showInline: true, dynamicSize: false, disableStatusbar: true, noScroll: true}');
                            divCtrl.localListen(div, 'touchend', uitools.touchDefaultItemAction);
                            divCtrl.localListen(div, 'itemdblclick', uitools.defaultItemAction);
                            divCtrl.localListen(div, 'itementer', uitools.defaultItemAction);
                            divCtrl.localListen(div, 'sizechanged', divCtrl.updatePopupSize);
                            UI.albumTracklistContainer.appendChild(div);
                            UI.albumTracklistContainer._tracklists.push(div);
                            initializeControls(UI.albumTracklistContainer);
                            ret = div;
                            div.controlClass.excludeFromGlobalContextualSearch = true;
                        }
                        ret.controlClass.dataSource = lists[idx];
                        setVisibility(ret, true, {
                            animate: false
                        });
                        ret.controlClass.adjustSize();
                        return ret;
                    };
                    let trackType = 'music';
                    let hasVideoContent = false;
                    let prepareDivs = function (lists, groupText) {
                        let idx = lists.length - 1;
                        let titleDiv = getTracklistTitle(idx);
                        if ((groupText !== '') && isNaN(parseInt(groupText))) {
                            titleDiv.innerText = groupText;
                        }
                        else {
                            if (groupText !== '') {
                                if (hasVideoContent) {
                                    if (groupText)
                                        titleDiv.innerText = _('Season') + ' ' + groupText;
                                }
                                else
                                    titleDiv.innerText = _('Disc') + ' ' + groupText;
                            }
                        }
                        return getTracklistLV(lists, idx);
                    };
                    let list = divCtrl._getTracklist();
                    divCtrl.localPromise(list.whenLoaded()).then(function () {
                        if (list.count > 0) {
                            list.locked(function () {
                                let sd = list.getValue(0);
                                trackType = sd.trackTypeStringId;
                                hasVideoContent = (trackType === 'video') || (trackType === 'tv');
                            });
                        }
                        if (!hasVideoContent) {
                            templates.hotlinkHandler(UI.albumArtist, divCtrl.item, UI.albumArtist, {
                                type: 'albumArtist',
                                secType: 'artist',
                                handler: 'artist',
                                param2: divCtrl.item.albumArtistMBGID
                            });
                        }
                        else {
                            templates.hotlinkHandler(UI.albumArtist, divCtrl.item, UI.albumArtist, {
                                type: 'director',
                                secType: '',
                                handler: 'artist',
                                param2: divCtrl.item.albumArtistMBGID
                            });
                        }
                        let sortString;
                        if (hasVideoContent) {
                            list.groupName = 'season';
                            sortString = 'season ASC;episode ASC;title ASC';
                        }
                        else {
                            list.groupName = 'disc';
                            sortString = 'discNo ASC;order ASC;title ASC';
                        }
                        // when used localPromise, we cannot use continuation, it is not fully implemented, use nested promises instead
                        divCtrl.localPromise(list.setAutoSortAsync(sortString)).then(function () {
                            divCtrl.localPromise(list.prepareGroupsAsync({})).then(function () {
                                UI.albumTracklistContainer._titles = UI.albumTracklistContainer._titles || [];
                                UI.albumTracklistContainer._tracklists = UI.albumTracklistContainer._tracklists || [];
                                // enum how many discs album have
                                let lists = [];
                                let groupCount = list.getGroupsCount();
                                if (groupCount < 2) {
                                    lists.push(list);
                                    prepareDivs(lists, '');
                                }
                                else {
                                    list.locked(function () {
                                        let group;
                                        for (let i = 0; i < groupCount; i++) {
                                            group = list.getItemGroup(i, true);
                                            lists.push(list.getRange(group.index, group.index + group.itemCount - 1));
                                            prepareDivs(lists, group.id);
                                        }
                                    });
                                }
                                // hide rest titles and LVs (if there're any)
                                for (let i = lists.length; i < UI.albumTracklistContainer._titles.length; i++) {
                                    setVisibility(UI.albumTracklistContainer._titles[i], false, {
                                        animate: false
                                    });
                                }
                                for (let i = lists.length; i < UI.albumTracklistContainer._tracklists.length; i++) {
                                    setVisibility(UI.albumTracklistContainer._tracklists[i], false, {
                                        animate: false
                                    });
                                }
                                divCtrl.loaded.tracklist = true;
                                //ODS('--- tracklist loaded at time ' + (Date.now()-tm) + 'ms');
                                if (divCtrl && divCtrl.updatePopupSize) {
                                    divCtrl.updatePopupSize(true);
                                }
                            });
                        });
                    });
                    divCtrl.updatePopupSize(true); // set initial size
                    return false; // div filled asynchronously, do not call immediate udpate, to reduce flickering
                }
                else {
                    // no item -> only refresh popup size
                    if (div.controlClass && div.controlClass.updatePopupSize)
                        div.controlClass.updatePopupSize(true, scrollToView);
                }
            },
            genre: function (LV, div, item, scrollToView) {
                if (item) {
                    // passed item -> initialize popup contents
                    let divCtrl, UI;
                    if (div.controlClass && (div.controlClass._popupInitialized !== 'genre')) {
                        div.controlClass.cleanUp();
                    }
                    if (!div.controlClass || !div.controlClass._popupInitialized) {
                        div.classList.add('attributePopup');
                        div.classList.add('padding');
                        div.classList.add('dynroot');
                        div.controlClass = div.controlClass || new Control(div); // to allow localListen etc.                
                        divCtrl = div.controlClass;
                        divCtrl.item = item;
                        div.innerHTML = '<div data-id="popupHeader" class="popupHeader"> \
                            <h2 data-id="genreTitle" class="inlineText clickable verticalCenter"></h2> \
                                <div class="flex row left inline verticalCenter"> \
                                    <div data-id="btnPlayPopup" class="inline" data-control-class="ToolButton" data-icon="play" data-tip="Play" data-init-params="{standalone: true}"></div> \
                                    <div data-id="btnShufflePopup" class="inline" data-control-class="ToolButton" data-icon="shuffle" data-tip="Shuffle" data-init-params="{standalone: true}"></div> \
                                    <div data-id="btnMenuPopup" class="inline" data-control-class="MenuButton" data-icon="menu" data-tip="Menu"></div> \
                                </div> \
                            <div data-id="albumSortByControl" class="floatRight" data-control-class="SortBy" data-init-params="{sortType: \'album\', sortID: \'year\', useSortIDs: [\'album\', \'year\', \'artist\']}"></div> \
                            <div style="clear: both"></div></div>\
                            <div data-id="genreAlbumlist" class="blockTitleMarginFirst" data-control-class="AlbumListView" data-init-params="{isHorizontal: false, isGrouped: false, showHeader: false, showInline: true, dynamicSize: true, disableStatusbar: true, noScroll: true, autoSortString: \'year\'}"></div> \
                            <div data-id="genreTracklist" class="blockTitleMarginFirst" data-control-class="TracklistGrid" data-init-params="{isPopup: true, showInline: true, dynamicSize: false, disableStatusbar: true, noScroll: true, hideTrackNumber: true, autoSortString: \'title ASC\'}"></div>';
                        initializeControls(div);
                        divCtrl.UI = getAllUIElements(div);
                        UI = divCtrl.UI;
                        UI.genreAlbumlist.controlClass.excludeFromGlobalContextualSearch = true;
                        UI.albumSortByControl.controlClass.restorePersistentStates();
                        UI.genreTracklist.controlClass.excludeFromGlobalContextualSearch = true;
                        let ignoreEvent = function (e) {
                            e.stopPropagation();
                        };
                        // stop propagation of mouse events, so they are not handled by parent listview
                        LV.localListen(div, 'mousedown', ignoreEvent);
                        LV.localListen(div, 'mouseup', ignoreEvent);
                        LV.localListen(div, 'click', (e) => {
                            UI.genreAlbumlist.focus();
                            ignoreEvent(e);
                        });
                        LV.localListen(div, 'contextmenu', ignoreEvent);
                        divCtrl.localListen(UI.genreTitle, 'click', function () {
                            if (!divCtrl.item.isOnline && !divCtrl.item.tracksCallback)
                                uitools.globalSettings.showingOnline = false; // opens My Library mode, if item is not for online content
                            navigationHandlers.genre.navigate(divCtrl.item);
                        });
                        divCtrl._getTracklist = function () {
                            divCtrl.tracklist = divCtrl.tracklist || divCtrl.item.getItemList('tracks');
                            return divCtrl.tracklist;
                        };
                        divCtrl.updatePopupSize = function (forceRefresh, _scrollToView) {
                            if (!divCtrl)
                                return;
                            if (divCtrl.showingTracks) {
                                if (!UI.genreTracklist || !UI.genreTracklist.controlClass)
                                    return;
                                let ds = UI.genreTracklist.controlClass.dataSource;
                                if (!ds)
                                    return;
                                let tWidth = UI.genreTracklist.offsetWidth;
                                if (!forceRefresh && (tWidth === divCtrl._lastPopupWidth)) {
                                    return;
                                }
                                divCtrl._lastPopupWidth = tWidth;
                                let tlCtrl = UI.genreTracklist.controlClass;
                                let colWidth = tlCtrl.mainColumnWidth + tlCtrl.itemBoxProperties.paddingLeft + tlCtrl.itemBoxProperties.paddingRight;
                                let numCol = Math.max(Math.floor(tWidth / colWidth), 1);
                                let oneColumnTrackCnt = Math.ceil(ds.count / numCol);
                                if (oneColumnTrackCnt < 3) { // wrap only more than 3 tracks
                                    if (ds.count > 3)
                                        oneColumnTrackCnt = 3;
                                    else
                                        oneColumnTrackCnt = ds.count;
                                }
                                let tlHeight = Math.ceil(oneColumnTrackCnt * tlCtrl.itemHeight);
                                if (!forceRefresh && (tlHeight === parseFloat(UI.genreTracklist.style.height))) {
                                    return;
                                }
                                let sz = Math.ceil(UI.popupHeader.offsetHeight + tlHeight + getOuterHeight(UI.genreTracklist));
                                UI.genreTracklist.style.height = tlHeight + 'px';
                                div.style.height = sz + 'px';
                            }
                            else {
                                if (!UI.genreAlbumlist || !UI.genreAlbumlist.controlClass)
                                    return;
                                let ds = UI.genreAlbumlist.controlClass.dataSource;
                                if (!ds)
                                    return;
                                let tHeight = getFullHeight(UI.genreAlbumlist) + UI.popupHeader.offsetHeight;
                                if (!forceRefresh && (tHeight === divCtrl._lastPopupHeight)) {
                                    return;
                                }
                                divCtrl._lastPopupHeight = tHeight;
                                div.style.height = tHeight + 'px';
                                div.targetOffsetHeight = (UI.genreAlbumlist.targetOffsetHeight ?
                                    UI.genreAlbumlist.targetOffsetHeight + getOuterHeight(UI.genreAlbumlist) + getOuterHeight(div) + UI.popupHeader.offsetHeight :
                                    undefined); // Set target size after animation of the inner LV popup
                            }
                            LV.updatePopupRequest(div, undefined, _scrollToView);
                        };
                        divCtrl.localListen(UI.genreAlbumlist, 'sizechanged', function () {
                            divCtrl.updatePopupSize();
                        });
                        let playListener = function (event) {
                            if ((event.button !== 0 && !event.touches) || (!divCtrl.item.getItemList))
                                return;
                            window.lastFocusedControl = undefined; // reset, so it will use always our tracklist
                            uitools.handlePlayAction({
                                actionType: this.shuffle ? 'playNowShuffled' : 'playNow',
                                getTracklist: divCtrl._getTracklist.bind(divCtrl)
                            });
                            event.stopPropagation();
                        };
                        divCtrl.localListen(UI.btnPlayPopup, 'click', playListener);
                        divCtrl.localListen(UI.btnPlayPopup, 'touchend', playListener);
                        uitools.addPlayButtonMenu(UI.btnPlayPopup);
                        divCtrl.localListen(UI.btnShufflePopup, 'click', playListener.bind({
                            shuffle: true
                        }));
                        divCtrl.localListen(UI.btnShufflePopup, 'touchend', playListener.bind({
                            shuffle: true
                        }));
                        uitools.addShuffleButtonMenu(UI.btnShufflePopup);
                        addEnterAsClick(divCtrl, UI.btnPlayPopup);
                        addEnterAsClick(divCtrl, UI.btnShufflePopup);
                        let menuArray = [];
                        // copy from tracklist menu, set traclist for menu to our ds
                        forEach(menus.tracklistMenuItems, function (mitem /*, idx*/) {
                            let mitemN = {};
                            let action = mitem.action;
                            mitemN.order = mitem.order;
                            mitemN.grouporder = mitem.grouporder;
                            mitemN.action = {
                                title: action.title,
                                icon: action.icon,
                                actionType: action.actionType,
                                visible: action.visible,
                                disabled: action.disabled,
                                checked: action.checked,
                                checkable: action.checkable,
                                execute: action.execute,
                                getTracklist: divCtrl._getTracklist,
                                onlySelected: false,
                                shortcut: action.shortcut,
                                submenu: action.submenu
                            };
                            menuArray.push(mitemN);
                        });
                        UI.btnMenuPopup.controlClass.menuArray = menuArray;
                        UI.btnMenuPopup.controlClass.parent = UI.genreAlbumlist;
                        divCtrl.addCleanFunc(function () {
                            divCtrl.tracklist = undefined;
                            divCtrl.item = undefined;
                        });
                        let navigateAlbum = function (e) {
                            divCtrl.openView(e.detail.item, 'album', e.detail.div, isNewTabEvent(e));
                        };
                        divCtrl.localListen(UI.genreAlbumlist, 'itemdblclick', navigateAlbum);
                        divCtrl.localListen(UI.genreAlbumlist, 'itementer', navigateAlbum);
                        divCtrl.localListen(UI.genreAlbumlist, 'itemview', navigateAlbum);
                        divCtrl.localListen(UI.albumSortByControl, 'change', function () {
                            if (divCtrl.item && UI.genreAlbumlist.controlClass && UI.genreAlbumlist.controlClass.dataSource) {
                                UI.genreAlbumlist.controlClass.dataSource.setAutoSortAsync(UI.albumSortByControl.controlClass.sortString);
                                UI.albumSortByControl.controlClass.storePersistentStates();
                            }
                        });
                        divCtrl._popupInitialized = 'genre';
                    }
                    else {
                        divCtrl = div.controlClass;
                        divCtrl.item = item;
                        UI = divCtrl.UI;
                        // clear promises of previous popup content
                        divCtrl.cleanUpPromises();
                        // remove old tracklist
                        divCtrl.tracklist = undefined;
                        UI.genreTracklist.controlClass.dataSource = undefined;
                    }
                    setVisibilityFast(UI.genreTracklist, false, {
                        animate: false
                    });
                    UI.genreTitle.textContent = item.title;
                    divCtrl.showingTracks = false;
                    setVisibilityFast(UI.albumSortByControl, false, {
                        animate: false
                    });
                    if (item.getItemList) {
                        setVisibilityFast(UI.genreAlbumlist, true, {
                            animate: false
                        });
                        let alblst = item.getItemList('albums', UI.albumSortByControl.controlClass.sortString);
                        UI.genreAlbumlist.controlClass.dataSource = alblst;
                        divCtrl.localPromise(alblst.whenLoaded()).then(function () {
                            if (div.contains(UI.genreAlbumlist)) {
                                if (alblst.count === 0) {
                                    // no album found, read tracks
                                    setVisibilityFast(UI.genreAlbumlist, false, {
                                        animate: false
                                    });
                                    divCtrl.localPromise(divCtrl._getTracklist().whenLoaded()).then(function () {
                                        if (!UI.genreTracklist.controlClass)
                                            return;
                                        UI.genreTracklist.controlClass.dataSource = divCtrl.tracklist;
                                        setVisibilityFast(UI.genreTracklist, true, {
                                            animate: false
                                        });
                                        divCtrl.showingTracks = true;
                                        UI.genreTracklist.controlClass.adjustSize();
                                        divCtrl.updatePopupSize(true);
                                        if (!divCtrl._tracklistListenersSet) {
                                            divCtrl.localListen(UI.genreTracklist, 'itemdblclick', uitools.defaultItemAction);
                                            divCtrl.localListen(UI.genreTracklist, 'itementer', uitools.defaultItemAction);
                                            divCtrl._tracklistListenersSet = true;
                                        }
                                    });
                                }
                                else if (alblst.count > 1) {
                                    if (divCtrl.item && UI.genreAlbumlist.controlClass && UI.genreAlbumlist.controlClass.dataSource) {
                                        UI.genreAlbumlist.controlClass.dataSource.setAutoSortAsync(UI.albumSortByControl.controlClass.sortString);
                                    }
                                    setVisibilityFast(UI.albumSortByControl, true, {
                                        animate: false
                                    });
                                }
                            }
                        });
                    }
                    else {
                        UI.genreAlbumlist.controlClass.dataSource = undefined; // remove old albumlist
                        setVisibilityFast(UI.genreAlbumlist, false, {
                            animate: false
                        });
                    }
                    divCtrl.updatePopupSize(true); // set initial size
                    return false; // div filled asynchronously, do not call immediate udpate, to reduce flickering
                }
                else {
                    // no item -> only refresh popup size
                    if (div.controlClass && div.controlClass.updatePopupSize)
                        div.controlClass.updatePopupSize(true, scrollToView);
                }
            },
            feed: function (LV, div, item, scrollToView) {
                if (item) {
                    let divCtrl, UI;
                    if (div.controlClass && (div.controlClass._popupInitialized !== 'feed')) {
                        div.controlClass.cleanUp();
                    }
                    if (!div.controlClass || !div.controlClass._popupInitialized) {
                        div.classList.add('attributePopup');
                        div.classList.add('padding');
                        div.controlClass = div.controlClass || new Control(div); // to allow localListen etc.
                        divCtrl = div.controlClass;
                        divCtrl.item = item;
                        div.innerHTML =
                            '<div data-id="popupHeader" class="flex row popupHeader">' +
                                '   <div data-id="podcastImageSquare" class="flex column padding gridItemSquare" data-control-class="Control"> ' +
                                '       <img data-id="feedImage" class="gridItemSquare autosize verticalCenter" /> ' +
                                '   </div> ' +
                                '   <div class="padding flex column fill">' +
                                '      <div class="flex row left inline"> ' +
                                '           <h2 data-id="feedTitle" class="inlineText noLeftPadding textWrap"></h2> ' +
                                '           <div data-id="progressWheel" class="icon inline" data-icon="progress"></div> ' +
                                '           <div data-id="btnSubscribe" class="button rowButton inline">Subscribe</div>' +
                                '           <div data-id="btnWebLink" class="button rowButton inline">Web link</div>' +
                                '      </div> ' +
                                '      <div data-id="feedDescription" class="textWrap textOther padding"></div>' +
                                '   </div> ' +
                                '</div>' +
                                '<div data-id="tracklist" data-control-class="TracklistGrid" data-init-params="{isPopup: true, showInline: true, dynamicSize: false, disableStatusbar: true, noScroll: true}"></div>';
                        initializeControls(div);
                        divCtrl.UI = getAllUIElements(div);
                        UI = divCtrl.UI;
                        UI.tracklist.controlClass.excludeFromGlobalContextualSearch = true;
                        divCtrl.localListen(UI.btnSubscribe, 'click', function () {
                            uitools.subscribePodcast(div.controlClass.item);
                        });
                        divCtrl.localListen(UI.btnWebLink, 'click', function () {
                            uitools.openWeb(div.controlClass.item.webLink);
                        });
                        divCtrl.localListen(UI.feedImage, 'load', function () {
                            if ((LV.popupDiv !== div))
                                return;
                            divCtrl.secondAttempt = false;
                            setVisibilityFast(UI.podcastImageSquare, true);
                            // we have image loaded, set popup style based on colors from this image
                            templates.setLVPopupStyles(UI.feedImage, div);
                            divCtrl._onTaskCompleted();
                        });
                        divCtrl.localListen(UI.feedImage, 'error', function (evt) {
                            if ((LV.popupDiv !== div) || !evt || !evt.detail)
                                return;
                            // image deleted, tried to fetch again, but only once
                            if (divCtrl.secondAttempt || !evt.detail.deleted) {
                                divCtrl.secondAttempt = false;
                                divCtrl.showThumb('-');
                            }
                            else {
                                divCtrl.secondAttempt = true;
                                let cancelToken = item.getThumbAsync(200, 200, divCtrl.showThumb);
                                divCtrl.loadingPromise = {
                                    cancel: function () {
                                        app.cancelLoaderToken(cancelToken);
                                        divCtrl.loadingPromise = undefined;
                                    },
                                };
                            }
                        });
                        divCtrl.backTaskCompleted = 0;
                        divCtrl._onTaskCompleted = function () {
                            divCtrl.backTaskCompleted++;
                            if (divCtrl.backTaskCompleted == 2) {
                                setVisibility(UI.progressWheel, false);
                                if (divCtrl.item.available) {
                                    setVisibility(UI.btnSubscribe, true);
                                    if (div.controlClass.item.webLink != '')
                                        setVisibilityFast(UI.btnWebLink, true);
                                }
                            }
                        };
                        divCtrl.localListen(UI.tracklist, 'touchend', uitools.touchDefaultItemAction);
                        divCtrl.localListen(UI.tracklist, 'itemdblclick', uitools.defaultItemAction);
                        divCtrl.localListen(UI.tracklist, 'itementer', uitools.defaultItemAction);
                        divCtrl.showThumb = function (path) {
                            divCtrl.loadingPromise = undefined;
                            if ((LV.popupDiv !== div))
                                return;
                            if (path && (path !== '-')) {
                                UI.feedImage.src = path;
                            }
                            else {
                                // no image, default colors
                                //setVisibilityFast(UI.podcastImageSquare, false);
                                div.style.backgroundColor = '';
                                templates.setPopupListColors(divCtrl.uniqueID, undefined, div.parentElement.controlClass.uniqueID);
                                divCtrl._onTaskCompleted();
                            }
                        };
                        let parentEl = div.parentElement;
                        if (parentEl && parentEl.controlClass) {
                            parentEl.controlClass.addCleanFunc(function () {
                                div.style.backgroundColor = '';
                                templates.setPopupListColors(divCtrl.uniqueID, undefined, parentEl.controlClass.uniqueID);
                                divCtrl.item = undefined;
                                if (divCtrl.loadingPromise) {
                                    cancelPromise(divCtrl.loadingPromise);
                                    divCtrl.loadingPromise = undefined;
                                }
                            });
                        }
                        divCtrl._popupInitialized = 'feed';
                    }
                    else {
                        divCtrl = div.controlClass;
                        divCtrl.item = item;
                        UI = divCtrl.UI;
                        divCtrl.backTaskCompleted = 0;
                        UI.feedImage.src = '';
                        setVisibility(UI.progressWheel, true);
                        // clear promises of previous popup content
                        divCtrl.cleanUpPromises();
                        if (divCtrl.loadingPromise) {
                            cancelPromise(divCtrl.loadingPromise);
                            divCtrl.loadingPromise = undefined;
                        }
                    }
                    setVisibilityFast(UI.btnSubscribe, false);
                    setVisibilityFast(UI.btnWebLink, false);
                    UI.feedTitle.textContent = item.title;
                    UI.feedDescription.textContent = '';
                    divCtrl.localPromise(item.getChannelDataAsync()).then(function () {
                        if ((LV.popupDiv !== div))
                            return;
                        let feed = divCtrl.item;
                        if (!feed.available)
                            UI.feedDescription.textContent = _('The feed is no longer available');
                        else {
                            UI.feedTitle.textContent = feed.title;
                            UI.feedDescription.textContent = feed.description;
                            let episodes = feed.getEpisodeList(false, false);
                            UI.tracklist.controlClass.dataSource = episodes;
                            LV.localPromise(episodes.whenLoaded()).then(function () {
                                let rowCount = episodes.count;
                                UI.tracklist.style.height = UI.tracklist.controlClass.itemRowSpacing * rowCount / 2;
                                UI.tracklist.controlClass.showRowCount = rowCount;
                                UI.tracklist.controlClass.adjustSize();
                                LV.updatePopupRequest(div, undefined, scrollToView);
                            });
                        }
                        divCtrl._onTaskCompleted();
                    });
                    div.style.backgroundColor = 'rgba(0, 0, 0, 0)'; // transparent until image is loaded
                    LV.createPopupIndicator().style.fill = ''; // use the default value from CSS
                    let cancelToken;
                    cancelToken = item.getThumbAsync(200, 200, divCtrl.showThumb);
                    divCtrl.loadingPromise = {
                        cancel: function () {
                            app.cancelLoaderToken(cancelToken);
                            divCtrl.loadingPromise = undefined;
                        },
                    };
                    return false; // div filled asynchronously, do not call immediate udpate, to reduce flickering
                }
            },
            unplayedPodcast: function (LV, div, item, scrollToView) {
                if (item) {
                    let divCtrl, UI;
                    if (div.controlClass && (div.controlClass._popupInitialized !== 'podcast')) {
                        div.controlClass.cleanUp();
                    }
                    if (!div.controlClass || !div.controlClass._popupInitialized) {
                        div.classList.add('attributePopup');
                        div.classList.add('padding');
                        div.controlClass = div.controlClass || new Control(div); // to allow localListen etc.
                        divCtrl = div.controlClass;
                        divCtrl.item = item;
                        div.innerHTML =
                            '<div data-id="popupHeader" class="popupHeader">' +
                                '   <div data-id="podcastImageSquare" class="floatLeft padding gridItemSquare" data-control-class="Control"> ' +
                                '       <img data-id="feedImage" class="gridItemSquare autosize verticalCenter" /> ' +
                                '   </div> ' +
                                '   <div class="padding">' +
                                '       <h2 data-id="feedTitle" class="clickable inlineText noLeftPadding"></h2> ' +
                                '       <div data-id="tracklist" data-control-class="TracklistGrid" data-init-params="{isPopup: true, showInline: true, dynamicSize: false, disableStatusbar: true, noScroll: true, hideTrackNumber: true}"></div>' +
                                '   </div> ' +
                                '</div>';
                        initializeControls(div);
                        divCtrl.UI = getAllUIElements(div);
                        UI = divCtrl.UI;
                        divCtrl.localListen(UI.feedTitle, 'click', function (e) {
                            LV.openView(item, 'podcast', UI.feedImage /*LV.popupDiv*/, isNewTabEvent(e));
                        });
                        divCtrl.localListen(UI.feedImage, 'load', function () {
                            if ((LV.popupDiv !== div))
                                return;
                            divCtrl.secondAttempt = false;
                            setVisibilityFast(UI.podcastImageSquare, true);
                            // we have image loaded, set popup style based on colors from this image
                            templates.setLVPopupStyles(UI.feedImage, div);
                        });
                        divCtrl.localListen(UI.feedImage, 'error', function (evt) {
                            if ((LV.popupDiv !== div) || !evt || !evt.detail)
                                return;
                            // image deleted, tried to fetch again, but only once
                            if (divCtrl.secondAttempt || !evt.detail.deleted) {
                                divCtrl.secondAttempt = false;
                                divCtrl.showThumb('-');
                            }
                            else {
                                divCtrl.secondAttempt = true;
                                let cancelToken = item.getThumbAsync(200, 200, divCtrl.showThumb);
                                divCtrl.loadingPromise = {
                                    cancel: function () {
                                        app.cancelLoaderToken(cancelToken);
                                        divCtrl.loadingPromise = undefined;
                                    },
                                };
                            }
                        });
                        divCtrl.showThumb = function (path) {
                            divCtrl.loadingPromise = undefined;
                            if ((LV.popupDiv !== div))
                                return;
                            if (path && (path !== '-')) {
                                UI.feedImage.src = path;
                            }
                            else {
                                // no image, default colors
                                setVisibilityFast(UI.podcastImageSquare, false);
                                div.style.backgroundColor = '';
                                templates.setPopupListColors(divCtrl.uniqueID, undefined, div.parentElement.controlClass.uniqueID);
                            }
                        };
                        divCtrl.localListen(UI.tracklist, 'touchend', uitools.touchDefaultItemAction);
                        divCtrl.localListen(UI.tracklist, 'itemdblclick', uitools.defaultItemAction);
                        divCtrl.localListen(UI.tracklist, 'itementer', uitools.defaultItemAction);
                        let parentEl = div.parentElement;
                        if (parentEl && parentEl.controlClass) {
                            parentEl.controlClass.addCleanFunc(function () {
                                div.style.backgroundColor = '';
                                templates.setPopupListColors(divCtrl.uniqueID, undefined, parentEl.controlClass.uniqueID);
                                divCtrl.item = undefined;
                                if (divCtrl.loadingPromise) {
                                    cancelPromise(divCtrl.loadingPromise);
                                    divCtrl.loadingPromise = undefined;
                                }
                            });
                        }
                        divCtrl._popupInitialized = 'podcast';
                    }
                    else {
                        divCtrl = div.controlClass;
                        divCtrl.item = item;
                        UI = divCtrl.UI;
                        UI.feedImage.src = '';
                        // clear promises of previous popup content
                        divCtrl.cleanUpPromises();
                        if (divCtrl.loadingPromise) {
                            cancelPromise(divCtrl.loadingPromise);
                            divCtrl.loadingPromise = undefined;
                        }
                    }
                    UI.feedTitle.textContent = item.title;
                    let episodes = item.getEpisodeList(true /* downloaded */, true /* unplayed */);
                    UI.tracklist.controlClass.dataSource = episodes;
                    LV.localPromise(episodes.whenLoaded()).then(function () {
                        let rowCount = episodes.count;
                        UI.tracklist.style.height = UI.tracklist.controlClass.itemRowSpacing * rowCount;
                        UI.tracklist.controlClass.showRowCount = rowCount;
                        UI.tracklist.controlClass.adjustSize();
                        LV.updatePopupRequest(div, undefined, scrollToView);
                    });
                    div.style.backgroundColor = 'rgba(0, 0, 0, 0)'; // transparent until image is loaded
                    LV.createPopupIndicator().style.fill = ''; // use the default value from CSS
                    let cancelToken;
                    cancelToken = item.getThumbAsync(200, 200, divCtrl.showThumb);
                    divCtrl.loadingPromise = {
                        cancel: function () {
                            app.cancelLoaderToken(cancelToken);
                            divCtrl.loadingPromise = undefined;
                        },
                    };
                    return false; // div filled asynchronously, do not call immediate udpate, to reduce flickering
                }
            },
        }
    };
})();
