/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

let runtimeLessValues = getRuntimeLessValues();
let rtValIdx = -1;
let prevVal = 100;
let originalVal = 100;
let fontSize10;
let getRVLine = function (lessPropName) {
    for (let i = 0; i < runtimeLessValues.length; i++) {
        if (runtimeLessValues[i].indexOf(lessPropName) === 0) {
            return i;
        }
    };
    return -1;
};

let createLessLine = function (imageSizeKoef) {
    return '@gridItemSizeKoef: ' + imageSizeKoef + ';';
};

let saveSize = function (forcedValue) {
    let newval = forcedValue || qid('slImageSize').controlClass.value;
    if (prevVal !== newval) {
        let txtVal = createLessLine(newval / 100.0);
        if (rtValIdx >= 0) {
            runtimeLessValues[rtValIdx] = txtVal;
        } else {
            runtimeLessValues.push(txtVal);
            rtValIdx = runtimeLessValues.length - 1;
        };
        setRuntimeLessValues(runtimeLessValues);
        prevVal = newval;
    }
}

function init(params) {
    fontSize10 = 10 * fontSizePx();
    window.resizeable = false;
    title = _('Image size') + ' (' +_('Browser & Grid views') + ')';
    rtValIdx = getRVLine('@gridItemSizeKoef:');
    if (rtValIdx >= 0) {
        let line = runtimeLessValues[rtValIdx];
        prevVal = 100 * parseFloat(line.replace(/[^\d\.]*/g, '')); // remove non-digits except decimal point, convert to float
    }
    originalVal = prevVal;
    let slImageSize = qid('slImageSize');
    slImageSize.controlClass.value = prevVal;
    let tImageSize = qid('tImageSize');
    tImageSize.textContent = prevVal + ' %';
    let imageDemo = qid('imageDemo');

    let getImgSize = function () {
        return Math.round(fontSize10 * slImageSize.controlClass.value / 100) + 'px';
    };

    imageDemo.style.width = getImgSize();
    imageDemo.style.height = imageDemo.style.width;

    slImageSize.style.width = Math.round(fontSize10 * slImageSize.controlClass.max / 100) + 'px';

    window.localListen(slImageSize, 'change', function () {
        saveSize();
    });

    window.localListen(slImageSize, 'livechange', function () {
        tImageSize.textContent = slImageSize.controlClass.value + ' %';
        imageDemo.style.width = getImgSize();
        imageDemo.style.height = imageDemo.style.width;
    });

    window.localListen(qid('btnCancel'), 'click', function () {
        saveSize(originalVal);
    }, true);

    window.localListen(qid('btnOK'), 'click', function () {
        modalResult = 1;
    }, true);
}