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
  
  const isLovablePreview = origin.endsWith('.lovableproject.com') || origin.endsWith('.lovable.app');
  const allowOrigin = allowedOrigins.includes(origin) || isLovablePreview 
    ? origin 
    : allowedOrigins[0] || '*';
  
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
  };
}

// Helper: Authenticate user from request
async function authenticateUser(req: Request): Promise<{ user: { id: string; email?: string } | null; error?: string }> {
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
    console.error('[GoogleAuth] Authentication failed:', authError?.message);
    return { user: null, error: 'Invalid or expired token' };
  }

  return { user: { id: user.id, email: user.email || undefined } };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user: authUser, error: authError } = await authenticateUser(req);
    if (!authUser) {
      console.log('[GoogleAuth] Authentication failed:', authError);
      return new Response(
        JSON.stringify({ success: false, error: authError || 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[GoogleAuth] Authenticated user: ${authUser.id}`);

    const RECALL_API_KEY = Deno.env.get('RECALL_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');

    if (!RECALL_API_KEY) {
      console.error('[GoogleAuth] RECALL_API_KEY is not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error('[GoogleAuth] Failed to parse JSON body:', parseError);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { action, supabase_user_id, user_email, redirect_uri } = body;
    
    // Validate user ID
    const providedUserId = supabase_user_id || null;
    if (providedUserId && providedUserId !== authUser.id) {
      console.error(`[GoogleAuth] User ID mismatch: provided ${providedUserId} vs authenticated ${authUser.id}`);
      return new Response(
        JSON.stringify({ success: false, error: 'User ID mismatch' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const supabaseUserId = authUser.id;
    const userEmail = user_email || authUser.email || null;
    
    console.log('[GoogleAuth] Request:', { action, supabase_user_id: supabaseUserId, user_email: userEmail });

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Helper: Get stable Recall user ID
    function getStableRecallUserId(email: string | null, supabaseId: string): string {
      return email || supabaseId;
    }

    // Helper: Get or create Recall user
    async function getOrCreateRecallUser(supabaseUserId: string, userEmail: string | null): Promise<{ recallUserId: string; isNew: boolean }> {
      const stableId = getStableRecallUserId(userEmail, supabaseUserId);
      
      const { data: existingUser, error: fetchError } = await supabase
        .from('recall_calendar_users')
        .select('recall_user_id')
        .eq('supabase_user_id', supabaseUserId)
        .maybeSingle();

      if (fetchError) {
        console.error('[GoogleAuth] Error fetching user:', fetchError);
      }

      if (existingUser?.recall_user_id) {
        console.log('[GoogleAuth] Found existing Recall user:', existingUser.recall_user_id);
        return { recallUserId: existingUser.recall_user_id, isNew: false };
      }

      const recallUserId = stableId;
      
      const { error: insertError } = await supabase
        .from('recall_calendar_users')
        .insert({ 
          recall_user_id: recallUserId,
          supabase_user_id: supabaseUserId,
        });
      
      if (insertError) {
        if (insertError.code === '23505') {
          const { data: retry } = await supabase
            .from('recall_calendar_users')
            .select('recall_user_id')
            .eq('supabase_user_id', supabaseUserId)
            .maybeSingle();
          
          if (retry?.recall_user_id) {
            return { recallUserId: retry.recall_user_id, isNew: false };
          }
        }
        console.error('[GoogleAuth] Error inserting user:', insertError);
        throw new Error('Failed to create calendar user');
      }

      console.log('[GoogleAuth] Created new Recall user:', recallUserId);
      return { recallUserId, isNew: true };
    }

    // Helper: Get auth token from Recall.ai
    async function getRecallAuthToken(recallUserId: string): Promise<string | null> {
      const authResponse = await fetch('https://eu-central-1.recall.ai/api/v1/calendar/authenticate/', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${RECALL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: recallUserId }),
      });

      if (!authResponse.ok) {
        console.error('[GoogleAuth] Recall auth token error:', authResponse.status);
        return null;
      }

      const authData = await authResponse.json();
      return authData.token;
    }

    // Helper: Check Google connection status
    async function checkGoogleConnection(recallUserId: string, authToken: string): Promise<{ connected: boolean; userData: { id?: string; [key: string]: unknown } | null }> {
      const userResponse = await fetch(`https://eu-central-1.recall.ai/api/v1/calendar/user/?user_id=${recallUserId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Token ${RECALL_API_KEY}`,
          'x-recallcalendarauthtoken': authToken,
          'Content-Type': 'application/json',
        },
      });

      if (!userResponse.ok) {
        if (userResponse.status === 404) {
          return { connected: false, userData: null };
        }
        console.error('[GoogleAuth] Recall user status error:', userResponse.status);
        return { connected: false, userData: null };
      }

      const userData = await userResponse.json();
      console.log('[GoogleAuth] Recall user data:', userData);

      let googleConnected = false;
      
      if (userData.connections && Array.isArray(userData.connections)) {
        for (const conn of userData.connections) {
          if (conn.platform === 'google' && conn.connected) {
            googleConnected = true;
          }
        }
      } else {
        googleConnected = userData.google_calendar_id !== null;
      }

      return { connected: googleConnected, userData };
    }

    // ACTION: authenticate - Start Google OAuth flow
    if (action === 'authenticate') {
      const { data: existingUser } = await supabase
        .from('recall_calendar_users')
        .select('recall_user_id')
        .eq('supabase_user_id', supabaseUserId)
        .maybeSingle();

      let recallUserId: string;
      
      if (existingUser?.recall_user_id) {
        recallUserId = existingUser.recall_user_id;
        console.log('[GoogleAuth] Using existing Recall user ID:', recallUserId);
      } else {
        const result = await getOrCreateRecallUser(supabaseUserId, userEmail);
        recallUserId = result.recallUserId;
        console.log('[GoogleAuth] Created new Recall user ID:', recallUserId);
      }

      // Get authentication token from Recall.ai
      const authResponse = await fetch('https://eu-central-1.recall.ai/api/v1/calendar/authenticate/', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${RECALL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: recallUserId }),
      });

      if (!authResponse.ok) {
        console.error('[GoogleAuth] Recall auth error:', authResponse.status);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to get calendar auth token' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const authData = await authResponse.json();
      console.log('[GoogleAuth] Recall auth token received for user:', recallUserId);

      // Build Google OAuth URL
      const recallRegion = 'eu-central-1';
      const googleScopes = 'https://www.googleapis.com/auth/calendar.events.readonly https://www.googleapis.com/auth/userinfo.email';
      const googleRedirectUri = `https://${recallRegion}.recall.ai/api/v1/calendar/google_oauth_callback/`;
      
      const stateObj = {
        recall_calendar_auth_token: authData.token,
        google_oauth_redirect_url: googleRedirectUri,
        success_url: redirect_uri ? `${redirect_uri}?oauth_success=true&provider=google` : undefined,
        error_url: redirect_uri ? `${redirect_uri}?oauth_error=true&provider=google` : undefined,
      };
      
      const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `scope=${encodeURIComponent(googleScopes)}` +
        `&access_type=offline` +
        `&prompt=consent` +
        `&include_granted_scopes=true` +
        `&response_type=code` +
        `&state=${encodeURIComponent(JSON.stringify(stateObj))}` +
        `&redirect_uri=${encodeURIComponent(googleRedirectUri)}` +
        `&client_id=${GOOGLE_CLIENT_ID || ''}`;
      
      console.log('[GoogleAuth] OAuth URL generated successfully');

      return new Response(
        JSON.stringify({
          success: true,
          user_id: recallUserId,
          oauth_url: oauthUrl,
          token: authData.token,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Helper: Sync default preferences to Recall.ai
    // IMPORTANT: According to Recall.ai docs, for "record all meetings":
    // - record_external: true, record_internal: true = record all meetings
    // - record_non_host: false, record_recurring: false, record_confirmed: false = ignore these filters
    async function syncDefaultPreferences(recallUserId: string): Promise<void> {
      const defaultPreferences = {
        record_non_host: false,      // false = ignore this rule (don't filter by host status)
        record_recurring: false,     // false = ignore this rule (record all, not just recurring)
        record_external: true,       // true = record external meetings
        record_internal: true,       // true = record internal meetings
        record_confirmed: false,     // false = ignore this rule (record unconfirmed too)
        record_only_host: false,     // false = not only host meetings
      };

      console.log('[GoogleAuth] Syncing default preferences to Recall.ai for user:', recallUserId, 'Preferences:', JSON.stringify(defaultPreferences));

      try {
        const response = await fetch(`https://eu-central-1.recall.ai/api/v1/calendar/user/${recallUserId}/preferences/`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Token ${RECALL_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(defaultPreferences),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[GoogleAuth] Failed to sync default preferences:', response.status, errorText);
        } else {
          const result = await response.json();
          console.log('[GoogleAuth] Default preferences synced successfully:', JSON.stringify(result));
        }
      } catch (error) {
        console.error('[GoogleAuth] Error syncing default preferences:', error);
      }
    }

    // ACTION: status - Check Google connection status
    if (action === 'status') {
      const { data: calendarUser, error: fetchError } = await supabase
        .from('recall_calendar_users')
        .select('recall_user_id, google_connected')
        .eq('supabase_user_id', supabaseUserId)
        .maybeSingle();

      if (fetchError) {
        console.error('[GoogleAuth] Error fetching user:', fetchError);
      }

      if (!calendarUser?.recall_user_id) {
        console.log('[GoogleAuth] No Recall user found for Supabase user:', supabaseUserId);
        return new Response(
          JSON.stringify({
            success: true,
            connected: false,
            recall_user_id: null,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const recallUserId = calendarUser.recall_user_id;
      const authToken = await getRecallAuthToken(recallUserId);
      
      if (!authToken) {
        return new Response(
          JSON.stringify({
            success: true,
            connected: false,
            recall_user_id: recallUserId,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { connected: googleConnected, userData } = await checkGoogleConnection(recallUserId, authToken);
      
      console.log('[GoogleAuth] Status check result:', {
        recall_user_id: recallUserId,
        google_connected: googleConnected,
      });

      // If just connected, sync default preferences using Recall internal UUID
      if (googleConnected && !calendarUser.google_connected && userData?.id) {
        console.log('[GoogleAuth] New connection detected, syncing default preferences with UUID:', userData.id);
        await syncDefaultPreferences(userData.id); // Use UUID, not external_id (email)
      }

      // Update database
      const { error: updateError } = await supabase
        .from('recall_calendar_users')
        .update({ google_connected: googleConnected })
        .eq('supabase_user_id', supabaseUserId);

      if (updateError) {
        console.error('[GoogleAuth] Error updating user status:', updateError);
      }

      return new Response(
        JSON.stringify({
          success: true,
          connected: googleConnected,
          recall_user_id: recallUserId,
          user_data: userData,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ACTION: disconnect - Disconnect Google calendar
    if (action === 'disconnect') {
      const { error: updateError } = await supabase
        .from('recall_calendar_users')
        .update({ google_connected: false })
        .eq('supabase_user_id', supabaseUserId);

      if (updateError) {
        console.error('[GoogleAuth] Error updating user after disconnect:', updateError);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Google calendar disconnected',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('[GoogleAuth] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'An error occurred processing your request' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
