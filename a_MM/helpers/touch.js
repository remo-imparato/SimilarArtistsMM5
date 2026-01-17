/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";


(function () {

    var longTimer = null;

    var longTouchDOM;
    var longTouchIndicatorHTML = '<svg width="100%" height="100%" viewBox="0 0 311.812 311.812"><circle id="progress" data-id="touchprogress" class="" fill="none" stroke="#000000" stroke-width="10" stroke-linecap="round" stroke-miterlimit="10" stroke-dasharray="0,1000" cx="155.906" cy="155.906" r="141.027"/></svg>';

    var cleanUp = () => {
        if (longTimer) {
            clearTimeout(longTimer);
            longTimer = null;
        }
        if (longTouchDOM) {
            longTouchDOM.remove();
            longTouchDOM = null;
        }
    }


    window.touch = {
        longTouchStart: function (position) {
            cleanUp();

            longTouchDOM = document.createElement('span');
            longTouchDOM.classList.add('longTouch');
            longTouchDOM.innerHTML = longTouchIndicatorHTML;
            document.body.appendChild(longTouchDOM);
            
            var width = getFullWidth(longTouchDOM);
            var height = getFullHeight(longTouchDOM);
            
            longTouchDOM.style.left = position.x - (width / 2);
            longTouchDOM.style.top = position.y - (height / 2);
            

            var elem = qeid(longTouchDOM, 'touchprogress');
            if (elem) {
                elem.classList.add('active');
            }

            longTimer = window.requestTimeout(() => {

                if (elem) {
                    elem.classList.add('launch');
                }

            }, 500);
        },

        touchEnd: function () {
            cleanUp();
        }
    };






})();
