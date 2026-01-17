/*
    class function (\w*):
        $1: () =>
    
    class function (\w*)\((.*)\):
        $1: ($2) =>
*/

/**
 * Base for all native objects.
 */
declare interface IBase { }

/**
 Base class for shared objects

@class SharedBase
*/
declare interface SharedBase extends IBase {
    /**
    Call defined method with locked data so user can access them.

    @method locked
    @param {method} func Method to call
    */
    locked: (func: callback) => void;
    /**
    Gets class name of the object.

    @method getClassName
    @return {string}
    */
    getClassName: () => string;
    statusInfo: Promise<any>;
}

/**
 Common object class

@class SharedObject
@extends SharedBase
*/
declare interface SharedObject extends SharedBase {
    setMarked: (id: integer, value: boolean) => void;
    isMarked: (id: integer) => boolean;
    doCut: (data: any) => Promise<any>; // internal
    getPersistentJSON: () => string;
    /**
    Gets integer id of the object

    @property id
    @type {integer}
    */
    id: integer;
    /**
    Gets the object type as string

    @property objectType
    @type {string}
    */
    objectType: string;
    /**
    Gets the object title

    @property title
    @type {string}
    */
    title: string;
    /**
    Gets persistent id of the object

    @property persistentID
    @type {string}
    */
    persistentID: string;
    /**
    Gets the object as serialized JSON string.
    Or sets serialized JSON (to fill this object's metadata by the metadata included within the JSON)

    @property asJSON
    @type {string}
    */
    asJSON: string;
}

declare interface SharedProgressObject {}

/**
 Base class for objects reporting change of their state

@class SharedObservable
@extends SharedObject
*/
declare interface SharedObservable extends SharedObject {
    /**
    Call defined method with the item locked for modifications.

    @method modifyAsync
    @param {method} func Method to call
    @return {promise}
    */
    modifyAsync: (func: callback) => Promise<any>;
    toURIString: () => string;
    toString: () => string;
    /**
    Set to true after deletion so that 'change' event is called and item is removed from UI lists.

    @property deleted
    @type {boolean}
    */
    deleted: boolean;
    /**
    Lock object to update state. Events are not called when in update state.

    @method beginUpdate
    */
    beginUpdate: procedure;
    /**
    Unlock object from update state. {{#crossLink "SharedObservable/beginUpdate"}}beginUpdate{{/crossLink}} and endUpdate must be in pair.
    When endUpdate is called, {{#crossLink "SharedObservable/onChange"}}{{/crossLink}} event is called.

    @method endUpdate
    */
    endUpdate: procedure;
    /**
    Updates the object every X ms when called periodically. Useful e.g. when filling lists.
    Can be used only in the update lock! (i.e. between beginUpdate/endUpdate)

    @method checkUpdate
    */
    checkUpdate: (interval: integer) => void;
    dontNotify: boolean;
    /**
    Is source for status bar informations.

    @property isStatusBarSource
    @type {boolean}
    */
    isStatusBarSource: boolean;
    /**
    Whether this object can be listened (e.g. for 'change' event)

    @property isObservable
    */
    isObservable: boolean;
    /**
    Notifies that the object was changed (e.g. to force visual update etc.)

    @method notifyChanged
    */
    notifyChanged: (value?: any) => void;
}


