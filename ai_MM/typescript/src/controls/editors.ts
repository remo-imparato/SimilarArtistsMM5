/* eslint-disable no-case-declarations */
'use sctrict';
registerFileImport('controls/editors');

let _currentEditor = undefined;

// @ts-ignore
window.getCurrentEditor = function () {
    return _currentEditor;
};

let doClose = function () {
    if (this.dataSourceChangeEvent) {
        app.unlisten(this.listview.container, 'datasourcechanged', this.dataSourceChangeEvent);
        app.unlisten(this.dataSource, 'sorted', this.dataSourceChangeEvent);
        if (this.editorFocusChange) {
            app.unlisten(this.dataSource, 'focuschange', this.dataSourceFocusChange);
            app.unlisten(this.editline, 'change');
        }
        this.dataSourceChangeEvent = undefined;
    }
    let edt = this.editline;
    this.editline = undefined;
    if (edt && edt.parentNode) {
        removeElement(edt);
    }
    _currentEditor = undefined;
    this.listview.setFocus();
};

let afterSave = function (item) {
    if (item.commitAsync) {
        if (item.objectType == 'track') {
            item.commitAsync({
                forceSaveToDB: _utils.isOnlineTrack(item) // #17506
            });
        } else {
            item.commitAsync();
        }
    }
};

let doSave = function (div, item, val, raw) {
    let dontSave = this.setValue(item, val, raw, div.itemIndex, this); // the index is needed in Auto tag dialogs!
    if (!dontSave) // when saving is not desirable (e.g. Auto tag dialogs)
        afterSave.call(this, item);
    doClose.call(this);
};

let doInit = function (div) {
    this.editline.setAttribute('data-editing', '1');
    this.editline.classList.add('inlineEdit');
    if (this.align) {
        if (this.align === 'right')
            this.editline.classList.add('textRight');
        else if (this.align === 'center')
            this.editline.classList.add('textCenter');
    }
    _currentEditor = this.editline;
};

let doGetValue = function (item, itemIndex) {
    return new Promise((resolve, reject) => {
        let val;
        if (this.getValueAsync)
            val = this.getValueAsync(item, true, itemIndex);
        else
            val = this.getValue(item, true, itemIndex);

        if (isPromise(val)) {
            val.then(function (val) {
                if (!window._cleanUpCalled)
                    resolve(val);
                else
                    reject();
            });
        } else {
            if (!window._cleanUpCalled)
                resolve(val);
            else
                reject();
        }
    });
};

let doInitSize = function (div) {
    this.editline.style.zIndex = '9999999';
    this.editline.style.position = 'absolute';

    if (this.beforePosition)
        this.beforePosition();

    let totalpos = div.getBoundingClientRect();
    let origpos = totalpos;

    // check we need more width than parent's width
    if (this.editline.controlClass && this.editline.controlClass.calcAutoWidth) {
        this.editline.controlClass.calcAutoWidth();
        let w = parseInt(this.editline.controlClass.edit.style.width);

        if (w > totalpos.width) {
            // totalpos has readonly properties so we need to make a copy
            totalpos = {
                left: totalpos.left,
                top: totalpos.top,
                right: totalpos.right,
                bottom: totalpos.bottom,
                width: totalpos.width,
                height: totalpos.height
            };

            let requiredWidth = w + 20 /* space */;

            let lvAbsPos = getAbsPosRect(this.listview.container);
            let _borderSize = thisWindow.borderSize;
            if (thisWindow.headerClass)
                _borderSize = headerClass.borderSize;
            let _lvRight = Math.min(lvAbsPos.right, thisWindow.bounds.width - _borderSize);

            totalpos.right = totalpos.left + requiredWidth;
            totalpos.width = totalpos.right - totalpos.left;

            if (totalpos.right > _lvRight) {
                totalpos.right = _lvRight;
                totalpos.left = Math.max(lvAbsPos.left, totalpos.right - requiredWidth);
                totalpos.width = totalpos.right - totalpos.left;
            }
        }
        this.editline.controlClass.edit.style.width = '';
        if ((origpos.left !== totalpos.left) && (this.editline.controlClass.expanded)) {
            let _canvas = this.listview.canvas;
            if (this.listview.dynamicSize && this.listview.scrollingParent)
                _canvas = this.listview.scrollingParent; // #15382
            window.lockedLayout(_canvas, () => {
                _canvas.scrollLeft = _canvas.scrollLeft + Math.abs(totalpos.left - origpos.left);
                this.listview.requestTimeout(() => {
                    // request small timeout before start editing (to scroll and repaint LV) .. otherwise focused item is not created and editing not start
                    this.listview.editStart();
                }, 10);
            });
        }
    }

    this.editline.style.top = totalpos.top;
    this.editline.style.left = totalpos.left;
    this.editline.style.width = resolveToValue(this.fullSize, false) ? (this.listview.container.clientWidth - totalpos.left) : Math.min(totalpos.width, isFunction(this.listview.getVisibleRect) ? this.listview.getVisibleRect().width : totalpos.width);
    this.editline.style.height = totalpos.height;
};

