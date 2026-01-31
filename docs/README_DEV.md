# Match Monkey — Modules Overview

This document describes the current module architecture for the Match Monkey (SimilarArtists) MediaMonkey 5 add-on. It is a concise developer-facing reference for available modules, their responsibilities, public API surfaces exported to `window`, and the supported discovery modes.

Goal: provide a single up-to-date summary of modules and how to use them from other modules or the console.

---

## Directory layout (important modules)

- `modules/config.js`                — core configuration constants and IDs
- `modules/utils/`                   — utility helpers
  - `normalization.js`               — name/title normalization and helpers (`stripName`, `splitArtists`, etc.)
  - `helpers.js`                     — shuffle, parseListSetting, formatError, etc.
  - `sql.js`                         — SQL escaping and query helpers
- `modules/settings/`                — settings and prefix handling
  - `storage.js`                     — typed settings getters/setters (`getSetting`, `intSetting`, `boolSetting`, `stringSetting`)
  - `prefixes.js`                    — artist prefix handling (`fixPrefixes`, `getIgnorePrefixes`)
  - `lastfm.js`                      — last.fm key helper
- `modules/ui/`                      — UI helpers
  - `notifications.js`               — toasts, progress tasks (`showToast`, `createProgressTask`, `updateProgress`, `terminateProgressTask`)
