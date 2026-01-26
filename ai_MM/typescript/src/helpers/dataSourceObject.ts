'use strict';

registerFileImport('helpers/dataSourceObject');

import ObservableObject from './observableObject';

/**
DataSourceObject object, parent for data sources used in views

@class DataSourceObject
@constructor
@extends ObservableObject
*/

export default class DataSourceObject extends ObservableObject {
    cache: AnyDict;
    onlineData: any;
    wasError: boolean;
    private _progressControl: any;
    private _nextIndex: number;
    private _tasks: any[];
    private _counter: number;
    private _changeHandlerCounter: number;
    private _dataObject: any;
    private _refCounter: number;
    private _dataObjectChangeHandler: any;

    initialize(dObj, params?) {
        super.initialize(dObj, params);
        this.cache = {};
        this.onlineData = undefined;
        this.wasError = false;
        this._progressControl = undefined; // SimpleTasksController set by relevant subview, or DelayedProgress, if not set
        this._nextIndex = 0;
        this._tasks = [];
        this._counter = 0;
        this._changeHandlerCounter = 0;
        this._dataObject = undefined;
        this.dataObject = dObj;
        this._refCounter = 0;
    }
    
    addRef() {
        this._refCounter++;
    }
    
    release() {
        if(this._refCounter>0)
            this._refCounter--;
        if(this._refCounter === 0) {
            this.cancelDownloads();
            this.cleanUpPromises();
        }
    }
    
    beginTask(txt) {
        this._counter++;
        let id = this._nextIndex;
        this._nextIndex++;
        let pCid = this.progressCtrl.beginTask(txt);
        this._tasks[id] = {
            txt: txt,
            id: pCid
        };
        return id;
    }

    endTask(id) {
        assert(id !== undefined, 'DataSourceObject.endTask - missing id');
        let tsk = this._tasks[id];
        if (tsk) {
            if(this._progressControl)
                this.progressCtrl.endTask(tsk.id);
            this._tasks[id] = undefined;
        }
        if (this._counter > 0)
            this._counter--;

        if (this._counter === 0) {
            this._nextIndex = 0;
        } else {
            let i = this._nextIndex - 1;
            while (i >= 0) {
                if (this._tasks[i]) {
                    this._nextIndex = i + 1;
                    break;
                }
                i--;
            }
        }
    }

    moveProgressTasks(srcCtrl, destCtrl) {
        forEach(this._tasks, function (tsk, idx) {
            if (tsk) {
                srcCtrl.endTask(tsk.id);
                tsk.id = destCtrl.beginTask(tsk.txt);
            }
        });
    }

    registerChangeHandler() {
        this._changeHandlerCounter++;
        if (!this._dataObjectChangeHandler && this._dataObject) {
            this._dataObjectChangeHandler = app.listen(this._dataObject, 'change', function (eventType) {
                this.notifyChange({
                    senderID: this.uniqueID,
                    eventType: eventType || 'change',
                });
            }.bind(this));
        }
    }

    unregisterChangeHandler() {
        this._changeHandlerCounter--;
        if ((this._changeHandlerCounter === 0) && this._dataObject && this._dataObjectChangeHandler) {
            app.unlisten(this._dataObject, 'change', this._dataObjectChangeHandler);
            this._dataObjectChangeHandler = undefined;
        }
    }
    
    clearData() {
        this.cancelDownloads();
        this.cancelProgress();
        this.cleanUpPromises();
        this.cache = {};
        this.onlineData = undefined;        
    }
    
    cleanUp() {
        this.clearData();
        if (this._dataObject && this._dataObjectChangeHandler) {
            app.unlisten(this._dataObject, 'change', this._dataObjectChangeHandler);
            this._dataObjectChangeHandler = undefined;
        }
        this._nextIndex = 0;
        this._tasks = [];
        this._counter = 0;
        this._changeHandlerCounter = 0;
        super.cleanUp();
    }
    
    cancelProgress() {
        if (this._progressControl) {
            this._progressControl.cancel();
            this._progressControl = undefined;
        }
    }
    
    cancelDownloads() {
        uitools.getMusicBrainz().cancelDownloads(this.uniqueID);
    }    
    
    get progressCtrl () {
        if (!this._progressControl)
            this._progressControl = new DelayedProgress();
        return this._progressControl;
    }
    set progressCtrl (ctrl) {
        if (this._progressControl) {
            // move existing progress tasks to new progress control, if exists, otherwise move to general delayed progress
            if (!ctrl) {
                ctrl = new DelayedProgress();
            }
            this.moveProgressTasks(this._progressControl, ctrl);
        }
        this._progressControl = ctrl;
    }

    get dataObject () {
        return this._dataObject;
    }
    set dataObject (dObj) {
        if (this._dataObject && (this._dataObject !== dObj) && (!dObj || !this._dataObject.isSame(dObj))) {
            this.cleanUp();
        }
        this._dataObject = dObj;
    }
    
}
registerClass(DataSourceObject);
