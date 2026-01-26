
declare function requirejs(files: string, callback?: Function, isolate?: boolean, local?: string, reload?: boolean);
declare function localRequirejs(files: string, callback?: Function, isolate?: boolean): void;
declare function setIconFast (div: HTMLElement, icon: SVGElement);
declare function setIconAriaLabel (div: HTMLElement, label: string);
declare function setVisibility (element: HTMLElement, visible: boolean, params?: object);
declare function isFunction(x: any): boolean;
declare function notifyLayoutChangeDown(elem: HTMLElement);
declare function notifyLayoutChangeUp(elem: HTMLElement);
declare function passiveSupported(): boolean;
declare function addPassiveOption(capture: any): any;
declare function alertInetException(url: string, error: any);
declare function myAlert(str: string);
declare function alertException(exception, addedInfo);
declare function getMessageWithStack(exception);
declare function getDocumentBody(): HTMLElement;
declare function assert(condition: any, message: string);
declare function asyncLoop(fn: Function, valFrom: number, token: object, finishedCallback?: Function);
declare function asyncGenerator(fn: Function): Promise<any>;
declare function fixFile(fname: string): string;
declare function createNewCustomEvent(eventName: string, params?: any): Event;
declare function createNewEvent(eventName: string): Event;
declare function updateLoadedFile(fname, content);
declare function loadFile(fname: string, callback?: Function, params?: any): string;
declare function getValueAtIndex(list: SharedList|ArrayDataSource, index: number);
declare function requestTimeout(callback: Function, time: number);
declare function assignProperties(target: any, source: any);
declare function getFrameRenderDuration(): number;
declare function filterTag(nodeList: ArrayLike<any>): Array<any>;
declare function filterCondition(nodeList: ArrayLike<any>): Array<any>;
declare function reloadScript(fn: string): void;
declare function loalListen(eventObject: Element, eventName: string, eventMethod: Function, eventCapture?: boolean): void;
declare function unlistenLocalListeners(): void;
declare function localPromise(promise: PromiseLike<any>): PromiseLike<any>;
declare function cleanUpLocalPromises(): void;
declare function getLeftTop(): {left: number, top: number};
declare function fixScreenCoords(coords, ctrl?): any;
declare function getScreenCoordsFromEvent(e: any): {left: number, top: number};
declare function findScreenPos(obj): any;
declare function getAbsPosRect(div): DOMRect;
declare function getOffsetRect(div): any;
declare function newElement(parent: HTMLElement, type: string, className?: string): HTMLElement;
declare function isInElement(x, y, obj): boolean;
declare function debugObject(object): string;
declare function getRuntimeLessValues(ext_id): any;
declare function setRuntimeLessValues(values, ext_id): void;
declare function loadFileFromServer(fname, callback): void;
declare function getComputedSize(): any;
declare function setComputedSize(force?, secondLoop?): any;
declare function getScrollbarWidth(): number;
declare function getBodyForControls(): HTMLElement;
declare function addDialogContent(content: string): HTMLElement;
declare function notifyLayoutChange(rightNow?: boolean): void;
declare function invalidateLayoutCache(): void;
declare function enterLayoutLock(element?: HTMLElement): void;
declare function leaveLayoutLock(element?: HTMLElement): void;


declare function queryLayoutAfterFrame(callback: Function): void;
declare function applyStylingAfterFrame(callback: Function): void;
declare function _applyLayoutQueryCallbacks(): void;
declare function _applyStylingCallbacks(): void;
declare var _callbacksQueue: {
	frameCallbacks: {}, // JL note: maybe this needs to be removed
	layoutQueryCallbacks: Function[],
	stylingCallbacks: Function[]
}

declare function cleanupDocument(): void;
declare function cleanUpLasso(): void;
declare function cleanControlClass(e: HTMLElement|Node): void;

/**
Removes an element from DOM in a safe way, cleaning all its controls (including descendants).

@method removeElement
@param {HTMLElement} e Element to remove
@param {boolean} [hideParentWhenNoChild] Whether to hide the element's parentNode if it contains no additional children.
*/
declare function removeElement(e: HTMLElement, hideParentWhenNoChild?: boolean): void;


/**
Removes all children elements of the given element. Unlike cleanElement() function, it doesn't clean all inner controls and so it's an optimized version 
used when there aren't controls used (otherwise, it would leave memore leaks).

@method cleanBasicElement
@param {HTMLElement} e Element to clean
@return {HTMLElement} The same element
*/
declare function cleanBasicElement(e: HTMLElement): HTMLElement;


