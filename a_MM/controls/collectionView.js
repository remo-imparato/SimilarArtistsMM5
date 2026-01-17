/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

'use strict';
registerFileImport('controls/collectionView');
import Control from './control';
/**
 * UI CollectionView element.
 */
export default class CollectionView extends Control {
    initialize(elem, params) {
        super.initialize(elem, params);
        let _this = this;
        this.collection = null;
        this.container.innerHTML = loadFile('file:///controls/collectionview.html');
        initializeControls(this.container);
        this.multiView = this.qChild('collMultiView');
        //@ts-ignore
        this.multiView.controlClass.toolbar = window.viewtoolbar;
        this.multiView.controlClass.isEmbedded = true;
        this.tabControl = this.qChild('tabs');
        this.localListen(this.tabControl, 'selected', function (e) {
            let VD = _this.childViewData[e.detail.tabIndex];
            _this.multiView.controlClass.showView(VD);
            let lf = _this.multiView.controlClass.lastFocusedControl;
            if (lf && lf.controlClass) {
                // raise selectionChanged event, so LV toolbar actions could be correctly updated
                _this.raiseEvent('selectionChanged', {
                    control: lf.controlClass,
                    modeOn: lf.controlClass.selectionMode
                }, false, true /* bubbles */);
            }
        });
        this.registerEventHandler('keydown');
    }
    cleanUp() {
        this._updateRequested = false;
        cancelPromise(this.chPromise);
        if (this.collection)
            app.unlisten(this.collection, 'change', this._onCollectionChange);
        super.cleanUp();
    }
    handle_keydown(e) {
        this.tabControl.controlClass.handle_keydown(e); // e.g. Ctrl+Tab is handled correctly
    }
    storeState() {
        let state = super.storeState();
        state.selectedIndex = this.tabControl.controlClass.selectedIndex;
        return state;
    }
    restoreState(state) {
        let _superRestore = super.restoreState.bind(this);
        if (state.selectedIndex) {
            this.chPromise.then(() => {
                this.tabControl.controlClass.selectedIndex = state.selectedIndex;
                _superRestore(state);
            });
        }
    }
    get dataSource() {
        return this._dataSource;
    }
    set dataSource(viewData) {
        let _this = this;
        this._dataSource = viewData;
        if (!this._dataSource) {
            if (this.collection)
                app.unlisten(this.collection, 'change', this._onCollectionChange);
            this.collection = undefined;
            this.multiView.controlClass._hideCurrentView({}); // to properly save states
            return;
        }
        let node = viewData.viewNode;
        let collection = node.dataSource;
        if (this.collection != collection) {
            if (this.collection)
                app.unlisten(this.collection, 'change', this._onCollectionChange);
            this.collection = collection;
            if (this.collection) {
                this._onCollectionChange = app.listen(this.collection, 'change', function () {
                    _this._updateRequested = true;
                    setTimeout(function () {
                        if (_this._updateRequested) {
                            _this._updateRequested = false;
                            cancelPromise(_this.chPromise);
                            if (!_this.collection.deleted)
                                _this.dataSource = _this._dataSource; // to refresh all values
                        }
                    }, 500); // to eliminate cases when collection 'change' is called twice in a very short time interval
                });
            }
        }
        if (viewData.dataSourceCache[this.constructor.name]) {
            this.childViewData = viewData.dataSourceCache[this.constructor.name];
        }
        else {
            this.childViewData = [];
            viewData.dataSourceCache[this.constructor.name] = this.childViewData;
        }
        this.tabControl.controlClass.clearTabs();
        this.chPromise = viewData.promise(nodeUtils.loadChildren(node));
        this.chPromise.then(function () {
            node.children.locked(function () {
                for (let i = 0; i < node.children.count; i++) {
                    let child = node.children.getValue(i);
                    if (!_this.childViewData[i])
                        _this.childViewData[i] = viewData.createViewData({
                            node: child,
                            setFocus: true
                        });
                    _this.tabControl.controlClass.addTab(nodeUtils.getNodeTitle(child), undefined, nodeUtils.getNodeIcon(child));
                }
            });
            if (node.children.count > 0)
                _this.tabControl.controlClass.selectedIndex = 0;
        });
    }
}
registerClass(CollectionView);
