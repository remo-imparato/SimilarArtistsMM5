/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

function init() {
    //	properties dlgType, buttons, defaultButton: integer
    //						msg: string
    if ((window.msg === undefined) || (window.dlgType === undefined) || (window.buttons === undefined) || (window.defaultButton === undefined)) {
        setResult('');
        return;
    }
    resizeable = false;
    let textDiv = qid('message-text');

    textDiv.innerHTML = sanitizeHtml(window.msg);

    let chbdiv = qid('div_message-chb');
    let chb = undefined;
    if ((window.chbCaption === undefined) || (window.chbCaption === '')) {
        chbdiv.parentNode.removeChild(chbdiv);
        chbdiv = undefined;
    } else {
        chb = qid('message-chb');
        qid('lbl_message-chb').innerText = window.chbCaption;
        chb.controlClass.checked = window.chbChecked;
    }

    if (window.helpContext)
        document.body.setAttribute('data-help', window.helpContext);

    // get text size
    let mtag = document.createElement('div');
    mtag.innerHTML = sanitizeHtml(window.msg);
    mtag.style.display = 'inline-block';
    mtag.style.position = 'absolute';
    mtag.style.top = '-1000px';
    mtag.style.left = '-1000px';
    let cs = getComputedStyle(textDiv, null);
    mtag.style.font = cs.getPropertyValue('font');
    let body = getBodyForControls();
    body.appendChild(mtag);
    let w = getFullWidth(mtag);
    if (chb !== undefined) {
        mtag.innerHTML = sanitizeHtml(window.chbCaption);
        cs = getComputedStyle(chbdiv, null);
        mtag.style.font = cs.getPropertyValue('font');
        let wch = getFullWidth(mtag) + getFullWidth(chb);
        if (wch > w)
            w = wch;
    }
    body.removeChild(mtag);
    if (w > 500)
        w = 500;
    textDiv.style.minWidth = w + 'px';
    let icondiv = qid('message-icon');
    loadIcon(dlgType.toLowerCase(), function (iconData) {
        if (window._cleanUpCalled)
            return;
        icondiv.innerHTML = iconData;
    });
    let mbDiv = qid('message-buttons');
    forEach(buttons, function (bID) {
        let params;
        if (typeof bID === 'string') {
            params = new Object();
            params.btnID = bID;
            params.isDefault = (params.btnID === defaultButton);
            params.value = params.btnID;
        } else if (bID && (typeof bID === 'object')) {
            params = bID;
            if (params.value === undefined)
                params.value = params.btnID;
            if (params.isDefault === undefined)
                params.isDefault = (params.btnID === defaultButton);
        } else return;

        let btn = mbDiv.controlClass.addBtn(params);
        app.unlisten(btn, 'click'); // to be sure that only our 'click' event handler will be used (to be sure that setResult(res) is called also for Cancel button)
        window.localListen(btn, 'click', function () {
            let res = {
                btnID: this.controlClass.dataValue,
                checked: false
            };
            if (chb !== undefined) {
                res.checked = chb.controlClass.checked;
            }
            setResult(res);
            closeWindow();
        });
        if (btn && params.isDefault)
            btn.focus();
    });
    showModal();
};