/**
Removes all children elements of the given element. Note that it uses e.removeChild() method in a loop, which is much faster than e.innerHTML=''.
Also calls cleanElement for all descendant controls.

@method cleanElement
@param {HTMLElement} e Element to clean
@param {Boolean} [onlyChildren] Default false, cleans only children of e if set to 'true'.
@return {HTMLElement} The same element
*/
declare function cleanElement(e: HTMLElement, onlyChildren?: boolean): HTMLElement|undefined;


/**
Returns control inside which this element is contained.

@method elementControl
@param {HTMLElement} el Element to check
@return {Control} Control found (or undefined).
*/
declare function elementControl(el?: HTMLElement): Control|undefined;


/**
Our version of requestAnimationFrame which respects window visibility and drops calling to 2 calls pers second when window is not visible
and reduce to 30FPS when window is not active.

@method requestAnimationFrameMM
@param {Function} [callback] Function to be called
*/
declare function requestAnimationFrameMM(callback: Function);

/**
 * Request an animation frame to run, with the same features as {{#crossLink "Window/requestAnimationFrameMM:method"}}requestAnimationFrameMM{{/crossLink}} but automatically stops if the user has closed the window.
 * @param {function} callback Callback to execute.
 * @method requestFrame
 */
declare function requestFrame(callback: Function);

/**
 * <b>[ADDED IN VERSION 5.0.3]</b><br> Cancel a frame returned by window.requestFrame() or window.requestAnimationFrameMM(). 
 * Because the token type of requestAnimationFrameMM can either be that of a Timeout or an AnimationFrame, you must use this method instead of cancelAnimationFrame() to guarantee that it is cancelled.
 * @example
 * 
 *      var token = requestFrame(myCall);
 *      cancelFrame(token);
 * @method cancelFrame
 * @param {number} token 
 */
 declare function cancelFrame(token: number): void;


/**
Loads a specific SVG file from 'skin/icon' folder. Handles duplicate requests and asynchronous loading. Instead of returning the SVG code, this method provides a live DOM element, which is faster.

Doesn't need to be called directly as it's automatically used by HTML like

	<div data-icon=’closeTab’></div>

The loaded icon can be further styled by CSS, e.g.

	fill: red;

@method loadIconFast
@param iconName {string} Name of the icon to load, without extension, e.g. 'close'.
@param {function} [callback] Function to call, when icon content is loaded.
@return {SVGElement|undefined} SVG element.
*/
declare function loadIconFast(iconName: string, callback?: Function): SVGElement|undefined;

/**
Loads a specific SVG file from 'skin/icon' folder. Handles duplicate requests and asynchronous loading. Returns the SVG code, not a live DOM element.

Doesn't need to be called directly as it's automatically used by HTML like

	<div data-icon=’closeTab’></div>

The loaded icon can be further styled by CSS, e.g.

	fill: red;

@method loadIcon
@param iconName {string} Name of the icon to load, without extension, e.g. 'close'.
@param callback Function to call, when icon content is loaded.
@return SVG code. Use innerHTML to create the icon.
*/
declare function loadIcon(iconName: string, callback?: () => any): string|undefined;

/**
Returns class with all named elements inside the specified rootElement (document is used when not defined) to direct access.
Script can then do not need to call qid for any named element. 
@example

    var UI = getAllUIElements();
    UI.lvTracklist.controlClass.dataSource = data;

@method getAllUIElements
@param {HTMLElement} root element
@return {UIElements} class with named elements
*/
declare function getAllUIElements(rootElement?: HTMLElement);

/**
Returns the first document element for the selector. It's recommended to use more specific functions when possible, e.g. {{#crossLink "Window/qid:method"}}{{/crossLink}}, since its
faster than a generic selector usage.

@method q
@param s {String} Selector
@return Element found
*/
declare function q(s: string): HTMLElement;

/**
Returns all document elements for the selector.

@method qs
@param s {String} Selector
@return {NodeListOf<HTMLElement>} Elements found
*/
declare function qs(s: string): NodeListOf<HTMLElement>

/**
Returns the first document element for the given ID.

@method qid
@param id {String} ID of the requested element
@return {HTMLElement} Element found
*/
declare function qid(id: string): HTMLElement;

