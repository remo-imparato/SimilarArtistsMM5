/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

// Methods for loading our windows in Chrome (without tha app backend support)

var _sep = (window['getCommandSeparator'] ? window['getCommandSeparator']() : '/');
var mainQueryData = null;
var __player = null;
var isMainWindow = true;

function concatObjects(o1, o2) {
    for (var key in o2)
        o1[key] = o2[key];
    return o1;
};

function strToBool(val) {
    if (typeof val === 'string') {
        return (val === 'true') ? true : false;
    }
    return val;
}

/////////////////////////////////////////////////////////////////////
// raiseEvent - raises custom event on object
/////////////////////////////////////////////////////////////////////
function raiseEvent(object, eventName, eventType, itemIndex, obj) {
    var params = {
        detail: {
            eventType: eventType,
            itemIndex: itemIndex,
            obj: obj
        }
    };
    params.cancelable = true;
    params.bubbles = true;
    var event = createNewCustomEvent(eventName, params);
    if (object.dispatchEvent)
        object.dispatchEvent(event);
    else
        document.body.dispatchEvent(event);

    return event.returnValue;
}

/////////////////////////////////////////////////////////////////////
// getSampleAlbumList - create and get default albums list
/////////////////////////////////////////////////////////////////////
function getSampleAlbumList() {
    var list = getSharedList();

    list.beginUpdate();
    for (var i = 0; i < 10000; i++) {
        list.add(getAlbum());
    }
    list.endUpdate();

    list.getGroups = function () {
        var groups = [{
            id: 'A',
            index: 0
        }, {
            id: 'B',
            index: 2
        }, {
            id: 'C',
            index: 3
        }, {
            id: 'D',
            index: 7
        }];
        return groups;
    };

    return list;
}

/////////////////////////////////////////////////////////////////////
// CustomEventTarget - base for JS objects required sending events
/////////////////////////////////////////////////////////////////////
function CustomEventTarget() {
    this._init();
}

CustomEventTarget.prototype._init = function () {
    this._registrations = {};
};

CustomEventTarget.prototype._getListeners = function (type, useCapture) {
    var captype = (useCapture ? '1' : '0') + type;
    if (!(captype in this._registrations))
        this._registrations[captype] = [];
    return this._registrations[captype];
};

CustomEventTarget.prototype.addEventListener = function (type, listener, useCapture) {
    var listeners = this._getListeners(type, useCapture);
    var ix = listeners.indexOf(listener);
    if (ix === -1)
        listeners.push(listener);
};

CustomEventTarget.prototype.removeEventListener = function (type, listener, useCapture) {
    var listeners = this._getListeners(type, useCapture);
    var ix = listeners.indexOf(listener);
    if (ix !== -1)
        listeners.splice(ix, 1);
};

CustomEventTarget.prototype.dispatchEvent = function (evt) {
    var listeners = this._getListeners(evt.type, false).slice();
    for (var i = 0; i < listeners.length; i++)
        listeners[i].call(this, evt.detail.eventType, evt.detail.itemIndex, evt.detail.obj);
    return !evt.defaultPrevented;
};

CustomEventTarget.prototype.notifyChanged = function () {
    raiseEvent(this, 'change', arguments);
};

/////////////////////////////////////////////////////////////////////
// Utils
/////////////////////////////////////////////////////////////////////

function addDefaultProps(cls) {
    cls.notifyChanged = function () {
        raiseEvent(this, 'change', arguments);
    };


}

function convertStringToGroup(s) {
    if (s.length == 0)
        return '#';
    else {
        var result = s[0].toUpperCase();
        if (result.charCodeAt(0) < 'A'.charCodeAt(0))
            result = '#';
        return result;
    };
};

/*function convertStringToGroup_The( s) {
  if( s.length == 0)
    return '#'
  else {
    var str1 = s;
    var Pref = The_Prefixes_C;
    while Pref<>nil do
    begin
      if pref.ASCIIonly then
      begin
        pch := str1;
        ppref := PChar( pref.prefix);
        while (pch^<>#0) and (ppref^<>#0) and (UpCase(pch^)=UpCase(ppref^)) do
        begin
          inc( pch);
          inc( ppref);
        end;
        if ppref^=#0 then
        begin
          str1 := pch;
          break;
        end;
      end
      else
      begin
        if StrLIComp( Str1, PChar(pref.prefix), pref.len)=0 then
        begin
          inc( Str1, pref.len);
          break;
        end;
      end;
      Pref := Pref.next;
    end;

    if str1^=#0 then
      result := '#'
    else
      result := UpCase(str1^);

    if ord(result[1]) < ord('A') then
      result := '#';
  }
};*/


/////////////////////////////////////////////////////////////////////
// getSharedList - default parent for all lists
/////////////////////////////////////////////////////////////////////
function getSharedList() {
    var list = new CustomEventTarget;

    list.content = [];
    list._selected = [];
    list._groups = [];
    list._groupsOK = false;
    list._loaded = false;
    list._loadedEvents = [];
    list.autoSortString = '';
    list.instanceConstructor = 'getSharedList';

    list.notifyLoaded = function () {
        if (!list._loaded) {
            list._loaded = true;
            for (var i = 0; i < list._loadedEvents.length; i++) {
                list._loadedEvents[i]();
            }
        }
    };

    list.getCount = function () {
        return list.content.length;
    };

    list.indexOf = function (item) {
        return list.content.indexOf(item);
    };

    list.indexOfCI = function (item) {
        return list.content.indexOf(item); // TODO
    };

    list._createInstance = function () {
        return getSharedList();
    };

    Object.defineProperty(list, 'count', {
        get: function () {
            return list.getCount();
        }
    });

    list.clearSelection = function () {
        list._selected.length = 0;
    };

    list.copySelectionAsync = function (ds) {
        return new Promise(function (resolved) {
            list._selected = ds._selected;
            resolved();
        });
    };

    list.removeDuplicates = function () {
        // TODO

    };

    list.assignProgress = function (progress) {
        // TODO

    };

    list.suspendAutoUpdates = function () {
        // TODO
    };

    list.resumeAutoUpdates = function () {
        // TODO
    };

    list.setSelected = function (i, sel) {
        if (sel) {
            var selItem = list.getValue(i);
            var idx = list._selected.indexOf(selItem);
            if (idx < 0)
                list._selected.push(selItem);
        } else {
            var idx = list._selected.indexOf(list.getValue(i));
            if (idx >= 0)
                list._selected.splice(idx, 1);
        }
    };

    list.isSelected = function (i) {
        return list._selected.indexOf(list.getValue(i)) >= 0;
    };

    list.hasItemSelected = function () {
        return list._selected.length > 0;
    };

    list.selectRange = function (from, to, doSelect) {
        if (from < 0 || from > list.length || to < 0 || to > list.length || from > to)
            alert('selectRange parameters error!');

        list.beginUpdate();
        for (var i = from; i <= to; i++) {
            list.setSelected(i, doSelect);
        }
        list.endUpdate();
    };

    list.getRange = function (fromIdx, toIdx) {
        if (fromIdx < 0 || fromIdx > list.length || toIdx < 0 || toIdx > list.length || fromIdx > toIdx)
            alert('getRange parameters error!');

        var ret = this._createInstance();
        this.locked(function () {
            for (var i = fromIdx; i <= toIdx; i++) {
                ret.add(list.content[i]);
            }
        }.bind(this));
        return ret;
    };

    list.doClear = function () {}

    list.clear = function () {
        list.content.length = 0;
        list._selected.length = 0;
        list._focusedNode = 0;
        list._groupsOK = false;
        raiseEvent(list, 'change');
        list.doClear();
    };

    list.locked = function (fn) {
        fn.bind(window)();
    };

    list.modifyAsync = function (fn) {
        fn.bind(window)();
    };

    list.asyncFill = function () { // TODO
        return new Promise((resolve, reject) => {
            resolve();
        });
    };

    list.forEach = function (callback) {
        for (var i = 0; i < list.count; i++) {
            callback(list.content[i]);
        };
    };

    list.checkUpdate = function () {};

    list.getValue = function (i) {
        return list.content[i];
    };

    list.getValueLink = function (i) {
        return getObjectLink(list.getValue(i));
    };

    list.getFastObject = function (i, obj) {
        return list.content[i]
    };

    list.getCopy = function () {
        var ret = list._createInstance();
        ret.addList(list);
        return ret;
    };

    list.getEmptyList = function () {
        return list._createInstance();
    };

    list.exists = function (item) {
        var ret = false;
        list.beginUpdate();
        for (var i = 0; i < list.count; i++) {
            if (list.getValue(i) === item) {
                ret = true;
                break;
            }
        }
        list.endUpdate();
        return ret;
    };

    list.existsCI = function (item) {
        var ret = false;
        var _item = item.toUpperCase();
        list.beginUpdate();
        for (var i = 0; i < list.count; i++) {
            if (list.getValue(i).toUpperCase() === _item) {
                ret = true;
                break;
            }
        }
        list.endUpdate();
        return ret;
    };

    list.beginUpdate = function () {
        list._updateCount++;
    };

    list.endUpdate = function (msg) {
        if (--list._updateCount == 0) {
            raiseEvent(list, 'change', msg || '', list.count, null);
        }
    };

    list.beginRead = function () {};
    list.endRead = function () {};

    list._addGroup = function (idgroup, offset) {
        list._groups.push({
            groupid: idgroup,
            index: offset,
            offset: 0,
            itemCount: -1,
            rowGroupDimension: -1,
            colGroupDimension: -1,
        });
    };

    list._createItemGroups = function (istart, iend, startg, endg) {
        if (istart + 1 == iend) {
            list._addGroup(endg, iend);
        } else {
            var imiddle = Math.round((istart + iend) / 2);
            middleg = list.itemGrouper(list.content[imiddle]);
            if (startg != middleg)
                list._createItemGroups(istart, imiddle, startg, middleg);
            if (middleg != endg)
                list._createItemGroups(imiddle, iend, middleg, endg);
        }
    };

    list.createItemGroups = function () {
        var lst = list.content;
        list._groupsOK = true;
        list._groups.length = 0;

        if (lst.length > 0) {
            var startg = list.itemGrouper(lst[0]);
            list._addGroup(startg, 0);
            if (lst.length > 1) {
                var endg = list.itemGrouper(lst[lst.length - 1]);
                if (startg != endg)
                    list._createItemGroups(0, lst.length - 1, startg, endg);
            }
        }

        var isEmpty = false;
        if (list._groups.length === 1) {
            isEmpty = startg === '';
        }

        list._groupsOK = (!isEmpty) && (list._groups.length > 0);

        if (list._groupsOK) {
            list.computeGroupsSize();
        }
    };

    Object.defineProperty(list, 'groupName', {
        get: function () {
            return list._groupName;
        },
        set: function (value) {
            if (list._groupName != value) {
                list._groupName = value;
                list.createItemGroups();
            }
        }
    });

    list.getGroupSort = function () {
        return '';
    };

    list.itemGrouper = function (item) {
        alert('itemGrouper not defined');
    };

    list._getGroupItem = function (idx) {
        var item = list._groups[idx];
        return {
            id: item.groupid,
            offset: item.offset,
            index: item.index,
            itemCount: item.itemCount,
            rowGroupDimension: item.rowGroupDimension != -1 ? item.rowGroupDimension : 0,
            colGroupDimension: item.colGroupDimension != -1 ? item.colGroupDimension : 0,
            link: item.linkCefObject ? item.linkCefObject : undefined,
        };
    };

    list.getGroups = function () {
        if (!list._groupsOK) {
            list.createItemGroups();
        }
        var ret = [];
        for (var i = 0; i < list._groups.length; i++) {
            ret.push(list._getGroupItem(i));
        };
        return ret;
    };

    list._processGroups = function (groupSepHeight, groupSpacing, showRowCount, itemsPerRow, rowDimension, itemRowSpacing, groupHeight, regroup) {
        var recomputeRequire = true;

        // resort if regroup is forced
        if (regroup) {
            //prepareResort;
            //sort;
        }

        if (list._groupsOK && (!regroup)) {
            recomputeRequire = (list._groupSepHeight != groupSepHeight) ||
                (list._groupSpacing != groupSpacing) ||
                (list._showRowCount != showRowCount) ||
                (list._itemsPerRow != itemsPerRow) ||
                (list._rowDimension != rowDimension) ||
                (list._itemRowSpacing != itemRowSpacing) ||
                (list._groupHeight != groupHeight);
        }

        if (recomputeRequire) {
            list._groupSepHeight = groupSepHeight;
            list._groupSpacing = groupSpacing;
            list._showRowCount = showRowCount;
            list._itemsPerRow = itemsPerRow;
            list._rowDimension = rowDimension;
            list._itemRowSpacing = itemRowSpacing;
            list._groupHeight = groupHeight;

            if (!list._groupsOK) {
                list.createItemGroups();
            } else { // recompute group sizes
                list.computeGroupsSize();
            }
        }
        return list._groupsOK;
    };

    list.prepareGroupsAsync = function (params) {
        var _regroup = params.regroup;
        var _groupSepHeight = params.groupSepHeight;
        var _groupSpacing = params.groupSpacing;
        var _showRowCount = params.showRowCount;
        var _itemsPerRow = params.itemsPerRow;
        var _rowDimension = params.rowDimension;
        var _itemRowSpacing = params.itemRowSpacing;
        var _groupHeight = params.groupHeight;

        return new Promise(function (resolve, reject) {
            var isOK = list._processGroups(_groupSepHeight, _groupSpacing, _showRowCount, _itemsPerRow,
                _rowDimension, _itemRowSpacing, _groupHeight, _regroup);

            resolve(isOK);
        });
    };

    list.getGroup = function (index) {
        return list._groups[index];
    };

    list.getItemGroup = function (itemIndex, usePositionIndex) {
        if (!this._groupsOK) {
            return undefined;
        }

        if (usePositionIndex) {
            if ((itemIndex >= 0) && (itemIndex < list._groups.length)) {
                return list._getGroupItem(itemIndex);
            }
        } else {
            for (var i = 0; i < list._groups.length; i++) {
                if (itemIndex < list._groups[i].index) {
                    return list._getGroupItem(i - 1);
                }
            }
        }
        return list._getGroupItem(list._groups.length - 1);
    };

    list.getOffsetGroup = function (offset) {
        if (!this._groupsOK)
            return undefined;
        for (var i = 1; i < list._groups.length; i++) {
            if (offset < list._groups[i].offset) {
                return list._getGroupItem(i - 1);
            }
        }
        return list._getGroupItem(list._groups.length - 1);
    };

    list.getGroupsCount = function () {
        if (!this._groupsOK)
            return 0;
        return this._groupsOK.length;
    };

    list.getGroupByID = function (groupid) {
        var idx = this.getGroupIdx(groupid);
        if (idx >= 0)
            return this._getGroupItem(idx);
        return undefined;
    };

    list.getGroupIdx = function (groupid) {
        var loGroupID = groupid.toLowerCase();

        for (var i = 0; i < this._groups.length; i++) {
            if (this._groups[i].groupid.toLowerCase() === loGroupID) {
                return i;
            }
        }
    };

    list.getGroupDimension = function () {
        if (!this._groupsOK)
            return 0;

        var ret = this._groups[0].rowGroupDimension;
        if ((ret === -1) && (this._groupHeight > 0))
            ret = this._groupHeight;
        return ret;
    };

    list.setGroupsDimensions = function (rowGroupDimension, colGroupDimension) {
        if (this._groupsOK) {
            for (var i = 0; i < this._groups.length; i++) {
                var group = this._groups[i];
                group.rowGroupDimension = rowGroupDimension;
                group.colGroupDimension = colGroupDimension;
                this._groups[i] = group;
            }
        }
    };

    list.setGroupDimension = function (groupid, rowGroupDimension, colGroupDimension) {
        if (this._groupsOK) {
            var idx = this.getGroupIdx(groupid);
            if (idx >= 0) {
                var group = this._groups[idx];
                group.rowGroupDimension = rowGroupDimension;
                group.colGroupDimension = colGroupDimension;
                this._groups[idx] = group;
            }
        }
    };

    list.getGroupsSize = function () {
        if (!this._groupsOK)
            return 0;
        return this._groupsSize;
    };

    list.clearGroupsAsync = function () {
        return new Promise((resolve) => {
            if (this._groupsOK) {
                this._groups = [];
            }
            resolve();
        });
    };

    list.computeGroupsSize = function () {

        var calcPixsPerItems = function (itemCount) {
            return Math.max((list._showRowCount || Math.ceil(itemCount / list._itemsPerRow)) * (list._rowDimension + list._itemRowSpacing) - list._itemRowSpacing, 0);
        }

        var tempGroups = [];
        var size = 0;
        var nexti = 0;
        for (var i = 0; i < list._groups.length; i++) {
            var group = list._groups[i];
            group.rowGroupDimension = Math.max(list._groupHeight, group.rowGroupDimension);
            size += list._groupSepHeight;
            group.offset = size;
            if (group.itemCount === -1) {
                if (i + 1 === list._groups.length)
                    nexti = list.count;
                else
                    nexti = list._groups[i + 1].index;

                group.itemCount = Math.max(nexti - group.index, 0);
            }
            size += list._groupSpacing + Math.max(calcPixsPerItems(group.itemCount), group.rowGroupDimension);

            tempGroups.push(group);
        }

        list._groups = tempGroups.slice();
        list._groupsSize = size;
    };

    list.whenLoaded = function () {
        return new Promise(function (resolved) {
            if (list._loaded)
                resolved(list);
            else
                list._loadedEvents.push(function () {
                    resolved(list);
                });
        });
    };
    list.doOnFocusChange = function (newIndex, oldIndex) {
        raiseEvent(list, 'focuschange', newIndex, oldIndex);
    };

    list.doFocusedNode = function (value) {
        if (list._focusedNode !== value) {
            list._focusedIndex = -1;
            var oldIndex = list.content.indexOf(list._focusedNode);
            list._focusedNode = value;
            var newIndex = list.content.indexOf(list._focusedNode);
            list.doOnFocusChange(newIndex, oldIndex);
        }
    };

    list.doFocusedIndex = function (value) {
        if (list._focusedIndex !== value) {
            list._focusedNode = null;
            var oldIndex = list._focusedIndex;
            list._focusedNode = list.getValue(value);
            list._focusedIndex = value;
            list.doOnFocusChange(value, oldIndex);
        }
    };

    Object.defineProperty(list, 'focusedNode', {
        get: function () {
            return list._focusedNode;
        },
        set: function (value) {
            list.doFocusedNode(value);
        }
    });

    Object.defineProperty(list, 'focusedIndex', {
        get: function () {
            return list._focusedIndex;
        },
        set: function (value) {
            list.doFocusedIndex(value);
        }
    });

    list.insert = function (pos, item) {
        this.content.splice(pos, 0, item);
        if (list._updateCount == 0) {
            raiseEvent(list, 'change', 'insert', list.count, item);
        }
        list._groupsOK = false;
    };

    list.delete = function (index) {
        list.content.splice(index, 1);
        if (list._updateCount == 0) {
            raiseEvent(list, 'change', 'delete', index);
        }
        list._groupsOK = false;
    };

    list.add = function (item) {
        list.content.push(item);
        if (list._updateCount == 0) {
            raiseEvent(list, 'change', 'insert', list.count, item);
        }
        list._groupsOK = false;
    };

    list.addList = function (l) {
        list.beginUpdate();
        if (l.push) {
            list.content = list.content.concat(l);
        } else {
            list.content = list.content.concat(l.content);
        }
        list._groupsOK = false;
        list.endUpdate();
    };

    list.insertList = function (l, pos) {
        if (pos >= list.count) {
            list.addList(l);
            return;
        }
        var arrL;
        if (l.push) {
            arrL = l;
        } else {
            arrL = l.content;
        }
        list.beginUpdate();
        var prevlist, postlist;
        if (pos > 0)
            prevlist = list.content.slice(0, pos - 1);
        else
            prevlist = [];
        if (pos < list.content.length)
            postlist = list.content.slice(pos)
        else
            postlist = [];
        list.content = prevlist.concat(arrL, postlist);
        list.endUpdate();
    }

    list.getSelectedList = function () {
        var l = list._createInstance();
        l.content = list._selected.slice(0);
        l.notifyLoaded();
        return l;
    }

    list.setAutoSortAsync = function () {
        return new Promise(function (r) {
            r();
        });
    };

    list.getFilterValues = function () {
        return new Promise(function (r) {
            r(list._createInstance());
        });
    }

    list.focusedNode = null;
    list._updateCount = 0;

    return list;
}

