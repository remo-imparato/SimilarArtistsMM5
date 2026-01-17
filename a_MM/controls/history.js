/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

registerFileImport('controls/history');
'use strict';
/**
NavigationHistory - control for manage navigation history

@class NavigationHistory
@constructor
*/
export default class NavigationHistory {
    constructor() {
        this._historyItems = [];
        this._historyAddTimer = null;
        // consts:
        this.ADD_TO_TIMEOUT = 300 /* milliseconds */; // to not add when fast switching (e.g. holding up/down arrows in the media tree)
        this.KEEP_CACHE_TIMEOUT = 60000; // 60s keep dataSource in cache, then clean the cache
        this.MAX_STORE_COUNT = 30; // store/restore only 30 items after restart
        this._currentPos = 0;
        this.disabled = false;
        this._mainTabContent = null;
        this.updateNavigation(null);
    }
    raiseEvent(eventName, details, isCancelable) {
        if (this._mainTabContent) {
            return this._mainTabContent.raiseEvent(eventName, details, isCancelable);
        }
    }
    clearHistory() {
        this._limitLoadedViews(0 /* = to clean all loaded view controls*/);
        this._historyItems.length = 0;
        this._currentPos = 0;
        this.updateNavigation(null);
    }
    cleanUp() {
        this.clearHistory();
        clearTimeout(this._historyAddTimer);
    }
    getHistoryItem(pos) {
        if (pos >= 0 && pos < this._historyItems.length) {
            return this._historyItems[pos];
        }
        else
            return null;
    }
    getCurrent() {
        let viewData = null;
        if (this._historyItems.length > 0 && this._currentPos >= 0 && this._currentPos < this._historyItems.length) {
            viewData = this._historyItems[this._currentPos];
            if (viewData.stored)
                viewData = null;
        }
        return viewData;
    }
    removeItem(viewData) {
        let idx = this._historyItems.indexOf(viewData);
        if (idx >= 0) {
            this._historyItems.splice(idx, 1);
            this._cleanCacheForView(viewData);
            let newPos = this._currentPos;
            if (idx < this._currentPos) {
                newPos--;
            }
            else if (idx > 0 && idx == this._currentPos) {
                newPos--;
            }
            this.moveToPosition(newPos);
        }
    }
    refresh() {
        this.updateNavigation(this.getCurrent());
    }
    updateNavigation(viewData) {
        this.raiseEvent('historyupdate', {
            viewData: viewData,
            owner: this
        });
    }
    registerNodeDelete(viewData) {
        let _this = this;
        viewData._onNodeDeleted = function () {
            if (this.viewNode.deleted) {
                _this.removeItem(this);
            }
        }.bind(viewData);
        app.listen(viewData.viewNode, 'change', viewData._onNodeDeleted);
    }
    unregisterNodeDelete(viewData) {
        if (viewData._onNodeDeleted) {
            app.unlisten(viewData.viewNode, 'change', viewData._onNodeDeleted);
            viewData._onNodeDeleted = undefined;
        }
    }
    add(viewData, doMoveToNewPosition) {
        let _add = function (viewData, doMoveToNewPosition) {
            if (window.settings.disableCache)
                this.clearHistory();
            // delete all items from current position to the end
            for (let i = this._currentPos + 1; i < this._historyItems.length; i++) {
                this._cleanCacheForView(this._historyItems[i]);
            }
            this._historyItems.splice(this._currentPos + 1);
            this.registerNodeDelete(viewData);
            // add item at the end and set position to that new item
            viewData.timeStamp = Date.now(); // also indicates that it has been just added to history
            this._currentPos = this._historyItems.push(viewData) - 1;
            if (doMoveToNewPosition) {
                this.applyViewData(viewData);
            }
            else
                this.updateNavigation(viewData);
            this._limitLoadedViews(/*keep only last*/ 3 /* views loaded */);
            let viewTimeout = this.KEEP_CACHE_TIMEOUT; // Delete views older than viewTimeout (except the last one), issue #12233
            setTimeout(function () {
                this._cleanOldViews(viewTimeout);
            }.bind(this), viewTimeout);
        }.bind(this);
        let curr = this.getCurrent();
        if (curr && (curr.nodePath == viewData.nodePath)) {
            // to prevent from adding two same items in a row
            this.applyViewData(curr); // to refresh current when clicked the node on navbar (item 3 in #13230)
            return;
        }
        if (!this.disabled) {
            this.updateNavigation(viewData);
            if (this._historyAddTimer) {
                clearTimeout(this._historyAddTimer);
                this._historyAddTimer = null;
            }
            if (doMoveToNewPosition) { // move immediatelly
                _add(viewData, doMoveToNewPosition);
            }
            else {
                this._historyAddTimer = setTimeout(function () {
                    _add(viewData, doMoveToNewPosition);
                    this._historyAddTimer = null;
                }.bind(this), this.ADD_TO_TIMEOUT);
            }
        }
    }
    isInHistory(viewData) {
        if (viewData.stored) {
            return true; // stored is in history from last MM run
        }
        else {
            for (let i = 0; i < this._historyItems.length; i++) {
                if (viewData == this._historyItems[i])
                    return true;
            }
            return false;
        }
    }
    _cleanCacheForView(viewData) {
        viewData.dataSourceCache = {}; // free dataSource cache used by viewHandlers in onShow/onHide 
        viewData.localSearchPhrase = undefined; // as suggested in #13612
        this.unregisterNodeDelete(viewData);
    }
    _limitLoadedViews(maxLoadedViewCount) {
        if (this._historyItems.length > maxLoadedViewCount) {
            for (let i = 0; i < this._historyItems.length; i++) {
                if ((i <= this._currentPos - maxLoadedViewCount) || (i > this._currentPos)) {
                    let viewData = this._historyItems[i];
                    this._cleanCacheForView(viewData);
                }
            }
        }
    }
    cleanCacheForFolders() {
        for (let i = 0; i < this._historyItems.length; i++) {
            let viewData = this._historyItems[i];
            if (viewData.viewNode && viewData.viewNode.handlerID == 'folder')
                this._cleanCacheForView(viewData);
        }
    }
    _cleanOldViews(viewTimeout) {
        // Delete views older than viewTimeout (except the last one), issue #12233
        for (let i = 0; i < this._historyItems.length; i++) {
            if (i != this._currentPos) /* always keep the last view */ {
                let viewData = this._historyItems[i];
                if (viewData.timeStamp < (Date.now() - viewTimeout))
                    this._cleanCacheForView(viewData);
            }
        }
    }
    moveToPosition(pos, noAnimations) {
        let item = this.getHistoryItem(pos);
        if (item) {
            let oldPos = this._currentPos;
            this._currentPos = pos;
            if (item.stored || oldPos != pos) // do not re-load when the position wasn't changed (e.g. on switching main tabs)
                this.applyViewData(item, noAnimations);
        }
    }
    getPosition(viewData) {
        for (let i = 0; i < this._historyItems.length; i++) {
            if (viewData == this._historyItems[i])
                return i;
        }
        return -1;
    }
    createViewData(params) {
        return this._mainTabContent.createViewData(params);
    }
    applyViewData(viewData, noAnimations) {
        if (viewData.stored) {
            this.disabled = true;
            this._mainTabContent.restoreViewData(viewData).then(function (viewData) {
                // restored successfuly
                this.disabled = false;
                this.registerNodeDelete(viewData);
                this._mainTabContent.showViewData(viewData, {
                    noAnimations: noAnimations
                });
                this.refresh();
            }.bind(this), function () {
                // navigated item no longer exists (or is inaccessible), skip it and remove from history ( #12732)
                this.disabled = false;
                this.removeItem(viewData);
            }.bind(this));
        }
        else if (viewData.viewNode.deleted) {
            this.removeItem(viewData); // #15387
        }
        else {
            this._mainTabContent.showViewData(viewData, {
                noAnimations: noAnimations
            });
            this.updateNavigation(viewData);
        }
    }
    storeState() {
        let state = {};
        state.position = this._currentPos;
        let startPos = 0;
        if (this._historyItems.length > this.MAX_STORE_COUNT) {
            startPos = this._historyItems.length - this.MAX_STORE_COUNT;
            state.position = state.position - startPos;
        }
        state.items = [];
        for (let i = startPos; i < this._historyItems.length; i++) {
            let viewData = this._historyItems[i];
            if (viewData.stored)
                state.items.push(viewData); // is still in the stored state, no need for a job
            else
                state.items.push(this._mainTabContent.storeViewData(viewData));
        }
        if (state.position < 0 || state.position >= state.items.length)
            state.position = state.items.length - 1;
        return state;
    }
    initAfterRestore() {
        if (app.utils.getJustInstalled()) {
            app.utils.web.getURLContentAsync('https://www.mediamonkey.com/welcome6.htm').then(() => {
                navigationHandlers['welcomePage'].navigate(); // #17005
            }, () => {
                this.moveToPosition(this._currentPos, true /* noAnimations */);
            });
        }
        else
            this.moveToPosition(this._currentPos, true /* noAnimations */);
    }
    restoreState(state) {
        if (state.items && state.items.length > 0) {
            this.clearHistory();
            for (let i = 0; i < state.items.length; i++) {
                let item = state.items[i];
                item.stored = true;
                this._historyItems.push(item);
            }
            this._currentPos = state.position;
            this.restored = true;
        }
    }
    canUndo() {
        return (this._historyItems.length > 0) && (this._currentPos > 0);
    }
    undo() {
        if (this._historyItems.length > 0) {
            if (this._currentPos > 0) {
                this.moveToPosition(this._currentPos - 1);
            }
        }
    }
    home() {
        let _this = this;
        let tab = this.mainTabContent;
        // navigate to first node in mediatree (do not use 'home' hardcoded as this node can be hidden)
        tab.mediatree.controlClass.root.children.whenLoaded().then(function (list) {
            if (list.count) {
                let root = null;
                list.locked(function () {
                    root = list.getValue(0);
                });
                let mv = tab.multiviewControl;
                let wasHome = (mv && mv._activeView && mv._activeView.viewNode && (mv._activeView.viewNode.handlerID == root.handlerID));
                if (!wasHome) {
                    let viewData = tab.createViewData({
                        node: root
                    });
                    _this.add(viewData, true /* move there immediately*/);
                }
            }
        });
    }
    set mainTabContent(value) {
        this._mainTabContent = value;
    }
    get mainTabContent() {
        return this._mainTabContent;
    }
    set disabled(value) {
        this._disabled = value;
    }
    get disabled() {
        return this._disabled;
    }
    set restored(value) {
        this._restored = value;
    }
    get restored() {
        return this._restored;
    }
}
registerClass(NavigationHistory);
