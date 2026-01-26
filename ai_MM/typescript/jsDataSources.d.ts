/**
 * A JS datasource implementation, with similar methods to native SharedLists.
 * Base class for wrapper, which wrapps JS array, so it can be used as dataSource of LV's.
 * controls/arrayDataSource.js
 */
declare class ArrayDataSource<T = any>{
	_lockUpdateCount: number;
	_focusedIndex: number;
	_items: Array<any>;
	_updateSuspendCount: number;
	_dontNotify: number;
	_isLoaded: boolean;
	_loadedEvents: any[];
	count: number;
	getSelectedTracklist: () => any;
	hasItemSelected: () => boolean;
	getCheckedList: () => ArrayDataSource<any>;
	selectRangeAsync: (fromIndex: any, toIndex: any, doSelect: any) => Promise<any>;
	getValueLink: (index: any) => any; //
	modifyAsync: (func: any) => Promise<any>;
	forEach: (func: any) => void;
	setSelected: (index: any, value: any) => void;
	isSelected: (index: any) => boolean;
	setChecked: (index: any, value: any) => void;
	isChecked: (index: any) => boolean;
	copySelectionAsync: (sourceList: any) => Promise<any>;
	moveSelectionTo: (newIndex: any) => void;
	focusedIndex: any;
	getValue: (index: any) => any;
	notifyLoaded: () => void;
	whenLoaded: (func: any) => Promise<any>;
	setAutoSort: (value: any) => void;
	sortCompare: Function;
	setAutoSortAsync: (value: any) => Promise<any>;
	customSort: (callback: any) => void;
	getGroupsCount: () => number;
	getOffsetGroup: () => any;
	getItemGroup: () => any;
	suspendAutoUpdates: () => void;
	resumeAutoUpdates: () => boolean;
	autoUpdatesSuspended: () => boolean;
	clearGroupsAsync: () => Promise<any>;
	prepareGroupsAsync: () => Promise<any>;
	restoreFocusedItem: (val: any) => void;
	constructor(sourceArray: ArrayLike<T>, params: any);
	initialize: (sourceArray: Array<T>, params: any) => void;
	beginUpdate();
	endUpdate();
	add: (item: any) => void;
	insert: (idx, item) => void;
	delete: (index) => void;
	remove: (obj) => void;
	addList: (list: SharedList<T>) => void;
	clear: () => void;
	sort();
	indexOf: (value: T) => number;
	indexOfCI: (value: string) => number;
	addEventListener: (event: string, func: Function) => void;
	removeEventListener: (event: string, func: Function) => void;
	isMixedStateAsync: () => Promise<{frstState: boolean, isMixed: boolean}>;
	getAllValues: (key: string) => Array<T>;
	callEvent: (event: string, a?, b?, c?, d?, e?) => void;
	locked: (func: Function) => void;
	getFastObject: (index: number, obj?: any) => T;
	clearSelection: () => void;
	getSelectedList: () => ArrayDataSource<T>
}