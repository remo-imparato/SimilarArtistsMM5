'use strict';

import SearchEditor from './searchEditor';

registerFileImport('controls/filterEditor');

/**
@module UI
*/

/**
UI element to represent view filter editor

@class FilterEditor
@constructor
@extends SearchEditor
*/

export default class FilterEditor extends SearchEditor {
    hideNested: boolean;
    checkboxes: boolean;
    private __onTabChangeListenFunc: any;
    private _queryString: string;
    private _skipTheNextRefresh: boolean;

    initialize(rootelem, params) {
        super.initialize(rootelem, params);
        this.showLimits = false;
        this.showSortOrders = false;
        this.showCollection = false;
        this.hideNested = true;
        this.checkboxes = true;
        setVisibilityFast(this.container, false);
        let QD = app.db.getQueryDataSync('filter');
        this.setQueryData(QD);
        this._initViewChange();
        this._initTabChange();
        this._addButtons();
        
        this.localListen(app, 'settingschange', ()=> {
            let clearHistory = app.getValue('clearFilterHistory', false);
            if (clearHistory) {    
                app.setValue(this.getMRUListKey(), []);
                app.setValue('clearFilterHistory', false);
            }
        });
    }

    cleanUp() {
        if (this.QueryData && this.__onTabChangeListenFunc)
            app.unlisten(this.QueryData, 'change', this.__onTabChangeListenFunc);
        super.cleanUp();
    }

    getMRUListKey() {
        return 'FilterEditor_MRU_LIST';
    }

    _add2MRUList(QD) {
        return new Promise((resolve, reject) => {
            QD.getTextAsync().then((name) => {
                if (name != '') { // filter isn't empty
                    let lst = app.getValue(this.getMRUListKey(), []);
                    for (let i = 0; i < lst.length; i++) {
                        if (lst[i].name == name)
                            lst.delete(i); // delete the old one with same name
                    }
                    lst.insert(0, {
                        name: name,
                        data: QD.saveToString(), // old INI format
                        //dataJSON: QD.asJSON // new JSON format (disabled temporary because of #15106/6 - it requires DB access for [Artist equals list] thus cannot be called from JS thread)
                    });
                    if (lst.length > 30)
                        lst.length = 30;
                    app.setValue(this.getMRUListKey(), lst);
                }
                resolve(null);
            }, reject);
        });
    }

    _getMRUList() {
        return app.getValue(this.getMRUListKey(), []);
    }

    _generateMRUSubmenu() {
        let _this = this;
        return new Promise(function (resolve, reject) {
            let retval = [];
            let lst = _this._getMRUList();
            forEach(lst, function (item) {
                if (item.dataJSON)
                    return; // new JSON format (disabled temporary because of #15106/6 - it requires DB access for [Artist equals list] thus cannot be called from JS thread)
                retval.push({
                    title: item.name,
                    item: item,
                    execute: function () {
                        if (this.data)
                            _this.QueryData.loadFromString(this.data);
                        else
                        if (this.dataJSON)
                            _this.QueryData.asJSON = this.dataJSON;
                        _this.saveCurrentFilter(); // just to get it on the top of the MRU list
                        _this.refreshRules();
                    }.bind(item)
                });
            });

            if (retval.length > 0) {
                retval.push(menuseparator);
                retval.push({
                    title: _('Clear history'),
                    icon: 'delete',                    
                    execute: function () {
                        app.setValue(_this.getMRUListKey(), []);
                    }
                });
            }

            resolve(retval);
        });
    }

    _addButton(icon, className, dataControlClass, tip?) {
        let div = document.createElement('div');
        div.className = className;
        div.setAttribute('data-control-class', dataControlClass);
        div.setAttribute('data-icon', icon);
        let mainRow = qeid(this.container, 'mainRow');
        mainRow.appendChild(div);
        initializeControl(div);
        if (tip) // @ts-ignore
            div.controlClass.tip = tip;
        return div;
    }

    _addButtons() {
        let hideButton = this._addButton('upArrow', 'textRight', 'ToolButton', _('Hide editor'));
        this.localListen(hideButton, 'click', () => {
            setVisibility(this.container, false); // to hide the filter on view switch
        });
        let menuButton = this._addButton('menu', 'textRight', 'MenuButton');
        let items = [];
        let _this = this;
        items.push({
            title: _('Recently used'),
            icon: 'save',
            submenu: this._generateMRUSubmenu.bind(this)
        });
        items.push({
            title: _('Reset'),
            icon: 'filter_remove',
            execute: function () {
                _this.QueryData.clear();
                _this.refreshRules();
            }
        });
        items.push({
            title: _('Save as AutoPlaylist...'),
            icon: 'save',
            execute: async function () {
                let QD = _this.QueryData;
                let AP = app.playlists.root.newPlaylist();
                AP.name = QD.toString();
                AP.isAutoPlaylist = true;
                AP.queryData = QD.saveToString();
                await AP.commitAsync();                
                navigationHandlers['playlist'].navigate(AP);
            }
        });
        /*
        items.push({
            title: _('Load Preset...'),
            icon: 'openFile',
            execute: function () {
                var promise = app.utils.dialogOpenFile('', 'mmvf', _('MediaMonkey') + ' ' + _('file') + ' (*.mmvf)|*.mmvf', _('Select file to import'));
                promise.then(function (filename) {
                    if (filename != '') {
                        app.filesystem.loadTextFromFileAsync(filename).then(function (txt) {
                            _this.QueryData.loadFromString(txt);
                            _this.refreshRules();
                        });
                    }
                });
            }
        });
        items.push({
            title: _('Save Preset...'),
            icon: 'save',
            execute: function () {
                var promise = app.utils.dialogSaveFile('', 'mmvf', _('MediaMonkey') + ' ' + _('file') + ' (*.mmvf)|*.mmvf', _('Save as'));
                promise.then(function (filename) {
                    if (filename != '') {
                        app.filesystem.saveTextToFileAsync(filename, _this.QueryData.saveToString());
                    }
                });

            }
        });
        */    
        menuButton.controlClass.menuArray = items;
    }

