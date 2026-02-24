import { createClient } from 'npm:@supabase/supabase-js@2'

// Helper: Sanitize title for safe filename usage
function sanitizeTitle(title: string): string {
  return title
    .replace(/[&]/g, '_')           // Ersetze & durch _
    .replace(/[äÄ]/g, 'ae')         // Deutsche Umlaute
    .replace(/[öÖ]/g, 'oe')
    .replace(/[üÜ]/g, 'ue')
    .replace(/[ß]/g, 'ss')
    .replace(/[^a-zA-Z0-9\s\-_]/g, '') // Nur sichere Zeichen behalten
    .replace(/\s+/g, '_')           // Leerzeichen zu _
    .substring(0, 50)               // Max 50 Zeichen
    .trim()
}

// Dynamic CORS headers based on origin
function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const allowedOrigins = [
    Deno.env.get('APP_URL') || '',
    'https://notetaker2pro.com',
    'https://www.notetaker2pro.com',
    'http://localhost:5173',
    'http://localhost:8080',
    'http://localhost:3000',
  ].filter(Boolean);
  
  // Check if origin matches allowed origins or is a Lovable preview domain
  const isLovablePreview = origin.endsWith('.lovableproject.com') || origin.endsWith('.lovable.app');
  const allowOrigin = allowedOrigins.includes(origin) || isLovablePreview 
    ? origin 
    : '*';
  
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
  };
}

