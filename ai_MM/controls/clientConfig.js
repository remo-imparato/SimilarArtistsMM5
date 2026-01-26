/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

'use strict';
registerFileImport('controls/clientConfig');
import Control from './control';
/**
 * Media server's client configuration element.
 */
export default class ClientConfig extends Control {
    initialize(parentel, params) {
        super.initialize(parentel, params);
        this.container.innerHTML = loadFile('file:///controls/clientConfig.html');
        initializeControls(this.container);
        let clientTabs = this.tabs;
        let keys = Object.keys(clientTabs);
        for (let i = 0; i < keys.length; i++) {
            let tab = clientTabs[keys[i]];
            if (tab.order === undefined)
                tab.order = 10 * (i + 1);
        }
        keys.sort(function (i1, i2) {
            let retval = clientTabs[i1].order - clientTabs[i2].order;
            return retval;
        });
        this.tabControl = this.qChild('tabs');
        for (let i = 0; i < keys.length; i++) {
            let key = keys[i];
            let tab = clientTabs[key];
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
            contentDiv.innerHTML = window.loadFile('file:///controls/clientConfig/' + key + '.html');
            requirejs('controls/clientConfig/' + key + '.js');
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
        this.client.commitAsync();
    }
    get dataSource() {
        return this.client;
    }
    set dataSource(client) {
        this.client = client;
        this.loadTab(qid('tabs').controlClass.selectedTab);
    }
}
registerClass(ClientConfig);
ClientConfig.prototype.tabs = {
    content: {
        name: _('Shared content'),
        order: 10
    },
    autoConvert: {
        name: _('Auto-conversion'),
        order: 20
    },
};
