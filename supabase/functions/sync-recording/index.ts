import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Dynamic CORS headers based on origin
function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const allowedOrigins = [
    Deno.env.get('APP_URL') || '',
    'http://localhost:5173',
    'http://localhost:8080',
    'http://localhost:3000',
  ].filter(Boolean);
  
  // Check if origin matches allowed origins or is a Lovable preview domain
  const isLovablePreview = origin.endsWith('.lovableproject.com') || origin.endsWith('.lovable.app');
  const allowOrigin = allowedOrigins.includes(origin) || isLovablePreview 
    ? origin 
    : allowedOrigins[0] || '*';
  
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
  };
}

// Helper: Authenticate user from request
async function authenticateUser(req: Request): Promise<{ user: { id: string } | null; error?: string }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return { user: null, error: 'Authorization header required' };
  }

  const token = authHeader.replace('Bearer ', '');
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
    const { user, error: authError } = await authenticateUser(req);
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

    // 5. Verify ownership - user can only sync their own recordings
    if (recording.user_id && recording.user_id !== user.id) {
      console.error(`[Auth] User ${user.id} tried to access recording owned by ${recording.user_id}`);
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
    
    console.log(`Bot Status (mapped): ${status}`)

    // 7. Daten vorbereiten für Update
    const updates: Record<string, unknown> = { status: status }

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
          if (Array.isArray(speakerTimeline)) {
            speakerTimeline.forEach((entry: { user?: { name?: string; id?: number; platform_user_id?: string; identifier?: string } }) => {
              if (entry.user) {
                const speakerId = entry.user.id !== undefined ? String(entry.user.id) : null
                const platformId = entry.user.platform_user_id || null
                const identifier = entry.user.identifier || null
                const name = entry.user.name && entry.user.name.trim() !== '' ? entry.user.name : null
                
                if (name) {
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
            
            // Transkript formatieren mit Sprecher-Namen - verbesserte Logik
            if (Array.isArray(transcriptData) && transcriptData.length > 0) {
              let speakerCounter = 1
              const unknownSpeakerMap: Record<string, string> = {}
              
              console.log('Transkript Entry Sample:', JSON.stringify(transcriptData[0], null, 2))
              
              const formattedTranscript = transcriptData
                .map((entry: { 
                  speaker?: string; 
                  speaker_id?: number; 
                  user?: { id?: number; name?: string; platform_user_id?: string; identifier?: string };
                  words?: { text?: string }[] 
                }) => {
                  let speaker = 'Unbekannt'
                  
                  // Priorität 1: user.name direkt im Entry (MS Teams liefert das oft so)
                  if (entry.user?.name && entry.user.name.trim() !== '') {
                    speaker = entry.user.name
                  }
                  // Priorität 2: user.id zum Nachschlagen in participantMap
                  else if (entry.user?.id !== undefined) {
                    const userId = String(entry.user.id)
                    speaker = participantMap[userId] || `Sprecher ${entry.user.id + 1}`
                  }
                  // Priorität 3: user.platform_user_id
                  else if (entry.user?.platform_user_id) {
                    speaker = participantMap[entry.user.platform_user_id] || entry.user.platform_user_id
                  }
                  // Priorität 4: speaker_id
                  else if (entry.speaker_id !== undefined) {
                    speaker = participantMap[String(entry.speaker_id)] || `Sprecher ${entry.speaker_id + 1}`
                  }
                  // Priorität 5: speaker String
                  else if (entry.speaker) {
                    if (participantMap[entry.speaker]) {
                      speaker = participantMap[entry.speaker]
                    } else if (entry.speaker !== 'Unbekannt' && entry.speaker !== '' && entry.speaker !== 'unknown') {
                      speaker = entry.speaker
                    } else {
                      // Konsistente Nummerierung für unbekannte Sprecher
                      if (!unknownSpeakerMap[entry.speaker || 'unknown']) {
                        unknownSpeakerMap[entry.speaker || 'unknown'] = `Sprecher ${speakerCounter++}`
                      }
                      speaker = unknownSpeakerMap[entry.speaker || 'unknown']
                    }
                  }
                  
                  const text = entry.words?.map(w => w.text).join(' ') || ''
                  return `${speaker}: ${text}`
                })
                .join('\n\n')
              
              updates.transcript_text = formattedTranscript
              console.log('Transkript formatiert, Länge:', formattedTranscript.length, 'Zeichen')
            }
          } else {
            console.error('Transkript-Download fehlgeschlagen:', transcriptResponse.status, transcriptResponse.statusText)
          }
        } catch (transcriptError) {
          console.error('Transkript-Abruf fehlgeschlagen:', transcriptError)
        }
      } else {
        console.log('Keine Transkript-URL in media_shortcuts gefunden')
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
    }

    // 8. Wenn fertig und Transkript vorhanden, automatisch Analyse starten
    if (status === 'done' && updates.transcript_text) {
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

    // 9. Export an externe Supabase-API senden (nach jedem abgeschlossenen Meeting)
    if (status === 'done') {
      const exportUrl = Deno.env.get('TRANSCRIPT_EXPORT_URL')
      const exportSecret = Deno.env.get('TRANSCRIPT_EXPORT_SECRET')
      
      if (exportUrl && exportSecret) {
        console.log('Sende Meeting-Daten an externe Export-API...')
        try {
          // Vollständige Meeting-Daten für Export zusammenstellen
          const exportData = {
            recording_id: id,
            user_id: recording.user_id || user.id,
            title: recording.title || updates.title || '',
            summary: recording.summary || updates.summary || '',
            key_points: recording.key_points || updates.key_points || [],
            action_items: recording.action_items || updates.action_items || [],
            transcript_text: updates.transcript_text || recording.transcript_text || '',
            participants: updates.participants || recording.participants || [],
            calendar_attendees: updates.calendar_attendees || recording.calendar_attendees || [],
            duration: recording.duration,
            word_count: recording.word_count,
            status: status,
            meeting_url: recording.meeting_url,
            video_url: updates.video_url || recording.video_url || '',
            transcript_url: updates.transcript_url || recording.transcript_url || '',
            created_at: recording.created_at,
            updated_at: new Date().toISOString(),
            recall_bot_id: recording.recall_bot_id,
          }
          
          const exportResponse = await fetch(exportUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-export-secret': exportSecret,
            },
            body: JSON.stringify(exportData),
          })
          
          if (exportResponse.ok) {
            const exportResult = await exportResponse.json()
            console.log('Export erfolgreich:', JSON.stringify(exportResult))
          } else {
            const errorText = await exportResponse.text()
            console.error('Export fehlgeschlagen:', exportResponse.status, errorText)
          }
        } catch (exportError) {
          console.error('Fehler beim Export an externe API:', exportError)
        }
      } else {
        console.log('Export-Konfiguration nicht vollständig (TRANSCRIPT_EXPORT_URL oder TRANSCRIPT_EXPORT_SECRET fehlt)')
      }
    }

    // 9. Datenbank aktualisieren
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
