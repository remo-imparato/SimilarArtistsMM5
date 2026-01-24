/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */


function hashString(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
        hash = ((hash << 6) - hash) + str.charCodeAt(i);
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
}

window.templates.albumTitleHash = function (el, item) {
    var title = item.title + '  ' + item.albumArtist;
    el.innerText = removeThe(title).slice(0, 2);
    el.setAttribute('data-color', Math.abs(hashString(title)) % 10);
};

window.templates.artistNameHash = function (el, item) {
    var title = item.name;
    el.innerText = removeThe(title).slice(0, 2);
    el.setAttribute('data-color', Math.abs(hashString(item.title)) % 10);
};