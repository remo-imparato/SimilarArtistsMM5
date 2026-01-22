/**
 * Last.fm API Configuration
 * 
 * Handles Last.fm API key retrieval and Last.fm-specific settings.
 */

'use strict';

const { getSetting } = require('./storage');

/**
 * Get the Last.fm API key from MediaMonkey settings with a built-in fallback.
 * @returns {string} API key for Last.fm service.
 */
function getApiKey() {
	return getSetting('ApiKey', '7fd988db0c4e9d8b12aed27d0a91a932');
}

module.exports = {
	getApiKey,
};
