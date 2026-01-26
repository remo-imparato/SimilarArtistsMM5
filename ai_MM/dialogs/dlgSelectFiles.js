/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

let MaxURLHistoryEntries = 50;

function init(params) {
    title = params.title;
    this.resizeable = true;
    if (params.helpContext)
        document.body.setAttribute('data-help', params.helpContext);

    let UI = getAllUIElements();
    UI.lblDescription.innerHTML = params.description;

    let ds = newStringList(true);
    // read URL items from history
    let hist = app.getValue('URLHistory', []);
    hist.forEach(function (val) {
        ds.add(val);
    });
    UI.paths.controlClass.dataSource = ds;

    if (params.defaultValue)
        UI.paths.controlClass.value = params.defaultValue;

    UI.paths.controlClass.focus();

    let paths = newStringList(true);
    if (params.showBrowseButton) {
        window.localListen(UI.btnBrowse, 'click', function () {
            let promise = app.utils.dialogOpenFile('', 'mp3', 'All files (*.*)|*.*', _('Select files'), true /* multiselect */ );
            window.localPromise(promise).then(function (filenames) {
                if (filenames.count > 0) {
                    paths = filenames;
                }
                modalResult = 1;
            }, function () {
                // rejected - closed by cancel
                modalResult = 0;
            });
        });
    } else {
        setVisibility(UI.btnBrowse, false);
    }
    window.localListen(UI.btnOK, 'click', function () {
        let s = UI.paths.controlClass.value;
        if (s.indexOf('://') > -1) {
            // is URL, add to history
            let idx = hist.indexOf(s);
            if (idx > -1)
                hist.splice(idx, 1);
            hist.unshift(s);
            while (hist.length > MaxURLHistoryEntries) {
                hist.pop();
            };
            app.setValue('URLHistory', hist);
        }
        if (s !== '') {
            paths.add(s);
            modalResult = 1;
        } else {
            modalResult = 0;
        }
    });

    window.getPaths = function () {
        return paths;
    };

    window.getPath = function () {
        let res = '';
        if (paths.count > 0) {
            paths.locked(function () {
                res = paths.getValue(0);
            });
        }
        return res;
    };
}