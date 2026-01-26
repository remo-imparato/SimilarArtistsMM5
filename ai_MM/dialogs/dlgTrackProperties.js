/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

//requirejs('controls/tabs');
//requirejs('controls/checkbox');
//requirejs('controls/rating');
//requirejs('controls/dropdown');
//requirejs('controls/popupmenu');
requirejs('helpers/mediaSync');
//requirejs('controls/trackListView');
//requirejs('controls/toastMessage');

window.propertiesTabs = {
    tabBasic: {
        name: _('Basic'),
        order: 10
    },
    tabDetails: {
        name: _('Details'),
        order: 20
    },
    tabClassification: {
        name: _('Classification'),
        order: 30
    },
    tabLyrics: {
        name: _('Lyrics'),
        order: 40
    },
    tabArtwork: {
        name: _('Artwork'),
        order: 50
    },
    tabCustom: {
        name: _('Custom'),
        order: 60
    },
};

let dlgTrackPropertiesOnTrackChange = undefined;
let inOKPromise = 0;
let mainTrackPromise = undefined;
let initialized = false;
let focusedIndex = -1;
/** @type {HTMLInputElement} */
let lastActiveElement = undefined;
let lastCaretPos = undefined;
let trackLocalListeners = []; // removed during track reload and closing

window.trackLocalListen = function (eventObject, eventName, eventMethod, eventCapture) {
    // used for listeners removed during track reload and closing
    trackLocalListeners.push({
        _object: eventObject,
        _name: eventName,
        _capture: eventCapture,
        _method: app.listen(eventObject, eventName, eventMethod, eventCapture),
        unlisten: function () {
            if (this._name) {
                app.unlisten(this._object, this._name, this._method, this._capture);
                this._name = '';
            }
        }
    });
}

let unlistenTrackLocalListeners = function () {
    trackLocalListeners.forEach(function (item) {
        item.unlisten();
    });
    trackLocalListeners = [];
}

window.windowCleanup = function () {
    window.currentTrackPropertiesKey = undefined;
    window.editChanged = undefined;
    window.afterCommitCalls = undefined;
    focusedIndex = -1;
    initialized = false;
    if (mainTrackPromise) {
        cancelPromise(mainTrackPromise);
        mainTrackPromise = undefined;
    };
    unlistenTrackLocalListeners();
    cancelAllAsync();
    window.trackLocalListen = undefined;
    lastActiveElement = undefined;
    window.track = undefined;
    window.tracks = undefined;
    let keys = Object.keys(propertiesTabs);
    for (let i = 0; i < keys.length; i++) {
        let key = keys[i];
        propertiesTabs[key].tabContent = undefined;
    }
    window.propertiesTabs = undefined;
    window.btnOkPressed = undefined;
};

