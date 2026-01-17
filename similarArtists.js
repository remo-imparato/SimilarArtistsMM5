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
	//const API_KEY = app.settings.getValue('ApiKey', '') || '6cfe51c9bf7e77d6449e63ac0db2ac24';

	// Default settings (kept commented-out here because this add-on reads defaults from the Options page).
	const defaults = {
		//	Toolbar: 1, // 0=none 1=run 2=auto 3=both
		//	Confirm: true,
		//	Sort: false,
		//	Limit: 5,
		//	Name: 'Artists similar to %',
		//	TPA: 9999,
		//	TPL: 9999,
		//	Random: false,
		//	Seed: false,
		//	Seed2: false,
		//	Best: false,
		//	Rank: false,
		//	Rating: 0,
		//	Unknown: true,
		//	Overwrite: 0, // 0=create, 1=overwrite, 2=do not create playlist (enqueue only)
		//	Enqueue: false,
		//	Navigate: 0,
		//	OnPlay: false,
		//	ClearNP: false,
		//	Ignore: false,
		//	Parent: '',
		//	Black: '',
		//	Exclude: '',
		//	Genre: '',
	};

	// Runtime state for the add-on (not persisted).
	const state = {
		// Holds the listener subscription for automatic mode so it can be detached.
		autoListen: null,
		// Prevents start() from running more than once.
		started: false,
		// Used by long-running operations to support cancellation (UI not currently exposed).
		cancelled: false,
	};

	/**
	 * Write a prefixed line to console.
	 * @param {string} txt Log message string.
	 */
	function log(txt) {
		try {
			console.log('SimilarArtists: ' + txt);
		} catch (e) {
			// ignore
		}
	}

	/**
	 * Display a toast-like UI notification when possible, otherwise fallback to logging.
	 * @param {string} text Toast message.
	 * @param {object} options Toast options object (implementation-specific).
	 */
	function showToast(text, options = {}) {
		try {
			// Prefer uitools.toastMessage.show (newer API)
			if (typeof uitools !== 'undefined' && uitools?.toastMessage?.show) {
				uitools.toastMessage.show(text, options);
				return;
			}
			// Some environments may expose uitool (older) implementation
			if (typeof uitool !== 'undefined' && uitool?.toastMessage?.show) {
				uitool.toastMessage.show(text, options);
				return;
			}
			// Fallback to app.messageBox if available (synchronous/modal)
			if (typeof app !== 'undefined') {
				try {
					showToast(text);
				}
				catch (e) {
					log('showToast fallback failed: ' + e.toString());
				}
				return;
			}
			// Last resort: log to console
			log(text);
		} catch (e) {
			log('showToast error: ' + e.toString());
		}
	}

	// At top of js/similarArtists.js (or in your existing file)
	/**
	 * Get the Last.fm API key from MediaMonkey settings with a built-in fallback.
	 * @returns {string} API key.
	 */
	function getApiKey() {
		return app?.settings?.getValue?.('SimilarArtists.ApiKey', '') || '6cfe51c9bf7e77d6449e63ac0db2ac24';
	}

	/**
	 * Read a setting stored under this script's namespace.
	 * @param {string} key Setting name.
	 * @param {*} fallback Value returned when setting is missing.
	 * @returns {*} Stored value or fallback.
	 */
	function getSetting(key, fallback) {
		if (typeof app === 'undefined' || !app.getValue) return fallback;
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
	 * @param {string} key Setting name.
	 * @param {*} value Setting value.
	 */
	function setSetting(key, value) {
		if (typeof app === 'undefined' || !app.setValue) return;
		app.setValue(SCRIPT_ID, key, value);
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
		return Boolean(val);
	}

	/**
	 * Get a setting coerced to integer.
	 * @param {string} key Setting key.
	 * @returns {number}
	 */
	function intSetting(key) {
		const val = getSetting(key, defaults[key]);
		return parseInt(val, 10) || 0;
	}

	/**
	 * Initialize missing settings to defaults.
	 * Note: currently returns early because defaults are defined in Options UI.
	 */
	function ensureDefaults() {
		return;
		Object.keys(defaults).forEach((k) => {
			const val = getSetting(k, null);
			if (val === null) {
				setSetting(k, defaults[k]);
			}
		});
	}

	/**
	 * Get the list of prefix strings to ignore (e.g., "The", "A")
	 * @returns {string[]} Array of prefixes
	 */
	function getIgnorePrefixes() {
		try {
			if (app.settings?.getValue) {
				const ignoreThes = app.settings.getValue('IgnoreTHEs', false);
				if (ignoreThes) {
					const theList = app.settings.getValue('IgnoreTHEStrings', 'The');
					return theList.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
				}
			}
		} catch (e) {
			log(e.toString());
		}
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
			log(e.toString());
		}
	}

	/**
	 * Toggle automatic mode (run addon when playback reaches end of playlist).
	 */
	function toggleAuto() {
		const next = !getSetting('OnPlay', false);
		setSetting('OnPlay', next);
		refreshToggleUI();
		if (next) attachAuto();
		else detachAuto();
	}

	/**
	 * Attach playback listener for auto-mode.
	 */
	function attachAuto() {
		detachAuto();
		if (typeof app === 'undefined') return;
		const player = app.player;
		if (!player) return;
		if (app.listen) {
			state.autoListen = app.listen(player, 'playbackState', (newState) => {
				if (newState === 'trackChanged') handleAuto();
			});
		} else if (player.on) {
			state.autoListen = player.on('playbackState', (newState) => {
				if (newState === 'trackChanged') handleAuto();
			});
		}
	}

	/**
	 * Detach playback listener for auto-mode.
	 */
	function detachAuto() {
		if (!state.autoListen) return;
		try {
			if (app.unlisten) app.unlisten(state.autoListen);
			else if (state.autoListen.off) state.autoListen.off();
		} catch (e) {
			log(e.toString());
		}
		state.autoListen = null;
	}

	/**
	 * Auto-mode handler that triggers when the playlist cursor approaches the end.
	 */
	async function handleAuto() {
		try {
			if (!getSetting('OnPlay', false)) return;
			const player = app.player;
			if (!player || !player.playlist) return;
			const list = player.playlist;
			if (typeof list.getCursor === 'function' && typeof list.count === 'function') {
				// When only 1 track remains (cursor + 2 > count), pre-fill with more similar tracks.
				if (list.getCursor() + 2 > list.count()) {
					await runSimilarArtists(true);
				}
			}
		} catch (e) {
			log(e.toString());
		}
	}

	/**
	 * Parse a comma-separated string setting into an array.
	 * @param {string} key Setting key.
	 * @returns {string[]}
	 */
	function parseListSetting(key) {
		return stringSetting(key)
			.split(',')
			.map((s) => s.trim())
			.filter((s) => s.length > 0);
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
	 * Collect seed tracks either from current selection or current playing track.
	 * The resulting list is used as starting points for Last.fm similarity queries.
	 * @returns {{name: string, track?: object}[]}
	 */
	function collectSeedTracks() {
		if (typeof app === 'undefined') return [];
		let list = null;
		if (uitools?.getSelectedTracklist) {
			list = uitools.getSelectedTracklist();
		}
		const count = typeof list?.count === 'function' ? list.count() : (list?.count || 0);
		if (!list || count === 0) {
			list = app.player?.getCurrentTrack?.();// || app.player?.playlist;
		}
		if (!list) return [];
		const tracks = list.toArray ? list.toArray() : [list];
		const seeds = [];
		(tracks || []).forEach((t) => {
			if (t && t.artist) {
				seeds.push({ name: normalizeName(t.artist), track: t });
			}
		});
		return seeds;
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
		log('Similar Artists: prepared trackInfo: ' + JSON.stringify(trackInfo));
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
		if (boolSetting('Sort')) {
			res.sort((a, b) => a.name.localeCompare(b.name));
		}
		return res;
	}

	/**
	 * Main entry point for generating similar-artist tracks.
	 * Steps:
	 * - Collect seed artists from selection / playing track
	 * - Query Last.fm for similar artists & top tracks
	 * - Match returned tracks against the local MediaMonkey library
	 * - Enqueue into Now Playing or create/overwrite a playlist
	 * @param {boolean} autoRun True when invoked by auto-mode (suppresses completion toast).
	 */
	async function runSimilarArtists(autoRun) {
		state.cancelled = false;
		//var prog = uitools.showProgressWindow();
		try {
			const seedsRaw = collectSeedTracks();
			const seeds = uniqueArtists(seedsRaw);
			if (!seeds.length) {
				showToast('SimilarArtists: Select at least one track to seed the playlist.');
				return;
			}

			// Load config block stored under this script id.
			var config = app.getValue(SCRIPT_ID, defaults);

			//const progress = app.ui?.createProgress?.('SimilarArtists', seeds.length) || null;
			const artistLimit = config.Limit;// intSetting('Limit');
			const tracksPerArtist = config.TPA;// intSetting('TPA');
			const totalLimit = config.TPL;// intSetting('TPL');
			const includeSeedArtist = config.Seed;// boolSetting('Seed');
			const includeSeedTrack = config.Seed2;// boolSetting('Seed2');
			const randomise = config.Random;// boolSetting('Random');
			const enqueue = config.Enqueue;// boolSetting('Enqueue');
			const ignoreDupes = config.Ignore;// boolSetting('Ignore');
			const clearNP = config.ClearNP;// boolSetting('ClearNP');
			const overwriteMode = config.Overwrite;// intSetting('Overwrite');
			const confirm = config.Confirm;// boolSetting('Confirm');
			const rankEnabled = config.Rank;// boolSetting('Rank');
			const bestEnabled = config.Best;// boolSetting('Best');

			// Rank mode uses a temporary table to prioritize tracks by Last.fm top-track position.
			if (rankEnabled) {
				await ensureRankTable();
				await resetRankTable();
			}

			const allTracks = [];
			// Optional: include currently selected/playing seed track (only for single seed).
			if (includeSeedTrack && seeds.length === 1 && seeds[0].track) {
				allTracks.push(seeds[0].track);
			}

			// Process each seed artist up to configured limit.
			const seedSlice = seeds.slice(0, artistLimit || seeds.length);
			for (let i = 0; i < seedSlice.length; i++) {
				// Check for cancellation
				//if (progress?.terminate || state.cancelled) {
				//	if (progress?.close) progress.close();
				//	if (confirm) {
				//		showToast('SimilarArtists: Process cancelled by user.');
				//	}
				//	return;
				//}

				const seed = seedSlice[i];
				//if (progress) {
				//	progress.maxValue = seedSlice.length;
				//	progress.value = i;
				//	progress.text = `Processing ${seed.name} (${i + 1}/${seedSlice.length})`;
				//}

				// Use fixPrefixes for the API call
				const artistNameForApi = fixPrefixes(seed.name);
				const similar = await fetchSimilarArtists(artistNameForApi);

				// Build pool: seed artist (optional) + similar artists.
				const artistPool = [];
				if (includeSeedArtist) artistPool.push(seed.name);
				similar.slice(0, artistLimit).forEach((a) => {
					if (a?.name) artistPool.push(a.name);
				});

				for (const artName of artistPool) {
					// Check for cancellation
					//if (progress?.terminate || state.cancelled) {
					//	break;
					//}

					if (rankEnabled) {
						await updateRankForArtist(artName);
					}
					// Fetch top track titles from Last.fm, then try to find local matches.
					const titles = await fetchTopTracks(fixPrefixes(artName), tracksPerArtist);
					for (const title of titles) {
						const matches = await findLibraryTracks(artName, title, 1, { rank: rankEnabled, best: bestEnabled });
						matches.forEach((m) => allTracks.push(m));
						if (allTracks.length >= totalLimit) break;
					}
					if (allTracks.length >= totalLimit) break;
				}
				if (allTracks.length >= totalLimit) break;
			}

			if (!allTracks.length) {
				//if (progress?.close) progress.close();
				showToast('SimilarArtists: No matching tracks found in library.');
				return;
			}

			// Optional: randomize final track set.
			if (randomise)
				shuffle(allTracks);

			// Either enqueue to Now Playing or create a playlist, depending on settings.
			if (enqueue || overwriteMode.toLowerCase().indexOf("do not") > -1) {
				await enqueueTracks(allTracks, ignoreDupes, clearNP);
			} else {
				const seedName = seeds[0]?.name || 'Similar Artists';
				const proceed = !confirm || (await confirmPlaylist(seedName, overwriteMode));
				if (proceed) {
					await createPlaylist(allTracks, seedName, overwriteMode);
				}
			}

			//if (progress?.close) progress.close();

			// Show completion message if confirm is enabled
			if (confirm && !autoRun) {
				const count = seedSlice.length;
				if (count === 1) {
					showToast('SimilarArtists: Artist has been processed.');
				} else {
					showToast(`SimilarArtists: All ${count} artists have been processed.`);
				}
			}
		} catch (e) {
			log(e.msg);
			showToast('SimilarArtists: An error occurred - see log for details.');
		} finally {
			//	prog.close();
			//uitools.hideProgressWindow();
		}
	}

	/**
	 * Ask user for confirmation before creating/overwriting a playlist.
	 * @param {string} seedName Seed artist name used in playlist naming.
	 * @param {*} overwriteMode Mode label (Create/Overwrite/Do not create).
	 * @returns {Promise<boolean>} True when OK to proceed.
	 */
	async function confirmPlaylist(seedName, overwriteMode) {
		const baseName = stringSetting('Name').replace('%', seedName || '');
		const action = overwriteMode === 1 ? 'overwrite' : 'create';
		const res = await showToast(`SimilarArtists: Do you wish to ${action} playlist '${baseName}'?`, ['yes', 'no']);
		return true;// res === 'yes';
	}

	/**
	 * Fetch similar artists from Last.fm.
	 * @param {string} artistName Main artist.
	 * @returns {Promise<any[]>} Last.fm similar-artist array.
	 */
	async function fetchSimilarArtists(artistName) {
		try {
			if (!artistName) return [];
			const apiKey = getApiKey();
			const limitVal = parseInt(getSetting('Limit', defaults?.Limit || 0), 10) || undefined;
			const params = new URLSearchParams({ method: 'artist.getSimilar', api_key: apiKey, format: 'json', artist: artistName });
			if (limitVal) params.set('limit', String(limitVal));
			const url = API_BASE + '?' + params.toString();
			const res = await fetch(url);
			if (!res || !res.ok) {
				log(`fetchSimilarArtists: HTTP ${res?.status} ${res?.statusText} for ${artistName}`);
				return [];
			}
			let data;
			try {
				data = await res.json();
			} catch (e) {
				log('fetchSimilarArtists: invalid JSON response: ' + e.toString());
				return [];
			}
			if (data?.error) {
				log('fetchSimilarArtists: API error: ' + (data.message || data.error));
				return [];
			}
			const artists = data?.similarartists?.artist || [];
			if (!Array.isArray(artists) && artists) return [artists];
			return artists;
		} catch (e) {
			log(e.toString());
			return [];
		}
	}

	/**
	 * Fetch top track titles for an artist from Last.fm.
	 * @param {string} artistName Artist name.
	 * @param {number} limit Max number of titles to return.
	 * @returns {Promise<string[]>} Track titles.
	 */
	async function fetchTopTracks(artistName, limit) {
		try {
			if (!artistName) return [];
			const apiKey = getApiKey();
			const lim = Number(limit) || undefined;
			const params = new URLSearchParams({ method: 'artist.getTopTracks', api_key: apiKey, format: 'json', artist: artistName });
			if (lim) params.set('limit', String(lim));
			const url = API_BASE + '?' + params.toString();
			const res = await fetch(url);
			if (!res || !res.ok) {
				log(`fetchTopTracks: HTTP ${res?.status} ${res?.statusText} for ${artistName}`);
				return [];
			}
			let data;
			try {
				data = await res.json();
			} catch (e) {
				log('fetchTopTracks: invalid JSON response: ' + e.toString());
				return [];
			}
			if (data?.error) {
				log('fetchTopTracks: API error: ' + (data.message || data.error));
				return [];
			}
			let tracks = data?.toptracks?.track || [];
			if (tracks && !Array.isArray(tracks)) tracks = [tracks];
			const titles = [];
			tracks.forEach((t) => {
				if (t && (t.name || t.title)) titles.push(t.name || t.title);
			});
			return typeof lim === 'number' ? titles.slice(0, lim) : titles;
		} catch (e) {
			log(e.toString());
			return [];
		}
	}

	/**
	 * Fetch a larger top-track list to build ranking weights.
	 * @param {string} artistName Artist name.
	 * @returns {Promise<string[]>}
	 */
	async function fetchTopTracksForRank(artistName) {
		return fetchTopTracks(artistName, 100);
	}

	/**
	 * Find matching tracks in the MediaMonkey library.
	 * Uses SQL against the MediaMonkey DB to match by artist/title with optional filters.
	 * @param {string} artistName Artist to match.
	 * @param {string} title Track title to match.
	 * @param {number} limit Max matches to return.
	 * @param {{rank?: boolean, best?: boolean}} opts Controls ordering (rank table / rating).
	 * @returns {Promise<object[]>} Array of track objects.
	 */
	async function findLibraryTracks(artistName, title, limit, opts = {}) {
		try {
			if (!app?.db?.getTracklist) return [];

			const excludeTitles = parseListSetting('Exclude');
			const excludeGenres = parseListSetting('Genre');
			const ratingMin = intSetting('Rating');
			const allowUnknown = boolSetting('Unknown');

			// Base SELECT — no DISTINCT needed because Songs.ID is unique
			let sql = `
			SELECT Songs.*${opts.rank ? ', SimArtSongRank.Rank AS RankValue' : ''}
			FROM Songs
			INNER JOIN ArtistsSongs 
				ON Songs.ID = ArtistsSongs.IDSong 
				AND ArtistsSongs.PersonType = 1
			INNER JOIN Artists 
				ON ArtistsSongs.IDArtist = Artists.ID
		`;

			if (opts.rank) {
				sql += `
				LEFT OUTER JOIN SimArtSongRank 
					ON Songs.ID = SimArtSongRank.ID
			`;
			}

			if (excludeGenres.length > 0) {
				sql += `
				LEFT JOIN GenresSongs 
					ON Songs.ID = GenresSongs.IDSong
			`;
			}

			const whereParts = [];

			// Artist matching (prefix handling)
			if (artistName) {
				const artistConds = [];
				artistConds.push(`Artists.Artist = '${escapeSql(artistName)}'`);

				const prefixes = getIgnorePrefixes();
				const nameLower = artistName.toLowerCase();

				for (const prefix of prefixes) {
					const prefixLower = prefix.toLowerCase();
					if (nameLower.startsWith(prefixLower + ' ')) {
						const withoutPrefix = artistName.slice(prefix.length + 1);
						artistConds.push(
							`Artists.Artist = '${escapeSql(`${withoutPrefix}, ${prefix}`)}'`
						);
					}
				}

				whereParts.push(`(${artistConds.join(' OR ')})`);
			}

			// Title matching (fuzzy strip)
			if (title) {
				const strippedTitle = stripName(title);

				const stripExpr =
					"REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(" +
					"REPLACE(REPLACE(REPLACE(REPLACE(" +
					"UPPER(Songs.SongTitle)," +
					"'&','AND'),'+','AND'),' N ','AND'),'''N''','AND'),' ',''),'.','')," +
					"',',''),':',''),';',''),'-',''),'_',''),'!',''),'''',''),'\"','')";

				if (strippedTitle) {
					whereParts.push(`${stripExpr} = '${escapeSql(strippedTitle)}'`);
				} else {
					whereParts.push(`Songs.SongTitle LIKE '%${escapeSql(title)}%'`);
				}
			}

			// Exclude titles
			excludeTitles.forEach((t) => {
				whereParts.push(`Songs.SongTitle NOT LIKE '%${escapeSql(t)}%'`);
			});

			// Exclude genres
			if (excludeGenres.length > 0) {
				const genreConditions = excludeGenres
					.map((g) => `GenreName LIKE '%${escapeSql(g)}%'`)
					.join(' OR ');
				whereParts.push(`
					GenresSongs.IDGenre NOT IN (
						SELECT IDGenre FROM Genres WHERE ${genreConditions}
					)
				`);
			}

			// Rating logic
			if (ratingMin > 0) {
				if (allowUnknown) {
					whereParts.push(`(Songs.Rating < 0 OR Songs.Rating >= ${ratingMin})`);
				} else {
					whereParts.push(`(Songs.Rating >= ${ratingMin} AND Songs.Rating <= 100)`);
				}
			} else if (!allowUnknown) {
				whereParts.push(`(Songs.Rating >= 0 AND Songs.Rating <= 100)`);
			}

			// WHERE clause
			if (whereParts.length > 0) {
				sql += ` WHERE ${whereParts.join(' AND ')}`;
			}

			// ORDER BY
			const order = [];
			if (opts.rank) order.push('RankValue DESC');
			if (opts.best) order.push('Songs.Rating DESC');
			order.push('Random()');

			sql += ` ORDER BY ${order.join(', ')}`;

			// LIMIT
			if (typeof limit === 'number' && limit > 0) {
				sql += ` LIMIT ${limit}`;
			}

			//console.debug('SQL: ' + sql);

			// Execute
			const tl = app.db.getTracklist(sql, -1);
			await tl.whenLoaded();

			const arr = [];
			tl.forEach((t) => arr.push(t));

			return typeof limit === 'number' ? arr.slice(0, limit) : arr;

		} catch (e) {
			log('findLibraryTracks error: ' + e.toString());
			return [];
		}
	}

	/**
	 * Add tracks to the active playback list / queue.
	 * @param {object[]} tracks Track objects.
	 * @param {boolean} ignoreDupes Skip tracks that are already present.
	 * @param {boolean} clearFirst Clear playlist/queue before adding.
	 */
	async function enqueueTracks(tracks, ignoreDupes, clearFirst) {
		const player = app.player;
		if (!player) return;
		const playlist = player.playlist || player.nowPlayingQueue || player.getPlaylist?.();
		if (!playlist) return;
		if (clearFirst && playlist.clear) playlist.clear();
		const existing = new Set();
		if (ignoreDupes && playlist.toArray) {
			playlist.toArray().forEach((t) => existing.add(t.id || t.ID));
		}
		tracks.forEach((t) => {
			const id = t?.id || t?.ID;
			if (ignoreDupes && id && existing.has(id)) return;
			if (playlist.addTrack) playlist.addTrack(t);
			else if (playlist.addTracks) playlist.addTracks([t]);
			else if (player.appendTracks) player.appendTracks([t]);
		});
	}

	// Creates (or finds) a playlist then adds tracks. Matches APIs used in this repo.
	/**
	 * Create or locate a playlist, optionally overwrite its content, then add tracks.
	 * @param {object[]} tracks Tracks to add.
	 * @param {string} title Playlist title.
	 * @param {boolean} overwrite Whether to clear existing playlist content.
	 * @returns {Promise<object|null>} Playlist object.
	 */
	async function createPlaylist(tracks, seedName, overwriteMode) {
		const titleTemplate = stringSetting('Name');
		const baseName = titleTemplate.replace('%', seedName || '');
		let name = baseName;
		let playlist = findPlaylist(name);

		const overwriteText = String(overwriteMode || '');

		//-- create new
		if (overwriteText.toLowerCase().indexOf('create') > -1) {
			let idx = 1;
			while (playlist) {
				idx += 1;
				name = `${baseName}_${idx}`;
				playlist = findPlaylist(name);
			}
		}

		if (!playlist) {
			if (app.playlists?.createPlaylist) {
				playlist = app.playlists.createPlaylist(name, stringSetting('Parent'));
			} else if (app.playlists?.root?.newPlaylist) {
				// Old API path: newPlaylist() + set name + commitAsync() to persist.
				playlist = app.playlists.root.newPlaylist();
				if (playlist) {
					playlist.name = name;
					if (playlist.commitAsync) {
						await playlist.commitAsync();
					}
				}
			}
		}

		if (!playlist) {
			return;
		}

		// If overwrite is selected, clear existing playlist content.
		if (overwriteText.toLowerCase().indexOf('overwrite') > -1) {
			if (playlist.clearTracksAsync) {
				await playlist.clearTracksAsync();
			} else if (playlist.clear) {
				playlist.clear();
			}
		}

		// Add tracks to playlist. Some builds don't allow JS arrays to be passed into native methods.
		if (playlist.addTracksAsync) {
			var createTracklist = true;
			if (createTracklist) {
				let tracklist = null;
				if (app.utils?.createTracklist) {
					tracklist = app.utils.createTracklist(true);
					(tracks || []).forEach((t) => {
						if (t) {
							tracklist.add(t);
						}
					});
				}
				if (tracklist) {
					await playlist.addTracksAsync(tracklist);
				} else if (playlist.addTrack) {
					(tracks || []).forEach((t) => {
						if (t) {
							playlist.addTrack(t);
						}
					});
				}
			} else {
				await playlist.addTracksAsync(tracks);
			}
		} else if (playlist.addTracks) {
			playlist.addTracks(tracks);
		} else if (playlist.addTrack) {
			tracks.forEach((t) => playlist.addTrack(t));
		}

		// navigation: 1 navigate to playlist, 2 navigate to now playing
		const nav = intSetting('Navigate');
		try {
			if (nav === 1 && app.ui?.navigateToPlaylist && playlist.id) {
				app.ui.navigateToPlaylist(playlist.id);
			} else if (nav === 2 && app.ui?.navigateNowPlaying) {
				app.ui.navigateNowPlaying();
			}
		} catch (e) {
			log(e.toString());
		}
	}

	/**
	 * Find an existing playlist by title.
	 * @param {string} name Playlist title.
	 * @returns {object|null}
	 */
	function findPlaylist(name) {
		if (app.playlists?.findByTitle) return app.playlists.findByTitle(name);
		if (app.playlists?.getByTitle) return app.playlists.getByTitle(name);
		return null;
	}

	/**
	 * In-place Fisher–Yates shuffle.
	 * @param {any[]} arr Array to shuffle.
	 */
	function shuffle(arr) {
		for (let i = arr.length - 1; i > 0; i -= 1) {
			const j = Math.floor(Math.random() * (i + 1));
			[arr[i], arr[j]] = [arr[j], arr[i]];
		}
	}

	/**
	 * Ensure the ranking table exists (used when Rank mode is enabled).
	 */
	async function ensureRankTable() {
		if (!app.db?.executeAsync) return;
		try {
			await app.db.executeAsync('CREATE TABLE IF NOT EXISTS SimArtSongRank (ID INTEGER PRIMARY KEY, Rank INTEGER)');
		} catch (e) {
			log(e.toString());
		}
	}

	/**
	 * Clear existing rank weights for a new run.
	 */
	async function resetRankTable() {
		if (!app.db?.executeAsync) return;
		try {
			await app.db.executeAsync('DELETE FROM SimArtSongRank');
		} catch (e) {
			log(e.toString());
		}
	}

	/**
	 * Populate ranking weights for tracks by an artist based on Last.fm top track order.
	 * Higher rank means higher priority in SQL ORDER BY.
	 * @param {string} artistName Artist name.
	 */
	async function updateRankForArtist(artistName) {
		if (!artistName || !app.db?.executeAsync) return;
		const titles = await fetchTopTracksForRank(fixPrefixes(artistName));
		for (let i = 0; i < titles.length; i++) {
			const title = titles[i];
			const matches = await findLibraryTracks(artistName, title, 5, { rank: false, best: false });
			const rank = 101 - (i + 1);
			for (const m of matches) {
				await upsertRank(m.id || m.ID, rank);
			}
		}
	}

	/**
	 * Insert/update a rank value for a track id.
	 * @param {number} id Track ID.
	 * @param {number} rank Rank value.
	 */
	async function upsertRank(id, rank) {
		if (!app.db?.executeAsync) return;
		try {
			await app.db.executeAsync('REPLACE INTO SimArtSongRank (ID, Rank) VALUES (?, ?)', [id, rank]);
		} catch (e) {
			log(e.toString());
		}
	}


	/**
	 * Add-on initialization.
	 * Ensures the app API is available and optionally attaches auto-mode.
	 */
	function start() {
		if (state.started) return;
		state.started = true;
		log('Starting SimilarArtists addon...');

		// Check for MM5 environment
		if (typeof app === 'undefined') {
			log('MediaMonkey 5 app API not found.');
			return;
		}

		ensureDefaults();
		//registerActions();
		//registerSettingsSheet();
		if (getSetting('OnPlay', false))
			attachAuto();

		log('SimilarArtists addon started successfully.');
	}

	//// Auto-initialize when script loads
	//(function init() {
	//	// Wait for app to be available
	//	if (typeof app !== 'undefined') {
	//		start();
	//	} else if (typeof window !== 'undefined') {
	//		// Try to start when window is ready
	//		window.addEventListener('load', function () {
	//			start();
	//		});
	//	}
	//})();

	//// Export functions to window/global scope for info.json access
	//if (typeof window !== 'undefined') {
	//	window.start = start;
	//	window.runSimilarArtists = runSimilarArtists;
	//	window.toggleAuto = toggleAuto;
	//}

	//// For CommonJS/module environments
	//if (typeof module !== 'undefined' && module.exports) {
	//	module.exports = {
	//		start: start,
	//		runSimilarArtists: runSimilarArtists,
	//		toggleAuto: toggleAuto
	//	};
	//}

	//// For ES6 module environments
	//if (typeof exports !== 'undefined') {
	//	exports.start = start;
	//	exports.runSimilarArtists = runSimilarArtists;
	//	exports.toggleAuto = toggleAuto;
	//}

	/**
	 * Get list of playlist names for the parent playlist dropdown
	 * @returns {string[]} Array of playlist names
	 */
	function getPlaylistNames() {
		const names = [];
		try {
			if (app.playlists?.getAll) {
				const playlists = app.playlists.getAll();
				if (playlists?.forEach) {
					playlists.forEach((p) => {
						if (p?.title) names.push(p.title);
					});
				}
			}
		} catch (e) {
			log(e.toString());
		}
		names.sort((a, b) => a.localeCompare(b));
		return names;
	}

	/**
	 * Refresh toolbar button visibility based on settings
	 */
	function refreshToolbarVisibility() {
		try {
			const toolbarMode = intSetting('Toolbar');
			if (app.toolbar?.setButtonVisible) {
				app.toolbar.setButtonVisible(TOOLBAR_RUN_ID, toolbarMode === 1 || toolbarMode === 3);
				app.toolbar.setButtonVisible(TOOLBAR_AUTO_ID, toolbarMode === 2 || toolbarMode === 3);
			}
		} catch (e) {
			log(e.toString());
		}
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

	// Export functions to the global scope
	globalArg.SimilarArtists = {
		ensureDefaults,
		start,
		runSimilarArtists,
		toggleAuto,
	};

})(typeof window !== 'undefined' ? window : global);