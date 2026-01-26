/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

'use strict';
import Control from './control';
registerFileImport('controls/lyricsWindow');
/**
@module UI
*/
requirejs('controls/popupmenu');
requirejs('helpers/searchTools');
/**
Lyrics window element

@class LyricsWindow
@constructor
@extends Control
*/
export default class LyricsWindow extends Control {
    initialize(parentEl, params) {
        super.initialize(parentEl, params);
        this.container.classList.add('initialSize');
        this._dataSource = undefined;
        this.helpContext = 'Getting_Track_Information_from_the_Internet#Lyrics_lookup';
        let loadSettings = function () {
            let sett = window.settings.get('Options');
            this._autoSave = sett.Options.SaveMissingLyrics && window.uitools.getCanEdit();
            this._autoSearch = !!sett.Options.SearchMissingLyrics;
        }.bind(this);
        this.localListen(app, 'settingschange', function () {
            loadSettings();
        });
        loadSettings();
        for (let key in params) {
            this[key] = params[key];
        }
        this._createlayout();
        // set current playing track by default
        this.dataSource = app.player.getCurrentTrack();
        this.localListen(app.player, 'playbackState', function (state) {
            if (state === 'trackChanged') {
                this.dataSource = app.player.getCurrentTrack();
            }
        }.bind(this));
        this.localListen(window, 'panelstate', function (e) {
            if (e.detail.panelID === 'lyricsWindow') {
                if (e.detail.state) // became visible, update
                    this._updateMonitoredTrack();
            }
        }.bind(this));
    }
    cleanUp() {
        if (this._dataSource && this.__trackChangeFunc) {
            app.unlisten(this._dataSource, 'change', this.__trackChangeFunc);
            this.__trackChangeFunc = undefined;
        }
        super.cleanUp();
    }
    getFontSize() {
        let size = '1em';
        let s = app.getValue('artWindow', {
            fontSize: 'smaller'
        });
        if (s.fontSize == 'smaller')
            size = '0.85em';
        else if (s.fontSize == 'smallest')
            size = '0.7em';
        else if (s.fontSize == 'larger')
            size = '1.2em';
        else if (s.fontSize == 'largest')
            size = '2em';
        return size;
    }
    _createlayout() {
        let div = document.createElement('div');
        div.className = 'flex column stretchHeight stretchWidth listview';
        div.setAttribute('data-hideInFullWindowMode', '1');
        div.innerHTML =
            '<div data-id="header" class="flex row lvHeader" >' +
                '    <div data-id="saveLyricsBtn" data-icon="save" data-tip="Save lyrics to tag" style="display: none; position: fixed" class="lvHeaderSingleItem menuButton" data-control-class="ToolButton"></div>' +
                '    <div class="lvHeaderSingleItem fill flex">' +
                '        <div data-id="lblMode" class="inline fill textEllipsis">' + _('Lyrics') + '</div>' +
                '    </div>' +
                '</div>' +
                '<div class="fill scrollable padding">' +
                '  <div data-id="fLyrics" class="textCenter" style="font-size: ' + this.getFontSize() + '">' +
                '    <div data-id="lyricsParagraph" data-control-class="Editable" data-init-params="{multiline: true}" class="inline" data-bind="func: templates.lyricsFunc(div, item, el, params)">' +
                '    </div>' +
                '  </div>' +
                '</div>';
        this.container.appendChild(div);
        initializeControls(this.container);
        precompileBinding(this.container, this);
        this.saveBtn = this.qChild('saveLyricsBtn');
        let lyricsParagraph = this.qChild('lyricsParagraph');
        let lblMode = this.qChild('lblMode');
        this.localListen(app.player, 'playbackState', (state) => {
            if (state == 'trackChanged') {
                let track = app.player.getCurrentTrack();
                if (track)
                    lblMode.innerText = _('Lyrics') + ' (' + track.summary + ')';
            }
        });
        this.localListen(this.saveBtn, 'click', () => {
            if (this.dataSource) {
                let value = lyricsParagraph.innerText;
                let item = this.dataSource;
                item.setLyricsAsync(value).then(function () {
                    item.commitAsync();
                });
            }
        });
        this.localListen(app, 'settingschange', () => {
            let fLyrics = this.qChild('fLyrics');
            fLyrics.style.fontSize = this.getFontSize();
        });
        this.localListen(settings.observer, 'change', () => {
            this._updateMonitoredTrack(true);
            lyricsParagraph.controlClass.editable = window.uitools.getCanEdit();
        });
    }
    _updateMonitoredTrackNow(forced) {
        if (isVisible(this.container) && (forced || (this._dataSource !== this._previousItem))) {
            if (this.bindFn) {
                this.bindFn(this.container, this._dataSource, {
                    autoSearch: this._autoSearch,
                    saveLyrics: this._autoSave,
                });
            }
            this._previousItem = this._dataSource;
        }
    }
    _updateMonitoredTrack(forced) {
        this.requestTimeout(() => {
            this._updateMonitoredTrackNow(forced);
        }, 50, 'updateMonitoredTrack');
    }
    refresh(alsoLayout) {
        this._layoutChangeRequest = alsoLayout;
        this._updateMonitoredTrackNow();
        this._layoutChangeRequest = false;
    }
    get dataSource() {
        return this._dataSource;
    }
    set dataSource(value) {
        if (this._dataSource !== value) {
            if (this._dataSource) {
                app.unlisten(this._dataSource, 'change', this.__trackChangeFunc);
            }
            this._dataSource = value;
            this._updateMonitoredTrack();
            if (this._dataSource) {
                this._lastArtist = this._dataSource.artist;
                this._lastTitle = this._dataSource.title;
                this.__trackChangeFunc = app.listen(this._dataSource, 'change', function () {
                    // update only in cases
                    //   1) artist or title changed and we have only not saved lyrics
                    //   2) lyrics changed
                    if (this._cleanUpCalled)
                        return;
                    let lp = this.qChild('lyricsParagraph');
                    if (!lp || !this._dataSource)
                        return;
                    if (this.saveBtn && isVisible(this.saveBtn)) {
                        if ((this._lastArtist !== this._dataSource.artist) || (this._lastTitle !== this._dataSource.title)) {
                            this._lastArtist = this._dataSource.artist;
                            this._lastTitle = this._dataSource.title;
                            this._updateMonitoredTrack(true);
                        }
                        else
                            return;
                    }
                    else {
                        this.localPromise(this._dataSource.getLyricsAsync()).then(function (lyrics) {
                            if (lp.controlClass && (lyrics !== lp.controlClass.lastLyrics)) {
                                this._updateMonitoredTrack(true);
                            }
                            else
                                return;
                        }.bind(this));
                    }
                }.bind(this));
            }
            else {
                this._lastArtist = undefined;
                this._lastTitle = undefined;
            }
        }
    }
    get autoSearch() {
        return this._autoSearch;
    }
    set autoSearch(value) {
        this._autoSearch = value;
    }
}
registerClass(LyricsWindow);
