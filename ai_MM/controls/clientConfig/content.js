/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

ClientConfig.prototype.tabs.content.load = function () {
    var chb = this.qChild('chbCustomizeContent');
    chb.controlClass.checked = this.client.customizeContent;
    var tree = this.qChild('sharedContentTree').controlClass;
    tree.setCheckedObjects(this.client.getSharedObjects()).then(() => {
        listForEach(tree.root.children, (node, index) => {
            if (index < tree.root.children.count - 1) {
                if (!node.checked) // pre-expand and collapse the collection nodes to get the correct 'indeterminate' check state
                    tree.expandNode(node).then(() => {
                        tree.collapseNode(node);
                    });
                else
                    node.modified = true; // to store the collection as checked (once another collection gets unchecked)
            } else
                tree.expandNode(node); // pre-expand playlists node to see which playlists are selected
        });
    });
    bindDisabled2Checkbox(tree.container, chb);
};

ClientConfig.prototype.tabs.content.save = function () {
    this.client.customizeContent = this.qChild('chbCustomizeContent').controlClass.checked;
    var list = this.qChild('sharedContentTree').controlClass.getObjectList();
    this.client.setSharedObjects(list);
};
