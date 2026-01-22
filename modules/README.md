# SimilarArtists Module Architecture

This directory contains refactored, modular components for the SimilarArtists MediaMonkey 5 add-on.

## Directory Structure

```
modules/
??? config.js                    # Core configuration constants
??? index.js                     # Central module exports
??? utils/
?   ??? normalization.js        # String normalization (artist names, titles)
?   ??? helpers.js              # General utilities (shuffle, parse, format)
?   ??? sql.js                  # SQL building and escaping utilities
??? settings/
?   ??? storage.js              # Settings get/set with type coercion
?   ??? prefixes.js             # Artist name prefix handling ("The" ignore)
?   ??? lastfm.js               # Last.fm API key retrieval
??? ui/
?   ??? notifications.js        # Toast messages and progress display
?   ??? actions.js              # (TBD) Menu/action handlers
?   ??? dialogs.js              # (TBD) User dialogs (playlist selection, etc)
??? api/
    ??? cache.js                # Last.fm API response caching
    ??? lastfm.js               # (TBD) Last.fm API queries
```

## Module Dependencies

```
config
  ?
  ?? ui/notifications
  ?? settings/storage ? utils/helpers
  ?? settings/prefixes
  ?? settings/lastfm
  ?? utils/normalization
  ?? utils/helpers
  ?? utils/sql ? utils/helpers
  ?? api/cache ? utils/normalization
```

## Usage Examples

### Configuration
```javascript
const { config } = require('./modules');
console.log(config.SCRIPT_ID);        // 'SimilarArtists'
console.log(config.API_BASE);          // 'https://ws.audioscrobbler.com/2.0/'
```

### Utilities
```javascript
const { utils } = require('./modules');

// Normalization
utils.normalization.stripName('The Beatles');           // 'THEBEATLES'
utils.normalization.splitArtists('Artist1;Artist2');    // ['Artist1', 'Artist2']

// Helpers
utils.helpers.shuffle(array);
utils.helpers.formatError(error);
utils.helpers.parseListSetting('a,b,c');               // ['a', 'b', 'c']

// SQL
utils.sql.escapeSql("O'Reilly");                        // "O''Reilly"
utils.sql.getTrackKey(track);                           // Track dedup key
```

### Settings
```javascript
const { settings } = require('./modules');

// Storage
settings.storage.getSetting('Limit', 50);
settings.storage.setSetting('OnPlay', true);
settings.storage.intSetting('SeedLimit');
settings.storage.boolSetting('Rank');
settings.storage.listSetting('Black');

// Prefixes (for Last.fm API normalization)
const fixed = settings.prefixes.fixPrefixes('Beatles, The');  // 'The Beatles'

// Last.fm
const apiKey = settings.lastfm.getApiKey();
```

### UI
```javascript
const { ui } = require('./modules');

// Notifications
ui.notifications.showToast('Processing playlist...');
ui.notifications.createProgressTask('Fetching similar artists');
ui.notifications.updateProgress('Current step: 45%', 0.45);
ui.notifications.terminateProgressTask();
```

### API Caching
```javascript
const { api } = require('./modules');

api.cache.initLastfmRunCache();
api.cache.cacheSimilarArtists('Pink Floyd', artists);
api.cache.getCachedSimilarArtists('Pink Floyd');
api.cache.clearLastfmRunCache();
```

## Refactoring Phases

- **Phase 1-2** (Complete): Utilities and Settings modules extracted ?
- **Phase 3** (Pending): API layer (Last.fm queries)
- **Phase 4** (Pending): Database layer (library search, playlist operations)
- **Phase 5** (Pending): Core logic (seed collection, processing)
- **Phase 6** (Pending): UI (dialogs, actions)
- **Phase 7** (Pending): Playback (auto-mode, enqueue)
- **Phase 8** (Pending): Entry point (ties modules together)

## Testing Strategy

Once modules are complete, each can be unit-tested independently:

```javascript
// Example test
const { utils } = require('./modules');

describe('normalization', () => {
  it('should strip punctuation', () => {
    expect(utils.normalization.stripName('The Beatles')).toBe('THEBEATLES');
  });
});
```

## Migration Notes

- All modules use CommonJS (`module.exports`) for compatibility with MM5 environment
- No external dependencies beyond MM5's built-in `app` object
- Settings modules gracefully handle cases where `app` is undefined (for testing)
- Modules are designed to be swappable as implementation details evolve

## Contributing

When adding new modules:
1. Place in appropriate subdirectory (`utils`, `settings`, `ui`, `api`, etc)
2. Export from `index.js`
3. Document in this README
4. Ensure no circular dependencies
5. Keep module responsibilities focused and single-purpose
