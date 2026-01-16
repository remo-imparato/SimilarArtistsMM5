/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

// A simple script that swaps the content of Title and Artist fields of selected tracks

actions.swapArtistTitle = {
    title: _('Swap Artist and Title'),
    hotkeyAble: true,
    icon: 'synchronize',
    disabled: uitools.notMediaListSelected,
    visible: window.uitools.getCanEdit,
    execute: async function () {
        var list = await uitools.getSelectedTracklist().whenLoaded();
        if (list.count === 0) {
            return;
        }
		
        var msg = sprintf(_('Are you sure that you want to modify %d files ?'), list.count);
        messageDlg(msg, 'Confirmation', ['btnYes', 'btnNo'], {
            defaultButton: 'btnNo',
            title: _('Swap Artist and Title'),
        }, function (result) {
            if (result.btnID === 'btnYes') {
				var tmp;
				list.forEach(function(itm) {
					// Swap the fields
					itm.beginUpdate();
					tmp = itm.title;
					itm.title = itm.artist;
					if(itm.albumArtist === itm.artist) {    // Modify Album Artist as well if is the same as Artist}
					  itm.albumArtist = tmp;
					};
					itm.artist = tmp;
					itm.endUpdate();
				});
				list.commitAsync();  
            }
        });                      
    }
}

window._menuItems.editTags.action.submenu.push({
        action: actions.swapArtistTitle,
        order: 20,
        grouporder: 10
});