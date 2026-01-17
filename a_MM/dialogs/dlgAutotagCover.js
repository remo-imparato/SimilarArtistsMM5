/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

requirejs('templates');
requirejs('helpers/searchTools');

let UI;
let lookupAddr;
let lookupTrack;

function init(params) {
    resizeable = false;

    lookupAddr = params.lookupCover;
    lookupTrack = params.track;

    UI = getAllUIElements();

    templates.imageItem(UI.imgOriginal, {
        imgBind: 'func: templates.itemImageFunc(div, item, div.itemIndex, {useCoverImage: true, updateWhenChanged: true, defaultPixelSize: 500, addContext: true, addShowFullSize: true, imagePath: "' + params.origCover + '"});',
        noThumbIcon: 'unknownAA',
        noViewAction: true,
        useCoverImage: true,
    });

    templates.imageItem(UI.imgLookup, {
        imgBind: 'func: templates.itemImageFunc(div, item, div.itemIndex, {useCoverImage: true, updateWhenChanged: true, defaultPixelSize: 500, addContext: true, addShowFullSize: true, imagePath: "' + lookupAddr + '"});',
        noThumbIcon: 'unknownAA',
        noViewAction: true,
        useCoverImage: true,
    });

    UI.rbOriginal.controlClass.checked = !params.useLookup;
    UI.rbLookup.controlClass.checked = params.useLookup;

    UI.origSizeLbl.innerText = '';
    templates.itemImageFunc(UI.imgOriginal, lookupTrack, 0, {
        useCoverImage: true,
        updateWhenChanged: true,
        defaultPixelSize: 500,
        imagePath: params.origCover,
        addContext: true, 
        addShowFullSize: true,
        onLoad: function () {
            if (isVisible(UI.imgOriginal.artworkImg)) {
                UI.origSizeLbl.innerText = UI.imgOriginal.artworkImg.naturalWidth + 'x' + UI.imgOriginal.artworkImg.naturalHeight;
            }
            
        }
    });

    updateLookupCover();


    window.localListen(UI.btnLookup, 'click', function () {
        //lookupTrack

        let term1 = lookupTrack.albumArtist || lookupTrack.artist;
        let term2 = lookupTrack.album || lookupTrack.title;

        searchTools.searchImageDlg({
            callback: function (imgPath, isInTemp) {
                if (imgPath && !window._cleanUpCalled) {
                    lookupAddr = imgPath;
                    updateLookupCover();
                    UI.rbLookup.controlClass.checked = true;
                }
            },
            searchTerm1: term1,
            searchTerm2: term2,
            noDefaultIcon: true,
            noGenerated: true,
            searchScript: 'helpers\\aaSearch.js'
        });



    });

    window.localListen(UI.btnOK, 'click', function () {
        modalResult = 1;
    });

}

function updateLookupCover() {
    UI.sizeLbl.innerText = '';
    templates.itemImageFunc(UI.imgLookup, lookupTrack, 0, {
        useCoverImage: true,
        updateWhenChanged: true,
        defaultPixelSize: 500,
        addContext: true, 
        addShowFullSize: true,
        imagePath: lookupAddr,
        onLoad: function () {
            if (!window._cleanUpCalled && isVisible(UI.imgLookup.artworkImg)) {
                UI.sizeLbl.innerText = UI.imgLookup.artworkImg.naturalWidth + 'x' + UI.imgLookup.artworkImg.naturalHeight;
            }
            
        }
    });
}

function getCover() {
    return {
        useOriginal: UI.rbOriginal.controlClass.checked,
        lookupCover: lookupAddr
    };
}

window.windowCleanup = function () {
    UI = undefined;
    lookupAddr = undefined;
    lookupTrack = undefined;
}