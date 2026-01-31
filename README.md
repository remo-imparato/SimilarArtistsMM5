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
- 🔄 **Prefix Handling**: Handles common artist prefix patterns (e.g., `The Beatles` ⇄ `Beatles, The`) and respects MediaMonkey prefix settings
- 🛠️ **MM5 Best Practices**: Uses MM5 APIs and persistent track references where available

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

```javascript
// Generate workout playlist (activity)
window.matchMonkey.runMoodActivityPlaylist(null, 'workout');

// Generate happy mood playlist
window.matchMonkey.runMoodActivityPlaylist('happy', null);

// Use defaults from settings
window.matchMonkey.runMoodActivityPlaylist();
