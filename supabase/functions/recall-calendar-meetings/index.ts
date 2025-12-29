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

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
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

    const body = await req.json();
    // Support both old (user_id) and new (supabase_user_id) parameters
    const { action, supabase_user_id, user_id: legacyUserId, meeting_id, auto_record } = body;
    const supabaseUserId = supabase_user_id || null;
    
    console.log('Calendar meetings request:', { action, supabase_user_id: supabaseUserId, meeting_id, auto_record });

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Helper function to get Recall user ID from Supabase user ID
    async function getRecallUserId(supabaseUserId: string): Promise<string | null> {
      const { data, error } = await supabase
        .from('recall_calendar_users')
        .select('recall_user_id')
        .eq('supabase_user_id', supabaseUserId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching recall user:', error);
        return null;
      }

      return data?.recall_user_id || null;
    }

    if (action === 'list') {
      if (!supabaseUserId) {
        throw new Error('supabase_user_id is required');
      }

      const recallUserId = await getRecallUserId(supabaseUserId);
      if (!recallUserId) {
        console.log('No Recall user found for Supabase user:', supabaseUserId);
        return new Response(
          JSON.stringify({ success: true, meetings: [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get a fresh calendar auth token for this user
      const authResponse = await fetch('https://us-west-2.recall.ai/api/v1/calendar/authenticate/', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${RECALL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: recallUserId }),
      });

      if (!authResponse.ok) {
        console.error('[Internal] Recall auth token error:', authResponse.status, await authResponse.text());
        throw new Error('Failed to authenticate with calendar service');
      }

      const authData = await authResponse.json();

      // Get upcoming meetings from Recall.ai
      const meetingsResponse = await fetch(
        `https://us-west-2.recall.ai/api/v1/calendar/meetings/?user_id=${recallUserId}&start_time__gte=${new Date().toISOString()}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Token ${RECALL_API_KEY}`,
            'x-recallcalendarauthtoken': authData.token,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!meetingsResponse.ok) {
        console.error('[Internal] Recall meetings error:', meetingsResponse.status, await meetingsResponse.text());
        throw new Error('Failed to fetch meetings');
      }

      const meetingsData = await meetingsResponse.json();
      console.log('Recall meetings:', meetingsData);

      const meetings = (meetingsData.results || []).map((meeting: any) => ({
        id: meeting.id,
        title: meeting.title || 'Untitled Meeting',
        start_time: meeting.start_time,
        end_time: meeting.end_time,
        meeting_url: meeting.meeting_url,
        platform: meeting.platform,
        bot_id: meeting.bot_id,
        will_record: meeting.bot_id !== null,
        override_should_record: meeting.override_should_record,
        attendees: meeting.attendees || [],
        organizer: meeting.organizer,
        is_organizer: meeting.is_organizer,
      }));

      return new Response(
        JSON.stringify({ success: true, meetings }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'update_recording') {
      if (!supabaseUserId || !meeting_id) {
        throw new Error('supabase_user_id and meeting_id are required');
      }

      const recallUserId = await getRecallUserId(supabaseUserId);
      if (!recallUserId) {
        throw new Error('No Recall user found');
      }

      const authResponse = await fetch('https://us-west-2.recall.ai/api/v1/calendar/authenticate/', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${RECALL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: recallUserId }),
      });

      if (!authResponse.ok) {
        console.error('[Internal] Recall auth token error:', authResponse.status, await authResponse.text());
        throw new Error('Failed to authenticate with calendar service');
      }

      const authData = await authResponse.json();

      const updateResponse = await fetch(
        `https://us-west-2.recall.ai/api/v1/calendar/meetings/${meeting_id}/`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Token ${RECALL_API_KEY}`,
            'x-recallcalendarauthtoken': authData.token,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            override_should_record: auto_record,
          }),
        }
      );

      if (!updateResponse.ok) {
        console.error('[Internal] Recall update meeting error:', updateResponse.status, await updateResponse.text());
        throw new Error('Failed to update meeting');
      }

      const updatedMeeting = await updateResponse.json();
      console.log('Updated meeting:', updatedMeeting);

      return new Response(
        JSON.stringify({ success: true, meeting: updatedMeeting }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'update_preferences') {
      if (!supabaseUserId) {
        throw new Error('supabase_user_id is required');
      }

      const { data: userData, error: userError } = await supabase
        .from('recall_calendar_users')
        .select('*')
        .eq('supabase_user_id', supabaseUserId)
        .maybeSingle();

      if (userError) {
        console.error('Error fetching user:', userError);
        throw new Error('Failed to fetch user');
      }

      const currentPrefs = userData?.recording_preferences || {};
      const newPrefs = { ...currentPrefs, ...auto_record };

      const { error: updateError } = await supabase
        .from('recall_calendar_users')
        .update({ recording_preferences: newPrefs })
        .eq('supabase_user_id', supabaseUserId);

      if (updateError) {
        console.error('Error updating preferences:', updateError);
        throw new Error('Failed to update preferences');
      }

      // Sync preferences to Recall.ai
      const recallUserId = await getRecallUserId(supabaseUserId);
      if (recallUserId) {
        const recallPreferences = {
          record_non_host: newPrefs.record_all ?? true,
          record_recurring: true,
          record_external: newPrefs.record_external ?? true,
          record_internal: true,
          record_confirmed: true,
          record_only_host: newPrefs.record_only_owned ?? false,
        };

        console.log('Syncing preferences to Recall.ai:', recallPreferences);

        const recallResponse = await fetch(`https://us-west-2.recall.ai/api/v1/calendar/user/${recallUserId}/preferences/`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Token ${RECALL_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(recallPreferences),
        });

        if (!recallResponse.ok) {
          const errorText = await recallResponse.text();
          console.error('Failed to sync preferences to Recall.ai:', recallResponse.status, errorText);
          // Don't throw - we still saved locally
        } else {
          console.log('Preferences synced to Recall.ai successfully');
        }
      }

      return new Response(
        JSON.stringify({ success: true, preferences: newPrefs }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Unknown action');
  } catch (error: unknown) {
    console.error('[Internal] Calendar meetings error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'An error occurred processing your request' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});