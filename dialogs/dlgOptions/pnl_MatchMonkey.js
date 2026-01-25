/**
 * MatchMonkey Options Panel for MediaMonkey 5
 * 
 * MediaMonkey 5 API Only
 * 
 * @author Remo Imparato
 * @version 2.1.0
 * @description Configuration panel for MatchMonkey add-on in MM5 Tools > Options.
 * 
 * Config Property Mapping (UI ID -> Storage Key):
 * - PlaylistName -> PlaylistName
 * - ParentPlaylist -> ParentPlaylist
 * - PlaylistMode -> PlaylistMode
 * - ShowConfirmDialog -> ShowConfirmDialog
 * - ShuffleResults -> ShuffleResults
 * - IncludeSeedArtist -> IncludeSeedArtist
 * - SimilarArtistsLimit -> SimilarArtistsLimit
 * - TrackSimilarLimit -> TrackSimilarLimit
 * - TracksPerArtist -> TracksPerArtist
 * - MaxPlaylistTracks -> MaxPlaylistTracks
 * - UseLastfmRanking -> UseLastfmRanking
 * - PreferHighQuality -> PreferHighQuality
 * - MinRating -> MinRating
 * - IncludeUnrated -> IncludeUnrated
 * - AutoModeEnabled -> AutoModeEnabled
 * - AutoModeDiscovery -> AutoModeDiscovery
 * - AutoModeSeedLimit -> AutoModeSeedLimit
 * - AutoModeSimilarLimit -> AutoModeSimilarLimit
 * - AutoModeTracksPerArtist -> AutoModeTracksPerArtist
 * - AutoModeMaxTracks -> AutoModeMaxTracks
 * - SkipDuplicates -> SkipDuplicates
 * - EnqueueMode -> EnqueueMode
 * - ClearQueueFirst -> ClearQueueFirst
 * - NavigateAfter -> NavigateAfter
 * - ArtistBlacklist -> ArtistBlacklist
 * - GenreBlacklist -> GenreBlacklist
 * - TitleExclusions -> TitleExclusions
 * 
 * @license MIT
 */

'use strict';

// Script namespace
const SCRIPT_ID = 'MatchMonkey';

/**
 * Read a setting from the MatchMonkey configuration.
 * @param {string} key Setting key.
 * @returns {*} Setting value or undefined.
 */
function getSetting(key) {
	try {
		const allSettings = app.getValue(SCRIPT_ID, {});
		return allSettings[key];
	} catch (e) {
		console.error('Match Monkey Options: Error reading setting:', key, e);
		return undefined;
	}
}

/**
 * Write a setting to the MatchMonkey configuration.
 * @param {string} key Setting key.
 * @param {*} value Setting value.
 */
function setSetting(key, value) {
	try {
		const allSettings = app.getValue(SCRIPT_ID, {});
		allSettings[key] = value;
		app.setValue(SCRIPT_ID, allSettings);
	} catch (e) {
		console.error('Match Monkey Options: Error saving setting:', key, e);
	}
}

/**
 * Load handler - populates UI controls with current settings.
 */
