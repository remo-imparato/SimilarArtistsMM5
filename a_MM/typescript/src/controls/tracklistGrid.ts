'use strict';

registerFileImport('controls/tracklistGrid');

import TrackListView from './trackListView';
import '../actions';
import Control from './control';

/**
@module UI
*/



/**
Simple tracklist UI element

@class TracklistGrid
@constructor
@extends TrackListView
*/

export default class TracklistGrid extends TrackListView {
    mainColumnWidth: number;    
    private _trackButtons: any;
    _lastHoverIndex: number;
    hideTrackNumber: any;

    initialize(rootelem, params) {
        super.initialize(rootelem, params);
        rootelem.classList.add('tracklistGrid'); // to allow specific styling        
        this.showHeader = false;
        this.isSearchable = true;
        this.isGrid = true;
        this.isHorizontal = true;
        this.canScrollHoriz = false; // there's no horizontal scrollbar, needed to correctly align
        this.itemCloningAllowed = false;
        this.registerEventHandler('datasourcechanged');
        this.mainColumnWidth = 25 * fontSizePx();
        this.itemRowSpacing = 2 * fontSizePx();
        this._trackButtons = null;
        this._lastHoverIndex = -1;
        this.localListen(app.player, 'playbackState', function (state) {
            if (state === 'trackChanged') {
                this.rebind();
            }
        }.bind(this));
    }

    cleanUp() {
        super.cleanUp();
        this.unregisterEventHandler('datasourcechanged');
    }

    handle_datasourcechanged(e) {
        if (e.detail.newDataSource) {
            this.autoSortString = e.detail.newDataSource.autoSortString;
        } else {
            this.autoSortString = '';
        }
    }

    setUpDiv(div) {
        div.classList.add('rowHeight1line');
        div.style.width = this.mainColumnWidth + 'px';
        div.controlClass = div.controlClass || new Control(div, {noFocusOnClick: true /*#19592*/}); // to allow localListen etc.
        //div.setAttribute('data-cond-class', '{itemNowPlaying: \'item.isPlaying\'}');
        div.setAttribute('data-cond-class', '{itemNowPlaying: \'item.isPlaying\', itemInaccessible: \'(item.getIsPlayable && !item.getIsPlayable())\'}');
        div.innerHTML =
            '<div class="flex fill column">' +
            '  <div class="flex fill row">' +
            (this.hideTrackNumber ? '' : '    <div data-show-if="item.trackNumber!==\'\'" class="flex column paddingColumnSmall">' +
                '      <div data-id="lblTrackNum" data-bind="text: trackFormat.trackNumber" class="textEllipsis semitransparent"></div>' +
                '    </div>') +
            '    <div data-id="titleDiv" class="dynamic textEllipsis">' +
            '      <span data-id="lblTitle" data-bind="text: trackFormat.title"></span>' +
            '      <span data-show-if="(item.artist !== item.albumArtist) && item.artist" data-id="lblArtist" class="paddingColumnSmall semitransparent dynamicShrink">(<span data-bind="text: trackFormat.artist"></span>)</span>' +
            '    </div>' +
            '    <div data-id="filler" class="fill">' +
            '    </div>' +
            '    <div data-minwidth-pattern="88:88:88" data-bind="func: templates.bookmarkFunc(div, item, el);"></div>' +
            '  </div>' +
            '</div>';
        templates.addEllipsisTooltip(qeid(div, 'titleDiv'), div);
        qeid(div, 'filler').style.flexGrow = '50'; // grow more, so title div will not have much space at the right
        let divCtrl = div.controlClass;
        
        const trackButtons = this.getTrackButtons();
        const fillerElem = qeid(div, 'filler');
        const row = fillerElem.parentElement;

        const handleCommands = (vis) => {
            if (vis) {
                row.insertBefore(trackButtons, fillerElem.nextSibling);
                this._lastHoverIndex = div.itemIndex;
            }
            else {
                if (row.contains(trackButtons)) {
                    row.removeChild(trackButtons);
                }
            }
        };
        
        // Playback in touch mode is handled by touchDefaultItemAction.
        // We want to hide onhover buttons in touch.
        divCtrl.localListen(div, 'touchstart', () => {
            handleCommands(false);
        });
        divCtrl.localListen(div, 'mouseenter', () => {
            if (!usingTouch) handleCommands(true);
        });
        divCtrl.localListen(div, 'mouseleave', () => {
            handleCommands(false);
        });

        templates.addImageGridSelectButton(div, true /* only for touch */ );
    }
    
    getTrackButtons() {
        // #19351 optimization: Instead of generating a play & menu button for each row of the tracklist,
        //  generate one and programmatically add/remove it depending on the row that's highlighted.
        
        if (!this._trackButtons) {
            // Create the reusable track buttons
            this._trackButtons = document.createElement('div');
            this._trackButtons.innerHTML = 
            '    <div data-id="playButtonDiv" class="visibleOnHover lvInlineIcon" data-icon="play" data-control-class="ToolButton" data-init-params="{noFocusOnClick: true}">' +
            '    </div>' +
            '    <div data-id="menuButtonDiv" class="visibleOnHover lvInlineIcon" data-tip="Menu" data-control-class="MenuButton" data-init-params="{noFocusOnClick: true, propagateEvtOnClick: true}">' +
            '    </div>';
            initializeControls(this._trackButtons);
            
            const btnPlay = qeid(this._trackButtons, 'playButtonDiv');
            const btnMenu = qeid(this._trackButtons, 'menuButtonDiv');
            
            const getTracklist = () => {
                if (this._lastHoverIndex < 0) return;
                
                let lst = app.utils.createTracklist(true);
                this.dataSource.locked(() => {
                    let index = this._lastHoverIndex;
                    if (index !== undefined) {
                        let item = this.dataSource.getValue(index);
                        if (item)
                            lst.add(item);
                    }
                });
                return lst;
            };
            
            let menuArray = [];

            // copy from tracklist menu, set tracklist for menu to our ds
            forEach(menus.tracklistMenuItems, function (mitem, idx) {
                let mitemN : AnyDict = {};
                let action = mitem.action;
                mitemN.order = mitem.order;
                mitemN.grouporder = mitem.grouporder;
                mitemN.action = {
                    title: action.title,
                    icon: action.icon,
                    actionType: action.actionType,
                    visible: action.visible,
                    disabled: false,
                    checked: action.checked,
                    checkable: action.checkable,
                    execute: action.execute,
                    getTracklist: getTracklist,
                    onlySelected: false,
                    shortcut: action.shortcut,
                    submenu: action.submenu
                };
                menuArray.push(mitemN);
            });

            btnMenu.controlClass.menuArray = menuArray;
            btnMenu.controlClass.parent = this.dataSource;
            
            btnPlay.controlClass.localListen(btnPlay, 'click', (e) => {
                if ((e.button !== 0) || e.shiftKey || e.ctrlKey || e.altKey)
                    return;
                let index = this._lastHoverIndex;
                if (index === undefined || index < 0)
                    return;
                let item;
                this.dataSource.locked(() => {
                    item = this.dataSource.getValue(index);
                });
                if (item) {
                    app.player.addTracksAsync(item, {
                        withClear: true,
                        startPlayback: true
                    });
                }
            });
        }
        return this._trackButtons;
    }

    bindData(div, index, item) {
        if (this.bindFn)
            this.bindFn(div, item);
    }


}
registerClass(TracklistGrid);
