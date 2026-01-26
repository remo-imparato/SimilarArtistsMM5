/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

requirejs('utils');

// escape XML string
function MapXML(srcstring) {
    if (!srcstring)
        return '';
    var resultVal;
    resultVal = srcstring.replace(/&/g, '&amp;');
    resultVal = resultVal.replace(/</g, '&lt;');
    resultVal = resultVal.replace(/>/g, '&gt;');
    var i = 0;
    while (i < resultVal.length) {
        if (resultVal.charCodeAt(i) > 127) {
            resultVal = resultVal.substring(0, i) + "&#" + resultVal.charCodeAt(i) + ";" + resultVal.substring(i + 1);
            i = i + 3;
        }
        i = i + 1;
    }
    return resultVal;
};

// function for quoting strings
function QStr(astr) {
    return String.fromCharCode(34) + astr + String.fromCharCode(34);
}

// function for quoting strings converted to plain ASCII
function QAStr(astr) {
    return String.fromCharCode(34) + (astr.replace(/"/g, '""')) + String.fromCharCode(34);
}

window.sendToFileListHandlers.push({
    ext: 'htm',
    title: 'HTML',
    saveFunc: async function (selTracks, resfilename, exportSett, progress) {
        var txt = '';
        txt += '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">\r\n';
        txt += '<html xmlns="http://www.w3.org/1999/xhtml">\r\n';
        txt += '<head><title>' + _('MediaMonkey Filelist') + '</title>\r\n';

        // Code to format the document 
        txt += '<style type="text/css">\r\n';
        txt += 'body{font-family:Verdana,Arial,Tahoma,sans-serif;background-color:#fff;font-size:small;color:#000;}\r\n';
        txt += 'th{font-weight:bold;border-bottom:3px solid #000;}\r\n';
        txt += 'td{color:#000;border-bottom:1px solid #000;padding:4px 6px;}\r\n';
        txt += 'tr.trhov:hover, tr.trhov:hover td{background-color:#ddd;}\r\n';
        txt += '.dark{background-color:#eee;}\r\n';
        txt += '</style>\r\n';

        txt += '</head><body>\r\n';
        txt += '<a href="https://www.mediamonkey.com" style="font-size:1.4em;font-weight:bold;">' + _('MediaMonkey Filelist') + '</a>\r\n';

        // Headers of table 
        txt += '<br /><br /><table cellpadding="4" cellspacing="0">\r\n';
        txt += '<tr align="left">\r\n';

        var fd = window.uitools.tracklistFieldDefs;
        var isDark = true;
        forEach(exportSett.columns, (col, idx) => {
            txt += ' <th' + (isDark ? ' class="dark"' : '') + '>' + MapXML(resolveToValue(fd[col].title)) + '</th>\r\n';
            isDark = !isDark;
        });
        txt += '</tr>\r\n';

        var duration = 0;
        var loop = 0;
        var i = 0;
        await app.filesystem.saveTextToFileAsync(resfilename, txt);
        txt = '';
        var itm;
        var val, fdef;
        var tl, tli, starti;
        var reBr = /(?:\r\n|\r|\n)/g;
        while (i < selTracks.count && !progress.terminated) {
            loop = 0;
            tl = [];
            starti = i;
            selTracks.locked(function () {
                while ((loop < 50) && (i < selTracks.count) && !progress.terminated) {
                    itm = selTracks.getValue(i);
                    tl.push(itm);
                    loop++;
                    i++;
                }
            });
            tli = 0;
            while ((tli < tl.length) && !progress.terminated) {
                itm = tl[tli];
                txt += '<tr class="trhov">';
                isDark = true;
                var col;
                for (var cidx = 0; cidx < exportSett.columns.length; cidx++) {
                    col = exportSett.columns[cidx];
                    fdef = fd[col];
                    if ((col === 'listOrder') || (col === 'playOrder'))  {
                        val = String(starti + tli + 1);
                    } else {
                        if (isFunction(fdef.getValueAsync)) {
                            val = await fdef.getValueAsync(itm);
                            val = String(val);
                        } else {
                            assert(isFunction(fdef.getValue), 'Function getValue is missing for column ' + col);
                            val = String(fdef.getValue(itm));
                        }
                        if (!val) {
                            val = '&nbsp;'; // Add space to empty fields, so table is displayed correctly (Cell borders do not show up for empty cells) 
                        } else {
                            val = MapXML(val);
                            if (val)
                                val = val.replace(reBr, '<br>');
                        }
                    }
                    txt += '<td' + (isDark ? ' class="dark"' : '') + (fdef.align ? (' align="' + fdef.align + '"') : '') + '>' + val + '</td>';
                    isDark = !isDark;
                };
                txt += '</tr>\r\n';

                if (itm.songLength) {
                    duration += itm.songLength;
                };
                tli++;
            };

            if (txt !== '') {
                await app.filesystem.saveTextToFileAsync(resfilename, txt, {
                    append: true
                });
                txt = '';
            };
        };
        tl = [];
        if (!progress.terminated) {
            // Write some code to finish html document 
            txt = '</table><table width="100%"><tr>\r\n';
            txt += '<td style="border:none;"><b>' + _('Total Files') + ': </b>' + i + '</td>\r\n';
            txt += '</tr><tr>\r\n';
            txt += '<td style="border:none;"><b>' + _('Duration') + ': </b>' + getFormatedTime(duration) + '</td>\r\n';
            txt += '<td align="right" style="border:none;">' + _('Generated by ') + '<a href="https://www.mediamonkey.com">MediaMonkey</a></td>\r\n';
            txt += '</tr>\r\n</table>\r\n</body>\r\n</html>';
            await app.filesystem.saveTextToFileAsync(resfilename, txt, {
                append: true
            });
        } else {
            // export canceled, delete file
            await app.filesystem.deleteFileAsync(resfilename);
        };
    }
});

window.sendToFileListHandlers.push({
    ext: 'xml',
    title: 'XML',
    saveFunc: async function (selTracks, resfilename, exportSett, progress) {
        var txt = '';
        var fd = window.uitools.tracklistFieldDefs;
        var artists = selTracks.getPersonList('artist');
        await artists.whenLoaded();
        if (progress.terminated) {
            return;
        };
        var albums = selTracks.getAlbumList();
        await albums.whenLoaded();
        if (progress.terminated) {
            return;
        };

        txt += '<?xml version=\'1.0\'?>\r\n';
        txt += '<MusicDatabase>\r\n';
        txt += '  <Artists>\r\n';

        var loop = 0;
        var i = 0;
        await app.filesystem.saveTextToFileAsync(resfilename, txt);
        txt = '';
        var itm;
        while (i < artists.count && !progress.terminated) {
            loop = 0;
            artists.locked(function () {
                while ((loop < 200) && (i < artists.count) && !progress.terminated) {
                    itm = artists.getValue(i);
                    txt += '    <Artist id="Artist_' + itm.id + '">\r\n';
                    txt += '       <Name>' + MapXML(itm.name) + '</Name>\r\n';
                    txt += '    </Artist>\r\n';

                    loop++;
                    i++;
                }
            });
            if ((txt !== '') && !progress.terminated) {
                await app.filesystem.saveTextToFileAsync(resfilename, txt, {
                    append: true
                });
                txt = '';
            };
        };
        if (progress.terminated) {
            // export canceled, delete file
            await app.filesystem.deleteFileAsync(resfilename);
            return;
        };
        txt += '  </Artists>\r\n';
        txt += '  <Albums>\r\n';
        i = 0;
        while (i < albums.count && !progress.terminated) {
            loop = 0;
            albums.locked(function () {
                while ((loop < 200) && (i < albums.count) && !progress.terminated) {
                    itm = albums.getValue(i);
                    txt += '    <Album id="Album_' + itm.id + '">\r\n';
                    txt += '       <AlbumArtist>' + MapXML(itm.albumArtist) + '</AlbumArtist>\r\n';
                    txt += '       <Title>' + MapXML(itm.title) + '</Title>\r\n';
                    txt += '    </Album>\r\n';
                    loop++;
                    i++;
                }
            });
            if ((txt !== '') && !progress.terminated) {
                await app.filesystem.saveTextToFileAsync(resfilename, txt, {
                    append: true
                });
                txt = '';
            };
        };

        if (progress.terminated) {
            // export canceled, delete file
            await app.filesystem.deleteFileAsync(resfilename);
            return;
        };
        txt += '  </Albums>\r\n';
        txt += '  <Songs>\r\n';
        i = 0;

        function capitalizeFirst(str) {
            return str && str[0].toUpperCase() + str.slice(1);
        }

        while (i < selTracks.count && !progress.terminated) {
            loop = 0;
            let tl = [];
            let starti = i;
            selTracks.locked(function () {
                while ((loop < 50) && (i < selTracks.count) && !progress.terminated) {
                    let itm = selTracks.getValue(i);
                    tl.push(itm);
                    loop++;
                    i++;
                }
            });
            let tli = 0;
            while ((tli < tl.length) && !progress.terminated) {
                let itm = tl[tli];
                let val;
                txt += '    <Song id="Song_' + itm.id + '">\r\n';
                for (var cidx = 0; cidx < exportSett.columns.length; cidx++) {
                    let col = exportSett.columns[cidx];
                    let fdef = fd[col];
                    if ((col === 'listOrder') || (col === 'playOrder'))  {
                        val = String(starti + tli + 1);
                    } else {
                        if (isFunction(fdef.getValueAsync)) {
                            await fdef.getValueAsync(itm).then(function (txt) {
                                val = String(txt);
                            });
                        } else {
                            assert(isFunction(fdef.getValue), 'Function getValue is missing for column ' + col);
                            val = String(fdef.getValue(itm));
                        }
                        if (!val)
                            val = '';
                        else
                            val = MapXML(val);
                    }
                    if (col === 'album') { // special handling for album, we add also id
                        if (itm.idalbum > 0)
                            txt += '       <Album id="Album_' + itm.idalbum + '">' + val + '</Album>\r\n';
                        else
                            txt += '       <Album>' + val + '</Album>\r\n';
                    } else if (col === 'media') { // special handling for media, we add also id and SN
                        if (itm.idMedia !== -1)
                            txt += '       <Media id="Media_' + itm.idMedia + '" sn="' + itm.mediaSN + '">' + val + '</Media>\r\n';
                        else
                            txt += '       <Media>' + val + '</Media>\r\n';
                    } else {
                        let tagName = capitalizeFirst(col);
                        txt += '       <' + tagName + (fdef.usesRaw ? (' value="' + fdef.getValue(itm, true) + '"') : '') + '>' + val + '</' + tagName + '>\r\n';
                    }
                };
                txt += '    </Song>\r\n';
                tli++;
            };

            if ((txt !== '') && !progress.terminated) {
                await app.filesystem.saveTextToFileAsync(resfilename, txt, {
                    append: true
                });
                txt = '';
            };
        };

        if (progress.terminated) {
            // export canceled, delete file
            await app.filesystem.deleteFileAsync(resfilename);
            return;
        };

        txt += '  </Songs>\r\n';
        txt += '</MusicDatabase>\r\n';
        await app.filesystem.saveTextToFileAsync(resfilename, txt, {
            append: true
        });
    }
});

window.sendToFileListHandlers.push({
    ext: 'csv',
    title: 'CSV',
    saveFunc: async function (selTracks, resfilename, exportSett, progress) {
        var fd = window.uitools.tracklistFieldDefs;
        var arr = [];
        forEach(exportSett.columns, (col) => {
            arr.push(resolveToValue(fd[col].title));
        });

        var txt = arr.join(',') + '\r\n';

        var loop = 0;
        var i = 0;
        await app.filesystem.saveTextToFileAsync(resfilename, txt);
        txt = '';
        var itm, fdef, val;
        var tl, tli, starti;
        while (i < selTracks.count && !progress.terminated) {
            loop = 0;
            tl = [];
            starti = i;
            selTracks.locked(function () {
                while ((loop < 50) && (i < selTracks.count) && !progress.terminated) {
                    itm = selTracks.getValue(i);
                    tl.push(itm);
                    loop++;
                    i++;
                }
            });
            tli = 0;
            while ((tli < tl.length) && !progress.terminated) {
                itm = tl[tli];
                arr = [];

                for (var cidx = 0; cidx < exportSett.columns.length; cidx++) {
                    let col = exportSett.columns[cidx];
                    if ((col === 'listOrder') || (col === 'playOrder'))  {
                        arr.push(String(starti + tli + 1));
                    } else {
                        fdef = fd[col];
                        if (isFunction(fdef.getValueAsync)) {
                            await fdef.getValueAsync(itm).then(function (txt) {
                                val = txt;
                            });
                        } else {
                            assert(isFunction(fdef.getValue), 'Function getValue is missing for column ' + col);
                            val = fdef.getValue(itm);
                        }
                        if (fdef.isNumber)
                            arr.push(String(val));
                        else
                            arr.push(QAStr(String(val) || ''));
                    }
                };

                txt += arr.join(',') + '\r\n';
                tli++;
            };

            if (txt !== '') {
                await app.filesystem.saveTextToFileAsync(resfilename, txt, {
                    append: true
                });
                txt = '';
            };
        };

        if (progress.terminated) {
            // export canceled, delete file
            await app.filesystem.deleteFileAsync(resfilename);
        };
    }
});

actions.exportToFile = {
    title: _('File list') + '...',
    hotkeyAble: true,
    icon: 'exportToFile',
    getTracklist: getSelectedTracklist,
    disabled: false,
    execute: function () {
        let selTracks = this.getTracklist();
        if (!selTracks) {           
            let coll = app.collections.getEntireLibrary();
            selTracks = coll.getTracklist();
        }
        if (selTracks) {
            selTracks.whenLoaded().then(async function (selTracks) {
                if (selTracks.count === 0) {
                    let coll = app.collections.getEntireLibrary();
                    selTracks = coll.getTracklist();
                    await selTracks.whenLoaded();
                }
                if (selTracks.count > 0) {
                    let defSortString = selTracks.autoSortString;
                    if (!defSortString)
                        defSortString = 'albumArtist ASC;album ASC;discNo ASC;order ASC;title ASC';
                    let exportSett = app.getValue('exportToFile_settings', {
                        extension: 'htm',
                        initialDir: '',
                        columns: ['playOrder', 'artist', 'title', 'album', 'length', 'date', 'genre', 'rating', 'bitrate', 'path', 'media'],
                        sortString: defSortString
                    });
                    exportSett.sortString = defSortString; // #19203
                    // @ts-ignore
                    let allColumns = []; // @ts-ignore
                    let sortColumns = [];
                    let col;
                    forEach(exportSett.columns, (columnType) => {
                        col = window.uitools.tracklistFieldDefs[columnType];
                        if (col && !col.noExport && isFunction(col.getValue)) {
                            col = copyObject(col);
                            col.columnType = columnType;
                            col.visible = true;
                            col.disabled = false;
                            allColumns.push(col);
                            if (!col.noSorting)
                                sortColumns.push(col);
                        }
                    });
                    for (let columnType in window.uitools.tracklistFieldDefs) {
                        let col = window.uitools.tracklistFieldDefs[columnType];
                        if (!col.noExport && isFunction(col.getValue) && !inArray(columnType, exportSett.columns)) {
                            col = copyObject(col);
                            col.columnType = columnType;
                            col.visible = false;
                            col.disabled = false;
                            allColumns.push(col);
                            if (!col.noSorting)
                                sortColumns.push(col);
                        }
                    }
                    let dlg = uitools.openDialog('dlgEditView', {
                        modal: true,
                        notShared: true,
                        allColumns: allColumns,
                        sorting: exportSett.sortString,
                        sortingColumns: sortColumns,
                        allowEmpty: false
                    });
                    dlg.onClosed = async function () {
                        app.unlisten(dlg, 'closed', dlg.onClosed);
                        if (dlg.modalResult == 1) {
                            let newList = dlg.getValue('getColumnList')();
                            let obj = JSON.parse(newList);
                            exportSett.columns = [];
                            obj.forEach(function (item) {
                                if (item.visible) {
                                    exportSett.columns.push(item.columnType);
                                }
                            });
                            exportSett.sortString = dlg.getValue('getSorting')();
                            if (exportSett.sortString && (exportSett.sortString != ''))
                                await selTracks.setAutoSortAsync(exportSett.sortString);                            
                            let itH;
                            let filter = '';
                            for (let i = 0; i < window.sendToFileListHandlers.length; i++) {
                                itH = window.sendToFileListHandlers[i];
                                if (filter)
                                    filter += '|';
                                filter += itH.title + ' (*.' + itH.ext + ')|*.' + itH.ext;
                            }
                            app.utils.dialogSaveFile(exportSett.initialDir, exportSett.extension, filter, _('Exporting') + '...').then(async function (resfilename) {
                                if (!resfilename)
                                    return;
                                let ext = getFileExt(resfilename).toLowerCase();
                                let hndlr = undefined;
                                for (let i = 0; i < window.sendToFileListHandlers.length; i++) {
                                    itH = window.sendToFileListHandlers[i];
                                    if (itH.ext === ext) {
                                        hndlr = itH;
                                        break;
                                    }
                                }
                                if (!hndlr)
                                    return;
                                exportSett.initialDir = getFileFolder(resfilename);
                                exportSett.extension = ext;
                                app.setValue('exportToFile_settings', exportSett);
                                let progress = app.backgroundTasks.createNew();
                                progress.leadingText = _('Exporting') + '...';
                                await hndlr.saveFunc(selTracks, resfilename, exportSett, progress);
                                if (!progress.terminated)
                                    progress.terminate();
                            });
                        }
                    };
                    app.listen(dlg, 'closed', dlg.onClosed);
                }
            });
        }
    }
};

window._menuItems.reports.action.submenu.push({
    action: actions.exportToFile,
    order: 20,
    grouporder: 10
});