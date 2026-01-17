/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

requirejs('actions');

function init(params) {
    let wnd = this;
    wnd.resizeable = false;
    title = _('Register MediaMonkey Gold');

    let ChbUsername = qid('ChbUsername');
    ChbUsername.value = app.utils.registeredName();
    let ChbLicenseKey = qid('ChbLicenseKey');
    let info = JSON.parse( app.utils.getGoldStatus());
    if (info.status != 'REGISTERED')   
        ChbLicenseKey.value = app.utils.registeredKey();

    let btnOK = qid('btnOK');

    ChbUsername.focus();

    window.localListen(qid('lblRegLink'), 'click', function () {
        openAppRegistration();
    });

    window.localListen(btnOK, 'click', function () {

        if (ChbUsername && ChbLicenseKey) {
            let username = ChbUsername.value;
            let key = ChbLicenseKey.value;
          
            window.localPromise(app.utils.registerApp(username, key)).then(function (status) {

                if (username == '' && key == '') {
                    // the registration info has been just deleted / unregistered (#19561)
                    closeWizard();
                    return;
                }
                
                // messaging is part of app.utils.registerApp() atm
                if (status[0] == 1) {
                    closeWizard(); // in case of success just close the wizard, otherwise user may want to correct the license/key
                }                   
            });         
        } else
            closeWizard();
    });


}

let closeWizard = function () {
    modalResult = 1;
};


function openAppRegistration() {
    uitools.openWeb(app.utils.registerLink());
}
