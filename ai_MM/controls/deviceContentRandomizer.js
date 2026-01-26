/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

registerFileImport('controls/deviceContentRandomizer');
'use strict';
import Control from './control';
class DeviceContentRandomizer extends Control {
    initialize(element, params) {
        super.initialize(element, params);
        this.container.classList.add('hSeparatorsTiny');
        this.container.innerHTML =
            '<div data-id="chbRandomize" data-control-class="Checkbox" data-tip="' + _('Sync a random subset of the selected files filling the target to the set limit. This is useful for syncing random tracks to a device/location that cannot contain your entire library.') + '">' + _('Sync random subset of selected files up to target capacity') + '</div>' +
                '<div data-id="boxRandomize" data-control-class="Control" class="left-indent hSeparatorsTiny">' +
                '   <div>' +
                '       <div data-id="chbPreferStars" data-control-class="Checkbox" data-tip="' + _('This gives preference to tracks with higher ratings.') + '">' + _('Sync higher-rated tracks more often') + '</div>' +
                '   </div>' +
                '   <div class="noWrap">' +
                '       <div data-id="chbReserveMB" data-control-class="Checkbox">' + _('Reserve') + '</div>' +
                '       <div data-id="edtReserveMB" data-control-class="Edit" data-init-params="{type: \'number\', min:0, max:1000000}"></div>' +
                '       <label>' + _('MB of free space') + '</label>' +
                '   </div>' +
                '</div>';
        initializeControls(this.container);
        // due to 'live' size computing we need to update the values on each UI interaction:
        this.localListen(this.qChild('chbRandomize'), 'click', this.updateValues.bind(this));
        this.localListen(this.qChild('chbPreferStars'), 'click', this.updateValues.bind(this));
        this.localListen(this.qChild('chbReserveMB'), 'click', this.updateValues.bind(this));
        this.localListen(this.qChild('edtReserveMB'), 'change', this.updateValues.bind(this));
    }
    updateValues() {
        if (this.collection) {
            this.collection.randomSelection = this.qChild('chbRandomize').controlClass.checked;
            this.collection.preferStars = this.qChild('chbPreferStars').controlClass.checked;
            this.collection.reserveSpace = this.qChild('chbReserveMB').controlClass.checked;
            this.collection.reserveSpaceMB = Number(this.qChild('edtReserveMB').controlClass.value);
        }
    }
    get dataSource() {
        this.updateValues();
        return this.collection;
    }
    set dataSource(coll) {
        this.collection = undefined; // to not process updateValues() when just setting up the source
        this.qChild('chbRandomize').controlClass.checked = coll.randomSelection;
        this.qChild('chbPreferStars').controlClass.checked = coll.preferStars;
        this.qChild('chbReserveMB').controlClass.checked = coll.reserveSpace;
        this.qChild('edtReserveMB').controlClass.value = coll.reserveSpaceMB;
        bindDisabled2Checkbox(this.qChild('boxRandomize'), this.qChild('chbRandomize'));
        this.collection = coll;
    }
}
registerClass(DeviceContentRandomizer);
