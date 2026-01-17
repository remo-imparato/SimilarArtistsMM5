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

dataSource.prototype.beginUpdate = function () {};

dataSource.prototype.endUpdate = function () {};

dataSource.prototype.clearSelection = function () {};

dataSource.prototype.setSelected = function (index, select) {};

