'use strict';

registerFileImport('controls/itemsListView');


/**
@module UI
*/

import ListView from './listview';

/**
UI ItemListView element - a control for showing a list of items with D&D support for reordering, 'new' command and the end and 'edit', 'delete' functions.

@class ItemListView
@constructor
@extends ListView
*/

export default class ItemListView extends ListView {
    private _newItemSupport: boolean;
    private _editItemSupport: boolean;
    private _deleteItemSupport: boolean;
    private _reorderItemsSupport: boolean;
    private _editIcon: HTMLDivElement;
    private _deleteIcon: HTMLDivElement;
    private _iconsInitialized: boolean;
    private _focusLock: boolean;

    initialize(elem, params) {
        super.initialize(elem, params);
        this._newItemSupport = true;
        this._editItemSupport = true;
        this._deleteItemSupport = true;
        this._reorderItemsSupport = true;

        this._prepareIcons();
        this.enableDragNDrop();

        this.localListen(this.container, 'itemdblclick', function (e) {
            this.onEditItem(e.detail.div.itemIndex);
        }.bind(this));

    }

    _isLast(idx) {
        return (idx === this.dataSource.count - 1);
    }

    _prepareIcons() {
        let _this = this;
        this._editIcon = document.createElement('div');
        this._editIcon.classList.add('floatRight');
        this._editIcon.classList.add('paddingColumn');
        this._editIcon.classList.add('iconHover');
        this._editIcon.style.width = '2em';
        loadIcon('edit', function (iconData) {
            _this._editIcon.innerHTML = iconData;
        });
        app.listen(this._editIcon, 'click', function () {
            if (_this.dataSource && _this.dataSource.focusedIndex >= 0 && !_this._isLast(_this.dataSource.focusedIndex))
                _this.onEditItem(_this.dataSource.focusedIndex);
        });
        this.container.appendChild(this._editIcon);
        setVisibility(this._editIcon, false);

        this._deleteIcon = document.createElement('div');
        this._deleteIcon.classList.add('floatRight');
        this._deleteIcon.classList.add('paddingColumn');
        this._deleteIcon.classList.add('iconHover');
        this._deleteIcon.style.width = '2em';
        loadIcon('delete', function (iconData) {
            _this._deleteIcon.innerHTML = iconData;
        });
        app.listen(this._deleteIcon, 'click', function () {
            if (_this.dataSource && _this.dataSource.focusedIndex >= 0 && !_this._isLast(_this.dataSource.focusedIndex))
                _this.onDeleteItem(_this.dataSource.focusedIndex);
        });
        this.container.appendChild(this._deleteIcon);
        setVisibility(this._deleteIcon, false);
    }

    afterDraw() {
        if (!this._iconsInitialized) {
            let fIdx = this.focusedIndex;
            if (this._requestedFocAndSelectIdx >= 0)
                fIdx = this._requestedFocAndSelectIdx;
            if (fIdx >= 0)
                this.handleFocusChanged(fIdx, fIdx);
        }

        super.afterDraw();
    }

    handleFocusChanged(newIndex, oldIndex) {

        let div = this.getDiv(newIndex);
        if ((newIndex >= 0) && (!div)) {
            // div cannot be found ... probably we need to redraw list ?
            this.setFocusedFullyVisible();
            return;
        }

        let isLast = this.newItemSupport ? this._isLast(newIndex) : false;

        this._iconsInitialized = true;

        if (div && !isLast) {
            if (this.editItemSupport) // @ts-ignore
                div._icons.appendChild(this._editIcon);
            if (this.deleteItemSupport) // @ts-ignore
                div._icons.appendChild(this._deleteIcon);
        }
        let showEdit = true;
        let showDelete = true;
        this.dataSource.locked(function () {
            let data = this.dataSource.getValue(newIndex);
            if (data) {
                if (data.editable === false) showEdit = false;
                if (data.deletable === false) showDelete = false;
            }
        }.bind(this));

        setVisibility(this._editIcon, div && this.editItemSupport && !isLast && showEdit);
        setVisibility(this._deleteIcon, div && this.deleteItemSupport && !isLast && showDelete);

        if (!this._focusLock) {
            if (isLast) {
                this._focusLock = true;
                this.setFocusedAndSelectedIndex(oldIndex);
                this._focusLock = undefined;
                this.onNewItem();
                return;
            }
        }

        super.handleFocusChanged(newIndex, oldIndex);
    }

