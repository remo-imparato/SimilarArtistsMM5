/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

"use strict";

requirejs('helpers/dataSourceObject');
requirejs('helpers/musicBrainz');

/**
GenreDataSource object, for use in genre views

@class GenreDataSource
@constructor
@extends DataSourceObject
*/

class GenreDataSource extends DataSourceObject {

    initialize(genreObj, params) {
        super.initialize(genreObj, params);
    }

    fetchGenre() {
        if (!this.genre || this._promises.findTag)
            return;

        this.onlineData = this.onlineData || {};
        var taskid = this.beginTask(_('Searching') + ' (' + _('Genre') + ')');
        this._promises.findTag = musicBrainz.findTag(this.uniqueID, this.genre);
        this._promises.findTag.then1(function (tagObj) {
            this._promises.findTag = undefined;
            this.endTask(taskid);
            if (isAbortError(tagObj)) { // was canceled
                return;
            }

            var wikiUrl = undefined;

            if (tagObj && tagObj.length) {
                for (var i = 0; i < tagObj.length; i++) {
                    if (parseInt(tagObj[i].score) > 90) {
                        if (tagObj[i].wiki && !wikiUrl) {
                            this.onlineData = tagObj[i];
                            wikiUrl = tagObj[i].wiki;
                        }
                        if (tagObj[i].artists && !this.onlineData.artists) {
                            this.onlineData.artists = tagObj[i].artists;
                            break;
                        }
                    } else
                        break;
                }
            }
            if (!wikiUrl)
                wikiUrl = encodeURIComponent(this.genre.title);

            if (wikiUrl) {
                this.onlineData.wikiUrl = 'http://en.wikipedia.org/wiki/' + wikiUrl;
            }
            this.notifyChange({
                senderID: this.uniqueID
            });
        }.bind(this));
    }

    get genre () {
        return this.dataObject;
    }
    set genre (artObj) {
        if (this.dataObject && (this.dataObject !== artObj)) {
            this.cleanUp();
        }
        this.dataObject = artObj;
    }
}
registerClass(GenreDataSource);
