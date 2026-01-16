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
		Toolbar: 1, // 0=none 1=run 2=auto 3=both
		Confirm: true,
		Sort: false,
		Limit: 5,
		Name: 'Artists similar to %',
		TPA: 9999,
		TPL: 9999,
		Random: false,
		Seed: false,
		Seed2: false,
		Best: false,
		Rank: false,
		Rating: 0,
		Unknown: true,
		Overwrite: 0, // 0=create, 1=overwrite, 2=do not create playlist (enqueue only)
		Enqueue: false,
		Navigate: 0,
		OnPlay: false,
		ClearNP: false,
		Ignore: false,
		Parent: '',
		Black: '',
		Exclude: '',
		Genre: '',
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


	// At top of js/similarArtists.js (or in your existing file)
	function getApiKey() {
		return app?.settings?.getValue?.('SimilarArtists.ApiKey', '') || '6cfe51c9bf7e77d6449e63ac0db2ac24';
	}

	function getSetting(key, fallback) {
		if (typeof app === 'undefined' || !app.getValue) return fallback;
		const val = app.getValue(SCRIPT_ID, key);
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
	 * Strip and normalize a song title for fuzzy matching
	 * @param {string} name - Title to normalize
	 * @returns {string} Normalized uppercase title
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

	function getToggleIcon() {
		return getSetting('OnPlay', false) ? 'checkbox-checked' : 'checkbox-unchecked';
	}

	function registerActions() {
		// Actions/menus are registered via `actions_add.js` + `init.js` (window.actions + window._menuItems)
		// `app.actions` / `app.menu.*` are not stable/available across MM5 builds.
		return;

		// MM5 uses actions.add() to register actions
		try {
			// Register the main run action
			const actionsApi = app.actions || (typeof actions !== 'undefined' ? actions : null);
			if (actionsApi && actionsApi.add) {
				actionsApi.add({
					id: ACTION_RUN_ID,
					title: _('Similar Artists'),
					icon: 'script',
					disabled: false,
					visible: true,
					execute: function () {
						runSimilarArtists(false);
					}
				});

				actionsApi.add({
					id: ACTION_AUTO_ID,
					title: _('Similar Artists (Auto On/Off)'),
					icon: 'script',
					disabled: false,
					visible: true,
					execute: function () {
						toggleAuto();
					}
				});

				log('Actions registered successfully');
			} else {
				log('actions.add not available');
			}
		} catch (e) {
			log('Error registering actions: ' + e.toString());
		}

		try {
			// Prefer app.menu/tools if available, fall back to menuItems/uitool
			if (app.menu?.tools?.addItem) {
				app.menu.tools.addItem({ id: MENU_RUN_ID, title: _('Similar Artists'), action: ACTION_RUN_ID });
				app.menu.tools.addItem({ id: MENU_AUTO_ID, title: _('Similar Artists (Auto On/Off)'), action: ACTION_AUTO_ID });
				log('Menu items added via app.menu.tools.addItem');
			} else if (typeof menuItems !== 'undefined' && menuItems.add) {
				menuItems.add({ id: MENU_RUN_ID, title: _('Similar Artists'), action: ACTION_RUN_ID, menuId: 'tools' });
				menuItems.add({ id: MENU_AUTO_ID, title: _('Similar Artists (Auto On/Off)'), action: ACTION_AUTO_ID, menuId: 'tools' });
				log('Menu items added via menuItems.add');
			} else if (typeof uitool !== 'undefined' && uitool.menu) {
				var toolsMenu = uitool.menu.tools || uitool.menu.getItem('tools');
				if (toolsMenu && toolsMenu.addItem) {
					toolsMenu.addItem({ id: MENU_RUN_ID, title: _('Similar Artists'), action: ACTION_RUN_ID });
					toolsMenu.addItem({ id: MENU_AUTO_ID, title: _('Similar Artists (Auto On/Off)'), action: ACTION_AUTO_ID });
					log('Menu items added to Tools menu via uitool');
				}
			}
		} catch (e) {
			log('Error adding menu items: ' + e.toString());
		}

		try {
			// Add toolbar buttons
			const toolbarMode = Number(getSetting('Toolbar', defaults.Toolbar));
			if (app.toolbar?.addButton) {
				if (toolbarMode === 1 || toolbarMode === 3) {
					app.toolbar.addButton({ id: TOOLBAR_RUN_ID, title: _('Similar Artists'), action: ACTION_RUN_ID, icon: 'script', visible: true });
				}
				if (toolbarMode === 2 || toolbarMode === 3) {
					app.toolbar.addButton({ id: TOOLBAR_AUTO_ID, title: _('Similar Artists (Auto On/Off)'), action: ACTION_AUTO_ID, icon: 'script', visible: true });
				}
				log('Toolbar buttons added via app.toolbar.addButton');
			} else if (typeof uitool !== 'undefined' && uitool.toolbar && uitool.toolbar.addButton) {
				const toolbarMode = Number(getSetting('Toolbar', defaults.Toolbar));
				if (toolbarMode === 1 || toolbarMode === 3) {
					uitool.toolbar.addButton({
						id: TOOLBAR_RUN_ID,
						title: _('Similar Artists'),
						action: ACTION_RUN_ID,
						icon: 'script',
						visible: true
					});
				}
				if (toolbarMode === 2 || toolbarMode === 3) {
					uitool.toolbar.addButton({
						id: TOOLBAR_AUTO_ID,
						title: _('Similar Artists (Auto On/Off)'),
						action: ACTION_AUTO_ID,
						icon: 'script',
						visible: true
					});
				}
				log('Toolbar buttons added');
			}
		} catch (e) {
			log('Error adding toolbar buttons: ' + e.toString());
		}
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
		if (app.selection?.getTracklist) {
			list = app.selection.getTracklist();
		}
		const count = typeof list?.count === 'function' ? list.count() : (list?.count || 0);
		if (!list || count === 0) {
			list = app.player?.getCurrentTracklist?.() || app.player?.playlist;
		}
		if (!list) return [];
		const tracks = list.toArray ? list.toArray() : list;
		const seeds = [];
		(tracks || []).forEach((t) => {
			if (t && t.artist) {
				seeds.push({ name: normalizeName(t.artist), track: t });
			}
		});
		return seeds;
	}

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
		const seedsRaw = collectSeedTracks();
		const seeds = uniqueArtists(seedsRaw);
		if (!seeds.length) {
			if (app.messageBox) {
				app.messageBox('SimilarArtists: Select at least one track to seed the playlist.');
			}
			return;
		}

		const progress = app.ui?.createProgress?.('SimilarArtists', seeds.length) || null;
		const artistLimit = intSetting('Limit');
		const tracksPerArtist = intSetting('TPA');
		const totalLimit = intSetting('TPL');
		const includeSeedArtist = boolSetting('Seed');
		const includeSeedTrack = boolSetting('Seed2');
		const randomise = boolSetting('Random');
		const enqueue = boolSetting('Enqueue');
		const ignoreDupes = boolSetting('Ignore');
		const clearNP = boolSetting('ClearNP');
		const overwriteMode = intSetting('Overwrite');
		const confirm = boolSetting('Confirm');
		const rankEnabled = boolSetting('Rank');
		const bestEnabled = boolSetting('Best');

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
			if (progress?.terminate || state.cancelled) {
				if (progress?.close) progress.close();
				if (confirm) {
					app.messageBox?.('SimilarArtists: Process cancelled by user.');
				}
				return;
			}

			const seed = seedSlice[i];
			if (progress) {
				progress.maxValue = seedSlice.length;
				progress.value = i;
				progress.text = `Processing ${seed.name} (${i + 1}/${seedSlice.length})`;
			}

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
				if (progress?.terminate || state.cancelled) {
					break;
				}

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
			if (progress?.close) progress.close();
			if (app.messageBox) {
				app.messageBox('SimilarArtists: No matching tracks found in library.');
			}
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

		if (progress?.close) progress.close();

		// Show completion message if confirm is enabled
		if (confirm && !autoRun) {
			const count = seedSlice.length;
			if (count === 1) {
				app.messageBox?.('SimilarArtists: Artist has been processed.');
			} else {
				app.messageBox?.(`SimilarArtists: All ${count} artists have been processed.`);
			}
		}
	}

	async function confirmPlaylist(seedName, overwriteMode) {
		if (!app.messageBox) return true;
		const baseName = stringSetting('Name').replace('%', seedName || '');
		const action = overwriteMode === 1 ? 'overwrite' : 'create';
		const res = await app.messageBox(`SimilarArtists: Do you wish to ${action} playlist '${baseName}'?`, ['yes', 'no']);
		return res === 'yes';
	}

	async function fetchSimilarArtists(artistName) {
		try {
			const url = `${API_BASE}?method=artist.getSimilar&api_key=${encodeURIComponent(getApiKey())}&format=json&limit=${getSetting('Limit', defaults.Limit)}&artist=${encodeURIComponent(artistName)}`;
			const res = await fetch(url);
			const data = await res.json();
			return data?.similarartists?.artist || [];
		} catch (e) {
			log(e.toString());
			return [];
		}
	}

	async function fetchTopTracks(artistName, limit) {
		try {
			const url = `${API_BASE}?method=artist.getTopTracks&api_key=${encodeURIComponent(getApiKey())}&format=json&limit=${limit}&artist=${encodeURIComponent(artistName)}`;
			const res = await fetch(url);
			const data = await res.json();
			const tracks = data?.toptracks?.track || [];
			const titles = [];
			tracks.forEach((t) => {
				if (t?.name) titles.push(t.name);
			});
			return titles.slice(0, limit);
		} catch (e) {
			log(e.toString());
			return [];
		}
	}

	async function fetchTopTracksForRank(artistName) {
		return fetchTopTracks(artistName, 100);
	}

	async function findLibraryTracks(artistName, title, limit, opts = {}) {
		const excludeTitles = parseListSetting('Exclude');
		const excludeGenres = parseListSetting('Genre');
		const ratingMin = intSetting('Rating');
		const allowUnknown = boolSetting('Unknown');

		try {
			// Try to use SQL-based search first (more accurate like the VBS version)
			if (app.db?.getTracklistBySQLAsync) {
				const conds = [];
				const params = [];

				// Build the base query joining through ArtistsSongs for proper artist matching
				let sql = 'SELECT DISTINCT Songs.* FROM Songs';
				sql += ' INNER JOIN ArtistsSongs ON Songs.ID = ArtistsSongs.IDSong AND ArtistsSongs.PersonType = 1';
				sql += ' INNER JOIN Artists ON ArtistsSongs.IDArtist = Artists.ID';

				if (opts.rank) {
					sql += ' LEFT OUTER JOIN TrixSongRank ON Songs.ID = TrixSongRank.ID';
				}

				if (excludeGenres.length > 0) {
					sql += ' LEFT JOIN GenresSongs ON Songs.ID = GenresSongs.IDSong';
				}

				// Artist condition - handle prefixes
				const prefixes = getIgnorePrefixes();
				const artistConditions = [`Artists.Artist = ?`];
				params.push(artistName);

				// Add alternate artist name forms for prefix handling
				for (const prefix of prefixes) {
					const prefixLower = prefix.toLowerCase();
					const nameLower = artistName.toLowerCase();
					if (nameLower.startsWith(prefixLower + ' ')) {
						// "The Beatles" -> also search "Beatles, The"
						const withoutPrefix = artistName.slice(prefix.length + 1);
						artistConditions.push(`Artists.Artist = ?`);
						params.push(`${withoutPrefix}, ${prefix}`);
					}
				}
				conds.push(`(${artistConditions.join(' OR ')})`);

				// Title condition with fuzzy matching
				if (title) {
					const strippedTitle = stripName(title);
					if (strippedTitle) {
						// Use SQL function-based strip matching like VBS version
						conds.push(`REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(UPPER(Songs.SongTitle),'&','AND'),'+','AND'),' N ','AND'),'''N''','AND'),' ',''),'.',''),',',''),':',''),';',''),'-',''),'_',''),'!',''),'''',''),'"','') = ?`);
						params.push(strippedTitle);
					} else {
						conds.push('Songs.SongTitle LIKE ?');
						params.push(title);
					}
				}

				// Exclude titles
				excludeTitles.forEach((t) => {
					conds.push('Songs.SongTitle NOT LIKE ?');
					params.push(`%${t}%`);
				});

				// Exclude genres
				if (excludeGenres.length > 0) {
					const genreConditions = excludeGenres.map(() => 'Genres.GenreName LIKE ?').join(' OR ');
					conds.push(`GenresSongs.IDGenre NOT IN (SELECT IDGenre FROM Genres WHERE ${genreConditions})`);
					excludeGenres.forEach((g) => params.push(g));
				}

				// Rating conditions
				if (ratingMin > 0) {
					if (allowUnknown) {
						conds.push('(Songs.Rating < 0 OR Songs.Rating > ?)');
						params.push(ratingMin - 5);
					} else {
						conds.push('(Songs.Rating > ? AND Songs.Rating < 101)');
						params.push(ratingMin - 5);
					}
				} else if (!allowUnknown) {
					conds.push('(Songs.Rating > -1 AND Songs.Rating < 101)');
				}

				const where = conds.length ? ` WHERE ${conds.join(' AND ')}` : '';

				// Order by
				const order = [];
				if (opts.rank) order.push('TrixSongRank.Rank DESC');
				if (opts.best) order.push('Songs.Rating DESC');
				order.push('Random()');
				const orderBy = ` ORDER BY ${order.join(',')}`;

				sql += where + ' GROUP BY Songs.SongTitle' + orderBy + ` LIMIT ${limit}`;

				log('SQL: ' + sql);
				const tl = await app.db.getTracklistBySQLAsync(sql, params);
				return tracklistToArray(tl, limit);
			}

			// Fallback to query-based search
			if (app.db?.getTracklistByQueryAsync) {
				const queryParts = [];
				if (artistName) queryParts.push(`artist:"${artistName}"`);
				if (title) queryParts.push(`title:"${title}"`);
				excludeTitles.forEach((t) => queryParts.push(`NOT title:${t}`));
				const query = queryParts.join(' AND ');
				const tl = await app.db.getTracklistByQueryAsync(query, { limit });
				return tracklistToArray(tl, limit);
			}
		} catch (e) {
			log('findLibraryTracks error: ' + e.toString());
		}
		return [];
	}

	function tracklistToArray(list, limit) {
		if (!list) return [];
		if (list.toArray) {
			const arr = list.toArray();
			return typeof limit === 'number' ? arr.slice(0, limit) : arr;
		}
		return [];
	}

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

	async function createPlaylist(tracks, seedName, overwriteMode) {
		const titleTemplate = stringSetting('Name');
		const baseName = titleTemplate.replace('%', seedName || '');
		let name = baseName;
		let playlist = findPlaylist(name);
		if (overwriteMode === 0) {
			let idx = 1;
			while (playlist) {
				idx += 1;
				name = `${baseName}_${idx}`;
				playlist = findPlaylist(name);
			}
		}
		if (!playlist && app.playlists?.createPlaylist) {
			playlist = app.playlists.createPlaylist(name, stringSetting('Parent'));
		}
		if (!playlist) return;
		if (overwriteMode === 1 && playlist.clear) playlist.clear();
		if (playlist.addTracks) playlist.addTracks(tracks);
		else if (playlist.addTrack) tracks.forEach((t) => playlist.addTrack(t));

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

	function findPlaylist(name) {
		if (app.playlists?.findByTitle) return app.playlists.findByTitle(name);
		if (app.playlists?.getByTitle) return app.playlists.getByTitle(name);
		return null;
	}

	function shuffle(arr) {
		for (let i = arr.length - 1; i > 0; i -= 1) {
			const j = Math.floor(Math.random() * (i + 1));
			[arr[i], arr[j]] = [arr[j], arr[i]];
		}
	}

	async function ensureRankTable() {
		if (!app.db?.executeAsync) return;
		try {
			await app.db.executeAsync('CREATE TABLE IF NOT EXISTS TrixSongRank (ID INTEGER PRIMARY KEY, Rank INTEGER)');
		} catch (e) {
			log(e.toString());
		}
	}

	async function resetRankTable() {
		if (!app.db?.executeAsync) return;
		try {
			await app.db.executeAsync('DELETE FROM TrixSongRank');
		} catch (e) {
			log(e.toString());
		}
	}

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

	async function upsertRank(id, rank) {
		if (!app.db?.executeAsync) return;
		try {
			await app.db.executeAsync('REPLACE INTO TrixSongRank (ID, Rank) VALUES (?, ?)', [id, rank]);
		} catch (e) {
			log(e.toString());
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
		registerSettingsSheet();
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
	 * Initialize the settings panel UI
	 * @param {object} panel - The panel/sheet object from MM5
	 */
	function initSettingsPanel(panel) {
		try {
			const ui = app.ui;

			// Toolbar dropdown
			ui.addLabel(panel, { left: 5, top: 10, width: 80, caption: 'Toolbar buttons:' });
			ui.addDropdown(panel, {
				id: 'SAToolbar',
				left: 90, top: 7, width: 100,
				items: ['None', 'Run script', 'Auto on/off', 'Both'],
				selectedIndex: intSetting('Toolbar'),
			});

			// --- Last.fm API key ---
			ui.addLabel(panel, {
				left: 5, top: 10 + 430, width: 120,   // adjust top to where you want it
				caption: 'Last.fm API key:'
			});

			ui.addEdit(panel, {
				id: 'SAApiKey',
				left: 130, top: 7 + 430, width: 260,  // align with your layout
				text: app.settings?.getValue?.('SimilarArtists.ApiKey', '') || '',
				hint: 'Enter your Last.fm API key',
			});

			// Confirm checkbox
			ui.addCheckbox(panel, {
				id: 'SAConfirm',
				left: 5, top: 35, width: 200,
				caption: 'Show confirmation prompt?',
				checked: boolSetting('Confirm'),
			});

			// Sort checkbox
			ui.addCheckbox(panel, {
				id: 'SASort',
				left: 5, top: 60, width: 200,
				caption: 'Sort artists before processing?',
				checked: boolSetting('Sort'),
			});

			// Random checkbox
			ui.addCheckbox(panel, {
				id: 'SARandom',
				left: 225, top: 10, width: 200,
				caption: 'Randomise playlists?',
				checked: boolSetting('Random'),
			});

			// Seed artist checkbox
			ui.addCheckbox(panel, {
				id: 'SASeed',
				left: 225, top: 35, width: 200,
				caption: 'Include seed artist?',
				checked: boolSetting('Seed'),
			});

			// Seed track checkbox
			ui.addCheckbox(panel, {
				id: 'SASeed2',
				left: 225, top: 60, width: 200,
				caption: 'Include seed track (if only one)?',
				checked: boolSetting('Seed2'),
			});

			// Overwrite dropdown
			ui.addLabel(panel, { left: 5, top: 85, width: 80, caption: 'Playlist creation:' });
			ui.addDropdown(panel, {
				id: 'SAOverwrite',
				left: 90, top: 82, width: 300,
				items: ['Create new playlist', 'Overwrite existing playlist', 'Do not create playlist'],
				selectedIndex: intSetting('Overwrite'),
			});

			// Playlist name
			ui.addLabel(panel, { left: 5, top: 110, width: 80, caption: 'Playlist name:' });
			ui.addEdit(panel, {
				id: 'SAName',
				left: 90, top: 107, width: 300,
				text: stringSetting('Name'),
				hint: 'Use % to represent the artist name',
			});

			// Artist limit
			ui.addLabel(panel, { left: 5, top: 135, width: 80, caption: 'Artist limit:' });
			ui.addSpinEdit(panel, {
				id: 'SALimit',
				left: 90, top: 132, width: 50,
				minValue: 0, maxValue: 9999,
				value: intSetting('Limit'),
			});

			// Tracks per artist
			ui.addLabel(panel, { left: 5, top: 160, width: 80, caption: 'Tracks/artist:' });
			ui.addSpinEdit(panel, {
				id: 'SATPA',
				left: 90, top: 157, width: 50,
				minValue: 0, maxValue: 9999,
				value: intSetting('TPA'),
				hint: 'Maximum number of tracks from a single artist in a playlist',
			});

			// Best checkbox
			ui.addCheckbox(panel, {
				id: 'SABest',
				left: 225, top: 135, width: 200,
				caption: 'Select highest rated in library?',
				checked: boolSetting('Best'),
			});

			// Rank checkbox
			ui.addCheckbox(panel, {
				id: 'SARank',
				left: 225, top: 160, width: 200,
				caption: 'Select highest ranked by Last.Fm?',
				checked: boolSetting('Rank'),
			});

			// Tracks per playlist
			ui.addLabel(panel, { left: 5, top: 186, width: 80, caption: 'Tracks/playlist:' });
			ui.addSpinEdit(panel, {
				id: 'SATPL',
				left: 90, top: 182, width: 50,
				minValue: 0, maxValue: 9999,
				value: intSetting('TPL'),
				hint: 'Maximum number of tracks in total in a playlist',
			});

			// Parent playlist
			ui.addLabel(panel, { left: 5, top: 210, width: 80, caption: 'Parent playlist:' });
			const parentItems = ['[Playlists]'].concat(getPlaylistNames());
			const parentIndex = Math.max(0, parentItems.indexOf(stringSetting('Parent')));
			ui.addDropdown(panel, {
				id: 'SAParent',
				left: 90, top: 207, width: 300,
				items: parentItems,
				selectedIndex: parentIndex,
				hint: 'Please select a playlist',
			});

			// Exclude artists (blacklist)
			ui.addLabel(panel, { left: 5, top: 235, width: 80, caption: 'Exclude artists:' });
			ui.addEdit(panel, {
				id: 'SABlack',
				left: 90, top: 232, width: 300,
				text: stringSetting('Black'),
				hint: 'Comma separated list of artists names',
			});

			// Exclude genres
			ui.addLabel(panel, { left: 5, top: 260, width: 80, caption: 'Exclude genres:' });
			ui.addEdit(panel, {
				id: 'SAGenre',
				left: 90, top: 257, width: 300,
				text: stringSetting('Genre'),
				hint: 'Comma separated list of genres',
			});

			// Exclude titles
			ui.addLabel(panel, { left: 5, top: 285, width: 80, caption: 'Exclude titles:' });
			ui.addEdit(panel, {
				id: 'SAExclude',
				left: 90, top: 282, width: 300,
				text: stringSetting('Exclude'),
				hint: 'Comma separated list of words in titles',
			});

			// Minimum rating
			ui.addLabel(panel, { left: 5, top: 310, width: 80, caption: 'Minimum rating:' });
			ui.addDropdown(panel, {
				id: 'SARating',
				left: 90, top: 307, width: 100,
				items: ['0 stars', '0.5 stars', '1 star', '1.5 stars', '2 stars', '2.5 stars', '3 stars', '3.5 stars', '4 stars', '4.5 stars', '5 stars'],
				selectedIndex: Math.floor(intSetting('Rating') / 10),
				hint: 'Select minimum rating stars',
			});

			// Unknown rating checkbox
			ui.addCheckbox(panel, {
				id: 'SAUnknown',
				left: 225, top: 310, width: 200,
				caption: 'Include unknown rating?',
				checked: boolSetting('Unknown'),
			});

			// Navigation
			ui.addLabel(panel, { left: 5, top: 335, width: 80, caption: 'Navigation:' });
			ui.addDropdown(panel, {
				id: 'SANavigate',
				left: 90, top: 332, width: 300,
				items: ['None', 'Navigate to new playlist', 'Navigate to now playing'],
				selectedIndex: intSetting('Navigate'),
			});

			// OnPlay checkbox
			ui.addCheckbox(panel, {
				id: 'SAOnPlay',
				left: 5, top: 360, width: 400,
				caption: 'Automatically run the script when playing the last track?',
				checked: boolSetting('OnPlay'),
			});

			// Enqueue checkbox
			ui.addCheckbox(panel, {
				id: 'SAEnqueue',
				left: 5, top: 385, width: 400,
				caption: 'Automatically enqueue tracks?',
				checked: boolSetting('Enqueue'),
			});

			// ClearNP checkbox
			ui.addCheckbox(panel, {
				id: 'SAClearNP',
				left: 5, top: 410, width: 400,
				caption: 'Clear list before enqueuing tracks?',
				checked: boolSetting('ClearNP'),
			});

			// Ignore checkbox
			ui.addCheckbox(panel, {
				id: 'SAIgnore',
				left: 5, top: 435, width: 400,
				caption: 'Ignore recently played tracks when enqueuing?',
				checked: boolSetting('Ignore'),
			});
		} catch (e) {
			log('initSettingsPanel error: ' + e.toString());
		}
	}

	/**
	 * Save settings from the settings panel
	 * @param {object} panel - The panel/sheet object from MM5
	 */
	function saveSettingsPanel(panel) {
		try {
			const getControl = (id) => panel.getChildControl?.(id) || panel[id];

			const apiKeyCtrl = getControl('SAApiKey');
			if (apiKeyCtrl) {
				app.settings.setValue('SimilarArtists.ApiKey', apiKeyCtrl.text || '');
			}

			setSetting('Name', getControl('SAName')?.text || defaults.Name);
			setSetting('Limit', getControl('SALimit')?.value ?? defaults.Limit);
			setSetting('TPA', getControl('SATPA')?.value ?? defaults.TPA);
			setSetting('TPL', getControl('SATPL')?.value ?? defaults.TPL);
			setSetting('Confirm', getControl('SAConfirm')?.checked ?? defaults.Confirm);
			setSetting('Toolbar', getControl('SAToolbar')?.selectedIndex ?? defaults.Toolbar);
			setSetting('Sort', getControl('SASort')?.checked ?? defaults.Sort);

			const parentCtrl = getControl('SAParent');
			const parentText = parentCtrl?.text || parentCtrl?.items?.[parentCtrl?.selectedIndex] || '';
			setSetting('Parent', parentText === '[Playlists]' ? '' : parentText);

			setSetting('Black', getControl('SABlack')?.text || '');
			setSetting('Random', getControl('SARandom')?.checked ?? defaults.Random);
			setSetting('Seed', getControl('SASeed')?.checked ?? defaults.Seed);
			setSetting('Seed2', getControl('SASeed2')?.checked ?? defaults.Seed2);
			setSetting('Best', getControl('SABest')?.checked ?? defaults.Best);
			setSetting('Rank', getControl('SARank')?.checked ?? defaults.Rank);
			setSetting('Rating', (getControl('SARating')?.selectedIndex ?? 0) * 10);
			setSetting('Unknown', getControl('SAUnknown')?.checked ?? defaults.Unknown);
			setSetting('Genre', getControl('SAGenre')?.text || '');
			setSetting('Overwrite', getControl('SAOverwrite')?.selectedIndex ?? defaults.Overwrite);
			setSetting('Enqueue', getControl('SAEnqueue')?.checked ?? defaults.Enqueue);
			setSetting('Navigate', getControl('SANavigate')?.selectedIndex ?? defaults.Navigate);
			setSetting('OnPlay', getControl('SAOnPlay')?.checked ?? defaults.OnPlay);
			setSetting('ClearNP', getControl('SAClearNP')?.checked ?? defaults.ClearNP);
			setSetting('Exclude', getControl('SAExclude')?.text || '');
			setSetting('Ignore', getControl('SAIgnore')?.checked ?? defaults.Ignore);

			// Update auto mode based on OnPlay setting
			if (getSetting('OnPlay', false)) {
				attachAuto();
			} else {
				detachAuto();
			}

			// Update toolbar visibility
			refreshToolbarVisibility();
		} catch (e) {
			log('saveSettingsPanel error: ' + e.toString());
		}
	}

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

	function registerSettingsSheet() {
		try {
			//if (typeof app === 'undefined') return;
			if (!app.ui?.addOptionSheet) return;
			app.ui.addOptionSheet({
				id: SETTINGS_SHEET_ID,
				title: _('Similar Artists'),
				create: function (panel) {
					initSettingsPanel(panel);
				},
				apply: function (panel) {
					saveSettingsPanel(panel);
				}
			});
			log('Settings sheet registered');
		} catch (e) {
			log('Error registering settings sheet: ' + e.toString());
		}
	}

	// Export functions to the global scope
	globalArg.SimilarArtists = {
		ensureDefaults,
		start,
		runSimilarArtists,
		toggleAuto,
	};

})(typeof window !== 'undefined' ? window : global);