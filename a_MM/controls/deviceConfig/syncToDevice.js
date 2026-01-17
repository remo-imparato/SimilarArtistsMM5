/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";
requirejs('viewHandlers');
requirejs('controls/deviceContentRandomizer');
requirejs('controls/deviceContentSequencer');
requirejs('controls/statusBar');

nodeHandlers.syncTo_DeviceAlbums = inheritNodeHandler('SyncTo_DeviceAlbums', 'Albums', {
    hasTreeChildren: true,
    getChildren: function (node) {
        return new Promise(function (resolve, reject) {
            var coll = nodeUtils.getNodeCollection(node);
            var list = coll.getAlbumList('known only');
            list.whenLoaded().then(function () {
                node.addChildren(list, 'album');
                resolve();
            });
        });
    },
    checkboxRule: 'count_children'
});
nodeHandlers.syncTo_DeviceSeries = inheritNodeHandler('SyncTo_DeviceSeries', 'SyncTo_DeviceAlbums', {
    title: function (node) {
        return _('Series');
    },
    checkboxRule: 'count_children'
});
nodeHandlers.syncTo_DeviceArtists = inheritNodeHandler('SyncTo_DeviceArtists', 'Artists', {
    hasTreeChildren: true,
    checkboxRule: 'count_children'
});
nodeHandlers.syncTo_DeviceAlbumArtists = inheritNodeHandler('SyncTo_DeviceAlbumArtists', 'AlbumArtists', {
    hasTreeChildren: true,
    checkboxRule: 'count_children'
});
nodeHandlers.syncTo_DeviceDirectors = inheritNodeHandler('SyncTo_DeviceDirectors', 'Directors', {
    hasTreeChildren: true,
    checkboxRule: 'count_children'
});
nodeHandlers.syncTo_DeviceProducers = inheritNodeHandler('SyncTo_DeviceProducers', 'Producers', {
    hasTreeChildren: true,
    checkboxRule: 'count_children'
});
nodeHandlers.syncTo_DeviceComposers = inheritNodeHandler('SyncTo_DeviceComposers', 'Composers', {
    hasTreeChildren: true,
    checkboxRule: 'count_children'
});
nodeHandlers.syncTo_DeviceConductors = inheritNodeHandler('SyncTo_DeviceConductors', 'Conductors', {
    hasTreeChildren: true,
    checkboxRule: 'count_children'
});
nodeHandlers.syncTo_DeviceRatings = inheritNodeHandler('SyncTo_DeviceRatings', 'Ratings', {
    hasTreeChildren: true
});
nodeHandlers.syncTo_DeviceGenre = inheritNodeHandler('SyncTo_DeviceGenre', 'Genre', {
    hasTreeChildren: false
});
nodeHandlers.syncTo_DeviceGenres = inheritNodeHandler('SyncTo_DeviceGenres', 'Genres', {
    hasTreeChildren: true,
    getChildren: function (node) {
        return new Promise(function (resolve, reject) {
            var coll = nodeUtils.getNodeCollection(node);
            var list = coll.getGenreList();
            list.whenLoaded().then(function () {
                node.addChildren(list, 'syncTo_DeviceGenre');
                resolve();
            });
        });
    },
    checkboxRule: 'count_children'
});
nodeHandlers.syncTo_DeviceLocations = inheritNodeHandler('SyncTo_DeviceLocations', 'Location', {
    _addDevices: function (node) {
        return dummyPromise();
    }
});
nodeHandlers.syncTo_DeviceSubscriptions = inheritNodeHandler('SyncTo_DeviceSubscriptions', 'Subscriptions', {
    getChildren: function (node) {
        var list = app.podcasts.getPodcastListBySQL('SELECT Podcasts.* FROM Podcasts ORDER BY PodcastName');
        return nodeUtils.fillFromList(node, list, 'podcast');
    },
});