/////////////////////////////////////////////////////////////////////
// default communication methods
/////////////////////////////////////////////////////////////////////
function appendData(dest, src) {
    if (typeof src === 'string') {
        try {
            src = JSON.parse(src);
        } catch (err) {
            alert(err);
        }
    }

    if (typeof dest === 'string') {
        try {
            dest = JSON.parse(dest);
        } catch (err) {
            alert(err);
        }
    }

    for (var prop in src) {
        dest[prop] = src[prop];
    }
    return dest;
}

function _getFileAddress(filename) {
    if (window['getFileAddress']) {
        return window['getFileAddress'](filename);
    } else
        return filename;
}

function _loadDataFromServer(command, callback) {
    if (window['loadDataFromServer']) {
        return window['loadDataFromServer'](command, callback);
    }
    return '';
}

function _loadListFromServer(command, list, itemCallback, doneCallback, sync) {
    if (window['loadListFromServer']) {
        window['loadListFromServer'](command, list, itemCallback, doneCallback, sync);
    }
};

function addHash(obj) {
    if (obj.hash) {
        return _sep + 'hash:' + obj.hash;
    } else
        return '';
}


function getDefaultCachedThumb(obj, x, y) {
    if (webApp) {
        var filename = '';
        if (obj._cachedSizeX == x && obj._cachedSizeY == y) {
            filename = obj._cachedName;
        } else {
            // PETR disabled this because of performance reasons as this method is synchronous! Cached image will be received in getThumbAsync in asynchronous way.
            /*filename = _loadDataFromServer(obj.objectType + ':' + obj.id + _sep + 'getCachedThumb' + _sep + 'x:' + x + _sep + 'y:' + y + addHash(obj));
            if (filename && filename !== '-') {
                if (filename[0] !== '<') {
                    filename = _getFileAddress(filename);
                } else {
                    filename = filename.replace(/MMWEBSRV/gi, _getFileAddress(''));
                }
                obj._cachedSizeX = x;
                obj._cachedSizeY = y;
                obj._cachedName = filename;
            }*/
        }
        return filename;
    }
    return '';
}

function getPriorityParamsFromObj(obj) {
    return (obj.getDefaultPriorityParams ? obj.getDefaultPriorityParams() : '');
}

function getDefaultThumbAsync(obj, x, y, callback) {
    if (webApp) {
        _loadDataFromServer(obj.objectType + ':' + obj.id + _sep + 'getThumbAsync' + getPriorityParamsFromObj(obj) + _sep + 'x:' + x + _sep + 'y:' + y + addHash(obj), function (data) {
            if (data && data !== '-') {
                obj._cachedSizeX = x;
                obj._cachedSizeY = y;
                if (data[0] !== '<') { // single image .. not a collation
                    obj._cachedName = getFileAddress(data);
                } else {
                    obj._cachedName = data.replace(/MMWEBSRV/gi, getFileAddress(''));
                }
                callback(obj._cachedName);
            } else {
                obj._cachedSizeX = x;
                obj._cachedSizeY = y;
                obj._cachedName = '';
                callback(data);
            }
        });
    } else
        callback('');
    return 0;
}

function getDefaultString(command, def) {
    if (webApp) {
        return _loadDataFromServer(command);
    } else
        return def | '';
}

function getDefaultSimpleList(command) {
    var list = getSharedList();
    if (webApp) {
        _loadListFromServer(command, list);
    }
    return list;
}

function getDefaultTracklist(obj, getFuncName) {
    var list = getTrackList();
    if (webApp && (obj.getTracklistCommand || (obj.id !== undefined))) {
        _loadListFromServer((obj.getTracklistCommand ? obj.getTracklistCommand() : (obj.objectType + ':' + obj.id + _sep + (getFuncName ? getFuncName : 'getTracklist') + getPriorityParamsFromObj(obj))) + addHash(obj), list, function (data) {
            return getTrack(data);
        });
    }
    return list;
}

function getDefaultTopTracklist(obj, maxCount) {
    var list = getTrackList();
    if (webApp && (obj.getTopTracklistCommand || (obj.id !== undefined))) {
        _loadListFromServer((obj.getTopTracklistCommand ? obj.getTopTracklistCommand() : (obj.objectType + ':' + obj.id + _sep + 'getTopTracklist' + getPriorityParamsFromObj(obj) + _sep + maxCount)) + addHash(obj), list, function (data) {
            return getTrack(data);
        });
    }
    return list;
}

function getDefaultTopArtists(obj, limit) {
    var list = getArtistList();
    if (webApp && (obj.getTopArtistlistCommand || (obj.id !== undefined))) {
        _loadListFromServer((obj.getTopArtistlistCommand ? obj.getTopArtistlistCommand() : (obj.objectType + ':' + obj.id + _sep + 'getTopArtistlist' + getPriorityParamsFromObj(obj) + _sep + (limit !== undefined ? limit : 0))) + addHash(obj), list, function (data) {
            return getArtist(data);
        });
    }
    return list;
}

function getDefaultTopAlbums(obj, limit) {
    var list = getAlbumList();
    if (webApp && (obj.getTopAlbumlistCommand || (obj.id !== undefined))) {
        _loadListFromServer((obj.getTopAlbumlistCommand ? obj.getTopAlbumlistCommand() : (obj.objectType + ':' + obj.id + _sep + 'getTopAlbumlist' + getPriorityParamsFromObj(obj) + _sep + (limit !== undefined ? limit : 0))) + addHash(obj), list, function (data) {
            return getAlbum(data);
        });
    }
    return list;
};

function getDefaultAlbumlist(obj, known) {
    var list = getAlbumList();
    var onlyKnown = known === 'known only';
    if (webApp) {
        _loadListFromServer((obj.getAlbumlistCommand ? obj.getAlbumlistCommand() : (obj.objectType + ':' + obj.id + _sep + 'getAlbumlist' + getPriorityParamsFromObj(obj))) + addHash(obj), list, function (data) {
            if (onlyKnown && data.title === '') {
                return null;
            } else {
                return getAlbum(data);
            }
        });
    }
    return list;
}

function getDefaultDecades(obj, useOrigYear) {
    var list = getSharedList();
    if (webApp) {
        _loadListFromServer((obj.getDecadeslistCommand ? obj.getDecadeslistCommand() : (obj.objectType + ':' + obj.id + _sep + 'getDecades' + _sep + (useOrigYear ? 'true' : 'false'))) + addHash(obj), list, function (data) {
            return getDecade(data);
        });
    }
    return list;
}

function getDefaultYearslist(obj) {
    var list = getSharedList();
    if (webApp) {
        _loadListFromServer((obj.getYearslistCommand ? obj.getYearslistCommand() : (obj.objectType + ':' + obj.id + _sep + 'getYears' + _sep + getPriorityParamsFromObj(obj))) + addHash(obj), list, function (data) {
            return getYear(data);
        });
    }
    return list;
}

function getDefaultGenrelist(obj) {
    var list = getGenreList();
    if (webApp) {
        _loadListFromServer((obj.getGenrelistCommand ? obj.getGenrelistCommand() : (obj.objectType + ':' + obj.id + _sep + 'getGenrelist' + getPriorityParamsFromObj(obj))) + addHash(obj), list, function (data) {
            return getGenre(data);
        });
    }
    return list;
}

function getDefaultArtistlist(obj) {
    var list = getArtistList();
    if (webApp && (obj.getArtistlistCommand || (obj.id !== undefined))) {
        _loadListFromServer((obj.getArtistlistCommand ? obj.getArtistlistCommand() : (obj.objectType + ':' + obj.id + _sep + 'getArtistlist' + getPriorityParamsFromObj(obj))) + addHash(obj), list, function (data) {
            return getArtist(data);
        });
    }
    return list;
}

function getDefaultPersonlist(obj, person) {
    var list = getPersonList();
    if (webApp) {
        _loadListFromServer((obj.getPersonlistCommand ? obj.getPersonlistCommand() : (obj.objectType + ':' + obj.id + _sep + 'getPersonlist' + getPriorityParamsFromObj(obj) + _sep + 'person:' + person)) + addHash(obj), list, function (data) {
            return getPerson(data);
        });
    }
    return list;
};

function getDefaultItemlist(obj, type) {
    var list = (type == undefined || type == 'albums') ? getAlbumList() : getTrackList();
    if (webApp) {
        _loadListFromServer(obj.objectType + ':' + obj.id + _sep + 'getItemlist' + getPriorityParamsFromObj(obj) + _sep + type + addHash(obj), list, function (data) {
            if (type == undefined || type == 'albums')
                return getAlbum(data);
            else
                return getTrack(data);
        });
    }
    return list;
};


/////////////////////////////////////////////////////////////////////
// default objects
/////////////////////////////////////////////////////////////////////
function parseObjectType(dataStr) {
    var data = dataStr;
    if (typeof dataStr === 'string') {
        try {
            data = JSON.parse(dataStr);
        } catch (err) {
            alert(err);
        }
    }

    if (data.objectType == 'item')
        return getItemListItem(data);
    else if (data.objectType == 'queryData')
        return getQueryData(data);
    else if (data.objectType == 'sharedFolder')
        return getSharedFolder(data);
    else if (data.objectType == 'dbfolder')
        return getSharedDBFolder(data);
    else if (data.objectType == 'rating')
        return getRating(obj, data.rating);
    else if (data.objectType == 'playlistentry')
        return getPlaylistEntry(getTrack(data));
    else if (data.objectType == 'track')
        return getTrack(data);
    else if (data.objectType == 'album')
        return getAlbum(data);
    else if (data.objectType == 'genre')
        return getGenre(data);
    else if (data.objectType == 'artist')
        return getArtist(data);
    else if (data.objectType == 'playlist')
        return getPlaylist(data, data.parent, data.id, data.title);
    else if (data.objectType == 'queryResults')
        return getQueryResults(data)
    else if (data.objectType == 'queryResultRow')
        return getQueryResultRow(data)
    else
        return {};
}

function getSharedObject(data) {
    if (data) {
        return parseObjectType(data);
    }
    return {
        id: 0,
        title: '',
    };
}

