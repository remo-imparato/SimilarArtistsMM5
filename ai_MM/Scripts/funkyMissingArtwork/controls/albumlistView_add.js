/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

AlbumListView.prototype.override( {
    setUpDiv: function ($super, div) {
        this.noThumbIcon = undefined;
        $super(div);
        var unk = div.noaa;
        if (unk) {
            unk.removeAttribute('data-icon');
            unk.className = 'fill noArtText';
            unk.setAttribute('data-bind', 'func: templates.albumTitleHash(el, item);');
        }
    }
});