/**
Returns all elements for the given class.

@method qclass
@param cls {String} Class name of the requested elements
@return {HTMLCollectionOf<Element>} Elements found
*/
declare function qclass(cls: string): HTMLCollectionOf<Element>;

/**
Returns all elements for the given class, starting from a particular element.
@method qeclass
@param {HTMLElement} e Element to search within
@param {string} cls Class name of the requested elements
@returns {HTMLCollectionOf<Element>} Elements found
 */
declare function qeclass(e: HTMLElement, cls: string): HTMLCollectionOf<Element>;

/**
Returns all elements for a given tag name
@method qtag
@param {string} tg Tag name
@returns {HTMLCollectionOf<Element>} Elements found
 */
declare function qtag(tg: string): HTMLCollectionOf<Element>;

/**
Returns all elements for the tag name that are descendants of the given element
@method qetag
@param {HTMLElement} e Element to search within
@param {string} tg Tag name
@returns {HTMLCollectionOf<Element>} Elements found
 */
declare function qetag(e: HTMLElement, tg: string): HTMLCollectionOf<Element>;

/**
Returns the first element matching the selector (that is subnode of the given element)
@method qe
@param {HTMLElement|Document} e Element to search within
@param {string} s Query selector
@returns {HTMLElement} Found element
 */
declare function qe(e: HTMLElement|Document, s: string): HTMLElement;

/**
Returns all elements for the given selector that are subnodes of the given element.
@method qes
@param {HTMLElement|Window|Document} e Element to search within
@param {string} s Query selector
@returns {HTMLCollectionOf<Element>|NodeListOf<HTMLElement>} Found elements
 */
declare function qes(e: HTMLElement|Window|Document, s: string): HTMLCollectionOf<Element>|NodeListOf<HTMLElement>;

/**
Returns the first descendant element of the given element matching the given data ID.
@method qeid
@param {HTMLElement} e Element to search within
@param {string} id data-id of the requested element
@returns {Element} Found element
 */
declare function qeid(e: HTMLElement, id: string): HTMLElement;

/**
Execute a callback function for every element in an array.
@example

    forEach(arr, function (item, idx) { ... });
@method forEach
@param {ArrayLike} nodeList List to iterate through
@param {function} callback Callback (It is passed each item of nodeList and its index)
 */
declare function forEach(nodeList: ArrayLike<any>, callback: Function);
// declare function forEach<T>(nodeList: ArrayLike<T>, callback: (item: T) => any); // todo

/**
Execute a callback function for every item in a SharedList, using getFastObject.
@example
 
     fastForEach(tracklist, function (item, idx) { ... });
@method fastForEach
@param {SharedList} list The list to iterate (e.g. songs, albums, etc.)
@param {function} callback Callback (It is passed each item of the list and its index)
 */
declare function fastForEach(list: SharedList, callback: Function);

/**
Get a comma-separated list of IDs of a SharedList.
@method listGetCommaIDs
@param {SharedList} list The list object
@param {Number} maxCount Max number of items (If there are more, it will be truncated with a ...)
@returns {string} Comma-separated list
 */
declare function listGetCommaIDs(list: SharedList, maxCount: number);

/**
Execute a callback function for every item in a SharedList, using getValue.
@example
 
     listForEach(tracklist, function (item, idx) { ... });
@method listForEach
@param {SharedList} list The list to iterate (e.g. songs, albums, etc.)
@param {function} callback Callback (It is passed each item of the list and its index)
@param {function} [final_callback] Callback to be executed after all items have been gone through
 */
declare function listForEach(list: SharedList, callback: Function, final_callback?: Function);

/**
Asynchronously process each item in an array.
@example

    asyncForEach(arr, function (item, next) {
        ...
        next();
    });
@method asyncForEach
@param {Array} list Array to process
@param {function} next_item_callback Callback for each item. Parameter 2 is the callback function to process the next item. Parameter 3 is item index.
@param {function} [final_callback] Final callback after everything has been done.
 */
declare function asyncForEach(list: Array<any>, next_item_callback: Function, final_callback?: Function);

/**
Asynchronously process each item in a SharedList or ArrayDataSource.
@example 

    listAsyncForEach(tracklist, function (item, next) {
        ...
        next();
    });
@method listAsyncForEach
@param {SharedList|ArrayDataSource} list Array to process
@param {function} next_item_callback Callback for each item. Parameter 2 is the callback function to process the next item. Parameter 3 is item index.
@param {function} [final_callback] Final callback after everything has been done.
 */
