/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

requirejs("controls/maskedit");

function init(params) {

    let suppFormat = params.item;

    title = _('Set formats');
    resizeable = true;

    let UI = getAllUIElements();

    let contentTypeList = suppFormat.getContentTypeList();
    UI.cbContentType.controlClass.dataSource = contentTypeList;
    window.localPromise(contentTypeList.whenLoaded()).then(function () {
        contentTypeList.modifyAsync(function () {
            for (let i = 0; i < contentTypeList.count; i++) {
                if (suppFormat.content == contentTypeList.getValue(i).toString()) {
                    UI.cbContentType.controlClass.focusedIndex = i;
                    break;
                }
            }
        });
    });
    let ctAudio = _('Audio');
    let ctVideo = _('Video');
    window.localListen(UI.cbContentType, 'change', function () {
        suppFormat.content = contentTypeList.focusedItem.toString();
        UI.lvFileFormats.controlClass.dataSource = suppFormat.getFileFormatsList();
        if (suppFormat.content === ctAudio || suppFormat.content === ctVideo) {
            setVisibility(UI.tabs, true);
            UI.tabs.controlClass.setTabVisibility(UI.tabVideo, (suppFormat.content === ctVideo));

            UI.lvAudioFormats.controlClass.dataSource = suppFormat.getAudioFormatsList();
            UI.lvAudioSampleRates.controlClass.dataSource = suppFormat.getAudioSampleRatesList();
            UI.lvAudioChannels.controlClass.dataSource = suppFormat.getAudioChannelsList();
            UI.lvAudioBPS.controlClass.dataSource = suppFormat.getAudioBPSList();

            UI.lvVideoFormats.controlClass.dataSource = suppFormat.getVideoFormatsList();
            let _updateProfilesAndLevels = function () {
                UI.lvVideoProfiles.controlClass.dataSource = suppFormat.getVideoProfilesList();
                UI.lvVideoLevels.controlClass.dataSource = suppFormat.getVideoLevelsList();
            }
            _updateProfilesAndLevels();
            window.localListen(UI.lvVideoFormats, 'checkedchanged', function () {
                suppFormat.setVideoFormatsList(UI.lvVideoFormats.controlClass.dataSource);
                _updateProfilesAndLevels();
            });

        } else {
            setVisibility(UI.tabs, false);
        }
    });

    let defColumns = [{
        setupCell: GridView.prototype.cellSetups.setupCheckbox,
        bindData: function (div, item, index) {
            GridView.prototype.defaultBinds.bindCheckboxCell(div, item, index);
            div.check.controlClass.text = item.toString();
        }
    }];
    let defColumnsWithTip = [{
        setupCell: GridView.prototype.cellSetups.setupCheckbox,
        bindData: function (div, item, index) {
            GridView.prototype.defaultBinds.bindCheckboxCell(div, item, index);
            let astr=item.toString().split('|');
            div.check.controlClass.text = astr[0];
            div.parentElement.setAttribute('data-tip', astr[1]);
        }
    }];
    
    UI.lvFileFormats.controlClass.setColumns(defColumns);
    UI.lvAudioFormats.controlClass.setColumns(defColumnsWithTip);
    UI.lvAudioChannels.controlClass.setColumns(defColumns);
    UI.lvAudioBPS.controlClass.setColumns(defColumns);

    let sampleRatesColumns = [{
        setupCell: GridView.prototype.cellSetups.setupCheckbox,
        bindData: function (div, item, index) {
            GridView.prototype.defaultBinds.bindCheckboxCell(div, item, index);
            div.check.controlClass.text = item + ' ' + _('Hz');
        }
    }];
    UI.lvAudioSampleRates.controlClass.setColumns(sampleRatesColumns);

    UI.lvVideoFormats.controlClass.setColumns(defColumnsWithTip);
    UI.lvVideoProfiles.controlClass.setColumns(defColumns);
    UI.lvVideoLevels.controlClass.setColumns(defColumns);

    UI.audioBitratesMin.controlClass.value = suppFormat.minAudioBitrate;
    UI.audioBitratesMax.controlClass.value = suppFormat.maxAudioBitrate;

    UI.videoBitratesMin.controlClass.value = suppFormat.minVideoBitrate;
    UI.videoBitratesMax.controlClass.value = suppFormat.maxVideoBitrate;

    UI.videoFrameratesMin.controlClass.value = suppFormat.minVideoFramerate;
    UI.videoFrameratesMax.controlClass.value = suppFormat.maxVideoFramerate;

    UI.videoWidthMin.controlClass.value = suppFormat.minVideoWidth;
    UI.videoWidthMax.controlClass.value = suppFormat.maxVideoWidth;

    UI.videoHeightMin.controlClass.value = suppFormat.minVideoHeight;
    UI.videoHeightMax.controlClass.value = suppFormat.maxVideoHeight;

    window.localListen(UI.btnOK, 'click', function () {

        suppFormat.setFileFormatsList(UI.lvFileFormats.controlClass.dataSource);
        if ((suppFormat.content === ctAudio) || (suppFormat.content === ctVideo)) {
            suppFormat.setAudioFormatsList(UI.lvAudioFormats.controlClass.dataSource);
            suppFormat.setAudioSampleRatesList(UI.lvAudioSampleRates.controlClass.dataSource);
            suppFormat.setAudioChannelsList(UI.lvAudioChannels.controlClass.dataSource);
            suppFormat.setAudioBPSList(UI.lvAudioBPS.controlClass.dataSource);

            suppFormat.setVideoFormatsList(UI.lvVideoFormats.controlClass.dataSource);
            suppFormat.setVideoProfilesList(UI.lvVideoProfiles.controlClass.dataSource);
            suppFormat.setVideoLevelsList(UI.lvVideoLevels.controlClass.dataSource);

            suppFormat.minAudioBitrate = UI.audioBitratesMin.controlClass.value;
            suppFormat.maxAudioBitrate = UI.audioBitratesMax.controlClass.value;

            suppFormat.minVideoBitrate = UI.videoBitratesMin.controlClass.value;
            suppFormat.maxVideoBitrate = UI.videoBitratesMax.controlClass.value;

            suppFormat.minVideoFramerate = UI.videoFrameratesMin.controlClass.value.toString();
            suppFormat.maxVideoFramerate = UI.videoFrameratesMax.controlClass.value.toString();

            suppFormat.minVideoWidth = UI.videoWidthMin.controlClass.value;
            suppFormat.maxVideoWidth = UI.videoWidthMax.controlClass.value;

            suppFormat.minVideoHeight = UI.videoHeightMin.controlClass.value;
            suppFormat.maxVideoHeight = UI.videoHeightMax.controlClass.value;
        }
        modalResult = 1;
    });
}