function getQueryResults(data) {
    var obj = {
        objectType: 'queryResults',
        next: function () {
            if (webApp)
                _loadDataFromServer('queryResults:' + this.id + _sep + 'next' + addHash(this));
        },
        prev: function () {
            if (webApp)
                _loadDataFromServer('queryResults:' + this.id + _sep + 'prev' + addHash(this));
        },
        fieldByName: function (name) {
            if (webApp)
                return _loadDataFromServer('queryResults:' + this.id + _sep + 'fieldByName' + _sep + name + addHash(this));
            else
                return '';
        }
    };
    addDefaultProps(obj);
    Object.defineProperties(obj, {
        eof: {
            get: function () {
                if (webApp)
                    return _loadDataFromServer('queryResults:' + this.id + _sep + 'getIsEof' + addHash(this)) == 'true';
                else
                    return true;
            }
        },
        row: {
            get: function () {
                if (webApp)
                    return _loadDataFromServer('queryResults:' + this.id + _sep + 'getRow' + addHash(this));
                else
                    return 0;
            },
            set: function (value) {
                if (webApp)
                    return _loadDataFromServer('queryResults:' + this.id + _sep + 'setRow' + _sep + value + addHash(this));
            },
        },
        count: {
            get: function () {
                if (webApp)
                    return _loadDataFromServer('queryResults:' + this.id + _sep + 'getCount' + addHash(this));
                else
                    return 0;
            }
        },
        fields: {
            get: function () {
                var obj = {};
                if (webApp) {
                    obj = getQueryResultRow(_loadDataFromServer('queryResults:' + this.id + _sep + 'getFields' + addHash(this)));
                    obj.hash = this.hash;
                }

                return obj;
            }
        },
    });
    if (data) {
        obj = appendData(obj, data);
    }
    return obj;
}

function getQueryResultRow(data) {
    var obj = {
        objectType: 'queryResultRow',
        getValue: function (col) {
            if (webApp)
                return _loadDataFromServer('queryResults:' + this.id + _sep + 'getValue' + _sep + col + addHash(this));
            else
                return '';
        },
    };
    addDefaultProps(obj);
    if (data) {
        obj = appendData(obj, data);
    }
    return obj;
}

function getItemListItem(data) {
    var obj = {
        id: 0,
        title: '',
        objectType: 'item',
        instanceConstructor: 'getItemListItem',
        type: '',
        addInfo: '',
        getTracklistCommand: function () {
            return this.objectType + ':' + this.id + _sep + 'getTracklist' + _sep + this.type + _sep + this.addInfo + _sep + this.idlist + addHash(this);
        },
        getAlbumlistCommand: function () {
            return this.objectType + ':' + this.id + _sep + 'getAlbumList' + _sep + this.type + _sep + this.addInfo + _sep + this.idlist + addHash(this);
        },
        getTracklist: function () {
            return getDefaultTracklist(this);
        },
        getAlbumList: function () {
            return getDefaultAlbumlist(this);
        },

    };
    addDefaultProps(obj);
    if (data) {
        obj = appendData(obj, data);
        //obj.title = atob(obj.title);
    }
    return obj;
}

function getQueryCondition(queryData, data) {
    var obj = {
        id: 0,
        queryData: queryData,
        _fieldName: '',
        _operatorName: '',
        _valueText: '',
        instanceConstructor: 'getQueryCondition',

        getValueTextAsync: function () {
            return new Promise(function (resolve) {
                resolve(obj._valueText);
            });
        },
        getOperatorViewType: function () {
            if (webApp) {
                return _loadDataFromServer('queryData:' + this.queryData.id + _sep + 'queryCondition:' + this.id + _sep + 'getOperatorViewType');
            } else
                return 'qvtNone';
        },
        getOperatorsList: function () {
            var list = getSharedList();
            if (webApp) {
                return _loadListFromServer('queryData:' + this.queryData.id + _sep + 'queryCondition:' + this.id + _sep + 'getOperatorsList', list);
            } else
                return list;
        },
        getValuesList: function () {
            var list = getSharedList();
            if (webApp) {
                return _loadListFromServer('queryData:' + this.queryData.id + _sep + 'queryCondition:' + this.id + _sep + 'getValuesList', list);
            } else
                return list;
        },
        getValues: function () {
            var list = getSharedList();
            if (webApp) {
                return _loadListFromServer('queryData:' + this.queryData.id + _sep + 'queryCondition:' + this.id + _sep + 'getValues', list);
            } else
                return list;
        },
        getValuesAsync: function () {
            return new Promise(function (resolve) {
                var list = getSharedList();
                if (webApp) {
                    _loadListFromServer('queryData:' + this.queryData.id + _sep + 'queryCondition:' + this.id + _sep + 'getValues', list, undefined, function () {
                        resolve(list);
                    });
                } else
                    resolve(list);
            });
        },
        setValues: function (value1, value2) {
            if (webApp)
                _loadDataFromServer('queryData:' + this.queryData.id + _sep + 'queryCondition:' + this.id + _sep + 'setValues' + _sep + value1 + _sep + value2);
        },
        setValuesAsync: function (value1, value2) {
            return new Promise(function (resolve) {
                if (webApp)
                    _loadDataFromServer('queryData:' + this.queryData.id + _sep + 'queryCondition:' + this.id + _sep + 'setValues' + _sep + value1 + _sep + value2);
                resolve();
            });
        },

        toParams: function () {
            return JSON.stringify(this);
        },
    };
    addDefaultProps(obj);
    Object.defineProperties(obj, {
        fieldName: {
            get: function () {
                return this._fieldName;
            },
            set: function (value) {
                this._fieldName = value;
            },
        },
        operatorName: {
            get: function () {
                return this._operatorName;
            },
            set: function (value) {
                this._operatorName = value;
            },
        },
        valueText: {
            get: function () {
                return this.valueText;
            },
            set: function (value) {
                this._valueText = value;
            },
        },
    });

    if (data) {
        obj = appendData(obj, data);
    }
    return obj;
}

function getQueryData(data) {
    var obj = new CustomEventTarget;
    obj.id = 0;
    obj._conditions = getSharedList();
    obj._sortOrders = [];
    obj._anyField = '';
    obj._maxBytesEnabled = false;
    obj._maxLenEnabled = false;
    obj._maxCountEnabled = false;
    obj._maxBytesValue = 0;
    obj._maxLenValue = 0;
    obj._maxCountValue = 0;
    obj._matchAllCriteria = true;
    obj._quickSearch = false;
    obj._collection = 'Entire Library';
    obj.objectType = 'queryData';
    obj.instanceConstructor = 'getQueryData';

    obj.getTracklistCommand = function () {
        return 'queryData:' + this.id + _sep + 'getTracklist' + _sep + this.toParams() + addHash(this);
    };
    obj.saveToString = function () {
        if (webApp) {
            return _loadDataFromServer('queryData:' + this.id + _sep + 'saveToString' + _sep + this.toParams() + addHash(this));
        } else
            return '';
    };
    obj.loadFromString = function (queryData) {
        if (webApp) {
            _loadDataFromServer('queryData:' + this.id + _sep + 'loadFromString' + _sep + queryData + addHash(this), function (data) {
                obj = appendData(obj, data);
            });
            return true;
        } else
            return false;
    };
    obj.hasSameData = function (compQD) {
        return false; // TODO
    };
    obj.addNewCondition = function () {
        if (webApp) {
            return getQueryCondition(this, _loadDataFromServer('queryData:' + this.id + _sep + 'addNewCondition' + addHash(this)));
        } else
            return getQueryCondition(this);
    };
    obj.getAllSortOrdersList = function () {
        var list = getSharedList();
        if (webApp) {
            _loadListFromServer('queryData:' + this.id + _sep + 'getAllSortOrdersList' + addHash(this), list);
        }
        return list;
    };
    obj.getAllLimitOrdersList = function () {
        var list = getSharedList();
        if (webApp) {
            _loadListFromServer('queryData:' + this.id + _sep + 'getAllLimitOrdersList' + addHash(this), list);
        }
        return list;
    };
    obj.getSortOrders = function () {
        return this._sortOrders;
    };
    obj.setSortOrders = function (values) {
        this._sortOrders = values;
    };
    obj.getTracklist = function () {
        return getDefaultTracklist(this);
    };
    obj.clear = function () {
        this._conditions.clear();
        this._sortOrders.length = 0;
        this._anyField = '';
        this.quickSearch = false;
    };
    obj.toParams = function () {
        return 'params:' + encodeURI(JSON.stringify(obj));
    };

    Object.defineProperties(obj, {
        searchPhrase: {
            get: function () {
                return this._anyField;
            },
            set: function (value) {
                this._anyField = value;
                this.quickSearch = true;
                raiseEvent(obj, 'change');
            },
        },
        maxBytesEnabled: {
            get: function () {
                return this._maxBytesEnabled;
            },
            set: function (value) {
                this._maxBytesEnabled = value;
            },
        },
        maxLenEnabled: {
            get: function () {
                return this._maxLenEnabled;
            },
            set: function (value) {
                this._maxLenEnabled = value;
            },
        },
        maxCountEnabled: {
            get: function () {
                return this._maxCountEnabled;
            },
            set: function (value) {
                this._maxCountEnabled = value;
            },
        },
        maxBytesValue: {
            get: function () {
                return this._maxBytesValue;
            },
            set: function (value) {
                this._maxBytesValue = value;
            },
        },
        maxLenValue: {
            get: function () {
                return this._maxLenValue;
            },
            set: function (value) {
                this._maxLenValue = value;
            },
        },
        maxCountValue: {
            get: function () {
                return this._maxCountValue;
            },
            set: function (value) {
                this._maxCountValue = value;
            },
        },
        matchAllCriteria: {
            get: function () {
                return this._matchAllCriteria;
            },
            set: function (value) {
                this._matchAllCriteria = value;
            },
        },
        quickSearch: {
            get: function () {
                return this._quickSearch;
            },
            set: function (value) {
                this._quickSearch = value;
            },
        },
        collection: {
            get: function () {
                return this._collection;
            },
            set: function (value) {
                this._collection = value;
                if (value) {
                    if (webApp) {

                    }
                }
            },
        },

        conditions: {
            get: function () {
                return this._conditions;
            }
        },
        allFieldsList: {
            get: function () {
                var list = getSharedList();
                if (webApp) {
                    _loadListFromServer('queryData:' + this.id + _sep + 'allFieldsList' + addHash(this), list, undefined, undefined, true /* force sync */ );
                }
                return list;
            }
        },
    });

    if (data) {
        obj = appendData(obj, data);

        // copy __conditions.data array to _conditions
        if (obj.__conditions && obj.__conditions.data) {
            var srcArray = obj.__conditions.data;
            obj._conditions.modifyAsync(function () {
                obj._conditions.clear();
                for (var i = 0; i < srcArray.length; i++) {
                    obj._conditions.add(getQueryCondition(obj, srcArray[i]));
                }
            });
            obj.__conditions = undefined;
        }

        // copy __sortOrders.data array to _sortOrders
        if (obj.__sortOrders && obj.__sortOrders.data)
            obj._sortOrders = obj.__sortOrders.data;
        obj.__sortOrders = undefined;

    }
    return obj;
}

function getSharedFolder(data) {
    var obj = {
        objectType: 'sharedFolder',
        instanceConstructor: 'getSharedFolder',
        getTracklistCommand: function () {
            return this.objectType + ':' + this.path + _sep + 'getTracklist' + _sep + this._includeSubfolders + addHash(this);
        },
        path: '',
        getTracklist: function (includeSubfolders) {
            this._includeSubfolders = includeSubfolders;
            return getDefaultTracklist(this);
        },
        getFolderList: function () {
            var list = getSharedList();
            if (webApp) {
                _loadListFromServer(this.objectType + ':' + this.path + _sep + 'getFolderList' + addHash(this), list, function (data) {
                    return getSharedFolder(data);
                });
            }
            return list;
        },
        /*property monitorContinous: boolean read getMonitorContinous write setMonitorContinous;
        property monitorStartup: boolean read getMonitorStartup write setMonitorStartup;*/
    };
    addDefaultProps(obj);
    if (data) {
        obj = appendData(obj, data);
    }
    return obj;
}

function getSharedDrive(data) {
    var obj = getSharedFolder(data);
    //property driveType: string read getType;
    obj.instanceConstructor = 'getSharedDrive';

    if (data) {
        obj = appendData(obj, data);
    }
    return obj;
}

function getSharedDBFolder(data) {
    var obj = {
        id: -1,
        title: '',
        folder: '',
        fullPath: '',
        trackCount: 0,
        idColl: -1,
        icon: '',
        hasSubfolders: false,
        monitorChanges: false,
        objectType: 'dbfolder',
        instanceConstructor: 'getSharedDBFolder',
        getTracklistCommand: function () {
            return this.objectType + ':' + this.id + ':' + this.idColl + _sep + 'getTracklist' + _sep + this._includeSubfolders + addHash(this);
        },
        getTracklist: function (includeSubfolders) {
            this._includeSubfolders = includeSubfolders;
            return getDefaultTracklist(this);
        },
        getAlbumlist: function (includeSubfolders) {
            var list = getSharedList();
            if (webApp) {
                this._includeSubfolders = includeSubfolders;
                _loadListFromServer(this.objectType + ':' + this.id + ':' + this.idColl + _sep + 'getAlbumlist' + addHash(this), list, function (data) {
                    return getSharedDBFolder(data);
                });
            }
            return list;
        },
        getChildren: function () {
            var list = getSharedList();
            if (webApp) {
                _loadListFromServer(this.objectType + ':' + this.id + ':' + this.idColl + _sep + 'getChildren' + addHash(this), list, function (data) {
                    return getSharedDBFolder(data);
                });
            }
            return list;
        },
        getPathAsync: function () {
            return new Promise(function (resolve) {
                resolve(_loadDataFromServer(this.objectType + ':' + this.id + ':' + this.idColl + _sep + 'getPathAsync' + addHash(this)));
            });
        },
        updateHasSubfolders: function () {
            this.hasSubfolders = _loadDataFromServer(this.objectType + ':' + this.id + ':' + this.idColl + _sep + 'updateHasSubfolders' + addHash(this)) === 'true';
        },
    };
    addDefaultProps(obj);
    if (data) {
        obj = appendData(obj, data);
    }
    return obj;
}

function getRating(obj, rating) {
    var ret = {
        id: rating,
        title: '',
        objectType: 'rating',
        collection: obj,
        rating: rating,
        instanceConstructor: 'getRating',
        getTracklistCommand: function () {
            return 'collection:' + this.collection.id + _sep + 'rating:' + this.rating + _sep + 'getTracklist' + addHash(this);
        },
        getTracklist: function () {
            return getDefaultTracklist(this);
        },
    };

    if (rating < 0)
        ret.title = _('Unknown');
    else {
        var val = (Math.floor(rating / 10) * 10);
        if (Math.round(val) % 20 == 0)
            ret.title = Math.floor(val / 20) + ' Stars';
        else
            ret.title = (Math.floor((val / 20) * 10) / 10) + ' Stars';
    }

    return ret;
};

function getObjectLink(obj) {
    return {
        _obj: obj,
        get: function () {
            return this._obj;
        },
        getFastAccess: function () {
            return this._obj;
        },
        instanceConstructor: 'getObjectLink',
    };
}

function getPlaylistEntry(track) {
    return {
        sd: track,
        objectType: 'playlistentry',
        instanceConstructor: 'getPlaylistEntry',
        accessible: true,
        getFastSD: function () {
            return this.sd;
        },
        getThumbAsync: function (x, y, callback) {
            return this.sd.getThumbAsync(x, y, callback);
        },
        getLyricsAsync: function () {
            return this.sd.getLyricsAsync();
        },
    };
}

