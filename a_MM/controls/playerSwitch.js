/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

'use strict';
/**
@module UI
*/
import Control from './control';
/**
UI Player Switch element

@class PlayerSwitch
@constructor
@extends Control
*/
class PlayerSwitch extends Control {
    initialize(parentel, params) {
        params = params || {};
        super.initialize(parentel, params);
        parentel.classList.add('toolbutton');
        parentel.classList.add('animate');
        let icon = 'downArrow';
        if (!this.isMicroPlayerSupported())
            icon = 'switchToMiniPlayer';
        loadIcon(icon, (data) => {
            parentel.innerHTML = data;
            if (this.isMicroPlayerSupported())
                setIconAriaLabel(parentel, _('Switch to mini/micro player'));
            else
                setIconAriaLabel(parentel, resolveToValue(actions.switchToMiniPlayer.title));
        });
        if (this.isMicroPlayerSupported())
            parentel.setAttribute('data-tip', _('Switch to mini/micro player'));
        else
            parentel.setAttribute('data-tip', resolveToValue(actions.switchToMiniPlayer.title));
        this.localListen(parentel, 'click', (e) => {
            if (this.isMicroPlayerSupported()) {
                let ar = [actions.switchToMicroPlayer, actions.switchToMiniPlayer];
                let menu = new Menu(ar, {
                    parent: parentel
                });
                let pos = window.getScreenCoordsFromEvent(e);
                menu.show(pos.left, pos.top, true /* #15866 */, true);
            }
            else {
                actions.switchToMiniPlayer.execute();
            }
        });
    }
    isMicroPlayerSupported() {
        if (app.utils.getWindowsVersionMajor() < 11)
            return true;
        else
            return false;
    }
}
registerClass(PlayerSwitch);
