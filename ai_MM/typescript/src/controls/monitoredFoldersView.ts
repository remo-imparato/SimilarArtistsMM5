'use strict';


import Checkbox from './checkbox';
/**
@module UI
*/

import ListView from './listview';

/**
UI element for view & setting up monitored folders

@class MonitoredFoldersView
@constructor
@extends Control
*/

const
    T_ONETIME = _('One time'),
    T_MANUAL = _('Manual'),
    T_STARTUP = _('At startup'),
    T_CONT = _('Continuously'),
    T_BOTH = T_STARTUP + ' & ' + T_CONT;

const
    AutoDetectText = _('Auto detection');

declare global {
    var scanItemHandlers: AnyDict;
}    

window.scanItemHandlers = {
    folder: {
        getText: function (item) {
            return item.path;
        },
        schedule: {
            getValue: function (item) {
                let isCont = item.monitorContinous;
                let isStartup = item.monitorStartup;
                let isOneTime = (item.tag && item.tag.oneTime);
                if (isStartup && isCont)
                    return T_BOTH;
                else
                if (isStartup)
                    return T_STARTUP;
                else
                if (isOneTime)
                    return T_ONETIME;
                else
                if (isCont)
                    return T_CONT;
                else
                    return T_MANUAL;
            },
            setValue: function (item, newValue) {
                let isCont = false;
                let isStartup = false;
                let isOneTime = false;
                if (newValue == T_ONETIME) {
                    isOneTime = true;
                } else if (newValue == T_STARTUP) {
                    isStartup = true;
                } else if (newValue == T_CONT) {
                    isCont = true;
                } else if (newValue == T_BOTH) {
                    isStartup = true;
                    isCont = true;
                }
                item.monitorContinous = isCont;
                item.monitorStartup = isStartup;
                if (isOneTime)
                    item.tag = {oneTime: true};
                else
                    item.tag = undefined;
            },
            getValueList: function () {
                return T_ONETIME + ',' + T_MANUAL + ',' + T_STARTUP + ',' + T_CONT + ',' + T_BOTH;
            }
        }
    },
    device: {
        getText: function (item) {
            return item.path;
        },
        configurable: true,
        onChecked: function (item, checked) {
            let device = item.tag;
            mediaSyncDevices.changeLibraryScanSettings(device, {
                scanToLib: checked
            });
        },
        getMediaType: function (item) {
            let device = item.tag;
            let sett = mediaSyncDevices.getCustomSettings(device);
            return sett.scan_mediaType;
        },
        setMediaType: function (item, mediaType) {
            let device = item.tag;
            let sett = mediaSyncDevices.getCustomSettings(device);
            sett.scan_mediaType = mediaType;
            mediaSyncDevices.setCustomSettings(device, sett);
        },
        schedule: {
            getValue: function (item) {
                let device = item.tag;
                let sett = mediaSyncDevices.getCustomSettings(device);
                let focIdx = 0;
                let ints = mediaSyncHandlers[device.handlerID]._scan_intervals();
                for (let i = 0; i < ints.length; i++) {
                    if (ints[i] == sett.scan_interval_ms) {
                        focIdx = i;
                        break;
                    }
                }
                let list = mediaSyncHandlers[device.handlerID]._scan_interval_names();
                return getValueAtIndex(list, focIdx);
            },
            setValue: function (item, newValue) {
                let device = item.tag;
                let sett = mediaSyncDevices.getCustomSettings(device);
                let scan_interval = 0;
                let list = mediaSyncHandlers[device.handlerID]._scan_interval_names();
                fastForEach(list, function (val, i) {
                    if (val == newValue) {
                        let ints = mediaSyncHandlers[device.handlerID]._scan_intervals();
                        scan_interval = ints[i];
                    }
                });
                sett.scan_interval_ms = scan_interval;
                mediaSyncDevices.setCustomSettings(device, sett);
            },
            getValueList: function (item) {
                let device = item.tag;
                let list = mediaSyncHandlers[device.handlerID]._scan_interval_names();
                let valueList = '';
                fastForEach(list, function (s) {
                    if (valueList != '')
                        valueList = valueList + ',';
                    valueList = valueList + s;
                });
                return valueList;
            }
        }
    },
    serverContainer: {
        getText: function (item) {
            return item.path;
        },
        getMediaType: function (item) {
            let container = item.tag;
            return container.trackType;
        },
        setMediaType: function (item, mediaType) {
            let container = item.tag;
            container.trackType = mediaType;
        },
        schedule: {
            getValue: function (item) {
                return T_MANUAL;
            },
            setValue: function (item, newValue) {
                //TODO
            },
            getValueList: function () {
                return T_MANUAL;
            }
        }
    }
};

