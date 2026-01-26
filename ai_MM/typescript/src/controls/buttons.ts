'use strict';

registerFileImport('controls/buttons');

import Control from './control';
import Button from './button';
import MenuButton from './menuButton';

/**
 * UI Buttons element.
 * 
 * Supported standard button ids: `btnYes`, `btnNo`, `btnOK`, `btnCancel`, `btnAbort`, `btnRetry`, `btnIgnore`, `btnAll`, `btnNoToAll`, `btnYesToAll`, `btnHelp`, `btnClose`.
 * 
 * Supported button's custom attributes:
 *  - `data-default`: make button default
 *  - `data-position`: aligning of button, possible values: "opposite"
 *  - `data-no-close`: suppress default cancel button action
 *  - `data-no-button`: does not make button from the contents of the div
 *  - `data-esc`: this button is automatically pressed on ESC key, use only if no other Cancel button is present (btnCancel, btnAbort, btnClose). It closes dialog window, if not used with data-no-close.
 * @example
 *  <div id='testButtons' data-control-class="Buttons">
 *      <div id='btnOK' data-default='1'></div>
 *      <div id='someCustomBtn' data-position='opposite'>Custom caption</div>
 *      <div id='btnCancel'></div>
 *  </div>
 */
export default class Buttons extends Control {
    position: string;
    orientation: string;
    samewidth: boolean;
    leftTopDiv: HTMLDivElement;
    fillerDiv: HTMLDivElement;
    rightBottomDiv: HTMLDivElement;
    oppositeButtons: HTMLDivElement[];
    buttons: HTMLDivElement[];
    private _globalListenerSet: boolean;
    getKnownBtnType: (btnID: any) => any;
    setOrder: (btns:
        /**
        @module UI
        */
        any) => void;
    updateSameWidth: any;
    handleKeyDown: any;
    cancelBtn: any;

