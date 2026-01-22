/**
 * SimilarArtists Modules Index
 * 
 * Central export point for all refactored modules.
 * Allows importing with: const { storage, normalization, ... } = require('./modules');
 */

'use strict';

// Configuration
const config = require('./config');

// Utilities
const normalization = require('./utils/normalization');
const helpers = require('./utils/helpers');
const sql = require('./utils/sql');

// Settings
const storage = require('./settings/storage');
const prefixes = require('./settings/prefixes');
const lastfm = require('./settings/lastfm');

// UI
const notifications = require('./ui/notifications');

// API
const cache = require('./api/cache');

module.exports = {
	config,
	utils: {
		normalization,
		helpers,
		sql,
	},
	settings: {
		storage,
		prefixes,
		lastfm,
	},
	ui: {
		notifications,
	},
	api: {
		cache,
	},
};
