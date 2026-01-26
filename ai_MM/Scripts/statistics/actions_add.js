/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

actions.statistics = {
    title: _('Statistics') + '...',
    hotkeyAble: true,
    icon: 'listview',
    execute: function () {
        var dlg = uitools.openDialog('dlgStatistics', {
            show: true,
            modal: true,
            title: _('MediaMonkey Library Statistics'),
        });
    }
}

window._menuItems.reports.action.submenu.push({
    action: actions.statistics,
    order: 10,
    grouporder: 10
});
