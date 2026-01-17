/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

/**
@module UI Snippets
*/

/**
Dockable dialog class.

@class DockableDialog
@constructor
@extends Control
*/

var loadedDialogs = [];

class DockableDialog extends Control {

    initialize(rootelem, params) {
        params = params || {};
        if (params.closable === undefined)
            params.closable = true;
        super.initialize(rootelem, params);
        var _this = this;
        var closeDlg = {
            execute: function () {
                _this.closeDialog();
            },
            title: _('Close'),
        };

        if (params.closable)
            this.setCloseButtonAction(closeDlg);

        this.content = document.createElement('div');
        this.container.appendChild(this.content);
    }

    _useParams() {
        var opacity = resolveToValue(this.pars.opacity, 100);
        if (opacity !== 100) {
            this.container.classList.add('fill');
            this.container.classList.add('dimmedBackground');
        }
        this.disabled = resolveToValue(this.pars.disabled, false);
        if (this.disabled) {
            this.content.classList.add('fill');
            this.content.classList.add('dockedDialog');
        }
    }

    cleanUp() {
        window[this.dialogName]._isDockedDialog = undefined;
        this.unregisterTrackChange();
        super.cleanUp();
    }

    enumSize() {
        var style = getComputedStyle(this.content.parentElement, null);
        var w = Math.round(parseFloat(style.getPropertyValue('width')));
        var h = Math.round(parseFloat(style.getPropertyValue('height')));
        this.container.parentElement.style.minWidth = w;
        this.container.parentElement.style.minHeight = h;
        notifyLayoutChange();
    }

    unregisterTrackChange() {
        if (!this._onTrackFocus) {
            app.unlisten(document.body, 'itemfocuschange', this._onTrackFocus, true);
            this._onTrackFocus = undefined;
        }
    }

    registerTrackChange() {
        this._onTrackFocus = app.listen(document.body, 'itemfocuschange', this.onTrackFocus.bind(this), true);
    }

    _onNewFocusedLink(link) {
        var _this = this;
        this.requestIdle(function () {
            var list = uitools.getSelectedTracklist();
            if (list) {
                list.whenLoaded().then(function (l) {
                    window[_this.dialogName].reloadWindow.call(window, l);
                });
            }
        }, '_onTrackFocus');
    }

    onTrackFocus(e) {
        this._onNewFocusedLink(e.detail.link);
    }

    sendDockableDialogEvent(showing) {
        let event = createNewCustomEvent('dockableDialog', {
            detail: {
                bubbles: false,
                cancelable: true,
                dialogName: this.dialogName,
                showing: showing,
                modal: this.pars.modal,
                disabled: this.pars.disabled
            }
        });
        window.dispatchEvent(event);
    }

    closeDialog() {
        var _this = this;
        this.destroying = true;
        window[this.dialogName].cleanUpWindow.call(window, this.pars).then(function () {
            _this.loaded = undefined;
            _this.content.innerHTML = '';
            _this.destroying = false;

            _this.enumSize();
            _this.container.parentElement.removeChild(_this.container);
            /*loadedDialogs[_this.dialogName] = undefined;*/
            _this.cleanUp();
        });
        this.newWindow.hide();
    }

    openDialog(dialogName, pars) {
        var _this = this;
        this.pars = pars;
        this.dialogName = dialogName;
        this._useParams();

        setVisibility(this.container, false, {
            animate: !!this.loaded
        });

        if (this.loaded) {
            closeDialog();
            return undefined;
        } else if (!this.destroying) {

            this.loaded = true;

            this.oldWindow = window;
            this.newWindow = { // return this object
                show: function () {
                    setVisibility(_this.container, true);
                    /*if (headerClass && resolveToValue(pars.modal, false))
                        headerClass.disabled = true;*/
                },
                hide: function () {
                    setVisibility(_this.container, false);
                    /*if (headerClass && resolveToValue(pars.modal, false))
                        headerClass.disabled = false;*/
                },
                closeWindow: function () {
                    _this.sendDockableDialogEvent(false);
                    _this.closeDialog();
                },
            };

            this.content.innerHTML = loadFile('file:///dialogs/' + dialogName + '.html');
            // remove all <scripts> elements
            var scripts = this.content.getElementsByTagName('script');
            for (var i = scripts.length - 1; i >= 0; i--) {
                scripts[i].remove();
            }
            // do initialize all controls
            initializeControls(this.content);
            if (!loadedDialogs[dialogName]) {
                // if not already loaded scripts, load them
                var fn = 'file:///dialogs/' + dialogName + '.js';
                var content = loadFile(fn);
                var devToolsSource = String.fromCharCode(13) + String.fromCharCode(10) + ' //# sourceURL=' + fn;
                // process script (as isolated so it will not overwrite our global methods)
                // it will create window[dialogName] object with default functions to call init and cleanup (when closing)
                window.eval('(function(){' + content + ' window.' + dialogName + ' = { initWindow: function(params) { try { var ok = isFunction(init); }catch(err){} if (ok) { init.call(this, params); }}, ' +
                    ' reloadWindow: function (tracks) { try { var ok = isFunction(reloadDialog); }catch(err){} if (ok) { reloadDialog.call(this, tracks); }}, ' +
                    ' cleanUpWindow: function () { try { var ok = isFunction(cleanUp); }catch(err){} if (ok) { return cleanUp.call(this); } else { return new Promise(function(resolve) { resolve(); }); }}, ' +

                    '}; ' +
                    'function inPlaceDialog() { return window.' + dialogName + '._newWindow; }; ' +

                    '})();' + devToolsSource);
                loadedDialogs[dialogName] = true;
            }
            // call init method of the dialog
            window[dialogName].initWindow.call(window, pars);
            window[dialogName]._newWindow = this.newWindow;
            window[dialogName]._isDockedDialog = true;

            this.enumSize();

            this.newWindow.show();
            this.registerTrackChange();

            this.sendDockableDialogEvent(true);

            return this.newWindow;
        }


    }

}
registerClass(DockableDialog);
