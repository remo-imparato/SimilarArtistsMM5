/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

requirejs("controls/listview");

// initialization --------------------------------------------
function init(params) {
    if (params && params.title)
        title = params.title;
    else
        title = _('File types');
        
    window.noAutoSize = true; // disable auto sizing mechanism, we have fixed size

    let list = qid('lvList');
    list.controlClass.dataSource = params.dataSource;
    list.controlClass.dataSource.whenLoaded().then(function() {
        list.controlClass.setItemsChecked(function (item) {
            return params.usedExts.indexOf(item.toString()) >= 0;
        });
    });

    window.localListen(qid('btnOK'), 'click', function () {
        modalResult = 1;
    });
    
    if (params && params.columnTitle) {
        list.controlClass.getTitle = function () {
            return params.columnTitle;
        };
        list.controlClass.setColumns(list.controlClass.columns);
    }
    
}

function getExts() {
    let res = newStringList();
    let ds = qid('lvList').controlClass.dataSource;
    ds.locked(function () {
        for (let i = 0; i < ds.count; i++) {
            if(ds.isChecked(i)) {
                let item = ds.getValue(i);
                res.add(item.toString());
            }
        }
    });
    return res;
}