/* eslint-disable no-case-declarations */
/**
 * Contains utilities related to the user interface. For legacy non-module scripts, it is accessible via the global `uitools`. Otherwise, it can be imported like an ES module.
 * 
 * @packageDocumentation
 */

registerFileImport('uitools');

import { Action, ExecutableAction, SubmenuItem } from './actions';
import ListView from './controls/listview';
import ToolButton from './controls/toolbutton';
import MenuButton from './controls/menuButton';
import './utils';
import Multiview from './controls/multiview';
import Control from './controls/control';
import MediaSync from './helpers/mediaSync';

window.uitools = window.uitools || {};

let hasRequiredProps = function (control, props) {
    if (!control || !control.controlClass || control.controlClass.isInCache)
        return false;
    if (props !== undefined) {
        for (let i = 0; i < props.length; i++) {
            if (!control.controlClass[props[i]])
                return false;
        }
    }
    return true;
};

export function getFocusedCC (action, params?) {
    params = params || {};
    let control: HTMLElement|undefined = params.parent || window.lastFocusedControl;    
    if (!control && action.multiviewControl) { // action has multiview control assigned, try focused control inside multiview
        control = action.multiviewControl.lastFocusedControl;
        if (control && control.controlClass && (control.controlClass as unknown as Multiview).lastFocusedControl) // control (probably inner multiview) tracks own last focused, use it
            control = (control.controlClass as unknown as Multiview).lastFocusedControl;
    }
    if (!hasRequiredProps(control, params.reqProps)) {
        control = undefined;
    }
    if (!control) {
        if (window.currentTabControl && window.currentTabControl.multiviewControl) {
            control = window.currentTabControl.multiviewControl.lastFocusedControl || window.currentTabControl.multiviewControl.mainControl;
            if (control && control.controlClass && (control.controlClass as unknown as Multiview).lastFocusedControl) // control (probably multiview) tracks own last focused, use it
                control = (control.controlClass as unknown as Multiview).lastFocusedControl;
            if (!hasRequiredProps(control, params.reqProps)) {
                control = undefined;
            }
        }
    }
    if (!control)
        control = window._lastFocusedLVControl;
    if (!hasRequiredProps(control, params.reqProps))
        control = undefined;

    let cc: Control|undefined = undefined;
    if (control) {
        cc = control.controlClass;
        if (cc && params.reqProps && inArray('selectAll', params.reqProps) && cc.dataSource && cc.dataSource.count == 0) {
            // following is here to resolve #16760
            cc = undefined;
            let previous = control.previousElementSibling;
            if (previous instanceof HTMLElement && isVisible(previous) && previous.controlClass && previous.controlClass.dataSource && previous.controlClass.dataSource.count)
                cc = previous.controlClass;
            if (!cc) {
                let next = control.nextElementSibling;
                if (next instanceof HTMLElement && isVisible(next) && next.controlClass && next.controlClass.dataSource && next.controlClass.dataSource.count)
                    cc = next.controlClass;
            }
        }
    }
    return cc;
}
window.uitools.getFocusedCC = getFocusedCC; 

/**
 * Get the tracklist of the currently selected data source.
 * @method getTracklist
 * @returns {Tracklist}
 */
export function getTracklist(): Tracklist|undefined {
    let ds = getSelectedDataSource();
    if (!ds || !ds.getTracklist) {
        return;
    }
    let tracks = ds.getTracklist();
    if (tracks)
        tracks.autoUpdateDisabled = true;
    return tracks;
}

export function getSelectedDataSource(LV?) {
    let currentListView, fc, fn;
    if (window.lastFocusedControl)
        fc = window.lastFocusedControl.controlClass;
    if (fc && fc.getTracklist)
        currentListView = window.lastFocusedControl;
    else if (LV && LV.controlClass && (LV.controlClass.getTracklist || LV.controlClass.dataSource))
        currentListView = LV; // #17046 / #17946
    else {
        if (fc && fc.dataSource)
            fn = fc.dataSource.focusedNode;
        if (fn && fn.dataSource && fn.dataSource.getTracklist) // we can take tracklist from MediaTree focused node
            return fn.dataSource;
        else
            currentListView = window._lastFocusedLVControl || window.lastFocusedControl;
    }

    if (!currentListView || !currentListView.controlClass)
        return;

    if (currentListView.controlClass.getTracklist)
        return currentListView.controlClass;

    if (currentListView.controlClass.dataSource)
        return currentListView.controlClass.dataSource.dataObject || currentListView.controlClass.dataSource;
    else
        return undefined;
}

const quickTracksCache: {
    ds?: SharedObject;
    tracks?: Tracklist;
} = {
    ds: undefined,
    tracks: undefined
};

/**
 * Get the currently selected {@link Tracklist}. Make sure to wait for the list to be loaded with the {@link SharedList.whenLoaded} promise.
 * @example 
 * 
 *      var list = uitools.getSelectedTracklist();
 *      list.whenLoaded()
 *          .then(function () \{
 *              // Perform your operations
 *          \})
 * @method getSelectedTracklist
 * @returns {Tracklist}
 */
export function getSelectedTracklist(LV?): Tracklist|undefined {

    let tracks: Tracklist|undefined = undefined;
    let ds = getSelectedDataSource(LV);

    if (quickTracksCache.tracks) { // checking ds is not needed, we have cache only for few ms and it was causing #21232, because collection node returns always different instance of DS
        return quickTracksCache.tracks;
    }

    if (ds && ds.getSelectedTracklist) {
        tracks = ds.getSelectedTracklist();
    } else {
        if (ds && ds.getTracklist) {
            tracks = ds.getTracklist();
        } 
        else if (ds && ds.objectType == 'track') {
            tracks = app.utils.createTracklist(true);
            tracks.add(ds);            
        } // @ts-ignore
        else if (window._dialogTracks) // @ts-ignore
            tracks = window._dialogTracks;
    }

    if (!tracks || tracks.count == 0) {
        // to resolve #17856 when hotkeys are used on focused nodes:
        let node = navUtils.getFocusedNode();
        if (node) {
            if (node.dataSource && node.dataSource.objectType == 'collection')
                tracks = undefined;  // #21285
            else {
                let nodes = app.utils.createSharedList();
                nodes.add(node);
                tracks = nodeUtils.getNodesTracklist(nodes as unknown as  SharedList<SharedNode>);
            }
        }
    }

    if (tracks) {
        tracks.autoUpdateDisabled = true;
        tracks.globalModifyWatch = false; // #18329
        quickTracksCache.tracks = tracks;
        quickTracksCache.ds = ds;

        requestTimeout(function () { // remember for a fraction of time, so subsequent calls to the same by menu items do not trigger the same call several times
            quickTracksCache.tracks = undefined;
            quickTracksCache.ds = undefined;
        }, 10);

        return tracks;
    } else {
        quickTracksCache.tracks = undefined;
        quickTracksCache.ds = undefined;
    }
}

let _notMediaListSelectedRes;
/**
 * Returns whether the selected list is NOT a list of media.
 * @example
 * 
 *      actions.myAction = {
 *          title: 'My Action related to a song or other piece of media',
 *          execute: () => {},
 *          disabled: uitools.notMediaListSelected
 *      }
 * @method notMediaListSelected
 * @param {object} [params] See notListItemSelected in actions.js (Defaults to an array of media types, i.e. 'track', 'album', 'playlistentry', ...)
 * @returns {Boolean} Whether the selected list is NOT media.
 */
export function notMediaListSelected(params) {

    if (_notMediaListSelectedRes != undefined) {
        // this caching is useful when tens of actions use this function in action.disabled and context menu consisting of these actions is about to be shown (#17183)
        return _notMediaListSelectedRes;
    }

    params = params || {};
    params.objTypes = ['track', 'album', 'playlistentry', 'playlist', 'genre', 'artist', 'director', 'composer', 'conductor', 'lyricist', 'producer', 'actor', 'publisher', 'year', 'decade', 'folder', 'dbfolder'];
    let res = notListItemSelected(params);
    _notMediaListSelectedRes = res;
    requestTimeout(() => {
        _notMediaListSelectedRes = undefined;
    }, 10);
    return res;
}

function notListItemSelected(params) {
    let getParent = function () {
        if (params.parent) {
            if (params.parent.controlClass && params.parent.controlClass.canBeUsedAsSource)
                return params.parent;
        }
        return window._lastFocusedLVControl || window.lastFocusedControl;
    };

    if (params) {
        // @ts-ignore TODO INVESTIGATE THIS ISSUE
        params.parent = getParent(params.parent); 
        if (params.parent && params.parent.controlClass) {
            if (params.parent.controlClass.getTracklist)
                return false;
            let ds = params.parent.controlClass.dataSource;
            if (!ds)
                return true;

            if (ds.dataObject) {
                if (params.objTypes) {
                    if (ds.dataObject.objectType) {
                        return (params.objTypes.indexOf(ds.dataObject.objectType) === -1);
                    } else
                        return true;
                } else
                    return false;
            } else if (ds.objectType && params.objTypes && (params.objTypes.indexOf(ds.objectType) !== -1))
                return false;

            if (params.action && (params.action.onlySelected === false))
                return (ds.count <= 0);

            let focusedIdx = ds.focusedIndex;

            if (focusedIdx < 0)
                return !ds.hasItemSelected();
            else {
                let selected = false;
                let objType = '';
                if (ds.locked && ds.getValue && ds.hasItemSelected) {
                    ds.locked(() => {                                                            
                        let item = ds.getValue(focusedIdx);
                        if (item) {
                            if (item.objectType == 'node' && item.dataSource)
                                objType = item.dataSource.objectType;
                            else
                                objType = item.objectType;
                            selected = ds.isSelected(focusedIdx);
                        }
                        if (!selected)
                            selected = ds.hasItemSelected(); // focused item is not selected, but other item can be
                    });
                }
                if (!selected)
                    return true;
                if (params.objTypes) {
                    if (objType) {
                        return (params.objTypes.indexOf(objType) === -1);
                    } else
                        return true;
                } else
                    return false;
            }
        } else
            return true;
    } else
        return true;
}

let dimmedDiv, __modalWindowsCount;
/**
 * Open a dialog window.
 * @method openDialog
 * @param {string} dialogName Name of the dialog as defined by its filename (e.g. dlgOptions)
 * @param {object} [params] Options to be passed to the dialog window script.
 * @param {boolean} [params.modal] Open as a modal (subordinate) window.
 * @param {object} [params.parentSizeAndPos] 
 * @param {*} [params.closable] Whether the window can be closed manually.
 * @param {boolean} [params.notShared] When false/undefined, will use shared HTML windows (this is to improve load time and reduce memory usage). Set to false to have full control over the HTML window and the embedded scripts inside it, e.g. if you want to run a module script.
 * @param {Function} [callback] Callback that executes after window closes, if params.modal is true.
 */
export function openDialog(
    dialogName: string, 
    params?: {modal?: boolean, parentSizeAndPos?: AnyDict, [key: string]: any}, 
    callback?: (dialog: SharedWindow) => void
): SharedWindow {
    let pars = params || {};
    let inplaceControl = resolveToValue(pars.inplace, undefined);
    if ((inplaceControl) && (typeof inplaceControl === 'string'))
        inplaceControl = qid(inplaceControl);

    if (inplaceControl) {
        requirejs('helpers/dockableDialog');
        let ctrl: HTMLElement = document.createElement('div'); 
        ctrl.setAttribute('data-control-class', 'DockableDialog');
        if (pars.closable !== undefined)
            ctrl.setAttribute('data-init-params', '{closable: ' + JSON.stringify(pars.closable) + '}');
        inplaceControl.appendChild(ctrl);
        initializeControls(inplaceControl); // @ts-ignore
        return ctrl.controlClass.openDialog(dialogName, pars);
    }

    pars.inplace = undefined;
    if (isModal && !resolveToValue(pars.flat, false)) { // modal dialog cannot open non modal dialog
        pars.modal = true;
    }
    let modal = pars.modal;
    if (modal) {
        if (__modalWindowsCount === undefined)
            __modalWindowsCount = 0;

        if (++__modalWindowsCount === 1) {
            ODS('OPENING WINDOW ' + dialogName);
            dimmedDiv = document.createElement('div');
            dimmedDiv.classList.add('dimmedWindow');
            document.body.appendChild(dimmedDiv);
        }
    }

    if ((pars.openingWindow === undefined) && (!thisWindow.isMenu))
        pars.openingWindow = thisWindow;

    let dialog: SharedWindow;
    let useSharedWindow = window.settings.UI.useSharedWindows && !pars.notShared && !pars.flat && !pars.qunit && !window.qUnit;
    if (pars.shared)
        useSharedWindow = true;
    if (useSharedWindow) {
        if (!window.windowsCache)
            requirejs('helpers/windowsCache');

        if (pars.parentSizeAndPos === undefined)
            pars.parentSizeAndPos = {
                left: thisWindow.bounds.left,
                top: thisWindow.bounds.top,
                width: thisWindow.bounds.width,
                height: thisWindow.bounds.height
            };
        dialog = window.windowsCache.getWindowAndLock(dialogName, pars);
    } else
        dialog = app.dialogs.openDialog(dialogName, pars);

    if (modal) {
        let closed;
        closed = function () {
            app.unlisten(dialog, 'closed', closed);
            if (--__modalWindowsCount === 0 && dimmedDiv) {
                if (!window._cleanUpCalled)
                    removeElement(dimmedDiv);
                dimmedDiv = undefined;
            }
            if (callback)
                callback(dialog);
        };
        app.listen(dialog, 'closed', closed);
    }
    return dialog;
}
window.uitools.openDialog = openDialog;

export function getFirstControl(div, onlyLV) {
    let elements = qes(div, '[data-control-class]');
    for (let i = 0; i < elements.length; i++) {
        let el = elements[i];
        if (isVisible(el) && el.controlClass && (el.tabIndex >= 0)) {
            if ((!onlyLV) || ((el.controlClass instanceof ListView) && (el.controlClass.dataSource && el.controlClass.dataSource.count))) {
                return el.controlClass;
            }
        }
    }
    return undefined;
}

export function focusFirstControl(div, onlyLV) {
    let fc = getFirstControl(div, onlyLV);
    if (fc) {
        if (fc.setFocus)
            fc.setFocus();
        else
            fc.container.focus();
        return fc.container;
    }
}

/**
 * Add artwork to a media item.
 * @method addNewArtwork
 * @param {string} imageLink File path or URL of image.
 * @param {object} params Options
 * @param {Album} [album] 
 * @param {Track} [track] 
 * @param {Tracklist} [tracks] 
 * @param {boolean} [showReplace]
 * @param {boolean} [showApply2Album]
 * @param {number} [initialCoverType]
 * @param {boolean} [doNotSave]
 * @returns 
 */
export function addNewArtwork(imageLink, params) {
    return new Promise<AnyDict>(function (resolve, reject) {
        assert(params.track || params.album || params.tracks, 'track, album or tracks cannot be null!');
        if (window._cleanUpCalled) {
            if (reject)
                reject();
            return;
        }

        app.utils.resolveDropImage(imageLink, true /* return as cover item */ ).then(function (cover) {
            if (window._cleanUpCalled) {
                if (reject)
                    reject();
                return;
            }
            if (cover.loaded) {
                params.modal = true;
                params.cover = cover;
                if (params.initialCoverType !== undefined) {
                    cover.coverType = params.initialCoverType;
                }

                openDialog('dlgAddArtwork', params, function (w) {
                    if (w.modalResult == 1) {
                        let result = w.getValue('getResult')();
                        if (!result) {
                            resolve({
                                done: false
                            });
                            return;
                        }

                        app.trackOperation.addImageAsync(cover, result.imageLocation, {
                            imageFilename: result.imageFilename,
                            doNotSave: result.doNotSave,
                            applyCoversToAlbum: !!result.applyCoversToAlbum,
                            replaceExisting: !!result.replaceExisting,
                            track: result.track,
                            album: result.album,
                            tracks: result.tracks
                        }).then(function () {
                            resolve({
                                done: true,
                            });
                        }, reject);
                    } else {
                        resolve({
                            done: false
                        });
                    }
                });
            } else {
                reject(imageLink + ' has failed to load');
            }
        }, reject);
    });
}

