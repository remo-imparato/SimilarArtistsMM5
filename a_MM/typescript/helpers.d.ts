
declare class ObservableObject {
    initialize: () => {}
    _getListeners: (type: any, useCapture: any) => any;
    addEventListener: (type: any, listener: any, useCapture: any) => void;
    removeEventListener: (type: any, listener: any, useCapture: any) => void;
    raiseEvent: (type: any, params: any) => void;
    notifyChange: (params: any) => void;
    getSimpleCopy: () => any;
    localPromise: (promise: any) => any;
    cleanUpPromises: () => void;
    requestTimeout: (callback: any, timeMS: any, callbackID: any, useFirst: any) => number;
    cleanUp: () => void;
    uniqueID: string;
    _registrations: any; // todo
    _localPromises: Promise<any>[];
    _promises: Promise<any>[];
    isObservable: boolean;
}

declare function notifyListenCall(target, event, func, capture): void;
declare function beforeRequireJSEval(): void;
declare function afterRequireJSEval(): void;

declare var Velocity: any; // velocity.js