/**
Base list class.

Lists have read/write locking implemented. Use locked() for a read lock and modifyAsync() for a write lock. Read locks are synchronous
and can be called whenever needed, but write locks are asynchronous and may not execute immediately. Any time you modify a list, you must
wrap the code inside a call to modifyAsync(). However, you only need to use locked() when you want to work directly with indexes, e.g. 
list.getFastObject(idx, obj) and list.indexOf(obj). In most cases, methods like list.forEach() and window.fastForEach() will cover your needs.

Note: You <u>are</u> allowed to modify a list's <u>contents</u> inside a read lock if you do not modify the list itself, e.g. changing
a track's title.


    list.locked(() => {
        var firstTrack = list.getValue(0);
    });

    list.modifyAsync(() => {
        list.setSelected(selectedIdx, true);
        list.remove(list.getValue(removeIdx));
        list.setChecked(checkedIdx, true);
    });

    // The following examples will cause an assertion error and crash MediaMonkey.
    var firstTrack = list.getValue(0); // outside of a read lock

    list.locked(() => {
        list.setSelected(0, true); // outside of a write lock
    });

For performance reasons, please consider using asynchronous methods whenever possible, instead of the synchronous versions.

@class SharedList
@extends SharedObservable
*/
declare interface SharedList<T = IBase> extends SharedObservable{
	// TODO: Find some way to declare events in a TypeScript way
    getGroupSort: () => string;
    getItemGroup: void;
    getOffsetGroup: void;
    getGroupsCount: integer;
    prepareGroupsAsync: void;
    clearGroupsAsync: void;
    setGroupDimension: (groupid: string, rowGroupDimension: integer, colGroupDimension: integer) => void;
    setGroupsDimension: (rowGroupDimension: integer, colGroupDimension: integer) => void;
    getGroupsSize: () => integer;
    getGroupDimension: () => integer;
    getGroupByID: (groupid: string) => any; //todo
    getGroupIdx: (groupid: string) => integer;
    setAllCollapsed: (newState: boolean) => void;
    setCollapsed: (groupid: string, newState: boolean) => void;
    disableAlbumTracksLimit: boolean;
    groupName: string;
    /**
    Setting new sorting rule for the list.

    @method setSortRule
    @param {string} rule Semicolon separated list of sorting rules
    @return {boolean}
    */
    setSortRule: (value: string) => boolean;
    setSelectionFromListAsync: (list: SharedList<SharedObservable>) => Promise<any>;
    assignProgress: (progress: SharedProgressObject) => void;
    restoreFocusedItem: (value: T) => void;
    autoSortString: string;
    autoSortDisabled: boolean;
    /**
    Total count of items in list.

    @property count
    @type integer
    */
    count: integer;
    /**
    Add new item to the list.

    @method add
    @param {object} data Object to be added in list
    @return {integer}
    */
    add: (data: T) => integer;
    /**
    Add list of items to the list.

    @method addList
    @param {SharedList} list List to be added
    */
    addList: (list: SharedList<T>) => void;
    /**
    Add list of items to the list and preserve flags from the source list.

    @method addList
    @param {SharedList} list List to be added
    */
    addListPreserveFlags: (list: SharedList<T>) => void;
    /**
    Add list of items to the list, but clears the old values.
    i.e. is the same as calling clear+addList

    @method useList
    @param {SharedList} list List to be used
    */
    useList: (list: SharedList<T>) => void;
    /**
    Compares two lists for the same content

    @method hasSameItems
    @param {SharedList} list List to be compared
    @return {Boolean}
    */
    hasSameItems: (list: SharedList<T>) => boolean;
    /**
    Inserts list of items to the list at specified position.

    @method insertList
    @param {integer} index Position
    @param {SharedList} list List to be added
    */
    insertList: (index: integer, list: SharedList<T>) => void;
    /**
    Delete item at specified index.

    @method delete
    @param {integer} index Index of a item to be removed
    */
    delete: (index: integer) => void;
    /**
    Delete item from list.

    @method remove
    @param {object} data Object to be removed from list
    @return {integer}
    */
    remove: (data: T) => integer;
    /**
    Delete item from list asynchronously.

    @method removeAsync
    @param {object} data Object to be removed from list
    @return {Promise}
    */
    removeAsync: (data: T) => Promise<integer>;
    /**
    Inserts a new item to a specified position in the list.

    @method insert
    @param {integer} position The desired position in the list
    @param {object} data Object to be added in list
    @return {integer}
    */
    insert: (position: integer, data: T) => integer;
    /**
    Clear list (remove all items).

    @method clear
    */
    clear: procedure;
    /**
    Gets index of a item in list.

    @method indexOf
    @param {object} data Object to be found
    @return {integer}
    */
    indexOf: (data: T) => integer;
    /**
    Gets copy of the list.

    @method getCopy
    @return {SharedList}
    */
    getCopy: () => SharedList<T>;
    /**
    Gets copy of the list, preserves flags (selection).

    @method getCopyPreserveFlags
    @return {SharedList}
    */
    getCopyPreserveFlags: () => SharedList<T>;
    /**
    Gets copy of the list with specified range indexes.

    @method getRange
    @param {integer} fromIndex Starting index
    @param {integer} toIndex Ending index
    @return {SharedList}
    */
    getRange: (fromIndex: integer, toIndex: integer) => SharedList<T>;
    /**
    Gets link to a object from specified index. List needs to be locked before use (see {{#crossLink "SharedBase/locked"}}{{/crossLink}}).

    @method getValueLink
    @param {integer} index Index of item
    @return {object}
    */
    getValueLink: (index: integer) => any; //todo
    /**
    Gets object from specified index. List needs to be locked before use (see {{#crossLink "SharedBase/locked"}}{{/crossLink}}).

    @method getValue
    @param {integer} index Index of item
    @return {object}
    */
    getValue: (index: integer) => T;
    /**
    Sets object at specified index in the list. List needs to be locked before use (see {{#crossLink "SharedBase/locked"}}{{/crossLink}}).

    @method setValue
    @param {integer} index Index where to be added
    @param {object} value Object to be added
    */
    setValue: (index: integer, value: T) => void;
    /**
    Index of focused item in the list.

    @property focusedIndex
    @type integer
    */
    focusedIndex: integer;
    /**
    Gets focused item in the list.

    @property focusedItem
    @type {object}
    */
    focusedItem: T;
    /**
    Gets item at specified index is selected.

    @method isSelected
    @param {integer} index Index of the item
    @return {boolean}
    */
    isSelected: (index: integer) => boolean;
    /**
    Sets selected flag to item in specified index.

    @method setSelected
    @param {integer} index Index of the item
    @param {boolean} value True when selected
    */
    setSelected: (index: integer, value: boolean) => void;
    /**
    Gets item at specified index is checked.

    @method isChecked
    @param {integer} index Index of the item
    @return {boolean}
    */
    isChecked: (index: integer) => boolean;
    /**
    Sets checked flag to item in specified index.

    @method setChecked
    @param {integer} index Index of the item
    @param {boolean} value True when checked
    */
    setChecked: (index: integer, value: boolean) => void;
    setLastChecked: (value: boolean) => void;
    /**
    Returns a list of all selected items.

    @method getSelectedList
    @return {SharedList}
    */
    getSelectedList: () => SharedList<T>;
    /**
    Removes selected items from the list

    @method deleteSelected
    */
    deleteSelected: () => integer;
    /**
    Clears selection.

    @method clearSelection
    */
    clearSelection: procedure;
    /**
    Returns empty list.

    @method getEmptyList
    @return {SharedList}
    */
    getEmptyList: () => SharedList<T>;
    /**
    Returns true, if something is selected in the list.

    @method hasItemsSelected
    @return {boolean}
    */
    hasItemSelected: () => boolean;
    /**
    Returns true, if all is selected in the list.

    @method hasAllSelected
    @return {boolean}
    */
    hasAllSelected: () => boolean;
    /**
    Returns a list of all checked items.

    @method getCheckedList
    @return {SharedList}
    */
    getCheckedList: () => SharedList<T>;
    /**
    Browse all items and send them one by one in defined callback. Note that the items for the callback method are prepared using
    {{#crossLink "SharedList/getFastAccess"}}{{/crossLink}}, i.e. the performance is good, but you should only use them in the callback method and don't preserve them for later use.
    @example
    
        list.forEach(function(item) {
          // Process the item
        })

    @method forEach
    @param {method} callback Callback to be called with each item
    */
    forEach: (cbk: callback) => void;
    /**
    Set all items to (un)checked state

    @method setAllChecked
    @param {boolean} state Check state
    */
    setAllChecked: (state: boolean) => void;
    /**
    Return true when any item is checked

    @method anyChecked
    @return {boolean}
    */
    anyChecked: () => boolean;
    /**
    Return true when all items are checked

    @method getAllChecked
    @return {boolean}
    */
    getAllChecked: () => boolean;
    /**
    Select items in range.

    @method selectRange
    @param {integer} fromIndex Start index
    @param {integer} toIndex End index
    @param {boolean} select Whether to select or unselect
    */
    selectRange: (fromIndex: integer, toIndex: integer, select: boolean) => void;
    /**
    Select items in range, asynchronously.

    @method selectRangeAsync
    @param {integer} fromIndex Start index
    @param {integer} toIndex End index
    @param {boolean} [select] Whether to select or unselect
    @param {boolean} [clearSelection] Whether to clear selection of the whole list before the operation
    @return {Promise}
    */
    selectRangeAsync: (fromIndex: integer, toIndex: integer, select?: boolean, clearSelection?: boolean) => void;
    /**
    Move selected items to new position.

    @method moveSelectionTo
    @param {integer} newIndex New index where to move selected items
    */
    moveSelectionTo: (newIndex: integer) => void;
    /**
    Gets fast access to item at specified index. Note that this call always returns the same JS object, just modifies the internals so that properties/methods work on different data.
    It means, that you shouldn't preserve this object for later use, because it would be modified and the result would be unexpected.

    @method getFastObject
    @param {integer} index Index of the item
    @param {object} object Object to pass
    @return {object}
    */
    getFastObject: (index: integer, obj: any) => T;
    isMixedStateAsync: () => any; //todo
    isLoaded: boolean;
    itemsSelected: integer;
    sort: procedure;
    customSort: (aComparer: (a, b) => number) => void;
    sortAsync: procedure;
    autoSort: boolean;
    /**
    Notifies list was loaded and whenLoaded promise can be fulfilled.

    @method notifyLoaded
    */
    notifyLoaded: procedure;
    /**
    Returns a promise which is called when loading is finished.
    Loading is finished by calling {{#crossLink "SharedList/notifyLoaded"}}{{/crossLink}} method.

    @method whenLoaded
    @return {promise}
    */
    whenLoaded: () => Promise<void>;
    /**
    Copies selection from one list to another. Returns a promise which is fulfilled with the index of the first selected item when it's all done.

    @method copySelectionAsync
    @param {SharedList} fromList Source list to copy selection from.
    @return {promise}
    */
    copySelectionAsync: (fromList: SharedList<T>) => Promise<void>;
    /**
    Call defined method with the list locked for modifications. It tries to perform the callback immediatelly, but in case there's already a write lock on the list,
    it performs the callback later.

    @method modifyAsync
    @param {method} func Method to call
    @return {promise}
    */
    modifyAsync: (func: callback) => Promise<void>;
    /**
    Merges this list with list in parameter and returns new merged list

    @method merge
    @param {SharedList} list to merge
    @param {string} merge method ('join' - input list is appended to this list, 'oddeven' - items are mixed, odds are from this list, evens are from the input list)
    @return {SharedList} new merged list
    */
    merge: (list: SharedList<T>, mergeMethod: string) => SharedList<T>;
    /**
    Asynchronous copy of JS objects to list items. As example check musicBrainz script.

    @method asyncFill
    @param {integer} total count of items to fill
    @param {method} callback to fill one item (with parameters: int, item)
    @return {promise}
    */
    asyncFill: (totalCount: integer, callback: (index: integer, item: T) => void) => Promise<void>;
    /**
    Get position of the item identified by persistent ID.

    @method indexOfPersistentIDAsync
    @param {string} persistent ID of item to locate
    @return {promise}
    */
    indexOfPersistentIDAsync: (persistentID: string) => Promise<integer>;
    isDuplicate: (itemCallback: (item: T) => boolean) => boolean;
    autoUpdateDisabled: boolean;
}

