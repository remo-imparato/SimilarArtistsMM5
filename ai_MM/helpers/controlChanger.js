/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

/**
Helper for changing controlClass for given element with preserving data source, it can e.g. switch between two variants of displaying tracklist.

@class ControlChanger
@constructor
@param {HTMLElement} element Given element to be binded to
@param {Object} [controlParams] Initial parameters, to be passed to the controlClass during control initialization
*/

window.ControlChanger = function (div, controlParams) {
    this._activeControlName = '';
    this._div = div;
    this._controlParams = controlParams;
    this._viewSettings = [];
};

ControlChanger.prototype.cleanUp = function () {
    this.controlName = ''; // will clear active control
};

Object.defineProperty(ControlChanger.prototype,
    'dataSource', {
        get: function () {
            return (this._div && this._div.controlClass) ? this._div.controlClass.dataSource : null;
        },
        set: function (ds) {
            if (this._div && this._div.controlClass) {
                var oldAutoSort = true;
                if (ds) {
                    oldAutoSort = ds.autoSortDisabled;
                    ds.autoSortDisabled = true;
                    this._div.controlClass.autoSortString = ds.autoSortString;
                }

                this._div.controlClass.dataSource = ds;

                if (ds) {
                    ds.autoSortDisabled = oldAutoSort;
                }
            }
        }
    });

Object.defineProperty(ControlChanger.prototype,
    'controlParams', {
        get: function () {
            return this._controlParams;
        },
        set: function (val) {
            this._controlParams = val;
        }
    });
Object.defineProperty(ControlChanger.prototype,
    'controlName', {
        get: function () {
            return this._activeControlName;
        },
        set: function (cname) {
            if (cname === this._activeControlName)
                return;
            var ds = this.dataSource; // save, so we can reconnect dataSource to the new control
            var cc = this._div.controlClass;
            var scrollOffset = undefined;
            if (cc) {
                cc.storePersistentStates();
                if (cc.scrollingParent) {
                    scrollOffset = cc.scrollingParent.scrollTop; // save scroll position
                }
            };
            cleanElement(this._div);
            this._activeControlName = cname;
            if (cname) {
                this._div.setAttribute('data-control-class', cname);
                if (this._controlParams) {
                    this._div.setAttribute('data-init-params', JSON.stringify(this._controlParams));
                };
                initializeControl(this._div);
                this.dataSource = ds;
                cc = this._div.controlClass;
                if (cc) {
                    cc.restorePersistentStates();
                }
                if ((scrollOffset !== undefined) && cc && cc.scrollingParent) {
                    // force immediate draw, so we can correctly scroll with control height already set to original scroll position
                    if (cc.adjustSize)
                        cc.adjustSize();
                    if (cc.drawnow)
                        cc.drawnow();
                    cc.scrollingParent.scrollTop = scrollOffset;
                }
            }
        }
    });
