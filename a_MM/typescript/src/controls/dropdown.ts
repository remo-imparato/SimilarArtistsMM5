'use strict';

registerFileImport('controls/dropdown');

import Checkbox from './checkbox';
import Control from './control';
import ListView from './listview';

/**
@module UI
*/

requirejs('utils');
requirejs('controls/innerWindow');

let usePopupWindows = false;
let dropdownMenuSeparator = '--menuseparator--';

/**
UI Dropdown element
@example
    <div id="testD" data-control-class="Dropdown" data-init-params="{readOnly: true}">
        <option>Item 1</option>
        <option>Item 2</option>
    </div>
    
@class Dropdown
@constructor
@extends Control
*/
export default class Dropdown extends Control {
    private _readOnly: boolean;
    separator: string;
    multivalue: boolean;
    filtering: boolean;
    preload: boolean;
    checkboxes: boolean;
    private _dropdownItemFormat: any;
    lastEditValue: string;
    autoWidth: boolean;
    preserveSpaces: boolean;
    textOnly: boolean;
    shouldExpand: boolean;
    autoConfirm: boolean;
    private _focusedIndex: any;
    private _focusInList: boolean;
    openingList: boolean;
    edit: HTMLInputElement;
    showCloseButton: boolean;
    close: HTMLDivElement;
    select: HTMLDivElement;
    valuelist: any;
    private _lastCaretPos: number;
    dbProp: any;
    dbFunc: any;
    dbFuncParams: any;
    wasVisible: boolean;
    clickInside: boolean;
    clickInsideItem: boolean;
    private _wasReadOnly: any;
    capturesSet: boolean;
    confirmSent: boolean;
    removeHTMLTags: boolean;
    w: any;
    lastKeyWithAlt: boolean;
    private _lastSelectedItem: any;
    dropdownHandler: AnyDict;
    private _editboxKeyDownCapture: (...params: any[]) => void;
    private _editboxMouseDownCapture: (...params: any[]) => void;
    autoComplete: boolean;

    initialize(parentel, params) {
        this.noFocusOnClick = true; // by default do not get focus on click, it would broke focus handling for e.g. sortBy dropdown
        super.initialize(parentel, params);

        // set default values
        /**
    If true, makes dropdown edit readOnly - values could be selected only by dropdown list.

    @property readOnly
    @type boolean
    @default false
    */
        this._readOnly = false;
        /**
    Multivalue separator. Valid for multivalue editing mode.

    @property separator
    @type string
    @default '; '
    */
        let sett = settings.get('Appearance');
        this.separator = sett.Appearance.MultiStringSeparator;
        /**
    If true, activates multivalue editing mode.

    @property multivalue
    @type boolean
    @default true
    */
        this.multivalue = true;

        /**
    If true, activates filtering mode.

    @property filtering
    @type boolean
    @default true
    */
        this.filtering = true;

        /**
    If true, activates auto-complete mode.

    @property autoComplete
    @type boolean
    @default true
    */
        this.autoComplete = true;        

        /**
    If true, preloads data for dropdown list.

    @property preload
    @type boolean
    @default false
    */
        this.preload = false;

        /**
    If true, displays checkboxes. Valid only for not filtered lists (filtering: false or readOnly: true).

    @property checkboxes
    @type boolean
    @default false
    */
        this.checkboxes = false;

        this._dropdownItemFormat = undefined;

        this.lastEditValue = '';
        /**
    If true, computes width of the dropdown from its content. Valid only for dropdowns with fixed contents.

    @property autoWidth
    @type boolean
    @default true
    */
        this.autoWidth = true;

        /**
    If true, preserves spaces in dropdown list texts. Use only when displaying raw texts in dropdown.

    @property preserveSpaces
    @type boolean
    @default false
    */
        this.preserveSpaces = false;

        /**
    If true, dropdown list contains only texts, no HTML. Use only when displaying raw texts in dropdown and preserveSpace is false.

    @property textOnly
    @type boolean
    @default true
    */
        this.textOnly = true; // HTMl is dangerous, use only with input validation
        this.shouldExpand = false;

        this.autoConfirm = false;

        this._focusedIndex = undefined; // just for detecting, that focusedIndex was manually changed
        this._focusInList = false; // detect, whether user is moving in list, needed for correct directing Home/End handling

        this.openingList = false;
        this.container.classList.add('dropdown');

        this.canvas = document.createElement('div');
        this.canvas.classList.add('editable-select');

        this.edit = document.createElement('input');
        /* if (params && params.showCloseButton)
            this.edit.type = 'search'; // LS: is not well style-able, so we use own Icon component for the close button bellow
        else */
        this.edit.type = 'text';
        if (params && params.placeholder)
            this.edit.placeholder = params.placeholder;
        
        this.edit.className = 'es-edit';

        if (params && params.showCloseButton) {
            this.showCloseButton = true;
            this.close = document.createElement('div');
            this.close.setAttribute('data-control-class', 'Icon');
            this.close.setAttribute('data-init-params', '{icon: "close"}');
            this.close.classList.add('es-close');
        }

        this.select = document.createElement('div');
        this.select.className = 'es-select';
        loadIconFast('dropdown', function (icon) {
            setIconFast(this.select, icon);
        }.bind(this));

        this._updateDisabledAttribute = function () {
            if (this.disabled) {
                this.select.setAttribute('data-disabled', 1);
                this.edit.setAttribute('data-disabled', 1);
                this.container.setAttribute('data-disabled', 1);
                this.container.tabIndex = -1;
            } else {
                this.container.tabIndex = 0;
                this.select.removeAttribute('data-disabled');
                this.edit.removeAttribute('data-disabled');
                this.container.removeAttribute('data-disabled');
            }
            this.select.disabled = this.disabled;
            this.edit.disabled = this.disabled;
        }.bind(this);

        let initialFocusedIndex = undefined;
        // set passed attributes
        for (let key in params) {
            if (key === 'focusedIndex')
                initialFocusedIndex = params[key];
            else
                this[key] = params[key];
        }

        if (this.readOnly) {
            this.select.setAttribute('data-readOnly', '1');
            this.edit.setAttribute('data-readOnly', '1');
            if (!this.checkboxes)
                this.multivalue = false; // no way of setting multivalue in this case, set false to avoid problems like #17984
        }

        this.edit.readOnly = this.readOnly;

        this.valuelist = undefined;
        this.container.appendChild(this.canvas);
        this.canvas.appendChild(this.select);
        if (this.showCloseButton)
            this.canvas.appendChild(this.close);
        this.canvas.appendChild(this.edit);

        // find all 'option' childs - for static dropdown
        let childs = qetag(this.container, 'option');
        if (childs.length > 0) {
            this.valuelist = newStringList();
            let ch;
            for (let i = 0; i < childs.length; i++) {
                ch = childs[i];
                this.valuelist.add(_(ch.textContent));
            }
            for (let i = childs.length - 1; i >= 0; i--) {
                this.container.removeChild(childs[i]);
            }

            if (this.autoWidth) {
                this.setAutoWidth();
            }
            if (!this.checkboxes) {
                //this.dataSourceListen(this.valuelist, 'focuschange', (newIndex, oldIndex) => { this.handleDSModify(newIndex, oldIndex); }); //#19096
            }
            this.valuelist.notifyLoaded();
        } else if (this.preload) {
            if (this.dbProp && (app.db[this.dbProp] !== undefined)) {
                this.valuelist = app.db[this.dbProp];
            } else if (this.dbFunc && (app.db[this.dbFunc] !== undefined)) {
                this.valuelist = app.db[this.dbFunc](this.dbFuncParams);
            }
            if (!this.checkboxes) {
                //this.dataSourceListen(this.valuelist, 'focuschange', (newIndex, oldIndex) => { this.handleDSModify(newIndex, oldIndex); }); //#19096
            }
            if (this.autoWidth) {
                this.setAutoWidth();
            }
        }

        if (this.multivalue && this.filtering) {
            this._lastCaretPos = 0;
            this.localListen(this.edit, 'click', (e) => { this.updateCaretPos(); });
        }

        this.localListen(this.edit, 'keydown', (e: KeyboardEvent) => { this.editboxKeyDown(e); });
        this.localListen(this.edit, 'keyup', (e: KeyboardEvent) => { this.editboxKeyUp(e); });
        this.localListen(this.edit, 'focus', (e: NotifyEvent) => { this.editboxFocus(e); });
        this.localListen(this.edit, 'blur', (e: NotifyEvent) => { this.editboxBlur(e); });
        this.localListen(this.edit, 'change', (e) => { this._catchEvent(e); }); // do not propagate change event, we raise our own change event
        if (this.close) {
            this.localListen(this.close, 'click', () => {
                this.value = '';
                this.focus();
                this.raiseEvent('closeclick', {});
            });
        }
        this.localListen(this.select, 'mousedown', (e: MouseEvent) => { this.selectClick(e); });
        this.localListen(this.select, 'mouseup', (e: MouseEvent) => { this._catchEvent(e); }); // stop propagation this event, to avoid losing focus e.g. when in LV
        this.localListen(this.edit, 'mousedown', (e: MouseEvent) => {
            if (this.readOnly)
                this.selectClick(e);
            else
                this._focusInList = false;
        });
        this.localListen(this.edit, 'mouseup', (e: MouseEvent) => { this._catchEvent(e); }); // stop propagation this event, to avoid losing focus e.g. when in LV
        this.localListen(window, 'closedropdowns', () => {
            this.closeDropdown();
        });

        if (this.checkboxes && this.valuelist)
            this.dataSourceListen(this.valuelist, 'change', () => { this.handleDSChange(); });
        if ((initialFocusedIndex !== undefined) && this.valuelist) {
            this.dataSourcePromise(this.valuelist.whenLoaded()).then(function () {
                if (this._focusedIndex === undefined) { // not changed yet
                    this.focusedIndex = initialFocusedIndex;
                }
            }.bind(this));
        }

        if (params && resolveToValue(params.expanded, false)) {
            this.shouldExpand = true;
            this.openDropdown();
        }
        this.registerEventHandler('layoutchange');
        this.wasVisible = this.visible;
    }

