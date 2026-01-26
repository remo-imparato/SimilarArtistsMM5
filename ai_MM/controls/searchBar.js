/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

registerFileImport('controls/searchBar');
import Control from './control';
import '../viewHandlers';
import ListView from './listview';
import { CONTEXT_SEARCH_FILTER, CONTEXT_SEARCH_SCROLL_ALL, CONTEXT_SEARCH_SCROLL_PRIMARY } from '../consts';
/**
UI SearchBar element.
    
@class SearchBar
@constructor
@extends Control
*/
export default class SearchBar extends Control {
    initialize(elem, params) {
        super.initialize(elem, params);
        this.helpContext = 'Search';
        this.searchBox = document.createElement('div');
        this.searchBox.classList.add('animate');
        this.searchBox.classList.add('flex');
        this.searchBox.classList.add('row');
        this.searchBox.classList.add('verticalCenter');
        this.searchBox.classList.add('searchBox');
        this.container.appendChild(this.searchBox);
        this.combo = document.createElement('div');
        this.combo.setAttribute('data-control-class', 'Dropdown');
        this.combo.setAttribute('data-init-params', '{multivalue: false, autoWidth: false, autoComplete: false, placeholder: "' + _('Search') + '"}');
        this.combo.setAttribute('data-help', 'Search');
        initializeControl(this.combo);
        this.combo.controlClass.dataSource = newStringList(true);
        this.searchBox.appendChild(this.combo);
        this.localListen(window, 'nodetitlechange', () => {
            this.requestTimeout(() => {
                notifyLayoutChangeDown(this.searchBox); // #16041 - to adjust dropdown-list in search bar (when node title is changed on navbar and thus search bar moves)
            }, 1);
        });
        this.btnPrev = document.createElement('div');
        this.btnPrev.setAttribute('data-control-class', 'Icon');
        this.btnPrev.setAttribute('data-init-params', '{icon: "upArrow"}');
        this.btnPrev.setAttribute('data-tip', 'Ctrl+Up');
        this.searchBox.appendChild(this.btnPrev);
        app.listen(this.btnPrev, 'click', this._prevButtonClick.bind(this));
        this.btnNext = document.createElement('div');
        this.btnNext.setAttribute('data-control-class', 'Icon');
        this.btnNext.setAttribute('data-init-params', '{icon: "downArrow"}');
        this.btnNext.setAttribute('data-tip', 'Ctrl+Down');
        this.searchBox.appendChild(this.btnNext);
        app.listen(this.btnNext, 'click', this._nextButtonClick.bind(this));
        this.btnClose = document.createElement('div');
        this.btnClose.setAttribute('data-control-class', 'Icon');
        this.btnClose.setAttribute('data-init-params', '{icon: "close"}');
        this.searchBox.appendChild(this.btnClose);
        app.listen(this.btnClose, 'click', this._closeButtonClick.bind(this));
        setVisibility(this.searchBox, false, {
            animate: false
        });
        this.btnSwitch = document.createElement('div');
        this.btnSwitch.classList.add('inline');
        this.btnSwitch.setAttribute('data-id', 'btnSwitch');
        this.btnSwitch.setAttribute('data-icon', 'downArrow');
        this.btnSwitch.setAttribute('data-control-class', 'MenuButton');
        this.btnSwitch.setAttribute('data-init-params', '{oppositeX: true}');
        this.container.appendChild(this.btnSwitch);
        setVisibility(this.btnSwitch, false);
        this.searchButton = document.createElement('div');
        this.searchButton.setAttribute('data-control-class', 'IconButton');
        this.searchButton.setAttribute('data-aria-label', 'Search');
        this.container.appendChild(this.searchButton);
        app.listen(this.searchButton, 'click', this._searchButtonClick.bind(this));
        this.searchButton.tooltipValueCallback = (tipDiv) => {
            let act = actions.search;
            tipDiv.innerText = window.uitools.getPureTitle(resolveToValue(act.title));
            if (act.shortcut)
                tipDiv.innerText += ' (' + act.shortcut + ')';
        };
        let menuitems = this._getDropdownItems();
        this.addToContextMenu(menuitems);
        initializeControls(this.container); // initialize all the subcontrols          
        this.searchPhrase = '';
        this.searchType = 'activelist';
        this._lastIncSearchedControlIndex = 0;
        this._initListeners();
        this.QD = navUtils.getActiveTabQueryData();
    }
    _initListeners() {
        this.localListen(this.combo, 'change', () => {
            if (this.combo.controlClass.value) {
                let searchSett = app.getValue('search_settings', {});
                if (searchSett.confirmByEnterKey)
                    return; // needs to be confirmed by pressing Enter (#17058)
            }
            this._searchBoxChange();
        });
        this.localListen(this.combo, 'keydown', this._onKeyDown.bind(this), true); // use capture, so we will handle this before dropdown handler
        this.localListen(document.body, 'keydown', this._onGlobalKeyDown.bind(this));
        this.localListen(document.body, 'viewchange', function (e) {
            this.inSearchView = (e.detail.income.view.viewNode.handlerID == 'search');
            this.activeViewControl = e.detail.income.panel;
            this._storeLocalSearch(e.detail.outcome.view);
            this._restoreLocalSearch(e.detail.income.view);
            let view = e.detail.income.view;
            view.listen(view.dataSourceCacheObserver, 'change', (eventType) => {
                if (eventType == 'tracklist') {
                    // new tracklist (e.g. after podcast update) -- #19064
                    let newList = view.dataSourceCache['tracklist'];
                    if (newList && this.searchType == 'activelist' && this.searchPhrase != '') {
                        let oldList = view.dataSourceCache['tracklist_unfiltered'];
                        view.promise(newList.whenLoaded()).then(() => {
                            if (oldList && oldList.count == newList.count)
                                return;
                            this.requestTimeout(() => {
                                this._updateSearch(); // re-filter the new instance
                            }, 1);
                        });
                    }
                }
            }, 'search_bar_datasourceobservable_listen');
        }.bind(this));
        this.localListen(document.body, 'viewhide', function (e) {
            // reset local search results
            // but do it at the end of the zoom out animation ('viewhide' event) because of flashing mentioned in #13500            ;
            if (!e.detail.animations)
                this._storeLocalSearch(e.detail.view);
            if (!this.inSearchView && e.detail.view.localSearchPhrase && (e.detail.view.localSearchPhrase != '')) {
                this._searchActiveLists(e.detail.panel, ''); // LS: to clear out the previous results (due to #13500)                                    
            }
        }.bind(this));
        this.localListen(document.body, 'maintabchange', function (e) {
            if (this.activeViewData && this.QD.searchPhrase && !this.isContextualSearch() && !this.QD.advancedSearch)
                this.activeViewData.tag.globalSearchPhrase = this.QD.searchPhrase;
            this.QD = navUtils.getActiveTabQueryData();
            let viewData = e.detail.newViewData;
            this.inSearchView = (viewData.viewNode.handlerID == 'search');
            this.activeViewControl = window.currentTabControl.multiviewControl.viewPanel;
            this._restoreLocalSearch(viewData);
            if (this.inSearchView) {
                if (!isVisible(this.searchBox) && !this.QD.advancedSearch)
                    this.comeIn({
                        searchType: 'library',
                        focus: false /* don't focus because of Backspace key navigation*/
                    });
                if (viewData.tag.globalSearchPhrase && !this.isContextualSearch() && !this.QD.advancedSearch) {
                    this._supressSearchBoxChange = true;
                    this.searchText = viewData.tag.globalSearchPhrase; // #16452
                    this._supressSearchBoxChange = false;
                }
            }
        }.bind(this));
        this.localListen(document.body, 'closesearch', function (e) {
            if (this.searchType == e.detail.searchType)
                this.comeOut();
        }.bind(this));
        this.localListen(document.body, 'incrementalsearch', function (e) {
            this._onIncrementalSearch({
                controlClass: e.detail.controlClass,
                phrase: e.detail.phrase,
                reverseOrder: e.detail.reverseOrder
            });
        }.bind(this));
        this.localListen(window.settings.observer, 'change', () => {
            this._setLegend();
        });
        this.localListen(app, 'settingschange', () => {
            let clearHistory = app.getValue('clearSearchBarHistory', false);
            if (clearHistory) {
                this.combo.controlClass.dataSource.clear();
                app.setValue('clearSearchBarHistory', false);
            }
        });
    }
    _storeLocalSearch(viewData) {
        if (viewData && this.searchType == 'activelist') {
            viewData.localSearchPhrase = this.searchPhrase;
            if (this.isIndexDirectory())
                app.setValue('podcastIndexSearchTerm', this.searchPhrase);
        }
    }
    _restoreLocalSearch(viewData) {
        this._storeLocalSearch(this.activeViewData);
        this.activeViewData = viewData;
        if (this.QD.advancedSearch && this.inSearchView) {
            this.comeOut(true);
            return;
        }
        let phrase = viewData.localSearchPhrase || '';
        let isIndexDirectory = false;
        if (viewData && viewData.viewNode && viewData.viewNode.dataSource) {
            isIndexDirectory = viewData.viewNode.dataSource.isIndexDirectory;
            if (isIndexDirectory && (phrase == ''))
                phrase = app.getValue('podcastIndexSearchTerm', '');
        }
        if ((phrase != '' && this.searchType == 'activelist') || isIndexDirectory) {
            // LS: to restore previous search results (due to #13612)
            this.comeIn({
                searchType: 'activelist'
            });
            this._supressSearchBoxChange = true;
            this.combo.controlClass.value = phrase;
            this.searchPhrase = phrase;
            this._updateSearch();
            this._supressSearchBoxChange = false;
            if (isIndexDirectory)
                this.requestTimeout(() => {
                    this.combo.controlClass.focus();
                }, 500);
        }
        else if (this.searchType == 'scrollmatches') {
            this.comeOut(true);
            this._lastIncSearchedControlIndex = 0;
        }
        else {
            if (!this.inSearchView && isVisible(this.searchBox) && !isIndexDirectory)
                this.comeOut(true); // hiding -- we are going outside of the search view
            else if (this.inSearchView && viewData.reloading && this.isContextualSearch()) // due to #15005
                this._updateSearch();
        }
    }
    _onGlobalKeyDown(e) {
        let key = friendlyKeyName(e);
        if (key == 'Esc' && this.isContextualSearch()) { // should cancel search despite the focused control (#13612 - item 2a)
            this._cancelSearch();
        }
    }
    _onKeyDown(e) {
        let key = friendlyKeyName(e);
        if (key == 'Enter') {
            this.combo.controlClass.blur();
            this._addPhraseToHistory();
            let AC;
            if (this.searchType == 'activelist')
                AC = this.activeViewControl;
            else if (this.searchType == 'scrollmatches')
                AC = this._lastIncSearchedControl;
            if (AC) {
                if (AC.controlClass && AC.controlClass.setFocus && (AC.controlClass instanceof ListView))
                    AC.controlClass.setFocus();
                else
                    uitools.focusFirstControl(AC, true); // #19575
            }
            this._searchBoxChange(); // #13337
        }
        else if (key == 'Esc') {
            if (!this.combo.controlClass.isDropdownEmpty()) {
                // do not cancel search when dropdown is open and not empty, ESC will only close dropdown in this case
                this.combo.controlClass.closeDropdown();
            }
            else {
                this.combo.controlClass.closeDropdown();
                this._cancelSearch();
            }
            e.stopPropagation();
        }
        else if (key == 'f' && e.ctrlKey) { // #14107
            this.comeIn({
                searchType: 'library',
                forceGlobal: true,
                focus: true
            });
        }
        else if (key == 'Backspace') {
            if ((this.combo.controlClass.value.length == 0) && this.isContextualSearch()) {
                // this is the last backspace, cancel the search
                this._cancelSearch();
            }
        }
        else if ((key == 'Down' || key == 'Up') && e.ctrlKey) {
            this.doIncrementalSearch((key == 'Up') /* reverse order*/, true /* next occurence */);
        }
    }
    _searchBoxChange() {
        if (this._supressSearchBoxChange)
            return;
        let val = this.combo.controlClass.value;
        if (this.searchPhrase != val) {
            this.searchPhrase = val;
            this._updateSearch();
        }
    }
    _searchButtonClick() {
        if (isVisible(this.searchBox) && (this.searchType == 'library'))
            this.comeOut();
        else
            this.comeIn({
                searchType: 'library',
                forceGlobal: true,
                focus: true
            });
    }
    _prevButtonClick() {
        this.doIncrementalSearch(true /* reverse order*/, true /* next occurence */);
    }
    _nextButtonClick() {
        this.doIncrementalSearch(false /* reverse order*/, true /* next occurence */);
    }
    _closeButtonClick() {
        if (this.isIndexDirectory()) {
            this.searchText = '';
            this.combo.controlClass.focus();
        }
        else
            this._cancelSearch(); // per #15615
    }
    storeState() {
        return {
            mruList: this.combo.controlClass.dataSource.commaText,
            searchType: this.searchType
        };
    }
    restoreState(state) {
        this.combo.controlClass.dataSource.commaText = state.mruList;
        this.combo.controlClass.dataSource.removeDuplicates(); // used to be an issue in the past (when adding non-trimmed strings to MRU)
        //this.searchType = state.searchType;
    }
    _addPhraseToHistory() {
        let list = this.combo.controlClass.dataSource;
        let tp = this.searchPhrase.trim();
        if (this.searchPhrase != '' && !list.exists(tp)) {
            list.modifyAsync(() => {
                list.insert(0, tp); // add it to most recent used search phrases
            });
        }
    }
    _searchActiveLists(rootControl, searchPhrase) {
        let searchControl = (ctrl) => {
            let cls = ctrl.controlClass;
            if (cls && cls.isSearchable && cls.filterSource && (!cls.excludeFromGlobalContextualSearch /* e.g. album po-pup*/)
            /*&& isVisible(ctrl)*/ // filter source also for invisible controls -- they can become invisible just temporarily (when filtered source.count = 0)
            ) {
                if (cls.dataSource && this.activeViewData && this.activeViewData.reloading) {
                    // re-applying filter once the view is reloaded (e.g. F5 press) - issue #14965 / #18113
                    this.activeViewData.promise(cls.dataSource.whenLoaded()).then(() => {
                        cls.requestTimeout(() => {
                            cls.filterSource(searchPhrase);
                        }, 1);
                    });
                }
                else {
                    cls.filterSource(searchPhrase);
                }
            }
        };
        searchControl(rootControl);
        forEach(rootControl.querySelectorAll('div'), searchControl);
    }
    _updateSearch() {
        if (this.searchType == 'activelist') {
            if (this.activeViewControl) // no active control initialized yet
                this._searchActiveLists(this.activeViewControl, this.searchPhrase);
        }
        else if (this.searchType == 'library') {
            this._goToSearchView(() => {
                if (this._collection)
                    this.QD.collectionID = this._collection.id;
                else
                    this.QD.collectionID = -1;
                this.QD.searchPhrase = this.searchPhrase;
            });
        }
        else if (this.searchType == 'scrollmatches') {
            this.doIncrementalSearch();
        }
        this._raiseChangeEvent();
    }
    doIncrementalSearch(reverseOrder, nextOccurence) {
        if (this.activeViewControl && ( /* still */this.searchType == 'scrollmatches')) {
            let items = [];
            let _find = (ctrl) => {
                let cls = ctrl.controlClass;
                if (cls && cls.performIncrementalSearch && isVisible(ctrl) && !cls.excludeFromGlobalContextualSearch)
                    items.push(cls);
            };
            _find(this.activeViewControl);
            forEach(this.activeViewControl.querySelectorAll('div'), _find);
            if (reverseOrder)
                items.reverse();
            if (this._lastIncSearchedControlIndex > items.length)
                this._lastIncSearchedControlIndex = 0;
            let found = false;
            let lastCls;
            if (items.length > 0) {
                // cycle through the found items:
                for (let i = 0; i <= items.length; i++) {
                    let idx = ((i + this._lastIncSearchedControlIndex) % items.length);
                    let cls = items[idx];
                    lastCls = cls;
                    if (cls.performIncrementalSearch(this.searchPhrase, reverseOrder, nextOccurence)) {
                        // this cls matched an item, we are done, no need to search further cls 
                        this._lastIncSearchedControlIndex = idx;
                        this._lastIncSearchedControl = cls.container;
                        for (let _cls of items) {
                            if (_cls != cls) {
                                _cls.cancelSelection(); // cancel selection on the others
                                _cls.setFocusedAndSelectedIndex(-1);
                            }
                        }
                        this.__lastSuccessSearchPhrase = this.searchPhrase;
                        found = true;
                        break;
                    }
                }
            }
            if (!found && (this.searchPhrase == this.__lastSuccessSearchPhrase))
                found = true; // it just looped through all the controls to find that there is still the same (and single) occurence -- don't consider this as search failure (#15185 - item 11)            
            if (!found && lastCls && this.searchPhrase) {
                if (this._getContextualSearchMode() == CONTEXT_SEARCH_SCROLL_PRIMARY)
                    lastCls.showToast('"' + this.searchPhrase + '" ' + _('phrase not found') + lastCls._incrementalSearchMessageSuffix(this.searchPhrase));
                else
                    lastCls.showToast('"' + this.searchPhrase + '" ' + _('phrase not found'));
            }
        }
    }
    _raiseChangeEvent() {
        let event = createNewCustomEvent('searchchange', {
            detail: {
                type: this.searchType,
                phrase: this.searchPhrase,
                isContextualSearch: this.isContextualSearch(),
                visible: isVisible(this.searchBox)
            },
            bubbles: true,
            cancelable: true
        });
        this.container.dispatchEvent(event);
        document.body.dispatchEvent(event);
    }
    _goToSearchView(callback) {
        if (!this.inSearchView) {
            let pars = {
                collection: this._collection
            };
            window.lastFocusedControl = null; // to avoid stealing focus by resetting it to new view
            navigationHandlers['search'].navigate(pars).then(callback);
        }
        else {
            callback();
        }
    }
    _getContextualSearchMode() {
        let state = app.getValue('search_settings', {
            contextualSearchMode: 0
        });
        return state.contextualSearchMode;
    }
    _setContextualSearchMode(value, searchType) {
        if (this._getContextualSearchMode() != value) {
            let state = app.getValue('search_settings', {
                contextualSearchMode: value
            });
            state.contextualSearchMode = value;
            app.setValue('search_settings', state);
            this.comeIn({
                searchType: searchType,
                animate: false
            });
            this._updateSearch();
        }
    }
    _getDropdownItems() {
        return [{
                action: {
                    title: _('Filters matches'),
                    radiogroup: 'contextual_search',
                    checked: () => {
                        return (this._getContextualSearchMode() == CONTEXT_SEARCH_FILTER);
                    },
                    visible: () => {
                        return this.isContextualSearch();
                    },
                    execute: () => {
                        this._setContextualSearchMode(CONTEXT_SEARCH_FILTER, 'activelist');
                    }
                },
                order: 1,
                grouporder: 3,
                grouptitle: _('Search current view'),
            }, {
                action: {
                    title: _('Scrolls to match') + ' (' + _('primary sort field') + ')',
                    radiogroup: 'contextual_search',
                    checked: () => {
                        return (this._getContextualSearchMode() == CONTEXT_SEARCH_SCROLL_PRIMARY);
                    },
                    visible: () => {
                        return this.isContextualSearch();
                    },
                    execute: () => {
                        if (this.searchType == 'library' && this._collection) {
                            // in case of collection search we need to change view at first
                            window.actions.history.backward.execute();
                            let phrase = this.searchText;
                            this.requestTimeout(() => {
                                this._setContextualSearchMode(CONTEXT_SEARCH_SCROLL_PRIMARY, 'scrollmatches');
                                this.searchText = phrase;
                            }, 500);
                        }
                        else
                            this._setContextualSearchMode(CONTEXT_SEARCH_SCROLL_PRIMARY, 'scrollmatches');
                    }
                },
                order: 2,
                grouporder: 3
            }, {
                action: {
                    title: _('Scrolls to match') + ' (' + _('all fields') + ')',
                    radiogroup: 'contextual_search',
                    checked: () => {
                        return (this._getContextualSearchMode() == CONTEXT_SEARCH_SCROLL_ALL);
                    },
                    visible: () => {
                        return this.isContextualSearch();
                    },
                    execute: () => {
                        if (this.searchType == 'library' && this._collection) {
                            // in case of collection search we need to change view at first
                            window.actions.history.backward.execute();
                            let phrase = this.searchText;
                            this.requestTimeout(() => {
                                this._setContextualSearchMode(CONTEXT_SEARCH_SCROLL_ALL, 'scrollmatches');
                                this.searchText = phrase;
                            }, 500);
                        }
                        else
                            this._setContextualSearchMode(CONTEXT_SEARCH_SCROLL_ALL, 'scrollmatches');
                    }
                },
                order: 3,
                grouporder: 3
            }, {
                action: {
                    title: _('Search current view'),
                    //radiogroup: 'search_mode', // per #16067
                    checked: () => {
                        return (this.isContextualSearch());
                    },
                    visible: () => {
                        let h = navUtils.getActiveViewHandler();
                        if (h && h.searchNotSupported)
                            return false;
                        let node = navUtils.getActiveNode();
                        if (node && nodeHandlers[node.handlerID].preferGlobalSearch)
                            return false;
                        else
                            return !this.inSearchView;
                    },
                    execute: () => {
                        this._cancelSearch();
                        this.comeIn({
                            searchType: 'activelist'
                        });
                    }
                },
                order: 1,
                grouporder: 2,
            }, {
                action: {
                    title: () => {
                        return _('Global search') + ' (' + actions.search.shortcut + ')';
                    },
                    //radiogroup: 'search_mode',
                    checked: () => {
                        return (!this.isContextualSearch() && !this.QD.advancedSearch);
                    },
                    execute: () => {
                        actions.search.execute();
                    }
                },
                order: 2,
                grouporder: 2,
            }, {
                action: {
                    title: _('Advanced search'),
                    //radiogroup: 'search_mode',
                    checked: () => {
                        return (!this.isContextualSearch() && this.QD.advancedSearch);
                    },
                    execute: () => {
                        this.QD.searchPhrase = this.searchPhrase;
                        actions.advancedSearch.execute();
                        this.combo.controlClass.blur();
                        setVisibility(this.searchBox, false);
                        this._setButtonsVisibility();
                    }
                },
                order: 3,
                grouporder: 2,
            }, {
                action: {
                    title: _('Options') + '...',
                    icon: 'options',
                    execute: function () {
                        window.uitools.showOptions('pnl_Search');
                    },
                },
                order: 2,
                grouporder: 5
            }];
    }
    storeScrollOffset() {
        this.storedScrollOffset = 0;
        let AC = this.activeViewControl;
        while (AC) {
            if (AC.controlClass && AC.controlClass.getScrollOffset) {
                this.storedScrollOffset = AC.controlClass.getScrollOffset();
                break;
            }
            AC = AC.firstElementChild;
        }
    }
    restoreScrollOffset() {
        if (this.storedScrollOffset) {
            let AC = this.activeViewControl;
            while (AC) {
                if (AC.controlClass && AC.controlClass.setScrollOffset) {
                    AC.controlClass.setScrollOffset(this.storedScrollOffset);
                    break;
                }
                AC = AC.firstElementChild;
            }
        }
    }
    isIndexDirectory() {
        let node = navUtils.getActiveNode();
        if (node && node.dataSource && node.dataSource.isIndexDirectory)
            return true;
    }
    comeIn(params) {
        let searchType = params.searchType;
        if (searchType == 'activelist') {
            let h = navUtils.getActiveViewHandler();
            if (h && h.searchNotSupported)
                return false;
            if (this._getContextualSearchMode() == CONTEXT_SEARCH_SCROLL_PRIMARY || this._getContextualSearchMode() == CONTEXT_SEARCH_SCROLL_ALL) {
                searchType = 'scrollmatches'; // is configured to 'scroll to matches' -- which is done via ListView.incrementalSearch                
            }
        }
        if (this.isIndexDirectory() && (searchType == 'scrollmatches'))
            searchType = 'activelist'; // #12569
        if (searchType == 'activelist' || searchType == 'scrollmatches') {
            this.storeScrollOffset();
            let AC = document.activeElement;
            this.activeControlBeforeSearch = AC; // @ts-ignore
            if (AC && AC.controlClass && AC.controlClass.focusedIndex) // @ts-ignore
                AC.controlClass.lastFocusedIndex = AC.controlClass.focusedIndex;
        }
        if (!this.btnSwitch.controlClass.menuArray)
            this.btnSwitch.controlClass.menuArray = this._getDropdownItems();
        let switchFromCollection2Global = (searchType == 'library' && this._collection && params.forceGlobal);
        if (this.inSearchView && !params.forceGlobal)
            this._collection = navUtils.getActiveCollection();
        else
            this._collection = undefined;
        if (switchFromCollection2Global) {
            this.inSearchView = false; // to force "library global" search when "library collection" search is active and Ctrl+F or Search button is pressed
            if (this.searchText != '') { // #15959, #16110
                this.searchPhrase = this.searchText;
                this._updateSearch();
            }
        }
        if (searchType == 'activelist') {
            /*
            LS: following has been moved to baseCollectionView > filterSource (because of #18286)
            if (navUtils.isCollectionRootNodeActive()) {
                // if root collection node is active then do "library collection" search (item 2b in #12521)
                var h = navUtils.getActiveViewHandler();
                if (h && h.isCollectionBrowser) { // perform global collection search just in case of collection browser (#17059)
                    searchType = 'library';
                    this._collection = navUtils.getActiveCollection();
                }
            }
            */
            let node = navUtils.getActiveNode();
            if (node && nodeHandlers[node.handlerID].preferGlobalSearch)
                searchType = 'library'; // e.g. for the Home node the filtering doesn't make sense, lauch entire library search instead
            if (this.inSearchView) {
                if (this.QD.advancedSearch)
                    return; // advanced editor is shown, we don't want to start automatic active list search
                else
                    searchType = 'library'; // in search results view, do library search always
            }
        }
        this.QD.advancedSearch = false;
        this.searchType = searchType;
        setVisibility(this.searchBox, true, {
            animate: (params.animate != false)
        });
        this._setButtonsVisibility();
        if (params.focus && !this.combo.controlClass.isFocused) {
            // focus search bar and select all the text:        
            this.combo.controlClass.focus();
            this.combo.controlClass.selectText();
        }
    }
    comeOut(clear_text) {
        if (isVisible(this.searchBox)) {
            setVisibility(this.searchBox, false);
            setVisibility(this.btnSwitch, false);
            this._addPhraseToHistory();
            if (this.searchType == 'activelist')
                this.searchText = ''; // to show all items in the current view unfiltered
            else if (clear_text)
                this.combo.controlClass.edit.value = ''; // unlike clearing searchText above this doesn't raise 'change' event
            // to clear/reset the text on the navigation bar:
            this.searchPhrase = '';
            this._raiseChangeEvent();
        }
    }
    _cancelSearch(dontMoveFocus) {
        if (this.searchType != 'activelist' && this.inSearchView)
            window.actions.history.backward.execute();
        else if (!dontMoveFocus) {
            let AC = this.activeViewControl;
            if (AC) { // setting focus because of #18235#c64849
                if (AC.controlClass && AC.controlClass.setFocus && (AC.controlClass instanceof ListView))
                    AC.controlClass.setFocus();
                else {
                    AC = uitools.focusFirstControl(AC, true); // focus active LV
                }
            }
            // and restore the scroll offset per #19259      
            this.requestFrame(() => {
                this.restoreScrollOffset();
                AC = this.activeControlBeforeSearch; // @ts-ignore
                if (AC && AC.controlClass && AC.controlClass.lastFocusedIndex && isChildOf(this.activeViewControl, AC) /* #19573 */) { // @ts-ignore
                    AC.controlClass.setFocusedAndSelectedIndex(AC.controlClass.lastFocusedIndex).then(() => {
                        AC.controlClass.setFocusedFullyVisible();
                    });
                }
                this.activeControlBeforeSearch = undefined;
            });
        }
        this.comeOut(true);
        this._setButtonsVisibility();
    }
    _setLegend() {
        let legend = '';
        if (this.searchType != 'scrollmatches') {
            // LS: seems to be valid also for active list searching (e.g. in Music > All Tracks) -- i.e. this.searchType == 'activelist'
            let wordInfixMode = (this.searchType == 'library' && app.settings.getSearchMode() == 'WORD_INFIX');
            let addLine = (txt) => {
                legend = legend + txt + '\n';
            };
            addLine(_('Search Tips'));
            if (!wordInfixMode) {
                // following variants are not supported in word infix mode (see #17395)
                addLine(_('foo | finds words beginning with foo (e.g. Bar Food or fóObar )'));
                addLine(_('+Foo | finds words beginning with Foo (case-sensitive, e.g. Football)'));
            }
            addLine(_('"Foo" | finds whole words  (e.g. FOO or fóo)'));
            addLine(_('"foo bar" | finds matches including phrase foo bar (e.g. foo barman)'));
            addLine(_('foo bar | finds matches with foo and bar'));
            addLine(_('foo OR bar | finds matches with either foo or bar'));
            addLine(_('foo -bar | finds matches with foo and not bar'));
            addLine(_('fieldname:foo | restricts search to a specific field. For example:'));
            addLine(_('artist:floy | finds words beginning with floy (in Artist) e.g. Pink Floyd'));
            addLine(_('year:2000..2006 | finds matches in range 2000 to 2006'));
            addLine(_('rating: 4.. | finds matches with 4 stars or more'));
        }
        if (!legend)
            this.combo.removeAttribute('data-tip');
        else
            this.combo.setAttribute('data-tip', legend);
    }
    _setButtonsVisibility() {
        setVisibility(this.btnPrev, (this._searchType == 'scrollmatches'));
        setVisibility(this.btnNext, (this._searchType == 'scrollmatches'));
        setVisibility(this.btnSwitch, ( /*this.isContextualSearch() && */isVisible(this.searchBox)));
        //setVisibility(this.searchButton, (!isVisible(this.searchBox) || this.isContextualSearch()));
    }
    _onIncrementalSearch(params) {
        if (this._getContextualSearchMode() == CONTEXT_SEARCH_FILTER || !params.controlClass.parentView || params.controlClass.excludeFromGlobalContextualSearch) {
            // to not show search bar for controls outside of main view (like "Now Playing", "Media tree" and others)
            // also don't apply to controls with excludeFromGlobalContextualSearch (like "Column Browser", "album popup")
            if (this.searchType == 'scrollmatches')
                this.comeOut(true);
            return;
        }
        this.comeIn({
            searchType: 'scrollmatches'
        });
        if (this.combo.controlClass.value != params.phrase)
            this.combo.controlClass.value = params.phrase;
        else
            this.searchPhrase = params.phrase;
        this.combo.controlClass.focus();
    }
    isContextualSearch() {
        let st = this._searchType;
        if ((st == 'activelist') || (st == 'scrollmatches') || (st == 'library' && this._collection /* #15549 */))
            return true;
        else
            return false;
    }
    cleanUp() {
        if (this.combo.controlClass) // not cleaned yet
            this.combo.controlClass.cleanUp(); // cleans our combo listeners too
        app.unlisten(this.searchButton, 'click', this._searchButtonClick);
        super.cleanUp();
    }
    set searchType(value) {
        if (value && this._searchType != value) {
            let text = this.searchText;
            if (this._searchType == 'activelist' || this.searchType == 'scrollmatches')
                this.searchText = ''; // to show all items in the current view unfiltered again
            this._searchType = value;
            this.searchText = text;
            this.searchButton.controlClass.icon = 'search';
            this.searchBox.setAttribute('data-search-type', value);
            this._setLegend();
            if (value == 'scrollmatches')
                window.uitools.globalSettings.disableLiveFilterToastMsg = true;
        }
        // place the searchbar next to the navbar in case of local search (#13473)
        let spot = q('[data-navigation-bar]');
        if (spot && this.isContextualSearch()) {
            spot.appendChild(this.searchBox);
            spot.appendChild(this.btnSwitch);
        }
        else {
            this.container.insertBefore(this.searchBox, this.searchButton);
            this.container.insertBefore(this.btnSwitch, this.searchButton);
        }
        this._setButtonsVisibility();
    }
    get searchType() {
        return this._searchType;
    }
    set searchText(value) {
        this.combo.controlClass.value = value;
    }
    get searchText() {
        return this.combo.controlClass.value;
    }
}
registerClass(SearchBar);
