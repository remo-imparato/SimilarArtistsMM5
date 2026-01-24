/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

actions.exportPodcasts = {
    title: _('Export subscribed podcasts') + '...',
    icon: 'export',
    hotkeyAble: true,
    category: actionCategories.export,
    disabled: function () {
        return !app.podcasts.isAnyPodcastSubscribed();
    },
    execute: function () {
        requestAnimationFrameMM(function () { // needed so menu is properly closed, #19541
            var promise = app.utils.dialogSaveFile('', 'opml', 'OPML(*.opml)|*.opml', _('Save as'));
            promise.then(function (filename) {
                if (filename != '') {

                    var opml = '<?xml version="1.0" encoding="UTF-8"?>' +
                        '<opml version="1.0">' +
                        '<head>' +
                        '<title>' + escapeXml(app.utils.removeFilenameExtension(GetFName(filename))) + '</title>' +
                        '</head>' +
                        '<body>';

                    var list = app.podcasts.getPodcastList();
                    list.whenLoaded().then(function () {
                        list.locked(function () {
                            var podcast;
                            var iPodcast = 0;
                            for (let i = 0; i < list.count; i++) {
                                podcast = list.getFastObject(i, podcast);
                                if (podcast.url != '') { // is subscribed
                                    var ol = '<outline id = "' + iPodcast + '" text="' + escapeXml(podcast.title) + '" type="rss" xmlUrl="' + escapeXml(podcast.url) + '"/>"';
                                    opml = opml + ol;
                                    iPodcast++;
                                }
                            }
                        });
                        opml = opml + '</body>';
                        opml = opml + '</opml>';
                        app.filesystem.saveTextToFileAsync(filename, opml);
                    });
                }
            });
        });
    }
}

window._menuItems.podcasts.action.submenu.push(actions.exportPodcasts);
window._menuItems.export.action.submenu.push({
    action: actions.exportPodcasts,
    order: 20,
    grouporder: 10
});

//hotkeys.addHotkey('Ctrl+Shift+E', 'exportPodcasts');
