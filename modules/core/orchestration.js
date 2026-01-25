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
	 * @param {string} [discoveryMode='artist'] - Discovery mode: 'artist', 'track', or 'genre`
	 * @returns {Promise<object>} Result object with status, tracklist, playlist info
	 */
	async generateSimilarPlaylist(modules, autoMode = false, discoveryMode = 'artist') {
		const {
			utils: { helpers },
			settings: { storage },
			ui: { notifications },
			db,
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

		let taskId = null;

		try {
			// Initialize progress tracking
			const modeName = strategies.getDiscoveryModeName(discoveryMode);
			taskId = createProgressTask(`Generating ${modeName} Playlist`);
			updateProgress(`Initializing ${modeName} search...`, 0);

			// Validate environment
			if (typeof app === 'undefined' || !app.player) {
				throw new Error('MediaMonkey application not available');
			}

			// Load configuration with new property names
			// Support both old and new property names for backwards compatibility
			let config_;

			if (autoMode) {
				// Auto-mode uses dedicated auto-mode settings
				config_ = {
					// Auto-mode specific limits (user configurable)
					seedLimit: intSetting('AutoModeSeedLimit', 2),
					similarLimit: intSetting('AutoModeSimilarLimit', 10),
					trackSimilarLimit: intSetting('TrackSimilarLimit', 100),
					tracksPerArtist: intSetting('AutoModeTracksPerArtist', 5),
					totalLimit: intSetting('AutoModeMaxTracks', 30),
					
					// Behavior settings
					includeSeedArtist: boolSetting('IncludeSeedArtist', boolSetting('Seed', true)),
					rankEnabled: boolSetting('UseLastfmRanking', boolSetting('Rank', true)),
					bestEnabled: boolSetting('PreferHighQuality', boolSetting('Best', true)),
					randomize: true, // Always shuffle in auto-mode
					showConfirm: false, // Never show confirm in auto-mode
					minRating: intSetting('MinRating', intSetting('Rating', 0)),
					allowUnknown: boolSetting('IncludeUnrated', boolSetting('Unknown', true)),
					autoMode: true,
					discoveryMode,
				};
			} else {
				// Manual mode uses standard settings
				const maxTracks = intSetting('MaxPlaylistTracks', intSetting('TPL', 0));
				
				config_ = {
					// Discovery limits
					seedLimit: intSetting('SimilarArtistsLimit', intSetting('SeedLimit', 20)),
					similarLimit: intSetting('SimilarArtistsLimit', intSetting('SimilarLimit', 20)),
					trackSimilarLimit: intSetting('TrackSimilarLimit', 100),
					tracksPerArtist: intSetting('TracksPerArtist', intSetting('TPA', 30)),
					// 0 = unlimited (a very high number to effectively disable the limit)
					totalLimit: maxTracks > 0 ? maxTracks : 100000,
					
					// Behavior settings
					includeSeedArtist: boolSetting('IncludeSeedArtist', boolSetting('Seed', true)),
					rankEnabled: boolSetting('UseLastfmRanking', boolSetting('Rank', true)),
					bestEnabled: boolSetting('PreferHighQuality', boolSetting('Best', true)),
					randomize: boolSetting('ShuffleResults', boolSetting('Random', true)),
					showConfirm: boolSetting('ShowConfirmDialog', boolSetting('Confirm', false)),
					minRating: intSetting('MinRating', intSetting('Rating', 0)),
					allowUnknown: boolSetting('IncludeUnrated', boolSetting('Unknown', true)),
					autoMode: false,
					discoveryMode,
				};
			}

			console.log(`Match Monkey: Starting ${modeName} discovery (autoMode=${autoMode}, mode=${discoveryMode})`);
			console.log(`Match Monkey: Limits - seeds:${config_.seedLimit}, similar:${config_.similarLimit}, tracksPerArtist:${config_.tracksPerArtist}, total:${config_.totalLimit}`);

			// Step 1: Collect seed tracks
			updateProgress(`[${modeName}] Collecting seed tracks...`, 0.05);
			const seeds = await this.collectSeedTracks(modules);

			if (!seeds || seeds.length === 0) {
				terminateProgressTask(taskId);
				showToast(`[${modeName}] No seed tracks found. Select tracks or play something first.`, 'warning');
				return {
					success: false,
					error: 'No seed tracks found.',
					tracksAdded: 0,
				};
			}

			console.log(`Match Monkey [${modeName}]: Collected ${seeds.length} seed(s)`);
			updateProgress(`[${modeName}] Found ${seeds.length} seed(s)`, 0.1);

			// Step 2: Run discovery strategy
			const discoveryFn = strategies.getDiscoveryStrategy(discoveryMode);
			let candidates;

			try {
				candidates = await discoveryFn(modules, seeds, config_);
			} catch (discoveryError) {
				console.error(`Match Monkey [${modeName}]: Discovery error:`, discoveryError);
				terminateProgressTask(taskId);
				showToast(`[${modeName}] Discovery error: ${formatError(discoveryError)}`, 'error');
				return {
					success: false,
					error: formatError(discoveryError),
					tracksAdded: 0,
				};
			}

			if (!candidates || candidates.length === 0) {
				terminateProgressTask(taskId);
				showToast(`[${modeName}] No matches found. Try different seeds.`, 'info');
				return {
					success: false,
					error: `No ${modeName.toLowerCase()} found.`,
					tracksAdded: 0,
				};
			}

			console.log(`Match Monkey [${modeName}]: Discovery returned ${candidates.length} candidates`);

			// Step 3: Match candidates to local library
			updateProgress(`[${modeName}] Searching local library...`, 0.6);
			let results;

			try {
				results = await this.matchCandidatesToLibrary(modules, candidates, config_);
			} catch (matchError) {
				console.error(`Match Monkey [${modeName}]: Library matching error:`, matchError);
				terminateProgressTask(taskId);
				showToast(`[${modeName}] Library error: ${formatError(matchError)}`, 'error');
				return {
					success: false,
					error: formatError(matchError),
					tracksAdded: 0,
				};
			}

			if (!results || results.length === 0) {
				terminateProgressTask(taskId);
				showToast(`[${modeName}] No matching tracks in your library. Try different seeds or filters.`, 'info');
				return {
					success: false,
					error: 'No matching tracks found in your library.',
					tracksAdded: 0,
				};
			}

			console.log(`Match Monkey [${modeName}]: Found ${results.length} matching tracks in library`);
			updateProgress(`[${modeName}] Found ${results.length} matching tracks`, 0.8);

			// Step 4: Apply randomization if enabled
			if (config_.randomize) {
				updateProgress(`[${modeName}] Randomizing results...`, 0.85);
				shuffleUtil(results);
			}

			// Apply final limit only if set (totalLimit < 100000 means it was explicitly set)
			const finalResults = config_.totalLimit < 100000 
				? results.slice(0, config_.totalLimit)
				: results; // No limit - use all found tracks

			console.log(`Match Monkey [${modeName}]: Final results: ${finalResults.length} tracks (limit was ${config_.totalLimit < 100000 ? config_.totalLimit : 'unlimited'})`);

			// Step 5: Choose output method
			updateProgress(`[${modeName}] Preparing output...`, 0.9);

			const enqueueEnabled = boolSetting('EnqueueMode', boolSetting('Enqueue', false));
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
				console.error(`Match Monkey [${modeName}]: Output error:`, outputError);
				terminateProgressTask(taskId);
				showToast(`[${modeName}] Output error: ${formatError(outputError)}`, 'error');
				return {
					success: false,
					error: formatError(outputError),
					tracksAdded: 0,
				};
			}

			updateProgress(`[${modeName}] Complete!`, 1.0);
			terminateProgressTask(taskId);

			// Get actual number of tracks added from output
			const actualTracksAdded = output?.added ?? finalResults.length;
			
			showToast(`Added ${actualTracksAdded} tracks (${modeName})`);

			return {
				success: true,
				tracksAdded: actualTracksAdded,
				tracks: finalResults,
				output,
				discoveryMode,
				modeName,
			};

		} catch (e) {
			console.error('generateSimilarPlaylist error:', e);
			if (taskId) {
				try { terminateProgressTask(taskId); } catch (_) { }
			}
			showToast(`Error: ${formatError(e)}`, 'error');
			return {
				success: false,
				error: e.message || String(e),
				tracksAdded: 0,
			};
		}
	},

	/**
	 * Collect seed tracks from UI selection or currently playing.
	 * Returns an array of plain objects with artist, title, and genre per track.
	 * Artist and genre may contain multiple values separated by ';'.
	 */
	async collectSeedTracks(modules) {
		const seeds = [];
		const seenTracks = new Set();

		const addTrackIfNew = (artist, title, genre) => {
			if (!artist || !title) return;
			// Use artist + title as unique key to avoid duplicate tracks
			const key = `${String(artist).trim().toUpperCase()}|${String(title).trim().toUpperCase()}`;
			if (!seenTracks.has(key)) {
				seenTracks.add(key);
				seeds.push({ 
					artist: artist || '',
					title: title || '',
					genre: genre || ''
				});
			}
		};

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
						let tmp;
						const count = selectedList.count || 0;
						for (let i = 0; i < count; i++) {
							tmp = selectedList.getFastObject(i, tmp);
							const artist = tmp?.artist || '';
							const title = tmp?.title || '';
							const genre = tmp?.genre || '';
							if (artist && title) {
								addTrackIfNew(artist, title, genre);
							}
						}
					});
				}

				if (seeds.length > 0) {
					console.log(`collectSeedTracks: Using ${seeds.length} selected track(s)`);
					return seeds;
				}
			} catch (e) {
				console.error('collectSeedTracks: Error iterating selection: ' + e.toString());
			}
		}

		// Fallback: use currently playing track
		try {
			const currentTrack = app.player?.getCurrentTrack?.();
			const artist = currentTrack?.artist || '';
			const title = currentTrack?.title || '';
			const genre = currentTrack?.genre || '';
			if (artist && title) {
				addTrackIfNew(artist, title, genre);
				console.log('collectSeedTracks: Using currently playing track');
				return seeds;
			}
		} catch (e) {
			console.error('collectSeedTracks: Error getting current track: ' + e.toString());
		}

		return seeds;
	},

	/**
	 * Match discovered candidates against local library.
	 */
	async matchCandidatesToLibrary(modules, candidates, config) {
		const { db, ui: { notifications } } = modules;
		const { findLibraryTracksBatch, findLibraryTracks } = db;
		const { updateProgress } = notifications;

		const allTracks = [];
		const seenTrackKeys = new Map(); // Map of "artist|title" -> track object for deduplication

		// Helper to add track if not duplicate, or replace with better version
		const addTrack = (track, lastfmRank) => {
			if (!track) return false;

			// Create key for deduplication: artist + title (ignore album)
			const trackTitle = (track.SongTitle || track.songTitle || track.title || '').trim().toUpperCase();
			const trackArtist = (track.Artist || track.artist || '').trim().toUpperCase();

			if (!trackTitle || !trackArtist) return false;

			const key = `${trackArtist}|${trackTitle}`;

			// Check if we already have this track
			const existing = seenTrackKeys.get(key);

			if (!existing) {
				// New track - add it
				// Store Last.fm rank for later sorting
				if (lastfmRank !== undefined) {
					track._lastfmRank = lastfmRank;
				}
				seenTrackKeys.set(key, track);
				allTracks.push(track);
				return true;
			} else {
				// Duplicate - compare quality and replace if better
				const shouldReplace = isTrackBetter(track, existing);

				if (shouldReplace) {
					// Replace the existing track with the better version
					const idx = allTracks.indexOf(existing);
					if (idx >= 0) {
						// Preserve Last.fm rank if it exists
						if (existing._lastfmRank !== undefined && lastfmRank === undefined) {
							track._lastfmRank = existing._lastfmRank;
						} else if (lastfmRank !== undefined) {
							track._lastfmRank = lastfmRank;
						}
						allTracks[idx] = track;
						seenTrackKeys.set(key, track);
					}
				}
				return false; // Still a duplicate, but we may have updated it
			}
		};

		// Helper function to determine if a track is better than another
		// Priority: 1) Bitrate, 2) Rating, 3) First found
		const isTrackBetter = (newTrack, existingTrack) => {
			// Compare bitrates
			const newBitrate = Number(newTrack.Bitrate || newTrack.bitrate || 0);
			const existingBitrate = Number(existingTrack.Bitrate || existingTrack.bitrate || 0);

			if (newBitrate > existingBitrate) return true;
			if (newBitrate < existingBitrate) return false;

			// Bitrates are equal, compare ratings
			const newRating = Number(newTrack.Rating || newTrack.rating || -1);
			const existingRating = Number(existingTrack.Rating || existingTrack.rating || -1);

			if (newRating > existingRating) return true;
			if (newRating < existingRating) return false;

			// Both bitrate and rating are equal - keep existing
			return false;
		};

		const queryOptions = {
			best: config.bestEnabled,
			minRating: config.minRating || 0,
			allowUnknown: config.allowUnknown,
		};

		const totalCandidates = candidates.length;

		// Calculate reasonable query limits to avoid over-fetching
		// Use slightly more than needed to account for deduplication, but cap it
		const queryMultiplier = 1.5; // 50% extra instead of 2x
		const maxQueryLimit = Math.min(
			Math.ceil(config.tracksPerArtist * queryMultiplier),
			config.totalLimit
		);

		for (let i = 0; i < totalCandidates; i++) {
			// Early exit if we have enough tracks
			if (allTracks.length >= config.totalLimit) {
				console.log(`matchCandidatesToLibrary: Reached limit of ${config.totalLimit} tracks`);
				break;
			}

			const candidate = candidates[i];
			if (!candidate?.artist) continue;

			const progress = 0.6 + ((i + 1) / totalCandidates) * 0.2;
			updateProgress(`Matching "${candidate.artist}" to library...`, progress);

			try {
				// Get track titles to search for
				const trackTitles = (candidate.tracks || [])
					.map(t => typeof t === 'string' ? t : (t?.title || ''))
					.filter(Boolean);

				if (trackTitles.length === 0) {
					// No specific tracks - search by artist only
					const artistTracks = await findLibraryTracks(
						candidate.artist,
						null,
						maxQueryLimit,
						queryOptions
					);

					if (artistTracks && artistTracks.length > 0) {
						for (const track of artistTracks) {
							addTrack(track);
							// Stop if we have enough tracks after deduplication
							if (allTracks.length >= config.totalLimit) break;
						}
					}
				} else {
					// Search for specific tracks with ranking data
					const matchMap = await findLibraryTracksBatch(
						candidate.artist,
						trackTitles,
						maxQueryLimit,
						queryOptions
					);

					if (matchMap && matchMap.size > 0) {
						// Build rank map from candidate tracks
						const rankMap = new Map();
						if (config.rankEnabled) {
							for (let idx = 0; idx < (candidate.tracks || []).length; idx++) {
								const t = candidate.tracks[idx];
								const trackTitle = typeof t === 'string' ? t : (t?.title || '');
								if (trackTitle) {
									// Rank is position in Last.fm results (lower is better)
									// Also consider playcount if available
									const rank = t.rank || t.playcount || (idx + 1);
									rankMap.set(trackTitle.toUpperCase(), rank);
								}
							}
						}

						// Add matched tracks (maintain order from Last.fm for ranking)
						for (const title of trackTitles) {
							const matches = matchMap.get(title);
							if (matches && matches.length > 0) {
								// Get Last.fm rank for this title
								const lastfmRank = config.rankEnabled ? rankMap.get(title.toUpperCase()) : undefined;
								
								for (const track of matches) {
									addTrack(track, lastfmRank);
								}
							}
							// Stop if we have enough tracks after deduplication
							if (allTracks.length >= config.totalLimit) break;
						}
					}
				}

			} catch (e) {
				console.error(`matchCandidatesToLibrary: Error for "${candidate.artist}": ${e.toString()}`);
			}
		}

		// Apply ranking sort if enabled
		if (config.rankEnabled) {
			console.log(`matchCandidatesToLibrary: Sorting ${allTracks.length} tracks by Last.fm ranking`);
			allTracks.sort((a, b) => {
				const rankA = a._lastfmRank || Number.MAX_SAFE_INTEGER;
				const rankB = b._lastfmRank || Number.MAX_SAFE_INTEGER;
				return rankA - rankB; // Lower rank = higher priority
			});
		}

		console.log(`matchCandidatesToLibrary: Found ${allTracks.length} unique tracks (after deduplication${config.rankEnabled ? ' and ranking' : ''})`);
		return allTracks;
	},

	/**
	 * Build results playlist.
	 */
	async buildResultsPlaylist(modules, tracks, config) {
		const { settings: { storage }, ui: { notifications } } = modules;
		const { stringSetting } = storage;
		const { updateProgress } = notifications;

		try {
			// Build playlist name
			const template = stringSetting('PlaylistName', stringSetting('Name', '- Similar to %'));
			const overwriteMode = stringSetting('PlaylistMode', stringSetting('Overwrite', 'Create new playlist'));
			const parentPlaylistName = stringSetting('ParentPlaylist', stringSetting('Parent', ''));
			const seedName = config.seedName || 'Various';
			const modeName = config.modeName || 'Similar Artists';

			let playlistName;
			if (template.indexOf('%') >= 0) {
				playlistName = template.replace('%', seedName);
			} else {
				playlistName = `${template} ${seedName}`;
			}

			// Always add mode indicator for consistency (Similar Artists, Similar Tracks, Similar Genre)
			playlistName = `${playlistName} (${modeName})`;

			if (playlistName.length > 100) {
				playlistName = playlistName.substring(0, 97) + '...';
			}

			console.log(`buildResultsPlaylist: Creating playlist "${playlistName}"`);

			// Show confirmation dialog if enabled
			let targetPlaylist = null;
			if (config.showConfirm) {
				console.log('buildResultsPlaylist: Showing confirmation dialog');
				try {
					const dialogResult = await this.confirmPlaylist(playlistName, overwriteMode);
					if (dialogResult === null) {
						console.log('buildResultsPlaylist: User cancelled');
						return { cancelled: true };
					} else if (!dialogResult.autoCreate) {
						targetPlaylist = dialogResult;
					}
				} catch (dialogError) {
					console.error('buildResultsPlaylist: Dialog error:', dialogError);
				}
			}

			// Determine the parent playlist if specified
			let parentPlaylist = null;
			if (parentPlaylistName && parentPlaylistName.trim()) {
				console.log(`buildResultsPlaylist: Looking for parent playlist "${parentPlaylistName}"`);
				try {
					parentPlaylist = await this.findPlaylist(parentPlaylistName);
					
					if (!parentPlaylist) {
						console.log(`buildResultsPlaylist: Parent playlist not found, creating it`);
						parentPlaylist = await this.createPlaylist(parentPlaylistName, null); // Create at root level
					}
					
					if (parentPlaylist) {
						console.log(`buildResultsPlaylist: Will create new playlist under parent "${parentPlaylistName}"`);
					}
				} catch (parentError) {
					console.error('buildResultsPlaylist: Error with parent playlist:', parentError);
					// Continue without parent - create at root level
					parentPlaylist = null;
				}
			}

			// Find or create playlist
			if (!targetPlaylist) {
				const shouldOverwrite = overwriteMode.toLowerCase().indexOf('overwrite') > -1;
				console.log(`buildResultsPlaylist: shouldOverwrite=${shouldOverwrite}`);

				if (shouldOverwrite) {
					console.log('buildResultsPlaylist: Looking for existing playlist to overwrite');
					try {
						// When looking for existing to overwrite, search under parent if specified
						if (parentPlaylist) {
							targetPlaylist = await this.findPlaylistUnderParent(playlistName, parentPlaylist);
						} else {
							targetPlaylist = await this.findPlaylist(playlistName);
						}
					} catch (findError) {
						console.error('buildResultsPlaylist: Find error:', findError);
					}
				}

				if (!targetPlaylist) {
					if (!shouldOverwrite) {
						// Find unique name (check under parent if specified)
						console.log('buildResultsPlaylist: Finding unique name');
						let idx = 1;
						let testName = playlistName;
						try {
							const searchFn = parentPlaylist 
								? (name) => this.findPlaylistUnderParent(name, parentPlaylist)
								: (name) => this.findPlaylist(name);
							
							while (await searchFn(testName)) {
								idx++;
								testName = `${playlistName}_${idx}`;
								if (idx > 100) break;
							}
							playlistName = testName;
						} catch (uniqueError) {
							console.error('buildResultsPlaylist: Unique name error:', uniqueError);
						}
					}

					console.log(`buildResultsPlaylist: Creating new playlist "${playlistName}"` + 
						(parentPlaylist ? ` under parent "${parentPlaylistName}"` : ''));
					try {
						targetPlaylist = await this.createPlaylist(playlistName, parentPlaylist);
					} catch (createError) {
						console.error('buildResultsPlaylist: Create error:', createError);
						throw new Error(`Failed to create playlist: ${createError.message || createError}`);
					}
				}
			}

			if (!targetPlaylist) {
				throw new Error('Failed to create playlist - no playlist object returned');
			}

			console.log('buildResultsPlaylist: Playlist created/found, preparing to add tracks');

			// Clear if overwrite mode
			const shouldClear = stringSetting('PlaylistMode', stringSetting('Overwrite', '')).toLowerCase().indexOf('overwrite') > -1;
			if (shouldClear) {
				console.log('buildResultsPlaylist: Clearing existing tracks');
				try {
					if (typeof targetPlaylist.clearTracksAsync === 'function') {
						await targetPlaylist.clearTracksAsync();
					} else if (typeof targetPlaylist.clear === 'function') {
						targetPlaylist.clear();
					}
				} catch (clearError) {
					console.log('buildResultsPlaylist: Clear error (non-fatal):', clearError);
				}
			}

			// Add tracks using MM5's addTracksAsync
			updateProgress('Adding tracks to playlist...', 0.95);
			console.log(`buildResultsPlaylist: Adding ${tracks.length} tracks`);

			let addedCount = 0;

			try {
				// Create a tracklist from our tracks array
				const trackList = app.utils.createTracklist(true);
				for (const track of tracks) {
					if (track) {
						trackList.add(track);
					}
				}
				await trackList.whenLoaded();

				console.log(`buildResultsPlaylist: Created tracklist with ${trackList.count} tracks`);

				// Use MM5's addTracksAsync method
				if (typeof targetPlaylist.addTracksAsync === 'function') {
					await targetPlaylist.addTracksAsync(trackList);
					addedCount = trackList.count;
					console.log(`buildResultsPlaylist: addTracksAsync completed, added ${addedCount} tracks`);
				} else {
					// Fallback: add tracks one by one
					console.log('buildResultsPlaylist: addTracksAsync not available, using fallback');
					for (const track of tracks) {
						if (track) {
							try {
								if (typeof targetPlaylist.addTrack === 'function') {
									targetPlaylist.addTrack(track);
									addedCount++;
								} else if (typeof targetPlaylist.add === 'function') {
									targetPlaylist.add(track);
									addedCount++;
								}
							} catch (addError) {
								console.error('buildResultsPlaylist: Error adding track:', addError);
							}
						}
					}

					// Commit after adding all tracks
					if (typeof targetPlaylist.commitAsync === 'function') {
						await targetPlaylist.commitAsync();
					}
				}
			} catch (addTracksError) {
				console.error('buildResultsPlaylist: Error adding tracks:', addTracksError);
			}

			console.log(`buildResultsPlaylist: Added ${addedCount} tracks total`);

			// Navigate if configured
			const navigate = stringSetting('NavigateAfter', stringSetting('Navigate', 'None'));
			if (navigate.toLowerCase().indexOf('playlist') > -1) {
				console.log('buildResultsPlaylist: Navigating to playlist');
				try {
					// Use MM5's navigationHandlers system instead of uitools
					if (typeof navigationHandlers !== 'undefined' && navigationHandlers['playlist'] && typeof navigationHandlers['playlist'].navigate === 'function') {
						navigationHandlers['playlist'].navigate(targetPlaylist);
					}
				} catch (navError) {
					console.log('buildResultsPlaylist: Navigation error (non-fatal):', navError);
				}
			}

			// Get playlist info safely
			let playlistId, playlistTitle;
			try {
				playlistId = targetPlaylist.id || targetPlaylist.ID || 0;
				playlistTitle = targetPlaylist.name || targetPlaylist.title || playlistName;
			} catch (infoError) {
				console.log('buildResultsPlaylist: Error getting playlist info:', infoError);
				playlistId = 0;
				playlistTitle = playlistName;
			}

			console.log(`buildResultsPlaylist: Success - playlist "${playlistTitle}" with ${addedCount} tracks`);

			return {
				id: playlistId,
				name: playlistTitle,
				trackCount: addedCount,
			};

		} catch (e) {
			console.error('buildResultsPlaylist error:', e);
			throw e;
		}
	},

	/**
	 * Queue results to Now Playing.
	 */
	async queueResults(modules, tracks, config) {
		const { settings: { storage }, ui: { notifications } } = modules;
		const { boolSetting } = storage;
		const { showToast, updateProgress } = notifications;

		try {
			if (typeof app === 'undefined' || !app.player) {
				throw new Error('MediaMonkey player not available');
			}

			const clearNP = config.autoMode ? false : boolSetting('ClearNP', false);
			const ignoreDupes = config.autoMode ? true : boolSetting('Ignore', false);

			// Build set of existing track IDs if checking duplicates
			const existing = new Set();
			if (ignoreDupes) {
				try {
					const playqueue = app.player.getSongList?.()?.getTracklist?.();
					if (playqueue) {
						await playqueue.whenLoaded();
						if (typeof playqueue.locked === 'function') {
							playqueue.locked(() => {
								let tmp;
								const count = playqueue.count || 0;
								for (let i = 0; i < count; i++) {
									tmp = playqueue.getFastObject(i, tmp);
									const id = tmp?.id || tmp?.ID;
									if (id) existing.add(String(id));
								}
							});
						}
					}
				} catch (e) {
					console.log('Could not check existing tracks: ' + e.toString());
				}
			}

			// Filter duplicates
			const tracksToAdd = ignoreDupes
				? tracks.filter(t => {
					const id = t?.id || t?.ID;
					return !id || !existing.has(String(id));
				})
				: tracks;

			if (tracksToAdd.length === 0) {
				showToast('No new tracks to add', 'info');
				return { added: 0 };
			}

			updateProgress(`Adding ${tracksToAdd.length} tracks to Now Playing...`, 0.95);

			// Check if playback has stopped before we add tracks
			const wasPlaying = app.player.isPlaying;
			const wasStopped = !wasPlaying;

			// Create tracklist and add
			const list = app.utils.createTracklist(true);
			for (const t of tracksToAdd) {
				if (t) list.add(t);
			}
			await list.whenLoaded();

			await app.player.addTracksAsync(list, {
				withClear: clearNP,
				saveHistory: true,
				startPlayback: false,
			});

			console.log(`queueResults: Added ${list.count} tracks (wasPlaying=${wasPlaying}, wasStopped=${wasStopped})`);

			// In auto-mode, if playback had stopped, restart it
			if (config.autoMode && wasStopped && list.count > 0) {
				console.log('queueResults: Auto-mode detected stopped playback, restarting...');
				try {
					// Wait a moment for the tracks to be fully added
					await new Promise(resolve => setTimeout(resolve, 100));
					
					// Start playback from the newly added tracks
					await app.player.playAsync();
					console.log('queueResults: Playback restarted successfully');
				} catch (playError) {
					console.error('queueResults: Error restarting playback:', playError);
				}
			}

			return { added: list.count, cleared: clearNP };

		} catch (e) {
			console.error('queueResults error: ' + e.toString());
			throw e;
		}
	},

	/**
	 * Build playlist seed name from seeds array.
	 * Seeds now have {artist, title, genre} structure.
	 */
	buildPlaylistSeedName(seeds) {
		if (!Array.isArray(seeds) || seeds.length === 0) return 'Similar';

		const names = [];
		const seen = new Set();

		for (const s of seeds) {
			// Get artist from seed, split by ';' and take first artist
			const artistStr = (typeof s === 'string') ? s : (s?.artist || '');
			const artists = artistStr.split(';').map(a => a.trim()).filter(Boolean);
			
			for (const artist of artists) {
				if (!artist) continue;
				const key = artist.toUpperCase();
				if (seen.has(key)) continue;
				seen.add(key);
				names.push(artist);
				if (names.length >= 3) break;
			}
			if (names.length >= 3) break;
		}

		if (names.length === 0) return 'Similar';
		if (names.length === 1) return names[0];
		if (names.length === 2) return `${names[0]} & ${names[1]}`;
		return `${names[0]}, ${names[1]} & more`;
	},

	/**
	 * Confirm playlist dialog.
	 */
	async confirmPlaylist(seedName, overwriteMode) {
		return new Promise((resolve) => {
			try {
				if (typeof uitools === 'undefined' || !uitools?.openDialog) {
					resolve({ autoCreate: true });
					return;
				}

				const dlg = uitools.openDialog('dlgSelectPlaylist', {
					modal: true,
					showNewPlaylist: false
				});

				dlg.whenClosed = function () {
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

				app.listen(dlg, 'closed', dlg.whenClosed);

			} catch (e) {
				console.error('confirmPlaylist error: ' + e.toString());
				resolve({ autoCreate: true });
			}
		});
	},

	/**
	 * Find playlist by name.
	 */
	async findPlaylist(name) {
		console.log(`findPlaylist: Looking for "${name}"`);

		if (!name) {
			console.log('findPlaylist: No name provided');
			return null;
		}

		if (typeof app === 'undefined' || !app.playlists) {
			console.log('findPlaylist: app.playlists not available');
			return null;
		}

		try {
			// Try the async API first if available
			if (typeof app.playlists.getByTitleAsync === 'function') {
				console.log('findPlaylist: Using getByTitleAsync');
				try {
					const result = await app.playlists.getByTitleAsync(name);
					if (result) {
						console.log('findPlaylist: Found via getByTitleAsync');
						return result;
					}
				} catch (asyncError) {
					console.log('findPlaylist: getByTitleAsync error:', asyncError);
				}
			}

			// Manual search through playlist tree
			console.log('findPlaylist: Manual search');
			const targetName = String(name).toLowerCase();

			function searchNode(node) {
				if (!node) return null;

				// MM5 playlists use .name property, not .title
				let nodeName = '';
				try {
					nodeName = node.name || node.title || '';
				} catch (e) {
					// Some nodes may not have name property
					return null;
				}

				if (typeof nodeName === 'string' && nodeName.toLowerCase() === targetName) {
					return node;
				}

				// Search children
				try {
					if (node.childNodes) {
						const children = node.childNodes;
						const len = children.length || 0;
						for (let i = 0; i < len; i++) {
							try {
								const child = children[i];
								const found = searchNode(child);
								if (found) return found;
							} catch (childError) {
								// Skip problematic children
								continue;
							}
						}
					}
				} catch (childrenError) {
					// Skip if can't access children
				}

				return null;
			}

			const result = searchNode(app.playlists.root);
			console.log(`findPlaylist: Manual search result: ${result ? 'found' : 'not found'}`);
			return result;

		} catch (e) {
			console.error('findPlaylist error:', e);
			return null;
		}
	},

	/**
	 * Find playlist by name under a specific parent playlist.
	 * Only searches the immediate children of the parent.
	 * 
	 * @param {string} name - Playlist name to find
	 * @param {object} parentPlaylist - Parent playlist node
	 * @returns {Promise<object|null>} Found playlist or null
	 */
	async findPlaylistUnderParent(name, parentPlaylist) {
		console.log(`findPlaylistUnderParent: Looking for "${name}" under parent`);

		if (!name || !parentPlaylist) {
			console.log('findPlaylistUnderParent: Missing name or parent');
			return null;
		}

		try {
			const targetName = String(name).toLowerCase();

			// Search immediate children only
			if (parentPlaylist.childNodes) {
				const children = parentPlaylist.childNodes;
				const len = children.length || 0;
				
				for (let i = 0; i < len; i++) {
					try {
						const child = children[i];
						const childName = child.name || child.title || '';
						
						if (typeof childName === 'string' && childName.toLowerCase() === targetName) {
							console.log(`findPlaylistUnderParent: Found "${name}" as child of parent`);
							return child;
						}
					} catch (childError) {
						// Skip problematic children
						continue;
					}
				}
			}

			console.log(`findPlaylistUnderParent: "${name}" not found under parent`);
			return null;

		} catch (e) {
			console.error('findPlaylistUnderParent error:', e);
			return null;
		}
	},

	/**
	 * Create new playlist, optionally as a child of a parent playlist.
	 * 
	 * @param {string} name - Name for the new playlist
	 * @param {object|null} parentPlaylist - Optional parent playlist node. If null, creates at root.
	 * @returns {Promise<object|null>} Created playlist or null on error
	 */
	async createPlaylist(name, parentPlaylist = null) {
		console.log(`createPlaylist: Creating playlist "${name}"` + 
			(parentPlaylist ? ' under parent' : ' at root'));

		try {
			if (typeof app === 'undefined') {
				console.error('createPlaylist: app not available');
				return null;
			}

			if (!app.playlists) {
				console.error('createPlaylist: app.playlists not available');
				return null;
			}

			// Determine which node to create under
			const targetNode = parentPlaylist || app.playlists.root;
			
			if (!targetNode) {
				console.error('createPlaylist: target node not available');
				return null;
			}

			if (typeof targetNode.newPlaylist !== 'function') {
				console.error('createPlaylist: newPlaylist method not available on target node');
				return null;
			}

			console.log('createPlaylist: Calling targetNode.newPlaylist()');
			let playlist;
			try {
				playlist = targetNode.newPlaylist();
			} catch (newError) {
				console.error('createPlaylist: newPlaylist() threw:', newError);
				return null;
			}

			if (!playlist) {
				console.error('createPlaylist: newPlaylist() returned null/undefined');
				return null;
			}

			console.log('createPlaylist: Got playlist object, setting name');

			// MM5 playlists use .name property, NOT .title
			try {
				playlist.name = name;
				console.log('createPlaylist: Name set successfully via playlist.name');
			} catch (nameError) {
				console.error('createPlaylist: Error setting name:', nameError);
			}

			console.log('createPlaylist: Committing playlist');
			try {
				if (typeof playlist.commitAsync === 'function') {
					await playlist.commitAsync();
					console.log('createPlaylist: commitAsync completed');
				} else if (typeof playlist.commit === 'function') {
					playlist.commit();
					console.log('createPlaylist: commit completed');
				} else {
					console.log('createPlaylist: No commit method available');
				}
			} catch (commitError) {
				console.error('createPlaylist: Commit error:', commitError);
			}

			console.log('createPlaylist: Returning playlist object');
			return playlist;

		} catch (e) {
			console.error('createPlaylist error:', e);
			return null;
		}
	},
};
