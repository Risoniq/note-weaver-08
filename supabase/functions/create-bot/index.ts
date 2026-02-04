import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.208.0/encoding/base64.ts";

// Dynamic CORS headers based on origin
function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const allowedOrigins = [
    Deno.env.get('APP_URL') || '',
    'https://notetaker2pro.com',
    'https://www.notetaker2pro.com',
    'http://localhost:5173',
    'http://localhost:8080',
    'http://localhost:3000',
  ].filter(Boolean);
  
  const isLovablePreview = origin.endsWith('.lovableproject.com') || origin.endsWith('.lovable.app');
  const allowOrigin = allowedOrigins.includes(origin) || isLovablePreview 
    ? origin 
    : '*';
  
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
    'Access-Control-Allow-Credentials': 'true',
  };
}

// Extract real meeting URL from Teams deep links
function extractRealMeetingUrl(url: string): string {
  try {
    const parsed = new URL(url);
    
    // Check if this is a Teams launcher/deep link
    if (parsed.hostname === 'teams.microsoft.com' && parsed.pathname.includes('/dl/launcher')) {
      // Extract the encoded URL from the 'url' parameter
      const encodedUrl = parsed.searchParams.get('url');
      if (encodedUrl) {
        // Decode the URL parameter - it's typically double-encoded
        let decodedUrl = decodeURIComponent(encodedUrl);
        
        // If it starts with /_#/meet/, convert to proper Teams meeting URL
        if (decodedUrl.startsWith('/_#/meet/') || decodedUrl.startsWith('/#/meet/')) {
          // Extract meeting ID and password from the path
          const meetMatch = decodedUrl.match(/meet\/(\d+)(?:\?p=([^&]+))?/);
          if (meetMatch) {
            const meetingId = meetMatch[1];
            const password = meetMatch[2] || '';
            // Build proper Teams Live meeting URL
            const realUrl = `https://teams.live.com/meet/${meetingId}${password ? `?p=${password}` : ''}`;
            console.log(`[URL] Converted Teams deep link to: ${realUrl}`);
            return realUrl;
          }
        }
        
        // If it starts with /l/meetup-join, it's already a proper format
        if (decodedUrl.startsWith('/l/meetup-join/')) {
          const realUrl = `https://teams.microsoft.com${decodedUrl}`;
          console.log(`[URL] Converted Teams deep link to: ${realUrl}`);
          return realUrl;
        }
      }
    }
    
    // Check for teams.live.com launcher links
    if (parsed.hostname === 'teams.live.com' && parsed.pathname.includes('/dl/launcher')) {
      const encodedUrl = parsed.searchParams.get('url');
      if (encodedUrl) {
        let decodedUrl = decodeURIComponent(encodedUrl);
        if (decodedUrl.startsWith('/meet/')) {
          const realUrl = `https://teams.live.com${decodedUrl}`;
          console.log(`[URL] Converted Teams Live deep link to: ${realUrl}`);
          return realUrl;
        }
      }
    }
    
    return url;
  } catch {
    return url;
  }
}