function init(params) {
    this.tracks = params.tracks;
    if (!this.tracks)
        return;

    window._dialogTracks = this.tracks;
    let dialogRoot = qid('dlgTrackProperties');

    let isInPlace = !!resolveToValue(params.inplace, undefined);
    let showToken;
    if (!isInPlace) {
        showToken = getAsyncShowToken(); // get async show token .. dialog will show once this token is called (e.g. dialog is prepared)
    } else
        showToken = undefined;

    if (isInPlace) {
        setVisibility(qeid(dialogRoot, 'bottom'), false);
    }

    localListen(qeid(dialogRoot, 'btnOK'), 'click', function () {
        btnOkPressed().then(function (result) {
            unlistenTrackLocalListeners();
            modalResult = result;
        });
    });

    let btnPrev = qeid(dialogRoot, 'btnPrev');
    let btnNext = qeid(dialogRoot, 'btnNext');

    setVisibility(btnPrev, !isInPlace && (tracks.count === 1));
    setVisibility(btnNext, !isInPlace && (tracks.count === 1));

    let keys = Object.keys(propertiesTabs);
    for (let i = 0; i < keys.length; i++) {
        let tab = propertiesTabs[keys[i]];
        if (tab.order === undefined)
            tab.order = 10 * (i + 1);
    };
    keys.sort(function (i1, i2) {
        let retval = propertiesTabs[i1].order - propertiesTabs[i2].order;
        return retval;
    });
    let tabs = qeid(dialogRoot, 'tabs');
    for (let i = 0; i < keys.length; i++) {
        let key = keys[i];
        let tab = propertiesTabs[key];
        tab.isLoaded = false;
        let t = tabs.controlClass.addTab(tab.name);
        t.setAttribute('data-id', key);
    }
    tabs.controlClass.selectedIndex = 0;

    localListen(qeid(dialogRoot, 'btnCancel'), 'click', function () {
        if (mainTrackPromise) {
            cancelPromise(mainTrackPromise);
            mainTrackPromise = undefined;
        }
        window.cleanUpLocalPromises();
        unlistenTrackLocalListeners();
        cancelAllAsync().then(function () {
            closeWindow();
        });
    });

    let loading = qeid(dialogRoot, 'loading');
    setVisibility(tabs, false);
    setVisibility(loading, true);
    
    qeid(dialogRoot, 'btnOK').controlClass.disabled = true;
    window.isAccessible = false;

    let continueRun = function () {

        if (window._cleanUpCalled)
            return;

        let dialogRoot = qid('dlgTrackProperties');
        let loading = qeid(dialogRoot, 'loading');
        let tabs = qeid(dialogRoot, 'tabs');
        let _propertiesDlg = isInPlace ? inPlaceDialog() : this;

        if (!this.tracks.count) {
            messageDlg(_('Please select one or more files for this operation.'), 'Information', ['btnOK'], {
                defaultButton: 'btnOK'
            }, function (result) {
                _propertiesDlg.closeWindow();
            });
            return;
        }
        let gspromise = undefined;
        let ttpromise = undefined;

        if (this.tracks.count > 1) {
            title = _('Edit Properties for multiple files');
            this.isGroup = true;
            mainTrackPromise = new Promise(function (resolve, reject) {
                gspromise = app.trackOperation.groupSongsData(this.tracks);
                gspromise.then(function (gtrack) {
                    gspromise = undefined;
                    ttpromise = app.trackOperation.getTrackTypeGroup(this.tracks); // to check if we will use mixed track type or track type of the first track, if all of the same category
                    ttpromise.then(function (ttg) {
                        ttpromise = undefined;
                        this.ttGroup = ttg;
                        // for group test decide based on the first selected track
                        this.tracks.locked(function () {
                            this.tracks.getValue(0).isAccessibleAsync().then((res) => {
                                window.isAccessible = !!res;
                                resolve(gtrack);
                            });
                        }.bind(this));
                    }.bind(this), function () {
                        ttpromise = undefined;
                    })
                }.bind(this), function () {
                    gspromise = undefined;
                })
            }.bind(this));
        } else {
            title = _('File Properties');
            this.isGroup = false;
            this.ttGroup = undefined;
            mainTrackPromise = new Promise(function (resolve, reject) {
                // doesn't need to be anything async for single track ATM
                let tr0 = undefined;
                this.tracks.locked(function () {
                    tr0 = this.tracks.getValue(0);
                }.bind(this));
                title = _('File Properties') + ' - ' + utils.getFilename(tr0.path);
                tr0.isAccessibleAsync().then((res) => {
                    window.isAccessible = !!res;
                    resolve(tr0);
                });
            }.bind(this));
        }

        mainTrackPromise.then(function (track) {
            mainTrackPromise = undefined;
            this.track = track;
            window.settings.UI.restore(); // might not be called for shared dialog windows
            window.isReadOnly = !window.uitools.getCanEdit();

            // set read only for online tracks not present in library
            let testTrack;
            if (this.isGroup) {
                // for group test decide based on the first selected track
                this.tracks.locked(function () {
                    testTrack = this.tracks.getValue(0);
                }.bind(this));
            } else {
                testTrack = this.track;
            }
            if ((testTrack.idsong <= 0) && (!window.isReadOnly)) {
                window.isReadOnly = (isURLPath(testTrack.path) && !mediaSyncDevices.isModifiableTrack(testTrack)) || _utils.isOnlineTrack(testTrack);
            }
            if (!window.isAccessible) {
                uitools.toastMessage.show(sprintf(_('File %s is inaccessible'), testTrack.path));
            }

            if (!initialized) {
                localListen(tabs, 'change', function () {
                    loadTab(tabs.controlClass.selectedTab);
                });
            }
            let key = 'tabBasic';
            if (window.currentTrackPropertiesKey)
                key = window.currentTrackPropertiesKey;
            // update all tabs except current (it will be updated later)
            for (let prop in propertiesTabs) {
                if (prop != key)
                    if (propertiesTabs[prop].isLoaded) {
                        loadTab(prop);
                    }
            }

            loadTab(key);
            if (params.selectTab)
                tabs.controlClass.selectedTab = params.selectTab;

            if (!window.isReadOnly && !initialized) {
                let seltype = qeid(dialogRoot, 'typeSelect');
                localListen(seltype, 'change', typeChanged.bind(this));
            }
            if(loading) {
                loading.remove(); // to be sure, animated SVG will not animate as hidden, #21030
                loading = undefined;
            }
            setVisibility(tabs, true, {
                animate: false
            });
            if (!window.isReadOnly)
                qeid(dialogRoot, 'btnOK').controlClass.disabled = false;
            this.modified = false;
            this.coversModified = false;
            this.tagModified = false;
            this.extendedTagsDeleted = false;
            window.dialogInitialized = true;
            window.reloadingProperties = false;
            if (!initialized && !isInPlace && (this.tracks.count === 1) && params.allTracks) {
                let updateButtons = function () {
                    if (btnPrev && btnPrev.controlClass)
                        btnPrev.controlClass.disabled = (focusedIndex <= 0);
                    if (btnNext && btnNext.controlClass)
                        btnNext.controlClass.disabled = ((focusedIndex < 0) || (focusedIndex === (params.allTracks.count - 1)));
                };

                let fixFocusedIndex = function () {
                    focusedIndex = this.tracks.focusedIndex;
                    if (focusedIndex === -1) {
                        this.tracks.locked(function () {
                            let track = this.tracks.getValue(0);
                            let idx = params.allTracks.indexOf(track);
                            if (idx >= 0) {
                                focusedIndex = idx;
                            }
                        }.bind(this));
                    }
                }.bind(this);

                lastActiveElement = undefined;
                lastCaretPos = undefined;

                let applyNewTrack = function (newIdx) {
                    focusedIndex = newIdx;
                    let ds = params.allTracks;
                    let l = ds.getEmptyList();
                    ds.locked(function () {
                        let item = ds.getValue(focusedIndex);
                        if (item) {
                            l.add(item);
                        } else
                            focusedIndex = ds.count - 1;
                    });
                    let lastFocusedIndex = focusedIndex;
                    if (ds.getParentListLink) {
                        let dsP = ds.getParentListLink();
                        if (dsP) {
                            dsP = dsP.get();
                            if (dsP)
                                ds = dsP; // update selection for parent list, if present, it means, allTracks is only temporal copy (used for NP list)
                        }
                    }
                    ds.modifyAsync(() => {
                        if ((lastFocusedIndex !== focusedIndex) || (window._cleanUpCalled))
                            return;
                        ds.focusedIndex = focusedIndex;
                        ds.clearSelection();
                        if ((focusedIndex < ds.count) && (focusedIndex >= 0)) {
                            ds.setSelected(focusedIndex, true);
                        }
                    });
                    l.notifyLoaded();
                    reloadTracks(l);
                    updateButtons();
                }

                let setLastActiveElement = function () {
                    lastActiveElement = document.activeElement;
                    // #20016: selectionStart can be null (& not undefined) if lastActiveElement is a type which does not support selection, e.g. checkbox
                    if (lastActiveElement.selectionStart !== null)
                        lastCaretPos = lastActiveElement.selectionStart;
                };

                // active element has to be catched before 'click', so it is not already blurred
                window.localListen(btnPrev, 'mousedown', setLastActiveElement);
                window.localListen(btnNext, 'mousedown', setLastActiveElement);
                window.localListen(btnPrev, 'touchstart', setLastActiveElement);
                window.localListen(btnNext, 'touchstart', setLastActiveElement);

                let movePrev = () => {
                    fixFocusedIndex();
                    applyNewTrack(Math.max(focusedIndex - 1, 0));
                };

                let moveNext = () => {
                    fixFocusedIndex();
                    applyNewTrack(Math.min(focusedIndex + 1, params.allTracks.count - 1));
                };

                window.localListen(window, 'keydown', function (e) {
                    if (e.altKey && e.keyCode == 37 /* left */ ) {
                        movePrev();
                        e.preventDefault();
                        e.stopPropagation();
                    } else if (e.altKey && e.keyCode == 39 /* right */ ) {
                        moveNext();
                        e.preventDefault();
                        e.stopPropagation();
                    }
                }, true);

                window.localListen(btnPrev, 'click', function () {
                    movePrev();
                });
                window.localListen(btnNext, 'click', function () {
                    moveNext();
                });
                localPromise(params.allTracks.whenLoaded()).then(function () {
                    fixFocusedIndex();
                    updateButtons();
                });
                updateButtons();
            }

            if (lastActiveElement && isVisible(lastActiveElement)) {
                lastActiveElement.focus();
                if (lastCaretPos !== undefined) {
                    requestTimeout(function () {
                        // #20016: lastActiveElement.selectionStart cannot be set if the input type does not support it; if it is not supported, selectionStart === null
                        if (lastActiveElement && (lastActiveElement.selectionStart !== null) && (lastCaretPos !== undefined)) {
                            lastActiveElement.selectionStart = lastCaretPos;
                            lastActiveElement.selectionEnd = lastCaretPos;
                        }
                    }, 25); // need to wait a little bit, so edit is really already filled by value, not elegant, but it would be complicated to do it more reliably, #18082
                }
            };

            if (!isInPlace && !initialized)
                showToken(); // show dialog

            initialized = true;
        }.bind(this), function () {
            if (gspromise)
                cancelPromise(gspromise);
            if (ttpromise)
                cancelPromise(ttpromise);
        });
    }.bind(this);

    this.reloadTracks = function (newTracks) {
        btnOkPressed().then(function () {
            window.afterCommitCalls = undefined;
            this.tracks = newTracks;
            window.currentTrackPropertiesKey = '';
            window.reloadingProperties = true;
            window.cleanUpLocalPromises();
            unlistenTrackLocalListeners();
            continueRun();
        }.bind(this));
    }.bind(this);

    if (this.tracks.isLoaded)
        continueRun();
    else
        this.tracks.whenLoaded().then(function () {
            continueRun();
        });
}

