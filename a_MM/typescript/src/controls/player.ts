'use strict';
registerFileImport('controls/player');


/**
@module UI
*/

import Control from './control';
import './popupmenu';
import '../helpers/autoDJ';
import './waveform';
import '../utils';
import '../dndutils';
import './toastMessage';

let _getPlayerBound = () => {
    return app.player.getCurrentTrack();
};

window.playerContextMenuItems = [{
    action: concatObjects(copyObject(actions.stop), {
        visible: () => {
            let res = true;
            forEach(qes(document.body, '[data-player-control=stop]'), function (el) {
                if (isVisible(el))
                    res = false;

            });
            return res;
        }
    }),
    order: 10,
    grouporder: 10,
},
{
    action: actions.stopAfterCurrent,
    order: 20,
    grouporder: 10,
},
{
    action: actions.sleep,
    order: 30,
    grouporder: 10
},
{
    action: actions.view.visualization,
    order: 30,
    grouporder: 20
},
{
    action: concatObjects(copyObject(actions.choosePlayer), {
        visible: () => {
            let res = true;
            forEach(qes(document.body, '[data-player-control=playTo]'), function (el) {
                if (isVisible(el))
                    res = false;
            });
            return res;
        }
    }),
    order: 10,
    grouporder: 30
},
{
    action: actions.equalizer,
    order: 20,
    grouporder: 30
},
{
    action: actions.speed,
    order: 30,
    grouporder: 30
},
{
    action: actions.normalize,
    order: 50,
    grouporder: 30
},
{
    action: {
        title: function () {
            return _('Layout') + ' (' + _('Player') + ')...';
        },
        icon: 'options',
        execute: function () {
            window.uitools.showOptions('pnl_LayoutPlayer');
        },
        visible: window.uitools.getCanEdit
    },

    order: 20,
    grouporder: 60
}, {
    action: actions.setupPlayer,
    order: 30,
    grouporder: 60
},
];

window.playerTrackContextMenuItems = [
    {
        action: actions.openURLorFile,
        order: 10,
        grouporder: 10
    },
    {
        action: bindAction(actions.sendTo, _getPlayerBound),
        order: 10,
        grouporder: 30
    },
    {
        action: actions.findMoreFromSame,
        order: 20,
        grouporder: 30
    },
    {
        action: actions.trackProperties,
        order: 10,
        grouporder: 50
    },
];


let player = app.player;

let updateCheckedState = function (el, checked) {
    if (checked)
        el.setAttribute('data-checked', 1);
    else
        el.removeAttribute('data-checked');
};

let toggleCheckedState = function (el) {
    if (el.hasAttribute('data-checked'))
        updateCheckedState(el, false);
    else
        updateCheckedState(el, true);
};

let formatTimeValueFromS = function (tmsec) {
    return getFormatedTime(1000 * tmsec);
};

let arrowNavInit = function (el, playerCtrl) {   
    // Skip arrow navigation for controls that are controlled by arrows internally
    let handler = playerControlsHandlers[el.getAttribute('data-player-control')];
    if (handler && handler.controlledByArrows) {
        el.controlClass.tabIndex = 0;
        return; // These elements will only be navigable by tab
    }
    el.controlClass.tabIndex = -1;
    // Collect all player controls for arrow navigation
    if (!playerCtrl._arrowNavControls)
        playerCtrl._arrowNavControls = [];
            
    // Add this control to the navigation list if not already included
    let controlId = el.getAttribute('data-id');
    if (controlId && !playerCtrl._arrowNavControls.includes(controlId)) {
        playerCtrl._arrowNavControls.push(controlId);        
    }
};

let arrowNavigationRefresh = function (playerCtrl) {
    if (!playerCtrl._arrowNavControls)
        return;
    // Find all visible player controls in the player container
    let navigableControls = [];
    
    let playerUI = getAllUIElements(playerCtrl.container);
    // Filter out controls that handle arrows internally
    forEach(playerCtrl._arrowNavControls, function(ctrlID) {
        let ctrl = playerUI[ctrlID] as HTMLElement;
        if (ctrl && isVisible(ctrl)) {
            let rect = ctrl.getBoundingClientRect();
            navigableControls.push({ctrl: ctrl, rect: rect});
        }
    });
    
    // Sort controls by position (top, then left) based on their centers, not top-left corners
    navigableControls.sort(function(a, b) {        
        // Calculate center points
        let centerAY =  a.rect.top +  a.rect.height / 2;
        let centerBY = b.rect.top + b.rect.height / 2;
        let centerAX =  a.rect.left +  a.rect.width / 2;
        let centerBX = b.rect.left + b.rect.width / 2;
        
        // If centers are in different rows
        if (Math.abs(centerAY - centerBY) > 10) {
            return centerAY - centerBY; // Sort by vertical center
        }
        
        // If in same row, sort by horizontal center
        return centerAX - centerBX;
    });
    
    // Store the navigable control IDs
    let navigableControlIDs = navigableControls.map(ctrl => ctrl.ctrl.getAttribute('data-id'));
    
    // Set up arrow navigation using the uitools helper
    uitools.createBoundFocusHandling(playerCtrl, playerCtrl.container, navigableControlIDs);
};

let playPauseMenuInit = function (el, playerCtrl, addSpeedBadge, limitedBadge) {
    arrowNavInit(el, playerCtrl);
    if(addSpeedBadge) {
        requestFrame(() => { // had to be in the next frame, so controls are initialized icon loading will alreayd not clear contents
            let speedBadge = document.createElement('div');
            speedBadge.className = 'badge';
            el.appendChild(speedBadge);

            el.controlClass.updateBadge = function () {
                let res = actions.speed.getValues();
                if(res.enabled && (!limitedBadge || (res.speed!==1)) && (!limitedBadge || !playerCtrl.speedControl || !isVisible(playerCtrl.speedControl))) {
                    speedBadge.innerText = parseFloat(player.speed.toFixed(2)).toString() + 'x';
                    setVisibility(speedBadge, true);
                }
                else {
                    setVisibility(speedBadge, false);
                }
            };
            el.controlClass.localListen(window.settings.observer, 'change', () => {
                el.controlClass.updateBadge();
            });
            el.controlClass.updateBadge();
        });
    }
};

let VISTIMESTEP = 250; // update interval, smaller interval, bigger CPU load

let playerControlGroups = {
    playback: _('Playback'),
    metadata: _('Metadata'),
    controls: _('Controls'),
    seekbar: _('Seek bar'),
};

