import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // API-Key Authentifizierung (für externe Systeme)
    const apiKey = req.headers.get('x-api-key');
    const expectedApiKey = Deno.env.get('Superbase_transcripts');
    
    if (!apiKey || apiKey !== expectedApiKey) {
      return new Response(JSON.stringify({ error: 'Unauthorized - Invalid API Key' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Query-Parameter für Filterung
    const url = new URL(req.url);
    const since = url.searchParams.get('since'); // ISO Date - nur Transkripte seit diesem Datum
    const status = url.searchParams.get('status') || 'done'; // Filter nach Status
    const includeEmpty = url.searchParams.get('include_empty') === 'true';

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Query aufbauen
    let query = supabase
      .from('recordings')
      .select(`
        id,
        user_id,
        title,
        summary,
        key_points,
        action_items,
        transcript_text,
        transcript_url,
        participants,
        calendar_attendees,
        duration,
        word_count,
        status,
        meeting_url,
        video_url,
        created_at,
        updated_at
      `)
      .eq('status', status)
      .order('created_at', { ascending: false });

    // Nur Einträge mit Transkript
    if (!includeEmpty) {
      query = query.not('transcript_text', 'is', null);
    }

    // Datum-Filter
    if (since) {
      query = query.gte('created_at', since);
    }

    const { data: recordings, error } = await query;

    if (error) {
      console.error('Query error:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch transcripts' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // User-Emails abrufen für bessere Zuordnung
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const userMap = new Map(authUsers?.users.map(u => [u.id, u.email]) || []);

    // Response formatieren
    const transcripts = recordings.map(rec => ({
      ...rec,
      user_email: userMap.get(rec.user_id) || null,
    }));

    return new Response(JSON.stringify({
      success: true,
      count: transcripts.length,
      exported_at: new Date().toISOString(),
      transcripts,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Export error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
