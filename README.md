# SimilarArtists for MediaMonkey 5

**Automatically generate playlists or queue tracks from similar artists using Last.fm's powerful music recommendation engine.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![MediaMonkey](https://img.shields.io/badge/MediaMonkey-5.0%2B-green.svg)](https://www.mediamonkey.com/)

---

## 📖 Overview

SimilarArtists is a MediaMonkey 5 add-on that leverages the Last.fm API to discover and play music from artists similar to those in your library. Whether you're looking to explore new music or create dynamic playlists based on your favorite artists, SimilarArtists makes it effortless.

### Key Features

- 🎵 **Smart Discovery**: Query Last.fm for similar artists based on selected tracks or currently playing music
- 🎯 **Intelligent Matching**: Advanced multi-pass fuzzy matching finds tracks in your local library with high accuracy
- 📋 **Flexible Output**: Create new playlists, overwrite existing ones, or queue tracks directly to Now Playing
- 🤖 **Auto-Queue Mode**: Automatically queue similar tracks when approaching the end of your playlist
- ⭐ **Ranking System**: Prioritize popular tracks using Last.fm's popularity rankings
- 🎛️ **Advanced Filtering**: Filter by genre, rating, artist blacklist, and title exclusions
- 🎲 **Randomization**: Optionally shuffle results for varied listening experiences
- 🔄 **Prefix Handling**: Intelligent handling of artist name prefixes (e.g., "The Beatles" vs "Beatles, The")

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
2. Run the add-on via:
   - **Toolbar button** (if enabled)
   - **Tools → Similar Artists** menu
3. The add-on will:
   - Query Last.fm for similar artists
   - Search your library for matching tracks
   - Create a playlist or queue tracks based on your settings

### Auto-Queue Mode

Enable **"Automatically run when playing the last track"** in settings to have SimilarArtists automatically queue new tracks when your playlist is about to end—perfect for continuous, seamless listening!

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
| **Parent playlist** | Place new playlists under a parent folder |
| **Exclude artists** | Comma-separated list of artists to skip |
| **Exclude genres** | Comma-separated list of genres to filter out |
| **Exclude titles** | Skip tracks containing these words |
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

SimilarArtists uses a sophisticated **3-pass matching algorithm** to find tracks in your library:

1. **Pass 1: Exact Match** - Case-insensitive exact title matching (fastest)
2. **Pass 2: Fuzzy Match** - Normalized matching with special character handling
   - Handles variations: "Rock 'n' Roll" = "Rock and Roll"
   - Removes punctuation, spaces, and special characters
3. **Pass 3: Partial Match** - Word-based matching for difficult cases
   - Extracts significant words (3+ characters)
   - Catches remastered versions, featured artists, etc.

### Artist Name Handling

The add-on intelligently handles common artist name prefix patterns:

- **"The Beatles"** matches: `Beatles, The` and `The Beatles`
- **"Beatles"** matches: `The Beatles` and `Beatles, The`
- Respects MediaMonkey's **IgnoreTHEs** setting

---

## 🛠️ Technical Details

### Requirements

- **MediaMonkey 5.0+**
- **Last.fm API Key** (default included)
- **Internet Connection** (for Last.fm queries)

### Architecture

- **Language**: JavaScript (ES6+)
- **MM5 APIs**: Modern async patterns with `app.listen`, `uitools`, `backgroundTasks`
- **Database**: Direct SQL queries against MediaMonkey's SQLite database
- **Progress Tracking**: Real-time progress indicators via MM5's task system

### Key Functions

- `runSimilarArtists()` - Main entry point
- `processSeedArtists()` - Fetch similar artists and match tracks
- `findLibraryTracks()` - Multi-pass fuzzy matching engine
- `addTracksToTarget()` - Unified track adding with MM5 best practices
- `confirmPlaylist()` - Playlist selection dialog integration

---

## 🤝 Credits

### Authors

- **Remo Imparato** - MediaMonkey 5 port, modernization, and feature enhancements
- **GitHub Copilot (AI Assistant)** - Code refactoring, MM5 API integration, and documentation

### Original Version

- **Trixmoto** - Original SimilarArtists add-on for MediaMonkey 4
  - Forum: [MediaMonkey Forums](https://www.mediamonkey.com/forum/)
  - Original concept and implementation

### Special Thanks

- **Ventis Media** - MediaMonkey 5 platform and API
- **Last.fm** - Music recommendation API
- **MediaMonkey Community** - Testing and feedback

---

## 📝 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 🐛 Bug Reports & Feature Requests

Found a bug or have a feature idea? Please open an issue on the [GitHub Issues](https://github.com/remo-imparato/SimilarArtistsMM5/issues) page.

### Known Issues

- None currently reported

### Planned Features

- [ ] Configurable track matching sensitivity
- [ ] Support for multiple Last.fm accounts
- [ ] Integration with other music recommendation services
- [ ] Track history to avoid repetition

---

## 🔄 Changelog

### Version 2.0.0 (Current)

- ✨ Complete rewrite for MediaMonkey 5
- ✨ Modern async/await patterns throughout
- ✨ Multi-pass fuzzy track matching (75-90% accuracy)
- ✨ Improved artist prefix handling
- ✨ Real-time progress indicators
- ✨ Enhanced playlist creation workflow
- ✨ Auto-queue mode for continuous playback
- ✨ Ranking system for popularity-based sorting
- 🐛 Removed legacy MM4 fallback code
- 🐛 Fixed playlist name uniqueness logic
- 📚 Comprehensive code documentation

### Version 1.x (MediaMonkey 4)

- Original implementation by Trixmoto
- Basic Last.fm integration
- Playlist creation and enqueue support

---

## 📚 Resources

- [MediaMonkey 5 Download](https://www.mediamonkey.com/)
- [Last.fm API Documentation](https://www.last.fm/api)
- [MediaMonkey Forums](https://www.mediamonkey.com/forum/)
- [GitHub Repository](https://github.com/remo-imparato/SimilarArtistsMM5)

---

## 💡 Tips & Tricks

1. **Use Auto-Queue Mode** - Enable it in settings for endless music discovery
2. **Combine Filters** - Use genre exclusions + rating filters for curated results
3. **Seed Multiple Tracks** - Select multiple tracks for more diverse recommendations
4. **Parent Playlists** - Organize similar artist playlists under a parent folder
5. **Ranking Mode** - Enable "Select highest ranked by Last.fm" for popular tracks

---

<p align="center">
  <sub>Built with ❤️ for the MediaMonkey community</sub>
</p>