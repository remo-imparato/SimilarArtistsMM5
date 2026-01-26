/**
 * This module contains variables and classes which originate from compiled {@link https://en.wikipedia.org/wiki/Delphi_(software) | Delphi} code, rather than JavaScript.
 * 
 * Most variables and classes' declarations are created via an automatic parser which translates Delphi code into TypeScript. Some methods' parameter/return type annotations 
 * cannot be automatically inferred, so they are declared as `myFunc(...params: any[]): Promise<any>` / `myFunc(...params: any[]): any`. 
 * 
 * If there are methods which you need clarification on, please note it in the {@link https://www.mediamonkey.com/forum/viewforum.php?f=27 | developer forum} 
 * and we will manually update the documentation on those methods ASAP.
 * 
 * @packageDocumentation
 */
// ====================                 [Primitives]               ====================

/** This is a distinct primitive in Delphi/Pascal, but in JS it is the same as a number. */
type integer = number;
/** This is a distinct primitive in Delphi/Pascal, but in JS it is the same as a number. */
type float = number;
/** This is a distinct primitive in Delphi/Pascal, but in JS it is the same as a number. */
type byte = number;

interface Object {
    native?: boolean;
}

/**
 * todo document
 */
type JSCancelToken = number;

// ====================                  [Events]                  ====================

type AllDOMEventsMap = HTMLBodyElementEventMap & AnimationEventMap & HTMLVideoElementEventMap & FontFaceSetEventMap;

// JL: This is some wizardry that I cannot claim any credit for (thanks to ChatGPT and stackoverflow)
//  Used in app.listen() and app.unlisten()
type EventCallbackMap<Obj> = 
    IfAny<Obj, 
        {[key: string]: (...args: any[]) => any}, // If Obj doesn't have a defined type, then allow anything
        ({
            [K in keyof Obj as // Grab all keys from Obj
                K extends `event_${infer E}` ? // Does the key include `event_` at the start? (infer E then creates a generic to process in the next line)
                    string extends E ? never // Removes [key: string] from the returned map (see https://stackoverflow.com/questions/51465182/how-to-remove-index-signature-using-mapped-types)
                    : E // "Return" E if it extends `event_` at the start but is not just "string"
                : never // Removes all other keys
            ]: Obj[K]; // Retrieve the event callback definition
        } & (
            // JL: Instead of bothering to declare specific event maps for specific types of DOM nodes,
            //  we can just use a catch-all. Not perfect, but I don't want to spend the effort to make app.listen() perfect for all DOM node types.
            Obj extends EventTarget ? {
                [K in keyof AllDOMEventsMap]: (this: Obj, e: NotifyEvent) => any; // JL: Since all events at the moment are titled 'NotifyEvent', I've gotta disable the AllDOMEventsMap stuff for the time being
                // [K in keyof AllDOMEventsMap]: (this: HTMLElement, e: AllDOMEventsMap[K]) => any;
            } : 
            // eslint-disable-next-line @typescript-eslint/ban-types
            {}
        ))
    >;

// JL: Keeping this here in case we need it (I took this concept and applied it to EventCallbackMap, which is what I needed it for)
type RemoveIndex<T> = {
    [ P in keyof T as string extends P ? never : P ] : T[P]
};

// ====================             [Enumerated types]             ====================

type CoverType = any; // todo

/**
 * Cover storage type.
 * Value meaning:
 * 
 *  0 - tag\
 *  1 - file\
 *  2 - not saved "auto-looked" up image
 */
type CoverStorage = 0|1|2;

/**
 * Type of a track.
 * Value meaning:
 * 
 *  0 = 'Music'\
 *  1 = 'Podcast'\
 *  2 = 'Audiobook'\
 *  3 = 'Classical Music'\
 *  4 = 'Music Video'\
 *  5 = 'Video'\
 *  6 = 'TV'\
 *  7 = 'Video Podcast'\
 *  8 = 'Radio'
 */
type TrackType = 0|1|2|3|4|5|6|7;

/**
 * Auto-Organize result.
 * 
 *  0 = when rule matches track, and track path/filename is OK\
 *  1 = when rule matches track, but path/filename isn't correct\
 *  2 = when rule doens't matches track\
 *  3 = when track is in excluded folder
 */
type ResultState = 0|1|2|3;

/**
 * 0 - Download immediately\
 * 1 - Put into the download queue\
 * 2 - Put into queue only if Downloads count > MAX_FILE_DOWNLOADS
 */
type DownloadQueueType = 0|1|2;

// ====================             [Global variables]            ====================
/** Main MediaMonkey app. This is the entry point to most native objects/methods, such as {@link App.listen | app.listen()} and {@link App.playlists | app.playlists} */
declare var app: App;
declare var doNotCheckLess: boolean|undefined;

/**
 Send debug string to event list. 
See: https://learn.microsoft.com/en-us/sysinternals/downloads/debugview

@param {string} string debug string
*/
declare function ODS (s: string): void;

/**
 * Supported text encoding methods. Default = UTF-8.
 */
type TextEncoding =  'UTF-16' | 'ANSI' | 'UTF-8'

// ==================== [Return types from some native functions] ====================

interface ClipboardDataReturn {
    /**
      Data passed from copy/cut operation
    */
    data: SharedObject;
    /**
      Type of data in data object, typically 'track'
    */
    datatype: string;
    /**
      additional static (serializable) data passed from cut/copy action
    */
    params: {
      /**
        Whether the data was cut instead of copied.
      */
      cut: boolean;
      srcObject?: any;
    };
}

// ====================        [Undocumented base classes]      ====================

/**
 * Base for all native objects.
 */
class Base {}

class SharedProgressObject {}
class RulesList {}
class QueryPlusT {}
class LocationInfo {}
class GenreCategory {}
class PodcastDirectory {}
class MediaConnection {}
class MovedSongData {}

// ====================               [Classes]                 ====================

interface SharedWindow {
    /* 
        JL NOTE: This is for the `onLoad`, `onClosed`, etc. used by uitools on sub windows. We should probably remove this at some point to avoid adding unknown properties to our items.
        @hidden
    */ 
    [key: `on${string}`]: any;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface Window extends SharedWindow {}