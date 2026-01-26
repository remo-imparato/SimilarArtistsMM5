/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

DeviceConfig.prototype.tabs.options.panels.pnl_Playlists.load = function (device, reload) {

    var sett = JSON.parse(device.getPlaylistSettingsJSON());

    this.qChild('chbSyncPlaylists').controlClass.checked = sett.generateFor.playlists;

    this.qChild('lblPlaylists').textContent = sprintf(_('Also generate playlists on \'%s\' for:'), device.name),
        this.qChild('chbGenArtistPlaylist').controlClass.checked = sett.generateFor.artists;
    this.qChild('chbGenAlbumPlaylist').controlClass.checked = sett.generateFor.albums;
    this.qChild('chbGenLocationPlaylist').controlClass.checked = sett.generateFor.locations;

    var format = sett.storage.playlistFormat;
    if (format == '')
        format = 'M3U';
    this.qChild('cbPlaylistFormat').controlClass.value = format;
    var plstExts = device.getSupportedPlaylistFormats();
    if (sett.storage.playlistFormats)
        plstExts.commaText = sett.storage.playlistFormats;
    if (!plstExts.count)
        plstExts.add(format);
    var cbPlaylistFormat = this.qChild('cbPlaylistFormat');
    cbPlaylistFormat.controlClass.dataSource = plstExts;

    if (!reload) {
        this.localListen(this.qChild('btnSetPlaylistFormats'), 'click', function () {
            var dlg = uitools.openDialog('dlgFileTypes', {
                modal: true,
                usedExts: plstExts,
                dataSource: app.filesystem.getPlaylistExtensionsAsync()
            });
            dlg.whenClosed = function () {
                if (dlg.modalResult == 1) {
                    var list = dlg.getValue('getExts')();
                    cbPlaylistFormat.controlClass.dataSource = list;
                    plstExts = list;
                }
            };
            app.listen(dlg, 'closed', dlg.whenClosed);
        });
        addEnterAsClick(this, this.qChild('btnSetPlaylistFormats'));
    }

    this.qChild('chbPlstRelPaths').controlClass.checked = sett.m3u.useRelativePaths;
    setVisibility(this.qChild('chbPlstRelPaths'), (format == 'M3U') || (format == 'M3U8') || (format == 'PLS'));
    this.qChild('chbLinuxSeparator').controlClass.checked = sett.m3u.linuxFolderSeparator;
    setVisibility(this.qChild('chbLinuxSeparator'), (format == 'M3U') || (format == 'M3U8') || (format == 'PLS'));
    this.qChild('chbUseUnicode').controlClass.checked = sett.m3u.useUnicode;
    setVisibility(this.qChild('chbUseUnicode'), (format == 'M3U') || (format == 'M3U8') || (format == 'PLS'));
    this.qChild('chbExtendedM3U').controlClass.checked = sett.m3u.useExtendedM3U;
    setVisibility(this.qChild('chbExtendedM3U'), (format == 'M3U') || (format == 'M3U8'));

    this.qChild('cbPlaylistDir').controlClass.value = sett.storage.destDirectory;

    this.qChild('chbOrganizePlaylists').controlClass.checked = sett.organize.enabled;
    this.qChild('chbOrganizePlaylistType').controlClass.disabled = !sett.organize.enabled;
    this.localListen(this.qChild('chbOrganizePlaylists'), 'click', function () {
        this.qChild('chbOrganizePlaylistType').controlClass.disabled = !this.qChild('chbOrganizePlaylists').controlClass.checked;
    }.bind(this))
    addEnterAsClick(this, this.qChild('chbOrganizePlaylists'));
    this.qChild('chbOrganizePlaylistType').controlClass.focusedIndex = sett.organize.type;
}

DeviceConfig.prototype.tabs.options.panels.pnl_Playlists.save = function (device) {

    var sett = JSON.parse(device.getPlaylistSettingsJSON());

    sett.generateFor.playlists = this.qChild('chbSyncPlaylists').controlClass.checked;

    sett.generateFor.artists = this.qChild('chbGenArtistPlaylist').controlClass.checked;
    sett.generateFor.albums = this.qChild('chbGenAlbumPlaylist').controlClass.checked;
    sett.generateFor.locations = this.qChild('chbGenLocationPlaylist').controlClass.checked;

    sett.storage.playlistFormat = this.qChild('cbPlaylistFormat').controlClass.value;
    sett.storage.playlistFormats = this.qChild('cbPlaylistFormat').controlClass.dataSource.commaText;

    sett.storage.destDirectory = this.qChild('cbPlaylistDir').controlClass.value;

    sett.m3u.useRelativePaths = this.qChild('chbPlstRelPaths').controlClass.checked;
    sett.m3u.linuxFolderSeparator = this.qChild('chbLinuxSeparator').controlClass.checked;
    sett.m3u.useUnicode = this.qChild('chbUseUnicode').controlClass.checked;
    sett.m3u.useExtendedM3U = this.qChild('chbExtendedM3U').controlClass.checked;

    sett.organize.enabled = this.qChild('chbOrganizePlaylists').controlClass.checked;
    sett.organize.type = this.qChild('chbOrganizePlaylistType').controlClass.focusedIndex;

    device.setPlaylistSettingsJSON(JSON.stringify(sett));
}
