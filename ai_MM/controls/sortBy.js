/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

registerFileImport('controls/sortBy');
'use strict';
/**
@module UI
*/
import Control from './control';
let defaultAlbumsSorting = [{
        id: 'album',
        title: function () {
            return _('Album');
        },
        sql: 'Albums.album',
        sortString: 'title ASC, id ASC'
    }, {
        id: 'year',
        title: function () {
            return _('Date');
        },
        sql: 'Albums.year',
        sortString: 'year ASC, id ASC'
    }, {
        id: 'artist',
        title: function () {
            return _('Album Artist');
        },
        sql: 'Albums.artist',
        sortString: 'artist ASC, id ASC'
    }, {
        id: 'popularity',
        title: function () {
            return _('Popularity');
        },
        sql: 'Songs.playcounter DESC, Songs.rating DESC, Songs.LastTimePlayed DESC, Songs.DateAdded DESC'
    }];
let defaultArtistsSorting = [{
        id: 'artist',
        title: function () {
            return _('Name');
        },
        sql: 'Artists.artist'
    }, {
        id: 'popularity',
        title: function () {
            return _('Popularity');
        },
        sql: 'Songs.playcounter DESC, Songs.rating DESC, Songs.LastTimePlayed DESC, Songs.DateAdded DESC'
    }];
/**
Base class for Sort By control.

@class SortBy
@constructor
@extends Control
*/
export default class SortBy extends Control {
    initialize(elem, params) {
        super.initialize(elem, params);
        this.container.classList.add('sortBy');
        this.container.innerHTML =
            _('Sort by') + ':' +
                '<label data-id="SortByLbl" class="clickable"></label>' +
                '<div data-control-class="Dropdown" data-init-params="{readOnly: true}" data-id="SortBy" style="display: none"></div>';
        initializeControls(this.container);
        this.UI = getAllUIElements(this.container);
        let UI = this.UI;
        let _this = this;
        params = params || {};
        this.sortType = params.sortType || 'album';
        // fill sorting
        this.sortingItems = [];
        let defaultSorting;
        switch (this.sortType) {
            case 'album':
                defaultSorting = defaultAlbumsSorting;
                break;
            case 'artist':
                defaultSorting = defaultArtistsSorting;
                break;
        }
        for (let i = 0; i < defaultSorting.length; i++) {
            if (!params.useSortIDs || inArray(defaultSorting[i].id, params.useSortIDs))
                this.sortingItems.push(defaultSorting[i]);
        }
        let ds = newStringList(true);
        for (let i = 0; i < this.sortingItems.length; i++) {
            if (!params.onlyWithSortString || this.sortingItems[i].sortString)
                ds.add(resolveToValue(this.sortingItems[i].title, ''));
        }
        let dropdownCls = UI.SortBy.controlClass;
        dropdownCls.dataSource = ds;
        let sortIdx = 0;
        if (params.sortID) {
            sortIdx = this.getIndexByID(params.sortID);
        }
        dropdownCls.focusedIndex = sortIdx;
        UI.SortByLbl.innerText = dropdownCls.value;
        let setComboVisibility = function (show) {
            if (!show) {
                if (dropdownCls.isDropdownOpen())
                    dropdownCls.closeDropdown();
            }
            setVisibilityFast(UI.SortByLbl, !show);
            setVisibilityFast(UI.SortBy, show);
        };
        this.localListen(UI.SortByLbl, 'click', function (e) {
            _this.requestFrame(function () {
                setComboVisibility(true);
                dropdownCls.setAutoWidth();
                dropdownCls.focus();
                dropdownCls.openDropdown();
            });
            e.stopPropagation();
        });
        this.localListen(UI.SortBy, 'popupclosed', function () {
            setComboVisibility(false);
        });
        this.localListen(UI.SortBy, 'change', function () {
            UI.SortByLbl.innerText = dropdownCls.value;
            _this.raiseEvent('change', {}, false, true /* bubbles */);
        });
        addEnterAsClick(this, UI.SortByLbl);
    }
    getIndexByID(id) {
        let idx = 0;
        for (let i = 0; i < this.sortingItems.length; i++) {
            if (this.sortingItems[i].id === id) {
                idx = i;
                break;
            }
        }
        return idx;
    }
    storePersistentState() {
        return { id: this.id };
    }
    restorePersistentState(state) {
        this.id = state.id;
    }
    get index() {
        let idx = this.UI.SortBy.controlClass.focusedIndex;
        if (idx < 0)
            idx = 0;
        return idx;
    }
    /**
    Gets/sets sort ID

    @property id
    @type string
    */
    get id() {
        return this.sortingItems[this.index].id;
    }
    set id(value) {
        let idx = 0;
        for (let i = 0; i < this.sortingItems.length; i++) {
            if (this.sortingItems[i].id === value) {
                idx = i;
                break;
            }
        }
        this.UI.SortBy.controlClass.focusedIndex = idx;
    }
    /**
    Gets string for ORDER BY clause

    @property orderByString
    @type string
    */
    get orderByString() {
        return this.sortingItems[this.index].sql;
    }
    /**
    Gets sort string for sorting

    @property orderByString
    @type string
    */
    get sortString() {
        return this.sortingItems[this.index].sortString;
    }
}
registerClass(SortBy);
