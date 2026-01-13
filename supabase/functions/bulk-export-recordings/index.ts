import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const getCorsHeaders = (req: Request) => {
  const origin = req.headers.get('origin') || ''
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'https://lovable.dev',
  ]
  const isAllowed = allowedOrigins.some(allowed => origin.startsWith(allowed)) || 
                    origin.includes('lovableproject.com') || 
                    origin.includes('lovable.app')
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : 'https://lovable.dev',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

const authenticateUser = async (req: Request) => {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return { user: null, error: 'Missing authorization header' }
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authHeader } }
  })

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return { user: null, error: 'Invalid token' }
  }
  return { user, error: null }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Authentifizierung
    const { user, error: authError } = await authenticateUser(req)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: authError }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('Bulk-Export gestartet für User:', user.id)

    // Supabase Client erstellen
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Alle "done" Recordings laden
    const { data: recordings, error: fetchError } = await supabase
      .from('recordings')
      .select('*')
      .eq('status', 'done')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (fetchError) {
      console.error('Fehler beim Laden der Recordings:', fetchError)
      return new Response(JSON.stringify({ error: 'Fehler beim Laden der Recordings' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`${recordings?.length || 0} Recordings gefunden`)

    if (!recordings || recordings.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Keine Recordings zum Exportieren gefunden',
        exported: 0,
        failed: 0 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Export-Konfiguration prüfen
    const exportUrl = Deno.env.get('TRANSCRIPT_EXPORT_URL')
    const exportSecret = Deno.env.get('TRANSCRIPT_EXPORT_SECRET')

    if (!exportUrl || !exportSecret) {
      return new Response(JSON.stringify({ 
        error: 'Export-Konfiguration nicht vollständig (TRANSCRIPT_EXPORT_URL oder TRANSCRIPT_EXPORT_SECRET fehlt)' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Jedes Recording exportieren
    const results = {
      exported: 0,
      failed: 0,
      details: [] as { id: string; title: string; success: boolean; error?: string }[]
    }

    for (const recording of recordings) {
      try {
        console.log(`Exportiere Recording: ${recording.id} - ${recording.title || 'Ohne Titel'}`)

        // Export-Daten zusammenstellen
        const exportData = {
          recording_id: recording.id,
          user_id: recording.user_id,
          title: recording.title || '',
          summary: recording.summary || '',
          key_points: recording.key_points || [],
          action_items: recording.action_items || [],
          transcript_text: recording.transcript_text || '',
          participants: recording.participants || [],
          calendar_attendees: recording.calendar_attendees || [],
          duration: recording.duration,
          word_count: recording.word_count,
          status: recording.status,
          meeting_url: recording.meeting_url,
          video_url: recording.video_url || '',
          transcript_url: recording.transcript_url || '',
          created_at: recording.created_at,
          updated_at: recording.updated_at,
          recall_bot_id: recording.recall_bot_id,
        }

        // An externe API senden
        const exportResponse = await fetch(exportUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-export-secret': exportSecret,
          },
          body: JSON.stringify(exportData),
        })

        if (exportResponse.ok) {
          results.exported++
          results.details.push({
            id: recording.id,
            title: recording.title || 'Ohne Titel',
            success: true,
          })
          console.log(`✓ Export erfolgreich: ${recording.id}`)
        } else {
          const errorText = await exportResponse.text()
          results.failed++
          results.details.push({
            id: recording.id,
            title: recording.title || 'Ohne Titel',
            success: false,
            error: `${exportResponse.status}: ${errorText}`,
          })
          console.error(`✗ Export fehlgeschlagen: ${recording.id} - ${exportResponse.status}: ${errorText}`)
        }

        // Kleine Pause zwischen Requests (Rate Limiting vermeiden)
        await new Promise(resolve => setTimeout(resolve, 500))

      } catch (recordingError) {
        results.failed++
        results.details.push({
          id: recording.id,
          title: recording.title || 'Ohne Titel',
          success: false,
          error: String(recordingError),
        })
        console.error(`✗ Fehler beim Export von ${recording.id}:`, recordingError)
      }
    }

    console.log(`Bulk-Export abgeschlossen: ${results.exported} erfolgreich, ${results.failed} fehlgeschlagen`)

    return new Response(JSON.stringify({
      success: true,
      message: `Bulk-Export abgeschlossen`,
      exported: results.exported,
      failed: results.failed,
      total: recordings.length,
      details: results.details,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Unerwarteter Fehler:', error)
    return new Response(JSON.stringify({ error: 'Interner Serverfehler' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
