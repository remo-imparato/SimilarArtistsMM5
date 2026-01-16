/*
// actions_add.js
// Put actions under the 'addons' category so they show up consistently.
if (!window.actionCategories.hasOwnProperty('addons')) {
	window.actionCategories.addons = () => _('Addons');
}

window.actions = window.actions || {};
*/
window.actions['SimilarArtists.run'] = {
	title: () => _('&Similar Artists'),
	icon: 'script',
	hotkeyAble: true,
	visible: true,
	disabled: false,
	execute: () => window.SimilarArtists?.runSimilarArtists(false)
};

window.actions['SimilarArtists.toggleAuto'] = {
	title: () => _('Similar Artists: &Auto On/Off'),
	icon: 'script',
	hotkeyAble: true,
	checkable: true,
	visible: true,
	disabled: false,
	execute: () => window.SimilarArtists?.toggleAuto()
};

window._menuItems.tools.action.submenu.push({
	action: SimilarArtists.run,
	order: 40,
	grouporder: 10,
});

window._menuItems.tools.action.submenu.push({
	action: SimilarArtists.toggleAuto,
	order: 50,
	grouporder: 10,
});