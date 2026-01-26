/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

'use strict';
import Control from './control';
registerFileImport('controls/searchEditor');
/**
@module UI Snippets
*/
/**
Search rules and auto-playlist editor

@class SearchEditor
@constructor
@extends Control
*/
export default class SearchEditor extends Control {
    initialize(rootelem, params) {
        super.initialize(rootelem, params);
        this.QueryData = null;
        this.CurrentRule = null;
        this.inEditRow = null;
        this.inEditSortRow = null;
        this.ValueControls = ['cbValue', 'cbFrom', 'cbTo', 'cbRating', 'cbCheckList'];
        this.purposeType = 'search';
        this._animationTimeout = animTools.animationTime * 1000; /*ms*/
        this.container.innerHTML = window.loadFile('file:///controls/searchEditor.html');
        initializeControls(this.container);
        this._initListeners();
        setVisibility(this.qChild('cbField'), false);
        setVisibility(this.qChild('cbOperator'), false);
    }
    assignHelpContext(helpid) {
        this.helpContext = helpid;
        let addBtn = this.qChild('aAddRule');
        if (addBtn && addBtn.controlClass) {
            addBtn.controlClass.helpContext = helpid;
        }
    }
    _loadValues(QueryData) {
        this._loadingNewValues = true;
        this._cleanSearchRows();
        this._cleanSortRows();
        let cbColl = this.qChild('cbCollection');
        if (cbColl.controlClass.value == QueryData.collection)
            this.refreshRules();
        else
            cbColl.controlClass.value = QueryData.collection; // individual rules are added via refreshRules in _collectionChanged
        let chbLimit = this.qChild('chbLimit');
        chbLimit.controlClass.checked = QueryData.maxCountEnabled || QueryData.maxBytesEnabled || QueryData.maxLenEnabled;
        chbLimit.controlClass.raiseEvent('change'); // #20475 - 4)
        let edtCls = this.qChild('edtLimitCount').controlClass;
        let cbCls = this.qChild('cbLimitType').controlClass;
        let cbLimitOrder = this.qChild('cbLimitOrder');
        cbLimitOrder.controlClass.dataSource = this.QueryData.getAllLimitOrdersList();
        cbLimitOrder.controlClass.focusedIndex = this.QueryData.limitOrderIndex;
        if (QueryData.maxCountEnabled) {
            edtCls.value = QueryData.maxCountValue;
            cbCls.focusedIndex = 0;
        }
        else if (QueryData.maxBytesEnabled) {
            edtCls.value = QueryData.maxBytesValue;
            cbCls.focusedIndex = 1;
        }
        else if (QueryData.maxLenEnabled) {
            edtCls.value = QueryData.maxLenValue;
            cbCls.focusedIndex = 2;
        }
        else {
            // pre-defined default (50 files)
            cbCls.focusedIndex = 0;
            edtCls.value = 50;
        }
        this.qChild('cbField').controlClass.dataSource = QueryData.allFieldsList;
        this._createAddButtonMenu(this.qChild('aAddRule'), undefined);
        let sortOrders = QueryData.getSortOrders();
        for (let i = 0; i < sortOrders.length; i++) {
            this._addSort2UI(sortOrders[i].name, sortOrders[i].ascending);
        }
        this._loadingNewValues = false;
    }
    setQueryData(aQD) {
        this.QueryData = aQD;
        assert(this.QueryData, 'QueryData is null');
        this._loadValues(this.QueryData);
    }
    _cleanSearchRows() {
        let VT = this.qChild('vtRules');
        for (let i = VT.childNodes.length - 1; i >= 0; i--) {
            let row = VT.childNodes[i];
            if (row.rule) {
                if (row.rule.isOperator)
                    this._cleanOperatorDiv(row);
                else
                    this._cleanSearchRow(row);
                VT.removeChild(row);
            }
        }
    }
    _cleanSortRows() {
        let VT = this.qChild('vtSortRules');
        for (let i = VT.childNodes.length - 1; i >= 0; i--) {
            let row = VT.childNodes[i];
            this._cleanSortRow(row);
            VT.removeChild(row);
        }
    }
    cleanUp() {
        app.unlisten(this.qChild('cbMatch'));
        app.unlisten(this.qChild('cbCollection'));
        app.unlisten(this.qChild('aAddSortRule'));
        app.unlisten(this.qChild('cbCollection'));
        app.unlisten(this.qChild('cbField'));
        app.unlisten(this.qChild('mainSearchEditorDiv'));
        app.unlisten(this.qChild('cbOperator'));
        for (let i = 0; i < this.ValueControls.length; i++) {
            let ValueControl = this.qChild(this.ValueControls[i]);
            app.unlisten(ValueControl);
            app.unlisten(ValueControl);
        }
        this._cleanSearchRows();
        this._cleanSortRows();
        setVisibility(this.container, false);
        super.cleanUp();
    }
    closeEditing() {
        if (this.inEditRow)
            this._onRowEdited(this.inEditRow);
        if (this.inEditSortRow)
            this._onSortEdited(this.inEditSortRow);
    }
    _checkCloseEdit() {
        clearTimeout(this._closeEditTm);
        this._closeEditTm = this.requestTimeout(() => {
            let closeEdit = true;
            if ((document.activeElement.nodeName == 'INPUT') || (getParent(document.activeElement).getAttribute('data-id') == 'cbRating'))
                closeEdit = false;
            if (closeEdit)
                this.closeEditing();
        }, 500); // to prevent from close edit before the edit actually started (e.g. on animated row adding/editing) - #14293 (item 23a)
    }
    _moveValueControls(row) {
        for (let i = 0; i < this.ValueControls.length; i++) {
            let ValueControl = this.qChild(this.ValueControls[i]);
            getParent(row.aValue).insertBefore(ValueControl, row.aValue);
        }
    }
    _hideEditControl(e) {
        this.qChild('harbor').appendChild(e); // move back to harbor (invisible dummy box)
        setVisibility(e, false);
    }
    _operatorChanged(params) {
        let cbOperator = this.qChild('cbOperator');
        this.CurrentRule.operatorName = cbOperator.controlClass.value;
        let ViewType = this.CurrentRule.getOperatorViewType();
        let cbValue = this.qChild('cbValue');
        let cbFrom = this.qChild('cbFrom');
        let cbTo = this.qChild('cbTo');
        let cbRating = this.qChild('cbRating');
        let cbCheckList = this.qChild('cbCheckList');
        setVisibility(cbValue, false);
        setVisibility(cbFrom, false);
        setVisibility(cbTo, false);
        setVisibility(cbRating, false);
        setVisibility(cbCheckList, false);
        cbCheckList.controlClass.closeDropdown(true);
        if (this.inEditRow)
            setVisibility(this.inEditRow.aValue, false);
        if (ViewType == 'qvtTextField') {
            setVisibility(cbValue, true);
            cbOperator.controlClass.blur();
            cbValue.controlClass.focus();
        }
        else if (ViewType == 'qvtFloat') {
            setVisibility(cbValue, true);
            cbOperator.controlClass.blur();
            cbValue.controlClass.focus();
        }
        else if (ViewType == 'qvtRange') {
            setVisibility(cbFrom, true);
            cbOperator.controlClass.blur();
            cbFrom.controlClass.focus();
            setVisibility(cbTo, true);
        }
        else if (ViewType == 'qvtRating') {
            setVisibility(cbRating, true);
            cbOperator.controlClass.blur();
            cbRating.controlClass.focus();
        }
        else if (ViewType == 'qvtCheckList') {
            setVisibility(cbCheckList, true);
            cbOperator.controlClass.blur();
        }
        else if (ViewType == 'qvtPlaylistTree') {
            // leaving the aValue ('click to set') visible
            if (this.inEditRow)
                setVisibility(this.inEditRow.aValue, true);
        }
        clearTimeout(this._closeEditTm);
        this.CurrentRule.getValuesAsync().then(function (Values) {
            clearTimeout(this._closeEditTm);
            let Value1 = '';
            let Value2 = '';
            Values.locked(function () {
                Value1 = Values.getValue(0);
                Value2 = Values.getValue(1);
            });
            if (ViewType == 'qvtTextField') {
                cbValue.controlClass.value = Value1;
                cbValue.controlClass.focus();
            }
            else if (ViewType == 'qvtFloat') {
                cbValue.controlClass.value = Value1;
                cbValue.controlClass.focus();
            }
            else if (ViewType == 'qvtRange') {
                cbFrom.controlClass.value = Value1;
                cbFrom.controlClass.focus();
                cbTo.controlClass.value = Value2;
            }
            else if (ViewType == 'qvtRating') {
                cbRating.controlClass.setRating(Value1);
                cbRating.controlClass.focus();
            }
            else if (ViewType == 'qvtCheckList') {
                let list = this.CurrentRule.getValuesList();
                cbCheckList.controlClass.dataSource = list;
                cbCheckList.controlClass.localPromise(list.whenLoaded()).then(() => {
                    cbCheckList.controlClass.value = Value1;
                    if (!params || !params.dontOpenValueList)
                        cbCheckList.controlClass.openDropdown(); // it will focus it too
                });
            }
        }.bind(this));
    }
    _valueChanged() {
        return new Promise(function (resolve, reject) {
            let Value1 = '';
            let Value2 = '';
            let cbValue = this.qChild('cbValue');
            let cbFrom = this.qChild('cbFrom');
            let cbTo = this.qChild('cbTo');
            let cbRating = this.qChild('cbRating');
            let cbCheckList = this.qChild('cbCheckList');
            let ViewType = this.CurrentRule.getOperatorViewType();
            if (ViewType == 'qvtTextField') {
                Value1 = cbValue.controlClass.value;
            }
            else if (ViewType == 'qvtFloat') {
                Value1 = cbValue.controlClass.value;
            }
            else if (ViewType == 'qvtRange') {
                Value1 = cbFrom.controlClass.value;
                Value2 = cbTo.controlClass.value;
            }
            else if (ViewType == 'qvtRating') {
                Value1 = cbRating.controlClass.value.toString();
                this.qChild('cbOperator').controlClass.blur(); // #15946                
            }
            else if (ViewType == 'qvtCheckList') {
                Value1 = cbCheckList.controlClass.value;
            }
            else if (ViewType == 'qvtPlaylistTree') {
                resolve();
                return; // this is done directly in this._showPlaylistTree()
            }
            this.CurrentRule.setValuesAsync(Value1, Value2).then(resolve);
        }.bind(this));
    }
    _onKeyUp(e) {
        let key = friendlyKeyName(e);
        if (key == 'Enter' || key == 'Esc') {
            if (this.inEditRow)
                this._onRowEdited(this.inEditRow);
        }
    }
    _onKeyDown(e) {
        let key = friendlyKeyName(e);
        if (key == 'Tab')
            this._checkCloseEdit();
    }
    _fieldChanged() {
        let cbOperator = this.qChild('cbOperator');
        this.CurrentRule.fieldName = this.qChild('cbField').controlClass.value;
        cbOperator.controlClass.dataSource = this.CurrentRule.getOperatorsList();
        if (cbOperator.controlClass.dataSource.indexOf(this.CurrentRule.operatorName) >= 0)
            cbOperator.controlClass.value = this.CurrentRule.operatorName;
        else
            cbOperator.controlClass.focusedIndex = 0;
        this._operatorChanged({
            dontOpenValueList: true // #16538
        });
    }
    refreshRules() {
        if (this.QueryData.matchAllCriteria)
            this.qChild('cbMatch').controlClass.focusedIndex = 0;
        else
            this.qChild('cbMatch').controlClass.focusedIndex = 1;
        let vtRules = this.qChild('vtRules');
        vtRules.style.minHeight = vtRules.clientHeight;
        enterLayoutLock(this.container);
        this._cleanSearchRows();
        this.QueryData.conditions.locked(function () {
            for (let i = 0; i < this.QueryData.conditions.count; i++) {
                let rule = this.QueryData.conditions.getValue(i);
                if (rule.isOperator)
                    this._addOperatorDiv(this._createOperatorDiv(rule));
                else
                    this._AddRule2UI(rule, false);
            }
        }.bind(this));
        leaveLayoutLock(this.container);
        this.requestTimeout(function () {
            // the trick with the minHeight here to prevent from flickering when re-freshing the rules once the Collection dropdown is changed
            vtRules.style.minHeight = '';
        }, 200);
    }
    _collectionChanged() {
        this.QueryData.collection = this.qChild('cbCollection').controlClass.value;
        let cbField = this.qChild('cbField');
        cbField.controlClass.dataSource = this.QueryData.allFieldsList;
        if (this.CurrentRule)
            cbField.controlClass.value = this.CurrentRule.fieldName;
        // we need to add rules to UI again, because when collection is changed then e.g. 'Artist' -> 'Director'
        if (this.inEditRow) {
            this._onRowEdited(this.inEditRow).then(this.refreshRules.bind(this));
        }
        else {
            this.refreshRules();
        }
    }
    _showPlaylistTree(row) {
        let aValue = row.aValue;
        this.QueryData.dontNotify = true; // to supress QueryData.endUpdate in _onRowEdited called from _checkCloseEdit fired by 'mouseup' on body el
        let dlg = uitools.openDialog('dlgSelectPlaylists', {
            checkedPlaylists: this.CurrentRule.getPlaylists(),
            modal: true
        });
        dlg.whenClosed = function () {
            this.QueryData.dontNotify = false;
            if (dlg.modalResult == 1) {
                let playlists = dlg.getValue('getPlaylists')();
                let commaIDs = '';
                playlists.locked(function () {
                    let pl;
                    for (let i = 0; i < playlists.count; i++) {
                        pl = playlists.getFastObject(i, pl);
                        if (i > 0)
                            commaIDs = commaIDs + ',';
                        commaIDs = commaIDs + pl.id;
                    }
                });
                let _this = this;
                this.CurrentRule.setValuesAsync(commaIDs, '').then(function () {
                    _this._getEditText(_this.CurrentRule).then(function (text) {
                        _this._setRuleText(aValue, text);
                        _this.closeEditing(); // #20205
                    });
                });
            }
        }.bind(this);
        app.listen(dlg, 'closed', dlg.whenClosed);
    }
    _initListeners() {
        let _this = this;
        this._onEditRow = function (e) {
            if (e)
                e.stopPropagation();
            let _fld = this;
            let __initRowEdit = function () {
                _this.CurrentRule = _fld.row.rule;
                let CurrentRule = _this.CurrentRule;
                let cbField = _this.qChild('cbField');
                getParent(_fld.row.aField).insertBefore(cbField, _fld.row.aField);
                cbField.controlClass.value = CurrentRule.fieldName;
                cbField.controlClass.dataSource = _this.QueryData.allFieldsList;
                if (_fld == _fld.row.aField) {
                    setVisibility(cbField, true);
                    cbField.controlClass.calcAutoWidth(); // full row is visible now, re-calc correct width (#13854)
                    setVisibility(_fld.row.aField, false);
                }
                else {
                    setVisibility(cbField, false);
                }
                let cbOperator = _this.qChild('cbOperator');
                getParent(_fld.row.aOperator).insertBefore(cbOperator, _fld.row.aOperator);
                cbOperator.controlClass.dataSource = CurrentRule.getOperatorsList();
                if (cbOperator.controlClass.dataSource.indexOf(CurrentRule.operatorName) >= 0)
                    cbOperator.controlClass.value = CurrentRule.operatorName;
                else
                    cbOperator.controlClass.focusedIndex = 0;
                if ((_fld == _fld.row.aField) || (_fld == _fld.row.aOperator)) {
                    setVisibility(cbOperator, true);
                    setVisibility(_fld.row.aOperator, false);
                }
                else {
                    setVisibility(cbOperator, false);
                }
                if (!_this.inEditRow)
                    _this.QueryData.beginUpdate(); // LS: in order to not unnecessary continually updating the tracklist during row edit (#16192)
                _this.inEditRow = _fld.row;
                _this._moveValueControls(_fld.row);
                let dontOpenValueList;
                if (_fld == _fld.row.aField) {
                    cbField.controlClass.focus();
                    _this.requestTimeout(() => {
                        cbField.controlClass.openDropdown();
                    }, _this._animationTimeout);
                    dontOpenValueList = true;
                }
                if (_fld == _fld.row.aOperator) {
                    cbOperator.controlClass.focus();
                    _this.requestTimeout(() => {
                        cbOperator.controlClass.openDropdown();
                    }, _this._animationTimeout);
                    dontOpenValueList = true; // #14293 - item 23
                }
                _this._operatorChanged({
                    dontOpenValueList: dontOpenValueList
                });
                if (_fld == _fld.row.aValue)
                    if (_this.CurrentRule.getOperatorViewType() == 'qvtPlaylistTree')
                        _this._showPlaylistTree(_fld.row);
            };
            if (_this.inEditRow) {
                _this._onRowEdited(_this.inEditRow).then(__initRowEdit);
            }
            else {
                __initRowEdit();
            }
        };
        this._removeRow = function (row) {
            _this.QueryData.conditions.remove(row.rule);
            if (row == _this.inEditRow)
                _this._onRowEdited(_this.inEditRow);
            _this._cleanSearchRow(row, true);
            animTools.animateRemoveRow(row);
            // _this.qChild('vtRules').removeChild(row);  
        };
        this._onRemoveRow = function (e) {
            _this._removeRow(this.row);
            if (e) {
                e.stopPropagation();
            }
        };
        this._onBypassRow = function (e) {
            this.row.rule.bypass = !this.controlClass.checked;
            if (e)
                e.stopPropagation();
        };
        //  --- sort orders ---
        this._onSwitchDirection = function (e) {
            // switch state:
            if (this.row.ascending)
                this.row.ascending = false;
            else
                this.row.ascending = true;
            // show direction:
            this.innerText = _this._getDirectionText(this.row.ascending);
            _this._setSortOrders();
            if (e)
                e.stopPropagation();
        };
        this._onEditSort = function (e) {
            if (_this.inEditSortRow)
                _this._onSortEdited(_this.inEditSortRow);
            if (this == this.row.aSortField) {
                setVisibility(this.row.cbSortField, true);
                setVisibility(this.row.aSortField, false);
                this.row.cbSortField.controlClass.calcAutoWidth(); // full row is visible now, re-calc correct width (#13854)
                this.row.cbSortField.controlClass.value = this.row.aSortField.innerText;
                this.row.cbSortField.controlClass.focus();
            }
            else {
                setVisibility(this.row.cbSortField, false);
            }
            _this.inEditSortRow = this.row;
            if (e)
                e.stopPropagation();
        };
        this._onRemoveSort = function (e) {
            if (this.row == _this.inEditSortRow)
                _this._onSortEdited(_this.inEditSortRow);
            _this._cleanSortRow(this.row, true);
            animTools.animateRemoveRow(this.row, _this._setSortOrders.bind(_this));
            if (e)
                e.stopPropagation();
        };
        app.listen(_this.qChild('cbMatch'), 'change', function () {
            if (this.controlClass.focusedIndex == 0)
                _this.QueryData.matchAllCriteria = true;
            else
                _this.QueryData.matchAllCriteria = false;
        });
        let chbLimit = _this.qChild('chbLimit');
        let lblLimit = _this.qChild('lblLimit');
        let edtLimitCount = _this.qChild('edtLimitCount');
        let cbLimitOrder = _this.qChild('cbLimitOrder');
        let lblLimitOrder = _this.qChild('lblLimitOrder');
        let cbLimitType = _this.qChild('cbLimitType');
        bindDisabled2Checkbox(lblLimit, chbLimit);
        bindDisabled2Checkbox(edtLimitCount, chbLimit);
        bindDisabled2Checkbox(lblLimitOrder, chbLimit);
        bindDisabled2Checkbox(cbLimitOrder, chbLimit);
        bindDisabled2Checkbox(cbLimitType, chbLimit);
        function _setLimits() {
            if (_this._loadingNewValues)
                return; // #16487
            let checked = chbLimit.controlClass.checked;
            function _setStates(cnt, mb, min) {
                _this.QueryData.maxCountEnabled = cnt;
                _this.QueryData.maxBytesEnabled = mb;
                _this.QueryData.maxLenEnabled = min;
            }
            let idx = cbLimitType.controlClass.focusedIndex;
            let val = Number(edtLimitCount.controlClass.value);
            if (idx == 0) {
                _setStates(checked, false, false);
                _this.QueryData.maxCountValue = val;
            }
            if (idx == 1) {
                _setStates(false, checked, false);
                _this.QueryData.maxBytesValue = val;
            }
            if (idx == 2) {
                _setStates(false, false, checked);
                _this.QueryData.maxLenValue = val;
            }
            _this.QueryData.limitOrderIndex = cbLimitOrder.controlClass.focusedIndex;
        }
        this.localListen(chbLimit, 'click', _setLimits);
        this.localListen(edtLimitCount, 'change', _setLimits);
        this.localListen(cbLimitType, 'change', _setLimits);
        this.localListen(cbLimitOrder, 'change', _setLimits);
        app.listen(this.qChild('aAddSortRule'), 'click', this._onAddSort.bind(this));
        addEnterAsClick(this, this.qChild('aAddSortRule'));
        app.listen(this.qChild('cbCollection'), 'change', this._collectionChanged.bind(this));
        let cbField = this.qChild('cbField');
        app.listen(cbField, 'change', this._fieldChanged.bind(this));
        app.listen(cbField, 'keyup', this._onKeyUp.bind(this));
        app.listen(cbField, 'keydown', this._onKeyDown.bind(this));
        // following changed to 'mousedown' -- otherwise on 'click' the document.activeElement is BODY in the recent Chromium version 
        this.localListen(document.body, 'mousedown', this._checkCloseEdit.bind(this), true /* capture */);
        let cbOperator = this.qChild('cbOperator');
        app.listen(cbOperator, 'change', this._operatorChanged.bind(this));
        app.listen(cbOperator, 'keyup', this._onKeyUp.bind(this));
        app.listen(cbOperator, 'keydown', this._onKeyDown.bind(this));
        for (let i = 0; i < this.ValueControls.length; i++) {
            let ValueControl = this.qChild(this.ValueControls[i]);
            app.listen(ValueControl, 'change', this._valueChanged.bind(this));
            app.listen(ValueControl, 'keyup', this._onKeyUp.bind(this));
            app.listen(ValueControl, 'keydown', this._onKeyDown.bind(this));
        }
        app.listen(this.qChild('cbCheckList'), 'dropdownclosed', () => {
            _this.QueryData.beginUpdate(); // added because of #16627 (to not assert in checkUpdate when beginUpdate was not called)
            _this.QueryData.checkUpdate(0); // #16537
            _this.QueryData.endUpdate();
        });
    }
    _onRowEdited(row) {
        let _this = this;
        return new Promise(function (resolve, reject) {
            if (_this.inEditRow)
                _this.QueryData.endUpdate();
            _this.inEditRow = null;
            _this._hideEditControl(_this.qChild('cbField'));
            _this._hideEditControl(_this.qChild('cbOperator'));
            for (let i = 0; i < _this.ValueControls.length; i++) {
                let ValueControl = _this.qChild(_this.ValueControls[i]);
                _this._hideEditControl(ValueControl);
            }
            _this._valueChanged().then(function () {
                if (_this._cleanUpCalled || row._cleanUpCalled) {
                    resolve();
                    return;
                }
                setVisibility(row.aField, true);
                row.aField.innerText = row.rule.fieldName;
                setVisibility(row.aOperator, true);
                row.aOperator.innerText = row.rule.operatorName;
                setVisibility(row.aValue, true);
                _this._getEditText(row.rule).then(function (editText) {
                    _this._setRuleText(row.aValue, editText);
                });
                resolve();
            });
        });
    }
    _getEditText(CurrentRule) {
        return new Promise(function (resolve, reject) {
            CurrentRule.getValueTextAsync().then(function (valText) {
                let ViewType = CurrentRule.getOperatorViewType();
                if ((valText == '') && (ViewType != 'qvtNone'))
                    valText = _('click to set');
                resolve(valText);
            });
        });
    }
    _AddRule2UI(rule, manual, afterRow) {
        let _this = this;
        let VTRules = this.qChild('vtRules');
        let row = document.createElement('div');
        row.rule = rule;
        row.className = 'flex fill uiRowCenter hoverSelected';
        let chb = '';
        if (this.checkboxes)
            chb = '<div data-id="chbEnabled" data-control-class="Checkbox"></div>';
        row.innerHTML = chb +
            '<div data-id="aField" class="fieldControl clickableLabel textEllipsis">' + rule.fieldName + '</div>' +
            '<div data-id="aOperator" class="operatorControl clickableLabel textEllipsis">' + rule.operatorName + '</div>' +
            '<div data-id="aValue" class="valueControl clickableLabel textEllipsis fill"></div>' +
            '<div class="alignRight flex">' +
            '  <div class="toolButton inline" data-id="btnDelete" data-tip="Remove" data-icon="remove"></div>' +
            '</div>';
        row.aField = qe(row, '[data-id=aField]');
        app.listen(row.aField, 'mousedown', this._onEditRow, false);
        addEnterAsClick(undefined, row.aField);
        row.aField.row = row;
        row.aOperator = qe(row, '[data-id=aOperator]');
        app.listen(row.aOperator, 'mousedown', this._onEditRow, false);
        addEnterAsClick(undefined, row.aOperator);
        row.aOperator.row = row;
        row.aValue = qe(row, '[data-id=aValue]');
        app.listen(row.aValue, 'mousedown', this._onEditRow, false);
        addEnterAsClick(undefined, row.aValue);
        row.aValue.row = row;
        row.btnDelete = qe(row, '[data-id=btnDelete]');
        app.listen(row.btnDelete, 'click', this._onRemoveRow, false);
        addEnterAsClick(undefined, row.btnDelete);
        row.btnDelete.row = row;
        initializeControls(row); // Make sure the icon is loaded
        if (this.checkboxes) {
            row.checkbox = qe(row, '[data-id=chbEnabled]');
            row.checkbox.controlClass.checked = !rule.bypass;
            row.checkbox.row = row;
            app.listen(row.checkbox, 'click', this._onBypassRow, false);
        }
        if (afterRow)
            VTRules.insertBefore(row, afterRow.nextSibling);
        else
            VTRules.appendChild(row);
        let level = rule.nestLevel + 1;
        while (level--) {
            row.insertBefore(this._createLevelIndentDiv(), row.firstChild);
        }
        if (manual) {
            this._onEditRow.call(row.aOperator); /* direct start of edit for manually added field */
            animTools.animateAddRow(row);
        }
        this._getEditText(rule).then(function (editText) {
            this._setRuleText(row.aValue, editText);
        }.bind(this));
    }
    _setRuleText(aValueDiv, text) {
        if (text.indexOf(';') > 0)
            aValueDiv.setAttribute('data-tip', text); // #19851: AutoPlaylist Criteria should show selection tooltip
        else
            aValueDiv.setAttribute('data-tip', '');
        aValueDiv.textContent = text;
    }
    _addOperatorDiv(div, afterRow) {
        // insert 'Match [Any/All]...'
        let VTRules = this.qChild('vtRules');
        if (afterRow)
            return VTRules.insertBefore(div, afterRow.nextSibling);
        else
            return VTRules.appendChild(div);
    }
    _createLevelIndentDiv() {
        let indent = document.createElement('div');
        indent.className = 'vSeparator';
        return indent;
    }
    _cleanSearchRow(row, justUnlisten) {
        app.unlisten(row);
        app.unlisten(row.aField);
        app.unlisten(row.aOperator);
        app.unlisten(row.aValue);
        app.unlisten(row.btnDelete);
        if (row.checkbox)
            app.unlisten(row.checkbox);
        if (!justUnlisten)
            cleanElement(row);
        row._cleanUpCalled = true;
    }
    _onAddRow(afterRow, fieldName) {
        let newRule;
        if (afterRow && afterRow.rule) {
            newRule = this.QueryData.addNewCondition(afterRow.rule);
            newRule.nestLevel = afterRow.rule.nestLevel + 1;
        }
        else {
            newRule = this.QueryData.addNewCondition();
        }
        newRule.fieldName = fieldName;
        this._AddRule2UI(newRule, true, afterRow);
    }
    _onNestRule(afterRow) {
        let operatorRule;
        if (afterRow && afterRow.rule) {
            operatorRule = this.QueryData.addNewCondition(afterRow.rule);
            operatorRule.nestLevel = afterRow.rule.nestLevel + 1;
        }
        else {
            operatorRule = this.QueryData.addNewCondition();
        }
        operatorRule.isOperator = true;
        let operRow = this._addOperatorDiv(this._createOperatorDiv(operatorRule), afterRow);
        let condRule = this.QueryData.addNewCondition(operatorRule);
        condRule.nestLevel = operatorRule.nestLevel + 1;
        this._AddRule2UI(condRule, true, operRow);
    }
    _createOperatorDiv(rule) {
        let _this = this;
        let div = document.createElement('div');
        div.rule = rule;
        div.className = 'flex row uiRowCenter matchCriteriaRow';
        div.innerHTML =
            '<label>Match</label>' +
                '<div data-id="cbMatch" class="thinControl" data-control-class="Dropdown" data-init-params="{readOnly: true}">' +
                '    <option>All</option>' +
                '    <option>Any</option>' +
                '</div>' +
                '<label class="labelLeftPadding" data-add-colon>of the following criteria</label>' +
                ' <div class="inline" data-id="btnAddRuleInline" data-icon="add" data-control-class="MenuButton"></div>' +
                '<div class="fill"></div>' +
                '<div class="floatRight flex">' +
                '  <div class="toolButton inline" data-id="btnDelete" data-icon="remove"></div>' +
                '</div>';
        initializeControls(div);
        div.btnDelete = qe(div, '[data-id=btnDelete]');
        div.btnDelete.fromLevel = rule.nestLevel;
        app.listen(div.btnDelete, 'click', function (e) {
            _this._onRemoveBranch.call(this, _this);
            e.stopPropagation();
        }.bind(div.btnDelete));
        addEnterAsClick(undefined, div.btnDelete);
        div.btnAddRuleInline = qe(div, '[data-id=btnAddRuleInline]');
        this._createAddButtonMenu(div.btnAddRuleInline, div);
        div.cbMatch = qe(div, '[data-id=cbMatch]');
        if (rule.nestOperator == 'and')
            div.cbMatch.controlClass.focusedIndex = 0;
        else
            div.cbMatch.controlClass.focusedIndex = 1;
        app.listen(div.cbMatch, 'change', function () {
            if (this.controlClass.focusedIndex == 0)
                rule.nestOperator = 'and';
            else
                rule.nestOperator = 'or';
        });
        let level = rule.nestLevel + 1;
        while (level--) {
            div.insertBefore(this._createLevelIndentDiv(), div.firstChild);
        }
        return div;
    }
    _getAddConditionMenuArray(row) {
        let _this = this;
        let ar = [];
        if (!this.hideNested) {
            ar.push({
                title: '[' + _('Nested condition') + ']',
                execute: function () {
                    _this._onNestRule(row);
                }
            });
            ar.push(menuseparator);
        }
        let topFields = 'any, status';
        let basicFields = 'album, albumArtist, artist, bitrate, genre, length, order, path, rating, sampleRate, channels, title, year';
        let customFields = 'custom1, custom2, custom3, custom4, custom5, custom6, custom7, custom8, custom9, custom10';
        let classificationFields = 'initialKey, mood, occasion, quality, tempo';
        function _getFields(include, exclude, addSeparator) {
            let retAr = [];
            let fields = _this.QueryData.getFieldList(include, exclude);
            fastForEach(fields, function (item) {
                retAr.push({
                    title: item.toString(),
                    execute: function () {
                        _this._onAddRow(row, this.title);
                    }
                });
            });
            if (addSeparator)
                retAr.push(menuseparator);
            return retAr;
        }
        ar = ar.concat(_getFields(topFields, ''));
        ar.push(menuseparator);
        ar = ar.concat(_getFields(basicFields, ''));
        ar.push(menuseparator);
        ar.push({
            title: _('Classification & Custom'),
            submenu: _getFields(customFields, '', true).concat(_getFields(classificationFields, ''))
        });
        ar.push({
            title: _('Others'),
            submenu: _getFields('', topFields + ',' + basicFields + ',' + classificationFields)
        });
        return ar;
    }
    _createAddButtonMenu(btn, row) {
        btn.controlClass.menuArray = function () {
            return this._getAddConditionMenuArray(row); // menu array as function to get the fields on demand -- i.e. based on the currently selected collection ('Artist' vs 'Director')
        }.bind(this);
    }
    _cleanOperatorDiv(div) {
        app.unlisten(div.btnDelete);
        app.unlisten(div.btnAddRuleInline);
        app.unlisten(div.cbMatch);
    }
    _removeOperatorDiv(row) {
        this._cleanOperatorDiv(row);
        this.QueryData.conditions.remove(row.rule);
        animTools.animateRemoveRow(row);
    }
    _onRemoveBranch(_this) {
        let level = this.fromLevel;
        let div = getParent(getParent(this)); // get the operator row div
        // LS: note that the following won't work once the animated remove wouldn not be used
        let row = div.nextSibling;
        while (row && row.rule.nestLevel > level) {
            if (row.rule.isOperator)
                _this._removeOperatorDiv(row);
            else {
                _this._removeRow(row);
            }
            row = row.nextSibling;
        }
        _this._removeOperatorDiv(div);
    }
    _getDirectionText(ascending) {
        if (ascending)
            return _('A..Z');
        else
            return _('Z..A');
    }
    _setSortOrders() {
        let VTSortRules = this.qChild('vtSortRules');
        let sortOrders = [];
        for (let i = 0; i < VTSortRules.childNodes.length; i++) {
            let row = VTSortRules.childNodes[i];
            sortOrders.push({
                name: row.aSortField.innerText,
                ascending: row.ascending
            });
        }
        this.QueryData.setSortOrders(sortOrders);
    }
    _setSortDirectionVis(row, value) {
        setVisibility(row.aDirection, value != _('Random') && value != _('Random Album')); // #14561, orig. #14202 - item 7
    }
    _onSortEdited(row) {
        this.inEditSortRow = null;
        let text = row.cbSortField.controlClass.value;
        row.aSortField.innerText = text;
        setVisibility(row.cbSortField, false);
        setVisibility(row.aSortField, true);
        this._setSortDirectionVis(row, text);
        this._setSortOrders();
    }
    _addSort2UI(sortname, ascending) {
        let VTSortRules = this.qChild('vtSortRules');
        let row = document.createElement('div');
        row.className = 'flex fill uiRowCenter';
        row.ascending = ascending;
        row.innerHTML =
            '<div data-id="aSortField" class="fieldControl clickableLabel textEllipsis">' + sortname + '</div>' +
                '<div data-id="cbSortField" class="fieldEditControl" data-control-class="Dropdown" data-init-params="{readOnly: true}"></div>' +
                '<div data-id="aDirection" class="clickableLabel textEllipsis">' + this._getDirectionText(row.ascending) + '</div>' +
                '<div class="toolButton" data-id="btnDelete" data-icon="remove"></div>';
        VTSortRules.appendChild(row);
        initializeControls(row); // To load icon, cbSortField.controlClass  
        row.cbSortField = qe(row, '[data-id=cbSortField]');
        row.cbSortField.controlClass.dataSource = this.QueryData.getAllSortOrdersList();
        row.cbSortField.controlClass.value = sortname; // needs to be assigned due to proper vertical align        
        let _this = this;
        app.listen(row.cbSortField, 'change', function () {
            _this._setSortDirectionVis(this, this.cbSortField.controlClass.value);
        }.bind(row));
        setVisibility(row.cbSortField, false);
        row.aSortField = qe(row, '[data-id=aSortField]');
        app.listen(row.aSortField, 'click', this._onEditSort);
        addEnterAsClick(undefined, row.aSortField);
        row.aSortField.row = row;
        row.aDirection = qe(row, '[data-id=aDirection]');
        app.listen(row.aDirection, 'click', this._onSwitchDirection);
        addEnterAsClick(undefined, row.aDirection);
        row.aDirection.row = row;
        row.btnDelete = qe(row, '[data-id=btnDelete]');
        app.listen(row.btnDelete, 'click', this._onRemoveSort);
        addEnterAsClick(undefined, row.btnDelete);
        row.btnDelete.row = row;
        this._setSortDirectionVis(row, sortname);
        return row;
    }
    _cleanSortRow(row, justUnlisten) {
        app.unlisten(row.cbSortField);
        app.unlisten(row.aSortField);
        app.unlisten(row.aDirection);
        app.unlisten(row.btnDelete);
        if (!justUnlisten)
            cleanElement(row);
        row._cleanUpCalled = true;
    }
    _onAddSort(e) {
        let row = this._addSort2UI(_('Random Album'), true /* ascending */);
        animTools.animateAddRow(row, function () {
            this._setSortOrders.call(this);
            this._onEditSort.call(row.aSortField); // to start edit manually added field
        }.bind(this));
        if (e)
            e.stopPropagation();
    }
    storeState() {
        return {};
    }
    restoreState(state) {
        // suppressed, the whole UI state is restored from QueryData, i.e. via setQueryData()
    }
    /**
    Sets whether to show sort orders config

    @property showSortOrders
    @type boolean
    @default true
    */
    set showSortOrders(val) {
        setVisibility(this.qChild('boxSortOrders'), val);
    }
    /**
    Sets whether to show search limits config

    @property showLimits
    @type boolean
    @default true
    */
    set showLimits(val) {
        setVisibility(this.qChild('boxSearchLimits'), val);
    }
    /**
    Sets whether to show collection dropdown

    @property showCollection
    @type boolean
    @default true
    */
    set showCollection(val) {
        setVisibility(this.qChild('boxCollection'), val);
    }
}
registerClass(SearchEditor);
