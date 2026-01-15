// init.js
 // Load your local module(s) first
  localRequirejs('js/similarArtists'); // -> window.SimilarArtists
 
  (function () {
  
  window.whenReady(() => {
    // Initialize defaults
    window.SimilarArtists?.ensureDefaults?.();

    // --- Add menu entries under Tools pointing to your actions ---
    // Pattern 1: use app.menu.tools if available (newer builds)
    if (app?.menu?.tools?.addItem) {
      app.menu.tools.addItem({ id: 'SimilarArtists.menu.run',  title: _('Similar &Artists'), action: 'SimilarArtists.run' });
      app.menu.tools.addItem({ id: 'SimilarArtists.menu.auto', title: _('Similar Artists (&Auto On/Off)'), action: 'SimilarArtists.toggleAuto' });
    } else {
      // Pattern 2: fallback - extend existing menu model (older builds / compatibility)
      // See your original code’s alternative branches; reuse if needed.
      // e.g., menuItems.add({ id, title, action, menuId: 'tools' });
    }

    // (Optional) register the Options sheet if you split it out
    // window.SimilarArtistsSettings?.registerSettingsSheet?.();
  });
})();