function getTrack(data, decoded) {
    var obj = {
        isSame: function (secondTrack) {
            if (!secondTrack)
                return false;

            if (obj.id > 0)
                return obj.id === secondTrack.id;
            else
                return obj.path === secondTrack.path;
        },
        getCachedThumb: function (x, y) {
            return getDefaultCachedThumb(this, x, y);
        },
        getThumbAsync: function (x, y, callback) {
            return getDefaultThumbAsync(this, x, y, callback);
        },
        getCommentAsync: function () {
            return new Promise(function (resolve) {
                if (obj._fullComment) {
                    resolve(obj._fullComment);
                } else {
                    if (webApp) {
                        _loadDataFromServer(obj.objectType + ':' + obj.id + _sep + 'getCommentAsync' + addHash(obj), function (data) {
                            obj._fullComment = data;
                            resolve(data);
                        });
                    } else
                        resolve('');
                }
            });
        },
        getLyricsAsync: function () {
            return new Promise(function (resolve) {
                if (obj._fullComment) {
                    resolve(obj._fullLyrics);
                } else {
                    if (webApp) {
                        _loadDataFromServer(obj.objectType + ':' + obj.id + _sep + 'getLyricsAsync' + addHash(obj), function (data) {
                            obj._fullLyrics = data;
                            resolve(data);
                        });
                    } else
                        resolve('');
                }
            });
        },
        setCommentAsync: function (value) {

        },
        setLyricsAsync: function (value) {

        },
        commitAsync: function () {

        },
        doOnChange: function () {
            raiseEvent(this, 'change');
        },
        beginUpdate: function () {},
        endUpdate: function () {
            this.doOnChange();
        },
        locked: function (fn) {
            fn.bind(window)();
        },
        modifyAsync: function (fn) {
            fn.bind(window)();
        },
        objectType: 'track',
        instanceConstructor: 'getTrack',

        itemGrouper: function (groupName) {
            if (groupName) {
                if (groupName === 'album')
                    return this.album.trim() + '_' + this.albumArtist.trim();
                else if (groupName === 'artist')
                    return this.artist.trim();
                else if (groupName === 'disc')
                    return this.discNumber.trim();
                else if (groupName === 'season')
                    return this.seasonNumber.trim();
            }
            return '';
        },

        getTrackTypeAsync: function () {
            return new Promise((resolve) => {
                resolve(obj.trackType);
            });
        },
    };
    addDefaultProps(obj);
    if (data) {
        obj = appendData(data, obj);
        if (!decoded) {
            //obj.comment = atob(obj.comment);
            //obj.lyrics = atob(obj.lyrics);
        }
    }
    Object.defineProperty(obj, 'summary', {
        get: function () {
            return _loadDataFromServer(obj.objectType + ':' + obj.id + _sep + 'getSummary' + addHash(obj));
        }
    });
    return obj;
}

function setDefaultMethods(obj) {
    obj.getCachedThumb = function (x, y) {
        return getDefaultCachedThumb(obj, x, y);
    };
    obj.getThumbAsync = function (x, y, callback) {
        return getDefaultThumbAsync(obj, x, y, callback);
    };
    obj.getTracklist = function () {
        return getDefaultTracklist(obj);
    };
    obj.getAlbumList = function (known) {
        return getDefaultAlbumlist(obj, known);
    };
    obj.getItemList = function (type) {
        return getDefaultItemlist(obj, type);
    };
    obj.getItemCountAsync = function (itemType) {
        return new Promise(function (resolve) {
            if (webApp) {
                _loadDataFromServer(obj.objectType + ':' + obj.id + _sep + 'getItemCount' + getPriorityParamsFromObj(obj) + _sep + itemType + addHash(obj), function (data) {
                    var c = Number(data);
                    if (isNaN(c))
                        c = 0;
                    resolve(c);
                });
            } else
                resolve(0);
        });
    };
    obj.getTopTracklist = function () {
        return getDefaultTopTracklist(obj, 10); // get max. 10 tracks
    };
    obj.getTopArtists = function (limit) {
        return getDefaultTopArtists(obj, limit);
    };
    obj.getTopAlbums = function (limit) {
        return getDefaultTopAlbums(obj, limit);
    };
    addDefaultProps(obj);
    return obj;
}

function getYear(data) {
    var obj = {
        objectType: 'year',
        instanceConstructor: 'getYear',
        getDefaultPriorityParams: function () {
            return _sep + (this.collID ? this.collID : -1) + _sep + this.value + _sep + (this.yearColumn === 'OrigYear' ? 'true' : 'false');
        },
        getArtistList: function (SQL) {
            var _this = this;
            return getDefaultArtistlist({
                getArtistlistCommand: function () {
                    return _this.objectType + ':' + _this.year + _sep + 'getArtistlist' + getPriorityParamsFromObj(obj) + _sep + SQL;
                }
            });
        },
    };
    obj = setDefaultMethods(obj);
    if (data) {
        obj = appendData(obj, data);
    }
    return obj;
}

function getDecade(data) {
    var obj = {
        objectType: 'decade',
        instanceConstructor: 'getDecade',
        getDefaultPriorityParams: function () {
            return _sep + (this.collID ? this.collID : -1) + _sep + this.value + _sep + (this.yearColumn === 'OrigYear' ? 'true' : 'false');
        },
        getArtistList: function (SQL) {
            var _this = this;
            return getDefaultArtistlist({
                getArtistlistCommand: function () {
                    return _this.objectType + ':' + _this.decade + _sep + 'getArtistlist' + getPriorityParamsFromObj(obj) + _sep + SQL;
                }
            });
        },
        getYears: function () {
            var _this = this;
            return getDefaultYearslist({
                getYearslistCommand: function () {
                    return _this.objectType + ':' + _this.decade + _sep + 'getYears' + getPriorityParamsFromObj(obj);
                }
            });
        },
    };
    obj = setDefaultMethods(obj);
    if (data) {
        obj = appendData(obj, data);
    }
    return obj;
}

function getPodcast(data) {
    var obj = {
        objectType: 'podcast',
        instanceConstructor: 'getPodcast',
        getTracklist: function () {
            return getDefaultTracklist(this);
        },
        getEpisodeList: function () {
            return getDefaultTracklist(this, 'getEpisodeList');
        },
        getCachedThumb: function (x, y) {
            return getDefaultCachedThumb(this, x, y);
        },
        getThumbAsync: function (x, y, callback) {
            return getDefaultThumbAsync(this, x, y, callback);
        },
        runUpdate: function () {
            _loadDataFromServer(obj.objectType + ':' + obj.id + _sep + 'runUpdate');
        },
        commitAsync: function () {
            return new Promise(function (resolve) {
                _loadDataFromServer(obj.objectType + ':' + obj.id + _sep + 'commitAsync' + getPriorityParamsFromObj(obj) + addHash(obj), function (data) {
                    resolve();
                });
            });
        },
        unsubscribeAsync: function (deleteTracks) {
            return new Promise(function (resolve) {
                _loadDataFromServer(obj.objectType + ':' + obj.id + _sep + 'unsubscribeAsync' + getPriorityParamsFromObj(obj) + _sep + deleteTracks + addHash(obj), function (data) {
                    resolve();
                });
            });
        },
        getChannelDataAsync: function () {
            return new Promise(function (resolve) {
                _loadDataFromServer(obj.objectType + ':' + obj.id + _sep + 'UpdateChannelData' + getPriorityParamsFromObj(obj) + addHash(obj), function (data) {
                    resolve();
                });
            });
        },
        getEpisodesCount: function (infoType) {
            return parseInt(_loadDataFromServer(obj.objectType + ':' + obj.id + _sep + 'getEpisodesCount' + _sep + infoType));
        },
        toString: function () {
            return _loadDataFromServer(obj.objectType + ':' + obj.id + _sep + 'toString');
        }


    };
    addDefaultProps(obj);

    if (data) {
        obj = appendData(obj, data);
    }
    return obj;
}

function getPodcastDirectory(data) {
    var obj = {
        objectType: 'podcast_dir',
        instanceConstructor: 'getPodcastDirectory',
        getFeedList: function () {
            var list = getSharedList();
            _loadListFromServer(this.objectType + ':' + this.id + _sep + 'getFeedList' + getPriorityParamsFromObj(this) + addHash(this), list, function (data) {
                return getPodcast(data);
            });
            return list;
        },
        getChildren: function () {
            var list = getSharedList();
            _loadListFromServer(this.objectType + ':' + this.id + _sep + 'getChildren' + getPriorityParamsFromObj(this) + addHash(this), list, function (data) {
                return getPodcastDirectory(data);
            });
            return list;
        },
        commitAsync: function () {
            return new Promise(function (resolve) {
                _loadDataFromServer(obj.objectType + ':' + obj.id + _sep + 'commitAsync' + getPriorityParamsFromObj(obj) + addHash(obj), function (data) {
                    resolve();
                });
            });
        },
        removeAsync: function () {
            return new Promise(function (resolve) {
                _loadDataFromServer(obj.objectType + ':' + obj.id + _sep + 'removeAsync' + getPriorityParamsFromObj(obj) + addHash(obj), function (data) {
                    resolve();
                });
            });
        },


    };
    addDefaultProps(obj);

    if (data) {
        obj = appendData(obj, data);
    }
    return obj;
}

function getAlbum(data) {
    var obj = {
        objectType: 'album',
        instanceConstructor: 'getAlbum',
        getCachedThumb: function (x, y) {
            return getDefaultCachedThumb(this, x, y);
        },
        getThumbAsync: function (x, y, callback) {
            return getDefaultThumbAsync(this, x, y, callback);
        },
        getTracklist: function () {
            return getDefaultTracklist(this);
        },
        commitAsync: function () {

        },
        getTrackTypeAsync: function () {
            return new Promise((resolve) => {
                _loadDataFromServer(obj.objectType + ':' + obj.id + _sep + 'getTrackTypeAsync' + addHash(obj), function (data) {
                    resolve(data);
                });
            });
        },
    };
    addDefaultProps(obj);
    if (data) {
        obj = appendData(obj, data);
        //obj.description = atob(obj.description);
    }
    return obj;
}

function getGenre(data) {
    var obj = {
        objectType: 'genre',
        instanceConstructor: 'getGenre',
        getArtistList: function (SQL) {
            var _this = this;
            return getDefaultArtistlist({
                getArtistlistCommand: function () {
                    return _this.objectType + ':' + _this.id + _sep + 'getArtistlist' + getPriorityParamsFromObj(obj) + _sep + SQL;
                }
            });
        },
    };
    addDefaultProps(obj);
    obj = setDefaultMethods(obj);
    if (data) {
        obj = appendData(obj, data);
    }
    return obj;
}

function getArtist(data) {
    var obj = {
        objectType: 'artist',
        instanceConstructor: 'getArtist',
        commitAsync: function () {

        }
    };
    obj = setDefaultMethods(obj);
    if (data) {
        obj = appendData(obj, data);
    }
    return obj;
}

function getPerson(data) {
    return getArtist(data);
}

function getPlaylist(data, parent, id, title) {
    var obj = {
        objectType: 'playlist',
        instanceConstructor: 'getPlaylist',
        parent: parent,
        id: id,
        name: title,
        getChildren: function () {
            var list = getSharedList();
            if (webApp) {
                _loadListFromServer(obj.objectType + ':' + obj.id + _sep + 'getChildren' + addHash(obj), list, function (data) {
                    return getPlaylist(data, null);
                });
            }
            return list;
        },
        getTracklist: function () {
            return getDefaultTracklist(this);
        },
        getThumbAsync: function (x, y, callback) {
            return getDefaultThumbAsync(this, x, y, callback);
        },
    };
    addDefaultProps(obj);
    if (data) {
        obj = appendData(obj, data);
        //obj.name = atob(obj.name);
        //obj.queryData = atob(obj.queryData);
    }
    return obj;
};

/////////////////////////////////////////////////////////////////////
// default lists
/////////////////////////////////////////////////////////////////////
function newStringList() {
    var list = getSharedList();
    list.objectType = 'stringlist';
    list.instanceConstructor = 'newStringList';
    list.itemGrouper = function (item) {
        return convertStringToGroup(item);
    };
    return list;
}

function getPlaylistEntries() {
    var list = getSharedList();
    list.objectType = 'playlistentries';
    list.instanceConstructor = 'getPlaylistEntries';

    list._createInstance = function () {
        return getPlaylistEntries();
    };

    list.getTracklist = function () {
        var tlist = getTrackList();
        list.forEach(function (item) {
            tlist.add(item);
        });
        tlist.notifyLoaded();
        return tlist;
    };
    list.itemGrouper = function (item) {
        return convertStringToGroup(item.title);
    };

    list.getSelectedTracklist = function () {
        var sellist = list.getSelectedList();
        var tlist = getTrackList();
        sellist.forEach(function (item) {
            tlist.add(item.sd);
        });
        tlist.notifyLoaded();
        return tlist;
    };

    return list;
}

function getTrackList(data) {
    var list = getSharedList();
    list.objectType = 'tracklist';
    list.instanceConstructor = 'getTrackList';
    list._createInstance = function () {
        return getTrackList();
    };
    list.getTracklist = function () {
        return list;
    };
    list.getSelectedTracklist = function () {
        return list.getSelectedList();
    };
    list.randomize = function () {
        var arr = list.content;
        for (var i = arr.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var temp = arr[i];
            arr[i] = arr[j];
            arr[j] = temp;
        }
    };
    list.getGroupSort = function () {
        if (list._groupName === 'album')
            return 'album;albumArtist;';
        else if (list._groupName === 'artist')
            return 'artist;';
        else if (list._groupName === 'disc')
            return 'discNumber;';
        else if (list._groupName === 'season')
            return 'seasonNumber;';
        return '';
    };

    list.itemGrouper = function (item) {
        if (list._groupName)
            return item.itemGrouper(list._groupName);
        return '';
    };
    list.getDiscsCount = function () {
        var arr = list.content;
        var lastDisc = '';
        var discCount = 0;
        for (var i = 0; i < arr.length; i++) {
            var temp = arr[i];
            if (temp.discNumber !== lastDisc) {
                discCount++;
                lastDisc = temp.discNumber;
            }
        }
        return discCount;
    };

    list.getAlbumList = function () {
        return getDefaultAlbumlist(list);
    };

    list.getPersonList = function (person) {
        return getDefaultPersonlist(list, person);
    };

    list.commitAsync = dummyPromise();

    list.fillOnlineFromArray = function () {};

    if (data) {
        list = appendData(list, data);
    }
    return list;
}

function getAlbumList() {
    var list = getSharedList();
    list.objectType = 'albumlist';
    list.instanceConstructor = 'getAlbumList';
    list._createInstance = function () {
        return getAlbumList();
    };
    list.itemGrouper = function (item) {
        /*if(Length(FComparedColumns) > 0) {
            case FComparedColumns[0].id of
                ALBUMFIELD_ARTIST : result := convertStringToGroup( IAlbum( p1^).albumArtist);
                ALBUMFIELD_YEAR : if IAlbum( p1^).year <= 0 then
                result := _('Unknown')
        else
        begin
          result := IntToStr( IAlbum( p1^).year);
        end;
      ALBUMFIELD_YEAR_DECADES : if IAlbum( p1^).year <= 0 then
          result := _('Unknown')
        else
        begin
          result := IntToStr( ((IAlbum( p1^).year div 10) * 10))+'''s';
          //result := convertStringToGroup( IntToStr( IAlbum( p1^).year));
        end;
    else
      result := convertStringToGroup( IAlbum( p1^).title);
    end;
  end
  else*/
        return convertStringToGroup(item.title);
    };
    return list;
}

