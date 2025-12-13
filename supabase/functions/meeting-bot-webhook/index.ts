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

    // Forward to external bot service with HMAC signature
    const botServiceUrl = Deno.env.get('BOT_SERVICE_URL');
    const botServiceSecret = Deno.env.get('BOT_SERVICE_SECRET');

    let forwardResult = null;
    if (botServiceUrl && botServiceSecret) {
      console.log('📤 Forwarding to external bot service:', botServiceUrl);
      try {
        // Prepare payload for start-meeting-bot (matching expected field names)
        const forwardPayload = JSON.stringify({
          meeting_id: payload.meeting_id,
          topic: payload.title,
          attendees: payload.attendees.map(a => a.email),
          start_time: payload.start_time
        });

        // Simple x-secret-key header authentication (lowercase as expected by external service)
        const forwardResponse = await fetch(botServiceUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-secret-key': botServiceSecret
          },
          body: forwardPayload
        });

        const responseText = await forwardResponse.text();
        console.log('📥 Bot service response status:', forwardResponse.status);
        console.log('📥 Bot service response:', responseText);

        forwardResult = {
          status: forwardResponse.status,
          success: forwardResponse.ok,
          response: responseText
        };
      } catch (forwardError) {
        const errorMsg = forwardError instanceof Error ? forwardError.message : 'Unknown error';
        console.error('❌ Failed to forward to bot service:', errorMsg);
        forwardResult = {
          status: 0,
          success: false,
          error: errorMsg
        };
      }
    } else {
      console.log('ℹ️ BOT_SERVICE_URL or BOT_SERVICE_SECRET not configured - skipping forward');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Webhook received successfully',
        meeting_id: payload.meeting_id,
        received_at: new Date().toISOString(),
        forwarded: forwardResult
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
