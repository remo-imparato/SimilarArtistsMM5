/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

(function () {
    var currState;
    var player = app.player;
    var track;
    var lastTrackInfo;
    var lastTrackPlayedDurationMS = 0;
    var lastTrackPlayStart;
    var satisfyPromise = undefined;

    var setTimestampNow = function () {
        if (lastTrackInfo) {
            lastTrackInfo.timestamp = Math.floor(Date.now() / 1000); // seconds from 00:00:00, January 1st 1970 UTC
        };
    };

    var getTrackInfo = function (track) {
        var trackInfo = {
            id: track.id,
            title: track.title,
            album: track.album,
            trackNumber: track.trackNumber,
            duration: Math.floor(track.songLength / 1000), // in seconds
            timestamp: 0, // will be set later on playback start
            nowplayingsent: false
        };
        var artists = track.artist.split(';', 1);
        trackInfo.artist = artists[0];
        artists = track.albumArtist.split(';', 1);
        trackInfo.albumArtist = artists[0];
        ODS('last.fm: prepared trackInfo: ' + JSON.stringify(trackInfo));
        return trackInfo;
    };

    var handleTrackChange = function () {
        var scs = lastfm.scrobblerState;
        lastTrackInfo = undefined; // reset so old value will not be used already

        if (satisfyPromise) {
            cancelPromise(satisfyPromise);
            satisfyPromise = undefined;
            ODS('last.fm: canceled satisfyPromise');
        }
        if (scs.scrobblerMode !== 'ModeOff') {
            var testTrack = player.getCurrentTrack(); // cannot use fast, we will need this for async operation
            track = testTrack;
            if (track && track.artist && track.title) {
                // save lastTrackInfo only for track, which could be submitted, i.e. has duration > 30s and fulfiled user conditions
                if ((track.songLength > 30000) && (!scs.scrobbleOnlyLibrary || (track.id > 0))) {
                    satisfyPromise = lastfm.trackSatisfyQueryData(track);
                    satisfyPromise.then(function (satisfies) {
                        if (satisfies && testTrack.isSame(track)) {
                            lastTrackInfo = getTrackInfo(track);
                            if (currState === 'play') {
                                // we are already playing the track, set timestamp now, we had not trackInfo before so it is not set
                                setTimestampNow();
                            }
                        } else {
                            if (satisfies)
                                ODS('last.fm: trackInfo for ' + testTrack.title + ' not prepared, already changed');
                            else
                                ODS('last.fm: trackInfo for ' + testTrack.title + ' not prepared, trackSatisfyQueryData returned false');
                        }
                        satisfyPromise = undefined;
                    }, function () {
                        ODS('last.fm: trackInfo for ' + testTrack.title + ' not prepared, promise canceled');
                    });
                } else {
                    ODS('last.fm: not submitting, songLength=' + track.songLength + ', id=' + track.id);
                }
            } else {
                if (!track) {
                    ODS('last.fm: no track');
                } else if (!track.artist) {
                    ODS('last.fm: no artist');
                } else
                    ODS('last.fm: no title');
            }
        } else
            ODS('last.fm: scrobblerMode=ModeOff');
        lastTrackPlayStart = 0;
        lastTrackPlayedDurationMS = 0;
    };

    var handleTrackEnd = function () {
        if ((lastfm.scrobblerState.scrobblerMode !== 'ModeOff') && lastTrackInfo && lastTrackPlayedDurationMS) {
            // send scrobble of previous track
            // lastTrackInfo saved only for tracks that should be submitted, we only have to check played time
            var playedS = lastTrackPlayedDurationMS / 1000;
            if ((lastTrackInfo.timestamp > 0) && ((playedS >= 240) || (playedS >= (lastTrackInfo.duration / 2)))) { // played for 4 minutes or half of duration
                if (lastfm.scrobblerState.scrobblerMode === 'ModeCache')
                    lastfm.addToCache(lastTrackInfo);
                else
                    lastfm.sendScrobble(lastTrackInfo);
            } else {
                ODS('last.fm: not scrobbling, timestamp=' + lastTrackInfo.timestamp + ', playedS=' + playedS + ', duration=' + lastTrackInfo.duration);
            }
        } else {
            if (!lastTrackInfo)
                ODS('last.fm: not scrobbling, lastTrackInfo undefined');
            else if (!lastTrackPlayedDurationMS)
                ODS('last.fm: not scrobbling, lastTrackPlayedDurationMS=' + lastTrackPlayedDurationMS);
            else
                ODS('last.fm: not scrobbling, scrobblerMode=' + lastfm.scrobblerState.scrobblerMode);
        }
        lastTrackPlayedDurationMS = 0;
    };
    
    var handleForcedScrobble = function (paramTrack) {
        if ((lastfm.scrobblerState.scrobblerMode !== 'ModeOff') && paramTrack) {
            lastTrackInfo = getTrackInfo(paramTrack);
            setTimestampNow();
            // send scrobble of sent track (from server)
            if (lastfm.scrobblerState.scrobblerMode === 'ModeCache')
                lastfm.addToCache(lastTrackInfo);
            else
                lastfm.sendScrobble(lastTrackInfo);
        } else {
            if(!paramTrack)
                ODS('last.fm: not scrobbling, paramTrack undefined')
            else
                ODS('last.fm: not scrobbling, scrobblerMode=' + lastfm.scrobblerState.scrobblerMode);
        }
    };

    var handleTrackPlay = function () {
        setTimestampNow();
        lastTrackPlayStart = Date.now();
        var scs = lastfm.scrobblerState;
        if (scs.showNowplaying && (scs.scrobblerMode === 'ModeOn')) {
            if (lastTrackInfo) {
                if (!lastTrackInfo.nowplayingsent) {
                    lastfm.sendNowPlayingTrack(lastTrackInfo);
                    lastTrackInfo.nowplayingsent = true;
                }
            } else if (satisfyPromise) {
                // we do not have track info yet, wait for it
                satisfyPromise.then(function () {
                    ODS('last.fm: handleTrackPlay - satisfyPromise called');
                    if (!window._cleanUpCalled && lastTrackInfo && !lastTrackInfo.nowplayingsent) {
                        lastfm.sendNowPlayingTrack(lastTrackInfo);
                        lastTrackInfo.nowplayingsent = true;
                    }
                });
            }
        }
    };

    var onPlaybackState = function (state, paramTrack) {
        ODS('last.fm: onPlaybackState ' + state);
        switch (state) {
            case 'unpause':
                if (currState !== 'play') {
                    currState = 'play';
                    lastTrackPlayStart = Date.now();
                }
                break;
            case 'play':
                if (currState !== 'play') {
                    currState = 'play';
                    handleTrackPlay();
                }
                break;
            case 'stop':
            case 'end':
                if (currState !== state) {
                    if (lastTrackPlayStart > 0) {
                        lastTrackPlayedDurationMS += Date.now() - lastTrackPlayStart;
                    }
                    lastTrackPlayStart = 0;
                    handleTrackEnd();
                    currState = state;
                }
                break;
            case 'pause':
                currState = state;
                if (lastTrackPlayStart > 0) {
                    lastTrackPlayedDurationMS += Date.now() - lastTrackPlayStart;
                }
                lastTrackPlayStart = 0;
                break;
            case 'trackChanged':
                handleTrackChange();
                break;
            case 'scrobble':
                handleForcedScrobble(paramTrack);
                break;
        };
    };

    localListen(player, 'playbackState', onPlaybackState);
    handleTrackChange(); // set initial state
})();
