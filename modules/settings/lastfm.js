/**
 * Last.fm API Configuration
 * 
 * Handles Last.fm API key retrieval and Last.fm-specific settings.
 * MediaMonkey 5 API Only
 */

'use strict';

/**
 * Get the Last.fm API key from MediaMonkey settings with a built-in fallback.
 * @returns {string} API key for Last.fm service.
 */
function getApiKey() {
	// Use storage module if available
	if (window.matchMonkeyStorage?.getSetting) {
		return window.matchMonkeyStorage.getSetting('ApiKey', '7fd988db0c4e9d8b12aed27d0a91a932');
	}
	
	// Direct fallback using MM5 API
	if (typeof app !== 'undefined' && app.getValue) {
		const settings = app.getValue('Match Monkey', {});
		return settings.ApiKey || '7fd988db0c4e9d8b12aed27d0a91a932';
	}
	
	// Default API key
	return '7fd988db0c4e9d8b12aed27d0a91a932';
}

// Export to window namespace for MM5
window.matchMonkeyLastfm = {
	getApiKey,
};
