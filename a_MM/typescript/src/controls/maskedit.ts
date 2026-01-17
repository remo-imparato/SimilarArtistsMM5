registerFileImport('controls/maskEdit');


/**
@module UI
*/

import Control from './control';
import Dropdown from './dropdown';
import Button from './button';
import Buttons from './buttons';
requirejs('masks');
requirejs('utils');

/**
UI MaskEdit element

@class MaskEdit
@constructor
@extends Control
*/
class MaskEdit extends Control {
    parent: HTMLDivElement;
    private _combo: ElementWith<Dropdown>;
    private _buttons: ElementWith<Buttons>;
    private _browseBtn: ElementWith<Button>;
    private _valuesBtn: ElementWith<Button>;
    private _configureBtn: ElementWith<Button>;
    getEditValueMask: () => string;
    setEditValueMask: (val) => void;
    _virtualDir: string;
    private _masks: StringList;
    private _sampleTrack: Track;
    tracklistMaskGroups: string[];
    allMaskItemsCount: number;
    allMaskItems: AnyDict;
    hideConfDialogBrowseButton: boolean;
    edit: HTMLInputElement;

    initialize(parentel: HTMLDivElement, params: AnyDict) {

        super.initialize(parentel, params);

        enterLayoutLock(this.container);

        this.helpContext = 'Configuring_Directory_and_File_Formats';
        let _this = this;
        this.parent = document.createElement('div');
        this.container.appendChild(this.parent);

        this.parent.classList.add('fill');
        this.parent.classList.add('flex');
        this.parent.classList.add('row');
        this.parent.classList.add('maskedit');

        this._combo = document.createElement('div') as ElementWith<Dropdown>;
        this._buttons = document.createElement('div') as ElementWith<Buttons>;

        this._combo.classList.add('fill');
        this._buttons.classList.add('static');

        this.parent.appendChild(this._combo);
        this.parent.appendChild(this._buttons);

        this._combo.controlClass = new Dropdown(this._combo, {
            multivalue: false,
            autoWidth: false,
            filtering: false,
            textOnly: true // do not use innerHTML for line values, mask values usually contains < >
        });
        this._buttons.controlClass = new Buttons(this._buttons);

        app.listen(this._combo, 'change', function (/*e*/) {
            let evt = createNewEvent('change');
            this.container.dispatchEvent(evt);
        }.bind(this));

        if (params && params.showBrowseButton) {
            this._browseBtn = this._buttons.controlClass.addBtn({
                btnID: 'browse',
                value: '',
                isDefault: false,
                isOpposite: false,
                caption: _('Browse') + '...'
            });
            this.localListen(this._browseBtn, 'click', function () {
                let dir = '';
                if (this._sampleTrack)
                    dir = app.utils.getDirectory(this._sampleTrack.path);
                window.uitools.showSelectFolderDlg(dir).then(function (path) {
                    if (path != '')
                        this.value = path + app.masks.getMaskPart(this.value);
                }.bind(this));
            }.bind(this));
        }

        this._valuesBtn = this._buttons.controlClass.addBtn({
            btnID: 'values',
            value: '',
            isDefault: false,
            isOpposite: false,
            caption: '>>',
            menuArray: this.getMaskMenuItems.bind(this)
        });
        this._configureBtn = this._buttons.controlClass.addBtn({
            btnID: 'configure',
            value: '',
            isDefault: false,
            isOpposite: false,
            caption: _('Configure') + '...'
        });

        this.getEditValueMask = this._combo.controlClass.getEditValue.bind(this._combo.controlClass);
        this.setEditValueMask = this._combo.controlClass.setEditValue.bind(this._combo.controlClass);

        this._virtualDir = '';
        this._sampleTrack = null;
        this.edit = this._combo.controlClass.edit;

        // set passed attributes
        for (let key in params) {
            this[key] = params[key];
        }

        if (this._masks === undefined) {
            this.masks = app.masks.getDefaultFileMasks();
        }

        app.listen(this._configureBtn, 'click', function () {

            let openConfigWindow = function () {
                this._configWnd = uitools.openDialog('empty', {
                    modal: true,
                    title: _('Destination')
                });
                this._configWnd.loaded = function () {
                    // set wizard data
                    this._configWnd.setValue('params', {
                        sampleTrack: _this._sampleTrack,
                        updateParentMaskEdit: function (mask) {
                            _this.setEditValueMask(mask);
                        },
                        virtualDir: _this.virtualDir,
                        mask: _this.getEditValueMask(),
                        hideBrowseButton: _this.hideConfDialogBrowseButton,
                    });

                    // prepare HTML
                    this._configWnd.getValue('requirejs')('controls/maskEditWizard');                    
                    this._configWnd.getValue('initWizard')();
                }.bind(this);

                this._configWnd.closed = function () {

                }.bind(this._configWnd);

                app.listen(this._configWnd, 'load', this._configWnd.loaded);
                app.listen(this._configWnd, 'closed', this._configWnd.closed);
            }.bind(this);


            if (!this._sampleTrack) {
                app.utils.getSampleTrackAsync('music').then(function (track) {
                    this._sampleTrack = track;
                    openConfigWindow();
                }.bind(this));
            } else {
                openConfigWindow();
            }
        }.bind(this));

        leaveLayoutLock(this.container);
    }

