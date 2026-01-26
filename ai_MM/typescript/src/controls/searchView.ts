registerFileImport('controls/searchView');

'use strict';

import ArrayDataSource from '../helpers/arrayDataSource';
import Control from './control';


window.SearchResultsHandlers = {

    artist: {
        order: 10,
        title: _('Artists'),
        getHTML: function () {
            return '<div data-id="artistListView" class="showInline" data-control-class="ArtistGrid" data-init-params="{isHorizontal: false, dynamicSize: true}"></div>';
        },

        getDataSource: function (searchView) {
            if (searchView._isOnlineSearch) {
                return new ArrayDataSource(searchView._onlineSearchResults.artists, {
                    isLoaded: true
                });
            } else {
                if (searchView._isEditorMode)
                    return searchView.collection.getPersonList('artist');
                else
                    return searchView.QueryData.getPersonList('artist');
            }
        },

        getListView: function (searchView) {
            return searchView.qChild('artistListView');
        },

        prepare: function (searchView) {
            let LV = this.getListView(searchView);
            LV.controlClass.disableStateStoring = true;
            LV.controlClass.isGrouped = false;
            LV.controlClass.oneRow = true;
            let navigateItem = function (e) {
                let artist = e.detail.item;
                navigationHandlers['artist'].navigate(artist);
            };
            searchView.localListen(LV, 'itemdblclick', navigateItem);
            searchView.localListen(LV, 'itementer', navigateItem);
            searchView.localListen(LV, 'itemview', navigateItem);
        }
    },

    album: {
        order: 20,
        title: _('Albums'),
        getHTML: function () {
            return '<div data-id="albumListView" class="showInline" data-control-class="AlbumListView" data-init-params="{isHorizontal: false, dynamicSize: true}"></div>';
        },

        getDataSource: function (searchView) {
            if (searchView._isOnlineSearch) {
                return new ArrayDataSource(searchView._onlineSearchResults.albums, {
                    isLoaded: true
                });
            } else {
                if (searchView._isEditorMode)
                    return searchView.collection.getAlbumList();
                else
                    return searchView.QueryData.getAlbumList('music');
            }
        },

        getListView: function (searchView) {
            return searchView.qChild('albumListView');
        },

        prepare: function (searchView) {
            let LV = this.getListView(searchView);
            LV.controlClass.disableStateStoring = true;
            LV.controlClass.isGrouped = false;
            LV.controlClass.oneRow = true;
            let navigateItem = function (e) {
                let album = e.detail.item;
                navigationHandlers['album'].navigate(album);
            };
            searchView.localListen(LV, 'itemdblclick', navigateItem);
            searchView.localListen(LV, 'itementer', navigateItem);
            searchView.localListen(LV, 'itemview', navigateItem);
        }
    },

    composer: {
        order: 30,
        title: _('Composers'),
        getHTML: function () {
            return '<div data-id="composerListView" class="showInline" data-control-class="ArtistGrid" data-init-params="{isHorizontal: false, dynamicSize: true, icon: \'composer\'}"></div>';
        },

        getDataSource: function (searchView) {
            if (searchView._isOnlineSearch) {
                return new ArrayDataSource(searchView._onlineSearchResults.composers, {
                    isLoaded: true
                });
            } else {
                if (searchView._isEditorMode)
                    return searchView.collection.getPersonList('composer');
                else
                    return searchView.QueryData.getPersonList('composer');
            }
        },

        getListView: function (searchView) {
            return searchView.qChild('composerListView');
        },

        prepare: function (searchView) {
            let LV = this.getListView(searchView);
            LV.controlClass.disableStateStoring = true;
            LV.controlClass.isGrouped = false;
            LV.controlClass.oneRow = true;
            let navigateItem = function (e) {
                let item = e.detail.item;
                if (searchView._isOnlineSearch)
                    navigationHandlers['artist'].navigate(item);
                else
                    navigationHandlers['person'].navigate(item);
            };
            searchView.localListen(LV, 'itemdblclick', navigateItem);
            searchView.localListen(LV, 'itementer', navigateItem);
            searchView.localListen(LV, 'itemview', navigateItem);
        }
    },

    conductor: {
        order: 40,
        title: _('Conductors'),
        getHTML: function () {
            return '<div data-id="conductorListView" class="showInline" data-control-class="ArtistGrid" data-init-params="{isHorizontal: false, dynamicSize: true, icon: \'conductor\'}"></div>';
        },

        getDataSource: function (searchView) {
            if (searchView._isOnlineSearch) {
                return new ArrayDataSource([]);
            } else {
                if (searchView._isEditorMode)
                    return searchView.collection.getPersonList('conductor');
                else
                    return searchView.QueryData.getPersonList('conductor');
            }
        },

        getListView: function (searchView) {
            return searchView.qChild('conductorListView');
        },

        prepare: function (searchView) {
            let LV = this.getListView(searchView);
            LV.controlClass.disableStateStoring = true;
            LV.controlClass.isGrouped = false;
            LV.controlClass.oneRow = true;
            let navigateItem = function (e) {
                let item = e.detail.item;
                navigationHandlers['person'].navigate(item);
            };
            searchView.localListen(LV, 'itemdblclick', navigateItem);
            searchView.localListen(LV, 'itementer', navigateItem);
            searchView.localListen(LV, 'itemview', navigateItem);

        }
    },

    genre: {
        order: 50,
        title: _('Genres'),
        getHTML: function () {
            return '<div data-id="genreListView" class="showInline" data-control-class="ImageGrid" data-init-params="{isHorizontal: false, dynamicSize: true, icon: \'genre\'}"></div>';
        },

        getDataSource: function (searchView) {
            if (searchView._isOnlineSearch) {
                return new ArrayDataSource(searchView._onlineSearchResults.genres, {
                    isLoaded: true
                });
            } else {
                if (searchView._isEditorMode)
                    return searchView.collection.getGenreList();
                else
                    return searchView.QueryData.getGenreList();
            }
        },

        getListView: function (searchView) {
            return searchView.qChild('genreListView');
        },

        prepare: function (searchView) {
            let LV = this.getListView(searchView);
            LV.controlClass.disableStateStoring = true;
            LV.controlClass.isGrouped = false;
            LV.controlClass.oneRow = true;
            let navigateItem = function (e) {
                let genre = e.detail.item;
                navigationHandlers['genre'].navigate(genre.name);
            };
            searchView.localListen(LV, 'itemdblclick', navigateItem);
            searchView.localListen(LV, 'itemclick', navigateItem);
            searchView.localListen(LV, 'itementer', navigateItem);
            searchView.localListen(LV, 'itemview', navigateItem);
        }
    },

    video: {
        order: 50,
        title: _('Videos'),
        getHTML: function () {
            return '<div data-id="videoListView" class="showInline" data-control-class="VideoGrid" data-init-params="{isHorizontal: false, dynamicSize: true}"></div>';
        },

        getDataSource: function (searchView) {
            if (searchView._isOnlineSearch) {
                return new ArrayDataSource([]);
            } else
                return searchView.QueryData.getTracklist({
                    contentType: 'video'
                });
        },

        getListView: function (searchView) {
            return searchView.qChild('videoListView');
        },

        prepare: function (searchView) {
            let LV = this.getListView(searchView);
            LV.controlClass.disableStateStoring = true;
            LV.controlClass.isGrouped = false;
            LV.controlClass.oneRow = true;
            searchView.localListen(LV, 'itemdblclick', uitools.defaultItemAction);
            searchView.localListen(LV, 'itementer', uitools.defaultItemAction);
            //searchView.localListen(LV, 'itemclick', uitools.defaultItemAction); // disabled due to #15867            
            //searchView.localListen(LV, 'itemview', uitools.defaultItemAction); // disabled due to #15867
        }
    },

    actor: {
        order: 80,
        title: _('Actors'),
        getHTML: function () {
            return '<div data-id="actorListView" class="showInline" data-control-class="ArtistGrid" data-init-params="{isHorizontal: false, dynamicSize: true, icon: \'actor\'}"></div>';
        },

        getDataSource: function (searchView) {
            if (searchView._isOnlineSearch) {
                return new ArrayDataSource([]);
            } else {
                if (searchView._isEditorMode)
                    return searchView.collection.getPersonList('actor');
                else
                    return searchView.QueryData.getPersonList('actor');
            }
        },

        getListView: function (searchView) {
            return searchView.qChild('actorListView');
        },

        prepare: function (searchView) {
            let LV = this.getListView(searchView);
            LV.controlClass.disableStateStoring = true;
            LV.controlClass.isGrouped = false;
            LV.controlClass.oneRow = true;
            let navigateItem = function (e) {
                let item = e.detail.item;
                navigationHandlers['person'].navigate(item);
            };
            searchView.localListen(LV, 'itemdblclick', navigateItem);
            searchView.localListen(LV, 'itementer', navigateItem);
            searchView.localListen(LV, 'itemview', navigateItem);
        }
    },

    producer: {
        order: 90,
        title: _('Producers'),
        getHTML: function () {
            return '<div data-id="producerListView" class="showInline" data-control-class="ArtistGrid" data-init-params="{isHorizontal: false, dynamicSize: true, icon: \'producer\'}"></div>';
        },

        getDataSource: function (searchView) {
            if (searchView._isOnlineSearch) {
                return new ArrayDataSource([]);
            } else {
                if (searchView._isEditorMode)
                    return searchView.collection.getPersonList('producer');
                else
                    return searchView.QueryData.getPersonList('producer');
            }
        },

        getListView: function (searchView) {
            return searchView.qChild('producerListView');
        },

        prepare: function (searchView) {
            let LV = this.getListView(searchView);
            LV.controlClass.disableStateStoring = true;
            LV.controlClass.isGrouped = false;
            LV.controlClass.oneRow = true;
            let navigateItem = function (e) {
                let item = e.detail.item;
                navigationHandlers['person'].navigate(item);
            };
            searchView.localListen(LV, 'itemdblclick', navigateItem);
            searchView.localListen(LV, 'itementer', navigateItem);
            searchView.localListen(LV, 'itemview', navigateItem);
        }
    },


    playlist: {
        order: 100,
        title: _('Playlists'),
        getHTML: function () {
            return '<div data-id="playlistListView" class="showInline" data-control-class="ImageGrid" data-init-params="{isHorizontal: false, dynamicSize: true, icon: \'playlist\'}"></div>';
        },

        getDataSource: function (searchView) {
            if (searchView._isOnlineSearch) {
                return new ArrayDataSource([]);
            } else
                return searchView.QueryData.getPlaylists();
        },

        getListView: function (searchView) {
            return searchView.qChild('playlistListView');
        },

        prepare: function (searchView) {
            let LV = this.getListView(searchView);
            LV.controlClass.disableStateStoring = true;
            LV.controlClass.isGrouped = false;
            LV.controlClass.oneRow = true;
            let navigateItem = function (e) {
                let playlist = e.detail.item;
                navigationHandlers['playlist_search'].navigate(playlist);
            };
            searchView.localListen(LV, 'itemdblclick', navigateItem);
            searchView.localListen(LV, 'itemclick', navigateItem);
            searchView.localListen(LV, 'itementer', navigateItem);
            searchView.localListen(LV, 'itemview', navigateItem);
        }
    },

    podcast: {
        order: 110,
        title: _('Podcasts'),
        getHTML: function () {
            return '<div data-id="podcastListView" class="showInline" data-control-class="ImageGrid" data-init-params="{isHorizontal: false, dynamicSize: true, imageTemplate: \'podcastItem\'}"></div>';
        },

        getDataSource: function (searchView) {
            if (searchView._isOnlineSearch) {
                return new ArrayDataSource([]); //we currently can't search online podcasts
            } else
                return searchView.QueryData.getPodcastList();
        },

        getListView: function (searchView) {
            return searchView.qChild('podcastListView');
        },

        prepare: function (searchView) {
            let LV = this.getListView(searchView);
            LV.controlClass.disableStateStoring = true;
            LV.controlClass.isGrouped = false;
            LV.controlClass.oneRow = true;
            let navigateItem = function (e) {
                let podcast = e.detail.item;
                navigationHandlers['podcast_search'].navigate(podcast);
            };
            searchView.localListen(LV, 'itemdblclick', navigateItem);
            searchView.localListen(LV, 'itemclick', navigateItem);
            searchView.localListen(LV, 'itementer', navigateItem);
            searchView.localListen(LV, 'itemview', navigateItem);
        }
    },

    audiobook: {
        order: 120,
        title: _('Audiobooks'),
        getHTML: function () {
            return '<div data-id="audiobookAlbumListView" class="showInline" data-control-class="AlbumListView" data-init-params="{isHorizontal: false, dynamicSize: true}"></div>';
        },

        getDataSource: function (searchView) {
            if (searchView._isOnlineSearch) {
                return new ArrayDataSource([]); //we currently can't search online audiobooks
            } else
                return searchView.QueryData.getAlbumList('audiobook');
        },

        getListView: function (searchView) {
            return searchView.qChild('audiobookAlbumListView');
        },

        prepare: function (searchView) {
            let LV = this.getListView(searchView);
            LV.controlClass.disableStateStoring = true;
            LV.controlClass.isGrouped = false;
            LV.controlClass.oneRow = true;
            let navigateItem = function (e) {
                let album = e.detail.item;
                navigationHandlers['album'].navigate(album);
            };
            searchView.localListen(LV, 'itemdblclick', navigateItem);
            searchView.localListen(LV, 'itementer', navigateItem);
            searchView.localListen(LV, 'itemview', navigateItem);
        }
    },

    tracks: { // dummy handler, just to show "Tracks" above tracklist
        order: 99999,
        title: _('Tracks'),
        hasExpander: false,
        getHTML: function () {
            return '';
        },

        getDataSource: function (searchView) {

        },

        getListView: function (searchView) {

        },

        prepare: function (searchView) {

        }
    },

};



