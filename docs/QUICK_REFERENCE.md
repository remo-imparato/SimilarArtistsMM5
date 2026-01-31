# MatchMonkey - Complete Quick Reference

## Discovery Modes

MatchMonkey supports the following discovery modes:

### Artist-Based Discovery
- Uses Last.fm artist similarity
- Finds similar artists to your seeds
- Gets top tracks for each artist
- Best for: Genre exploration

### Track-Based Discovery
- Uses Last.fm track similarity
- Finds musically similar tracks
- Crosses artist boundaries
- Best for: Finding covers, versions, similar songs

### Genre-Based Discovery
- Uses Last.fm tag/top artists
- Extracts genres from seeds
- Gets top artists in those genres
- Best for: Broad genre exploration

### Mood-Based Discovery (ReccoBeats)
- Uses ReccoBeats recommendations blended with Last.fm
- Seed-aware (respects your taste)
- Configurable blend ratio
- Best for: Emotional context

### Activity-Based Discovery (ReccoBeats)
- Uses ReccoBeats recommendations blended with Last.fm
- Duration-aware and activity-optimized
- Best for: Specific use cases (workout, study, etc.)

---

## Quick Start

### Enable Mood/Activity Discovery

1. Open MediaMonkey 5
2. Go to Tools ? Options ? Similar Artists
3. Enable mood/activity discovery
4. Set blend ratio to a balanced value (middle position)
5. Choose default mood and activity if desired

### Generate Playlists

- Artist-Based: select artist tracks and run the discovery action
- Track-Based: select specific tracks and run the discovery action
- Genre-Based: select genre-tagged tracks and run the discovery action
- Mood-Based: select favorite tracks and run the mood discovery
- Activity-Based: select appropriate tracks and run the activity discovery

---

## Configuration Settings

### Playlist Creation

| Setting | Type | Default | Effect |
|---------|------|---------|--------|
| **PlaylistName** | String | `- Similar to %` | Template for playlist names (`%` = artist) |
| **ParentPlaylist** | String | (empty) | Parent playlist for organization |
| **PlaylistMode** | Dropdown | Create new | Create/Overwrite/Don't create |
| **ShowConfirmDialog** | Boolean | false | Show dialog before creating |
| **ShuffleResults** | Boolean | true | Randomize track order |
| **IncludeSeedArtist** | Boolean | true | Include original artists |

---

### Discovery Limits

| Setting | Type | Default | Effect |
|---------|------|---------|--------|
| **SimilarArtistsLimit** | Number | 20 | Max similar artists per seed |
| **TrackSimilarLimit** | Number | 100 | Max similar tracks per seed |
| **TracksPerArtist** | Number | 30 | Tracks to fetch per artist |
| **MaxPlaylistTracks** | Number | 0 | Final playlist size (0=unlimited) |
| **UseLastfmRanking** | Boolean | true | Sort by Last.fm popularity |
| **PreferHighQuality** | Boolean | true | Choose higher bitrate/rating |

---

### Rating Filter

| Setting | Type | Default | Effect |
|---------|------|---------|--------|
| **MinRating** | Number | 0 | Minimum track rating (0-100) |
| **IncludeUnrated** | Boolean | true | Allow tracks without ratings |

---

### Mood & Activity (ReccoBeats)

| Setting | Type | Default | Effect |
|---------|------|---------|--------|
| **DefaultMood** | Dropdown | energetic | Default mood preset |
| **DefaultActivity** | Dropdown | workout | Default activity preset |
| **HybridMode** | Boolean | true | Combine ReccoBeats + Last.fm |
| **MoodActivityBlendRatio** | Slider | 0.5 | Seed vs mood balance (0.0-1.0) |

**Mood Options**: energetic, relaxed, happy, sad, focused
**Activity Options**: workout, study, party, sleep, driving

---

### Auto-Queue (Endless Playback)

| Setting | Type | Default | Effect |
|---------|------|---------|--------|
| **AutoModeEnabled** | Boolean | false | Enable auto-queue |
| **AutoModeDiscovery** | Dropdown | Track | Discovery mode for auto-queue |
| **AutoModeSeedLimit** | Number | 2 | Seeds to process |
| **AutoModeSimilarLimit** | Number | 10 | Similar artists per seed |
| **AutoModeTracksPerArtist** | Number | 5 | Tracks per artist |
| **AutoModeMaxTracks** | Number | 30 | Max tracks per trigger |
| **SkipDuplicates** | Boolean | true | Skip tracks in queue |

---

### Queue Behavior

| Setting | Type | Default | Effect |
|---------|------|---------|--------|
| **EnqueueMode** | Boolean | false | Add to Now Playing |
| **ClearQueueFirst** | Boolean | false | Clear queue before adding |
| **NavigateAfter** | Dropdown | Navigate to new | Where to navigate after |

---

### Filters (Advanced)

| Setting | Type | Default | Effect |
|---------|------|---------|--------|
| **ArtistBlacklist** | String | (empty) | Excluded artists (comma-separated) |
| **GenreBlacklist** | String | (empty) | Excluded genres (comma-separated) |
| **TitleExclusions** | String | (empty) | Excluded title words (comma-separated) |

---

## Available Moods

- energetic — High-energy, upbeat tracks
- relaxed — Calm, chill music
- happy — Uplifting, positive vibes
- sad — Melancholic, emotional tracks
- focused — Concentration-friendly music

## Available Activities

- workout — High tempo, motivating tracks
- study — Instrumental, focus-enhancing
- party — Danceable, crowd-pleasing hits
- sleep — Soothing, ambient sounds
- driving — Engaging road trip music

---

## Troubleshooting and Performance Tips

(The rest of the file remains unchanged.)
