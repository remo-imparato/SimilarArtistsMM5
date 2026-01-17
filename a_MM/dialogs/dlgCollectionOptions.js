/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

/*
requirejs('controls/columntracklist');
requirejs('controls/searchEditor');
requirejs('controls/button');
requirejs('controls/columntracklist');
requirejs('controls/listview');
requirejs('helpers/views');
requirejs('helpers/arrayDataSource');
requirejs('controls/itemsListView');
requirejs('viewHandlers');
*/

let collectionitem = null;
let UI = null;
let nodes = null;
let inchange = false;
let viewData = null;
let multiView = null;
let tree = null;
let allViewsList;

function checkRoot() {
    if (!tree) {
        tree = app.createTree();
        tree.root.dataSource = collectionitem;
        tree.root.handlerID = 'collection';
    }
}

function createViewData(dataSource, dataType) {
    checkRoot();
    return createViewDataFromNode(node);
}

function createViewDataByPathAsync(path) {
    checkRoot();
    return tree.root.addChild(collectionitem, path);
}

function createViewDataFromNode(node) {
    let tab = app.dialogs.getMainWindow().getValue('currentTabControl');
    if (tab) {
        let historyObj = tab.history;
        return historyObj.createViewData({
            node: node
        });
    }
    return null;
}

function init(params) {

    collectionitem = params.item.getCopy();

    title = _('Collection Options');
    resizeable = true;

    window.views.saveCurrentView();

    checkRoot();
    viewData = createViewDataFromNode(tree.root);

    let div = document.createElement('div');
    div.setAttribute('data-control-class', 'Multiview');
    div.style.visibility = 'none';
    div.style.maxWidth = '0px';
    div.style.position = 'absolute';
    div.style.left = '-10000px';
    document.body.appendChild(div);
    initializeControl(div);
    multiView = div.controlClass;

    multiView.getPersistentStateRootKey = function () {
        return this.getPersistentStateRootKeyBase();
    };


    UI = getAllUIElements();

    let ds = newStringList();
    ds.add(_('Disabled'));
    ds.add(_('Visible always'));
    ds.add(_('Visible if content exists'));

    UI.edtName.controlClass.value = collectionitem.name;
    if (params.isNew)
        UI.edtName.controlClass.focus();
    UI.edtComment.controlClass.value = collectionitem.description;
    UI.cbVisible.controlClass.dataSource = ds;


    let checkClick = function (e) {
        if (!inchange) {
            inchange = true;
            let idx = UI.cbVisible.controlClass.focusedIndex;
            collectionitem.visibleInMainTree = idx;

            visibleUpdate();
            inchange = false;
        }
    }

    let visibleUpdate = function () {
        UI.cbVisible.controlClass.focusedIndex = collectionitem.visibleInMainTree;
    }
    visibleUpdate();

    window.localListen(UI.cbVisible, 'change', checkClick);
    setVisibility(UI.visibleRow, !params.fromOptions);

    if ((collectionitem.id == -1) && (!params.isNew)) { // Entire Library
        UI.tabs.controlClass.closeTab(UI.tabs.controlClass.items[0]);
        UI.edtName.controlClass.disabled = true;
        UI.edtComment.controlClass.disabled = true;
    }

    // initialize shared views (TODO ?)
    /*
    let usedList = collectionitem.fillSharedViewList();
    usedList.whenLoaded().then(function () {
        let sharedText = '';
        if (usedList.count) {
            usedList.forEach(function (itm) {
                if (sharedText) {
                    sharedText = sharedText + ', ';
                }
                sharedText = sharedText + itm.name;
            });
        } else {
            sharedText = 'none';
        }
        UI.lblShareFrom.innerText = sharedText;
    }); */

    let LV = UI.lvTreeNodes;
    LV.controlClass.listCheckTipChecked = _('Visible always');
    LV.controlClass.listCheckTipUnchanged = _('Disabled');
    LV.controlClass.listCheckTipIndeterminate = _('Visible if content exists');
    LV.controlClass.showHeader = true;
    LV.controlClass.isSortable = false;
    LV.controlClass.multiselect = false;
    LV.controlClass.enableDragNDrop();
    let columns = new Array();
    columns.push({
        visible: true,
        title: '',
        width: 30,
        order: 1,
        headerRenderer: ColumnTrackList.prototype.headerRenderers.renderCheck,
        setupCell: ColumnTrackList.prototype.cellSetups.setupCheckbox,
        bindData: ColumnTrackList.prototype.defaultBinds.bindCheckboxCell,
    });
    columns.push({
        visible: true,
        title: _('Name'),
        width: 480,
        order: 2,
        bindData: function (div, item) {
            let title = resolveToValue(nodeHandlers[item].title, '');
            let tooltip = resolveToValue(nodeHandlers[item].tooltip, '');
            if (tooltip)
                title = title + ' (' + tooltip + ')';
            div.innerText = title;
        }
    });
    LV.controlClass.setColumns(columns);

    // initialize nodes
    let collectionNodes = newStringList();
    nodes = nodeHandlers.collection.getConfiguredNodes(collectionitem);
    collectionNodes.modifyAsync(function () {
        for (let i = 0; i < nodes.length; i++) {
            let node = nodes[i];
            collectionNodes.add(resolveToValue(node.id, ''));
            let isVisible = resolveToValue(node.visible, true);
            collectionNodes.setChecked(i, isVisible);
        }
    });
    collectionNodes.notifyLoaded();

    /*let editNode = function (node) {
        tree.focusedNode = node;
        let vd = createViewDataFromNode(node);
        
        if (!window.views.canBeConfigured(vd))
            return;
        
        let state = nodeUtils.getNodeHandlerState(vd);
        let currentViewId = vd.viewId;
        multiView.showView(vd);
        let caption = collectionitem.name;
        if (nodeUtils.getHasChildren(vd.viewNode)) {
            caption += ' > ' + nodeUtils.getNodeTitle(vd.viewNode);
        }

        let dlg = uitools.openDialog('dlgManageViews', {
            modal: true,
            viewData: vd,
            state: state,
            caption: caption,
            currentViewId: currentViewId,
            multiView: multiView,
            activePresetName: '',
        });
        dlg.whenClosed = function () {
            if (dlg.modalResult === 1) {


                //if (multiView.customPresetName) {
                //    let view = window.views.getCompatibleView(viewData, multiView.customPresetName);
                //    if (view)
                //        view.applyView(viewData, multiView);
                //} else {
                //    multiView.restorePersistentStates();
                //}
            }
        };
        app.listen(dlg, 'closed', dlg.whenClosed);
    }*/

    UI.lvTreeNodes.controlClass.dataSource = collectionNodes;
    window.localListen(collectionNodes, 'focusChange', (e) => {
        handleButtons();
    });

    /*window.localListen(UI.lvTreeNodes, 'itemdblclick', (e) => {
        for (let i = 0; i < nodes.length; i++) {
            if (nodes[i].id === e.detail.item) {
                let node = createViewDataByPathAsync(nodes[i].id);
                editNode(node);
                break;
            }
        }
    });*/

    let moveUpHandler = function (list) {
        let res = false;
        let ds = list.controlClass.dataSource;
        let focused = ds.focusedIndex;
        if (focused > 0) {
            ds.moveSelectionTo(focused - 1);
            list.controlClass.setFocusedFullyVisible();
            res = true;
        }
        handleButtons();
        return res;
    }

    let moveDownHandler = function (list) {
        let res = false;
        let ds = list.controlClass.dataSource;
        let focused = ds.focusedIndex;
        if (focused < ds.count - 1) {
            ds.moveSelectionTo(focused + 2);
            list.controlClass.setFocusedFullyVisible();
            res = true;
        }
        handleButtons();
        return res;
    }

    allViewsList = new ArrayDataSource(window.views.getViews());
    UI.lvViews.controlClass.prepareDataSource(allViewsList);

    // events
    window.localListen(UI.btnTreeNodesMoveUp, 'click', function (e) {
        moveUpHandler(UI.lvTreeNodes);

    });
    window.localListen(UI.btnTreeNodesMoveDown, 'click', function (e) {
        moveDownHandler(UI.lvTreeNodes);
    });
    /*window.localListen(UI.btnTreeNodesEdit, 'click', function () {
        let item = UI.lvTreeNodes.controlClass.dataSource.focusedItem;
        if (item) {
            for (let i = 0; i < nodes.length; i++) {
                if (nodes[i].id === item.toString()) {
                    let node = createViewDataByPathAsync(nodes[i].id);
                    editNode(node);
                    break;
                }
            }
        }
    });*/


    window.localListen(UI.edtName, 'keyup', function () {
        handleButtons();
    });
    window.localListen(UI.btnOK, 'click', function () {
        collectionitem.name = UI.edtName.controlClass.value;
        collectionitem.description = UI.edtComment.controlClass.value;
        collectionitem.visibleInMainTree = UI.cbVisible.controlClass.focusedIndex;
        let list = [];
        collectionNodes.locked(function () {
            for (let i = 0; i < collectionNodes.count; i++) {
                let node = {
                    id: collectionNodes.getValue(i),
                    visible: collectionNodes.isChecked(i),
                    pos: i
                }
                list.push(node);
            }
        });
        params.item.assignFrom(collectionitem);
        nodeHandlers.collection.setConfiguredNodes(collectionitem, list);

        UI.lvColumns.controlClass.storePersistentStates();


        modalResult = 1;
    });
    window.localListen(UI.btnLoadIcon, 'click', function () {
        window.localPromise(app.utils.dialogOpenFile(app.filesystem.getIconsFolder(), 'svg', '', _('Select new icon'))).then(function (file) {
            let fs = app.filesystem;
            let newPath = fs.getDataFolder() + 'CustomIcons' + fs.getPathSeparator() + getJustFilename(file);
            fs.copyFileAsync(file, newPath).then(() => {
                collectionitem.icon = newPath;
                updateIcon();
            });
        });
    });

    window.localListen(UI.btnResetIcon, 'click', function () {
        collectionitem.icon = '';
        updateIcon();
    });

    // initialize tabs
    function selecttab(tab, oldtab) {
        if (oldtab)
            setVisibility(qid(oldtab), false, {
                animate: true
            });
        setVisibility(qid(tab), true, {
            animate: true
        });
        notifyLayoutChange();
    }

    window.localListen(UI.tabs, 'selected', function (e) {
        let oldTab;
        if (e.detail.oldTabIndex >= 0)
            oldTab = UI.tabs.controlClass.items[e.detail.oldTabIndex].getAttribute('tabname');
        selecttab(UI.tabs.controlClass.items[e.detail.tabIndex].getAttribute('tabname'), oldTab);
    });
    UI.tabs.controlClass.selectedIndex = 0;

    // initialize searchEditor
    UI.seCriteria.controlClass.showSortOrders = false;
    UI.seCriteria.controlClass.showLimits = false;
    UI.seCriteria.controlClass.showCollection = false;
    UI.seCriteria.controlClass.setQueryData(collectionitem.queryData);

    UI.lvColumns.controlClass._collection = collectionitem;

    UI.lvColumns.controlClass.dataSource = app.utils.createTracklist(true);
    UI.lvColumns.controlClass.getPersistentStateRootKey = function () {
        return 'CONTROLS_STATE_COLLECTION_' + collectionitem.id;
    };
    UI.lvColumns.controlClass.restorePersistentStates();

    updateIcon();
    handleButtons();
}