    initialize(elem: HTMLDivElement, params: AnyDict) {
        super.initialize(elem, params);
        /**
        Determines aligning of buttons. <br>
        Possible values:<br>
        'side' - buttons are aligned to the right and those with data-position attribute set to 'opposite' to the left.<br>
        'center' - all buttons are centered
        @property position
        @type string
        @default 'side'
        */
        this.position = 'side';

        /**
        Determines orientation of buttons. <br>
        Possible values:<br>
        'horizontal' - buttons are horizontally aligned.<br>
        'vertical' - buttons are vertically aligned
        @property orientation
        @type string
        @default 'horizontal'
        */
        this.orientation = 'horizontal';

        /* If true, all buttons will have the same width.
        @property samewidth
        @type boolean
        @default false
        */
        this.samewidth = false;

        this.defaultBtn = null;
        this.cancelBtn = null;
        this.oppositeButtons = [];
        this.buttons = [];
        this.container.classList.add('buttons');

        // set passed attributes
        for (let key in params) {
            this[key] = params[key];
        }

        this.container.classList.add(this.position);

        this.getKnownBtnType = function (btnID) {
            let retval = null;
            if (bIDs[btnID] !== undefined)
                retval = bIDs[btnID];
            return retval;
        };

        this.setOrder = function (btns) {
            let btmp = [];
            forEach(btns, function (btn) {
                if (btn.controlClass.priority !== 0)
                    btmp.push(btn);
            });
            for (let i = 0; i < btns.length; i++) {
                if (btns[i].controlClass.priority === 0) {
                    btns[i].style.order = i + 1;
                    if (btns[i].controlClass.isButton) {
                        btns[i].controlClass.tabIndex = 0;
                        /*                        if (btns[i].controlClass.isOpposite)
                            btns[i].controlClass.tabIndex = 100 + i;
                        else
                            btns[i].controlClass.tabIndex = 150 + i;*/
                    }

                } else {
                    let o = btmp[0];
                    for (let j = 1; j < btmp.length; j++) {
                        if (btns[j].controlClass.priority < o.controlClass.priority)
                            o = btmp[j];
                    }
                    o.style.order = i + 1;
                    if (btns[i].controlClass.isButton) {
                        o.controlClass.tabIndex = 0;
                        /*                        if (o.controlClass.isOpposite)
                            o.controlClass.tabIndex = 100 + i;
                        else
                            o.controlClass.tabIndex = 150 + i;*/
                    }

                    let idx = btmp.indexOf(o);
                    if (idx >= 0)
                        btmp.splice(idx, 1);
                }
            }
        };

        forEach(qetag(this.container, 'div'), function (btn) {
            if (!this.container.isSameNode(btn.parentNode))
                return;
            let btnid = btn.id || btn.getAttribute('data-id');
            let t = this.getKnownBtnType(btnid);
            btn.controlClass = new Button(btn);
            if (this.samewidth)
                btn.controlClass.buttonDiv.setAttribute('data-calc-width', true);     
            if (btn.controlClass.isButton) {
                if (btn.controlClass.textContent === '') {
                    if (t !== null) {
                        btn.controlClass.textContent = t.caption;
                    }
                }
                if (t !== null) {
                    btn.setAttribute('data-no-localize', 1); // known types are already localized            
                    btn.setAttribute('data-btype', t.type);
                    btn.controlClass.priority = t.priority;
                    this.preventClickingTwice(btn); // prevent only for known types, where we know for sure it is needed
                } else
                    btn.controlClass.priority = 0;
                this._checkCancelButton(t, btn);
            }
            btn.controlClass.isOpposite = btn.hasAttribute('data-position') && (btn.getAttribute('data-position') === 'opposite');

            if (btn.controlClass.isOpposite && (this.position !== 'center')) {
                this.oppositeButtons.push(btn);
            } else {
                this.buttons.push(btn);
            }
            if (btn.hasAttribute('data-default')) {
                this.defaultBtn = btn;
                this.checkGlobalListener();
            }
        }.bind(this));

        if (this.orientation === 'vertical')
            this.container.classList.add('vertical');
        else
            this.container.classList.add('horizontal');

        if (this.position !== 'center') {
            this.leftTopDiv = document.createElement('div');
            this.container.appendChild(this.leftTopDiv);
            this.fillerDiv = document.createElement('div');
            this.fillerDiv.classList.add('fill');
            this.container.appendChild(this.fillerDiv);
            this.rightBottomDiv = document.createElement('div');
            this.container.appendChild(this.rightBottomDiv);
            if (this.orientation === 'vertical') {
                this.leftTopDiv.classList.add('top');
                this.rightBottomDiv.classList.add('bottom');
            } else {
                this.leftTopDiv.classList.add('left');
                this.rightBottomDiv.classList.add('right');
            }
            if (this.oppositeButtons.length > 0) {
                forEach(this.oppositeButtons, function (btn) {
                    this.leftTopDiv.appendChild(btn);
                }.bind(this));
                this.setOrder(this.oppositeButtons);
            }
            if (this.buttons.length > 0) {
                forEach(this.buttons, function (btn) {
                    this.rightBottomDiv.appendChild(btn);
                }.bind(this));
                this.setOrder(this.buttons);
            }
        } else {
            this.setOrder(this.buttons);
        }

        this.updateSameWidth = function () {
            if (!this.samewidth)
                return;
            let maxw = 0;
            forEach(this.buttons, function (btn) {
                let w = btn.controlClass.width;
                if (w > maxw)
                    maxw = w;
            });
            forEach(this.oppositeButtons, function (btn) {
                let w = btn.controlClass.width;
                if (w > maxw)
                    maxw = w;
            });
            forEach(this.buttons, function (btn) {
                btn.controlClass.width = maxw;
            });
            forEach(this.oppositeButtons, function (btn) {
                btn.controlClass.width = maxw;
            });
            notifyLayoutChange();
        }.bind(this);

        this.updateSameWidth();

        this.handleKeyDown = function (event, isGlobal) {
            if (this.disabled) return;
            
            switch (friendlyKeyName(event)) {
            case 'Enter': 
                {
                    if (!event.ctrlKey) {
                    // check target and not close dialog, if it is e.g. HTMLTextareaElement
                        if (event.target && (event.target instanceof HTMLTextAreaElement)) {
                            return;
                        }
                    }
                    let b;
                    if ((event.target && event.target.classList && event.target.classList.contains('button')) ||
                        (event.target && event.target.controlClass && event.target.controlClass.constructor.name == 'Button'))
                        b = event.target;
                    else
                        b = this.defaultBtn;
                    if (b) {
                        let evt = createNewEvent('click');
                        b.dispatchEvent(evt);
                    }
                    event.stopPropagation();
                }
                break;
            case 'Esc':
                if (this.cancelBtn) {
                    let evt = createNewEvent('click');
                    this.cancelBtn.dispatchEvent(evt);
                }
                event.stopPropagation();
                break;
            case 'Left':
            case 'Up':
                if (isGlobal || (event.target && ((event.target instanceof HTMLTextAreaElement) || (event.target instanceof HTMLInputElement)))) {
                    return;
                }
                this.moveButtonFocus(-1);
                event.stopPropagation();
                break;
            case 'Right':
            case 'Down':
                if (isGlobal || (event.target && ((event.target instanceof HTMLTextAreaElement) || (event.target instanceof HTMLInputElement)))) {
                    return;
                }
                this.moveButtonFocus(1);
                event.stopPropagation();
                break;
            }
        }.bind(this);

        this.localListen(this.container, 'keydown', this.handleKeyDown, false);
    }

