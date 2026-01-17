registerFileImport('dndutils');

'use strict';

import Control from './controls/control';
import {DRAG_DATATYPE, DRAG_HEADERITEM} from './consts';


/**
@module Drag&Drop
*/

let _dropEffect = 'none';
let _isAllowed = -1;
let _allowCheckType = '';
let _dataType = null;
let _headerType = null;
let _droppingFiles = null;
let _dropSrcData = null;
let _dropTarget = null;
let _droppedFiles = null;

let _dropUserData = {};
let _customDragElement = undefined;

/**

Drag&Drop helpers

@class window.dnd
*/

// These methods are private! Do not use them directly !

function addPromisedTracks(list, itemHandler, finishhandler) {
    if (list.forEach) {        
        let tempList = app.utils.createTracklist(false /* do not set loaded flag */ );        
        let loader = function (idx) {
            if (idx == list.count) {
                finishhandler(tempList);
            } else {
                let item = null;
                list.locked(function () {
                    item = list.getValue(idx);
                });
                itemHandler(item).whenLoaded().then(function (l) {
                    tempList.addList(l);
                    loader(++idx);
                });
            }
        };
        loader(0);
    } else { // single object
        itemHandler(list).whenLoaded().then(function (l) {
            finishhandler(l);
        });
    }
}

function handleGroupLoad(list) {
    let outList = app.utils.createTracklist(false /* do not set loaded flag */ );
    addPromisedTracks(list, function (item) {
        return getHandlerList(item);
    }, function (tempList) {
        outList.addList(tempList); // loading finished. Copy to output list (and throw loaded promise).
        outList.notifyLoaded();
    });
    return outList;
}

function getHandlerList(list) {
    if (list.getTracklist) {
        return list.getTracklist();
    } else {
        if (list.objectType == 'stringlist') { // files dropped from system
            return app.filesystem.fileNamesToSongList(list);
        } else {
            let groups = false;
            let pinnedTrack;
            if (list.count) {
                list.locked(function () {
                    groups = list.getValue(0).getTracklist !== undefined;
                    if (list.count == 1 && (list.objectType != 'tracklist') && (list.getValue(0).objectType == 'track'))
                        pinnedTrack = list.getValue(0);
                });
            }
            if (pinnedTrack) {
                let tracklist = app.utils.createTracklist(true);
                tracklist.add(pinnedTrack);
                return tracklist;
            } else
            if (groups) {
                return handleGroupLoad(list);
            } else
                return list;
        }
    }
}

// add single track to player
function player_addTrack(list, dstIndex, clear, startPlayback) {
    app.player.addTracksAsync(list, {
        withClear: clear,
        saveHistory: true,
        position: dstIndex,
        startPlayback: startPlayback
    });
}

// player's allowed object types with handlers
function player_allowedTypes() {
    return ['track', 'playlistentry', 'playlist', 'album', 'servercontainer',
        'genre', 'artist', 'director', 'composer', 'conductor', 'lyricist', 'producer', 'actor', 'publisher', 'folder', 'dbfolder'];
}


function getAllowedTypes(datatype) {
    let allowed = null;
    switch (datatype) {
    case 'cover':
        allowed = ['cover'];
        break;
    case 'plugin':
        allowed = ['mmip'];
        break;
    case 'media':
    default:
        allowed = player_allowedTypes();
        break;
    }
    return allowed.map(function (x) {
        return x.toLowerCase();
    });
}

let FT_ALL = 0,
    FT_BASIC = 1,
    FT_INCL_PLST = 2,
    FT_INCL_PLG = 3;
let playlist_audioExts = null,
    playlist_videoExts = null,
    fileTypes_lists = [];

// get allowed file types for player
function player_allowedFileTypes(includePlaylists, includePlugins) {

    let prepareArray = function () {
        let ar = [];
        let addTypes = function (list) {
            list.locked(function () {
                for (let i = 0; i < list.count; i++) {
                    ar.push(list.getValue(i));
                }
            });
        };

        if (!playlist_audioExts) {
            playlist_audioExts = app.filesystem.getAudioFileTypes();
            playlist_videoExts = app.filesystem.getVideoFileTypes();
            playlist_audioExts.add('audio/mp3'); // some applications set type to audio/mpeg and some to audio/mp3
        }

        addTypes(playlist_audioExts);
        if (includePlaylists === undefined || includePlaylists) {
            ar.push('audio/x-mpegurl'); // media type of m3u file
            ar.push('application/x-mpegurl'); // media type of m3u8 file
            ar.push('audio/mpegurl'); // media type of m3u file
            ar.push('audio/scpls'); // media type of pls file
            ar.push('audio/cue'); // media type of CUE file (#18553)
        }
        addTypes(playlist_videoExts);
        if (includePlugins === undefined || includePlugins) {
            ar.push('application/x-zip-compressed');
            ar.push('mmip');
        }

        return ar;
    };

    let idx = FT_ALL;
    if (!includePlaylists && includePlugins)
        idx = FT_INCL_PLG;
    else if (includePlaylists && !includePlugins)
        idx = FT_INCL_PLST;
    else if (!includePlaylists && !includePlugins)
        idx = FT_BASIC;
    if (!fileTypes_lists[idx])
        fileTypes_lists[idx] = prepareArray();
    return fileTypes_lists[idx];
}