optionPanels.pnl_Library.subPanels.pnl_MatchMonkey.load = async function (sett, pnl, wndParams) {
	try {
		// Read configuration from system storage
		this.config = app.getValue(SCRIPT_ID, {});

		// Verify config exists
		if (!this.config || Object.keys(this.config).length === 0) {
			console.warn('Match Monkey Options: No configuration found');
			return;
		}

		const UI = getAllUIElements(pnl);
		const cfg = this.config;

		// === Playlist Creation ===
		UI.PlaylistName.controlClass.value = cfg.PlaylistName || '- Similar to %';
		UI.ParentPlaylist.controlClass.value = cfg.ParentPlaylist || '';
		UI.PlaylistMode.controlClass.value = cfg.PlaylistMode || 'Create new playlist';
		UI.ShowConfirmDialog.controlClass.checked = Boolean(cfg.ShowConfirmDialog);
		UI.ShuffleResults.controlClass.checked = cfg.ShuffleResults !== false; // Default true
		UI.IncludeSeedArtist.controlClass.checked = Boolean(cfg.IncludeSeedArtist);

		// === Discovery Limits ===
		UI.SimilarArtistsLimit.controlClass.value = cfg.SimilarArtistsLimit || 20;
		UI.TrackSimilarLimit.controlClass.value = cfg.TrackSimilarLimit || 100;
		UI.TracksPerArtist.controlClass.value = cfg.TracksPerArtist || 30;
		UI.MaxPlaylistTracks.controlClass.value = cfg.MaxPlaylistTracks || 0; // 0 = unlimited
		UI.UseLastfmRanking.controlClass.checked = cfg.UseLastfmRanking !== false; // Default true
		UI.PreferHighQuality.controlClass.checked = cfg.PreferHighQuality !== false; // Default true

		// === Rating Filter ===
		const ratingValue = parseInt(cfg.MinRating, 10) || 0;
		this._setRatingControl(UI.MinRating, ratingValue);
		UI.IncludeUnrated.controlClass.checked = cfg.IncludeUnrated !== false; // Default true

		// === Auto-Mode ===
		this._setupAutoModeCheckbox(UI.AutoModeEnabled);
		UI.AutoModeDiscovery.controlClass.value = cfg.AutoModeDiscovery || 'Track';
		UI.AutoModeSeedLimit.controlClass.value = cfg.AutoModeSeedLimit || 2;
		UI.AutoModeSimilarLimit.controlClass.value = cfg.AutoModeSimilarLimit || 10;
		UI.AutoModeTracksPerArtist.controlClass.value = cfg.AutoModeTracksPerArtist || 5;
		UI.AutoModeMaxTracks.controlClass.value = cfg.AutoModeMaxTracks || 30;
		UI.SkipDuplicates.controlClass.checked = cfg.SkipDuplicates !== false; // Default true

		// === Queue Behavior ===
		UI.EnqueueMode.controlClass.checked = Boolean(cfg.EnqueueMode);
		UI.ClearQueueFirst.controlClass.checked = Boolean(cfg.ClearQueueFirst);
		UI.NavigateAfter.controlClass.value = cfg.NavigateAfter || 'Navigate to new playlist';

		// === Filters ===
		UI.ArtistBlacklist.controlClass.value = cfg.ArtistBlacklist || '';
		UI.GenreBlacklist.controlClass.value = cfg.GenreBlacklist || '';
		UI.TitleExclusions.controlClass.value = cfg.TitleExclusions || '';

	} catch (e) {
		console.error('Match Monkey Options: load error:', e.toString());
	}
};

/**
 * Helper to set rating control value.
 */
optionPanels.pnl_Library.subPanels.pnl_MatchMonkey._setRatingControl = function (uiRatingControl, value) {
	if (!uiRatingControl?.controlClass) return;

	const ctrl = uiRatingControl.controlClass;
	const apply = () => {
		try {
			if (typeof ctrl.setRating === 'function') {
				ctrl.setRating(value, { force: true, disableChangeEvent: true });
			} else {
				ctrl.value = value;
			}
		} catch (e) {
			ctrl.value = value;
		}
	};

	// Check if control is initialized
	if (ctrl._initialized && Array.isArray(ctrl.stars) && ctrl.stars.length) {
		apply();
	} else {
		// Wait for control to initialize
		const onLoad = () => {
			try { apply(); }
			finally { app.unlisten(ctrl.container, 'load', onLoad); }
		};
		app.listen(ctrl.container, 'load', onLoad);
	}
};


/**
 * Helper to setup auto-mode checkbox with change listener.
 */
optionPanels.pnl_Library.subPanels.pnl_MatchMonkey._setupAutoModeCheckbox = function (uiCheckbox) {
	// Set initial state
	try {
		if (window.matchMonkey?.isAutoEnabled) {
			uiCheckbox.controlClass.checked = Boolean(window.matchMonkey.isAutoEnabled());
		} else {
			uiCheckbox.controlClass.checked = Boolean(this.config.AutoModeEnabled);
		}
	} catch (e) {
		uiCheckbox.controlClass.checked = Boolean(this.config.AutoModeEnabled);
	}

	// Change handler
	const onCheckboxChanged = () => {
		try {
			const desired = Boolean(uiCheckbox.controlClass.checked);
			setSetting('AutoModeEnabled', desired);

			// Sync with addon
			if (window.matchMonkey?.toggleAuto) {
				const current = Boolean(window.matchMonkey.isAutoEnabled?.());
				if (current !== desired) {
					window.matchMonkey.toggleAuto();
				}
			}
		} catch (e) {
			console.error('Match Monkey Options: AutoModeEnabled change error:', e);
		}
	};

	// Listen for changes
	try {
		const ctrl = uiCheckbox.controlClass;
		const el = ctrl.container?.querySelector?.('input[type="checkbox"]') || ctrl.container;
		if (el) {
			app.listen(el, 'change', onCheckboxChanged);
			app.listen(el, 'click', onCheckboxChanged);
		}
	} catch (e) {
		if (uiCheckbox.controlClass?.container) {
			app.listen(uiCheckbox.controlClass.container, 'change', onCheckboxChanged);
		}
	}

	// Listen for auto-mode changes from other sources
	const onAutoModeChanged = (event) => {
		try {
			if (event.detail?.enabled !== undefined) {
				uiCheckbox.controlClass.checked = Boolean(event.detail.enabled);
			}
		} catch (e) {
			console.error('Match Monkey Options: Auto-mode event error:', e);
		}
	};

	this._autoModeListener = onAutoModeChanged;
	window.addEventListener('matchmonkey:automodechanged', onAutoModeChanged);
};