    updateCaretPos() {
        if (this.multivalue && this.filtering) {
            let carPos = this.caretPos;
            if (carPos !== this._lastCaretPos) {
                this._lastCaretPos = carPos;
                if (this.w) {
                    this.sendFilterLV(this, this.getEditValue(), true);
                }
            }
        }
    }

    editboxKeyDownCapture(evt) {
        if (friendlyKeyName(evt) === 'Tab') { // TAB
            this.clickInside = false;
        }
    }

    editboxMouseDownCapture(evt) {
        this.clickInside = false;
        for (let element = evt.target; element; element = element.parentNode) {
            if (element.classList && element.classList.contains('innerWindow')) {
                this.clickInside = true;
                break;
            }
        }
        if (evt.target.classList.contains('lvCanvas'))
            this.clickInsideItem = false; // to eliminate scrollbars (#19552)
        else
            this.clickInsideItem = true;
    }

    sendKeyToLV(_this, evt) {
        if (_this.w) {
            let w = _this.w;
            w.getValue('handleKeypressed')(evt.key, evt.shiftKey, evt.ctrlKey, evt.altKey, evt.metaKey);
            return;
        }
    }

    sendFilterLV(_this, val, updateCaretOnly, addingChars?) {
        if (_this.w) {
            if (_this.multivalue && _this.filtering)
                _this._lastCaretPos = _this.caretPos;

            _this.w.getValue('filterLV')(val, _this._lastCaretPos, updateCaretOnly, addingChars);
        }
    }

    restoreReadOnlyState() {
        if (this.checkboxes && this._wasReadOnly !== undefined) {
            this.readOnly = this._wasReadOnly;
            this._wasReadOnly = undefined;
        }
    }

    editboxFocus(evt) {
        if (this.disabled)
            return;
        this.restoreReadOnlyState();
        this.canvas.setAttribute('data-focused', '1');
        if (!usePopupWindows) {
            this._editboxKeyDownCapture = app.listen(this.edit, 'keydown', (e) => { this.editboxKeyDownCapture(e); }, true);
            this._editboxMouseDownCapture = app.listen(window, 'mousedown', (e) => { this.editboxMouseDownCapture(e); }, true);
            this.capturesSet = true;
        }        
        this.updateCaretPos();
    }

    editboxBlur(evt) {
        if (this.disabled || (this.autoConfirm && this.confirmSent))
            return;
        this.canvas.removeAttribute('data-focused');
        if (!this.clickInside && !usePopupWindows && this.capturesSet) {
            if (this._editboxKeyDownCapture) {
                app.unlisten(this.edit, 'keydown', this._editboxKeyDownCapture, true);
                this._editboxKeyDownCapture = undefined;
            }
            if (this._editboxMouseDownCapture) {
                app.unlisten(window, 'mousedown', this._editboxMouseDownCapture, true);
                this._editboxMouseDownCapture = undefined;
            }
            this.capturesSet = false;
        } else if (!usePopupWindows) {
            this.edit.focus();
            this.requestTimeout(function () {
                if (this.autoConfirm && this.clickInsideItem) {
                    let evt = createNewEvent('keydown'); // @ts-ignore
                    evt.key = 'Enter'; // @ts-ignore
                    evt.shiftKey = false; // @ts-ignore
                    evt.ctrlKey = false; // @ts-ignore
                    evt.altKey = false;
                    this.confirmSent = true;
                    this.edit.dispatchEvent(evt);
                }
            }.bind(this), 50, 'autoConfirmTimeout');
        }
        if (!this.openingList && !this.clickInside) {
            if (this.isDropdownOpen())
                window.closeDropdownPopup(this);
        }
    }

    editboxKeyUp(evt: KeyboardEvent) {
        if (this.disabled)
            return;
        if (this.openingList) {
            return;
        }
        if (evt.altKey) // writing character using Alt, skip, wait for final character, #18914
        {
            this.lastKeyWithAlt = true;
            return;
        }
        switch (friendlyKeyName(evt)) {
        case 'PageUp': // page up
        case 'PageDown': // page down
        case 'End': // end
        case 'Home': // home
        case 'Up': // up
        case 'Down': // down
        case 'Enter': // Enter
        case 'Esc': // Esc
        case 'Shift': // shift
            this.updateCaretPos();
            return;
        case 'Left':
        case 'Right':
            this.updateCaretPos();
            break;
        case 'Space': // space
        {
            if (this.checkboxes && (this.w !== undefined)) {
                return;
            }
            break;
        }
        }

        let val;
        let evtWhich = evt.which; // save value for possible async processing in processKey

        let processKey = function () {
            if (this.readOnly) {
                val = String.fromCharCode(evtWhich).trim();
            } else {
                val = this.getEditValue();
            }

            if (this.lastEditValue !== val) {
                let addingChars = false;
                if (this._lastCaretPos && this._lastCaretPos < this.caretPos)
                    addingChars = true;
                this.lastEditValue = val;                
                let evtCh = createNewEvent('change');
                this.container.dispatchEvent(evtCh);
                if (this.filtering) {
                    if (this.w === undefined) {
                        if (this.lastEditValue) {
                            this._openDropdownPopup(val);
                        }
                    } else {
                        if (!this.lastEditValue)
                            window.closeDropdownPopup(this);
                        else                        
                            this.sendFilterLV(this, val, false, addingChars);
                    }
                }
                this._setCloseVisibility(val != '');
            }
        }.bind(this);

        if (this.readOnly || !this.lastKeyWithAlt) {
            processKey();
        } else {
            this.requestFrame(processKey, 'processKey'); // last key was alt, value is not in input element yet, we had to wait till next frame, #18914
        }

        this.lastKeyWithAlt = false;
    }