window.playerControlsHandlers = {
    play: {
        title: actions.play.title,
        init: function (el, playerCtrl) {
            playPauseMenuInit(el, playerCtrl, true, true);
            el.controlClass.localListen(app.player, 'stopaftercurrentchange', function () {
                playerControlsHandlers.play.updateState(el);
            });
            let playTxt = _('Play');
            el.tooltipValueCallback = (tipdiv, vis) => {
                if (!vis) {
                    return;
                }
                if(!app.player.stopAfterCurrentTrack) {
                    tipdiv.innerText = playTxt;
                } else if (app.player.autoResetStopAfterCurrent)
                    tipdiv.innerText = playTxt + ' (' + resolveToValue(actions.stopAfterCurrentFile.hotkeyTitle) + ')';
                else
                    tipdiv.innerText = playTxt +  ' (' + resolveToValue(actions.stopAfterEveryFile.hotkeyTitle) + ')';
            };
        },
        onClick: actions.play.execute,
        onPlaybackState: function (el, playerCtrl, state) {
            switch (state) {
            case 'unpause':
            case 'play':
                setVisibility(el, false);
                break;
            case 'pause':
            case 'stop':
                setVisibility(el, true);
                break;
            case 'trackChanged':
                if(isFunction(el.controlClass.updateBadge))
                    el.controlClass.updateBadge();
                break;                
            }
            playerControlsHandlers.play.updateState(el);
        },
        grouptitle: playerControlGroups.playback,
        updateState: function (el) {
            if (app.player.stopAfterCurrentTrack)
                el.setAttribute('data-state', 1);
            else
                el.removeAttribute('data-state');
        }        
    },

    playTo: {
        title: actions.choosePlayer.title,
        init: function (el, playerCtrl) {
            if (webApp)
                return;
            arrowNavInit(el, playerCtrl);
            el.controlClass.helpContext = 'Setting_UPnP_DLNA_Media_Servers#Streaming.2FCasting_MediaMonkey_Audio_to_a_DLNA_or_Chromecast_Renderer';
            el.controlClass.menuArray = actions.choosePlayer.submenu;
            let _updateCastButtonState = () => {
                let pl = app.sharing.getActivePlayer();
                this.updateState(el, pl && pl.uuid);
            };
            _updateCastButtonState();
            el.controlClass.localListen(el, 'change', _updateCastButtonState);
            let ptitle = _('Play to') + ' ';
            el.tooltipValueCallback = function (tipdiv, vis) {
                if (!vis)
                    return;
                let pl = app.sharing.getActivePlayer();
                let tit;
                if (pl && pl.uuid) {
                    tit = pl.name;
                }
                else {
                    tit = _('Internal player');
                }
                tipdiv.innerText = ptitle + tit;
                setIconAriaLabel(el, ptitle + tit);
            };
        },
        onPlaybackState: function (el, playerCtrl, state) {
            if (webApp)
                return;
            let pl = app.sharing.getActivePlayer();
            switch (state) {
            case 'unpause':
            case 'play':
            {
                if (pl && pl.uuid)
                    setVisibility(el, true); // force display, if playing to external player
                break;
            }
            }
            this.updateState(el, pl && pl.uuid);
        },
        grouptitle: playerControlGroups.controls,
        updateState: function (el, checked) {
            if (checked) {
                el.setAttribute('data-connected', 1);
                if(el.classList.contains('checkable'))
                    el.setAttribute('data-checked', 1);
            }
            else {
                if(el.classList.contains('checkable'))
                    el.removeAttribute('data-checked');
                el.removeAttribute('data-connected');
            }
        }
    },
    
    pause: {
        title: actions.pause.title,
        init: function (el, playerCtrl) {
            playPauseMenuInit(el, playerCtrl, true, true);
            el.controlClass.localListen(app.player, 'stopaftercurrentchange', function () {
                playerControlsHandlers.pause.updateState(el);
            });
            let pauseTxt = _('Pause');
            el.tooltipValueCallback = (tipdiv, vis) => {
                if (!vis) {
                    return;
                }
                if(!app.player.stopAfterCurrentTrack) {
                    tipdiv.innerText = pauseTxt;
                } else if (app.player.autoResetStopAfterCurrent)
                    tipdiv.innerText = pauseTxt + ' (' + resolveToValue(actions.stopAfterCurrentFile.hotkeyTitle) + ')';
                else
                    tipdiv.innerText = pauseTxt +  ' (' + resolveToValue(actions.stopAfterEveryFile.hotkeyTitle) + ')';
            };
        },
        onClick: actions.pause.execute,
        onPlaybackState: function (el, playerCtrl, state) {
            switch (state) {
            case 'unpause':
            case 'play':
                setVisibility(el, true);
                break;
            case 'pause':
            case 'stop':
                setVisibility(el, false);
                break;
            case 'trackChanged':
                if(isFunction(el.controlClass.updateBadge))
                    el.controlClass.updateBadge();
                break;
            }
            playerControlsHandlers.pause.updateState(el);
        },
        grouptitle: playerControlGroups.playback,
        updateState: function (el) {
            if (app.player.stopAfterCurrentTrack)
                el.setAttribute('data-state', 1);
            else
                el.removeAttribute('data-state');
        }
    },

    stop: {
        title: actions.stop.title,
        tooltip: actions.stop.title,
        onClick: actions.stop.execute,
        init: playPauseMenuInit,
        grouptitle: playerControlGroups.playback,
        onPlaybackState: function (el, playerCtrl, state) {
            switch (state) {                
            case 'castingModeOn':
                el.controlClass.disabled = true;
                break;                
            case 'castingModeOff':
                el.controlClass.disabled = false;
                break;                
            }            
        },
    },

    previous: {
        title: actions.previousFile.title,
        tooltip: actions.previousFile.title,
        init: arrowNavInit,
        onClick: actions.previousFile.execute,
        grouptitle: playerControlGroups.playback,
        onPlaybackState: function (el, playerCtrl, state) {
            switch (state) {                
            case 'castingModeOn':
                el.controlClass.disabled = true;
                break;                
            case 'castingModeOff':
                el.controlClass.disabled = false;
                break;                
            }            
        },
    },

    next: {
        title: actions.nextFile.title,
        tooltip: actions.nextFile.title,
        init: arrowNavInit,
        onClick: actions.nextFile.execute,
        grouptitle: playerControlGroups.playback,
        onPlaybackState: function (el, playerCtrl, state) {
            switch (state) {                
            case 'castingModeOn':
                el.controlClass.disabled = true;
                break;                
            case 'castingModeOff':
                el.controlClass.disabled = false;
                break;                
            }            
        },
    },

    shuffle: {
        title: actions.shuffle.title,
        init: function (el, playerCtrl) {
            arrowNavInit(el, playerCtrl);
            updateCheckedState(el, actions.shuffle.checked());
            el.controlClass.localListen(app.player, 'shufflechange', function () {
                updateCheckedState(el, actions.shuffle.checked());
            });
            el.tooltipValueCallback = function (tipdiv, vis) {
                if (!vis)
                    return;
                let tts = app.settings.utils.getTrackTypeSettings();
                let istrArr = [];
                let istr = '';
                tts.forEach(function (tt) {
                    try {
                        let o = JSON.parse(tt);
                        if (o.Player.IgnoreShuffle) {
                            istrArr.push(o.TrackType.Name);
                        }
                    } catch (e) {
                        ODS('Wrong trackType setting: ' + tt);
                    }
                });
                if(istrArr.length > 0) {
                    istr = ' (' + _('Ignore') + ': ' + istrArr.join(', ') + ')';
                }
                let desc = _('Shuffles the \'Playing\' list and makes default play commands shuffle tracks.');
                if (actions.shuffle.checked())
                    tipdiv.innerText = _('Shuffle') + ': ' + _('On') + istr + '\n' + desc;
                else
                    tipdiv.innerText = _('Shuffle') + ': ' + _('Off') + '\n' + desc;
            };
        },
        onClick: function (e) {
            actions.shuffle.execute();
            updateCheckedState(e.currentTarget, actions.shuffle.checked());

            // For screen reader support (aria-label for screen readers to read its state)
            if (actions.shuffle.checked())
                setIconAriaLabel(e.currentTarget, _('Shuffle') + ': ' + _('On'));
            else
                setIconAriaLabel(e.currentTarget, _('Shuffle') + ': ' + _('Off'));
        },
        grouptitle: playerControlGroups.controls
    },
    repeat: {
        title: actions.repeat.title,
        init: function (el, playerCtrl) {
            this.updateState(el);
            arrowNavInit(el, playerCtrl);
            el.tooltipValueCallback = function (tipdiv, vis) {
                if (!vis)
                    return;

                if (actions.repeatOne.checked())
                    tipdiv.innerText = _('Repeat one');
                else
                if (actions.repeatAll.checked())
                    tipdiv.innerText = _('Repeat all');
                else
                    tipdiv.innerText = _('Repeat') + ': ' + _('Off');
            };
            el.controlClass.localListen(app.player, 'repeatchange', function () {
                playerControlsHandlers.repeat.updateState(el);
            });
        },
        onClick: function (e) {
            let el = e.currentTarget;
            if (actions.repeatOne.checked()) {
                actions.repeatAll.execute();
            } else if (actions.repeatAll.checked()) {
                actions.repeatOff.execute();
            } else {
                actions.repeatOne.execute();
            }
            playerControlsHandlers.repeat.updateState(el);
        },
        grouptitle: playerControlGroups.controls,
        updateState: function (el) {
            if (actions.repeatOne.checked())
                el.setAttribute('data-state', 1);
            else
                el.removeAttribute('data-state');
            if (!actions.repeatOff.checked())
                el.setAttribute('data-checked', 1);
            else
                el.removeAttribute('data-checked');

            // Screen reader support
            if (actions.repeatOne.checked() && !actions.repeatOff.checked())
                setIconAriaLabel(el, _('Repeat one'));
            else if (!actions.repeatOff.checked())
                setIconAriaLabel(el, _('Repeat all'));
            else
                setIconAriaLabel(el, _('Repeat'));
        }
    },

    equalizer: {
        title: _('Equalizer'),
        init: function (el, playerCtrl) {
            arrowNavInit(el, playerCtrl);
            let sett = JSON.parse(app.settings.equalizer.getJSON());
            updateCheckedState(el, sett.Equalizer.Enabled);
            el.controlClass.localListen(window.settings.observer, 'change', () => {
                let sett = JSON.parse(app.settings.equalizer.getJSON());
                updateCheckedState(el, sett.Equalizer.Enabled);
                // For screen reader support (aria-label for screen readers to read its state)
                if (sett.Equalizer.Enabled)
                    setIconAriaLabel(el, _('Equalizer') + ': ' + _('On'));
                else
                    setIconAriaLabel(el, _('Equalizer') + ': ' + _('Off'));
            });
            el.tooltipValueCallback = function (tipdiv, vis) {
                if (!vis)
                    return;

                let sett = JSON.parse(app.settings.equalizer.getJSON());
                if (sett.Equalizer.Enabled)
                    tipdiv.innerText = _('Equalizer') + ': ' + _('On');
                else
                    tipdiv.innerText = _('Equalizer') + ': ' + _('Off');
            };
        },
        onClick: function (e) {
            let sett = JSON.parse(app.settings.equalizer.getJSON());
            sett.Equalizer.Enabled = !sett.Equalizer.Enabled;
            app.settings.equalizer.setJSON(JSON.stringify(sett));

            // For screen reader support (aria-label for screen readers to read its state)
            if (sett.Equalizer.Enabled)
                setIconAriaLabel(e.currentTarget, _('Equalizer') + ': ' + _('On'));
            else
                setIconAriaLabel(e.currentTarget, _('Equalizer') + ': ' + _('Off'));
        },
        grouptitle: playerControlGroups.controls
    },
    
    speed: {
        title: actions.speed.title,
        init: function (el, playerCtrl) {
            playPauseMenuInit(el, playerCtrl, true, false);
            updateCheckedState(el, resolveToValue(actions.speed.checked, false));
            el.controlClass.localListen(window.settings.observer, 'change', () => {
                updateCheckedState(el, resolveToValue(actions.speed.checked, false));
            });

            el.tooltipValueCallback = function (tipdiv, vis) {
                if (!vis)
                    return;
                let txt = '';
                let res = actions.speed.getValues();
                let s = res.enabled?res.speed:1;
                let p = res.enabled?res.pitch:0;

                if(s !== 1)
                    txt = _('Speed') + ': ' + parseFloat(s.toFixed(2)).toString() + 'x';
                if(p !== 0) {
                    if(txt !=='' )
                        txt += '\n';
                    txt += _('Pitch') + ': ' + ((p>0)?'+':'') + p + ' (' + _('semitones') + ')';
                }
                if(txt==='')
                    txt = _('Adjust speed');
                tipdiv.innerText = txt;
            };
            playerCtrl.speedControl = el;
        },
        onPlaybackState: function (el, playerCtrl, state) {
            switch (state) {
            case 'trackChanged':
                updateCheckedState(el, resolveToValue(actions.speed.checked, false));
                el.controlClass.forceDisabled = !resolveToValue(actions.speed.visible, false) || resolveToValue(actions.speed.disabled, true);
                if(isFunction(el.controlClass.updateBadge))
                    el.controlClass.updateBadge();
                break;
            }
        },
        onClick: function (e) {
            actions.speed.hotlinkExecute();
        },
        grouptitle: playerControlGroups.controls
    },

    autoDJ: {
        title: actions.autoDJ.title,
        init: function (el, playerCtrl) {
            arrowNavInit(el, playerCtrl);
            updateCheckedState(el, actions.autoDJ.checked());
            el.controlClass.localListen(window.settings.observer, 'change', () => {
                updateCheckedState(el, actions.autoDJ.checked());
                // For screen reader support (aria-label for screen readers to read its state)
                if (actions.autoDJ.checked())
                    setIconAriaLabel(el, _('Auto-DJ') + ': ' + _('On'));
                else
                    setIconAriaLabel(el, _('Auto-DJ') + ': ' + _('Off'));
            });
            el.tooltipValueCallback = function (tipdiv, vis) {
                if (!vis)
                    return;

                if (actions.autoDJ.checked())
                    tipdiv.innerText = _('Auto-DJ') + ': ' + _('On');
                else
                    tipdiv.innerText = _('Auto-DJ') + ': ' + _('Off');
            };
        },
        onClick: function (e) {
            actions.autoDJ.execute();
            // For screen reader support (aria-label for screen readers to read its state)
            if (actions.autoDJ.checked())
                setIconAriaLabel(e.currentTarget, _('Auto-DJ') + ': ' + _('On'));
            else
                setIconAriaLabel(e.currentTarget, _('Auto-DJ') + ': ' + _('Off'));
        },
        grouptitle: playerControlGroups.controls
    },

    time: {
        title: _('Time'),
        tooltip: _('Time'),
        init: function (el, playerCtrl) {
            el.classList.add('no-cpu'); // to speed reflows during time actualization
        },
        onTimeUpdate: function (el, playerCtrl, tmsec) {
            if (playerCtrl.sd) {
                let newVal = getFormatedTime(1000 * Math.round(tmsec), {
                    useEmptyHours: false,
                    useNegativeTime: true
                });
                if (newVal !== this.lastValue) {
                    el.innerText = newVal;
                    this.lastValue = newVal;
                }
            } else
                el.innerText = '';
        },
        grouptitle: playerControlGroups.metadata
    },

    remainingTime: {
        title: _('Remaining time'),
        tooltip: _('Remaining time'),
        init: function (el, playerCtrl) {
            el.classList.add('no-cpu'); // to speed reflows during time actualization
        },
        onTimeUpdate: function (el, playerCtrl, tmsec) {
            if (playerCtrl.sd) {
                let newVal = getFormatedTime(1000 * Math.round(tmsec) - playerCtrl.playLength, {
                    useNegativeTime: true,
                    useEmptyHours: false
                });
                if (newVal !== this.lastValue) {
                    el.innerText = newVal;
                    this.lastValue = newVal;
                }
            } else
                el.innerText = '';
        },
        grouptitle: playerControlGroups.metadata
    },

    seek: {
        title: _('Seek bar'),
        init: function (el, playerCtrl) {
            if (el.controlClass.activateImmediateTooltipHandling) {
                el.controlClass.activateImmediateTooltipHandling(formatTimeValueFromS);
            }

            el.controlClass.localListen(el, 'change', function () {
                playerCtrl.timeToSeek = el.controlClass.value;
                playerCtrl.seekBegin = Date.now();
                player.seekMSAsync(1000 * playerCtrl.timeToSeek + playerCtrl.startTime);
            });
            el.controlClass.localListen(el, 'livechange', function (evt) {
                playerCtrl.isSeeking = true;
                playerCtrl.executeOnTimeUpdates(evt.detail.value, true /* called from seeking action */ );
            });
            el.controlClass.forceDisabled = !playerCtrl.sd;
        },

        setValue: function (el, playerCtrl, sd) {
            el.controlClass.max = sd.playLength / 1000.0;
        },

        onTimeUpdate: function (el, playerCtrl, tmsec) {
            el.controlClass.value = tmsec;
        },

        onPlaybackState: function (el, playerCtrl, state) {
            switch (state) {
            case 'unpause':
            case 'pause':
            case 'play':
                if (el.controlClass) {
                    el.controlClass.disabled = window.settings.UI.disablePlayerControls['seek'];
                    el.controlClass.forceDisabled = el.controlClass.disabled;
                }
                break;
            case 'stop':
            case 'end':
            case 'trackChanged':
                if (el.controlClass) {
                    el.controlClass.disabled = (!playerCtrl.sd || (playerCtrl.sd.playLength <= 0));
                    el.controlClass.forceDisabled = (!playerCtrl.sd || (playerCtrl.sd.playLength <= 0));
                }
                break;
            }
        },
        grouptitle: playerControlGroups.seekbar,
        radiogroup: 'seekBar',
        controlledByArrows: true,
    },

    waveform: {
        title: _('Waveform bar'),
        init: function (el, playerCtrl) {
            if (el.controlClass.activateImmediateTooltipHandling)
                el.controlClass.activateImmediateTooltipHandling(formatTimeValueFromS);

            el.controlClass.localListen(el, 'change', function () {
                playerCtrl.timeToSeek = el.controlClass.value;
                playerCtrl.seekBegin = Date.now();
                player.seekMSAsync(1000 * playerCtrl.timeToSeek + playerCtrl.startTime);
            });
            el.controlClass.localListen(el, 'livechange', function (evt) {
                playerCtrl.isSeeking = true;
                playerCtrl.executeOnTimeUpdates(evt.detail.value, true /* called from seeking action */ );
            });
            el.controlClass.forceDisabled = !playerCtrl.sd;
        },

        onTimeUpdate: function (el, playerCtrl, tmsec, fromSeeking) {
            if (el.controlClass) {
                el.controlClass.toggleAnimate(!fromSeeking);
                el.controlClass.value = tmsec;
            }
        },

        onPlaybackState: function (el, playerCtrl, state) {
            if (el.controlClass)
                el.controlClass.onPlaybackState(state, playerCtrl.sd);
        },

        setValue: function (el, playerCtrl, sd) {
            if(el.controlClass)
                el.controlClass.valueUpdate();
        },

        grouptitle: playerControlGroups.seekbar,
        radiogroup: 'seekBar',
        controlledByArrows: true,
    },

    exit_full_screen: {
        title: _('Exit fullscreen'),
        tooltip: _('Exit fullscreen'),
        init: arrowNavInit,
        onClick: function () {
            if (window.exitFullScreen) {
                window.exitFullScreen(true);
            }
        }
    },

    visualizer: {
        title: _('Visualizer'),
        tooltip: _('Visualizer'),
        grouptitle: playerControlGroups.metadata
    },

    volume: {
        title: _('Volume bar'),
        init: function (el, playerCtrl) {
            el.controlClass.localListen(el, 'change', function () {
                playerCtrl.isVolumeChanging = false;

            });
            let __tipdiv;
            el.controlClass.localListen(el, 'livechange', function (evt) {
                playerCtrl.isVolumeChanging = true;
                player.volume = evt.detail.value / 100.0;
                uitools.toastMessage.show('&nbsp;' + _('Volume') + ': ' + Math.round(evt.detail.value) + ' %&nbsp;', {
                    disableClose: true,
                    delay: 3000
                });
                if (__tipdiv)
                    __tipdiv.innerText = _('Volume') + ': ' + Math.round(100 * player.volume) + ' %';
            });
            el.controlClass.value = 100 * player.volume;
            el.tooltipValueCallback = function (tipdiv, vis) {
                if (!vis)
                    return;

                tipdiv.innerText = _('Volume') + ': ' + Math.round(100 * player.volume) + ' %';
                __tipdiv = tipdiv;
            };
        },
        onPlaybackState: function (el, playerCtrl, state) {
            if (state === 'volumeChanged') {
                if (!playerCtrl.isVolumeChanging) {
                    el.controlClass.value = 100 * player.volume;
                }
            }
        },
        grouptitle: playerControlGroups.controls,
        controlledByArrows: true,
    },

    trackSummary: {
        title: _('Track summary'),
        init: function (el, playerCtrl) {
            el.controlClass.contextMenu = new Menu(window.playerTrackContextMenuItems);
            el.controlClass.canBeUsedAsSource = false;
            el.controlClass.localListen(el, 'contextmenu', function () {
                window.lastFocusedControl = playerCtrl.container;
                window._lastFocusedLVControl = undefined; // so it always take player control for actions like track Properties
            }, true);
        },
        setValue: function (el, playerCtrl, sd) {
            el.innerText = sd.summary; // Summary as defined in Options | Player | Playback Rules
            if (_utils.isCloudTrack(sd)) {                
                let streamInfo = cloudTools.getStreamInfo(sd);
                if (streamInfo) {
                    // LS: e.g. Spotify script fills it to show "[Spotify Preview]" text when playing just preview (#17288)
                    el.innerHTML = sd.summary + '<label class="textOther vSeparatorTiny">' + streamInfo + '</label>';
                    playerCtrl.songLength = sd.songLength;
                }
            }
            el.controlClass.raiseEvent('change', {}, true, false);
        },
        grouptitle: playerControlGroups.metadata
    },

    title: {
        title: _('Title'),
        setValue: function (el, playerCtrl, sd) {
            el.innerText = sd.title;
        },
        grouptitle: playerControlGroups.metadata
    },

    artist: {
        title: _('Artist'),
        setValue: function (el, playerCtrl, sd) {
            templates.hotlinkHandler(el, sd, el, {
                type: 'artist'
            });
            //el.innerText = sd.artist;
        },
        grouptitle: playerControlGroups.metadata
    },

    album: {
        title: _('Album'),
        setValue: function (el, playerCtrl, sd) {
            templates.hotlinkHandler(el, sd, el, {
                type: 'album'
            });
            //el.innerText = sd.album;
        },
        grouptitle: playerControlGroups.metadata
    },

    rating: {
        title: _('Rating'),
        init: function (el, playerCtrl) {
            el.controlClass.tabbable = true;
            el.controlClass.localListen(el, 'change', function () {
                let sd = playerCtrl.sd;
                if (sd) {
                    let origValue = sd.rating;
                    sd.rating = el.controlClass.value;
                    if ((sd.id <= 0) && ((sd.path === '') || isURLPath(sd.path)) && !mediaSyncDevices.isModifiableTrack(sd)) {
                        // online track not present in the library - toast message and add to the library                                        
                        uitools.toastMessage.show(_('Track was added to the Library'), {
                            callback: function (val) {
                                if (val) {
                                    // adding not canceled
                                    sd.commitAsync({
                                        forceSaveToDB: true
                                    });
                                } else {
                                    el.controlClass.value = origValue;
                                    sd.rating = origValue;
                                }
                            }.bind(this)
                        });
                    } else {
                        sd.commitAsync();
                    }
                }
            });
            el.controlClass.forceDisabled = !playerCtrl.sd;
        },
        setValue: function (el, playerCtrl, sd) {
            el.controlClass.disabled = !!window.settings.UI.disablePlayerControls['rating'];
            el.controlClass.forceDisabled = el.controlClass.disabled;
            el.controlClass.value = sd.rating;
        },
        grouptitle: playerControlGroups.metadata,
        controlledByArrows: true,
    },

    nowplaying: {
        title: _('\'Playing\' list'),
        init: function (el, playerCtrl) {
            if (window.isTouchMode)
                return;
            let checked;
            arrowNavInit(el, playerCtrl);
            let useActionName = 'nowPlaying';

            if (!isMainWindow) {
                let mw = app.dialogs.getMainWindow();
                checked = mw.getValue('actions').view[useActionName].checked();
            } else {
                checked = actions.view[useActionName].checked();
                if (playerCtrl) {
                    playerCtrl.localListen(window, 'panelstate', function (e) {
                        if (e.detail.panelID === 'nowplayinglistContainer') {
                            playerControlsHandlers.nowplaying.init(el);
                        }
                    });
                }
            }

            updateCheckedState(el, checked);
        },
        onClick: function (evt) {
            if (!isMainWindow) {
                let mw = app.dialogs.getMainWindow();
                if (mw.getValue('fullWindowModeActive'))
                    return;
                mw.getValue('requirejs')('controls/player');
                mw.getValue('playerControlsHandlers').nowplaying.onClick();
                if (!window.isTouchMode && evt) {
                    toggleCheckedState(evt.currentTarget);
                }
                return;
            }
            if (window.fullWindowModeActive)
                return;
            if (window.isTouchMode) {
                let activeView = navUtils.getActiveView();
                if (activeView && (activeView.viewNode.handlerID == 'npview')) {
                    actions.history.backward.execute();
                    return;
                }
            }
            if (!window.isTouchMode) {
                let useActionName = 'nowPlaying';
                actions.view[useActionName].execute();
                if (evt)
                    updateCheckedState(evt.currentTarget, actions.view[useActionName].checked());
            } else {
                navigationHandlers.nowPlaying.navigate();
            }
        }
    },

    albumArt: {
        title: _('Artwork'),
        init: arrowNavInit,
        setValue: function (el, playerCtrl, sd) {
            let isSame = true;
            if (!el.artworkImg) {
                el.itemIndex = 0;
                el.sd = sd;
                isSame = false;
                let img = qeid(el, 'player-artworkImg');
                el.artworkImg = img;
                img = qeid(el, 'player-noaa');
                el.noaa = img;
                el.controlClass = el.controlClass || new Control(el); // to allow correct cleaning
                el.controlClass.addCleanFunc(function () {
                    el.artworkImg = undefined;
                    el.noaa = undefined;
                    el.sd = undefined;
                });
            } else if (!sd || !sd.isSame(el.sd)) {
                isSame = false;
                el.sd = sd;
            }
            if (!isSame) {
                el.controlClass.imgParams = {
                    defaultPixelSize: 100,
                    canReturnAlbumArtwork: true
                };
                templates.itemImageFunc(el, sd, 0, el.controlClass.imgParams);
            }
        },
        onClick: function (evt) {
            evt.stopPropagation();
            let el = evt.currentTarget;
            let pars : AnyDict = {
                modal: true,
                atTopMost: true,
                notShared: true,
                trackItem: player.getCurrentTrack()
            };
            if (el.controlClass && el.controlClass.imgParams && el.controlClass.imgParams.newArtworkObject) {
                pars.dataObject = el.controlClass.imgParams.newArtworkObject;
            }
            uitools.openDialog('dlgArtworkDetail', pars);
        },
        grouptitle: playerControlGroups.metadata
    }
};

