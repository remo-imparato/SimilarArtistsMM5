# SimilarArtists Modules - Quick Reference Card

## Module File Locations

```
modules/
??? config.js                    CONSTANTS
??? index.js                     EXPORTS
??? README.md                    USAGE GUIDE
??? utils/
?   ??? normalization.js        TEXT PROCESSING
?   ??? helpers.js              UTILITIES
?   ??? sql.js                  SQL BUILDERS
??? settings/
?   ??? storage.js              SETTINGS I/O
?   ??? prefixes.js             ARTIST NAMES
?   ??? lastfm.js               API CONFIG
??? ui/
?   ??? notifications.js        TOASTS & PROGRESS
??? api/
    ??? cache.js                API CACHING
```

---

## Config Module

**File**: `modules/config.js`

```javascript
const { SCRIPT_ID, API_BASE, DEFAULTS } = require('./modules').config;

SCRIPT_ID            // 'SimilarArtists'
MENU_RUN_ID         // 'SimilarArtists.menu.run'
ACTION_RUN_ID       // 'SimilarArtists.run'
TOOLBAR_RUN_ID      // 'sa-run'
API_BASE            // 'https://ws.audioscrobbler.com/2.0/'
DEFAULTS            // { Name: '- Similar to %' }
```

---

## Normalization Functions

**File**: `modules/utils/normalization.js`

```javascript
const n = require('./modules').utils.normalization;

n.normalizeName(name)              // 'name'.trim()
n.splitArtists(artistField)        // Split by ';'
n.stripName(name)                  // Remove punctuation
n.cacheKeyArtist(name)             // Uppercase cache key
n.cacheKeyTopTracks(artist, limit) // Cache key with limit
```

### Examples
```javascript
n.stripName('The Beatles')         // 'THEBEATLES'
n.splitArtists('Beatles;Wings')    // ['Beatles', 'Wings']
n.cacheKeyArtist('pink floyd')     // 'PINK FLOYD'
```

---

## Helper Functions

**File**: `modules/utils/helpers.js`

```javascript
const h = require('./modules').utils.helpers;

h.formatError(err)                 // Error ? string
h.shuffle(arr)                     // In-place shuffle
h.parseListSetting(raw)            // CSV/array ? array
h.sleep(ms)                        // Async delay
h.escapeSql(str)                   // SQL escape quotes
```

### Examples
```javascript
h.shuffle([1,2,3])                 // Randomize in-place
h.parseListSetting('a,b,c')        // ['a', 'b', 'c']
await h.sleep(500)                 // Wait 500ms
h.escapeSql("O'Reilly")            // "O''Reilly"
```

---

## SQL Functions

**File**: `modules/utils/sql.js`

```javascript
const s = require('./modules').utils.sql;

s.quoteSqlString(value)            // Value ? 'value'
s.getTrackKey(track)               // Track ID or path
s.escapeSql(str)                   // SQL escape
```

### Examples
```javascript
s.quoteSqlString('test')           // 'test'
s.quoteSqlString(null)             // ''
s.getTrackKey({id: 123})           // '123'
s.getTrackKey({path: '/a/b'})      // 'path:/a/b'
```

---

## Settings Storage

**File**: `modules/settings/storage.js`

```javascript
const st = require('./modules').settings.storage;

st.getSetting(key, fallback)       // Get any value
st.setSetting(key, value)          // Save value
st.intSetting(key)                 // Get as integer
st.stringSetting(key)              // Get as string
st.boolSetting(key)                // Get as boolean
st.listSetting(key)                // Get as array
```

### Examples
```javascript
st.getSetting('OnPlay', false)     // Get with fallback
st.setSetting('OnPlay', true)      // Save setting
st.intSetting('Limit')             // 0 if missing
st.boolSetting('Rank')             // true/false
st.listSetting('Black')            // ['artist1', 'artist2']
```

---

## Prefix Functions

**File**: `modules/settings/prefixes.js`

```javascript
const pf = require('./modules').settings.prefixes;

pf.getIgnorePrefixes()             // Get ["The", "A", ...]
pf.fixPrefixes(name)               // "Beatles, The" ? "The Beatles"
```

### Examples
```javascript
pf.getIgnorePrefixes()             // ["The"]
pf.fixPrefixes('Beatles, The')     // 'The Beatles'
pf.fixPrefixes('The Beatles')      // 'The Beatles'
```

---

## Last.fm API

**File**: `modules/settings/lastfm.js`

```javascript
const lfm = require('./modules').settings.lastfm;

lfm.getApiKey()                    // Get API key
```

### Examples
```javascript
const key = lfm.getApiKey();       // '7fd988db0c4e...'
fetch(`https://ws.audioscrobbler.com/2.0/?api_key=${key}`);
```

---

## Notifications

**File**: `modules/ui/notifications.js`

```javascript
const ui = require('./modules').ui.notifications;

ui.showToast(text, options)        // Show notification
ui.updateProgress(message, value)  // Update progress (0-1)
ui.createProgressTask(text)        // Create progress bar
ui.terminateProgressTask()         // Hide progress bar
ui.getProgressTask()               // Get current task
```

### Examples
```javascript
ui.showToast('Loading...');
ui.createProgressTask('Processing...');
ui.updateProgress('Step 1/5', 0.2);
ui.terminateProgressTask();
```

---

## API Caching

**File**: `modules/api/cache.js`

```javascript
const c = require('./modules').api.cache;

