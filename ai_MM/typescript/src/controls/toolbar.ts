'use strict';

/**
@module UI
*/

import Control from './control';
import MenuButton from './menuButton';

/**
UI Toolbar element.
    
@class Toolbar
@constructor
@extends Control
*/
class Toolbar extends Control {
    groupDivs: AnyDict;
    actionsStacks: AnyDict;
    actionButtons: CustomElement[];
    separatorWidth: number;
    linkedElement: Element;
    lastMinWidth: number;
    linkedElementID: string;
    rightElement: HTMLElement;
    private _actionsIdentAssigned: boolean;
    rightElementID: string;

    initialize(elem, params) {
        super.initialize(elem, params);
        this.container.classList.add('flex');
        this.container.classList.add('row');
        this.groupDivs = {};
        this.actionsStacks = {};
        this.actionButtons = [];
        this.separatorWidth = 0;
        this.helpContext = 'Filelisting';
        this.tabIndex = -1;

        // read existing groups
        let groups = qeclass(this.container, 'toolbar');
        let groupName;
        for (let i = 0; i < groups.length; i++) {
            groupName = groups[i].getAttribute('data-id');
            if (groupName) {
                this.groupDivs[groupName] = groups[i];
            }
        }

        // set passed attributes
        for (let key in params) {
            this[key] = params[key];
        }

        if (this.linkedElementID && this.rightElementID) {
            // we have placing linked to linkedElement (e.g. mainview),
            // set min-width of rightElement, so that the left side of this control will be aligned with right side of linkedElement
            this.linkedElement = qid(this.linkedElementID);
            this.rightElement = qeid(elem.parentElement, this.rightElementID);
            this.lastMinWidth = 0;
            if (this.linkedElement && this.rightElement) {
                this.localListen(this.linkedElement.parentNode, 'layoutchange', this.linkedLayoutChange.bind(this));
                this.localListen(this.rightElement.parentNode, 'layoutchange', this.linkedLayoutChange.bind(this));
                this.linkedLayoutChange(); // initial set
            }
        }
    }

    linkedLayoutChange() {
        let _this = this;
        this.requestFrame(function () { // #18551
            let linkedRect = _this.linkedElement.getBoundingClientRect();
            let rightRect = _this.rightElement.getBoundingClientRect();
            let minWidth = Math.max(Math.floor(rightRect.right - linkedRect.right) - _this.separatorWidth, 0);
            ODS('linkedLayoutChange: minWidth=' + minWidth + ', _this.lastMinWidth:' + _this.lastMinWidth);
            if (Math.abs(minWidth - _this.lastMinWidth) > 2) { // it happened in #20983 that minWidth - lastMinWidth was still 1px diff when in full screen mode
                _this.lastMinWidth = minWidth;                 // which caused linkedLayoutChange to be called infinetly (resulting in high CPU usage while in full screen)
                applyStylingAfterFrame(() => {
                    if (minWidth > 0) {
                        _this.rightElement.style.minWidth = minWidth + 'px';
                    } else {
                        _this.rightElement.style.minWidth = '';
                    } 
                });
                // LS: when the window is being minimized the window width is decreased gradually/slowly, so initiate next call until the (_this.lastMinWidth == minWidth) - issue #18485:
                _this.linkedLayoutChange();
            }
        }, 'adjustToolbarElements');
    }

    _hideIfNothingVisible(gdiv) {
        let btns = this.actionButtons;
        let vis = false;
        let groupName = gdiv.getAttribute('data-id');
        for (let i = 0; i < btns.length; i++) {
            if ((btns[i].getAttribute('data-group') === groupName) && (isVisible(btns[i], false /*no parents*/ ))) {
                vis = true;
                break;
            }
        }
        if (!vis) {
            setVisibility(gdiv, false);
        }
    }

    cleanUp() {
        this.linkedElement = undefined;
        this.rightElement = undefined;
        super.cleanUp();
    }

