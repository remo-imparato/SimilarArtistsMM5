registerFileImport('controls/deviceContentSequencer');

'use strict';

import Control from './control';

class DeviceContentSequencer extends Control {
    collection: DeviceCollection;
    XrecentEpStr: string;
    AllEpStr: string;
    XoldestEpStr: string;

    initialize(element, params) {
        super.initialize(element, params);
        this.container.classList.add('hSeparatorsTiny');
        this.container.innerHTML =
            '<div>' +
            '    <label>Sync</label>' +
            '    <div data-id="cbSyncNumber" data-control-class="Dropdown" data-init-params="{readOnly: true, autoWidth: false}"></div>' +
            '    <div data-id="cbSyncKind" data-control-class="Dropdown" data-init-params="{readOnly: true, autoWidth: false}"></div>' +
            '</div>';
        initializeControls(this.container);

        let _this = this;
        let list = newStringList();
        this.AllEpStr = _('All');
        list.add(this.AllEpStr);
        this.XrecentEpStr = _('the %d most recent');
        [1, 2, 3, 5, 10].forEach(function (e) {
            list.add(sprintf(_this.XrecentEpStr, e));
        });
        this.XoldestEpStr = '%d ' + _('oldest');
        [1, 2, 3, 5, 10].forEach(function (e) {
            list.add(sprintf(_this.XoldestEpStr, e));
        });
        let cb = this.qChild('cbSyncNumber');
        cb.controlClass.dataSource = list;
        cb.controlClass.focusedIndex = 0;

        list = newStringList();
        list.add('episodes');
        list.add('unplayed episodes');
        cb = this.qChild('cbSyncKind');
        cb.controlClass.dataSource = list;
        cb.controlClass.focusedIndex = 0;

        // due to 'live' size computing we need to update the values on each UI interaction:
        this.localListen(this.qChild('cbSyncNumber'), 'change', this.updateValues.bind(this));
        this.localListen(this.qChild('cbSyncKind'), 'change', this.updateValues.bind(this));
    }

    updateValues() {
        if (this.collection) {
            let _this = this;
            let cb = this.qChild('cbSyncNumber');
            if (cb.controlClass.value == this.AllEpStr)
                this.collection.syncNumber = 0;
            [1, 2, 3, 5, 10].forEach(function (e) {
                if (cb.controlClass.value == sprintf(_this.XrecentEpStr, e))
                    _this.collection.syncNumber = e;
                if (cb.controlClass.value == sprintf(_this.XoldestEpStr, e))
                    _this.collection.syncNumber = -e;
            });
            this.collection.syncKind = this.qChild('cbSyncKind').controlClass.focusedIndex;
        }
    }
  
    get dataSource () {
        this.updateValues();
        return this.collection;
    }
    set dataSource (coll) {
        this.collection = undefined; // to not process updateValues() when just setting up the source
        let cb = this.qChild('cbSyncNumber');
        if (coll.syncNumber > 0)
            cb.controlClass.value = sprintf(this.XrecentEpStr, coll.syncNumber);
        else
        if (coll.syncNumber < 0)
            cb.controlClass.value = sprintf(this.XoldestEpStr, Math.abs(coll.syncNumber));
        else
        if (coll.syncNumber == 0)
            cb.controlClass.value = this.AllEpStr;

        let list = newStringList();
        if (coll.contentType == 'video') {
            list.add(_('videos'));
            list.add(_('unplayed videos'));
        } else
        if (coll.contentType == 'tv') {
            list.add(_('TV Shows'));
            list.add(_('unplayed TV Shows'));
        } else {
            list.add(_('episodes'));
            list.add(_('unplayed episodes'));
        }
        let cbSyncKind = this.qChild('cbSyncKind');
        cbSyncKind.controlClass.dataSource = list;
        cbSyncKind.controlClass.focusedIndex = coll.syncKind;
        this.collection = coll;
    }
  
}
registerClass(DeviceContentSequencer);
