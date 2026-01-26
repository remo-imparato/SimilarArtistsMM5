/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

import '../commonControls';

let secondsRemaining = 0;
let timer = undefined;
let columnTitle = _('Problem');

let stopTimer = function () {
    if (timer) {
        clearTimeout(timer);
        timer = undefined;
    }
};

window.init = function (params) {
    let wnd = this;
    wnd.title = wnd.caption;
    wnd.resizeable = true;
    secondsRemaining = 0;
    timer = undefined;

    let lvErrorsListCls = qid('lvErrorsList').controlClass;

    if (wnd.customColumnTitle) {
        columnTitle = wnd.customColumnTitle;
    }

    lvErrorsListCls.updateHeader();

    qid('lblCaption').innerText = wnd.errorCaption;
    lvErrorsListCls.dataSource = wnd.errorList;

    let btnOK = qid('btnOK');
    window.localListen(btnOK, 'click', function () {
        let res = {
            btnID: 'btnOK'
        };
        stopTimer();
        setResult(res);
        closeWindow();
    });

    let btnHelp = qid('btnHelp');
    if (wnd.helpLink != '') {
        setVisibility(btnHelp, true);
        window.localListen(btnHelp, 'click', function () {
            window.uitools.openWeb(wnd.helpLink);
        });

    } else {
        setVisibility(btnHelp, false);
    }

    if (wnd.isFinalLog) {
        setVisibility(qid('btnCancel'), false);
    } else {
        btnOK.controlClass.textContent = _('Continue');
        window.localListen(qid('btnCancel'), 'click', function () {
            let res = {
                btnID: 'btnCancel'
            };
            stopTimer();
            setResult(res);
            closeWindow();
        });
    }

    if (wnd.showDlgSeconds > 0) {
        secondsRemaining = wnd.showDlgSeconds;
        setVisibility(qid('dlgTimerLine'), true);
        qid('lblSeconds').innerText = secondsRemaining;
        timer = requestTimeout(onTimer, 1000);
    } else {
        setVisibility(qid('dlgTimerLine'), false);
    }

    window.localListen(qid('btnStopTimer'), 'click', function () {
        setVisibility(qid('dlgTimerLine'), false);
        stopTimer();
    });

    setVisibility(qid('btnSave'), wnd.saveSupport);
    window.localListen(qid('btnSave'), 'click', function () {
        let promise = app.utils.dialogSaveFile('Log file', 'log', 'Log file (*.log)', '');
        window.localPromise(promise).then(function (filename) {
            if (filename != '') {
                app.filesystem.saveTextToFileAsync(filename, wnd.errorList.text);
            }
        });

    });


    showModal();
};

let onTimer = function () {
    secondsRemaining--;
    qid('lblSeconds').innerText = secondsRemaining;
    if (secondsRemaining == 0) {
        let res = {
            btnID: 'btnIgnore'
        };
        setResult(res);
        closeWindow();
    } else {
        timer = requestTimeout(onTimer, 1000);
    }
}

// function for testing purposes, stops timeout and set fixed time 9s
window.prepareForScreenshot = function () {
    if (timer) {
        clearTimeout(timer);
    };
    qid('lblSeconds').innerText = '9';
};

window.windowCleanup = function () {
    stopTimer();
};

// ErrorListView --------------------------------------------
class ErrorListView extends GridView {

    initialize(element, params) {
        super.initialize(element, params);
        this.multiselect = false;
        this.showHeader = true;

        this.updateHeader = function () {
            this.defaultColumns = new Array();
            if (showRetryColumn)
                this.defaultColumns.push({
                    order: 0,
                    title: _('Retry'),
                    headerRenderer: GridView.prototype.headerRenderers.renderCheck,
                    setupCell: GridView.prototype.cellSetups.setupCheckbox,
                    bindData: GridView.prototype.defaultBinds.bindCheckboxCell
                });

            this.defaultColumns.push({
                order: 2,
                width: 300,
                title: _('Item'),
                bindData: function (div, item, index) {
                    div.innerText = item.filename;
                }
            });
            this.defaultColumns.push({
                order: 1,
                width: 300,
                title: columnTitle,
                bindData: function (div, item, index) {
                    div.innerText = item.errorString;
                }
            });
            this.setColumns(this.defaultColumns);
        }.bind(this);
    }

    bindData(div, index) {
        let dsItem = this.dataSource.getValue(index);
        forEach(div.children, function (coldiv) {
            let column = coldiv.column;
            if (column) {
                if (column.bindData)
                    column.bindData(coldiv, dsItem, index);
                else
                if (column.getValue)
                    coldiv.innerText = column.getValue(dsItem, index);
            };
        });
    }   
}
registerClass(ErrorListView);
