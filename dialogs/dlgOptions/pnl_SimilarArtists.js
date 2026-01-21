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
 */

// Helper get/set that use the SimilarArtists namespace
function setSetting(key, value) {
	try {
		app.setValue?.('SimilarArtists', key, value);
	} catch (e) {
		// fallback
		try { app.setValue && app.setValue(key, value); } catch (e) { }
	}
}

function getSetting(key, defaultValue) {
	try {
		const v = app.getValue?.('SimilarArtists', key);
		return (v === undefined || v === null) ? defaultValue : v;
	} catch (e) {
		try { return app.getValue ? app.getValue(key, defaultValue) : defaultValue; } catch (e) { return defaultValue; }
	}
}

function intSetting(key) {
	const v = getSetting(key, defaults[key]);
	return parseInt(v, 10) || 0;
}

function boolSetting(key) {
	const v = getSetting(key, defaults[key]);
	return Boolean(v);
}

function stringSetting(key) {
	const v = getSetting(key, defaults[key]);
	return v == null ? '' : String(v);
}

// Defaults matching similarArtists.js
const defaults = {
	ApiKey: app?.utils?.web?.getAPIKey('lastfmApiKey') || '7fd988db0c4e9d8b12aed27d0a91a932',
	Confirm: false,
	Limit: 5,
	SeedLimit: 5,
	SimilarLimit: 5,
	Name: '- Similar to %',
	TPA: 9999,
	TPL: 9999,
	Random: false,
	Seed: false,
	Best: true,
	Rank: true,
	Rating: 0,
	Unknown: true,
	Overwrite: 'Create new playlist',
	Enqueue: false,
	Navigate: 'None',
	OnPlay: false,
	ClearNP: false,
	Ignore: false,
	Parent: 'Similar Artists Playlists',
	Black: '',
	Exclude: '',
	Genre: '',
};

optionPanels.pnl_Library.subPanels.pnl_SimilarArtists.load = async function (sett, pnl, wndParams) {
	try {
		this.config = app.getValue('SimilarArtists', defaults);

		var UI = getAllUIElements(pnl);
		UI.SAApiKey.controlClass.value = this.config.ApiKey;
		UI.SAConfirm.controlClass.checked = this.config.Confirm;
		// UI has a single field (`SALimit`). Prefer explicit values; fallback to legacy `Limit`.
		const legacyLimit = this.config.Limit;
		const seedLimit = (this.config.SeedLimit === undefined || this.config.SeedLimit === null) ? legacyLimit : this.config.SeedLimit;
		const similarLimit = (this.config.SimilarLimit === undefined || this.config.SimilarLimit === null) ? legacyLimit : this.config.SimilarLimit;
		// Keep existing UI as-is: represent the effective value (seed and similar share the same control for now).
		UI.SALimit.controlClass.value = seedLimit || similarLimit || legacyLimit;
		UI.SAName.controlClass.value = this.config.Name;
		UI.SATPA.controlClass.value = this.config.TPA;
		UI.SATPL.controlClass.value = this.config.TPL;
		UI.SARandom.controlClass.checked = this.config.Random;
		UI.SASeed.controlClass.checked = this.config.Seed;
		UI.SABest.controlClass.checked = this.config.Best;
		UI.SARank.controlClass.checked = this.config.Rank;

		// Rating control API: `value` is -1..100; -1 is allowed only when `useUnknown=true`.
		// Persist behavior:
		// - `Unknown` == true means "include unknown" and the control is allowed to use -1.
		// - `Rating` stores the minimum rating (0..100). When Unknown is true and Rating is 0,
		//   we show -1 in the control to represent "no minimum, include unknown".
		const allowUnknown = Boolean(this.config.Unknown);
		const ratingValueRaw = (this.config.Rating === undefined || this.config.Rating === null) ? 0 : parseInt(this.config.Rating, 10);
		const ratingValue = Number.isFinite(ratingValueRaw) ? Math.max(0, Math.min(100, ratingValueRaw)) : 0;

		// Ensure rating controls render correctly on load by forcing the rating update
		const setRatingWhenReady = (uiRatingControl, val) => {
			if (!uiRatingControl || !uiRatingControl.controlClass) return;
			const ctrl = uiRatingControl.controlClass;
			const apply = () => {
				try { ctrl.setRating(val, { force: true, disableChangeEvent: true }); }
				catch (e) { ctrl.value = val; }
			};

			// If already initialized and stars exist, apply now
			if (ctrl._initialized && Array.isArray(ctrl.stars) && ctrl.stars.length) {
				apply();
				return;
			}

			// Otherwise listen for the rating control's 'load' event
			const onLoad = () => {
				try { apply(); } finally { app.unlisten(ctrl.container, 'load', onLoad); }
			};
			app.listen(ctrl.container, 'load', onLoad);
		};

		// Usage
		setRatingWhenReady(UI.SARating, ratingValue);

		UI.SAUnknown.controlClass.checked = allowUnknown;
		UI.SAOverwrite.controlClass.value = this.config.Overwrite;
		UI.SAEnqueue.controlClass.checked = this.config.Enqueue;
		UI.SANavigate.controlClass.value = this.config.Navigate;

		// Options panel can be loaded in a different window context than the main UI,
		// so window.SimilarArtists may not be present. Try to load it; otherwise fallback to stored setting.
		const setOnPlayCheckbox = () => {
			try {
				if (window.SimilarArtists?.isAutoEnabled) {
					UI.SAOnPlay.controlClass.checked = Boolean(window.SimilarArtists.isAutoEnabled());
				} else {
					UI.SAOnPlay.controlClass.checked = this.config.OnPlay;
				}
			} catch (e) {
				UI.SAOnPlay.controlClass.checked = this.config.OnPlay;
			}
		};

		// Set checkbox now that we've attempted to ensure module is loaded
		setOnPlayCheckbox();

		UI.SAClearNP.controlClass.checked = this.config.ClearNP;
		UI.SAIgnore.controlClass.checked = this.config.Ignore;
		UI.SAParent.controlClass.value = this.config.Parent;
		UI.SAExclude.controlClass.value = this.config.Exclude;
		UI.SABlack.controlClass.value = this.config.Black;
		UI.SAGenre.controlClass.value = this.config.Genre;

	} catch (e) {
		console.error('Similar Artists: load error: ' + e.toString());
	}
}

