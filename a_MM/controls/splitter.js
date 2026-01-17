/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

registerFileImport('controls/splitter');
'use strict';
import Control from './control';
const MINSIZE = 10;
/**
@module UI
*/
/**
UI element, splitter control. It must be placed in flex control.

@class Splitter
@constructor
@extends Control
*/
class Splitter extends Control {
    initialize(rootelem, params) {
        super.initialize(rootelem, params);
        rootelem.classList.add('splitter');
        this.parentElement = getParent(rootelem);
        this._wasvisible = isVisible(rootelem, false);
        this._resized = false;
        this._siblingsVisibilityChanged = false;
        this.sortSiblingsByOrder = params ? (!!params.sortSiblingsByOrder) : false;
        this._needsFullRecalculation = true;
        if (!this.parentElement) {
            assert(false, 'Splitter must have parent control!');
            return;
        }
        if (this.parentElement.classList.contains('column'))
            this.isVertical = true;
        else
            this.isVertical = false;
        if (this.parentElement.controlClass)
            this.parentElement.controlClass.hasSplitters = true;
        let analyzeSiblings = function (force, initStartValues) {
            this._siblingsVisibilityChanged = false; // reset, it will be recomputed later
            let dorecalc = !!force;
            let parentElement = this.parentElement;
            let children = Array.from(parentElement.children);
            // sort nodes by display position
            if (this.sortSiblingsByOrder) { // @ts-ignore
                children.sort((ch1, ch2) => (ch1.style.order - ch2.style.order));
            }
            let ch, s;
            let vis;
            if (initStartValues || !this._siblings) {
                dorecalc = true;
            }
            if (!this._allSiblings || (this._allSiblings.length !== children.length)) {
                dorecalc = true;
                this._siblingsVisibilityChanged = true;
            }
            if (!dorecalc || !this._siblingsVisibilityChanged) {
                // check visibility and presence of siblings
                for (let i = 0; i < children.length; i++) {
                    ch = children[i];
                    s = this._allSiblings[i];
                    if (s.div !== ch) { // some sibling changed
                        dorecalc = true;
                        this._siblingsVisibilityChanged = true;
                        break;
                    }
                    vis = isVisible(ch, false);
                    if (s.visible !== vis) {
                        dorecalc = true;
                        this._siblingsVisibilityChanged = true;
                        break;
                    }
                    s.visible = vis; // s.visible was never updated!
                }
            }
            if (!dorecalc && !initStartValues) {
                return;
            }
            if (dorecalc) {
                this._siblings = [];
                this._allSiblings = [];
                let isSplitter;
                for (let i = 0; i < children.length; i++) {
                    ch = children[i];
                    vis = isVisible(ch, false);
                    isSplitter = (ch.getAttribute('data-control-class') === 'Splitter');
                    this._allSiblings.push({
                        div: ch,
                        visible: vis,
                        isSplitter: isSplitter
                    });
                    if ((ch !== this.container) && !vis)
                        continue;
                    this._siblings.push({
                        div: ch,
                        isSplitter: isSplitter
                    });
                }
            }
            for (let i = 0; i < this._siblings.length; i++) {
                s = this._siblings[i];
                if (s.div === this.container) {
                    this._spIdx = i;
                    if (!(initStartValues || dorecalc))
                        break;
                }
                if ((initStartValues || dorecalc) /*&& s.visible*/) {
                    let cs;
                    if (this.isVertical) {
                        if (s.div._minHeightFromChilds && initStartValues) {
                            // s.div.style.minHeight = ''; // reset, so actual value can be computed, needed for correct minHeight computed from childs
                            s.div._minHeightFromChilds = false;
                        }
                        cs = getComputedStyle(s.div); // @ts-ignore
                        s.minHeight = Math.max(getMinHeight(s.div, cs), MINSIZE);
                        if (parseFloat(cs.minHeight) !== s.minHeight) {
                            s.minHeightFromChilds = true;
                        }
                        else
                            s.minHeightFromChilds = false;
                        s.originalSize = parseFloat(cs.height);
                    }
                    else {
                        if (s.div._minWidthFromChilds && initStartValues) {
                            // s.div.style.minWidth = ''; // reset, so actual value can be computed, needed for correct minWidth computed from childs
                            s.div._minWidthFromChilds = false;
                        }
                        cs = getComputedStyle(s.div); // @ts-ignore
                        s.minWidth = Math.max(getMinWidth(s.div, cs), MINSIZE);
                        if (parseFloat(cs.minWidth) !== s.minWidth) {
                            s.minWidthFromChilds = true;
                        }
                        else
                            s.minWidthFromChilds = false;
                        s.originalSize = parseFloat(cs.width);
                    }
                    s.flexGrow = cs.flexGrow;
                    s.isDynamic = (s.flexGrow !== '0') && (!s.div.classList.contains('onlyStaticVisible')); // onlyVisible is always dynamic, do not count with it, it would make dynamic from static divs
                    s.flexShrink = cs.flexShrink;
                    //ODS('--- prepare flexGrow of ' + s.div.getAttribute('data-id') + ', originalSize=' + (s.originalSize) + ', flexGrow=' + s.div.style.flexGrow + ', sFlexGrow=' + s.flexGrow);
                }
            }
            if ((this._spIdx <= 0) || (this._spIdx === (this._siblings.length - 1))) {
                return;
            }
            if (initStartValues) {
                for (let i = 0; i < this._siblings.length; i++) {
                    s = this._siblings[i];
                    if (s.isDynamic) {
                        //ODS('--- initial set flexGrow of ' + s.div.getAttribute('data-id') + ', originalSize=' + (s.originalSize || 1) + ', flexGrow=' + s.div.style.flexGrow + ', sFlexGrow=' + s.flexGrow);
                        s.div.style.flexGrow = s.originalSize || s.div.style.flexGrow || 1; // to avoid changing to static by 0
                        if (this.isVertical) {
                            s.div.style.height = '0px'; // will suppress unknown default min size in flex and subsequent wrong calculation
                            if (s.minHeightFromChilds) {
                                s.div.style.minHeight = s.minHeight + 'px';
                                s.div._minHeightFromChilds = true;
                            }
                        }
                        else {
                            s.div.style.width = '0px';
                            if (s.minWidthFromChilds) {
                                s.div.style.minWidth = s.minWidth + 'px';
                                s.div._minWidthFromChilds = true;
                            }
                        }
                    }
                }
            }
            let s1 = this._siblings[this._spIdx - 1];
            let s2 = this._siblings[this._spIdx + 1];
        }.bind(this);
        this.lastWindowState = undefined;
        this.localListen(thisWindow, 'visibilitychanged', function (min, vis, state, restoring) {
            let callLayoutChanged = (this.lastWindowState === undefined);
            this.lastWindowState = state;
            //            ODS('--- visibilitychanged ' + this.uniqueID + ': ' + min + ', ' + vis + ', ' + state + ', ' + restoring);
            if (restoring) {
                this._lastRestoreTime = Date.now();
            }
            if (callLayoutChanged)
                this.requestFrame(this._layoutChangedHandler, 'layoutChangeDelayed');
        }.bind(this));
        this.localListen(window.settings.observer, 'change', () => {
            if (isVisible(this.container, true))
                setVisibilityFast(this.container, !window.settings.UI.disableRepositioning); // #20886
        });
        this._layoutChangedHandler = function (evt) {
            queryLayoutAfterFrame(() => {
                if (!document.body.contains(this.container)) {
                    // After delaying the layout change handler in a frame, 
                    //  the splitter's container might have been removed from the DOM tree.
                    return;
                }
                if (window.fullWindowModeActive) // do not update splitters in fullWindow mode, they are hidden, #20498
                    return;
                if (isVisible(this.container, true))
                    setVisibilityFast(this.container, !window.settings.UI.disableRepositioning); // #20886
                if (this._resizing || (this.lastWindowState === 1) || thisWindow.minimized ||
                    (evt && evt.detail.uniqueLayoutChangeID && this._lastLayoutChangeID == evt.detail.uniqueLayoutChangeID) ||
                    ((this.lastWindowState === undefined) && evt && (!window.settings.readyTime || ((Date.now() - window.settings.readyTime) < 2000)))) { // wait 2 seconds after main window's ready, to avoid unneeded size changes
                    return;
                }
                if (evt && evt.detail.uniqueLayoutChangeID)
                    this._lastLayoutChangeID = evt.detail.uniqueLayoutChangeID;
                let szProp = (this.isVertical) ? 'offsetHeight' : 'offsetWidth';
                let newParentSize = this.parentElement[szProp]; // JL: Save parentSize so it doesn't have to be calculated twice
                analyzeSiblings(this._needsFullRecalculation, (this.lastParentSize > newParentSize)); // force it, so we will have actual state, do complete recompute in case parent size is smaller, so we can resize later if needed correctly
                let vis = false;
                if ((this._spIdx > 0) && (this._spIdx < (this._siblings.length - 1))) {
                    let s1 = this._siblings[this._spIdx - 1];
                    let s2 = this._siblings[this._spIdx + 1];
                    vis = (s1 && s2 && !s1.isSplitter && !s2.isSplitter && isVisible(s1.div, false) && isVisible(s2.div, false));
                }
                if ((this._wasvisible !== vis) || (this._siblingsVisibilityChanged) || (this.lastParentSize !== newParentSize)) {
                    if (((this.lastParentSize > newParentSize) && ((Date.now() - this._lastRestoreTime) < 250))) {
                        // just after restoring, wait some time to avoid inner panel resizing, #15669
                        this.requestFrame(this._layoutChangedHandler, 'layoutChangeDelayed');
                        return;
                    }
                    this.lastParentSize = newParentSize;
                    this._wasvisible = vis;
                    setVisibilityFast(this.container, vis); // use fast version without layoutchange event, to avoid circular calling (#14017)
                    // check if only static are visible
                    let onlyStatic = true;
                    let i = 0;
                    let s;
                    if (!vis && !window.fullWindowModeActive) {
                        while (onlyStatic && (i < this._siblings.length)) {
                            s = this._siblings[i];
                            if (s.isDynamic) {
                                onlyStatic = false;
                            }
                            i++;
                        }
                    }
                    if (!vis && !window.fullWindowModeActive && onlyStatic) {
                        forEach(this._siblings, function (s) {
                            if (!s.isDynamic && !s.isSplitter)
                                s.div.classList.toggle('onlyStaticVisible', true);
                        });
                    }
                    else if (vis) {
                        let fullSize = 0;
                        let parentSize = this.parentElement[szProp];
                        forEach(this._siblings, function (s) {
                            if (!s.isDynamic && !s.isSplitter)
                                s.div.classList.toggle('onlyStaticVisible', false);
                        });
                        let staticElements = [];
                        forEach(this._siblings, function (s) {
                            if (!s.isSplitter) {
                                fullSize += s.div[szProp];
                                if (!s.isDynamic) {
                                    staticElements.push(s);
                                }
                            }
                            else {
                                if (s.splitterSize === undefined) {
                                    if (this.isVertical) {
                                        s.splitterSize = getFullHeight(s.div);
                                    }
                                    else {
                                        s.splitterSize = getFullWidth(s.div);
                                    }
                                }
                                fullSize += s.splitterSize;
                            }
                        }.bind(this));
                        if ((fullSize > parentSize) && (staticElements.length > 0)) {
                            // try to make static elements smaller to fit all siblings in parent
                            let i = 0;
                            let diff = fullSize - parentSize;
                            //ODS('--- resizing panel ' + this.uniqueID + ', fullSize=' + fullSize + ', parentSize=' + parentSize);
                            let possibleDiff, minProp;
                            if (this.isVertical) {
                                szProp = 'height';
                                minProp = 'minHeight';
                            }
                            else {
                                szProp = 'width';
                                minProp = 'minWidth';
                            }
                            while ((i < staticElements.length) && (diff > 0)) {
                                s = staticElements[i];
                                possibleDiff = s.originalSize - s[minProp];
                                if (possibleDiff > 0) {
                                    if (possibleDiff >= diff) {
                                        possibleDiff = diff;
                                    }
                                    s.originalSize = (s.originalSize - possibleDiff);
                                    s.div.style[szProp] = s.originalSize + 'px';
                                    diff -= possibleDiff;
                                    //ODS('--- resized panel ' + this.uniqueID + ', by ' + possibleDiff + ', new size ' + s.originalSize + 'px');
                                }
                                i++;
                            }
                        }
                    }
                }
                this._needsFullRecalculation = false;
            });
        }.bind(this);
        app.listen(this.container, 'layoutchange', this._layoutChangedHandler);
        this._mouseUpHandler = function (e) {
            if (window.settings.UI.disableRepositioning)
                return;
            e.stopPropagation();
            e.preventDefault();
            app.unlisten(window, 'mouseup', this._mouseUpHandler, true);
            app.unlisten(window, 'mousemove', this._mouseMoveHandler, true);
            document.body.style.cursor = '';
            if (this._hoverDiv) {
                document.body.removeChild(this._hoverDiv);
                this._hoverDiv = undefined;
            }
            this._resizing = false;
            this._resized = true;
            app.listen(this.container, 'layoutchange', this._layoutChangedHandler);
        }.bind(this);
        this._mouseDownHandler = function (e) {
            if (window.settings.UI.disableRepositioning)
                return;
            analyzeSiblings(true, true); // JL: Run analysis before any changes to DOM, to avoid layout recalculations
            e.stopPropagation();
            e.preventDefault();
            if (this.isVertical) {
                // JL: Changing document.body's class requires a full layout recalculation. Editing style.cursor directly does not require such.
                document.body.style.cursor = 'ns-resize';
                this._resizeStartY = e.clientY;
            }
            else {
                document.body.style.cursor = 'ew-resize';
                this._resizeStartX = e.clientX;
            }
            // add transparent div around, so we do not lose mouse pointer e.g. during hovering IFrames
            if (!this._hoverDiv) {
                this._hoverDiv = document.createElement('div');
                this._hoverDiv.className = 'fill topmost';
                document.body.appendChild(this._hoverDiv);
            }
            app.listen(window, 'mouseup', this._mouseUpHandler, true);
            app.listen(window, 'mousemove', this._mouseMoveHandler, true);
            app.unlisten(this.container, 'layoutchange', this._layoutChangedHandler);
            this._resizing = true;
        }.bind(this);
        if (this.isVertical) {
            // vertical splitter
            this._mouseMoveHandler = function (e) {
                if (!this._resizing)
                    return;
                e.stopPropagation();
                e.preventDefault();
                let diff = e.clientY - this._resizeStartY;
                if (diff === 0)
                    return;
                let objT = this._siblings[this._spIdx - 1];
                let objB = this._siblings[this._spIdx + 1];
                if (!objT || !objB)
                    return;
                let changed = false;
                if (diff > 0) {
                    // move down
                    let newHeight = objB.originalSize - diff;
                    if (newHeight < objB.minHeight) {
                        diff = objB.originalSize - objB.minHeight;
                        changed = true;
                    }
                }
                else {
                    // move up
                    let newHeight = objT.originalSize + diff;
                    if (newHeight < objT.minHeight) {
                        diff = objT.minHeight - objT.originalSize;
                        changed = true;
                    }
                }
                if ((diff === 0) && !changed)
                    return;
                let newval;
                if (objB.isDynamic) {
                    newval = (objB.originalSize - diff) || 1;
                    changed = (newval !== objB.div.style.flexGrow);
                    if (changed)
                        objB.div.style.flexGrow = newval;
                }
                else {
                    newval = (objB.originalSize - diff) + 'px';
                    changed = (newval !== objB.div.style.height);
                    if (changed)
                        objB.div.style.height = newval;
                }
                if (objT.isDynamic) {
                    newval = (objT.originalSize + diff) || 1;
                    changed = (newval !== objT.div.style.flexGrow);
                    if (changed)
                        objT.div.style.flexGrow = newval;
                }
                else {
                    newval = (objT.originalSize + diff) + 'px';
                    changed = (newval !== objT.div.style.height);
                    if (changed)
                        objT.div.style.height = newval;
                }
                if (changed) {
                    this._needsFullRecalculation = true;
                    deferredNotifyLayoutChangeDown(this.container.parentElement);
                }
            }.bind(this);
        }
        else {
            // horizontal splitter
            this._mouseMoveHandler = function (e) {
                if (!this._resizing)
                    return;
                e.stopPropagation();
                e.preventDefault();
                let diff = e.clientX - this._resizeStartX;
                if (diff === 0)
                    return;
                //ODS('--- diff=' + diff + ', e.clientX=' + e.clientX + ', _resizeStartX=' + this._resizeStartX);
                let objL = this._siblings[this._spIdx - 1];
                let objR = this._siblings[this._spIdx + 1];
                if (!objL || !objR)
                    return;
                let changed = false;
                if (diff > 0) {
                    // move down
                    let newWidth = objR.originalSize - diff;
                    if (newWidth < objR.minWidth) {
                        diff = objR.originalSize - objR.minWidth;
                        changed = true;
                    }
                }
                else {
                    // move up
                    let newWidth = objL.originalSize + diff;
                    if (newWidth < objL.minWidth) {
                        diff = objL.minWidth - objL.originalSize;
                        changed = true;
                    }
                }
                if ((diff === 0) && !changed)
                    return;
                let newval;
                if (objR.isDynamic) {
                    newval = (objR.originalSize - diff) || 1;
                    changed = (newval !== objR.div.style.flexGrow);
                    if (changed)
                        objR.div.style.flexGrow = newval;
                }
                else {
                    newval = (objR.originalSize - diff) + 'px';
                    changed = (newval !== objR.div.style.width);
                    if (changed)
                        objR.div.style.width = newval;
                }
                if (objL.isDynamic) {
                    newval = (objL.originalSize + diff) || 1;
                    changed = (newval !== objL.div.style.flexGrow);
                    if (changed)
                        objL.div.style.flexGrow = newval;
                }
                else {
                    newval = (objL.originalSize + diff) + 'px';
                    changed = (newval !== objL.div.style.width);
                    if (changed)
                        objL.div.style.width = newval;
                }
                if (changed) {
                    this._needsFullRecalculation = true;
                    deferredNotifyLayoutChangeDown(this.container.parentElement);
                }
            }.bind(this);
        }
        app.listen(this.container, 'mousedown', this._mouseDownHandler);
        this._layoutChangedHandler();
        if (window.settings.UI.disableRepositioning)
            this.container.style.cursor = 'default';
    }
    storeState() {
        if (this.disableStateStoring)
            return;
        let state = {};
        if (this._siblings && (this._spIdx > 0) && (this._spIdx < (this._siblings.length - 1))) {
            let s = [];
            s[0] = this._siblings[this._spIdx - 1];
            s[1] = this._siblings[this._spIdx + 1];
            forEach(s, function (sib) {
                if (sib && !sib.isSplitter && isVisible(sib.div, false) && sib.div.hasAttribute('data-id')) {
                    let sstate = {};
                    if (sib.isDynamic) {
                        let fg = sib.div.style.flexGrow;
                        if (fg && (fg !== '0')) {
                            //ODS('--- storing flexGrow ' + fg + ' for ' + sib.div.getAttribute('data-id'));
                            sstate.flexGrow = fg;
                            if (sib.div.classList.contains('onlyStaticVisible')) {
                                sstate.static = true;
                            }
                            if (this.isVertical) {
                                sstate.height = sib.div.style.height;
                            }
                            else {
                                sstate.width = sib.div.style.width;
                            }
                        }
                    }
                    else if (this.isVertical) {
                        sstate.height = sib.div.style.height;
                    }
                    else {
                        sstate.width = sib.div.style.width;
                    }
                    state.siblings = state.siblings || {};
                    state.siblings[sib.div.getAttribute('data-id')] = sstate;
                }
            }.bind(this));
        }
        return state;
    }
    restoreState(state) {
        if (!state || this.disableStateStoring)
            return;
        super.restoreState(state);
        if (state.siblings) {
            for (let key in state.siblings) {
                let sibState = state.siblings[key];
                let sibEl = qeid(this.parentElement, key);
                if (sibState && sibEl) {
                    if (sibState.flexGrow !== undefined) {
                        //ODS('--- restoring flexGrow ' + sibState.flexGrow + ' for ' + key);
                        sibEl.style.flexGrow = sibState.flexGrow;
                        if (this.isVertical) {
                            if (sibState.height)
                                sibEl.style.height = sibState.height;
                        }
                        else {
                            if (sibState.width)
                                sibEl.style.width = sibState.width;
                        }
                        this._needsFullRecalculation = true;
                        if (sibState.static)
                            sibEl.classList.toggle('onlyStaticVisible', true);
                    }
                    else if (this.isVertical) {
                        if (sibState.height) {
                            sibEl.style.height = sibState.height;
                            this._needsFullRecalculation = true;
                        }
                    }
                    else {
                        if (sibState.width) {
                            sibEl.style.width = sibState.width;
                            this._needsFullRecalculation = true;
                        }
                    }
                }
            }
        }
    }
    storePersistentState() {
        return this.storeState(); // #16512
    }
    restorePersistentState(state) {
        this.restoreState(state);
    }
    cleanUp() {
        app.unlisten(this.container, 'layoutchange', this._layoutChangedHandler);
        app.unlisten(this.container, 'mousedown', this._mouseDownHandler);
        super.cleanUp();
    }
}
registerClass(Splitter);
