/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

nodeHandlers.deezerFavoriteArtists = inheritNodeHandler('DeezerFavoriteArtists', 'Base', {   
    title: function (node) {
        return _('Artists');
    },
    icon: 'artist',
    viewAs: ['nodeList', 'rowNodeList'],
    getChildren: function (node) {
        return new Promise(function (resolve, reject) {
            var device = nodeUtils.getNodeDevice(node);

            var service = mediaSyncHandlers[device.handlerID].getService(device);

            service.listFavArtists().then(
                function (list) {
                    for (var i = 0; i < list.count; i++) {
                        var itm = list.getValue(i);
                        node.addChild(itm, 'deezerFavoriteArtist');
                    };
                    resolve();
                },
                reject);
        });
    }
});

nodeHandlers.deezerFavoriteArtist = inheritNodeHandler('DeezerFavoriteArtist', 'Base', {
    title: function (node) {
        return node.dataSource.name;
    },
    icon: 'artist',
    getViewDataSource: function (view) {
        var device = nodeUtils.getNodeDevice(view.viewNode);
        var service = mediaSyncHandlers[device.handlerID].getService(device);
        return service.listArtistContent(view.viewNode.dataSource);
    },
    viewAs: ['tracklist', 'groupedTracklist', 'albumlist'],
});

nodeHandlers.deezerFavoriteAlbums = inheritNodeHandler('DeezerFavoriteAlbums', 'Base', {   
    title: function (node) {
        return _('Albums');
    },
    icon: 'album',
    viewAs: ['nodeList', 'rowNodeList'],
    getChildren: function (node) {
        return new Promise(function (resolve, reject) {
            var device = nodeUtils.getNodeDevice(node);

            var service = mediaSyncHandlers[device.handlerID].getService(device);

            service.listFavAlbums().then(
                function (list) {
                    for (var i = 0; i < list.count; i++) {
                        var itm = list.getValue(i);
                        node.addChild(itm, 'deezerFavoriteAlbum');
                    };
                    resolve();
                },
                reject);
        });
    }
});

nodeHandlers.deezerFavoriteAlbum = inheritNodeHandler('DeezerFavoriteAlbum', 'Base', {
    title: function (node) {
        return node.dataSource.name;
    },
    icon: 'album',
    getViewDataSource: function (view) {
        var device = nodeUtils.getNodeDevice(view.viewNode);
        var service = mediaSyncHandlers[device.handlerID].getService(device);
        return service.listAlbumContent(view.viewNode.dataSource);
    },
    viewAs: ['tracklist', 'groupedTracklist', 'albumlist'],
});

