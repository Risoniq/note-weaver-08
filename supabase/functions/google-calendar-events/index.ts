import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { accessToken, timeMin, timeMax } = await req.json();

    if (!accessToken) {
      throw new Error('Access token is required');
    }

    const now = new Date();
    const defaultTimeMin = timeMin || now.toISOString();
    const defaultTimeMax = timeMax || new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const calendarUrl = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
    calendarUrl.searchParams.set('timeMin', defaultTimeMin);
    calendarUrl.searchParams.set('timeMax', defaultTimeMax);
    calendarUrl.searchParams.set('singleEvents', 'true');
    calendarUrl.searchParams.set('orderBy', 'startTime');
    calendarUrl.searchParams.set('maxResults', '50');

    console.log('Fetching calendar events from:', calendarUrl.toString());

    const response = await fetch(calendarUrl.toString(), {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Calendar API error:', response.status, errorText);
      throw new Error(`Calendar API error: ${response.status}`);
    }

    const data = await response.json();
    
    // deno-lint-ignore no-explicit-any
    const events = (data.items || []).map((event: any) => {
      let meetingUrl = null;
      
      if (event.conferenceData?.entryPoints) {
        // deno-lint-ignore no-explicit-any
        const videoEntry = event.conferenceData.entryPoints.find(
          (ep: any) => ep.entryPointType === 'video'
        );
        if (videoEntry) {
          meetingUrl = videoEntry.uri;
        }
      }
      
      if (!meetingUrl) {
        const textToSearch = `${event.description || ''} ${event.location || ''}`;
        const zoomMatch = textToSearch.match(/https:\/\/[a-z0-9.-]*zoom\.us\/[^\s<)"]*/i);
        const teamsMatch = textToSearch.match(/https:\/\/teams\.microsoft\.com\/[^\s<)"]*/i);
        meetingUrl = zoomMatch?.[0] || teamsMatch?.[0] || null;
      }

      return {
        id: event.id,
        summary: event.summary || 'Kein Titel',
        description: event.description || null,
        start: event.start?.dateTime || event.start?.date,
        end: event.end?.dateTime || event.end?.date,
        location: event.location || null,
        meetingUrl,
        hangoutLink: event.hangoutLink || null,
        // deno-lint-ignore no-explicit-any
        attendees: event.attendees?.map((a: any) => ({
          email: a.email,
          displayName: a.displayName,
          responseStatus: a.responseStatus,
        })) || [],
      };
    });

    console.log(`Found ${events.length} events`);

    return new Response(JSON.stringify({ events }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[Internal] Error in google-calendar-events:', error);
    return new Response(JSON.stringify({ error: 'An error occurred processing your request' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