let doInitEvents = function (control) {
    let _this = this;
    this.dataSource = this.listview.dataSource;
    if (this.dataSource) {
        if (this.dataSource.focusedItem) {
            this.currentItemPersistentID = this.dataSource.focusedItem.persistentID;
        } else {
            this.currentItemPersistentID = undefined;
        }
        this.dataSourceChangeEvent = function (e) { // datasource changed ... let's find current editing track and scroll to it
            let newList = _this.dataSource;
            if (e && e.detail) {
                newList = e.detail.newDataSource;
            }
            if (newList) {
                let focusedItem = newList.focusedItem;
                let newItem = focusedItem ? focusedItem.persistentID : undefined;
                if (newItem != _this.currentItemPersistentID) {
                    _this.listview.editCancel();
                    newList.indexOfPersistentIDAsync(_this.currentItemPersistentID).then(function (idx) {
                        if (idx >= 0) {
                            newList.focusedIndex = idx;
                            let oldScroll = _this.listview.smoothScroll;
                            _this.listview.smoothScroll = false; // disable smooth scroll so scroll to new index will be asap
                            _this.listview._setItemFullyVisible(idx);
                            _this.listview.smoothScroll = oldScroll;
                            _this.listview.requestTimeout(function () {
                                // request small timeout before start editing (to scroll and repaint LV) .. otherwise focused item is not created and editing not start
                                _this.listview.editStart();
                            }, 10);
                        }
                    });
                }
            }
        };
        this.dataSourceFocusChange = function (index, oldIndex) {
            if (_this.editorFocusChange) {
                _this.editorFocusChange(index, oldIndex);
            }
        };
        app.listen(this.dataSource, 'sorted', this.dataSourceChangeEvent);
        if (this.editorFocusChange) {
            app.listen(this.dataSource, 'focuschange', this.dataSourceFocusChange);
            app.listen(this.editline, 'change', function () {
                if (_this.dataSource) {
                    if (_this.editline && _this.editline.controlClass && _this.editline.controlClass.dataSource) {
                        let value = _this.editline.controlClass.value;
                        _this.dataSourceFocusChange(_this.editline.controlClass.dataSource.indexOf(value), -1);
                    }
                }
            });
        }
        app.listen(this.listview.container, 'datasourcechanged', this.dataSourceChangeEvent);
    }

    if (!this.listview._editFieldListenerInitialized) {
        // following is workaround to resolve #18729
        this.listview._editFieldTransition = false;
        this.listview.localListen(window, 'keydown', (e) => {
            if (this.listview._editFieldTransition)
                e.preventDefault();
        });
        this.listview._editFieldListenerInitialized = true;
    }

    app.listen(control, 'keydown', (e) => {
        switch (friendlyKeyName(e)) {
        case 'Enter':
            if (!e.shiftKey && this.editline && !e.cancelBubble /* TODO: why it bubbles at all? */) {
                this.listview.editSave();
                e.stopPropagation();
            }
            break;
        case 'Esc':
            this.listview.editCancel();
            e.stopPropagation();
            break;
        case 'Tab':
            this.listview.editSave(true);            
            let ok = false;
            if (e.shiftKey) {
                if (isFunction(this.listview.moveFocusLeft))
                    ok = this.listview.moveFocusLeft(true);
            } else {
                if (isFunction(this.listview.moveFocusRight))
                    ok = this.listview.moveFocusRight(true);
            }
            if (ok) {
                // LS: timeout needed here, otherwise we would get another 'Tab' 'keydown' event imediatelly and it would get to the next item and so on (#15084)
                this.listview._editFieldTransition = true;
                this.listview.requestTimeout(() => {
                    this.listview.editStart();
                    this.listview._editFieldTransition = false;
                }, 20);
            } else {
                this.listview.editCancel();
            }

            e.stopPropagation();
            e.preventDefault(); // TODO: why this does not stop the Tab default and need to be supressed on the window level (via _editFieldTransition workaround above) ?
            break;
        }
    }); // cannot be capture, Enter is then not sent correctly to Dropdowns
    app.listen(control, 'blur', function () {
        if (this.editline) {
            if (this.editline.controlClass && resolveToValue(this.editline.controlClass.capturesSet, false)) {
                // multivalue edit is focused
            } else {
                this.listview.editSave(false, true);
            }
        }
        //doClose.call(this);
    }.bind(this));
};

