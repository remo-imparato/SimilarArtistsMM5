/**
 * SimilarArtists Options Panel for MediaMonkey 5
 * 
 * @author Remo Imparato
 * @version 1.0.0
 * @description Configuration panel for SimilarArtists add-on in MM5 Tools > Options.
 *              Provides UI for configuring Last.fm API settings, playlist creation options,
 *              filters, and automatic behavior.
 * 
 * @repository https://github.com/remo-imparato/SimilarArtistsMM5
 * @license MIT
 * 
 * Features:
 * - Last.fm API key configuration
 * - Playlist naming and creation modes
 * - Artist/track limits and filtering options
 * - Rating-based filtering
 * - Parent playlist selection
 * - Auto-enqueue and navigation settings
 * 
 * Requirements:
 * - MediaMonkey 5.0+
 * - SimilarArtists add-on installed
 * 
 * NOTE: This panel reads configuration from app.getValue('SimilarArtists')
 *       Default values are set by install.js during addon installation
 */

// Helper functions to read/write settings from system config
function getSetting(key) {
	try {
		const allSettings = app.getValue('SimilarArtists', {});
		return allSettings[key];
	} catch (e) {
		console.error('SimilarArtists Options: Error reading setting:', key, e);
		return undefined;
	}
}

function setSetting(key, value) {
	try {
		const allSettings = app.getValue('SimilarArtists', {});
		allSettings[key] = value;
		app.setValue('SimilarArtists', allSettings);
	} catch (e) {
		console.error('SimilarArtists Options: Error saving setting:', key, e);
	}
}

optionPanels.pnl_Library.subPanels.pnl_SimilarArtists.load = async function (sett, pnl, wndParams) {
	try {
		// Read ALL configuration from system storage (set by install.js)
		this.config = app.getValue('SimilarArtists', {});

		// Verify config exists (should have been created by install.js)
		if (!this.config || Object.keys(this.config).length === 0) {
			console.warn('SimilarArtists Options: No configuration found! Install script may not have run.');
			return;
		}

		var UI = getAllUIElements(pnl);

		// Load all settings from system config with proper defaults matching install.js
		UI.SAApiKey.controlClass.value = this.config.ApiKey || '7fd988db0c4e9d8b12aed27d0a91a932';
		UI.SAConfirm.controlClass.checked = Boolean(this.config.Confirm);

		// Handle legacy Limit vs new SeedLimit/SimilarLimit
		const seedLimit = this.config.SeedLimit || 20;
		const similarLimit = this.config.SimilarLimit || 30;
		UI.SALimit.controlClass.value = seedLimit || similarLimit || 20;

		UI.SAName.controlClass.value = this.config.Name || '- Similar to %';
		UI.SATPA.controlClass.value = this.config.TPA || 30;
		UI.SATPL.controlClass.value = this.config.TPL || 1000;
		UI.SARandom.controlClass.checked = Boolean(this.config.Random);
		UI.SASeed.controlClass.checked = Boolean(this.config.Seed);
		UI.SABest.controlClass.checked = Boolean(this.config.Best);
		UI.SARank.controlClass.checked = Boolean(this.config.Rank);

		// Rating control setup
		const ratingValue = parseInt(this.config.Rating, 10) || 0;

		const setRatingWhenReady = (uiRatingControl, val) => {
			if (!uiRatingControl || !uiRatingControl.controlClass) return;
			const ctrl = uiRatingControl.controlClass;
			const apply = () => {
				try { ctrl.setRating(val, { force: true, disableChangeEvent: true }); }
				catch (e) { ctrl.value = val; }
			};

			if (ctrl._initialized && Array.isArray(ctrl.stars) && ctrl.stars.length) {
				apply();
				return;
			}

			const onLoad = () => {
				try { apply(); } finally { app.unlisten(ctrl.container, 'load', onLoad); }
			};
			app.listen(ctrl.container, 'load', onLoad);
		};

		setRatingWhenReady(UI.SARating, ratingValue);

		UI.SAUnknown.controlClass.checked = Boolean(this.config.Unknown);
		UI.SAOverwrite.controlClass.value = this.config.Overwrite || 'Create new playlist';
		UI.SAEnqueue.controlClass.checked = Boolean(this.config.Enqueue);
		UI.SANavigate.controlClass.value = this.config.Navigate || 'None';

		// Auto-mode checkbox
		const setOnPlayCheckbox = () => {
			try {
				if (window.SimilarArtists?.isAutoEnabled) {
					UI.SAOnPlay.controlClass.checked = Boolean(window.SimilarArtists.isAutoEnabled());
				} else {
					UI.SAOnPlay.controlClass.checked = Boolean(this.config.OnPlay);
				}
			} catch (e) {
				UI.SAOnPlay.controlClass.checked = Boolean(this.config.OnPlay);
			}
		};

		setOnPlayCheckbox();

		// Checkbox change listener
		const onPlayCheckboxChanged = () => {
			try {
				if (window.SimilarArtists?.toggleAuto) {
					const currentModuleState = Boolean(window.SimilarArtists.isAutoEnabled?.());
					const checkboxState = Boolean(UI.SAOnPlay.controlClass.checked);

					if (currentModuleState !== checkboxState) {
						window.SimilarArtists.toggleAuto();
					}
				}
			} catch (e) {
				console.error('Similar Artists: OnPlay checkbox change error:', e);
			}
		};

		if (UI.SAOnPlay?.controlClass?.container) {
			app.listen(UI.SAOnPlay.controlClass.container, 'change', onPlayCheckboxChanged);
		}

		// Listen for auto-mode changes from other sources
		const onAutoModeChanged = (event) => {
			try {
				if (event.detail && event.detail.enabled !== undefined) {
					UI.SAOnPlay.controlClass.checked = Boolean(event.detail.enabled);
				}
			} catch (e) {
				console.error('Similar Artists: Auto-mode event handler error:', e);
			}
		};

		this._autoModeListener = onAutoModeChanged;
		window.addEventListener('similarartists:automodechanged', onAutoModeChanged);

		UI.SAClearNP.controlClass.checked = Boolean(this.config.ClearNP);
		UI.SAIgnore.controlClass.checked = Boolean(this.config.Ignore);
		UI.SAParent.controlClass.value = this.config.Parent || '';
		UI.SAExclude.controlClass.value = this.config.Exclude || '';
		UI.SABlack.controlClass.value = this.config.Black || '';
		UI.SAGenre.controlClass.value = this.config.Genre || '';

	} catch (e) {
		console.error('Similar Artists: load error: ' + e.toString());
	}
}

