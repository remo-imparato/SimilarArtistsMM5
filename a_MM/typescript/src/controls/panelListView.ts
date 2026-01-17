import ListView from './listview';

/**
Component for panels selection (e.g. in Options dialog)

@class PanelListView
@constructor
@extends ListView
*/

export default class PanelListView extends ListView {
    private _allPanels: StringList;
    loadedPanels: string[];
    contentBox: any;

    initialize(element, params) {
        params = params || {};
        params.multiselect = false;
        params.disabledClearingSelection = true; // we need always some panel focused/selected
        super.initialize(element, params);
        this.dataSource = newStringList();
        this._allPanels = newStringList(); // all panels (including invisible)
        this.loadedPanels = [];
    }

    setContentBox(contentBox) {
        let _this = this;
        this.contentBox = contentBox;
        this.localListen(this.container, 'focuschange', function () {
            _this.requestTimeout(_this.panelChanged.bind(_this), 20, '_panelFocusTm'); // to be fluent when holding up/down arrow
        });
    }

    _loadPanel(key) {
        this.raiseEvent('loadpanel', {
            panelID: key
        }, false, true /* bubbles */ );
    }

    isPanelLoaded(panelID) {
        if (this.loadedPanels.indexOf(panelID) >= 0)
            return true;
        else
            return false;
    }

    selectPanel(key) {
        let _this = this;
        let DS = this.dataSource;
        DS.modifyAsync(function () {
            for (let i = 0; i < DS.count; i++) {
                let Value = DS.getValue(i);
                let panel = JSON.parse(Value.toString());
                if (panel.key == key)
                    _this.setFocusedAndSelectedIndex(i);
            }
        });
    }

    forAllLoadedPanels(func) {
        let DS = this.dataSource;
        DS.locked(function () {
            for (let i = 0; i < DS.count; i++) {
                let value = DS.getValue(i);
                let panel = JSON.parse(value.toString());
                if (this.isPanelLoaded(panel.key)) {
                    func(panel.key);
                }
            }
        }.bind(this));
    }

    setVisiblePanels(ar) {
        let all = this._allPanels;
        let _selectPanel = '';

        let oldFocused = '';
        let focusedItem = this.focusedItem;
        if (focusedItem) {
            let panel = JSON.parse(focusedItem.toString());
            oldFocused = panel.key;
        }

        let DS = this.dataSource;
        DS.clear();
        all.locked(function () {
            DS.beginUpdate();
            for (let i = 0; i < all.count; i++) {
                let value = all.getValue(i);
                let panel = JSON.parse(value.toString());
                if (inArray(panel.key, ar)) {
                    if (!_selectPanel || oldFocused == panel.key)
                        _selectPanel = panel.key;
                    DS.add(value);
                }
            }
            DS.endUpdate();
        }.bind(this));
        if (_selectPanel)
            this.selectPanel(_selectPanel);
    }

    hideAllPanels() {
        let rightBox = this.contentBox;
        for (let i = 0; i < rightBox.children.length; i++) {
            let pnl = rightBox.children[i];
            setVisibility(pnl, false);
        }
    }

    panelChanged() {
        this.hideAllPanels();

        let newValue = this.focusedItem;
        if (newValue) {
            let panel = JSON.parse(newValue.toString());
            this._loadPanel(panel.key);
        }
    }

    addPanel(panel) {
        let pnlJSON = JSON.stringify(panel);
        this.dataSource.add(pnlJSON);
        this._allPanels.add(pnlJSON);
    }

    setUpDiv(div) {
        if (!div.cloned)
            div.innerHTML = '<div><label data-id="lbl"></label></div>';
        div.label = qe(div, '[data-id=lbl]');
    }

    bindData(div, index) {
        if (this.dataSource && div) {
            let value = this.dataSource.getValue(index);
            if (value) {
                let panel = JSON.parse(value.toString());
                div.label.innerText = panel.name;
                if (panel.level !== undefined) {
                    div.label.style.marginLeft = 25 * panel.level + 'px';
                } else if (panel.parent)
                    div.label.classList.add('left-indent');
            }
        }
    }
}
registerClass(PanelListView);