function reloadDialog(tracks) {
    if (qid('dlgTrackProperties') && this.reloadTracks)
        this.reloadTracks(tracks);
}

function cleanUp() {
    return new Promise(function (resolve) {
        btnOkPressed().then(function (result) {
            window.currentTrackPropertiesKey = undefined;
            let dialogRoot = qid('dlgTrackProperties');
            qeid(dialogRoot, 'tabs').controlClass.clearTabs();
            for (let prop in propertiesTabs)
                propertiesTabs[prop].isLoaded = false;
            window.afterCommitCalls = undefined;
            unlistenTrackLocalListeners();
            modalResult = result;
            resolve();
        });
    });
}

function loadTab(key) {
    if (window.currentTrackPropertiesKey == key)
        return;

    let dialogRoot = qid('dlgTrackProperties');
    let c = propertiesTabs[key].tabContent;
    if (c && !document.body.contains(c))
        propertiesTabs[key].isLoaded = false;

    window.currentTrackPropertiesKey = key;

    if (!propertiesTabs[key].isLoaded) {
        // load layout:
        let contentDiv = document.createElement('div');
        contentDiv.innerHTML = window.loadFile('file:///dialogs/dlgTrackProperties/' + key + '.html');
        let tabContent = contentDiv.lastElementChild; // LS: use lastElementChild as the first could be <script type="module"> added for custom tabs (ResourceLoader.internalLoadFile)
        qeid(dialogRoot, 'tabs').controlClass.setTabPanel(key, tabContent);

        initializeControls(tabContent);
        if (window.isReadOnly) {
            forEach(qes(tabContent, 'input,textarea,label'), function (control) {
                control.setAttribute('readonly', true);
                control.setAttribute('data-disabled', '1'); // #20855
            });
            forEach(qes(tabContent, '[data-control-class]'), function (control) {
                control.setAttribute('data-init-params', '{"readOnly": true}');
                if (control.controlClass)
                    control.controlClass.disabled = true; // #20855
            });
        }

        // load values:
        requirejs('dialogs/dlgTrackProperties/' + key + '.js');
        window.editChanged = editChanged;
        propertiesTabs[key].tabContent = tabContent;
    }

    let tabContent = propertiesTabs[key].tabContent;

    let chbs = qes(tabContent, '[data-group-only] input[type="checkbox"]');
    let el;
    for (let i = 0; i < chbs.length; i++) {
        setVisibility(chbs[i], window.isGroup && !window.isReadOnly);
    };

    if (!propertiesTabs[key].isLoaded || window.reloadingProperties) {
        propertiesTabs[key].load(track, window /* dialog */ );
        propertiesTabs[key].isLoaded = true;
    }
    updateVisibility();

    if (!window.isReadOnly) {
        // set change event after initial values are filled, so initialization does not count to changes
        let edits = qes(tabContent, '.innerDlg .dropdown, .innerDlg .rating');
        for (i = 0; i < edits.length; i++) {
            if (edits[i].getAttribute('data-id') !== 'typeSelect') // type selection handled elsewhere
                localListen(edits[i], 'change', editChanged.bind(window));
        }
        // for edits and textarea use input event, so it is called immediately after user input and not only after focus change
        edits = qes(tabContent, '.innerDlg .edit, textarea');
        for (i = 0; i < edits.length; i++) {
            localListen(edits[i], 'input', editChanged.bind(window));
        }
    }
}

