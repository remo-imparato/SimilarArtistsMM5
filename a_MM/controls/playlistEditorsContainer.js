/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

requirejs('controls/control');

class PlaylistEditorsContainer extends Control {

    storeState () {
        var states = [];
        var e = this.container;
        for (var i = 0; i < e.childNodes.length; i++) {
            var ch = e.childNodes[i];
            if (ch.controlClass && ch.controlClass.playlist)
                states.push(window.nodeUtils.storeDataSource(ch.controlClass.playlist));
        }
        return {
            playlists: states,
            width: this.container.style.width
        };
    }

    restoreState(state) {
        if (state && state.playlists) {
            asyncForEach(state.playlists, (item, next) => {
                window.nodeUtils.restoreDataSource(item).then((playlist) => {
                    window.uitools.showPlaylistEditor(playlist, false, 'PlaylistEditorsContainer.restoreState', this.container);
                    next();
                }, next);
            }, () => {
                requestIdleCallback(()=>{
                    if (state && state.width && state.width != '0px') {
                        this.container.style.width = state.width;                  
                    }
                });
            });
        }        
    }

    showEditor(playlist, startEditTitle) {
        var e = this.container;
        setVisibility(e, true);

        var div;
        for (var i = 0; i < e.childNodes.length; i++) {
            var ch = e.childNodes[i];
            if (ch.controlClass && ch.controlClass.playlist && (ch.controlClass.playlist.id == playlist.id))
                div = ch;
        }

        if (!div) {
            requirejs('controls/playlistEditor');
            div = document.createElement('div');
            div.classList = 'animate verticalPanel flex fill column';
            e.appendChild(div);
            div.controlClass = new PlaylistEditor(div);
            div.controlClass.playlist = playlist;
        }
        if (startEditTitle)
            div.controlClass.startEditTitle();
        return div;
    }

}
registerClass(PlaylistEditorsContainer);