declare function listAsyncForEach(list: SharedList|ArrayDataSource<any>, next_item_callback: Function, final_callback?: Function);

/**
<b>[ADDED IN VERSION 5.0.1]</b><br> For screen reader support: Sets a focused element's active descendant. Required for keyboard navigation to work properly with screen readers. <br>
Gives the div a unique ID and sets the parent's aria-activedescendant. Use in conjunction with ARIA roles: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Techniques <br>
The parent element must have a role (for example: table) as well as the active element (for example: row)

@method setAriaActiveDescendant
@param {Element} div The div which is active
@param {Element} parent The parent element which is focused
 */
declare function setAriaActiveDescendant(div: HTMLElement, parent: HTMLElement);

/**
<b>[ADDED IN VERSION 5.0.1]</b><br> For screen reader support: Clears the element's unique ID.
@method clearAriaID
@param {HTMLElement} div The div which is no longer active
 */
declare function clearAriaID(div: HTMLElement);
/**
 * Resolve anything to a defined value. If a function is provided, then the return of that function is returned.
 * @param {any} property Property to resolve.
 * @param {any} [whenUndefined] Default value if undefined.
 * @param {any} [params] Parameters to apply, if property is a function.
 * @param {any} [bindObj] Object to bind, if the "this" property needs to be accessible.
 * @returns 
 */
declare function resolveToValue(property: any, whenUndefined?: any, params?: any, bindObj?: any): any;
declare function prepareSourceURL(url: any): any;
/**
This method is pretty similar as app.listen(), but app.unlisten() is called automatically in window.cleanupDocument()

@method localListen
@param {object} object Object where to set listener
@param {string} eventName Event name of the listener
@param {function} func Method for callback dispatch
@param {boolean} [capture] Capture?
*/
declare function localListen(object: any, eventName: string, func: anyCallback, eventCapture?: boolean): void;
declare function createUniqueID(): string;
declare function fontSizePx(): number;
/**
Get value of @fontLineSize, in px.
@method fontLineSizePx
@return {Number}
*/
declare function fontLineSizePx(): number;
/**
Converts value in pixels to em, based on given parent control. If no parent control is set, document.body is used.
@method pxToEm
@param {Number} pxNum Source value in pixels.
@param {HTMLElement} [parentEl] Parent control. The default is body element.
@return {Number}
*/
declare function pxToEm(pxNum: number, parentEl: HTMLElement): number;
/**
Returns control inside which this element is contained.

@method elementControl
@param {HTMLElement} el Element to check
@return {Control} Control found (or undefined).
*/
declare function elementControl(el?: HTMLElement|null): Control|undefined;
/**
Return parent of the element.

@method getParent
@param {HTMLElement} e Element to get his parent
*/
declare function getParent(e: HTMLElement): HTMLElement|ParentNode|null|undefined;
/**
Execute an app/window reload.
@method doReload
@param {boolean} [storeState=true] Whether to store UI state during reload
@param {boolean} [softReload=false] Whether to JUST reload LESS styling
@param {boolean} [lessChanged=false] Whether LESS was changed
@param {string} [customCaption] Custom caption to display in the reload prompt.
*/
declare function doReload(storeState?: boolean, softReload?: boolean, lessChanged?: boolean, customCaption?: string): void;
/**
Reload LESS styling (Only allowed in main window).
@method reloadLess
@returns {Promise}
*/
declare function reloadLess(): void;
/**
<b>[ADDED IN VERSION 5.0.2]</b><br>
Set runtime values for LESS variables, for skins, without destroying existing values.

@example 
    
    // The following will be interpreted as "@warningColor: red;" and Monkey Groove's main color will be changed to red.
    setLessValues({warningColor: 'red'}, 'Monkey Groove'); 
    
    // The following will remove the custom "@warningColor: red;" from the previous example, on the Monkey Groove skin only.
    setLessValues({warningColor: ''}, 'Monkey Groove'); 
    setLessValues({warningColor: null}, 'Monkey Groove'); 
    
    // The following will be interpreted as "@textColor: green;" and be applied to ALL skins.
    setLessValues({textColor: 'green'}); 
@method setLessValues
@param {object} values Values, in key-value format. If the value is undefined (or null or empty string), the variable will be removed.
@param {string} [ext_id] Optional: Addon ID of the skin. If specified, the LESS variables will only apply to the one skin.
@param {boolean} [flush] Optional: Flush (reset) existing LESS variables
*/
declare function setLessValues(values: StringDict, ext_id?: string, flush?: boolean): any;
/**
Loads a HTML file and includes it in the given element. It also executes all the scripts of the HTML file. Note that a call to initializeControls 
 might be needed in order to initialize any custom UI control in the loaded HTML. <br>
For all the scripts within the included HTML there's window.rootElement set to the element where the HTML is being included, in order to be able to modify the correct part of DOM (if needed).
@method includeHTML
@param {HTMLElement} element Element where to load HTML
@param {string} filename Source file for the HTML
 */