    _isOnActiveTab() {
        let active = (this.container == actions.viewFilter._getEditor());
        return active;
    }

    storeState() {
        if (this._isOnActiveTab())
            this._saveStoredData();
        return {
            queryString: this._queryString
        };
    }

    restoreState(state, isCurrentTab?:boolean) {
        if (state && state.queryString) {
            if (this._queryString != state.queryString) {
                this._queryString = state.queryString;
                if (isCurrentTab)
                    this._loadStoredData();
            }
        }
    }

    _loadStoredData() {
        if (this.QueryData && this._isOnActiveTab() && this._queryString) {
            if (this._queryString.startsWith('[')) // old INI format
                this.QueryData.loadFromString(this._queryString);
            else
            if (this._queryString.startsWith('{')) {
                //this.QueryData.asJSON = this._queryString; // new JSON format (disabled temporary because of #15106/6 - it requires DB access for [Artist equals list] thus cannot be called from JS thread)
            }
            this.refreshRules();
            if (!this.filterActive())
                this._skipTheNextRefresh = true; // to resolve undesired refreshes on tab switch, see #19497
        }
    }

    _saveStoredData() {
        this._queryString = this.QueryData.saveToString(); // old INI format
        //this._queryString = this.QueryData.asJSON; // new JSON format (disabled temporary because of #15106/6 - it requires DB access for [Artist equals list] thus cannot be called from JS thread)
    }

    _tabActivated() {
        if (this.__onTabChangeListenFunc) // already activated
            return;
        
        this.__onTabChangeListenFunc = app.listen(this.QueryData, 'change', function () {
            this.requestTimeout(() => {
                if (this._skipTheNextRefresh) {
                    this._skipTheNextRefresh = false;
                    return; // to resolve undesired refreshes on tab switch, see #19497
                }
                actions.view.refresh.execute();
            }, 200, '_viewFilterUpdateTm');
        }.bind(this));
        this._loadStoredData();
    }

    _tabDeactivated() {
        if (!this.__onTabChangeListenFunc)
            return; // _tabActivated id in requestFrame below, so it might not be called yet when fast closing tabs (pressing Ctrl+F4)        
        this._saveStoredData();
        app.unlisten(this.QueryData, 'change', this.__onTabChangeListenFunc);
        this.__onTabChangeListenFunc = null;
    }

    _initTabChange() {
        this._loadStoredData();
        this.localListen(document.body, 'maintabchange', (e) => {
            let isActive = this._isOnActiveTab();
            if (!isActive)
                this._tabDeactivated();
            else
                this.requestFrame(this._tabActivated.bind(this), '_tabActivated');
        });
    }

    _initViewChange() {

        this.localListen(document.body, 'viewchange', (e) => {

            if (!this._isOnActiveTab())
                return;

            let view_in = e.detail.income.view;
            let view_out = e.detail.outcome.view;

            if (view_in != view_out) {

                if (isVisible(this.container)) {
                    //setVisibility(this.container, false); // to hide the filter on view switch
                    this.saveCurrentFilter();
                    this.closeEditing();
                }

                let c_in = nodeUtils.getNodeCollection(view_in.viewNode);
                if (view_out) {
                    if (this.QueryData.conditions.count > 0) // to not occupy persistent.json unnecessarily
                        view_out.controlsState['viewFilter'] = this.storeState();
                    else
                        view_out.controlsState['viewFilter'] = null; // #12371 - items j&m
                    // discard per [#14122 ~47614] and [#12371 - item f]
                    let c_out = nodeUtils.getNodeCollection(view_out.viewNode);
                    let isSameCollection = (c_out && c_in && c_out.persistentID == c_in.persistentID);
                    if (!isSameCollection)
                        this.discard();
                }
                if (c_in)
                    this._setCollectionFieldNames(c_in); // to have the correct text for cross-collection fields (e.g. 'Album/Series/Podcast' -> 'Album' in case of Music)

                if (view_in.controlsState['viewFilter'])
                    this.restoreState(view_in.controlsState['viewFilter']); // per item 1) in #14293
            }
        });
    }

    _setCollectionFieldNames(collection) {
        let QD = this.QueryData;
        if (QD) {
            QD.dontNotify = true; // changing the collection just for the field names to adjust
            this.qChild('cbCollection').controlClass.value = collection.name;
            QD.dontNotify = false;
        }
    }

    loadLastFilter() {
        let lst = this._getMRUList();
        if (lst.length > 0) {
            let item = lst[0];
            if (item.data)
                this.QueryData.loadFromString(item.data);
            //else
            //    this.QueryData.asJSON = item.dataJSON; // new JSON format (disabled temporary because of #15106/6 - it requires DB access for [Artist equals list] thus cannot be called from JS thread)
            this.refreshRules();
        }
    }

    saveCurrentFilter() {
        let QD = this.QueryData.getCopy();
        return this._add2MRUList(QD);
    }

    filterActive() {
        return (this.QueryData.conditions.count > 0);
    }

    discard() {
        if (this.filterActive()) { // to not call 'change' when the filter was already discarded            
            this.saveCurrentFilter();
            this.QueryData.conditions.clear();
            this._queryString = '';
        }
        this.closeEditing();
        if (isVisible(this.container))
            setVisibility(this.container, false);
    }

}
registerClass(FilterEditor);