    preventClickingTwice(btn) {
        if (btn.controlClass) {
            btn.controlClass.localListen(btn, 'click', function (evt) {
                if (btn.controlClass._lastTimeClicked && ((Date.now() - btn.controlClass._lastTimeClicked) < 1000)) { // ignore clicks under 1s after previous click
                    evt.preventDefault();
                    evt.stopImmediatePropagation();
                    evt.stopPropagation();
                }
                btn.controlClass._lastTimeClicked = Date.now();
            }, true);
        }
    }

    checkGlobalListener() {
        if (this._globalListenerSet)
            return;
        if (this.cancelBtn || this.defaultBtn) {
            this.localListen(window, 'keydown', function (e) {
                this.handleKeyDown(e, true /* global */ );
            }.bind(this), false);
            this._globalListenerSet = true;
        }
    }

    moveButtonFocus(step) {
        let allButtons = [];
        let focusedIdx = -1;
        let defaultIdx = -1;
        let focusAttr = window.getFocusAttribute();
        forEach(this.oppositeButtons, function (btn, idx) {
            allButtons.push(btn);
            if (btn.hasAttribute(focusAttr))
                focusedIdx = allButtons.length - 1;
            if (btn.hasAttribute('data-default'))
                defaultIdx = allButtons.length - 1;
        });
        forEach(this.buttons, function (btn, idx) {
            allButtons.push(btn);
            if (btn.hasAttribute(focusAttr))
                focusedIdx = allButtons.length - 1;
            if (btn.hasAttribute('data-default'))
                defaultIdx = allButtons.length - 1;
        });
        if (focusedIdx < 0) {
            if (defaultIdx >= 0)
                focusedIdx = defaultIdx;
        }
        focusedIdx += step;
        if (focusedIdx < 0)
            focusedIdx = allButtons.length - 1;
        if (focusedIdx >= allButtons.length)
            focusedIdx = 0;
        setFocusState(allButtons[focusedIdx], true, true);
    }

