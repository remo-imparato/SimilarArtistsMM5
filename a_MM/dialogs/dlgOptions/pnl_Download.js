/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

function handlePodcastDownloadSubBox(e) {
    fillSecondPodcastDownloadDropdown(0);
}

function fillSecondPodcastDownloadDropdown(useIdx) {
    let selidx = qid('cbPodcastUpdate').controlClass.focusedIndex;
    let cb = qid('cbPodcastUpdate2');
    if ((selidx == 0) || (selidx == 1)) {
        setVisibility(qid('cbPodcastUpdate2'), true);
        cb.controlClass.dataSource = app.podcasts.getDownloadTypeCaptions(selidx);
        cb.controlClass.focusedIndex = useIdx;
    } else
        setVisibility(cb, false);
}


optionPanels.pnl_Library.subPanels.pnl_Download.load = function (sett) {
    qid('edtDownloadDir').controlClass.value = app.masks.mask2VisMask(sett.Masks.DownloadLocation);
    qid('cbMaxDownloadsAtOnce').controlClass.value = sett.Podcasts.MaxDownloadsAtOnce;
    qid('cbPodcastCheckUpdateType').controlClass.focusedIndex = sett.Podcasts.Glb_CheckPodcast;
    qid('lblPodcastLastCheck').innerText = _('Last check:') + ' ' + app.utils.dateTimeToStr(sett.Podcasts.PodcastLastTimeUpdate);
    qid('edtPodcastDir').controlClass.value = app.masks.mask2VisMask(sett.Podcasts.Glb_DownloadLocation);
    let podcast = app.podcasts.getDefaultPodcastData();
    qid('chbPodcastDelete').controlClass.checked = podcast.delEpisodes;
    qid('cbPodcastDelete').controlClass.focusedIndex = podcast.episodeAge;
    bindDisabled2Checkbox(qid('deletionSubBox'), qid('chbPodcastDelete'));
    bindDisabled2Checkbox(qid('cbPodcastDelete'), qid('chbPodcastDelete'));
    qid('chbPodcastListened').controlClass.checked = podcast.delOnlyListened;
    qid('chbPodcastRating').controlClass.checked = podcast.delRating;
    qid('btnPodcastRating').controlClass.value = podcast.delRatingValue;
    qid('chbPodcastRetain').controlClass.checked = podcast.retainEpisodes;
    qid('cbPodcastRetain').controlClass.setEditValue(podcast.retainNumber);
    bindDisabled2Checkbox(qid('cbPodcastRetain'), qid('chbPodcastRetain'));
    bindDisabled2Checkbox(qid('btnPodcastRating'), qid('chbPodcastRating'));    
    qid('chbPodcastTag').controlClass.checked = podcast.overwriteTags;
    qid('chbPodcastRemoved').controlClass.checked = podcast.showRemovedEpisodes;
    let cb = qid('cbPodcastUpdate');
    cb.controlClass.dataSource = app.podcasts.getDownloadTypeCaptions(-1);
    cb.controlClass.focusedIndex = app.podcasts.itemIndexFromDownloadType(1, podcast.downloadType);
    fillSecondPodcastDownloadDropdown(app.podcasts.itemIndexFromDownloadType(2 /*second combo*/ , podcast.downloadType));
    cb.controlClass.localListen(cb, 'change', handlePodcastDownloadSubBox.bind(this), false);
}

optionPanels.pnl_Library.subPanels.pnl_Download.save = function (sett) {
    sett.Masks.DownloadLocation = app.masks.visMask2Mask(qid('edtDownloadDir').controlClass.value);
    sett.Podcasts.MaxDownloadsAtOnce = qid('cbMaxDownloadsAtOnce').controlClass.value;
    sett.Podcasts.Glb_CheckPodcast = qid('cbPodcastCheckUpdateType').controlClass.focusedIndex;
    sett.Podcasts.Glb_DownloadLocation = app.masks.visMask2Mask(qid('edtPodcastDir').controlClass.value);
    sett.Podcasts.Glb_DelEpisodes = qid('chbPodcastDelete').controlClass.checked;
    sett.Podcasts.Glb_EpisodeAge = qid('cbPodcastDelete').controlClass.focusedIndex;
    sett.Podcasts.Glb_DelOnlyListened = qid('chbPodcastListened').controlClass.checked;
    sett.Podcasts.Glb_DelRating = qid('chbPodcastRating').controlClass.checked;
    sett.Podcasts.Glb_DelRatingValue = qid('btnPodcastRating').controlClass.value;
    sett.Podcasts.Glb_RetainEpisodes = qid('chbPodcastRetain').controlClass.checked;
    sett.Podcasts.Glb_RetainNumber = qid('cbPodcastRetain').controlClass.value;
    sett.Podcasts.Glb_OverwriteTags = qid('chbPodcastTag').controlClass.checked;
    sett.Podcasts.Glb_ShowRemovedEpisodes = qid('chbPodcastRemoved').controlClass.checked;
    if (isVisible(qid('cbPodcastUpdate2')))
        sett.Podcasts.Glb_DownloadType = app.podcasts.downloadTypeFromItemIndex(qid('cbPodcastUpdate').controlClass.focusedIndex, qid('cbPodcastUpdate2').controlClass.focusedIndex);
    else
        sett.Podcasts.Glb_DownloadType = app.podcasts.downloadTypeFromItemIndex(qid('cbPodcastUpdate').controlClass.focusedIndex, 0);
    app.podcasts.notifyUpdate();
}
