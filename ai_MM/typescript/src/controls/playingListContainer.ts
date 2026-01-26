registerFileImport('controls/playingListContainer');

/**
@module UI Snippets
*/

import { MenuItem } from '../actions';
import Control, { ControlState } from './control';
import MenuButton from './menuButton';
import NowPlayingTracklist from './nowPlaying/tracklist';

declare global {
    var playingListLayouts: AnyDict;
    var playingListMenuItems: MenuItem[];
}

window.playingListLayouts = {
    simplifiedList: {
        title: _('Simplified list'),
        order: 10,
        controlClass: 'NowplayingListView',
        controlClass_initParams: {
            statusInHeader: true,
            makeInSync: true,
            standalone: false
        },
        req: 'controls/nowplayingList'
    },
    list: {
        title: _('List'),
        order: 20,
        controlClass: 'NowPlayingTracklist',
        controlClass_initParams: {
            orderColumnSupport: true,
            standalone: false
        },
        req: 'controls/nowPlaying/tracklist',
        statusbar: true,
        options: function (ctrlDiv) {
            window.menus.chooseColumns(ctrlDiv);
        }
    }
};

// prepare menu items for 'Playing' list
let undoIcon = '';
let redoIcon = '';
loadIcon('undo', function (iconData) {
    undoIcon = iconData;
});
loadIcon('redo', function (iconData) {
    redoIcon = iconData;
});

window.playingListMenuItems = [
    {
        action: {
            title: function () {
                return '<div data-html="1" class="flex row flexcenter"><div data-id="undoBtn" data-tip="Undo 1 step" class="custommenubutton inline paddingColumn">' + undoIcon + '</div><div data-id="redoBtn" data-tip="Redo 1 step" class="custommenubutton inline paddingColumn">' + redoIcon + '</div></div>';
            },
            custom: true,
            buttonActions: [{
                id: 'undoBtn',
                execute: function () {
                    app.player.undoAsync(1);
                    return true;
                },
                disabled: function () {
                    let undolist = app.player.getUndoList(true /* only first*/ );
                    return !undolist || (undolist.count === 0);
                },
            }, {
                id: 'redoBtn',
                execute: function () {
                    app.player.redoAsync(1);
                    return true;
                },
                disabled: function () {
                    let redolist = app.player.getRedoList(true /* only first*/ );
                    return !redolist || (redolist.count === 0);
                },
            }],
        },
        order: 10,
        grouporder: 10,
    }, {
        action: actions.nowplaying.undo,
        order: 20,
        grouporder: 10,
    }, {
        action: actions.nowplaying.redo,
        order: 30,
        grouporder: 10,
    }, {
        action: actions.nowplaying.clear,
        order: 10,
        grouporder: 20,
    }, {
        action: actions.nowplaying.cleanInaccessible,
        order: 20,
        grouporder: 20,
    }, {
        action: actions.nowplaying.removeDuplicates,
        order: 30,
        grouporder: 20,
    }, {
        action: actions.nowplaying.reverseList,
        order: 50,
        grouporder: 20,
    }, {
        action: actions.savePlaylistFromNowPlaying,
        order: 10,
        grouporder: 50
    }, {
        action: actions.autoDJ,
        order: 20,
        grouporder: 50,
    }, {
        action: {
            title: _('Layout') + '...',
            icon: 'options',
            execute: function () {
                window.uitools.showOptions('pnl_LayoutPlaying');
            },
            visible: window.uitools.getCanEdit,
        },
        order: 10,
        grouporder: 100,
    }, {
        action: {
            title: function () {
                return _('Options') + ' (' + _('Playing') + ')...';
            },
            icon: 'options',
            execute: function () {
                window.uitools.showOptions('pnl_AutoDJ');
            },
            visible: window.uitools.getCanEdit
        },
        order: 20,
        grouporder: 100,
    }
];

/**
Container for 'Playing' list with menu button.

@class PlayingListContainer
@constructor
@extends Control
*/
class PlayingListContainer extends Control {
    layout: string;
    _menuButtonWidth: number;
    statusbar: HTMLDivElement;
    lvDiv: ElementWith<NowPlayingTracklist>;

    initialize(rootelem, params) {
        super.initialize(rootelem, params);
        let _this = this;
        this.helpContext = 'Now Playing';
        this.container.setAttribute('data-hideInFullWindowMode', '1');
        this.container.classList.add('flex');
        this.container.classList.add('column');
        this.setUpHeader();
        this.requestFrame(function () { // to avoid reinserting control during restoreState
            if (!this.lvDiv) {
                this.layout = 'simplifiedList'; // default layout
                this.insertListControl();
            }
        }.bind(this));
        this.localListen(window, 'panelstate', function (e) {
            if (e.detail.panelID === 'nowplayinglistContainer') {
                if (this.lvDiv && this.lvDiv.controlClass && isFunction(this.lvDiv.controlClass.scrollToCurrentTrack)) {
                    this.lvDiv.controlClass.scrollToCurrentTrack();
                }
            }
        }.bind(this));
        this.localListen(window, 'viewrefresh', function (e) {
            if (this.lvDiv && this.lvDiv.controlClass && isFunction(this.lvDiv.controlClass.doRefresh)) {
                this.lvDiv.controlClass.doRefresh();
            }
        }.bind(this));
    }