    editboxKeyDown(evt: KeyboardEvent) {
        if (this.openingList || this.disabled)
            return;
        switch (friendlyKeyName(evt)) {
        case 'End': // end
        case 'Home': // home
        {
            if (!this._focusInList && !this.readOnly) {
                return; // it will be default handling in edit box
            }
        }
        // eslint-disable-next-line no-fallthrough
        case 'PageUp': // page up
        case 'PageDown': // page down
        case 'Up': // up
        case 'Down': // down
        {
            if (evt.ctrlKey) // to exlude Ctrl+Down that has different meaning e.g. in search bar when 'Scroll to matches' is selected
                return;

            this._focusInList = true;
            if ((this.w === undefined) || evt.shiftKey || evt.altKey ||
                        ((evt.keyCode !== 40) && this.w && this.w.getValue('isDropdownListEmpty')())) {
                if (evt.keyCode === 40) {
                    evt.preventDefault();
                    evt.stopPropagation();
                    if (this.readOnly)
                        this._openDropdownPopup(this.getEditValue());
                    else
                        this._openDropdownPopup();
                }
            } else {
                evt.preventDefault();
                evt.stopPropagation();
                this.sendKeyToLV(this, evt);
            }
            return;
        }
        case 'Enter': // Enter
        {
            if (this.w) {
                evt.preventDefault();
                evt.stopPropagation();
                this.sendKeyToLV(this, evt);
            }
            break;
        }
        case 'Esc': // Esc
        {
            if (this.w) {
                evt.preventDefault();
                evt.stopPropagation();
                window.closeDropdownPopup(this);
            }
            break;
        }
        case 'Space': // space
        {
            if (this.checkboxes && (this.w !== undefined)) {
                evt.preventDefault();
                this.sendKeyToLV(this, evt);
            }
            break;
        }
        }
        this._focusInList = false;
    }

    selectClick(evt: MouseEvent) {
        if (this.disabled || evt.button != 0)
            return;
        evt.preventDefault();
        evt.stopPropagation();
        if (this.isDropdownOpen()) {
            this.closeDropdown();
            this._focusInList = false;
        } else {
            this.openDropdown();
            this._focusInList = true;
        }
    }

    _handleDSChange() {
        if ((this.valuelist !== undefined) && (this.multivalue) && (this.w !== undefined)) {
            let val = '';
            let list = this.valuelist.getCheckedList();
            this.localPromise(list.whenLoaded()).then(function () {
                list.forEach(function (obj) {
                    if (val !== '')
                        val += this.separator;
                    val += obj.toString();
                }.bind(this));
                this.setEditValue(val);
            }.bind(this));
        }
    }

    handleDSChange() {
        this.requestTimeout( () => {this._handleDSChange();}, 50, 'handleDSChange');
    }

    handleDSModify(newIndex: number, oldIndex: number) {
        if ((newIndex >= 0) && this.valuelist) {
            let vlst = this.valuelist; // save, to not lose it, valuelist can be reset during change event after setEditValue later
            vlst.locked(function () {
                if (newIndex >= vlst.count)
                    return;
                if (this.readOnly || !this.multivalue) {
                    if (this.readOnly && (this.focusedIndex !== newIndex))
                        this.focusedIndex = newIndex; // PETR: we need to have focusedIndex updated before sending 'change' event
                    this.setEditValue(vlst.getValue(newIndex).toString());
                }
                if (this.changeSelected !== undefined) {
                    this.changeSelected(vlst.getValue(newIndex).toString());
                }
            }.bind(this));
        }
    }

    normalizeValue(value) {
        if (this.removeHTMLTags) {
            let origValue = value;

            // remove HTML tags like <i>(old value)</i>
            let tmp = document.createElement('DIV');
            tmp.innerHTML = sanitizeHtml(value);
            value = '';
            for (let i = 0; i < tmp.childNodes.length; i++) {
                if (tmp.childNodes[i].nodeName === '#text') { // @ts-ignore
                    value += tmp.childNodes[i].data;
                }
            }

            // trim left and right
            value = value.trimLeft().trimRight();

            // check empty value
            if (value === '< ' + _('empty') + ' >')
                value = '';
            else
            if (!value)
                value = origValue;
        }
        return value;
    }

    _catchEvent(evt: Event) {
        if (this.readOnly)
            evt.stopPropagation();
    }

    handle_layoutchange(e: NotifyEvent) {
        if (this.autoWidth) {
            if (!this.wasVisible) {
                if (this.visible) {
                    this.wasVisible = true;
                    this.setAutoWidth();
                }
            } else
                this.wasVisible = this.visible;
        }
        super.handle_layoutchange(e);
    }

    _setCloseVisibility(value) {
        if (this.close) {
            setVisibility(this.close, value);
        }
    }

    _openDropdownPopup(filter?) {
        if (this.checkboxes && !this.readOnly) {
            this._wasReadOnly = this.readOnly;
            this.readOnly = true;
        }
        window.openDropdownPopup({
            wnd: this,
            control: this.container,
            width: this.container.offsetWidth,
            filter: filter,
            caretPos: this.caretPos,
            getCaretPos: () => { return this.caretPos;},
            initTextValue: this.getEditValue(),
            format: this._dropdownItemFormat
        });
    }

    isDropdownOpen() {
        return (this.w !== undefined);
    }

    isDropdownEmpty() {
        return !this.w || this.w.getValue('isDropdownListEmpty')();
    }

    openDropdown() {
        if (this.openingList || this.isDropdownOpen())
            return;
        let f = undefined;

        let runOpen = function () {
            if (this.openingList || this.isDropdownOpen())
                return;

            if ((this.readOnly) || (!this.multivalue))
                f = this.getEditValue();
            this._openDropdownPopup(f);
        }.bind(this);

        if (this.valuelist) {
            this.shouldExpand = undefined;
            this.dataSourcePromise(this.valuelist.whenLoaded()).then(function () {
                runOpen();
            }.bind(this));
        } else {
            if (this.shouldExpand) { // #18430
                this.requestTimeout(function () {
                    this.openDropdown();
                }.bind(this), 100, 'openDropdownValueListTimeout');
            } else
                runOpen();
        }
    }

    closeDropdown() {
        if (this.openingList)
            return;

        if (this.isDropdownOpen())
            window.closeDropdownPopup(this);
    }

    changeSelected(item) {
        this._lastSelectedItem = item;
    }

    getEditValue() {
        let val = '';
        if (this.edit)
            val = this.edit.value;
        return val;
    }

