'use strict';

registerFileImport('controls/addonListView');

import ListView from './listview';

/**
 * UI element for presentation of installed addons
 */
export default class AddonListView extends ListView {

    initialize(rootelem, params) {
        super.initialize(rootelem, params);
        this.itemCloningAllowed = false;
        this.useFastBinding = false;
        this.isSearchable = true;
    }

    bindData(div, index, item) {
        if (this.bindFn)
            this.bindFn(div, item);
        div.itemIndex = index;
        this.localPromise(item.getIconAsync()).then(function (path) {
            if (div.itemIndex !== index)
                return;
            let ext = path.substr(path.length - 4, 4);
            if (ext == '.svg') {
                setVisibility(div.image, false);
                setVisibility(div.icon, (path != ''));
                if (div.loadedIconPath != path) {
                    loadIconFast(path, function (icon) {
                        if (window._cleanUpCalled)
                            return;
                        div.loadedIconPath = path;
                        setIconFast(div.icon, icon);
                    });
                }
            } else {
                setVisibility(div.icon, false);
                setVisibility(div.image, (path != ''));
                div.image.src = path;
            }
        });

        let hasConfig = (item.configFile != '') || (item.skinOptions != '');
        setVisibility(div.btnConf, hasConfig);
        if (hasConfig) {
            app.unlisten(div.btnConf, 'click');
            app.listen(div.btnConf, 'click', function () {
                if (hasConfig) {
                    uitools.openDialog('dlgAddonConfig', {
                        modal: true,
                        addon: this
                    });
                }
            }.bind(item));
            div.unlisteners = div.unlisteners || [];
            div.unlisteners.push(function () {
                app.unlisten(div.btnConf, 'click');
            });
        }

        let LV = this;
        div.unlisteners = div.unlisteners || [];

        app.unlisten(div.btnDelete, 'click');
        div.btnDelete.controlClass.disabled = item.required; // @ts-ignore
        if (!this.required) {
            app.listen(div.btnDelete, 'click', function () {
                window.localPromise(app.uninstallAddonAsync(this)).then(function (success) {
                    if (success) {
                        LV.dataSource.remove(this);
                        if (item.reloadRequiredUninstall) // e.g. skins and layouts don't need reload (they are loaded when switching to them)
                            window.callReload = true; // other windows are fetching this value (e.g. in uitools.showExtensions)
                        if (item.showRestartPrompt)
                            window.callRestart = true;
                    }
                }.bind(this));
            }.bind(item));
            div.unlisteners.push(function () {
                app.unlisten(div.btnDelete, 'click');
            });
        }

        setVisibility(div.prgIcon, item.installing);
        if (item.installing && !div.loadedIcon) {
            div.loadedIcon = 'progress';
            div.prgIcon.controlClass.reload();
        }
        setVisibility(div.btnUpdate, (item.downloadUrl != '') && !item.installing);
        setVisibility(div.btnDelete, !item.uninstalled);
        if (item.uninstalled)
            div.btnUpdate.setAttribute('data-tip', _('Install'));
        else
            div.btnUpdate.setAttribute('data-tip', _('Install update'));
        app.unlisten(div.btnUpdate, 'click');
        if (item.downloadUrl != '') {
            app.listen(div.btnUpdate, 'click', function () {
                let itm = this;
                itm.installing = true;
                div.prgIcon.controlClass.icon = 'progress';
                div.loadedIcon = 'progress';
                let _updateInfoBeforeInstall = itm.updateInfo;
                itm.updateInfo = '';
                LV.rebind();
                window.localPromise(app.installAddonAsync(itm.downloadUrl, itm)).then(function (addon) {
                    if (addon) {
                        // success
                        itm.version = addon.version;
                        itm.infoJSON = addon.infoJSON;
                        itm.description = addon.description;
                        if (addon.reloadRequiredInstall) // e.g. skins and layouts don't need reload (they are loaded when switching to them)
                            window.callReload = true;
                        if (addon.showRestartPrompt)
                            window.callRestart = true;
                        itm.downloadUrl = '';
                    } else {
                        // failure
                        itm.updateInfo = _updateInfoBeforeInstall;
                    }
                    itm.installing = false;
                    LV.rebind();
                }, function () {
                    itm.installing = false;
                });
            }.bind(item));
            div.unlisteners.push(function () {
                app.unlisten(div.btnUpdate, 'click');
            });
        }

        templates.addEllipsisTooltip(div.lblDesc, div);
    }

