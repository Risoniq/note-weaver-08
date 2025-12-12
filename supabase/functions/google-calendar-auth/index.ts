import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');

serve(async (req) => {
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

      let tokens: any;
      try {
        tokens = JSON.parse(tokenResponseText);
      } catch (parseError) {
        console.error(
          'Failed to parse Google token response JSON (exchangeCode):',
          tokenResponse.status,
          tokenResponseText.slice(0, 200),
        );
        throw new Error('Ungültige Antwort vom Google Token-Endpunkt');
      }

      if (!tokenResponse.ok || tokens.error) {
        console.error('Google token endpoint error (exchangeCode):', {
          status: tokenResponse.status,
          error: tokens.error,
          error_description: tokens.error_description,
        });

        throw new Error(tokens.error_description || tokens.error || 'Fehler beim Token-Austausch mit Google');
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

      let tokens: any;
      try {
        tokens = JSON.parse(tokenResponseText);
      } catch (parseError) {
        console.error(
          'Failed to parse Google token response JSON (refreshToken):',
          tokenResponse.status,
          tokenResponseText.slice(0, 200),
        );
        throw new Error('Ungültige Antwort vom Google Token-Endpunkt');
      }

      if (!tokenResponse.ok || tokens.error) {
        console.error('Google token endpoint error (refreshToken):', {
          status: tokenResponse.status,
          error: tokens.error,
          error_description: tokens.error_description,
        });

        throw new Error(tokens.error_description || tokens.error || 'Fehler beim Aktualisieren des Tokens');
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in google-calendar-auth:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