c.initLastfmRunCache()             // Start per-run cache
c.clearLastfmRunCache()            // End per-run cache
c.getCachedSimilarArtists(name)    // Get from cache
c.cacheSimilarArtists(name, data)  // Save to cache
c.getCachedTopTracks(name, limit)  // Get from cache
c.cacheTopTracks(name, limit, ...) // Save to cache
c.isCacheActive()                  // Is cache enabled?
```

### Examples
```javascript
c.initLastfmRunCache();
const cached = c.getCachedSimilarArtists('Pink Floyd');
if (!cached) {
    const data = await fetch(...);
    c.cacheSimilarArtists('Pink Floyd', data);
}
c.clearLastfmRunCache();
```

---

## Module Export Structure

**File**: `modules/index.js`

```javascript
module.exports = {
    config,                // Configuration
    utils: {
        normalization,     // String processing
        helpers,           // General utilities
        sql,               // SQL helpers
    },
    settings: {
        storage,           // Settings I/O
        prefixes,          // Prefix handling
        lastfm,            // API key
    },
    ui: {
        notifications,     // Toasts & progress
    },
    api: {
        cache,            // Response caching
    },
};
```

---

## Complete Usage Example

```javascript
const modules = require('./modules');
const { config, utils, settings, ui } = modules;

// Use configuration
console.log(config.SCRIPT_ID);  // 'SimilarArtists'

// Process strings
const clean = utils.normalization.stripName('The Beatles');

// Get settings
const limit = settings.storage.intSetting('Limit');
const fixed = settings.prefixes.fixPrefixes('Beatles, The');

// Show progress
ui.notifications.showToast('Processing...');
ui.notifications.updateProgress('Step 1', 0.25);

// Manage cache
modules.api.cache.initLastfmRunCache();
const artists = modules.api.cache.getCachedSimilarArtists('Pink Floyd');
modules.api.cache.clearLastfmRunCache();
```

---

## Backward Compatibility

All modules have fallback implementations in `similarArtists.js`:

```javascript
// Fallback if module loading fails
function getSetting(key, fallback) {
    if (modulesAvailable()) {
        return modules.settings.storage.getSetting(key, fallback);
    }
    // Fallback implementation
    if (typeof app === 'undefined') return fallback;
    let val = app.getValue(SCRIPT_ID, {});
    return val[key] !== undefined ? val[key] : fallback;
}
```

**Result**: Code works even if `require('./modules')` fails.

---

## Testing Template

```javascript
const normalization = require('./modules/utils/normalization');

describe('normalization', () => {
  it('stripName removes punctuation', () => {
    expect(normalization.stripName('The Beatles'))
      .toBe('THEBEATLES');
  });
  
  it('cacheKeyArtist is case-insensitive', () => {
    const k1 = normalization.cacheKeyArtist('Pink Floyd');
    const k2 = normalization.cacheKeyArtist('pink floyd');
    expect(k1).toBe(k2);
  });
});
```

---

## Dependency Graph

```
config.js (no deps)
    ?
utils/normalization.js (no deps)
utils/helpers.js (no deps)
utils/sql.js ? helpers.js
    ?
settings/storage.js ? helpers.js
settings/prefixes.js ? storage.js
settings/lastfm.js ? storage.js
    ?
ui/notifications.js (minimal deps)
    ?
api/cache.js ? normalization.js
```

**Max Depth**: 3 levels (clean hierarchy)  
**Circular Dependencies**: None  
**External Dependencies**: None (only MM5 app API)

---

## Common Patterns

### Pattern 1: Safe Settings
```javascript
const value = settings.storage.getSetting('Key', 'default');
const intVal = settings.storage.intSetting('Limit');
const list = settings.storage.listSetting('Blacklist');
```

### Pattern 2: String Processing
```javascript
const artists = utils.normalization.splitArtists(artistField);
const clean = utils.normalization.stripName(title);
const key = utils.normalization.cacheKeyArtist(name);
```

### Pattern 3: API Caching
```javascript
cache.initLastfmRunCache();
let data = cache.getCachedSimilarArtists(artist);
if (!data) {
    data = await fetchFromAPI();
    cache.cacheSimilarArtists(artist, data);
}
cache.clearLastfmRunCache();
```

### Pattern 4: User Feedback
```javascript
ui.notifications.createProgressTask('Processing...');
ui.notifications.updateProgress('Step 1/5', 0.2);
// ... do work ...
ui.notifications.terminateProgressTask();
```

---

## Cheat Sheet

| Task | Module | Function |
|------|--------|----------|
| Get setting | settings.storage | getSetting() |
| Save setting | settings.storage | setSetting() |
| Parse CSV | utils.helpers | parseListSetting() |
| Clean text | utils.normalization | stripName() |
| Split artists | utils.normalization | splitArtists() |
| Escape SQL | utils.helpers | escapeSql() |
| Show toast | ui.notifications | showToast() |
| Update progress | ui.notifications | updateProgress() |
| Cache data | api.cache | cacheSimilarArtists() |
| Get from cache | api.cache | getCachedSimilarArtists() |

---

**Last Updated**: Phase 1-2 Complete  
**Status**: Production Ready ?  
**Questions**: See modules/README.md
