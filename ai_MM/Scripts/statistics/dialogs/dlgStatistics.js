/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// MediaMonkey statistics script
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

"use strict";
requirejs('controls/rating');
requirejs('utils');

var booStyleOn = undefined;

var intTopCount = 10;

function Style() {
    booStyleOn = !booStyleOn
    if (booStyleOn) {
        return '';
    } else {
        return ' class="Dark"';
    }
}

// escape XML string
function MapXML(srcstring) {
    var resultVal = '';
    if(srcstring) {
        resultVal = srcstring.replace(/&/g, '&amp;');
        resultVal = resultVal.replace(/</g, '&lt;');
        resultVal = resultVal.replace(/>/g, '&gt;');
        var i = 0;
        while (i < resultVal.length) {
            if (resultVal.charCodeAt(i) > 127) {
                resultVal = resultVal.substring(0, i) + "&#" + resultVal.charCodeAt(i) + ";" + resultVal.substring(i + 1);
                i = i + 3;
            }
            i = i + 1;
        }        
    }
    if (resultVal === '') {
        resultVal = '&nbsp;';
    }
    return resultVal;
}


function ShowRating(intNo) {
    return Rating.getHTML({
        starWidth: '12px',
        readOnlyPadding: 'none',
        readOnly: true,
        useUnknown: true,
        position: 'left',
        value: intNo
    });
};

function CCur(val) {
    var f = parseFloat(val);
    if (isNaN(f))
        return 0;
    else {
        return (Math.round(f * 10000)) / 10000; // round to 4 digits
    }
};

function round1(val) {
    return (Math.round(val * 10)) / 10;
};