export function startSelectionMode(LV) {

    if (LV && LV.dataSource && LV.multiselect) {
        if (usingTouch && !!LV.dataSource) {
            let ds = LV.dataSource;
            if (ds) {
                LV.selectionMode = true; // set before, to have correctly set statusbar
                if ((ds.focusedIndex >= 0) && (ds.count < ds.focusedIndex) && !LV.selectionMode) {
                    ds.modifyAsync(function () {
                        ds.setChecked(ds.focusedIndex, true);
                    });
                }
                return true;
            }
        }
    }
    return false;
}

export function restoreLastFocusedControl() {

    let restoreFocusID = app.getValue('lastActiveControl', '');
    app.setValue('lastActiveControl', ''); // focus should be restored only on change/refresh skin

    if (restoreFocusID != '') {
        let cnt = 0;
        let tryToSetFocus = function () {
            let elem = qid(restoreFocusID);
            if (elem && elem.controlClass) {
                elem.focus();
            } else {
                if (cnt < 10) {
                    setTimeout(tryToSetFocus, 500);
                    cnt++;
                }
            }
        };
        tryToSetFocus();
    }
}

function doAppAnimation(visible) {
    return new Promise(function (resolve) {
        let animation = 'windowAnimHide';
        if (visible)
            animation = 'windowAnimShow';
        document.body.style.opacity = '';
        document.body.classList.add(animation);

        let done = function () {
            app.unlisten(document.body, 'animationend', done);
            document.body.classList.remove(animation);
            if (!visible)
                resolve(undefined);
        };
        app.listen(document.body, 'animationend', done);
        if (visible)
            resolve(undefined);
    });
}

export function beforeReloadAnimation() {
    let cc = getFocusedCC({});
    if (cc && cc.container.hasAttribute('data-id')) {
        app.setValue('lastActiveControl', cc.container.getAttribute('data-id'));
    }
    return doAppAnimation(false);
}

export function afterReloadAnimation() {
    return doAppAnimation(true);
}

export function notifyNodeTitleChange(node, caption, data) {
    if (!caption)
        caption = nodeUtils.getNodeTitle(node);
    let event = createNewCustomEvent('nodetitlechange', {
        detail: {
            bubbles: false,
            cancelable: true,
            node: node,
            caption: caption,
            data: data
        }
    });
    window.dispatchEvent(event);
}

// Should this be included in the API docs?
export function enableTitleChangeNotification(LV) {
    let _dsChange = function (this: typeof LV) {
        let view = this.parentView;
        if (view && view.viewHandler && resolveToValue(view.viewHandler.notifyTotalCountChange, false)) {
            let data;
            let caption;
            let ds = this.dataSource;
            if (ds && ds.count) {
                data = {
                    count: ds.count,
                    formatTitle: function () {
                        return nodeUtils.getNodeTitle(view.viewNode) + ' (' + ds.count + ')';
                    }
                };
                caption = data.formatTitle();
            } else {
                // LS: we need to report also empty ds -- so that ds isn't leaking in the closure of data.formatTitle()  
                //     e.g. navigationBar component caches the whole formatTitle() function (and leaks the ds closure)
                caption = nodeUtils.getNodeTitle(view.viewNode);
            }

            notifyNodeTitleChange(view.viewNode, caption, data);
        }
    }.bind(LV);

    LV.localListen(LV.container, 'datasourcechanged', function (e) {
        if (e.detail.newDataSource) {
            app.listen(e.detail.newDataSource, 'change', _dsChange);
        }
        if (e.detail.oldDataSource) {
            app.unlisten(e.detail.oldDataSource, 'change', _dsChange);
        }
        _dsChange();
    });
}

export function getCurrentDataSource() {
    return getSelectedDataSource();
}

export function getItemThumb(item, sizeX, sizeY, callback, params) {
    params = params || {};
    let itemLink: Maybe<SharedObjectLink> = undefined;
    if (!item.jsclass)
        itemLink = app.utils.getValueLink(item);

    let localCallback = function (path, pathToOrigCachedFile) {
        if (((path == '') || (path == '-')) && (pathToOrigCachedFile !== '-') && !params.canceled && !window._cleanUpCalled) { // pathToOrigCachedFile === '-' -> display only default icon, no searching
            let itm;
            if (itemLink)
                itm = itemLink.get();
            else
                itm = item;

            if (params.canReturnAlbumArtwork && (itm.objectType === 'track') && (itm.idalbum > 0)) { // when set, we first search for artwork in track album
                requirejs('helpers/searchTools');
                app.getObject('album', {
                    id: itm.idalbum,
                    name: itm.album,
                    artist: itm.albumArtist || itm.artist,
                    canCreateNew: false
                }).then(function (album) {
                    if (params.canceled || window._cleanUpCalled)
                        return;
                    if (album) {
                        params.newArtworkObject = album;
                        params.canSave = true;
                        params.returnOriginal = true;
                        if (window.searchTools.searchMissingArtwork && (itm.itemImageType !== 'icon'))
                            params.imgSearchFunc = params.imgSearchFunc || searchTools.getAAImage;
                        getItemThumb(album, sizeX, sizeY, callback, params);
                    } else
                        callback('');
                });
                return;
            }

            if (params.imgSearchFunc && !window._cleanUpCalled && (itm.itemImageType !== 'icon')) {
                params.imgSearchFunc(itm, function (imgLink, isInTemp) {
                    let deleteTempFile = function () {
                        if (isInTemp)
                            app.filesystem.deleteFileAsync(imgLink);
                    };

                    if (params.canceled) {
                        deleteTempFile();
                        callback('');
                        return;
                    }
                    if (params.canSave && itm.saveThumbAsync && imgLink) {
                        itm.saveThumbAsync(imgLink, true /* from auto search */ ).then(function (ret) {
                            deleteTempFile(); // delete downloaded file, not needed already
                            if (ret === 1) {
                                // successfully saved to temp, read requested size again
                                itm.getThumbAsync(sizeX, sizeY, callback, params);
                            }
                        });
                    } else {
                        if (params.saved) {
                            // already saved in imgSearchFunc, read requested size again
                            deleteTempFile();
                            itm.getThumbAsync(sizeX, sizeY, callback, params);
                        } else
                            callback(imgLink, imgLink);
                    }
                }, params);
            } else
                callback('');
        } else {
            if (params.canSave && !params.canceled && !window._cleanUpCalled && pathToOrigCachedFile && (pathToOrigCachedFile !== '-')) {
                let itm;
                if (itemLink)
                    itm = itemLink.get();
                else
                    itm = item;

                if ((itm.objectType === 'album') && itm.saveThumbAsync) {
                    itm.saveThumbAsync(pathToOrigCachedFile, true /* from auto search */ , true /* save to tracks only */ );
                }
            }
            callback(path, pathToOrigCachedFile);
        }
    };
    if (item.thumbCallback) {
        item.thumbCallback(sizeX, sizeY, localCallback, undefined, params); // no need to go to Delphi and back
        return 0;
    } else
        return item.getThumbAsync(sizeX, sizeY, localCallback, params);
}

export function changePath(item, newPath) {
    if (item.path !== newPath) {
        let trackList = app.utils.createTracklist(true);
        trackList.add(item);
        app.filesystem.renameFilesAsync(trackList, newPath, {
            move: true,
            addDB: false,
            changeFileName: true
        });
        return true;
    } else
        return false;
}

export function storeColumnsSupported(view) {
    if (!view)
        return true;        
    let handler = nodeHandlers[view.viewNode.handlerID];
    return !handler || resolveToValue(handler.storeColumnsSupported, true, view.viewNode);
}

export function getDefaultColumnSort(view) {
    if (!view)
        return;
    let handler = getNodeHandler(view);
    if (handler && handler.defaultColumnSort != undefined)
        return resolveToValue(handler.defaultColumnSort, '', view.viewNode);
}

export function saveButtonSupported(view, dataSource) {
    if(view && view.viewNode) {
        if(!dataSource || !dataSource.reorderAsync) {
            dataSource = view.viewNode.dataSource;
        }
    }
    return (view && resolveToValue(view.nodehandler.canReorderItemsInView, false) && dataSource && dataSource.reorderAsync &&
        resolveToValue(view.nodehandler.canSaveNewOrder, true, view.viewNode));
}

let saveOrderButton;
export function getSaveOrderButton() {
    return saveOrderButton;
}

export function cleanUpSaveButton(ds) {
    if (window.currentTabControl && window.currentTabControl._saveOrderButton) {
        if (ds)
            ds.autoUpdateDisabled = false;
        window.currentTabControl._saveOrderButton.remove();
        window.currentTabControl._saveOrderButton = undefined;
    }
}

export function addShowButton(view, dataSource) {
    if (window.currentTabControl && !window.currentTabControl._saveOrderButton) {
        if (dataSource)
            dataSource.autoUpdateDisabled = true;

        let tb = qid('viewtoolbuttons');
        let par = qeid(tb, 'view') || tb;
        window.currentTabControl._saveOrderButton = addToolButton(par, 'save', () => {
            cleanUpSaveButton(dataSource);
            let ds;
            if(!dataSource || !dataSource.reorderAsync) {
                ds = view.viewNode.dataSource;
            } else
                ds = dataSource;

            ds.reorderAsync(dataSource).then(() => {
                refreshView(); // to reset the sort to the default per #18252
            });
        }, _('Save new order'));
    }
}

export function showSaveButtonAsync(view, dataSource) {
    return new Promise(function (resolved) {
        if (dataSource) {
            if (saveButtonSupported(view, dataSource) && getCanEdit()) {
                addShowButton(view, dataSource);
                setVisibility(window.currentTabControl._saveOrderButton, true);
                resolved(window.currentTabControl._saveOrderButton);
                return;
            }
        }
        resolved(undefined);
    });
}

export function showAboutDlg() {
    openDialog('dlgAbout', {
        modal: true
    }, (dlg) => {
        if (dlg.modalResult == 2)
            actions.enterLicense.execute();
    });
}

export function showDeleteDlg(params): Promise<string|string[]> {
    params = params || {};
    params.modal = true;
    params.show = false;
    params.action = params.action || 'delete';
    params.confType = params.confType || 'library';
    if (!params.shift && ((params.confType === 'playlist') || (params.confType === 'nowplaying'))) {
        let doAskNextName: Maybe<string> = undefined;
        let confirmName: Maybe<string> = undefined;
        let vals;
        switch (params.confType) {
        case 'playlist':
            doAskNextName = 'ConfirmDeletePlaylist';
            confirmName = 'ConfirmDeletePlaylistValue';
            vals = [['playlist'], ['playlist', 'library'], ['playlist', 'library', 'computer']];
            break;
        case 'nowplaying':
            doAskNextName = 'ConfirmDeletePlaying';
            confirmName = 'ConfirmDeletePlayingValue';
            vals = [['nowplaying'], ['nowplaying', 'library'], ['nowplaying', 'library', 'computer']];
            break;
        }
        let _sett = window.settings.get('Confirmations');
        let sett = _sett.Confirmations;
        if (doAskNextName && confirmName && !sett[doAskNextName]) {
            let selIdx = sett[confirmName];

            if ((selIdx !== undefined) && (selIdx >= 0) && (selIdx <= 2)) {
                // auto-return without calling dialog
                return new Promise(function (resolve, reject) {
                    resolve(vals[selIdx]);
                });
            }
        }
    }
    return new Promise(function (resolve, reject) {
        openDialog('dlgDeleteConfirm', params, (dlg) => {
            if (dlg.modalResult == 1) {
                let val = dlg.getValue('getResultValue')();
                resolve(val);
            } else
                resolve('');
        });
    });
}

export function showSelectFolderDlg(defaultDir, params) {
    return new Promise(function (resolve, reject) {
        params = params || {};
        params.modal = true;
        params.defaultDir = defaultDir;
        params.checkboxes = false;
        openDialog('dlgSelectFolder', params, function (dlg) {
            if (dlg.modalResult == 1) {
                let val = dlg.getValue('getResult')();
                resolve(val);
            } else
                resolve('');
        });
    });
}

export function showOptions(selectPanel?: string) {
    let event = createNewCustomEvent('beforeshowoptions', {
        detail: {
            bubbles: false,
            cancelable: true,
        }
    });
    window.dispatchEvent(event);

    let oldLang = window.settings.get('Appearance').Appearance.Language;

    openDialog('dlgOptions', {
        modal: true,
        defaultPanel: selectPanel,
    }, function (w) {
        if (w.modalResult === 3) {
            let sett = window.settings.get('Appearance');
            app.downloadAndInstallLanguage(sett.Appearance.Language).then((addon) => {                                
                let msg = '';
                if (addon.title) // otherwise no install was needed (already installed the same version)
                    msg = sprintf(_('%s installed successfully.'), addon.title);
                doReload(true, false, true, msg);               
            }, () => {                
                // new language install was cancelled or failed ... revert language
                let sett = window.settings.get('Appearance');
                sett.Appearance.Language = oldLang;
                window.settings.set(sett, 'Appearance');                
            });
        } else
        if (w.modalResult === 2) {
            // reload whole skin
            doReload(true, false, true);
        }
        window.hotkeys.assignShortcuts();
    });
}

export function showExtensions(params?: AnyDict) {
    let dlgPars = params || {};
    dlgPars.modal = true;
    openDialog('dlgExtensions', dlgPars, function (w) {
        if (w.getValue('callRestart')) {
            messageDlg(_('Please restart MediaMonkey to finish the installation.'), 'Confirmation', ['btnRestart', 'btnCancel'], {
                defaultButton: 'btnRestart'
            }, function (result) {
                if (result.btnID === 'btnRestart') {
                    app.restart();
                }
            });
        } else if (w.getValue('callReload')) {
            doReload(true, false, true); // to reload scripts
            window.hotkeys.assignShortcuts();
        }
    });
}

let lastProgressWindow;

export function showProgressWindow() {
    let w = openDialog('dlgProgress', {
        modal: true,
        bordered: false,
        flat: true,
        atTop: true,
        left: thisWindow.bounds.left,
        top: thisWindow.bounds.top, // LS: Don't use window.top, it contains window object by standards (returns a reference to the topmost window in the window hierarchy)
        width: thisWindow.bounds.width,
        height: thisWindow.bounds.height,
        opacity: 90,
        inplace: getBodyForControls(),
        closable: false,
        disabled: true,
    });
    lastProgressWindow = w;
    return w;
}

export function hideProgressWindow() {
    if (lastProgressWindow) {
        lastProgressWindow.closeWindow();
        lastProgressWindow = null;
    }
}

export function subscribePodcast(podcast?: Podcast): Promise<void> {
    return new Promise(function (resolve, reject) {
        openDialog('dlgPodcastSubscription', {
            modal: true,
            podcast: podcast,
            isEdit: false
        }, function (dlg) {
            if (dlg.modalResult === 1) {
                resolve();
                refreshView(); // #16337
                refreshView(5000); // #20088
            } else {
                reject();
            }
        });
    });
}

export function unsubscribePodcast(podcast: Podcast): Promise<void> {
    return new Promise(function (resolve, reject) {
        openDialog('dlgPodcastUnsubscribe', {
            modal: true,
            podcast: podcast
        }, function (dlg) {
            if (dlg.modalResult === 1) {
                resolve();
                refreshView(); // #16337
            } else {
                reject();
            }
        });
    });
}

export function refreshView(timeout?: number) {
    if (timeout) {
        requestTimeout(() => {
            refreshView();
        }, timeout);
    } else {
        if (!window.isMainWindow) { // #19269
            let mainWnd = app.dialogs.getMainWindow();
            mainWnd.getValue('uitools').refreshView();
        } else {
            actions.view.refresh.execute();
        }
    }
}

export function editPodcast(podcast) {
    openDialog('dlgPodcastSubscription', {
        modal: true,
        podcast: podcast,
        isEdit: true
    }, function (dlg) {
        if (dlg.modalResult === 2) {
            unsubscribePodcast(podcast);
        }
    });
}