    /**
    Adds string value to the dropdown list. Valid only if readOnly is true and preload is true.

    @method addValue
    @param {string} s String to add.
    */
    addValue(val) {
        assert(this.readOnly && this.preload, 'addValue supported only for preloaded dropdown lists (readOnly: true, preload: true)');
        if (this.valuelist === undefined) {
            this.valuelist = newStringList();
        }
        this.valuelist.add(val.toString());
        this.valuelist.notifyLoaded();
    }

    /**
    Sets inital text value of the dropdown without calling change event.

    @method setInitialValue
    @param {string} val Initial value of dropdown
    */
    setInitialValue(val: string) {
        if (this.edit && (val !== undefined)) {
            val = this.normalizeValue(val);
            this.edit.value = val;
            this.lastEditValue = val.trim();
            this._setCloseVisibility(val != '');
        }
    }

    /**
    Fires when the selected dropdown element is changed.
    @event change
     */
    setEditValue(val, newCaretPosition?, selectFromCaretToEnd?) {
        if (this.edit && (val !== undefined)) {
            val = this.normalizeValue(val);
            this.edit.value = val;
            if ((val.trim) && (this.lastEditValue !== val.trim())) {
                this.lastEditValue = val.trim();
                let evt = createNewEvent('change');
                this.container.dispatchEvent(evt);
            }
            this._setCloseVisibility(val != '');
            if (newCaretPosition !== undefined) {
                if (selectFromCaretToEnd) {
                    this.edit.selectionDirection = 'backward';
                    this.edit.selectionStart = newCaretPosition;
                    this.edit.selectionEnd = this.edit.value.length;
                } else
                    this.edit.selectionStart = this.edit.selectionEnd = newCaretPosition;
            }
        }
    }

    _setAutoWidth() {
        if (!this.edit || !isVisible(this.container))
            return;

        let mtag = document.createElement('div');
        mtag.style.display = 'inline-block';
        mtag.style.position = 'absolute';
        mtag.style.top = '-1000px';
        mtag.style.left = '-1000px';
        let cs = getComputedStyle(this.edit, null);
        mtag.style.font = cs.getPropertyValue('font');
        this.container.appendChild(mtag);
        let w = 0;

        mtag.innerHTML = sanitizeHtml(this.value) + '.';
        let twidth = getFullWidth(mtag, {
            rounded: true
        });

        if (this.valuelist) {
            let last_len = 0;
            let longest_str = '';
            let ar = this.valuelist.getAllValues();

            for (let i = 0; i < ar.length; i++) {
                let str = ar[i];
                if (str.length > last_len) {
                    longest_str = str;
                    last_len = str.length;
                }
                // Break the loop if the list is unnecessarily long
                if (i > 3000) {
                    longest_str += longest_str;
                    break;
                }
            }

            mtag.innerHTML = sanitizeHtml(longest_str) + '_';
            w = getFullWidth(mtag, {
                rounded: true
            });
            if (w > twidth) {
                twidth = w;
            }
        }
        let ow = getOuterWidth(this.edit, cs, {
            rounded: true
        });
        twidth = twidth + ow + getScrollbarWidth();
        this.container.removeChild(mtag);
        if (this.edit.style.width !== twidth + 'px') {
            this.edit.style.width = twidth + 'px';
            if (isVisible(this.edit))
                notifyLayoutChange();
        }
    }

    setAutoWidth() {
        if (this.valuelist) {
            this.valuelist.whenLoaded().then(function () {
                this._setAutoWidth();
            }.bind(this));
        } else {
            this._setAutoWidth();
        }
    }

    calcAutoWidth() {
        // re-calculates auto-width now (e.g. called manually when all is visible so that getOuterWidth returns correct values)
        this._setAutoWidth();
    }

    /**
    Sets the focus on the control

    @method focus
    */
    focus() {
        this.edit.focus();
    }

    blur() {
        this.clickInside = false; // so it will allow leaving edit
        this.edit.blur();
    }

    /**
    Selects all text on the control

    @method selectText
    */
    selectText() {
        this.edit.select();
    }

    /**
    Should clean up all the control stuff, i.e. mainly unlisten events.

    @method cleanUp
    */
    cleanUp() {
        if (this.isDropdownOpen()) {
            this.closeDropdown();
        }
        app.unlisten(this.edit);
        app.unlisten(this.select);
        if (this.checkboxes && this.valuelist)
            app.unlisten(this.valuelist, 'change', this.handleDSChange);
        if (!usePopupWindows && this.capturesSet) {
            if (this._editboxKeyDownCapture)
                app.unlisten(this.edit, 'keydown', this._editboxKeyDownCapture, true);
            if (this._editboxMouseDownCapture)
                app.unlisten(window, 'mousedown', this._editboxMouseDownCapture, true);
            this.capturesSet = false;
        }
        this.dataSource = undefined; // cleans binded events too
        super.cleanUp();
    }

    get readOnly() {
        return this._readOnly;
    }
    set readOnly(value) {
        if (this._readOnly != value) {
            this._readOnly = value;

            this.edit.readOnly = value;
            if (value) {
                this.select.setAttribute('data-readOnly', '1');
                this.edit.setAttribute('data-readOnly', '1');
            } else {
                this.select.removeAttribute('data-readOnly');
                this.edit.removeAttribute('data-readOnly');
            }
        }
    }

    set items(value) {
        this.valuelist = this.valuelist || newStringList();
        let items = value.split(',');
        for (let i = 0; i < items.length; i++) {
            this.valuelist.add(items[i]);
        }
    }

    /**
    Gets/sets text value of the dropdown.

    @property value
    @type string
    */
    get value() {
        return this.getEditValue();
    }
    set value(value) {
        this.setEditValue(value);
    }

    get caretPos() {
        return this.edit.selectionStart;
    }

    get isFocused() {
        return this.canvas.hasAttribute('data-focused');
    }


    /**
    Gets/sets focusedIndex attribute of the dropdown. Supported only for dropdown list (readOnly = true).

    @property focusedIndex
    @type integer
    */
    get focusedIndex() {
        assert(this.readOnly && (this.valuelist !== undefined), 'focusedIndex supported only for dropdown list (readOnly: true)');
        let idx = -2;
        if (this.w)
            idx = this.w.getValue('getFocusedIndex')();
        else if (!usePopupWindows && this.dropdownHandler)
            idx = this.dropdownHandler.focusedIndex;
        if (idx === -2) {
            idx = this.valuelist.focusedIndex;
        }
        return idx;
    }
    set focusedIndex(value) {
        assert(this.readOnly && (this.valuelist !== undefined), 'focusedIndex supported only for dropdown list (readOnly: true)');
        let changed = (this._focusedIndex !== value);
        this._focusedIndex = value;
        this.valuelist.focusedIndex = value;
        if (!usePopupWindows && this.dropdownHandler)
            this.dropdownHandler.focusedIndex = value;
        if(changed)
            this.handleDSModify(value, undefined);
    }


