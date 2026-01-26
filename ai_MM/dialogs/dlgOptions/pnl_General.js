/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

function selectedIndexInDataSource(el) {
    let res = 0;
    let DS = el.controlClass.dataSource;
    DS.locked(function () {
        for (let i = 0; i < DS.count; i++) {
            if (DS.isSelected(i)) {
                res = i;
            }
        }
    });
    return res;
}

optionPanels.pnl_General.load = function (sett) {
    let langElem = qid('cbLanguage');
    langElem.controlClass.dataSource.whenLoaded().then(() => {
        if (!window._cleanUpCalled) {
            langElem.controlClass.focusedIndex = selectedIndexInDataSource(langElem);
        }
    });
    qid('chbCheckForNewVersion').controlClass.checked = sett.System.CheckForNewVersion;
    qid('chbCheckForNewBetaVersion').controlClass.checked = sett.System.CheckForNewBetaVersion;
    qid('chbCheckForAddonsUpdate').controlClass.checked = sett.System.CheckForAddonsOnUpdate;
    bindDisabled2Checkbox(qid('chbCheckForNewBetaVersion'), qid('chbCheckForNewVersion'));
    bindDisabled2Checkbox(qid('chbCheckForAddonsUpdate'), qid('chbCheckForNewVersion'));
    qid('chbTelemetry').controlClass.checked = sett.System.Telemetry;
    qid('chbShowSplashScreen').controlClass.checked = sett.System.ShowSplashScreen;
    qid('chbStartJustOneInstance').controlClass.checked = sett.System.StartJustOneInstance;
    qid('chbShowTrayIcon').controlClass.checked = sett.Appearance.ShowTrayIcon;
    qid('rbMinimizeTaskBar').controlClass.checked = (!sett.Appearance.MinimizeToTray);
    if (sett.Appearance.MinimizeToTray && !sett.Options.ShowPlsWhenMinimized && !app.utils.getPortableMode())
        qid('rbMinimizeMicro').controlClass.checked = true;
    if (sett.Appearance.MinimizeToTray && (sett.Options.ShowPlsWhenMinimized || app.utils.getPortableMode()))
        qid('rbMinimizeMini').controlClass.checked = true;
    qid('chbCloseToTray').controlClass.checked = sett.Appearance.CloseToTray;    
    qid('edtTempDir').controlClass.value = sett.System.TempDir;
    localListen(qid('btnTempDir'), 'click', function () {
        window.uitools.showSelectFolderDlg(qid('edtTempDir').controlClass.value).then(function (path) {
            if (path != '') {
                qid('edtTempDir').controlClass.value = path;
            }
        });
    });
    addEnterAsClick(window, qid('btnTempDir'));
    setVisibility(qid('rbMinimizeMicro'), !app.utils.getPortableMode());
}

optionPanels.pnl_General.save = function (sett) {
    
    let newLang = sett.Appearance.Language;
    let languageChanged = false;
    
    if (qid('cbLanguage').controlClass.dataSource.isLoaded) {
        newLang = app.utils.language2shortcut(qid('cbLanguage').controlClass.value);
        if (newLang !== '') {
            languageChanged = newLang.toLowerCase() != sett.Appearance.Language.toLowerCase();
            sett.Appearance.Language = newLang;
        }
    }
    sett.System.CheckForNewVersion = qid('chbCheckForNewVersion').controlClass.checked;
    sett.System.CheckForNewBetaVersion = qid('chbCheckForNewBetaVersion').controlClass.checked;
    sett.System.CheckForAddonsOnUpdate = qid('chbCheckForAddonsUpdate').controlClass.checked;
    sett.System.Telemetry = qid('chbTelemetry').controlClass.checked;
    sett.System.ShowSplashScreen = qid('chbShowSplashScreen').controlClass.checked;
    sett.System.StartJustOneInstance = qid('chbStartJustOneInstance').controlClass.checked;
    sett.Appearance.ShowTrayIcon = qid('chbShowTrayIcon').controlClass.checked;
    sett.Appearance.MinimizeToTray = (!qid('rbMinimizeTaskBar').controlClass.checked);
    sett.Options.ShowPlsWhenMinimized = qid('rbMinimizeMini').controlClass.checked;
    sett.Appearance.CloseToTray = qid('chbCloseToTray').controlClass.checked;    
    sett.System.TempDir = qid('edtTempDir').controlClass.value;
    
    if (languageChanged) {
        if (newLang !== 'en')
            window.newLanguage = newLang;
        window.reloadNeeded = true;
    }
}