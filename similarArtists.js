(function (globalArg) {
	'use strict';

	const SCRIPT_ID = 'SimilarArtists';
	const MENU_RUN_ID = SCRIPT_ID + '.menu.run';
	const MENU_AUTO_ID = SCRIPT_ID + '.menu.toggleAuto';
	const ACTION_RUN_ID = SCRIPT_ID + '.run';
	const ACTION_AUTO_ID = SCRIPT_ID + '.toggleAuto';
	const TOOLBAR_RUN_ID = 'sa-run';
	const TOOLBAR_AUTO_ID = 'sa-auto';
	const SETTINGS_SHEET_ID = SCRIPT_ID + '.settings';
	const API_BASE = 'https://ws.audioscrobbler.com/2.0/';
	//const API_KEY = app.settings.getValue('ApiKey', '') || '6cfe51c9bf7e77d6449e63ac0db2ac24';

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

	const state = {
		autoListen: null,
		started: false,
		cancelled: false,
	};

	function log(txt) {
		try {
			console.log('SimilarArtists: ' + txt);
		} catch (e) {
			// ignore
		}
	}

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
	function getApiKey() {
		return app?.settings?.getValue?.('SimilarArtists.ApiKey', '') || '6cfe51c9bf7e77d6449e63ac0db2ac24';
	}

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

	function setSetting(key, value) {
		if (typeof app === 'undefined' || !app.setValue) return;
		app.setValue(SCRIPT_ID, key, value);
	}

	function stringSetting(key) {
		return String(getSetting(key, defaults[key] || ''));
	}

	function boolSetting(key) {
		const val = getSetting(key, defaults[key]);
		return Boolean(val);
	}

	function intSetting(key) {
		const val = getSetting(key, defaults[key]);
		return parseInt(val, 10) || 0;
	}

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

	function toggleAuto() {
		const next = !getSetting('OnPlay', false);
		setSetting('OnPlay', next);
		refreshToggleUI();
		if (next) attachAuto();
		else detachAuto();
	}

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

	async function handleAuto() {
		try {
			if (!getSetting('OnPlay', false)) return;
			const player = app.player;
			if (!player || !player.playlist) return;
			const list = player.playlist;
			if (typeof list.getCursor === 'function' && typeof list.count === 'function') {
				if (list.getCursor() + 2 > list.count()) {
					await runSimilarArtists(true);
				}
			}
		} catch (e) {
			log(e.toString());
		}
	}

	function parseListSetting(key) {
		return stringSetting(key)
			.split(',')
			.map((s) => s.trim())
			.filter((s) => s.length > 0);
	}

	function normalizeName(name) {
		return (name || '').trim();
	}

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
				seeds.push({ name: normalizeName(t.artist), track: getTrackInfo(t) });
			}
		});
		return seeds;
	}

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

			if (rankEnabled) {
				await ensureRankTable();
				await resetRankTable();
			}

			const allTracks = [];
			if (includeSeedTrack && seeds.length === 1 && seeds[0].track) {
			allTracks.push(seeds[0].track);
			}

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

			if (randomise) shuffle(allTracks);
			if (enqueue || overwriteMode === 2) {
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

	async function confirmPlaylist(seedName, overwriteMode) {
		const baseName = stringSetting('Name').replace('%', seedName || '');
		const action = overwriteMode === 1 ? 'overwrite' : 'create';
		const res = await showToast(`SimilarArtists: Do you wish to ${action} playlist '${baseName}'?`, ['yes', 'no']);
		return res === 'yes';
	}

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

	async function fetchTopTracksForRank(artistName) {
		return fetchTopTracks(artistName, 100);
	}

	async function findLibraryTracks(artistName, title, limit, opts = {}) {
		try {
			if (!app?.db?.getTracklist) return [];

			const excludeTitles = parseListSetting('Exclude');
			const excludeGenres = parseListSetting('Genre');
			const ratingMin = intSetting('Rating');
			const allowUnknown = boolSetting('Unknown');

			// Start building SQL
			let sql = 'SELECT DISTINCT Songs.* FROM Songs';
			sql += ' INNER JOIN ArtistsSongs ON Songs.ID = ArtistsSongs.IDSong AND ArtistsSongs.PersonType = 1';
			sql += ' INNER JOIN Artists ON ArtistsSongs.IDArtist = Artists.ID';

			if (opts.rank) {
				sql += ' LEFT OUTER JOIN SimArtSongRank ON Songs.ID = SimArtSongRank.ID';
			}

			if (excludeGenres.length > 0) {
				sql += ' LEFT JOIN GenresSongs ON Songs.ID = GenresSongs.IDSong';
			}

			const whereParts = [];

			// Artist matching (handle prefixes)
			if (artistName) {
				const artistConds = [];
				artistConds.push(`Artists.Artist = '${escapeSql(artistName)}'`);

				const prefixes = getIgnorePrefixes();
				for (const prefix of prefixes) {
					const prefixLower = prefix.toLowerCase();
					const nameLower = (artistName || '').toLowerCase();
					if (nameLower.startsWith(prefixLower + ' ')) {
						const withoutPrefix = artistName.slice(prefix.length + 1);
						artistConds.push(`Artists.Artist = '${escapeSql(`${withoutPrefix}, ${prefix}`)}'`);
					}
				}

				whereParts.push(`(${artistConds.join(' OR ')})`);
			}

			// Title matching (fuzzy strip)
			if (title) {
				const strippedTitle = stripName(title);
				if (strippedTitle) {
					// Mirror the VBS/SQL strip routine used elsewhere
					const stripExpr = "REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(UPPER(Songs.SongTitle),'&','AND'),'+','AND'),' N ','AND'),'''N''','AND'),' ',''),'.',''),',',''),':',''),';',''),'-',''),'_',''),'!',''),'''',''),'\"','')";
					whereParts.push(`${stripExpr} = '${escapeSql(strippedTitle)}'`);
				} else {
					whereParts.push(`Songs.SongTitle LIKE '%${escapeSql(title)}%'`);
				}
			}

			// Exclude titles
			excludeTitles.forEach((t) => {
				whereParts.push(`Songs.SongTitle NOT LIKE '%${escapeSql(t)}%'`);
			});

			// Exclude genres via subquery
			if (excludeGenres.length > 0) {
				const genreConditions = excludeGenres.map((g) => `GenreName LIKE '%${escapeSql(g)}%'`).join(' OR ');
				whereParts.push(`GenresSongs.IDGenre NOT IN (SELECT IDGenre FROM Genres WHERE ${genreConditions})`);
			}

			// Rating conditions
			if (ratingMin > 0) {
				if (allowUnknown) {
					whereParts.push(`(Songs.Rating < 0 OR Songs.Rating > ${ratingMin - 5})`);
				} else {
					whereParts.push(`(Songs.Rating > ${ratingMin - 5} AND Songs.Rating < 101)`);
				}
			} else if (!allowUnknown) {
				whereParts.push('(Songs.Rating > -1 AND Songs.Rating < 101)');
			}

			const whereClause = whereParts.length ? ` WHERE ${whereParts.join(' AND ')}` : '';

			// Order by
			const order = [];
			if (opts.rank) order.push('SimArtSongRank.Rank DESC');
			if (opts.best) order.push('Songs.Rating DESC');
			order.push('Random()');
			const orderBy = ` ORDER BY ${order.join(',')}`;

			const limitClause = typeof limit === 'number' && limit > 0 ? ` LIMIT ${limit}` : '';

			sql += whereClause + ' GROUP BY Songs.SongTitle' + orderBy + limitClause;

			log('SQL: ' + sql);

			// Execute and wait for tracklist to load
			const tl = app.db.getTracklist(sql, -1);
			await tl.whenLoaded();

			// Convert to array and return up to requested limit
			const arr = [];
			tl.forEach((t) => arr.push(t));
			return typeof limit === 'number' ? arr.slice(0, limit) : arr;
		} catch (e) {
			log('findLibraryTracks error: ' + e.toString());
			return [];
		}
	}

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