export function rateTracks(tracks, useRating) {
    if (tracks) {
        tracks.whenLoaded().then(function () {
            tracks.modifyAsync(function () {
                let track;
                for (let i = 0; i < tracks.count; i++) {
                    track = tracks.getFastObject(i, track);
                    track.rating = useRating;
                }
                tracks.commitAsync();
            });
        });
    }
}

export function rateTracksDelta(tracks, deltaRating) {
    if (tracks) {
        tracks.whenLoaded().then(function () {
            tracks.modifyAsync(function () {
                let track;
                for (let i = 0; i < tracks.count; i++) {
                    track = tracks.getFastObject(i, track);
                    track.rating = track.rating + deltaRating;
                    if (track.rating < 0)
                        track.rating = 0;
                    if (track.rating > 100)
                        track.rating = 100;
                }
                tracks.commitAsync();
            });
        });
    }
}

export function ratePlaying(useRating) {
    let track = app.player.getCurrentTrack();
    if (track) {
        track.rating = useRating;
        track.commitAsync();
    }
}

export function ratePlayingDelta(deltaRating) {
    let track = app.player.getCurrentTrack();
    if (track) {
        track.rating = track.rating + deltaRating;
        if (track.rating < 0)
            track.rating = 0;
        if (track.rating > 100)
            track.rating = 100;
        track.commitAsync();
    }
}

export function showPlaylistEditor(plst, isNew, origin, container) {
    if (!plst.isAutoPlaylist && getCanEdit()) {
        let plstEdit = container;
        if (!container) {
            let tabPanel = window.currentTabControl.container;
            plstEdit = qe(tabPanel, '[data-control-class=PlaylistEditorsContainer]');
        }
        return plstEdit.controlClass.showEditor(plst, isNew /* startEditTitle*/);
    }
}

export function showConnectError(errMsg) {
    messageDlg(errMsg, 'Error', ['btnHelp', 'btnOK'], {
        defaultButton: 'btnOK'
    }, function (result) {
        if (result.btnID === 'btnHelp') {
            openWeb('https://www.mediamonkey.com/upnp-client-connect-error');
        }
    });
}

export function touchDefaultItemAction() {
    setTimeout(function () {
        let params = {
            reqProps: ['multiselect']
        };
        if (isMenuVisible())
            return;
        let cc = getFocusedCC({}, params);
        if (cc && cc.selectionMode) {
            // no-op
        } else {
            defaultItemAction();
        }
    }, 10);
}

export function defaultItemAction(lst?: SharedObject) {
    let actionName = app.player.getDefaultAction();
    let act: Maybe<ExecutableAction> = undefined;
    if (actionName == 'playNow') {
        if (app.player.shufflePlaylist)
            act = actions.playNowShuffled;
        else
            act = actions.playNow;
    } else
    if (actionName == 'playNext') {
        if (app.player.shufflePlaylist)
            act = actions.playMixedShuffled;
        else
            act = actions.playNext;
    } else
    if (actionName == 'playLast') {
        if (app.player.shufflePlaylist)
            act = actions.playLastShuffled;
        else
            act = actions.playLast;
    } else
    if (actionName == 'properties')
        act = actions.trackProperties;
    assert(!!act, 'dblClick action undefined');
    if (lst && (lst.objectType === 'tracklist'))
        act.execute(lst);
    else
        act.execute();
}

export function isPinnedAsync(item, pinned): Promise<boolean> {
    return new Promise(function (resolve) {
        if (item && item.isPinned) {
            return item.isPinned().then(function (res) {
                resolve(pinned ? res == 1 : res == 0);
            });
        } else {
            resolve(false);
        }
    });
}
window.uitools.isPinnedAsync = isPinnedAsync;

export function pinItem(item, pin) {
    if (item && item.setPinned) {
        item.setPinned(pin, getCurrentTabCollectionID());
    }
}

export function getCurrentTabCollection() {
    let collection;
    if (window.currentTabControl)
        if (window.currentTabControl && window.currentTabControl.multiviewControl) {
            let multiView = window.currentTabControl.multiviewControl;
            let LVControl = multiView.getDefaultFocusControl();
            if (LVControl.controlClass.parentView)
                collection = nodeUtils.getNodeCollection(LVControl.controlClass.parentView.viewNode);
        }
    return collection;
}

export function getCurrentTabCollectionID() {
    let collection = getCurrentTabCollection();
    if (collection)
        return collection.id;
    return -1;
}

export function actionChangeNotify(action) {

    // call this event when action changed and need to be updated in UI (e.g. changed icon)
    let event = createNewCustomEvent('actionchange', {
        detail: {
            action: action,
            bubbles: true,
            cancelable: true
        }
    });

    forEach(qes(window, '[data-actionchangelisten]'), function (element) {
        element.dispatchEvent(event);
    });
}

export function addToolButton(parentId: string|HTMLElement|null, icon: string, clickFn, tooltip?, parentControl?): ElementWith<ToolButton> {
    let btn = document.createElement('div');
    let parent = parentId;
    if (typeof parent === 'string') {
        parent = qid(parent);
    }
    assert(parent, `Parent ${parentId} for tool button not found!`); // JL: Changed from a log & return to an assert so we can guarantee that we actually create a toolbutton
    btn.setAttribute('data-icon', icon);
    btn.setAttribute('data-tip', tooltip);
    btn.setAttribute('data-aria-label', tooltip); // Give it a screen reader label from the tooltip
    btn.setAttribute('data-control-class', 'ToolButton');
    (parent as HTMLElement).insertBefore(btn, (parent as HTMLElement).firstChild);
    initializeControls(parent);
    app.listen(btn, 'click', clickFn);
    if(parentControl)
        addEnterAsClick(parentControl, btn);
    return (btn as ElementWith<ToolButton>);
}

export function selectAllText(element) {
    let range = document.createRange();
    range.selectNodeContents(element);
    let sel = window.getSelection();
    assert(sel, 'Selection undefined!');
    sel.removeAllRanges();
    sel.addRange(range);
}

export function unselectAllText(element) {
    let sel = window.getSelection();
    assert(sel, 'Selection undefined!');
    sel.removeAllRanges();
}

export function getPartyModeButton() {
    
}

let wasWindowMaximized: boolean;
let wasBorderAndTitlebarDisabled: boolean;

export function initPartyMode() {

    let menu = qid('menuContainer');
    if (menu)
        setVisibility(menu, !window.settings.UI.hideMenu);

    let btnL = qid('showSidebarLeft');
    if (btnL)
        setVisibility(btnL, !window.settings.UI.disableRepositioning);
    let btnR = qid('showSidebarRight');
    if (btnR)
        setVisibility(btnR, !window.settings.UI.disableRepositioning);


    let sett = window.settings.get('PartyMode');

    if (app.inPartyMode) {
        // we are entering party mode

        let toolbar = qid('righttoolbuttons');
        assert(toolbar);
        let btn = addToolButton('righttoolbuttons', 'party', function () {
            removeElement(btn);
            window.exitPartyModeBtn = undefined;
            actions.partyMode.execute();
        }, _('Exit Party Mode'));
        window.exitPartyModeBtn = btn;
        setVisibility(btn, app.inPartyMode);

        if (sett.PartyMode.PasswEnabled) {
            let edit = document.createElement('input');
            edit.classList.add('animate');
            edit.classList.add('margins');
            edit.setAttribute('data-tip', _('Enter password'));
            edit.value = _('Enter password');
            toolbar.classList.add('flex'); // due to animation
            toolbar.classList.add('row');
            toolbar.insertBefore(edit, btn);
            initializeControls(toolbar);
            setVisibility(edit, false);

            app.unlisten(btn, 'click');
            let onExitButtonClick = function () {
                setVisibility(edit, true);
                edit.focus();
                edit.select();
            };
            app.listen(btn, 'click', onExitButtonClick);
            let onTypingPass = function () {
                if (edit.getAttribute('type') != 'password') {
                    edit.setAttribute('type', 'password');
                    edit.value = edit.value[edit.value.length - 1];
                    initializeControls(toolbar);
                }
                if (edit.value == sett.PartyMode.PartyPasswEditText) {
                    removeElement(edit);
                    removeElement(btn);
                    window.exitPartyModeBtn = undefined;
                    actions.partyMode.execute();
                }
            };
            app.listen(edit, 'input', onTypingPass);

            if (sett.PartyMode.TotalLock) {
                let lockAllFunct = function () {
                    forEach(qs('*'), function (ctrl) {
                        app.unlisten(ctrl);
                        ctrl.removeAttribute('contenteditable');
                    });
                    app.listen(btn, 'click', onExitButtonClick);
                    app.listen(edit, 'input', onTypingPass);
                };
                setTimeout(lockAllFunct, 2000);
                setTimeout(lockAllFunct, 10000); // for sure
            }
        }

        if (sett.PartyMode.FullScreen) {
            wasWindowMaximized = window.maximized;
            if (window.headerClass)
                window.headerClass.disableWindowMove = true;
            setWindowState(false, true);
            wasBorderAndTitlebarDisabled = true;
            window.maximize();
        }

    } else {
        // we are leaving party mode
        if (wasBorderAndTitlebarDisabled) {
            //window.bordered = true;
            if (window.headerClass)
                window.headerClass.disableWindowMove = false;
            setWindowState(false, false);
            wasBorderAndTitlebarDisabled = false;
        }
        if (window.maximized && !wasWindowMaximized)
            window.restore();

        if (sett.PartyMode.TotalLock)
            window.doReload(false); // after the total lockdown we need to reload the whole window
    }
}

export function startSharing() {

    if ((app.sharing !== undefined) && (app.sharing.start !== undefined) && (isFunction(app.sharing.start))) {
        app.sharing.start(); // runs configured media servers                

        requirejs('helpers/mediaSync');
        mediaSyncDevices.appStartInit(); // inits sync services (MMS detection etc.)
    }
}

export function syncDevice(device) {
    if (!mediaSyncDevices.isSyncInProgress(device)) {
        requirejs('helpers/mediaSync');
        let sync = new MediaSync(device);
        sync.runAutoSync(true);
    }
}

export function sendToDevice(device, tracks, playlist) {
    tracks.whenLoaded().then(() => {
        requirejs('helpers/mediaSync');
        let sync = new MediaSync(device);
        sync.sendToDevice(tracks, playlist);
    });
}

export function removeFromDevice(device, items) {
    requirejs('helpers/mediaSync'); // @ts-ignore     
    let task : MediaSync;
    window.mediaSyncDevices.removeTasks = window.mediaSyncDevices.removeTasks || {};
    if (window.mediaSyncDevices.removeTasks[device.id]) {
        task = window.mediaSyncDevices.removeTasks[device.id];
    } else {
        task = new MediaSync(device);
        window.mediaSyncDevices.removeTasks[device.id] = task;
    }
    task.removeFromDevice(items);
}

export function ripCD(letter) {
    let aRip = copyObject(actions.ripCD);
    if (letter) // rips the first inserted CD otherwise
        aRip.driveLetter = letter;
    aRip.execute();
}

export function browseAndStoreUIState(keyAddon) {
    let store = qe(document.body, '[data-store]');
    if (store) {
        let mainContentClass = store.controlClass;
        if (mainContentClass) {
            let lastFocused = window._lastFocusedLVControl || window.lastFocusedControl;
            if(lastFocused && lastFocused.controlClass) {
                lastFocused.controlClass.storeLastFocusedState = true;
            }
            app.setValue(window._getLayoutStateKey() + keyAddon, mainContentClass.storeState());
            mainContentClass.storePersistentStates();
            if(lastFocused && lastFocused.controlClass) {
                lastFocused.controlClass.storeLastFocusedState = undefined;
            }
        }
    }
}

export function browseAndRestoreUIState(keyAddon) {
    let store = qe(document.body, '[data-store]');
    if (store) {
        let mainContentClass = store.controlClass;
        if (mainContentClass) {
            mainContentClass.restoreState(app.getValue(window._getLayoutStateKey() + keyAddon, {}));
            mainContentClass.restorePersistentStates();
        }
    }
}

// eslint-disable-next-line mediamonkey/no-var-except-declare
export var globalSettings;

export function storeUIState() {
    globalSettings = globalSettings || {};
    app.setValue('globalSettings', globalSettings);
    window.settings.UI.store();
    browseAndStoreUIState('');
    window.uitools.globalSettings = globalSettings; // backward compatibility  
}

export function restoreUIState() {
    globalSettings = app.getValue('globalSettings', {});
    window.uitools.globalSettings = globalSettings; // backward compatibility        
    window.settings.UI.restore();
    browseAndRestoreUIState('');

    if (app.utils.getJustInstalled()) {
        requestTimeout(() => {            
            app.utils.web.getURLContentAsync('https://www.mediamonkey.com/welcome6.htm').then(() => { // #20980
                navigationHandlers['welcomePage'].navigate(); // #17005
            });
        }, 500);  // #20305
    }
}

/**
 * Open a webpage.
 * @method openWeb
 * @param url URL to open
 * @param internal Whether to show in an internal dialog instead of a web browser.
 * @param modal Whether to show in a modal (subordinate) dialog window.
 */
export function openWeb(url: string, internal?: boolean, modal?: boolean) {
    if (internal) {
        // our internal browser
        return openDialog('dlgWeb', {
            modal: (modal !== undefined) ? modal : false,
            url: url,
            notShared: true,
        });
    } else {
        // external browser (default)
        app.utils.web.openURL(url);
    }
}

/**
 * Performs a track search on any search engine, with a provided track object and field to query.
 * @method openWebSearch
 * @param searchEngineURL Search engine URL, with the search query being replaced by %s or %S. For example: https://www.youtube.com/results?search_query=%s
 * @param prop The property of the track to search for (e.g. artist, albumArtist, series, album, title)
 * @param item The SongData/Track object to query on the web.
 * @param internal Whether to show in an internal dialog instead of a web browser. Default = false
 * @param modal Whether to show in a modal (subordinate) dialog window. Default = false
 */
export function openWebSearch(searchEngineURL: string, prop: string, item: Track, internal?: boolean, modal?: boolean) {
    assert((typeof searchEngineURL == 'string'), 'searchEngineURL must be string.');
    assert(typeof prop == 'string', 'prop must be string');
    assert(typeof item == 'object', 'item must be a Track object');

    //Filter to help improve the search query, e.g. because 'various artists' often hurts search results
    let checkArtist = (artist) => {
        let res = app.utils.getLingBase(artist);
        switch (res.toLowerCase()) {
        case 'various':
        case 'various artists':
            return '';
        case 'rem':
            return 'R.E.M.';
        default:
            return res;
        }
    };

    //Prepare query
    let query = '';
    switch (prop) {
    case 'artist':
        query = checkArtist(item.artist);
        break;
    case 'albumArtist':
        query = checkArtist(item.albumArtist);
        break;
    case 'series':
        query = item.album;
        break;
    case 'album':
        query = (checkArtist(item.artist) || checkArtist(item.albumArtist)) + ' ' + item.album;
        break;
    case 'title':
        query = (checkArtist(item.artist) || checkArtist(item.albumArtist)) + ' ' + item.title;
        break;
    default:
        // if none is specified, default to artist+title
        query = (item.artist || item.albumArtist) + ' ' + item.title;
    }

    //Replace %s/%S with the query
    let finalURL = searchEngineURL.replace(/%[s,S]/g, encodeURIComponent(query));

    openWeb(finalURL, internal, modal);
}

