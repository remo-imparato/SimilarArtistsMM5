/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

let isCachedLyrics = false;
let lyricsModified = false;

propertiesTabs.tabLyrics.load = function (track, dialog) {
    let mainElement = qid('tabLyricsContent');
    let lyricsEl = qeid(mainElement, 'lyrics');
    let saveLyricsBtn = qeid(mainElement, 'saveLyricsBtn');
    setVisibility(saveLyricsBtn, false);
    let sett = window.settings.get('System, Options');
    let autoSearchLyrics = sett.Options.SearchMissingLyrics;
    lyricsModified = false;

    dialog.localPromise(track.getLyricsAsync()).then(function (txt) {
        lyricsEl.value = txt;
        if (!txt && autoSearchLyrics && !dialog.isGroup && track.getCanSearchLyrics()) {
            let lval;
            if (!isMainWindow) {
                let mw = app.dialogs.getMainWindow();
                lval = mw.getValue('searchTools').getCachedLyrics(track);
            } else
                lval = searchTools.getCachedLyrics(track);
            if (lval && lval.lyrics) {
                lyricsEl.value = lval.lyrics;
                isCachedLyrics = true;
                setVisibility(saveLyricsBtn, true);
                saveLyricsBtn.controlClass.disabled = window.isReadOnly;
                if (!window.isReadOnly) {
                    dialog.trackLocalListen(saveLyricsBtn, 'click', function () {
                        isCachedLyrics = false;
                        dialog.modified = true;
                        dialog.tagModified = true;
                        setVisibility(saveLyricsBtn, false);
                    });
                    dialog.trackLocalListen(lyricsEl, 'change', function () {
                        isCachedLyrics = false;
                        lyricsModified = true;
                        setVisibility(saveLyricsBtn, false);
                    });
                };
            }
        }
    });
    setVisibility(qeid(mainElement, 'chb_lyrics'), dialog.isGroup && !dialog.isReadOnly);

    let btnSearchLyrics = qeid(mainElement, 'btnSearchLyrics');
    if (!window.isReadOnly && !dialog.isGroup) {
        setVisibility(btnSearchLyrics, true);
        dialog.trackLocalListen(btnSearchLyrics, 'click', function () {
            dialog._searchingLyrics = true;
            uitools.toastMessage.show(_('Searching for missing lyrics') + '...');
            isCachedLyrics = false;
            setVisibility(saveLyricsBtn, false);
            let progress = function (txt) {
                uitools.toastMessage.show(_('Searching for missing lyrics') + '... ' + txt);
            };
            dialog.localPromise(window.searchTools.searchLyrics(track, false /* don't save */, true /* overwrite*/, progress)).then(function (lyrics) {
                if(lyrics) {
                    lyricsEl.value = lyrics;
                    dialog.modified = true;
                    dialog.tagModified = true;
                    uitools.toastMessage.hide();
                } else {
                    uitools.toastMessage.show(_('Lyrics not found'));
                }
                dialog._searchingLyrics = false;
            }, function () {
                dialog._searchingLyrics = false;
                uitools.toastMessage.show(_('Lyrics not found'));
            });
        });
    } else {
        setVisibility(btnSearchLyrics, false);
    }
}


propertiesTabs.tabLyrics.saveAsync = function (track, dialog) {
    let mainElement = qid('tabLyricsContent');
    let retPromise = undefined;
    if (isCachedLyrics || dialog._searchingLyrics)
        return dummyPromise();
    let newValue = qeid(mainElement, 'lyrics').value;
    if (!dialog.isGroup) {
        retPromise = track.setLyricsAsync(newValue, (lyricsModified && !newValue)); // force setting empty lyrics, so no search flag can be set, #18645
    } else {
        if (qid('chb_lyrics').controlClass.checked) {
            track.dirtyModified = true;
            retPromise = track.setLyricsAsync(newValue);
        } else {
            retPromise = dummyPromise();
        }
    }
    return retPromise;
}