    doGetCaretPosition(ctrl) {
        let caretPos = 0;
        if (ctrl.selectionStart || ctrl.selectionStart == '0')
            caretPos = ctrl.selectionStart;
        return caretPos;
    }

    doSetCaretPosition(ctrl, pos) {
        ctrl.selectionStart = pos;
        ctrl.selectionEnd = pos;
    }

    prepareMaskGroups() {
        if (!this.allMaskItems) {
            let colSort = [];
            this.allMaskItems = {};
            this.allMaskItemsCount = 0;

            let addMaskItem = function (maskID) {
                let item = (maskID === '-') ? '-' : ('%' + maskID);
                this.allMaskItems[maskID] = {
                    title: app.masks.getDescription(item),
                    value: item,
                    maskID: maskID
                };
                colSort.push(this.allMaskItems[maskID]);
            }.bind(this);

            let getSubItems = function (fields, isRoot) {
                let retval = [];
                if (isRoot) {
                    // add some special masks not used for tracklist fields
                    retval.push('D'); // auto number
                    retval.push('N'); // random number
                    retval.push('P'); // track folder
                    if (this.showPlaylistMask)
                        retval.push('Q'); // playlist                    
                    if (this.showSkipMask)
                        retval.push('X'); // skip
                    retval.push('\\'); // directory
                    if (this.showTargetExtension)
                        retval.push('ZQ'); // target extension
                    retval.push('-'); // splitter
                    forEach(retval, addMaskItem);
                }
                forEach(fields, function (itm) {
                    if (isString(itm)) {
                        let field = uitools.tracklistFieldDefs[itm];
                        if (field && field.mask && (field.mask != 'ZZS' /* eliminate summary mask -- #19376 */)) {
                            retval.push(field.mask);
                            addMaskItem(field.mask);
                        }
                    } else if (isObjectLiteral(itm)) {
                        // prepare possible submenu
                        let subitems = getSubItems(itm.fields);
                        if (subitems.length > 0) {
                            retval.push({
                                group: itm.group,
                                masks: subitems
                            });
                        }
                    }
                });
                return retval;
            }.bind(this);

            this.tracklistMaskGroups = getSubItems(uitools.tracklistFieldGroups, true);
            // prepare sorting indexes for easier filling of "order" numbers
            colSort.sort(function (i1, i2) {
                return i1.title.localeCompare(i2.title, undefined, {numeric: true, sensitivity: 'base'});
            });
            forEach(colSort, function (cols, idx) {
                cols.order = idx;
            });
            this.allMaskItemsCount = colSort.length;
        } else {
            // already exists, reset used state only
            for (let maskID in this.allMaskItems) {
                let maskInfo = this.allMaskItems[maskID];
                maskInfo.used = false;
            }
        }
    }

