import { createClient } from 'npm:@supabase/supabase-js@2';

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

interface BulkParams {
  limit?: number
  since?: string
  user_id?: string
}

const getCorsHeaders = (req: Request) => {
  const origin = req.headers.get('origin') || ''
  const allowedOrigins = [
    'https://notetaker2pro.com',
    'https://www.notetaker2pro.com',
    'http://localhost:5173',
    'http://localhost:5174',
    'https://lovable.dev',
  ]
  const isAllowed = allowedOrigins.some(allowed => origin.startsWith(allowed)) || 
                    origin.includes('lovableproject.com') || 
                    origin.includes('lovable.app')
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-export-secret',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Secret-basierte Authentifizierung ODER Admin-JWT
    const exportSecret = Deno.env.get('TRANSCRIPT_EXPORT_SECRET')
    const providedSecret = req.headers.get('x-export-secret') ?? ''
    
    // Prüfe zuerst Secret-Auth
    let isAuthorized = exportSecret && providedSecret === exportSecret
    
    // Falls kein Secret, prüfe auf Admin-Rolle via JWT
    if (!isAuthorized) {
      const authHeader = req.headers.get('Authorization')
      if (authHeader?.startsWith('Bearer ')) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
        const adminClient = createClient(supabaseUrl, supabaseServiceKey)
        
        const token = authHeader.replace('Bearer ', '')
        const { data: { user }, error: authError } = await adminClient.auth.getUser(token)
        
        if (user && !authError) {
          // Prüfe ob User Admin ist
          const { data: roleData } = await adminClient
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id)
            .eq('role', 'admin')
            .maybeSingle()
          
          isAuthorized = !!roleData
          console.log(`Admin-Auth für User ${user.id}: ${isAuthorized ? 'OK' : 'Nicht Admin'}`)
        }
      }
    }
    
    if (!isAuthorized) {
      console.error('Unauthorized: Invalid secret or missing admin role')
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('Bulk-Export gestartet (Secret-Auth)')

    // Parameter aus Body
    const { limit = 50, since, user_id }: BulkParams = await req.json().catch(() => ({}))

    // Supabase Client mit Service Role Key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Query aufbauen
    let query = supabase
      .from('recordings')
      .select('*')
      .eq('status', 'done')
      .order('created_at', { ascending: true })
      .limit(limit)

    // Optional: Filter nach User
    if (user_id) {
      query = query.eq('user_id', user_id)
    }

    // Optional: Filter nach Datum
    if (since) {
      query = query.gte('created_at', since)
    }

    const { data: recordings, error: fetchError } = await query

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
        message: 'Keine Recordings zum Exportieren gefunden',
        exported: 0,
        attempted: 0 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Export-URL prüfen
    const exportUrl = Deno.env.get('TRANSCRIPT_EXPORT_URL')

    if (!exportUrl) {
      return new Response(JSON.stringify({ 
        error: 'TRANSCRIPT_EXPORT_URL nicht konfiguriert' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Jedes Recording exportieren
    const results: Array<{ id: string; title: string; ok: boolean; status: number; error?: string }> = []

    for (const recording of recordings) {
      try {
        console.log(`Exportiere: ${recording.id} - ${recording.title || 'Ohne Titel'}`)

        const meetingTitle = recording.title || 'Ohne Titel'
        const safeTitle = sanitizeTitle(meetingTitle)
        
        const exportData = {
          recording_id: recording.id,
          user_id: recording.user_id,
          title: meetingTitle,          // Original-Titel für Anzeige
          safe_title: safeTitle,        // Sanitierter Titel für Dateiname
          summary: recording.summary || '',
          key_points: recording.key_points || [],
          action_items: recording.action_items || [],
          transcript_text: recording.transcript_text || '',
          transcript_txt: recording.transcript_text || '', // Kompatibilität
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

        const exportResponse = await fetch(exportUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-export-secret': exportSecret || '',
          },
          body: JSON.stringify(exportData),
        })

        results.push({
          id: recording.id,
          title: recording.title || 'Ohne Titel',
          ok: exportResponse.ok,
          status: exportResponse.status,
          error: exportResponse.ok ? undefined : await exportResponse.text(),
        })

        console.log(`${exportResponse.ok ? '✓' : '✗'} ${recording.id}: ${exportResponse.status}`)

        // Rate Limiting
        await new Promise(resolve => setTimeout(resolve, 300))

      } catch (err) {
        results.push({
          id: recording.id,
          title: recording.title || 'Ohne Titel',
          ok: false,
          status: 0,
          error: String(err),
        })
        console.error(`✗ Fehler bei ${recording.id}:`, err)
      }
    }

    const exported = results.filter(r => r.ok).length
    console.log(`Bulk-Export abgeschlossen: ${exported}/${recordings.length} erfolgreich`)

    return new Response(JSON.stringify({
      message: 'Bulk-Export abgeschlossen',
      exported,
      attempted: recordings.length,
      details: results,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Unerwarteter Fehler:', error)
    return new Response(JSON.stringify({ error: 'internal_error', message: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
