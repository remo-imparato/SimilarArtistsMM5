/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

actions.exportAllPlaylists = {
    title: _('Export all playlists') + '...',
    icon: 'exportM3U',
    hotkeyAble: true,
    category: actionCategories.export,
    execute: function () {

        var playlists = app.utils.createSharedList();
        var playlistTitles = [];
        var dups = {};

        // Recursively process all playlists                
        var ReadPlaylists = async function (plst, prefix) {
            var items = plst.getChildren();
            await items.whenLoaded();

            if (prefix) {
                prefix = prefix + " - ";
            }

            var i, newplst, title;
            for (i = 0; i < items.count; i++) {
                items.locked(function () {
                    newplst = items.getValue(i);
                })
                title = prefix + newplst.title;
                if (!dups[title]) {
                    dups[title] = true;
                    playlistTitles.push(title);
                    playlists.add(newplst);
                }
                await ReadPlaylists(newplst, title);
            };
        }

        var ExportM3Us = async function () {
            // Open inifile and get last used directory
            var defaultDir = app.getValue('ExportPlaylists_LastExportM3UsDir', '');
            var path = undefined;
            await uitools.showSelectFolderDlg(defaultDir, {
                title: _('Select where to export all M3U files'),
                helpContext: 'Exporting Playlists#To export all Playlists as .m3u files'
            }).then(function (p) {
                path = p;
            });

            if (!path) {
                return;
            }

            if (path.slice(-1) !== '\\') {
                path = path + '\\';
            }

            // Write selected directory to the ini file
            app.setValue('ExportPlaylists_LastExportM3UsDir', path);

            // Connect to the FileSystemObject
            var fso = app.filesystem;

            // Use progress to notify user about the current action
            var progress = app.backgroundTasks.createNew();
            var expText = _('Exporting') + '...';
            progress.leadingText = expText;

            // Prepare a list of all playlists
            await ReadPlaylists(app.playlists.root, "");

            // Go through the list and export each playlist    
            progress.maxValue = playlists.count;
            progress.value = 0;

            listAsyncForEach(playlists, (plst, nextPlaylist, idx) => {
                title = playlistTitles[idx];
                progress.text = ' (' + title + ')';
                progress.value = idx / playlists.count;
                var tracks = plst.getTracklist();
                tracks.whenLoaded().finally(() => {

                    /* // LS: following was replaced (by the code below) in course of #18232 to unify with 'Export playlist' function and improve performance
                    var fout = '#EXTM3U';
                    listAsyncForEach(tracks, function (trck, next) {
                        var ln = "#EXTINF:";
                        var tlen = trck.songLength;
                        if (tlen > 0) {
                            ln = ln + Math.floor(tlen / 1000) + ',';
                        } else {
                            ln = ln + '-1,';
                        }
                        var art = trck.artist;
                        var tit = trck.title;
                        if (art) {
                            if (tit) {
                                ln = ln + art + ' - ' + tit;
                            } else {
                                ln = ln + art;
                            }
                        } else {
                            if (tit) {
                                ln = ln + tit;
                            }
                        }
                        fout += '\n' + ln + '\n' + trck.path;
                        next(progress.terminated);
                    }, () => {
                        if (!progress.terminated)
                            app.filesystem.saveTextToFileAsync(path + fso.correctFilename(title) + '.m3u', fout).finally(() => {
                                nextPlaylist(progress.terminated);
                            });
                        else
                            nextPlaylist(progress.terminated);
                    });
                    */

                    app.playlists.saveToPlaylistFile(tracks, path + fso.correctFilename(title) + '.m3u', title).finally(() => {
                        nextPlaylist(progress.terminated);
                    });

                });

            }, () => {
                // final callback
                progress.terminate();
            });
        };

        ExportM3Us();
    }
}
window._menuItems.export.action.submenu.push({
    action: actions.exportAllPlaylists,
    order: 10,
    grouporder: 10
});
