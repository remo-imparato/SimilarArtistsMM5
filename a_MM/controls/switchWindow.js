/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

registerFileImport('controls/switchWindow');

/**
@module UI
*/

requirejs('controls/Control');

/**
Switch popup window control

@class SwitchWindow
@constructor
@extends Control
*/

window.videoModes = {
    C_WINDOWED: 'windowed',
    C_FULLWINDOW: 'fullwindow',
    C_FULLSCREEN: 'fullscreen',
    FADE_TIME: 500
};

class SwitchWindow extends Control {

    initialize(rootelem, params) {
        super.initialize(rootelem, params);

        this._contentControl = null;
        this._playerControl = null;
        this._currentContentControl = null;
        if (app.utils.system() === 'macos')
            this._availableModes = window.videoModes.C_WINDOWED + ',' + window.videoModes.C_FULLWINDOW;
        else
            this._availableModes = window.videoModes.C_WINDOWED + ',' + window.videoModes.C_FULLWINDOW + ',' + window.videoModes.C_FULLSCREEN;
        this._windowedParent = null;
        this._currentMode = '';
        this._previousMode = window.videoModes.C_WINDOWED;
        this._wasbordered = undefined;
        this._wasFlat = undefined;
        this._hideTimer = null;
        this._stopTimer = null;
        this._active = false;
        this._cursorVisible = true;
        this._contentBounds = {
            pos: {
                left: 0,
                top: 0
            },
            size: {
                width: 0,
                height: 0
            }
        };

        for (var key in params) {
            this[key] = params[key];
        };

        var lastVideoMode = this._availableModes.split(',')[0];
        if (isMainWindow) {
            uitools.globalSettings.lastVideoMode = uitools.globalSettings.lastVideoMode || this._availableModes.split(',')[0];
            lastVideoMode = uitools.globalSettings.lastVideoMode;
        }
        //this.switchToMode(lastVideoMode);

        this.visibilityChanged = function (minimize, hidden) {
            if (minimize || hidden) {
                this.hide(true);
            }
        }.bind(this);

        this.localListen(window, 'layoutchange', this.updateContentBounds.bind(this));
        this.localListen(thisWindow, 'visibilitychanged', this.visibilityChanged);

        this.localListen(window, 'panelstate', function (e) {
            if ((this._currentMode === window.videoModes.C_WINDOWED) && this.windowedParent) {
                var panelEl = qid(e.detail.panelID);
                if (panelEl && (panelEl.contains(this.windowedParent))) {
                    if (e.detail.state) {
                        if (this._stopTimer) {
                            clearTimeout(this._stopTimer);
                            this._stopTimer = undefined;
                        }
                    } else if (!this._stopTimer) {
                        this._stopTimer = this.requestTimeout(this.notifyWParentClosed.bind(this), 500); // wait if opened soon again
                    }
                }
            }
        }.bind(this));

        this._initialized = true;
    }

    updateContentBounds() {
        if (this._SwitchPanel && this._SwitchPanel.isloaded) {
            var size = {
                width: 0,
                height: 0
            };
            var pos = this._currentContentControl.getBoundingClientRect();
            size = {
                width: pos.width,
                height: pos.height
            };
            this._contentBounds = {
                pos: pos,
                size: size
            };
            var func = this._SwitchPanel.getValue('setContentControlSize');
            if (func)
                func(this._contentBounds);
        }
        if (!isVisible(this._currentContentControl)) {
            this.hide(true);
        }
    }

    cleanUp() {
        if (this._contentControl && this._updateContentBounds) {
            app.unlisten(this._contentControl, 'layoutchange', this._updateContentBounds);
            this._updateContentBounds = undefined;
        }
        super.cleanUp();
        this._playerControl = undefined;
        if (this._SwitchPanel && this._SwitchPanel.isloaded) {
            this._SwitchPanel.closeWindow();
        }
    }

    _switchPanelLayoutChange() {
        if (this._SwitchPanel && this._SwitchPanel.isloaded) {
            var fn = this._SwitchPanel.getValue('layoutChange');
            if (fn)
                fn(bounds.windowRect, false);
            fn = this._SwitchPanel.getValue('updateButtons');
            if (fn)
                fn(this._currentMode);
        }
    }

