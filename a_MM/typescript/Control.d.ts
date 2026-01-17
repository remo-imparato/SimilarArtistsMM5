
declare class Button extends Control{}

declare class Control{
	selectionMode(selectionMode: any, arg1: boolean);
	localListen(elem: any, arg1: string, arg2: any);
	focusIn(container: HTMLElement, arg1: string, focusIn: any);
	focusRefresh(newState: any);
	setDragElementData(element: any, e: any);
	cleanUp();
	unregisterEventHandler(event: Event);
	cleanUpPromises();
	dataSourceUnlistenFuncts();
	cancelDataSourcePromises();
	cleanUpStatusBarSources();
	setStatus(e: any);
	formatStatus(data: any);
	sendStatus(msg: any);
	localPromise(arg0: any);
	getContextMenuItems(e: any);
	static $super: Control;
	initialize: Function;
	container: HTMLElement;
	dragStartHandler: any;
	setDefaults: () => void;
	disabledCounter: number;
	_disabled: boolean;
	_tabIndex: any;
	_hasSplitters: boolean;
	_dockable: boolean;
	_isDock: boolean;
	_controlTitle: string;
	helpContext: any;
	_localPromises: any[];
	_dataSourceListenFuncts: any[];
	disableStateStoring: boolean;
	resizable: any;
	hasSplitters: any;
	disabled: boolean;
	mergeParentContextMenu: any;
	closediv: HTMLDivElement;
	_mouseOutHandler: any;
	_mouseMoveHandler: any;
	getCloseButtonAction: any;
	setCloseButtonAction: any;
	resizediv: HTMLDivElement;
	statusParams: { visible: (e: any) => any; };
	uniqueID: any;
	canBeUsedAsSource: boolean;
	qChild: (id: any) => any;
	requestFrame: (callback: Function, callbackID?: string) => void;
	_frameIDs: any;
	_cleanUpCalled: any;
	requestFrameMM: (callback: Function, callbackID?: string) => void;
	_frameMMIDs: any;
	requestTimeout: (callback: Function, timeMS: number, callbackID?: string, useFirst?: boolean) => number;
	_timeoutIDs: any;
	requestIdle: (callback: Function, callbackID?: string, useFirst?: boolean) => number;
	_idleCallIDs: any;
	_updateDisabledAttribute: () => void;
	enableDragNDrop: () => void;
	dndEventsRegistered: any;
	dragging: boolean;
	dragEnterHandler: any;
	dragOverHandler: any;
	dragLeaveHandler: any;
	dropHandler: any;
	dragFinishedHandler: any;
	activatedHandler: any;
	findDNDHandler: (e: any) => any;
	enableTouch: () => void;
	focusEventsRegistered: any;
	touchEventsRegistered: any;
	touchStart: any;
	touchMove: any;
	touchEnd: any;
	longTouch: (e: any) => boolean;
	_isLongTouch: any;
	_touchDownTime: any;
	_canBeLongTouch: any;
	notifyControlFocus: () => void;
	focusHandler: (element: any, newState: any) => boolean;
	canFocus: () => boolean;
	canDrawFocus: () => boolean;
	dragFinished: (e: any) => void;
	dragEnter: (e: any) => void;
	canDrop: (e: any) => boolean
	dragOver: (e: any) => void;
	dragLeave: (e: any) => void;
	drop: (e: any) => void;
	getDropMode: (e: any) => string;
	getDragDataType: () => string;
	getDraggedObject: (e: any) => any;
	fileTransferPrepare: (element: any, e: any) => void;
	makeDraggable: (element: any, canBeDragged: any) => void;
	unregisterDragDrop: () => void;
	unregisterFocusEvents: () => void;
	unregisterTouchEvents: () => void;
	checkedCleanUp: () => void;
	addCleanFunc: (func: Function) => void;
	_cleanFuncs: any;
	_contextMenu: any;
	_dockMenuItems: any;
	_contextMenuHandler: any;
	_listeners: any;
	_captureListeners: any;
	raiseEvent: (eventName: string, details: any, isCancelable?: boolean, canBubble?: boolean, sender?: any) => boolean
	addControl: (controlClass: string, initParams: any) => any;
	getParentControl: (topParentCtrl: any) => Control;
	storeState: () => any;
	restoreState: (fromObject: any, isJustViewModeChange: any) => void;
	getPersistentStateRootKeyBase: () => any;
	parentView: any;
	getPersistentStateRootKey: () => string;
	getPersistentStateRootControl: () => HTMLElement;
	storePersistentStates: () => void;
	restorePersistentStates: () => void;
	registerStatusBarSource: (source: any) => void;
	_statusBarSources: any;
	_statusBarPromises: any;
	unregisterStatusBarSource: (source: any) => void;
	statusInfo: any;
	openView: (nodeDataSource: any, nodeHandlerID: any, clickedArea: any, newTab: any) => void;
	_notifyFiltered: (orig: any, filtered: any, phrase: any) => void;
	filterSource: (phrase: string) => any;
	isSearchable: any;
	dataSource: any;
	_dataSourceOrig: any;
	__preDataSource: any;
	__preSourceFiltered: any;
	__preSource: any;
	_setFilteredSourceTm: any;
	clearFilterSource: () => void;
	setChildsDisabled: (el: any, val: any, effectiveVal: any) => void;
	setDisabledFromParent: (value: any) => void;
	contextMenuHandler: (e: any) => boolean;
	_lastKey: string;
	_lastMousePos: { x: any; y: any; };
	contextMenuPromise: any;
	_contextMenuAddons: any;
	_ignoreDefaultLookup: any;
	debugMenuItemsCreated: any;
	_pointerAtPos: any;
	getFocusedElement: any;
	addToContextMenu: (items: any) => void;
	contextMenu: any;
	addEventListener: (event: any, func: any, capture: any) => void;
	removeEventListener: (event: any, func: any, capture: any) => void;
	registerEventHandler: (event: any, capture: any) => void;
	dataSourceListen: (object: any, event: any, func: any, capture: any) => any;
	dataSourcePromise: (pr: any) => any;
	_dataSourcePromises: any;
	thenWithProgress: (pPromise: Promise<any>, params?: any) => void;
}
declare function inheritClass(className: string, parent: any, methods: object, properties: object);

interface Window {
	Control: Function;
}

interface HTMLElement {
	isOpposite: boolean;
	controlClass?: Control;
	unlisteners?: Array<Function>;
}

interface Node {
	controlClass?: Control;
}

declare type controlClass = Control;