class Player extends Control {
    currTime: number;
    currState: string;
    songLength: number;
    playLength: number;
    startTime: number;
    stopTime: number;
    sd: Track;
    timeStep: number;
    ctrl: AnyDict;
    ctrlsForTimeUpdate: any[];
    ctrlsForValueUpdate: any[];
    isSeeking: boolean;
    isVolumeChanging: boolean;
    timeToSeek: number;
    private _isVisible: boolean;
    private _isHidden: boolean;
    lastTrack: Track;
    private _updatePlayerUI: any;
    private _initUI: () => void;
    seekBegin: number;
    private _onPlaybackState: (state: any) => void;
    ctrlRadioGroups: AnyDict;
    private _lastHint: string;
    private timeUpdatePending: number;
    private lastTime: number;
    private nextTime: number;
    private castingCue: boolean;

    initialize(elem, params) {
        super.initialize(elem, params);
        this.enableDragNDrop();
        let _this = this;
        this.helpContext = 'Player';
        this.currTime = 0;
        this.currState = 'stop';
        this.sd = undefined;
        this.lastTime = 0;
        this.nextTime = 0;
        this.timeStep = VISTIMESTEP;
        this.ctrl = {};
        this.ctrlsForTimeUpdate = [];
        this.ctrlsForValueUpdate = [];
        this.isSeeking = false;
        this.isVolumeChanging = false;
        this.timeToSeek = undefined;
        this.timeUpdatePending = undefined;
        this.castingCue = false;

        this.setTrackTimes(this.sd);

        this._onPlaybackState = function (state) {
            ODS('Player - new state: ' + state);
            if (_this._cleanUpCalled) return;
            
            // Store the currently focused element before state change
            let activeElement = document.activeElement;
            let wasPlayFocused = activeElement && activeElement.getAttribute('data-player-control') === 'play';
            let wasPauseFocused = activeElement && activeElement.getAttribute('data-player-control') === 'pause';
            
            switch (state) {
            case 'unpause':
            case 'play':
                if (!_this.sd) {
                    _this.sd = player.getCurrentTrack();
                    _this.setTrackTimes(_this.sd);
                    _this.updateTrackListener();
                    _this.executeValueUpdates();
                }
                if (_this.currState !== 'play') {
                    _this.currState = 'play';
                }
                if (!_this.timeUpdatePending)
                    _this.timeUpdate();
                break;
            case 'stop':
                _this.currTime = 0;
                _this.currState = state;
                _this.timeToSeek = undefined;
                _this.isSeeking = false;
                _this.executeOnTimeUpdates(0);
                break;
            case 'pause':
                _this.currState = state;
                if (!_this.timeUpdatePending)
                    _this.timeUpdate(true);
                break;
            case 'trackChanged':
                _this.sd = player.getCurrentTrack();
                _this.setTrackTimes(_this.sd);
                _this.updateTrackListener();
                _this.executeValueUpdates();
                if (_this.sd) {
                    _this.executeOnTimeUpdates(_this.currTime);
                }
                if (headerClass) {
                    headerClass.prepareForVideoPlayback(window.showAsVideoPlayer);
                }
                break;
            }

            // call playback state handlers of controls
            for (let key in _this.ctrl) {
                let pctrl = _this.ctrl[key];
                if (pctrl && pctrl.controlClass && playerControlsHandlers[key].onPlaybackState) {
                    playerControlsHandlers[key].onPlaybackState(pctrl, _this, state);
                }
            }
            
            if(state==='trackChanged') // now only in this case disabled state could be changed
                _this.updatePlayerControlsDisabledState();
            else if (state === 'play' || state === 'pause' || state === 'stop' || state === 'unpause') {
                arrowNavigationRefresh(_this);
            }
            // Check if we need to move focus between play/pause buttons
            if (wasPlayFocused && !isVisible(_this.ctrl['play'])) {
                // If play button had focus but is now hidden, move focus to pause if visible
                if (_this.ctrl['pause'] && isVisible(_this.ctrl['pause'])) {
                    _this.ctrl['pause'].focus();
                }
            } else if (wasPauseFocused && !isVisible(_this.ctrl['pause'])) {
                // If pause button had focus but is now hidden, move focus to play if visible
                if (_this.ctrl['play'] && isVisible(_this.ctrl['play'])) {
                    _this.ctrl['play'].focus();
                }
            }
        };

        this.localListen(player, 'playbackState', this._onPlaybackState);

        if (!autoDJ.checkPerformingSet) {
            if (window.isMainWindow) // to not execute Auto-DJ twice when in Mini-player mode (#19471)
                this.localListen(player, 'playbackState', autoDJ.checkPerforming);
            autoDJ.checkPerformingSet = true;
        }

        let ctrlName, ctrlHandler, el;

        // prepare customization submenu
        let custMenuItems = [];

        let ctrls = qes(elem, '[data-optional]');
        let opt;
        forEach(ctrls, function (el, i) {
            opt = tryEval(el.getAttribute('data-optional'));
            if (!opt)
                opt = {};
            let id = el.getAttribute('data-id');
            if (!opt.title) {
                ctrlName = el.getAttribute('data-player-control');
                if (ctrlName) {
                    ctrlHandler = playerControlsHandlers[ctrlName];
                    if (ctrlHandler) {
                        opt.title = resolveToValue(ctrlHandler.title);
                        opt.grouptitle = opt.grouptitle || ctrlHandler.grouptitle;
                        opt.radiogroup = opt.radiogroup || ctrlHandler.radiogroup;
                    }
                }
                if (!opt.title) {
                    opt.title = el.getAttribute('data-tip') || el.getAttribute('data-player-control') || id;
                    if(opt.title)
                        opt.title = _(opt.title);
                }
            }
            if (opt.radiogroup) {
                _this.ctrlRadioGroups = _this.ctrlRadioGroups || {};
                _this.ctrlRadioGroups[opt.radiogroup] = _this.ctrlRadioGroups[opt.radiogroup] || [];
                _this.ctrlRadioGroups[opt.radiogroup].push(id);
            }
            custMenuItems.push({
                action: {
                    title: _(opt.title),
                    checked: function () {
                        return isVisible(_this.qChild(id), false);
                    },
                    checkable: true,
                    radiogroup: opt.radiogroup,
                    execute: function () {
                        if (!this.radiogroup)
                            toggleVisibility(_this.qChild(id));
                        else {
                            let thisEl = _this.qChild(id);
                            let vis = isVisible(el, false);
                            forEach(_this.ctrlRadioGroups[this.radiogroup], function (elID) {
                                if (elID !== id) {
                                    let rEl = _this.qChild(elID);
                                    if (rEl)
                                        setVisibilityFast(rEl, false);
                                }
                            });
                            setVisibilityFast(thisEl, true);
                        }
                        _this.storePlayerState(); // it is our own version, saving using app.setValue
                        if (!isMainWindow) {
                            setComputedSize(true);
                        }
                        notifyLayoutChange(); // use global, as it could affect placing in different parts of the main window, #21469
                    }
                },
                order: opt.order || i + 1,
                grouporder: opt.group || 10,
                grouptitle: opt.grouptitle
            });
        });

        this.dockMenuItems = {
            title: _('Layout') + ' (' + _('Player') + ')',
            icon: 'customize',
            submenu: custMenuItems,
            visible: () => {
                return !window.settings.UI.disableRepositioning;
            }
        };
        this.contextMenu = new Menu(playerContextMenuItems);

        // prepare player controls
        ctrls = qes(elem, '[data-player-control]');
        for (let i = 0; i < ctrls.length; i++) {
            el = ctrls[i];
            ctrlName = el.getAttribute('data-player-control');
            ctrlHandler = playerControlsHandlers[ctrlName];
            if (ctrlHandler) {
                _this.ctrl[ctrlName] = el;
                initializeControl(el); // to be sure, it is initialized
                el.controlClass = el.controlClass || new Control(el);
                if (ctrlHandler.init)
                    ctrlHandler.init(el, _this);
                if (ctrlHandler.onClick) {
                    el.controlClass.localListen(el, 'click', ctrlHandler.onClick);
                    el.controlClass.localListen(el, 'keypress', function (evt) {
                        if (evt.key === 'Enter') {
                            simulateFullClick(evt.currentTarget);
                            evt.stopPropagation();
                        }
                    });
                }
                if (ctrlHandler.onTimeUpdate)
                    _this.ctrlsForTimeUpdate.push(ctrlName);
                if (ctrlHandler.setValue)
                    _this.ctrlsForValueUpdate.push(ctrlName);
                if (!el.hasAttribute('data-tip') && !el.tooltipValueCallback && ctrlHandler.tooltip) {
                    let tooltip = resolveToValue(ctrlHandler.tooltip);
                    if (tooltip) {
                        el.setAttribute('data-tip', tooltip);
                    }
                }
            }
        }


        // PETR: we need to update player with current state
        this._initUI = function () {
            if (!isChildOf(document.body, _this.container))
                return;

            _this._onPlaybackState('trackChanged');
            if (player.isPlaying) {
                if (player.paused) {
                    _this._onPlaybackState('pause');
                } else {
                    _this._onPlaybackState('play');
                }
                if (!_this.timeUpdatePending)
                    _this.timeUpdate();
            } else {
                _this._onPlaybackState('stop');
            }
            _this.executeValueUpdates();
        };
        this.refreshVisibility(true);
        this._initUI();
        this.updatePlayerControlsDisabledState();
        this.registerEventHandler('layoutchange');
        this.registerEventHandler('mousewheel');

        this.localListen(thisWindow, 'visibilitychanged', function (minimized, hidden) {
            if (_this._isHidden !== (minimized || hidden)) {
                _this._isHidden = (minimized || hidden);
                _this.refreshVisibility();
            }
        });

        this.localListen(player, 'layoutModified', function (e) {
            if (e && (e.sender !== this.uniqueID)) {
                this.restoreState();
                if (!isMainWindow) {
                    setComputedSize(true);
                }
            }
            arrowNavigationRefresh(this);
        }.bind(this));

        this.localListen(window.settings.observer, 'change', () => {
            this.updatePlayerControlsDisabledState();
        });

        let playingList = app.player.getSongList();
        if (playingList) {
            this.localListen(playingList, 'change', this.executeValueUpdates.bind(this));
        }
        arrowNavigationRefresh(this);
    }