let getHandlerID = function (folder) {
    if (folder.tag && folder.tag.objectType)
        return folder.tag.objectType;
    else
        return 'folder';
};


class MonitoredFoldersView extends ListView {
    private _readOnlyFolders: boolean;
    private _folderClickEvent: any;
    private _folderChangedEvent: (folder) => void;
    getFolderMediaType: (item) => string;
    deleteItems: () => void;
    fieldDefs: AnyDict;
    _mediaTypeWidth: AnyDict;
    private __unlisteners: any[];
    private _lastMouseUp: number;
    private _tmStartEdit: number;
    private _lastFocusedItem: any;

    initialize(rootelem, params) {
        super.initialize(rootelem, params);
        let _this = this;
        this._readOnlyFolders = false;
        this._folderClickEvent = undefined;
        this._folderChangedEvent = undefined;
        this._showHeader = true;

        for (let col in this.fieldDefs) {
            this.fieldDefs[col].columnType = col;
        }

        this.deleteItems = () => {
            if (_this.dataSource.itemsSelected > 1) {
                _this.dataSource.deleteSelected();
            } else
            if (_this.dataSource && (_this.dataSource.focusedIndex >= 0)) {
                _this.deleteItem(_this.dataSource.focusedIndex);
                //_this.dataSource.deleteSelected();
            }
        };

        this.contextMenu = new Menu([{
            action: {
                title: _('Remove selected folder(s)'),
                enabled: true,
                execute: this.deleteItems,
            }
        }], {
            parent: _this.container
        });



        this.getFolderMediaType = function (item) {

            let handler = scanItemHandlers[getHandlerID(item)];
            if (handler.setMediaType)
                item.folderMediaType = handler.getMediaType(item);

            if (item.folderMediaType === -1) {
                return AutoDetectText;
            }
            return app.utils.getTypeText(item.folderMediaType);
        };

        this.localListen(this.viewport, 'mouseup', (e) => {
            if (e.button == 3 || e.button == 4)
                return; // let the back/forward buttons bubble (#16406)
          
            if ((e.button == 0) && !e.ctrlKey && !e.shiftKey && !this.inEdit) { // left button
                let tm = Date.now() - this._lastMouseUp;
                let item = this.focusedItem;                
                if (item && this._lastMouseUp && (/*(tm > 500) && */ (tm < 3000))) { // second mouse click in less than 3 seconds starts editing                                        
                    if (item && window.uitools.getCanEdit()) {
                        if (getHandlerID(item) == 'folder' && this._lastFocusedItem && (this._lastFocusedItem.path == item.path))
                            this.editStart();
                    }                
                }
                this._lastMouseUp = Date.now();
                this._lastFocusedItem = item;
            }
        });
    }

    handle_keyup(e) {
        let div;
        switch (friendlyKeyName(e)) {
        case 'Delete':
            this.deleteItems();
            break;
        case 'Space':
            div = this.getDiv(this.focusedIndex);
            if (div)
                div.check.click();
            break;            
        }        
        super.handle_keyup(e);
    }

    deleteItem(index) {
        let item = getValueAtIndex(this.dataSource, index);
        this.raiseEvent('itemdelete', {
            item: item
        }, true, true);
        this.dataSource.delete(index);
        this.dataSource.focusedIndex = -1;
    }

    cleanUp() {

        if (this.__unlisteners) {
            forEach(this.__unlisteners, function (unlistenFunc) {
                unlistenFunc();
            });
            this.__unlisteners = undefined;
        }

        super.cleanUp();
    }

    _setTypeColumnWidth(el: HTMLElement, longestString?:string) {
        if (!longestString) {
            longestString = AutoDetectText;
            let s = _('Classical Music');
            if (s.length > longestString.length)
                longestString = s;
        }
        this._mediaTypeWidth = this._mediaTypeWidth || {};
        if (!this._mediaTypeWidth[longestString]) {
            let mtag = document.createElement('div');
            mtag.style.display = 'inline-block';
            mtag.style.position = 'absolute';
            mtag.style.top = '-1000px';
            mtag.style.left = '-1000px';
            let cs = getComputedStyle(this.container, null);
            mtag.style.font = cs.getPropertyValue('font');
            this.container.appendChild(mtag);
            mtag.innerHTML = longestString;
            this._mediaTypeWidth[longestString] = getFullWidth(mtag, {
                rounded: true
            });
        }
        el.style.minWidth = this._mediaTypeWidth[longestString];
    }

