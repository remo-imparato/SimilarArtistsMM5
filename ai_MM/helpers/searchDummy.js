/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

requirejs('helpers/searchCommon');
requirejs('consts');


webTaggers.dummy = inheritTagger('Dummy', 'Common', {
    isDummy: true,
    groupingSupport: function () {
        return false;
    },

    lookupSource: '',
    allowedTypes: 'all',
    getPluginPriority: function (type) {
        return 1000000; // less value = higher priority
    },

});
