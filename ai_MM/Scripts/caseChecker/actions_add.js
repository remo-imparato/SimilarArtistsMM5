/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

actions.caseChecker = {
    title: _('Case Checker') + '...',
    hotkeyAble: true,
    icon: 'caseChecker',
    disabled: uitools.notMediaListSelected,
    visible: window.uitools.getCanEdit,
    execute: async function () {
        var list = uitools.getSelectedTracklist();
        var dlg = uitools.openDialog('dlgCaseChecker', {
            show: true,
            modal: true,
            title: _('Case Checker'),
            tracks: list
        });
        dlg.closed = async function () {
            app.unlisten(dlg, 'closed', dlg.closed);
            if (dlg.modalResult !== 1)
                return;
            var holds = dlg.getValue('getHolds')();
            var itmRec;
            var items = {};
            var albumNames = {};
            var artistNames = {};
            var prevStr;

            function rdQS(UnquotedString) {
                return "'" + UnquotedString.replace(/'/g, "''") + "'";
            };

            for (let i in holds) {
                let itmRec = holds[i];
                let id = itmRec.id;
                let str = itmRec.str;
                let tag = itmRec.tag;
                if (!items[id]) {
                    items[id] = itmRec.item
                }

                prevStr = itmRec.item[tag];
                itmRec.item[tag] = str;
                if (tag === 'artist' || tag === 'albumArtist') {
                    if (!artistNames[itmRec.str]) {
                        artistNames[itmRec.str] = itmRec.str;
                        let sql = "UPDATE Artists SET Artist = " + rdQS(itmRec.str) + " WHERE Artists.Artist= " + rdQS(prevStr);
                        await app.db.executeQueryAsync(sql);
                        // This will affect ALL instances of this artist, including album artist, and on other tracks.
                    }
                } else if (tag === 'album') {
                    if (!albumNames[itmRec.str]) {
                        albumNames[itmRec.str] = itmRec.str;
                        let sql = "UPDATE Albums SET Album = " + rdQS(itmRec.str) + " WHERE Albums.Album= " + rdQS(prevStr);
                        await app.db.executeQueryAsync(sql);
                        // This will affect ALL instances of this album, including other tracks.
                    }
                }
            }

            var list = app.utils.createTracklist(true);
            for (var id in items) {
                list.add(items[id]);
            }

            list.commitAsync();
        };
        app.listen(dlg, 'closed', dlg.closed);
    }
}

window._menuItems.editTags.action.submenu.push({
    action: actions.caseChecker,
    order: 100,
    grouporder: 10
});