    setTrackTimes(_sd) {
        if (!_sd) {
            this.songLength = 0;
            this.playLength = 0;
            this.startTime = 0;
            this.stopTime = 0;
            this.castingCue = false;
            return;
        }
        this.songLength = _sd.songLength;
        this.playLength = _sd.playLength;
        this.startTime = _sd.startTime;
        this.stopTime = _sd.stopTime;
        this.castingCue = (app.sharing.getActivePlayer() && _sd.cuePath);
    }

    timeUpdate(forceCall?:boolean, oneTime?:boolean) {
        if ((this.currState === 'play') || forceCall) {
            if(!this.castingCue) {  // CUE is always converted to individual parts when casting, save for different handling
                this.currTime = (player.trackPositionMS - this.startTime) / 1000.0;
            }
            else 
                this.currTime = player.trackPositionMS / 1000.0;
            if (this.timeToSeek !== undefined) {
                // check, if seek is already done
                let diff = this.currTime - this.timeToSeek;
                let tickTime = Date.now() - this.seekBegin;
                if (((diff > -0.5) && (diff < 2)) || (tickTime > 2000) || (this.currState === 'pause')) { // seeking end, we have correct time or it lasts too long
                    this.timeToSeek = undefined;
                    this.isSeeking = false;
                }
            }
            if (this._isVisible && !this._isHidden) {
                this.executeOnTimeUpdates(this.currTime);
            }
            let delay = this.timeStep;
            if ((this.lastTime > 0) && (this.nextTime > 0)) {
                let diff = Date.now() - this.nextTime;
                if (diff > this.timeStep)
                    diff = this.timeStep;
                delay -= diff;
            }
            this.lastTime = Date.now();
            this.nextTime = this.lastTime + delay;            
            if(!oneTime || (this.currState === 'play')) {
                this.timeUpdatePending = this.requestTimeout(() => {
                    this.requestFrameMM(this.timeUpdate.bind(this), 'timeUpdate');
                }, delay, 'timeUpdate', true);
            }
        } else {
            if (this.timeUpdatePending)
                clearTimeout(this.timeUpdatePending);
            this.timeUpdatePending = undefined;
        }
    }

