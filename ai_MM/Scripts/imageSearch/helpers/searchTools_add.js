/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

requirejs('controls/toastMessage');

var lastCookiePageTm = 0;
var googleURLTest = /\.google\./i;
var criticalErrorDisplayed = false;
if(!window.isArray) {
    window.isArray = function isArray(x) {
        return Array.isArray(x);
    }
}
if(!window.isObjectLiteral) {
    window.isObjectLiteral = function isObjectLiteral(x) {
        return ((!!x) && (x.constructor === Object));
    }
}
let checkAppVersion = undefined;
let useOldDialogVersion = false;

searchTools.googleFailCounter = 0;
searchTools.priorities = {
    google: 10,
    bing: 20
};
var googleStat = [];
var googleCheckIntervalMS = 5 * 60 * 1000; // default 5 min
var googleCountMax = 10; // max. number of Google searches during googleCheckIntervalMS

searchTools.noticeGoogleSearch = function (req) {
    if(req && (req.name === 'Google')) {
        googleStat.push(Date.now());
        if(googleStat.length>googleCountMax) {
            googleStat.splice(0, 1);
        }
    }
}

searchTools.checkGoogleFreq = function () {
    if(googleStat.length<googleCountMax)
        return true;
    let diff = googleStat[googleCountMax-1] - googleStat[0];
    return (diff >= googleCheckIntervalMS);
};

searchTools.processGoogleDelay = async function () {
    // random delay, in case higher frequency possible higher delay
    // we now count time of last 3 lookups
    if(googleStat.length<3)
        return;
    let lastTime = googleStat[2];
    let lastInt = Date.now() - googleStat[2]
    if(lastInt > (googleCheckIntervalMS/4))
        return;
    ;
    let maxTime = Math.max((googleCheckIntervalMS/4 - lastInt)/4, 3000); // max wait time cca (3s - 19s)
    let tm = Math.floor(Math.random() * maxTime) + 1000; // 1s - 20s
    await new Promise(r => setTimeout(r, tm));
};