    /**
    Gets/sets dataSource attribute of the dropdown.

    @property dataSource
    @type object
    */
    get dataSource() {
        return this.valuelist;
    }
    set dataSource(value) {
        if (this.valuelist !== undefined) {
            this.dataSourceUnlistenFuncts();
        }
        this.valuelist = value;
        if (this.valuelist) {
            if (!this.checkboxes) {
                //this.dataSourceListen(this.valuelist, 'focuschange', (newIndex, oldIndex) => { this.handleDSModify(newIndex, oldIndex); }); //#19096
            } else
                this.dataSourceListen(this.valuelist, 'change', () => { this.handleDSChange(); });
            if (this.autoWidth && !this.valuelist.isLoaded) {
                this.localPromise(this.valuelist.whenLoaded()).then(function () {
                    if (this.autoWidth) {
                        this.setAutoWidth();
                    }
                }.bind(this));
            }
        }
        if (this.autoWidth) {
            this.setAutoWidth();
        }
    }

    get dropdownItemFormat() {
        return this._dropdownItemFormat;
    }
    set dropdownItemFormat(format) {
        this._dropdownItemFormat = format;
    }

}
registerClass(Dropdown);

window.openDropdownPopup = function (params) {
    // opens select window
    let _this = params.wnd;

    if (_this.w)
        return;

    if (window.tooltipDiv && window.tooltipDiv.controlClass) { // @ts-ignore
        window.tooltipDiv.controlClass.disableTooltips();
    }

    closeMaskEditPopup(_this);
    let posByControl = params.control;
    let popupWidth = Math.round(params.width);
    let filterval = params.filter || '';
    let dropdownItemFormat = params.format;
    let selectedFunc = params.selected;
    let pos = findScreenPos(posByControl);
    let popupLeft = pos.left;
    let popupTop = pos.top + posByControl.offsetHeight;
    let wasMouseDown = false;
    let mouseDownStartedInside = false;

    _this.openingList = true;
    if (!_this.dropdownHandler) { // @ts-ignore
        _this.dropdownHandler = new DropdownHandler({
            separator: _this.separator,
            multivalue: _this.multivalue,
            filtering: _this.filtering,
            checkboxes: _this.checkboxes,
            isDropdownList: _this.readOnly,
            preserveSpaces: _this.preserveSpaces,
            textOnly: _this.textOnly,
            setEditValue: _this.setEditValue.bind(_this),
            getEditValue: _this.getEditValue.bind(_this),
            autoComplete: _this.autoComplete,
            getCaretPos: () => { return _this.caretPos;},
            changeSelectedFunc: _this.changeSelected.bind(_this),
            dropdownItemFormat: params.format,
            dbProp: _this.dbProp,
            dbFunc: _this.dbFunc,
            dbFuncParams: _this.dbFuncParams,
        });
    }
    _this.dropdownHandler.controlWidth = popupWidth;
    _this.dropdownHandler.controlTop = pos.top;
    _this.dropdownHandler.controlBottom = popupTop;
    _this.dropdownHandler.controlLeft = popupLeft;
    _this.dropdownHandler.position = 'bottom'; // top, custom
    _this.dropdownHandler.initFilterValue = params.filter;
    _this.dropdownHandler.initCaretPos = params.caretPos;
    _this.dropdownHandler.initTextValue = params.initTextValue;
    _this.dropdownHandler.valuelist = _this.valuelist;
    _this.dropdownHandler.owner = _this;
    if (usePopupWindows) {
        //that.w = app.createWindow('file:///dialogs/empty.html', {        
        _this.w = window.createOwnWindow('file:///dialogs/empty.html', {
            left: popupLeft,
            top: popupTop,
            width: popupWidth,
            height: -1
        });
    } else { // @ts-ignore
        _this.w = new InnerWindow({
            left: popupLeft,
            top: popupTop,
            width: popupWidth,
            initDropdown: _this.dropdownHandler.initDropdown.bind(_this.dropdownHandler),
            handleKeypressed: _this.dropdownHandler.handleKeypressed.bind(_this.dropdownHandler),
            filterLV: _this.dropdownHandler.filterLV.bind(_this.dropdownHandler),
            forcedCloseWindow: _this.dropdownHandler.forcedCloseWindow.bind(_this.dropdownHandler),
            getFocusedIndex: _this.dropdownHandler.getFocusedIndex.bind(_this.dropdownHandler),
            isDropdownListEmpty: _this.dropdownHandler.isDropdownListEmpty.bind(_this.dropdownHandler)
        });
        _this.dropdownHandler.window = _this.w;
        _this.dropdownHandler.parentel = _this.w.windowDiv;
    }
    _this.w.prepared = false;

    _this.w.loaded = function () {
        ODS('dropdown w.loaded');
        this.w.resizeable = false;
        this.w.bordered = false;
        this.w.atTop = true;

        if (posByControl) {
            _this.w.layoutChangeHandler = app.listen(posByControl, 'layoutchange', function () {
                if (!_this.w)
                    return;
                let pos = findScreenPos(posByControl);
                _this.w.bounds.left = pos.left;
                _this.dropdownHandler.resizeDropdownWindow();
            });
            if(posByControl.controlClass) {
                _this.w.mousestatechangedHandler = app.listen(thisWindow, 'mousestatechanged', function (x, y, hitTest, lDown, mDown, rDown) {
                    if (!_this.w)
                        return;
                    let rect = window.bounds.clientRect;
                    let clientX = x - rect.left;
                    let clientY = y - rect.top;
                    if(!wasMouseDown && lDown) {
                        wasMouseDown = true;
                        if (isInElement(clientX, clientY, this.w.windowDiv) || isInElement(clientX, clientY, this.container)) {
                            mouseDownStartedInside = true;
                        }
                    }
                    if (((wasMouseDown && !lDown) || (lDown && !mouseDownStartedInside) || mDown || rDown)) {
                        if (!mouseDownStartedInside && !isInElement(clientX, clientY, this.w.windowDiv) && !isInElement(clientX, clientY, this.container)) {
                            window.closeDropdownPopup(this);
                        }
                        wasMouseDown = false;
                        mouseDownStartedInside = false;
                    }
                }.bind(posByControl.controlClass));
            }
        }            

        if (usePopupWindows) {
            this.w.setValue('dropdownHandlerOrig', this.dropdownHandler);
            this.w.getValue('requirejs')('controls/dropdownpopup');
        }

        this.w.getValue('initDropdown')({
            preserveFocus: !!params.preserveFocus
        });
        if (this.edit) {
            this.edit.focus();
        }
        this.openingList = false;
        this.w.prepared = true;
        if (usePopupWindows) {
            app.unlisten(_this.w, 'load', _this.w.loaded);
        }

        if (window.tooltipDiv && window.tooltipDiv.controlClass) { // @ts-ignore
            window.tooltipDiv.controlClass.enableTooltips();
        }
    }.bind(_this);

    _this.w.closed = function () {
        ODS('dropdown w.closed');
        if (usePopupWindows) {
            app.unlisten(_this.w, 'closed', _this.w.closed);
        }
        if (_this.w.layoutChangeHandler && posByControl) {
            app.unlisten(posByControl, 'layoutchange', _this.w.layoutChangeHandler);
            _this.w.layoutChangeHandler = undefined;
        }
        this.w = undefined;
        if (selectedFunc !== undefined && this._lastSelectedItem)
            selectedFunc(this._lastSelectedItem);
    }.bind(_this);

    if (usePopupWindows) {
        app.listen(_this.w, 'load', _this.w.loaded);
        app.listen(_this.w, 'closed', _this.w.closed);
    } else {
        _this.w.loaded();
    }
};

