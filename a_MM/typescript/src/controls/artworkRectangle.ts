'use strict';

registerFileImport('controls/artworkRectangle');

import Control from './control';

/**
 * UI ArtworkRectangle element, control for displaying image or given icon, if no image is known
 */
export default class ArtworkRectangle extends Control {
    useCollage: boolean;
    useImage: boolean;
    sizeClass: string;
    exactSizeClass: string;
    artworkCollage: HTMLDivElement;
    artworkImg: HTMLImageElement;
    artworkIcon: HTMLDivElement;
    saveIcon: any;
    loadListenerSet: boolean;
    showSaveIcon: boolean;
    private _icon: string;
    _dataObject: any;    
    saveImageFunc: any;
    private _sourceLabel: any;

    initialize(rootelem, params) {
        super.initialize(rootelem, params);

        this.useCollage = false;
        this.useImage = true;
        this.sizeClass = 'biggerImageSize';
        this.exactSizeClass = 'biggerImageSizeExact';
        this._icon = undefined;
        this.container.classList.add('noOverflow'); // needed for some reason, otherwise Chromium does not place it in the column layout in view headers correctly and splits it, even with break-inside: avoid;
        for (let key in params) {
            this[key] = params[key];
        }

        if (this.useCollage) {
            this.artworkCollage = document.createElement('div');
            this.artworkCollage.className = this.exactSizeClass;
            this.artworkCollage.classList.add('autosize');
            this.artworkCollage.classList.add('verticalCenter');
            this.artworkCollage.classList.add('relativeBase');
            this.artworkCollage.classList.add('nobreak'); // to avoid spliting in column layout
            this.container.appendChild(this.artworkCollage);
        }
        if (this.useImage) {
            this.artworkImg = document.createElement('img');
            this.artworkImg.className = this.sizeClass;
            this.artworkImg.classList.add('autosize');
            this.artworkImg.draggable = false;
            this.container.classList.add('relativeBase');
            this.container.appendChild(this.artworkImg);
        }
        this.artworkIcon = document.createElement('div');
        this.artworkIcon.className = this.exactSizeClass;
        this.artworkIcon.classList.add('largeIconColor');
        this.artworkIcon.classList.add('emptyImage');
        if (this.icon)
            this.artworkIcon.setAttribute('data-icon', this.icon);
        this.container.appendChild(this.artworkIcon);
        initializeControls(this.container);
        if (this.useCollage) {
            setVisibilityFast(this.artworkCollage, false, {
                animate: false
            });
        }
        if (this.useImage) {
            setVisibilityFast(this.artworkImg, false, {
                animate: false
            });
        }
        setVisibilityFast(this.artworkIcon, !!this.icon, {
            animate: false
        });

        if (this.artworkImg) {
            this.localListen(this.artworkImg, 'click', function () {
                templates.artworkClickFunc(this);
            }.bind(this));
        }
    }

    /**
    Hides artwork and shows icon.

    @method hideImage
    */
    hideImage() {
        if (this.useCollage) {
            setVisibility(this.artworkCollage, false);
            cleanElement(this.artworkCollage, true);
        }
        if (this.useImage) {
            setVisibility(this.artworkImg, false);
            this.artworkImg.src = '';
        }
        setVisibility(this.artworkIcon, !!this.icon);
        if (this.saveIcon)
            setVisibility(this.saveIcon, false);
        this.setImageSourceInfo('');
    }

