/**
 * Library Search Module
 *
 * Handles searching for tracks in the MediaMonkey library by matching
 * artist names and track titles. Supports both single and batch lookups
 * with configurable filtering options.
 *
 - No MM4 fallbacks
 *
 * @module modules/db/library
 * @requires ../utils/sql       - SQL query building utilities
 * @requires ../utils/helpers   - General helper functions
 * @requires ../settings/prefixes - Artist name prefix handling
 */

'use strict';

/**
 * Find tracks in the library matching optional artist name and/or track titles.
 *
 * Searches the MediaMonkey library for tracks. Can search by artist,
 * track titles, or return random tracks from the entire library.
 * Supports filtering by rating through options.
 *
 * @async
 * @function findLibraryTracks
 * @param {string|null} artistName - Artist to search for (null for any artist)
 * @param {string|string[]|null} [trackTitles] - Optional specific track title(s) to match
 * @param {number} [limit=100] - Maximum number of tracks to return
 * @param {object} [options={}] - Query options
 * @param {boolean} [options.rank=true] - Include ranking in results
 * @param {boolean} [options.best=false] - Only include highly-rated tracks
 * @param {number} [options.minRating=0] - Minimum rating threshold (0-100)
 * @param {boolean} [options.allowUnknown=true] - Include tracks with unknown (-1) rating
 * @returns {Promise<object[]>} Array of matching track objects
 */