export const findMoreMenuActions = {
    title: {
        getMenuItems: function (track, collection) {
            let type;
            if (collection)
                type = collection.getType();

            return [{
                title: function () {
                    return _('Title') + ': ' + track.title;
                },
                noAccessKey: true,
                icon: 'music',
                visible: function () {
                    return ((track.title != '') && _utils.isLibraryTrack(track));
                },
                execute: function () {
                    navigationHandlers['title'].navigate(track);
                },
                order: 5
            }];
        }
    },
    album: {
        getMenuItems: function (track, collection) {
            let type;
            if (collection)
                type = collection.getType();

            return [{
                title: function () {
                    if (inArray(type, ['video', 'tv']))
                        return _('Series') + ': ' + track.album;
                    else
                        return _('Album') + ': ' + track.album;
                },
                noAccessKey: true,
                icon: 'album',
                visible: function () {
                    return (track.album != '');
                },
                execute: function () {
                    globalSettings.showingOnline = (track.id === -2); // online mode only for online source track
                    navigationHandlers['album'].navigate(track, collection);
                },
                order: 10
            }];
        }
    },
    artist: {
        getMenuItems: function (track, collection) {
            let type;
            if (collection)
                type = collection.getType();

            let sA = track.artist.split(';').map((a) => (a.trim()));
            let retval: ExecutableAction[] = [];
            sA.forEach(function (a) {
                retval.push({
                    title: function () {
                        if (inArray(type, ['video', 'tv']))
                            return _('Director') + ': ' + a;
                        else
                            return _('Artist') + ': ' + a;
                    },
                    noAccessKey: true,
                    visible: function () {
                        return (!!a);
                    },
                    icon: 'artist',
                    execute: function () {
                        globalSettings.showingOnline = (track.id === -2); // online mode only for online source track                            
                        if (inArray(type, ['video', 'tv']))
                            navigationHandlers['director'].navigate(a, collection);
                        else
                            navigationHandlers['artist'].navigate(a, collection);
                    },
                    order: 20
                });
            });

            return retval;
        }
    },
    albumArtist: {
        getMenuItems: function (track, collection) {
            let type;
            if (collection)
                type = collection.getType();

            let sA = track.albumArtist.split(';').map((a) => (a.trim()));
            let retval: ExecutableAction[] = [];
            sA.forEach(function (a) {
                retval.push({
                    title: function () {
                        return _('Album Artist') + ': ' + a;
                    },
                    noAccessKey: true,
                    visible: function () {
                        return (!!a && !inArray(type, ['video', 'tv']));
                    },
                    icon: 'artist',
                    execute: function () {
                        globalSettings.showingOnline = (track.id === -2); // online mode only for online source track
                        navigationHandlers['albumartist'].navigate(a, collection);
                    },
                    order: 21
                });
            });
            return retval;
        }
    },
    composer: {
        getMenuItems: function (track, collection) {
            let sA = track.composer.split(';').map((a) => (a.trim()));
            let retval: ExecutableAction[] = [];
            sA.forEach(function (a) {
                retval.push({
                    title: function () {
                        return _('Composer') + ': ' + a;
                    },
                    noAccessKey: true,
                    visible: function () {
                        return (!!a);
                    },
                    icon: 'composer',
                    execute: function () {
                        globalSettings.showingOnline = (track.id === -2); // online mode only for online source track
                        navigationHandlers['composer'].navigate(a, collection);
                    },
                    order: 30
                });
            });
            return retval;
        }
    },
    actor: {
        getMenuItems: function (track, collection) {
            let sA = track.actor.split(';').map((a) => (a.trim()));
            let retval: ExecutableAction[] = [];
            sA.forEach(function (a) {
                retval.push({
                    title: function () {
                        return _('Actor') + ': ' + a;
                    },
                    noAccessKey: true,
                    visible: function () {
                        return (!!a);
                    },
                    icon: 'actor',
                    execute: function () {
                        globalSettings.showingOnline = (track.id === -2); // online mode only for online source track
                        navigationHandlers['actor'].navigate(a, collection);
                    },
                    order: 35
                });
            });
            return retval;
        }
    },
    genre: {
        getMenuItems: function (track, collection) {
            let sA = track.genre.split(';').map((a) => (a.trim()));
            let retval: ExecutableAction[] = [];
            sA.forEach(function (a) {
                retval.push({
                    title: function () {
                        return _('Genre') + ': ' + a;
                    },
                    noAccessKey: true,
                    visible: function () {
                        return (!!a);
                    },
                    icon: 'genre',
                    execute: function () {
                        globalSettings.showingOnline = (track.id === -2); // online mode only for online source track
                        navigationHandlers['genre'].navigate(a, collection);
                    },
                    order: 40
                });
            });

            return retval;
        }
    },
    year: {
        getMenuItems: function (track, collection) {
            return [{
                title: function () {
                    if (track.year <= 0)
                        return _('Year') + ': ' + _('Unknown');
                    else
                        return _('Year') + ': ' + track.year;
                },
                icon: 'year',
                visible: function () {
                    return true; // applies also for 'Unknown' (#19174)
                },
                execute: function () {
                    globalSettings.showingOnline = (track.id === -2); // online mode only for online source track
                    navigationHandlers['year'].navigate(track, collection);
                },
                order: 45
            }];
        }
    },
    playlist: {
        getMenuItems: function (track) {
            return [{
                title: function () {
                    return _('Playlist');
                },
                icon: 'playlist',
                submenu: getFindMoreFromSameMenuPlaylist,
                track: track,
                order: 50
            }];
        }
    },
    dbFolder: {
        getMenuItems: function (track, collection) {
            if (_utils.isLibraryTrack(track))
                return [{
                    title: function () {
                        return _('Folder') + ' (' + _('Library') + ')';
                    },
                    icon: 'folder',
                    execute: function () {
                        navigationHandlers['dbFolder'].navigate(track, collection);
                    },
                    order: 60
                }];
        }
    },
    compFolder: {
        getMenuItems: function (track) {
            if (!_utils.isRemoteTrack(track))
                return [{
                    title: function () {
                        return _('Folder') + ' (' + _('All') + ')'; // #16528
                    },
                    icon: 'folder',
                    execute: function () {
                        navigationHandlers['compFolder'].navigate(track);
                    },
                    order: 70
                }];
        }
    },
    explorerFolder: {
        getMenuItems: function (track) {
            if (!_utils.isRemoteTrack(track))
                return [{
                    title: function () {
                        return _('Folder') + ' (' + _('Explorer') + ')';
                    },
                    icon: 'folder',
                    execute: function () {
                        navigationHandlers['explorerFolder'].navigate(track);
                    },
                    order: 80
                }];
        }
    }
};

/**
 * Get a list of all installed skins.
 * Properties: title (string), fullPath (string), checked (boolean) [whether the skin is active], radiogroup (string, 'skin'), execute (function)
 * @returns {Array(Object)} Array of Menu-like objects with details about each skin.
 * @method getSkins
 */
export function getSkins (includeHotlinkIcon) {
    let skins = app.getSkins();
    let ar = [];
    skins.locked(function () {
        for (let i = 0; i < skins.count; i++) {
            let skin = skins.getValue(i);

            let itm: ExecutableAction = {
                title: skin.title,
                fullPath: skin.path,
                checked: skin.isCurrent,
                id: skin.id,
                radiogroup: 'skin',
                execute: function () {
                    selectSkin(this.fullPath);
                },
            };

            if (skin.skinOptions && includeHotlinkIcon) {
                itm.hotlinkIcon = 'options';
                itm.hotlinkExecute = function () {
                    openDialog('dlgOptions', {
                        modal: true,
                        defaultPanel: 'pnl_LayoutSkin',
                        selectedSkinId: skin.id,
                    });
                };
            }

            ar.push(itm);
        }
    });

    return ar;
}

export function getMainPanelMenu() {
    let ar = [];
    if (window.currentTabControl && window.currentTabControl.multiviewControl) {
        let vActions = window.currentTabControl.multiviewControl._getViewActions(window.currentTabControl.multiviewControl.activeView, true);
        ar = vActions;
    }

    return ar;
}

function selectSkin(path) {
    if (app.currentSkin().path !== path) {
        storeUIState();
        beforeReloadAnimation().then(function () {
            app.selectSkin(path, !app.inSafeMode() /* soft when not in safe mode */ );
        });
    }
}

/**
 * Activate skin
 * @method activateSkin
 * @param {object} skin Skin object
 * @param {string} skin.path path of skin
 */
export function activateSkin(skin) {
    selectSkin(skin.path);
}

/**
 * Activate layout
 * @method activateLayout
 * @param {object} layout layout object
 * @param {string} layout.path path of layout
 */
export function activateLayout(layout) {
    layoutChanged(layout.path);
}


function layoutChanged(layout) {
    showReloadConfirm().then(() => {
        storeUIState();
        beforeReloadAnimation().then(function () {
            app.loadLayout(layout);
        });
    });
}

export function getLayouts() {
    let ar = [];
    let defName = '_default_';
    let layouts = app.getLayouts();
    let currentLayout = getDocking().getCurrentLayout();
    let layoutName = currentLayout ? currentLayout.name : defName;
    layouts.locked(function () {
        let isDesktopModeCurrently = layouts.isSelected(0);
        let desktopModeName = layouts.getValue(0);
        for (let i = 0; i < layouts.count; i++) {
            let layout = layouts.getValue(i);
            let current = layout.isCurrent;
            let itm: ExecutableAction = {
                title: layout.title,
                layout: layout.path,
                isCurrent: current,
                checked: (current && (layoutName == defName)),
                radiogroup: 'layout',
                execute: function () {
                    if (!this.isCurrent) {
                        app.setValue('currentLayoutPreset', defName);
                        layoutChanged(this.layout);
                    } else {
                        let currentLayoutPreset = layoutName;
                        if (currentLayoutPreset !== defName) {
                            getDocking().restoreLayout(defName, true);
                        }
                    }
                }
            };
            if (i == 0) { // set 'options' icon on first (desktop) layout
                itm.hotlinkIcon = 'options';
                itm.hotlinkExecute = function () {
                    showOptions('pnl_Layouts');
                };
            }
            ar.push(itm);

            if (i == 0) { // after desktop layout add custom layout presets
                // add custom layouts
                let presets = getDocking().storedLayouts();
                presets.shift(); // remove default
                presets.forEach(function (layout, idx) {
                    let obj = {
                        _layout: layout,
                        title: function () {
                            return resolveToValue(this._layout.title, '_default_');
                        },
                        checked: layoutName == layout.name,
                        radiogroup: 'layout',
                        execute: function () {
                            if (!isDesktopModeCurrently) { // when preset is choosen and desktop mode is not current mode ... switch to desktop
                                app.setValue('currentLayoutPreset', resolveToValue(this._layout.name, '_default_'));
                                layoutChanged(desktopModeName);
                            } else
                                getDocking().restoreLayout(layout, true);
                        }
                    };
                    ar.push(obj);
                });
                if (presets.length > 0) { // more than one preset is defined, place separator betweeen presets and 'touch' mode
                    ar.push(menuseparator);
                }
            }
        }
    });
    return ar;
}

function getFindMoreFromSameMenuPlaylist(params) {
    let cancelTask;
    let pr = new Promise(function (resolve, reject) {
        let retArray = [];
        let track = params.parentMenuAction.track;
        let list = app.playlists.getPlaylistsForTrackAsync(track);
        cancelTask = list.whenLoaded();
        let _generateItems = (final?) => {
            retArray = [];
            list.locked(function () { // we can't use list.forEach() here as it would give us only fast access variant
                if (list.count == 0 && final)
                    retArray.push({
                        title: _('No playlist found'),
                        icon: 'none'
                    });
                else
                    for (let index = 0; index < list.count; index++) {
                        let playlist = list.getValue(index);
                        let useIcon = 'playlist';
                        if (playlist.isAutoPlaylist)
                            useIcon = 'autoplaylist';
                        retArray.push({
                            title: playlist.name,
                            noAccessKey: true,
                            icon: useIcon,
                            playlist: playlist,
                            execute: function () {
                                navigationHandlers['playlist'].navigate(this.playlist);
                            },
                            order: index
                        });
                    }
            });
        };

        let _last_cnt = 0;
        let _refresh = () => {
            if (_last_cnt != list.count) {
                _last_cnt = list.count;
                _generateItems();
                if (params && params.updateCallback)
                    params.updateCallback(retArray);
            }
        };
        let _lFnc = app.listen(list, 'change', _refresh);
        cancelTask.then(function () {
            app.unlisten(list, 'change', _lFnc);
            _generateItems(true);
            resolve(retArray);
        });

    });
    // @ts-ignore
    pr.onCanceled = () => {
        if (cancelTask) {
            cancelPromise(cancelTask);
        }
    };
    return pr;
}

/**
 * Get a "Find more from same" menu with given parameters.
 * @method getFindMoreFromSameMenu
 * @param {object} params Parameters
 * @param {Node} [params.parent=window.lastFocusedControl] HTMLNode of the parent of this item
 * @param {object} [params.rootMenuAction] 
 * @param {Function(Tracklist)} [params.rootMenuAction.getTracklist] Getter for tracklist (Defaults to selected tracks)
 * @returns {Promise(Array)} List of MenuItem getters 
 */
export function getFindMoreFromSameMenu(params): Promise<SubmenuItem[]|undefined> {
    return new Promise(function (resolve, reject) {
        let LV = params.parent || window.lastFocusedControl;
        let selTracks;
        if (params.rootMenuAction && params.rootMenuAction.getTracklist)
            selTracks = params.rootMenuAction.getTracklist();
        else
            selTracks = getSelectedTracklist(LV);

        if (!selTracks) {
            resolve(undefined);
            return;
        }
        let currentNodeCollection;
        if (LV.controlClass && LV.controlClass.parentView)
            currentNodeCollection = nodeUtils.getNodeCollection(LV.controlClass.parentView.viewNode);

        let focusedTrack;
        selTracks.whenLoaded().then(function () {
            selTracks.locked(function () {
                if (selTracks.count > 0)
                    focusedTrack = selTracks.getValue(0); // takes the first from the selected tracklist (so that it works also for non-track entities like album, artist, genre)                    
            });

            let retArray = [];
            if (focusedTrack) {
                navUtils.getTrackCollectionAsync(focusedTrack).then(function (trackCollection) {
                    let useCollection = currentNodeCollection || trackCollection; // prefer collection of the active node, just for nodes like Playing or 'Playing panel' use track collection
                    for (let action in findMoreMenuActions) {
                        // eslint-disable-next-line prefer-spread
                        retArray.push.apply(retArray, findMoreMenuActions[action].getMenuItems(focusedTrack, useCollection));
                    }
                    resolve(retArray);
                });
            } else {
                resolve(retArray);
            }
        });
    });
}

export function getAccessKey(txt) {
    let result = undefined;
    let i = txt.indexOf('&') + 1;
    if ((i > 0) && (i < txt.length)) {
        result = txt.charAt(i);
        if (result === ' ')
            result = undefined;
    }
    return result;
}
window.uitools.getAccessKey = getAccessKey;

export function getPureTitle(title) {
    let tit = _(resolveToValue(title, ''));
    if (!tit)
        return '';
    let ak = getAccessKey(tit);
    if (ak) {
        return tit.replace('&' + ak, ak);
    } else
        return tit;
}
window.uitools.getPureTitle = getPureTitle;

export function getCurrentLayout() {
    let layout = {
        name: 'Desktop'
    };
    app.getValue('layout', layout);
    return layout;
}
window.uitools.getCurrentLayout = getCurrentLayout;

declare global{ var _getLayoutStateKey: () => string;}

window._getLayoutStateKey = function () {
    let key = 'layout_state_';
    if (app.inPartyMode)
        key = 'party_' + key;
    key = key + getCurrentLayout().name;
    return key;
};


declare global {var mainMenuButton: ElementWith<MenuButton>;} // todo switch to export

export function switchMainMenu(alwaysShow) {
    if (!builtInMenu)
        return;

    let menuContainer = qe(document, '[data-menu-container]');
    if (!menuContainer)
        return;

    let menuButton: ElementWith<MenuButton>|null = qid('mainMenuButton');
    assert(menuButton);

    if (alwaysShow) { // show classic menu
        let menu = document.createElement('div');
        menu.setAttribute('data-control-class', 'MainMenu');
        menuContainer.appendChild(menu);
        initializeControls(menuContainer);

        if (menuButton) {
            setVisibility(menuButton, false);
            menuButton = menu as ElementWith<MenuButton>;
        }
    } else { // show main menu button
        cleanControlClass(menuContainer);
        menuContainer.innerHTML = '';

        let container = qid('righttoolbuttons');
        if (!menuButton && container) {
            menuButton = document.createElement('div') as ElementWith<MenuButton>;
            menuButton.setAttribute('data-id', 'mainMenuButton');
            menuButton.setAttribute('data-control-class', 'MenuButton');
            menuButton.setAttribute('data-icon', 'mainMenu');
            menuButton.setAttribute('data-init-params', '{menuArray: mainMenuItems}');
            container.appendChild(menuButton);
            initializeControls(container);
        } else
            setVisibility(menuButton, true && builtInMenu);
    }
    window.mainMenuButton = menuButton;
    setVisibility(menuContainer, alwaysShow && builtInMenu);

    let event = createNewCustomEvent('menuchange', {
        detail: {
            bubbles: false,
            cancelable: true,
            alwaysVisible: alwaysShow,
        }
    });
    window.dispatchEvent(event);

}

