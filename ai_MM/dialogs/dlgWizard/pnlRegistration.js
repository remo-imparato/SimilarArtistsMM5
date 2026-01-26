/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

function openAppRegistration() {
    uitools.openWeb(app.utils.registerLink());
}

function refreshRegistration() {
    let registered = app.utils.isRegistered();
    setVisibility(qid('pnlUnregistered'), !registered);
    setVisibility(qid('pnlRegistered'), registered);
    
    if (registered) {
        qid('lblRegisteredUser').innerText = app.utils.registeredName();
    }
}


// initialization --------------------------------------------
optionPanels.pnlRegistration.load = function (params) {

    let ChbUsername = qid('ChbUsername');
    ChbUsername.value = app.utils.registeredName();
    let ChbLicenseKey = qid('ChbLicenseKey');

    let info = JSON.parse( app.utils.getGoldStatus());
    if (info.status != 'REGISTERED')   
        ChbLicenseKey.value = app.utils.registeredKey();

    if (requestedFeature) {
        qid('lblFeature').innerHTML = requestedFeature + ' <br/><br/>' + _('Upgrading to MediaMonkey Gold helps support ongoing development of MediaMonkey, and gives you the following features:');
    }

    window.localListen(qid('lblRegLink'), 'click', function () {
        openAppRegistration();
    });
    
    window.localListen(app, 'settingschange', refreshRegistration);
    refreshRegistration();

    // LS: following to resolve #19519: Scan completion dialog can appear blank
    let chbFirewall = qid('chbFirewall');
    if (chbFirewall && chbFirewall.controlClass.checked)
        app.sharing.addFirewallException(true);
}

optionPanels.pnlRegistration.save = function (params) {

}
