'use strict';

/**
@module UI
*/

export class ValueLink<T> {
    private _object: T;

    constructor(sourceObject: T) {
        this.initialize(sourceObject);
    }

    initialize(sourceObject: T) {
        this._object = sourceObject;
    }
    
    get() {
        return this._object;
    }
    
    getFastAccess() {
        return this._object;
    }
}
registerClass(ValueLink);



/**
Base class for wrapper, which wraps JS array, so it can be used as dataSource of LV's.

@class ArrayDataSource
@constructor
*/
export default class ArrayDataSource<
    T extends {selected?: boolean, checked?: boolean, title?: string} = any
> 
// implements TrackDataSource<T> 
{
    private _items: T[];
    private _focusedIndex: number;
    private _lockUpdateCount: number;
    private _updateSuspendCount: number;
    private _dontNotify: number;
    private _isLoaded: boolean;
    private _loadedEvents: ((obj: this) => void)[];
    sortCompare: (a: T, b: T) => number;
    
    event_focuschange: (newIdx: number, oldIdx: number) => void;

    constructor(sourceArray, params?) {
        this.initialize(sourceArray, params);
    }

    initialize(sourceArray: T[], params) {
        this._items = sourceArray.slice();
        this._focusedIndex = -1;
        this._lockUpdateCount = 0;
        this._updateSuspendCount = 0;
        this._dontNotify = 0;
        if (params && params.isLoaded)
            this._isLoaded = true;
        else
            this._isLoaded = false;
        this._loadedEvents = [];
    }

    add(item: T) {
        this.beginUpdate();
        this._items.push(item);
        this.endUpdate();
    }

    insert(index: number, item: T) {
        this.beginUpdate();
        this._items.splice(index, 0, item);
        this.endUpdate();
    }

    delete(index: number) {
        this.beginUpdate();
        this._items.splice(index, 1);
        this.endUpdate();
    }

    remove(item: T) {
        this.beginUpdate();
        for (let i = 0; i < this._items.length; i++) {
            if (this._items[i] === item) {
                this._items.splice(i, 1);
                break;
            }
        }
        this.endUpdate();
    }

    // todo: create a 
    addList(list) {
        let _this = this;
        this.beginUpdate();
        list.locked(function () {
            list.forEach(function (item) {
                _this._items.push(item);
            });
        });
        this.endUpdate();
    }

    clear() {
        this.beginUpdate();
        this._items.length = 0;
        this.endUpdate();
    }

    indexOf(value) {
        let isObjects = false;
        if (this._items.length)
            isObjects = typeof this._items[0] === 'object';
        if (isObjects) {
            for (let i = 0; i < this._items.length; i++) {
                if (this._items[i].toString() === value)
                    return i;
            }
        }

        return this._items.indexOf(value);
    }

    indexOfCI(value) {
        let isObjects = false;
        let val = value.toUpperCase();
        if (this._items.length)
            isObjects = typeof this._items[0] === 'object';
        if (isObjects) {
            for (let i = 0; i < this._items.length; i++) {
                if (this._items[i].toString().toUpperCase() === val)
                    return i;
            }
        }

        return this._items.indexOf(value);
    }

    toString() {
        let ret = '';
        for (let i = 0; i < this._items.length; i++) {
            let item = this._items[i];
            if (item.checked) {
                if (ret)
                    ret += ';';
                ret += item.title;
            }
        }
        return ret;
    }

    // todo: capture?
    addEventListener(event, func) {
        let varname = 'listeners_' + event;
        this[varname] = this[varname] || [];
        this[varname].push(func);
    }

    // todo: capture?
    removeEventListener(event, func) {
        let varname = 'listeners_' + event;
        let idx = this[varname].indexOf(func);
        if (idx >= 0)
            this[varname].splice(idx, 1);
    }

    isMixedStateAsync() {
        return new Promise(function (resolve) {
            let info = {
                frstState: false,
                isMixed: false
            };
            let list = this.getCheckedList();
            info.isMixed = (list.length > 0) && (list.length != this._items.length);
            info.frstState = (list.length > 0);

            resolve(info);
        }.bind(this));
    }

    getAllValues(key) {
        let res = [];
        for (let i = 0; i < this._items.length; i++) {
            let item = this._items[i];
            if (item[key]) {
                res.push([key]);
            } else
                res.push(item); // like StringList
        }
        return res;
    }

    callEvent(event, ...evArgs) {
        if (this._lockUpdateCount > 0)
            return;
        let varname = 'listeners_' + event;
        let l = this[varname];
        let _this = this;
        if (l) {
            forEach(l, function (func) {
                func.apply(_this, evArgs);
            });
        }
    }

    locked(func: procedure) {
        if (func)
            func();
    }

    getFastObject(index: number) {
        return this._items[index];
    }

    clearSelection() {
        forEach(this._items, function (item) {
            item.selected = false;
        });
        this.callEvent('change');
    }

    getSelectedList() {
        let selArray = [];
        forEach(this._items, function (item) {
            if (item.selected)
                selArray.push(item);
        });
        return new ArrayDataSource(selArray, {
            isLoaded: true
        });
    }

    getSelectedTracklist() {
        let selArray = [];
        forEach(this._items, function (item) {
            if (item.selected)
                selArray.push(item);
        });
        let sl = app.utils.createTracklist(false /* do not set loaded flag */);

        let addTracklist = function (i) {
            let item = selArray[i];
            if (item && item.getTracklist) {
                let tl = item.getTracklist();
                tl.whenLoaded().then(function () {
                    sl.addList(tl);
                    i++;
                    if (i < selArray.length)
                        addTracklist(i);
                    else
                        sl.notifyLoaded();
                });
            } else
                sl.notifyLoaded();
        };

        if (selArray.length > 0) {
            addTracklist(0);
        } else {
            sl.notifyLoaded();
        }

        return sl;
    }

    hasItemSelected() {
        let i = 0;
        let result = false;
        while (!result && (i < this._items.length)) {
            result = this._items[i].selected;
            i++;
        }
        return result;
    }

    getCheckedList() {
        let selArray = [];
        forEach(this._items, function (item) {
            if (item.checked)
                selArray.push(item);
        });
        return new ArrayDataSource(selArray, {
            isLoaded: true
        });
    }

    selectRangeAsync(fromIndex, toIndex, doSelect) {
        if (doSelect === undefined)
            doSelect = true;

        let item;
        if (fromIndex > toIndex) {
            let x = toIndex;
            toIndex = fromIndex;
            fromIndex = x;
        }
        for (let i = fromIndex; i <= toIndex; i++) {
            item = this._items[i];
            if (item)
                item.selected = doSelect;
        }
        this.callEvent('change');
        return new Promise<void>(function (resolve) {
            resolve();
        });
    }

    getValueLink(index) {
        return new ValueLink(this._items[index]);
    }

    modifyAsync(func) {
        return new Promise<void>(function (resolve) {
            func();
            resolve();
        });
    }

    forEach(func) {
        forEach(this._items, function (item, idx) {
            func(item, idx);
        });
    }

    beginUpdate() {
        this._lockUpdateCount++;
    }

    endUpdate() {
        this._lockUpdateCount--;
        if (this._lockUpdateCount === 0) {
            this.sort();
            this.callEvent('change');
        }
    }

    setSelected(index, value) {
        let item = this._items[index];
        if (item) {
            item.selected = value;
            this.callEvent('change', 'modify', index, item, 'foo', 'bar');
        }
    }

    isSelected(index) {
        let item = this._items[index];
        if (item)
            return !!item.selected;
        else
            return false;
    }

    setChecked(index, value) {
        let item = this._items[index];
        if (item) {
            item.checked = value;
            this.callEvent('change', 'modify', index, item);
        }
    }

    isChecked(index) {
        let item = this._items[index];
        if (item)
            return !!item.checked;
        else
            return false;
    }

    /** @hidden */
    copySelectionAsync(/* sourceList */) {
        // not implemented
        return new Promise<void>(function (resolve) {
            resolve();
        });
    }

    moveSelectionTo(newIndex) {
        this.beginUpdate();
        if (this.focusedIndex <= newIndex)
            newIndex--;
        this._items.splice(newIndex, 0, this._items.splice(this.focusedIndex, 1)[0]);
        this.focusedIndex = newIndex;
        this.endUpdate();
    }

    getValue(index) {
        return this._items[index];
    }

    notifyLoaded() {
        if (!this._isLoaded) {
            let _this = this;
            this._isLoaded = true;
            this._loadedEvents.forEach(function (resolveFunc) {
                resolveFunc(_this);
            });
        }
    }

    whenLoaded() {
        let _this = this;
        let pr = new Promise(function (resolve) {
            if (_this._isLoaded)
                resolve(_this);
            else
                _this._loadedEvents.push(resolve);
        }) as Promise<ArrayDataSource<T>>;
        return pr;
    }

    setAutoSort(value: string) {
        let sortCols = value.split(';');
        let compareFuncTxt = '';
        forEach(sortCols, function (colInfo) {
            let colSplit = colInfo.split(' ');
            let column = colSplit[0];
            let desc = (colSplit[1] === 'DESC');
            let sign1 = desc ? '<' : '>';
            let sign2 = desc ? '>' : '<';
            compareFuncTxt += 'if(i1.' + column + sign1 + 'i2.' + column + ') return 1;';
            compareFuncTxt += 'if(i1.' + column + sign2 + 'i2.' + column + ') return -1;';
        });
        compareFuncTxt += 'return 0;';
        this.sortCompare = new Function('i1', 'i2', compareFuncTxt) as typeof this.sortCompare;
        this.sort();
    }

    setAutoSortAsync(value: string) {
        return new Promise((resolve) => {
            this.setAutoSort(value);
            resolve(undefined);
        });
    }

    sort() {
        if (this.sortCompare && this._items) {
            this._items.sort(this.sortCompare);
        }
    }

    customSort(callback) {
        if (this._items) {
            this._items.sort(callback);
        }
    }

    getGroupsCount() {
        return 0;
    }

    getOffsetGroup() {
        return undefined;
    }

    getItemGroup() {
        return undefined;
    }

    suspendAutoUpdates() {
        this._updateSuspendCount++;
        this.beginUpdate();
    }

    resumeAutoUpdates() {
        this._updateSuspendCount--;
        this.endUpdate();
        return (this._lockUpdateCount === 0);
    }

    autoUpdatesSuspended() {
        return (this._updateSuspendCount > 0);
    }

    clearGroupsAsync() {
        return Promise.resolve(true);
    }

    prepareGroupsAsync() {
        return Promise.resolve(false);
    }

    /** @hidden */
    restoreFocusedItem(/* val */) {
        // not implemented
    }

    get itemsSelected() {
        return this.getSelectedList().count;
    }

    get count() {
        return this._items.length;
    }

    get focusedItem() {
        if (this._focusedIndex >= 0) {
            return this._items[this._focusedIndex];
        }
        return undefined;
    }

    get focusedIndex() {
        return this._focusedIndex;
    }
    set focusedIndex(value) {
        let oldIdx = this._focusedIndex;
        this._focusedIndex = value;
        if ((oldIdx !== value) && (!this.dontNotify))
            this.callEvent('focuschange', value, oldIdx);
    }

    get dontNotify() {
        return this._dontNotify > 0;
    }
    set dontNotify(value) {
        if (value)
            this._dontNotify++;
        else
            this._dontNotify--;
    }

    get statusInfo() {
        return Promise.resolve('');
    }

    get array() {
        return this._items;
    }

}
registerClass(ArrayDataSource);