/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

'use strict';
import './gridview';
import './trackListView';
import './viewHeader';
import ViewHeader from './viewHeader';
/**
@module UI
*/
/**
UI PodcastHeader element

@class PodcastHeader
@constructor
@extends Control
*/
export default class PodcastHeader extends ViewHeader {
    initialize(rootelem, params) {
        params = params || {};
        params.icon = params.icon || 'podcast';
        params.useCollage = false;
        params.useGenres = false;
        params.useSourceSwitcher = false;
        params.useShuffleButton = false;
        params.artworkSizeClass = 'middleImageSize';
        params.artworkExactSizeClass = 'middleImageSizeExact';
        params.headerHeightClass = 'middleHeaderHeight';
        super.initialize(rootelem, params);
        let UI = this.UI;
        this.podcast = null;
        let titleInfo = document.createElement('div');
        titleInfo.innerHTML =
            '<div class="paddingBottomLarge">' +
                '    <label data-id="podcastGenerator" class="noLeftPadding"></label>' +
                '    <label data-id="podcastEpisodeInfo"></label>' +
                '</div>';
        UI.descriptionContainer.insertBefore(titleInfo, UI.wikiDescription);
        UI.podcastEpisodeInfo = qeid(titleInfo, 'podcastEpisodeInfo');
        UI.podcastGenerator = qeid(titleInfo, 'podcastGenerator');
        UI.headerTitle.classList.add('clickable');
        UI.headerTitle.controlClass.editable = false;
        this.localListen(this.UI.headerTitle, 'click', function () {
            if (this.podcast.webLink != '')
                uitools.openWeb(this.podcast.webLink);
            else
                uitools.openWeb(this.podcast.podcastURL);
        }.bind(this));
        setVisibilityFast(UI.headerTitleParenthesisContainer, false);
        this._imageCtrl.addToContextMenu([{
                action: bindAction(window.actions.updatePodcastImage, () => {
                    return this.podcast;
                }),
                order: 10,
                grouporder: 10
            }]);
        this._initButtons();
    }
    getTracklist() {
        let tds;
        if (this.podcast) {
            tds = this.podcast.getTracklist();
        }
        return tds;
    }
    _initButtons() {
        let _this = this;
        let res = [{
                action: bindAction(window.actions.updatePodcast, () => {
                    return _this.podcast;
                }),
                order: 10,
                grouporder: 10
            }, {
                action: {
                    title: function () {
                        return _('Unsubscribe');
                    },
                    icon: 'delete',
                    visible: function () {
                        return (_this.podcast.podcastURL != '');
                    },
                    execute: function () {
                        uitools.unsubscribePodcast(_this.podcast).then(() => {
                            navUtils.getOutOfActiveView();
                        });
                    }
                },
                order: 20,
                grouporder: 10
            }, {
                action: {
                    title: function () {
                        return _('Edit');
                    },
                    icon: 'edit',
                    execute: function () {
                        uitools.editPodcast(_this.podcast);
                    }
                },
                order: 30,
                grouporder: 10
            }, {
                action: bindAction(window.actions.updatePodcastImage, () => {
                    return _this.podcast;
                }),
                order: 40,
                grouporder: 10
            }, {
                action: bindAction(window.actions.pin, () => {
                    return _this.podcast;
                }),
                order: 50,
                grouporder: 10,
            }, {
                action: bindAction(window.actions.unpin, () => {
                    return _this.podcast;
                }),
                order: 60,
                grouporder: 10
            }];
        res.push({
            action: actions.updatePodcasts,
            order: 10,
            grouporder: 20
        });
        res.push({
            action: actions.subscribePodcast,
            order: 20,
            grouporder: 20
        });
        this.UI.btnMenu.controlClass.menuArray = res;
    }
    updateImage(forceUpdate) {
        let UI = this.UI;
        if (!this.podcast || this._cleanUpCalled)
            return;
        if (!forceUpdate && !this._imageCtrl.emptyArtwork)
            return;
        let _this = this;
        let pixelSize = parseInt(getParent(this._imageCtrl.container).offsetWidth) || 500;
        this._imageCtrl.hideImage();
        cancelPromise(this._promises.podcastThumb);
        let token = this.podcast.getThumbAsync(pixelSize, pixelSize, function (imageLink) {
            if (!_this.podcast) // data source already cleared
                return;
            _this._promises.podcastThumb = undefined;
            if (imageLink && (imageLink !== '-')) {
                _this._imageCtrl.showImage(imageLink);
            }
        });
        this._promises.podcastThumb = {
            cancel: function () {
                app.cancelLoaderToken(token);
                _this._promises.podcastThumb = undefined;
            }.bind(this)
        };
    }
    updateValues() {
        let UI = this.UI;
        let podcast = this.podcast;
        if (!podcast) {
            UI.headerTitle.innerText = '';
            UI.podcastGenerator.innerText = '';
            UI.podcastEpisodeInfo.innerText = '';
            UI.wikiDescription.innerText = '';
            this.wikidesc = '';
            setVisibility(UI.podcastGenerator, false);
            this._imageCtrl.hideImage();
            notifyLayoutChange();
            return;
        }
        UI.headerTitle.innerText = podcast.title;
        setVisibilityFast(UI.podcastGenerator, (podcast.generator != ''));
        UI.podcastGenerator.innerText = _('Author') + ': ' + podcast.generator;
        UI.podcastEpisodeInfo.innerText = _('Episodes') + ': ' + podcast.getEpisodesCount('downloaded') + '/' + podcast.getEpisodesCount('total');
        if (podcast.podcastURL == '') {
            UI.wikiDescription.innerText = this.wikidesc = _('This podcast is unsubscribed. Edit the podcast URL to re-activate it.');
        }
        else {
            UI.wikiDescription.innerText = this.wikidesc = podcast.description;
        }
        this.updateImage();
        notifyLayoutChangeUp(UI.wikiDescription);
    }
    refresh() {
        if (this.podcast && !this.podcast.deleted && !this._cleanUpCalled)
            this.updateValues(); // to refresh all values
    }
    get dataSource() {
        return this.podcast;
    }
    set dataSource(podcast) {
        if (this.podcast != podcast) {
            if (this.podcast && this._onPodcastChange)
                app.unlisten(this.podcast, 'change', this._onPodcastChange);
            this.podcast = podcast;
            if (!podcast) {
                this._imageCtrl.dataObject = undefined;
                this._imageCtrl.hideImage();
                return;
            }
            this._onPodcastChange = this.localListen(this.podcast, 'change', this.refresh.bind(this));
            this._imageCtrl.dataObject = this.podcast;
            this.updateImage(true);
        }
        this.updateValues();
    }
}
registerClass(PodcastHeader);
