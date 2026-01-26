'use strict';

registerFileImport('controls/albumTracklist');

import ListView from './listview';

/**
 * UI album tracklist element
 */
export default class AlbumTracklist extends ListView {
    hasVideoContent: any;    
    private _groupSepFormatStr: any;
    initialize(rootelem, params) {
        params = params || {};
        params.groupHeaders = false;
        params.groupSeparators = true;
        params.groupSpacing = 15;
        super.initialize(rootelem, params);

        this.isSearchable = true;
        this.hasVideoContent = params.hasVideoContent || false;
        this.hasMediaContent = true;
        this.lassoSelectionEnabled = true;
        this.enableDragNDrop();
        this.helpContext = 'Filelisting';

        let tracklist = this.container;
        app.listen(tracklist, 'focuschange', function () {
            (tracklist.controlClass as ListView).raiseItemFocusChange();
        });

        this.contextMenu = function (evt) {
            return menus.createTracklistMenu(rootelem);
        };

        // handle auto sorting - simply set sortString and list will be always sorted by this rule
        if (this.dataSource && this.dataSource.setAutoSortAsync)
            this.dataSource.setAutoSortAsync(this.getDefaultSortString());
        app.listen(rootelem, 'datasourcechanged', function (e) {
            let view = this.parentView;
            this.hasVideoContent = false;
            this._groupSepFormatStr = undefined; // so correct value for new DS can be set
            if (view && view.viewNode) {
                let coll = view.viewNode.collection;
                this.hasVideoContent = (view.viewNode.handlerID === 'series') || (coll && coll.hasVideoContent && coll.hasVideoContent());
            }
            if (e.detail.newDataSource && e.detail.newDataSource.setAutoSortAsync) {
                e.detail.newDataSource.groupName = this.hasVideoContent ? 'season' : 'disc';
                e.detail.newDataSource.setAutoSortAsync(this.getDefaultSortString());
            }
        }.bind(this));
    }

    setUpDiv(div) {
        window.templates.albumTracklistItem(div, !!this.hasVideoContent);
    }

    cleanUp() {
        app.unlisten(this.container);
        this._groupSepFormatStr = undefined;
        super.cleanUp();
    }

    getDefaultSortString() {
        if (this.hasVideoContent)
            return 'series ASC;season ASC;episode ASC;title ASC';
        else
            return 'albumArtist ASC;album ASC;discNo ASC;order ASC;title ASC';
    }

    playGroupTracks(groupid, addParams) {
        let ds = this.dataSource;
        if (!ds)
            return;
        ds.locked(function () {
            let group = ds.getGroupByID(groupid);
            if (group) {
                app.player.addTracksAsync(ds.getRange(group.index, group.index + group.itemCount - 1), addParams);
            }
        });
    }

    setUpGroupSep(div) {
        div.innerHTML = ' \
            <div data-id="groupTitle" class="inline verticalCenter textSelectable"></div> \
            <div data-id="playButtons" class="inline verticalCenter left-indent-small"> \
                <div data-id="btnPlay" class="inline lvInlineIcon" data-icon="play" data-tip="Play" data-control-class="ToolButton"></div> \
                <div data-id="btnShuffle" class="inline lvInlineIcon" data-icon="shuffle" data-tip="Shuffle" data-control-class="ToolButton"></div> \
            </div>';
        initializeControls(div);

        this.localListen(qeid(div, 'btnPlay'), 'click', function () {
            this.playGroupTracks(div.getAttribute('data-groupid'), {
                withClear: true,
                startPlayback: true
            });
        }.bind(this));

        this.localListen(qeid(div, 'btnShuffle'), 'click', function () {
            this.playGroupTracks(div.getAttribute('data-groupid'), {
                withClear: true,
                startPlayback: true,
                shuffle: true
            });
        }.bind(this));
    }

    renderGroupSep(div, group) {
        let gt = qeid(div, 'groupTitle');
        if (!this._groupSepFormatStr) {
            if (this.hasVideoContent)
                this._groupSepFormatStr = _('Season %s');
            else
                this._groupSepFormatStr = _('Disc %s');
        }
        if ((group.id !== '') && isNaN(parseInt(group.id))) {
            gt.innerText = group.id;
        } else {
            gt.innerText = sprintf(this._groupSepFormatStr, group.id);
        }
        div.setAttribute('data-groupid', group.id);
    }

    canDeleteSelected() {
        if (this.dataSource) {
            let track = this.dataSource.focusedItem;
            if (track)
                return _utils.isDeletableTrack(track);
        }
    }

    canDrop(e) {
        let view = this.parentView;
        if (view) {
            let handler = getNodeHandler(view);
            return handler.canDrop && handler.canDrop(view.viewNode.dataSource, e);
        }
        return super.canDrop(e);
    }
    
    drop(e) {
        let view = this.parentView;
        if (view) {
            let handler = getNodeHandler(view);
            if (dnd.isSameControl(e) && dnd.isDropMode(e, ['move', 'none'])) {
                //dnd.listview_handleReordering(e);
            } else {
                if (handler.drop)
                    handler.drop(view.viewNode.dataSource, e /*, tracklist.controlClass.getDropIndex(e)*/ );
            }
        } else
            super.drop(e);
        this.cancelDrop();
    }
    
    formatStatus(data) {
        let view = this.parentView;
        if (view) {
            let handler = getNodeHandler(view);
            if (handler.formatStatus)
                return handler.formatStatus(data);
        }
        return statusbarFormatters.formatTracklistStatus(data);
    }
    
}
registerClass(AlbumTracklist);