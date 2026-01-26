/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

const
    SEARCH_WORD_PREFIX = 0,
    SEARCH_WORD_INFIX = 1;

optionPanels.pnl_Library.subPanels.pnl_Search.load = function (sett) {

    qid('lblContSearch').innerText = _('When typing in a view:');

    let LV = qid('lvSearchFieldsList');
    LV.controlClass.showHeader = false;
    LV.controlClass.isSortable = false;
    LV.controlClass.multiselect = false;

    let columns = new Array();
    columns.push({
        order: 1,
        headerRenderer: GridView.prototype.headerRenderers.renderCheck,
        setupCell: GridView.prototype.cellSetups.setupCheckbox,
        bindData: GridView.prototype.defaultBinds.bindCheckboxCell
    });
    columns.push({
        order: 2,
        bindData: function (div, item, index) {
            div.innerText = item.toString();
        }
    });
    LV.controlClass.setColumns(columns);

    LV.controlClass.dataSource = app.settings.utils.getSearchFields();
    
    let cb = qid('cbSearchMode');

    let list = newStringList();
    list.add(_('Ignore diacritics') + ' / ' + _('Match beginning of words') + ' (' + _('faster') + ')');
    list.add(_('Ignore diacritics') + ' / ' + _('Search whole words only') + ' (' + _('faster') + ')');
    list.add(_('Respect diacritics') + ' / ' + _('Match within words'));
    list.add(_('Respect diacritics') + ' / ' + _('Search whole words only'));
    cb.controlClass.dataSource = list;

    if (sett.Options.SearchMode == SEARCH_WORD_PREFIX) {
        if (sett.Options.SearchWholeWordsOnly)
            cb.controlClass.focusedIndex = 1;
        else
            cb.controlClass.focusedIndex = 0;
    } else {
        if (sett.Options.SearchWholeWordsOnly)
            cb.controlClass.focusedIndex = 3;
        else
            cb.controlClass.focusedIndex = 2;
    }

    list = newStringList();
    list.add(_('Filters matches'));
    list.add(_('Scrolls to match') + ' (' + _('primary sort field') + ')');
    list.add(_('Scrolls to match') + ' (' + _('all fields') + ')');
    list.add(_('Take no action'));
    qid('cbContextualSearchMode').controlClass.dataSource = list;

    let state = app.getValue('search_settings', {
        contextualSearchMode: 0
    });
    if (state.ignoreTypingInView)
        qid('cbContextualSearchMode').controlClass.focusedIndex = 2;
    else
        qid('cbContextualSearchMode').controlClass.focusedIndex = state.contextualSearchMode;

    let chb = qid('confirmByEnterKey');
    if (state.confirmByEnterKey)
        chb.controlClass.checked = true;
    else    
        chb.controlClass.checked = false;

    localListen(qid('btnClearHistory'), 'click', () => {
        app.setValue('clearFilterHistory', true);
        app.setValue('clearSearchBarHistory', true);
    });
    addEnterAsClick(window, qid('btnClearHistory'));
}

optionPanels.pnl_Library.subPanels.pnl_Search.save = function (sett) {

    app.settings.utils.setSearchFields(qid('lvSearchFieldsList').controlClass.dataSource);

    let fi = qid('cbSearchMode').controlClass.focusedIndex;
    if (fi == 0) {
        sett.Options.SearchWholeWordsOnly = false;
        sett.Options.SearchMode = SEARCH_WORD_PREFIX;
    } else
    if (fi == 1) {
        sett.Options.SearchWholeWordsOnly = true;
        sett.Options.SearchMode = SEARCH_WORD_PREFIX;
    } else
    if (fi == 2) {
        sett.Options.SearchWholeWordsOnly = false;
        sett.Options.SearchMode = SEARCH_WORD_INFIX;
    } else
    if (fi == 3) {
        sett.Options.SearchWholeWordsOnly = true;
        sett.Options.SearchMode = SEARCH_WORD_INFIX;
    }

    let contextSearchMode = 0;
    let fIdx = qid('cbContextualSearchMode').controlClass.focusedIndex;
    if (fIdx == 1)
        contextSearchMode = 1;
    if (fIdx == 2)
        contextSearchMode = 2;    
    
    app.setValue('search_settings', {
        contextualSearchMode: contextSearchMode,
        ignoreTypingInView: (fIdx == 3),
        confirmByEnterKey: qid('confirmByEnterKey').controlClass.checked
    });
}
