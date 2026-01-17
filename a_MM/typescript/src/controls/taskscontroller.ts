/**
@module UI
*/

import Control from './control';
import ProgressBar from './progressbar';
import TooltipController from './tooltipController';

/**
UI tasksController element

@class TasksController
@constructor
@extends Control
*/

class TasksController extends Control {
    squeezeWindowContent: boolean;
    indicator: HTMLDivElement;
    _registeredTasks: AnyDict;
    detailsVisible: boolean;
    tasks: BackgroundTasks;
    bars: any[];
    _requestCheckVisibility: boolean;
    handleVisibility: procedure;
    handleIndicator: procedure;
    changed: procedure;
    checkContainer: procedure;
    getBar: procedure;
    addTask: (task) => void;
    handleDetails: (vis) => void;
    detailsContainer: Element;
    progressContainer: HTMLDivElement;
    removeBar: (taskId) => void;
    updateTask: (task) => void;

    initialize(parentEl, params) {
        super.initialize(parentEl, params);

        this.squeezeWindowContent = true; // can be modified by skins, see Material Design
        this.container = parentEl;
        this.container.classList.add('taskControllerIndicator');
        this.indicator = document.createElement('div');
        setVisibility(this.container, false);
        this.container.appendChild(this.indicator);
        this._registeredTasks = {};

        let detailsName = '';
        if (params && params.details)
            detailsName = params.details;

        let initDetailsContainer = function () {
            if (this.progressContainer) {
                this.progressContainer = undefined; // old one already removed from DOM
            }

            this.detailsContainer = undefined;
            if (detailsName) {
                this.detailsContainer = qid(detailsName);
            }
            if (!this.detailsContainer) {
                // Create a task container in case there isn't any specified in the skin
                this.detailsContainer = document.createElement('div');
                this.detailsContainer.setAttribute('data-id', 'progressContainer');
                this.detailsContainer.style.position = 'fixed';
                this.detailsContainer.style.bottom = 0;
                this.detailsContainer.style.left = 0;
                this.detailsContainer.style.right = 0;
                this.detailsContainer.style.zIndex = 100000;
                document.body.appendChild(this.detailsContainer);
            }
        }.bind(this);

        initDetailsContainer();

        this.localListen(window, 'dockschanged', function () {
            if (!this.detailsContainer || !isChildOf(document.documentElement, this.detailsContainer))
                initDetailsContainer();
        }.bind(this));

        this.progressContainer = undefined;

        this.detailsVisible = true; // make progress bar on player always visible (per #15497 - item 3)
        this.bars = [];

        this.tasks = app.backgroundTasks;
        this._requestCheckVisibility = true; // LS: needed e.g. after skin change -- to show already running progress tasks
        let control = this;

        for (let key in params) {
            this[key] = params[key];
        }

        let mytipdiv = undefined;
        let tipbars = [];
        
        control.contextMenu = new Menu([{
            title: _('Cancel all'),
            visible: function () {
                return control.tasks && control.tasks.getVisibleCount() > 0;
            },
            execute: function () {
                ODS('Terminating all current tasks');
                control.tasks.locked(function () {
                    // Don't terminate while in loop; crashes as described in #18530
                    let tasksToCancel = [];
                    for (let i = 0; i < control.tasks.count; i++) {
                        let task = control.tasks.getValue(i);
                        if (task.hidden)
                            ODS('Not terminating task ' + task.id);
                        else
                            tasksToCancel.push(task);
                    }
                    for (let task of tasksToCancel) {
                        ODS('Terminating task ' + task.id);
                        task.terminate();
                    }
                });
            }
        }]);
        
        let loadIndicator = function () {
            if (!this._loading && !this._loaded) {
                this._loading = true;
                loadIconFast('progress', function (icon) {
                    if (this._visible) {
                        setIconFast(this.indicator, icon);
                        this._loaded = true;
                        this._loading = false;
                    } else {
                        this._loaded = false;
                        this._loading = false;
                    }
                }.bind(this));
            }
        }.bind(this);

        let releaseIndicator = function () {
            if (this._loaded) {
                this.indicator.innerHTML = '';
                this._loaded = false;
                this._loading = false;
            }
        }.bind(this);

        let getTipBar = function (id) {
            for (let a = 0; a < tipbars.length; a++) {
                if (tipbars[a].id == id) {
                    return tipbars[a].ctrl;
                }
            }
            return undefined;
        };
        let addTipTask = function (task) {
            if (!mytipdiv)
                return;
            let ctrl = document.createElement('div');
            ctrl.style.minWidth = '290px';
            mytipdiv.appendChild(ctrl);
            ctrl.controlClass = new ProgressBar(ctrl, {
                transition: true
            });
            tipbars.push({
                id: task.id,
                ctrl: ctrl
            });

            return ctrl;
        };
        let updateTipTask = function (task) {
            if (mytipdiv) {
                let bar = getTipBar(task.id);
                if (!bar) { // bar not exists, add new
                    bar = addTipTask(task);
                }

                bar.controlClass.value = task.value;
                bar.controlClass.text = task.text;
                if (window.tooltipDiv && window.tooltipDiv.controlClass)
                    (window.tooltipDiv.controlClass as TooltipController).notifyContentChange();
            }
        };

        let removeTipBar = function (id) {
            if (mytipdiv) {
                for (let a = 0; a < tipbars.length; a++) {
                    if (tipbars[a].id == id) {
                        mytipdiv.removeChild(tipbars[a].ctrl);
                        tipbars.splice(a, 1);
                        break;
                    }
                }
                if (window.tooltipDiv && window.tooltipDiv.controlClass)
                    (window.tooltipDiv.controlClass  as TooltipController).notifyContentChange();
            }
        };

        let valueCallback = function (tipdiv, vis) {
            if (!vis) {
                // hided, clear all
                if (mytipdiv) {
                    cleanElement(mytipdiv);
                    if (tipdiv) {
                        if (tipdiv.contains(mytipdiv))
                            tipdiv.removeChild(mytipdiv);
                        mytipdiv = undefined;
                        tipbars = [];
                    }
                }
                return;
            }
            if (!mytipdiv) {
                mytipdiv = document.createElement('div');
                tipdiv.innerText = ''; // clean previous content
                tipdiv.appendChild(mytipdiv);
                this.tasks.locked(function () {
                    for (let a = 0; a < this.tasks.count; a++) {
                        let task = this.tasks.getValue(a);
                        if (!task.hidden)
                            updateTipTask(task);
                    }
                }.bind(this));
            }
        }.bind(this);

        this.handleVisibility = function () {
            this.requestTimeout(() => {
                if (this._cleanUpCalled) return;
                let vis = this.tasks.getVisibleCount() > 0;
                this._visible = vis;
                if (vis) {
                    loadIndicator();
                } else {
                    releaseIndicator();
                }
                setVisibility(this.container, vis);
            }, 100, 'handleVisibility');
        }.bind(this);

        this.handleIndicator = function () {
            this.requestTimeout(() => {
                if (this._cleanUpCalled) return;
                let vis = this.tasks.getVisibleCount() > 0;
                if (vis) {
                    if (control.container.tooltipValueCallback === undefined)
                        control.container.tooltipValueCallback = valueCallback;
                } else {
                    if (control.container.tooltipValueCallback !== undefined)
                        control.container.tooltipValueCallback = undefined;
                }
                this.handleDetails(this.detailsVisible);
            }, 100, 'handleIndicator');
        }.bind(this);

        this.changed = function (cmd, task) {
            //            if(cmd !== 'unregistered')
            //                ODS('backgroundTasks - onChanged event ' + cmd + ' called for task ' + task.id + ' ' + task.taskType + ' with text ' + task.text + ' and value ' + task.value);
            let checkVisibility = false;
            if (cmd == 'registered') {
                if (!this._registeredTasks[task.id]) {
                    this._registeredTasks[task.id] = true;
                    control.addTask(task);
                    updateTipTask(task);
                    checkVisibility = true;
                    ODS('registered task progress  ' + task.id);
                }
            } else
            if (cmd == 'unregistered') {
                let task_id = task; // when unregistered, id is returned in task parameter
                this._registeredTasks[task_id] = undefined;
                control.removeBar(task_id);
                removeTipBar(task_id);
                checkVisibility = true;
                ODS('unregistered task progress  ' + task_id);
            } else
            if (cmd == 'textchanged') {
                control.updateTask(task);
                updateTipTask(task);
            } else
            if (cmd == 'progresschanged') {
                control.updateTask(task);
                updateTipTask(task);
            } else
            if (cmd == 'descriptionchanged') {
                control.updateTask(task);
                updateTipTask(task);
            }

            if (checkVisibility || this._requestCheckVisibility) {
                control.handleVisibility();
                control.handleIndicator();
                this._requestCheckVisibility = false;
            }
        }.bind(this);
        this.localListen(this.tasks, 'changed', this.changed);

        this.checkContainer = function () {
            if (!this.progressContainer && this.detailsContainer) { // we need to create container and bars
                this.progressContainer = document.createElement('div');
                this.progressContainer.className = 'progressContainer flex row';
                if(this.detailsContainer !== undefined)
                    this.detailsContainer.appendChild(this.progressContainer);
            }
        }.bind(this);

        this.getBar = function (id) {
            for (let a = 0; a < this.bars.length; a++) {
                if (this.bars[a].id == id) {
                    return this.bars[a].ctrl;
                }
            }
            return undefined;
        }.bind(this);

        this.addTask = function (task) {
            let ctrl = undefined;
            if (this.progressContainer) {
                ctrl = document.createElement('div');
                this.progressContainer.appendChild(ctrl);
                ctrl.controlClass = new ProgressBar(ctrl, {
                    transition: true,
                    grow: 1
                });
                this.bars.push({
                    id: task.id,
                    ctrl: ctrl
                });
                ctrl.controlClass.contextMenu = new Menu([{
                    title: _('Cancel'),
                    execute: function () {
                        this.terminate();
                    }.bind(task)
                }]);
                setVisibility(ctrl, false, {
                    animate: false
                });
                
                if (resolveToValue(this.squeezeWindowContent)) {
                    // #18530 Push the rest of the window content up slightly, so that it does not interfere with the task progress bar
                    this.requestTimeout(function () {
                        if (control.progressContainer && control.tasks.getVisibleCount() > 0 && window.hasBeenShown) {
                            let rect = control.progressContainer.getBoundingClientRect();
                            document.getElementById('windowcontent').style.bottom = rect.height.toString();
                        }
                    }, 150, 'squeezeWindowContent');
                }
            }

            return ctrl;
        }.bind(this);

        this.updateTask = function (task) {
            if (this.detailsVisible) {
                this.checkContainer();
                let bar = this.getBar(task.id);
                if (!bar && this._registeredTasks[task.id]) {
                    bar = this.addTask(task);
                }
                if (bar && bar.controlClass) {
                    bar.controlClass.value = task.value;
                    bar.controlClass.text = task.text;
                    setVisibilityFast(bar, task.value || task.text);
                }
            }
        }.bind(this);

        this.removeBar = function (id) {
            for (let a = 0; a < this.bars.length; a++) {
                if (this.bars[a].id == id) {
                    this.bars[a].ctrl.remove();
                    this.bars.splice(a, 1);
                    if (this.detailsVisible)
                        notifyLayoutChange();
                    break;
                }
            }
            if (this.bars.length == 0) {
                this.handleDetails(false); // hide container (but do not change detailsVisible)
            }
            document.getElementById('windowcontent').style.bottom = ''; // Clear the window content squeeze (Always do, in case this.squeezeWindowContent changes)
        }.bind(this);

        this.handleDetails = function (vis) {
            if (this.detailsContainer) {
                if (vis) {
                    this.checkContainer();
                    this.detailsContainer.style.display = '';
                } else {
                    this.detailsContainer.style.display = 'none';
                    if (this.progressContainer) {
                        removeElement(this.progressContainer);
                        this.progressContainer = undefined;
                    }
                }
            }
        }.bind(this);

        /* // LS: make progress bar on player always visible (per #15497 - item 3)        
        this.localListen(this.indicator, 'click', function () {
            this.detailsVisible = !this.detailsVisible;
            this.handleDetails(this.detailsVisible);
            if (this.detailsVisible) {
                this.tasks.locked(function () {
                    for (var a = 0; a < this.tasks.count; a++) {
                        this.updateTask(this.tasks.getValue(a));
                    }
                }.bind(this));
            } else {
                this.bars.length = 0;
            }
        }.bind(this), false);
        */
    }

    cleanUp() {
        super.cleanUp();
        this.handleDetails(false);
        if (this.detailsContainer)
            removeElement(this.detailsContainer);
        this.detailsContainer = undefined;
        this.progressContainer = undefined;
    }

    saveState(fromObject) {
        // redefined to not save visible state it is not desired for this control
    }

    restoreState(fromObject) {
        // redefined to not restore visible state it is not desired for this control
    }

    storePersistentState() {
        let state = {
            detailsVisible: this.detailsVisible
        };
        return state;
    }

    restorePersistentState(state) {
        // LS: make progress bar on player always visible (per #15497 - item 3)
        this.detailsVisible = true; // !!state.detailsVisible;
    }

}
registerClass(TasksController);
