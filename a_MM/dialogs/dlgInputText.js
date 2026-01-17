/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

function init(params) {
    title = params.title;
    this.resizeable = false;

    let UI = getAllUIElements();
    UI.lblDescription.innerHTML = params.description;

    if (params.defaultValue)
        UI.edtText.controlClass.value = params.defaultValue;

    let textInput = '';
    window.localListen(UI.btnOK, 'click', function () {
        textInput = UI.edtText.controlClass.value;
        modalResult = 1;
    });

    if (params.type) {
        UI.edtText.controlClass.edit.type = params.type;
        if (params.type === 'number') {
            UI.edtText.className = ''; // numbers do not stretch to the whole width, it looks strange
        }
    }
    if (params.min)
        UI.edtText.controlClass.edit.setAttribute('min', params.min);
    if (params.max)
        UI.edtText.controlClass.edit.setAttribute('max', params.max);

    if (params.additionalContent) {
        UI.edtCustom.innerHTML += params.additionalContent;
        initializeControls(UI.edtCustom);
    }

    if (params.helpContext)
        document.body.setAttribute('data-help', params.helpContext);

    if (params.changeEvent) {
        window.localListen(UI.edtText, 'change', (e) => {
            params.changeEvent(e);
        });
    }

    if (params.editTitle) {
        let newItem = document.createElement('label');
        newItem.innerText = params.editTitle;
        UI.edtContainer.insertBefore(newItem, UI.edtContainer.childNodes[0]);
        if (params.editTitleClass)
            newItem.classList.add(params.editTitleClass);
    }

    if (params.onAfterInit) {
        params.onAfterInit();
    }

    UI.edtText.controlClass.focus();

    window.getTextInput = function () {
        return textInput;
    };
}
