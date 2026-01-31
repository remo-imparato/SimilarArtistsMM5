# MatchMonkey - Complete Features Documentation

## Overview

MatchMonkey is a comprehensive playlist generation add-on for MediaMonkey 5 that combines multiple music discovery APIs and intelligent matching algorithms.

---

## Core Features

### 1. Multi-Mode Discovery System

MatchMonkey offers **5 distinct discovery modes**, each optimized for different use cases:

#### A. Artist-Based Discovery
**Algorithm**: Last.fm `artist.getSimilar`

**Process**:
1. Extract unique artists from selected tracks
2. Query Last.fm for similar artists (configurable limit)
3. Fetch top tracks for each similar artist
4. Match tracks against local library
5. Apply filters and ranking

**Configuration**:
- `SimilarArtistsLimit`: Max similar artists per seed (default: 20)
- `TracksPerArtist`: Tracks to fetch per artist (default: 30)
- `IncludeSeedArtist`: Include original artists (default: true)

**Best For**:
- Discovering new artists in the same genre
- Building artist-focused playlists
- Genre exploration

**Example**:
```javascript
// Input: Pink Floyd tracks selected
// Output: Progressive rock artists (Yes, Genesis, King Crimson, etc.)
window.matchMonkey.runMatchMonkey(false, 'artist');
```

---

#### B. Track-Based Discovery
**Algorithm**: Last.fm `track.getSimilar`

**Process**:
1. Extract track titles from selection
2. Query Last.fm for musically similar tracks
3. Group results by artist
4. Match against local library
5. Sort by similarity score

**Configuration**:
- `TrackSimilarLimit`: Max similar tracks per seed (default: 100)
- `TracksPerArtist`: Tracks per discovered artist (default: 30)
- Higher limit improves library matching

**Best For**:
- Finding different versions of songs
- Discovering covers and remixes
- Musically similar tracks across genres
- Cross-artist discovery

**Example**:
```javascript
// Input: "Bohemian Rhapsody" selected
// Output: Epic rock songs, different versions, similar compositions
window.matchMonkey.runMatchMonkey(false, 'track');
```

---

#### C. Genre-Based Discovery
**Algorithm**: Last.fm `tag.getTopArtists` + `artist.getInfo`

**Process**:
1. Extract genres from track metadata
2. Fetch artist info from Last.fm for tags
3. Query top artists for each genre/tag
4. Get tracks from genre-matched artists
5. Match against local library

**Configuration**:
- `SimilarArtistsLimit`: Total artists to collect (default: 20)
- Distributes across multiple genres
- Respects genre blacklist

**Best For**:
- Broad genre exploration
- Discovering top artists in genres
- Genre-consistent playlists

**Example**:
```javascript
// Input: Jazz tracks selected
// Output: Top jazz artists (Miles Davis, John Coltrane, etc.)
window.matchMonkey.runMatchMonkey(false, 'genre');
```

---

#### D. Mood-Based Discovery (ReccoBeats)
**Algorithm**: ReccoBeats + Last.fm hybrid with seed awareness

**Process**:
1. Extract seed artists from selection
2. Get similar artists via Last.fm (seed component)
3. Query ReccoBeats for mood-appropriate tracks
4. **Blend both pools** using configurable ratio
5. Interleave results for optimal mixing
6. Match against local library

**Configuration**:
- `MoodActivityBlendRatio`: 0.0 (all mood) to 1.0 (all seed), default: 0.5
- `DefaultMood`: energetic, relaxed, happy, sad, focused
- `HybridMode`: Combine ReccoBeats + Last.fm (default: true)
- `SimilarArtistsLimit`: Affects seed component size

**Blend Ratio Details**:
- `0.0`: Pure mood discovery (ignores seeds)
- `0.3`: 30% seed-based, 70% mood-based
- `0.5`: **Balanced** (recommended) - 50/50 split
- `0.7`: 70% seed-based, 30% mood-based
- `1.0`: Pure seed-based with mood filtering

**Best For**:
- Emotional context playlists
- Mood-aware music selection
- Personalized discovery with mood constraints

**Example**:
```javascript
// Input: Rock tracks selected, blend ratio 0.5
// Output: 50% progressive rock + 50% energetic music
window.matchMonkey.runMoodActivityPlaylist('energetic', null);
```

