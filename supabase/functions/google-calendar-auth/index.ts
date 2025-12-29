import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Dynamic CORS headers based on origin
function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const allowedOrigins = [
    Deno.env.get('APP_URL') || '',
    'http://localhost:5173',
    'http://localhost:8080',
    'http://localhost:3000',
  ].filter(Boolean);
  
  const allowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || '*';
  
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
  };
}

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');

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

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }

  try {
    // 1. Authenticate user first
    const { user, error: authError } = await authenticateUser(req);
    if (!user) {
      return new Response(
        JSON.stringify({ error: authError || 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Auth] Authenticated user: ${user.id}`);

    let payload: {
      action?: string;
      code?: string;
      redirectUri?: string;
      refreshToken?: string;
    };

    try {
      payload = await req.json();
    } catch (parseError) {
      console.error('Failed to parse JSON body in google-calendar-auth:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const { action, code, redirectUri, refreshToken } = payload;

    if (!action) {
      return new Response(
        JSON.stringify({ error: 'Missing action' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    if (action === 'getAuthUrl') {
      const scope = encodeURIComponent('https://www.googleapis.com/auth/calendar.readonly');

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(redirectUri ?? '')}` +
        `&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;

      return new Response(JSON.stringify({ authUrl }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'exchangeCode') {
      if (!code || !redirectUri) {
        return new Response(
          JSON.stringify({ error: 'Missing code or redirectUri' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID!,
          client_secret: GOOGLE_CLIENT_SECRET!,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      const tokenResponseText = await tokenResponse.text();

      let tokens: { access_token?: string; refresh_token?: string; expires_in?: number; error?: string; error_description?: string };
      try {
        tokens = JSON.parse(tokenResponseText);
      } catch (parseError) {
        console.error(
          'Failed to parse Google token response JSON (exchangeCode):',
          tokenResponse.status,
        );
        return new Response(
          JSON.stringify({ error: 'Failed to exchange code with Google' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!tokenResponse.ok || tokens.error) {
        console.error('Google token endpoint error (exchangeCode):', {
          status: tokenResponse.status,
          error: tokens.error,
        });

        return new Response(
          JSON.stringify({ error: 'Failed to exchange code with Google' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresIn: tokens.expires_in,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'refreshToken') {
      if (!refreshToken) {
        return new Response(
          JSON.stringify({ error: 'Missing refreshToken' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          refresh_token: refreshToken,
          client_id: GOOGLE_CLIENT_ID!,
          client_secret: GOOGLE_CLIENT_SECRET!,
          grant_type: 'refresh_token',
        }),
      });

      const tokenResponseText = await tokenResponse.text();

      let tokens: { access_token?: string; expires_in?: number; error?: string; error_description?: string };
      try {
        tokens = JSON.parse(tokenResponseText);
      } catch (parseError) {
        console.error(
          'Failed to parse Google token response JSON (refreshToken):',
          tokenResponse.status,
        );
        return new Response(
          JSON.stringify({ error: 'Failed to refresh token with Google' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!tokenResponse.ok || tokens.error) {
        console.error('Google token endpoint error (refreshToken):', {
          status: tokenResponse.status,
          error: tokens.error,
        });

        return new Response(
          JSON.stringify({ error: 'Failed to refresh token with Google' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify({
        accessToken: tokens.access_token,
        expiresIn: tokens.expires_in,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error in google-calendar-auth:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred processing your request' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
