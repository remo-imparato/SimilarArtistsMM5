'use strict';

const SCRIPT_ID = 'SimilarArtists';
const API_BASE = 'https://ws.audioscrobbler.com/2.0/';
const API_KEY = '6cfe51c9bf7e77d6449e63ac0db2ac24';

const defaults = {
  Toolbar: 1, // 0=none 1=run 2=auto 3=both
  Confirm: true,
  Sort: false,
  Limit: 5,
  Name: 'Artists similar to %',
  TPA: 9999,
  TPL: 9999,
  Random: false,
  Seed: false,
  Seed2: false,
  Best: false,
  Rank: false,
  Rating: 0,
  Unknown: true,
  Overwrite: 0, // 0=create, 1=overwrite, 2=do not create playlist (enqueue only)
  Enqueue: false,
  Navigate: 0,
  OnPlay: false,
  ClearNP: false,
  Ignore: false,
  Parent: '',
  Black: '',
  Exclude: '',
  Genre: '',
};

const state = {
  autoListen: null,
};

function log(txt) {
  try {
    console.log('SimilarArtists: ' + txt);
  } catch (e) {
    // ignore
  }
}

function getSetting(key, fallback) {
  if (typeof app === 'undefined' || !app.getValue) return fallback;
  const val = app.getValue(SCRIPT_ID, key);
  if (val === undefined || val === null) return fallback;
  return val;
}

function setSetting(key, value) {
  if (typeof app === 'undefined' || !app.setValue) return;
  app.setValue(SCRIPT_ID, key, value);
}

function ensureDefaults() {
  Object.keys(defaults).forEach((k) => {
    const val = getSetting(k, null);
    if (val === null) {
      setSetting(k, defaults[k]);
    }
  });
}

function getToggleIcon() {
  return getSetting('OnPlay', false) ? 'checkbox-checked' : 'checkbox-unchecked';
}

function registerActions() {
  if (typeof app === 'undefined') return;
  const actions = app.actions || app;
  if (actions?.createAction && !actions.findAction?.(SCRIPT_ID + '.run')) {
    actions.createAction({
      id: SCRIPT_ID + '.run',
      title: 'Similar Artists',
      icon: 'script',
      execute: () => runSimilarArtists(false),
    });
  }
  if (actions?.createAction && !actions.findAction?.(SCRIPT_ID + '.toggleAuto')) {
    actions.createAction({
      id: SCRIPT_ID + '.toggleAuto',
      title: 'Similar Artists (Auto On/Off)',
      icon: getToggleIcon(),
      execute: toggleAuto,
    });
  }

  try {
    if (app.menu?.tools?.addItem) {
      app.menu.tools.addItem({ title: 'Similar Artists', action: SCRIPT_ID + '.run' });
      app.menu.tools.addItem({ title: 'Similar Artists (Auto On/Off)', action: SCRIPT_ID + '.toggleAuto' });
    }
    if (app.toolbar?.addButton) {
      const toolbarMode = Number(getSetting('Toolbar', defaults.Toolbar));
      if (toolbarMode === 1 || toolbarMode === 3) {
        app.toolbar.addButton({ id: 'sa-run', title: 'Similar Artists', action: SCRIPT_ID + '.run', icon: 31, visible: true });
      }
      if (toolbarMode === 2 || toolbarMode === 3) {
        app.toolbar.addButton({ id: 'sa-auto', title: 'Similar Artists (Auto On/Off)', action: SCRIPT_ID + '.toggleAuto', icon: getToggleIcon(), visible: true });
      }
    }
  } catch (e) {
    log(e.toString());
  }
}

function refreshToggleUI() {
  try {
    if (app.toolbar?.setButtonIcon) {
      app.toolbar.setButtonIcon('sa-auto', getToggleIcon());
    }
    if (app.actions?.updateActionIcon) {
      app.actions.updateActionIcon(SCRIPT_ID + '.toggleAuto', getToggleIcon());
    }
  } catch (e) {
    log(e.toString());
  }
}

function toggleAuto() {
  const next = !getSetting('OnPlay', false);
  setSetting('OnPlay', next);
  refreshToggleUI();
  if (next) attachAuto();
  else detachAuto();
}

function attachAuto() {
  detachAuto();
  if (typeof app === 'undefined') return;
  const player = app.player;
  if (!player) return;
  if (app.listen) {
    state.autoListen = app.listen(player, 'trackchanged', handleAuto);
  } else if (player.on) {
    state.autoListen = player.on('trackchanged', handleAuto);
  }
}

