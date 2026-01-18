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

		log(`collectSeedTracks: selectedList count = ${selectedCount}`);

		if (selectedList && selectedCount > 0) {
			// Process all selected tracks using forEach (not toArray)
			log(`collectSeedTracks: Found ${selectedCount} selected track(s), iterating...`);

			if (typeof selectedList.forEach === 'function') {
				// Use forEach for iteration (MM5 standard pattern)
				let processedCount = 0;
				selectedList.forEach((t) => {
					processedCount++;
					//log(`collectSeedTracks: forEach iteration ${processedCount}, track artist = ${t?.artist || 'N/A'}`);
					if (t && t.artist) {
						seeds.push({ name: normalizeName(t.artist), track: t });
					}
				});
				//log(`collectSeedTracks: forEach completed, processed ${processedCount} tracks, collected ${seeds.length} seeds`);
			} else {
				// Fallback: try using index-based access if forEach not available
				//log('collectSeedTracks: forEach not available, trying index-based access');
				for (let idx = 0; idx < selectedCount; idx++) {
					let t = null;
					if (typeof selectedList.getFastObject === 'function') {
						t = selectedList.getFastObject(idx);
					} else if (typeof selectedList.get === 'function') {
						t = selectedList.get(idx);
					}

					if (t) {
						//log(`collectSeedTracks: index ${idx} got track with artist = ${t?.artist || 'N/A'}`);
						if (t.artist) {
							seeds.push({ name: normalizeName(t.artist), track: t });
						}
					}
				}
				//log(`collectSeedTracks: index-based access completed, collected ${seeds.length} seeds`);
			}

			if (seeds.length > 0) {
				//log(`collectSeedTracks: Returning ${seeds.length} seed(s): ${seeds.map(s => s.name).join(', ')}`);
				return seeds;
			}
		}

		// Fallback: use current playing track if no selection
		log('collectSeedTracks: No selection found, falling back to currently playing track');
		const currentTrack = app.player?.getCurrentTrack?.();
		if (currentTrack && currentTrack.artist) {
			log(`collectSeedTracks: Current playing track artist = ${currentTrack.artist}`);
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

			// Create progress task using MM5's backgroundTasks system
			let progressTask = null;
			if (app.backgroundTasks?.createNew) {
				progressTask = app.backgroundTasks.createNew();
				progressTask.leadingText = 'SimilarArtists: Processing playlist...';
				globalProgressTask = progressTask;
				log('SimilarArtists: Progress task created');
			}

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

				// Update progress: Fetching similar artists
				const seedProgress = (i + 1) / seedSlice.length;
				updateProgress(`Fetching similar artists for "${seed.name}" (${i + 1}/${seedSlice.length})`, seedProgress * 0.3);

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

				updateProgress(`Found ${similar.length} similar artist(s) for "${seed.name}", querying tracks...`, seedProgress * 0.3);

				for (const artName of artistPool) {
					// Populate rank map: fetch top tracks for this artist and score them
					if (rankEnabled) {
						updateProgress(`Ranking: Fetching top 100 tracks for "${artName}"...`, seedProgress * 0.3);
						const titles = await fetchTopTracksForRank(fixPrefixes(artName));
						updateProgress(`Ranking: Scoring ${titles.length} tracks from "${artName}"...`, seedProgress * 0.3);
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
					updateProgress(`Fetching top ${tracksPerArtist} tracks for "${artName}" from Last.fm...`, seedProgress * 0.3);
					const titles = await fetchTopTracks(fixPrefixes(artName), tracksPerArtist);
					updateProgress(`Searching library for ${titles.length} tracks from "${artName}"...`, seedProgress * 0.3);
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
				updateProgress(`Adding ${allTracks.length} tracks to Now Playing...`, 0.8);
				await enqueueTracks(allTracks, ignoreDupes, clearNP);
				log(`SimilarArtists: Enqueued ${allTracks.length} track(s) to Now Playing`);
				updateProgress(`Successfully added ${allTracks.length} tracks to Now Playing!`, 1.0);
			} else {
				const seedName = seeds[0]?.name || 'Similar Artists';
				const selectedPlaylist = !confirm ? null : (await confirmPlaylist(seedName, overwriteMode));
				
				// Only proceed with playlist creation if we have a valid playlist or user confirmed
				if (selectedPlaylist) {
					// User selected/created a playlist in the dialog
					updateProgress(`Creating playlist "${selectedPlaylist.name || seedName}" with ${allTracks.length} tracks...`, 0.85);
					await createPlaylist(allTracks, seedName, overwriteMode, selectedPlaylist);
					updateProgress(`Playlist created successfully with ${allTracks.length} tracks!`, 1.0);
				} else if (!confirm) {
					// confirm is disabled, so skip playlist dialog and create automatically
					updateProgress(`Creating new playlist "${seedName}" with ${allTracks.length} tracks...`, 0.85);
					await createPlaylist(allTracks, seedName, overwriteMode, null);
					updateProgress(`Playlist created successfully with ${allTracks.length} tracks!`, 1.0);
				} else {
					// confirm is enabled and user cancelled the dialog
					log('SimilarArtists: User cancelled playlist creation.');
					updateProgress(`Playlist creation cancelled by user.`, 1.0);
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
			updateProgress(`Error: ${e.toString()}`, 1.0);
			showToast('SimilarArtists: An error occurred - see log for details.');
		} finally {
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
	 * If user clicks OK without selecting a playlist, return null (createPlaylist will create one).
	 * If user clicks Cancel, returns null to cancel the operation.
	 * @param {string} seedName Seed artist name used in playlist naming.
	 * @param {*} overwriteMode Mode label (Create/Overwrite/Do not create).
	 * @returns {Promise<object|null>} Selected/created playlist object, or null if not selected.
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
							// User selected or created a playlist in the dialog
							log(`confirmPlaylist: User selected/created playlist: ${selectedPlaylist.name || selectedPlaylist.title}`);
							resolve(selectedPlaylist);
						} else {
							// User clicked OK without selecting a playlist
							// Return null so createPlaylist() can create one with proper naming
							log('confirmPlaylist: User did not select a playlist, returning null for createPlaylist to handle');
							resolve(null);
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
			updateProgress(`Querying Last.fm API: getSimilar for "${artistName}"...`);
			log('fetchSimilarArtists: querying ' + url);
			
			const res = await fetch(url);

			if (!res || !res.ok) {
				log(`fetchSimilarArtists: HTTP ${res?.status} ${res?.statusText} for ${artistName}`);
				updateProgress(`Failed to fetch similar artists for "${artistName}" (HTTP ${res?.status})`);
				return [];
			}
			let data;
			try {
				data = await res.json();
			} catch (e) {
				console.warn('fetchSimilarArtists: invalid JSON response: ' + e.toString());
				updateProgress(`Error parsing Last.fm response for "${artistName}"`);
				return [];
			}
			if (data?.error) {
				console.warn('fetchSimilarArtists: API error: ' + (data.message || data.error));
				updateProgress(`Last.fm API error for "${artistName}": ${data.message || data.error}`);
				return [];
			}
			const artists = data?.similarartists?.artist || [];
			if (!Array.isArray(artists) && artists)
				return [artists];
			log(`fetchSimilarArtists: Retrieved ${artists.length} similar artists for "${artistName}"`);
			return artists;
		} catch (e) {
			log(e.toString());
			updateProgress(`Error fetching similar artists: ${e.toString()}`);
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
			updateProgress(`Querying Last.fm API: getTopTracks for "${artistName}" (limit: ${lim || 'default'})...`);
			log('fetchTopTracks: querying ' + url);

			const res = await fetch(url);
			if (!res || !res.ok) {
				log(`fetchTopTracks: HTTP ${res?.status} ${res?.statusText} for ${artistName}`);
				updateProgress(`Failed to fetch top tracks for "${artistName}" (HTTP ${res?.status})`);
				return [];
			}
			let data;
			try {
				data = await res.json();
			} catch (e) {
				console.warn('fetchTopTracks: invalid JSON response: ' + e.toString());
				updateProgress(`Error parsing Last.fm response for "${artistName}"`);
				return [];
			}
			if (data?.error) {
				console.warn('fetchTopTracks: API error: ' + (data.message || data.error));
				updateProgress(`Last.fm API error for "${artistName}": ${data.message || data.error}`);
				return [];
			}
			let tracks = data?.toptracks?.track || [];
			if (tracks && !Array.isArray(tracks)) tracks = [tracks];
			const titles = [];
			tracks.forEach((t) => {
				if (t && (t.name || t.title))
					titles.push(t.name || t.title);
			});
			log(`fetchTopTracks: Retrieved ${titles.length} top tracks for "${artistName}"`);
			return typeof lim === 'number' ? titles.slice(0, lim) : titles;
		} catch (e) {
			log(e.toString());
			updateProgress(`Error fetching top tracks: ${e.toString()}`);
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

			// Execute query with progress reporting
			updateProgress(`Querying library for "${title}" by "${artistName}"...`);
			const tl = app?.db?.getTracklist(sql, -1);
			
			// CRITICAL: Disable auto-update and notifications to prevent UI flooding during iteration
			let updateWasDisabled = false;
			let notifyWasDisabled = false;
			if (tl) {
				updateWasDisabled = tl.autoUpdateDisabled;
				notifyWasDisabled = tl.dontNotify;
				tl.autoUpdateDisabled = true;
				tl.dontNotify = true;
			}
			
			await tl?.whenLoaded();

			// Collect tracks into array (non-destructive iteration)
			const arr = [];
			if (tl) {
				tl.forEach((t) => {
					if (t) arr.push(t);
				});
			}

			// IMPORTANT: Restore original state to allow UI updates for subsequent operations
			if (tl) {
				tl.autoUpdateDisabled = updateWasDisabled;
				tl.dontNotify = notifyWasDisabled;
			}

			if (arr.length > 0) {
				log(`findLibraryTracks: Found ${arr.length} match(es) for "${title}" by "${artistName}"`);
			}

			return typeof limit === 'number' ? arr.slice(0, limit) : arr;

		} catch (e) {
			log('findLibraryTracks error: ' + e.toString());
			updateProgress(`Database lookup error: ${e.toString()}`);
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
		if (!player) {
			log('SimilarArtists: Player not available');
			return;
		}

		const playlist = player.playlist || player.nowPlayingQueue || player.getPlaylist?.();
		if (!playlist) {
			log('SimilarArtists: Playlist not available');
			return;
		}

		if (clearFirst && playlist.clear && typeof playlist.clear === 'function') {
			playlist.clear();
		}

		// Build set of existing track IDs to filter duplicates
		const existing = new Set();
		if (ignoreDupes && playlist.toArray && typeof playlist.toArray === 'function') {
			const existingTracks = playlist.toArray();
			if (existingTracks && typeof existingTracks.forEach === 'function') {
				existingTracks.forEach((t) => {
					if (t) existing.add(t.id || t.ID);
				});
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
			log('SimilarArtists: No tracks to add after deduplication');
			return;
		}

		try {
			// Primary: Try async batch add with tracklist (modern MM5 pattern)
			if (playlist.addTracksAsync && typeof playlist.addTracksAsync === 'function' && app.utils?.createTracklist) {
				try {
					let tracklist = app.utils.createTracklist(false);
					
					if (!tracklist) {
						log('SimilarArtists: Failed to create tracklist');
						throw new Error('createTracklist returned null');
					}
					
					// Disable notifications before adding
					if (tracklist.dontNotify !== undefined) {
						tracklist.dontNotify = true;
					}
					if (tracklist.autoUpdateDisabled !== undefined) {
						tracklist.autoUpdateDisabled = true;
					}

					// Add all tracks to the temporary tracklist
					for (const t of tracksToAdd) {
						if (t && typeof tracklist.add === 'function') {
							tracklist.add(t);
						}
					}

					// Critical: Call notifyLoaded BEFORE addTracksAsync
					if (typeof tracklist.notifyLoaded === 'function') {
						tracklist.notifyLoaded();
					}

					// Now we can safely call addTracksAsync
					if (tracklist.count > 0) {
						await playlist.addTracksAsync(tracklist);
						log(`SimilarArtists: Enqueued ${tracklist.count} tracks to Now Playing (async batch)`);
						return;
					}
				} catch (e) {
					log(`SimilarArtists: Error in addTracksAsync: ${e.toString()}, attempting fallback`);
				}
			}

			// Secondary: Use synchronous batch method if available
			if (playlist.addTracks && typeof playlist.addTracks === 'function') {
				playlist.addTracks(tracksToAdd);
				log(`SimilarArtists: Enqueued ${tracksToAdd.length} tracks to Now Playing (sync batch)`);
				return;
			}

			// Tertiary: Add tracks individually (slowest, most compatible)
			if (playlist.addTrack && typeof playlist.addTrack === 'function') {
				let addedCount = 0;
				for (const t of tracksToAdd) {
					if (t) {
						playlist.addTrack(t);
						addedCount++;
					}
				}
				log(`SimilarArtists: Enqueued ${addedCount} tracks to Now Playing (individual adds)`);
				return;
			}

			log('SimilarArtists: No suitable method found to enqueue tracks');
		} catch (e) {
			log(`SimilarArtists: Fatal error in enqueueTracks: ${e.toString()}`);
		}
	}

	// Creates (or finds) a playlist then adds tracks. Matches APIs used in this repo.
	/**
	 * Create or locate a playlist, optionally overwrite its content, then add tracks.
	 * Uses modern MM5 API patterns for playlist creation.
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

		// Create new playlist if not found (using modern MM5 pattern)
		if (!playlist) {
			try {
				const parentName = stringSetting('Parent');
				let parentPlaylist = null;
				
				// Find parent playlist if specified
				if (parentName) {
					parentPlaylist = findPlaylist(parentName);
				}
				
				// Use modern MM5 pattern: newPlaylist() on parent or root
				if (parentPlaylist && parentPlaylist.newPlaylist) {
					playlist = parentPlaylist.newPlaylist();
				} else {
					playlist = app.playlists.root.newPlaylist();
				}
				
				if (!playlist) {
					log('SimilarArtists: Failed to create new playlist object');
					return null;
				}
				
				// Set temporary name to ensure it appears first in the list (#16261 pattern)
				playlist.name = name;// ' - ' + name + ' - ';
				
				// Persist the playlist
				await playlist.commitAsync();
				
				// Mark as new for potential UI handling
				playlist.isNew = true;
				
				log(`SimilarArtists: Created playlist: ${name}`);
				
			} catch (e) {
				log(`SimilarArtists: Error creating playlist: ${e.toString()}`);
				return null;
			}
		}

		if (!playlist) {
			log('SimilarArtists: Failed to create or find playlist');
			return null;
		}

		log(`SimilarArtists: Using playlist '${playlist.name}' (ID: ${playlist.id || playlist.ID})`);

		// If overwrite is selected, clear existing playlist content
		if (overwriteText.toLowerCase().indexOf('overwrite') > -1) {
			try {
				if (playlist.clearTracksAsync && typeof playlist.clearTracksAsync === 'function') {
					await playlist.clearTracksAsync();
					log('SimilarArtists: Cleared existing playlist tracks');
				} else if (playlist.clear && typeof playlist.clear === 'function') {
					playlist.clear();
					log('SimilarArtists: Cleared existing playlist tracks (sync)');
				}
			} catch (e) {
				log(`SimilarArtists: Error clearing playlist: ${e.toString()}`);
			}
		}

		// Add tracks to playlist using best available method
		if (!tracks || tracks.length === 0) {
			log('SimilarArtists: No tracks to add to playlist');
		} else {
			try {
				// Primary: Try async batch add with tracklist (modern MM5 pattern)
				if (playlist.addTracksAsync && typeof playlist.addTracksAsync === 'function' && app.utils?.createTracklist) {
					try {
						const tracklist = app.utils.createTracklist(false);
						
						if (!tracklist) {
							log('SimilarArtists: Failed to create tracklist in createPlaylist');
							throw new Error('createTracklist returned null');
						}

						// Disable notifications before adding
						if (tracklist.dontNotify !== undefined) {
							tracklist.dontNotify = true;
						}
						if (tracklist.autoUpdateDisabled !== undefined) {
							tracklist.autoUpdateDisabled = true;
						}

						// Add all tracks to the temporary tracklist
						for (const t of (tracks || [])) {
							if (t && typeof tracklist.add === 'function') {
								tracklist.add(t);
							}
						}

						// Critical: Call notifyLoaded BEFORE addTracksAsync to signal tracklist is ready
						if (typeof tracklist.notifyLoaded === 'function') {
							tracklist.notifyLoaded();
						}

						// Now we can safely call addTracksAsync
						if (tracklist.count > 0) {
							await playlist.addTracksAsync(tracklist);
							log(`SimilarArtists: Added ${tracklist.count} tracks to playlist (async batch)`);
						}
					} catch (e) {
						log(`SimilarArtists: Error in addTracksAsync: ${e.toString()}, attempting fallback`);
						// Fallback: try addTracks synchronously
						if (playlist.addTracks && typeof playlist.addTracks === 'function') {
							playlist.addTracks(tracks);
							log(`SimilarArtists: Added ${tracks.length} tracks to playlist via addTracks (fallback)`);
						}
					}
				} else if (playlist.addTracks && typeof playlist.addTracks === 'function') {
					// Secondary: Try synchronous batch add
					playlist.addTracks(tracks);
					log(`SimilarArtists: Added ${tracks.length} tracks to playlist (sync batch)`);
				} else if (playlist.addTrack && typeof playlist.addTrack === 'function') {
					// Tertiary: Add tracks individually (slowest, most compatible)
					log(`SimilarArtists: Adding ${tracks.length} tracks individually via addTrack`);
					let addedCount = 0;
					for (const t of (tracks || [])) {
						if (t) {
							playlist.addTrack(t);
							addedCount++;
						}
					}
					log(`SimilarArtists: Added ${addedCount} tracks to playlist (individual)`);
				} else {
					log('SimilarArtists: No suitable method found to add tracks to playlist');
				}
			} catch (e) {
				log(`SimilarArtists: Fatal error adding tracks to playlist: ${e.toString()}`);
			}
		}

		// Handle navigation based on user settings
		try {
			const nav = getSetting('Navigate');
			if (typeof window !== 'undefined' && window.navigationHandlers) {
				const navStr = String(nav || '').toLowerCase();
				if (navStr.indexOf('new') > -1 && (playlist.id || playlist.ID)) {
					// Navigate to the newly created playlist
					log(`SimilarArtists: Navigating to playlist ID: ${playlist.id || playlist.ID}`);
					if (window.navigationHandlers.playlist?.navigate) {
						window.navigationHandlers.playlist.navigate(playlist);
					}
				} else if (navStr.indexOf('now') > -1) {
					// Navigate to Now Playing
					log('SimilarArtists: Navigating to Now Playing');
					if (window.navigationHandlers.nowPlaying?.navigate) {
						window.navigationHandlers.nowPlaying.navigate();
					}
				}
			}
		} catch (e) {
			log(`SimilarArtists: Navigation error: ${e.toString()}`);
		}

		return playlist;
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