    _createSwitchWindow(makeVisible, callback) {
        if (app.utils.system() === 'macos') {
            if (!this._SwitchPanel) {

                let div = document.createElement('div');
                div.classList.add('innerWindow');
                div.style.width = 70;
                div.style.height = 32;
                div.style.opacity = 80;

                this._SwitchPanel = {
                    element: div,
                    isloaded: true,
                    show: () => {
                        setVisibility(div, true);
                        if (this.timeout)
                            clearTimeout(this.timeout);

                        this.timeout = setTimeout(() => {
                            this.timeout = undefined;
                            this._SwitchPanel.hide();
                        }, window.videoModes.FADE_TIME || 1500);
                    },
                    hide: () => {
                        setVisibility(div, false);
                    },
                    updateButtons: (mode) => {
                        updateButtons(mode); // call updateButtons from the handler
                    },
                    getValue: (func) => {
                        return window[func].bind(this);
                    },
                    closeWindow: () => {

                    }


                };

                let body = getBodyForControls();
                body.appendChild(div);

                if (makeVisible)
                    this._SwitchPanel.show();
                else
                    this._SwitchPanel.hide();

                setContentControlSize(this._contentBounds);
                initButtons(this._availableModes, div, this.switchToMode.bind(this));
                updateButtons(this._currentMode);
                layoutChange(bounds.windowRect);
                this.updateContentBounds();
                if (callback)
                    callback();
            } else {
                if (this._SwitchPanel && callback)
                    callback();
            }
        } else {
            if (!this._SwitchPanel) {
                this._SwitchPanel = uitools.openDialog('empty', {
                    show: makeVisible,
                    type: 'video_switch',
                    width: 70,
                    height: 32,
                    atTop: true,
                    opacity: 80,
                    fadeTime: window.videoModes.FADE_TIME,
                    transparent: true,
                    bordered: false,
                    flat: true,
                });
                this._SwitchPanel.loaded = function () {
                    if (this._SwitchPanel) {
                        app.unlisten(this._SwitchPanel, 'load', this._SwitchPanel.loaded);
                        this._SwitchPanel.setValue('switchToMode', this.switchToMode.bind(this));
                        this._SwitchPanel.getValue('requirejs')('controls/switchWindowHandler');
                        this._SwitchPanel.getValue('setContentControlSize')(this._contentBounds);
                        this._SwitchPanel.getValue('initButtons')(this._availableModes);
                        this._SwitchPanel.getValue('updateButtons')(this._currentMode);
                        this._SwitchPanel.getValue('layoutChange')(bounds.windowRect);
                        this._SwitchPanel.isloaded = true;
                        this.updateContentBounds();
                        if (callback)
                            callback();
                    }
                }.bind(this);
                app.listen(this._SwitchPanel, 'load', this._SwitchPanel.loaded);
                app.listen(this._SwitchPanel, 'closed', function () {
                    app.unlisten(this._SwitchPanel, 'closed');
                    this._SwitchPanel = null;
                }.bind(this));
            } else {
                if (this._SwitchPanel.isloaded && callback)
                    callback();
            }
        }
    }

    _changeVis(list, vis) {
        for (var i = 0; i < list.length; i++) {
            if (!list[i].hasAttribute('data-contentSource'))
                setVisibility(list[i], vis);
        }
    }

    _setParent(childs, parent) {
        if (parent) {
            for (var i = childs.length - 1; i >= 0; i--) {
                var child = childs[i];
                if (child.hasAttribute('data-contentSource')) {
                    if (child.controlClass && child.controlClass.setWindowHandler) {
                        child.controlClass.setWindowHandler(parent);
                    } else {
                        parent.appendChild(child);
                    }
                }
            }
        }
    }

    resume() {
        if (this._currentMode && (this._currentMode !== window.videoModes.C_WINDOWED))
            startFullWindowMode();
    }

    showCursor(show) {

        if (show /*|| !this._active*/) {
            if (!this._cursorVisible) {
                app.utils.showCursor(true);
                document.body.style.cursor = '';
                if (this._hideStyle) {
                    document.body.removeChild(this._hideStyle);
                    this._hideStyle = undefined;
                }
                this._cursorVisible = true;
            }
        } else {
            if (this._cursorVisible) {
                app.utils.showCursor(false);
                document.body.style.cursor = 'none';
                if (!this._hideStyle) {
                    this._hideStyle = document.createElement('style');
                    this._hideStyle.innerText = '* { cursor: none; }';
                    document.body.appendChild(this._hideStyle);
                }
                this._cursorVisible = false;
            }
        }
    }

