/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";
requirejs('controls/control');

/**
@module UI
*/

/**
Player wrapper for HTML5 player

@class Html5PlayerController
@constructor
@extends Control
*/
class Html5PlayerController extends Control {

    initialize(elem, params) {
        super.initialize(elem, params);
        var _this = this;

        _this.isPlaying = false;
        _this.isPaused = false;
        _this.audioPlayer = document.createElement('audio');
        _this.audioPlayer.controls = false;
        elem.appendChild(_this.audioPlayer);
        var currSD;

        var updateTime = function () {
            app.player.htmlPlaybackState.positionMS = Math.round(_this.audioPlayer.currentTime * 1000.0);
        };

        var updateDuration = function () {
            var l = Math.round(_this.audioPlayer.duration * 1000.0);
            app.player.htmlPlaybackState.lengthMS = l;
            if (currSD) {
                currSD.songLength = l;
            }
        };

        app.listen(_this.audioPlayer, 'timeupdate', updateTime);
        app.listen(_this.audioPlayer, 'durationchange', updateDuration);
        app.listen(_this.audioPlayer, 'ended', function () {
            _this.isPlaying = false;
            _this.isPaused = false;
            app.player.htmlPlaybackState.state = 'end';
        });
        app.listen(_this.audioPlayer, 'pause', function () {
            _this.isPlaying = false;
            _this.isPaused = true;
            app.player.htmlPlaybackState.state = 'pause';
        });
        app.listen(_this.audioPlayer, 'play', function () {
            _this.isPlaying = true;
            _this.isPaused = false;
            app.player.htmlPlaybackState.state = 'play';
        });

        var onPlayerError = function (e) {
            var errMessage = e.type;
            if (e.type == 'stalled') {
                _this.trackLoadFailed = true;
                _this.trackLoaded = true;
            }
            if (_this.audioPlayer.error) {
                errMessage = errMessage + ' - ' + _this.audioPlayer.error.code;
            }

            ODS('Html5PlayerController: error - ' + errMessage);
        };

        var onLoadDone = function () {
            _this.trackLoadFailed = undefined;
            _this.trackLoaded = true;
        };

        app.listen(_this.audioPlayer, 'error', onPlayerError);
        app.listen(_this.audioPlayer, 'abort', onPlayerError);
        app.listen(_this.audioPlayer, 'stalled', onPlayerError);
        app.listen(_this.audioPlayer, 'emptied', onPlayerError);
        app.listen(_this.audioPlayer, 'suspend', onPlayerError);
        app.listen(_this.audioPlayer, 'canplay', onLoadDone);

        _this.play = function () {
            var playLoop = function () {
                if (_this.trackLoaded) {
                    _this.playTimer = undefined;
                    if (!_this.trackLoadFailed) {
                        _this.audioPlayer.play();
                    }
                } else
                    _this.playTimer = setTimeout(playLoop, 10);
            }
            playLoop();
        };

        _this.load = function (sd) {
            if (_this.playTimer) {
                clearTimeout(_this.playTimer);
                _this.playTimer = undefined;
            }
            _this.trackLoadFailed = false;
            _this.trackLoaded = false;
            _this.audioPlayer.src = _getFileAddress(sd.path);
            _this.audioPlayer.type = app.filesystem.getFileType(sd.path);
            _this.audioPlayer.load();
            currSD = sd;
        };

        _this.pause = function () {
            _this.audioPlayer.pause();
        };

        _this.seekTo = function (posMS) {
            _this.audioPlayer.currentTime = posMS / 1000.0;
        };

        _this.stop = function () {
            _this.audioPlayer.pause();
            _this.audioPlayer.currentTime = 0;
            updateTime();
            _this.audioPlayer.src = '';
            app.player.htmlPlaybackState.state = 'stop';
        };

        _this.setVolume = function (value) {
            _this.audioPlayer.volume = value;
        };

        _this.getVolume = function () {
            return _this.audioPlayer.volume;
        };

        _this.playFile = function (sd) {
            _this.load(sd);
            _this.play();
        };

        _this.getTrackPositionMS = function () {
            Math.round(_this.audioPlayer.currentTime * 1000.0);
        };

        app.listen(thisWindow, 'closequery', function (token) {
            _this.cleanUp();
            token.resolved();
        });
    }

    cleanUp() {
        this.stop();
        app.unlisten(this.audioPlayer);
        super.cleanUp();
    }

    storeState() {
        var state = {};
        state.playbackState = (this.isPlaying ? 'playing' : (this.isPaused ? 'paused' : 'stopped'));
        state.playbackStatePos = this.getTrackPositionMS();
        return state;
    }

    restoreState(state) {
        if (state.playbackState !== 'stopped') {
            this.play();
            if (state.playbackState === 'paused')
                this.pause();
        }
        this.seekTo(state.playbackStatePos);
    }

}
registerClass(Html5PlayerController);