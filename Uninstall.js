'use strict';

const SCRIPT_ID = 'SimilarArtists';
const keys = [
  'Toolbar','Confirm','Sort','Limit','Name','TPA','TPL','Random','Seed','Seed2','Best','Rank','Rating','Unknown','Overwrite','Enqueue','Navigate','OnPlay','ClearNP','Ignore','Parent','Black','Exclude','Genre','OnIconIndex','OffIconIndex'
];

(function uninstall() {
  if (typeof app === 'undefined') {
    return;
  }

  // disable auto-run immediately
  try {
    if (app.setValue) {
      app.setValue(SCRIPT_ID, 'OnPlay', false);
    }
  } catch (e) {
    /* ignore */
  }

  // remove UI artifacts
  try {
    if (app.toolbar?.removeButton) {
      app.toolbar.removeButton('sa-run');
      app.toolbar.removeButton('sa-auto');
    }
  } catch (e) {
    /* ignore */
  }

  try {
    if (app.actions?.removeAction) {
      app.actions.removeAction(SCRIPT_ID + '.run');
      app.actions.removeAction(SCRIPT_ID + '.toggleAuto');
    }
  } catch (e) {
    /* ignore */
  }

  try {
    if (app.menu?.tools?.removeItem) {
      app.menu.tools.removeItem(SCRIPT_ID + '.run');
      app.menu.tools.removeItem(SCRIPT_ID + '.toggleAuto');
    }
  } catch (e) {
    /* ignore */
  }

  // clear stored settings
  keys.forEach((k) => {
    try {
      if (app.deleteValue) {
        app.deleteValue(SCRIPT_ID, k);
      } else if (app.setValue) {
        app.setValue(SCRIPT_ID, k, null);
      }
    } catch (e) {
      /* ignore */
    }
  });
})();