/**
View for "live" searching

@class SearchView
@constructor
@extends Control
*/

class SearchView extends Control {
    private _scrollingParent: Element;
    QueryData: QueryData;
    private ___isEditorMode: boolean;
    modeSwitcher: any;
    sourceSwitcher: any;
    lblFilter: any;
    private _headers: AnyDict;
    _expanders: AnyDict;
    private _handlerReloadQueueIndex: number;
    gridBox: any;
    advancedBox: any;
    handlers: any[];
    private _searchVersion: number;
    private _handlerReloadQueue: any[];
    _onlineSearchResults: {
        artists: any[]; albums: any[]; genres: any[]; composers: any[]; tracks: Tracklist; // set loaded flag
    };
    private _onlineProgress: DelayedProgress;
    private _lastOnlineProgressTaskId: any;
    lastResults: any;
    hideModeSwitcher: boolean;
    private _lastLocalTracksPromise: Promise<Tracklist>;
    lblResultInfo: any;
    stdResHeader: any;
    collection: Collection;
    private _filterListening: boolean;
    private __isOnlineSearch: boolean;
    private _searchPhrase: string;
    private _showAsHeader: boolean;

    initialize(rootelem, params) {
        super.initialize(rootelem, params);

        let _this = this;
        this.container.classList.add('flex');
        this.container.classList.add('column');

        this.container.innerHTML = loadFile('file:///controls/searchView.html');
        initializeControls(this.container);

        this.initSearchResults();
        this.initButtons();

        this.QueryData = navUtils.getActiveTabQueryData();
        this.localListen(this.QueryData, 'change', function (kind) {
            if (kind != 'tracklist') // with 'tracklist' it is listened by viewHandlers when notifying new results (e.g. by tracklistBase, columnBrowser)
                _this.onQueryDataChange();
        });
        this.___isEditorMode = false;
        this.onQueryDataChange();
    }