function BuildReport() {
    return new Promise(async function (resolve, reject) {
        var qryStats;
        var strSQL;
        var intArtistsCount;
        var intArtistsCountPlayed;
        var intAlbumCount;
        var intAlbumsCountPlayed;
        var intGenreCount;
        var intGenreCountPlayed;
        var intLength;
        var intFileLength;
        var intLengthPlayed;
        var intFileLengthPlayed;
        var intYearCount;
        var intYearCountPlayed;
        var intPlaylistCount;
        var intPlaylistCountPlayed;
        var intPlayed;
        var intAllCount;

        var strOut = "";

        //Building base page
        strOut += "<H1>" + _("MediaMonkey Library Statistics") + "</H1>\r\n";


        //Totals
        strSQL = "SELECT Count(*) AS Nombre FROM Artists WHERE ID <> 0 AND Tracks>0"; // Track artists only
        await app.db.getQueryResultAsync(strSQL).then(function (res) {
            intArtistsCount = parseInt(res.fields.getValue(0));
        });

        strSQL = "SELECT Count(Distinct Artists.ID) AS CountOfID FROM Artists WHERE Artists.ID IN ( SELECT ArtistsSongs.IDArtist FROM ArtistsSongs WHERE ArtistsSongs.PersonType = 1 AND ArtistsSongs.IDSong IN ( SELECT Played.IDSong FROM Played))";
        await app.db.getQueryResultAsync(strSQL).then(function (res) {
            intArtistsCountPlayed = parseInt(res.fields.getValue(0));
        });

        strSQL = "SELECT Count(*) AS Nombre FROM Albums WHERE Album<>'' AND Album<>' '";
        await app.db.getQueryResultAsync(strSQL).then(function (res) {
            intAlbumCount = parseInt(res.fields.getValue(0));
        });

        strSQL = "SELECT Count(Distinct Albums.ID) AS CountOfID FROM Albums WHERE Albums.ID IN ( SELECT Songs.IDAlbum FROM Songs WHERE Songs.ID IN (SELECT Played.IDSong FROM Played))";
        await app.db.getQueryResultAsync(strSQL).then(function (res) {
            intAlbumsCountPlayed = parseInt(res.fields.getValue(0));
        });

        strSQL = "SELECT Count(Genres.IDGenre) AS Nombre FROM Genres WHERE Genres.GenreName <> '' AND Genres.IDGenre IN (SELECT GenresSongs.IDGenre FROM GenresSongs)";
        await app.db.getQueryResultAsync(strSQL).then(function (res) {
            intGenreCount = parseInt(res.fields.getValue(0));
        });

        strSQL = "SELECT Count(Distinct Genres.IDGenre) AS CountOfID FROM Genres WHERE Genres.IDGenre IN (SELECT GenresSongs.IDGenre FROM GenresSongs WHERE GenresSongs.IDSong IN (SELECT Played.IDSong FROM Played))";
        await app.db.getQueryResultAsync(strSQL).then(function (res) {
            intGenreCountPlayed = parseInt(res.fields.getValue(0));
        });

        strSQL = "SELECT Count(Distinct CAST((Songs.Year/10000) AS INTEGER)) AS Nombre FROM Songs WHERE Songs.Year > 0";
        await app.db.getQueryResultAsync(strSQL).then(function (res) {
            intYearCount = parseInt(res.fields.getValue(0));
        });

        strSQL = "SELECT Count(Distinct CAST((Songs.Year/10000) AS INTEGER)) AS CountOfID FROM Songs INNER JOIN Played ON Songs.ID = Played.IDSong WHERE Songs.Year > 0";
        await app.db.getQueryResultAsync(strSQL).then(function (res) {
            intYearCountPlayed = parseInt(res.fields.getValue(0));
        });

        strSQL = "SELECT Count(*) AS Nombre FROM PlayLists WHERE (IsAutoPlaylist<>1 OR IsAutoPlaylist is null)";
        await app.db.getQueryResultAsync(strSQL).then(function (res) {
            intPlaylistCount = parseInt(res.fields.getValue(0));
        });

        strSQL = "SELECT Count(Distinct PlayLists.IDPlaylist) AS CountOfID FROM " +
            " PlayLists WHERE PlayLists.IDPlaylist " +
            " IN (SELECT PlaylistSongs.IDPlaylist FROM PlaylistSongs WHERE PlaylistSongs.IDSong " +
            " IN (SELECT Played.IDSong FROM Played)) " +
            " AND (Playlists.IsAutoPlaylist<>1 OR IsAutoPlaylist is null)";
        await app.db.getQueryResultAsync(strSQL).then(function (res) {
            intPlaylistCountPlayed = parseInt(res.fields.getValue(0));
        });

        strSQL = "SELECT Count(Distinct Played.IDSong) AS Nombre FROM Played"
        await app.db.getQueryResultAsync(strSQL).then(function (res) {
            intPlayed = parseInt(res.fields.getValue(0));
        });

        strSQL = "SELECT Count(*) AS Nombre, Sum(Songs.SongLength) AS TotalLength, Sum(Songs.FileLength) AS TotalFileLength FROM Songs";
        await app.db.getQueryResultAsync(strSQL).then(function (res) {
            intAllCount = parseInt(res.fields.getValue(0));
            intLength = parseInt(res.fields.getValue(1));
            intFileLength = parseInt(res.fields.getValue(2));
        });

        strSQL = "SELECT Sum(Songs.SongLength) AS TotalLength, Sum(Songs.FileLength) AS TotalFileLength FROM Songs WHERE Songs.ID IN (SELECT Played.IdSong FROM Played)";
        await app.db.getQueryResultAsync(strSQL).then(function (res) {
            intLengthPlayed = parseInt(res.fields.getValue(0));
            intFileLengthPlayed = parseInt(res.fields.getValue(1));
        });

        strOut += "      <p/>\r\n";
        strOut += "        <table border=\"0\" cellspacing=\"0\" cellpadding=\"4\" width=\"100%\">\r\n";
        strOut += "          <tr><th colspan=\"3\">" + _("Totals") + "</th></tr>\r\n";
        strOut += "          <tr class=\"aleft\"><th>" + _("Type") + "</th><th>" + _("Library") + "</th><th>" + _("Played") + "</th></tr>\r\n";
        strOut += "          <tr" + Style() + "><td>" + _("Artists") + "</td><td>" + intArtistsCount + "</td><td>" + intArtistsCountPlayed + "</td></tr>\r\n";
        strOut += "          <tr" + Style() + "><td>" + _("Albums") + "</td><td>" + intAlbumCount + "</td><td>" + intAlbumsCountPlayed + "</td></tr>\r\n";
        strOut += "          <tr" + Style() + "><td>" + _("Genres") + "</td><td>" + intGenreCount + "</td><td>" + intGenreCountPlayed + "</td></tr>\r\n";
        strOut += "          <tr" + Style() + "><td>" + _("Years") + "</td><td>" + intYearCount + "</td><td>" + intYearCountPlayed + "</td></tr>\r\n";
        strOut += "          <tr" + Style() + "><td>" + _("Playlists") + "</td><td>" + intPlaylistCount + "</td><td>" + intPlaylistCountPlayed + "</td></tr>\r\n";
        strOut += "          <tr" + Style() + "><td>" + _("Tracks") + "</td><td>" + intAllCount + "</td><td>" + intPlayed + "</td></tr>\r\n";
        strOut += "          <tr" + Style() + "><td>" + _("Length") + " (h:mm:ss)</td><td>" + getFormatedTime(intLength) + "</td><td>" + getFormatedTime(intLengthPlayed) + "</td></tr>\r\n";
        strOut += "          <tr" + Style() + "><td>" + _("File size") + "</td><td>" + formatFileSize(intFileLength) + "</td><td>" + formatFileSize(intFileLengthPlayed) + "</td></tr>\r\n";
        strOut += "        </table>\r\n";
        strOut += "      <p/>\r\n";

        //Averages
        var intAvgYear;
        var intAvgYearPlayed;
        var intAvgBitrate;
        var intAvgBitratePlayed;
        var intAvgRating;
        var intTracksPerAlbum;
        var intTracksPerAlbumPlayed;
        var intSongsPerGenre;
        var intSongsPerGenrePlayed;
        var intPlayPerDay;
        var intPlayedRating;
        var intSongsPerArtist;
        var intSongsPerArtistPlayed;
        var intSongsPerYear;
        var intSongsPerYearPlayed;

        strSQL = "SELECT Avg(Distinct CAST((Songs.Year/10000) AS INTEGER)) AS avgYear FROM Songs WHERE Songs.Year > 0";
        await app.db.getQueryResultAsync(strSQL).then(function (res) {
            intAvgYear = CCur(res.fields.getValue(0));
        });

        strSQL = "SELECT Avg(Distinct Cast((Songs.Year/10000) AS Integer)) AS avgYearPlayed FROM Songs INNER JOIN Played ON Songs.ID = Played.IDSong WHERE Songs.Year > 0";
        await app.db.getQueryResultAsync(strSQL).then(function (res) {
            intAvgYearPlayed = CCur(res.fields.getValue(0));
        });

        strSQL = "SELECT Avg(SongLength) AS AvgLength, Avg(FileLength) AS AvgFileLength, Avg(Bitrate) AS AvgBitrate FROM Songs";
        await app.db.getQueryResultAsync(strSQL).then(function (res) {
            intLength = CCur(res.fields.getValue(0));
            intFileLength = CCur(res.fields.getValue(1));
            intAvgBitrate = CCur(res.fields.getValue(2));
        });


        strSQL = "SELECT Avg(Songs.Bitrate) AS AvgBitratePlayed FROM Songs WHERE Songs.ID IN (SELECT Played.IDSong FROM Played)";
        await app.db.getQueryResultAsync(strSQL).then(function (res) {
            intAvgBitratePlayed = CCur(res.fields.getValue(0));
        });

        strSQL = "SELECT Avg(Songs.Rating) AS AvgRating FROM Songs WHERE Songs.Rating >= 0";
        await app.db.getQueryResultAsync(strSQL).then(function (res) {
            intAvgRating = CCur(res.fields.getValue(0));
        });

        strSQL = "SELECT Avg(SongLength) AS AvgLength, Avg(FileLength) AS AvgFileLength FROM Songs INNER JOIN Played ON Songs.ID = Played.IdSong";
        await app.db.getQueryResultAsync(strSQL).then(function (res) {
            intLengthPlayed = CCur(res.fields.getValue(0));
            intFileLengthPlayed = CCur(res.fields.getValue(1));
        });


        if (intAlbumCount > 0) {
            strSQL = "SELECT Count( Songs.ID) AS CountOfID FROM Songs WHERE (Songs.Album <> '') AND (Songs.Album IS NOT NULL)"
            await app.db.getQueryResultAsync(strSQL).then(function (res) {
                intTracksPerAlbum = CCur(res.fields.getValue(0)) / intAlbumCount;
            });
        } else {
            intTracksPerAlbum = 0
        }

        if (intAlbumsCountPlayed > 0) {
            strSQL = "SELECT Count( Songs.ID) AS CountOfID FROM Songs WHERE (Songs.Album <> '') AND (Songs.Album IS NOT NULL) AND Songs.ID IN (SELECT Played.IDSong FROM Played)";

            await app.db.getQueryResultAsync(strSQL).then(function (res) {
                intTracksPerAlbumPlayed = CCur(res.fields.getValue(0)) / intAlbumsCountPlayed;
            });
        } else {
            intTracksPerAlbumPlayed = 0;
        }

        strSQL = "SELECT Avg(CountOfID) AS AVGPlayed FROM (SELECT Count(Played.IdSong) AS CountOfID " +
            "FROM Played  " +
            "GROUP BY Cast(Played.PlayDate AS Integer))";
        await app.db.getQueryResultAsync(strSQL).then(function (res) {
            intPlayPerDay = CCur(res.fields.getValue(0));
        });

        strSQL = "SELECT Avg(Songs.Rating) AS AvgRatingPlayed FROM Songs WHERE Songs.Rating>0 AND PlayCounter>0";
        await app.db.getQueryResultAsync(strSQL).then(function (res) {
            intPlayedRating = CCur(res.fields.getValue(0));
        });

        if (intGenreCount > 0) {
            strSQL = "SELECT Count( GenresSongs.ID) AS CountOfID FROM GenresSongs"
            await app.db.getQueryResultAsync(strSQL).then(function (res) {
                intSongsPerGenre = CCur(res.fields.getValue(0)) / intGenreCount;
            });
        } else {
            intSongsPerGenre = 0;
        }

        if (intGenreCountPlayed > 0) {
            strSQL = "SELECT Count( GenresSongs.ID) AS CountOfID FROM GenresSongs WHERE GenresSongs.IDSong IN " +                
                "               (SELECT Played.IDSong FROM Played)";
            await app.db.getQueryResultAsync(strSQL).then(function (res) {
                intSongsPerGenrePlayed = CCur(res.fields.getValue(0)) / intGenreCountPlayed;
            });
        } else {
            intSongsPerGenrePlayed = 0;
        }

        if (intArtistsCount > 0) {
            strSQL = "SELECT Count( ArtistsSongs.ID) AS CountOfID FROM ArtistsSongs WHERE ArtistsSongs.PersonType = 1";
            await app.db.getQueryResultAsync(strSQL).then(function (res) {
                intSongsPerArtist = CCur(res.fields.getValue(0)) / intArtistsCount;
            });
        } else {
            intSongsPerArtist = 0;
        };

        if (intArtistsCountPlayed > 0) {
            strSQL = "SELECT Count( ArtistsSongs.ID) AS CountOfID FROM ArtistsSongs WHERE ArtistsSongs.PersonType = 1 AND ArtistsSongs.IDSong IN " +                
                "               (SELECT Played.IDSong FROM Played)";
            await app.db.getQueryResultAsync(strSQL).then(function (res) {
                intSongsPerArtistPlayed = CCur(res.fields.getValue(0)) / intArtistsCountPlayed;
            });
        } else {
            intSongsPerArtistPlayed = 0;
        }

        strSQL = "SELECT Avg(CountOfID) AS AVGYear FROM (" +
            "SELECT Count(Songs.ID) AS CountOfID " +
            "FROM Songs WHERE Songs.Year <> -1 " +
            "GROUP BY Songs.Year)";
        await app.db.getQueryResultAsync(strSQL).then(function (res) {
            intSongsPerYear = CCur(res.fields.getValue(0));
        });

        strSQL = "SELECT Avg(CountOfID) AS AVGYearPlayed FROM (" +
            "SELECT Count(Songs.ID) AS CountOfID " +
            "FROM Songs WHERE Songs.ID IN (SELECT Played.IDSong FROM Played) AND Songs.Year <> -1 " +
            "GROUP BY Songs.Year)";
        await app.db.getQueryResultAsync(strSQL).then(function (res) {
            intSongsPerYearPlayed = CCur(res.fields.getValue(0));
        });

        strOut += "        <table border=\"0\" cellspacing=\"0\" cellpadding=\"4\" width=\"100%\">\r\n";
        strOut += "          <tr><th colspan=\"3\">" + _("Averages") + "</th></tr>\r\n";
        strOut += "          <tr class=\"aleft\"><th>" + _("Type") + "</th><th>" + _("Library") + "</th><th>" + _("Played") + "</th></tr>\r\n";
        strOut += "          <tr" + Style() + "><td>" + _("Tracks per Artist") + "</td><td>" + round1(intSongsPerArtist) + "</td><td>" + round1(intSongsPerArtistPlayed) + "</td></tr>\r\n";
        strOut += "          <tr" + Style() + "><td>" + _("Tracks per Album") + "</td><td>" + round1(intTracksPerAlbum) + "</td><td>" + round1(intTracksPerAlbumPlayed) + "</td></tr>\r\n";
        strOut += "          <tr" + Style() + "><td>" + _("Tracks per Genre") + "</td><td>" + round1(intSongsPerGenre) + "</td><td>" + round1(intSongsPerGenrePlayed) + "</td></tr>\r\n";
        strOut += "          <tr" + Style() + "><td>" + _("Tracks per Year") + "</td><td>" + round1(intSongsPerYear) + "</td><td>" + round1(intSongsPerYearPlayed) + "</td></tr>\r\n";
        strOut += "          <tr" + Style() + "><td>" + _("Bitrate (kbps)") + "</td><td>" + Math.round(intAvgBitrate / 1000) + "</td><td>" + Math.round(intAvgBitratePlayed / 1000) + "</td></tr>\r\n";
        strOut += "          <tr" + Style() + "><td>" + _("Year") + "</td><td>" + Math.round(intAvgYear) + "</td><td>" + Math.round(intAvgYearPlayed) + "</td></tr>\r\n";
        strOut += "          <tr" + Style() + "><td>" + _("Tracks played per day") + "</td><td>-</td><td>" + round1(intPlayPerDay) + "</td></tr>\r\n";
        strOut += "          <tr" + Style() + "><td>" + _("Rating") + "</td><td>" + ShowRating(Math.round(intAvgRating)) + "</td><td>" + ShowRating(Math.round(intPlayedRating)) + "</td></tr>\r\n";
        strOut += "          <tr" + Style() + "><td>" + _("Length") + " (h:mm:ss)</td><td>" + getFormatedTime(intLength) + "</td><td>" + getFormatedTime(intLengthPlayed) + "</td></tr>\r\n";
        strOut += "          <tr" + Style() + "><td>" + _("File size") + "</td><td>" + formatFileSize(intFileLength) + "</td><td>" + formatFileSize(intFileLengthPlayed) + "</td></tr>\r\n";
        strOut += "        </table>\r\n";
        strOut += "      <p/>\r\n";


        //Top 10 Artists
        strOut += "        <table border=\"0\" cellspacing=\"0\" cellpadding=\"4\" width=\"100%\">\r\n";
        strOut += "          <tr><th colspan=\"4\">" + sprintf(_("Top %d Artists"), intTopCount) + "</th></tr>\r\n";
        strOut += "          <tr class=\"aleft\">\r\n";
        strOut += "            <th>" + _("Tracks") + "</th>\r\n";
        strOut += "            <th>" + _("Artist") + "</th>\r\n";
        strOut += "            <th>" + _("Length") + "</th>\r\n";
        strOut += "            <th>" + _("File size") + "</th>\r\n";
        strOut += "          </tr>\r\n";


        strSQL = "SELECT Count(Songs.ID) AS CountOfID, Artists.Artist, Sum(SongLength) AS TotalLength, Sum(FileLength) AS TotalFileLength " +
            "FROM ArtistsSongs, Songs, Artists " +
            "WHERE ArtistsSongs.PersonType = 1 AND Songs.ID = ArtistsSongs.IDSong AND ArtistsSongs.IDArtist = Artists.ID " +
            "GROUP BY ArtistsSongs.IDArtist " +
            "ORDER BY Count(Songs.ID) DESC LIMIT " + intTopCount + "";

        await app.db.getQueryResultAsync(strSQL).then(function (res) {
            while (!res.eof) {
                strOut += "          <tr" + Style() + ">\r\n";
                strOut += "            <td>" + res.fields.getValue(0) + "</td>\r\n";
                strOut += "            <td>" + MapXML(res.fields.getValue(1)) + "</td>\r\n";
                strOut += "            <td>" + getFormatedTime(CCur(res.fields.getValue(2))) + "</td>\r\n";
                strOut += "            <td>" + formatFileSize(CCur(res.fields.getValue(3))) + "</td>\r\n";
                strOut += "          </tr>\r\n";
                res.next();
            }

        });

        strOut += "        </table>\r\n";
        strOut += "      <p/>\r\n";

        //Top 10 Artists Played
        strOut += "        <table border=\"0\" cellspacing=\"0\" cellpadding=\"4\" width=\"100%\">\r\n";
        strOut += "          <tr><th colspan=\"4\">" + sprintf(_("Top %d Artists played"), intTopCount) + "</th></tr>\r\n";
        strOut += "          <tr class=\"aleft\">\r\n";
        strOut += "            <th>" + _("Played #") + "</th>\r\n";
        strOut += "            <th>" + _("Artist") + "</th>\r\n";
        strOut += "            <th>" + _("Duration") + "</th>\r\n";
        strOut += "          </tr>\r\n";

        strSQL = "SELECT Sum(PlayCounter) AS CountOfID, Artists.Artist, Sum(PlayCounter*SongLength) AS TotalLength " +
            "FROM ArtistsSongs, Songs, Artists " +
            "WHERE ArtistsSongs.PersonType = 1 AND Songs.ID = ArtistsSongs.IDSong AND Songs.ID IN (SELECT Played.IDSong FROM Played) AND ArtistsSongs.IDArtist = Artists.ID " +
            "GROUP BY ArtistsSongs.IDArtist " +
            "ORDER BY Sum(PlayCounter) DESC LIMIT " + intTopCount;

        await app.db.getQueryResultAsync(strSQL).then(function (res) {
            while (!res.eof) {
                strOut += "          <tr" + Style() + ">\r\n";
                strOut += "            <td>" + res.fields.getValue(0) + "</td>\r\n";
                strOut += "            <td>" + MapXML(res.fields.getValue(1)) + "</td>\r\n";
                strOut += "            <td>" + getFormatedTime(CCur(res.fields.getValue(2))) + "</td>\r\n";
                strOut += "          </tr>\r\n";
                res.next();
            }
        });

        strOut += "        </table>\r\n";
        strOut += "      <p/>\r\n";

        //Top 10 Albums
        strOut += "        <table border=\"0\" cellspacing=\"0\" cellpadding=\"4\" width=\"100%\">\r\n";
        strOut += "          <tr><th colspan=\"4\">" + sprintf(_("Top %d Albums"), intTopCount) + "</th></tr>\r\n";
        strOut += "          <tr class=\"aleft\">\r\n";
        strOut += "            <th>" + _("Rating") + "</th>\r\n";
        strOut += "            <th>" + _("Album") + "</th>\r\n";
        strOut += "            <th>" + _("Length") + "</th>\r\n";
        strOut += "            <th>" + _("File size") + "</th>\r\n";
        strOut += "          </tr>\r\n";

        strSQL = "SELECT Avg( Songs.Rating) AS Rating, Songs.AlbumArtist AS Artist, Albums.Album AS Album, Sum(Songs.SongLength) AS TotalLength, Sum(Songs.FileLength) AS TotalFileLength " +
            "FROM Songs, Albums " +
            "WHERE Albums.ID <> 0 AND Albums.Album <> '' AND Albums.ID = Songs.IDAlbum " +
            "GROUP BY Songs.IDAlbum, Albums.Album " +
            "ORDER BY Rating Desc, TotalLength Desc Limit " + intTopCount;

        await app.db.getQueryResultAsync(strSQL).then(function (res) {
            while (!res.eof) {
                strOut += "          <tr" + Style() + ">\r\n";
                strOut += "            <td>" + ShowRating(res.fields.getValue(0)) + "</td>\r\n";
                strOut += "            <td>" + MapXML(res.fields.getValue(1)) + " - " + MapXML(res.fields.getValue(2)) + "</td>\r\n";
                strOut += "            <td>" + getFormatedTime(CCur(res.fields.getValue(3))) + "</td>\r\n";
                strOut += "            <td>" + formatFileSize(CCur(res.fields.getValue(4))) + "</td>\r\n";
                strOut += "          </tr>\r\n";
                res.next();
            }
        });

        strOut += "        </table>\r\n";
        strOut += "      <p/>\r\n";

        //Top 10 Albums played
        strOut += "        <table border=\"0\" cellspacing=\"0\" cellpadding=\"4\" width=\"100%\">\r\n";
        strOut += "          <tr><th colspan=\"4\">" + sprintf(_("Top %d Albums played"), intTopCount) + "</th></tr>\r\n";
        strOut += "          <tr class=\"aleft\">\r\n";
        strOut += "            <th>" + _("Played #") + "</th>\r\n";
        strOut += "            <th>" + _("Album") + "</th>\r\n";
        strOut += "            <th>" + _("Duration") + "</th>\r\n";
        strOut += "          </tr>\r\n";

        strSQL = "SELECT Sum( PlayCounter) AS CountOfID, Songs.AlbumArtist AS Artist, Albums.Album AS Album, Sum(PlayCounter*Songs.SongLength) AS TotalLength " +
            "FROM Songs, Albums " +
            "WHERE Albums.ID <> 0 AND Albums.Album <> '' AND Albums.ID = Songs.IDAlbum AND " +
            "Songs.ID IN (SELECT Played.IDSong FROM Played) " +
            "GROUP BY Songs.IDAlbum, Albums.Album " +
            "ORDER BY Sum( PlayCounter) Desc Limit " + intTopCount;

        await app.db.getQueryResultAsync(strSQL).then(function (res) {
            while (!res.eof) {
                strOut += "          <tr" + Style() + ">\r\n";
                strOut += "            <td>" + res.fields.getValue(0) + "</td>\r\n";
                strOut += "            <td>" + MapXML(res.fields.getValue(1)) + " - " + MapXML(res.fields.getValue(2)) + "</td>\r\n";
                strOut += "            <td>" + getFormatedTime(CCur(res.fields.getValue(3))) + "</td>\r\n";
                strOut += "          </tr>\r\n";
                res.next();
            }
        });

        strOut += "        </table>\r\n";
        strOut += "      <p/>\r\n";

        //Top 10 Genres
        strOut += "        <table border=\"0\" cellspacing=\"0\" cellpadding=\"4\" width=\"100%\">\r\n";
        strOut += "          <tr><th colspan=\"4\">" + sprintf(_("Top %d Genres"), intTopCount) + "</th></tr>\r\n";
        strOut += "          <tr class=\"aleft\">\r\n";
        strOut += "            <th>" + _("Tracks") + "</th>\r\n";
        strOut += "            <th>" + _("Genre") + "</th>\r\n";
        strOut += "            <th>" + _("Length") + "</th>\r\n";
        strOut += "            <th>" + _("File size") + "</th>\r\n";
        strOut += "          </tr>\r\n";

        strSQL = "SELECT Count(Songs.ID) AS CountOfID,  Genres.GenreName, Sum(Songs.SongLength) AS TotalLength, Sum(Songs.FileLength) AS TotalFileLength FROM GenresSongs, Songs, Genres WHERE Songs.ID = GenresSongs.IDSong AND GenresSongs.IDGenre = Genres.IDGenre GROUP BY GenresSongs.IDGenre ORDER BY Count(Songs.ID) DESC LIMIT " + intTopCount;

        await app.db.getQueryResultAsync(strSQL).then(function (res) {
            while (!res.eof) {
                strOut += "          <tr" + Style() + ">\r\n";
                strOut += "            <td>" + res.fields.getValue(0) + "</td>\r\n";
                strOut += "            <td>" + MapXML(res.fields.getValue(1)) + "</td>\r\n";
                strOut += "            <td>" + getFormatedTime(CCur(res.fields.getValue(2))) + "</td>\r\n";
                strOut += "            <td>" + formatFileSize(CCur(res.fields.getValue(3))) + "</td>\r\n";
                strOut += "          </tr>\r\n";
                res.next();
            }
        });

        strOut += "        </table>\r\n";
        strOut += "      <p/>\r\n";

        //Top 10 genres played
        strOut += "        <table border=\"0\" cellspacing=\"0\" cellpadding=\"4\" width=\"100%\">\r\n";
        strOut += "          <tr><th colspan=\"4\">" + sprintf(_("Top %d Genres played"), intTopCount) + "</th></tr>\r\n";
        strOut += "          <tr class=\"aleft\">\r\n";
        strOut += "            <th>" + _("Played #") + "</th>\r\n";
        strOut += "            <th>" + _("Genre") + "</th>\r\n";
        strOut += "            <th>" + _("Duration") + "</th>\r\n";
        strOut += "          </tr>\r\n";

        strSQL = "SELECT Sum(Songs.PlayCounter) AS CountOfID, Genres.GenreName, Sum(Songs.PlayCounter*Songs.SongLength) AS TotalLength FROM GenresSongs, Songs, Genres WHERE Songs.ID = GenresSongs.IDSong AND Songs.ID IN (SELECT Played.IDSong FROM Played) AND GenresSongs.IDGenre = Genres.IDGenre GROUP BY GenresSongs.IDGenre ORDER BY Sum(Songs.PlayCounter) DESC LIMIT " + intTopCount + ""

        await app.db.getQueryResultAsync(strSQL).then(function (res) {
            while (!res.eof) {
                strOut += "          <tr" + Style() + ">\r\n";
                strOut += "            <td>" + res.fields.getValue(0) + "</td>\r\n";
                strOut += "            <td>" + MapXML(res.fields.getValue(1)) + "</td>\r\n";
                strOut += "            <td>" + getFormatedTime(CCur(res.fields.getValue(2))) + "</td>\r\n";
                strOut += "          </tr>\r\n";
                res.next();
            }
        });

        strOut += "        </table>\r\n";
        strOut += "      <p/>\r\n";


        //ratings
        strOut += "        <table border=\"0\" cellspacing=\"0\" cellpadding=\"4\" width=\"100%\">\r\n";
        strOut += "          <tr><th colspan=\"4\">" + _("Ratings") + "</th></tr>\r\n";
        strOut += "          <tr class=\"aleft\">\r\n";
        strOut += "            <th>" + _("Tracks") + "</th>\r\n";
        strOut += "            <th>" + _("Rating") + "</th>\r\n";
        strOut += "            <th>" + _("Length") + "</th>\r\n";
        strOut += "            <th>" + _("File size") + "</th>\r\n";
        strOut += "          </tr>\r\n";

        var addRatings = async function (minr, maxr, playedOnly) {
            if (playedOnly)
                strSQL = "SELECT Sum(Songs.PlayCounter) AS CountOfID, Songs.Rating, Sum(Songs.PlayCounter*SongLength) AS TotalLength, Sum(FileLength) AS TotalFileLength FROM Songs WHERE (Songs.Rating >= " + minr + ") AND (Songs.Rating <= " + maxr + ")" + " AND Songs.ID IN (SELECT Played.IDSong FROM Played)";
            else
                strSQL = "SELECT Count(Songs.ID) AS CountOfID, Songs.Rating, Sum(SongLength) AS TotalLength, Sum(FileLength) AS TotalFileLength FROM Songs WHERE (Songs.Rating >= " + minr + ") AND (Songs.Rating <= " + maxr + ")";
            await app.db.getQueryResultAsync(strSQL).then(function (res) {
                if (parseInt(res.fields.getValue(0)) > 0) {
                    while (!res.eof) {
                        strOut += "          <tr" + Style() + ">\r\n";
                        strOut += "            <td>" + res.fields.getValue(0) + "</td>\r\n";
                        strOut += "            <td>" + ShowRating(res.fields.getValue(1)) + "</td>\r\n";
                        strOut += "            <td>" + getFormatedTime(CCur(res.fields.getValue(2))) + "</td>\r\n";
                        if(!playedOnly)
                            strOut += "            <td>" + formatFileSize(CCur(res.fields.getValue(3))) + "</td>\r\n";
                        strOut += "          </tr>\r\n";
                        res.next();
                    }
                }
            });
        }

        await addRatings(96, 100);
        await addRatings(86, 95);
        await addRatings(76, 85);
        await addRatings(66, 75);
        await addRatings(56, 65);
        await addRatings(46, 55);
        await addRatings(36, 45);
        await addRatings(26, 35);
        await addRatings(16, 25);
        await addRatings(6, 15);
        await addRatings(0, 5);

        strOut += "        </table>\r\n";
        strOut += "      <p/>\r\n";

        //rating played
        strOut += "        <table border=\"0\" cellspacing=\"0\" cellpadding=\"4\" width=\"100%\">\r\n";
        strOut += "          <tr><th colspan=\"4\">" + _("Ratings played") + "</th></tr>\r\n";
        strOut += "          <tr class=\"aleft\">\r\n";
        strOut += "            <th>" + _("Played #") + "</th>\r\n";
        strOut += "            <th>" + _("Rating") + "</th>\r\n";
        strOut += "            <th>" + _("Duration") + "</th>\r\n";
        strOut += "          </tr>\r\n";

        await addRatings(96, 100, true);
        await addRatings(86, 95, true);
        await addRatings(76, 85, true);
        await addRatings(66, 75, true);
        await addRatings(56, 65, true);
        await addRatings(46, 55, true);
        await addRatings(36, 45, true);
        await addRatings(26, 35, true);
        await addRatings(16, 25, true);
        await addRatings(6, 15, true);
        await addRatings(0, 5, true);

        strOut += "        </table>\r\n";
        strOut += "      <p/>\r\n";

        strOut += "      <table border=\"0\" cellspacing=\"0\" cellpadding=\"4\" width=\"100%\">\r\n";
        strOut += "        <tr><td style='border-bottom-width:0px'>\r\n";
        var dt = new Date();
        strOut += "          " + _("Generated by ") + "<span>MediaMonkey</span>, " + MapXML(dt.toLocaleString());
        strOut += "        </td></tr>\r\n";
        strOut += "      </table>\r\n";
        strOut += "    <p/>\r\n";

        resolve(strOut);
    });
};