optionPanels.pnl_Library.subPanels.pnl_SimilarArtists.save = function (sett) {
	try {
		// Clean up event listener
		if (this._autoModeListener) {
			window.removeEventListener('similarartists:automodechanged', this._autoModeListener);
			this._autoModeListener = null;
		}

		var UI = getAllUIElements();

		// Read current config from system
		this.config = app.getValue('SimilarArtists', {});

		// Update all values
		this.config.ApiKey = UI.SAApiKey.controlClass.value;
		this.config.Confirm = UI.SAConfirm.controlClass.checked;
		this.config.SeedLimit = UI.SALimit.controlClass.value;
		this.config.SimilarLimit = UI.SALimit.controlClass.value;
		this.config.Name = UI.SAName.controlClass.value;
		this.config.TPA = UI.SATPA.controlClass.value;
		this.config.TPL = UI.SATPL.controlClass.value;
		this.config.Random = UI.SARandom.controlClass.checked;
		this.config.Seed = UI.SASeed.controlClass.checked;
		this.config.Best = UI.SABest.controlClass.checked;
		this.config.Rank = UI.SARank.controlClass.checked;
		this.config.Parent = UI.SAParent.controlClass.value;

		const rawRating = Number.isFinite(UI.SARating.controlClass.value) ?
			Math.max(0, Math.min(100, UI.SARating.controlClass.value)) : 0;
		this.config.Rating = String(rawRating);

		this.config.Unknown = UI.SAUnknown.controlClass.checked;
		this.config.Overwrite = UI.SAOverwrite.controlClass.value;
		this.config.Enqueue = UI.SAEnqueue.controlClass.checked;
		this.config.Navigate = UI.SANavigate.controlClass.value;

		// Auto-mode state
		let actualAutoState = false;
		try {
			if (typeof window.SimilarArtists?.isAutoEnabled === 'function') {
				actualAutoState = Boolean(window.SimilarArtists.isAutoEnabled());
			} else {
				actualAutoState = Boolean(UI.SAOnPlay.controlClass.checked);
			}
		} catch (e) {
			console.error('Similar Artists: Error reading auto state:', e);
			actualAutoState = Boolean(UI.SAOnPlay.controlClass.checked);
		}

		this.config.OnPlay = actualAutoState;
		this.config.ClearNP = UI.SAClearNP.controlClass.checked;
		this.config.Ignore = UI.SAIgnore.controlClass.checked;
		this.config.Exclude = UI.SAExclude.controlClass.value;
		this.config.Black = UI.SABlack.controlClass.value;
		this.config.Genre = UI.SAGenre.controlClass.value;

		// Save ALL settings back to system
		try {
			app.setValue('SimilarArtists', this.config);
		} catch (e) {
			console.error('Similar Artists: save: failed to persist settings:', e.toString());
		}

		console.log('Similar Artists: Settings saved successfully');

	} catch (e) {
		console.error('Similar Artists: save error: ' + e.toString());
	}
}
