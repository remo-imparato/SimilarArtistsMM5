/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

'use strict';
registerFileImport('controls/backgroundImage');
import Control from './control';
import '../utils';
import '../animationTools';
requirejs('helpers/searchTools');
window.backgroundImageCache = {}; // To be able to share image data among instances of BackgroundImage
/**
 * Background image control - mainly for showing hi-res Artist images.
 */
export default class BackgroundImage extends Control {
    setDefaults() {
        // Configuration values
        this.backgroundType = 'album'; // can by 'album' or 'artists'
        this.cycleTimeMin = 14000; // ms (a range of time for cycling images)
        this.cycleTimeMax = 16000; // ms
        this.loadTimeout = 5000; // ms to wait for image to be loaded
        this.maxImageWidth = 1600; // pixels - we limit this since Chromium has quite some memory problems with super large images. We could increase this for higher resolution displays though?
        this.maxImageHeight = 1200; // pixels
        this.showPlaybackChanges = true; // animated icon shown on Play/Pause
    }
    initialize(parentel, params) {
        super.initialize(parentel, params);
        params = params || {};
        // set passed attributes
        for (let key in params) {
            this[key] = params[key];
        }
        let _this = this;
        this.player = app.player;
        this.currentImageNum = undefined;
        this.currentArtist = undefined;
        this.artistShown = false;
        this.imagenum = 0;
        this.images = [];
        this.loadingCounter = 0;
        for (let i = 0; i < this.container.children.length; i++) {
            let el = this.container.children[i];
            if (el.style && el.style.zIndex == '')
                el.style.zIndex = '10'; // Above the background    
        }
        let createImg = function (zIndex) {
            // This crashes Chromium, testing <img> version below (but seems to crash Chromium as well).
            let el = document.createElement('div');
            el.className = 'fill controlBase no-cpu'; // controlBase to get the skin's background color
            el.style.backgroundSize = 'cover';
            el.style.backgroundRepeat = 'no-repeat';
            el.style.backgroundPosition = '50% 50%';
            el.style.zIndex = zIndex;
            _this.container.appendChild(el);
            return el;
        };
        this.img1 = createImg(2); // top
        this.img2 = createImg(1); // bottom
        this.img1.classList.add('animBackground');
        this.img1.classList.add('animPaused');
        this.img2.classList.add('animBackground');
        this.img2.classList.add('animPaused');
        this.imgOverlay = createImg(3);
        this.imgOverlay.style.backgroundColor = 'transparent'; // To override what might be defined elsewhere in the skin
        this.imgOverlay.style.backgroundImage = 'url(file:///skin/icon/darken_bg.png)';
        this.imgOverlay.style.backgroundSize = '';
        this.imgOverlay.style.backgroundRepeat = 'repeat';
        // Playback icon (shows Play/Pause actions)
        this.playIcon = document.createElement('div');
        this.playIcon.classList.add('fill');
        this.playIcon.style.zIndex = '4'; // Above background images
        this.playIcon.style.visibility = 'hidden';
        this.playIcon.style.backgroundPosition = '50% 50%';
        this.playIcon.style.backgroundRepeat = 'no-repeat';
        //        this.playIcon.style.mixBlendMode = 'overlay';
        this.container.appendChild(this.playIcon);
        // Load images to another img in order to be notified when they are ready to be used as a background
        // reenabled, to detect corrupted/wrong image files
        this.imgloader = document.createElement('img');
        this.container.appendChild(this.imgloader);
        this.imgloader.style.display = 'none';
        this.localListen(this.imgloader, 'load', function () {
            _this.imgLoaded(_this._lastFetchedCoverType);
        });
        this.localListen(this.imgloader, 'error', function () {
            ODS('BackgroundImage: Image loading failed: ' + _this.currentURL);
            if (_this.currentURL && _utils.isImageFile(_this.currentURL)) {
                app.filesystem.deleteURLFileAsync(_this.currentURL);
            }
            _this.images.splice(_this.currentImageNum, 1);
            _this.currentImageNum = undefined;
            _this.updateImage();
        });
        this.container.style.zIndex = '0';
        this.container.style.overflow = 'hidden';
        this.localListen(this.player, 'playbackState', function (state) {
            if (state == 'trackChanged') {
                _this.registerPropertyChange();
                _this.downloadImages();
            }
            else if (state == 'stop') {
                _this.pauseAnimation();
            }
            else if (state == 'pause') {
                _this.pauseAnimation();
                _this.showIconAnimation('pause');
            }
            else if (state == 'unpause') {
                _this.startAnimation();
                _this.showIconAnimation('play');
            }
            else if (state == 'play') {
                _this.requestImageUpdate();
                _this.startAnimation();
            }
        });
        this.localListen(this.container, 'click', function (e) {
            if (!_this.player.isPlaying || app.player.paused)
                _this.showIconAnimation('play');
            _this.player.playPauseAsync();
        });
        this.prepareActions();
        this.imageShown = this.img2;
        this.restoreCalled = false;
        this.requestFrame(function () {
            if (!_this.restoreCalled)
                _this.restoreState({});
            _this.registerPropertyChange();
            _this.downloadImages();
        }, 'restoreState');
    }
    prepareActions() {
        let _this = this;
        this.animateAction = {
            title: _('Animate background on playback'),
            checkable: true,
            checked: true,
            visible: function () {
                return (_this.backgroundType == 'artists') || (_this.backgroundType == 'albumdark') || (_this.backgroundType == 'albumoriginal');
            },
            execute: function () {
                if (this.animateAction.checked)
                    this.startAnimation();
                else
                    this.pauseAnimation();
            }.bind(this)
        };
        this.showArtistsAction = {
            title: _('Cycle Artist images'),
            checked: function () {
                return _this.backgroundType == 'artists';
            },
            showtype: 'artists',
            execute: function () {
                _this.backgroundType = 'artists';
                _this.updateState();
            }
        };
        this.showAlbumAction = {
            title: _('Artwork (blurred)'),
            checked: function () {
                return _this.backgroundType == 'album';
            },
            showtype: 'album',
            execute: function () {
                _this.backgroundType = 'album';
                _this.updateState();
            }
        };
        this.showAlbumDarkAction = {
            title: _('Artwork (darken)'),
            checked: function () {
                return _this.backgroundType == 'albumdark';
            },
            showtype: 'albumdark',
            execute: function () {
                _this.backgroundType = 'albumdark';
                _this.updateState();
            }
        };
        this.showAlbumOriginalAction = {
            title: _('Artwork (original)'),
            checked: function () {
                return _this.backgroundType == 'albumoriginal';
            },
            showtype: 'albumoriginal',
            execute: function () {
                _this.backgroundType = 'albumoriginal';
                _this.updateState();
            }
        };
        //        this.typeActions = [this.showArtistsAction, this.showAlbumAction];
        this.menuItems = [{
                action: {
                    title: _('Background image'),
                    submenu: [{
                            action: this.showArtistsAction,
                            order: 10,
                            grouporder: 50,
                        }, {
                            action: this.showAlbumAction,
                            order: 20,
                            grouporder: 50,
                        }, {
                            action: this.showAlbumDarkAction,
                            order: 30,
                            grouporder: 50,
                        }, {
                            action: this.showAlbumOriginalAction,
                            order: 40,
                            grouporder: 50,
                        }, {
                            action: this.animateAction,
                            order: 10,
                            grouporder: 100,
                        }]
                },
                order: 10,
                grouporder: 200
            }];
    }
    unregisterPropertyChange() {
        if (this.lastTrack && this.__trackChangeFunc) {
            app.unlisten(this.lastTrack, 'change', this.__trackChangeFunc);
            this.__trackChangeFunc = undefined;
        }
    }
    registerPropertyChange() {
        this.unregisterPropertyChange();
        this.lastTrack = app.player.getCurrentTrack();
        if (this.lastTrack) {
            this.__trackChangeFunc = app.listen(this.lastTrack, 'change', this.updateState.bind(this));
        }
    }
    updateState() {
        //        this.imgOverlay.style.display = (this.backgroundType == 'albumdark' ? '' : 'none');
        //        setVisibility(this.imgOverlay, this.backgroundType == 'albumdark');
        if (isVisible(this.imgOverlay, false) !== (this.backgroundType === 'albumdark')) {
            animTools.animateVisibility(this.imgOverlay, this.backgroundType === 'albumdark', {
                duration: 2000
            });
        }
        if ((this.backgroundType !== 'artists') && (this.backgroundType !== 'albumdark') && (this.backgroundType !== 'albumoriginal'))
            this.pauseAnimation();
        this.downloadImages();
    }
    downloadImages() {
        if (this._cleanUpCalled)
            return;
        if (this.backgroundType != 'artists') {
            this.showAlbumCover(this.backgroundType);
            return;
        }
        this._lastFetchedCoverType = this.backgroundType;
        let _this = this;
        if (!this.lastTrack)
            return;
        if (this.lastTrack.artist === this.currentArtist)
            return; // Don't update artist in case it's still the same
        this.imageShown.style.filter = 'grayscale(100%) blur(1em) brightness(0.4)';
        this.pauseAnimation();
        this.currentArtist = this.lastTrack.artist;
        if (!this.currentArtist) {
            return;
        }
        if (this.currentArtist == backgroundImageCache.currentArtist) {
            this.images = backgroundImageCache.images;
            this.currentURL = backgroundImageCache.currentURL;
            this.currentImageNum = backgroundImageCache.currentImageNum;
            this.imgloader.src = this.currentURL;
            //this.imgLoaded(this._lastFetchedCoverType);
            return; // Don't perform search, we have used the cache
        }
        this.artistShown = false;
        let counter = ++this.loadingCounter; // to prevent showing of the currently loading image
        this.downloadFanArt(counter).catch(function () {
            // Failed, try AudioDB
            return _this.downloadAudioDB(counter);
        }).catch(function () {
            // Failed, try google
            return _this.downloadGoogle(counter);
        }).then(function () {
            if (counter == _this.loadingCounter) {
                _this.currentImageNum = undefined;
                _this.updateImage();
            }
        }, function () {
            if (counter == _this.loadingCounter) {
                _this.images = [];
                _this.currentURL = '';
                _this.currentImageNum = undefined;
            }
        });
    }
    downloadAudioDB(counter) {
        // AudioDB search
        let _this = this;
        return new Promise(function (resolve, reject) {
            if (_this._cleanUpCalled || (counter != _this.loadingCounter))
                return reject();
            let downloadPromise = app.utils.web.getURLContentAsync('http://www.theaudiodb.com/api/v1/json/1/search.php?s=' + _this.currentArtist);
            _this.localPromise(downloadPromise).then(function (content) {
                if (counter != _this.loadingCounter)
                    return reject();
                let results;
                downloadPromise = null;
                try {
                    results = JSON.parse(content);
                }
                catch (e) {
                    return reject();
                }
                if (results.artists && results.artists[0]) {
                    let artist = results.artists[0];
                    _this.images = [{
                            remoteFile: artist.strArtistFanart
                        }, {
                            remoteFile: artist.strArtistFanart2
                        }, {
                            remoteFile: artist.strArtistFanart3
                        }];
                    _this.images.filter(function (element) {
                        return element.remoteFile !== undefined;
                    });
                    if (_this.images.length == 0)
                        reject();
                    else
                        resolve();
                }
                else
                    reject();
            }, function () {
                reject();
            });
        });
    }
    downloadFanArt(counter) {
        // Implement FanArt
        // https://fanart.tv/get-an-api-key/
        // Our API key: e0bc85c4b40c7ef4192783e0a6a5c394
        // http://docs.fanarttv.apiary.io/reference/music/get-artist/get-images-for-artist
        let _this = this;
        return new Promise(function (resolve, reject) {
            if (_this._cleanUpCalled || !_this.lastTrack || (counter != _this.loadingCounter))
                return reject();
            let artists = _this.lastTrack.getPersonListAsync('artist');
            _this.localPromise(artists.whenLoaded()).then(function () {
                artists.locked(function () {
                    if (artists.count <= 0)
                        return reject();
                    let artist = artists.getValue(0);
                    let mbgid = artist.mbgid;
                    if (mbgid === '0') { // artist not found in MB DB before
                        return reject();
                    }
                    else {
                        let downloadArt = function () {
                            let downloadPromise = app.utils.web.getURLContentAsync('http://webservice.fanart.tv/v3/music/' + mbgid + '?api_key=e0bc85c4b40c7ef4192783e0a6a5c394');
                            _this.localPromise(downloadPromise).then(function (content) {
                                if (counter != _this.loadingCounter)
                                    return reject();
                                downloadPromise = null;
                                let results;
                                try {
                                    results = JSON.parse(content);
                                }
                                catch (e) {
                                    return reject();
                                }
                                let backgrounds = results.artistbackground;
                                _this.images = [];
                                if (backgrounds) {
                                    for (let i = 0; i < backgrounds.length; i++) {
                                        _this.images.push({
                                            remoteFile: backgrounds[i].url
                                        });
                                    }
                                }
                                if (_this.images.length == 0)
                                    return reject();
                                resolve();
                            }, function () {
                                reject();
                            });
                        };
                        if (mbgid) {
                            downloadArt();
                        }
                        else {
                            musicBrainz.findArtist(_this.uniqueID, artist).then(function (mbartists) {
                                if (artist.mbgid)
                                    downloadArt();
                                else
                                    reject();
                            });
                        }
                    }
                });
            });
        });
    }
    downloadGoogle(counter) {
        let _this = this;
        return new Promise(function (resolve, reject) {
            if (_this._cleanUpCalled || (counter != _this.loadingCounter))
                return reject();
            searchTools.searchArtistImages(_this.currentArtist, function (res) {
                if (_this._cleanUpCalled || (counter != _this.loadingCounter))
                    return reject();
                _this.images = [];
                for (let i = 0; i < Math.min(5, res.length); i++)
                    if (res[i])
                        _this.images.push({
                            remoteFile: res[i].artworkLink
                        });
                if (_this.images.length == 0)
                    reject();
                else
                    resolve();
            }, {
                minSize: 1024,
                onlyGoogle: true // Discogs contains often small images, not looking good
            });
        });
    }
    showAlbumCover(covertype) {
        let _this = this;
        this.artistShown = false;
        this.currentArtist = undefined;
        if (!_this.lastTrack)
            return;
        if ((covertype === this._lastFetchedCoverType) && this.lastAlbumName && _this.lastTrack.album && (_this.lastTrack.album.localeCompare(this.lastAlbumName, undefined, {
            sensitivity: 'accent'
        }) === 0))
            return; // same album, no change required
        this._lastFetchedCoverType = covertype;
        this.lastAlbumName = _this.lastTrack.album;
        let currCounter = ++this.loadingCounter;
        if (this._loaderToken) {
            cancelPromise(this._loaderToken);
        }
        let cancelToken = uitools.getItemThumb(_this.lastTrack, 500, 500, function (path) {
            if (currCounter == _this.loadingCounter) {
                _this._loaderToken = undefined;
                _this.currentURL = path.length > 1 ? path : ''; // track without covers can return '-' so accept paths longer than 1 char
                _this.imgloader.src = _this.currentURL;
                //_this.imgLoaded(covertype); 
            }
        }, {
            canReturnAlbumArtwork: true,
            imgSearchFunc: searchTools.getAAImage,
            isAutoSearch: true
        });
        this._loaderToken = {
            cancel: function () {
                app.cancelLoaderToken(cancelToken);
            },
        };
    }
    updateImage() {
        if (this._cleanUpCalled || (this.backgroundType !== 'artists'))
            return; // No longer artists images are required
        if ((!this.player.isPlaying || this.player.paused) && this.artistShown)
            return; // Don't update image of already shown artist if not playing
        let _this = this;
        if (this.imageLoading) {
            clearTimeout(this.imageLoading);
            this.imageLoading = undefined;
        }
        // Choose a random image
        let range = this.images.length;
        if (this.currentImageNum !== undefined)
            range--;
        if (range < 1)
            return;
        let image = Math.floor(Math.random() * range);
        if (image >= this.currentImageNum)
            image++;
        this.currentImageNum = image;
        //        var loader = function (fn) {
        //            this.currentURL = fn;
        //            this.imgloader.src = fn;
        //            var imagenum = ++this.imagenum;
        //        
        //            this.imageLoading = this.requestTimeout(function() {
        //                if (_this.imageLoading && (imagenum == _this.imagenum)) {  // If image isn't loaded soon enough, try another one
        ////                    _this.images.delete(image)
        ////                  _this.currentImageNum = undefined;
        //                    _this.updateImage();
        //                }
        //            }, 7000, 'checkload');
        //        }.bind(this);
        // Show the image
        let currCounter = ++this.loadingCounter;
        let imgInfo = this.images[image];
        if (!imgInfo.localFile) {
            this.imageLoading = this.requestTimeout(function () {
                if (_this.imageLoading && (currCounter == _this.loadingCounter)) { // If image isn't loaded soon enough, try another one
                    _this.updateImage();
                }
            }, this.loadTimeout, 'checkload');
            app.utils.prepareImage(imgInfo.remoteFile, this.maxImageWidth, this.maxImageHeight, function (fn) {
                clearTimeout(this.imageLoading);
                _this.imageLoading = undefined;
                if ((currCounter == _this.loadingCounter) && _this.images[image]) { // This image is still requested and exists
                    if (fn) {
                        _this.images[image].localFile = fn;
                        _this.currentURL = fn;
                        _this.imgloader.src = fn;
                        //_this.imgLoaded(this._lastFetchedCoverType);
                    }
                    else {
                        ODS('BackgroundImage: Image not found: ' + imgInfo.remoteFile);
                        _this.images.splice(image, 1);
                        _this.requestTimeout(_this.updateImage.bind(_this), 1, 'cycle');
                    }
                }
            });
        }
        else {
            this.currentURL = imgInfo.localFile;
            this.imgloader.src = this.currentURL;
            //this.imgLoaded(this._lastFetchedCoverType);
        }
    }
    imgLoaded(imgtype) {
        let _this = this;
        this.imageLoading = undefined;
        if ((!this.player.isPlaying || this.player.paused) && this.artistShown)
            return; // Don't update image of already shown artist if not playing
        this.imageShown = (_this.imageShown == this.img1 ? _this.img2 : _this.img1);
        if (this.currentURL)
            this.imageShown.style.backgroundImage = 'url("' + this.currentURL + '")';
        else
            this.imageShown.style.backgroundImage = '';
        if (imgtype == 'album') {
            this.imageShown.style.transition = 'opacity 2s ' + animTools.defaultEasingCSS;
            this.imageShown.style.filter = 'blur(3em) brightness(0.7)';
            this.imageShown.style.transform = 'scale(1.1)'; // So that blur isn't transparent around edges
        }
        else if (imgtype == 'albumdark') {
            this.imageShown.style.transition = 'opacity 2s ' + animTools.defaultEasingCSS;
            this.imageShown.style.filter = '';
            this.imageShown.style.transform = '';
        }
        else { // artist or original artwork
            this.imageShown.style.transition = 'opacity 2s  ' + animTools.defaultEasingCSS + ', filter 2s ' + animTools.defaultEasingCSS; // Not using 'animTools.animationTime', since it's nicer to make it longer/smoother.
            this.imageShown.style.filter = '';
            this.imageShown.style.backgroundPosition = '50% 50%';
        }
        //        setTimeout(function () {
        // need to set opacity for both img elements because of empty cover (no cover) which makes element transparent
        _this.img1.style.opacity = (_this.imageShown == _this.img1) ? '1' : '0';
        _this.img2.style.opacity = (_this.imageShown == _this.img2) ? '1' : '0';
        //        }, 300); // Timeout to make sure the background is loaded
        if (this.oldAnimation)
            this.oldAnimation.cancel();
        this.oldAnimation = this.currentAnimation;
        if (this.currentAnimation) {
            this.currentAnimation = undefined;
        }
        this.startAnimation();
        if (this.backgroundType == 'artists') {
            this.artistShown = true;
            _this.requestImageUpdate();
            window.backgroundImageCache = {
                images: this.images,
                currentArtist: this.currentArtist,
                currentURL: this.currentURL,
                currentImageNum: this.currentImageNum
            };
        }
    }
    startAnimation() {
        if (this.animateAction.checked && this.player.isPlaying && !this.player.paused) {
            if ((this.backgroundType == 'albumdark') || (this.backgroundType == 'albumoriginal')) {
                this.img1.classList.remove('animPaused');
                this.img2.classList.remove('animPaused');
            }
            if (this.backgroundType == 'artists') {
                if (this.currentAnimation)
                    this.currentAnimation.play();
                else {
                    this.currentAnimation = this.imageShown.animate([
                        {
                            transform: 'scale(1.0)'
                        },
                        {
                            transform: 'scale(1.16)'
                        }
                    ], {
                        duration: this.cycleTimeMax + 2 * this.loadTimeout,
                        fill: 'both'
                    });
                }
            }
        }
    }
    pauseAnimation() {
        this.img1.classList.add('animPaused');
        this.img2.classList.add('animPaused');
        if (this.currentAnimation)
            this.currentAnimation.pause();
    }
    requestImageUpdate() {
        this.requestTimeout(this.updateImage.bind(this), this.cycleTimeMin + Math.round((this.cycleTimeMax - this.cycleTimeMin) * Math.random()), 'cycle');
    }
    showIconAnimation(state) {
        if (this.showPlaybackChanges) {
            let _this = this;
            this.playIcon.style.visibility = '';
            this.playIcon.style.backgroundImage = 'url(' + ((state == 'play') ? 'file:///skin/icon/player_play_bg.svg' : 'file:///skin/icon/player_pause_bg.svg') + ')';
            this.currentIconAnimation = animTools.animate(this.playIcon, {
                scale: [0.7, 0.0],
                opacity: [0.0, 1.0]
            }, {
                easing: 'easeOutCubic',
                duration: 1000,
                complete: function () {
                    _this.playIcon.style.visibility = 'hidden';
                }
            });
        }
    }
    storeState() {
        let state = super.storeState();
        state.animate = this.animateAction.checked;
        state.backgroundType = this.backgroundType;
        return state;
    }
    restoreState(fromObject) {
        this.restoreCalled = true;
        if (fromObject.animate !== undefined)
            this.animateAction.checked = fromObject.animate;
        if (fromObject.backgroundType !== undefined)
            this.backgroundType = fromObject.backgroundType;
        super.restoreState(fromObject);
        this.updateState();
    }
    cleanUp() {
        super.cleanUp();
        this.unregisterPropertyChange();
        this.lastTrack = undefined;
    }
}
registerClass(BackgroundImage);
