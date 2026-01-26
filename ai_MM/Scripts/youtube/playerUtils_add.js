/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

requirejs('controls/youtubePlayerController');

window.playerUtils.override({
    initialize: function ($super) {
        var mainContentDiv = qe(document.body, '[data-store]');

        // add Youtube controller
        requirejs('controls/youtubePlayerController');
        var ytCtrl = document.createElement('div');
        ytCtrl.setAttribute('data-id', 'ytController');
        ytCtrl.style.display = 'none';
        mainContentDiv.appendChild(ytCtrl);
        ytCtrl.controlClass = new YoutubePlayerController(ytCtrl);

        window.ytPlayer = ytCtrl;

        $super();
    }
});