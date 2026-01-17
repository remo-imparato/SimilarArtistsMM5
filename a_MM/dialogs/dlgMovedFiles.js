/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

requirejs("controls/gridview");
requirejs("controls/checkbox");
requirejs("controls/columntracklist");

let automaticallyUpdateMovedFiles = false,
    foundList = null,
    sameList = null,
    notList = null,
    locatedList = null,
    unlocatedList = null;

function init(params) {

    resizeable = true;
    title = _('Locate moved/missing files');

    automaticallyUpdateMovedFiles = params.scanRes.automaticallyUpdateMovedFiles;
    foundList = params.scanRes.foundList;
    sameList = params.scanRes.sameList;
    notList = params.scanRes.notList;
    checkedList = params.scanRes.checkedList;

    ODS(sprintf('LMMF results in dlg: found: %d, same %d, unlocated: %d, checked: %d', foundList.count, sameList.count, notList.count, checkedList.count));

    // preset list views
    let assignDataList = function (listView, data) {
        let lv = qid(listView);
        lv.controlClass.data = data;
        lv.controlClass.dataSource = lv.controlClass.data;
        lv.controlClass.invalidateAll();
    }

    foundList.setAllChecked(true); // #15604
    assignDataList('lvLocatedList', foundList);
    assignDataList('lvUnmovedList', sameList);
    assignDataList('lvUnlocatedList', notList);

    // initialize tabs
    let tabs = qid('tabs');

    function selecttab(tab, oldtab) {
        if (oldtab)
            setVisibility(qid(oldtab), false, {
                animate: true
            });
        setVisibility(qid(tab), true, {
            animate: true
        });
    }

    window.localListen(tabs, 'selected', function (e) {
        let oldTab;
        if (e.detail.oldTabIndex >= 0)
            oldTab = tabs.controlClass.items[e.detail.oldTabIndex].getAttribute('tabname');
        selecttab(tabs.controlClass.items[e.detail.tabIndex].getAttribute('tabname'), oldTab);
    });
    tabs.controlClass.selectedIndex = 0;

    window.localListen(qid('btnUpdate'), 'click', function () {
        qid('btnUpdate').controlClass.disabled = true;

        let ar = [];

        if (qid('ChBUpdateTracks').controlClass.checked) {
            locatedList = foundList.getCheckedList();
            ar.push(locatedList.whenLoaded());
        }
        if (qid('ChBRemoveTracks').controlClass.checked) {
            unlocatedList = notList.getCheckedList();
            ar.push(unlocatedList.whenLoaded());
        }

        window.localPromise(whenAll(ar)).then(function () {
            modalResult = 1;
        });
    });
}

function getData() {

    let ret = {};

    if (qid('ChBUpdateTracks').controlClass.checked) {
        ret.locatedList = locatedList;
    }
    if (qid('ChBRemoveTracks').controlClass.checked) {
        ret.unlocatedList = unlocatedList;
    }

    return ret;
}
window.getData = getData;

// myLocatedListView --------------------------------------------
class myLocatedListView extends ColumnTrackList {
    initialize(element) {
        super.initialize(element);

        let tracksList = this;
        this.showHeader = true;

        this.defaultColumns = new Array();
        this.defaultColumns.push({
            visible: true,
            title: '',
            isSortable: false,
            order: 1,
            headerRenderer: ColumnTrackList.prototype.headerRenderers.renderCheck,
            setupCell: ColumnTrackList.prototype.cellSetups.setupCheckbox,
            bindData: ColumnTrackList.prototype.defaultBinds.bindCheckboxCell
        });
        this.defaultColumns.push({
            visible: true,
            title: _('Artist'),
            width: 180,
            order: 2,
            bindData: function (div, item) {
                div.innerText = item.SD.artist;
            },
            columnType: 'artist',
        });
        this.defaultColumns.push({
            visible: true,
            title: _('File'),
            width: 180,
            order: 3,
            bindData: function (div, item) {
                div.innerText = item.SD.title;
            },
            columnType: 'title',
        });
        this.defaultColumns.push({
            visible: true,
            title: _('New Path'),
            width: 280,
            order: 4,
            bindData: function (div, item) {
                div.innerText = item.newPath;
            },
        });
        this.defaultColumns.push({
            visible: true,
            title: _('Old Path'),
            width: 280,
            order: 5,
            bindData: function (div, item) {
                div.innerText = item.SD.path;
            },
            columnType: 'path',
        });
        this.setColumns(this.defaultColumns);
    }
}
registerClass(myLocatedListView);

// myUnmovedListView --------------------------------------------
class myUnmovedListView extends ColumnTrackList {
    initialize(element) {
        super.initialize(element);

        let tracksList = this;
        this.showHeader = true;

        this.defaultColumns = new Array();
        this.defaultColumns.push({
            visible: true,
            title: _('Artist'),
            width: 180,
            order: 1,
            bindData: function (div, item) {
                div.innerText = item.SD.artist;
            },
            columnType: 'artist',
        });
        this.defaultColumns.push({
            visible: true,
            title: _('File'),
            width: 180,
            order: 2,
            bindData: function (div, item) {
                div.innerText = item.SD.title;
            },
            columnType: 'title',
        });
        this.defaultColumns.push({
            visible: true,
            title: _('Path'),
            width: 280,
            order: 3,
            bindData: function (div, item) {
                div.innerText = item.SD.path;
            },
            columnType: 'path',
        });
        this.setColumns(this.defaultColumns);
    }
}
registerClass(myUnmovedListView);

// myUnlocatedListView --------------------------------------------
class myUnlocatedListView extends ColumnTrackList {
    initialize(element) {
        super.initialize(element);
        
        let tracksList = this;
        this.showHeader = true;

        this.defaultColumns = new Array();
        this.defaultColumns.push({
            visible: true,
            title: '',
            isSortable: false,
            order: 1,
            headerRenderer: ColumnTrackList.prototype.headerRenderers.renderCheck,
            setupCell: ColumnTrackList.prototype.cellSetups.setupCheckbox,
            bindData: ColumnTrackList.prototype.defaultBinds.bindCheckboxCell
        });
        this.defaultColumns.push({
            visible: true,
            title: _('Artist'),
            width: 180,
            order: 2,
            bindData: function (div, item) {
                div.innerText = item.SD.artist;
            },
            columnType: 'artist',
        });
        this.defaultColumns.push({
            visible: true,
            title: _('File'),
            width: 180,
            order: 3,
            bindData: function (div, item) {
                div.innerText = item.SD.title;
            },
            columnType: 'title',
        });
        this.defaultColumns.push({
            visible: true,
            title: _('Path'),
            width: 280,
            order: 4,
            bindData: function (div, item) {
                div.innerText = item.SD.path;
            },
            columnType: 'path',
        });
        this.setColumns(this.defaultColumns);
    }
}
registerClass(myUnlocatedListView);

window.windowCleanup = function () {
    foundList = null,
    sameList = null,
    notList = null,
    locatedList = null,
    unlocatedList = null;
}