    /**
    Loads artwork from given link and shows it instead of icon.

    @method showImage
    @param {string} imgLink Link to artwork.
    @param {string} [origImageLing] Link to full size artwork. Useful when showing artwork from cache/online, which could be saved.
    */
    showImage(imgLink: string, origImageLing?:string) {
        let isCollage = (imgLink && (imgLink[0] === '<'));
        if (this.useCollage && (isCollage || !this.useImage)) {
            this.artworkCollage.innerHTML = imgLink;
            setVisibility(this.artworkIcon, false);
            setVisibility(this.artworkCollage, true);
            if (this.saveIcon)
                setVisibilityFast(this.saveIcon, false);
            if (this.useImage)
                setVisibility(this.artworkImg, false, {
                    animate: false
                });
            initializeControls(this.artworkCollage); // due to possible data-icon
        } else if (this.useImage) {
            if (this.useCollage) {
                setVisibility(this.artworkCollage, false, {
                    animate: false
                });
            }

            if (!this.loadListenerSet) {
                this.localListen(this.artworkImg, 'load', function () {
                    setVisibility(this.artworkIcon, false);
                    setVisibility(this.artworkImg, true);
                    if (this.saveIcon) {
                        setVisibility(this.saveIcon, !!this.showSaveIcon);
                    }
                    this.raiseEvent('load', {
                        img: this.artworkImg
                    });
                    notifyLayoutChangeUp(this.container);
                }.bind(this));
                this.localListen(this.artworkImg, 'error', function () {
                    if(this.artworkImg && !isImgSrcEmpty(this.artworkImg) && _utils.isImageFile(this.artworkImg.src)) {
                        ODS('Image loading error, path: ' + this.artworkImg.src);
                        app.filesystem.deleteURLFileAsync(this.artworkImg.src).then((wasDeleted) => {
                            if(wasDeleted)
                                app.utils.clearThumbPathsCache();
                            this.raiseEvent('error', {
                                img: this.artworkImg,
                                deleted: wasDeleted
                            });
                        });
                    }
                }.bind(this));
                this.loadListenerSet = true;
            }
            if (this.saveImageFunc && origImageLing) {
                if (!this.saveIcon) {
                    this.saveIcon = document.createElement('div');
                    this.saveIcon.classList.add('artworkSaveIcon');
                    this.saveIcon.setAttribute('data-icon', 'save');
                    this.saveIcon.setAttribute('data-tip', 'Save image to tag or file folder');
                    this.saveIcon.setAttribute('data-control-class', 'ToolButton');
                    this.artworkImg.parentElement.appendChild(this.saveIcon);
                    initializeControls(this.artworkImg.parentElement);

                    let saveImage = function (evt) {
                        if (this.dataObject) {
                            this.saveImageFunc(this.dataObject, this.saveIcon.controlClass.pathToOrigCachedFile, function () {
                                setVisibility(this.saveIcon, false);
                            }.bind(this));
                        }
                        evt.stopPropagation();
                    }.bind(this);

                    this.saveIcon.controlClass.localListen(this.saveIcon, 'click', saveImage);
                    this.saveIcon.controlClass.localListen(this.saveIcon, 'touchend', saveImage);
                }
                this.saveIcon.controlClass.pathToOrigCachedFile = origImageLing;
                this.showSaveIcon = true;

            } else {
                this.showSaveIcon = false;
            }
            this.artworkImg.src = ''; // needed, otherwise load event is not called sometimes
            this.artworkImg.src = imgLink;
        }
    }

    /**
    Sets source name and link to source web page of found image, e.g. Discogs.
    If empty, removes source info.

    @method setImageSourceInfo
    @param {string} source Name of source.
    @param {string} [sourceUrl] Link to source web page.
    */
    setImageSourceInfo(source: string, sourceUrl?:string) {
        if(this._sourceLabel) {
            this._sourceLabel.remove();
        }
        if (source) { 
            this._sourceLabel = document.createElement('label');
            this.artworkImg.parentElement.appendChild(this._sourceLabel);
            this._sourceLabel.classList.add('sizeLabel');
            this._sourceLabel.setAttribute('data-tip', _('Source'));
            if(sourceUrl) {
                this._sourceLabel.classList.add('clickable');
                this._sourceLabel.setAttribute('onclick', 'event.stopPropagation(); app.utils.web.openURL(\'' + sourceUrl + '\');');
            }
            this._sourceLabel.innerText = _('Data provided by') + ' ' + source;
        } else {
            this._sourceLabel = undefined;
        }
    }

    cleanUp() {
        this.artworkCollage = undefined;
        this.artworkImg = undefined;
        this.artworkIcon = undefined;

        super.cleanUp();
    }

    /**
    Get/set id of icon used when no image is present

    @property icon
    @type String
    */    
    get icon () {
        return this._icon;
    }
    set icon (iconName) {
        let changed = (this._icon !== iconName);
        this._icon = iconName; // @ts-ignore
        // 2023 JL: changed from div._iconInitialized to div.has/setAttribute('data-icon-initialized') to avoid additional HTMLElement properties (Performance impact is negligible)
        if (this.artworkIcon && (changed || !this.artworkIcon.hasAttribute('data-icon-initialized'))) { 
            this.artworkIcon.setAttribute('data-icon-initialized', '1');
            this.artworkIcon.setAttribute('data-icon', this.icon);
            loadIcon(this.icon, (iconData) => {
                if (this.artworkIcon)
                    this.artworkIcon.innerHTML = iconData;
            });
        }
    }
    
    /**
    Returns true, if this control does not have image/collage and displays only icon

    @property emptyArtwork
    @type boolean
    */    
    get emptyArtwork () {
        if (this.artworkImg)
            return isImgSrcEmpty(this.artworkImg);
        else if (this.artworkCollage)
            return this.artworkCollage.innerHTML === '';
        else
            return undefined;
    }
    
    /**
    Get/set dataObject. It is used for getting different sizes of image and have to implement standard getThumbAsync method (like album.getThumbAsync, artist.getThumbAsync, genre.getThumbAsync)

    @property dataObject
    @type Object
    */    
    get dataObject () {
        return this._dataObject;
    }
    set dataObject (obj) {
        this._dataObject = obj;
    }
    
}
registerClass(ArtworkRectangle);