    setUpHeader() {
        // place menu button to the top left, with higher z-order, to be above header of the underlying control
        let undoIcon = '';
        let redoIcon = '';
        loadIcon('undo', function (iconData) {
            undoIcon = iconData;
        });
        loadIcon('redo', function (iconData) {
            redoIcon = iconData;
        });
        let _this = this;   

        let layoutSubmenuItems = function () {
            let menuItems = [];
            let layouts = getSortedAsArray(window.playingListLayouts);
            for (let i = 0; i < layouts.length; i++) {
                let l = layouts[i];
                let item : MenuItem = {
                    title: l.title,
                    key: l.key,
                    //checkable: true,
                    checked: function () {
                        return (_this.layout === this.key);
                    },
                    radiogroup: 'playinglistlayout',
                    execute: function () {
                        _this.layout = this.key;
                        _this.insertListControl();
                    },
                    statusbar: l.statusbar
                };
                if (isFunction(l.options)) {
                    item.hotlinkIcon = 'options';
                    item.hotlinkExecute = function () {
                        if (this.lvDiv)
                            l.options(this.lvDiv);
                    }.bind(_this);
                }
                menuItems.push(item);
            }
            return menuItems;
        };

        this.dockMenuItems = {
            title: _('Layout'),
            icon: 'customize',
            submenu: layoutSubmenuItems,
            visible: () => {
                return !window.settings.UI.disableRepositioning;
            }
        };

        let headerMenuBtn = document.createElement('div');
        headerMenuBtn.className = 'lvHeaderSingleItem alignleft aligntop playingContainerBtn';
        headerMenuBtn.style.zIndex = '99';
        headerMenuBtn.setAttribute('data-hideInFullWindowMode', '1');        
        this.container.appendChild(headerMenuBtn);
        if (window.settings.UI.hideMenu)
            setVisibility(headerMenuBtn, false);
        
        let getListCtrl = () => {
            if(this.lvDiv)
                return this.lvDiv.controlClass;
            else
                return this;
        };

        headerMenuBtn.controlClass = new MenuButton(headerMenuBtn, {
            menuArray: window.playingListMenuItems.concat([
                {
                    action: bindAction(actions.saveNewOrder, getListCtrl),
                    order: 5,
                    grouporder: 20
                }])
        });
        
        this._menuButtonWidth = getFullWidth(headerMenuBtn) - 6; // used for passing min widths of columns, TODO: better compute min size from @horizontalResizeSize and paddings/margins/border

        this.localListen(settings.observer, 'change', () => {
            setVisibility(headerMenuBtn, !(window.settings.UI.canReorder == false));   
        });
    }

    insertListControl() {
        if (this.lvDiv) {
            if (this.lvDiv.controlClass)
                this.lvDiv.controlClass.storePersistentStates();
            cleanElement(this.lvDiv);
        } else {
            this.lvDiv = document.createElement('div') as ElementWith<NowPlayingTracklist>;
            this.lvDiv.className = 'nplist fill';
            this.container.appendChild(this.lvDiv);
        }

        if (this.statusbar) {
            removeElement(this.statusbar);
            this.statusbar = undefined;
        }

        let layout = window.playingListLayouts[this.layout];
        if (!layout) {
            this.layout = 'simplifiedList';
            layout = window.playingListLayouts[this.layout];
        }
        if (layout.statusbar) {
            this.statusbar = document.createElement('div');
            this.statusbar.setAttribute('data-control-class', 'Statusbar');
            this.statusbar.setAttribute('data-init-params', '{listener: "' + this.container.getAttribute('data-id') + '", alwaysVisible: true}');
            this.container.appendChild(this.statusbar);
            initializeControl(this.statusbar);
        }
        requirejs(layout.req);
        let cls = window[layout.controlClass];
        layout.controlClass_initParams = layout.controlClass_initParams || {};
        layout.controlClass_initParams.columnMinWidth = this._menuButtonWidth; // @ts-ignore
        this.lvDiv.controlClass = new cls(this.lvDiv, layout.controlClass_initParams);
        this.lvDiv.controlClass.restorePersistentStates();
        this.requestFrame(() => {
            if (this.lvDiv && this.lvDiv.controlClass && isFunction(this.lvDiv.controlClass.scrollToCurrentTrack)) {
                this.lvDiv.controlClass.scrollToCurrentTrack();
            }
        });
        app.player.refreshStatus(); // get current status after possible change of control
        this.updateStatusbarVisibility();
    }

    storeState() {
        let state : ControlState = {};
        state.layout = this.layout;
        if (this.lvDiv && this.lvDiv.controlClass && this.lvDiv.controlClass.storeState) {
            state.layoutState = state.layoutState || {};
            state.layoutState[this.lvDiv.controlClass.constructor.name] = this.lvDiv.controlClass.storeState();
        }
        return state;
    }

    restoreState(state) {
        if (state && state.layout && (this.layout !== state.layout)) {
            this.layout = state.layout;
            this.insertListControl();
        }
        if (state && state.layoutState && this.lvDiv && this.lvDiv.controlClass && this.lvDiv.controlClass.restoreState) {
            let st = state.layoutState[this.lvDiv.controlClass.constructor.name];
            if (st) {
                this.lvDiv.controlClass.restoreState(st);
            }
        }
    }
    
    onShow() {
        if (this.lvDiv && this.lvDiv.controlClass && isFunction(this.lvDiv.controlClass.scrollToCurrentTrack)) {
            this.lvDiv.controlClass.scrollToCurrentTrack();
        }
    }

    updateStatusbarVisibility(vis?) {
        if (this.statusbar) {
            if (vis === undefined) {
                let plsett = app.getValue('Playing_options', {
                    statusbar: true
                });
                vis = plsett.statusbar;
            }
            setVisibility(this.statusbar, vis);
        }
    }

    cleanUp() {
        this.statusbar = undefined;
        this.lvDiv = undefined;
        super.cleanUp();
    }

}
registerClass(PlayingListContainer);
