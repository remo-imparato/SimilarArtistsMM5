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

	// Import modules
	const modules = require('./modules');
	const {
		config,
		utils: { normalization, helpers, sql },
		settings: { storage, prefixes, lastfm },
		ui: { notifications },
		api: { cache },
	} = modules;

	// Destructure configuration constants
	const { SCRIPT_ID, TOOLBAR_RUN_ID, TOOLBAR_AUTO_ID, ACTION_RUN_ID, ACTION_AUTO_ID, API_BASE, DEFAULTS } = config;

	// Destructure utility functions
	const {
		normalizeName,
		splitArtists,
		stripName: stripNameUtil,
		cacheKeyArtist: cacheKeyArtistUtil,
		cacheKeyTopTracks: cacheKeyTopTracksUtil,
	} = normalization;

	const {
		formatError: formatErrorUtil,
		shuffle: shuffleUtil,
		parseListSetting: parseListSettingUtil,
		sleep,
		escapeSql: escapeSqlUtil,
	} = helpers;

	const {
		quoteSqlString,
		getTrackKey: getTrackKeyUtil,
		escapeSql,
	} = sql;

	// Destructure settings functions
	const {
		getSetting,
		setSetting,
		intSetting,
		stringSetting,
		boolSetting,
		listSetting,
	} = storage;

	const {
		getIgnorePrefixes,
		fixPrefixes,
	} = prefixes;

	const {
		getApiKey,
	} = lastfm;

	// Destructure notifications functions
	const {
		showToast,
		updateProgress,
		createProgressTask,
		terminateProgressTask,
		terminateProgressTaskAfterDelay,
		getProgressTask,
	} = notifications;

	// Destructure cache functions
	const {
		initLastfmRunCache: initCacheUtil,
		clearLastfmRunCache: clearCacheUtil,
		getCachedSimilarArtists,
		cacheSimilarArtists,
		getCachedTopTracks,
		cacheTopTracks,
	} = cache;

	// Local aliases for backward compatibility with rest of code
	const formatError = formatErrorUtil;
	const shuffle = shuffleUtil;
	const parseListSetting = (key) => parseListSettingUtil(getSetting(key, DEFAULTS[key]));
	const stripName = stripNameUtil;
	const cacheKeyArtist = cacheKeyArtistUtil;
	const cacheKeyTopTracks = cacheKeyTopTracksUtil;
	const getTrackKey = getTrackKeyUtil;
	const initLastfmRunCache = initCacheUtil;
	const clearLastfmRunCache = clearCacheUtil;

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
							for (const a of splitArtists(t.artist)) {
								seeds.push({ name: a, track: t });
							}
						}
					});
				} else if (typeof selectedList.getFastObject === 'function' && typeof selectedList.count === 'number') {
					let tmp;
					for (let i = 0; i < selectedList.count; i++) {
						tmp = selectedList.getFastObject(i, tmp);
						if (tmp && tmp.artist) {
							for (const a of splitArtists(tmp.artist)) {
								seeds.push({ name: a, track: tmp });
							}
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
			for (const a of splitArtists(currentTrack.artist)) {
				seeds.push({ name: a, track: currentTrack });
			}
			return seeds;
		}

		console.log('Similar Artists: collectSeedTracks: No tracks found (no selection and no playing track)');
		return [];
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

	// Export functions to the global scope
	globalArg.SimilarArtists = {
		start,
		runSimilarArtists,
		toggleAuto,
		applyAutoModeFromSettings,
		isAutoEnabled,
	};

})(typeof window !== 'undefined' ? window : global);