function handleButtons() {
    let canSave = UI.edtName.controlClass.value != '';
    UI.btnOK.disabled = !canSave;

    UI.btnTreeNodesMoveUp.controlClass.disabled = UI.lvTreeNodes.controlClass.dataSource.focusedIndex == 0;
    UI.btnTreeNodesMoveDown.controlClass.disabled = UI.lvTreeNodes.controlClass.dataSource.focusedIndex == UI.lvTreeNodes.controlClass.dataSource.count - 1;
}

function updateIcon() {
    loadIcon(collectionitem.icon, function (iconData) {
        if (iconData) {
            UI.icon.innerHTML = iconData;
            UI.icon.setAttribute('data-tip', collectionitem.icon);
            setVisibility(UI.icon, true);
            setVisibility(UI.iconNotFound, false);
        } else {
            UI.iconNotFound.innerHTML = '<label class="center">' + _('Icon') + ' ' + _('not found!') + '</label><br><label class="center">' + collectionitem.icon + '</label>';
            setVisibility(UI.icon, false);
            setVisibility(UI.iconNotFound, true);
        }
    });
}


class ViewsListView extends ItemListView {

    initialize(elem, params) {
        super.initialize(elem, params);
        this._newItemSupport = false;
        this._editItemSupport = true;
        this._deleteItemSupport = true;
        this._reorderItemsSupport = true;
    }

    openEdit(isNew) {
        let _this = this;
        let data = isNew ? window.views.createNewFromCurrent(multiView) : this.dataSource.focusedItem;
        if (!isNew && data.editable === false)
            return;

        multiView.showView(viewData);

        let dlg = uitools.openDialog('dlgEditView', {
            modal: true,
            notShared: true,
            viewData: viewData,
            isNew: isNew,
            data: data,
            multiView: multiView,
            isCurrent: false,
        });
        dlg.whenClosed = function () {
            if (dlg.modalResult === 1) {
                window.views.setViews(viewData.viewId, allViewsList.array);
                _this.invalidateAll();
            }
        };
        window.localListen(dlg, 'closed', dlg.whenClosed);
    }

    onNewItem() {
        this.openEdit(true);
    }

    onEditItem(index) {
        this.openEdit(false);
    }

    onDeleteItem(index) {
        let data = this.dataSource.focusedItem;
        if (data.deletable === false)
            return;
        super.onDeleteItem(index);
    }

}
registerClass(ViewsListView);

window.windowCleanup = function () {
    collectionitem = null;
    UI = null;
    nodes = null;
    viewData = null;
    multiView = null;
    tree = null;
    allViewsList = null;
}