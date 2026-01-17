/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

const
    DRIVE_TYPES = [
        {
            id: 0,
            title: _('Unknown')
      }, {
            id: 1,
            title: 'No Root'
      }, {
            id: 2,
            title: _('Removable')
      }, {
            id: 3,
            title: _('Fixed')
      }, {
            id: 4,
            title: _('Remote')
      }, {
            id: 5,
            title: 'CD-ROM'
      }, {
            id: 6,
            title: 'Ram Disk'
      }, {
            id: 12345,
            title: _('Network')
      }, {
            id: 12346,
            title: _('URL')
      }, {
            id: 12347,
            title: _('UUID')
      }, {
            id: 12348,
            title: _('YouTube')
      }
    ];

function init(params) {
    resizeable = false;
    noAutoSize = true;
    title = _('Media Properties');

    let drive = params.drive;
    assert(drive, 'dlgMediaProperties require drive in params');

    let initialized = false;
    let letter = '';
    let serial = -1;
    let isNetwork = false;
    let originalPath = '';

    let list = newStringList();
    let driveList = undefined;

    let selectCurrentLocation = function () {
        let idx = -1;
        driveList.locked(function () {
            // LS: At first try to match by both drive letter and serial number (#20564)
            for (let i = 0; i < driveList.count; i++) {                
                if (driveList.getValue(i).serialNumber === serial && driveList.getValue(i).path.startsWith( letter)) {
                    idx = i;
                    break;
                }
            }
        });
        if (idx == -1) {
            // Now try to match by the serial number only
            driveList.locked(function () {
                for (let i = 0; i < driveList.count; i++) {
                    if (driveList.getValue(i).serialNumber === serial) {
                        idx = i;
                        break;
                    }
                }
            });
        }

        if (idx >= 0) {
            let combo = qid('edtLocation');
            combo.controlClass.focusedIndex = idx;
        }
        initialized = true;
    };

    window.localPromise(app.filesystem.getDriveList().whenLoaded()).then(function (drives) {
        if (window._cleanUpCalled) return;
        driveList = drives;
        drives.locked(function () {
            for (let i = 0; i < drives.count; i++) {
                list.add(drives.getValue(i).path);
            }
        });
        if (serial !== -1)
            selectCurrentLocation();
    });
    qid('edtLocation').controlClass.dataSource = list;

    window.localPromise(drive.getPathAsync()).then(function (fullPath) {
        originalPath = fullPath;
        isNetwork = originalPath.substring(0, 2) === '\\\\';

        setVisibility(qid('rowLocation'), !isNetwork);
        setVisibility(qid('rowNetwork'), isNetwork);

        qid('edtNetworkPath').controlClass.value = originalPath;

    });

    let _formatSerialNumber = (serial) => {
        let sn = Number(serial);
        return sprintf('%04x-%04x', sn >>> 16, sn & 0xFFFF).toUpperCase();
    }

    window.localPromise(app.db.getQueryResultAsync('SELECT DriveType, SerialNumber, ShowLabel, DriveLetter FROM Medias WHERE IDMedia=' + drive.idMedia)).then(function (res) {
        let id = parseInt(res.fieldByName('DriveType'));
        for (let i = 0; i < DRIVE_TYPES.length; i++) {
            if (DRIVE_TYPES[i].id === id) {
                qid('edtType').controlClass.value = resolveToValue(DRIVE_TYPES[i].title, '');
                break;
            }
        }

        serial = parseInt(res.fieldByName('SerialNumber'));
        qid('edtSerial').controlClass.value = _formatSerialNumber(serial);

        let label = res.fieldByName('ShowLabel');
        qid('edtLabel').controlClass.value = label;

        letter = String.fromCharCode(65 /* A */ + parseInt(res.fieldByName('DriveLetter')));
        if (driveList)
            selectCurrentLocation();
    });

    window.localListen(qid('edtLocation'), 'change', function () {
        if (initialized) {
            let edtLocation = qid('edtLocation');
            if (edtLocation.controlClass.focusedIndex >= 0) {
                driveList.locked(function () {
                    let selected = driveList.getValue(edtLocation.controlClass.focusedIndex);
                    qid('edtLabel').controlClass.value = selected.volumeLabel;
                    qid('edtSerial').controlClass.value = _formatSerialNumber(selected.serialNumber);
                });
            }
        }
    });

    window.localListen(qid('btnOK'), 'click', function () {
        if (!initialized) return;
        qid('btnOK').controlClass.disabled = true;
        qid('btnCancel').controlClass.disabled = true;
        if (isNetwork) {
            let newValue = qid('edtNetworkPath').controlClass.value;
            let useMedia = false;
            if (newValue.length > 1) {
                if (newValue.substring(0, 2) !== '\\\\') { // changed from UNC to local ?
                    if (newValue[1] === ':') { // new path is local
                        useMedia = true;
                    } else {
                        if (newValue[0] === '\\')
                            newValue = '\\' + newValue;
                        else
                            newValue = '\\\\' + newValue;
                    }
                }
                if (newValue[newValue.length] !== '\\')
                    newValue = newValue + '\\';
            }

            if ((originalPath !== '') && (newValue.length > 1) && (originalPath !== newValue)) {
                if (useMedia) { // new path is local, we need to get media first
                    window.localPromise(app.filesystem.getFolderOfPathAsync(newValue)).then(function (folder) {
                        window.localPromise(app.db.executeQueryAsync("UPDATE Songs SET IDMedia=" + folder.idMedia + ", SongPath=replace(SongPath, '" + originalPath + "', '" + newValue + "') WHERE ID IN (SELECT ID FROM Songs WHERE substr(SongPath,1," + originalPath.length + ")='" + originalPath + "')")).then(function (res) {
                            modalResult = 1;
                        });
                    });
                    return;
                } else { // UNC path changed .. just replace old with new one
                    window.localPromise(app.db.executeQueryAsync("UPDATE Songs SET SongPath=replace(SongPath, '" + originalPath + "', '" + newValue + "') WHERE ID IN (SELECT ID FROM Songs WHERE substr(SongPath,1," + originalPath.length + ")='" + originalPath + "')")).then(function (res) {
                        modalResult = 1;
                    });
                }
            } else {
                modalResult = 1;
                return;
            }
        } else {
            let idx = qid('edtLocation').controlClass.focusedIndex;
            if (idx >= 0) {
                let selectedSerial = -1;
                let selectedLetter = '';

                driveList.locked(function () {
                    let drive = driveList.getValue(idx);
                    selectedSerial = drive.serialNumber;
                    selectedLetter = drive.driveLetter;
                });

                let newLabel = qid('edtLabel').controlClass.value;

                if ((serial != -1) && (serial != 0) && (selectedSerial != -1) && (selectedSerial != 0) && (selectedSerial != serial)) {
                    window.localPromise(app.db.executeQueryAsync("UPDATE Medias SET ShowLabel='" + newLabel + "', SerialNumber=" + selectedSerial + ", DriveLetter=" + (selectedLetter.charCodeAt(0) - 65 /* A */ ) + " WHERE IDMedia=" + drive.idMedia)).then(function () {
                        messageDlg(_('Location change is complete and will take effect after MediaMonkey restarts.'), 'Information', ['btnOK'], {
                            defaultButton: 'btnOK'
                        }, function () {
                            drive.volumeLabel = newLabel;
                            drive.notifyChanged();
                            modalResult = 1;
                        });
                    });
                    return;
                } else if (newLabel !== drive.volumeLabel) {
                    window.localPromise(app.db.executeQueryAsync("UPDATE Medias SET ShowLabel='" + newLabel + "' WHERE IDMedia=" + drive.idMedia)).then(function () {
                        drive.volumeLabel = newLabel;
                        drive.notifyChanged();
                        modalResult = 1;
                    });
                    return;
                }
            }
        }
        modalResult = 2;
    });


}
