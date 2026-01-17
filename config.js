window.configInfo = {

	load: function (pnlDiv, addon) {
		requirejs('helpers/debugTools');
		registerDebuggerEntryPoint.call(this, 'start');

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
		try {
			const parentCtrl = UI.SAParent?.controlClass;
			if (parentCtrl) {
				const allPlaylists = [];
				
				// Get all available playlists
				if (app.playlists?.getAll) {
					const pls = app.playlists.getAll();
					if (Array.isArray(pls)) {
						pls.forEach(p => { 
							if (p && p.title) {
								allPlaylists.push(p.title);
							}
						});
					}
				}

				allPlaylists.sort((a, b) => a.localeCompare(b));

				// Build items: [None] + playlists
				const items = ['[None]'].concat(allPlaylists);

				// Set items on control
				if (typeof parentCtrl.setItems === 'function') {
					parentCtrl.setItems(items);
				} else if (parentCtrl.items && Array.isArray(parentCtrl.items)) {
					parentCtrl.items = items;
				}

				// Set selected value (default to 'Similar Artists Playlists' if it exists)
				const defaultParent = this.config.Parent || 'Similar Artists Playlists';
				let selectedIndex = 0;

				if (items.indexOf(defaultParent) >= 0) {
					selectedIndex = items.indexOf(defaultParent);
				}

				if (typeof parentCtrl.selectedIndex !== 'undefined') {
					parentCtrl.selectedIndex = selectedIndex;
				}
			}
		} catch (e) {
			// Silently fail if dropdown population doesn't work
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

		// Get selected parent playlist from dropdown
		try {
			const parentCtrl = UI.SAParent?.controlClass;
			if (parentCtrl) {
				if (parentCtrl.items && typeof parentCtrl.selectedIndex !== 'undefined') {
					const selectedItem = parentCtrl.items[parentCtrl.selectedIndex];
					// Store empty string if [None] is selected, otherwise store the playlist name
					this.config.Parent = (selectedItem === '[None]') ? '' : (selectedItem || 'Similar Artists Playlists');
				} else {
					// Fallback
					this.config.Parent = parentCtrl.value || 'Similar Artists Playlists';
				}
			}
		} catch (e) {
			// If something fails, use default
			this.config.Parent = 'Similar Artists Playlists';
		}

		app.setValue('SimilarArtists', this.config);

	}
};