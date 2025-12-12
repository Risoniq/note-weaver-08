/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-timestamp, x-webhook-signature',
};

interface MeetingWebhookPayload {
  meeting_id: string;
  meeting_url: string | null;
  title: string;
  start_time: string;
  end_time: string;
  attendees: Array<{ email: string; displayName?: string }>;
  triggered_at: string;
}

// HMAC-SHA256 signature verification
async function verifySignature(payload: string, signature: string, timestamp: string): Promise<boolean> {
  const secret = Deno.env.get('WEBHOOK_SIGNING_SECRET');
  if (!secret) {
    console.error('WEBHOOK_SIGNING_SECRET not configured');
    return false;
  }

  // Check timestamp is within 5 minutes to prevent replay attacks
  const timestampMs = parseInt(timestamp, 10);
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;
  
  if (isNaN(timestampMs) || Math.abs(now - timestampMs) > fiveMinutes) {
    console.error('Timestamp validation failed - request too old or invalid');
    return false;
  }

  // Create HMAC signature
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureData = `${timestamp}.${payload}`;
  const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(signatureData));
  const expectedSignature = Array.from(new Uint8Array(signatureBytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return signature === expectedSignature;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const timestamp = req.headers.get('x-webhook-timestamp');
    const signature = req.headers.get('x-webhook-signature');
    const body = await req.text();

    // Require signature for security
    if (!timestamp || !signature) {
      console.error('❌ Missing signature headers - request rejected');
      return new Response(
        JSON.stringify({ 
          error: 'Unauthorized', 
          message: 'Missing signature headers. Use generate-webhook-token to obtain a valid signature.' 
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isValid = await verifySignature(body, signature, timestamp);
    if (!isValid) {
      console.error('❌ Invalid webhook signature');
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.log('✅ Webhook signature verified successfully');

    const payload: MeetingWebhookPayload = JSON.parse(body);

    // Validate required fields
    if (!payload.meeting_id || !payload.title || !payload.start_time) {
      console.error('Missing required fields in webhook payload:', payload);
      return new Response(
        JSON.stringify({ error: 'Missing required fields: meeting_id, title, start_time' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('=== MEETING BOT WEBHOOK RECEIVED ===');
    console.log('Meeting ID:', payload.meeting_id);
    console.log('Title:', payload.title);
    console.log('Meeting URL:', payload.meeting_url || 'No URL provided');
    console.log('Start Time:', payload.start_time);
    console.log('End Time:', payload.end_time);
    console.log('Attendees:', JSON.stringify(payload.attendees));
    console.log('Triggered At:', payload.triggered_at);
    console.log('=====================================');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Webhook received successfully',
        meeting_id: payload.meeting_id,
        received_at: new Date().toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error processing webhook:', errorMessage);
    return new Response(
      JSON.stringify({ error: 'Failed to process webhook', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