    /**
    Show toolbutton for the specified action(s) on the toolbar

    @method showActions
    @param {Object} ids ID of the action (e.g. actions.trackBrowser) or array of IDs
    */
    showActions(ids, params) {
        if (ids === undefined)
            return;

        params = params || {};
        params.fromToolbar = true;
        let usedGroups = {};
        let usedStacks = {};
        let usedMenuButtons = {};
        let _this = this;

        let showOneAction = function (id) {
            let isvisible = resolveToValue(id.visible, true, params);
            if (isPromise(isvisible)) {
                isvisible = true; // TODO: implement correct functionality for Promises, if needed
            } else {
                if (!isvisible)
                    return;
            }
            let idSt = undefined;
            if (id.actionStack) {
                if (!this.actionsStacks[id.actionStack]) {
                    this.actionsStacks[id.actionStack] = {
                        ids: [id],
                        flags: []
                    };
                } else {
                    if (!this.actionsStacks[id.actionStack].flags[id.identifier]) {
                        this.actionsStacks[id.actionStack].ids.push(id);
                    }
                }
                this.actionsStacks[id.actionStack].flags[id.identifier] = true;
                idSt = id;
                id = actions[idSt.actionStack];
                let checked = resolveToValue(idSt.checked, false, null, idSt);
                if (checked && !idSt.noStackLead) {
                    id.title = idSt.title;
                    id.icon = idSt.icon;
                }
                if (this.actionsStacks[idSt.actionStack].ids.length < 2) {
                    return;
                } else {
                    usedStacks[idSt.actionStack] = true;
                }

            }
            let groupName = id.actionGroup || 'general';

            // find group, create if not exists
            let gdiv = this.groupDivs[groupName];
            if (!gdiv) {
                gdiv = document.createElement('div');
                gdiv.classList.add('toolbar');
                gdiv.setAttribute('data-id', groupName);
                let hr = document.createElement('hr');
                hr.style.order = '999'; // separator should be the last
                this.container.appendChild(gdiv);
                gdiv.appendChild(hr);
                if (groupName == 'view')
                    gdiv.style.order = 99999; // we want all view related actions to be right most (#13454 - item 3)
                else
                    gdiv.style.order = 1;
                this.groupDivs[groupName] = gdiv;
                if (!this.separatorWidth) {
                    this.separatorWidth = getFullWidth(hr);
                    if (this.linkedElement && this.rightElement)
                        this.linkedLayoutChange();
                }
            }
            setVisibility(gdiv, true);

            // find button, create if not exists
            if (!id.identifier)
                this.checkActionsIdentAssigned();

            let abtn = qeid(gdiv, 'tbtn_' + id.identifier) as CustomElement;
            if (!abtn) {
                assert(!!id.identifier, 'Missing action identifier for ' + resolveToValue(id.title, 'unknown'));
                abtn = document.createElement('div');
                abtn.setAttribute('data-id', 'tbtn_' + id.identifier);
                if (id.submenu && !id.controlClass) {
                    id.controlClass = 'MenuButton';
                    abtn.setAttribute('data-icon', resolveToValue(id.icon, 'menu'));
                }

                if (id.controlClass) {
                    abtn.setAttribute('data-control-class', id.controlClass);
                } else {
                    abtn.classList.add('toolbutton');
                }
                if (id.initParams) {
                    abtn.setAttribute('data-init-params', id.initParams);
                }
                if (id.execute) {
                    this.localListen(abtn, 'click', function (e) {
                        id.execute((abtn.currentParams ? abtn.currentParams.parent : undefined));
                        if (id.afterExecute)
                            id.afterExecute(_this, abtn);
                    });
                }
                abtn.style.order = (id.iconPriority === undefined) ? 1 : id.iconPriority;
                abtn.setAttribute('data-group', groupName);
                gdiv.appendChild(abtn);
                initializeControl(abtn);
                if (id.submenu)
                    abtn.controlClass.menuArray = id.submenu;

                this.actionButtons.push(abtn);
            }
            if (abtn.controlClass) { // #15866
                (abtn.controlClass as MenuButton).oppositeX = true;
                abtn.controlClass.tabIndex = -1; // allow focus, needed for F1
            } else 
                abtn.tabIndex = -1; // allow focus, needed for F1
            abtn.currentParams = params;
            this.updateActionButton(abtn, id);

            if (!id.actionStack) {
                let checkedHandler = function () {
                    if (abtn) {
                        let check = resolveToValue(id.checked, false, id);
                        if (check)
                            abtn.setAttribute('data-checked', check);
                        else
                            abtn.removeAttribute('data-checked');
                    }
                };
                id.checkedHandler = checkedHandler;
                checkedHandler();
            }
            if (idSt) {
                usedMenuButtons[idSt.actionStack] = abtn;
            }
            usedGroups[groupName] = gdiv;

            clearTimeout(abtn._toBeHiddenTmOut);
            setVisibility(abtn, true);

        }.bind(this);

        if (isArray(ids)) {
            ids.forEach(showOneAction);
            this.hideUnusedStackActions(ids, usedStacks); // #18171        
        } else {
            showOneAction(ids);
        }
        for (let gn in usedGroups) {
            initializeControls(usedGroups[gn]);
        }
        for (let b in usedMenuButtons) {
            if (usedMenuButtons[b].controlClass) {
                let ma = [];
                this.actionsStacks[b].ids.forEach(function (id) {
                    ma.push(id);
                });
                usedMenuButtons[b].controlClass.menuArray = ma;
            }
        }
    }

    checkActionsIdentAssigned() {
        if (!this._actionsIdentAssigned) {
            for (let id in actions) {
                if (!actions[id].identifier)
                    actions[id].identifier = id;
            }
            this._actionsIdentAssigned = true;
        }
    }

    hideUnusedStackActions(_actions, usedStacks) {
        let usedActions = {};
        _actions.forEach((act) => {
            usedActions[act.identifier] = true;
        });

        let _hideActions = [];
        for (let stack_id in usedStacks) {
            let st = this.actionsStacks[stack_id];
            st.ids.forEach((act) => {
                if (act.identifier && !usedActions[act.identifier]) {
                    ODS('Toolbar: clean unused action: ' + resolveToValue(act.title, 'unknown'));
                    _hideActions.push(act);
                }
            });
        }
        this.hideActions(_hideActions);
    }

