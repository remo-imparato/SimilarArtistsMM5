# SimilarArtists Refactoring - Navigation Guide

## ?? You Are Here: Phase 4 (Database Layer) ? COMPLETE

---

## ?? Documentation Files by Purpose

### ?? Quick Start (Read These First)
- **PHASE_4_QUICK_START.md** - 2-minute overview of Phase 4
- **modules/README.md** - Module architecture reference
- **QUICK_REFERENCE.md** - Quick lookup of all functions

### ?? Detailed References
- **PHASE_4_SUMMARY.md** - Comprehensive Phase 4 documentation
- **PHASE_4_COMPLETE.md** - Phase 4 completion report
- **PHASE_3_SUMMARY.md** - Phase 3 (API Layer) reference
- **PHASE_3_COMPLETE.md** - Phase 3 completion report
- **PHASE_1_2_SUMMARY.md** - Phases 1-2 (Utilities) reference

### ?? Project Status
- **REFACTORING_PROGRESS.md** - Overall roadmap (8 phases)
- **COMPLETION_SUMMARY.md** - Current progress snapshot
- **DELIVERABLES_CHECKLIST.md** - What's been done/pending

---

## ??? Module Structure

```
modules/
??? config.js                 ? Configuration constants
??? index.js                  ? Main export point [UPDATED: Added db]
??? utils/                    ? PHASES 1-2 (Complete)
?   ??? normalization.js
?   ??? helpers.js
?   ??? sql.js
??? settings/                 ? PHASES 1-2 (Complete)
?   ??? storage.js
?   ??? prefixes.js
?   ??? lastfm.js
??? ui/                       ? PHASES 1-2 (Complete)
?   ??? notifications.js
??? api/                      ? PHASE 3 (Complete)
?   ??? cache.js
?   ??? lastfm.js
??? db/                       ? PHASE 4 (? NEW - Complete)
    ??? library.js            [NEW] Library track search
    ??? playlist.js           [NEW] Playlist management
    ??? queue.js              [NEW] Track enqueueing
    ??? index.js              [NEW] Module exports
```

---

## ?? How Phases Connect

```
Phase 1-2: Utilities & Settings
    ?
Phase 3: API Layer (Last.fm)
    ?
Phase 4: Database Layer (Library, Playlists, Queue) ? YOU ARE HERE
    ?
Phase 5: Core Logic (Orchestrates 3+4)
    ?
Phase 6: UI Layer (Dialogs, Actions)
    ?
Phase 7: Playback (Auto-mode, Enqueue)
    ?
Phase 8: Entry Point (Ties everything together)
```

---

## ?? What Each File Does

### Phase 4 Files (NEW)

**modules/db/library.js** (200 lines)
- `findLibraryTracks()` - Find tracks by artist + optional titles
- `findLibraryTracksBatch()` - Efficient batch multi-title search
- Features: SQL injection protection, rating filtering

**modules/db/playlist.js** (150 lines)
- `createPlaylist()` - Create new user playlists
- `findPlaylist()` - Search existing playlists
- `getOrCreatePlaylist()` - Reuse or create pattern

**modules/db/queue.js** (180 lines)
- `queueTrack()` - Add track to Now Playing
- `queueTracks()` - Batch enqueue with progress
- `addTracksToPlaylist()` - Populate custom playlists

**modules/db/index.js** (15 lines)
- Central export point for all database functions
- Imports and re-exports from library.js, playlist.js, queue.js

---

## ?? Quick Commands

### View Phase 4 Documentation
```bash
cat PHASE_4_QUICK_START.md        # 2-min overview
cat PHASE_4_SUMMARY.md             # Full reference
cat modules/README.md              # All modules
```

### Find Database Functions
```bash
grep -n "function " modules/db/*.js   # All functions
grep -n "module.exports" modules/db/  # All exports
```

### Check Dependencies
```bash
grep -n "require\|import" modules/db/library.js
grep -n "require\|import" modules/db/playlist.js
grep -n "require\|import" modules/db/queue.js
```

---

## ?? Usage Examples

### Import All Database Functions
```javascript
const { db } = require('./modules');

// Library search
const tracks = await db.findLibraryTracks('Pink Floyd');

// Playlist management
const playlist = await db.createPlaylist('Favorites');

// Enqueueing
await db.queueTracks(tracks, true);  // true = play now
```

### Selective Imports
```javascript
const { findLibraryTracks, queueTracks } = require('./modules').db;
```

---

## ? Quality Checklist

- [x] Phase 4 modules created (3 files)
- [x] Error handling added (comprehensive)
- [x] JSDoc documentation added (all functions)
- [x] Progress feedback integrated (with ui module)
- [x] README updated with examples
- [x] No circular dependencies
- [x] MediaMonkey API patterns followed
- [x] Ready for Phase 5 integration
- [x] Backward compatible

---

## ?? What Comes Next

### Phase 5: Core Logic (2-3 hours)
Will implement the main algorithm:
- Collect seed artists from selection/playing track
- Query Last.fm for similar artists
- Search library for matching tracks
- Rank and deduplicate results
- Main orchestration function

**Will use**: All of Phases 1-4 together

---

## ?? Quick Reference

| Need | File | Function |
|------|------|----------|
| Library search | `modules/db/library.js` | `findLibraryTracks()` |
| Batch search | `modules/db/library.js` | `findLibraryTracksBatch()` |
| Create playlist | `modules/db/playlist.js` | `createPlaylist()` |
| Find playlist | `modules/db/playlist.js` | `findPlaylist()` |
| Get or create | `modules/db/playlist.js` | `getOrCreatePlaylist()` |
| Queue track | `modules/db/queue.js` | `queueTrack()` |
| Queue tracks | `modules/db/queue.js` | `queueTracks()` |
| Add to playlist | `modules/db/queue.js` | `addTracksToPlaylist()` |

---

## ?? Learning Path

1. **Start here**: `PHASE_4_QUICK_START.md` (2 min)
2. **Then read**: `modules/README.md` (5 min)
3. **Deep dive**: `PHASE_4_SUMMARY.md` (15 min)
4. **Explore code**: `modules/db/*.js` files (20 min)
5. **Understand flow**: `REFACTORING_PROGRESS.md` (10 min)

Total: ~50 minutes to full understanding

---

**Status: Phase 4 Complete ? - Ready for Phase 5**

Next action: Start Phase 5 (Core Logic) or refer to documentation above
