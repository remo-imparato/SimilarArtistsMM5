# MatchMonkey Module Architecture

This directory contains refactored, modular components for the MatchMonkey MediaMonkey 5 add-on.

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
??? db/
    ??? library.js              # Library track searching (single & batch)
    ??? playlist.js             # Playlist creation and management
    ??? queue.js                # Track enqueueing (Now Playing & playlists)
    ??? index.js                # Database module exports
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
  ?? db/library ? utils/sql, settings/prefixes
  ?? db/playlist ? ui/notifications
  ?? db/queue ? ui/notifications
```

## Usage Examples

### Configuration
```javascript
const { config } = localRequirejs('./modules');
console.log(config.SCRIPT_ID);        // 'MatchMonkey'
console.log(config.API_BASE);          // 'https://ws.audioscrobbler.com/2.0/'
```

### Utilities
```javascript
const { utils } = localRequirejs('./modules');

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
const { settings } = localRequirejs('./modules');

// Storage
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
const { ui } = localRequirejs('./modules');

// Notifications
ui.notifications.showToast('Processing playlist...');
ui.notifications.createProgressTask('Fetching similar artists');
ui.notifications.updateProgress('Current step: 45%', 0.45);
ui.notifications.terminateProgressTask();
```

### API Caching
```javascript
const { api } = localRequirejs('./modules');

api.cache.initLastfmRunCache();
api.cache.cacheSimilarArtists('Pink Floyd', artists);
api.cache.getCachedSimilarArtists('Pink Floyd');
api.cache.clearLastfmRunCache();
```

### Last.fm API
```javascript
const { api } = localRequirejs('./modules');

// Fetch similar artists from Last.fm
const similar = await api.lastfmApi.fetchSimilarArtists('Pink Floyd', 10);
// Returns: [{name: 'David Gilmour', ...}, {name: 'Led Zeppelin', ...}, ...]

// Fetch top tracks for an artist
const topTracks = await api.lastfmApi.fetchTopTracks('Pink Floyd', 20);
// Returns: ['Time', 'Money', 'Us and Them', ...]

// Fetch top tracks with ranking data
const rankedTracks = await api.lastfmApi.fetchTopTracks('Pink Floyd', 100, true);
// Returns: [{title: 'Time', playcount: 5000, rank: 1}, ...]
```

### Database
```javascript
const { db } = localRequirejs('./modules');

// Find library tracks by artist
const tracks = await db.findLibraryTracks('Pink Floyd', ['Time', 'Money'], 20);
// Returns: [{id, title, artist, album, path, playCount, rating}, ...]

// Batch find tracks for multiple titles
const titleMap = await db.findLibraryTracksBatch('Pink Floyd', ['Time', 'Money'], 5);
// Returns: Map { 'Time' => [...tracks], 'Money' => [...tracks] }

// Create a new playlist
const playlist = await db.createPlaylist('Similar - Pink Floyd');

// Find existing playlist
const playlist = db.findPlaylist('My Favorites');

// Get or create playlist (prefer existing)
const playlist = await db.getOrCreatePlaylist('My Collection');

// Queue a track to Now Playing
await db.queueTrack(trackObject);

// Queue multiple tracks
const count = await db.queueTracks(trackArray, true);  // true = play now

// Add tracks to a playlist
await db.addTracksToPlaylist(playlist, trackArray);
await playlist.commitAsync();  // Save changes
```


## Testing Strategy

Once modules are complete, each can be unit-tested independently:

```javascript
// Example test
const { utils } = localRequirejs('./modules');

describe('normalization', () => {
  it('should strip punctuation', () => {
    expect(utils.normalization.stripName('The Beatles')).toBe('THEBEATLES');
  });
});
```

## Migration Notes

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

### API
- **`api/cache.js`** - Cache management
- **`api/lastfm.js`** - Last.fm API queries (fetchSimilarArtists, fetchTopTracks)