    initButtons() {
        this.modeSwitcher = this.qChild('modeSwitcher');
        this.sourceSwitcher = this.qChild('sourceSwitcher');
        this.localListen(this.sourceSwitcher, 'selected', (e) => {
            this._isOnlineSearch = (e.detail.tabIndex === 1);
            uitools.globalSettings.showingOnline = this._isOnlineSearch;
            setVisibility(this.lblFilter, !this._isOnlineSearch && !this._isEditorMode);
            if (this._isOnlineSearch)
                this._isEditorMode = false;
            this._emitSearchModeChange(this._isOnlineSearch, this._isEditorMode);
            this.onQueryDataChange();
        });

        this.lblFilter = this.qChild('lblFilter');
        this.localListen(this.lblFilter, 'click', (e) => {
            actions.viewFilter.execute();
        });
    }

    _createHandlerHeader(handler) {
        let switcher = '';
        let expander = '';
        let headerClass = '';
        if (handler.switcher !== undefined) {
            switcher = resolveToValue(handler.switcher, '');
            headerClass = resolveToValue(handler.headerClass, '');
        }
        if (handler.hasExpander != false)
            expander = '<label data-id="' + handler.key + 'Expand" class="clickableLabel"></label>';

        let res =
            '<div data-id="' + handler.key + 'Header" data-result-header class="padding ' + headerClass + '">' +
            '   <div class="largeText inline">' + handler.title + '</div>' +
            expander +
            switcher +
            '</div>';
        return res;
    }

