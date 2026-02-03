import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

    console.log(`[RepairAll] Authenticated user: ${user.id}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 2. Alle Aufzeichnungen des Users abrufen die "done" sind und einen recall_bot_id haben
    const { data: recordings, error: fetchError } = await supabase
      .from('recordings')
      .select('id, recall_bot_id, status')
      .eq('user_id', user.id)
      .eq('status', 'done')
      .not('recall_bot_id', 'is', null)

    if (fetchError) {
      console.error('[RepairAll] Fetch error:', fetchError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch recordings' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[RepairAll] Found ${recordings?.length || 0} recordings to repair`)

    if (!recordings || recordings.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No recordings to repair', repaired: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Für jede Aufzeichnung sync-recording mit force_resync aufrufen
    const results: { id: string; success: boolean; error?: string }[] = []

    for (const recording of recordings) {
      try {
        console.log(`[RepairAll] Repairing recording: ${recording.id}`)
        
        const syncResponse = await fetch(`${supabaseUrl}/functions/v1/sync-recording`, {
          method: 'POST',
          headers: {
            'Authorization': req.headers.get('Authorization') || '',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            id: recording.id, 
            force_resync: true 
          }),
        })

        if (syncResponse.ok) {
          console.log(`[RepairAll] Successfully repaired: ${recording.id}`)
          results.push({ id: recording.id, success: true })
        } else {
          const errorText = await syncResponse.text()
          console.error(`[RepairAll] Failed to repair ${recording.id}:`, errorText)
          results.push({ id: recording.id, success: false, error: errorText })
        }

        // Kleine Pause zwischen den Requests um Rate Limiting zu vermeiden
        await new Promise(resolve => setTimeout(resolve, 500))

      } catch (repairError) {
        console.error(`[RepairAll] Error repairing ${recording.id}:`, repairError)
        results.push({ id: recording.id, success: false, error: String(repairError) })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failedCount = results.filter(r => !r.success).length

    console.log(`[RepairAll] Completed: ${successCount} success, ${failedCount} failed`)

    return new Response(
      JSON.stringify({ 
        message: `Repaired ${successCount} of ${recordings.length} recordings`,
        repaired: successCount,
        failed: failedCount,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[RepairAll] Error:', error)
    return new Response(
      JSON.stringify({ error: 'An error occurred processing your request' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})
