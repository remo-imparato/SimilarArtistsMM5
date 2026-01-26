/**
 * Actions are bits of code that may be executed by a hotkey, menu, toolbar, or other user interaction. 
 * Most actions don't have TSDoc written; check the "Undocumented" checkbox on the right hand side of the page to see all the actions.
 * 
 * You can add actions to the global `actions` object inside your addon's `actions_add.js`.
 * 
 * @packageDocumentation
 */
'use strict';

registerFileImport('actions');

import { calledFromMainWindow, copyItem, getFindMoreFromSameMenu, getFocusedCC, getLayouts, getMainPanelMenu, getSelectedDataSource, getSelectedTracklist, getTracklist, notLocalMediaListSelected, notMediaListSelected, moreTracksSelectedAsync, notMoreTracksSelectedAsync } from './uitools';
import './utils';
import * as _uitools from './uitools';
concatObjects(window.uitools, _uitools);
import MediaSync from './helpers/mediaSync';
import ListView from './controls/listview';


declare global {
    var visualizations: any[]; // todo more specific
    var sendToFileListHandlers: SendToFileListHandler[]; // todo export
}

interface SendToFileListHandler {
    ext: string;
    title: string;
    saveFunc: (selTracks, resfilename, exportSett, progress) => any;
}

window.settings.init(); // moved from mminit.js so that ObservableObject can be a module

let submitCrashLogs = true;

window.visualizations = window.visualizations || [];
window.sendToFileListHandlers = window.sendToFileListHandlers || []; // Note: Added in 5.0.2

const _actionCategories = {
    general: function () {
        return _('General');
    },
    view: function () {
        return _('View');
    },
    tools: function () {
        return _('Tools');
    },
    playback: function () {
        return _('Playback');
    },
    edit: function () {
        return _('Edit');
    },
    export: function () {
        return _('Export');
    },
    window: function () {
        return _('Window');
    },
    classification: function () {
        return _('Classification');
    },
    downloads: function () {
        return _('Downloads');
    },
    artwork: function () {
        return _('Artwork');
    },
    history: function () {
        return _('History');
    },
    nowplaying: function () {
        return _('\'Playing\' list');
    },
    video: function () {
        return _('Adjust video');
    },
    ratingSelected: function () {
        return _('Rating selected file(s)');
    },
    ratingPlaying: function () {
        return _('Rating now playing file');
    }
};
declare global { var actionCategories: typeof _actionCategories; }
window.actionCategories = _actionCategories;

export interface Action {
	/** Title of the action. */
    title?: OptionalResolvable<string>;
	/** Name of the action's category. Categories are defined in the global actionCategories object. Default is general. */
    category?: string|(() => string);
    actionGroup?: string;
    actionType?: string;
	/** Icon that shows in menus that contain the action. The icon ids are located in skin/(iconname).svg. */
    icon?: OptionalResolvable<string>;
	/** Determines whether the action can be tied to a hotkey. Default is false. */
    hotkeyAble?: boolean;
    hotkeyTitle?: OptionalResolvable<string>;
    checkAble?: boolean;
	/**
	 * Determines whether the action will show up in menus. This can be useful for integrating party mode, for example, by disabling your action when party mode is enabled with `visible: uitools.getCanEdit`.
	 */
    visible?: OptionalPromiseResolvable<boolean>;
    disabled?: OptionalPromiseResolvable<boolean>;
    submenu?: OptionalPromiseResolvable<SubmenuItem[] | Action[]>;
    execute?: (...params: any[]) => void;
    getTracklist?: ((...params: any[]) => Tracklist | undefined);
    boundObject?: any;
    checkedHandler?: () => void;
    [key: string]: Action | any; // allow other properties
}

export interface ActionWithSubmenu extends Action {
    submenu: PromiseResolvable<SubmenuItem[] | Action[]>;
}

export interface ActionWithResolvedSubmenu extends Action {
    submenu: SubmenuItem[] | Action[];
}

export interface ExecutableAction extends Action {
    execute: (...params: any[]) => void;
}

export interface TracklistGetter {
    getTracklist: Getter<Tracklist>;
}

export interface SubmenuItem {
    action: Action;
    grouporder: number;
    grouptitle?: string;
    order?: number;
    identifier?: number;
}

/**
 * Items in the main menu with guaranteed submenus
 */
export interface MainMenuItem extends SubmenuItem {
    action: ActionWithResolvedSubmenu;
}

/**
 * After sorting and grouping an array of SubmenuItems, it is compiled into an array of MenuItems
 */
export type MenuItem = Action | {
    separator: boolean;
    title?: string;
};

let miniPlayer: SharedWindow | undefined,
    microPlayer: SharedWindow | undefined,
    limitAlbumTrackRows: boolean;   

declare global { var includeSubfoldersInLocations: boolean | undefined; }


export interface Actions {
    addWeb: ExecutableAction;
    addRadio: ExecutableAction;
    editCollection: ExecutableAction;
    enterLicense: ExecutableAction;
    mood: Action;
    occasion: Action;
    tempo: Action;
    quality: Action;
    myRating: Action;
    rateSelectedUnknown: ExecutableAction;
    rateSelectedHalfStarUp: ExecutableAction;
    rateSelectedHalfStarDown: ExecutableAction;
    rateSelectedStarUp: ExecutableAction;
    rateSelectedStarDown: ExecutableAction;
    rateSelected0: ExecutableAction;
    rateSelected05: ExecutableAction;
    rateSelected1: ExecutableAction;
    rateSelected15: ExecutableAction;
    rateSelected2: ExecutableAction;
    rateSelected25: ExecutableAction;
    rateSelected3: ExecutableAction;
    rateSelected35: ExecutableAction;
    rateSelected4: ExecutableAction;
    rateSelected45: ExecutableAction;
    rateSelected5: ExecutableAction;
    ratePlayingUnknown: ExecutableAction;
    ratePlayingHalfStarUp: ExecutableAction;
    ratePlayingHalfStarDown: ExecutableAction;
    ratePlayingStarUp: ExecutableAction;
    ratePlayingStarDown: ExecutableAction;
    ratePlaying0: ExecutableAction;
    ratePlaying05: ExecutableAction;
    ratePlaying1: ExecutableAction;
    ratePlaying15: ExecutableAction;
    ratePlaying2: ExecutableAction;
    ratePlaying25: ExecutableAction;
    ratePlaying3: ExecutableAction;
    ratePlaying35: ExecutableAction;
    ratePlaying4: ExecutableAction;
    ratePlaying45: ExecutableAction;
    ratePlaying5: ExecutableAction;
    limitAlbumTrackRows: ExecutableAction;
    maximize: ExecutableAction;
    minimize: ExecutableAction;
    restore: ExecutableAction;
    switchToMicroPlayer: ExecutableAction;
    toggleMicroPlayer: ExecutableAction;
    toggleTray: ExecutableAction;
    switchToMiniPlayer: ExecutableAction;
    toggleMiniPlayer: ExecutableAction;
    switchMainMenu: ExecutableAction;
    switchToolbar: ExecutableAction;
    fullScreen: ExecutableAction;
    exitFullscreen: ExecutableAction;
    pauseAllDownloads: ExecutableAction;
    resumeAllDownloads: ExecutableAction;
    cancelAllDownloads: ExecutableAction;
    coverLookup: ExecutableAction;
    coverRemove: ExecutableAction;
    coverSave: ExecutableAction;
    coverShow: ExecutableAction;
    pin: ExecutableAction;
    unpin: ExecutableAction;
    savePlaylistFromNowPlaying: ExecutableAction;
    autoDJ: ExecutableAction;
    playlistRemoveDuplicates: ExecutableAction;
    saveNewOrder: ExecutableAction;
    autoOrganize: ExecutableAction & TracklistGetter;
    synchronizeTags: ExecutableAction;
    cleanID3V1Tags: ExecutableAction;
    cleanID3V2Tags: ExecutableAction;
    cleanID3V1V2Tags: ExecutableAction;
    convertFiles: ExecutableAction & TracklistGetter;
    openURLorFile: ExecutableAction;
    downloadFile: ExecutableAction;
    addPodcastDir: ExecutableAction;
    startupWizard: ExecutableAction;
    scan: ExecutableAction;
    openExplorer: ExecutableAction;
    newFolderNode: ExecutableAction;
    collapseTree: ExecutableAction;
    goToAlbumsNode: ExecutableAction;
    goToArtistsNode: ExecutableAction;
    goToPlaylistsNode: ExecutableAction;
    goToPinnedNode: ExecutableAction;
    findMoreFromSameTitle: ExecutableAction;
    findMoreFromSameAlbum: ExecutableAction;
    findMoreFromSameArtist: ExecutableAction;
    findMoreFromSameAlbumArtist: ExecutableAction;
    findMoreFromSameComposer: ExecutableAction;
    findMoreFromSameConductor: ExecutableAction;
    findMoreFromSameProducer: ExecutableAction;
    findMoreFromSameActor: ExecutableAction;
    findMoreFromSamePublisher: ExecutableAction;
    findMoreFromSameDirector: ExecutableAction;
    findMoreFromSameGenre: ExecutableAction;
    findMoreFromSameYear: ExecutableAction;
    findMoreFromSameDBFolder: ExecutableAction;
    findMoreFromSameCompFolder: ExecutableAction;
    findMoreFromSameExplorerFolder: ExecutableAction;
    locateMissing: ExecutableAction;
    addToLibrary: ExecutableAction;
    downloadToLibrary: ExecutableAction;
    maintainLibrary: ExecutableAction;
    backupDatabase: ExecutableAction;
    restoreDatabase: ExecutableAction;
    clearDatabase: ExecutableAction;
    search: ExecutableAction;
    removePermanent: ExecutableAction;
    remove: ExecutableAction & { disabled: (params) => boolean };
    cut: ExecutableAction;
    copy: ExecutableAction;
    paste: ExecutableAction;
    newAutoPlaylist: ExecutableAction;
    newPlaylist: ExecutableAction;
    closeWindow: ExecutableAction;
    quit: ExecutableAction;
    trackProperties: ExecutableAction & TracklistGetter;
    subscribePodcast: ExecutableAction;
    addNetworkLocation: ExecutableAction;
    addLocation: Action;
    addMediaServer: ExecutableAction;
    configureRemoteAccess: ExecutableAction;
    serverInfo: ExecutableAction;
    removeServer: ExecutableAction;
    updatePodcasts: ExecutableAction;
    updatePodcast: ExecutableAction;
    goToSubscriptions: ExecutableAction;
    updatePodcastImage: ExecutableAction;
    help: ActionWithResolvedSubmenu; // because it's used inside the Help main menu
    loading: Action;
    equalizer: ExecutableAction;
    speed: ExecutableAction;
//    speedUp: ExecutableAction;
//    speedDown: ExecutableAction;
    unitTests: ExecutableAction;
    bgTests: ExecutableAction;
    ripCD: ExecutableAction;
    burnAudioCD: ExecutableAction;
    getCDInfo: ExecutableAction;
    ejectDrive: ExecutableAction;
    options: ExecutableAction;
    optionsLayout: ExecutableAction;
    extensions: ExecutableAction;
    playNow: ExecutableAction;
    playNowShuffled: ExecutableAction;
    playNowShuffledByAlbum: ExecutableAction;
    playMixedShuffled: ExecutableAction;
    playNext: ExecutableAction;
    playNextShuffled: ExecutableAction;
    playNextShuffledByAlbum: ExecutableAction;
    playLast: ExecutableAction;
    playLastShuffled: ExecutableAction;
    playLastShuffledByAlbum: ExecutableAction;
    play: ExecutableAction;
    pause: ExecutableAction;
    playPause: ExecutableAction;
    stop: ExecutableAction;
    stopAfterCurrentOff: ExecutableAction;
    stopAfterCurrentFile: ExecutableAction;
    stopAfterEveryFile: ExecutableAction;
    stopAfterCurrent: Action;
    crossfade: ExecutableAction;
    shuffle: ExecutableAction;
    repeatOff: ExecutableAction;
    repeatOne: ExecutableAction;
    repeatAll: ExecutableAction;
    repeat: Action;
    normalize: ExecutableAction;
    nextFile: ExecutableAction;
    previousFile: ExecutableAction;
    volumeUp: ExecutableAction;
    volumeDown: ExecutableAction;
    rewind: ExecutableAction;
    fastForward: ExecutableAction;
    sleep: ExecutableAction;
    autoTagFromFilename: ExecutableAction & TracklistGetter;
    autoTag: ExecutableAction & TracklistGetter;
    outPluginConfig: ExecutableAction;
    inPluginConfig: ExecutableAction;
    shareMedia: ExecutableAction;
    configureCollections: ExecutableAction;
    setupPlayer: ExecutableAction;
    choosePlayer: Action;
    selectAll: ExecutableAction;
    focusPlayingTrack: ExecutableAction;
    cancelSelection: ExecutableAction;
    newTab: ExecutableAction;
    sendTo: Action;
    findMoreFromSame: Action;
    analyzeVolume: ExecutableAction & TracklistGetter;
    levelTrackVolume: ExecutableAction & TracklistGetter;
    analyzeWaveform: ExecutableAction & TracklistGetter;
    includeSubfolders: ExecutableAction;
    viewFilter: ExecutableAction;
    advancedSearch: ExecutableAction;
    viewSelection: Action;
    view: Action;
    partyMode: ExecutableAction;
    nowplaying: Action;
    history: Action;
    video: Action;
    playShuffled: Action;
    playNormally: Action;
    playShuffledByAlbum: Action;
}

/**
 * Main object containing all actions.
 */