// Helper: Authenticate user from request (supports user JWT and service role key)
async function authenticateUser(req: Request): Promise<{ user: { id: string } | null; isServiceRole?: boolean; error?: string }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return { user: null, error: 'Authorization header required' };
  }

  const token = authHeader.replace('Bearer ', '');
  
  // Check if the token is the service role key (used by auto-sync cron job)
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (serviceRoleKey && token === serviceRoleKey) {
    console.log('[Auth] Service role key authentication - internal cron call');
    return { user: { id: 'service-role' }, isServiceRole: true };
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  
  if (authError || !user) {
    console.error('[Auth] Authentication failed:', authError?.message);
    return { user: null, error: 'Invalid or expired token' };
  }

  return { user: { id: user.id } };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Authenticate user
    const { user, isServiceRole, error: authError } = await authenticateUser(req);
    if (!user) {
      return new Response(
        JSON.stringify({ error: authError || 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Auth] Authenticated user: ${user.id}`);

    // 2. Supabase Client & Secrets laden
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    const recallApiKey = Deno.env.get('RECALL_API_KEY')
    const recallApiUrl = Deno.env.get('RECALL_API_URL') || 'https://eu-central-1.recall.ai/api/v1/bot'

    // 3. ID und force_resync aus dem Request holen (vom Frontend gesendet)
    const { id, force_resync = false } = await req.json()
    console.log(`Sync-Recording aufgerufen für ID: ${id}, Force Resync: ${force_resync}`)

    // 4. Datenbank-Eintrag holen, um die recall_bot_id zu bekommen
    const { data: recording, error: dbError } = await supabase
      .from('recordings')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (dbError) {
      console.error('DB Fehler:', dbError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch recording' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!recording) {
      return new Response(
        JSON.stringify({ error: 'Recording not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Verify ownership - service role bypasses, admins can access all
    if (!isServiceRole && recording.user_id && recording.user_id !== user.id) {
      // Check if user is admin
      const { data: adminCheck } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();
      
      if (!adminCheck) {
        console.error(`[Auth] User ${user.id} tried to access recording owned by ${recording.user_id}`);
        return new Response(
          JSON.stringify({ error: 'Access denied' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log(`[Auth] Admin ${user.id} accessing recording owned by ${recording.user_id}`);
    }

    if (!recording.recall_bot_id) {
      return new Response(
        JSON.stringify({ error: 'No bot associated with this recording' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Prüfe Status für Bot: ${recording.recall_bot_id}`)

    // 6. Status bei Recall.ai abfragen
    const response = await fetch(`${recallApiUrl}/${recording.recall_bot_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Token ${recallApiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      console.error('Recall API Fehler:', response.status, response.statusText)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch recording status' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const botData = await response.json()
    
    // Status aus status_changes Array extrahieren (letzter Eintrag)
    const latestStatus = botData.status_changes?.[botData.status_changes.length - 1]?.code || 'pending'
    const latestSubCode = botData.status_changes?.[botData.status_changes.length - 1]?.sub_code || null
    console.log(`Bot Status (raw): ${latestStatus}, SubCode: ${latestSubCode}`)
    
    // Status mapping - erweitert um waiting_room Status
    const statusMap: Record<string, string> = {
      "ready": "pending",
      "joining_call": "joining",
      "in_waiting_room": "waiting_room", // Eigener Status für Wartebereich
      "in_call_not_recording": "joining",
      "in_call_recording": "recording",
      "recording_permission_allowed": "recording",
      "recording_permission_denied": "error",
      "call_ended": "processing",
      "recording_done": "processing",
      "media_expired": "error",
      "analysis_done": "done",
      "done": "done",
      "fatal": "error",
    }
    
    let status = statusMap[latestStatus] || latestStatus
    
    // Spezielle Fehlerbehandlung für bot_kicked aus Wartebereich
    if (latestSubCode === 'bot_kicked_from_waiting_room') {
      status = 'waiting_room_rejected'
      console.log('Bot wurde aus dem Wartebereich entfernt/abgelehnt')
    } else if (latestSubCode === 'waiting_room_timeout') {
      status = 'waiting_room_timeout'
      console.log('Wartebereich-Timeout erreicht')
    }
    
    console.log(`Bot Status (mapped, vor Korrektur): ${status}`)
    
    // === STATUS-KORREKTUR: Recordings haben Vorrang vor Fehler-Status ===
    // Wenn der letzte Status ein Fehler ist, aber der Bot tatsächlich im Meeting war
    // oder Recordings existieren, wird der Status korrigiert.
    if (['waiting_room_rejected', 'waiting_room_timeout', 'error'].includes(status)) {
      const hasRecordings = botData.recordings?.length > 0
      const statusHistory = botData.status_changes || []
      const successCodes = ['in_call_recording', 'in_call_not_recording', 'recording_done', 'call_ended', 'done', 'analysis_done']
      const wasInCall = statusHistory.some(
        (s: { code?: string }) => successCodes.includes(s.code || '')
      )
      
      if (hasRecordings || wasInCall) {
        console.log(`STATUS-KORREKTUR: ${status} -> done (Recordings vorhanden: ${hasRecordings}, War im Call: ${wasInCall})`)
        console.log(`Status-Historie: ${statusHistory.map((s: { code?: string }) => s.code).join(' -> ')}`)
        status = 'done'
      } else {
        // Bot kam nie über den Warteraum hinaus - Status bleibt als Fehler
        console.log(`Kein Recording und nie im Call - Fehler-Status '${status}' bleibt bestehen`)
        console.log(`Status-Historie: ${statusHistory.map((s: { code?: string }) => s.code).join(' -> ')}`)
      }
    }
    
    console.log(`Bot Status (final): ${status}`)

    // 7. Daten vorbereiten für Update
    const updates: Record<string, unknown> = { status: status }

    // 7.0 Meeting-Titel aus Recall.ai Plattform-Metadaten extrahieren (bei manuellem Beitritt)
    try {
      const metadataTitle = botData.recordings?.[0]?.media_shortcuts?.meeting_metadata?.data?.title;
      if (metadataTitle && metadataTitle.trim()) {
        const currentTitle = recording.title?.trim().toLowerCase() || '';
        const genericTerms = ['meeting', 'besprechung', 'untitled', 'aufnahme', 'recording', 'call', 'notetaker', 'bot'];
        const isGenericMeta = !currentTitle || 
          genericTerms.some(t => currentTitle === t) ||
          genericTerms.some(t => currentTitle.startsWith(t) && /^[\s\d\-_.:]*$/.test(currentTitle.slice(t.length))) ||
          /^[0-9a-f]{8,}/i.test(currentTitle) ||
          currentTitle.length <= 3;
        
        if (isGenericMeta) {
          updates.title = metadataTitle.trim();
          console.log('Meeting-Titel aus Plattform-Metadata uebernommen:', metadataTitle);
        } else {
          console.log('Behalte bestehenden Titel (nicht generisch):', recording.title);
        }
      } else {
        console.log('Keine Meeting-Metadata von Recall.ai verfuegbar');
      }
    } catch (metaError) {
      console.error('Fehler beim Auslesen der Meeting-Metadata:', metaError);
    }

    // 7a. Kalender-Teilnehmer von Recall.ai abrufen und speichern
    try {
      const meetingsResponse = await fetch(`https://eu-central-1.recall.ai/api/v1/calendar/meetings/?bot_id=${recording.recall_bot_id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Token ${recallApiKey}`,
          'Content-Type': 'application/json',
        },
      })
      
      if (meetingsResponse.ok) {
        const meetingsData = await meetingsResponse.json()
        const meetings = Array.isArray(meetingsData) ? meetingsData : meetingsData.results || []
        
        if (meetings.length > 0) {
          const calendarMeeting = meetings[0]
          
          // Meeting-Titel aus Kalender übernehmen (wenn generisch oder leer)
          if (calendarMeeting.title) {
            const currentTitle = recording.title?.trim().toLowerCase() || '';
            const genericTerms = ['meeting', 'besprechung', 'untitled', 'aufnahme', 'recording', 'call', 'notetaker', 'bot'];
            const isGeneric = !currentTitle || 
              genericTerms.some(t => currentTitle === t) ||
              genericTerms.some(t => currentTitle.startsWith(t) && /^[\s\d\-_.:]*$/.test(currentTitle.slice(t.length))) ||
              /^[0-9a-f]{8,}/i.test(currentTitle) ||
              currentTitle.length <= 3;
            
            // Kalender-Titel auch nur setzen wenn er selbst nicht generisch ist
            const calTitle = calendarMeeting.title.trim().toLowerCase();
            const calIsGeneric = genericTerms.some(t => calTitle === t);
            
            if (isGeneric && !calIsGeneric) {
              updates.title = calendarMeeting.title;
              console.log('Kalender-Titel übernommen (ersetze generischen Titel):', calendarMeeting.title);
            }
          }

          const attendees = calendarMeeting.meeting_attendees || calendarMeeting.attendees || []
          
          if (attendees.length > 0) {
            // Speichere Teilnehmer mit Name und E-Mail
            const calendarAttendees = attendees.map((a: { name?: string; email?: string; display_name?: string }) => ({
              name: a.name || a.display_name || '',
              email: a.email || ''
            })).filter((a: { name: string }) => a.name.trim() !== '')
            
            if (calendarAttendees.length > 0) {
              updates.calendar_attendees = calendarAttendees
              console.log('Kalender-Teilnehmer gespeichert:', JSON.stringify(calendarAttendees, null, 2))
            }
          }
        }
      } else {
        console.log('Kalender-Meetings konnten nicht abgerufen werden:', meetingsResponse.status)
      }
    } catch (calendarError) {
      console.error('Fehler beim Abrufen der Kalender-Teilnehmer:', calendarError)
    }

    // Wenn der Bot fertig ist ('done') ODER force_resync angefordert wurde, holen wir die Video- und Transkript-URLs sowie Teilnehmer
    if (status === 'done' || force_resync) {
      console.log('Bot ist fertig, extrahiere Media-URLs und Teilnehmer...')
      console.log('Recordings Array:', JSON.stringify(botData.recordings, null, 2))
      
      // Video-URL aus verschachtelter Struktur extrahieren
      const videoUrl = botData.recordings?.[0]?.media_shortcuts?.video_mixed?.data?.download_url
      if (videoUrl) {
        updates.video_url = videoUrl
        console.log('Video-URL gefunden:', videoUrl)
      } else {
        console.log('Keine Video-URL in media_shortcuts gefunden')
      }
      
      // Meeting-Dauer aus started_at/completed_at berechnen (für Kontingent-Tracking)
      if (botData.recordings?.[0]) {
        const recData = botData.recordings[0]
        const startedAt = recData.started_at
        const completedAt = recData.completed_at
        
        if (startedAt && completedAt) {
          const startTime = new Date(startedAt).getTime()
          const endTime = new Date(completedAt).getTime()
          const durationSeconds = Math.round((endTime - startTime) / 1000)
          
          if (durationSeconds > 0) {
            updates.duration = durationSeconds
            console.log(`Meeting-Dauer berechnet: ${durationSeconds}s (${Math.round(durationSeconds / 60)}min)`)
          }
        } else {
          console.log('Keine Zeitstempel für Duration-Berechnung verfügbar:', { startedAt, completedAt })
        }
      }
      
      // Teilnehmer von Recall.ai abrufen - verbesserte Logik für MS Teams
      let participantMap: Record<string, string> = {}
      let participantsList: { id: string; name: string }[] = []
      
      try {
        // meeting_participants enthält die echten Namen (besonders wichtig für Teams)
        console.log('Hole Meeting-Teilnehmer von Bot-Endpoint...')
        console.log('Bot meeting_participants (raw):', JSON.stringify(botData.meeting_participants, null, 2))
        
        // Extrahiere Teilnehmer mit echten Namen aus botData (bereits geladen)
        if (botData.meeting_participants && Array.isArray(botData.meeting_participants)) {
          botData.meeting_participants.forEach((p: { id?: number; name?: string; platform_user_id?: string; identifier?: string }, index: number) => {
            // Nutze verschiedene ID-Formate die Recall.ai zurückgeben kann
            const numericId = p.id !== undefined ? String(p.id) : null
            const platformId = p.platform_user_id || null
            const identifier = p.identifier || null
            
            // Verwende den echten Namen, falls vorhanden
            const name = p.name && p.name.trim() !== '' ? p.name : null
            
            if (name) {
              // Speichere unter allen verfügbaren IDs
              if (numericId) {
                participantMap[numericId] = name
                console.log(`Teilnehmer gemappt (numericId): ${numericId} -> "${name}"`)
              }
              if (platformId) {
                participantMap[platformId] = name
                console.log(`Teilnehmer gemappt (platformId): ${platformId} -> "${name}"`)
              }
              if (identifier) {
                participantMap[identifier] = name
                console.log(`Teilnehmer gemappt (identifier): ${identifier} -> "${name}"`)
              }
              // Auch Index-basiert für Fallback
              participantMap[String(index)] = name
              
              participantsList.push({ 
                id: numericId || platformId || String(index), 
                name 
              })
            }
          })
        }
        
        // Zusätzlich speaker_timeline holen um Speaker-IDs zu Namen zu mappen
        console.log('Hole Speaker Timeline...')
        const speakerTimelineResponse = await fetch(`${recallApiUrl}/${recording.recall_bot_id}/speaker_timeline`, {
          method: 'GET',
          headers: {
            'Authorization': `Token ${recallApiKey}`,
            'Content-Type': 'application/json',
          },
        })
        
        if (speakerTimelineResponse.ok) {
          const speakerTimeline = await speakerTimelineResponse.json()
          console.log('Speaker Timeline Länge:', Array.isArray(speakerTimeline) ? speakerTimeline.length : 'N/A')
          console.log('Speaker Timeline Sample:', JSON.stringify(speakerTimeline?.slice?.(0, 5), null, 2))
          
          // Ergänze Mapping mit Daten aus speaker_timeline
          // WICHTIG: Recall.ai nutzt "participant" statt "user" im Transkript-Format!
          if (Array.isArray(speakerTimeline)) {
            speakerTimeline.forEach((entry: { 
              participant?: { name?: string; id?: number; platform_user_id?: string; identifier?: string };
              user?: { name?: string; id?: number; platform_user_id?: string; identifier?: string };
            }) => {
              // Prüfe zuerst participant (aktuelles Recall.ai Format), dann user (Legacy)
              const source = entry.participant || entry.user
              if (source) {
                const speakerId = source.id !== undefined ? String(source.id) : null
                const platformId = source.platform_user_id || null
                const identifier = source.identifier || null
                const name = source.name && source.name.trim() !== '' ? source.name : null
                
                // Bot/Notetaker-Filter
                const isBot = name && ['notetaker', 'bot', 'recording', 'assistant'].some(
                  pattern => name.toLowerCase().includes(pattern)
                )
                
                if (name && !isBot) {
                  // Speichere unter allen IDs wenn wir noch keinen Namen haben
                  if (speakerId && (!participantMap[speakerId] || participantMap[speakerId].startsWith('Teilnehmer ') || participantMap[speakerId].startsWith('Sprecher '))) {
                    participantMap[speakerId] = name
                    console.log(`Speaker Timeline Update (speakerId): ${speakerId} -> "${name}"`)
                  }
                  if (platformId && (!participantMap[platformId] || participantMap[platformId].startsWith('Teilnehmer ') || participantMap[platformId].startsWith('Sprecher '))) {
                    participantMap[platformId] = name
                    console.log(`Speaker Timeline Update (platformId): ${platformId} -> "${name}"`)
                  }
                  if (identifier && (!participantMap[identifier] || participantMap[identifier].startsWith('Teilnehmer ') || participantMap[identifier].startsWith('Sprecher '))) {
                    participantMap[identifier] = name
                    console.log(`Speaker Timeline Update (identifier): ${identifier} -> "${name}"`)
                  }
                  
                  // Aktualisiere oder füge zur Liste hinzu
                  const existingIndex = participantsList.findIndex(p => p.id === (speakerId || platformId))
                  if (existingIndex >= 0) {
                    participantsList[existingIndex].name = name
                  } else if (speakerId || platformId) {
                    participantsList.push({ id: speakerId || platformId || '', name })
                  }
                }
              }
            })
          }
        } else {
          console.error('Speaker Timeline Abruf fehlgeschlagen:', speakerTimelineResponse.status)
        }
        
        console.log('Finale Teilnehmer-Map:', JSON.stringify(participantMap, null, 2))
        console.log('Finale Teilnehmer-Liste:', JSON.stringify(participantsList, null, 2))
        
      } catch (participantError) {
        console.error('Teilnehmer-Abruf fehlgeschlagen:', participantError)
      }
      
      // Teilnehmer in DB speichern
      if (participantsList.length > 0) {
        updates.participants = participantsList
      }
      
      // Transkript-URL aus verschachtelter Struktur extrahieren
      const transcriptUrl = botData.recordings?.[0]?.media_shortcuts?.transcript?.data?.download_url
      console.log('Transkript-URL:', transcriptUrl)
      
      if (transcriptUrl) {
        try {
          // Transkript von der Download-URL abrufen
          const transcriptResponse = await fetch(transcriptUrl)
          
          if (transcriptResponse.ok) {
            const transcriptData = await transcriptResponse.json()
            console.log('Transkript abgerufen, Typ:', typeof transcriptData, 'Länge:', Array.isArray(transcriptData) ? transcriptData.length : 'N/A')
            
            // Transkript formatieren mit Sprecher-Namen - verbesserte Logik mit E-Mail/Platform-ID Fallback
            if (Array.isArray(transcriptData) && transcriptData.length > 0) {
              let speakerCounter = 1
              const unknownSpeakerMap: Record<string, string> = {}
              
              console.log('Transkript Entry Sample:', JSON.stringify(transcriptData[0], null, 2))
              
              // Hilfsfunktion: E-Mail zu lesbarem Namen formatieren
              const formatEmailToName = (email: string): string => {
                if (!email || !email.includes('@')) return email
                const localPart = email.split('@')[0]
                // Ersetze Punkte und Unterstriche durch Leerzeichen, Großbuchstaben am Anfang
                return localPart
                  .replace(/[._-]/g, ' ')
                  .split(' ')
                  .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                  .join(' ')
              }
              
              // Hilfsfunktion: Besten verfügbaren Namen ermitteln
              // WICHTIG: Recall.ai nutzt "participant" im aktuellen Format, nicht "user"!
              const getBestSpeakerName = (entry: { 
                speaker?: string; 
                speaker_id?: number; 
                participant?: { id?: number; name?: string; platform_user_id?: string; identifier?: string };
                user?: { id?: number; name?: string; platform_user_id?: string; identifier?: string };
              }): string => {
                // Wähle die richtige Quelle: participant (neu) oder user (legacy)
                const source = entry.participant || entry.user
                
                // Priorität 1: Name direkt im Entry
                if (source?.name && source.name.trim() !== '' && source.name !== 'unknown') {
                  // Bot/Notetaker-Filter
                  const isBot = ['notetaker', 'bot', 'recording', 'assistant'].some(
                    pattern => source.name!.toLowerCase().includes(pattern)
                  )
                  if (!isBot) {
                    return source.name
                  }
                }
                
                // Priorität 2: ID zum Nachschlagen in participantMap
                if (source?.id !== undefined) {
                  const id = String(source.id)
                  if (participantMap[id] && !participantMap[id].startsWith('Sprecher ')) {
                    return participantMap[id]
                  }
                }
                
                // Priorität 3: platform_user_id (bei Teams oft die E-Mail-Adresse)
                if (source?.platform_user_id && source.platform_user_id.trim() !== '') {
                  const platformId = source.platform_user_id
                  // Schaue erst in der Map, ob wir einen besseren Namen haben
                  if (participantMap[platformId] && !participantMap[platformId].startsWith('Sprecher ')) {
                    return participantMap[platformId]
                  }
                  // Nutze die E-Mail/Platform-ID direkt (formatiere wenn E-Mail)
                  if (platformId.includes('@')) {
                    return formatEmailToName(platformId)
                  }
                  return platformId
                }
                
                // Priorität 4: identifier (alternative ID)
                if (source?.identifier && source.identifier.trim() !== '') {
                  const identifier = source.identifier
                  if (participantMap[identifier] && !participantMap[identifier].startsWith('Sprecher ')) {
                    return participantMap[identifier]
                  }
                  // Falls es eine E-Mail ist, formatieren
                  if (identifier.includes('@')) {
                    return formatEmailToName(identifier)
                  }
                  return identifier
                }
                
                // Priorität 5: speaker_id in participantMap nachschlagen
                if (entry.speaker_id !== undefined) {
                  const speakerId = String(entry.speaker_id)
                  if (participantMap[speakerId] && !participantMap[speakerId].startsWith('Sprecher ')) {
                    return participantMap[speakerId]
                  }
                }
                
                // Priorität 6: speaker String nutzen
                if (entry.speaker && entry.speaker !== 'Unbekannt' && entry.speaker !== '' && entry.speaker !== 'unknown') {
                  if (participantMap[entry.speaker] && !participantMap[entry.speaker].startsWith('Sprecher ')) {
                    return participantMap[entry.speaker]
                  }
                  return entry.speaker
                }
                
                // Fallback: Konsistente Nummerierung für unbekannte Sprecher
                const speakerKey = source?.id !== undefined ? String(source.id) : 
                                   entry.speaker_id !== undefined ? String(entry.speaker_id) : 
                                   entry.speaker || 'unknown'
                
                if (!unknownSpeakerMap[speakerKey]) {
                  unknownSpeakerMap[speakerKey] = `Sprecher ${speakerCounter++}`
                }
                return unknownSpeakerMap[speakerKey]
              }
              
              // Sammle auch alle echten Teilnehmer aus dem Transkript für participantsList
              const transcriptParticipants = new Map<string, { id: string; name: string }>()
              
              // Hilfsfunktion: Prüft ob Text mit Satzzeichen endet
              const endsWithPunctuation = (text: string): boolean => {
                return /[.!?]$/.test(text.trim());
              };
              
              // Hilfsfunktion: Anzahl der Wörter zählen
              const countWords = (text: string): number => {
                return text.trim().split(/\s+/).filter(w => w.length > 0).length;
              };
              
              // Erst alle Segmente sammeln mit Zeitstempeln
              interface TranscriptSegment {
                speaker: string;
                text: string;
                startTime?: number;
                endTime?: number;
                participantId?: string;
              }
              
              const rawSegments: TranscriptSegment[] = transcriptData
                .map((entry: { 
                  speaker?: string; 
                  speaker_id?: number; 
                  participant?: { id?: number; name?: string; platform_user_id?: string; identifier?: string };
                  user?: { id?: number; name?: string; platform_user_id?: string; identifier?: string };
                  words?: { text?: string; start_timestamp?: { relative?: number }; end_timestamp?: { relative?: number } }[]
                }) => {
                  const speaker = getBestSpeakerName(entry)
                  const text = entry.words?.map(w => w.text).join(' ') || ''
                  
                  // Zeitstempel aus words extrahieren (falls vorhanden)
                  const startTime = entry.words?.[0]?.start_timestamp?.relative;
                  const endTime = entry.words?.[entry.words.length - 1]?.end_timestamp?.relative;
                  
                  // Sammle Teilnehmer wenn es ein echter Name ist (kein Fallback)
                  const source = entry.participant || entry.user
                  if (source?.name && speaker === source.name) {
                    const isBot = ['notetaker', 'bot', 'recording', 'assistant'].some(
                      pattern => speaker.toLowerCase().includes(pattern)
                    )
                    if (!isBot) {
                      const id = String(source.id || source.platform_user_id || '')
                      transcriptParticipants.set(speaker, { id, name: speaker })
                    }
                  }
                  
                  return { 
                    speaker, 
                    text, 
                    startTime,
                    endTime,
                    participantId: String(source?.id || source?.platform_user_id || '')
                  }
                })
                .filter((seg: TranscriptSegment) => seg.text.trim().length > 0)
              
              // Aufeinanderfolgende Segmente desselben Sprechers zusammenführen
              const mergedSegments: TranscriptSegment[] = []
              
              for (let i = 0; i < rawSegments.length; i++) {
                const current = rawSegments[i]
                
                if (mergedSegments.length === 0) {
                  mergedSegments.push({ ...current })
                  continue
                }
                
                const last = mergedSegments[mergedSegments.length - 1]
                const currentWordCount = countWords(current.text)
                
                // Zeitlücke berechnen (falls Zeitstempel vorhanden)
                const timeGap = (last.endTime !== undefined && current.startTime !== undefined)
                  ? current.startTime - last.endTime
                  : 0
                
                // Zusammenführen wenn:
                // 1. Gleicher Sprecher
                // 2. Zeitlücke < 2 Sekunden ODER keine Zeitstempel verfügbar
                // 3. Vorheriges Segment endet nicht mit Satzzeichen ODER aktuelles ist sehr kurz
                const sameSpeaker = current.speaker === last.speaker
                const smallTimeGap = timeGap < 2000 || (last.endTime === undefined || current.startTime === undefined)
                const continuousSpeech = !endsWithPunctuation(last.text) || currentWordCount < 3
                
                if (sameSpeaker && smallTimeGap && continuousSpeech) {
                  // Zusammenführen
                  last.text = last.text.trim() + ' ' + current.text.trim()
                  last.endTime = current.endTime
                  console.log(`Segmente zusammengeführt für "${current.speaker}": +${currentWordCount} Wörter`)
                } else {
                  mergedSegments.push({ ...current })
                }
              }
              
              console.log(`Transkript: ${rawSegments.length} Roh-Segmente -> ${mergedSegments.length} zusammengeführte Segmente`)
              
              // Hilfsfunktion: Deutsche Umlaute normalisieren (oe->ö, ae->ä, ue->ü)
              const normalizeGermanUmlauts = (text: string): string => {
                return text
                  .replace(/([^aeiouAEIOU])oe/g, '$1ö')
                  .replace(/([^aeiouAEIOU])ae/g, '$1ä')
                  .replace(/([^aeiouAEIOU])ue/g, '$1ü')
                  .replace(/^Oe/g, 'Ö')
                  .replace(/^Ae/g, 'Ä')
                  .replace(/^Ue/g, 'Ü');
              };
              
              // Hilfsfunktion: Namen aus "Nachname, Vorname (X.)" Format normalisieren
              const normalizeGermanName = (name: string): string => {
                if (!name || typeof name !== 'string') return name;
                let normalized = name.trim();
                
                // Prüfe auf "Nachname, Vorname (Kürzel)" Format
                const commaMatch = normalized.match(/^([^,]+),\s*([^(]+)(?:\s*\([^)]+\))?$/);
                if (commaMatch) {
                  const lastName = commaMatch[1].trim();
                  const firstName = commaMatch[2].trim();
                  normalized = `${firstName} ${lastName}`;
                }
                
                // Umlaut-Normalisierung
                return normalizeGermanUmlauts(normalized);
              };
              
              // Normalisiere Sprechernamen im Transkript
              const normalizedSegments = mergedSegments.map(seg => ({
                ...seg,
                speaker: normalizeGermanName(seg.speaker)
              }));
              
              const formattedTranscript = normalizedSegments
                .map(seg => `${seg.speaker}: ${seg.text}`)
                .join('\n\n')
              
              // Ergänze participantsList mit Sprechern aus dem Transkript (normalisiert)
              normalizedSegments.forEach((seg) => {
                const normalizedName = seg.speaker;
                const isBot = ['notetaker', 'bot', 'recording', 'assistant', 'meetingbot'].some(
                  pattern => normalizedName.toLowerCase().includes(pattern)
                );
                
                if (!isBot) {
                  const exists = participantsList.some(existing => 
                    normalizeGermanName(existing.name) === normalizedName
                  );
                  if (!exists) {
                    participantsList.push({ id: seg.participantId || String(participantsList.length), name: normalizedName });
                    console.log(`Teilnehmer aus Transkript hinzugefügt (normalisiert): "${normalizedName}"`);
                  }
                }
              });
              
              // FALLBACK: Wenn participantsList immer noch leer ist, extrahiere alle Sprecher
              if (participantsList.length === 0) {
                console.log('participantsList leer - extrahiere alle Sprecher aus Transkript als Fallback');
                const uniqueSpeakers = new Set<string>();
                normalizedSegments.forEach(seg => {
                  const isBot = ['notetaker', 'bot', 'recording', 'assistant', 'meetingbot'].some(
                    pattern => seg.speaker.toLowerCase().includes(pattern)
                  );
                  if (!isBot && seg.speaker) {
                    uniqueSpeakers.add(seg.speaker);
                  }
                });
                
                participantsList = Array.from(uniqueSpeakers).map((name, idx) => ({
                  id: String(idx),
                  name
                }));
                console.log(`Fallback: ${participantsList.length} Teilnehmer aus Transkript extrahiert`);
              }
              
              // Add user information header to transcript for backend visibility
              const ownerId = recording.user_id || user.id;
              let ownerEmail = 'Unbekannt';
              try {
                const { data: userData } = await supabase.auth.admin.getUserById(ownerId);
                ownerEmail = userData?.user?.email || 'Unbekannt';
              } catch (e) {
                console.log('Could not fetch owner email:', e);
              }
              
              const transcriptHeader = `[Meeting-Info]
User-ID: ${ownerId}
User-Email: ${ownerEmail}
Recording-ID: ${id}
Erstellt: ${new Date(recording.created_at || Date.now()).toISOString()}
---

`;
              updates.transcript_text = transcriptHeader + formattedTranscript
              console.log('Transkript formatiert mit User-Header, Länge:', (transcriptHeader + formattedTranscript).length, 'Zeichen')
            }
          } else {
            console.error('Transkript-Download fehlgeschlagen:', transcriptResponse.status, transcriptResponse.statusText)
          }
        } catch (transcriptError) {
          console.error('Transkript-Abruf fehlgeschlagen:', transcriptError)
        }
      } else {
        console.log('Keine Transkript-URL in media_shortcuts gefunden')
        
        // === AUTOMATISCHER RECALL-TRANSKRIPTIONS-FALLBACK ===
        // Wenn kein Transkript vorhanden und Bot hat Recordings, automatisch Async Transcription starten
        if (botData.recordings && botData.recordings.length > 0) {
          const recallRecordingId = botData.recordings[0].id
          console.log(`Kein Streaming-Transkript vorhanden. Starte automatische Recall Async Transcription für Recording: ${recallRecordingId}`)
          
          try {
            const autoTranscriptResponse = await fetch(
              `https://eu-central-1.recall.ai/api/v1/recording/${recallRecordingId}/create_transcript/`,
              {
                method: "POST",
                headers: {
                  Authorization: `Token ${recallApiKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  provider: {
                    recallai_async: {
                      language_code: "de",
                    },
                  },
                }),
              }
            )
            
            if (autoTranscriptResponse.ok) {
              const autoResult = await autoTranscriptResponse.json()
              console.log('Automatische Recall-Transkription erfolgreich gestartet:', JSON.stringify(autoResult))
              // Status auf "transcribing" setzen statt "done"
              updates.status = 'transcribing'
              console.log('Status auf "transcribing" gesetzt - nächster sync-recording-Aufruf holt fertiges Transkript ab')
            } else {
              const errText = await autoTranscriptResponse.text()
              console.error('Automatische Recall-Transkription fehlgeschlagen:', autoTranscriptResponse.status, errText)
              // Status bleibt "done", User kann manuell "Recall Transkript erstellen" nutzen
            }
          } catch (autoTranscriptError) {
            console.error('Fehler bei automatischer Recall-Transkription:', autoTranscriptError)
          }
        } else {
          console.log('Keine Recall Recordings vorhanden - kein automatischer Transkriptions-Fallback möglich')
        }
      }
      
      // 7b. Transkript als Backup-Datei in Storage speichern
      if (updates.transcript_text && typeof updates.transcript_text === 'string') {
        try {
          console.log('Speichere Transkript-Backup in Storage...')
          const userId = recording.user_id || user.id
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
          const fileName = `${userId}/${id}_${timestamp}.txt`
          
          // Transkript als Textdatei hochladen
          const transcriptBlob = new Blob([updates.transcript_text], { type: 'text/plain' })
          const transcriptArrayBuffer = await transcriptBlob.arrayBuffer()
          const transcriptUint8Array = new Uint8Array(transcriptArrayBuffer)
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('transcript-backups')
            .upload(fileName, transcriptUint8Array, {
              contentType: 'text/plain; charset=utf-8',
              upsert: true
            })
          
          if (uploadError) {
            console.error('Transkript-Backup Upload Fehler:', uploadError)
          } else {
            console.log('Transkript-Backup gespeichert:', uploadData?.path)
            
            // Permanente Storage-URL in transcript_url speichern
            const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
            const storagePath = `${supabaseUrl}/storage/v1/object/public/transcript-backups/${fileName}`
            updates.transcript_url = storagePath
            console.log('Transkript-URL gespeichert:', storagePath)
          }
        } catch (backupError) {
          console.error('Transkript-Backup fehlgeschlagen:', backupError)
        }
      }

      // 7c. Video als Backup in Storage speichern
      // Nutze immer In-Memory Download + supabase.storage.upload() (max 150 MB)
      // Das vermeidet das "Invalid Compact JWS" Problem beim raw fetch mit Bearer Token
      if (updates.video_url && typeof updates.video_url === 'string') {
        try {
          const maxMemorySize = 150 * 1024 * 1024 // 150 MB - Edge Function RAM Limit
          const userId = recording.user_id || user.id
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
          const videoFileName = `${userId}/${id}_video_${timestamp}.mp4`
          const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''

          // Direkt per GET herunterladen (HEAD schlaegt bei S3 pre-signed URLs fehl)
          console.log('Starte Video-Download fuer permanentes Backup...')
          const videoResponse = await fetch(updates.video_url as string)
          
          if (videoResponse.ok) {
            const videoBuffer = await videoResponse.arrayBuffer()
            const videoSize = videoBuffer.byteLength
            console.log(`Video heruntergeladen: ${Math.round(videoSize / 1024 / 1024)}MB`)
            
            if (videoSize <= maxMemorySize) {
              const videoUint8Array = new Uint8Array(videoBuffer)
              const { data: videoUploadData, error: videoUploadError } = await supabase.storage
                .from('transcript-backups')
                .upload(videoFileName, videoUint8Array, {
                  contentType: 'video/mp4',
                  upsert: true
                })
              if (videoUploadError) {
                console.error('Video-Backup Upload Fehler:', videoUploadError)
              } else {
                console.log('Video-Backup gespeichert:', videoUploadData?.path)
                updates.video_url = `${supabaseUrl}/storage/v1/object/authenticated/transcript-backups/${videoFileName}`
                console.log('Video-URL aktualisiert auf permanente Storage-URL')
              }
            } else {
              console.warn(`Video zu gross fuer In-Memory Upload: ${Math.round(videoSize / 1024 / 1024)}MB > ${Math.round(maxMemorySize / 1024 / 1024)}MB`)
            }
          } else {
            console.error('Video-Download fehlgeschlagen:', videoResponse.status)
          }
        } catch (videoBackupError) {
          console.error('Video-Backup fehlgeschlagen (nicht kritisch):', videoBackupError)
        }
      }
    }

    // 8. ZUERST: Datenbank aktualisieren (damit transcript_text in DB ist!)
    const { error: updateError } = await supabase
      .from('recordings')
      .update(updates)
      .eq('id', id)

    if (updateError) {
      console.error('Update Fehler:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to update recording' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Datenbank aktualisiert:', updates)

    // 9. DANN: Wenn fertig und Transkript vorhanden (oder force_resync), automatisch Analyse starten
    // WICHTIG: Muss NACH dem DB-Update sein, da analyze-transcript das Transkript aus der DB liest!
    const hasTranscript = updates.transcript_text || recording.transcript_text;
    if (status === 'done' && hasTranscript && (updates.transcript_text || force_resync)) {
      console.log('Starte automatische Transkript-Analyse...')
      try {
        const analyzeResponse = await fetch(`${supabaseUrl}/functions/v1/analyze-transcript`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ recording_id: id }),
        })
        
        if (analyzeResponse.ok) {
          console.log('Analyse erfolgreich gestartet')
        } else {
          console.error('Analyse-Start fehlgeschlagen:', await analyzeResponse.text())
        }
      } catch (analyzeError) {
        console.error('Fehler beim Starten der Analyse:', analyzeError)
      }
    }

    // 10. Export an externe Supabase-API senden (nach jedem abgeschlossenen Meeting)
    // Sendet Transkript als Plain-Text mit Metadaten-Header
    if (status === 'done' && (updates.transcript_text || recording.transcript_text)) {
      const exportUrl = Deno.env.get('TRANSCRIPT_EXPORT_URL')
      const exportSecret = Deno.env.get('TRANSCRIPT_EXPORT_SECRET')
      
      if (exportUrl && exportSecret) {
        console.log('Sende Transkript-TXT an externe Supabase-API...')
        try {
          const transcriptContent = updates.transcript_text || recording.transcript_text || ''
          const meetingTitle = recording.title || updates.title || 'Untitled Meeting'
          const meetingDate = new Date(recording.created_at || Date.now()).toLocaleString('de-DE', {
            dateStyle: 'full',
            timeStyle: 'short',
          })
          const durationMinutes = recording.duration ? Math.round(recording.duration / 60) : null
          
          // TXT-Datei mit Metadaten-Header formatieren
          const txtContent = `========================================
MEETING TRANSKRIPT
========================================
Titel: ${meetingTitle}
Datum: ${meetingDate}
Dauer: ${durationMinutes ? durationMinutes + ' Minuten' : 'Unbekannt'}
Recording ID: ${id}
User ID: ${recording.user_id || user.id}
========================================

${transcriptContent}`
          
          // Export-Payload mit TXT-Content und sanitiertem Titel
          const safeTitle = sanitizeTitle(meetingTitle)
          const exportPayload = {
            recording_id: id,
            user_id: recording.user_id || user.id,
            title: meetingTitle,        // Original-Titel für Anzeige
            safe_title: safeTitle,      // Sanitierter Titel für Dateiname
            transcript_txt: txtContent,
            created_at: recording.created_at,
            duration: recording.duration,
            // Optional: Zusätzliche Metadaten für DB-Speicherung
            metadata: {
              summary: recording.summary || updates.summary || null,
              key_points: recording.key_points || updates.key_points || [],
              action_items: recording.action_items || updates.action_items || [],
              participants: updates.participants || recording.participants || [],
              word_count: recording.word_count || null,
              video_url: updates.video_url || recording.video_url || null,
            }
          }
          
          const exportResponse = await fetch(exportUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-export-secret': exportSecret,
            },
            body: JSON.stringify(exportPayload),
          })
          
          if (exportResponse.ok) {
            const exportResult = await exportResponse.json()
            console.log('TXT-Export erfolgreich:', JSON.stringify(exportResult))
          } else {
            const errorText = await exportResponse.text()
            console.error('TXT-Export fehlgeschlagen:', exportResponse.status, errorText)
          }
        } catch (exportError) {
          console.error('Fehler beim TXT-Export an externe API:', exportError)
        }
      } else {
        console.log('Export-Konfiguration nicht vollständig (TRANSCRIPT_EXPORT_URL oder TRANSCRIPT_EXPORT_SECRET fehlt)')
      }
    }

    return new Response(JSON.stringify({ status: status, data: botData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: unknown) {
    console.error('Sync-Recording Fehler:', error)
    return new Response(
      JSON.stringify({ error: 'An error occurred processing your request' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})