    setUpDiv(div) {
        div.classList.add('gridViewSmallHeight');

        div.innerHTML =
            '<div class="flex fill row paddingLeft">' +
            '  <div class="imageItem smallItem flex">' +
            '    <div class="flex dynamic center">' +
            '      <img data-id="image" class="centerStretchImage gridViewSmallMaxHeight bgColorWhite">' +
            '    </div>' +
            '    <div data-id="icon" class="fill iconColor"></div>' +
            '  </div>' +
            '  <div class="flex fill column center paddingLeft paddingRight">' +
            '     <div class="flex row verticalCenter">' +
            '       <label data-bind="func: el.textContent = item.title; el.setAttribute(\'data-tip\', item.path)" class="sectionHeader"></label>' +
            '       <div class="fill"></div>' +
            '       <div data-bind="func: el.textContent = (item.isTrial && (item.remainingTrialDays>=0))?(\'(' + _('Days remaining') + ': \' + item.remainingTrialDays + \')\'):\'\'"></div>' +
            '       <div data-bind="func: el.textContent = item.updateInfo"></div>' +
            '       <label data-id="lblVersion" data-bind="func: el.textContent = item.version; el.setAttribute(\'data-tip\', item.path)"></label>' +
            '       <div data-id="prgIcon" class="inline noPadding" data-tip="' + _('Installing update') + '" data-control-class="Icon"></div>' +
            '       <div data-id="btnUpdate" class="inline noPadding" data-icon="download" data-tip="Install update" data-control-class="ToolButton"></div>' +
            '       <div data-id="btnConf" class="inline noPadding" data-icon="options" data-tip="Configure" data-control-class="ToolButton"></div>' +
            '       <div data-id="btnDelete" class="inline noPadding" data-icon="delete" data-tip="Uninstall" data-control-class="ToolButton"></div>' +
            '     </div>' +
            '     <div class="flex row verticalCenter">' +
            '       <label data-id="lblDesc" data-bind="func: el.textContent = item.description" class="textOther textEllipsis fill"></label>' +
            '       <div>' +
            '         <span data-bind="func: el.textContent = item.author" class="textOther"></span>' +
            '       </div>' +
            '     </div>' +
            '  </div>' +
            '</div>';
        initializeControls(div);

        div.icon = qe(div, '[data-id=icon]');
        div.image = qe(div, '[data-id=image]');
        div.prgIcon = qe(div, '[data-id=prgIcon]');
        div.btnUpdate = qe(div, '[data-id=btnUpdate]');
        div.btnConf = qe(div, '[data-id=btnConf]');
        div.btnDelete = qe(div, '[data-id=btnDelete]');
        div.lblDesc = qe(div, '[data-id=lblDesc]');
        setVisibility(div.image, false);
    }

    handle_keydown(e) {
        let handled = false;
        let item;
        switch (friendlyKeyName(e)) {
        case 'Delete':
            handled = true;
            item = this.dataSource.focusedItem;
            if (item && !item.required) {
                window.localPromise(app.uninstallAddonAsync(item)).then((success) => {
                    if (success) {
                        this.dataSource.remove(item);
                        if (item.reloadRequiredUninstall) // e.g. skins and layouts don't need reload (they are loaded when switching to them)
                            window.callReload = true; // other windows are fetching this value (e.g. in uitools.showExtensions)
                        if (item.showRestartPrompt)
                            window.callRestart = true;
                    }
                });
            }
            break;           
        }
        if (!handled)
            return super.handle_keydown(e);
    }

    cleanUp() {
        ODS('AddonListView: cleanUp ' + this.uniqueID);
        if (this.dataSource)
            this.dataSource.cleanCache();
        super.cleanUp();
    }

}
registerClass(AddonListView);