    _getHeader(handler) {
        let header = this._headers[handler.key];
        if (!header) {
            header = this.qChild(handler.key + 'Header');
            this._headers[handler.key] = header;
        }
        return header;
    }

    _getExpander(handler) {
        let expander = undefined;
        if (handler.hasExpander != false) {
            expander = this._expanders[handler.key];
            if (!expander) {
                expander = this.qChild(handler.key + 'Expand');
                this._expanders[handler.key] = expander;
            }
        }
        return expander;
    }

    loadHandler(h, _version) {
        let LV = h.getListView(this);
        let DS = h.getDataSource(this);
        let header = this._getHeader(h);
        let expander = this._getExpander(h);
        if (LV && DS) {
            DS.autoUpdateDisabled = true;
            this._initLoading(LV, DS, header, expander, _version);
        }
        return (LV && LV.controlClass.__resetResults);            
    }

    async _handlerReload(handler) {
        if (this.QueryData) {
            let version = this._searchVersion;
            this._handlerReloadQueue.push(handler);
            
            let loadHandlers = async () => {
                let h = this._handlerReloadQueue[this._handlerReloadQueueIndex];
                while (h) {
                    if /* still */ (version == this._searchVersion) {
                        let showImmediatelly = this.loadHandler(h, version);
                        this._handlerReloadQueueIndex++;
                        if(!showImmediatelly)
                            await uitools.waitFortNextFrame(); // LS: load each handler in another frame to keep UI as responsive as possible
                        h = this._handlerReloadQueue[this._handlerReloadQueueIndex];
                    } else
                        break;
                }
            };
            if ((this._handlerReloadQueueIndex == 0) && (!this.showAsHeader))
                loadHandlers();
        }
    }