    setUpHeader(header) {
        super.setUpHeader(header);
        let _this = this;

        // -------- create header items ---------
        // create row container
        let div = document.createElement('div');
        div.classList.add('flex');
        div.classList.add('row');
        div.classList.add('lvItem');
        div.classList.add('verticalCenter');
        _this.container.appendChild(div);

        // create folder text element
        let lbl = document.createElement('div');
        lbl.classList.add('textEllipsis');
        lbl.style.flexGrow = '1';
        lbl.style.flexShrink = '1';
        div.appendChild(lbl);
        lbl.textContent = _('Location');

        // get scan type text
        let type = document.createElement('div') as CustomElement;
        type.classList.add('flex');
        type.classList.add('row');

        type.lbl = document.createElement('label');
        _this._setTypeColumnWidth(type.lbl, T_BOTH);
        type.appendChild(type.lbl);
        type.icon = document.createElement('div');
        type.icon.classList.add('icon');
        type.appendChild(type.icon);
        type.lbl.innerText = _('Schedule');
        div.appendChild(type);

        // get media type
        let mediatype = document.createElement('div')  as CustomElement;
        mediatype.classList.add('flex');
        mediatype.classList.add('row');

        mediatype.lbl = document.createElement('label');
        _this._setTypeColumnWidth(mediatype.lbl);
        mediatype.appendChild(mediatype.lbl);
        // dummy header icons here to take the space of the icons of individual rows bellow:
        let dummyDeleteIcon = document.createElement('div');
        dummyDeleteIcon.classList.add('lvInlineIcon');        
        mediatype.appendChild(dummyDeleteIcon);
        let dummyArrowIcon = document.createElement('div');
        dummyArrowIcon.classList.add('icon');
        mediatype.appendChild(dummyArrowIcon);
        mediatype.lbl.innerText = _('Media Type');
        div.appendChild(mediatype);
    }