nodeHandlers.syncTo_DeviceCollection = inheritNodeHandler('SyncTo_DeviceCollection', 'Collection', {
    hasChildren: function (node) {
        return false;
    },
    _getSubnodesList: function (collection) {
        var coltype = collection.getType();
        var list = new Array({
            id: 'syncTo_DeviceAlbums',
            visible: inArray(coltype, ['mixed', 'music', 'classicalmusic', 'musicvideo', 'audiobook']),
            pos: 0,
        }, {
            id: 'syncTo_DeviceSeries',
            visible: inArray(coltype, ['video', 'tv']),
            pos: 0,
        }, {
            id: 'syncTo_DeviceGenres',
            visible: inArray(coltype, ['mixed', 'music', 'classicalmusic', 'musicvideo', 'audiobook', 'video', 'tv', 'podcast', 'videopodcast']),
            pos: 2,
        }, {
            id: 'syncTo_DeviceArtists',
            visible: inArray(coltype, ['mixed', 'music', 'classicalmusic', 'musicvideo', 'audiobook', 'podcast', 'videopodcast']),
            pos: 3,
        }, {
            id: 'syncTo_DeviceDirectors',
            visible: inArray(coltype, ['video', 'tv']),
            pos: 3,
        }, {
            id: 'syncTo_DeviceAlbumArtists',
            visible: inArray(coltype, ['mixed', 'music', 'classicalmusic', 'musicvideo', 'audiobook']),
            pos: 4,
        }, {
            id: 'syncTo_DeviceComposers',
            visible: inArray(coltype, ['music', 'classicalmusic', 'musicvideo', 'audiobook']),
            pos: 5,
        }, {
            id: 'syncTo_DeviceProducers',
            visible: inArray(coltype, ['video', 'tv', 'audiobook', 'musicvideo', 'podcast', 'videopodcast']),
            pos: 5,
        }, {
            id: 'syncTo_DeviceConductors',
            visible: inArray(coltype, ['classicalmusic']),
            pos: 5,
        }, {
            id: 'syncTo_DeviceRatings',
            visible: inArray(coltype, ['mixed', 'music', 'classicalmusic', 'musicvideo', 'audiobook', 'video', 'tv', 'podcast', 'videopodcast']),
            pos: 6,
        }, {
            id: 'syncTo_DeviceLocations',
            visible: inArray(coltype, ['mixed', 'music', 'classicalmusic', 'musicvideo', 'audiobook', 'video', 'tv', 'podcast', 'videopodcast']),
            pos: 7,
        });
        if (coltype == 'podcast' || coltype == 'videopodcast') {
            list.splice(0, 0, {
                id: 'syncTo_DeviceSubscriptions',
                pos: 0,
                visible: true,
            });
        }
        return list;
    },
    getChildren: function (node) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var collection = node.dataSource.getCopy();
            collection.setIgnoreFlag(); // #20732
            var list = _this._getSubnodesList(collection);
            _this._addChildren(list, node, collection);
            resolve();
        });
    },
});
nodeHandlers.syncTo_DevicePlaylists = inheritNodeHandler('SyncTo_DevicePlaylists', 'Playlists', {
    hasChildren: function (node) {
        return false;
    },
});
nodeHandlers.syncCollectionsTreeRoot = inheritNodeHandler('SyncCollectionsTreeRoot', 'Base', {
    getChildren: function (node) {
        return new Promise(function (resolve, reject) {
            app.collections.getCollectionListAsync({
                includeEntireLibrary: false
            }).then(function (list) {
                list.forEach(function (collection) {
                    node.addChild(collection, 'syncTo_DeviceCollection');
                });
                node.addChild(app.playlists.root, 'syncTo_DevicePlaylists');
                resolve();
            });
        });
    }
});
nodeHandlers.syncPlaylistsTreeRoot = inheritNodeHandler('SyncPlaylistsTreeRoot', 'Base', {
    getChildren: function (node) {
        return new Promise(function (resolve, reject) {
            node.addChild(app.playlists.root, 'syncTo_DevicePlaylists');
            resolve();
        });
    }
});