// get allowed cover file types
function cover_allowedFileTypes() {
    let ar = [];
    ar.push('image/jpeg');
    ar.push('image/bmp');
    ar.push('image/png');
    ar.push('image/gif');
    ar.push('image/webp');
    ar.push('bitmap'); // image copied from web page
    ar.push('text/uri-list');
    return ar;
}

// get allowed plugin file types
function plugin_allowedFileTypes() {
    let ar = [];
    ar.push('application/x-zip-compressed');
    ar.push('mmip');
    return ar;
}
    
// get allowed file types for specified data type (cover, plugin, media)
function getAllowedFiles(datatype) {
    let allowed = null;
    switch (datatype) {
    case 'cover':
        allowed = cover_allowedFileTypes();
        break;
    case 'plugin':
        allowed = plugin_allowedFileTypes();//player_allowedFileTypes(false, true);
        break;
    case 'media':
    default:
        allowed = player_allowedFileTypes(true, false);
        break;
    }
    return allowed.map(function (x) {
        return x.toLowerCase();
    });
}

declare global {
    interface Window {
        event_dragfinished: (e: NotifyEvent) => any;
    }
    interface DataTransfer {
        getUserData(id: string): string;
        setUserData(id: string, text: string): void;
    }
}

interface DND {
    // Public methods
    /**
    Drag&Drop finished, so reset all cached properties.
    
    @method finishedDragNDrop
    */
    finishedDragNDrop: () => void; 
    getCustomDragElement: (element: any, count: any) => any; 
    prepareDragEventMethods: (e: any) => void; 
    initializeDragEvent: (e: any) => void;
    /**
    Notify all controls D&D is finished.
    
    @method notifyDragFinished
    */
    notifyDragFinished: () => void;
    /**
    Get list of tracks from various drop objects.
    
    @method getTracklistAsync
    @param {list} List of objects from getDragObject
    @return {promise} Promise resolved when all tracks were loaded
    */
    getTracklistAsync: (list: any) => Promise<Tracklist>;
    /**
    Set drop mode. Can be 'copy', 'move' or 'link'.
    
    @method setDropMode
    @param {object} Drag&Drop event object
    @param {string} Drop mode
    */
    setDropMode: (e: any, dropMode: any) => void;
    /**
    Get drop mode. Can be 'copy', 'move' or 'link'.
    
    @method getDropMode
    @param {object} Drag&Drop event object
    @return {string}
    */
    getDropMode: (e: any) => any;
    /**
    Compare drop mode. Can be 'copy', 'move' or 'link'.
    
    @method isDropMode
    @param {object} Drag&Drop event object
    @param {array} List of accepted modes
    @return {bool}
    */
    isDropMode: (e: any, accepted: any) => boolean;
    /**
    Get drop data type.
    
    @method getDropDataType
    @param {object} Drag&Drop event object
    @return {string} Data type
    */
    getDropDataType: (e: any) => any;
    /**
    Get event is from D&D (true) or copy/paste (false).
    
    @method isDragEvent
    @param {object} Event object
    @return {boolean}
    */
    isDragEvent: (e: any) => e is DragEvent;
    /**
    Get user is moving header (reordering).
    
    @method headerMoving
    @param {object} Drag&Drop event object
    @return {bool} Is moving header
    */
    headerMoving: (e: any) => any;
    /**
    Highlight drop target control (set data-dropTarget attribute).
    
    @method highlightDropTarget
    @param {HTMLElement} control control to highlight
    */
    highlightDropTarget: (control: HTMLElement) => void;
    /**
    Get list of dropped files.
    
    @method getDroppedFiles
    @param {object} Drag&Drop event object
    @return {stringlist} result
    */
    getDroppedFiles: (e: NotifyEvent) => StringList;
    /**
    True when dropping files from system (not an HTML D&D)
    
    @method droppingFileNames
    @param {object} Drag&Drop event object
    @return {boolean} result
    */
    droppingFileNames: (e: NotifyEvent) => boolean;
    /**
    Is dropped objects of the data type (media, cover, plugin).
    
    @method isAllowedType
    @param {object} Drag&Drop event object
    @param {string} data type
    @return {boolean} result
    */
    isAllowedType: (e: NotifyEvent, datatype: string) => boolean;
    /**
    Get list of dropped objects in data type (media, cover, plugin).
    This result can be passed to getTracklistAsync to get list of tracks.
    
    @method getDragObject
    @param {object} Drag&Drop event object
    @param {string} data type
    @return {object} List of the object
    */
    getDragObject: (e: NotifyEvent, datatype?: string) => any;
    /**
    Returns true when source and drag over element is same.
    
    @method isSameControl
    @param {object} Drag&Drop event object
    @param {boolean} Source and drag over control element is same
    */
    isSameControl: (e: NotifyEvent) => boolean;
    /**
    Set correct drop element (in case current drop target is a empty area and we're forwarding D&D message to any control).
    
    @method setDropTargetControl
    @param {object} Drag&Drop event object
    @param {HTMLElement} Correct drop element
    */
    setDropTargetControl(e: NotifyEvent, ctrl: HTMLElement): void;
    /**
    Default drop handler for player.
    
    @method player_handleDrop
    @param {object} Drag&Drop event object
    @param {integer} Index where to drop tracks
    @param {boolean} Clear 'Playing' list before drop
    @param {boolean} Start playback when drop finished
    */
    player_handleDrop: (e: NotifyEvent, index: integer, clear: boolean, startPlayback: boolean) => void;
    /**
    Default drop handler for 'Playing' list views (with reorder support).
    
    @method listview_player_handleDrop
    @param {object} Drag&Drop event object
    @param {object} ListView instance
    */
    listview_player_handleDrop: (e: NotifyEvent, lv: any) => void;
    /**
    Default reordering handler for list views.
    
    @method listview_handleReordering(
    @param {object} Drag&Drop event object
    */
    listview_handleReordering: (e: NotifyEvent) => void;
    /**
    Helper method to get item handler (typically for items from mediaTree).
    
    @method getFocusedItemHandler(
    @param {object} Drag&Drop event object
    */
    getFocusedItemHandler: (e: NotifyEvent) => boolean;
    /**
    Helper method to redirect D&D events from one control to another (like caption text).
    
    @method redirectDnDHandling(
    @param {object} srcControl source control
    @param {object} dstControl destination control where to redirect D&D events
    */
    redirectDnDHandling: (srcControl: HTMLElement, dstControl: HTMLElement) => void; 
    handleDroppedCover: (e: NotifyEvent, dropCB: AnyCallback, div?: HTMLElement) => void; 
    makeImageDroppable: (div: HTMLElement, dropCB: AnyCallback) => void; 
    handleMoveToPlaylist: (srcControl: HTMLElement, tracks: Tracklist) => Promise<void>;
} 