    initSearchResults() {
        this.gridBox = this.qChild('gridBox');
        this.advancedBox = this.qChild('advancedBox');

        this.handlers = getSortedAsArray(SearchResultsHandlers);
        for (let i = 0; i < this.handlers.length; i++) {
            let h = this.handlers[i];
            this.gridBox.innerHTML = this.gridBox.innerHTML + this._createHandlerHeader(h) + h.getHTML();
        }
        initializeControls(this.gridBox);

        this._headers = [];
        this._expanders = [];
        this._handlerReloadQueue = [];
        this._handlerReloadQueueIndex = 0;
        this._searchVersion = 0;
        for (let i = 0; i < this.handlers.length; i++) {
            let h = this.handlers[i];
            h.prepare(this);
            let _LV = h.getListView(this);
            if (_LV)
                _LV.controlClass.reportStatus = false;

            if (h.hasExpander != false) {
                let searchView = this;
                this.localListen(this._getExpander(h), 'click', function () {
                    let handler = this;
                    let expander = searchView._getExpander(handler);
                    let LV = handler.getListView(searchView);
                    LV.controlClass.oneRow = !LV.controlClass.oneRow;
                    searchView._setExpandText(expander, LV);
                }.bind(h));
            }
            this._handlerReload(h);
        }
    }

    _raiseChangeEvent() {
        let event = createNewCustomEvent('searchchange', {
            detail: {
                type: 'advancedSearch',
            },
            bubbles: true,
            cancelable: true
        });
        this.container.dispatchEvent(event);
        document.body.dispatchEvent(event);
    }

    doRefresh() {
        this.onQueryDataChange();
    }