    // this method can be overrided if necessary
    createNewItemEntry() {
        return '< ' + _('Add new') + ' >';
    }

    getItemText(index) {
        return resolveToValue(this.dataSource.getValue(index).title, '');
    }

    prepareDataSource(ds, newFocusedIdx) {
        ds.whenLoaded().then(() => {
            if (this.newItemSupport)
                ds.add({
                    isNew: true,
                    title: this.createNewItemEntry()
                });

            this.dataSource = ds;
            if (ds.count > 1) {
                let newIdx = 0;
                if (newFocusedIdx !== undefined)
                    newIdx = newFocusedIdx;

                this.setFocusedAndSelectedIndex(newIdx);
            }
        });
    }

    refresh() {
        this.rebind();

    }

    // these two methods can be overriden if necessary
    setUpDiv(div) {
        div.classList.add('flex');
        div.classList.add('row');
        div.innerHTML = '';

        div._title = document.createElement('div');
        div._title.classList.add('dynamic');
        div.appendChild(div._title);

        div._icons = document.createElement('div');
        div._icons.classList.add('static');
        div.appendChild(div._icons);
    }

    bindData(div, index) {
        div._title.innerText = this.getItemText(index);
        if (this._isLast(index)) {
            div._title.classList.add('textOther');
        } else if (div._title.classList.contains('textOther')) {
            div._title.classList.remove('textOther');
        }
    }

    // D&D
    getDropMode(e) : DropMode {
        return 'move';
    }

    getDragDataType() {
        return 'item';
    }

    canDrop(e) {
        let supported = dnd.getDropDataType(e) === 'item';
        if (supported) {
            let sourceControl = e.dataTransfer.getSourceControl();
            if (sourceControl && sourceControl.controlClass) {
                let newPos = sourceControl.controlClass.getDropIndex(e);
                if (newPos !== undefined) {
                    supported = !this._isLast(newPos - 1);
                }
            }
        }
        return supported;
    }

    /*drop(e) {
        
    },*/

    add(item) {
        this.dataSource.insert(this.dataSource.count - 1, item);
        this.setFocusedAndSelectedIndex(this.dataSource.count - 2);
    }

    onNewItem() {

    }

    onEditItem(index) {


    }

    onDeleteItem(index) {
        this.dataSource.delete(index);
        if (this.dataSource.count <= 1)
            this.setFocusedAndSelectedIndex(-1);
        else
            this.setFocusedAndSelectedIndex(Math.min(index, this.dataSource.count - 2));
    }
    
    get newItemSupport () {
        return this._newItemSupport;
    }
    set newItemSupport (value) {
        if (this._newItemSupport !== value) {
            this._newItemSupport = value;
            this.refresh();
        }
    }
        
    get editItemSupport () {
        return this._editItemSupport;
    }
    set editItemSupport (value) {
        if (this._editItemSupport !== value) {
            this._editItemSupport = value;
            this.refresh();
        }
    }
        
    get deleteItemSupport () {
        return this._deleteItemSupport;
    }
    set deleteItemSupport (value) {
        if (this._deleteItemSupport !== value) {
            this._deleteItemSupport = value;
            this.refresh();
        }
    }
        
    get reorderItemsSupport () {
        return this._reorderItemsSupport;
    }
    set reorderItemsSupport (value) {
        if (this._reorderItemsSupport !== value) {
            this._reorderItemsSupport = value;
            this.refresh();
        }
    }
    
}
registerClass(ItemListView);