window.closeDropdownPopup = function (_this) {
    if (_this.restoreReadOnlyState)
        _this.restoreReadOnlyState();
    if (_this.w) {
        let cf = _this.w.getValue('forcedCloseWindow');
        if (cf) {
            cf();
        } else {
            ODS('*** dropdown close - forcedCloseWindow does not exist');
        }
    }
    window.closeMaskEditPopup(_this);

    /**
    Fires when the dropdown popup is closed WITHOUT changing its value, i.e. user clicks away from the dropdown.
    @event dropdownclosed
    */
    _this.raiseEvent('dropdownclosed');
};

window.closeMaskEditPopup = function (_this) {
    if (_this.closePopup) {
        _this.closePopup();
    }
};


class DropdownHandler {
    mouseupDropdown: (evt: NotifyEvent) => void;
    resizeDropdownWindow: (evt?: NotifyEvent) => void;
    selectChange: (evt?: NotifyEvent) => void;
    items: ElementWith<DropdownList>;
    focusedIndex: number;
    eventsSet: boolean;
    filtered: boolean;
    checkboxes: boolean;
    filtering: boolean;
    initFilterValue: string;
    handleDSChange: any;
    lockedEditValue: boolean;
    isDropdownList: boolean;
    valuelist: any;
    multivalue: boolean;
    parentel: HTMLDivElement;
    dropdownItemFormat: any;
    preserveSpaces: any;
    textOnly: boolean;
    owner: Control;
    dbProp: string;
    valuesSplitted: string[];
    initTextValue: string;
    valIdx: number;
    separator: string;
    dbFunc: string;
    controlWidth: number;
    initCaretPos: number;
    dbFuncParams: any;
    getEditValue: any;
    setEditValue: any;
    getCaretPos: any;
    window: any;
    autoComplete: boolean;

    constructor(params) {
        for (let key in params) {
            this[key] = params[key];
        }

        this.mouseupDropdown = function (evt: NotifyEvent) {
            if ((evt.target !== undefined) && (!evt.target.classList.contains('menuseparator')) && (!evt.target.hasAttribute('data-disabled')) && (evt.target.classList.contains('dropdowndata') || evt.target.classList.contains('dropdownitem'))) {
                this.selectChange(evt);
                this.forcedCloseWindow();
            }
        }.bind(this);

        this.resizeDropdownWindow = function (evt: NotifyEvent) {
            if (!this.window)
                return;
            let h = 1; // cannot be zero, the size of the contents is not computed then
            if (evt) {
                h = parseFloat(evt.detail.size);
            } else {
                h = Math.max(parseFloat(this.items.controlClass.viewportSize), 1); // take last size
            }
            let cs = getComputedStyle(this.items, null);
            let maxh = parseFloat(cs.getPropertyValue('max-height'));
            if (!isNaN(maxh) && (h > maxh))
                h = maxh;
            let oh = getOuterHeight(this.items, cs);
            if (h > 1) {
                h += oh;
                if (!usePopupWindows) {
                // determine popup position
                    let rect = window.bounds.clientRect;
                    let bs;

                    if (headerClass) {
                        rect.top += headerClass.headersize;
                        bs = headerClass.borderSize;
                    } else {
                        bs = window.bounds.borderSize;
                    }
                    rect.top += bs;
                    rect.left += bs;
                    rect.right -= bs;
                    rect.bottom -= bs;
                    let wh = rect.bottom - rect.top;               
                    if (h > wh) {
                        h = wh;
                    }
                    let b = this.controlBottom + h;
                    if (b <= rect.bottom) {
                    // fits under control
                        if (this.position !== 'bottom') {
                            this.position = 'bottom';
                            this.window.bounds.top = this.controlBottom;
                        }
                    } else {
                        let spaceunder = rect.bottom - this.controlBottom;
                        let spaceabove = this.controlTop - rect.top;
                        let minh = 30;
                        if ((spaceunder > minh) || (spaceabove > minh)) {
                            if (spaceunder >= spaceabove) {
                                if (h > spaceunder)
                                    h = spaceunder;
                                if (this.position !== 'bottom') {
                                    this.position = 'bottom';
                                    this.window.bounds.top = this.controlBottom;
                                }
                            } else {
                                if (h > spaceabove)
                                    h = spaceabove;
                                this.position = 'top';
                                this.window.bounds.top = this.controlTop - h;
                            }
                        } else {
                        // no space around, use custom position
                            if (this.position !== 'custom') {
                                this.position = 'custom';
                                this.window.bounds.top = rect.top;
                            }
                        }
                    }
                    this.items.classList.toggle('positionAbove', (this.position === 'top'));
                    // check right side of the popup (needed for maskedit values popup)
                    let r = this.controlLeft + this.items.offsetWidth;
                    if (r > rect.right) {
                        this.window.bounds.left = rect.right - this.items.offsetWidth;
                    }
                }
            }
            this.items.style.height = Math.max(h - oh, 0) + 'px';
            this.window.bounds.setSize(this.items.offsetWidth, h);
            if (h > 1)
                this.window.show();
            if ((this.items.controlClass.focusedIndex < 0) && (this.items.controlClass.itemCount > 0)) {
                this.lockedEditValue = !this.isDropdownList;
                if (this.checkboxes) {
                    let val = this.getEditValue();
                    let foc = -1;
                    if (val !== '') {
                        let lst = val.split(this.separator.trim());
                        for (let idx = 0; idx < lst.length; idx++) {
                            lst[idx] = lst[idx].trim();
                        }

                        let ds = this.items.controlClass.dataSource;
                        this.items.controlClass.__prevent_cs_binding = true; // needed to get correct check state value in bindData (until the modifyAsync is finished)                    
                        ds.modifyAsync(function () {
                            if (this.eventsSet) { // to be sure that dropdown popup hasn't been closed meanwhile
                                ds.beginUpdate();
                                forEach(lst, function (val) {
                                    let idx = ds.indexOfCI(val);
                                    if (idx >= 0) {
                                        ds.setChecked(idx, true);
                                        if (foc === -1)
                                            foc = idx;
                                    }
                                });
                                ds.endUpdate();
                                this.items.controlClass.__prevent_cs_binding = false;
                                this.items.controlClass.invalidateAll();
                            }
                        }.bind(this));
                    }
                    if (foc === -1)
                        foc = 0;
                    this.items.controlClass.setFocusedAndSelectedIndex(foc);
                    this.items.controlClass.setItemFullyVisible(foc);
                } else if ((this.isDropdownList) && (this.initFilterValue !== undefined) && (this.initFilterValue !== '')) {
                    let sel = this.items.controlClass.selectByValue(this.initFilterValue);
                    if (!sel)
                        sel = this.items.controlClass.selectFirstByPrefix(this.initFilterValue);
                    if (evt)
                        this.initFilterValue = '';
                } else {
                // setting first item focused removed now, delete, if it will work ok
                // this.items.controlClass.setFocusedAndSelectedIndex(0);
                // this.items.controlClass.setItemFullyVisible(0);
                }
                this.lockedEditValue = false;
            }
        }.bind(this);

        this.selectChange = function (evt) {
            if (this.lockedEditValue)
                return;
            let selval = '';
            if (evt) {
                if (evt.detail && (evt.detail.index !== undefined)) {
                    selval = this.items.controlClass.cvalue(evt.detail.index);
                    this.focusedIndex = evt.detail.index;
                } else if (evt.target && evt.target.getAttribute) {
                    selval = this.items.controlClass.cvalue(evt.target.itemIndex);
                    this.focusedIndex = evt.target.itemIndex;
                } else {
                    selval = this.items.controlClass.cvalue();
                }
            } else {
                selval = this.items.controlClass.cvalue();
            }

            if (this.changeSelectedFunc !== undefined) {
                this.changeSelectedFunc(selval);
            }

            if (selval === '')
                return;
            let newCaretPos = undefined;
            if (this.multivalue) {
                if (!this.valuesSplitted && this.initTextValue && (this.initCaretPos !== undefined)) {
                    this.valuesSplitted = this.initTextValue.split(this.separator.trim()).map(s => s.trim());
                    this.valIdx = this.initTextValue.substring(0, this.initCaretPos).split(this.separator.trim()).length - 1;
                }
                if (this.valuesSplitted) {
                    this.valuesSplitted[this.valIdx] = selval;
                    newCaretPos = selval.length;
                    selval = this.valuesSplitted.join(this.separator);
                    for (let i = 0; i < this.valIdx; i++)
                        newCaretPos += this.separator.length + this.valuesSplitted[i].length;
                }
            }
            this.setEditValue(selval, newCaretPos);
        }.bind(this);
    }

