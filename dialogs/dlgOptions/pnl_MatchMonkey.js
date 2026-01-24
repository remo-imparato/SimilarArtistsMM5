/**
 * MatchMonkey Options Panel for MediaMonkey 5
 * 
 * MediaMonkey 5 API Only
 * 
 * @author Remo Imparato
 * @version 2.0.0
 * @description Configuration panel for MatchMonkey add-on in MM5 Tools > Options.
 *              Provides UI for configuring Last.fm API settings, playlist creation options,
 *              filters, and automatic behavior.
 * 
 * @repository https://github.com/remo-imparato/SimilarArtistsMM5
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
optionPanels.pnl_Library.subPanels.pnl_MatchMonkey.load = async function(sett, pnl, wndParams) {
	try {
		// Read configuration from system storage
		this.config = app.getValue(SCRIPT_ID, {});

		// Verify config exists
		if (!this.config || Object.keys(this.config).length === 0) {
			console.warn('Match Monkey Options: No configuration found');
			return;
		}

		const UI = getAllUIElements(pnl);

		// Load all settings from config
		UI.SAApiKey.controlClass.value = this.config.ApiKey || '7fd988db0c4e9d8b12aed27d0a91a932';
		UI.SAConfirm.controlClass.checked = Boolean(this.config.Confirm);

		// Handle seed/similar limit
		const seedLimit = this.config.SeedLimit || this.config.similarLimit || 20;
		UI.SALimit.controlClass.value = seedLimit;

		UI.SAName.controlClass.value = this.config.Name || '- Similar to %';
		UI.SATPA.controlClass.value = this.config.TPA || 30;
		UI.SATPL.controlClass.value = this.config.TPL || 1000;
		UI.SARandom.controlClass.checked = Boolean(this.config.Random);
		UI.SASeed.controlClass.checked = Boolean(this.config.Seed);
		UI.SABest.controlClass.checked = Boolean(this.config.Best);
		UI.SARank.controlClass.checked = Boolean(this.config.Rank);

		// Rating control
		const ratingValue = parseInt(this.config.Rating, 10) || 0;
		this._setRatingControl(UI.SARating, ratingValue);

		UI.SAUnknown.controlClass.checked = Boolean(this.config.Unknown);
		UI.SAOverwrite.controlClass.value = this.config.Overwrite || 'Create new playlist';
		
		// Auto-mode discovery type dropdown (Artist/Track/Genre)
		UI.SAAutoMode.controlClass.value = this.config.AutoMode || 'Track';
		
		UI.SAEnqueue.controlClass.checked = Boolean(this.config.Enqueue);
		UI.SANavigate.controlClass.value = this.config.Navigate || 'None';

		// Auto-mode checkbox
		this._setupAutoModeCheckbox(UI.SAOnPlay);

		UI.SAClearNP.controlClass.checked = Boolean(this.config.ClearNP);
		UI.SAIgnore.controlClass.checked = Boolean(this.config.Ignore);
		UI.SAParent.controlClass.value = this.config.Parent || '';
		UI.SAExclude.controlClass.value = this.config.Exclude || '';
		UI.SABlack.controlClass.value = this.config.Black || '';
		UI.SAGenre.controlClass.value = this.config.Genre || '';

	} catch (e) {
		console.error('Match Monkey Options: load error:', e.toString());
	}
};

/**
 * Helper to set rating control value.
 */
optionPanels.pnl_Library.subPanels.pnl_MatchMonkey._setRatingControl = function(uiRatingControl, value) {
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
optionPanels.pnl_Library.subPanels.pnl_MatchMonkey._setupAutoModeCheckbox = function(uiCheckbox) {
	// Set initial state
	try {
		if (window.matchMonkey?.isAutoEnabled) {
			uiCheckbox.controlClass.checked = Boolean(window.matchMonkey.isAutoEnabled());
		} else {
			uiCheckbox.controlClass.checked = Boolean(this.config.OnPlay);
		}
	} catch (e) {
		uiCheckbox.controlClass.checked = Boolean(this.config.OnPlay);
	}

	// Change handler
	const onCheckboxChanged = () => {
		try {
			const desired = Boolean(uiCheckbox.controlClass.checked);
			setSetting('OnPlay', desired);

			// Sync with addon
			if (window.matchMonkey?.toggleAuto) {
				const current = Boolean(window.matchMonkey.isAutoEnabled?.());
				if (current !== desired) {
					window.matchMonkey.toggleAuto();
				}
			}
		} catch (e) {
			console.error('Match Monkey Options: OnPlay change error:', e);
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
	window.addEventListener('similarartists:automodechanged', onAutoModeChanged);
};

/**
 * Save handler - persists UI control values to settings.
 */
optionPanels.pnl_Library.subPanels.pnl_MatchMonkey.save = function(sett) {
	try {
		// Clean up event listener
		if (this._autoModeListener) {
			window.removeEventListener('similarartists:automodechanged', this._autoModeListener);
			this._autoModeListener = null;
		}

		const UI = getAllUIElements();

		// Read current config
		this.config = app.getValue(SCRIPT_ID, {});

		// Update all values from UI
		this.config.ApiKey = UI.SAApiKey.controlClass.value;
		this.config.Confirm = UI.SAConfirm.controlClass.checked;
		this.config.SeedLimit = UI.SALimit.controlClass.value;
		this.config.similarLimit = UI.SALimit.controlClass.value;
		this.config.Name = UI.SAName.controlClass.value;
		this.config.TPA = UI.SATPA.controlClass.value;
		this.config.TPL = UI.SATPL.controlClass.value;
		this.config.Random = UI.SARandom.controlClass.checked;
		this.config.Seed = UI.SASeed.controlClass.checked;
		this.config.Best = UI.SABest.controlClass.checked;
		this.config.Rank = UI.SARank.controlClass.checked;
		this.config.Parent = UI.SAParent.controlClass.value;

		// Rating value
		const rawRating = Number.isFinite(UI.SARating.controlClass.value) 
			? Math.max(0, Math.min(100, UI.SARating.controlClass.value)) 
			: 0;
		this.config.Rating = String(rawRating);

		this.config.Unknown = UI.SAUnknown.controlClass.checked;
		this.config.Overwrite = UI.SAOverwrite.controlClass.value;
		
		// Auto-mode discovery type dropdown (Artist/Track/Genre)
		this.config.AutoMode = UI.SAAutoMode.controlClass.value;
		
		this.config.Enqueue = UI.SAEnqueue.controlClass.checked;
		this.config.Navigate = UI.SANavigate.controlClass.value;

		// Auto-mode state
		let autoState = false;
		try {
			if (typeof window.matchMonkey?.isAutoEnabled === 'function') {
				autoState = Boolean(window.matchMonkey.isAutoEnabled());
			} else {
				autoState = Boolean(UI.SAOnPlay.controlClass.checked);
			}
		} catch (e) {
			autoState = Boolean(UI.SAOnPlay.controlClass.checked);
		}

		this.config.OnPlay = autoState;
		this.config.ClearNP = UI.SAClearNP.controlClass.checked;
		this.config.Ignore = UI.SAIgnore.controlClass.checked;
		this.config.Exclude = UI.SAExclude.controlClass.value;
		this.config.Black = UI.SABlack.controlClass.value;
		this.config.Genre = UI.SAGenre.controlClass.value;

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
