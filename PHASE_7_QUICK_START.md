# Phase 7: Quick Start Guide

## What is Phase 7?

**Phase 7: MM5 Integration** connects all the refactored modules (Phases 1-6) to MediaMonkey 5's UI system.

It provides:
- Action handler definitions
- Menu integration
- Toolbar button support
- Settings listener
- UI state management

## Core Concept

```
User interacts with MM5 UI
    ?
Action handler triggered
    ?
Callback invoked
    ?
Module called
    ?
Work completed
    ?
UI updated
```

## Three Main Files

### 1. MM5 Integration Module
**File:** `modules/core/mm5Integration.js`

Bridges MM5 APIs with refactored modules:

```javascript
// Create action handlers
const actions = mm5Integration.createActionHandlers({
  onRunSimilarArtists,
  onToggleAuto,
  isAutoEnabled,
});

// Register with MM5
mm5Integration.registerActions(actions);
mm5Integration.registerToolsMenu(actions);

// Listen for changes
mm5Integration.listenSettingsChanges(onSettingChanged);

// Update UI
mm5Integration.updateToolbarIcon(buttonId, enabled);
mm5Integration.updateActionState(actionName);
```

### 2. Main Add-on Entry Point
**File:** `similarArtists-MM5Integration.js`

Complete add-on implementation:

```javascript
window.SimilarArtists = {
  start(),                      // Initialize
  shutdown(),                   // Cleanup
  runSimilarArtists(autoMode),  // Run workflow
  toggleAuto(),                 // Toggle auto
  isAutoEnabled(),              // Check state
  getState(),                   // Get current state
}
```

### 3. Action Handlers
**File:** `actions_add_Phase7.js`

MM5 action definitions:

```javascript
window.actions.SimilarArtistsRun = {
  title, icon, execute, ...
}

window.actions.SimilarArtistsToggleAuto = {
  title, icon, checked, execute, ...
}
```

## Startup Flow

```
1. MM5 loads add-on
   ?
2. similarArtists-MM5Integration.js evaluated
   ?
3. window.SimilarArtists object created
   ?
4. MM5 calls start()
   ?
5. Check MM5 APIs available
   ?
6. Register actions
   ?
7. Register menu items
   ?
8. Listen for settings changes
   ?
9. Initialize auto-mode
   ?
10. Ready for user interaction
```

## Common Tasks

### Initialize Add-on
```javascript
// Automatically called by MM5
window.SimilarArtists.start();
```

### Run Similar Artists
```javascript
// From menu/toolbar/hotkey
window.SimilarArtists.runSimilarArtists(false);
// false = user-initiated (not auto-mode)
```

### Toggle Auto-Mode
```javascript
// From toggle action
window.SimilarArtists.toggleAuto();
```

### Check Auto-Mode Status
```javascript
const enabled = window.SimilarArtists.isAutoEnabled();
```

### Get Current State
```javascript
const state = window.SimilarArtists.getState();
// {
//   started: true,
//   autoModeEnabled: true
// }
```

### Update Toolbar Icon
```javascript
mm5Integration.updateToolbarIcon('SimilarArtistsToggle', enabled);
// Icon 32 = enabled (highlighted)
// Icon 33 = disabled (grayed)
```

## Action Handler Flow

### User Clicks "Similar Artists"

```
User clicks menu item/button
    ?
MM5 triggers action
    ?
actions_add_Phase7.js execute()
    ?
Call window.SimilarArtists.runSimilarArtists(false)
    ?
Call Phase 5 orchestration
    ?
Similar artists workflow runs
    ?
Completion notification shown
```

### User Toggles Auto-Mode

```
User clicks toggle
    ?
MM5 triggers action
    ?
actions_add_Phase7.js execute()
    ?
Call window.SimilarArtists.toggleAuto()
    ?
Call Phase 6 toggle
    ?
Setting updated
    ?
Listener synced
    ?
UI updated
    ?
Checkbox state changes
```

## MM5 Integration Points

### Actions Registry
```javascript
window.actions.SimilarArtistsRun
window.actions.SimilarArtistsToggleAuto
```

### Menu Items
```javascript
window._menuItems.tools.action.submenu
```

### Event Listeners
```javascript
app.listen(player, 'playbackState', ...)  // Auto-mode
app.listen(app, 'settingsChange', ...)     // Settings
```

### Player API
```javascript
app.player.entriesCount
app.player.getCountOfPlayedEntries()
app.player.addTracksAsync()
```

## Configuration

Phase 7 uses settings from Phase 2:

| Setting | Purpose |
|---------|---------|
| OnPlay | Auto-mode enabled |
| ShowConfirm | Skip confirmation |
| Enqueue | Queue mode |

All automatically applied by Phase 5 when orchestration runs.

## Error Handling

All functions handle errors gracefully:

