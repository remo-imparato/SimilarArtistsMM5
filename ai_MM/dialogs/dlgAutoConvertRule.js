/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

let frameRatesVals = [8008, 10010, 12012, 15015, 20020, 24000, 24024, 25025, 30000, 30030, 60060];
let frCBVal = function (val) {
    return Math.round((val / 1001) * 1000) / 1000;
};

function addConditionRow(caption, id, unit, isCombo) {
    let tr = document.createElement('tr');
    let edtFromDiv, edtToDiv;
    if (isCombo) {
        edtFromDiv = '    <div data-id="edt' + id + 'From" class="" data-control-class="Dropdown" data-init-params="{readOnly: true}"></div>';
        edtToDiv = '    <div data-id="edt' + id + 'To" class="" data-control-class="Dropdown" data-init-params="{readOnly: true}"></div>';
    } else {
        edtFromDiv = '    <div data-id="edt' + id + 'From" class="thinControl" data-control-class="Edit" data-init-params="{type:\'number\', min:0, max:999999}"></div>';
        edtToDiv = '    <div data-id="edt' + id + 'To" class="thinControl" data-control-class="Edit" data-init-params="{type:\'number\', min:0, max:999999}"></div>';
    };

    tr.innerHTML =
        '<td>' +
        '    <label>' + caption + '</label>' +
        '</td>' +
        '<td>' +
        '    <div data-id="cb' + id + '" data-control-class="Dropdown" data-init-params="{readOnly: true}">' +
        '       <option>-----</option>' +
        '       <option>Above</option>' +
        '       <option>Between</option>' +
        '   </div>' +
        '</td>' +
        '<td>' +
        edtFromDiv +
        '</td>' +
        '<td data-id="td' + id + 'To">' +
        edtToDiv +
        '</td>' +
        '<td>' +
        '    <label data-id="lbl' + id + '" >' + unit + '</label>' +
        '</td>';
    tr.setAttribute('data-id', 'tr' + id);
    return tr;
}

function setConditionValues(id, condType, fromVal, toVal) {
    qid('cb' + id).controlClass.focusedIndex = condType;
    qid('edt' + id + 'From').controlClass.value = fromVal;
    qid('edt' + id + 'To').controlClass.value = toVal;
}

function getConditionValues(id, toItem, condType, fromVal, toVal) {
    toItem[condType] = qid('cb' + id).controlClass.focusedIndex;
    toItem[fromVal] = qid('edt' + id + 'From').controlClass.value;
    toItem[toVal] = qid('edt' + id + 'To').controlClass.value;
}

function setConditionVisibility(id, value) {
    setVisibility(qid('tr' + id), value);
    if (value) {
        qid('cb' + id).controlClass.calcAutoWidth();
    }
}

function initRow(id) {
    let cb = qid('cb' + id);
    window.localListen(cb, 'change', function () {
        let idx = cb.controlClass.focusedIndex;
        setVisibility(qid('edt' + id + 'From'), (idx === 1) || (idx === 2));
        setVisibility(qid('td' + id + 'To'), (idx === 2));
        setVisibility(qid('lbl' + id), (idx === 1) || (idx === 2));
        if ((idx === 1) || (idx === 2)) {
            let e = qid('edt' + id + 'From');
            if (e && e.controlClass && e.controlClass.autoWidth && e.controlClass.calcAutoWidth)
                e.controlClass.calcAutoWidth();
            if (idx === 2) {
                e = qid('edt' + id + 'To');
                if (e && e.controlClass && e.controlClass.autoWidth && e.controlClass.calcAutoWidth)
                    e.controlClass.calcAutoWidth();
            }
        }
    });
}

function fillSourceFormatCombo(isVideo) {
    let cbSourceFormat = qid('cbSourceFormat');
    let list = null;
    if (isVideo)
        list = app.filesystem.getVideoExtensions();
    else
        list = app.filesystem.getAudioExtensions();
    list.insert(0, _('Any'));
    list.insert(1, _('Incompatible'));
    cbSourceFormat.controlClass.dataSource = list;
}