// Validate meeting URL - only allow known meeting platforms
function validateMeetingUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url);
    
    // Only allow HTTPS
    if (parsed.protocol !== 'https:') {
      return { valid: false, error: 'Only HTTPS URLs are allowed' };
    }
    
    // Whitelist known meeting platforms
    const allowedHosts = [
      'zoom.us',
      'us02web.zoom.us',
      'us04web.zoom.us',
      'us05web.zoom.us',
      'us06web.zoom.us',
      'teams.microsoft.com',
      'teams.live.com',
      'meet.google.com',
      'webex.com',
      'bluejeans.com',
      'gotomeeting.com',
      'whereby.com',
    ];
    
    const isAllowed = allowedHosts.some(host => 
      parsed.hostname === host || 
      parsed.hostname.endsWith('.' + host)
    );
    
    if (!isAllowed) {
      return { valid: false, error: 'URL must be from a supported meeting platform (Zoom, Teams, Google Meet, etc.)' };
    }
    
    // Prevent private IP ranges
    const privateIpPattern = /^(localhost|127\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/;
    if (privateIpPattern.test(parsed.hostname)) {
      return { valid: false, error: 'Private IP addresses are not allowed' };
    }
    
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

// Validate avatar URL - only allow Supabase storage URLs
function validateAvatarUrl(url: string): boolean {
  if (!url) return true; // Optional field
  
  try {
    const parsed = new URL(url);
    
    // Only allow HTTPS
    if (parsed.protocol !== 'https:') return false;
    
    // Only allow Supabase storage URLs
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (supabaseUrl && parsed.origin === supabaseUrl) {
      return true;
    }
    
    // Also allow common CDNs and image services
    const allowedHosts = [
      'supabase.co',
      'supabase.com',
    ];
    
    return allowedHosts.some(host => 
      parsed.hostname.endsWith('.' + host)
    );
  } catch {
    return false;
  }
}

// Funktion um ein Bild von einer URL zu laden und als Base64 zu konvertieren
async function fetchImageAsBase64(imageUrl: string): Promise<string | null> {
  try {
    console.log(`[Image] Lade Bild von: ${imageUrl}`);
    const response = await fetch(imageUrl);
    
    if (!response.ok) {
      console.error(`[Image] Fehler beim Laden: ${response.status}`);
      return null;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const base64String = base64Encode(uint8Array);
    
    console.log(`[Image] Bild erfolgreich geladen und konvertiert (${base64String.length} chars)`);
    return base64String;
  } catch (error) {
    console.error(`[Image] Fehler beim Konvertieren:`, error);
    return null;
  }
}

// Helper: Authenticate user from request
async function authenticateUser(req: Request): Promise<{ user: { id: string; email?: string } | null; error?: string }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return { user: null, error: 'Authorization header required' };
  }

  const token = authHeader.replace('Bearer ', '');
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  
  if (authError || !user) {
    console.error('[Auth] Authentication failed:', authError?.message);
    return { user: null, error: 'Invalid or expired token' };
  }

  return { user: { id: user.id, email: user.email } };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  // CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Authenticate user
    const { user, error: authError } = await authenticateUser(req);
    if (!user) {
      return new Response(
        JSON.stringify({ error: authError || 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Auth] Authenticated user: ${user.id}`);

    // 2. Daten vom Frontend holen
    const { meetingUrl, botName, botAvatarUrl } = await req.json();

    if (!meetingUrl) {
      return new Response(
        JSON.stringify({ error: "Meeting URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Extract real meeting URL from deep links
    const realMeetingUrl = extractRealMeetingUrl(meetingUrl);
    if (realMeetingUrl !== meetingUrl) {
      console.log(`[URL] Original URL: ${meetingUrl}`);
      console.log(`[URL] Extracted URL: ${realMeetingUrl}`);
    }

    // 4. Validate meeting URL
    const urlValidation = validateMeetingUrl(realMeetingUrl);
    if (!urlValidation.valid) {
      console.error(`[Validation] Invalid meeting URL: ${urlValidation.error}`);
      return new Response(
        JSON.stringify({ error: urlValidation.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Validate avatar URL if provided
    if (botAvatarUrl && !validateAvatarUrl(botAvatarUrl)) {
      console.error(`[Validation] Invalid avatar URL`);
      return new Response(
        JSON.stringify({ error: "Invalid avatar URL. Only Supabase storage URLs are allowed." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Supabase Client initialisieren (Service Role for DB writes)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 5.1. Quota-Check: Prüfen ob User noch Kontingent hat
    // Zuerst prüfen: Ist User in einem Team?
    const { data: teamMembership } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', user.id)
      .maybeSingle();

    let maxMinutes: number;
    let usedMinutes: number;
    let quotaType: 'team' | 'individual';

    if (teamMembership?.team_id) {
      // User ist in einem Team - Team-Kontingent verwenden
      quotaType = 'team';
      
      // Team-Kontingent laden
      const { data: teamData } = await supabase
        .from('teams')
        .select('max_minutes')
        .eq('id', teamMembership.team_id)
        .single();
      
      maxMinutes = teamData?.max_minutes ?? 600; // Default 10h für Teams

      // Alle Team-Mitglieder holen
      const { data: teamMembers } = await supabase
        .from('team_members')
        .select('user_id')
        .eq('team_id', teamMembership.team_id);
      
      const memberIds = teamMembers?.map(m => m.user_id) || [];

      // Verbrauch aller Team-Mitglieder summieren
      const { data: teamRecordings } = await supabase
        .from('recordings')
        .select('duration')
        .in('user_id', memberIds)
        .eq('status', 'done');

      const usedSeconds = teamRecordings?.reduce((sum: number, r: { duration: number | null }) => sum + (r.duration || 0), 0) || 0;
      usedMinutes = Math.round(usedSeconds / 60);

      console.log(`[Quota] Team-Kontingent für User ${user.id}: ${usedMinutes}/${maxMinutes} Minuten (Team: ${teamMembership.team_id})`);
    } else {
      // Individuelles Kontingent (wie bisher)
      quotaType = 'individual';
      
      const { data: quotaData } = await supabase
        .from('user_quotas')
        .select('max_minutes')
        .eq('user_id', user.id)
        .maybeSingle();

      maxMinutes = quotaData?.max_minutes ?? 120; // Default 2h

      const { data: doneRecordings } = await supabase
        .from('recordings')
        .select('duration')
        .eq('user_id', user.id)
        .eq('status', 'done');

      const usedSeconds = doneRecordings?.reduce((sum: number, r: { duration: number | null }) => sum + (r.duration || 0), 0) || 0;
      usedMinutes = Math.round(usedSeconds / 60);

      console.log(`[Quota] Individuelles Kontingent für User ${user.id}: ${usedMinutes}/${maxMinutes} Minuten`);
    }

    if (usedMinutes >= maxMinutes) {
      const message = quotaType === 'team' 
        ? 'Das Team-Kontingent ist erschöpft. Kontaktiere deinen Admin für mehr Meeting-Stunden.'
        : 'Dein Meeting-Kontingent ist erschöpft. Upgrade auf die Vollversion für unbegrenzte Meetings.';
      
      console.log(`[Quota] User ${user.id} hat ${quotaType}-Kontingent erschöpft: ${usedMinutes}/${maxMinutes} Minuten`);
      return new Response(
        JSON.stringify({ 
          error: 'Quota exhausted',
          message
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Quota] User ${user.id} hat noch ${quotaType}-Kontingent: ${usedMinutes}/${maxMinutes} Minuten`);

    // 6. Recall API Konfiguration laden
    const recallApiKey = Deno.env.get("RECALL_API_KEY");
    const recallApiUrl = Deno.env.get("RECALL_API_URL") || "https://eu-central-1.recall.ai/api/v1/bot";

    if (!recallApiKey) {
      console.error('[Config] RECALL_API_KEY is not set');
      return new Response(
        JSON.stringify({ error: "Service configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load bot settings from database if not provided from frontend
    let finalBotName = (botName && botName.trim()) ? botName.trim() : null;
    let finalAvatarUrl = (botAvatarUrl && botAvatarUrl.trim()) ? botAvatarUrl.trim() : null;
    
    // If no settings from frontend, load from database
    if (!finalBotName || !finalAvatarUrl) {
      console.log(`[create-bot] Loading bot settings from database for user: ${user.id}`);
      const { data: userSettings, error: settingsError } = await supabase
        .from('recall_calendar_users')
        .select('bot_name, bot_avatar_url')
        .eq('supabase_user_id', user.id)
        .maybeSingle();
      
      if (settingsError) {
        console.warn('[create-bot] Error loading user settings:', settingsError);
      } else if (userSettings) {
        console.log(`[create-bot] Found user settings - bot_name: "${userSettings.bot_name}", avatar: "${userSettings.bot_avatar_url}"`);
        if (!finalBotName && userSettings.bot_name) {
          finalBotName = userSettings.bot_name;
        }
        if (!finalAvatarUrl && userSettings.bot_avatar_url) {
          finalAvatarUrl = userSettings.bot_avatar_url;
        }
      }
    }
    
    // Default fallback
    finalBotName = finalBotName || "Notetaker Bot";
    
    console.log(`[create-bot] Empfangene Parameter - botName: "${botName}", botAvatarUrl: "${botAvatarUrl}"`);
    console.log(`[create-bot] Finaler Bot Name: "${finalBotName}", Finaler Avatar: "${finalAvatarUrl}"`);
    console.log(`[Recall] Sende Bot zu: ${realMeetingUrl}`);

    // 7. Bot-Konfiguration erstellen
    const botConfig: Record<string, unknown> = {
      meeting_url: realMeetingUrl,
      bot_name: finalBotName,
      join_at: new Date().toISOString(),
      // Speaker Timeline für Sprecher-Identifikation aktivieren
      speaker_timeline: {
        enabled: true
      },
      // Automatisches Verlassen konfigurieren - längere Wartezeit im Wartebereich
      automatic_leave: {
        waiting_room_timeout: 600, // 10 Minuten im Wartebereich warten
        noone_joined_timeout: 300, // 5 Minuten warten wenn niemand beitritt
        everyone_left_timeout: 60  // 1 Minute warten nachdem alle gegangen sind
      },
      recording_config: {
        transcript: {
          provider: { 
            recallai_streaming: {
              mode: "prioritize_accuracy",
              language_code: "auto"
            }
          }
        }
      }
    };
    
    // Bot-Profilbild als Video-Output setzen (funktioniert für Teams, Zoom, Meet)
    if (finalAvatarUrl) {
      console.log(`[create-bot] Lade Avatar von: ${finalAvatarUrl}`);
      try {
        const base64Image = await fetchImageAsBase64(finalAvatarUrl);
        
        if (base64Image) {
          console.log(`[create-bot] Avatar geladen, Base64 Länge: ${base64Image.length}`);
          // automatic_video_output zeigt das Bild als Bot-Video/Profilbild
          botConfig.automatic_video_output = {
            in_call_not_recording: {
              kind: "jpeg",
              b64_data: base64Image
            },
            in_call_recording: {
              kind: "jpeg", 
              b64_data: base64Image
            }
          };
          console.log(`[create-bot] Bot Avatar als Video-Output konfiguriert`);
        } else {
          console.warn(`[create-bot] Avatar konnte nicht als Base64 konvertiert werden`);
        }
      } catch (imageError) {
        console.error(`[create-bot] Avatar-Fehler:`, imageError);
      }
    } else {
      console.log(`[create-bot] Kein Avatar gesetzt`);
    }

    // 8. Bot bei Recall.ai erstellen
    const recallResponse = await fetch(recallApiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Token ${recallApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(botConfig),
    });

    if (!recallResponse.ok) {
      const errorText = await recallResponse.text();
      console.error("[Recall] API Fehler:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to create meeting bot" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const botData = await recallResponse.json();
    console.log(`[Recall] Bot erstellt. ID: ${botData.id}`);

    // 9. Generiere eine meeting_id (NOT NULL constraint)
    const meetingId = crypto.randomUUID();

    // 10. Bot-Daten in Supabase speichern mit user_id
    const { data: dbData, error: dbError } = await supabase
      .from("recordings")
      .insert({
        meeting_id: meetingId,
        meeting_url: realMeetingUrl,
        recall_bot_id: botData.id,
        status: "joining",
        user_id: user.id, // Associate recording with authenticated user
      })
      .select()
      .single();

    if (dbError) {
      console.error("[Supabase] DB Fehler:", dbError);
      return new Response(
        JSON.stringify({ error: "Failed to save recording" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Supabase] Recording erstellt: ${dbData.id}`);

    // 11. Erfolgsmeldung zurück ans Frontend
    return new Response(
      JSON.stringify({
        success: true,
        meetingId: dbData.meeting_id,
        bot_id: botData.id,
        recording: dbData,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[create-bot] Fehler:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred processing your request" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
