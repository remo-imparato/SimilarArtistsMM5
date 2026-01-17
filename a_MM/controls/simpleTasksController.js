/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

registerFileImport('controls/simpleTaskController');
/**
@module UI
*/
import Control from './control';
/**
UI SimpleTasksController element

@class TasksController
@constructor
@extends Control
*/
class SimpleTasksController extends Control {
    initialize(parentEl, params) {
        super.initialize(parentEl, params);
        this.indicator = document.createElement('div');
        setVisibility(this.container, false);
        this.container.appendChild(this.indicator);
        this._taskTitles = [];
        this.delayMS = 0;
        this._counter = 0;
        this._nextIndex = 0;
        this._delayTimer = undefined;
        this._closeTimer = undefined;
        this._mytipdiv = undefined;
        for (let key in params) {
            this[key] = params[key];
        }
        this.container.tooltipValueCallback = function (tipdiv, vis) {
            if (!vis) {
                // hided, clear all
                if (this._mytipdiv) {
                    cleanElement(this._mytipdiv);
                    if (tipdiv) {
                        if (tipdiv.contains(this._mytipdiv))
                            tipdiv.removeChild(this._mytipdiv);
                        this._mytipdiv = undefined;
                    }
                }
                return;
            }
            if (!this._mytipdiv) {
                this._mytipdiv = document.createElement('div');
                tipdiv.innerText = ''; // clean previous content
                tipdiv.appendChild(this._mytipdiv);
            }
            this.updateTooltipValue();
        }.bind(this);
    }
    updateTooltipValue(callNotify) {
        let txt = '';
        forEach(this._taskTitles, function (ttl /*, idx*/) {
            if (ttl) {
                if (txt)
                    txt += '<br>';
                txt += ttl;
            }
        });
        if (this._mytipdiv) {
            this._mytipdiv.innerHTML = txt;
            if (callNotify && window.tooltipDiv && window.tooltipDiv.controlClass) //@ts-ignore
                window.tooltipDiv.controlClass.notifyContentChange();
        }
    }
    _cancelProgress() {
        if (this._delayTimer) {
            clearTimeout(this._delayTimer);
            this._delayTimer = undefined;
        }
        if (this._closeTimer) {
            clearTimeout(this._closeTimer);
            this._closeTimer = undefined;
        }
    }
    cancel() {
        this._counter = 0;
        this._nextIndex = 0;
        this._taskTitles = [];
        this._cancelProgress();
        this.setVisibility(false);
    }
    beginTask(txt) {
        this._counter++;
        let id = this._nextIndex;
        this._taskTitles[id] = txt;
        ODS('beginSimpleTask ' + id + ': ' + txt);
        this._nextIndex++;
        if (this._closeTimer) {
            clearTimeout(this._closeTimer);
            this._closeTimer = undefined;
        }
        if ((this._counter === 1) && (this.delayMS > 0) && (!this._delayTimer)) {
            this._delayTimer = this.requestTimeout(function () {
                this._delayTimer = undefined;
                if (this._counter > 0)
                    this.setVisibility(true);
            }.bind(this), this.delayMS);
        }
        else
            this.updateTooltipValue(true);
        return id;
    }
    endTask(id) {
        assert(id !== undefined, 'SimpleTaskController.endTask - missing id');
        ODS('endSimpleTask ' + id + ': ' + this._taskTitles[id]);
        this._taskTitles[id] = undefined;
        if (this._counter > 0)
            this._counter--;
        if (this._counter === 0) {
            this._nextIndex = 0;
            this._closeTimer = this.requestTimeout(function () {
                this._closeTimer = undefined;
                if (this._counter === 0)
                    this.setVisibility(false);
            }.bind(this), 50);
        }
        else {
            let i = this._nextIndex - 1;
            while (i >= 0) {
                if (this._taskTitles[i]) {
                    this._nextIndex = i + 1;
                    break;
                }
                i--;
            }
            this.updateTooltipValue();
        }
    }
    storeState() {
        // redefined to not save visible state it is not desired for this control
        return {};
    }
    restoreState( /*state*/) {
        // redefined to not restore visible state it is not desired for this control
    }
    storePersistentState() {
        return {};
    }
    restorePersistentState( /*state*/) {
        // redefined to not restore visible state it is not desired for this control
    }
    setVisibility(vis) {
        // we need to remove indicator from DOM, Chromium animates it even if not displayed, #12956
        if (this._cleanUpCalled)
            return;
        this._visible = vis;
        if (vis) {
            if (!this._loading && !this._loaded) {
                this._loading = true;
                loadIconFast('progress', function (icon) {
                    if (this._visible) {
                        setIconFast(this.indicator, icon);
                        this._loaded = true;
                        this._loading = false;
                    }
                    else {
                        this._loaded = false;
                        this._loading = false;
                    }
                }.bind(this));
            }
        }
        else {
            if (this._loaded) {
                this.indicator.innerHTML = '';
                this._loaded = false;
                this._loading = false;
            }
        }
        setVisibility(this.container, vis);
    }
}
registerClass(SimpleTasksController);
