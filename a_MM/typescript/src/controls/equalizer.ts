registerFileImport('controls/equalizer');

'use strict';

/**
@module UI
*/

import Control from './control';


/**
UI equalizer element

@class Equalizer
@constructor
@extends Control
*/
class Equalizer extends Control {
    private _showButtons: boolean;
    balance: any;
    preamp: any;
    bands: AnyDict;
    btnLoadPreset: any;
    btnSavePreset: any;
    btnReset: any;
    chbEnabled: any;

    initialize(parentel, params) {
        super.initialize(parentel, params);

        this._showButtons = true;
        let _this = this;
        this.container.innerHTML = loadFile('file:///controls/equalizer.html');
        initializeControls(this.container);

        let trackBox = this.qChild('trackBox');
        this.balance = this.qChild('balance');
        let boxContent = trackBox.innerHTML;
        let db = _('dB');
        let tickCaptions = ['+20 '+db, '+10 '+db, '0', '-10 '+db, '-20 '+db];
        let sliderLabels = ['Pre amp', '31 Hertz', '63 Hertz', '125 Hertz', '250 Hertz', '500 Hertz', '1 kilo Hertz', '2 kilo Hertz', '4 kilo Hertz', '8 kilo Hertz', '16 kilo Hertz'];
        boxContent = boxContent + '<table class="eqTable" aria-hidden="true"><tr>'; // table is aria-hidden so it does not read the columns and rows
        boxContent = boxContent + '<td><div data-id="preamp" data-control-class="Slider" data-init-params="{orientation: \'vertical\', invert: true, min: -20, max: 20, tickInterval: 5, wheelStep: 2, step: 0.5, tickPlacement: \'topLeft\', speechName: \'' + sliderLabels[0] + '\'}" class="eqTrackBar inline" ></div></td>';

        boxContent = boxContent + '<td><div class="flex column spacearound stretchHeight">';
        for (let i = 0; i < tickCaptions.length; i++) {
            boxContent = boxContent + '<div class="">' + tickCaptions[i] + '</div>';
        }
        boxContent = boxContent + '</div></td>';

        // create bands
        for (let iBand = 1; iBand <= 10; iBand++) {
            boxContent = boxContent + '<td><div data-id="band_' + iBand + '" data-control-class="Slider" data-init-params="{orientation: \'vertical\', invert: true, min: -20, max: 20, tickInterval: 5, wheelStep: 2, step: 0.5, tickPlacement: \'topLeft\', speechName: \'' + sliderLabels[iBand] + '\'}" class="eqTrackBar inline" ></div></td>';
        }
        boxContent = boxContent + '</tr><tr>';
        let captions = ['Preamp', ' ', '31Hz', '63', '125', '250', '500', '1k', '2k', '4k', '8k', '16kHz'];
        boxContent = boxContent + '<td class="eqPreamp">' + captions[0] + '</td>';
        boxContent = boxContent + '<td class="eqLegend">' + captions[1] + '</td>';
        for (let i = 2; i < captions.length; i++) {            
            boxContent = boxContent + '<td class="eqCol">' + captions[i] + '</td>';
        }
        boxContent = boxContent + '</tr></table>';

        trackBox.innerHTML = boxContent;
        initializeControls(trackBox);

        this.balance.controlClass.value = app.player.panning;

        let loadValues = function () {
            let sett = JSON.parse(app.settings.equalizer.getJSON());
            this.qChild('chbEnabled').controlClass.checked = sett.Equalizer.Enabled;
            this.qChild('preamp').controlClass.value = sett.Equalizer.LeftPreamp; // LeftPreamp == RightPreamp, i.e. we set left/right channel to the same value        
            for (let iBand = 1; iBand <= 10; iBand++) {
                this.qChild('band_' + iBand).controlClass.value = sett.Equalizer['Left' + iBand]; // we set left/right channel to the same value        
            }
        }.bind(this);

        let btnLoadPresetClick = function () {
            let promise = app.utils.dialogOpenFile(_('Equalizer'), 'sde', 'Equalizer preset (*.sde)|*.sde|All files (*.*)|*.*', '');
            promise.then(function (filename) {
                if (filename != '') {
                    _this.localPromise(app.settings.equalizer.loadPreset(filename)).then(function () {
                        loadValues();
                    });
                }
            });
        };

        let btnSavePresetClick = function () {
            let promise = app.utils.dialogSaveFile('Equalizer', 'sde', 'Equalizer preset (*.sde)|*.sde|All files (*.*)|*.*', '');
            promise.then(function (filename) {
                if (filename != '') {
                    app.settings.equalizer.savePreset(filename);
                }
            });
        };

        let applyValues = function () {
            let diff = this.lastApplyTime || 0;
            diff = Date.now() - diff;
            if (diff < 2000) {
                if (!this.waitingForApply) {
                    this.waitingForApply = true;
                    requestTimeout(applyValues, 2000 - diff);
                }
                return;
            }
            this.waitingForApply = false;
            this.lastApplyTime = Date.now();
            let sett = JSON.parse(app.settings.equalizer.getJSON());
            sett.Equalizer.Enabled = this.qChild('chbEnabled').controlClass.checked;
            sett.Equalizer.LeftPreamp = this.qChild('preamp').controlClass.value;
            sett.Equalizer.RightPreamp = sett.Equalizer.LeftPreamp;
            // save bands
            for (let iBand = 1; iBand <= 10; iBand++) {
                // we set left/right channel to the same value
                sett.Equalizer['Left' + iBand] = this.qChild('band_' + iBand).controlClass.value;
                sett.Equalizer['Right' + iBand] = this.qChild('band_' + iBand).controlClass.value;
            }
            app.settings.equalizer.setJSON(JSON.stringify(sett));
        }.bind(this);

        loadValues();

        let liveToastFunc = function (evt) {
            uitools.toastMessage.show('&nbsp;' + Math.round(evt.detail.value*10)/10 + ' ' + db + '&nbsp;', {
                disableClose: true,
                delay: 3000
            });
        };
        
        this.preamp = this.qChild('preamp');
        this.localListen(this.preamp, 'change', applyValues);
        this.localListen(this.preamp, 'livechange', liveToastFunc);

        this.bands = {};
        for (let iBand = 1; iBand <= 10; iBand++) {
            let key = 'band_' + iBand;
            this.bands[key] = this.qChild(key);
            this.localListen(this.bands[key], 'change', applyValues);
            this.localListen(this.bands[key], 'livechange', liveToastFunc);
        }

        let btnResetClick = function () {
            this.preamp.controlClass.value = 0;
            for (let iBand = 1; iBand <= 10; iBand++) {
                this.qChild('band_' + iBand).controlClass.value = 0;
            }
            this.balance.controlClass.value = 0;
            app.player.panning = 0; //#17112
            applyValues();
        }.bind(this);

        this.btnLoadPreset = this.qChild('btnLoadPreset');
        this.localListen(this.btnLoadPreset, 'click', btnLoadPresetClick);
        this.btnSavePreset = this.qChild('btnSavePreset');
        this.localListen(this.btnSavePreset, 'click', btnSavePresetClick);
        this.btnReset = this.qChild('btnReset');
        this.localListen(this.btnReset, 'click', btnResetClick);
        this.chbEnabled = this.qChild('chbEnabled');
        this.localListen(this.chbEnabled, 'click', applyValues);
        let leftTxt = _('Left');
        let rightTxt = _('Right');
        let centerTxt = _('Center');
        let balanceTxt = _('Balance:');
        
        this.localListen(this.balance, 'livechange', function (evt) {
            let val = this.balance.controlClass.value;
            app.player.panning = this.balance.controlClass.value;
            let txt = balanceTxt + ' ';
            val = Math.round(val * 100);
            if(val<0) {
                txt += (-val) + ' % ' + leftTxt;
            } else if(val>0) {
                txt += val + ' % ' + rightTxt;
            } else
                txt += centerTxt;

            uitools.toastMessage.show('&nbsp;' + txt + '&nbsp;', {
                disableUndo: true,
                disableClose: true,
                delay: 3000
            });
        }.bind(this));
    }

    /**
    Sets/Gets whether Load/Save/Reset buttons should be visible

    @property showButtons
    @type boolean
    @default true
    */    
    get showButtons () {
        return this._showButtons;
    }
    set showButtons (val) {
        this._showButtons = val;
        setVisibility(this.qChild('btnLoadPreset'), val);
        setVisibility(this.qChild('btnSavePreset'), val);
        setVisibility(this.qChild('btnReset'), val);
    }
    
}
registerClass(Equalizer);