function editChanged(evt) {
    if (window._loadingValues)
        return; // #16388
    this.modified = true;
    if (evt.currentTarget) {
        let el = evt.currentTarget;
        if (!el.controlClass || !el.controlClass.noTagModify)
            window.tagModified = true;
        if (this.isGroup) {
            let dialogRoot = qid('dlgTrackProperties');
            let id = el.getAttribute('data-id');
            let chb = qeid(dialogRoot, 'chb_' + id);
            if (chb)
                chb.controlClass.checked = true;
        };
    }
}

function typeChanged(evt) {
    if (window._loadingValues) {
        updateVisibility(); // #16858
        return; // #16388
    }
    window.modified = true;
    if (window.isGroup) {
        let dialogRoot = qid('dlgTrackProperties');
        let seltype = qeid(dialogRoot, 'typeSelect');
        let chbtype = qeid(dialogRoot, 'chb_typeSelect');
        if (seltype.controlClass.focusedIndex === (seltype.controlClass.dataSource.count - 1)) {
            // mixed
            chbtype.disabled = true;
            chbtype.controlClass.checked = false;
        } else {
            chbtype.disabled = false;
            chbtype.controlClass.checked = true;
        }
    }
    updateVisibility();
}

function setControlsDisplay(ctrls, disp) {
    let cntrl;
    disp = disp || '';
    let dialogRoot = qid('dlgTrackProperties');
    forEach(ctrls, function (c) {
        cntrl = qeid(dialogRoot, c);
        if (cntrl)
            cntrl.style.display = disp;
        if (c.substring(0, 3) !== 'tr_') {
            cntrl = qeid(dialogRoot, 'lbl_' + c);
            if (cntrl) {
                cntrl.style.display = disp;
                let pctrl = cntrl.parentNode;
                if (pctrl) {
                    let pctrlid = pctrl.getAttribute('data-id');
                    if (pctrlid && (pctrlid.substring(0, 2) === 'p_')) {
                        pctrl.style.display = disp;
                    }
                }
            }
            cntrl = qeid(dialogRoot, 'chb_' + c);
            if (cntrl) {
                cntrl.style.display = disp;
                pctrl = cntrl.parentNode;
                if (pctrl) {
                    let pctrlid = pctrl.getAttribute('data-id');
                    if (pctrlid && (pctrlid.substring(0, 2) === 'p_')) {
                        pctrl.style.display = disp;
                    }
                }
            }
        }
    });
}