searchTools.readWebPageAsync = function (url, isRerun) {
    let w = undefined;
    let waitForResultTM = undefined;
    var readpromise = new Promise(function (resolve, reject) {
        if(checkAppVersion === undefined) {
            checkAppVersion = (app.versionHi > 2024) || ((app.versionHi === 2024) && (app.versionBuild >= 3017));
            if(!checkAppVersion) {
                checkAppVersion = (app.versionHi > 5) || ((app.versionHi === 5) && (app.versionRelease >= 4) && (app.versionBuild >= 2690));
                useOldDialogVersion = true;
            }
        }
        if(!checkAppVersion) {
            uitools.toastMessage.show(_('This addon is incompatible with current version of MediaMonkey') + ': <i>ImageSearch</i><br>'+sprintf(_('Please update to MediaMonkey %s or higher.'), ['2024.0.0.3017']), {
                disableUndo: true,
                delay: 10000,
            });
            resolve('');
            return;
        }
    
        if(!useOldDialogVersion) {
            app.utils.web.loadWebContent(url).then(function(content) {
                resolve(content);
            }, function(error) {

                ODS('readWebPageAsync - failed to load ' + url + ', ' + error);

                if(waitForResultTM !== undefined) {
                    clearTimeout(waitForResultTM);
                    waitForResultTM = undefined;
                }
                uitools.toastMessage.show(_('Download error') + '<br><i>' +  error + '</i>', {
                    disableUndo: true,
                    delay: 10000,
                });
                resolve('');
            });
        } else {
            var tm = Date.now();
            if (!isRerun && ((tm - lastCookiePageTm) < 60000) && googleURLTest.test(url)) {
                // cookies were not answered and too fast after the last attempt, quit
                ODS('readWebPageAsync - cookies were not answered yet, leaving');
                resolve();
                return;
            }
            let isGoogleSearch = (url.indexOf('google.com')>-1);
            // old version for better backward compatibility - BEGIN
            w = app.dialogs.openDialog(url, {
                left: 0,
                top: 0,
                width: 1920,
                height: 1200,
                show: false,
                bordered: true,
                modal: false,
                canShow: false,
                openingWindow: thisWindow,
                loadError: function(failedUrl,errorCode,errorText) {
                    ODS('readWebPageAsync - failed to load ' + failedUrl + ', ' + errorText + '(' + errorCode + ')');

                    if(waitForResultTM !== undefined) {
                        clearTimeout(waitForResultTM);
                        waitForResultTM = undefined;
                    }
                    uitools.toastMessage.show(_('Download error') + '<br><i>' +  errorText + '</i>', {
                        disableUndo: true,
                        delay: 10000,
                    });
                    resolve('');
                    if (w) {
                        if (w.doLoaded) {
                            app.unlisten(w, 'load', w.doLoaded);
                            w.doLoaded = undefined;
                        }
                        w.closeWindow();
                    }        
                }
            });
            
            if(!criticalErrorDisplayed) {
                waitForResultTM = requestTimeout(() => {
                    waitForResultTM = undefined;
                    if(!w || w.isloaded)
                        return;
                    ODS('readWebPageAsync - timeout passed');
                    if(isGoogleSearch) {
                        searchTools.googleFailCounter++;
                        if(searchTools.googleFailCounter>2) {
                            ODS('Deactivating Google search, too much failures');
                            searchTools.priorities.google = 0; // = do not use
                        }
                    }
                    resolve('');
                    w.closeWindow();
                }, 20000); // after 20s assume something went wrong, return not found result
            };

            var reRun = function () {
                searchTools.readWebPageAsync(url, true).then(function (res) {
                    resolve(res);
                }, function () {
                    if (reject)
                        reject();
                });
            };

            w.doLoaded = function () {
                app.unlisten(this, 'load', this.doLoaded);
                if(waitForResultTM !== undefined) {
                    clearTimeout(waitForResultTM);
                    waitForResultTM = undefined;
                }
                ODS('readWebPageAsync - on loaded');
                this.doLoaded = undefined;
                this.doOnError = undefined;
                this.isloaded = true;
                var isCookie = false;
                requestTimeout(() => {
                    if (readpromise && !readpromise.canceled && w && w._window && w._window.document.body) {
                        isCookie = searchTools.isCookiePage(w._window.document.body.innerHTML);
                        if (isCookie) {
                            ODS('readWebPageAsync - page is cookie question');
                            var tm = Date.now();
                            if (isRerun || ((tm - lastCookiePageTm) < 60000)) {
                                ODS('readWebPageAsync - cookies were not answered yet, leaving');
                                lastCookiePageTm = tm;
                                resolve();
                                this.closeWindow();
                                return;
                            };

                            var timer = undefined;
                            var loadingCounter = 0;

                            var clearTimer = function () {
                                if (timer) {
                                    clearInterval(timer);
                                    timer = undefined;
                                }
                            };

                            var runTimer = function () {
                                if (timer)
                                    return;
                                timer = setInterval(() => {
                                    if (window._cleanUpCalled || !w || !w._window || (loadingCounter >= 8)) {
                                        clearTimer();
                                        return;
                                    }
                                    if (!w._window.document.body) {
                                        // probably just loading, wait a little bit
                                        loadingCounter++;
                                        return;
                                    }
                                    isCookie = searchTools.isCookiePage(w._window.document.body.innerHTML);
                                    if (!isCookie) {
                                        // already not cookie page, finish
                                        clearTimer();
                                        lastCookiePageTm = 0;
                                        this.closeWindow();
                                    }
                                }, 250);
                            }.bind(this);

                            var showCookieWin = function () {
                                if (!w || w.calledDlg || !readpromise || readpromise.canceled)
                                    return;
                                ODS('readWebPageAsync - showCookieWin');
                                w.calledDlg = true;
                                requestFrame(() => {
                                    w.setSize(1024, 768);
                                    w.closed = app.listen(this, 'closed', function () {
                                        clearTimer();
                                        app.unlisten(w, 'closed', w.closed);
                                        if (isCookie)
                                            lastCookiePageTm = Date.now();
                                        w.atTopMost = false;
                                        if (!readpromise || readpromise.canceled)
                                            return;
                                        ODS('readWebPageAsync - closeWindow called, trying again');
                                        reRun();
                                    });
                                    w.atTopMost = true;
                                    runTimer();
                                    w.showModal();
                                });
                            }.bind(this);

                            w.calledDlg = false;
                            uitools.toastMessage.show(_('MediaMonkey looks up images from various websites. Please choose to accept or reject cookies for images to be looked up.'), {
                                button: {
                                    caption: _('Choose'),
                                    onClick: showCookieWin
                                },
                                onCloseClick: showCookieWin,
                                callback: showCookieWin,
                                disableUndo: true,
                                delay: 5000
                            });
                        } else {
                            resolve(w._window.document.body.innerHTML);
                        }
                    } else if (reject)
                        reject();
                    else
                        resolve();
                    if (!isCookie) {
                        this.closeWindow();
                    }
                }, 50); // sometimes needed, especially for Bing, so async functions are already processed
            }.bind(w);
            app.listen(w, 'load', w.doLoaded);
        }
        // old version for better backward compatibility - END
    });

    readpromise.onCanceled = function () {
        // search was canceled, force closing window
        if (w) {
            if (w.doLoaded) {
                app.unlisten(w, 'load', w.doLoaded);
                w.doLoaded = undefined;
            }
            w.closeWindow();
        }
        if(waitForResultTM !== undefined) {
            clearTimeout(waitForResultTM);
            waitForResultTM = undefined;
        }
    };

    return readpromise;
}