    /**
    Add specified button to the control

    @method addBtn
    @param {Object} params
        @param {string} params.btnID ID of the button element. Could be some of the standard button id's ({{#crossLink "Buttons"}}see Buttons class description{{/crossLink}}) or custom one.
        @param {string} [params.value] DataValue of the button.
        @param {boolean} [params.isDefault=false] If true, the button will be set as default button.
        @param {boolean} [params.isOpposite=false] If true, the button will be placed on the opposite side of the parent dialog. It is always false for Buttons control with position set to 'center'.
        @param {string} [params.caption] Custom caption of the button element.
    @return {HTMLElement} HTML element of the new added button.
    */
    addBtn(params: AnyDict) {
        if ((params === undefined) || (params.btnID === undefined))
            return;
     
        let t = this.getKnownBtnType(params.btnID);
        let buttonnode = document.createElement('div') as ElementWith<Button>;
        buttonnode.setAttribute('data-id', params.btnID);

        if (params.value !== undefined)
            buttonnode.setAttribute('data-value', params.value);
        if ((params.isDefault !== undefined) && (params.isDefault)) {
            buttonnode.setAttribute('data-default', '1');
            this.defaultBtn = buttonnode;
            this.checkGlobalListener();
        }
        if (params.menuArray) { // @ts-ignore
            buttonnode.controlClass = new MenuButton(buttonnode, {
                menuArray: params.menuArray,
                caption: params.caption,
                noAddClasses: true
            });
            buttonnode.classList.add('button');
        } else {
            buttonnode.controlClass = new Button(buttonnode);
        }
        buttonnode.controlClass.isButton = true;

        if (t !== null) {
            buttonnode.setAttribute('data-no-localize', '1'); // known types are already localized
            buttonnode.setAttribute('data-btype', t.type);
            buttonnode.controlClass.textContent = t.caption;
            this.preventClickingTwice(buttonnode); // prevent only for known types, where we know for sure it is needed
        }
        this._checkCancelButton(t, buttonnode);
        if (params.caption !== undefined) {
            buttonnode.controlClass.textContent = params.caption;
        }

        if (params.isOpposite) {
            buttonnode.setAttribute('data-position', 'opposite');
            buttonnode.controlClass.isOpposite = true;
        }

        if (this.position === 'center') {
            this.container.appendChild(buttonnode);
            this.buttons.push(buttonnode);
            this.setOrder(this.buttons);
        } else {
            if (params.isOpposite) {
                this.leftTopDiv.appendChild(buttonnode);
                this.oppositeButtons.push(buttonnode);
                this.setOrder(this.oppositeButtons);
            } else {
                this.rightBottomDiv.appendChild(buttonnode);
                this.buttons.push(buttonnode);
                this.setOrder(this.buttons);
            }
        }
        this.requestTimeout(function () {
            this.updateSameWidth();
        }.bind(this), 1);
        notifyLayoutChange();
        return buttonnode;
    }

    _checkCancelButton(btnType, btn) {
        if (((btnType && (btnType.canCancel)) || (btn.hasAttribute('data-esc'))) && (this.cancelBtn === null)) {
            this.cancelBtn = btn;
            if (!btn.hasAttribute('data-no-close')) {
                let closew = function () {
                    app.unlisten(btn, 'click', closew);
                    closeWindow();
                };
                app.listen(btn, 'click', closew);
            }
            this.checkGlobalListener();
        }
    }
}
registerClass(Buttons);

let bIDs = {
    btnYes: {
        type: 1,
        caption: _('Yes'),
        priority: 1
    },
    btnNo: {
        type: 2,
        caption: _('No'),
        priority: 3
    },
    btnOK: {
        type: 3,
        caption: _('OK'),
        priority: 1
    },
    btnCancel: {
        type: 4,
        caption: _('Cancel'),
        priority: 5,
        canCancel: true
    },
    btnAbort: {
        type: 5,
        caption: _('Abort'),
        priority: 5,
        canCancel: true
    },
    btnRetry: {
        type: 6,
        caption: _('Retry'),
        priority: 6
    },
    btnIgnore: {
        type: 7,
        caption: _('Ignore'),
        priority: 7
    },
    btnAll: {
        type: 8,
        caption: _('All'),
        priority: 1
    },
    btnNoToAll: {
        type: 9,
        caption: _('No to all'),
        priority: 4
    },
    btnYesToAll: {
        type: 10,
        caption: _('Yes to all'),
        priority: 2
    },
    btnHelp: {
        type: 11,
        caption: _('Help'),
        priority: 9
    },
    btnClose: {
        type: 12,
        caption: _('Close'),
        priority: 8,
        canCancel: true
    },
    btnOkToAll: {
        type: 13,
        caption: _('OK to All'),
        priority: 2
    },
    btnEdit: {
        type: 14,
        caption: _('Edit'),
        priority: 2
    },
    btnEditToAll: {
        type: 15,
        caption: _('Edit to All'),
        priority: 3
    },
    btnIgnoreToAll: {
        type: 16,
        caption: _('Ignore to All'),
        priority: 8
    },
    btnFindMissingCodec: {
        type: 17,
        caption: _('Find missing codec'),
        priority: 2
    },
    btnRestart: {
        type: 18,
        caption: _('Restart'),
        priority: 3
    },
    btnConnect: {
        type: 19,
        caption: _('Connect'),
        priority: 2
    },
    btnBrowse: {
        type: 20,
        caption: _('Browse'),
        priority: 2
    },
    btnPurchase: {
        type: 21,
        caption: _('Register/Purchase'),
        priority: 2
    },
};