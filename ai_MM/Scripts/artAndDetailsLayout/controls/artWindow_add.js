/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

/* Our layout definition */
window.artDetailsLayouts.sideBySide = {

    title: _('Side by side'),
    order: 30,

    hideArtworkLayer: true, // we will create own artwork image within the properties layer

    lastParams: { // to keep params, where e.g. newArtworkObject can be set during binding when image found in album and not in track
        isAutoSearch: true, // this layout only supports automatic artwork searching
        noAAShowDelay: 100 // to surpress blinking during switching tracks
    },

    setPropertiesLayer: function (artWindow, track, lyrics, newAssignment, newLayout) {

        var div = artWindow.propsLayer;
        let sett = settings.get('System, Options');
        if (div._fieldListeners) {
            // unlisten listeners added in templates.itemImageFunc()
            forEach(div._fieldListeners, function (unlistenFunc) {
                unlistenFunc();
            });
            div._fieldListeners = null;
        }
        let saveLyricsBtn;
        if (newLayout) { 
            setVisibilityFast(div, true);
            cleanElement(div, true);
            let fontSize = artWindow.getFontSize();
            div.innerHTML =
                '<div data-id="layoutDiv" data-control-class="Control" style="font-size: '+fontSize+'">' +
                '  <div class="flex row padding">' +
                '    <div data-id="fImageSquare" class="flex column paddingRight gridItemSquare">' +
                '      <img data-id="fArtwork" class="coverImage" data-bind="func: templates.itemImageFunc(div, params.artworkObject, undefined, params);">' +
                '    </div>' +
                '    <div class="flex fill column" style="min-width: 11em">' +
                '      <label data-id="fTitle" class="textWrap" data-bind="func: templates.propertyHandler(div, item, el, {type: \'title\'});"></label>' +
                '      <div data-id="ratingControl" tabindex="-1" class="inline" data-control-class="Rating" data-init-params="{starMargin: 1, paddingLeft: 0, position: \'left\'}"></div>' +
                '      <label data-id="fArtist" class="textWrap" data-bind="call: trackHyperlinks.artist"></label>' +
                '      <label data-id="fAlbum" class="hSeparatorTiny textWrap" data-bind="call: trackHyperlinks.album"></label>' +
                '      <div data-id="artworkTextRow" class="inline marginTop" data-control-class="Control">' +
                '           <a data-id="artworkSearchLink" class="hotlink" tabindex="-1" data-control-class="Control">' + _('Lookup image') + '</a>' +
                '      </div>' +
                '      <div data-id="lyricsSearchParagraph" class="marginTop" data-bind="func: setVisibilityFast(el, !params.lyrics && !params.autoSearchLyrics);"><a data-id="lyricsSearchLink" tabindex="-1" class="hotlink">' + _('Lookup lyrics') + '</a></div>' +                
                '    </div>' +
                '  </div>' +
                '  <div data-id="saveLyricsBtn" data-icon="save" data-tip="Save lyrics to tag" style="display: none" class="clickable inline icon verticalTextBottom" data-control-class="Control"></div><br>' + 
                '  <div data-id="fLyrics" style="text-align: center" data-bind="func: el.innerText=params.lyrics;"></div>' +
                '</div>';

            initializeControls(div);
            recompileBinding(div, artWindow);
            var layoutDiv = artWindow.qChild('layoutDiv');
            div.artworkImg = layoutDiv.controlClass.qChild('fArtwork');
            artWindow.artwork = div.artworkImg; // this property has to point to artwork element, we do not use default artwork layer, so have to re-set this

            layoutDiv.controlClass.addCleanFunc(function () {
                div.artworkImg = undefined;
            });

            layoutDiv.controlClass.localListen(div.artworkImg, 'click', (evt) => {
                if (this.lastParams.newArtworkObject) { // can be added during templates.itemImageFunc -> uitools.getItemThumb
                    artWindow.artworkObject = this.lastParams.newArtworkObject; // update artworkObejct property, we have image taken from this object, probably album
                    this.lastParams.newArtworkObject = undefined; // already set, clear, so later it will not overwrite image chosen from Images menu
                    this.lastParams.artworkObject = this.lastParams.newArtworkObject;
                }
                artWindow.showArtworkDetail(); // #15042
                evt.stopPropagation();
            });

            let artworkSearchLink = layoutDiv.controlClass.qChild('artworkSearchLink');
            if (artworkSearchLink)
                setVisibilityFast(artworkSearchLink, window.uitools.getCanEdit());

            let lyricsSearchLink = layoutDiv.controlClass.qChild('lyricsSearchLink');
            if (lyricsSearchLink) {
                setVisibilityFast(lyricsSearchLink, window.uitools.getCanEdit());
                let manualSearchLyricsFunc = function (evt) {
                    artWindow.saveLyrics = true; // we want to always save lyrics when clicked manually by user
                    artWindow.startLyricsSearching(true);
                    if (evt)
                        evt.stopPropagation();
                    let lyricsSearchParagraph = layoutDiv.controlClass.qChild('lyricsSearchParagraph');
                    setVisibilityFast(lyricsSearchParagraph, false);
                };
                layoutDiv.controlClass.localListen(lyricsSearchLink, 'click', manualSearchLyricsFunc);
            }
            saveLyricsBtn = layoutDiv.controlClass.qChild('saveLyricsBtn');
            if (saveLyricsBtn) {
                saveLyricsBtn.controlClass.localListen(saveLyricsBtn, 'click', function (evt) {
                    if (artWindow.track && artWindow.foundLyrics) {
                        let track = artWindow.track;
                        track.setLyricsAsync(artWindow.foundLyrics).then(function () {
                            artWindow.foundLyrics = undefined;
                            track.commitAsync();
                        });
                    }
                    evt.stopPropagation();
                });
            }
        } else if(newAssignment) {

        }
        this.lastParams.autoSearchLyrics = sett.Options.SearchMissingLyrics;        
        if(newAssignment) {
            this.lastParams.onChangeVisibility = function (res) {
                let artworkTextRow = artWindow.qChild('artworkTextRow');
                if(artworkTextRow)
                    setVisibilityFast(artworkTextRow, !res);
            };

            artWindow.saveLyrics = sett.Options.SaveMissingLyrics && window.uitools.getCanEdit();
            if (!lyrics && this.lastParams.autoSearchLyrics && track && track.getCanSearchLyrics())
                artWindow.requestTimeout(artWindow.startLyricsSearching.bind(artWindow), 200);
            if(!saveLyricsBtn)
                saveLyricsBtn = artWindow.qChild('saveLyricsBtn');
            if (saveLyricsBtn) {
                setVisibilityFast(saveLyricsBtn, !!artWindow.foundLyrics);
            }
        }                
        div.loadingPromise = undefined;
        var imgSquare = artWindow.qChild('fImageSquare');
        var pixelSize = parseInt(imgSquare.offsetWidth);

        if (artWindow.bindFn) {
            this.lastParams.lyrics = lyrics;
            this.lastParams.defaultPixelSize = pixelSize;
            // prepare properties for itemImageFunc
            this.lastParams.artworkObject = artWindow.artworkObject;
            this.lastParams.newArtworkObject = undefined;
            this.lastParams.canceled = false;
            var track = artWindow.track;
            this.lastParams.saveImageFunc = function (item, picturePath, refreshCbk) {
                uitools.addNewArtwork(picturePath, {
                    track: track,
                    showReplace: true,
                    showApply2Album: true
                }).then(function (res) {
                    if (res && res.done && (track == artWindow.track)) {
                        artWindow.artworkObject = track; // saved to track, so we should read it from track next time
                    }
                }.bind(this));

            };
            this.lastParams.canReturnAlbumArtwork = ((artWindow.artworkObject.objectType === 'track') && (!artWindow.artworkObject.isVideo)); // it can search artwork for whole album, when not found any in the track

            artWindow.bindFn(div, artWindow.track, this.lastParams);
            artWindow.artworkPromise = div.loadingPromise;
        }

        artWindow.lyricsParagraph = artWindow.qChild('fLyrics');
    }
}
