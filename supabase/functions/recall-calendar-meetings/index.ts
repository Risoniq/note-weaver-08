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

    const { action, user_id, meeting_id, auto_record } = await req.json();
    console.log('Calendar meetings request:', { action, user_id, meeting_id, auto_record });

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    if (action === 'list') {
      if (!user_id) {
        throw new Error('user_id is required');
      }

      // Get upcoming meetings from Recall.ai
      const meetingsResponse = await fetch(
        `https://us-west-2.recall.ai/api/v1/calendar/meetings/?user_id=${user_id}&start_time__gte=${new Date().toISOString()}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Token ${RECALL_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!meetingsResponse.ok) {
        const errorText = await meetingsResponse.text();
        console.error('Recall meetings error:', meetingsResponse.status, errorText);
        throw new Error(`Failed to fetch meetings: ${errorText}`);
      }

      const meetingsData = await meetingsResponse.json();
      console.log('Recall meetings:', meetingsData);

      // Transform meetings to our format
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
      if (!user_id || !meeting_id) {
        throw new Error('user_id and meeting_id are required');
      }

      // Update recording preference for a specific meeting
      const updateResponse = await fetch(
        `https://us-west-2.recall.ai/api/v1/calendar/meetings/${meeting_id}/`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Token ${RECALL_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            override_should_record: auto_record,
          }),
        }
      );

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        console.error('Recall update meeting error:', updateResponse.status, errorText);
        throw new Error(`Failed to update meeting: ${errorText}`);
      }

      const updatedMeeting = await updateResponse.json();
      console.log('Updated meeting:', updatedMeeting);

      return new Response(
        JSON.stringify({ success: true, meeting: updatedMeeting }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'update_preferences') {
      if (!user_id) {
        throw new Error('user_id is required');
      }

      // Get the current user from our database
      const { data: userData, error: userError } = await supabase
        .from('recall_calendar_users')
        .select('*')
        .eq('recall_user_id', user_id)
        .maybeSingle();

      if (userError) {
        console.error('Error fetching user:', userError);
        throw new Error('Failed to fetch user');
      }

      // Merge with existing preferences
      const currentPrefs = userData?.recording_preferences || {};
      const newPrefs = { ...currentPrefs, ...auto_record };

      // Update preferences in our database
      const { error: updateError } = await supabase
        .from('recall_calendar_users')
        .update({ recording_preferences: newPrefs })
        .eq('recall_user_id', user_id);

      if (updateError) {
        console.error('Error updating preferences:', updateError);
        throw new Error('Failed to update preferences');
      }

      return new Response(
        JSON.stringify({ success: true, preferences: newPrefs }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error: unknown) {
    console.error('Calendar meetings error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