    executeOnTimeUpdates(tmsec: number, fromSeeking?:boolean) {
        if (this.isSeeking && !fromSeeking) { // during seeking action display only current seek time
            return;
        }
        let _this = this;
        forEach(_this.ctrlsForTimeUpdate, function (ctrlName) {
            playerControlsHandlers[ctrlName].onTimeUpdate(_this.ctrl[ctrlName], _this, tmsec, fromSeeking);
        });
        if (!app.utils.isRegistered()) {
            let remotePlayer = app.sharing.getActivePlayer();
            if (remotePlayer && remotePlayer.totalPlaybackTime >= 30 * 60 * 1000 /* 30 min. */ ) {
                remotePlayer.totalPlaybackTime = 0;
                let lang = app.utils.getUsedLanguage();
                let voice_path = app.filesystem.getApplicationPath() + 'Assets' + app.filesystem.getPathSeparator() + 'broadcast_gold_voice_' + lang + '.mp3';
                app.filesystem.fileExistsAsync(voice_path).then((useVoice) => {
                    // Use audio voice message (if exists), see details in #14538 
                    if (useVoice) {
                        let tracks = app.utils.createTracklist();
                        let track = app.utils.createEmptyTrack();
                        track.path = voice_path;
                        tracks.add(track);
                        app.player.addTracksAsync(tracks, {
                            afterCurrent: true
                        });
                    } else {
                        window.uitools.showGoldMessage(_('Audio streaming is limited to 30 minutes in the free version of MediaMonkey. Please consider upgrading to a Gold license.'));
                        remotePlayer.stop();
                    }
                });
            }
        }
    }

