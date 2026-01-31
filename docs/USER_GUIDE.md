# Match Monkey — User Guide

## What Match Monkey does

Match Monkey helps you generate playlists or add tracks to your queue by finding music related to what you already listen to. It combines online similarity data and audio-based recommendations with your local music library so you get results you can actually play.

You can search by Track, Artist, Genre, or Acoustics, and you can create Mood or Activity playlists tailored to how you want to feel or what you want to do.

---

## Quick start (2 minutes)

1. Open MediaMonkey 5.
2. Select 1–5 tracks you like (these are your "seeds"), or start playing a track.
3. Open the Match Monkey add-on from the Tools menu or toolbar.
4. Choose a discovery mode (Track, Artist, Genre, Acoustics, Mood or Activity).
5. Run the action — Match Monkey will find matching tracks in your library and either create a playlist or add them to Now Playing.

Tip: If you don't select anything, Match Monkey will use the currently playing track as a seed.

---

## Discovery modes — which one to pick

- Track
  - Best when you want songs that are similar to a specific track. Use this to find covers, alternate versions, or songs with a similar vibe.

- Artist
  - Best when you want other artists that are similar to one you like. Use this to explore related performers and collect their notable tracks.

- Genre
  - Best when you want to explore a musical style. Match Monkey will look for popular artists in the same genre and find their tracks in your library.

- Acoustics
  - Audio-based recommendations that search for tracks that match an audio profile. This mode is useful if you want recommendations driven by how songs sound (tempo, energy, mood). It works best when you provide seed tracks.
  - Important: Acoustics uses ReccoBeats to look up audio features for your seeds. For reliable results those seed tracks need very accurate artist, title and album metadata — small differences in names can prevent ReccoBeats from finding the correct recording and will reduce or prevent recommendations.

- Mood
  - Produce a playlist that matches a mood (for example: energetic, relaxed, happy, sad, focused). You can blend how much the playlist follows your seed tracks vs. the mood.

- Activity
  - Make a playlist tailored to an activity (for example: workout, study, party, sleep, driving). Like Mood mode, you can blend activity targets with your seeds for a personalized result.

Note: Mood and Activity work best with representative seed tracks — it may return fewer or no results. (AC/DC doing "Sleep" mode is unlikely to yield good matches!))

---

## How seeds work

- Seeds are the tracks you select before running Match Monkey. They inform the search and help find music that fits your taste.
- Seeds can be single songs or a small group (3–5 tracks usually gives the best balance).
- The add-on can also use the currently playing track if nothing is selected.
- Note: For Acoustics, Mood and Activity modes that use ReccoBeats lookups, seeds should include accurate Artist, Title and Album tags so the service can find the corresponding recordings and their audio features.

---

## Output options

- Playlist
  - Match Monkey can create a new playlist for the results, overwrite an existing playlist, or skip playlist creation if you prefer.

- Now Playing (Queue)
  - You can choose to add results directly to Now Playing instead of creating a playlist. There is also an Auto-Queue mode that can add tracks automatically when your queue is nearly finished.

---

## Important settings and how they affect results

These are the most useful settings to adjust if you want to change Match Monkey's behavior.

- Similar artists / tracks limits
  - Lower limits = faster runs and more focused results.
  - Higher limits = more variety but slower processing.

- Tracks per artist
  - Controls how many tracks are gathered for each suggested artist. High values give more coverage; low values keep results tight.

- Total playlist size (Max playlist tracks)
  - Caps the number of songs Match Monkey will add to a playlist. Use this to keep playlists a manageable length.

- Shuffle results
  - If enabled, the final playlist is randomized for variety.

- Rating filters (Minimum rating & Include unrated)
  - Use these to exclude low-rated tracks or include tracks without ratings.

- Prefer higher quality
  - When duplicates exist, this attempts to favor higher-quality versions (depending on your library data).

- Mood/Activity blend ratio
  - Controls how much the playlist follows your seeds vs. the mood/activity target.
  - Lower values = more anchored to your seed tracks acoustics. Higher values = more purely mood/activity preset focused.

- Auto-Queue settings
  - Enable or disable automatic queueing and choose the discovery mode and limits used by Auto-Queue.
  - Auto-Queue has a default trigger threshold and an internal cooldown to avoid repeated runs.
  - Auto-Queue will fall back to other discovery modes if the preferred mode returns no results.
---

## Auto-Queue (endless playback)

- Enable Auto-Queue to have Match Monkey keep adding songs when your Now Playing queue gets short.
- The add-on checks how many tracks remain and runs a discovery pass when the configured threshold is reached.
- Auto-Queue respects your duplicate-skipping preference so it won't re-add tracks that are already in the queue.

---

## Tips for great playlists

- Choose 3–5 representative seed tracks for varied but cohesive playlists.
- If you want new discoveries, use lower blend ratios for Mood/Activity or use Genre/Acoustics modes.
- If you want familiar music, favor higher blend ratios and Artist or Track modes.
- Reduce limits for a quick run; increase them when you want more variety.

---

## Troubleshooting

- No results
  - Make sure you have seed tracks selected or that something is playing.
  - Lower rating filters or enable "Include unrated." If your library lacks matches, try different seeds.
  - Adjust the similar-artist/track limits or tracks-per-artist settings to be less restrictive. Recommendations may not find content in your local library.
  - Check internet connectivity (needed for online services).

- Results too random
  - Increase blend ratio, select more consistent seeds, or switch to Track/Artist/Genre mode.

- Results too repetitive
  - Increase similar-artist limits or reduce tracks-per-artist, and enable shuffle.

- Auto-Queue not adding tracks
  - Confirm Auto-Queue is enabled, and that Now Playing has reached the configured low threshold.

---

## Where to change settings

Open MediaMonkey → Tools → Options → Match Monkey and adjust discovery mode, limits, playlist behavior, mood/activity options, and Auto-Queue.

---

## Need more help?

- Open an issue on the project repository if something isn't working as expected.
- Use the console (Developer tools) to view messages if you are comfortable checking for errors.

---

Enjoy exploring your music collection with Match Monkey!