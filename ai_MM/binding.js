/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

'use strict';
import { getPixelSize } from './controls/control';
registerFileImport('binding');
/**
@for Window
*/
(function () {
    let whenPromises = function (promiseArray, allRequired) {
        let totalCount = promiseArray.length;
        let doneCount = 0;
        let failCount = 0;
        let promiseFunc;
        let rejectPromiseFunc;
        let finished = (totalCount == 0);
        let promiseHandled = false;
        let handlePromise = function () {
            if (!promiseHandled) {
                if (promiseFunc) {
                    promiseHandled = true;
                    if (failCount) {
                        rejectPromiseFunc();
                    }
                    else {
                        promiseFunc();
                    }
                }
                else
                    finished = true;
            }
        };
        let promiseDone = function () {
            doneCount++;
            if (doneCount == totalCount || !allRequired) {
                handlePromise();
            }
        };
        let processPromiseAsync = function (promise, idx) {
            if (promise.finished || promise.canceled || promise.handled || promise._nativeFinished) {
                if (promise.canceled)
                    failCount++;
                promiseDone();
            }
            else {
                promise.then(function () {
                    promiseDone();
                }, function () {
                    failCount++;
                    promiseDone();
                });
            }
        };
        for (let i = 0; i < totalCount; i++) {
            processPromiseAsync(promiseArray[i], i);
        }
        return new Promise(function (resolve, reject) {
            promiseFunc = resolve;
            rejectPromiseFunc = reject;
            if (finished)
                handlePromise();
        });
    };
    /**
    Wait till all promises are finished.

    @method whenAll
    @param {array} Array of promises
    @return {Promise}
    */
    window.whenAll = function (promiseArray) {
        return whenPromises(promiseArray, true);
    };
    /**
    Wait till any promises are finished.

    @method whenAny
    @param {array} Array of promises
    @return {Promise}
    */
    window.whenAny = function (promiseArray) {
        return whenPromises(promiseArray, false);
    };
    /**
    Returns helper dummy promise, which only resolves itself.

    @method dummyPromise
    @param {any} [retval] Optional value to resolve with
    @return {Promise}
    */
    window.dummyPromise = function (retval) {
        return new Promise(function (resolve) {
            resolve(retval);
        });
    };
    let bindAttributes = ['data-bind', 'data-bind-undefined', 'data-show-if', 'data-cond-class', 'data-for-tracktype', 'data-width-from', 'data-width-to'];
    let getBoundElements = function (div, boundElements, elToInspect) {
        if (div.children) {
            let child;
            let bound;
            for (let i = 0; i < div.children.length; i++) {
                child = div.children[i];
                bound = false;
                for (let j = 0; j < bindAttributes.length; j++) {
                    if (child.hasAttribute(bindAttributes[j])) {
                        bound = true;
                        break;
                    }
                }
                if (bound)
                    boundElements.push(child);
                else if (child.children && (child.children.length > 0))
                    elToInspect.push(child);
            }
        }
    };
    let fillFirstBoundElements = function (div) {
        div.boundElements = [];
        let elToInspect = [div];
        let el;
        while (elToInspect.length > 0) {
            el = elToInspect.shift(); // shift is much faster than splice, in current Chrome
            getBoundElements(el, div.boundElements, elToInspect);
        }
        forEach(div.boundElements, fillFirstBoundElements);
    };
    let getDataBindContent = function (txt) {
        let innerFnText = '';
        if (txt.substr(0, 5) === 'text:') {
            // we have standard innerText object
            txt = txt.substr(5).trim();
            let obj = (new Function('return ' + txt + ';'))();
            if (obj !== undefined)
                innerFnText = 'el.textContent = ' + obj + ';\n'; // textContent seems to be fastest in current Chrome
            else {
                obj = (new Function('return ' + txt + 'Func;'))();
                if (obj !== undefined)
                    innerFnText = obj + ';';
            }
        }
        else if (txt.substr(0, 5) === 'func:') {
            txt = txt.substr(5).trim();
            innerFnText = txt + ';';
        }
        else if (txt.substr(0, 5) === 'call:') {
            txt = txt.substr(5).trim();
            let obj = (new Function('return ' + txt + ';'))();
            if (obj !== undefined)
                innerFnText = obj + ';';
        }
        return innerFnText;
    };
    let getBindFnText = function (div, params) {
        let ttadded = false;
        let el;
        let showifcond = '';
        let classcond;
        let classcondObj;
        let bindElText;
        let innerFnText, innerFnTextU;
        let ttText, ttcond, ttObj;
        let retval = '';
        let els = 'els' + params.counter;
        for (let i = 0; i < div.boundElements.length; i++) {
            el = div.boundElements[i];
            bindElText = 'el = ' + els + '[' + i + '];\n';
            let txt, txtU;
            if (el.hasAttribute('data-bind'))
                txt = el.getAttribute('data-bind').trim();
            else
                txt = '';
            if (el.hasAttribute('data-bind-undefined'))
                txtU = el.getAttribute('data-bind-undefined').trim();
            else
                txtU = '';
            if (el.hasAttribute('data-show-if'))
                showifcond = el.getAttribute('data-show-if').trim();
            else
                showifcond = '';
            if (el.hasAttribute('data-cond-class')) {
                classcond = el.getAttribute('data-cond-class');
                classcondObj = (new Function('return ' + classcond + ';'))();
                classcond = '';
                if (classcondObj) {
                    for (let cl in classcondObj) {
                        classcond += 'el.classList.toggle("' + cl + '", (' + classcondObj[cl] + '));\n'; // toggle faster than add/remove in current Chrome
                    }
                }
            }
            else {
                classcond = '';
            }
            ttcond = '';
            if (el.hasAttribute('data-for-tracktype')) {
                ttText = el.getAttribute('data-for-tracktype');
                ttObj = ttText.split(',');
                if (ttObj.length > 0) {
                    params.ttadded = true;
                    ttObj.forEach(function (tt) {
                        tt = tt.trim();
                        if (ttcond)
                            ttcond += '||';
                        ttcond += '(tt==="' + tt + '")';
                    });
                    if (ttObj.length > 1)
                        ttcond = '(' + ttcond + ')';
                    if (showifcond)
                        showifcond = '(' + showifcond + ')&&' + ttcond;
                    else
                        showifcond = ttcond;
                }
            }
            innerFnText = getDataBindContent(txt);
            innerFnTextU = '';
            if (txtU === '') {
                if (innerFnText !== '') // for no data-bind and no data-bind-undefined, do not change element contents, does not contain any content binding
                    innerFnTextU = 'el.textContent = \'\';';
            }
            else {
                innerFnTextU = getDataBindContent(txtU);
            }
            if (innerFnText === '') {
                // we have only binding for undefined item or nothing
                innerFnText = innerFnTextU;
            }
            else {
                innerFnText = 'if(item !== undefined) {' + innerFnText + '} else {' + innerFnTextU + '};';
            }
            if (el.boundElements && (el.boundElements.length > 0)) {
                // append conditions for bound subelements
                let c = ++params.counter;
                let subElFnText = getBindFnText(el, params);
                if (subElFnText)
                    innerFnText += 'var els' + c + '= el.boundElements;\n' + subElFnText + ';\n';
            }
            if (innerFnText || classcond)
                innerFnText = 'if (el && !el.hiddenBySize) {' + classcond + '\n' + innerFnText + '};\n';
            if (showifcond) {
                bindElText += 'if(el){ if(' + showifcond + '){ \n\
                    if(el.hiddenByShowif) el.style.display = ""; \n\
                    el.hiddenByShowif=false;\n ' + innerFnText +
                    '} else { \n\
                     if(!el.hiddenByShowif) el.style.display = "none"; \n\
                     el.hiddenByShowif=true; \n\
                  }};\n';
            }
            else {
                bindElText += innerFnText;
            }
            if (bindElText)
                retval += bindElText;
        }
        if (div.hasAttribute('data-cond-class')) {
            classcond = div.getAttribute('data-cond-class');
            classcondObj = (new Function('return ' + classcond + ';'))();
            classcond = '';
            if (classcondObj) {
                for (let cl in classcondObj) {
                    classcond += 'div.classList.toggle("' + cl + '", (' + classcondObj[cl] + '));\n';
                }
            }
            retval += classcond;
        }
        return retval;
    };
    /**
    Processes binding attributes of HTML elements, prepares appropriate binding function for parent control (typically ListView).
    There are three parameters always available in binding functions and expressions:<br>
        <b>el</b> - source HTML element (the one with binding attribute)<br>
        <b>div</b> - main HTML element containing currently processed item<br>
        <b>item</b> - currently processed item (Object)<br><br>
    Possible HTML attributes used for binding purposes:<br><ul>
    <li>data-bind: basic binding. It has two variants:<ul>
        <li>"text: <i>expression</i>" - evaluates <i>expression</i> and fill the result (should be text) to el.textContent. Members of trackFormat structure could be used as <i>expression</i> for standard values (defined in templateFormats.js).
        <li>"func: <i>content</i>" - merges <i>content</i> to binding function as it is, <b>el</b>, <b>div</b> and <b>item</b> parameters could be used in <i>content</i>.</li>
        <li>"call: <i>expression</i>" - evaluates <i>expression</i> and call result as a function with default parameters.</li>
        </ul>
        Example:
        
        <div data-bind="func: templates.ratingEditableFunc(div, item, el);"></div>
        <div data-bind="text: trackFormat.length"></div>
        
    </li>
    <li>data-bind-undefined: binding for situation when item === undefined, or for binding, which does not use item at all
    </li>
    <li>data-show-if: displays element <b>el</b> only if the condition in the attribute value is evaluated to true<br>
        Example:
        
        <div data-show-if="item.trackNumber!==''">This div is hidden, if item.trackNumber is empty</div>
        
    </li>
    <li>data-cond-class: contains JSON of the object with properties, when property value is evaluated to true, CSS class named as property name is added to the element <b>el</b><br>
        Example:
        
        <div data-cond-class="{itemNowPlaying: 'item.isPlaying'}">This div has class itemNowPlaying in case item.isPlaying is true</div>
        
    </li>
    <li>data-for-tracktype: displays element <b>el</b> only if <b>item</b>.trackTypeStringId is equal to the attribute value.
    Possible values are 'music', 'podcast', 'audiobook', 'classical', 'musicvideo', 'video', 'tv' and 'videopodcast', more values have to be separated by comma.<br>
        Example:
        
        <div data-for-tracktype="music,musicvideo">This div is displayed only for music and musicvideo track types</div>
        
    </li>
    <li>data-width-from: displays element <b>el</b> only if width of <b>div</b> is greater than or equal to the attribute value. Could be in px or em.</li>
    <li>data-width-to: displays element <b>el</b> only if width of <b>div</b> is less than the attribute value. Could be in px or em.<br>
        Example:
        
        <div data-width-to="35em">Content displayed till div width 35em</div>
        <div data-width-from="35em">Content displayed from div width 35em</div>

    </li>
    <li>data-cond-width: contains JSON of array of objects, defining width or/and class of the element <b>el</b> based on width of the whole <b>div</b>.
        The width could be set explicitly, to value in em or px. Possible properties (of width defining object in the array): <br><ul>
        <li>fromWidth - value in this object is valid only if div width is greater than or equal to this property value</li>
        <li>toWidth - value in this object is valid only if div width is less than this property value</li>
        <li>width - value in px or em, sets <b>el</b> width to this value, if all conditions in this object are fulfilled.</li>
        <li>className - CSS class name, adds this class to <b>el</b>'s classList, if all conditions in this object are fulfilled, otherwise removes this class from classList</li>
        </ul>
        Example:
        
        <div data-id="title" class="textEllipsis" data-cond-width="[{toWidth:'55em', className:'fill'}, {fromWidth: '55em', width: '15em'}]">
        
    </li>
    <li>data-minwidth-pattern: compute current width of the attribute value and set the result as min-width of the element <b>el</b>. Usable for better aligning.<br>
        Example:
        
        <label data-minwidth-pattern="88:88:88" data-bind="text: trackFormat.length"></label>

    </li>
    <li>data-item-height: relevant only for main <b>div</b> element, set typically during ListView's setUpDiv. Contains JSON of array of objects, defining height of the whole <b>div</b> based on width of the <b>div</b>.
        The height could be set explicitly, to value in em or px, or indireclty by CSS class. Possible properties (of height defining object in the array): <br><ul>
        <li>fromWidth - value in this object is valid only if div width is greater than or equal to this property value</li>
        <li>toWidth - value in this object is valid only if div width is less than this property value</li>
        <li>height - value in px or em, sets <b>div</b> height to this value, if all conditions in this object are fulfilled.</li>
        <li>className - CSS class name, adds this class to <b>div</b>'s classList, if all conditions in this object are fulfilled, otherwise removes this class from classList</li>
        </ul>
        Example:
        
        div.setAttribute('data-item-height', '[{toWidth: "35em", className: "rowHeight2line"}, {fromWidth: "35em", className: "rowHeight1line"}]');
        
    </li>
    </ul>


    @method precompileBinding
    @param {HTMLElement} div Element (Parent control's item) to be processed (e.g. ListView's item div)
    @param {Control} parentControl Parent control of the element, descendant of class Control (e.g. ListView)
    */
    window.precompileBinding = function (div, parentControl) {
        let txt;
        assert(parentControl !== undefined, 'precompileBinding - parentControl parameter must be defined');
        fillFirstBoundElements(div);
        if (!parentControl.bindFn && div.boundElements && div.boundElements.length > 0) {
            let bindFnText = 'var els0 = div.boundElements; var el; var cachedItem = {};\n';
            let params = {
                ttadded: false,
                counter: 0
            };
            let innerFnText = getBindFnText(div, params);
            if (params.ttadded) {
                bindFnText += 'cachedItem.trackTypeStringId = item.trackTypeStringId;\n';
            }
            if (parentControl.prebindFns && (parentControl.prebindFns.length > 0)) {
                bindFnText += 'forEach(this.prebindFns, function(fn) { fn(div);}.bind(this));';
            }
            bindFnText += innerFnText;
            parentControl.bindFn = new Function('div', 'item', 'params', '"use strict"; ' + bindFnText);
        }
        if (!parentControl.itemSizes && div.hasAttribute('data-item-height')) {
            parentControl.itemSizes = tryEval(div.getAttribute('data-item-height'));
            if (parentControl.itemSizes) {
                for (let i = 0; i < parentControl.itemSizes.length; i++) {
                    let obj = parentControl.itemSizes[i];
                    if (obj.fromWidth) {
                        obj.fromWidth = getPixelSize(obj.fromWidth);
                    }
                    if (obj.toWidth) {
                        obj.toWidth = getPixelSize(obj.toWidth);
                    }
                    if (obj.height) {
                        obj.height = Math.round(getPixelSize(obj.height));
                    }
                }
            }
        }
        div.sizeDependentElements = qes(div, '[data-width-from], [data-width-to], [data-cond-width]');
        if (div.sizeDependentElements && div.sizeDependentElements.length > 0) {
            forEach(div.sizeDependentElements, function (el) {
                el.limits = {
                    fromWidth: 0,
                    toWidth: 0
                };
                if (el.hasAttribute('data-width-from')) {
                    el.limits.fromWidth = getPixelSize(el.getAttribute('data-width-from'));
                }
                if (el.hasAttribute('data-width-to')) {
                    el.limits.toWidth = getPixelSize(el.getAttribute('data-width-to'));
                }
                if (el.hasAttribute('data-cond-width')) {
                    el.condWidths = tryEval(el.getAttribute('data-cond-width'));
                    if (el.condWidths) {
                        for (let i = 0; i < el.condWidths.length; i++) {
                            let obj = el.condWidths[i];
                            if (obj.fromWidth) {
                                obj.fromWidth = getPixelSize(obj.fromWidth);
                            }
                            if (obj.toWidth) {
                                obj.toWidth = getPixelSize(obj.toWidth);
                            }
                            if (obj.width) {
                                if (obj.width.indexOf('%') <= 0) {
                                    // width by percent leave as it is
                                    obj.width = Math.round(getPixelSize(obj.width)) + 'px';
                                }
                            }
                        }
                    }
                }
            }.bind(this));
        }
        if (!div.cloned) {
            let minwElements = qes(div, '[data-minwidth-pattern]');
            if (minwElements && minwElements.length > 0) {
                forEach(minwElements, function (el) {
                    let pattern = el.getAttribute('data-minwidth-pattern');
                    el.style.minWidth = getTextWidth(pattern, parentControl.container) + 'px';
                });
            }
        }
    };
    window.decompileBinding = function (div, parentControl) {
        div.loadListenerSet = null;
        div.srcAsAssigned = null; // LS: need to be reset otherwise artwork binding wouldn't work right (#14443)
        div.boundElements = null;
        div.__handlers = null;
        parentControl.itemSizes = undefined;
        parentControl.bindFn = undefined;
        parentControl.prebindFns = undefined;
    };
    window.recompileBinding = function (div, parentControl) {
        window.decompileBinding(div, parentControl);
        window.precompileBinding(div, parentControl);
    };
    window.input = {
        mouse: {
            over: function (div, el) {
                app.listen(div, 'mouseover', function () {
                    setVisibility(el, true);
                });
                app.listen(div, 'mouseleave', function () {
                    setVisibility(el, false);
                });
                return false;
            }
        }
    };
})();
