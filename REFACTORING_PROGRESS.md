# SimilarArtists Refactoring Progress

## ? COMPLETED: Phase 1-2 - Utilities and Settings Modules

### Created Files

#### Configuration
- `modules/config.js` - Script constants, API base URLs, defaults

#### Utilities (`modules/utils/`)
- `modules/utils/normalization.js` - String normalization (stripName, splitArtists, cache keys)
- `modules/utils/helpers.js` - General utilities (shuffle, formatError, parseListSetting, sleep)
- `modules/utils/sql.js` - SQL utilities (escapeSql, getTrackKey, quoteSqlString)

#### Settings (`modules/settings/`)
- `modules/settings/storage.js` - Get/setSetting with type coercion (int, string, bool, list)
- `modules/settings/prefixes.js` - Artist name prefix handling ("The" ignore feature)
- `modules/settings/lastfm.js` - Last.fm API key retrieval

#### UI (`modules/ui/`)
- `modules/ui/notifications.js` - Toast messages and progress bar updates

#### API (`modules/api/`)
- `modules/api/cache.js` - Last.fm API response caching (per-run caches)

#### Module Infrastructure
- `modules/index.js` - Central export point for all modules
- `modules/README.md` - Comprehensive module documentation

### Key Benefits Achieved

? **Eliminated Code Duplication**
  - Settings functions now centralized
  - Utility functions available for reuse
  - Normalization logic consistent everywhere

? **Improved Testability**
  - Each module can be unit tested independently
  - Mock-friendly pure functions
  - No global state in utility modules

? **Better Code Organization**
  - Clear responsibility separation
  - Easier to locate specific functionality
  - Simplified debugging

? **Maintained Backward Compatibility**
  - All modules have graceful fallbacks
  - Existing code continues to work
  - No breaking changes to the public API

---

## ?? UPCOMING: Phase 3 - API Layer (Last.fm Queries)

### Functions to Extract
- `fetchSimilarArtists(artistName, limit)` - Last.fm similar artists query
- `fetchTopTracks(artistName, limit, includePlaycount)` - Last.fm top tracks query

### New Module Location
- `modules/api/lastfm.js`

### Dependencies
- `modules/api/cache.js` (caching)
- `modules/settings/lastfm.js` (API key)
- `modules/ui/notifications.js` (progress updates)

### Tests Needed
- Mock Last.fm API responses
- Verify caching behavior
- Test error handling (HTTP errors, API errors, JSON parse failures)

---

## ?? UPCOMING: Phase 4 - Database Layer (Library Search)

### Functions to Extract
- `findLibraryTracksBatch(artistName, titles, maxPerTitle, opts)` - Batch track search
- `findLibraryTracks(artistName, title, limit, opts)` - Single track search (wrapper)
- `addTracksToTarget(target, tracks, options)` - Add tracks to playlist/queue
- `enqueueTracks(tracks, ignoreDupes, clearFirst)` - Add to Now Playing
- `createPlaylist(tracks, seedName, overwriteMode, selectedPlaylist, ignoreDupes)` - Create/update playlist
- `findPlaylist(name)` - Locate existing playlist

### New Module Locations
- `modules/database/library.js` - Track search queries
- `modules/database/playlist.js` - Playlist operations

### Dependencies
- `modules/utils/sql.js` (SQL building)
- `modules/utils/normalization.js` (stripName)
- `modules/settings/prefixes.js` (artist name variations)
- `modules/settings/storage.js` (filtering settings)
- `modules/ui/notifications.js` (progress updates)

### Tests Needed
- SQL query construction validation
- Prefix variation matching
- Track deduplication logic
- Playlist creation/mutation

---

## ?? UPCOMING: Phase 5 - Core Logic (Seed Collection & Processing)

### Functions to Extract
- `collectSeedTracks()` - Gather seed artists from selection/playing track
- `uniqueArtists(seeds)` - Deduplicate and filter seeds
- `processSeedArtists(seeds, settings, trackRankMap)` - Main processing logic
- `buildPlaylistTitle(seeds)` - Generate playlist name from seeds

### New Module Locations
- `modules/core/seedCollection.js` - `collectSeedTracks`, `uniqueArtists`
- `modules/core/processing.js` - `processSeedArtists`, `buildPlaylistTitle`

### Dependencies
- `modules/api/lastfm.js` (similar artists/top tracks)
- `modules/database/library.js` (track matching)
- `modules/utils/helpers.js` (shuffle, parseListSetting)
- `modules/settings/prefixes.js` (fixPrefixes)
- `modules/settings/storage.js` (limits, filtering)
- `modules/ui/notifications.js` (progress updates)

### Tests Needed
- Seed collection from different UI contexts
- Blacklist filtering
- Artist deduplication
- Ranking mode scoring
- Track filtering (genre, rating, title exclusions)

---

## ?? UPCOMING: Phase 6 - UI (Dialogs & Actions)

### Functions to Extract
- `confirmPlaylist(seedName, overwriteMode)` - Playlist selection dialog
- `refreshToggleUI()` - Update toolbar/action icons
- Playlist navigation handlers

### New Module Locations
- `modules/ui/dialogs.js` - `confirmPlaylist`
- `modules/ui/actions.js` - `refreshToggleUI`, action handlers