searchTools.isCookiePage = function (html) {
    // currently skipped, seems not needed
    var googleTest = /action="https:\/\/consent\.google\.com\/save"/i;
    if (googleTest.test(html)) {
        return true;
    };

    // add Bing page detection - currently unclear

    return false;
}

searchTools.parseGoogleImgSearchResponse = function (html) {
    var result = [];
    try {
        //app.filesystem.saveTextToFileAsync(app.filesystem.getDataFolder() + '\\googleResult.html', html);
        // find function filling structure with results
        var re = /\(function\(\)\{var m=(.*?)\]\]\][ ]*\}/ig;
        var prepArr = html.match(re);
        var larray = undefined;
        var prepText = '';
        if (prepArr && (prepArr.length > 0)) {
            prepArr.forEach((itm) => {
                if (itm && (itm.length > prepText.length))
                    prepText = itm;
            });
            if (prepText.length > 18) {
                // cut off function wrapping
                prepText = prepText.slice(18);
            } else {
                prepText = '';
            }
        }

        if (prepText && (prepText.length > 1) && (prepText[0] === '{') && (prepText[prepText.length - 1] === '}')) {
            //app.filesystem.saveTextToFileAsync(app.filesystem.getDataFolder() + '\\googleResultPrep.html', prepText);
            larray = tryEval(prepText);
        }
        if (!larray) {
            if (ODS)
                ODS('rSuccessGoogle: larray is NULL');
            searchTools.googleFailCounter++;
            if(searchTools.googleFailCounter>2) {
                ODS('Deactivating Google search, too much failures');
                searchTools.priorities.google = 0; // = do not use
            }
        } else {
            //app.filesystem.saveTextToFileAsync(app.filesystem.getDataFolder() + '\\googleResultPrep.json', JSON.stringify(larray));
            if(isObjectLiteral(larray)) {
                let val, key, val1, th, im, sz, szobj;
                let i = 0;
                for (key in larray) {
                    val = larray[key];
                    if(isArray(val) && (val.length>7)) {
                        val1 = val[1];
                        if(isArray(val1) && (val1.length>9)) {
                            th = val1[2];
                            im = val1[3];
                            szobj = val1[9];
                            if(isArray(th) && isArray(im) && (th.length>2) && (im.length>2)) {
                                if (ODS)
                                    ODS('Adding result ' + (i + 1) + ': '+JSON.stringify(im));
                                i++;
                                var res = {};
                                res.imglink = decodeURIComponent(im[0]); // some links are double encoded, see mantis #13047 for details - maybe already not needed? Trying used once only.
                                res.width = im[2];
                                res.height = im[1];
                                res.thumblink = decodeURIComponent(th[0]);
                                res.thumbwidth = th[2];
                                res.thumbheight = th[1];
                                if(isObjectLiteral(szobj) && isArray(szobj["2000"]) && szobj["2000"][2]) {
                                    res.filesize = szobj["2000"][2];
                                }
                                result.push(res);
                                searchTools.googleFailCounter = 0;
                            };
                        };
                    };
                }
            }
        }
    } catch (ex) {
        if (ODS)
            ODS(ex.message);
    }
    return result;
}

searchTools.parseBingImgSearchResponse = function (html) {
    var result = [];
    try {
        //app.filesystem.saveTextToFileAsync(app.filesystem.getDataFolder() + '\\bingResult.html', html);
        // all items after <div class="imgpt">
        var mlist = html.split('<div class="imgpt">');

        if (mlist && (mlist.length > 1)) {
            ODS('rSuccessBing: split to ' + mlist.length + ' items');
            var txt, params, dtxt;
            var rg_m = /m="\{(.*?)\}"/i;
            var rg_w = /expw=([\d]*)/i;
            var rg_h = /exph=([\d]*)/i;

            for (var i = 1; i < mlist.length; i++) {
                txt = mlist[i];
                // m="{..}"
                params = rg_m.exec(txt);
                if (params && (params[1])) {
                    try {
                        var res = {};
                        dtxt = '{' + decodeHTML(params[1]) + '}';
                        dtxt = JSON.parse(dtxt);
                        res.imglink = dtxt.murl;
                        res.thumblink = dtxt.turl + '&w=189&h=189';
                        res.thumbwidth = 189;
                        res.thumbheight = 189;
                        res.width = rg_w.exec(txt)[1];
                        res.height = rg_h.exec(txt)[1];
                        result.push(res);
                    } catch (ex) {
                        if (ODS)
                            ODS('rSuccessBing error: ' + ex.message);
                    }
                } else {
                    if (ODS)
                        ODS('rSuccessBing: not found in ' + txt);
                }
            }

            if (ODS)
                ODS('rSuccessBing: filled ' + result.length + ' results');
        }
    } catch (ex) {
        if (ODS)
            ODS(ex.message);
    }
    return result;
}