    executeValueUpdates() {
        let _this = this;
        let sd = _this.sd;
        let hint = _('MediaMonkey');
        if (sd) {
            forEach(_this.ctrlsForValueUpdate, function (ctrlName) {
                playerControlsHandlers[ctrlName].setValue(_this.ctrl[ctrlName], _this, sd);
            });
            hint = (player.playlistPos + 1) + '. ' + sd.summary;
        } 
        
        if (this._lastHint != hint) {
            app.trayIcon.setHint(hint);
            this._lastHint = hint;
        }            
    }

    updatePlayerUI() {
        this.setTrackTimes(this.sd);
        this.executeValueUpdates();
        this.timeUpdate(true, true);
    }

    updateTrackListener() {
        if ((this.sd !== this.lastTrack) && this.lastTrack && this._updatePlayerUI) {
            app.unlisten(this.lastTrack, 'change', this._updatePlayerUI);
            this._updatePlayerUI = undefined;
            this.lastTrack = undefined;
        }
        if (!this._updatePlayerUI && this.sd) {
            this.lastTrack = this.sd;
            this._updatePlayerUI = app.listen(this.lastTrack, 'change', this.updatePlayerUI.bind(this));
        }
    }

    refreshVisibility(fromInit?:boolean) {
        let wasVisible = this._isVisible && !this._isHidden;
        this._isVisible = this.visible;
        if (this._isVisible && !this._isHidden && !wasVisible) {
            this.timeStep = VISTIMESTEP;
            this.restoreState();
            this._initUI();
            return;
        } else if ((!this._isVisible || this._isHidden) && wasVisible) {
            this.timeStep = 2000;
        }
        if (fromInit)
            this.restoreState();
    }

