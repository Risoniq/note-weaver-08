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

// Authenticate user from JWT token
async function authenticateUser(req: Request): Promise<{ user: { id: string } | null; error?: string }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return { user: null, error: 'Authorization header required' };
  }
  
  const token = authHeader.replace('Bearer ', '');
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
  
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { user: null, error: 'Server configuration error' };
  }
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    return { user: null, error: 'Invalid or expired token' };
  }
  
  return { user: { id: user.id } };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user first
    const { user, error: authError } = await authenticateUser(req);
    if (!user) {
      console.log('Authentication failed:', authError);
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const RECALL_API_KEY = Deno.env.get('RECALL_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!RECALL_API_KEY) {
      throw new Error('RECALL_API_KEY is not configured');
    }

    const body = await req.json();
    const { action, supabase_user_id, meeting_id, auto_record } = body;
    
    // Validate that the provided user_id matches the authenticated user
    if (supabase_user_id && supabase_user_id !== user.id) {
      console.log('User ID mismatch:', { provided: supabase_user_id, authenticated: user.id });
      return new Response(
        JSON.stringify({ success: false, error: 'Forbidden' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Always use the authenticated user's ID
    const supabaseUserId = user.id;
    
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
      // supabaseUserId is always set from authenticated user

      const recallUserId = await getRecallUserId(supabaseUserId);
      if (!recallUserId) {
        console.log('No Recall user found for Supabase user:', supabaseUserId);
        return new Response(
          JSON.stringify({ success: true, meetings: [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get a fresh calendar auth token for this user
      const authResponse = await fetch('https://eu-central-1.recall.ai/api/v1/calendar/authenticate/', {
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
        `https://eu-central-1.recall.ai/api/v1/calendar/meetings/?user_id=${recallUserId}&start_time__gte=${new Date().toISOString()}`,
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

      // Helper function to extract meeting URL from various sources
      const extractMeetingUrl = (meeting: any): string | null => {
        // Direct meeting_url if available
        if (meeting.meeting_url) {
          return meeting.meeting_url;
        }
        
        // Microsoft Teams: Build URL from teams_invite
        if (meeting.teams_invite?.meeting_id) {
          const password = meeting.teams_invite.meeting_password || '';
          return `https://teams.live.com/meet/${meeting.teams_invite.meeting_id}${password ? `?p=${password}` : ''}`;
        }
        
        // Zoom: Build URL from zoom_invite
        if (meeting.zoom_invite?.meeting_id) {
          return `https://zoom.us/j/${meeting.zoom_invite.meeting_id}`;
        }
        
        // Google Meet: Build URL from meet_invite
        if (meeting.meet_invite?.meeting_code) {
          return `https://meet.google.com/${meeting.meet_invite.meeting_code}`;
        }
        
        // WebEx: Build URL from webex_invite
        if (meeting.webex_invite?.meeting_link) {
          return meeting.webex_invite.meeting_link;
        }
        
        // GoTo Meeting: Build URL from goto_meeting_invite
        if (meeting.goto_meeting_invite?.meeting_id) {
          return `https://www.gotomeet.me/${meeting.goto_meeting_invite.meeting_id}`;
        }
        
        // Fallback: Try to extract from description HTML
        if (meeting.description) {
          // Look for Teams meeting link
          const teamsMatch = meeting.description.match(/href="(https:\/\/teams\.(microsoft|live)\.com\/[^"]+)"/);
          if (teamsMatch) return teamsMatch[1];
          
          // Look for Zoom link
          const zoomMatch = meeting.description.match(/href="(https:\/\/[\w.]*zoom\.us\/[^"]+)"/);
          if (zoomMatch) return zoomMatch[1];
          
          // Look for Google Meet link
          const meetMatch = meeting.description.match(/href="(https:\/\/meet\.google\.com\/[^"]+)"/);
          if (meetMatch) return meetMatch[1];
        }
        
        return null;
      };

      const meetings = (meetingsData.results || []).map((meeting: any) => {
        const meetingUrl = extractMeetingUrl(meeting);
        return {
          id: meeting.id,
          title: meeting.title || 'Untitled Meeting',
          start_time: meeting.start_time,
          end_time: meeting.end_time,
          meeting_url: meetingUrl,
          platform: meeting.meeting_platform || meeting.platform,
          bot_id: meeting.bot_id,
          will_record: meeting.will_record ?? (meeting.bot_id !== null),
          override_should_record: meeting.override_should_record,
          attendees: meeting.attendees || [],
          organizer: meeting.organizer_email || meeting.organizer,
          is_organizer: meeting.is_hosted_by_me ?? meeting.is_organizer,
        };
      });

      return new Response(
        JSON.stringify({ success: true, meetings }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'update_recording') {
      if (!meeting_id) {
        throw new Error('meeting_id is required');
      }

      const recallUserId = await getRecallUserId(supabaseUserId);
      if (!recallUserId) {
        throw new Error('No Recall user found');
      }

      const authResponse = await fetch('https://eu-central-1.recall.ai/api/v1/calendar/authenticate/', {
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
        `https://eu-central-1.recall.ai/api/v1/calendar/meetings/${meeting_id}/`,
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

    // Helper to get Recall.ai internal UUID from external_id
    async function getRecallInternalId(externalId: string): Promise<string | null> {
      try {
        const response = await fetch(`https://eu-central-1.recall.ai/api/v1/calendar/user/${externalId}/`, {
          headers: { 'Authorization': `Token ${RECALL_API_KEY}` },
        });
        if (!response.ok) {
          console.error('[Internal] Failed to get Recall user:', response.status);
          return null;
        }
        const userData = await response.json();
        return userData.id || null; // UUID
      } catch (error) {
        console.error('[Internal] Error getting Recall user:', error);
        return null;
      }
    }

    // Helper to sync preferences to Recall.ai using internal UUID
    async function syncPreferencesToRecall(recallInternalId: string, prefs: any): Promise<boolean> {
      const recallPreferences = {
        record_non_host: prefs.record_all ?? true,
        record_recurring: true,
        record_external: prefs.record_external ?? true,
        record_internal: true,
        record_confirmed: true,
        record_only_host: prefs.record_only_owned ?? false,
      };

      console.log('[Internal] Syncing preferences to Recall.ai UUID:', recallInternalId, recallPreferences);

      try {
        const response = await fetch(`https://eu-central-1.recall.ai/api/v1/calendar/user/${recallInternalId}/preferences/`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Token ${RECALL_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(recallPreferences),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Internal] Failed to sync preferences:', response.status, errorText);
          return false;
        }
        console.log('[Internal] Preferences synced successfully');
        return true;
      } catch (error) {
        console.error('[Internal] Error syncing preferences:', error);
        return false;
      }
    }

    if (action === 'init_preferences') {
      // Initialize/repair preferences with correct Recall.ai UUID
      const recallUserId = await getRecallUserId(supabaseUserId);
      if (!recallUserId) {
        return new Response(
          JSON.stringify({ success: false, error: 'No calendar connected' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get Recall internal UUID
      const recallInternalId = await getRecallInternalId(recallUserId);
      if (!recallInternalId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Could not fetch Recall user' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Set default preferences
      const defaultPrefs = {
        record_all: true,
        record_only_owned: false,
        record_external: true,
        auto_record: true,
      };

      // Sync to Recall.ai with correct UUID
      const synced = await syncPreferencesToRecall(recallInternalId, defaultPrefs);

      // Also update local database
      await supabase
        .from('recall_calendar_users')
        .update({ recording_preferences: defaultPrefs })
        .eq('supabase_user_id', supabaseUserId);

      return new Response(
        JSON.stringify({ 
          success: synced, 
          preferences: defaultPrefs,
          recall_internal_id: recallInternalId,
          message: synced ? 'Preferences initialized successfully' : 'Failed to sync to Recall.ai'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'update_preferences') {
      // supabaseUserId is always set from authenticated user

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
      const newPrefs = { ...currentPrefs, ...body.preferences };

      const { error: updateError } = await supabase
        .from('recall_calendar_users')
        .update({ recording_preferences: newPrefs })
        .eq('supabase_user_id', supabaseUserId);

      if (updateError) {
        console.error('Error updating preferences:', updateError);
        throw new Error('Failed to update preferences');
      }

      // Sync preferences to Recall.ai - get internal UUID first
      const recallUserId = await getRecallUserId(supabaseUserId);
      if (recallUserId) {
        const recallInternalId = await getRecallInternalId(recallUserId);
        if (recallInternalId) {
          await syncPreferencesToRecall(recallInternalId, newPrefs);
        } else {
          console.error('[Internal] Could not get Recall internal ID for sync');
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