- `modules/api/`                     — external API integrations
  - `cache.js`                       — per-run caching utilities (`init`, `clear`, cache accessors`)
  - `lastfm.js`                      — Last.fm API wrappers (`fetchSimilarArtists`, `fetchTopTracks`, `fetchSimilarTracks`, `fetchArtistInfo`, `fetchArtistsByTag`)
  - `reccobeats.js`                  — ReccoBeats integration (audio features, recommendations)
- `modules/db/`                      — library, playlist and queue operations
  - `library.js`                     — `findLibraryTracks`, `findLibraryTracksBatch` (SQL-based lookups)
  - `playlist.js`                    — create/resolve/clear/add tracks to playlists
  - `queue.js`                       — enqueue tracks to Now Playing (`queueTrack`, `queueTracks`)
  - `index.js`                       — exports consolidated `window.matchMonkeyDB` interface
- `modules/core/`                    — core orchestration and flows
  - `discoveryStrategies.js`         — discovery implementations (artist/track/genre/acoustics/mood/activity)
  - `orchestration.js`               — main workflow (`generateSimilarPlaylist`, matching and output)
  - `autoMode.js`                    — auto-queue listener and trigger handler
  - `mm5Integration.js`              — UI integration and action/toolbar helpers

All modules export their runtime APIs on the `window` namespace (for example: `window.matchMonkeyLastfmAPI`, `window.matchMonkeyReccoBeatsAPI`, `window.matchMonkeyOrchestration`, `window.matchMonkeyDB`).

---

## Supported discovery modes

The codebase supports the following discovery modes (strings used in orchestration):

- `artist`    — Last.fm `artist.getSimilar` → expand artists → fetch top tracks
- `track`     — Last.fm `track.getSimilar` → similar tracks across artists
- `genre`     — Last.fm tag-based discovery (`tag.getTopArtists`)
- `acoustics` — ReccoBeats seed-based recommendations (requires seed tracks)
- `mood`      — ReccoBeats mood presets blended with seed audio features (seed-aware)
- `activity`  — ReccoBeats activity presets blended with seed audio features (seed-aware)

Notes
- Mood and Activity flows are seed-aware: they compute or blend audio features from seed tracks and then request/filter recommendations. Without seed tracks (or if ReccoBeats cannot find seed track IDs) mood/activity discovery may return no candidates.

---

## Key public APIs (exports on `window`)

Below are the principal runtime exports and the core functions they provide. Use the exact names listed when calling from other modules or the console.

- `window.matchMonkeyLastfmAPI` — Last.fm helpers
  - `fetchSimilarArtists(artist, limit)`
  - `fetchTopTracks(artist, limit, includePlaycount)`
  - `fetchSimilarTracks(artist, track, limit)`
  - `fetchArtistInfo(artist)`
  - `fetchArtistsByTag(tag, limit)`
  - `getApiKey()`

- `window.matchMonkeyReccoBeatsAPI` — ReccoBeats integration (current export names)
  - High-level functions:
    - `getReccoRecommendations(seeds, limit)`
    - `getMoodRecommendations(mood, limit)`
    - `getActivityRecommendations(activity, limit)`
  - Track/album lookup and audio features:
    - `searchArtist(artistName)`
    - `searchAlbum(albumName)`
    - `findAlbumInArtist(artistId, albumName)`
    - `findAlbumId(artist, album)`
    - `getAlbumTracks(albumId)`
    - `findTrackInAlbum(albumId, trackTitle)`
    - `findTrackId(artist, title, album)`
    - `findTrackIdsBatch(seeds)`
    - `fetchTrackAudioFeatures(trackId)`
    - `getAudioFeatures(foundTracks)`
  - Recommendation and utility functions:
    - `fetchRecommendations(seedIds, audioTargets, limit)`
    - `filterTracksByAudioFeatures(tracks, criteria)`
    - `calculateAudioFeatureMatch(track, target, weights)`
    - `calculateAverageFeatures(features)`
    - `blendFeatures(seedAvg, moodPreset, blendRatio)`
  - Presets and constants:
    - `MOOD_AUDIO_TARGETS`, `ACTIVITY_AUDIO_TARGETS`, `AUDIO_FEATURE_NAMES`
    - `RECCOBEATS_API_BASE`, `API_TIMEOUT_MS`

- `window.matchMonkeyOrchestration` — core orchestration
  - `generateSimilarPlaylist(modules, autoMode=false, discoveryMode='artist', autoModeThreshold)`
  - `collectSeedTracks(modules)`
  - `matchCandidatesToLibrary(modules, candidates, config)`
  - `matchMoodActivityToLibrary(modules, filterCandidate, config)`
  - `queueResults(modules, tracks, config)`
  - `buildResultsPlaylist(modules, tracks, config)`

- `window.matchMonkeyDiscoveryStrategies` — discovery strategy functions and constants
  - `discoverByArtist`, `discoverByTrack`, `discoverByGenre`, `discoverByRecco` (acoustics), `discoverByMood`, `discoverByActivity`
  - `getDiscoveryStrategy(mode)`, `getDiscoveryModeName(mode)`, `DISCOVERY_MODES`

- `window.matchMonkeyDB` — consolidated database interface (preferred export)
  - `findLibraryTracks(artist, titles, limit, options)`
  - `findLibraryTracksBatch(artist, titles, limit, options)`
  - `findPlaylist(name)`, `createPlaylist(name)`, `addTracksToPlaylist(playlist, tracks)`, `getOrCreatePlaylist(name)`, etc.
  - `queueTrack(track)`, `queueTracks(trackArray)`

- `window.matchMonkeyAutoMode` — auto-mode helpers
  - `initializeAutoMode(getSetting, handler, logger)`, `createAutoTriggerHandler(config)`, `attachAutoModeListener(...)`, `detachAutoModeListener(...)`

- Utilities: `window.matchMonkeyHelpers`, `window.matchMonkeySQL`, `window.matchMonkeyPrefixes`, `window.lastfmCache`, `window.matchMonkeyNotifications`, `window.matchMonkeyConfig`, `window.matchMonkeyStorage`, etc.

---

## Important implementation details and behaviors

- Library matching is SQL-driven: `modules/db/library.js` builds queries against the MediaMonkey `Songs` and `Artists` tables and returns persistent track references (`getValue`) for playlist/queue operations.
- Deduplication: The orchestration layer deduplicates matched tracks by a normalized `artist||title` key. The current implementation retains the first candidate found for each key; an explicit best-version selection (bitrate → rating) is not implemented.
- Auto-mode: Trigger logic includes cooldowns and a default threshold. The auto-trigger handler uses a default of `3` remaining entries unless overridden by settings; it prevents concurrent runs and will attempt fallback discovery modes if the preferred mode yields no results.
- ReccoBeats integration: Provides seed track lookup (album → track), audio features retrieval and recommendations. Includes per-run caching and rate-limit handling. ReccoBeats responses are used for acoustics-, mood- and activity-based discovery.
- Settings: All runtime settings are read through typed storage getters (`intSetting`, `boolSetting`, `stringSetting`). Prefix handling integrates with library lookups to match variants like `Beatles, The`.

---

## Quick usage notes

- Use the UI or `window.matchMonkey` entry points loaded by the add-on to run discovery.
- Discovery mode strings: `artist`, `track`, `genre`, `acoustics`, `mood`, `activity`.
- Database access should use `window.matchMonkeyDB` for a stable consolidated interface.

---

## Adding or modifying modules

- Export your module API to `window` using the existing naming conventions.
- Avoid circular dependencies: prefer function-injection where a direct module dependency would create a cycle.
- Document public functions and expected inputs/outputs in the module file header and update this developer README when API names change.
- Use `lastfmCache` and ReccoBeats caching for per-run caching; call `cache.init()` at the start of an orchestration run and `cache.clear()` at the end.

---

This developer README focuses on the current code structure and runtime behavior. Keep this file in sync with code changes and update exported API names if you refactor modules.
