/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

function init(params) {

    if (params.url) {
        requirejs('file:///controls/embeddedWindow');
        let div = document.createElement('div');
        div.setAttribute('data-control-class', 'EmbeddedWindow');
        div.classList.add('fill');
        if (headerClass) {
            div.classList.add('windowHeaderOffset');
        }
        
        let body = getBodyForControls();
        body.appendChild(div);
        initializeControls(body);
        
        div.controlClass.url = params.url;
    }
};