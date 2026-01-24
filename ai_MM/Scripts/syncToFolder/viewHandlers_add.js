/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

var createProfile = {
    title: _('Set as sync target') + '...',
    icon: 'synchronize',
    execute: function () {
        navUtils.getFocusedFolder().then(function (initPath) {
            if (initPath) {
                messageDlg(_('This will create a new sync profile for this drive/folder so that you can sync files to this location as if it were a portable device.') + ' ' + _('Do you want to proceed?'), 'Confirmation', ['btnYes', 'btnNo'], {
                    defaultButton: 'btnYes'
                }, function (result) {
                    if (result.btnID === 'btnYes')
                        mediaSyncHandlers.syncToFolder.createSyncTarget(initPath); // adds new sync target (profile)                                                                                        
                });
            }
        });
    }
}

nodeHandlers.folder.menuAddons = nodeHandlers.folder.menuAddons || [];
nodeHandlers.folder.menuAddons.push({
    action: createProfile,
    order: 90,
    grouporder: 10
});

nodeHandlers.drive.menuAddons = nodeHandlers.drive.menuAddons || [];
nodeHandlers.drive.menuAddons.push({
    action: createProfile,
    order: 90,
    grouporder: 10
});

nodeHandlers.syncToFolder_FolderRoot = inheritNodeHandler('SyncToFolder_FolderRoot', 'Folder', {
    title: _('Content')
});
