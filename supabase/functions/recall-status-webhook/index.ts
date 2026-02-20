import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Status codes that should trigger a sync
const SYNC_TRIGGER_STATUSES = new Set([
  'done',
  'recording_done',
  'analysis_done',
  'fatal',
  'media_expired',
]);

// Status codes to update in DB but not trigger sync
const STATUS_UPDATE_ONLY = new Set([
  'joining_call',
  'in_waiting_room',
  'in_call_not_recording',
  'in_call_recording',
  'call_ended',
]);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const payload = await req.json();
    console.log('[recall-status-webhook] Received payload:', JSON.stringify(payload));

    // Recall.ai sends: { event, data: { bot_id, status: { code, sub_code, ... } } }
    // or sometimes flat: { bot_id, status: { code, sub_code } }
    const botId = payload?.data?.bot_id || payload?.bot_id;
    const statusCode = payload?.data?.status?.code || payload?.status?.code || payload?.event;
    const subCode = payload?.data?.status?.sub_code || payload?.status?.sub_code;

    if (!botId) {
      console.warn('[recall-status-webhook] No bot_id in payload');
      return new Response(JSON.stringify({ error: 'Missing bot_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[recall-status-webhook] Bot: ${botId}, Status: ${statusCode}, SubCode: ${subCode}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Validate bot_id exists in our database
    const { data: recording, error: dbError } = await supabase
      .from('recordings')
      .select('id, status, user_id')
      .eq('recall_bot_id', botId)
      .maybeSingle();

    if (dbError || !recording) {
      console.warn(`[recall-status-webhook] No recording found for bot_id: ${botId}`);
      // Return 200 to prevent Recall.ai from retrying for unknown bots
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[recall-status-webhook] Found recording: ${recording.id}, current status: ${recording.status}`);

    // Map Recall status to our internal status for intermediate updates
    if (statusCode === 'in_call_recording' && recording.status !== 'done') {
      await supabase
        .from('recordings')
        .update({ status: 'recording' })
        .eq('id', recording.id);
      console.log(`[recall-status-webhook] Updated recording ${recording.id} status to 'recording'`);
    } else if (statusCode === 'call_ended' && recording.status !== 'done') {
      await supabase
        .from('recordings')
        .update({ status: 'processing' })
        .eq('id', recording.id);
      console.log(`[recall-status-webhook] Updated recording ${recording.id} status to 'processing' (call_ended, awaiting done)`);
    }

    // Check if this status should trigger sync
    if (!SYNC_TRIGGER_STATUSES.has(statusCode)) {
      console.log(`[recall-status-webhook] Status '${statusCode}' does not trigger sync. Done.`);
      return new Response(JSON.stringify({ ok: true, action: 'status_noted' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Don't re-sync already completed recordings
    if (recording.status === 'done') {
      console.log(`[recall-status-webhook] Recording ${recording.id} already done. Skipping sync.`);
      return new Response(JSON.stringify({ ok: true, action: 'already_done' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Trigger sync-recording
    console.log(`[recall-status-webhook] Triggering sync-recording for recording: ${recording.id}`);

    const syncUrl = `${supabaseUrl}/functions/v1/sync-recording`;
    const syncResponse = await fetch(syncUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ id: recording.id }),
    });

    const syncResult = await syncResponse.text();
    console.log(`[recall-status-webhook] sync-recording response (${syncResponse.status}): ${syncResult}`);

    return new Response(
      JSON.stringify({
        ok: true,
        action: 'sync_triggered',
        recording_id: recording.id,
        sync_status: syncResponse.status,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[recall-status-webhook] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
