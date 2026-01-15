'
' MediaMonkey Script
'
' NAME: SimilarArtists 2.2
'
' AUTHOR: trixmoto (http://trixmoto.net)
' DATE : 26/10/2013
'
' INSTALL: Copy to Scripts\Auto directory and add the following to Scripts.ini 
'          Don't forget to remove comments (') and set the order appropriately
'
' [SimilarArtists]
' FileName=Auto\SimilarArtists.vbs
' ProcName=SimilarArtists
' Order=50
' DisplayName=&Similar Artists
' Description=Creates a playlist of similar artists
' Language=VBScript
' ScriptType=0 
'
' FIXES: Added option to reset script if it has stopped processing
'        Added additional debug messaging
' 

Option Explicit
Dim Debug : Debug = False
Dim BaseURL : BaseURL = "http://ws.audioscrobbler.com/2.0/"
Dim ApiKey : ApiKey = "6cfe51c9bf7e77d6449e63ac0db2ac24"

Sub OnStartup
  Call Script.RegisterEvent(SDB,"OnIdle","OnAppIdle")
End Sub 

Sub OnAppIdle
  If Not SDB.IsRunning Then
    Exit Sub
  End If
  Call Script.UnRegisterHandler("OnAppIdle") 
  
  'default settings
  Dim ini : Set ini = SDB.IniFile
  If ini.StringValue("SimilarArtists","Toolbar") = "" Then
    ini.IntValue("SimilarArtists","Toolbar") = 1 '0=none 1=run 2=auto 3=both
  End If
  If ini.StringValue("SimilarArtists","Confirm") = "" Then
    ini.BoolValue("SimilarArtists","Confirm") = True
  End If  
  If ini.StringValue("SimilarArtists","Sort") = "" Then
    ini.BoolValue("SimilarArtists","Sort") = False
  End If  
  If ini.StringValue("SimilarArtists","Limit") = "" Then
    ini.IntValue("SimilarArtists","Limit") = 5
  End If
  If ini.StringValue("SimilarArtists","Name") = "" Then
    ini.StringValue("SimilarArtists","Name") = "Artists similar to %"
  End If
  If ini.StringValue("SimilarArtists","TPA") = "" Then
    ini.IntValue("SimilarArtists","TPA") = 9999
  End If
  If ini.StringValue("SimilarArtists","TPL") = "" Then
    ini.IntValue("SimilarArtists","TPL") = 9999
  End If
  If ini.StringValue("SimilarArtists","Random") = "" Then
    ini.BoolValue("SimilarArtists","Random") = False
  End If  
  If ini.StringValue("SimilarArtists","Seed") = "" Then
    ini.BoolValue("SimilarArtists","Seed") = False
  End If  
  If ini.StringValue("SimilarArtists","Seed2") = "" Then
    ini.BoolValue("SimilarArtists","Seed2") = False
  End If  
  If ini.StringValue("SimilarArtists","Best") = "" Then
    ini.BoolValue("SimilarArtists","Best") = False
  End If  
  If ini.StringValue("SimilarArtists","Rank") = "" Then
    ini.BoolValue("SimilarArtists","Rank") = False
  End If    
  If ini.StringValue("SimilarArtists","Rating") = "" Then
    ini.IntValue("SimilarArtists","Rating") = 0
  End If 
  If ini.StringValue("SimilarArtists","Unknown") = "" Then
    ini.BoolValue("SimilarArtists","Unknown") = True
  End If   
  If ini.StringValue("SimilarArtists","Overwrite") = "" Then
    ini.IntValue("SimilarArtists","Overwrite") = 0
  End If    
  If ini.StringValue("SimilarArtists","Enqueue") = "" Then
    ini.BoolValue("SimilarArtists","Enqueue") = False
  End If      
  If ini.StringValue("SimilarArtists","Navigate") = "" Then
    ini.IntValue("SimilarArtists","Navigate") = 0
  End If        
  If ini.StringValue("SimilarArtists","OnPlay") = "" Then
    ini.BoolValue("SimilarArtists","OnPlay") = False
  Else
    If ini.BoolValue("SimilarArtists","OnPlay") Then
      Call Event_OnPlay
    End If
  End If
  ini.IntValue("SimilarArtists","OnIconIndex") = SDB.RegisterIcon("Scripts\Auto\sa_auto_on.ico",0) 
  ini.IntValue("SimilarArtists","OffIconIndex") = SDB.RegisterIcon("Scripts\Auto\sa_auto_off.ico",0)
  If ini.StringValue("SimilarArtists","ClearNP") = "" Then
    ini.BoolValue("SimilarArtists","ClearNP") = False
  End If            
  If ini.StringValue("SimilarArtists","Ignore") = "" Then
    ini.BoolValue("SimilarArtists","Ignore") = False
  End If              
    
  'add toolbar buttons and option sheet
  Dim but : Set but = SDB.Objects("SAToolbarButton")
  If but Is Nothing Then
    Call SDB.UI.AddOptionSheet("SimilarArtists Settings",Script.ScriptPath,"InitSheet","SaveSheet",-3)            
	  Set but = SDB.UI.AddMenuItem(SDB.UI.Menu_TbStandard,0,0)
  End If
  but.Caption = "SimilarArtists"
  but.IconIndex = 31
  but.Visible = False  
  Call Script.RegisterEvent(but,"OnClick","Toolbar") 
  Dim but2 : Set but2 = SDB.Objects("SAToolbarButton2")
  If but2 Is Nothing Then  
    Set but2 = SDB.UI.AddMenuItem(SDB.UI.Menu_TbStandard,0,0)
  End If
  but2.Caption = "SimilarArtists (Auto On/Off)"
  If ini.BoolValue("SimilarArtists","OnPlay") Then
    but2.IconIndex = ini.IntValue("SimilarArtists","OnIconIndex")
  Else
    but2.IconIndex = ini.IntValue("SimilarArtists","OffIconIndex")
  End If	
  but2.Visible = False
  Call Script.RegisterEvent(but2,"OnClick","Toolbar2") 
  Set SDB.Objects("SAToolbarButton") = but
  Set SDB.Objects("SAToolbarButton2") = but2
  Select Case ini.IntValue("SimilarArtists","Toolbar")
    Case 0
      but.Visible = False      
      but2.Visible = False
    Case 1
      but.Visible = True
      but2.Visible = False        
    Case 2
      but.Visible = False
      but2.Visible = True
    Case 3
      but.Visible = True
      but2.Visible = True
  End Select  
  Call Script.RegisterEvent(SDB,"OnIdle","OnAppIdle2")

  'create database table
  Dim dbo : Set dbo = SDB.Database
  Dim sql : sql = "CREATE TABLE IF NOT EXISTS TrixSongRank (ID INTEGER PRIMARY KEY, Rank INTEGER)"
  If Debug Then Call out("#BEGINTRANSACTION")
  Call dbo.BeginTransaction()
  If Debug Then Call out("#"&sql)  
  Call dbo.ExecSQL(sql)
  If Debug Then Call out("#COMMIT")
  Call dbo.Commit()
  
  'register events
  Call Script.RegisterEvent(SDB,"OnPlay","Event_OnPlay")  
End Sub

Sub OnAppIdle2
  Call Script.UnRegisterHandler("OnAppIdle")   
  Dim but : Set but = SDB.Objects("SAToolbarButton")
  Dim but2 : Set but2 = SDB.Objects("SAToolbarButton2") 
  Select Case SDB.IniFile.IntValue("SimilarArtists","Toolbar")
    Case 0
      but.Visible = False      
      but2.Visible = False
    Case 1
      but.Visible = True
      but2.Visible = False        
    Case 2
      but.Visible = False
      but2.Visible = True
    Case 3
      but.Visible = True
      but2.Visible = True
  End Select  
End Sub

Sub Event_OnPlay
  If SDB.IniFile.BoolValue("SimilarArtists","OnPlay") Then 
    If SDB.Player.CurrentSongIndex+2 > SDB.Player.CurrentSongList.Count Then    
      If Not (SDB.Player.CurrentSong Is Nothing) Then      
        Dim list : Set list = SDB.NewSongList
        Call list.Add(SDB.Player.CurrentSong)
        Set SDB.Objects("SimilarArtistsPlay") = list.Artists
        Call SimilarArtists()
      End If
    End If
  End If
End Sub

Sub Toolbar(but)
  Set SDB.Objects("SimilarArtistsPlay") = Nothing
  Call SimilarArtists
End Sub

Sub Toolbar2(but2)
  Dim ini : Set ini = SDB.IniFile
  If ini.BoolValue("SimilarArtists","OnPlay") Then
    ini.BoolValue("SimilarArtists","OnPlay") = False 
    but2.IconIndex = ini.IntValue("SimilarArtists","OffIconIndex")
  Else
    ini.BoolValue("SimilarArtists","OnPlay") = True
    but2.IconIndex = ini.IntValue("SimilarArtists","OnIconIndex")
  End If
End Sub

Sub SimilarArtists
  'check not already running
  Dim que : Set que = SDB.Objects("SimilarArtistsQueue")
  If Not (que Is Nothing) Then
    Select Case SDB.MessageBox("SimilarArtists: This script is already running. If it has stalled then please click 'Yes' to reset the script, otherwise click 'No' to allow it to continue processing."&VbCrLf&VbCrLf&"Do you want to reset this script?",mtConfirmation,Array(mbYes,mbNo))
      Case mrYes
        Call ClearUp("Script manually reset.",mtError)
      Case mrNo
        Exit Sub
    End Select  
  End If
  
  'check onplay
  Dim boo : boo = True
  Dim song : Set song = SDB.Player.CurrentSong
  Dim list : Set list = SDB.Objects("SimilarArtistsPlay")
  If list Is Nothing Then
    'get selected artists
    Set list = SDB.SelectedSongList 
    If list.Count = 0 Then 
      Set list = SDB.AllVisibleSongList 
      If list.Count = 0 Then
        Call SDB.MessageBox("SimilarArtists: There are no selected tracks to process.",mtError,Array(mbOk))
        Exit Sub
      End If        
    End If
	  If list.Count = 1 Then
	    Set song = list.Item(0)
	  Else
	    Set song = Nothing
	  End If
    Set list = list.Artists	
    boo = False
  End If
  Set SDB.Objects("SimilarArtistsSong") = song
  Set SDB.Objects("SimilarArtistsList") = list
  Set SDB.Objects("SimilarArtistsPlay") = Nothing
  
  'set progress bar
  Dim prog : Set prog = SDB.Progress
  Dim text : text = "Initialising script..."
  If Debug Then Call out(text)
  prog.Text = "SimilarArtists: "&text
  prog.Value = 0
  prog.MaxValue = list.Count
  Set SDB.Objects("SimilarArtistsProgress") = prog
  
  'empty database table
  Dim dbo : Set dbo = SDB.Database
  Dim sql : sql = "DELETE FROM TrixSongRank"
  If Debug Then Call out("#BEGINTRANSACTION")  
  Call dbo.BeginTransaction()
  If Debug Then Call out("#"&sql)  
  Call dbo.ExecSQL(sql)
  If Debug Then Call out("#COMMIT")  
  Call dbo.Commit()
  Set dbo = Nothing
  
  'create queue
  Dim ini : Set ini = SDB.IniFile  
  Set que = CreateObject("Scripting.Dictionary")
  que.Item("beg") = Timer
  que.Item("lst") = Timer-1
  que.Item("sts") = "READY"
  que.Item("cur") = 0
  que.Item("max") = list.Count
  que.Item("lim") = ini.IntValue("SimilarArtists","Limit")
  que.Item("nam") = ini.StringValue("SimilarArtists","Name")
  que.Item("con") = ini.IntValue("SimilarArtists","Confirm")
  que.Item("tpa") = ini.IntValue("SimilarArtists","TPA")
  que.Item("tpl") = ini.IntValue("SimilarArtists","TPL")
  que.Item("rem") = que.Item("tpl")
  que.Item("par") = ini.StringValue("SimilarArtists","Parent")
  que.Item("bla") = ini.StringValue("SimilarArtists","Black")
  que.Item("exc") = ini.StringValue("SimilarArtists","Exclude")
  If ini.BoolValue("SimilarArtists","Random") Then
    Randomize
    que.Item("ran") = 1
  Else
    que.Item("ran") = 0
  End If
  que.Item("see") = ini.StringValue("SimilarArtists","Seed")
  If song Is Nothing Then
    que.Item("se2") = 0
  Else
    que.Item("se2") = ini.StringValue("SimilarArtists","Seed2")
  End if
  If ini.BoolValue("SimilarArtists","Best") Then
    que.Item("bes") = "Rating DESC,"
  Else
    que.Item("bes") = ""
  End If
  Dim rat : rat = ini.IntValue("SimilarArtists","Rating")
  If ini.BoolValue("SimilarArtists","Unknown") Then
    If rat = 0 Then
      que.Item("rat") = ""
    Else
      que.Item("rat") = " AND (Rating<0 OR Rating>"&(rat-5)&")"
    End If
  Else
    If rat = 0 Then
      que.Item("rat") = " AND (Rating>-1 AND Rating<101)"
    Else
      que.Item("rat") = " AND (Rating>"&(rat-5)&" AND Rating<101)"
    End If  
  End If
  Dim str : str = ini.StringValue("SimilarArtists","Genre")
  If str = "" Then
    que.Item("gen") = ""
  Else
    If InStr(str,",") = 0 Then 
      str = "SELECT IDGenre FROM Genres WHERE GenreName='"&FixSql(str)&"'"
    Else
      Dim i : i = 0
      Dim arr : arr = Split(str,",")
      str = "SELECT IDGenre FROM Genres WHERE GenreName='"&FixSql(arr(0))&"'"
      For i = 1 To UBound(arr)
        str = str&" OR GenreName='"&FixSql(arr(i))&"'"
      Next
    End If
	  If Debug Then Call out("#"&str)  
    Dim dit : Set dit = SDB.Database.OpenSQL(str)
    If dit.EOF Then
      que.Item("gen") = ""
    Else
      str = dit.StringByIndex(0)
      dit.Next
      While Not dit.EOF
        str = str&","&dit.StringByIndex(0)
        dit.Next
      WEnd
      que.Item("gen") = " AND (GenresSongs.IDGenre NOT IN ("&str&"))"
    End If
    Set dit = Nothing
  End If
  que.Item("ovr") = ini.IntValue("SimilarArtists","Overwrite")
  If ini.BoolValue("SimilarArtists","Enqueue") Then
    que.Item("enq") = 1
  Else
    que.Item("enq") = 0
  End If  
  que.Item("nav") = ini.IntValue("SimilarArtists","Navigate")
  If ini.BoolValue("SimilarArtists","Rank") Then
    que.Item("rnk") = 1
  Else
    que.Item("rnk") = 0
  End If  
  If boo And ini.BoolValue("SimilarArtists","Ignore") Then
    que.Item("ign") = 1
  Else
    que.Item("ign") = 0
  End If   
  
  'build blacklist
  Dim j : j = 0
  Dim a : a = Split(que.Item("bla"),",")
  Dim bla : Set bla = CreateObject("Scripting.Dictionary")
  For j = 0 To UBound(a)
    bla.Item(a(j)) = "bla"
  Next
  
  'build list
  Dim k,l,itmID,iter
  For l = 0 To list.Count-1
    Dim itm : Set itm = list.Item(l)
    a = Split(itm.Name,"; ")
    For j = 0 To UBound(a)
      If Not (bla.Exists(a(j))) Then
        sql = "SELECT Id FROM Artists WHERE Artist='"&FixSql(a(j))&"'"
		    If Debug Then Call out("#"&sql)  
        Set iter = SDB.Database.OpenSQL(sql)
        If iter.EOF Then
          itmID = 0
        Else
          itmID = iter.ValueByIndex(0)
        End If
        Set iter = Nothing        
        If itmID > 0 Then       
          k = k+1      
          que.Item("#"&k) = a(j)&"~"&itmID
          bla.Item(a(j)) = "dup"
        End If
      End If
    Next
  Next
  que.Item("max") = k
  prog.MaxValue = k
  If SDB.IniFile.BoolValue("SimilarArtists","Sort") Then
    Call SortArtists(que)
  End If  
  Set SDB.Objects("SimilarArtistsQueue") = que  
  
  'clear now playing list
  If ini.BoolValue("SimilarArtists","ClearNP") Then
    SDB.Player.PlaylistClear
  End If    
  
  'set controller
  Dim tmr : Set tmr = SDB.CreateTimer(250)
  Set SDB.Objects("SimilarArtistsTimer1") = tmr
  Call Script.RegisterEvent(tmr,"OnTimer","Controller") 
End Sub

Sub SortArtists(que)
  'extract artists from queue
  Dim a : a = que.Keys
  Dim i : i = 0
  Dim art : Set art = CreateObject("Scripting.Dictionary")
  For i = 0 To UBound(a)
    If Left(a(i),1) = "#" Then
      art.Item(que.Item(a(i))) = Mid(a(i),2)
      Call que.Remove(a(i))
    End If
  Next
  a = art.Keys
  
  'sort artists
  Dim boo : boo = False
  Dim tmp : tmp = ""
  Do
    boo = True
    For i = 0 To UBound(a)-1
      If a(i+1) < a(i) Then
        boo = False
        tmp = a(i)
        a(i) = a(i+1)
        a(i+1) = tmp
      End If
    Next
  Loop Until boo
  
  'return artists to queue
  For i = 0 To UBound(a)
    que.Item("#"&(i+1)) = a(i)
  Next
End Sub

Sub Controller(tmr) 
  'get progress
  Dim prog : Set prog = SDB.Objects("SimilarArtistsProgress")
  If prog Is Nothing Then
    Call ClearUp("Sorry, the progress bar has been lost.",mtError)
    Exit Sub
  End If  
  
  'check cancelled
  If prog.Terminate Then
    Call ClearUp("Process cancelled by user.",mtInformation)
    Exit Sub
  End If  
  
  'get queue
  Dim que : Set que = SDB.Objects("SimilarArtistsQueue")
  If que Is Nothing Then
    Call ClearUp("Sorry, the queue has been lost.",mtError)
    Exit Sub
  End If
  
  'check status
  Select Case que.Item("sts") 
    Case "READY"
      'continue
    Case "BUSY"
      'check xml
      Dim xml2 : Set xml2 = SDB.Objects("SimilarArtistsXML")
      If xml2 Is Nothing Then
        Call ClearUp("Sorry, the xml object has been lost.",mtError)
      End If  
      Exit Sub
    Case "EXIT"
      Call ClearUp("Process cancelled by user.",mtInformation)
      Exit Sub      
    Case Else
      Call ClearUp("Sorry, unknown status '"&que.Item("sts")&"'.",mtError)
      Exit Sub
  End Select
  
  'check items left
  Dim cur : cur = Int(que.Item("cur"))
  Dim max : max = Int(que.Item("max"))
  If Not (cur < max) Then
    prog.Value = max
    If Int(que.Item("con")) = 1 Then
      If max = 1 Then
        Call ClearUp("Artist has been processed.",mtInformation)
      Else
        Call ClearUp("All "&max&" artists have been processed.",mtInformation)      
      End If
    Else
      Call ClearUp("",mtInformation)
    End If
    Exit Sub
  End If  
  
  'check last query time
  If Timer < (que.Item("lst")+1) Then
    Exit Sub
  End If
  
  'update queue
  cur = cur+1
  que.Item("sts") = "BUSY"
  que.Item("lst") = Timer
  que.Item("cur") = cur
  que.Item("rem") = que.Item("tpl")
  
  'get item
  Dim itmName : itmName = que.Item("#"&cur)
  itmName = Left(itmName,InStrRev(itmName,"~")-1)
  
  'update progress
  Dim text : text = "Processing artist '"&itmName&"' ("&cur&"/"&max&")..."
  If Debug Then Call out(text)  
  prog.Text = "SimilarArtists: "&text
  prog.Value = cur-1
  SDB.ProcessMessages
  
  'send query to last.fm
  Dim xml : Set xml = SendQuery("artist.getSimilar",itmName,"")
  Set SDB.Objects("SimilarArtistsXML") = xml
  
  'wait for response
  Dim res : Set res = SDB.CreateTimer(100)
  Set SDB.Objects("SimilarArtistsTimer2") = res
  Call Script.RegisterEvent(res,"OnTimer","Response")   
End Sub

Function SendQuery(met,art,str)
  Set SendQuery = CreateObject("Microsoft.XMLHTTP")
  Dim arr : arr = Split(met,".")   
  Dim url : url = BaseURL&"?method="&met&"&api_key="&ApiKey
  If Len(art) > 0 Then
    url = url&"&artist="&EncodeUrl(FixPrefixes(art))
  End If
  If Len(str) > 0 Then
    url = url&"&"&str
  End If
  If Debug Then Call out("@"&url)  
  Call SendQuery.open("GET",url,true)
  Call SendQuery.send()
End Function

Function LoadLastFmXML(str)
  Set LoadLastFmXML = CreateObject("Microsoft.XMLDOM")
  Call LoadLastFmXML.LoadXML(str)
  If LoadLastFmXML.parseError.errorCode <> 0 Then
    Call LogMe("@ErrorCode="&LoadLastFmXML.parseError.errorCode)
    Call LogMe("@ErrorMess="&LoadLastFmXML.parseError.reason)
    Call LogMe("@ErrorLine="&LoadLastFmXML.parseError.line)
    Call LogMe("@ErrorChar="&LoadLastFmXML.parseError.linepos)
    Call LogMe("@ErrorText="&LoadLastFmXML.parseError.srcText)
    Set LoadLastFmXML = Nothing
  Else
    If InStr(str,"<lfm status=""ok"">") = 0 Then
      Dim lfm : Set lfm = Nothing
      For Each lfm In LoadLastFmXML.getElementsByTagName("lfm")
        Call LogMe("@ErrorStat="&lfm.attributes.getNamedItem("status").nodeValue)
      Next
      For Each lfm In LoadLastFmXML.getElementsByTagName("error")
        Call LogMe("@ErrorCode="&lfm.attributes.getNamedItem("code").nodeValue)
        Call LogMe("@ErrorMess="&lfm.Text)
      Next
      Set LoadLastFmXML = Nothing
    End If                  
  End If  
End Function

Sub Response(tmr)  
  'get query
  Dim xml : Set xml = SDB.Objects("SimilarArtistsXML")
  If xml Is Nothing Then
    Call Script.UnregisterEvents(tmr)
    Exit Sub
  End If

  'check status  
  If Not (xml.readyState = 4) Then
    Exit Sub
  End If
  Call Script.UnregisterEvents(tmr)
  
  'read response
  Dim str : str = xml.responseText
  Set xml = LoadLastFmXML(str)  
  If xml Is Nothing Then
    Exit Sub
  End If
  
  'get queue
  Dim que : Set que = SDB.Objects("SimilarArtistsQueue")
  If que Is Nothing Then
    Exit Sub
  End If
  
  'get item
  Dim cur : cur = que.Item("cur")
  Dim itmName : itmName = que.Item("#"&cur)
  Dim itmID : itmID = Mid(itmName,InStrRev(itmName,"~")+1)
  itmName = Left(itmName,InStrRev(itmName,"~")-1)  
    
  'create playlist
  Dim ply : Set ply = Nothing
  Dim ovr : ovr = Int(que.Item("ovr"))
  If ovr < 2 Then
    cur = 1
    Dim nam : nam = Replace(que.Item("nam"),"%",itmName)
    Dim tmp : tmp = nam
    Dim txt : txt = "create"
    Set ply = SDB.PlaylistByTitle(tmp)
    If Int(que.Item("ovr")) = 1 Then
      If Not (ply.Title = "") Then
        ply.Clear
        txt = "overwrite"
      End If
    Else
      While Not (ply.Title = "")
        cur = cur+1
        tmp = nam&"_"&cur
        Set ply = SDB.PlaylistByTitle(tmp)
      WEnd 
    End If
    If Int(que.Item("con")) = 1 Then    
      Select Case SDB.MessageBox("SimilarArtists: Do you wish to "&txt&" playlist '"&tmp&"'?",mtConfirmation,Array(mbYes,mbNo,mbYesToAll,mbNoToAll))
        Case mrNo
          que.Item("sts") = "READY"
          Exit Sub
        Case mrYesToAll
          que.Item("con") = "0"
        Case mrNoToAll
          que.Item("sts") = "EXIT"
          Exit Sub        
      End Select
    End If
    If (ovr = 0) Or (ply.Title = "") Then
      Dim par : Set par = SDB.PlaylistByTitle(que.Item("par"))
      If par Is Nothing Then
        Set par = SDB.PlaylistByTitle("")
      End If
      Set ply = par.CreateChildPlaylist(tmp)
    End If
  End If  
  
  'get settings
  Dim ele : Set ele = Nothing
  Dim tot : tot = Int(que.Item("lim"))
  Dim tpa : tpa = Int(que.Item("tpa"))
  Dim tpl : tpl = Int(que.Item("rem"))
  Dim rnk : rnk = Int(que.Item("rnk"))
  Dim bes : bes = que.item("bes")
  Dim rat : rat = que.item("rat")
  Dim gen : gen = que.item("gen")
  Dim bla : bla = que.Item("bla")
  Dim exc : exc = que.item("exc")
  Dim ign : ign = que.Item("ign")
  Dim sql : sql = ""
  cur = 0
  
  'include seed track
  If (que.item("se2") = "1") And (tpl > 0) Then
    Dim sng : Set sng = SDB.Objects("SimilarArtistsSong")
	  If Not (sng Is Nothing) Then
      If ovr = 2 Then
        If PlaylistAddTrackById(sng.ID,ign) Then
          tpl = tpl-1
        End If
      Else
        Call ply.AddTrackById(sng.ID)
        tpl = tpl-1
	    End If
    End If
  End If
  
  'get last.fm rankings
  Dim whr : whr = "Songs WHERE "
  If rnk = 1 Then
    whr = "Songs LEFT OUTER JOIN TrixSongRank ON Songs.ID=TrixSongRank.ID WHERE "
  End if
  
  'include seed artist
  If (que.item("see") = "1") And (tpl > 0) Then
    Call GetTopTracks(itmID,itmName)
    sql = "SELECT Songs.Id,Songs.SongTitle FROM ArtistsSongs,"
    If gen = "" Then
      sql = sql&whr&"Songs.ID=ArtistsSongs.IDSong AND ArtistsSongs.PersonType=1 AND ArtistsSongs.IDArtist="&itmID
    Else
      sql = sql&"GenresSongs,"&whr&"Songs.ID=GenresSongs.IDSong AND Songs.ID=ArtistsSongs.IDSong AND ArtistsSongs.PersonType=1 AND ArtistsSongs.IDArtist="&itmID&gen
    End If
	  If rnk = 1 Then
	    sql = sql&rat&" GROUP BY Songs.SongTitle ORDER BY TrixSongRank.Rank DESC,"&bes&"Random()"
  	Else
	    sql = sql&rat&" GROUP BY Songs.SongTitle ORDER BY "&bes&"Random()"
	  End If
	  If Debug Then Call out("#"&sql)  
    Dim qit : Set qit = SDB.Database.OpenSQL(sql)
    If Not qit.EOF Then
      Dim j : j = 0
      cur = cur+1  
      While (Not qit.EOF) And (j < tpa) And (tpl > 0)
        If Not IsInList2(exc,qit.StringByIndex(1)) Then
          If ovr = 2 Then
            If PlaylistAddTrackById(qit.StringByIndex(0),ign) Then
              tpl = tpl-1
              j = j+1
            End If
          Else
            Call ply.AddTrackById(qit.StringByIndex(0))
            tpl = tpl-1
            j = j+1
          End If
        End If
        qit.Next
      WEnd      
    End If
  End If
  Set qit = Nothing
  
  'read responses
  If (cur < tot) And (tpl > 0) Then
    For Each ele In xml.getElementsByTagName("artist")
      Dim art : art = ele.ChildNodes.Item(0).Text      
      If Not IsInList(bla,art) Then
        sql = "SELECT Id,Artist FROM Artists WHERE Artist='"&FixSqlArt(art)&"'"
		    If Debug Then Call out("#"&sql)  
        Dim dit : Set dit = SDB.Database.OpenSQL(sql)
        If Not dit.EOF Then  
          Dim aid : aid = dit.StringByIndex(0)
          Dim anm : anm = dit.StringByIndex(1)
          Set dit = Nothing        
		      If rnk = 1 Then
		        Call GetTopTracks(aid,anm)
		      End If
		      sql = "SELECT Songs.Id,Songs.SongTitle FROM ArtistsSongs,"
          If gen = "" Then
            sql = sql&whr&"Songs.ID=ArtistsSongs.IDSong AND ArtistsSongs.PersonType=1 AND ArtistsSongs.IDArtist="&aid
          Else
            sql = sql&"GenresSongs,"&whr&"Songs.ID=GenresSongs.IDSong AND Songs.ID=ArtistsSongs.IDSong AND ArtistsSongs.PersonType=1 AND ArtistsSongs.IDArtist="&aid&gen
          End If
          If rnk = 1 Then
            sql = sql&rat&" GROUP BY Songs.SongTitle ORDER BY TrixSongRank.Rank DESC,"&bes&"Random()"
          Else
            sql = sql&rat&" GROUP BY Songs.SongTitle ORDER BY "&bes&"Random()"
          End If		  
		      If Debug Then Call out("#"&sql)
          Dim sit : Set sit = SDB.Database.OpenSQL(sql)
          If Not sit.EOF Then          
            Dim i : i = 0
            cur = cur+1  
            While (Not sit.EOF) And (i < tpa) And (tpl > 0)
              If Not IsInList2(exc,sit.StringByIndex(1)) Then
                If ovr = 2 Then
                  If PlaylistAddTrackById(sit.StringByIndex(0),ign) Then
                    tpl = tpl-1
                    i = i+1
                  End If
                Else              
                  Call ply.AddTrackById(sit.StringByIndex(0))
                  tpl = tpl-1
                  i = i+1
                End If
              End If
              sit.Next
            WEnd
          End If
          Set sit = Nothing
        End If
        Set dit = Nothing        
      End If
      If (cur = tot) Or (tpl = 0) Then
        Exit For
      End If
    Next
  End If
  
  'randomise
  If Int(que.Item("ran")) = 1 Then
    If ovr = 2 Then
      Call RandomiseNowPlaying()
    Else
      Call RandomisePlaylist(ply)
    End If
  End If
  
  'enqueue
  If ovr < 2 Then    
    If Int(que.Item("enq")) = 1 Then
      Call EnqueuePlaylist(ply,ign)
    End If
  End If 
  
  'navigate
  Select Case Int(que.item("nav"))
    Case 1
      If ovr = 2 Then
        If Int(que.Item("enq")) = 1 Then
          SDB.MainTree.CurrentNode = SDB.MainTree.Node_NowPlaying
        End If
      Else
        Call NavigatePlaylist(ply)
      End If
    Case 2
      SDB.MainTree.CurrentNode = SDB.MainTree.Node_NowPlaying
  End Select
  
  'finished 
  que.Item("rem") = tpl
  que.Item("sts") = "READY"
End Sub

Sub GetTopTracks(aid,nam)
  Dim prog : Set prog = SDB.Objects("SimilarArtistsProgress")
  Dim cnt : cnt = 0
  Dim xml : Set xml = SendQuery("artist.getTopTracks",nam,"limit=100")
  While (xml.readyState < 4) And (cnt < 300)
    Call SDB.Tools.Sleep(100)
    SDB.ProcessMessages
    cnt = cnt+1
    If prog.Terminate Then
      Call ClearUp("Process cancelled by user.",mtInformation)
      Exit Sub
    End If    
    If Debug Then Call out("~"&cnt&"/300: ReadyState is "&TranslateReadyState(xml.readyState))
  WEnd
  If xml.readyState = 4 Then
    Dim str : str = xml.responseText
	  Set xml = LoadLastFmXML(str)  
    If Not (xml Is Nothing) Then
      Dim dic : Set dic = CreateObject("Scripting.Dictionary")
      Dim ele : Set ele = Nothing
      Dim dbo : Set dbo = SDB.Database
      For Each ele In xml.getElementsByTagName("track")
        If prog.Terminate Then
          Call ClearUp("Process cancelled by user.",mtInformation)
          Exit Sub
        End If    			  
		    Dim rnk : rnk = Int(ele.getAttribute("rank"))
	      Dim ttl : ttl = ele.getElementsByTagName("name").Item(0).Text
		    If (rnk <> "") And (ttl <> "") Then
          str = StripName(ttl)
		      If str = "" Then
		        str = FixSql(ttl)
		      End If
          Dim val : val = 101-rnk
		      Dim sql : sql = "SELECT Songs.ID FROM Songs,ArtistsSongs WHERE Songs.ID=ArtistsSongs.IDSong AND ArtistsSongs.PersonType=1"
		      sql = sql&" AND ArtistsSongs.IDArtist="&aid&" AND Replace(Replace(Replace(Replace(Replace(Replace(Replace(Replace(Replace"
		      sql = sql&"(Replace(Replace(Replace(Replace(Replace(UpperW(Songs.SongTitle),'&','AND'),'+','AND'),' N ','AND'),'''N''','AND')"
		      sql = sql&",' ',''),'.',''),',',''),':',''),';',''),'-',''),'_',''),'!',''),'''',''),'""','')='"&str&"'"
		      If Debug Then Call out("#"&sql)
          Dim dit : Set dit = dbo.OpenSQL(sql)
		      While (Not dit.EOF)
            dic.Item(dit.StringByIndex(0)) = val
            dit.Next
          WEnd    
          Set dit = Nothing	          
		    End If
      Next
      Set dbo = Nothing
      If dic.Count > 0 Then
        Set dbo = SDB.Database
        If Debug Then Call out("#BEGINTRANSACTION")
        Call dbo.BeginTransaction()
        Dim arr : arr = dic.Keys
        For cnt = 0 To UBound(arr)        
          str = arr(cnt)
	  	    Dim sq2 : sq2 = "REPLACE INTO TrixSongRank (ID,Rank) VALUES ("&str&","&dic.Item(str)&")"
		      If Debug Then Call out("#"&sq2)
          Call dbo.ExecSQL(sq2)
        Next
        If Debug Then Call out("#COMMIT")
        Call dbo.Commit()
        Set dbo = Nothing
      End If
	  End If
  End If
End Sub

Function TranslateReadyState(num)
  Select Case num
    Case 0
      TranslateReadyState = "Uninitialised (0)"
    Case 1
      TranslateReadyState = "Loading (1)"
    Case 2 
      TranslateReadyState = "Loaded (2)"
    Case 3
      TranslateReadyState = "Interactive (3)"
    Case 4
      TranslateReadyState = "Complete (4)"
    Case Else
      TranslateReadyState = "Unknown ("&num&")"
  End Select
End Function

Function StripName(nam)
  StripName = UCase(nam)
  If StripName = "" Then
    Exit Function
  End If
  StripName = Replace(StripName,"&","AND")
  StripName = Replace(StripName,"+","AND")
  StripName = Replace(StripName," N ","AND")
  StripName = Replace(StripName,"'N'","AND")  
  StripName = Replace(StripName," ","")
  StripName = Replace(StripName,".","")
  StripName = Replace(StripName,",","")
  StripName = Replace(StripName,":","")
  StripName = Replace(StripName,";","")
  StripName = Replace(StripName,"-","")
  StripName = Replace(StripName,"_","")
  StripName = Replace(StripName,"!","")
  StripName = Replace(StripName,"'","")
  StripName = Replace(StripName,"""","")
End Function

Sub ClearUp(mes,typ)
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
  Set SDB.Objects("SimilarArtistsProgress") = Nothing
  Set SDB.Objects("SimilarArtistsSong") = Nothing
  Set SDB.Objects("SimilarArtistsList") = Nothing
  Set SDB.Objects("SimilarArtistsXML") = Nothing
  Set SDB.Objects("SimilarArtistsPlay") = Nothing
  Set SDB.Objects("SimilarArtistsQueue") = Nothing
  If mes <> "" Then
    Call SDB.MessageBox("SimilarArtists: "&mes,typ,Array(mbOk))
  End If
End Sub

Function FixSql(name)
  FixSql = Replace(name,"'","''")
End Function

Function FixSqlArt(name)
  FixSqlArt = Replace(name,"'","''")
  FixSqlArt = Replace(FixSqlArt,"&amp;","&")
  Dim TheList : TheList = ""
  Dim ini : Set ini = SDB.IniFile
  If ini.BoolValue("Options","IgnoreTHEs") Then
    TheList = ini.StringValue("Options","IgnoreTHEStrings")
  End If  
  If Not (TheList = "") Then
    Dim i : i = 0
    Dim thes : thes = Split(TheList,",")
    For i = 0 To UBound(thes)
      Dim s : s = Trim(thes(i))&" "
      If UCase(Left(name,Len(s))) = UCase(s) Then
        FixSqlArt = Mid(FixSqlArt,Len(s)+1)&"' OR Artist='"&FixSqlArt
        Exit For
      End If
    Next    
  End If
End Function

Function FixPrefixes(str)
  FixPrefixes = str
  Dim TheList : TheList = ""
  Dim ini : Set ini = SDB.IniFile
  If ini.BoolValue("Options","IgnoreTHEs") Then
    TheList = ini.StringValue("Options","IgnoreTHEStrings")
  End If  
  Dim thes : thes = Split(TheList,",")
  Dim i : i = 0
  For i = 0 To UBound(thes)
    Dim s : s = Trim(thes(i))
    Dim l : l = Len(s)+3
    If UCase(Right(FixPrefixes,l)) = " ("&UCase(s)&")" Then
      FixPrefixes = s&" "&Left(FixPrefixes,Len(FixPrefixes)-l)  
      Exit For      
    End If
    l = Len(s)+2
    If UCase(Right(FixPrefixes,l)) = ", "&UCase(s) Then
      FixPrefixes = s&" "&Left(FixPrefixes,Len(FixPrefixes)-l)  
      Exit For      
    End If        
  Next
End Function

Function EncodeUrl(sRawURL)
  Const sValidChars = "1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz\/:"
  Dim url : url = Replace(sRawURL,"+","%2B")
  If Len(url) > 0 Then
    Dim i : i = 1
    Do While i < Len(url)+1
      Dim s : s = Mid(url,i,1)
      If InStr(1,sValidChars,s,0) = 0 Then
        Dim d : d = AscW(s)
        If d < 0 Then
          d = d+65536
        End If      
        If d = 32 Or d > 65535 Then
          s = "+"
        Else
          If d < 128 Then
            s = DecToHex(d)
          ElseIf d < 2048 Then
            s = DecToUtf2(d)
          Else
            s = DecToUtf3(d)
          End If
        End If
      Else
        Select Case s
          Case "&"
            s = "%2526"
          Case "/"
            s = "%2F"
          Case "\"
            s = "%5C"
          Case ":"
            s = "%3A"
        End Select
      End If
      EncodeUrl = EncodeUrl&s
      i = i+1
    Loop
  End If
End Function

Function DecodeUrl(str)
  DecodeUrl = str
  Dim s1,s2,s3,s4,s5,d1,d2,d3,d4,d5,b1,b2,b3,b4,b5
  Dim i : i = InStr(DecodeUrl,"%")
  While (i > 0)
    s1 = Mid(DecodeUrl,i+1,2)
    If IsHex(s1) Then
      d1 = HexToDec(s1)
      s1 = Left(DecodeUrl,i-1)
      s2 = Mid(DecodeUrl,i+4,2)
      If (Mid(DecodeUrl,i+3,1) = "%") And (IsHex(s2)) Then
        b1 = DecToBin(d1,128)
        If Left(b1,1) = "0" Then
          s2 = Chr(d1)
          s3 = Mid(DecodeUrl,i+3)        
        Else        
          d2 = HexToDec(s2)
          b2 = DecToBin(d2,128)
          If (Left(b1,3) = "110") And (Left(b2,2) = "10") Then
            b3 = Mid(b1,4)&Mid(b2,3)
            s2 = ChrW(BinToDec(b3))
            s3 = Mid(DecodeUrl,i+6)
          ElseIf (Left(b1,4) = "1110") And (Left(b2,2) = "10") And (Mid(DecodeUrl,i+6,1) = "%") Then            
            s4 = Mid(DecodeUrl,i+7,2)
            d4 = HexToDec(s4)
            b3 = DecToBin(d4,128)
            b4 = Mid(b1,5)&Mid(b2,3)&Mid(b3,3)
            s2 = ChrW(BinToDec(b4))
            s3 = Mid(DecodeUrl,i+9)                    
          ElseIf (Left(b1,5) = "11110") And (Left(b2,2) = "10") And (Mid(DecodeUrl,i+6,1) = "%") And (Mid(DecodeUrl,i+9,1) = "%") Then
            s4 = Mid(DecodeUrl,i+7,2)
            d4 = HexToDec(s4)
            b3 = DecToBin(d4,128)
            s5 = Mid(DecodeUrl,i+10,2)
            d5 = HexToDec(s5)
            b4 = DecToBin(d5,128)
            b5 = Mid(b1,6)&Mid(b2,3)&Mid(b3,3)&Mid(b4,3)
            s2 = ChrW(BinToDec(b4))
            s3 = Mid(DecodeUrl,i+12)          
          End If
        End If          
      Else
        s2 = Chr(d1)
        s3 = Mid(DecodeUrl,i+3)
      End If
      DecodeUrl = s1&s2&s3
    End If
    i = InStr(i+1,DecodeUrl,"%")
  WEnd
End Function

Function IsHex(h)
  IsHex = False
  Dim i : i = 0
  For i = 1 To Len(h)
    If Instr("0123456789ABCDEF",UCase(Mid(h,i,1))) = 0 Then
      Exit Function
    End If
  Next
  IsHex = True
End Function

Function HexToDec(h)
  HexToDec = 0
  Dim i : i = 0
  For i = Len(h) To 1 Step -1
    Dim d : d = Mid(h,i,1)
    d = InStr("0123456789ABCDEF",UCase(d))-1
    If d >= 0 Then
      HexToDec = HexToDec+(d*(16^(Len(h)-i)))
    Else
      HexToDec = 0
      Exit Function
    End If
  Next
End Function

Function DecToBin(intDec,e)
  DecToBin = ""
  Dim d : d = intDec
  While e >= 1
    If d >= e Then
      d = d - e
      DecToBin = DecToBin&"1"
    Else
      DecToBin = DecToBin&"0"
    End If
    e = e/2
  Wend
End Function

Function BinToHex(strBin)
  Dim d : d = 0
  Dim i : i = 0
  For i = Len(strBin) To 1 Step -1
    Select Case Mid(strBin,i,1)
      Case "0"
        'do nothing
      Case "1"
        d = d+(2^(Len(strBin)-i))
      Case Else
        BinToHex = "00"
        Exit Function
    End Select
  Next
  BinToHex = DecToHex(d)
End Function

Function DecToHex(d)
  If d < 16 Then
    DecToHex = "%0"&CStr(Hex(d))
  Else
    DecToHex = "%"&CStr(Hex(d))
  End If
End Function

Function DecToUtf2(d)
  Dim b : b = DecToBin(d,1024)
  Dim a : a = "110"&Left(b,5)
  b = "10"&Mid(b,6)
  DecToUtf2 = BinToHex(a)&BinToHex(b)
End Function 

Function DecToUtf3(d)
  Dim b : b = DecToBin(d,32768)
  Dim a : a = "1110"&Left(b,4)
  Dim c : c = "10"&Mid(b,11,6)
  b = "10"&Mid(b,5,6)
  DecToUtf3 = BinToHex(a)&BinToHex(b)&BinToHex(c)
End Function 

Function DecToUtf4(d)
  Dim b : b = DecToBin(d,557056)
  Dim a : a = "11110"&Left(b,3)
  Dim c : c = "10"&Mid(b,10,6)
  Dim e : e = "10"&Mid(b,16,6)
  b = "10"&Mid(b,4,6)
  DecToUtf4 = BinToHex(a)&BinToHex(b)&BinToHex(c)&BinToHex(e)
End Function 

Sub InitSheet(Sheet)
  Dim ini : Set ini = SDB.IniFile  
  Dim ui : Set ui = SDB.UI
  Dim edt : Set edt = ui.NewLabel(Sheet)
  edt.Common.SetRect 5, 10, 50, 20
  edt.Caption = "Toolbar buttons:"
  edt.Autosize = False  
  
  Set edt = ui.NewDropdown(Sheet)
  edt.Common.SetRect 90, 7, 100, 20
  edt.Common.ControlName = "SAToolbar" 
  edt.Style = 2
  edt.AddItem("None")
  edt.AddItem("Run script")
  edt.AddItem("Auto on/off")
  edt.AddItem("Both")
  edt.ItemIndex = ini.IntValue("SimilarArtists","Toolbar")
  
  Set edt = ui.NewCheckBox(Sheet)
  edt.Common.SetRect 5, 35, 200, 20
  edt.Common.ControlName = "SAConfirm"
  edt.Caption = "Show confirmation prompt?"
  edt.Checked = ini.BoolValue("SimilarArtists","Confirm")  
  
  Set edt = ui.NewCheckBox(Sheet)
  edt.Common.SetRect 5, 60, 200, 20
  edt.Common.ControlName = "SASort"
  edt.Caption = "Sort artists before processing?"
  edt.Checked = ini.BoolValue("SimilarArtists","Sort")  
  
  Set edt = ui.NewCheckBox(Sheet)
  edt.Common.SetRect 225, 10, 200, 20
  edt.Common.ControlName = "SARandom"
  edt.Caption = "Randomise playlists?"
  edt.Checked = ini.BoolValue("SimilarArtists","Random")  
  
  Set edt = ui.NewCheckBox(Sheet)
  edt.Common.SetRect 225, 35, 200, 20
  edt.Common.ControlName = "SASeed"
  edt.Caption = "Include seed artist?"
  edt.Checked = ini.BoolValue("SimilarArtists","Seed")   
  
  Set edt = ui.NewCheckBox(Sheet)
  edt.Common.SetRect 225, 60, 200, 20
  edt.Common.ControlName = "SASeed2"
  edt.Caption = "Include seed track (if only one)?"
  edt.Checked = ini.BoolValue("SimilarArtists","Seed2")
  
  Set edt = ui.NewLabel(Sheet)
  edt.Common.SetRect 5, 85, 50, 20
  edt.Caption = "Playlist creation:"
  edt.Autosize = False

  Set edt = ui.NewDropdown(Sheet)
  edt.Common.SetRect 90, 82, 300, 20
  edt.Common.ControlName = "SAOverwrite"   
  edt.Style = 2
  edt.AddItem("Create new playlist")
  edt.AddItem("Overwrite existing playlist")
  edt.AddItem("Do not create playlist")
  edt.ItemIndex = ini.IntValue("SimilarArtists","Overwrite")
  
  Set edt = ui.NewLabel(Sheet)
  edt.Common.SetRect 5, 110, 50, 20
  edt.Caption = "Playlist name:"
  edt.Autosize = False
  
  Set edt = ui.NewEdit(Sheet)
  edt.Common.SetRect 90, 107, 300, 20
  edt.Common.ControlName = "SAName" 
  edt.Common.Hint = "Use % to represent the artist name"
  edt.Text = ini.StringValue("SimilarArtists","Name") 
  
  Set edt = ui.NewLabel(Sheet)
  edt.Common.SetRect 5, 135, 50, 20
  edt.Caption = "Artist limit:"
  edt.Autosize = False
  
  Set edt = ui.NewSpinEdit(Sheet)
  edt.Common.SetRect 90, 132, 50, 20
  edt.Common.ControlName = "SALimit"
  edt.MinValue = 0
  edt.MaxValue = 9999
  edt.Value = ini.IntValue("SimilarArtists","Limit")      
  
  Set edt = ui.NewLabel(Sheet)
  edt.Common.SetRect 5, 160, 50, 20
  edt.Caption = "Tracks/artist:"
  edt.Autosize = False
  
  Set edt = ui.NewSpinEdit(Sheet)
  edt.Common.SetRect 90, 157, 50, 20
  edt.Common.Hint = "Maximum number of tracks from a single artist in a playlist"
  edt.Common.ControlName = "SATPA"
  edt.MinValue = 0
  edt.MaxValue = 9999
  edt.Value = ini.IntValue("SimilarArtists","TPA")  
  
  Set edt = ui.NewCheckBox(Sheet)
  edt.Common.SetRect 225, 135, 200, 20
  edt.Common.ControlName = "SABest"
  edt.Caption = "Select highest rated in library?"
  edt.Checked = ini.BoolValue("SimilarArtists","Best") 
  
  Set edt = ui.NewCheckBox(Sheet)
  edt.Common.SetRect 225, 160, 200, 20
  edt.Common.ControlName = "SARank"
  edt.Caption = "Select highest ranked by Last.Fm?"
  edt.Checked = ini.BoolValue("SimilarArtists","Rank")
  
  Set edt = ui.NewLabel(Sheet)
  edt.Common.SetRect 5, 186, 50, 20
  edt.Common.Hint = "Maximum number of tracks in total in a playlist"
  edt.Caption = "Tracks/playlist:"
  edt.Autosize = False
  
  Set edt = ui.NewSpinEdit(Sheet)
  edt.Common.SetRect 90, 182, 50, 20
  edt.Common.ControlName = "SATPL"
  edt.MinValue = 0
  edt.MaxValue = 9999
  edt.Value = ini.IntValue("SimilarArtists","TPL")    
  
  Set edt = ui.NewLabel(Sheet)
  edt.Common.SetRect 5, 210, 50, 20
  edt.Caption = "Parent playlist:"
  edt.Autosize = False
  
  Set edt = ui.NewDropdown(Sheet)
  edt.Common.SetRect 90, 207, 300, 20
  edt.Common.Hint = "Please select a playlist"
  edt.Common.ControlName = "SAParent" 
  edt.Style = 2
  edt.AddItem("[Playlists]")  
  edt.ItemIndex = 0
  Call AddPlaylists(edt,ini.StringValue("SimilarArtists","Parent"))
  
  Set edt = ui.NewLabel(Sheet)
  edt.Common.SetRect 5, 235, 50, 20
  edt.Caption = "Exclude artists:"
  edt.Autosize = False
  
  Set edt = ui.NewEdit(Sheet)
  edt.Common.SetRect 90, 232, 300, 20
  edt.Common.ControlName = "SABlack" 
  edt.Common.Hint = "Comma separated list of artists names"
  edt.Text = ini.StringValue("SimilarArtists","Black") 
  
  Set edt = ui.NewLabel(Sheet)
  edt.Common.SetRect 5, 260, 50, 20
  edt.Caption = "Exclude genres:"
  edt.Autosize = False
  
  Set edt = ui.NewEdit(Sheet)
  edt.Common.SetRect 90, 257, 300, 20
  edt.Common.ControlName = "SAGenre" 
  edt.Common.Hint = "Comma separated list of genres"
  edt.Text = ini.StringValue("SimilarArtists","Genre")
  
  Set edt = ui.NewLabel(Sheet)
  edt.Common.SetRect 5, 285, 50, 20
  edt.Caption = "Exclude titles:"
  edt.Autosize = False
  
  Set edt = ui.NewEdit(Sheet)
  edt.Common.SetRect 90, 282, 300, 20
  edt.Common.ControlName = "SAExclude" 
  edt.Common.Hint = "Comma separated list of words in titles"
  edt.Text = ini.StringValue("SimilarArtists","Exclude")  
  
  Set edt = ui.NewLabel(Sheet)
  edt.Common.SetRect 5, 310, 50, 20
  edt.Caption = "Minimum rating:"
  edt.Autosize = False
  
  Set edt = ui.NewDropdown(Sheet)
  edt.Common.SetRect 90, 307, 100, 20
  edt.Common.ControlName = "SARating"   
  edt.Common.Hint = "Select minimum rating stars"
  edt.Style = 2
  edt.AddItem("0 stars")
  edt.AddItem("0.5 stars")
  edt.AddItem("1 star")
  edt.AddItem("1.5 stars")
  edt.AddItem("2 stars")
  edt.AddItem("2.5 stars")
  edt.AddItem("3 stars")
  edt.AddItem("3.5 stars")
  edt.AddItem("4 stars")
  edt.AddItem("4.5 stars")
  edt.AddItem("5 stars")
  edt.ItemIndex = ini.IntValue("SimilarArtists","Rating")\10
  
  Set edt = ui.NewCheckBox(Sheet)
  edt.Common.SetRect 225, 310, 200, 20
  edt.Common.ControlName = "SAUnknown"
  edt.Caption = "Include unknown rating?"
  edt.Checked = ini.BoolValue("SimilarArtists","Unknown")
  
  Set edt = ui.NewLabel(Sheet)
  edt.Common.SetRect 5, 335, 50, 20
  edt.Caption = "Navigation:"
  edt.Autosize = False
  
  Set edt = ui.NewDropdown(Sheet)
  edt.Common.SetRect 90, 332, 300, 20
  edt.Common.ControlName = "SANavigate"   
  edt.Style = 2
  edt.AddItem("None")
  edt.AddItem("Navigate to new playlist")
  edt.AddItem("Navigate to now playing")
  edt.ItemIndex = ini.IntValue("SimilarArtists","Navigate")  
  
  Set edt = ui.NewCheckBox(Sheet)
  edt.Common.SetRect 5, 360, 400, 20
  edt.Common.ControlName = "SAOnPlay"
  edt.Caption = "Automatically run the script when playing the last track?"
  edt.Checked = ini.BoolValue("SimilarArtists","OnPlay")    
  
  Set edt = ui.NewCheckBox(Sheet)
  edt.Common.SetRect 5, 385, 400, 20  
  edt.Common.ControlName = "SAEnqueue"
  edt.Caption = "Automatically enqueue tracks?"
  edt.Checked = ini.BoolValue("SimilarArtists","Enqueue")       
  
  Set edt = ui.NewCheckBox(Sheet)
  edt.Common.SetRect 5, 410, 400, 20
  edt.Common.ControlName = "SAClearNP"
  edt.Caption = "Clear list before enqueuing tracks?"
  edt.Checked = ini.BoolValue("SimilarArtists","ClearNP")         
  
  Set edt = ui.NewCheckBox(Sheet)
  edt.Common.SetRect 5, 435, 400, 20
  edt.Common.ControlName = "SAIgnore"
  edt.Caption = "Ignore recently played tracks when enqueuing?"
  edt.Checked = ini.BoolValue("SimilarArtists","Ignore")   
End Sub

Sub AddPlaylists(drp,nam)
  'find names
  Dim dic : Set dic = CreateObject("Scripting.Dictionary")
  Call AddPlaylistsRec(dic,"")
  'sort them
  Dim i : i = 0
  Dim a : a = dic.Keys
  Dim b : b = True
  Dim m : m = ""
  While b
    b = False
    For i = 0 To UBound(a)-1
      If a(i+1) < a(i) Then
        b = True
        m = a(i)
        a(i) = a(i+1)
        a(i+1) = m
      End If
    Next
  WEnd
  'add to list 
  For i = 0 To UBound(a)
    drp.AddItem(a(i))
    If a(i) = nam Then
      drp.ItemIndex = i+1
    End If
  Next
End Sub

Sub AddPlaylistsRec(dic,nam)
  Dim i : i = 0
  Dim list : Set list = SDB.PlaylistByTitle(nam)
  If Not (list Is Nothing) Then
    If Len(nam) > 0 Then
      dic.Item(nam) = nam
    End If
    Dim kids : Set kids = list.ChildPlaylists
    For i = 0 To kids.Count-1
      Call AddPlaylistsRec(dic,kids.Item(i).Title)
    Next
  End If
End Sub

Sub SaveSheet(Sheet)
  Dim ini : Set ini = SDB.IniFile
  
  ini.StringValue("SimilarArtists","Name") = Sheet.Common.ChildControl("SAName").Text
  ini.IntValue("SimilarArtists","Limit") = Sheet.Common.ChildControl("SALimit").Value
  ini.IntValue("SimilarArtists","TPA") = Sheet.Common.ChildControl("SATPA").Value
  ini.IntValue("SimilarArtists","TPL") = Sheet.Common.ChildControl("SATPL").Value
  ini.BoolValue("SimilarArtists","Confirm") = Sheet.Common.ChildControl("SAConfirm").Checked
  ini.IntValue("SimilarArtists","Toolbar") = Sheet.Common.ChildControl("SAToolbar").ItemIndex
  ini.BoolValue("SimilarArtists","Sort") = Sheet.Common.ChildControl("SASort").Checked
  ini.StringValue("SimilarArtists","Parent") = Sheet.Common.ChildControl("SAParent").Text
  ini.StringValue("SimilarArtists","Black") = Sheet.Common.ChildControl("SABlack").Text
  ini.BoolValue("SimilarArtists","Random") = Sheet.Common.ChildControl("SARandom").Checked
  ini.BoolValue("SimilarArtists","Seed") = Sheet.Common.ChildControl("SASeed").Checked
  ini.BoolValue("SimilarArtists","Seed2") = Sheet.Common.ChildControl("SASeed2").Checked
  ini.BoolValue("SimilarArtists","Best") = Sheet.Common.ChildControl("SABest").Checked
  ini.BoolValue("SimilarArtists","Rank") = Sheet.Common.ChildControl("SARank").Checked
  ini.IntValue("SimilarArtists","Rating") = Sheet.Common.ChildControl("SARating").ItemIndex*10
  ini.BoolValue("SimilarArtists","Unknown") = Sheet.Common.ChildControl("SAUnknown").Checked
  ini.StringValue("SimilarArtists","Genre") = Sheet.Common.ChildControl("SAGenre").Text
  ini.IntValue("SimilarArtists","Overwrite") = Sheet.Common.ChildControl("SAOverwrite").ItemIndex
  ini.BoolValue("SimilarArtists","Enqueue") = Sheet.Common.ChildControl("SAEnqueue").Checked
  ini.IntValue("SimilarArtists","Navigate") = Sheet.Common.ChildControl("SANavigate").ItemIndex
  ini.BoolValue("SimilarArtists","OnPlay") = Sheet.Common.ChildControl("SAOnPlay").Checked
  ini.BoolValue("SimilarArtists","ClearNP") = Sheet.Common.ChildControl("SAClearNP").Checked
  ini.StringValue("SimilarArtists","Exclude") = Sheet.Common.ChildControl("SAExclude").Text
  ini.BoolValue("SimilarArtists","Ignore") = Sheet.Common.ChildControl("SAIgnore").Checked
  
  If ini.BoolValue("SimilarArtists","OnPlay") Then
    Call Event_OnPlay
  End If  
  
  Dim but : Set but = SDB.Objects("SAToolbarButton")
  Dim but2 : Set but2 = SDB.Objects("SAToolbarButton2")
  If Not (but Is Nothing) And Not (but2 Is Nothing) Then
    Select Case ini.IntValue("SimilarArtists","Toolbar")
      Case 0
        but.Visible = False      
        but2.Visible = False
      Case 1
        but.Visible = True
        but2.Visible = False        
      Case 2
        but.Visible = False
        but2.Visible = True
      Case 3
        but.Visible = True
        but2.Visible = True
    End Select
  End If    
End Sub

Function IsInList(lst,str)
  IsInList = False
  If str = "" Or lst = "" Then
    Exit Function
  End If
  Dim i : i = 0
  Dim tmp : tmp = UCase(str)
  Dim arr : arr = Split(lst,",")
  For i = 0 To UBound(arr)
    If UCase(arr(i)) = tmp Then 'full match
      IsInList = True
      Exit Function
    End If
  Next
End Function

Function IsInList2(lst,str)
  IsInList2 = False
  If str = "" Or lst = "" Then
    Exit Function
  End If
  Dim i : i = 0
  Dim tmp : tmp = UCase(str)
  Dim arr : arr = Split(lst,",")
  For i = 0 To UBound(arr)
    If InStr(tmp,UCase(arr(i))) Then 'partial match
      IsInList2 = True
      Exit Function
    End If
  Next
End Function

Sub RandomisePlaylist(p)
  Dim t : Set t = p.Tracks
  p.Clear
  While t.Count > 0
    Dim n : n = Int(t.Count*Rnd)
    Call p.AddTrack(t.Item(n))
    Call t.Delete(n)
  WEnd
End Sub

Sub EnqueuePlaylist(p,ign)
  Dim t : Set t = p.Tracks
  If t.Count > 0 Then
    If ign = 1 Then
      Dim i : i = 0
      For i = 0 To t.Count-1
        Dim trk : Set trk = t.Item(i)
        Call PlaylistAddTrack(trk,ign)
      Next
    Else
      Call SDB.Player.PlaylistAddTracks(t)
    End If  
  End If
End Sub

Sub NavigatePlaylist(p)
  On Error Resume Next    
  Set SDB.Objects("SimilarArtistsNode") = Nothing
  Dim node : Set node = SDB.MainTree.Node_Playlists
  If NavRec(p.Title,node) Then
    Dim n : Set n = SDB.Objects("SimilarArtistsNode")
    If Not (n Is Nothing) Then
      SDB.MainTree.CurrentNode = n
      n.Expanded = True  
    End If
  End If  
  Set SDB.Objects("SimilarArtistsNode") = Nothing
  On Error Goto 0
End Sub

Function NavRec(title,node)
  NavRec = False
  Dim exp : exp = node.Expanded
  node.Expanded = True
  If node.HasChildren = False Then 
    Exit Function   
  End If
  Dim kid : Set kid = SDB.MainTree.FirstChildNode(node)
  Dim boo : boo = True
  While (boo)
    If (Err.Number = 0) And Not (kid Is Nothing) Then    
      If kid.Caption = title Then
        Set SDB.Objects("SimilarArtistsNode") = kid
        NavRec = True      
        boo = False
      Else
        If NavRec(title,kid) Then
          NavRec = True
          boo = False
        Else
          Set kid = SDB.MainTree.NextSiblingNode(kid)
        End If
      End If
    Else
      Err.Clear
      boo = False
    End If
  WEnd
  node.Expanded = exp
End Function

Sub out(txt)
  Dim wsh : Set wsh = CreateObject("WScript.Shell")
  Dim fso : Set fso = CreateObject("Scripting.FileSystemObject")
  Dim loc : loc = wsh.ExpandEnvironmentStrings("%TEMP%")&"\SimilarArtists.log"
  Dim logf : Set logf = fso.OpenTextFile(loc,8,True)
  logf.WriteLine(SDB.ToAscii(txt))
  logf.Close
End Sub

Sub Install()
  Dim inip : inip = SDB.ApplicationPath&"Scripts\Scripts.ini"
  Dim inif : Set inif = SDB.Tools.IniFileByPath(inip)
  If Not (inif Is Nothing) Then
    inif.StringValue("SimilarArtists","Filename") = "Auto\SimilarArtists.vbs"
    inif.StringValue("SimilarArtists","Procname") = "SimilarArtists"
    inif.StringValue("SimilarArtists","Order") = "50"
    inif.StringValue("SimilarArtists","DisplayName") = "Similar Artists"
    inif.StringValue("SimilarArtists","Description") = "Creates a playlist of similar artists"
    inif.StringValue("SimilarArtists","Language") = "VBScript"
    inif.StringValue("SimilarArtists","ScriptType") = "0"
    SDB.RefreshScriptItems
  End If
  Call onStartup()
End Sub

Function PlaylistAddTrackById(sid,ign)
  PlaylistAddTrackById = False
  Dim p : Set p = SDB.Player
  If ign = 1 Then
    Dim t : Set t = p.CurrentSongList
    If t.Count > 0 Then
      Dim i : i = 0
      For i = 0 To t.Count-1
        If t.Item(i).ID = sid Then
          Exit Function
        End If
      Next
    End If
  End If
  Dim iter : Set iter = SDB.Database.QuerySongs("AND Songs.ID="&sid)
  Do While Not iter.EOF
    PlaylistAddTrackById = True
    Call p.PlaylistAddTrack(iter.Item)
    Call SDB.ProcessMessages
    iter.Next
  Loop
  Set iter = Nothing
End Function

Function PlaylistAddTrack(trk,ign)
  PlaylistAddTrack = False
  Dim p : Set p = SDB.Player
  If ign = 1 Then
    Dim t : Set t = p.CurrentSongList
    If t.Count > 0 Then
      Dim i : i = 0
      For i = 0 To t.Count-1
        If t.Item(i).ID = trk.ID Then
          Exit Function
        End If
      Next
    End If
  End If
  PlaylistAddTrack = True
  Call p.PlaylistAddTrack(trk)
  Call SDB.ProcessMessages
End Function

Sub RandomiseNowPlaying()
  Dim p : Set p = SDB.Player
  Dim t : Set t = p.CurrentSongList
  Call p.PlaylistClear
  While t.Count > 0
    Dim n : n = Int(t.Count*Rnd)
    Call p.PlaylistAddTrack(t.Item(n))
    Call t.Delete(n)
    Call SDB.ProcessMessages 
  WEnd
End Sub