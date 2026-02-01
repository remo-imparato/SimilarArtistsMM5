# MatchMonkey for MediaMonkey 5/2024

**Automatically generate playlists or queue tracks from similar artists using Last.fm and optional ReccoBeats recommendations.**

[![MediaMonkey](https://img.shields.io/badge/MediaMonkey-5.0%2B-green.svg)](https://www.mediamonkey.com/)

---

## 📖 Overview

MatchMonkey is a MediaMonkey 5 add-on that leverages the Last.fm API (and optionally ReccoBeats) to discover and play music related to what you already listen to. It finds similar artists/tracks, matches results against your local library and creates playlists or enqueues tracks.

For a concise end-user guide (no technical details), see `docs/USER_GUIDE.md`.

You can run discovery by Track, Artist, Genre or Acoustics (ReccoBeats AI) — choose the discovery mode that best fits what you want to find.

### Key Features

- 🎵 **Smart Discovery**: Query Last.fm for similar artists or similar tracks based on selected or currently-playing music
- 🔎 **Search by Track, Artist, Genre & Acoustics**: Search by track title, by artist, by genre/tags, or use ReccoBeats "acoustics" recommendations to discover matching tracks in your library
- 🎯 **Intelligent Matching**: Multi-pass fuzzy matching finds tracks in your local library (exact → normalized → partial)
- 🎭 **Mood & Activity Playlists** *(NEW, seed-aware)*: Use ReccoBeats audio profiles for moods/activities—best results are obtained when seed tracks are available
- 🤝 **Hybrid Discovery (manual/flow-specific)**: ReccoBeats and Last.fm are both supported. Some discovery flows use ReccoBeats audio recommendations and Last.fm for artist expansion; there is no single always-on automatic merge of both services
- 📋 **Flexible Output**: Create new playlists, overwrite existing ones, or queue tracks directly to Now Playing
- 🤖 **Auto-Queue / Endless music**: Auto-mode can automatically queue similar tracks when Now Playing is nearing the end
- 🧭 **Deduplication**: Removes duplicate songs by `artist|title`. Current implementation keeps the first matching candidate; enhanced selection (bitrate/rating prioritization) is planned
- 🎲 **Randomization**: Optionally shuffle results for variety
- 🔄 **Prefix Handling**: Handles common name prefix and suffix patterns (e.g., `The Beatles` ⇄ `Beatles, The`) and respects MediaMonkey prefix settings
- 🛠️ **MM5 Best Practices**: Uses MM5 APIs and persistent track references where available

---

## Documentation

- [Quick Start](docs/QUICK_START.md)
- [Quick Reference](docs/QUICK_REFERENCE.md)
- [User Guide](docs/USER_GUIDE.md)
- [Examples](docs/EXAMPLES_TUTORIAL.md)
- [Donate](https://ko-fi.com/remoimparato)

---

## 🚀 Installation

1. Download the latest release from the [Releases](https://github.com/remo-imparato/SimilarArtistsMM5/releases) page
2. In MediaMonkey 5, go to **Tools → Extensions**
3. Click **Install Extension** and select the downloaded `.mmip` file
4. Restart MediaMonkey 5
5. Configure the add-on via **Tools → Options → Similar Artists**

---

## 🎮 Usage

### Basic Usage

1. **Select one or more tracks** in your library (or start playing a track)
2. Choose the discovery mode you want to use (Track, Artist, Genre, Acoustics, Mood, Activity) in the UI or context menu
3. Run the add-on via:
   - **Toolbar button** (if enabled)
   - **Tools → Similar Artists** menu
4. The add-on will:
   - Query Last.fm (or use the selected discovery mode)
   - Search your library for matching tracks
   - Create a playlist or queue tracks according to settings

### Discovery Modes

- **Artist-based** (default): Discover artists similar to seed artist(s) via Last.fm
- **Track-based**: Find tracks similar to a seed track via Last.fm
- **Genre-based**: Use Last.fm tag/top artists to explore a genre
- **Acoustic-based**: Use ReccoBeats recommendations based on seed tracks
- **Mood / Activity**: Use ReccoBeats audio presets blended with seed features — these modes are seed-aware and perform best when seed tracks are present

> Note: Mood/Activity modes are seed-aware in the current implementation. If no seed tracks or no matches are found in ReccoBeats, those discovery flows may return no candidates.

### Mood & Activity Playlists (usage)

The hybrid mode combines:
1. **Your Listening Context** - Artists similar to what you're playing (seed-based)
2. **ReccoBeats AI** - Mood/activity-appropriate track recommendations
3. **Last.fm** - Similar artist expansion and popularity data
4. **Your Library** - Local track matching with quality filters

**Blend Ratio**: Configure how much of your current listening vs mood recommendations (default 50/50)
- `0.0` = Pure mood discovery
- `0.5` = Balanced (your taste + mood)
- `1.0` = Your taste with mood filtering

**Example**: Select Pink Floyd tracks → Run "energetic" mood → Get energetic progressive rock!

### Usage guide & examples

- Single-track selection
  - Select a single track in any library pane and run `Tools → Similar Artists`.
  - The add-on uses the selected track's artist as the seed. If enabled, the original seed track can be included in results.

- Multiple-track selection
  - Select two or more tracks (from one or more artists) and run the add-on.
  - Each selected track contributes its artist as a seed; the add-on deduplicates seed artists and processes them up to the configured seed limit.

- Title or Genre based discovery 
  - Choose "Similar → By Title" to use a track title (or titles) as seeds; useful to find different versions and covers locally.
  - Choose "Similar → By Genre" to request top artists for a genre and match tracks from those artists in your library.

- No selection (use currently playing track)
  - If no tracks are selected, MatchMonkey falls back to the currently playing track and uses its artist as the seed.

- Quick enqueue to Now Playing: enable `Automatically enqueue` in settings or run in auto-mode (see below) to add tracks directly to the queue.

- Notes on behavior
  - Seed deduplication: duplicate seed artists are removed automatically and any configured blacklist is applied.
  - Confirmation (Show confirmation prompt): When enabled the add-on opens a "Select Playlist" dialog before creating or adding tracks. See the README section above for confirmation behavior details.

### Auto-Queue (Auto-mode)

The Auto-Queue feature (Auto-mode) can keep playback going by automatically queuing similar-artist tracks when your Now Playing list is nearly finished.

How it works
  - Enable Auto-mode in the add-on settings (setting `AutoModeEnabled`). When enabled the add-on attaches a playback listener.
  - When playback advances and only a small number of entries remain (the add-on uses a default threshold of 2 or fewer), it automatically runs discovery and enqueues additional tracks.
  - In auto-mode the add-on forces enqueue behavior (it will add results to Now Playing instead of creating a playlist) and uses conservative defaults for limits to avoid overfilling the queue.

Auto-mode details and tips
  - Auto-mode respects deduplication and (optionally) will avoid enqueuing tracks already present in Now Playing.
  - You can tune limits (seed artists, tracks per artist, total tracks) in settings to control how many tracks are added each trigger.
  - The add-on includes safeguards to avoid multiple simultaneous auto-run invocations and will skip auto-queue triggers while one run is in progress.

---

## ⚙️ Configuration

Access settings via **Tools → Options → Similar Artists**

### General Options

| Setting | Description |
|---------|-------------|
| **Last.fm API Key** | Your Last.fm API key (default provided, or use your own) |
| **Show confirmation prompt** | Display a dialog to select/create playlists |
| **Sort artists** | Sort seed artists alphabetically before processing |
| **Randomise playlists** | Shuffle the final track list |
| **Include seed artist** | Include tracks from the original artist |
| **Include seed track** | Include the original seed track (single seed only) |
| **Discovery mode** | Choose Artist / Title / Genre / Mood / Activity |

### Mood & Activity Options **

| Setting | Description | Default |
|---------|-------------|---------|
| **MoodDiscoveryEnabled** | Enable mood-based discovery | ☐ |
| **DefaultMood** | Default mood (energetic, relaxed, happy, sad, focused) | energetic |
| **DefaultActivity** | Default activity (workout, study, party, sleep, driving) | workout |
| **HybridMode** | Combine ReccoBeats + Last.fm (recommended) | ☑ |
| **MoodActivityBlendRatio** | Seed vs mood balance (0=all mood, 0.5=balanced, 1=all seed) | 0.5 |

### Playlist Creation

| Setting | Description | Default |
|---------|-------------|---------|
| **Playlist name** | Template for new playlists (use `%` for artist name) | `Similar - %` |
| **Playlist creation** | Create new / Overwrite / Do not create | Create new |
| **Artist limit** | Max similar artists per seed | 10 |
| **Tracks/artist** | Max tracks to fetch per artist | 5 |
| **Tracks/playlist** | Total track limit | 100 |
| **Select highest rated** | Prioritize higher-rated tracks in your library | ☐ |
| **Select highest ranked** | Prioritize Last.fm's top tracks | ☐ |

### Filters

| Setting | Description |
|---------|-------------|
| **Minimum rating** | Only include tracks with this rating or higher |
| **Include unknown rating** | Allow tracks without ratings |

### Behavior

| Setting | Description |
|---------|-------------|
| **Navigation** | Where to navigate after completion (None / New playlist / Now Playing) |
| **Auto-run on last track** | Enable auto-queue mode |
| **Automatically enqueue** | Queue tracks instead of creating playlists |
| **Clear list before enqueue** | Clear Now Playing before adding tracks |
| **Ignore recently played** | Skip tracks already in Now Playing queue |

---

## 🎯 How It Works

### Track Matching Strategy

MatchMonkey uses a sophisticated **3-pass matching algorithm** to find tracks in your library:

1. **Pass 1: Exact Match** - Case-insensitive exact title matching (fastest)
2. **Pass 2: Fuzzy Match** - Normalized matching with special character handling
   - Handles variations: "Rock 'n' Roll" = "Rock and Roll"
   - Removes punctuation, spaces, and special characters
3. **Pass 3: Partial Match** - Word-based matching for difficult cases
   - Extracts significant words (3+ characters)
   - Catches remastered versions, featured artists, etc.

When multiple versions of the same `artist|title` are found (different album/compilation), the add-on picks the best candidate using the new deduplication rules: prefer higher bitrate, then higher rating.

### Discovery by Title & Genre

- Title-based discovery uses titles as seeds and attempts to match exact and normalized titles across the library, then expands to related artists when available.
- Genre-based discovery requests top artists for a genre (via external APIs) and matches tracks for those artists in your library.

### Artist Name Handling

The add-on intelligently handles common artist name prefix patterns:

- **"The Beatles"** matches: `Beatles, The` and `The Beatles`
- Respects MediaMonkey's **IgnoreTHEs** setting
- (CDS), (feat.), feat., featureing, etc. are stripped during normalization

---

## 💡 Tips & Tricks

1. **Use Auto-Queue Mode** - Enable it in settings for endless music discovery
2. **Mood Playlists** ** - Try `runMoodActivityPlaylist('energetic', null)` for instant workout mixes
3. **Activity Context** ** - Use activity-based discovery for studying, working, or relaxing
4. **Seed Multiple Tracks** - Select multiple tracks for more diverse recommendations
5. **Ranking Mode** - Enable "Select highest ranked by Last.fm" for popular tracks
6. **Hybrid Mode** ** - Keep HybridMode enabled for best mood/activity recommendations

---

## Support

- **Issues**: https://github.com/remo-imparato/SimilarArtistsMM5/issues
- **Email**: rimparato@hotmail.com
- **Ko-fi**: https://ko-fi.com/remoimparato
- 
---

## 📝 License

Match Monkey is dual-licensed:

- **MIT License** — free for personal and non-commercial use  
- **Commercial License** — required for business or revenue-generating use  

If you plan to use Match Monkey commercially, please obtain a license:

- **Email:** rimparato@hotmail.com  
- **Donate:** https://ko-fi.com/remoimparato  
- **GitHub:** https://github.com/remo-imparato/

See the included **LICENSE** (MIT) and **license-commercial.txt** (Commercial EULA) for full terms.

- MIT License (published): https://github.com/remo-imparato/SimilarArtistsMM5/blob/updateMatchMonkey/license-mit.txt
- Commercial EULA (published): https://github.com/remo-imparato/SimilarArtistsMM5/blob/updateMatchMonkey/license-commercial.txt


---

## 🐛 Bug Reports & Feature Requests

Found a bug or have a feature idea? Please open an issue on the [GitHub Issues](https://github.com/remo-imparato/SimilarArtistsMM5/issues) page.

---

## 🤝 Credits

### Authors

- **Remo Imparato** - MediaMonkey 5 port, modernization, and feature enhancements
- **GitHub Copilot (AI Assistant)** - Code refactoring, MM5 API integration, and documentation

### Original Version

- **Trixmoto** - Original Similar Artists add-on for MediaMonkey 4
  - Forum: [MediaMonkey Forums](https://www.mediamonkey.com/forum/)
  - Original concept and implementation

### Special Thanks

- **Ventis Media** - MediaMonkey 5 platform and API
- **Last.fm** - Music recommendation API
- **ReccoBeats** - AI-powered mood and activity recommendations
- **MediaMonkey Community** - Testing and feedback

<p align="center">
  <sub>Built with ❤️ for the MediaMonkey community</sub>
</p>
