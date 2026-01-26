/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

requirejs('helpers/youtubeHelper');
requirejs('utils');

var init = function () {
    var ytFrame = qid('ytFrame');
    var intPlayer = qid('intPlayer');
    var mouseEventsShield = qid('mouseEventsShield');

    intPlayer.controlClass.localListen(mouseEventsShield, 'contextmenu', function (evt) {
        evt.stopPropagation();
        evt.preventDefault();
    }, true);

    var youtubePlayerURL = 'https://www.mediamonkey.com/client/youtube.php?id=';

    // YT player state constants
    var YTPlayerStateUNSTARTED = -1;
    var YTPlayerStateENDED = 0;
    var YTPlayerStatePLAYING = 1;
    var YTPlayerStatePAUSED = 2;
    var YTPlayerStateBUFFERING = 3;
    var YTPlayerStateCUED = 5;

    var player = app.player;
    window.isPlaying = false;
    window.isPaused = false;
    var lastWidth, lastHeight, lastpath, lastSearchResultIndex, lastSearchResult, lastSearchedSD, lastTime;
    var tmpSD, currSD;
    var _restoreBookmark, _bookmarkToRestore;
    var wasRButtonPressed;

    var pauseAfterLoad = false;
    var stopAfterLoad = false;
    var seekTime = undefined;
    var ignoreError = false;
    var openingVideo = false;
    
    var runPlayerCommand = function (cmd, data) {
        ODS('YoutubeWindow: runPlayerCommand ' + cmd);
        if (ytFrame && ytFrame.contentWindow) {
            var msg = {
                cmd: cmd,
                data: data
            };
            ytFrame.contentWindow.postMessage(JSON.stringify(msg), '*');
        }
    };

    var layoutchangeHandler = function (evt) {
        var w = intPlayer.clientWidth;
        var h = intPlayer.clientHeight;

        if (!evt || (lastWidth !== w) || (lastHeight !== h)) {
            ytFrame.width = w + 'px';
            ytFrame.height = h + 'px';
            lastHeight = h;
            lastWidth = w;
            runPlayerCommand('setSize', [w, h]);
        }
    };

    intPlayer.controlClass.localListen(intPlayer, 'layoutchange', layoutchangeHandler);

    var isOurTrack = function () {
        var res = false;
        tmpSD = player.getFastCurrentTrack(tmpSD);
        if (tmpSD && currSD) {
            res = (tmpSD.path === currSD.path);
        }
        return res;
    };

    var makeTooltipString = function (item) {
        if (!item)
            return '';
        var dataTip = '';
        if (item.thumbnail) {
            dataTip += '<img style=\'float:left; padding: 4px; max-width: 120px; maxHeight: 120px;\' src=\'' + item.thumbnail + '\'>';
        }
        if (item.title)
            dataTip += convertSpecialToEntities(item.title) + '</br>';
        if (item.comment) {
            var desc = item.comment.replace(/\r\n/g, '</br>').replace(/["]/g, '\''); // quote to apostrophs so we can merge strings easily;
            dataTip += '<hr>' + desc.replace(/\n/g, '</br>');
        }
        return dataTip;
    };

    var getIDFromURL = function (url) {
        var regExp = /^.*\b(youtu\.be|youtube\.com|youtube-nocookie\.com)\/(v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        var match = url.match(regExp);
        if (match && match[3].length == 11) {
            return match[3];
        } else {
            return undefined;
        }
    };

    var load = function (videoid) {
        openingVideo = true;
        runPlayerCommand('loadVideoById', [videoid]);
    };

    var handleTrackEnd = function (isOur) {
        if (isPlaying || isPaused) {
            isPlaying = false;
            isPaused = false;
            if (isOur || ((isOur === undefined) && isOurTrack()))
                player.htmlPlaybackState.state = 'end';
        }
    };

    var play = function () {
        runPlayerCommand('playVideo');
    };

    var playFile = function (sd) {
        var videoid = getIDFromURL(sd.path);
        if (!videoid)
            return;
        var newUrl = youtubePlayerURL + videoid;
        _restoreBookmark = true;
        ODS('YoutubeWindow: opening URL ' + newUrl);
        if (ytFrame.src) {
            // already loaded window, just change video
            if (ytFrame.playerReady) {
                load(videoid);
            }
        } else {
            stopAfterLoad = false;
            ytFrame.src = newUrl;
        }
    };

    var pause = function () {
        if(openingVideo) {
            pauseAfterLoad = true;
            return;
        }
        if (isPlaying) {
            runPlayerCommand('pauseVideo');
            isPlaying = false;
        }
    };
    
    var clearVideo = function () {
        // workaround to clear player, as Google already does not support clearVideo command, #17579
        setVisibilityFast(ytFrame, false);
        ignoreError = true;
        runPlayerCommand('loadVideoById', ['', 0]);
        runPlayerCommand('seekTo', [0, false]);
        runPlayerCommand('stopVideo');
        lastpath = undefined;
    };

    var stop = function () {
        if (isPlaying || isPaused) {
// commented out, it did not work correctly because of end of support for clearVideo command, #17579
//            runPlayerCommand('pauseVideo');
//            runPlayerCommand('seekTo', [0, false]);
            runPlayerCommand('stopVideo');
            clearVideo();
            isPlaying = false;
            isPaused = false;
        } else
            stopAfterLoad = true;
    };


    var seekTo = function (pos) {
        if(openingVideo) {
            seekTime = pos;
            return;
        }
        if (_restoreBookmark) {
            _bookmarkToRestore = pos;
        }
        runPlayerCommand('seekTo', [pos / 1000.0, true]);
        if(isPaused)
            player.htmlPlaybackState.positionMS = pos; // need to update immediatelly, so seekbars will have correct value
    };

    var setVolume = function (value) {
        runPlayerCommand('setVolume', [Math.round(value * 100)]);
    };

    var messageHandlers = {
        onPlayerReady: function () {
            ODS('YoutubeWindow: onPlayerReady');
            ytFrame.playerReady = true;
            if (stopAfterLoad) {
                stopAfterLoad = false;
                if (window.onPlayerReadyCB)
                    window.onPlayerReadyCB();
                stop();
                return;
            }
            var isOur = isOurTrack();
            if (!pauseAfterLoad && isOur)
                play();
            if (seekTime && isOur) {
                seekTo(seekTime);
                seekTime = undefined;
            }
            runPlayerCommand('unMute'); // not sure why is player occasionally muted, send this to be sure, volume is not muted
            setVolume(player.volume);
            //updateVideo();
            layoutchangeHandler();
            if (window.onPlayerReadyCB)
                window.onPlayerReadyCB();
        },

        onPlayerStateChange: function (state) {
            ODS('YoutubeWindow: onPlayerStateChangeCB called, PlayerState=' + state);
            var isOur = isOurTrack();

            if (state === YTPlayerStatePLAYING) {
                setVisibilityFast(ytFrame, true);
                lastSearchResultIndex = undefined;
                isPlaying = true;
                isPaused = false;
                openingVideo = false;
                if (isOur) {
                    layoutchangeHandler();
                    player.htmlPlaybackState.state = 'play';
                    if (pauseAfterLoad) {
                        pauseAfterLoad = undefined;
                        pause();
                    }
                    if (seekTime) {
                        seekTo(seekTime);
                        seekTime = undefined;
                    }
                    
                    //                if (this.videoSwitchPanel) { // to be sure, it is displayed, it could by hidden already
                    //                    this.videoSwitchPanel.showContent();
                    //                }
                } else
                    stop(); // current file already changed, stop playback
            } else if (state === YTPlayerStatePAUSED) {
                setVisibilityFast(ytFrame, true);
                this.lastSearchResultIndex = undefined;
                isPlaying = false;
                isPaused = true;
                if (isOur) {
                    player.htmlPlaybackState.state = 'pause';
                }
            } else if (state === YTPlayerStateENDED) {
                handleTrackEnd(isOur);
            } else if (state === YTPlayerStateCUED) {
                if(isOur)
                    player.htmlPlaybackState.state = 'stop';
                isPlaying = false;
                isPaused = false;
            };
            if (window.onPlayerStateChangeCB)
                window.onPlayerStateChangeCB(state);
        },

        onPlayerError: function (errNo) {
            if(ignoreError && (errNo === 2)) {
                ignoreError = false;
                return;
            }
            pauseAfterLoad = false;
            stopAfterLoad = false;
            seekTime = undefined;
            
            ODS('YoutubeWindow: onPlayerErrorCB called, errNo=' + errNo);
            if ((lastSearchResultIndex !== undefined) && lastSearchResult && lastSearchedSD) {
                // automatic playback - try next from the last search result
                lastSearchResultIndex++;
                var newIdx = lastSearchResultIndex;
                if (newIdx < lastSearchResult.length) {
                    lastSearchedSD.path = lastSearchResult[newIdx].path;
                    lastSearchedSD.webSource = _utils.youtubeWebSource();
                    playFile(lastSearchedSD);
                    lastpath = lastSearchResult[newIdx].path;
                } else {
                    lastSearchResultIndex = undefined;
                }
            } else
                messageHandlers.onPlayerStateChange(YTPlayerStateENDED);

            if (window.onPlayerErrorCB)
                window.onPlayerErrorCB(errNo);
        },

        onCurrentTime: function (tm) {
            if (!isNaN(tm)) {
                if ((_restoreBookmark) && (tm === 0 /* is playing from the beginning */ ) && (_bookmarkToRestore /* any position is set by player */ )) {
                    seekTo(_bookmarkToRestore);
                } else {
                    player.htmlPlaybackState.positionMS = Math.round(tm * 1000.0);
                }
                _restoreBookmark = undefined;
                _bookmarkToRestore = 0;
                lastTime = player.htmlPlaybackState.positionMS;
                if (window.onCurrentTimeCB)
                    window.onCurrentTimeCB(tm);
            }
        },

        onDurationChange: function (duration) {
            var l = Math.round(duration * 1000);
            var isOur = isOurTrack();
            if (isOur) {
                player.htmlPlaybackState.lengthMS = l;
                if (currSD && (l > 0)) {
                    currSD.beginUpdate();
                    ODS('YoutubeWindow: going to update currSD.songLength to ' + l);
                    currSD.songLength = l;

                    currSD.endUpdate();
                }
                if (window.onDurationChangeCB)
                    window.onDurationChangeCB(duration);
            }
        },

        onTitleChange: function (title) {
            if (currSD && title && !currSD.title) {
                currSD.beginUpdate();
                currSD.title = title;
                currSD.endUpdate();
            }
            if (window.onTitleChangeCB)
                window.onTitleChangeCB(title);

        }
    };

    var handleMessage = function (e) {
        if (e.data) {
            //ODS('--- YT - messaged received: ' + JSON.stringify(e));
            var dataObj = JSON.parse(e.data);
            if (!dataObj.cmd)
                return;
            var fn = messageHandlers[dataObj.cmd];
            if (fn) {
                fn.call(this, dataObj.data);
            }
        };
    };

    window.getState = function () {
        return {
            isPlaying: isPlaying,
            isPaused: isPaused,
            currTimeMS: lastTime
        };
    };

    window.restoreState = function (state) {
        if (state.isPlaying || state.isPaused) {
            seekTime = state.currTimeMS;
            pauseAfterLoad = state.isPaused;
            tmpSD = player.getFastCurrentTrack(tmpSD);
            if (tmpSD && _utils.isYoutubeTrack(tmpSD)) {
                player.playAsync();
            };
        };
    };

    window.onHTMLPlaybackState = function (state, value, lastSearchInfo) {
        ODS('YoutubeWindow: onHTMLPlaybackState called, state=' + state);
        switch (state) {
            case 'unpause':
            case 'play':
                currSD = player.getCurrentTrack();
                if (!currSD)
                    return;
                var sd = currSD;
                if (lastSearchInfo) {
                    lastSearchedSD = lastSearchInfo.sd;
                    lastSearchResult = lastSearchInfo.resArray;
                    lastSearchResultIndex = lastSearchInfo.index;
                };
                if ((lastpath !== sd.path) || !sd.path) {
                    stop();

                    if (!sd.path) {
                        // it should not occur already, we search it before sending to YT window
                        // try to find it on Youtube
                        ytHelper.searchVideosForTrack(sd, {
                            maxResults: 10
                        }).then(function (resArray) {
                            if (resArray && resArray.length > 0) {
                                var res0 = resArray[0];
                                sd.path = res0.path;
                                sd.webSource = _utils.youtubeWebSource();
                                if (res0.thumbnail) {
                                    var coverList = sd.loadCoverListAsync();
                                    coverList.whenLoaded().then(function () {
                                        if (!intPlayer || !intPlayer.controlClass)
                                            return;
                                        if (coverList.count === 0) {
                                            sd.addCoverAsync(res0.thumbnail);
                                        }
                                    });
                                }
                                lastSearchResultIndex = 0;
                                if (sd.id > 0)
                                    sd.commitAsync();
                                if (isOurTrack())
                                    playFile(sd);
                                lastpath = res0.path;
                                lastSearchResult = resArray;
                                lastSearchedSD = sd;
                            } else {
                                messageHandlers.onPlayerStateChange(YTPlayerStateENDED);
                            }
                        });
                    } else {
                        var coverList = sd.loadCoverListAsync();
                        coverList.whenLoaded().then(function () {
                            if (!intPlayer || !intPlayer.controlClass)
                                return;
                            if (coverList.count === 0) {
                                var id = getIDFromURL(sd.path);
                                ytHelper.getVideoDetails(id).then(function (resItem) {
                                    if (!intPlayer || !intPlayer.controlClass)
                                        return;
                                    if (resItem) {
                                        tmpSD = player.getFastCurrentTrack(tmpSD);
                                        if (tmpSD && (id === getIDFromURL(tmpSD.path))) {
                                            tmpSD.addCoverAsync(resItem.thumbnail);
                                        }
                                    }
                                });
                            }
                        });
                        playFile(currSD);
                        lastpath = sd.path;
                    };
                } else
                    play();
                break;
            case 'stop':
                stop();
                break;
            case 'pause':
                pause();
                break;
            case 'seek':
                seekTo(value);
                break;
            case 'volume':
                setVolume(value);
                break;
        }
    };
    // initialize YT player
    var pu = window.playerUtils;

    // prepare innerplayer object
    intPlayer.controlClass.addToContextMenu([{
        action: {
            title: _('Search results'),
            icon: 'youtube',
            submenu: function () {
                var sd = player.getCurrentTrack();

                var getSubmenuFromSearchResult = function () {
                    var retval = [];
                    var idx = 10;
                    forEach(lastSearchResult, function (item, idx) {
                        var dataTip = makeTooltipString(item);
                        retval.push({
                            action: {
                                title: '<span data-tip="' + dataTip + '" data-html="1">' + convertSpecialToEntities(item.title) + '</span>',
                                noAccessKey: true,
                                checked: (sd && (item.path === sd.path)),
                                execute: function () {
                                    player.stopAsync().then(function () {
                                        sd.path = item.path;
                                        sd.webSource = _utils.youtubeWebSource();
                                        if (item.thumbnail) {
                                            var coverList = sd.loadCoverListAsync();
                                            coverList.whenLoaded().then(function () {
                                                if (!intPlayer || !intPlayer.controlClass)
                                                    return;
                                                if (coverList.count === 0) {
                                                    sd.addCoverAsync(item.thumbnail);
                                                }
                                            });
                                        }
                                        player.playAsync();
                                    })
                                }
                            },
                            order: idx,
                            grouporder: 10
                        });
                        idx += 10;
                    });
                    return retval;
                };
                if (lastSearchResult && (lastSearchedSD == sd))
                    return getSubmenuFromSearchResult();
                else {
                    return new Promise(function (resolve, reject) {
                        ytHelper.searchVideosForTrack(sd, {
                            maxResults: 10
                        }).then(function (resArray) {
                            if (resArray && resArray.length > 0) {
                                lastSearchResult = resArray;
                                lastSearchedSD = sd;
                                resolve(getSubmenuFromSearchResult());
                            } else {
                                resolve([]);
                            }
                        });
                    });
                }
            }
        },
        order: 10,
        grouporder: 10,
    }]);

    var mousestatechangedHandler = function (x, y, hitTest, lDown, mDown, rDown) {
        //ODS('--- YoutubeWindow x=' + x + ', y=' + y + ', hitTest=' + hitTest + ', lDown=' + lDown + ', mDown=' + mDown + ', rDown=' + rDown);
        var rect = window.bounds.clientRect;
        var clientX = x - rect.left;
        var clientY = y - rect.top;
        if (!lDown && !mDown && !rDown) {
            if (wasRButtonPressed) {
                wasRButtonPressed = false;
                // show context menu
                ODS('--- opening YT context menu');
                var evt = createNewEvent('contextmenu');
                evt.clientX = clientX;
                evt.clientY = clientY;
                evt.screenX = x;
                evt.screenY = y;
                intPlayer.dispatchEvent(evt);
                intPlayer.controlClass.requestFrame(function () {
                    setVisibility(mouseEventsShield, false);
                }, 'mouseEventsShield');
            }
            app.dialogs.getMainWindow().getValue('playerUtils').updatePlayerPos();
        }

        if (!wasRButtonPressed && rDown) {
            wasRButtonPressed = rDown;
            setVisibility(mouseEventsShield, true); // so iframe with youtube player does not receive contextmenu event and does not show unwanted native youtube context menu
        }
    };
    intPlayer.controlClass.localListen(thisWindow, 'mousestatechanged', mousestatechangedHandler);

    intPlayer.controlClass.localListen(window, 'message', handleMessage);

    window.cleanUp = function () {
        ODS('YoutubeWindow: cleanUp');
        if (isPlaying || isPaused) {
            stop();
        }
        cleanElement(intPlayer); // will unlisten all local listeners too
    };

    layoutchangeHandler();
};

whenReady(function () {
    init();
});
