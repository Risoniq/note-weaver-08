import { createClient } from "npm:@supabase/supabase-js@2";

// Dynamic CORS headers based on origin
function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const allowedOrigins = [
    Deno.env.get('APP_URL') || '',
    'http://localhost:5173',
    'http://localhost:8080',
    'http://localhost:3000',
  ].filter(Boolean);
  
  // Check if origin matches allowed origins or is a Lovable preview domain
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
    console.error('[Auth] Authentication failed:', authError?.message);
    return { user: null, error: 'Invalid or expired token' };
  }

  return { user: { id: user.id, email: user.email || undefined } };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Authenticate user first
    const { user: authUser, error: authError } = await authenticateUser(req);
    if (!authUser) {
      console.log('[Auth] Authentication failed:', authError);
      return new Response(
        JSON.stringify({ success: false, error: authError || 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Auth] Authenticated user: ${authUser.id}`);

    const RECALL_API_KEY = Deno.env.get('RECALL_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!RECALL_API_KEY) {
      console.error('[Config] RECALL_API_KEY is not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error('[Request] Failed to parse JSON body:', parseError);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { action, supabase_user_id, user_email, provider, redirect_uri } = body;
    
    // 2. Validate that supabase_user_id matches authenticated user
    const providedUserId = supabase_user_id || null;
    if (providedUserId && providedUserId !== authUser.id) {
      console.error(`[Auth] User ID mismatch: provided ${providedUserId} vs authenticated ${authUser.id}`);
      return new Response(
        JSON.stringify({ success: false, error: 'User ID mismatch' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Use the authenticated user's ID
    const supabaseUserId = authUser.id;
    const userEmail = user_email || authUser.email || null;
    
    console.log('Calendar auth request:', { action, supabase_user_id: supabaseUserId, user_email: userEmail, provider, redirect_uri });

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Helper: Get stable Recall user ID - prefer email for consistency with Recall.ai
    function getStableRecallUserId(email: string | null, supabaseId: string): string {
      // Use email if available (most stable across sessions), otherwise fall back to Supabase ID
      return email || supabaseId;
    }

    // Helper function to get or create Recall user for a Supabase user
    async function getOrCreateRecallUser(supabaseUserId: string, userEmail: string | null): Promise<{ recallUserId: string; isNew: boolean }> {
      const stableId = getStableRecallUserId(userEmail, supabaseUserId);
      
      // First, check if we already have a Recall user for this Supabase user
      const { data: existingUser, error: fetchError } = await supabase
        .from('recall_calendar_users')
        .select('recall_user_id')
        .eq('supabase_user_id', supabaseUserId)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching user by supabase_user_id:', fetchError);
      }

      if (existingUser?.recall_user_id) {
        // ALWAYS use the stored recall_user_id - this is the ID that Recall.ai knows
        // It may be a UUID from Recall.ai's system, not an email-based ID
        console.log('Found existing Recall user:', existingUser.recall_user_id);
        return { recallUserId: existingUser.recall_user_id, isNew: false };
      }

      // Create a new Recall user using the stable ID
      const recallUserId = stableId;
      
      const { error: insertError } = await supabase
        .from('recall_calendar_users')
        .insert({ 
          recall_user_id: recallUserId,
          supabase_user_id: supabaseUserId,
        });
      
      if (insertError) {
        // If insert fails due to duplicate, try to fetch again
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
        console.error('Error inserting user:', insertError);
        throw new Error('Failed to create calendar user');
      }

      console.log('Created new Recall user in local DB:', recallUserId);
      // Note: Recall.ai users are created implicitly when they complete OAuth
      // Preferences will be set after successful OAuth connection

      return { recallUserId, isNew: true };
    }

    // Helper: Check connection status with Recall.ai for a given user ID
    async function checkRecallConnections(recallUserId: string, authToken: string): Promise<{ google: boolean; microsoft: boolean; userData: unknown }> {
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
          return { google: false, microsoft: false, userData: null };
        }
        console.error('Recall user status error:', userResponse.status);
        return { google: false, microsoft: false, userData: null };
      }

      const userData = await userResponse.json();
      console.log('Recall user data for', recallUserId, ':', userData);

      let googleConnected = false;
      let microsoftConnected = false;
      
      if (userData.connections && Array.isArray(userData.connections)) {
        for (const conn of userData.connections) {
          if (conn.platform === 'google' && conn.connected) {
            googleConnected = true;
          }
          if (conn.platform === 'microsoft' && conn.connected) {
            microsoftConnected = true;
          }
        }
      } else {
        googleConnected = userData.google_calendar_id !== null;
        microsoftConnected = userData.microsoft_calendar_id !== null;
      }

      return { google: googleConnected, microsoft: microsoftConnected, userData };
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
        console.error('Recall auth token error:', authResponse.status);
        return null;
      }

      const authData = await authResponse.json();
      return authData.token;
    }

    // New action: reset - delete old entry and create fresh one with email-based ID
    if (action === 'reset') {
      console.log('Resetting calendar user for:', supabaseUserId, 'email:', userEmail);

      // Delete existing entry
      const { error: deleteError } = await supabase
        .from('recall_calendar_users')
        .delete()
        .eq('supabase_user_id', supabaseUserId);

      if (deleteError) {
        console.error('Error deleting user:', deleteError);
      }

      // Create fresh entry with email-based ID
      const stableId = getStableRecallUserId(userEmail, supabaseUserId);
      
      const { error: insertError } = await supabase
        .from('recall_calendar_users')
        .insert({ 
          recall_user_id: stableId,
          supabase_user_id: supabaseUserId,
          google_connected: false,
          microsoft_connected: false,
        });

      if (insertError) {
        console.error('Error creating fresh user:', insertError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to reset calendar user' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Reset complete, new recall_user_id:', stableId);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Calendar user reset successfully',
          recall_user_id: stableId,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'authenticate') {
      // Get the existing recall user ID from the database - DO NOT reset it
      // The recall_user_id stored in the DB is the one that Recall.ai knows about
      const { data: existingUser } = await supabase
        .from('recall_calendar_users')
        .select('recall_user_id')
        .eq('supabase_user_id', supabaseUserId)
        .maybeSingle();

      let recallUserId: string;
      
      if (existingUser?.recall_user_id) {
        // Use the stored recall_user_id - this is the ID Recall.ai knows
        recallUserId = existingUser.recall_user_id;
        console.log('Using existing Recall user ID:', recallUserId);
      } else {
        // Only create new if no existing record
        const result = await getOrCreateRecallUser(supabaseUserId, userEmail);
        recallUserId = result.recallUserId;
        console.log('Created new Recall user ID:', recallUserId);
      }

      // Get authentication token from Recall.ai
      const authResponse = await fetch('https://eu-central-1.recall.ai/api/v1/calendar/authenticate/', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${RECALL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: recallUserId,
        }),
      });

      if (!authResponse.ok) {
        console.error('Recall auth error:', authResponse.status);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to get calendar auth token' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const authData = await authResponse.json();
      console.log('[authenticate] Recall auth token received for user:', recallUserId);

      // Build the OAuth URL
      const recallRegion = 'eu-central-1';
      let oauthUrl: string;
      let debugInfo: Record<string, string> = {};
      
      if (provider === 'microsoft') {
        const msClientId = (Deno.env.get('MS_OAUTH_CLIENT_ID') || '').trim();
        if (!msClientId) {
          return new Response(
            JSON.stringify({ success: false, error: 'Microsoft OAuth not configured' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const msScopes = 'offline_access openid email https://graph.microsoft.com/Calendars.Read';
        const msRedirectUri = `https://${recallRegion}.recall.ai/api/v1/calendar/ms_oauth_callback/`;

        const looksLikeGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(msClientId);
        if (!looksLikeGuid) {
          console.error('MS_OAUTH_CLIENT_ID does not look like a GUID');
          return new Response(
            JSON.stringify({ success: false, error: 'Microsoft OAuth misconfigured' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const stateObj = {
          recall_calendar_auth_token: authData.token,
          ms_oauth_redirect_url: msRedirectUri,
          success_url: redirect_uri ? `${redirect_uri}?oauth_success=true&provider=microsoft` : undefined,
          error_url: redirect_uri ? `${redirect_uri}?oauth_error=true&provider=microsoft` : undefined,
        };
        
        oauthUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
          `scope=${encodeURIComponent(msScopes)}` +
          `&response_mode=query` +
          `&response_type=code` +
          `&prompt=select_account` +
          `&state=${encodeURIComponent(JSON.stringify(stateObj))}` +
          `&redirect_uri=${encodeURIComponent(msRedirectUri)}` +
          `&client_id=${encodeURIComponent(msClientId)}`;
        
        debugInfo = {
          provider: 'microsoft',
          recall_host: `${recallRegion}.recall.ai`,
          redirect_uri: msRedirectUri,
          app_callback: redirect_uri || 'none',
          client_id_prefix: msClientId.substring(0, 8) + '...',
          scopes: msScopes,
        };
        
        console.log('[authenticate] Microsoft OAuth config:', debugInfo);
      } else {
        const googleScopes = 'https://www.googleapis.com/auth/calendar.events.readonly https://www.googleapis.com/auth/userinfo.email';
        const googleRedirectUri = `https://${recallRegion}.recall.ai/api/v1/calendar/google_oauth_callback/`;
        
        const stateObj = {
          recall_calendar_auth_token: authData.token,
          google_oauth_redirect_url: googleRedirectUri,
          success_url: redirect_uri ? `${redirect_uri}?oauth_success=true&provider=google` : undefined,
          error_url: redirect_uri ? `${redirect_uri}?oauth_error=true&provider=google` : undefined,
        };
        
        oauthUrl = `https://accounts.google.com/o/oauth2/v2.auth?` +
          `scope=${encodeURIComponent(googleScopes)}` +
          `&access_type=offline` +
          `&prompt=consent` +
          `&include_granted_scopes=true` +
          `&response_type=code` +
          `&state=${encodeURIComponent(JSON.stringify(stateObj))}` +
          `&redirect_uri=${encodeURIComponent(googleRedirectUri)}` +
          `&client_id=${Deno.env.get('GOOGLE_CLIENT_ID') || ''}`;
        
        debugInfo = {
          provider: 'google',
          recall_host: `${recallRegion}.recall.ai`,
          redirect_uri: googleRedirectUri,
          app_callback: redirect_uri || 'none',
          scopes: googleScopes,
        };
        
        console.log('[authenticate] Google OAuth config:', debugInfo);
      }
      
      console.log('[authenticate] OAuth URL generated successfully');

      return new Response(
        JSON.stringify({
          success: true,
          user_id: recallUserId,
          oauth_url: oauthUrl,
          token: authData.token,
          debug: debugInfo,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'status') {
      // Look up the Recall user ID for this Supabase user
      const { data: calendarUser, error: fetchError } = await supabase
        .from('recall_calendar_users')
        .select('recall_user_id, google_connected, microsoft_connected')
        .eq('supabase_user_id', supabaseUserId)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching user:', fetchError);
      }

      if (!calendarUser?.recall_user_id) {
        console.log('No Recall user found for Supabase user:', supabaseUserId);
        return new Response(
          JSON.stringify({
            success: true,
            connected: false,
            google_connected: false,
            microsoft_connected: false,
            needs_repair: false,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const recallUserId = calendarUser.recall_user_id;

      // Get a fresh auth token for this user
      const authToken = await getRecallAuthToken(recallUserId);
      if (!authToken) {
        return new Response(
          JSON.stringify({
            success: true,
            connected: false,
            google_connected: false,
            microsoft_connected: false,
            needs_repair: false,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check connections
      const { google: googleConnected, microsoft: microsoftConnected, userData } = await checkRecallConnections(recallUserId, authToken);
      
      console.log('[status] Connection check result:', {
        recall_user_id: recallUserId,
        google_connected: googleConnected,
        microsoft_connected: microsoftConnected,
        has_user_data: !!userData,
      });

      // Check if we might need repair - if email-based ID would be different
      const expectedId = getStableRecallUserId(userEmail, supabaseUserId);
      const needsRepair = userEmail && recallUserId !== expectedId;

      // Update our database
      const { error: updateError } = await supabase
        .from('recall_calendar_users')
        .update({
          google_connected: googleConnected,
          microsoft_connected: microsoftConnected,
        })
        .eq('supabase_user_id', supabaseUserId);

      if (updateError) {
        console.error('Error updating user status:', updateError);
      }

      return new Response(
        JSON.stringify({
          success: true,
          connected: googleConnected || microsoftConnected,
          google_connected: googleConnected,
          microsoft_connected: microsoftConnected,
          user_data: userData,
          recall_user_id: recallUserId,
          needs_repair: needsRepair,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // New action: debug_connections - fetch raw connection data from Recall.ai for diagnostics
    if (action === 'debug_connections') {
      console.log('[debug_connections] Starting debug for user:', supabaseUserId);
      
      // Get our stored Recall user
      const { data: calendarUser } = await supabase
        .from('recall_calendar_users')
        .select('recall_user_id, google_connected, microsoft_connected')
        .eq('supabase_user_id', supabaseUserId)
        .maybeSingle();

      if (!calendarUser?.recall_user_id) {
        return new Response(
          JSON.stringify({
            success: true,
            debug: {
              has_local_user: false,
              recall_user_id: null,
              local_google_connected: false,
              local_microsoft_connected: false,
              recall_api_response: null,
              recall_connections: [],
              timestamp: new Date().toISOString(),
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const recallUserId = calendarUser.recall_user_id;
      
      // Get a fresh auth token
      const authToken = await getRecallAuthToken(recallUserId);
      
      let recallApiResponse = null;
      let recallConnections: Array<{platform: string; connected: boolean; email: string | null}> = [];
      let recallError = null;
      
      if (authToken) {
        try {
          const userResponse = await fetch(`https://eu-central-1.recall.ai/api/v1/calendar/user/?user_id=${recallUserId}`, {
            method: 'GET',
            headers: {
              'Authorization': `Token ${RECALL_API_KEY}`,
              'x-recallcalendarauthtoken': authToken,
              'Content-Type': 'application/json',
            },
          });
          
          if (userResponse.ok) {
            recallApiResponse = await userResponse.json();
            
            if (recallApiResponse.connections && Array.isArray(recallApiResponse.connections)) {
              recallConnections = recallApiResponse.connections.map((c: any) => ({
                platform: c.platform,
                connected: c.connected,
                email: c.email || null,
              }));
            }
          } else {
            recallError = `HTTP ${userResponse.status}: ${userResponse.statusText}`;
          }
        } catch (e: any) {
          recallError = e.message;
        }
      } else {
        recallError = 'Could not obtain auth token from Recall.ai';
      }

      console.log('[debug_connections] Result:', {
        recall_user_id: recallUserId,
        local_google: calendarUser.google_connected,
        local_microsoft: calendarUser.microsoft_connected,
        recall_connections: recallConnections,
        recall_error: recallError,
      });

      return new Response(
        JSON.stringify({
          success: true,
          debug: {
            has_local_user: true,
            recall_user_id: recallUserId,
            local_google_connected: calendarUser.google_connected,
            local_microsoft_connected: calendarUser.microsoft_connected,
            recall_connections: recallConnections,
            recall_google_connected: recallConnections.some(c => c.platform === 'google' && c.connected),
            recall_microsoft_connected: recallConnections.some(c => c.platform === 'microsoft' && c.connected),
            recall_error: recallError,
            timestamp: new Date().toISOString(),
            user_email: userEmail,
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // New action: repair - try to find and link to an existing Recall user with connections
    if (action === 'repair') {
      const targetRecallUserId = body.target_recall_user_id;
      if (!targetRecallUserId) {
        return new Response(
          JSON.stringify({ success: false, error: 'target_recall_user_id is required for repair' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Attempting to repair connection:', { supabaseUserId, targetRecallUserId });

      // Get auth token for the target Recall user
      const authToken = await getRecallAuthToken(targetRecallUserId);
      if (!authToken) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Could not authenticate with target Recall user',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if target has connections
      const { google, microsoft } = await checkRecallConnections(targetRecallUserId, authToken);

      if (!google && !microsoft) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Target Recall user has no active connections',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update the database to use the target Recall user ID
      const { error: updateError } = await supabase
        .from('recall_calendar_users')
        .update({
          recall_user_id: targetRecallUserId,
          google_connected: google,
          microsoft_connected: microsoft,
        })
        .eq('supabase_user_id', supabaseUserId);

      if (updateError) {
        console.error('Error updating user during repair:', updateError);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Failed to update user mapping',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Repair successful:', { supabaseUserId, targetRecallUserId, google, microsoft });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Connection repaired successfully',
          google_connected: google,
          microsoft_connected: microsoft,
          recall_user_id: targetRecallUserId,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'disconnect_provider') {
      if (!provider) {
        return new Response(
          JSON.stringify({ success: false, error: 'provider is required for disconnect_provider' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: userData, error: fetchError } = await supabase
        .from('recall_calendar_users')
        .select('recall_user_id, google_connected, microsoft_connected')
        .eq('supabase_user_id', supabaseUserId)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching user:', fetchError);
      }

      const updateData = provider === 'google' 
        ? { google_connected: false }
        : { microsoft_connected: false };

      const { error: updateError } = await supabase
        .from('recall_calendar_users')
        .update(updateData)
        .eq('supabase_user_id', supabaseUserId);

      if (updateError) {
        console.error('Error updating user after disconnect:', updateError);
      }

      const stillConnected = provider === 'google' 
        ? userData?.microsoft_connected 
        : userData?.google_connected;

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `${provider} calendar disconnected`,
          still_connected: stillConnected,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'disconnect') {
      const { data: calendarUser } = await supabase
        .from('recall_calendar_users')
        .select('recall_user_id')
        .eq('supabase_user_id', supabaseUserId)
        .maybeSingle();

      if (calendarUser?.recall_user_id) {
        const authToken = await getRecallAuthToken(calendarUser.recall_user_id);

        if (authToken) {
          const disconnectResponse = await fetch(`https://eu-central-1.recall.ai/api/v1/calendar/user/?user_id=${calendarUser.recall_user_id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Token ${RECALL_API_KEY}`,
              'x-recallcalendarauthtoken': authToken,
            },
          });

          if (!disconnectResponse.ok && disconnectResponse.status !== 404) {
            console.error('Recall disconnect error:', disconnectResponse.status);
          }
        }
      }

      const { error: updateError } = await supabase
        .from('recall_calendar_users')
        .update({
          google_connected: false,
          microsoft_connected: false,
        })
        .eq('supabase_user_id', supabaseUserId);

      if (updateError) {
        console.error('Error updating user after disconnect:', updateError);
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Calendar disconnected' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Calendar auth error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'An error occurred processing your request' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
