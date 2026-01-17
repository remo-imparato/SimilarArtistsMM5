'use strict';

import Control from './control';

/**
@module UI
*/

registerFileImport('controls/editable');

/**
Base class for content editable labels.

@class Editable
@constructor
@extends Control
*/

export default class Editable extends Control {
    private _inEdit: boolean;
    private _contenteditable: boolean;
    autoExitEditableMode: boolean;
    autoEditOnFocus: boolean;
    textContent: string;
    multiline: boolean;
    private _callChange: boolean;
    lastValue: string;
    private _editable: any;
    private _tabbable: boolean;

    initialize(elem: HTMLDivElement, params: AnyDict) {
        super.initialize(elem, params);
        params = params || {};
        this._tabbable = !!params.tabbable;
        this.autoEditOnFocus = window.uitools.getCanEdit() && (params.autoEditOnFocus !== false);
        this.autoExitEditableMode = !!params.autoExitEditableMode;
        this.editable = window.uitools.getCanEdit() && (params.editable !== false);
        this.multiline = !!params.multiline;
        this.contextMenu = []; // to activate contextMenuHandler for the default system menu (#20624)
        
        if(!params.multiline) {
            this.localListen(this.container, 'input',  (e) => {
                // LS: remove carriage return <br> after pressing Enter, is there a better way of doing that?
                //this.innerHTML = replaceAll('<br>', '', this.innerHTML);
                //this.innerHTML = replaceAll('<div>', '', this.innerHTML); // also <div> is sometimes created for contenteditable elements when pressing Enter
                // eslint-disable-next-line no-self-assign
                this.textContent = this.textContent;
            });
        }
        
        this.localListen(this.container, 'keydown',  (e) => {
            let key = friendlyKeyName(e);
            if(!this._inEdit) {
                if((key === 'F2') && this.editable) {
                    this._startEdit(e);
                    this.requestFrame(() => {
                        window.uitools.selectAllText(this.container);
                        this.container.focus();
                    }, 'selectAllText');
                }    
                return;
            }
            if (((key === 'Enter') && (!params.multiline || e.ctrlKey || e.shiftKey)) || (key === 'Esc')) {
                this._callChange = (key === 'Enter');
                if (key === 'Esc' && this.lastValue) {
                    this.container.innerText = this.lastValue;
                }
                e.stopPropagation();
                if(!this.autoEditOnFocus) {
                    this.contenteditable = false;
                    if (this._inEdit)
                        this.raiseEvent('editEnd', {});
                    this._inEdit = false;
                } else {
                    this.container.blur();
                }
            } else
            if ((key === 'Home') || (key === 'End')) { // to be sure that Home/End will just move the cursor
                e.stopPropagation();
            } else
            if (this.contenteditable && (key !== 'Tab')) { // if (key === 'Space')
                // LS: it is safer to always stop propagation here when editing,
                //     otherwise e.g. scroller.js subsequently calls e.preventDefault() on 'Space' so that it does not auto-scrolls page
                //     but this would result that space would be ignored also here on editing (#15986)
                e.stopPropagation();
            }
        });

        this.localListen(this.container, 'click', this._startEdit.bind(this));
        this.localListen(this.container, 'focus', (e) => {
            if(this.autoEditOnFocus  || !isUsingKeyboard())
                this._startEdit(e);
        });
        this.localListen(this.container, 'blur',  (e) => {
            if (this.contenteditable) {
                this.contenteditable = false; // is needed otherwise Ctrl+V will paste text even if this control isn't focused!
                this.contenteditable = true;  // and take it back to get back the I-beam cursor (#20623)
            }
            if (this._inEdit)
                this.raiseEvent('editEnd', {});
            this._inEdit = false;
        });
        this.localListen(this.container, 'dblclick', (e) => {
            if (this.editable)
                e.stopPropagation(); // #20625
        });
        if(this.editable && this._tabbable)
            this.tabIndex = 0;
        else
            this.tabIndex = -1;
    }

    contextMenuHandler(e) {
        e.stopPropagation(); // to show the default 'Copy', 'Cut', 'Paste', 'Select all' menu (#20624)
    }
    
    _startEdit (e?:any) {
        if (this.editable && !this._inEdit && window.uitools.getCanEdit()) {
            this.contenteditable = true;
            this._callChange = true;
            if (!this._inEdit) {
                this.lastValue = this.container.innerText;
                this.raiseEvent('editStart', {});
            }
            this._inEdit = true;
            if(e)
                e.stopPropagation();
        }
    }

    startEditMode() {
        if(!this._inEdit && this.editable) {
            this._startEdit();
            this.requestFrame(() => {
                window.uitools.selectAllText(this.container);
                this.container.focus();
            }, 'selectAllText');
        }
    }

    get text() : string {
        return this.container.textContent;
    }
    set text(value: string) {
        if (this.container.textContent != value) {
            this.container.textContent = value; // don't use innerText here as it moves cursor to the beginning (#14670)                        
            if (this.container.textContent && this.container.textContent.startsWith(' '))
                this.container.innerHTML = '&nbsp;' + this.container.textContent.substring(1); // so that the leading space is shown (#16851)
            if (this.container.textContent && this.container.textContent.endsWith(' '))
                this.container.innerHTML = this.container.textContent.substring(0, this.container.textContent.length - 1) + '&nbsp;'; // so that the trailing space is shown (#16851)
        }
    }

    get editable() : boolean {
        return this._editable;
    }
    set editable(value: boolean) {
        if (this._editable != value) {
            this._editable = value;
            if(this.autoEditOnFocus)
                this.contenteditable = value;
            else
                this.contenteditable = false;
            if (value) {
                this.container.style.cursor = 'auto';
                if(this._tabbable)
                    this.tabIndex = 0;        
            }
            else {
                this.container.style.cursor = 'default';
                if(this._tabbable)
                    this.tabIndex = -1;
            }
        }
    }

    get contenteditable() : boolean {
        return this._contenteditable;
    }
    set contenteditable(value: boolean) {
        if (this._contenteditable != value) {
            this._contenteditable = value;
            if (value) {
                this.container.setAttribute('contenteditable', 'true');
            }
            else {
                this.container.removeAttribute('contenteditable');
            }
            if (this.lastValue !== this.container.innerText) {
                this.lastValue = this.container.innerText;
                if (!value && this._callChange) {
                    this.requestFrame(() => { // asynchronously, as change event can cause calling cleanUp before finishining blur handling, #21098
                        this.raiseEvent('change', {
                            value: this.lastValue
                        });
                    });
                }
            }
            if (!value && this.autoExitEditableMode) {
                this.editable = false;
            }
        }
    }

    get inEdit() : boolean {
        return this._inEdit;
    }

}
registerClass(Editable);
