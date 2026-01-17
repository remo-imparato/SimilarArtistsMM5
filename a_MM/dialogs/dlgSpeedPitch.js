/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

let historyCount = 3;

function splitCents(a) {
    let az = Math.round(a * 100) / 100;
    let b = Math.floor(az);
    let c = az - b;

    if (c > 0.50) {
        b += 1;
        c = az - b;
    }

    return [b, c*100];
}

function sumPitchValues(a, b) {
    return a + b/100;
}

function init(params) {
    let wnd = this;
    wnd.title = _('Adjust speed');
    wnd.resizeable = false;
    let UI = getAllUIElements();
    
    UI.lPitch.innerText = _('Adjust pitch');
    
    let lastApplyTime = 0;
    let diff;
    let waitingForApply = false;
    let sd = app.player.getCurrentTrack();    
    let currentType = 0; // default for Music
    if(sd)
        currentType = sd.trackType;

    let isOurType = true;

    let allSettings = app.settings.utils.getTrackTypeSettings();
    let typeSettings;
    if ((currentType < 0) || (currentType >= allSettings.count))
        currentType = 0; // unknown type, should not happen, fallback to Music

    allSettings.locked(function () {
        typeSettings = allSettings.getValue(currentType);
        typeSettings = JSON.parse(typeSettings.toString());
    });

    UI.typeInfo.innerText = _('Type') + ': ' + utils.getTypeText(currentType);

    UI.speed.controlClass.value = typeSettings.Player.Speed;
    let sc = splitCents(typeSettings.Player.Pitch);
    UI.pitch.controlClass.value = sc[0];
    UI.pitchCents.controlClass.value = sc[1];
    UI.chbSpeedEnabled.controlClass.checked = typeSettings.Player.SpeedEnabled;

    let originalSpeed = typeSettings.Player.Speed;

    let saveSettings = function () {
        allSettings.modifyAsync(function () {
            allSettings.setValue(currentType, JSON.stringify(typeSettings));
            app.settings.utils.setTrackTypeSettings(allSettings);
        });
    };

    let setValues = function(newspeed, newpitch) {
        typeSettings.Player.Pitch = newpitch;
        typeSettings.Player.Speed = newspeed;
        UI.pitch.controlClass.value = newpitch;
        UI.speed.controlClass.value = newspeed;

        if(isOurType) {
            if(typeSettings.Player.SpeedEnabled) {
                app.player.speed = newspeed;
                app.player.pitchChange = newpitch;
            }
        }
        saveSettings();
    }

    let speedHistory = app.getValue('speedHistory', [0.75, 1.25, 1.50]);

    for(let i=0; i<historyCount;i++) {
        if(speedHistory[i] !== undefined) {
            UI['speedhistory'+(i+1)].innerText = speedHistory[i];
            window.localListen(UI['speedhistory'+(i+1)], 'click', function () {
                setValues(this.value, typeSettings.Player.Pitch);
            }.bind({value: speedHistory[i]}));
        } else
            setVisibilityFast(UI['speedhistory'+(i+1)], false);
    }

    window.localListen(app.player, 'playbackState', (state) => {
        if(state === 'trackChanged') {
            sd = app.player.getCurrentTrack();
            isOurType = sd && (currentType === sd.trackType);
        }
    });

    let applyValuesSpeed = function (evt, fromLive) {
        if (evt && waitingForApply)
            return;
        diff = Date.now() - lastApplyTime;
        if (diff < 500) {
            waitingForApply = true;
            requestTimeout(applyValuesSpeed, 500 - diff);
            return;
        }
        waitingForApply = false;
        lastApplyTime = Date.now();
        typeSettings.Player.Speed = UI.speed.controlClass.value;
        if(isOurType && typeSettings.Player.SpeedEnabled) {
            app.player.speed = typeSettings.Player.Speed;
        }
        if(fromLive !== true)
            saveSettings();
    }.bind(this);
    
    let liveToastFuncSpeed = function (evt) {
        uitools.toastMessage.show('&nbsp;' + evt.detail.value.toFixed(2) + 'x&nbsp;', {
            disableClose: true,
            delay: 3000
        });
        applyValuesSpeed(evt, true);
    };

    window.localListen(UI.speed, 'change', applyValuesSpeed);
    window.localListen(UI.speed, 'livechange', liveToastFuncSpeed);

    let applyValuesPitch = function (evt, fromLive) {
        if(evt && waitingForApply)
            return;
        diff = Date.now() - lastApplyTime;
        if (diff < 250) {
            waitingForApply = true;
            requestTimeout(applyValuesPitch, 250 - diff, 'pitchtimer');
            return;
        }
        waitingForApply = false;
        lastApplyTime = Date.now();
        typeSettings.Player.Pitch = sumPitchValues(UI.pitch.controlClass.value, UI.pitchCents.controlClass.value);
        if(isOurType && typeSettings.Player.SpeedEnabled) {
            app.player.pitchChange = typeSettings.Player.Pitch;
        }
        if(fromLive !== true)
            saveSettings();
    }.bind(this);
    
    let liveToastFuncPitch = function (evt) {
        let val = sumPitchValues(evt.detail.value, UI.pitchCents.controlClass.value);
        uitools.toastMessage.show('&nbsp;' + val + '&nbsp;', {
            disableClose: true,
            delay: 3000
        });
        applyValuesPitch(evt, true);
    };

    let liveToastFuncPitchCents = function (evt) {
        let val = sumPitchValues(UI.pitch.controlClass.value, evt.detail.value);
        uitools.toastMessage.show('&nbsp;' + val + '&nbsp;', {
            disableClose: true,
            delay: 3000
        });
        applyValuesPitch(evt, true);
    };

    window.localListen(UI.pitch, 'change', applyValuesPitch);
    window.localListen(UI.pitchCents, 'change', applyValuesPitch);
    window.localListen(UI.pitch, 'livechange', liveToastFuncPitch);
    window.localListen(UI.pitchCents, 'livechange', liveToastFuncPitchCents);
    window.localListen(UI.btnReset, 'click', function () {
        setValues(1, 0);
    });

    let ChBChanged = function () {
        typeSettings.Player.SpeedEnabled = UI.chbSpeedEnabled.controlClass.checked;
        saveSettings();
        if(isOurType) {
            if(typeSettings.Player.SpeedEnabled) {
                app.player.speed = typeSettings.Player.Speed;
                app.player.pitchChange = typeSettings.Player.Pitch;
            }
            else {
                app.player.speed = 1;
                app.player.pitchChange = 0;
            }
        }
    };

    window.localListen(UI.chbSpeedEnabled, 'click', ChBChanged);
    
    window.localListen(thisWindow, 'closequery', () => {
        // if changed, save speed and pitch to history
        if((originalSpeed !== typeSettings.Player.Speed) && (originalSpeed !== 1)) {
            let idx = speedHistory.indexOf(Number(originalSpeed.toFixed(2)));
            if(idx>-1)
                speedHistory.splice(idx, 1);
            if(speedHistory.length > (historyCount - 1))
                speedHistory = speedHistory.slice(0, (historyCount - 1));
            speedHistory.unshift(Number(originalSpeed.toFixed(2)));
            app.setValue('speedHistory', speedHistory);
        }
    });
}