    updateActionButton(abtn, id) {

        // update data-tip
        if (id.title)
            abtn.setAttribute('data-tip', uitools.getPureTitle(id.title));

        // update data-help
        if (id.helpContext)
            abtn.setAttribute('data-help', resolveToValue(id.helpContext, ''));

        // update icon 
        if (id.icon && (resolveToValue(id.icon, '', null, id) != abtn.loadedIcon)) {
            abtn.loadedIcon = resolveToValue(id.icon, '', null, id);
            if (id.controlClass) {
                assert(abtn.controlClass, 'controlClass not initialized');
                abtn.controlClass.icon = resolveToValue(id.icon, '', null, id);
            } else {
                let iconLoader = function (iconName) {
                    loadIcon(iconName, function (iconData) {
                        abtn.innerHTML = iconData;
                        if (id.title) setIconAriaLabel(abtn, uitools.getPureTitle(id.title)); // Give it a screen reader label from the tooltip
                    });
                };
                iconLoader(resolveToValue(id.icon, '', null, id));

                if (!abtn.hasAttribute('data-actionchangelisten')) {
                    abtn.setAttribute('data-actionchangelisten', '1');

                    this.localListen(abtn, 'actionchange', function (e) {
                        if (e.detail.action == id) {
                            iconLoader(resolveToValue(id.icon, '', null, id));
                            abtn.setAttribute('data-tip', uitools.getPureTitle(id.title));
                        }
                    });
                }
            }
        }
    }

    updateStackLeadButton(stackID, title, icon) {
        let stack = actions[stackID];
        stack.title = title;
        stack.icon = icon;
        let gdiv = this.groupDivs[stack.actionGroup];
        if (gdiv) {
            let abtn = qeid(gdiv, 'tbtn_' + stack.identifier);
            this.updateActionButton(abtn, stack);
        }
    }

    /**
    Hide toolbutton(s) for the specified action(s) on the toolbar

    @method hideActions
    @param {Object} ids ID of the action (e.g. actions.trackBrowser) or array of IDs
    */
    hideActions(ids) {
        if ((ids === undefined) || (window._cleanUpCalled)) // do not process during shutdown, could lead to error
            return;
        let usedStacks = {};
        let hideOneAction = function (id) {
            if (id.actionStack) {
                let st = this.actionsStacks[id.actionStack];
                if (st) {
                    if (st.flags[id.identifier]) {
                        for (let i = 0; i < st.ids.length; i++) {
                            if (st.ids[i].identifier == id.identifier) {
                                st.ids.splice(i, 1);
                                break;
                            }
                        }
                        let wasChecked = resolveToValue(id.checked, false, null, id);
                        if (wasChecked) {
                            // this action was removed as checked in the stack, we need to find whether there is another checked action to update the leading icon/title
                            for (let i = 0; i < st.ids.length; i++) {
                                let idSt = st.ids[i];
                                if (resolveToValue(idSt.checked, false, null, idSt) && !idSt.noStackLead) {
                                    this.updateStackLeadButton(id.actionStack, idSt.title, idSt.icon);
                                    break;
                                }
                            }
                        }
                        st.ids = window.menus.eliminateSeparators(st.ids);
                        st.flags[id.identifier] = undefined;
                    }
                    if (st.ids.length < 2) {
                        usedStacks[id.actionStack] = undefined; // hiding, no need to reset menu array
                        id = actions[id.actionStack];
                    } else {
                        usedStacks[id.actionStack] = true;
                        return;
                    }
                }
            }
            let groupName = id.actionGroup || 'general';
            let gdiv = this.groupDivs[groupName];
            if (gdiv) {
                let abtn = qeid(gdiv, 'tbtn_' + id.identifier) as CustomElement;
                if (abtn) {
                    clearTimeout(abtn._toBeHiddenTmOut);

                    let hideBtn = function () {
                        if (!this._cleanUpCalled) {
                            setVisibility(abtn, false);
                            this._hideIfNothingVisible(gdiv);
                        }
                    }.bind(this);

                    if (id.immediateHide) {
                        hideBtn();
                    } else {
                        abtn._toBeHiddenTmOut = setTimeout(function () {
                            // to not blink when this button is shown/hidden too often
                            hideBtn();
                        }.bind(this), 50);
                    }
                }
            }
            id.checkedHandler = undefined;
        }.bind(this);

        if (isArray(ids)) {
            ids.forEach(hideOneAction);
        } else {
            hideOneAction(ids);
        }
        for (let as in usedStacks) {
            let st = this.actionsStacks[as];
            let id = actions[as];
            if (st && id) {
                let ma = [];
                st.ids.forEach(function (id) {
                    ma.push(id);
                });
                let groupName = id.actionGroup || 'general';
                let gdiv = this.groupDivs[groupName];
                if (gdiv) {
                    let abtn = qeid(gdiv, 'tbtn_' + id.identifier);
                    if (abtn && abtn.controlClass) {
                        abtn.controlClass.menuArray = ma;
                    }
                }
            }
        }
    }

}
registerClass(Toolbar);
