/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

function init(params) {
    let wnd = this;
    wnd.title = _('Sleep settings');
    wnd.resizeable = false;

    qid('edtTime').controlClass.value = app.sleeper.shutdownAfter;
    qid('chbFadeVolume').controlClass.checked = app.sleeper.fadeVolume;
    qid('edtFadeAfter').controlClass.value = app.sleeper.fadeAfter;
    qid('edtVolumePercent').controlClass.value = app.sleeper.volumePercent;

    let list = newStringList();
    wnd.sShutdown = _('Shutdown computer');
    list.add(sShutdown);
    wnd.sHibernate = _('Hibernate');
    if (app.platform != 'mac')
        list.add(sHibernate);
    wnd.sSleep = _('Sleep');
    list.add(sSleep);
    wnd.sLogOff = _('Log off');
    list.add(sLogOff);
    wnd.sClose = _('Close MediaMonkey');
    list.add(sClose);
    wnd.sNone = _('Nothing');
    list.add(sNone);

    let control = qid('cbAction').controlClass;
    control.dataSource = list;

    if (app.sleeper.action == 'shutdown')
        control.value = sShutdown;
    else
    if (app.sleeper.action == 'hibernate')
        control.value = sHibernate;
    else
    if (app.sleeper.action == 'sleep')
        control.value = sSleep;
    else
    if (app.sleeper.action == 'logoff')
        control.value = sLogOff;
    else
    if (app.sleeper.action == 'close')
        control.value = sClose;
    else
    if (app.sleeper.action == 'none')
        control.value = sNone;

    assert(control.value != '', 'sleep action empty!');

    bindDisabled2Checkbox(qid('boxFadeSettings'), qid('chbFadeVolume'));

    window.localListen(qid('btnSleep'), 'click', btnSleepPressed);
    window.localListen(qid('btnCancel'), 'click', btnCancelSleepPressed);
}

function btnSleepPressed() {
    if (!app.utils.isRegistered()) {
        window.uitools.showGoldMessage(_('Sleep timer can be used only with Gold!'));
        return;
    }

    app.sleeper.shutdownAfter = Number(qid('edtTime').controlClass.value);
    app.sleeper.fadeVolume = qid('chbFadeVolume').controlClass.checked;
    app.sleeper.fadeAfter = Number(qid('edtFadeAfter').controlClass.value);
    app.sleeper.volumePercent = Number(qid('edtVolumePercent').controlClass.value);

    let control = qid('cbAction').controlClass;
    if (control.value == sShutdown)
        app.sleeper.action = 'shutdown';
    else
    if (control.value == sHibernate)
        app.sleeper.action = 'hibernate';
    else
    if (control.value == sSleep)
        app.sleeper.action = 'sleep';
    else
    if (control.value == sLogOff)
        app.sleeper.action = 'logoff';
    else
    if (control.value == sClose)
        app.sleeper.action = 'close';
    else
    if (control.value == sNone)
        app.sleeper.action = 'none';

    app.sleeper.startSleep();

    closeWindow();
}

function btnCancelSleepPressed() {
    app.sleeper.cancelSleep();
    closeWindow();
}

window.windowCleanup = function () {
    window.title = undefined;
    window.sShutdown = undefined;
    window.sHibernate = undefined;
    window.sSleep = undefined;
    window.sLogOff = undefined;
    window.sClose = undefined;
    window.sNone = undefined;
}