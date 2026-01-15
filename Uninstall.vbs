'
' MediaMonkey Script Uninstaller
'
' NAME: SimilarArtists
'
' AUTHOR: trixmoto (http://trixmoto.net)
'

Dim inip : inip = SDB.ApplicationPath&"Scripts\Scripts.ini"
Dim inif : Set inif = SDB.Tools.IniFileByPath(inip)
If Not (inif Is Nothing) Then
  inif.DeleteSection("SimilarArtists")
  SDB.RefreshScriptItems
End If

Set inif = SDB.IniFile
If inif.BoolValue("SimilarArtists","OnPlay") Then
  inif.BoolValue("SimilarArtists","OnPlay") = False
End If

Dim but : Set but = SDB.Objects("SAToolbarButton")
If Not (but Is Nothing) Then
  but.Visible = False
  Set SDB.Objects("SAToolbarButton") = Nothing
End If

Dim tmr : Set tmr = SDB.Objects("SimilarArtistsTimer1")
If Not (tmr Is Nothing) Then
  Call Script.UnregisterEvents(tmr)
  Set SDB.Objects("SimilarArtistsTimer1") = Nothing
End If 
Set tmr = SDB.Objects("SimilarArtistsTimer2")
If Not (tmr Is Nothing) Then
  Call Script.UnregisterEvents(tmr)
  Set SDB.Objects("SimilarArtistsTimer2") = Nothing
End If    

Set SDB.Objects("SimilarArtistsQueue") = Nothing
Set SDB.Objects("SimilarArtistsProgress") = Nothing
Set SDB.Objects("SimilarArtistsSong") = Nothing
Set SDB.Objects("SimilarArtistsList") = Nothing
Set SDB.Objects("SimilarArtistsXML") = Nothing
Set SDB.Objects("SimilarArtistsPlay") = Nothing

