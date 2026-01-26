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

      // Get meetings including those that started up to 2 hours ago (for ongoing meetings)
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      console.log('[list] Fetching meetings since:', twoHoursAgo);
      
      const meetingsResponse = await fetch(
        `https://eu-central-1.recall.ai/api/v1/calendar/meetings/?user_id=${recallUserId}&start_time__gte=${twoHoursAgo}`,
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

      // Recall.ai may return either a paginated object { results: [...] } or a raw array [...]
      const meetingItems: any[] = Array.isArray(meetingsData)
        ? meetingsData
        : (meetingsData?.results || []);

      console.log('Recall meetings count:', meetingItems.length);

      // Helper: Decode HTML entities
      const decodeHtmlEntities = (text: string): string => {
        return text
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&#x27;/g, "'")
          .replace(/&#x2F;/g, '/')
          .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
          .replace(/\\"/g, '"')
          .replace(/\\\//g, '/');
      };

      // Helper: Safely decode URI components
      const safeDecodeURI = (text: string): string => {
        try {
          return decodeURIComponent(text);
        } catch {
          return text;
        }
      };

      // Helper function to extract meeting URL from various sources
      const extractMeetingUrl = (meeting: any): string | null => {
        // Log full meeting object for debugging
        console.log('[extractUrl] Meeting:', meeting.title, 'Keys:', Object.keys(meeting));
        if (meeting.raw) {
          console.log('[extractUrl] Raw keys:', Object.keys(meeting.raw));
        }

        // Direct meeting_url if available
        if (meeting.meeting_url) {
          console.log('[extractUrl] Found direct meeting_url:', meeting.meeting_url);
          return meeting.meeting_url;
        }
        
        // Direct join_url if available
        if (meeting.join_url) {
          console.log('[extractUrl] Found direct join_url:', meeting.join_url);
          return meeting.join_url;
        }
        
        // Microsoft Teams: Build URL from teams_invite
        if (meeting.teams_invite?.meeting_id) {
          const password = meeting.teams_invite.meeting_password || '';
          const url = `https://teams.live.com/meet/${meeting.teams_invite.meeting_id}${password ? `?p=${password}` : ''}`;
          console.log('[extractUrl] Built Teams URL from invite:', url);
          return url;
        }
        
        // Zoom: Build URL from zoom_invite
        if (meeting.zoom_invite?.meeting_id) {
          const url = `https://zoom.us/j/${meeting.zoom_invite.meeting_id}`;
          console.log('[extractUrl] Built Zoom URL from invite:', url);
          return url;
        }
        
        // Google Meet: Build URL from meet_invite
        if (meeting.meet_invite?.meeting_code) {
          const url = `https://meet.google.com/${meeting.meet_invite.meeting_code}`;
          console.log('[extractUrl] Built Meet URL from invite:', url);
          return url;
        }
        
        // WebEx: Build URL from webex_invite
        if (meeting.webex_invite?.meeting_link) {
          console.log('[extractUrl] Found Webex invite link:', meeting.webex_invite.meeting_link);
          return meeting.webex_invite.meeting_link;
        }
        
        // GoTo Meeting: Build URL from goto_meeting_invite
        if (meeting.goto_meeting_invite?.meeting_id) {
          const url = `https://www.gotomeet.me/${meeting.goto_meeting_invite.meeting_id}`;
          console.log('[extractUrl] Built GoTo URL from invite:', url);
          return url;
        }
        
        // ============ RAW OBJECT EXTRACTION ============
        
        // Google Calendar: hangoutLink (direct Google Meet link)
        if (meeting.raw?.hangoutLink) {
          console.log('[extractUrl] Found raw.hangoutLink:', meeting.raw.hangoutLink);
          return meeting.raw.hangoutLink;
        }
        
        // Google Calendar: conferenceData.entryPoints
        if (meeting.raw?.conferenceData?.entryPoints) {
          const videoEntry = meeting.raw.conferenceData.entryPoints.find(
            (ep: any) => ep.entryPointType === 'video'
          );
          if (videoEntry?.uri) {
            console.log('[extractUrl] Found raw.conferenceData video entry:', videoEntry.uri);
            return videoEntry.uri;
          }
        }
        
        // Microsoft Graph: onlineMeeting.joinUrl
        if (meeting.raw?.onlineMeeting?.joinUrl) {
          console.log('[extractUrl] Found raw.onlineMeeting.joinUrl:', meeting.raw.onlineMeeting.joinUrl);
          return meeting.raw.onlineMeeting.joinUrl;
        }
        
        // Microsoft Graph: onlineMeetingUrl (alternative field)
        if (meeting.raw?.onlineMeetingUrl) {
          console.log('[extractUrl] Found raw.onlineMeetingUrl:', meeting.raw.onlineMeetingUrl);
          return meeting.raw.onlineMeetingUrl;
        }
        
        // Microsoft Graph: isOnlineMeeting with joinWebUrl
        if (meeting.raw?.isOnlineMeeting && meeting.raw?.onlineMeeting?.joinWebUrl) {
          console.log('[extractUrl] Found raw.onlineMeeting.joinWebUrl:', meeting.raw.onlineMeeting.joinWebUrl);
          return meeting.raw.onlineMeeting.joinWebUrl;
        }

        // Microsoft Graph: webLink may contain Teams meeting info
        if (meeting.raw?.webLink) {
          const webLink = meeting.raw.webLink;
          if (webLink.includes('teams.microsoft.com') || webLink.includes('teams.live.com')) {
            console.log('[extractUrl] Found Teams URL in raw.webLink:', webLink);
            return webLink;
          }
        }
        
        // ============ TEXT FIELD EXTRACTION ============
        
        // Collect all text fields to search for URLs
        const textSources = [
          meeting.description || '',
          meeting.location || '',
          meeting.notes || '',
          meeting.raw?.description || '',
          meeting.raw?.body?.content || '',
          meeting.raw?.bodyPreview || '',
          meeting.raw?.location?.displayName || '',
          meeting.raw?.locations?.[0]?.displayName || '',
          meeting.raw?.locations?.[0]?.uniqueId || '',
        ];
        
        // Join, decode HTML entities, and try to decode URL-encoded parts
        let allText = textSources.join(' ');
        allText = decodeHtmlEntities(allText);
        
        // Also try URL-decoded version for encoded links
        const decodedText = safeDecodeURI(allText);
        const searchText = allText + ' ' + decodedText;
        
        if (searchText.trim()) {
          console.log('[extractUrl] Searching text fields for meeting:', meeting.title, 'Text length:', searchText.length);
          
          // Teams patterns (multiple formats) - expanded
          const teamsPatterns = [
            /href=["'](https:\/\/teams\.(microsoft|live)\.com\/[^"']+)["']/i,
            /href=["'](https:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^"']+)["']/i,
            /(https:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^\s<"'\\]+)/i,
            /(https:\/\/teams\.live\.com\/meet\/[^\s<"'\\]+)/i,
            /(https:\/\/teams\.microsoft\.com\/meet\/[^\s<"'\\]+)/i,
            /(https:\/\/teams\.microsoft\.com\/l\/meet\/[^\s<"'\\]+)/i,
            // URL-encoded Teams patterns
            /https%3A%2F%2Fteams\.microsoft\.com%2Fl%2Fmeetup-join%2F[^\s<"'\\]+/i,
          ];
          for (const pattern of teamsPatterns) {
            const match = searchText.match(pattern);
            if (match) {
              let url = match[1] || match[0];
              // Decode if URL-encoded
              if (url.includes('%3A')) {
                url = safeDecodeURI(url);
              }
              console.log('[extractUrl] Found Teams URL in text:', url);
              return url;
            }
          }
          
          // Zoom patterns (multiple formats)
          const zoomPatterns = [
            /href=["'](https:\/\/[\w.-]*zoom\.us\/[^"']+)["']/i,
            /(https:\/\/[\w.-]*zoom\.us\/j\/[^\s<"'\\]+)/i,
            /(https:\/\/[\w.-]*zoom\.us\/s\/[^\s<"'\\]+)/i,
            /(https:\/\/[\w.-]*zoom\.us\/my\/[^\s<"'\\]+)/i,
            /(https:\/\/[\w.-]*zoom\.us\/w\/[^\s<"'\\]+)/i,
          ];
          for (const pattern of zoomPatterns) {
            const match = searchText.match(pattern);
            if (match) {
              console.log('[extractUrl] Found Zoom URL in text:', match[1] || match[0]);
              return match[1] || match[0];
            }
          }
          
          // Google Meet patterns
          const meetPatterns = [
            /href=["'](https:\/\/meet\.google\.com\/[^"']+)["']/i,
            /(https:\/\/meet\.google\.com\/[a-z]+-[a-z]+-[a-z]+)/i,
            /(https:\/\/meet\.google\.com\/[a-z0-9-]+)/i,
          ];
          for (const pattern of meetPatterns) {
            const match = searchText.match(pattern);
            if (match) {
              console.log('[extractUrl] Found Google Meet URL in text:', match[1] || match[0]);
              return match[1] || match[0];
            }
          }
          
          // Webex patterns
          const webexPatterns = [
            /(https:\/\/[\w.-]*\.webex\.com\/[^\s<"'\\]+)/i,
            /(https:\/\/[\w.-]*webex\.com\/meet\/[^\s<"'\\]+)/i,
            /(https:\/\/[\w.-]*webex\.com\/join\/[^\s<"'\\]+)/i,
          ];
          for (const pattern of webexPatterns) {
            const match = searchText.match(pattern);
            if (match) {
              console.log('[extractUrl] Found Webex URL in text:', match[1] || match[0]);
              return match[1] || match[0];
            }
          }
          
          // Whereby patterns
          const wherebyMatch = searchText.match(/(https:\/\/whereby\.com\/[^\s<"'\\]+)/i);
          if (wherebyMatch) {
            console.log('[extractUrl] Found Whereby URL in text:', wherebyMatch[1] || wherebyMatch[0]);
            return wherebyMatch[1] || wherebyMatch[0];
          }
          
          // GoTo Meeting patterns
          const gotoPatterns = [
            /(https:\/\/[\w.-]*gotomeet\.me\/[^\s<"'\\]+)/i,
            /(https:\/\/[\w.-]*gotomeeting\.com\/[^\s<"'\\]+)/i,
            /(https:\/\/[\w.-]*goto\.com\/[^\s<"'\\]+)/i,
          ];
          for (const pattern of gotoPatterns) {
            const match = searchText.match(pattern);
            if (match) {
              console.log('[extractUrl] Found GoTo URL in text:', match[1] || match[0]);
              return match[1] || match[0];
            }
          }
          
          // BlueJeans patterns
          const bluejeanMatch = searchText.match(/(https:\/\/[\w.-]*bluejeans\.com\/[^\s<"'\\]+)/i);
          if (bluejeanMatch) {
            console.log('[extractUrl] Found BlueJeans URL in text:', bluejeanMatch[1] || bluejeanMatch[0]);
            return bluejeanMatch[1] || bluejeanMatch[0];
          }

          // Chime (Amazon) patterns
          const chimeMatch = searchText.match(/(https:\/\/chime\.aws\/[^\s<"'\\]+)/i);
          if (chimeMatch) {
            console.log('[extractUrl] Found Chime URL in text:', chimeMatch[1] || chimeMatch[0]);
            return chimeMatch[1] || chimeMatch[0];
          }

          // Slack Huddles patterns
          const slackMatch = searchText.match(/(https:\/\/[\w.-]*slack\.com\/[^\s<"'\\]*huddle[^\s<"'\\]*)/i);
          if (slackMatch) {
            console.log('[extractUrl] Found Slack Huddle URL in text:', slackMatch[1] || slackMatch[0]);
            return slackMatch[1] || slackMatch[0];
          }
        }
        
        console.log('[extractUrl] No meeting URL found for:', meeting.title);
        return null;
      };

      const meetings = (meetingItems || []).map((meeting: any) => {
        const meetingUrl = extractMeetingUrl(meeting);
        const willRecord = meeting.will_record ?? (meeting.bot_id !== null);
        
        // Log for debugging
        console.log('[list] Meeting:', {
          id: meeting.id,
          title: meeting.title,
          has_url: !!meetingUrl,
          will_record: willRecord,
          will_record_reason: meeting.will_record_reason,
          override_should_record: meeting.override_should_record,
          bot_id: meeting.bot_id,
        });
        
        return {
          id: meeting.id,
          title: meeting.title || 'Untitled Meeting',
          start_time: meeting.start_time,
          end_time: meeting.end_time,
          meeting_url: meetingUrl,
          platform: meeting.meeting_platform || meeting.platform,
          bot_id: meeting.bot_id,
          will_record: willRecord,
          will_record_reason: meeting.will_record_reason || null,
          override_should_record: meeting.override_should_record,
          attendees: meeting.attendees || [],
          organizer: meeting.organizer_email || meeting.organizer,
          is_organizer: meeting.is_hosted_by_me ?? meeting.is_organizer,
        };
      });
      
      // Sort by start_time
      meetings.sort((a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

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

    // Helper to get Recall.ai internal UUID from external_id (email)
    async function getRecallInternalId(externalId: string): Promise<string | null> {
      try {
        // First get an auth token
        const authResponse = await fetch('https://eu-central-1.recall.ai/api/v1/calendar/authenticate/', {
          method: 'POST',
          headers: {
            'Authorization': `Token ${RECALL_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ user_id: externalId }),
        });

        if (!authResponse.ok) {
          console.error('[Internal] Failed to get auth token:', authResponse.status);
          return null;
        }

        const authData = await authResponse.json();
        const authToken = authData.token;

        // Now fetch user data with auth token
        const response = await fetch(`https://eu-central-1.recall.ai/api/v1/calendar/user/?user_id=${externalId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Token ${RECALL_API_KEY}`,
            'x-recallcalendarauthtoken': authToken,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          console.error('[Internal] Failed to get Recall user:', response.status);
          return null;
        }

        const userData = await response.json();
        console.log('[Internal] Got Recall user data, UUID:', userData.id);
        return userData.id || null; // UUID
      } catch (error) {
        console.error('[Internal] Error getting Recall user:', error);
        return null;
      }
    }

    // Helper to sync preferences to Recall.ai
    // IMPORTANT: According to Recall.ai docs:
    // - The endpoint is /api/v1/calendar/user/ (NOT /user/{uuid}/preferences/)
    // - The user is identified by the x-recallcalendarauthtoken header
    // - true = this rule is evaluated and must be satisfied
    // - false = this rule is ignored
    // For "record all meetings": set external/internal to true, others to false (ignored)
    async function syncPreferencesToRecall(externalUserId: string, prefs: any, botConfig?: { bot_name?: string; bot_avatar_url?: string }): Promise<boolean> {
      // "Record all meetings" = external + internal true, filtering rules false (ignored)
      const recallPreferences = {
        record_non_host: false,       // false = ignore this rule (don't require non-host)
        record_recurring: false,      // false = ignore this rule (record all, not just recurring)
        record_external: true,        // true = record external meetings
        record_internal: true,        // true = record internal meetings
        record_confirmed: false,      // false = ignore this rule (record unconfirmed too)
        record_only_host: prefs.record_only_owned ?? false, // Only if user wants host-only
      };

      console.log('[Internal] Syncing preferences to Recall.ai for user:', externalUserId, 'Preferences:', JSON.stringify(recallPreferences));

      try {
        // Step 1: Get auth token for this user
        const authResponse = await fetch('https://eu-central-1.recall.ai/api/v1/calendar/authenticate/', {
          method: 'POST',
          headers: {
            'Authorization': `Token ${RECALL_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ user_id: externalUserId }),
        });

        if (!authResponse.ok) {
          console.error('[Internal] Failed to get auth token for preferences sync:', authResponse.status);
          return false;
        }

        const authData = await authResponse.json();
        
        // Build the update payload - bot_name MUST be inside preferences object!
        const updatePayload: Record<string, unknown> = { 
          preferences: {
            ...recallPreferences,
            ...(botConfig?.bot_name && { bot_name: botConfig.bot_name })
          }
        };
        
        if (botConfig?.bot_name) {
          console.log('[Sync] Including bot_name INSIDE preferences:', botConfig.bot_name);
        }
        
        // Step 2: PATCH to /api/v1/calendar/user/ with auth token header (NO UUID in path!)
        const response = await fetch('https://eu-central-1.recall.ai/api/v1/calendar/user/', {
          method: 'PATCH',
          headers: {
            'Authorization': `Token ${RECALL_API_KEY}`,
            'x-recallcalendarauthtoken': authData.token,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatePayload),
        });

        console.log('[Sync] Sent preferences body:', JSON.stringify(updatePayload));

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Internal] Failed to sync preferences:', response.status, errorText);
          return false;
        }
        const result = await response.json();
        console.log('[Sync] Full response from Recall.ai:', JSON.stringify(result));
        console.log('[Sync] Confirmed bot_name:', result.bot_name);
        console.log('[Sync] Received preferences from Recall:', JSON.stringify(result.preferences));
        
        // Verify the bot name was actually set
        if (botConfig?.bot_name && result.bot_name !== botConfig.bot_name) {
          console.warn('[Sync] bot_name mismatch! Expected:', botConfig.bot_name, 'Got:', result.bot_name);
        } else if (botConfig?.bot_name) {
          console.log('[Sync] ✓ bot_name successfully set to:', result.bot_name);
        }
        
        return true;
      } catch (error) {
        console.error('[Internal] Error syncing preferences:', error);
        return false;
      }
    }

    if (action === 'init_preferences') {
      // Initialize/repair preferences using external user ID (email)
      const recallUserId = await getRecallUserId(supabaseUserId);
      if (!recallUserId) {
        return new Response(
          JSON.stringify({ success: false, error: 'No calendar connected' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get user's bot settings from database
      const { data: userBotSettings } = await supabase
        .from('recall_calendar_users')
        .select('bot_name, bot_avatar_url')
        .eq('supabase_user_id', supabaseUserId)
        .maybeSingle();

      // Set default preferences
      const defaultPrefs = {
        record_all: true,
        record_only_owned: false,
        record_external: true,
        auto_record: true,
      };

      // Sync to Recall.ai using external user ID (email) - include bot config
      const botConfig = {
        bot_name: userBotSettings?.bot_name || undefined,
        bot_avatar_url: userBotSettings?.bot_avatar_url || undefined,
      };
      const synced = await syncPreferencesToRecall(recallUserId, defaultPrefs, botConfig);

      // Also update local database
      await supabase
        .from('recall_calendar_users')
        .update({ recording_preferences: defaultPrefs })
        .eq('supabase_user_id', supabaseUserId);

      return new Response(
        JSON.stringify({ 
          success: synced, 
          preferences: defaultPrefs,
          recall_user_id: recallUserId,
          message: synced ? 'Preferences initialized successfully' : 'Failed to sync to Recall.ai'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'update_preferences') {
      // supabaseUserId is always set from authenticated user

      const { data: userData, error: userError } = await supabase
        .from('recall_calendar_users')
        .select('*, bot_name, bot_avatar_url')
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

      // Sync preferences to Recall.ai using external user ID (email) - include bot config
      const recallUserId = await getRecallUserId(supabaseUserId);
      if (recallUserId) {
        const botConfig = {
          bot_name: userData?.bot_name || undefined,
          bot_avatar_url: userData?.bot_avatar_url || undefined,
        };
        const synced = await syncPreferencesToRecall(recallUserId, newPrefs, botConfig);
        console.log('[update_preferences] Sync result:', synced);
      }

      return new Response(
        JSON.stringify({ success: true, preferences: newPrefs }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // NEW: Refresh calendar action - forces Recall.ai to re-sync with Google/Microsoft calendar
    if (action === 'refresh') {
      const recallUserId = await getRecallUserId(supabaseUserId);
      if (!recallUserId) {
        return new Response(
          JSON.stringify({ success: false, error: 'No calendar connected' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('[refresh] Triggering calendar refresh for user:', recallUserId);

      // Get auth token
      const authResponse = await fetch('https://eu-central-1.recall.ai/api/v1/calendar/authenticate/', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${RECALL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: recallUserId }),
      });

      if (!authResponse.ok) {
        console.error('[refresh] Failed to get auth token:', authResponse.status);
        throw new Error('Failed to authenticate');
      }

      const authData = await authResponse.json();

      // Force refresh calendar from provider (Google/Microsoft)
      const refreshResponse = await fetch(
        'https://eu-central-1.recall.ai/api/v1/calendar/meetings/refresh/',
        {
          method: 'POST',
          headers: {
            'Authorization': `Token ${RECALL_API_KEY}`,
            'x-recallcalendarauthtoken': authData.token,
            'Content-Type': 'application/json',
          },
        }
      );

      const refreshed = refreshResponse.ok;
      console.log('[refresh] Calendar refresh result:', refreshed, 'Status:', refreshResponse.status);

      return new Response(
        JSON.stringify({ 
          success: refreshed, 
          message: refreshed ? 'Calendar refresh triggered' : 'Refresh failed' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // NEW: Sync bot settings action - syncs bot name and avatar to Recall.ai
    if (action === 'sync_bot_settings') {
      const recallUserId = await getRecallUserId(supabaseUserId);
      if (!recallUserId) {
        return new Response(
          JSON.stringify({ success: false, error: 'No calendar connected' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get user's current preferences and bot settings
      const { data: userData } = await supabase
        .from('recall_calendar_users')
        .select('recording_preferences, bot_name, bot_avatar_url')
        .eq('supabase_user_id', supabaseUserId)
        .maybeSingle();

      const prefs = userData?.recording_preferences || { record_all: true };
      const botConfig = {
        bot_name: userData?.bot_name || undefined,
        bot_avatar_url: userData?.bot_avatar_url || undefined,
      };

      console.log('[sync_bot_settings] Syncing bot settings for user:', supabaseUserId, 'Config:', JSON.stringify(botConfig));

      const synced = await syncPreferencesToRecall(recallUserId, prefs, botConfig);
      
      console.log('[sync_bot_settings] Sync completed:', synced ? 'SUCCESS' : 'FAILED');

      return new Response(
        JSON.stringify({ 
          success: synced, 
          bot_name: botConfig.bot_name,
          message: synced ? 'Bot settings synced to Recall.ai' : 'Failed to sync bot settings' 
        }),
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