function getGenreList() {
    var list = getSharedList();
    list.objectType = 'genrelist';
    list.instanceConstructor = 'getGenreList';
    list._createInstance = function () {
        return getGenreList();
    };
    list.itemGrouper = function (item) {
        return convertStringToGroup(item.title);
    };
    return list;
}

function getArtistList() {
    var list = getSharedList();
    list.objectType = 'artistlist';
    list.instanceConstructor = 'getArtistList';
    list._createInstance = function () {
        return getArtistList();
    };
    list.itemGrouper = function (item) {
        return convertStringToGroup(item.title);
    };
    return list;
}

function getPersonList() {
    var list = getSharedList();
    list.instanceConstructor = 'getPersonList';
    list._createInstance = function () {
        return getPersonList();
    };
    list.itemGrouper = function (item) {
        return convertStringToGroup(item.title);
    };
    return list;
}

function getDBFolderList() {
    var list = getSharedList();
    list.updateHasSubfoldersAsync = function () {
        return new Promise(function (resolve) {
            list.locked(function () {
                for (var i = 0; i < list.count; i++) {
                    var item = list.getValue(i);
                    item.hasSubfolders = item.updateHasSubfolders();
                }
            });
            list.notifyChanged();
        });
    };
    return list;
}

/////////////////////////////////////////////////////////////////////
// default tree objects
/////////////////////////////////////////////////////////////////////
function createTreeNode(tree, parent) {
    var obj = {
        _inUpdate: 0,
        parent: parent,
        id: 0,
        icon: '',
        instanceConstructor: 'createTreeNode',
        title: function () {
            if (this.dataSource) return resolveToValue(this.dataSource.title, '');
            else if (this.dataSourceAsObservable) return resolveToValue(this.dataSourceAsObservable.title, '');
            else return 'title';
        },
        dataSource: null,
        dataSourceAsObservable: null,
        hasChildren: false,
        children: getSharedList(),
        clear: function () {
            this.children.clear();
        },
        locked: function (fn) {
            fn.bind(window)();
        },
        beginUpdate: function () {
            this._inUpdate++;
        },
        endUpdate: function () {
            if (--this._inUpdate === 0) {
                this.children.notifyLoaded();
            }
        },
        endUpdateAndGetDeleted: function () {
            this.endUpdate();
            return getSharedList();
        },
        checkUpdate: function (timeout) {
            this.children.notifyLoaded();
        },
        addChild: function (item, handler) {

            var assignItem = function (node) {
                node.handlerID = handler;
                node.dataSourceAsObservable = item;
                node.dataSource = item;
                node.level = obj.level + 1;
                /*if (item && (item.id !== undefined)) {
                    node.id = item.id;
                }*/
            };

            var node = createTreeNode(tree, this);
            assignItem(node);

            if (this.children.count > 0) {
                if (this.findChild(node.persistentID) !== null) {
                    return node;
                }
            }

            this.beginUpdate();
            this.children.add(node);
            this.endUpdate();
            var t = this.getTree();
            if (t) {
                if (this.expanded) {
                    t.doOnAdd();
                    t.doOnChange();
                } else
                    t.doOnChange();
            }
            return node;
        },
        getExpandedChildren: function () {
            var list = getSharedList();
            for (var i = 0; i < this.children.count; i++) {
                var n = this.children.getValue(i);
                if (n && resolveToValue(n.expanded, false)) {
                    list.add(n);
                }
            }
            return list;
        },
        addChildren: function (list, handler) {
            list.forEach(function (item) {
                this.addChild(item, handler);
            }.bind(this));
        },
        findChild: function (findNode) {
            for (var i = 0; i < this.children.count; i++) {
                var n = this.children.getValue(i);
                if (n.persistentID === findNode) {
                    return n;
                }
            }
            return null;
        },
        level: -1,
        tree: tree,
        getTree: function () {
            return this.tree;
        },
        handlerID: '',
        containsChild: function () {
            return this.children.count > 0;
        },
        expanded: false,
        collapse: function () {
            this.children.clear();
            var t = this.getTree();
            if (t) {
                t.doOnChange();
            }
            this.canceled = undefined;
        },
        getVisibleDescendantCount: function () {
            var total = this.children.count;
            for (var i = 0; i < this.children.count; i++) {
                total += this.children.getValue(i).getVisibleDescendantCount();
            }
            return total;
        }
    };
    addDefaultProps(obj);
    Object.defineProperties(obj, {
        persistentID: {
            get: function () {
                var result = obj.handlerID;
                if (obj.dataSourceAsObservable && (obj.dataSourceAsObservable._persistentID !== undefined))
                    result = obj.handlerID + ':' + obj.dataSourceAsObservable._persistentID;
                else
                if ((obj.dataSource) && (typeof obj.dataSource === 'string'))
                    result = obj.handlerID + '_' + obj.dataSource.asString;
                else
                if ((obj.dataSource) && (typeof obj.dataSource === 'object')) {
                    if (obj.dataSource['id'] !== undefined)
                        result = obj.handlerID + ':' + obj.dataSource.id;
                } else {
                    if (obj.id != 0)
                        result = obj.handlerID + ':' + obj.id;
                    else
                        result = obj.handlerID;
                }

                return result;
            }
        },
        nodePath: {
            get: function () {
                var ret = '';
                var node = this;
                while (node) {
                    if (ret == '')
                        ret = node.persistentID;
                    else
                        ret = node.persistentID + '/' + ret;
                    node = node.parent;
                }
                return ret;
            }
        },
        collection: {
            get: function () {
                var node = this;
                var res = null;
                while ((node) && (node.level >= 0)) {
                    if ((node.dataSourceAsObservable) && (node.dataSourceAsObservable.objectType === 'collection')) {
                        res = node.dataSourceAsObservable;
                    }
                    node = node.parent;
                }
                return res;
            }
        },
    });


    return obj;
}

var globalTree = null;

function createTree() {
    var tree = getSharedList();
    tree.root = createTreeNode(tree, null);
    tree.instanceConstructor = 'createTree';
    tree.getNodeByIndex = function (index) {

        var remaining = index;
        this.beginRead();
        var node = this.root;

        while (true) {
            var nodes = node.children;
            nodes.beginRead();
            for (var i = 0; i < nodes.count; i++) {
                var inode = nodes.getValue(i);
                if (remaining == 0) {
                    return inode;
                }

                var desc = inode.getVisibleDescendantCount() + 1;
                if (desc <= remaining) { // Look at the next sibling
                    remaining -= desc;
                } else { // Look at the children of this node
                    node = inode;
                    remaining--;
                    break;
                }
            }
            nodes.endRead();
        }
        this.endRead();
    }.bind(tree);
    tree.getValue = function (index) {
        return tree.getNodeByIndex(index);
    };
    tree.getCount = function () {
        return tree.root.getVisibleDescendantCount();
    }
    tree._focusedNode = tree.root;
    tree.doOnAdd = function () {
        raiseEvent(this, 'change', 'insert', 0);
    };
    tree.doOnChange = function () {
        raiseEvent(this, 'change');
    };
    tree.doClear = function () {
        raiseEvent(this, 'change');
    }
    if (globalTree = null)
        globalTree = tree;
    return tree;
};

/////////////////////////////////////////////////////////////////////
// default collection objects
/////////////////////////////////////////////////////////////////////
function createCollection(data) {
    var obj = {
        name: '',
        id: -1,
        _cachedVisible: true,
        _cachedEmpty: true,
        _type: 'music',

        icon: 'music',
        objectType: 'collection',
        instanceConstructor: 'createCollection',
        getType: function () {
            return this._type;
        },
        getCachedIsVisible: function () {
            return strToBool(this._cachedVisible);
        },
        getCachedIsEmpty: function () {
            return strToBool(this._cachedEmpty);
        },
        getIsVisibleAsync: function () {
            return new Promise(function (resolve) {
                if (webApp)
                    _loadDataFromServer(this.objectType + ':' + this.id + _sep + 'getIsVisibleAsync' + addHash(this), function (data) {
                        resolve(data);
                    });
                else
                    resolve(true);
            }.bind(this));
        },
        getCollectionQueryAsync: function () {
            return new Promise(function (resolve) {
                resolve(this.getCollectionQuery(false));
            }.bind(this));
        },
        getTracklist: function () {
            return getDefaultTracklist(this);
        },
        getAlbumList: function (known) {
            return getDefaultAlbumlist(this, known);
        },
        getGenreList: function () {
            return getDefaultGenrelist(this);
        },
        getArtistList: function () {
            return getDefaultArtistlist(this);
        },
        getPersonList: function (person) {
            return getDefaultPersonlist(this, person);
        },
        getRating: function (rating) {
            return getRating(this, rating);
        },
        getDecades: function (useOrigYear) {
            return getDefaultDecades(this, useOrigYear);
        },
        getCollectionQuery: function (ForOneSongChecking) {
            return _loadDataFromServer(this.objectType + ':' + this.id + _sep + 'getCollectionQuery' + _sep + (ForOneSongChecking ? 'true' : 'false') + addHash(this));
        },

    };
    addDefaultProps(obj);
    if (data) {
        obj = appendData(obj, data);
        //obj.description = atob(obj.description);
        //obj.collectionCond = atob(obj.collectionCond);
    }
    return obj;
}


function callODS() {}

/////////////////////////////////////////////////////////////////////
// default app object
/////////////////////////////////////////////////////////////////////
var app = {
    idle: function () {},
    cancelLoaderToken: function () {},
};

function createObjectByObjectType(objectType, data) {
    if (objectType == 'album') {
        return getAlbum(data);
    } else if ((objectType == 'person') || (objectType == 'artist') || (objectType == 'composer') ||
        (objectType == 'conductor') || (objectType == 'lyricist') || (objectType == 'producer') ||
        (objectType == 'actor') || (objectType == 'publisher') || (objectType == 'albumartist')) {
        return getArtist(data);
    } else if (objectType == 'genre') {
        return getGenre(data);
    } else if (objectType == 'podcast') {

    } else if (objectType == 'collection') {
        return createCollection(data);
    } else if (objectType == 'playlist') {
        return getPlaylist(data);
    } else if (objectType == 'track') {
        return getTrack(data);
    }
    return null;
};

app.getObject = function (objectType, params) {
    return new Promise(function (resolve) {
        if (webApp) {
            var retval = _loadDataFromServer('app' + _sep + 'getObject' + _sep + objectType + _sep + encodeURI(JSON.stringify(params)));
            if (retval)
                resolve(createObjectByObjectType(objectType, retval));
            else
                resolve();
        } else
            resolve();

    });
};

app.inSafeMode = function () {
    return false;
};

app.isStub = function () {};

app.ODS = function (par) {};

app.data = function () {};

app.artworks = function () {};

app.setValue = function (id, value) {
    if (window['storageSetValue'])
        window.storageSetValue(id, value);
    else
        localStorage.setItem(id, value);
};

app.getValue = function (id, def) {
    var ret = null;

    var retval = _loadDataFromServer('app' + _sep + 'getValue' + _sep + id);
    if ((retval !== '') && (retval !== '{}')) {
        ret = JSON.parse(retval);
        ret = concatObjects(ret, def);
    } else
    if (window['storageGetValue']) {
        ret = window.storageGetValue(id, def);
    } else {
        ret = localStorage.getItem(id) || def;
    }
    return ret;
};

app.flushState = function () {
    // no need to do anything in web app
}

app.listen = function (obj, event, func, capture) {
    if (obj && obj.addEventListener) obj.addEventListener(event, func, capture);
    return func;
};

app.unlisten = function (obj, event, func, capture) {
    if (obj && obj.removeEventListener) obj.removeEventListener(event, func, capture);
};

app.getAllTracksList = function () {};

app.getAllAlbumsList = function () {};

var keys = {};
window.onkeyup = function (e) {
    keys[e.keyCode] = false;
}
window.onkeydown = function (e) {
    keys[e.keyCode] = true;
}

app.hotkeys = {
    isKeyPressed: function (key) {
        var upKey = key.toUpperCase();
        var result = false;
        if ((upKey === 'CTRL') || (upKey === 'CONTROL'))
            result = keys['ctrl'];
        else
        if (upKey === 'ALT')
            result = keys['alt'];
        else
        if (upKey === 'SHIFT')
            result = keys['shift'];
        else
        if ((upKey === 'WINKEY') || (upKey === 'WINDOWS'))
            result = keys['win'];
        else
            return false;
    },
    getHotkeyList: function () {
        return {
            modified: false,
            hotkeyExists: function () {
                return false;
            },
            add: function () {},
            whenLoaded: function () {
                return new Promise(function () {});
            },
        };
    },
    newHotkeyData: {
        hotkey: '',
        action: '',
        global: false,
    }
};

app.playlists = {
    root: getPlaylist(null, null, 0, 'root'),
};

app.notifyLessChange = function () {

};

app.currentSkin = function () {
    var retval = window._currentSkin;
    var obj = {};
    if (retval !== '') 
        obj = appendData(obj, retval);
    return obj;
};

app.currentLayout = function () {
    var retval = window._currentLayout;
    var obj = {};
    if (retval !== '') 
        obj = appendData(obj, retval);
    return obj;
};

app.getCurrentPlayer = function () {
    return 1;
};

app.getSkins = function () {
    var list = getSharedList();
    if (webApp) {
        list.beginUpdate();
        for (var i = 0; i < window._skins.length; i++) {
            list.add({
                title: window._skins[i],
                id: window._skins[i],
                isCurrent: window._currentSkin == window._skins[i],
                path: window._skins[i],
            });
            if (window._currentSkin == window._skins[i]) {
                list.setSelected(i, true);
            }
        }
        list.endUpdate();
    }
    return list;
};

app.getLayouts = function () {
    var list = getSharedList();
    if (webApp) {
        list.beginUpdate();
        for (var i = 0; i < window._layouts.length; i++) {
            list.add({
                title: window._layouts[i],
                id: window._layouts[i],
                isCurrent: window._currentLayout == window._layouts[i],
                path: window._layouts[i],
            });
            if (window._currentLayout == window._layouts[i]) {
                list.setSelected(i, true);
            }
        }
        list.endUpdate();
    }
    return list;
};

app.selectSkin = function (name) {
    window._currentSkin = (!name || name === '') ? 'default' : name;
    app.reload();
};

app.loadLayout = function (name) {
    window._currentLayout = (!name || name === '') ? 'Desktop' : name;
    app.reload();
};

app.reload = function () {
    if (window['reloadApp']) {
        window['reloadApp']();
    }
};

var trackTypes = ['music', 'podcast', 'audiobook', 'classical', 'musicvideo', 'video', 'tv', 'videopodcast'];
var trackTypeNames = ['Music', 'Podcast', 'Audiobook', 'Classical Music', 'Music Video', 'Video', 'TV', 'Video Podcast'];