let dnd = {

    // Public methods

    /**
Drag&Drop finished, so reset all cached properties.

@method finishedDragNDrop
*/

    finishedDragNDrop: function () {
        _dropEffect = 'none';
        _isAllowed = -1;
        _allowCheckType = '';
        _dataType = null;
        _headerType = null;
        _droppingFiles = null;
        _dropSrcData = null;
        _droppedFiles = null;
        _dropUserData = {};
        this.highlightDropTarget(null);
    },

    getCustomDragElement: function (element, count) {
        if (_customDragElement && element) {
            _customDragElement.innerHTML = '';
            let cln = element.cloneNode(true);
            cln.style.position = 'relative';
            cln.style.left = 0;
            cln.style.top = 0;
            _customDragElement.appendChild(cln);
            _customDragElement.style.minHeight = element.offsetHeight;

            if (count > 1) {
                let lbl = document.createElement('label');
                lbl.classList.add('fullWidth');
                lbl.innerText = count + ' ' + _('item(s)');
                _customDragElement.appendChild(lbl);
            }
        }
        return _customDragElement;
    },

    prepareDragEventMethods: function (e: DragEvent) {
        if (!e.dataTransfer.getUserData) {
            e.dataTransfer.getUserData = function (id) {
                return _dropUserData[id];
            };
        }
        if (!e.dataTransfer.setUserData) {
            e.dataTransfer.setUserData = function (id, text) {
                _dropUserData[id] = text;
            };
        }
    },

    initializeDragEvent: function (e) {
        if (e.dataTransfer.setUserData) return;
        _dropUserData = {};
        _customDragElement = document.createElement('div');
        _customDragElement.style.position = 'absolute';
        _customDragElement.style.left = '-500px';
        _customDragElement.style.top = '-1000px';
        document.body.appendChild(_customDragElement);
        dnd.prepareDragEventMethods(e);
    },

    /**
Notify all controls D&D is finished.

@method notifyDragFinished
*/
    notifyDragFinished: function () {
        if (_customDragElement) {
            _customDragElement.remove();
            _customDragElement = undefined;
        }
        let event = createNewCustomEvent('dragfinished', {
            detail: {
                bubbles: true,
                cancelable: false
            }
        });
        window.dispatchEvent(event);
        this.finishedDragNDrop();
    },

    /**
Get list of tracks from various drop objects.

@method getTracklistAsync
@param {list} List of objects from getDragObject
@return {promise} Promise resolved when all tracks were loaded
*/

    getTracklistAsync: function (list) {
        return new Promise(function (resolve, reject) {
            let func = function () {
                let outList = getHandlerList(list);
                outList.whenLoaded().then(function () {
                    resolve(outList);
                });
            };

            if (list) {
                if (list.whenLoaded) {
                    list.whenLoaded().then(function () {
                        func();
                    });
                } else {
                    func();
                }
            } else
                resolve(undefined);
        });
    },

    /**
Set drop mode. Can be 'copy', 'move' or 'link'. 

@method setDropMode
@param {object} Drag&Drop event object
@param {string} Drop mode
*/

    setDropMode: function (e, dropMode) {
        let newMode = dropMode;

        if (newMode == 'none') {
            newMode = 'move';
        }

        e.dataTransfer.dropEffect = newMode;

        // PETR: dropEffect is reset to 'none' in 'drop' event so we want to backup it for later usage
        _dropEffect = newMode;
    },

    /**
Get drop mode. Can be 'copy', 'move' or 'link'. 

@method getDropMode
@param {object} Drag&Drop event object
@return {string}
*/

    getDropMode: function (e) {
        if (this.isDragEvent(e)) {
            let mode = e.dataTransfer.dropEffect;
            if (mode == 'none') {
                mode = _dropEffect;
            }
            return mode;
        } else {
            if (e.params)
                return e.params.cut ? 'move' : 'copy';
            else
            if (e.cut == false)
                return 'copy';
            else
                return 'move';
        }
    },

    /**
Compare drop mode. Can be 'copy', 'move' or 'link'. 

@method isDropMode
@param {object} Drag&Drop event object
@param {array} List of accepted modes
@return {bool}
*/

    isDropMode: function (e, accepted) {
        return accepted.indexOf(this.getDropMode(e)) >= 0;
    },

    /**
Get drop data type. 

@method getDropDataType
@param {object} Drag&Drop event object
@return {string} Data type
*/

    getDropDataType: function (e) {
        if (this.isDragEvent(e)) {
            if (_dataType == null)
                _dataType = e.dataTransfer.getUserData(DRAG_DATATYPE);
            return _dataType;
        } else {
            return e.dataType;
        }
    },

    /**
Get event is from D&D (true) or copy/paste (false). 

@method isDragEvent
@param {object} Event object
@return {boolean}
*/

    isDragEvent: function (e) {
        return e.dataTransfer !== undefined;
    },

    /**
Get user is moving header (reordering).

@method headerMoving
@param {object} Drag&Drop event object
@return {bool} Is moving header
*/

    headerMoving: function (e) {
        if (this.isDragEvent(e)) {
            if (_headerType == null)
                _headerType = e.dataTransfer.getUserData(DRAG_HEADERITEM) == 'headeritem';
            return _headerType;
        } else {
            return false;
        }
    },

    /**
Highlight drop target control (set data-dropTarget attribute).

@method highlightDropTarget
@param {object} control control to highlight
*/
    highlightDropTarget: function (control) {
        if (_dropTarget !== control) {
            if (_dropTarget && _dropTarget.hasAttribute('data-dropTarget')) {
                _dropTarget.removeAttribute('data-dropTarget');
            }
            _dropTarget = control;
            if (_dropTarget) {
                _dropTarget.setAttribute('data-dropTarget', '1');
            }
        }
    },

    /**
Get list of dropped files.

@method getDroppedFiles
@param {object} Drag&Drop event object
@return {stringlist} result
*/

    getDroppedFiles: function (e) {
        if (_droppedFiles == null) {
            _droppedFiles = app.utils.getDroppedFiles();
            if (!_droppedFiles || !_droppedFiles.count)
                _droppedFiles = e.data || e.dataTransfer.items;
        }
        return _droppedFiles;
    },

    /**
True when dropping files from system (not an HTML D&D)

@method droppingFileNames
@param {object} Drag&Drop event object
@return {boolean} result
*/

    droppingFileNames: function (e) {
        if (_droppingFiles == null) {
            if (this.isDragEvent(e)) {
                if (e.dataTransfer.getUserData('_localDrop')) { // dropping single track within MM (not an external D&D)
                    _droppingFiles = false;
                } else {
                    _droppingFiles = ( /*!this.getDropDataType(e) &&*/ e.dataTransfer.files.length);

                    // chromium 64 does not fill 'files' array, but insert type 'Files' into 'types' array
                    if (!_droppingFiles && e.dataTransfer.types.length) {
                        _droppingFiles = (e.dataTransfer.types[0] === 'Files');
                    }

                    // When dragging image from web, files are empty and we need to check 
                    if (!_droppingFiles) {
                        for (let i = 0; i < e.dataTransfer.items.length; i++) {
                            if ((e.dataTransfer.items[i].type === 'text/uri-list') || (e.dataTransfer.items[i].kind === 'file')) {
                                _droppingFiles = 1;
                                break;
                            }
                        }
                    }

                    if (!_droppingFiles && e && e.dataTransfer) {
                        ODS('D&D unknown data ' + JSON.stringify(e.dataTransfer));
                    }
                }
            } else {
                _droppingFiles = (!this.getDropDataType(e) || (this.getDropDataType(e) == 'stringlist')) && (e.data.objectType === 'stringlist') && e.data.count;
            }
        }
        return _droppingFiles;
    },

    /**
Is dropped objects of the data type (media, cover, plugin).

@method isAllowedType
@param {object} Drag&Drop event object
@param {string} data type
@return {boolean} result
*/

    isAllowedType: function (e: NotifyEvent, datatype: string) {
        if ((_isAllowed == -1) || (_allowCheckType !== datatype)) {
            _allowCheckType = datatype;
            ODS('Drop looking for ' + datatype);
            if (this.droppingFileNames(e)) {
                ODS('Dropping files from external');
                _isAllowed = 0;
                let browseList = function (list) {
                    ODS('Check type '+datatype);
                    let allowed = getAllowedFiles(datatype);
                    ODS('Allowed are '+JSON.stringify(allowed));
                    let size = list.length || list.count;
                    for (let i = 0; i < size; i++) {
                        let item = null;
                        if (list.getValue)
                            item = list.getValue(i);
                        else
                            item = list[i];

                        if ((typeof item === 'string') && (app.utils.isAbsolutePath(item))) { // it's pure filename
                            let type = app.utils.getDragFileMIME(i);
                            if (type == '')
                                type = app.filesystem.getFileType(item);
                            item = {
                                type: type,
                                kind: 'file'
                            };
                        } else
                        if ((typeof item === 'string') && (allowed.indexOf(item.toLowerCase()) >= 0)) { // probably image from web page
                            item = {
                                type: item,
                                kind: 'file'
                            };
                        }
                        if (!item.type && (item.kind === 'file')) {
                            let type = '';
                            if ('dataTransfer' in e && e.dataTransfer.files && (e.dataTransfer.files.length > i))
                                type = app.filesystem.getFileType(e.dataTransfer.files[i].name);
                            else
                                type = app.utils.getDragFileMIME(i);

                            item = {
                                type: type,
                                kind: 'file'
                            };
                        }

                        ODS('D&D item #' + i + ' from ' + size + ' is ' + JSON.stringify(item));

                        if ((item.type !== undefined && allowed.indexOf(item.type.toLowerCase()) >= 0) || (item.type === undefined && allowed.indexOf(app.filesystem.getFileType(item).toLowerCase()) >= 0)) {
                            _isAllowed = 1;
                            break;
                        }
                    }
                };

                let list = this.getDroppedFiles(e);
                if (list.locked) {
                    list.locked(function () {
                        browseList(list);
                    });
                } else {
                    browseList(list);
                }
            } else {
                let supportedType = false;
                let dt = this.getDropDataType(e);
                if (dt)
                    supportedType = getAllowedTypes(datatype).indexOf(dt.toLowerCase()) >= 0;
                _isAllowed = supportedType ? 1 : 0;
            }
        }
        return _isAllowed == 1;
    },

    /**
Get list of dropped objects in data type (media, cover, plugin).
This result can be passed to getTracklistAsync to get list of tracks.

@method getDragObject
@param {object} Drag&Drop event object
@param {string} data type
@return {object} List of the object
*/

    getDragObject: function (e, datatype: string) {
        if (this.isDragEvent(e)) {
            if (this.droppingFileNames(e)) {
                let allowed = getAllowedFiles(datatype);
                let retList = newStringList(false);
                if (allowed) {
                    if (!e.dataTransfer.files.length) {
                        let total = 0;
                        for (let i = 0; i < e.dataTransfer.items.length; i++) {
                            if (e.dataTransfer.items[i].type === 'text/uri-list') {
                                total++;
                                e.dataTransfer.items[i].getAsString(function (str) {
                                    retList.add(str);
                                    if (retList.count === total)
                                        retList.notifyLoaded();
                                });
                            }
                        }
                    } else {
                        for (let i = 0; i < e.dataTransfer.files.length; i++) {
                            let item = e.dataTransfer.files[i];
                            let type = item.type;
                            if (!type)
                                type = app.filesystem.getFileType(item.name);

                            if (allowed.indexOf(type) >= 0)
                                retList.add(item.name);
                        }
                        if (!retList.count) {
                            let list = this.getDroppedFiles(e);
                            if (list) {
                                if (list.locked) {
                                    list.locked(() => {
                                        for (let i = 0; i < list.count; i++) {
                                            let item = list.getValue(i);
                                            let type = app.filesystem.getFileType(item);
                                            if (allowed.indexOf(type) >= 0)
                                                retList.add(item);
                                        }

                                    });
                                } else if (isArray(list)) {
                                    for (const item of list) {
                                        console.log(item);
                                        if (item.name) {
                                            let type = item.type;
                                            if (!type)
                                                type = app.filesystem.getFileType(item.name);
                                            if (allowed.indexOf(type) >= 0)
                                                retList.add(item.name);
                                        }
                                    }
                                }
                            }
                        }
                        retList.notifyLoaded();
                    }
                }
                return retList;
            } else {
                if (_dropSrcData === null) {
                    _dropSrcData = e.dataTransfer.srcObject();
                }
                return _dropSrcData;
            }
        } else {
            return e.data;
        }
    },

    /**
Returns true when source and drag over element is same.

@method isSameControl
@param {object} Drag&Drop event object
@param {boolean} Source and drag over control element is same
*/

    isSameControl: function (e) {
        if (this.isDragEvent(e)) {
            return e.dataTransfer.isSameControl();
        } else {
            return false;
        }
    },

    /**
Set correct drop element (in case current drop target is a empty area and we're forwarding D&D message to any control).

@method setDropTargetControl
@param {object} Drag&Drop event object
@param {HTMLElement} Correct drop element
*/

    setDropTargetControl(this: DND, e: NotifyEvent, ctrl) {
        if (this.isDragEvent(e)) {
            assert('setDropTargetControl' in e.dataTransfer, 'Drag and drop was not set up for this event!');
            e.dataTransfer.setDropTargetControl(ctrl);
        }
    },

    /**
Default drop handler for player.

@method player_handleDrop
@param {object} Drag&Drop event object
@param {integer} Index where to drop tracks
@param {boolean} Clear 'Playing' list before drop
@param {boolean} Start playback when drop finished
*/

    player_handleDrop: function (e: NotifyEvent, index: integer, clear: boolean, startPlayback: boolean) {
        _isAllowed = -1;
        if (dnd.isAllowedType(e, 'plugin')) {

            let browseList = function (list) {
                let size = list.length || list.count;
                let installPromises = [];
                for (let i = 0; i < size; i++) {
                    let item = null;
                    if (list.getValue)
                        item = list.getValue(i);
                    else
                        item = list[i];

                    if ((typeof item === 'string') && (app.utils.isAbsolutePath(item))) { // it's pure filename
                        installPromises.push(window.localPromise(app.installAddonAsync(item)).then(function (addon) {
                            if (addon) {
                                if (addon.reloadRequiredInstall) // e.g. skins and layouts don't need reload (they are loaded when switching to them)
                                    window.callReload = true;
                                if (addon.showRestartPrompt)
                                    window.callRestart = true;
                            }
                        }));
                    }
                }
                if(installPromises.length > 0) {
                    whenAll(installPromises).then(function () {
                        installPromises = undefined;
                        if (window.callRestart) {
                            messageDlg(_('Please restart MediaMonkey to finish the installation.'), 'Confirmation', ['btnRestart', 'btnCancel'], {
                                defaultButton: 'btnRestart'
                            }, function (result) {
                                if (result.btnID === 'btnRestart') {
                                    app.restart();
                                }
                            });
                        }
                        else if (window.callReload) {
                            doReload(true, false, true); // to reload scripts
                            window.hotkeys.assignShortcuts();
                        }
                    });
                }
            };

            let list = this.getDroppedFiles(e);
            if (list) {
                if (list.locked) {
                    list.locked(function () {
                        browseList(list);
                    });
                } else {
                    browseList(list);
                }
            }

        } else {
            let obj = this.getDragObject(e);
            if (obj) {
                if (obj.count == undefined && obj.getTracklist) {
                    // single object like 'playlist', 'folder'
                    let items = obj.getTracklist();
                    items.whenLoaded().then(function () {
                        player_addTrack(items, index, clear, startPlayback);
                    });
                } else {
                    // object list like 'artistlist'
                    this.getTracklistAsync(obj).then(function (items) {
                        player_addTrack(items, index, clear, startPlayback);
                    });
                }
            }
        }
    },

    /**
Default drop handler for 'Playing' list views (with reorder support).

@method listview_player_handleDrop
@param {object} Drag&Drop event object
@param {object} ListView instance
*/

    listview_player_handleDrop: function (e: NotifyEvent, lv) {
        if (this.isSameControl(e)) {
            this.listview_handleReordering(e);
        } else {
            this.player_handleDrop(e, lv.getDropIndex(e), false, false);
        }
        lv.cancelDrop();
    },

    /**
Default reordering handler for list views.

@method listview_handleReordering(
@param {object} Drag&Drop event object
*/

    listview_handleReordering: function (e: NotifyEvent) {
        let sourceControl = e.dataTransfer.getSourceControl();
        if (sourceControl && sourceControl.controlClass) {
            // @ts-ignore TEMPORARY
            sourceControl.controlClass.cancelDrop();
            // @ts-ignore TEMPORARY
            let newPos = sourceControl.controlClass.getDropIndex(e);
            if (newPos !== undefined) // @ts-ignore TEMPORARY
                sourceControl.controlClass.dropToPosition(newPos);
        }
    },


    /**
Helper method to get item handler (typically for items from mediaTree).

@method getFocusedItemHandler(
@param {object} Drag&Drop event object
*/

    getFocusedItemHandler: function (e: NotifyEvent) {

        let result = false;
        let nodeIndex = -1;
        if (e.clientX !== undefined && e.clientY !== undefined) {
            // D&D using mouse
            let totalPos = this.container.getBoundingClientRect();
            let offsetX = e.clientX - totalPos.left;
            let offsetY = e.clientY - totalPos.top;
            nodeIndex = this.getItemFromRelativePosition(offsetX, offsetY);
            if (nodeIndex < 1)
                nodeIndex = 0;
        } else {
            // pasting using Ctrl+V shortcut
            if (this.focusedNode)
                nodeIndex = this.focusedNode.globalIndex;
        }

        if (nodeIndex >= 0) {
            if (nodeIndex === this._lastDropNodeIndex) {
                result = this._lastDropNodeResult;
            } else {
                this.dataSource.locked(function () {
                    this._dropNode = this.dataSource.getFastObject(nodeIndex, this._dropNode);
                    if (this._dropNode) {
                        let handler = nodeHandlers[this._dropNode.handlerID];
                        if (handler && handler.canDrop) {
                            result = handler.canDrop(this._dropNode.dataSource, e);
                        }
                    }
                }.bind(this));
                this._lastDropNodeIndex = nodeIndex;
                this._lastDropNodeResult = result;
            }

            if (this._lastDropNodeIndex >= 0) {
                let div = this.getDiv(this._lastDropNodeIndex);
                window.dnd.highlightDropTarget(div);
            } else
                window.dnd.highlightDropTarget(null);
        } else {
            this._lastDropNodeIndex = -1;
            this._lastDropNodeResult = false;
            window.dnd.highlightDropTarget(null);
        }
        return result;
    },

    /**
Helper method to redirect D&D events from one control to another (like caption text).

@method redirectDnDHandling(
@param {object} srcControl source control
@param {object} dstControl destination control where to redirect D&D events
*/

    redirectDnDHandling: function (srcControl, dstControl) {
        if (srcControl.controlClass && dstControl.controlClass) {
            srcControl.controlClass.enableDragNDrop();
            srcControl.controlClass.getDropMode = function (e) {
                return dstControl.controlClass.getDropMode(e);
            };
            srcControl.controlClass.canDrop = function (e) {
                return dstControl.controlClass.canDrop(e);
            };
            srcControl.controlClass.drop = function (e) {
                return dstControl.controlClass.drop(e);
            };
        }
    },

    handleDroppedCover: function (e: NotifyEvent, dropCB, div) {
        if (dnd.droppingFileNames(e)) {
            let processItems = function (items) {
                items.locked(function () {
                    if (items.count > 0) {
                        let fn = items.getValue(0);
                        app.utils.resolveDropImage(fn).then(function (picturePath) {
                            if (dropCB) {
                                dropCB(picturePath, div);
                            }
                        });
                    }
                });
            };

            let items = dnd.getDragObject(e, 'cover');
            if (items.whenLoaded) {
                items.whenLoaded().then(function () {
                    processItems(items);
                });
            } else
                processItems(items);
        }
    },

    makeImageDroppable: function (div, dropCB) {
        // activate drag&drop or paste of images
        if (div.__isDraggableImage) return;

        div.__isDraggableImage = true;

        div.controlClass = div.controlClass || new Control(div);
        div.controlClass.enableDragNDrop();

        let cancelImageDrop = function () {
            div.classList.toggle('dropeffect', false);
        };

        div.controlClass.canDrop = function (e) {
            let allowed = dnd.isAllowedType(e, 'cover') && !dnd.isSameControl(e);
            if (allowed && e.dataTransfer) {
                let src = e.dataTransfer.getSourceControl();
                allowed = (!src || !div.contains(src));
            }
            //ODS('---' + div.controlClass.uniqueID + ', dndEventsRegistered=' + div.controlClass.dndEventsRegistered + ', allowed=' + allowed);
            return div.controlClass.dndEventsRegistered && allowed;
        };

        div.controlClass.drop = function (e) {
            dnd.handleDroppedCover(e, dropCB, div);
            cancelImageDrop();
        };
        div.controlClass.dragOver = function (e) {
            //ODS('---' + div.controlClass.uniqueID + ' drag over');
            div.classList.toggle('dropeffect', true);
        };
        div.controlClass.dragFinished = function (e) {
            cancelImageDrop();
        };
        div.controlClass.dragLeave = function (e) {
            if (!isInElement(e.clientX, e.clientY, div)) {
                //ODS('---' + div.controlClass.uniqueID + ' drag leave');
                cancelImageDrop();
            }
        };
    },

    handleMoveToPlaylist: function (srcControl, tracks) {

        let removeSelectedTracksFromSource = function (src) {
            return new Promise<void>((_resolve) => {
                if (src && src.controlClass) {
                    tracks.selectRange(0, tracks.count - 1, true);
                    let ds;
                    if (src.controlClass.playlist)
                        ds = src.controlClass.playlist;
                    else {
                        let view = src.controlClass.parentView;
                        if (view && view.viewNode.dataSource)
                            ds = view.viewNode.dataSource;
                    }
                    if (ds) {
                        ds.removeSelectedTracksAsync(tracks).then(() => {
                            _resolve();
                        });                   
                    } else {
                        _resolve();
                    }
                } else {
                    _resolve();
                }
            });
        };

        return new Promise<void>((resolve) => {
        
            // check source list (we can move track to playlist from another playlist only)
            if (srcControl && srcControl.controlClass) { // check any parent of the source list contain 'playlist' property
                let hasPlaylistParent = false;
                let ctrl = srcControl;
                while (ctrl) {
                    if (ctrl.controlClass && ctrl.controlClass.playlist) {
                        hasPlaylistParent = true;
                        break;
                    }
                    ctrl = ctrl.parentElement;
                }

                if (hasPlaylistParent && ctrl) {
                    removeSelectedTracksFromSource(ctrl).then(() => {
                        resolve();
                    });
                } else { // there are no parent control for playlist ... check current node
                    let srcCtrl = srcControl.controlClass;
                    if (srcCtrl && srcCtrl.parentView && srcCtrl.parentView.viewNode && srcCtrl.parentView.viewNode.handlerID === 'playlist') {
                        removeSelectedTracksFromSource(srcControl).then(() => {
                            resolve();
                        });
                    } else {
                        resolve();
                    }
                }
            } else {
                resolve();
            }
        });
    },

};

declare global {
    var dnd: DND;
}
// @ts-ignore
window.dnd = dnd;