declare interface Tracklist extends SharedList {
	
}

declare interface StringList {
    indexOf: (value: string) => integer;
    indexOfCI: (value: string) => integer;
    add: (value: string) => integer;
    remove: (value: string) => void;
    insert: (position: integer, value: string) => integer;
    setValue: (index: integer, value: string) => void;
    text: string;
    commaText: string;
    separator: string;
    getCopy: () => StringList;
    getFirst: string;
    exists: (value: string) => boolean;
    existsCI: (value: string) => boolean;
    removeDuplicates: procedure;
    getSelectedIndexes: StringList;
    getAllValues: () => string[];
} 

// declare class 

// declare class ObservableObject {
// 	notifyChange();
// }

declare class App {
	listen <subject = any> (elem: subject, event: string, handler: (this: subject, payload: any) => any, idk?: boolean);
	unlisten(elem: any, event?: string, handler?: Function, idk?: boolean);
	setValue(key: string, value: any);
	getValue(key: string, defaultValue: any);
	inPartyMode: boolean;
	settings: Settings;
	filesystem: Filesystem;
	tests: any;
    utils: AppUtils;
	idle();
    currentSkin(): Skin;
    currentLayout(): Skin;
    inSafeMode(): boolean;
    debug?: boolean;
}

declare class AppUtils {
    logStackTrace: () => string;
    /**
    Returns pretty print local date time

    @method formatTimestamp
    @param {string} timestamp in UTC form 'YYYY-MM-DD HH:MM:SS'
    @return {string} pretty print local date time
    */
    formatTimestamp: (timestamp: string) => string;
    /**
    Converts dateTime to timestamp format 'YYYY-MM-DD HH:MM:SS'

    @method dateTime2Timestamp
    @param {number} dateTime
    @return {string} timestamp in UTC form 'YYYY-MM-DD HH:MM:SS'
    */
    dateTime2Timestamp: (val: number) => string;
    /**
    Converts timestamp format 'YYYY-MM-DD HH:MM:SS' to dateTime
    accepts also ISO 8601 form YYYY-MM-DDTHH:mm:ss.sssZ

    @method timestamp2DateTime
    @param {string} timestamp in UTC form 'YYYY-MM-DD HH:MM:SS'
    @return {number} dateTime
    */
    timestamp2DateTime: (val: string) => number;
    /**
    Converts integer date representation to string.

    @method myEncodeDate
    @param {integer} value Integer date value
    @return {string}
    */
    myEncodeDate: (val: integer) => string;
    myFormatDateTime: (val: integer) => string;
    multiString2VisualString: (s: string) => string;
    songTimeToStrEx: (time: integer) => String;
    songTimeToStr: (time: integer) => String;
    freqToStr: (i: integer) => String;
    stereoToStr: (i: integer) => String;
    boolToYesNo: (i: Boolean) => String;
    bitRateToStr: (BR: integer) => String;
    createUUID: () => string;
    dateTimeToStr: (dt: number) => String;
    getNormalizeText: (NormalizeTrack: number, NormalizeAlbum: number) => String;
    formatNormalization: (NormalizeValue: number) => string;
    getMaxPathLength: () => integer;
    modifyFilenamesExtAsync: (list: StringList, newExt: string) => Promise<void>;
    removeFilenameExtension: (path: String) => String;
    getFilename: (path: String) => String;
    getDirectory: (path: String) => String;
    getUNCPath(path: string) : Promise<string>;
    getTypeStringId: (i: integer) => String;
    getTypeText: (i: integer) => String;
    getCoverTypes: () => StringList;
    language2shortcut: (lang: String) => String;
    text2TrackType: (Text: String) => integer;
    visualString2MultiString: (s: String) => String;
    getMonitorInfoFromCoords: (...args: any) => any;
}