function detachAuto() {
  if (!state.autoListen) return;
  try {
    if (app.unlisten) app.unlisten(state.autoListen);
    else if (state.autoListen.off) state.autoListen.off();
  } catch (e) {
    log(e.toString());
  }
  state.autoListen = null;
}

async function handleAuto() {
  try {
    if (!getSetting('OnPlay', false)) return;
    const player = app.player;
    if (!player || !player.playlist) return;
    const list = player.playlist;
    if (typeof list.getCursor === 'function' && typeof list.count === 'function') {
      if (list.getCursor() + 2 > list.count()) {
        await runSimilarArtists(true);
      }
    }
  } catch (e) {
    log(e.toString());
  }
}

function parseListSetting(key) {
  return stringSetting(key)
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function normalizeName(name) {
  return (name || '').trim();
}

function collectSeedTracks() {
  if (typeof app === 'undefined') return [];
  let list = null;
  if (app.selection?.getTracklist) {
    list = app.selection.getTracklist();
  }
  if (!list || list.count === 0) {
    list = app.player?.getCurrentTracklist?.() || app.player?.playlist;
  }
  if (!list) return [];
  const tracks = list.toArray ? list.toArray() : list;
  const seeds = [];
  (tracks || []).forEach((t) => {
    if (t && t.artist) {
      seeds.push({ name: normalizeName(t.artist), track: t });
    }
  });
  return seeds;
}

function uniqueArtists(seeds) {
  const blacklist = new Set(parseListSetting('Black').map((s) => s.toUpperCase()));
  const set = new Set();
  const res = [];
  seeds.forEach((s) => {
    const key = s.name.toUpperCase();
    if (!set.has(key) && !blacklist.has(key)) {
      set.add(key);
      res.push(s);
    }
  });
  if (boolSetting('Sort')) {
    res.sort((a, b) => a.name.localeCompare(b.name));
  }
  return res;
}

async function runSimilarArtists(autoRun) {
  const seedsRaw = collectSeedTracks();
  const seeds = uniqueArtists(seedsRaw);
  if (!seeds.length) {
    app.messageBox?.('SimilarArtists: Select at least one track to seed the playlist.');
    return;
  }

  const progress = app.ui?.createProgress?.('SimilarArtists', seeds.length) || null;
  const artistLimit = intSetting('Limit');
  const tracksPerArtist = intSetting('TPA');
  const totalLimit = intSetting('TPL');
  const includeSeedArtist = boolSetting('Seed');
  const includeSeedTrack = boolSetting('Seed2');
  const randomise = boolSetting('Random');
  const enqueue = boolSetting('Enqueue');
  const ignoreDupes = boolSetting('Ignore');
  const clearNP = boolSetting('ClearNP');
  const overwriteMode = intSetting('Overwrite');
  const confirm = boolSetting('Confirm');
  const rankEnabled = boolSetting('Rank');
  const bestEnabled = boolSetting('Best');

  if (rankEnabled) {
    await ensureRankTable();
    await resetRankTable();
  }

  const allTracks = [];
  if (includeSeedTrack && seeds.length === 1 && seeds[0].track) {
    allTracks.push(seeds[0].track);
  }

  const seedSlice = seeds.slice(0, artistLimit || seeds.length);
  for (let i = 0; i < seedSlice.length; i++) {
    const seed = seedSlice[i];
    if (progress) {
      progress.maxValue = seedSlice.length;
      progress.value = i;
      progress.text = `Processing ${seed.name} (${i + 1}/${seedSlice.length})`;
    }
    const similar = await fetchSimilarArtists(seed.name);
    const artistPool = [];
    if (includeSeedArtist) artistPool.push(seed.name);
    similar.slice(0, artistLimit).forEach((a) => {
      if (a?.name) artistPool.push(a.name);
    });

    for (const artName of artistPool) {
      if (rankEnabled) {
        await updateRankForArtist(artName);
      }
      const titles = await fetchTopTracks(artName, tracksPerArtist);
      for (const title of titles) {
        const matches = await findLibraryTracks(artName, title, 1, { rank: rankEnabled, best: bestEnabled });
        matches.forEach((m) => allTracks.push(m));
        if (allTracks.length >= totalLimit) break;
      }
      if (allTracks.length >= totalLimit) break;
    }
    if (allTracks.length >= totalLimit) break;
  }

  if (!allTracks.length) {
    if (progress?.close) progress.close();
    app.messageBox?.('SimilarArtists: No matching tracks found in library.');
    return;
  }

  if (randomise) shuffle(allTracks);
  if (enqueue || overwriteMode === 2) {
    await enqueueTracks(allTracks, ignoreDupes, clearNP);
  } else {
    const seedName = seeds[0]?.name || 'Similar Artists';
    const proceed = !confirm || (await confirmPlaylist(seedName, overwriteMode));
    if (proceed) {
      await createPlaylist(allTracks, seedName, overwriteMode);
    }
  }
  if (progress?.close) progress.close();
}

async function confirmPlaylist(seedName, overwriteMode) {
  if (!app.messageBox) return true;
  const baseName = stringSetting('Name').replace('%', seedName || '');
  const action = overwriteMode === 1 ? 'overwrite' : 'create';
  const res = await app.messageBox(`SimilarArtists: Do you wish to ${action} playlist '${baseName}'?`, ['yes', 'no']);
  return res === 'yes';
}

async function fetchSimilarArtists(artistName) {
  try {
    const url = `${API_BASE}?method=artist.getSimilar&api_key=${API_KEY}&format=json&limit=${getSetting('Limit', defaults.Limit)}&artist=${encodeURIComponent(artistName)}`;
    const res = await fetch(url);
    const data = await res.json();
    return data?.similarartists?.artist || [];
  } catch (e) {
    log(e.toString());
    return [];
  }
}

async function fetchTopTracks(artistName, limit) {
  try {
    const url = `${API_BASE}?method=artist.getTopTracks&api_key=${API_KEY}&format=json&limit=${limit}&artist=${encodeURIComponent(artistName)}`;
    const res = await fetch(url);
    const data = await res.json();
    const tracks = data?.toptracks?.track || [];
    const titles = [];
    tracks.forEach((t) => {
      if (t?.name) titles.push(t.name);
    });
    return titles.slice(0, limit);
  } catch (e) {
    log(e.toString());
    return [];
  }
}

async function fetchTopTracksForRank(artistName) {
  return fetchTopTracks(artistName, 100);
}

async function findLibraryTracks(artistName, title, limit, opts = {}) {
  const excludeTitles = parseListSetting('Exclude');
  const excludeGenres = parseListSetting('Genre');
  const ratingMin = intSetting('Rating');
  const allowUnknown = boolSetting('Unknown');

  const titleLike = title;
  const artistLike = artistName;
  const conds = [];
  const params = [];
  if (artistLike) {
    conds.push('Artist LIKE ?');
    params.push(artistLike);
  }
  if (titleLike) {
    conds.push('SongTitle LIKE ?');
    params.push(titleLike);
  }
  excludeTitles.forEach((t) => {
    conds.push('SongTitle NOT LIKE ?');
    params.push(`%${t}%`);
  });
  if (excludeGenres.length > 0) {
    conds.push(`IDGenre NOT IN (SELECT IDGenre FROM Genres WHERE ${excludeGenres.map(() => 'GenreName LIKE ?').join(' OR ')})`);
    excludeGenres.forEach((g) => params.push(g));
  }
  if (ratingMin > 0) {
    if (allowUnknown) {
      conds.push('(Rating < 0 OR Rating > ?)');
      params.push(ratingMin - 5);
    } else {
      conds.push('(Rating > ? AND Rating < 101)');
      params.push(ratingMin - 5);
    }
  } else if (!allowUnknown) {
    conds.push('(Rating > -1 AND Rating < 101)');
  }

  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const order = [];
  if (opts.rank) order.push('TrixSongRank.Rank DESC');
  if (opts.best) order.push('Rating DESC');
  order.push('Random()');
  const orderBy = order.length ? `ORDER BY ${order.join(',')}` : '';

  try {
    if (app.db?.getTracklistBySQLAsync) {
      const sql = `SELECT Songs.* FROM Songs LEFT OUTER JOIN TrixSongRank ON Songs.ID=TrixSongRank.ID ${where} ${orderBy} LIMIT ${limit}`;
      const tl = await app.db.getTracklistBySQLAsync(sql, params);
      return tracklistToArray(tl, limit);
    }
    if (app.db?.getTracklistByQueryAsync) {
      const queryParts = [];
      if (artistName) queryParts.push(`artist:\"${artistName}\"`);
      if (title) queryParts.push(`title:\"${title}\"`);
      excludeTitles.forEach((t) => queryParts.push(`NOT title:${t}`));
      const query = queryParts.join(' AND ');
      const tl = await app.db.getTracklistByQueryAsync(query, { limit });
      return tracklistToArray(tl, limit);
    }
  } catch (e) {
    log(e.toString());
  }
  return [];
}

function tracklistToArray(list, limit) {
  if (!list) return [];
  if (list.toArray) {
    const arr = list.toArray();
    return typeof limit === 'number' ? arr.slice(0, limit) : arr;
  }
  return [];
}

async function enqueueTracks(tracks, ignoreDupes, clearFirst) {
  const player = app.player;
  if (!player) return;
  const playlist = player.playlist || player.nowPlayingQueue || player.getPlaylist?.();
  if (!playlist) return;
  if (clearFirst && playlist.clear) playlist.clear();
  const existing = new Set();
  if (ignoreDupes && playlist.toArray) {
    playlist.toArray().forEach((t) => existing.add(t.id || t.ID));
  }
  tracks.forEach((t) => {
    const id = t?.id || t?.ID;
    if (ignoreDupes && id && existing.has(id)) return;
    if (playlist.addTrack) playlist.addTrack(t);
    else if (playlist.addTracks) playlist.addTracks([t]);
    else if (player.appendTracks) player.appendTracks([t]);
  });
}

async function createPlaylist(tracks, seedName, overwriteMode) {
  const titleTemplate = stringSetting('Name');
  const baseName = titleTemplate.replace('%', seedName || '');
  let name = baseName;
  let playlist = findPlaylist(name);
  if (overwriteMode === 0) {
    let idx = 1;
    while (playlist) {
      idx += 1;
      name = `${baseName}_${idx}`;
      playlist = findPlaylist(name);
    }
  }
  if (!playlist && app.playlists?.createPlaylist) {
    playlist = app.playlists.createPlaylist(name, stringSetting('Parent'));
  }
  if (!playlist) return;
  if (overwriteMode === 1 && playlist.clear) playlist.clear();
  if (playlist.addTracks) playlist.addTracks(tracks);
  else if (playlist.addTrack) tracks.forEach((t) => playlist.addTrack(t));

  // navigation: 1 navigate to playlist, 2 navigate to now playing
  const nav = intSetting('Navigate');
  try {
    if (nav === 1 && app.ui?.navigateToPlaylist && playlist.id) {
      app.ui.navigateToPlaylist(playlist.id);
    } else if (nav === 2 && app.ui?.navigateNowPlaying) {
      app.ui.navigateNowPlaying();
    }
  } catch (e) {
    log(e.toString());
  }
}

function findPlaylist(name) {
  if (app.playlists?.findByTitle) return app.playlists.findByTitle(name);
  if (app.playlists?.getByTitle) return app.playlists.getByTitle(name);
  return null;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

async function ensureRankTable() {
  if (!app.db?.executeAsync) return;
  try {
    await app.db.executeAsync('CREATE TABLE IF NOT EXISTS TrixSongRank (ID INTEGER PRIMARY KEY, Rank INTEGER)');
  } catch (e) {
    log(e.toString());
  }
}

async function resetRankTable() {
  if (!app.db?.executeAsync) return;
  try {
    await app.db.executeAsync('DELETE FROM TrixSongRank');
  } catch (e) {
    log(e.toString());
  }
}

async function updateRankForArtist(artistName) {
  if (!artistName || !app.db?.executeAsync) return;
  const titles = await fetchTopTracksForRank(artistName);
  let rank = 101;
  for (let i = 0; i < titles.length; i++) {
    const title = titles[i];
    const matches = await findLibraryTracks(artistName, title, 5, { rank: false, best: false });
    rank = 101 - (i + 1);
    for (const m of matches) {
      await upsertRank(m.id || m.ID, rank);
    }
  }
}

async function upsertRank(id, rank) {
  if (!app.db?.executeAsync) return;
  try {
    await app.db.executeAsync('REPLACE INTO TrixSongRank (ID, Rank) VALUES (?, ?)', [id, rank]);
  } catch (e) {
    log(e.toString());
  }
}

(function start() {
  if (typeof app === 'undefined') {
    log('MediaMonkey 5 app API not found.');
    return;
  }
  ensureDefaults();
  registerActions();
  if (getSetting('OnPlay', false)) attachAuto();
})();
