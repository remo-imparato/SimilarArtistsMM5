import Control from '../controls/control';
import MainTabContent from '../controls/mainTabContent';
import ToolButton from '../controls/toolbutton';

declare global {
    
    // function requirejs(files: string, callback?: Function, isolate?: boolean, local?: string, reload?: boolean);
    function myAlert(str: string);
    function alertException(exception, addedInfo);
    function getMessageWithStack(exception);

    function getFrameRenderDuration(): number;
    function reloadScript(fn: string): void;
    function unlistenLocalListeners(): void;
    function localPromise(promise: Promise<any>): Promise<any>;
    function cleanUpLocalPromises(): void;
    function getRuntimeLessValues(ext_id): any;
    function setRuntimeLessValues(values, ext_id): void;
    function loadFileFromServer(fname, callback): void;
    function invalidateLayoutCache(): void;


    /** @since 5.0.3 */
    function queryLayoutAfterFrame(callback: procedure): void;
    /** @since 5.0.3 */
    function applyStylingAfterFrame(callback: procedure): void;
    /** @since 5.0.3 */
    function _applyLayoutQueryCallbacks(): void;
    /** @since 5.0.3 */
    function _applyStylingCallbacks(): void;
    var _callbacksQueue: {
        frameCallbacks: AnyDict, // JL note: maybe this needs to be removed
        layoutQueryCallbacks: procedure[],
        stylingCallbacks: procedure[]
    };

    function cleanUpLasso(): void;

    /**
    Our version of requestAnimationFrame which respects window visibility and drops calling to 2 calls pers second when window is not visible
    and reduce to 30FPS when window is not active.

    @method requestAnimationFrameMM
    @param {Function} [callback] Function to be called
    */
    function requestAnimationFrameMM(callback: procedure): number;

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
    function cancelFrame(token: number): void;

    function prepareSourceURL(url: any): any;
    /**
    This method is pretty similar as app.listen(), but app.unlisten() is called automatically in window.cleanupDocument()

    @method localListen
    @param {object} object Object where to set listener
    @param {string} eventName Event name of the listener
    @param {function} func Method for callback dispatch
    @param {boolean} [capture] Capture?
    */
    function localListen(object: any, eventName: string, func: AnyCallback, eventCapture?: boolean): void;
    function createUniqueID(): string;

    /**
    Execute an app/window reload.
    @method doReload
    @param {boolean} [storeState=true] Whether to store UI state during reload
    @param {boolean} [softReload=false] Whether to JUST reload LESS styling
    @param {boolean} [lessChanged=false] Whether LESS was changed
    @param {string} [customCaption] Custom caption to display in the reload prompt.
    */
    function doReload(storeState?: boolean, softReload?: boolean, lessChanged?: boolean, customCaption?: string): void;
    /**
    Reload LESS styling (Only allowed in main window).
    @method reloadLess
    @returns {Promise}
    */
    function reloadLess(): void;
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
    function setLessValues(values: StringDict, ext_id?: string, flush?: boolean): any;

    var settings: WindowSettings;
    var fullWindowModeActive: boolean;
    var webApp: boolean;
    var oneSourceApp: boolean;
    var isStub: boolean;
    var opera: boolean;
    var chrome: boolean;
    var rootURL: string;
    var qUnit: boolean;
    var _cleanUpCalled: boolean;
    var reloading: boolean;
    var __scriptName: string|undefined;
    var customLoader: any;
    var _old_loadFile: any;
    var __windowListeners: any[];
    var __windowPromises: any[];
    var windowCleanup: any;
    var cleanUp: any;
    var beforeWindowCleanup: any;
    var pageLoaded: boolean;
    var pageReady: boolean;
    var cssLoaded: boolean;
    var callReload: boolean;
    var callRestart: boolean;
    var logger: any;
    var mainTabs: any;
    var less: any;
    var input: any;
    var rootElement: HTMLElement;
    var _rootElement: HTMLElement;
    var layoutChangeCounter: number;
    var precompiledHashID: string;
    var notifyListenCall: any; //todo
    var _lastFocusedLVControl: HTMLElement|undefined;
    var _fileImportsInitialized: boolean;
    var _lastHoveredListViewDiv: HTMLElement;
    var _lastLVMouseDownTm : number;
    var _treeLevelIndent : number;
    var isYoutubeWindow: boolean|undefined;
    var getElementTranslateText: any;
    var storeTranslatedText: any;
    var noAutoSize: boolean;
    var alwaysShowHeader: boolean|undefined;
    var mainMenuPanel: HTMLDivElement|undefined;
    function isMenuVisible() : boolean;
    var currentTabControl: MainTabContent;
    var _cleanupCalled: boolean;
    var isTouchMode: boolean;
    var appIsClosing: boolean;
    var clipboard: any;
    var windowsCache: any;    
    var intPlayer: any; // playerUtils.js
    var maintoolbar: any;
    var exitPartyModeBtn: Maybe<ElementWith<ToolButton>>;
    var lastKeyDown: MouseEvent;
    var cachedStyleValues: any;

    var beforeRequireJSEval: (() => any)|undefined;
    var afterRequireJSEval: (() => any)|undefined;

    function whenAll(promiseArray) : Promise<unknown>;
    function whenAny(promiseArray) : Promise<unknown>;
    function dummyPromise(retValue?:any) : Promise<unknown>;
    function precompileBinding(div, parentControl) : void;
    function decompileBinding(div, parentControl) : void;
    function recompileBinding(div, parentControl) : void;
    function closeDropdownPopup(_this) : void; // dropdown.js
    function closeMaskEditPopup(_this) : void; // dropdown.js
    function openDropdownPopup(params) : void; // dropdown.js
    function startFullWindowMode() : void;
    function exitFullScreen(state:boolean) : void;
    function prepareWindowModeSwitching() : any; // playerUtils.js
    function stopFullWindowMode() : void; // playerUtils.js

    interface Promise<T> {
        cancel?: () => void;
        canceled: boolean;	
        then1: (...args:any[]) => any;
    }

    interface AsyncState {
        asSync, asAsync, asAsyncFinished
    }

    interface Document {
        documentMode: boolean;
    }

    class WindowSettings{
        browser: any;
        disableCache: boolean;
        UI: any;
        init: AnyCallback;
        get: AnyCallback;
        set: AnyCallback;
        clearCache: AnyCallback;
        observer: any;
        _settingsCache: any;
        readyTime: number;
    }

    var globalVideoSwitcher: {controlClass: Control | undefined};

    /**
     * getAllUIElements returns an object with unknown keys but known values.
     */
    interface UIElements {
        [key: string]: HTMLElement;
    }

    /*
    interface Element {
        _iconInitialized?: boolean;
        oldWidth?: number;
        oldHeight?: number;
        initInProgress?: boolean;
    }*/

    interface HTMLScriptElement {
        executed?: boolean;
    }

    var InstallTrigger: any; // firefox
    var extendedFixFile: ((file: string) => string)|undefined;

    var uitools: AnyDict; // uitools.js
    var videoModes: AnyDict;
    var cloudTools: AnyDict; // cloudServices.js
    var cloudServices: AnyDict; // cloudServices.js
    var mediaSyncDevices: AnyDict; // mediaSync.js
    var mediaSyncHandlers: AnyDict; // mediaSync.js
    var searchTools: AnyDict; // searchTools.js
    var __lastScriptName: string|undefined;
    var popupWindow: AnyDict; // popupMenu.js
    var menus: AnyDict; // popupMenu.js
    var _mainMenuOpen: boolean;
    var osxMenu: AnyDict;
    var playerUtils: AnyDict;
    var musicBrainz: AnyDict;
    var discogs: AnyDict;
    var docking: AnyDict;
    var views: AnyDict; // views.js
    var autoDJ: AnyDict; // autoDJ.js
    var editors: AnyDict; // editors.js
    var templates: AnyDict; // templates.js
    var starTemplates: AnyDict; // rating.js
    var statusbarFormatters: AnyDict; // statusbar.js
    var nowPlayingLayouts: AnyDict; // nowPlayingView.js
    var TVDB: AnyDict; // scripts/videoTagServices
    var artDetailsLayouts: AnyDict; // controls/artWindow.js
    var playerContextMenuItems: AnyDict; // controls/player.js
    var playerTrackContextMenuItems: AnyDict; // controls/player.js
    var playerControlsHandlers: AnyDict; // controls/player.js
    var _utils: __UTILS; // utils.js
    var utils: Utils; // app.utils
    var pinViews: AnyDict; // pinViews.js
    var SearchResultsHandlers: AnyDict; // searchView.js
    var ytHelper: AnyDict; // youtubeHelper.js
    var backgroundImageCache: AnyDict; // backgroundImage.js


    /**
     * Only used when running in webApp mode
     */
    function getPlayer(): Player;

    var Velocity: any; // velocity.js
    type SimpleTasksController = any; // simpleTasksController.js
    var Menu: any; // popupmenu.js i think
    function sprintf(arg0: string, ...params: any[]): string; // sprintf.js
    function getPredefinedMasks(presetName: string): StringList; // masks.js
}