app.utils = {
    createSharedList: function () {
        return getSharedList();
    },
    createEmptyTrack: function () {
        return getTrack();
    },
    createEmptyArtist: function () {
        return getArtist();
    },
    createEmptyAlbum: function () {
        return getAlbum();
    },
    createTracklist: function () {
        return getTrackList();
    },
    createEmptyList: function () {
        return getSharedList();
    },
    createAlbumlist: function () {
        return getAlbumList();
    },
    createArtistlist: function () {
        return getArtistList();
    },
    logStackTrace: function () {
        //getDefaultString('utils' + _sep + 'logStackTrace');
        return new Error().stack;
    },
    myEncodeDate: function (val) {
        return getDefaultString('utils' + _sep + 'myEncodeDate' + _sep + val);
    },
    myFormatDateTime: function (val) {
        return getDefaultString('utils' + _sep + 'myFormatDateTime' + _sep + val);
    },
    multiString2VisualString: function (val) {
        return val;
    },
    songTimeToStrEx: function (time) {
        if (time <= 0) {
            return '0:00';
        } else {
            if ((time % 1000) == 0) { // no need for milliseconds
                if (time >= 60 * 60 * 1000) {
                    return sprintf('%d:%02d:%02d', time / (60 * 60 * 1000), time / (60 * 1000) % 60, (time / 1000) % 60);
                } else {
                    return sprintf('%d:%02d', time / (60 * 1000), (time / 1000) % 60);
                }
            } else {
                if (time >= 60 * 60 * 1000) {
                    return sprintf('%d:%02d:%02d.%03d', time / (60 * 60 * 1000), time / (60 * 1000) % 60, (time / 1000) % 60, time % 1000);
                } else {
                    return sprintf('%d:%02d.%03d', time / (60 * 1000), (time / 1000) % 60, time % 1000);
                }
            }
        }
    },
    songTimeToStr: function (time) {
        if (time < -1) {
            return '';
        } else {
            if (time < 0) {
                return 'Unknown';
            } else {
                if (time >= 60 * 60 * 1000)
                    return sprintf('%d:%02d:%02d', time / (60 * 60 * 1000), time / (60 * 1000) % 60, (time / 1000) % 60);
                else
                    return sprintf('%d:%02d', time / (60 * 1000), (time / 1000) % 60);
            }
        }
    },
    freqToStr: function (i) {
        if (i < -1) {
            return '';
        } else {
            if (i < 0)
                return 'Unknown';
            else
            if (i > 1000)
                return sprintf('%d %03d', i / 1000, i % 1000);
            else
                return i;
        }
    },
    stereoToStr: function (i) {
        if ((i >= 0) && (i < 9)) {
            var chanStr = ['Mono', 'Stereo', '2.1', '4.0', '5.0', '5.1', '6.1', '7.1', '8.1'];
            return chanStr[i];
        }
        return '';
    },
    boolToYesNo: function (val) {
        return val ? 'Yes' : 'No';
    },
    bitRateToStr: function (BR) {
        if (BR < 0)
            return '';
        else
        if (BR == 0)
            return '-';
        else
            return Math.ceil(BR / 1000);
    },
    dateTimeToStr: function (val) {
        return getDefaultString('utils' + _sep + 'dateTimeToStr' + _sep + val);
    },
    getNormalizeText: function (trackVal, albumVal) {
        return getDefaultString('utils' + _sep + 'getNormalizeText' + _sep + trackVal + _sep + albumVal);
    },
    formatNormalization: function (val) {
        return getDefaultString('utils' + _sep + 'formatNormalization' + _sep + val);
    },
    getMaxPathLength: function () {
        return 255;
    },
    removeFilenameExtension: function (val) {
        return getDefaultString('utils' + _sep + 'removeFilenameExtension' + _sep + val);
    },
    getFilename: function (val) {
        return getDefaultString('utils' + _sep + 'getFilename' + _sep + val);
    },
    getDirectory: function (val) {
        return getDefaultString('utils' + _sep + 'getDirectory' + _sep + val);
    },
    getTypeStringId: function (val) {
        if (val >= 0 && val < trackTypes.length)
            return trackTypes[val];
        else
            return '';
    },
    getTypeText: function (val) {
        // TODO: load translated texts
        if (val >= 0 && val < trackTypeNames.length)
            return trackTypeNames[val];
        else
            return '';
    },
    getCoverTypes: function () {
        /*const ctOther = 0,
            ctIcon = 1,
            ctOtherIcon = 2,
            ctFrontCover = 3,
            ctBackCover = 4,
            ctLeaflet = 5,
            ctMedia = 6,
            ctLeadArtist = 7,
            ctArtist = 8,
            ctConductor = 9,
            ctBand = 10,
            ctComposer = 11,
            ctLyricist = 12,
            ctRecLocation = 13,
            ctDuringRecording = 14,
            ctDuringPerf = 15,
            ctVideoCapt = 16,
            ctFish = 17,
            ctIllustration = 18,
            ctBandLogo = 19,
            ctStudioLogo = 20,
            ctLast = 20;
        var getCoverTypeDescr = function (covType) {
            switch covType { // TODO: load translated strings
            case ctOther, ctIcon, ctOtherIcon, ctFish:
                return 'Not specified';
            case ctFrontCover:
                return 'Cover (front)';
            case ctBackCover:
                return 'Cover (back)';
            case ctLeaflet:
                return 'Leaflet Page';
            case ctMedia:
                return 'Media Label';
            case ctLeadArtist:
                return 'Lead Artist';
            case ctArtist:
                return 'Artist';
            case ctConductor:
                return 'Conductor';
            case ctBand:
                return 'Band';
            case ctComposer:
                return 'Composer';
            case ctLyricist:
                return 'Lyricist';
            case ctRecLocation:
                return 'Recording Location';
            case ctDuringRecording:
                return 'During Recording';
            case ctDuringPerf:
                return 'During Performance';
            case ctVideoCapt:
                return 'Video Screen Capture';
            case ctIllustration:
                return 'Illustration';
            case ctBandLogo:
                return 'Band Logotype';
            case ctStudioLogo:
                return 'Publisher Logotype';
            }
            return '';
        };

        var isCoverTypeUnspec = function (covType) {
            return covType in [ctOther, ctIcon, ctOtherIcon, ctFish, ctLast];
        };

        var list = getSharedList();
        for (var covType = ctOther; covType <= ctLast; covType++) {
            if (covType == ctOther) || (!isCoverTypeUnspec(covType)) {
                list.add(getCoverTypeDescr(covType));
            }
        }
        return list;*/
    },
    language2shortcut: function (val) {
        return 'en';
    },
    text2TrackType: function (val) {
        for (var i = 0; i < trackTypeNames.length; i++) {
            if (trackTypeNames[i] == val) {
                return i;
            }
        }
        return -1;
    },
    visualString2MultiString: function (val) {
        return val;
    },
    myDecodeDate: function (val) {
        return getDefaultString('utils' + _sep + 'myDecodeDate' + _sep + val);
    },
    string2BPM: function (val) {
        if (typeof val === 'number') {
            if (val < 0)
                return 0;
            else
            if (val > 999)
                return 999;
            else
                return Math.round(val);
        } else
            return -1;
    },
    strToSongTimeEx: function (val) {
        return getDefaultString('utils' + _sep + 'strToSongTimeEx' + _sep + val);
    },
    getApplicationVersion: function (val) {
        return 5;
    },
    getPortableMode: function () {
        return getDefaultString('utils' + _sep + 'getPortableMode');
    },
    showCursor: function (val) {
        getDefaultString('utils' + _sep + 'showCursor' + _sep + val);
    },
    isAbsolutePath: function (val) {
        return getDefaultString('utils' + _sep + 'isAbsolutePath' + _sep + val, false);
    },
    getDataFromClipboard: function () {
        return null;
    },
    getValueLink: function (obj) {
        return {
            _data: obj,
            get: function () {
                return this._data;
            }
        };
    },

    getMonitorInfoFromCoords: function (_left, _top) {
        var ret = window.bounds.clientRect;
        ret.ratio = window.devicePixelRatio;
        return ret;
    },

    web: {
        getURLContent: function (URL, Headers, RequestBody) {
            if (webApp)
                return _loadDataFromServer('web' + _sep + 'getURLContent' + _sep + encodeURI(URL) + _sep + encodeURI(JSON.stringify(Headers.toArray)) + _sep + encodeURI(RequestBody));
            return '';
        },
        getURLContentAsync: function (URL, headers) {
            return new Promise(function (resolve) {
                var h = [];
                var rb = '';
                var tm = 0;
                var useReferrer = false;

                if (headers) {
                    h = (headers.headers ? headers.headers.content : h);
                    rb = headers.requestBody || rb;
                    tm = headers.cacheTimeout || tm;
                    if (headers.useReferrer !== undefined)
                        useReferrer = headers.useReferrer;
                }

                if (webApp)
                    _loadDataFromServer('web' + _sep + 'getURLContentAsync' + _sep + encodeURI(URL) + _sep + encodeURI(JSON.stringify(h)) + _sep + tm + _sep + encodeURI(rb) + _sep + (useReferrer ? 'true' : 'false'), function (data) {
                        resolve(data);
                    });
                else
                    resolve('');

            });
        },
        getAPIKey: function (keyname) {
            if (webApp)
                return _loadDataFromServer('web' + _sep + 'getAPIKey' + _sep + keyname);
            return '';
        },

    },

    isRegistered: function () {
        return _loadDataFromServer('utils' + _sep + 'isRegistered');
    },

    getJustInstalled: function () {
        return false;
    },
};

app.masks = {
    getVisName: function (mask) {
        return getDefaultString('masks' + _sep + 'getVisName' + _sep + encodeURI(mask), 'Mask ' + mask);
    },
    mask2VisMask: function (mask) {
        return getDefaultString('masks' + _sep + 'mask2VisMask' + _sep + encodeURI(mask), mask);
    },
    visMask2Mask: function (mask) {
        return getDefaultString('masks' + _sep + 'visMask2Mask' + _sep + mask, mask);
    },
    getDescription: function (mask) {
        return getDefaultString('masks' + _sep + 'getDescription' + _sep + mask, mask);
    },
    getPathPart: function (mask) {
        return getDefaultString('masks' + _sep + 'getPathPart' + _sep + mask, mask);
    },
    getMaskPathAndFileName: function (mask) {
        return getDefaultString('masks' + _sep + 'getMaskPathAndFileName' + _sep + encodeURI(mask), mask);
    },

    getDefaultWizardPathMasks: function () {
        var list = getSharedList();
        if (webApp) {
            _loadListFromServer('masks' + _sep + 'getMaskPathAndFileName' + _sep + mask, list);
        }
        return list;
    },
    getDefaultWizardFileMasks: function () {
        var list = getSharedList();
        if (webApp) {
            _loadListFromServer('masks' + _sep + 'getDefaultWizardFileMasks' + _sep + mask, list);
        }
        return list;
    },
    getDefaultFileMasks: function () {
        var list = getSharedList();
        if (webApp) {
            _loadListFromServer('masks' + _sep + 'getDefaultFileMasks' + _sep + mask, list);
        }
        return list;
    },
    getMaskResultForItem: function (track, mask, forfilename, NotUseUnknown, concatPath) {
        return getDefaultString('masks' + _sep + 'getMaskResultForItem' + _sep + track.id + _sep + mask + _sep + forfilename + _sep + NotUseUnknown + _sep + concatPath);
    }

}

app.db = {
    getTempoList: function () {
        var list = getSharedList();
        if (webApp) {
            _loadListFromServer('db' + _sep + 'getTempoList', list, function (data) {
                return getItemListItem(data);
            });
        }
        return list;
    },
    getMoodList: function () {
        var list = getSharedList();
        if (webApp) {
            _loadListFromServer('db' + _sep + 'getMoodList', list, function (data) {
                return getItemListItem(data);
            });
        }
        return list;
    },
    getOccasionList: function () {
        var list = getSharedList();
        if (webApp) {
            _loadListFromServer('db' + _sep + 'getOccasionList', list, function (data) {
                return getItemListItem(data);
            });
        }
        return list;
    },
    getQualityList: function () {
        var list = getSharedList();
        if (webApp) {
            _loadListFromServer('db' + _sep + 'getQualityList', list, function (data) {
                return getItemListItem(data);
            });
        }
        return list;
    },
    getQueryData: function (params) {
        return new Promise(function (resolve) {
            var isSearch = params.category === 'search';
            if (isSearch && mainQueryData) {
                resolve(mainQueryData);
            } else {
                if (webApp) {
                    _loadDataFromServer('db' + _sep + 'getQueryData' + _sep + params.category, function (data) {
                        var qd = getQueryData(data);
                        if (isSearch) {
                            mainQueryData = qd;
                        }
                        resolve(qd);
                    });
                } else
                    resolve(getQueryData());
            }
        });
    },
    getQueryDataSync: function (category) {
        if (webApp) {
            var data = _loadDataFromServer('db' + _sep + 'getQueryDataSync' + _sep + category);
            return getQueryData(data);
        } else
            resolve(getQueryData());
    },
    getTracklist: function (query, collID) {
        return getDefaultTracklist({
            getTracklistCommand: function () {
                return 'db' + _sep + 'getTracklist' + _sep + query + _sep + collID;
            }
        });
    },
    getArtistList: function (query, collID) {
        return getDefaultArtistlist({
            getArtistlistCommand: function () {
                return 'db' + _sep + 'getArtistList' + _sep + query + _sep + (collID ? collID : -1);
            }
        });
    },
    getAlbumList: function (query, collID) {
        return getDefaultAlbumlist({
            getAlbumlistCommand: function () {
                return 'db' + _sep + 'getAlbumList' + _sep + query + _sep + (collID ? collID : -1);
            }
        });
    },
    getFilesToEditNode: function (collID, nodeName, additionalInfo) {
        if (webApp) {
            return getItemListItem(JSON.parse(_loadDataFromServer('db' + _sep + 'getFilesToEditNode' + _sep + collID + _sep + nodeName + _sep + additionalInfo + _sep)));
        } else
            return getItemListItem();
    },
    compactDatabase: function (quick) {
        return new Promise(function (resolve) {
            if (webApp) {
                _loadDataFromServer('db' + _sep + 'compactDatabase' + _sep + quick, function () {
                    resolve();
                });
            } else
                resolve();
        });
    },
    reCreateFullTextIndex: function () {
        return new Promise(function (resolve) {
            if (webApp) {
                _loadDataFromServer('db' + _sep + 'reCreateFullTextIndex', function () {
                    resolve();
                });
            } else
                resolve();
        });
    },
    getAlbumAsync: function (album, artist, year) {
        return new Promise(function (resolve) {
            if (webApp) {
                _loadDataFromServer('db' + _sep + 'getAlbumAsync' + _sep + album + _sep + artist + _sep + year, function () {
                    resolve();
                });
            } else
                resolve();
        });
    },
    clearDatabase: function (tables) {
        return new Promise(function (resolve) {
            if (webApp) {
                _loadDataFromServer('db' + _sep + 'clearDatabase' + _sep + (tables ? tables.toString() : ''), function () {
                    resolve();
                });
            } else
                resolve();
        });
    },

    getPeople: function (params) {
        return getDefaultPersonlist({
            getPersonlistCommand: function () {
                return 'db' + _sep + 'getPeople' + _sep + params.category;
            }
        });
    },
    getStringList: function () {
        return getSharedList();
    },

    getExistingArtistList: function (arr) {
        return getDefaultArtistlist({
            getArtistlistCommand: function () {
                return 'db' + _sep + 'getExistingArtistList' + _sep + encodeURI(JSON.stringify(arr));
            }
        });
    },

    getPinnedObjects: function () {
        var list = getSharedList();
        if (webApp) {
            _loadListFromServer('db' + _sep + 'getPinnedObjects', list, function (data) {
                return getSharedObject(data);
            });
        }
        return list;
    },

    getQueryResultAsync: function (sql) {
        return new Promise(function (resolved) {
            if (webApp) {
                _loadDataFromServer('db' + _sep + 'getQueryResultAsync' + _sep + encodeURI(sql), function (data) {
                    resolved(getSharedObject(data));
                });
            } else
                resolved({});
        });
    },

    executeQueryAsync: function (sql) {
        return new Promise(function (resolved) {
            if (webApp) {
                _loadDataFromServer('db' + _sep + 'executeQuery' + _sep + encodeURI(sql), function () {
                    resolved();
                });
            } else
                resolved();
        });
    },

    insertQueryAsync: function (sql) {
        return new Promise(function (resolved) {
            if (webApp) {
                _loadDataFromServer('db' + _sep + 'insertQuery' + _sep + encodeURI(sql), function (val) {
                    resolved(val);
                });
            } else
                resolved();
        });
    },


    /*
    processUnlocatedTracks( tracks: ISharedList<IMovedSongData>): IJSPromise;
    beginTransaction;
    commitTransaction;*/

}

