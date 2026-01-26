import { Action } from '../actions';
import Checkbox from '../controls/checkbox';
import Control from '../controls/control';
import ListView from '../controls/listview';
import MainTabContent from '../controls/mainTabContent';
import ObservableObject from '../helpers/observableObject';
import { NodeHandler, ViewHandler } from '../viewHandlers';

declare global {
    interface MouseEvent {
        toElement?: any;
    }
    
	type callback = () => any;
	type procedure = () => void;
	type AnyCallback = (...args: any) => any;
    type AnyFunction = AnyCallback;
	type EventCallback = (this: any, event: any) => any;
	type Callback<T> = (param: T) => void;
	/**
	 * Either the required type `T`, or a function that returns the required type `T`.
	 */
	type Resolvable<T> = T | ((...params: any) => T);
	/**
	 * Either the required type `T`, or a function that returns the required type `T`, OR a function that returns a Promise with the required type `T`.
	 * @example
	 *  let x: PromiseResolvable<SubmenuItem[]>;
	 *  x = () => {
	 *    return new Promise((resolve, reject) => {
	 *      resolve([
	 *        {action: actions.minimize, order: 0, grouporder: 0},
	 *        {action: actions.maximize, order: 10, grouporder: 0},
	 *        {action: actions.closeWindow, order: 20, grouporder: 0},
	 *      ])
	 *    })
	 *  }
	 */
	type PromiseResolvable<T> = T | ((...params: any) => T|Promise<T>);
	type OptionalResolvable<T> = Resolvable<T | undefined>;
	type OptionalPromiseResolvable<T> = PromiseResolvable<T|undefined>;
	/**
	 * Either the specified type `T` or undefined/null.
	 */
	type Maybe<T> = T|undefined|null;
	/**
	 * Generic "getter" function of a specified type.
	 */
	type Getter<T> = (...params: any[]) => T|undefined;

	type GeneralElement = HTMLElement | Element;

	function parseFloat(source: any): number;
	function parseInt(source: any): number;

	type Dictionary<T> = {[key: string]: T};
	type StringDict = Dictionary<string>;
	/**
	 * Generic JS "object".
	 */
	type AnyDict = Dictionary<any>;
    
    /**
     * Ref: https://stackoverflow.com/questions/55541275/typescript-check-for-the-any-type
     */
    type IfAny<T, Y, N> = 0 extends (1 & T) ? Y : N; 

	// for ts overrides
	type Modify<T, R> = Omit<T, keyof R> & R;
    
    /** Alias shorthand of {@link HTMLCollectionOf} */
    type HCO<T extends HTMLElement> = HTMLCollectionOf<T>;

	type DropMode = 'move' | 'copy';

	type SortColumn = {
		columnType: string,
		title: string,
		direction: string,
		visible?: boolean;
		index?: number;
	}
    
    interface WheelEvent {
        wheelDelta: number
        wheelDeltaX: number
        wheelDeltaY: number
    }

	interface _UIEvent extends Event {        
        details: AnyDict;
		detail: AnyDict;
		target: HTMLElement;
		_target: HTMLElement;
		dataTransfer: AnyDict;
		wheelDelta: number; wheelDeltaX: number; wheelDeltaY: number; // missing in WheelEvent, why?	
		_dropNode?: any;
		shiftKey: boolean; ctrlKey: boolean; altKey: boolean; metaKey: boolean; // is part of KeyboardEvent already, but only as readOnly property there
		key: any; // is part of KeyboardEvent already, but only as readOnly property there
	}
	type NotifyEvent = KeyboardEvent & MouseEvent & WheelEvent & _UIEvent & DragEvent & FocusEvent & TouchEvent & CustomEvent;

	// todo move to promises.ts
	interface Promise<T> {
		then1: (...args) => any;
	}

	interface HTMLElement extends Element {
		controlClass?: Control;
		focusContainer?: HTMLElement;
		__removeCallStack?: any; // debug only
		emToPxKoef?: number;
		_scheduledLayoutDown?: boolean;
		_ongoingAnimation?: number;
		_forcedVisible?: boolean;
		itemIndex?: number;
		// menus
		icondiv?: ElementWith<Checkbox>;
                subicondiv?: HTMLElement;
		textdiv?: HTMLElement;
		hotlink?: HTMLElement;
		unlisteners?: callback[];
		autoHideEvent?: (e: NotifyEvent) => void;
		autoHideTimer?: number;
		tooltipValueCallback?: (tipdiv: HTMLElement, vis: boolean, params: AnyDict) => void;
		/**
		 * Whether to display a tooltip instantly
		 */
		tooltipImmediate?: boolean; 
		isOpposite?: boolean;
		_manualVisibilityState?: boolean;    
		parentNode: HTMLElement;
		forceRebind?: boolean;
		rebindSelection?: boolean;
		sheet?: any;
		column?: any;
		lastMouseUp?: number;
		firstChild: HTMLElement;
        wasVisibleBeforeFullWindow?: boolean;
        _beforeMaximizeState?: boolean;
		insertBefore(where: Node, what: Node)
	}

	interface ElementWith<C extends Control> extends HTMLDivElement {        
		controlClass: C;
	}

	interface CustomElementWith<C extends Control> extends CustomElement {        
		controlClass: C;
	}

	interface HTMLDivElement extends HTMLElement {
		action?: Action; // todo more specific		
		parentListView: ListView;
		_collapseMark?: HTMLDivElement;
		groupid?: number;
		isVis?: boolean;
		isMoving?: boolean;
		dragging?: boolean;
		forceInvalidate?: boolean;
		group?: any;
		itemID?: number;
		counter?: number;
		sortdivNumber?: HTMLElement;
		check?: HTMLDivElement;
		content?: HTMLDivElement;
		selectButton?: HTMLDivElement;
		shortcutdiv?: HTMLDivElement;
		isFiller?: boolean;
		initRequired?: boolean;
		mitem?:any;
		submenu?:any;
	}

	interface CustomElement extends AnyDict, HTMLDivElement {
	}

	interface Window {
		_scheduledLayoutDown?: boolean;
		doNotCheckLess?: boolean; // in popupmenu windows
		mouseX?: number;
		mouseY?: number;
		mouseScreenX?: number;
		mouseScreenY?: number;
		mouseTarget?: EventTarget;
		rightClickOnImage?: boolean;    
	}

	interface ViewData {        
		title: Resolvable<string>; 
		hasChildren: () => boolean; 
		icon: Resolvable<string>; 
		timeStamp: number; // to be set once view will be added to history   
		inHistory: () => boolean; 
		mainTabContent: MainTabContent; 
		viewNode: SharedNode; 
		nodePath: string; 
		clickedRect: any; // rectangle from which this view was expanded (e.g. clicked album rect. in albums view - because of animations)            
		dataSourceCache: AnyDict; 
		dataSourceCacheObserver: ObservableObject; 
		controlsState: AnyDict;
		tag: AnyDict; // custom data can be stored here by scripts
		nodehandler: NodeHandler;
		viewHandler?: ViewHandler; // automatically set in _showView
		availableViews: () => Resolvable<string[]>;     
		openSubNode: (params: any) => void; 
		createViewData: (params: any) => ViewData; 
		getHistoryPos: () => number; 
		promise: (pr: Promise<any>, promise_id?: string) => Promise<any>; 
		cancelPromise: (promise_id: any) => void; 
		listen: (obj: any, event: any, func: any, id?: any) => (...params: any[]) => void; 
		unlisten: (id: any) => void; 
		loadProgress: (sourceType: any, progressText: string) => void; 
		_cancelDelayedAssign: () => void; 
		delayedAssign: (ds: any, callback: callback) => void; 
		onHide: () => void;
		stored?: boolean; // "stored" version (to persistent.json)
		nodePathSources?: any[]; // for stored viewData (to persistent.json)
		treePath?: string;
		reloading?:boolean;
		_onNodeDeleted?: procedure;    
		forceShowSubViewIDs?: string[];    
		currentViewId?: string; // automatically set in _showView
		_state?: any;   
		localSearchPhrase?: string;    
		isActive?: boolean;
	}
    
    interface DataSource<T> {
        count: integer;
        focusedIndex: integer;
        itemsSelected: integer;
        focusedItem: T;
        dontNotify: boolean;
        statusInfo: Promise<string>;
        add(item: T): void;
        insert(index: number, item: T): void;
        delete(index: number): void;
        remove(item: T): void;
        clear(): void;
        indexOf(value: T): number;
        getAllValues(key): any[];
        locked(func: () => void): void;
        getFastObject(index: number, obj?: any): T;
        clearSelection(): void;
        forEach(func: (item: T, index: number) => void): void;
        beginUpdate(): void;
        endUpdate(): void;
        setSelected(index: number, value: boolean): void;
        isSelected(index: number): boolean;
        setChecked(index: number, value: boolean): void;
        isChecked(index: number): boolean;
        moveSelectionTo(newIndex: number): void;
        getValue(index: number): T;
        notifyLoaded(): void;
        suspendAutoUpdates(): void;
        resumeAutoUpdates(): boolean;
        autoUpdatesSuspended(): boolean;
        clearGroupsAsync(): Promise<boolean>;
        modifyAsync(func: () => void): Promise<void>;
        
        event_focuschange: (newIdx: number, oldIdx: number) => void;
        
        // Methods that need to be overwritten in child interfaces
        whenLoaded(): Promise<DataSource<T>>;
        copySelectionAsync(sourceList: DataSource<T>): Promise<void>;
        addList(list: DataSource<T>): void;
        getSelectedList(): DataSource<T>;
    }

    interface TrackDataSource<T> extends DataSource<T> {
        getSelectedTracklist(): TrackDataSource<T>;
        
        whenLoaded(): Promise<TrackDataSource<T>>;
        copySelectionAsync(sourceList: TrackDataSource<T>): Promise<void>;
        addList(list: TrackDataSource<T>): void;
        getSelectedList(): TrackDataSource<T>;
    }
}