---

#### E. Activity-Based Discovery (ReccoBeats)
**Algorithm**: ReccoBeats + Last.fm hybrid with duration awareness

**Process**:
Same as mood-based but with activity optimization:
1. Duration targeting for activity length
2. Tempo/energy matching for activity type
3. Activity-specific characteristics

**Configuration**:
- `MoodActivityBlendRatio`: Same as mood mode
- `DefaultActivity`: workout, study, party, sleep, driving
- `HybridMode`: Enable hybrid mode (default: true)

**Best For**:
- Activity-specific playlists
- Duration-constrained sessions
- Context-aware music (workout, study, etc.)

**Example**:
```javascript
// Input: Metal tracks selected, duration 90 minutes
// Output: 90-minute workout mix (heavy metal emphasis)
window.matchMonkey.runMoodActivityPlaylist(null, 'workout');
```

---

### 2. Intelligent Library Matching

**Multi-Pass Matching Algorithm**:

#### Pass 1: Exact Match
- Case-insensitive title matching
- Exact artist name matching
- Fastest, highest confidence

#### Pass 2: Normalized Match
- Strips punctuation, special characters
- Handles "Rock 'n' Roll" vs "Rock and Roll"
- Normalizes spacing and case

#### Pass 3: Partial Match
- Word-based matching (3+ character words)
- Catches remastered versions
- Matches featured artist variations
- Example: "Song (Remastered)" matches "Song"

**Deduplication**:
- Groups by `artist|title` key (case-insensitive)
- When duplicates found:
  1. Prefer higher bitrate
  2. Then prefer higher rating
- Prevents same track from appearing multiple times

**Artist Prefix Handling**:
- "The Beatles" matches "Beatles, The"
- "Beatles" matches both formats
- Respects MediaMonkey's ignore prefix settings

---

### 3. Advanced Filtering System

#### Rating Filter
- **MinRating** (0-100): Exclude tracks below threshold
- **IncludeUnrated** (boolean): Allow unrated tracks
- Applied after library matching, before final selection

#### Blacklist Filters
- **ArtistBlacklist**: Comma-separated artist names to exclude
  - Case-insensitive matching
  - Applied during discovery phase
  - Example: "Christmas Artists, Holiday Music"

- **GenreBlacklist**: Comma-separated genres to exclude
  - Checks track genre metadata
  - Case-insensitive matching
  - Example: "Christmas, Holiday, Kids"

- **TitleExclusions**: Comma-separated words to exclude from titles
  - Partial matching within title
  - Case-insensitive
  - Example: "Live, Remix, Demo, Karaoke"

#### Quality Preference
- **PreferHighQuality**: When enabled:
  - Selects highest bitrate when duplicates exist
  - Breaks ties with rating
  - Ensures best audio quality

---

### 4. Ranking and Sorting

#### Last.fm Popularity Ranking
- **UseLastfmRanking**: When enabled:
  - Fetches playcount data from Last.fm
  - Sorts tracks by popularity (highest first)
  - Popular tracks appear earlier in playlist
  - Disabled: Random or track order preserved

#### Randomization
- **ShuffleResults**: When enabled:
  - Fisher-Yates shuffle algorithm
  - Prevents artist clustering
  - Provides variety in listening order

**Combined Effect**:
- Ranking ON + Shuffle OFF = Popular tracks first
- Ranking ON + Shuffle ON = Popular tracks, randomized
- Ranking OFF + Shuffle ON = Random order
- Ranking OFF + Shuffle OFF = Discovery order

---

### 5. Auto-Queue (Endless Playback)

**Concept**: Automatically adds similar tracks when Now Playing queue is nearly empty.

**Trigger Condition**:
- Monitors Now Playing queue
- Triggers when ? 2 tracks remain
- Prevents gaps in playback

**Process**:
1. Use last N tracks as seeds (AutoModeSeedLimit)
2. Run discovery (AutoModeDiscovery mode)
3. Limit results (AutoModeMaxTracks)
4. Add to Now Playing queue
5. Skip duplicates if enabled