declare class Settings {
	setJSON(a, b); //todo
	getJSON(filter): any;
}

declare class Filesystem {
	
    /**
    Scan selected path for media files.

    @method scanForMedia
    @param {StringList} paths Paths to scan
    @param {SharedList} containers Server containers to scan
    @param {string} exts Extensions to scan (comma separated).
    @param {class} params Additional parameters
    */
    scanForMedia: (pathsToScan: StringList, containers: SharedList<ServerContainer>, exts: String, params: any) => Promise<void>;
    showScanLog(ImportedFiles, FailedFiles, UpdatedFiles, SkippedFiles: StringList);

    /**
     Scan selected path for media files.

    @method simpleScanForMedia
    @param {string} path Path to scan
    @return {Promise}
    */
    simpleScanForMedia: (path: string) => Promise<void>;

    /**
    Scan selected tracks for their new location.

    @method scanForMovedFiles
    @param {Tracklist} sl List of missing tracks
    */
    scanForMovedFiles: (sl: Tracklist, paths: StringList) => Promise<void>;

    /**
     Process located files and update them in database.

    @method processLocatedFiles
    @param {List} list List of located files
    */
    processLocatedFiles: ( list: SharedList<SharedObservable>) => Promise<void>;

    /**
    Gets list of all supported audio extensions.

    @method getAudioExtensions
    @return {StringList}
    */
    getAudioExtensions: () => StringList;
    /**
    Gets list of all supported video extensions.

    @method getVideoExtensions
    @return {StringList}
    */
    getVideoExtensions: () => StringList;
    /**
    Gets list of all supported playlist extensions.

    @method getPlaylistExtensions
    @return {StringList}
    */
    getPlaylistExtensions: () => StringList;
  