    handleKeypressed(key, shiftKey?:boolean, ctrlKey?:boolean, altKey?:boolean, metaKey?:boolean) {
        if ((!this.items) || (!this.items.controlClass))
            throw ('Dropdown not initialized');
        if (key === 'Enter') {
            if (this.checkboxes) {
                key = 'Space'; // #20374
            } else {
                this.selectChange();                   
                this.forcedCloseWindow();
                return;                
            }                                                     
        }
        /**
            Fires when a key is pressed in the dropdown.
            @event keydown
        */
        let evt = createNewEvent('keydown') as NotifyEvent;
        evt.key = key;
        evt.shiftKey = shiftKey;
        evt.ctrlKey = ctrlKey;
        evt.altKey = altKey;
        evt.metaKey = metaKey;
        this.items.controlClass.handle_keydown(evt);
    }


    filterLV(newval, caretPos, updateCaretOnly, addingChars) {
        if (!this.filtering)
            return;
        if ((!this.getEditValue) || (this.separator === undefined) || !this.items || !this.items.controlClass)
            throw ('Dropdown not initialized');

        if (this.initFilterValue) {
            this.initFilterValue = ''; // #17377, we have new filter value, do not use init value later
        }
        let val;
        if (this.multivalue) {
        // updateCaretOnly -> refilter only when position changed to different index and we were filtering already before
            let valIdx;
            this.valuesSplitted = newval.split(this.separator.trim()).map(s => s.trim());
            if ((caretPos !== undefined) && (newval !== '')) {
                let preCaretStr = newval.substring(0, caretPos);
                valIdx = preCaretStr.split(this.separator.trim()).length - 1;
            } else {
                valIdx = this.valuesSplitted.length - 1;
            }
            if (updateCaretOnly && ((valIdx === this.valIdx) || !this.filtered)) {
                this.valIdx = valIdx;
                return;
            }
            this.valIdx = valIdx;
            if (this.valuesSplitted.length) {
                val = this.valuesSplitted[this.valIdx].toUpperCase();
            } else
                val = '';

        } else
            val = newval.trim();

        if (this.items.controlClass.data) {
            this.lockedEditValue = true;
            if ((val === '') || this.isDropdownList) {
                this.items.controlClass.dataSource = this.items.controlClass.data;
            } else {
                if (this.items.controlClass.data.filterByPrefix) {
                    let flts = val;
                    if (val.indexOf(' ') > 0)
                        flts = '"' + flts + '"'; // LS: make it quoted so that space is not used as OR operator
                    this.items.controlClass.dataSource = this.items.controlClass.data.filterByPrefix(flts);
                    if (this.autoComplete) {
                        let filteredDS = this.items.controlClass.dataSource;
                        filteredDS.whenLoaded().then(() => {
                            if (filteredDS.count == 1 && addingChars) { // just one suggestion remains, use it (#20389)                            
                                let caretPos = this.getCaretPos();
                                let oldVal = this.getEditValue();
                                let newVal = getValueAtIndex(filteredDS, 0);
                                let lastSepPos = oldVal.toString().lastIndexOf(this.separator.trim());
                                if (this.multivalue && lastSepPos >= caretPos)
                                    return;

                                let tail = newVal.toString().substring(caretPos);               
                                if (this.multivalue && lastSepPos >= 0) {
                                    let splitPos = caretPos - lastSepPos - 1;
                                    let i = 1;
                                    while (oldVal.toString()[lastSepPos+i] == ' ') {
                                        i++;
                                        splitPos--;
                                    }
                                    tail = newVal.toString().substring(splitPos);               
                                }

                                let useVal = oldVal.substring(0, caretPos) + tail;
                                this.setEditValue(useVal, caretPos, true);
                            }
                        });
                    }
                }
            }
            // setting first item focused removed now, delete, if it will work ok
            // if (this.items.controlClass.dataSource.count > 0)
            //      this.items.controlClass.setFocusedAndSelectedIndex(0);

            this.lockedEditValue = false;
        }
        if (this.isDropdownList && !updateCaretOnly) {
            this.items.controlClass.supressIncrementalSearchToasts = true;
            this.items.controlClass._handleIncrementalSearch(val);
        }
        this.filtered = true;
    }


    initDropdown(params) {
        this.focusedIndex = -2;
        this.items = document.createElement('div') as ElementWith<DropdownList>;
        this.items.setAttribute('data-id', 'items');
        this.items.className = 'fill dropdownList';
        this.parentel.appendChild(this.items);      
        this.items.controlClass = new DropdownList(this.items, {
            checkboxes: this.checkboxes,
            multivalue: this.multivalue,
            dropdownItemFormat: this.dropdownItemFormat,
            preserveSpaces: this.preserveSpaces,
            textOnly: this.textOnly
        });
        app.listen(this.items, 'sizechanged', this.resizeDropdownWindow);
        this.lockedEditValue = false;
        if (this.valuelist) {
            if (this.isDropdownList || !usePopupWindows) {
                this.items.controlClass.data = this.valuelist;
            } else {
            // copy list to have it in this context
                let d = this.valuelist;
                this.items.controlClass.data = newStringList();
                d.forEach(function (obj) {
                    this.items.controlClass.data.add(obj.toString());
                }.bind(this));
            }
        } else
        if (this.dbProp && (app.db[this.dbProp] !== undefined)) {
            this.items.controlClass.data = app.db[this.dbProp];
        } else if (this.dbFunc && (app.db[this.dbFunc] !== undefined)) {
            this.items.controlClass.data = app.db[this.dbFunc](this.dbFuncParams);
        }
        let w = this.controlWidth;
        w -= getOuterWidth(this.items);

        if (this.controlWidth) {
            this.items.style.width = w + 'px';
            this.items.style.maxWidth = w + 'px';
        }
        if (!params.preserveFocus) { // reset focus, so we can set it right later
            if (this.items.controlClass.data)
                this.items.controlClass.data.focusedIndex = -1;
            else
                this.items.controlClass.focusedIndex = -1;
        }

        if (this.items.controlClass.data) {
            if (this.multivalue && this.initTextValue && (this.initCaretPos !== undefined)) {
            // prepare data, so the selected value is correctly inserted to the place of caret
                this.valuesSplitted = this.initTextValue.split(this.separator.trim()).map(s => s.trim());
                this.valIdx = this.initTextValue.substring(0, this.initCaretPos).split(this.separator.trim()).length - 1;
            }

            if (!this.filtering || !this.initFilterValue || this.isDropdownList) {
                this.items.controlClass.dataSource = this.items.controlClass.data;
                this.resizeDropdownWindow();
            } else {
                this.items.controlClass.localPromise(this.items.controlClass.data.whenLoaded()).then(function () {
                    if (this.initFilterValue && this.filtering && this.items.controlClass.data) {
                        this.filterLV(this.initFilterValue, this.initCaretPos);
                        this.initFilterValue = '';
                    }
                }.bind(this));
            }
        } else
            this.resizeDropdownWindow();

        if (!this.checkboxes) {
            //app.listen(this.items, 'focuschange', this.selectChange); //#19096
            app.listen(this.items, 'mouseup', this.mouseupDropdown, true);
        } else {
            this.handleDSChange = () => {
                this.items.controlClass.requestTimeout(() => {
                    let lst = this.items.controlClass.data;
                    if ((lst !== undefined) && (this.multivalue) && (this.window !== undefined)) {
                        let list = lst.getCheckedList();
                        this.items.controlClass.localPromise(list.whenLoaded()).then(function () {
                            list.locked(function () {
                                let val = '';
                                for (let i = 0; i < list.count; i++) {
                                    if (val !== '')
                                        val += this.separator;
                                    val += list.getValue(i).toString();
                                }
                                this.setEditValue(val);
                            }.bind(this));
                        }.bind(this));
                    }
                }, 50, 'handleDSChange');
            };

            if (this.valuelist) {
                app.listen(this.valuelist, 'change', this.handleDSChange);
            }
        }
        this.eventsSet = true;
    }


