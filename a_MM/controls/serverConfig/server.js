/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

requirejs('helpers/qrCode');

var _STR_CHOICE_AUTOMATIC = _('Automatic');

ServerConfig.prototype.tabs.server.load = function () {
    this.qChild('edtServerName').controlClass.value = this.server.name;
    var DS = this.server.getIPAddressesList();
    var edt = this.qChild('edtIPAddress');
    edt.controlClass.dataSource = DS;
    DS.whenLoaded().then(() => {
        DS.modifyAsync(() => {
            DS.insert(0, _STR_CHOICE_AUTOMATIC);
            if (this.server.ip != '')
                edt.controlClass.value = this.server.ip;
            else
                edt.controlClass.focusedIndex = 0;
        });
    });
    this.qChild('edtIPPort').controlClass.value = this.server.port;
    this.qChild('chbAcceptExternalIPs').controlClass.checked = this.server.acceptExternalIP;

    this.localListen(this.qChild('btnCheckServer'), 'click', () => {
        // #18168
        DS.whenLoaded().then(() => {
            var ip = getValueAtIndex(DS, DS.count - 1);
            if (edt.controlClass.focusedIndex > 0)
                ip = edt.controlClass.value;
            var port = this.qChild('edtIPPort').controlClass.value;
            var url = 'http://' + ip + ':' + port + '/DeviceDescription.xml';
            var localUrl = 'http://127.0.0.1:' + port + '/DeviceDescription.xml';
            app.utils.web.getURLContentAsync(url).then(() => {
                // 192.168.X.X can be reached (case A)
                messageDlg(sprintf(_("%s seems to be working correctly. See Help, if you're unable to access the server from other devices."), this.server.name), 'Information', ['btnHelp', 'btnOK'], {
                    defaultButton: 'btnOK'
                }, function (result) {
                    if (result.btnID === 'btnHelp') {
                        window.uitools.openWeb('https://www.mediamonkey.com/wiki/WebHelp:Setting_UPnP_DLNA_Media_Servers/5.0#Firewall');
                    }
                });
            }, () => {
                app.utils.web.getURLContentAsync(localUrl).then(() => {
                    // 127.0.0.1 can be reached, but 192.168.X.X can't (case B)
                    messageDlg(sprintf(_('%s cannot be reached'), this.server.name + ' [' + url + ']'), 'Error', ['btnHelp', 'btnOK'], {
                        defaultButton: 'btnOK'
                    }, function (result) {
                        if (result.btnID === 'btnHelp') {
                            window.uitools.openWeb('https://www.mediamonkey.com/upnp-client-connect-error');
                        }
                    });
                }, () => {
                    // 127.0.0.1 cannot be reached, check the server is running
                    messageDlg(sprintf(_('%s cannot be reached'), this.server.name + ' [' + localUrl + ']') + '. ' + _('The server is not running'), 'Error', ['btnOK'], {
                        defaultButton: 'btnOK'
                    }, () => { });
                });
            });
        });
    });
    addEnterAsClick(this, this.qChild('btnCheckServer'));

    var qrEl = this.qChild('QRCode');
    var generateQR = () => {
        DS.whenLoaded().then(() => {
            var ip = getValueAtIndex(DS, DS.count - 1);
            if (edt.controlClass.focusedIndex > 0)
                ip = edt.controlClass.value;
            var port = this.qChild('edtIPPort').controlClass.value;
            var link = 'http://' + ip + ':' + port + '/DeviceDescription.xml';
            cleanElement(qrEl);
            qrEl.appendChild(QRCode({
                msg: link,
                pad: 2,
                dim: 128,
                pal: ["#000000", "#ffffff"]
            }));
        });
    }
    generateQR();
    this.localListen(edt, 'change', generateQR);
    this.localListen(this.qChild('edtIPPort'), 'change', generateQR);
    this.localListen(qrEl, 'click', () => {
        var dlg = uitools.openDialog('empty', {
            show: true,
            modal: true
        })
        dlg.onloaded = function () {
            var root = dlg.getValue('getBodyForControls')();
            root.innerHTML = qrEl.innerHTML;
            forEach(qes(root, 'svg'), function (svg) {
               svg.style.width = '100%';
               svg.style.height = '92%';
            });
            app.unlisten(dlg, 'load', dlg.onloaded);
        }.bind(this)
        app.listen(dlg, 'load', dlg.onloaded);
    });

    var LV = this.qChild('lvConnectionsListView');
    LV.controlClass.showHeader = true;
    LV.controlClass.isSortable = false;
    LV.controlClass.multiselect = false;

    var columns = new Array();
    columns.push({
        order: 0,
        width: 150,
        title: _('Date'),
        bindData: function (div, item, index) {
            div.innerText = item.date;
        }
    });
    columns.push({
        order: 1,
        width: 80,
        title: _('Status'),
        bindData: function (div, item, index) {
            div.innerText = item.status;
        }
    });
    columns.push({
        order: 2,
        width: 150,
        title: _('MAC address'),
        bindData: function (div, item, index) {
            div.innerText = item.mac;
        }
    });
    columns.push({
        order: 3,
        width: 150,
        title: _('IP address'),
        bindData: function (div, item, index) {
            div.innerText = item.ip;
        }
    });
    columns.push({
        order: 4,
        width: 150,
        title: _('Client name'),
        bindData: function (div, item, index) {
            div.innerText = item.userAgent;
        }
    });
    columns.push({
        order: 5,
        width: 300,
        title: _('Requested file'),
        bindData: function (div, item, index) {
            div.innerText = item.link;
        }
    });
    LV.controlClass.setColumns(columns);
    LV.controlClass.dataSource = this.server.getMediaConnectionList();
};

ServerConfig.prototype.tabs.server.save = function () {
    this.server.name = this.qChild('edtServerName').controlClass.value;
    var oldIP = this.server.ip + this.server.port;
    var currIP = this.qChild('edtIPAddress').controlClass.value;
    if (currIP != _STR_CHOICE_AUTOMATIC) // particular IP is selected (not the first "Automatic")
        this.server.ip = this.qChild('edtIPAddress').controlClass.value;
    else
        this.server.ip = ''; // automatic IP
    this.server.port = Number(this.qChild('edtIPPort').controlClass.value);

    var newIP = this.server.ip + this.server.port;
    if (oldIP != newIP && this.server.running) {
        this.server.restartAsync();
    }
    this.server.acceptExternalIP = this.qChild('chbAcceptExternalIPs').controlClass.checked;
};