    onQueryDataChange() {
        if (!isVisible(this.container))
            return;
        this.searchPhrase = this.QueryData.searchPhrase;
        if (this.QueryData.advancedSearch != this._isEditorMode)
            this._isEditorMode = this.QueryData.advancedSearch;
        if (this._isEditorMode)
            this._raiseChangeEvent(); // to notify navbar to update        

        this.requestFrame(() => {
            if (this._isOnlineSearch)
                this._doOnlineSearch();
            else
                this._doLocalSearch();
        });
        setVisibility(this.lblFilter, !this._isOnlineSearch && !this._isEditorMode);
        setVisibility(this.modeSwitcher, !this._isEditorMode && !this.hideModeSwitcher);
    }

    _doOnlineSearch() {
        let phrase = this.searchPhrase;
        let isOnline = this._isOnlineSearch;
        this._onlineSearchResults = {
            artists: [],
            albums: [],
            genres: [],
            composers: [],
            tracks: app.utils.createTracklist(true) // set loaded flag
        };
        // in case of online search we are postponing the search slightly (in order to not initiate too many requests when typing search term)
        let timeout = 500; // ms        
        this.requestTimeout(() => {
            if (phrase == this.searchPhrase && isOnline == this._isOnlineSearch) {
                this._showResults();
                if (phrase != '') {
                    if (!this._onlineProgress)
                        this._onlineProgress = new DelayedProgress(timeout);
                    if (this._lastOnlineProgressTaskId)
                        this._onlineProgress.endTask(this._lastOnlineProgressTaskId);
                    let taskId = this._onlineProgress.beginTask(_('Searching') + '...');
                    this._lastOnlineProgressTaskId = taskId;
                    this._setResultInfo('');
                    musicBrainz.onlineSearch(this.uniqueID, phrase).then((searchRes) => {
                        if (phrase == this.searchPhrase && isOnline == this._isOnlineSearch) {
                            searchRes.artists = searchRes.artists || [];
                            searchRes.albums = searchRes.albums || [];
                            searchRes.genres = searchRes.genres || [];
                            searchRes.composers = searchRes.composers || [];
                            searchRes.tracks = searchRes.tracks || app.utils.createTracklist(true); // set loaded flag
                            this._onlineSearchResults = searchRes;
                            this._emitResults(searchRes);
                            this.localPromise(searchRes.tracks.whenLoaded()).then(() => {
                                if (searchRes.tracks.count == 0)
                                    this._setResultInfo(_('No results found'));
                            });
                            this._showResults();
                        }
                        this._onlineProgress.endTask(taskId);
                    });
                }
            }
        }, timeout, 'onlineSearch');
    }

    _emitResults(results) {
        let event = createNewCustomEvent('search_results', {
            detail: {
                results: results,
            },
            bubbles: true,
            cancelable: true
        });
        this.container.dispatchEvent(event);
        this.lastResults = results;
    }

    _emitSearchModeChange(isOnline, isEditor) {
        let event = createNewCustomEvent('search_mode_change', {
            detail: {
                isOnline: isOnline, // online mode
                isEditor: isEditor // advanced search editor
            },
            bubbles: true,
            cancelable: true
        });
        this.container.dispatchEvent(event);
    }

    _doLocalSearch() {
        let phrase = this.searchPhrase;
        if (!this._isEditorMode && phrase.length < 3) {
            // in case of only one or two letters we are postponing the search slightly (in order to not initiate 'one letter' request that could halt large databases)                  
            this.requestTimeout(() => {
                if (phrase == this.searchPhrase) {
                    this._handleLocalResults();
                    this._showResults();
                }
            }, 500, 'localSearch');
        } else {
            // show results immediatelly
            this._handleLocalResults();
            this._showResults();
        }
    }

    _handleLocalResults() {
        cancelPromise(this._lastLocalTracksPromise);
        this._setResultInfo('');
        let list = this.QueryData.getTracklist();
        list.autoUpdateDisabled = true;
        this._emitResults({
            tracks: list
        });
        this._lastLocalTracksPromise = list.whenLoaded();
        this._lastLocalTracksPromise.then(() => {
            this._lastLocalTracksPromise = null;
            if (list.count == 0)
                this._setResultInfo(_('No results found'));
            this._showResults();
        });
    }