async function findLibraryTracks(artistName, trackTitles, limit = 100, options = {}) {
	try {
		const { rank = true, best = false, minRating = 0, allowUnknown = true } = options;

		// Validate MM5 environment
		if (typeof app === 'undefined' || !app.db || !app.db.getTracklist) {
			console.warn('findLibraryTracks: MM5 app.db.getTracklist not available');
			return [];
		}

		const ratingThreshold = Number(minRating) || 0;

		// SQL escaping helpers
		const escapeSql = (s) => String(s ?? '').replace(/'/g, "''");
		const quote = (s) => `'${escapeSql(s)}'`;

		// Build artist matching clause with prefix variations (only if artist specified)
		const artistClause = (() => {
			if (!artistName) return ''; // No artist filter
			
			const normalizedArtist = window.matchMonkeyPrefixes?.fixPrefixes?.(artistName) || artistName;
			if (!normalizedArtist) return '';

			const artistConds = [];
			const add = (name) => {
				const n = String(name || '').trim();
				if (!n) return;
				artistConds.push(`Artists.Artist = ${quote(n)}`);
			};

			add(normalizedArtist);

			// Add prefix variations
			try {
				const prefixes = window.matchMonkeyPrefixes?.getIgnorePrefixes?.() || [];
				const nameLower = normalizedArtist.toLowerCase();
				for (const prefix of prefixes) {
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
			} catch (_) { /* ignore prefix errors */ }

			return artistConds.length ? `(${artistConds.join(' OR ')})` : '';
		})();

		// Build title matching clause
		const titleClause = (() => {
			if (!trackTitles) return '';
			const titles = Array.isArray(trackTitles) ? trackTitles : [trackTitles];
			const nonEmpty = titles.map(t => String(t || '').trim()).filter(Boolean);
			if (!nonEmpty.length) return '';
			const conds = nonEmpty.map(t => `UPPER(Songs.SongTitle) LIKE '%${escapeSql(t.toUpperCase())}%'`);
			return `(${conds.join(' OR ')})`;
		})();

		// Build rating clause
		const ratingClause = (() => {
			if (ratingThreshold > 0) {
				if (allowUnknown) {
					return `(Songs.Rating < 0 OR Songs.Rating >= ${ratingThreshold})`;
				} else {
					return `(Songs.Rating >= ${ratingThreshold} AND Songs.Rating <= 100)`;
				}
			} else if (!allowUnknown) {
				return `(Songs.Rating >= 0 AND Songs.Rating <= 100)`;
			}
			return '';
		})();

		// Build WHERE clause
		const where = [];
		if (artistClause) where.push(artistClause);
		if (titleClause) where.push(titleClause);
		if (ratingClause) where.push(ratingClause);

		const orderClause = best ? 'ORDER BY Songs.Rating DESC, Random()' : 'ORDER BY Random()';

		// Different query structure depending on whether we're filtering by artist
		let query;
		if (artistClause) {
			// Query with artist join
			query = `
				SELECT Songs.*
				FROM Songs
				INNER JOIN ArtistsSongs ON Songs.ID = ArtistsSongs.IDSong AND ArtistsSongs.PersonType = 1
				INNER JOIN Artists ON ArtistsSongs.IDArtist = Artists.ID
				${where.length ? 'WHERE ' + where.join(' AND ') : ''}
				${orderClause}
				LIMIT ${Math.max(1, Math.min(limit, 10000))}
			`;
		} else {
			// Query without artist join (search entire library)
			query = `
				SELECT Songs.*
				FROM Songs
				${where.length ? 'WHERE ' + where.join(' AND ') : ''}
				${orderClause}
				LIMIT ${Math.max(1, Math.min(limit, 10000))}
			`;
		}

		// Execute query via MM5 API
		const tracklist = app.db.getTracklist(query, -1);
		if (!tracklist) return [];

		await tracklist.whenLoaded();

		// Return the tracklist directly - MM5 tracklists can be used for adding to playlists
		// We need to return track objects that can be added to a playlist
		const results = [];
		if (typeof tracklist.locked === 'function') {
			tracklist.locked(() => {
				const count = tracklist.count || 0;
				for (let i = 0; i < count; i++) {
					// Use getValue to get a persistent track reference
					const track = tracklist.getValue(i);
					if (track) results.push(track);
				}
			});
		}

		if (results.length > 0) {
			const searchDesc = artistName ? `"${artistName}"` : 'entire library';
			const summary = results.slice(0, 3).map(r => 
				`"${r.title || r.SongTitle || ''}" by ${r.artist || r.Artist || ''}`
			).join(', ');
			console.log(`findLibraryTracks: Found ${results.length} track(s) from ${searchDesc}: ${summary}${results.length > 3 ? '...' : ''}`);
		}

		return results;
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
 */
async function findLibraryTracksBatch(artistName, trackTitles, limit = 100, options = {}) {
	const resultMap = new Map();

	if (!Array.isArray(trackTitles) || trackTitles.length === 0) {
		return resultMap;
	}

	// Initialize result map with empty arrays for each title
	for (const title of trackTitles) {
		resultMap.set(title, []);
	}

	try {
		// Validate MM5 environment
		if (typeof app === 'undefined' || !app.db || !app.db.getTracklist) {
			console.warn('findLibraryTracksBatch: MM5 app.db.getTracklist not available');
			return resultMap;
		}

		const normalizedArtist = window.matchMonkeyPrefixes?.fixPrefixes?.(artistName) || artistName;
		if (!normalizedArtist) {
			console.warn('findLibraryTracksBatch: Invalid artist name');
			return resultMap;
		}

		const { best = false, minRating = 0, allowUnknown = false } = options;
		const ratingThreshold = Number(minRating) || 0;

		// SQL escaping helpers
		const escapeSql = (s) => String(s ?? '').replace(/'/g, "''");
		const quote = (s) => `'${escapeSql(s)}'`;

		// Prepare requested titles with normalized variants for fuzzy matching
		const stripName = window.stripName || ((s) => s.toUpperCase().replace(/\W/g, ''));
		const wanted = trackTitles
			.map((t, idx) => {
				const raw = String(t || '').trim();
				return {
					idx,
					raw,
					rawUpper: raw.toUpperCase(),
					norm: stripName(raw),
				};
			})
			.filter(r => r.raw.length > 0);

		if (wanted.length === 0) return resultMap;

		// Build VALUES clause for CTE
		const wantedValuesSql = wanted
			.map(r => `(${r.idx}, '${escapeSql(r.raw)}', '${escapeSql(r.rawUpper)}', '${escapeSql(r.norm)}')`)
			.join(',');

		// Build artist matching clause with prefix variations
		const artistClause = (() => {
			const artistConds = [];
			const add = (name) => {
				const n = String(name || '').trim();
				if (!n) return;
				artistConds.push(`Artists.Artist = ${quote(n)}`);
			};

			add(normalizedArtist);

			try {
				const prefixes = window.matchMonkeyPrefixes?.getIgnorePrefixes?.() || [];
				const nameLower = normalizedArtist.toLowerCase();
				for (const prefix of prefixes) {
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
			} catch (_) { /* ignore prefix errors */ }

			return artistConds.length ? `(${artistConds.join(' OR ')})` : '';
		})();

		// SQL-side normalization expression (matches stripName logic)
		const songTitleNormExpr =
			"REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(" +
			"REPLACE(REPLACE(REPLACE(REPLACE(" +
			"UPPER(Songs.SongTitle)," +
			"'&','AND'),'+','AND'),' N ','AND'),'''N''','AND'),' ',''),'.','')," +
			"',',''),':',''),';',''),'-',''),'_',''),'!',''),'''',''),'\"','')";

		// Build WHERE clause
		const whereParts = [];
		if (artistClause) whereParts.push(artistClause);
		whereParts.push(`(UPPER(Songs.SongTitle) = Wanted.RawUpper OR ${songTitleNormExpr} = Wanted.Norm)`);

		if (ratingThreshold > 0) {
			if (allowUnknown) {
				whereParts.push(`(Songs.Rating < 0 OR Songs.Rating >= ${ratingThreshold})`);
			} else {
				whereParts.push(`(Songs.Rating >= ${ratingThreshold} AND Songs.Rating <= 100)`);
			}
		} else if (!allowUnknown) {
			whereParts.push(`(Songs.Rating >= 0 AND Songs.Rating <= 100)`);
		}

		const orderClause = best ? ' ORDER BY Songs.Rating DESC, Random()' : ' ORDER BY Random()';

		const query = `
			WITH Wanted(Idx, Raw, RawUpper, Norm) AS (VALUES ${wantedValuesSql})
			SELECT Songs.*, Wanted.Raw AS RequestedTitle
			FROM Songs
			INNER JOIN ArtistsSongs ON Songs.ID = ArtistsSongs.IDSong AND ArtistsSongs.PersonType = 1
			INNER JOIN Artists ON ArtistsSongs.IDArtist = Artists.ID
			INNER JOIN Wanted ON (UPPER(Songs.SongTitle) = Wanted.RawUpper OR ${songTitleNormExpr} = Wanted.Norm)
			WHERE ${whereParts.join(' AND ')}
			${orderClause}
			LIMIT ${Math.max(1, Math.min(limit * wanted.length, 10000))}
		`;

		// Execute query via MM5 API
		const tl = app.db.getTracklist(query, -1);
		if (!tl) return resultMap;

		await tl.whenLoaded();

		// Extract results using locked() for thread-safe access (MM5 best practice)
		// Use getValue() to get persistent track references
		if (typeof tl.locked === 'function') {
			tl.locked(() => {
				const count = tl.count || 0;
				for (let i = 0; i < count; i++) {
					// Use getValue to get a persistent track reference
					const track = tl.getValue(i);
					if (!track) continue;

					// Match track to requested title
					const trackTitle = track.title || track.SongTitle || '';
					
					// Try exact match first, then fuzzy match
					for (const [reqTitle, arr] of resultMap.entries()) {
						if (arr.length >= limit) continue;
						
						const reqUpper = reqTitle.toUpperCase();
						const trackUpper = trackTitle.toUpperCase();
						const reqNorm = stripName(reqTitle);
						const trackNorm = stripName(trackTitle);
						
						if (trackUpper === reqUpper || trackNorm === reqNorm) {
							arr.push(track);
							break;
						}
					}
				}
			});
		}

		// Log summary
		let totalMatches = 0;
		for (const arr of resultMap.values()) {
			totalMatches += arr.length;
		}
		if (totalMatches > 0) {
			console.log(`findLibraryTracksBatch: Found ${totalMatches} match(es) for "${artistName}" across ${wanted.length} title(s)`);
		}

		return resultMap;
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
