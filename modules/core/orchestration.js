/**
 * SimilarArtists Core Orchestration Logic
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

window.similarArtistsOrchestration = {
	/**
	 * Main orchestration function that runs the complete SimilarArtists workflow.
	 * 
	 * @param {object} modules - Injected module dependencies
	 * @param {boolean} [autoMode=false] - Whether running in auto-mode
	 * @param {string} [discoveryMode='artist'] - Discovery mode: 'artist', 'track', or 'genre'
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
		const strategies = window.similarArtistsDiscoveryStrategies;
		if (!strategies) {
			console.error('SimilarArtists: Discovery strategies module not loaded');
			showToast('Add-on error: Discovery strategies not loaded', 'error');
			return { success: false, error: 'Discovery strategies not loaded', tracksAdded: 0 };
		}

		let taskId = null;

		try {
			// Initialize progress tracking
			const modeName = strategies.getDiscoveryModeName(discoveryMode);
			taskId = createProgressTask(`Generating ${modeName} Playlist`);
			updateProgress('Initializing...', 0);

			// Validate environment
			if (typeof app === 'undefined' || !app.player) {
				throw new Error('MediaMonkey application not available');
			}

			// Load configuration
			const config_ = {
				seedLimit: autoMode ? 2 : intSetting('SeedLimit', 20),
				similarLimit: autoMode ? 15 : intSetting('SimilarLimit', 30),
				tracksPerArtist: autoMode ? 5 : intSetting('TPA', 30),
				totalLimit: autoMode ? 10 : intSetting('TPL', 1000),
				includeSeedArtist: boolSetting('Seed', false),
				rankEnabled: boolSetting('Rank', true),
				bestEnabled: boolSetting('Best', true),
				randomize: !autoMode && boolSetting('Random', true),
				showConfirm: !autoMode && boolSetting('Confirm', false),
				minRating: intSetting('Rating', 0),
				allowUnknown: boolSetting('Unknown', true),
				autoMode,
				discoveryMode,
			};

			console.log(`SimilarArtists: Starting ${modeName} (autoMode=${autoMode})`);

			// Step 1: Collect seed tracks
			updateProgress('Collecting seed tracks...', 0.05);
			const seeds = await this.collectSeedTracks(modules);

			if (!seeds || seeds.length === 0) {
				terminateProgressTask(taskId);
				showToast('No seed tracks found. Select tracks or play something first.', 'warning');
				return {
					success: false,
					error: 'No seed tracks found.',
					tracksAdded: 0,
				};
			}

			console.log(`SimilarArtists: Collected ${seeds.length} seed(s)`);
			updateProgress(`Found ${seeds.length} seed(s)`, 0.1);

			// Step 2: Run discovery strategy
			const discoveryFn = strategies.getDiscoveryStrategy(discoveryMode);
			let candidates;
			
			try {
				candidates = await discoveryFn(modules, seeds, config_);
			} catch (discoveryError) {
				console.error('Discovery error:', discoveryError);
				terminateProgressTask(taskId);
				showToast(`Discovery error: ${formatError(discoveryError)}`, 'error');
				return {
					success: false,
					error: formatError(discoveryError),
					tracksAdded: 0,
				};
			}

			if (!candidates || candidates.length === 0) {
				terminateProgressTask(taskId);
				showToast(`No ${modeName.toLowerCase()} found. Try different seeds.`, 'info');
				return {
					success: false,
					error: `No ${modeName.toLowerCase()} found.`,
					tracksAdded: 0,
				};
			}

			console.log(`SimilarArtists: Discovery returned ${candidates.length} candidates`);

			// Step 3: Match candidates to local library
			updateProgress('Searching local library...', 0.6);
			let results;
			
			try {
				results = await this.matchCandidatesToLibrary(modules, candidates, config_);
			} catch (matchError) {
				console.error('Library matching error:', matchError);
				terminateProgressTask(taskId);
				showToast(`Library error: ${formatError(matchError)}`, 'error');
				return {
					success: false,
					error: formatError(matchError),
					tracksAdded: 0,
				};
			}

			if (!results || results.length === 0) {
				terminateProgressTask(taskId);
				showToast('No matching tracks in your library. Try different seeds or filters.', 'info');
				return {
					success: false,
					error: 'No matching tracks found in your library.',
					tracksAdded: 0,
				};
			}

			console.log(`SimilarArtists: Found ${results.length} matching tracks in library`);
			updateProgress(`Found ${results.length} matching tracks`, 0.8);

			// Step 4: Apply randomization if enabled
			if (config_.randomize) {
				updateProgress('Randomizing results...', 0.85);
				shuffleUtil(results);
			}

			// Limit to totalLimit
			const finalResults = results.slice(0, config_.totalLimit);

			// Step 5: Choose output method
			updateProgress('Preparing output...', 0.9);

			const enqueueEnabled = boolSetting('Enqueue', false);
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
				console.error('Output error:', outputError);
				terminateProgressTask(taskId);
				showToast(`Output error: ${formatError(outputError)}`, 'error');
				return {
					success: false,
					error: formatError(outputError),
					tracksAdded: 0,
				};
			}

			updateProgress('Complete!', 1.0);
			terminateProgressTask(taskId);

			showToast(`Added ${finalResults.length} tracks (${modeName})`);

			return {
				success: true,
				tracksAdded: finalResults.length,
				tracks: finalResults,
				output,
				discoveryMode,
			};

		} catch (e) {
			console.error('generateSimilarPlaylist error:', e);
			if (taskId) {
				try { terminateProgressTask(taskId); } catch (_) {}
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
	 */
	async collectSeedTracks(modules) {
		const { utils: { normalization } } = modules;
		const { splitArtists } = normalization;

		const seeds = [];
		const seenArtists = new Set();

		const addArtistIfNew = (artistName, track) => {
			if (!artistName) return;
			const normalizedName = String(artistName).trim().toUpperCase();
			if (normalizedName && !seenArtists.has(normalizedName)) {
				seenArtists.add(normalizedName);
				seeds.push({ name: artistName, track: track });
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
							// MM5 uses 'artist' property (lowercase)
							const artist = tmp?.artist || tmp?.Artist;
							if (artist) {
								for (const a of splitArtists(artist)) {
									addArtistIfNew(a, tmp);
								}
							}
						}
					});
				}

				if (seeds.length > 0) {
					console.log(`collectSeedTracks: Using ${seeds.length} selected artist(s)`);
					return seeds;
				}
			} catch (e) {
				console.error('collectSeedTracks: Error iterating selection: ' + e.toString());
			}
		}

		// Fallback: use currently playing track
		try {
			const currentTrack = app.player?.getCurrentTrack?.();
			const artist = currentTrack?.artist || currentTrack?.Artist;
			if (artist) {
				for (const a of splitArtists(artist)) {
					addArtistIfNew(a, currentTrack);
				}
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
		const addTrack = (track) => {
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

		for (let i = 0; i < totalCandidates; i++) {
			// Early exit if we have enough
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
						Math.min(config.tracksPerArtist * 2, config.totalLimit * 2), // Get more to account for deduplication
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
					// Search for specific tracks
					const matchMap = await findLibraryTracksBatch(
						candidate.artist,
						trackTitles,
						Math.min(config.tracksPerArtist * 2, config.totalLimit * 2), // Get more to account for deduplication
						queryOptions
					);

					if (matchMap && matchMap.size > 0) {
						// Add matched tracks (maintain order from Last.fm for ranking)
						for (const title of trackTitles) {
							const matches = matchMap.get(title);
							if (matches && matches.length > 0) {
								for (const track of matches) {
									addTrack(track);
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

		console.log(`matchCandidatesToLibrary: Found ${allTracks.length} unique tracks (after deduplication)`);
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
			const template = stringSetting('Name', '- Similar to %');
			const overwriteMode = stringSetting('Overwrite', 'Create new playlist');
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

			// Find or create playlist
			if (!targetPlaylist) {
				const shouldOverwrite = overwriteMode.toLowerCase().indexOf('overwrite') > -1;
				console.log(`buildResultsPlaylist: shouldOverwrite=${shouldOverwrite}`);

				if (shouldOverwrite) {
					console.log('buildResultsPlaylist: Looking for existing playlist to overwrite');
					try {
						targetPlaylist = await this.findPlaylist(playlistName);
					} catch (findError) {
						console.error('buildResultsPlaylist: Find error:', findError);
					}
				}

				if (!targetPlaylist) {
					if (!shouldOverwrite) {
						// Find unique name
						console.log('buildResultsPlaylist: Finding unique name');
						let idx = 1;
						let testName = playlistName;
						try {
							while (await this.findPlaylist(testName)) {
								idx++;
								testName = `${playlistName}_${idx}`;
								if (idx > 100) break;
							}
							playlistName = testName;
						} catch (uniqueError) {
							console.error('buildResultsPlaylist: Unique name error:', uniqueError);
						}
					}

					console.log(`buildResultsPlaylist: Creating new playlist "${playlistName}"`);
					try {
						targetPlaylist = await this.createPlaylist(playlistName);
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
			const shouldClear = stringSetting('Overwrite', '').toLowerCase().indexOf('overwrite') > -1;
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
			const navigate = stringSetting('Navigate', 'None');
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

			// Get playlist info safely - fix typo: was "playlist" should be "targetPlaylist"
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

			return { added: list.count, cleared: clearNP };

		} catch (e) {
			console.error('queueResults error: ' + e.toString());
			throw e;
		}
	},

	/**
	 * Build playlist seed name from seeds array.
	 */
	buildPlaylistSeedName(seeds) {
		if (!Array.isArray(seeds) || seeds.length === 0) return 'Similar';

		const names = [];
		const seen = new Set();

		for (const s of seeds) {
			const raw = (typeof s === 'string') ? s : (s?.name || '');
			const name = String(raw || '').trim();
			if (!name) continue;
			const key = name.toUpperCase();
			if (seen.has(key)) continue;
			seen.add(key);
			names.push(name);
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

				dlg.whenClosed = function() {
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
	 * Create new playlist.
	 */
	async createPlaylist(name) {
		console.log(`createPlaylist: Creating playlist "${name}"`);
		
		try {
			if (typeof app === 'undefined') {
				console.error('createPlaylist: app not available');
				return null;
			}
			
			if (!app.playlists) {
				console.error('createPlaylist: app.playlists not available');
				return null;
			}

			const root = app.playlists.root;
			if (!root) {
				console.error('createPlaylist: app.playlists.root not available');
				return null;
			}

			if (typeof root.newPlaylist !== 'function') {
				console.error('createPlaylist: newPlaylist method not available');
				return null;
			}

			console.log('createPlaylist: Calling root.newPlaylist()');
			let playlist;
			try {
				playlist = root.newPlaylist();
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
