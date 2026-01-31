# MatchMonkey Quick Start Guide

## What is MatchMonkey?

MatchMonkey is a MediaMonkey 5 add-on that generates playlists or queues tracks by finding music related to your seeds using:
- Last.fm — artist and track similarity, top tracks and tag/genre lookups
- ReccoBeats — audio-feature ("acoustics") recommendations and mood/activity presets
- Your local library — matching results to the files you already own

---

## Quick setup (30–60 seconds)

1. Open MediaMonkey 5
2. Select 1–5 seed tracks in your library (or start playing a track)
3. Open Developer Console (F12) if you want to run from the console
4. Use the add-on UI or the context menu to start discovery

---

## Discovery modes (what to use and when)

- `artist`  — Use an artist seed to find similar artists (Last.fm). Good for exploring related artists and getting top tracks.
- `track`   — Use a track seed to find musically similar tracks (Last.fm). Good for covers, versions, and sonically similar songs.
- `genre`   — Use genres/tags from seeds to find popular artists in those genres (Last.fm). Good for broad genre exploration.
- `acoustics` — ReccoBeats recommendations based on seed tracks (audio-feature driven). Requires seed tracks for best results.
- `mood` / `activity` — Use ReccoBeats mood/activity presets blended with seed audio features. These modes are seed-aware and perform best with seed tracks present.

Note: Mood and Activity flows compute or blend audio features from seed tracks and then request/filter recommendations. If no seeds are available (or ReccoBeats cannot find the seed track IDs) those flows may return no candidates.

---

## Seed selection & include-seed behavior

- Seeds come from your selected tracks or the currently playing track when nothing is selected.
- There is an "Include seed track" option in the settings, but the orchestration currently contains a TODO: the add-on does not yet automatically insert the original seed track into the final playlist.

---

## Auto-Queue (Auto-mode)

- Enable Auto-mode in Tools → Options → Match Monkey (setting `AutoModeEnabled`).
- Auto-mode attaches a playback listener and triggers discovery when Now Playing is near the end.
- Default trigger threshold in code is `3` remaining entries (configurable). Auto-mode prevents concurrent triggers, includes cooldowns and will try fallback discovery modes when the preferred mode returns no results.

---

## Quick tips

- For targeted results use `track` or `artist` mode.
- For broader exploration use `genre` or `acoustics` (ReccoBeats).
- For mood/activity playlists prefer `mood` / `activity` with 3–5 representative seeds.
- Use the blend ratio setting to control how much the seed audio profile influences mood/activity results.

---

## Troubleshooting (short)

- No results: select seed tracks, lower minimum rating filters, enable "Include unrated".
- Too random: increase seed influence (blend ratio) or use `artist`/`track` mode.
- Slow: reduce similar artists limit or tracks-per-artist limits in settings.
- Auto-queue not triggering: verify Auto-mode is enabled and Now Playing is near its end; check the console for errors.

---

## Where to configure

Tools → Options → Match Monkey — adjust discovery mode defaults, limits, mood/activity blend, playlist behavior, and auto-mode settings.

---