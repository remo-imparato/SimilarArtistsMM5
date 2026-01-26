/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

'use strict';
registerFileImport('helpers/observableObject');
/**
@module DOMExtensions
*/
/**
Base class for observable objects - objects supporting events

@class ObservableObject
@constructor
*/
export default class ObservableObject {
    constructor(obj, params) {
        this.initialize(obj, params);
    }
    initialize(obj, params) {
        this.uniqueID = createUniqueID();
        this._registrations = {};
        this._localPromises = [];
        this._promises = [];
        this.isObservable = true;
    }
    _getListeners(type, useCapture) {
        let captype = (useCapture ? '1' : '0') + type;
        if (!(captype in this._registrations))
            this._registrations[captype] = [];
        return this._registrations[captype];
    }
    addEventListener(type, listener, useCapture) {
        let listeners = this._getListeners(type, useCapture);
        let ix = listeners.indexOf(listener);
        if (ix === -1)
            listeners.push(listener);
    }
    removeEventListener(type, listener, useCapture) {
        let listeners = this._getListeners(type, useCapture);
        let ix = listeners.indexOf(listener);
        if (ix !== -1)
            listeners.splice(ix, 1);
    }
    raiseEvent(type, params) {
        let listeners = this._getListeners(type, true).slice();
        for (let i = 0; i < listeners.length; i++)
            listeners[i].call(this, params);
        listeners = this._getListeners(type, false).slice();
        for (let i = 0; i < listeners.length; i++)
            listeners[i].call(this, params);
    }
    notifyChange(params) {
        this.raiseEvent('change', params);
    }
    getSimpleCopy() {
        let retval = new window[this.constructor.name]();
        for (let attr in this) {
            if ((attr !== '_registrations') && this.hasOwnProperty(attr)) {
                retval[attr] = this[attr];
            }
        }
        return retval;
    }
    localPromise(promise) {
        let _this = this;
        let _uid = createUniqueID();
        let pr = promise.then1(function (e) {
            _this._localPromises[_uid] = undefined;
            return e;
        });
        this._localPromises[_uid] = promise;
        return pr;
    }
    cleanUpPromises() {
        for (let ids in this._localPromises) {
            if ((this._localPromises[ids]) && (isPromise(this._localPromises[ids]))) {
                cancelPromise(this._localPromises[ids]);
            }
        }
        for (let ids in this._promises) {
            if ((this._promises[ids]) && (isPromise(this._promises[ids]))) {
                cancelPromise(this._promises[ids]);
            }
        }
        this._localPromises = [];
        this._promises = [];
    }
    requestTimeout(callback, timeMS, callbackID, useFirst) {
        if (!this._timeoutIDs)
            this._timeoutIDs = [];
        if (callbackID) {
            if (this._timeoutIDs[callbackID] !== undefined) { // already waiting for calling this callback
                if (!useFirst) {
                    clearTimeout(this._timeoutIDs[callbackID]);
                    this._timeoutIDs[callbackID] = undefined;
                }
                else
                    return;
            }
        }
        let _this = this;
        callbackID = callbackID || createUniqueID();
        let tmid = setTimeout(function () {
            _this._timeoutIDs[callbackID] = undefined;
            callback();
        }, timeMS);
        this._timeoutIDs[callbackID] = tmid;
        return tmid;
    }
    cleanUp() {
        this.cleanUpPromises();
        if (this._timeoutIDs) {
            for (let ids in this._timeoutIDs) {
                if (this._timeoutIDs[ids] !== undefined) {
                    clearTimeout(this._timeoutIDs[ids]);
                    this._timeoutIDs[ids] = undefined;
                }
            }
            this._timeoutIDs = undefined;
        }
    }
}
registerClass(ObservableObject);
