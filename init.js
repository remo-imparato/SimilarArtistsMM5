// init.js
// Load your local module(s) first
localRequirejs('js/similarArtists'); // -> window.SimilarArtists

(function () {

	window.whenReady(() => {

		// Initialize defaults
		window.SimilarArtists?.ensureDefaults?.();

		//TODO: Remove this line once development is done
		//app.enabledDeveloperMode(true)

		// --- Add menu entries under Tools pointing to your actions ---
		// Pattern 1: use app.menu.tools if available (newer builds)
		if (app?.menu?.tools?.addItem) {
			app.menu.tools.addItem({ id: 'SimilarArtists.menu.run', title: _('Similar &Artists'), action: 'SimilarArtists.run' });
			app.menu.tools.addItem({ id: 'SimilarArtists.menu.auto', title: _('Similar Artists (&Auto On/Off)'), action: 'SimilarArtists.toggleAuto' });
		} else {
			// Fallback: Add menu items to window._menuItems.tools
			if (window._menuItems?.tools?.action?.submenu) {
				// Add "Similar Artists" menu item
				window._menuItems.tools.action.submenu.push({
					action: {
						title: _('Similar &Artists'),
						icon: 'script', // Use an appropriate icon
						identifier: 'SimilarArtists.run',
						hotkeyAble: true,
					},
					order: 40, // Adjust order as needed
					grouporder: 10,
				});

				// Add "Similar Artists (Auto On/Off)" menu item
				window._menuItems.tools.action.submenu.push({
					action: {
						title: _('Similar Artists (&Auto On/Off)'),
						icon: 'script', // Use an appropriate icon
						identifier: 'SimilarArtists.toggleAuto',
						hotkeyAble: true,
						checkable: true,
					},
					order: 50, // Adjust order as needed
					grouporder: 10,
				});
			} else {
				console.error('window._menuItems.tools.action.submenu is not available.');
			}
		}

		console.log('app.ui', app?.ui);
		console.log('window.actions', window.actions);
		console.log('window._menuItems', window._menuItems);
		// (Optional) register the Options sheet if you split it out
		// window.SimilarArtistsSettings?.registerSettingsSheet?.();

		window.SimilarArtists?.start();
	});
})();
