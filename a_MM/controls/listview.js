/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

'use strict';
registerFileImport('controls/listView');
import { DOM_DELTA_LINE, DOM_DELTA_PAGE, DRAG_DATATYPE } from '../consts';
import Control, { getPixelSize } from './control';
export function setPix(val) {
    if (typeof val === 'number')
        return val + 'px';
    else
        return val;
}
window.setPix = setPix;
const fullLVDebug = false;
const transitionEndEventName = 'webkittransitionend'; // JL: seems like it's supposed to be all lowercase
/**
UI ListView element

@class ListView
@constructor
@extends Control
*/
export default class ListView extends Control {
    _userInteractionDone() {
        // overriden in descendants
    }
    initialize(rootelem, params) {
        super.initialize(rootelem, params);
        let defaultPredrawAmount = 0; //2;
        let defaultDelayBeforePredraw = 400;
        // Public configuration values:
        // Main:
        this.isGrid = false;
        this.isHorizontal = false;
        this.isGrouped = false;
        this.checkGroups = false; // if true, check groups using getGroups and based on the result can be set isGrouped to true or false
        this._showHeader = false;
        this._showInline = false;
        this.reorderOnly = true;
        this._multiselect = true;
        this.itemCloningAllowed = true;
        this.useFastBinding = true;
        this.reportStatus = true;
        this._dynamicSize = false; // This LV has size (height) computed from its content, scrolls with its neighbours (i.e. doesn't operate its own scrollbar)
        this.popupSupport = false; // Show in-place pop-ups for clicked items.
        this.disabledClearingSelection = false; // by default, clicking outside items clears selection
        this.noScroll = (params && params.noScroll) || false; // Prevent scrolling (useful to let mouse wheel messages propagate)
        // Secondary:
        this.distributeEmptySpace = true; // Distribute horizontal space that's normally all on the right side
        this.itemHorzSpacing = 0; // px
        this.itemRowSpacing = 0; // px
        this.groupSpacing = 80; // px   // TODO: More dynamic? 
        this.groupHeaders = true;
        this.groupSeparators = true;
        this.showCaptionOnScroll = false; // Show a large caption when scrolling (currently not working)
        this.moveFirstGroupHeader = true; // Show first header even if it's scrolled off-screen (doesn't work well in Win8, due to scrolling canvas)        
        this.reloadSettings(); // set smooth/animated scroll and gridPopupDelay
        this.smoothScrollTimeLimit = (app.utils.system() === 'macos') ? 0 : (animTools.animationTime || 0.3) * 1000; // ms
        this.focusedAlsoSelected = true; // When focus is moved, the new item is also selected
        this.canScrollHoriz = false; // By default, no horizontal scrollbar is needed
        this._userInteractivePriority = true; // suspend auto-update when user interactive detected
        this._collapseSupport = true;
        this._useMouseHover = false; // we use hvoer only when moving by mouse, not by keys
        // Performance constants
        this.minCachedDivs = 10;
        this.maxCachedDivs = this.minCachedDivs; // Is automatically enlarged in case it's needed in order to cover the whole screen
        this.minTimeBetweenUpdates = 50; // ms
        this.delayBeforeFirstUpdate = 30; // ms
        this.preDrawAmount = defaultPredrawAmount;
        this.delayBeforePredraw = defaultDelayBeforePredraw; // ms
        this.ignoreReflowOptimizations = (params && params.ignoreReflowOptimizations) || false; // JL #18600: Reflow optimizations broke on dropdowns (TODO: Less hacky fix?)
        // The rest of code...
        // this.container.style.overflow = 'hidden';
        this.container.classList.add('listview');
        this.container.setAttribute('role', 'table'); // Screen reader support
        this.createHeaderLayout(); // have to be called before setting passed params, some properties need elements created in these create layout functions
        this.createItemsLayout();
        this.divs = []; // cache all visible item divs
        this.groupDivs = []; // cache all visible group heading divs
        this.groupSepDivs = []; // cache all visible group separator heading divs
        this.skips = []; // array of parts of the listview to be skipped/not drawn (reserved space for pop-ups, etc.)
        this.popupCache = []; // 1-2 cached popups that can be reused for a faster operation
        this._contextMenuPromises = []; // array of promises to wait for in contextMenuHandler
        this.itemCount = 0;
        this.itemHeight = -1;
        this.itemWidth = -1;
        this.itemBoxProperties = {
            height: 0,
            width: 0,
            paddingLeft: 0,
            paddingRight: 0
        };
        this.rowDimension = -1;
        this.colDimension = -1;
        this.smoothScrollAdjust = 0;
        // Groups
        this.groupHeight = -1;
        this.colGroupDimension = -1;
        this.groupSepHeight = -1;
        this.itemsPerRow = -1;
        this.firstCachedItem = 0;
        this.firstVisibleItem = 0;
        this.lastVisibleItem = -1;
        this.lastRefresh = 0;
        this.animateNextDraw = false;
        this.preDraw = false;
        this._shiftFocusedItem = -1; // Item used as an origin for Shift-Click selections
        this.itemRedistSpacing = 0;
        this.preDrawnScreens = 0;
        this._predrawTimeout = undefined;
        this._disablePredraw = false;
        this.drawQueued = false;
        this.focusVisible = false; // After keyboard usage, focus is visible, otherwise not.
        this._parentOffsetHeight = 0; // Set this, so that even non-dynamic height LV can rely on this being '0'.
        this._headerOffsetHeight = 0;
        this.oldWidth = -1;
        this.oldHeight = -1;
        this.canvasScrollLeft = 0;
        this.canvasScrollTop = 0;
        this._containerOffsetTop = 0;
        this._selectionMode = false;
        this.automaticSelectionMode = false;
        this._lassoSelectionStart = undefined;
        this.lassoSelectionEnabled = false;
        this.lassoAutoScrollOffset = 50;
        this.lassoParentElement = true;
        // set passed attributes
        for (let key in params) {
            this[key] = params[key];
        }
        this.updateParentScrollTop(); // LS: this needs to be called after setting of params above so that this.dynamicSize value is correct in scrollingParent getter (in order to get 'showInline' class) 
        //this.enableDragNDrop();
        this.enableTouch();
        if (!this.container.tabIndex || this.container.tabIndex < 0)
            this.container.tabIndex = 0; // Tab index makes sure that we can get focus.
        if (this.horizontalSeparator)
            this.initHorizontalSeparator();
        this.initListeners();
    }
    initHorizontalSeparator() {
        let div = document.createElement('div');
        div.className = 'hSeparatorLine';
        this.container.appendChild(div);
        this.horLineSepDiv = div;
        setVisibilityFast(this.horLineSepDiv, false);
    }
    initListeners() {
        this.localListen(app, 'close', () => {
            // cancel list loading on app close, to avoid unfinished promise error
            if (this._dataSource)
                cancelPromise(this._dataSource.whenLoaded());
        });
        this.localListen(app, 'settingschange', () => {
            this.reloadSettings();
        });
        // prepare mouse event handlers
        // some on viewport, so they are not called when clicking on scrollbar
        this.lastHoveredDiv = undefined;
        this.lastMouseDownDiv = undefined;
        let mouseDownCalled = false;
        app.listen(this.viewport, 'mouseup', (e) => {
            if (e.button == 3 || e.button == 4)
                return; // let the back/forward buttons bubble (#16406)
            if (!this._isTreeView) // #18097
                e.stopPropagation(); // needed when LV is inside of LV (e.g. popups in artist grid)
            // @ts-ignore    
            if (window.getCurrentEditor) // @ts-ignore
                if (window.getCurrentEditor()) // editing in progress ... do not change focus
                    return;
            this._updateHover_RateLimit(e.clientX, e.clientY); // be sure to have correct this.lastHoveredDiv
            if (this.lastHoveredDiv) {
                if (this.lastMouseDownDiv === this.lastHoveredDiv) {
                    this.handleItemMouseUp(this.lastHoveredDiv, e); // call mouseup handlers only if mouseup is on the same div as mousedown
                }
                else
                    this.setFocus(); // clicked on item ... make LV in focus
            }
            else if (mouseDownCalled && !this.movingOnGroups && !this.isPopupShown() && !e.shiftKey && !e.ctrlKey && !e.altKey &&
                this.dataSource && this.dataSource.clearSelection && e.button == 0 /*primary*/ && !this.disabledClearingSelection) {
                if (!this.showHeader || this.header.offsetHeight < e.offsetY) {
                    let ds = this.dataSource;
                    if (ds) {
                        ds.focusedIndex = -1;
                        ds.modifyAsync(() => {
                            ds.clearSelection();
                            this.selectionMode = false;
                        }, { onlyFlags: true });
                    }
                }
            }
            this._cleanUpLasso();
            this.afterUserInteraction();
            mouseDownCalled = false;
        });
        app.listen(this.viewport, 'mousemove', (e) => {
            if (fullLVDebug)
                ODS('mousemove');
            this._useMouseHover = true;
            this._updateHover_RateLimit(e.clientX, e.clientY); // be sure to have correct this.lastHoveredDiv
            if (this.lastHoveredDiv)
                this.handleItemMouseMove(this.lastHoveredDiv, e);
            else
                this.handleLassoMove(null, e);
        });
        app.listen(this.viewport, 'mouseleave', (e) => {
            if (fullLVDebug)
                ODS('mouseleave');
            if (!e.toElement && !e.relatedTarget && window.pageReady) {
                // probably was moved mouse out of the window or
                // #16253: when user click on track, mouseleave with toElement and relatedTarget undefined is called
                if (thisWindow.bounds.mouseInside() && !e.clientX && !e.clientY) // mouse is in window
                    return;
            }
            this.updateHover(-1, -1);
        });
        app.listen(this.viewport, 'mouseover', (e) => {
            if (fullLVDebug)
                ODS('mouseover');
            this._updateHover_RateLimit(e.clientX, e.clientY);
            if (this.lastHoveredDiv)
                this.handleItemMouseOver(this.lastHoveredDiv, e);
        }, true);
        app.listen(this.viewport, 'mousedown', (e) => {
            this._useMouseHover = true;
            if (e.button == 3 || e.button == 4)
                return; // let the back/forward buttons bubble (#16406)
            this._updateHover_RateLimit(e.clientX, e.clientY); // be sure to have correct this.lastHoveredDiv
            if (this.lastHoveredDiv) {
                this.lastMouseDownDiv = this.lastHoveredDiv;
                this.redrawFocusedItem(false);
                this.handleItemMouseDown(this.lastHoveredDiv, e);
                this.movingOnGroups = false;
            }
            else {
                this.lastMouseDownDiv = undefined;
                this.handleLassoStart(null, e);
            }
            mouseDownCalled = true; // indication, that mousedown was called on this LV
            e.stopPropagation();
            // @ts-ignore
            window._lastLVMouseDownTm = Date.now();
            this.afterUserInteraction();
        }, false);
        app.listen(this.viewport, 'click', (e) => {
            if (this.lastMouseDownDiv) {
                this.handleItemClick(this.lastMouseDownDiv, e);
            }
            e.stopPropagation();
            this.afterUserInteraction();
        }, false);
        app.listen(this.viewport, 'dblclick', (e) => {
            if (this.lastHoveredDiv) {
                this.handleItemDblClick(this.lastHoveredDiv, e);
            }
            e.stopPropagation();
            this.afterUserInteraction();
        }, false);
        app.listen(this.canvas, 'scroll', this.handleCanvasScroll.bind(this), false);
        app.listen(this.canvas, 'wheel' /* JL: changed from mousewheel to wheel */, this.mouseWheelHandler.bind(this), false);
        app.listen(this.canvas, 'mousedown', this.mousedownHandler.bind(this));
        this.registerEventHandler('keydown');
        this.registerEventHandler('keyup');
        this.registerEventHandler('layoutchange', true);
        this.localListen(window, 'lesschange', () => {
            this.lessChanged();
        });
        this.localListen(settings.observer, 'change', () => {
            this.rebind(); // to force image re-bind for grid view descendants            
        });
    }
    lessChanged() {
        this.itemHeightReset = true;
        this._refreshItemBoxProperties = true;
        this._adjustSizeNeeded = true;
        this._groupsRefresh = true;
        this._reComputeViewport = true;
        this.invalidateAll();
        if (this.isPopupShown()) {
            let skip = this.getSkip('popup');
            if (skip) { // update popup (#20994)                
                this.showPopup(skip.afterIndex, true); // Close already shown pop-up, close fast, do not animate
                this.showPopup(skip.afterIndex, true); // re-shown pop-up, fast, do not animate
            }
        }
    }
    _updateHover_RateLimit(x, y) {
        if (x == -1 && y == -1) {
            if (this.lastHoveredDiv) {
                this.lastHoveredDiv.removeAttribute('data-hover');
                this.raiseEvent('itemhoverchange', {
                    lastDiv: this.lastHoveredDiv,
                    newDiv: undefined
                });
                this.lastHoveredDiv = undefined;
            }
            return;
        }
        //if (fullLVDebug)
        //    ODS('_updateHover_RateLimit: x,y: ' + x + ',' + y);
        let rect = this.canvas.getBoundingClientRect();
        this._lastHoverUpdate = Date.now();
        if (this._canvasStartRect === undefined) {
            if (this.scrollingParent) {
                this._canvasStartRect = {
                    top: rect.top + this._parentScrollTop,
                    left: rect.left,
                    width: rect.width,
                    height: rect.height,
                };
            }
            else {
                this._canvasStartRect = this.canvas.getBoundingClientRect();
            }
        }
        let offsetX = x - rect.left;
        let offsetY = y - rect.top;
        if (!this.isGrid && !this.ignoreMouseOnGroup && this.colGroupDimension > 0) {
            offsetX += this.colGroupDimension;
        }
        // JH: The following hover handling is faster, since it doesn't require getBoundingClientRect(), but it is sometimes a bit off,
        //     which occurs when pop-up is being opened and there's also a smooth scrolling performed meanwhile.
        //     TODO: Fix the issues, so that this faster version could be enabled again.
        //            var offsetX = x - this._canvasStartRect.left;
        //            var offsetY = y - this._canvasStartRect.top;
        //            if (this.dynamicSize) {
        //                offsetY += this.getSmoothScrollOffset() + this.container.offsetTop;
        //            } else
        //            if (this.scrollingParent) { // If we have any scrolling element as a parent, use it for the calculation
        //                offsetY += this._parentScrollTop;
        //            }
        //            if (fullLVDebug)
        //                ODS("**Hover " + this.itemCount + ": " + y + ', ' + offsetY + " - " + this._parentScrollTop + ", " + this._canvasStartRect.top);
        let itIdx;
        if ((offsetX >= 0) && (offsetY >= 0) && this._canvasStartRect && (offsetX < this._canvasStartRect.width) && (offsetY < this._canvasStartRect.height) &&
            !(this.oldDropBefore || this.oldDropAfter /* don't draw hover while dragging */)) {
            itIdx = this.getItemFromRelativePosition(offsetX, offsetY);
        }
        let it = undefined;
        if (itIdx >= 0)
            it = this.getDiv(itIdx);
        if (fullLVDebug)
            ODS('_updateHover_RateLimit: ' + it + '|' + this.lastHoveredDiv + ' x,y: ' + x + ',' + y);
        let itChanged = (it !== this.lastHoveredDiv);
        if (itChanged) {
            if (this.lastHoveredDiv) {
                this.lastHoveredDiv.removeAttribute('data-hover');
            }
            if (it) {
                it.setAttribute('data-hover', '1');
            }
            this.raiseEvent('itemhoverchange', {
                lastDiv: this.lastHoveredDiv,
                newDiv: it
            });
            this.lastHoveredDiv = it;
            // @ts-ignore
            window._lastHoveredListViewDiv = it; // used for animations (to zoom from correct rectangle)
        }
    }
    updateHover(x, y) {
        if (!this._useMouseHover) {
            if (this.lastHoveredDiv) { // remove mousehover, so we do not have more if using keyboard, #17844
                this.lastHoveredDiv.removeAttribute('data-hover');
                this.raiseEvent('itemhoverchange', {
                    lastDiv: this.lastHoveredDiv,
                    newDiv: undefined
                });
                this.lastHoveredDiv = undefined;
            }
            return;
        }
        if (x === undefined)
            x = window.mouseX;
        if (y === undefined)
            y = window.mouseY;
        if (fullLVDebug)
            ODS('**updateHover: x,y: ' + x + ',' + y);
        // Rate limiting implemented to decrease CPU utilization (#12956)
        const diff = Date.now() - (this._lastHoverUpdate || 0);
        if (diff >= 18)
            this._updateHover_RateLimit(x, y);
        else
            this.requestTimeout(() => {
                this._updateHover_RateLimit(x, y);
            }, 18 - diff, '_updateHoverTimeout');
    }
    mouseWheelHandler(e) {
        this._useMouseHover = true;
        if (this._dynamicSize || this.noScroll || this.disabled || (window.isMenuVisible && window.isMenuVisible()))
            return;
        if (e.stopPropagation)
            e.stopPropagation();
        this.redrawFocusedItem(false);
        if (e.ctrlKey || e.altKey) // Alt key is here for Chromium which currently doesn't send Ctrl+Wheel events, since they are reserved for whole HTML page zoom (to be manually implemented by us)
         {
            if (e.wheelDelta > 0)
                this.zoomIn();
            else
                this.zoomOut();
        }
        else {
            let horz = this.isHorizontal;
            let delta = e.wheelDelta;
            if ((!horz && e.wheelDeltaX) || (e.shiftKey && e.wheelDeltaY)) {
                // scroll left-right on non horizontal view
                if (e.shiftKey) {
                    this.canvas.scrollLeft = this.canvas.scrollLeft + (-e.wheelDeltaY);
                    this.afterUserInteraction();
                    return;
                }
                else {
                    this.canvas.scrollLeft = this.canvas.scrollLeft + (-e.wheelDeltaX);
                }
            }
            if (!horz) {
                delta = -e.deltaY;
                if (e.deltaMode === DOM_DELTA_LINE) {
                    delta *= this.itemHeight;
                }
                else if (e.deltaMode === DOM_DELTA_PAGE) { // #16342
                    delta *= this.container.clientHeight;
                }
            }
            let scroll = this.getScrollOffset();
            let newPos = scroll - delta;
            /*                var scrollAnimationEnded = function() {
                                scrollCounter--;
                                if(!scrollCounter)
                                    app.unlisten(this.canvas, transitionEndEventName, scrollAnimationEnded);
                                updateHover();
                            };
                            if(!scrollCounter)
                                app.listen(this.canvas, transitionEndEventName, scrollAnimationEnded);
                            scrollCounter++;*/
            this.setSmoothScrollOffset(newPos);
            /*if (this._lastOffset === undefined) {
                this._lastOffset = 0;
                this._gumStartTime = Date.now();
            }
            if (Date.now() - this._gumStartTime < 350) {
                var neg = delta < 0 ? -1 : 1;
                if (Math.abs(delta) > 200)
                    delta = neg * 200;
                this._lastOffset = this._lastOffset + (delta / Math.max(1, ((Date.now() - this._gumStartTime) / 20)));
                if (Math.abs(this._lastOffset) > 300 * 8)
                    this._lastOffset = neg * 300 * 8;
                this._setGum(false, scroll - this._lastOffset);
                if (this._gumTimer) {
                    this.smoothScrollTime = this.smoothScrollTimeLimit;
                }
            }*/
        }
        this.afterUserInteraction();
    }
    mousedownHandler() {
        this.redrawFocusedItem(false);
    }
    cancelDrop() {
        this.updateDropEffect(undefined);
        if (this.autoScrollInt) {
            clearInterval(this.autoScrollInt);
            this.autoScrollInt = undefined;
        }
    }
    doAutoScrollStep() {
        if (this.disabled)
            return;
        this.setScrollOffset(this.getScrollOffset() + this.autoScrollStep);
        let srcitem = this.lastMouseDragEvent.dataTransfer.getUserData('itemindex');
        let item = this.getDropIndex(this.lastMouseDragEvent);
        if (dnd.isSameControl(this.lastMouseDragEvent) && (item == srcitem || item == srcitem + 1))
            this.updateDropEffect(undefined);
        else
            this.updateDropEffect(item);
    }
    createDiv() {
        let _this = this;
        let div;
        if (this.itemCloningAllowed && this.divs[0]) {
            div = this.divs[0].cloneNode(true);
            // have to remove possible hovered flag, it is not re-set during data binding
            div.removeAttribute('data-hover');
            div.cloned = true;
            if (!this.divs[0].isVis) {
                div.style.display = '';
                div.isVis = true;
            }
        }
        else {
            div = document.createElement('div');
            div.className = 'lvItem';
            if (this.isGrid)
                div.classList.add('griditem');
            else
                div.classList.add('rowitem');
            div.style.position = 'absolute';
            div.setAttribute('role', 'row'); // Screen reader support
        }
        div.parentListView = this;
        app.listen(div, 'touchstart', function (e) {
            if (e.touches.length == 1) {
                div._touchPos = e.touches[0];
            }
        }, window.addPassiveOption(false));
        app.listen(div, 'touchend', function (e) {
            if (e.changedTouches.length == 1 && div._touchPos) {
                let touch = e.changedTouches[0];
                if (Math.abs(div._touchPos.clientX - touch.clientX) < 5 && Math.abs(div._touchPos.clientY - touch.clientY) < 5) {
                    if (_this.longTouch(e)) {
                        _this.handleItemLongTouch(this, e);
                    }
                }
            }
        }.bind(div), window.addPassiveOption(false));
        if (this.dndEventsRegistered)
            this.makeDraggable(div);
        this.addItemToCanvas(div);
        this.setUpDiv(div);
        precompileBinding(div, this);
        // set initial state of inner divs
        this.resizeDiv(div, this.oldWidth, this.oldHeight);
        if (this.disabled) {
            // set initial disabled state, do this only when (disabled = true) otherwise disabledCounter would get incorrect value
            div.setAttribute('data-disabled', 1);
            this.setChildsDisabled(div, true, true);
        }
        return div;
    }
    createGroupDiv() {
        let div = document.createElement('div');
        div.className = 'groupHeader';
        div.parentListView = this;
        div.style.position = 'absolute';
        this.setUpGroupHeader(div);
        this.addItemToCanvas(div);
        return div;
    }
    createGroupSepDiv() {
        let div = document.createElement('div');
        div.className = 'groupSepHeader';
        div.parentListView = this;
        div.style.position = 'absolute';
        this.setUpGroupSep(div);
        this.addItemToCanvas(div);
        return div;
    }
    deleteDiv(itemIndex) {
        if (itemIndex >= this.firstCachedItem && itemIndex < this.firstCachedItem + this.divs.length) { // this item in in cache
            let offset = itemIndex - this.firstCachedItem;
            let div = this.divs[offset];
            this.divs.splice(offset, 1); // remove from cache
            this.cancelItemLoadingPromise(div);
            this.cleanUpDiv(div);
            return div;
        }
        else
            return null; // no change
    }
    /**
    Returns the div at the corresponding item index, or null if no div contains the item.

    @method getDiv
    @param integer Index of list
    @return HTMLElement|null Div at the corresponding item index if it exists.
    */
    getDiv(itemIndex) {
        if (itemIndex >= this.firstCachedItem && itemIndex < this.firstCachedItem + this.divs.length) { // this item in in cache
            return this.divs[itemIndex - this.firstCachedItem];
        }
        else
            return null;
    }
    // returns either a new div or a div found in the cache
    getDivFromCache(firstitem, itemindex) {
        let offset = itemindex - this.firstCachedItem;
        if (offset < 0) { // Cache has to be shifted
            let newFirstItem = itemindex;
            let newoffset = this.firstCachedItem - newFirstItem;
            if (newoffset < this.maxCachedDivs) { // It makes sense to move some divs (otherwise it doesn't, the indexes are far off).
                let saveItems = Math.min(this.divs.length - newoffset, this.divs.length);
                let moveItems = this.divs.length - saveItems;
                this.divs = this.divs.slice(-moveItems)
                    .concat(new Array(Math.max(0, newoffset - moveItems)), this.divs.slice(0, saveItems));
            }
            this.firstCachedItem = newFirstItem;
            offset = itemindex - this.firstCachedItem;
        }
        else if (offset < this.divs.length) { // The div is within our cache
            // No need to do anything
        }
        else { // The div has to be added
            if (offset >= this.maxCachedDivs) { // Cache has to be shifted
                let newFirstItem = Math.min(Math.max(itemindex - Math.round(this.maxCachedDivs / 2), 0), firstitem);
                let newoffset = newFirstItem - this.firstCachedItem;
                if (newoffset < this.divs.length) {
                    this.divs = this.divs.slice(newoffset).concat(this.divs.slice(0, newoffset));
                }
                this.firstCachedItem = newFirstItem;
                offset = itemindex - this.firstCachedItem;
            }
        }
        if (offset >= this.divs.length)
            this.divs.length = offset + 1;
        let div = this.divs[offset];
        if (!div) {
            div = this.createDiv();
            this.divs[offset] = div;
        }
        return div;
    }
    beforeDraw() {
        if (this.isGrid)
            this._oldSize = this.viewport.getBoundingClientRect();
    }
    afterDraw() {
        if (this.isGrid) {
            this.requestTimeout(() => {
                let newSize = this.viewport.getBoundingClientRect();
                if ((this._oldSize.right - this._oldSize.left !== newSize.right - newSize.left) ||
                    (this._oldSize.bottom - this._oldSize.top !== newSize.bottom - newSize.top)) {
                    this.adjustSize(true);
                    this.invalidateAll();
                }
            }, 100, 'afterDrawCheck');
        }
    }
    hideAllDivs() {
        this.divs.forEach(function (div) {
            this.hideDiv(div);
        }.bind(this));
    }
    hideDiv(div) {
        if (div.isVis || div.isVis === undefined) {
            if (div.isMoving) {
                this.cancelTransition(div, 'data-moving');
                div.isMoving = false;
            }
            div.style.display = 'none'; // #17776 JL: Fixing extreme layout recalcs after loading large lvPopups
            div.isVis = false;
            if (this.suspendDiv(div))
                div.forceRebind = true;
        }
    }
    hideGroupCollapseMark(div) {
        if (div._collapseMark)
            div._collapseMark.style.top = setPix(-2 * (this.groupHeight || 60) - 60);
    }
    hideGroupDiv(div) {
        this.cancelItemLoadingPromise(div);
        div.style.top = setPix(-2 * (this.groupHeight || 60) - 60); // Move away to not be visible (but not too far, so that it moves in fast during animations)
        this.hideGroupCollapseMark(div);
        div.groupid = undefined; // #18981
    }
    hideGroupSepDiv(div) {
        div.style.top = setPix(-2 * (this.groupHeight || 60) - 60); // Move away to not be visible (but not too far, so that it moves in fast during animations)
    }
    setUpTransition(div, attribute, finishCallback) {
        let transitionFinished = function () {
            if (finishCallback)
                finishCallback();
            this.removeAttribute(attribute);
            app.unlisten(this, transitionEndEventName, transitionFinished);
            if (attribute == 'data-moving')
                this.isMoving = false;
        }.bind(div);
        if (!div.hasAttribute(attribute)) {
            app.listen(div, transitionEndEventName, transitionFinished);
            div.setAttribute(attribute, '1');
        }
    }
    cancelTransition(div, attribute) {
        div.removeAttribute(attribute);
        // eslint-disable-next-line no-self-assign
        div.style.top = div.style.top;
        // eslint-disable-next-line no-self-assign
        div.style.left = div.style.left;
    }
    setMinHeight(value) {
        this.container.style.minHeight = value;
        let valInt = parseInt(value);
        let valWithoutHeader = valInt - this.header.offsetHeight - getOuterHeight(this.body) - getOuterHeight(this.fill) - getOuterHeight(this.canvas);
        if (valWithoutHeader < 0)
            valWithoutHeader = 0;
        this.canvas.style.minHeight = valWithoutHeader + 'px';
        this.viewport.style.minHeight = valWithoutHeader.toString();
    }
    createPopupIndicator() {
        if (!this.popupIndicator) {
            let ind = document.createElement('div');
            ind.className = 'popupIndicator';
            ind.style.position = 'absolute';
            ind.style.pointerEvents = 'none';
            ind.style.zIndex = '10000';
            loadIconFast('popupIndicator', function (icon) {
                ind.appendChild(icon);
            });
            this.addItemToCanvas(ind);
            this.popupIndicator = ind;
        }
        return this.popupIndicator;
    }
    draw_groups(scrollTop) {
        let h = this.getVisibleRowsDim();
        let regroupRequired = false;
        let renderOffsetTop = 0;
        if (this.dynamicSize)
            renderOffsetTop = scrollTop;
        let igroup = 0;
        let group = this.getOffsetGroup(scrollTop);
        if (group) {
            let rgd = 0;
            if (!this.moveFirstGroupHeader)
                rgd = group.rowGroupDimension || 0;
            if (rgd < 0)
                rgd = 0;
            if (group) {
                let doneDivs = [];
                for (; group.offset < scrollTop + h; igroup++) {
                    if (fullLVDebug)
                        ODS('** LV.draw_groups: group.offset=' + group.offset + ', scrollTop: ' + scrollTop + ', h: ' + h + ', igroup = ' + igroup);
                    let nextGroup = this.getNextGroup(group);
                    if (!nextGroup || (nextGroup.offset == 0 && igroup > 0 /* #20274 */))
                        break;
                    let lastGroup = (group.id == nextGroup.id);
                    let offset = group.offset;
                    let groupStart = offset - scrollTop + renderOffsetTop;
                    if (this.groupHeaders) {
                        // Try to find an already rendered group header
                        let index = this.groupDivs.findIndex((e) => (e.groupid == group.id));
                        let div;
                        if (index >= 0)
                            div = this.groupDivs.splice(index, 1)[0];
                        else {
                            div = this.groupDivs.pop();
                            if (!div)
                                div = this.createGroupDiv();
                        }
                        doneDivs.push(div);
                        if (div.groupid !== group.id || div.forceInvalidate) {
                            // Render side group header
                            if (div.groupid !== group.id)
                                this.cancelItemLoadingPromise(div);
                            this.renderGroupHeader(div, group, (div.groupid !== group.id)); // force rebind only if group changed, to avoid flickering
                            div.groupid = group.id;
                        }
                        div.forceInvalidate = undefined;
                        this.hideGroupCollapseMark(div);
                        let oldGroupStart = groupStart;
                        if ((group.rowGroupDimension === undefined) || (group.colGroupDimension <= 0)) {
                            let gw = div.clientWidth;
                            let gh = div.clientHeight;
                            if (this.isHorizontal) {
                                group.rowGroupDimension = gw;
                                group.colGroupDimension = gh;
                            }
                            else {
                                group.rowGroupDimension = gh;
                                group.colGroupDimension = gw;
                            }
                            requestAnimationFrame(() => {
                                // This method must be called outside of read lock (otherwise it can cause deadlock when recompute groups is in progress)
                                if (this._dataSource)
                                    this._dataSource.setGroupDimension(group.groupid, group.rowGroupDimension, group.colGroupDimension);
                            });
                            if (this.colGroupDimension < group.colGroupDimension)
                                this.colGroupDimension = group.colGroupDimension;
                            if (this.groupHeight < gh) {
                                this.groupHeight = gh;
                                regroupRequired = true; // minimal group height was changed
                            }
                        }
                        if (this.moveFirstGroupHeader) {
                            if (offset < scrollTop) { // Try to show the group header on screen
                                div.setAttribute('data-partial', 1);
                                let groupEnd;
                                if (lastGroup)
                                    groupEnd = this.getViewportSize();
                                else
                                    groupEnd = nextGroup.offset - this.groupSpacing;
                                if (scrollTop + group.rowGroupDimension <= groupEnd)
                                    offset = scrollTop; // We can fit the group header fully
                                else
                                    offset = groupEnd - group.rowGroupDimension;
                                groupStart = offset + renderOffsetTop - scrollTop; // set new groupStart show group header
                            }
                            else
                                div.removeAttribute('data-partial');
                        }
                        // Move div to the correct position
                        if (this.isHorizontal) {
                            div.style.left = setPix(groupStart);
                            div.style.top = 0;
                        }
                        else {
                            div.style.top = setPix(groupStart);
                            div.style.left = 0;
                        }
                        if (this.renderGroupHeaderPartial) {
                            this.renderGroupHeaderPartial(div, group, groupStart - oldGroupStart);
                        }
                    }
                    // Render group separator
                    if (this.groupSeparators) {
                        let lDiv;
                        if (igroup < this.groupSepDivs.length)
                            lDiv = this.groupSepDivs[igroup];
                        else {
                            lDiv = this.createGroupSepDiv();
                            this.groupSepDivs.push(lDiv);
                        }
                        this.renderGroupSep(lDiv, group);
                        lDiv.style.top = setPix(groupStart - this.groupSepHeight);
                        lDiv.style.left = '0';
                        lDiv.style.height = this.groupSepHeight.toString();
                        lDiv.style.width = this.colDimension.toString();
                    }
                    if (lastGroup) {
                        igroup++;
                        break; // The last group
                    }
                    group = nextGroup;
                }
                this.groupDivs = doneDivs.concat(this.groupDivs);
            }
        }
        for (let i = igroup; i < this.groupDivs.length; i++) {
            this.hideGroupDiv(this.groupDivs[i]);
        }
        for (let i = igroup; i < this.groupSepDivs.length; i++) {
            this.hideGroupSepDiv(this.groupSepDivs[i]);
        }
        if (regroupRequired)
            this.groupsRecompute(false, true /* viewport size compute */, false);
    }
    draw_locked() {
        if (fullLVDebug)
            ODS('***LV draw_locked() for itemcount: ' + this.itemCount + ', ' + (this.visible ? 'visible' : 'hidden') + ', uniqueId = ' + this.uniqueID);
        let startDrawTm = Date.now();
        this.beforeDraw();
        if (this.recalcLayoutNeeded)
            this.recalcLayout();
        if (this._adjustSizeNeeded)
            this.adjustSize();
        if (this._restoreScrollPos) {
            this._restoreScrollPos = undefined;
            this.restoreRealScroll();
        }
        let _this = this;
        let visibleRect = this.getVisibleRect(); // has to be _after_ recalcLayout()
        visibleRect.width = this.canvasWidth; // this differs when scrollingParent is defined
        if (fullLVDebug)
            ODS('***LV draw_locked() rect: ' + visibleRect.top + ', height: ' + visibleRect.height + ', uniqueId = ' + this.uniqueID);
        if (this._predrawTimeout) {
            clearTimeout(this._predrawTimeout);
            this._predrawTimeout = null;
        }
        let animate = false;
        if (this.animateNextDraw) {
            animate = true;
            this.animateNextDraw = false;
        }
        if (!this.preDraw)
            this.renderState('itemsLoading');
        if (((this.itemHeight <= 0) || (this.itemHeightReset)) && !this.dynamicSize) { // JH: TODO: there's already adjustSize() above, should be united?
            let origscroll = 0;
            let size = this.getViewportSize();
            if (size > 0) {
                origscroll = this.getScrollOffset() / size;
                this.adjustSize(true);
                // Scroll to the same position as previously (as much as possible)
                this.setScrollOffset(origscroll * this.getViewportSize());
            }
        }
        let h, w;
        if (this.isHorizontal) {
            h = visibleRect.width;
            w = visibleRect.height;
        }
        else {
            h = visibleRect.height;
            w = visibleRect.width;
        }
        if (this.forceCanvasHeight >= 0)
            h = this.forceCanvasHeight;
        //let rowSpacing = this.itemRowSpacing;
        let scrollTop = Math.round(visibleRect.top);
        let scrollTopOrig = scrollTop;
        if (this.preDraw)
            scrollTop = Math.max(0, scrollTop - (1 + this.preDrawnScreens) * h);
        let renderOffsetTop = 0;
        if (this.dynamicSize)
            renderOffsetTop = scrollTopOrig;
        //let oldFirstVisible = this.firstVisibleItem;
        //let oldLastVisible = this.lastVisibleItem;
        // Get the first visible item
        let firstitem = this.getItemForCanvas(scrollTop, this.colGroupDimension) || 0;
        let offset_row;
        if (this.dynamicSize) {
            offset_row = Math.max(Math.min(-this._parentOffsetHeight, -this.itemHeight - ((this.popupDiv && this.isPopupShown()) ? this.getPopupHeight(this.popupDiv) : 0)), this.getItemTopOffset(firstitem) - scrollTopOrig); // need to start before zero enough, otherwise it does not compute correctly. #17213
        }
        else {
            offset_row = this.getItemTopOffset(firstitem) - scrollTopOrig;
        }
        let group = this.getItemGroup(firstitem);
        if (!this.preDraw || this.forceRebindAll) {
            if (this.forceRebindAll) { // rebind all groups when forceRebindAll is true
                this.groupDivs.forEach(function (div) {
                    div.groupid = null;
                    this.hideGroupCollapseMark(div);
                }.bind(this));
            }
            this.draw_groups(scrollTop);
        }
        let offset_col = this.colGroupDimension;
        if (this.forceRebindAll) {
            this.forceRebindAll = false;
            this.forceRebindSelection = false;
            this.divs.forEach(function (div) {
                div.forceRebind = true;
            });
        }
        else {
            if (this.forceRebindSelection) {
                this.forceRebindSelection = false;
                this.divs.forEach(function (div) {
                    div.rebindSelection = true;
                });
            }
        }
        this.firstVisibleItem = firstitem;
        /*
        if (this.showCaptionOnScroll && !this.preDraw) {
            if (!this.scrollingCaption) {
                var div = document.createElement('div');
                div.parentListView = this;
                div.style.position = 'absolute';
                div.style.zIndex = '99999';
                div.style.color = 'white';
                div.style.textAlign = 'center';
                div.style.width = '100%';
                //div.style.top='50%';

                div.style.maxHeight = '100%';
                div.style.maxWidth = '100%';
                div.style.top = '0px';
                div.style.bottom = '0px';
                div.style.left = '0px';
                div.style.right = '0px';
                div.style.margin = 'auto';

                //		        this.addItemToCanvas(div);
                this.container.appendChild(div);
                this.scrollingCaption = div;
            }
            //			if (!WINDOWS_METRO || !this.isHorizontal)
            //				this.scrollingCaption.style.top = setPix( renderOffsetTop + Math.floor(size.h*0.3));
            //			else
            //				this.scrollingCaption.style.top = setPix( Math.floor(size.h*0.3));
            this.scrollingCaption.style.fontSize = setPix(Math.floor(size.h / 3));
            this.scrollingCaption.style.height = setPix(Math.floor(size.h / 3));
            //			this.scrollingCaption.style.marginTop = setPix( -Math.floor(size.h * 0.2));
            this.scrollingCaption.innerHTML = firstitem;
        }
        */
        let drawHeight = (this.preDraw ? (2 + this.preDrawnScreens) * h : h);
        // Handle skipping of regions
        let skipAfterIndex;
        let skip;
        let nextSkipIndex = 0;
        let prepareNextSkip = function () {
            if (skip && skip.div) {
                let oldVis = skip.div.style.visibility;
                skip.div.style.visibility = (skip.visible ? '' : 'hidden');
                if (skip.visible && (oldVis !== skip.div.style.visibility) && _this.popupDiv && (_this.popupDiv.parentElement === skip.div)) {
                    _this.requestFrame(function () {
                        if (_this.popupDiv) {
                            // re-render popup on visibility change, it is sometimes rendered incorrectly otherwise, e.g. when autoscrolled into view
                            // do not scroll into view, it would ruin scrolling #20758
                            _this.renderPopup(_this.popupDiv, undefined, false);
                        }
                    }.bind(_this), 'renderPopup');
                }
            }
            skip = _this.skips[nextSkipIndex++];
            if (skip) {
                skip.visible = false;
                skipAfterIndex = skip.afterIndex;
            }
            else
                skipAfterIndex = Number.MAX_SAFE_INTEGER;
        };
        do
            prepareNextSkip();
        while (skipAfterIndex < firstitem);
        let item;
        let addSkips = function () {
            let addrow = 0;
            while (item >= skipAfterIndex) {
                if (skip.div) {
                    let style = skip.div.style;
                    if (_this.isHorizontal) {
                        style.left = Math.round(renderOffsetTop + offset_row);
                        style.top = Math.round(offset_col);
                    }
                    else {
                        style.top = Math.round(renderOffsetTop + offset_row);
                        style.left = Math.round(offset_col);
                    }
                }
                skip.visible = true;
                addrow = Math.max(skip.reservePx, addrow);
                prepareNextSkip();
            }
            offset_row += addrow;
        };
        //ODS('--- ' + this.container.getAttribute('data-id') + ',  h=' + h + ', _parentOffsetHeight=' + this._parentOffsetHeight + ', _parentScrollTop=' + this._parentScrollTop + ', _containerOffsetTop=' + this._containerOffsetTop + ', _containerOffsetHeight=' + this._containerOffsetHeight + ', _headerOffsetHeight=' + this._headerOffsetHeight);
        if (fullLVDebug || (drawHeight - offset_row > 10000 /* something is bad */))
            ODS('***LV draw_locked() main loop: firstitem: ' + firstitem + ', offset_row: ' + offset_row + ', drawHeight: ' + drawHeight + ', itemCount: ' + this.itemCount + ', uniqueId = ' + this.uniqueID);
        // Main loop
        let itemsDrawn = 0;
        let itemsBound = 0;
        if (drawHeight >= 0) {
            for (item = firstitem; item < this.itemCount && offset_row < drawHeight; item++) {
                let div = this.getDivFromCache(firstitem, item);
                if (div.isVis === undefined) {
                    div.isVis = false;
                }
                if (!this.preDraw) {
                    let newLeft;
                    let newTop;
                    if (this.isHorizontal) {
                        newLeft = Math.round(renderOffsetTop + offset_row);
                        newTop = Math.round(offset_col);
                    }
                    else {
                        newTop = Math.round(renderOffsetTop + offset_row);
                        newLeft = Math.round(offset_col);
                    }
                    if (animate && (newTop != parseInt(div.style.top) || newLeft != parseInt(div.style.left))) {
                        // JH: The following doesn't properly animate, since transition start follows immediately and so the values aren't taken into account
                        /*				if (!div.isVis)
                                        {
                                            div.style.left = offset_col;
                                            if (offset_row < h/2)
                                                div.style.top = offset_row - this.itemHeight;
                                            else
                                                div.style.top = offset_row + this.itemHeight;
                                        }*/
                        if (div.isVis) {
                            this.setUpTransition(div, 'data-moving');
                            div.isMoving = true;
                        }
                    }
                    // Move div to the correct position
                    div.style.left = setPix(newLeft);
                    div.style.top = setPix(newTop);
                }
                if (this.isGrid)
                    div.style.width = setPix(this.itemBoxProperties.width);
                else {
                    let reqW = this.requiredWidth(w); // Set the width for the full length of the row (so that e.g. selection is properly drawn if horizontally scrolled).
                    if (!reqW)
                        reqW = w;
                    div.style.width = setPix(reqW - this.colGroupDimension - this.itemBoxProperties.paddingLeft - this.itemBoxProperties.paddingRight);
                }
                div.style.height = setPix(this.itemBoxProperties.height);
                if (!div.isVis) {
                    div.style.display = ''; // #17776 JL: Fixing extreme layout recalcs after loading large lvPopups
                    div.isVis = true;
                }
                if ((div.itemIndex !== item) || (div.forceRebind)) {
                    this.handleBinding_locked(div, item);
                    itemsDrawn++;
                    if (this.preDraw) {
                        this.hideDiv(div);
                    }
                    else
                        this.lastBindTimestamp = Date.now();
                }
                else {
                    if (this._dataSource && div.rebindSelection)
                        this.markSelected(div, this._dataSource.isSelected(item));
                }
                itemsBound++;
                if (this.isGrouped && this._collapseSupport) {
                    // compute next index when group is collapsed
                    let newItemIdx = item + 1;
                    if (group) {
                        if (group.collapsed && (group.visibleTracks !== group.itemCount)) {
                            if ((group.index + group.visibleTracks) - 1 < item + 1)
                                newItemIdx = group.index + group.itemCount;
                        }
                    }
                    else {
                        newItemIdx = Math.min(this.itemCount, this.getNextItemIndex(item));
                    }
                    if (newItemIdx !== item + 1) {
                        // hide divs between old and new index
                        for (let k = item + 1; k < newItemIdx; k++) {
                            let _div = this.getDiv(k);
                            if (_div)
                                this.hideDiv(_div);
                        }
                        item = newItemIdx - 1;
                    }
                }
                // Calculations for the new column/row
                let newGroup = (this.isGrouped && group && (item + 1 >= group.index + group.visibleTracks));
                offset_col += this.colDimension + this.itemHorzSpacing + this.itemRedistSpacing;
                if (offset_col + this.colDimension > w || !this.isGrid || newGroup) { // A new row of items
                    offset_col = this.colGroupDimension;
                    offset_row += this.rowDimension + this.itemRowSpacing;
                    if (this._collapseSupport && newGroup && !this.isGrid && group && group.collapsable) {
                        // show 'expand' text and mark
                        let divM = this.getGroupCollapseMark(group);
                        if (divM) {
                            if (!divM.isVis) {
                                divM.style.display = ''; // #17776 JL: Fixing extreme layout recalcs after loading large lvPopups
                                divM.isVis = true;
                            }
                            divM.style.left = setPix(offset_col);
                            divM.style.top = setPix(offset_row + renderOffsetTop);
                            this.renderCollapseMark(divM, group);
                        }
                    }
                    // Handle skipping of regions
                    addSkips();
                    if (newGroup) {
                        offset_row += Math.max(0, group.rowGroupDimension - this.calcPixsPerItems(group.visibleTracks)); // when items size is less than group size
                        group = this.getItemGroup(item + 1);
                        offset_row += this.groupSpacing - this.itemRowSpacing + this.groupSepHeight;
                    }
                }
            }
        }
        // Add skips that should be below all items
        offset_col = this.colGroupDimension;
        offset_row += this.rowDimension + this.itemRowSpacing;
        addSkips();
        while (skip)
            prepareNextSkip(); // Make sure all the remaining skips are processed (hidden)
        if (!this.preDraw)
            this.lastVisibleItem = item - 1;
        if (!this.preDraw) { // JH: We keep items visible in Win Metro, since IE needs to (slowly) re-render items with moved offset. So we rather keep them where they are.
            for (let idiv = 0; idiv < this.divs.length; idiv++) { // Hide all cached divs that aren't visible
                let divindex = idiv + this.firstCachedItem;
                if (divindex < this.firstVisibleItem || divindex > this.lastVisibleItem) {
                    let div = this.divs[idiv];
                    if (div)
                        this.hideDiv(div);
                }
            }
        }
        if (!this.preDraw && this.preDrawAmount > 0 && !this._disablePredraw && !this._predrawTimeout) {
            this.preDrawnScreens = 0;
            //this.lastBindTimestamp = Date.now();
            let _this = this;
            this._predrawTimeout = _this.requestTimeout(function () {
                _this.requestFrame(function () {
                    _this.preDrawScreen();
                }, 'preDrawScreen');
            }, this.delayBeforePredraw);
        }
        // Handle popup indicator drawing
        let popup = this.getSkip('popup');
        if (popup) {
            // Pop-up indicator
            let divP = this.getDiv(popup.afterIndex);
            if (divP && popup.rendered) {
                this.createPopupIndicator();
                let popstyle = this.popupIndicator.style;
                popstyle.visibility = '';
                popstyle.left = divP.style.left;
                popstyle.top = divP.style.top;
                popstyle.height = this.itemHeight;
                popstyle.width = this.itemWidth;
            }
            else
                popup = undefined;
        }
        if (!popup && this.popupIndicator)
            this.popupIndicator.style.visibility = 'hidden';
        if (!this.preDraw)
            this.renderState('itemsLoaded');
        if (fullLVDebug)
            ODS('***LV draw_locked() finished');
        this.afterDraw();
        let took = Date.now() - startDrawTm;
        if (fullLVDebug || (took > 200)) {
            let details = took + ' ms, items bound: ' + itemsBound + ' ms, items drawn: ' + itemsDrawn + ', drawHeight: ' + drawHeight + ', items count: ' + this.itemCount + ', control: ' + this.container.getAttribute('data-id') + ', ' + this.uniqueID;
            ODS('***LV draw_locked() took: ' + details);
            if (took > 5000)
                assert('Drawing of LV took ' + details);
        }
    }
    drawnow() {
        if (this._isDrawing) { // #19350
            if (fullLVDebug)
                ODS('LV: Skipping drawnow because we are inside a synchronous drawnow call already');
            return;
        }
        if (!this.visible)
            return; // don't draw invisible controls
        if (fullLVDebug)
            ODS('***LV drawnow');
        if (this.isGroupedView && (this.dataSource && this.dataSource.count && (!this.dataSource.getGroupsCount() || !this.isGrouped))) {
            if (this.dataSource.getGroupsCount() && !this.isGrouped && !this._recomputePromise)
                this.groupsRecompute(false, false, false);
            if (fullLVDebug)
                ODS('***LV groups are still calculating, defer drawing.. getGroupsCount: ' + this.dataSource.getGroupsCount() + ', this.isGrouped: ' + this.isGrouped); // issue #19571 - item 1)
            if (this._adjustSizeNeeded)
                this.adjustSize();
            this.deferredDraw();
            return;
        }
        this._isDrawing = true; // To prevent recursive drawnow calls
        if (this.scrollUpdateNeeded) {
            this.canvasScrollLeft = this.canvas.scrollLeft;
            this.canvasScrollTop = this.canvas.scrollTop;
            if (this._notifiedScrollTop != this.canvasScrollTop) {
                this.invalidateScrollPos = true;
                this._notifiedScrollTop = this.canvasScrollTop;
            }
            this.headerItems.scrollLeft = this.canvasScrollLeft;
            if (!this.isHorizontal) {
                if (this.viewport.scrollLeft !== this.canvasScrollLeft) {
                    this.viewport.scrollLeft = this.canvasScrollLeft;
                    this.invalidateNeeded = true; // horizontal scrolling in gridview -> udpate values
                }
            }
        }
        if (this.invalidateNeeded) {
            this.invalidateNeeded = false;
            if (this._dataSource)
                this.setItemCount(this._dataSource.count);
            else
                this.setItemCount(0);
            this.divs.forEach(function (div) {
                div.itemIndex = undefined;
                div.forceRebind = true;
            });
            this.groupDivs.forEach(function (div) {
                div.forceInvalidate = true;
            });
            if (this._requestScrollPosition) {
                this._itemToShow = undefined; // LS: to supress scheduled scrolling in _setItemFullyVisible()                    
                this.setScrollOffset(this._requestScrollPosition);
                this._requestScrollPosition = undefined;
            }
            if (this._requestFocusIndex !== undefined) {
                if (this._dataSource && (this._dataSource.itemsSelected > 1)) { // we have already something selected, set only focused index, to avoid clearing selection
                    if (this._requestFocusIndex !== this.focusedIndex) {
                        this.focusedIndex = this._requestFocusIndex;
                    }
                }
                else {
                    if (this._requestFocusIndex !== this.focusedIndex) {
                        let reqFoc = this._requestFocusIndex;
                        this._requestFocusIndex = undefined;
                        this.setFocusedAndSelectedIndex(reqFoc).then(() => {
                            this._requestFocusIndex = reqFoc;
                            this.invalidateAll();
                        });
                        this._isDrawing = false;
                        return;
                    }
                    else {
                        this.raiseItemSelectChange(this._requestFocusIndex); // to be sure, this event was sent after restoring focus
                    }
                }
                this._requestFocusIndex = undefined;
                if (this.smoothScroll) { // Temporarily disable smoothscroll. Should be done in a cleaner fashion?
                    this.smoothScroll = false;
                    this.smoothScrollOrigin = undefined; // needed, it could lead to deadlock 
                    this.requestTimeout(() => {
                        this.smoothScroll = true;
                    }, 100, 'smoothscrolldisable');
                }
                if (this._requestPopup) {
                    this._requestPopup = undefined;
                    this.showPopup(this.focusedIndex);
                }
            }
        }
        this._setItemFullyVisible(); // In case there's a need to scroll to an item
        let wasSmoothScrollInUse = (typeof this.smoothScrollOrigin != 'undefined');
        enterLayoutLock(this.container); // We need to prevent layout changes notifications during draw operations of the inner part of the listview (TODO: avoid the event _after_ this call??)
        if (this._dataSource) {
            this._dataSource.locked(() => {
                if (this.visible)
                    this.setItemCount(this._dataSource.count); // Make sure we draw the corrent # of items                
                this.draw_locked();
            });
        }
        else
            this.draw_locked();
        leaveLayoutLock(this.container); // Try ... finally was intentionally left out here, since it currently isn't optimized by Chromium
        if (!this.preDraw)
            this.lastRefresh = Date.now();
        if (wasSmoothScrollInUse || this.scrollUpdateNeeded) {
            this.raiseEvent('scroll', {}, true, true); // Notify that our interior was scrolled and content is now rendered according to the scroll value.
            this.updateHover();
            if (wasSmoothScrollInUse && !this.dynamicSize)
                this.draw(); // Schedule a new draw in order to smoothly animate scroll
        }
        this.scrollUpdateNeeded = false;
        this._isDrawing = false;
        _applyLayoutQueryCallbacks(); // #18600
        _applyStylingCallbacks();
        if ((this._scrollToItemIdx !== undefined) && (this._scrollToItemIdx >= 0)) {
            let idx = this._scrollToItemIdx;
            this.requestFrame(() => {
                this.setItemFullyVisibleCentered(idx);
            });
            this._scrollToItemIdx = -1;
        }
    }
    deferredDraw() {
        if (fullLVDebug)
            ODS('***LV deferredDraw, invalidateNeeded: ' + this.invalidateNeeded + ', callstack: ' + app.utils.logStackTrace());
        if (window.hasBeenShown) {
            this.requestFrame(() => {
                this.drawnow();
                this.drawQueued = false;
            }, 'deferredDraw');
            this.drawQueued = true;
        }
        else {
            // If the window is in the process of loading
            this.requestTimeout(() => {
                this.drawnow();
                this.drawQueued = false;
            }, 1000, 'deferredDraw');
            this.drawQueued = true;
        }
    }
    draw() {
        if (this.smoothScroll) {
            this.deferredDraw();
        }
        else {
            this.drawnow();
        }
    }
    preDrawScreen() {
        this._predrawTimeout = undefined;
        if (this._cleanUpCalled)
            return;
        if (this.preDrawnScreens >= this.preDrawAmount || this.drawQueued)
            return;
        let diff = Date.now() - this.lastBindTimestamp;
        if (diff >= this.delayBeforePredraw) {
            this.preDraw = true;
            this.draw();
            this.preDraw = false;
            this.preDrawnScreens++;
        }
        let _this = this;
        this._predrawTimeout = _this.requestTimeout(function () {
            _this.requestFrame(function () {
                _this.preDrawScreen();
            }, 'preDrawScreen');
        }, 30); // Just a short delay in order to give other JS methods a chance to run (e.g. another draw during scrolling).
    }
    getNextItemIndex(item) {
        return ++item;
    }
    getGroupCollapseMark(group) {
        let createCollapseMarkDiv = () => {
            let div = document.createElement('div');
            div.parentListView = this;
            div.classList.add('collapseRow');
            div.style.position = 'absolute';
            this.localListen(div, 'click', () => {
                if (div.group && this.dataSource && this.dataSource.setCollapsed) {
                    this.dataSource.setCollapsed(div.group.id, !div.group.collapsed);
                    //this.invalidateAll();
                    this.groupsRecompute(false, true, true);
                }
            });
            this.addItemToCanvas(div);
            return div;
        };
        // Try to find an already rendered group header
        let index = this.groupDivs.findIndex((e) => (e.groupid == group.id));
        let div;
        let mark;
        if (index >= 0)
            div = this.groupDivs[index];
        if (div) {
            div._collapseMark = div._collapseMark || createCollapseMarkDiv();
            mark = div._collapseMark;
            mark.group = group;
        }
        return mark;
    }
    renderCollapseMark(div, group) {
        if (group.collapsed) {
            div.innerText = _('Show all') + ' ' + group.itemCount + ' ' + _('track', 'tracks', group.itemCount);
        }
        else {
            div.innerText = _('Collapse');
        }
    }
    notifyControlFocus() {
        this.raiseEvent('focusedcontrol', {
            control: this
        }, false, true /* bubbles */);
        let ds = this.dataSource;
        if (ds && ds.count && isUsingKeyboard()) {
            if (this.focusedIndex < 0 /* #15638 */) {
                this.setFocusedAndSelectedIndex(0).then(() => {
                    this.setFocusedFullyVisible();
                });
            }
            else {
                if (isUsingKeyboard() && (this.focusedIndex >= 0) && this.focusedAlsoSelected)
                    this.setSelectedIndex(this.focusedIndex, true); // make sure, focused item is also selected, #17849 11)              
                this.setFocusedFullyVisible();
            }
        }
    }
    canDrawFocus() {
        return false;
    }
    raiseSelectionChanged() {
        this.raiseEvent('selectionChanged', {
            control: this,
            modeOn: this.selectionMode
        }, false, true /* bubbles */);
    }
    // focus LV without automatic scrolling within parent container
    setFocus() {
        this.container.focus({
            preventScroll: true
        });
    }
    fileTransferPrepare(element, e) {
        if (this.dataSource) {
            let item = this.dataSource.focusedItem;
            let track = null;
            if (item) {
                if (item.objectType === 'track') {
                    track = item;
                }
                else if (item.objectType === 'playlistentry') {
                    track = item.sd;
                }
                if (track) {
                    e.dataTransfer.setData('DownloadURL', this.dataSource.toSeparatedString(true, '*'));
                    e.dataTransfer.setUserData('_localDrop', '1'); // this indicates we're dragging single track inside MM (we need this indicator as dragging files from external app uses same DownloadURL and URL properties)
                }
            }
        }
    }
    _updateDisabledAttribute() {
        if (this.disabled)
            this.canvas.style.pointerEvents = 'none';
        else
            this.canvas.style.pointerEvents = 'all';
        this.canvas.style.overflow = this.noScroll ? 'hidden' : 'auto';
        super._updateDisabledAttribute();
        this.recalcLayoutNeeded = true;
        this._adjustSizeNeeded = true;
        this._restoreScrollPos = true;
        this.deferredDraw();
    }
    canDrop(e) {
        let sameListView = dnd.isSameControl(e); /* by default, allow D&D inside same listview */
        return this.dndEventsRegistered && sameListView;
    }
    dragOver(e) {
        if (e.shiftKey && !this.reorderOnly)
            dnd.setDropMode(e, 'copy');
        let totalPos = this.canvas.getBoundingClientRect();
        let offsetX = e.clientX - totalPos.left;
        let offsetY = e.clientY - totalPos.top;
        this.lastMouseDragEvent = e;
        let item = this.getDropIndex(e);
        if (dnd.headerMoving(e)) {
            if (item) // we cannot drop header to list
                e.dataTransfer.dropEffect = 'none';
            return;
        }
        // Show where the drop is going to happen
        let srcitem = e.dataTransfer.getUserData('itemindex');
        //ODS('DROP: '+dnd.isSameControl(e)+' '+item+"/"+srcitem);
        if (dnd.isSameControl(e) && (item == srcitem || item == srcitem + 1))
            this.updateDropEffect(undefined);
        else
            this.updateDropEffect(item);
        // Automatically scroll if close to borders
        let offsetRow;
        if (this.isHorizontal)
            offsetRow = offsetX;
        else
            offsetRow = offsetY;
        if (this.dynamicSize) {
            offsetRow -= this.getScrollOffset();
        }
        let perc = offsetRow / this.getVisibleRowsDimVirtual();
        let autoStartPerc = 0.20;
        if (perc < autoStartPerc || perc > (1 - autoStartPerc)) {
            if (perc < autoStartPerc)
                perc -= autoStartPerc;
            else
                perc -= (1 - autoStartPerc);
            let _this = this;
            this.autoScrollStep = perc * 500;
            if (!this.autoScrollInt)
                this.autoScrollInt = setInterval(function () {
                    _this.doAutoScrollStep();
                }, 50);
        }
        else {
            if (this.autoScrollInt) {
                clearInterval(this.autoScrollInt);
                this.autoScrollInt = undefined;
            }
        }
    }
    dragFinished(e) {
        this.cancelDrop();
        super.dragFinished(e);
    }
    dragLeave(e) {
        if (!isInElement(e.clientX, e.clientY, this.container)) {
            this.cancelDrop();
        }
    }
    getDropMode(e) {
        if (!dnd.isSameControl(e))
            return 'copy';
        return 'move';
    }
    getDropIndex(e) {
        let pos = 0;
        if (dnd.isDragEvent(e)) {
            let totalPos = this.canvas.getBoundingClientRect();
            let offsetX = e.clientX - totalPos.left;
            let offsetY = e.clientY - totalPos.top;
            pos = this.getItemFromRelativePosition(offsetX, offsetY);
            if (pos === undefined)
                pos = this.itemCount;
            else {
                if (offsetY + this.getSmoothScrollOffset() - this.getItemTopOffset(pos) > this.itemHeight / 2)
                    pos++; // Drop item _behind_ the currently hovered items, in case we are in the lower half of the item.
            }
        }
        else {
            pos = this.dataSource.focusedIndex;
            if (pos < 0)
                pos = 0;
        }
        // @ts-ignore
        if (this.isAllowedDropIndex && !this.isAllowedDropIndex(pos))
            return (this.dataSource.focusedIndex + 1) || 0; // #17294
        else
            return pos;
    }
    drop(e, isSameControl) {
        this.cancelDrop();
        let dropMode = dnd.getDropMode(e);
        if (dropMode == 'move') {
            this.dropToPosition(this.getDropIndex(e));
        }
    }
    setDragElementData(element, e) {
        super.setDragElementData(element, e);
        let selCount = 0;
        if (this.dataSource) {
            selCount = this.dataSource.itemsSelected;
            if (selCount > 1) {
                let cont = dnd.getCustomDragElement(element, selCount);
                e.dataTransfer.setDragImage(cont, e.offsetX, e.offsetY);
            }
        }
        e.dataTransfer.setUserData('datarow', 'datarow');
        e.dataTransfer.setUserData('itemindex', element.itemIndex);
        let dataType = this.getDragDataType();
        if (!dataType && this.dataSource && (element.itemIndex < this.dataSource.count)) {
            this.dataSource.locked(function () {
                this._fastObject = this.dataSource.getFastObject(element.itemIndex, this._fastObject);
                if (this._fastObject.dataSource) {
                    e.dataTransfer.setUserData(DRAG_DATATYPE, this._fastObject.dataSource.objectType);
                }
                else {
                    if (this._fastObject.objectType) {
                        e.dataTransfer.setUserData(DRAG_DATATYPE, this._fastObject.objectType);
                    }
                }
            }.bind(this));
        }
        else {
            e.dataTransfer.setUserData(DRAG_DATATYPE, dataType);
        }
        element.parentListView.setSelectedIndex(element.itemIndex, selCount > 1); // Make sure that the dragged item is also selected
    }
    getDraggedObject(e) {
        let ret = null;
        if (this.dataSource) {
            this.dataSource.locked(function () {
                ret = this.dataSource.getSelectedList();
            }.bind(this));
        }
        return ret;
    }
    resizeDiv(div, w, h) {
        if (div.lastTestedWidth === w)
            return;
        div.lastTestedWidth = w;
        if (this.itemSizes) {
            for (let i = 0; i < this.itemSizes.length; i++) {
                let obj = this.itemSizes[i];
                if ((!obj.fromWidth || (obj.fromWidth <= w)) && (!obj.toWidth || (obj.toWidth > w))) {
                    if (obj.height !== undefined)
                        div.style.height = obj.height + 'px';
                    if (obj.className) {
                        div.classList.toggle(obj.className, true);
                    }
                    this.itemHeightReset = true; // cause reset sizes                
                }
                else {
                    if (obj.className)
                        div.classList.toggle(obj.className, false);
                }
            }
        }
        if (!div.sizeDependentElements)
            return;
        forEach(div.sizeDependentElements, function (el) {
            if (el.limits.fromWidth || el.limits.toWidth) {
                if ((w >= el.limits.fromWidth) && (!el.limits.toWidth || (w < el.limits.toWidth))) {
                    if (!el.hiddenByShowif && !isVisible(el, false)) {
                        setVisibility(el, true, {
                            layoutchange: false
                        });
                        div.forceRebind = true;
                    }
                    el.hiddenBySize = false;
                }
                else {
                    setVisibility(el, false, {
                        layoutchange: false
                    });
                    el.hiddenBySize = true;
                }
            }
            if (el.condWidths) {
                let notSet = true;
                for (let i = 0; i < el.condWidths.length; i++) {
                    let obj = el.condWidths[i];
                    if ((!obj.fromWidth || (obj.fromWidth <= w)) && (!obj.toWidth || (obj.toWidth > w))) {
                        if (obj.width !== undefined) {
                            el.style.width = obj.width;
                            notSet = false;
                        }
                        if (obj.className) {
                            el.classList.toggle(obj.className, true);
                        }
                        break;
                    }
                    else {
                        if (obj.className) {
                            el.classList.toggle(obj.className, false);
                        }
                    }
                }
                if (notSet)
                    el.style.width = ''; // no given fixed width found, set default
            }
        }.bind(this));
    }
    resizeDivs(w, h) {
        if (!this.divs)
            return;
        this.divs.forEach((div) => {
            if (div)
                this.resizeDiv(div, w, h);
        });
    }
    /**
    Returns the top scrolled item information/offset, so that it can be restored in case LV formatting/size is changed (and thus scroll offset of the canvas wouldn't match).

    @method getRealScrollOffset
    @return Object Information about the scrolled position
    */
    getRealScrollOffset() {
        let topItem = this.getItemFromRelativePosition(0, 0, true /*approximate*/);
        let origScroll;
        if (topItem >= 0)
            origScroll = this.getItemTopOffset(topItem) - this.getScrollOffset();
        else
            origScroll = this.getScrollOffset();
        return {
            topItem: topItem,
            origScroll: origScroll
        };
    }
    /**
    Restores the top scrolled item according to the saved position.

    @method setRealScrollOffset
    @param Object Previously saved scroll position (by getRealScrollOffset method)
    */
    setRealScrollOffset(position) {
        let totOffset = this.getItemTopOffset(position.topItem) - position.origScroll;
        this.setScrollOffset(totOffset);
    }
    saveRealScroll() {
        if (this.invalidateScrollPos || !this.savedScrollOffset) {
            this.invalidateScrollPos = false;
            this.savedScrollOffset = this.getRealScrollOffset();
        }
        return this.savedScrollOffset;
    }
    restoreRealScroll(sc) {
        sc = sc || this.savedScrollOffset;
        if (sc && sc.topItem /* it's not empty */) {
            this.setRealScrollOffset(sc);
            this.invalidateScrollPos = false; // This might have changed scroll offset, but not intentionally, so ignore.
            this._notifiedScrollTop = this.canvas.scrollTop;
        }
    }
    recalcLayout(redraw) {
        if (window.hasBeenShown) {
            queryLayoutAfterFrame(() => {
                if (!this._cleanUpCalled)
                    this._recalcLayout(redraw);
            });
        }
        else {
            // If the window is in the process of loading
            this.requestTimeout(() => {
                this._recalcLayout(redraw);
            }, 1000, '_recalcLayout');
        }
    }
    _recalcLayout(redraw) {
        let isVis = this.visible;
        if (fullLVDebug)
            ODS('**** recalcLayout started, item count: ' + this.itemCount + ', ' + (isVis ? 'visible' : 'hidden') + ', uniqueId = ' + this.uniqueID);
        if (isVis) {
            if (this.recalcLayoutNeeded)
                this.oldVisible = false; // To force recalc below
            this.recalcLayoutNeeded = false;
        }
        else {
            this.recalcLayoutNeeded = true;
            return;
        }
        // Keep canvas position cached, so that e.g. mouse hover can be calculated faster    
        this._canvasStartRect = undefined;
        let newWidth = this.container.offsetWidth;
        let newHeight = this.container.offsetHeight;
        let widthChange = (newWidth != this.oldWidth);
        let heightChange = (newHeight != this.oldHeight);
        let anyChange = false;
        let newTop;
        let newLeft;
        if (this.dynamicSize) {
            this.updateParentScrollTop();
            newTop = findScreenPos(this.container).top;
            if (this.scrollingParent)
                newTop -= findScreenPos(this.scrollingParent).top - this.scrollingParent.scrollTop /* always use current scroll position (even in case smooth scroll is in progress) as we need to know exact offset for further header positioning */;
            newLeft = this.container.offsetLeft;
            let parent = this.scrollingParent;
            anyChange = (newLeft != this.oldLeft || newTop != this.oldTop ||
                (parent && this._parentOffsetHeight != parent.offsetHeight));
            if (fullLVDebug)
                ODS('   ** parent: ' + this._parentOffsetHeight + ' vs. ' + parent.offsetHeight + ', self: [' + this.oldLeft + ',' + this.oldTop + '],H:' + this.oldHeight + ' vs. [' + newLeft + ',' + newTop + '],H:' + newHeight);
        }
        let sizeChange = (widthChange || heightChange);
        if (fullLVDebug)
            ODS('**Recalc layout old: ' + this.oldWidth + '/' + this.oldHeight + ', new: ' + newWidth + '/' + newHeight + ', uniqueId: ' + this.uniqueID);
        if (sizeChange || anyChange || !this.oldVisible) {
            if (fullLVDebug)
                ODS('**** recalcLayout sizeChange: ' + sizeChange + ' , anyChange: ' + anyChange + ', oldVisible: ' + this.oldVisible + ', uniqueId: ' + this.uniqueID);
            this.getCanvasSizeAndPos(false /*not cached - to get the current values*/);
            if (!this.dynamicSize) {
                this.saveRealScroll();
            }
            let scrollChanged = this.oldTop !== newTop;
            this.oldWidth = newWidth;
            this.oldHeight = newHeight;
            this.oldLeft = newLeft;
            this.oldTop = newTop;
            this.oldVisible = isVis;
            if (this.dynamicSize && this.scrollingParent) {
                redraw = true;
                // Cache some layout values for faster drawing later
                let parent = this.scrollingParent;
                this._containerOffsetTop = newTop;
                this._containerOffsetHeight = this.container.offsetHeight;
                this._headerOffsetHeight = this.header.offsetHeight;
                this._parentOffsetHeight = parent.offsetHeight;
                deferredNotifyLayoutChangeDown(parent); // #19067
                if (fullLVDebug)
                    ODS('** recalcLayout: top: ' + this._containerOffsetTop + ' , height: ' + this._containerOffsetHeight + ', header.height: ' + this._headerOffsetHeight + ', parent.height: ' + this._parentOffsetHeight + ', uniqueId: ' + this.uniqueID);
            }
            if (sizeChange) {
                this.adjustSize(true);
                redraw = true;
            }
            if (!this.dynamicSize) {
                this.restoreRealScroll();
            }
            if (widthChange && this.popupSupport && this.popupDiv) {
                let popupParent = getParent(this.popupDiv);
                popupParent.style.width = (this.getVisibleColsDim() - this.colGroupDimension) + 'px';
                this.requestFrame(() => {
                    if (this.popupDiv)
                        this.renderPopup(this.popupDiv); // re-render popup on width change. Used in next frame, so size is properly adjusted before it is rendered
                }, 'renderPopup');
            }
            if (this.dynamicSize && this.scrollingParent && scrollChanged) {
                this.parentScrollFrame(); // update header position when something's changed
            }
            else if (redraw)
                this.deferredDraw();
        }
    }
    handle_layoutchange(e) {
        this.recalcLayout(true);
    }
    handleCanvasScroll(e) {
        if (this.disabled)
            return;
        // handle scrolling even for dynamicSize, it could be horizontal scrolling in grid
        this.scrollUpdateNeeded = true;
        this.deferredDraw();
    }
    /**
    Should clean up all the control stuff, i.e. mainly unlisten events.

    @method cleanUp
    */
    cleanUp() {
        this._openingPopupTimer = -1;
        app.unlisten(this.header); // unregisters all on this.header    
        app.unlisten(this.viewport); // unregisters all on this.viewport
        if (this._settingDSPromise)
            cancelPromise(this._settingDSPromise);
        // Clean up all items/divs and group headers    
        this.clearDivs();
        // Clean all pop-ups
        // eslint-disable-next-line no-cond-assign
        for (let popup; popup = this.popupCache.pop();)
            removeElement(popup.div);
        if (this.unlisteners) {
            forEach(this.unlisteners, function (unlistenFunc) {
                unlistenFunc();
            });
            this.unlisteners = undefined;
        }
        app.unlisten(this.canvas);
        if (this._dataSource)
            this.dataSource = null; // remove datasource with events, last, so previous unlisten functions can access datasource        
        super.cleanUp();
    }
    updateDropEffect(itemIndex) {
        let dropAfter = -1;
        let dropBefore = -1;
        if (itemIndex >= 0) {
            if (itemIndex > 0)
                dropAfter = itemIndex - 1;
            if (itemIndex < this.itemCount)
                dropBefore = itemIndex;
        }
        else {
            dropBefore = itemIndex;
        }
        let divBefore;
        if (dropBefore >= 0)
            divBefore = this.getDiv(dropBefore);
        let divAfter;
        if (dropAfter >= 0)
            divAfter = this.getDiv(dropAfter);
        if (this.oldDropBefore) {
            if (this.oldDropBefore != divBefore) {
                this.setUpTransition(this.oldDropBefore, 'data-dropeffect');
                this.oldDropBefore.removeAttribute('data-dropbefore');
                this.oldDropBefore = null;
            }
        }
        if (this.oldDropAfter) {
            if (this.oldDropAfter != divAfter) {
                this.setUpTransition(this.oldDropAfter, 'data-dropeffect');
                this.oldDropAfter.removeAttribute('data-dropafter');
                this.oldDropAfter = undefined;
            }
        }
        if (this.dragging) {
            if (divAfter && this.oldDropAfter != divAfter) {
                divAfter.setAttribute('data-dropeffect', 1);
                divAfter.setAttribute('data-dropafter', 1);
                this.oldDropAfter = divAfter;
            }
            if (divBefore && this.oldDropBefore != divBefore) {
                divBefore.setAttribute('data-dropeffect', 1);
                divBefore.setAttribute('data-dropbefore', 1);
                this.oldDropBefore = divBefore;
            }
        }
    }
    adjustScroll(value) {
        if (typeof this.smoothScrollOrigin != 'undefined') {
            this.smoothScrollAdjust += value;
        }
        else {
            this.setScrollOffset(this.getScrollOffset() + value);
        }
    }
    getScrollOffset() {
        if (this.dynamicSize && this.scrollingParent) {
            return this._parentScrollTop - this._containerOffsetTop;
        }
        else {
            if (this.scrollUpdateNeeded) {
                this.canvasScrollLeft = this.canvas.scrollLeft;
                this.canvasScrollTop = this.canvas.scrollTop;
            }
            if (this.isHorizontal)
                return this.canvasScrollLeft;
            else {
                return this.canvasScrollTop;
            }
        }
    }
    getSmoothScrollOffset() {
        let scrollTop = this.getScrollOffset();
        if (this.dynamicSize) {
            return scrollTop;
        }
        else {
            if (typeof this.smoothScrollOrigin != 'undefined') {
                scrollTop = this.smoothScrollTarget;
                let newTime = window.performance.now();
                let adjust = this.smoothScrollAdjust;
                this.smoothScrollAdjust = 0;
                let res;
                if (newTime - this.smoothScrollTime >= this.smoothScrollTimeLimit) {
                    this.smoothScrollOrigin = undefined;
                    res = scrollTop + adjust;
                    this.setScrollOffset(res); // To update the scrollbar position in case we scrolled beyond original height of the viewport
                }
                else {
                    this.smoothScrollOrigin += adjust;
                    this.smoothScrollTarget += adjust;
                    res = Math.max(0, this.smoothScrollOrigin + (this.smoothScrollTarget - this.smoothScrollOrigin) * Math.pow((newTime - this.smoothScrollTime) / this.smoothScrollTimeLimit, 0.6));
                }
                return res;
            }
            else
                return scrollTop;
        }
    }
    setSmoothScrollOffset(newValue, canScrollBeyond /*To allow scrolling lower than is the current viewport height*/) {
        if (this.dynamicSize && this.scrollingParent) {
            if (this.scrollingParent.controlClass && this.scrollingParent.controlClass.setSmoothScrollOffset)
                this.scrollingParent.controlClass.setSmoothScrollOffset(newValue + this.container.offsetTop, canScrollBeyond);
            else
                this.setScrollOffset(newValue, canScrollBeyond);
        }
        else {
            let origin = this.getSmoothScrollOffset();
            this.setScrollOffset(newValue, canScrollBeyond);
            if (this.smoothScroll) {
                this.smoothScrollTarget = (canScrollBeyond ? newValue : this.getScrollOffset());
                if (origin > 0)
                    this.smoothScrollOrigin = origin;
                else
                    this.smoothScrollOrigin = undefined; // #20844 -- assign 'undefined' otherwise it could loop endlessly in DrawNow (wasSmoothScrollInUse would be TRUE endlessly)
                this.smoothScrollTime = window.performance.now();
            }
        }
    }
    // scroll parent, so this LV is as visible as possible, possible leaving space for external heading
    scrollParentToBestView(headingHeight) {
        headingHeight = headingHeight || 0;
        let scTop = undefined;
        if (this._parentScrollTop > (this._containerOffsetTop - headingHeight)) {
            scTop = -headingHeight;
        }
        else if ((this._containerOffsetHeight + this._containerOffsetTop) > (this._parentScrollTop + this._parentOffsetHeight)) {
            scTop = Math.min(-headingHeight, this._containerOffsetHeight - this._parentOffsetHeight);
        }
        if (scTop !== undefined)
            this.setSmoothScrollOffset(scTop);
    }
    setScrollOffset(newValue, canScrollBeyond) {
        if (this.dynamicSize && this.scrollingParent) {
            if (this.scrollingParent.controlClass && this.scrollingParent.controlClass.setScrollOffset)
                this.scrollingParent.controlClass.setScrollOffset(newValue + this.container.offsetTop);
            else
                this.scrollingParent.scrollTop = newValue + this.container.offsetTop;
            this.parentScrollFrame();
        }
        else {
            this.smoothScrollOrigin = undefined;
            if (this.isHorizontal) {
                this.canvas.scrollLeft = newValue;
                this.canvasScrollLeft = (canScrollBeyond ? newValue : this.canvas.scrollLeft);
            }
            else {
                this.canvas.scrollTop = newValue;
                this.canvasScrollTop = (canScrollBeyond ? newValue : this.canvas.scrollTop);
            }
        }
    }
    resetScrollbars() {
        this.canvas.scrollLeft = 0;
        this.canvasScrollLeft = this.canvas.scrollLeft;
        this.canvas.scrollTop = 0;
        this.canvasScrollTop = this.canvas.scrollTop;
    }
    getVisibleRowsDimVirtual() {
        if (this.dynamicSize) {
            return this._parentOffsetHeight - this._headerOffsetHeight;
        }
        else {
            if (this.isHorizontal)
                return this.getVisibleRect().width;
            else
                return this.getVisibleRect().height;
        }
    }
    getVisibleRowsDim() {
        if (this.isHorizontal)
            return this.getVisibleRect().width;
        else
            return this.getVisibleRect().height;
    }
    getVisibleColsDim() {
        if (this.isHorizontal)
            return this.canvasHeight;
        else
            return this.canvasWidth;
    }
    getItemForCanvas(row, col) {
        if (this.isHorizontal)
            return this.getItemFromAbsolutePosition(row, col, true /*include approximate results*/);
        else
            return this.getItemFromAbsolutePosition(col, row, true);
    }
    getItemFromRelativePosition(x, y, approxResults) {
        if (!this.dynamicSize)
            if (this.isHorizontal)
                x += this.getSmoothScrollOffset();
            else
                y += this.getSmoothScrollOffset();
        return this.getItemFromAbsolutePosition(x, y, approxResults);
    }
    getItemFromAbsolutePosition(x, y, approxResults) {
        if (approxResults === undefined)
            approxResults = false;
        let row;
        let col;
        if (this.isHorizontal) {
            row = x;
            col = y;
        }
        else {
            row = y;
            col = x;
        }
        if (!this.isGrid && this.isGrouped && this.ignoreMouseOnGroup)
            col -= Math.max(0, this.colGroupDimension - this.canvasScrollLeft);
        else
            col -= this.colGroupDimension;
        if ((row < 0 || col < 0) && !approxResults)
            return;
        if (col < 0) // For approximate results we accept negative values (useful for grouping)
            col = 0;
        let itemIndex;
        let origrow = row;
        // Adjust for skipped regions
        for (let i = this.skips.length - 1; i >= 0; i--) { // we need to go backward when we have more than one skips
            let skip = this.skips[i];
            if (skip._startPx <= row) {
                if (row < skip._startPx + skip.reservePx && !approxResults)
                    return undefined; // We are inside the reserved region
                row -= skip.reservePx;
            }
        }
        if (this.isGrouped) {
            let group = this.getOffsetGroup(row);
            if (!group) // E.g. groups not provided yet
                return undefined;
            if (this.isGrid) {
                itemIndex = group.index + Math.min(Math.floor((row - group.offset) / (this.rowDimension + this.itemRowSpacing)) * this.itemsPerRow +
                    Math.floor(col / (this.colDimension + this.itemHorzSpacing + this.itemRedistSpacing)), group.visibleTracks - 1);
            }
            else {
                itemIndex = group.index + Math.min(Math.floor((row - group.offset) / (this.rowDimension + this.itemRowSpacing)), group.visibleTracks - 1);
            }
        }
        else {
            if (this.isGrid) {
                itemIndex = Math.min(Math.floor(row / (this.rowDimension + this.itemRowSpacing)) * this.itemsPerRow +
                    Math.floor(col / (this.colDimension + this.itemHorzSpacing + this.itemRedistSpacing)), this.itemCount - 1);
            }
            else {
                itemIndex = Math.min(Math.floor(row / (this.rowDimension + this.itemRowSpacing)), this.itemCount - 1);
            }
        }
        if (itemIndex < 0)
            return undefined;
        if (!approxResults) {
            // Make sure that the calculated item rectangle contains the point    
            let rect = this.getItemRect(itemIndex);
            col += this.colGroupDimension;
            if (origrow < rect.top || origrow >= rect.top + rect.height || col < rect.left || col >= rect.left + rect.width)
                return undefined;
        }
        return itemIndex;
    }
    addSkipsToRow(row) {
        for (let i = 0; i < this.skips.length; i++) {
            let skip = this.skips[i];
            if (row >= skip._startPx)
                row += skip.reservePx;
        }
        return row;
    }
    getItemTopOffset(itemIndex) {
        let res;
        if (this.isGrouped) {
            let group = this.getItemGroup(itemIndex);
            if (!group)
                return 0;
            res = Math.floor((itemIndex - group.index) / this.itemsPerRow) * (this.rowDimension + this.itemRowSpacing) +
                group.offset;
        }
        else
            res = Math.floor(itemIndex / this.itemsPerRow) * (this.rowDimension + this.itemRowSpacing);
        return this.addSkipsToRow(res);
    }
    getItemLeft(itemIndex) {
        if (this.isGrouped) {
            let group = this.getItemGroup(itemIndex);
            if (group) {
                let items = (itemIndex - group.index);
                return this.colGroupDimension + (items - Math.floor(items / this.itemsPerRow) * this.itemsPerRow) * (this.colDimension + this.itemRedistSpacing);
            }
        }
        return (itemIndex - Math.floor(itemIndex / this.itemsPerRow) * this.itemsPerRow) * (this.colDimension + this.itemRedistSpacing);
    }
    getItemRect(itemIndex) {
        return {
            top: this.getItemTopOffset(itemIndex),
            left: this.getItemLeft(itemIndex),
            width: this.colDimension,
            height: this.rowDimension
        };
    }
    getItemTopRelativeOffset(itemIndex) {
        return this.getItemTopOffset(itemIndex) - this.getScrollOffset();
    }
    getScrollBottom() {
        return this.getScrollOffset() - this._headerOffsetHeight + Math.max(this.getVisibleRowsDim(), this._parentOffsetHeight);
    }
    scrollToView(top, bottom, aboveShift) {
        if (fullLVDebug)
            ODS('ScrollToView: ' + top + ', current: ' + this.getScrollOffset());
        let availableH = Math.max(this.getVisibleRowsDim(), this._parentOffsetHeight);
        let scrollOffset = this.getScrollOffset();
        let itemH = bottom - top;
        if ((top < scrollOffset) || (itemH > availableH)) {
            if ((top > scrollOffset) || (itemH <= availableH)) // scroll only if we already do not show the content all over the available area to avoid unintended scroll, #15803
                this.setSmoothScrollOffset(top + (aboveShift || 0));
        }
        else {
            let scrollBottom = scrollOffset - this._headerOffsetHeight;
            scrollBottom += availableH; // #15803
            if (this.dynamicSize && this.scrollingParent && (this.scrollingParent.scrollWidth > this.scrollingParent.clientWidth))
                scrollBottom -= getScrollbarWidth(); // LS: so that item is fully visible even when there is bottom scrollbar in scrolling parent (#15185 - item 14)
            if (bottom > scrollBottom)
                this.setSmoothScrollOffset(scrollOffset + bottom - scrollBottom + (aboveShift || 0), true /*can scroll beyond current height*/);
        }
    }
    setItemFullyVisible(itemIndex, immediately) {
        this._itemToShow = itemIndex;
        if (immediately) {
            this._setItemFullyVisible();
            this.invalidateScrollPos = true;
            this.saveRealScroll();
        }
        else
            this.deferredDraw();
    }
    _setItemFullyVisible() {
        let itemIndex = this._itemToShow;
        if (itemIndex !== undefined) {
            this._itemToShow = undefined;
            let offset = this.getItemTopOffset(itemIndex);
            this.scrollToView(offset, offset + this.rowDimension);
        }
    }
    setItemFullyVisibleCentered(itemIndex) {
        if (!this._dataSource)
            return;
        if (this._dataSource.count !== this.itemCount) { // not rendered yet after item count change, schedule scroll
            this._scrollToItemIdx = itemIndex;
        }
        else {
            this._scrollToItemIdx = -1;
            let offset = this.getItemTopOffset(itemIndex);
            this.setSmoothScrollOffset(offset + (this.rowDimension - this.getVisibleRowsDim()) / 2);
        }
    }
    setFocusedFullyVisible() {
        this.setItemFullyVisible(this.focusedIndex || 0);
    }
    isItemFullyVisible(itemIndex) {
        let offset = this.getItemTopRelativeOffset(itemIndex);
        return (offset >= 0) && (offset + this.rowDimension < this.getVisibleRowsDim());
    }
    setfocusedIndexAndDeselectOld(itemIndex) {
        if (this.focusedAlsoSelected)
            return this.setFocusedAndSelectedIndex(itemIndex);
        else {
            this.focusedIndex = itemIndex;
            return dummyPromise();
        }
    }
    handleFocusChanged(newIndex, oldIndex) {
        if (newIndex == oldIndex)
            return; // #15426
        if (this.ignoreShiftFocusChange) {
            this.ignoreShiftFocusChange = false;
        }
        else {
            this._shiftFocusedItem = newIndex;
            this._groupShiftFocusedID = undefined;
        }
        let div;
        if (oldIndex >= 0) {
            div = this.getDiv(oldIndex);
            if (div) {
                div.forceRebind = true;
            }
        }
        if (newIndex >= 0) {
            div = this.getDiv(newIndex);
            if (div)
                div.forceRebind = true;
        }
        this.deferredDraw();
        this.onFocusChanged(newIndex);
    }
    handleSortChanged(_itemObjectToShow) {
        if (_itemObjectToShow) {
            if (this.dataSource) {
                let item = _itemObjectToShow;
                this.dataSource.locked(() => {
                    let idx = this.dataSource.indexOf(item);
                    if (idx >= 0) {
                        this._itemToShow = idx;
                        this.focusedIndex = idx;
                    }
                });
            }
        }
        this.deferredDraw();
    }
    redrawFocusedItem(newState) {
        let oldState = this.focusVisible;
        this.focusVisible = newState;
        if (oldState !== newState) {
            let div = this.getDiv(this.focusedIndex);
            if (div)
                this.handleBinding(div, this.focusedIndex); // refresh
        }
        this.focusRefresh(newState);
    }
    setSelectedIndex(itemIndex, dontClearSelection) {
        let ds = this._dataSource;
        if (ds && itemIndex < ds.count && itemIndex >= 0) {
            return ds.modifyAsync(() => {
                if (itemIndex < ds.count && (itemIndex >= 0) && !ds.isSelected(itemIndex)) {
                    if (!dontClearSelection)
                        ds.clearSelection();
                    ds.setSelected(itemIndex, true);
                    this.raiseItemSelectChange(itemIndex);
                }
            }, { onlyFlags: true });
        }
        return dummyPromise();
    }
    setFocusedAndSelectedIndex(itemIndex) {
        this._requestedFocAndSelectIdx = itemIndex;
        if (itemIndex != this.focusedIndex) {
            let ds = this._dataSource;
            if (ds) {
                return ds.modifyAsync(() => {
                    if (this._cleanUpCalled)
                        return;
                    if /* still */ (this._requestedFocAndSelectIdx == itemIndex) {
                        ds.clearSelection();
                        if ((itemIndex < ds.count) && (itemIndex >= 0)) {
                            ds.setSelected(itemIndex, true);
                            this.raiseItemSelectChange(itemIndex);
                        }
                        else
                            ds.clearSelection();
                        this.focusedIndex = itemIndex; // LS: needs to be set after the selection - some components listen for 'focuschange' event and creates context menu based on selected items (#15083)                    
                    }
                }, { onlyFlags: true });
            }
        }
        return dummyPromise();
    }
    getItemColumn(itemIndex) {
        if (this.isGrouped) {
            let group = this.getItemGroup(itemIndex);
            return (itemIndex - group.index) % this.itemsPerRow;
        }
        else
            return itemIndex % this.itemsPerRow;
    }
    getItemAtColumnOrLess(itemIndex, column) {
        if (this.isGrouped) {
            let group = this.getItemGroup(itemIndex);
            let offset = (itemIndex - group.index);
            return Math.min(group.index + group.itemCount - 1, itemIndex +
                Math.max(column - offset % this.itemsPerRow, 0));
        }
        else
            return Math.min(this.itemCount - 1, itemIndex + column - itemIndex % this.itemsPerRow);
    }
    getItemRowDown(itemIndex) {
        let item = itemIndex + this.itemsPerRow;
        let next = (item < this.itemCount ? item : itemIndex);
        if ((this.showRowCount > 0) && (this.itemsPerRow > 0)) {
            let currRow = Math.floor(next / this.itemsPerRow);
            if (currRow >= this.showRowCount)
                next = itemIndex;
        }
        if (this.isGrouped) {
            let group = this.getItemGroup(itemIndex);
            let group2 = this.getItemGroup(next);
            if (group.index != group2.index) {
                group2 = this.getNextGroup(group);
                next = group2.index + Math.min(group2.itemCount - 1, this.getItemColumn(itemIndex));
            }
        }
        return next;
    }
    getItemRowUp(itemIndex) {
        let item = itemIndex - this.itemsPerRow;
        let next = (item >= 0 ? item : itemIndex);
        if (this.isGrouped) {
            let group = this.getItemGroup(itemIndex);
            let group2 = this.getItemGroup(next);
            if (group && group2 && (group.index != group2.index)) {
                group2 = this.getPrevGroup(group);
                next = group2.index + Math.min(group2.itemCount - 1, Math.floor((group2.itemCount - 1) / this.itemsPerRow) * this.itemsPerRow + this.getItemColumn(itemIndex));
            }
        }
        return next;
    }
    ignoreHotkey(hotkey) {
        let ar = [];
        if (this.focusedIndex >= 0) {
            ar = ['Right', 'Left', 'Up', 'Down', 'Enter', 'PageUp', 'PageDown'];
            if (this.checkboxes)
                ar.push('Space');
            if (window.uitools.getCanEdit())
                ar.push('F2');
        }
        if (this.enableIncrementalSearch && this._searchBuffer)
            ar.push('Space');
        return inArray(hotkey, ar, true /* ignore case */);
    }
    handle_keyup(e) {
        if (this.disabled)
            return;
    }
    handle_keydown(e) {
        if (this.disabled || (window.popupWindow && !window.popupWindow.readyToHandleHotKey(e))) //#21080: chromium sometimes send a keystroke to main window even when already handled in menu window))
            return;
        let newFocus = this.focusedIndex;
        let lv = this;
        function handleDown() {
            if (lv.focusedIndex < 0)
                newFocus = 0;
            else
                newFocus = lv.getItemRowDown(lv.focusedIndex);
        }
        function handleRight() {
            if (lv.focusedIndex < 0)
                newFocus = 0;
            else
                newFocus = Math.min(lv.focusedIndex + 1, lv.itemCount - 1);
            if ((lv.showRowCount > 0) && (lv.itemsPerRow > 0)) {
                let currRow = Math.floor(newFocus / lv.itemsPerRow);
                if (currRow >= lv.showRowCount)
                    newFocus = lv.focusedIndex;
            }
        }
        function handleLeft() {
            if (lv.focusedIndex < 0)
                newFocus = 0;
            else
                newFocus = Math.max(lv.focusedIndex - 1, 0);
        }
        function handleUp() {
            if (lv.focusedIndex < 0)
                newFocus = 0;
            else
                newFocus = lv.getItemRowUp(lv.focusedIndex);
        }
        function handlePageDown() {
            let item = lv.focusedIndex;
            let column = lv.getItemColumn(item);
            let itemOffset = lv.getItemTopOffset(lv.focusedIndex);
            while (true) {
                let nextItem = lv.getItemRowDown(item);
                if (nextItem == item || !lv.isItemFullyVisible(nextItem))
                    break;
                item = nextItem;
            }
            if (item != lv.focusedIndex) { // Focus can be moved a bit down without scrolling
                newFocus = item;
                if (itemOffset != lv.getItemTopOffset(item))
                    newFocus = lv.getItemAtColumnOrLess(newFocus, column);
            }
            else { // Scrolling is needed
                while (true) {
                    let nextItem = lv.getItemRowDown(item);
                    let nextOffset = lv.getItemTopOffset(nextItem);
                    if (nextItem == item || nextOffset - itemOffset >= lv.getVisibleRowsDimVirtual())
                        break;
                    item = nextItem;
                }
                newFocus = lv.getItemAtColumnOrLess(item, column);
            }
        }
        function handlePageUp() {
            let item = lv.focusedIndex;
            let column = lv.getItemColumn(item);
            let itemOffset = lv.getItemTopOffset(lv.focusedIndex);
            while (true) {
                let nextItem = lv.getItemRowUp(item);
                if (nextItem == item || !lv.isItemFullyVisible(nextItem))
                    break;
                item = nextItem;
            }
            if (item != lv.focusedIndex) { // Focus can be moved a bit up without scrolling
                newFocus = item;
                if (itemOffset != lv.getItemTopOffset(item))
                    newFocus = lv.getItemAtColumnOrLess(newFocus, column);
            }
            else { // Scrolling is needed
                while (true) {
                    let nextItem = lv.getItemRowUp(item);
                    let nextOffset = lv.getItemTopOffset(nextItem);
                    if (nextItem == item || itemOffset - nextOffset >= lv.getVisibleRowsDimVirtual())
                        break;
                    item = nextItem;
                }
                newFocus = lv.getItemAtColumnOrLess(item, column);
            }
        }
        let handled = false;
        let wasArrowKey = false;
        switch (friendlyKeyName(e)) {
            case 'Enter':
                {
                    let div = this.getDiv(this.focusedIndex);
                    if (div && !e.ctrlKey && !e.altKey && !e.shiftKey) // so that Ctrl+Enter is not taken like Enter
                     {
                        let item = this.getItem(div.itemIndex);
                        if (item)
                            this.raiseEvent('itementer', {
                                item: item,
                                div: div
                            });
                        handled = true;
                    }
                }
                break;
            case 'Esc':
                if (!e.ctrlKey && !e.altKey && !e.shiftKey) {
                    if (this.isPopupShown()) {
                        this.closePopup();
                        this.container.focus(); // return focus, it could jump to another control in case it was inside popup
                        handled = true;
                    }
                    this.selectionMode = false;
                    if (isMainWindow) // do not block Esc in child windows (need to be handled by 'Close' button there)
                    handled = true;
                }
                break;
            case 'Down':
                if (e.altKey) {
                    if (this.popupSupport) {
                        this.showPopup(this.focusedIndex);
                        this.container.focus(); // return focus, it could jump to another control in case it was inside popup
                        handled = true;
                    }
                }
                else {
                    if (e.ctrlKey && this._lastSearchBuffer)
                        this.performIncrementalSearch(this._lastSearchBuffer, false /* reverse order */, true /* next occurence */);
                    else {
                        if (this.isHorizontal)
                            handleRight();
                        else
                            handleDown();
                        wasArrowKey = true;
                    }
                    handled = (newFocus != this.focusedIndex);
                }
                break;
            case 'Right':
                if (!e.altKey) {
                    if (this.isHorizontal)
                        handleDown();
                    else
                        handleRight();
                    wasArrowKey = true;
                    handled = (newFocus != this.focusedIndex);
                }
                break;
            case 'Left':
                if (!e.altKey) {
                    if (this.isHorizontal)
                        handleUp();
                    else
                        handleLeft();
                    wasArrowKey = true;
                    handled = (newFocus != this.focusedIndex);
                }
                break;
            case 'Up':
                if (e.altKey) {
                    this.closePopup();
                    this.container.focus(); // return focus, it could jump to another control in case it was inside popup
                    handled = true;
                }
                else {
                    if (e.ctrlKey && this._lastSearchBuffer)
                        this.performIncrementalSearch(this._lastSearchBuffer, true /* reverse order */, true /* next occurence  */);
                    else {
                        if (this.isHorizontal)
                            handleLeft();
                        else
                            handleUp();
                        wasArrowKey = true;
                    }
                    handled = (newFocus != this.focusedIndex);
                }
                break;
            case 'Home':
                if (!this.dynamicSize || (e.shiftKey && this.multiselect /* #16955 */)) {
                    if (!e.altKey) {
                        if (this.itemCount > 0)
                            newFocus = 0;
                        handled = true;
                    }
                }
                break;
            case 'End':
                if (!this.dynamicSize || (e.shiftKey && this.multiselect /* #16955 */)) {
                    if (!e.altKey) {
                        if (this.itemCount > 0)
                            newFocus = this.itemCount - 1;
                        handled = true;
                    }
                }
                break;
            case 'PageDown':
                if (!e.altKey) {
                    if (this.focusedIndex < 0)
                        newFocus = 0;
                    else
                        handlePageDown();
                    handled = true;
                }
                break;
            case 'PageUp':
                if (!e.altKey) {
                    if (this.focusedIndex < 0)
                        newFocus = 0;
                    else
                        handlePageUp();
                    handled = true;
                }
                break;
            case 'Space':
                if (e.ctrlKey && this.multiselect) {
                    if (this.focusedIndex >= 0) {
                        this.focusedShiftItem = this.focusedIndex;
                        let ds = this._dataSource;
                        ds.modifyAsync(() => {
                            if ((this.focusedIndex < ds.count) && (this.focusedIndex >= 0)) {
                                let _select = !ds.isSelected(this.focusedIndex);
                                ds.setSelected(this.focusedIndex, _select);
                                if (_select)
                                    this.raiseItemSelectChange(this.focusedIndex);
                            }
                        }, { onlyFlags: true });
                        handled = true;
                    }
                }
                else {
                    if (this.checkboxes) {
                        this.invertCheckStateForSelected();
                        handled = true;
                    }
                }
                break;
            case 'F2':
                if (window.uitools.getCanEdit()) {
                    this.editStart();
                    handled = true;
                }
                break;
            case '+': // '+'
                if (e.ctrlKey) {
                    this.zoomIn();
                    handled = true;
                }
                break;
            case '-': // '-'
                if (e.ctrlKey) {
                    this.zoomOut();
                    handled = true;
                }
                break;
            case 'a': // 'a'
                if (this.multiselect && e.ctrlKey && !e.altKey && !e.shiftKey) {
                    let ds = this.dataSource;
                    if (ds && ds.selectRangeAsync)
                        ds.selectRangeAsync(0, ds.count - 1);
                    handled = true;
                }
                break;
            default:
                handled = false;
        }
        if (this.enableIncrementalSearch && !handled && !e.ctrlKey && !e.altKey && !e.metaKey && e.key && (e.key.length === 1)) {
            let ignore = false;
            if (e.shiftKey) { // shift is needed for capitals (#15106 / 11)
                if (window.hotkeys && window.hotkeys.getHotkeyData('Shift+' + window.friendlyKeyName(e)))
                    ignore = true; // #18628: Shift+Character Hotkey also executes as character
            }
            if (!ignore)
                this._handleIncrementalSearch(e.key);
            handled = true; // always handled, so it will not jump to filter section in case focus is not changed
        }
        if (handled) {
            window.lastKeyDown = e;
            e.stopPropagation();
            if (wasArrowKey)
                e.stopImmediatePropagation(); // needed to enable focus changing outside LV by arrows
            e.preventDefault(); // Needed at least for dynamicSize LVs in order to prevent scrolling of the parent element on arrows
            this._useMouseHover = false;
            this.updateHover();
        }
        if (handled && (!e.keyCode || (e.keyCode > 18))) // any key pressed (not just shift or so)
            this.focusVisible = true; // After a keyboard operation, make focus rectangle visible
        if (newFocus != this.focusedIndex) {
            let oldShiftItem = this._shiftFocusedItem;
            let oldShiftGroupID = this._groupShiftFocusedID;
            if (e.shiftKey && this.multiselect) {
                if (lv.selectingRange) // not finished previous selection, do not call yet, it would cause #18351
                    return;
                this.focusedIndex = newFocus;
                this._shiftFocusedItem = oldShiftItem;
                this._groupShiftFocusedID = oldShiftGroupID;
                lv.selectingRange = true;
                this._dataSource.selectRangeAsync(this.focusedIndex, this.getShiftFocusedIndex(), !e.ctrlKey || this.isShiftSelect(), !e.ctrlKey /* clear selection */).then1(function () {
                    lv.selectingRange = false;
                });
                this.closePopup();
                if (this.automaticSelectionMode)
                    this.selectionMode = true;
            }
            else if (e.ctrlKey && this.multiselect) {
                this.focusedIndex = newFocus;
                this._shiftFocusedItem = oldShiftItem;
                this._groupShiftFocusedID = oldShiftGroupID;
                this.closePopup();
                if (this.automaticSelectionMode)
                    this.selectionMode = true;
            }
            else {
                this.setfocusedIndexAndDeselectOld(newFocus).then1(() => {
                    if (this.isPopupShown())
                        this.showPopup(newFocus);
                    this.setFocusedFullyVisible();
                    if (this.isGrid)
                        this.container.focus(); // LS: this is workaround for #19611, I haven't figured out why focus is lost sometimes
                });
            }
            this.setFocusedFullyVisible(); // #17009 / #17568
        }
        this.focusRefresh(this.focusVisible);
        this.afterUserInteraction();
    }
    showToast(message) {
        let scrollLeft;
        if (this.dynamicSize && this.scrollingParent)
            scrollLeft = this.scrollingParent.scrollLeft;
        else
            scrollLeft = this.canvas.scrollLeft;
        let rect = this.container.getBoundingClientRect();
        let visRect = this.getVisibleRect();
        let _left = rect.left + scrollLeft;
        let _right = _left + visRect.width;
        uitools.toastMessage.show(message, {
            disableClose: true,
            delay: 3000,
            left: _left,
            right: _right
        });
    }
    _handleIncrementalSearch(letter, reverseOrder, nextOccurence) {
        if (letter) {
            if (this._searchBuffer) {
                this._searchBuffer = this._searchBuffer + letter;
            }
            else {
                if (letter == ' ')
                    return; // skip the first space key (when there is nothing in the _searchBuffer yet)
                if (window.hotkeys && window.hotkeys.getHotkeyData(letter))
                    return; // #19475: Contextual search shouldn't override hotkeys    
                this._searchBuffer = letter;
            }
        }
        if (!this.parentView && !this.supressIncrementalSearchToasts) // supress toast messages when we are placed into a view, search bar is taking it
            this.showToast(_('Scroll to') + ': "' + this._searchBuffer + '" (' + sprintf(_('Use %s for the next match'), '"Ctrl+Down"') + ') ' + this._incrementalSearchMessageSuffix(this._searchBuffer));
        if (!this.performIncrementalSearch(this._searchBuffer, reverseOrder, nextOccurence)) {
            if (nextOccurence && !this.parentView && !this.supressIncrementalSearchToasts && this._searchBuffer)
                this.showToast('"' + this._searchBuffer + '" ' + _('phrase not found') + this._incrementalSearchMessageSuffix(this._searchBuffer));
        }
        this.raiseEvent('incrementalsearch', {
            controlClass: this,
            phrase: this._searchBuffer,
            reverseOrder: reverseOrder
        }, true, true);
    }
    performIncrementalSearch(searchPhrase, reverseOrder, nextOccurence) {
        if (!searchPhrase || searchPhrase == '')
            return;
        this._searchBuffer = searchPhrase;
        this._lastSearchBuffer = this._searchBuffer;
        this.requestTimeout(() => {
            this._searchBuffer = undefined;
        }, 1000 /* ms (#15185 - item 10) */, 'incSearchClearBufferTimeout');
        let _success = true;
        let oldIndex = this.focusedIndex;
        let newIndex = this.incrementalSearch(this._searchBuffer, reverseOrder, nextOccurence);
        if (newIndex >= 0) {
            this.setfocusedIndexAndDeselectOld(newIndex).then(() => {
                this.setFocusedFullyVisible(); // #17045
            });
        }
        if (oldIndex == newIndex && nextOccurence) {
            _success = false;
        }
        else if (newIndex < 0) {
            _success = false; // no occurence
        }
        else {
            if (oldIndex >= 0)
                if (((newIndex < oldIndex) && !reverseOrder) || ((newIndex > oldIndex) && reverseOrder))
                    _success = false;
        }
        return _success;
    }
    _incrementalSearchMessageSuffix(phrase) {
        return ''; // is overriden by descendants (e.g. TracklistView)
    }
    incrementalSearch(searchPhrase, reverseOrder, nextOccurence) {
        let result = this.focusedIndex;
        let ds = this.dataSource;
        if (ds && ds.getIndexByPrefix) {
            let startIndex = 0;
            if (this.focusedIndex >= 0) {
                if (reverseOrder) {
                    if (nextOccurence)
                        startIndex = this.focusedIndex;
                    else
                        startIndex = this.focusedIndex + 1;
                }
                else {
                    reverseOrder = false;
                    if (nextOccurence)
                        startIndex = this.focusedIndex + 1;
                    else
                        startIndex = this.focusedIndex;
                }
            }
            result = ds.getIndexByPrefix(searchPhrase, startIndex, reverseOrder);
        }
        return result;
    }
    /**
    Starts inline editing of the focused item.

    @method editStart
    */
    editStart() { }
    /**
    Confirms the current inline edit.

    @method editSave
    */
    editSave(continueEdit /* this value will be true when saved valued using tab or keydown */, newItemSelected /* new item was selected by mouse */) {
        this.inEdit = undefined;
    }
    /**
    Cancels the current inline edit.

    @method editCancel
    */
    editCancel() {
        this.inEdit = undefined;
    }
    handleItemLongTouch(div, e) {
        if (this.disabled)
            return;
        let item = this.getItem(div.itemIndex);
        this.focusedIndex = -1;
        this.setFocusedAndSelectedIndex(div.itemIndex);
        this.raiseEvent('touchlongclick', {
            item: item,
            div: div
        }, true, true, div);
    }
    getShiftFocusedIndex() {
        if (this._groupShiftFocusedID !== undefined) {
            let group = this._dataSource.getGroupByID(this._groupShiftFocusedID);
            if (!group)
                return 0;
            if (group.index < this.focusedIndex)
                return group.index;
            else
                return group.index + group.itemCount - 1;
        }
        else
            return this._shiftFocusedItem;
    }
    // Returns whether the current operation should select or unselect
    isShiftSelect() {
        let focus = this.getShiftFocusedIndex();
        if (focus < 0 || focus >= this._dataSource.count || this.selectionMode)
            return true;
        else {
            let ret = false;
            this.dataSource.locked(function () {
                ret = this._dataSource.isSelected(focus);
            }.bind(this));
            return ret;
        }
    }
    afterUserInteraction() { }
    handleItemMouseDown(div, e) {
        e.stopPropagation();
        if (this.disabled)
            return;
        let ds = this._dataSource;
        if (!ds)
            return;
        // check selection or drag
        let canDrag = this.handleLassoStart(div, e);
        this.makeDraggable(div, canDrag && !!this.dndEventsRegistered);
        let wasUsingTouch = usingTouch;
        // @ts-ignore
        let doMiddleClick = (e.which === 2 && typeof this.handleItemMiddleClick === 'function'); // #19042
        let pr = ds.modifyAsync(() => {
            let index = div.itemIndex;
            if ((index < ds.count) && (index >= 0)) {
                if (e.shiftKey && this.multiselect) {
                    this.ignoreShiftFocusChange = true;
                    this.focusedIndex = index;
                    ds.selectRangeAsync(this.focusedIndex, this.getShiftFocusedIndex(), !e.ctrlKey || this.isShiftSelect(), !e.ctrlKey);
                }
                else if (doMiddleClick) {
                    // #16960: Add optional middle wheel click handler for classes that extend ListView
                    // 	handleItemMiddleClick acts as an override for all 
                    // @ts-ignore
                    this.handleItemMiddleClick(div, e);
                }
                else {
                    if (this.focusedIndex == index) {
                        let ignore = ((this.lastMouseDiv === div) && (div.lastMouseUp) && (Date.now() - div.lastMouseUp < 3000)); // to not interfere with title editing (#15927 - item 2b)
                        if (!ignore)
                            this.onFocusChanged(index); // to emit 'focuschange' event even when the same node is clicked again, needed for media tree (#12717 - item 3) and playlist tree (#15926 - 7b)
                    }
                    else
                        this.focusedIndex = index;
                    if ((e.ctrlKey && this.multiselect) || (this.multiselect && wasUsingTouch && this.selectionMode)) {
                        let _select = !ds.isSelected(index);
                        ds.setSelected(index, _select);
                        if (_select)
                            this.raiseItemSelectChange(index);
                        else
                            div.removeAttribute('data-hover');
                    }
                    else {
                        if (!ds.isSelected(index)) {
                            ds.clearSelection();
                            ds.setSelected(index, true);
                        }
                        this.raiseItemSelectChange(index);
                    }
                }
            }
            this._lastFocusChangingPromise = undefined;
        }, { onlyFlags: true });
        if (e.button === 2) // right button
            this._contextMenuPromises.push(pr); // to wait for 'focuschange' in the 'contextmenu' handler
        if (doMiddleClick) {
            e.preventDefault(); // #19042 - preventDefault() must be done immediately, not in a callback
        }
    }
    canUseLasso(e) {
        if (e.target.nodeName !== 'LABEL') {
            // lasso is enabled only in 'non-content' part of the list (out of text)
            let content = e.target.innerText;
            if (content) {
                let line = content;
                let nl = line.indexOf('\n');
                if (nl > 0)
                    line = line.substr(0, nl + 1);
                let w = getTextWidth(line, e.target);
                return e.offsetX > w;
            }
        }
        return false;
    }
    handleLassoStart(div, e) {
        if (this.selectionMode)
            return;
        let ret = true;
        let isLeftButton = (e.button === 0);
        let isSelected = false;
        if (this.dataSource && div && (div.itemIndex >= 0)) {
            this.dataSource.locked(() => {
                isSelected = this.dataSource.isSelected(div.itemIndex);
            });
        }
        this._lassoSelectionStart = undefined;
        if (this.multiselect && isLeftButton && !e.shiftKey && !e.ctrlKey && !e.altKey && this.lassoSelectionEnabled && !isSelected) {
            if (this.canUseLasso(e)) {
                // clicked on item itself ... not a content so we can select items
                // PETR: disabled for now because of issues with D&D
                ret = false; // lasso is active
                let lvpos = getAbsPosRect(this.container);
                let headerHeight = this.getVirtualHeights().headerHeight;
                let offset = this.getScrollOffset();
                this._lassoSelectionStart = {
                    x: e.pageX - lvpos.left,
                    y: e.pageY - lvpos.top - headerHeight,
                    startingItemIndex: div ? div.itemIndex : (this.isGrouped ? -1 /* #19563 */ : this.itemCount /* #17763 */),
                    itemIndex: div ? div.itemIndex : (this.isGrouped ? -1 /* 19563 */ : this.itemCount /* #17763 */),
                    direction: 0,
                    offset: offset,
                    lvpos: lvpos,
                    headerHeight: headerHeight
                };
                window.handleCapture(this.container, (e) => {
                    if (this._lassoSelectionStart) {
                        if (!isChildOf(this.container, e.target)) {
                            // check mouse position ... when it's above LV, select top visible item, when below LV, select bottom visible item
                            let rect = this.canvas.getBoundingClientRect();
                            let lvpos = {
                                top: rect.top + this._parentScrollTop,
                                left: rect.left,
                                bottom: rect.top + this._parentScrollTop + this.container.clientHeight
                            };
                            //var lvpos = getAbsPosRect(this.viewport);
                            if (e.clientY < lvpos.top) {
                                this.handleLassoMove(this.getDiv(this.firstVisibleItem), e);
                            }
                            else if (e.clientY > lvpos.bottom) {
                                this.handleLassoMove(this.getDiv(this.lastVisibleItem), e);
                            }
                        }
                    }
                }, (e) => {
                    this._cleanUpLasso();
                });
                if (div)
                    this.handleItemMouseOver(div, e);
                window.showSelectionLayer(true);
                this.updateLassoLayer(this._lassoSelectionStart.x, this._lassoSelectionStart.y, this._lassoSelectionStart.x, this._lassoSelectionStart.y);
            }
        }
        return ret;
    }
    updateLassoLayer(fromX, fromY, toX, toY) {
        window.updateLassoPosition(this.viewport, fromX, fromY, toX, toY);
    }
    _cleanUpLasso() {
        window.showSelectionLayer(false);
        // reset mouse selection
        this._lassoSelectionStart = undefined;
        this._lassoRangeStart = undefined;
        this._lassoRangeEnd = undefined;
        this._lastLassoUsageTm = Date.now();
    }
    updateLassoInfo(currentMouseInfo) {
    }
    handleLassoMove(div, e) {
        if (this.selectionMode)
            return;
        if (this._lassoSelectionStart) {
            let scrollRequireSum = 0;
            let offset = this.getScrollOffset();
            let lvPos = null;
            if (this.dynamicSize) {
                lvPos = getAbsPosRect(this.container);
                this._lassoSelectionStart.lvpos = lvPos;
            }
            let currentMouseInfo = {
                x: e.pageX - this._lassoSelectionStart.lvpos.left,
                y: e.pageY - this._lassoSelectionStart.lvpos.top - this._lassoSelectionStart.headerHeight,
                itemIndex: div ? div.itemIndex : -1 /*this.itemCount*/,
                offset: offset
            };
            // scroll only when user move with mouse
            if ((currentMouseInfo.x !== this._lassoSelectionStart.x) || (currentMouseInfo.y !== this._lassoSelectionStart.y)) {
                this.updateLassoInfo(currentMouseInfo);
                if (!this.dynamicSize)
                    lvPos = getAbsPosRect(this.container);
                let lvPosTop = (this.dynamicSize) ? (offset + lvPos.top) : lvPos.top;
                let lvViewportHeight = ((this.dynamicSize) ? (this._parentOffsetHeight - this._lassoSelectionStart.headerHeight) : this.canvasHeight);
                let posY = (e.clientY - lvPosTop) - this._lassoSelectionStart.headerHeight;
                if ((posY < this.lassoAutoScrollOffset) && (offset > 0)) {
                    scrollRequireSum = -((this.lassoAutoScrollOffset - posY) * 3);
                }
                else if ((posY > lvViewportHeight - this.lassoAutoScrollOffset) && (offset < this.viewportSize - lvViewportHeight)) {
                    scrollRequireSum = (this.lassoAutoScrollOffset - (lvViewportHeight - posY)) * 3;
                }
                if (scrollRequireSum !== 0) {
                    this.setScrollOffset(offset + scrollRequireSum);
                    if (this.dynamicSize)
                        this._lassoSelectionStart.y += scrollRequireSum;
                }
            }
            // TODO: draw rectangle and enum items inside (for grids)
            // for now, simple from-to range selection (for lists)
            if (!this.isGrid) {
                let rangeStart = Math.min(this._lassoSelectionStart.itemIndex, currentMouseInfo.itemIndex);
                let rangeEnd = Math.max(this._lassoSelectionStart.itemIndex, currentMouseInfo.itemIndex);
                if ((rangeStart !== this._lassoRangeStart) || (rangeEnd !== this._lassoRangeEnd)) {
                    this._lassoRangeStart = rangeStart;
                    this._lassoRangeEnd = rangeEnd;
                    if (this._selectPromise) {
                        cancelPromise(this._selectPromise);
                        this._selectPromise = undefined;
                    }
                    if (this.dataSource && this.dataSource.selectRangeAsync && (rangeStart >= 0) && (rangeEnd >= 0))
                        this._selectPromise = this.dataSource.selectRangeAsync(rangeStart, rangeEnd, true, !e.ctrlKey && !e.shiftKey /* do clear selection */);
                }
            }
            this.updateLassoLayer(this._lassoSelectionStart.x - (this.isHorizontal ? offset - this._lassoSelectionStart.offset : 0), this._lassoSelectionStart.y - (this.isHorizontal ? 0 : offset - this._lassoSelectionStart.offset), currentMouseInfo.x, currentMouseInfo.y);
        }
    }
    handleItemMouseMove(div, e) {
        if (this.disabled)
            return;
        this.handleLassoMove(div, e);
    }
    handleItemMouseOver(div, e) {
        if (this.disabled)
            return;
        this.handleLassoMove(div, e);
    }
    handleItemMouseUp(div, e) {
        if (!this._isTreeView) // #18097
            e.stopPropagation(); // needed when LV is inside of LV (e.g. popups in artist grid)
        let handleSelection = this._lassoSelectionStart === undefined;
        this._cleanUpLasso();
        if (this.dndEventsRegistered)
            this.makeDraggable(div, true);
        if (this.disabled)
            return;
        if (handleSelection) {
            if (e.shiftKey || e.ctrlKey || (e.button !== 0) || !this.multiselect || (usingTouch && this.selectionMode))
                return;
            let ds = this._dataSource;
            if (ds) {
                ds.modifyAsync(() => {
                    let index = div.itemIndex;
                    if ((index < ds.count) && (index >= 0)) {
                        ds.clearSelection();
                        ds.setSelected(index, true);
                        this.raiseItemSelectChange(index);
                    }
                }, { onlyFlags: true });
            }
        }
    }
    showDelayedPopup(idx) {
        if (this._openingPopupTimer)
            clearTimeout(this._openingPopupTimer);
        this._openingPopupTimer = this.requestTimeout(() => {
            this._openingPopupTimer = undefined;
            this.showPopup(idx);
        }, this.gridPopupDelay); // #17584
    }
    handleItemClick(div, e) {
        if (this.disabled)
            return;
        let isLeftButton = (e.button == 0);
        if (isLeftButton) {
            if (e.shiftKey || e.ctrlKey) {
                this.closePopup();
                if (this.automaticSelectionMode)
                    this.selectionMode = true;
            }
            else {
                if (this._openingPopupTimer) {
                    clearTimeout(this._openingPopupTimer);
                    this._openingPopupTimer = undefined;
                }
                else if (this.popupSupport && (div.itemIndex !== undefined) && (!this.selectionMode)) {
                    this.showDelayedPopup(div.itemIndex);
                }
            }
        }
        if (isLeftButton && !e.shiftKey && !e.ctrlKey) {
            let item = this.getItem(div.itemIndex);
            if (item)
                this.raiseEvent('itemclick', {
                    item: item,
                    div: div,
                });
        }
    }
    handleItemDblClick(div, e) {
        if (this.disabled)
            return;
        if (this._openingPopupTimer) {
            clearTimeout(this._openingPopupTimer);
            this._openingPopupTimer = undefined;
        }
        this.closePopup();
        let item = this.getItem(div.itemIndex);
        if (item)
            this.raiseEvent('itemdblclick', {
                item: item,
                div: div
            });
    }
    invalidateAll() {
        this.invalidateNeeded = true;
        this.deferredDraw();
    }
    rebind() {
        this.forceRebindAll = true;
        this.deferredDraw();
    }
    handleItemInsert(itemIndex, obj) {
        if (itemIndex >= this.firstCachedItem + this.divs.length && itemIndex > this.lastVisibleItem + 1 /*possibly a new item to be drawn*/) { // This is below all items we cache, let's just update scrollbars, don't do anything else
        }
        else if (itemIndex < this.firstVisibleItem) {
            if (this.isGrid)
                this.invalidateAll();
            else {
                this.canvas.scrollTop += this.itemHeight + this.itemRowSpacing; // Make sure the same items remain visible after scrollbar update
                this.canvasScrollTop = this.canvas.scrollTop;
            }
        }
        else {
            this.invalidateAll();
        }
    }
    handleItemModify(itemIndex, obj) {
        if (itemIndex >= this.firstCachedItem && itemIndex < this.firstCachedItem + this.divs.length) {
            let div = this.getDiv(itemIndex);
            if (div) {
                div.forceRebind = true;
                this.deferredDraw();
            }
        }
    }
    handleItemDelete(itemIndex, obj) {
        if (itemIndex == this.focusedIndex || itemIndex === undefined /* #18750 */)
            this.setSelectedIndex(this.focusedIndex, true);
        this.invalidateAll(); // TODO: Re-introduce animated delete...
        return;
        /*    this.setItemCount(this.itemCount - 1);

            var div = this.deleteDiv(itemIndex);
            if (div) {
                if (itemIndex >= this.firstVisibleItem && itemIndex <= this.lastVisibleItem) {
                    // The deleted item is currently visible - animate the deletion
                    var itemDeleted = function (e) {
                        var div = e.currentTarget;
                        if (div.hasAttribute('data-deleting')) {
                            div.parentListView.hideDiv(div); // Hide this item
                            div.itemIndex = undefined;
                            div.parentListView.divs.push(div); // Let the item be re-used in our cache
                            div.removeAttribute('data-deleting'); // Remove deleting status
                            div.removeAttribute('data-run');
                            div.classList.remove('deleteitem');
                            app.unlisten(div, transitionEndEventName, itemDeleted);
                        }
                    };

                    app.listen(div, transitionEndEventName, itemDeleted);
                    div.classList.add('deleteitem');
                    div.setAttribute('data-deleting', '1');
                    div.setAttribute('data-run', '1');

                    this.animateNextDraw = true;
                    this.draw();
                } else {
                    div.itemIndex = undefined; // Invalidate the item
                    this.hideDiv(div);
                    this.divs.push(div); // Let the item be re-used in our cache
                }
            }

            if (itemIndex < this.firstVisibleItem) { // We have to redraw - the deleted item can have an impact on the visible items
                // TODO: Adjust scrollbars in case we can continue showing the very same content (just shift offset)
                this.invalidateAll();
            }*/
    }
    handleItemChange(eventType, itemIndex, obj, flags, flagData, flagValue) {
        let _this = this;
        if ((flags === 'flagchange') && (flagData === 1 /* selected */)) {
            // no need to invalidate all ... just refresh selection state
            this.forceRebindSelection = true;
            this.deferredDraw();
        }
        else {
            // Update pop-up location (and close it if necessary)
            if (this.popupDiv && this.dataSource && this.dataSource.indexOfPersistentIDAsync) {
                let shownIndex = _this.popupDiv.itemIndex;
                this.dataSource.indexOfPersistentIDAsync(this.popupDiv.itemID).then(function (idx) {
                    if (idx < 0)
                        _this.closePopup();
                    else if (_this.popupDiv && !_this.selectionMode && idx != _this.popupDiv.itemIndex && shownIndex == _this.popupDiv.itemIndex) {
                        _this.showPopup(idx);
                    }
                });
            }
            if (fullLVDebug)
                ODS('ListView.handleItemChange: ' + this.constructor.name + ' - ' + eventType);
            if ((this.isGrouped || this.checkGroups) && (eventType != 'modify'))
                this.invalidateAll(); // when grouped we need to recreate groups
            if (!eventType || (eventType === 'newcontent') || (eventType === 'autoupdate' /* #17483 */)) {
                // change event
                this.invalidateAll();
            }
            else {
                switch (eventType) {
                    case 'delete':
                        this.handleItemDelete(itemIndex, obj);
                        break;
                    case 'insert':
                        this.handleItemInsert(itemIndex, obj);
                        break;
                    case 'modify':
                        this.handleItemModify(itemIndex, obj);
                        break;
                }
            }
            this.requestFrame(() => {
                this.raiseSelectionChanged(); // will update context buttons in parent multiview, if needed
            }, 'raiseSelectionChanged');
        }
    }
    /**
    Sets the datasource and persist parameters of the previous view (i.e. the same selection, focused item, etc.)

    @methods setDataSourceSameView
    @param {Object} datasource Datasource object
    @param {bool} [forceRestoreFocus] If false, does not force re-setting focusedIndex after copying selection. Default true.
    */
    setDataSourceSameView(ds, forceRestoreFocus) {
        if (forceRestoreFocus === undefined) {
            if (this.forceRestoreFocus === undefined)
                forceRestoreFocus = true;
            else
                forceRestoreFocus = this.forceRestoreFocus;
        }
        // JH: TODO: currently we persist selection and focus, but possibly the top item (or some scrolling similar to the previous datasource) would be nice as well
        if (this._settingDSPromise) {
            cancelPromise(this._settingDSPromise);
            this._settingDSPromise = undefined;
        }
        if (ds && this._dataSource && !this.isFiltered()) {
            let oldIndex = this._dataSource.focusedIndex;
            if (forceRestoreFocus && (oldIndex > 0))
                ds.focusedIndex = -1; // in order to find later whether the focusedIndex was set in ds.copySelectionAsync() or not
            this.clearFilterSource();
            let copySelPromise = undefined;
            this._settingDSPromise = new Promise((resolve, reject) => {
                let ar = [];
                if (this.isGroupedView) {
                    ar.push(ds.prepareGroupsAsync({
                        groupSepHeight: this.groupSepHeight,
                        groupSpacing: this.groupSpacing,
                        showRowCount: this.showRowCount,
                        itemsPerRow: this.itemsPerRow,
                        rowDimension: this.rowDimension,
                        itemRowSpacing: this.itemRowSpacing,
                        groupHeight: this.groupHeight,
                        regroup: true && !this._regroupSuspended
                    }));
                }
                whenAll(ar).then(() => {
                    if (this.isGroupedView)
                        ds.importCollapsedStateFromList(this.dataSource);
                    copySelPromise = ds.copySelectionAsync(this._dataSource);
                    copySelPromise.then((firstSelectedIdx) => {
                        copySelPromise = undefined;
                        this.dataSource = ds;
                        if (forceRestoreFocus && (oldIndex > 0) && (ds.focusedIndex < 0) /* was not set in ds.copySelectionAsync() above */ && (oldIndex < ds.count)) {
                            ds.focusedIndex = oldIndex; // LS: e.g. when a track is deleted from playlist then we want to persist the focused index
                            ds.modifyAsync(() => {
                                if ((oldIndex < ds.count) && (oldIndex >= 0)) {
                                    ds.setSelected(oldIndex, true);
                                    this.raiseItemSelectChange(oldIndex);
                                }
                            }, { onlyFlags: true });
                        }
                        resolve(firstSelectedIdx);
                    });
                });
            });
            this._settingDSPromise.onCanceled = function () {
                if (copySelPromise) {
                    cancelPromise(copySelPromise);
                    copySelPromise = undefined;
                }
            };
            return this._settingDSPromise;
        }
        else {
            this.clearFilterSource();
            this.dataSource = ds;
            return dummyPromise();
        }
    }
    /**
    Whether to show header.

    @property showHeader
    @type boolean
    */
    get showHeader() {
        return this._showHeader;
    }
    set showHeader(value) {
        this._showHeader = value;
        setVisibility(this.header, this._showHeader);
    }
    get showInline() {
        return this._showInline;
    }
    set showInline(value) {
        this._showInline = value;
        if (value)
            this.container.classList.add('showInline');
        else
            this.container.classList.remove('showInline');
    }
    get isGrid() {
        return this._isGrid;
    }
    set isGrid(value) {
        this._isGrid = value;
        this.container.classList.toggle('grid', this._isGrid);
    }
    get canScrollHoriz() {
        return this._canScrollHoriz;
    }
    set canScrollHoriz(value) {
        this._canScrollHoriz = value;
        if (value) {
            this.container.classList.add('canScrollHoriz');
            if (this.canvas)
                this.canvas.style.overflowX = '';
        }
        else {
            this.container.classList.remove('canScrollHoriz');
            if (this.canvas)
                this.canvas.style.overflowX = 'hidden';
        }
    }
    /**
    Header title to be shown (in case 'showHeader' property is set).

    @property headerTitle
    @type string
    */
    get headerTitle() {
        return this.headerItems.innerText;
    }
    set headerTitle(value) {
        this.headerItems.innerText = value;
    }
    get selectionMode() {
        return this._selectionMode;
    }
    set selectionMode(value) {
        if (this._selectionMode !== value) {
            this._selectionMode = value;
            this.raiseSelectionChanged();
            if (value) {
                this.container.setAttribute('data-selection-mode', '1');
                this.closePopup();
            }
            else
                this.container.removeAttribute('data-selection-mode');
            this.invalidateAll();
        }
    }
    get collapseSupport() {
        return this._collapseSupport;
    }
    set collapseSupport(value) {
        this._collapseSupport = value;
        if (!value) {
            this.groupDivs.forEach(function (div) {
                if (div._collapseMark) {
                    div._collapseMark.remove();
                    div._collapseMark = undefined;
                }
            });
        }
    }
    /**
    Gets/sets index of the focused item. In case there's a datasource, its focusedIndex property is modified.

    @property focusedIndex
    @type integer
    */
    get focusedIndex() {
        let retval = -1;
        let ds = this._dataSource;
        if (ds) {
            retval = ds.focusedIndex;
        }
        return retval;
    }
    set focusedIndex(value) {
        let ds = this._dataSource;
        if (ds) {
            ds.focusedIndex = value;
        }
    }
    /**
    Gets the focused item/object according to the current focusedIndex

    @property focusedItem
    @type object
    */
    get focusedItem() {
        return this.dataSource ? this.dataSource.focusedItem : undefined;
    }
    /**
    Gets/sets the datasource which is/will be shown

    @property dataSource
    @type object
    */
    get dataSource() {
        return this._dataSource;
    }
    set dataSource(ds) {
        if (this._dataSource == ds)
            return;
        if (this.inEdit) {
            this.editCancel();
        }
        if (!this._handleItemChange) {
            this._handleItemChange = this.handleItemChange.bind(this);
            this._handleFocusChanged = this.handleFocusChanged.bind(this);
            this._handleSortChanged = this.handleSortChanged.bind(this);
        }
        let events = {
            'change': this._handleItemChange,
            'focuschange': this._handleFocusChanged,
            'sorted': this._handleSortChanged,
        };
        let oldDataSource = this._dataSource;
        if (this._dataSource) {
            this.cancelAutoSort();
            let oldds = this._dataSource;
            if (this.reportStatus)
                this.unregisterStatusBarSource(this._dataSource);
            for (let prop in events) {
                app.unlisten(oldds, prop, events[prop]);
            }
            this.cancelItemLoadingPromises();
            if (!this.forbiddenWhenLoadedCancel)
                cancelPromise(this._dataSource.whenLoaded());
            this.cleanUpPromises();
            this.closePopup(); // have to be called with non-empty data source
            this.selectionMode = false;
            if (this._updatesSuspended) {
                if (this._interactionTimeout)
                    clearTimeout(this._interactionTimeout);
                this._userInteractionDone();
            }
            this.dataSourceUnlistenFuncts();
            this._dataSource = null;
            this.clearFilterSource();
            this.forceItemCountUpdate = true; //Otherwise datasource with the same # of items wouldn't be updated property in setItemCount()
        }
        this._dataSource = ds;
        this._fastObject = undefined; // LS: dataSource is changed, clear also cached _fastObject (passed through getFastObject() when binding data)
        this._fastObject2 = undefined;
        this.groupHeight = -1; // reset group size, so ti will be computed again for the new data source
        if (this._dataSource) {
            if (this.reportStatus)
                this.registerStatusBarSource(this._dataSource);
            for (let prop in events) {
                app.listen(this._dataSource, prop, events[prop]);
            }
        }
        let evt;
        evt = createNewCustomEvent('datasourcechanged', {
            detail: {
                newDataSource: this._dataSource,
                oldDataSource: oldDataSource
            },
            bubbles: true,
            cancelable: true
        });
        this.container.dispatchEvent(evt);
        let doRefresh = false;
        if (this._dataSource) {
            doRefresh = !this.forceAutoSort();
        }
        else
            doRefresh = true;
        if (doRefresh)
            this.invalidateAll();
    }
    calcPixsPerItems(itemCount) {
        return Math.max((this.showRowCount || Math.ceil(itemCount / this.itemsPerRow)) * (this.rowDimension + this.itemRowSpacing) - this.itemRowSpacing, 0);
    }
    getNextGroup(group) {
        let usePositionIndex = group.positionIndex !== undefined;
        return this.getItemGroup(usePositionIndex ? group.positionIndex + 1 : (group.index + group.itemCount), usePositionIndex);
    }
    getPrevGroup(group) {
        let usePositionIndex = group.positionIndex !== undefined;
        return this.getItemGroup(usePositionIndex ? group.positionIndex - 1 : (group.index - 1), usePositionIndex);
    }
    getItemGroup(itemIndex, usePositionIndex) {
        if (!this.dataSource)
            return undefined;
        return this.dataSource.getItemGroup(itemIndex, usePositionIndex);
    }
    getOffsetGroup(offset) {
        if (!this.isGrouped || !this.dataSource || !this.dataSource.getGroupsCount())
            return undefined;
        return this.dataSource.getOffsetGroup(offset);
    }
    groupsRecompute(reGroup, reComputeViewport, invalidateItemHeight) {
        return new Promise((resolve, reject) => {
            if (this._recomputePromise)
                cancelPromise(this._recomputePromise);
            if (!this.dynamicSize)
                this.saveRealScroll();
            this._restoreScrollPos = true;
            let loader = this.prepareGroupsAsync(reGroup);
            loader.then1((done) => {
                let reload = () => {
                    this.itemHeightReset = invalidateItemHeight;
                    this._adjustSizeNeeded = true;
                    this._groupsRefresh = true;
                    this._reComputeViewport = reComputeViewport;
                    this.invalidateAll();
                };
                if (loader.canceled) {
                    reject();
                    return;
                }
                this._recomputePromise = undefined;
                this.isGrouped = done;
                if (done === true) {
                    reload();
                }
                resolve(done);
            });
            this._recomputePromise = loader;
        }); // call in advance, can change isGrouped property based on result groups
    }
    _adjustSize() {
        let itemHeightReset = this.itemHeightReset;
        if ((this.isGrouped || this.checkGroups) && (!this._groupsRefresh))
            this.groupsRecompute(false, false, false);
        if ((this.itemHeight <= 0) || itemHeightReset) {
            let div = undefined;
            this.itemHeightReset = false;
            let newDiv = false;
            if (this.divs.length > 0) {
                div = this.divs[0];
                let i = 1;
                while ((!div || !div.isVis) && (i < this.divs.length)) {
                    div = this.divs[i];
                    i++;
                }
            }
            let tempVisible = false;
            if (!div) {
                div = this.createDiv();
                newDiv = true;
            }
            else if (!div.isVis) { // we already have first div, but not visible, make it temporary visible to compute correct height
                tempVisible = true;
                div.style.display = '';
            }
            // #17880 JL: Reset manually set style so we can get computed style from CSS only (and not our cached width & height values)
            if (this._refreshItemBoxProperties) {
                div.style.width = '';
                div.style.height = '';
                div.style.paddingLeft = '';
                div.style.paddingRight = '';
                this._refreshItemBoxProperties = false;
            }
            this.itemHeight = div.clientHeight;
            this.itemWidth = div.clientWidth;
            let cs = getComputedStyle(div);
            this.itemBoxProperties.width = Math.round(getPixelSize(cs.width, 'width', div));
            this.itemBoxProperties.height = Math.round(getPixelSize(cs.height, 'height', div));
            this.itemBoxProperties.paddingLeft = Math.round(getPixelSize(cs.paddingLeft, 'paddingLeft', div));
            this.itemBoxProperties.paddingRight = Math.round(getPixelSize(cs.paddingRight, 'paddingRight', div));
            if (this.isHorizontal) {
                this.rowDimension = this.itemWidth;
                this.colDimension = this.itemHeight;
            }
            else {
                this.rowDimension = this.itemHeight;
                this.colDimension = this.itemWidth;
            }
            if (newDiv) {
                this.divs.push(div);
                this.hideDiv(div);
            }
            else if (tempVisible) {
                div.style.display = 'none';
            }
        }
        let recomputeRequired = false;
        if ((this.groupHeight <= 0) || itemHeightReset) {
            if (this.isGrouped && this.groupHeaders) {
                let _div = this.groupDivs[0];
                if (_div === undefined) {
                    _div = this.createGroupDiv();
                    this.groupDivs.push(_div);
                    this.hideGroupDiv(_div);
                }
                let oldValue = this.groupHeight;
                if (!this._groupsRefresh)
                    this.groupHeight = _div.clientHeight;
                if (this.isHorizontal) {
                    this.colGroupDimension = this.groupHeight;
                }
                else {
                    this.colGroupDimension = _div.clientWidth;
                }
                recomputeRequired = oldValue !== this.groupHeight;
            }
            else {
                this.groupHeight = 0;
                this.colGroupDimension = 0;
            }
        }
        if ((this.groupSepHeight <= 0) || itemHeightReset) {
            if (this.isGrouped && this.groupSeparators) {
                let oldValue = this.groupSepHeight;
                let divG = this.groupSepDivs[0];
                if (divG === undefined) {
                    divG = this.createGroupSepDiv();
                    this.groupSepDivs.push(divG);
                    this.hideGroupSepDiv(divG);
                }
                this.groupSepHeight = divG.clientHeight;
                recomputeRequired = recomputeRequired || (oldValue !== this.groupSepHeight);
                if (!recomputeRequired && this.groupSepHeight === 0) { // groupSeparators is true, but groupSepHeight is still zero .. let's plan to compute again
                    this.requestFrame(() => {
                        this.adjustSize();
                    }, 'adjustSize');
                }
            }
            else {
                this.groupSepHeight = 0;
            }
        }
        if (recomputeRequired)
            this.groupsRecompute(false, true, false);
        let origscroll = 0;
        let rect = this.getVisibleRect();
        rect.width = this.canvasWidth; // this differs when scrollingParent is defined
        if (fullLVDebug)
            ODS('**** adjustSize called for: ' + this.itemCount + ', height: ' + rect.height + ', width: ' + rect.width + ', lvWidth: ' + this.container.offsetWidth + ', uniqueId = ' + this.uniqueID);
        if (!this.isGrid) { // Always update item width to full control width in case of a simple list view
            this.itemWidth = rect.width;
            this.colDimension = rect.width;
        }
        let w, h;
        let itemColDim, itemRowDim;
        if (this.isHorizontal) {
            w = rect.height;
            h = rect.width;
            itemColDim = this.itemHeight;
            itemRowDim = this.itemWidth;
        }
        else {
            w = rect.width;
            h = rect.height;
            itemColDim = this.itemWidth;
            itemRowDim = this.itemHeight;
        }
        if (this.isGrid) {
            this.itemsPerRow = Math.floor((w - itemColDim - this.colGroupDimension) / (itemColDim + this.itemHorzSpacing)) + 1;
            if (this.itemsPerRow < 1)
                this.itemsPerRow = 1;
        }
        else {
            this.itemsPerRow = 1;
        }
        if (this.itemsPerRow > 1 && this.distributeEmptySpace)
            this.itemRedistSpacing = (w - this.colGroupDimension - (this.itemsPerRow * itemColDim) - ((this.itemsPerRow - 1) * this.itemHorzSpacing)) / this.itemsPerRow;
        else
            this.itemRedistSpacing = 0;
        // Make sure the cache is large enough to accomodate all pre-drawn screens
        this.divsPerScreen = Math.floor(h / Math.max(itemRowDim, 1) + 1) * this.itemsPerRow;
        this.maxCachedDivs = Math.max(this.minCachedDivs, this.divsPerScreen * (1 /*just the visible screen*/ + 2 * this.preDrawAmount));
        // Adjust background div size
        let size = 0;
        if (this.isGrouped && this.dataSource) {
            size = this.dataSource.getGroupsSize();
            if (!size) { // groups are not prepared yet
                size = this.calcPixsPerItems(this.itemCount);
            }
        }
        else {
            size = this.calcPixsPerItems(this.itemCount);
        }
        // Clean all skips start, so that it's correctly recalculated in the loop below
        for (let i = 0; i < this.skips.length; i++)
            this.skips[i]._startPx = Number.MAX_SAFE_INTEGER;
        // Make sure skips are sorted according to item indexes
        this.skips.sort(function (o1, o2) {
            return o1.afterIndex - o2.afterIndex;
        });
        // Add reserved space for skips
        let targetSizeDiff = 0;
        for (let i = 0; i < this.skips.length; i++) {
            let skip = this.skips[i];
            if (skip.afterIndex < this.itemCount) {
                skip._startPx = this.getItemTopOffset(skip.afterIndex) + this.rowDimension;
                size += skip.reservePx;
                if (skip.targetPx !== undefined && !(skip.mix && skip.hide)) {
                    targetSizeDiff += (skip.targetPx - skip.reservePx);
                }
            }
            else
                skip._startPx = Number.MAX_SAFE_INTEGER;
        }
        let result = true;
        if (!this._groupsRefresh || this._reComputeViewport || (!this.viewportSize) || (!this.viewportSizeY)) { // do not recompute viewport size after groups refresh (otherwise it can stuck in infinite loop due notifyChange called by setViewportSize)    
            let rW = this.requiredWidth();
            if ((size != this.getViewportSize()) || ((this.viewportSizeY != rW) && (rW > 0))) {
                if (fullLVDebug)
                    ODS('LV: Setting new viewport size: ' + size + '/' + rW + ', uniqueId = ' + this.uniqueID);
                let currentWidth = this.getVisibleColsDim();
                // @ts-ignore
                this.container.targetOffsetHeight = (targetSizeDiff ? size + targetSizeDiff : undefined); // So that other controls know our _intended_ size (after animation ends)
                this.setViewportSize(size, rW);
                this.getCanvasSizeAndPos(false /*not cached in order to force refresh of its values*/);
                this.parentScrollFrame(); // Size changes can cause scroll changes that we need to apply.
                result = (currentWidth == this.getVisibleColsDim());
            }
        }
        // Adjust visible viewport (i.e. canvas without scrollbars)
        if (this.canvasWidth > 0) {
            if (fullLVDebug)
                ODS('LV: Setting new viewport width: ' + this.canvasWidth + ', lvWidth: ' + this.container.offsetWidth + ', uniqueId = ' + this.uniqueID);
            if (this.ignoreReflowOptimizations) {
                this.viewport.style.height = setPix(this.canvasHeight);
                this.viewport.style.width = setPix(this.canvasWidth);
            }
            else {
                applyStylingAfterFrame(() => {
                    if (!this._cleanUpCalled) {
                        this.viewport.style.height = setPix(this.canvasHeight);
                        this.viewport.style.width = setPix(this.canvasWidth);
                    }
                });
            }
        }
        this._groupsRefresh = false;
        this._reComputeViewport = false;
        return result;
    }
    adjustSize(adjustItems) {
        if (!this.visible) {
            this._adjustSizeNeeded = true; // Adjust it later, when we are back visible
            return;
        }
        this._adjustSizeNeeded = false;
        if (adjustItems)
            this.resizeDivs(this.container.offsetWidth, this.container.offsetHeight);
        if (!this._adjustSize())
            this._adjustSize(); // JH: This recalc is needed when a scrollbar is shown/hidden by the setViewportSize() call above	
    }
    setViewportSize(size, sizeY) {
        if ((this.viewportSize != size) || (sizeY !== undefined)) {
            if (this.viewportSize != size) {
                this.viewportSize = size;
                this.dummy.style[this.isHorizontal ? 'width' : 'height'] = setPix(size);
                this.scrollingCanvas.style[this.isHorizontal ? 'width' : 'height'] = setPix(size);
            }
            if (this.viewportSizeY != sizeY) {
                this.viewportSizeY = sizeY;
                this.dummy.style[this.isHorizontal ? 'height' : 'width'] = setPix(sizeY);
                this.scrollingCanvas.style[this.isHorizontal ? 'height' : 'width'] = (sizeY < this.canvasWidth ? '100%' : setPix(sizeY));
            }
            this.onSizeChanged(size);
            if (this.dynamicSize && this.scrollingParent) {
                idleNotifyLayoutChangeDown(this.scrollingParent); // Notify all children of our parent scrolling element
            }
        }
    }
    getViewportSize() {
        return this.viewportSize;
    }
    getCanvasSizeAndPos(cached) {
        if (!cached || !this.canvasWidth) {
            this.canvasWidth = this.canvas.clientWidth;
            this.canvasHeight = this.canvas.clientHeight;
            if (this.headerFill) {
                if (this.canvas.scrollHeight > this.canvas.clientHeight) {
                    // move header by scrollbar width to the left, so it will not lose aligning
                    if (!this._headerFillPaddingSet) {
                        this.headerFill.style.paddingRight = getScrollbarWidth() + 'px';
                        this._headerFillPaddingSet = true;
                    }
                }
                else {
                    if (this._headerFillPaddingSet) {
                        this.headerFill.style.paddingRight = '';
                        this._headerFillPaddingSet = false;
                    }
                }
            }
        }
        return {
            w: this.canvasWidth,
            h: this.canvasHeight,
            l: this.canvasScrollLeft,
            t: this.canvasScrollTop
        };
    }
    getVisibleRect() {
        if (this.dynamicSize) { // TODO: This isn't yet implemented for virtual horizontal scrolling
            let parent = this.scrollingParent;
            if (parent) {
                let h = Math.min(this._parentOffsetHeight, this._containerOffsetTop - this._parentScrollTop + this._containerOffsetHeight) - Math.max(this._containerOffsetTop - this._parentScrollTop, 0) - this._headerOffsetHeight;
                if (h < 0)
                    h = 0;
                if (fullLVDebug)
                    ODS('*** LV.getVisibleRect: this._parentScrollTop = ' + this._parentScrollTop + ', this._containerOffsetTop = ' + this._containerOffsetTop + ', uniqueId = ' + this.uniqueID);
                return {
                    top: Math.max(this._parentScrollTop - this._containerOffsetTop, 0),
                    height: h,
                    width: parent.offsetWidth // truly visible part in scroller (needed because of #15382, #15427)
                };
            }
        }
        return {
            top: this.getSmoothScrollOffset(),
            height: this.canvasHeight,
            width: this.canvasWidth
        };
    }
    setItemCount(cnt) {
        if (cnt != this.itemCount || this.forceItemCountUpdate) {
            this.recalcLayoutNeeded = true;
            if (fullLVDebug)
                ODS('*** Changed item count from ' + this.itemCount + ' to ' + cnt + ', uniqueId = ' + this.uniqueID);
            this.itemCount = cnt;
            if (this.visible) {
                this.forceItemCountUpdate = false;
                this.adjustSize(false);
            }
            else {
                if (fullLVDebug)
                    ODS('***Invisible LV, recalcLayout will be needed later');
                this.invalidateNeeded = true;
                this.forceItemCountUpdate = true;
            }
            if (this.horLineSepDiv)
                setVisibilityFast(this.horLineSepDiv, cnt > 0);
        }
    }
    handleBinding(div, index) {
        if (this._dataSource) {
            let _this = this;
            this._dataSource.locked(function () {
                _this.handleBinding_locked(div, index);
            });
        }
        else
            this.handleBinding_locked(div, index);
    }
    handleBinding_locked(div, index) {
        if (div && this._dataSource) {
            let rebind = (div.itemIndex != index);
            if (rebind)
                div.itemIndex = index;
            if (this._dataSource)
                this.markSelected(div, this._dataSource.isSelected(index));
            let focused = (this.focusedIndex == index);
            this.markFocused(div, focused);
            rebind = rebind || div.forceRebind;
            div.forceRebind = false;
            if (rebind) {
                this.cancelItemLoadingPromise(div);
                let bindObj;
                if (this.useFastBinding) {
                    this._fastObject = this.dataSource.getFastObject(index, this._fastObject);
                    bindObj = this._fastObject;
                }
                else {
                    bindObj = this.dataSource.getValue(index);
                }
                this.bindData(div, index, bindObj);
                if (!this.isGrid && !this.noItemOverstrike) {
                    if ((index & 1) === 0)
                        div.setAttribute('data-even', '1');
                    else
                        div.removeAttribute('data-even');
                }
            }
        }
    }
    markSelected(div, selected) {
        if (selected && !this.noItemOverstrike) {
            div.setAttribute('data-selected', '1');
            setAriaActiveDescendant(div, this.container); // Screen reader support
        }
        else {
            div.removeAttribute('data-selected');
            clearAriaID(div); // Screen reader support
        }
    }
    focusRefresh(newFocusState) {
        this.focusVisible = newFocusState;
        if ((newFocusState) && (this.focusedIndex == -1) && (isUsingKeyboard()) && (this._dataSource && this._dataSource.count) && (!this.getScrollOffset() /* not scrolled */)) {
            // PETR: make first item focused when navigated by TAB and nothing is selected/focused
            this.focusedIndex = 0;
        }
        let div = this.getDiv(this.focusedIndex);
        if (div) {
            this.markFocused(div, newFocusState);
        }
    }
    markFocused(div, focused) {
        if (div.hasAttribute('data-focused') !== focused)
            div.forceRebind = true;
        if (focused) {
            div.setAttribute('data-focused', '1');
            if (this.focusVisible)
                div.setAttribute('data-keyfocused', '1');
        }
        else {
            div.removeAttribute('data-focused');
            div.removeAttribute('data-keyfocused');
        }
    }
    addItemToCanvas(div) {
        this.viewport.appendChild(div);
    }
    stopPreDraw() {
        if (this._predrawTimeout) {
            clearTimeout(this._predrawTimeout);
            this._predrawTimeout = undefined;
            this.preDrawnScreens = 0;
        }
    }
    cancelItemLoadingPromises() {
        this.divs.forEach(function (div) {
            this.cancelItemLoadingPromise(div);
        }.bind(this));
    }
    cancelItemLoadingPromise(div) {
        if (div.loadingPromise && !div.loadingPromise.finished) {
            cancelPromise(div.loadingPromise);
            div.loadingPromise = undefined;
        }
    }
    clearDivs() {
        this.stopPreDraw();
        // Clean up all items/divs
        if (this.divs) {
            for (let i = 0; i < this.divs.length; i++) {
                let div = this.divs[i];
                if (div) {
                    this.cancelItemLoadingPromise(div);
                    this.cleanUpDiv(div);
                    if (div.parentNode)
                        removeElement(div);
                    div.parentListView = undefined;
                }
            }
            this.divs.length = 0;
        }
        // Clean up group headers
        if (this.groupDivs) {
            for (let i = 0; i < this.groupDivs.length; i++) {
                let div = this.groupDivs[i];
                if (div) {
                    this.cancelItemLoadingPromise(div);
                    this.cleanUpGroupHeader(div);
                    div.parentListView = undefined;
                    if (div._collapseMark) {
                        div._collapseMark.remove();
                    }
                    if (div.parentNode)
                        removeElement(div);
                }
            }
            this.groupDivs.length = 0;
        }
        // Clean up group separators
        if (this.groupSepDivs) {
            for (let i = 0; i < this.groupSepDivs.length; i++) {
                let div = this.groupSepDivs[i];
                this.cleanUpGroupSep(div);
                div.parentListView = undefined;
                if (div.parentNode)
                    removeElement(div);
            }
            this.groupSepDivs.length = 0;
        }
        this.firstCachedItem = 0;
    }
    getItem(index) {
        if (this._dataSource) {
            let result;
            this._dataSource.locked(function () {
                if (index >= 0 && index < this._dataSource.count)
                    result = this._dataSource.getValue(index);
            }.bind(this));
            return result;
        }
    }
    getFastItem(index) {
        if (this._dataSource) {
            let retval = undefined;
            this._dataSource.locked(function () {
                if (index >= 0 && index < this._dataSource.count) {
                    retval = this._dataSource.getFastObject(index, this._fastObject2);
                }
            }.bind(this));
            return retval;
        }
    }
    // used for in-place editing to get item for edit, by default it is the same as LV item
    getItemForEdit(index) {
        return this.getItem(index);
    }
    // ============== Methods below are to be overriden in descendants in order to achieve desired behavior =================
    // Called just once to initialize the view
    setUpDiv(div) { }
    // Called often to bind the currently active data
    bindData(div, index, item) {
        if (this.bindFn)
            this.bindFn(div, item);
    }
    // Called on div that aren't currently being used (not visible to show data)
    suspendDiv(div) {
        // SVG animations are eating CPU even when they're hidden ... so remove all SVGs with any animation (#15258)
        // data-hasSVGAnimation property is set automatically in loadIcon when SVG contain animation
        let svgs = qes(div, '[data-hasSVGAnimation]');
        if (svgs) {
            for (let i = 0; i < svgs.length; i++) {
                svgs[i].remove();
            }
            div.loadedIcon = undefined;
            return true;
        }
        else {
            return false;
        }
    }
    // Called in the end to clean up anything registered by the div
    cleanUpDiv(div) {
        if (div.unlisteners) {
            forEach(div.unlisteners, function (unlistenFunc) {
                unlistenFunc();
            });
            div.unlisteners = undefined;
        }
    }
    // Called just once to initialize the group header
    setUpGroupHeader(div) { }
    // Called often to bind data to a group header
    renderGroupHeader(div, group, forceRebind) {
        div.innerText = group.id;
    }
    // Called in the end to clean up anything registered by the div (group header)
    cleanUpGroupHeader(div) {
        div.parentListView = undefined;
    }
    // Called just once to initialize the group separator
    setUpGroupSep(div) { }
    // Called often to bind data to a group header
    renderGroupSep(div, group) { }
    // Called in the end to clean up anything registered by the div (group header)
    cleanUpGroupSep(div) {
        div.parentListView = undefined;
    }
    setUpHeader(header) {
        header.classList.add('lvHeaderSingleItem');
    }
    // Called when d&d is finished
    dropToPosition(targetItemIndex) {
        if (this._dataSource) {
            this._dataSource.autoSort = false;
            this._dataSource.moveSelectionTo(targetItemIndex);
        }
    }
    // Called when render state is changed
    renderState(state) { }
    // Called often (after any modification) to get a list of all groups
    prepareGroupsAsync(reGroup) {
        return new Promise((resolve) => {
            if (this._dataSource && this._dataSource.prepareGroupsAsync) {
                this._dataSource.prepareGroupsAsync({
                    groupSepHeight: this.groupSepHeight,
                    groupSpacing: this.groupSpacing,
                    showRowCount: this.showRowCount,
                    itemsPerRow: this.itemsPerRow,
                    rowDimension: this.rowDimension,
                    itemRowSpacing: this.itemRowSpacing,
                    groupHeight: this.groupHeight,
                    regroup: reGroup && !this._regroupSuspended
                }).then1((done) => {
                    resolve.call(this, done);
                });
            }
            else
                resolve(false);
        });
    }
    requiredWidth(visibleWidth) {
        return undefined; // The default, which means that there's no specific width required, overriden e.g. in GridView
    }
    zoomIn() {
        //alert('Called Zoom In'); // commented as it's not yet implemented
    }
    zoomOut() {
        //alert('Called Zoom Out'); // commented as it's not yet implemented
    }
    onFocusChanged(newfocusedIndex) {
        if (!this.dontEmitFocusChange)
            this.raiseEvent('focuschange', {
                index: newfocusedIndex
            }, true, false /* LS: don't bubble*/);
    }
    onSizeChanged(newsize) {
        this.raiseEvent('sizechanged', {
            size: newsize
        }, true, true);
    }
    storeState() {
        if (!this.disableStateStoring && this.dataSource) {
            let state = {
                focusedIndex: this.focusedIndex,
                itemCount: this.dataSource.count,
                scrollOffset: this.getScrollOffset(),
                popupShown: this.isPopupShown(),
            };
            if (!this.storeLastFocusedState) {
                state.focusedIndex = -1; // store focus only for active control, #20333
            }
            return state;
        }
        else
            return {};
    }
    resetState() {
        if (!this.dontResetState) {
            // LS: used when this control is added to controlCache to have the default values again
            this.setScrollOffset(0);
            this.resetScrollbars();
        }
    }
    restoreState(fromObject) {
        if (this.disableStateStoring)
            return;
        ODS('ListView.restoreState: ' + JSON.stringify(fromObject));
        let DS = this.dataSource;
        assert(DS, 'ListView.restoreState: dataSource unassigned !');
        this.localPromise(DS.whenLoaded()).then(() => {
            // dataSource is loaded, draw it and restore:
            let currentOffset = this.getScrollOffset();
            if (!currentOffset || (Math.abs(currentOffset) <= 1) || (this.scrollingParent && fromObject.scrollOffset == currentOffset)) // If user hasn't scrolled manually yet, 1px reserve for rounding
             {
                if (DS.count == fromObject.itemCount && fromObject.focusedIndex >= 0) {
                    this._requestFocusIndex = fromObject.focusedIndex;
                    ODS('ListView.restoreState: requested focused index: ' + fromObject.focusedIndex);
                    this._requestPopup = fromObject.popupShown;
                }
                this._requestScrollPosition = fromObject.scrollOffset;
                ODS('ListView.restoreState: requested scroll position: ' + fromObject.scrollOffset + ', DS.count = ' + DS.count);
                this.invalidateAll();
            }
            else {
                ODS('ListView.restoreState: user already scrolled manually to ' + currentOffset + ', restore offset is: ' + fromObject.scrollOffset);
            }
        });
    }
    createHeaderLayout() {
        this.container.classList.add('flex');
        this.container.classList.add('column');
        // 'header' element for a non-scrolling header
        this.header = document.createElement('div');
        this.header.style.height = 'auto';
        this.header.style.overflow = 'hidden';
        this.header.style.position = 'sticky';
        this.header.style.top = '0px';
        this.header.className = 'lvHeader';
        this.header.setAttribute('data-header', '1');
        this.container.appendChild(this.header);
        this.header.controlClass = new Control(this.header); // to allow assigning context menu
        // 'headerItems' element for the scrolling part of header
        this.headerItems = document.createElement('div');
        this.headerItems.style.height = 'auto';
        this.headerItems.style.overflow = 'hidden';
        this.headerItems.className = 'lvHeaderItems';
        this.header.setAttribute('data-headeritems', '1');
        this.header.appendChild(this.headerItems);
        this.setUpHeader(this.headerItems);
        setVisibility(this.header, this._showHeader);
        // 'body' element for the rest of LV, i.e. everything without a header
        this.body = document.createElement('div');
        this.body.style.overflow = 'hidden';
        this.body.className = 'lvBody fill';
        this.container.appendChild(this.body);
        // 'fill' is only here, so that we have an 'absolute' positioned parent, relatively to which all item divs will be positioned
        this.fill = document.createElement('div');
        this.fill.className = 'lvFill fill';
        this.body.appendChild(this.fill);
    }
    createItemsLayout() {
        // 'canvas' is a static positioned element, so that the descendant div items don't scroll with it. It shows scrollbars, when necessary.
        this.canvas = document.createElement('div');
        this.canvas.className = 'lvCanvas';
        this.canvas.style.height = '100%';
        this.canvas.style.width = '100%';
        this.canvas.style.overflow = this.noScroll ? 'hidden' : 'auto';
        if (!this.canScrollHoriz)
            this.canvas.style.overflowX = 'hidden';
        // 'viewport' is the main element where all the drawing occurs (and parent of all the divs)
        // It's the same as canvas, but dynamically scaled to not include canvas scrollbars and using 'overflow: hidden' it cuts all children divs to not be drawn over scrollbars.
        this.viewport = document.createElement('div');
        this.viewport.className = 'lvViewport';
        this.viewport.style.overflow = 'hidden';
        this.viewport.style.position = 'absolute';
        this.canvas.appendChild(this.viewport);
        // 'scrollingCanvas' element is here pretty much for possible drawing effects only - e.g. there can be a gradient background be drawn behind all item.
        this.scrollingCanvas = document.createElement('div');
        this.scrollingCanvas.className = 'lvScrollingCanvas';
        this.scrollingCanvas.style.height = '100%';
        this.scrollingCanvas.style.width = '100%';
        this.canvas.appendChild(this.scrollingCanvas);
        // 'Dummy' element makes sure that the horizontal and vertical scrollbars of 'canvas' have the correct dimensions
        this.dummy = document.createElement('div');
        this.dummy.style.height = '100%';
        this.dummy.style.width = '100%';
        this.scrollingCanvas.appendChild(this.dummy);
        this.fill.appendChild(this.canvas);
        /////////////////////////////
        // TOUCH SUPPORT 
        /////////////////////////////
        // get original offset from touch start 
        let getStartOffset = () => {
            if (this.isHorizontal)
                return this._originalTouchPos.screenX;
            else
                return this._originalTouchPos.screenY;
        };
        // get current touch position
        let getOffset = (e) => {
            if (this.isHorizontal)
                return e.touches[0].screenX;
            else
                return e.touches[0].screenY;
        };
        let getMaxSize = () => {
            return (this.isHorizontal ? this.scrollingCanvas.clientWidth - this.canvas.clientWidth : this.scrollingCanvas.clientHeight - this.canvas.clientHeight);
        };
        let translateMethod = () => {
            return (this.isHorizontal ? 'translateX' : 'translateY');
        };
        this._setGum = (isTouch, newPosition) => {
            if ((this._touchScroll && isTouch) || !isTouch) {
                let maxSize = getMaxSize();
                if (maxSize > 0) {
                    let gumSize = 0;
                    if (newPosition < 0)
                        gumSize = Math.abs(newPosition / 8);
                    else {
                        if (newPosition > maxSize)
                            gumSize = -Math.abs((newPosition - maxSize) / 8);
                    }
                    if (gumSize != 0) {
                        this._gumSize = gumSize;
                        this.viewport.style.transform = translateMethod() + '(' + gumSize + 'px)';
                    }
                    else {
                        this._gumSize = 0;
                        if (!isTouch)
                            this._lastOffset = undefined;
                    }
                    if (!isTouch) {
                        if (this._gumSize !== undefined && this._gumSize != 0) {
                            this.requestTimeout(() => {
                                this._lastOffset = undefined;
                                this._releaseGum();
                            }, 150, 'gumtimer');
                        }
                    }
                }
            }
        };
        this._releaseGum = () => {
            // Animate gum using Web Animations            
            this._gumSize = this._gumSize / 2;
            let atBeg = this._lastOffset <= 0;
            //this.viewport.style.transition = 'all 0.1s ease-out';
            this._gumplayer = this.viewport.animate([
                {
                    transform: this.viewport.style.transform
                },
                {
                    transform: translateMethod() + '(' + (this._gumSize * (atBeg ? -1 : 1)) + 'px)'
                },
                {
                    transform: translateMethod() + '(' + (this._gumSize / 2 * (!atBeg ? -1 : 1)) + 'px)'
                },
                {
                    transform: translateMethod() + '(' + (this._gumSize / 4 * (atBeg ? -1 : 1)) + 'px)'
                },
                {
                    transform: translateMethod() + '(' + (this._gumSize / 8 * (!atBeg ? -1 : 1)) + 'px)'
                },
                {
                    transform: translateMethod() + '(' + (this._gumSize / 16 * (atBeg ? -1 : 1)) + 'px)'
                },
                {
                    transform: translateMethod() + '(' + (this._gumSize / 32 * (!atBeg ? -1 : 1)) + 'px)'
                }
            ], {
                easing: 'ease-out',
                duration: 500
            });
            app.listen(this._gumplayer, 'finish', () => {
                app.unlisten(this._gumplayer);
                this.viewport.style.transform = '';
                this.viewport.style.transition = '';
                this._gumSize = undefined;
                this._gumplayer = undefined;
            });
            /*
            if (this._gumReleaseStep !== undefined)
                app.unlisten(this.viewport, transitionEndEventName, releaseGum);

            if (this._gumReleaseStep === undefined || this._gumReleaseStep < 6) {
                if (this._gumReleaseStep === undefined)
                    this._gumReleaseStep = 1;
                else
                    this._gumReleaseStep++;
                this._gumSize = this._gumSize / 4;
                this.viewport.style.transition = 'all 0.1s ease-out';
                this.viewport.style.transform = translateMethod() + '(' + (this._gumSize * (this._gumReleaseStep & 1 ? -1 : 1)) + 'px)';
                app.listen(this.viewport, transitionEndEventName, releaseGum);
            } else {
                this.viewport.style.transform = '';
                this._gumSize = undefined;
                this._gumReleaseStep = undefined;
            }*/
        };
        // scroll to new position
        let scrollTo = (newPosition) => {
            let _this = this;
            this.requestFrame(function () {
                _this._lastOffset = newPosition;
                _this.setScrollOffset(newPosition);
                _this._setGum(true, newPosition);
            }, 'setScrollOffset');
        };
        // compute velocity of the touch (how fast user moving)
        let computeVelocity = () => {
            let now = Date.now();
            let elapsed = now - this._lastTimestamp;
            this._lastTimestamp = now;
            let delta = this._lastOffset - this._lastComputeOffset;
            this._lastComputeOffset = this._lastOffset;
            let v = (900 * delta) / (elapsed);
            this._velocity = 0.8 * v + 0.2 * this._velocity;
        };
        // compute and scroll decelerated (when user moves quickly and releases touch)
        let deceleration = () => {
            if (this._deceleration && !this._touchScroll) {
                let elapsed = Date.now() - this._lastTimestamp;
                let delta = -this._deceleration * Math.exp(-elapsed / 350 /* total time of deceleration */);
                let newOffset = this._targetScrollOffset + delta;
                if (delta > 0.5 || delta < -0.5) {
                    scrollTo(newOffset);
                    this.requestFrame(deceleration, 'deceleration');
                }
                else {
                    scrollTo(this._targetScrollOffset);
                }
            }
        };
        let touchstart = (e) => {
            this._touchScroll = true;
            if (e.touches.length == 1) {
                this._velocity = 0;
                this._deceleration = 0;
                this._lastTimestamp = Date.now();
                this._lastTouchPos = e.touches[0];
                this._lastOffset = this.getScrollOffset();
                this._originalTouchPos = this._lastTouchPos;
                this._originalOffset = this._lastOffset;
                this._lastComputeOffset = this._lastOffset;
                this._gumSize = undefined;
                this._gumReleaseStep = undefined;
                this.viewport.style.transition = '';
                this.viewport.style.transform = '';
                clearInterval(this._touchTimer);
                this._touchTimer = setInterval(computeVelocity, 100);
                //e.preventDefault();
                //e.stopPropagation();
            }
        };
        let touchmove = (e) => {
            if (this._touchScroll) {
                if (e.touches.length == 1) {
                    let moveOffset = getOffset(e) - getStartOffset();
                    scrollTo(this._originalOffset - moveOffset);
                }
            }
        };
        let touchend = (e) => {
            this._touchScroll = false;
            clearInterval(this._touchTimer);
            computeVelocity();
            if (this._gumSize !== undefined && this._gumSize != 0) {
                this._releaseGum();
            }
            else if ((this._velocity > 10 || this._velocity < -10) && (!this._dynamicSize)) {
                this._deceleration = 0.8 * this._velocity;
                let maxSize = getMaxSize();
                this._targetScrollOffset = Math.min(maxSize, Math.max(0, Math.round(this._lastOffset + this._deceleration)));
                if (this.getScrollOffset() != this._targetScrollOffset) {
                    this._lastTimestamp = Date.now();
                    this.requestFrame(deceleration, 'deceleration');
                }
            }
            //e.preventDefault();
            //e.stopPropagation();
        };
        let _this = this;
        app.listen(this.viewport, 'touchstart', function (e) {
            touchstart(e);
        }, window.addPassiveOption(false));
        app.listen(this.viewport, 'touchmove', function (e) {
            touchmove(e);
        }, window.addPassiveOption(false));
        app.listen(this.viewport, 'touchend', function (e) {
            touchend(e);
        }, window.addPassiveOption(false));
        app.listen(this.viewport, 'touchcancel', function (e) {
            touchend(e);
        }, window.addPassiveOption(false));
    }
    _setGum(arg0, newPosition) {
        throw new Error('Method not implemented.');
    }
    invertCheckStateForSelected() {
        let ds = this._dataSource;
        ds.modifyAsync(function () {
            if (ds.count) {
                ds.beginUpdate();
                fastForEach(ds, function (item, index) {
                    if (ds.isSelected(index))
                        ds.setChecked(index, !ds.isChecked(index));
                });
                ds.endUpdate();
            }
        }.bind(this)).then(() => {
            this.invalidateAll();
            let event = createNewCustomEvent('checkedchanged', {
                detail: null,
                bubbles: true,
                cancelable: true
            });
            this.container.dispatchEvent(event);
        });
    }
    // internal
    headerContextMenuHandler(e) {
        if (this._headerContextMenu) {
            e.stopPropagation();
            let pos = window.getScreenCoordsFromEvent(e);
            this._headerContextMenu.show(pos.left, pos.top);
        }
    }
    contextMenuHandler(e) {
        e.stopPropagation();
        let _super_contextMenuHandler = super.contextMenuHandler.bind(this);
        whenAll(this._contextMenuPromises).then(() => {
            _super_contextMenuHandler(e);
        });
    }
    cleanUpPromises() {
        for (let ids = 0; ids < this._contextMenuPromises.length; ids++) {
            if ((this._contextMenuPromises[ids]) && (isPromise(this._contextMenuPromises[ids]))) {
                cancelPromise(this._contextMenuPromises[ids]);
            }
        }
        this._contextMenuPromises = [];
        super.cleanUpPromises();
    }
    // forces resort of the list and return true when resort is placed or false when auto sort not supported
    forceAutoSort() {
        if (this._autoSortString && this._dataSource && (this.autoSortSupported || this.canSaveNewOrder) && this._dataSource.setAutoSortAsync) {
            this._lastSorting = this._dataSource.setAutoSortAsync(this._autoSortString);
            this._lastSorting.then(() => {
                this._lastSorting = undefined;
                this.invalidateAll();
            });
            return true;
        }
        return false;
    }
    /**
    Gets/sets context menu of the header.

    @property headerContextMenu
    @type Menu
    */
    get headerContextMenu() {
        return this._headerContextMenu;
    }
    set headerContextMenu(value) {
        this._headerContextMenu = value;
        if (value && this._headerContextMenuHandler === undefined) {
            this._headerContextMenuHandler = this.headerContextMenuHandler.bind(this);
            app.listen(this.header, 'contextmenu', this._headerContextMenuHandler);
        }
    }
    get autoSortSupported() {
        if (this.dataSource && (this.dataSource.autoSortDisabled !== undefined))
            return !this.dataSource.autoSortDisabled;
        else
            return true;
    }
    _prepareSortColumns(value) {
        // overriden in descendants (e.g. GridView)
    }
    _refreshSortIndicators() {
        // overriden in descendants (e.g. GridView)
    }
    renderGroupHeaderPartial(div, group, offset) {
        // overriden in descendant GroupedTrackList
    }
    get autoSortString() {
        if (this._autoSortString !== undefined)
            return this._autoSortString;
        else
            return this.getDefaultSortString();
    }
    set autoSortString(value) {
        if (this._autoSortString != value) {
            this._autoSortString = value;
            if (this._prepareSortColumns && this._refreshSortIndicators) {
                this._prepareSortColumns(value);
                this._refreshSortIndicators();
            }
            if (this.isSortable /* #19397 */)
                this.forceAutoSort();
        }
    }
    get toolbarActions() {
        if (this._toolbarActions === undefined) {
            if (this.multiselect) {
                this._toolbarActions = [actions.cancelSelection, actions.selectAll];
            }
            else {
                this._toolbarActions = [];
            }
        }
        return this._toolbarActions;
    }
    cancelAutoSort() {
        if (this._lastSorting) {
            cancelPromise(this._lastSorting);
            this._lastSorting = undefined;
        }
    }
    getDefaultSortString() {
        return '';
    }
    getFocusedItemLink() {
        let link;
        if (this.focusedIndex >= 0 && this.dataSource && (this.focusedIndex < this.dataSource.count)) {
            this.dataSource.locked(() => {
                link = this.dataSource.getValueLink(this.focusedIndex);
            });
        }
        return link;
    }
    raiseItemFocusChange() {
        let itmLink = this.getFocusedItemLink();
        if (itmLink) {
            this.raiseEvent('itemfocuschange', {
                link: itmLink
            }, true, false /* don't bubble */);
        }
    }
    raiseItemSelectChange(index) {
        let link;
        if (index >= 0 && this.dataSource && index < this.dataSource.count) {
            this.dataSource.locked(() => {
                link = this.dataSource.getValueLink(index);
            });
        }
        if (link) {
            let isFocused = (index === this.focusedIndex);
            this.raiseEvent('itemselectchange', {
                link: link,
                isFocused: isFocused,
                index: index
            }, true, false /* don't bubble */);
        }
    }
    getVirtualHeights() {
        let cs = getComputedStyle(this.container, null);
        let totheight = this.viewportSize;
        let headerHeight = parseFloat(cs.getPropertyValue('border-top-width')) + parseFloat(cs.getPropertyValue('padding-top')) + parseFloat(cs.getPropertyValue('margin-top'));
        let footerHeight = parseFloat(cs.getPropertyValue('border-bottom-width')) + parseFloat(cs.getPropertyValue('padding-bottom')) + +parseFloat(cs.getPropertyValue('margin-bottom'));
        if (this.showHeader) {
            headerHeight += getFullHeight(this.header);
        }
        totheight += headerHeight + footerHeight;
        return {
            totalHeight: totheight,
            headerHeight: headerHeight,
            footerHeight: footerHeight
        };
    }
    getFocusedElement() {
        if (this.focusedIndex > -1)
            return this.getDiv(this.focusedIndex);
    }
    updateParentScrollTop() {
        if (this.scrollingParent) {
            if (this.scrollingParent.controlClass && this.scrollingParent.controlClass.getSmoothScrollOffset) {
                this._parentScrollTop = this.scrollingParent.controlClass.getSmoothScrollOffset();
            }
            else {
                this._parentScrollTop = this.scrollingParent.scrollTop;
            }
        }
        else {
            this._parentScrollTop = 0;
        }
    }
    parentScrollFrame(deferDraw) {
        if (this.visible && this.scrollingParent) {
            // Adjust position of the LV header (might need to be attached to the top of the scrolling element)
            this.updateParentScrollTop();
            // JH: The following was removed in order to handle header by 'position: sticky' css. Seems to be working fine, to be tested.
            // var scrollTop = this.scrollingParent.scrollTop; // We need this version of scrollTop for header, not this._parentScrollTop
            // if (scrollTop > this._containerOffsetTop && scrollTop < this._containerOffsetTop + this._containerOffsetHeight)
            //     this.header.style.top = scrollTop - this._containerOffsetTop;
            // else
            //     this.header.style.top = 0;
            this.updateHover();
            if (deferDraw)
                this.deferredDraw();
            else
                this.drawnow();
        }
    }
    selectAll() {
        let handled = false;
        let ds = this.dataSource;
        if (this.multiselect && ds && ds.selectRangeAsync) {
            ds.selectRangeAsync(0, ds.count - 1);
            handled = true;
        }
        return handled;
    }
    cancelSelection() {
        let handled = false;
        let ds = this.dataSource;
        if (ds && ds.clearSelection) {
            ds.clearSelection();
            this.selectionMode = false;
            handled = true;
        }
        return handled;
    }
    setStatus(data) {
        if (this.multiselect && data) {
            if (!data.selectedCount)
                this.selectionMode = false;
            else if (this.automaticSelectionMode && (data.selectedCount > 1))
                this.selectionMode = true;
        }
        super.setStatus(data);
    }
    // ---------------- Popup handling -----------------------
    getSkip(id, canAdd) {
        for (let i = 0; i < this.skips.length; i++) {
            let skip = this.skips[i];
            if (skip.id === id)
                return skip;
        }
        if (canAdd) {
            // @ts-ignore
            let skip = {
                id: id,
                reservePx: 0
            };
            this.skips.push(skip);
            return skip;
        }
    }
    removeSkip(id) {
        for (let i = 0; i < this.skips.length; i++) {
            let skip = this.skips[i];
            if (skip.id === id) {
                this.skips.splice(i, 1);
                return skip;
            }
        }
    }
    animatePopup(skip, counter) {
        if (skip.animation)
            clearTimeout(skip.animation);
        let startPx = (skip.hide && skip.mix ? skip.oldReservePx : skip.reservePx);
        let endPx = (skip.hide ? (skip.targetPx || 0) : this.getPopupHeight(this.popupDiv));
        skip.targetPx = endPx;
        let startOpacity = (skip.opacity || 0);
        let animstart = performance.now();
        let animTime = (skip.animate ? 1000 * animTools.animationTime : 0);
        if (fullLVDebug)
            ODS('***Animate: ' + startPx + ' -> ' + endPx);
        let myanimation = () => {
            if (this._cleanUpCalled || skip.cancelAnimation)
                return;
            let duration = performance.now() - animstart;
            let oldPx = skip.reservePx;
            let newPx = startPx;
            if (duration >= animTime || counter != this.popupCounter) {
                // End animation
                newPx = endPx;
                skip.opacity = 1;
                skip.div.style.opacity = 1;
                skip.targetPx = undefined;
                if (!skip.hide && this.popupIndicator)
                    this.popupIndicator.style.opacity = 1;
                if (skip.hide)
                    this.cleanPopup(skip);
            }
            else {
                // Animation step
                let progress = animTools.easingFn[animTools.defaultEasing](duration / animTime);
                newPx = startPx + Math.round((endPx - startPx) * progress);
                skip.opacity = startOpacity + (1 - startOpacity) * Math.min(1, Math.pow(duration / (animTime * 0.5 /*faster blending looks better*/), 0.33));
                if (!skip.hide) {
                    if (this.popupIndicator)
                        this.popupIndicator.style.opacity = skip.opacity;
                    if (skip.mix)
                        skip.div.style.opacity = skip.opacity;
                }
                skip.animation = this.requestTimeout(myanimation, 15); // TODO: Better mix with our usage of rAF()?
            }
            if (!skip.hide || !skip.mix) {
                skip.reservePx = newPx;
                if (skip.adjustScroll) {
                    this.adjustScroll(skip.reservePx - oldPx);
                }
            }
            skip.div.style.height = newPx;
            notifyLayoutChangeDown(skip.div);
            this._adjustSizeNeeded = true;
            this.deferredDraw();
        };
        myanimation();
    }
    updatePopupRequest(div, defer, scrollToView) {
        let _this = this;
        this.requestTimeout(function () {
            _this.updatePopup(div.counter, scrollToView);
        }, defer ? 25 : 0, 'updatePopup' + scrollToView, false /* prefer last request with the same scrollToView value */);
    }
    getPopupHeight(popupDiv) {
        return popupDiv.targetOffsetHeight ? popupDiv.targetOffsetHeight : popupDiv.offsetHeight;
    }
    updatePopup(counter, scrollToView) {
        if (counter != this.popupCounter) {
            return; // An old request, ignore
        }
        let skip = this.getSkip('popup');
        if (!skip) {
            return;
        }
        if (!skip.hide) {
            if (!scrollToView && (scrollToView !== undefined) && (skip.targetPx === this.getPopupHeight(this.popupDiv))) {
                return; // Ignore update in case we already animate to the same dimensions
            }
            skip.rendered = true;
            let top = this.getItemTopOffset(skip.afterIndex);
            let oldskip = this.getSkip('oldpopup');
            let aboveShift = 0;
            if (oldskip) {
                let oldtop = this.getItemTopOffset(oldskip.afterIndex);
                if (oldtop < top) {
                    oldskip.adjustScroll = true; // Move scroll together with hiding this popup
                    //                aboveShift = -oldskip.reservePx; // JH: This was wrong, it seems that we don't need 'aboveShift' at all?
                } // else 
                // JH: TODO: Fix animation when a popup near end of a list is shown (isn't placed correctly now)
                //                if (oldtop > top) {
                //                    aboveShift = Math.max(0, oldskip.reservePx - (this.viewportSize - this.getScrollBottom()));
                //                    if (aboveShift>0)
                //                        oldskip.adjustScroll = true; // Move scroll together with hiding this popup
                //                }
                //ODS('--- update popup, top='+top+', oldtop='+oldtop);
            }
            if (scrollToView || (scrollToView === undefined)) {
                if (oldskip && oldskip.adjustScroll) {
                    this.requestTimeout(() => {
                        top = this.getItemTopOffset(skip.afterIndex);
                        this.scrollToView(top, top + this.rowDimension + this.getPopupHeight(this.popupDiv), aboveShift);
                    }, 1000 * animTools.animationTime, 'updatePopup');
                }
                else {
                    this.scrollToView(top, top + this.rowDimension + this.getPopupHeight(this.popupDiv), aboveShift);
                }
            }
            if (oldskip) {
                if (oldskip.mix)
                    oldskip.targetPx = this.popupDiv.offsetHeight;
                this.animatePopup(oldskip, this.popupCounter);
            }
            skip.shown = true;
        }
        notifyLayoutChangeDown(this.popupDiv); // Make sure it's properly rendered
        this.animatePopup(skip, this.popupCounter);
    }
    cleanPopup(skip) {
        if (skip) {
            this.removeSkip(skip.id);
            if (!skip.cloned)
                this.cancelOldPopup();
            this.popupCache.push(skip.div);
            skip.div.style.top = '-999999px'; // To hide it
            setVisibilityFast(skip.div, false); // need to hide from DOM to avoid TABs to invisible elements
            if (skip.id === 'popup')
                this.popupDiv = undefined;
        }
    }
    isPopupShown() {
        let skip = this.getSkip('popup');
        return (skip !== undefined) && !skip.hide;
    }
    closePopup() {
        let skip = this.getSkip('popup');
        if (skip) {
            this.showPopup(skip.afterIndex); // Close already shown pop-up
        }
    }
    closePopupFast() {
        let skip = this.getSkip('popup');
        if (skip) {
            this.showPopup(skip.afterIndex, true); // Close already shown pop-up, close fast, do not animate
        }
    }
    cancelOldPopup() {
        if (this.popupDiv) {
            if (this.popupDiv.controlClass)
                this.popupDiv.controlClass.cleanUpPromises();
        }
    }
    showPopup(index, isFast) {
        if (!this.popupSupport || !this.dataSource)
            return;
        let _this = this;
        let skip = this.getSkip('popup', true);
        skip.hide = false;
        skip.mix = false;
        skip.animate = !isFast;
        if (skip.div) {
            if (skip.afterIndex == index) {
                // Hide this already shown item
                skip.hide = true;
                //ODS('--- popup hide');
                this.updatePopup(this.popupCounter);
                return;
            }
            else {
                let topold = this.getItemTopOffset(skip.afterIndex);
                let topnew = this.getItemTopOffset(index);
                // Remove any old animation of a hiding popup
                let oldskip = this.getSkip('oldpopup');
                let wasold = false;
                if (oldskip) {
                    this.cleanPopup(oldskip);
                    oldskip.cancelAnimation = true;
                    wasold = true;
                }
                // Animate hiding of the old item and create a new one
                oldskip = skip;
                oldskip.cloned = true;
                oldskip.id = 'oldpopup';
                oldskip.hide = true;
                oldskip.animate = !wasold;
                oldskip.div.style.zIndex = 99; // Behind the newly showing pop-up
                this.cancelOldPopup(); // To create a new one below
                skip = this.getSkip('popup', true);
                skip.hide = false;
                skip.mix = false;
                skip.animate = true;
                if (topold == topnew) { // Just animate the transition from one pop-up to another
                    skip.reservePx = oldskip.reservePx;
                    skip.mix = true;
                    skip.animate = !wasold;
                    oldskip.oldReservePx = oldskip.reservePx;
                    oldskip.reservePx = 0;
                    oldskip.mix = true;
                }
                //ODS('--- popup mix ' + skip.mix + ', animate ' + skip.animate + ', reservePx ' + skip.reservePx);
            }
        }
        if (!skip.div) {
            // eslint-disable-next-line no-cond-assign
            if (skip.div = this.popupCache.pop()) {
                this.popupDiv = skip.div.firstChild;
                setVisibilityFast(skip.div, true);
            }
            else {
                skip.div = document.createElement('div');
                skip.div.style.overflow = 'hidden';
                skip.div.style.position = 'absolute';
                skip.div.className = 'lvPopupContainer';
                skip.div.controlClass = new Control(skip.div);
                this.addItemToCanvas(skip.div);
                this.popupDiv = document.createElement('div');
                this.popupDiv.parentListView = this;
                this.popupDiv.className = 'lvPopup';
                this.popupDiv.style.position = 'absolute';
                this.popupDiv.style.left = '0';
                this.popupDiv.style.top = '0';
                this.popupDiv.style.right = '0';
                skip.div.appendChild(this.popupDiv);
                let popupCloseBtn = document.createElement('div');
                popupCloseBtn.className = 'hoverHeader closeButton';
                popupCloseBtn.setAttribute('data-tip', _('Close popup'));
                loadIconFast('close', function (icon) {
                    if (popupCloseBtn && this.popupDiv && !window._cleanupCalled) // not cleared yet
                        setIconFast(popupCloseBtn, icon);
                    setIconAriaLabel(popupCloseBtn, _('Close popup'));
                }.bind(this));
                skip.div.controlClass.localListen(popupCloseBtn, 'click', function (e) {
                    this.closePopup();
                    e.stopPropagation();
                }.bind(this));
                skip.div.appendChild(popupCloseBtn);
            }
            skip.div.style.height = '0px'; // Initial size
            skip.div.style.zIndex = 100;
            skip.div.style.width = (this.getVisibleColsDim() - this.colGroupDimension) + 'px';
        }
        let currItem;
        this._dataSource.locked(function () {
            currItem = _this.dataSource.getValue(index); // do not use fast object, so popup can hold reference to this item
            if (currItem)
                _this.popupDiv.itemID = currItem.persistentID;
        });
        if (currItem) {
            skip.afterIndex = index;
            this.popupDiv.itemIndex = index;
            this.popupCounter = (this.popupCounter + 1) || 0;
            this.popupDiv.counter = this.popupCounter;
            if (this.renderPopup(this.popupDiv, currItem)) {
                this.updatePopup(this.popupCounter);
            }
            else {
                // Async update of pop-up dimensions
                this.updatePopupRequest(this.popupDiv, true /*defer*/);
            }
        }
    }
    popupDataSource() {
        if (this.isPopupShown() && this.popupDiv && this.popupDiv.controlClass) { // @ts-ignore            
            if (this.popupDiv.controlClass.getMergedTracklist) // @ts-ignore
                return this.popupDiv.controlClass.getMergedTracklist(); // @ts-ignore
            if (this.popupDiv.controlClass._getTracklist) // @ts-ignore
                return this.popupDiv.controlClass._getTracklist();
        }
        return null;
    }
    reloadSettings() {
        let sett = settings.get('Appearance,Options');
        this.smoothScroll = true; // sett.Appearance.SmoothScroll; // #20772
        this.gridPopupDelay = sett.Options.GridPopupDelay;
    }
    moveFocusRight( /*editable?: boolean*/) {
        if (this.itemCount > 1) {
            let newFocus;
            if (this.focusedIndex < 0)
                newFocus = 0;
            else
                newFocus = Math.min(this.focusedIndex + 1, this.itemCount - 1);
            this.focusedIndex = newFocus;
            return true;
        }
        else
            return false;
    }
    moveFocusLeft( /*editable?: boolean*/) {
        if (this.itemCount > 1) {
            let newFocus;
            if (this.focusedIndex < 0)
                newFocus = 0;
            else
                newFocus = Math.max(this.focusedIndex - 1, 0);
            this.focusedIndex = newFocus;
            return true;
        }
        else
            return false;
    }
    // Draw pop-up interior
    renderPopup(div, item, scrollToView) {
        return false; // overriden in descendants
    }
    get scrollingParent() {
        // LS: note that scrollingParent can be changed when control is re-used from controlCache and gets another scroll parent
        //     keep in mind that scrollingParent doesn't always have controlClass, it can be any DIV with 'scrollable' class (or a Scroller component with controlClass)
        if (!this._scrollingParent || !isChildOf(this._scrollingParent, this.container)) {
            this._scrollingParent = undefined;
            let ctrl = this.container;
            while ((ctrl = ctrl.parentNode) && (ctrl instanceof Element)) { // We need DOM hierarchy, not offsetParent
                let style = getComputedStyle(ctrl);
                if ((ctrl.classList.contains('listview')) || (ctrl.classList.contains('dynroot')) ||
                    style.overflowX === 'auto' || style.overflowX === 'scroll' || style.overflowY === 'auto' || style.overflowY === 'scroll') {
                    // JH: For some reason the condition above is fullfilled even if we set all divs to overflow: hidden. They are still calculated as 'auto', not sure why.
                    if (ctrl.classList.contains('lvCanvas'))
                        continue; // Ignore scrolling canvas of a listview - use the listview itself
                    this._scrollingParent = ctrl;
                    this.header.style.zIndex = 10000; // So that scrolling header can be kept before other elements
                    // Listen to scroll event and make sure we are properly unlistened later                        
                    this.localListen(ctrl, 'scroll', function (e) {
                        // LV needs to redraw in case its position is changed (new content might be visible)
                        this.parentScrollFrame(true);
                    }.bind(this));
                    break;
                }
            }
            if (!this._scrollingParent) {
                if (this.dynamicSize)
                    this.container.classList.remove('showInline');
                this._scrollingParent = this.container.offsetParent; // Our direct parent will work for our purposes.
            }
            else {
                if (this.dynamicSize)
                    this.container.classList.add('showInline');
            }
        }
        return this._scrollingParent;
    }
    get oneRow() {
        return this._oneRow;
    }
    set oneRow(value) {
        if (value) {
            this.showRowCount = 1;
        }
        else {
            this.showRowCount = 0;
        }
        if (this._oneRow != value) {
            this.container.classList.toggle('onerow', value);
            if (this.showRowCount === 1) {
                // close popup during cropping to avoid #20787
                this.closePopupFast();
            }
            this.oldWidth = -1;
            this.oldHeight = -1;
            this.adjustSize(false);
            this.invalidateAll();
        }
        this._oneRow = value;
    }
    get dynamicSize() {
        return this._dynamicSize;
    }
    set dynamicSize(value) {
        if (value) {
            this.fill.classList.remove('fill');
            this.canvas.style.height = '';
            this.canvas.style.width = '';
        }
        else {
            this.fill.classList.add('fill');
            this.canvas.style.height = '100%';
            this.canvas.style.width = '100%';
        }
        this._dynamicSize = value;
    }
    get multiselect() {
        return this._multiselect;
    }
    set multiselect(value) {
        if (this._multiselect === value)
            return;
        this._multiselect = value;
        // have to regenerate divs and recompile binding, it could be dependent on multiselect value, #14522
        this.clearDivs();
        this.bindFn = undefined;
        this.invalidateNeeded = true;
    }
    get enableIncrementalSearch() {
        if (this._incrementalSearchEnabled != null) {
            return this._incrementalSearchEnabled;
        }
        else {
            // wasn't enabled/disabled for this component, so take the value from settings
            let state = app.getValue('search_settings', {
                contextualSearchMode: 0
            });
            return (state.contextualSearchMode == 1);
        }
    }
    set enableIncrementalSearch(value) {
        this._incrementalSearchEnabled = value;
    }
}
registerClass(ListView);