declare function includeHTML(element: HTMLElement, filename: string): void;
/**
Process our internal attributes to properly initialize the document
@method processIncludes
@param {HTMLElement} element 
 */
declare function processIncludes(element: HTMLElement): void;
/**
Initializes an HTML element to a ControlClass. (see {{#crossLink "Control"}}{{/crossLink}})
@example

    <div data-id="chbExample" data-control-class="Checkbox">This is a Checkbox</div>
    
    initializeControl(qid('chbExample'));
@method initializeControl
@param {HTMLElement} control Element to initialize
 */
declare function initializeControl(control: HTMLElement): void;
/**
Initializes all UI controls below a particular HTML element. This means loading a necessary JS and all the initialization code. This is normally done automatically on window load by mminit.js inclusion.
@method initializeControls
@param {HTMLElement} element Element to process (and all its children)
 */
declare function initializeControls(element: HTMLElement): void;
/**
Calls the specified function when all page scripts are loaded and processed. So it's processed after window.onLoad event, but before {{#crossLink "Window/whenReady:method"}}whenReady(){{/crossLink}} event. <br>
If called after this event, the callback function is executed immediately.
@method whenLoaded
@param {Function} event Callback function to be executed when ready.
 */
declare function whenLoaded(event: callback): ;
/**
Calls the specified function when all scripts are loaded, the whole DOM is processed by our parser and all controls are initialized. I.e. at this point everything is ready to be used. So both window.onLoad and {{#crossLink "Window/whenLoaded:method"}}whenLoaded(){{/crossLink}} events occur before this one.
If called after this event, the callback function is executed immediately.

@method whenReady
@param {Function} event Callback function to be called.
 */
declare function whenReady(callback: callback): void;
/**
Can be called to avoid any {{#crossLink "Window/layoutchange:event"}}layoutchange event{{/crossLink}} occurence during execution of some code.

@method lockedLayout
@param {HTMLElement} element Element where all the changes occur (its sub-tree is modified).
@param {Function} callback A function during which execution won't any layout procession occur (only on its end).
*/
declare function lockedLayout(element: HTMLElement, callback: callback): void;


declare var settings: WindowSettings;
declare var fullWindowModeActive: boolean;
declare var webApp: boolean;
declare var oneSourceApp: boolean;
declare var isStub: boolean;
declare var opera: boolean;
declare var chrome: boolean;
declare var rootURL: string;
declare var isMainWindow: boolean;
declare var qUnit: boolean;
declare var _cleanUpCalled: boolean;
declare var reloading: boolean;
declare var __scriptName: string|undefined;
declare var customLoader: any;
declare var _old_loadFile: any;
declare var __windowListeners: any[];
declare var __windowPromises: any[];
declare var windowCleanup: any;
declare var pageLoaded: boolean;
declare var pageReady: boolean;
declare var cssLoaded: boolean;
declare var logger: any;
declare var less: any;
declare var rootElement: HTMLElement;
declare var _rootElement: HTMLElement;
declare var layoutChangeCounter: number;


interface Promise {
	cancel?: () => void;
}

interface Document {
	documentMode: boolean;
}

declare class WindowSettings{
	browser: any;
	disableCache: boolean;
	UI: any;
	init: Function;
	get: Function;
	set: Function;
	clearCache: Function;
}

interface Promise<T> {
	canceled: boolean;
}

/**
 * getAllUIElements returns an object with unknown keys but known values.
 */
interface UIElements {
	[key: string]: HTMLElement;
}

interface Element {
	_iconInitialized?: boolean;
	oldWidth?: number;
	oldHeight?: number;
    initInProgress?: boolean;
    layoutLocked: number; // todo, add ?
    layoutUpdateNeeded?: boolean;
}

interface HTMLScriptElement {
    executed?: boolean;
}

declare var InstallTrigger: any; // firefox
declare var extendedFixFile: Function|undefined;