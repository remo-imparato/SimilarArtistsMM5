/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

nodeHandlers.playlists.menuAddons = nodeHandlers.playlists.menuAddons || [];
nodeHandlers.playlists.menuAddons.push(function (node) {
    if (node && node.dataSource && !node.dataSource.parent) {
        return [{
            action: actions.exportAllPlaylists,
            order: 90,
            grouporder: 20
        }];
    };
    return [];
});
