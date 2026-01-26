/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

registerFileImport('mainContent');


requirejs('controls/listview');
requirejs('controls/popupmenu');
requirejs('controls/toastMessage');
requirejs('helpers/cloudServices');
requirejs('helpers/windowsCache');
requirejs('playerUtils');
requirejs('tabsUtils');
requirejs('actions');
requirejs('utils');



whenReady(function () {
    if (!builtInMenu) {
        app.listen(window.thisWindow, 'scriptsLoaded', () => {
            uitools.refreshMenu();
        });
    }

    // Here you can register any custom panels user can use in customized layout (must be registered before initializeTabs!!)
    uitools.getDocking().registerDockableControl('LyricsWindow', '', 'Lyrics', 'lyricsWindow', '', 'left,right');

    window.maintoolbar = qid('contexttoolbuttons').controlClass; // Note: Added in 5.0.1
    window.viewtoolbar = qid('viewtoolbuttons').controlClass;
    window.tabsUtils.initializeNavbar();
    window.tabsUtils.initializeTabs();
    uitools.switchMainMenu(app.getValue('mainMenuAlwaysVisible', true));

    // Sidebar buttons
    var btn = qid('showSidebarLeft');
    if (btn) {
        app.listen(btn, 'click', function (e) {
            if (!resolveToValue(actions.view.leftPanel.disabled, false))
                actions.view.leftPanel.execute();
        });
        if (window.settings.UI.disableRepositioning /* || window.isTouchMode*/ )
            setVisibility(btn, false);
        actions.view.leftPanel.updateButtonLabel();
    }
    btn = qid('showSidebarRight');
    if (btn) {
        app.listen(btn, 'click', function (e) {
            if (!resolveToValue(actions.view.rightPanel.disabled, false))
                actions.view.rightPanel.execute();
        });
        if (window.settings.UI.disableRepositioning /* || window.isTouchMode*/ )
            setVisibility(btn, false);
        actions.view.rightPanel.updateButtonLabel();
    }
    
    setTimeout(() => {      
        // LS: moved to short timeout, because maximizing window seems to take some time, 
        //    is there a better way/event to catch when maximization is done? (#19827)
        if (thisWindow.maximized)
            window.uitools.restoreUIState();
    }, 1000);    
    window.uitools.restoreUIState(); // #20313    
    
    if (app.gotoPartyMode) {       
        app.gotoPartyMode = false;
        window.actions.partyMode.execute();
    }

    app.listen(thisWindow, 'closequery', function (token) {
        window.appIsClosing = true;
        if (app && app.player) {
            token.asyncResult = true;
            app.player.stopAsync().then(async function () {
                window.stopFullWindowMode();
                playerUtils.unregisterVideoPlayer();
                token.resolved();
            });
        }
    });
    app.listen(thisWindow, 'closed', function (token) {
        if (window.forceClose)
            return;
        window.uitools.storeUIState();
        var wplist = qs('[data-videoWindowed]');
        var videoParent = undefined;
        if (wplist && (wplist.length > 0))
            videoParent = wplist[0];
        if (videoParent) {
            cleanElement(videoParent);
        }
    });

    window.playerUtils.initialize();

    app.listen(document.body, 'keyup', function (e) {
        if (window._cleanUpCalled)
            return;

        if (window.mainMenuButton) {
            var key = friendlyKeyName(e);
            if (key == 'Alt' && !e.ctrlKey && !e.shiftKey) {
                // 'Alt' should activate/focus menu bar
                var actEl = document.activeElement;
                var editing = (actEl && ((actEl.nodeName == 'INPUT') || (actEl.hasAttribute('contenteditable')) || actEl.classList.contains('ratingCanvas')));
                if (!editing && window.lastKeyDown && !window.lastKeyDown.ctrlKey && !window.lastKeyDown.shiftKey) { // e.g. when Alt+Shift is pressed to switch keyboard during editing (#15128)
                    var lastK = friendlyKeyName(window.lastKeyDown);
                    // Take only single letters (e.g. Alt+F was pressed to open the 'File' menu)
                    // otherwise Alt+Left is used for navigation back (history.backward), Alt+Tab is used for switching windows, Alt+Enter for playback (#17856)
                    // Alt+Down to open popup in Grid (#20798)                    
                    if (Number(lastK) > 0)
                        return; // Alt+5 is used for rating selected
                    if (lastK.length == 1 || lastK == 'Alt') {
                        if (lastK != 'Alt')
                            window.mainMenuButton.controlClass.setTemporalFocus(window.lastKeyDown); // e.g. when Alt+F was pressed to open the 'File' menu
                        else
                            window.mainMenuButton.controlClass.setTemporalFocus();
                    }
                }
            }
        }
    });

    var searchBar = qe(document.body, '[data-control-class="SearchBar"]');
    app.listen(document.body, 'keydown', function (e) {
        if (window._cleanUpCalled)
            return;

            window.lastKeyDown = e;
        
        if (searchBar) {
            var searchSett = app.getValue('search_settings', {});
            if (searchSett.ignoreTypingInView)
                return;

            var ignore = window.isMenuVisible();
            var actEl = document.activeElement;
            if (actEl && ((actEl.nodeName == 'INPUT') || (actEl.nodeName == 'TEXTAREA') || (actEl.hasAttribute('contenteditable'))))
                ignore = true;
            if (!ignore && isSingleCharKey(e) && !e.ctrlKey && !e.altKey /*&& !e.shiftKey */ ) { // shift is needed for capitals (#15106 / 11)

                if (e.shiftKey) { // shift is needed for capitals (#15106 / 11)                    
                    if (window.hotkeys && window.hotkeys.getHotkeyData('Shift+' + window.friendlyKeyName(e)))
                        return; // #18628: Shift+Character Hotkey also executes as character
                } else {
                    if (window.hotkeys && window.hotkeys.getHotkeyData(window.friendlyKeyName(e)))
                        return; // #19475: Contextual search shouldn't override hotkeys
                }

                // start active list searching (Filter matches / Scroll to match) on key down:
                searchBar.controlClass.comeIn({
                    searchType: 'activelist',
                    focus: true
                });
            }
        }
    });
    document.body.accessKey = '\r'; // LS: hack to supress 'Default beep' sound after pressing Alt+Enter (details in #17856)

    app.listen(qid('searchBarBlankShortcut'), 'click', () => {
        window.actions.search.execute(); // to bring up hidden search bar (per #17113)
    });

    app.listen(document.body, 'mouseup', (e) => {
        // #16406        
        if (e.button === 3) { // "Browser Back" mouse button
            actions.history.backward.execute();
            e.preventDefault();
            e.stopPropagation();
        }

        if (e.button === 4) { // "Browser Forward" mouse button
            actions.history.forward.execute();
            e.preventDefault();
            e.stopPropagation();
        }
    }, true);

    // hide switchPlayer button in toolbar when non-bordered skin is active (it has the switch in header)
    if (headerClass) {
        setVisibilityFast(qid('switchButton'), false);
    }

    // initialize visualization, if player is already playing (e.g. after skin change)    
    var player = app.player;
    if (player.visualization.active && player.isPlaying && !player.paused) {
        var sd = app.player.getFastCurrentTrack(sd);
        if (sd && !sd.isVideo && !_utils.isOnlineTrack(sd)) {
            var attemptCounter = 0;
            var initVis = function () {
                requestTimeout(function () {
                    if (visualizations.length === 0) {
                        // visualizations not registered yet, wait a little bit
                        if (attemptCounter < 20) {
                            attemptCounter++;
                            initVis();
                        }
                    } else {
                        if (player.visualization.active && player.isPlaying && !player.paused) {
                            sd = app.player.getFastCurrentTrack(sd);
                            if (sd && !sd.isVideo && !_utils.isOnlineTrack(sd)) {
                                playerUtils.initializeVisualization();
                            }
                        }
                    };
                }, 100);
            };
            initVis();
        }
    }

    uitools.fillDocksMenu();
});

app.listen(thisWindow, 'ready', function () {
    var sett = window.settings.get('System');
    if (sett.System.FirstTimeRun) {
        sett.System.FirstTimeRun = false;
        window.settings.set(sett, 'System');
        actions.startupWizard.execute();
    } else {
        window.uitools.startSharing();
    }
});

app.listen(app, 'afterreload', function () {
    if ((app.player.isPlaying || app.player.paused)) {
        var tr = app.player.getCurrentTrack();
        if (tr && tr.isVideo)
            playerUtils.initializeVideoPlayer();
    }
});