function init(params) {
    var wnd = this;
    wnd.resizeable = true;
    wnd.noAutoSize = true; // disable auto sizing mechanism, we have fixed size
    wnd.title = _('MediaMonkey Music Library Statistics');
    var UI = getAllUIElements();
    UI.btnSave.controlClass.disabled = true;
    localPromise(BuildReport()).then(function (res) {
        if (res)
            UI.reportContainer.innerHTML = res;
        UI.btnSave.controlClass.disabled = false;
    });

    localListen(UI.btnSave, 'click', () => {
        app.utils.dialogSaveFile('', 'html', 'HTML (*.htm)|*.htm|All files (*.*)|*.*', _('Exporting') + '...').then(function (resfilename) {
            if (resfilename != '') {
                var strOut = "";
                strOut = "<html>\r\n";
                strOut += "  <head>\r\n";
                strOut += "    <title>" + _("MediaMonkey Music Library Statistics") + "</title>\r\n";
                strOut += "  </head>\r\n";
                strOut += "<STYLE TYPE=text/css>\r\n";
                strOut += "body{font-family:'Verdana',sans-serif; background-color:#FFFFFF; font-size:9pt; color:#000000;}\r\n";
                strOut += "H1{font-family:'Verdana',sans-serif; font-size:13pt; font-weight:bold; color:#AAAAAA; text-align:left}\r\n";
                strOut += "P{font-family:'Verdana',sans-serif; font-size:9pt; color:#000000;}\r\n";
                strOut += "TH{font-family:'Verdana',sans-serif; font-size:10pt; font-weight:bold; color:#000000; border-color:#000000; border-style: solid; border-left-width:0px; border-right-width:0px; border-top-width:0px; border-bottom-width:3px;}\r\n";
                strOut += "TD{font-family:'Verdana',sans-serif; font-size:9pt; color:#000000; border-color:#000000; border-style: solid; border-left-width:0px; border-right-width:0px; border-top-width:0px; border-bottom-width:1px;}\r\n";
                strOut += "TR.dark{background-color:#EEEEEE}\r\n";
                strOut += "TR.aleft TH{text-align:left}\r\n";
                strOut += ".ratingStar {fill: #000000}";
                strOut += ".ratingCanvas {} .ratingStar[data-emptystar] {opacity: 0.2;}";
                strOut += ".ratingCanvas[data-unknown] {opacity: 0.25;}";
                strOut += ".ratingCanvas.left {margin-right: auto; text-align: left;}";
                strOut += ".ratingStar[data-fullstar] {opacity: 1;}";
                strOut += ".ratingStar[data-halfstar] {-webkit-mask-image: -webkit-gradient(linear, left bottom, right bottom, color-stop(0%, rgba(0, 0, 0, 1)), color-stop(45%, rgba(0, 0, 0, 1)), color-stop(50%, rgba(0, 0, 0, 0.2)), color-stop(100%, rgba(0, 0, 0, 0.2)));}";
                strOut += "</STYLE>\r\n";
                strOut += "  <body>\r\n";
                strOut += UI.reportContainer.innerHTML.replace('<span>MediaMonkey</span>', '<a href="https://www.mediamonkey.com">MediaMonkey</a>');
                strOut += "  </body>\r\n"
                strOut += "</html>\r\n"
                app.filesystem.saveTextToFileAsync(resfilename, strOut);
            }
        })
    });

}