export function coverLookup(control?: HTMLElement): Promise<void> {
    return new Promise(function (resolve, reject) {
        requestAnimationFrameMM(function () {
            control = control || window.lastFocusedControl;
            assert(control, 'Could not find last focused control!');
            let cc = control.controlClass;
            if (cc.addArtworkRules) {
                let track = cc.addArtworkRules.track;
                let showApply2Album = resolveToValue(cc.addArtworkRules.showApply2Album, true) && track && (track.album !== '');
                let doNotSave = resolveToValue(cc.addArtworkRules.doNotSave, false);
                requirejs('helpers/searchTools');
                searchTools.searchAAImageDlg(track || cc.addArtworkRules.album, function () {
                    resolve();
                }, {
                    firstTrack: cc.addArtworkRules.firstTrack,
                    showApply2Album: showApply2Album,
                    doNotSave: doNotSave,
                    showReplace: cc.addArtworkRules.showReplace,
                    deletedArtworks: cc.addArtworkRules.deletedArtworks
                });

            }
        });
    });
}

export function coverRemove(control?: HTMLElement, onlyFocused = false) {
    control = control || window.lastFocusedControl;
    if (control && control.controlClass && control.controlClass.dataSource) {
        if (onlyFocused) {
            let cvr = control.controlClass.dataSource.focusedItem;
            if (cvr) {
                control.controlClass.dataSource.removeAsync(cvr);
            }
        } else {
            control.controlClass.dataSource.deleteSelected();
        }
    }
}

export function coverSave(control?: HTMLElement) {
    control = control || window.lastFocusedControl;
    if (control && control.controlClass && control.controlClass.dataSource) {
        let cvr = control.controlClass.dataSource.focusedItem;
        if (!cvr)
            return;
        let ptype, filter;
        switch (cvr.pictureType) {
        case 'image/png':
            ptype = 'png';
            filter = 'PNG files (*.png)|*.png;';
            break;
        case 'image/x-bmp':
            ptype = 'bmp';
            filter = 'BMP files (*.bmp)|*.bmp;';
            break;
        case 'image/gif':
            ptype = 'gif';
            filter = 'GIF files (*.gif)|*.gif;';
            break;
        default:
            ptype = 'jpg';
            filter = 'JPG files (*.jpg)|*.jpg;';
            break;
        }
        requestAnimationFrameMM(function () {
            let promise = app.utils.dialogSaveFile('Image', ptype, filter, '');
            promise.then(function (filename) {
                if (filename != '') {
                    cvr.saveToFile(filename);
                }
            });
        });
    }
}

export function coverShow(control?: HTMLElement) {
    control = control || window.lastFocusedControl;
    if (control && control.controlClass && control.controlClass.dataSource) {
        let cvr = control.controlClass.dataSource.focusedItem;
        if (!cvr)
            return;
        openDialog('dlgArtworkDetail', {
            modal: true,
            coverItem: cvr
        });
    }
}

/** @hidden */
export function calledFromMainWindow() {
    return calledFromDialog('mainwindow');
}

/** @hidden */
export function calledFromDialog(dlgName) {
    let current = window.location.href;
    return current.toLowerCase().indexOf(dlgName.toLowerCase() + '.html') !== -1;
}

let _notLocalMediaListSelectedRes;

export function notLocalMediaListSelected(params): boolean|Promise<boolean> {

    if (_notLocalMediaListSelectedRes != undefined) {
        // this caching is useful when tens of actions use this function in action.disabled and context menu consisting of these actions is about to be shown (#17183)
        return _notLocalMediaListSelectedRes;
    }

    let res;
    if (notMediaListSelected(params))
        res = true;
    else {
        res = new Promise((resolve) => {
            _utils.getFirstTrackAsync(getSelectedTracklist()).then((track) => {
                if (track) {
                    let isRemote = _utils.isRemoteTrack(track);
                    if(isRemote) {
                        resolve(true);
                        return;
                    }
                    if (!params || !params.acceptCDs) {
                        if(_utils.isAudioCDTrack(track)) {
                            resolve(true);
                            return;
                        }
                    }
                    /* LS: following has been reverted, reasons in #20473
                    track.isAccessibleAsync().then((accessible) => { // #19108
                        resolve(!accessible);
                    });
                    */ 
                    resolve(false);
                } else
                    resolve(true);
            });
        });
    }

    _notLocalMediaListSelectedRes = res;
    requestTimeout(() => {
        _notLocalMediaListSelectedRes = undefined;
    }, 10);
    return res;
}

export function moreTracksSelectedAsync(): Promise<boolean> {
    return new Promise((resolve) => {
        let tl = getSelectedTracklist();
        if(tl && (tl.count>1)) { // already know that list is not empty, no need to wait longer
            resolve(true);
        } else {
            _utils.getTrackCountAsync(tl).then((cnt)=>{
                resolve(cnt && (cnt>1));
            });
        }
    });
}

export function notMoreTracksSelectedAsync(): Promise<boolean> {
    return new Promise((resolve) => {
        moreTracksSelectedAsync().then((ret) => {
            resolve(!ret);
        });
    });
}

function notLibraryMediaListSelected(params): boolean|Promise<boolean> {
    if (notMediaListSelected(params))
        return true;
    else {
        return new Promise((resolve) => {
            _utils.getFirstTrackAsync(getSelectedTracklist()).then((track) => {
                if (track)
                    resolve(!_utils.isLibraryTrack(track));
                else
                    resolve(true);
            });
        });
    }
}

let wasBordered = true;
let wasMaximized = false;
let wasFlat = false;

function isVideoPlaying() {
    let sd = app.player.getCurrentTrack();
    if (sd)
        return ((app.player.isPlaying || app.player.paused) && sd.isVideo);
    return false;
}

function getAllHideElements(includeVideoParent) {
    // get all elements marked as 'hide in full window mode', except main panel spot

    let selector = '[data-hideInFullWindowMode]:not([data-mainPanelSpot]), [data-dock]';
    if (includeVideoParent)
        selector = selector + ', [data-videoWindowed]';

    let elements = qs(selector);
    let mainPanel = q('[data-mainPanelSpot]');
    if (mainPanel) {
        let ret: HTMLElement[] = [];
        for (let i = 0; i < elements.length; i++) {
            let insideMainPanel = isChildOf(mainPanel, elements[i]);
            if ((insideMainPanel && elements[i].hasAttribute('data-dock')) || (!insideMainPanel))
                ret.push(elements[i]);
        }
        return ret;
    }
    return elements;
}

export function maximizeView(viewContainer, toFullScreen, isInFullScreen, showPlayer) {
    if (toFullScreen && isInFullScreen)
        return;

    lockedLayout(window, function () { // to prevent update till we finished
        restoreView(isInFullScreen);
        let playingVideo = isVideoPlaying();
        let videoParent = q('[data-videoWindowed]');

        let playerDockId;
        let layout = getDocking().getCurrentLayout();
        if (layout) {
            let dock = layout.getPanelDock('mainPlayer');
            if (dock)
                playerDockId = dock.id;

        }

        // first hide all elements we do not need to have visible
        let elements = getAllHideElements(!playingVideo);
        elements.forEach(function (elem) {
            if (elem) {
                let newVisibility = false;
                if (playingVideo) {
                    if (isChildOf(elem, videoParent))
                        newVisibility = true;
                }

                // store previous state so we can correctly restore
                if (elem._beforeMaximizeState === undefined) {
                    elem._beforeMaximizeState = isVisible(elem, false /* do not include parents */ );

                    if (elem.hasAttribute('data-dockable')) // notify dockable panels
                        getDocking().notifyPanelStateChange(elem.getAttribute('data-id'), false);
                }
                if ((showPlayer && (elem.hasAttribute('data-mainPlayer')) || (playerDockId && elem.getAttribute('data-id') === playerDockId)) || (isChildOf(elem, viewContainer)))
                    newVisibility = true;

                setVisibility(elem, newVisibility);
            }
        });

        // make video panel visible
        if (playingVideo) {
            setVisibility(videoParent, true);
        }

        // maximize and disable window border if going to full screen
        if (toFullScreen) {
            wasBordered = bordered;
            wasMaximized = maximized;
            wasFlat = flat;
            setWindowState(false, true);
            if (!wasMaximized)
                maximize();
            if (headerClass) {
                setVisibility(headerClass.container, false);
                if (headerClass._offsetElement)
                    headerClass._offsetElement.classList.remove('windowHeaderOffset');
            }
        }
    });
}

export function restoreView(isInFullScreen, noAnimation = false) {
    lockedLayout(window, function () {
        if (isInFullScreen) { // was maximized ... restore
            setWindowState(wasBordered, wasFlat);
            if (!wasMaximized)
                restore();
            if (headerClass) {
                setVisibility(headerClass.container, true);
                if (headerClass._offsetElement)
                    headerClass._offsetElement.classList.add('windowHeaderOffset');
            }
        }

        let elements = getAllHideElements(true);
        elements.forEach(function (elem) {
            if (elem) {
                // restore from previous state
                if (elem._beforeMaximizeState !== undefined) {
                    setVisibility(elem, elem._beforeMaximizeState, noAnimation ? {
                        animate: false
                    } : undefined);

                    if (elem.hasAttribute('data-dockable')) // notify dockable panels
                        getDocking().notifyPanelStateChange(elem.getAttribute('data-id'), elem._beforeMaximizeState);

                    elem._beforeMaximizeState = undefined;
                }
            }
        });
        getDocking().refreshCurrentLayout(); // to update panels & docks visibility
    });
}

export function showPlayer(doShow, autoHideTimeout) {
    const playerCtrl: ElementWith<Control>|null = q('[data-mainPlayer]');
    if (playerCtrl) {
        setVisibility(playerCtrl, doShow);

        let uninstallEvent = function () {
            if (playerCtrl.autoHideEvent)
                app.unlisten(document.body, 'mousemove', playerCtrl.autoHideEvent);
            playerCtrl.autoHideEvent = undefined;
        };

        let cancelTimer = function () {
            if (playerCtrl.autoHideTimer)
                clearTimeout(playerCtrl.autoHideTimer);
            playerCtrl.autoHideTimer = undefined;
        };

        let restartTimer = function () {
            cancelTimer();
            playerCtrl.autoHideTimer = setTimeout(function () {
                playerCtrl.autoHideTimer = undefined;
                if (!window._cleanUpCalled)
                    setVisibility(playerCtrl, false);
            }, autoHideTimeout);
        };

        if (doShow && autoHideTimeout) {
            restartTimer();
            if (!playerCtrl.autoHideEvent) {
                playerCtrl.autoHideEvent = app.listen(document.body, 'mousemove', () => {
                    if (!window._cleanUpCalled) {
                        setVisibility(playerCtrl, true);
                        restartTimer();
                    }
                });
            }
        } else {
            uninstallEvent();
            cancelTimer();
        }
    }
}

export function navigateInNewTab(this: any, type: string, ...args) {
    // copy all arguments, without first one - type

    window.mainTabs.addNewTab(true).then(() => {
        navigationHandlers[type].navigate.apply(this, args);
    });
}

export function openMediaProperties(dbDrive): Promise<void> {
    return new Promise(function (resolve, reject) {
        openDialog('dlgMediaProperties', {
            modal: true,
            drive: dbDrive,
        }, function (dlg) {
            if (dlg.modalResult === 1) {
                resolve();
            } else {
                reject();
            }
        });
    });
}
window.uitools.openMediaProperties = openMediaProperties;

export function addPlayButtonMenu(btn) {
    // adds play menu commands to button context menu
    btn.controlClass = btn.controlClass || new Control(btn);
    btn.controlClass.canBeUsedAsSource = false;
    btn.controlClass.addToContextMenu([{
        action: actions.playNow,
        order: 10,
        grouporder: 20
    },
    {
        action: actions.playNext,
        order: 20,
        grouporder: 20
    },
    {
        action: actions.playLast,
        order: 30,
        grouporder: 20
    }
    ]);
}

export function addShuffleButtonMenu(btn) {
    // adds shuffle menu commands to button context menu
    btn.controlClass = btn.controlClass || new Control(btn);
    btn.controlClass.canBeUsedAsSource = false;
    let shuffledTitle = _('Play shuffled');
    let shuffledByAlbumTitle = _('Play shuffled (by Album)');
    btn.controlClass.addToContextMenu([{
        action: actions.playNowShuffled,
        order: 10,
        grouporder: 20,
        grouptitle: shuffledTitle
    },
    {
        action: actions.playNextShuffled,
        order: 20,
        grouporder: 20,
        grouptitle: shuffledTitle
    },
    {
        action: actions.playMixedShuffled,
        order: 30,
        grouporder: 20,
        grouptitle: shuffledTitle
    },
    {
        action: actions.playLastShuffled,
        order: 40,
        grouporder: 20,
        grouptitle: shuffledTitle
    },
    {
        action: actions.playNowShuffledByAlbum,
        order: 10,
        grouporder: 30,
        grouptitle: shuffledByAlbumTitle
    },
    {
        action: actions.playNextShuffledByAlbum,
        order: 20,
        grouporder: 30,
        grouptitle: shuffledByAlbumTitle
    },
    {
        action: actions.playLastShuffledByAlbum,
        order: 30,
        grouporder: 30,
        grouptitle: shuffledByAlbumTitle
    },
    ]);
}

export function isDockedDialog(dialogName: string) {
    const thisDialog = window[dialogName];
    if (!thisDialog)
        return false;
    return !!thisDialog._isDockedDialog;
}

export function showGoldMessage(message, closeEvent?: () => any) {

    let wnd = openDialog('dlgWizard', {
        title: _('Registration'),
        defaultPanel: 'pnlRegistration',
        register: true,
        modal: true,
        show: true,
        notShared: true,
        feature: message
    }, function (dlg) {
        if (dlg.modalResult == 1) {
            refreshGoldStatus();
        }
        if (closeEvent && isFunction(closeEvent))
            closeEvent();
    });
}

export function showSelectFilesMsg() {
    messageDlg(_('Please select one or more files for this operation.'), 'Information', ['btnOK'], undefined, undefined);
}

export function refreshGoldStatus() {
    if (app.getValue('mainMenuAlwaysVisible', true)) {
        // refresh main menu entry
        switchMainMenu(false);
        switchMainMenu(true);
    }
}

export function getDocking() {
    if (!window.docking)
        requirejs('helpers/docking');
    return window.docking;
}

export function getPlayerUtils() {
    if (!window.playerUtils)
        requirejs('playerUtils');
    return window.playerUtils;
}

export function getMusicBrainz() {
    if (!window.musicBrainz)
        requirejs('helpers/musicBrainz');
    return window.musicBrainz;
}

export function dockableDialogSpot() {
    let res = window.settings.UI.dockableDialogs ? qe(document, '[data-dockableDialogSpot]') : undefined;
    if (res)
        setVisibility(res, true);
    return res;
}

export function highlightDiffs(newText, oldText) {
    let text = '';
    newText.split('').forEach(function (value, index) {
        if (value != oldText.charAt(index))
            text += '<span class="bgColorWarning">' + value + '</span>'; //#18029
        else
            text += value;
    });
    return text;
}

export function beforePlayerSwitch(playerType /* 0 - main, 1 - micro, 2 - mini */ ) {
    if (window.fullWindowModeActive && (playerType > 0)) {
        // hide full window player and switcher
        window.playerUtils.hideFullWindowPlayer();
    }
}

