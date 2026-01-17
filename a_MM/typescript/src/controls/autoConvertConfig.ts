'use strict';

registerFileImport('controls/autoConvertConfig');

import Control from './control';
import GridView from './gridview';

/**
 * Control for configuration of auto-convert rules
 */
export default class AutoConvertConfig extends Control {

    initialize(rootelem, params) {
        super.initialize(rootelem, params);
        this.container.innerHTML = loadFile('file:///controls/autoConvertConfig.html');
        initializeControls(this.container);

        let buttons = this.qChild('editButtons').controlClass.buttons;
        this.localListen(buttons.new, 'click', () => {
            if (this.checkGoldStatus()) {
                let list = this._dataSource.rules;
                let newItem = this._dataSource.getNewRule();
                let dlg = uitools.openDialog('dlgAutoConvertRule', {
                    item: newItem,
                    convertSettings: this._dataSource,
                    modal: true,
                });
                dlg.closed = () => {
                    if (dlg.modalResult == 1) {
                        list.add(newItem);
                        this.raiseEvent('change');
                    }
                };
                app.listen(dlg, 'closed', dlg.closed);
            }
        });
        this.localListen(buttons.edit, 'click', () => {
            if (this.checkGoldStatus()) {
                let list = this._dataSource.rules;
                let item = list.focusedItem;
                let _copy = item.getCopy();
                let dlg = uitools.openDialog('dlgAutoConvertRule', {
                    item: item,
                    convertSettings: this._dataSource,
                    modal: true,
                });
                dlg.closed = () => {
                    if (dlg.modalResult == 1) {
                        this.qChild('lvFormatList').controlClass.invalidateAll();
                        this.raiseEvent('change');
                    } else
                        item.loadFrom(_copy);
                };
                app.listen(dlg, 'closed', dlg.closed);
            }
        });
        this.localListen(this.qChild('lvFormatList'), 'checkedchanged', () => {
            this.raiseEvent('change');
        });
        this.localListen(buttons.up, 'click', () => {
            this.raiseEvent('change');
        });
        this.localListen(buttons.down, 'click', () => {
            this.raiseEvent('change');
        });
        this.localListen(buttons.delete, 'click', () => {
            this.raiseEvent('change');
        });
        let lvFormatList = this.qChild('lvFormatList');
        this.localListen(lvFormatList, 'itemdblclick', function () {
            buttons.edit.click();
        });
        this.localListen(lvFormatList, 'itementer', function () {
            buttons.edit.click();
        });
        this.localListen(this.qChild('btnSetFormats'), 'click', () => {
            let _copy = this._dataSource.getCopy();
            let dlg = uitools.openDialog('dlgSupportedFormats', {
                item: _copy,
                modal: true,
            });
            dlg.closed = () => {
                if (dlg.modalResult == 1) {
                    this._dataSource.loadFrom(_copy);
                    this.qChild('lblSupportedFormats').innerText = this._dataSource.supportedFormatsText;
                    this.raiseEvent('change');
                }
            };
            app.listen(dlg, 'closed', dlg.closed);
        });
        addEnterAsClick(this, this.qChild('btnSetFormats'));
    }

    checkGoldStatus() {
        if (!app.utils.isRegistered()) {
            window.uitools.showGoldMessage(_('The standard version of MediaMonkey allows you to use the default auto-conversion rules. To convert content on-the-fly to different formats or to higher/lower bitrates, please upgrade to MediaMonkey Gold.'));
            return false;
        } else {
            return true;
        }
    }

    initStrings(useStrings) {
        this.qChild('lblCaption').innerText = useStrings.headings;
        let LV = this.qChild('lvFormatList');
        LV.controlClass.enableDragNDrop();
        let columns = [];

        columns.push({
            order: 1,
            headerRenderer: GridView.prototype.headerRenderers.renderCheck,
            setupCell: GridView.prototype.cellSetups.setupCheckbox,
            bindData: GridView.prototype.defaultBinds.bindCheckboxCell
        });
        columns.push({
            order: 2,
            width: 300,
            title: useStrings.sourceFormat,
            bindData: function (div, item, index) {
                div.innerText = item.sourceFormatText;
            }
        });
        columns.push({
            order: 3,
            width: 300,
            title: useStrings.targetFormat,
            bindData: function (div, item, index) {
                let txt = item.targetFormatText.replace(/[\r\n]+/g, '; ').replace('; )', ')'); // convert to one line
                div.innerText = txt;
            }
        });
        LV.controlClass.setColumns(columns);
        this.qChild('legendSuppFormats').innerText = useStrings.supportedFormats;
        this.qChild('chbLevelVolume').controlClass.text = useStrings.levelVolumeText;
    }

    
    get dataSource() {
        this._dataSource.levelVolume = this.qChild('chbLevelVolume').controlClass.checked;
        this._dataSource.targetLevel = Number(this.qChild('edtVolumeLevelVal').controlClass.value);
        return this._dataSource;
    }
    set dataSource(value) {
        this._dataSource = value;
        this.qChild('lvFormatList').controlClass.dataSource = this._dataSource.rules;
        this.qChild('editButtons').controlClass.dataSource = this._dataSource.rules;
        this.qChild('chbLevelVolume').controlClass.checked = this._dataSource.levelVolume;
        this.qChild('edtVolumeLevelVal').controlClass.value = this._dataSource.targetLevel;
        this.qChild('lblSupportedFormats').innerText = this._dataSource.supportedFormatsText;
    }    
}
registerClass(AutoConvertConfig);
