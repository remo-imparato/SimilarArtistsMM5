/**
 * Last.fm API Configuration
 * 
 * Handles Last.fm API key retrieval and Last.fm-specific settings.

 */

'use strict';

// Default fallback API key (used only as last resort)
const DEFAULT_API_KEY = '7fd988db0c4e9d8b12aed27d0a91a932';

/**
 * Get the Last.fm API key with the following priority:
 * 1. User's manually entered API key (from MatchMonkey settings)
 * 2. MediaMonkey's registered Last.fm API key
 * 3. Default fallback key
 * 
 * @returns {string} API key for Last.fm service.
 */
function getApiKey() {
	// Priority 1: Check if user has manually entered an API key
	let userApiKey = '';
	
	if (window.matchMonkeyStorage?.getSetting) {
		userApiKey = window.matchMonkeyStorage.getSetting('ApiKey', '');
	} else if (typeof app !== 'undefined' && app.getValue) {
		const settings = app.getValue('Match Monkey', {});
		userApiKey = settings.ApiKey || '';
	}
	
	// If user has manually entered a key, use it
	if (userApiKey && userApiKey.trim() !== '') {
		return userApiKey;
	}
	
	// Priority 2: Try to use MediaMonkey's registered Last.fm API key
	if (typeof app !== 'undefined' && app.utils?.web?.getAPIKey) {
		try {
			const mmApiKey = app.utils.web.getAPIKey('lastfmApiKey');
			if (mmApiKey && mmApiKey.trim() !== '') {
				return mmApiKey;
			}
		} catch (e) {
			console.log('MatchMonkey: Could not retrieve MediaMonkey Last.fm API key:', e);
		}
	}
	
	// Priority 3: Final fallback to default key
	return DEFAULT_API_KEY;
}

// Export to window namespace for MM5
window.matchMonkeyLastfm = {
	getApiKey,
};
