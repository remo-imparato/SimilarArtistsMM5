/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

function dataSource() {
    this.content = [];
}
dataSource.prototype = {
    get count() {
        return this.content.length;
    },
};
dataSource.prototype.add = function (item) {
    return this.content.push(item);
};
dataSource.prototype.locked = function (fn) {
    fn.bind(window)();
};
dataSource.prototype.getFastObject = function (i, obj) {
    return this.content[i];
};
dataSource.prototype.isSelected = function (i) {
    return this.content[i].selected == true;
};
dataSource.prototype.beginUpdate = function () { };
dataSource.prototype.endUpdate = function () { };
dataSource.prototype.clearSelection = function () { };
dataSource.prototype.setSelected = function (index, select) { };
