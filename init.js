// init.js
// Load your local module(s) first
localRequirejs('js/similarArtists'); // -> window.SimilarArtists
requirejs('actions');

(function () {

	window.whenReady(() => {

		// Initialize defaults
		window.SimilarArtists?.ensureDefaults?.();
		/*
		// --- Add menu entries under Tools pointing to your actions ---
		// MM5 add-ons typically extend menus via window._menuItems and actions via actions_add.js (window.actions)
		if (window._menuItems?.tools?.action?.submenu) {
			window._menuItems.tools.action.submenu.push({
				action: {
					title: _('Similar &Artists'),
					icon: 'script',
					action: SimilarArtists.run,
					hotkeyAble: true,
					visible: true,
					disabled: false,
				},
				order: 40,
				grouporder: 10,
			});

			window._menuItems.tools.action.submenu.push({
				action: {
					title: _('Similar Artists (&Auto On/Off)'),
					icon: 'script',
					action: SimilarArtists.toggleAuto,
					hotkeyAble: true,
					checkable: true,
					visible: true,
					disabled: false,
				},
				order: 50,
				grouporder: 10,
			});
		} else {
			console.error('window._menuItems.tools.action.submenu is not available.');
		}
		*/
		window.SimilarArtists?.start();
	});
})();