    _setResultInfo(text) {
        if (!this.lblResultInfo)
            this.lblResultInfo = this.qChild('lblResultInfo');
        setVisibility(this.lblResultInfo, (text != '') || !this._isEditorMode);
        this.lblResultInfo.innerText = text;
        setVisibility(this._getHeader(SearchResultsHandlers.tracks), text == '');
        this._updateSwitcherPlacement();
    }

    _showResults() {
        enterLayoutLock(this.container);
        this._searchVersion++;
        this._handlerReloadQueue = [];
        this._handlerReloadQueueIndex = 0;
        for (let i = 0; i < this.handlers.length; i++) {
            let h = this.handlers[i];
            this._handlerReload(h);
        }
        this._updateResultsLayout();
        leaveLayoutLock(this.container);
    }

    _updateResultsLayout() {
        enterLayoutLock(this.container);
        setVisibility(this.gridBox, /*!this._isEditorMode &&*/ !this.showAsHeader);
        setVisibility(this.sourceSwitcher, this.QueryData.collectionID <= 0);
        this._updateSwitcherPlacement();
        leaveLayoutLock(this.container);
    }

    _setExpandText(expander, control) {
        this.requestFrame(function () { // needs to be in RAF so that itemsPerRow is up to date            
            let cnt = 0;
            if (control.controlClass.dataSource && control.controlClass.dataSource.count > 0)
                cnt = control.controlClass.dataSource.count;
            
            if (control.controlClass.itemsPerRow < cnt) {
                if (control.controlClass.oneRow)
                    expander.innerText = '(' + _('Show all') + ' ' + cnt + ')';
                else
                    expander.innerText = '(' + _('Show less') + ')';
                setVisibilityFast(expander, true);
            } else {
                expander.innerText = '';
                setVisibilityFast(expander, false);
            }
        }, expander.getAttribute('data-id'));
    }

    _updateSwitcherPlacement() {

        if (!this.stdResHeader)
            this.stdResHeader = this.qChild('stdResHeader');

        let placed = false;
        if (!this.showAsHeader) {
            forEach(qes(this.container, '[data-result-header]'), function (div) {
                if (!placed && isVisible(div)) {
                    div.appendChild(this.modeSwitcher);
                    placed = true;
                }
            }.bind(this));
        }
        if (!placed)
            this.stdResHeader.appendChild(this.modeSwitcher);
        setVisibility(this.stdResHeader, !placed && !this._isEditorMode);
        setVisibility(this.advancedBox, !placed || this._isEditorMode);
    }

    _cancelLoading(control) {
        let ds = control.controlClass.dataSource;
        if (ds)
            cancelPromise(ds.whenLoaded());
        ds = control.controlClass.__preDataSource;
        if (ds)
            cancelPromise(ds.whenLoaded());
    }

    _initLoading(control, dataSource, header, expander, version) {
        let _this = this;
        this._cancelLoading(control);

        let _setResVisibility = function (vis: boolean, reinit?:boolean) {
            if (reinit || isVisible(control, false) != vis) {
                enterLayoutLock(_this.container);
                setVisibility(control, vis);
                if (header) {
                    setVisibility(header, vis);
                    _this._updateSwitcherPlacement();
                }
                leaveLayoutLock(_this.container);
                if (_this.scrollingParent)
                    idleNotifyLayoutChangeDown(_this.scrollingParent as LayoutChangeTarget); // Notify all children of our parent scrolling element
            }
        };

        if (control.controlClass.__resetResults) {
            // at first, show the results immediatelly (e.g. because of #13500)
            control.controlClass.__resetResults = false;
            control.controlClass.dataSource = dataSource;
            _setResVisibility(dataSource.count > 0, true);
        }
        // later, the results should be showing after 500ms or once fully loaded, but not earlier (to prevent from too much blinking and scrollbar repositioning when results are similar or same)
        control.controlClass.__preDataSource = dataSource;
        _this.requestTimeout(function () {
            if (control.controlClass.__preDataSource === dataSource) {
                control.controlClass.dataSource = dataSource;
                _setResVisibility(dataSource.count > 0);
            }
        }, 500 /*, when adding id here -- make it unique per search handler !! */ );

        dataSource.whenLoaded().then(function () {
            if (!_this._cleanUpCalled && (version == _this._searchVersion)) {
                if (control.controlClass.__preDataSource === dataSource)
                    control.controlClass.dataSource = dataSource;
                _setResVisibility(dataSource.count > 0);
                if (expander)
                    _this._setExpandText(expander, control);
            }
        });
    }

