/**
 * Library Search Module
 *
 * Handles searching for tracks in the MediaMonkey library by matching
 * artist names and track titles. Supports both single and batch lookups
 * with configurable filtering options.
 *
 * @module modules/db/library
 * @requires ../utils/sql       - SQL query building utilities
 * @requires ../utils/helpers   - General helper functions
 * @requires ../settings/prefixes - Artist name prefix handling
 */

'use strict';

/**
 * Find tracks in the library matching a single artist name and optional track titles.
 *
 * Searches the MediaMonkey library for tracks by a specified artist.
 * Optionally filters to specific track titles for more precise matching.
 * Supports filtering by rating and genre through options.
 *
 * @async
 * @function findLibraryTracks
 * @param {string} artistName - Artist to search for (will be normalized with prefix stripping)
 * @param {string|string[]} [trackTitles] - Optional specific track title(s) to match
 * @param {number} [limit=100] - Maximum number of tracks to return
 * @param {object} [options={}] - Query options
 * @param {boolean} [options.rank=true] - Include ranking in results
 * @param {boolean} [options.best=false] - Only include highly-rated tracks
 * @param {number} [options.minRating=0] - Minimum rating threshold (0-100)
 * @returns {Promise<object[]>} Array of matching track objects with fields:
 *   - id: unique track identifier
 *   - title: track title
 *   - artist: artist name
 *   - album: album name
 *   - path: file path
 *   - playCount: number of times played
 *
 * @example
 * // Find any tracks by Pink Floyd
 * const tracks = await findLibraryTracks('Pink Floyd', null, 20);
 *
 * @example
 * // Find specific Pink Floyd tracks
 * const tracks = await findLibraryTracks(
 *   'Pink Floyd',
 *   ['Time', 'Money', 'Us and Them'],
 *   10
 * );
 *
 * @example
 * // Find high-rated The Beatles tracks
 * const tracks = await findLibraryTracks(
 *   'The Beatles',
 *   null,
 *   50,
 *   { best: true, minRating: 80 }
 * );
 */
async function findLibraryTracks(artistName, trackTitles, limit = 100, options = {}) {
	try {
		const { rank = true, best = false, minRating = 0 } = options;

		const normalizedArtist = window.fixPrefixes(artistName);
		if (!normalizedArtist) {
			console.warn('findLibraryTracks: Invalid artist name');
			return [];
		}

		// IMPORTANT: Do NOT default to 80 when best is enabled.
		// Always use the configured rating setting (passed in as minRating).
		const ratingThreshold = Number(minRating) || 0;

		// Use the same artist join strategy as the working monolithic implementation.
		// NOTE: MM5 schema uses Songs.ID, Songs.SongTitle, Songs.Rating (not SongID/SongRating/SongArtist).
		const quote = (s) => window.quoteSqlString(String(s ?? ''));
		const escape = (s) => window.escapeSql(String(s ?? ''));

		const artistClause = (() => {
			const artistConds = [];
			const add = (name) => {
				const n = String(name || '').trim();
				if (!n) return;
				artistConds.push(`Artists.Artist = ${quote(escape(n))}`);
			};

			add(normalizedArtist);

			// prefix variations
			try {
				const prefixes = window.similarArtistsPrefixes?.getIgnorePrefixes
					? window.similarArtistsPrefixes.getIgnorePrefixes()
					: (window.getIgnorePrefixes ? window.getIgnorePrefixes() : []);
				const nameLower = normalizedArtist.toLowerCase();
				for (const prefix of prefixes || []) {
					const p = String(prefix || '').trim();
					if (!p) continue;

					if (nameLower.startsWith(p.toLowerCase() + ' ')) {
						const withoutPrefix = normalizedArtist.slice(p.length + 1).trim();
						add(`${withoutPrefix}, ${p}`);
					} else {
						add(`${normalizedArtist}, ${p}`);
						add(`${p} ${normalizedArtist}`);
					}
				}
			} catch (_) {
				// ignore
			}

			return artistConds.length ? `(${artistConds.join(' OR ')})` : '';
		})();

		const titleClause = (() => {
			if (!trackTitles) return '';
			const titles = Array.isArray(trackTitles) ? trackTitles : [trackTitles];
			const nonEmpty = titles.map(t => String(t || '').trim()).filter(Boolean);
			if (!nonEmpty.length) return '';
			const conds = nonEmpty.map(t => `UPPER(Songs.SongTitle) LIKE '%${escape(t.toUpperCase())}%'`);
			return `(${conds.join(' OR ')})`;
		})();

		const where = [];
		if (artistClause) where.push(artistClause);
		if (titleClause) where.push(titleClause);
		if (ratingThreshold > 0) where.push(`(Songs.Rating >= ${Number(ratingThreshold)})`);

		const orderClause = rank
			? (best ? 'ORDER BY Songs.Rating DESC, Random()' : 'ORDER BY Random()')
			: (best ? 'ORDER BY Songs.Rating DESC, Random()' : 'ORDER BY Random()');

		const query = `
			SELECT Songs.*
			FROM Songs
			INNER JOIN ArtistsSongs 
				on Songs.ID = ArtistsSongs.IDSong 
				AND ArtistsSongs.PersonType = 1
			INNER JOIN Artists 
				on ArtistsSongs.IDArtist = Artists.ID
			${where.length ? 'WHERE ' + where.join(' AND ') : ''}
			${orderClause}
			LIMIT ${Math.max(1, Math.min(limit, 10000))}
		`;

		if (typeof app !== 'undefined' && app.db && app.db.getTracklist) {
			const tracklist = app.db.getTracklist(query, -1);
			if (!tracklist) return [];

			tracklist.autoUpdateDisabled = true;
			tracklist.dontNotify = true;

			await tracklist.whenLoaded();

			const results = [];
			// Preferred: locked + getFastObject (fast + explicit lock)
			if (typeof tracklist.locked === 'function') {
				tracklist.locked(() => {
					let tmp;
					for (let i = 0; i < (tracklist.count || 0); i++) {
						tmp = tracklist.getFastObject ? tracklist.getFastObject(i, tmp) : null;
						if (tmp) {
							results.push(tmp);
						}
					}
				});
			} else if (typeof tracklist.forEach === 'function') {
				// Fallback like aa_orig_SimilarArtist.js: forEach acquires read lock internally
				tracklist.forEach((t) => {
					if (t) {
						results.push(t);
					}
				});
			} else {
				console.warn('findLibraryTracks: Tracklist cannot be iterated safely (no locked()/forEach()).');
			}

			tracklist.autoUpdateDisabled = false;
			tracklist.dontNotify = false;

			// Log a single summary of matched tracks
			if (results.length > 0) {
				const summary = results.map(r => `${r.ID || r.id || ''}:${(r.SongTitle || r.title || '').replace(/"/g, "'")} by ${(r.Artist || r.artist || '').replace(/"/g, "'")}`).join(' ; ');
				console.log(`findLibraryTracks: matched ${results.length} local track(s): ${summary}`);
			}

			return results;
		}

		console.warn('findLibraryTracks: app.db.getTracklist not available, returning empty');
		return [];
	} catch (e) {
		console.error('findLibraryTracks error: ' + e.toString());
		return [];
	}
}

