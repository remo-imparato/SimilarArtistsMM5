/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

'use strict';
requirejs('controls/control');
/**
Control cache - for caching DOM controls

@class ControlCache
@constructor
*/
class ControlCache {
    constructor(parent) {
        this._controls = [];
        this.KEEP_IN_CACHE_TIMEOUT = 60000; // keep 60s in cache
        this.harbour = document.createElement('div');
        this.harbour.setAttribute('data-id', 'control-cache-harbour'); // just to find/identify it in dev tools
        parent.appendChild(this.harbour);
        setVisibilityFast(this.harbour, false);
    }
    add(id, control, initParams) {
        if (this.exists(id) && !control.controlClass.keepInCache) {
            // the same control is already cached
            this.get(id); // to get the previous control out from the cache (to be replaced by the newer -- to resolve #15927/item 3)
        }
        if (!window.settings || !control.controlClass)
            return;
        if ((!window.settings.disableCache && !control.controlClass.disableCache) || control.controlClass.keepInCache) {
            this._controls.push({
                id: id,
                control: control,
                initParams: initParams,
                timeStamp: Date.now()
            });
            this.harbour.appendChild(control);
            if (control.controlClass.resetState && (!initParams || !initParams.dontResetState))
                control.controlClass.resetState();
            control.controlClass.isInCache = true;
            ODS('ControlCache: ' + control.controlClass.constructor.name + ' | ' + control.controlClass.uniqueID + ' added, controls.count = ' + this._controls.length);
            setTimeout(this.clear.bind(this), this.KEEP_IN_CACHE_TIMEOUT);
        }
    }
    exists(id) {
        for (let i = 0; i < this._controls.length; i++) {
            if (this._controls[i].id == id)
                return true;
        }
        return false;
    }
    get(id) {
        for (let i = this._controls.length - 1; i >= 0; i--) {
            if (this._controls[i].id == id) {
                let control = this._controls[i].control;
                this._controls.splice(i, 1);
                if (control.controlClass.keepInCache)
                    continue;
                control.controlClass.isInCache = false;
                ODS('ControlCache: ' + control.controlClass.constructor.name + ' | ' + control.controlClass.uniqueID + ' used, controls.count = ' + this._controls.length);
                return control;
            }
        }
        return null;
    }
    clear() {
        for (let i = this._controls.length - 1; i >= 0; i--) {
            if (this._controls[i].timeStamp < (Date.now() - this.KEEP_IN_CACHE_TIMEOUT)) {
                let control = this._controls[i].control;
                if (control.controlClass.keepInCache)
                    continue;
                this._controls.splice(i, 1);
                ODS('ControlCache: ' + control.controlClass.constructor.name + ' | ' + control.controlClass.uniqueID + ' removed, controls.count = ' + this._controls.length);
                removeElement(control);
            }
        }
    }
    cleanUp() {
        let oldCount = this._controls.length;
        for (let i = this._controls.length - 1; i >= 0; i--) {
            let control = this._controls[i].control;
            this._controls.splice(i, 1);
            removeElement(control);
        }
        ODS('ControlCache: cleaned up, controls.count = ' + oldCount + ' --> ' + this._controls.length);
    }
}
registerClass(ControlCache);