    getAudioExtensionsAsync: () => SharedList;
    getVideoExtensionsAsync: () => SharedList;
    getPlaylistExtensionsAsync: () => SharedList;

    getAudioFileTypes: () => StringList;
    getVideoFileTypes: () => StringList;
    getPlaylistFileTypes: () => StringList;

    getFileType: ( path: string) => string;

    getScanExtensions: () => StringList;
    setScanExtensions( list: StringList);

    /**
    Renames file.
    It's LEGACY, use renameFileAsync instead!

    @method renameFile
    */
    renameFile: (src, dst: string) => Boolean;
    /**
    Rename file.

    @method renameFileAsync
    @param {string} src Source filename
    @param {string} dst New filename
    @param {boolean} OverwritePrompt Overwrites with prompting
    @return {Promise} Promise is fulfilled when action is completed.
    */
    renameFileAsync: (src, dst: string, OverwritePrompt: boolean) => Promise<void>;

    /**
    Copy file.

    @method copyFileAsync
    @param {string} src Source filename
    @param {string} dst New filename
    @return {Promise} Promise is fulfilled when action is completed.
    */
    copyFileAsync: (src, dst: string) => Promise<void>;

    /**
    Copy files.

    @method copyFilesAsync
    @param {Tracklist} srcList Source file list
    @param {string} destFolder Destination folder
    @param {boolean} addToDB Tracks will be added to database
    @param {boolean} dontShowOverwritePrompt Prompt to overwrite won't be shown
    @param {boolean} dontShowErrors Error log won't be shown
    @return {Promise} Promise is fulfilled when action is completed.
    */
    copyFilesAsync: (srcList: Tracklist, destFolder: string, addToDB: boolean, dontShowOverwritePrompt: boolean, dontShowErrors: boolean) => Promise<void>;

    /**
    Move or copy list of media files.

    @method renameFiles
    @param {Tracklist} srcList Source file list
    @param {string} destFolder Destination folder or dest. filename
    @param {Object} [params] Object containing additional parameters. Possible properties are:<ul>
    <li>move {Boolean} - if true, move files, otherwise copy, default = true</li>
    <li>addDB {Boolean} - if true, adds SongListData to DB, if it is not here yet, default = false</li>
    <li>canRemoveEmptyFolders {Boolean} - if true, it removes empty folders after moving files from it, default = false</li>
    <li>changeFileName {Boolean} - if true, destFolder contains full path with new filename. Valid only for moving/copying one file.</li>
    </ul>
    @return {Promise} Promise is fulfilled when action is completed.
    */
    renameFiles: (srcList: Tracklist, destFolder: string, params?: {move?: boolean, addDB?: boolean, canRemoveEmptyFolders?: boolean, changeFileName?: boolean}) => Promise<void>;

    /**
    Deletes a file.
    It's LEGACY, use deleteFileAsync instead!

    @method deleteFile
    */
    deleteFile: (src: string) => Boolean;
    /**
    Delete file.

    @method deleteFileAsync
    @param {string} filename File to delete
    @return {Promise}
    */
    deleteFileAsync: (src: string) => Promise<void>;

    deleteFolder: (path: string) => void;

    /**
     Delete folder.

    @method deleteFolderAsync
    @param {string} path Folder to delete
    @param {Boolean} recycle To recycle bin
    @param {Boolean} onlyEmpty Only if the folder has no other non-media content
    @return {Promise}

    */
    deleteFolderAsync: (path: string, recycle?: boolean, onlyEmpty?: boolean) => Promise<void>;

    /**
     Copy/Move folder.
    Available parameters are:
    move (true/false)       - copy or move (default false)
    all (true/false)        - copy/move all data not just audio/video (default true)
    recursive (true/false)  - copy all subfolders (default true)
    db (true/false)         - it is database folder - like from Collection/Location node (default false)

    @method copyFolderAsync
    @param {string} path Folder to copy/move
    @param {string} destination Target folder where to copy/move
    @param {object} parameters Copy/Move parameters
    @return {Promise}

    */
    copyFolderAsync(path: string, destination: string, parameters?: {move?: boolean, all: boolean, recursive: boolean, db: boolean}) : Promise<void>;