DeviceConfig.prototype.tabs.syncToDevice.load = function (reload) {
    var _this = this;

    var lblSyncToDevice = this.qChild('lblSyncToDevice');
    var h = mediaSyncHandlers[this.device.handlerID];
    if (h.contentSelectionText)
        lblSyncToDevice.textContent = h.contentSelectionText(this.device);
    else
        lblSyncToDevice.textContent = sprintf(_('Add library content to \'%s\''), this.device.name);

    var lblSyncToDeviceSubText = this.qChild('lblSyncToDeviceSubText');
    if (h.contentSelectionSubText) {
        lblSyncToDeviceSubText.textContent = h.contentSelectionSubText(this.device);
        setVisibility(lblSyncToDeviceSubText, true);
    } else {
        setVisibility(lblSyncToDeviceSubText, false);
    }

    this.chbHideUnselected = this.qChild('chbHideUnselected');
    setVisibility( this.chbHideUnselected, !this.contentSelectionMode);

    var hideCollections = (h.configBoxVisible && !h.configBoxVisible('collections', this.device));

    this.collectionTree = this.qChild('syncCollectionsTree');
    var collectionBox = this.qChild('collectionContentBox');

    var _oldCollectionIndex = -1;
    if (!reload) {
        this.localListen(this.collectionTree, 'expandfinish', function (e) {
            var node = e.detail.currentNode;
            if (_this.device)
                _this.device.getCheckStates(node.children, false);
        });
        this.localListen(this.collectionTree, 'checkchange', function (e) {
            _this.device.calculator.calcNode(e.detail.node);
        });
    } else {
        // to update check states when tree is re-loading by another dataSource (or after refresh - e.g. when config is changed in MMA)
        this.chbHideUnselected.controlClass.checked = false;
        _oldCollectionIndex = this.collectionTree.controlClass.focusedIndex;
        if (hideCollections)
            this.collectionTree.controlClass.reinitNodes('syncPlaylistsTreeRoot');
        else
            this.collectionTree.controlClass.reinitNodes('syncCollectionsTreeRoot');
    }

    setVisibility(this.collectionTree, !hideCollections);
    if (hideCollections && this.collectionTree.controlClass.root.handlerID != 'syncPlaylistsTreeRoot')
        this.collectionTree.controlClass.reinitNodes('syncPlaylistsTreeRoot');

    var syncList = this._getSyncedObjects();
    this.collectionTree.controlClass.setCheckedObjects(syncList);

    var _getFocusedCollectionCheckState = () => {
        this.requestTimeout(() => {
            var focusedNode = this.collectionTree.controlClass.focusedNode;
            var chbAllCollection;
            if (focusedNode && !focusedNode.checked && focusedNode.dataSource) {
                // for the focused collection take the partial check state rather from the tree on the right 
                // i.e. rather than from the calculator (that can be slow when hundreds of artists are checked/unchecked at once)
                chbAllCollection = _this.qChild('chbAllCollection' + focusedNode.dataSource.id);
                var itemTree = _this.qChild('collectionItemsTree' + focusedNode.dataSource.id);
                if (itemTree) {
                    var anyChecked = false;
                    listForEach(itemTree.controlClass.root.children, (n) => {
                        if (n.checked || n.partlyChecked)
                            anyChecked = true;
                    });
                    if (anyChecked)
                        focusedNode.partlyChecked = true;
                    else
                        focusedNode.partlyChecked = false;

                     if (chbAllCollection)
                        chbAllCollection.controlClass.indeterminate = focusedNode.partlyChecked;
                }
            }
            if (focusedNode && chbAllCollection)
                chbAllCollection.controlClass.checked = focusedNode.checked;
        }, 20, '_calcPartialCheckStateTm');
    }

    this.dataSourceListen(this.device.calculator, 'change', function () {
        // to get the correct "partlyChecked" states when the tree on the right is changed
        if (_this.device /*&& (window.lastFocusedControl != _this.collectionTree)*/ ) {
            _this.device.getCheckStates(_this.collectionTree.controlClass.root.children, true /* only partlyChecked states*/ ).then(_getFocusedCollectionCheckState);
        }
    });
    this.dataSourceListen(this.device, 'change', function (oper) {
        if (oper == 'config_change') {
            // update when sync-list (or config) is changed remotelly (from MMA)
            actions.view.refresh.execute();
        }
    });

    this.capacityBar.controlClass.animateTransitions = true;


    var _initValuesForCollection = function (collection) {
        var itemTree = _this.qChild('collectionItemsTree' + collection.id);
        if (itemTree) {
            itemTree.controlClass.reinitNodes();
            itemTree.controlClass.onNodeTooltip = (tipdiv, node, div) => {
                tipdiv.innerHTML = sanitizeHtml(nodeUtils.getNodeTitle(node));
                cancelPromise(itemTree.controlClass._lastTooltipPromise);
                if (node && node.dataSource && node.dataSource.getTracklist && (node.dataSource.objectType != 'collection' /* to exclude nodes like Artists */ )) {
                    var tracks = node.dataSource.getTracklist();
                    if (!tracks)
                        return;
                    itemTree.controlClass._lastTooltipPromise = itemTree.controlClass.localPromise(tracks.whenLoaded());
                    itemTree.controlClass._lastTooltipPromise.then(() => {
                        if (tracks.statusInfo) {
                            itemTree.controlClass.localPromise(tracks.statusInfo).then((data) => {
                                tipdiv.innerHTML = sanitizeHtml(nodeUtils.getNodeTitle(node)) + '<br/>' + statusbarFormatters.formatTracklistStatus(data) + '<br/>';
                                fastForEach(tracks, (track, i) => {
                                    tipdiv.innerHTML = tipdiv.innerHTML + '<br/>' + escapeXml(track.summary);
                                    if (i > 10) {
                                        tipdiv.innerHTML = tipdiv.innerHTML + '<br/>' + '...';
                                        return true; // terminate
                                    }
                                });
                            });
                        }
                    });
                }
            }
            var root = itemTree.controlClass.root;
            if (collection.objectType == 'collection')
                root.handlerID = 'syncTo_DeviceCollection';
            else
                root.handlerID = 'playlist';
            root.dataSource = collection;
            root.checked = false;
            itemTree.controlClass.expandNode(root);
        }

        var chbAllCollection = _this.qChild('chbAllCollection' + collection.id);
        if (collection.id)
            chbAllCollection.controlClass.text = _('All') + ' ' + collection.name;
        else    
            chbAllCollection.controlClass.text = _('All') + ' ' + _('Playlists');

        var h = mediaSyncHandlers[_this.device.handlerID];
        var randomizer = _this.qChild('collectionRandomizer' + collection.id);
        if (randomizer) {
            var collSett = _this.device.getCollectionSettings(collection.id);
            _this.localPromise(collSett.loadAsync()).then(function () {
                _this._reloadingTab = true;
                randomizer.controlClass.dataSource = collSett;
                _this._reloadingTab = false;
            });
            if (h.configBoxVisible)
                setVisibility(randomizer, h.configBoxVisible('collectionRandomizer', _this.device));
            else
                setVisibility(randomizer, !_this.contentSelectionMode);
        }
        var sequencer = _this.qChild('collectionSequencer' + collection.id);
        if (sequencer) {
            var collSett = _this.device.getCollectionSettings(collection.id);
            _this.localPromise(collSett.loadAsync()).then(function () {
                _this._reloadingTab = true;
                sequencer.controlClass.dataSource = collSett;
                _this._reloadingTab = false;
            });
            if (h.configBoxVisible)
                setVisibility(sequencer, h.configBoxVisible('collectionSequencer', _this.device));
            else
                setVisibility(sequencer, !_this.contentSelectionMode);
        }
    }

    var lastCollectionContent = null;

    if (!reload) {
        this.localListen(this.collectionTree, 'keydown', function(e) {
            let key = friendlyKeyName(e);
            
            if (key === 'Right') {
                var node = _this.collectionTree.controlClass.focusedNode;
                if (!node)
                    return;
                var collection = node.dataSource;
                var rightNode = _this.qChild('chbAllCollection' + collection.id);
                if (rightNode) {
                    rightNode.controlClass.focus();
                    e.stopPropagation();
                    e.preventDefault();
                }
            } 
        });

        this.localListen(this.collectionTree, 'focuschange', function () {
            if (lastCollectionContent)
                setVisibility(lastCollectionContent, false);

            var node = _this.collectionTree.controlClass.focusedNode;
            if (!node)
                return;
            var collection = node.dataSource;
            var disable = node.checked;

            var contentID = 'collectionContent' + collection.id;
            var collectionContent = _this.qChild(contentID);
            _this.chbHideUnselected = _this.qChild('chbHideUnselected');         
            if (!collectionContent) {
                collectionContent = document.createElement('div');
                collectionContent.classList.add('flex');
                collectionContent.classList.add('fill');
                collectionContent.classList.add('column');
                collectionContent.setAttribute('data-control-class', 'Control'); // so that disabling works
                collectionContent.setAttribute('data-id', contentID);
                collectionBox.appendChild(collectionContent);

                var chbAllCollection = document.createElement('div');
                chbAllCollection.classList.add('uiRow');
                chbAllCollection.setAttribute('data-control-class', 'Checkbox');
                chbAllCollection.setAttribute('data-id', 'chbAllCollection' + collection.id);
                collectionContent.appendChild(chbAllCollection);

                var itemTree = document.createElement('div');
                itemTree.classList.add('fill');
                itemTree.classList.add('noBorder');
                itemTree.setAttribute('data-control-class', 'CheckboxTree');
                itemTree.setAttribute('data-id', 'collectionItemsTree' + collection.id);
                collectionContent.appendChild(itemTree);

                var type = '';
                if (collection.objectType == 'collection')
                    type = collection.getType();
                else
                    type = 'playlists';
                if (inArray(type, ['music', 'classicalmusic', 'musicvideo'])) {
                    itemTree.classList.add('hSeparatorTiny');
                    var randomizer = document.createElement('div');
                    randomizer.setAttribute('data-control-class', 'DeviceContentRandomizer');
                    randomizer.setAttribute('data-id', 'collectionRandomizer' + collection.id);
                    collectionContent.appendChild(randomizer);
                }
                if (inArray(type, ['podcast', 'videopodcast', 'video', 'tv'])) {
                    itemTree.classList.add('hSeparatorTiny');
                    var sequencer = document.createElement('div');
                    sequencer.setAttribute('data-control-class', 'DeviceContentSequencer');
                    sequencer.setAttribute('data-id', 'collectionSequencer' + collection.id);
                    collectionContent.appendChild(sequencer);
                }
                initializeControl(collectionContent);
                initializeControls(collectionContent);
                chbAllCollection.controlClass.tabIndex = -1; // navigation by arrows only
                itemTree.controlClass.tabIndex = -1; // navigation by arrows only
                // prepare navigation by keys
                _this.localListen(chbAllCollection, 'keydown', function(e) {
                    let key = friendlyKeyName(e);
                    
                    if (key === 'Down') {
                        e.stopPropagation();
                        e.preventDefault();
                        itemTree.focus();
                    } else if (key === 'Left') {
                        e.stopPropagation();
                        e.preventDefault();
                        _this.collectionTree.focus();
                    }
                });

                _this.localListen(itemTree, 'keydown', function(e) {
                    let key = friendlyKeyName(e);
                    
                    if (key === 'Up') {
                        e.stopPropagation();
                        e.preventDefault();
                        chbAllCollection.controlClass.focus();
                        
                    } else if (key === 'Left') {
                        const node = itemTree.controlClass.focusedNode;
                        if(node && !node.expanded) {
                            e.stopPropagation();
                            e.preventDefault();
                            _this.collectionTree.focus();
                        }
                    }
                });

                _initValuesForCollection(collection);

                setVisibility(itemTree, !disable);

                collectionContent.itemTree = itemTree;
                collectionContent.chbAllCollection = chbAllCollection;

                _this.localListen(chbAllCollection, 'click', function (e) {                    
                    var focusedNode = _this.collectionTree.controlClass.focusedNode;
                    focusedNode.checked = this.chbAllCollection.controlClass.checked;
                    focusedNode.modified = true;
                    this.itemTree.controlClass.disabled = focusedNode.checked;
                    _getFocusedCollectionCheckState();
                    setVisibility(this.itemTree, !focusedNode.checked);
                    setVisibility(_this.chbHideUnselected, !focusedNode.checked);
                }.bind(collectionContent));

                _this.localListen(itemTree, 'expandfinish', function (e) {
                    var node = e.detail.currentNode

                    var _checkHideUnselected = () => {
                        if (!window._cleanUpCalled && _this.chbHideUnselected.controlClass.checked) {
                            node.hideUnselectedAsync(true).then(() => {
                                itemTree.controlClass.root.notifyChanged();
                            });
                        }
                    }

                    if (node.expandCount == 1) {
                        if (_this.device)
                            _this.localPromise(_this.device.getCheckStates(node.children, false)).then(() => {
                                _checkHideUnselected();
                            });
                    } else {
                        _checkHideUnselected();
                    }
                });

                _this.localListen(itemTree, 'checkchange', function (e) {
                    var n = e.detail.node;
                    if (n.parent.persistentID == itemTree.controlClass.root.persistentID && !n.expanded) {

                        var _expandAndCalc = (node) => {
                            if (nodeUtils.getHasTreeChildren(node)) {
                                return new Promise(function (resolve, reject) {
                                    _this.localPromise(itemTree.controlClass.expandNode(node)).then(() => {
                                        _this.device.calculator.calcNode(node);
                                        if (node.handlerID == 'playlist') {
                                            // to expand, (un)check and calc the whole playlist branch (details in #17901)                                            
                                            listAsyncForEach(node.children, (ch, nextCallback) => {
                                                _expandAndCalc(ch).then(nextCallback);
                                            }, resolve);
                                        } else {
                                            resolve();
                                        }
                                    }, resolve);
                                });
                            } else {
                                _this.device.calculator.calcNode(node);
                                return dummyPromise();
                            }
                        }

                        // for subroot collection nodes like genres/artists/albums we need to expand them first                    
                        _expandAndCalc(n);

                    } else {
                        _this.device.calculator.calcNode(n);
                        if (n.checked) {
                            n.hideUnselectedAsync(false).then(() => {
                                n.children.setAllChecked(true);
                                n.children.setAllModified(true);
                                n.notifyChanged();
                            });
                        }
                    }
                    _getFocusedCollectionCheckState();
                });

                _this._monitorChanges(collectionContent);


            } else {
                setVisibility(collectionContent, true);                
                setVisibility(collectionContent.itemTree, !disable);     
                collectionContent.itemTree.controlClass.dataSource.hideUnselectedAsync(_this.chbHideUnselected.controlClass.checked);
            }            
            lastCollectionContent = collectionContent;
        });

        var chbHideUnselected = this.qChild('chbHideUnselected');        
        this.localListen(this.collectionTree, 'checkchange', function (e) {
            if ((_this.collectionTree.controlClass.focusedNode) && (e.detail.node.persistentID == _this.collectionTree.controlClass.focusedNode.persistentID)) {
                lastCollectionContent.itemTree.controlClass.disabled = e.detail.node.checked;   
                lastCollectionContent.chbAllCollection.controlClass.checked = e.detail.node.checked; 
                lastCollectionContent.chbAllCollection.controlClass.indeterminate = e.detail.node.indeterminate;
                setVisibility(lastCollectionContent.itemTree, !e.detail.node.checked);
                setVisibility(chbHideUnselected, !e.detail.node.checked);
            }
        });

        this.localListen(chbHideUnselected, 'click', function () {
            lastCollectionContent.itemTree.controlClass.hideUnselectedAsync(this.controlClass.checked);
        });
    }

    var nodelist = this.collectionTree.controlClass.root.children;
    this.dataSourcePromise(nodelist.whenLoaded()).then(() => {

        nodelist.forEach(function (node) {
            var collection = node.dataSource;
            var collectionContent = _this.qChild('collectionContent' + collection.id);
            if (collectionContent) {
                // if the dataSource (_this.device) was changed, reset the values for collection content:            
                _initValuesForCollection(collection);
            }
        });

        var idx = _oldCollectionIndex;
        if ((idx < 0) || (idx >= nodelist.count))
            this.collectionTree.controlClass.focusedIndex = 0;
        else
            this.collectionTree.controlClass.focusedIndex = idx; // to update the tree on the right by the new values (from the new dataSource)
    });

    var chbDelete = this.qChild('chbDelete');
    chbDelete.controlClass.text = sprintf(_('Delete other files and playlists from \'%s\''), this.device.name) + ':';
    chbDelete.controlClass.checked = (this.device.deleteUnsync || this.device.deleteUnknown);
    if (this.device.deleteUnknown)
        this.qChild('cbDelete').controlClass.focusedIndex = 1;
    else
        this.qChild('cbDelete').controlClass.focusedIndex = 0;
    this.qChild('chbDeleteConfirm').controlClass.checked = this.device.deleteConfirm;

    var h = mediaSyncHandlers[this.device.handlerID];
    if (h.configBoxVisible)
        setVisibility(this.qChild('boxDelete'), h.configBoxVisible('boxDelete', this.device));
    else
        setVisibility(this.qChild('boxDelete'), !this.contentSelectionMode);

    if (!reload)
        bindDisabled2Checkbox(this.qChild('chbDeleteConfirm'), this.qChild('chbDelete'));


    setVisibility(this.qChild('boxCache'), this.contentSelectionMode);
    if (this.contentSelectionMode) {
        var sett = mediaSyncDevices.getCustomSettings(this.device);
        this.qChild('chbCacheContent').controlClass.checked = !sett.deleteAfterUpload;
    }
};