    getMaskMenuItems() {
        let menuItems = [];
        let _this = this;

        this.prepareMaskGroups();

        let _handleChooseMask = function () {
            if (_this._cleanUpCalled || !_this._combo.controlClass)
                return;
            let item = this.maskValue;
            if (item[0] === '%') // is a non visual mask, convert it to visual
            {
                item = app.masks.mask2VisMask(item);
            }

            let pos = _this.doGetCaretPosition(_this._combo.controlClass.edit);
            let pre = _this.getEditValueMask().substr(0, pos);
            let post = _this.getEditValueMask().substr(pos);
            _this.setEditValueMask(pre + item + post);
            _this.doSetCaretPosition(_this._combo.controlClass.edit, pos + item.length);
        };

        let getSubmenuItems = function (fields, isRoot) {
            let retval = isRoot ? menuItems : []; // root items insert directly to presetColumns, so we will not need to move them here later
            let so = 1;
            let allFieldsTitle = _('All fields');

            forEach(fields, function (itm) {
                if (isString(itm)) {
                    let maskInfo = this.allMaskItems[itm];
                    if (maskInfo) {
                        let go = 10;
                        if (isRoot) {
                            if ((maskInfo.maskID === '\\') || (maskInfo.maskID === '-')) { // separate Directory and Separator items
                                go = 20;
                            } else {
                                go = 10;
                            }
                        }
                        retval.push({
                            action: {
                                title: maskInfo.title,
                                execute: _handleChooseMask,
                                maskID: maskInfo.maskID,
                                maskValue: maskInfo.value,
                                noCloseAfterExecute: true
                            },
                            order: maskInfo.order,
                            grouporder: go,
                        });
                        maskInfo.used = true;
                    }
                } else if (isObjectLiteral(itm)) {
                    // prepare possible submenu
                    let submenu = getSubmenuItems(itm.masks);
                    if (submenu.length > 0) {
                        retval.push({
                            action: {
                                title: itm.group,
                                submenu: submenu
                            },
                            order: this.allMaskItemsCount + 10 * so++,
                            grouporder: isRoot ? 40 : 20,
                            grouptitle: isRoot ? allFieldsTitle : undefined,
                        });
                    }
                }
            }.bind(this));

            if (isRoot) {
                // add fields from this.allMaskItems not mentioned in fieldGroups to Other
                let notUsedSubmenu = [];
                for (let maskID in this.allMaskItems) {
                    let maskInfo = this.allMaskItems[maskID];
                    if (!maskInfo.used) {
                        notUsedSubmenu.push({
                            action: {
                                title: maskInfo.title,
                                execute: _handleChooseMask,
                                maskID: maskInfo.maskID,
                                maskValue: maskInfo.value,
                                noCloseAfterExecute: true
                            },
                            order: maskInfo.order,
                            grouporder: 10
                        });
                    }
                }
                if (notUsedSubmenu.length > 0) {
                    retval.push({
                        action: {
                            title: _('Other'),
                            submenu: notUsedSubmenu
                        },
                        order: this.allMaskItemsCount + 10 * so++,
                        grouporder: 40,
                        grouptitle: allFieldsTitle,
                    });
                }
            }
            return retval;
        }.bind(this);

        getSubmenuItems(this.tracklistMaskGroups, true /* root */ );

        return menuItems;
    }
    
    set masks(value) {
        this._masks = value;
        this._combo.controlClass.dataSource = value;
    }
    get masks() {
        return this._masks;
    }
    
    set sampleTrack (value: Track) {
        this._sampleTrack = value;
    }
    get sampleTrack() : Track {
        return this._sampleTrack;
    }
    
    set hideWizardButton (value: boolean) {
        setVisibility(this._configureBtn, !value);
    }
        
    set hideMaskMenuButton (value: boolean) {
        setVisibility(this._valuesBtn, !value);
    }
        
    set value (v: string) {
        this.setEditValueMask(v);
    }
    get value () : string {
        return this.getEditValueMask();
    }
        
    set virtualDir(value) {
        this._virtualDir = value;
    }
    get virtualDir() {
        return this._virtualDir;
    }    
}
registerClass(MaskEdit);