    restoreWindow() {
        if (this._wasbordered !== undefined)
            setWindowState(this._wasbordered, this._wasFlat);

        if (this._wasMaximized) {
            //ODS('---' + this.uniqueID + ' maximizing window');
            maximize();
        } else
            restore();
        //this._wasMaximized = undefined;
        //ODS('---' + this.uniqueID + ' _wasMaximized=undefined');
        this._wasbordered = undefined;
        this._wasFlat = undefined;
        if (window.headerClass) {
            setVisibility(window.headerClass.container, true);
        }
        this._fullScreenActive = false;
    }

    toPreviousMode() {
        if (this._previousMode) {
            this.switchToMode(this._previousMode);
            return true;
        }
        return false;
    }

    stretchToFullWindow(fullScreen) {
        this._contentControl.className = 'fill';
        this._contentControl.style.position = 'fixed';
        if (fullScreen) {
            if (this._wasbordered === undefined) {
                this._wasbordered = bordered;
                this._wasFlat = flat;
                this._wasMaximized = maximized;
                //ODS('---' + this.uniqueID + ' initialized _wasMaximized=' + this._wasMaximized);
            }

            setWindowState(false, true);
            maximize();
            if (window.headerClass) {
                setVisibility(window.headerClass.container, false);
            }
            this._fullScreenActive = true;
        } else {
            if (headerClass) {
                this._contentControl.classList.add('winborder-fullWindowVideo');
            }
        }
    }

    exitFullScreen() {
        if (this._currentMode !== window.videoModes.C_FULLSCREEN) {
            this.hide(true);
            this.showCursor(true);
            return;
        }
        //ODS('---' + this.uniqueID + ' exitFullScreen');
        this.restoreWindow();
        stopFullWindowMode();
        this.hide(true);
        this.showCursor(true);
    }

    switchToMode(newMode, forced) {
        if ((this._currentMode === newMode) && !forced)
            return;
        ODS('switchWindow: switchToMode ' + this._currentMode + ' to ' + newMode);
        if ((this._contentControl.savedClassName === undefined) && (this._contentControl.savedStylePosition === undefined)) {
            this._contentControl.savedClassName = this._contentControl.className;
            this._contentControl.savedStylePosition = this._contentControl.style.position;
        }
        // restore from current mode
        if (this._currentMode === window.videoModes.C_FULLSCREEN) {
            if (newMode !== window.videoModes.C_FULLSCREEN) {
                //ODS('---' + this.uniqueID + ' newMode=' + newMode);
                this.restoreWindow();
            };
        } else if (this._currentMode === window.videoModes.C_FULLWINDOW) {


        } else if ((this._currentMode === window.videoModes.C_WINDOWED) && (newMode !== window.videoModes.C_WINDOWED)) {
            startFullWindowMode();
        };

        this.raiseEvent('beforechange', {
            newMode: newMode
        });

        // set new mode
        if (newMode === window.videoModes.C_WINDOWED) {
            if (this._windowedParent && this._contentControl) {
                if (this._currentMode !== newMode) {
                    if (this._contentControl.savedClassName !== undefined)
                        this._contentControl.className = this._contentControl.savedClassName;
                    if (this._contentControl.style.position !== undefined)
                        this._contentControl.style.position = this._contentControl.savedStylePosition;
                }
                stopFullWindowMode();
            }
        } else if (newMode === window.videoModes.C_FULLWINDOW) {
            this.stretchToFullWindow(false);
        } else if (newMode === window.videoModes.C_FULLSCREEN) {
            if ((this._currentMode !== window.videoModes.C_FULLSCREEN) || bordered || forced) {
                this.stretchToFullWindow(true);
            } else {
                //ODS('---' + this.uniqueID + ' not stretched, already fullscreen');
            }
        }
        if (this._newMode !== window.videoModes.C_FULLSCREEN) {
            this.showCursor(true);
        }
        if ((this._currentMode !== newMode) && (this._currentMode !== ''))
            this._previousMode = this._currentMode;
        this._currentMode = newMode;
        this.checkWParentVisibility();

        notifyLayoutChange();
        this.hide(true);
        this.requestTimeout(this._switchPanelLayoutChange.bind(this), 100); // refine placing of switch icons after all animations are done

        this.raiseEvent('change', {
            newMode: newMode
        });
    }