export function addLink(this: any, addFunc, linkObj, desc) {

    let _this = this;
    let dlg;
    desc = desc || '';
    let getTitleCtrl = function () {
        let edtTitle = dlg.getValue('qid')('edtTitle');
        if (edtTitle && edtTitle.controlClass)
            return edtTitle.controlClass;
        return null;
    };
    let dlgTitle, defaultValue, defaultTitle;
    if(linkObj) {
        dlgTitle = _('Edit bookmark');
        defaultValue = linkObj.detail;
        defaultTitle = linkObj.title;
    }
    else {
        dlgTitle = _('Add bookmark');
        defaultValue = undefined;
        defaultTitle = undefined;
    }

    dlg = openDialog('dlgInputText', {
        modal: true,
        title: dlgTitle,
        editTitle: _('Website link:'),
        editTitleClass: 'narrowControl,textRight',
        description: desc,
        defaultValue: defaultValue,
        type: 'text',
        additionalContent: '<div class="stretchWidth flex row verticalBaseline"><label class="narrowControl textRight">' + _('Title') + ':</label><div data-id="edtTitle" data-control-class="Edit" class="fill" onkeydown="this.disableAutoFill = true"/></div>',
        changeEvent: function (e) {
            if (e.target && e.target.controlClass) {
                let val = e.target.controlClass.value;
                if (val && val !== _this.oldSearchVal) {
                    _this.oldSearchVal = val;
                    if (_this.tmr)
                        clearTimeout(_this.tmr);
                    _this.tmr = dlg.getValue('requestTimeout')(() => {
                        if (_this.webTitlePromise)
                            cancelPromise(_this.webTitlePromise);
                        _this.webTitlePromise = app.utils.web.getWebLinkTitle(val).then(function (title) {
                            _this.webTitlePromise = undefined;
                            let edtTitle = getTitleCtrl();
                            if (edtTitle && title && !edtTitle.container.disableAutoFill)
                                edtTitle.value = title;
                        });
                    }, 500);
                }
            }
        },
        onAfterInit: function () {
            if(defaultTitle) {
                let edtTitle = getTitleCtrl();
                if (edtTitle) {
                    edtTitle.value = defaultTitle;
                }
            }
        }
    });
    dlg.onClosed = function () {
        if (_this.tmr)
            clearTimeout(_this.tmr);

        if (_this.webTitlePromise)
            cancelPromise(_this.webTitlePromise);

        if (dlg.modalResult === 1) {
            let value = dlg.getValue('getTextInput')();
            if (value) {
                let title = '';
                let edtTitle = getTitleCtrl();
                if (edtTitle)
                    title = edtTitle.value;
                let id = -1;
                if(linkObj) {
                    id = linkObj.id;
                    linkObj.detail = value;
                    linkObj.title = title;
                }
                app[addFunc](-1, value, title, id);
            }
        }
    };
    app.listen(dlg, 'closed', dlg.onClosed);
}

let goldMessageShown = false;
export function handleGoldCheckbox(ctrl, message) {
    app.listen(ctrl, 'change', function () {
        if (!app.utils.isRegistered()) {
            if (ctrl.controlClass.checked) {
                ctrl.controlClass.checked = false;
                if (!goldMessageShown) {
                    goldMessageShown = true;
                    showGoldMessage(message, function () {
                        goldMessageShown = false;
                    });
                }
            }
        }
    });
}

export function showReloadConfirm(customCaption?: string): Promise<void> {
    return new Promise(function (resolve, reject) {
        //if (app.dialogs.openedWindowsCount() > 1) { // reloading can always terminate some processes (even when all other windows are closed (e.g. media sync and all processes from JS code)
        messageDlg((customCaption ? customCaption + '</br></br>' : '') + _('MediaMonkey needs to be restarted to apply the changes') + ' <br>' + _('Do you want to proceed?'), 'Confirmation', ['btnYes', 'btnNo'], {
            defaultButton: 'btnNo',
            title: _('Restart')
        }, function (result) {
            if (result.btnID === 'btnYes') {
                resolve();
            } else {
                reject();
            }
        });
        /*} else
            resolve();*/
    });
}

export function prepareWindowAsVideoPlayer(enable) {
    if (enable) {
        requirejs('controls/switchWindow');
        globalSettings.storedLastVideoMode = globalSettings.lastVideoMode;
        globalSettings.lastVideoMode = window.videoModes.C_FULLWINDOW;
        window.startFullWindowMode();
    } else {
        globalSettings.lastVideoMode = globalSettings.storedLastVideoMode;
    }
    if (window.globalVideoSwitcher && window.globalVideoSwitcher.controlClass) { // @ts-ignore
        window.globalVideoSwitcher.controlClass.switchToMode(globalSettings.lastVideoMode, true);
    }
    if (window.headerClass) {
        window.headerClass.prepareForVideoPlayback(enable);
    }
}

let star, halfStar, emptyStar;
loadIcon('star', function (data) {
    star = '<div class="ratingStar" data-fullstar style="height: 1em; width: 1em">' + data + '</div>';
    halfStar = '<div class="ratingStar" data-halfstar style="height: 1em; width: 1em">' + data + '</div>';
    emptyStar = '<div class="ratingStar" data-emptystar style="height: 1em; width: 1em">' + data + '</div>';
});

let makeRatingItem = function (rating) {
    let ret = '<div class="flex row ratingCanvas">';

    let fullStars = Math.floor(rating / 20);
    let restStars = 5 - fullStars;
    while (fullStars-- > 0) {
        ret += star;
    }

    if (rating % 20 > 0) {
        ret += halfStar;
        restStars--;
    }

    // add remaining disabled stars
    while (restStars-- > 0) {
        ret += emptyStar;
    }

    return ret + '</div>';
};

export function createRatingSubmenu(params) {
    let ret: Array<ReturnType<typeof createValue>> = [];
    let parentMenuAction = params.parentMenuAction;
    let ratingStep = params.ratingStep || 10;
    let ratingStepHalf = ratingStep / 2;
    let createValue = function (i) {
        return {
            _value: i,
            radiogroup: 1,
            title: function () {
                if (i == -1)
                    return _('Unknown');
                else
                    return makeRatingItem(this._value);
            },
            //disabled: notLocalMediaListSelected,
            checked: function () {
                let thisRating = this._value;
                return new Promise(function (resolve) {
                    let tracks = parentMenuAction.getTracklist() as Tracklist;
                    if (!tracks) {
                        resolve(false);
                        return;
                    }
                    localPromise(tracks.whenLoaded()).then(function () {
                        let use = false;
                        if (tracks.count === 1) {
                            tracks.locked(function () {
                                let track = tracks.getValue(0);
                                let rating = track.rating;
                                if (rating >= 0 && thisRating >= 0 && rating.between(thisRating - ratingStepHalf, thisRating + ratingStepHalf)) {
                                    use = true;
                                }
                                else if (rating < 0 && thisRating < 0) {
                                    use = true;
                                }
                            });
                        }
                        resolve(use);
                    });
                });
            },
            execute: function () {
                let tracks = parentMenuAction.getTracklist();
                if (!tracks)
                    return;
                let useRating = this._value;
                localPromise(tracks.whenLoaded()).then(function () {
                    tracks = tracks.getSelectedList();
                    localPromise(tracks.whenLoaded()).then(function () {
                        let changeFiles = function () {
                            tracks.modifyAsync(function () {
                                let track;
                                for (let i = 0; i < tracks.count; i++) {
                                    track = tracks.getFastObject(i, track);
                                    track.rating = useRating;
                                }
                                tracks.commitAsync();
                            });
                        };
                        if(tracks.count === 0) {
                            return;
                        }
                        if (tracks.count > 1) {
                            let msg = sprintf(_('Are you sure that you want to modify %d files ?'), tracks.count);
                            messageDlg(msg, 'Confirmation', ['btnYes', 'btnNo'], {
                                defaultButton: 'btnNo',
                                checked: false
                            }, function (result) {
                                if (result.btnID === 'btnYes') {
                                    changeFiles();
                                }
                            });
                        } else {
                            changeFiles();
                        }
                    });
                });
            }
        };
    };

    for (let i = 100; i >= 0; i -= ratingStep) {
        ret.push(createValue(i));
    }
    ret.push(createValue(-1));

    return ret;
}

export function scanForMedia(paths) {
    doScanForMedia(paths, app.filesystem.getScanExtensions().commaText, undefined);
}

export function runScan(paths, importers, containers, lookup) {
    let sel = paths.getCheckedList();
    sel.whenLoaded().then(function (sel) {
        doScanForMedia(sel, app.filesystem.getScanExtensions().commaText, importers, containers, lookup); // we need to run from main window context
    });
    requirejs('helpers/mediaSync');
    mediaSyncDevices.initLibraryScan(0 /* 0 seconds to run it immediately*/ ); // #14586 - item 1
}

let scanLookupManager: SharedWindow|null = null;
let ignoreLookup = false;
let incomingTracks: any[] = [];
let lookupParams = null;

function doScanForMedia(paths, exts, importers?, containers?, lookup?) {

    let delTracksHandler = function (deletedSongs) {
        if (deletedSongs.count) {
            openDialog('dlgDeletedTracks', {
                tracks: deletedSongs,
                shared: true,
                modal: true,
            }, function (dlg) {
                if (dlg.modalResult == 2) {
                    let toFindList = dlg.getValue('getCheckedTracks')();
                    toFindList.whenLoaded().then(function () {
                        locateTracksHandler(toFindList);
                    });
                } else {
                    refreshView();
                }
            });
        }
    };

    let params: Maybe<AnyDict> = undefined;
    if (lookup && app.utils.isRegistered()) {

        ignoreLookup = false;
        scanLookupManager = null;
        incomingTracks = [];
        lookupParams = null;

        let addIncomingTracks = function () {
            if (ignoreLookup) {
                incomingTracks = [];
                return;
            }
            assert(scanLookupManager);
            if (!scanLookupManager.windowIsLoaded) {
                window.requestTimeout(() => {
                    addIncomingTracks();
                }, 0);
            } else {
                while (incomingTracks.length) {
                    let tracks = incomingTracks.shift();
                    let list = scanLookupManager.getValue('getNewTracklist')();
                    list.addList(tracks);
                    scanLookupManager.getValue('addNewTracks')();
                }
            }
        };

        let addTracksToAutoTag = function () {
            if (ignoreLookup) {
                incomingTracks = [];
                return;
            }
            if (!scanLookupManager) {

                scanLookupManager = openDialog('dlgAutotag', {
                    modal: false,
                    tracks: incomingTracks.shift(),
                    storeState: true,
                    allowTrackProperties: true,
                    confirm: true,
                });
                scanLookupManager.onClosed = function () {
                    assert(scanLookupManager);
                    app.unlisten(scanLookupManager, 'closed', scanLookupManager.onClosed);
                    if (modalResult !== 1) {
                        ignoreLookup = true;
                    }
                    scanLookupManager = null;
                };
                app.listen(scanLookupManager, 'closed', scanLookupManager.onClosed);

                scanLookupManager.onReady = function () {
                    assert(scanLookupManager);
                    app.unlisten(scanLookupManager, 'ready', scanLookupManager.onReady);
                    addIncomingTracks();
                };
                app.listen(scanLookupManager, 'ready', scanLookupManager.onReady);

            } else {
                addIncomingTracks();
            }
        };

        let __receiveScanTracks = function (tracks) {
            if (ignoreLookup) {
                incomingTracks = [];
                return;
            }
            incomingTracks.push(tracks);
            requestAnimationFrame(function () {
                addTracksToAutoTag();
            });
        };

        params = {
            lookupCallback: __receiveScanTracks
        };
    }

    let _refreshTm;
    let _refreshTmFn = () => {  
        app.collections.refreshAll(); // #19576: Tree Nodes are not updated till scan is completed
        _refreshTm = requestTimeout(_refreshTmFn, 5000);
    };
    _refreshTmFn();    

    containers = containers || app.utils.createSharedList();
    app.filesystem.scanForMedia(paths, containers, exts, params).then(function (pars) {

        if (pars.confirmImportRatings && importers && importers.count)
            app.importer.processImports(importers);

        clearTimeout( _refreshTm);    
        app.collections.refreshAll(); // #14924 + #16864     
        refreshView(); // LS: so that the non-library tracks under Folders gets updated by library IDs (#20404)
        window.settings.observer.notifyChange(); // to force re-bind images for album Grid views

        if (pars.confirmScanResults && paths.count && !window._cleanUpCalled) {
            openDialog('dlgScanResults', {
                modal: true,
                notShared: true,
                deletedSongs: pars.deletedSongs,
                scanInfo: pars.scaninfo,
                filesInLib: pars.filesInLib,
            }, function (dlg) {
                delTracksHandler(pars.deletedSongs);
            });
        } else {
            delTracksHandler(pars.deletedSongs); // #17811
        }

    });
}

/** @hidden */
export function locateTracksHandler(toFindList) {
    if (toFindList.count) {

        let showLocateDialog = function (tracks, paths) {

            app.filesystem.scanForMovedFiles(tracks, paths).then(function (pars) {

                let addTracksToLibrary = function (locatedList) {
                    if (locatedList) {
                        locatedList.whenLoaded().then(function (list) {
                            if (list.count) {
                                app.filesystem.processLocatedFiles(list);
                            }
                        });
                    }
                };

                let removetracksFromLibrary = function (unlocatedList) {
                    if (unlocatedList) {
                        unlocatedList.whenLoaded().then(function (list) {
                            if (list.count) {
                                app.db.processUnlocatedTracks(list).then(refreshView);
                            }
                        });
                    }
                };

                if (pars.automaticallyUpdateMovedFiles) {
                    addTracksToLibrary(pars.foundList);
                } else {
                    let dlgParams = {
                        show: true,
                        modal: true,
                        scanRes: pars,
                        shared: false,
                        locatedList: null,
                        unlocatedList: null
                    };
                    openDialog('dlgMovedFiles', dlgParams, function (dlg) {
                        if (dlg.modalResult == 1) {
                            let data = dlg.getValue('getData')();
                            addTracksToLibrary(data.locatedList);
                            removetracksFromLibrary(data.unlocatedList);
                        }
                    });
                }
            });
        };

        openDialog('dlgSelectFolder', {
            modal: true,
            title: _('Locate moved/missing files'),
            subtitle: _('Search the selected locations:'),
            helpContext: 'Adding Existing Files to the Library#Manually Locate Moved/Missing Files',
            multiselect: true,
            hideUnselectedVisible: false,
            newFolderVisible: false
        }, function (dlg) {
            if (dlg.modalResult == 1) {
                let paths = dlg.getValue('getResult')();
                if (paths.count) {
                    showLocateDialog(toFindList, paths);
                } else {
                    messageDlg(_('Please select at least one folder to scan.'), 'Error', ['btnOK'], undefined, undefined);
                }
            }
        });
    } else {
        showSelectFilesMsg();
    }
}

