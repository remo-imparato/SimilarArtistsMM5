'use strict';

registerFileImport('controls/artworkList');

import ListView from './listview';
import '../actions';

/**
 * UI ArtworkList element
 */
export default class ArtworkList extends ListView {
    reinsertedArtworks: any[];
    private _showDetails: boolean;
    readOnly: boolean;

    initialize(rootelem, params) {
        super.initialize(rootelem, params);
        this.enableDragNDrop();
        this.itemCloningAllowed = false;
        this.itemRowSpacing = 8;
        this.contextMenu = menus.createArtworkListMenu(this.container);
        this.addArtworkRules = {
            showApply2Album: true,
            deletedArtworks:[],
        };
        this.reinsertedArtworks = [];
        this._showDetails = false;
    }
    
    handleItemDelete(itemIndex, obj) {
        if(obj) {
            let deletedCover = obj.get();
            if(deletedCover.coverStorage === 1) { // csFile
                let fn = getJustFilename(deletedCover.picturePath);
                this.addArtworkRules.deletedArtworks.push(fn);
                let idx = this.reinsertedArtworks.indexOf(fn);
                if(idx >= 0) {
                    this.reinsertedArtworks.splice(idx, 1);
                }
                
                ODS('--- deleted: ' + fn);
            }
        }
        super.handleItemDelete(itemIndex, obj);
        
    }
    
    handleItemInsert(itemIndex, obj) {
        if(obj) {
            let insertedCover = obj.get();
            if(insertedCover.coverStorage === 1) { // csFile
                let fn = getJustFilename(insertedCover.picturePath);
                ODS('--- inserted: ' + fn);
                let idx = this.addArtworkRules.deletedArtworks.indexOf(fn);
                if(idx >= 0) {
                    if(this.reinsertedArtworks.indexOf(fn)<0) {
                        this.reinsertedArtworks.push(fn);
                    }
                    this.addArtworkRules.deletedArtworks.splice(idx, 1);
                    ODS('--- deleted from deleted array: ' + fn);
                }
            } else
                ODS('--- inserted: coverStorage ' + insertedCover.coverStorage);
        }
        super.handleItemInsert(itemIndex, obj);
    }
    
    setUpDiv(div) {
        div.classList.add('griditemHeight');
        div.classList.add('artworkListItem');
        window.templates.artworkListItem(div);
    }

    canDrop(e) {
        if (this.readOnly)
            return false;
        if (dnd.isSameControl(e))
            return true;
        else
            return this.dndEventsRegistered && dnd.isAllowedType(e, 'cover');
    }

    drop(e) {
        if (dnd.isSameControl(e))
            dnd.listview_handleReordering(e);
        else {
            let info = this.addArtworkRules;
            if (dnd.droppingFileNames(e) && info.track) {
                let items = dnd.getDragObject(e, 'cover');
                let fnames = [];
                items.locked(function () {
                    for (let i = 0; i < items.count; i++) {
                        fnames.push(items.getValue(i));
                    }
                });
                if (fnames.length > 0) {
                    let showAddDialog = function (idx) {
                        let fn = fnames[idx];
                        uitools.addNewArtwork(fn, {
                            track: info.track,
                            album: info.album,
                            showApply2Album: info.showApply2Album,
                            doNotSave: info.doNotSave,
                            showReplace: info.showReplace,
                            deletedArtworks: info.deletedArtworks
                        }).then(function () {
                            idx++;
                            if ((idx < fnames.length) && (!this._cleanUpCalled)) {
                                showAddDialog(idx);
                            }
                        }.bind(this));
                    }.bind(this);
                    showAddDialog(0);
                }
            }
            this.cancelDrop();
        }
    }

    mouseWheelHandler(e) {
        window.notifyCloseDropdownLists(); // #17514
        super.mouseWheelHandler(e);
    }
    
    get showDetails() {
        return this._showDetails;
    }
    set showDetails(show) {
        if (this._showDetails != show) {
            this._showDetails = show;
            this.invalidateAll();
        }
    }   
}
registerClass(ArtworkList);

if (!window.menus) window.menus = {};

window.menus.createArtworkListMenu = window.menus.createArtworkListMenu || function (parent) {
    let items;
    if (window.uitools.getCanEdit()) {
        items = [
            {
                action: window.actions.paste,
                order: 10,
                grouporder: 10
            },
            {
                action: window.actions.coverLookup,
                order: 20,
                grouporder: 10
            },
            {
                action: window.actions.coverShow,
                order: 30,
                grouporder: 10
            },
            {
                action: window.actions.coverSave,
                order: 40,
                grouporder: 10
            },
            {
                action: window.actions.coverRemove,
                order: 50,
                grouporder: 10
            },
        ];
    } else {
        items = [{
            action: window.actions.coverShow,
            order: 30,
            grouporder: 10
        }];
    }
    return new Menu(items, {
        parent: parent
    });
};