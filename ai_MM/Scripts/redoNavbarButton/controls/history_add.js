/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

NavigationHistory.prototype.canRedo = function () { 
    return (this._historyItems.length > 0) && (this._currentPos < this._historyItems.length - 1);
};

NavigationHistory.prototype.redo = function () {
    if (this._historyItems.length > 0 && this._currentPos < this._historyItems.length - 1) {
        this.moveToPosition(this._currentPos+1);
    }
};