    /**
     Returns true as first promise param (if directory exists).

    @method fileExistsAsync
    @param {string} path Path to the file.
    @return {Promise}
    */
    fileExistsAsync: ( path: string) => Promise<void>;

    /**
     Returns true, if directory exists.
    Note: It's LEGACY, was replaced by dirExistsAsync

    @method dirExists
    @param {string} path Path to the directory.
    @return {Boolean}
    */
    dirExists: ( path: string) => boolean;

    /**
     Returns true as first promise param (if directory exists).

    @method dirExistsAsync
    @param {string} path Path to the directory.
    @return {Promise}
    */
    dirExistsAsync: ( path: string) => Promise<void>;

    /**
     Returns free/total space in bytes

    @method getDiskSpaceAsync
    @param {string} path Path to the directory.
    @return {Promise}
    */
    getDiskSpaceAsync: ( path: string) => Promise<void>;
    // Undocumented, used for precompiledLess storing
    saveToFileAsync: (fileName: string, data: string, len: integer) => Promise<void>;

    /**
     Save text to file.

    @method saveTextToFileAsync
    @param {string} fileName full path to the file to save
    @param {string} text text to save
    @param {Object} [params] Object containing additional parameters. Possible properties are:<ul>
    <li>encoding {string} - encoding, 'UTF-16', 'UTF-8', 'ANSI' or 'base64', default = 'UTF-8'</li>
    <li>append {Boolean} - if true, appends text to the end of the file, if already exists, default = false</li>
    </ul>
    @return {Promise}
    */
    saveTextToFileAsync: (fileName: string, text: string, params?: {encoding?: string, append?: boolean}) => Promise<void>;
    /**
     Load text from file.

    @method loadTextFromFileAsync
    @param {string} fileName full path to the file to load
    @param {Object} [params] Object containing additional parameters. Possible properties are:<ul>
    <li>encoding {string} - encoding, 'UTF-16', 'ANSI' or 'UTF-8', default = 'UTF-8'</li>
    </ul>
    @return {Promise} promise resolved with loaded String
    */
    loadTextFromFileAsync: (fileName: string, params?: {encoding?: string}) => Promise<string>;

    loadSkinFile: (params: {file: string, callback?: ((request: any) => any) | null}) => any;
    /**
     Gets file content or a specified portion

    @method getFileContentAsync
    @param {string} fileName File path of the file
    @param {integer} from optional from position in bytes
    @param {integer} to option to position in bytes
    @return {Promise} promise with param fileBuffer (or error string in case of an error), call fileBuffer.getArrayBuffer() to get the binary data
    */
    getFileContentAsync (fileName: string, from: integer, to: integer): Promise<SourceBuffer|string>; // todo verify type
    /**
     Sets file content for a specified portion of data

    @method setFileContentAsync
    @param {FileBuffer} content buffer data to write
    @param {string} fileName File path of the file
    @param {integer} from optional from position in bytes (0 by default)
    @return {Promise}
    */
    setFileContentAsync(content: any, fileName: string, from: integer): Promise<void>;
    /**
     Gets file size in bytes

    @method getFileSizeAsync
    @param {string} fileName File path of the file
    @return {Promise} promise with param fileSize (or error string in case of an error)
    */
    getFileSizeAsync: (fileName: string) => Promise<void>;
    /**
     Gets file info like dateCreated, dateModified, dateAccessed, size as JSON
    date values are in the ISO format, see app.filesystem.timestamp2DateTime for the conversion
    
    @example
    <pre><code>
        var fileInfo = await app.filesystem.getFileInfoAsync(track.path);
    </code></pre>
    @method getFileInfoAsync
    @param {string} fileName File path of the file
    @return {Promise} promise with param fileInfo (JSON format)
    */
    getFileInfoAsync: (fileName: string) => Promise<void>;
    /**
     Sets file info like dateModified, readOnly
    date values are in the ISO format, see app.filesystem.timestamp2DateTime for the conversion
    <b>NOTE:</b> Introduced in 5.0.4

    @example
    <pre><code>
        app.filesystem.setFileInfoAsync( 'C:\\Temp\\file.txt', '{"dateModified":"2020-02-02 22:22:22", "readOnly":"true"}');
    </code></pre>

    @method setFileInfoAsync
    @param {string} fileName File path of the file
    @param {string} params Params to be set in JSON format
    @return {Promise} result
    */
    setFileInfoAsync: (fileName, params: string) => Promise<void>;
    getCurrentLessMD5Async: () => Promise<void>;

