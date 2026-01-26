'use strict';

import ColumnTrackList from './columntracklist';
import Control from './control';

interface BaseCollectionOriginalControl extends HTMLDivElement {
    _temporaryInvisible?: boolean;
}

/**
 * Base for all UI CollectionView elements.
 */
export default class BaseCollectionView extends Control {
    queryData: QueryData;
    private _searchView: HTMLDivElement;
    private _tracklist: ElementWith<ColumnTrackList>;
    collection: Collection;
    viewData: ViewData;
    disableCache: boolean;
    private _doRefresh: procedure;
    private _originalControls: BaseCollectionOriginalControl[];

    initialize(rootelem, params) {
        this.isSearchable = true;
        this.disableCache = true; // LS: disable caching because of #21199
        super.initialize(rootelem, params);
    }

    haveVirtualSubView(view) {
        return qeid(this.container, view.UIName);
    }

    isVirtualSubViewVisible(view) {
        let div = qeid(this.container, view.UIName);
        return (div && isVisible(div));
    }

    setFocus() {
        uitools.focusFirstControl(this.container);
    }

    storeState() {
        return {};
    }

    restoreState(state) {
        // something to restore here?
    }

    cleanUp() {
        this.dataSource = null;
        super.cleanUp();
    }

    doRefresh() {
        this.viewData.dataSourceCache[this.constructor.name] = {};
        this.collectionCleanup();
        this.refresh();
    }

    refresh() {

    }

    collectionCleanup() {

    }

    filterSource(phrase) {

        // For collection node in Browser view do "library collection" search (item 2b in #12521)  / #18286

        if (!this.queryData)
            this.queryData = navUtils.getActiveTabQueryData();
        let coll = navUtils.getActiveCollection();
        if (coll)
            this.queryData.collectionID = coll.id;

        if (!this._searchView) {
            // initialize the search view:
            this._originalControls = [];
            forEach(this.container.querySelectorAll('div'), (ctrl) => {
                this._originalControls.push(ctrl);
            });
            this._searchView = document.createElement('div');
            this._searchView.setAttribute('data-control-class', 'SearchView');
            this._searchView.setAttribute('data-init-params', '{hideModeSwitcher: true}');
            this.container.appendChild(this._searchView);
            this._tracklist = document.createElement('div') as ElementWith<ColumnTrackList>;
            this._tracklist.setAttribute('data-control-class', 'ColumnTrackList');
            this._tracklist.setAttribute('data-init-params', '{dynamicSize: true, adaptColumnsWidth: false}');
            this.container.appendChild(this._tracklist);
            initializeControls(this.container);
            this._searchView.controlClass.excludeFromGlobalContextualSearch = true;
            this._tracklist.controlClass.showHeader = true;
            this._tracklist.controlClass.excludeFromGlobalContextualSearch = true;
            this._tracklist.controlClass.restorePersistentStates(); // to restore columns in search view (#21910)
            this._tracklist.controlClass.localListen(this._tracklist, 'itemdblclick', uitools.defaultItemAction);
            this._tracklist.controlClass.localListen(this._tracklist, 'itementer', uitools.defaultItemAction);

            this.localListen(this._searchView, 'search_results', (e) => {
                this._tracklist.controlClass.dataSource = e.detail.results.tracks;
            });
            forEach(this._searchView.querySelectorAll('div'), (ctrl) => {
                if (ctrl.controlClass)
                    ctrl.controlClass.excludeFromGlobalContextualSearch = true;
            });
        }

        if (phrase == '') {
            setVisibility(this._searchView, false);
            setVisibility(this._tracklist, false);
            forEach(this._originalControls, (ctrl) => {
                if(ctrl._temporaryInvisible) {
                    setVisibilityFast(ctrl, true);
                    ctrl._temporaryInvisible = undefined;
                }
            });
            this.refresh();
        } else {
            setVisibility(this._searchView, true);
            setVisibility(this._tracklist, true);
            forEach(this._originalControls, (ctrl) => {
                if(isVisible(ctrl, false)) {
                    setVisibilityFast(ctrl, false);
                    ctrl._temporaryInvisible = true;
                }
            });
            this.queryData.searchPhrase = phrase;

        }
    }
    
    set dataSource(viewData: ViewData) {

        if (!this._doRefresh) {
            this._doRefresh = this.doRefresh.bind(this);
        }

        if (this.collection) {
            app.unlisten(this.collection, 'change', this._doRefresh);
        }
        this.collection = undefined;
        this.viewData = viewData;

        if (!viewData) {
            this.collectionCleanup();
        } else {
            this.collection = nodeUtils.getNodeCollection(viewData.viewNode);
            if (this.collection) {
                app.listen(this.collection, 'change', this._doRefresh);
                this.refresh();
            }
        }
        pinViews.setDataSource.call(this, viewData);
    }
    
}
registerClass(BaseCollectionView);
