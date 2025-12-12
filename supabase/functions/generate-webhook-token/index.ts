import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate HMAC-SHA256 signature
async function generateSignature(payload: string, timestamp: string, secret: string): Promise<string> {
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
  return Array.from(new Uint8Array(signatureBytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const secret = Deno.env.get('WEBHOOK_SIGNING_SECRET');
    
    if (!secret) {
      console.error('WEBHOOK_SIGNING_SECRET not configured');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the raw request body text first to ensure consistent formatting
    const rawBody = await req.text();
    const body = JSON.parse(rawBody);
    
    // Use the exact payload string that was passed - this is what will be sent to the webhook
    // and must match exactly for signature verification
    const payload = body.payloadString;
    
    if (!payload || typeof payload !== 'string') {
      console.error('Missing or invalid payloadString in request body');
      return new Response(
        JSON.stringify({ error: 'Missing payloadString in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const timestamp = Date.now().toString();
    
    console.log('Generating signature for payload length:', payload.length);
    
    // Generate signature
    const signature = await generateSignature(payload, timestamp, secret);
    
    console.log('Generated webhook token for payload');
    
    return new Response(
      JSON.stringify({ 
        signature, 
        timestamp,
        expires_at: Date.now() + 60000 // Token valid for 60 seconds
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating webhook token:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