    setUpDiv(div) {
        let _this = this;

        let _listen = function (object, event, func, capture?:boolean) {
            _this.__unlisteners = _this.__unlisteners || [];
            app.listen(object, event, func, capture);
            _this.__unlisteners.push(function () {
                app.unlisten(object, event, func, capture);
            });
        };

        div.innerHTML = '';

        // create row container
        div.classList.add('flex');
        div.classList.add('row');        
        div.classList.add('lvItem');
        div.classList.add('verticalCenter');

        // create checkbox
        if (!_this._readOnlyFolders) {
            let check = document.createElement('div');
            check.setAttribute('data-control-class', 'Checkbox');
            check.classList.add('vSeparatorTiny');
            div.check = check;
            div.appendChild(check);
            _listen(check, 'click', function (e) {
                e.stopPropagation();
                _this._dataSource.modifyAsync(function () {
                    if (check.controlClass)
                        _this._dataSource.setChecked(div.itemIndex, (check.controlClass as Checkbox).checked);
                });
                let handler = scanItemHandlers[getHandlerID(div._folder)];
                if (handler.onChecked && check.controlClass)
                    handler.onChecked(div._folder, (check.controlClass as Checkbox).checked);
            });
            _listen(check, 'mouseup', function (e) {
                e.stopPropagation(); // #20954: Scan dialog: selection causes paths to be edited
            });           
        }

        div.icon = document.createElement('div');
        div.icon.classList.add('icon');
        div.appendChild(div.icon);

        // create folder text element
        let lbl = document.createElement('label');
        lbl.classList.add('textEllipsis');
        lbl.style.flexGrow = '1';
        lbl.style.flexShrink = '1';
        div.appendChild(lbl);
        div.lbl = lbl;
        templates.addEllipsisTooltip(div.lbl, div);

        // get schedule text
        let type = document.createElement('div') as CustomElement;
        type.classList.add('flex');
        type.classList.add('row');

        type.lbl = document.createElement('label');
        _this._setTypeColumnWidth(type.lbl, T_BOTH);
        type.appendChild(type.lbl);
        type.icon = document.createElement('div');
        type.icon.classList.add('icon');
        type.icon.classList.add('verticalCenter');
        type.appendChild(type.icon);
        loadIcon('downArrow', function (iconData) {
            type.icon.innerHTML = iconData;
        });

        div.type = type;
        div.appendChild(type);

        // get media type
        let mediatypeCont = document.createElement('div') as CustomElement;
        mediatypeCont.classList.add('flex');
        mediatypeCont.classList.add('row');

        let mediatype = document.createElement('div') as CustomElement;
        mediatype.classList.add('flex');
        mediatype.classList.add('row');

        mediatype.lbl = document.createElement('label');
        _this._setTypeColumnWidth(mediatype.lbl);
        mediatype.appendChild(mediatype.lbl);
        mediatype.icon = document.createElement('div');
        mediatype.icon.classList.add('icon');
        mediatype.icon.classList.add('verticalCenter');
        mediatype.appendChild(mediatype.icon);
        loadIcon('downArrow', function (iconData) {
            mediatype.icon.innerHTML = iconData;
        });

        mediatypeCont.appendChild(mediatype);
        div.appendChild(mediatypeCont);
        div.mediatype = mediatype;

        _listen(mediatype, 'click', function (e) {
            if (_this.dataSource.focusedIndex >= 0) {
                let itemClass = {
                    getValue: function (item) {
                        return _this.getFolderMediaType(item);
                    },
                    setValue: function (item, newValue) {
                        if (newValue === AutoDetectText)
                            item.folderMediaType = -1;
                        else
                            item.folderMediaType = app.utils.text2TrackType(newValue);

                        let handler = scanItemHandlers[getHandlerID(item)];
                        if (handler.setMediaType)
                            handler.setMediaType(item, item.folderMediaType);
                    },
                    beforePosition: function () {
                        itemClass.editline.controlClass.calcAutoWidth();
                        mediatype.style.minWidth = itemClass.editline.controlClass.edit.style.width;
                    },
                    editorParams: '{dbFunc:\'getStringList\', dbFuncParams: {category: \'tracktypewithauto\'}, readOnly: true, preload: true}',
                    listview: new window['Control'](mediatype),
                    editline: undefined // gets assigned in editors.js
                };
                itemClass.listview.editSave = function () {
                    window.editors.gridViewEditors.multiValueEdit.call(itemClass, 'save', mediatype, div._folder);
                    if (_this._folderChangedEvent)
                        _this._folderChangedEvent(div._folder);
                    //lvFolders.controlClass.invalidateAll();
                    mediatype.style.minWidth = '';
                };
                itemClass.listview.editCancel = function () {
                    window.editors.gridViewEditors.multiValueEdit.call(itemClass, 'cancel', mediatype, div._folder);
                    mediatype.style.minWidth = '';
                };
                itemClass.listview.setFocus = function () {
                    _this.updateMonitoredFolders();
                };

                window.editors.gridViewEditors.multiValueEdit.call(itemClass, 'edit', mediatype, div._folder);
                itemClass.editline.controlClass.openDropdown();
                e.stopPropagation();
            }
        });

        if (!_this._readOnlyFolders) {
            let delButton = document.createElement('div');
            mediatypeCont.appendChild(delButton);
            delButton.setAttribute('data-icon', 'delete');
            delButton.classList.add('lvInlineIcon');
            delButton.classList.add('visibleOnHover');
            delButton.classList.add('clickable');

            _this.localListen(delButton, 'mouseup', function (e) {
                if (_this.dataSource) {
                    _this.deleteItem(div.itemIndex);
                    e.stopPropagation();
                }
            }, true);
        }

        _listen(div, 'mouseenter', function () {
            div.setAttribute('data-hover', '1');
        });
        _listen(div, 'mouseleave', function () {
            if (div.hasAttribute('data-hover'))
                div.removeAttribute('data-hover');
        });
        _listen(div, 'click', function (e) {
            if (_this._folderClickEvent) {
                _this._folderClickEvent(div._folder.path);
            }
        });
        _listen(type, 'click', function (e) {
            let valueList = scanItemHandlers[getHandlerID(div._folder)].schedule.getValueList(div._folder);
            let itemClass = {
                getValue: function (item) {
                    return scanItemHandlers[getHandlerID(item)].schedule.getValue(item);
                },
                setValue: function (item, newValue) {
                    scanItemHandlers[getHandlerID(item)].schedule.setValue(item, newValue);
                },
                beforePosition: function () {
                    type.style.minWidth = itemClass.editline.controlClass.edit.style.width;
                },
                editorParams: '{items:"' + valueList + '", readOnly: true}',
                listview: new window['Control'](type),
                editline: undefined // gets assigned in editors.js
            };
            itemClass.listview.editSave = function () {
                window.editors.gridViewEditors.multiValueEdit.call(itemClass, 'save', type, div._folder);
                if (_this._folderChangedEvent)
                    _this._folderChangedEvent(div._folder);
                //lvFolders.controlClass.invalidateAll();
                type.style.minWidth = '';
            };
            itemClass.listview.editCancel = function () {
                window.editors.gridViewEditors.multiValueEdit.call(itemClass, 'cancel', type, div._folder);
                type.style.minWidth = '';
            };
            itemClass.listview.setFocus = function () {
                _this.updateMonitoredFolders();
            };

            window.editors.gridViewEditors.multiValueEdit.call(itemClass, 'edit', type, div._folder);
            itemClass.editline.controlClass.openDropdown();
            e.stopPropagation();
        });

        initializeControls(div);

    }