function updateVisibility() {
    localPromise(track.getTrackTypeAsync()).then(function (tt) { // to be sure, we have trackType initialized    
        let dialogRoot = qid('dlgTrackProperties');
        let ttt = app.utils.text2TrackType(qeid(dialogRoot, 'typeSelect').controlClass.value);

        if ((ttt < 0) && (this.ttGroup !== undefined) && (this.ttGroup >= 0) && (this.ttGroup < 9)) { // #18081
            ttt = this.ttGroup;
        };

        let trackType = app.utils.getTypeStringId(ttt);

        window.hideControls = function (ctrls) {
            setControlsDisplay(ctrls, 'none')
        }

        window.showControls = function (ctrls) {
            setControlsDisplay(ctrls, '')
        }

        let keys = Object.keys(propertiesTabs);
        for (let i = 0; i < keys.length; i++) {
            let key = keys[i];
            if (propertiesTabs[key].updateVisibility && propertiesTabs[key].isLoaded)
                propertiesTabs[key].updateVisibility(trackType, window /* dialog */ , ttt);
        }
        notifyLayoutChange();
    });
}

window.btnOkPressed = function() {
    if (++inOKPromise === 1) {
        return new Promise(function (resolve) {
            let myResolve = function (param) {
                inOKPromise--;
                resolve(param);
            };
            if (window.isGroup) {
                let dialogRoot = qid('dlgTrackProperties');
                // for group edit, decide "modified" based on checked checkboxes only
                let chbs = qes(dialogRoot, '[data-control-class="Checkbox"]');
                window.modified = false;
                window.tagModified = false;
                let el;
                for (let i = 0; i < chbs.length; i++) {
                    el = chbs[i];
                    if (el.controlClass.checked) {
                        window.modified = true;
                        if (!el.controlClass.noTagModify)
                            window.tagModified = true;
                        if (window.tagModified)
                            break;
                    }
                };
            }
            if (window.modified || window.coversModified || window.extendedTagsDeleted) {
                if (window.isGroup) {
                    let sett = window.settings.get('System');
                    if ((window.tracks.count <= 50) || (!sett.System.AskUserMassEdit)) {
                        saveTracks(window.tracks).then(function () {
                            myResolve(1);
                        });
                        return;
                    }

                    let msg = sprintf(_('Are you sure that you want to modify %d files ?'), window.tracks.count);
                    messageDlg(msg, 'Confirmation', ['btnYes', 'btnNo'], {
                        defaultButton: 'btnNo',
                        chbCaption: _('In the future, do not ask me'),
                        checked: false
                    }, function (result) {
                        if (result.btnID === 'btnYes') {
                            if (result.checked) {
                                sett.System.AskUserMassEdit = false;
                                window.settings.set(sett, 'System');
                            }
                            cancelPromise(window.track.coverList.whenLoaded()); // to cancel covers grouping in trackOperation.groupSongsData

                            // save TrackList
                            saveTracks(window.tracks).then(function () {
                                myResolve(1);
                            });
                        } else {
                            myResolve(0);
                        }
                    });
                } else {
                    saveTrack(window.track).then(function () {
                        window.track.commitAsync({
                            tagModified: window.tagModified || window.coversModified || window.extendedTagsDeleted
                        }).then(function () {
                            if (window.afterCommitCalls) {
                                forEach(window.afterCommitCalls, function (cbk) {
                                    if (isFunction(cbk))
                                        cbk();
                                })
                            }
                            myResolve(1);
                        });
                    });
                }
            } else {
                myResolve(0);
            }
        });
    } else {
        return new Promise(function (resolve) {
            inOKPromise--;
            resolve();
        });
    }
}

