import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-timestamp, x-webhook-signature',
};

interface StartMeetingPayload {
  meetingUrl: string;
  meetingId: string;
  title?: string;
  startTime?: string;
  endTime?: string;
}

async function verifySignature(
  body: string,
  timestamp: string,
  signature: string,
  secret: string
): Promise<boolean> {
  // Check timestamp is within 5 minutes to prevent replay attacks
  const timestampMs = parseInt(timestamp);
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;
  
  if (isNaN(timestampMs) || Math.abs(now - timestampMs) > fiveMinutes) {
    console.log('Timestamp validation failed:', { timestampMs, now, diff: Math.abs(now - timestampMs) });
    return false;
  }

  // Generate expected signature
  const payload = `${timestamp}.${body}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  const isValid = expectedSignature === signature;
  if (!isValid) {
    console.log('Signature mismatch');
  }
  
  return isValid;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method Not Allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const timestamp = req.headers.get('x-webhook-timestamp');
    const signature = req.headers.get('x-webhook-signature');
    const body = await req.text();

    // Require signed requests
    if (!timestamp || !signature) {
      console.error('Missing signature headers - rejecting unsigned request');
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Missing signature headers' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const secret = Deno.env.get('WEBHOOK_SIGNING_SECRET');
    if (!secret) {
      console.error('WEBHOOK_SIGNING_SECRET not configured');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isValid = await verifySignature(body, timestamp, signature, secret);
    if (!isValid) {
      console.error('Invalid webhook signature');
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Signature verified successfully');

    const data: StartMeetingPayload = JSON.parse(body);
    const { meetingUrl, meetingId, title, startTime, endTime } = data;

    if (!meetingUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing meetingUrl' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // --- PHASE 3 STARTPUNKT ---
    // Hier wird später der Code zum Starten Ihres externen Bots eingefügt.
    console.log('=== BOT START SIGNAL ===');
    console.log(`Meeting ID: ${meetingId}`);
    console.log(`Meeting URL: ${meetingUrl}`);
    console.log(`Title: ${title || 'N/A'}`);
    console.log(`Start Time: ${startTime || 'N/A'}`);
    console.log(`End Time: ${endTime || 'N/A'}`);
    console.log('========================');
    // ----------------------------

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Bot start signal received for ${meetingId}` 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error processing start-meeting-bot webhook:', errorMessage);
    return new Response(
      JSON.stringify({ error: `Internal Server Error: ${errorMessage}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