```javascript
try {
  // Operation
} catch (e) {
  console.error(`MM5: Error: ${e.toString()}`);
  // Fail gracefully - don't crash MM5
}
```

## Logging

Enable debug logging by calling:

```javascript
// In console:
window.SimilarArtists.getState()
// Returns current state

// Check logs:
// Look in browser console for "SimilarArtists:" prefixed messages
```

## Testing Scenarios

### Test 1: Run Similar Artists
1. Select a track
2. Click Tools ? Similar Artists
3. Verify workflow runs
4. Verify tracks added

### Test 2: Toggle Auto-Mode
1. Click Tools ? Similar Artists: Auto On/Off
2. Verify checkbox toggles
3. Verify setting saved
4. Refresh MM5
5. Verify setting persists

### Test 3: Auto-Queue
1. Enable auto-mode
2. Create playlist with 5 tracks
3. Play until 2 tracks remain
4. Verify auto-queue triggers
5. Verify ~10 tracks added

### Test 4: Toolbar Button
1. Add button to toolbar
2. Verify icon shows enabled/disabled
3. Click button
4. Verify similar artists runs
5. Toggle auto-mode
6. Verify icon changes

### Test 5: Settings Persistence
1. Enable auto-mode
2. Close and reopen MM5
3. Verify auto-mode still enabled
4. Disable auto-mode
5. Close and reopen MM5
6. Verify auto-mode still disabled

## Integration with Modules

Phase 7 coordinates:

- **Phase 1 (Config):** UI IDs and constants
- **Phase 2 (Settings):** OnPlay, ShowConfirm, Enqueue
- **Phase 3 (Notifications):** showToast() for feedback
- **Phase 4 (Database):** Query engine (called by Phase 5)
- **Phase 5 (Orchestration):** Main workflow
- **Phase 6 (Auto-Mode):** Playback listening

All coordinated through unified modules/index.js export.

## File Structure

```
modules/
??? core/
?   ??? autoMode.js               Phase 6
?   ??? mm5Integration.js         Phase 7 ? NEW
?   ??? orchestration.js          Phase 5
??? settings/
??? ui/
??? api/
??? db/
??? utils/

similarArtists-MM5Integration.js    Phase 7 ? NEW
actions_add_Phase7.js              Phase 7 ? NEW (replaces actions_add.js)
```

## Deployment Checklist

- [ ] `mm5Integration.js` created in modules/core/
- [ ] `similarArtists-MM5Integration.js` created
- [ ] `actions_add_Phase7.js` created
- [ ] modules/index.js updated with mm5Integration export
- [ ] Old actions_add.js removed (or not loaded)
- [ ] Start sequence verified
- [ ] Actions appear in menu
- [ ] Auto-mode works
- [ ] Toolbar button responsive
- [ ] Settings persist

## Quick Debug

### Check if Started
```javascript
window.SimilarArtists?.isStarted?.()
// Returns: true/false
```

### Check Module State
```javascript
window.SimilarArtists?.getState?.()
// Returns: {started, autoModeEnabled}
```

### Check if Auto-Enabled
```javascript
window.SimilarArtists?.isAutoEnabled?.()
// Returns: true/false
```

### Manual Run
```javascript
window.SimilarArtists?.runSimilarArtists?.(false)
// Runs workflow
```

### Manual Toggle
```javascript
window.SimilarArtists?.toggleAuto?.()
// Toggles auto-mode
```

## Troubleshooting

### Actions don't appear
- Check `actions_add_Phase7.js` loaded
- Check `window.actions` exists
- Check browser console for errors
- Look for "SimilarArtists: Actions registered"

### Auto-mode doesn't trigger
- Check auto-mode enabled: `isAutoEnabled()`
- Check playback running
- Check playlist has multiple tracks
- Look in console for "Auto-Mode:" messages

### Toolbar doesn't update
- Verify button ID matches config
- Check `app.toolbar` available
- Manually call `updateToolbarIcon()`

### Settings don't persist
- Check `getSetting()` / `setSetting()` work
- Check database writable
- Test directly in console

## Next Steps

1. **Deploy files**
   - Copy all modules to deployment
   - Copy entry point and actions
   - Remove old add-on files

2. **Verify startup**
   - Check console messages
   - Verify menu items appear
   - Test basic functionality

3. **Test workflows**
   - Run similar artists
   - Toggle auto-mode
   - Test auto-queue

4. **Package for distribution**
   - Create MM5 add-on package
   - Include manifest
   - Include all modules

## See Also

- `PHASE_7_MM5_INTEGRATION.md` - Detailed documentation
- `PHASE_6_QUICK_START.md` - Auto-mode reference
- `PHASE_5_QUICK_START.md` - Orchestration reference
- `modules/core/mm5Integration.js` - Implementation code
