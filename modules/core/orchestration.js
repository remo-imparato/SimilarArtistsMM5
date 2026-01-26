/**
 * MatchMonkey Core Orchestration Logic
 * 
 * Main orchestration layer that ties together:
 * - Input collection (seed tracks)
 * - Discovery strategies (artist/track/genre based)
 * - Track matching (multi-pass fuzzy matching against library)
 * - Output generation (playlist creation or queue management)
 * - Auto-mode handling (auto-queue near end of playlist)
 * 
 * MediaMonkey 5 API Only
 * 
 * @author Remo Imparato
 * @license MIT
 */

'use strict';

window.matchMonkeyOrchestration = {
	/**
	 * Main orchestration function that runs the complete MatchMonkey workflow.
	 * 
	 * @param {object} modules - Injected module dependencies
	 * @param {boolean} [autoMode=false] - Whether running in auto-mode
	 * @param {string} [discoveryMode='artist'] - Discovery mode: 'artist', 'track', 'genre', 'mood', or 'activity'
	 * @returns {Promise<object>} Result object with status, tracklist, playlist info
	 */
	async generateSimilarPlaylist(modules, autoMode = false, discoveryMode = 'artist') {
		const {
			utils: { helpers },
			settings: { storage },
			ui: { notifications },
			db,
			_moodActivityContext,
		} = modules;

		const { intSetting, boolSetting, stringSetting } = storage;
		const { showToast, updateProgress, createProgressTask, terminateProgressTask } = notifications;
		const { formatError, shuffle: shuffleUtil } = helpers;

		// Get discovery strategies
		const strategies = window.matchMonkeyDiscoveryStrategies;
		if (!strategies) {
			console.error('Match Monkey: Discovery strategies module not loaded');
			showToast('Add-on error: Discovery strategies not loaded', 'error');
			return { success: false, error: 'Discovery strategies not loaded', tracksAdded: 0 };
		}

		// Initialize cache for this run
		const cache = window.lastfmCache;
		cache?.init?.();

		let taskId = null;
		const startTime = Date.now();

		try {
			// Initialize progress tracking
			const modeName = strategies.getDiscoveryModeName(discoveryMode);
			taskId = createProgressTask(`Generating ${modeName} Playlist`);
			updateProgress(`Initializing ${modeName} search...`, 0);

			// Validate environment
			if (typeof app === 'undefined' || !app.player) {
				throw new Error('MediaMonkey application not available');
			}

			// Load configuration - uses user settings without hard overrides
			let config_;

			if (autoMode) {
				// Auto-mode uses dedicated settings
				config_ = {
					seedLimit: intSetting('AutoModeSeedLimit', 2),
					similarLimit: intSetting('AutoModeSimilarLimit', 10),
					trackSimilarLimit: intSetting('TrackSimilarLimit', 100),
					tracksPerArtist: intSetting('AutoModeTracksPerArtist', 5),
					totalLimit: intSetting('AutoModeMaxTracks', 30),
					includeSeedArtist: boolSetting('IncludeSeedArtist', true),
					rankEnabled: boolSetting('UseLastfmRanking', true),
					bestEnabled: boolSetting('PreferHighQuality', true),
					randomize: true,
					showConfirm: false,
					minRating: intSetting('MinRating', 0),
					allowUnknown: boolSetting('IncludeUnrated', true),
					autoMode: true,
					discoveryMode,
				};
			} else {
				// Manual mode uses standard settings
				const maxTracks = intSetting('MaxPlaylistTracks', 0);
				
				config_ = {
					seedLimit: intSetting('SimilarArtistsLimit', 20),
					similarLimit: intSetting('SimilarArtistsLimit', 20),
					trackSimilarLimit: intSetting('TrackSimilarLimit', 100),
					tracksPerArtist: intSetting('TracksPerArtist', 30),
					totalLimit: maxTracks > 0 ? maxTracks : 100000,
					includeSeedArtist: boolSetting('IncludeSeedArtist', true),
					rankEnabled: boolSetting('UseLastfmRanking', true),
					bestEnabled: boolSetting('PreferHighQuality', true),
					randomize: boolSetting('ShuffleResults', true),
					showConfirm: boolSetting('ShowConfirmDialog', false),
					minRating: intSetting('MinRating', 0),
					allowUnknown: boolSetting('IncludeUnrated', true),
					autoMode: false,
					discoveryMode,
				};
			}
			
			// Add mood/activity context if present
			if (_moodActivityContext) {
				config_.moodActivityContext = _moodActivityContext.context;
				config_.moodActivityValue = _moodActivityContext.value;
				config_.playlistDuration = _moodActivityContext.duration;
				config_.moodActivityBlendRatio = intSetting('MoodActivityBlendRatio', 50) / 100.0;
				console.log(`Match Monkey: ${_moodActivityContext.context}="${_moodActivityContext.value}", blend=${config_.moodActivityBlendRatio}`);
			}

			console.log(`Match Monkey: Starting ${modeName} (auto=${autoMode}, limits: seed=${config_.seedLimit}, similar=${config_.similarLimit}, total=${config_.totalLimit})`);

			// Step 1: Collect seed tracks
			updateProgress(`Collecting seed tracks...`, 0.05);
			const seeds = await this.collectSeedTracks(modules);

			if (!seeds || seeds.length === 0) {
				terminateProgressTask(taskId);
				showToast(`No seed tracks found. Select tracks or play something first.`, 'warning');
				return { success: false, error: 'No seed tracks found.', tracksAdded: 0 };
			}

			console.log(`Match Monkey: ${seeds.length} seed(s) collected`);
			updateProgress(`Found ${seeds.length} seed(s), starting discovery...`, 0.1);

			// Step 2: Run discovery strategy
			const discoveryFn = strategies.getDiscoveryStrategy(discoveryMode);
			let candidates;

			try {
				candidates = await discoveryFn(modules, seeds, config_);
			} catch (discoveryError) {
				console.error(`Match Monkey: Discovery error:`, discoveryError);
				terminateProgressTask(taskId);
				showToast(`Discovery error: ${formatError(discoveryError)}`, 'error');
				return { success: false, error: formatError(discoveryError), tracksAdded: 0 };
			}

			if (!candidates || candidates.length === 0) {
				terminateProgressTask(taskId);
				showToast(`No similar ${modeName.toLowerCase()} found. Try different seeds.`, 'info');
				return { success: false, error: `No ${modeName.toLowerCase()} found.`, tracksAdded: 0 };
			}

			console.log(`Match Monkey: Discovery found ${candidates.length} candidates`);
			updateProgress(`Found ${candidates.length} candidates, searching library...`, 0.5);

			// Step 3: Match candidates to local library
			let results;

			try {
				results = await this.matchCandidatesToLibrary(modules, candidates, config_);
			} catch (matchError) {
				console.error(`Match Monkey: Library matching error:`, matchError);
				terminateProgressTask(taskId);
				showToast(`Library error: ${formatError(matchError)}`, 'error');
				return { success: false, error: formatError(matchError), tracksAdded: 0 };
			}

			if (!results || results.length === 0) {
				terminateProgressTask(taskId);
				showToast(`No matching tracks in your library. Try different seeds or filters.`, 'info');
				return { success: false, error: 'No matching tracks found in library.', tracksAdded: 0 };
			}

			console.log(`Match Monkey: Found ${results.length} library matches`);
			updateProgress(`Found ${results.length} tracks, preparing output...`, 0.8);

			// Step 4: Apply randomization if enabled
			if (config_.randomize) {
				shuffleUtil(results);
			}

			// Apply final limit
			const finalResults = config_.totalLimit < 100000 
				? results.slice(0, config_.totalLimit)
				: results;

			console.log(`Match Monkey: Final ${finalResults.length} tracks (limit: ${config_.totalLimit < 100000 ? config_.totalLimit : 'unlimited'})`);

			// Step 5: Output results
			updateProgress(`Adding ${finalResults.length} tracks...`, 0.9);

			const enqueueEnabled = boolSetting('EnqueueMode', false);
			let output;

			try {
				if (config_.autoMode || enqueueEnabled) {
					output = await this.queueResults(modules, finalResults, config_);
				} else {
					const seedName = this.buildPlaylistSeedName(seeds);
					config_.seedName = seedName;
					config_.modeName = modeName;
					output = await this.buildResultsPlaylist(modules, finalResults, config_);
				}
			} catch (outputError) {
				console.error(`Match Monkey: Output error:`, outputError);
				terminateProgressTask(taskId);
				showToast(`Output error: ${formatError(outputError)}`, 'error');
				return { success: false, error: formatError(outputError), tracksAdded: 0 };
			}

			// Calculate elapsed time
			const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
			const actualTracksAdded = output?.added ?? finalResults.length;

			updateProgress(`Complete! ${actualTracksAdded} tracks in ${elapsed}s`, 1.0);
			terminateProgressTask(taskId);

			// Clear cache after successful run
			cache?.clear?.();

			showToast(`Added ${actualTracksAdded} ${modeName.toLowerCase()} tracks (${elapsed}s)`, 'success');

			return {
				success: true,
				tracksAdded: actualTracksAdded,
				playlist: output?.playlist || null,
				elapsed: parseFloat(elapsed),
			};

		} catch (e) {
			console.error('Match Monkey: Unexpected error:', e);
			terminateProgressTask(taskId);
			cache?.clear?.();
			showToast(`Unexpected error: ${formatError(e)}`, 'error');
			return { success: false, error: formatError(e), tracksAdded: 0 };
		}
	},

	/**
	 * Collect seed tracks from selection or currently playing.
	 * 
	 * @param {object} modules - Module dependencies
	 * @returns {Promise<Array>} Array of seed objects [{artist, title, genre}, ...]
	 */
	async collectSeedTracks(modules) {
		const seeds = [];

		try {
			// Priority 1: Selected tracks
			const selectedTracks = uitools?.getSelectedTracklist?.();
			
			if (selectedTracks && selectedTracks.count > 0) {
				console.log(`Match Monkey: Using ${selectedTracks.count} selected track(s) as seeds`);
				
				if (typeof selectedTracks.locked === 'function') {
					selectedTracks.locked(() => {
						const count = Math.min(selectedTracks.count, 50); // Limit seeds
						for (let i = 0; i < count; i++) {
							const track = selectedTracks.getValue(i);
							if (track) {
								seeds.push({
									artist: track.artist || track.artistName || '',
									title: track.title || track.songTitle || '',
									genre: track.genre || '',
								});
							}
						}
					});
				}
			}

			// Priority 2: Currently playing track
			if (seeds.length === 0 && app.player?.currentTrack) {
				const track = app.player.currentTrack;
				console.log(`Match Monkey: Using current track as seed: "${track.artist} - ${track.title}"`);
				seeds.push({
					artist: track.artist || track.artistName || '',
					title: track.title || track.songTitle || '',
					genre: track.genre || '',
				});
			}

			// Priority 3: Now Playing list
			if (seeds.length === 0 && app.player?.playlist?.count > 0) {
				const np = app.player.playlist;
				const count = Math.min(np.count, 10);
				console.log(`Match Monkey: Using ${count} track(s) from Now Playing as seeds`);
				
				if (typeof np.locked === 'function') {
					np.locked(() => {
						for (let i = 0; i < count; i++) {
							const track = np.getValue(i);
							if (track) {
								seeds.push({
									artist: track.artist || track.artistName || '',
									title: track.title || track.songTitle || '',
									genre: track.genre || '',
								});
							}
						}
					});
				}
			}

		} catch (e) {
			console.error('Match Monkey: Error collecting seeds:', e);
		}

		// Filter out seeds without artist
		return seeds.filter(s => s.artist && s.artist.trim().length > 0);
	},

	/**
	 * Match discovered candidates to local library tracks.
	 * 
	 * @param {object} modules - Module dependencies
	 * @param {Array} candidates - Array of {artist, tracks[]} from discovery
	 * @param {object} config - Configuration settings
	 * @returns {Promise<Array>} Array of matching library track objects
	 */
	async matchCandidatesToLibrary(modules, candidates, config) {
		const { db, ui: { notifications } } = modules;
		const { updateProgress } = notifications;
		const results = [];
		const seenTrackIds = new Set();

		const totalCandidates = candidates.length;
		console.log(`Match Monkey: Matching ${totalCandidates} candidates to library`);

		for (let i = 0; i < totalCandidates; i++) {
			const candidate = candidates[i];
			if (!candidate?.artist) continue;

			// Update progress periodically
			if (i % 5 === 0) {
				const progress = 0.5 + ((i / totalCandidates) * 0.3);
				updateProgress(`Searching library (${i + 1}/${totalCandidates})...`, progress);
			}

			try {
				let tracks = [];

				// If candidate has specific tracks, search for those
				if (candidate.tracks && candidate.tracks.length > 0) {
					const titles = candidate.tracks.map(t => 
						typeof t === 'string' ? t : (t.title || '')
					).filter(Boolean);

					if (titles.length > 0) {
						const foundMap = await db.findLibraryTracksBatch(
							candidate.artist,
							titles,
							config.tracksPerArtist || 10,
							{
								best: config.bestEnabled,
								minRating: config.minRating,
								allowUnknown: config.allowUnknown,
							}
						);

						// Collect all found tracks
						for (const arr of foundMap.values()) {
							tracks.push(...arr);
						}
					}
				}

				// Fallback: search by artist only
				if (tracks.length === 0) {
					tracks = await db.findLibraryTracks(
						candidate.artist,
						null,
						config.tracksPerArtist || 10,
						{
							best: config.bestEnabled,
							minRating: config.minRating,
						}
					);
				}

				// Add unique tracks to results
				for (const track of tracks) {
					const trackId = track.id || track.ID || track.path;
					if (trackId && !seenTrackIds.has(trackId)) {
						seenTrackIds.add(trackId);
						results.push(track);
					}
				}

			} catch (e) {
				console.warn(`Match Monkey: Error matching "${candidate.artist}":`, e.message);
			}
		}

		console.log(`Match Monkey: Library matching found ${results.length} unique tracks`);
		return results;
	},

	/**
	 * Queue results to Now Playing.
	 * 
	 * @param {object} modules - Module dependencies
	 * @param {Array} tracks - Track objects to queue
	 * @param {object} config - Configuration settings
	 * @returns {Promise<object>} Result with count added
	 */
	async queueResults(modules, tracks, config) {
		const { db, settings: { storage } } = modules;
		const { boolSetting } = storage;

		const clearFirst = boolSetting('ClearQueueFirst', false);
		const skipDuplicates = boolSetting('SkipDuplicates', true);

		let added = 0;

		try {
			// Clear queue if requested
			if (clearFirst && app.player?.playlist) {
				app.player.playlist.clear();
			}

			// Build set of existing track IDs for duplicate detection
			const existingIds = new Set();
			if (skipDuplicates && app.player?.playlist) {
				const np = app.player.playlist;
				if (typeof np.locked === 'function') {
					np.locked(() => {
						for (let i = 0; i < (np.count || 0); i++) {
							const t = np.getValue(i);
							if (t?.id || t?.ID) existingIds.add(t.id || t.ID);
						}
					});
				}
			}

			// Add tracks to Now Playing
			for (const track of tracks) {
				const trackId = track.id || track.ID;
				
				if (skipDuplicates && trackId && existingIds.has(trackId)) {
					continue;
				}

				try {
					await db.queueTrack(track);
					added++;
					if (trackId) existingIds.add(trackId);
				} catch (e) {
					console.warn(`Match Monkey: Failed to queue track:`, e.message);
				}
			}

			console.log(`Match Monkey: Queued ${added} tracks to Now Playing`);

		} catch (e) {
			console.error('Match Monkey: Error queuing results:', e);
		}

		return { added };
	},

	/**
	 * Build a playlist from results.
	 * 
	 * @param {object} modules - Module dependencies
	 * @param {Array} tracks - Track objects for playlist
	 * @param {object} config - Configuration settings
	 * @returns {Promise<object>} Result with playlist reference
	 */
	async buildResultsPlaylist(modules, tracks, config) {
		const { db, settings: { storage }, ui: { notifications } } = modules;
		const { stringSetting, boolSetting } = storage;
		const { showToast } = notifications;

		const playlistTemplate = stringSetting('PlaylistName', '- Similar to %');
		const parentName = stringSetting('ParentPlaylist', '');
		const playlistMode = stringSetting('PlaylistMode', 'Create new playlist');
		const navigateAfter = stringSetting('NavigateAfter', 'Navigate to new playlist');

		// Build playlist name
		let playlistName = playlistTemplate.replace('%', config.seedName || 'Selection');
		
		// Add mode indicator if not artist mode
		if (config.modeName && config.modeName !== 'Similar Artists') {
			playlistName = playlistName.replace('Similar to', config.modeName + ' -');
		}

		console.log(`Match Monkey: Creating playlist "${playlistName}" with ${tracks.length} tracks`);

		let playlist;

		try {
			// Handle playlist mode
			if (playlistMode === 'Overwrite existing playlist') {
				playlist = db.findPlaylist(playlistName);
				if (playlist) {
					// Clear existing tracks
					playlist.clear?.();
				}
			}

			// Create or get playlist
			if (!playlist) {
				playlist = await db.createPlaylist(playlistName, parentName);
			}

			if (!playlist) {
				throw new Error('Failed to create playlist');
			}

			// Add tracks to playlist
			await db.addTracksToPlaylist(playlist, tracks);

			// Commit changes
			if (typeof playlist.commitAsync === 'function') {
				await playlist.commitAsync();
			}

			// Navigate if requested
			if (navigateAfter === 'Navigate to new playlist' && playlist) {
				try {
					app.uiTools?.showNode?.(playlist);
				} catch (_) { /* ignore navigation errors */ }
			} else if (navigateAfter === 'Navigate to now playing') {
				try {
					app.uiTools?.showNowPlaying?.();
				} catch (_) { /* ignore navigation errors */ }
			}

			console.log(`Match Monkey: Playlist "${playlistName}" created with ${tracks.length} tracks`);

		} catch (e) {
			console.error('Match Monkey: Error creating playlist:', e);
			showToast(`Failed to create playlist: ${e.message}`, 'error');
			return { added: 0, playlist: null };
		}

		return { added: tracks.length, playlist };
	},

	/**
	 * Build a display name from seed tracks for playlist naming.
	 * 
	 * @param {Array} seeds - Seed objects
	 * @returns {string} Display name for playlist
	 */
	buildPlaylistSeedName(seeds) {
		if (!seeds || seeds.length === 0) return 'Selection';

		// Get unique artists from seeds
		const artists = new Set();
		for (const seed of seeds) {
			if (seed.artist) {
				// Split by semicolon and add each artist
				const parts = seed.artist.split(';').map(a => a.trim()).filter(Boolean);
				for (const part of parts) {
					artists.add(part);
				}
			}
		}

		const artistList = Array.from(artists);

		if (artistList.length === 0) return 'Selection';
		if (artistList.length === 1) return artistList[0];
		if (artistList.length === 2) return `${artistList[0]} & ${artistList[1]}`;
		return `${artistList[0]} & Others`;
	},
};
