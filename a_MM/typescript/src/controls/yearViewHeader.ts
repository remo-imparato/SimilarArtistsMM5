'use strict';

registerFileImport('controls/yearViewHeader');

import Control from './control';

/**
UI YearViewHeader element

@class YearViewHeader
@constructor
@extends rootelem
*/

export default class YearViewHeader extends Control {
    private _promises: AnyDict;
    UI: { [key: string]: HTMLElement; };
    private _ds: any;

    initialize(rootelem, params) {
        super.initialize(rootelem, params);
        let _this = this;

        this.container.innerHTML =
            '<div data-id="headerTitlePart" class="padding">' +
            '    <h2 data-id="headerTitle" class="inlineText noLeftPadding textSelectable verticalCenter"></h2>' +
            '    <div data-id="playButtons" class="inline verticalCenter">' +
            '        <div data-id="btnPlay" class="inline" data-icon="play" data-tip="Play normally" tabindex="0" data-control-class="ToolButton"></div>' +
            '        <div data-id="btnShuffle" class="inline" data-icon="shuffle" data-tip="Play shuffled" tabindex="0" data-control-class="ToolButton"></div>' +
            '        <div data-id="btnMenu" class="inline" data-icon="menu" tabindex="0" data-control-class="MenuButton"></div>' +
            '        <div data-id="btnProgress" class="inline toolbutton" data-control-class="SimpleTasksController" data-init-params="{delayMS: 500, disabled: true}"></div>' +
            '    </div>' +
            '</div>';
        this.container.classList.add('noOverflow');
        this.container.classList.add('relativeBase');
        this._promises = {};
        initializeControls(this.container);
        this.helpContext = 'Filelisting';

        this.UI = getAllUIElements(this.container);
        let UI = this.UI;

        this.localListen(this.container, 'contextmenu', function () {
            window.lastFocusedControl = rootelem;
            window._lastFocusedLVControl = undefined; // so it always take this control for actions
        }, true);

        let playTracks = function (addParams) {
            let tds = _this.getTracklist();
            if (tds) {
                _this.localPromise(tds.whenLoaded()).then(function () {
                    app.player.addTracksAsync(tds.getCopy(), addParams);
                });
            }
        };

        this.localListen(UI.btnPlay, 'click', function () {
            playTracks({
                withClear: true,
                startPlayback: true
            });
        });
        addEnterAsClick(this, UI.btnPlay);

        uitools.addPlayButtonMenu(UI.btnPlay);

        this.localListen(UI.btnShuffle, 'click', function () {
            playTracks({
                withClear: true,
                startPlayback: true,
                shuffle: true
            });
        });
        addEnterAsClick(this, UI.btnShuffle);

        uitools.addShuffleButtonMenu(UI.btnShuffle);
        setVisibilityFast(UI.btnMenu, false); // not used yet
    }

    updateValues() {
        if (this.year) {
            if (this.year.title) {
                this.UI.headerTitle.innerText = this.year.title;
            } else {
                this.UI.headerTitle.innerText = _('Unknown');
            }
        } else
            this.UI.headerTitle.innerText = '';
    }

    getTracklist() {
        // get all tracks
        if (!this.year)
            return undefined;
        let pars : AnyDict = {};
        let sortString = nodeUtils.getBrowserTracksSortString();

        if (sortString) {
            if (sortString === 'playOrder ASC') {
                pars.topTracksSort = true;
            } else {
                pars.sortString = sortString;
            }
        } else {
            pars.sortString = (this.year.useOrigYear ? 'origDate' : 'date') + ' ASC;album ASC;order ASC;title ASC';
        }

        if (this._ds.cache && this._ds.cache.allTracks && !pars.topTracksSort) {
            if (pars.sortString) {
                this._ds.cache.allTracks.setAutoSortAsync(pars.sortString);
            }
            return this._ds.cache.allTracks;
        }
        this._ds.cache = this._ds.cache || {};
        this._ds.cache.allTracks = this.year.getTracklist(pars);
        return this._ds.cache.allTracks;
    }

    cleanUp() {
        for (let key in this._promises) {
            cancelPromise(this._promises[key]);
        }
        this._promises = {};
        this.dataSource = null; // needs to be here to unregister this._dataSourceChangeHandler
        this.UI = undefined;
        super.cleanUp();
    }
    
    get dataSource () {
        return this._ds;
    }
    set dataSource (value) {
        if (value === this._ds)
            return;
        if (value && this._ds && isFunction(value.isSame) && value.isSame(this._ds))
            return;

        this._ds = value;
        this.updateValues();
    }

    get year() {
        if (!this.dataSource)
            return undefined;
        return this.dataSource.dataObject;
    }
    
}
registerClass(YearViewHeader);
