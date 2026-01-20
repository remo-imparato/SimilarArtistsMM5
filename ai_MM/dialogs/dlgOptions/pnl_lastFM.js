/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

localRequirejs('lastFMTools');

let scrobblerState;
let fmUI;
let authorizing = false;
let QData = undefined;

let saveState = function (onlyMode) {
    if(!fmUI)
        return;
    if (fmUI.chbScrobblerOn.controlClass.checked && !authorizing)
        scrobblerState.scrobblerMode = 'ModeOn';
    else if (fmUI.chbScrobblerCache.controlClass.checked && !authorizing)
        scrobblerState.scrobblerMode = 'ModeCache';
    else
        scrobblerState.scrobblerMode = 'ModeOff';
    if(!onlyMode) {
        scrobblerState.showNowplaying = fmUI.chbShowNowplaying.controlClass.checked;
        scrobblerState.scrobbleStreams = fmUI.chbScrobbleStreams.controlClass.checked;
        scrobblerState.scrobbleOnlyLibrary = fmUI.chbScrobbleOnlyLibrary.controlClass.checked;
        scrobblerState.sendAlbumArtist = fmUI.chbSendAlbumArtist.controlClass.checked;
        if (QData) {
            scrobblerState.queryData = QData.saveToString();
            QData = undefined;
        }
    }
    lastfm.scrobblerState = scrobblerState;
}

optionPanels.pnl_Library.subPanels.pnl_lastFM.load = function (sett) {
    fmUI = getAllUIElements(qid('lastFMSettings'));
    scrobblerState = lastfm.scrobblerState;
    if(scrobblerState.sendAlbumArtist === undefined)
        scrobblerState.sendAlbumArtist = true;
    setVisibility(fmUI.btnLogout, !!scrobblerState.sessionKey);
    setVisibility(fmUI.loggedUser, !!scrobblerState.sessionKey);
    fmUI.chbScrobblerOn.controlClass.checked = (scrobblerState.scrobblerMode === 'ModeOn');
    fmUI.chbScrobblerOff.controlClass.checked = (scrobblerState.scrobblerMode === 'ModeOff');
    fmUI.chbScrobblerCache.controlClass.checked = (scrobblerState.scrobblerMode === 'ModeCache');
    fmUI.chbShowNowplaying.controlClass.checked = scrobblerState.showNowplaying;
    fmUI.chbScrobbleStreams.controlClass.checked = scrobblerState.scrobbleStreams;
    fmUI.chbSendAlbumArtist.controlClass.checked = scrobblerState.sendAlbumArtist;
    fmUI.chbScrobbleStreams.controlClass.disabled = true; // not supported yet
    setVisibility(fmUI.chbScrobbleStreams, false);
    fmUI.chbScrobbleOnlyLibrary.controlClass.checked = true; // scrobblerState.scrobbleOnlyLibrary;
    fmUI.chbScrobbleOnlyLibrary.controlClass.disabled = true; // not supported yet, we cannot filter nonlibrary files yet
    setVisibility(fmUI.chbScrobbleOnlyLibrary, false);

    let updateUserInfo = function () {
        if (scrobblerState.name) {
            fmUI.loggedUser.textContent = scrobblerState.name;
            setVisibility(fmUI.loggedUser, true);
        };
        localPromise(lastfm.getUserInfo()).then(function (ui) {
            if (!ui || !ui.user || !scrobblerState.sessionKey) {
                if(fmUI) {
                    fmUI.loggedUser.textContent = '';
                    setVisibility(fmUI.loggedUser, false);
                    setVisibility(fmUI.btnLogout, false);
                    fmUI.chbScrobblerOff.controlClass.checked = true;
                }
                return;
            }
            if (ui.user.realname)
                fmUI.loggedUser.textContent = ui.user.name + ' (' + ui.user.realname + ')';
            else
                fmUI.loggedUser.textContent = ui.user.name;
            if (ui.user.url) {
                fmUI.loggedUser.classList.add('hotlink');
                fmUI.loggedUser.onclick = function (e) {
                    e.stopPropagation();
                    uitools.openWeb(ui.user.url);
                };
            } else {
                fmUI.loggedUser.classList.toggle('hotlink', false);
                fmUI.loggedUser.onclick = undefined;
            }
            setVisibility(fmUI.loggedUser, true);
        })
    };
    if (scrobblerState.sessionKey)
        updateUserInfo();
    fmUI.chbScrobblerOn.controlClass.localListen(fmUI.chbScrobblerOn, 'change', function () {
        if (fmUI.chbScrobblerOn.controlClass.checked && !scrobblerState.sessionKey && !authorizing) {
            authorizing = true;
            // session token does not exist, initiate Authentication
            lastfm.authorize().then(function (sessionKey) {
                scrobblerState.sessionKey = sessionKey; // read new state with session token
                authorizing = false;
                if (!window._cleanUpCalled && fmUI) {
                    setVisibility(fmUI.btnLogout, true);
                    updateUserInfo();
                }
                saveState(true);
            }, function (err) {
                authorizing = false;
                if (!window._cleanUpCalled && fmUI)
                    fmUI.chbScrobblerOff.controlClass.checked = true;
            });
        }
    });

    fmUI.btnLogout.controlClass.localListen(fmUI.btnLogout, 'click', function () {
        scrobblerState.sessionKey = undefined;
        setVisibility(fmUI.btnLogout, false);
        setVisibility(fmUI.loggedUser, false);
        fmUI.chbScrobblerOff.controlClass.checked = true;
        saveState(true);
    });
    addEnterAsClick(fmUI.btnLogout.controlClass, fmUI.btnLogout);

    // initialize searchEditor
    let scC = fmUI.submCriteria.controlClass;
    scC.showSortOrders = false;
    scC.showLimits = false;
    scC.showCollection = false;
    fmUI.submCriteria.controlClass.localPromise(app.db.getQueryData({
        category: 'empty'
    })).then(function (aQD) {
        QData = aQD;
        if (!scrobblerState.queryData) // default state - album exists, track type is Music, Music Video or Classical Music
            scrobblerState.queryData = '[Common]\r\nQueryVersion=1\r\nQueryType=2\r\nCollectionID=-1\r\nQuickSearch=0\r\n\r\n[Basic]\r\n[Adv]\r\nConditionsCount=2\r\nOrdersCount=0\r\nLimitTop=0\r\nTop=0\r\nLimitMB=0\r\nMaxMB=650\r\nLimitLen=0\r\nMaxLen=74\r\nUseORcon=0\r\n\r\n[AdvCond1]\r\nDBField=Songs.Album\r\nDBFieldPerType=0\r\nCondition=703\r\nValue=\r\nValue2=\r\nnestOperator=or\r\nnestLevel=0\r\nisOperator=0\r\n\r\n[AdvCond2]\r\nDBField=Songs.TrackType\r\nDBFieldPerType=0\r\nCondition=301\r\nValue=0,3,4\r\nValue2=\r\nnestOperator=or\r\nnestLevel=0\r\nisOperator=0\r\n\r\n'
        QData.loadFromString(scrobblerState.queryData);
        scC.setQueryData(QData);
    });
}

optionPanels.pnl_Library.subPanels.pnl_lastFM.save = function (sett) {
    saveState();
}


optionPanels.pnl_Library.subPanels.pnl_lastFM.beforeWindowCleanup = function () {
    if(fmUI)
        fmUI.loggedUser.onclick = undefined;
    fmUI = undefined;
    QData = undefined;
}