export function handlePlayAction(action: Action, lst?) {
    let touchWasUsed = usingTouch;
    let currentListView = window.lastFocusedControl;
    let pl = app.player;

    if (app.inPartyMode) {
        // following is here to resolve #21763: Party Mode: Playback commands don't respect party mode settings
        let defAct = app.player.getDefaultAction();
        if (action.actionType == 'playNow' && defAct == 'playLast')
            action.actionType = 'playLast';
        if (action.actionType == 'playNowShuffled' && defAct == 'playLast')
            action.actionType = 'playLastShuffled';
        if (action.actionType == 'playNow' && defAct == 'playNext')
            action.actionType = 'playNext';
        if (action.actionType == 'playNowShuffled' && defAct == 'playNext')
            action.actionType = 'playNextShuffled';        
    }
    


    if (!lst && currentListView && currentListView.controlClass && currentListView.controlClass.dataSource && (currentListView.controlClass.dataSource.itemObjectType === 'playlistentry')) {
        // different handling for actions from Now Playing
        let ds = currentListView.controlClass.dataSource; // list of IPlaylistEntry
        let selTracksCount = ds.selectedCount;
        if (selTracksCount === 0)
            return;
        switch (action.actionType) {
        case 'playNow': // skip to the first selected track
            let selTracks = ds.getSelectedList(); // list of IPlaylistEntry
            selTracks.whenLoaded().then(function () {
                if (window._cleanUpCalled)
                    return;
                if (selTracks.count > 0) {
                    selTracks.locked(function () {
                        pl.setPlaylistPosByEntryAsync(selTracks.getValue(0)).then(function () {
                            pl.playAsync();
                        });
                    });
                }
            });
            break;
        case 'playNowShuffled': // shuffle selection, play first
            pl.randomizePlaylistAsync({
                onlySelected: true
            }).then(function () {
                let selTracks = ds.getSelectedList(); // list of IPlaylistEntry
                selTracks.whenLoaded().then(function () {
                    if (window._cleanUpCalled)
                        return;
                    if (selTracks.count > 0) {
                        selTracks.locked(function () {
                            pl.setPlaylistPosByEntryAsync(selTracks.getValue(0)).then(function () {
                                pl.playAsync();
                            });
                        });
                    }
                });
            });
            break;
        case 'playNext': // move all selected tracks after current
            ds.modifyAsync(function () {
                ds.moveSelectionToSpecial(pl.playlistPos + 1);
            });
            break;
        case 'playNextShuffled': // shuffle selection, move after current
            pl.randomizePlaylistAsync({
                onlySelected: true
            }).then(function () {
                if (window._cleanUpCalled)
                    return;
                ds.modifyAsync(function () {
                    ds.moveSelectionToSpecial(pl.playlistPos + 1);
                });
            });
            break;
        case 'playLast': // move all selected tracks to the end of NP list
            ds.modifyAsync(function () {
                ds.moveSelectionToSpecial(ds.count);
            });
            break;
        case 'playLastShuffled': // shuffle selection, move all selected tracks to the end of NP list
            pl.randomizePlaylistAsync({
                onlySelected: true
            }).then(function () {
                if (window._cleanUpCalled)
                    return;
                ds.modifyAsync(function () {
                    ds.moveSelectionToSpecial(ds.count);
                });
            });
            break;
        }
    } else {
        let selTracks: Maybe<Tracklist> = lst || action.getTracklist();
        if (!selTracks) {
            return;
        }
        selTracks.whenLoaded().then(function (selTracks) {
            if (window._cleanUpCalled)
                return;
            switch (action.actionType) {
            case 'playNow': // 'Play Now' action has special handling based on track type settings
            case 'playNowShuffled':
            case 'playNowShuffledByAlbum':                
                let track: Maybe<Track>;
                selTracks.locked(function () {
                    if (selTracks.count > 0)
                        track = selTracks.getValue(0);
                });
                if (track) {
                    track.getTrackTypeAsync().then(async function (tt) { // use async, to be sure, we have correct track type
                        if (window._cleanUpCalled)
                            return;
                        let actType = app.settings.utils.getPlayNowActionType(tt);
                        let singleClicked = false;
                        if ((selTracks.count == 1) && (actType == 'clear_playAll') && (!action.onlySelected)) {
                            // if only single track is selected (or double-clicked) then we want to add _all_ tracks to 'Playing' list (not just the selected one)
                            singleClicked = true;
                            let ds = getSelectedDataSource();
                            let newSelTracks: Maybe<Tracklist>;
                            if (ds && ds.objectType == 'tracklist') /* e.g. for artist list we still want only selected artists' tracklist */
                                newSelTracks = getTracklist();
                            else if (ds && ds.getTracklist)
                                newSelTracks = getTracklist();
                            if (newSelTracks) {
                                selTracks = newSelTracks;
                                try {
                                    await selTracks.whenLoaded();
                                } catch(e) {
                                    return;
                                }
                            }
                        }
                        let clearList = false;
                        if (actType == 'clear_playAll' || actType == 'clear_playSelected')
                            clearList = true;
                        let oldEntriesCount = pl.entriesCount;
                        //let prevPos = pl.playlistPos;
                        let ignore = false;
                        let afterCurrent = (actType === 'playSelected');
                        if (touchWasUsed) {
                            selTracks.locked(function () {
                                ignore = ((oldEntriesCount === selTracks.count) && (pl.isPlaying) && (track.isSame(pl.getCurrentTrack())));
                            });
                        }
                        if (!ignore) {
                            let shuffled = ((action.actionType === 'playNowShuffled') || (action.actionType === 'playNowShuffledByAlbum'));
                            let newidx;
                            if (clearList) {
                                if(singleClicked) {
                                    newidx = selTracks.indexOf(track);
                                    if(shuffled && (newidx >= 0)) {
                                        let shuffleAll = app.settings.utils.getShuffleAllInPlayNow(tt);
                                        if(shuffleAll) {
                                            selTracks.delete(newidx);
                                            selTracks.insert(0, track);
                                            newidx = 0;
                                        }
                                    }
                                }
                                else
                                    newidx = -1;
                            }
                            else {
                                newidx = -1;//prevPos + 1; #21442
                            }
                            pl.addTracksAsync(selTracks, {
                                withClear: clearList,
                                startPlayback: true,
                                afterCurrent: afterCurrent,
                                shuffle: shuffled,
                                focusedTrackIndex: newidx,
                                byAlbum: (action.actionType === 'playNowShuffledByAlbum')
                            });
                        }
                    });
                } else
                    ODS('handlePlayAction, no track');
                break;
            case 'playNext':
            case 'playNextShuffled':
            case 'playNextShuffledByAlbum':
                pl.addTracksAsync(selTracks, {
                    afterCurrent: true,
                    shuffle: ((action.actionType === 'playNextShuffled') || (action.actionType === 'playNextShuffledByAlbum')),
                    byAlbum: (action.actionType === 'playNextShuffledByAlbum')
                });
                break;
            case 'playLast':
            case 'playLastShuffled':
            case 'playLastShuffledByAlbum':
                pl.addTracksAsync(selTracks, {
                    shuffle: ((action.actionType === 'playLastShuffled') || (action.actionType === 'playLastShuffledByAlbum')),
                    byAlbum: (action.actionType === 'playLastShuffledByAlbum')
                });
                break;
            case 'playMixedShuffled':
                pl.addTracksAsync(selTracks, {
                    afterCurrent: true,
                    mix: true // shuffle not needed, mix place each track at random position
                });
                break;
            }
        });
    }
}

/** @hidden */
export function copyItem(cut?: boolean) {
    window.clipboard = null; // to clean window.clipboard used in copyNodeItem (see nodeUtils.createContextMenu)
    // @ts-ignore
    if (!window.settings.UI.canDragDrop || !window.lastFocusedControl || !window.lastFocusedControl.controlClass || resolveToValue(window.getCurrentEditor, undefined))
        return;
    let lastControl = window.lastFocusedControl;
    let ds = lastControl.controlClass.dataSource;
    if (!ds)
        return;
    if (ds.dataObject) {
        let tl = ds.dataObject.getTracklist();
        tl.whenLoaded().then(function () {
            app.utils.copyToClipboard(tl, {
                cut: !!cut
            });
        });
    } else
    if (ds.objectType == 'sharednodelist') {
        let node = ds.focusedNode;
        if (node)
            nodeUtils.copyNodeItem(node, cut);
        else {
            ds.getSelectedList().whenLoaded().then(function (selNodes) {
                if (selNodes.count) {
                    node = getValueAtIndex(selNodes, 0); // TODO? : multiple nodes copy support
                    nodeUtils.copyNodeItem(node, cut);
                }
            });
        }
    } else {
        let view = lastControl.controlClass.parentView;
        let srcObject = '';
        if (view)
            srcObject = nodeUtils.storeDataSource(view.viewNode.dataSource);
        ds.getSelectedList().whenLoaded().then(function (selectedList) {
            dnd.getTracklistAsync(selectedList).then(function (list) {
                if (list) {
                    app.utils.copyToClipboard(list, {
                        cut: !!cut,
                        srcObject: srcObject
                    });
                }
            });
        });
    }
}

export function pasteItem(control?: HTMLElement) {
    let ctrl = control;
    if (!ctrl)
        ctrl = window.lastFocusedControl; // @ts-ignore
    if (!window.settings.UI.canDragDrop || !ctrl || !ctrl.controlClass || resolveToValue(window.getCurrentEditor, undefined))
        return;

    let cc = ctrl.controlClass;
    if (canPasteClipboard(cc.canDrop.bind(cc))) {
        pasteClipboard(cc.canDrop.bind(cc), cc.drop.bind(cc));
    }
}

export function pasteClipboard(canPasteFunc, pasteFunc) {
    if (window.clipboard && window.clipboard.data && canPasteFunc(window.clipboard)) {
        // e.g. pasting playlist
        let cb = window.clipboard;
        pasteFunc(cb);
        dnd.finishedDragNDrop();
    } else {
        // e.g. pasting file list or bitmap image
        let cdata = app.utils.getDataFromClipboard();
        if (cdata && cdata.data) {
            if (canPasteFunc(cdata)) {
                pasteFunc(cdata);
                dnd.finishedDragNDrop();
            }
            if (cdata.params.cut && cdata.params.srcObject) {
                nodeUtils.restoreDataSource(cdata.params.srcObject).then(function (obj) {
                    if (obj)
                        obj.doCut(cdata.data); // e.g. cutting tracks form playlist obj
                });
            }
        }
    }
}

export function canPasteClipboard(canPasteFunc) {
    if (window.clipboard && window.clipboard.data && canPasteFunc(window.clipboard)) {
        return true;
    } else {
        let cdata = app.utils.getDataFromClipboard(true /* just test, would be slow for image bitmap otherwise*/ );
        if (cdata && cdata.data) {
            if (canPasteFunc(cdata))
                return true;
        }
        dnd.finishedDragNDrop();
    }
}

export function _getDeleteInfo(control, tracks) {
    return new Promise(function (resolve, reject) {

        let result: {
            confType: string;
            device?: Device;
            playlist?: Playlist;
            hasRemoteTracksOnly?: boolean;
        } = {
            confType: 'library'
        };

        ODS('_getDeleteInfo: controlClass: ' + control.controlClass.constructor.name);
        if (control.controlClass.deleteInfo)
            result = control.controlClass.deleteInfo();
        else {
            let ds = control.controlClass.dataSource;
            if (ds)
                ODS('_getDeleteInfo: ds.itemObjectType: ' + ds.itemObjectType);
            if (ds && ds.itemObjectType === 'playlistentry') {
                result.confType = 'nowplaying';
            } else {
                let pv = control.controlClass.parentView;
                if (pv && pv.viewNode) {
                    result.device = nodeUtils.getNodeDevice(pv.viewNode);
                    let obj = pv.viewNode.dataSource;
                    if (obj) {
                        switch (obj.objectType) {
                        case 'folder':
                            result.confType = 'computer';
                            break;
                        case 'playlist':
                            if (!obj.isAutoPlaylist) {
                                result.confType = 'playlist';
                                result.playlist = obj;
                            }
                            break;
                        }
                    }
                }
            }
        }

        let _resolve = () => {
            if (result.device && result.confType != 'nowplaying' && result.confType != 'playlist')
                result.confType = 'device';
            resolve(result);
        };
        if (tracks) {
            let foundRemoteLink;
            let allRemoteOnly = true;
            if (!result.device || (result.device.handlerID != 'usb')) {
                fastForEach(tracks, (track, idx) => {

                    if (allRemoteOnly && (!_utils.isRemoteTrack(track) || _utils.isLibraryTrack(track)))
                        allRemoteOnly = false;

                    if (!foundRemoteLink && _utils.hasRemoteTrackLink(track)) {
                        foundRemoteLink = true;
                        let _track = getValueAtIndex(tracks, idx);
                        app.devices.getTrackSourceInfoAsync(_track).then(() => {
                            let sourceInfo = cloudTools.getSourceInfo(_track);
                            requirejs('helpers/mediaSync');
                            let _device = mediaSyncDevices.getById(sourceInfo.device_id);
                            if (_device)
                                result.device = _device;
                            _resolve();
                        });

                    }
                });
            }
            result.hasRemoteTracksOnly = allRemoteOnly;
            if (!foundRemoteLink)
                _resolve();
        } else {
            _resolve();
        }
    });
}

export function deleteTracklist(selTracks: Tracklist, permanent?:boolean, useControl?:HTMLElement) {
    const lastControl = useControl || window.lastFocusedControl; // prepare immediatelly, it could change during loading selTracks
    assert(lastControl, 'lastFocusedControl undefined!');
    ODS('deleteTracklist: controlClass: ' + lastControl.controlClass.constructor.name);
    let ds = lastControl.controlClass.dataSource;
    return new Promise(function (resolve, reject) {
        lastControl.controlClass.localPromise(selTracks.whenLoaded()).then(function () {
            let cnt = selTracks.count;
            if (cnt > 0) {
                let fName = undefined;
                let firstTrack;
                selTracks.locked(function () {
                    firstTrack = selTracks.getValue(0);
                    if (cnt === 1)
                        fName = firstTrack.path;
                });
                ODS('deleteTracklist: controlClass: ' + lastControl.controlClass.constructor.name + ', selTracks.count: ' + cnt);

                lastControl.controlClass.localPromise(_getDeleteInfo(lastControl, selTracks)).then((delInfo) => {
                    ODS('deleteTracklist: delInfo.confType: ' + delInfo.confType);
                    showDeleteDlg({
                        fileCount: cnt,
                        fileName: fName,
                        firstTrack: firstTrack,
                        confType: delInfo.confType,
                        device: delInfo.device,
                        hasRemoteTracksOnly: delInfo.hasRemoteTracksOnly,
                        playlist: delInfo.playlist,
                        shift: permanent
                    }).then(function (retvals) {
                        let promises: Promise<any>[] = [];
                        
                        if (typeof retvals === 'string') {
                            if (retvals == '')
                                retvals = [];
                            else
                                retvals = [retvals];
                        }
                        
                        if (inArray('computer', retvals)) {
                            retvals = retvals.filter((e) => {
                                return e != 'library'; // remove 'library' (as 'computer' deletion removes the track from the library too)
                            });
                        }

                        let bypass;
                        if (inArray('computer', retvals) && inArray('nowplaying', retvals)) {
                            bypass = true;
                            // when removing both from 'nowplaying' and 'computer' we need to wait for user result of confirmation for deletion of the playing track (#15741):
                            app.trackOperation.deleteFilesAsync(selTracks, !permanent).then((deletedFromNP) => {
                                // PETR: tracks are already deleted from lists using globalModifyWatch so app.player.removeSelectedTracksAsync call is not needed (and can cause #15859)
                            }, () => {
                                // user doesn't wish to delete the playing track
                            });
                        }
     
                        if (!bypass)
                            for (let retval of retvals) {
                                switch (retval) {
                                case 'library':
                                    promises.push(app.trackOperation.removeFilesFromDBAsync(selTracks));
                                    if (window.currentTabControl && window.currentTabControl.multiviewControl) {
                                        let history = window.currentTabControl.history;
                                        history.cleanCacheForFolders(); // otherwise tracks removed from library would be removed from cache for non-library folders too (#20404 / 3)
                                    }
                                    if (ds && ds.deleteSelected)
                                        ds.deleteSelected(); // #18750
                                    break;
                                case 'computer':
                                    promises.push(app.trackOperation.deleteFilesAsync(selTracks, !permanent));
                                    if (ds && ds.deleteSelected)
                                        ds.deleteSelected(); // #18750
                                    break;
                                case 'nowplaying':
                                    promises.push(app.player.removeSelectedTracksAsync(selTracks));                                 
                                    break;
                                case 'playlist':
                                    promises.push(delInfo.playlist.removeSelectedTracksAsync(ds));
                                    break;
                                case 'device_local':
                                case 'device_remote':
                                case 'device_remote_local':                                    
                                    let device = delInfo.device;
                                    if (retval == 'device_remote' || retval == 'device_remote_local')
                                        removeFromDevice(device, selTracks);
                                    if (retval == 'device_local' || retval == 'device_remote_local' || retval == 'device_remote') {
                                        let libRemoveType = 'local_and_remote';
                                        if (retval == 'device_local')
                                            libRemoveType = 'local_only';
                                        if (retval == 'device_remote')
                                            libRemoveType = 'remote_only';
                                        promises.push(device.removeTracksFromLibrary(false /* no confirmation */ , selTracks, libRemoveType, !permanent));
                                    }
                                    if (ds && (retval == 'device_remote_local' || // track to be deleted from both locations (e.g. local+cloud)
                                                (retval == 'device_remote' && firstTrack && // track to be removed from remote location only (device or cloud)
                                                    (_utils.isRemoteTrack(firstTrack) || !_utils.isLibraryTrack(firstTrack) /* #16208 - item 2 */ )))) {
                                        ds.deleteSelected();
                                    }
                                    break;
                                }
                            }
                        if (promises.length > 0) {
                            whenAll(promises).then(function () {                          
                                if (retvals.length)
                                    resolve(retvals);
                                else
                                    resolve(null);
                            });
                        } else {
                            if (retvals.length)
                                resolve(retvals);
                            else
                                resolve(null);
                        }
                    }, reject);
                });
            } else {
                showSelectFilesMsg();
                reject();
            }
        });
    });
}