optionPanels.pnl_Library.subPanels.pnl_SimilarArtists.save = function (sett) {
	try {
		var UI = getAllUIElements();

		this.config.ApiKey = UI.SAApiKey.controlClass.value;
		this.config.Confirm = UI.SAConfirm.controlClass.checked;
		// Persist both explicit settings using the single UI value.
		this.config.SeedLimit = UI.SALimit.controlClass.value;
		this.config.SimilarLimit = UI.SALimit.controlClass.value;
		// Also persist legacy `Limit` for compatibility with older builds.
		this.config.Limit = UI.SALimit.controlClass.value;
		this.config.Name = UI.SAName.controlClass.value;
		this.config.TPA = UI.SATPA.controlClass.value;
		this.config.TPL = UI.SATPL.controlClass.value;
		this.config.Random = UI.SARandom.controlClass.checked;
		this.config.Seed = UI.SASeed.controlClass.checked;
		this.config.Best = UI.SABest.controlClass.checked;
		this.config.Rank = UI.SARank.controlClass.checked;
		this.config.Parent = UI.SAParent.controlClass.value;

		// Rating control stores a normalized value in range 0-100; -1 only when useUnknown is enabled.
		// Explicitly persist as string to match text input control behavior.
		const rawRating = Number.isFinite(UI.SARating.controlClass.value) ? Math.max(0, Math.min(100, UI.SARating.controlClass.value)) : 0;
		this.config.Rating = String(rawRating);

		this.config.Unknown = UI.SAUnknown.controlClass.checked;
		this.config.Overwrite = UI.SAOverwrite.controlClass.value;
		this.config.Enqueue = UI.SAEnqueue.controlClass.checked;
		this.config.Navigate = UI.SANavigate.controlClass.value;
		// Detect real Auto OnPlay state: prefer module API when available, otherwise use checkbox
		let isAutoEnabled = Boolean(UI.SAOnPlay.controlClass.checked);
		try {
			if (typeof window.SimilarArtists?.isAutoEnabled === 'function') {
				isAutoEnabled = Boolean(window.SimilarArtists.isAutoEnabled());
			}
		} catch (e) {
			// ignore and fall back to checkbox
		}
		this.config.OnPlay = isAutoEnabled;

		this.config.ClearNP = UI.SAClearNP.controlClass.checked;
		this.config.Ignore = UI.SAIgnore.controlClass.checked;

		this.config.Exclude = UI.SAExclude.controlClass.value;
		this.config.Black = UI.SABlack.controlClass.value;
		this.config.Genre = UI.SAGenre.controlClass.value;

		// Update settings
		try {
			if (app && typeof app.setValue === 'function') {
				app.setValue('SimilarArtists', this.config);
			} else {
				// Fallback: try global setValue if available
				if (typeof setValue === 'function') setValue('SimilarArtists', this.config);
			}
		} catch (e) {
			console.error('Similar Artists: save: failed to persist settings via app.setValue: ' + e.toString());
		}

		// Report updated values for debug
		console.log('Similar Artists: save: updated settings:', JSON.stringify(this.config, null, 2));

	} catch (e) {
		console.error('Similar Artists: save error: ' + e.toString());
	}
}
