registerFileImport('controls/menuPanel');

'use strict';

/**
@module UI
*/

import ArrayDataSource from '../helpers/arrayDataSource';
import Control from './control';

/**
Class for show menu in panel (like in Metro apps).

@class MenuPanel
@constructor
@extends Control
*/

const
    PANEL_MENU = 1,
    PANEL_PLAYER = 2;
const
    FINAL_OPACITY = 0.95;

class MenuPanel extends Control {
    _player: string;
    private _position: string;
    private _order: number[];
    private _items: any[];
    _initialized: boolean;
    private _handlingAddToLibrary: boolean;
    _preparedForPosition: string;
    content: HTMLDivElement;
    playerContainer: HTMLDivElement;
    menuContainer: HTMLDivElement;
    _overlayControl: any;
    controlHandler: any;

    initialize(parentel, params) {
        super.initialize(parentel, params);
        this.disableStateStoring = true;

        let _this = this;

        this._player = loadFile('file:///controls/menuPanelPlayer.html');

        this.container.className = 'menuPanel';
        this.container.style.opacity = '0';

        this._position = 'bottom';
        this._order = [PANEL_MENU, PANEL_PLAYER];
        this._items = [];


        // set passed attributes
        for (let key in params) {
            this[key] = params[key];
        }


        this.localListen(window, 'selectionChanged', function (e) {
            if (!e.detail.modeOn && (e.detail.control === _this.controlHandler)) {
                _this.hide();
            } else if (e.detail.control && e.detail.control.dataSource && e.detail.modeOn) {
                _this._handleAddToLibrary(e.detail.control.dataSource);

            }
        });


        this._initialized = true;
        this._prepareMenuItems();
        whenReady(() => {
            this.hide();
        });
    }

    _handleAddToLibrary(ds) {

        let _this = this;
        let addOrRemove = function (addToLibRequired) {
            let addToLibAlreadyInMenu = (_this._items.length > 0) && (_this._items[0].action == actions.addToLibrary);
            if (addToLibRequired && !addToLibAlreadyInMenu) {
                _this._items.splice(0, 0, {
                    action: actions.addToLibrary
                });
                _this._prepareMenuItems();
            } else if (!addToLibRequired && addToLibAlreadyInMenu) {
                _this._items.splice(0, 1);
                _this._prepareMenuItems();
            }
        };

        if (!_this._handlingAddToLibrary) {
            _this._handlingAddToLibrary = true;
            let isTrack = ds.itemObjectType == 'track';
            let isNPTrack = ds.itemObjectType == 'playlistentry';
            if (isTrack || isNPTrack) {
                let addToLibRequired = false;
                let sel = ds.getSelectedList();
                sel.whenLoaded().then(function (l) {
                    let tr = undefined;
                    l.locked(function () {
                        for (let i = 0; i < l.count; i++) {
                            let item = l.getValue(i);
                            let id = 0;
                            if (isTrack)
                                id = item.idsong;
                            else {
                                tr = item.getFastSD(tr);
                                id = tr.idsong;
                            }
                            if (id <= 0) {
                                addToLibRequired = true;
                                break;
                            }
                        }
                    });

                    addOrRemove(addToLibRequired);
                    _this._handlingAddToLibrary = undefined;
                });
            } else {
                _this._handlingAddToLibrary = undefined;
                addOrRemove(false);
            }
        }
    }

    _updatePosition() {
        if (this._preparedForPosition == this._position || !this._initialized)
            return;

        this._preparedForPosition = this._position;

        let stretch = 'stretchWidth';
        let mainClass = 'row';
        let vertical = (this._position == 'left') || (this._position == 'right');
        if (vertical) {
            stretch = 'stretchHeight';
            mainClass = 'column';
        }

        if (!this.content) {
            this.content = document.createElement('div');
            this.container.appendChild(this.content);
        }

        this.container.classList.add(stretch);

        this.content.innerHTML = '';
        this.playerContainer = undefined;
        this.menuContainer = undefined;

        this.content.classList.add('menuPanel');
        this.content.classList.add('flex');
        this.content.classList.add('fill');
        this.content.classList.add(mainClass);

        let _this = this;

        let addPlayerContainer = function () {
            _this.playerContainer = document.createElement('div');
            _this.playerContainer.innerHTML = _this._player;
            _this.playerContainer.setAttribute('data-control-class', 'Control');
            _this.playerContainer.classList.add('verticalCenter');
            _this.playerContainer.setAttribute('data-id', 'menuPanelPlayer');
            _this.content.appendChild(_this.playerContainer);
            return _this.playerContainer;
        };

        let addMenuContainer = function () {
            _this.menuContainer = document.createElement('div');
            _this.menuContainer.setAttribute('data-control-class', 'MenuPlayerList');
            _this.menuContainer.setAttribute('data-init-params', '{isHorizontal: true, dynamicSize: false, smallItemSize: true}');
            _this.menuContainer.classList.add('fill');
            _this.content.appendChild(_this.menuContainer);
            return _this.menuContainer;
        };

        for (let i = 0; i < this._order.length; i++) {
            let div = undefined;
            switch (this._order[i]) {
            case PANEL_MENU:
                div = addMenuContainer();
                break;
            case PANEL_PLAYER:
                div = addPlayerContainer();
                break;
            }
        }
        initializeControls(this.content);

    }

    _updateSize() {
        if (this._overlayControl) {
            let ctrl = qid(this._overlayControl);
            let vertical = (this._position == 'left') || (this._position == 'right');
            let ctrlProp = (vertical) ? 'offsetWidth' : 'offsetHeight';
            let mainProp = (vertical) ? 'width' : 'height';
            if (ctrl && ctrl[ctrlProp]) {
                this.container.style[mainProp] = ctrl[ctrlProp];
                this.content.style[mainProp] = ctrl[ctrlProp];
            }
        }
    }

    _prepareMenuItems() {
        if (!this._initialized)
            return;

        if (this._preparedForPosition != this._position)
            this._updatePosition();

        if (!this.menuContainer)
            return;

        this.menuContainer.controlClass.dataSource = new ArrayDataSource(this._items);
    }

    cleanUp() {
        this.hide();
        super.cleanUp();
    }

    show(handler) {
        if (!isVisible(this.container)) {
            this.controlHandler = handler;
            this._updateSize();
            animTools.animateMenuPanel(this.container, true, FINAL_OPACITY);
        }
    }

    hide() {
        if (isVisible(this.container)) {
            animTools.animateMenuPanel(this.container, false, FINAL_OPACITY);
        }
        this.controlHandler = undefined;
    }
    
    get position () {
        return this._position;
    }
    set position (value) {
        if (this._position != value) {
            this._position = value;
            this._updatePosition();
        }
    }
        
    get order () {
        return this._order;
    }
    set order (value) {
        if (this._order != value) {
            this._order = value;
            this._preparedForPosition = undefined;
            this._updatePosition();
        }
    }    
    
    get items () {
        return this._items;
    }
    set items (value) {
        if (this._items != value) {
            this._items = value;
            this._prepareMenuItems();
        }
    }
        
    set overlayControl (value) {
        this._overlayControl = value;
    }
    
}
registerClass(MenuPanel);