**Configuration**:
- **AutoModeEnabled**: Enable/disable auto-queue
- **AutoModeDiscovery**: Artist/Track/Genre mode
- **AutoModeSeedLimit**: Seeds to process (default: 2)
- **AutoModeSimilarLimit**: Similar artists per seed (default: 10)
- **AutoModeTracksPerArtist**: Tracks per artist (default: 5)
- **AutoModeMaxTracks**: Max tracks per trigger (default: 30)
- **SkipDuplicates**: Skip tracks already in queue

**Performance Optimization**:
- Uses conservative limits for speed
- Caches API responses
- Asynchronous operation (doesn't block playback)

**Use Cases**:
- Background music during work
- Party playlists that never end
- Discovery radio station effect
- Long listening sessions

---

### 6. Playlist Management

#### Playlist Creation Modes

**A. Create New Playlist**
- Creates new playlist with generated name
- Template: `PlaylistName` (use `%` for artist)
- Example: "Similar to Pink Floyd"
- Optionally under `ParentPlaylist`

**B. Overwrite Existing Playlist**
- Finds playlist by name
- Clears existing tracks
- Adds new tracks
- Preserves playlist metadata

**C. Do Not Create Playlist**
- Skips playlist creation
- Must have `EnqueueMode` enabled
- Adds directly to Now Playing

#### Parent Playlist Organization
- **ParentPlaylist**: Name of parent playlist
- Creates child playlists under parent
- Hierarchical organization
- Example: All discovery playlists under "Auto-Generated"

#### Confirmation Dialog
- **ShowConfirmDialog**: When enabled:
  - Shows playlist selection dialog
  - Allows manual playlist selection
  - Can create new or choose existing
  - Cancel aborts operation

---

### 7. Queue Behavior

#### Enqueue Mode
- **EnqueueMode**: When enabled:
  - Bypasses playlist creation
  - Adds tracks directly to Now Playing
  - Useful for quick listening

#### Queue Management
- **ClearQueueFirst**: When enabled:
  - Clears Now Playing before adding
  - Fresh start for new session

- **SkipDuplicates**: When enabled:
  - Checks if track already in queue
  - Skips duplicate entries
  - Prevents repetition

#### Navigation After Completion
- **NavigateAfter** options:
  1. **Navigate to new playlist**: Opens newly created playlist
  2. **Navigate to now playing**: Switches to Now Playing view
  3. **Stay in current view**: No navigation change

---

### 8. Progress Tracking

**Real-Time Progress Indicators**:
- Background task system (MediaMonkey 5 API)
- Progress bar with percentage
- Descriptive status messages
- Example messages:
  - "Finding similar artists to Pink Floyd..."
  - "Searching local library..."
  - "Building playlist..."

**Console Logging**:
- Detailed operation logs
- API call tracking
- Performance metrics
- Error messages

---

### 9. Caching System

**Per-Session Caching**:
- **Scope**: Single add-on run
- **Cached Data**:
  - Last.fm similar artists
  - Last.fm top tracks
  - Last.fm artist info
  - ReccoBeats mood/activity results

**Benefits**:
- Reduces API calls
- Faster subsequent operations
- Respects API rate limits

**Cache Clearing**:
- Automatically cleared on MediaMonkey restart
- Cleared after each `runMatchMonkey()` completion
- Forces fresh data on new session

---

### 10. Seed Artist Inclusion

**Configuration**: `IncludeSeedArtist`

**When Enabled**:
- Includes tracks from original seed artists
- Adds at beginning of discovery pool
- Ensures familiar artists in results

**When Disabled**:
- Excludes seed artists completely
- Only similar/discovered artists
- Maximum discovery/variety

**Effect on Results**:
- Enabled: More familiar, safer playlists
- Disabled: More adventurous, discovery-focused

---

## Configuration Matrix

### Discovery Mode vs Settings

| Setting | Artist | Track | Genre | Mood | Activity |
|---------|--------|-------|-------|------|----------|
| SimilarArtistsLimit | ? Primary | ? Not used | ? Primary | ? Seed component | ? Seed component |
| TrackSimilarLimit | ? Not used | ? Primary | ? Not used | ? Not used | ? Not used |
| TracksPerArtist | ? Used | ? Used | ? Used | ? Used | ? Used |
| IncludeSeedArtist | ? Used | ? Used | ? Used | ? Used | ? Used |
| MoodActivityBlendRatio | ? Not used | ? Not used | ? Not used | ? Primary | ? Primary |

---

## Performance Characteristics

### Speed Comparison

| Mode | Speed | API Calls | Cache Benefit |
|------|-------|-----------|---------------|
| Artist | Fast | Low | High |
| Track | Medium | Medium | Medium |
| Genre | Medium | Medium | Medium |
| Mood | Medium | Medium-High | High |
| Activity | Medium | Medium-High | High |

### Resource Usage

| Setting | CPU | Memory | Network |
|---------|-----|--------|---------|
| High Similar Limit | Low | Medium | High |
| High Tracks/Artist | Medium | Medium | Low |
| High Track Similar Limit | Low | Medium | Very High |
| Mood/Activity | Medium | Medium | High |

---

## Use Case Recommendations

### Quick Familiar Playlist
```
Mode: Artist
SimilarArtistsLimit: 10
TracksPerArtist: 20
IncludeSeedArtist: true
ShuffleResults: true
```

### Deep Discovery
```
Mode: Track
TrackSimilarLimit: 200
TracksPerArtist: 40
IncludeSeedArtist: false
ShuffleResults: true
```

### Genre Exploration
```
Mode: Genre
SimilarArtistsLimit: 30
TracksPerArtist: 30
UseLastfmRanking: true
```

### Mood-Based Personalized
```
Mode: Mood
MoodActivityBlendRatio: 0.5
HybridMode: true
IncludeSeedArtist: true
```

### Activity-Optimized
```
Mode: Activity
MoodActivityBlendRatio: 0.6
HybridMode: true
```

### Endless Background Music
```
AutoModeEnabled: true
AutoModeDiscovery: Track
AutoModeSeedLimit: 2
AutoModeMaxTracks: 30
```

---

## Integration Points

### MediaMonkey 5 APIs Used
- `app.player` - Playback monitoring
- `app.playlists` - Playlist management
- `uitools.getSelectedTracklist()` - Track selection
- `backgroundTasks` - Progress tracking
- `app.getValue/setValue` - Settings storage

### External APIs
- **Last.fm API v2.0**
  - `artist.getSimilar`
  - `track.getSimilar`
  - `tag.getTopArtists`
  - `artist.getInfo`
  - `artist.getTopTracks`

- **ReccoBeats API v1**
  - `/recommendations/mood`
  - `/recommendations/activity`

---

## Compatibility Notes

- **Requires**: MediaMonkey 5.0+
- **Platform**: Windows only
- **Database**: SQLite (MediaMonkey's database)
- **Internet**: Required for API calls
- **APIs**: Last.fm (free), ReccoBeats (check their terms)

---

## Future Enhancement Possibilities

1. **Multi-seed weighting**: Weight different seeds differently
2. **Time-of-day awareness**: Adapt to listening time
3. **Listening history integration**: Learn from playback patterns
4. **Collaborative filtering**: User preference learning
5. **Custom mood creation**: User-defined mood characteristics
6. **Spotify/Deezer integration**: Additional discovery sources
7. **BPM filtering**: Tempo range constraints
8. **Playlist duration targeting**: Hit exact time targets
9. **Artist diversity**: Ensure no artist dominates
10. **Language filtering**: Filter by track language

---

## Complete Settings Reference

See [Configuration Settings](#configuration-settings) section in QUICK_REFERENCE.md for detailed settings documentation.

---

## Documentation Links

- **Quick Start**: `docs/QUICKSTART.md`
- **Quick Reference**: `docs/QUICK_REFERENCE.md`
- **ReccoBeats Guide**: `docs/RECCOBEATS_INTEGRATION.md`
- **Examples**: `docs/EXAMPLES_TUTORIAL.md`
- **UI Guide**: `docs/UI_CONFIGURATION_GUIDE.md`
- **Implementation**: `docs/IMPLEMENTATION_SUMMARY.md`

---

## Support

- **Issues**: https://github.com/remo-imparato/SimilarArtistsMM5/issues
- **Email**: rimparato@hotmail.com
- **Ko-fi**: https://ko-fi.com/remoimparato
