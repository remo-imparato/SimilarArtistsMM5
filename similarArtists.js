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
	 * @param {string} key Setting name.
	 * @param {*} value Setting value.
	 */
	function setSetting(key, value) {
		if (typeof app === 'undefined' || !app.setValue) return;
		app.setValue(SCRIPT_ID, key, value);
	}

	/**
	 * Get a setting coerced to integer.
	 * @param {string} key Setting key.
	 * @returns {number}
	 */
	function intSetting(key) {
		const v = getSetting(key, defaults[key]);
		return parseInt(v, 10) || 0;
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
		// Update UI icon to reflect new state
		refreshToggleUI();
		if (next) {
			attachAuto();
			log('SimilarArtists: Auto-mode enabled');
		} else {
			detachAuto();
			log('SimilarArtists: Auto-mode disabled');
		}
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

		// Use app.listen for proper MM5 event handling
		if (app.listen) {
			state.autoListen = app.listen(player, 'playbackState', (newState) => {
				log(`SimilarArtists: playbackState changed to '${newState}'`);
				if (newState === 'trackChanged') {
					handleAuto();
				}
			});
			log('SimilarArtists: Auto-mode listener attached (using app.listen)');
		} else if (player.on) {
			// Fallback for older API
			state.autoListen = player.on('playbackState', (newState) => {
				log(`SimilarArtists: playbackState changed to '${newState}'`);
				if (newState === 'trackChanged') {
					handleAuto();
				}
			});
			log('SimilarArtists: Auto-mode listener attached (using player.on)');
		} else {
			log('SimilarArtists: No event listener API available');
		}
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
				log('SimilarArtists: Auto-mode listener detached (using app.unlisten)');
			} else if (state.autoListen.off) {
				state.autoListen.off();
				log('SimilarArtists: Auto-mode listener detached (using listener.off)');
			}
		} catch (e) {
			log('SimilarArtists: Error detaching auto-mode listener: ' + e.toString());
		}
		state.autoListen = null;
	}

	/**
	 * Auto-mode handler that triggers when track changes near end of playlist.
	 * Generates similar artist tracks and enqueues them into Now Playing.
	 */
	async function handleAuto() {
		try {
			if (!getSetting('OnPlay', false)) {
				log('SimilarArtists: Auto-mode disabled, skipping handleAuto');
				return;
			}

			const player = app.player;
			if (!player || !player.playlist) {
				log('SimilarArtists: Player or playlist not available');
				return;
			}

			const list = player.playlist;
			if (typeof list.getCursor === 'function' && typeof list.count === 'function') {
				const cursor = list.getCursor();
				const count = list.count();
				const remainingTracks = count - cursor;

				log(`SimilarArtists: Playlist position: ${cursor}/${count} (${remainingTracks} tracks remaining)`);

				// When fewer than 3 tracks remain, trigger auto-queue
				if (remainingTracks < 3) {
					log('SimilarArtists: Near end of playlist, triggering auto-queue');
					await runSimilarArtists(true);
					return;
				}
			}

			log('SimilarArtists: Not near end of playlist, skipping auto-queue');
		} catch (e) {
			log('SimilarArtists: Error in handleAuto: ' + e.toString());
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
	 * Supports multiple selected tracks, each contributing their artist as a seed.
	 * Fallback to current playing track if no selection exists.
	 * @returns {{name: string, track?: object}[]}
	 */
	function collectSeedTracks() {
		if (typeof app === 'undefined') return [];

		const seeds = [];

		// Try to get selected tracks from the UI
		let selectedList = null;
		if (uitools?.getSelectedTracklist) {
			selectedList = uitools.getSelectedTracklist();
		}

		// Check if we have a valid selection with tracks
		const selectedCount = typeof selectedList?.count === 'function'
			? selectedList.count()
			: (selectedList?.count || 0);

		if (selectedList && selectedCount > 0) {
			// Process all selected tracks using forEach (not toArray)
			log(`collectSeedTracks: Found ${selectedCount} selected track(s)`);

			if (typeof selectedList.forEach === 'function') {
				// Use forEach for iteration (MM5 standard pattern)
				selectedList.forEach((t) => {
					if (t && t.artist) {
						seeds.push({ name: normalizeName(t.artist), track: t });
					}
				});
			} else if (typeof selectedList.toArray === 'function') {
				// Fallback to toArray if available
				const selectedTracks = selectedList.toArray();
				(selectedTracks || []).forEach((t) => {
					if (t && t.artist) {
						seeds.push({ name: normalizeName(t.artist), track: t });
					}
				});
			}

			if (seeds.length > 0) {
				return seeds;
			}
		}

		// Fallback: use current playing track if no selection
		log('collectSeedTracks: No selection found, falling back to currently playing track');
		const currentTrack = app.player?.getCurrentTrack?.();
		if (currentTrack && currentTrack.artist) {
			seeds.push({ name: normalizeName(currentTrack.artist), track: currentTrack });
			return seeds;
		}

		log('collectSeedTracks: No tracks found (no selection and no playing track)');
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
	 * @param {boolean} autoRun True when invoked by auto-mode (suppresses completion toast, forces enqueue).
	 */
	async function runSimilarArtists(autoRun) {
		state.cancelled = false;

		try {
			const seedsRaw = collectSeedTracks();
			const seeds = uniqueArtists(seedsRaw);
			if (!seeds.length) {
				showToast('SimilarArtists: Select at least one track to seed the playlist.');
				return;
			}
			log(`SimilarArtists: Collected ${seeds.length} seed artist(s): ${seeds.map(s => s.name).join(', ')}`);

			showToast('SimilarArtists: Running');

			// Load config block stored under this script id.
			var config = app.getValue(SCRIPT_ID, defaults);

			// Get progress token for UI updates
			const progressToken = app.db?.getProgressToken?.();

			const artistLimit = intSetting('Limit');
			const tracksPerArtist = intSetting('TPA');
			const totalLimit = intSetting('TPL');
			const includeSeedArtist = boolSetting('Seed');
			const includeSeedTrack = boolSetting('Seed2');
			const randomise = boolSetting('Random');
			let enqueue = boolSetting('Enqueue');
			const ignoreDupes = boolSetting('Ignore');
			const clearNP = boolSetting('ClearNP');
			const overwriteMode = config.Overwrite;
			const confirm = boolSetting('Confirm');
			const rankEnabled = boolSetting('Rank');
			const bestEnabled = boolSetting('Best');

			// In auto-mode, force enqueue and suppress UI
			if (autoRun) {
				enqueue = true;
				log('SimilarArtists: Auto-mode enabled - forcing enqueue to Now Playing');
			}

			// Log settings for debugging
			log(`Settings loaded: includeSeedArtist=${includeSeedArtist}, includeSeedTrack=${includeSeedTrack}, randomise=${randomise}, rankEnabled=${rankEnabled}`);

			// In-memory rank map: track ID -> rank score (used if rankEnabled)
			const trackRankMap = rankEnabled ? new Map() : null;

			const allTracks = [];
			// Optional: include currently selected/playing seed track (only for single seed).
			if (includeSeedTrack && seeds.length === 1 && seeds[0].track) {
				allTracks.push(seeds[0].track);
			}

			// Process each seed artist up to configured limit.
			const seedSlice = seeds.slice(0, artistLimit || seeds.length);
			for (let i = 0; i < seedSlice.length; i++) {
				const seed = seedSlice[i];

				// Update progress bar
				if (progressToken) {
					progressToken.text = `Processing ${seed.name} (${i + 1}/${seedSlice.length})`;
					progressToken.value = (i + 1) / seedSlice.length;
				}

				// Use fixPrefixes for the API call
				const artistNameForApi = fixPrefixes(seed.name);
				const similar = await fetchSimilarArtists(artistNameForApi);

				// Build pool: seed artist (optional) + similar artists.
				const artistPool = [];
				if (includeSeedArtist)
					artistPool.push(seed.name);

				similar.slice(0, artistLimit).forEach((a) => {
					if (a?.name)
						artistPool.push(a.name);
				});

				for (const artName of artistPool) {
					// Populate rank map: fetch top tracks for this artist and score them
					if (rankEnabled) {
						const titles = await fetchTopTracksForRank(fixPrefixes(artName));
						for (let rankIdx = 0; rankIdx < titles.length; rankIdx++) {
							const title = titles[rankIdx];
							// Score: higher rank for earlier positions (101 = 1st, 1 = 100th)
							const rankScore = 101 - (rankIdx + 1);
							const matches = await findLibraryTracks(artName, title, 5, { rank: false, best: false });
							for (const m of matches) {
								const trackId = m.id || m.ID;
								// Keep highest score if track appears in multiple artists' top tracks
								const currentScore = trackRankMap.get(trackId) || 0;
								if (rankScore > currentScore) {
									trackRankMap.set(trackId, rankScore);
								}
							}
						}
					}

					// Fetch top track titles from Last.fm, then try to find local matches.
					const titles = await fetchTopTracks(fixPrefixes(artName), tracksPerArtist);
					for (const title of titles) {
						const matches = await findLibraryTracks(artName, title, 1, { rank: false, best: false });
						matches.forEach((m) => allTracks.push(m));
						if (allTracks.length >= totalLimit) break;
					}
					if (allTracks.length >= totalLimit) break;
				}
				if (allTracks.length >= totalLimit) break;
			}

			if (!allTracks.length) {
				showToast('SimilarArtists: No matching tracks found in library.');
				return;
			}

			// Sort by rank score if enabled (before randomizing)
			if (rankEnabled && trackRankMap.size > 0) {
				allTracks.sort((a, b) => {
					const aScore = trackRankMap.get(a.id || a.ID) || 0;
					const bScore = trackRankMap.get(b.id || b.ID) || 0;
					return bScore - aScore; // Higher score first
				});
			}

			// Optional: randomize final track set.
			if (randomise)
				shuffle(allTracks);

			// Either enqueue to Now Playing or create a playlist, depending on settings.
			// In auto-mode, always enqueue to Now Playing
			if (enqueue || autoRun || overwriteMode.toLowerCase().indexOf("do not") > -1) {
				await enqueueTracks(allTracks, ignoreDupes, clearNP);
				log(`SimilarArtists: Enqueued ${allTracks.length} track(s) to Now Playing`);
			} else {
				const seedName = seeds[0]?.name || 'Similar Artists';
				const selectedPlaylist = !confirm ? null : (await confirmPlaylist(seedName, overwriteMode));
				if (selectedPlaylist || !confirm) {
					await createPlaylist(allTracks, seedName, overwriteMode, selectedPlaylist);
				} else {
					log('SimilarArtists: User cancelled playlist creation.');
				}
			}

			// Show completion message if confirm is enabled (suppress in auto-mode)
			if (confirm && !autoRun) {
				const count = seedSlice.length;
				if (count === 1) {
					showToast('SimilarArtists: Artist has been processed.');
				} else {
					showToast(`SimilarArtists: All ${count} artists have been processed.`);
				}
			}
		} catch (e) {
			log(e.msg || e.toString());
			showToast('SimilarArtists: An error occurred - see log for details.');
		}
	}

	/**
	 * Ask user for confirmation before creating/overwriting a playlist.
	 * Opens dlgSelectPlaylist dialog to let user select or create a playlist.
	 * If user clicks OK without selecting a playlist, automatically creates one with seedName.
	 * If user clicks Cancel, returns null to cancel the operation.
	 * @param {string} seedName Seed artist name used in playlist naming.
	 * @param {*} overwriteMode Mode label (Create/Overwrite/Do not create).
	 * @returns {Promise<object|null>} Selected/created playlist object, or null if user cancelled.
	 */
	async function confirmPlaylist(seedName, overwriteMode) {
		return new Promise((resolve) => {
			try {
				if (typeof uitools === 'undefined' || !uitools.openDialog) {
					log('confirmPlaylist: uitools.openDialog not available');
					resolve(null);
					return;
				}

				const dlg = uitools.openDialog('dlgSelectPlaylist', {
					modal: true,
					showNewPlaylist: true
				});

				dlg.whenClosed = function () {
					try {
						// User clicked Cancel (modalResult !== 1)
						if (dlg.modalResult !== 1) {
							log('confirmPlaylist: User cancelled dialog (modalResult=' + dlg.modalResult + ')');
							resolve(null);
							return;
						}

						// User clicked OK
						const selectedPlaylist = dlg.getValue('getPlaylist')?.();

						if (selectedPlaylist) {
							// User selected or created a playlist
							log(`confirmPlaylist: User selected/created playlist: ${selectedPlaylist.name || selectedPlaylist.title}`);
							resolve(selectedPlaylist);
						} else {
							// User clicked OK without selecting/creating a playlist
							// Auto-create a new playlist with seedName
							log(`confirmPlaylist: No playlist selected, auto-creating playlist with name: ${seedName}`);
							const templateName = stringSetting('Name');
							const playlistName = templateName.replace('%', seedName || 'Similar Artists');

							// Create the playlist
							let newPlaylist = null;
							if (app.playlists?.createPlaylist) {
								newPlaylist = app.playlists.createPlaylist(playlistName, stringSetting('Parent'));
								log(`confirmPlaylist: Auto-created playlist: ${playlistName}`);
								resolve(newPlaylist);
							} else if (app.playlists?.root?.newPlaylist) {
								// Old API path
								newPlaylist = app.playlists.root.newPlaylist();
								if (newPlaylist) {
									newPlaylist.name = playlistName;
									if (newPlaylist.commitAsync) {
										newPlaylist.commitAsync().then(() => {
											log(`confirmPlaylist: Auto-created playlist (legacy API): ${playlistName}`);
											resolve(newPlaylist);
										}).catch((err) => {
											log(`confirmPlaylist: Error committing auto-created playlist: ${err.toString()}`);
											resolve(newPlaylist);
										});
										return;
									}
									log(`confirmPlaylist: Auto-created playlist (legacy API): ${playlistName}`);
									resolve(newPlaylist);
								} else {
									log('confirmPlaylist: Failed to create playlist (legacy API)');
									resolve(null);
								}
							} else {
								log('confirmPlaylist: No playlist API available for auto-creation');
								resolve(null);
							}
						}
					} catch (e) {
						log('confirmPlaylist: Error in dialog closure: ' + e.toString());
						resolve(null);
					}
				};

				app.listen(dlg, 'closed', dlg.whenClosed);
			} catch (e) {
				log('confirmPlaylist: Error opening dialog: ' + e.toString());
				resolve(null);
			}
		});
	}

	/**
	 * Fetch similar artists from Last.fm.
	 * @param {string} artistName Main artist.
	 * @returns {Promise<any[]>} Last.fm similar-artist array.
	 */
	async function fetchSimilarArtists(artistName) {
		try {
			if (!artistName)
				return [];

			const apiKey = getApiKey();
			const limitVal = parseInt(getSetting('Limit', defaults?.Limit || 0), 10) || undefined;
			const params = new URLSearchParams({ method: 'artist.getSimilar', api_key: apiKey, format: 'json', artist: artistName });
			if (limitVal)
				params.set('limit', String(limitVal));

			const url = API_BASE + '?' + params.toString();
			log('fetchSimilarArtists: querying ' + url);
			//call to last fm api
			const res = await fetch(url);

			if (!res || !res.ok) {
				log(`fetchSimilarArtists: HTTP ${res?.status} ${res?.statusText} for ${artistName}`);
				return [];
			}
			let data;
			try {
				data = await res.json();
			} catch (e) {
				console.warn('fetchSimilarArtists: invalid JSON response: ' + e.toString());
				return [];
			}
			if (data?.error) {
				console.warn('fetchSimilarArtists: API error: ' + (data.message || data.error));
				return [];
			}
			const artists = data?.similarartists?.artist || [];
			if (!Array.isArray(artists) && artists)
				return [artists];
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
			if (!artistName)
				return [];
			const apiKey = getApiKey();
			const lim = Number(limit) || undefined;
			const params = new URLSearchParams({ method: 'artist.getTopTracks', api_key: apiKey, format: 'json', artist: artistName });
			if (lim)
				params.set('limit', String(lim));

			const url = API_BASE + '?' + params.toString();
			log('fetchTopTracks: querying ' + url);

			const res = await fetch(url);
			if (!res || !res.ok) {
				log(`fetchTopTracks: HTTP ${res?.status} ${res?.statusText} for ${artistName}`);
				return [];
			}
			let data;
			try {
				data = await res.json();
			} catch (e) {
				console.warn('fetchTopTracks: invalid JSON response: ' + e.toString());
				return [];
			}
			if (data?.error) {
				console.warn('fetchTopTracks: API error: ' + (data.message || data.error));
				return [];
			}
			let tracks = data?.toptracks?.track || [];
			if (tracks && !Array.isArray(tracks)) tracks = [tracks];
			const titles = [];
			tracks.forEach((t) => {
				if (t && (t.name || t.title))
					titles.push(t.name || t.title);
			});
			return typeof lim === 'number' ? titles.slice(0, lim) : titles;
		} catch (e) {
			log(e.toString());
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
		return fetchTopTracks(artistName, 100);
	}

	/**
	 * Find matching tracks in the MediaMonkey library.
	 * Uses SQL against the MediaMonkey DB to match by artist/title with optional filters.
	 * @param {string} artistName Artist to match.
	 * @param {string} title Track title to match.
	 * @param {number} limit Max matches to return.
	 * @param {{rank?: boolean, best?: boolean}} opts Controls ordering (not used; ranking handled in-memory).
	 * @returns {Promise<object[]>} Array of track objects.
	 */
	async function findLibraryTracks(artistName, title, limit, opts = {}) {
		try {
			if (!app?.db?.getTracklist)
				return [];

			const excludeTitles = parseListSetting('Exclude');
			const excludeGenres = parseListSetting('Genre');
			const ratingMin = intSetting('Rating');
			const allowUnknown = boolSetting('Unknown');

			// Base SELECT — no DISTINCT needed because Songs.ID is unique
			let sql = `
			SELECT Songs.*
			FROM Songs
			INNER JOIN ArtistsSongs 
				ON Songs.ID = ArtistsSongs.IDSong 
				AND ArtistsSongs.PersonType = 1
			INNER JOIN Artists 
				ON ArtistsSongs.IDArtist = Artists.ID
		`;

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

			// ORDER BY (randomize only; ranking is applied in-memory in runSimilarArtists)
			sql += ` ORDER BY Random()`;

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

		if (clearFirst && playlist.clear)
			playlist.clear();

		const existing = new Set();
		if (ignoreDupes && playlist.toArray) {
			playlist.toArray().forEach((t) => existing.add(t.id || t.ID));
		}

		// Add tracks one at a time to prevent deadlock
		for (let i = 0; i < tracks.length; i++) {
			const t = tracks[i];
			const id = t?.id || t?.ID;
			if (ignoreDupes && id && existing.has(id)) continue;
			
			// Use synchronous methods - MM5 handles queueing internally
			if (playlist.addTrack) {
				playlist.addTrack(t);
			} else if (playlist.addTracks) {
				playlist.addTracks([t]);
			} else if (player.appendTracks) {
				player.appendTracks([t]);
			}
		}
	}

	// Creates (or finds) a playlist then adds tracks. Matches APIs used in this repo.
	/**
	 * Create or locate a playlist, optionally overwrite its content, then add tracks.
	 * @param {object[]} tracks Tracks to add.
	 * @param {string} seedName Seed artist name used for playlist naming.
	 * @param {*} overwriteMode Playlist creation mode (Create/Overwrite/Do not create).
	 * @param {object|null} selectedPlaylist Pre-selected playlist from dialog (if provided).
	 * @returns {Promise<object|null>} Playlist object.
	 */
	async function createPlaylist(tracks, seedName, overwriteMode, selectedPlaylist) {
		const titleTemplate = stringSetting('Name');
		const baseName = titleTemplate.replace('%', seedName || '');
		let name = baseName;
		let playlist = selectedPlaylist || findPlaylist(name);

		const overwriteText = String(overwriteMode || '');

		//-- create new if mode is "Create new playlist"
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
		} else {
			log(`SimilarArtists: Using playlist '${name}' (ID: ${playlist.id || playlist.ID})`);
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
			// Try to add via tracklist for better performance
			if (app.utils?.createTracklist) {
				let tracklist = null;
				tracklist = app.utils.createTracklist(true);
				(tracks || []).forEach((t) => {
					if (t) {
						tracklist.add(t);
					}
				});
				
				// Use addTracksAsync with the tracklist
				if (tracklist && tracklist.count > 0) {
					await playlist.addTracksAsync(tracklist);
				}
			} else {
				// Fallback: add tracks individually
				for (let i = 0; i < (tracks || []).length; i++) {
					const t = tracks[i];
					if (t && playlist.addTrackAsync) {
						await playlist.addTrackAsync(t);
					}
				}
			}
		} else if (playlist.addTracks) {
			playlist.addTracks(tracks);
		} else if (playlist.addTrack) {
			tracks.forEach((t) => playlist.addTrack(t));
		}

		// navigation: 1 navigate to playlist, 2 navigate to now playing
		const nav = getSetting('Navigate');
		try {
			if (typeof window !== 'undefined' && window.navigationHandlers) {
				// Check nav setting and navigate accordingly
				const navStr = String(nav || '').toLowerCase();
				if (navStr.indexOf('new') > -1 && playlist.id) {
					// Navigate to the newly created playlist
					log(`SimilarArtists: Navigating to playlist ID: ${playlist.id}`);
					if (window.navigationHandlers.playlist && window.navigationHandlers.playlist.navigate) {
						window.navigationHandlers.playlist.navigate(playlist.id);
					} else {
						log('SimilarArtists: navigationHandlers.playlist not available');
					}
				} else if (navStr.indexOf('now') > -1) {
					// Navigate to Now Playing
					log('SimilarArtists: Navigating to Now Playing');
					if (window.navigationHandlers.nowPlaying && window.navigationHandlers.nowPlaying.navigate) {
						window.navigationHandlers.nowPlaying.navigate();
					} else {
						log('SimilarArtists: navigationHandlers.nowPlaying not available');
					}
				}
			} else {
				log('SimilarArtists: navigationHandlers not available in window context');
			}
		} catch (e) {
			log('SimilarArtists: Navigation error: ' + e.toString());
		}
	}

	/**
	 * Find an existing playlist by title (case-insensitive).
	 * Tries multiple methods to support different MediaMonkey API versions.
	 * @param {string} name Playlist title to search for.
	 * @returns {object|null} Playlist object if found, null otherwise.
	 */
	function findPlaylist(name) {
		if (!name || typeof app === 'undefined' || !app.playlists) {
			return null;
		}

		try {
			// Method 1: Try findByTitle (newer API)
			if (app.playlists?.findByTitle && typeof app.playlists.findByTitle === 'function') {
				const playlist = app.playlists.findByTitle(name);
				if (playlist) {
					log(`findPlaylist: Found playlist by title (findByTitle): "${name}"`);
					return playlist;
				}
			}
		} catch (e) {
			log(`findPlaylist: findByTitle error: ${e.toString()}`);
		}

		try {
			// Method 2: Try getByTitle (alternative API)
			if (app.playlists?.getByTitle && typeof app.playlists.getByTitle === 'function') {
				const playlist = app.playlists.getByTitle(name);
				if (playlist) {
					log(`findPlaylist: Found playlist by title (getByTitle): "${name}"`);
					return playlist;
				}
			}
		} catch (e) {
			log(`findPlaylist: getByTitle error: ${e.toString()}`);
		}

		try {
			// Method 3: Manual iteration with case-insensitive match (fallback)
			if (app.playlists?.getAll && typeof app.playlists.getAll === 'function') {
				const playlists = app.playlists.getAll();
				if (playlists && typeof playlists.forEach === 'function') {
					const nameLower = String(name || '').toLowerCase();
					let found = null;

					playlists.forEach((p) => {
						if (p && (p.title || p.name)) {
							const pName = String(p.title || p.name).toLowerCase();
							if (pName === nameLower) {
								found = p;
							}
						}
					});

					if (found) {
						log(`findPlaylist: Found playlist by manual search (case-insensitive): "${name}"`);
						return found;
					}
				}
			}
		} catch (e) {
			log(`findPlaylist: Manual iteration error: ${e.toString()}`);
		}

		log(`findPlaylist: Playlist not found: "${name}"`);
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
		log('Starting SimilarArtists addon...');

		// Check for MM5 environment
		if (typeof app === 'undefined') {
			log('MediaMonkey 5 app API not found.');
			return;
		}

		if (getSetting('OnPlay', false))
			attachAuto();

		log('SimilarArtists addon started successfully.');
	}

	// Export functions to the global scope
	globalArg.SimilarArtists = {
		start,
		runSimilarArtists,
		toggleAuto,
	};

})(typeof window !== 'undefined' ? window : global);