/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

optionPanels.pnl_General.subPanels.pnl_Network.load = function (sett) {
    // Proxy
    qid('chbUseProxy').controlClass.checked = sett.Proxy.UseProxy;
    qid('edtProxyServer').controlClass.value = sett.Proxy.Server;
    qid('edtProxyPort').controlClass.value = sett.Proxy.Port;
    qid('edtProxyUsername').controlClass.value = sett.Proxy.Username;
    qid('edtProxyPassword').controlClass.value = sett.Proxy.Password;
    bindDisabled2Checkbox(qid('boxProxy'), qid('chbUseProxy'));   
}

optionPanels.pnl_General.subPanels.pnl_Network.save = function (sett) {
    // Proxy
    sett.Proxy.UseProxy = qid('chbUseProxy').controlClass.checked;
    sett.Proxy.Server = qid('edtProxyServer').controlClass.value;
    sett.Proxy.Port = qid('edtProxyPort').controlClass.value;
    sett.Proxy.Username = qid('edtProxyUsername').controlClass.value;
    sett.Proxy.Password = qid('edtProxyPassword').controlClass.value;    
}
