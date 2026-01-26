'use strict';

/**
@module UI
*/

import NodeListView from './nodeListView';
import './trackListView';

/**
UI element to represent nodes as list view

@class PinnedListView
@constructor
@extends ListView
*/


export default class PinnedListView extends NodeListView {    
    private _myFocusedItem: any;
    private _tree: SharedTree;
    private _rawDataSource: any;

    initialize(rootelem, params) {
        super.initialize(rootelem, params);

        this.isGrid = true;
        this.isSearchable = true;
        this.hasMediaContent = true;
        this.popupSupport = true;
        this.itemCloningAllowed = false;
        this._myFocusedItem;
        this.helpContext = 'My Computer#Pinned';

        let _getItem = () => {
            if (this._myFocusedItem)
                return this._myFocusedItem.dataSource;
            return undefined;
        };

        this.contextMenu = menus.createTracklistMenu(this.container, _getItem);
        this.addToContextMenu([{
            action: actions.unpin,
            order: 10,
            grouporder: 10 // to be the very first item (per #16446)
        }]);

        this.localListen(this.container, 'focuschange', (e) => {
            this._myFocusedItem = this.focusedItem;
        });

        this.enableDragNDrop();
        this._initDrop();
    }

    cleanUp() {
        nodeUtils.cancelNode(this.lastNode);
        super.cleanUp();
    }

    focusChangeHandle() {
        // override this method to prevent NodeListView overwrite our menu
    }

    setUpDiv(div) {
        if (this.smallItemSize)
            div.classList.add('smallItem');
        templates.imageItem(div, {
            imgBind: 'func: var currItem = item.dataSource ? item.dataSource : item; templates.itemImageFunc(div, currItem, div.itemIndex, {useCoverImage: true});',
            uimgBind: 'func: if (item.dataSource) templates.nodeIconFunc(div, item);',
            line1Bind: 'func: var currItem = item.dataSource ? item.dataSource : item; if (currItem[\'name\'] !== undefined) { if (currItem.name === \'\') el.textContent = _(\'Unknown\'); else el.textContent = currItem.name; } else if (currItem.trackTypeStringId === \'radio\') { if (currItem[\'album\'] !== \'\') el.textContent = currItem[\'album\']; else el.textContent = currItem[\'title\']; } else if (currItem[\'title\'] !== undefined) { if (currItem.title === \'\') el.textContent = _(\'Unknown\'); else el.textContent = currItem.title; }',
            line2Bind: 'func: var currItem = item.dataSource ? item.dataSource : item; ' +
                'if (currItem.objectType === \'album\') { ' +
                '  if (currItem.albumArtist === \'\') ' +
                '    el.textContent = \'\'; ' +
                '  else ' +
                '    el.textContent = currItem.albumArtist; ' +
                '  } else if (currItem.objectType === \'track\' && currItem.trackTypeStringId !== \'radio\') { ' +
                '    el.textContent = currItem.album; ' +
                '    if (currItem.album !== \'\' && currItem.albumArtist !== \'\') ' +
                '      el.textContent += \' (\'+currItem.albumArtist+\')\'; ' +
                '  } else el.textContent = \'\';',
            useCoverImage: true
        });
    }

    renderPopup(div, item, scrollToView) {
        if (item) {
            let LV = div.parentListView;
            let currItem = item.dataSource ? item.dataSource : item;
            if (templates.popupRenderers[currItem.objectType]) {
                // popup supported for this item
                return templates.popupRenderers[currItem.objectType](LV, div, currItem, scrollToView);
            } else {
                // popup not supported for this item
                if (div.controlClass)
                    div.controlClass.cleanUp();
            }
        } else {
            // no item -> only refresh popup size
            if (div.controlClass && div.controlClass.updatePopupSize)
                div.controlClass.updatePopupSize(true, scrollToView);
        }
    }

    filterSource(phrase) {
        if (this.dataSource && this.dataSource.objectType === 'sharednodelist')
            super.filterSource(phrase);
    }

    getTracklist() {
        let rs = this.rawDataSource;
        if (rs && rs.focusedItem) {
            if (rs.focusedItem.getTracklist)
                return rs.focusedItem.getTracklist();
            else if (rs.focusedItem.objectType == 'track') {
                let tracks = app.utils.createTracklist(true);
                tracks.add(rs.focusedItem);
                return tracks;
            }
        }
        return;
    }

    prepareDataSource(list) {

        this.dataSourceUnlistenFuncts();

        let _assignSource = (list) => {
            let tree = app.createTree();
            list.forEach((item) => {
                tree.root.addChild(item, item.objectType);
            });
            this.dataSource = tree.root.children;
            this._tree = tree; // need to be stored to increase reference
            this._rawDataSource = list;
        };
        _assignSource(list);

        this.dataSourceListen(list, 'change', () => {
            _assignSource(list);
        });

    }

    canDrop(e) {
        return dnd.isAllowedType(e, 'media');
    }

    _initDrop() {
        this.drop = function (e) {
            if (dnd.isSameControl(e) && dnd.isDropMode(e, ['move', 'none'])) {
                let pos = this.getDropIndex(e);
                let ds = this.dataSource;
                ds.autoSort = false;
                ds.moveSelectionTo(pos);

            } else {
                // this is pinning new item, just check whether the item isn't track to be dropped into a pinned playlist:
                let playlist : Playlist;
                let lvPos = findScreenPos(this.container);                
                if ((e.screenX !== undefined) && (e.screenY !== undefined)) {
                    lvPos.left = e.screenX - lvPos.left;
                    lvPos.top = e.screenY - lvPos.top;
                    let itemIndex = this.getItemFromRelativePosition(lvPos.left, lvPos.top);
                    if (itemIndex >= 0 && this.dataSource) { 
                        let itm;                       
                        this.dataSource.locked(function () {
                            itm = this.dataSource.getValue(itemIndex);
                        }.bind(this));
                        if (itm) {
                            if (itm.objectType == 'node' && itm.dataSource && itm.dataSource.objectType == 'playlist')
                                playlist = itm.dataSource;
                            else
                            if (itm.objectType == 'playlist')                            
                                playlist = itm;
                        }
                    }
                } 
                
                let _pinItem = (item) => {
                    if (playlist && item.objectType == 'track') {
                        // add track to a playlist:
                        playlist.addTrackAsync(item);
                    } else {
                        // pin new item:
                        let act = bindAction(actions.pin, item);
                        act.execute();
                    }
                };
                let obj = dnd.getDragObject(e);
                if (obj.whenLoaded) { // list
                    obj.whenLoaded().then(() => {
                        listForEach(obj, (itm) => {
                            _pinItem(itm);
                        });
                    });
                } else
                if (obj) {
                    _pinItem(obj);
                }
            }
        }.bind(this);
    }

    get rawDataSource() {
        let ds = this._rawDataSource;
        if (!ds && this.dataSource) {
            ds = app.utils.createSharedList();
            this.dataSource.locked(() => {
                for (let i = 0; i < this.dataSource.count; i++) {
                    ds.add(this.dataSource.getValue(i).dataSource);
                }
            });
            ds.notifyLoaded();
        }
        if (this.dataSource && this.dataSource.focusedItem) {
            ds.clearSelection();
            ds.focusedIndex = this.dataSource.focusedIndex;
            ds.selectRange(ds.focusedIndex, ds.focusedIndex, true);
        }
        return ds;
    }
    set rawDataSource(value) {
        this._rawDataSource = value;
    }

}
registerClass(PinnedListView);
