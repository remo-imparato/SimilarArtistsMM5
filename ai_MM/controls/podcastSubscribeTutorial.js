/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

/**
@module UI
*/

requirejs('controls/control');

/**
UI PodcastSubscribeTutorial element

@class PodcastSubscribeTutorial
@constructor
@extends Control
*/

class PodcastSubscribeTutorial extends Control {

    initialize(elem, params) {
        super.initialize(elem, params);

        var div = document.createElement('div');
        div.classList.add('controlInfo');
        div.classList.add('padding');    
        div.innerHTML = sprintf(_('You are not subscribed to any podcast currently. To subscribe a podcast go to %s'), ['<div data-id="linkPodcastDirectories" class="hotlink inline">' + _('Podcast Directories') + '</div> ' + _('or') + ' <div data-id="linkNewPodcastSubscription" class="hotlink inline">' + _('Subscribe to a podcast manually by entering the feed link') + '</div>']);
        this.container.appendChild(div);

        this.linkNewPodcastSubscription = this.qChild('linkNewPodcastSubscription');
        app.listen(this.linkNewPodcastSubscription, 'click', function () {
            actions.subscribePodcast.execute();
        });

        this.linkPodcastDirectories = this.qChild('linkPodcastDirectories');
        app.listen(this.linkPodcastDirectories, 'click', function (e) {
            this.openView(app.podcasts, 'podcastDirectories', this.linkPodcastDirectories, isNewTabEvent(e));
        }.bind(this));

    }

    cleanUp() {
        app.unlisten(this.linkNewPodcastSubscription);
        app.unlisten(this.linkPodcastDirectories);
        super.cleanUp();
    }

}
registerClass(PodcastSubscribeTutorial);