DeviceConfig.prototype.tabs.syncToDevice.save = function () {
    var _this = this;
    var list = this.qChild('syncCollectionsTree').controlClass.getObjectList();
    this.device.setSyncedObjects(list);

    var nodelist = this.qChild('syncCollectionsTree').controlClass.root.children;
    nodelist.forEach(function (node) {
        var object = node.dataSource;
        var itemTree = _this.qChild('collectionItemsTree' + object.id);
        if (itemTree) {
            var list = itemTree.controlClass.getObjectList();
            _this.device.setSyncedObjects(list);
        }
        var randomizer = _this.qChild('collectionRandomizer' + object.id);
        if (randomizer) {
            var collSett = randomizer.controlClass.dataSource;
            if (collSett)
                collSett.commitAsync();
        }
        var sequencer = _this.qChild('collectionSequencer' + object.id);
        if (sequencer) {
            var collSett = sequencer.controlClass.dataSource;
            if (collSett)
                collSett.commitAsync();
        }
    });

    if (this.qChild('chbDelete').controlClass.checked == false) {
        this.device.deleteUnsync = false;
        this.device.deleteUnknown = false;
    } else {
        this.device.deleteUnsync = true;
        if (this.qChild('cbDelete').controlClass.focusedIndex == 1)
            this.device.deleteUnknown = true
        else
            this.device.deleteUnknown = false;
    }
    this.device.deleteConfirm = this.qChild('chbDeleteConfirm').controlClass.checked;

    if (this.contentSelectionMode) {
        var sett = mediaSyncDevices.getCustomSettings(this.device);
        sett.deleteAfterUpload = !this.qChild('chbCacheContent').controlClass.checked;
        mediaSyncDevices.setCustomSettings(this.device, sett);
    }

};
