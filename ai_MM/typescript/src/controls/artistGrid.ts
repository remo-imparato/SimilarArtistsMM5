'use strict';

registerFileImport('controls/artistGrid');

import MediaItemGrid from './mediaItemGrid';
import './statusbar';
import '../templates';

requirejs('helpers/searchTools');

/**
 * UI ArtistGrid element
 */
export default class ArtistGrid extends MediaItemGrid {
    personID: any;
    _tracks: any;
    _change: any;
    disableStatusbar: boolean;

    initialize(rootelem, params) {
        super.initialize(rootelem, params);
        this.popupSupport = true;
        this.isHorizontal = false;
        this.isGrouped = false; // grouping does not work well for vertical LVs, there is sometimes problem in item placing, they do not stretch after adding group legend

        let _this = this;
        let _item = undefined;

        //TODO: update based on modify event
        let updateItem = function (origIndex, origItem) {
            if (!_this.dataSource)
                return;
            let div = _this.getDiv(origIndex);
            _this.dataSource.locked(function () {
                _item = _this.dataSource.getFastObject(origIndex, _item);
            }.bind(this)); // @ts-ignore
            if (div && div.artworkDiv && div.noaa && _item && (_item.name === origItem.name)) { // @ts-ignore
                div.srcAsAssigned = ''; // to force reload
                templates.itemImageFunc(div, origItem, div.itemIndex, {
                    useCoverImage: true,
                    isAutoSearch: true,
                    imgSearchFunc: searchTools.getArtistImage,
                    uid: _this.uniqueID
                });
            }
        };

        if (window.uitools.getCanEdit()) {
            this.addToContextMenu([{
                action: {
                    title: actions.coverLookup.title,
                    icon: actions.coverLookup.icon,

                    visible: function () {
                        let retval = false;
                        let idx = _this.focusedIndex;
                        if (idx < 0)
                            return false;
                        let div = _this.getDiv(idx); // @ts-ignore
                        return !!(div && div.artworkDiv);
                    },

                    execute: function () {
                        let origIndex = _this.focusedIndex;
                        if (origIndex < 0)
                            return;
                        let origItem = undefined;
                        _this.dataSource.locked(function () {
                            origItem = _this.dataSource.getValue(origIndex);
                        });
                        if (!origItem)
                            return;
                        searchTools.searchArtistImageDlg(origItem, function () {
                            updateItem(origIndex, origItem);
                        }, {
                            uid: _this.uniqueID,
                            highPriority: true
                        });
                    }
                },
                order: 100, // as last in group
                grouporder: 50, // should be same as auto-tag
            }]);
        }

        if (params && params.icon)
            this.noThumbIcon = params.icon;
        else
            this.noThumbIcon = 'person';

        let loadSettings = function () {
            let sett = settings.get('Options');
            this.autoDownloadImage = sett.Options.SearchMissingArtistImage;
        }.bind(this);

        loadSettings();

        this.localListen(settings.observer, 'change', function () {
            let oldAutoDownload = this.autoDownloadImage;
            loadSettings();
            if ((this.autoDownloadImage !== oldAutoDownload)) {
                this.invalidateAll();
            }
        }.bind(this));
    }

    setUpDiv(div) {
        templates.imageItem(div, templates.imageItemsParams.artistsGrid.call(this));
    }

    renderPopup(div, item, scrollToView) {
        let LV = div.parentListView;
        return templates.popupRenderers.artist(LV, div, item, scrollToView, this.personID);
    }

    cleanUp() {
        if (searchTools.interfaces.artistSearch)
            searchTools.cancelSearch(searchTools.interfaces.artistSearch, this.uniqueID);
        if (this._tracks && this._change)
            app.unlisten(this._tracks, 'change', this._change);
        super.cleanUp();
    }

    canDrop(e) {
        return dnd.isAllowedType(e, 'cover');
    }

    dragOver(e) {

    }

    drop(e) {
        // detect hovered item
        let lvPos = findScreenPos(this.container);
        let itemIndex;
        if ((e.screenX !== undefined) && (e.screenY !== undefined)) {
            lvPos.left = e.screenX - lvPos.left;
            lvPos.top = e.screenY - lvPos.top;
            itemIndex = this.getItemFromRelativePosition(lvPos.left, lvPos.top);
        } else {
            itemIndex = this.focusedIndex;
        }
        let _this = this;

        if (itemIndex >= 0 && this.dataSource) {
            let item;
            this.dataSource.locked(function () {
                item = this.dataSource.getValue(itemIndex);
            }.bind(this));
            if (item) {
                dnd.handleDroppedCover(e, function (picturePath, mydiv) {
                    item.saveThumbAsync(picturePath).then(function () {
                        _this.rebind();
                    });
                });
            }
        }
    }

    prepareDataSource(tracks, personID, cachedDS) {
        this.personID = personID || 'artist';
        if (webApp) {
            let coll = nodeUtils.getNodeCollection(this.parentView.viewNode);
            if (coll) {
                return coll.getPersonList(personID);
            }
        } else {
            if (this._tracks) {
                if (this._change) {
                    app.unlisten(this._tracks, 'change', this._change);
                    this._change = undefined;
                }
            }
            this._tracks = tracks;
            if (this._tracks) {
                if (this._tracks.getPersonList) {
                    this._change = app.listen(this._tracks, 'change', function (e) {
                        if (e === 'newcontent') {
                            this.dataSource = this._tracks.getPersonList(personID);
                        }
                    }.bind(this));
                    if (cachedDS) {
                        return cachedDS;
                    } else
                        return this._tracks.getPersonList(personID);
                } else {
                    return this._tracks;
                }
            } else
            if (cachedDS)
                return cachedDS;
        }
        return undefined;
    }
    formatStatus(data) {
        if (this.disableStatusbar || !data)
            return '';
        return statusbarFormatters.formatDefaultSimpleStatus(data, function (cnt) {
            return _('artist', 'artists', cnt);
        });
    }
}
registerClass(ArtistGrid);
