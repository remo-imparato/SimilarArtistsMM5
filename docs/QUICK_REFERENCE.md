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

## Mood Tooltips
- Energetic: High‑energy, upbeat, fast‑moving tracks
- Relaxed: Calm, mellow, chill background music
- Happy: Bright, feel‑good, upbeat pop vibes
- Sad: Soft, emotional, low‑energy songs
- Focused: Minimal, steady, distraction‑free instrumentals
- Angry: Loud, intense, aggressive high‑energy music
- Romantic: Warm, smooth, intimate love‑leaning tracks
- Uplifting: Positive, inspiring, motivational songs
- Dark: Moody, atmospheric, low‑valence tracks

## Activity Tooltips
- Workout: Fast, loud, high‑energy motivation
- Study: Quiet, steady, mostly instrumental
- Party: Danceable, upbeat, club‑ready tracks
- Sleep: Soft, slow, soothing ambient music
- Driving: Steady, feel‑good road‑trip energy
- Meditation: Calm, spacious, ambient soundscapes
- Cooking: Light, pleasant, upbeat background music
- Cleaning: Energetic, catchy, movement‑friendly
- Walking: Mid‑tempo, feel‑good everyday tracks
- Coding: Minimal, repetitive, focus‑friendly electronic

---

## Troubleshooting and Performance Tips

---

## Troubleshooting

### No Results

**Problem**: Playlist has no tracks

**Causes & Solutions**:
1. **No internet**: APIs require online access
2. **No seeds selected**: Select tracks first (except genre/mood pure discovery)
3. **Rating filter too high**: Lower MinRating or enable IncludeUnrated
4. **Blacklist too restrictive**: Check ArtistBlacklist and GenreBlacklist
5. **No library matches**: Try different seeds or discovery mode

### Results Too Random

**Problem**: Tracks don't match your taste

**Causes & Solutions**:
1. **Blend ratio too low**: Increase to 0.7 (mood/activity mode)
2. **Poor seed selection**: Select consistent genre seeds
3. **Genre mode too broad**: Use artist or track mode instead
4. **Similar limit too high**: Lower to 10-15 for focus

### Results Too Similar

**Problem**: All tracks from same artists

**Causes & Solutions**:
1. **Blend ratio too high**: Decrease to 0.3 (mood/activity mode)
2. **Similar limit too low**: Increase to 25-30
3. **Tracks per artist too high**: Lower to 10-15
4. **Try different mode**: Switch from artist to track mode
5. **Enable shuffle**: Check ShuffleResults

### Slow Performance

**Problem**: Takes too long to generate

**Causes & Solutions**:
1. **Similar limit too high**: Lower to 10-15
2. **Tracks per artist too high**: Lower to 10-20
3. **Track similar limit too high**: Lower to 50 (track mode)
4. **Use artist mode**: Fastest discovery mode
5. **Reduce max tracks**: Set MaxPlaylistTracks to 50-100

### Auto-Queue Not Working

**Problem**: No tracks added automatically

**Causes & Solutions**:
1. **Not enabled**: Check AutoModeEnabled
2. **Queue not low enough**: Needs 2 or fewer tracks left
3. **Limits too restrictive**: Check AutoModeSeedLimit, AutoModeSimilarLimit
4. **No seeds available**: Needs tracks in Now Playing history
5. **Check console**: F12 for error messages

---

## Performance Tips

1. **First Run**: Slower (API queries, no cache)
2. **Cached Runs**: Much faster (same seeds/mood)
3. **Artist Mode**: Fastest discovery mode
4. **Track Mode**: Slower (more API calls)
5. **Mood/Activity**: Medium speed (hybrid approach)
6. **Reduce Limits**: Lower for speed, higher for variety

---

## Documentation

- **Quick Start**: `docs/QUICKSTART.md`
- **Full Guide**: `docs/USER_GUIDE.md`
- **Examples**: `docs/EXAMPLES_TUTORIAL.md`

---

## Support

- **Issues**: https://github.com/remo-imparato/SimilarArtistsMM5/issues
- **Email**: rimparato@hotmail.com
- **Ko-fi**: https://ko-fi.com/remoimparato