    handle_layoutchange(e) {
        this.refreshVisibility();
        super.handle_layoutchange(e);
    }

    handle_mousewheel(e) {
        let volCtrl = this.ctrl['volume'];
        if (volCtrl && volCtrl.controlClass && volCtrl.controlClass.mouseWheelHandler) {
            // redirect mouse wheel event to volume control
            volCtrl.controlClass.mouseWheelHandler(e);
        }
    }

    storePlayerState() {
        let state = {};
        let ctrls = qes(this.container, '[data-optional]');
        let opt;
        forEach(ctrls, function (el) {
            let id = el.getAttribute('data-id');
            state[id] = isVisible(el, false);
        });
        app.setValue(window._getLayoutStateKey() + '_playerControlsSettings', state);
        app.player.doOnLayoutModified({
            sender: this.uniqueID
        });
        return;
    }

    restoreState(state?) {
        // in case of player we don't want to restore anything except optional controls, other is restored automatically from app.player and based on currently selected track
        // we need to override this restore method otherwise it would e.g. restore Pause button when app was closed while a file was playing, etc.
        let initState = app.getValue(window._getLayoutStateKey() + '_playerControlsSettings', {});
        if (!initState)
            return;
        let ctrls = qes(this.container, '[data-optional]');
        let opt;
        forEach(ctrls, function (el) {
            let id = el.getAttribute('data-id');
            if (initState[id] !== undefined) {
                setVisibilityFast(el, initState[id]);
            }
        });
    }

