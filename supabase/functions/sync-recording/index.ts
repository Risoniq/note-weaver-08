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
    const recallApiUrl = Deno.env.get('RECALL_API_URL') || 'https://us-west-2.recall.ai/api/v1/bot'

    // 3. ID aus dem Request holen (vom Frontend gesendet)
    const { id } = await req.json()
    console.log(`Sync-Recording aufgerufen für ID: ${id}`)

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

    // Wenn der Bot fertig ist ('done'), holen wir die Video- und Transkript-URLs sowie Teilnehmer
    if (status === 'done') {
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
      
      // Teilnehmer von Recall.ai abrufen
      let participantMap: Record<string, string> = {}
      let participantsList: { id: string; name: string }[] = []
      
      try {
        const participantsResponse = await fetch(`${recallApiUrl}/${recording.recall_bot_id}/speaker_timeline`, {
          method: 'GET',
          headers: {
            'Authorization': `Token ${recallApiKey}`,
            'Content-Type': 'application/json',
          },
        })
        
        if (participantsResponse.ok) {
          const speakerTimeline = await participantsResponse.json()
          console.log('Speaker Timeline:', JSON.stringify(speakerTimeline, null, 2))
          
          // Extrahiere unique Sprecher aus der Timeline
          if (Array.isArray(speakerTimeline)) {
            const uniqueSpeakers = new Map<number, string>()
            speakerTimeline.forEach((entry: { user?: { name?: string; id?: number } }) => {
              if (entry.user?.id !== undefined) {
                const speakerId = entry.user.id
                const speakerName = entry.user.name || `Sprecher ${speakerId + 1}`
                uniqueSpeakers.set(speakerId, speakerName)
              }
            })
            
            // Konvertiere zu Map für einfachen Lookup
            uniqueSpeakers.forEach((name, id) => {
              participantMap[String(id)] = name
              participantsList.push({ id: String(id), name })
            })
            
            console.log('Teilnehmer-Map:', participantMap)
          }
        } else {
          console.log('Speaker Timeline nicht verfügbar, versuche Participants Endpoint...')
          
          // Fallback: Versuche den participants Endpoint
          const fallbackResponse = await fetch(`${recallApiUrl}/${recording.recall_bot_id}`, {
            method: 'GET',
            headers: {
              'Authorization': `Token ${recallApiKey}`,
              'Content-Type': 'application/json',
            },
          })
          
          if (fallbackResponse.ok) {
            const botInfo = await fallbackResponse.json()
            if (botInfo.meeting_participants && Array.isArray(botInfo.meeting_participants)) {
              botInfo.meeting_participants.forEach((p: { id?: number; name?: string }, index: number) => {
                const id = p.id !== undefined ? String(p.id) : String(index)
                const name = p.name || `Sprecher ${index + 1}`
                participantMap[id] = name
                participantsList.push({ id, name })
              })
              console.log('Teilnehmer von meeting_participants:', participantMap)
            }
          }
        }
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
            
            // Transkript formatieren mit Sprecher-Namen
            if (Array.isArray(transcriptData) && transcriptData.length > 0) {
              let speakerCounter = 1
              const unknownSpeakerMap: Record<string, string> = {}
              
              const formattedTranscript = transcriptData
                .map((entry: { speaker?: string; speaker_id?: number; words?: { text?: string }[] }) => {
                  let speaker = 'Unbekannt'
                  
                  // Versuche Sprecher-ID zu verwenden
                  if (entry.speaker_id !== undefined) {
                    speaker = participantMap[String(entry.speaker_id)] || `Sprecher ${entry.speaker_id + 1}`
                  } else if (entry.speaker) {
                    // Wenn Speaker-ID nicht verfügbar, aber speaker String vorhanden
                    if (participantMap[entry.speaker]) {
                      speaker = participantMap[entry.speaker]
                    } else if (entry.speaker !== 'Unbekannt' && entry.speaker !== '') {
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
