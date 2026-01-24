/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

requirejs('utils');

// escape XML string
if (!window._MapXML) {
    window._MapXML = function(srcstring) {
        if (!srcstring)
            return '';
        var resultVal;
        resultVal = srcstring.replace(/&/g, '&amp;');
        resultVal = resultVal.replace(/</g, '&lt;');
        resultVal = resultVal.replace(/>/g, '&gt;');
        /* LS: following was disabled because of #21547 to be compatible with iTunes UTF-8 export
        var i = 0;
        while (i < resultVal.length) {
            if (resultVal.charCodeAt(i) > 127) {
                resultVal = resultVal.substring(0, i) + "&#" + resultVal.charCodeAt(i) + ";" + resultVal.substring(i + 1);
                i = i + 3;
            }
            i = i + 1;
        }
        */
        return resultVal;        
    };
}

window.sendToiTunesHandlers = [];
window.sendToiTunesHandlers.push({
    ext: 'xml',
    title: 'XML',
    saveFunc: async function (selTracks, resfilename, exportSett, progress) {
        
        let txt = '<?xml version="1.0" encoding="UTF-8" ?>\r\n';        
        txt += '<!DOCTYPE plist PUBLIC "-//Apple Computer//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\r\n';
        txt += '<plist version="1.0">\r\n';
        txt += '<dict>\r\n'
        txt += '    <key>Major Version</key><integer>1</integer>\r\n';
        txt += '    <key>Minor Version</key><integer>1</integer>\r\n';
        txt += '    <key>Application Version</key><string>12.10.11.2</string>\r\n';
        txt += '    <key>Date</key><date>'+ app.utils.dateTime2Timestamp( app.utils.now()) +'</date>\r\n';
        txt += '    <key>Features</key><integer>5</integer>\r\n';
        txt += '    <key>Show Content Ratings</key><true/>\r\n';
        txt += '    <key>Library Persistent ID</key><string>0EF32D466ABDF0F9</string>\r\n';
        txt += '    <key>Tracks</key>\r\n';
        txt += '    <dict>\r\n';

        let loop = 0;
        let i = 0;
        await app.filesystem.saveTextToFileAsync(resfilename, txt);
        txt = '';
        let fd = window.uitools.tracklistFieldDefs;      

        function capitalizeFirst(str) {
            return str && str[0].toUpperCase() + str.slice(1);
        }

        function formatDate( datetime) {
            return new Date( app.utils.dateTime2Timestamp( datetime)).toISOString();
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
            progress.value = (i / selTracks.count);
            progress.text = i + '/' + selTracks.count;
            let tli = 0;
            while ((tli < tl.length) && !progress.terminated) {
                let itm = tl[tli];
                let val;
                txt += '    <key>' + itm.id + '</key>\r\n';
                txt += '    <dict>\r\n';
                txt += '    <key>Track ID</key><integer>'+ itm.id +'</integer>\r\n';

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
                            val = window._MapXML(val);
                                                               
                        let tagName = capitalizeFirst(col);
                        if (tagName == 'Comment')
                            tagName = 'Comments';

                        if (tagName == 'Date')                            
                            txt += '       <key>Date</key><date>'+ formatDate(itm.getDateTime()) +'</date>\r\n';
                        else
                        if (tagName == 'DateAdded')
                            txt += '       <key>Date Added</key><date>'+ formatDate(itm.dateAdded) +'</date>\r\n';
                        else
                        if (tagName == 'TimeStamp')
                            txt += '       <key>File Modified</key><date>'+ formatDate(itm.fileModified) +'</date>\r\n';
                        else
                        if (tagName == 'Rating') {                           
                            if (val >= 0)
                                txt += '       <key>Rating</key><integer>'+ val +'</integer>\r\n';
                        } else    
                        if (tagName == 'Order')
                            txt += '       <key>Track Number</key><integer>'+ val +'</integer>\r\n';
                        else                            
                        if (tagName == 'LastPlayed')
                            txt += '       <key>Play Date</key><date>'+ formatDate(itm.lastTimePlayed) +'</date>\r\n';
                        else    
                        if (tagName == 'LastSkipped')
                            txt += '       <key>Skip Date</key><date>'+ formatDate(itm.lastTimeSkipped) +'</date>\r\n';
                        else
                        if (tagName == 'Skipped')
                            txt += '       <key>Skip Count</key><integer>'+ itm.skipCount +'</integer>\r\n';
                        else      
                        if (tagName == 'PlayCounter')
                            txt += '       <key>Play Count</key><integer>'+ itm.playCounter +'</integer>\r\n';
                        else 
                        if (tagName == 'Length')
                            txt += '       <key>Total Time</key><integer>'+ itm.songLength+'</integer>\r\n';
                        else        
                        if (tagName == 'Path') {
                            let path =  replaceAll('\\', '/', val);
                            txt += '       <key>Location</key><string>file://localhost/'+ encodeURI( path) +'</string>\r\n';
                        } else  
                        if (tagName == 'Bpm') {    
                            if (val >= 0)                       
                                txt += '       <key>BPM</key><integer>'+ val +'</integer>\r\n';
                        } else
                        if (tagName == 'Filesize')                            
                            txt += '       <key>Size</key><integer>'+ val +'</integer>\r\n';
                        else {                              
                            if (!Number.isInteger( val))
                                txt += '       <key>' + tagName + '</key>' + '<string>' + val + '</string>\r\n';
                            else
                            if (val >= 0)
                                txt += '       <key>' + tagName + '</key>' + '<integer>' + val + '</integer>\r\n';
                        }                       
                    }
                };                
                txt += '    </dict>\r\n';
                tli++;
            };

            if ((txt !== '') && !progress.terminated) {
                await app.filesystem.saveTextToFileAsync(resfilename, txt, {
                    append: true,
                    dontClose: true
                });
                txt = '';
            };
        };
        txt += '    </dict>\r\n';  

        // Playlists        
        var playlists = app.utils.createSharedList();
        var playlistTitles = [];
        var dups = {};

        txt += '    <key>Playlists</key>\r\n';
        txt += '    <array>\r\n';

        // Recursively process all playlists                
        var ReadPlaylists = async function (plst) {
            var items = plst.getChildren();
            await items.whenLoaded();

            var i, newplst, title;
            for (i = 0; i < items.count; i++) {
                items.locked(function () {
                    newplst = items.getValue(i);
                })
                title = newplst.title;
                if (!dups[title]) {
                    dups[title] = true;
                    playlistTitles.push(title);
                    playlists.add(newplst);
                }
                await ReadPlaylists(newplst);
            };
        }
        await ReadPlaylists(app.playlists.root);
        
        // Go through the list and export each playlist    
        progress.maxValue = playlists.count;
        progress.value = 0;

        let idx, plst;
        let root_id = app.playlists.root.id;
        for (idx = 0; idx < playlists.count; idx++) {
            playlists.locked(function () {
               plst = playlists.getValue(idx);
            })             
            let title = playlistTitles[idx];
            progress.text = ' (' + title + ')';
            progress.value = idx / playlists.count;
            let tracks = plst.getTracklist();            
            await tracks.whenLoaded();
             
            txt += '    <dict>\r\n';
            txt += '        <key>Name</key><string>' + window._MapXML( title) + '</string>\r\n';
            txt += '        <key>Playlist ID</key><integer>' + plst.id + '</integer>\r\n';
            txt += '        <key>Playlist Persistent ID</key><string>' + plst.id + '</string>\r\n';
            if (plst.parent && (plst.parent.id != root_id))
                txt += '        <key>Parent Persistent ID</key><string>' + plst.parent.id + '</string>\r\n';
            txt += '        <key>All Items</key><true/>\r\n';
            txt += '        <key>Playlist Items</key>\r\n';
            txt += '        <array>\r\n';
            let iTrack, track;
            for (iTrack = 0; iTrack < tracks.count; iTrack++) {                
                tracks.locked(function () {
                   track = tracks.getValue(iTrack);
                })     
                txt += '            <dict>\r\n';
                txt += '                <key>Track ID</key><integer>'+ track.id +'</integer>\r\n';
                txt += '            </dict>\r\n';
                if (iTrack % 100 == 0) {                                      
                    if (!progress.terminated) {
                        await app.filesystem.saveTextToFileAsync(resfilename, txt, {
                            append: true,
                            dontClose: true
                        });
                        txt = '';
                    } else {
                        break;
                    }
                }                                
            };
            txt += '        </array>\r\n';
            txt += '    </dict>\r\n';          
        };        
                                        
        // final callback
        if (progress.terminated) {
            // export canceled, delete file
            await app.filesystem.saveTextToFileAsync(resfilename, '', {                
                dontClose: false // to close the opened file
            });
            await app.filesystem.deleteFileAsync(resfilename);            
            return;
        }

        txt += '    </array>\r\n';
        txt += '    </dict>\r\n';
        txt += '</plist>\r\n';
        await app.filesystem.saveTextToFileAsync(resfilename, txt, {
            append: true,
            dontClose: false // to close the opened file
        });                          
    }
});

