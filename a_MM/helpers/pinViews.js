/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

window.pinViews = {

    prepare: function () {

        // Pinned row:
        this.pinnedContainer = this.qChild('pinned');
        this.pinnedView = this.qChild('pinnedView');
        this.pinnedViewLabel = this.qChild('pinnedLabel');

        var isPerson = function (objectType) {
            return (objectType == 'composer') || (objectType == 'conductor') ||
                (objectType == 'lyricist') || (objectType == 'producer') || (objectType == 'actor') ||
                (objectType == 'publisher') || (objectType == 'director');
        };

        var navigatePinned = function (e) {
            var item = e.detail.item.dataSource;
            var view = this.parentView;
            if (item.objectType !== 'track') {
                if (!templates.popupRenderers[item.objectType]) {
                    this.pinnedView.controlClass.cleanPopup();
                    uitools.globalSettings.showingOnline = false; // opens My Library mode

                    var nodePath = [];
                    nodePath.push(navUtils.createNodeState('root'));
                    nodePath.push(navUtils.createNodeState('pinned', app.db.getPinnedObjects()));
                    nodePath.push(navUtils.createNodeState(item.objectType, item));
                    navUtils.navigateNodePath(nodePath);

                    // this.openView(item, item.objectType, e.detail.div); // superceeded by the code above because of #18985
                }
            } else {
                app.player.addTracksAsync(item, {
                    withClear: true,
                    startPlayback: true
                });
            }
        }.bind(this);
        this.localListen(this.pinnedView, 'itemclick', navigatePinned);
        this.localListen(this.pinnedView, 'itemview', navigatePinned);
    },

    setDataSource: function (viewData) {
        if (!viewData) {
            if (this._pinnedUpdateUnlistener)
                this._pinnedUpdateUnlistener();
            this.pinnedView.controlClass.dataSource = null;
        } else {
            viewData.dataSourceCache[this.constructor.name] = viewData.dataSourceCache[this.constructor.name] || {};
            var dsCache = viewData.dataSourceCache[this.constructor.name];

            var assignPinnedList = function (list, update) {
                this.localPromise(list.whenLoaded()).then(function () {
                    if (this._cleanUpCalled)
                        return;
                    if (this.pinnedContainer)
                        setVisibility(this.pinnedContainer, list && list.count);
                    else {
                        setVisibility(this.pinnedView, list && list.count);
                        setVisibility(this.pinnedViewLabel, list && list.count);
                    }

                    this.pinnedView.controlClass.prepareDataSource(list);
                    dsCache.pinned = list;

                    if (!update) {
                        if (this._pinnedUpdateUnlistener)
                            this._pinnedUpdateUnlistener();

                        this._pinnedUpdateEvent = app.listen(list, 'change', function () {
                            assignPinnedList(list);
                        }.bind(this));
                        this._pinnedUpdateUnlistener = function () {
                            app.unlisten(list, 'change', this._pinnedUpdateEvent);
                            this._pinnedUpdateEvent = undefined;
                            this._pinnedUpdateUnlistener = undefined;
                        }.bind(this);
                    }
                }.bind(this));
            }.bind(this);

            var refreshPinned = function (e) {
                var coll = viewData.viewNode.collection;
                var collID = -1;
                if (coll)
                    collID = coll.id;
                var list = app.db.getPinnedObjects(collID);
                assignPinnedList(list);
            }.bind(this);

            if (dsCache.pinned) {
                var cached = dsCache.pinned;
                this.pinnedView.controlClass.prepareDataSource(cached);
                if (this.pinnedContainer)
                    setVisibility(this.pinnedContainer, cached.count);
                else {
                    setVisibility(this.pinnedView, cached.count);
                    setVisibility(this.pinnedViewLabel, cached.count);
                }
            } else {
                if (this.pinnedContainer)
                    setVisibility(this.pinnedContainer, false);
                else {
                    setVisibility(this.pinnedView, false);
                    setVisibility(this.pinnedViewLabel, false);
                }
                refreshPinned();
            }
        }
    }
};