/**
 * Find tracks in the library using batch lookups for multiple artist/title combinations.
 *
 * More efficient than multiple sequential findLibraryTracks calls.
 * Returns a Map of title -> [matching tracks] for easy lookup.
 *
 * @async
 * @function findLibraryTracksBatch
 * @param {string} artistName - Artist to search for
 * @param {string[]} trackTitles - Array of track titles to find
 * @param {number} [limit=100] - Max tracks per title
 * @param {object} [options={}] - Query options (same as findLibraryTracks)
 * @returns {Promise<Map<string, object[]>>} Map of title -> matched tracks
 *
 * @example
 * // Find all tracks across multiple titles efficiently
 * const titleMap = await findLibraryTracksBatch(
 *   'Pink Floyd',
 *   ['Time', 'Money', 'Us and Them'],
 *   5
 * );
 *
 * // Access results by title
 * const timeMatches = titleMap.get('Time');
 * const moneyMatches = titleMap.get('Money');
 */
async function findLibraryTracksBatch(artistName, trackTitles, limit = 100, options = {}) {
	const resultMap = new Map();

	if (!Array.isArray(trackTitles) || trackTitles.length === 0) {
		return resultMap;
	}

	for (const title of trackTitles) {
		resultMap.set(title, []);
	}

	try {
		const normalizedArtist = window.fixPrefixes(artistName);
		if (!normalizedArtist) {
			console.warn('findLibraryTracksBatch: Invalid artist name');
			return resultMap;
		}

		const { best = false, minRating = 0, allowUnknown = false } = options;

		// IMPORTANT: Do NOT default to 80 when best is enabled.
		// Always use the configured rating setting (passed in as minRating).
		const ratingThreshold = Number(minRating) || 0;

		const quote = (s) => window.quoteSqlString(String(s ?? ''));
		const escape = (s) => window.escapeSql(String(s ?? ''));

		// Prepare requested titles and a normalized variant for fuzzy matching.
		const wanted = trackTitles
			.map((t, idx) => {
				const raw = String(t || '').trim();
				return {
					idx,
					raw,
					rawUpper: raw.toUpperCase(),
					norm: (window.stripName ? window.stripName(raw) : raw.toUpperCase().replace(/\W/g, '')),
				};
			})
			.filter(r => r.raw.length > 0);

		if (wanted.length === 0) return resultMap;

		const wantedValuesSql = wanted
			.map(r => `(${r.idx}, '${escape(r.raw)}', '${escape(r.rawUpper)}', '${escape(r.norm)}')`)
			.join(',');

		// Artist matching like original (ArtistsSongs + Artists)
		const artistClause = (() => {
			const artistConds = [];
			const add = (name) => {
				const n = String(name || '').trim();
				if (!n) return;
				artistConds.push(`Artists.Artist = ${quote(escape(n))}`);
			};

			add(normalizedArtist);

			try {
				const prefixes = window.similarArtistsPrefixes?.getIgnorePrefixes
					? window.similarArtistsPrefixes.getIgnorePrefixes()
					: (window.getIgnorePrefixes ? window.getIgnorePrefixes() : []);
				const nameLower = normalizedArtist.toLowerCase();
				for (const prefix of prefixes || []) {
					const p = String(prefix || '').trim();
					if (!p) continue;

					if (nameLower.startsWith(p.toLowerCase() + ' ')) {
						const withoutPrefix = normalizedArtist.slice(p.length + 1).trim();
						add(`${withoutPrefix}, ${p}`);
					} else {
						add(`${normalizedArtist}, ${p}`);
						add(`${p} ${normalizedArtist}`);
					}
				}
			} catch (_) {
				// ignore
			}

			return artistConds.length ? `(${artistConds.join(' OR ')})` : '';
		})();

		// SQL-side normalization expression (aligned with stripName usage)
		const songTitleNormExpr =
			"REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(" +
			"REPLACE(REPLACE(REPLACE(REPLACE(" +
			"UPPER(Songs.SongTitle)," +
			"'&','AND'),'+','AND'),' N ','AND'),'''N''','AND'),' ',''),'.','')," +
			"',',''),':',''),';',''),'-',''),'_',''),'!',''),'''',''),'\"','')";

		const whereParts = [];
		if (artistClause) whereParts.push(artistClause);
		whereParts.push(`(UPPER(Songs.SongTitle) = Wanted.RawUpper OR ${songTitleNormExpr} = Wanted.Norm)`);

		if (ratingThreshold > 0) {
			if (allowUnknown) {
				whereParts.push(`(Songs.Rating < 0 OR Songs.Rating >= ${Number(ratingThreshold)})`);
			} else {
				whereParts.push(`(Songs.Rating >= ${Number(ratingThreshold)} AND Songs.Rating <= 100)`);
			}
		} else if (!allowUnknown) {
			whereParts.push(`(Songs.Rating >= 0 AND Songs.Rating <= 100)`);
		}

		const orderClause = best ? ' ORDER BY Songs.Rating DESC, Random()' : ' ORDER BY Random()';

		const query = `
			WITH Wanted(Idx, Raw, RawUpper, Norm) AS (VALUES ${wantedValuesSql})
			SELECT Songs.*, Wanted.Raw AS RequestedTitle
			FROM Songs
			INNER JOIN ArtistsSongs 
				on Songs.ID = ArtistsSongs.IDSong 
				AND ArtistsSongs.PersonType = 1
			INNER JOIN Artists 
				on ArtistsSongs.IDArtist = Artists.ID
			INNER JOIN Wanted
				ON (UPPER(Songs.SongTitle) = Wanted.RawUpper OR ${songTitleNormExpr} = Wanted.Norm)
			WHERE ${whereParts.join(' AND ')}
			${orderClause}
			LIMIT ${Math.max(1, Math.min(limit * wanted.length, 10000))}
		`;

		if (typeof app !== 'undefined' && app.db && app.db.getTracklist) {
			const tl = app.db.getTracklist(query, -1);
			if (!tl) return resultMap;

			tl.autoUpdateDisabled = true;
			tl.dontNotify = true;

			await tl.whenLoaded();

			// Iterate safely: prefer locked()+getFastObject, else fall back to forEach (original behavior)
			if (typeof tl.locked === 'function') {
				tl.locked(() => {
					let tmp;
					for (let i = 0; i < (tl.count || 0); i++) {
						tmp = tl.getFastObject ? tl.getFastObject(i, tmp) : null;
						if (!tmp) continue;

						const key = String(tmp.title);
						if (!resultMap.has(key))
							continue;
						const arr = resultMap.get(key);
						if (arr.length < limit) {
							arr.push(tmp);
						}
					}
				});
			} else if (typeof tl.forEach === 'function') {
				// Fallback like aa_orig_SimilarArtist.js
				tl.forEach((t) => {
					if (!t) return;

					const key = String(tmp.title);
					if (!resultMap.has(key))
						return;
					const arr = resultMap.get(key);
					if (arr.length < limit) {
						arr.push(t);
					}
				});
			} else {
				console.warn('findLibraryTracksBatch: Tracklist cannot be iterated safely (no locked()/forEach()).');
			}

			// Summarize all matches into a single log statement
			{
				const allMatches = [];
				for (const [req, arr] of resultMap.entries()) {
					for (const t of arr) {
						allMatches.push(`${(t.SongTitle || t.title || '').replace(/"/g, "'")}`);
					}
				}
				if (allMatches.length > 0) {
					console.log(`findLibraryTracksBatch: found ${allMatches.length} local match(es): ${allMatches.join(' ; ')}`);
				}
			}

			tl.autoUpdateDisabled = false;
			tl.dontNotify = false;

			return resultMap;
		}
	} catch (e) {
		console.error('findLibraryTracksBatch error: ' + e.toString());
	}

	return resultMap;
}

// Export to window namespace for MM5
window.dbLibrary = {
	findLibraryTracks,
	findLibraryTracksBatch,
};
