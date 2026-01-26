/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

'use strict';
/**
@module UI
*/
import Control from './control';
/**
Media server configuration element

@class ServerConfig
@constructor
@extends Control
*/
class ServerConfig extends Control {
    initialize(elem, params) {
        super.initialize(elem, params);
        this.container.innerHTML = loadFile('file:///controls/serverConfig.html');
        initializeControls(this.container);
        let serverTabs = this.tabs;
        let keys = Object.keys(serverTabs);
        for (let i = 0; i < keys.length; i++) {
            let tab = serverTabs[keys[i]];
            if (tab.order === undefined)
                tab.order = 10 * (i + 1);
        }
        keys.sort(function (i1, i2) {
            let retval = serverTabs[i1].order - serverTabs[i2].order;
            return retval;
        });
        this.tabControl = this.qChild('tabs');
        for (let i = 0; i < keys.length; i++) {
            let key = keys[i];
            let tab = serverTabs[key];
            tab.isLoaded = false;
            let t = this.tabControl.controlClass.addTab(tab.name);
            t.setAttribute('data-id', key);
        }
        this.tabControl.controlClass.selectedIndex = 0;
        let _this = this;
        this.localListen(this.tabControl, 'change', function () {
            _this.loadTab(_this.tabControl.controlClass.selectedTab);
        });
    }
    loadTab(key) {
        let tab = this.tabs[key];
        if (!tab.isLoaded) {
            // create layout:
            let contentDiv = document.createElement('div');
            contentDiv.innerHTML = window.loadFile('file:///controls/serverConfig/' + key + '.html');
            requirejs('controls/serverConfig/' + key + '.js');
            let tabContent = contentDiv.firstElementChild;
            tabContent.classList.add('padding');
            this.tabControl.controlClass.setTabPanel(key, tabContent);
            initializeControls(tabContent);
            // load values:
            tab.load.apply(this);
            tab.isLoaded = true;
        }
    }
    save() {
        let keys = Object.keys(this.tabs);
        for (let i = 0; i < keys.length; i++) {
            let key = keys[i];
            if (this.tabs[key].isLoaded) {
                this.tabs[key].save.apply(this);
            }
        }
        this.server.commitAsync();
    }
    get dataSource() {
        return this.server;
    }
    set dataSource(server) {
        this.server = server;
        this.loadTab(this.tabControl.controlClass.selectedTab);
    }
}
registerClass(ServerConfig);
ServerConfig.prototype.tabs = {
    devices: {
        name: _('Clients'),
        order: 10
    },
    server: {
        name: _('Server'),
        order: 20
    },
    content: {
        name: _('Shared content'),
        order: 30
    },
    autoConvert: {
        name: _('Auto-conversion'),
        order: 40
    },
};
