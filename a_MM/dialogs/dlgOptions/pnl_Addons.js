/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

optionPanels.pnl_Addons.load = function (sett) {

    window.localListen(qid('btnOpenAddonsMenu'), 'click', () => {
        window.uitools.showExtensions();
    });

    window.localListen(qid('btnOpenAddonsConfig'), 'click', () => {
        window.uitools.showExtensions({
            filter: 'configurable'
        });
    });

    window.localListen(qid('btnMoreAddons'), 'click', function () {
        window.uitools.openWeb('https://www.mediamonkey.com/re/addons-mm5');
    });
}


optionPanels.pnl_Addons.save = function (sett) {

}
