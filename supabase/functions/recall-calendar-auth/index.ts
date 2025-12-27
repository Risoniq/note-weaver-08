import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RECALL_API_KEY = Deno.env.get('RECALL_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!RECALL_API_KEY) {
      throw new Error('RECALL_API_KEY is not configured');
    }

    const { action, user_id, provider } = await req.json();
    console.log('Calendar auth request:', { action, user_id, provider });

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    if (action === 'authenticate') {
      // Generate a unique user_id if not provided
      const recallUserId = user_id || crypto.randomUUID();
      
      // Create or update the calendar user in our database
      const { data: existingUser, error: fetchError } = await supabase
        .from('recall_calendar_users')
        .select('*')
        .eq('recall_user_id', recallUserId)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching user:', fetchError);
      }

      if (!existingUser) {
        const { error: insertError } = await supabase
          .from('recall_calendar_users')
          .insert({ recall_user_id: recallUserId });
        
        if (insertError) {
          console.error('Error inserting user:', insertError);
          throw new Error('Failed to create calendar user');
        }
      }

      // Get authentication token from Recall.ai
      const authResponse = await fetch('https://us-west-2.recall.ai/api/v1/calendar/authenticate/', {
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
        const errorText = await authResponse.text();
        console.error('Recall auth error:', authResponse.status, errorText);
        throw new Error(`Failed to get calendar auth token: ${errorText}`);
      }

      const authData = await authResponse.json();
      console.log('Recall auth response:', authData);

      // Build the OAuth URL based on provider
      const oauthProvider = provider === 'microsoft' ? 'microsoft' : 'google';
      const oauthUrl = `https://us-west-2.recall.ai/api/v1/calendar/${oauthProvider}/authorize/?token=${authData.token}`;

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

    if (action === 'status') {
      // Check connection status for a user
      if (!user_id) {
        throw new Error('user_id is required for status check');
      }

      // First, get a fresh auth token for this user
      const authResponse = await fetch('https://us-west-2.recall.ai/api/v1/calendar/authenticate/', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${RECALL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user_id,
        }),
      });

      if (!authResponse.ok) {
        const errorText = await authResponse.text();
        console.error('Recall auth token error:', authResponse.status, errorText);
        // If we can't get a token, user probably doesn't exist yet
        return new Response(
          JSON.stringify({
            success: true,
            connected: false,
            google_connected: false,
            microsoft_connected: false,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const authData = await authResponse.json();
      console.log('Got auth token for status check');

      // Get user status from Recall.ai using the calendar auth token
      // Some Recall endpoints accept the token in different header names; we send both for compatibility.
      const userResponse = await fetch(`https://us-west-2.recall.ai/api/v1/calendar/user/?user_id=${user_id}`, {
        method: 'GET',
        headers: {
          'x-recallcalendarauthtoken': authData.token,
          'x-recall-calendar-auth-token': authData.token,
          'Authorization': `Bearer ${authData.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!userResponse.ok) {
        if (userResponse.status === 404) {
          return new Response(
            JSON.stringify({
              success: true,
              connected: false,
              google_connected: false,
              microsoft_connected: false,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const errorText = await userResponse.text();
        console.error('Recall user status error:', userResponse.status, errorText);
        throw new Error(`Failed to get user status: ${errorText}`);
      }

      const userData = await userResponse.json();
      console.log('Recall user data:', userData);

      const googleConnected = userData.google_calendar_id !== null;
      const microsoftConnected = userData.microsoft_calendar_id !== null;

      // Update our database
      const { error: updateError } = await supabase
        .from('recall_calendar_users')
        .update({
          google_connected: googleConnected,
          microsoft_connected: microsoftConnected,
        })
        .eq('recall_user_id', user_id);

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
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'disconnect') {
      if (!user_id) {
        throw new Error('user_id is required for disconnect');
      }

      // First get a token for this user
      const authResponse = await fetch('https://us-west-2.recall.ai/api/v1/calendar/authenticate/', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${RECALL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user_id,
        }),
      });

      if (authResponse.ok) {
        const authData = await authResponse.json();
        
        // Disconnect from Recall.ai using the calendar auth token
        const disconnectResponse = await fetch(`https://us-west-2.recall.ai/api/v1/calendar/user/?user_id=${user_id}`, {
          method: 'DELETE',
          headers: {
            'x-recallcalendarauthtoken': authData.token,
            'x-recall-calendar-auth-token': authData.token,
            'Authorization': `Bearer ${authData.token}`,
          },
        });

        if (!disconnectResponse.ok && disconnectResponse.status !== 404) {
          const errorText = await disconnectResponse.text();
          console.error('Recall disconnect error:', disconnectResponse.status, errorText);
        }
      }

      // Update our database
      const { error: updateError } = await supabase
        .from('recall_calendar_users')
        .update({
          google_connected: false,
          microsoft_connected: false,
        })
        .eq('recall_user_id', user_id);

      if (updateError) {
        console.error('Error updating user after disconnect:', updateError);
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Calendar disconnected' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error: unknown) {
    console.error('Calendar auth error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
