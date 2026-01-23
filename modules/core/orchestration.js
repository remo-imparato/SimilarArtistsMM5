/**
 * SimilarArtists Core Orchestration Logic
 * 
 * Main orchestration layer that ties together:
 * - Input collection (seed tracks)
 * - API processing (similar artists from Last.fm)
 * - Track matching (multi-pass fuzzy matching against library)
 * - Output generation (playlist creation or queue management)
 * - Auto-mode handling (auto-queue near end of playlist)
 * 
 * Provides the high-level orchestration functions:
 * - generateSimilarPlaylist() - Main entry point
 * - runSimilarArtists() - Full workflow orchestration
 * - buildResultsPlaylist() - Playlist creation workflow
 * - queueResults() - Queue management workflow
 * 
 * @author Remo Imparato
 * @license MIT
 */

'use strict';

window.similarArtistsOrchestration = {
	/**
	 * Main orchestration function that runs the complete SimilarArtists workflow.
	 * 
	 * Workflow:
	 * 1. Collect seed tracks from selection or currently playing
	 * 2. Process seeds through Last.fm to find similar artists
	 * 3. Query library for tracks matching similar artists
	 * 4. Apply post-processing (ranking, filtering, deduplication)
	 * 5. Create playlist or enqueue results based on settings
	 * 6. Show confirmation dialog if enabled
	 * 7. Navigate to results if enabled
	 * 
	 * @param {object} modules - Injected module dependencies
	 * @param {boolean} [autoMode=false] - Whether running in auto-mode (forces enqueue, uses conservative limits)
	 * @returns {Promise<object>} Result object with status, tracklist, playlist info
	 */
	async generateSimilarPlaylist(modules, autoMode = false) {
		const {
			config,
			utils: { normalization, helpers },
			settings: { storage, prefixes },
			ui: { notifications },
			api: { lastfmApi },
			db,  // Changed: db is already the full interface, no need to destructure library
		} = modules;

		const {
			getSetting,
			intSetting,
			boolSetting,
		} = storage;

		const {
			showToast,
			updateProgress,
			createProgressTask,
			terminateProgressTask,
		} = notifications;

		const {
			formatError,
			shuffle: shuffleUtil,
		} = helpers;

		const {
			fixPrefixes,
		} = prefixes;

		// Declare taskId outside try block so it's accessible in catch
		let taskId = null;

		try {
			// Initialize progress tracking
			taskId = createProgressTask('Generating Similar Artists Playlist');
			updateProgress('Initializing...', 0);

			// Validate environment
			if (typeof app === 'undefined' || !app.player) {
				throw new Error('MediaMonkey application not available');
			}

			// Load configuration
			const config_ = {
				seedLimit: autoMode ? 2 : intSetting('SeedLimit'),
				similarLimit: intSetting('SimilarLimit'),
				tracksPerArtist: autoMode ? 2 : intSetting('TPA'),
				totalLimit: autoMode ? 10 : intSetting('TPL'),
				includeSeedArtist: !autoMode && boolSetting('Seed'),
				rankEnabled: boolSetting('Rank'),
				bestEnabled: boolSetting('Best'),
				randomize: boolSetting('Random'),
				showConfirm: !autoMode && boolSetting('Confirm'),
				autoMode,
			};

			console.log('Similar Artists: generateSimilarPlaylist: Starting with config:', config_);

			// Step 1: Collect seed tracks
			updateProgress('Collecting seed tracks...', 0.1);
			const seeds = await this.collectSeedTracks(modules);

			if (!seeds || seeds.length === 0) {
				throw new Error('No seed tracks found. Please select one or more tracks or start playing a track.');
			}

			//console.log(`generateSimilarPlaylist: Collected ${seeds.length} seed artist(s)`);
			updateProgress(`Found ${seeds.length} seed artist(s)`, 0.15);

			// Step 2: Process seeds to find similar artists and their tracks
			updateProgress('Processing seed artists...', 0.2);
			const trackRankMap = config_.rankEnabled ? new Map() : null;

			console.log(`generateSimilarPlaylist: About to process seeds with config:`, {
				seedLimit: config_.seedLimit,
				similarLimit: config_.similarLimit,
				tracksPerArtist: config_.tracksPerArtist,
				totalLimit: config_.totalLimit,
			});

			const results = await this.processSeedArtists(
				modules,
				seeds,
				config_,
				trackRankMap
			);

			console.log(`generateSimilarPlaylist: processSeedArtists returned ${results?.length || 0} tracks`);

			if (!results || results.length === 0) {
				// Not an error - just means no matches found, which is a normal scenario
				terminateProgressTask(taskId);
				showToast('No matching tracks found in your library. Try adjusting your filters or adding more music.', 'info');
				return {
					success: false,
					error: 'No matching tracks found in your library. Try adjusting your filters or adding more music.',
					tracksAdded: 0,
				};
			}

			console.log(`generateSimilarPlaylist: Found ${results.length} matching tracks`);
			updateProgress(`Found ${results.length} matching tracks`, 0.8);

			// Step 3: Apply ranking if enabled
			if (config_.rankEnabled && trackRankMap && trackRankMap.size > 0) {
				updateProgress('Applying ranking...', 0.85);
				results.sort((a, b) => {
					const rankA = trackRankMap.get(a.id || a.ID) || 0;
					const rankB = trackRankMap.get(b.id || b.ID) || 0;
					return rankB - rankA; // Higher rank first
				});
				console.log(`generateSimilarPlaylist: Applied ranking (${trackRankMap.size} ranked tracks)`);
			}

			// Step 4: Apply randomization if enabled
			if (config_.randomize) {
				updateProgress('Randomizing results...', 0.87);
				shuffleUtil(results);
				console.log('generateSimilarPlaylist: Randomized track list');
			}

			// Step 5: Choose output method
			updateProgress('Preparing output...', 0.9);

			let outputPromise;
			if (config_.autoMode || boolSetting('Enqueue', config.DEFAULTS.Enqueue)) {
				// Auto-mode or enqueue mode: add to Now Playing
				console.log('generateSimilarPlaylist: Enqueueing to Now Playing');
				outputPromise = this.queueResults(modules, results, config_);
			} else {
				// Create/update playlist
				console.log('generateSimilarPlaylist: Creating/updating playlist');
				outputPromise = this.buildResultsPlaylist(modules, results, config_);
			}

			const output = await outputPromise;

			updateProgress('Complete!', 1.0);
			terminateProgressTask(taskId);

			showToast(`Added ${results.length} tracks from similar artists`);

			return {
				success: true,
				tracksAdded: results.length,
				tracks: results,
				output,
			};

		} catch (e) {
			console.error('generateSimilarPlaylist error: ' + formatError(e));
			if (taskId) {
				terminateProgressTask(taskId);
			}
			showToast(`Error: ${formatError(e)}`, 'error');
			return {
				success: false,
				error: e.message,
			};
		}
	},

	/**
	 * Collect seed tracks from UI selection or currently playing.
	 * 
	 * Priority:
	 * 1. Selected tracks in active pane
	 * 2. Currently playing track
	 * 
	 * Returns array of {name, track} objects where name is normalized artist name.
	 * Duplicates are removed based on normalized artist names.
	 * 
	 * @param {object} modules - Module dependencies
	 * @returns {Promise<Array>} Seed artist objects (deduplicated)
	 */
	async collectSeedTracks(modules) {
		const { utils: { normalization }, settings: { storage } } = modules;
		const { splitArtists } = normalization;
		const { getSetting } = storage;

		const seeds = [];
		const seenArtists = new Set(); // Track seen artists for deduplication

		// Helper to add artist if not already seen
		const addArtistIfNew = (artistName, track) => {
			const normalizedName = artistName.trim().toUpperCase();
			if (normalizedName && !seenArtists.has(normalizedName)) {
				seenArtists.add(normalizedName);
				seeds.push({ name: artistName, track: track });
			}
		};

		// Try to get selected tracklist from any pane
		let selectedList = null;
		try {
			if (uitools?.getSelectedTracklist) {
				selectedList = uitools.getSelectedTracklist();
			} else if (window?.currentList?.dataSource?.getSelectedTracklist) {
				selectedList = window.currentList.dataSource.getSelectedTracklist();
			}
		} catch (e) {
			console.log('collectSeedTracks: Could not get selected tracklist: ' + e.toString());
		}

		// Iterate selected tracks
		if (selectedList) {
			try {
				await selectedList.whenLoaded();

				if (typeof selectedList.forEach === 'function') {
					selectedList.forEach((t) => {
						if (t?.artist) {
							for (const a of splitArtists(t.artist)) {
								addArtistIfNew(a, t);
							}
						}
					});
				} else if (typeof selectedList.getFastObject === 'function' && typeof selectedList.count === 'number') {
					let tmp;
					for (let i = 0; i < selectedList.count; i++) {
						tmp = selectedList.getFastObject(i, tmp);
						if (tmp?.artist) {
							for (const a of splitArtists(tmp.artist)) {
								addArtistIfNew(a, tmp);
							}
						}
					}
				}

				if (seeds.length > 0) {
					const artistNames = seeds.map(s => s.name).join(', ');
					console.log(`collectSeedTracks: Using ${seeds.length} unique selected artist(s): ${artistNames}`);
					return seeds;
				}
			} catch (e) {
				console.error('collectSeedTracks: Error iterating selection: ' + e.toString());
			}
		}

		// Fallback: use currently playing track
		try {
			const currentTrack = app.player?.getCurrentTrack?.();
			if (currentTrack?.artist) {
				for (const a of splitArtists(currentTrack.artist)) {
					addArtistIfNew(a, currentTrack);
				}
				console.log(`collectSeedTracks: Using currently playing track`);
				return seeds;
			}
		} catch (e) {
			console.error('collectSeedTracks: Error getting current track: ' + e.toString());
		}

		console.log('collectSeedTracks: No seed tracks found');
		return seeds;
	},

	/**
	 * Process seed artists to fetch similar artists from Last.fm and find matching tracks.
	 * 
	 * Algorithm:
	 * 1. For each seed artist (up to seedLimit)
	 * 2. Fetch similar artists from Last.fm (up to similarLimit)
	 * 3. Optionally include seed artist itself
	 * 4. For each artist in the pool, fetch top tracks from Last.fm
	 * 5. Batch-match tracks against library using fuzzy matching
	 * 6. Apply ranking and deduplication
	 * 7. Return deduplicated track list
	 * 
	 * @param {object} modules - Module dependencies
	 * @param {Array} seeds - Seed artist objects
	 * @param {object} config - Configuration settings
	 * @param {Map} [rankMap] - Optional rank scoring map (for ranking mode)
	 * @returns {Promise<Array>} Matched track objects
	 */
	async processSeedArtists(modules, seeds, config, rankMap = null) {
		const {
			utils: { helpers },
			settings: { storage, prefixes },
			ui: { notifications },
			api: { lastfmApi },
			db,  // Changed: db is already the full interface
		} = modules;

		const { parseListSetting: parseListSettingUtil } = helpers;
		const { getSetting, intSetting } = storage;
		const { fixPrefixes } = prefixes;
		const { updateProgress } = notifications;
		const {
			fetchSimilarArtists,
			fetchTopTracks,
		} = lastfmApi;
		const {
			findLibraryTracksBatch,
		} = db;  // Changed: get function directly from db

		// Validate required functions
		console.log('processSeedArtists: Validating required functions...');
		console.log('processSeedArtists: fetchSimilarArtists available:', typeof fetchSimilarArtists === 'function');
		console.log('processSeedArtists: fetchTopTracks available:', typeof fetchTopTracks === 'function');
		console.log('processSeedArtists: findLibraryTracksBatch available:', typeof findLibraryTracksBatch === 'function');

		if (typeof findLibraryTracksBatch !== 'function') {
			console.error('processSeedArtists: findLibraryTracksBatch is not a function!');
			console.error('processSeedArtists: db object:', db);
			throw new Error('Database function findLibraryTracksBatch is not available');
		}

		const allTracks = [];
		const seenKeys = new Set();

		// Build blacklist from settings
		// parseListSetting already returns an array, no need to split
		const blacklist = new Set(
			parseListSettingUtil(getSetting('Black', ''))
				.map(s => String(s || '').trim().toUpperCase())
				.filter(s => s.length > 0)
		);

		// Helper to generate track deduplication keys
		function getTrackKey(track) {
			if (!track) return '';
			const id = track.id || track.ID;
			if (id && String(id) !== '0') return String(id);
			if (track.path) return `path:${track.path}`;
			return `meta:${track.title}:${track.album}:${track.artist}`;
		}

		// Process each seed (up to seedLimit)
		const seedSlice = seeds.slice(0, config.seedLimit || seeds.length);

		for (let i = 0; i < seedSlice.length; i++) {
			// Early exit if we reached total limit
			if (allTracks.length >= config.totalLimit) break;

			const seed = seedSlice[i];
			const progress = 0.2 + ((i + 1) / seedSlice.length) * 0.6;
			updateProgress(`Processing seed ${i + 1}/${seedSlice.length}: "${seed.name}"`, progress * 0.5);

			try {
				// Fetch similar artists
				const similar = await fetchSimilarArtists(
					fixPrefixes(seed.name),
					config.similarLimit
				);

				if (!similar || similar.length === 0) {
					console.log(`processSeedArtists: No similar artists found for "${seed.name}"`);
					continue;
				}

				// Build artist pool with deduplication and blacklist filtering
				const seen = new Set();
				const artistPool = [];

				const pushIfNew = (name) => {
					if (!name) return;
					const key = String(name).trim().toUpperCase();
					if (!key || seen.has(key)) return;
					if (blacklist.has(key)) return;
					seen.add(key);
					artistPool.push(name);
				};

				// Optionally add seed artist
				if (config.includeSeedArtist) {
					pushIfNew(seed.name);
				}

				// Add similar artists (up to similarLimit)
				for (let j = 0; j < Math.min(config.similarLimit, similar.length); j++) {
					if (similar[j]?.name) {
						pushIfNew(similar[j].name);
					}
				}
				console.log(`processSeedArtists: Processing ${artistPool.length} artists for seed "${seed.name}"`);

				// Process each artist in pool
				for (const artName of artistPool) {
					if (allTracks.length >= config.totalLimit) break;

					try {
						updateProgress(`Fetching tracks for "${artName}"...`, progress * 0.75);

						console.log(`processSeedArtists: Fetching top tracks for "${artName}" (limit: ${config.tracksPerArtist})`);

						// Fetch top tracks from Last.fm
						let titles = await fetchTopTracks(
							fixPrefixes(artName),
							config.tracksPerArtist,
							config.rankEnabled
						);

						if (!titles || titles.length === 0) {
							console.log(`processSeedArtists: No top tracks found for "${artName}"`);
							continue;
						}

						// Extract title strings (titles may be objects if rankEnabled)
						const titleStrings = titles.map(t => {
							if (typeof t === 'string') return t;
							if (t && typeof t === 'object') return t.title || t.name || String(t);
							return String(t || '');
						}).filter(s => s.length > 0);

						console.log(`processSeedArtists: Found ${titleStrings.length} top tracks for "${artName}":`, titleStrings.slice(0, 3));

						updateProgress(`Matching ${titleStrings.length} tracks from "${artName}"...`, progress * 0.9);

						// Get minimum rating from settings
						const minRating = intSetting('Rating', 0);
						const allowUnknown = boolSetting('Unknown', false);

						// Batch-match against library
						console.log(`processSeedArtists: Calling findLibraryTracksBatch for "${artName}" with ${titleStrings.length} titles`);
						const matches = await findLibraryTracksBatch(
							artName,
							titleStrings,
							1,
							{ rank: false, best: config.bestEnabled, minRating: minRating, allowUnknown: allowUnknown }
						);

						console.log(`processSeedArtists: findLibraryTracksBatch returned ${matches?.size || 0} results for "${artName}"`);

						// Add matched tracks with deduplication
						let addedCount = 0;
						for (const title of titleStrings) {
							if (allTracks.length >= config.totalLimit) break;

							const trackMatches = matches.get(title) || [];
							console.log(`processSeedArtists: Title "${title}" has ${trackMatches.length} matches`); for (const track of trackMatches) {
								const key = getTrackKey(track);
								if (!key || seenKeys.has(key)) continue;

								seenKeys.add(key);
								allTracks.push(track);
								addedCount++;

								if (allTracks.length >= config.totalLimit) break;
							}
						}

						console.log(`processSeedArtists: Added ${addedCount} tracks from "${artName}" (total: ${allTracks.length})`);

					} catch (e) {
						console.error(`processSeedArtists: Error processing "${artName}": ${e.toString()}`);
						console.error(`processSeedArtists: Error stack:`, e.stack);
					}
				}

			} catch (e) {
				console.error(`processSeedArtists: Error for seed "${seed.name}": ${e.toString()}`);
			}
		}

		console.log(`processSeedArtists: Processed ${seedSlice.length} seeds, found ${allTracks.length} unique tracks`);
		return allTracks.slice(0, config.totalLimit);
	},

	/**
	 * Build and create/update a playlist with the result tracks.
	 * 
	 * Workflow:
	 * 1. Show playlist selection dialog if confirmatio n enabled
	 * 2. Create new playlist or get existing one
	 * 3. Add tracks to playlist
	 * 4. Navigate to playlist if enabled
	 * 
	 * @param {object} modules - Module dependencies
	 * @param {Array} tracks - Result tracks to add
	 * @param {object} config - Configuration settings
	 * @returns {Promise<object>} Playlist info {id, name, created}
	 */
	async buildResultsPlaylist(modules, tracks, config) {
		const { settings: { storage }, ui: { notifications } } = modules;
		const { getSetting, stringSetting } = storage;
		const { showToast } = notifications;

		if (!app.playlists) {
			throw new Error('Playlist API not available');
		}

		try {
			// Get playlist configuration
			const template = stringSetting('PlaylistName', 'Similar - %');
			const overwrite = getSetting('PlaylistMode', 'create') === 'overwrite';

			// Show selection dialog if enabled
			let targetPlaylist = null;
			if (config.showConfirm) {
				// TODO: Implement playlist selection dialog integration
				console.log('buildResultsPlaylist: Show dialog logic (to be implemented)');
			}

			// Create new playlist if none selected
			if (!targetPlaylist) {
				const name = template.replace('%', tracks[0]?.artist || 'Similar');
				targetPlaylist = app.playlists.root.newPlaylist();
				targetPlaylist.name = name;
				console.log(`buildResultsPlaylist: Created new playlist "${name}"`);
			}

			// Add tracks to playlist
			const tracklist = app.utils.createTracklist(true);
			for (const t of tracks) {
				tracklist.add(t);
			}

			await tracklist.whenLoaded();
			await targetPlaylist.addTracksAsync(tracklist);

			console.log(`buildResultsPlaylist: Added ${tracks.length} tracks to playlist`);

			return {
				id: targetPlaylist.id,
				name: targetPlaylist.name,
				trackCount: tracks.length,
				created: true,
			};

		} catch (e) {
			console.error('buildResultsPlaylist error: ' + e.toString());
			throw e;
		}
	},

	/**
	 * Queue results to Now Playing list.
	 * 
	 * Workflow:
	 * 1. Optionally clear Now Playing if enabled
	 * 2. Deduplicate against existing queue if enabled
	 * 3. Add tracks to Now Playing
	 * 4. Focus player if enabled
	 * 
	 * @param {object} modules - Module dependencies
	 * @param {Array} tracks - Result tracks to queue
	 * @param {object} config - Configuration settings
	 * @returns {Promise<object>} Queue info {added, total}
	 */
	async queueResults(modules, tracks, config) {
		const { settings: { storage }, ui: { notifications } } = modules;
		const { getSetting, boolSetting } = storage;
		const { showToast } = notifications;

		const player = app.player;
		if (!player) {
			throw new Error('Player not available');
		}

		try {
			// Clear Now Playing if requested
			if (getSetting('ClearBeforeQueue', false)) {
				try {
					if (player.clearPlaylistAsync && typeof player.clearPlaylistAsync === 'function') {
						await player.clearPlaylistAsync();
						console.log('queueResults: Cleared Now Playing');
					}
				} catch (e) {
					console.error('queueResults: Error clearing: ' + e.toString());
				}
			}

			// Build set of existing track IDs for deduplication
			let existing = new Set();
			if (boolSetting('IgnoreRecent', config.DEFAULTS?.IgnoreRecent)) {
				try {
					const songList = player.getSongList?.();
					if (songList) {
						const tl = songList.getTracklist?.();
						if (tl) {
							await tl.whenLoaded();
							tl.forEach((t) => {
								if (t) existing.add(t.id || t.ID);
							});
						}
					}
				} catch (e) {
					console.log('queueResults: Could not build existing set: ' + e.toString());
				}
			}

			// Filter out duplicates
			const toAdd = existing.size > 0
				? tracks.filter(t => !existing.has(t?.id || t?.ID))
				: tracks;

			if (toAdd.length === 0) {
				console.log('queueResults: No new tracks to add after deduplication');
				return { added: 0, total: existing.size };
			}

			// Create tracklist and add
			const tracklist = app.utils.createTracklist(true);
			for (const t of toAdd) {
				tracklist.add(t);
			}

			await tracklist.whenLoaded();
			await player.addTracksAsync(tracklist);

			console.log(`queueResults: Added ${toAdd.length} tracks to Now Playing`);

			return {
				added: toAdd.length,
				total: existing.size + toAdd.length,
			};

		} catch (e) {
			console.error('queueResults error: ' + e.toString());
			throw e;
		}
	},
};