### Dependencies
- `modules/settings/storage.js` (reading/writing UI state)
- `modules/config.js` (action/toolbar IDs)

### Tests Needed
- Dialog return value handling
- Cancel vs OK scenarios
- UI state synchronization

---

## ?? UPCOMING: Phase 7 - Playback (Auto-Mode & Enqueue)

### Functions to Extract
- `attachAuto()` - Register playback listener
- `detachAuto()` - Unregister listener
- `handleAuto()` - Auto-mode trigger logic
- (enqueueTracks will move from Phase 4 to here for better organization)

### New Module Location
- `modules/playback/autoMode.js`

### Dependencies
- `modules/core/runner.js` (runSimilarArtists)
- `modules/settings/storage.js` (OnPlay setting)
- `modules/config.js` (constants)

### Tests Needed
- Listener attachment/detachment
- Remaining track calculation
- Auto-trigger threshold (2 tracks)
- Duplicate prevention (autoRunning state)

---

## ?? UPCOMING: Phase 8 - Entry Point (Orchestration)

### Functions to Extract (Main Runner)
- `runSimilarArtists(autoRun)` - Main orchestration function
- `start()` - Addon initialization
- `toggleAuto()` - Auto-mode toggle action
- `applyAutoModeFromSettings()` - UI sync function
- `isAutoEnabled()` - State query

### New Module Location
- `modules/core/runner.js` - `runSimilarArtists`, orchestration

### Dependencies
- All other modules

### Tests Needed
- Full integration testing
- Auto-mode scenarios
- Manual mode scenarios
- Error handling and recovery
- Progress reporting

---

## Migration Strategy & Best Practices

### When Refactoring Each Phase:

1. **Create the new module file(s)**
   - Write the extracted functions
   - Include comprehensive JSDoc comments
   - Export all public functions

2. **Update similarArtists.js**
   - Add require statement for new module
   - Create wrapper functions with fallbacks
   - Replace inline implementations with module calls
   - Run tests to verify no regressions

3. **Create wrapper functions** (if needed)
   - Maintain backward compatibility
   - Provide fallback implementations
   - Log module availability for debugging

4. **Update module/index.js**
   - Add new module to exports
   - Update dependency documentation

5. **Update modules/README.md**
   - Document new module
   - Add usage examples
   - Update dependency diagram

6. **Test thoroughly**
   - Unit tests for new module (if possible)
   - Integration tests in similarArtists.js
   - Manual testing in MM5

7. **Commit with descriptive message**
   - Reference which phase was completed
   - List extracted functions
   - Note any refactoring pattern changes

### Testing Template

```javascript
// Example: Test modules/utils/normalization.js
const { stripName, cacheKeyArtist } = require('./modules/utils/normalization');

describe('normalization', () => {
  it('should strip punctuation from artist names', () => {
    expect(stripName('The Beatles')).toBe('THEBEATLES');
    expect(stripName('AC/DC')).toBe('ACDC');
    expect(stripName('Wu-Tang Clan')).toBe('WUTANGCLAN');
  });

  it('should generate consistent cache keys', () => {
    const key1 = cacheKeyArtist('Pink Floyd');
    const key2 = cacheKeyArtist('pink floyd');
    const key3 = cacheKeyArtist('  Pink Floyd  ');
    expect(key1).toBe(key2);
    expect(key1).toBe(key3);
  });
});
```

---

## Rollback Plan

If a phase has issues:

1. The `similarArtists.js` wrapper functions have fallback implementations
2. Modules are optional - code works even if require() fails
3. Git history allows quick revert if needed
4. Old monolithic version available in git history

---

## Progress Tracking

| Phase | Status | Files | Functions | Effort |
|-------|--------|-------|-----------|--------|
| 1-2: Utilities & Settings | ? DONE | 9 files | 30+ | ~2-3 hours |
| 3: API Layer | ?? TODO | 1 file | 2-3 | ~1-2 hours |
| 4: Database Layer | ?? TODO | 2 files | 6 | ~3-4 hours |
| 5: Core Logic | ?? TODO | 2 files | 4 | ~2-3 hours |
| 6: UI (Dialogs/Actions) | ?? TODO | 2 files | 2-3 | ~1-2 hours |
| 7: Playback (Auto-Mode) | ?? TODO | 1 file | 4 | ~1 hour |
| 8: Entry Point/Runner | ?? TODO | 1 file | 5 | ~1-2 hours |

**Total Refactoring Effort**: ~11-17 hours across all phases
**Completed**: ~2-3 hours (Phase 1-2)
**Remaining**: ~9-14 hours

---

## Next Steps for Maintainer

### Immediate (This Session)
- [ ] Review and test Phase 1-2 module implementations
- [ ] Verify wrapper functions work correctly
- [ ] Begin Phase 3 (API Layer) if time permits

### Short-term (This Week)
- [ ] Complete Phase 3-4 (API & Database)
- [ ] Add unit tests for extracted modules
- [ ] Update CI/CD if applicable

### Medium-term (This Month)
- [ ] Complete Phase 5-7 (Core Logic, UI, Playback)
- [ ] Comprehensive integration testing
- [ ] Performance profiling

### Long-term (Next Month+)
- [ ] Complete Phase 8 (Entry Point)
- [ ] Full test coverage
- [ ] Deploy refactored version
- [ ] Monitor stability in production
