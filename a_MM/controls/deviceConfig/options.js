/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

DeviceConfig.prototype.tabs.options.panels = {
    pnl_AutoConversion: {
        name: _('Auto-conversion'),
        order: 20
    },
    pnl_FileLocations: {
        name: _('File Locations'),
        order: 30
    },
    pnl_Tagging: {
        name: _('Tagging'),
        order: 40
    },
    pnl_Playlists: {
        name: _('Playlists'),
        order: 50
    },
    pnl_DeviceProfile: {
        name: _('Manage settings'),
        order: 60
    }
}

DeviceConfig.prototype.tabs.options.load = function (reload) {
    var lvPanelList = this.qChild('lvPanelList');

    if (!reload) {
        lvPanelList.controlClass.setContentBox(this.qChild('right-box'));
        lvPanelList.controlClass.disableStateStoring = true;

        var panels = DeviceConfig.prototype.tabs.options.panels;
        this.panels = panels;
        var keys = Object.keys(panels);
        for (var i = 0; i < keys.length; i++) {
            var panel = panels[keys[i]];
            if (panel.order === undefined)
                panel.order = 10 * (i + 1);
        };
        keys.sort(function (i1, i2) {
            var retval = panels[i1].order - panels[i2].order;
            return retval;
        });
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            lvPanelList.controlClass.addPanel({
                name: panels[key].name,
                key: key
            });
        }
    }
    lvPanelList.controlClass.dataSource.notifyLoaded();

    this.panelNeedsReload = this.panelNeedsReload || {};

    var loadPanel = function (panelID) {
        this._reloadingTab = true;
        if (!lvPanelList.controlClass.isPanelLoaded(panelID)) {
            var sheetsPath = 'file:///controls/deviceConfig/options/';
            requirejs(sheetsPath + panelID + '.js');
            var tempDiv = document.createElement('div');
            tempDiv.innerHTML = window.loadFile(sheetsPath + panelID + '.html');
            var pnl = tempDiv.firstElementChild;
            pnl.setAttribute('data-id', panelID);
            this.qChild('right-box').appendChild(pnl);
            initializeControls(pnl);

            this.panels[panelID].load.apply(this, [this.device, false]);
            lvPanelList.controlClass.loadedPanels.push(panelID);
            this._monitorChanges(pnl);
        } else {
            setVisibility(this.qChild(panelID), true);
            if (this.panelNeedsReload[panelID]) {
                this.panels[panelID].load.apply(this, [this.device, true /* reload */ ]);
                this.panelNeedsReload[panelID] = false;
            }
        }
        this._reloadingTab = false;
    }.bind(this);

    var h = mediaSyncHandlers[this.device.handlerID];
    if (h.getVisibleOptionsPanels)
        lvPanelList.controlClass.setVisiblePanels(h.getVisibleOptionsPanels(this.device));
    else
        lvPanelList.controlClass.setVisiblePanels(Object.keys(this.panels)); // all panels otherwise

    this.dataSourceListen(lvPanelList, 'loadpanel', function (e) {
        loadPanel(e.detail.panelID);
    });

    if (reload) {
        // re-load already loaded panels by the new dataSource
        lvPanelList.controlClass.forAllLoadedPanels(function (key) {
            // LS: just mark it to re-load as re-loading invisible panels can result in some unpredicable issues when invisible controls (LVs) are re-loaded
            this.panelNeedsReload[key] = true;
        }.bind(this));
    } else
        lvPanelList.controlClass.setFocusedAndSelectedIndex(0);
};

DeviceConfig.prototype.tabs.options.save = function () {
    this.qChild('lvPanelList').controlClass.forAllLoadedPanels(function (key) {
        if (!this.panelNeedsReload[key])
            this.panels[key].save.apply(this, [this.device]);
    }.bind(this));
};

DeviceConfig.prototype.tabs.options.storeState = function () {
    return {
        selPanelIndex: this.qChild('lvPanelList').controlClass.focusedIndex
    }
};

DeviceConfig.prototype.tabs.options.restoreState = function (state) {
    if (state) {
        this.qChild('lvPanelList').controlClass.setFocusedAndSelectedIndex(state.selPanelIndex);
    }
};
