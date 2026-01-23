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

		// Normalize artist name (using window.fixPrefixes from prefixes.js)
		const normalizedArtist = window.fixPrefixes(artistName);
		if (!normalizedArtist) {
			console.warn('findLibraryTracks: Invalid artist name');
			return [];
		}

		// Build WHERE clause (using window.quoteSqlString and window.escapeSql from sql.js)
		let whereClause = `WHERE Songs.SongArtist LIKE ${window.quoteSqlString('%' + window.escapeSql(normalizedArtist) + '%')}`;

		// Add track title filter if provided
		if (trackTitles && (Array.isArray(trackTitles) && trackTitles.length > 0)) {
			const titles = Array.isArray(trackTitles) ? trackTitles : [trackTitles];
			const titleConditions = titles.map(t =>
				`Songs.SongTitle LIKE ${window.quoteSqlString('%' + window.escapeSql(t) + '%')}`
			).join(' OR ');
			whereClause += ` AND (${titleConditions})`;
		}

		// Add rating filter if specified
		// Use configured minRating value, or fall back to 'best' mode with rating 80
		const ratingThreshold = minRating > 0 ? minRating : (best ? 80 : 0);
		
		if (ratingThreshold > 0) {
			whereClause += ` AND Songs.SongRating >= ${ratingThreshold}`;
		}

		// Build ORDER clause - prioritize by rating and play count
		let orderClause = 'ORDER BY Songs.SongRating DESC, Songs.PlayCounter DESC';
		if (rank) {
			orderClause = 'ORDER BY Songs.SongRating DESC, Songs.PlayCounter DESC, Songs.SongTitle ASC';
		}

		// Execute query via MediaMonkey API
		const query = `
			SELECT 
				Songs.SongID as id,
				Songs.SongTitle as title,
				Songs.SongArtist as artist,
				Songs.AlbumName as album,
				Songs.SongPath as path,
				Songs.PlayCounter as playCount,
				Songs.SongRating as rating
			FROM Songs
			${whereClause}
			${orderClause}
			LIMIT ${Math.max(1, Math.min(limit, 10000))}
		`;

		// Execute using app.db.getTracklist if available
		if (typeof app !== 'undefined' && app.db && app.db.getTracklist) {
			const tracklist = app.db.getTracklist(query, -1);
			
			// Wait for tracklist to load
			await tracklist.whenLoaded();

			// Convert tracklist to array
			const results = [];
			tracklist.locked(() => {
				let track;
				for (let i = 0; i < tracklist.count; i++) {
					track = tracklist.getFastObject(i, track);
					results.push(track);
				}
			});

			return results;
		}

		// Fallback for testing or development
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

	// Initialize map entries for all requested titles
	for (const title of trackTitles) {
		resultMap.set(title, []);
	}

	// Use batch query for efficiency
	try {
		const normalizedArtist = window.fixPrefixes(artistName);
		if (!normalizedArtist) {
			console.warn('findLibraryTracksBatch: Invalid artist name');
			return resultMap;
		}

		const { best = false, minRating = 0, allowUnknown = false } = options;

		// Build title conditions
		const titleConditions = trackTitles
			.filter(t => t && String(t).trim().length > 0)
			.map(t => `Songs.SongTitle LIKE ${window.quoteSqlString('%' + window.escapeSql(String(t).trim()) + '%')}`)
			.join(' OR ');

		if (!titleConditions) {
			return resultMap;
		}

		// Build WHERE clause
		let whereClause = `WHERE Songs.SongArtist LIKE ${window.quoteSqlString('%' + window.escapeSql(normalizedArtist) + '%')}
		AND (${titleConditions})`;

		// Use configured minRating value, or fall back to 'best' mode with rating 80
		const ratingThreshold = minRating > 0 ? minRating : (best ? 80 : 0);
		
		if (ratingThreshold > 0) {
			if (allowUnknown) {
				// Include tracks with rating >= threshold OR unknown rating (rating < 0)
				whereClause += ` AND (Songs.SongRating >= ${ratingThreshold} OR Songs.SongRating < 0)`;
			} else {
				// Only include tracks with rating >= threshold
				whereClause += ` AND Songs.SongRating >= ${ratingThreshold}`;
			}
		}

		const query = `
			SELECT 
				Songs.SongID as id,
				Songs.SongTitle as title,
				Songs.SongArtist as artist,
				Songs.AlbumName as album,
				Songs.SongPath as path,
				Songs.PlayCounter as playCount,
				Songs.SongRating as rating
			FROM Songs
			${whereClause}
			ORDER BY Songs.SongRating DESC, Songs.PlayCounter DESC
			LIMIT ${Math.max(1, Math.min(limit * trackTitles.length, 10000))}
		`;

		if (typeof app !== 'undefined' && app.db && app.db.getTracklist) {
			const tl = app.db.getTracklist(query, -1);
			if (!tl) return resultMap;

			// Disable auto-update and notifications for performance (pattern from original code)
			tl.autoUpdateDisabled = true;
			tl.dontNotify = true;
			
			// Wait for tracklist to load using .then() pattern (MediaMonkey standard)
			return new Promise((resolve) => {
				tl.whenLoaded().then(() => {
					try {
						// Group results by title for easy lookup
						tl.forEach((track) => {
							if (!track) return;
							
							// Find which requested title this matches
							for (const reqTitle of trackTitles) {
								if (track.title && track.title.toLowerCase().includes(reqTitle.toLowerCase())) {
									if (!resultMap.has(reqTitle)) {
										resultMap.set(reqTitle, []);
									}
									const existing = resultMap.get(reqTitle);
									if (existing.length < limit) {
										existing.push(track);
									}
									break;
								}
							}
						});
					} catch (e) {
						console.error('findLibraryTracksBatch: forEach error:', e.toString());
					} finally {
						// Re-enable auto-update and notifications after we're done
						tl.autoUpdateDisabled = false;
						tl.dontNotify = false;
					}
					
					resolve(resultMap);
				}).catch((e) => {
					console.error('findLibraryTracksBatch: Tracklist load error:', e.toString());
					// Re-enable auto-update and notifications on error
					tl.autoUpdateDisabled = false;
					tl.dontNotify = false;
					resolve(resultMap); // Return empty results rather than throwing
				});
			});
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
