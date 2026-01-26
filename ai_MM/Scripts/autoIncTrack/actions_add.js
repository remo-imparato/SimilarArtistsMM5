/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

// This script fills in track #s incrementally

actions.autoIncTrackNumbers = {
    title: _('Auto-increment Track #s') + '...',
    hotkeyAble: true,
    icon: 'add',
    disabled: uitools.notMediaListSelected,
    visible: window.uitools.getCanEdit,
    execute: async function () {
        var list = await uitools.getSelectedTracklist().whenLoaded();
        if (list.count === 0) {
            return;
        }
        var dlg = uitools.openDialog('dlgInputText', {
            show: true,
            modal: true,
            type: 'number',
            defaultValue: 1,
            min: 1,
            max: 9999,
            title: _('Auto-increment Track #s'),
            helpContext: 'Editing Track Properties#Edit Tags',
            description: sprintf(_('This will modify the track# field in sequential order for the %d selected tracks.') + ' ' + _('Do you want to proceed?'), list.count) + '<br/><br/>' + _('Start numbering from:'),
        });

        dlg.whenClosed = function () {
            if (dlg.modalResult === 1) {
                var value = dlg.getValue('getTextInput')();
                if (value) {
                    value = Number(value);
                    // Process all selected tracks
                    list.forEach(function (itm) {
                        itm.trackNumberInt = value;
                        value++;
                    });
                    list.commitAsync();
                }
            }
        };
        app.listen(dlg, 'closed', dlg.whenClosed);
    }
}

window._menuItems.editTags.action.submenu.push({
    action: actions.autoIncTrackNumbers,
    order: 10,
    grouporder: 10
});
