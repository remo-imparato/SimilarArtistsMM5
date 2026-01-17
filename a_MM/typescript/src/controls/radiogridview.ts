/**
@module UI
*/

import GridView from './gridview';

/**
Base class for GridView with radio buttons.

@class RadioGridView
@constructor
@extends GridView
*/

class RadioGridView extends GridView {

    initialize(rootelem, params) {
        super.initialize(rootelem, params);

        this.multiselect = false;
        this.showHeader = true;
    }

    invertCheckStateForSelected() {
        let ds = this.dataSource;
        ds.modifyAsync(function () {
            if (ds.count) {
                ds.beginUpdate();
                ds.forEach(function (item, index) {
                    if (ds.isSelected(index)) {
                        ds.setChecked(index, true);
                    } else
                        ds.setChecked(index, false);
                });
                ds.endUpdate();
            }
        }.bind(this)).then(function () {
            this.invalidateAll();
            let event = createNewCustomEvent('checkedchanged', {
                detail: null,
                bubbles: true,
                cancelable: true
            });
            this.container.dispatchEvent(event);
        }.bind(this));
    }

}
registerClass(RadioGridView);

