/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

'use strict';
/**
@module UI
*/
import Control from './control';
/**
Buttons to control ListView (move up, move down, edit, delete, new)

@class ListEditButtons
@constructor
@extends Control
*/
class ListEditButtons extends Control {
    initialize(elem, params) {
        super.initialize(elem, params);
        this.container.innerHTML = loadFile('file:///controls/listEditButtons.html');
        initializeControls(this.container);
        this.lastItemEditable = true;
        this.firstItemDeletable = true;
        this._beforeDeleteMethod = undefined;
        this.buttons = getAllUIElements(this.container);
        this.buttons.up = this.qChild('btnMoveUp');
        if (params && params.hideUp)
            setVisibility(this.buttons.up, false);
        this.buttons.down = this.qChild('btnMoveDown');
        if (params && params.hideDown)
            setVisibility(this.buttons.down, false);
        this.buttons.new = this.qChild('btnNew');
        if (params && params.hideNew)
            setVisibility(this.buttons.new, false);
        this.buttons.edit = this.qChild('btnEdit');
        if (params && params.hideEdit)
            setVisibility(this.buttons.edit, false);
        this.buttons.delete = this.qChild('btnDelete');
        if (params && params.hideDelete)
            setVisibility(this.buttons.delete, false);
        if (params) {
            if (params.buttonsOrder) {
                let order = params.buttonsOrder.split(',');
                order.forEach((item, index) => {
                    if (this.buttons[item])
                        this.buttons[item].style.order = index + 1;
                });
            }
        }
        let _this = this;
        this.localListen(this.buttons.up, 'click', () => {
            let list = this._list;
            let focused = list.focusedIndex;
            if (focused > 0) {
                list.moveSelectionTo(focused - 1);
                this.updatePositions();
            }
            this.updateDisabledState();
        });
        this.localListen(this.buttons.down, 'click', () => {
            let list = this._list;
            let focused = list.focusedIndex;
            if (focused < list.count - 1) {
                list.moveSelectionTo(focused + 2); // LS: 2 needs to be here (1 to go over "self" + 1 to place it below the next item)                
                this.updatePositions();
            }
            this.updateDisabledState();
        });
        this.deletedItems = [];
        this.localListen(this.buttons.delete, 'click', function () {
            let proc = () => {
                let list = _this._list;
                let focused = list.focusedIndex;
                if (focused >= 0) {
                    list.locked(function () {
                        let item = list.getValue(focused);
                        if (item.setDeleteFlag)
                            item.setDeleteFlag();
                        _this.deletedItems.push(item);
                    });
                    list.delete(focused);
                    if (focused >= list.count)
                        focused = list.count - 1;
                    list.focusedIndex = Math.min(focused, list.count - 1);
                    list.modifyAsync(() => {
                        if (focused < list.count && (focused >= 0) && !list.isSelected(focused)) {
                            list.setSelected(focused, true);
                        }
                    });
                }
                _this.updateDisabledState();
            };
            if (_this._beforeDeleteMethod && isFunction(_this._beforeDeleteMethod)) {
                let ret = _this._beforeDeleteMethod();
                if (isPromise(ret)) {
                    ret.then(() => {
                        proc();
                    });
                    return;
                }
            }
            proc();
        });
    }
    updateDisabledState() {
        let focused = this._list.focusedIndex;
        let count = this._list.count;
        let last = focused == count - 1;
        let empty = count == 0;
        if (this.lastItemEditable) {
            this.buttons.up.controlClass.disabled = (focused <= 0);
            this.buttons.down.controlClass.disabled = (focused < 0) || (focused == count - 1);
        }
        else {
            this.buttons.up.controlClass.disabled = (last) || (focused <= 0);
            this.buttons.down.controlClass.disabled = (last) || (focused < 0) || (focused == count - 2);
        }
        let item = undefined;
        if ((focused > -1) && isFunction(this.itemMovableableCallback)) {
            let list = this._list;
            list.locked(function () {
                item = list.getValue(focused);
            });
            if (!this.buttons.up.controlClass.disabled) {
                this.buttons.up.controlClass.disabled = !this.itemMovableableCallback(item, focused, true, list);
            }
            if (!this.buttons.down.controlClass.disabled) {
                this.buttons.down.controlClass.disabled = !this.itemMovableableCallback(item, focused, false, list);
            }
        }
        if ((typeof this.itemEditableCallback === 'function') &&
            (typeof this.itemDeletableCallback === 'function')) {
            if (!item) {
                let list = this._list;
                list.locked(function () {
                    item = list.getValue(focused);
                });
            }
            this.buttons.edit.controlClass.disabled = !this.itemEditableCallback(item) || empty;
            this.buttons.delete.controlClass.disabled = !this.itemDeletableCallback(item) || empty;
        }
        else {
            if (this.lastItemEditable) {
                this.buttons.edit.controlClass.disabled = (focused < 0) || empty;
                this.buttons.delete.controlClass.disabled = (focused < 0) || empty;
            }
            else {
                this.buttons.edit.controlClass.disabled = (last) || (focused == -1) || empty;
                this.buttons.delete.controlClass.disabled = (last) || (focused == -1) || empty;
            }
            if (!this.firstItemDeletable && (focused == 0))
                this.buttons.delete.controlClass.disabled = true;
        }
        this.buttons.new.controlClass.disabled = false;
    }
    updatePositions() {
        let list = this._list;
        list.locked(function () {
            list.beginUpdate();
            for (let i = 0; i < list.count; i++) {
                let obj = list.getValue(i);
                if (isObjectLiteral(obj))
                    obj.pos = i + 1;
            }
            list.endUpdate();
        });
        if (this.listView)
            this.listView.controlClass.setFocusedFullyVisible();
    }
    get dataSource() {
        return this._list;
    }
    set dataSource(value) {
        let _this = this;
        if (this._list && this.__lastChangeListener)
            app.unlisten(this._list, 'focuschange', this.__lastChangeListener);
        this._list = value;
        this.__lastChangeListener = this.localListen(this._list, 'focuschange', function () {
            _this.updateDisabledState();
        });
        this.updateDisabledState();
    }
    get beforeDeleteMethod() {
        return this._beforeDeleteMethod;
    }
    set beforeDeleteMethod(method) {
        this._beforeDeleteMethod = method;
    }
}
registerClass(ListEditButtons);
