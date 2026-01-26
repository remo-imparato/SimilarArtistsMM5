/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

// initialization --------------------------------------------
optionPanels.pnlShare.load = function (params) {
    qid('chbShare').controlClass.checked = true;         
    qid('chbFirewall').controlClass.checked = !app.utils.getPortableMode();
}

optionPanels.pnlShare.save = function (params) {
    return {
        shareEnabled: qid('chbShare').controlClass.checked,
        addFirewallException: qid('chbFirewall').controlClass.checked
    };
}