export const actions: Actions = {

    addWeb: {
        title: function () {
            return _('Add bookmark');
        },
        execute: function () {
            uitools.addLink.call(this, 'addWebPage');
        }
    },

    addRadio: {
        title: function () {
            return _('Add bookmark');
        },
        execute: function () {
            uitools.addLink.call(this, 'addRadioPage');
        }
    },

    editCollection: {
        title: function () {
            return _('Edit Collection') + ' ...';
        },
        icon: 'collection',
        execute: function () {
            if (!app.utils.isRegistered()) {
                uitools.showGoldMessage(_('Please upgrade to MediaMonkey Gold for this feature!'));
                return;
            }

            let dataSource = this.boundObject;

            let dlg = uitools.openDialog('dlgCollectionOptions', {
                modal: true,
                item: dataSource
            });
            dlg.onClosed = function () {
                if (dlg.modalResult === 1) {
                    let collID = dataSource.id;

                    dataSource.commitAsync().then(function () {
                        dataSource.notifyChanged();
                        uitools.refreshView();
                        dataSource.getIsVisibleAsync().then(function (visible) {
                            if (!visible) {
                                let state = app.getValue('mediaTreeItems', {
                                    treeNodes: []
                                });
                                for (let i = 0; i < state.treeNodes.length; i++) {
                                    let nodeState = state.treeNodes[i];
                                    if ((nodeState.itemType == 'collection') && (nodeState.id == collID)) {
                                        nodeState.visible = visible;
                                        break;
                                    }
                                }
                                app.setValue('mediaTreeItems', state);

                                app.collections.notifyChange();
                            }
                        });
                    });
                }
            };
            app.listen(dlg, 'closed', dlg.onClosed);
        },
        visible: uitools.getCanEdit
    },

    enterLicense: {
        title: function () {
            return _('Register MediaMonkey Gold license');
        },
        execute: function () {
            let wnd = uitools.openDialog('dlgRegisterGold', {
                modal: true
            });
            wnd.onClosed = function () {
                app.unlisten(wnd, 'closed', wnd.onClosed);
                uitools.refreshGoldStatus();
            };
            app.listen(wnd, 'closed', wnd.onClosed);
        }
    },

    mood: {
        title: function () {
            return _('Mood');
        },
        category: _actionCategories.classification,
        icon: 'mood',
        hotkeyAble: true,
        visible: uitools.getCanEdit,
        disabled: notLocalMediaListSelected,
        submenu: function (params) {
            return new Promise(function (resolve, reject) {
                let list = app.db.getMoodList();
                list.whenLoaded().then(() => {
                    let ar: Action[] = [];
                    fastForEach(list, (item) => {
                        ar.push({
                            title: item.title,
                            icon: 'mood',
                            execute: function () {
                                actions.mood.assignToSelectedTracks((track) => {
                                    track.mood = this.title;
                                });
                            }
                        });
                    });
                    resolve(ar);
                });
            });
        },
        assignToSelectedTracks: function (callback) {
            let tracks = getSelectedTracklist();
            if (!tracks)
                return;
            localPromise(tracks.whenLoaded()).then((tracks: Tracklist) => {
                tracks = tracks.getSelectedList();
                localPromise(tracks.whenLoaded()).then(() => {
                    fastForEach(tracks, (track) => {
                        callback(track);
                    });
                    tracks.commitAsync();
                });
            });
        }
    },

    occasion: {
        title: function () {
            return _('Occasion');
        },
        category: _actionCategories.classification,
        icon: 'occasion',
        hotkeyAble: true,
        visible: uitools.getCanEdit,
        disabled: notLocalMediaListSelected,
        submenu: function (params) {
            return new Promise(function (resolve, reject) {
                let list = app.db.getOccasionList();
                list.whenLoaded().then(() => {
                    let ar: Action[] = [];
                    fastForEach(list, (item) => {
                        ar.push({
                            title: item.title,
                            icon: 'occasion',
                            execute: function () {
                                actions.mood.assignToSelectedTracks((track) => {
                                    track.occasion = this.title;
                                });
                            }
                        });
                    });
                    resolve(ar);
                });
            });
        },
        getTracklist: getSelectedTracklist
    },

    tempo: {
        title: function () {
            return _('Tempo');
        },
        category: _actionCategories.classification,
        icon: 'tempo',
        hotkeyAble: true,
        visible: uitools.getCanEdit,
        disabled: notLocalMediaListSelected,
        submenu: function (params) {
            return new Promise(function (resolve, reject) {
                let list = app.db.getTempoList();
                list.whenLoaded().then(() => {
                    let ar: Action[] = [];
                    fastForEach(list, (item) => {
                        ar.push({
                            title: item.title,
                            icon: 'tempo',
                            execute: function () {
                                actions.mood.assignToSelectedTracks((track) => {
                                    track.tempo = this.title;
                                });
                            }
                        });
                    });
                    resolve(ar);
                });
            });
        },
        getTracklist: getSelectedTracklist
    },

    quality: {
        title: function () {
            return _('Quality');
        },
        category: _actionCategories.classification,
        icon: 'quality',
        hotkeyAble: true,
        visible: uitools.getCanEdit,
        disabled: notLocalMediaListSelected,
        submenu: function (params) {
            return new Promise(function (resolve, reject) {
                let list = app.db.getQualityList();
                list.whenLoaded().then(() => {
                    let ar: Action[] = [];
                    fastForEach(list, (item) => {
                        ar.push({
                            title: item.title,
                            icon: 'quality',
                            execute: function () {
                                actions.mood.assignToSelectedTracks((track) => {
                                    track.quality = this.title;
                                });
                            }
                        });
                    });
                    resolve(ar);
                });
            });
        },
        getTracklist: getSelectedTracklist
    },

    myRating: {
        title: function () {
            return _('My Rating');
        },
        category: _actionCategories.classification,
        icon: 'star',
        hotkeyAble: true,
        visible: uitools.getCanEdit,
        disabled: notMediaListSelected,
        submenu: function (params) {
            if (!params.parentMenuAction)
                params.parentMenuAction = actions.myRating;
            let _this = params.parentMenuAction;
            if (!_this._myRatingSubmenu) {
                _this._myRatingSubmenu = uitools.createRatingSubmenu(params);
            }
            return _this._myRatingSubmenu;
        },
        getTracklist: getSelectedTracklist
    },

    rateSelectedUnknown: {
        title: function () {
            return _('Rate unknown');
        },
        category: _actionCategories.ratingSelected,
        hotkeyAble: true,
        execute: function () {
            uitools.rateTracks(getSelectedTracklist(), -1);
        },
        visible: uitools.getCanEdit,
    },

    rateSelectedHalfStarUp: {
        title: function () {
            return _('Rate 0.5 Star Up');
        },
        category: _actionCategories.ratingSelected,
        hotkeyAble: true,
        execute: function () {
            uitools.rateTracksDelta(getSelectedTracklist(), +10);
        },
        visible: uitools.getCanEdit,
    },

    rateSelectedHalfStarDown: {
        title: function () {
            return _('Rate 0.5 Star Down');
        },
        category: _actionCategories.ratingSelected,
        hotkeyAble: true,
        execute: function () {
            uitools.rateTracksDelta(getSelectedTracklist(), -10);
        },
        visible: uitools.getCanEdit,
    },

    rateSelectedStarUp: {
        title: function () {
            return _('Rate 1 Star Up');
        },
        category: _actionCategories.ratingSelected,
        hotkeyAble: true,
        execute: function () {
            uitools.rateTracksDelta(getSelectedTracklist(), +20);
        },
        visible: uitools.getCanEdit,
    },

    rateSelectedStarDown: {
        title: function () {
            return _('Rate 1 Star Down');
        },
        category: _actionCategories.ratingSelected,
        hotkeyAble: true,
        execute: function () {
            uitools.rateTracksDelta(getSelectedTracklist(), -20);
        },
        visible: uitools.getCanEdit,
    },

    rateSelected0: {
        title: function () {
            return _('Rate 0 Stars');
        },
        category: _actionCategories.ratingSelected,
        hotkeyAble: true,
        execute: function () {
            uitools.rateTracks(getSelectedTracklist(), 0);
        },
        visible: uitools.getCanEdit,
    },

    rateSelected05: {
        title: function () {
            return _('Rate 0.5 Stars');
        },
        category: _actionCategories.ratingSelected,
        hotkeyAble: true,
        execute: function () {
            uitools.rateTracks(getSelectedTracklist(), 10);
        },
        visible: uitools.getCanEdit,
    },

    rateSelected1: {
        title: function () {
            return _('Rate 1 Stars');
        },
        category: _actionCategories.ratingSelected,
        hotkeyAble: true,
        execute: function () {
            uitools.rateTracks(getSelectedTracklist(), 20);
        },
        visible: uitools.getCanEdit,
    },

    rateSelected15: {
        title: function () {
            return _('Rate 1.5 Stars');
        },
        category: _actionCategories.ratingSelected,
        hotkeyAble: true,
        execute: function () {
            uitools.rateTracks(getSelectedTracklist(), 30);
        },
        visible: uitools.getCanEdit,
    },

    rateSelected2: {
        title: function () {
            return _('Rate 2 Stars');
        },
        category: _actionCategories.ratingSelected,
        hotkeyAble: true,
        execute: function () {
            uitools.rateTracks(getSelectedTracklist(), 40);
        },
        visible: uitools.getCanEdit,
    },

    rateSelected25: {
        title: function () {
            return _('Rate 2.5 Stars');
        },
        category: _actionCategories.ratingSelected,
        hotkeyAble: true,
        execute: function () {
            uitools.rateTracks(getSelectedTracklist(), 50);
        },
        visible: uitools.getCanEdit,
    },

    rateSelected3: {
        title: function () {
            return _('Rate 3 Stars');
        },
        category: _actionCategories.ratingSelected,
        hotkeyAble: true,
        execute: function () {
            uitools.rateTracks(getSelectedTracklist(), 60);
        },
        visible: uitools.getCanEdit,
    },

    rateSelected35: {
        title: function () {
            return _('Rate 3.5 Stars');
        },
        category: _actionCategories.ratingSelected,
        hotkeyAble: true,
        execute: function () {
            uitools.rateTracks(getSelectedTracklist(), 70);
        },
        visible: uitools.getCanEdit,
    },

    rateSelected4: {
        title: function () {
            return _('Rate 4 Stars');
        },
        category: _actionCategories.ratingSelected,
        hotkeyAble: true,
        execute: function () {
            uitools.rateTracks(getSelectedTracklist(), 80);
        },
        visible: uitools.getCanEdit,
    },


    rateSelected45: {
        title: function () {
            return _('Rate 4.5 Stars');
        },
        category: _actionCategories.ratingSelected,
        hotkeyAble: true,
        execute: function () {
            uitools.rateTracks(getSelectedTracklist(), 90);
        },
        visible: uitools.getCanEdit,
    },

    rateSelected5: {
        title: function () {
            return _('Rate 5 Stars');
        },
        category: _actionCategories.ratingSelected,
        hotkeyAble: true,
        execute: function () {
            uitools.rateTracks(getSelectedTracklist(), 100);
        },
        visible: uitools.getCanEdit,
    },

    ratePlayingUnknown: {
        title: function () {
            return _('Rate unknown');
        },
        category: _actionCategories.ratingPlaying,
        hotkeyAble: true,
        execute: function () {
            uitools.ratePlaying(-1);
        },
        visible: uitools.getCanEdit,
    },

    ratePlayingHalfStarUp: {
        title: function () {
            return _('Rate 0.5 Star Up');
        },
        category: _actionCategories.ratingPlaying,
        hotkeyAble: true,
        execute: function () {
            uitools.ratePlayingDelta(+10);
        },
        visible: uitools.getCanEdit,
    },

    ratePlayingHalfStarDown: {
        title: function () {
            return _('Rate 0.5 Star Down');
        },
        category: _actionCategories.ratingPlaying,
        hotkeyAble: true,
        execute: function () {
            uitools.ratePlayingDelta(-10);
        },
        visible: uitools.getCanEdit,
    },

    ratePlayingStarUp: {
        title: function () {
            return _('Rate 1 Star Up');
        },
        category: _actionCategories.ratingPlaying,
        hotkeyAble: true,
        execute: function () {
            uitools.ratePlayingDelta(+20);
        },
        visible: uitools.getCanEdit,
    },

    ratePlayingStarDown: {
        title: function () {
            return _('Rate 1 Star Down');
        },
        category: _actionCategories.ratingPlaying,
        hotkeyAble: true,
        execute: function () {
            uitools.ratePlayingDelta(-20);
        },
        visible: uitools.getCanEdit,
    },

    ratePlaying0: {
        title: function () {
            return _('Rate 0 Stars');
        },
        category: _actionCategories.ratingPlaying,
        hotkeyAble: true,
        execute: function () {
            uitools.ratePlaying(0);
        },
        visible: uitools.getCanEdit,
    },

    ratePlaying05: {
        title: function () {
            return _('Rate 0.5 Stars');
        },
        category: _actionCategories.ratingPlaying,
        hotkeyAble: true,
        execute: function () {
            uitools.ratePlaying(10);
        },
        visible: uitools.getCanEdit,
    },

    ratePlaying1: {
        title: function () {
            return _('Rate 1 Stars');
        },
        category: _actionCategories.ratingPlaying,
        hotkeyAble: true,
        execute: function () {
            uitools.ratePlaying(20);
        },
        visible: uitools.getCanEdit,
    },

    ratePlaying15: {
        title: function () {
            return _('Rate 1.5 Stars');
        },
        category: _actionCategories.ratingPlaying,
        hotkeyAble: true,
        execute: function () {
            uitools.ratePlaying(30);
        },
        visible: uitools.getCanEdit,
    },

    ratePlaying2: {
        title: function () {
            return _('Rate 2 Stars');
        },
        category: _actionCategories.ratingPlaying,
        hotkeyAble: true,
        execute: function () {
            uitools.ratePlaying(40);
        },
        visible: uitools.getCanEdit,
    },

    ratePlaying25: {
        title: function () {
            return _('Rate 2.5 Stars');
        },
        category: _actionCategories.ratingPlaying,
        hotkeyAble: true,
        execute: function () {
            uitools.ratePlaying(50);
        },
        visible: uitools.getCanEdit,
    },

    ratePlaying3: {
        title: function () {
            return _('Rate 3 Stars');
        },
        category: _actionCategories.ratingPlaying,
        hotkeyAble: true,
        execute: function () {
            uitools.ratePlaying(60);
        },
        visible: uitools.getCanEdit,
    },

    ratePlaying35: {
        title: function () {
            return _('Rate 3.5 Stars');
        },
        category: _actionCategories.ratingPlaying,
        hotkeyAble: true,
        execute: function () {
            uitools.ratePlaying(70);
        },
        visible: uitools.getCanEdit,
    },

    ratePlaying4: {
        title: function () {
            return _('Rate 4 Stars');
        },
        category: _actionCategories.ratingPlaying,
        hotkeyAble: true,
        execute: function () {
            uitools.ratePlaying(80);
        },
        visible: uitools.getCanEdit,
    },


    ratePlaying45: {
        title: function () {
            return _('Rate 4.5 Stars');
        },
        category: _actionCategories.ratingPlaying,
        hotkeyAble: true,
        execute: function () {
            uitools.ratePlaying(90);
        },
        visible: uitools.getCanEdit,
    },

    ratePlaying5: {
        title: function () {
            return _('Rate 5 Stars');
        },
        category: _actionCategories.ratingPlaying,
        hotkeyAble: true,
        execute: function () {
            uitools.ratePlaying(100);
        },
        visible: uitools.getCanEdit,
    },

    limitAlbumTrackRows: {
        title: function () {
            return limitAlbumTrackRows ? _('Show all album tracks') : _('Collapse albums');
        },
        icon: function () {
            return limitAlbumTrackRows ? 'expand' : 'collapse';
        },
        hotkeyAble: true,
        category: _actionCategories.view,
        actionGroup: 'view',
        execute: function () {
            if (limitAlbumTrackRows === undefined)
                limitAlbumTrackRows = false;
            limitAlbumTrackRows = !limitAlbumTrackRows;

            if (actions.limitAlbumTrackRows.checkedHandler) {
                actions.limitAlbumTrackRows.checkedHandler();
            }

            app.setValue('limitAlbumTrackRows', limitAlbumTrackRows);
            setAllCollapsed(limitAlbumTrackRows);
        },
        afterExecute: function (toolbarClass, btn) {
            if (toolbarClass)
                toolbarClass.updateActionButton(btn, this);
        },
        checked: function () {
            return limitAlbumTrackRows;
        },
    },

    maximize: {
        title: function () {
            return _('Maximize');
        },
        icon: 'maximize',
        disabled: function () {
            return thisWindow.maximized;
        },
        execute: function () {
            thisWindow.maximize();
        },
    },

    minimize: {
        title: function () {
            return _('Minimize');
        },
        icon: 'minimize',
        disabled: function () {
            return thisWindow.minimized;
        },
        execute: function () {
            thisWindow.minimize();
        },
    },

    restore: {
        title: function () {
            return _('Restore');
        },
        icon: 'restore',
        disabled: function () {
            return !thisWindow.maximized && !thisWindow.minimized;
        },
        execute: function () {
            thisWindow.restore();
        },
    },

    switchToMicroPlayer: {
        visible: function () {
            return !app.utils.getPortableMode();
        },
        title: function () {
            return _('Minimize to MicroPlayer');
        },
        execute: function () {

            if (app.utils.getPortableMode()) {
                actions.switchToMiniPlayer.execute();
                return;
            }
            if (!microPlayer) {
                microPlayer = uitools.openDialog('microPlayer', {
                    modal: false,
                    show: false,
                    atTopMost: true,
                    flat: true,
                    bordered: false,
                    playerType: 1, // micro player
                    offscreen: false,
                    transparent: true,
                    shape: 'noshape',
                    notShared: true,
                    left: 0,
                    top: 0,
                    width: 20,
                    height: 20,
                });
                microPlayer.onLoad = function () {
                    app.unlisten(microPlayer, 'load');
                    uitools.beforePlayerSwitch(1);
                    app.switchToMicroPlayer();
                };
                microPlayer.onClosed = function () {
                    assert(microPlayer, 'microPlayer closed event fired twice!');
                    app.unlisten(microPlayer, 'closed', microPlayer.onClosed);
                    microPlayer = undefined;
                };
                app.listen(microPlayer, 'load', microPlayer.onLoad);
                app.listen(microPlayer, 'closed', microPlayer.onClosed);
            } else {
                if (microPlayer.windowIsLoaded) {
                    uitools.beforePlayerSwitch(1);
                    app.switchToMicroPlayer();
                }
            }
        }
    },

    toggleMicroPlayer: {
        title: function () {
            return _('Toggle') + ' (' + _('MicroPlayer') + '/' + _('Full window') + ')';
        },
        icon: 'restore',
        hotkeyAble: true,
        category: _actionCategories.window,
        execute: function () {
            if (window.isMainWindow && (app.getCurrentPlayer() == 0)) {
                actions.switchToMicroPlayer.execute();
            } else {
                uitools.beforePlayerSwitch(0);
                app.switchToMainPlayer();
            }
        }
    },

    toggleTray: {
        title: function () {
            return _('Toggle') + ' (' + _('Close to tray') + '/' + _('Full window') + ')';
        },
        icon: 'restore',
        hotkeyAble: true,
        category: _actionCategories.window,
        execute: function () {
            app.trayIcon.toggleTray();
        }
    },

    switchToMiniPlayer: {
        title: function () {
            return _('Minimize to MiniPlayer');
        },
        execute: function () {

            if (!miniPlayer) {
                miniPlayer = uitools.openDialog('miniPlayer', {
                    modal: false,
                    show: false,
                    atTopMost: true,
                    flat: true,
                    bordered: false,
                    playerType: 2, // mini player
                    shape: 'miniPlayerShape',
                    width: 200,
                    height: 200,
                    moveable: true,
                    notShared: true
                });
                miniPlayer.onLoad = function () {
                    app.unlisten(miniPlayer, 'load');
                    uitools.beforePlayerSwitch(2);
                    app.switchToMiniPlayer();
                };
                app.listen(miniPlayer, 'load', miniPlayer.onLoad);
            } else {
                if (miniPlayer.windowIsLoaded) {
                    uitools.beforePlayerSwitch(2);
                    app.switchToMiniPlayer();
                }
            }
        }
    },

    toggleMiniPlayer: {
        title: function () {
            return _('Toggle') + ' (' + _('MiniPlayer') + '/' + _('Full window') + ')';
        },
        icon: 'restore',
        hotkeyAble: true,
        category: _actionCategories.window,
        execute: function () {
            if (window.isMainWindow && (app.getCurrentPlayer() == 0)) {
                actions.switchToMiniPlayer.execute();
            } else {
                uitools.beforePlayerSwitch(2);
                app.switchToMainPlayer();
            }
        }
    },

    switchMainMenu: {
        title: function () {
            return _('Menu bar');
        },
        checkable: true,
        visible: builtInMenu,
        checked: function () {
            return app.getValue('mainMenuAlwaysVisible', true);
        },
        execute: function () {
            let newVal = !app.getValue('mainMenuAlwaysVisible', true);
            uitools.switchMainMenu(newVal);
            app.setValue('mainMenuAlwaysVisible', newVal);
        }
    },

    switchToolbar: {
        title: function () {
            return _('Toolbar');
        },
        checkable: true,
        visible: builtInMenu,
        checked: function () {
            return app.getValue('toolbarVisible', false) && (app.getValue('toolbarItems', []).length > 0);
        },
        execute: function () {
            let items = app.getValue('toolbarItems', []);
            if (items.length == 0) {
                // show Options > Toolbar
                uitools.showOptions('pnl_LayoutToolbar');
                app.setValue('toolbarVisible', true);
            } else {
                // switch visibility
                let newVal = !app.getValue('toolbarVisible', false);
                let toolbar = qid('customtoolbuttons');
                if (toolbar)
                    setVisibility(toolbar, newVal);
                app.setValue('toolbarVisible', newVal);
            }
        },
        hotlinkIcon: 'options',
        hotlinkExecute: function () {
            uitools.showOptions('pnl_LayoutToolbar');
        }
    },

    fullScreen: {
        title: function () {
            return _('Full screen');
        },
        icon: 'mode_fullscreen',
        hotkeyAble: true,
        category: _actionCategories.video,
        execute: function () {
            uitools.getPlayerUtils().enterOrExitFullScreen();
        }
    },

    exitFullscreen: {
        title: function () {
            return _('Exit fullscreen');
        },
        icon: 'mode_windowed',
        hotkeyAble: true,
        category: _actionCategories.playback,
        execute: function () {
            if (window.globalVideoSwitcher && window.globalVideoSwitcher.controlClass) {
                let swC = window.globalVideoSwitcher.controlClass as AnyDict;
                if (swC.currentMode === window.videoModes.C_FULLSCREEN) {
                    if (!swC.toPreviousMode()) {
                        swC.switchToMode(window.videoModes.C_WINDOWED);
                    }
                    return;
                }
            }
        }
    },

    pauseAllDownloads: {
        title: function () {
            return _('Pause all');
        },
        icon: 'pause',
        hotkeyAble: true,
        category: _actionCategories.downloads,
        visible: uitools.getCanEdit,
        execute: function () {
            app.downloader.pauseAllDownloads();
        }
    },

    resumeAllDownloads: {
        title: function () {
            return _('Resume all');
        },
        icon: 'play',
        hotkeyAble: true,
        category: _actionCategories.downloads,
        visible: uitools.getCanEdit,
        execute: function () {
            app.downloader.resumeAllDownloads();
        }
    },

    cancelAllDownloads: {
        title: function () {
            return _('Cancel all');
        },
        icon: 'cancel',
        hotkeyAble: true,
        category: _actionCategories.downloads,
        visible: uitools.getCanEdit,
        execute: function () {
            app.downloader.cancelAllDownloads();
        }
    },

    coverLookup: {
        title: function () {
            return _('Lookup image') + '...';
        },
        icon: 'search_image',
        hotkeyAble: false,
        category: _actionCategories.artwork,
        disabled: function () {
            if (!uitools.getCanEdit())
                return true;
            else {
                let FC = window.lastFocusedControl; // @ts-ignore
                if (FC && FC.controlClass && FC.controlClass.readOnly)
                    return true;

                return false;
            }
        },
        visible: uitools.getCanEdit,
        execute: function () {
            uitools.coverLookup();
        }
    },

    coverRemove: {
        title: function () {
            return _('Remove');
        },
        icon: 'delete',
        hotkeyAble: false,
        category: _actionCategories.artwork,
        disabled: function () {
            if (!uitools.getCanEdit())
                return true;
            let FC = window.lastFocusedControl; // @ts-ignore
            if (FC && FC.controlClass && !FC.controlClass.readOnly && FC.controlClass.dataSource && FC.controlClass.addArtworkRules) {
                return false;
            }
            return true;
        },
        visible: uitools.getCanEdit,
        execute: function () {
            uitools.coverRemove();
        }
    },

    coverSave: {
        title: function () {
            return _('Save image as') + '...';
        },
        icon: 'save',
        hotkeyAble: false,
        category: _actionCategories.artwork,
        disabled: function () {
            let FC = window.lastFocusedControl;
            if (FC && FC.controlClass && FC.controlClass.dataSource && FC.controlClass.addArtworkRules) {
                return (FC.controlClass.dataSource.focusedIndex < 0);
            }
            return true;
        },
        visible: uitools.getCanEdit,
        execute: function () {
            uitools.coverSave();
        }
    },

    coverShow: {
        title: function () {
            return _('Show image');
        },
        icon: 'view',
        hotkeyAble: false,
        category: _actionCategories.artwork,
        disabled: function () {
            let FC = window.lastFocusedControl;
            if (FC && FC.controlClass && FC.controlClass.dataSource && FC.controlClass.addArtworkRules) {
                return (FC.controlClass.dataSource.focusedIndex < 0);
            }
            return true;
        },
        execute: function () {
            uitools.coverShow();
        }
    },

    pin: {
        title: function () {
            return _('Pin it');
        },
        icon: 'pin',
        hotkeyAble: true,
        visible: function () {
            if (!uitools.getCanEdit() || window.settings.UI.hidePinCommands)
                return false;
            if (this.boundObject)
                return uitools.isPinnedAsync(resolveToValue(this.boundObject), false);
            return isFocusedPinnedAsync(0);
        },
        execute: function () {
            if (this.boundObject)
                uitools.pinItem(resolveToValue(this.boundObject), true);
            else
                pinFocused(true);
            this.boundObject = undefined;
        }
    },

    unpin: {
        title: function () {
            return _('Unpin it');
        },
        icon: 'pin',
        hotkeyAble: true,
        visible: function () {
            if (!uitools.getCanEdit() || window.settings.UI.hidePinCommands)
                return false;
            if (this.boundObject)
                return uitools.isPinnedAsync(resolveToValue(this.boundObject), true);
            return isFocusedPinnedAsync(1);
        },
        execute: function () {
            if (this.boundObject)
                uitools.pinItem(resolveToValue(this.boundObject), false);
            else
                pinFocused(false);
            this.boundObject = undefined;
        }
    },

    savePlaylistFromNowPlaying: {
        title: function () {
            return _('Save playlist') + '...';
        },
        icon: 'playlist',
        hotkeyAble: false,
        visible: function () {
            if (!uitools.getCanEdit())
                return false;
            return !!app.player.entriesCount;
        },
        execute: function () {
            let dlg = uitools.openDialog('dlgSelectPlaylist', {
                modal: true,
                showNewPlaylist: true
            });
            dlg.onClosed = function () {
                if (dlg.modalResult == 1) {
                    let playlist = dlg.getValue('getPlaylist')();
                    if (playlist) {
                        if (playlist.isNew) {
                            let newplaylist = playlist;
                            newplaylist.name = '- ' + _('New playlist') + ' -'; // #16261 - to be the first in the list after creation
                            newplaylist.commitAsync().then(function () {
                                newplaylist.isNew = true;
                                //navigationHandlers['playlist'].navigate(newplaylist); // navigation is intentionally disabled, so that user can D&D tracks from the current view to the new playlist (#12355)
                                uitools.showPlaylistEditor(newplaylist, true, 'saveFromPlaying');
                                app.player.getSongList().getTracklist().whenLoaded().then(function (list) {
                                    newplaylist.addTracksAsync(list);
                                });
                            });

                        } else {
                            app.player.getSongList().getTracklist().whenLoaded().then(function (list) {
                                playlist.clearTracksAsync().then(() => {
                                    playlist.addTracksAsync(list);
                                });
                            });
                        }
                    }
                }
            }.bind(this);
            app.listen(dlg, 'closed', dlg.onClosed);
        }
    },

    autoDJ: {
        title: function () {
            return _('Auto-DJ');
        },
        checkable: true,
        checked: function () {
            return app.player.autoDJ.enabled;
        },
        execute: function () {
            app.player.autoDJ.enabled = !app.player.autoDJ.enabled;
            app.settings.notifyChange();
        },
        hotlinkIcon: 'options',
        hotlinkExecute: function () {
            uitools.showOptions('pnl_AutoDJ');
        },
        visible: uitools.getCanEdit
    },

    playlistRemoveDuplicates: {
        title: function () {
            return _('Remove duplicates');
        },
        icon: 'remove',
        visible: function () {
            if (!uitools.getCanEdit())
                return false;
            else {
                let pl = resolveToValue(this.boundObject);
                return (pl.parent != undefined && !pl.isAutoPlaylist); // to exclude root playlists node and auto-playlists
            }
        },
        execute: function () {
            let pl: Playlist = resolveToValue(this.boundObject);
            let list = pl.getTracklist();
            list.whenLoaded().then(() => {
                list.modifyAsync(() => {
                    let hasher = {};
                    listForEach(list, (track, idx) => {
                        if (hasher[track.id])
                            list.setSelected(idx, true); // duplicate
                        hasher[track.id] = true;
                    });
                    pl.removeSelectedTracksAsync(list);
                });
            });
        }
    },

    saveNewOrder: {
        title: function () {
            return _('Save new order');
        },
        icon: 'save',
        hotkeyAble: true,
        visible: function () {
            if (!uitools.getCanEdit())
                return false;
            else {
                let l = resolveToValue(this.boundObject);
                if(!l)
                    return (window.currentTabControl && (window.currentTabControl._saveOrderButton != undefined));
                else {
                    return (isFunction(l.isUnsavedSort) && l.isUnsavedSort());
                }
            }
        },
        execute: function () {
            let l = resolveToValue(this.boundObject);
            if(l) {
                if(l.dataSource) {
                    l.dataSource.reorderAsync(l.dataSource).then(() => {
                        l.doRefresh();
                    });
                }
            } else {
                if (window.currentTabControl._saveOrderButton)
                    window.currentTabControl._saveOrderButton.click();
            }
        }
    },

    autoOrganize: {
        title: function () {
            return _('Organi&ze files') + '...';
        },
        icon: 'organize',
        hotkeyAble: true,
        category: _actionCategories.tools,
        disabled: notLocalMediaListSelected, // Can be either a boolean or a function returning a boolean or Promise resolving to boolean
        execute: function () {
            let selTracks = this.getTracklist();
            if (selTracks) {
                // whenLoaded promise is awaited directly in the dialog
                uitools.openDialog('dlgautoorganize', {
                    modal: true,
                    tracks: selTracks,
                    storeState: true
                });
            }
        },
        visible: function () {
            return calledFromMainWindow() && uitools.getCanEdit();
        },
        getTracklist: getSelectedTracklist
    },

    synchronizeTags: {
        title: function () {
            return _('Update tags') + '...';
        },
        category: _actionCategories.tools,
        icon: 'synchronize',
        hotkeyAble: true,
        execute: function () {
            advTagOperation('synchronize', this);
        },
        disabled: notLocalMediaListSelected,
        visible: uitools.getCanEdit,
        getTracklist: getSelectedTracklist
    },

    cleanID3V1Tags: {
        title: function () {
            return _('Clean ID3v&1 tags') + '...';
        },
        icon: 'tag',
        category: _actionCategories.tools,
        hotkeyAble: true,
        execute: function () {
            advTagOperation('ID3v1', this);
        },
        disabled: notLocalMediaListSelected,
        visible: uitools.getCanEdit,
        getTracklist: getSelectedTracklist
    },

    cleanID3V2Tags: {
        title: function () {
            return _('Clean ID3v&2 tags') + '...';
        },
        icon: 'tag',
        category: _actionCategories.tools,
        hotkeyAble: true,
        execute: function () {
            advTagOperation('ID3v2', this);
        },
        disabled: notLocalMediaListSelected,
        visible: uitools.getCanEdit,
        getTracklist: getSelectedTracklist
    },

    cleanID3V1V2Tags: {
        title: function () {
            return _('&Clean ID3v1 and v2 tags') + '...';
        },
        icon: 'tag',
        category: _actionCategories.tools,
        hotkeyAble: true,
        execute: function () {
            advTagOperation('ID3v1 and v2', this);
        },
        disabled: notLocalMediaListSelected,
        visible: uitools.getCanEdit,
        getTracklist: getSelectedTracklist
    },

    convertFiles: {
        title: function () {
            return _('Con&vert format') + '...';
        },
        category: _actionCategories.tools,
        icon: 'convert',
        hotkeyAble: true,
        execute: function () {
            let selTracks = this.getTracklist();
            if (selTracks) {
                uitools.openDialog('dlgconvertformat', {
                    modal: true,
                    tracks: selTracks,
                    storeState: true
                });
            }
        },
        disabled: notLocalMediaListSelected, // Can be either a boolean or a function returning a boolean or Promise resolving to boolean
        visible: function () {
            return calledFromMainWindow() && uitools.getCanEdit() && (app.utils.system() !== 'macos');
        },
        getTracklist: getSelectedTracklist
    },

    openURLorFile: {
        title: function () {
            return _('&Open URL or File') + '...';
        },
        icon: 'openFile',
        hotkeyAble: true,
        execute: function () {
            uitools.openDialog('dlgSelectFiles', {
                modal: true,
                title: uitools.getPureTitle(_('&Open URL or File')),
                description: _('Enter the URL or path to a multimedia file on the internet, your computer, or your network:'),
                helpContext: 'Player#Open_Files',
                showBrowseButton: true
            }, function (dlg) {
                if (dlg.modalResult === 1) {
                    let paths = dlg.getValue('getPaths')();
                    if (paths.count > 0) {
                        app.player.addTracksAsync(paths, {
                            withClear: true,
                            startPlayback: true
                        });
                    }
                }
            });
        },
        visible: () => {
            return !webApp && uitools.getCanEdit();
        },
    },

    downloadFile: {
        title: function () {
            return _('&Download file') + '...';
        },
        icon: 'download',
        hotkeyAble: true,
        execute: function () {
            uitools.openDialog('dlgSelectFiles', {
                modal: true,
                title: _('Enter URL'),
                description: _('Enter a link to a file you want to download:'),
                showBrowseButton: false
            }, function (dlg) {
                if (dlg.modalResult === 1) {
                    let path = dlg.getValue('getPath')();
                    if (path != '') {
                        let track = app.utils.createEmptyTrack();
                        track.path = path;
                        app.trackOperation.downloadFile(track); // inits download of this track (adds to download queue)                            
                    }
                }
            });
        },
        visible: () => {
            return !webApp && uitools.getCanEdit();
        },
    },

    addPodcastDir: {
        title: function () {
            return _('Add directory') + '...';
        },
        icon: 'add',
        hotkeyAble: true,
        execute: function () {
            uitools.openDialog('dlgSelectFiles', {
                modal: true,
                title: _('Add directory'),
                description: _('Enter a link to a podcast OPML directory, to include in the list:'),
                showBrowseButton: true
            }, function (dlg) {
                if (dlg.modalResult === 1) {
                    let paths = dlg.getValue('getPaths')();
                    if (paths.count > 0) {
                        paths.locked(function () {
                            let path = paths.getValue(0);
                            app.podcasts.addDirectory(path);
                        });
                    }
                }
            });
        },
        visible: () => {
            return !webApp && uitools.getCanEdit();
        }
    },

    startupWizard: {
        hotkeyAble: false,
        execute: function () {
            let dataClass = {
                modal: true,
                notShared: true
            };
            uitools.openDialog('dlgWizard', dataClass, function (dlg) {
                if (dlg.modalResult == 1) {

                    let shareEnabled = dlg.getValue('getMediaShareEnabled')();
                    let addFirewallException = dlg.getValue('getAddFirewallException')();
                    if (!addFirewallException) {
                        let sett = window.settings.get('MediaSharing');
                        sett.MediaSharing.AddFirewallException = false;
                        window.settings.set(sett, 'MediaSharing');
                    }
                    let serverList = app.sharing.getServers();
                    serverList.whenLoaded().then(function () {
                        serverList.locked(function () {
                            let server = serverList.getValue(0);
                            server.enabled = shareEnabled;
                            server.commitAsync().then(() => {
                                uitools.startSharing();
                            });
                        });
                    });

                    let paths = dlg.getValue('getPaths')();
                    let containers = dlg.getValue('getServerContainers')();
                    let importers = dlg.getValue('getImporters')();
                    let lookup = dlg.getValue('doLookup')();
                    app.filesystem.setLastScannedFolders(paths);
                    if (paths.count) {
                        uitools.runScan(paths, importers, containers, lookup);
                    }

                    uitools.refreshGoldStatus();
                } else {
                    uitools.startSharing();
                }
            });
        }
    },

    scan: {
        title: function () {
            return _('&Add/Rescan files to the Library') + '...';
        },
        icon: 'scan',
        hotkeyAble: true,
        execute: function () {
            navUtils.getFocusedFolder().then(async function (initPath) {
                
                let c = window.lastFocusedControl;
                if (c && c.controlClass && c.controlClass.dataSource && c.controlClass.dataSource.itemObjectType == 'playlistentry')
                    initPath = undefined; // #21285 -- item c)                

                if (!initPath) {
                    // .. try to find initPath from the selected content, #19080 / #21285 / #21299
                    const list = uitools.getSelectedTracklist();
                    if (list) {
                        await list.whenLoaded();
                        if (list.count > 0) { // #21299
                            list.locked(function () {                                                                                               
                                let track = getValueAtIndex(list, 0);                                
                                let path = getFileFolder(track.path);
                                if (isLocalPath(path) || isNetworkPath(path)) {
                                    initPath = path;
                                }                                
                            });
                        }
                    }
                } else {
                    let node = navUtils.getFocusedNode();
                    if (node && node.dataSource && node.dataSource.getType && node.dataSource.getType() == 'networkResource') 
                        initPath = undefined; // #21447                    
                }

                uitools.openDialog('dlgScanTracks', {
                    modal: true,
                    initFolder: initPath
                }, function (dlg) {
                    if (dlg.modalResult == 1) {
                        let paths = dlg.getValue('getPaths')();
                        let containers = dlg.getValue('getServerContainers')();
                        let importers = dlg.getValue('getImporters')();
                        let lookup = dlg.getValue('doLookup')();
                        uitools.runScan(paths, importers, containers, lookup);
                    }
                });
            });
        },
        visible: uitools.getCanEdit
    },

    openExplorer: {
        title: function () {
            return _('Open in Explorer') + '...';
        },
        icon: 'openFile',
        execute: function () {
            navUtils.getFocusedFolder().then(function (initPath) {
                let dummyTrack = app.utils.createEmptyTrack();
                dummyTrack.dontNotify = true;
                dummyTrack.path = initPath;
                navigationHandlers['explorerFolder'].navigate(dummyTrack);
            });
        }
    },

    newFolderNode: {
        title: _('New folder') + '...',
        icon: 'folder',
        visible: function () {
            let node = resolveToValue(this.boundObject);
            return node.dataSource && !node.dataSource.isPlaylist;
        },
        execute: function () {
            let node = resolveToValue(this.boundObject);
            let dlg = uitools.openDialog('dlgInputText', {
                modal: true,
                title: _('New folder'),
                description: _('New folder name'),
                type: 'text'
            });
            dlg.onClosed = function () {
                if (dlg.modalResult === 1) {
                    let value = dlg.getValue('getTextInput')();
                    if (value) {
                        node.dataSource.createFolder(value);
                        nodeUtils.refreshNodeChildren(node);
                    }
                }
            };
            app.listen(dlg, 'closed', dlg.onClosed);
        }
    },

    collapseTree: {
        title: function () {
            return _('Collapse the tree');
        },
        hotkeyAble: true,
        icon: 'collapse',
        execute: function () {
            if (window.currentTabControl) {
                let mediaTree = qe(window.currentTabControl.container, '[data-id=mediaTree]');
                if (mediaTree && mediaTree.controlClass)
                    mediaTree.controlClass.collapseAll();
            }
        }
    },

    goToAlbumsNode: {
        title: function () {
            return sprintf(_('Go to the %s node'), _('Albums'));
        },
        hotkeyAble: true,
        icon: 'album',
        execute: function () {
            let list = getSelectedTracklist();
            if (list) {
                list.whenLoaded().then(() => {
                    let track = getValueAtIndex(list, 0);
                    if (!track)
                        track = app.utils.createEmptyTrack();
                    navUtils.getTrackCollectionAsync(track).then(function (coll) {
                        navigationHandlers['albums'].navigate(coll);
                    });
                });
            }
        }
    },

    goToArtistsNode: {
        title: function () {
            return sprintf(_('Go to the %s node'), _('Artists'));
        },
        hotkeyAble: true,
        icon: 'artist',
        execute: function () {
            let list = getSelectedTracklist();
            if (list) {
                list.whenLoaded().then(() => {
                    let track = getValueAtIndex(list, 0);
                    if (!track)
                        track = app.utils.createEmptyTrack();
                    navUtils.getTrackCollectionAsync(track).then(function (coll) {
                        navigationHandlers['artists'].navigate(coll);
                    });
                });
            }
        }
    },

    goToPlaylistsNode: {
        title: function () {
            return sprintf(_('Go to the %s node'), _('Playlists'));
        },
        hotkeyAble: true,
        icon: 'playlist',
        execute: function () {
            navigationHandlers['playlists'].navigate();
        }
    },

    goToPinnedNode: {
        title: function () {
            return sprintf(_('Go to the %s node'), _('Pinned'));
        },
        hotkeyAble: true,
        icon: 'pinned',
        execute: function () {            
            navigationHandlers['pinned'].navigate();            
        }
    },

    findMoreFromSameTitle: {
        title: function () {
            return uitools.getPureTitle('Find &more from same') + ' ' + _('Title');
        },
        hotkeyAble: true,
        category: _actionCategories.edit,
        icon: 'music',
        execute: function () {
            let list = getSelectedTracklist();
            if (list) {
                list.whenLoaded().then(() => {
                    let track = getValueAtIndex(list, 0);
                    if (track)
                        navigationHandlers['title'].navigate(track);
                });
            }
        }
    },

    findMoreFromSameAlbum: {
        title: function () {
            return uitools.getPureTitle('Find &more from same') + ' ' + _('Album');
        },
        hotkeyAble: true,
        category: _actionCategories.edit,
        icon: 'album',
        execute: function () {
            let list = getSelectedTracklist();
            if (list) {
                list.whenLoaded().then(() => {
                    let track = getValueAtIndex(list, 0);
                    if (track)
                        navigationHandlers['album'].navigate(track);
                });
            }
        }
    },

    findMoreFromSameArtist: {
        title: function () {
            return uitools.getPureTitle('Find &more from same') + ' ' + _('Artist');
        },
        hotkeyAble: true,
        category: _actionCategories.edit,
        icon: 'artist',
        execute: function () {
            let list = getSelectedTracklist();
            if (list) {
                list.whenLoaded().then(() => {
                    let track = getValueAtIndex(list, 0);
                    if (track)
                        navigationHandlers['artist'].navigate(track);
                });
            }
        }
    },

    findMoreFromSameAlbumArtist: {
        title: function () {
            return uitools.getPureTitle('Find &more from same') + ' ' + _('Album Artist');
        },
        hotkeyAble: true,
        category: _actionCategories.edit,
        icon: 'artist',
        execute: function () {
            let list = getSelectedTracklist();
            if (list) {
                list.whenLoaded().then(() => {
                    let track = getValueAtIndex(list, 0);
                    if (track)
                        navigationHandlers['albumartist'].navigate(track);
                });
            }
        }
    },

    findMoreFromSameComposer: {
        title: function () {
            return uitools.getPureTitle('Find &more from same') + ' ' + _('Composer');
        },
        hotkeyAble: true,
        category: _actionCategories.edit,
        icon: 'composer',
        execute: function () {
            let list = getSelectedTracklist();
            if (list) {
                list.whenLoaded().then(() => {
                    let track = getValueAtIndex(list, 0);
                    if (track)
                        navigationHandlers['composer'].navigate(track);
                });
            }
        }
    },

    findMoreFromSameConductor: {
        title: function () {
            return uitools.getPureTitle('Find &more from same') + ' ' + _('Conductor');
        },
        hotkeyAble: true,
        category: _actionCategories.edit,
        icon: 'conductor',
        execute: function () {
            let list = getSelectedTracklist();
            if (list) {
                list.whenLoaded().then(() => {
                    let track = getValueAtIndex(list, 0);
                    if (track)
                        navigationHandlers['conductor'].navigate(track);
                });
            }
        }
    },

    findMoreFromSameProducer: {
        title: function () {
            return uitools.getPureTitle('Find &more from same') + ' ' + _('Producer');
        },
        hotkeyAble: true,
        category: _actionCategories.edit,
        icon: 'producer',
        execute: function () {
            let list = getSelectedTracklist();
            if (list) {
                list.whenLoaded().then(() => {
                    let track = getValueAtIndex(list, 0);
                    if (track)
                        navigationHandlers['producer'].navigate(track);
                });
            }
        }
    },

    findMoreFromSameActor: {
        title: function () {
            return uitools.getPureTitle('Find &more from same') + ' ' + _('Actor');
        },
        hotkeyAble: true,
        category: _actionCategories.edit,
        icon: 'actor',
        execute: function () {
            let list = getSelectedTracklist();
            if (list) {
                list.whenLoaded().then(() => {
                    let track = getValueAtIndex(list, 0);
                    if (track)
                        navigationHandlers['actor'].navigate(track);
                });
            }
        }
    },

    findMoreFromSamePublisher: {
        title: function () {
            return uitools.getPureTitle('Find &more from same') + ' ' + _('Publisher');
        },
        hotkeyAble: true,
        category: _actionCategories.edit,
        icon: 'publisher',
        execute: function () {
            let list = getSelectedTracklist();
            if (list) {
                list.whenLoaded().then(() => {
                    let track = getValueAtIndex(list, 0);
                    if (track)
                        navigationHandlers['publisher'].navigate(track);
                });
            }
        }
    },

    findMoreFromSameDirector: {
        title: function () {
            return uitools.getPureTitle('Find &more from same') + ' ' + _('Director');
        },
        hotkeyAble: true,
        category: _actionCategories.edit,
        icon: 'director',
        execute: function () {
            let list = getSelectedTracklist();
            if (list) {
                list.whenLoaded().then(() => {
                    let track = getValueAtIndex(list, 0);
                    if (track)
                        navigationHandlers['director'].navigate(track);
                });
            }
        }
    },

    findMoreFromSameGenre: {
        title: function () {
            return uitools.getPureTitle('Find &more from same') + ' ' + _('Genre');
        },
        hotkeyAble: true,
        category: _actionCategories.edit,
        icon: 'genre',
        execute: function () {
            let list = getSelectedTracklist();
            if (list) {
                list.whenLoaded().then(() => {
                    let track = getValueAtIndex(list, 0);
                    if (track)
                        navigationHandlers['genre'].navigate(track);
                });
            }
        }
    },

    findMoreFromSameYear: {
        title: function () {
            return uitools.getPureTitle('Find &more from same') + ' ' + _('Year');
        },
        hotkeyAble: true,
        category: _actionCategories.edit,
        icon: 'year',
        execute: function () {
            let list = getSelectedTracklist();
            if (list) {
                list.whenLoaded().then(() => {
                    let track = getValueAtIndex(list, 0);
                    if (track)
                        navigationHandlers['year'].navigate(track);
                });
            }
        }
    },

    findMoreFromSameDBFolder: {
        title: function () {
            return uitools.getPureTitle('Find &more from same') + ' ' + _('Folder') + ' (' + _('Library') + ')';
        },
        hotkeyAble: true,
        category: _actionCategories.edit,
        icon: 'folder',
        execute: function () {
            let list = getSelectedTracklist();
            if (list) {
                list.whenLoaded().then(() => {
                    let track = getValueAtIndex(list, 0);
                    if (track)
                        navigationHandlers['dbFolder'].navigate(track);
                });
            }
        }
    },

    findMoreFromSameCompFolder: {
        title: function () {
            return uitools.getPureTitle('Find &more from same') + ' ' + _('Folder') + ' (' + _('All') + ')';
        },
        hotkeyAble: true,
        category: _actionCategories.edit,
        icon: 'folder',
        execute: function () {
            let list = getSelectedTracklist();
            if (list) {
                list.whenLoaded().then(() => {
                    let track = getValueAtIndex(list, 0);
                    if (track)
                        navigationHandlers['compFolder'].navigate(track);
                });
            }
        }
    },

    findMoreFromSameExplorerFolder: {
        title: function () {
            return uitools.getPureTitle('Find &more from same') + ' ' + _('Folder') + ' (' + _('Explorer') + ')';
        },
        hotkeyAble: true,
        category: _actionCategories.edit,
        icon: 'folder',
        execute: function () {
            let list = getSelectedTracklist();
            if (list) {
                list.whenLoaded().then(() => {
                    let track = getValueAtIndex(list, 0);
                    if (track)
                        navigationHandlers['explorerFolder'].navigate(track);
                });
            }
        }
    },

    locateMissing: {
        title: function () {
            return _('Locate moved/missing files') + '...';
        },
        icon: 'locate',
        hotkeyAble: true,
        execute: function () {
            let ds = getSelectedTracklist();
            if (ds) {
                ds.whenLoaded().then(function () {
                    uitools.locateTracksHandler(ds);
                });
            } else {
                uitools.showSelectFilesMsg();
            }
        },
        visible: uitools.getCanEdit,
    },

    addToLibrary: {
        title: function () {
            return _('Add to Library');
        },
        icon: 'add',
        hotkeyAble: true,
        visible: function () {
            if (uitools.getCanEdit()) {
                // test, if focused file is not in library
                let parent = window.lastFocusedControl;
                if (parent && parent.controlClass) {
                    let ds = parent.controlClass.dataSource;
                    if (!ds)
                        return false;
                    let objType;
                    if (ds.dataObject) {
                        objType = ds.dataObject.objectType;
                        return (((objType === 'track') || (objType === 'album')) && (ds.dataObject.id < 0));
                    } else {
                        let focusedIdx = ds.focusedIndex;
                        if (focusedIdx < 0)
                            return false;
                        else {
                            let selected = false;
                            objType = '';
                            let added = false;
                            let fromMediaServer = false;
                            ds.locked(function () {
                                if(ds.getValue) {
                                    let item = ds.getValue(focusedIdx);
                                    if (item) {
                                        objType = item.objectType;
                                        selected = ds.isSelected(focusedIdx);
                                        if (objType === 'playlistentry') {
                                            added = (item.sd.id > 0);
                                        } else
                                        if ((objType === 'track') || (objType === 'album'))
                                            added = (item.id > 0);
                                        if ((objType === 'track') && _utils.isMediaServerTrack(item))
                                            fromMediaServer = true;
                                    }
                                    if (!selected)
                                        selected = ds.hasItemSelected(); // focused item is not selected, but other item can be
                                }
                            }.bind(this));
                            return (selected && ((objType === 'track') || (objType === 'album') || (objType === 'playlistentry')) && (!added) && (!fromMediaServer /* #19131 */));
                        }
                    }
                } else
                    return false;

            } else
                return false;
        },
        execute: function () {
            let dev;
            let node = navUtils.getActiveNode();
            if (node)
                dev = nodeUtils.getNodeDevice(node);

            let sellist = getSelectedTracklist();
            if (sellist)
                sellist.whenLoaded().then(function (sellist) {

                    if (!sellist.count)
                        return;

                    if (dev) {
                        // device/cloud track in library (issue #14272)
                        let taskProgress = app.backgroundTasks.createNew();
                        taskProgress.leadingText = sprintf(_('Adding from %s:'), dev.name);
                        dev.addTracks2Library(sellist, false, false /* download missing */, taskProgress, false).then1(() => {
                            taskProgress.terminate();
                        });
                    } else {
                        let addTracks = app.utils.createTracklist(true);
                        listForEach(sellist, function (track) {
                            if (track.id <= 0)
                                addTracks.add(track); // track to be added to library (e.g. online youtube track)                               
                        });
                        addTracks.commitAsync(true /* forceSaveToDB*/);
                    }
                });
        }
    },

    downloadToLibrary: {
        title: function () {
            return _('Download');
        },
        icon: 'download',
        hotkeyAble: true,
        _blacklist: ['youtube.com/', 'youtu.be/'],
        visible: function () {
            let _this = actions.downloadToLibrary;
            return new Promise((resolve, reject) => {

                if (uitools.getCanEdit()) {
                    let sellist = getSelectedTracklist();
                    if (!sellist) {
                        resolve(false);
                        return;
                    }
                    sellist.whenLoaded().then((sellist) => {
                        let res = false;
                        if (sellist.count) {
                            let item = getValueAtIndex(sellist, 0);
                            if (item && item.objectType == 'track') {
                                if ((item.cacheStatus == cloudTools.CACHE_STREAMED) || (item.path.indexOf('://') > 0))
                                    res = true;
                                if (res) {
                                    for (let blackItem of _this._blacklist) {
                                        if (item.path.indexOf(blackItem) >= 0) {
                                            res = false;
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                        resolve(res);
                    });
                } else {
                    resolve(false);
                }
            });
        },
        execute: function () {
            let device;
            let node = navUtils.getActiveNode();
            if (node)
                device = nodeUtils.getNodeDevice(node);

            let sellist = getSelectedTracklist();
            if (sellist)
                sellist.whenLoaded().then(function (sellist) {

                    if (!sellist.count)
                        return;

                    if (!device) {
                        let track = getValueAtIndex(sellist, 0);
                        let sourceInfo = cloudTools.getSourceInfo(track);
                        device = mediaSyncDevices.getById(sourceInfo.device_id);
                    }

                    if (device) {
                        // device/cloud tracks to be downloaded into library                        
                        let sync = new MediaSync(device);
                        let taskProgress = app.backgroundTasks.createNew();
                        taskProgress.leadingText = sprintf(_('Initializing download from %s') + ':', device.name);
                        sync.device.addTracks2Library(sellist, false, true /* download missing */, taskProgress, false).then1(() => {
                            taskProgress.terminate();
                        });
                    } else {
                        // ordinary url track/episode to download
                        app.trackOperation.downloadFiles(sellist);
                    }
                });
        }
    },

    maintainLibrary: {
        hotkeyAble: false,
        actions: {
            rebuildSearchIndex: {
                title: function () {
                    return _('Rebuild full-text search index');
                },
                hint: function () {
                    return _('Rebuilds full-text search index. This might be useful if searching via search bar doesn\'t work right.');
                },
                order: 20,
                execute: function () {
                    if (!actions.maintainLibrary.actions.optimizeComplete.checked)
                        // the Full-text search index is already re-created in case of full compact
                        return app.db.reCreateFullTextIndex();
                    else
                        return dummyPromise(undefined);
                },
                checked: false // default
            },
            optimizeQuick: {
                title: function () {
                    return _('Optimize database');
                },
                hint: function () {
                    return _('Optimizes the database to improve performance');
                },
                order: 30,
                execute: function () {
                    return app.db.compactDatabase();
                },
                checked: true // default
            },
            optimizeComplete: {
                title: function () {
                    return _('Rebuild database');
                },
                hint: function () {
                    return _('Rebuilds the database. This might be useful if database is corrupted or contains inconsistent data.');
                },
                order: 40,
                execute: function () {
                    return app.db.rebuildDatabase();
                },
                checked: false // default
            },
            cleanURLCache: {
                title: function () {
                    return _('Clean URL cache');
                },
                hint: function () {
                    return '';
                },
                order: 50,
                execute: function () {
                    return app.db.executeQueryAsync('delete from URLRequestCache');
                },
                checked: false // default
            },

        },
        title: function () {
            return _('Manage database') + '...';
        },
        icon: 'maintainLib',
        execute: function () {
            uitools.openDialog('dlgMaintainLibrary', {
                modal: true,
                actionItems: this.actions,
            }, function (dlg) {
                if (dlg.modalResult == 1) {
                    let checkedItemIDs = JSON.parse(dlg.getValue('getCheckedItemIDs')());
                    // update checked state based on selection
                    let libActions = actions.maintainLibrary.actions;
                    for (let id in libActions) {
                        libActions[id].checked = (checkedItemIDs.indexOf(id) !== -1);
                    }
                    if (checkedItemIDs && checkedItemIDs.length > 0) {
                        let dlgProgress = uitools.showProgressWindow();
                        let executeNextFunction = function () {
                            let actID = checkedItemIDs.shift();
                            libActions[actID].execute().then(function () {
                                if (checkedItemIDs.length > 0)
                                    executeNextFunction();
                                else {
                                    dlgProgress.closeWindow();
                                    uitools.refreshView(); // to refresh the view after DB maintenance (mainly for 'Rebuild Database' option)
                                }
                            });
                        };
                        executeNextFunction();
                    }
                }
            });
        },
        visible: uitools.getCanEdit
    },

    backupDatabase: {
        title: function () {
            return _('Backup') + '...';
        },
        execute: function () {
            let sett = window.settings.get('System');
            let path = sett.System.BackupLocation;

            messageDlg(_('This will create a backup of the current database') + ' to ' + escapeXml(path) + ' <br>' + _('Do you want to proceed?'), 'Confirmation', ['btnYes', 'btnNo'], {
                defaultButton: 'btnNo'
            }, function (result) {
                if (result.btnID === 'btnYes') {
                    let dlgProgress = uitools.showProgressWindow();
                    let token = app.db.getProgressToken();
                    token.text = _('Backup') + '...';
                    app.db.backupDatabase('').then(function (result) {
                        if (result == 1) {
                            messageDlg(_('Backup is complete.'), 'Information', ['btnOK'], {
                                defaultButton: 'btnOK'
                            }, undefined);
                        } else 
                        if (result == 0) {
                            messageDlg(_('Backup FAILED!'), 'Warning', ['btnOK'], {
                                defaultButton: 'btnOK'
                            }, undefined);
                        }
                        dlgProgress.closeWindow();
                    });
                }
            });
        },
        visible: () => {
            return !webApp && uitools.getCanEdit();
        },
    },

    restoreDatabase: {
        title: function () {
            return _('Restore from backup') + '...';
        },
        execute: function () {        
            let sett = window.settings.get('System');
            let path = sett.System.BackupLocation;

            app.utils.dialogOpenFile(path, 'Select the backup file to restore', '(*.db,*.bak,*.zip)|*.db;*.bak;*.zip', '', false).then(function (fn) {
                if (fn) {
                    messageDlg(sprintf(_('Are you sure you want to restore database from %s?<br>This will delete current database and MediaMonkey will be automatically restarted when finished!'), escapeXml(app.filesystem.getFileFromString(fn))), 'Confirmation', ['btnYes', 'btnNo'], {
                        defaultButton: 'btnNo'
                    }, function (result) {
                        if (result.btnID === 'btnYes') {
                            app.db.restoreDatabase(fn).then(function (result) {
                                if (!result) {
                                    messageDlg(_('Restore FAILED!'), 'Warning', ['btnOK'], {
                                        defaultButton: 'btnOK'
                                    }, undefined);
                                }
                            });
                        }
                    });
                }
            });
        },
        visible: () => {
            return !webApp && uitools.getCanEdit();
        },
    },

    clearDatabase: {
        title: function () {
            return _('Clear database') + '...';
        },
        icon: 'clearDatabase',
        execute: function () {
            messageDlg(_('This will delete all Library data, Playlists, and Collections but will not delete any of your files or configuration data.') + ' ' + _('Do you want to proceed?'), 'Confirmation', ['btnYes', 'btnNo'], {
                defaultButton: 'btnNo'
            }, function (result) {
                if (result.btnID === 'btnYes') {
                    app.db.clearDatabase().then(function (result) {
                        if (!result) {
                            messageDlg(_('Clear FAILED! Old database restored.'), 'Warning', ['btnOK'], {
                                defaultButton: 'btnOK'
                            }, undefined);
                        }
                    });
                }
            });
        },
        visible: () => {
            return !webApp && uitools.getCanEdit();
        },
    },

    search: {
        title: function () {
            return _('Global search');
        },
        icon: 'search',
        hotkeyAble: true,
        category: _actionCategories.edit,
        execute: function () {
            let searchBar = qe(document.body, '[data-control-class="SearchBar"]');
            if (searchBar) {
                searchBar.controlClass.comeIn({
                    searchType: 'library',
                    forceGlobal: true,
                    focus: true
                });
            } else {
                // no search bar is present, navigate the search node:
                navigationHandlers['search'].navigate();
                // OR we could show the search dialog:
                /*uitools.openDialog('dlgSearch', {
                    modal: true,
                    purpose: 'search'
                });*/
            }

        },
    },

    removePermanent: {
        title: function () {
            return _('Delete (permanent)');
        },
        icon: 'delete',
        hotkeyAble: true,
        category: _actionCategories.edit,
        execute: function () {
            deleteSelected(true /*permanent*/);
        },
        visible: uitools.getCanEdit,
        disabled: function (params) {
            return actions.remove.disabled(params);
        }
    },

    remove: {
        title: function () {
            return _('Remove');
        },
        icon: 'delete',
        hotkeyAble: true,
        category: _actionCategories.edit,
        execute: deleteSelected,
        visible: uitools.getCanEdit,
        disabled: function (params) {
            if (uitools.getCanDelete()) {
                let control = window.lastFocusedControl; // @ts-ignore
                if (control && control.controlClass && control.controlClass.canDeleteSelected) // @ts-ignore
                    return !control.controlClass.canDeleteSelected(!notMediaListSelected(params));
                else
                    return notMediaListSelected(params);
            } else
                return true;
        }
    },

    cut: {
        title: function () {
            return _('Cut');
        },
        icon: 'cut',
        hotkeyAble: true,
        category: _actionCategories.edit,
        visible: function () {
            return !window.settings.UI.hideClipboardCommands;
        },
        execute: function () {
            copyItem(true /*cut*/);
        },
        disabled: function (params) {
            if (window.settings.UI.canDragDrop)
                return notLocalMediaListSelected(params);
            else
                return true;
        }
    },

    copy: {
        title: function () {
            return _('Copy');
        },
        icon: 'copy',
        hotkeyAble: true,
        category: _actionCategories.edit,
        execute: copyItem,
        visible: function () {
            return !window.settings.UI.hideClipboardCommands;
        },
        disabled: function (params) {
            if (window.settings.UI.canDragDrop)
                return notMediaListSelected(params);
            else
                return true;
        }
    },

    paste: {
        title: function () {
            return _('Paste');
        },
        icon: 'paste',
        hotkeyAble: true,
        category: _actionCategories.edit,
        visible: function () {
            return !window.settings.UI.hideClipboardCommands && uitools.getCanEdit();
        },
        execute: function () {
            uitools.pasteItem();
        },
        disabled: function () {
            let ret: boolean;
            if (window.settings.UI.canDragDrop && window.lastFocusedControl && window.lastFocusedControl) {
                let cc = window.lastFocusedControl.controlClass;
                if (cc && cc.dndEventsRegistered) {
                    ret = !uitools.canPasteClipboard(cc.canDrop.bind(cc));
                    if (ret) {
                        ODS('Paste disabled, canPasteClipboard returned false');
                    }
                } else {
                    ret = true;
                    ODS('Paste disabled, dnd events not registered');
                }
            }
            else {
                ret = true;
                ODS('Paste disabled, lastFocusedControl not set or dropping disabled');
            }

            dnd.finishedDragNDrop();
            return ret;
        }
    },

    newAutoPlaylist: {
        title: function () {
            return _('New AutoPlay&list');
        },
        icon: 'autoplaylist',
        hotkeyAble: true,
        category: _actionCategories.edit,
        execute: async function () {
            let newplaylist;
            let node = navUtils.getActiveNode();
            if (node && node.dataSource && node.dataSource.objectType == 'playlist')
                newplaylist = node.dataSource.newPlaylist();
            else
                newplaylist = app.playlists.root.newPlaylist();
            newplaylist.name = ' - ' + uitools.getPureTitle(_('New AutoPlay&list')) + ' - '; // #16261 - to be the first in the list after creation
            newplaylist.isAutoPlaylist = true;
            await newplaylist.commitAsync();
            newplaylist.isNew = true;            
            navigationHandlers['playlist'].navigate(newplaylist);            
        },
        visible: uitools.getCanEdit
    },

    newPlaylist: {
        title: function () {
            return _('New pla&ylist');
        },
        icon: 'addPlaylist',
        hotkeyAble: true,
        category: _actionCategories.edit,
        execute: async function () {
            let newplaylist;
            let node = navUtils.getActiveNode();
            if (node && node.dataSource && node.dataSource.objectType == 'playlist')
                newplaylist = node.dataSource.newPlaylist();
            else
                newplaylist = app.playlists.root.newPlaylist();
            newplaylist.name = ' - ' + uitools.getPureTitle(_('New pla&ylist')) + ' - '; // #16261 - to be the first in the list after creation
            await newplaylist.commitAsync();
            newplaylist.isNew = true;
            //navigationHandlers['playlist'].navigate(newplaylist); // navigation is intentionally disabled, so that user can D&D tracks from the current view to the new playlist (#12355)
            uitools.showPlaylistEditor(newplaylist, true, 'newPlaylistAction');
        },
        visible: uitools.getCanEdit
    },

    closeWindow: {
        title: function () {
            return _('Close');
        },
        icon: 'close',
        execute: function () {
            window.closeWindow();
        },
        visible: !webApp,
    },

    quit: {
        title: function () {
            return _('E&xit');
        },
        icon: 'close',
        hotkeyAble: true,
        execute: function () {
            app.closeApp(true);
            //window.closeWindow();
        },
        visible: !webApp && builtInMenu,
    },

    trackProperties: {
        title: function () {
            return _('&Properties');
        },
        icon: 'properties',
        hotkeyAble: true,
        execute: function () {
            let selTracks = this.getTracklist();
            if (selTracks) {
                let allTracks = getTracklist();
                if (window.lastFocusedControl && window.lastFocusedControl.controlClass && window.lastFocusedControl.controlClass.constructor.name == 'Player') 
                    allTracks = app.player.getSongList().getTracklist();
                // open edit properties dialog
                uitools.openDialog('dlgTrackProperties', {
                    modal: true,
                    tracks: selTracks,
                    allTracks: allTracks,
                    inplace: uitools.dockableDialogSpot()
                });
            }
        },
        disabled: notMediaListSelected,
        getTracklist: getSelectedTracklist,
        visible: function () {
            return window.settings.UI.allowTrackProperties !== false;
        },
    },

    subscribePodcast: {
        title: function () {
            return _('Subscribe to new podcast') + '...';
        },
        icon: 'rss',
        hotkeyAble: true,
        execute: function () {
            uitools.subscribePodcast();
        },
        visible: uitools.getCanEdit
    },

    addNetworkLocation: {
        title: function () {
            return _('Add folders') + '...';
        },
        icon: 'add',
        execute: function () {
            uitools.openDialog('dlgSelectFiles', {
                modal: true,
                title: _('Add folders'),
                description: _('If a network location isn\'t found automatically, you can add one manually.') /*+ '<br>' + _('Path') + ':'*/,
                defaultValue: '127.0.0.1',
                showBrowseButton: false
            }, function (dlg) {
                if (dlg.modalResult === 1) {
                    let path = dlg.getValue('getPath')();
                    if (path != '')
                        app.filesystem.addNetworkResourceAsync(path).then(() => {
                            uitools.refreshView();
                        });
                }
            });
        }
    },

    addLocation: {
        title: function () {
            return _('Add location');
        },
        icon: 'add', // 'addStorage',            
        visible: uitools.getCanEdit,
        hotkeyAble: true,
        submenu: [{
            title: function () {
                return _('Network') + '...';
            },
            icon: 'network',
            execute: function () {
                actions.addNetworkLocation.execute();
            },
        }, {
            title: function () {
                return _('Media server') + '...';
            },
            icon: 'server',
            execute: function () {
                actions.addMediaServer.execute();
            },
        }, {
            title: function () {
                return _('Cloud storage');
            },
            icon: 'cloud',
            submenu: function () {
                let ar: SubmenuItem[] = [];
                let order = 10;
                let keys = Object.keys(window.cloudServices);
                for (let i = 0; i < keys.length; i++) {
                    let service = copyObject(window.cloudServices[keys[i]]);
                    service.id = keys[i];
                    ar.push({
                        action: {
                            service: service,
                            title: function () {
                                return resolveToValue(this.service.title);
                            },
                            icon: function (node) {
                                return resolveToValue(this.service.icon, 'cloud');
                            },
                            execute: function () {
                                mediaSyncHandlers['cloud'].addNewProfile(this.service);
                            },
                        },
                        order: order,
                        grouporder: 10,
                    });
                    order += 10;
                }
                return ar;
            },
        }]
    },

    addMediaServer: {
        title: function () {
            return _('Add media server manually') + '...';
        },
        icon: 'addStorage',
        hotkeyAble: true,
        execute: function () {
            uitools.openDialog('dlgSelectFiles', {
                modal: true,
                title: _('Add media server manually'),
                description: _('If a media server isn\'t found automatically, you can add one manually.') + '<br>' + _('Device Description file path:'),
                defaultValue: 'http(s)://host:port/path_to_device_description_file.xml',
                showBrowseButton: false
            }, function (dlg) {
                if (dlg.modalResult === 1) {
                    let url = dlg.getValue('getPath')();
                    actions.addMediaServer._execute(url);
                }
            });
        },
        _execute: function (url) {
            let progress = app.backgroundTasks.createNew();
            progress.leadingText = resolveToValue(actions.addMediaServer.title);
            app.sharing.addRemoteServerAsync(url).then(
                function () {
                    // no message needed in case of success (as the new server just appears in the list)
                    progress.terminate();
                },
                function (err) {
                    let msg = sprintf(_('%s cannot be reached'), url) + '.<br>';
                    msg = msg + _('Error') + ': ' + err + '<br><br>';
                    uitools.showConnectError(msg);
                    progress.terminate();
                }
            );
        },
        visible: uitools.getCanEdit
    },

    configureRemoteAccess: {
        title: function () {
            return _('Configure remote access') + '...';
        },
        icon: 'options',
        visible: function () {
            return !resolveToValue(this.boundObject).isCustom;
        },
        execute: function () {
            let server = resolveToValue(this.boundObject);
            messageDlg(sprintf(_('This will auto-configure rules on your router to allow the %s UPnP/DLNA server to be accessible from a public/external network.'), escapeXml(server.name)) + ' ' + _('Configuration is via UPnP/NAT-PMP which only works if this device is on the same network as the router.') + '<br><br>' + _('Do you want to proceed?'), 'Information', ['btnYes', 'btnNo'], {
                defaultButton: 'btnYes'
            }, (result) => {
                if (result.btnID === 'btnYes') {
                    let progress = app.backgroundTasks.createNew();
                    progress.leadingText = _('Configuring remote access') + ': ' + server.name;
                    server.makePublicAsync().then(
                        function (publicURL) {
                            messageDlg(sprintf(_('Remote UPnP/DLNA access to %s was successfuly configured.'), escapeXml(server.name)) + '<br><br>' + sprintf(_('If you want to use another UPnP/DLNA client to remotely access %s, enter the following server destination to the client:'), escapeXml(server.name)) + '<br><br>' + publicURL, 'Information', ['btnOK'], undefined, undefined);
                            progress.terminate();
                        },
                        function (err) {
                            let msg = sprintf(_('Remote access to %s cannot be auto-configured via UPnP/NAT-PMP'), server.name) + '.<br><br>';
                            if (err == 'GET_PUBLIC_IP_ERR')
                                msg = msg + _('There is a problem with your internet connection.') + ' Error:' + err;
                            else
                                msg = msg + _('To resolve, enable UPnP/NAT-PMP in your router configuration or manually configure port forwarding on your router and try again') + ':<br>' + sprintf(_('port %d to IP address %s'),
                                    server.port, server.ip);
                            //msg = msg + _('Error') + ': ' + err + '<br><br>';
                            uitools.showConnectError(msg);
                            progress.terminate();
                        }
                    );
                }
            });
        }
    },

    serverInfo: {
        title: function () {
            return _('&Properties');
        },
        icon: 'information',
        execute: function () {
            let server = resolveToValue(this.boundObject);
            messageDlg(server.getProperties(), 'Information', ['btnOK'], undefined, undefined);
        }
    },

    removeServer: {
        title: function () {
            return _('Remove');
        },
        icon: 'delete',
        visible: function () {
            return resolveToValue(this.boundObject).isCustom;
        },
        execute: function () {
            let server = resolveToValue(this.boundObject);
            server.removeAsync();
        }
    },

    updatePodcasts: {
        title: function () {
            return _('Update all podcasts');
        },
        icon: 'synchronize',
        hotkeyAble: true,
        execute: function () {
            app.podcasts.runUpdate();
        },
        disabled: function () {
            return !app.podcasts.isAnyPodcastSubscribed();
        },
        visible: uitools.getCanEdit
    },

    updatePodcast: {
        title: function () {
            return _('Update podcast');
        },
        icon: 'synchronize',
        visible: function () {
            return uitools.getCanEdit() && (resolveToValue(this.boundObject).podcastURL != '');
        },
        execute: function () {
            resolveToValue(this.boundObject).runUpdate();
        }
    },

    goToSubscriptions: {
        title: function () {
            return _('Subscriptions');
        },
        icon: 'podcast',
        visible: function () {
            return app.podcasts.isAnyPodcastSubscribed();
        },
        execute: function () {
            navigationHandlers.subscriptions.navigate();
        }
    },

    updatePodcastImage: {
        title: function () {
            return _('Lookup image') + '...';
        },
        icon: 'search_image',
        visible: uitools.getCanEdit,
        execute: function () {      
            let podcast = resolveToValue(this.boundObject);
            searchTools.searchAAImageDlg(podcast, (link) => {
                podcast.saveThumbAsync(link).then(uitools.refreshView);
            }, {
                justReturnLink: true,
                //dontDownloadLink: true,
            });
        }
    },

    help: {
        title: function () {
            return _('&Help');
        },
        icon: 'help',
        hotkeyAble: true,
        category: _actionCategories.view,
        submenu: [
            {
                action: {
                    title: function () {
                        return _('Help Content');
                    },
                    icon: 'help',
                    execute: function () {
                        uitools.openWeb('https://www.mediamonkey.com/mediamonkey5-help');
                    }
                },
                order: 10,
                grouporder: 10
            }, {
                action: {
                    title: function () {
                        return _('On-line Forum');
                    },
                    icon: 'forum',
                    execute: function () {
                        uitools.openWeb('https://www.mediamonkey.com/forum');
                    }
                },
                order: 20,
                grouporder: 10
            }, {
                action: {
                    title: function () {
                        return _('Technical Support');
                    },
                    icon: 'support',
                    execute: function () {
                        uitools.openWeb('https://www.mediamonkey.com/support/knowledge-base');
                    }
                },
                order: 30,
                grouporder: 10
            }, {
                action: {
                    title: function () {
                        return _('Check for updates');
                    },
                    icon: 'checkVersion',
                    visible: true,
                    execute: function () {
                        app.checkNewVersion();
                    }
                },
                order: 40,
                grouporder: 10
            }, {
                action: {
                    title: function () {
                        return _('&About');
                    },
                    icon: 'about',
                    execute: function () {
                        uitools.showAboutDlg();
                    }
                },
                order: 10,
                grouporder: 20
            }, {
                action: {
                    title: function () {
                        return _('Debug');
                    },
                    visible: function () {
                        return (app.debug !== undefined) && (app.debug.raiseException !== undefined) && uitools.getCanEdit();
                    },
                    submenu: [{
                        title: function () {
                            return _('Send logs');
                        },
                        execute: function () {
                            app.debug.raiseException();
                        },
                    }, {
                        title: function () {
                            return _('GPU Info');
                        },
                        execute: function () {
                            uitools.openWeb('chrome:gpu', true);
                        }
                    }, {
                        title: function () {
                            return _('Change freeze timeout');
                        },
                        execute: function () {

                            let dlg = uitools.openDialog('empty', {
                                show: true,
                                modal: true
                            });
                            dlg.onLoad = function () {
                                dlg.resizeable = false;
                                dlg.title = _('Change freeze timeout');

                                let root = dlg.getValue('getBodyForControls')();

                                root.innerHTML =
                                    '<div class="flex column nonGreedy">' +
                                    ' <div class="padding wideControl middleHighControl uiRows hSeparator">' +
                                    '  <label>Please select new freeze timeout in seconds</label>' +
                                    '  <div data-id="values" data-control-class="Dropdown" data-init-params="{readOnly: true, items: \'5,10,30,60,120,240\'}" style="width: 5em"></div>' +
                                    ' </div>' +
                                    ' <div data-control-class="Buttons">' +
                                    '  <div data-id="btnSet" data-default="1">Set</div>' +
                                    ' </div>' +
                                    '</div>';

                                dlg.getValue('initializeControls')();
                                dlg.getValue('setComputedSize')(true);

                                let UI = dlg.getValue('getAllUIElements')();                                
                                UI.values.controlClass.focusedIndex = 0;
                                UI.values.controlClass.value = app.debug.getFreezeTimeout();

                                app.listen(UI.btnSet, 'click', () => {
                                    if (UI.values && UI.values.controlClass.focusedIndex >= 0) {
                                        let list = UI.values.controlClass.dataSource;
                                        list.locked(() => {
                                            app.debug.setFreezeTimeout(parseInt(list.focusedItem.toString()));
                                        });
                                    }
                                    dlg.modalResult = 1;
                                });

                                app.unlisten(dlg, 'load', dlg.onLoad);
                            }.bind(this);
                            app.listen(dlg, 'load', dlg.onLoad);
                        },
                    }, {
                        title: function () {
                            return _('Submit crash logs automatically');
                        },
                        visible: function () {
                            return (app.debug.submitCrashLogs !== undefined);
                        },
                        checkable: true,
                        checked: function () {
                            return submitCrashLogs;
                        },
                        execute: function () {
                            submitCrashLogs = !submitCrashLogs;
                            app.debug.submitCrashLogs(submitCrashLogs);
                        },
                    }]
                },
                order: 20,
                grouporder: 20
            }]
    },

    loading: {
        title: function () {
            return _('Loading') + '...';
        },
        icon: 'progress',
        hotkeyAble: false,
        disabled: true
    },

    equalizer: {
        title: function () {
            return _('E&qualizer');
        },
        icon: 'equalizer',
        hotkeyAble: true,
        checkable: true,
        category: _actionCategories.playback,
        checked: function () {
            let sett = JSON.parse(app.settings.equalizer.getJSON());
            return sett.Equalizer.Enabled;
        },
        execute: function () {
            let sett = JSON.parse(app.settings.equalizer.getJSON());
            sett.Equalizer.Enabled = !sett.Equalizer.Enabled;
            app.settings.equalizer.setJSON(JSON.stringify(sett));
        },
        visible: uitools.getCanEdit,
        disabled: function () {
            return window.settings.UI.disablePlayerControls.equalizer;
        },
        hotlinkIcon: 'options',
        hotlinkExecute: function () {
            uitools.openDialog('dlgEqualizer', {
                modal: true
            });
        },
    },

    speed: {
        title: function () {
            return _('Adjust speed');
        },
        icon: 'speed',
        hotkeyAble: true,
        checkable: true,
        category: _actionCategories.playback,
        disabled: function () {
            if(window.settings.UI.disablePlayerControls.speed)
                return true;
            let sd: Track;
            sd = app.player.getFastCurrentTrack(sd);
            return (!sd || sd.isVideo || _utils.isOnlineTrack(sd));
        },
        checked: function () {
            let sd: Track;
            sd = app.player.getFastCurrentTrack(sd);
            if(!sd)
                return false;
            let allSettings = app.settings.utils.getTrackTypeSettings();
            let typeSettings;
            let currentType = sd.trackType;
            if ((currentType < 0) || (currentType >= allSettings.count))
                return false;        
            allSettings.locked(function () {
                typeSettings = allSettings.getValue(currentType);
                typeSettings = JSON.parse(typeSettings.toString());
            });
            return typeSettings.Player.SpeedEnabled;
        },
        execute: function () {
            let sd: Track;
            sd = app.player.getFastCurrentTrack(sd);
            if(!sd)
                return;
            let allSettings = app.settings.utils.getTrackTypeSettings();
            let typeSettings;
            let currentType = sd.trackType;
            if ((currentType < 0) || (currentType >= allSettings.count))
                return;        
            allSettings.locked(function () {
                typeSettings = allSettings.getValue(currentType);
                typeSettings = JSON.parse(typeSettings.toString());
            });
            typeSettings.Player.SpeedEnabled = !typeSettings.Player.SpeedEnabled;
            if(typeSettings.Player.SpeedEnabled) {
                app.player.speed = typeSettings.Player.Speed;
                app.player.pitchChange = typeSettings.Player.Pitch;
            }
            else {
                app.player.speed = 1;
                app.player.pitchChange = 0;
            }
            allSettings.modifyAsync(function () {
                allSettings.setValue(currentType, JSON.stringify(typeSettings));
                app.settings.utils.setTrackTypeSettings(allSettings);            
            });
        },
        visible: function () {
            return uitools.getCanEdit() && app.player.isSoundTouchAccessible();
        },
        hotlinkIcon: 'options',
        hotlinkExecute: function () {
            uitools.openDialog('dlgSpeedPitch', {
                modal: true
            });
        },
        getValues: function () {
            let res = {speed: 1, pitch: 0, enabled: false};
            let sd: Track;
            sd = app.player.getFastCurrentTrack(sd);
            if(!sd)
                return res;
            let allSettings = app.settings.utils.getTrackTypeSettings();
            let typeSettings;
            let currentType = sd.trackType;
            if ((currentType < 0) || (currentType >= allSettings.count))
                return res;
            allSettings.locked(function () {
                typeSettings = allSettings.getValue(currentType);
                typeSettings = JSON.parse(typeSettings.toString());
            });
            res.enabled = typeSettings.Player.SpeedEnabled;
            res.speed = typeSettings.Player.Speed;
            res.pitch = typeSettings.Player.Pitch;
            return res;
        }
    },
    /*    speedUp: {
        title: function () {
            return _('Speed up');
        },
        hotkeyAble: true,
        category: _actionCategories.playback,
        execute: function () {
            let newspeed = app.player.speed + 0.1;
            if(newspeed>3)
                newspeed = 3;
            app.player.speed = newspeed;
        },
        disabled: function () {
            return !resolveToValue(actions.speed.visible, false) || resolveToValue(actions.speed.disabled, true);
        }    
    },
    speedDown: {
        title: function () {
            return _('Speed down');
        },
        hotkeyAble: true,
        category: _actionCategories.playback,
        execute: function () {
            let newspeed = app.player.speed - 0.1;
            if(newspeed<0.5)
                newspeed = 0.5;
            app.player.speed = newspeed;
        },
        disabled: function () {
            return !resolveToValue(actions.speed.visible, false) || resolveToValue(actions.speed.disabled, true);
        }    
    },*/
    unitTests: {
        title: function () {
            return 'Run Unit Tests';
        },
        hotkeyAble: false,
        execute: function () {
            app.tests.prepareForTests();

            uitools.openDialog('test', {
                modal: false,
                qunit: true
            }, function (w) {
                app.tests.restoreFromTests();
            });
        },
    },

    bgTests: {
        title: function () {
            return 'Run background tasks tests';
        },
        hotkeyAble: false,
        execute: function () {
            app.tests.runProgressTest();
        },
    },

    ripCD: {
        title: function () {
            return _('&Rip Audio CD') + '...';
        },
        icon: 'cd',
        hotkeyAble: true,
        category: _actionCategories.tools,
        execute: function () {
            let letter = ''; // = check all drives
            if (this.driveLetter)
                letter = this.driveLetter;
            else {
                let node = navUtils.getActiveNode();
                if (node && node.handlerID == 'optical_drive')
                    letter = node.dataSource.driveLetter;
            }

            let tracks = getTracklist();
            let allCdTracks;
            if (tracks && tracks.isLoaded && tracks.count > 0) {
                // check whether the tracks in the tracklist are the CD tracks,
                // this is needed to fix the issue #15680: Properties edited before ripping are lost
                allCdTracks = true;
                listForEach(tracks, (track) => {
                    if (!track.path.startsWith(letter + ':') || !track.path.toUpperCase().endsWith('.CDA') /* #17513 */) {
                        allCdTracks = false;
                        return true; // to break the loop (#19401)
                    }
                });
            }

            let _openDialog = (_tracks) => {
                uitools.openDialog('dlgconvertformat', {
                    modal: true,
                    tracks: _tracks,
                    mode: 'rip'
                });
            };

            if (allCdTracks) {
                _openDialog(tracks);
            } else {
                app.utils.getAudioCDTracksAsync(letter).then(function (selTracks) {
                    _openDialog(selTracks);
                });
            }
        },
        visible: function() {
            return uitools.getCanEdit() && (app.utils.system() !== 'macos');
        },
    },

    burnAudioCD: {
        title: _('Audio CD') + ' (' + _('Burn') + ')...',
        hotkeyAble: true,
        icon: 'cd',
        disabled: uitools.notMediaListSelected,
        visible: uitools.getCanEdit,
        execute: async function () {
            const list = uitools.getSelectedTracklist();
            if (!list) return;
            await list.whenLoaded();
            if (list.count === 0) {
                return;
            }
            uitools.openDialog('dlgBurn', {
                modal: true,
                tracks: list
            });
        }
    },

    getCDInfo: {
        title: function () {
            return _('Lookup Audio CD metadata') + '...';
        },
        category: _actionCategories.tools,
        icon: 'cd',
        hotkeyAble: true,
        execute: function () {
            let letter = ''; // = check all drives
            if (this.driveLetter)
                letter = this.driveLetter;
            app.utils.getAudioCDInfoAsync(letter);
        },
        visible: uitools.getCanEdit
    },

    ejectDrive: {
        title: function () {
            return _('Eject');
        },
        category: _actionCategories.tools,
        icon: 'eject',
        execute: function () {
            if (this.driveLetter)
                app.utils.ejectDriveAsync(this.driveLetter);
        },
        visible: uitools.getCanEdit
    },

    options: {
        title: function () {
            return _('&Options');
        },
        hotkeyAble: true,
        category: _actionCategories.tools,
        icon: 'options',
        execute: function () {
            uitools.showOptions();
        },
        visible: uitools.getCanEdit
    },

    optionsLayout: {
        title: function () {
            return _('Layout') + '...';
        },
        icon: 'options',
        execute: function () {
            uitools.showOptions('pnl_Layouts');
        },
        hotkeyAble: true,
        category: _actionCategories.tools,
        visible: uitools.getCanEdit
    },

    extensions: {
        title: function () {
            return _('Addons');
        },
        hotkeyAble: true,
        icon: 'addons',
        category: _actionCategories.tools,
        execute: function () {
            uitools.showExtensions();
        },
        visible: uitools.getCanEdit
    },

    playNow: {
        title: function () {
            return _('Play now');
        },
        icon: 'playNow',
        hotkeyAble: true,
        category: _actionCategories.playback,
        actionType: 'playNow',
        execute: function (lst) {
            uitools.handlePlayAction(this, lst);
        },
        disabled: notMediaListSelected,
        visible: () => {
            return (window.settings.UI.canReorder !== false);
        },
        getTracklist: getSelectedTracklist
    },

    playNowShuffled: {
        title: function () {
            return _('Play now');
        },
        hotkeyTitle: function () {
            return _('Play now') + ' (' + _('shuffled') + ')';
        },
        icon: 'playNow',
        hotkeyAble: true,
        category: _actionCategories.playback,
        actionType: 'playNowShuffled',
        execute: function (lst) {
            uitools.handlePlayAction(this, lst);
        },
        disabled: notMediaListSelected,
        visible: () => {
            return (window.settings.UI.canReorder !== false);
        },
        getTracklist: getSelectedTracklist
    },

    playNowShuffledByAlbum: {
        title: function () {
            return _('Play now');
        },
        hotkeyTitle: function () {
            return _('Play now') + ' (' + _('shuffled by Album') + ')';
        },
        icon: 'playNow',
        hotkeyAble: true,
        category: _actionCategories.playback,
        actionType: 'playNowShuffledByAlbum',
        execute: function (lst) {
            uitools.handlePlayAction(this, lst);
        },
        disabled: notMediaListSelected,
        visible: () => {
            return (window.settings.UI.canReorder !== false);
        },
        getTracklist: getSelectedTracklist
    },

    playMixedShuffled: {
        title: function () {
            return _('Queue mixed');
        },
        icon: 'playMixed',
        hotkeyAble: true,
        category: _actionCategories.playback,
        actionType: 'playMixedShuffled',
        execute: function (lst) {
            uitools.handlePlayAction(this, lst);
        },
        disabled: notMediaListSelected,
        visible: () => {
            return (window.settings.UI.canReorder !== false);
        },
        getTracklist: getSelectedTracklist
    },

    playNext: {
        title: function () {
            return _('Queue next');
        },
        icon: 'playNext',
        hotkeyAble: true,
        category: _actionCategories.playback,
        actionType: 'playNext',
        execute: function (lst) {
            uitools.handlePlayAction(this, lst);
        },
        disabled: notMediaListSelected,
        visible: () => {
            return (window.settings.UI.canReorder !== false);
        },
        getTracklist: getSelectedTracklist
    },

    playNextShuffled: {
        title: function () {
            return _('Queue next');
        },
        hotkeyTitle: function () {
            return _('Queue next') + ' (' + _('shuffled') + ')';
        },
        icon: 'playNext',
        hotkeyAble: true,
        category: _actionCategories.playback,
        actionType: 'playNextShuffled',
        execute: function (lst) {
            uitools.handlePlayAction(this, lst);
        },
        disabled: notMediaListSelected,
        visible: () => {
            return (window.settings.UI.canReorder !== false);
        },
        getTracklist: getSelectedTracklist
    },

    playNextShuffledByAlbum: {
        title: function () {
            return _('Queue next');
        },
        hotkeyTitle: function () {
            return _('Queue next') + ' (' + _('shuffled by Album') + ')';
        },
        icon: 'playNext',
        hotkeyAble: true,
        category: _actionCategories.playback,
        actionType: 'playNextShuffledByAlbum',
        execute: function (lst) {
            uitools.handlePlayAction(this, lst);
        },
        disabled: notMediaListSelected,
        visible: () => {
            return (window.settings.UI.canReorder !== false);
        },
        getTracklist: getSelectedTracklist
    },

    playLast: {
        title: function () {
            return _('Queue last');
        },
        icon: 'playLast',
        hotkeyAble: true,
        category: _actionCategories.playback,
        actionType: 'playLast',
        execute: function (lst) {
            uitools.handlePlayAction(this, lst);
        },
        disabled: notMediaListSelected,
        getTracklist: getSelectedTracklist
    },

    playLastShuffled: {
        title: function () {
            return _('Queue last');
        },
        hotkeyTitle: function () {
            return _('Queue last') + ' (' + _('shuffled') + ')';
        },

        icon: 'playLast',
        hotkeyAble: true,
        category: _actionCategories.playback,
        actionType: 'playLastShuffled',
        execute: function (lst) {
            uitools.handlePlayAction(this, lst);
        },
        disabled: notMediaListSelected,
        getTracklist: getSelectedTracklist
    },

    playLastShuffledByAlbum: {
        title: function () {
            return _('Queue last');
        },
        hotkeyTitle: function () {
            return _('Queue last') + ' (' + _('shuffled by Album') + ')';
        },
        icon: 'playLast',
        hotkeyAble: true,
        category: _actionCategories.playback,
        actionType: 'playLastShuffledByAlbum',
        execute: function (lst) {
            uitools.handlePlayAction(this, lst);
        },
        disabled: notMediaListSelected,
        getTracklist: getSelectedTracklist
    },

    play: {
        title: function () {
            return _('Play');
        },
        icon: 'play',
        hotkeyAble: true,
        category: _actionCategories.playback,
        execute: function () {
            app.player.playAsync();
        },
        disabled: function () {
            return window.settings.UI.disablePlayerControls.play;
        },
        visible: function () {
            return !app.player.isPlaying || app.player.paused;
        }
    },

    pause: {
        title: function () {
            return _('Pause');
        },
        icon: 'pause',
        hotkeyAble: true,
        category: _actionCategories.playback,
        execute: function () {
            app.player.pauseAsync();
        },
        disabled: function () {
            return window.settings.UI.disablePlayerControls.pause;
        },
        visible: function () {
            return app.player.isPlaying && !app.player.paused;
        }
    },

    playPause: {
        title: function () {
            return _('Play/Pause');
        },
        icon: 'playpause',
        hotkeyAble: true,
        category: _actionCategories.playback,
        execute: function () {
            app.player.playPauseAsync();
        },
        disabled: function () {
            return window.settings.UI.disablePlayerControls.play || window.settings.UI.disablePlayerControls.pause;
        }
    },

    stop: {
        title: function () {
            return _('Stop');
        },
        icon: 'stop',
        hotkeyAble: true,
        category: _actionCategories.playback,
        execute: function () {
            app.player.stopAsync();
        },
        disabled: function () {
            return window.settings.UI.disablePlayerControls.stop /*|| !app.player.isPlaying*/; // stop should be active even if playback is paused
        }
    },

    stopAfterCurrentOff: {
        title: function () {
            return _('Off');
        },
        icon: 'none',
        hotkeyTitle: function () {
            return _('Stop after') + ': ' + _('Off');
        },
        hotkeyAble: true,
        radiogroup: 'stopAfter',
        category: _actionCategories.playback,
        checkable: true,
        checked: function () {
            return !app.player.stopAfterCurrentTrack;
        },
        disabled: function () {
            return window.settings.UI.disablePlayerControls.stop;
        },
        execute: function () {
            app.player.stopAfterCurrentTrack = false;
        },
    },

    stopAfterCurrentFile: {
        title: function () {
            return _('Current file');
        },
        hotkeyTitle: function () {
            return _('Stop after') + ': ' + _('Current file');
        },
        icon: 'stop',
        hotkeyAble: true,
        radiogroup: 'stopAfter',
        category: _actionCategories.playback,
        checkable: true,
        checked: function () {
            return app.player.stopAfterCurrentTrack && app.player.autoResetStopAfterCurrent;
        },
        disabled: function () {
            return window.settings.UI.disablePlayerControls.stop /*|| !app.player.isPlaying*/; // stop should be active even if playback is paused
        },
        execute: function () {
            app.player.autoResetStopAfterCurrent = true;
            app.player.stopAfterCurrentTrack = true;
        },
    },

    stopAfterEveryFile: {
        title: function () {
            return _('Every file');
        },
        hotkeyTitle: function () {
            return _('Stop after') + ': ' + _('Every file');
        },
        icon: 'stop',
        hotkeyAble: true,
        radiogroup: 'stopAfter',
        category: _actionCategories.playback,
        checkable: true,
        checked: function () {
            return app.player.stopAfterCurrentTrack && !app.player.autoResetStopAfterCurrent;
        },
        disabled: function () {
            return window.settings.UI.disablePlayerControls.stop /*|| !app.player.isPlaying*/; // stop should be active even if playback is paused
        },
        execute: function () {
            app.player.autoResetStopAfterCurrent = false;
            app.player.stopAfterCurrentTrack = true;
        },
    },

    stopAfterCurrent: {
        title: function () {
            return _('Stop after');
        },
        icon: 'stop',
        disabled: function () {
            return window.settings.UI.disablePlayerControls.stop;
        },
        submenu: function () {
            return [actions.stopAfterCurrentOff, actions.stopAfterCurrentFile, actions.stopAfterEveryFile];
        }
    },

    crossfade: {
        title: function () {
            return _('Crossfade');
        },
        icon: 'shuffle',
        hotkeyAble: true,
        category: _actionCategories.playback,
        checkable: true,
        checked: function () {
            return app.player.crossfade;
        },
        disabled: function () {
            return window.settings.UI.disablePlayerControls.crossfade;
        },
        execute: function () {
            app.player.crossfade = !app.player.crossfade;
        },
    },

    shuffle: {
        title: function () {
            return _('Shuffle');
        },
        icon: 'shuffle',
        hotkeyAble: true,
        category: _actionCategories.playback,
        checkable: true,
        checked: function () {
            return app.player.shufflePlaylist;
        },
        disabled: function () {
            return window.settings.UI.disablePlayerControls.shuffle;
        },
        execute: function () {
            app.player.shufflePlaylist = !app.player.shufflePlaylist;
        },
    },

    repeatOff: {
        title: function () {
            return _('Off');
        },
        icon: 'none',
        hotkeyTitle: function () {
            return _('Repeat off');
        },
        radiogroup: 'repeat',
        hotkeyAble: true,
        category: _actionCategories.playback,
        execute: function () {
            app.player.repeatPlaylist = false;
            app.player.repeatOne = false;
        },
        checkable: true,
        checked: function () {
            return !app.player.repeatPlaylist;
        },
    },
    repeatOne: {
        title: function () {
            return _('One');
        },
        icon: 'repeatOne',
        hotkeyTitle: function () {
            return _('Repeat one');
        },
        radiogroup: 'repeat',
        hotkeyAble: true,
        category: _actionCategories.playback,
        execute: function () {
            app.player.repeatPlaylist = true;
            app.player.repeatOne = true;
        },
        checkable: true,
        checked: function () {
            return app.player.repeatPlaylist && app.player.repeatOne;
        },
    },
    repeatAll: {
        title: function () {
            return _('All');
        },
        icon: 'repeat',
        hotkeyTitle: function () {
            return _('Repeat all');
        },
        radiogroup: 'repeat',
        hotkeyAble: true,
        category: _actionCategories.playback,
        execute: function () {
            app.player.repeatPlaylist = true;
            app.player.repeatOne = false;
        },
        checkable: true,
        checked: function () {
            return app.player.repeatPlaylist && !app.player.repeatOne;
        },
    },
    repeat: {
        title: function () {
            return _('Repeat');
        },
        icon: 'repeat',
        disabled: function () {
            return window.settings.UI.disablePlayerControls.repeat;
        },
        submenu: function () {
            return [actions.repeatOff, actions.repeatOne, actions.repeatAll];
        }
    },

    normalize: {
        title: function () {
            return _('Level playback volume');
        },
        icon: 'levelVolume',
        hotkeyAble: true,
        category: _actionCategories.playback,
        checkable: true,
        checked: function () {
            return app.player.normalize;
        },
        execute: function () {
            app.player.normalize = !app.player.normalize;
            window.settings.clearCache(); // #17191
        },
        disabled: function () {
            return window.settings.UI.disablePlayerControls.levelPlaybackVolume;
        },
        visible: !webApp,
    },

    nextFile: {
        title: function () {
            return _('Next file');
        },
        icon: 'next',
        hotkeyAble: true,
        category: _actionCategories.playback,
        execute: function () {
            app.player.nextAsync(true);
        },
        disabled: function () {
            return window.settings.UI.disablePlayerControls.next;
        }
    },

    previousFile: {
        title: function () {
            return _('Previous file');
        },
        icon: 'previous',
        hotkeyAble: true,
        category: _actionCategories.playback,
        execute: function () {
            app.player.prevAsync();
        },
        disabled: function () {
            return window.settings.UI.disablePlayerControls.previous;
        }
    },

    volumeUp: {
        title: function () {
            return _('Volume up');
        },
        icon: 'upArrow',
        hotkeyAble: true,
        category: _actionCategories.playback,
        execute: function () {
            app.player.volume = app.player.volume + 0.02;
        },
        disabled: function () {
            return window.settings.UI.disablePlayerControls.volume;
        }
    },

    volumeDown: {
        title: function () {
            return _('Volume down');
        },
        icon: 'downArrow',
        hotkeyAble: true,
        category: _actionCategories.playback,
        execute: function () {
            app.player.volume = app.player.volume - 0.02;
        },
        disabled: function () {
            return window.settings.UI.disablePlayerControls.volume;
        }
    },

    rewind: {
        title: function () {
            return _('Skip 5 seconds backward');
        },
        icon: 'undo',
        hotkeyAble: true,
        category: _actionCategories.playback,
        execute: function () {
            let pl = app.player;
            pl.seekMSAsync(pl.trackPositionMS - 5000);
        },
        disabled: function () {
            return window.settings.UI.disablePlayerControls.seek;
        }
    },

    fastForward: {
        title: function () {
            return _('Skip 5 seconds forward');
        },
        icon: 'redo',
        hotkeyAble: true,
        category: _actionCategories.playback,
        execute: function () {
            let pl = app.player;
            pl.seekMSAsync(pl.trackPositionMS + 5000);
        },
        disabled: function () {
            return window.settings.UI.disablePlayerControls.seek;
        }
    },

    sleep: {
        title: function () {
            return _('S&leep') + '...';
        },
        icon: 'sleep',
        hotkeyAble: true,
        category: _actionCategories.playback,
        execute: function () {
            uitools.openDialog('dlgSleep', {
                modal: true
            });
        },
        visible: uitools.getCanEdit
    },

    autoTagFromFilename: {
        title: function () {
            return _('&Tag from filename') + '...';
        },
        category: _actionCategories.tools,
        icon: 'tag',
        hotkeyAble: true,
        execute: function () {
            let selTracks = this.getTracklist();
            if (selTracks) {
                // whenLoaded promise is awaited directly in the dialog
                uitools.openDialog('dlgAutotagFromFilename', {
                    modal: true,
                    tracks: selTracks,
                    // notShared: true, // it seems it can be shared
                });
            }
        },
        disabled: notLocalMediaListSelected,
        visible: function () {
            return calledFromMainWindow() && uitools.getCanEdit();
        },
        getTracklist: getSelectedTracklist
    },

    autoTag: {
        title: function () {
            return _('&Auto-tag') + '...';
        },
        category: _actionCategories.tools,
        icon: 'autoTag',
        hotkeyAble: true,
        execute: function () {
            let selTracks = this.getTracklist();
            if (selTracks) {
                window.localPromise(selTracks.whenLoaded()).then((selTracks: Tracklist) => {
                    if (selTracks.count)
                        uitools.openDialog('dlgAutotag', {
                            modal: !calledFromMainWindow(),
                            tracks: selTracks,
                            storeState: true,
                            allowTrackProperties: calledFromMainWindow(),
                        });
                    else
                        uitools.showSelectFilesMsg();
                });
            }
        },
        disabled: function () {
            return notLocalMediaListSelected({
                acceptCDs: true
            });
        },
        visible: function () {
            return calledFromMainWindow() && uitools.getCanEdit();
        },
        getTracklist: getSelectedTracklist
    },

    outPluginConfig: {
        title: function () {
            return _('Configure current &output plug-in') + '...';
        },
        icon: 'options',
        hotkeyAble: true,
        category: _actionCategories.tools,
        execute: function () {
            app.player.outputPluginConfig();
        },
        visible: uitools.getCanEdit
    },

    inPluginConfig: {
        title: function () {
            return _('Configure current &input plug-in') + '...';
        },
        icon: 'options',
        hotkeyAble: true,
        category: _actionCategories.tools,
        execute: function () {
            app.player.inputPluginConfig();
        },
        visible: uitools.getCanEdit
    },

    shareMedia: {
        title: function () {
            return _('Share media') + '...';
        },
        icon: 'options',
        hotkeyAble: true,
        category: _actionCategories.tools,
        execute: function () {
            uitools.showOptions('pnl_MediaServers');
        },
        visible: uitools.getCanEdit
    },

    configureCollections: {
        title: function () {
            return _('Configure Collections and nodes') + '...';
        },
        icon: 'collection',
        hotkeyAble: true,
        category: _actionCategories.tools,
        execute: function () {
            uitools.showOptions('pnl_MediaTree');
        },
        visible: uitools.getCanEdit
    },


    setupPlayer: {
        title: function () {
            return _('Options') + ' (' + _('Player') + ')...';
        },
        icon: 'options',
        hotkeyAble: true,
        category: _actionCategories.tools,
        execute: function () {
            uitools.showOptions('pnl_Player');
        },
        visible: uitools.getCanEdit
    },

    choosePlayer: {
        title: function () {
            return _('Play to');
        },
        icon: 'cast',
        visible: function () { 
            return uitools.getCanEdit() && builtInMenu;
        },
        hotkeyAble: true, // #14635
        submenu: generateChoosePlayerSubmenu,
    },

    selectAll: {
        title: function () {
            return _('Select all');
        },
        icon: 'selectAll',
        hotkeyAble: true,
        actionGroup: 'view',
        category: _actionCategories.view,
        immediateHide: true,
        iconPriority: 5,
        visible: function (params) {
            params = params || {};
            params.reqProps = ['selectAll'];
            let cc = getFocusedCC(this, params); // @ts-ignore
            return !!(cc && cc.multiselect && (!params.fromToolbar || cc.selectionMode) && cc.dataSource && cc.dataSource.hasAllSelected && !cc.dataSource.hasAllSelected());
        },
        execute: function (obj) {
            let params = {
                parent: obj,
                reqProps: ['selectAll', 'multiselect'],
            };
            let cc = getFocusedCC(this, params);
            if (cc) {
                if (usingTouch) // @ts-ignore
                    cc.selectionMode = true;
                (cc as ListView).selectAll();
                // and set focus (#13206 - item 4)                
                if (cc.setFocus)
                    cc.setFocus();
                else
                    cc.container.focus();
            }
        }
    },

    focusPlayingTrack: {
        title: function () {
            return _('Focus tracklist on currently playing item');
        },
        icon: 'play',
        hotkeyAble: true,
        execute: function () {
            let params = {                
                reqProps: ['selectAll', 'multiselect'],
            };
            let cc = getFocusedCC(this, params);
            if (cc) {
                let track = app.player.getCurrentTrack();
                if (track && cc.dataSource) {
                    let idx = -1;
                    if (cc.dataSource.objectType == 'playlistentries')
                        idx = app.player.playlistPos;
                    else
                    if (cc.dataSource.objectType == 'tracklist') {
                        idx = cc.dataSource.indexOf(track);
                        if (idx < 0)
                            idx = app.player.getIndexOfPlayingTrack(cc.dataSource);
                    }
                    if (idx >= 0) {                        
                        // and set focus (#13206 - item 4)
                        if (cc.setFocus)
                            cc.setFocus();
                        else
                            cc.container.focus();

                        cc.setFocusedAndSelectedIndex(idx).then(()=>{
                            if (cc.setItemFullyVisibleCentered)
                                cc.setItemFullyVisibleCentered(idx);
                            else
                                cc.setItemFullyVisible(idx);
                        });
                    }
                }
            }
        }
    },

    cancelSelection: {
        title: function () {
            return _('Cancel selection');
        },
        icon: 'selectNone',
        hotkeyAble: true,
        actionGroup: 'view',
        category: _actionCategories.view,
        immediateHide: true,
        iconPriority: 4,
        visible: function (params) {
            params = params || {};
            params.reqProps = ['cancelSelection'];

            let cc = getFocusedCC(this, params);
            return !!(cc && cc.multiselect && (!params.fromToolbar || cc.selectionMode) && cc.dataSource && cc.dataSource.hasAllSelected && cc.dataSource.hasAllSelected());
        },
        execute: function (obj) {
            let params = {
                parent: obj,
                reqProps: ['cancelSelection', 'multiselect'],
            };
            let cc = getFocusedCC(this, params);
            if (cc)
                (cc as ListView).cancelSelection();
        }
    },

    newTab: {
        title: function () {
            return _('New tab');
        },
        icon: 'add',
        hotkeyAble: true,
        execute: function () {
            if (window.mainTabs) {
                window.mainTabs.addNewTab();
            }
        },
        visible: function () {
            return window.settings.UI.tabs && !window.settings.UI.disableRepositioning;
        },
    },

    sendTo: {
        title: function () {
            return _('Send to');
        },
        icon: 'send',
        hotkeyAble: true,
        category: _actionCategories.tools,
        disabled: notMediaListSelected,
        visible: function () {
            return calledFromMainWindow() && uitools.getCanEdit();
        },
        submenu: function (params) {
            let _this = params.rootMenuAction || actions.sendTo;
            return new Promise(function (resolve, reject) {
                let result: SubmenuItem[] = [];

                // first load MRU list
                let mruList = uitools.globalSettings.sendToMRUList || [];
                let maxCount = uitools.globalSettings.sendToMRUListMax || 3;
                maxCount = Math.min(maxCount, mruList.length);
                let recentlyTitle = _('Recently used');
                for (let i = 0; i < maxCount; i++) {
                    let mruO = mruList[i];
                    result.push({
                        action: {
                            title: mruO.title,
                            mainAction: mruO.mainAction,
                            icon: mruO.icon,
                            playlistID: mruO.playlistID,
                            fullPath: mruO.fullPath,
                            execute: function () {
                                if (this.playlistID !== undefined) {
                                    addToSendToMRUList({
                                        title: _('Send to') + ' ' + this.fullPath,
                                        mainAction: this.mainAction,
                                        icon: this.icon,
                                        fullPath: this.fullPath,
                                        playlistID: this.playlistID
                                    });

                                    app.playlists.getByIDAsync(this.playlistID).then(function (pl) {
                                        if (pl && !window._cleanUpCalled) {
                                            let selTracks = _this.getTracklist();
                                            uitools.showPlaylistEditor(pl, false, 'sendToMenu' /* #17481 */);
                                            selTracks.whenLoaded().then(function () {
                                                if (!window._cleanUpCalled)
                                                    pl.addTracksAsync(selTracks);
                                            });
                                        }
                                    });
                                } else {
                                    handleFolderAction.call(this, {
                                        rootMenuAction: _this
                                    });
                                }
                            }
                        },
                        grouporder: 10,
                        grouptitle: recentlyTitle
                    });
                }
                
                mediaSyncDevices.getSyncable().then(function (devices) {
                    let selTracks = _this.getTracklist();
                    _utils.getFirstTrackAsync(selTracks).then((track) => {
                        let isRemoteTrack;
                        if (track)
                            isRemoteTrack = _utils.isRemoteTrack(track);

                        if (track && _utils.isSyncableTrack(track)) {
                            devices.locked(function () {
                                let synchTitle = ' (' + _('sync') + ')';
                                for (let i = 0; i < devices.count; i++) {
                                    let dev = devices.getValue(i);
                                    result.push({
                                        action: {
                                            title: dev.name + synchTitle,
                                            icon: mediaSyncDevices.getIcon(dev),
                                            _device: dev,
                                            execute: function () {

                                                let _addItem = (obj) => {
                                                    if (obj.objectType == 'node')
                                                        obj = obj.dataSource;
                                                    
                                                    let playlist;
                                                    if (obj.objectType == 'playlist')
                                                        playlist = obj;              

                                                    let list;
                                                    if (obj.objectType == 'tracklist')                                      
                                                        list = obj;
                                                    else
                                                    if (obj.objectType == 'track' || obj.objectType == 'playlistentry') {
                                                        list = app.utils.createTracklist(true);
                                                        if (obj.objectType == 'playlistentry')
                                                            list.add(obj.sd);    
                                                        else
                                                            list.add(obj);                                                        
                                                    } 
                                                    
                                                    if (list)
                                                        uitools.sendToDevice(this._device, list, playlist);
                                                    else {
                                                        dnd.getTracklistAsync(obj).then((list) => {
                                                            uitools.sendToDevice(this._device, list, playlist);
                                                        });
                                                    }
                                                };

                                                let obj = getSelectedDataSource();
                                                if (obj && obj.count) {                                                                                                                                                                                                                    
                                                    listForEach(obj, (item, idx) => {                                                            
                                                        if (obj.isSelected(idx)) {                                                            
                                                            _addItem(item);
                                                        }
                                                    });                                                    
                                                }
                                                else
                                                if (obj)
                                                    _addItem(obj);
                                            }
                                        },
                                        grouporder: 20,
                                        order: 0,
                                    });
                                }
                            });
                        }

                        if (!isRemoteTrack) {
                            result.push({
                                action: {
                                    title: _('Folder (&Move)'),
                                    mainAction: 'move',
                                    icon: 'move',
                                    submenu: generateFolderSubmenu,
                                },
                                grouporder: 30
                            });
                            result.push({
                                action: {
                                    title: _('Folder (&Copy)'),
                                    mainAction: 'copy',
                                    icon: 'copy',
                                    submenu: generateFolderSubmenu,
                                },
                                grouporder: 30
                            });
                            result.push({
                                action: {
                                    title: _('Folder (Rip/Con&vert)'),
                                    mainAction: 'convert',
                                    icon: 'convert',
                                    submenu: generateFolderSubmenu,
                                },
                                grouporder: 30
                            });
                            result.push({
                                action: actions.burnAudioCD,
                                grouporder: 30,
                            });
                        }

                        result.push({
                            action: {
                                title: _('Playlist'),
                                mainAction: 'copy',
                                icon: 'playlist',
                                submenu: generatePlaylistSubmenu,
                            },
                            grouporder: 40
                        });

                        result.push({
                            action: {
                                title: _('M3U/XSPF playlist') + '...',
                                mainAction: 'copy',
                                icon: 'playlist',
                                execute: function (this: Action) {
                                    handleSendToM3U.apply(this, [params]);
                                }
                            },
                            grouporder: 40
                        });
                        
                        // @ts-ignore
                        if(actions.exportToFile) { // if not uninstalled
                            result.push({
                                action: {
                                    title: _('Report') + ' (' + _('File list') + '...)', // @ts-ignore
                                    hotkeyAble: actions.exportToFile.hotkeyAble, // @ts-ignore
                                    icon: actions.exportToFile.icon,
                                    disabled: false, // #20585
                                    getTracklist: function () {
                                        if (params.rootMenuAction && params.rootMenuAction.getTracklist) {
                                            return params.rootMenuAction.getTracklist();
                                        } else // @ts-ignore
                                            return actions.exportToFile.getTracklist();
                                    },
                                    execute: function (this: Action) { // @ts-ignore
                                        actions.exportToFile.execute.apply(this, [params]);
                                    }
                                },
                                grouporder: 40
                            });
                        }
                        result.push({
                            action: {
                                title: _('E-Mail') + '...',
                                mainAction: 'copy',
                                icon: 'email',
                                execute: function () {
                                    handleSendToMail.apply(this, [params]);
                                }
                            },
                            grouporder: 50
                        });

                        resolve(result);
                    });
                });

                result.push({
                    action: bindAction(actions.pin, (_this !== undefined ? _this.boundObject : undefined)),
                    order: 10,
                    grouporder: 99999
                });
            });
        },
        getTracklist: getSelectedTracklist
    },

    findMoreFromSame: {
        title: function () {
            return _('Find &more from same');
        },
        category: _actionCategories.edit,
        hotkeyAble: true,
        icon: 'search_equals',
        submenu: getFindMoreFromSameMenu,
        disabled: notMediaListSelected,
        visible: function () {
            return calledFromMainWindow() && builtInMenu;
        },
    },

    analyzeVolume: {
        title: function () {
            return _('Anal&yze volume');
        },
        category: _actionCategories.tools,
        hotkeyAble: true,
        icon: 'analyzeVolume',
        execute: function () {
            let selTracks = this.getTracklist();
            if (selTracks) {
                window.localPromise(selTracks.whenLoaded()).then(function (selTracks) {
                    app.trackOperation.analyzeVolume(selTracks);
                });
            }
        },
        disabled: notLocalMediaListSelected,
        visible: function() {
            return uitools.getCanEdit() && (app.utils.system() !== 'macos');
        },
        getTracklist: getSelectedTracklist
    },

    levelTrackVolume: {
        title: function () {
            return _('&Level Track volume');
        },
        category: _actionCategories.tools,
        hotkeyAble: true,
        icon: 'levelVolume',
        execute: function () {
            let selTracks = this.getTracklist();
            if (selTracks) {
                messageDlg(_('Leveling Track volume irreversibly modifies the track. Are you sure you want to level the volume of the selected Tracks?'), 'Confirmation', ['btnYes', 'btnNo'], {
                    defaultButton: 'btnNo',
                    helpContext: 'Volume Leveling#Leveling Track Volume'
                }, function (result) {
                    if (result.btnID === 'btnYes') {
                        // @ts-ignore
                        window.localPromise(selTracks.whenLoaded()).then(function (selTracks) {
                            app.trackOperation.applyMP3Gain(selTracks);
                        });
                    }
                });
            } else {
                uitools.showSelectFilesMsg();
            }
        },
        disabled: notLocalMediaListSelected,
        visible: function() {
            return uitools.getCanEdit && (app.utils.system() !== 'macos');
        },
        getTracklist: getSelectedTracklist
    },

    analyzeWaveform: {
        title: function () {
            return _('Analyze waveform');
        },
        category: _actionCategories.tools,
        hotkeyAble: true,
        icon: 'analyzeWaveform',
        execute: function () {
            let selTracks = this.getTracklist();
            if (selTracks) {
                window.localPromise(selTracks.whenLoaded()).then(function (selTracks) {
                    app.player.analyzeWaveform(selTracks);
                });
            }
        },
        disabled: notLocalMediaListSelected,
        getTracklist: getSelectedTracklist
    },

    includeSubfolders: {
        title: function () {
            return window.includeSubfoldersInLocations ? _('Display only selected folder\'s content') : _('Display folder content recursively');
        },
        icon: function () {
            return window.includeSubfoldersInLocations ? 'exclsubfolders' : 'inclsubfolders';
        },
        hotkeyAble: true,
        category: _actionCategories.view,
        execute: function () {
            if (window.includeSubfoldersInLocations == undefined) {
                window.includeSubfoldersInLocations = false;
            }
            window.includeSubfoldersInLocations = !window.includeSubfoldersInLocations;
            this.multiviewControl.reload();
        },
        actionGroup: 'view',
        checked: function () {
            return window.includeSubfoldersInLocations;
        },
        iconPriority: 10
    },

    viewFilter: {
        title: function () {
            return _('View filter');
        },
        icon: function () {
            /*if (this._isFilterVisible())
                return 'filter_remove'
            else*/
            return 'filter';
        },
        helpContext: function () {
            let node = navUtils.getActiveNode();
            if (node && node.handlerID == 'search') {
                return 'Search#Advanced Search';
            } else {
                return 'Filelisting#Filtering the Filelisting';
            }
        },
        hotkeyAble: true,
        category: _actionCategories.view,
        actionGroup: 'view',
        _getEditor: function () {
            let root = (window.currentTabControl && window.currentTabControl.container) ? window.currentTabControl.container : document.body;
            return qe(root, '[data-id=viewFilterEditor]');
        },
        _isFilterVisible: function () {
            return isVisible(this._getEditor());
        },
        discard: function (manual) {
            let elem = this._getEditor();
            if (elem)
                elem.controlClass.discard();

            if (manual) {
                let node = navUtils.getActiveNode();
                if (node && node.handlerID == 'search')
                    actions.history.backward.execute(); // was manual discard, go back from the search view
            }
        },
        _addAnyTextFieldRule: (QD, phrase) => {
            let collID = QD.collectionID;
            QD.clear(); // to clear all previous conditions
            QD.collectionID = collID;
            QD.matchAllCriteria = true;

            if (phrase) {
                let rule = QD.addNewCondition();
                rule.setFieldDBName('ANT'); // "Any text"
                rule.operatorName = _('contains');
                rule.setValuesAsync(phrase, '');
            }
        },
        execute: function () {
            let elem = this._getEditor();
            if (elem) {
                toggleVisibility(elem, {
                    onComplete: () => notifyLayoutChange() // so that view siblings (sub-views) like "Album & Tracks" are correctly updated/repositioned
                });
                if (this._isFilterVisible()) {
                    let node = navUtils.getActiveNode();
                    // LS: advanced search and view filering have been unified (see #12371 - items 1&2)
                    if (node && node.handlerID == 'search') {
                        let QDS = navUtils.getActiveTabQueryData();
                        QDS.advancedSearch = true; // is listened by SearchView.onQueryDataChange                           
                        let QDF = elem.controlClass.QueryData; //app.db.getQueryDataSync('filter');                                                    
                        // pass the search phrase as a new rule to the view filter:                        
                        this._addAnyTextFieldRule(QDF, QDS.searchPhrase);                        
                        elem.controlClass.assignHelpContext('Search#Advanced Search');
                    } else {
                        elem.controlClass.assignHelpContext('Filelisting#Filtering the Filelisting');
                        //if (!elem.controlClass.filterActive())
                        //    elem.controlClass.loadLastFilter(); // #14293 - item 13 -- but subsequently reverted because of item 18
                    }
                    elem.controlClass.refreshRules(); // could be canceled/modified via navbar -- thus need refresh
                    elem.focus(); // to allow correct help after opening
                } else {
                    elem.controlClass.saveCurrentFilter();
                    elem.controlClass.closeEditing();
                }
            }
        },
        show: function () {
            if (!this._isFilterVisible())
                this.execute();
        },
        hide: function () {
            if (this._isFilterVisible())
                this.execute();
        },
        addCondition: function (field, operator, value, withClear) {
            this.show();
            let elem = this._getEditor();
            if (elem) {
                let QD = elem.controlClass.QueryData;
                if (withClear)
                    QD.clear(); // to clear all previous conditions
                let rule = QD.addNewCondition();
                rule.setFieldDBName(field);
                rule.operatorName = _(operator);
                rule.setValuesAsync(value, '');
                QD.matchAllCriteria = true;
                QD.advancedSearch = true;
                elem.controlClass.refreshRules();
            }
        }
    },

    advancedSearch: {
        title: function () {
            return _('Advanced search');
        },
        icon: 'filter',
        hotkeyAble: true,
        category: _actionCategories.edit,
        execute: function () {
            navigationHandlers['search'].navigate().then(() => {
                actions.viewFilter.show();
            });
        },
    },

    viewSelection: {
        actionGroup: 'view',
        identifier: 'viewSelectionStack',
        controlClass: 'MenuToggleButton',
        iconPriority: 110 // so that it is right most to the includeSubfolders action (with iconPriority 10)
    },

    view: {
        category: _actionCategories.view,
        hotkeyAble: true,
        leftPanel: {
            title: function () {
                return _('Left panel');
            },
            hotkeyAble: true,
            checked: function () {
                if (window.currentTabControl && window.currentTabControl.container) {
                    return isVisible(qe(window.currentTabControl.container, '[data-id=sidebar]'), false);
                } else {
                    return false;
                }
            },
            checkable: true,
            execute: function () {
                if (!window.currentTabControl || !window.currentTabControl.container)
                    return;
                let elem = qe(window.currentTabControl.container, '[data-id=sidebar]');
                if (elem) {
                    toggleVisibility(elem);
                    let vis = isVisible(elem);
                    elem._manualVisibilityState = vis;
                    uitools.getDocking().handleDockVisibility(elem, vis);
                    /*var layout = uitools.getDocking().getCurrentLayout();
                    if (layout) {
                        var dock = layout.getDock(elem.getAttribute('data-id'));
                        if (dock) {
                            dock.changeDockVisibility(vis);
                            uitools.getDocking().storeLayout(layout);
                        }
                    }*/
                    this.updateButtonLabel();
                }
            },
            updateButtonLabel: function () {
                if (!window.currentTabControl || !window.currentTabControl.container)
                    return;
                let el = qe(window.currentTabControl.container, '[data-id=sidebar]');
                if (!el)
                    return;
                let vis = isVisible(el);

                let btn = qid('showSidebarLeft');
                if (btn) {
                    let label = _(vis ? 'Minimize' : 'Show') + ': ' + _('Left panel');
                    setIconAriaLabel(btn, label);
                    btn.setAttribute('data-tip', label);
                    btn.toggleAttribute('data-checked', vis);
                }
            },
            disabled: function () {
                if (!window.currentTabControl || !window.currentTabControl.container)
                    return true;
                else
                    return !qe(window.currentTabControl.container, '[data-id=sidebar]') /* || window.isTouchMode*/;
            },
            visible: function () {
                if (!window.currentTabControl || !window.currentTabControl.container)
                    return false;
                else
                    return qe(window.currentTabControl.container, '[data-id=sidebar]') && !window.settings.UI.disableRepositioning /* && !window.isTouchMode*/;
            },
        },

        mediaTree: {
            title: function () {
                return _('Media Tree');
            },
            hotkeyAble: true,
            checked: function () {
                if (window.currentTabControl && window.currentTabControl.container) {
                    let vis = isVisible(qe(window.currentTabControl.container, '[data-id=mediaTree]'), true);
                    let layout = uitools.getDocking().getCurrentLayout();
                    if (layout)
                        vis = layout.isPanelVisible('mediaTree');
                    return vis;
                } else {
                    return false;
                }
            },
            checkable: true,
            execute: function () {
                if (window.currentTabControl && window.currentTabControl.container) {
                    let tree = qe(window.currentTabControl.container, '[data-id=mediaTree]');
                    if (tree) {
                        let vis = !isVisible(tree, true);
                        setVisibility(tree, vis);
                        let layout = uitools.getDocking().getCurrentLayout();
                        if (layout) {
                            let dock = layout.getPanelDock('mediaTree');
                            if (dock) {
                                dock.changePanelVisibility('mediaTree', vis);
                                uitools.getDocking().storeLayout(layout);
                                let div = qeid(window.currentTabControl.container, dock.id);
                                if (!div)
                                    div = qid(dock.id);
                                setVisibility(div, vis || dock.anyPanelVisible());
                            }
                        }
                        uitools.getDocking().notifyPanelStateChange('mediaTree', vis);
                    }
                }
            },
            disabled: function () {
                // @ts-ignore
                return window.fullWindowModeActive || !window.currentTabControl || !window.currentTabControl.mediatree;
            },
            visible: function () {
                return qid('mediaTree') && !window.settings.UI.disableRepositioning;
            },
        },

        player: {
            title: function () {
                return _('Player');
            },
            hotkeyAble: true,
            checked: function () {
                let vis = isVisible(qid('mainPlayer'), false);
                let layout = uitools.getDocking().getCurrentLayout();
                if (layout)
                    vis = layout.isPanelVisible('mainPlayer');
                return vis;
            },
            checkable: true,
            execute: function () {
                let el = qid('mainPlayer');
                if (!el)
                    return;
                let vis = !isVisible(el, false);
                let layout = uitools.getDocking().getCurrentLayout();
                if (layout) {
                    let dock = layout.getPanelDock('mainPlayer');
                    if (dock) {
                        dock.changePanelVisibility('mainPlayer', vis);
                        uitools.getDocking().storeLayout(layout);
                    }
                }
                uitools.getDocking().notifyDockStateChange('mainPlayer', vis);
                el._manualVisibilityState = vis;
            },
            disabled: function () {
                return !qid('mainPlayer');
            },
            visible: () => {
                return !window.settings.UI.disableRepositioning;
            }
        },
        rightPanel: {
            hotkeyAble: true,
            title: function () {
                return _('Right panel');
            },
            checked: function () {
                let el = q('[data-id=nowplaying]');
                if (el) {
                    return !el._forcedVisible && isVisible(el, false);
                } else
                    return false;
            },
            checkable: true,
            execute: function () {
                let el = qid('nowplaying');
                if (!el)
                    return;
                let vis = !isVisible(el, false);
                if (el._forcedVisible)
                    el._forcedVisible = undefined;

                el._manualVisibilityState = vis;
                uitools.getDocking().handleDockVisibility(el, vis);

                this.updateButtonLabel();
            },
            updateButtonLabel: function () {
                let el = qid('nowplaying');
                if (!el)
                    return;
                let vis = isVisible(el, false);

                let btn = qid('showSidebarRight');
                if (btn) {
                    let label = _(vis ? 'Minimize' : 'Show') + ': ' + _('Right panel');
                    setIconAriaLabel(btn, label);
                    btn.setAttribute('data-tip', label);
                    btn.toggleAttribute('data-checked', vis);
                }
            },
            disabled: function () {
                return window.fullWindowModeActive || !q('[data-id=nowplaying]');
            },
            visible: function () {
                return q('[data-id=nowplaying]') && !window.settings.UI.disableRepositioning /* && !window.isTouchMode*/;
            }
        },
        lyricsPanel: {
            title: function () {
                return _('Lyrics');
            },
            hotkeyAble: true,
            checked: function () {
                let vis = isVisible(qid('lyricsWindow'), true);
                let layout = uitools.getDocking().getCurrentLayout();
                if (layout)
                    vis = layout.isPanelVisible('lyricsWindow');
                return vis;
            },
            checkable: true,
            execute: function () {
                let el = qid('lyricsWindow');
                if (!el)
                    return;
                let vis = !isVisible(el, true);
                setVisibility(el, vis);
                el._manualVisibilityState = vis;
                let layout = uitools.getDocking().getCurrentLayout();
                let handled = false;
                if (layout) {
                    let dock = layout.getPanelDock('lyricsWindow');
                    if (dock) {
                        dock.changePanelVisibility('lyricsWindow', vis);
                        uitools.getDocking().storeLayout(layout);
                        setVisibility(qid(dock.id), vis || dock.anyPanelVisible());
                        handled = true;
                    }
                }

                if (!handled) { // no layout preset, use default
                    // @ts-ignore TODO INVESTIGATE, typo?
                    setVisibility(qid('nowplaying'), vis || isVisible(qid('artWindow') || isVisible(qid('nowplayinglistContainer'))));
                }
                uitools.getDocking().notifyPanelStateChange('lyricsWindow', vis);

            },
            disabled: function () {
                return window.fullWindowModeActive || !qid('lyricsWindow');
            },
            visible: function () {
                return qid('lyricsWindow') && !window.settings.UI.disableRepositioning;
            },
        },
        nowPlaying: {
            title: function () {
                return _('Playing');
            },
            hotkeyAble: true,
            checked: function () {
                let vis = isVisible(q('[data-id=nowplayinglistContainer]'), true);
                let layout = uitools.getDocking().getCurrentLayout();
                if (layout)
                    vis = layout.isPanelVisible('nowplayinglistContainer');
                return vis;
            },
            checkable: true,
            execute: function () {
                let el = qid('nowplayinglistContainer');
                if (!el)
                    return;
                let vis = !isVisible(el, true);
                setVisibility(el, vis);
                el._manualVisibilityState = vis;
                let layout = uitools.getDocking().getCurrentLayout();
                let handled = false;
                if (layout) {
                    let dock = layout.getPanelDock('nowplayinglistContainer');
                    if (dock) {
                        dock.changePanelVisibility('nowplayinglistContainer', vis);
                        uitools.getDocking().storeLayout(layout);
                        setVisibility(qid(dock.id), vis || dock.anyPanelVisible());
                        handled = true;
                    }
                }

                if (!handled) { // no layout preset, use default
                    setVisibility(qid('nowplaying'), vis || isVisible(qid('artWindow')));
                }
                uitools.getDocking().notifyPanelStateChange('nowplayinglistContainer', vis);
            },
            disabled: function () {
                return window.fullWindowModeActive || !q('[data-id=nowplayinglistContainer]');
            },
            visible: function () {
                return q('[data-id=nowplayinglistContainer]') && !window.settings.UI.disableRepositioning;
            },
        },
        preview: {
            title: function () {
                return _('Preview');
            },
            hotkeyAble: true,
            checked: function () {
                let artW = qid('artWindow');
                if (artW) {
                    let vis = !artW._forcedVisible && isVisible(artW, true);
                    let layout = uitools.getDocking().getCurrentLayout();
                    if (layout)
                        vis = layout.isPanelVisible('artWindow');
                    return vis;
                } else
                    return false;
            },
            checkable: true,
            execute: function () {
                let artW = qid('artWindow');
                assert(artW);
                let vis = !isVisible(artW, false);
                if (artW._forcedVisible)
                    artW._forcedVisible = undefined; // was visible only for displaying visualization or video
                setVisibility(artW, vis);
                artW._manualVisibilityState = vis;

                let layout = uitools.getDocking().getCurrentLayout();
                let handled = false;
                if (layout) {
                    let dock = layout.getPanelDock('artWindow');
                    if (dock) {
                        dock.changePanelVisibility('artWindow', vis);
                        uitools.getDocking().storeLayout(layout);
                        setVisibility(qid(dock.id), vis || dock.anyPanelVisible());
                        handled = true;
                    }
                }

                if (!handled) {
                    let np = qid('nowplaying');
                    setVisibility(np, vis || isVisible(qid('nowplayinglistContainer')));
                }

                uitools.getDocking().notifyPanelStateChange('artWindow', vis);
            },
            disabled: function () {
                return window.fullWindowModeActive || !q('[data-id=artWindow]');
            },
            visible: function () {
                return q('[data-id=artWindow]') && !window.settings.UI.disableRepositioning;
            },
        },
        visualization: {
            title: function () {
                return _('&Visualization');
            },
            icon: 'visualization',
            hotkeyAble: true,
            visible: function () {
                return !webApp && !!q('[data-player-control=visualizer]') && !!q('[data-id=artWindow]');
            },
            checkable: true,
            checked: function () {
                return app.player.visualization.active;
            },
            execute: function () {
                let vis = app.player.visualization;
                if (vis.active) {
                    app.player.visualization.active = false;
                } else {
                    app.player.visualization.active = true;
                    let player = app.player;
                    if (vis.active && player.isPlaying && !player.paused) {
                        let sd: Track;
                        sd = player.getFastCurrentTrack(sd);
                        if (sd && !sd.isVideo && !_utils.isOnlineTrack(sd)) {
                            uitools.getPlayerUtils().initializeVisualization();
                        }
                    }
                }
            },
            submenu: function (params) {     
                let menuitems: SubmenuItem[] = [];
                let menuArr;
                if (uitools.visMenuItems && uitools.globalSettings && uitools.globalSettings.selectedVisualization && isArray(uitools.visMenuItems[uitools.globalSettings.selectedVisualization])) {
                    menuArr = uitools.visMenuItems[uitools.globalSettings.selectedVisualization];
                    for (let i = 0; i < menuArr.length; i++) {
                        menuitems.push({
                            action: menuArr[i],
                            order: i + 1,
                            grouporder: 10
                        });
                    }
                }

                menuArr = uitools.getVisMenuItems();
                if (menuArr) {
                    for (let i = 0; i < menuArr.length; i++) {
                        menuitems.push({
                            action: menuArr[i],
                            order: i + 1,
                            grouporder: 20
                        });
                    }
                }
                return menuitems;
            }
        },
        refresh: {
            title: function () {
                return _('Refresh');
            },
            icon: 'refresh',
            hotkeyAble: true,
            execute: function () {
                // @ts-ignore
                if (window.currentTabControl && window.currentTabControl.multiviewControl) { // @ts-ignore
                    let mc = window.currentTabControl.multiviewControl;
                    mc.refresh();
                }
                // Raise view refresh event for this window
                let event = createNewCustomEvent('viewrefresh', {
                    bubbles: false,
                    cancelable: false,
                });
                window.dispatchEvent(event);

            },
            disabled: function (params) {
                let ret = true; // @ts-ignore
                if (window.currentTabControl && window.currentTabControl.multiviewControl)
                    ret = false;
                return ret;
            }
        },
    },

    partyMode: {
        title: function () {
            return _('Party Mode');
        },
        visible: !webApp,
        checked: function () {
            return app.inPartyMode;
        },
        hotkeyAble: true,
        category: _actionCategories.view,
        checkable: true,
        execute: function () {

            if (window.exitPartyModeBtn) {
                window.exitPartyModeBtn.click(); // to show the "Enter password" and destroy the party mode shield button
                return;
            }

            uitools.storeUIState(); // needs to be before app.inPartyMode toggle below                
            app.inPartyMode = !app.inPartyMode; // toggle
            preventClose(app.inPartyMode);
            if (app.inPartyMode) {
                // we are entering Party Mode                    
                let sett = window.settings.get('PartyMode'); // sett as configured in Options -> Party Mode page
                window.settings.UI.canEdit = false;
                window.settings.UI.canDelete = false;
                window.settings.UI.hideMenu = sett.PartyMode.HideMenu;
                window.settings.UI.disableRepositioning = sett.PartyMode.DisableRepositioning;
                if (sett.PartyMode.DisableAudioControls) {
                    // Disable player controls and track reordering
                    window.settings.UI.canReorder = false;
                    window.settings.UI.canDragDrop = false;
                    window.settings.UI.disablePlayerControls.stop = true;
                    window.settings.UI.disablePlayerControls.next = true;
                    window.settings.UI.disablePlayerControls.previous = true;
                    window.settings.UI.disablePlayerControls.repeat = true;
                    window.settings.UI.disablePlayerControls.shuffle = true;
                    window.settings.UI.disablePlayerControls.seek = true;
                    window.settings.UI.disablePlayerControls.playTo = true;
                    window.settings.UI.disablePlayerControls.equalizer = true;
                    window.settings.UI.disablePlayerControls.crossfade = true;
                    window.settings.UI.disablePlayerControls.levelPlaybackVolume = true;
                    let enableVolumePlayPause = sett.PartyMode.EnableVolumePlayPause;
                    window.settings.UI.disablePlayerControls.volume = !enableVolumePlayPause;
                    window.settings.UI.disablePlayerControls.play = !enableVolumePlayPause;
                    window.settings.UI.disablePlayerControls.pause = !enableVolumePlayPause;
                }
                window.settings.UI.store(); // store the party settings to be used after window.doReload() or in others dialogs opened in Party Mode (like Properties)
            } else {
                window.settings.UI.restore(); // re-store the non-party settings asap (otherwise could be accidentally overwritten by the party settings when someone calls settings.UI.store() now)     
            }

            app.settings.notifyChange(); // is listened e.g. by Player component to update player controls disabled state

            uitools.initPartyMode();
        },
        hotlinkIcon: 'options',
        hotlinkExecute: function () {
            uitools.showOptions('pnl_PartyMode');
        },
    },

    nowplaying: {
        category: _actionCategories.nowplaying,
        hotkeyAble: true,
        clear: {
            title: function () {
                return _('&Clear');
            },
            icon: 'remove',
            hotkeyAble: true,
            disabled: nowplayingEmpty,
            execute: function () {
                app.player.clearPlaylistAsync(true /* save history*/);
            }
        },
        cleanInaccessible: {
            title: function () {
                return _('Clea&n (remove inaccessible)');
            },
            icon: 'remove',
            hotkeyAble: true,
            disabled: nowplayingEmpty,
            execute: function () {
                app.player.removeNotAccessibleAsync();
            }
        },
        removeDuplicates: {
            title: function () {
                return _('Remove &duplicates') + '...';
            },
            icon: 'remove',
            hotkeyAble: true,
            disabled: nowplayingEmpty,
            execute: function () {
                app.player.removeDuplicatesAsync();
            }
        },
        randomizeList: {
            title: function () {
                return _('&Randomize list');
            },
            icon: 'shuffle',
            hotkeyAble: true,
            disabled: nowplayingEmpty,
            execute: function () {
                app.player.randomizePlaylistAsync();
            }
        },
        reverseList: {
            title: function () {
                return _('Reverse list');
            },
            icon: 'refresh',
            hotkeyAble: true,
            disabled: nowplayingEmpty,
            execute: function () {
                app.player.reversePlaylistAsync();
            }
        },
        undo: {
            title: function () {
                return _('&Undo');
            },
            icon: 'undo',
            hotkeyAble: true,
            disabled: function () {
                let undolist = app.player.getUndoList(true /* only first*/);
                return !undolist || (undolist.count === 0);
            },
            submenu: function () {
                return new Promise(function (resolve, reject) {
                    let undolist = app.player.getUndoList(false);
                    undolist.whenLoaded().then(function () {
                        if (undolist.count === 0)
                            resolve(undefined);
                        let retArray: Action[] = [];
                        undolist.forEach(function (txt, index) {
                            retArray.push({
                                title: '' + txt,
                                execute: function () {
                                    app.player.undoAsync(index + 1);
                                }
                            });
                        });
                        if (retArray.length > 0) {
                            retArray.push(menuseparator);
                            retArray.push({
                                title: _('Clear history'),
                                icon: 'delete',                    
                                execute: function () {
                                    app.player.clearUndoList();
                                }
                            });
                        }
                        resolve(retArray);
                    });
                });

            }
        },
        redo: {
            title: function () {
                return _('&Redo');
            },
            icon: 'redo',
            hotkeyAble: true,
            disabled: function () {
                let redolist = app.player.getRedoList(true /* only first*/);
                return !redolist || (redolist.count === 0);
            },
            submenu: function () {
                return new Promise(function (resolve, reject) {
                    let redolist = app.player.getRedoList(false);
                    redolist.whenLoaded().then(function () {
                        if (redolist.count === 0)
                            resolve([]);
                        let retArray: Action[] = [];
                        redolist.forEach(function (txt, index) {
                            retArray.push({
                                title: '' + txt,
                                execute: function () {
                                    app.player.redoAsync(index + 1);
                                }
                            });
                        });
                        resolve(retArray);
                    });
                });
            }
        },
        trackProperties: {
            title: _('&Properties'),
            icon: 'properties',
            hotkeyAble: true,
            category: _actionCategories.nowplaying,
            execute: function () {
                let track = app.player.getCurrentTrack();
                if (track) {
                    // open edit properties dialog
                    let selTracks = app.utils.createTracklist(true);
                    selTracks.add(track);
                    let allTracks = app.player.getSongList().getTracklist();
                    let dlg = uitools.openDialog('dlgTrackProperties', {
                        modal: true,
                        tracks: selTracks,
                        allTracks: allTracks
                    });
                }
            },
            disabled: function () {
                if (!uitools.getCanEdit())
                    return true;
                let track = app.player.getCurrentTrack();
                return !track;
            }
        }
    },

    history: {
        category: _actionCategories.history,
        hotkeyAble: true,
        backward: {
            title: function () {
                return _('Previous view');
            },
            icon: 'undo',
            hotkeyAble: true,
            execute: function () {
                if (window.currentTabControl) {  // @ts-ignore
                    let history = window.currentTabControl.history;
                    if (history && history.undo && history.canUndo && history.canUndo())
                        history.undo();
                }
            }
        },
        // forward is added here via redoNavbarButton script
    },

    video: {
        category: _actionCategories.video,
        hotkeyAble: true,
        fitToWindow: {
            title: function () {
                return _('Fit video to window on resize');
            },
            checkable: true,
            checked: function () {
                return !!(uitools.getPlayerUtils().videoSettings.flags & 1);
            },
            execute: function () {
                let pUtils = uitools.getPlayerUtils();
                if (pUtils.videoSettings.flags & 1)
                    pUtils.videoSettings.flags &= ~1;
                else
                    pUtils.videoSettings.flags |= 1;
                app.player.setVideoSettings(pUtils.videoSettings);
            }
        },
        zoom50: {
            title: _('Zoom to 50%'),
            hotkeyAble: true,
            disabled: function () {
                return !!(uitools.getPlayerUtils().videoSettings.flags & 1);
            },
            checked: function () {
                return (uitools.getPlayerUtils().videoSettings.zoom === 0.5);
            },
            execute: function () {
                uitools.getPlayerUtils().videoSettings.zoom = 0.5;
                app.player.setVideoSettings(uitools.getPlayerUtils().videoSettings);
            }
        },
        zoom100: {
            title: _('Zoom to 100%'),
            hotkeyAble: true,
            disabled: function () {
                return !!(uitools.getPlayerUtils().videoSettings.flags & 1);
            },
            checked: function () {
                return (uitools.getPlayerUtils().videoSettings.zoom === 1);
            },
            execute: function () {
                uitools.getPlayerUtils().videoSettings.zoom = 1;
                app.player.setVideoSettings(uitools.getPlayerUtils().videoSettings);
            }
        },
        zoom150: {
            title: _('Zoom to 150%'),
            hotkeyAble: true,
            disabled: function () {
                return !!(uitools.getPlayerUtils().videoSettings.flags & 1);
            },
            checked: function () {
                return (uitools.getPlayerUtils().videoSettings.zoom === 1.5);
            },
            execute: function () {
                uitools.getPlayerUtils().videoSettings.zoom = 1.5;
                app.player.setVideoSettings(uitools.getPlayerUtils().videoSettings);
            }
        },
        zoom200: {
            title: _('Zoom to 200%'),
            disabled: function () {
                return !!(uitools.getPlayerUtils().videoSettings.flags & 1);
            },
            hotkeyAble: true,
            checked: function () {
                return (uitools.getPlayerUtils().videoSettings.zoom === 2);
            },
            execute: function () {
                uitools.getPlayerUtils().videoSettings.zoom = 2;
                app.player.setVideoSettings(uitools.getPlayerUtils().videoSettings);
            }
        },
        zoomIn: {
            title: function () {
                return _('Zoom in');
            },
            disabled: function () {
                return ((uitools.getPlayerUtils().videoSettings.zoom > 4.9) || !!(uitools.getPlayerUtils().videoSettings.flags & 1));
            },
            hotkeyAble: true,
            execute: function () {
                uitools.getPlayerUtils().videoSettings.zoom += 0.1;
                app.player.setVideoSettings(uitools.getPlayerUtils().videoSettings);
            }
        },
        zoomOut: {
            title: function () {
                return _('Zoom out');
            },
            disabled: function () {
                return ((uitools.getPlayerUtils().videoSettings.zoom <= 0.1) || !!(uitools.getPlayerUtils().videoSettings.flags & 1));
            },
            hotkeyAble: true,
            execute: function () {
                uitools.getPlayerUtils().videoSettings.zoom -= 0.1;
                app.player.setVideoSettings(uitools.getPlayerUtils().videoSettings);
            }
        },
        zoomSlider: {
            title: function () {
                return '<div data-id="zoomSlider" data-html="1" data-tip="Change zoom" data-control-class="Slider" data-init-params="{orientation: \'horizontal\', fromZero: true, min: -0.9, max: 4.0, tickPlacement: \'bottomRight\', ticks: [-0.9, 0, 4], step: 0.1, value: ' + (uitools.getPlayerUtils().videoSettings.zoom - 1) + '}" style="width: 20em; height: 1.25em;"></div>';
            },
            disabled: function () {
                return !!(uitools.getPlayerUtils().videoSettings.flags & 1);
            },
            buttonActions: [{
                id: 'zoomSlider',
                events: ['change', 'livechange'],
                execute: function (this: HTMLElement, evtName, evt) {
                    assert(this.controlClass); // @ts-ignore
                    uitools.getPlayerUtils().videoSettings.zoom = this.controlClass.value + 1;
                    app.player.setVideoSettings(uitools.getPlayerUtils().videoSettings);
                    if (evtName === 'change') {
                        return true;
                    } else
                        return false;
                },
            }],
        },
        arOriginal: {
            title: function () {
                return _('Original AR');
            },
            hotkeyAble: true,
            checked: function () {
                return uitools.getPlayerUtils().isThisAR(0, 0);
            },
            execute: function () {
                uitools.getPlayerUtils().setAR(0, 0);
            }
        },
        ar43: {
            title: '4:3',
            checked: function () {
                return uitools.getPlayerUtils().isThisAR(4, 3);
            },
            hotkeyAble: true,
            execute: function () {
                uitools.getPlayerUtils().setAR(4, 3);
            }
        },
        ar54: {
            title: '5:4',
            checked: function () {
                return uitools.getPlayerUtils().isThisAR(5, 4);
            },
            hotkeyAble: true,
            execute: function () {
                uitools.getPlayerUtils().setAR(5, 4);
            }
        },
        ar169: {
            title: '16:9',
            checked: function () {
                return uitools.getPlayerUtils().isThisAR(16, 9);
            },
            hotkeyAble: true,
            execute: function () {
                uitools.getPlayerUtils().setAR(16, 9);
            }
        },
        ar1610: {
            title: '16:10',
            checked: function () {
                return uitools.getPlayerUtils().isThisAR(16, 10);
            },
            hotkeyAble: true,
            execute: function () {
                uitools.getPlayerUtils().setAR(16, 10);
            }
        },
        ar1851: {
            title: '1.85:1',
            checked: function () {
                return uitools.getPlayerUtils().isThisAR(185, 100);
            },
            hotkeyAble: true,
            execute: function () {
                uitools.getPlayerUtils().setAR(185, 100);
            }
        },
        ar2351: {
            title: '2.35:1',
            checked: function () {
                return uitools.getPlayerUtils().isThisAR(235, 100);
            },
            hotkeyAble: true,
            execute: function () {
                uitools.getPlayerUtils().setAR(235, 100);
            }
        },
        move: {
            title: function () {
                return _('Move');
            },
            execute: function () {
                uitools.openDialog('dlgVideoMove', {
                    modal: true
                });
            }
        },
        moveLeft: {
            title: function () {
                return _('Move left');
            },
            hotkeyAble: true,
            execute: function () {
                let pUtils = uitools.getPlayerUtils();
                if (pUtils.videoSettings.moveX >= -99) {
                    pUtils.videoSettings.moveX -= 1;
                    app.player.setVideoSettings(pUtils.videoSettings);
                }
            }
        },
        moveRight: {
            title: function () {
                return _('Move right');
            },
            hotkeyAble: true,
            execute: function () {
                let pUtils = uitools.getPlayerUtils();
                if (pUtils.videoSettings.moveX <= 99) {
                    pUtils.videoSettings.moveX += 1;
                    app.player.setVideoSettings(pUtils.videoSettings);
                }
            }
        },
        moveUp: {
            title: function () {
                return _('Move up');
            },
            hotkeyAble: true,
            execute: function () {
                let pUtils = uitools.getPlayerUtils();
                if (pUtils.videoSettings.moveY >= -99) {
                    pUtils.videoSettings.moveY -= 1;
                    app.player.setVideoSettings(pUtils.videoSettings);
                }
            }
        },
        moveDown: {
            title: function () {
                return _('Move down');
            },
            hotkeyAble: true,
            execute: function () {
                let pUtils = uitools.getPlayerUtils();
                if (pUtils.videoSettings.moveY <= 99) {
                    pUtils.videoSettings.moveY += 1;
                    app.player.setVideoSettings(pUtils.videoSettings);
                }
            }
        },
        resetVideoSettings: {
            title: function () {
                return _('Reset changes');
            },
            execute: function () {
                let vidSett = uitools.getPlayerUtils().videoSettings;
                vidSett.zoom = 1;
                vidSett.aspectRatioX = 0;
                vidSett.aspectRatioY = 0;
                vidSett.moveX = 0;
                vidSett.moveY = 0;
                vidSett.flags = 1;
                app.player.setVideoSettings(vidSett);
            }
        },
        saveThumbnail: {
            title: function () {
                return _('Save thumbnail') + '...';
            },
            hotkeyAble: true,
            execute: function () {
                messageDlg(_('Generate the thumbnail:'), 'Confirmation', [{
                    btnID: 'btnAuto',
                    caption: _('Automatically')
                }, {
                    btnID: 'btnCapture',
                    caption: _('Use current video frame')
                }, 'btnCancel'], {
                    defaultButton: 'btnAuto'
                }, function (result) {
                    if (result.btnID !== 'btnCancel') {
                        app.trackOperation.generateThumbnailAsync(app.player.getCurrentTrack(), (result.btnID === 'btnCapture'));
                    }
                });
            }
        },
        audioStreams: {
            title: function () {
                return _('Audio streams');
            },
            hotkeyAble: false,
            submenu: function () {
                return new Promise(function (resolve, reject) {
                    let streamsList = app.player.prepareAudioStreams();
                    streamsList.whenLoaded().then(function () {
                        if (streamsList.count === 0)
                            resolve(undefined);
                        let retArray: Action[] = [];
                        let focusedIdx = streamsList.focusedIndex;
                        streamsList.forEach(function (txt, index) {
                            retArray.push({
                                title: '' + txt,
                                execute: function () {
                                    app.player.setAudioStream(index);
                                },
                                checked: (index === focusedIdx)
                            });
                        });
                        resolve(retArray);
                    });
                });
            }
        },
        subtitles: {
            title: function () {
                return _('Subtitles');
            },
            hotkeyAble: false,
            submenu: function () {
                return new Promise(function (resolve, reject) {
                    let sett = settings.get('System');
                    let retArray: SubmenuItem[] = [{
                        action: {
                            title: function () {
                                return _('Open file') + '...';
                            },
                            icon: 'openFile',
                            execute: function () {
                                let exts = '*.sub;*.srt;*.smi;*.ssa;*.ass;*.xss;*.psb;*.txt';
                                let sd = app.player.getCurrentTrack();
                                if (!sd)
                                    return;
                                let promise = app.utils.dialogOpenFile(getFileFolder(sd.path), 'srt', _('Subtitle files') + ' (' + exts + ')|' + exts, _('Select subtitle file'), false /* multiselect */);
                                promise.then(function (filename) {
                                    if (filename) {
                                        app.player.updateSubtitlesLanguage(-2, filename);
                                    }
                                }, function () {
                                    // rejected - closed by cancel

                                });
                            },
                            visible: !webApp,
                        },
                        order: 10,
                        grouporder: 10
                    }, {
                        action: {
                            title: function () {
                                return _('Enable');
                            },
                            checkable: true,
                            checked: function () {
                                return sett.System.SubtitlesEnabled;
                            },
                            execute: function () {
                                sett.System.SubtitlesEnabled = !sett.System.SubtitlesEnabled;
                                settings.set(sett, 'System');
                                if (sett.System.SubtitlesEnabled) {
                                    app.player.prepareSubtitlesAsync();
                                } else {
                                    app.player.updateSubtitlesLanguage(-2, ''); // reset
                                }
                            },
                        },
                        order: 20,
                        grouporder: 10
                    }, {
                        action: {
                            title: function () {
                                return _('Size');
                            },
                            submenu: [{
                                action: {
                                    title: function () {
                                        return _('Small');
                                    },
                                    checked: function () {
                                        return (sett.System.SubtitlesSize === 1);
                                    },
                                    execute: function () {
                                        sett.System.SubtitlesSize = 1;
                                        settings.set(sett, 'System');
                                        app.player.updateSubtitlesSettings();
                                    }
                                },
                                order: 10,
                                grouporder: 10
                            }, {
                                action: {
                                    title: function () {
                                        return _('Normal');
                                    },
                                    checked: function () {
                                        return (sett.System.SubtitlesSize === 2);
                                    },
                                    execute: function () {
                                        sett.System.SubtitlesSize = 2;
                                        settings.set(sett, 'System');
                                        app.player.updateSubtitlesSettings();
                                    }
                                },
                                order: 20,
                                grouporder: 10
                            }, {
                                action: {
                                    title: function () {
                                        return _('Large');
                                    },
                                    checked: function () {
                                        return (sett.System.SubtitlesSize === 3);
                                    },
                                    execute: function () {
                                        sett.System.SubtitlesSize = 3;
                                        settings.set(sett, 'System');
                                        app.player.updateSubtitlesSettings();
                                    }
                                },
                                order: 30,
                                grouporder: 10
                            }, {
                                action: {
                                    title: function () {
                                        return _('Extra large');
                                    },
                                    checked: function () {
                                        return (sett.System.SubtitlesSize === 4);
                                    },
                                    execute: function () {
                                        sett.System.SubtitlesSize = 4;
                                        settings.set(sett, 'System');
                                        app.player.updateSubtitlesSettings();
                                    }
                                },
                                order: 40,
                                grouporder: 10
                            }]
                        },
                        order: 10,
                        grouporder: 50

                    }];
                    app.player.prepareSubtitlesAsync().then(function (lists) {
                        if (lists) {
                            if (lists.embeddedList) {
                                lists.embeddedList.forEach(function (txt, index) {
                                    retArray.push({
                                        action: {
                                            title: '' + txt,
                                            execute: function () {
                                                app.player.updateSubtitlesLanguage(index, '');
                                            },
                                            checked: function () {
                                                return (index === lists.embeddedList.focusedIndex);
                                            }
                                        },
                                        order: index * 10,
                                        grouporder: 20
                                    });
                                });
                            }
                            if (lists.fileList) {
                                lists.fileList.forEach(function (txt, index) {
                                    retArray.push({
                                        action: {
                                            title: '' + GetFName('' + txt),
                                            execute: function () {
                                                app.player.updateSubtitlesLanguage(-2, '' + txt);
                                            },
                                            checked: function () {
                                                return (index === lists.fileList.focusedIndex);
                                            },
                                        },
                                        order: index * 10,
                                        grouporder: 30
                                    });
                                });
                            }
                        }
                        resolve(retArray);
                    });
                });
            }
        }
    },

    playNormally: {
        title: function () {
            return _('Play normally');
        },
        visible: function () {
            return app.player.shufflePlaylist;
        },
        disabled: uitools.notMediaListSelected,
        submenu: () => [
            {
                action: actions.playNow,
                order: 10,
                grouporder: 10
            },
            {
                action: actions.playNext,
                order: 20,
                grouporder: 10
            },
            {
                action: actions.playLast,
                order: 30,
                grouporder: 10
            }
        ]
    },

    playShuffled: {
        title: function () {
            return _('Play shuffled');
        },
        icon: 'shuffle',
        visible: function () {
            return !window.settings.UI.hideShuffleGroupCommands && !app.player.shufflePlaylist && (window.settings.UI.canReorder != false);
        },
        disabled: uitools.notMediaListSelected,
        submenu: () => [
            {
                action: actions.playNowShuffled,
                order: 10,
                grouporder: 10
            },
            {
                action: actions.playNextShuffled,
                order: 20,
                grouporder: 10
            },
            {
                action: actions.playMixedShuffled,
                order: 30,
                grouporder: 10
            },
            {
                action: actions.playLastShuffled,
                order: 40,
                grouporder: 10
            }
        ]
    },

    playShuffledByAlbum: {
        title: function () {
            return _('Play shuffled (by Album)');
        },
        icon: 'shuffleByAlbum',
        visible: function () {
            return !window.settings.UI.hideShuffleGroupCommands && (window.settings.UI.canReorder != false);
        },
        disabled: uitools.notMediaListSelected,
        submenu: () => [
            {
                action: actions.playNowShuffledByAlbum,
                order: 10,
                grouporder: 10
            },
            {
                action: actions.playNextShuffledByAlbum,
                order: 20,
                grouporder: 10
            },
            {
                action: actions.playLastShuffledByAlbum,
                order: 40,
                grouporder: 10
            }
        ]
    }
};

export default actions;

declare global {
    var actions: Actions;
}

window.actions = actions;

// hotkeys definition
export class JSHotkeys {
    hotkeyList: HotkeyList;
    private _initialized: boolean;
    constructor() {
        this.hotkeyList = app.hotkeys.getHotkeyList();
        this._initialized = false;
    }
    _addHotkey(hotkey: string, action: string, global?: boolean) {
        if (!global)
            global = false;
        if (!this.hotkeyList.hotkeyDeleted(hotkey, action, global) && !this.hotkeyList.findHotkey(hotkey, global)) {
            let HD = app.hotkeys.newHotkeyData();
            HD.hotkey = hotkey;
            HD.action = action;
            HD.global = global;
            this.hotkeyList.add(HD);
        }
    }
    addHotkey(hotkey, action, global) {
        let _this = this;
        _this.whenLoaded().then(function () {
            _this._addHotkey(hotkey, action, global);
        });
    }
    addDefaultHotkeys() {
        // player actions:
        this._addHotkey('Alt+Enter', 'playNow');
        this._addHotkey('Ctrl+Shift+Enter', 'playNext');
        this._addHotkey('Ctrl+Enter', 'playLast');
        this._addHotkey('Ctrl+P', 'playPause');
        this._addHotkey('Space', 'playPause');
        this._addHotkey('Ctrl+O', 'stop');
        this._addHotkey('Ctrl+B', 'previousFile');
        this._addHotkey('Ctrl+N', 'nextFile');
        this._addHotkey('Media Play', 'play', true);
        this._addHotkey('Media Pause', 'pause', true);
        this._addHotkey('Media Play/Pause', 'playPause', true);
        this._addHotkey('Media Next', 'nextFile', true);
        this._addHotkey('Media Previous', 'previousFile', true);
        this._addHotkey('Media Stop', 'stop', true);
        this._addHotkey('Media Rewind', 'rewind', true);
        this._addHotkey('Media Fast Forward', 'fastForward', true);
        this._addHotkey('Ctrl+Left', 'rewind', false);
        this._addHotkey('Ctrl+Right', 'fastForward', false);
        //this._addHotkey('Volume Up', 'volumeUp'); // do not add volume+ by default (like in MM4 -- in order to not interact with system volume, issue #13365)
        //this._addHotkey('Volume Down', 'volumeDown');
        //this._addHotkey('Ctrl+NUM +', 'speedUp');
        //this._addHotkey('Ctrl+NUM -', 'speedDown');
        this._addHotkey('Esc', 'exitFullscreen', false);

        // tools actions:
        this._addHotkey('Ctrl+F', 'search');
        this._addHotkey('Ctrl+Alt+F', 'advancedSearch');
        this._addHotkey('F3', 'search');
        this._addHotkey('Ctrl+Alt+S', 'sleep');
        this._addHotkey('Ctrl+L', 'autoTag');
        this._addHotkey('Ctrl+Q', 'autoTagFromFilename');
        this._addHotkey('Ctrl+R', 'autoOrganize');
        this._addHotkey('Ctrl+S', 'synchronizeTags');
        this._addHotkey('Shift+Enter', 'trackProperties');
        this._addHotkey('Ctrl+Shift+C', 'convertFiles');
        this._addHotkey('Ctrl+Shift+R', 'ripCD');
        this._addHotkey('Ctrl+Shift+D', 'burnAudioCD');
        this._addHotkey('Ctrl+Shift+P', 'choosePlayer');
        this._addHotkey('Insert', 'scan');
        // edit actions:
        this._addHotkey('Delete', 'remove');
        this._addHotkey('Shift+Delete', 'removePermanent');
        this._addHotkey('Ctrl+A', 'selectAll');
        this._addHotkey('Ctrl+X', 'cut');
        this._addHotkey('Ctrl+C', 'copy');
        this._addHotkey('Ctrl+V', 'paste');
        this._addHotkey('Alt+F5', 'saveNewOrder');
        // view actions:
        this._addHotkey('Ctrl+Alt+P', 'trackProperties');
        this._addHotkey('Ctrl+Alt+M', 'partyMode');
        this._addHotkey('F5', 'view.refresh');
        this._addHotkey('F7', 'collapseTree');
        this._addHotkey('F8', 'goToArtistsNode');
        this._addHotkey('F9', 'goToAlbumsNode');
        this._addHotkey('F12', 'goToPlaylistsNode');
        // history actions:
        this._addHotkey('Alt+Left', 'history.backward');
        //this._addHotkey('Backspace', 'history.backward'); // LS: disabled for new installs (#21088)
        this._addHotkey('Alt+Right', 'history.forward');
        // video actions
        this._addHotkey('Ctrl+F11', 'fullScreen');
        this._addHotkey('Ctrl+Shift+Up', 'video.moveDown');
        this._addHotkey('Ctrl+Shift+Down', 'video.moveUp');
        this._addHotkey('Ctrl+Shift+Left', 'video.moveLeft');
        this._addHotkey('Ctrl+Shift+Right', 'video.moveRight');
        this._addHotkey('NUM +', 'video.zoomIn');
        this._addHotkey('NUM -', 'video.zoomOut');
        this._addHotkey('Ctrl+Shift+1', 'video.arOriginal');
        this._addHotkey('Ctrl+Shift+2', 'video.ar43');
        this._addHotkey('Ctrl+Shift+3', 'video.ar169');
        this._addHotkey('Ctrl+Shift+4', 'video.ar1610');
        this._addHotkey('Ctrl+Alt+T', 'toggleTray', true);
        // rating actions
        this._addHotkey('Alt+NUM -', 'rateSelectedUnknown');
        this._addHotkey('Alt+0', 'rateSelected0');
        this._addHotkey('Alt+1', 'rateSelected1');
        this._addHotkey('Alt+2', 'rateSelected2');
        this._addHotkey('Alt+3', 'rateSelected3');
        this._addHotkey('Alt+4', 'rateSelected4');
        this._addHotkey('Alt+5', 'rateSelected5');
        this._addHotkey('Alt+6', 'rateSelectedHalfStarDown');
        this._addHotkey('Alt+7', 'rateSelectedHalfStarUp');
        this._addHotkey('Ctrl+Alt+NUM -', 'ratePlayingUnknown');
        this._addHotkey('Ctrl+Alt+0', 'ratePlaying0');
        this._addHotkey('Ctrl+Alt+1', 'ratePlaying1');
        this._addHotkey('Ctrl+Alt+2', 'ratePlaying2');
        this._addHotkey('Ctrl+Alt+3', 'ratePlaying3');
        this._addHotkey('Ctrl+Alt+4', 'ratePlaying4');
        this._addHotkey('Ctrl+Alt+5', 'ratePlaying5');
        this._addHotkey('Ctrl+Alt+6', 'ratePlayingHalfStarDown');
        this._addHotkey('Ctrl+Alt+7', 'ratePlayingHalfStarUp');
    }
    getHotkeyData(hotkey: string, global?: boolean) {
        let res = null;
        let list = this.hotkeyList;
        return list.findHotkey(hotkey, global); // do pretty the same as the code below, but is faster
        /*
        var HD;
        list.locked(function () {
            for (i = 0; i < list.count; i++) {
                HD = list.getFastObject(i, HD);
                if (HD.hotkey.toUpperCase() == hotkey.toUpperCase() && (HD.global == global || HD.global)) {
                    res = HD;
                    break;
                }
            }
        });
        return res;
        */
    }
    getAction(actionID): Action | undefined {
        let ar = actionID.split('.'); // can be multi-level,  e.g. actions.view.mediaTree            
        let act: Action | undefined;
        for (let i = 0; i < ar.length; i++) {
            let key = ar[i];
            if (i == 0) {
                act = actions[key];
            } else {
                let parent = act;
                assert(parent, `Action "${actionID}" not found! (problematic key: ${key})`);
                act = parent[key];
                if (act && !act.category)
                    act.category = parent.category;
            }
            if (!act)
                break;
        }
        if (act && act.hotkeyAble && act.submenu && !act.execute) {
            // LS: generate execute() for hotkey-able menu actions (#14635):
            act.execute = function (this: Action) {
                let _showMenuItems = function (menuArray) {
                    let parent = document.activeElement || window.currentTabControl.container;
                    let _menu;
                    _menu = new Menu(menuArray, {
                        onactioncalled: function (params) {
                            if (_menu && (!params || !params.ctrlKey))
                                _menu.close();
                        },
                        parent: parent,
                    });
                    let pos = findScreenPos(parent);
                    _menu.show(pos.left, pos.top);
                };

                let items = this.submenu;
                if (isFunction(items))
                    // @ts-ignore
                    items = items({
                        updateCallback: function (retval) {
                            _showMenuItems(retval);
                        }
                    });
                if (isPromise(items)) {
                    // @ts-ignore
                    items.then(function (retval) {
                        _showMenuItems(retval);
                    });
                } else {
                    _showMenuItems(items);
                }
            };
        }
        return act;
    }
    getActionIcon(act) {
        let icon = resolveToValue(act.icon, '');
        if (icon == '') {
            if (act.category == window.actionCategories.ratingSelected || act.category == window.actionCategories.ratingPlaying)
                icon = 'star';
            if (act.category == window.actionCategories.video)
                icon = 'video';
            if (act.category == window.actionCategories.view)
                icon = 'locate';
        }
        if (icon == '')
            icon = 'none';
        return icon;
    }
    getActionTitleWithCategory(act) {
        let tit = act.hotkeyTitle ? uitools.getPureTitle(resolveToValue(act.hotkeyTitle)) : uitools.getPureTitle(resolveToValue(act.title));
        let cat = act.category;
        if (cat)
            tit = uitools.getPureTitle(resolveToValue(cat)) + ': ' + tit;
        return tit;
    }
    whenLoaded() {
        let _this = this;
        return new Promise(function (resolve, reject) {
            _this.hotkeyList.whenLoaded().then(function () {
                if (!_this._initialized)
                    _this.addDefaultHotkeys();
                _this._initialized = true;
                resolve(undefined);
            });
        });
    }
    assignShortcuts() {
        let _this = this;
        let list = this.hotkeyList;
        _this.whenLoaded().then(function () {
            list.locked(function () {
                let HD;
                for (let i = 0; i < list.count; i++) {
                    HD = list.getFastObject(i, HD);
                    let action = _this.getAction(HD.action);
                    if (action) {
                        action.shortcut = HD.hotkey;
                    }
                }
            });
        });
    }
    register() {
        app.listen(app, 'hotkey', (h) => {
            if (app.hotkeys.getEditMode() == true)
                return; // hotkeys are being edited, do not hit the action right now

            let hotkeyIgnored = false;
            let focusedElement;
            let focusedControl; // @ts-ignore
            if (window.mainMenuButton && (window._mainMenuOpen || (window.mainMenuButton && window.mainMenuButton.controlClass && window.mainMenuButton.controlClass.activemenu))) {
                focusedElement = window.mainMenuButton;
                focusedControl = window.mainMenuButton.controlClass;
            } else {
                focusedElement = document.activeElement;
                focusedControl = elementControl(focusedElement);
            }
            if (focusedControl && focusedControl.ignoreHotkey && focusedControl.ignoreHotkey(h.hotkey))
                hotkeyIgnored = true;
            if (focusedElement && ((focusedElement.nodeName == 'INPUT') || (focusedElement.nodeName == 'TEXTAREA') || (focusedElement.hasAttribute('contenteditable')))) {
                let upKey = h.hotkey.toUpperCase();
                // text edit line is focused, we need to supress all the text edit related hotkeys (Ctrl+A, Spacebar, etc.)
                if (((upKey.indexOf('CTRL') < 0) || (upKey == 'CTRL+A' /* #15953 */) || (upKey == 'CTRL+C') || (upKey == 'CTRL+X') || (upKey == 'CTRL+V') || (upKey == 'CTRL+RIGHT') || (upKey == 'CTRL+LEFT')) &&
                    /*(upKey.indexOf('ALT') < 0) && -- Alt disabled due to #18075 */
                    (upKey.indexOf('WINKEY') < 0) &&
                    (upKey.indexOf('HID') < 0) && (upKey.indexOf('VOLUME') < 0) && (upKey.indexOf('MEDIA') < 0) &&
                    (!inArray(upKey, ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12']))) { // #14964
                    hotkeyIgnored = true;
                }
            }

            if (!hotkeyIgnored) {
                let HD = window.hotkeys.getHotkeyData(h.hotkey, h.global);
                if (HD) {

                    if (HD.hotkey.startsWith('Media ') && inArray(HD.action, ['play', 'pause', 'playPause', 'nextFile', 'previousFile', 'stop']) && (app.hotkeys.getMediaTransferControlInstalled() == true)) {
                        // this check is because of usage of MediaTransferControl in Windows 10, where pressing media key
                        // will simulate click on media button (which is handled elsewhere) -- so that the action is not called twice this way (#14240, #15707)                            
                        ODS('Skipped execution of hotkey action: ' + HD.action + ', ShortCut: ' + HD.hotkey + ', (reason: MediaTransferControl on Win10+ is installed)');
                        return;
                    }

                    ODS('Going to execute hotkey action: ' + HD.action + ', ShortCut: ' + HD.hotkey);
                    let action = this.getAction(HD.action);
                    if (action && action.execute !== undefined) {
                        let disabled = resolveToValue(action.disabled);
                        if (isPromise(disabled)) {
                            disabled.then((res) => {
                                if (!res)
                                    action.execute();
                            });
                        } else
                        if (!disabled)
                            action.execute();
                    }
                }
            } else
                ODS('Skipped execution of hotkey ' + h.hotkey);
        });
        this.assignShortcuts();
    }
}

declare global {
    var hotkeys: JSHotkeys;
}
const hotkeys = new JSHotkeys();
window.hotkeys = hotkeys;

interface MenuSeparator {
    separator: boolean;
    title?: string;
}
declare global {
    var menuseparator: MenuSeparator;
    var _menuItems: {
        reports: MainMenuItem,
        export: MainMenuItem,
        file: MainMenuItem,
        podcasts: MainMenuItem,
        edit: MainMenuItem,
        view: MainMenuItem,
        play: MainMenuItem,
        editTags: MainMenuItem,
        tools: MainMenuItem,
    };
    var mainMenuItems: MainMenuItem[];
}
// might wanna put this var somewhere else
window.menuseparator = {
    separator: true
};

// Main menu definition 
// @ts-ignore  
window._menuItems = window._menuItems || {};

// prepared menu item for library reports implemented by scripts
window._menuItems.reports = {
    action: {
        title: function () {
            return _('Reports');
        },
        submenu: [
        ],
        visible: function () {
            return (window._menuItems.reports.action.submenu.length > 0) && uitools.getCanEdit();
        }
    },
    order: 10,
    grouporder: 40
};
// prepared menu item for library exports implemented by scripts
window._menuItems.export = {
    action: {
        title: function () {
            return _('Export');
        },
        submenu: [],
        visible: function () {
            return (window._menuItems.export.action.submenu.length > 0) && uitools.getCanEdit();
        }
    },
    order: 20,
    grouporder: 40
};


window._menuItems.file = {
    action: {
        title: function () {
            return _('&File');
        },
        visible: () => {
            return !webApp && uitools.getCanEdit();
        },
        submenu: [
            {
                action: actions.openURLorFile,
                order: 10,
                grouporder: 10
            },
            {
                action: actions.scan,
                order: 20,
                grouporder: 10
            },
            {
                action: actions.downloadFile,
                order: 30,
                grouporder: 10
            },
            {
                action: actions.locateMissing,
                order: 40,
                grouporder: 10
            },
            {
                action: actions.maintainLibrary,
                order: 50,
                grouporder: 10
            },
            window._menuItems.reports,
            window._menuItems.export,
            {
                action: actions.quit,
                order: 10,
                grouporder: 50
            }
        ]
    },
    order: 10,
    grouporder: 10,
};

window._menuItems.podcasts = {
    action: {
        title: function () {
            return _('Podcasts');
        },
        icon: 'podcast',
        visible: uitools.getCanEdit,
        submenu: [
            {
                action: actions.subscribePodcast,
                order: 10,
                grouporder: 10
            },
            {
                action: actions.updatePodcasts,
                order: 20,
                grouporder: 10
            },
            {
                action: actions.goToSubscriptions,
                order: 30,
                grouporder: 10
            }
        ]
    },
    order: 30,
    grouporder: 30
};

window._menuItems.edit = {
    action: {
        title: function () {
            return _('&Edit');
        },
        visible: uitools.getCanEdit,
        submenu: [
            {
                action: actions.selectAll,
                order: 10,
                grouporder: 10
            },
            {
                action: actions.cancelSelection,
                order: 20,
                grouporder: 10
            },
            {
                action: actions.cut,
                order: 10,
                grouporder: 20
            },
            {
                action: actions.copy,
                order: 20,
                grouporder: 20
            },
            {
                action: actions.paste,
                order: 30,
                grouporder: 20
            },
            {
                action: actions.newPlaylist,
                order: 10,
                grouporder: 30
            },
            {
                action: actions.newAutoPlaylist,
                order: 20,
                grouporder: 30
            },
            window._menuItems.podcasts,
            {
                action: actions.trackProperties,
                order: 10,
                grouporder: 40
            },
            {
                action: actions.search,
                order: 10,
                grouporder: 50
            },
            {
                action: actions.advancedSearch,
                order: 20,
                grouporder: 50
            },
            {
                action: actions.findMoreFromSame,
                order: 30,
                grouporder: 50
            },
        ]
    },
    order: 20,
    grouporder: 10
};

window._menuItems.view = {
    action: {
        title: function () {
            return _('&View');
        },
        visible: () => {
            return !window.settings.UI.disableRepositioning;
        },
        submenu: [
            {
                action: actions.newTab,
                order: 10,
                grouporder: 10
            },

            {
                action: actions.switchMainMenu,
                order: 990,
                grouporder: 20
            },
            {
                action: actions.switchToolbar,
                order: 999,
                grouporder: 20
            },
            {
                action: actions.optionsLayout,
                order: 999,
                grouporder: 20,
            },

            {
                action: actions.view.visualization,
                order: 10,
                grouporder: 30
            },
            {
                action: actions.partyMode,
                order: 20,
                grouporder: 30
            },
            {
                action: {
                    title: function () {
                        return _('Skin');
                    },
                    submenu: function () {
                        return uitools.getSkins(true);
                    },
                    visible: () => {
                        return !app.inPartyMode;
                    }
                },
                order: 30,
                grouporder: 30
            },
            {
                action: {
                    title: function () {
                        return _('Mode');
                    },
                    submenu: function () {
                        return getLayouts();
                    },
                    visible: () => {
                        return !app.inPartyMode;
                    }
                },
                order: 40,
                grouporder: 30
            },
            {
                action: {
                    title: function () {
                        return _('Main panel view');
                    },
                    visible: function () {
                        // @ts-ignore
                        return (!!window.currentTabControl && !!window.currentTabControl.multiviewControl) && builtInMenu;
                    },
                    submenu: function () {
                        let sub = getMainPanelMenu();
                        // #16702 ... remove cancelSelection action as it is already in Edit menu
                        for (let i = sub.length - 1; i >= 0; i--) {
                            if (sub[i] === actions.cancelSelection) {
                                sub.splice(i, 1);
                                break;
                            }
                        }
                        return sub;
                    },
                },
                order: 50,
                grouporder: 30
            },
            {
                action: {
                    title: function () {
                        return _('Previous');
                    },
                    visible: function () {
                        return (!!window.currentTabControl && !!window.currentTabControl.multiviewControl) && builtInMenu;
                    },
                    disabled: function () {
                        if (window.currentTabControl && window.currentTabControl.multiviewControl) {
                            let history = window.currentTabControl.history;
                            return !(history._currentPos > 0);
                        }
                    },
                    submenu: function () {
                        let menuItems: Action[] = [];
                        let history = window.currentTabControl.history;
                        for (let i = history._currentPos - 1; i >= 0; i--) {
                            let viewData = history._historyItems[i];
                            menuItems.push({
                                title: viewData.title,
                                icon: resolveToValue(viewData.icon),
                                historyPos: i,
                                execute: function () {
                                    history.moveToPosition(this.historyPos);
                                }
                            });
                        }
                        return menuItems;
                    },
                },
                order: 20,
                grouporder: 40
            },
            {
                action: {
                    title: function () {
                        return _('Next');
                    },
                    visible: function () {
                        return (!!window.currentTabControl && !!window.currentTabControl.multiviewControl) && builtInMenu /* will be enabled on OSX once main menu updating is done */;
                    },
                    disabled: function () {
                        if (window.currentTabControl && window.currentTabControl.multiviewControl) {
                            let history = window.currentTabControl.history;
                            return !(history._currentPos < history._historyItems.length - 1);
                        }
                    },
                    submenu: function () {
                        let menuItems: Action[] = [];
                        let history = window.currentTabControl.history;
                        for (let i = history._currentPos + 1; i < history._historyItems.length; i++) {
                            let viewData = history._historyItems[i];
                            menuItems.push({
                                title: viewData.title,
                                icon: resolveToValue(viewData.icon),
                                historyPos: i,
                                execute: function () {
                                    history.moveToPosition(this.historyPos);
                                }
                            });
                        }
                        return menuItems;
                    },
                },
                order: 30,
                grouporder: 40
            },
            {
                action: actions.view.refresh,
                order: 30,
                grouporder: 40
            },
        ]
    },
    order: 30,
    grouporder: 10
};

window._menuItems.play = {
    action: {
        title: function () {
            return _('&Play');
        },
        submenu: [
            {
                action: concatObjects(copyObject(actions.playNow), {
                    visible: () => {
                        if (window.settings.UI.canReorder == false)
                            return false;
                        else
                            return !app.player.shufflePlaylist;
                    }
                }),
                order: 10,
                grouporder: 10
            },
            {
                action: concatObjects(copyObject(actions.playNext), {
                    visible: () =>  {
                        if (window.settings.UI.canReorder == false)
                            return false;
                        else                        
                        if(!app.player.shufflePlaylist)
                            return true;
                        else
                            return notMoreTracksSelectedAsync();
                    }
                }),
                order: 20,
                grouporder: 10
            },
            {
                action: concatObjects(copyObject(actions.playLast), {
                    visible: () =>  {
                        if(!app.player.shufflePlaylist)
                            return true;
                        else
                            return notMoreTracksSelectedAsync();
                    }
                }),
                order: 30,
                grouporder: 10
            },
            {
                action: concatObjects(copyObject(actions.playNowShuffled), {
                    title: function () {
                        return _('Play now') + ' (' + _('shuffled') + ')';
                    },
                    visible: () =>  {
                        if (window.settings.UI.canReorder == false)
                            return false;
                        else
                            return app.player.shufflePlaylist;
                    }
                }),
                order: 10,
                grouporder: 10
            },
            {
                action: concatObjects(copyObject(actions.playNextShuffled), {
                    title: function () {
                        return _('Queue next') + ' (' + _('shuffled') + ')';
                    },
                    visible: () =>  {
                        if (window.settings.UI.canReorder == false)
                            return false;
                        else
                        if(!app.player.shufflePlaylist)
                            return false;
                        else
                            return moreTracksSelectedAsync();
                    }
                }),
                order: 20,
                grouporder: 10
            },
            {
                action: concatObjects(copyObject(actions.playMixedShuffled), {
                    title: function () {
                        return _('Queue mixed') + ' (' + _('shuffled') + ')';
                    },
                    visible: () =>  {
                        if (window.settings.UI.canReorder == false)
                            return false;
                        else
                        if(!app.player.shufflePlaylist)
                            return false;
                        else
                            return moreTracksSelectedAsync();
                    }
                }),
                order: 30,
                grouporder: 10
            },
            {
                action: concatObjects(copyObject(actions.playLastShuffled), {
                    title: function () {
                        return _('Queue last') + ' (' + _('shuffled') + ')';
                    },
                    visible: () =>  {
                        if(!app.player.shufflePlaylist)
                            return false;
                        else
                            return moreTracksSelectedAsync();
                    }
                }),
                order: 40,
                grouporder: 10
            },

            {
                action: actions.playShuffled,
                order: 40,
                grouporder: 10
            },
            {
                action: actions.playShuffledByAlbum,
                order: 50,
                grouporder: 10
            },
            {
                action: actions.playNormally,
                order: 60,
                grouporder: 10
            },

            {
                action: actions.play,
                order: 10,
                grouporder: 20
            },
            {
                action: actions.pause,
                order: 20,
                grouporder: 20
            },
            {
                action: actions.stop,
                order: 30,
                grouporder: 20
            },
            {
                action: actions.stopAfterCurrent,
                order: 40,
                grouporder: 20
            },
            {
                action: actions.previousFile,
                order: 50,
                grouporder: 20
            },
            {
                action: actions.nextFile,
                order: 60,
                grouporder: 20
            },
            {
                action: actions.choosePlayer,
                order: 70,
                grouporder: 20
            },
            {
                action: actions.sleep,
                order: 10,
                grouporder: 30
            },
            {
                action: actions.equalizer,
                order: 20,
                grouporder: 30
            },
            {
                action: actions.speed,
                order: 25,
                grouporder: 30
            },
            {
                action: actions.autoDJ,
                order: 30,
                grouporder: 30
            },
            {
                action: actions.crossfade,
                order: 10,
                grouporder: 40
            },
            {
                action: actions.shuffle,
                order: 20,
                grouporder: 40
            },
            {
                action: actions.repeat,
                order: 30,
                grouporder: 40
            },
            {
                action: actions.normalize,
                order: 40,
                grouporder: 40
            }
        ]
    },
    order: 40,
    grouporder: 10
};

window._menuItems.editTags = {
    action: {
        title: function () {
            return _('Edit tags');
        },
        visible: function () {
            return uitools.getCanEdit() && (window._menuItems.editTags.action.submenu.length > 0);
        },
        submenu: [
            // some items placed by scripts here
            {
                action: actions.synchronizeTags,
                order: 10,
                grouporder: 90
            }, {
                action: actions.cleanID3V1Tags,
                order: 20,
                grouporder: 90
            }, {
                action: actions.cleanID3V2Tags,
                order: 30,
                grouporder: 90
            }, {
                action: actions.cleanID3V1V2Tags,
                order: 40,
                grouporder: 90
            }],
        disabled: notMediaListSelected,
    },
    order: 35,
    grouporder: 10
};

window._menuItems.tools = {
    action: {
        title: function () {
            return _('&Tools');
        },
        visible: uitools.getCanEdit,
        submenu: [
            {
                action: actions.autoOrganize,
                order: 10,
                grouporder: 10
            },
            {
                action: actions.autoTagFromFilename,
                order: 20,
                grouporder: 10
            },
            {
                action: actions.autoTag,
                order: 30,
                grouporder: 10
            },
            window._menuItems.editTags,
            {
                action: actions.ripCD,
                order: 10,
                grouporder: 20
            },
            /*{
                action: actions.burnAudioCD,
                order: 15,
                grouporder: 20
            },*/
            {
                action: actions.convertFiles,
                order: 20,
                grouporder: 20
            },
            {
                action: actions.analyzeVolume,
                order: 10,
                grouporder: 30
            },
            {
                action: actions.levelTrackVolume,
                order: 20,
                grouporder: 30
            },
            {
                action: actions.options,
                order: 10,
                grouporder: 40
            },
            {
                action: actions.extensions,
                order: 20,
                grouporder: 40
            }
        ]
    },
    order: 50,
    grouporder: 10
};

window.mainMenuItems = [
    window._menuItems.file,
    window._menuItems.edit,
    window._menuItems.view,
    window._menuItems.play,
    window._menuItems.tools,
    {
        action: actions.help,
        order: 60,
        grouporder: 10
    },
    {
        action: {
            title: _('MediaMonkey Gold'),
            visible: function () {                
                let info = JSON.parse( app.utils.getGoldStatus());
                if (info.status == 'REGISTERED')
                    return false;
                else
                    return true;
            },
            submenu: [
                {
                    action: {
                        title: _('Get MediaMonkey Gold'),
                        execute: function () {
                            uitools.openWeb(app.utils.registerLink());
                        }
                    },
                    order: 10,
                    grouporder: 10
                },
                {
                    action: actions.enterLicense,
                    order: 20,
                    grouporder: 10
                },
            ],
        },
        order: 70,
        grouporder: 10
    },
    {
        action: {
            title: function () {
                return 'T&est';
            },
            visible: !!app.tests,
            submenu: [
                {
                    action: actions.unitTests,
                    order: 10,
                    grouporder: 10
                },
                {
                    action: actions.bgTests,
                    order: 20,
                    grouporder: 10
                },
            ]
        },
        order: 100,
        grouporder: 10
    }
];

let _limitAlbumTrackRows = false,
    _limitAlbumTrackRowsLoaded = false;

let osxMenu;

Object.defineProperty(window, 'includeSubfoldersInLocations', {
    get: function () {
        // it's tab specific settings now -- see #18909
        if (window.currentTabControl)
            return window.currentTabControl.includeSubfoldersInLocations;
        return false;
    },
    set: function (value) {
        // it's tab specific settings now -- see #18909
        if (window.currentTabControl) {
            if (window.currentTabControl.includeSubfoldersInLocations != value) {
                window.currentTabControl.includeSubfoldersInLocations = value;
                if (actions.includeSubfolders.checkedHandler)
                    actions.includeSubfolders.checkedHandler();
                uitools.actionChangeNotify(actions.includeSubfolders);
            }
        }
    }
});

Object.defineProperty(window, 'limitAlbumTrackRows', {
    get: function () {
        if (!_limitAlbumTrackRowsLoaded) {
            _limitAlbumTrackRows = app.getValue('limitAlbumTrackRows', _limitAlbumTrackRows);
            _limitAlbumTrackRowsLoaded = true;
        }
        return _limitAlbumTrackRows;
    },
    set: function (value) {
        _limitAlbumTrackRows = value;
    }
});

if (isMainWindow) {
    let lastMenuItemID = 0;
    let IDs = [];
    window.osxMenu = undefined;

    // assign identifiers to menu commands
    // @ts-ignore
    window.assignMenuIdentifiers = function (newObj) {
        let hookExecute = function(obj) {
            if (!builtInMenu)
                if (obj.execute && (obj['_old_execute'] == undefined)) {
                    obj['_old_execute'] = obj.execute;
                    obj.execute = function() {
                        // eslint-disable-next-line prefer-spread
                        this['_old_execute'].apply(this, arguments);
                        uitools.refreshMenu();
                    }.bind(obj);
                }
        };
        let browseMenu = function (list) {
            for (let obj in list) {
                let prop = list[obj];
                if (prop && (prop.action || prop.execute)) {
                    if (!prop._identifier) {
                        hookExecute(prop);
                        prop._identifier = ++lastMenuItemID;
                        IDs[prop._identifier] = prop;
                    }
                    if (prop.action && !prop.action._identifier) {
                        hookExecute(prop.action);
                        prop.action._identifier = prop._identifier;
                        IDs[prop.action._identifier] = prop.action;
                    }
                    if (prop.action && (prop.action['submenu'] !== undefined))
                        browseMenu(prop.action['submenu']);
                    else if (prop.execute && (prop['submenu'] !== undefined))
                        browseMenu(prop['submenu']);
                } else
                if (prop instanceof Object)
                    browseMenu(prop);
            }
        };
        if (newObj)
            browseMenu(newObj);
    };
    // @ts-ignore
    assignMenuIdentifiers(mainMenuItems);
    // @ts-ignore
    assignMenuIdentifiers(actions);
    // ****** These methods are used in OSX as handling of system menu ******
    // run menu command by it's ID 
    // @ts-ignore
    window.runFunctionByIdentifier = function (id) {
        if (actions) {
            let item = IDs[id];
            if (item) {
                if (item.execute)
                    item.execute();
                else if (item.action && item.action.execute)
                    item.action.execute();
                else if (item._original) {
                    if (item._original.execute)
                        item._original.execute();
                    else if (item._original.action && item._original.action.execute)
                        item._original.action.execute();
                }
            }
        }
    };
    // @ts-ignore
    window.getMenuSubitemsByIdentifier = function (id) {
        if (actions) {
            let item = IDs[id];
            if (item) {
                return resolveToValue(item.submenu, undefined, item);
            }
        }
    };

    // this is required for backward COM compatibility .. do we really want this when JS script run is supported by COM ?
    // @ts-ignore
    const fileMenuItem = mainMenuItems[0]._identifier,
        // @ts-ignore
        editMenuItem = mainMenuItems[1]._identifier,
        // @ts-ignore
        viewMenuItem = mainMenuItems[2]._identifier,
        // @ts-ignore
        playMenuItem = mainMenuItems[3]._identifier,
        // @ts-ignore
        toolsMenuItem = mainMenuItems[4]._identifier,
        // @ts-ignore
        helpMenuItem = mainMenuItems[5]._identifier;

    // @ts-ignore
    window.getMenuItemByName = function (name) {
        if (name == 'fileMenuItem') return fileMenuItem;
        if (name == 'editMenuItem') return editMenuItem;
        if (name == 'viewMenuItem') return viewMenuItem;
        if (name == 'playMenuItem') return playMenuItem;
        if (name == 'toolsMenuItem') return toolsMenuItem;
        if (name == 'helpMenuItem') return helpMenuItem;
        return -1;
    };

    // @ts-ignore
    window.addCustomMenuItemID = function (ParentItemID, ItemOrder, InSection, nativeObject, submenu) {
        // @ts-ignore
        let menuItem = findMenuItem(ParentItemID, submenu);
        if (menuItem) {
            let obj = {
                action: {
                    nativeObject: nativeObject,
                    title: '',
                    visible: true,
                    execute: function () {
                        customMenuItemClick(this.nativeObject, 0);
                    }
                },
                order: ItemOrder,
                grouporder: InSection,
                _identifier: ++lastMenuItemID,
            };
            if (submenu) {
                if (menuItem.submenu === undefined) {
                    menuItem.submenu = [];
                }
                menuItem.submenu.push(obj);
            } else {
                menuItem._parentList.push(obj);
            }
            return lastMenuItemID;
        }
        return -1;
    };

    // @ts-ignore
    window.findMenuItem = function (itemID) {
        let item: SubmenuItem | null = null;
        let browse = function (list) {
            for (let obj in list) {
                if (list[obj]) {
                    if ((list[obj]._identifier !== undefined) && (list[obj]._identifier == itemID)) {
                        item = list[obj];
                        // @ts-ignore
                        item._parentList = list;
                        break;
                    }
                    if (list[obj].action['submenu'] !== undefined) {
                        browse(list[obj].action['submenu']);
                    }
                }
                if (item) break;
            }
        };
        browse(mainMenuItems);
        return item;
    };
    // end of backward COM compatibility
}

function setAllCollapsed(collapsed) {

    let checkGroupedLV = function (lv) {
        return (lv && lv.controlClass && lv.controlClass.isGroupedView && lv.controlClass.dataSource &&
            lv.controlClass.collapseSupport && lv.controlClass.dataSource.setAllCollapsed);
    };

    // todo: declare that it exports htmlelement with GroupedTracklist
    let getGroupedLV = function () {
        let currentListView = window._lastFocusedLVControl || window.lastFocusedControl;
        if (checkGroupedLV(currentListView)) {
            return currentListView;
        }
        // try to find any visible grouped LV
        let lst = qes(getBodyForControls(), '[data-control-class="GroupedTrackList"]');
        if (lst && lst.length) {
            for (let i = 0; i < lst.length; i++)
                if (isVisible(lst[i]))
                    if (checkGroupedLV(lst[i]))
                        return lst[i];
        }
        return null;
    };

    let currentListView = getGroupedLV(); // @ts-ignore
    if (currentListView && currentListView.controlClass && currentListView.controlClass.groupsRecompute) {
        currentListView.controlClass.dataSource.setAllCollapsed(collapsed); // @ts-ignore
        currentListView.controlClass.groupsRecompute(false, true, true);
    }
}

function deleteSelected(permanent) {
    let lastControl = window.lastFocusedControl;
    if (!uitools.getCanDelete() || !lastControl || !lastControl.controlClass)
        return;

    let lastLVControl = window._lastFocusedLVControl;

    // @ts-ignore    
    if (lastControl.controlClass.deleteSelected && (!lastControl.controlClass.canDeleteSelected || lastControl.controlClass.canDeleteSelected())) { // @ts-ignore
        lastControl.controlClass.deleteSelected(permanent);
        return;
    } else // @ts-ignore 
    if (lastLVControl && lastLVControl.controlClass.deleteSelected && (!lastLVControl.controlClass.canDeleteSelected || lastLVControl.controlClass.canDeleteSelected())) { // @ts-ignore
        lastLVControl.controlClass.deleteSelected(permanent);
        return;
    } else {
        let list = getSelectedTracklist();
        if (list)
            uitools.deleteTracklist(list, permanent);
    }
}

function generateChoosePlayerSubmenu(params): Promise<SubmenuItem[]> {
    return new Promise(function (resolve, reject) {
        let retval = [];
        let apl = app.sharing.getActivePlayer();
        let lst = app.sharing.getAvailablePlayers();

        let _generateItems = () => {
            retval = [];
            lst.forEach(function (player) {

                let _configureMultiZone = () => {
                    uitools.openDialog('dlgMultizone', {
                        modal: true
                    }, function (this: typeof player) {
                        let pl = this;
                        if (pl.players.count > 0)
                            app.sharing.setActivePlayerUUID(pl.uuid);
                        else
                            app.sharing.setActivePlayerUUID(''); // switch to internal player when "no player" is in the multi-zone
                    }.bind(player));
                };

                let item: {
                    title: string,
                    checked: boolean,
                    radiogroup: string,
                    execute: () => void,
                    hotlinkIcon?: string,
                    hotlinkExecute?: () => void;
                } = {
                    title: player.name,
                    checked: (apl && apl.uuid == player.uuid) || (!apl && player.uuid == '' /*internal player*/),
                    radiogroup: 'players',
                    execute: function (this: typeof player) {
                        let pl = this;
                        if (pl.isMultiZone && pl.players && pl.players.count == 0)
                            _configureMultiZone();
                        else
                            app.sharing.setActivePlayerUUID(pl.uuid);
                    }.bind(player),
                };
                if (player.isMultiZone) {
                    item.hotlinkIcon = 'options';
                    item.hotlinkExecute = _configureMultiZone;
                } else
                if (player.uuid != '' /* not internal player*/) {
                    // 'gear' button to configure auto-conversion per #16349
                    item.hotlinkIcon = 'options';
                    item.hotlinkExecute = () => {
                        app.sharing.getClientForPlayerAsync(player).then((item) => {
                            uitools.openDialog('dlgClientConfig', {
                                modal: true,
                                configMode: 'autoConvert',
                                client: item
                            });
                        });
                    };
                } else if (player.uuid === '') {
                    // 'gear' button to configure output plugin, #16554
                    item.hotlinkIcon = 'options';
                    item.hotlinkExecute = () => {
                        app.player.outputPluginConfig();
                    };
                }
                retval.push(item);
            });
        };
        let _last_cnt;
        let _refresh = () => {
            if (_last_cnt != lst.count) {
                _last_cnt = lst.count;
                _generateItems();
                if (params && params.updateCallback)
                    params.updateCallback(retval, true /* to not show loading*/);
            }
        };
        let _lFnc = app.listen(lst, 'change', _refresh);
        requestTimeout(_refresh, 1); // the initial refresh to hide the 'loading...' in case the players are loaded from the last time
        if (params && params.updateCallback)
            params.updateCallback(retval);
        lst.whenLoaded().then(function () {
            app.unlisten(lst, 'change', _lFnc);
            _generateItems();
            resolve(retval);
        });
    });
}

function addToSendToMRUList (mruO) {
    let gs = uitools.globalSettings;
    gs.sendToMRUList = gs.sendToMRUList || [];
    gs.sendToMRUListMax = gs.sendToMRUListMax || 3;
    let idx;
    if (mruO.playlistID !== undefined)
        idx = gs.sendToMRUList.findIndex((o) => (o.playlistID === mruO.playlistID));
    else
        idx = gs.sendToMRUList.findIndex((o) => (o.mainAction === mruO.mainAction) && (o.fullPath === mruO.fullPath));
    if (idx >= 0)
        gs.sendToMRUList.splice(idx, 1);
    gs.sendToMRUList.unshift(mruO);
    if (gs.sendToMRUList.length > gs.sendToMRUListMax)
        gs.sendToMRUList.pop();
}

function handleFolderAction (this: Action, params) {
    // assume always called with this = action
    let act;
    let parAction = params.parentMenuAction || this;
    if (parAction.mainAction === 'move') {
        act = _('Move to') + ' ';
    } else if (parAction.mainAction === 'copy') {
        act = _('Copy to') + ' ';
    } else if (parAction.mainAction === 'convert') {
        act = _('Convert to') + ' ';
    } else {
        act = '';
    }
    addToSendToMRUList({
        title: act + this.fullPath,
        mainAction: this.mainAction,
        icon: this.icon,
        fullPath: this.fullPath
    });
    let selTracks;
    if (params.rootMenuAction && params.rootMenuAction.getTracklist)
        selTracks = params.rootMenuAction.getTracklist();
    else
        selTracks = getSelectedTracklist();
    if (selTracks) {
        selTracks.whenLoaded().then(function (this: Action) {
            let cnt = selTracks.count;
            if (cnt > 0) {
                if ((this.mainAction === 'move') || (this.mainAction === 'copy')) {
                    app.filesystem.renameFilesAsync(selTracks, this.fullPath, {
                        move: (this.mainAction === 'move'),
                        addDB: false
                    });
                } else if (this.mainAction === 'convert') {
                    uitools.openDialog('dlgconvertformat', {
                        modal: true,
                        tracks: selTracks,
                        destinationPath: this.fullPath + app.filesystem.getPathSeparator()
                    });
                }
            }

        }.bind(this));
    }
}

function generateFolderSubmenu(params): Promise<Action[]> {
    return new Promise(function (resolve, reject) {
        let parAction = params.parentMenuAction;
        let retval = [];
        let pathSeparator = app.filesystem.getPathSeparator();
        if (!parAction.fullPath && !parAction.networkResource) {
            app.filesystem.getDriveList().whenLoaded().then(function (lst) {
                lst.forEach(function (drive) {
                    if (drive.driveType != 'optical_drive')
                        retval.push({
                            title: drive.title,
                            icon: 'drive',
                            fullPath: drive.path.slice(0, -1), // remove path separator, not needed here
                            mainAction: parAction.mainAction,
                            submenu: generateFolderSubmenu
                        });
                });

                app.filesystem.getNetworkResourceList().whenLoaded().then(function (list) {                    
                    list.forEach(function (res) {                                        
                        retval.push({
                            title: res.title,
                            icon: 'network',                
                            networkResource: res,
                            mainAction: parAction.mainAction,
                            submenu: generateFolderSubmenu
                        });
                    });
                    resolve(retval);
                });
            });
        } else {
            let act = '';
            let icn = '';
            if (parAction.mainAction === 'move') {
                act = _('Move to') + ' ';
                icn = 'move';
            } else if (parAction.mainAction === 'copy') {
                act = _('Copy to') + ' ';
                icn = 'copy';
            } else if (parAction.mainAction === 'convert') {
                act = _('Convert to') + ' ';
                icn = 'convert';
            }

            retval.push({
                title: act + parAction.title,
                icon: icn,
                fullPath: parAction.fullPath,
                mainAction: parAction.mainAction,
                execute: function () {
                    handleFolderAction.call(this, params);
                },
                grouporder: 10
            });

            if (parAction.networkResource) {
                parAction.networkResource.getChildren().whenLoaded().then(function (list) {                    
                    list.forEach(function (res) {   
                        if (res.getType() == 'networkResource') {                                     
                            retval.push({
                                title: res.title,
                                icon: 'network',                
                                networkResource: res,
                                mainAction: parAction.mainAction,
                                submenu: generateFolderSubmenu
                            });
                        } else {                            
                            retval.push({
                                title: res.title,
                                icon: 'folder',                
                                fullPath: res.path,
                                mainAction: parAction.mainAction,
                                submenu: generateFolderSubmenu
                            });
                        }
                    });
                    resolve(retval);
                });
            } else {        
                app.filesystem.getFoldersList(parAction.fullPath + pathSeparator).then(function (lst) {
                    retval.push({
                        title: _('New folder') + '...',
                        icon: 'add',
                        fullPath: parAction.fullPath + pathSeparator,
                        mainAction: parAction.mainAction,
                        execute: function () {
                            let dlg = uitools.openDialog('dlgInputText', {
                                modal: true,
                                title: _('New folder'),
                                description: _('New folder name'),
                                type: 'text'
                            });
                            dlg.onClosed = () => {
                                if (dlg.modalResult === 1) {
                                    let value = dlg.getValue('getTextInput')();
                                    if (value) {
                                        this.fullPath = this.fullPath + value;
                                        handleFolderAction.call(this, params);
                                    }
                                }
                            };
                            app.listen(dlg, 'closed', dlg.onClosed);
                        },
                        grouporder: 10
                    });
                    lst.locked(function () {
                        for (let i = 0; i < lst.count; i++) {
                            retval.push({
                                title: lst.getValue(i),
                                icon: 'folder',
                                fullPath: parAction.fullPath + pathSeparator + lst.getValue(i),
                                mainAction: parAction.mainAction,
                                submenu: generateFolderSubmenu,
                                grouporder: 20
                            });
                        }
                    });
                    resolve(retval);
                });
            }
        }
    });
}

function generatePlaylistSubmenu(params): Promise<Action[]> {
    return new Promise(function (resolve, reject) {
        let parAction = params.parentMenuAction;
        let retval = [];

        let _addTracksToPlaylist = function (playlist, tracks, isNew?) {
            uitools.showPlaylistEditor(playlist, isNew, 'sendToMenu' /* #17481 */);
            tracks.whenLoaded().then(function () {
                playlist.addTracksAsync(tracks);
            });
        };

        let playlist;

        let handlePlaylistAction = function (this: Action) {
            addToSendToMRUList({
                title: _('Send to') + ' ' + this.fullPath,
                mainAction: this.mainAction,
                icon: 'playlist',
                fullPath: this.fullPath,
                playlistID: this.playlist.id
            });

            let selTracks;
            if (params.rootMenuAction && params.rootMenuAction.getTracklist)
                selTracks = params.rootMenuAction.getTracklist();
            else
                selTracks = getSelectedTracklist();
            if (selTracks)
                _addTracksToPlaylist(this.playlist, selTracks);
        };

        let handleNewPlaylist = async function (this: Action) {
            let newplaylist = this.playlist.newPlaylist();
            newplaylist.name = '- ' + _('New playlist') + ' -'; // #16261 - to be the first in the list after creation
            await newplaylist.commitAsync();
            let selTracks;
            if (params.rootMenuAction && params.rootMenuAction.getTracklist)
                selTracks = params.rootMenuAction.getTracklist();
            else
                selTracks = getSelectedTracklist();
            if (selTracks)
                _addTracksToPlaylist(newplaylist, selTracks, true);
        };

        if (params.parentMenuAction.playlist) {
            playlist = params.parentMenuAction.playlist;
            if (!playlist.isAutoPlaylist) {
                retval.push({
                    action: {
                        title: _('Send to') + ' ' + parAction.title,
                        icon: 'copy',
                        playlist: playlist,
                        mainAction: parAction.mainAction,
                        fullPath: parAction.fullPath,
                        execute: handlePlaylistAction
                    },
                    grouporder: 10
                });
            }
        } else
            playlist = app.playlists.root;

        retval.push({
            action: {
                title: _('Send to') + ' ' + _('New playlist'),
                icon: 'addPlaylist',
                playlist: playlist,
                mainAction: parAction.mainAction,
                execute: handleNewPlaylist
            },
            grouporder: 10
        });

        let lst = playlist.getChildren({
            includeAutoPlaylistsWithChildren: true
        });
        lst.whenLoaded().then(function () {
            let token: AsyncLoopToken = {
                cancel: false,
                __lastTime: 0
            };
            let loop = 0;
            let i = 0;
            asyncLoop(function () {
                loop = 0;
                lst.locked(function () {
                    while ((loop < 50) && (i < lst.count)) {
                        let pl = lst.getValue(i);
                        let act: SubmenuItem = {
                            action: {
                                title: pl.name,
                                playlist: pl,
                                mainAction: parAction.mainAction,
                                icon: 'playlist',
                                fullPath: (parAction.fullPath ? (parAction.fullPath + '/') : '') + pl.name,
                            },
                            grouporder: 20
                        };
                        if (pl.isAutoPlaylist)
                            act.action.icon = 'autoplaylist';
                        if (pl.childrenCount > 0) {
                            act.action.submenu = generatePlaylistSubmenu;
                        } else {
                            act.action.execute = handlePlaylistAction;
                            act.action.hotlinkIcon = 'addPlaylist';
                            act.action.hotlinkExecute = handleNewPlaylist;
                        }
                        retval.push(act);
                        loop++;
                        i++;
                    }
                });
                return (i >= lst.count);
            }, 0, token, function () {
                resolve(retval);
            });
        });
    });
}

function handleSendToMail(this: Action, params) {
    let selTracks;
    if (params.rootMenuAction && params.rootMenuAction.getTracklist)
        selTracks = params.rootMenuAction.getTracklist();
    else
        selTracks = getSelectedTracklist();

    if (selTracks) {
        selTracks.whenLoaded().then(() => {
            let cnt = selTracks.count;
            if (cnt > 0) {
                app.utils.web.sendMail(selTracks);
            }
        });
    }
}

function handleSendToM3U(this: Action, params) {
    let selTracks;
    let title = 'New playlist';
    if (params.rootMenuAction && params.rootMenuAction.getTracklist) {
        selTracks = params.rootMenuAction.getTracklist();
        if (params.rootMenuAction.getNodeTitle)
            title = params.rootMenuAction.getNodeTitle() || title;
    } else
        selTracks = getSelectedTracklist();
    if (selTracks) {
        selTracks.whenLoaded().then(() => {
            let cnt = selTracks.count;
            if (cnt > 0) {
                app.playlists.saveToPlaylistFile(selTracks, app.filesystem.correctFilename(title), title);
            } else {
                uitools.toastMessage.show(_('No tracks found'));
            }
        });
    }
}

function nowplayingEmpty() {
    let nplist = app.player.getSongList();
    return !nplist || (nplist.count === 0);
}

function advTagOperation(operType, action) {
    let selTracks = action.getTracklist();
    if (selTracks) {
        let msg;
        if (operType === 'synchronize') {
            msg = _('This will update the tags of the selected files so that they match your Library. Are you sure you want to proceed?');
        } else {
            msg = sprintf(_('Are you sure you want to remove the %s tag(s) from the selected files (file properties will not be removed from the Library)?'), operType);
        }
        messageDlg(msg, 'Confirmation', ['btnYes', 'btnNo'], {
            defaultButton: 'btnNo'
        }, function (result) {
            if (result.btnID === 'btnYes') {
                selTracks.whenLoaded().then(function () {
                    if (operType === 'synchronize') {
                        app.trackOperation.updateTags(selTracks, true);
                    } else {
                        app.trackOperation.stripID3TagsFromFiles(selTracks, operType);
                    }
                });
            }
        });
    } else {
        uitools.showSelectFilesMsg();
    }
}

function isFocusedPinnedAsync(requiredRes): Promise<boolean> {
    return new Promise(function (resolve) {
        let ds = getSelectedDataSource();
        if (ds) {
            let item = ds.focusedItem;
            if (item) {
                if (item.objectType == 'node' && item.dataSource)
                    item = item.dataSource;
                if (item.objectType == 'playlistentry')
                    item = item.sd;
                if (item && item.isPinned) {
                    //console.log('check pinned');
                    item.isPinned().then(function (res) {
                        resolve(res == requiredRes);
                    });
                    return;
                }
            }
        }
        resolve(false);
    });
}

function pinFocused(doPin) {
    let ds = getSelectedDataSource();
    if (ds) {
        let item = ds.focusedItem;
        if (item) {
            if (item.objectType == 'node' && item.dataSource)
                item = item.dataSource;
            if (item.objectType == 'playlistentry')
                item = item.sd;
            uitools.pinItem(item, doPin);
        }
    }
}