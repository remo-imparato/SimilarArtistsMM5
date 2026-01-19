window.configInfo = {

	load: function (pnlDiv, addon) {

		// defaults matching similarArtists.js
		const defaults = {
			ApiKey: app?.utils?.web?.getAPIKey('lastfmApiKey') || '7fd988db0c4e9d8b12aed27d0a91a932' || '6cfe51c9bf7e77d6449e63ac0db2ac24',
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
		//UI.SAToolbar.controlClass.value = this.config.Toolbar;
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
		this.populateParentPlaylistDropdown(UI);

	},

	/**
	 * Populate the parent playlist dropdown with all available playlists.
	 * Uses MM5's dataSource pattern with app.utils.newStringList().
	 * @param {object} UI UI elements object from getAllUIElements
	 */
	populateParentPlaylistDropdown: function(UI) {
		try {
			const parentCtrl = UI.SAParent?.controlClass;
			if (!parentCtrl) {
				console.warn('SimilarArtists Config: SAParent control not found');
				return;
			}

			// Helper function to get all playlists
			const getPlaylistsList = () => {
				const allPlaylists = [];
				
				// Try multiple methods to get playlists
				if (app.playlists?.getAll && typeof app.playlists.getAll === 'function') {
					try {
						const pls = app.playlists.getAll();
						if (Array.isArray(pls)) {
							pls.forEach(p => { 
								if (p && (p.title || p.name)) {
									allPlaylists.push(p.title || p.name);
								}
							});
							console.log(`SimilarArtists Config: Retrieved ${allPlaylists.length} playlists via getAll`);
						}
					} catch (e) {
						console.warn('SimilarArtists Config: Error calling getAll():', e.toString());
					}
				} 
				// Fallback: try root playlists
				else if (app.playlists?.root?.playlists) {
					try {
						const rootPls = app.playlists.root.playlists;
						if (Array.isArray(rootPls)) {
							rootPls.forEach(p => {
								if (p && (p.title || p.name)) {
									allPlaylists.push(p.title || p.name);
								}
							});
							console.log(`SimilarArtists Config: Retrieved ${allPlaylists.length} playlists via root.playlists`);
						}
					} catch (e) {
						console.warn('SimilarArtists Config: Error accessing root.playlists:', e.toString());
					}
				}

				return allPlaylists;
			};

			// Helper function to populate dropdown using MM5's dataSource pattern
			const populateDropdown = (playlists) => {
				try {
					playlists.sort((a, b) => a.localeCompare(b));
					const items = ['[None]'].concat(playlists);

					// Create StringList dataSource (MM5 standard pattern) - use app.utils.newStringList()
					const stringListFactory = app.utils?.newStringList || window.newStringList;
					if (typeof stringListFactory === 'function') {
						const stringList = stringListFactory();
						items.forEach(item => stringList.add(item));
						
						// Set dataSource
						parentCtrl.dataSource = stringList;
						console.log(`SimilarArtists Config: Set dataSource with ${items.length} items`);

						// Set focused index to match stored parent
						const defaultParent = this.config?.Parent || 'Similar Artists Playlists';
						let selectedIndex = 0;

						const foundIndex = items.indexOf(defaultParent);
						if (foundIndex >= 0) {
							selectedIndex = foundIndex;
						}

						parentCtrl.focusedIndex = selectedIndex;
						console.log(`SimilarArtists Config: Set focusedIndex to ${selectedIndex} (${items[selectedIndex]})`);
					} else {
						console.error('SimilarArtists Config: newStringList() not available (checked app.utils.newStringList and window.newStringList)');
					}
				} catch (e) {
					console.error('SimilarArtists Config: Error populating dropdown:', e.toString());
				}
			};

			// Attempt to populate immediately
			let playlists = getPlaylistsList();
			
			if (playlists.length > 0) {
				// Got playlists immediately
				populateDropdown.call(this, playlists);
			} else {
				// No playlists yet, try again after a short delay
				console.log('SimilarArtists Config: No playlists found immediately, retrying...');
				setTimeout(() => {
					playlists = getPlaylistsList();
					if (playlists.length > 0) {
						populateDropdown.call(this, playlists);
					} else {
						console.warn('SimilarArtists Config: Still no playlists found after delay');
						// Set default items at minimum
						populateDropdown.call(this, []);
					}
				}, 500);
			}

		} catch (e) {
			console.error('SimilarArtists Config: Error populating parent playlist dropdown:', e.toString());
		}
	},

	save: function (pnlDiv, addon) {
		var UI = getAllUIElements(pnlDiv);

		//this.config.Toolbar = UI.SAToolbar.controlClass.value;
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

		// Get selected parent playlist from dropdown using MM5 pattern
		try {
			const parentCtrl = UI.SAParent?.controlClass;
			if (parentCtrl && parentCtrl.dataSource && typeof parentCtrl.focusedIndex !== 'undefined') {
				const ds = parentCtrl.dataSource;
				const idx = parentCtrl.focusedIndex;
				
				// Get the selected item from dataSource
				if (idx >= 0 && idx < ds.count) {
					const selectedItem = ds.getValue(idx);
					const selectedValue = selectedItem ? selectedItem.toString() : '';
					
					// Store empty string if [None] is selected, otherwise store the playlist name
					this.config.Parent = (selectedValue === '[None]') ? '' : selectedValue;
					console.log(`SimilarArtists Config save: Parent = "${this.config.Parent}" (index ${idx})`);
				} else {
					this.config.Parent = '';
					console.log('SimilarArtists Config save: No valid selection, Parent = ""');
				}
			} else {
				// Fallback if dataSource not available
				this.config.Parent = '';
				console.log('SimilarArtists Config save: dataSource not available, Parent = ""');
			}
		} catch (e) {
			console.error('SimilarArtists Config save: Error reading Parent:', e.toString());
			// If something fails, use default
			this.config.Parent = 'Similar Artists Playlists';
		}

		app.setValue('SimilarArtists', this.config);

	}
};