    bindData(div, idx, folder) {
        let _this = this;

        div._folder = folder;

        let text = scanItemHandlers[getHandlerID(div._folder)].getText(div._folder);
        div.lbl.textContent = text;

        text = scanItemHandlers[getHandlerID(div._folder)].schedule.getValue(div._folder);
        div.type.lbl.innerText = text;

        text = _this.getFolderMediaType(div._folder);
        div.mediatype.lbl.innerText = text;

        if (div.iconName != div._folder.icon) {
            div.iconName = div._folder.icon;
            loadIcon(div._folder.icon, function (iconData) {
                div.icon.innerHTML = iconData;
            });
        }

        if (!_this._readOnlyFolders && div.check) {
            _this._dataSource.locked(function () {
                div.check.controlClass.checked = _this._dataSource.isChecked(idx);
            });
        }

        if (scanItemHandlers[getHandlerID(div._folder)].configurable) {
            if (!div.lbl.classList.contains('clickable'))
                div.lbl.classList.add('clickable');
        } else {
            if (div.lbl.classList.contains('clickable'))
                div.lbl.classList.remove('clickable');
        }

    }

    editStart() {
        let item = this.focusedItem;
        if (item) {
            requirejs('controls/editors');
            let div = this.getDiv(this.focusedIndex);
            if (!div)
                return;
            let cellDiv = div;
            let textPart = qe(div, '[data-id=firstLine]');
            if (!textPart)
                textPart = qe(div, '[data-id=firstLineText]');
            if (textPart)
                cellDiv = textPart;
            this.inEdit = {
                listview: this,
                editor: editors.gridViewEditors.textEdit,
                div: div,
                item: item,
                cellDiv: cellDiv,
                getValue: function (item) {
                    // getHandlerID(item) == 'folder'
                    return item.path;
                },
                setValue: function (item, value) {
                    item.path = value;                  
                    return true; // to not save (already saved by calling commitAsync above)
                },
            };
            this.inEdit.editor('edit', this.inEdit.cellDiv, this.inEdit.item);
        }
    }

    editSave() {
        if (this.inEdit) {
            this.inEdit.editor('save', this.inEdit.cellDiv, this.inEdit.item);
            this.inEdit.div.itemIndex = undefined; // force rebind 
            this.draw();
            this.inEdit = undefined;
        }
    }

    editCancel() {
        if (this.inEdit) {
            this.inEdit.editor('cancel', this.inEdit.cellDiv, this.inEdit.item);
            this.inEdit = undefined;
        }
    }

    updateMonitoredFolders() {
        this.invalidateAll();
    }

    refresh() {
        this.updateMonitoredFolders();
    }

    checkExchangeServer2Device(dataSource) {
        // for syncable media servers (MMS) we need to exchange the 'server' item to 'device':
        return new Promise((resolve) => {
            listForEach(dataSource, (item, idx) => {
                if (getHandlerID(item) == 'serverContainer' && mediaSyncHandlers['server']._isSyncableServer(item.tag)) {
                    mediaSyncDevices.getBy({
                        handler: 'server'
                    }).then((devices) => {
                        listForEach(devices, (device) => {
                            if (device.profile_id == mediaSyncHandlers['server']._getProfileIDForServer(item.tag)) {
                                item.tag = device; // exchange server -> device
                                mediaSyncDevices.changeLibraryScanSettings(device, {
                                    scanToLib: true
                                });
                            }
                        });
                    });
                }
            });
            resolve(dataSource);
        });
    }

    prepareDataSource(ds) {
        this.localPromise(this.checkExchangeServer2Device(ds)).then((value) => {
            this.dataSource = value;
            if (this.dataSource.count > 0) {
                this.setFocusedAndSelectedIndex(0); // #21299
                this.setFocus();
            }
        });
    }
    
    get readOnlyFolders () {
        return this._readOnlyFolders;
    }
    set readOnlyFolders (value) {
        if (this._readOnlyFolders != value) {
            this._readOnlyFolders = value;
            this.updateMonitoredFolders();
        }
    }
        
    set folderClickEvent (event) {
        if (this._folderClickEvent != event) {
            this._folderClickEvent = event;
        }
    }
        
    set folderChangedEvent (event) {
        if (this._folderChangedEvent != event) {
            this._folderChangedEvent = event;
        }
    }
    
}
registerClass(MonitoredFoldersView);
