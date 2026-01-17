/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

function init(params) {
    let wnd = this;
    wnd.title = 'Podcast subscription';
    wnd.resizeable = false;

    let isJustEdit = params && params.isEdit;
    if (!params.podcast) {
        wnd.podcast = app.podcasts.getDefaultPodcastData();
    } else {
        wnd.podcast = params.podcast;
    }

    let podcast = wnd.podcast;
    let origUrl = podcast.podcastURL;
    qid('edtPodcastURL').controlClass.value = podcast.podcastURL;
    qid('edtTitle').controlClass.value = podcast.title;
    qid('edtDescription').value = podcast.description;
    qid('edtLogin').controlClass.value = podcast.login;
    qid('edtPassword').controlClass.value = podcast.password;
    qid('chbCustomize').controlClass.checked = podcast.customizeRules;
    qid('chbDelete').controlClass.checked = podcast.delEpisodes;
    qid('cbDelete').controlClass.focusedIndex = podcast.episodeAge;
    qid('chbListened').controlClass.checked = podcast.delOnlyListened;
    qid('chbRating').controlClass.checked = podcast.delRating;
    qid('btnRating').controlClass.value = podcast.delRatingValue;
    qid('chbRetain').controlClass.checked = podcast.retainEpisodes;
    qid('cbRetain').controlClass.setEditValue(podcast.retainNumber);
    qid('chbTag').controlClass.checked = podcast.overwriteTags;
    qid('chbRemoved').controlClass.checked = podcast.showRemovedEpisodes;


    let cb = qid('cbDownload');
    cb.controlClass.dataSource = app.podcasts.getDownloadTypeCaptions(-1);
    cb.controlClass.focusedIndex = app.podcasts.itemIndexFromDownloadType(1, podcast.downloadType);
    fillSecondDownloadDropdown(app.podcasts.itemIndexFromDownloadType(2 /*second combo*/ , podcast.downloadType));
    window.localListen(cb, 'change', handleDownloadSubBox);

    bindDisabled2Checkbox(qid('groupbox'), qid('chbCustomize'));
    bindDisabled2Checkbox(qid('deletionSubBox'), qid('chbDelete'));
    bindDisabled2Checkbox(qid('cbDelete'), qid('chbDelete'));
    bindDisabled2Checkbox(qid('cbRetain'), qid('chbRetain'));
    bindDisabled2Checkbox(qid('btnRating'), qid('chbRating'));

    setVisibility( qid('lblWarning'), false);

    window.localListen(qid('btnOK'), 'click', function () {
        if (isJustEdit && (qid('edtPodcastURL').controlClass.value == '')) {
            modalResult = 2;
            closeWindow();
        }
        else
        if ((qid('edtPodcastURL').controlClass.value == '') || (qid('edtTitle').controlClass.value == ''))
            messageDlg(_("Please enter the Podcast's title and URL to subscribe."), 'Error', ['btnOK'], {
                defaultButton: 'btnOK'
            }, undefined);
        else {
            getPodcastDataFromUI(wnd.podcast);
            if (isJustEdit) {
                window.localPromise(wnd.podcast.commitAsync()).then(() => {
                    if (origUrl != podcast.podcastURL)
                        wnd.podcast.runUpdate();
                    modalResult = 1;
                    closeWindow();
                });
            } else {
                window.localPromise(app.podcasts.getPodcastByURLAsync(wnd.podcast.podcastURL)).then(function (foundPodcast) {
                    if (foundPodcast) {
                        messageDlg(_('You are already subscribed to this podcast'), 'Information', ['btnOK'], {
                            defaultButton: 'btnOK'
                        }, undefined);
                    } else {
                        window.localPromise(wnd.podcast.commitAsync()).then(() => {
                            wnd.podcast.runUpdate();
                            modalResult = 1;
                            closeWindow();
                        });
                    }
                });
            }
        }
    });
    let edtPodcastURL = qid('edtPodcastURL');
    let edtLogin = qid('edtLogin');
    let edtPassword = qid('edtPassword');
    let _fetchInfo = function () {
        let podcast = app.podcasts.getDefaultPodcastData();
        podcast.podcastURL = edtPodcastURL.controlClass.value;
        podcast.login = edtLogin.controlClass.value;
        podcast.password = edtPassword.controlClass.value;
        window.localPromise(podcast.getChannelDataAsync()).then(function () {
            if (window._cleanUpCalled)
                return;
            qid('edtTitle').controlClass.value = podcast.title;
            qid('edtDescription').value = podcast.description;
            setVisibility( qid('lblWarning'), !podcast.isValid);
        });
    }
    window.localListen(edtPodcastURL, 'input', _fetchInfo);
    if ((podcast.podcastURL != '') && (podcast.id < 0))
        _fetchInfo(); // auto-fetch the title/description for podcasts that aren't already stored into database

    window.localListen(edtLogin, 'input', _fetchInfo);
    window.localListen(edtPassword, 'input', _fetchInfo);

    let btnGlobalOptions = qid('btnGlobalOptions');
    btnGlobalOptions.controlClass.textContent = _('Global podcast options') + '...';
    window.localListen(btnGlobalOptions, 'click', function () {
        window.uitools.showOptions('pnl_Download');
    });
}

function handleDownloadSubBox() {
    fillSecondDownloadDropdown(0);
}

function fillSecondDownloadDropdown(useIdx) {
    let selidx = qid('cbDownload').controlClass.focusedIndex;
    let cb = qid('cbDownload2');
    if ((selidx == 0) || (selidx == 1)) {
        setVisibility(qid('cbDownload2'), true);
        cb.controlClass.dataSource = app.podcasts.getDownloadTypeCaptions(selidx);
        cb.controlClass.focusedIndex = useIdx;
    } else
        setVisibility(cb, false);
}

function getPodcastDataFromUI(podcast) {
    podcast.podcastURL = qid('edtPodcastURL').controlClass.value;
    podcast.title = qid('edtTitle').controlClass.value;
    podcast.description = qid('edtDescription').value;
    podcast.login = qid('edtLogin').controlClass.value;
    podcast.password = qid('edtPassword').controlClass.value;
    podcast.customizeRules = qid('chbCustomize').controlClass.checked;
    podcast.delEpisodes = qid('chbDelete').controlClass.checked;
    podcast.episodeAge = qid('cbDelete').controlClass.focusedIndex;
    podcast.delOnlyListened = qid('chbListened').controlClass.checked;
    podcast.delRating = qid('chbRating').controlClass.checked;
    podcast.delRatingValue = qid('btnRating').controlClass.value;
    podcast.retainEpisodes = qid('chbRetain').controlClass.checked;
    podcast.retainNumber = qid('cbRetain').controlClass.value;
    podcast.overwriteTags = qid('chbTag').controlClass.checked;
    podcast.showRemovedEpisodes = qid('chbRemoved').controlClass.checked;
    if (isVisible(qid('cbDownload2')))
        podcast.downloadType = app.podcasts.downloadTypeFromItemIndex(qid('cbDownload').controlClass.focusedIndex, qid('cbDownload2').controlClass.focusedIndex);
    else
        podcast.downloadType = app.podcasts.downloadTypeFromItemIndex(qid('cbDownload').controlClass.focusedIndex, 0);
}
