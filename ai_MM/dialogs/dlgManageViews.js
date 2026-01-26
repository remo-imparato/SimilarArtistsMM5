/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

requirejs('helpers/views');
requirejs('helpers/arrayDataSource');
requirejs('controls/itemsListView');

let UI = null;
let viewData = null;
let state = null;
let currentViewId = '';
let multiView = null;
let activePresetName = '';
let caption = '';
let LV;

function init(params) {
    title = _('Manage views');
    //resizeable = false;
    viewData = params.viewData;
    let viewID = viewData.handlerID;
    state = params.state;
    currentViewId = params.currentViewId;
    multiView = params.multiView;
    activePresetName = params.activePresetName;
    caption = params.caption;
    LV = params.LV;


    UI = getAllUIElements();

    let ar = window.views.getViewDataSupportedViews(viewData, multiView);
    ar = ar.concat(window.views.getCompatibleViews(viewData));
    let list = new ArrayDataSource(ar);
    list.notifyLoaded();

    window.localListen(UI.btnOK, 'click', function () {

        let item;

        list.locked(() => {
            item = list.focusedItem;
            if (!item) {
                for (let i = 0; i < list.count; i++) {
                    if (list.isSelected(i)) {
                        item = list.getValue(i);
                        break;
                    }
                }
            }
        });

        window.views.setCompatibleViews(viewData, currentViewId, list.array);

        if (currentViewId && params.apply && item) {
            if ((item.viewMode === currentViewId || (activePresetName && item.id === activePresetName))) {
                // focused item is currently active view ... check it's modified or not
                let isCustom = (activePresetName && item.id === activePresetName);
                if ((isCustom && !!item.edited) || (!isCustom))
                    params.apply(item);
            } else {
                // activate different view type
                params.apply(item);
            }
        }
        modalResult = 1;
    });

    let newIdx = 0;
    let ds = list;
    ds.locked(() => {
        for (let i = 0; i < ds.count; i++) {
            let item = ds.getValue(i);
            if ((item.viewMode === currentViewId) && (!activePresetName || activePresetName === item.id)) {
                newIdx = i;
                break;
            }

        }
    });

    UI.lvViews.controlClass.prepareDataSource(list, newIdx);
    requestTimeout(() => {
        // LS: this is workaround for #16614 / item b)
        // where icons sometimes fails to show initially
        // probably because the dialog size is restored after the init()
        // ?TODO for Petr: call init() once the dialog size is already restored ?
        UI.lvViews.controlClass.lessChanged();
    }, 500);

}

class ViewsListView extends ItemListView {

    openEdit(isNew) {
        let _this = this;
        let data = isNew ? window.views.createNewFromCurrent(multiView) : this.dataSource.focusedItem;
        if (!isNew && data.editable === false)
            return;
        let isCustom = !!activePresetName;

        uitools.openDialog('dlgEditView', {
            modal: true,
            notShared: true,
            viewData: viewData,
            caption: caption,
            isNew: isNew,
            data: data,
            multiView: multiView,
            LV: LV,
            isCurrent: isNew ? false : (isCustom ? (data.id === activePresetName) : (!data.deletable && (data.viewMode === currentViewId))),
        }, function (dlg) {
            if (dlg.modalResult === 1) {
                data.edited = true;
                data.isNew = isNew;
                if (isNew) {
                    _this.add(data);
                } else {
                    _this.invalidateAll();
                }
            }
        });        
    }

    onNewItem() {
        this.openEdit(true);
    }

    onEditItem(index) {
        let data = this.dataSource.focusedItem;
        if (data.isCompatible(viewData))
            this.openEdit(false);
    }

    onDeleteItem(index) {
        let data = this.dataSource.focusedItem;
        if (data.deletable === false)
            return;
        super.onDeleteItem(index);
    }

    bindData(div, index) {
        super.bindData(div, index);
        div.removeAttribute('data-disabled');
        let item = this.dataSource.getValue(index);
        if (item && item.isCompatible) {
            if (!item.isCompatible(viewData))
                div.setAttribute('data-disabled', '1');
        }
    }

}
registerClass(ViewsListView);

window.windowCleanup = function () {
    UI = null;
    viewData = null;
    state = null;
    multiView = null;
    LV = null;
}

//requirejs('helpers/debugTools');
//registerDebuggerEntryPoint.call(this /* method class */, 'init' /* method name to inject */);