    forcedCloseWindow() {
        this.cleanUp();
        let tmp = this.window;
        this.window = undefined;
        if (tmp)
            tmp.closeWindow();

        /**
            Fires when the dropdown popup is closed. Different from {@link dropdownclosed} because this fires no matter whether the value changes or not.
            @event popupclosed
        */
        if(this.owner.container) {
            let evt = createNewEvent('popupclosed');
            this.owner.container.dispatchEvent(evt);
        }
    }

    getFocusedIndex() {
        let retval = -2;
        if (this.focusedIndex !== undefined)
            retval = this.focusedIndex;
        return retval;
    }

    cleanUp() {
        if (!this.eventsSet)
            return;
        app.unlisten(this.items, 'sizechanged', this.resizeDropdownWindow);
        if (!this.checkboxes) {
            //app.unlisten(this.items, 'focuschange', this.selectChange);
            app.unlisten(this.items, 'mouseup', this.mouseupDropdown, true);
        } else {
            if (this.valuelist) {
                app.unlisten(this.valuelist, 'change', this.handleDSChange);
            }
        }
        this.eventsSet = false;
    }

    isDropdownListEmpty() {
        return !this.items.controlClass.dataSource || (this.items.controlClass.dataSource.count === 0);
    }

}
registerClass(DropdownHandler);

//  -----  DropdownList -------------------------------------
class DropdownList extends ListView {
    isDropDownList: boolean;
    checkboxes: boolean;
    dropdownItemFormat: any;
    preserveSpaces: boolean;
    textOnly: boolean;
    data: any;

    initialize(rootelem, params) {
        params.multiselect = (params.multivalue && params.checkboxes);
        params.itemCloningAllowed = false;
        params.ignoreReflowOptimizations = true; // #18600, TODO: Less hacky workaround
        super.initialize(rootelem, params);
        this.isDropDownList = false;
        this.checkboxes = params.checkboxes;
        this.dropdownItemFormat = params.dropdownItemFormat;
    }

    setUpDiv(div) {
        div.classList.add('rowitem');
        div.classList.add('dropdownitem');
        div.classList.add('flex');
        div.classList.add('row');
        div.style.alignItems = 'center';
        if (this.checkboxes) {
            let list = div.parentListView;
            let checkChange = function (e) {
                if (this.controlClass !== undefined) {
                    list.__prevent_cs_binding = true; // needed to get correct check state value in bindData (until the modifyAsync is finished)
                    let ds = list.dataSource;
                    ds.modifyAsync(function () {
                        list.__prevent_cs_binding = false;
                        if (this.controlClass) {
                            ds.setChecked(this.itemIndex, this.controlClass.checked);

                            let event = createNewCustomEvent('checkedchanged', {
                                detail: null,
                                bubbles: true,
                                cancelable: true
                            });
                            list.container.dispatchEvent(event);
                        }
                    }.bind(this));
                }
            };

            div.dataCB = document.createElement('div');
            div.dataCB.controlClass = new Checkbox(div.dataCB, {
                type: 'checkbox'
            });
            div.appendChild(div.dataCB);
            app.listen(div.dataCB, 'change', checkChange);
        }
        div.dataDiv = document.createElement('div');
        div.dataDiv.classList.add('dropdowndata');
        div.dataDiv.classList.add('fill');
        div.dataDiv.classList.add('verticalCenter');
        div.appendChild(div.dataDiv);
    }

    bindData(div, index) {
        if (this.dataSource && div && (div.dataDiv !== undefined)) {
            let valO = this.dataSource.getValue(index);
            if (valO) {
                let val = valO.toString();
                if (isFunction(this.dropdownItemFormat))
                    val = this.dropdownItemFormat(val, valO);
                if (val === dropdownMenuSeparator) {
                    div.dataDiv.innerHTML = '<hr>';
                    div.dataDiv.classList.add('menuseparator');
                    div.dataDiv.setAttribute('data-disabled', 1);
                    div.setAttribute('data-disabled', 1);
                    return;
                } else {
                    div.dataDiv.removeAttribute('data-disabled');
                    div.removeAttribute('data-disabled');
                    div.dataDiv.classList.remove('menuseparator');
                }
                if (this.preserveSpaces) {
                    // preserve spaces
                    let oldVal = val;
                    val = val.replace(/ /g, '&nbsp;');
                }
                if (this.textOnly && !this.preserveSpaces) {
                    div.dataDiv.textContent = val;
                } else {
                    div.dataDiv.innerHTML = sanitizeHtml(val);
                }
                div.dataDiv.itemIndex = index;
                if (div.dataCB) {
                    div.dataCB.itemIndex = index;
                    if (!div.parentListView.__prevent_cs_binding)
                        div.dataCB.controlClass.checked = this.dataSource.isChecked(index);
                }
            }
        }
    }

    cvalue(idx) {
        let txt = '';
        let ds = this.dataSource;
        if (!ds)
            return txt;
        let i = this.focusedIndex;
        if (idx !== undefined)
            i = parseInt(idx);

        if (i >= 0) {
            ds.locked(function () {
                if (i < ds.count)
                    txt = ds.getValue(i).toString();
            }.bind(this));
        }
        return txt;
    }

    selectByValue(aVal) {
        return this.selectFirstByPrefix(aVal, true);
    }

    selectFirstByPrefix(aVal, exact) {
        if ((aVal === undefined) || (aVal === ''))
            return;
        exact = exact || false;
        let txt = '';
        let retval = false;
        let val = aVal.toUpperCase();
        for (let i = 0; i < this.itemCount; i++) {
            txt = this.cvalue(i).toUpperCase();
            if ((!exact && (txt.indexOf(val) === 0)) || (exact && (txt === val))) {
                this.setFocusedAndSelectedIndex(i);
                this.setItemFullyVisible(i);
                retval = true;
                break;
            }
        }
        return retval;
    }
}
registerClass(DropdownList);