/**
 * Save handler - persists UI control values to settings.
 */
optionPanels.pnl_Library.subPanels.pnl_MatchMonkey.save = function (sett) {
	try {
		// Clean up event listener
		if (this._autoModeListener) {
			window.removeEventListener('matchmonkey:automodechanged', this._autoModeListener);
			this._autoModeListener = null;
		}

		const UI = getAllUIElements();

		// Read current config to preserve any keys not in UI
		this.config = app.getValue(SCRIPT_ID, {});

		// === Playlist Creation ===
		this.config.PlaylistName = UI.PlaylistName.controlClass.value || '- Similar to %';
		this.config.ParentPlaylist = UI.ParentPlaylist.controlClass.value || '';
		this.config.PlaylistMode = UI.PlaylistMode.controlClass.value || 'Create new playlist';
		this.config.ShowConfirmDialog = UI.ShowConfirmDialog.controlClass.checked;
		this.config.ShuffleResults = UI.ShuffleResults.controlClass.checked;
		this.config.IncludeSeedArtist = UI.IncludeSeedArtist.controlClass.checked;

		// === Discovery Limits ===
		this.config.SimilarArtistsLimit = parseInt(UI.SimilarArtistsLimit.controlClass.value, 10) || 20;
		this.config.TrackSimilarLimit = parseInt(UI.TrackSimilarLimit.controlClass.value, 10) || 100;
		this.config.TracksPerArtist = parseInt(UI.TracksPerArtist.controlClass.value, 10) || 30;
		this.config.MaxPlaylistTracks = parseInt(UI.MaxPlaylistTracks.controlClass.value, 10) || 0;
		this.config.UseLastfmRanking = UI.UseLastfmRanking.controlClass.checked;
		this.config.PreferHighQuality = UI.PreferHighQuality.controlClass.checked;

		// === Rating Filter ===
		const rawRating = Number.isFinite(UI.MinRating.controlClass.value)
			? Math.max(0, Math.min(100, UI.MinRating.controlClass.value))
			: 0;
		this.config.MinRating = rawRating;
		this.config.IncludeUnrated = UI.IncludeUnrated.controlClass.checked;

		// === Auto-Mode ===
		// Get auto-mode state from addon if available, otherwise from checkbox
		let autoEnabled = false;
		try {
			if (typeof window.matchMonkey?.isAutoEnabled === 'function') {
				autoEnabled = Boolean(window.matchMonkey.isAutoEnabled());
			} else {
				autoEnabled = Boolean(UI.AutoModeEnabled.controlClass.checked);
			}
		} catch (e) {
			autoEnabled = Boolean(UI.AutoModeEnabled.controlClass.checked);
		}
		this.config.AutoModeEnabled = autoEnabled;
		this.config.AutoModeDiscovery = UI.AutoModeDiscovery.controlClass.value || 'Track';
		this.config.AutoModeSeedLimit = parseInt(UI.AutoModeSeedLimit.controlClass.value, 10) || 2;
		this.config.AutoModeSimilarLimit = parseInt(UI.AutoModeSimilarLimit.controlClass.value, 10) || 10;
		this.config.AutoModeTracksPerArtist = parseInt(UI.AutoModeTracksPerArtist.controlClass.value, 10) || 5;
		this.config.AutoModeMaxTracks = parseInt(UI.AutoModeMaxTracks.controlClass.value, 10) || 30;
		this.config.SkipDuplicates = UI.SkipDuplicates.controlClass.checked;

		// === Queue Behavior ===
		this.config.EnqueueMode = UI.EnqueueMode.controlClass.checked;
		this.config.ClearQueueFirst = UI.ClearQueueFirst.controlClass.checked;
		this.config.NavigateAfter = UI.NavigateAfter.controlClass.value || 'Navigate to new playlist';

		// === Filters ===
		this.config.ArtistBlacklist = UI.ArtistBlacklist.controlClass.value || '';
		this.config.GenreBlacklist = UI.GenreBlacklist.controlClass.value || '';
		this.config.TitleExclusions = UI.TitleExclusions.controlClass.value || '';

		// Save all settings
		try {
			app.setValue(SCRIPT_ID, this.config);
			console.log('Match Monkey Options: Settings saved');
		} catch (e) {
			console.error('Match Monkey Options: Failed to save:', e.toString());
		}

	} catch (e) {
		console.error('Match Monkey Options: save error:', e.toString());
	}
};