function saveTracks(tracks) {
    return new Promise(function (resolve, reject) {
        let groupTrack = app.utils.createTrackGroupData();
        saveTrack(groupTrack).then(function () {
            app.utils.assignGroupData2ListAsync(groupTrack, tracks, true /*with save*/ , window.tagModified || window.coversModified || window.extendedTagsDeleted, !!window.applyArtworkToAlbum).then(function () {
                resolve();
            });
        });
    });
};

function saveTrack(track) {
    track.beginUpdate();
    track.dirtyModified = true;
    let promiseArray = [];
    let keys = Object.keys(propertiesTabs);
    for (let i = 0; i < keys.length; i++) {
        let key = keys[i];
        if (propertiesTabs[key].isLoaded) {
            promiseArray.push(propertiesTabs[key].saveAsync(track, window /* dialog */ ));
        }
    }
    return new Promise(function (resolve, reject) {
        whenAll(promiseArray).then1(function () {
            track.endUpdate();
            resolve();
        });
    });
};

function cancelAllAsync() {
    let promiseArray = [];
    let track = window.track;
    if (track) {
        let keys = Object.keys(propertiesTabs);
        for (let i = 0; i < keys.length; i++) {
            let key = keys[i];
            let tab = propertiesTabs[key];
            if (tab.isLoaded && tab.cancelAsync) {
                promiseArray.push(tab.cancelAsync(track, window /* dialog */ ));
            }
        }
        if (window.isGroup)
            cancelPromise(track.coverList.whenLoaded()); // to cancel covers grouping in trackOperation.groupSongsData
    };
    return new Promise(function (resolve, reject) {
        whenAll(promiseArray).then1(function () {
            resolve();
        });
    });
};

window.beforeWindowCleanup = function () {
    let keys = Object.keys(propertiesTabs);
    for (let i = 0; i < keys.length; i++) {
        let key = keys[i];
        let tab = propertiesTabs[key];
        if (tab.isLoaded && isFunction(tab.beforeWindowCleanup)) {
            tab.beforeWindowCleanup();
        }
    }
}