    showContent(isVideo) {
        if (this._windowedParent) {
            this._windowedParent.classList.toggle('videoContainer', !!isVideo);
        };
        var callChange = false;
        if (this.contentControl && isChildOf(document.body, this.contentControl)) {
            ODS('switchWindow: showContent');
            callChange = !!setVisibility(this.contentControl, true, {
                layoutchange: false,
                animate: false
            });
            this.checkWParentVisibility();
            if (callChange)
                notifyLayoutChange(); // needed, so e.g. EmbeddedWindow could be updated
        }
        if (callChange) {
            this.raiseEvent('contentvisibilitychanged', {
                visible: true
            });
        }
    }

    hideContent(isVideo) {
        if (this._windowedParent) {
            this._windowedParent.classList.toggle('videoContainer', false);
        };
        var callChange = false;
        if (this.contentControl && isChildOf(document.body, this.contentControl)) {
            ODS('switchWindow: hideContent');
            callChange = !!setVisibility(this.contentControl, false, {
                layoutchange: false,
                animate: false
            });
            if (callChange)
                notifyLayoutChange(); // needed, so e.g. EmbeddedWindow could be updated
        }
        if (callChange) {
            this.raiseEvent('contentvisibilitychanged', {
                visible: false
            });
        }
    }

    show() {
        if (!window.showAsVideoPlayer) {
            if (this._currentMode !== window.videoModes.C_WINDOWED) { // in windowed mode are buttons displayed in art window title bar
                if (this._SwitchPanel) {
                    if (this._SwitchPanel.isloaded) {
                        this._switchPanelLayoutChange();
                        if (!this._SwitchPanel.visible) {
                            this._SwitchPanel.show();
                        }
                    }
                } else {
                    this._createSwitchWindow(true);
                }
            }
            if (this._currentMode === window.videoModes.C_FULLSCREEN) {
                this.showCursor(true);
            }
        }
    }

    hide(noAnimate) {
        if (this._SwitchPanel && this._SwitchPanel.isloaded && this._SwitchPanel.visible) {
            if (noAnimate) {
                this._SwitchPanel.fadeTime = 0;
                this.cancelAutoHide();
            }
            this._SwitchPanel.hide();
            if (noAnimate)
                this._SwitchPanel.fadeTime = window.videoModes.FADE_TIME;
        }
        if (!noAnimate && this._fullScreenActive) {
            if (!window.isMenuVisible())
                this.showCursor(false);
        }
        if (this._playerControl) {
            setVisibility(this._playerControl, false);
        }
    }

    cancelAutoHide() {
        if (this._hideTimer) {
            clearTimeout(this._hideTimer);
            this._hideTimer = undefined;
        }
    }

    autoHide() {
        var autoHideStart = function () {
            this.cancelAutoHide();
            this._hideTimer = this.requestTimeout(function () {
                this.hide();
                this._hideTimer = null;
                this.raiseEvent('autohide', {});
            }.bind(this), 2000);
        }.bind(this);

        var hideEvent = function () {
            this.show();
            if (this._playerControl && (this._currentMode !== window.videoModes.C_WINDOWED)) {
                setVisibility(this._playerControl, true);
                if (this._playerControl.controlClass && this._playerControl.controlClass.updatePlayerUI)
                    this._playerControl.controlClass.updatePlayerUI();
            }
            autoHideStart();
        }.bind(this);

        hideEvent();
    }

    checkWParentVisibility() {
        if (this.windowedParent) {
            var docking = uitools.getDocking();
            var layout = docking.getCurrentLayout();
            if (layout) {
                var panel = docking.getParentPanel(this.windowedParent);
                if (!panel)
                    return;
                var panelid = panel.getAttribute('data-id');
                var dock = layout.getPanelDock(panelid);
                if (!dock)
                    return;
                var dockel = qid(dock.id);

                panel._forcedVisible = true;
                ODS('switchWindow: checkWParentVisibility - force');
                docking.handleDockVisibility(dockel, true);
            }
        }
    }

