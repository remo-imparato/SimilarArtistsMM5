/**
 * Library Search Module - Phase 4: Database Layer
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

const { escapeSql, quoteSqlString } = require('../utils/sql');
const { escapeSqlUtil } = require('../utils/helpers');
const { fixPrefixes } = require('../settings/prefixes');

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

		// Normalize artist name
		const normalizedArtist = fixPrefixes(artistName);
		if (!normalizedArtist) {
			console.warn('findLibraryTracks: Invalid artist name');
			return [];
		}

		// Build WHERE clause
		let whereClause = `WHERE Songs.SongArtist LIKE ${quoteSqlString('%' + escapeSql(normalizedArtist) + '%')}`;

		// Add track title filter if provided
		if (trackTitles && (Array.isArray(trackTitles) && trackTitles.length > 0)) {
			const titles = Array.isArray(trackTitles) ? trackTitles : [trackTitles];
			const titleConditions = titles.map(t =>
				`Songs.SongTitle LIKE ${quoteSqlString('%' + escapeSql(t) + '%')}`
			).join(' OR ');
			whereClause += ` AND (${titleConditions})`;
		}

		// Add rating filter if specified
		if (best || minRating > 0) {
			const minRatingValue = best ? 80 : Math.max(0, minRating);
			whereClause += ` AND Songs.SongRating >= ${minRatingValue}`;
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

		// Execute via app.db if available
		if (typeof app !== 'undefined' && app.db && app.db.Query) {
			const result = app.db.Query(query);
			if (result && Array.isArray(result)) {
				return result;
			}
		}

		// Fallback for testing or development
		console.warn('findLibraryTracks: app.db.Query not available, returning empty');
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

	// Use batch query for efficiency
	try {
		const normalizedArtist = fixPrefixes(artistName);
		const titleList = trackTitles
			.filter(t => t && String(t).trim().length > 0)
			.map(t => quoteSqlString('%' + escapeSql(String(t).trim()) + '%'))
			.join(',');

		if (!titleList) {
			return resultMap;
		}

		const { best = false, minRating = 0 } = options;

		// Build comprehensive query for all titles at once
		let whereClause = `WHERE Songs.SongArtist LIKE ${quoteSqlString('%' + escapeSql(normalizedArtist) + '%')}
		AND (Songs.SongTitle LIKE ${trackTitles
			.map(t => quoteSqlString('%' + escapeSql(String(t).trim()) + '%'))
			.join(' OR Songs.SongTitle LIKE ')})`;

		if (best || minRating > 0) {
			const minRatingValue = best ? 80 : Math.max(0, minRating);
			whereClause += ` AND Songs.SongRating >= ${minRatingValue}`;
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

		if (typeof app !== 'undefined' && app.db && app.db.Query) {
			const allMatches = app.db.Query(query) || [];

			// Group results by title for easy lookup
			for (const track of allMatches) {
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
			}
		}
	} catch (e) {
		console.error('findLibraryTracksBatch error: ' + e.toString());
	}

	// Ensure all requested titles have an entry in the map
	for (const title of trackTitles) {
		if (!resultMap.has(title)) {
			resultMap.set(title, []);
		}
	}

	return resultMap;
}

module.exports = {
	findLibraryTracks,
	findLibraryTracksBatch,
};
