/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

// ----------------------------------------------------
// Wizard ---------------------------------------------
// ----------------------------------------------------
function initWizard() {

    title = _('Destination');
    noAutoSize = true;
    resizeable = true;
    bounds.setSize(600, 400);
    document.body.setAttribute('data-help', 'Configuring_Directory_and_File_Formats');
    // prepare HTML elements
    this._container = document.createElement('div');
    this._container.classList.add('fill');
    this._container.classList.add('flex');
    this._container.classList.add('column');
    this._container.classList.add('padding');
    document.body.appendChild(this._container);

    this._editsPanel = document.createElement('div');
    this._editsPanel.classList.add('fill');
    this._container.appendChild(this._editsPanel);

    let addRow = function (title, hint, editType, maskEditInitParams, sample) {
        let _row = document.createElement('tr');
        this._editsParent.appendChild(_row);

        let _cell = document.createElement('td');
        _cell.classList.add('fixed');
        if (sample)
            _cell.classList.add('sampleData');
        _row.appendChild(_cell);

        let _label = document.createElement('label');
        _label.innerText = title;
        _cell.appendChild(_label);

        _cell = document.createElement('td');
        if (sample) {
            _cell.classList.add('sampleData');
            _cell.classList.add('leftAligned');
        }
        _row.appendChild(_cell);

        let _input = undefined;
        if (editType) {
            _input = document.createElement(editType);
            _input.setAttribute('data-tip', hint);
            _cell.appendChild(_input);

            if (editType == 'input') {
                _input.type = 'text';
            } else if (editType == 'div') {
                if (maskEditInitParams) {
                    _input.controlClass = new MaskEdit(_input, maskEditInitParams);
                } else {
                    if (sample)
                        _input.classList.add('sample');
                }
            }
        }

        return _input;
    };


    this._editsParent = document.createElement('table');
    this._editsParent.classList.add('wizard_table');
    this._editsPanel.appendChild(this._editsParent);

    this._mainDirectoryInput = addRow(_('Main directory:'), _('Statically defined root folder'), 'div', {
        hideWizardButton: true,
        hideMaskMenuButton: true,
        showBrowseButton: !params.hideBrowseButton
    });
    this._subDirectoryInput = addRow(_('Subdirectories') + ':', _('Subdirectories can be defined statically or using mask variables'), 'div', {
        hideWizardButton: true
    });
    this._filenameInput = addRow(_('Filenames') + ':', _('Filenames can be defined using mask variables or statically'), 'div', {
        hideWizardButton: true
    });
    this._sample = addRow(_('Sample:'), _(''), 'div', null, true /* sample*/ );

    this._subDirectoryInput.controlClass.masks = app.masks.getDefaultWizardPathMasks();
    this._filenameInput.controlClass.masks = app.masks.getDefaultWizardFileMasks();

    // buttons
    this._buttonsRow = document.createElement('div');
    this._buttonsRow.classList.add('static');
    this._buttonsRow.classList.add('nonTransparent');
    this._container.appendChild(this._buttonsRow);
    // buttons class
    this._buttons = document.createElement('div');
    this._buttons.controlClass = new Buttons(this._buttons);
    this._buttonsRow.appendChild(this._buttons);

    this._okButton = this._buttons.controlClass.addBtn({
        btnID: 'btnOK'
    });
    this._cancelButton = this._buttons.controlClass.addBtn({
        btnID: 'btnCancel'
    });

    app.listen(this._okButton, 'click', function () {
        params.updateParentMaskEdit(getNewMask());
        closeWindow();
    }.bind(this));
    app.listen(this._cancelButton, 'click', function () {
        closeWindow();
    }.bind(this));

    fillEdits();

    let onchanged = function (e) {
        refreshSample();
    };

    app.listen(this._mainDirectoryInput, 'change', onchanged);
    app.listen(this._subDirectoryInput, 'change', onchanged);
    app.listen(this._filenameInput, 'change', onchanged);

}

function getNewMask() {
    let root = this._mainDirectoryInput.controlClass.value;
    let path = this._subDirectoryInput.controlClass.value;
    let fn = this._filenameInput.controlClass.value;

    let m = '';
    if (root)
        m = m + removeLastSlash(root) + '\\';
    if (path)
        m = m + removeLastSlash(path) + '\\';
    m = m + fn;
    return m;
}

function fillEdits() {
    let m = params.mask;
    this._mainDirectoryInput.controlClass.value = app.masks.getPathPart(m) || params.virtualDir;
    let list = app.masks.getMaskPathAndFileName(m);
    list.locked(function () {
        if (list.count > 0)
            this._subDirectoryInput.controlClass.value = list.getValue(0);
        if (list.count > 1)
            this._filenameInput.controlClass.value = list.getValue(1);
    });

    refreshSample();
}

function refreshSample() {
    let list = null;
    params.sampleTrack.locked(function () {
        list = app.masks.getTrackPathParts(params.sampleTrack, getNewMask());
    }.bind(this));

    if (list) {
        let text = '';
        list.locked(function () {
            let shift = '';
            for (let a = 0; a < list.count; a++) {
                let item = list.getValue(a);
                if (a > 0)
                    item = '\\' + item;
                text = text + shift + item + '<br>';
                shift = shift + '&nbsp;&nbsp;&nbsp;';
            }
        });

        this._sample.innerHTML = text;
    }
}