    restoreWParentVisibility() {
        // relevant only for windowed parent
        if (this.windowedParent) {
            var docking = uitools.getDocking();

            var panel = docking.getParentPanel(this.windowedParent);
            if (!panel)
                return;
            if (panel._forcedVisible) {
                panel._forcedVisible = undefined;
                ODS('switchWindow: restoreWParentVisibility');
                docking.refreshCurrentLayout();
            }
        }
    }

    notifyWParentClosed() {
        // artWindow closed - for audio deactivate visualization, for video and YT video stop video playback        
        var player = app.player;
        if (player.isPlaying) {
            var sd = player.getFastCurrentTrack(sd);
            if (sd) {
                if (_utils.isOnlineTrack(sd)/* || sd.isVideo*/) { // do not stop local video after closing panel, #19924
                    player.pauseAsync();
                } else {
                    if (player.visualization.active)
                        player.visualization.active = false;
                }
            }
        }
    }

    get contentControl() {
        if (window._cleanUpCalled)
            this._contentControl = undefined;
        return this._contentControl;
    }
    set contentControl(value) {
        var ctrl = value;
        if (typeof ctrl === 'string')
            ctrl = qid(value);
        if ( /*this._contentControl != ctrl &&*/ ctrl) {
            if (this._contentControl && this._updateContentBounds) {
                app.unlisten(this._contentControl, 'layoutchange', this._updateContentBounds);
                this._updateContentBounds = undefined;
            }
            this._contentControl = ctrl;
            if (this._contentControl)
                this._updateContentBounds = app.listen(this._contentControl, 'layoutchange', this.updateContentBounds.bind(this));
            if (this._contentControl && this._initialized) {
                for (var i = 0; i < this._contentControl.children.length; i++) {
                    this._contentControl.children[i].setAttribute('data-contentSource', '1');
                };
                this._currentContentControl = this._contentControl;
                this.raiseEvent('contentvisibilitychanged', {
                    visible: isVisible(this._contentControl, false)
                });
            }
            if (this._initialized)
                this.updateContentBounds();
        }
    }

    get playerControl() {
        return this._playerControl;
    }
    set playerControl(value) {
        var ctrl = value;
        if (typeof ctrl === 'string')
            ctrl = qid(value);
        if (this._playerControl != ctrl && ctrl) {
            this._playerControl = ctrl;

        }
    }

    get availableModes() {
        return this._availableModes;
    }
    set availableModes(value) {
        if (this._availableModes != value && value) {
            this._availableModes = value;
            if (this._initialized)
                this._switchToMode(this._availableModes.split(',')[0]);
        }
    }

    get windowedParent() {
        return this._windowedParent;
    }
    set windowedParent(value) {
        var wasWindowed = this._windowedParent !== null;
        var canBeWindowed = false;

        var ctrl = value;
        if (typeof ctrl === 'string')
            ctrl = qid(value);
        this._windowedParent = ctrl;

        if (this._windowedParent) {
            canBeWindowed = true;
            if (this._availableModes.split(',').indexOf(window.videoModes.C_WINDOWED) < 0) {
                this._availableModes = this._availableModes + ',' + window.videoModes.C_WINDOWED;
            }
        } else {
            if (app.utils.system() === 'macos')
                this._availableModes = window.videoModes.C_FULLWINDOW;
            else
                this._availableModes = window.videoModes.C_FULLWINDOW + ',' + window.videoModes.C_FULLSCREEN;
        }
        if (wasWindowed != canBeWindowed) {
            if (this._SwitchPanel && this._SwitchPanel.isLoaded) {
                this._SwitchPanel.getValue('initButtons')(this._availableModes, this._SwitchPanel.element, this.switchToMode.bind(this));
            }
        }
    }

    get currentMode() {
        return this._currentMode;
    }

    get previousMode() {
        return this._previousMode;
    }

    get active() {
        return this._active;
    }
    set active(val) {
        this._active = val;
        this.showCursor(true);
        if (!val) {
            this.hide(true);
            this.restoreWParentVisibility();
        }
    }

}
registerClass(SwitchWindow);
