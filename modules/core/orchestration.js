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

			// Load configuration
			let config_;

			if (autoMode) {
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

			// Add mood/activity context if present or from settings
			if (_moodActivityContext) {
				// Context explicitly provided (from runMoodActivityPlaylist)
				config_.moodActivityContext = _moodActivityContext.context;
				config_.moodActivityValue = _moodActivityContext.value;
				config_.playlistDuration = _moodActivityContext.duration;
				config_.moodActivityBlendRatio = intSetting('MoodActivityBlendRatio') / 100.0;
			} else if (discoveryMode === 'mood' || discoveryMode === 'activity') {
				// Context not provided, read from settings
				if (discoveryMode === 'mood') {
					config_.moodActivityContext = 'mood';
					config_.moodActivityValue = stringSetting('DefaultMood', 'energetic');
				} else {
					config_.moodActivityContext = 'activity';
					config_.moodActivityValue = stringSetting('DefaultActivity', 'workout');
				}
				config_.playlistDuration = intSetting('PlaylistDuration', 60);
				config_.moodActivityBlendRatio = intSetting('MoodActivityBlendRatio') / 100.0;

				console.log(`Match Monkey: Using ${config_.moodActivityContext} "${config_.moodActivityValue}" from settings`);
			}

			console.log(`Match Monkey: Starting ${modeName} (auto=${autoMode})`);

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
				showToast(`No similar ${modeName.toLowerCase()} found.`, 'info');
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
				showToast(`No matching tracks in your library.`, 'info');
				return { success: false, error: 'No matching tracks found.', tracksAdded: 0 };
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
			const actualTracksAdded = output?.added ?? output?.trackCount ?? finalResults.length;

			updateProgress(`Complete! ${actualTracksAdded} tracks in ${elapsed}s`, 1.0);
			terminateProgressTask(taskId);

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

				// Wait for the tracklist to load before accessing it
				await selectedTracks.whenLoaded();

				if (typeof selectedTracks.locked === 'function') {
					selectedTracks.locked(() => {
						const count = Math.min(selectedTracks.count, 50);
						for (let i = 0; i < count; i++) {
							const track = selectedTracks.getValue(i);
							if (track) {
								seeds.push({
									artist: track.artist || '',
									title: track.title || '',
									genre: track.genre || '',
									album: track.album || '',
								});
							}
						}
					});
				}
			}

			// Priority 2: Currently playing track
			if (seeds.length === 0) {
				try {
					let track = null;
					if (typeof app.player?.getCurrentTrack === 'function') {
						// Prefer async getter if provided by MM5
						track = await app.player.getCurrentTrack();
					}

					if (track) {
						console.log(`Match Monkey: Using current track as seed: "${track.artist} - ${track.title}"`);
						seeds.push({
							artist: track.artist || '',
							title: track.title || '',
							genre: track.genre || '',
							album: track.album || '',

						});
					}
				} catch (e) {
					// If async call fails, ignore and continue to next source
					console.warn('Match Monkey: Failed to get current track via getCurrentTrack():', e);
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
	 * Handles:
	 * 1. Confirmation dialog (if enabled) - lets user select existing playlist
	 * 2. Parent playlist creation/lookup
	 * 3. Playlist modes: Create new (with unique naming), Overwrite existing
	 * 4. Clear existing tracks before adding new ones
	 * 5. Navigate to playlist after creation
	 * @param {object} modules - Module dependencies
	 * @param {Array} tracks - Track objects for playlist
	 * @param {object} config - Configuration settings
	 * @returns {Promise<object>} Result with playlist reference
	 */
	async buildResultsPlaylist(modules, tracks, config) {
		const { db, settings: { storage }, ui: { notifications } } = modules;
		const { stringSetting } = storage;
		const { showToast } = notifications;

		const playlistTemplate = stringSetting('PlaylistName', '- Similar to %');
		const parentName = stringSetting('ParentPlaylist', '');
		const playlistMode = stringSetting('PlaylistMode', 'Create new playlist');
		const navigateAfter = stringSetting('NavigateAfter', 'Navigate to new playlist');

		// Get the discovery mode name (e.g., "Similar Artists", "Similar Tracks", "Similar Genre", "Mood: Energetic", "Activity: Workout")
		const modeName = config.modeName || 'Similar Artists';
		const seedName = config.seedName || 'Selection';

		// Build playlist name from template with discovery mode indicator
		let playlistName;

		// If template contains %, replace it with seed name
		if (playlistTemplate.indexOf('%') >= 0) {
			playlistName = playlistTemplate.replace('%', seedName);
		} else {
			playlistName = `${playlistTemplate} ${seedName}`;
		}

		// Append discovery mode indicator in parentheses
		// Examples:
		// "- Similar to The Beatles (Similar Artists)"
		// "- Similar to Shape of You (Similar Tracks)"
		// "- Similar to Rock (Similar Genre)"
		// "- Similar to The Beatles (Mood: Energetic)"
		// "- Similar to The Beatles (Activity: Workout)"
		if (config.moodActivityValue && (config.discoveryMode === 'mood' || config.discoveryMode === 'activity')) {
			// Capitalize first letter of mood/activity value
			const capitalizedValue = config.moodActivityValue.charAt(0).toUpperCase() + config.moodActivityValue.slice(1);
			const contextLabel = config.moodActivityContext === 'mood' ? 'Mood' : 'Activity';
			playlistName = `${playlistName} (${contextLabel}: ${capitalizedValue})`;
		} else {
			playlistName = `${playlistName} (${modeName})`;
		}
		// Truncate if too long
		if (playlistName.length > 100) {
			playlistName = playlistName.substring(0, 97) + '...';
		}

		console.log(`Match Monkey: Building playlist "${playlistName}" (mode: ${playlistMode})`);

		// Handle "Do not create playlist" mode
		if (playlistMode === 'Do not create playlist') {
			showToast(`Found ${tracks.length} tracks (playlist creation disabled)`, 'info');
			return { added: 0, playlist: null };
		}

		let userSelectedPlaylist = null;

		// Show confirmation dialog if enabled
		if (config.showConfirm) {
			console.log('Match Monkey: Showing playlist selection dialog');
			try {
				const dialogResult = await this.showPlaylistDialog();

				if (dialogResult === null) {
					// User cancelled
					console.log('Match Monkey: User cancelled playlist dialog');
					return { added: 0, playlist: null, cancelled: true };
				}

				if (dialogResult && !dialogResult.autoCreate) {
					userSelectedPlaylist = dialogResult;
				}
			} catch (dialogError) {
				console.error('Match Monkey: Dialog error:', dialogError);
				// Continue with auto-creation
			}
		}

		try {
			// Resolve target playlist using db layer
			const resolution = await db.resolveTargetPlaylist(
				playlistName,
				parentName,
				playlistMode,
				userSelectedPlaylist
			);

			const targetPlaylist = resolution.playlist;
			const shouldClear = resolution.shouldClear;

			if (!targetPlaylist) {
				throw new Error('Failed to create or find target playlist');
			}

			console.log(`Match Monkey: Using playlist "${targetPlaylist.name}" (clear: ${shouldClear})`);

			// Clear existing tracks first if needed (overwrite mode or user-selected existing playlist)
			if (shouldClear) {
				console.log('Match Monkey: Clearing existing tracks');
				await db.clearPlaylistTracks(targetPlaylist);
			}

			// Add tracks to playlist
			const addedCount = await db.addTracksToPlaylist(targetPlaylist, tracks);

			if (addedCount === 0) {
				console.warn('Match Monkey: No tracks were added to playlist');
				showToast(`Warning: No tracks could be added to playlist`, 'warning');
			}

			// Navigate based on user settings
			this.navigateAfterCreation(navigateAfter, targetPlaylist);

			console.log(`Match Monkey: Playlist "${targetPlaylist.name}" complete with ${addedCount} tracks`);

			return { added: addedCount, playlist: targetPlaylist };

		} catch (e) {
			console.error('Match Monkey: Error creating playlist:', e);
			showToast(`Failed to create playlist: ${e.message}`, 'error');
			return { added: 0, playlist: null };
		}
	},

	/**
	 * Show the playlist selection dialog.
	 * Returns the selected playlist, {autoCreate: true}, or null if cancelled.
	 */
	async showPlaylistDialog() {
		return new Promise((resolve) => {
			try {
				if (typeof uitools === 'undefined' || !uitools.openDialog) {
					console.log('Match Monkey: uitools.openDialog not available');
					resolve({ autoCreate: true });
					return;
				}

				const dlg = uitools.openDialog('dlgSelectPlaylist', {
					modal: true,
					showNewPlaylist: false
				});

				if (!dlg) {
					console.log('Match Monkey: Dialog failed to open');
					resolve({ autoCreate: true });
					return;
				}

				const handleClose = () => {
					if (dlg.modalResult !== 1) {
						// User cancelled (clicked Cancel or closed dialog)
						resolve(null);
						return;
					}

					// User clicked OK - get selected playlist
					const selectedPlaylist = dlg.getValue?.('getPlaylist')?.();
					if (selectedPlaylist) {
						resolve(selectedPlaylist);
					} else {
						// No playlist selected, auto-create
						resolve({ autoCreate: true });
					}
				};

				// Listen for dialog close
				app.listen(dlg, 'closed', handleClose);

			} catch (e) {
				console.error('showPlaylistDialog error:', e);
				resolve({ autoCreate: true });
			}
		});
	},

	/**
	 * Navigate to playlist or now playing based on user settings.
	 */
	navigateAfterCreation(navigateAfter, playlist) {
		try {
			if (navigateAfter === 'Navigate to new playlist' && playlist) {
				// Use MM5's navigationHandlers system
				if (typeof navigationHandlers !== 'undefined' &&
					navigationHandlers['playlist']?.navigate) {
					navigationHandlers['playlist'].navigate(playlist);
					console.log('Match Monkey: Navigated to playlist via navigationHandlers');
				}
			} else if (navigateAfter === 'Navigate to now playing') {
				// Navigate to Now Playing
				if (typeof navigationHandlers !== 'undefined' &&
					navigationHandlers['nowPlaying']?.navigate) {
					navigationHandlers['nowPlaying'].navigate();
					console.log('Match Monkey: Navigated to Now Playing');
				}
			}
			// 'Stay in current view' - do nothing
		} catch (navError) {
			console.warn('Match Monkey: Navigation error (non-fatal):', navError);
		}
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
