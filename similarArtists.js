/**
 * SimilarArtists Add-on for MediaMonkey 5
 * 
 * @author Remo Imparato
 * @version 1.0.0
 * @description Generates playlists or queues tracks from similar artists using Last.fm API.
 *              Supports automatic mode to queue similar tracks when approaching end of playlist.
 * 
 * @repository https://github.com/remo-imparato/SimilarArtistsMM5
 * @license MIT
 * 
 * Features:
 * - Query Last.fm for similar artists based on selected/playing track
 * - Find matching tracks in local MediaMonkey library
 * - Create playlists or add to Now Playing queue
 * - Automatic mode: auto-queue similar tracks near end of playlist
 * - Ranking mode: prioritize popular tracks from similar artists
 * - Extensive filtering options (genre, rating, title exclusions)
 * 
 * Requirements:
 * - MediaMonkey 5.0+ 
 * - Last.fm API key (default provided, customizable in settings)
 * - Internet connection for Last.fm API queries
 */

/*
// Debug tooling is optional. Only register after the addon module exists.
try {
	requirejs('helpers/debugTools');
	if (window.SimilarArtists && typeof registerDebuggerEntryPoint === 'function') {
		registerDebuggerEntryPoint.call(window.SimilarArtists, 'start');
	}
} catch (e) {
	// ignore
}
//*/

