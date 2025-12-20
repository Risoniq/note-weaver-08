import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Supabase Client & Secrets laden
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    const recallApiKey = Deno.env.get('RECALL_API_KEY')
    const recallApiUrl = Deno.env.get('RECALL_API_URL') || 'https://us-west-2.recall.ai/api/v1/bot'

    // 2. ID aus dem Request holen (vom Frontend gesendet)
    const { id } = await req.json()
    console.log(`Sync-Recording aufgerufen für ID: ${id}`)

    // 3. Datenbank-Eintrag holen, um die recall_bot_id zu bekommen
    const { data: recording, error: dbError } = await supabase
      .from('recordings')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (dbError) {
      console.error('DB Fehler:', dbError)
      throw new Error("Datenbankfehler beim Abrufen der Aufnahme.")
    }

    if (!recording) {
      throw new Error("Keine Aufnahme mit dieser ID gefunden.")
    }

    if (!recording.recall_bot_id) {
      throw new Error("Keine Recall Bot ID in der Datenbank gefunden.")
    }

    console.log(`Prüfe Status für Bot: ${recording.recall_bot_id}`)

    // 4. Status bei Recall.ai abfragen
    const response = await fetch(`${recallApiUrl}/${recording.recall_bot_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Token ${recallApiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      console.error('Recall API Fehler:', response.status, response.statusText)
      throw new Error("Fehler beim Abruf von Recall.ai")
    }
    
    const botData = await response.json()
    
    // Status aus status_changes Array extrahieren (letzter Eintrag)
    const latestStatus = botData.status_changes?.[botData.status_changes.length - 1]?.code || 'pending'
    console.log(`Bot Status (raw): ${latestStatus}`)
    
    // Status mapping
    const statusMap: Record<string, string> = {
      "ready": "pending",
      "joining_call": "joining",
      "in_waiting_room": "joining",
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
    
    const status = statusMap[latestStatus] || latestStatus
    console.log(`Bot Status (mapped): ${status}`)

    // 5. Daten vorbereiten für Update
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

    // 7. Wenn fertig und Transkript vorhanden, automatisch Analyse starten
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

    // 6. Datenbank aktualisieren
    const { error: updateError } = await supabase
      .from('recordings')
      .update(updates)
      .eq('id', id)

    if (updateError) {
      console.error('Update Fehler:', updateError)
      throw new Error("Fehler beim Update der DB")
    }

    console.log('Datenbank aktualisiert:', updates)

    return new Response(JSON.stringify({ status: status, data: botData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: unknown) {
    console.error('Sync-Recording Fehler:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler'
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