function setSourceFormatComboValue(item) {
    let cb = qid('cbSourceFormat');
    if (item.sourceFormat == '*ANY*')
        cb.controlClass.focusedIndex = 0;
    else
    if (item.sourceFormat == '*UNK*')
        cb.controlClass.focusedIndex = 1;
    else {
        let idx = 0;
        let list = cb.controlClass.dataSource;
        list.locked(function () {
            for (let i = 0; i < list.count; i++) {
                if (list.getValue(i).toUpperCase() == item.sourceFormat.toUpperCase()) {
                    idx = i;
                    break;
                }
            }
        });
        cb.controlClass.focusedIndex = idx;
    }
}

function setTargetFormatComboValue(item) {
    let cb = qid('cbTargetFormat');
    let idx = 0;
    let list = cb.controlClass.dataSource;
    list.locked(function () {
        let tgtFmt = item.targetFormat.toUpperCase();
        let sett = item.targetFormatSettings;
        let info;
        if (sett)
            info = sett.getShortInfo();
        for (let i = 0; i < list.count; i++) {
            let val = list.getValue(i);
            if ((val.getExtension().toUpperCase() === tgtFmt) && (info === val.getShortInfo())) {
                idx = i;
                break;
            }
        }
    });
    cb.controlClass.focusedIndex = idx;
}