(function (globalArg) {
	'use strict';

	// Script namespace used for settings, menu/action ids, and logging.
	const SCRIPT_ID = 'SimilarArtists';
	// Menu/action identifiers (used by MediaMonkey add-on framework when wiring UI actions).
	const MENU_RUN_ID = SCRIPT_ID + '.menu.run';
	const MENU_AUTO_ID = SCRIPT_ID + '.menu.toggleAuto';
	const ACTION_RUN_ID = SCRIPT_ID + '.run';
	const ACTION_AUTO_ID = SCRIPT_ID + '.toggleAuto';
	// Toolbar button identifiers.
	const TOOLBAR_RUN_ID = 'sa-run';
	const TOOLBAR_AUTO_ID = 'sa-auto';
	// Settings sheet identifier (Options page integration).
	const SETTINGS_SHEET_ID = SCRIPT_ID + '.settings';
	// Last.fm API base endpoint.
	const API_BASE = 'https://ws.audioscrobbler.com/2.0/';

	// Default settings (kept commented-out here because this add-on reads defaults from the Options page).
	const defaults = {
		Name: '- Similar to %',
	};

	// Per-run caches for Last.fm queries (cleared on each runSimilarArtists invocation).
	let lastfmRunCache = null;

	function initLastfmRunCache() {
		lastfmRunCache = {
			similarArtists: new Map(), // key: normalized artist name -> artists[]
			topTracks: new Map(), // key: normalized artist name + '|' + limit -> titles[]
		};
	}

	function clearLastfmRunCache() {
		lastfmRunCache = null;
	}

	function cacheKeyArtist(name) {
		return String(name || '').trim().toUpperCase();
	}

	function cacheKeyTopTracks(artistName, limit, withPlaycount = false) {
		return `${cacheKeyArtist(artistName)}|${Number(limit) || ''}|pc:${withPlaycount ? 1 : 0}`;
	}

	// Runtime state for the add-on (not persisted).
	const state = {
		// Holds the listener subscription for automatic mode so it can be detached.
		autoListen: null,
		// Prevents start() from running more than once.
		started: false,
		// Used by long-running operations to support cancellation (UI not currently exposed).
		cancelled: false,
		// Prevent multiple auto-run invocations while one is in progress.
		autoRunning: false,
	};

	// Normalize errors for logging
	function formatError(err) {
		try {
			if (!err) return 'Unknown error';
			if (err.stack) return String(err.stack);
			if (err.message) return `${err.name ? err.name + ': ' : ''}${err.message}`;
			if (typeof err === 'object') return JSON.stringify(err);
			return String(err);
		} catch (_) {
			return String(err);
		}
	}

	/**
	 * Display a toast-like UI notification when possible, otherwise fallback to logging.
	 * @param {string} text Toast message.
	 * @param {object} options Toast options object (implementation-specific).
	 */
	function showToast(text, options = {}) {
		try {
			// Use uitools.toastMessage.show (MM5 API)
			if (typeof uitools !== 'undefined' && uitools?.toastMessage?.show) {
				uitools.toastMessage.show(text, options);
				return;
			}
			// Fallback to console log
			console.log('Similar Artists: ' + text);
		} catch (e) {
			console.error('Similar Artists: showToast error: ' + e.toString());
		}
	}

	/**
	 * Get the Last.fm API key from MediaMonkey settings with a built-in fallback.
	 * @returns {string} API key.
	 */
	function getApiKey() {
		return getSetting('ApiKey', '7fd988db0c4e9d8b12aed27d0a91a932');
	}

	/**
	 * Read a setting stored under this script's namespace.
	 * @param {string} key Setting name.
	 * @param {*} fallback Value returned when setting is missing.
	 * @returns {*} Stored value or fallback.
	 */
	function getSetting(key, fallback) {
		if (typeof app === 'undefined' || !app.getValue)
			return fallback;

		let val = app.getValue(SCRIPT_ID, {});
		val = val[key];
		switch (val) {
			case undefined:
			case null:
				return fallback;
		}

		return val;
	}

	/**
	 * Persist a setting under this script's namespace.
	 * Note: MM5's app.setValue stores the entire config object, not individual keys.
	 * @param {string} key Setting name.
	 * @param {*} value Setting value.
	 */
	function setSetting(key, value) {
		if (typeof app === 'undefined' || !app.setValue || !app.getValue) return;

		// MM5 stores settings as complete objects, so we need to:
		// 1. Get the current config object
		// 2. Update the specific key
		// 3. Save the entire object back
		const config = app.getValue(SCRIPT_ID, {});
		config[key] = value;
		app.setValue(SCRIPT_ID, config);
	}

	/**
	 * Get a setting coerced to integer.
	 * @param {string} key Setting key.
	 * @returns {number}
	 */
	function intSetting(key) {
		const v = getSetting(key, defaults[key]);
		// Rating and other numeric settings can come in as strings or as objects; be defensive
		if (v === undefined || v === null) return 0;
		if (typeof v === 'number') return v;
		const n = parseInt(String(v), 10);
		return Number.isFinite(n) ? n : 0;
	}

	/**
	 * Get a setting coerced to string.
	 * @param {string} key Setting key.
	 * @returns {string}
	 */
	function stringSetting(key) {
		return String(getSetting(key, defaults[key] || ''));
	}

	/**
	 * Get a setting coerced to boolean.
	 * @param {string} key Setting key.
	 * @returns {boolean}
	 */
	function boolSetting(key) {
		const val = getSetting(key, defaults[key]);
		if (val === true || val === false) return val;
		if (typeof val === 'string') {
			const v = val.trim().toLowerCase();
			if (['true', '1', 'yes', 'on'].includes(v)) return true;
			if (['false', '0', 'no', 'off', ''].includes(v)) return false;
		}
		if (typeof val === 'number') return val !== 0;
		return Boolean(val);
	}

	/**
	 * Get the list of prefix strings to ignore (e.g., "The", "A")
	 * @returns {string[]} Array of prefixes
	 */
	function getIgnorePrefixes() {
		try {
			// 1) Preferred source used by core UI panels
			if (window?.settings && typeof window.settings.get === 'function') {
				const opts = window.settings.get('Options') || {};
				// Some callers store under an Options wrapper, others directly on the object.
				const cfg = opts.Options || opts;
				const enabled = cfg?.IgnoreTHEs;
				const list = cfg?.IgnoreTHEStrings;
				if (enabled) {
					return String(list || 'The').split(',').map((s) => s.trim()).filter((s) => s.length > 0);
				}
			}

			// 2) MM app.settings API (fallback)
			if (app?.settings && typeof app.settings.getValue === 'function') {
				const enabled = app.settings.getValue('IgnoreTHEs', false);
				if (enabled) {
					const list = app.settings.getValue('IgnoreTHEStrings', 'The');
					return String(list || 'The').split(',').map((s) => s.trim()).filter((s) => s.length > 0);
				}
			}

			// 3) Generic app.getValue (another possible storage location)
			if (app?.getValue && typeof app.getValue === 'function') {
				const opts = app.getValue('Options', {}) || {};
				const cfg = opts.Options || opts;
				const enabled = cfg?.IgnoreTHEs;
				const list = cfg?.IgnoreTHEStrings;
				if (enabled) {
					return String(list || 'The').split(',').map((s) => s.trim()).filter((s) => s.length > 0);
				}
			}
		} catch (e) {
			console.error('Similar Artists: getIgnorePrefixes error: ' + e.toString());
		}
		// Default: no prefixes ignored
		return [];
	}

	/**
	 * Fix artist name prefixes for Last.fm API queries
	 * Converts "Beatles, The" or "Beatles (The)" back to "The Beatles"
	 * @param {string} name - Artist name to fix
	 * @returns {string} Fixed artist name
	 */
	function fixPrefixes(name) {
		if (!name) return name;
		let result = name;
		const prefixes = getIgnorePrefixes();

		for (const prefix of prefixes) {
			// Check for "Artist, The" format
			const suffixComma = `, ${prefix}`;
			if (result.toUpperCase().endsWith(suffixComma.toUpperCase())) {
				result = `${prefix} ${result.slice(0, -suffixComma.length)}`;
				break;
			}
			// Check for "Artist (The)" format
			const suffixParen = ` (${prefix})`;
			if (result.toUpperCase().endsWith(suffixParen.toUpperCase())) {
				result = `${prefix} ${result.slice(0, -suffixParen.length)}`;
				break;
			}
		}
		return result;
	}

	/**
	 * Sync the auto-mode toggle UI (toolbar/action icon) with the stored OnPlay setting.
	 */
	function refreshToggleUI() {
		try {
			const iconNum = getSetting('OnPlay', false) ? 32 : 33;
			if (app.toolbar?.setButtonIcon) {
				app.toolbar.setButtonIcon(TOOLBAR_AUTO_ID, iconNum);
			}
			// app.actions is not available in some MM5 builds; ignore if missing.
			if (app.actions?.updateActionIcon) {
				app.actions.updateActionIcon(ACTION_AUTO_ID, iconNum);
			}
		} catch (e) {
			console.error('Similar Artists: ' + e.toString());
		}
	}

	// Sync listener attachment and UI based on stored setting
	function applyAutoModeFromSettings() {
		const enabled = isAutoEnabled();
		if (enabled) {
			attachAuto();
		} else {
			detachAuto();
		}
		refreshToggleUI();
		try {
			if (app.actions?.updateActionIcon)
				app.actions.updateActionIcon(ACTION_AUTO_ID, enabled ? 32 : 33);
			if (app.actions?.updateActionState)
				app.actions.updateActionState(ACTION_AUTO_ID);
			// Ensure window.actions menu checkbox reflects latest state
			if (window.actions?.SimilarArtistsToggleAuto) {
				window.actions.SimilarArtistsToggleAuto.checked = () => Boolean(isAutoEnabled());
				if (app.actions?.updateActionState)
					app.actions.updateActionState(window.actions.SimilarArtistsToggleAuto);
			}
			// Best-effort menu refresh
			window._menuItems?.tools?.action?.invalidate?.();
		} catch (e) {
			console.error('Similar Artists: applyAutoModeFromSettings UI refresh failed: ' + e.toString());
		}
	}

	/**
	 * Toggle automatic mode (run addon when playback reaches end of playlist).
	 */
	function toggleAuto() {
		const next = !getSetting('OnPlay', false);
		setSetting('OnPlay', next);
		applyAutoModeFromSettings();
		console.log(`Similar Artists: Auto-mode ${next ? 'enabled' : 'disabled'}`);
	}

	/**
	 * Attach playback listener for auto-mode.
	 * Listens for 'trackChanged' event to detect when approaching end of playlist.
	 */
	function attachAuto() {
		detachAuto();
		if (typeof app === 'undefined')
			return;
		const player = app.player;
		if (!player)
			return;

		// Use app.listen for MM5 event handling
		if (!app.listen) {
			console.log('Similar Artists: app.listen not available');
			return;
		}

		state.autoListen = app.listen(player, 'playbackState', (newState) => {
			console.log(`Similar Artists: playbackState changed to '${newState}'`);
			if (newState === 'trackChanged') {
				handleAuto();
			}
		});
		console.log('Similar Artists: Auto-mode listener attached');
	}

	/**
	 * Detach playback listener for auto-mode.
	 */
	function detachAuto() {
		if (!state.autoListen)
			return;
		try {
			if (app.unlisten) {
				app.unlisten(state.autoListen);
				console.log('Similar Artists: Auto-mode listener detached');
			}
		} catch (e) {
			console.error('Similar Artists: Error detaching auto-mode listener: ' + e.toString());
		}
		state.autoListen = null;
	}

	/**
	 * Auto-mode handler that triggers when track changes near end of playlist.
	 * Generates similar artist tracks and enqueues them into Now Playing.
	 */
	async function handleAuto() {
		try {
			if (!isAutoEnabled()) {
				console.log('Similar Artists: Auto-mode disabled, skipping handleAuto');
				return;
			}

			const player = app.player;
			if (!player) {
				console.log('Similar Artists: Player not available');
				return;
			}

			// AutoDJ-style remaining entries check (entriesCount - playedCount)
			let remaining = 0;
			try {
				const total = typeof player.entriesCount === 'number' ? player.entriesCount : 0;
				const played = typeof player.getCountOfPlayedEntries === 'function' ? player.getCountOfPlayedEntries() : 0;
				if (total > 0) remaining = total - played;
			} catch (e) {
				console.log('Similar Artists: remaining calculation failed: ' + e.toString());
			}

			// Fallback to playlist cursor/count if entriesCount unavailable
			if (!remaining && player.playlist && typeof player.playlist.getCursor === 'function' && typeof player.playlist.count === 'function') {
				try {
					const cursor = player.playlist.getCursor();
					const count = player.playlist.count();
					remaining = count - cursor;
				} catch (e) {
					console.log('Similar Artists: playlist remaining calculation failed: ' + e.toString());
				}
			}

			console.log(`Similar Artists: Auto check - remaining entries: ${remaining}`);

			// Trigger when 2 or fewer entries remain (similar to AutoDJ behavior)
			if (remaining > 0 && remaining <= 2) {
				if (state.autoRunning) {
					console.log('Similar Artists: Auto-mode already running, skipping duplicate trigger');
					return;
				}
				state.autoRunning = true;
				try {
					console.log('Similar Artists: Near end of playlist, triggering auto-queue');
					await runSimilarArtists(true);
				} finally {
					state.autoRunning = false;
				}
			} else {
				console.log('Similar Artists: Not near end of playlist, skipping auto-queue');
			}
		} catch (e) {
			console.error('Similar Artists: Error in handleAuto: ' + formatError(e));
		}
	}

	/**
	 * Parse a comma-separated string setting into an array.
	 * Accepts either a string (CSV) or an array stored in settings.
	 * @param {string} key Setting key.
	 * @returns {string[]}
	 */
	function parseListSetting(key) {
		try {
			const raw = getSetting(key, defaults[key]);
			if (!raw && raw !== 0) return [];
			// If already an array, normalize elements to trimmed strings
			if (Array.isArray(raw)) {
				return raw.map(s => String(s || '').trim()).filter(s => s.length > 0);
			}
			// If it's a string, split on commas
			if (typeof raw === 'string') {
				return raw.split(',').map(s => s.trim()).filter(s => s.length > 0);
			}
			// If it's a number or other primitive, convert to string
			if (typeof raw === 'number' || typeof raw === 'boolean') {
				return [String(raw)];
			}
			// If it's an object with a toString producing CSV, try that
			try {
				const s = String(raw);
				if (s.indexOf(',') >= 0) return s.split(',').map(x => x.trim()).filter(x => x.length > 0);
				if (s.length) return [s.trim()];
			} catch (e) { }
			return [];
		} catch (e) {
			console.error('Similar Artists: parseListSetting error: ' + e.toString());
			return [];
		}
	}

	/**
	 * Normalize an artist name.
	 * @param {string} name Artist name.
	 * @returns {string}
	 */
	function normalizeName(name) {
		return (name || '').trim();
	}

	/**
	 * Collect seed tracks either from current UI selection (any pane) or current playing track.
	 * Supports multiple selected tracks, each contributing their artist as a seed.
	 * Fallback to current playing track if no selection exists.
	 * @returns {{name: string, track?: object}[]}
	 */
	async function collectSeedTracks() {
		if (typeof app === 'undefined') return [];

		const seeds = [];

		/**
		 * Try to get selected tracklist from whichever pane is active.
		 * Different panes expose selection differently. We try known MM5 patterns.
		 */
		function tryGetSelectedTracklist() {
			try {
				// Most common helper
				if (uitools?.getSelectedTracklist) {
					const tl = uitools.getSelectedTracklist();
					if (tl) return tl;
				}

				// Older / alternative helper used in some contexts
				if (uitools?.getSelectedTrackList) {
					const tl = uitools.getSelectedTrackList();
					if (tl) return tl;
				}

				// If a listview-like datasource is available, it often exposes getSelectedTracklist()
				// (e.g. Now Playing groupedlist/tracklist uses this.dataSource.getSelectedTracklist()).
				if (window?.currentList?.dataSource?.getSelectedTracklist) {
					const tl = window.currentList.dataSource.getSelectedTracklist();
					if (tl) return tl;
				}
			} catch (e) {
				console.error('Similar Artists: collectSeedTracks: tryGetSelectedTracklist error: ' + e.toString());
			}
			return null;
		}

		let selectedList = tryGetSelectedTracklist();


		// Try to iterate selection first; only fall back if we added nothing.
		if (selectedList) {

			await selectedList.whenLoaded();

			try {
				if (typeof selectedList.forEach === 'function') {
					selectedList.forEach((t) => {
						if (t && t.artist) {
							seeds.push({ name: normalizeName(t.artist), track: t });
						}
					});
				} else if (typeof selectedList.getFastObject === 'function' && typeof selectedList.count === 'number') {
					let tmp;
					for (let i = 0; i < selectedList.count; i++) {
						tmp = selectedList.getFastObject(i, tmp);
						if (tmp && tmp.artist) {
							seeds.push({ name: normalizeName(tmp.artist), track: tmp });
						}
					}
				}
			} catch (e) {
				console.error('Similar Artists: collectSeedTracks: error iterating selection: ' + e.toString());
			}


			if (seeds.length > 0) {
				console.log(`collectSeedTracks: Using ${seeds.length} selected track(s) as seed(s)`);
				return seeds;
			}
		}

		// Fallback: use current playing track if no selection
		console.log('Similar Artists: collectSeedTracks: No selection found, falling back to currently playing track');
		const currentTrack = app.player?.getCurrentTrack?.();
		if (currentTrack && currentTrack.artist) {
			console.log(`collectSeedTracks: Current playing track artist = ${currentTrack.artist}`);
			seeds.push({ name: normalizeName(currentTrack.artist), track: currentTrack });
			return seeds;
		}

		console.log('Similar Artists: collectSeedTracks: No tracks found (no selection and no playing track)');
		return [];
	}

	/**
	 * Map a MediaMonkey track object to a simplified structure used by enqueue/playlist creation.
	 * @param {object} track MediaMonkey track.
	 * @returns {object} Track info.
	 */
	var getTrackInfo = function (track) {
		var trackInfo = {
			id: track.id,
			title: track.title,
			album: track.album,
			trackNumber: track.trackNumber,
			duration: Math.floor(track.songLength / 1000), // in seconds
			timestamp: 0, // will be set later on playback start
			nowplayingsent: false
		};
		var artists = track.artist.split(';', 1);
		trackInfo.artist = artists[0];
		artists = track.albumArtist.split(';', 1);
		trackInfo.albumArtist = artists[0];
		console.log('Similar Artists: prepared trackInfo: ' + JSON.stringify(trackInfo));
		return trackInfo;
	};

	/**
	 * De-dupe seed artists while applying blacklist and optional sort.
	 * @param {{name: string, track?: object}[]} seeds Raw seed list.
	 * @returns {{name: string, track?: object}[]} Unique, filtered seed list.
	 */
	function uniqueArtists(seeds) {
		const blacklist = new Set(parseListSetting('Black').map((s) => s.toUpperCase()));
		const set = new Set();
		const res = [];
		seeds.forEach((s) => {
			const key = s.name.toUpperCase();
			if (!set.has(key) && !blacklist.has(key)) {
				set.add(key);
				res.push(s);
			}
		});
		return res;
	}

	/**
	 * Global progress task reference for use across functions
	 */
	let globalProgressTask = null;

	/**
	 * Update progress bar with informative message
	 * @param {string} message Progress message to display
	 * @param {number} value Progress value (0-1)
	 */
	function updateProgress(message, value) {
		if (globalProgressTask) {
			globalProgressTask.text = message;
			if (value !== undefined) {
				globalProgressTask.value = value;
			}
		}
	}

	/**
	 * Process seed artists to find similar artists and their tracks from Last.fm and local library.
	 * @param {Array<{name: string, track?: object}>} seeds Array of seed artist objects.
	 * @param {object} settings Configuration settings for processing.
	 * @param {number} settings.artistLimit Max similar artists per seed.
	 * @param {number} settings.tracksPerArtist Tracks to fetch per artist.
	 * @param {number} settings.totalLimit Total track limit.
	 * @param {boolean} settings.includeSeedArtist Include seed artist in results.
	 * @param {boolean} settings.rankEnabled Enable ranking mode.
	 * @param {boolean} settings.bestEnabled Enable best (highest rated) mode.
	 * @param {Map<number, number>} [trackRankMap] Optional rank map to populate.
	 * @returns {Promise<object[]>} Array of matched track objects.
	 */
	async function processSeedArtists(seeds, settings, trackRankMap = null) {
		const {
			seedLimit,
			similarLimit,
			tracksPerArtist,
			totalLimit,
			includeSeedArtist,
			rankEnabled,
			bestEnabled
		} = settings;

		const allTracks = [];

		// Build blacklist set for this run (case-insensitive)
		const blacklist = new Set(parseListSetting('Black').map(s => String(s || '').toUpperCase()));

		// Track dedupe helper: keep unique track keys to avoid adding duplicates across artists
		const seenTrackKeys = new Set();
		function getTrackKey(t) {
			if (!t) return '';
			const id = t.id || t.ID;
			if (id !== undefined && id !== null && String(id) !== '0') return String(id);
			if (t.path) return `path:${String(t.path)}`;
			// fallback: combine title/album/artist
			return `meta:${String(t.title || t.SongTitle || '')}:${String(t.album || '')}:${String(t.artist || '')}`;
		}

		// Process each seed artist up to configured limit.
		const seedSlice = seeds.slice(0, seedLimit || seeds.length);
		for (let i = 0; i < seedSlice.length; i++) {
			const seed = seedSlice[i];

			// Early exit if we've already reached the total limit
			if (allTracks.length >= totalLimit) break;

			// Update progress: Fetching similar artists
			const seedProgress = (i + 1) / seedSlice.length;
			updateProgress(`Fetching similar artists for "${seed.name}" (${i + 1}/${seedSlice.length})`, seedProgress * 0.3);

			// Use fixPrefixes for the API call
			const artistNameForApi = fixPrefixes(seed.name);
			const similar = await fetchSimilarArtists(artistNameForApi, similarLimit);

			// Build deduplicated pool: optional seed + similar artists
			const seen = new Set();
			const artistPool = [];

			const pushIfNew = (name) => {
				if (!name) return;
				const key = String(name || '').trim().toUpperCase();
				if (!key) return;
				if (seen.has(key)) return;
				seen.add(key);
				// exclude blacklist immediately
				if (blacklist.has(key)) {
					console.log(`Similar Artists: Excluding blacklisted artist from pool: "${name}"`);
					return;
				}
				artistPool.push(name);
			};

			if (includeSeedArtist)
				pushIfNew(seed.name);

			if (Array.isArray(similar)) {
				for (let j = 0; j < (similarLimit || similar.length) && j < similar.length; j++) {
					const a = similar[j];
					if (a && a.name) pushIfNew(a.name);
				}
			}

			updateProgress(`Found ${similar.length} similar artist(s) for "${seed.name}", querying tracks...`, seedProgress * 0.3);

			// Process each artist in the deduped pool using for..of for proper early breaks
			for (const artName of artistPool) {
				// Early exit check
				if (allTracks.length >= totalLimit) break;

				try {
					// Prepare a container for rank titles if we fetch them for ranking
					let rankTitles = null;

					// RANKING MODE: Fetch top tracks and score them
					if (rankEnabled && trackRankMap) {
						updateProgress(`Ranking: Fetching top tracks for "${artName}"...`, seedProgress * 0.3);
						// Fetch once using the configured tracksPerArtist limit (avoid double-fetch)
						rankTitles = await fetchTopTracks(fixPrefixes(artName), tracksPerArtist, true);

						if (rankTitles && rankTitles.length > 0) {
							updateProgress(`Ranking: Batch lookup of ${rankTitles.length} tracks from "${artName}"...`, seedProgress * 0.3);

							const titlesOnly = rankTitles.map(rt => rt.title || rt.name || rt);
							const rankMatches = await findLibraryTracksBatch(artName, titlesOnly, 5, { rank: false, best: bestEnabled });

							let scoredCount = 0;
							for (let rankIdx = 0; rankIdx < rankTitles.length; rankIdx++) {
								const rt = rankTitles[rankIdx];
								const title = rt.title || rt.name || rt;
								const matches = rankMatches.get(title) || [];
								// Use Last.fm 'rank' attribute (lower = better). Fall back to position-based score when absent.
								const trackRankAttr = Number(rt.rank) || 0; // Last.fm provides rank in @attr.rank
								const fallbackScore = 101 - (rankIdx + 1);
								const rankScore = trackRankAttr > 0 ? Math.max(0, 101 - trackRankAttr) : fallbackScore;

								for (const track of matches) {
									const trackId = track.id || track.ID;
									const currentScore = trackRankMap.get(trackId) || 0;
									if (rankScore > currentScore) {
										trackRankMap.set(trackId, rankScore);
										scoredCount++;
									}
								}
							}

							console.log(`Ranking: Scored ${scoredCount} unique tracks from "${artName}"`);
						}
					}

					// COLLECTION MODE: Fetch top N tracks for playlist
					updateProgress(`Collecting: Fetching top ${tracksPerArtist} tracks from "${artName}"...`, seedProgress * 0.3);
					let titles;
					if (rankTitles && rankTitles.length > 0) {
						// Reuse the previously fetched ranked titles to avoid a second API call
						titles = rankTitles.map(rt => rt.title || rt.name || rt).slice(0, tracksPerArtist);
					} else {
						titles = await fetchTopTracks(fixPrefixes(artName), tracksPerArtist);
					}

					if (titles && titles.length > 0) {
						updateProgress(`Collecting: Batch lookup of ${titles.length} tracks from "${artName}"...`, seedProgress * 0.3);

						const matches = await findLibraryTracksBatch(artName, titles, 1, { rank: false, best: bestEnabled });

						let addedFromArtist = 0;
						for (const title of titles) {
							if (allTracks.length >= totalLimit) break;
							const trackMatches = matches.get(title) || [];
							for (const track of trackMatches) {
								// Deduplicate by key across the whole run
								const key = getTrackKey(track);
								if (!key || seenTrackKeys.has(key)) continue;
								seenTrackKeys.add(key);
								allTracks.push(track);
								addedFromArtist++;
								if (allTracks.length >= totalLimit) break;
							}
						}

						console.log(`Collecting: Added ${addedFromArtist} tracks from "${artName}" to playlist`);
					}

				} catch (e) {
					console.error(`Similar Artists: Error processing artist "${artName}": ${e.toString()}`);
				}

				// continue to next artist (for..of handles it)
			}

			// If reached desired total, stop processing further seeds
			if (allTracks.length >= totalLimit) break;
		}

		// Post-filter to ensure no duplicates remain and enforce totalLimit
		try {
			const finalSeen = new Set();
			const filtered = [];
			for (const t of allTracks) {
				const key = getTrackKey(t);
				if (!key) continue;
				if (finalSeen.has(key)) continue;
				finalSeen.add(key);
				filtered.push(t);
				if (filtered.length >= totalLimit) break;
			}
			return filtered;
		} catch (e) {
			console.error('Similar Artists: Error deduplicating final track list: ' + e.toString());
			return allTracks.slice(0, totalLimit);
		}
	}

	/**
	 * Main entry point for generating similar-artist tracks.
	 * Steps:
	 * - Collect seed artists from selection / playing track
	 * - Query Last.fm for similar artists & top tracks
	 * - Match returned tracks against the local MediaMonkey library
	 * - Enqueue into Now Playing or create/overwrite a playlist
	 * @param {boolean} autoRun True when invoked by auto-mode (suppresses completion toast, forces enqueue).
	 */
	async function runSimilarArtists(autoRun) {
		state.cancelled = false;
		initLastfmRunCache();

		try {
			let seedsRaw = await collectSeedTracks();
			if (autoRun && !seedsRaw.length) {
				await sleep(300);
				seedsRaw = await collectSeedTracks();
			}
			const seeds = uniqueArtists(seedsRaw);
			if (!seeds.length) {
				showToast('SimilarArtists: Select at least one track to seed the playlist.');
				return;
			}
			console.log(`SimilarArtists: Collected ${seeds.length} seed artist(s): ${seeds.map(s => s.name).join(', ')}`);

			showToast('SimilarArtists: Running');

			// Load config block stored under this script id.
			var config = app.getValue(SCRIPT_ID, defaults);

			// Create progress task using MM5's backgroundTasks system
			let progressTask = null;
			if (app.backgroundTasks?.createNew) {
				progressTask = app.backgroundTasks.createNew();
				progressTask.leadingText = 'SimilarArtists: Processing playlist...';
				globalProgressTask = progressTask;
				console.log('Similar Artists: SimilarArtists: Progress task created');
			}

			let legacyLimit = intSetting('Limit');
			let seedLimit = intSetting('SeedLimit') || legacyLimit;
			let similarLimit = intSetting('SimilarLimit') || legacyLimit;
			let tracksPerArtist = intSetting('TPA');
			let totalLimit = intSetting('TPL');
			let includeSeedArtist = boolSetting('Seed');
			let randomise = boolSetting('Random');
			let enqueue = boolSetting('Enqueue');
			let ignoreDupes = boolSetting('Ignore');
			let clearNP = boolSetting('ClearNP');
			let overwriteMode = config.Overwrite;
			let confirm = boolSetting('Confirm');
			let rankEnabled = boolSetting('Rank');
			let bestEnabled = boolSetting('Best');

			// In auto-mode, force enqueue and set tighter/default limits
			if (autoRun) {
				enqueue = true;
				// Auto-mode defaults requested by user
				seedLimit = 10; // number of similar artists to process
				similarLimit = 100; // lookup tracks per artist limit
				tracksPerArtist = 2; // add to queue tracks per artist
				totalLimit = 10; // total tracks to add
				// Include the seed artist in auto-mode
				includeSeedArtist = true;
				// Randomize the final trackset in auto-mode
				randomise = true;
				// Always avoid duplicating tracks in Now Playing when auto-queueing
				ignoreDupes = true;
				console.log('Similar Artists: Auto-mode enabled - forcing enqueue to Now Playing with settings: seedLimit=' + seedLimit + ', similarLimit=' + similarLimit + ', tracksPerArtist=' + tracksPerArtist + ', totalLimit=' + totalLimit + ', includeSeedArtist=' + includeSeedArtist + ', randomise=' + randomise);
			}

			// Log settings for debugging
			console.log(`Settings loaded: includeSeedArtist=${includeSeedArtist}, randomise=${randomise}, rankEnabled=${rankEnabled}, bestEnabled=${bestEnabled}`);

			// In-memory rank map: track ID -> rank score (used if rankEnabled)
			const trackRankMap = rankEnabled ? new Map() : null;

			// Process seed artists to find similar artists and tracks
			const allTracks = await processSeedArtists(seeds, {
				seedLimit,
				similarLimit,
				tracksPerArtist,
				totalLimit,
				includeSeedArtist,
				rankEnabled,
				bestEnabled
			}, trackRankMap);

			if (!allTracks.length) {
				showToast('SimilarArtists: No matching tracks found in library.');
				if (progressTask) progressTask.terminate();
				globalProgressTask = null;
				return;
			}

			updateProgress(`Found ${allTracks.length} total tracks. Processing...`, 0.6);

			// Sort by rank score if enabled (before randomizing)
			if (rankEnabled && trackRankMap.size > 0) {
				updateProgress(`Ranking: Sorting ${allTracks.length} tracks by popularity score...`, 0.7);
				allTracks.sort((a, b) => {
					const aScore = trackRankMap.get(a.id || a.ID) || 0;
					const bScore = trackRankMap.get(b.id || b.ID) || 0;
					return bScore - aScore; // Higher score first
				});
			}

			// Optional: randomize final track set.
			if (randomise) {
				updateProgress(`Randomizing ${allTracks.length} tracks...`, 0.75);
				shuffle(allTracks);
			}

			// Either enqueue to Now Playing or create a playlist, depending on settings.
			// In auto-mode, always enqueue to Now Playing
			if (enqueue || autoRun || overwriteMode.toLowerCase().indexOf("do not") > -1) {
				if (autoRun) {
					updateProgress(`Auto-enqueue: Adding ${allTracks.length} tracks to Now Playing...`, 0.8);
					console.log(`SimilarArtists: Auto-enqueue triggered - adding ${allTracks.length} track(s) to Now Playing (ignoreDupes=${ignoreDupes}, clearNP=${clearNP})`);
				} else {
					updateProgress(`Adding ${allTracks.length} tracks to Now Playing...`, 0.8);
				}

				await enqueueTracks(allTracks, ignoreDupes, clearNP);
				if (autoRun) {
					console.log(`SimilarArtists: Auto-enqueue completed - added ${allTracks.length} track(s) to Now Playing`);
				} else {
					console.log(`Enqueued ${allTracks.length} track(s) to Now Playing`);
				}
				updateProgress(`Successfully added ${allTracks.length} tracks to Now Playing!`, 1.0);
			} else {
				const seedName = buildPlaylistTitle(seeds);

				// If confirm is enabled, show dialog to select/create a playlist
				if (confirm) {
					const dialogResult = await confirmPlaylist(seedName, overwriteMode);

					if (dialogResult === null) {
						// User cancelled the dialog
						console.log('Similar Artists: SimilarArtists: User cancelled playlist dialog.');
						updateProgress(`Playlist creation cancelled by user.`, 1.0);
					} else if (dialogResult.autoCreate) {
						// User clicked OK without selecting a playlist - auto-create one
						updateProgress(`Creating new playlist "${seedName}" with ${allTracks.length} tracks...`, 0.85);
						await createPlaylist(allTracks, seedName, overwriteMode, dialogResult, ignoreDupes);
						updateProgress(`Playlist created successfully with ${allTracks.length} tracks!`, 1.0);
					} else {
						// User selected an existing playlist - add tracks to it
						const selectedPlaylist = dialogResult;
						const shouldClear = overwriteMode.toLowerCase().indexOf('overwrite') > -1;

						updateProgress(`Adding ${allTracks.length} tracks to "${selectedPlaylist.name}"...`, 0.85);
						console.log(`SimilarArtists: Adding tracks to user-selected playlist '${selectedPlaylist.name}' (ID: ${selectedPlaylist.id || selectedPlaylist.ID}), shouldClear=${shouldClear}`);

						const added = await addTracksToTarget(selectedPlaylist, allTracks, {
							ignoreDupes: ignoreDupes,
							clearFirst: shouldClear
						});

						console.log(`SimilarArtists: Added ${added} track(s) to playlist '${selectedPlaylist.name}'`);
						updateProgress(`Successfully added ${added} tracks to "${selectedPlaylist.name}"!`, 1.0);
					}
				} else {
					// confirm is disabled, so skip playlist dialog and create automatically
					updateProgress(`Creating new playlist "${seedName}" with ${allTracks.length} tracks...`, 0.85);
					// Pass seedName so createPlaylist will construct the name from template
					await createPlaylist(allTracks, seedName, overwriteMode, null, ignoreDupes);
					updateProgress(`Playlist created successfully with ${allTracks.length} tracks!`, 1.0);
				}
			}

			// Show completion message if confirm is enabled (suppress in auto-mode)
			if (confirm && !autoRun) {
				const count = seeds.length;
				if (count === 1) {
					showToast('SimilarArtists: Artist has been processed.');
				} else {
					showToast(`SimilarArtists: All ${count} artists have been processed.`);
				}
			}

		} catch (e) {
			console.warn(e.msg || e.toString());
			const errText = formatError(e);
			console.error('Similar Artists: runSimilarArtists error: ' + errText);
			updateProgress(`Error: ${errText}`, 1.0);
			showToast('SimilarArtists: An error occurred - see log for details.');
		} finally {
			clearLastfmRunCache();
			// Cleanup progress task
			if (globalProgressTask) {
				// Keep progress visible for 2 seconds after completion
				setTimeout(() => {
					if (globalProgressTask) {
						globalProgressTask.terminate();
						globalProgressTask = null;
					}
				}, 2000);
			}
		}
	}

	/**
	 * Ask user for confirmation before creating/overwriting a playlist.
	 * Opens dlgSelectPlaylist dialog to let user select or create a playlist.
	 * If user clicks OK with a selected/created playlist, return it.
	 * If user clicks OK without selecting a playlist, return a special object indicating auto-create.
	 * If user clicks Cancel, returns null to cancel the operation.
	 * @param {string} seedName Seed artist name used in playlist naming.
	 * @param {*} overwriteMode Mode label (Create/Overwrite/Do not create).
	 * @returns {Promise<object|null>} Selected/created playlist object, special auto-create indicator, or null if cancelled.
	 */
	async function confirmPlaylist(seedName, overwriteMode) {
		return new Promise((resolve) => {
			try {
				if (typeof uitools === 'undefined' || !uitools.openDialog) {
					console.log('Similar Artists: confirmPlaylist: uitools.openDialog not available');
					resolve({ autoCreate: true }); // Fallback to auto-create
					return;
				}

				const dlg = uitools.openDialog('dlgSelectPlaylist', {
					modal: true,
					showNewPlaylist: false
				});

				// Set dialog info message (tip to click OK without selecting)
				const infoMsg = 'Tip: Click OK without selecting a playlist to auto-create one.';
				dlg.whenReady(() => {
					try {
						if (dlg) {
							dlg.title = infoMsg;
						}
					} catch (err) {
						console.log('Similar Artists: could not set dialog info message: ' + err.toString());
					}
				});

				dlg.whenClosed = function () {
					try {
						// User clicked Cancel (modalResult !== 1)
						if (dlg.modalResult !== 1) {
							console.log('Similar Artists: confirmPlaylist: User cancelled dialog (modalResult=' + dlg.modalResult + ')');
							resolve(null);
							return;
						}

						// User clicked OK
						const selectedPlaylist = dlg.getValue('getPlaylist')?.();

						if (selectedPlaylist) {
							// User selected or created a playlist in the dialog
							console.log(`confirmPlaylist: User selected/created playlist: ${selectedPlaylist.name || selectedPlaylist.title}`);
							resolve(selectedPlaylist);
						} else {
							// User clicked OK without selecting a playlist - auto-create one
							console.log('Similar Artists: confirmPlaylist: User clicked OK without selecting playlist - will auto-create');
							resolve({ autoCreate: true });
						}
					} catch (e) {
						console.error('Similar Artists: confirmPlaylist: Error in dialog closure: ' + e.toString());
						resolve({ autoCreate: true }); // Fallback to auto-create on error
					}
				};

				app.listen(dlg, 'closed', dlg.whenClosed);

			} catch (e) {
				console.error('Similar Artists: confirmPlaylist: Error opening dialog: ' + e.toString());
				resolve({ autoCreate: true }); // Fallback to auto-create
			}
		});
	}

	/**
	 * Fetch similar artists from Last.fm.
	 * @param {string} artistName Main artist.
	 * @returns {Promise<any[]>} Last.fm similar-artist array.
	 */
	async function fetchSimilarArtists(artistName, limit) {
		try {
			if (!artistName)
				return [];

			const cacheKey = cacheKeyArtist(artistName);
			if (lastfmRunCache?.similarArtists?.has(cacheKey)) {
				return lastfmRunCache.similarArtists.get(cacheKey) || [];
			}

			const apiKey = getApiKey();
			const lim = Number(limit) || undefined;
			const params = new URLSearchParams({ method: 'artist.getSimilar', api_key: apiKey, format: 'json', artist: artistName, autocorrect: '1' });
			if (lim)
				params.set('limit', String(lim));

			const url = API_BASE + '?' + params.toString();
			updateProgress(`Querying Last.fm API: getSimilar for "${artistName}"...`);
			console.log('Similar Artists: fetchSimilarArtists: querying ' + url);

			const res = await fetch(url);

			if (!res || !res.ok) {
				console.log(`fetchSimilarArtists: HTTP ${res?.status} ${res?.statusText} for ${artistName}`);
				updateProgress(`Failed to fetch similar artists for "${artistName}" (HTTP ${res?.status})`);
				lastfmRunCache?.similarArtists?.set(cacheKey, []);
				return [];
			}
			let data;
			try {
				data = await res.json();
			} catch (e) {
				console.warn('Similar Artists: fetchSimilarArtists: invalid JSON response: ' + e.toString());
				updateProgress(`Error parsing Last.fm response for "${artistName}"`);
				lastfmRunCache?.similarArtists?.set(cacheKey, []);
				return [];
			}
			if (data?.error) {
				console.warn('Similar Artists: fetchSimilarArtists: API error: ' + (data.message || data.error));
				updateProgress(`Last.fm API error for "${artistName}": ${data.message || data.error}`);
				lastfmRunCache?.similarArtists?.set(cacheKey, []);
				return [];
			}
			const artists = data?.similarartists?.artist || [];
			let asArr = artists;
			if (!Array.isArray(asArr) && asArr) asArr = [asArr];
			console.log(`fetchSimilarArtists: Retrieved ${asArr.length} similar artists for "${artistName}"`);
			lastfmRunCache?.similarArtists?.set(cacheKey, asArr);
			return asArr;
		} catch (e) {
			console.error(e.toString());
			updateProgress(`Error fetching similar artists: ${e.toString()}`);
			try {
				lastfmRunCache?.similarArtists?.set(cacheKeyArtist(artistName), []);
			} catch (_) {
				// ignore
			}
			return [];
		}
	}

	/**
	 * Fetch top track titles for an artist from Last.fm.
	 * @param {string} artistName Artist name.
	 * @param {number} limit Max number of titles to return.
	 * @returns {Promise<string[]>} Track titles.
	 */
	async function fetchTopTracks(artistName, limit, includePlaycount = false) {
		try {
			if (!artistName)
				return [];

			const cacheKey = cacheKeyTopTracks(artistName, limit, includePlaycount);
			if (lastfmRunCache?.topTracks?.has(cacheKey)) {
				return lastfmRunCache.topTracks.get(cacheKey) || [];
			}
			const apiKey = getApiKey();
			const lim = Number(limit) || undefined;
			const params = new URLSearchParams({ method: 'artist.getTopTracks', api_key: apiKey, format: 'json', artist: artistName, autocorrect: '1' });
			if (lim)
				params.set('limit', String(lim));

			const url = API_BASE + '?' + params.toString();
			const purpose = (lim >= 100) ? 'for ranking' : 'for collection';
			updateProgress(`Querying Last.fm: getTopTracks ${purpose} for "${artistName}" (limit: ${lim || 'default'})...`);
			console.log(`fetchTopTracks: querying ${url} (${purpose})`);

			const res = await fetch(url);
			if (!res || !res.ok) {
				console.log(`fetchTopTracks: HTTP ${res?.status} ${res?.statusText} for ${artistName}`);
				updateProgress(`Failed to fetch top tracks for "${artistName}" (HTTP ${res?.status})`);
				lastfmRunCache?.topTracks?.set(cacheKey, []);
				return [];
			}
			let data;
			try {
				data = await res.json();
			} catch (e) {
				console.warn('Similar Artists: fetchTopTracks: invalid JSON response: ' + e.toString());
				updateProgress(`Error parsing Last.fm response for "${artistName}"`);
				lastfmRunCache?.topTracks?.set(cacheKey, []);
				return [];
			}
			if (data?.error) {
				console.warn('Similar Artists: fetchTopTracks: API error: ' + (data.message || data.error));
				updateProgress(`Last.fm API error for "${artistName}": ${data.message || data.error}`);
				lastfmRunCache?.topTracks?.set(cacheKey, []);
				return [];
			}
			let tracks = data?.toptracks?.track || [];
			if (tracks && !Array.isArray(tracks)) tracks = [tracks];
			const rows = [];
			tracks.forEach((t) => {
				if (!t) return;
				const title = t.name || t.title;
				if (!title) return;
				if (includePlaycount) {
					const pc = Number(t.playcount) || 0;
					rows.push({ title, playcount: pc });
				} else {
					rows.push(title);
				}
			});
			console.log(`fetchTopTracks: Retrieved ${rows.length} top tracks for "${artistName}" (${purpose})`);
			const out = typeof lim === 'number' ? rows.slice(0, lim) : rows;
			lastfmRunCache?.topTracks?.set(cacheKey, out);
			return out;
		} catch (e) {
			console.error(e.toString());
			updateProgress(`Error fetching top tracks: ${e.toString()}`);
			try {
				lastfmRunCache?.topTracks?.set(cacheKeyTopTracks(artistName, limit, includePlaycount), []);
			} catch (_) {
				// ignore
			}
			return [];
		}
	}

	/**
	* In-place Fisher–Yates shuffle.
	* @param {any[]} arr Array to shuffle.
	*/
	function shuffle(arr) {
		if (!arr || arr.length <= 1) return;
		for (let i = arr.length - 1; i > 0; --i) {
			const j = Math.floor(Math.random() * (i + 1));
			const temp = arr[i];
			arr[i] = arr[j];
			arr[j] = temp;
		}
	}

	/**
	 * Fetch a larger top-track list to build ranking weights.
	 * Used in rank mode to score tracks by their position in the artist's top tracks.
	 * @param {string} artistName Artist name.
	 * @returns {Promise<string[]>}
	 */
	async function fetchTopTracksForRank(artistName) {
		return fetchTopTracks(artistName, 100, true);
	}

	/**
	 * Batch find matching tracks in the MediaMonkey library for multiple titles.
	 * This is much more efficient than calling findLibraryTracks() for each title individually.
	 * 
	 * @param {string} artistName Artist to match.
	 * @param {string[]} titles Array of track titles to search for.
	 * @param {number} maxPerTitle Max matches to return per title.
	 * @param {{rank?: boolean, best?: boolean}} opts Controls ordering.
	 * @returns {Promise<Map<string, object[]>>} Map of title -> array of matched tracks.
	 */
	async function findLibraryTracksBatch(artistName, titles, maxPerTitle = 1, opts = {}) {
		try {
			if (!app?.db?.getTracklist || !titles || titles.length === 0)
				return new Map();

			// Ensure titles is array of strings
			titles = titles.map(t => String(t || ''));

			const results = new Map();
			const useBest = opts.best !== undefined ? opts.best : boolSetting('Best');
			const excludeTitles = parseListSetting('Exclude');
			const excludeGenres = parseListSetting('Genre');
			const ratingMin = intSetting('Rating');
			const allowUnknown = boolSetting('Unknown');

			const buildArtistClause = () => {
				if (!artistName) return '';

				const artistConds = [];

				const quoteSqlString = (s) => {
					if (s === undefined || s === null) return "''";
					// remove control chars that may break SQL/logging
					const cleaned = String(s).replace(/[\u0000-\u001F]/g, '');
					return `'${escapeSql(cleaned)}'`;
				};

				const addArtistCond = (name) => {
					const n = String(name || '').trim();
					if (!n) return;
					artistConds.push(`Artists.Artist = ${quoteSqlString(n)}`);
				};

				// exact match
				addArtistCond(artistName);

				// Handle prefix variations (e.g., "The Beatles" vs "Beatles, The")
				const prefixes = getIgnorePrefixes();
				const nameLower = (artistName || '').toLowerCase();

				for (const prefix of prefixes) {
					const p = String(prefix || '').trim();
					if (!p) continue;

					if (nameLower.startsWith(p.toLowerCase() + ' ')) {
						// "The Beatles" -> also match "Beatles, The"
						const withoutPrefix = artistName.slice(p.length + 1).trim();
						addArtistCond(`${withoutPrefix}, ${p}`);
					} else {
						// "Beatles" -> also match "Beatles, The" and "The Beatles"
						addArtistCond(`${artistName}, ${p}`);
						addArtistCond(`${p} ${artistName}`);
					}
				}

				// Defensive: if somehow nothing added, still return empty string
				if (artistConds.length === 0) return '';
				return `(${artistConds.join(' OR ')})`;
			};

			// Build common filters
			const buildCommonFilters = () => {
				const filters = [];
				excludeTitles.forEach((t) => {
					// case-insensitive exclude: compare uppercased title
					const titleExclude = escapeSql(String(t || '').toUpperCase());
					filters.push(`UPPER(Songs.SongTitle) NOT LIKE '%${titleExclude}%'`);
				});

				if (excludeGenres.length > 0) {
					const genreConditions = excludeGenres
						.map((g) => `GenreName LIKE '%${escapeSql(g)}%'`)
						.join(' OR ');
					filters.push(`GenresSongs.IDGenre NOT IN (SELECT IDGenre FROM Genres WHERE ${genreConditions})`);
				}

				if (ratingMin > 0) {
					if (allowUnknown) {
						filters.push(`(Songs.Rating < 0 OR Songs.Rating >= ${ratingMin})`);
					} else {
						filters.push(`(Songs.Rating >= ${ratingMin} AND Songs.Rating <= 100)`);
					}
				} else if (!allowUnknown) {
					filters.push(`(Songs.Rating >= 0 AND Songs.Rating <= 100)`);
				}

				return filters;
			};

			const artistClause = buildArtistClause();
			const commonFilters = buildCommonFilters();
			const orderClause = useBest ? ' ORDER BY Songs.Rating DESC, Random()' : ' ORDER BY Random()';
			const baseJoins = `\n\t\t\tFROM Songs\n\t\t\tINNER JOIN ArtistsSongs \n\t\t\t\ton Songs.ID = ArtistsSongs.IDSong \n\t\t\t\tAND ArtistsSongs.PersonType = 1\n\t\t\tINNER JOIN Artists \n\t\t\t\ton ArtistsSongs.IDArtist = Artists.ID\n\t\t\t${excludeGenres.length > 0 ? 'LEFT JOIN GenresSongs ON Songs.ID = GenresSongs.IDSong' : ''}\n\t\t`;

			// Initialize map entries
			titles.forEach(t => results.set(t, []));

			// Precompute normalized inputs once
			const wantedRows = titles.map((title, idx) => {
				const raw = String(title || '');
				const rawUpper = raw.toUpperCase();
				const norm = stripName(raw);
				return { idx, raw, rawUpper, norm };
			});

			// Filter out empty titles (still keep them in results as empty arrays)
			const wantedNonEmpty = wantedRows.filter(r => r.raw && r.raw.trim().length > 0);
			if (wantedNonEmpty.length === 0) return results;

			// Build VALUES list for CTE. Note: rawUpper/norm are safe-quoted.
			const wantedValuesSql = wantedNonEmpty
				.map(r => `(${r.idx}, '${escapeSql(r.raw)}', '${escapeSql(r.rawUpper)}', '${escapeSql(r.norm)}')`)
				.join(',');

			// SQL-side normalization expression (must match stripName's semantics)
			const songTitleNormExpr =
				"REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(" +
				"REPLACE(REPLACE(REPLACE(REPLACE(" +
				"UPPER(Songs.SongTitle)," +
				"'&','AND'),'+','AND'),' N ','AND'),'''N''','AND'),' ',''),'.','')," +
				"',',''),':',''),';',''),'-',''),'_',''),'!',''),'''',''),'\"','')";

			// We only need to match against the requested titles (via the CTE), avoiding large OR lists.
			const whereParts = [];
			if (artistClause) whereParts.push(artistClause);
			whereParts.push(`(UPPER(Songs.SongTitle) = Wanted.RawUpper OR ${songTitleNormExpr} = Wanted.Norm)`);
			whereParts.push(...commonFilters);

			const sql = `\n\t\t\tWITH Wanted(Idx, Raw, RawUpper, Norm) AS (VALUES ${wantedValuesSql})\n\t\t\tSELECT Songs.*, Wanted.Raw AS RequestedTitle\n\t\t\t${baseJoins}\n\t\t\tINNER JOIN Wanted\n\t\t\t\tON (UPPER(Songs.SongTitle) = Wanted.RawUpper OR ${songTitleNormExpr} = Wanted.Norm)\n\t\t\tWHERE ${whereParts.join(' AND ')}\n\t\t\t${orderClause}\n\t\t`;

			const tl = app?.db?.getTracklist(sql, -1);
			if (!tl) return results;

			tl.autoUpdateDisabled = true;
			tl.dontNotify = true;
			await tl.whenLoaded();

			// Fill Map<title, tracks[]> with maxPerTitle cap.
			tl.forEach((track) => {
				if (!track) return;
				const requested = track.title;
				const key = requested ? String(requested) : '';
				if (!key || !results.has(key)) return;
				const arr = results.get(key);
				if (arr && arr.length < maxPerTitle) arr.push(track);
			});

			tl.autoUpdateDisabled = false;
			tl.dontNotify = false;

			return results;

		} catch (e) {
			console.error('Similar Artists: findLibraryTracksBatch error: ' + e.toString());
			updateProgress(`Database lookup error: ${e.toString()}`);
			return new Map();
		}
	}

	// Backward-compatible single-title lookup wrapper
	async function findLibraryTracks(artistName, title, limit = 1, opts = {}) {
		try {
			const t = String(title || '');
			if (!t) return [];
			const max = Number.isFinite(Number(limit)) ? Math.max(0, Number(limit)) : 1;
			const map = await findLibraryTracksBatch(artistName, [t], max, opts);
			return map.get(t) || [];
		} catch (e) {
			console.error('Similar Artists: findLibraryTracks error: ' + e.toString());
			return [];
		}
	}

	/**
	 * Add tracks to a playlist or Now Playing queue using MM5 best practices.
	 * This helper consolidates the track-adding logic following patterns from actions.js.
	 * @param {object} target Playlist or Now Playing queue object.
	 * @param {object[]} tracks Array of track objects to add.
	 * @param {object} options Options for adding tracks.
	 * @param {boolean} options.ignoreDupes Skip tracks already in target.
	 * @param {boolean} options.clearFirst Clear target before adding.
	 * @returns {Promise<number>} Number of tracks added.
	 */
	async function addTracksToTarget(target, tracks, options = {}) {
		const { ignoreDupes = false, clearFirst = false } = options;

		if (!target) {
			console.log('Similar Artists: addTracksToTarget: No target provided');
			return 0;
		}

		// Clear target if requested
		if (clearFirst) {
			try {
				if (target.clearTracksAsync && typeof target.clearTracksAsync === 'function') {
					await target.clearTracksAsync();
					console.log('Similar Artists: addTracksToTarget: Cleared target');
				} else {
					console.log('Similar Artists: addTracksToTarget: clearTracksAsync not available');
				}
			} catch (e) {
				console.error(`addTracksToTarget: Error clearing target: ${e.toString()}`);
			}
		}

		// Build set of existing track IDs for deduplication
		const existing = new Set();
		if (ignoreDupes) {
			try {
				// For Now Playing, try toArray() (synchronous snapshot)
				if (target.toArray && typeof target.toArray === 'function') {
					const existingTracks = target.toArray();
					if (existingTracks && typeof existingTracks.forEach === 'function') {
						existingTracks.forEach((t) => {
							if (t) existing.add(t.id || t.ID);
						});
					}
				}
				// For playlists, try getTracklist() then whenLoaded()
				else if (target.getTracklist && typeof target.getTracklist === 'function') {
					const tracklist = target.getTracklist();
					await tracklist.whenLoaded();
					tracklist.forEach((t) => {
						if (t) existing.add(t.id || t.ID);
					});
				}
			} catch (e) {
				console.error(`addTracksToTarget: Error building existing track set: ${e.toString()}`);
			}
		}

		// Filter out duplicates if needed
		const tracksToAdd = ignoreDupes
			? tracks.filter((t) => {
				const id = t?.id || t?.ID;
				return !id || !existing.has(id);
			})
			: tracks;

		if (!tracksToAdd || tracksToAdd.length === 0) {
			console.log('Similar Artists: addTracksToTarget: No tracks to add after filtering');
			return 0;
		}

		// Add tracks using modern MM5 pattern (from actions.js)
		try {
			if (!app.utils?.createTracklist) {
				console.log('Similar Artists: addTracksToTarget: app.utils.createTracklist not available');
				return 0;
			}

			if (!target.addTracksAsync || typeof target.addTracksAsync !== 'function') {
				console.log('Similar Artists: addTracksToTarget: target.addTracksAsync not available');
				return 0;
			}

			// Create a mutable temporary tracklist
			const tracklist = app.utils.createTracklist(true);

			if (!tracklist) {
				console.log('Similar Artists: addTracksToTarget: Failed to create tracklist');
				return 0;
			}

			// Add all tracks to the temporary tracklist
			for (const t of tracksToAdd) {
				if (t && typeof tracklist.add === 'function') {
					tracklist.add(t);
				}
			}

			// Wait for tracklist to be ready (MM5 pattern from savePlaylistFromNowPlaying)
			await tracklist.whenLoaded();

			// Now we can safely call addTracksAsync
			if (tracklist.count > 0) {
				await target.addTracksAsync(tracklist);
				console.log(`addTracksToTarget: Added ${tracklist.count} tracks (async batch)`);
				return tracklist.count;
			}

			console.log('Similar Artists: addTracksToTarget: No tracks in tracklist to add');
			return 0;

		} catch (e) {
			console.error(`addTracksToTarget: Error: ${e.toString()}`);
			return 0;
		}
	}

	/**
	 * Add tracks to the active playback list / queue.
	 * Uses MM5's app.player.addTracksAsync() which is the correct API for Now Playing.
	 * @param {object[]} tracks Track objects.
	 * @param {boolean} ignoreDupes Skip tracks that are already present.
	 * @param {boolean} clearFirst Clear playlist/queue before adding.
	 */
	async function enqueueTracks(tracks, ignoreDupes, clearFirst) {
		const player = app.player;
		if (!player) {
			console.log('Similar Artists: enqueueTracks: Player not available');
			return;
		}

		// MM5 uses app.player.addTracksAsync() directly for Now Playing
		// This is the pattern used by autoDJ and other MM5 components
		if (!player.addTracksAsync || typeof player.addTracksAsync !== 'function') {
			console.log('Similar Artists: enqueueTracks: player.addTracksAsync not available');
			return;
		}

		// Handle clearing Now Playing if requested
		if (clearFirst) {
			try {
				// MM5 pattern: use player.clearPlaylistAsync() or similar
				if (player.clearPlaylistAsync && typeof player.clearPlaylistAsync === 'function') {
					await player.clearPlaylistAsync();
					console.log('Similar Artists: enqueueTracks: Cleared Now Playing');
				} else if (player.stop && typeof player.stop === 'function') {
					// Fallback: stop playback which effectively clears
					player.stop();
					console.log('Similar Artists: enqueueTracks: Stopped playback (clearPlaylistAsync not available)');
				}
			} catch (e) {
				console.error(`enqueueTracks: Error clearing Now Playing: ${e.toString()}`);
			}
		}

		// Build set of existing track IDs for deduplication
		const existing = new Set();
		if (ignoreDupes) {
			try {
				// Get current Now Playing list via getSongList().getTracklist()
				const songList = player.getSongList?.();
				if (songList) {
					const tracklist = songList.getTracklist?.();
					if (tracklist) {
						await tracklist.whenLoaded();
						tracklist.forEach((t) => {
							if (t) existing.add(t.id || t.ID);
						});
						console.log(`enqueueTracks: Found ${existing.size} existing tracks in Now Playing`);
					}
				}
			} catch (e) {
				console.error(`enqueueTracks: Error building existing track set: ${e.toString()}`);
			}
		}

		// Filter out duplicates if needed
		const tracksToAdd = ignoreDupes
			? tracks.filter((t) => {
				const id = t?.id || t?.ID;
				return !id || !existing.has(id);
			})
			: tracks;

		if (!tracksToAdd || tracksToAdd.length === 0) {
			console.log('Similar Artists: enqueueTracks: No tracks to add after filtering');
			return;
		}

		// Create a tracklist and add tracks to it
		try {
			if (!app.utils?.createTracklist) {
				console.log('Similar Artists: enqueueTracks: app.utils.createTracklist not available');
				return;
			}

			// Create a mutable temporary tracklist
			const tracklist = app.utils.createTracklist(true);

			if (!tracklist) {
				console.log('Similar Artists: enqueueTracks: Failed to create tracklist');
				return;
			}

			// Add all tracks to the temporary tracklist
			for (const t of tracksToAdd) {
				if (t && typeof tracklist.add === 'function') {
					tracklist.add(t);
				}
			}

			// Wait for tracklist to be ready
			await tracklist.whenLoaded();

			if (tracklist.count > 0) {
				// Use app.player.addTracksAsync() - the correct MM5 API for Now Playing
				await player.addTracksAsync(tracklist);
				console.log(`enqueueTracks: Successfully added ${tracklist.count} track(s) to Now Playing`);
			} else {
				console.log('Similar Artists: enqueueTracks: No tracks in tracklist to add');
			}

		} catch (e) {
			console.error(`enqueueTracks: Error adding tracks: ${e.toString()}`);
		}
	}

	/**
	 * Create or locate a playlist, optionally overwrite its content, then add tracks.
	 * Uses modern MM5 API patterns for playlist creation.
	 * @param {object[]} tracks Tracks to add.
	 * @param {string} seedName Seed artist name used for playlist naming.
	 * @param {*} overwriteMode Playlist creation mode (Create/Overwrite/Do not create).
	 * @param {object|null} selectedPlaylist Pre-selected playlist from dialog (if provided), or { autoCreate: true } to create new.
	 * @returns {Promise<object|null>} Playlist object.
	 */
	async function createPlaylist(tracks, seedName, overwriteMode, selectedPlaylist, ignoreDupes = false) {
		const titleTemplate = stringSetting('Name');
		const baseName = titleTemplate.indexOf('%') >= 0 ? titleTemplate.replace('%', seedName || '') : `${titleTemplate} ${seedName || ''}`;
		const overwriteText = String(overwriteMode || '');

		let playlist = null;
		let shouldClear = false;

		// Scenario 1: User selected an existing playlist from dialog
		if (selectedPlaylist && !selectedPlaylist.autoCreate) {
			// User explicitly selected a playlist - use it as-is
			playlist = selectedPlaylist;
			// Check if overwrite is enabled
			shouldClear = overwriteText.toLowerCase().indexOf('overwrite') > -1;
			console.log(`createPlaylist: Using user-selected playlist '${playlist.name}' (ID: ${playlist.id || playlist.ID}), shouldClear=${shouldClear}`);
		}
		// Scenario 2: Auto-create new playlist (OK clicked without selection, or confirm disabled)
		else if (selectedPlaylist?.autoCreate || !selectedPlaylist) {
			// Determine playlist name
			let name = baseName;

			// Check if "Create new playlist" mode - always generate unique name
			if (overwriteText.toLowerCase().indexOf('create') > -1) {
				// Find unique name by appending index
				let idx = 1;
				let testPlaylist = findPlaylist(name);
				while (testPlaylist) {
					idx += 1;
					name = `${baseName}_${idx}`;
					testPlaylist = findPlaylist(name);
				}
				console.log(`createPlaylist: Create mode - using unique name: ${name}`);
			} else {
				// Overwrite or default mode - try to find existing playlist with base name
				playlist = findPlaylist(name);
				if (playlist) {
					// Found existing playlist - check if we should overwrite
					shouldClear = overwriteText.toLowerCase().indexOf('overwrite') > -1;
					console.log(`createPlaylist: Found existing playlist '${name}', shouldClear=${shouldClear}`);
				}
			}

			// Create new playlist if not found
			if (!playlist) {
				try {
					const parentName = stringSetting('Parent');
					let parentPlaylist = null;

					// Find parent playlist if specified (and not empty)
					if (parentName && parentName.trim() !== '') {
						parentPlaylist = findPlaylist(parentName);
						if (parentPlaylist) {
							console.log(`createPlaylist: Found parent playlist '${parentName}' (ID: ${parentPlaylist.id || parentPlaylist.ID})`);
						} else {
							console.log(`createPlaylist: Parent playlist '${parentName}' not found, will create at root`);
						}
					}

					// Create new playlist as child of parent (or root if no parent)
					if (parentPlaylist && typeof parentPlaylist.newPlaylist === 'function') {
						playlist = parentPlaylist.newPlaylist();
						console.log(`createPlaylist: Created new playlist under parent '${parentName}'`);
					} else {
						playlist = app.playlists.root.newPlaylist();
						console.log('Similar Artists: createPlaylist: Created new playlist at root level');
					}

					if (!playlist) {
						console.log('Similar Artists: createPlaylist: Failed to create new playlist object');
						return null;
					}

					// Set name
					playlist.name = name;
					console.log(`createPlaylist: Set playlist name to '${name}'`);

					// Persist the playlist (this commits it to the database with parent relationship intact)
					await playlist.commitAsync();
					console.log(`createPlaylist: Committed playlist to database (ID: ${playlist.id || playlist.ID})`);

					// Mark as new for potential UI handling
					playlist.isNew = true;

				} catch (e) {
					console.error(`createPlaylist: Error creating playlist: ${e.toString()}`);
					return null;
				}
			}
		}

		if (!playlist) {
			console.log('Similar Artists: createPlaylist: Failed to create or find playlist');
			return null;
		}

		console.log(`createPlaylist: Using playlist '${playlist.name}' (ID: ${playlist.id || playlist.ID}), shouldClear=${shouldClear}`);

		// Add tracks to playlist using unified helper
		if (tracks && tracks.length > 0) {
			const added = await addTracksToTarget(playlist, tracks, {
				ignoreDupes: ignoreDupes,
				clearFirst: shouldClear
			});
			console.log(`createPlaylist: Added ${added} track(s) to playlist`);
		} else {
			console.log('Similar Artists: createPlaylist: No tracks to add to playlist');
		}

		// Handle navigation based on user settings
		try {
			const nav = getSetting('Navigate');
			if (typeof window !== 'undefined' && window.navigationHandlers) {
				const navStr = String(nav || '').toLowerCase();
				if (navStr.indexOf('new') > -1 && (playlist.id || playlist.ID)) {
					// Navigate to the newly created playlist
					console.log(`createPlaylist: Navigating to playlist ID: ${playlist.id || playlist.ID}`);
					if (window.navigationHandlers.playlist?.navigate) {
						window.navigationHandlers.playlist.navigate(playlist);
					}
				} else if (navStr.indexOf('now') > -1) {
					// Navigate to Now Playing
					console.log('Similar Artists: createPlaylist: Navigating to Now Playing');
					if (window.navigationHandlers.nowPlaying?.navigate) {
						window.navigationHandlers.nowPlaying.navigate();
					}
				}
			}
		} catch (e) {
			console.error(`createPlaylist: Navigation error: ${e.toString()}`);
		}

		return playlist;
	}

	/**
	 * Find an existing playlist by title (case-insensitive).
	 * @param {string} name Playlist title to search for.
	 * @returns {object|null} Playlist object if found, null otherwise.
	 */
	function findPlaylist(name) {
		if (!name || typeof app === 'undefined' || !app.playlists) {
			return null;
		}

		try {
			// Use findByTitle (MM5 API)
			if (app.playlists?.findByTitle && typeof app.playlists.findByTitle === 'function') {
				const playlist = app.playlists.findByTitle(name);
				if (playlist) {
					console.log(`findPlaylist: Found playlist by title: "${name}"`);
					return playlist;
				}
			}
		} catch (e) {
			console.error(`findPlaylist: Error: ${e.toString()}`);
		}

		console.log(`findPlaylist: Playlist not found: "${name}"`);
		return null;
	}

	/**
	 * Normalize a string for fuzzy title comparison in SQL.
	 * @param {string} name Title.
	 * @returns {string} Uppercased string with punctuation/whitespace removed.
	 */
	function stripName(name) {
		if (!name) return '';
		let result = name.toUpperCase();
		result = result.replace(/&/g, 'AND');
		result = result.replace(/\+/g, 'AND');
		result = result.replace(/ N /g, 'AND');
		result = result.replace(/'N'/g, 'AND');
		result = result.replace(/ /g, '');
		result = result.replace(/\./g, '');
		result = result.replace(/,/g, '');
		result = result.replace(/:/g, '');
		result = result.replace(/;/g, '');
		result = result.replace(/-/g, '');
		result = result.replace(/_/g, '');
		result = result.replace(/!/g, '');
		result = result.replace(/'/g, '');
		result = result.replace(/"/g, '');
		return result;
	}

	/**
	 * Escape single quotes for SQL queries
	 * @param {string} str - String to escape
	 * @returns {string} Escaped string
	 */
	function escapeSql(str) {
		return (str || '').replace(/'/g, "''");
	}

	/**
	 * Add-on initialization.
	 * Ensures the app API is available and optionally attaches auto-mode.
	 */
	function start() {

		if (state.started)
			return;
		state.started = true;
		console.log('Similar Artists: Starting SimilarArtists addon...');

		// Check for MM5 environment
		if (typeof app === 'undefined') {
			console.log('Similar Artists: MediaMonkey 5 app API not found.');
			return;
		}

		// Ensure listener state matches setting
		applyAutoModeFromSettings();
		console.log('Similar Artists: addon started successfully.');
	}

	/**
	 * Returns whether auto-mode is enabled.
	 * This is the single source of truth for UI (actions + options) state.
	 * @returns {boolean}
	 */
	function isAutoEnabled() {
		return !!getSetting('OnPlay', false);
	}

	// Build a comma-separated artist label from seed artists (used to plug into the Name template).
	// This returns only the artist label portion (e.g. "Pink Floyd, Fuel") and does NOT apply the template.
	function buildPlaylistTitle(seeds) {
		const names = (seeds || []).map((s) => s?.name).filter((n) => n && n.trim().length);
		if (!names.length) return '';

		// Limit artist portion to keep playlist titles readable and within common limits.
		const maxLabelLen = 80; // conservative limit for artist portion
		let label = names[0];
		for (let i = 1; i < names.length; i++) {
			const candidate = `${label}, ${names[i]}`;
			if (candidate.length > maxLabelLen) {
				label += '…';
				break;
			}
			label = candidate;
		}
		return label;
	}

	// Export functions to the global scope
	globalArg.SimilarArtists = {
		start,
		runSimilarArtists,
		toggleAuto,
		applyAutoModeFromSettings,
		isAutoEnabled,
	};

})(typeof window !== 'undefined' ? window : global);