    /**
     Gets list of drives (instances of {{#crossLink "SharedDrive"}}SharedDrive{{/crossLink}}) <br>
    <b>NOTE:</b> In version 5.0.3 and lower it returns {Promise}, in 5.0.4+ it is the list directly

    @method getDriveList
    @return {SharedList}
    */
    getDriveList: () => SharedList<SharedDrive>;
    /**
     Gets list of inserted medias (e.g. inserted CDs) as instances of {{#crossLink "SharedDrive"}}SharedDrive{{/crossLink}}

    @method getInsertedMediaList
    @return {SharedList}
    */
    getInsertedMediaList: () => SharedList<SharedDrive>;
    /**
     Gets list folders for given path as {{#crossLink "StringList"}}StringList{{/crossLink}}

    @method getFoldersList
    @param {string} path
    @return {Promise}
    */
    getFoldersList: (path: string) => Promise<void>;
    /**
     Gets list of network resources (list of {{#crossLink "SharedFolder"}}SharedFolder{{/crossLink}}  instances)

    @method getNetworkResourceList
    @return {SharedList}
    */
    getNetworkResourceList: () => SharedList<NetworkResource>;
    /**
     Returns the resource as {{#crossLink "SharedFolder"}}SharedFolder{{/crossLink}} object

    @method networkResourceFromPath
    @param {string} path Path of the resource to get
    @return {SharedFolder}
    */
    networkResourceFromPath: (path: string) => NetworkResource;
    /**
     Adds network resource

    @method addNetworkResourceAsync
    @param {string} path Path of the resource to add
    @return {Promise}
    */
    addNetworkResourceAsync: (path: string) => Promise<void>;
    /**
     Removes network resource

    @method deleteNetworkResourceAsync
    @param {SharedFolder} Resource to delete
    @return {Promise}
    */
    deleteNetworkResourceAsync: (res: SharedFolder) => Promise<void>;
    getFolderOfPathAsync: (path: string) => Promise<void>;
    /**
     Returns path separator for the current OS

    @method getPathSeparator
    @return {String}
    */
    getPathSeparator: () => string;
    /**
     Gets last scanned folders

    @method getLastScannedFolders
    @return {StringList}
    */
    getLastScannedFolders: () => StringList;
    /**
     Sets last scanned folders

    @method setLastScannedFolders
    @param {StringList} paths
    */
    setLastScannedFolders: (paths: StringList) => void;
    /**
     Gets monitored folders

    @method getMonitoredFolders
    @return {SharedList}
    */
    getMonitoredFolders: () => SharedList<SharedFolder>;
    /**
     Starts auto scanner

    @method startAutoScanner
    */
    startAutoScanner: procedure;
    /**
     Gets system folder for music

    @method getSystemFolderMyMusic
    @return {String}
    */
    getSystemFolderMyMusic: () => string;
    /**
     Gets system folder for video

    @method getSystemFolderMyVideo
    @return {String}
    */
    getSystemFolderMyVideo: () => string;

    getPluginsFolder: (global : boolean) => string;
    /**
     Gets application path to executable

    @method getApplicationPath
    @return {String}
    */
    getApplicationPath: () => string;
    getScriptsPath: () => string;
    /**
     Gets MediaMonkey data folder

    @method getDataFolder
    @return {String}
    */
    getDataFolder: () => string;
    /**
     Gets user personal folder

    @method getDataFolder
    @return {String}
    */
    getUserFolder: () => string;
    getIconsFolder: () => string;
    getFileFromString: (fullname: string) => string;
    /**
     Gets tracklist from filenames list

    @method getDataFolder
    @param {StringList} filenames
    @return {Tracklist}
    */
    fileNamesToSongList: (list: StringList) => Tracklist;
    /**
     Returns whether this file type (extensions) is associated with MediaMonkey

    @method isKnownFiletype
    @param {String} extension
    @return {Boolean}
    */
    isKnownFiletype: (ext: string) => boolean;
    /**
     Gets list of track's folders.

    @method getDBFolderListAsync
    @param {integer} parentID Parent Folder ID
    @param {integer} collectionID Collection ID
    @return {DBFolderList}
    */
    getDBFolderListAsync: (parentID: integer, collectionID: integer) => DBFolderList;

    /**
     Returns the folder as {{#crossLink "SharedFolder"}}SharedFolder{{/crossLink}} object

    @method getFolderFromString
    @param {string} path Path of the folder to get
    @param {boolean} isTemporary (optional)
    @return {SharedFolder}
    */
    getFolderFromString: (path: string, isTemporary?: boolean) => SharedFolder;
    /**
     Creates folder and returns as {SharedFolder} in Promise fullfillment

    @method createFolderAsync
    @param {string} path Path of the folder to create
    @return {Promise}
    */
    createFolderAsync: (path: string) => Promise<void>;
    /**
     Modifies string so that can be used as filename. i.e. Removes illegal filename chars.

    @method correctFilename
    @param {string} path Path to convert
    @return {string} corrected path version
    */
    correctFilename: (filename: string) => string;
    /**
     On Windows returns the short path version used by programs that require the earlier 8.3 file naming convention <br>
    <b>NOTE:</b> Introduced in 5.0.4

    @method toShortPath
    @param {string} path Path to convert
    @return {string} short path version
    */
    toShortPath: (filename: string) => string;
}

declare interface BackgroundTasks extends SharedBase {
	