app.createTree = function () {
    return createTree();
};

app.collections = {
    getCollectionListAsync: function (params) {
        return new Promise(function (resolved) {
            var list = getSharedList();
            if (webApp)
                _loadListFromServer('collections' + _sep + 'getCollectionListAsync' +
                    _sep + (params.includeEntireLibrary ? 'true' : 'false') +
                    _sep + (params.cacheVisibility ? 'true' : 'false') +
                    _sep + (params.cacheIsEmpty ? 'true' : 'false'), list,
                    function (data) {
                        return createCollection(data);
                    },
                    function () {
                        resolved(list);
                    });
            else
                resolved(list);
        });
    },
    getMusicCollectionID: function () {
        if (webApp)
            return _loadDataFromServer('collections' + _sep + 'getMusicCollectionID');
        else
            return 0;
    },
    getCollection: function (id) {
        return createCollection(_loadDataFromServer('collections' + _sep + 'getCollection' + _sep + id));
    },
    getEntireLibrary: function () {
        return createCollection(_loadDataFromServer('collections' + _sep + 'getEntireLibrary'))
    },
};

var getPlayer = function () {
    if (__player)
        return __player;

    var player = new CustomEventTarget;
    var html5Player = document.createElement('div');
    html5Player.setAttribute('data-control-class', 'Html5PlayerController');
    document.body.appendChild(html5Player);
    setVisibility(html5Player, false);
    initializeControl(html5Player);
    player.entries = getPlaylistEntries();
    player.currentTrack = undefined;
    player.playlistPos = -1;
    player.autoDJ = {};
    player.htmlPlaybackState = {
        positionMS: 0,
        lengthMS: 0,
        _state: ''
    };

    player.onTrackEnd = function () {};

    Object.defineProperty(player.htmlPlaybackState, 'state', {
        get: function () {
            return this._state;
        },
        set: function (value) {
            var callEvent = (value !== this._state);
            this._state = value;
            if (value)
                player.onTrackEnd();
            if (callEvent)
                player.doOnPlaybackChange(value);
        }
    });

    player.getSongList = function () {
        return player.entries;
    };

    player.getFastCurrentTrack = function (val) {
        if (player.currentTrack)
            return player.currentTrack.sd;
        else
            return undefined;
    };

    player.getCurrentTrack = function () {
        if (player.currentTrack)
            return player.currentTrack.sd;
        else
            return undefined;
    };

    player.getNextTrack = function () {
        return undefined;
    };

    player.visualization = {
        spectrumSections: 10,
        registerVisTypes: function () {},
        getNextResult: function () {}
    };

    player.clearPlaylistAsync = function (saveHistory) {
        return new Promise(function (resolved) {
            player.playlistPos = -1;
            player.currentTrack = undefined;
            player.entries.clear();
            resolved();
        });
    };

    player.stop = function () {
        html5Player.controlClass.stop();
        player.currentTrack = undefined;
    };

    player.play = function () {
        if (!player.currentTrack) {
            player.setPlaylistPos(0);
        } else
            html5Player.controlClass.play();
    };

    player.pause = function () {
        html5Player.controlClass.pause();
    };

    player.doOnPlaybackChange = function (newState) {
        raiseEvent(player, 'playbackState', newState);
    };

    player.setCurrentTrack = function (pe) {
        var lastTrack = undefined;
        if (player.currentTrack !== pe) {
            if (player.currentTrack)
                lastTrack = player.currentTrack.sd;
            player.currentTrack = pe;
            html5Player.controlClass.load(pe.sd);
        }
        player.entries.focusedIndex = player.playlistPos;
        if (lastTrack)
            lastTrack.doOnChange();
        player.doOnPlaybackChange('trackChanged');
        if (player.currentTrack && player.currentTrack.sd)
            player.currentTrack.sd.doOnChange();
    };

    player.setPlaylistPos = function (idx) {
        if ((idx < 0) || (idx >= player.entries.count))
            return;
        if (idx !== player.playlistPos) {
            if (player.isPlaying) {
                player.stop();
                player.playlistPos = idx;
            } else
                player.playlistPos = idx;
        }
        player.setCurrentTrack(player.entries.getValue(idx));
        player.play();
    };

    player.setPlaylistPosAsync = function (idx) {
        return new Promise(function (resolve, reject) {
            player.setPlaylistPos(idx);
            resolve();
        });
    };

    player.addTracksAsync = function (tracks, options) {
        /*
        TODO: playlists, support for options:
            checkMedia {Boolean} - if true, it checks accessibility of tracks before adding, default = false
            forcePreview {Boolean} - if true, it plays only preview of added tracks, default = false
            saveHistory {Boolean} - if true, it adds this action to nowplaying history, default = true
        */
        return new Promise(function (resolve, reject) {
            var sl = [];
            var pe;
            options = options || {};
            if (tracks.objectType === 'tracklist') {
                tracks.forEach(function (sd) {
                    sl.push(getPlaylistEntry(sd));
                });
            } else {
                sl = getPlaylistEntries();
                var sd;
                if (tracks.objectType === 'stringlist') {
                    tracks.forEach(function (path) {
                        sd = getTrack();
                        sd.path = path;
                        sl.push(getPlaylistEntry(sd));
                    });
                } else if (isString(tracks)) {
                    sd = getTrack();
                    sd.path = tracks;
                    sl.push(getPlaylistEntry(sd));
                }
            }
            if (options.shuffle) {
                sl.randomize();
            }
            if (options.afterCurrent) {
                options.withClear = false;
                if (this.playlistPos >= 0)
                    options.position = this.playlistPos + 1;
                else
                    options.position = 0;
            }
            if (options.withClear) {
                if (player.isPlaying)
                    player.stop();
                player.clearPlaylist();
            }

            if (options.position > player.entries.count)
                options.position = player.entries.count;
            if (options.withClear || (options.position < 0) || (options.position === undefined)) {
                player.entries.addList(sl);
            } else {
                player.entries.insertList(sl, options.position);
            }
            if (options.position <= player.playlistPos)
                player.playlistPos += sl.length;
            if (options.startPlayback) {
                player.stop();
                if ((options.position < 0) || (options.position === undefined))
                    options.position = 0;
                player.setPlaylistPos(options.position);
            }
            resolve();
        });
    };

    player.playAsync = function () {
        return new Promise(function (resolve, reject) {
            player.play();
            resolve();
        });
    };

    player.stopAsync = function () {
        return new Promise(function (resolve, reject) {
            player.stop();
            resolve();
        });
    };

    player.pauseAsync = function () {
        return new Promise(function (resolve, reject) {
            player.pause();
            resolve();
        });
    };

    player.playPauseAsync = function () {
        return new Promise(function (resolve, reject) {
            if (player.isPlaying)
                player.pause();
            else
                player.play();
            resolve();
        });
    };

    player.nextAsync = function (checkSkip) {
        return new Promise(function (resolve, reject) {
            //TODO
            resolve(true);
        });
    };

    player.prevAsync = function (checkSkip) {
        return new Promise(function (resolve, reject) {
            //TODO
            resolve(true);
        });
    };

    player.seekMSAsync = function (value) {
        return new Promise(function (resolve, reject) {
            html5Player.controlClass.seekTo(value);
            resolve();
        });
    };

    player.isPlayingTrack = function (sd) {
        var res = false;
        var currSD = player.getCurrentTrack();
        if ((!sd) || (!currSD))
            return res;
        res = ((sd.idsong > 0) && (sd.idsong === currSD.idsong));
        if (!res) {
            var path1 = sd.path;
            var path2 = currSD.path;
            res = ((path1 === path2) && (sd.mediaSN === currSD.mediaSN) && (currSD.path));
        };
        return res;
    };

    player.saveState = function () {
        app.setValue('playlistPos', player.playlistPos);
        app.setValue('nowPlaying', player.entries.content);

    };

    player.restoreState = function () {
        var data = app.getValue('nowPlaying', []);
        for (var i = 0; i < data.length; i++) {
            player.entries.add(getPlaylistEntry(getTrack(data[i].sd, true)));
        }
        player.playlistPos = app.getValue('playlistPos', player.playlistPos);
        if (player.playlistPos >= 0) {
            player.setCurrentTrack(player.entries.getValue(player.playlistPos));
        }
    };

    player.getDefaultAction = function () {
        return 'playNow';
    };

    player.getUndoList = function () {
        return null;
    };

    player.getRedoList = function () {
        return null;
    };

    player.refreshStatus = function () {


    };

    player.getVideoSettings = function () {
        return {
            zoom: app.getValue('videosettings_zoom', 1),
            moveX: app.getValue('videosettings_movex', 0),
            moveY: app.getValue('videosettings_movey', 1),
            aspectRatioX: app.getValue('videosettings_ratiox', 0),
            aspectRatioY: app.getValue('videosettings_ratioy', 0),
            flags: app.getValue('videosettings_flags', 1)
        }
    };

    player.setVideoSettings = function (data) {
        app.setValue('videosettings_zoom', data.zoom);
        app.setValue('videosettings_movex', data.moveX);
        app.setValue('videosettings_movey', data.moveY);
        app.setValue('videosettings_ratiox', data.aspectRatioX);
        app.setValue('videosettings_ratioy', data.aspectRatioY);
        app.setValue('videosettings_flags', data.flags);
    };

    Object.defineProperty(player, 'isPlaying', {
        get: function () {
            return ((player.htmlPlaybackState.state === 'play') || (player.htmlPlaybackState.state === 'pause'));
        }
    });

    Object.defineProperty(player, 'volume', {
        get: function () {
            return html5Player.controlClass.getVolume();
        },
        set: function (val) {
            html5Player.controlClass.setVolume(val);
            doOnPlaybackState('volumeChanged');
        }
    });

    Object.defineProperty(player, 'trackPositionMS', {
        get: function () {
            return player.htmlPlaybackState.positionMS;
        }
    });

    Object.defineProperty(player, 'trackLengthMS', {
        get: function () {
            return player.htmlPlaybackState.lengthMS;
        }
    });


    __player = player;
    return player;
}

if (!webApp) {
    // fake object for static web version
    app.player = {
        entries: getPlaylistEntries(),
        autoDJ: {},
        htmlPlaybackState: {
            positionMS: 0,
            lengthMS: 0,
            _state: ''
        },
        getSongList: function () {
            return this.entries;
        },
        getFastCurrentTrack: function (val) {
            return undefined;
        },
        getCurrentTrack: function () {
            return undefined;
        },
        visualization: {
            spectrumSections: 10,
            registerVisTypes: function () {},
            getNextResult: function () {}
        },
        refreshStatus: function () {

        },
        isPlaying: false,
        volume: 1,
        trackPositionMS: 0,
        trackLengthMS: 0
    };
}

app.downloader = {
    itemList: getSharedList(),
    getDownloadsCount: function () {
        return 0;
    },
};

app.sharing = {

    getServers: function () {
        var list = getSharedList();
        if (app)
            _loadListFromServer('app' + _sep + 'sharing' + _sep + 'getServers', list, function (data) {
                return data; // TODO
            });
        return list;
    },
    getRemoteServers: function () {
        var list = getSharedList();
        if (webApp)
            _loadListFromServer('app' + _sep + 'sharing' + _sep + 'getRemoteServers', list, function (data) {
                return data; // TODO
            });
        return list;
    },
    addRemoteServerAsync: function (descriptionURL) {
        return new Promise(function (resolve) {
            if (webApp)
                _loadDataFromServer('app' + _sep + 'sharing' + _sep + 'addRemoteServerAsync' + _sep + encodeURI(descriptionURL), function (data) {
                    resolve(data);
                });
            else
                resolve('');
        });
    },
    getAvailablePlayers: function () {
        var list = getSharedList();
        if (webApp)
            _loadListFromServer('app' + _sep + 'sharing' + _sep + 'getAvailablePlayers', list, function (data) {
                return data; // TODO
            });
        return list;
    },
    getActivePlayer: function () {
        if (webApp)
            return getMediaServerPlayer(_loadDataFromServer('app' + _sep + 'sharing' + _sep + 'getActivePlayer'));
        return getMediaServerPlayer();
    },
    setActivePlayerUUID: function (uuid) {
        if (webApp)
            _loadDataFromServer('app' + _sep + 'sharing' + _sep + 'setActivePlayerUUID' + _sep + encodeURI(uuid));
    },
    createNewServer: function () {
        if (webApp)
            return getMediaServer(_loadDataFromServer('app' + _sep + 'sharing' + _sep + 'createNewServer'));
        return getMediaServer();
    },
    setPlayerControlAllowed: function (value) {
        if (webApp)
            return _loadDataFromServer('app' + _sep + 'sharing' + _sep + 'setPlayerControlAllowed' + _sep + encodeURI(value));
    },
    getAuthReceiver: function () {
        if (webApp)
            return getAuthReceiver(_loadDataFromServer('app' + _sep + 'sharing' + _sep + 'getAuthReceiver'));
        return getAuthReceiver();
    },
    runAuthServer: function () {
        return new Promise(function (resolve) {
            if (webApp)
                _loadDataFromServer('app' + _sep + 'sharing' + _sep + 'runAuthServer', function () {
                    resolve();
                });
            else
                resolve();
        });
    },
    stopAuthServer: function () {
        if (webApp)
            _loadDataFromServer('app' + _sep + 'sharing' + _sep + 'stopAuthServer');
    },
    getAuthServerPort: function () {
        if (webApp)
            return _loadDataFromServer('app' + _sep + 'sharing' + _sep + 'getAuthServerPort');
        return '9465';
    }
};

app.settings = {
    getJSON: function (section) {
        if (webApp) {
            var json = getDefaultString('settings' + _sep + 'getJSON' + _sep + section);
            try {
                JSON.parse(json);
            } catch (err) {
                alert(err);
            }
            return json;
        } else {
            var sections = section.split(',');
            var ret = {};
            for (var i = 0; i < sections.length; i++) {
                var r = app.settings.data[sections[i].trim()];
                for (var prop in r) {
                    ret[prop] = r[prop];
                };
            }
            return JSON.stringify(ret);
        }
    },
    setJSON: function (section, json) {
        return getDefaultString('settings' + _sep + 'setJSON' + _sep + section + _sep + json);
    },
    getMaskList: function () {

    },
    addMask2History: function () {

    },
    loadPreset: function () {},
    savePreset: function () {},
    utils: {
        setCoverStorageType: function (coverStorageType) {
            getDefaultString('settingsutils' + _sep + 'setCoverStorageType' + _sep + coverStorageType);
        },
        getCoverStorageType: function () {
            return getDefaultString('settingsutils' + _sep + 'getCoverStorageType' + _sep);
        },
        getSearchFields: function () {
            return getDefaultString('settingsutils' + _sep + 'getSearchFields' + _sep);
        },
        getTrackTypeSettings: function () {
            return getDefaultString('settingsutils' + _sep + 'getTrackTypeSettings' + _sep);
        },
        setRipSettings: function (pathWithDrive, json) {
            getDefaultString('settingsutils' + _sep + 'setRipSettings' + _sep + pathWithDrive + _sep + json);
        },
        getRipSettings: function (pathWithDrive) {
            return getDefaultString('settingsutils' + _sep + 'getRipSettings' + _sep + pathWithDrive);
        },
        getPlayNowActionType: function (trackType) {
            return getDefaultString('settingsutils' + _sep + 'getPlayNowActionType' + _sep + trackType);
        },
        getShuffleAllInPlayNow: function (trackType) {
            return (getDefaultString('settingsutils' + _sep + 'getShuffleAllInPlayNow' + _sep + trackType) == 'true');
        }
        //    class procedure setSearchFields( aSearchFields: ISharedStringList);
        //    class procedure setTrackTypeSettings( aTrackTypeSettings: ISharedStringList);


    }
};