function init(params) {

    let item = params.item;
    let convertSettings = params.convertSettings;

    title = _('Auto-conversion rule');
    resizeable = true;

    let tbl = qid('tblConditions');

    tbl.appendChild(addConditionRow(_('Video bitrate') + ':', 'VideoBitrate', 'kbps'));
    tbl.appendChild(addConditionRow(_('Frame rate') + ':', 'FrameRate', 'fps', true));
    tbl.appendChild(addConditionRow(_('Frame width') + ':', 'FrameWidth', 'px'));
    tbl.appendChild(addConditionRow(_('Frame height') + ':', 'FrameHeight', 'px'));
    tbl.appendChild(addConditionRow(_('Audio bitrate') + ':', 'AudioBitrate', 'kbps'));
    tbl.appendChild(addConditionRow(_('Audio sample rate') + ':', 'AudioSampleRate', 'Hz'));
    tbl.appendChild(addConditionRow(_('Audio channels') + ':', 'AudioChannels', ''));
    tbl.appendChild(addConditionRow(_('Audio bit depth') + ':', 'AudioBPS', 'bits'));
    initializeControls(tbl);

    initRow('VideoBitrate');
    initRow('FrameRate');
    initRow('FrameWidth');
    initRow('FrameHeight');
    initRow('AudioBitrate');
    initRow('AudioSampleRate');
    initRow('AudioChannels');
    initRow('AudioBPS');

    // set frame rate values
    let frFrom = qid('edtFrameRateFrom').controlClass;
    let frTo = qid('edtFrameRateTo').controlClass;
    let frFromIdx = 7; // 25fps default
    let frToIdx = 7;
    let dsFrom = newStringList();
    let dsTo = newStringList();
    let txt;
    forEach(frameRatesVals, function (val, idx) {
        if (val === item.frameRateFrom) {
            frFromIdx = idx;
        }
        if (val === item.frameRateTo) {
            frToIdx = idx;
        }
        txt = String(frCBVal(val));
        dsFrom.add(txt);
        dsTo.add(txt);
    });
    frFrom.dataSource = dsFrom;
    frFrom.focusedIndex = frFromIdx;
    frTo.dataSource = dsTo;
    frTo.focusedIndex = frToIdx;

    setConditionValues('VideoBitrate', item.vBitrate, item.vBitrateFrom, item.vBitrateTo);
    setConditionValues('FrameRate', item.frameRate, frCBVal(item.frameRateFrom), frCBVal(item.frameRateTo));
    setConditionValues('FrameWidth', item.width, item.widthFrom, item.widthTo);
    setConditionValues('FrameHeight', item.height, item.heightFrom, item.heightTo);
    setConditionValues('AudioBitrate', item.bitrate, item.bitrateFrom, item.bitrateTo);
    setConditionValues('AudioSampleRate', item.sampleRate, item.sampleRateFrom, item.sampleRateTo);
    setConditionValues('AudioChannels', item.channels, item.channelsFrom, item.channelsTo);
    setConditionValues('AudioBPS', item.bps, item.bpsFrom, item.bpsTo);

    let cbFormatType = qid('cbFormatType');
    let cbTargetFormat = qid('cbTargetFormat');
    let cbQualityProfile = qid('cbQualityProfile');
    let lblTargetFormatText = qid('lblTargetFormatText');

    let updateTargetFormatInfo = function () {
        if (item.isVideo) {
            cbQualityProfile.controlClass.focusedIndex = item.qualityProfile;
            lblTargetFormatText.innerText = item.targetFormatTextLong;
        } else {
            let tgt = cbTargetFormat.controlClass.dataSource.focusedItem;
            lblTargetFormatText.innerText = tgt ? tgt.getInfo() : '';
        }
    }

    window.localListen(cbFormatType, 'change', function () {
        let isVideo = (cbFormatType.controlClass.focusedIndex == 1);
        item.isVideo = isVideo;

        fillSourceFormatCombo(isVideo);
        setSourceFormatComboValue(item);

        setConditionVisibility('VideoBitrate', isVideo);
        setConditionVisibility('FrameRate', isVideo);
        setConditionVisibility('FrameWidth', isVideo);
        setConditionVisibility('FrameHeight', isVideo);
        setVisibility(qid('trQualityProfile'), isVideo);

        let ds = item.getTargetFormatList(isVideo, convertSettings);
        cbTargetFormat.controlClass.dataSource = ds;
        window.localPromise(ds.whenLoaded()).then(() => {
            setTargetFormatComboValue(item);
            updateTargetFormatInfo();
        });
    });
    if (item.isVideo)
        cbFormatType.controlClass.focusedIndex = 1;
    else
        cbFormatType.controlClass.focusedIndex = 0;

    window.localListen(cbTargetFormat, 'change', function () {
        item.targetFormatSettings = cbTargetFormat.controlClass.dataSource.focusedItem;
        updateTargetFormatInfo();
    });

    window.localListen(qid('btnCustomize'), 'click', function () {
        let pr = cbTargetFormat.controlClass.dataSource.focusedItem.showSettingsDialogAsync();
        if (pr)
            window.localPromise(pr).then(updateTargetFormatInfo);
    });

    window.localListen(cbQualityProfile, 'change', function () {
        item.qualityProfile = cbQualityProfile.controlClass.focusedIndex;
        updateTargetFormatInfo();
    });


    window.localListen(qid('btnOK'), 'click', function () {

        let cb = qid('cbSourceFormat');
        if (cb.controlClass.focusedIndex == 0)
            item.sourceFormat = '*ANY*';
        else
        if (cb.controlClass.focusedIndex == 1)
            item.sourceFormat = '*UNK*';
        else
            item.sourceFormat = cb.controlClass.dataSource.focusedItem.toString();

        getConditionValues('VideoBitrate', item, 'vBitrate', 'vBitrateFrom', 'vBitrateTo');
        //getConditionValues('FrameRate', item, 'frameRate', 'frameRateFrom', 'frameRateTo');
        item['frameRate'] = qid('cbFrameRate').controlClass.focusedIndex;
        item['frameRateFrom'] = frameRatesVals[qid('edtFrameRateFrom').controlClass.focusedIndex];
        item['frameRateTo'] = frameRatesVals[qid('edtFrameRateTo').controlClass.focusedIndex];


        getConditionValues('FrameWidth', item, 'width', 'widthFrom', 'widthTo');
        getConditionValues('FrameHeight', item, 'height', 'heightFrom', 'heightTo');
        getConditionValues('AudioBitrate', item, 'bitrate', 'bitrateFrom', 'bitrateTo');
        getConditionValues('AudioSampleRate', item, 'sampleRate', 'sampleRateFrom', 'sampleRateTo');
        getConditionValues('AudioChannels', item, 'channels', 'channelsFrom', 'channelsTo');
        getConditionValues('AudioBPS', item, 'bps', 'bpsFrom', 'bpsTo');

        window.localPromise(app.utils.checkFormatAvailability(cbTargetFormat.controlClass.dataSource.focusedItem)).then(function (res) {
            if (res)
                modalResult = 1;
        });
    });
}
