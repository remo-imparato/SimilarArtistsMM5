/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

requirejs("controls/gridview");
requirejs("masks");

let maskSet, config, selectedMasks;

function init(params) {
    let wnd = this;
    wnd.resizeable = true;
    wnd.title = _('Choose fields') + '...';

    maskSet = params.maskSet;
    config = params.config;

    let cbFileType = qid('cbFileType');
    window.localListen(cbFileType, 'change', onTrackTypeChange)
    if (params.trackType)
        cbFileType.controlClass.focusedIndex = params.trackType;
    else
        cbFileType.controlClass.focusedIndex = 0;

    let LV = qid('lvFieldsList');
    LV.controlClass.showHeader = false;
    LV.controlClass.isSortable = false;
    LV.controlClass.multiselect = false;
    LV.controlClass.enableDragNDrop();

    let columns = new Array();
    columns.push({
        order: 1,
        headerRenderer: GridView.prototype.headerRenderers.renderCheck,
        setupCell: GridView.prototype.cellSetups.setupCheckbox,
        bindData: GridView.prototype.defaultBinds.bindCheckboxCell
    });
    columns.push({
        order: 2,
        bindData: function (div, item, index) {
            div.innerText = app.masks.getVisName(item.toString());
        }
    });
    LV.controlClass.setColumns(columns);

    let editButtons = qid('lvEditButtons').controlClass.buttons;
    setVisibility(editButtons.new, false);
    setVisibility(editButtons.edit, false);
    setVisibility(editButtons.delete, false);

    setVisibility(qid('boxFileType'), params.config.trackType);
    setVisibility(qid('boxColumnCount'), params.config.columnCount);
    setVisibility(qid('lvEditButtons'), params.config.sortable);

    window.localListen(qid('btnOK'), 'click', function () {
        saveCurrentState();
        modalResult = 1;
        closeWindow();
    });

    window.getSelectedMasks = function () {
        return selectedMasks.join(';');
    };
}

function onTrackTypeChange() {
    let trackType = qid('cbFileType').controlClass.focusedIndex;

    if (config.columnCount) {
        let s = app.getValue('artWindow', {
            fontSize: 'smaller',
            columnCount: 2
        });  
        qid('cbColumnCount').controlClass.value = s.columnCount || 2;
    }

    let sett = window.settings.get('System, Options');
    if (maskSet == 'preview')
        selectedMasks = sett.System['ShowDetailsInOrder' + trackType].split(';');
    else
    if (maskSet == 'removePrefixTheFields')
        selectedMasks = sett.Options.IgnorePrefixFields.split(';');


    let masks = getPredefinedMasks(maskSet);

    for (let j = 0; j < selectedMasks.length; j++) {
        masks.remove(selectedMasks[j]);
    }
    window.localPromise(masks.modifyAsync(function () {
        masks.beginUpdate();
        for (let j = 0; j < selectedMasks.length; j++) {
            masks.insert(j, selectedMasks[j]);
            masks.setChecked(j, true);
        }
        masks.endUpdate();
    })).then(function () {
        qid('lvFieldsList').controlClass.dataSource = masks;
        qid('lvEditButtons').controlClass.dataSource = masks;
    });
}

function saveCurrentState() {
    let trackType = qid('cbFileType').controlClass.focusedIndex;

    selectedMasks = new Array();
    let masks = qid('lvFieldsList').controlClass.dataSource;
    masks.locked(function () {
        for (let i = 0; i < masks.count; i++) {
            let mask = masks.getValue(i);
            if (masks.isChecked(i)) {
                selectedMasks.push(mask);
            }
        }
    });

    let sett = window.settings.get('System, Options');
    if (maskSet == 'preview')
        sett.System['ShowDetailsInOrder' + trackType] = selectedMasks.join(';');
    else
    if (maskSet == 'removePrefixTheFields')
        sett.Options.IgnorePrefixFields = selectedMasks.join(';');
    window.settings.set(sett, 'System, Options');

    if (config.columnCount) {
        let s = app.getValue('artWindow', {
            fontSize: 'smaller',
            columnCount: 2
        });
        s.columnCount = qid('cbColumnCount').controlClass.value;
        app.setValue('artWindow', s);
    }
}

window.windowCleanup = function () {
    maskSet = undefined;
    config = undefined;
    selectedMasks = undefined;
}