app.settings.data = {
    'Options': {
        Options: {
            SearchMissingArtwork: true,
            SearchMissingArtistImage: true,
            SearchMissingLyrics: false,
        }
    },
    'CustomFields': {
        CustomFields: {
            Fld1Name: 'Custom1',
            Fld2Name: 'Custom2',
            Fld3Name: 'Custom3',
            Fld4Name: 'Custom4',
            Fld5Name: 'Custom5',
            Fld6Name: 'Custom6',
            Fld7Name: 'Custom7',
            Fld8Name: 'Custom8',
            Fld9Name: 'Custom9',
            Fld10Name: 'Custom10',
        }
    },
    'System': {
        System: {
            ShowDetailsInOrder0: '%S;%A;%L;%T;%ZZG',
            ShowDetailsInOrder1: '%S;%ZU;%A;%ZP',
            ShowDetailsInOrder2: '%L;%S;%A;%Y;%ZZG',
            ShowDetailsInOrder3: '%S;%C;%A;%L;%ZZG',
            ShowDetailsInOrder4: '%S;%A;%L;%T;%ZZG',
            ShowDetailsInOrder5: '%S;%ZV;%Y;%ZZA;%ZY',
            ShowDetailsInOrder6: '%S;%ZV;%Y;%ZZA;%ZY',
            ShowDetailsInOrder7: '%S;%ZU;%A;%ZP',
            ShowDetailsTextHeight: -9,

        }
    },

};

app.dialogs = {
    getMainWindow: function () {
        return {
            setValue: function (id, value) {
                if (window['storageSetValue'])
                    window.storageSetValue('mainWindow_' + id, value);
                else
                    localStorage.setItem('mainWindow_' + id, value);
            },

            getValue: function (id, def) {
                var ret = null;
                if (window['storageGetValue'])
                    ret = window.storageGetValue('mainWindow_' + id, def);
                else
                    ret = localStorage.getItem('mainWindow_' + id) || def;
                return ret;
            },

        };
    },

    openDialog: function (addr, params) {



    },

    openModalDialog: function (addr, params) {


    },
};

app.devices = {
    getAll: function () {
        return createTreeNode(globalTree, null);
    },
    getForTrackId: function (id) {
        return getDefaultSimpleList('devices' + _sep + 'getForTrackId' + _sep + id);
    },

};

app.filesystem = {
    scanForMedia: function (pathsToScan, exts) {
        return new Promise(function (resolve) {
            resolve();
        });
    },
    simpleScanForMedia: function (path) {
        return new Promise(function (resolve) {
            resolve();
        });
    },
    scanForMovedFiles: function (sl, paths) {
        return new Promise(function (resolve) {
            resolve();
        });
    },
    processLocatedFiles: function (list) {
        return new Promise(function (resolve) {
            resolve();
        });
    },
    getAudioExtensions: function () {
        return getDefaultSimpleList('filesystem' + _sep + 'getAudioExtensions');
    },
    getVideoExtensions: function () {
        return getDefaultSimpleList('filesystem' + _sep + 'getVideoExtensions');
    },
    getPlaylistExtensions: function () {
        return getDefaultSimpleList('filesystem' + _sep + 'getPlaylistExtensions');
    },
    getAudioExtensionsAsync: function () {
        return getDefaultSimpleList('filesystem' + _sep + 'getAudioExtensionsAsync');
    },
    getVideoExtensionsAsync: function () {
        return getDefaultSimpleList('filesystem' + _sep + 'getVideoExtensionsAsync');
    },
    getPlaylistExtensionsAsync: function () {
        return getDefaultSimpleList('filesystem' + _sep + 'getPlaylistExtensionsAsync');
    },
    getAudioFileTypes: function (fileTypes) {
        return getDefaultSimpleList('filesystem' + _sep + 'getAudioFileTypes' + _sep + (fileTypes === undefined ? 'true' : fileTypes));
    },
    getVideoFileTypes: function (fileTypes) {
        return getDefaultSimpleList('filesystem' + _sep + 'getVideoFileTypes' + _sep + (fileTypes === undefined ? 'true' : fileTypes));
    },
    getPlaylistFileTypes: function (fileTypes) {
        return getDefaultSimpleList('filesystem' + _sep + 'getPlaylistFileTypes' + _sep + (fileTypes === undefined ? 'true' : fileTypes));
    },
    getInsertedMediaList: function () {
        return getDefaultSimpleList('filesystem' + _sep + 'getInsertedMediaList');
    },
    getFileType: function (path) {
        return getDefaultString('filesystem' + _sep + 'getFileType' + _sep + path);
    },
    getScanExtensions: function () {
        return getDefaultSimpleList('filesystem' + _sep + 'getScanExtensions');
    },
    setScanExtensions: function (list) {},
    renameFile: function (src, dst) {
        return getDefaultSimpleList('filesystem' + _sep + 'renameFile' + _sep + src + _sep + dst, false);
    },
    renameFiles: function () {},
    deleteFile: function (src) {
        return getDefaultString('filesystem' + _sep + 'deleteFile' + _sep + src, false);
    },
    deleteFolder: function (path) {
        getDefaultString('filesystem' + _sep + 'deleteFolder' + _sep + path);
    },
    fileExists: function (path) {
        return getDefaultString('filesystem' + _sep + 'fileExists' + _sep + path, false);
    },
    dirExists: function (path) {
        return getDefaultString('filesystem' + _sep + 'dirExists' + _sep + path, false);
    },
    getPathSeparator: function () {
        return getDefaultString('filesystem' + _sep + 'getPathSeparator');
    },
    getSystemFolderMyMusic: function () {
        return getDefaultString('filesystem' + _sep + 'getSystemFolderMyMusic');
    },
    getSystemFolderMyVideo: function () {
        return getDefaultString('filesystem' + _sep + 'getSystemFolderMyVideo');
    },
    getPluginsFolder: function (global) {
        return getDefaultString('filesystem' + _sep + 'getPluginsFolder' + _sep + global);
    },
    getApplicationPath: function () {
        return getDefaultString('filesystem' + _sep + 'getApplicationPath');
    },
    getLastScannedFolders: function () {
        return getDefaultSimpleList('filesystem' + _sep + 'getLastScannedFolders');
    },
    getDriveList: function (includeOptical) {
        return new Promise(function (resolve) {
            var list = getSharedList();
            if (webApp) {
                _loadListFromServer('filesystem' + _sep + 'getDriveList' + _sep + includeOptical, list, function (data) {
                    return getSharedFolder(data);
                }, function () {
                    resolve(list);
                });
            } else
                resolve(list);
        });
    },
    getFoldersList: function (path) {
        return new Promise(function (resolve) {
            var list = getSharedList();
            if (webApp) {
                _loadListFromServer('filesystem' + _sep + 'getFoldersList' + _sep + path, list, undefined, function () {
                    resolve(list);
                });
            } else
                resolve(list);
        });
    },
    getFileSizeAsync: function (fileName) {
        return new Promise(function (resolve) {
            if (webApp) {
                _loadDataFromServer('filesystem' + _sep + 'getFileSizeAsync' + _sep + fileName, function (data) {
                    resolve(data);
                });
            } else
                resolve(0);
        });
    },
    getFolderOfPathAsync: function (path) {
        return new Promise(function (resolve) {
            if (webApp) {
                _loadDataFromServer('filesystem' + _sep + 'getFolderOfPathAsync' + _sep + path, function (data) {
                    resolve(data);
                });
            } else
                resolve(0);
        });
    },
    getDBFolderListAsync: function (parentID, collectionID) {
        var list = getDBFolderList();
        if (webApp) {
            _loadListFromServer('filesystem' + _sep + 'getDBFolderListAsync' + _sep + parentID + _sep + collectionID, list, function (data) {
                return getSharedDBFolder(data);
            });
        }
        return list;
    },

    getUserFolder: function () {
        if (webApp) {
            return _loadDataFromServer('filesystem' + _sep + 'getUserFolder');
        }
        return '';
    },

    getFolderFromString: function (folder, isTemp) {
        return getSharedDBFolder(_loadDataFromServer('filesystem' + _sep + 'getFolderFromString' + _sep + folder + _sep + (isTemp ? 'true' : 'false')));
    },

    getDataFolder: function () {
        return getDefaultString('filesystem' + _sep + 'getDataFolder');
    },

    loadTextFromFileAsync: function (fileName, params) {
        return new Promise(function (resolve) {
            if (webApp) {
                _loadDataFromServer('filesystem' + _sep + 'loadTextFromFileAsync' + _sep + fileName, function (data) {
                    resolve(data);
                });
            } else
                resolve(0);
        });
    },
    
    getCurrentLessMD5Async: function () {
        return new Promise(function(resolve) {
            resolve('');
        });
    },

    /*deleteFolderAsync( const path: string; const toRecycle: boolean) : IJSPromise;
    saveToFileAsync(const fileName: string; const data: ansistring; const len: integer): IJSPromise;
    getCurrentLessMD5Async: IJSPromise;*/


    /*    
        getFileContentAsync( params: TCefv8ValueArray) : ICefV8Value;
        getNetworkResourceList : ISharedList<INetworkResource>;
        setLastScannedFolders( paths: ISharedStringList);
        getMonitoredFolders: ISharedUIList<ISharedFolder>;
        fileNamesToSongList( list: ISharedStringList): ISongList;
        
        
    */





};

app.trayIcon = {
    show: function () {},
    hide: function () {},
    setHint: function (hint) {},
};

function getBackgroundTask() {
    return {
        leadingText: '',
        text: '',
        value: 0,
        taskType: '',
        id: 0,
        terminated: false,
        terminate: function () {
            this.terminated = true;
        }
    };
};

app.backgroundTasks = {
    createNew: function () {
        return getBackgroundTask();
    }
};

app.podcasts = {

    getDefaultPodcastData: function () {
        return getPodcast(_loadDataFromServer('podcasts' + _sep + 'getDefaultPodcastData'));
    },
    itemIndexFromDownloadType: function (ComboBoxID, DownloadType) {
        return parseInt(_loadDataFromServer('podcasts' + _sep + 'itemIndexFromDownloadType' + _sep + ComboBoxID + _sep + DownloadType));
    },
    downloadTypeFromItemIndex: function (ItemIndex1, ItemIndex2) {
        return parseInt(_loadDataFromServer('podcasts' + _sep + 'downloadTypeFromItemIndex' + _sep + ItemIndex1 + _sep + ItemIndex2));
    },
    getDownloadTypeCaptions: function (itemindex) {
        var list = getSharedList();
        _loadListFromServer('podcasts' + _sep + 'getDownloadTypeCaptions' + _sep + itemindex, list);
        return list;
    },
    getPodcastByURLAsync: function (URL) {
        return new Promise(function (resolve) {
            _loadDataFromServer('podcasts' + _sep + 'getPodcastByURLAsync' + _sep + URL, function (data) {
                resolve(getPodcast(data));
            });
        });
    },
    getPodcastByURL: function (URL) {
        return getPodcast(_loadDataFromServer('podcasts' + _sep + 'getPodcastByURL' + _sep + URL));
    },
    getPodcastByID: function (id) {
        return getPodcast(_loadDataFromServer('podcasts' + _sep + 'getPodcastByID' + _sep + id));
    },
    isAnyPodcastSubscribed: function () {
        return _loadDataFromServer('podcasts' + _sep + 'isAnyPodcastSubscribed') === 'true';
    },
    runUpdate: function () {
        _loadDataFromServer('podcasts' + _sep + 'runUpdate');
    },
    getPodcastList: function () {
        var list = getSharedList();
        _loadListFromServer('podcasts' + _sep + 'getPodcastList', list, function (data) {
            return getPodcast(data);
        });
        return list;
    },
    getPodcastListBySQL: function (SQL) {
        var list = getSharedList();
        _loadListFromServer('podcasts' + _sep + 'getPodcastListBySQL' + _sep + SQL, list, function (data) {
            return getPodcast(data);
        });
        return list;
    },
    getPodcastDirectories: function () {
        var list = getSharedList();
        _loadListFromServer('podcasts' + _sep + 'getPodcastDirectories', list, function (data) {
            return getPodcastDirectory(data);
        });
        return list;
    },
    addDirectory: function (url) {
        _loadDataFromServer('podcasts' + _sep + 'addDirectory' + _sep + url);
    }
};


/////////////////////////////////////////////////////////////////////
// default window object
/////////////////////////////////////////////////////////////////////

function getWindowObj() {
    var w = {
        _loaders: [],
        _isloaded: false,
        _loadedEventSet: false,
        callDialogInit: function () {},
        _alert: function (msg) {
            console.log(msg);
        },
        bounds: {
            mouseInside: function (x, y) {
                return true;
            },
            setMinHeight: function () {},
        },
        assert: function (cond, text) {
            if (!cond)
                this._alert(text);
        },
        addHeader: window._addHeader !== undefined ? window._addHeader : false,
        headerClass: null,
        builtInMenu: true,
        moveable: false,
        resizeable: false,
        maximized: false,
        minimized: false,
        flat: false,
        frameColor: 0,

        closeWindow: window.close,
        isMainWindow: true,

        notifyOnReady: function () {},
        setMoveableArea: function () {},
        setSize: function () {},

        _: function (str) {
            return str;
        },
        updateDevicePixelRatio: function () {},

        notifyOnClose: function () {},
        ODS: function (text) {
            console.log(text);
        },
        copyObject: function (o) {
            return o;
        },
        _callAllLoaders: function () {
            var lst = this._loaders;
            this._loaders = [];

            lst.forEach((callback) => {
                callback();
            });
        },
        whenLoaded: function (callback) {
            this._loaders.push(callback);

            if (this._isloaded) {
                this._callAllLoaders();
            } else if (!this._loadedEventSet) {
                this._loadedEventSet = true;
                window.addEventListener('load', () => {
                    this._isloaded = true;
                    this._callAllLoaders();
                });
            }
        },

    }

    Object.defineProperty(w.bounds, 'clientRect', {
        get: function () {
            var l = window.screenX - screen.availLeft;
            var t = window.screenY - screen.availTop + (window.outerHeight - window.innerHeight);
            var w = document.body.clientWidth;
            var h = document.body.clientHeight;

            return {
                left: l,
                top: t,
                width: w,
                height: h,
                right: l + w,
                bottom: t + h
            }
        }
    });

    Object.defineProperty(w.bounds, 'windowRect', {
        get: function () {
            var l = window.screenX - screen.availLeft;
            var t = window.screenY - screen.availTop + (window.outerHeight - window.innerHeight);
            var w = document.body.clientWidth;
            var h = document.body.clientHeight;

            return {
                left: l,
                top: t,
                width: w,
                height: h,
                right: l + w,
                bottom: t + h
            }
        }
    });

    return w;
};

window = concatObjects(window, getWindowObj());
window.thisWindow = window;