actions.exportToiTunes = {
    title: 'iTunes Library XML' + '...',
    hotkeyAble: true,
    icon: 'exportToFile',    
    disabled: false,
    execute: function () {                         
        let coll = app.collections.getEntireLibrary();
        let selTracks = coll.getTracklist();                
        selTracks.whenLoaded().then(async function (selTracks) {  
            if (selTracks.count > 0) {
                let defSortString = selTracks.autoSortString;
                if (!defSortString)
                    defSortString = 'albumArtist ASC;album ASC;discNo ASC;order ASC;title ASC';
                let exportSett = app.getValue('exportToiTunes_settings', {
                    extension: 'xml',
                    initialDir: '',
                    columns: [ 'title', 'artist', 'album', 'genre', 'albumArtist', 'length', 'date', 
                                'rating', 'bitrate', 'path', 'playCounter', 'skipped', 'lastPlayed', 'lastSkipped', 'discNo', 'order', 'filesize'],
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
                        await selTracks.setAutoSortAsync(exportSett.sortString);
                        let itH;
                        let filter = '';
                        for (let i = 0; i < window.sendToiTunesHandlers.length; i++) {
                            itH = window.sendToiTunesHandlers[i];
                            if (filter)
                                filter += '|';
                            filter += itH.title + ' (*.' + itH.ext + ')|*.' + itH.ext;
                        }
                        app.utils.dialogSaveFile(exportSett.initialDir, exportSett.extension, filter, _('Exporting') + '...').then(async function (resfilename) {
                            if (!resfilename)
                                return;
                            let ext = getFileExt(resfilename).toLowerCase();
                            let hndlr = undefined;
                            for (let i = 0; i < window.sendToiTunesHandlers.length; i++) {
                                itH = window.sendToiTunesHandlers[i];
                                if (itH.ext === ext) {
                                    hndlr = itH;
                                    break;
                                }
                            }
                            if (!hndlr)
                                return;
                            exportSett.initialDir = getFileFolder(resfilename);
                            exportSett.extension = ext;
                            app.setValue('exportToiTunes_settings', exportSett);
                            let progress = app.backgroundTasks.createNew();
                            progress.leadingText = _('Exporting') + '...' + ' (' + resfilename + ')';
                            try {
                                await hndlr.saveFunc(selTracks, resfilename, exportSett, progress);
                            } catch (e) {
                                myAlert( 'error: ' + e); // throw e; would just return rejected promise, so use alert() to be catched by Eureka
                            }
                            if (!progress.terminated)
                                progress.terminate();
                        });
                    }
                };
                app.listen(dlg, 'closed', dlg.onClosed);
            }
        });        
    }
};

window._menuItems.export.action.submenu.push({
    action: actions.exportToiTunes,
    order: 50,
    grouporder: 10
});