    getDropMode(e) : DropMode {
        return 'copy';
    }

    canDrop(e) : boolean {
        return dnd.isAllowedType(e, 'media') || dnd.isAllowedType(e, 'plugin');
    }

    drop(e) {
        dnd.player_handleDrop(e, -1, true, true);
    }

    cleanUp() {
        this.ctrl = {};
        if (this.lastTrack && this._updatePlayerUI) {
            app.unlisten(this.lastTrack, 'change', this._updatePlayerUI);
            this._updatePlayerUI = undefined;
        }
        this.lastTrack = undefined;
        this.sd = undefined;
        super.cleanUp();
    }

    getTracklist() {
        // needed for context menu actions
        let trackList = app.utils.createTracklist(true);
        if (this.sd)
            trackList.add(this.sd);
        return trackList;
    }

    updatePlayerControlsDisabledState() {
        let ctrls = qes(this.container, '[data-player-control]');
        for (let i = 0; i < ctrls.length; i++) {
            let el = ctrls[i];
            let ctrlName = el.getAttribute('data-player-control');
            let ctrlHandler = playerControlsHandlers[ctrlName];
            if (ctrlHandler) {
                if (ctrlName == 'waveform')
                    el.controlClass.disabled = el.controlClass.forceDisabled || window.settings.UI.disablePlayerControls['seek'];
                else
                    el.controlClass.disabled = el.controlClass.forceDisabled || window.settings.UI.disablePlayerControls[ctrlName];
            }
        }
    }

}
registerClass(Player);