// add docks
let createDockEntry = (dock, index) => {
    return {
        action: {
            dock: dock,
            title: _(dock.title),
            checked: function () {
                let el = this.dock.domElement;
                if (window.currentTabControl) {
                    let elem = qe(window.currentTabControl.container, '[data-id='+this.dock.id+']');
                    if (elem)
                        el = elem;
                }
                if (el) {
                    return !el._forcedVisible && isVisible(el, false);
                }
                else
                    return false;
            },
            checkable: true,
            visible: function () {
                return !window.settings.UI.disableRepositioning && !window.isTouchMode && dock.containAnyPanel();
            },
            disabled: function () {
                if (window.settings.UI.disableRepositioning || window.isTouchMode)
                    return true;
                return !dock.containAnyPanel();
            },
            execute: function () {
                let el = this.dock.domElement;
                if (window.currentTabControl) {
                    let elem = qe(window.currentTabControl.container, '[data-id='+this.dock.id+']');
                    if (elem)
                        el = elem;
                }
                if (!el)
                    el = qe(document.body, '[data-id=' + this.dock.id + ']');
                if (!el)
                    return;
                let vis = !isVisible(el, false);
                if (el._forcedVisible)
                    el._forcedVisible = undefined; // was visible only for displaying visualization or video

                setVisibility(el, vis);
                el._manualVisibilityState = vis;
                getDocking().handleDockVisibility(el, vis);
                if (el)
                    getDocking().notifyDockStateChange(this.dock.id, vis);
            }
        },
        order: (index + 2) * 10,
        grouporder: 20
    };
};

export function fillDocksMenu() {
    assert(isMainWindow, 'uitools.fillDocksMenu can only be called from main window!');
    let docks = getDocking().getAvailableDocks();
    docks.forEach(function (dock, index) {
        window._menuItems.view.action.submenu.push(createDockEntry(dock, index));
    });
}

/**
Miscellaneous UI tools. Most can be found in actions.js. Not all are included in the API documentation.
@class uitools
@static
*/

/**
Whether the user is currently allowed to modify things like track properties. False when in Party Mode.
@for uitools
@method getCanEdit
@returns {boolean} 
 */
export function getCanEdit() {
    return window.settings.UI.canEdit;
}
/**
Whether the user is currently allowed to delete items.
@for uitools
@method getCanDelete
@returns {boolean}
 */
export function getCanDelete() {
    return window.settings.UI.canDelete;
}
/**
Get either the helpContext of a controlClass or the data-help attribute of an element.
@for uitools
@method getHelpContext
@param {HTMLElement} el
@returns {string} The help context of the element.
 */
export function getHelpContext(el) {
    if (el.controlClass) {
        if (isFunction(el.controlClass.helpContext)) {
            return el.controlClass.helpContext();
        } else
            return el.controlClass.helpContext || el.getAttribute('data-help') || '';
    } else
        return el.getAttribute('data-help') || '';
}

/** @since 5.0.1 */
export function openHelpContent() {
    let helpId: string|undefined;
    let el: Element|null = document.activeElement || document.body;
    while (el instanceof HTMLElement) {
        helpId = getHelpContext(el);
        if (helpId)
            break;
        el = el.parentElement;
    }
    if (!helpId)
        helpId = 'Content';

    if (helpId.match(/^http[s]?:\/\//gi)) { // help id contains whole link - just open it, #19031
        app.utils.web.openURL(helpId);
        return;
    }

    helpId = helpId.replace(/ /g, '_').replace(/\//g, '%2F');
    // separate anchor, if exists
    let helpArr = helpId.split('#');
    helpId = helpArr[0];
    let anchor = helpArr[1] || '';
    if (anchor) {
        anchor = '&anchor=' + anchor.replace(/ /g, '_').replace(/\//g, '%2F');
    }
    //alert(anchor);
    app.utils.web.openURL('https://www.mediamonkey.com/webhelp?hp=' + helpId + '&vmaj=' + app.versionHi + '&vmin=' + app.versionLo + '&vrel=' + app.versionRelease + '&lang=' + app.utils.getUsedLanguage() + anchor);
}

// From baseVis.js
export function getVisMenuItems () {
    let menuitems: Action[] = [];
    for (let i = 0; i < visualizations.length; i++) {
        let vis = visualizations[i];
        let act = {
            title: vis.visName,
            visObj: vis,

            execute: function () {
                window.playerUtils.initializeVisualization(this.visObj);
            },

            checked: function () {
                globalSettings.selectedVisualization = globalSettings.selectedVisualization || 'Vis_milkdrop';
                return (globalSettings.selectedVisualization === this.visObj.className);
            }
        };
        menuitems.push(act);
    }
    return menuitems;
}

// BEGIN main-window only functions
/** @hidden */
export let wndTrackInfo: SharedWindow;
/** @hidden */
export let wndTrackInfoLoaded = false;

export function createTrackInfo(cbk?: () => SharedWindow) {
    
}

// export function getTrackInfoSize() {
    
// };

// export function showTrackInfo(params?) {

// };
// export function hideTrackInfo() {

// };
// export function mouseInsideTrackInfo() {
 
// }
// END main-window only functions


//import {tracklistFieldDefs} from './controls/trackListView'; 
//window.uitools.tracklistFieldDefs = tracklistFieldDefs;
//export tracklistFieldDefs;

export declare var toastMessage: any; // toastMessage.js
export declare var currPlayerState: string; // baseVis.js

export const visMenuItems: Dictionary<Action|SubmenuItem> = {  };

// @ts-ignore
let allowedProps = ['visible', 'disabled', 'checked', 'title', 'submenu', 'execute', 'hotlinkExecute', 'action', 'order', 'grouporder', 'identifier', '_identifier', 'dock', 'checkable', 'id', 'icon'];

// @ts-ignore
export function prepareMenuForOSX(obj) {
    return new Promise<void>((resolve) => {

        if (!isMainWindow) {
            resolve(undefined);
            return;
        }

        let newObj = [];
        let osxMenuPromises = [];
        let func;

        let addAsync = function (obj, attr, pr, newObj) {
            if (isFunction(pr['whenLoaded'])) {
                osxMenuPromises.push(new Promise((resolve) => {
                    pr.whenLoaded().then1((val) => {
                        newObj[attr] = val;
                        resolve(undefined);
                    });
                }));
            }
            else {
                osxMenuPromises.push(new Promise((resolve) => {
                    pr.then1((val) => {
                        newObj[attr] = val;
                        if ((newObj[attr] instanceof Object) || (typeof newObj[attr] === 'object' /* object from different context return false for instanceof */)) {
                            func(val, newObj[attr]);
                        }
                        resolve(undefined);
                    });
                }));
            }
        };
        let prepProperty = function(o, p, n) {
            if (o[p] instanceof Array) {
                n[p] = [];
                return true;
            } else
            if (o[p] instanceof Object) {
                n[p] = {};
                return true;
            } else
                return false;
        };
        let addProperty = function(o, p, n) {
            if (p == 'execute' || p == 'hotlinkExecute') {
                n[p] = o[p];
            } else
            if (isFunction(o[p])) {
                let retVal = resolveToValue(o[p], undefined, o, o);
                if (isPromise(retVal) || isFunction(retVal['whenLoaded'])) {
                    addAsync(o, p, retVal, n);
                }
                else {
                    n[p] = retVal;
                }
            } else {                
                if(prepProperty(o, p, n)) {
                    func(o[p], n[p]);
                } else
                    n[p] = o[p];
            }
        };

        func = function (o, n) {
            if (o instanceof Array) {
                if (!(n instanceof Array))
                    n = [];
                for (let i = 0; i < o.length; i++) {
                    let n1 = {};
                    let ret = func(o[i], n1);
                    n.push(ret);
                }
            } else {
                n['_original'] = o;
                for (let i = 0; i < allowedProps.length; i++) {
                    let prop = allowedProps[i];
                    if (prop == 'visible') { // check visibility ... if hidden, do not process
                        let vis = {visible: true};
                        if (o[prop] !== undefined)
                            addProperty(o, prop, vis);
                        if (!vis['visible'])
                            break;
                    }
                    if (o[prop] !== undefined)
                        addProperty(o, prop, n);
                
                }
            }
            return n;
        };

        func(obj, newObj);
        whenAll(osxMenuPromises).then(() => {
            // @ts-ignore
            window.assignMenuIdentifiers(newObj);
            window.osxMenu = newObj;
            resolve(uitools.OSXMenuToJSON(newObj));
        });
    });
}

export function OSXMenuToJSON(menu) {

    let simplify = function (key, value) {
        if (!isNaN(key))
            return value;
        if (allowedProps.indexOf(key) >= 0)
            return value;
        return undefined;
    };

    return JSON.stringify(menu, simplify);
}


window.uitools.OSXMenuToJSON = OSXMenuToJSON;

export function refreshMenu() {
    uitools.prepareMenuForOSX(window.mainMenuItems).then((data) => {
        menuJSON = data;
    });
}

window.uitools.refreshMenu = refreshMenu;

export function waitFortNextFrame (fn) {
    return new Promise(function (resolve) {
        requestAnimationFrame(function () {
            let ret = undefined;
            if(isFunction(fn)) {
                ret = fn();
            }
            resolve(ret);
        });
    });
}
window.uitools.waitFortNextFrame = waitFortNextFrame;

export function getScrollingParent(el, prevSP) {
    // LS: note that scrollingParent can be changed when control is re-used from controlCache and gets another scroll parent
    //     keep in mind that scrollingParent doesn't always have controlClass, it can be any DIV with 'scrollable' class (or a Scroller component with controlClass)
    let retval = prevSP;
    if (!retval || !isChildOf(retval, el)) {
        retval = undefined;
        let ctrl = el;
        while ((ctrl = ctrl.parentNode) && (ctrl instanceof Element)) { // We need DOM hierarchy, not offsetParent
            let style = getComputedStyle(ctrl);
            if ((ctrl.classList.contains('listview')) || (ctrl.classList.contains('dynroot')) ||
                style.overflowX === 'auto' || style.overflowX === 'scroll' || style.overflowY === 'auto' || style.overflowY === 'scroll') {
                // JH: For some reason the condition above is fullfilled even if we set all divs to overflow: hidden. They are still calculated as 'auto', not sure why.
                if (ctrl.classList.contains('lvCanvas'))
                    continue; // Ignore scrolling canvas of a listview - use the listview itself
                retval = ctrl;
                break;
            }
        }
        if (!retval) {
            retval = el.offsetParent as HTMLElement; // Our direct parent will work for our purposes.
        }
    }
    return retval;
}
window.uitools.getScrollingParent = getScrollingParent;

/**
* Prepares the focus handling by arrows for the elements.
* @method createBoundFocusHandling
* @param {Control} ctrl Control to which the focus handling is bound
* @param {HTMLElement} containerEl Element containing the elements to focus
* @param {string[]} elementIDs IDs of the elements to which the focus handling is bound
*/
export function createBoundFocusHandling(ctrl:Control, containerEl:HTMLElement, elementIDs:string[]) {
    if(!elementIDs || (elementIDs.length == 0))
        return;
    let UI = getAllUIElements(containerEl);
    let activeElement = document.activeElement;
    let activeID = undefined;
    if (activeElement && activeElement.hasAttribute('data-id')) {
        activeID = activeElement.getAttribute('data-id');
    }
    // set tabbable only the first element, the rest programmatically
    let el = UI[elementIDs[0]] as HTMLElement;
    if(el.controlClass)
        el.controlClass.tabIndex = 0;
    else
        el.tabIndex = 0;
    for (let i = 1; i < elementIDs.length; i++) {
        el = UI[elementIDs[i]] as HTMLElement;
        if(el.controlClass)
            el.controlClass.tabIndex = -1;
        else
            el.tabIndex = -1;
    }
    
    ctrl._currentLocalFocusIndex = -1;
    let wasInitialized = !!ctrl._localFocusIDsArray;
    ctrl._localFocusIDsArray = elementIDs.slice();

    if(!wasInitialized) {
        // Function to set focus to a specific containerEl control if it's visible
        const focusLocalElement = (index, key) => {
            // Ensure index is within bounds (circular navigation)
            while (index < 0) index += ctrl._localFocusIDsArray.length;
            index = index % ctrl._localFocusIDsArray.length;
            
            // Try to find a visible control starting from the given index
            let direction = 1; // Default direction for Right key
            
            // If we're navigating left, we need to check controls in reverse order
            if (key === 'Left') {
                direction = -1;
            }
            
            for (let i = 0; i < ctrl._localFocusIDsArray.length; i++) {
                let controlIndex = (index + i * direction) % ctrl._localFocusIDsArray.length;
                
                // Ensure positive index when moving left
                if (controlIndex < 0) controlIndex += ctrl._localFocusIDsArray.length;
                
                let el = UI[ctrl._localFocusIDsArray[controlIndex]] as HTMLElement;
                if (el && isVisible(el)) {
                    el.focus();
                    ctrl._currentLocalFocusIndex = controlIndex;
                    return true;
                }
            }
            return false;
        };        
        // Handle arrow key navigation within containerEl
        ctrl.localListen(containerEl, 'keydown', function(e) {
            let key = friendlyKeyName(e);
            
            if (key === 'Right' || key === 'Left') {
                // Only handle navigation if we're already focused on a containerEl control
                if (ctrl._currentLocalFocusIndex >= 0 || ctrl._localFocusIDsArray.includes(document.activeElement?.getAttribute('data-id'))) {
                    // Update current index if it's not set correctly
                    if (ctrl._currentLocalFocusIndex < 0) {
                        let activeId = document.activeElement?.getAttribute('data-id');
                        ctrl._currentLocalFocusIndex = ctrl._localFocusIDsArray.indexOf(activeId);
                    }
                    
                    // Navigate right or left
                    let newIndex = ctrl._currentLocalFocusIndex + (key === 'Right' ? 1 : -1);
                    if (focusLocalElement(newIndex, key)) {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                }
            }
        });
        let c = ctrl as any;
        if(!c.ignoreHotkey) {
            c.ignoreHotkey = function(hotkey) {
                let ar = ['Right', 'Left', 'Enter'];
                return inArray(hotkey, ar, true /* ignore case */ );
            };
        }

        // Track focus entering and leaving containerEl controls
        ctrl.localListen(containerEl, 'focusin', function(e) {
            let id = e.target.getAttribute('data-id');
            ctrl._currentLocalFocusIndex = ctrl._localFocusIDsArray.indexOf(id);
        });
        
        ctrl.localListen(containerEl, 'focusout', function(e) {
            // Only clear the index if focus is moving outside our controls
            let relatedId = e.relatedTarget?.getAttribute('data-id');
            if (!ctrl._localFocusIDsArray.includes(relatedId)) {
                ctrl._currentLocalFocusIndex = -1;
            }
        });
    }
    if(activeID) {
        ctrl._currentLocalFocusIndex = elementIDs.indexOf(activeID);
    }
}

window.uitools.createBoundFocusHandling = createBoundFocusHandling; 