    _resetResultsShowing() {

        if (this._isEditorMode)
            return; // in editor mode the view filter calls actions.refresh and each change (and thus results in _resetResultsShowing upon every criteria change)

        for (let i = 0; i < this.handlers.length; i++) {
            let h = this.handlers[i];
            let LV = h.getListView(this);
            if (LV)
                LV.controlClass.__resetResults = true;
        }
    }

    setFocus() {
        uitools.focusFirstControl(this.container, false /* any control */ );
    }

    storeState() {
        musicBrainz.cancelDownloads(this.uniqueID); // to cancel when putting searchView to controlCache
        return {
            searchPhrase: this.searchPhrase,
            _isEditorMode: this._isEditorMode,
            _isOnlineSearch: this._isOnlineSearch,
        };
    }

    restoreState(state, isJustViewModeChange) {
        if (state) {
            if (!isJustViewModeChange) {
                this.QueryData.searchPhrase = state.searchPhrase;
                this.searchPhrase = state.searchPhrase;
                this._isOnlineSearch = state._isOnlineSearch;
                this._isEditorMode = state._isEditorMode;
                if (this._isEditorMode) {
                    // LS: following to resolve #21719
                    requestFrame(() => {                        
                        actions.viewFilter.show();
                        let editor = actions.viewFilter._getEditor();
                        if (editor) 
                            editor.controlClass.loadLastFilter();
                    });
                } else {
                    let searchBar = qe(document.body, '[data-control-class="SearchBar"]');
                    if (searchBar) {
                        searchBar.controlClass.comeIn({
                            searchType: 'library',
                            focus: false /* don't focus because of Backspace key navigation*/
                        });
                        searchBar.controlClass.searchText = state.searchPhrase;
                    }
                }
            }
        }
    }

    cleanUp() {
        musicBrainz.cancelDownloads(this.uniqueID);
        for (let i = 0; i < this.handlers.length; i++) {
            let LV = this.handlers[i].getListView(this);
            if (LV)
                this._cancelLoading(LV);
        }
        cancelPromise(this._lastLocalTracksPromise);
        this._lastLocalTracksPromise = null;
        super.cleanUp();
    }
    
    get _isEditorMode () {
        return this.___isEditorMode;
    }
    set _isEditorMode (value) {
        if (value != this.QueryData.advancedSearch) {
            this.QueryData.advancedSearch = value;
        }
        this.___isEditorMode = value;
        if (value) {
            // "funnel" filtering unified with advanced search (#12371/#16062)
            actions.viewFilter.show();
            if (!this.collection)
                this.collection = app.collections.getEntireLibrary();
            if (!this._filterListening) {
                this.localListen(app.db.getQueryDataSync('filter'), 'change', this.onQueryDataChange.bind(this));
                this._filterListening = true;
            }
        } else {
            actions.viewFilter.discard();
        }
    }
        
    get _isOnlineSearch () {
        return this.__isOnlineSearch;
    }
    set _isOnlineSearch (value) {
        if (this.__isOnlineSearch && !value)
            musicBrainz.cancelDownloads(this.uniqueID); // when going from Online to Local mode
        this.__isOnlineSearch = value;
        if (value && this.sourceSwitcher.controlClass.selectedIndex != 1)
            this.sourceSwitcher.controlClass.selectedIndex = 1;
    }
        
    get searchPhrase () {
        return this._searchPhrase;
    }
    set searchPhrase (value) {
        this._searchPhrase = value;
    }
        
    get showAsHeader () {
        return this._showAsHeader;
    }
    set showAsHeader (value) {
        this._showAsHeader = value;
        this._updateResultsLayout();
    }
        
    get scrollingParent () {
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
                    break;
                }
            }
            if (!this._scrollingParent) {
                this._scrollingParent = this.container.offsetParent; // Our direct parent will work for our purposes.
            }
        }
        return this._scrollingParent;
    }
    
}
registerClass(SearchView);
