
// actions_add.js
// Put actions under the 'addons' category so they show up consistently.
if (!window.actionCategories.hasOwnProperty('addons')) {
  window.actionCategories.addons = () => _('Addons');
}

window.actions = window.actions || {};

window.actions['SimilarArtists.run'] = {
  title:      () => _('&Similar Artists'),
  category:   'addons',
  hotkeyAble: true,
  execute:    () => window.SimilarArtists?.runSimilarArtists(false)
};

window.actions['SimilarArtists.toggleAuto'] = {
  title:      () => _('Similar Artists: &Auto On/Off'),
  category:   'addons',
  hotkeyAble: true,
  execute:    () => window.SimilarArtists?.toggleAuto()
};
