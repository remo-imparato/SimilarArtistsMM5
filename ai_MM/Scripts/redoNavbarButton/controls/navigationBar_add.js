/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

NavigationBar.prototype.doRedo = function () {
    if (this._history) {
        this._history.redo();
    }
};

NavigationBar.prototype.override({
    addUndoButton: function ($super) {
        $super();
        this._redoBtn = document.createElement('div');
        this._redoBtn.setAttribute('data-icon', 'redo');
        this._redoBtn.tooltipValueCallback = (tipDiv) => {
            var act = actions.history.forward;
            if (act.shortcut)
                tipDiv.innerText = resolveToValue(act.title) + ' (' + act.shortcut + '). ' + _('Right-click for history.');
            else
                tipDiv.innerText = resolveToValue(act.title);
        }
        this._redoBtn.setAttribute('data-control-class', 'Control');
        this._redoBtn.setAttribute('data-aria-label', _('&Redo').replace('&', '')); // Label for screen readers ("Redo" is not translated, only "&Redo")
        this._redoBtn.className = 'toolbutton';
        this.navContainer.appendChild(this._redoBtn);
        initializeControl(this._redoBtn);

        this.localListen(this._redoBtn, 'mousedown', (e) => {
            this._redoBtn.controlClass.mousedownTm = Date.now();

            var isLeftButton = (e.button === 0);
            if (isLeftButton) {
                this._redoBtn.controlClass.mousedownTm = Date.now();
                this.requestTimeout(() => {
                    if (this._redoBtn.controlClass.mousedownTm) {
                        this._redoBtn.controlClass.contextMenuHandler(e);
                        this._redoBtn.controlClass.mousedownTm = 0;
                    }
                }, 500, 'longclicktimeout');
            }
        });

        this.localListen(this._redoBtn, 'mouseup', (e) => {
            var isLeftButton = (e.button === 0);
            if (isLeftButton)
                this.doRedo();
            this._redoBtn.controlClass.mousedownTm = 0;
        });

        // add right-click menu with all items:
        this._redoBtn.controlClass.contextMenu = []; // to init the menu
        this._redoBtn.controlClass.getContextMenuItems = function () {
            var menuItems = [];
            var history = this._history;
            for (var i = history._currentPos + 1; i < history._historyItems.length; i++) {
                var viewData = history._historyItems[i];
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
        }.bind(this);
    }
});

NavigationBar.prototype.override({
    updateButtons: function ($super) {
        $super();
        if (this._history && this._history.canRedo())
            this._redoBtn.controlClass.disabled = false;
        else
            this._redoBtn.controlClass.disabled = true;
    }
});