function setSelection(el, doNotSelectAll?:boolean) {
    let elem = el;
    if (el.controlClass) {
        if (el.controlClass.focus)
            el.controlClass.focus();
        else if (el.controlClass.edit)
            el.controlClass.edit.focus();
        elem = el.controlClass.edit;
    } else
        el.focus();

    if (elem) {
        let s = elem.value;
        if (s.length && elem.setSelectionRange) {
            window.requestTimeout(function () {
                if ((elem.type === 'number')) {
                    elem.select();
                } else {
                    if (!doNotSelectAll)
                        elem.setSelectionRange(0, s.length, 'backward');
                    else
                        elem.setSelectionRange(0, 0);
                }
                elem.scrollTop = 0;
            }, 0);
        }
    }
}

window.editors = {
    /**
    A set of functions for inline editing of cells. Currenly available is textEdit (ordinary editline),
    Multi value edit (edit line for multi value fields like Artist), Date edit. Use as

        column.editor = editors.gridViewEditors.textEdit;
        column.editor = editors.gridViewEditors.numberEdit;
        column.editor = editors.gridViewEditors.multiValueEdit;
        column.editor = editors.gridViewEditors.dateEdit;

    @property editors.gridViewEditors
    @type Object
    */
    gridViewEditors: {
        textEdit: function (action, div, item) {

            if (!div.offsetParent) // this happened in crash log A14AD65E, why?
                return;            

            switch (action) {
            case 'edit':
                this.editline = document.createElement('div');
                this.editline.setAttribute('data-control-class', 'Edit');
                this.editline.setAttribute('data-init-params', '{type: \'text\'}');
                doInit.call(this, div);
                document.body.appendChild(this.editline);
                initializeControl(this.editline);
                doGetValue.call(this, item, div.offsetParent.itemIndex).then((val) => {
                    this.editline.controlClass.value = val;
                    doInitSize.call(this, div);
                    doInitEvents.call(this, this.editline);
                    setSelection(this.editline, this.editline.controlClass.readOnly);
                });

                return true;
            case 'save':
                if (this.editline && this.editline.controlClass) {
                    doSave.call(this, div, item, this.editline.controlClass.value);
                } else {
                    doClose.call(this);
                }
                break;
            case 'cancel':
                doClose.call(this);
                break;
            }
        },

        numberEdit: function (action, div, item) {

            if (!div.offsetParent) // this happened in crash log A14AD65E, why?
                return;             

            switch (action) {
            case 'edit':
                this.editline = document.createElement('div');
                this.editline.setAttribute('data-control-class', 'Edit');
                this.editline.setAttribute('data-init-params', '{type: \'number\'}');
                doInit.call(this, div);
                document.body.appendChild(this.editline);
                initializeControl(this.editline);
                doGetValue.call(this, item, div.offsetParent.itemIndex).then((val) => {
                    this.editline.controlClass.value = val;
                    doInitSize.call(this, div);
                    doInitEvents.call(this, this.editline);
                    setSelection(this.editline, this.editline.controlClass.readOnly);
                });

                return true;
            case 'save':
                if (this.editline && this.editline.controlClass) {
                    doSave.call(this, div, item, parseInt(this.editline.controlClass.value));
                } else {
                    doClose.call(this);
                }
                break;
            case 'cancel':
                doClose.call(this);
                break;
            }
        },

        rating: function (action, div, item, byMouseDblClick) {
            if (!div.offsetParent || byMouseDblClick)
                return;
            switch (action) {
            case 'edit':
                this.editline = document.createElement('div');
                this.editline.setAttribute('data-control-class', 'Rating');
                this.editline.setAttribute('data-init-params', '{useUnknown: true, unkownText: "", readOnly: false, tabbable: true, position: "left", starWidth: "1.2em", paddingRight: "0px"}');
                doInit.call(this, div);
                document.body.appendChild(this.editline);
                initializeControl(this.editline);
                doGetValue.call(this, item, div.offsetParent.itemIndex).then((val) => {
                    this.editline.controlClass.value = val;
                    doInitSize.call(this, div);
                    doInitEvents.call(this, this.editline);
                    setSelection(this.editline, this.editline.controlClass.readOnly);
                }); 
                return true;
            case 'save':
                if (this.editline && this.editline.controlClass) {
                    doSave.call(this, div, item, parseInt(this.editline.controlClass.value));
                } else {
                    doClose.call(this);
                }
                break;
            case 'cancel':
                doClose.call(this);
                break;
            }
        },

        multiValueEdit: function (action, div, item) {

            if (!div.offsetParent) // this happened in crash log A14AD65E, why?
                return;

            switch (action) {
            case 'edit':
                this.editline = document.createElement('div');
                this.editline.setAttribute('data-control-class', 'Dropdown');
                this.editline.setAttribute('data-init-params', this.editorParams);
                doInit.call(this, div);
                document.body.appendChild(this.editline);
                initializeControl(this.editline);
                doGetValue.call(this, item, div.offsetParent.itemIndex).then((val) => {
                    this.editline.controlClass.setEditValue(val);
                    if (this.editorData !== undefined) {
                        this.editline.controlClass.dataSource = resolveToValue(this.editorData, undefined, {
                            item: item,
                            itemIndex: div.offsetParent.itemIndex
                        });
                    }
                    if (this.editorItemFormat !== undefined)
                        this.editline.controlClass.dropdownItemFormat = this.editorItemFormat;
                    doInitSize.call(this, div);
                    doInitEvents.call(this, this.editline.controlClass.edit);
                    setSelection(this.editline, this.editline.controlClass.readOnly);
                });

                return true;
            case 'save':                
                if (this.editline && this.editline.controlClass) {
                    let val = app.utils.visualString2MultiString(this.editline.controlClass.getEditValue());
                    doSave.call(this, div, item, val);
                } else {
                    doClose.call(this);
                }
                break;
            case 'cancel':
                doClose.call(this);
                break;
            }

        },

        textDropdownEdit: function (action, div, item) {

            if (!div.offsetParent) // this happened in crash log A14AD65E, why?
                return;

            switch (action) {
            case 'edit':
                this.editline = document.createElement('div');
                this.editline.setAttribute('data-control-class', 'Dropdown');
                this.editline.setAttribute('data-init-params', this.editorParams);
                doInit.call(this, div);
                document.body.appendChild(this.editline);
                initializeControl(this.editline);
                this.editline.controlClass.multivalue = false;
                doGetValue.call(this, item, div.offsetParent.itemIndex).then((val) => {
                    this.editline.controlClass.setEditValue(val);
                    if (this.editorData !== undefined) {
                        this.editline.controlClass.dataSource = resolveToValue(this.editorData, undefined, {
                            item: item,
                            itemIndex: div.offsetParent.itemIndex
                        });
                    }
                    if (this.editorItemFormat !== undefined)
                        this.editline.controlClass.dropdownItemFormat = this.editorItemFormat;
                    doInitSize.call(this, div);
                    doInitEvents.call(this, this.editline.controlClass.edit);
                    setSelection(this.editline, this.editline.controlClass.readOnly);
                });

                return true;
            case 'save':
                if (this.editline && this.editline.controlClass) { 
                    let val = this.editline.controlClass.getEditValue();
                    doSave.call(this, div, item, val);
                } else {
                    doClose.call(this);
                }
                break;
            case 'cancel':
                doClose.call(this);
                break;
            }

        },

        dateEdit: function (action, div, item) {

            if (!div.offsetParent) // this happened in crash log A14AD65E, why?
                return;

            switch (action) {
            case 'edit':
                this.editline = document.createElement('input');
                this.editline.type = 'text';
                doInit.call(this, div);
                doInitSize.call(this, div);
                doInitEvents.call(this, this.editline);
                let rawval = this.getValue(item, true /* raw data, not fomatted */, div.offsetParent.itemIndex);
                let textVal = '';
                if (rawval > 0) {
                    textVal = app.utils.myEncodeDate(rawval);
                }
                this.editline.value = textVal;
                document.body.appendChild(this.editline);
                setSelection(this.editline);

                return true;
            case 'save':
                if (this.editline) { 
                    let val = this.editline.value;
                    let n = app.utils.myDecodeDate(val);
                    doSave.call(this, div, item, n, true /* raw */);
                } else {
                    doClose.call(this);
                }
                break;
            case 'cancel':
                doClose.call(this);
                break;
            }
        },
        multiLineEdit: function (action, div, item) {

            if (!div.offsetParent) // this happened in crash log A14AD65E, why?
                return;

            switch (action) {
            case 'edit':
                this.editline = document.createElement('textarea');
                this.editline.rows = '10';
                doInit.call(this, div);
                document.body.appendChild(this.editline);
                initializeControl(this.editline);
                doGetValue.call(this, item, div.offsetParent.itemIndex).then((val) => {
                    this.editline.value = val;
                    doInitSize.call(this, div);
                    this.editline.style.height = ''; // reset, so it uses whole 2 lines
                    doInitEvents.call(this, this.editline);
                    setSelection(this.editline, true);
                });
                return true;
            case 'save':
                if (this.editline) {
                    doSave.call(this, div, item, this.editline.value);
                } else {
                    doClose.call(this);
                }
                break;
            case 'cancel':
                doClose.call(this);
                break;
            }
        }
    }
};

