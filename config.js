/**
 * SimilarArtists Configuration for MediaMonkey 5
 * 
 * @author Remo Imparato
 * @description Configuration handler for SimilarArtists add-on
 */

window.configInfo = {

	log: function(txt) {
		try { console.log('SimilarArtists Config: ' + txt); } catch (e) {}
	},

	load: function (pnlDiv, addon) {

		// defaults matching similarArtists.js
		const defaults = {
			ApiKey: app?.utils?.web?.getAPIKey('lastfmApiKey') || '7fd988db0c4e9d8b12aed27d0a91a932',
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
			Overwrite: 'Create new playlist',
			Enqueue: false,
			Navigate: 'None',
			OnPlay: false,
			ClearNP: false,
			Ignore: false,
			Parent: 'Similar Artists Playlists',
			Black: '',
			Exclude: '',
			Genre: '',
		};

		this.config = app.getValue('SimilarArtists', defaults);

		var UI = getAllUIElements(pnlDiv);
		UI.SAApiKey.controlClass.value = this.config.ApiKey;
		UI.SAConfirm.controlClass.checked = this.config.Confirm;
		UI.SASort.controlClass.checked = this.config.Sort;
		UI.SALimit.controlClass.value = this.config.Limit;
		UI.SAName.controlClass.value = this.config.Name;
		UI.SATPA.controlClass.value = this.config.TPA;
		UI.SATPL.controlClass.value = this.config.TPL;
		UI.SARandom.controlClass.checked = this.config.Random;
		UI.SASeed.controlClass.checked = this.config.Seed;
		UI.SASeed2.controlClass.checked = this.config.Seed2;
		UI.SABest.controlClass.checked = this.config.Best;
		UI.SARank.controlClass.checked = this.config.Rank;
		UI.SARating.controlClass.value = this.config.Rating;
		UI.SAUnknown.controlClass.checked = this.config.Unknown;
		UI.SAOverwrite.controlClass.value = this.config.Overwrite;
		UI.SAEnqueue.controlClass.checked = this.config.Enqueue;
		UI.SANavigate.controlClass.value = this.config.Navigate;
		UI.SAOnPlay.controlClass.checked = this.config.OnPlay;
		UI.SAClearNP.controlClass.checked = this.config.ClearNP;
		UI.SAIgnore.controlClass.checked = this.config.Ignore;
		UI.SABlack.controlClass.value = this.config.Black;
		UI.SAExclude.controlClass.value = this.config.Exclude;
		UI.SAGenre.controlClass.value = this.config.Genre;

		// Populate parent playlist dropdown dynamically
		this.populateParentPlaylistDropdown(UI, this.config.Parent || 'Similar Artists Playlists');
	},

	/**
	 * Recursively collect all manual (non-auto) playlists from the playlist tree.
	 * @param {object} node Playlist node to process
	 * @param {string[]} results Array to collect playlist names
	 * @param {string} prefix Path prefix for nested playlists (optional)
	 * @param {number} depth Current recursion depth (to prevent infinite loops)
	 */
	collectManualPlaylists: function(node, results, prefix = '', depth = 0) {
		if (!node || depth > 10) return; // Prevent infinite recursion

		const _this = this;

		try {
			// Get child playlists using MM5 childPlaylists property
			const children = node.childPlaylists;
			
			if (!children) {
				this.log(`collectManualPlaylists: No childPlaylists at depth ${depth}`);
				return;
			}

			// Get count - it's a property in MM5, not a function
			const count = typeof children.count === 'function' ? children.count() : children.count;
			this.log(`collectManualPlaylists: Found ${count} children at depth ${depth}, prefix="${prefix}"`);

			if (!count || count <= 0) return;

			// Use forEach which is the safest pattern for iteration in MM5
			// Avoid locked() as it can cause "Read lock not acquired" errors
			if (typeof children.forEach === 'function') {
				children.forEach((child) => {
					if (child) {
						_this.processPlaylistNode(child, results, prefix, depth);
					}
				});
			} else {
				// Manual iteration fallback using getValue
				for (let i = 0; i < count; i++) {
					try {
						const child = children.getValue ? children.getValue(i) : children[i];
						if (child) {
							_this.processPlaylistNode(child, results, prefix, depth);
						}
					} catch (e) {
						_this.log(`Error getting child at index ${i}: ${e.toString()}`);
					}
				}
			}
		} catch (e) {
			this.log('Error collecting playlists: ' + e.toString());
		}
	},

	/**
	 * Process a single playlist node - add if manual, recurse for children
	 * @param {object} playlist Playlist object
	 * @param {string[]} results Array to collect playlist names
	 * @param {string} prefix Path prefix for nested playlists
	 * @param {number} depth Current recursion depth
	 */
	processPlaylistNode: function(playlist, results, prefix, depth) {
		if (!playlist) return;

		try {
			const name = playlist.title || playlist.name;
			if (!name) return;

			// Check if this is a manual playlist (not auto-playlist)
			// In MM5, auto playlists have isAutoPlaylist property
			const isAuto = playlist.isAutoPlaylist === true;

			if (!isAuto) {
				// This is a manual playlist - add it with just the name (not nested path for simplicity)
				results.push(name);
				this.log(`Found manual playlist: "${name}" (isAuto=${isAuto})`);
			} else {
				this.log(`Skipping auto playlist: "${name}"`);
			}

			// Recurse into child playlists
			this.collectManualPlaylists(playlist, results, name, depth + 1);

		} catch (e) {
			this.log('Error processing playlist node: ' + e.toString());
		}
	},

	/**
	 * Populate the parent playlist dropdown with all available manual playlists.
	 * Uses MM5's dataSource pattern with app.utils.newStringList().
	 * @param {object} UI UI elements object from getAllUIElements
	 * @param {string} storedParent The currently stored parent playlist name
	 */
	populateParentPlaylistDropdown: function(UI, storedParent) {
		const _this = this;
		
		try {
			const parentCtrl = UI.SAParent?.controlClass;
			if (!parentCtrl) {
				this.log('SAParent control not found');
				return;
			}

			// Helper function to get all manual playlists using recursive traversal
			const getPlaylistsList = () => {
				const allPlaylists = [];
				
				_this.log('Starting playlist enumeration...');

				// Use app.playlists.root as the starting point (MM5 standard)
				if (app.playlists?.root) {
					_this.log('Using app.playlists.root');
					_this.collectManualPlaylists(app.playlists.root, allPlaylists, '', 0);
				} else {
					_this.log('app.playlists.root not available');
				}

				_this.log(`Found ${allPlaylists.length} manual playlist(s)`);
				return allPlaylists;
			};

			// Helper function to populate dropdown using MM5's dataSource pattern
			const populateDropdown = (playlists) => {
				try {
					// Remove duplicates and sort
					const uniquePlaylists = [...new Set(playlists)];
					uniquePlaylists.sort((a, b) => a.localeCompare(b));
					const items = ['[None]'].concat(uniquePlaylists);

					_this.log('Populating dropdown with ' + items.length + ' items');

					// Create StringList dataSource (MM5 standard pattern)
					const stringListFactory = app.utils?.newStringList || window.newStringList;
					if (typeof stringListFactory === 'function') {
						const stringList = stringListFactory();
						items.forEach(item => stringList.add(item));
						
						// Set dataSource
						parentCtrl.dataSource = stringList;

						// Set focused index to match stored parent
						const defaultParent = storedParent || 'Similar Artists Playlists';
						const foundIndex = items.indexOf(defaultParent);
						parentCtrl.focusedIndex = foundIndex >= 0 ? foundIndex : 0;

						_this.log(`Set focusedIndex to ${parentCtrl.focusedIndex} (${items[parentCtrl.focusedIndex]})`);
					} else {
						_this.log('newStringList() not available');
					}
				} catch (e) {
					_this.log('Error populating dropdown: ' + e.toString());
				}
			};

			// Attempt to populate immediately
			let playlists = getPlaylistsList();
			
			if (playlists.length > 0) {
				// Got playlists immediately
				populateDropdown(playlists);
			} else {
				// No playlists yet, try again after a short delay (playlists may not be loaded yet)
				this.log('No playlists found immediately, retrying in 1s...');
				setTimeout(() => {
					playlists = getPlaylistsList();
					populateDropdown(playlists);
				}, 1000);
			}

		} catch (e) {
			this.log('Error populating parent playlist dropdown: ' + e.toString());
		}
	},

	save: function (pnlDiv, addon) {
		var UI = getAllUIElements(pnlDiv);

		this.config.ApiKey = UI.SAApiKey.controlClass.value;
		this.config.Confirm = UI.SAConfirm.controlClass.checked;
		this.config.Sort = UI.SASort.controlClass.checked;
		this.config.Limit = UI.SALimit.controlClass.value;
		this.config.Name = UI.SAName.controlClass.value;
		this.config.TPA = UI.SATPA.controlClass.value;
		this.config.TPL = UI.SATPL.controlClass.value;
		this.config.Random = UI.SARandom.controlClass.checked;
		this.config.Seed = UI.SASeed.controlClass.checked;
		this.config.Seed2 = UI.SASeed2.controlClass.checked;
		this.config.Best = UI.SABest.controlClass.checked;
		this.config.Rank = UI.SARank.controlClass.checked;
		this.config.Rating = UI.SARating.controlClass.value;
		this.config.Unknown = UI.SAUnknown.controlClass.checked;
		this.config.Overwrite = UI.SAOverwrite.controlClass.value;
		this.config.Enqueue = UI.SAEnqueue.controlClass.checked;
		this.config.Navigate = UI.SANavigate.controlClass.value;
		this.config.OnPlay = UI.SAOnPlay.controlClass.checked;
		this.config.ClearNP = UI.SAClearNP.controlClass.checked;
		this.config.Ignore = UI.SAIgnore.controlClass.checked;
		this.config.Black = UI.SABlack.controlClass.value;
		this.config.Exclude = UI.SAExclude.controlClass.value;
		this.config.Genre = UI.SAGenre.controlClass.value;

		// Get selected parent playlist from dropdown
		try {
			const parentCtrl = UI.SAParent?.controlClass;
			if (parentCtrl) {
				// Try to get value directly first (simplest approach)
				let selectedValue = '';
				
				if (parentCtrl.value !== undefined && parentCtrl.value !== null) {
					selectedValue = String(parentCtrl.value);
				} else if (parentCtrl.dataSource && typeof parentCtrl.focusedIndex !== 'undefined') {
					// Use dataSource + focusedIndex as fallback
					const ds = parentCtrl.dataSource;
					const idx = parentCtrl.focusedIndex;
					const count = typeof ds.count === 'function' ? ds.count() : ds.count;
					
					if (idx >= 0 && idx < count) {
						// Use forEach to safely get the item at index
						let found = false;
						let currentIdx = 0;
						if (typeof ds.forEach === 'function') {
							ds.forEach((item) => {
								if (currentIdx === idx && !found) {
									selectedValue = item ? item.toString() : '';
									found = true;
								}
								currentIdx++;
							});
						} else if (typeof ds.getValue === 'function') {
							try {
								const item = ds.getValue(idx);
								selectedValue = item ? item.toString() : '';
							} catch (e) {
								this.log('save: Error getting value from dataSource: ' + e.toString());
							}
						}
					}
				}
				
				// Store empty string if [None] is selected, otherwise store the playlist name
				this.config.Parent = (selectedValue === '[None]' || !selectedValue) ? '' : selectedValue;
				this.log(`save: Parent playlist = "${this.config.Parent}"`);
			} else {
				this.config.Parent = '';
				this.log('save: Parent control not found, Parent = ""');
			}
		} catch (e) {
			this.log('save: Error reading Parent playlist: ' + e.toString());
			this.config.Parent = '';
		}

		app.setValue('SimilarArtists', this.config);
	}
};