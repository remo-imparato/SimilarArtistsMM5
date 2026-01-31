/**
 * MatchMonkey Core Orchestration Logic
 * 
 * Main orchestration layer that ties together:
 * - Input collection (seed tracks)
 * - Discovery strategies (artist/track/genre/recco/mood/activity)
 * - Track matching (multi-pass fuzzy matching against library)
 * - Output generation (playlist creation or queue management)
 * - Auto-mode handling (auto-queue near end of playlist)
 * 

 * 
 * @author Remo Imparato

 */

'use strict';

window.matchMonkeyOrchestration = {
	/**
	 * Main orchestration function that runs the complete MatchMonkey workflow.
	 * 
	 * @param {object} modules - Injected module dependencies
	 * @param {boolean} [autoMode=false] - Whether running in auto-mode
	 * @param {string} [discoveryMode='artist'] - Discovery mode: 'artist', 'track', 'genre', 'acoustics', 'mood', or 'activity'
	 * @param {number} [autoModeThreshold] - Threshold for auto-mode seed collection
	 * @returns {Promise<object>} Result object with status, tracklist, playlist info
	 */
	async generateSimilarPlaylist(modules, autoMode = false, discoveryMode = 'artist', autoModeThreshold = 3) {
		const {
			utils: { helpers },
			settings: { storage },
			ui: { notifications },
			db,
			_moodActivityContext,
		} = modules;

		const { getSetting, intSetting, boolSetting, stringSetting } = storage;
		const { showToast, updateProgress, createProgressTask, terminateProgressTask } = notifications;
		const { formatError, shuffle: shuffleUtil } = helpers;

		// Get discovery strategies
		const strategies = window.matchMonkeyDiscoveryStrategies;
		if (!strategies) {
			console.error('Match Monkey: Discovery strategies module not loaded');
			showToast('Add-on error: Discovery strategies not loaded', { type: 'error', duration: 5000 });
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
			taskId = createProgressTask(`MatchMonkey - ${modeName}`);
			updateProgress(`Preparing ${modeName} discovery...`, 0);
			console.log(`Match Monkey: === Starting ${modeName} Discovery (auto=${autoMode}) ===`);

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
				// Context explicitly provided
				config_.moodActivityContext = _moodActivityContext.context;
				config_.moodActivityValue = _moodActivityContext.value;
				config_.moodSeedBlend = getSetting("MoodActivityBlendRatio", 0.5);
				console.log(`Match Monkey: Using ${config_.moodActivityContext} "${config_.moodActivityValue}" (blend: ${config_.moodSeedBlend})`);
			} else if (discoveryMode === 'mood' || discoveryMode === 'activity') {
				// Context not provided, read from settings
				if (discoveryMode === 'mood') {
					config_.moodActivityContext = 'mood';
					config_.moodActivityValue = stringSetting('DefaultMood', 'energetic');
				} else {
					config_.moodActivityContext = 'activity';
					config_.moodActivityValue = stringSetting('DefaultActivity', 'workout');
				}

				console.log(`Match Monkey: Using ${config_.moodActivityContext} "${config_.moodActivityValue}" from settings`);
			}

			// Log configuration summary
			console.log(`Match Monkey: Config - seedLimit=${config_.seedLimit}, similarLimit=${config_.similarLimit}, tracksPerArtist=${config_.tracksPerArtist}`);

			// Step 1: Collect seed tracks
			let seeds = [];
			const seedsRequired = true;

			if (seedsRequired) {
				updateProgress(`Collecting seed tracks...`, 0.05);

				// In auto-mode, collect seeds from Now Playing queue
				if (autoMode) {
					console.log(`Match Monkey Auto-Mode: Using Now Playing queue for seeds (threshold=${autoModeThreshold})`);
					seeds = await this.collectAutoModeSeedsFromQueue(modules, autoModeThreshold);
				} else {
					// Manual mode: use selection or current track
					seeds = await this.collectSeedTracks(modules);
				}

				if (!seeds || seeds.length === 0) {
					terminateProgressTask(taskId);
					const modeMsg = autoMode ? 'No tracks in Now Playing queue.' : 'Select tracks or play something first.';
					showToast(`No seed tracks found. ${modeMsg}`, { type: 'warning', duration: 5000 });
					console.log('Match Monkey: No seed tracks found, exiting');
					return { success: false, error: 'No seed tracks found.', tracksAdded: 0 };
				}

				console.log(`Match Monkey: Collected ${seeds.length} seed track(s)`);
				updateProgress(`Found ${seeds.length} seed track(s)`, 0.1);
			} else {
				// Mood/Activity modes don't need seeds
				console.log(`Match Monkey: ${discoveryMode} mode - no seeds required`);
				updateProgress(`Starting ${modeName} discovery...`, 0.1);
			}

			// Step 2: Run discovery strategy
			updateProgress(`Contacting ${modeName} service...`, 0.15);
			console.log(`Match Monkey: === Phase 1: Discovery via ${modeName} ===`);

			const discoveryFn = strategies.getDiscoveryStrategy(discoveryMode);
			let candidates;

			try {
				candidates = await discoveryFn(modules, seeds, config_);
			} catch (discoveryError) {
				console.error(`Match Monkey: Discovery error:`, discoveryError);
				terminateProgressTask(taskId);
				showToast(`Discovery failed: ${formatError(discoveryError)}`, { type: 'error', duration: 5000 });
				return { success: false, error: formatError(discoveryError), tracksAdded: 0 };
			}

			if (!candidates || candidates.length === 0) {
				terminateProgressTask(taskId);
				showToast(`No ${modeName.toLowerCase()} candidates found. Try different seeds or settings.`, { type: 'info', duration: 5000 });
				console.log(`Match Monkey: Discovery returned no candidates`);
				return { success: false, error: `No ${modeName.toLowerCase()} found.`, tracksAdded: 0 };
			}

			console.log(`Match Monkey: Discovery found ${candidates.length} candidate(s)`);
			updateProgress(`Found ${candidates.length} candidate(s)`, 0.5);

			// Step 3: Match candidates to local library
			updateProgress(`Searching your music library...`, 0.55);
			console.log(`Match Monkey: === Phase 2: Library Matching ===`);

			// Step 3: Match candidates to local library
			let results;

			updateProgress(`Matching candidates to your library...`, 0.6);
			try {
				// Check if this is a mood/activity filter candidate (special handling)
				const isMoodActivityFilter = candidates.length === 1 &&
					(candidates[0].artist === '__MOOD_FILTER__' || candidates[0].artist === '__ACTIVITY_FILTER__');

				if (isMoodActivityFilter) {
					// Mood/Activity mode - search library with audio filtering
					results = await this.matchMoodActivityToLibrary(modules, candidates[0], config_);
				} else {
					// Standard artist/track matching
					results = await this.matchCandidatesToLibrary(modules, candidates, config_);
				}
			} catch (matchError) {
				console.error(`Match Monkey: Library matching error:`, matchError);
				terminateProgressTask(taskId);
				showToast(`Library search failed: ${formatError(matchError)}`, { type: 'error', duration: 5000 });
				return { success: false, error: formatError(matchError), tracksAdded: 0 };
			}

			if (!results || results.length === 0) {
				terminateProgressTask(taskId);
				showToast(`No matching tracks found in your library. Try different seeds or adjust filters.`, { type: 'info', duration: 5000 });
				console.log(`Match Monkey: No tracks matched in library`);
				return { success: false, error: 'No matching tracks found.', tracksAdded: 0 };
			}

			console.log(`Match Monkey: Library matching found ${results.length} track(s)`);
			updateProgress(`Found ${results.length} matching track(s)`, 0.8);

			// Step 4: Remove duplicates based on artist + title
			updateProgress(`Removing duplicates...`, 0.82);
			const makeDupKey = (t) => {
				if (!t) return '';
				const artistRaw = t.artist || t.Artist || '';
				const titleRaw = t.title || t.SongTitle || t.Title || '';
				const artist = (typeof matchMonkeyHelpers?.cleanArtistName === 'function')
					? matchMonkeyHelpers.cleanArtistName(artistRaw)
					: String(artistRaw || '').trim();
				const title = (typeof matchMonkeyHelpers?.cleanTrackName === 'function')
					? matchMonkeyHelpers.cleanTrackName(titleRaw)
					: String(titleRaw || '').trim();
				return `${artist.toUpperCase()}||${title.toUpperCase()}`;
			};

			const seenDuplicates = new Set();
			const dedupedResults = [];
			for (const track of results) {
				const dupKey = makeDupKey(track);
				if (dupKey && !seenDuplicates.has(dupKey)) {
					seenDuplicates.add(dupKey);
					dedupedResults.push(track);
				}
			}

			console.log(`Match Monkey: Removed ${results.length - dedupedResults.length} duplicates, ${dedupedResults.length} unique tracks remain`);
			updateProgress(`Removed ${results.length - dedupedResults.length} duplicates → ${dedupedResults.length} unique tracks`, 0.83);

			// Step 5: Apply randomization if enabled
			if (config_.randomize) {
				console.log(`Match Monkey: Randomizing ${dedupedResults.length} results`);
				updateProgress(`Shuffling ${dedupedResults.length} tracks...`, 0.85);
				shuffleUtil(dedupedResults);
				updateProgress(`Shuffled ${dedupedResults.length} tracks`, 0.86);
			}

			//TODO: include seed tracks if enabled


			// Apply final limit
			const finalResults = config_.totalLimit < 100000
				? dedupedResults.slice(0, config_.totalLimit)
				: dedupedResults;

			if (finalResults.length < dedupedResults.length) {
				console.log(`Match Monkey: Applied limit: ${dedupedResults.length} → ${finalResults.length} tracks`);
				updateProgress(`Applied limit: ${finalResults.length} of ${dedupedResults.length} tracks`, 0.87);
			}

			console.log(`Match Monkey: Final track count: ${finalResults.length}`);

			// Step 6: Output results
			const enqueueEnabled = boolSetting('EnqueueMode', false);
			const outputMode = config_.autoMode || enqueueEnabled ? 'queue' : 'playlist';

			updateProgress(`Adding ${finalResults.length} track(s) to ${outputMode}...`, 0.9);
			console.log(`Match Monkey: === Phase 3: Output (${outputMode}) ===`);

			let output;

			try {
				if (config_.autoMode || enqueueEnabled) {
					output = await this.queueResults(modules, finalResults, config_);
				} else {
					const seedName = seeds.length > 0 ? this.buildPlaylistSeedName(seeds) : config_.moodActivityValue || 'Selection';
					config_.seedName = seedName;
					config_.modeName = modeName;
					output = await this.buildResultsPlaylist(modules, finalResults, config_);
				}
			} catch (outputError) {
				console.error(`Match Monkey: Output error:`, outputError);
				terminateProgressTask(taskId);
				showToast(`Failed to create ${outputMode}: ${formatError(outputError)}`, { type: 'error', duration: 5000 });
				return { success: false, error: formatError(outputError), tracksAdded: 0 };
			}

			// Calculate elapsed time
			const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
			const actualTracksAdded = output?.added ?? output?.trackCount ?? finalResults.length;

			updateProgress(`Complete! Added ${actualTracksAdded} track(s)`, 1.0);
			console.log(`Match Monkey: === Complete! ${actualTracksAdded} tracks in ${elapsed}s ===`);

			terminateProgressTask(taskId);
			cache?.clear?.();

			// Show success toast with auto-dismiss
			showToast(`Successfully added ${actualTracksAdded} ${modeName} track(s) in ${elapsed}s`, { type: 'success', duration: 3000 });

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
			showToast(`Error: ${formatError(e)}`, { type: 'error', duration: 5000 });
			return { success: false, error: formatError(e), tracksAdded: 0 };
		}
	},

	/**
	 * Collect seed tracks from selection or currently playing.
	 * 
	 * @param {object} modules - Module dependencies
	 * @returns {Promise<Array>} Array of seed objects [{artist, title, genre, album}, ...]
	 */
	async collectSeedTracks(modules) {
		const seeds = [];

		try {
			// ---------------------------------------------------------
			// PRIORITY 1: SELECTED TRACKS
			// ---------------------------------------------------------
			// Try to get selected tracklist
			let selectedList = null;
			try {
				if (typeof uitools !== 'undefined' && uitools?.getSelectedTracklist) {
					selectedList = uitools.getSelectedTracklist();
				}
			} catch (e) {
				console.log('collectSeedTracks: Could not get selected tracklist: ' + e.toString());
			}

			if (selectedList) {
				try {
					await selectedList.whenLoaded();

					if (typeof selectedList.locked === 'function') {

						selectedList.locked(() => {
							let track;
							const count = selectedList.count || 0;
							for (let i = 0; i < count; i++) {
								track = selectedList.getFastObject(i, track);
								seeds.push({
									artist: matchMonkeyHelpers.cleanArtistName(track.artist || ''),
									title: matchMonkeyHelpers.cleanTrackName(track.title || ''),
									album: matchMonkeyHelpers.cleanAlbumName(track.album || ''),
									genre: track.genre || '',
								});
							}
						});
					}
				} catch (e) {
					console.error('collectSeedTracks: Error iterating selection: ' + e.toString());
				}
			}

			// ---------------------------------------------------------
			// PRIORITY 2: CURRENTLY PLAYING TRACK
			// ---------------------------------------------------------
			if (seeds.length === 0) {
				try {
					let track = null;

					if (typeof app.player?.getCurrentTrack === 'function') {
						track = await app.player.getCurrentTrack();
					}

					if (track) {
						console.log(
							`Match Monkey: Using current track as seed: "${track.artist} - ${track.title}"`
						);

						seeds.push({
							artist: matchMonkeyHelpers.cleanArtistName(track.artist || ''),
							title: matchMonkeyHelpers.cleanTrackName(track.title || ''),
							album: matchMonkeyHelpers.cleanAlbumName(track.album || ''),
							genre: track.genre || '',
						});
					}
				} catch (e) {
					console.warn('Match Monkey: Failed to get current track:', e);
				}
			}

		} catch (e) {
			console.error('Match Monkey: Error collecting seeds:', e);
		}

		// Final cleanup
		return seeds.filter(s => s.artist && s.artist.trim().length > 0);
	},

	/**
	 * Collect seed tracks from Now Playing queue for auto-mode.
	 * Uses the threshold setting to determine how many remaining tracks to use as seeds.
	 * 
	 * @param {object} modules - Module dependencies
	 * @param {number} threshold - Number of remaining tracks that trigger auto-mode
	 * @returns {Promise<Array>} Array of seed objects [{artist, title, genre, album}, ...]
	 */
	async collectAutoModeSeedsFromQueue(modules, threshold) {
		const seeds = [];

		try {
			if (!app.player) {
				console.warn('collectAutoModeSeedsFromQueue: Player not available');
				return seeds;
			}

			// Get Now Playing tracklist
			const tracklist = (typeof app.player.getTracklist === 'function')
				? app.player.getTracklist()
				: null;

			if (!tracklist) {
				console.warn('collectAutoModeSeedsFromQueue: Now Playing tracklist not available');
				return seeds;
			}

			// Wait for tracklist to load
			if (typeof tracklist.whenLoaded === 'function') {
				await tracklist.whenLoaded();
			}

			// Get index of the currently playing track
			let currentIndex = -1;
			try {
				if (typeof app.player.getIndexOfPlayingTrack === 'function') {
					currentIndex = app.player.getIndexOfPlayingTrack(tracklist);
				}
			} catch (e) {
				console.warn('collectAutoModeSeedsFromQueue: Could not get playing index:', e);
			}

			if (currentIndex == null || currentIndex < 0) {
				console.warn('collectAutoModeSeedsFromQueue: Invalid playing index');
				return seeds;
			}

			const totalTracks = tracklist.count || 0;
			const seedCount = threshold;

			const startIndex = currentIndex;
			const endIndex = Math.min(startIndex + seedCount, totalTracks);

			console.log(
				`Match Monkey Auto-Mode: Collecting seeds from Now Playing (playing=${currentIndex}, total=${totalTracks}, collecting ${endIndex - startIndex} tracks)`
			);

			// Extract tracks
			if (typeof tracklist.locked === 'function') {
				tracklist.locked(() => {
					let track;
					for (let i = startIndex; i < endIndex; i++) {
						track = tracklist.getFastObject(i, track);
						if (track) {
							seeds.push({
								artist: matchMonkeyHelpers.cleanArtistName(track.artist || ''),
								title: matchMonkeyHelpers.cleanTrackName(track.title || ''),
								album: matchMonkeyHelpers.cleanAlbumName(track.album || ''),
								genre: track.genre || '',
								path: track.path || '' // optional unique key
							});
						}
					}
				});
			}

			console.log(`Match Monkey Auto-Mode: Collected ${seeds.length} seeds from Now Playing queue`);

		} catch (e) {
			console.error('Match Monkey Auto-Mode: Error collecting seeds from queue:', e);
		}

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
		updateProgress(`Searching local library for ${totalCandidates} artists...`, 0.55);

		let artistsMatched = 0;
		let totalTracksMatched = 0;

		for (let i = 0; i < totalCandidates; i++) {
			const candidate = candidates[i];
			if (!candidate?.artist) continue;

			// Skip special filter candidates
			if (candidate.artist.startsWith('__')) continue;

			// Update progress periodically
			if (i % 5 === 0) {
				const progress = 0.55 + ((i / totalCandidates) * 0.25);
				updateProgress(`Library: Searching "${candidate.artist}" (${i + 1}/${totalCandidates})...`, progress);
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
				let matchedForArtist = 0;
				for (const track of tracks) {
					const trackId = track.id || track.ID || track.path;
					if (trackId && !seenTrackIds.has(trackId)) {
						seenTrackIds.add(trackId);
						results.push(track);
						matchedForArtist++;
					}
				}

				if (matchedForArtist > 0) {
					artistsMatched++;
					totalTracksMatched += matchedForArtist;
				}

			} catch (e) {
				console.warn(`Match Monkey: Error matching "${candidate.artist}":`, e.message);
			}
		}

		console.log(`Match Monkey: Library matching found ${results.length} unique tracks`);
		updateProgress(`Library: Found ${totalTracksMatched} tracks from ${artistsMatched}/${totalCandidates} artists`, 0.8);
		return results;
	},

	/**
	 * Match mood/activity filter to library tracks.
	 * Searches entire library and filters based on audio characteristics.
	 * 
	 * @param {object} modules - Module dependencies
	 * @param {object} filterCandidate - Filter candidate with audioTargets
	 * @param {object} config - Configuration settings
	 * @returns {Promise<Array>} Array of matching library track objects
	 */
	async matchMoodActivityToLibrary(modules, filterCandidate, config) {
		const { db, ui: { notifications } } = modules;
		const { updateProgress } = notifications;

		const audioTargets = filterCandidate.audioTargets || {};
		const moodOrActivity = filterCandidate.mood || filterCandidate.activity || 'unknown';

		console.log(`Match Monkey: Searching library for ${moodOrActivity} tracks with targets:`, audioTargets);
		updateProgress(`Searching library for ${moodOrActivity} tracks...`, 0.5);

		// For mood/activity mode, we search the entire library with rating filters
		// and then shuffle to get variety
		try {
			// Search library for tracks (broad search)
			const allTracks = await db.findLibraryTracks(
				null, // No specific artist
				null, // No specific titles
				config.totalLimit || 1000, // Get plenty of tracks
				{
					best: config.bestEnabled,
					minRating: config.minRating,
					allowUnknown: config.allowUnknown,
				}
			);

			console.log(`Match Monkey: Found ${allTracks.length} tracks in library for ${moodOrActivity} filtering`);

			// For now, return all tracks - in future we could filter by audio characteristics
			// if the user has audio features stored in their library
			return allTracks;

		} catch (e) {
			console.error(`Match Monkey: Error searching library for ${moodOrActivity}:`, e);
			return [];
		}
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
		const { db, settings: { storage }, ui: { notifications } } = modules;
		const { boolSetting } = storage;
		const { updateProgress } = notifications;

		const clearFirst = boolSetting('ClearQueueFirst', false);
		const skipDuplicates = boolSetting('SkipDuplicates', true);

		let added = 0;

		try {
			const np = app.player.getTracklist();
			if (!np) return { added: 0 };

			// Wait for load
			if (typeof np.whenLoaded === 'function') {
				await np.whenLoaded();
			}

			// Clear queue if requested
			if (clearFirst && np && typeof np.clear === 'function') {
				updateProgress('Clearing Now Playing queue...', 0.91);
				np.clear();
			}

			// Helper: build normalized dedupe key from artist + title
			const makeDupKey = (t) => {
				if (!t) return '';
				const artistRaw = t.artist || t.Artist || '';
				const titleRaw = t.title || t.SongTitle || t.Title || '';
				// Use existing helpers to normalize names consistently with rest of code
				const artist = (typeof matchMonkeyHelpers?.cleanArtistName === 'function')
					? matchMonkeyHelpers.cleanArtistName(artistRaw)
					: String(artistRaw || '').trim();
				const title = (typeof matchMonkeyHelpers?.cleanTrackName === 'function')
					? matchMonkeyHelpers.cleanTrackName(titleRaw)
					: String(titleRaw || '').trim();

				// Uppercase to make comparison case-insensitive
				return `${artist.toUpperCase()}||${title.toUpperCase()}`;
			};

			// Build set of existing artist+title keys for duplicate detection
			const existing = new Set();
			let existingCount = 0;

			if (skipDuplicates && np && typeof np.locked === 'function') {
				np.locked(() => {
					let t;
					for (let i = 0; i < np.count; i++) {
						t = np.getFastObject(i, t);
						if (t) {
							const dup = makeDupKey(t);
							if (dup) existing.add(dup);
						}
					}
					existingCount = np.count;
				});

				if (existingCount > 0) {
					updateProgress(`Checking ${tracks.length} tracks against ${existingCount} in queue...`, 0.92);
				}
			}

			let skippedDuplicates = 0;

			// Add tracks to Now Playing
			updateProgress(`Adding ${tracks.length} tracks to Now Playing...`, 0.93);

			for (const track of tracks) {
				const dupKey = makeDupKey(track);

				if (skipDuplicates && dupKey && existing.has(dupKey)) {
					skippedDuplicates++;
					continue;
				}

				try {
					await db.queueTrack(track);
					added++;
					if (dupKey) existing.add(dupKey);
				} catch (e) {
					console.warn(`Match Monkey: Failed to queue track:`, e?.message || e);
				}
			}

			if (skippedDuplicates > 0) {
				console.log(`Match Monkey: Skipped ${skippedDuplicates} duplicates already in queue`);
				updateProgress(`Queued ${added} tracks (skipped ${skippedDuplicates} duplicates)`, 0.98);
			} else {
				updateProgress(`Queued ${added} tracks to Now Playing`, 0.98);
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
	//*
	async buildResultsPlaylist(modules, tracks, config) {
		const { db, settings: { storage }, ui: { notifications } } = modules;
		const { stringSetting } = storage;
		const { showToast, updateProgress } = notifications;

		const playlistTemplate = stringSetting('PlaylistName', '- Similar to % (#)');
		const parentName = stringSetting('ParentPlaylist', '');
		const playlistMode = stringSetting('PlaylistMode', 'Create new playlist');
		const navigateAfter = stringSetting('NavigateAfter', 'Navigate to new playlist');

		const modeName = config.modeName || 'Similar Artists';
		const seedName = config.seedName || 'Selection';

		// Build playlist name from template
		let playlistName;

		if (playlistTemplate.indexOf('%') >= 0) {
			playlistName = playlistTemplate.replace('%', seedName);
		} else {
			playlistName = `${playlistTemplate} ${seedName}`;
		}

		// Append discovery mode indicator
		if (config.moodActivityValue && (config.discoveryMode === 'mood' || config.discoveryMode === 'activity')) {
			const capitalizedValue = config.moodActivityValue.charAt(0).toUpperCase() + config.moodActivityValue.slice(1);
			const contextLabel = config.moodActivityContext === 'mood' ? 'Mood' : 'Activity';
			playlistName = `${playlistName} (${contextLabel}: ${capitalizedValue})`;
		} else if (config.discoveryMode === 'acoustics') {
			playlistName = `${playlistName} (Similar Acoustics)`;
		} else if (config.discoveryMode === 'track') {
			playlistName = `${playlistName} (Similar Tracks)`;
		} else if (config.discoveryMode === 'genre') {
			playlistName = `${playlistName} (Similar Genre)`;
		} else {
			playlistName = `${playlistName} (${modeName})`;
		}

		// Truncate if too long
		if (playlistName.length > 100) {
			playlistName = playlistName.substring(0, 97) + '...';
		}

		console.log(`Match Monkey: Building playlist "${playlistName}" (mode: ${playlistMode})`);
		updateProgress(`Creating playlist "${playlistName}"...`, 0.92);

		// Handle "Do not create playlist" mode
		if (playlistMode === 'Do not create playlist') {
			showToast(`Found ${tracks.length} tracks (playlist creation disabled)`, 'info');
			return { added: 0, playlist: null };
		}

		let userSelectedPlaylist = null;

		// Show confirmation dialog if enabled
		if (config.showConfirm) {
			console.log('Match Monkey: Showing playlist selection dialog');
			updateProgress('Waiting for playlist selection...', 0.93);
			try {
				const dialogResult = await this.showPlaylistDialog();

				if (dialogResult === null) {
					console.log('Match Monkey: UserCancelled playlist dialog');
					return { added: 0, playlist: null, cancelled: true };
				}

				if (dialogResult && !dialogResult.autoCreate) {
					userSelectedPlaylist = dialogResult;
				}
			} catch (dialogError) {
				console.error('Match Monkey: Dialog error:', dialogError);
			}
		}

		try {
			// Resolve target playlist
			updateProgress(`Resolving playlist "${playlistName}"...`, 0.94);
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

			// Clear existing tracks if needed
			if (shouldClear) {
				console.log('Match Monkey: Clearing existing tracks');
				updateProgress(`Clearing existing tracks from "${targetPlaylist.name}"...`, 0.95);
				await db.clearPlaylistTracks(targetPlaylist);
			}

			// Add tracks to playlist
			updateProgress(`Adding ${tracks.length} tracks to "${targetPlaylist.name}"...`, 0.96);
			const addedCount = await db.addTracksToPlaylist(targetPlaylist, tracks);

			if (addedCount === 0) {
				console.warn('Match Monkey: No tracks were added to playlist');
				showToast(`Warning: No tracks could be added to playlist`, 'warning');
			} else {
				updateProgress(`Added ${addedCount} tracks to "${targetPlaylist.name}"`, 0.98);
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
	/*/
		async buildResultsPlaylist(modules, tracks, config) {
		const { db, settings: { storage }, ui: { notifications } } = modules;
		const { stringSetting } = storage;
		const { showToast, updateProgress } = notifications;

		const playlistTemplate = stringSetting('PlaylistName', '- Similar to % (#)');
		const parentName = stringSetting('ParentPlaylist', '');
		const playlistMode = stringSetting('PlaylistMode', 'Create new playlist');
		const navigateAfter = stringSetting('NavigateAfter', 'Navigate to new playlist');

		const modeName = config.modeName || 'Similar Artists';
		const seedName = config.seedName || 'Selection';

		// Helper: produce playlist name from a template supporting multiple replacement tokens.
		// Supported placeholders (case-insensitive):
		// - %SEED% or % : seed/artist display name (backwards compatible with single '%')
		// - %MODE% : friendly mode name (e.g. "Similar Artists")
		// - %TYPE% : discovery mode key (e.g. "artist", "track", "mood")
		// - %MOOD% or %CONTEXT% : mood/activity value if present
		// - (#) or %COUNT% or %N% or %TRACKS% : number of tracks added
		const buildNameFromTemplate = (template) => {
			if (!template || typeof template !== 'string') return '';

			let name = template;

			// Replace explicit track-count token "(#)"
			name = name.replace(/\(\#\)/g, String(tracks.length));

			// Replace common count tokens (%COUNT%, %N%, %TRACKS%)
			name = name.replace(/%COUNT%/ig, String(tracks.length));
			name = name.replace(/%N%/ig, String(tracks.length));
			name = name.replace(/%TRACKS%/ig, String(tracks.length));
			name = name.replace(/%#%/ig, String(tracks.length));

			// Replacement map for other tokens
			const replacements = {
				'SEED': seedName,
				'MODE': modeName,
				'TYPE': config.discoveryMode || '',
				'MOOD': config.moodActivityValue || '',
				'CONTEXT': config.moodActivityValue || '',
				'ARTIST': seedName, // alias for backwards/explicit artist token
			};

			// Replace %TOKEN% style placeholders (case-insensitive)
			name = name.replace(/%([A-Z0-9_]+)%/ig, (m, token) => {
				const key = String(token).toUpperCase();
				return (replacements.hasOwnProperty(key) ? String(replacements[key]) : m);
			});

			// Backwards compatibility: single '%' -> first occurrence becomes seedName
			// Only replace if a %SEED% style token wasn't used.
			if (name.indexOf('%') >= 0 && !/%[A-Z0-9_]+%/i.test(template)) {
				name = name.replace('%', seedName);
			}

			// Final cleanup: collapse multiple spaces, trim
			name = name.replace(/\s+/g, ' ').trim();

			return name;
		};

		// Build playlist name from template
		let playlistName = buildNameFromTemplate(playlistTemplate || '');

		// If template produced an empty name, fall back to previous behaviour
		if (!playlistName) {
			if (playlistTemplate.indexOf('%') >= 0) {
				playlistName = playlistTemplate.replace('%', seedName);
			} else {
				playlistName = `${playlistTemplate} ${seedName}`;
			}
		}

		// Append discovery mode indicator when relevant
		if (config.moodActivityValue && (config.discoveryMode === 'mood' || config.discoveryMode === 'activity')) {
			const capitalizedValue = config.moodActivityValue.charAt(0).toUpperCase() + config.moodActivityValue.slice(1);
			const contextLabel = config.moodActivityContext === 'mood' ? 'Mood' : 'Activity';
			playlistName = `${playlistName} (${contextLabel}: ${capitalizedValue})`;
		} else if (config.discoveryMode === 'acoustics') {
			playlistName = `${playlistName} (Similar Acoustics)`;
		} else if (config.discoveryMode === 'track') {
			playlistName = `${playlistName} (Similar Tracks)`;
		} else if (config.discoveryMode === 'genre') {
			playlistName = `${playlistName} (Similar Genre)`;
		} else {
			playlistName = `${playlistName} (${modeName})`;
		}

		// Truncate if too long
		if (playlistName.length > 100) {
			playlistName = playlistName.substring(0, 97) + '...';
		}

		console.log(`Match Monkey: Building playlist "${playlistName}" (mode: ${playlistMode})`);
		updateProgress(`Creating playlist "${playlistName}"...`, 0.92);

		// Handle "Do not create playlist" mode
		if (playlistMode === 'Do not create playlist') {
			showToast(`Found ${tracks.length} tracks (playlist creation disabled)`, 'info');
			return { added: 0, playlist: null };
		}

		let userSelectedPlaylist = null;

		// Show confirmation dialog if enabled
		if (config.showConfirm) {
			console.log('Match Monkey: Showing playlist selection dialog');
			updateProgress('Waiting for playlist selection...', 0.93);
			try {
				const dialogResult = await this.showPlaylistDialog();

				if (dialogResult === null) {
					console.log('Match Monkey: UserCancelled playlist dialog');
					return { added: 0, playlist: null, cancelled: true };
				}

				if (dialogResult && !dialogResult.autoCreate) {
					userSelectedPlaylist = dialogResult;
				}
			} catch (dialogError) {
				console.error('Match Monkey: Dialog error:', dialogError);
			}
		}

		try {
			// Resolve target playlist
			updateProgress(`Resolving playlist "${playlistName}"...`, 0.94);
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

			// Clear existing tracks if needed
			if (shouldClear) {
				console.log('Match Monkey: Clearing existing tracks');
				updateProgress(`Clearing existing tracks from "${targetPlaylist.name}"...`, 0.95);
				await db.clearPlaylistTracks(targetPlaylist);
			}

			// Add tracks to playlist
			updateProgress(`Adding ${tracks.length} tracks to "${targetPlaylist.name}"...`, 0.96);
			const addedCount = await db.addTracksToPlaylist(targetPlaylist, tracks);

			if (addedCount === 0) {
				console.warn('Match Monkey: No tracks were added to playlist');
				showToast(`Warning: No tracks could be added to playlist`, 'warning');
			} else {
				updateProgress(`Added ${addedCount} tracks to "${targetPlaylist.name}"`, 0.98);
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

	//*/

	/**
	 * Show the playlist selection dialog.
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
						resolve(null);
						return;
					}

					const selectedPlaylist = dlg.getValue?.('getPlaylist')?.();
					if (selectedPlaylist) {
						resolve(selectedPlaylist);
					} else {
						resolve({ autoCreate: true });
					}
				};

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
				if (typeof navigationHandlers !== 'undefined' && navigationHandlers['playlist']?.navigate) {
					navigationHandlers['playlist'].navigate(playlist);
					console.log('Match Monkey: Navigated to playlist');
				}
			} else if (navigateAfter === 'Navigate to now playing') {
				if (typeof navigationHandlers !== 'undefined' && navigationHandlers['nowPlaying']?.navigate) {
					navigationHandlers['nowPlaying'].navigate();
					console.log('Match Monkey: Navigated to Now Playing');
				}
			}
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

		const artists = new Set();
		for (const seed of seeds) {
			if (seed.artist) {
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
