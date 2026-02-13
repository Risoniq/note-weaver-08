import { createClient } from 'npm:@supabase/supabase-js@2';

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

// Helper: Authenticate user and check admin role
async function authenticateAdmin(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return { user: null, error: 'Authorization header required' };
  }

  const token = authHeader.replace('Bearer ', '');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  
  if (authError || !user) {
    return { user: null, error: 'Invalid or expired token' };
  }

  // Check admin role
  const adminClient = createClient(supabaseUrl, supabaseServiceKey);
  const { data: isAdmin } = await adminClient.rpc('has_role', { _user_id: user.id, _role: 'admin' });

  return { user: { id: user.id }, isAdmin: !!isAdmin, error: isAdmin ? null : 'Forbidden' };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'repair-sync';

    // For create-missing-backups, require admin
    if (action === 'create-missing-backups') {
      const { user, isAdmin, error: authError } = await authenticateAdmin(req);
      if (!user || !isAdmin) {
        return new Response(
          JSON.stringify({ success: false, error: authError || 'Unauthorized' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const batchSize = body.batch_size || 20;
      const offset = body.offset || 0;

      // Fetch recordings with transcripts
      const { data: recordings, error: fetchError } = await supabase
        .from('recordings')
        .select('id, user_id, transcript_text, title, created_at')
        .eq('status', 'done')
        .is('deleted_at', null)
        .not('transcript_text', 'is', null)
        .not('user_id', 'is', null)
        .range(offset, offset + batchSize - 1)
        .order('created_at', { ascending: true });

      if (fetchError) {
        console.error('[CreateBackups] Fetch error:', fetchError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to fetch recordings' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get total count for progress
      const { count: totalCount } = await supabase
        .from('recordings')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'done')
        .is('deleted_at', null)
        .not('transcript_text', 'is', null)
        .not('user_id', 'is', null);

      if (!recordings || recordings.length === 0) {
        return new Response(
          JSON.stringify({ success: true, created: 0, skipped: 0, total: totalCount || 0, done: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let created = 0;
      let skipped = 0;
      let errors = 0;

      // Group by user_id for efficient storage listing
      const userRecordings = new Map<string, typeof recordings>();
      for (const rec of recordings) {
        const arr = userRecordings.get(rec.user_id!) || [];
        arr.push(rec);
        userRecordings.set(rec.user_id!, arr);
      }

      for (const [userId, recs] of userRecordings) {
        // List existing backup files for this user
        const { data: files } = await supabase.storage
          .from('transcript-backups')
          .list(userId, { limit: 1000 });

        for (const rec of recs) {
          try {
            // Check if backup already exists (prefix match)
            const hasBackup = (files || []).some(f => f.name.startsWith(rec.id));

            if (hasBackup) {
              skipped++;
              continue;
            }

            // Create backup from transcript_text
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filePath = `${userId}/${rec.id}_backup_${timestamp}.txt`;
            const content = `Titel: ${rec.title || 'Ohne Titel'}\nErstellt: ${rec.created_at}\n\n${rec.transcript_text}`;

            const { error: uploadError } = await supabase.storage
              .from('transcript-backups')
              .upload(filePath, new Blob([content], { type: 'text/plain' }), {
                contentType: 'text/plain',
                upsert: false,
              });

            if (uploadError) {
              console.error(`[CreateBackups] Upload error for ${rec.id}:`, uploadError.message);
              errors++;
            } else {
              created++;
              console.log(`[CreateBackups] Created backup for ${rec.id}`);
            }
          } catch (e) {
            console.error(`[CreateBackups] Error for ${rec.id}:`, e);
            errors++;
          }
        }
      }

      const nextOffset = offset + batchSize;
      const done = nextOffset >= (totalCount || 0);

      console.log(`[CreateBackups] Batch done: created=${created}, skipped=${skipped}, errors=${errors}, offset=${offset}, done=${done}`);

      return new Response(
        JSON.stringify({
          success: true,
          created,
          skipped,
          errors,
          total: totalCount || 0,
          nextOffset: done ? null : nextOffset,
          done,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Original repair-sync action (unchanged)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[RepairAll] Authenticated user: ${user.id}`);

    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const adminClient = createClient(supabaseUrl, supabaseKey);

    const { data: recordings, error: fetchError } = await adminClient
      .from('recordings')
      .select('id, recall_bot_id, status')
      .eq('user_id', user.id)
      .eq('status', 'done')
      .not('recall_bot_id', 'is', null);

    if (fetchError) {
      console.error('[RepairAll] Fetch error:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch recordings' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[RepairAll] Found ${recordings?.length || 0} recordings to repair`);

    if (!recordings || recordings.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No recordings to repair', repaired: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: { id: string; success: boolean; error?: string }[] = [];

    for (const recording of recordings) {
      try {
        console.log(`[RepairAll] Repairing recording: ${recording.id}`);
        
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
        });

        if (syncResponse.ok) {
          console.log(`[RepairAll] Successfully repaired: ${recording.id}`);
          results.push({ id: recording.id, success: true });
        } else {
          const errorText = await syncResponse.text();
          console.error(`[RepairAll] Failed to repair ${recording.id}:`, errorText);
          results.push({ id: recording.id, success: false, error: errorText });
        }

        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (repairError) {
        console.error(`[RepairAll] Error repairing ${recording.id}:`, repairError);
        results.push({ id: recording.id, success: false, error: String(repairError) });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    console.log(`[RepairAll] Completed: ${successCount} success, ${failedCount} failed`);

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
    console.error('[RepairAll] Error:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred processing your request' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
