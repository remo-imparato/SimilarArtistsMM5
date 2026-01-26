/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

registerFileImport('controls/scroller');
import { DOM_DELTA_LINE, DOM_DELTA_PAGE } from '../consts';
/**
@module UI controls
*/
import Control from './control';
/**
Scroller - a generic scrolling control, that's mainly supposed to host 1 or more listviews, that are virtualized (i.e. can handle even millions of items).

@class Scroller
@constructor
@extends Control
*/
class Scroller extends Control {
    initialize(elem, params) {
        super.initialize(elem, params);
        this.enableDragNDrop();
        this.contextMenu = []; // LS: for the context menu forwarding below to work (#15884)
        this.reloadSettings(); // set smooth/animated scroll
        this.smoothScrollTimeLimit = (app.utils.system() === 'macos') ? 0 : (1000 * animTools.animationTime * 1.02) /* a reserve in order to finish scrolling after e.g. pop-up animation starts */; // ms
        this.scrolled = false;
        this.lassoParentElementScroller = true;
        this.container.classList.add('scrollable');
        this.registerEventHandler('wheel');
        this.registerEventHandler('keydown');
        this.registerEventHandler('mousedown');
        this.registerEventHandler('mouseup');
        this.localListen(app, 'settingschange', function () {
            this.reloadSettings();
        }.bind(this));
        this.localListen(document.body, 'keydown', (e) => {
            let key = friendlyKeyName(e);
            if (key == 'Space') {
                // ignore scrolling on space (#15917)
                this._ignoreScroll = true;
                this.requestTimeout(() => {
                    this._ignoreScroll = false;
                }, 500);
                let focusedElement = document.activeElement;
                if (focusedElement && ((focusedElement.nodeName == 'INPUT') || (focusedElement.nodeName == 'TEXTAREA') || (focusedElement.hasAttribute('contenteditable')))) {
                    // editing - we cannot prevent default for spacebar (#16185)
                }
                else {
                    // not editing - prevent default to ignore scrolling on space (#15917)
                    e.preventDefault();
                }
            }
        });
        this.localListen(this.container, 'scroll', function (evt) {
            if (evt.target == this.container && !this._ignoreScroll) {
                this.scrolled = true;
                this.notifyChildren(true /* to make deferred draw, otherwise freeze can happen - #16794 */);
            }
        }.bind(this));
    }
    reloadSettings() {
        //let sett = settings.get('Appearance');
        this.smoothScroll = true; // sett.Appearance.SmoothScroll; // per #20772
    }
    handle_mouseup(e) {
        if (this._nearestLV && this._nearestLV.controlClass && this._nearestLV.controlClass.lassoSelectionEnabled) {
            this._nearestLV.controlClass._cleanUpLasso();
        }
        this._nearestLV = null;
    }
    handle_mousedown(e) {
        this._nearestLV = this.getFirstUp(e.offsetY, this.container.offsetHeight, true /* allow empty LVs */);
        if (this._nearestLV && this._nearestLV.controlClass && this._nearestLV.controlClass.lassoSelectionEnabled) {
            this._nearestLV.controlClass.handleLassoStart(null, e);
        }
    }
    handle_wheel(e) {
        window.notifyCloseDropdownLists(); // #17514
        if (e.deltaY !== 0 && !e.shiftKey /* #16406 - item 4 */) {
            if (e.stopPropagation)
                e.stopPropagation();
            // e.preventDefault() cannot be here, it would block standard scrolling by wheel, #17203
            let delta = e.deltaY;
            if (e.deltaMode === DOM_DELTA_LINE) {
                delta *= fontLineSizePx();
            }
            else if (e.deltaMode === DOM_DELTA_PAGE) {
                delta *= this.container.clientHeight;
            }
            this.setSmoothScrollOffset(this.getScrollOffset() + delta);
        }
    }
    getScrollOffset() {
        if (!this.disableLastControlEnlarge)
            this._checkLastControlEnlarged(); // #17763 + #17599
        if (!this.scrolled)
            return 0;
        if (this.smoothScrollTarget >= 0)
            return this.smoothScrollTarget;
        else
            return this.container.scrollTop;
    }
    getSmoothScrollOffset() {
        let scrollTop = this.getScrollOffset();
        if (this.smoothScrollOrigin >= 0) {
            let newTime = window.performance.now();
            if (newTime - this.smoothScrollTime >= this.smoothScrollTimeLimit) {
                let res = this.smoothScrollTarget;
                this.setScrollOffset(res);
                this.smoothScrollOrigin = -1;
                this.smoothScrollTarget = -1;
                return res;
            }
            else
                return this.smoothScrollOrigin + Math.round((scrollTop - this.smoothScrollOrigin) * Math.pow((newTime - this.smoothScrollTime) / this.smoothScrollTimeLimit, 0.6));
        }
        else
            return scrollTop;
    }
    notifyChildren(deferred) {
        let ctrls = qes(this.container, '[data-control-class]');
        for (let i = 0; i < ctrls.length; i++) {
            let el = ctrls[i];
            if (el.controlClass && el.controlClass.parentScrollFrame)
                el.controlClass.parentScrollFrame(deferred);
        }
    }
    handleSmoothScroll() {
        let scrollFn = function () {
            this.container.scrollTop = this.getSmoothScrollOffset();
            if (this.smoothScrollOrigin >= 0)
                this.requestFrame(scrollFn.bind(this), 'scrollFn');
            else
                this.frameQueued = false;
            this.notifyChildren(); // to prevent incorrect listview header movement during scrolling
        };
        if (!this.frameQueued) {
            this.frameQueued = true;
            this.requestFrame(scrollFn.bind(this), 'scrollFn');
        }
    }
    setSmoothScrollOffset(newValue, canScrollBeyond /*To allow scrolling lower than is the current viewport height*/) {
        if (isNaN(newValue))
            return;
        let _newValue = Math.max(canScrollBeyond ? newValue : Math.min(newValue, this.container.scrollHeight - this.container.clientHeight), 0);
        if (this.smoothScroll) {
            this.scrolled = true;
            this.smoothScrollOrigin = this.getSmoothScrollOffset();
            this.smoothScrollTime = window.performance.now();
            this.smoothScrollTarget = _newValue;
            this.handleSmoothScroll();
        }
        else {
            this.setScrollOffset(newValue);
        }
    }
    setScrollOffset(newValue) {
        if (isNaN(newValue))
            return;
        this.container.scrollTop = newValue;
        this.scrolled = true;
    }
    focusFirstDown(fromPoint, maxLen, allowEmpty) {
        let ctrls = qes(this.container, '[data-control-class]');
        let bestctrl = undefined;
        let bestmatch = Number.MAX_SAFE_INTEGER;
        forEach(ctrls, function (ctrl) {
            if (!ctrl.controlClass || !ctrl.controlClass.visible || !(ctrl.tabIndex >= 0) || (ctrl.controlClass.itemCount == 0 && !allowEmpty) /*empty listview*/)
                return;
            if (fromPoint <= ctrl.offsetTop && ctrl.offsetTop < bestmatch) {
                bestmatch = ctrl.offsetTop;
                bestctrl = ctrl;
            }
        });
        if (bestctrl && bestctrl.offsetTop < fromPoint + maxLen) {
            // De-focus the old element
            let el = document.activeElement;
            if (el) {
                let ctrl = elementControl(el);
                if (ctrl && ctrl.setFocusedAndSelectedIndex)
                    ctrl.setFocusedAndSelectedIndex(-1);
            }
            // Focus the newly found control
            bestctrl.focus({
                preventScroll: true
            });
            if (bestctrl.controlClass.setFocusedAndSelectedIndex)
                bestctrl.controlClass.setFocusedAndSelectedIndex(0);
            return true;
        }
        return false;
    }
    getFirstUp(fromPoint, maxLen, allowEmpty) {
        let ctrls = qes(this.container, '[data-control-class]');
        let bestctrl = undefined;
        let bestmatch = -1;
        forEach(ctrls, function (ctrl) {
            if (!ctrl.controlClass || !ctrl.controlClass.visible || !(ctrl.tabIndex >= 0) || (ctrl.controlClass.itemCount == 0 && !allowEmpty) /*empty listview*/)
                return;
            let bottom = ctrl.offsetTop + ctrl.offsetHeight;
            if (bottom <= fromPoint && bottom > bestmatch) {
                bestmatch = bottom;
                bestctrl = ctrl;
            }
        });
        if (bestctrl && bestctrl.offsetTop + bestctrl.offsetHeight >= fromPoint - maxLen) {
            return bestctrl;
        }
        return null;
    }
    focusFirstUp(fromPoint, maxLen, allowEmpty) {
        let bestctrl = this.getFirstUp(fromPoint, maxLen, allowEmpty);
        if (bestctrl) {
            // De-focus the old element
            let el = document.activeElement;
            if (el) {
                let ctrl = elementControl(el);
                if (ctrl && ctrl.setFocusedAndSelectedIndex)
                    ctrl.setFocusedAndSelectedIndex(-1);
            }
            // Focus the newly found control
            bestctrl.focus({
                preventScroll: true
            });
            let bestctrlCC = bestctrl.controlClass;
            if (bestctrlCC.setFocusedAndSelectedIndex) {
                if (bestctrlCC.showRowCount > 0) {
                    bestctrlCC.setFocusedAndSelectedIndex(Math.min(bestctrlCC.showRowCount * bestctrlCC.itemsPerRow - bestctrlCC.itemsPerRow, bestctrlCC.itemCount - bestctrlCC.itemsPerRow));
                }
                else {
                    if (bestctrlCC.isGrid) {
                        // select first in the last row
                        let rows = Math.ceil(bestctrlCC.itemCount / bestctrlCC.itemsPerRow);
                        if (rows > 0)
                            bestctrlCC.setFocusedAndSelectedIndex(0 + (rows - 1) * bestctrlCC.itemsPerRow);
                    }
                    else {
                        bestctrlCC.setFocusedAndSelectedIndex(bestctrlCC.itemCount - 1);
                    }
                }
            }
            return true;
        }
        return false;
    }
    handle_keydown(e) {
        let focusedElement = document.activeElement;
        if (focusedElement && ((focusedElement.nodeName == 'INPUT') || (focusedElement.hasAttribute('contenteditable'))))
            return; // #17553
        let handled = false;
        switch (friendlyKeyName(e)) {
            case 'Home':
                this.focusFirstDown(0, this.container.offsetHeight);
                this.setSmoothScrollOffset(0);
                handled = true;
                break;
            case 'End':
                this.focusFirstUp(this.container.scrollHeight, this.container.offsetHeight);
                this.setSmoothScrollOffset(this.container.scrollHeight);
                handled = true;
                break;
            case 'Up':
                {
                    let el = document.activeElement;
                    if (!el)
                        break;
                    //let bottom = el.offsetTop + el.offsetHeight;
                    handled = this.focusFirstUp(el.offsetTop, el.offsetTop - this.container.scrollTop);
                }
                break;
            case 'Down':
                {
                    let el = document.activeElement;
                    if (!el)
                        break;
                    let bottom = el.offsetTop + el.offsetHeight;
                    handled = this.focusFirstDown(bottom, this.container.scrollTop + this.container.offsetHeight - bottom);
                }
                break;
        }
        if (handled) {
            e.stopPropagation();
            e.preventDefault();
        }
    }
    handle_layoutchange(evt) {
        if (this._initialScrollTop !== undefined) {
            if (this.container.scrollTop > 0) { // was already manually scrolled, do not change
                this._initialScrollTop = undefined;
            }
            else if (this._initialScrollTop <= (this.container.scrollHeight - this.container.clientHeight)) {
                // we already have sufficient height of the main control, scroll to initial position
                this.setScrollOffset(this._initialScrollTop);
                this._initialScrollTop = undefined;
                this.notifyChildren();
            }
            if (this._initialScrollTop === undefined) {
                // unregister layoutchange event, no longer needed
                this.unregisterEventHandler('layoutchange');
            }
        }
        super.handle_layoutchange(evt);
    }
    _getLastControl() {
        let lastCtrl;
        let ctrl = this.container.firstElementChild;
        while (ctrl) {
            if (isVisible(ctrl)) {
                lastCtrl = ctrl;
            }
            ctrl = ctrl.nextElementSibling;
        }
        return lastCtrl;
    }
    _resetLastControlMinHeight(lastCtrl) {
        //ODS('Scroller._resetLastControlMinHeight: ' + lastCtrl._origMinHeight);
        if (lastCtrl._origMinHeight)
            lastCtrl.style.minHeight = lastCtrl._origMinHeight;
        else
            lastCtrl.style.minHeight = '1px'; // LS: zero does not work here, why? issue #19725
        this.container.style.minHeight = lastCtrl.style.minHeight;
        if (lastCtrl.controlClass && lastCtrl.controlClass.setMinHeight)
            lastCtrl.controlClass.setMinHeight(lastCtrl.style.minHeight);
    }
    _checkLastControlEnlarged() {
        if (this._lastClientHeight != this.container.clientHeight) {
            this._lastClientHeight = this.container.clientHeight;
            let _lastCtrl = this._getLastControl();
            if (_lastCtrl)
                this._resetLastControlMinHeight(_lastCtrl);
        }
        this.requestTimeout(() => {
            // LS: at first reset the min-height (to be able to change size by splitters -- issue #19725)        
            let _lastCtrl = this._getLastControl();
            if (_lastCtrl)
                this._resetLastControlMinHeight(_lastCtrl);
            let totHeight = 0;
            let totHeightExceptLastControl = 0;
            let lastCtrl;
            let ctrl = this.container.firstElementChild;
            while (ctrl) {
                if (isVisible(ctrl)) {
                    lastCtrl = ctrl;
                    totHeight += ctrl.offsetHeight;
                    if (ctrl.nextElementSibling)
                        totHeightExceptLastControl += ctrl.offsetHeight;
                }
                ctrl = ctrl.nextElementSibling;
            }
            if (lastCtrl) {
                let scrollerHeight = this.container.clientHeight;
                ODS('Scroller._checkLastControlEnlarged: ' + totHeight + '/' + scrollerHeight);
                if (scrollerHeight >= totHeight) {
                    // enlarge the last control to take up all the remaining space (#17763 / #17599)
                    if (lastCtrl._origMinHeight == undefined)
                        lastCtrl._origMinHeight = lastCtrl.style.minHeight || 0;
                    lastCtrl.style.minHeight = (scrollerHeight - totHeightExceptLastControl) - 7 - getOuterHeight(lastCtrl);
                    if (lastCtrl.controlClass && lastCtrl.controlClass.setMinHeight)
                        lastCtrl.controlClass.setMinHeight(lastCtrl.style.minHeight);
                }
                else {
                    this._resetLastControlMinHeight(lastCtrl);
                    lastCtrl._origMinHeight = undefined;
                }
            }
        }, 500, '_checkLastControlEnlargedTm');
    }
    _forward(e, action, forContextMenu) {
        let _this = this;
        let getParentClass = function (ctrl) {
            while (ctrl && ctrl.parentNode) {
                ctrl = ctrl.parentNode;
                if (ctrl && ctrl.controlClass && ctrl.parentNode == _this.container) {
                    return ctrl;
                }
            }
        };
        let ctrl = getParentClass(e.target);
        if (!ctrl) {
            // it is drop to the "empty" area of this scroller
            // find the last usable control for the drop
            ctrl = this.container.firstChild;
            let lastCtrl;
            while (ctrl) {
                if (ctrl.controlClass && ctrl.controlClass.dndEventsRegistered)
                    lastCtrl = ctrl;
                ctrl = ctrl.nextSibling;
            }
            ctrl = lastCtrl;
        }
        if (ctrl) {
            let cls = ctrl.controlClass;
            if (cls.dndEventsRegistered && cls[action]) {
                if (forContextMenu) {
                    if (cls.cancelSelection)
                        cls.cancelSelection();
                    ctrl.focus();
                }
                e._target = ctrl;
                dnd.setDropTargetControl(e, ctrl); // define correct drop target (so isSameControl can be enumerated correctly)
                return cls[action].call(cls, e);
            }
        }
    }
    getDropMode(e) {
        return this._forward(e, 'getDropMode');
    }
    canDrop(e) {
        return this._forward(e, 'canDrop');
    }
    drop(e) {
        this._forward(e, 'drop');
    }
    getDraggedObject(e) {
        return this._forward(e, 'getDraggedObject');
    }
    contextMenuHandler(e) {
        if (this._forward(e, 'contextMenuHandler', true))
            e.stopPropagation();
    }
    storeState() {
        let state = super.storeState();
        state.scrollTop = this.container.scrollTop;
        return state;
    }
    restoreState(state, isJustViewModeChange) {
        super.restoreState(state, isJustViewModeChange);
        this._initialScrollTop = state.scrollTop || 0;
        this.container.scrollTop = 0; // reset to original null value, to be able to detect scroll change
        if (this._initialScrollTop > 0) {
            // register layoutchange event, so we can check, if we already can scroll to desired position
            this.registerEventHandler('layoutchange');
        }
        else
            this._initialScrollTop = undefined;
    }
}
registerClass(Scroller);
