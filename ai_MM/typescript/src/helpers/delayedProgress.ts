'use strict';

class DelayedProgress {
    delayMS: number;
    private _taskProgress: any;
    private _text: string;
    private _value: any;
    private _delayTimer: any;
    private _closeTimer: any;
    private _counter: number;
    private _nextIndex: number;
    private _tasks: any[];

    constructor(delayMS?:number) {
        this.delayMS = delayMS || 500; // default delay 500ms
        this._taskProgress = undefined;
        this._text = '';
        this._value = undefined;
        this._delayTimer = undefined;
        this._closeTimer = undefined;
        this._counter = 0;
        this._nextIndex = 0;
        this._tasks = [];
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
        if (this._taskProgress) {
            this._taskProgress.terminate();
            this._taskProgress = undefined;
        }
        this._text = '';
    }

    beginTask(txt) {
        this._counter++;
        this.text = txt;
        let id = this._nextIndex;
        this._tasks[id] = txt;
        ODS('beginTask ' + id + ': ' + txt);
        this._nextIndex++;
        if (this._closeTimer) {
            clearTimeout(this._closeTimer);
            this._closeTimer = undefined;
        }
        if ((this._counter === 1) && (!this._delayTimer)) {
            this._delayTimer = setTimeout(function () {
                this._delayTimer = undefined;
                if (!this._taskProgress) {
                    this._taskProgress = app.backgroundTasks.createNew();
                }
                this._taskProgress.leadingText = this._text;
                if (this._value !== undefined)
                    this._taskProgress.value = this._value;
            }.bind(this), this.delayMS);
        }
        return id;
    }

    endTask(id) {
        assert(id !== undefined, 'DelayedProgress.endTask - missing id');
        ODS('endTask ' + id + ': ' + this._tasks[id]);
        this._tasks[id] = undefined;
        if (this._counter > 0)
            this._counter--;

        if (this._counter === 0) {
            this._nextIndex = 0;
            this._closeTimer = setTimeout(function () {
                this._closeTimer = undefined;
                this._cancelProgress();
            }.bind(this), 50);
        } else {
            let i = this._nextIndex - 1;
            while (i >= 0) {
                if (this._tasks[i]) {
                    this.text = this._tasks[i];
                    this._nextIndex = i + 1;
                    break;
                }
                i--;
            }
        }
    }

    cancel() {
        this._counter = 0;
        this._nextIndex = 0;
        this._tasks = [];
        this._cancelProgress();
    }

    get text() {
        return this._text;
    }
    set text(val) {
        this._text = val;
        if (this._taskProgress && !this._taskProgress.terminated)
            this._taskProgress.leadingText = val;
    }

    get value() {
        return this._value;
    }
    set value(val) {
        this._value = val;
        if (this._taskProgress && !this._taskProgress.terminated)
            this._taskProgress.value = val;
    }
}
registerClass(DelayedProgress);