    /**
    OnChange event is called every time something is changed in any background task.</br>
    Available operations:</br>
      'unregistered' - task was removed</br>
      'registered'   - task is just started</br>
      'enabled'      - task is enabled</br>
      'disabled'     - task is disabled</br>
      'textchanged'  - text of the progress was changed</br>
      'progresschanged' - percent of progress was changed</br>
      'descriptionchanged' - description of the progress was changed


    @property onChanged
    @param {string} op Operation performed to task.
    @param {BackgroundTask} task task related do operation. When operation is 'unregistered', ID is returned instead of task
	*/
}

declare interface Skin {
    isCurrent: boolean;
    title: string;
    id: string;
    description: string;
    version: string;
    author: string;
    icon: string;
    path: string;
    skinOptions: string;
}

interface Window {
	app: App;
}

declare var app: App;

declare function _(str: string) : string; // translator
declare function ODS(str: string);
declare function _alert(a, b?, c?, d?); // no regular way to define an infinite parameter function, apparently

// SharedWindow
// declare class SharedWindow {
declare var updateDevicePixelRatio: procedure;
declare var applyWindowStates: Function;
declare function applyWindowStates(name: string): void;
declare function setDock(pos: string, align: string): void;
declare function callDialogInit(): void;
declare function customMenuItemClick(itemID: integer, customData: integer): void;
declare function identifier(): integer;
declare var setMoveableColor: Function;
declare function notifyLoaded(): void;
/**
When using the COM method runJSCode(), the running code can call this method to return data to the calling application.

@param data Data to send to the calling COM application.

@example

     SLText = SDB.runJSCode("app.playlists.getByTitleAsync('Test Playlist').then(function(playlist) { if (!playlist) runJSCode_callback('Could not find playlist'); else playlist.getTracklist().whenLoaded().then(function (list) { runJSCode_callback(list.asJSON); }); });", True)
 */
declare function runJSCode_callback(data: string): void;
declare var getWindowMonitor: Function;
declare var getAsyncShowToken: Function;
declare var setMoveableArea: Function;
declare var executeCode: Function;
declare var executeFile: Function;
declare var activate: Function;
declare var createOwnWindow: Function;
declare var setBounds: Function;
declare var setSize: Function;
declare var setClientSize: Function;
declare var minimize: Function;
declare var maximize: Function;
declare var restore: Function;
declare var closeWindow: Function;
declare var hide: Function;
declare var show: Function;
declare var showModal: Function;
declare var include: Function;
declare var loadFile: Function;
declare var _: Function;
declare var callODS: Function;
declare var handleEmbeddedWindow: Function;
declare var setWindowState: Function;
declare var runCommand: Function;
declare var getValueInWindowContext: Function;
declare var setValue: Function;
declare var getValue: Function;
declare var notifyOnReady: Function;
declare var notifyOnClose: Function;
declare var showDevTools: Function;
declare var newStringList: Function;
declare var preventClose: Function;
declare var _alert: Function;
declare var messageDlg: Function;
declare var locked: Function;
declare var getClassName: Function;
declare var forceClose: boolean;
declare var isMainWindow: boolean;
declare var magnetToWindows: boolean;
declare var magnetToScreen: boolean;
declare var systemDevicePixelRatio: number;
declare var textZoomRatio: number;
declare var url: string;
declare var _window: object;
declare var thisWindow: object;
declare var headerClass: any; // todo
declare var inData: string;
declare var outData: string;
declare var isMenu: boolean;
declare var isModal: boolean;
declare var windowIsLoaded: boolean;
declare var title: string;
declare var posSaveName: string;
declare var resizeable: boolean;
declare var moveable: boolean;
declare var toolWindow: boolean;
declare var bordered: boolean;
declare var flat: boolean;
declare var atTop: boolean;
declare var atTopMost: boolean;
declare var dockPos: string;
declare var dockAlign: string;
declare var fadeTime: number;
declare var modalResult: number;
declare var opacity: number;
declare var active: boolean;
declare var maximized: boolean;
declare var minimized: boolean;
declare var canMinimize: boolean;
declare var canMaximize: boolean;
declare var visible: boolean;
declare var clientWidth: number;
declare var clientHeight: number;
declare var builtInMenu: boolean;
declare var menuJSON: string;
declare var showAsVideoPlayer: boolean;
declare var shape: string;
declare var shapeColor: number;
declare var addHeader: boolean;
declare var borderSize: number;
declare var reloadInProgress: boolean;
declare var inspectElementSupported: boolean;
declare var devToolsUrl: string;
declare var bounds: {
	windowRect: {
		left: number;
		top: number;
	};
	width: number;
	height: number;
};
declare var statusInfo: any;
declare var native: boolean
declare var doNotCheckLess: boolean;

declare var thisWindow: SharedWindow;

declare interface SharedFolder {} //todo
declare interface SharedDrive {} //todo

declare interface NetworkResource extends SharedFolder {
    getChildren: () => SharedList<NetworkResource>;
    getType: () => string;
}

declare interface DBFolderList {} // todo

declare interface ServerContainer {
    name: string;
    fullName: string;
    // todo
}